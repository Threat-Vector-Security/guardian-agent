import type { UserMessage } from '../../agent/types.js';
import type { ExecutionArtifact } from './graph-artifacts.js';
import type { ExecutionGraphSnapshot } from './graph-store.js';
import type { SelectedExecutionProfile } from '../execution-profiles.js';
import type { OrchestrationRoleDescriptor } from '../orchestration-role-descriptors.js';
import type { PendingActionRecord } from '../pending-actions.js';
import type {
  PendingActionApprovalSummary,
  PendingActionIntent,
  PendingActionStore,
} from '../pending-actions.js';
import type {
  SerializedWorkerSuspensionSession,
  WorkerSuspensionResumeContext,
} from '../worker-suspension.js';
import { buildWorkerSuspensionEnvelope } from '../worker-suspension.js';
import type { ExecutionGraphResumePayload } from './pending-action-adapter.js';
import { recordGraphPendingActionInterrupt } from './pending-action-adapter.js';
import { readWorkerSuspensionArtifact } from './worker-suspension-artifact.js';
import { buildWorkerSuspensionArtifact } from './worker-suspension-artifact.js';
import { artifactRefFromArtifact } from './graph-artifacts.js';
import {
  createExecutionGraphEvent,
  type ExecutionGraphEvent,
} from './graph-events.js';
import type { ExecutionArtifactRef } from './types.js';

export interface WorkerSuspensionGraphResumeContext {
  graphId: string;
  executionId: string;
  rootExecutionId: string;
  parentExecutionId?: string;
  requestId: string;
  runId?: string;
  nodeId: string;
  resumeToken: string;
  approvalId: string;
  channel?: string;
  agentId?: string;
  userId?: string;
  codeSessionId?: string;
  resume: WorkerSuspensionResumeContext;
  session: SerializedWorkerSuspensionSession;
  artifactIds: string[];
  sequenceStart: number;
  expiresAt: number;
}

export interface WorkerApprovalContinuationTraceContext {
  sessionId: string;
  agentId: string;
  userId: string;
  surfaceId?: string;
  originalUserContent?: string;
  requestId?: string;
  messageId?: string;
  executionId?: string;
  rootExecutionId?: string;
  originChannel?: string;
  originSurfaceId?: string;
  continuityKey?: string;
  activeExecutionRefs?: string[];
  pendingActionId?: string;
  codeSessionId?: string;
  runClass?: WorkerSuspensionResumeContext['runClass'];
  taskRunId?: string;
  agentName?: string;
  orchestration?: OrchestrationRoleDescriptor;
  executionProfile?: SelectedExecutionProfile;
  principalId: string;
  principalRole: NonNullable<UserMessage['principalRole']>;
  channel: string;
}

export interface WorkerSuspensionResumeWorkerInput {
  id: string;
  workerSessionKey: string;
  sessionId: string;
  agentId: string;
}

export interface WorkerSuspensionResumeRequestInput {
  userId: string;
  message: Pick<UserMessage, 'id' | 'content' | 'surfaceId' | 'channel' | 'principalId' | 'principalRole'>;
  delegation?: {
    requestId?: string;
    executionId?: string;
    rootExecutionId?: string;
    originChannel?: string;
    originSurfaceId?: string;
    continuityKey?: string;
    activeExecutionRefs?: string[];
    pendingActionId?: string;
    codeSessionId?: string;
    runClass?: WorkerSuspensionResumeContext['runClass'];
  };
  executionProfile?: SelectedExecutionProfile;
}

export interface WorkerSuspensionResumeTargetInput {
  agentName?: string;
  orchestration?: OrchestrationRoleDescriptor;
}

export interface WorkerSuspensionGraphEventStore {
  getSnapshot?: (graphId: string) => { events: Array<{ sequence: number }> } | null | undefined;
  appendEvent?: (event: ExecutionGraphEvent) => void;
}

export interface WorkerSuspensionGraphTimeline {
  ingestExecutionGraphEvent?: (event: ExecutionGraphEvent) => void;
}

export interface WorkerSuspensionGraphResumeStore {
  getSnapshot(graphId: string): ExecutionGraphSnapshot | null | undefined;
  getArtifact(graphId: string, artifactId: string): ExecutionArtifact | null | undefined;
}

export interface WorkerSuspensionContinuationGraphStore extends WorkerSuspensionGraphEventStore {
  writeArtifact(artifact: ExecutionArtifact): unknown;
}

export interface WorkerSuspensionContinuationWorkerInput {
  id: string;
  workerSessionKey: string;
}

export interface WorkerSuspensionContinuationApprovalMetadata {
  approvalIds: string[];
  approvalSummaries: PendingActionApprovalSummary[];
  prompt: string;
}

export interface DelegatedWorkerGraphPendingApprovalGraphCompletion {
  metadata: {
    nodeId: string;
  };
  interruptEvent?: ExecutionGraphEvent;
  verificationArtifactRef?: ExecutionArtifactRef;
}

export interface DelegatedWorkerGraphPendingApprovalRequest {
  agentId: string;
  userId: string;
  message: Pick<UserMessage, 'id' | 'content' | 'surfaceId' | 'channel' | 'principalId' | 'principalRole'>;
  delegation?: WorkerSuspensionResumeRequestInput['delegation'];
  executionProfile?: WorkerSuspensionResumeRequestInput['executionProfile'];
}

export interface WorkerSuspensionPendingActionIntentInput extends Omit<Partial<PendingActionIntent>, 'entities'> {
  entities?: unknown;
}

export function buildWorkerSuspensionResumeContext(input: {
  worker: WorkerSuspensionResumeWorkerInput;
  request: WorkerSuspensionResumeRequestInput;
  target: WorkerSuspensionResumeTargetInput;
  taskRunId: string;
  approvalIds: string[];
  expiresAt: number;
}): WorkerSuspensionResumeContext {
  const delegation = input.request.delegation;
  const requestId = delegation?.requestId?.trim() || input.request.message.id;
  const originChannel = delegation?.originChannel?.trim() || input.request.message.channel;
  const originSurfaceId = delegation?.originSurfaceId?.trim() || input.request.message.surfaceId?.trim();
  const continuityKey = delegation?.continuityKey?.trim();
  const pendingActionId = delegation?.pendingActionId?.trim();
  const codeSessionId = delegation?.codeSessionId?.trim();
  const activeExecutionRefs = delegation?.activeExecutionRefs?.length
    ? [...delegation.activeExecutionRefs]
    : undefined;
  const agentName = input.target.agentName?.trim();
  const orchestration = cloneOrchestrationRoleDescriptor(input.target.orchestration);
  return {
    workerId: input.worker.id,
    workerSessionKey: input.worker.workerSessionKey,
    sessionId: input.worker.sessionId,
    agentId: input.worker.agentId,
    userId: input.request.userId,
    ...(input.request.message.surfaceId ? { surfaceId: input.request.message.surfaceId } : {}),
    ...(input.request.message.content ? { originalUserContent: input.request.message.content } : {}),
    requestId,
    messageId: input.request.message.id,
    ...(delegation?.executionId ? { executionId: delegation.executionId } : {}),
    ...(delegation?.rootExecutionId ? { rootExecutionId: delegation.rootExecutionId } : {}),
    originChannel,
    ...(originSurfaceId ? { originSurfaceId } : {}),
    ...(continuityKey ? { continuityKey } : {}),
    ...(activeExecutionRefs ? { activeExecutionRefs } : {}),
    ...(pendingActionId ? { pendingActionId } : {}),
    ...(codeSessionId ? { codeSessionId } : {}),
    ...(delegation?.runClass ? { runClass: delegation.runClass } : {}),
    taskRunId: input.taskRunId,
    ...(agentName ? { agentName } : {}),
    ...(orchestration ? { orchestration } : {}),
    ...(input.request.executionProfile ? { executionProfile: cloneSelectedExecutionProfile(input.request.executionProfile) } : {}),
    principalId: input.request.message.principalId ?? input.request.userId,
    principalRole: input.request.message.principalRole ?? 'owner',
    channel: originChannel,
    approvalIds: [...new Set(input.approvalIds.map((id) => id.trim()).filter(Boolean))],
    expiresAt: input.expiresAt,
  };
}

export function recordWorkerSuspensionGraphContinuationPendingAction(input: {
  store?: Pick<PendingActionStore, 'replaceActive'> | null;
  graphStore?: WorkerSuspensionContinuationGraphStore | null;
  runTimeline?: WorkerSuspensionGraphTimeline;
  suspension: WorkerSuspensionGraphResumeContext;
  worker: WorkerSuspensionContinuationWorkerInput;
  approvalMetadata: WorkerSuspensionContinuationApprovalMetadata | null;
  workerSuspension: SerializedWorkerSuspensionSession | null;
  previousPendingAction: PendingActionRecord;
  now?: () => number;
  ttlMs?: number;
}): PendingActionRecord | null {
  if (!input.store || !input.graphStore || !input.approvalMetadata || !input.workerSuspension) {
    return null;
  }
  const nowMs = input.now?.() ?? Date.now();
  const expiresAt = nowMs + (input.ttlMs ?? 30 * 60_000);
  const event = emitWorkerSuspensionGraphEvent({
    suspension: input.suspension,
    kind: 'interruption_requested',
    payloadDetails: {
      kind: 'approval',
      prompt: input.approvalMetadata.prompt,
      approvalIds: input.approvalMetadata.approvalIds,
      approvalSummaries: input.approvalMetadata.approvalSummaries.map((summary) => ({ ...summary })),
      resumeToken: `${input.suspension.graphId}:${input.suspension.nodeId}:approval:${input.approvalMetadata.approvalIds.join(',')}`,
    },
    eventKey: 'approval-continuation',
    graphStore: input.graphStore,
    runTimeline: input.runTimeline,
    now: input.now,
  });
  const resume = {
    ...input.suspension.resume,
    workerId: input.worker.id,
    workerSessionKey: input.worker.workerSessionKey,
    approvalIds: input.approvalMetadata.approvalIds,
    pendingActionId: input.previousPendingAction.id,
    expiresAt,
  };
  const artifact = buildWorkerSuspensionArtifact({
    graphId: input.suspension.graphId,
    nodeId: input.suspension.nodeId,
    envelope: buildWorkerSuspensionEnvelope({
      resume,
      session: input.workerSuspension,
    }),
    createdAt: nowMs,
  });
  input.graphStore.writeArtifact(artifact);
  return recordGraphPendingActionInterrupt({
    store: input.store,
    scope: input.previousPendingAction.scope,
    event,
    originalUserContent: input.previousPendingAction.intent.originalUserContent,
    intent: input.previousPendingAction.intent,
    artifactRefs: [artifactRefFromArtifact(artifact)],
    approvalSummaries: input.approvalMetadata.approvalSummaries,
    nowMs,
    expiresAt,
  });
}

export function recordDelegatedWorkerGraphPendingApprovalAction(input: {
  store?: Pick<PendingActionStore, 'replaceActive'> | null;
  graphStore?: WorkerSuspensionContinuationGraphStore | null;
  worker: WorkerSuspensionResumeWorkerInput;
  request: DelegatedWorkerGraphPendingApprovalRequest;
  target: WorkerSuspensionResumeTargetInput;
  taskRunId: string;
  graphCompletion?: DelegatedWorkerGraphPendingApprovalGraphCompletion | null;
  approvalMetadata: WorkerSuspensionContinuationApprovalMetadata;
  workerSuspension: SerializedWorkerSuspensionSession | null;
  intentDecision?: WorkerSuspensionPendingActionIntentInput | null;
  now?: () => number;
  ttlMs?: number;
}): PendingActionRecord | null {
  const interruption = input.graphCompletion?.interruptEvent;
  if (!input.store || !input.graphStore || !input.graphCompletion || !interruption || !input.workerSuspension) {
    return null;
  }
  const originChannel = input.request.delegation?.originChannel?.trim()
    || input.request.message.channel;
  const surfaceId = input.request.message.surfaceId?.trim()
    || input.request.delegation?.originSurfaceId?.trim()
    || input.request.message.channel;
  const nowMs = input.now?.() ?? Date.now();
  const expiresAt = nowMs + (input.ttlMs ?? 30 * 60_000);
  const resume = buildWorkerSuspensionResumeContext({
    worker: input.worker,
    request: input.request,
    target: input.target,
    taskRunId: input.taskRunId,
    approvalIds: input.approvalMetadata.approvalIds,
    expiresAt,
  });
  const suspensionArtifact = buildWorkerSuspensionArtifact({
    graphId: interruption.graphId,
    nodeId: interruption.nodeId ?? input.graphCompletion.metadata.nodeId,
    envelope: buildWorkerSuspensionEnvelope({
      resume,
      session: input.workerSuspension,
    }),
    createdAt: nowMs,
  });
  input.graphStore.writeArtifact(suspensionArtifact);
  const artifactRefs = [
    ...(input.graphCompletion.verificationArtifactRef ? [input.graphCompletion.verificationArtifactRef] : []),
    artifactRefFromArtifact(suspensionArtifact),
  ];
  return recordGraphPendingActionInterrupt({
    store: input.store,
    scope: {
      agentId: input.request.agentId,
      userId: input.request.userId,
      channel: originChannel,
      surfaceId,
    },
    event: interruption,
    originalUserContent: input.request.message.content,
    intent: {
      ...(input.intentDecision?.route ? { route: input.intentDecision.route } : {}),
      ...(input.intentDecision?.operation ? { operation: input.intentDecision.operation } : {}),
      ...(input.intentDecision?.summary ? { summary: input.intentDecision.summary } : {}),
      ...(input.intentDecision?.turnRelation ? { turnRelation: input.intentDecision.turnRelation } : {}),
      ...(input.intentDecision?.resolution ? { resolution: input.intentDecision.resolution } : {}),
      ...(input.intentDecision?.missingFields?.length ? { missingFields: input.intentDecision.missingFields } : {}),
      ...(input.intentDecision?.resolvedContent ? { resolvedContent: input.intentDecision.resolvedContent } : {}),
      ...(input.intentDecision?.provenance ? { provenance: input.intentDecision.provenance } : {}),
      ...(input.intentDecision?.entities ? { entities: input.intentDecision.entities as Record<string, unknown> } : {}),
    },
    artifactRefs,
    approvalSummaries: input.approvalMetadata.approvalSummaries,
    nowMs,
    expiresAt,
  });
}

export function reconstructWorkerSuspensionGraphResume(input: {
  pendingAction: PendingActionRecord;
  payload: ExecutionGraphResumePayload | null;
  approvalId: string;
  graphStore?: WorkerSuspensionGraphResumeStore | null;
}): WorkerSuspensionGraphResumeContext | null {
  if (!input.payload || !input.graphStore) return null;
  const snapshot = input.graphStore.getSnapshot(input.payload.graphId);
  if (!snapshot) return null;
  const artifactIds = uniqueStrings([
    ...input.payload.artifactIds,
    ...(input.pendingAction.graphInterrupt?.artifactRefs.map((artifact) => artifact.artifactId) ?? []),
  ]);
  const artifact = artifactIds
    .map((artifactId) => input.graphStore?.getArtifact(input.payload?.graphId ?? '', artifactId))
    .find((candidate) => candidate?.artifactType === 'WorkerSuspension');
  const envelope = readWorkerSuspensionArtifact(artifact);
  if (!envelope || !envelope.resume.approvalIds.includes(input.approvalId)) {
    return null;
  }
  const graph = snapshot.graph;
  const sequenceStart = snapshot.events.reduce(
    (highest, event) => Math.max(highest, event.sequence),
    0,
  );
  return {
    graphId: graph.graphId,
    executionId: graph.executionId,
    rootExecutionId: graph.rootExecutionId,
    ...(graph.parentExecutionId ? { parentExecutionId: graph.parentExecutionId } : {}),
    requestId: graph.requestId,
    ...(graph.runId ? { runId: graph.runId } : {}),
    nodeId: input.payload.nodeId,
    resumeToken: input.payload.resumeToken,
    approvalId: input.approvalId,
    ...(graph.securityContext.channel ? { channel: graph.securityContext.channel } : {}),
    ...(graph.securityContext.agentId ? { agentId: graph.securityContext.agentId } : {}),
    ...(graph.securityContext.userId ? { userId: graph.securityContext.userId } : {}),
    ...(graph.securityContext.codeSessionId ? { codeSessionId: graph.securityContext.codeSessionId } : {}),
    resume: envelope.resume,
    session: envelope.session,
    artifactIds: uniqueStrings([
      ...graph.artifacts.map((artifactRef) => artifactRef.artifactId),
      ...artifactIds,
    ]),
    sequenceStart,
    expiresAt: Math.min(input.pendingAction.expiresAt, envelope.resume.expiresAt, envelope.session.expiresAt),
  };
}

export function workerSuspensionResumeContextToTraceContext(
  resume: WorkerSuspensionResumeContext,
): WorkerApprovalContinuationTraceContext {
  return {
    sessionId: resume.sessionId,
    agentId: resume.agentId,
    userId: resume.userId,
    ...(resume.surfaceId ? { surfaceId: resume.surfaceId } : {}),
    ...(resume.originalUserContent ? { originalUserContent: resume.originalUserContent } : {}),
    ...(resume.requestId ? { requestId: resume.requestId } : {}),
    ...(resume.messageId ? { messageId: resume.messageId } : {}),
    ...(resume.executionId ? { executionId: resume.executionId } : {}),
    ...(resume.rootExecutionId ? { rootExecutionId: resume.rootExecutionId } : {}),
    ...(resume.originChannel ? { originChannel: resume.originChannel } : {}),
    ...(resume.originSurfaceId ? { originSurfaceId: resume.originSurfaceId } : {}),
    ...(resume.continuityKey ? { continuityKey: resume.continuityKey } : {}),
    ...(resume.activeExecutionRefs?.length ? { activeExecutionRefs: [...resume.activeExecutionRefs] } : {}),
    ...(resume.pendingActionId ? { pendingActionId: resume.pendingActionId } : {}),
    ...(resume.codeSessionId ? { codeSessionId: resume.codeSessionId } : {}),
    ...(resume.runClass ? { runClass: resume.runClass } : {}),
    ...(resume.taskRunId ? { taskRunId: resume.taskRunId } : {}),
    ...(resume.agentName ? { agentName: resume.agentName } : {}),
    ...(resume.orchestration ? { orchestration: cloneOrchestrationRoleDescriptor(resume.orchestration) } : {}),
    ...(resume.executionProfile ? { executionProfile: cloneSelectedExecutionProfile(resume.executionProfile) } : {}),
    principalId: resume.principalId,
    principalRole: resume.principalRole,
    channel: resume.channel,
  };
}

export function emitWorkerSuspensionGraphEvent(input: {
  suspension: WorkerSuspensionGraphResumeContext;
  kind: ExecutionGraphEvent['kind'];
  payloadDetails: Record<string, unknown>;
  eventKey: string;
  graphStore?: WorkerSuspensionGraphEventStore;
  runTimeline?: WorkerSuspensionGraphTimeline;
  now?: () => number;
  nodeScoped?: boolean;
}): ExecutionGraphEvent {
  const sequence = nextWorkerSuspensionGraphSequence(
    input.suspension,
    input.graphStore,
  );
  const event = buildWorkerSuspensionGraphEvent({
    suspension: input.suspension,
    kind: input.kind,
    payloadDetails: input.payloadDetails,
    eventKey: input.eventKey,
    sequence,
    timestamp: input.now?.() ?? Date.now(),
    nodeScoped: input.nodeScoped,
  });
  input.runTimeline?.ingestExecutionGraphEvent?.(event);
  input.graphStore?.appendEvent?.(event);
  return event;
}

export function buildWorkerSuspensionGraphEvent(input: {
  suspension: WorkerSuspensionGraphResumeContext;
  kind: ExecutionGraphEvent['kind'];
  payloadDetails: Record<string, unknown>;
  eventKey: string;
  sequence: number;
  timestamp: number;
  nodeScoped?: boolean;
}): ExecutionGraphEvent {
  const nodeScoped = input.nodeScoped ?? true;
  return createExecutionGraphEvent({
    eventId: `${input.suspension.graphId}:worker-resume:${input.eventKey}:${input.sequence}`,
    graphId: input.suspension.graphId,
    executionId: input.suspension.executionId,
    rootExecutionId: input.suspension.rootExecutionId,
    ...(input.suspension.parentExecutionId ? { parentExecutionId: input.suspension.parentExecutionId } : {}),
    requestId: input.suspension.requestId,
    ...(input.suspension.runId ? { runId: input.suspension.runId } : {}),
    ...(nodeScoped ? { nodeId: input.suspension.nodeId, nodeKind: 'delegated_worker' } : {}),
    kind: input.kind,
    timestamp: input.timestamp,
    sequence: input.sequence,
    producer: 'supervisor',
    ...(input.suspension.channel ? { channel: input.suspension.channel } : {}),
    ...(input.suspension.agentId ? { agentId: input.suspension.agentId } : {}),
    ...(input.suspension.userId ? { userId: input.suspension.userId } : {}),
    ...(input.suspension.codeSessionId ? { codeSessionId: input.suspension.codeSessionId } : {}),
    payload: input.payloadDetails,
  });
}

export function nextWorkerSuspensionGraphSequence(
  suspension: Pick<WorkerSuspensionGraphResumeContext, 'graphId' | 'sequenceStart'>,
  graphStore?: WorkerSuspensionGraphEventStore,
): number {
  const snapshot = graphStore?.getSnapshot?.(suspension.graphId);
  if (!snapshot) return suspension.sequenceStart + 1;
  return snapshot.events.reduce(
    (highest, event) => Math.max(highest, event.sequence),
    suspension.sequenceStart,
  ) + 1;
}

function cloneOrchestrationRoleDescriptor(
  descriptor: OrchestrationRoleDescriptor | undefined,
): OrchestrationRoleDescriptor | undefined {
  if (!descriptor) return undefined;
  return {
    role: descriptor.role,
    ...(descriptor.label ? { label: descriptor.label } : {}),
    ...(descriptor.lenses?.length ? { lenses: [...descriptor.lenses] } : {}),
  };
}

function cloneSelectedExecutionProfile(profile: SelectedExecutionProfile): SelectedExecutionProfile {
  return {
    ...profile,
    fallbackProviderOrder: [...profile.fallbackProviderOrder],
  };
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
  }
  return unique;
}
