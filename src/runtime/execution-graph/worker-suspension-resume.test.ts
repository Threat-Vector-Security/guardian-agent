import { describe, expect, it } from 'vitest';
import type { SelectedExecutionProfile } from '../execution-profiles.js';
import {
  buildWorkerSuspensionGraphEvent,
  buildWorkerSuspensionResumeContext,
  emitWorkerSuspensionGraphEvent,
  workerSuspensionResumeContextToTraceContext,
  type WorkerSuspensionGraphResumeContext,
} from './worker-suspension-resume.js';

describe('worker suspension resume graph helpers', () => {
  it('builds delegated worker suspension resume state without supervisor authority', () => {
    const profile = executionProfile();
    const resume = buildWorkerSuspensionResumeContext({
      worker: {
        id: 'worker-1',
        workerSessionKey: 'session-1::default',
        sessionId: 'session-1',
        agentId: 'default',
      },
      request: {
        userId: 'owner',
        message: {
          id: 'message-1',
          content: 'Create the draft.',
          channel: 'worker-internal',
          surfaceId: 'internal-surface',
          principalId: 'principal-owner',
          principalRole: 'owner',
        },
        delegation: {
          requestId: 'request-1',
          executionId: 'execution-1',
          rootExecutionId: 'root-1',
          originChannel: 'web',
          originSurfaceId: 'web-surface',
          continuityKey: 'default:owner',
          activeExecutionRefs: ['execution:root-1'],
          pendingActionId: 'pending-0',
          codeSessionId: 'code-1',
          runClass: 'short_lived',
        },
        executionProfile: profile,
      },
      target: {
        agentName: 'Workspace Explorer',
        orchestration: { role: 'explorer', label: 'Explorer', lenses: ['research'] },
      },
      taskRunId: 'task-1',
      approvalIds: ['approval-1', 'approval-1', 'approval-2'],
      expiresAt: 12345,
    });

    expect(resume).toMatchObject({
      workerId: 'worker-1',
      workerSessionKey: 'session-1::default',
      sessionId: 'session-1',
      agentId: 'default',
      userId: 'owner',
      requestId: 'request-1',
      messageId: 'message-1',
      executionId: 'execution-1',
      rootExecutionId: 'root-1',
      originChannel: 'web',
      originSurfaceId: 'web-surface',
      taskRunId: 'task-1',
      agentName: 'Workspace Explorer',
      approvalIds: ['approval-1', 'approval-2'],
      expiresAt: 12345,
    });
    expect(resume.executionProfile).toEqual(profile);
    expect(resume.executionProfile).not.toBe(profile);
    expect(resume.executionProfile?.fallbackProviderOrder).not.toBe(profile.fallbackProviderOrder);
  });

  it('emits worker suspension graph events through graph-owned projection', () => {
    const suspension = suspensionContext();
    const appended: unknown[] = [];
    const timeline: unknown[] = [];
    const event = emitWorkerSuspensionGraphEvent({
      suspension,
      kind: 'interruption_resolved',
      payloadDetails: { approvalId: 'approval-1', resultStatus: 'approved' },
      eventKey: 'approval-resolved',
      now: () => 2000,
      graphStore: {
        getSnapshot: () => ({
          events: [
            { sequence: 3 },
            { sequence: 8 },
          ],
        }),
        appendEvent: (item) => appended.push(item),
      },
      runTimeline: {
        ingestExecutionGraphEvent: (item) => timeline.push(item),
      },
    });

    expect(event).toMatchObject({
      eventId: 'graph-1:worker-resume:approval-resolved:9',
      graphId: 'graph-1',
      executionId: 'exec-1',
      rootExecutionId: 'root-1',
      requestId: 'request-1',
      nodeId: 'node-1',
      nodeKind: 'delegated_worker',
      kind: 'interruption_resolved',
      timestamp: 2000,
      sequence: 9,
      producer: 'supervisor',
      channel: 'web',
      agentId: 'default',
      userId: 'owner',
      codeSessionId: 'code-1',
      payload: {
        approvalId: 'approval-1',
        resultStatus: 'approved',
      },
    });
    expect(appended).toEqual([event]);
    expect(timeline).toEqual([event]);
  });

  it('can build graph-scoped worker suspension events without a node scope', () => {
    const event = buildWorkerSuspensionGraphEvent({
      suspension: suspensionContext(),
      kind: 'graph_completed',
      payloadDetails: { status: 'succeeded' },
      eventKey: 'graph-completed',
      sequence: 12,
      timestamp: 3000,
      nodeScoped: false,
    });

    expect(event).toMatchObject({
      graphId: 'graph-1',
      kind: 'graph_completed',
      sequence: 12,
      payload: { status: 'succeeded' },
    });
    expect(event).not.toHaveProperty('nodeId');
    expect(event).not.toHaveProperty('nodeKind');
  });

  it('projects worker suspension resume context into trace context', () => {
    const resume = buildWorkerSuspensionResumeContext({
      worker: {
        id: 'worker-1',
        workerSessionKey: 'session-1::default',
        sessionId: 'session-1',
        agentId: 'default',
      },
      request: {
        userId: 'owner',
        message: {
          id: 'message-1',
          content: 'Continue.',
          channel: 'worker-internal',
          principalId: 'principal-owner',
          principalRole: 'owner',
        },
        delegation: {
          requestId: 'request-1',
          originChannel: 'web',
          activeExecutionRefs: ['execution:root-1'],
        },
        executionProfile: executionProfile(),
      },
      target: {
        orchestration: { role: 'explorer', lenses: ['research'] },
      },
      taskRunId: 'task-1',
      approvalIds: ['approval-1'],
      expiresAt: 12345,
    });

    const trace = workerSuspensionResumeContextToTraceContext(resume);

    expect(trace).toMatchObject({
      sessionId: 'session-1',
      agentId: 'default',
      userId: 'owner',
      requestId: 'request-1',
      channel: 'web',
      taskRunId: 'task-1',
      principalId: 'principal-owner',
      principalRole: 'owner',
      activeExecutionRefs: ['execution:root-1'],
    });
    expect(trace.executionProfile).toEqual(resume.executionProfile);
    expect(trace.executionProfile).not.toBe(resume.executionProfile);
  });
});

function suspensionContext(): WorkerSuspensionGraphResumeContext {
  return {
    graphId: 'graph-1',
    executionId: 'exec-1',
    rootExecutionId: 'root-1',
    requestId: 'request-1',
    runId: 'run-1',
    nodeId: 'node-1',
    resumeToken: 'resume-token',
    approvalId: 'approval-1',
    channel: 'web',
    agentId: 'default',
    userId: 'owner',
    codeSessionId: 'code-1',
    resume: {
      workerSessionKey: 'session-1::default',
      sessionId: 'session-1',
      agentId: 'default',
      userId: 'owner',
      principalId: 'owner',
      principalRole: 'owner',
      channel: 'web',
      approvalIds: ['approval-1'],
      expiresAt: 5000,
    },
    session: {
      version: 1,
      kind: 'tool_loop',
      llmMessages: [{ role: 'assistant', content: 'Waiting for approval.' }],
      pendingTools: [{
        approvalId: 'approval-1',
        toolCallId: 'tool-call-1',
        jobId: 'job-1',
        name: 'fs_write',
      }],
      originalMessage: {
        id: 'message-1',
        userId: 'owner',
        channel: 'web',
        content: 'Create the draft.',
        timestamp: 1000,
      },
      createdAt: 1000,
      expiresAt: 5000,
    },
    artifactIds: ['artifact-1'],
    sequenceStart: 2,
    expiresAt: 5000,
  };
}

function executionProfile(): SelectedExecutionProfile {
  return {
    id: 'managed-cloud-coding',
    providerName: 'ollama-cloud-coding',
    providerType: 'ollama_cloud',
    providerModel: 'glm-5.1',
    providerTier: 'managed_cloud',
    providerLocality: 'external',
    requestedTier: 'external',
    routingMode: 'auto',
    selectionSource: 'auto',
    reason: 'test',
    fallbackProviderOrder: ['ollama-cloud-coding', 'ollama-cloud'],
  };
}
