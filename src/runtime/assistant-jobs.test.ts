import { describe, expect, it } from 'vitest';
import { AssistantJobTracker } from './assistant-jobs.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('AssistantJobTracker', () => {
  it('records successful jobs', async () => {
    const tracker = new AssistantJobTracker();
    const result = await tracker.run(
      { type: 'intel.scan', source: 'manual', detail: 'Scan requested by user' },
      async () => {
        await sleep(5);
        return 42;
      },
    );
    expect(result).toBe(42);

    const state = tracker.getState();
    expect(state.summary.total).toBe(1);
    expect(state.summary.succeeded).toBe(1);
    expect(state.summary.failed).toBe(0);
    expect(state.jobs[0].status).toBe('succeeded');
    expect(state.jobs[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('records failed jobs', async () => {
    const tracker = new AssistantJobTracker();

    await expect(
      tracker.run(
        { type: 'intel.autoscan', source: 'scheduled' },
        async () => {
          await sleep(5);
          throw new Error('network unavailable');
        },
      ),
    ).rejects.toThrow('network unavailable');

    const state = tracker.getState();
    expect(state.summary.total).toBe(1);
    expect(state.summary.failed).toBe(1);
    expect(state.jobs[0].status).toBe('failed');
    expect(state.jobs[0].error).toBe('network unavailable');
  });

  it('limits retained history to maxJobs', async () => {
    const tracker = new AssistantJobTracker({ maxJobs: 2 });

    await tracker.run({ type: 'a' }, async () => 1);
    await tracker.run({ type: 'b' }, async () => 2);
    await tracker.run({ type: 'c' }, async () => 3);

    const state = tracker.getState(10);
    expect(state.jobs.length).toBe(2);
    expect(state.jobs[0].type).toBe('c');
    expect(state.jobs[1].type).toBe('b');
  });
});

