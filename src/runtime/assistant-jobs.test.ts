import { describe, expect, it } from 'vitest';
import {
  AssistantJobTracker,
  buildAssistantJobDisplay,
  mergeAssistantJobStates,
  readDelegatedWorkerMetadata,
} from './assistant-jobs.js';

describe('AssistantJobTracker', () => {
  it('supports mutable job updates and completion handoff metadata', () => {
    let now = 1000;
    const tracker = new AssistantJobTracker({ now: () => now });

    const started = tracker.start({
      type: 'delegated_worker',
      source: 'system',
      detail: 'Brokered worker dispatch for local',
      metadata: {
        delegation: {
          kind: 'brokered_worker',
          lifecycle: 'running',
        },
      },
    });

    now = 1200;
    tracker.update(started.id, {
      metadata: {
        delegation: {
          kind: 'brokered_worker',
          lifecycle: 'completed',
          handoff: {
            summary: 'Summarized delegated result.',
            nextAction: 'Result returned inline to the original conversation.',
          },
        },
      },
    });

    now = 1500;
    tracker.succeed(started.id);

    const state = tracker.getState(5);
    expect(state.summary.total).toBe(1);
    expect(state.summary.succeeded).toBe(1);
    expect(state.jobs[0]).toMatchObject({
      type: 'delegated_worker',
      status: 'succeeded',
      durationMs: 500,
      metadata: {
        delegation: {
          lifecycle: 'completed',
          handoff: {
            summary: 'Summarized delegated result.',
          },
        },
      },
    });
  });

  it('merges multiple job states for unified operator views', () => {
    const trackerA = new AssistantJobTracker({ now: () => 1000 });
    const trackerB = new AssistantJobTracker({ now: () => 2000 });

    trackerA.start({ type: 'security_scan', source: 'system', detail: 'Scanning' });
    const workerJob = trackerB.start({
      type: 'delegated_worker',
      source: 'system',
      detail: 'Brokered worker dispatch',
      metadata: {
        delegation: {
          kind: 'brokered_worker',
          lifecycle: 'running',
        },
      },
    });
    trackerB.succeed(workerJob.id);

    const merged = mergeAssistantJobStates([
      trackerA.getState(10),
      trackerB.getState(10),
    ], 10);

    expect(merged.summary.total).toBe(2);
    expect(merged.summary.running).toBe(1);
    expect(merged.summary.succeeded).toBe(1);
    expect(merged.jobs[0]?.type).toBe('delegated_worker');
    expect(merged.jobs[1]?.type).toBe('security_scan');
  });

  it('derives delegated follow-up display state for operator surfaces', () => {
    const display = buildAssistantJobDisplay({
      source: 'system',
      detail: 'Brokered worker dispatch for local',
      metadata: {
        delegation: {
          kind: 'brokered_worker',
          agentId: 'security-triage',
          agentName: 'Security Triage Agent',
          orchestration: {
            role: 'verifier',
            lenses: ['security'],
          },
          originChannel: 'web',
          codeSessionId: 'code-1',
          continuityKey: 'continuity-1',
          handoff: {
            summary: 'Importer fix is paused.',
            unresolvedBlockerKind: 'approval',
            approvalCount: 2,
            nextAction: 'Resolve the pending approval(s) to continue the delegated run.',
            reportingMode: 'held_for_approval',
          },
        },
      },
    });

    expect(display.originSummary).toBe('web • Verifier (Security) • Security Triage Agent • code code-1 • continuity continuity-1');
    expect(display.outcomeSummary).toBe('Importer fix is paused.');
    expect(display.followUp).toMatchObject({
      reportingMode: 'held_for_approval',
      label: '2 approvals pending',
      needsOperatorAction: true,
      blockerKind: 'approval',
      approvalCount: 2,
    });
  });

  it('preserves delegated execution identity metadata for operator views', () => {
    expect(readDelegatedWorkerMetadata({
      delegation: {
        kind: 'brokered_worker',
        executionId: 'exec-operator-1',
        rootExecutionId: 'exec-root-1',
        executionGraph: {
          graphId: 'execution-graph:exec-operator-1:delegated-worker',
          nodeId: 'node:exec-operator-1:delegated_worker',
          status: 'awaiting_approval',
          lifecycle: 'blocked',
          verificationArtifactId: 'execution-graph:exec-operator-1:delegated-worker:verification',
        },
      },
    })).toMatchObject({
      executionId: 'exec-operator-1',
      rootExecutionId: 'exec-root-1',
      executionGraph: {
        graphId: 'execution-graph:exec-operator-1:delegated-worker',
        nodeId: 'node:exec-operator-1:delegated_worker',
        status: 'awaiting_approval',
        lifecycle: 'blocked',
        verificationArtifactId: 'execution-graph:exec-operator-1:delegated-worker:verification',
      },
    });
  });

  it('derives held-for-operator replay controls for long-running delegated jobs', () => {
    const display = buildAssistantJobDisplay({
      source: 'system',
      detail: 'Brokered worker dispatch for local',
      metadata: {
        delegation: {
          kind: 'brokered_worker',
          agentId: 'external',
          agentName: 'External Agent',
          orchestration: {
            role: 'explorer',
            label: 'Repository Explorer',
            lenses: ['coding_workspace'],
          },
          originChannel: 'web',
          runClass: 'long_running',
          handoff: {
            summary: 'Repository digest is complete.',
            runClass: 'long_running',
            nextAction: 'Replay or dismiss the held delegated result.',
            reportingMode: 'held_for_operator',
            operatorState: 'pending',
          },
        },
      },
    });

    expect(display.originSummary).toBe('web • Repository Explorer (Coding Workspace) • External Agent');
    expect(display.outcomeSummary).toBe('Repository digest is complete.');
    expect(display.followUp).toMatchObject({
      reportingMode: 'held_for_operator',
      label: 'Held for operator review',
      needsOperatorAction: true,
      operatorState: 'pending',
      actions: ['replay', 'keep_held', 'dismiss'],
    });
  });

  it('surfaces bounded memory hygiene metadata for maintenance jobs', () => {
    const display = buildAssistantJobDisplay({
      source: 'system',
      detail: 'Refreshed compacted summary for code session.',
      metadata: {
        maintenance: {
          kind: 'memory_hygiene',
          maintenanceType: 'summary_refresh',
          artifact: 'compacted_summary',
          bounded: true,
          scope: 'code_session',
        },
      },
    });

    expect(display.maintenance).toEqual({
      kind: 'memory_hygiene',
      maintenanceType: 'summary_refresh',
      artifact: 'compacted_summary',
      bounded: true,
      scope: 'code_session',
    });
  });

  it('keeps memory hygiene maintenance metadata when context flush jobs complete', () => {
    const tracker = new AssistantJobTracker({ now: () => 1000 });
    const started = tracker.start({
      type: 'memory_hygiene.context_flush',
      source: 'system',
      detail: 'Context flush captured 2 lines',
      metadata: {
        maintenance: {
          kind: 'memory_hygiene',
          maintenanceType: 'context_flush',
          artifact: 'memory_entry',
          bounded: true,
          scope: 'global',
        },
      },
    });
    tracker.succeed(started.id, {
      detail: 'Context flush persisted to global memory: Context flush for browser automation (2 captured lines).',
    });

    const state = tracker.getState(5);
    const display = buildAssistantJobDisplay(state.jobs[0]!);
    expect(display.maintenance).toEqual({
      kind: 'memory_hygiene',
      maintenanceType: 'context_flush',
      artifact: 'memory_entry',
      bounded: true,
      scope: 'global',
    });
    expect(display.outcomeSummary).toContain('Context flush persisted to global memory');
  });
});
