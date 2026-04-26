import { randomUUID } from 'node:crypto';

import type { RunTimelineStore } from '../run-timeline.js';
import type { IntentGatewayDecision } from '../intent-gateway.js';
import type {
  PendingActionApprovalSummary,
  PendingActionIntent,
  PendingActionRecord,
  PendingActionTransferPolicy,
} from '../pending-actions.js';
import type { PendingActionSetResult } from './orchestration-state.js';
import {
  artifactRefFromArtifact,
  type ExecutionArtifact,
} from '../execution-graph/graph-artifacts.js';
import {
  createExecutionGraphEvent,
  type ExecutionGraphEvent,
} from '../execution-graph/graph-events.js';
import type { ExecutionGraphStore } from '../execution-graph/graph-store.js';
import {
  readExecutionGraphResumePayload,
} from '../execution-graph/pending-action-adapter.js';
import type { ExecutionArtifactRef, ExecutionGraph } from '../execution-graph/types.js';
import {
  readAutomationAuthoringResumePayload,
  readFilesystemSaveOutputResumePayload,
  type AutomationAuthoringResumePayload,
  type FilesystemSaveOutputResumePayload,
} from './capability-continuation-resume.js';

export type CapabilityContinuationPayload =
  | FilesystemSaveOutputResumePayload
  | AutomationAuthoringResumePayload;

export interface CapabilityContinuationGraphResume {
  graph: ExecutionGraph;
  nodeId: string;
  resumeToken: string;
  artifact: ExecutionArtifact<CapabilityContinuationArtifactContent>;
  payload: CapabilityContinuationPayload;
}

export interface CapabilityContinuationArtifactContent extends Record<string, unknown> {
  type: 'chat_capability_continuation';
  payload: Record<string, unknown>;
}

type CapabilityContinuationGraphStore = Pick<
  ExecutionGraphStore,
  'appendEvent' | 'createGraph' | 'getArtifact' | 'getSnapshot' | 'writeArtifact'
>;

const CAPABILITY_CONTINUATION_ARTIFACT_CONTENT_TYPE = 'chat_capability_continuation';

export function recordCapabilityContinuationGraphApproval(input: {
  graphStore: CapabilityContinuationGraphStore;
  runTimeline?: Pick<RunTimelineStore, 'ingestExecutionGraphEvent'>;
  userKey: string;
  userId: string;
  channel: string;
  surfaceId?: string;
  agentId: string;
  requestId: string;
  codeSessionId?: string;
  action: {
    prompt: string;
    approvalIds: string[];
    approvalSummaries?: PendingActionApprovalSummary[];
    originalUserContent: string;
    route?: string;
    operation?: string;
    summary?: string;
    turnRelation?: string;
    resolution?: string;
    missingFields?: string[];
    provenance?: PendingActionRecord['intent']['provenance'];
    entities?: Record<string, unknown>;
    continuation: CapabilityContinuationPayload;
    codeSessionId?: string;
  };
  setGraphPendingActionForRequest: (
    userKey: string,
    surfaceId: string | undefined,
    action: {
      event: ExecutionGraphEvent;
      originalUserContent: string;
      intent?: Partial<PendingActionIntent>;
      artifactRefs?: ExecutionArtifactRef[];
      approvalSummaries?: PendingActionApprovalSummary[];
      transferPolicy?: PendingActionTransferPolicy;
      expiresAt?: number;
    },
    nowMs?: number,
  ) => PendingActionSetResult;
  nowMs?: number;
}): PendingActionSetResult {
  const nowMs = input.nowMs ?? Date.now();
  const executionId = `capability:${randomUUID()}`;
  const graphId = `graph:${executionId}`;
  const nodeId = `node:${executionId}:approval`;
  const approvalIds = uniqueStrings(input.action.approvalIds);
  const graph = input.graphStore.createGraph({
    graphId,
    executionId,
    requestId: input.requestId,
    runId: input.requestId,
    intent: buildCapabilityGraphIntent(input.action),
    securityContext: {
      agentId: input.agentId,
      userId: input.userId,
      channel: input.channel,
      ...(input.surfaceId ? { surfaceId: input.surfaceId } : {}),
      ...(input.action.codeSessionId ?? input.codeSessionId ? { codeSessionId: input.action.codeSessionId ?? input.codeSessionId } : {}),
    },
    trigger: {
      type: 'user_request',
      source: input.channel,
      sourceId: input.requestId,
    },
    nodes: [
      {
        nodeId,
        graphId,
        kind: 'approval_interrupt',
        status: 'pending',
        title: 'Capability continuation approval',
        requiredInputIds: [],
        outputArtifactTypes: ['CapabilityContinuation'],
        allowedToolCategories: [],
        approvalPolicy: 'if_required',
        checkpointPolicy: 'phase_boundary',
      },
    ],
    edges: [],
  });
  let sequence = 0;
  const emit = (
    kind: ExecutionGraphEvent['kind'],
    payload: Record<string, unknown>,
    eventKey: string,
  ): ExecutionGraphEvent => {
    sequence += 1;
    const event = createCapabilityContinuationGraphEvent({
      graph,
      nodeId,
      kind,
      payload,
      eventKey,
      timestamp: nowMs,
      sequence,
    });
    input.graphStore.appendEvent(event);
    input.runTimeline?.ingestExecutionGraphEvent(event);
    return event;
  };

  emit('graph_started', {
    route: input.action.route,
    operation: input.action.operation,
  }, 'started');
  const artifact = buildCapabilityContinuationArtifact({
    graphId,
    nodeId,
    payload: input.action.continuation,
    createdAt: nowMs,
  });
  input.graphStore.writeArtifact(artifact);
  const artifactRef = artifactRefFromArtifact(artifact);
  emit('artifact_created', {
    artifactId: artifactRef.artifactId,
    artifactType: artifactRef.artifactType,
    label: artifactRef.label,
    ...(artifactRef.preview ? { preview: artifactRef.preview } : {}),
  }, `artifact:${artifact.artifactId}`);
  const interrupt = emit('interruption_requested', {
    kind: 'approval',
    prompt: input.action.prompt,
    approvalIds,
    approvalSummaries: (input.action.approvalSummaries ?? []).map((summary) => ({ ...summary })),
    resumeToken: `${graphId}:${nodeId}:approval:${approvalIds.join(',') || 'approval'}`,
  }, 'approval');

  return input.setGraphPendingActionForRequest(
    input.userKey,
    input.surfaceId,
    {
      event: interrupt,
      originalUserContent: input.action.originalUserContent,
      intent: {
        route: input.action.route,
        operation: input.action.operation,
        summary: input.action.summary,
        turnRelation: input.action.turnRelation,
        resolution: input.action.resolution,
        missingFields: input.action.missingFields,
        provenance: input.action.provenance,
        entities: input.action.entities,
      },
      artifactRefs: [artifactRef],
      approvalSummaries: input.action.approvalSummaries,
    },
    nowMs,
  );
}

export function readCapabilityContinuationGraphResume(input: {
  graphStore?: Pick<ExecutionGraphStore, 'getArtifact' | 'getSnapshot'>;
  pendingAction: PendingActionRecord;
}): CapabilityContinuationGraphResume | null {
  const payload = readExecutionGraphResumePayload(input.pendingAction.resume?.payload);
  if (!payload || !input.graphStore) return null;
  const snapshot = input.graphStore.getSnapshot(payload.graphId);
  if (!snapshot) return null;
  const artifactIds = uniqueStrings([
    ...payload.artifactIds,
    ...(input.pendingAction.graphInterrupt?.artifactRefs.map((artifact) => artifact.artifactId) ?? []),
  ]);
  for (const artifactId of artifactIds) {
    const artifact = input.graphStore.getArtifact(payload.graphId, artifactId);
    const continuation = readCapabilityContinuationArtifact(artifact);
    if (continuation) {
      return {
        graph: snapshot.graph,
        nodeId: payload.nodeId,
        resumeToken: payload.resumeToken,
        artifact: artifact as ExecutionArtifact<CapabilityContinuationArtifactContent>,
        payload: continuation,
      };
    }
  }
  return null;
}

export function emitCapabilityContinuationGraphResumeEvent(input: {
  graphStore: Pick<ExecutionGraphStore, 'appendEvent' | 'getSnapshot'>;
  runTimeline?: Pick<RunTimelineStore, 'ingestExecutionGraphEvent'>;
  resume: CapabilityContinuationGraphResume;
  kind: ExecutionGraphEvent['kind'];
  payload: Record<string, unknown>;
  eventKey: string;
  nowMs?: number;
}): ExecutionGraphEvent | null {
  const snapshot = input.graphStore.getSnapshot(input.resume.graph.graphId);
  if (!snapshot) return null;
  const sequence = snapshot.events.reduce((highest, event) => Math.max(highest, event.sequence), 0) + 1;
  const event = createCapabilityContinuationGraphEvent({
    graph: snapshot.graph,
    nodeId: input.resume.nodeId,
    kind: input.kind,
    payload: input.payload,
    eventKey: `resume:${input.eventKey}`,
    timestamp: input.nowMs ?? Date.now(),
    sequence,
  });
  input.graphStore.appendEvent(event);
  input.runTimeline?.ingestExecutionGraphEvent(event);
  return event;
}

function buildCapabilityContinuationArtifact(input: {
  graphId: string;
  nodeId: string;
  payload: CapabilityContinuationPayload;
  createdAt: number;
}): ExecutionArtifact<CapabilityContinuationArtifactContent> {
  const label = input.payload.type === 'filesystem_save_output'
    ? 'Filesystem save continuation'
    : 'Automation authoring continuation';
  const preview = input.payload.type === 'filesystem_save_output'
    ? `Resume save to ${input.payload.targetPath}.`
    : 'Resume automation authoring after policy remediation.';
  const refs = input.payload.type === 'filesystem_save_output'
    ? [input.payload.targetPath]
    : [];
  return {
    artifactId: `artifact:${randomUUID()}`,
    graphId: input.graphId,
    nodeId: input.nodeId,
    artifactType: 'CapabilityContinuation',
    label,
    preview,
    refs,
    trustLevel: 'trusted',
    taintReasons: [],
    redactionPolicy: 'internal_resume_payload',
    content: {
      type: CAPABILITY_CONTINUATION_ARTIFACT_CONTENT_TYPE,
      payload: cloneCapabilityContinuationPayload(input.payload),
    },
    createdAt: input.createdAt,
  };
}

function readCapabilityContinuationArtifact(
  artifact: ExecutionArtifact | null,
): CapabilityContinuationPayload | null {
  if (!artifact || artifact.artifactType !== 'CapabilityContinuation') return null;
  const content = artifact.content;
  if (!isRecord(content) || content.type !== CAPABILITY_CONTINUATION_ARTIFACT_CONTENT_TYPE || !isRecord(content.payload)) {
    return null;
  }
  return readFilesystemSaveOutputResumePayload(content.payload)
    ?? readAutomationAuthoringResumePayload(content.payload);
}

function createCapabilityContinuationGraphEvent(input: {
  graph: ExecutionGraph;
  nodeId: string;
  kind: ExecutionGraphEvent['kind'];
  payload: Record<string, unknown>;
  eventKey: string;
  timestamp: number;
  sequence: number;
}): ExecutionGraphEvent {
  return createExecutionGraphEvent({
    eventId: `${input.graph.graphId}:capability:${input.eventKey}:${input.sequence}`,
    graphId: input.graph.graphId,
    executionId: input.graph.executionId,
    rootExecutionId: input.graph.rootExecutionId,
    ...(input.graph.parentExecutionId ? { parentExecutionId: input.graph.parentExecutionId } : {}),
    requestId: input.graph.requestId,
    ...(input.graph.runId ? { runId: input.graph.runId } : {}),
    nodeId: input.nodeId,
    nodeKind: 'approval_interrupt',
    kind: input.kind,
    timestamp: input.timestamp,
    sequence: input.sequence,
    producer: 'runtime',
    ...(input.graph.securityContext.channel ? { channel: input.graph.securityContext.channel } : {}),
    ...(input.graph.securityContext.agentId ? { agentId: input.graph.securityContext.agentId } : {}),
    ...(input.graph.securityContext.userId ? { userId: input.graph.securityContext.userId } : {}),
    ...(input.graph.securityContext.codeSessionId ? { codeSessionId: input.graph.securityContext.codeSessionId } : {}),
    payload: input.payload,
  });
}

function buildCapabilityGraphIntent(
  action: Parameters<typeof recordCapabilityContinuationGraphApproval>[0]['action'],
): IntentGatewayDecision {
  return {
    route: (action.route ?? 'general_assistant') as IntentGatewayDecision['route'],
    confidence: 'high',
    operation: (action.operation ?? 'update') as IntentGatewayDecision['operation'],
    summary: action.summary ?? 'Resume a chat capability after approval.',
    turnRelation: (action.turnRelation ?? 'new_request') as IntentGatewayDecision['turnRelation'],
    resolution: (action.resolution ?? 'ready') as IntentGatewayDecision['resolution'],
    missingFields: action.missingFields ?? [],
    executionClass: 'tool_orchestration',
    preferredTier: 'external',
    requiresRepoGrounding: false,
    requiresToolSynthesis: true,
    expectedContextPressure: 'medium',
    preferredAnswerPath: 'tool_loop',
    simpleVsComplex: 'complex',
    ...(action.provenance ? { provenance: action.provenance } : {}),
    entities: action.entities ?? {},
  };
}

function cloneCapabilityContinuationPayload(
  payload: CapabilityContinuationPayload,
): Record<string, unknown> {
  return {
    ...payload,
    ...(payload.codeContext ? { codeContext: { ...payload.codeContext } } : {}),
  };
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
