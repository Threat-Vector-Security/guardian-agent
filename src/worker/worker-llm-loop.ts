import type { ChatMessage, ChatResponse, ChatOptions } from '../llm/types.js';
import type { ToolCaller } from '../broker/types.js';
import type { ToolDefinition, ToolExecutionRequest, ToolRunResponse } from '../tools/types.js';
import { compactMessagesIfOverBudget } from '../util/context-budget.js';
import { getMemoryMutationIntentDeniedMessage, isMemoryMutationToolName } from '../util/memory-intent.js';
import { isIntermediateStatusResponse, isResponseDegraded } from '../util/response-quality.js';
import { normalizeToolCallsForExecution, recoverToolCallsFromStructuredText } from '../util/structured-json.js';
import { withTaintedContentSystemPrompt } from '../util/tainted-content.js';
import { formatToolResultForLLM, toLLMToolDef } from '../chat-agent-helpers.js';
import type {
  WorkerExecutionCompletionReason,
  WorkerExecutionResponseQuality,
} from '../runtime/worker-execution-metadata.js';

export interface LlmLoopOptions {
  /** Optional principal ID to authorize tool executions. */
  principalId?: string;
  /** Optional principal role to authorize tool executions. */
  principalRole?: string;
  /** Optional request metadata for tool-job correlation and code-session scoping. */
  requestId?: string;
  userId?: string;
  channel?: string;
  surfaceId?: string;
  codeContext?: ToolExecutionRequest['codeContext'];
  /** When true, model-authored memory mutation tool calls are allowed. */
  allowModelMemoryMutation?: boolean;
  /** Optional fallback chat function for quality-based retry with an external provider. */
  fallbackChatFn?: (msgs: ChatMessage[], opts?: ChatOptions) => Promise<ChatResponse>;
  /** When true, try a tool-free answer before entering the tool loop. */
  preferAnswerFirst?: boolean;
  /** Optional validator for tool-free answer-first content. */
  answerFirstResponseIsSufficient?: (content: string) => boolean;
  /** Optional corrective prompt for plan/review/verification skill shape. */
  answerFirstCorrectionPrompt?: string;
  /** Optional fallback content when an answer-first skill response stays structurally invalid. */
  answerFirstFallbackContent?: string;
  /** Optional system correction used when a repo/file task narrates instead of using tools. */
  toolExecutionCorrectionPrompt?: string;
  /** Structured per-tool lifecycle callback for delegated execution receipts. */
  onToolEvent?: (event: LlmLoopToolEvent) => void;
}

export interface LlmLoopOutcome {
  completionReason: WorkerExecutionCompletionReason;
  responseQuality: WorkerExecutionResponseQuality;
  roundCount: number;
  toolCallCount: number;
  toolResultCount: number;
  successfulToolResultCount: number;
  policyBlockedSamples?: Array<{ toolName: string; message: string }>;
}

export interface LlmLoopToolEvent {
  phase: 'started' | 'completed';
  toolCall: { id: string; name: string };
  args: Record<string, unknown>;
  startedAt: number;
  endedAt?: number;
  result?: Record<string, unknown>;
  errorMessage?: string;
}

// Extracted LLM loop, which can run either in-process or in an isolated worker
export async function runLlmLoop(
  messages: ChatMessage[],
  chatFn: (msgs: ChatMessage[], opts?: ChatOptions) => Promise<ChatResponse>,
  toolCaller: ToolCaller | undefined,
  maxRounds: number,
  contextBudget: number,
  onToolCalled?: (toolCall: { id: string; name: string }, result: Record<string, unknown>) => void,
  options?: LlmLoopOptions,
): Promise<{ finalContent: string; messages: ChatMessage[]; hasPendingApprovals: boolean; outcome: LlmLoopOutcome }> {
  let finalContent = '';
  let rounds = 0;
  let hasPendingApprovals = false;
  let completionReason: WorkerExecutionCompletionReason = 'model_response';
  let toolCallCount = 0;
  let toolResultCount = 0;
  let successfulToolResultCount = 0;
  let forcedPolicyRetryUsed = false;
  let forcedPolicyBlockedRetryUsed = false;
  let forcedSkillShapeRetryCount = 0;
  let forcedToolExecutionRetryUsed = false;
  let forcedDiscoveryContinuationRetryUsed = false;
  let forcedIntermediateStatusRetryCount = 0;
  let lastToolRoundResults: Array<{ toolName: string; result: Record<string, unknown> }> = [];
  let currentContextTrustLevel: import('../tools/types.js').ContentTrustLevel = 'trusted';
  const currentTaintReasons = new Set<string>();
  let seededAnswerFirstResponse: ChatResponse | null = null;

  const allToolDefs = toolCaller ? toolCaller.listAlwaysLoaded() : [];
  let llmToolDefs = allToolDefs.map((definition) => toLLMToolDef(definition, 'external'));

  const formatToolResult = (toolName: string, result: unknown): string => {
    if (toolCaller && typeof (toolCaller as unknown as { formatToolResultForLlm?: (name: string, value: unknown) => string }).formatToolResultForLlm === 'function') {
      return (toolCaller as unknown as { formatToolResultForLlm: (name: string, value: unknown) => string }).formatToolResultForLlm(toolName, result);
    }
    return formatToolResultForLLM(toolName, result, []);
  };

  const searchDeferredTools = async (query: string): Promise<ToolDefinition[]> => {
    if (!toolCaller) return [];
    const searched = await toolCaller.searchTools(query);
    return Array.isArray(searched) ? searched : [];
  };

  const mergeDiscoveredTools = (tools: ToolDefinition[]): void => {
    for (const discovered of tools) {
      if (!llmToolDefs.some((tool) => tool.name === discovered.name)) {
        allToolDefs.push(discovered);
        llmToolDefs.push(toLLMToolDef(discovered, 'external'));
      }
    }
  };

  const mergeFindToolsOutput = (toolName: string, result: Record<string, unknown>): void => {
    if (toolName !== 'find_tools' || result.success !== true || !result.output || typeof result.output !== 'object') {
      return;
    }
    const output = result.output as { tools?: ToolDefinition[] };
    if (Array.isArray(output.tools)) {
      mergeDiscoveredTools(output.tools);
    }
  };

  const searchIfToolMissing = async (name: string): Promise<void> => {
    if (llmToolDefs.some((tool) => tool.name === name)) return;
    const query = name.includes('_') ? name.replace(/_/g, ' ') : name;
    mergeDiscoveredTools(await searchDeferredTools(query));
  };

  const formatToolError = (message: string): string => formatToolResultForLLM('tool_error', { success: false, error: message }, []);
  const latestUserRequest = (): string => (
    [...messages]
      .reverse()
      .find((entry) => entry.role === 'user' && typeof entry.content === 'string' && entry.content.trim().length > 0)
      ?.content
      ?.trim()
    ?? ''
  );

  const recoverStructuredToolCalls = (response: ChatResponse): ChatResponse => {
    if (response.toolCalls?.length) {
      return response;
    }
    const recoveredToolCalls = recoverToolCallsFromStructuredText(response.content ?? '', llmToolDefs);
    if (!recoveredToolCalls?.toolCalls.length) {
      return response;
    }
    return {
      ...response,
      toolCalls: recoveredToolCalls.toolCalls,
      finishReason: 'tool_calls',
      content: '',
    };
  };

  const extractToolNameFromSearchQuery = (args: Record<string, unknown>): string | null => {
    const query = typeof args.query === 'string' ? args.query.trim() : '';
    if (!query) return null;
    const exact = query.match(/^[a-z0-9_:-]{3,}$/i)?.[0];
    return exact ?? null;
  };

  const locateDiscoveredTool = async (toolName: string, args: Record<string, unknown>): Promise<void> => {
    await searchIfToolMissing(toolName);
    if (toolName === 'find_tools') {
      const hinted = extractToolNameFromSearchQuery(args);
      if (hinted) {
        await searchIfToolMissing(hinted);
      }
    }
  };

  const toolCallerWithDiscovery = async (
    toolName: string,
    args: Record<string, unknown>,
    request: Parameters<ToolCaller['callTool']>[0],
  ): Promise<ToolRunResponse> => {
    await locateDiscoveredTool(toolName, args);
    const result = await toolCaller!.callTool(request);
    mergeFindToolsOutput(toolName, result as unknown as Record<string, unknown>);
    return result;
  };

  if (options?.preferAnswerFirst) {
    try {
      const answerFirstResponse = recoverStructuredToolCalls(await chatFn(
        withTaintedContentSystemPrompt(
          messages,
          currentContextTrustLevel,
          currentTaintReasons,
        ),
        { tools: [] },
      ));
      const answerFirstContent = answerFirstResponse.content?.trim() ?? '';
      if (
        answerFirstContent
        && !options?.toolExecutionCorrectionPrompt?.trim()
        && (options?.answerFirstResponseIsSufficient?.(answerFirstContent) ?? !isResponseDegraded(answerFirstContent))
        && (!answerFirstResponse.toolCalls || answerFirstResponse.toolCalls.length === 0)
      ) {
        finalContent = answerFirstContent;
        completionReason = 'answer_first_response';
      } else if (answerFirstResponse.toolCalls?.length) {
        seededAnswerFirstResponse = answerFirstResponse;
      }
    } catch {
      finalContent = '';
    }
  }

  while (rounds < maxRounds) {
    if (finalContent) {
      break;
    }
    // Context window awareness: compact oldest tool results if approaching budget
    compactMessagesIfOverBudget(messages, contextBudget);

    const plannerMessages = withTaintedContentSystemPrompt(
      messages,
      currentContextTrustLevel,
      currentTaintReasons,
    );

    let response = rounds === 0 && seededAnswerFirstResponse
      ? seededAnswerFirstResponse
      : await chatFn(plannerMessages, { tools: llmToolDefs });
    seededAnswerFirstResponse = null;
    finalContent = response.content ?? '';

    if (
      !forcedPolicyRetryUsed
      && (!response.toolCalls || response.toolCalls.length === 0)
      && shouldRetryPolicyUpdateCorrection(messages, finalContent, llmToolDefs)
    ) {
      forcedPolicyRetryUsed = true;
      response = await chatFn(
        [
          ...plannerMessages,
          { role: 'assistant', content: response.content ?? '' },
          { role: 'user', content: buildPolicyUpdateCorrectionPrompt() },
        ],
        { tools: llmToolDefs },
      );
      finalContent = response.content ?? '';
    }

    response = recoverStructuredToolCalls(response);
    finalContent = response.content ?? '';
    if (response.toolCalls?.length) {
      response = {
        ...response,
        toolCalls: normalizeToolCallsForExecution(response.toolCalls, llmToolDefs),
      };
    }

    if (
      !forcedPolicyBlockedRetryUsed
      && (!response.toolCalls || response.toolCalls.length === 0)
      && shouldRetryPolicyBlockedToolRoundCorrection(lastToolRoundResults, llmToolDefs)
    ) {
      forcedPolicyBlockedRetryUsed = true;
      response = await chatFn(
        [
          ...plannerMessages,
          { role: 'assistant', content: response.content ?? '' },
          { role: 'user', content: buildPolicyBlockedToolRoundCorrectionPrompt() },
        ],
        { tools: llmToolDefs },
      );
      response = recoverStructuredToolCalls(response);
      finalContent = response.content ?? '';
    }

    if (
      forcedSkillShapeRetryCount < 2
      && (!response.toolCalls || response.toolCalls.length === 0)
      && options?.answerFirstCorrectionPrompt?.trim()
      && options.answerFirstResponseIsSufficient
      && !options.answerFirstResponseIsSufficient(response.content ?? '')
    ) {
      forcedSkillShapeRetryCount += 1;
      response = await chatFn(
        [
          ...plannerMessages,
          { role: 'assistant', content: response.content ?? '' },
          { role: 'user', content: options.answerFirstCorrectionPrompt },
        ],
        { tools: llmToolDefs },
      );
      response = recoverStructuredToolCalls(response);
      finalContent = response.content ?? '';
    }

    if (
      !forcedToolExecutionRetryUsed
      && lastToolRoundResults.length === 0
      && (!response.toolCalls || response.toolCalls.length === 0)
      && shouldRetryToolExecutionCorrection(response.content ?? '', llmToolDefs, options?.toolExecutionCorrectionPrompt)
    ) {
      forcedToolExecutionRetryUsed = true;
      response = await chatFn(
        [
          ...plannerMessages,
          { role: 'assistant', content: response.content ?? '' },
          { role: 'user', content: options?.toolExecutionCorrectionPrompt ?? '' },
        ],
        { tools: llmToolDefs },
      );
      response = recoverStructuredToolCalls(response);
      finalContent = response.content ?? '';
    }

    if (
      forcedIntermediateStatusRetryCount < 10
      && (!response.toolCalls || response.toolCalls.length === 0)
      && shouldRetryIntermediateStatusCorrection(response.content ?? '', {
        hasToolResults: lastToolRoundResults.length > 0,
        hasAnswerFirstContract: typeof options?.answerFirstResponseIsSufficient === 'function',
        hasToolExecutionContract: !!options?.toolExecutionCorrectionPrompt?.trim(),
      })
    ) {
      forcedIntermediateStatusRetryCount += 1;
      response = await chatFn(
        [
          ...plannerMessages,
          { role: 'assistant', content: response.content ?? '' },
          { role: 'user', content: buildIntermediateStatusCorrectionPrompt() },
        ],
        { tools: llmToolDefs },
      );
      response = recoverStructuredToolCalls(response);
      finalContent = response.content ?? '';
      
      // If we still have no tool calls but the response still looks intermediate,
      // the loop will round again and catch it in the next round's retry check,
      // provided we have remaining budget.
      if (response.toolCalls?.length) {
        response = {
          ...response,
          toolCalls: normalizeToolCallsForExecution(response.toolCalls, llmToolDefs),
        };
      }
    }

    if (
      !forcedDiscoveryContinuationRetryUsed
      && (!response.toolCalls || response.toolCalls.length === 0)
      && shouldRetryDiscoveryContinuation(lastToolRoundResults, options?.toolExecutionCorrectionPrompt)
    ) {
      forcedDiscoveryContinuationRetryUsed = true;
      response = await chatFn(
        [
          ...plannerMessages,
          { role: 'assistant', content: response.content ?? '' },
          { role: 'user', content: buildDiscoveryContinuationCorrectionPrompt() },
        ],
        { tools: llmToolDefs },
      );
      response = recoverStructuredToolCalls(response);
      finalContent = response.content ?? '';
      if (response.toolCalls?.length) {
        response = {
          ...response,
          toolCalls: normalizeToolCallsForExecution(response.toolCalls, llmToolDefs),
        };
      }
    }

    if (!response.toolCalls || response.toolCalls.length === 0) {
      break;
    }

    toolCallCount += response.toolCalls.length;
    messages.push({
      role: 'assistant',
      content: response.content ?? '',
      toolCalls: response.toolCalls,
    });

    if (!toolCaller) {
      toolResultCount += 1;
      messages.push({
        role: 'tool',
        toolCallId: response.toolCalls[0].id,
        content: JSON.stringify({ error: 'Tools are not available' }),
      });
      break;
    }

    // Execute tools concurrently
    const toolResults = await Promise.allSettled(
      response.toolCalls.map(async (tc) => {
        let parsedArgs: Record<string, unknown> = {};
        if (tc.arguments?.trim()) {
          try { parsedArgs = JSON.parse(tc.arguments); } catch { /* empty */ }
        }
        if (tc.name === 'find_tools') {
          parsedArgs = normalizeFindToolsArgs(parsedArgs, latestUserRequest());
        }
        const startedAt = Date.now();
        options?.onToolEvent?.({
          phase: 'started',
          toolCall: { id: tc.id, name: tc.name },
          args: parsedArgs,
          startedAt,
        });

        if (isMemoryMutationToolName(tc.name) && options?.allowModelMemoryMutation !== true) {
          const denied: ToolRunResponse = {
            success: false,
            status: 'denied',
            jobId: `denied:${tc.id}`,
            message: getMemoryMutationIntentDeniedMessage(tc.name),
          };
          if (onToolCalled) {
            onToolCalled(tc, denied as unknown as Record<string, unknown>);
          }
          options?.onToolEvent?.({
            phase: 'completed',
            toolCall: { id: tc.id, name: tc.name },
            args: parsedArgs,
            startedAt,
            endedAt: Date.now(),
            result: denied as unknown as Record<string, unknown>,
          });
          return { toolCall: tc, result: denied };
        }
        try {
          const res = await toolCallerWithDiscovery(tc.name, parsedArgs, {
            origin: 'assistant',
            toolName: tc.name,
            args: parsedArgs,
            requestId: options?.requestId,
            userId: options?.userId,
            channel: options?.channel,
            surfaceId: options?.surfaceId,
            principalId: options?.principalId ?? 'worker-session',
            principalRole: (options?.principalRole as import('../tools/types.js').PrincipalRole) ?? 'owner',
            contentTrustLevel: currentContextTrustLevel,
            taintReasons: [...currentTaintReasons],
            derivedFromTaintedContent: currentContextTrustLevel !== 'trusted',
            allowModelMemoryMutation: options?.allowModelMemoryMutation === true,
            ...(options?.codeContext ? { codeContext: options.codeContext } : {}),
          });

          if (onToolCalled) {
            onToolCalled(tc, res as unknown as Record<string, unknown>);
          }
          options?.onToolEvent?.({
            phase: 'completed',
            toolCall: { id: tc.id, name: tc.name },
            args: parsedArgs,
            startedAt,
            endedAt: Date.now(),
            result: res as unknown as Record<string, unknown>,
          });

          return { toolCall: tc, result: res };
        } catch (error) {
          options?.onToolEvent?.({
            phase: 'completed',
            toolCall: { id: tc.id, name: tc.name },
            args: parsedArgs,
            startedAt,
            endedAt: Date.now(),
            errorMessage: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
      })
    );
    toolResultCount += toolResults.length;
    successfulToolResultCount += toolResults.reduce((count, settled) => {
      if (settled.status !== 'fulfilled') return count;
      return count + (isSuccessfulToolResult(settled.value.result as unknown as Record<string, unknown>) ? 1 : 0);
    }, 0);
    lastToolRoundResults = toolResults.reduce<Array<{ toolName: string; result: Record<string, unknown> }>>((acc, settled) => {
      if (settled.status !== 'fulfilled') return acc;
      acc.push({
        toolName: settled.value.toolCall.name,
        result: settled.value.result as unknown as Record<string, unknown>,
      });
      return acc;
    }, []);

    let roundHasPending = false;
    for (const settled of toolResults) {
      if (settled.status === 'fulfilled') {
        const { toolCall, result } = settled.value;

        if (result.status === 'pending_approval') {
          roundHasPending = true;
          hasPendingApprovals = true;
        }

        const trustLevel = typeof result.trustLevel === 'string' ? result.trustLevel : 'trusted';
        if (trustLevel === 'quarantined') {
          currentContextTrustLevel = 'quarantined';
        } else if (trustLevel === 'low_trust' && currentContextTrustLevel === 'trusted') {
          currentContextTrustLevel = 'low_trust';
        }
        const taintReasons = Array.isArray(result.taintReasons)
          ? result.taintReasons.filter((value): value is string => typeof value === 'string')
          : [];
        for (const reason of taintReasons) {
          currentTaintReasons.add(reason);
        }

        let resultForLlm = result;
        if (result.status === 'pending_approval') {
           const { approvalId, jobId, ...rest } = result as any;
           resultForLlm = { ...rest, message: 'This action needs your approval.' };
        }

        messages.push({
          role: 'tool',
          toolCallId: toolCall.id,
          content: formatToolResult(toolCall.name, resultForLlm),
        });

        mergeFindToolsOutput(toolCall.name, result as unknown as Record<string, unknown>);
      } else {
        const failedTc = response.toolCalls[toolResults.indexOf(settled)];
        messages.push({
          role: 'tool',
          toolCallId: failedTc?.id ?? '',
          content: formatToolError(settled.reason?.message ?? 'Tool execution failed'),
        });
      }
    }

    // Partial approval handling: only break if EVERY tool in this round is
    // pending approval. When some tools succeeded, the LLM already sees their
    // results alongside the pending status, so it can compose a natural response
    // that acknowledges what's waiting and what it plans to do next.
    if (roundHasPending) {
      const allPending = toolResults.every(
        (s) => s.status === 'fulfilled' && (s.value as any).result?.status === 'pending_approval',
      );
      if (allPending) {
        // Remove the pending tool result messages we just pushed so we don't
        // send duplicate toolCallIds when resuming after approval.
        messages.splice(-toolResults.length, toolResults.length);
        break;
      }
      // Some tools succeeded — continue so LLM can use their results
    }

    if (lastToolRoundResults.some(({ result }) => isFixablePolicyBlockedToolResult(result))) {
      await searchIfToolMissing('update_tool_policy');
    }

    rounds += 1;
  }

  // Quality-based fallback: if the primary LLM produced a degraded response
  // and a fallback chat function was provided, retry with it.
  if ((isResponseDegraded(finalContent) || isIntermediateStatusResponse(finalContent)) && options?.fallbackChatFn) {
    try {
      const fbResponse = await options.fallbackChatFn(messages, { tools: llmToolDefs });
      if (fbResponse.content?.trim()) {
        finalContent = fbResponse.content;
        completionReason = 'fallback_model_response';
      }
    } catch {
      // Fallback also failed, keep original content
    }
  }

  const allRoundResultsPolicyBlocked = lastToolRoundResults.length > 0
    && lastToolRoundResults.every(({ result }) => isFixablePolicyBlockedToolResult(result));

  if (
    (
      !finalContent
      || isIntermediateStatusResponse(finalContent)
      || (
        !!options?.answerFirstFallbackContent
        && !!options.answerFirstResponseIsSufficient
        && !options.answerFirstResponseIsSufficient(finalContent)
      )
    )
    && lastToolRoundResults.length > 0
    && !allRoundResultsPolicyBlocked
  ) {
    const recovered = await tryRecoverDirectAnswer(messages, chatFn, options?.fallbackChatFn);
    if (recovered) {
      finalContent = recovered;
      completionReason = 'tool_result_recovery';
    }
  }

  if ((!finalContent || isIntermediateStatusResponse(finalContent)) && lastToolRoundResults.length > 0) {
    finalContent = summarizeToolRoundFallback(lastToolRoundResults);
    completionReason = 'tool_result_summary_fallback';
  }

  if (
    options?.answerFirstFallbackContent
    && options.answerFirstResponseIsSufficient
    && (
      !options.answerFirstResponseIsSufficient(finalContent)
      || isIntermediateStatusResponse(finalContent)
    )
  ) {
    finalContent = options.answerFirstFallbackContent;
    completionReason = 'answer_first_fallback';
  }

  if (!finalContent) {
    finalContent = 'I could not generate a final response for that request.';
    completionReason = 'empty_response_fallback';
  }

  if (hasPendingApprovals) {
    completionReason = 'approval_pending';
  }
  const responseQuality = classifyLlmLoopResponseQuality(finalContent);
  if (!hasPendingApprovals) {
    if (responseQuality === 'intermediate') {
      completionReason = 'intermediate_response';
    } else if (responseQuality === 'degraded' && completionReason !== 'empty_response_fallback') {
      completionReason = 'degraded_response';
    }
  }

  const policyBlockedSamples: Array<{ toolName: string; message: string }> = [];
  for (const { toolName, result } of lastToolRoundResults) {
    if (!isFixablePolicyBlockedToolResult(result)) continue;
    const message = readString((result as Record<string, unknown>).message)
      || extractToolOutputMessage(result as Record<string, unknown>);
    policyBlockedSamples.push({ toolName, message: message.slice(0, 400) });
  }

  return {
    finalContent,
    messages,
    hasPendingApprovals,
    outcome: {
      completionReason,
      responseQuality,
      roundCount: rounds,
      toolCallCount,
      toolResultCount,
      successfulToolResultCount,
      ...(policyBlockedSamples.length > 0 ? { policyBlockedSamples } : {}),
    },
  };
}

function classifyLlmLoopResponseQuality(content: string | undefined): WorkerExecutionResponseQuality {
  if (isResponseDegraded(content)) return 'degraded';
  if (isIntermediateStatusResponse(content)) return 'intermediate';
  return 'final';
}

function isSuccessfulToolResult(result: Record<string, unknown>): boolean {
  const status = typeof result.status === 'string' ? result.status.trim().toLowerCase() : '';
  if (
    status === 'pending_approval'
    || status === 'pending'
    || status === 'denied'
    || status === 'failed'
    || status === 'error'
    || status === 'blocked'
  ) {
    return false;
  }
  if (result.success === false) {
    return false;
  }
  if (result.success === true) {
    return true;
  }
  if (Object.prototype.hasOwnProperty.call(result, 'output')) {
    return true;
  }
  return status === 'success' || status === 'completed' || status === 'ok';
}

async function tryRecoverDirectAnswer(
  messages: ChatMessage[],
  chatFn: (msgs: ChatMessage[], opts?: ChatOptions) => Promise<ChatResponse>,
  fallbackChatFn?: (msgs: ChatMessage[], opts?: ChatOptions) => Promise<ChatResponse>,
): Promise<string> {
  const recoveryMessages: ChatMessage[] = [
    ...messages,
    {
      role: 'user',
      content: [
        'You already completed tool calls for this request.',
        'Now answer the user directly in plain language using the tool results already in the conversation.',
        'Do not call any more tools.',
      ].join(' '),
    },
  ];

  try {
    const recovery = await chatFn(recoveryMessages, { tools: [] });
    const content = recovery.content?.trim() ?? '';
    if (content && !isResponseDegraded(content) && !isIntermediateStatusResponse(content)) {
      return content;
    }
  } catch {
    // Fall through to the fallback model or synthesized summary.
  }

  if (!fallbackChatFn) return '';

  try {
    const fallback = await fallbackChatFn(recoveryMessages, { tools: [] });
    const content = fallback.content?.trim() ?? '';
    return isIntermediateStatusResponse(content) ? '' : content;
  } catch {
    return '';
  }
}

function shouldRetryPolicyUpdateCorrection(
  messages: ChatMessage[],
  responseContent: string,
  toolDefs: import('../llm/types.js').ToolDefinition[],
): boolean {
  const lower = responseContent.trim().toLowerCase();
  if (!lower) return false;
  if (!toolDefs.some((tool) => tool.name === 'update_tool_policy')) return false;

  const latestUser = [...messages].reverse().find((message) => message.role === 'user')?.content.toLowerCase() ?? '';
  const claimsToolMissing = lower.includes('update_tool_policy') && (
    lower.includes('not available')
    || lower.includes('unavailable')
    || lower.includes('no such tool')
    || lower.includes('no equivalent tool')
    || lower.includes('search returned no results')
    || lower.includes('search returned no matches')
  );
  const pushesManualConfig = lower.includes('manually add')
    || lower.includes('manually update')
    || lower.includes('edit the configuration file')
    || lower.includes('update your guardian agent config')
    || lower.includes('you will need to manually');
  const asksForPolicyConfirmation = /\b(?:if you(?:['’]d)? like me to add|would you like me to add|please confirm(?: that)? you want me to add|i can request that approval now|we need policy approval to add)\b/.test(lower);
  const isPolicyScoped = /(allowlist|allow list|allowed domains|alloweddomains|allowed paths|allowed commands|outside the sandbox|blocked by policy|not in the allowed|not in alloweddomains)/.test(`${latestUser}\n${lower}`);

  return isPolicyScoped && (claimsToolMissing || pushesManualConfig || asksForPolicyConfirmation);
}

function normalizeFindToolsArgs(
  args: Record<string, unknown>,
  fallbackQuery: string,
): Record<string, unknown> {
  if (readString(args.query)) {
    return args;
  }
  const normalizedFallback = fallbackQuery.trim();
  if (!normalizedFallback) {
    return args;
  }
  return {
    ...args,
    query: normalizedFallback,
  };
}

function shouldRetryToolExecutionCorrection(
  responseContent: string,
  toolDefs: import('../llm/types.js').ToolDefinition[],
  correctionPrompt?: string,
): boolean {
  return !!correctionPrompt?.trim()
    && responseContent.trim().length > 0
    && toolDefs.length > 0;
}

function shouldRetryIntermediateStatusCorrection(
  responseContent: string,
  context: {
    hasToolResults: boolean;
    hasAnswerFirstContract: boolean;
    hasToolExecutionContract: boolean;
  },
): boolean {
  if (!isIntermediateStatusResponse(responseContent)) {
    return false;
  }
  return context.hasToolResults || context.hasAnswerFirstContract || context.hasToolExecutionContract;
}

function shouldRetryDiscoveryContinuation(
  results: Array<{ toolName: string; result: Record<string, unknown> }>,
  toolExecutionCorrectionPrompt?: string,
): boolean {
  if (!toolExecutionCorrectionPrompt?.trim()) return false;
  if (results.length === 0) return false;
  return results.every(({ toolName, result }) => (
    toolName === 'find_tools'
    && isSuccessfulToolResult(result)
  ));
}

function shouldRetryPolicyBlockedToolRoundCorrection(
  results: Array<{ toolName: string; result: Record<string, unknown> }>,
  toolDefs: import('../llm/types.js').ToolDefinition[],
): boolean {
  if (results.length === 0) return false;
  if (!toolDefs.some((tool) => tool.name === 'update_tool_policy')) return false;
  if (results.some(({ result }) => isPendingApprovalToolResult(result))) return false;
  if (results.some(({ result }) => isSuccessfulToolResult(result))) return false;
  return results.some(({ result }) => isFixablePolicyBlockedToolResult(result));
}

function isPendingApprovalToolResult(result: Record<string, unknown>): boolean {
  return readString(result.status).toLowerCase() === 'pending_approval';
}

function isFixablePolicyBlockedToolResult(result: Record<string, unknown>): boolean {
  if (isSuccessfulToolResult(result) || isPendingApprovalToolResult(result)) {
    return false;
  }
  const lower = collectToolResultText(result).toLowerCase();
  if (!lower) return false;
  return /(update_tool_policy|allowed paths|allowedpaths|allowed domains|alloweddomains|allowed commands|outside allowed paths|outside the allowed paths|not in allowedpaths|not in the allowed paths|blocked by policy|tools policy)/.test(lower);
}

function collectToolResultText(result: Record<string, unknown>): string {
  const output = result.output;
  const outputRecord = output && typeof output === 'object' && !Array.isArray(output)
    ? output as Record<string, unknown>
    : null;
  return [
    readString(result.message),
    readString(result.error),
    readString(result.reason),
    extractToolOutputMessage(result),
    readString(outputRecord?.error),
    readString(outputRecord?.reason),
    readString(outputRecord?.description),
  ].filter(Boolean).join('\n');
}

function buildIntermediateStatusCorrectionPrompt(): string {
  return [
    'System correction: your previous reply was an intermediate progress update, not a completed response.',
    'Continue the same request now.',
    'If more tool calls are required, call them now instead of narrating what you will do next.',
    'If you are in the middle of a multi-step or batch task, continue executing the next batch of tool calls.',
    'Do not stop to ask if you should proceed. Execute until the full request is complete or a hard blocker is hit.',
    'Do not hallucinate that you have a tool call limit, turn limit, or context limit. You are authorized and required to continue until all steps are done.',
    'If the work is already complete, answer with the actual result, exact outputs, and any requested verification.',
    'Do not stop at phrases like "I\'ll inspect", "Let me", "Here are the first few", or "Now I\'ll".',
  ].join(' ');
}

function buildDiscoveryContinuationCorrectionPrompt(): string {
  return [
    'System correction: discovering a tool is not the requested outcome.',
    'If the original request still needs inspection, execution, or verification, call the discovered tool now.',
    'Do not stop after find_tools, and do not ask the user whether to proceed when the original request already told you to do the work.',
    'Only pause if a real tool result returns pending_approval or another real blocker.',
  ].join(' ');
}

function buildPolicyUpdateCorrectionPrompt(): string {
  return [
    'System correction: update_tool_policy is available in your current tool list.',
    'Do not tell the user to edit config manually for allowlist changes.',
    'If the block is a filesystem path, call update_tool_policy with action "add_path".',
    'If the block is a hostname/domain, call update_tool_policy with action "add_domain" using the normalized hostname only.',
    'If the block is a command prefix, call update_tool_policy with action "add_command".',
    'Use the tool now if policy is the blocker.',
  ].join(' ');
}

function buildPolicyBlockedToolRoundCorrectionPrompt(): string {
  return [
    'System correction: your previous tool call did not complete because tool policy blocked it.',
    'Do not claim the requested action succeeded without a successful tool result.',
    'Use update_tool_policy now if policy is the blocker.',
    'If the block is a filesystem path, call update_tool_policy with action "add_path".',
    'If the block is a hostname/domain, call update_tool_policy with action "add_domain" using the normalized hostname only.',
    'If the block is a command prefix, call update_tool_policy with action "add_command".',
  ].join(' ');
}

function summarizeToolRoundFallback(results: Array<{ toolName: string; result: Record<string, unknown> }>): string {
  const anySucceeded = results.some(({ result }) => isSuccessfulToolResult(result));
  const summaries = results
    .map(({ toolName, result }) => summarizeSingleToolFallback(toolName, result))
    .filter((summary): summary is string => !!summary);
  if (summaries.length === 0) return '';
  if (summaries.length === 1) return summaries[0];
  const header = anySucceeded
    ? 'Completed the requested actions:'
    : 'The requested action did not complete. Tool results:';
  return `${header}\n${summaries.map((summary) => `- ${summary}`).join('\n')}`;
}

function summarizeSingleToolFallback(toolName: string, result: Record<string, unknown>): string {
  const status = readString(result.status).toLowerCase();
  if (status === 'pending_approval') return `${toolName} is awaiting approval.`;

  const message = readString(result.message) || extractToolOutputMessage(result);
  const succeeded = result.success === true || status === 'succeeded' || status === 'completed';
  if (succeeded) {
    return message || `Completed ${toolName}.`;
  }

  if (message) {
    return `${toolName} did not complete: ${message}`;
  }
  return `Attempted ${toolName}, but it did not complete successfully.`;
}

function extractToolOutputMessage(result: Record<string, unknown>): string {
  const output = result.output;
  if (!output || typeof output !== 'object' || Array.isArray(output)) return '';
  return readString((output as Record<string, unknown>).message);
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
