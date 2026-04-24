import { formatPendingApprovalMessage } from '../pending-approval-copy.js';
import {
  defaultPendingActionTransferPolicy,
  type PendingActionApprovalSummary,
  type PendingActionGraphInterrupt,
  type PendingActionIntent,
  type PendingActionRecord,
  type PendingActionScope,
  type PendingActionStore,
  type PendingActionTransferPolicy,
} from '../pending-actions.js';
import type { ExecutionArtifactRef, ExecutionNodeKind } from './types.js';
import type { ExecutionGraphEvent } from './graph-events.js';

export interface ExecutionGraphResumePayload {
  graphId: string;
  nodeId: string;
  nodeKind?: ExecutionNodeKind;
  resumeToken: string;
  artifactIds: string[];
}

export interface RecordGraphPendingActionInterruptInput {
  store: Pick<PendingActionStore, 'replaceActive'>;
  scope: PendingActionScope;
  event: ExecutionGraphEvent;
  originalUserContent: string;
  intent?: Partial<PendingActionIntent>;
  artifactRefs?: ExecutionArtifactRef[];
  approvalSummaries?: PendingActionApprovalSummary[];
  transferPolicy?: PendingActionTransferPolicy;
  nowMs?: number;
  expiresAt?: number;
}

const DEFAULT_PENDING_ACTION_TTL_MS = 30 * 60_000;

export function recordGraphPendingActionInterrupt(
  input: RecordGraphPendingActionInterruptInput,
): PendingActionRecord | null {
  if (input.event.kind !== 'approval_requested') {
    return null;
  }
  const approvalIds = readApprovalIds(input.event.payload);
  const approvalSummaries = normalizeApprovalSummaries(input.approvalSummaries, approvalIds, input.event.payload);
  const graphInterrupt = buildGraphInterrupt({
    event: input.event,
    artifactRefs: input.artifactRefs ?? [],
  });
  const nowMs = input.nowMs ?? Date.now();
  const prompt = readString(input.event.payload.prompt)
    || readString(input.event.payload.summary)
    || (approvalSummaries.length > 0 ? formatPendingApprovalMessage(approvalSummaries) : '')
    || 'Approval required for the pending graph action.';
  const resume = buildExecutionGraphResumePayload(graphInterrupt);
  return input.store.replaceActive(input.scope, {
    status: 'pending',
    transferPolicy: input.transferPolicy ?? defaultPendingActionTransferPolicy('approval'),
    blocker: {
      kind: 'approval',
      prompt,
      ...(approvalIds.length > 0 ? { approvalIds } : {}),
      ...(approvalSummaries.length > 0 ? { approvalSummaries } : {}),
      metadata: {
        graphId: graphInterrupt.graphId,
        nodeId: graphInterrupt.nodeId,
        resumeToken: graphInterrupt.resumeToken,
      },
    },
    intent: {
      ...(input.intent?.route ? { route: input.intent.route } : {}),
      ...(input.intent?.operation ? { operation: input.intent.operation } : {}),
      ...(input.intent?.summary ? { summary: input.intent.summary } : {}),
      ...(input.intent?.turnRelation ? { turnRelation: input.intent.turnRelation } : {}),
      ...(input.intent?.resolution ? { resolution: input.intent.resolution } : {}),
      ...(input.intent?.missingFields?.length ? { missingFields: [...input.intent.missingFields] } : {}),
      originalUserContent: input.intent?.originalUserContent ?? input.originalUserContent,
      ...(input.intent?.resolvedContent ? { resolvedContent: input.intent.resolvedContent } : {}),
      ...(input.intent?.provenance ? { provenance: input.intent.provenance } : {}),
      ...(input.intent?.entities ? { entities: { ...input.intent.entities } } : {}),
    },
    resume: {
      kind: 'execution_graph',
      payload: {
        ...resume,
      },
    },
    graphInterrupt,
    executionId: input.event.executionId,
    rootExecutionId: input.event.rootExecutionId,
    ...(input.event.codeSessionId ? { codeSessionId: input.event.codeSessionId } : {}),
    expiresAt: input.expiresAt ?? nowMs + DEFAULT_PENDING_ACTION_TTL_MS,
  }, nowMs);
}

export function buildExecutionGraphResumePayload(
  interrupt: PendingActionGraphInterrupt,
): ExecutionGraphResumePayload {
  return {
    graphId: interrupt.graphId,
    nodeId: interrupt.nodeId,
    ...(interrupt.nodeKind ? { nodeKind: interrupt.nodeKind } : {}),
    resumeToken: interrupt.resumeToken,
    artifactIds: interrupt.artifactRefs.map((artifact) => artifact.artifactId),
  };
}

export function readExecutionGraphResumePayload(value: unknown): ExecutionGraphResumePayload | null {
  if (!isRecord(value)) return null;
  const graphId = readString(value.graphId);
  const nodeId = readString(value.nodeId);
  const resumeToken = readString(value.resumeToken);
  if (!graphId || !nodeId || !resumeToken) return null;
  return {
    graphId,
    nodeId,
    ...(readExecutionNodeKind(value.nodeKind) ? { nodeKind: readExecutionNodeKind(value.nodeKind) } : {}),
    resumeToken,
    artifactIds: Array.isArray(value.artifactIds)
      ? value.artifactIds
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
      : [],
  };
}

function buildGraphInterrupt(input: {
  event: ExecutionGraphEvent;
  artifactRefs: ExecutionArtifactRef[];
}): PendingActionGraphInterrupt {
  const resumeToken = readString(input.event.payload.resumeToken)
    || `${input.event.graphId}:${input.event.nodeId ?? 'graph'}:${input.event.sequence}`;
  return {
    graphId: input.event.graphId,
    nodeId: input.event.nodeId ?? input.event.graphId,
    ...(input.event.nodeKind ? { nodeKind: input.event.nodeKind } : {}),
    resumeToken,
    artifactRefs: input.artifactRefs.map((artifact) => ({
      ...artifact,
      ...(artifact.taintReasons ? { taintReasons: [...artifact.taintReasons] } : {}),
    })),
  };
}

function readApprovalIds(payload: Record<string, unknown>): string[] {
  const ids = new Set<string>();
  const single = readString(payload.approvalId);
  if (single) ids.add(single);
  if (Array.isArray(payload.approvalIds)) {
    for (const item of payload.approvalIds) {
      const approvalId = readString(item);
      if (approvalId) ids.add(approvalId);
    }
  }
  return [...ids];
}

function normalizeApprovalSummaries(
  summaries: PendingActionApprovalSummary[] | undefined,
  approvalIds: string[],
  payload: Record<string, unknown>,
): PendingActionApprovalSummary[] {
  const normalized = (summaries ?? [])
    .map((summary) => ({
      id: summary.id.trim(),
      toolName: summary.toolName.trim(),
      argsPreview: summary.argsPreview,
      ...(summary.actionLabel ? { actionLabel: summary.actionLabel } : {}),
      ...(summary.requestId ? { requestId: summary.requestId } : {}),
      ...(summary.codeSessionId ? { codeSessionId: summary.codeSessionId } : {}),
    }))
    .filter((summary) => summary.id && summary.toolName);
  if (normalized.length > 0 || approvalIds.length === 0) {
    return normalized;
  }
  const toolName = readString(payload.toolName) || 'unknown';
  const path = readString(payload.path);
  const argsPreview = path ? JSON.stringify({ path }) : '';
  return approvalIds.map((approvalId) => ({
    id: approvalId,
    toolName,
    argsPreview,
    actionLabel: toolName === 'unknown' ? 'approve graph action' : `approve ${toolName}`,
  }));
}

function readExecutionNodeKind(value: unknown): ExecutionNodeKind | undefined {
  switch (value) {
    case 'classify':
    case 'plan':
    case 'explore_readonly':
    case 'synthesize':
    case 'mutate':
    case 'approval_interrupt':
    case 'delegated_worker':
    case 'verify':
    case 'recover':
    case 'finalize':
      return value;
    default:
      return undefined;
  }
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
