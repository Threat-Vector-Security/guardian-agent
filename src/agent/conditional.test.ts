/**
 * Tests for ConditionalAgent — conditional branching orchestration.
 */

import { describe, it, expect, vi } from 'vitest';
import { ConditionalAgent } from './conditional.js';
import type { AgentContext, AgentResponse, UserMessage } from './types.js';
import type { SharedStateView } from '../runtime/shared-state.js';

// ─── Test Helpers ─────────────────────────────────────────────

function makeMessage(content: string): UserMessage {
  return {
    id: 'msg-1',
    userId: 'user-1',
    channel: 'test',
    content,
    timestamp: Date.now(),
  };
}

function makeContext(overrides?: Partial<AgentContext>): AgentContext {
  return {
    agentId: 'orchestrator',
    capabilities: Object.freeze([]),
    emit: vi.fn().mockResolvedValue(undefined),
    checkAction: vi.fn(),
    ...overrides,
  };
}

// ─── ConditionalAgent Tests ───────────────────────────────────

describe('ConditionalAgent', () => {
  it('dispatches to the first matching branch', async () => {
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockImplementation(async (agentId) => ({ content: `${agentId}-result` }));

    const agent = new ConditionalAgent('cond-1', 'Conditional', {
      branches: [
        {
          name: 'billing',
          condition: (_s, msg) => msg.content.includes('bill'),
          steps: [{ agentId: 'billing-agent' }],
        },
        {
          name: 'technical',
          condition: (_s, msg) => msg.content.includes('tech'),
          steps: [{ agentId: 'tech-agent' }],
        },
      ],
    });

    const ctx = makeContext({ dispatch });
    const result = await agent.onMessage(makeMessage('billing question'), ctx);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toBe('billing-agent');
    expect(result.content).toBe('billing-agent-result');
    expect(result.metadata?.orchestration).toBe('conditional');
    expect(result.metadata?.branchSelected).toBe('billing');
  });

  it('first matching branch wins, later branches not evaluated', async () => {
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockResolvedValueOnce({ content: 'first-branch' });

    const conditionA = vi.fn((_s: SharedStateView, msg: UserMessage) => msg.content.includes('match'));
    const conditionB = vi.fn((_s: SharedStateView, msg: UserMessage) => msg.content.includes('match'));

    const agent = new ConditionalAgent('cond-2', 'Conditional', {
      branches: [
        { name: 'branch-a', condition: conditionA, steps: [{ agentId: 'agent-a' }] },
        { name: 'branch-b', condition: conditionB, steps: [{ agentId: 'agent-b' }] },
      ],
    });

    const ctx = makeContext({ dispatch });
    await agent.onMessage(makeMessage('match this'), ctx);

    expect(conditionA).toHaveBeenCalled();
    expect(conditionB).not.toHaveBeenCalled();
    expect(dispatch.mock.calls[0][0]).toBe('agent-a');
  });

  it('executes default steps when no branch matches', async () => {
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockResolvedValueOnce({ content: 'default-result' });

    const agent = new ConditionalAgent('cond-3', 'Conditional', {
      branches: [
        { name: 'specific', condition: () => false, steps: [{ agentId: 'specific-agent' }] },
      ],
      defaultSteps: [{ agentId: 'default-agent' }],
    });

    const ctx = makeContext({ dispatch });
    const result = await agent.onMessage(makeMessage('anything'), ctx);

    expect(dispatch.mock.calls[0][0]).toBe('default-agent');
    expect(result.content).toBe('default-result');
    expect(result.metadata?.branchSelected).toBe('default');
  });

  it('returns error when no branch matches and no default', async () => {
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>();

    const agent = new ConditionalAgent('cond-4', 'Conditional', {
      branches: [
        { name: 'nope', condition: () => false, steps: [{ agentId: 'agent' }] },
      ],
    });

    const ctx = makeContext({ dispatch });
    const result = await agent.onMessage(makeMessage('anything'), ctx);

    expect(dispatch).not.toHaveBeenCalled();
    expect(result.content).toContain('no branch matched');
    expect(result.metadata?.branchSelected).toBeNull();
  });

  it('runs multi-step branch sequentially', async () => {
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockResolvedValueOnce({ content: 'step-1-out' })
      .mockResolvedValueOnce({ content: 'step-2-out' });

    const agent = new ConditionalAgent('cond-5', 'Conditional', {
      branches: [
        {
          name: 'multi',
          condition: () => true,
          steps: [
            { agentId: 'step-1', outputKey: 's1' },
            { agentId: 'step-2', inputKey: 's1' },
          ],
        },
      ],
    });

    const ctx = makeContext({ dispatch });
    const result = await agent.onMessage(makeMessage('go'), ctx);

    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch.mock.calls[0][0]).toBe('step-1');
    expect(dispatch.mock.calls[1][0]).toBe('step-2');
    expect(dispatch.mock.calls[1][1].content).toBe('step-1-out');
    expect(result.content).toBe('step-2-out');
    expect(result.metadata?.completedSteps).toBe(2);
  });

  it('branch condition reads inherited SharedState', async () => {
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockResolvedValueOnce({ content: 'approved-result' });

    const parentState = {
      get: vi.fn((key: string) => key === 'status' ? 'approved' : undefined),
      getMetadata: vi.fn(),
      has: vi.fn((key: string) => key === 'status'),
      keys: vi.fn(() => ['status']),
      snapshot: vi.fn(() => ({ status: 'approved' })),
    };

    const agent = new ConditionalAgent('cond-6', 'Conditional', {
      branches: [
        {
          name: 'approved',
          condition: (s) => s.get('status') === 'approved',
          steps: [{ agentId: 'approve-handler' }],
        },
        {
          name: 'rejected',
          condition: (s) => s.get('status') === 'rejected',
          steps: [{ agentId: 'reject-handler' }],
        },
      ],
      inheritStateKeys: ['status'],
    });

    const ctx = makeContext({ dispatch, sharedState: parentState });
    const result = await agent.onMessage(makeMessage('check'), ctx);

    expect(dispatch.mock.calls[0][0]).toBe('approve-handler');
    expect(result.metadata?.branchSelected).toBe('approved');
  });

  it('branch step with retry and onError works', async () => {
    vi.useFakeTimers();
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockImplementation(async (agentId) => {
        if (agentId === 'flaky') throw new Error('flaky');
        if (agentId === 'fallback') return { content: 'recovered' };
        return { content: `${agentId}-ok` };
      });

    const agent = new ConditionalAgent('cond-7', 'Conditional', {
      branches: [
        {
          name: 'main',
          condition: () => true,
          steps: [
            {
              agentId: 'flaky',
              retry: { maxRetries: 1, initialDelayMs: 50 },
              onError: { agentId: 'fallback' },
            },
          ],
        },
      ],
    });

    const ctx = makeContext({ dispatch });
    const promise = agent.onMessage(makeMessage('go'), ctx);
    await vi.advanceTimersByTimeAsync(200);
    const result = await promise;

    expect(result.content).toBe('recovered');
    expect(result.metadata?.retriedSteps).toEqual([
      { agentId: 'flaky', attempts: 2, usedFailBranch: true },
    ]);
    vi.useRealTimers();
  });

  it('returns error when dispatch is not available', async () => {
    const agent = new ConditionalAgent('cond-8', 'Conditional', {
      branches: [{ name: 'x', condition: () => true, steps: [{ agentId: 'a' }] }],
    });

    const ctx = makeContext({ dispatch: undefined });
    const result = await agent.onMessage(makeMessage('test'), ctx);

    expect(result.content).toContain('requires dispatch capability');
  });

  it('metadata includes branchSelected and state snapshot', async () => {
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockResolvedValueOnce({ content: 'output' });

    const agent = new ConditionalAgent('cond-9', 'Conditional', {
      branches: [
        {
          name: 'my-branch',
          condition: () => true,
          steps: [{ agentId: 'agent-a', outputKey: 'result' }],
        },
      ],
    });

    const ctx = makeContext({ dispatch });
    const result = await agent.onMessage(makeMessage('hello'), ctx);

    expect(result.metadata?.branchSelected).toBe('my-branch');
    expect(result.metadata?.state).toBeDefined();
    const state = result.metadata?.state as Record<string, unknown>;
    expect(state.result).toBe('output');
    expect(state.input).toBe('hello');
  });

  it('handles error in branch steps with stopOnError', async () => {
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockRejectedValueOnce(new Error('branch step failed'));

    const agent = new ConditionalAgent('cond-10', 'Conditional', {
      branches: [
        {
          name: 'failing',
          condition: () => true,
          steps: [{ agentId: 'bad-agent' }, { agentId: 'unreachable' }],
        },
      ],
      stopOnError: true,
    });

    const ctx = makeContext({ dispatch });
    const result = await agent.onMessage(makeMessage('test'), ctx);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(result.content).toContain("stopped at 'bad-agent'");
    expect(result.metadata?.stoppedAt).toBe('bad-agent');
  });
});
