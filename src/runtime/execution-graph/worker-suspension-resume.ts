import type { UserMessage } from '../../agent/types.js';
import type { SelectedExecutionProfile } from '../execution-profiles.js';
import type { OrchestrationRoleDescriptor } from '../orchestration-role-descriptors.js';
import type {
  SerializedWorkerSuspensionSession,
  WorkerSuspensionResumeContext,
} from '../worker-suspension.js';
import {
  createExecutionGraphEvent,
  type ExecutionGraphEvent,
} from './graph-events.js';

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
