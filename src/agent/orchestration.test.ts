/**
 * Tests for orchestration agents: Sequential, Parallel, Loop.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  SequentialAgent,
  ParallelAgent,
  LoopAgent,
  executeWithRetry,
  runWithConcurrencyLimit,
} from './orchestration.js';
import type { AgentContext, AgentResponse, UserMessage } from './types.js';

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

// ─── SequentialAgent ──────────────────────────────────────────

describe('SequentialAgent', () => {
  it('runs steps in order and returns last result', async () => {
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockResolvedValueOnce({ content: 'step-1-result' })
      .mockResolvedValueOnce({ content: 'step-2-result' });

    const agent = new SequentialAgent('seq-1', 'Sequential', {
      steps: [
        { agentId: 'agent-a', outputKey: 'a_output' },
        { agentId: 'agent-b', inputKey: 'a_output', outputKey: 'b_output' },
      ],
    });

    const ctx = makeContext({ dispatch });
    const result = await agent.onMessage(makeMessage('hello'), ctx);

    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch.mock.calls[0][0]).toBe('agent-a');
    expect(dispatch.mock.calls[1][0]).toBe('agent-b');
    // Second step should receive first step's output as input
    expect(dispatch.mock.calls[1][1].content).toBe('step-1-result');
    expect(result.content).toBe('step-2-result');
    expect(result.metadata?.orchestration).toBe('sequential');
    expect(result.metadata?.completedSteps).toBe(2);
  });

  it('passes handoff contracts into downstream dispatch', async () => {
    const dispatch = vi.fn<[string, UserMessage, unknown?], Promise<AgentResponse>>()
      .mockResolvedValueOnce({ content: 'researched' });

    const agent = new SequentialAgent('seq-handoff', 'Sequential', {
      steps: [
        {
          agentId: 'research-agent',
          handoff: {
            allowedCapabilities: ['web.read'],
            contextMode: 'summary_only',
            preserveTaint: true,
            requireApproval: false,
          },
        },
      ],
    });

    const ctx = makeContext({ dispatch });
    await agent.onMessage(makeMessage('research this account'), ctx);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][2]).toMatchObject({
      handoff: {
        sourceAgentId: 'seq-handoff',
        targetAgentId: 'research-agent',
        allowedCapabilities: ['web.read'],
        contextMode: 'summary_only',
      },
    });
  });

  it('stops on error when stopOnError is true', async () => {
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockResolvedValueOnce({ content: 'ok' })
      .mockRejectedValueOnce(new Error('agent-b failed'))
      .mockResolvedValueOnce({ content: 'should not run' });

    const agent = new SequentialAgent('seq-2', 'Sequential', {
      steps: [
        { agentId: 'agent-a' },
        { agentId: 'agent-b' },
        { agentId: 'agent-c' },
      ],
      stopOnError: true,
    });

    const ctx = makeContext({ dispatch });
    const result = await agent.onMessage(makeMessage('hello'), ctx);

    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(result.content).toContain('Pipeline stopped');
    expect(result.content).toContain('agent-b');
    expect(result.metadata?.completedSteps).toBe(1);
  });

  it('continues on error when stopOnError is false', async () => {
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockRejectedValueOnce(new Error('agent-a failed'))
      .mockResolvedValueOnce({ content: 'agent-b ok' });

    const agent = new SequentialAgent('seq-3', 'Sequential', {
      steps: [
        { agentId: 'agent-a' },
        { agentId: 'agent-b' },
      ],
      stopOnError: false,
    });

    const ctx = makeContext({ dispatch });
    const result = await agent.onMessage(makeMessage('hello'), ctx);

    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(result.content).toBe('agent-b ok');
    expect(result.metadata?.completedSteps).toBe(1);
  });

  it('returns error when dispatch is not available', async () => {
    const agent = new SequentialAgent('seq-4', 'Sequential', {
      steps: [{ agentId: 'agent-a' }],
    });

    const ctx = makeContext({ dispatch: undefined });
    const result = await agent.onMessage(makeMessage('hello'), ctx);

    expect(result.content).toContain('requires dispatch capability');
  });

  // ─── Retry Tests ──────────────────────────────────────────

  it('retries a step and succeeds on second attempt', async () => {
    vi.useFakeTimers();
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce({ content: 'recovered' });

    const agent = new SequentialAgent('seq-retry-1', 'Sequential', {
      steps: [
        {
          agentId: 'flaky-agent',
          retry: { maxRetries: 2, initialDelayMs: 100 },
        },
      ],
    });

    const ctx = makeContext({ dispatch });
    const promise = agent.onMessage(makeMessage('test'), ctx);

    // Advance past retry delay
    await vi.advanceTimersByTimeAsync(200);
    const result = await promise;

    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(result.content).toBe('recovered');
    expect(result.metadata?.retriedSteps).toEqual([
      { agentId: 'flaky-agent', attempts: 2, usedFailBranch: false },
    ]);
    vi.useRealTimers();
  });

  it('step with retry succeeds on first try — dispatched once', async () => {
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockResolvedValueOnce({ content: 'instant success' });

    const agent = new SequentialAgent('seq-retry-noop', 'Sequential', {
      steps: [
        {
          agentId: 'reliable-agent',
          retry: { maxRetries: 3 },
        },
      ],
    });

    const ctx = makeContext({ dispatch });
    const result = await agent.onMessage(makeMessage('test'), ctx);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(result.content).toBe('instant success');
    // No retriedSteps since it succeeded on first try
    expect(result.metadata?.retriedSteps).toBeUndefined();
  });

  it('step fails all retries — error propagates with stopOnError', async () => {
    vi.useFakeTimers();
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockRejectedValue(new Error('permanent failure'));

    const agent = new SequentialAgent('seq-retry-fail', 'Sequential', {
      steps: [
        {
          agentId: 'broken-agent',
          retry: { maxRetries: 2, initialDelayMs: 50 },
        },
      ],
      stopOnError: true,
    });

    const ctx = makeContext({ dispatch });
    const promise = agent.onMessage(makeMessage('test'), ctx);
    await vi.advanceTimersByTimeAsync(500);
    const result = await promise;

    expect(dispatch).toHaveBeenCalledTimes(3); // initial + 2 retries
    expect(result.content).toContain('Pipeline stopped');
    expect(result.content).toContain('permanent failure');
    expect(result.metadata?.retriedSteps).toEqual([
      { agentId: 'broken-agent', attempts: 3, usedFailBranch: false },
    ]);
    vi.useRealTimers();
  });

  it('retryableError filter prevents retries for non-retryable errors', async () => {
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockRejectedValueOnce(new Error('fatal: cannot recover'));

    const agent = new SequentialAgent('seq-retry-filter', 'Sequential', {
      steps: [
        {
          agentId: 'agent-x',
          retry: {
            maxRetries: 3,
            retryableError: (err) => !err.message.includes('fatal'),
          },
        },
      ],
      stopOnError: true,
    });

    const ctx = makeContext({ dispatch });
    const result = await agent.onMessage(makeMessage('test'), ctx);

    // Should not retry since error is not retryable
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(result.content).toContain('Pipeline stopped');
  });

  // ─── Fail-Branch Tests ────────────────────────────────────

  it('invokes fail-branch when step fails and onError is defined', async () => {
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockImplementation(async (agentId) => {
        if (agentId === 'primary') throw new Error('primary failed');
        if (agentId === 'fallback') return { content: 'fallback result' };
        return { content: `${agentId}-ok` };
      });

    const agent = new SequentialAgent('seq-failbranch', 'Sequential', {
      steps: [
        {
          agentId: 'primary',
          onError: { agentId: 'fallback' },
        },
        { agentId: 'next-step' },
      ],
      stopOnError: true,
    });

    const ctx = makeContext({ dispatch });
    const result = await agent.onMessage(makeMessage('test'), ctx);

    // Pipeline should continue after fail-branch
    expect(dispatch).toHaveBeenCalledTimes(3); // primary (fail) + fallback + next-step
    expect(result.content).toBe('next-step-ok');
    expect(result.metadata?.retriedSteps).toEqual([
      { agentId: 'primary', attempts: 1, usedFailBranch: true },
    ]);
  });

  it('fail-branch also fails — falls to stopOnError', async () => {
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockImplementation(async (agentId) => {
        if (agentId === 'primary') throw new Error('primary failed');
        if (agentId === 'fallback') throw new Error('fallback also failed');
        return { content: 'should not reach' };
      });

    const agent = new SequentialAgent('seq-failbranch-fail', 'Sequential', {
      steps: [
        {
          agentId: 'primary',
          onError: { agentId: 'fallback' },
        },
        { agentId: 'next-step' },
      ],
      stopOnError: true,
    });

    const ctx = makeContext({ dispatch });
    const result = await agent.onMessage(makeMessage('test'), ctx);

    expect(dispatch).toHaveBeenCalledTimes(2); // primary + fallback
    expect(result.content).toContain('Pipeline stopped');
    expect(result.content).toContain('primary failed');
  });

  it('retry + fail-branch: retries first, then fail-branch', async () => {
    vi.useFakeTimers();
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockRejectedValueOnce(new Error('attempt 1'))
      .mockRejectedValueOnce(new Error('attempt 2'))
      .mockResolvedValueOnce({ content: 'fallback saved us' });

    const agent = new SequentialAgent('seq-retry-fb', 'Sequential', {
      steps: [
        {
          agentId: 'flaky',
          retry: { maxRetries: 1, initialDelayMs: 50 },
          onError: { agentId: 'fallback' },
        },
      ],
    });

    const ctx = makeContext({ dispatch });
    const promise = agent.onMessage(makeMessage('test'), ctx);
    await vi.advanceTimersByTimeAsync(200);
    const result = await promise;

    expect(dispatch).toHaveBeenCalledTimes(3); // 2 attempts + fallback
    expect(result.content).toBe('fallback saved us');
    expect(result.metadata?.retriedSteps).toEqual([
      { agentId: 'flaky', attempts: 2, usedFailBranch: true },
    ]);
    vi.useRealTimers();
  });

  it('backward compat: existing stopOnError still works without retry/onError', async () => {
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockRejectedValueOnce(new Error('old-style failure'));

    const agent = new SequentialAgent('seq-compat', 'Sequential', {
      steps: [{ agentId: 'agent-a' }],
      stopOnError: true,
    });

    const ctx = makeContext({ dispatch });
    const result = await agent.onMessage(makeMessage('test'), ctx);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(result.content).toContain('Pipeline stopped');
    expect(result.metadata?.retriedSteps).toBeUndefined();
  });
});

// ─── ParallelAgent ────────────────────────────────────────────

describe('ParallelAgent', () => {
  it('runs all steps concurrently and combines results', async () => {
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockImplementation(async (agentId) => {
        return { content: `${agentId}-result` };
      });

    const agent = new ParallelAgent('par-1', 'Parallel', {
      steps: [
        { agentId: 'agent-a' },
        { agentId: 'agent-b' },
        { agentId: 'agent-c' },
      ],
    });

    const ctx = makeContext({ dispatch });
    const result = await agent.onMessage(makeMessage('hello'), ctx);

    expect(dispatch).toHaveBeenCalledTimes(3);
    expect(result.content).toContain('agent-a-result');
    expect(result.content).toContain('agent-b-result');
    expect(result.content).toContain('agent-c-result');
    expect(result.metadata?.orchestration).toBe('parallel');
    expect(result.metadata?.succeeded).toBe(3);
    expect(result.metadata?.failed).toBe(0);
  });

  it('handles mixed success and failure', async () => {
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockImplementation(async (agentId) => {
        if (agentId === 'agent-b') throw new Error('agent-b exploded');
        return { content: `${agentId}-ok` };
      });

    const agent = new ParallelAgent('par-2', 'Parallel', {
      steps: [
        { agentId: 'agent-a' },
        { agentId: 'agent-b' },
        { agentId: 'agent-c' },
      ],
    });

    const ctx = makeContext({ dispatch });
    const result = await agent.onMessage(makeMessage('hello'), ctx);

    expect(dispatch).toHaveBeenCalledTimes(3);
    expect(result.content).toContain('agent-a-ok');
    expect(result.content).toContain('Error');
    expect(result.content).toContain('agent-c-ok');
    expect(result.metadata?.succeeded).toBe(2);
    expect(result.metadata?.failed).toBe(1);
  });

  it('respects maxConcurrency limit', async () => {
    let concurrentCalls = 0;
    let maxConcurrent = 0;

    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockImplementation(async (agentId) => {
        concurrentCalls++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCalls);
        await new Promise(r => setTimeout(r, 10));
        concurrentCalls--;
        return { content: `${agentId}-done` };
      });

    const agent = new ParallelAgent('par-3', 'Parallel', {
      steps: [
        { agentId: 'a1' },
        { agentId: 'a2' },
        { agentId: 'a3' },
        { agentId: 'a4' },
      ],
      maxConcurrency: 2,
    });

    const ctx = makeContext({ dispatch });
    await agent.onMessage(makeMessage('hello'), ctx);

    expect(dispatch).toHaveBeenCalledTimes(4);
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it('returns error when dispatch is not available', async () => {
    const agent = new ParallelAgent('par-4', 'Parallel', {
      steps: [{ agentId: 'agent-a' }],
    });

    const ctx = makeContext({ dispatch: undefined });
    const result = await agent.onMessage(makeMessage('hello'), ctx);

    expect(result.content).toContain('requires dispatch capability');
  });

  it('retries a failing step and uses fail-branch in parallel', async () => {
    vi.useFakeTimers();
    let callCount = 0;
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockImplementation(async (agentId) => {
        if (agentId === 'flaky') {
          callCount++;
          if (callCount <= 2) throw new Error('flaky error');
          return { content: 'flaky-recovered' };
        }
        if (agentId === 'stable') return { content: 'stable-ok' };
        return { content: `${agentId}-ok` };
      });

    const agent = new ParallelAgent('par-retry', 'Parallel', {
      steps: [
        { agentId: 'stable' },
        { agentId: 'flaky', retry: { maxRetries: 2, initialDelayMs: 50 } },
      ],
    });

    const ctx = makeContext({ dispatch });
    const promise = agent.onMessage(makeMessage('test'), ctx);
    await vi.advanceTimersByTimeAsync(500);
    const result = await promise;

    expect(result.content).toContain('stable-ok');
    expect(result.content).toContain('flaky-recovered');
    expect(result.metadata?.succeeded).toBe(2);
    expect(result.metadata?.retriedSteps).toEqual([
      { agentId: 'flaky', attempts: 3, usedFailBranch: false },
    ]);
    vi.useRealTimers();
  });

  it('parallel step uses fail-branch when retries exhausted', async () => {
    vi.useFakeTimers();
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockImplementation(async (agentId) => {
        if (agentId === 'broken') throw new Error('always fails');
        if (agentId === 'rescue') return { content: 'rescued' };
        return { content: `${agentId}-ok` };
      });

    const agent = new ParallelAgent('par-failbranch', 'Parallel', {
      steps: [
        { agentId: 'good' },
        {
          agentId: 'broken',
          retry: { maxRetries: 1, initialDelayMs: 50 },
          onError: { agentId: 'rescue' },
        },
      ],
    });

    const ctx = makeContext({ dispatch });
    const promise = agent.onMessage(makeMessage('test'), ctx);
    await vi.advanceTimersByTimeAsync(200);
    const result = await promise;

    expect(result.content).toContain('good-ok');
    expect(result.content).toContain('rescued');
    expect(result.metadata?.succeeded).toBe(2);
    expect(result.metadata?.failed).toBe(0);
    expect(result.metadata?.retriedSteps).toEqual([
      { agentId: 'broken', attempts: 2, usedFailBranch: true },
    ]);
    vi.useRealTimers();
  });
});

// ─── LoopAgent ────────────────────────────────────────────────

describe('LoopAgent', () => {
  it('loops until condition returns false', async () => {
    let callCount = 0;
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockImplementation(async () => {
        callCount++;
        return { content: callCount < 3 ? 'continue' : 'done' };
      });

    const agent = new LoopAgent('loop-1', 'Loop', {
      agentId: 'worker',
      maxIterations: 10,
      condition: (iteration, lastResponse) => {
        if (!lastResponse) return true;
        return lastResponse.content !== 'done';
      },
    });

    const ctx = makeContext({ dispatch });
    const result = await agent.onMessage(makeMessage('start'), ctx);

    expect(dispatch).toHaveBeenCalledTimes(3);
    expect(result.content).toBe('done');
    expect(result.metadata?.orchestration).toBe('loop');
    expect(result.metadata?.iterations).toBe(3);
  });

  it('respects maxIterations cap', async () => {
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockResolvedValue({ content: 'keep going' });

    const agent = new LoopAgent('loop-2', 'Loop', {
      agentId: 'worker',
      maxIterations: 3,
      condition: () => true, // always continue
    });

    const ctx = makeContext({ dispatch });
    const result = await agent.onMessage(makeMessage('start'), ctx);

    expect(dispatch).toHaveBeenCalledTimes(3);
    expect(result.metadata?.iterations).toBe(3);
    expect(result.metadata?.maxIterations).toBe(3);
  });

  it('stops on error and reports it', async () => {
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockResolvedValueOnce({ content: 'ok' })
      .mockRejectedValueOnce(new Error('loop failure'));

    const agent = new LoopAgent('loop-3', 'Loop', {
      agentId: 'worker',
      maxIterations: 5,
    });

    const ctx = makeContext({ dispatch });
    const result = await agent.onMessage(makeMessage('start'), ctx);

    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(result.content).toContain('Loop stopped');
    expect(result.content).toContain('loop failure');
    expect(result.metadata?.stoppedByError).toBe(true);
  });

  it('feeds previous output as input by default', async () => {
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockResolvedValueOnce({ content: 'first output' })
      .mockResolvedValueOnce({ content: 'second output' })
      .mockResolvedValueOnce({ content: '' }); // empty = stop

    const agent = new LoopAgent('loop-4', 'Loop', {
      agentId: 'worker',
      maxIterations: 5,
    });

    const ctx = makeContext({ dispatch });
    await agent.onMessage(makeMessage('initial'), ctx);

    // First call gets original message
    expect(dispatch.mock.calls[0][1].content).toBe('initial');
    // Second call gets first output
    expect(dispatch.mock.calls[1][1].content).toBe('first output');
    // Third call gets second output
    expect(dispatch.mock.calls[2][1].content).toBe('second output');
  });

  it('returns error when dispatch is not available', async () => {
    const agent = new LoopAgent('loop-5', 'Loop', {
      agentId: 'worker',
    });

    const ctx = makeContext({ dispatch: undefined });
    const result = await agent.onMessage(makeMessage('hello'), ctx);

    expect(result.content).toContain('requires dispatch capability');
  });

  // ─── Array Iteration Tests ────────────────────────────────

  it('iterates over an array sequentially', async () => {
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockImplementation(async (_agentId, msg) => {
        return { content: `processed-${msg.content}` };
      });

    const agent = new LoopAgent('loop-arr-1', 'Array Loop', {
      agentId: 'processor',
      items: { key: 'data' },
    });

    const ctx = makeContext({ dispatch });
    const msg = makeMessage('go');

    // Pre-seed state via a wrapper that provides state
    // The LoopAgent creates its own state, so we set 'data' as 'input'
    // Actually, LoopAgent sets state.set('input', message.content)
    // and reads items from state.get(key). So we need items in state.
    // Since LoopAgent creates its own SharedState, we can't inject directly.
    // Instead, set message.content to the array, and use inputKey.
    // Wait — the items config reads from SharedState key. The only way
    // to get data into state is: state.set('input', message.content).
    // So we use key: 'input' and put the array as message content.

    const agent2 = new LoopAgent('loop-arr-1b', 'Array Loop', {
      agentId: 'processor',
      items: { key: 'input' },
    });

    const result = await agent2.onMessage(
      makeMessage(JSON.stringify(['a', 'b', 'c'])),
      ctx,
    );

    expect(dispatch).toHaveBeenCalledTimes(3);
    expect(dispatch.mock.calls[0][1].content).toBe('"a"');
    expect(dispatch.mock.calls[1][1].content).toBe('"b"');
    expect(dispatch.mock.calls[2][1].content).toBe('"c"');
    expect(result.content).toContain('Processed 3 items');
    expect(result.metadata?.orchestration).toBe('loop');
    expect(result.metadata?.mode).toBe('array_iteration');
    expect(result.metadata?.itemCount).toBe(3);
  });

  it('iterates over an array with concurrency', async () => {
    let concurrentCalls = 0;
    let maxConcurrent = 0;

    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockImplementation(async (_agentId, msg) => {
        concurrentCalls++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCalls);
        await new Promise(r => setTimeout(r, 10));
        concurrentCalls--;
        return { content: `done-${msg.content}` };
      });

    const agent = new LoopAgent('loop-arr-conc', 'Concurrent Array Loop', {
      agentId: 'processor',
      items: { key: 'input', concurrency: 3 },
    });

    const ctx = makeContext({ dispatch });
    const items = Array.from({ length: 9 }, (_, i) => `item-${i}`);
    const result = await agent.onMessage(makeMessage(JSON.stringify(items)), ctx);

    expect(dispatch).toHaveBeenCalledTimes(9);
    expect(maxConcurrent).toBeLessThanOrEqual(3);
    expect(result.metadata?.itemCount).toBe(9);
  });

  it('empty array produces zero iterations', async () => {
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>();

    const agent = new LoopAgent('loop-arr-empty', 'Empty Array', {
      agentId: 'processor',
      items: { key: 'input' },
    });

    const ctx = makeContext({ dispatch });
    const result = await agent.onMessage(makeMessage('[]'), ctx);

    expect(dispatch).not.toHaveBeenCalled();
    expect(result.content).toContain('Processed 0 items');
    expect(result.metadata?.itemCount).toBe(0);
  });

  it('non-array SharedState value returns error', async () => {
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>();

    const agent = new LoopAgent('loop-arr-invalid', 'Invalid Array', {
      agentId: 'processor',
      items: { key: 'input' },
    });

    const ctx = makeContext({ dispatch });
    const result = await agent.onMessage(makeMessage('{"not": "array"}'), ctx);

    expect(dispatch).not.toHaveBeenCalled();
    expect(result.content).toContain('not an array');
  });

  it('collects results to specified collectKey', async () => {
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockImplementation(async (_agentId, msg) => {
        return { content: `result-for-${msg.content}` };
      });

    const agent = new LoopAgent('loop-arr-collect', 'Collect Array', {
      agentId: 'processor',
      items: { key: 'input', collectKey: 'outputs' },
    });

    const ctx = makeContext({ dispatch });
    const result = await agent.onMessage(makeMessage(JSON.stringify([1, 2])), ctx);

    // Results should be in state under 'outputs'
    const stateSnapshot = result.metadata?.state as Record<string, unknown>;
    const outputs = JSON.parse(stateSnapshot?.outputs as string);
    expect(outputs).toEqual(['result-for-1', 'result-for-2']);
  });

  it('maxIterations caps array iteration', async () => {
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockResolvedValue({ content: 'done' });

    const agent = new LoopAgent('loop-arr-cap', 'Capped Array', {
      agentId: 'processor',
      maxIterations: 3,
      items: { key: 'input' },
    });

    const ctx = makeContext({ dispatch });
    const items = Array.from({ length: 10 }, (_, i) => i);
    const result = await agent.onMessage(makeMessage(JSON.stringify(items)), ctx);

    expect(dispatch).toHaveBeenCalledTimes(3);
    expect(result.metadata?.itemCount).toBe(3);
    expect(result.metadata?.totalItems).toBe(10);
  });

  it('individual item errors collected without stopping', async () => {
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockImplementation(async (_agentId, msg) => {
        if (msg.content === '"bad"') throw new Error('item failed');
        return { content: `ok-${msg.content}` };
      });

    const agent = new LoopAgent('loop-arr-err', 'Error Tolerant Array', {
      agentId: 'processor',
      items: { key: 'input' },
    });

    const ctx = makeContext({ dispatch });
    const result = await agent.onMessage(
      makeMessage(JSON.stringify(['good', 'bad', 'good2'])),
      ctx,
    );

    expect(dispatch).toHaveBeenCalledTimes(3);
    expect(result.content).toContain('1 errors');
    expect(result.metadata?.errors).toBe(1);

    const stateSnapshot = result.metadata?.state as Record<string, unknown>;
    const results = JSON.parse(stateSnapshot?.results as string);
    expect(results[0]).toBe('ok-"good"');
    expect(results[1]).toContain('[Error');
    expect(results[2]).toBe('ok-"good2"');
  });
});

// ─── Utility Functions ────────────────────────────────────────

describe('executeWithRetry', () => {
  it('returns immediately on success', async () => {
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockResolvedValueOnce({ content: 'ok' });

    const { response, attempts } = await executeWithRetry(
      dispatch, 'agent', makeMessage('test'), undefined,
    );

    expect(response.content).toBe('ok');
    expect(attempts).toBe(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('applies exponential backoff capped at maxDelayMs', async () => {
    vi.useFakeTimers();
    const dispatch = vi.fn<[string, UserMessage], Promise<AgentResponse>>()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockRejectedValueOnce(new Error('fail 3'))
      .mockResolvedValueOnce({ content: 'finally' });

    const promise = executeWithRetry(
      dispatch, 'agent', makeMessage('test'),
      { maxRetries: 3, initialDelayMs: 100, backoffMultiplier: 2, maxDelayMs: 250 },
    );

    // Delay 1: min(100 * 2^0, 250) = 100ms
    await vi.advanceTimersByTimeAsync(100);
    // Delay 2: min(100 * 2^1, 250) = 200ms
    await vi.advanceTimersByTimeAsync(200);
    // Delay 3: min(100 * 2^2, 250) = 250ms (capped)
    await vi.advanceTimersByTimeAsync(250);

    const { response, attempts } = await promise;
    expect(response.content).toBe('finally');
    expect(attempts).toBe(4);
    vi.useRealTimers();
  });
});

describe('runWithConcurrencyLimit', () => {
  it('limits concurrent execution', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const fn = async (item: number): Promise<number> => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise(r => setTimeout(r, 10));
      concurrent--;
      return item * 2;
    };

    const results = await runWithConcurrencyLimit([1, 2, 3, 4, 5], fn, 2);
    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });
});
