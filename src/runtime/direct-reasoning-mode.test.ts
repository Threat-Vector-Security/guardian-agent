import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage, ChatOptions, ChatResponse } from '../llm/types.js';
import type { ToolExecutionRequest } from '../tools/types.js';
import type { IntentGatewayDecision, IntentGatewayRecord } from './intent/types.js';
import type { SelectedExecutionProfile } from './execution-profiles.js';
import {
  executeDirectReasoningToolCall,
  handleDirectReasoningMode,
  shouldHandleDirectReasoningMode,
} from './direct-reasoning-mode.js';

function decision(overrides: Partial<IntentGatewayDecision> = {}): IntentGatewayDecision {
  return {
    route: 'coding_task',
    confidence: 'high',
    operation: 'inspect',
    summary: 'Inspect repo implementation.',
    turnRelation: 'new_request',
    resolution: 'ready',
    missingFields: [],
    resolvedContent: 'Inspect this repo and cite exact file paths and symbol names.',
    executionClass: 'repo_grounded',
    preferredTier: 'external',
    requiresRepoGrounding: true,
    requiresToolSynthesis: true,
    expectedContextPressure: 'high',
    preferredAnswerPath: 'chat_synthesis',
    entities: {},
    ...overrides,
  };
}

function gateway(overrides: Partial<IntentGatewayDecision> = {}): IntentGatewayRecord {
  return {
    mode: 'primary',
    available: true,
    model: 'test-gateway',
    latencyMs: 1,
    decision: decision(overrides),
  };
}

function profile(overrides: Partial<SelectedExecutionProfile> = {}): SelectedExecutionProfile {
  return {
    id: 'managed_cloud_direct',
    providerName: 'ollama-cloud-coding',
    providerType: 'ollama_cloud',
    providerModel: 'glm-5.1',
    providerLocality: 'external',
    providerTier: 'managed_cloud',
    requestedTier: 'external',
    preferredAnswerPath: 'chat_synthesis',
    expectedContextPressure: 'high',
    contextBudget: 16_000,
    toolContextMode: 'tight',
    maxAdditionalSections: 3,
    maxRuntimeNotices: 3,
    fallbackProviderOrder: ['ollama-cloud-coding'],
    reason: 'test',
    ...overrides,
  };
}

function chatResponse(overrides: Partial<ChatResponse>): ChatResponse {
  return {
    content: '',
    model: 'test-model',
    finishReason: 'stop',
    ...overrides,
  };
}

describe('direct reasoning mode', () => {
  it('only selects brokered direct reasoning for non-local read-only repo-grounded requests', () => {
    expect(shouldHandleDirectReasoningMode({
      gateway: gateway(),
      selectedExecutionProfile: profile(),
    })).toBe(true);

    expect(shouldHandleDirectReasoningMode({
      gateway: gateway(),
      selectedExecutionProfile: profile({ providerTier: 'local', providerLocality: 'local', providerName: 'ollama', providerType: 'ollama' }),
    })).toBe(false);

    expect(shouldHandleDirectReasoningMode({
      gateway: gateway(),
      selectedExecutionProfile: null,
    })).toBe(false);

    expect(shouldHandleDirectReasoningMode({
      gateway: gateway({ operation: 'update' }),
      selectedExecutionProfile: profile(),
    })).toBe(false);

    expect(shouldHandleDirectReasoningMode({
      gateway: gateway({
        operation: 'run',
        preferredAnswerPath: 'tool_loop',
        requiresRepoGrounding: true,
        requiresToolSynthesis: true,
      }),
      selectedExecutionProfile: profile(),
    })).toBe(false);

    expect(shouldHandleDirectReasoningMode({
      gateway: gateway({ executionClass: 'security_analysis' }),
      selectedExecutionProfile: profile(),
    })).toBe(false);
  });

  it('runs an iterative read-only tool loop with trace and tool execution context', async () => {
    const messagesByCall: ChatMessage[][] = [];
    const chat = vi.fn(async (messages: ChatMessage[], _options?: ChatOptions): Promise<ChatResponse> => {
      messagesByCall.push(messages);
      if (messagesByCall.length === 1) {
        return chatResponse({
          finishReason: 'tool_calls',
          toolCalls: [
            {
              id: 'call-1',
              name: 'fs_search',
              arguments: JSON.stringify({ query: 'IntentGateway', mode: 'content' }),
            },
          ],
        });
      }
      return chatResponse({
        content: 'The route classifier is in `src/runtime/intent-gateway.ts` via `IntentGateway`.',
      });
    });
    const executeTool = vi.fn(async (
      toolName: string,
      args: Record<string, unknown>,
      request: Partial<Omit<ToolExecutionRequest, 'toolName' | 'args'>>,
    ) => ({
      success: true,
      status: 'succeeded',
      message: 'ok',
      output: {
        query: args.query,
        matches: [
          {
            relativePath: 'src/runtime/intent-gateway.ts',
            matchType: 'content',
            snippet: 'export class IntentGateway',
          },
        ],
      },
      request,
      toolName,
    }));
    const traceEntries: Array<Record<string, unknown>> = [];

    const result = await handleDirectReasoningMode({
      message: 'Which files define the IntentGateway route classifier?',
      gateway: gateway(),
      selectedExecutionProfile: profile(),
      workspaceRoot: 'S:/Development/GuardianAgent',
      traceContext: {
        requestId: 'req-1',
        messageId: 'msg-1',
        userId: 'user-1',
        channel: 'web',
        agentId: 'guardian',
        codeSessionId: 'code-1',
      },
      toolRequest: {
        origin: 'assistant',
        requestId: 'req-1',
        agentId: 'guardian',
        userId: 'user-1',
        surfaceId: 'surface-1',
        principalId: 'principal-1',
        principalRole: 'owner',
        channel: 'web',
        codeContext: { workspaceRoot: 'S:/Development/GuardianAgent', sessionId: 'code-1' },
        toolContextMode: 'tight',
        activeSkills: ['skill-1'],
      },
    }, {
      chat,
      executeTool,
      trace: {
        record: (entry) => traceEntries.push(entry as unknown as Record<string, unknown>),
      },
    });

    expect(result.content).toContain('src/runtime/intent-gateway.ts');
    expect(result.metadata?.directReasoningMode).toBe('brokered_readonly');
    expect(executeTool).toHaveBeenCalledTimes(1);
    expect(executeTool.mock.calls[0]?.[0]).toBe('fs_search');
    expect(executeTool.mock.calls[0]?.[2]).toMatchObject({
      requestId: 'req-1',
      userId: 'user-1',
      surfaceId: 'surface-1',
      principalId: 'principal-1',
      channel: 'web',
      codeContext: { workspaceRoot: 'S:/Development/GuardianAgent', sessionId: 'code-1' },
      toolContextMode: 'tight',
      activeSkills: ['skill-1'],
    });
    expect(messagesByCall[1]?.some((message) => (
      message.role === 'tool'
      && message.content.includes('Search results for "IntentGateway"')
    ))).toBe(true);
    expect(traceEntries.map((entry) => entry.stage)).toEqual([
      'direct_reasoning_started',
      'direct_reasoning_tool_call',
      'direct_reasoning_tool_call',
      'direct_reasoning_completed',
    ]);
    expect(traceEntries[0]).toMatchObject({
      requestId: 'req-1',
      messageId: 'msg-1',
      userId: 'user-1',
      channel: 'web',
      agentId: 'guardian',
    });
  });

  it('refuses tools outside the read-only direct reasoning allowlist', async () => {
    const executeTool = vi.fn();
    const result = await executeDirectReasoningToolCall({
      toolCall: {
        id: 'call-1',
        name: 'fs_write',
        arguments: JSON.stringify({ path: 'tmp/test.txt', content: 'nope' }),
      },
      input: {
        message: 'write a file',
        gateway: gateway(),
        selectedExecutionProfile: profile(),
      },
      deps: {
        chat: vi.fn(),
        executeTool,
      },
      turn: 1,
    });

    expect(result).toContain('not available in direct reasoning mode');
    expect(executeTool).not.toHaveBeenCalled();
  });
});
