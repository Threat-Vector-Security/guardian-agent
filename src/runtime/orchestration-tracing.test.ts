import { describe, expect, it } from 'vitest';
import { createOrchestrationSpan } from './orchestration-tracing.js';

describe('orchestration tracing', () => {
  it('creates a span with stable run metadata', () => {
    const span = createOrchestrationSpan({
      runId: 'run-1',
      groupId: 'group-1',
      parentRunId: 'parent-1',
      type: 'compile',
      name: 'automation compile',
      startedAt: 100,
      status: 'running',
      metadata: { primitive: 'agent' },
    });

    expect(span.id).toBeTruthy();
    expect(span.runId).toBe('run-1');
    expect(span.groupId).toBe('group-1');
    expect(span.type).toBe('compile');
  });
});
