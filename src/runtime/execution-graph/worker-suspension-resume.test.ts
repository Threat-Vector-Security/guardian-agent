import { describe, expect, it } from 'vitest';
import type { SelectedExecutionProfile } from '../execution-profiles.js';
import { buildWorkerSuspensionEnvelope } from '../worker-suspension.js';
import {
  buildWorkerSuspensionGraphEvent,
  buildWorkerSuspensionResumeContext,
  emitWorkerSuspensionGraphEvent,
  recordDelegatedWorkerGraphPendingApprovalAction,
  recordWorkerSuspensionGraphContinuationPendingAction,
  reconstructWorkerSuspensionGraphResume,
  workerSuspensionResumeContextToTraceContext,
  type WorkerSuspensionGraphResumeContext,
} from './worker-suspension-resume.js';
import { buildWorkerSuspensionArtifact } from './worker-suspension-artifact.js';

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

  it('reconstructs worker suspension resume context from graph artifacts', () => {
    const suspension = suspensionContext();
    const artifact = buildWorkerSuspensionArtifact({
      graphId: suspension.graphId,
      nodeId: suspension.nodeId,
      artifactId: 'worker-suspension-1',
      envelope: buildWorkerSuspensionEnvelope({
        resume: suspension.resume,
        session: suspension.session,
      }),
      createdAt: 1_500,
    });
    const resume = reconstructWorkerSuspensionGraphResume({
      approvalId: 'approval-1',
      payload: {
        graphId: suspension.graphId,
        nodeId: suspension.nodeId,
        resumeToken: 'resume-token',
        artifactIds: ['worker-suspension-1'],
      },
      pendingAction: {
        expiresAt: 4_000,
        scope: {
          agentId: 'default',
          userId: 'owner',
          channel: 'web',
          surfaceId: 'surface-1',
        },
      } as never,
      graphStore: {
        getArtifact: (_graphId, artifactId) => artifactId === artifact.artifactId ? artifact : null,
        getSnapshot: () => ({
          graph: {
            graphId: suspension.graphId,
            executionId: suspension.executionId,
            rootExecutionId: suspension.rootExecutionId,
            requestId: suspension.requestId,
            runId: suspension.runId,
            securityContext: {
              channel: suspension.channel,
              agentId: suspension.agentId,
              userId: suspension.userId,
              codeSessionId: suspension.codeSessionId,
            },
            artifacts: [{ artifactId: artifact.artifactId }],
          },
          events: [{ sequence: 7 }],
        } as never),
      },
    });

    expect(resume).toMatchObject({
      graphId: suspension.graphId,
      executionId: suspension.executionId,
      rootExecutionId: suspension.rootExecutionId,
      requestId: suspension.requestId,
      runId: suspension.runId,
      nodeId: suspension.nodeId,
      resumeToken: 'resume-token',
      approvalId: 'approval-1',
      codeSessionId: suspension.codeSessionId,
      resume: suspension.resume,
      session: suspension.session,
      artifactIds: ['worker-suspension-1'],
      sequenceStart: 7,
      expiresAt: 4_000,
    });
  });

  it('records continuation approval pending actions from graph-owned suspension artifacts', () => {
    const suspension = suspensionContext();
    const appended: unknown[] = [];
    const writtenArtifacts: unknown[] = [];
    const replacements: unknown[] = [];
    const pending = recordWorkerSuspensionGraphContinuationPendingAction({
      suspension,
      worker: {
        id: 'worker-2',
        workerSessionKey: 'session-1::default',
      },
      approvalMetadata: {
        approvalIds: ['approval-2'],
        approvalSummaries: [{
          id: 'approval-2',
          toolName: 'fs_write',
          argsPreview: '{"path":"tmp/next.txt"}',
        }],
        prompt: 'Approve the next write.',
      },
      workerSuspension: suspension.session,
      previousPendingAction: {
        id: 'pending-1',
        scope: {
          agentId: 'default',
          userId: 'owner',
          channel: 'web',
          surfaceId: 'surface-1',
        },
        intent: {
          originalUserContent: 'Create the draft.',
          route: 'coding_task',
        },
      } as never,
      now: () => 10_000,
      ttlMs: 2_000,
      graphStore: {
        getSnapshot: () => ({ events: [{ sequence: 7 }] }),
        appendEvent: (event) => appended.push(event),
        writeArtifact: (artifact) => writtenArtifacts.push(artifact),
      },
      store: {
        replaceActive: (scope, replacement, nowMs) => {
          replacements.push({ scope, replacement, nowMs });
          return {
            id: 'pending-2',
            createdAt: nowMs,
            updatedAt: nowMs,
            scope,
            ...replacement,
          };
        },
      },
    });

    expect(pending).toMatchObject({
      id: 'pending-2',
      scope: {
        agentId: 'default',
        userId: 'owner',
        channel: 'web',
        surfaceId: 'surface-1',
      },
      blocker: {
        kind: 'approval',
        approvalIds: ['approval-2'],
      },
      resume: {
        kind: 'execution_graph',
        payload: {
          graphId: suspension.graphId,
          nodeId: suspension.nodeId,
          artifactIds: [expect.any(String)],
        },
      },
      expiresAt: 12_000,
    });
    expect(appended).toHaveLength(1);
    expect(appended[0]).toMatchObject({
      kind: 'interruption_requested',
      payload: {
        approvalIds: ['approval-2'],
        resumeToken: `${suspension.graphId}:${suspension.nodeId}:approval:approval-2`,
      },
    });
    expect(writtenArtifacts).toHaveLength(1);
    expect(writtenArtifacts[0]).toMatchObject({
      artifactType: 'WorkerSuspension',
      graphId: suspension.graphId,
      nodeId: suspension.nodeId,
    });
    expect(replacements).toHaveLength(1);
  });

  it('records delegated worker graph approval pending actions with origin surface scope', () => {
    const suspension = suspensionContext();
    const interruption = buildWorkerSuspensionGraphEvent({
      suspension,
      kind: 'interruption_requested',
      payloadDetails: {
        kind: 'approval',
        approvalIds: ['approval-1'],
        resumeToken: 'resume-token-1',
      },
      eventKey: 'approval-requested',
      sequence: 8,
      timestamp: 10_000,
    });
    const writtenArtifacts: unknown[] = [];
    const pending = recordDelegatedWorkerGraphPendingApprovalAction({
      worker: {
        id: 'worker-1',
        workerSessionKey: 'session-1::default',
        sessionId: 'session-1',
        agentId: 'default',
      },
      request: {
        agentId: 'default',
        userId: 'owner',
        message: {
          id: 'message-1',
          content: 'Create the draft.',
          channel: 'worker-internal:surface',
          principalId: 'principal-owner',
          principalRole: 'owner',
        },
        delegation: {
          requestId: 'request-1',
          originChannel: 'web',
          originSurfaceId: 'web-surface',
        },
        executionProfile: executionProfile(),
      },
      target: {
        agentName: 'Workspace Explorer',
        orchestration: { role: 'explorer', label: 'Explorer' },
      },
      taskRunId: 'task-1',
      graphCompletion: {
        metadata: { nodeId: suspension.nodeId },
        interruptEvent: interruption,
      },
      approvalMetadata: {
        approvalIds: ['approval-1'],
        approvalSummaries: [{
          id: 'approval-1',
          toolName: 'fs_write',
          argsPreview: '{"path":"tmp/draft.txt"}',
        }],
        prompt: 'Approve the write.',
      },
      workerSuspension: suspension.session,
      intentDecision: {
        route: 'coding_task',
        operation: 'modify',
        summary: 'Create the draft.',
      },
      now: () => 20_000,
      ttlMs: 5_000,
      graphStore: {
        appendEvent: () => undefined,
        writeArtifact: (artifact) => writtenArtifacts.push(artifact),
      },
      store: {
        replaceActive: (scope, replacement, nowMs) => ({
          id: 'pending-1',
          createdAt: nowMs,
          updatedAt: nowMs,
          scope,
          ...replacement,
        }),
      },
    });

    expect(pending).toMatchObject({
      scope: {
        agentId: 'default',
        userId: 'owner',
        channel: 'web',
        surfaceId: 'web-surface',
      },
      blocker: {
        kind: 'approval',
        approvalIds: ['approval-1'],
      },
      intent: {
        route: 'coding_task',
        operation: 'modify',
        summary: 'Create the draft.',
        originalUserContent: 'Create the draft.',
      },
      expiresAt: 25_000,
    });
    expect(writtenArtifacts).toHaveLength(1);
    expect(writtenArtifacts[0]).toMatchObject({
      artifactType: 'WorkerSuspension',
      graphId: suspension.graphId,
      nodeId: suspension.nodeId,
    });
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
