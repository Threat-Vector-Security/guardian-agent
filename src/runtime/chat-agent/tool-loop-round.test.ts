import { describe, expect, it, vi } from 'vitest';

import { executeToolLoopRound } from './tool-loop-round.js';

describe('executeToolLoopRound', () => {
  it('records blocked approvals without exposing approval ids back to the model', async () => {
    const executeModelTool = vi.fn(async () => ({
      success: false,
      status: 'pending_approval',
      approvalId: 'approval-secret-1',
      jobId: 'job-1',
      message: 'Approval required.',
    }));
    const sanitizeToolResultForLlm = vi.fn((_toolName, result) => ({
      sanitized: result,
      threats: [],
      trustLevel: 'trusted' as const,
      taintReasons: [],
    }));
    const state = {
      llmMessages: [],
      allToolDefs: [],
      llmToolDefs: [],
      contentTrustLevel: 'trusted' as const,
      taintReasons: new Set<string>(),
    };

    const result = await executeToolLoopRound({
      response: {
        content: '',
        model: 'test-model',
        finishReason: 'tool_calls',
        toolCalls: [{ id: 'call-1', name: 'fs_write', arguments: '{"path":"out.txt"}' }],
      },
      state,
      toolExecOrigin: {
        origin: 'assistant',
        agentId: 'chat',
        userId: 'owner',
        channel: 'web',
        requestId: 'msg-1',
      },
      referenceTime: 1,
      tools: {
        executeModelTool,
        getToolDefinition: vi.fn(() => undefined),
      },
      secondBrainService: null,
      toolResultProviderKind: 'external',
      sanitizeToolResultForLlm,
    });

    expect(result.pendingIds).toEqual(['approval-secret-1']);
    expect(result.allBlocked).toBe(true);
    expect(sanitizeToolResultForLlm.mock.calls[0]?.[1]).toEqual({
      success: false,
      status: 'pending_approval',
      message: 'This action needs your approval. The approval UI is shown to the user automatically.',
    });
    expect(JSON.stringify(state.llmMessages)).not.toContain('approval-secret-1');
    expect(JSON.stringify(state.llmMessages)).not.toContain('job-1');
  });

  it('adds find_tools discoveries to the active tool definitions for the next round', async () => {
    const state = {
      llmMessages: [],
      allToolDefs: [],
      llmToolDefs: [],
      contentTrustLevel: 'trusted' as const,
      taintReasons: new Set<string>(),
    };

    await executeToolLoopRound({
      response: {
        content: '',
        model: 'test-model',
        finishReason: 'tool_calls',
        toolCalls: [{ id: 'call-1', name: 'find_tools', arguments: '{"query":"documents"}' }],
      },
      state,
      toolExecOrigin: {
        origin: 'assistant',
        agentId: 'chat',
        userId: 'owner',
        channel: 'web',
        requestId: 'msg-1',
      },
      referenceTime: 1,
      tools: {
        executeModelTool: vi.fn(async () => ({
          success: true,
          output: {
            tools: [{
              name: 'doc_search',
              description: 'Search documents.',
              risk: 'read_only',
              parameters: { type: 'object', properties: {} },
              category: 'search',
            }],
          },
        })),
        getToolDefinition: vi.fn(() => undefined),
      },
      secondBrainService: null,
      toolResultProviderKind: 'external',
      sanitizeToolResultForLlm: vi.fn((_toolName, result) => ({
        sanitized: result,
        threats: [],
        trustLevel: 'trusted' as const,
        taintReasons: [],
      })),
    });

    expect(state.allToolDefs).toEqual([expect.objectContaining({ name: 'doc_search' })]);
    expect(state.llmToolDefs).toEqual([expect.objectContaining({ name: 'doc_search' })]);
  });
});
