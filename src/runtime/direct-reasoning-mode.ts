/**
 * Direct Reasoning Mode for repo-inspection and coding-analysis tasks.
 *
 * This is a broker-friendly, read-only iterative tool loop. The runtime can
 * run it either inside the brokered worker or, when isolation is unavailable,
 * through injected supervisor callbacks. The module does not own tools,
 * providers, or channel rendering.
 */

import type { ChatMessage, ChatOptions, ChatResponse, ToolCall, ToolDefinition } from '../llm/types.js';
import type { AgentResponse } from '../agent/types.js';
import type { ToolExecutionRequest } from '../tools/types.js';
import type { IntentGatewayDecision, IntentGatewayRecord } from './intent/types.js';
import type { SelectedExecutionProfile } from './execution-profiles.js';
import type {
  PromptAssemblyAdditionalSection,
  PromptAssemblyKnowledgeBase,
} from './context-assembly.js';
import type { IntentRoutingTraceEntry, IntentRoutingTraceLog } from './intent-routing-trace.js';
import type { Logger } from 'pino';

import { deriveAnswerConstraints } from './intent/request-patterns.js';
import { isReadLikeOperation } from './orchestration-role-contracts.js';

export interface DirectReasoningTraceContext {
  requestId?: string;
  messageId?: string;
  userId?: string;
  channel?: string;
  agentId?: string;
  contentPreview?: string;
  executionId?: string;
  rootExecutionId?: string;
  taskExecutionId?: string;
  codeSessionId?: string;
}

export interface DirectReasoningInput {
  message: string;
  gateway: IntentGatewayRecord | null | undefined;
  selectedExecutionProfile: SelectedExecutionProfile | null | undefined;
  promptKnowledge?: {
    knowledgeBases?: PromptAssemblyKnowledgeBase[];
    globalContent?: string;
    codingMemoryContent?: string;
    additionalSections?: PromptAssemblyAdditionalSection[];
    toolContext?: string;
    runtimeNotices?: Array<{ level: 'info' | 'warn'; message: string }>;
  };
  workspaceRoot?: string;
  traceContext?: DirectReasoningTraceContext;
  toolRequest?: Partial<Omit<ToolExecutionRequest, 'toolName' | 'args' | 'origin'>> & {
    origin?: ToolExecutionRequest['origin'];
  };
  maxTurns?: number;
  maxTotalTimeMs?: number;
  perCallTimeoutMs?: number;
}

export interface DirectReasoningDependencies {
  chat: (messages: ChatMessage[], options?: ChatOptions) => Promise<ChatResponse>;
  executeTool: (
    toolName: string,
    args: Record<string, unknown>,
    request: Partial<Omit<ToolExecutionRequest, 'toolName' | 'args'>>,
  ) => Promise<Record<string, unknown>>;
  trace?: Pick<IntentRoutingTraceLog, 'record'> | null;
  logger?: Pick<Logger, 'debug' | 'info' | 'warn' | 'error'> | null;
  now?: () => number;
}

export interface DirectReasoningLoopResult {
  content: string;
  turns: number;
  toolCallCount: number;
  timedOut: boolean;
}

const DEFAULT_MAX_TURNS = 8;
const DEFAULT_MAX_TOTAL_TIME_MS = 150_000;
const DEFAULT_PER_CALL_TIMEOUT_MS = 60_000;

export function shouldHandleDirectReasoningMode(input: {
  gateway: IntentGatewayRecord | null | undefined;
  selectedExecutionProfile: SelectedExecutionProfile | null | undefined;
}): boolean {
  const decision = input.gateway?.decision;
  if (!decision) return false;

  const isRepoGrounded = decision.requiresRepoGrounding === true
    || decision.executionClass === 'repo_grounded';
  const isInspectLike = isReadLikeOperation(decision.operation);
  const isRepoInspectionRoute = decision.route === 'coding_task' && isInspectLike;

  if (!isInspectLike) return false;
  if (!isRepoGrounded && !isRepoInspectionRoute) return false;
  if (decision.operation === 'create' || decision.operation === 'update' || decision.operation === 'delete') return false;
  if (decision.executionClass === 'security_analysis') return false;
  if (decision.executionClass === 'tool_orchestration') return false;

  const tier = input.selectedExecutionProfile?.providerTier;
  return !!input.selectedExecutionProfile && tier !== 'local';
}

export function buildDirectReasoningToolSet(): ToolDefinition[] {
  return [
    {
      name: 'fs_search',
      description: 'Search files by name or content inside the current workspace. Use content mode for implementation symbols and name mode for likely filenames.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query.' },
          path: { type: 'string', description: 'Root directory to search. Defaults to the current workspace root.' },
          mode: { type: 'string', enum: ['name', 'content', 'auto'], description: 'Search mode.' },
          maxResults: { type: 'number', description: 'Maximum matches to return.' },
          maxDepth: { type: 'number', description: 'Maximum directory recursion depth.' },
          maxFiles: { type: 'number', description: 'Maximum files to scan.' },
          maxFileBytes: { type: 'number', description: 'Maximum bytes per file for content search.' },
          caseSensitive: { type: 'boolean', description: 'Enable case-sensitive matching.' },
        },
        required: ['query'],
      },
    },
    {
      name: 'fs_read',
      description: 'Read a specific file inside the current workspace. Use this before citing files or symbols.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to read.' },
          maxBytes: { type: 'number', description: 'Maximum bytes to read.' },
        },
        required: ['path'],
      },
    },
    {
      name: 'fs_list',
      description: 'List files in a directory inside the current workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path to list.' },
        },
        required: ['path'],
      },
    },
  ];
}

export function buildDirectReasoningSystemPrompt(input: {
  decision: IntentGatewayDecision;
  promptKnowledge?: DirectReasoningInput['promptKnowledge'];
  workspaceRoot?: string;
}): string {
  const { decision, promptKnowledge, workspaceRoot } = input;
  const constraints = deriveAnswerConstraints(decision.resolvedContent);
  const parts: string[] = [
    'You are a direct reasoning agent running inside GuardianAgent brokered execution.',
    'Inspect the repository with read-only tools, then answer the user from actual file evidence.',
    'Do not write, create, delete, rename, patch, run shell commands, or use tools outside the provided read-only tool set.',
    'Search broadly, read the likely implementation files, then narrow with more searches if the first evidence is only a surface hit.',
    'Always read files before citing them. Do not answer from search snippets alone.',
  ];

  if (constraints.requiresImplementationFiles) {
    parts.push('The answer must identify actual implementation files, not tests, generated files, or files that merely mention the term.');
  }
  if (constraints.requiresSymbolNames) {
    parts.push('The answer must include exact function, type, class, constant, or exported symbol names using backticks.');
  }
  if (constraints.readonly) {
    parts.push('The user explicitly requested read-only inspection. Do not modify files.');
  }
  if (workspaceRoot?.trim()) {
    parts.push(`Workspace root: ${workspaceRoot.trim()}`);
  }

  const toolContext = promptKnowledge?.toolContext?.trim();
  if (toolContext) {
    parts.push('', 'Available read context:', toolContext);
  }

  const runtimeNotices = promptKnowledge?.runtimeNotices ?? [];
  if (runtimeNotices.length > 0) {
    parts.push('', 'Runtime notices:');
    for (const notice of runtimeNotices) {
      parts.push(`- ${notice.level}: ${notice.message}`);
    }
  }

  const knowledgeParts = [
    promptKnowledge?.globalContent,
    promptKnowledge?.codingMemoryContent,
    ...(promptKnowledge?.knowledgeBases ?? []).map((kb) => kb.content),
    ...(promptKnowledge?.additionalSections ?? []).map((section) => section.content),
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  if (knowledgeParts.length > 0) {
    parts.push('', 'Relevant context:');
    for (const part of knowledgeParts) {
      parts.push(part);
    }
  }

  parts.push(
    '',
    'Process:',
    '1. Use fs_search/fs_list to locate candidate implementation files.',
    '2. Use fs_read on the most relevant files before making claims.',
    '3. If the evidence is weak or only mentions the phrase, search again with symbol/function terms.',
    '4. Finish with a concise grounded answer listing file paths and symbols where requested.',
  );

  return parts.join('\n');
}

export async function handleDirectReasoningMode(
  input: DirectReasoningInput,
  deps: DirectReasoningDependencies,
): Promise<AgentResponse> {
  const decision = input.gateway?.decision;
  if (!decision) {
    return buildDirectReasoningFailureResponse(input, 'Direct reasoning could not run because no routed intent decision was available.');
  }

  recordDirectReasoningTrace(deps, input, 'direct_reasoning_started', {
    route: decision.route,
    operation: decision.operation,
    executionClass: decision.executionClass,
    providerName: input.selectedExecutionProfile?.providerName,
    providerTier: input.selectedExecutionProfile?.providerTier,
  });

  const loopResult = await executeDirectReasoningLoop({
    messages: [
      {
        role: 'system',
        content: buildDirectReasoningSystemPrompt({
          decision,
          promptKnowledge: input.promptKnowledge,
          workspaceRoot: input.workspaceRoot,
        }),
      },
      { role: 'user', content: input.message },
    ],
    tools: buildDirectReasoningToolSet(),
    input,
    deps,
  });

  if (!loopResult?.content.trim()) {
    recordDirectReasoningTrace(deps, input, 'direct_reasoning_failed', {
      route: decision.route,
      operation: decision.operation,
      executionClass: decision.executionClass,
      reason: 'no_final_answer',
    });
    return buildDirectReasoningFailureResponse(
      input,
      'Direct reasoning did not produce a final grounded answer within its read-only execution budget.',
    );
  }

  const qualityNotes = runDirectReasoningQualityCheck({
    result: loopResult,
    decision,
  });
  const content = qualityNotes.length > 0
    ? `${loopResult.content}\n\n${qualityNotes.join(' ')}`
    : loopResult.content;

  recordDirectReasoningTrace(deps, input, 'direct_reasoning_completed', {
    route: decision.route,
    operation: decision.operation,
    executionClass: decision.executionClass,
    turns: loopResult.turns,
    toolCallCount: loopResult.toolCallCount,
    timedOut: loopResult.timedOut,
    qualityNotes,
    providerName: input.selectedExecutionProfile?.providerName,
    providerTier: input.selectedExecutionProfile?.providerTier,
  });

  return {
    content,
    metadata: {
      executionProfile: input.selectedExecutionProfile ?? undefined,
      directReasoning: true,
      directReasoningMode: 'brokered_readonly',
      directReasoningStats: {
        turns: loopResult.turns,
        toolCallCount: loopResult.toolCallCount,
        timedOut: loopResult.timedOut,
      },
      ...(qualityNotes.length > 0 ? { qualityNotes } : {}),
    },
  };
}

export async function executeDirectReasoningLoop(input: {
  messages: ChatMessage[];
  tools: ToolDefinition[];
  input: DirectReasoningInput;
  deps: DirectReasoningDependencies;
}): Promise<DirectReasoningLoopResult | null> {
  const now = input.deps.now ?? Date.now;
  const startedAt = now();
  const maxTurns = Math.max(1, input.input.maxTurns ?? DEFAULT_MAX_TURNS);
  const maxTotalTimeMs = Math.max(5_000, input.input.maxTotalTimeMs ?? DEFAULT_MAX_TOTAL_TIME_MS);
  const perCallTimeoutMs = Math.max(1_000, input.input.perCallTimeoutMs ?? DEFAULT_PER_CALL_TIMEOUT_MS);
  const messages = [...input.messages];
  let toolCallCount = 0;
  let finalContent = '';
  let timedOut = false;
  let turns = 0;

  while (turns < maxTurns) {
    const remainingMs = maxTotalTimeMs - (now() - startedAt);
    if (remainingMs <= 1_000) {
      timedOut = true;
      break;
    }

    turns += 1;
    const chatResponse = await chatWithBudget(input.deps, messages, {
      tools: input.tools,
    }, Math.min(perCallTimeoutMs, remainingMs));
    if (!chatResponse) {
      timedOut = true;
      break;
    }

    if (!chatResponse.toolCalls || chatResponse.toolCalls.length === 0) {
      finalContent = chatResponse.content ?? '';
      break;
    }

    messages.push({
      role: 'assistant',
      content: chatResponse.content ?? '',
      toolCalls: chatResponse.toolCalls,
    });

    for (const toolCall of chatResponse.toolCalls) {
      toolCallCount += 1;
      const result = await executeDirectReasoningToolCall({
        toolCall,
        input: input.input,
        deps: input.deps,
        turn: turns,
      });
      messages.push({
        role: 'tool',
        content: result,
        toolCallId: toolCall.id,
      });
    }
  }

  if (!finalContent.trim() && messages.length > 2) {
    const remainingMs = maxTotalTimeMs - (now() - startedAt);
    if (remainingMs > 1_000) {
      messages.push({
        role: 'user',
        content: 'Stop calling tools. Use the evidence already gathered and provide the final grounded answer now.',
      });
      const finalResponse = await chatWithBudget(input.deps, messages, undefined, Math.min(perCallTimeoutMs, remainingMs));
      if (finalResponse?.content?.trim()) {
        finalContent = finalResponse.content;
      } else {
        timedOut = true;
      }
    } else {
      timedOut = true;
    }
  }

  return finalContent.trim()
    ? { content: finalContent.trim(), turns, toolCallCount, timedOut }
    : null;
}

export async function executeDirectReasoningToolCall(input: {
  toolCall: ToolCall;
  input: DirectReasoningInput;
  deps: DirectReasoningDependencies;
  turn: number;
}): Promise<string> {
  const { toolCall } = input;
  const toolName = toolCall.name;
  const args = parseToolArgs(toolCall.arguments);
  if (!args) {
    return `Error: Invalid JSON arguments for tool ${toolName}`;
  }

  if (toolName !== 'fs_search' && toolName !== 'fs_read' && toolName !== 'fs_list') {
    return `Tool "${toolName}" is not available in direct reasoning mode. Available tools: fs_search, fs_read, fs_list.`;
  }

  recordDirectReasoningTrace(input.deps, input.input, 'direct_reasoning_tool_call', {
    tool: toolName,
    turn: input.turn,
    phase: 'started',
    args: redactDirectReasoningToolArgs(args),
  });

  try {
    const result = await input.deps.executeTool(toolName, args, {
      origin: input.input.toolRequest?.origin ?? 'assistant',
      requestId: input.input.toolRequest?.requestId ?? input.input.traceContext?.requestId,
      agentId: input.input.toolRequest?.agentId ?? input.input.traceContext?.agentId,
      userId: input.input.toolRequest?.userId ?? input.input.traceContext?.userId,
      principalId: input.input.toolRequest?.principalId,
      principalRole: input.input.toolRequest?.principalRole,
      channel: input.input.toolRequest?.channel ?? input.input.traceContext?.channel,
      surfaceId: input.input.toolRequest?.surfaceId,
      contentTrustLevel: input.input.toolRequest?.contentTrustLevel,
      taintReasons: input.input.toolRequest?.taintReasons,
      derivedFromTaintedContent: input.input.toolRequest?.derivedFromTaintedContent,
      codeContext: input.input.toolRequest?.codeContext,
      toolContextMode: input.input.toolRequest?.toolContextMode,
      agentContext: input.input.toolRequest?.agentContext,
      activeSkills: input.input.toolRequest?.activeSkills,
      allowModelMemoryMutation: input.input.toolRequest?.allowModelMemoryMutation,
      scheduleId: input.input.toolRequest?.scheduleId,
      dryRun: input.input.toolRequest?.dryRun,
    });

    recordDirectReasoningTrace(input.deps, input.input, 'direct_reasoning_tool_call', {
      tool: toolName,
      turn: input.turn,
      phase: 'completed',
      status: result.status,
      success: result.success,
      preview: formatToolResultPreview(result),
    });

    return formatDirectReasoningToolResult(toolName, args, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    recordDirectReasoningTrace(input.deps, input.input, 'direct_reasoning_tool_call', {
      tool: toolName,
      turn: input.turn,
      phase: 'failed',
      error: message,
    });
    return `Error executing ${toolName}: ${message}`;
  }
}

export function runDirectReasoningQualityCheck(input: {
  result: { content: string };
  decision: IntentGatewayDecision;
}): string[] {
  const constraints = deriveAnswerConstraints(input.decision.resolvedContent);
  const notes: string[] = [];
  const answer = input.result.content;

  if (constraints.requiresSymbolNames && !/`[^`]+`/.test(answer)) {
    notes.push('Quality note: the answer does not include backtick-quoted code symbols.');
  }
  if (constraints.requiresImplementationFiles) {
    const fileMatches = answer.match(/(?:[A-Za-z]:[\\/])?(?:src|lib|pkg|internal|web|native|docs)[\\/][\w./\\-]+\.(?:ts|tsx|js|mjs|rs|go|py|md)/g);
    if (!fileMatches || fileMatches.length === 0) {
      notes.push('Quality note: the answer does not cite implementation file paths.');
    }
  }

  return notes;
}

function buildDirectReasoningFailureResponse(
  input: DirectReasoningInput,
  content: string,
): AgentResponse {
  return {
    content,
    metadata: {
      executionProfile: input.selectedExecutionProfile ?? undefined,
      directReasoning: true,
      directReasoningMode: 'brokered_readonly',
      directReasoningFailed: true,
    },
  };
}

async function chatWithBudget(
  deps: DirectReasoningDependencies,
  messages: ChatMessage[],
  options: ChatOptions | undefined,
  timeoutMs: number,
): Promise<ChatResponse | null> {
  let timer: NodeJS.Timeout | undefined;
  const controller = new AbortController();
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, Math.max(1, timeoutMs));
  });
  try {
    const response = await Promise.race([
      deps.chat(messages, options ? { ...options, signal: controller.signal } : { signal: controller.signal }),
      timeout,
    ]);
    return response;
  } catch (error) {
    deps.logger?.warn?.(
      { error: error instanceof Error ? error.message : String(error) },
      'Direct reasoning chat call failed',
    );
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function parseToolArgs(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function formatDirectReasoningToolResult(
  toolName: string,
  args: Record<string, unknown>,
  result: Record<string, unknown>,
): string {
  if (result.success === false) {
    return `Error: ${stringifyCompact(result.error ?? result.message ?? result)}`;
  }

  const output = result.output && typeof result.output === 'object'
    ? result.output as Record<string, unknown>
    : result;

  if (output.quarantined === true) {
    return [
      'Tool result was quarantined by Guardian output policy.',
      `Trust level: ${stringifyCompact(output.trustLevel ?? 'unknown')}`,
      `Preview: ${stringifyCompact(output.preview ?? '')}`,
    ].join('\n');
  }

  if (toolName === 'fs_search' && Array.isArray(output.matches)) {
    const matches = output.matches as Array<Record<string, unknown>>;
    const lines = matches.map((match) => {
      const rel = stringValue(match.relativePath) || stringValue(match.path) || 'unknown';
      const type = stringValue(match.matchType);
      const snippet = stringValue(match.snippet);
      return snippet
        ? `- ${rel}${type ? ` (${type})` : ''}\n  ${snippet}`
        : `- ${rel}${type ? ` (${type})` : ''}`;
    });
    return [
      `Search results for "${stringValue(output.query) || stringValue(args.query)}" (${matches.length} matches${output.truncated ? ', truncated' : ''}):`,
      ...lines,
    ].join('\n');
  }

  if (toolName === 'fs_read' && typeof output.content === 'string') {
    return [
      `File: ${stringValue(output.path) || stringValue(args.path)}`,
      `Bytes: ${stringifyCompact(output.bytes ?? 'unknown')}`,
      output.truncated ? 'Truncated: true' : 'Truncated: false',
      '',
      output.content,
    ].join('\n');
  }

  if (toolName === 'fs_list' && Array.isArray(output.entries)) {
    const lines = output.entries.map((entry) => {
      if (typeof entry === 'string') return `- ${entry}`;
      if (entry && typeof entry === 'object') {
        const record = entry as Record<string, unknown>;
        const name = stringValue(record.name) || 'unknown';
        const type = stringValue(record.type);
        return `- ${type ? `[${type}] ` : ''}${name}`;
      }
      return `- ${String(entry)}`;
    });
    return [
      `Directory: ${stringValue(output.path) || stringValue(args.path)}`,
      ...lines,
    ].join('\n');
  }

  return JSON.stringify(output, null, 2);
}

function formatToolResultPreview(result: Record<string, unknown>): string | undefined {
  const formatted = formatDirectReasoningToolResult('preview', {}, result);
  return formatted.length > 400 ? `${formatted.slice(0, 399)}...` : formatted;
}

function redactDirectReasoningToolArgs(args: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    redacted[key] = typeof value === 'string' && value.length > 300
      ? `${value.slice(0, 299)}...`
      : value;
  }
  return redacted;
}

function recordDirectReasoningTrace(
  deps: DirectReasoningDependencies,
  input: DirectReasoningInput,
  stage: IntentRoutingTraceEntry['stage'],
  details: Record<string, unknown>,
): void {
  deps.trace?.record({
    stage,
    requestId: input.traceContext?.requestId,
    messageId: input.traceContext?.messageId,
    userId: input.traceContext?.userId,
    channel: input.traceContext?.channel,
    agentId: input.traceContext?.agentId,
    contentPreview: input.traceContext?.contentPreview ?? input.message,
    details: {
      ...(input.traceContext?.executionId ? { executionId: input.traceContext.executionId } : {}),
      ...(input.traceContext?.rootExecutionId ? { rootExecutionId: input.traceContext.rootExecutionId } : {}),
      ...(input.traceContext?.taskExecutionId ? { taskExecutionId: input.traceContext.taskExecutionId } : {}),
      ...(input.traceContext?.codeSessionId ? { codeSessionId: input.traceContext.codeSessionId } : {}),
      ...details,
    },
  });
}

function stringifyCompact(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
