import type { PlaybookRunRecord } from './connectors.js';
import type { CodingBackendProgressEvent } from './coding-backend-service.js';
import type {
  CodeSessionPendingApproval,
  CodeSessionRecentJob,
  CodeSessionRecord,
  CodeSessionVerificationEntry,
} from './code-sessions.js';
import type { CodeSessionWorkflowState, CodeSessionWorkflowStage } from './coding-workflows.js';
import type { AssistantDispatchTrace, WorkflowTraceNode } from './orchestrator.js';
import type { ExecutionEvent } from './execution/types.js';
import type { ExecutionGraphEvent } from './execution-graph/graph-events.js';
import { projectExecutionGraphEventToTimeline } from './execution-graph/timeline-adapter.js';
import type { OrchestrationCoreRole } from './orchestration-role-descriptors.js';
import type { OrchestrationRunEvent } from './run-events.js';
import type { ScheduledTaskHistoryEntry } from './scheduled-tasks.js';
import { runDetailMatchesContextFilters } from './trace-context-filters.js';
import { redactSensitiveText } from '../util/crypto-guardrails.js';
import type {
  DelegatedWorkerOperatorAction,
  DelegatedWorkerOperatorFollowUpState,
} from './assistant-jobs.js';

export type DashboardRunStatus =
  | 'queued'
  | 'running'
  | 'awaiting_approval'
  | 'verification_pending'
  | 'blocked'
  | 'interrupted'
  | 'cancelled'
  | 'completed'
  | 'failed';

export type DashboardRunKind =
  | 'assistant_dispatch'
  | 'delegated_task'
  | 'automation_run'
  | 'code_session'
  | 'scheduled_task';

export type DashboardRunTimelineItemType =
  | 'run_queued'
  | 'run_started'
  | 'tool_call_started'
  | 'tool_call_completed'
  | 'approval_requested'
  | 'approval_resolved'
  | 'handoff_started'
  | 'handoff_completed'
  | 'verification_pending'
  | 'verification_completed'
  | 'note'
  | 'run_completed'
  | 'run_failed';

export interface DashboardRunTimelineItem {
  id: string;
  runId: string;
  timestamp: number;
  type: DashboardRunTimelineItemType;
  status: 'info' | 'running' | 'blocked' | 'succeeded' | 'failed' | 'warning';
  source: 'orchestrator' | 'workflow' | 'code_session' | 'system' | 'execution_graph';
  title: string;
  detail?: string;
  graphId?: string;
  graphEventKind?: string;
  graphProducer?: string;
  graphSequence?: number;
  graphDetail?: DashboardRunTimelineGraphDetail;
  nodeId?: string;
  nodeKind?: string;
  toolName?: string;
  approvalId?: string;
  verificationKind?: 'test' | 'lint' | 'build' | 'manual';
  contextAssembly?: DashboardRunTimelineContextAssembly;
}

export interface DashboardRunTimelineGraphDetailField {
  label: string;
  value: string;
}

export interface DashboardRunTimelineGraphDetail {
  fields: DashboardRunTimelineGraphDetailField[];
}

export interface DashboardRunTimelineContextMemoryEntry {
  scope?: 'global' | 'coding_session';
  category: string;
  createdAt: string;
  preview: string;
  renderMode: 'full' | 'summary';
  queryScore: number;
  isContextFlush: boolean;
  matchReasons?: string[];
}

export interface DashboardRunTimelineContextSectionFootprint {
  section: string;
  chars: number;
  included: boolean;
  mode?: string;
  itemCount?: number;
}

export interface DashboardRunTimelinePreservedExecutionState {
  objective?: string;
  blockerSummary?: string;
  activeExecutionRefs?: string[];
  maintainedSummarySource?: string;
}

export interface DashboardRunTimelineSkillArtifactReference {
  skillId: string;
  scope: 'global' | 'coding_session';
  slug: string;
  title: string;
  sourceClass: string;
}

export interface DashboardRunTimelineContextAssembly {
  summary?: string;
  detail?: string;
  memoryScope?: 'global' | 'coding_session' | 'none';
  knowledgeBaseLoaded?: boolean;
  codingMemoryLoaded?: boolean;
  codingMemoryChars?: number;
  knowledgeBaseQueryPreview?: string;
  continuityKey?: string;
  activeExecutionRefs?: string[];
  orchestrationRole?: OrchestrationCoreRole;
  orchestrationLabel?: string;
  orchestrationLenses?: string[];
  linkedSurfaceCount?: number;
  skillInstructionSkillIds?: string[];
  skillResourceSkillIds?: string[];
  skillResourcePaths?: string[];
  skillPromptCacheHitCount?: number;
  skillPromptCacheHits?: string[];
  skillPromptLoadReasons?: string[];
  skillArtifactReferences?: DashboardRunTimelineSkillArtifactReference[];
  selectedMemoryEntryCount?: number;
  omittedMemoryEntryCount?: number;
  selectedMemoryEntries?: DashboardRunTimelineContextMemoryEntry[];
  contextCompactionApplied?: boolean;
  contextCharsBeforeCompaction?: number;
  contextCharsAfterCompaction?: number;
  contextCompactionStages?: string[];
  compactedSummaryPreview?: string;
  sectionFootprints?: DashboardRunTimelineContextSectionFootprint[];
  preservedExecutionState?: DashboardRunTimelinePreservedExecutionState;
}

export interface DashboardRunLiveSummaryItem {
  title: string;
  detail?: string;
}

export interface DashboardRunLiveSummary {
  label: string;
  items: DashboardRunLiveSummaryItem[];
}

export interface DashboardRunSummary {
  runId: string;
  parentRunId?: string;
  executionId?: string;
  parentExecutionId?: string;
  rootExecutionId?: string;
  groupId: string;
  kind: DashboardRunKind;
  status: DashboardRunStatus;
  title: string;
  subtitle?: string;
  agentId?: string | null;
  channel?: string;
  sessionId?: string;
  codeSessionId?: string;
  requestType?: string;
  startedAt: number;
  completedAt?: number;
  lastUpdatedAt: number;
  durationMs?: number;
  pendingApprovalCount: number;
  verificationPendingCount: number;
  error?: string;
  tags: string[];
}

export interface DashboardRunDetail {
  summary: DashboardRunSummary;
  items: DashboardRunTimelineItem[];
  liveSummary: DashboardRunLiveSummary;
}

export interface DashboardRunListResponse {
  runs: DashboardRunDetail[];
}

export interface DashboardCodeSessionTimelineResponse {
  codeSessionId: string;
  runs: DashboardRunDetail[];
}

export type RunTimelineListener = (detail: DashboardRunDetail) => void;

export interface RunTimelineListFilters {
  limit?: number;
  status?: DashboardRunStatus;
  kind?: DashboardRunKind;
  parentRunId?: string;
  executionId?: string;
  parentExecutionId?: string;
  rootExecutionId?: string;
  taskExecutionId?: string;
  graphEventKind?: string;
  graphNodeKind?: string;
  graphProducer?: string;
  toolName?: string;
  runClass?: string;
  reportingMode?: string;
  unresolvedBlockerKind?: string;
  channel?: string;
  agentId?: string;
  codeSessionId?: string;
  continuityKey?: string;
  activeExecutionRef?: string;
}

export interface RunTimelineStoreOptions {
  maxRuns?: number;
  maxItemsPerRun?: number;
  completedRetentionMs?: number;
  now?: () => number;
}

export interface DelegatedWorkerProgressEvent {
  id: string;
  kind: 'started' | 'running' | 'completed' | 'blocked' | 'failed' | 'followup_action';
  requestId?: string;
  parentRunId?: string;
  runId?: string;
  executionId?: string;
  parentExecutionId?: string;
  rootExecutionId?: string;
  taskRunId?: string;
  taskExecutionId?: string;
  codeSessionId?: string;
  agentId: string;
  agentName?: string;
  orchestrationRole?: OrchestrationCoreRole;
  orchestrationLabel?: string;
  orchestrationLenses?: string[];
  executionProfileName?: string;
  executionProfileModel?: string;
  executionProfileTier?: string;
  originChannel?: string;
  runClass?: string;
  unresolvedBlockerKind?: string;
  approvalCount?: number;
  reportingMode?: string;
  operatorAction?: DelegatedWorkerOperatorAction;
  operatorState?: DelegatedWorkerOperatorFollowUpState;
  workerId?: string;
  requestPreview?: string;
  detail?: string;
  continuityKey?: string;
  activeExecutionRefs?: string[];
  timestamp: number;
}

interface RunTimelineRecord {
  baseStatus: DashboardRunStatus;
  detail: DashboardRunDetail;
  signature: string;
}

interface PendingApprovalState {
  approvalId: string;
  runId: string;
  toolName: string;
  createdAt: number;
}

const DEFAULT_MAX_RUNS = 200;
const DEFAULT_MAX_ITEMS_PER_RUN = 300;
const DEFAULT_COMPLETED_RETENTION_MS = 24 * 60 * 60 * 1000;

export class RunTimelineStore {
  private readonly runs = new Map<string, RunTimelineRecord>();
  private readonly listeners = new Set<RunTimelineListener>();
  private readonly sessionPendingApprovals = new Map<string, Map<string, PendingApprovalState>>();
  private readonly maxRuns: number;
  private readonly maxItemsPerRun: number;
  private readonly completedRetentionMs: number;
  private readonly now: () => number;

  constructor(options: RunTimelineStoreOptions = {}) {
    this.maxRuns = options.maxRuns ?? DEFAULT_MAX_RUNS;
    this.maxItemsPerRun = options.maxItemsPerRun ?? DEFAULT_MAX_ITEMS_PER_RUN;
    this.completedRetentionMs = options.completedRetentionMs ?? DEFAULT_COMPLETED_RETENTION_MS;
    this.now = options.now ?? Date.now;
  }

  subscribe(listener: RunTimelineListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  listRuns(filters: RunTimelineListFilters = {}): DashboardRunDetail[] {
    return this.sortedRuns()
      .filter((detail) => {
        if (filters.status && detail.summary.status !== filters.status) return false;
        if (filters.kind && detail.summary.kind !== filters.kind) return false;
        if (filters.parentRunId && detail.summary.parentRunId !== filters.parentRunId) return false;
        if (filters.executionId && detail.summary.executionId !== filters.executionId) return false;
        if (filters.parentExecutionId && detail.summary.parentExecutionId !== filters.parentExecutionId) return false;
        if (filters.rootExecutionId && detail.summary.rootExecutionId !== filters.rootExecutionId) return false;
        if (filters.taskExecutionId && detail.summary.executionId !== filters.taskExecutionId) return false;
        if (filters.graphEventKind && !detail.items.some((item) => item.graphEventKind === filters.graphEventKind)) return false;
        if (filters.graphNodeKind && !detail.items.some((item) => item.nodeKind === filters.graphNodeKind)) return false;
        if (filters.graphProducer && !detail.items.some((item) => item.graphProducer === filters.graphProducer)) return false;
        if (filters.toolName && !detail.items.some((item) => item.toolName === filters.toolName)) return false;
        if (filters.runClass && !runSummaryHasTag(detail, filters.runClass)) return false;
        if (filters.reportingMode && !runSummaryHasTag(detail, `reporting:${filters.reportingMode}`)) return false;
        if (filters.unresolvedBlockerKind && !runSummaryHasTag(detail, `blocker:${filters.unresolvedBlockerKind}`)) return false;
        if (filters.channel && detail.summary.channel !== filters.channel) return false;
        if (filters.agentId && detail.summary.agentId !== filters.agentId) return false;
        if (filters.codeSessionId && detail.summary.codeSessionId !== filters.codeSessionId) return false;
        if (!runDetailMatchesContextFilters(detail, filters)) return false;
        return true;
      })
      .slice(0, Math.max(1, filters.limit ?? 20))
      .map(cloneDetail);
  }

  getRun(runId: string): DashboardRunDetail | null {
    const normalizedRunId = runId.trim();
    if (!normalizedRunId) return null;
    const record = this.runs.get(normalizedRunId);
    return record ? cloneDetail(record.detail) : null;
  }

  listRunsForCodeSession(codeSessionId: string, limit = 20): DashboardRunDetail[] {
    return this.listRuns({ codeSessionId, limit });
  }

  ingestAssistantTrace(trace: AssistantDispatchTrace): void {
    const items = buildAssistantTraceItems(trace);
    this.commitRun(trace.runId, {
      baseStatus: mapAssistantTraceStatus(trace.status),
      summary: {
        parentRunId: trace.parentRunId,
        groupId: trace.groupId,
        kind: 'assistant_dispatch',
        title: summarizeRunTitle(trace.requestType, trace.messagePreview),
        subtitle: sanitizePreview(trace.responsePreview),
        agentId: trace.agentId,
        channel: trace.channel,
        sessionId: trace.sessionId,
        requestType: trace.requestType,
        startedAt: trace.startedAt ?? trace.queuedAt,
        completedAt: trace.completedAt,
        error: sanitizeTimelineText(trace.error),
        tags: [trace.channel, trace.requestType],
      },
      items,
    });
  }

  ingestCodeSession(session: CodeSessionRecord): void {
    const approvals = Array.isArray(session.workState.pendingApprovals)
      ? session.workState.pendingApprovals
      : [];
    const jobs = Array.isArray(session.workState.recentJobs)
      ? session.workState.recentJobs
      : [];
    const verification = Array.isArray(session.workState.verification)
      ? session.workState.verification
      : [];
    const workflow = session.workState.workflow ?? null;

    const touchedRunIds = new Set<string>();
    const pendingCounts = new Map<string, number>();
    const verificationPendingCounts = new Map<string, number>();
    const currentPending = new Map<string, PendingApprovalState>();

    for (const approval of approvals) {
      const runId = resolveRunId(session.id, approval.requestId);
      touchedRunIds.add(runId);
      pendingCounts.set(runId, (pendingCounts.get(runId) ?? 0) + 1);
      currentPending.set(approval.id, {
        approvalId: approval.id,
        runId,
        toolName: approval.toolName,
        createdAt: approval.createdAt ?? session.updatedAt,
      });

      const existing = this.runs.get(runId);
      this.commitRun(runId, {
        ...(shouldUseCodeSessionBaseStatus(existing) ? { baseStatus: deriveCodeSessionBaseStatus(runId, approvals, jobs, verification, session) } : {}),
        summary: buildCodeSessionSummaryPatch(session, existing?.detail.summary),
        items: [buildPendingApprovalItem(runId, approval, session.updatedAt)],
      });
    }

    const previousPending = this.sessionPendingApprovals.get(session.id) ?? new Map<string, PendingApprovalState>();
    for (const [approvalId, previous] of previousPending.entries()) {
      if (currentPending.has(approvalId)) continue;
      touchedRunIds.add(previous.runId);
      const relatedJob = jobs.find((job) => job.approvalId === approvalId);
      this.commitRun(previous.runId, {
        summary: buildCodeSessionSummaryPatch(session, this.runs.get(previous.runId)?.detail.summary),
        items: [buildApprovalResolvedItem(previous.runId, approvalId, previous.toolName, relatedJob, session.updatedAt)],
      });
    }
    this.sessionPendingApprovals.set(session.id, currentPending);

    for (const job of jobs) {
      const runId = resolveRunId(session.id, job.requestId);
      const existing = this.runs.get(runId);
      touchedRunIds.add(runId);
      this.commitRun(runId, {
        ...(shouldUseCodeSessionBaseStatus(existing) ? { baseStatus: deriveCodeSessionBaseStatus(runId, approvals, jobs, verification, session) } : {}),
        summary: buildCodeSessionSummaryPatch(session, existing?.detail.summary),
        items: buildJobItems(runId, job, session.updatedAt),
      });
    }

    for (const entry of verification) {
      const runId = resolveRunId(session.id, entry.requestId);
      const existing = this.runs.get(runId);
      touchedRunIds.add(runId);
      if (entry.status === 'not_run') {
        verificationPendingCounts.set(runId, (verificationPendingCounts.get(runId) ?? 0) + 1);
      }
      this.commitRun(runId, {
        ...(shouldUseCodeSessionBaseStatus(existing) ? { baseStatus: deriveCodeSessionBaseStatus(runId, approvals, jobs, verification, session) } : {}),
        summary: buildCodeSessionSummaryPatch(session, existing?.detail.summary),
        items: [buildVerificationItem(runId, entry)],
      });
    }

    if (workflow) {
      touchedRunIds.add(resolveRunId(session.id, undefined));
    }

    for (const runId of touchedRunIds) {
      const existing = this.runs.get(runId);
      this.commitRun(runId, {
        ...(shouldUseCodeSessionBaseStatus(existing) ? { baseStatus: deriveCodeSessionBaseStatus(runId, approvals, jobs, verification, session) } : {}),
        summary: {
          ...buildCodeSessionSummaryPatch(session, existing?.detail.summary),
          pendingApprovalCount: pendingCounts.get(runId) ?? 0,
          verificationPendingCount: verificationPendingCounts.get(runId) ?? 0,
        },
        ...(workflow ? { items: [buildCodeWorkflowStageItem(runId, workflow)] } : {}),
      });
    }
  }

  ingestCodingBackendProgress(event: CodingBackendProgressEvent): void {
    const runId = nonEmptyText(event.runId) ?? resolveRunId(event.codeSessionId, event.requestId);
    const existing = this.runs.get(runId);
    const shouldSetBaseStatus = shouldUseCodeSessionBaseStatus(existing);
    const summary = existing?.detail.summary;

    this.commitRun(runId, {
      ...(shouldSetBaseStatus
        ? { baseStatus: mapCodingBackendProgressStatus(event.kind) }
        : {}),
      summary: {
        codeSessionId: event.codeSessionId,
        groupId: summary?.groupId ?? `code-session:${event.codeSessionId}`,
        kind: summary?.kind ?? 'code_session',
        title: summary?.title ?? `Coding backend: ${event.backendName}`,
        subtitle: summary?.subtitle ?? truncateText(event.task, 160),
        startedAt: summary?.startedAt ?? event.timestamp,
        tags: ['coding-backend', event.backendId],
      },
      items: [buildCodingBackendProgressItem(runId, event)],
    });
  }

  ingestDelegatedWorkerProgress(event: DelegatedWorkerProgressEvent): void {
    const parentRunId = nonEmptyText(event.parentRunId)
      ?? nonEmptyText(event.runId)
      ?? nonEmptyText(event.requestId)
      ?? (event.codeSessionId ? resolveRunId(event.codeSessionId, undefined) : undefined);
    if (!parentRunId) return;
    const parentExecutionId = nonEmptyText(event.executionId)
      ?? nonEmptyText(event.parentExecutionId)
      ?? nonEmptyText(event.rootExecutionId)
      ?? nonEmptyText(event.requestId)
      ?? parentRunId;
    const rootExecutionId = nonEmptyText(event.rootExecutionId)
      ?? parentExecutionId;
    const existing = this.runs.get(parentRunId);
    const shouldSetBaseStatus = shouldUseCodeSessionBaseStatus(existing);
    const summary = existing?.detail.summary;

    this.commitRun(parentRunId, {
      ...(shouldSetBaseStatus
        ? { baseStatus: mapDelegatedWorkerProgressStatus(event) }
        : {}),
      summary: {
        ...(parentExecutionId ? { executionId: parentExecutionId } : {}),
        ...(rootExecutionId ? { rootExecutionId } : {}),
        ...(event.codeSessionId ? { codeSessionId: event.codeSessionId } : {}),
        groupId: summary?.groupId ?? (event.codeSessionId ? `code-session:${event.codeSessionId}` : parentRunId),
        kind: summary?.kind ?? (event.codeSessionId ? 'code_session' : 'assistant_dispatch'),
        title: summary?.title ?? `Delegated worker: ${describeDelegatedWorkerTarget(event)}`,
        subtitle: summary?.subtitle ?? truncateText(nonEmptyText(event.requestPreview), 160),
        agentId: summary?.agentId ?? event.agentId,
        channel: summary?.channel ?? event.originChannel,
        startedAt: summary?.startedAt ?? event.timestamp,
        tags: [
          'delegated-worker',
          event.agentId,
          ...(event.originChannel ? [event.originChannel] : []),
          ...(event.runClass ? [event.runClass] : []),
          ...(event.reportingMode ? [`reporting:${event.reportingMode}`] : []),
          ...(event.unresolvedBlockerKind ? [`blocker:${event.unresolvedBlockerKind}`] : []),
          ...buildDelegatedWorkerOrchestrationTags(event),
        ],
      },
      items: [buildDelegatedWorkerProgressItem(parentRunId, event)],
    });

    const taskRunId = nonEmptyText(event.taskRunId);
    if (!taskRunId) return;

    const parentSummary = this.runs.get(parentRunId)?.detail.summary;
    const delegatedTask = this.runs.get(taskRunId);
    const taskExecutionId = nonEmptyText(event.taskExecutionId)
      ?? taskRunId;
    const delegatedParentExecutionId = parentSummary?.executionId
      ?? parentExecutionId;
    const delegatedRootExecutionId = parentSummary?.rootExecutionId
      ?? rootExecutionId
      ?? delegatedParentExecutionId;
    this.commitRun(taskRunId, {
      baseStatus: mapDelegatedWorkerProgressStatus(event),
      summary: {
        parentRunId,
        ...(taskExecutionId ? { executionId: taskExecutionId } : {}),
        ...(delegatedParentExecutionId ? { parentExecutionId: delegatedParentExecutionId } : {}),
        ...(delegatedRootExecutionId ? { rootExecutionId: delegatedRootExecutionId } : {}),
        ...(event.codeSessionId ? { codeSessionId: event.codeSessionId } : {}),
        groupId: parentSummary?.groupId ?? (event.codeSessionId ? `code-session:${event.codeSessionId}` : parentRunId),
        kind: 'delegated_task',
        title: delegatedTask?.detail.summary.title ?? `Delegated task: ${describeDelegatedWorkerTarget(event)}`,
        subtitle: buildDelegatedWorkerTaskSubtitle(event, parentRunId),
        agentId: event.agentId,
        channel: event.originChannel,
        startedAt: delegatedTask?.detail.summary.startedAt ?? event.timestamp,
        pendingApprovalCount: event.kind === 'blocked' && event.unresolvedBlockerKind === 'approval'
          ? Math.max(0, event.approvalCount ?? 0)
          : 0,
        verificationPendingCount: 0,
        error: event.kind === 'failed' ? sanitizeTimelineText(event.detail) : undefined,
        tags: [
          'delegated-worker',
          'delegated-task',
          event.agentId,
          ...(event.originChannel ? [event.originChannel] : []),
          ...(event.runClass ? [event.runClass] : []),
          ...(event.reportingMode ? [`reporting:${event.reportingMode}`] : []),
          ...(event.unresolvedBlockerKind ? [`blocker:${event.unresolvedBlockerKind}`] : []),
          ...buildDelegatedWorkerOrchestrationTags(event),
        ],
      },
      items: [buildDelegatedWorkerProgressItem(taskRunId, event)],
    });
  }

  ingestDelegatedExecutionEvents(input: {
    parentRunId: string;
    taskRunId?: string;
    parentExecutionId?: string;
    taskExecutionId?: string;
    rootExecutionId?: string;
    codeSessionId?: string;
    agentId?: string;
    channel?: string;
    events: ExecutionEvent[];
  }): void {
    const parentRunId = nonEmptyText(input.parentRunId);
    if (!parentRunId || !Array.isArray(input.events) || input.events.length <= 0) {
      return;
    }
    const normalizedEvents = input.events
      .filter((event) => !!event && typeof event.eventId === 'string' && typeof event.type === 'string')
      .sort((left, right) => left.timestamp - right.timestamp);
    if (normalizedEvents.length <= 0) {
      return;
    }

    const parentSummary = this.runs.get(parentRunId)?.detail.summary;
    const taskRunId = nonEmptyText(input.taskRunId);
    const taskSummary = taskRunId ? this.runs.get(taskRunId)?.detail.summary : undefined;
    const parentItems = normalizedEvents.map((event) => buildDelegatedExecutionEventItem(parentRunId, event));
    this.commitRun(parentRunId, {
      summary: {
        ...(nonEmptyText(input.parentExecutionId) ? { executionId: nonEmptyText(input.parentExecutionId) } : {}),
        ...(nonEmptyText(input.rootExecutionId) ? { rootExecutionId: nonEmptyText(input.rootExecutionId) } : {}),
        ...(nonEmptyText(input.codeSessionId) ? { codeSessionId: nonEmptyText(input.codeSessionId) } : {}),
        groupId: parentSummary?.groupId ?? (input.codeSessionId ? `code-session:${input.codeSessionId}` : parentRunId),
        kind: parentSummary?.kind ?? (input.codeSessionId ? 'code_session' : 'assistant_dispatch'),
        title: parentSummary?.title ?? 'Delegated worker activity',
        ...(parentSummary?.subtitle ? { subtitle: parentSummary.subtitle } : {}),
        ...(parentSummary?.agentId ?? input.agentId ? { agentId: parentSummary?.agentId ?? input.agentId } : {}),
        ...(parentSummary?.channel ?? input.channel ? { channel: parentSummary?.channel ?? input.channel } : {}),
        startedAt: parentSummary?.startedAt ?? normalizedEvents[0].timestamp,
        tags: mergeTags(parentSummary?.tags ?? [], ['delegated-worker', 'execution-events']),
      },
      items: parentItems,
    });

    if (!taskRunId) {
      return;
    }

    const taskItems = normalizedEvents.map((event) => buildDelegatedExecutionEventItem(taskRunId, event));
    this.commitRun(taskRunId, {
      summary: {
        parentRunId,
        ...(nonEmptyText(input.taskExecutionId) ? { executionId: nonEmptyText(input.taskExecutionId) } : {}),
        ...(nonEmptyText(input.parentExecutionId) ? { parentExecutionId: nonEmptyText(input.parentExecutionId) } : {}),
        ...(nonEmptyText(input.rootExecutionId) ? { rootExecutionId: nonEmptyText(input.rootExecutionId) } : {}),
        ...(nonEmptyText(input.codeSessionId) ? { codeSessionId: nonEmptyText(input.codeSessionId) } : {}),
        groupId: taskSummary?.groupId ?? parentSummary?.groupId ?? (input.codeSessionId ? `code-session:${input.codeSessionId}` : parentRunId),
        kind: 'delegated_task',
        title: taskSummary?.title ?? 'Delegated task',
        ...(taskSummary?.subtitle ? { subtitle: taskSummary.subtitle } : {}),
        ...(taskSummary?.agentId ?? input.agentId ? { agentId: taskSummary?.agentId ?? input.agentId } : {}),
        ...(taskSummary?.channel ?? input.channel ? { channel: taskSummary?.channel ?? input.channel } : {}),
        startedAt: taskSummary?.startedAt ?? normalizedEvents[0].timestamp,
        tags: mergeTags(taskSummary?.tags ?? [], ['delegated-worker', 'execution-events']),
      },
      items: taskItems,
    });
  }

  ingestExecutionGraphEvent(event: ExecutionGraphEvent): void {
    const projection = projectExecutionGraphEventToTimeline(event);
    if (!projection) return;
    this.commitRun(projection.runId, {
      ...(projection.baseStatus ? { baseStatus: projection.baseStatus } : {}),
      summary: projection.summary,
      items: projection.items,
    });
  }

  syncPlaybookRuns(runs: PlaybookRunRecord[]): void {
    for (const run of Array.isArray(runs) ? runs : []) {
      this.commitRun(run.runId, {
        baseStatus: mapPlaybookStatus(run.status),
        summary: {
          groupId: run.playbookId,
          kind: 'automation_run',
          title: `Automation: ${run.playbookName}`,
          subtitle: sanitizeTimelineText(run.message),
          agentId: run.requestedBy ?? undefined,
          channel: run.origin,
          startedAt: run.startedAt,
          completedAt: run.completedAt,
          durationMs: run.durationMs,
          tags: ['automation', run.origin, run.playbookId],
        },
        items: buildWorkflowEventItems(run.runId, run.events, 'workflow'),
      });
    }
  }

  syncScheduledTaskHistory(entries: ScheduledTaskHistoryEntry[]): void {
    for (const entry of Array.isArray(entries) ? entries : []) {
      const runId = nonEmptyText(entry.runId) ?? `scheduled:${entry.taskId}:${entry.timestamp}`;
      const startedAt = Math.max(0, entry.timestamp - Math.max(0, entry.durationMs || 0));
      const completedAt = entry.status === 'pending_approval' ? undefined : entry.timestamp;
      this.commitRun(runId, {
        baseStatus: mapScheduledTaskStatus(entry.status),
        summary: {
          groupId: entry.taskId,
          kind: 'scheduled_task',
          title: `Scheduled: ${entry.taskName}`,
          subtitle: sanitizeTimelineText(entry.message),
          channel: 'scheduled',
          startedAt,
          completedAt,
          durationMs: entry.durationMs,
          tags: ['scheduled', entry.taskType, entry.target],
        },
        items: buildWorkflowEventItems(runId, entry.events ?? [], 'workflow'),
      });
    }
  }

  private commitRun(
    runId: string,
    input: {
      summary?: Partial<DashboardRunSummary>;
      baseStatus?: DashboardRunStatus;
      items?: DashboardRunTimelineItem[];
    },
  ): void {
    const normalizedRunId = runId.trim();
    if (!normalizedRunId) return;

    const existing = this.runs.get(normalizedRunId);
    const nextSummary = {
      ...(existing?.detail.summary ?? defaultSummary(normalizedRunId)),
      ...(input.summary ?? {}),
    };
    nextSummary.tags = mergeTags(existing?.detail.summary.tags ?? [], input.summary?.tags ?? []);

    const itemMap = new Map<string, DashboardRunTimelineItem>();
    for (const item of existing?.detail.items ?? []) {
      itemMap.set(item.id, item);
    }
    for (const item of input.items ?? []) {
      itemMap.set(item.id, item);
    }
    let items = [...itemMap.values()]
      .filter((item) => Number.isFinite(item.timestamp) && item.timestamp > 0)
      .sort((left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id));
    if (items.length > this.maxItemsPerRun) {
      items = items.slice(items.length - this.maxItemsPerRun);
    }
    const sanitizedItems = items.map(sanitizeTimelineItemText);

    const baseStatus = input.baseStatus ?? existing?.baseStatus ?? 'queued';
    const startedAt = nextSummary.startedAt > 0
      ? nextSummary.startedAt
      : (sanitizedItems[0]?.timestamp ?? this.now());
    const lastUpdatedAt = Math.max(
      nextSummary.completedAt ?? 0,
      nextSummary.lastUpdatedAt ?? 0,
      sanitizedItems[sanitizedItems.length - 1]?.timestamp ?? 0,
      startedAt,
    );
    const completedAt = nextSummary.completedAt
      ?? inferCompletedAt(baseStatus, lastUpdatedAt);
    const durationMs = completedAt && startedAt
      ? Math.max(0, completedAt - startedAt)
      : nextSummary.durationMs;

    const detail: DashboardRunDetail = {
      summary: sanitizeRunSummaryText({
        ...nextSummary,
        runId: normalizedRunId,
        groupId: nonEmptyText(nextSummary.groupId) ?? normalizedRunId,
        title: nonEmptyText(nextSummary.title) ?? normalizedRunId,
        status: overlayStatus(
          baseStatus,
          nextSummary.pendingApprovalCount ?? 0,
          nextSummary.verificationPendingCount ?? 0,
        ),
        startedAt,
        completedAt,
        lastUpdatedAt,
        durationMs,
      }),
      items: sanitizedItems,
      liveSummary: buildRunLiveSummary(
        overlayStatus(
          baseStatus,
          nextSummary.pendingApprovalCount ?? 0,
          nextSummary.verificationPendingCount ?? 0,
        ),
        sanitizedItems,
      ),
    };

    const signature = JSON.stringify(detail);
    if (existing && existing.signature === signature) {
      return;
    }

    this.runs.set(normalizedRunId, { baseStatus, detail, signature });
    this.prune();
    for (const listener of this.listeners) {
      listener(cloneDetail(detail));
    }
  }

  private prune(): void {
    const now = this.now();
    const sorted = [...this.runs.entries()]
      .sort((left, right) => right[1].detail.summary.lastUpdatedAt - left[1].detail.summary.lastUpdatedAt);

    for (const [runId, record] of sorted) {
      const terminal = record.detail.summary.status === 'completed'
        || record.detail.summary.status === 'failed'
        || record.detail.summary.status === 'blocked'
        || record.detail.summary.status === 'interrupted'
        || record.detail.summary.status === 'cancelled';
      if (!terminal) continue;
      if (now - record.detail.summary.lastUpdatedAt > this.completedRetentionMs) {
        this.runs.delete(runId);
      }
    }

    const limited = [...this.runs.entries()]
      .sort((left, right) => right[1].detail.summary.lastUpdatedAt - left[1].detail.summary.lastUpdatedAt);
    for (const [runId] of limited.slice(this.maxRuns)) {
      this.runs.delete(runId);
    }
  }

  private sortedRuns(): DashboardRunDetail[] {
    return [...this.runs.values()]
      .map((record) => record.detail)
      .sort((left, right) => {
        if (left.summary.runId === right.summary.parentRunId) return -1;
        if (right.summary.runId === left.summary.parentRunId) return 1;
        return right.summary.lastUpdatedAt - left.summary.lastUpdatedAt
          || left.summary.startedAt - right.summary.startedAt
          || left.summary.runId.localeCompare(right.summary.runId);
      });
  }
}

function sanitizeRunSummaryText(summary: DashboardRunSummary): DashboardRunSummary {
  const title = sanitizeTimelineText(summary.title) ?? summary.title;
  const subtitle = sanitizeTimelineText(summary.subtitle);
  const error = sanitizeTimelineText(summary.error);
  return {
    ...summary,
    title,
    ...(subtitle ? { subtitle } : {}),
    ...(error ? { error } : {}),
  };
}

function sanitizeTimelineItemText(item: DashboardRunTimelineItem): DashboardRunTimelineItem {
  const { detail, contextAssembly, ...rest } = item;
  const sanitizedDetail = sanitizeTimelineText(detail);
  const sanitizedContextAssembly = contextAssembly
    ? sanitizeContextAssemblyText(contextAssembly)
    : undefined;
  return {
    ...rest,
    title: sanitizeTimelineText(item.title) ?? item.title,
    ...(sanitizedDetail ? { detail: sanitizedDetail } : {}),
    ...(sanitizedContextAssembly ? { contextAssembly: sanitizedContextAssembly } : {}),
  };
}

function sanitizeContextAssemblyText(
  contextAssembly: DashboardRunTimelineContextAssembly,
): DashboardRunTimelineContextAssembly | undefined {
  const summary = sanitizeTimelineText(contextAssembly.summary);
  const detail = sanitizeTimelineText(contextAssembly.detail);
  const knowledgeBaseQueryPreview = sanitizeTimelineText(contextAssembly.knowledgeBaseQueryPreview);
  const compactedSummaryPreview = sanitizeTimelineText(contextAssembly.compactedSummaryPreview);
  const selectedMemoryEntries = contextAssembly.selectedMemoryEntries?.map((entry) => {
    const matchReasons = entry.matchReasons
      ?.map((reason) => sanitizeTimelineText(reason))
      .filter((reason): reason is string => !!reason);
    return {
      ...entry,
      preview: sanitizeTimelineText(entry.preview) ?? entry.preview,
      ...(matchReasons && matchReasons.length > 0 ? { matchReasons } : {}),
    };
  });
  const preservedObjective = sanitizeTimelineText(contextAssembly.preservedExecutionState?.objective);
  const preservedBlockerSummary = sanitizeTimelineText(contextAssembly.preservedExecutionState?.blockerSummary);
  const preservedMaintainedSummarySource = sanitizeTimelineText(contextAssembly.preservedExecutionState?.maintainedSummarySource);
  const preservedExecutionState = contextAssembly.preservedExecutionState
    ? {
        ...(preservedObjective ? { objective: preservedObjective } : {}),
        ...(preservedBlockerSummary ? { blockerSummary: preservedBlockerSummary } : {}),
        ...(Array.isArray(contextAssembly.preservedExecutionState.activeExecutionRefs)
          ? { activeExecutionRefs: [...contextAssembly.preservedExecutionState.activeExecutionRefs] }
          : {}),
        ...(preservedMaintainedSummarySource ? { maintainedSummarySource: preservedMaintainedSummarySource } : {}),
      }
    : undefined;
  const skillArtifactReferences = contextAssembly.skillArtifactReferences?.map((entry) => ({
    ...entry,
    title: sanitizeTimelineText(entry.title) ?? entry.title,
  }));
  const sanitized: DashboardRunTimelineContextAssembly = {
    ...contextAssembly,
    ...(summary ? { summary } : {}),
    ...(detail ? { detail } : {}),
    ...(knowledgeBaseQueryPreview ? { knowledgeBaseQueryPreview } : {}),
    ...(selectedMemoryEntries && selectedMemoryEntries.length > 0 ? { selectedMemoryEntries } : {}),
    ...(compactedSummaryPreview ? { compactedSummaryPreview } : {}),
    ...(skillArtifactReferences && skillArtifactReferences.length > 0 ? { skillArtifactReferences } : {}),
    ...(preservedExecutionState && Object.keys(preservedExecutionState).length > 0 ? { preservedExecutionState } : {}),
  };
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function defaultSummary(runId: string): DashboardRunSummary {
  const now = Date.now();
  return {
    runId,
    groupId: runId,
    kind: 'assistant_dispatch',
    status: 'queued',
    title: runId,
    startedAt: now,
    lastUpdatedAt: now,
    pendingApprovalCount: 0,
    verificationPendingCount: 0,
    tags: [],
  };
}

function cloneDetail(detail: DashboardRunDetail): DashboardRunDetail {
  return {
    summary: {
      ...detail.summary,
      tags: [...detail.summary.tags],
    },
    items: detail.items.map((item) => ({
      ...item,
      ...(item.contextAssembly
        ? {
            contextAssembly: {
              ...item.contextAssembly,
              ...(item.contextAssembly.selectedMemoryEntries
                ? {
                    selectedMemoryEntries: item.contextAssembly.selectedMemoryEntries.map((entry) => ({ ...entry })),
                  }
                : {}),
            },
          }
        : {}),
    })),
    liveSummary: {
      label: detail.liveSummary.label,
      items: detail.liveSummary.items.map((item) => ({
        title: item.title,
        ...(nonEmptyText(item.detail) ? { detail: item.detail } : {}),
      })),
    },
  };
}

function humanizeLiveSummaryStatus(status: DashboardRunStatus): string {
  switch (status) {
    case 'queued':
      return 'Queued';
    case 'running':
      return 'Working…';
    case 'awaiting_approval':
      return 'Waiting for approval';
    case 'verification_pending':
      return 'Verification pending';
    case 'blocked':
      return 'Blocked';
    case 'interrupted':
      return 'Interrupted';
    case 'cancelled':
      return 'Cancelled';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return 'Working…';
  }
}

function isMeaningfulLiveSummaryItem(item: DashboardRunTimelineItem | undefined): boolean {
  const type = nonEmptyText(item?.type);
  return type !== 'run_queued'
    && type !== 'run_started'
    && type !== 'run_completed';
}

function isGenericWorkingLiveSummaryTitle(title: string | undefined): boolean {
  const normalized = nonEmptyText(title)?.toLowerCase();
  return normalized === 'agent is working'
    || normalized === 'running assistant'
    || normalized === 'working…'
    || normalized === 'working...';
}

function isLowSignalLiveSummaryItem(item: DashboardRunTimelineItem | undefined): boolean {
  const title = nonEmptyText(item?.title)?.toLowerCase() ?? '';
  if (!title) return true;
  if (isGenericWorkingLiveSummaryTitle(title)) return true;
  if (title === 'prepared request' || title === 'preparing request' || title === 'agent is working' || title === 'retrying with fallback') {
    return true;
  }
  if (title === 'assembled context' || title.startsWith('model response')) {
    return true;
  }
  if (title === 'handoff: delegated follow-up'
    || title === 'handoff blocked: delegated follow-up'
    || title === 'handoff completed: delegated follow-up') {
    return true;
  }
  return false;
}

function buildRunLiveSummary(
  status: DashboardRunStatus,
  items: DashboardRunTimelineItem[],
): DashboardRunLiveSummary {
  const recentItems: Array<{
    source: DashboardRunTimelineItem;
    display: DashboardRunLiveSummaryItem;
  }> = [];
  const seenKeys = new Set<string>();
  for (let index = items.length - 1; index >= 0 && recentItems.length < 8; index -= 1) {
    const item = items[index];
    if (!isMeaningfulLiveSummaryItem(item)) continue;
    const display = buildLiveSummaryDisplayItem(item);
    if (!display) continue;
    const title = nonEmptyText(display.title);
    if (!title) continue;
    const detail = nonEmptyText(display.detail);
    const key = `${title}\n${detail ?? ''}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    recentItems.unshift({
      source: item,
      display,
    });
  }

  const meaningfulSourceItems = items.filter(isMeaningfulLiveSummaryItem);
  const hasHighSignalItems = meaningfulSourceItems.some((item) => !isLowSignalLiveSummaryItem(item));
  const filteredItems = hasHighSignalItems
    ? recentItems.filter((item) => !isLowSignalLiveSummaryItem(item.source))
    : recentItems;

  const normalizedItems = (filteredItems.length > 0 ? filteredItems : recentItems)
    .map((item) => item.display);
  const terminalStatus = status === 'completed'
    || status === 'failed'
    || status === 'blocked'
    || status === 'awaiting_approval'
    || status === 'verification_pending'
    || status === 'interrupted'
    || status === 'cancelled';

  if (terminalStatus) {
    while (normalizedItems.length > 0 && isGenericWorkingLiveSummaryTitle(normalizedItems[normalizedItems.length - 1]?.title)) {
      normalizedItems.pop();
    }
    const terminalLabel = humanizeLiveSummaryStatus(status);
    if (normalizedItems.length === 0) {
      normalizedItems.push({ title: terminalLabel });
    } else if (normalizedItems[normalizedItems.length - 1]?.title !== terminalLabel) {
      normalizedItems.push({ title: terminalLabel });
    }
  }

  if (normalizedItems.length === 0) {
    return {
      label: humanizeLiveSummaryStatus(status),
      items: [],
    };
  }

  return {
    label: normalizedItems[normalizedItems.length - 1]?.title ?? humanizeLiveSummaryStatus(status),
    items: normalizedItems.slice(-6),
  };
}

function buildLiveSummaryDisplayItem(
  item: DashboardRunTimelineItem,
): DashboardRunLiveSummaryItem | null {
  const title = nonEmptyText(item.title);
  if (!title) return null;
  const detail = nonEmptyText(item.detail);
  const normalizedTitle = title.toLowerCase();

  if (normalizedTitle === 'preparing request') {
    return {
      title: 'Preparing context',
      detail: 'Reading the request and channel context.',
    };
  }

  if (normalizedTitle === 'assembled context') {
    const contextDetail = buildLiveContextAssemblyDetail(item.contextAssembly, detail);
    return {
      title: 'Gathering relevant context',
      ...(contextDetail ? { detail: contextDetail } : {}),
    };
  }

  if (normalizedTitle === 'running assistant') {
    return {
      title: 'Working with selected agent',
      detail: detail ?? 'Dispatching through the shared runtime.',
    };
  }

  if (normalizedTitle.startsWith('model response')) {
    return {
      title: item.status === 'running' ? 'Waiting for model response' : 'Model response received',
      ...(detail ? { detail } : {}),
    };
  }

  const toolName = nonEmptyText(item.toolName);
  if (item.type === 'tool_call_started' && toolName) {
    return {
      title: `Using ${humanizeToolName(toolName)}`,
      ...(detail ? { detail } : {}),
    };
  }

  if (item.type === 'tool_call_completed' && toolName) {
    const outcome = item.status === 'failed'
      ? 'failed'
      : item.status === 'blocked'
        ? 'blocked'
        : 'completed';
    return {
      title: `${humanizeToolName(toolName)} ${outcome}`,
      ...(detail ? { detail } : {}),
    };
  }

  if (item.type === 'approval_requested') {
    return {
      title: 'Waiting for approval',
      ...(detail ? { detail } : {}),
    };
  }

  if (item.type === 'verification_pending') {
    return {
      title: 'Verification pending',
      ...(detail ? { detail } : {}),
    };
  }

  if (item.type === 'verification_completed') {
    return {
      title,
      ...(detail ? { detail } : {}),
    };
  }

  return {
    title,
    ...(detail ? { detail } : {}),
  };
}

function buildLiveContextAssemblyDetail(
  contextAssembly: DashboardRunTimelineContextAssembly | undefined,
  fallbackDetail: string | undefined,
): string | undefined {
  const parts: string[] = [];
  if (contextAssembly?.knowledgeBaseLoaded) parts.push('knowledge');
  if (contextAssembly?.codingMemoryLoaded) parts.push('coding memory');
  if ((contextAssembly?.selectedMemoryEntryCount ?? 0) > 0) {
    parts.push(`${contextAssembly?.selectedMemoryEntryCount} memory ${contextAssembly?.selectedMemoryEntryCount === 1 ? 'entry' : 'entries'}`);
  }
  if ((contextAssembly?.activeExecutionRefs?.length ?? 0) > 0) {
    parts.push('active work');
  }
  if (parts.length > 0) {
    return `Loaded ${parts.join(', ')}.`;
  }
  return fallbackDetail;
}

function shouldUseCodeSessionBaseStatus(record: RunTimelineRecord | undefined): boolean {
  return !record || record.detail.summary.kind === 'code_session';
}

function summarizeRunTitle(requestType: string, preview?: string): string {
  return sanitizePreview(preview) ?? `Assistant ${requestType || 'message'}`;
}

function resolveRunId(codeSessionId: string, requestId?: string): string {
  const normalizedRequestId = nonEmptyText(requestId);
  if (normalizedRequestId) return normalizedRequestId;
  return `code-session:${codeSessionId}:unscoped`;
}

function buildCodeSessionSummaryPatch(
  session: CodeSessionRecord,
  existing?: DashboardRunSummary,
): Partial<DashboardRunSummary> {
  return {
    ...(existing ? {} : {
      groupId: session.id,
      kind: 'code_session' as const,
      title: `Code session: ${session.title}`,
    }),
    sessionId: session.id,
    codeSessionId: session.id,
    tags: ['code'],
  };
}

function buildPendingApprovalItem(
  runId: string,
  approval: CodeSessionPendingApproval,
  fallbackTimestamp: number,
): DashboardRunTimelineItem {
  return {
    id: `approval:${approval.id}`,
    runId,
    timestamp: approval.createdAt ?? fallbackTimestamp,
    type: 'approval_requested',
    status: 'blocked',
    source: 'code_session',
    title: `Approval requested: ${humanizeToolName(approval.toolName)}`,
    detail: sanitizeTimelineText(approval.argsPreview),
    toolName: approval.toolName,
    approvalId: approval.id,
  };
}

function buildApprovalResolvedItem(
  runId: string,
  approvalId: string,
  toolName: string,
  relatedJob: CodeSessionRecentJob | undefined,
  fallbackTimestamp: number,
): DashboardRunTimelineItem {
  const denied = relatedJob?.status === 'denied';
  return {
    id: `approval:${approvalId}:resolved`,
    runId,
    timestamp: relatedJob?.completedAt ?? fallbackTimestamp,
    type: 'approval_resolved',
    status: denied ? 'failed' : 'succeeded',
    source: 'code_session',
    title: denied
      ? `Approval denied: ${humanizeToolName(toolName)}`
      : `Approval cleared: ${humanizeToolName(toolName)}`,
    detail: denied
      ? sanitizeTimelineText(relatedJob?.error) ?? 'The pending action was denied.'
      : 'The pending action was cleared and execution continued.',
    toolName,
    approvalId,
  };
}

function buildCodeWorkflowStageItem(
  runId: string,
  workflow: CodeSessionWorkflowState,
): DashboardRunTimelineItem {
  return {
    id: `workflow:${workflow.recipeId}:${workflow.currentStage}`,
    runId,
    timestamp: workflow.updatedAt,
    type: 'note',
    status: mapCodeWorkflowStageItemStatus(workflow),
    source: 'code_session',
    title: `Coding stage: ${humanizeWorkflowStage(workflow.currentStage)}`,
    detail: buildCodeWorkflowStageDetail(workflow),
  };
}

function mapCodeWorkflowStageItemStatus(
  workflow: CodeSessionWorkflowState,
): DashboardRunTimelineItem['status'] {
  if (workflow.status === 'blocked') return 'blocked';
  if (workflow.status === 'completed') return 'succeeded';
  if (workflow.verificationState === 'failed') return 'failed';
  if (workflow.status === 'in_progress') return 'running';
  return 'info';
}

function buildCodeWorkflowStageDetail(workflow: CodeSessionWorkflowState): string | undefined {
  const detail = [
    workflow.blockedReason,
    workflow.nextAction,
    workflow.verificationState && workflow.verificationState !== 'not_started'
      ? `Verification: ${humanizeWorkflowValue(workflow.verificationState)}.`
      : undefined,
    workflow.isolation?.level && workflow.isolation.level !== 'none'
      ? `Isolation: ${humanizeWorkflowValue(workflow.isolation.level)}${workflow.isolation.profileName ? ` on ${workflow.isolation.profileName}` : ''}.`
      : undefined,
  ]
    .map((value) => sanitizeTimelineText(value))
    .filter((value): value is string => !!value)
    .join(' ');
  return detail || undefined;
}

function humanizeWorkflowStage(stage: CodeSessionWorkflowStage): string {
  return humanizeWorkflowValue(stage);
}

function humanizeWorkflowValue(value: string): string {
  return value
    .split(/[_-]+/u)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function buildJobItems(runId: string, job: CodeSessionRecentJob, fallbackTimestamp: number): DashboardRunTimelineItem[] {
  const remoteDetail = job.remoteExecution?.profileName
    ? `Remote sandbox: ${job.remoteExecution.profileName}${job.remoteExecution.leaseReused ? ' (lease reused)' : ''}.`
    : null;
  const argsDetail = sanitizeTimelineText(job.argsPreview);
  const items: DashboardRunTimelineItem[] = [{
    id: `job:${job.id}:started`,
    runId,
    timestamp: job.startedAt ?? job.createdAt ?? fallbackTimestamp,
    type: 'tool_call_started',
    status: job.status === 'running' ? 'running' : 'info',
    source: 'code_session',
    title: `Tool started: ${humanizeToolName(job.toolName)}`,
    detail: [argsDetail, remoteDetail].filter(Boolean).join('\n') || undefined,
    toolName: job.toolName,
  }];

  if ((job.status === 'pending_approval' || job.status === 'denied') && job.approvalId) {
    items.push({
      id: `approval:${job.approvalId}`,
      runId,
      timestamp: job.createdAt ?? fallbackTimestamp,
      type: 'approval_requested',
      status: job.status === 'denied' ? 'failed' : 'blocked',
      source: 'code_session',
      title: `Approval requested: ${humanizeToolName(job.toolName)}`,
      detail: sanitizeTimelineText(job.argsPreview),
      toolName: job.toolName,
      approvalId: job.approvalId,
    });
  }

  if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'denied') {
    items.push({
      id: `job:${job.id}:completed`,
      runId,
      timestamp: job.completedAt ?? job.createdAt ?? fallbackTimestamp,
      type: 'tool_call_completed',
      status: mapJobItemStatus(job.status),
      source: 'code_session',
      title: buildJobCompletionTitle(job),
      detail: [sanitizeTimelineText(job.error) ?? sanitizeTimelineText(job.resultPreview), remoteDetail].filter(Boolean).join('\n') || undefined,
      toolName: job.toolName,
    });
  }

  return items;
}

function buildVerificationItem(runId: string, entry: CodeSessionVerificationEntry): DashboardRunTimelineItem {
  const pending = entry.status === 'not_run';
  return {
    id: `verification:${entry.id}`,
    runId,
    timestamp: entry.timestamp,
    type: pending ? 'verification_pending' : 'verification_completed',
    status: pending
      ? 'warning'
      : entry.status === 'fail'
        ? 'failed'
        : entry.status === 'warn'
          ? 'warning'
          : 'succeeded',
    source: 'code_session',
    title: pending
      ? `Verification pending: ${humanizeVerificationKind(entry.kind)}`
      : `Verification ${entry.status}: ${humanizeVerificationKind(entry.kind)}`,
    detail: sanitizeTimelineText(entry.summary),
    verificationKind: entry.kind,
  };
}

function buildCodingBackendProgressItem(runId: string, event: CodingBackendProgressEvent): DashboardRunTimelineItem {
  switch (event.kind) {
    case 'started':
      return {
        id: event.id,
        runId,
        timestamp: event.timestamp,
        type: 'tool_call_started',
        status: 'running',
        source: 'code_session',
        title: `Delegated to ${event.backendName}`,
        detail: sanitizeTimelineText(event.detail),
        toolName: 'coding_backend_run',
      };
    case 'progress':
      return {
        id: event.id,
        runId,
        timestamp: event.timestamp,
        type: 'note',
        status: 'running',
        source: 'code_session',
        title: `${event.backendName} is working`,
        detail: sanitizeTimelineText(event.detail),
        toolName: 'coding_backend_run',
      };
    case 'completed':
      return {
        id: event.id,
        runId,
        timestamp: event.timestamp,
        type: 'tool_call_completed',
        status: 'succeeded',
        source: 'code_session',
        title: `${event.backendName} completed`,
        detail: sanitizeTimelineText(event.detail),
        toolName: 'coding_backend_run',
      };
    case 'timed_out':
      return {
        id: event.id,
        runId,
        timestamp: event.timestamp,
        type: 'tool_call_completed',
        status: 'failed',
        source: 'code_session',
        title: `${event.backendName} timed out`,
        detail: sanitizeTimelineText(event.detail),
        toolName: 'coding_backend_run',
      };
    case 'failed':
    default:
      return {
        id: event.id,
        runId,
        timestamp: event.timestamp,
        type: 'tool_call_completed',
        status: 'failed',
        source: 'code_session',
        title: `${event.backendName} failed`,
        detail: sanitizeTimelineText(event.detail),
        toolName: 'coding_backend_run',
      };
  }
}

function buildDelegatedWorkerProgressItem(runId: string, event: DelegatedWorkerProgressEvent): DashboardRunTimelineItem {
  const targetName = describeDelegatedWorkerTarget(event);
  const contextAssembly = buildDelegatedWorkerContextAssembly(event);
  const detail = buildDelegatedWorkerProgressDetail(event);
  switch (event.kind) {
    case 'started':
      return {
        id: event.id,
        runId,
        timestamp: event.timestamp,
        type: 'handoff_started',
        status: 'running',
        source: 'system',
        title: `Delegated to ${targetName}`,
        detail,
        ...(contextAssembly ? { contextAssembly } : {}),
      };
    case 'running':
      return {
        id: event.id,
        runId,
        timestamp: event.timestamp,
        type: 'note',
        status: 'running',
        source: 'system',
        title: `${targetName} is working`,
        detail,
        ...(contextAssembly ? { contextAssembly } : {}),
      };
    case 'blocked':
      return {
        id: event.id,
        runId,
        timestamp: event.timestamp,
        type: 'handoff_completed',
        status: 'blocked',
        source: 'system',
        title: `${targetName} is waiting`,
        detail,
        ...(contextAssembly ? { contextAssembly } : {}),
      };
    case 'completed':
      return {
        id: event.id,
        runId,
        timestamp: event.timestamp,
        type: 'handoff_completed',
        status: 'succeeded',
        source: 'system',
        title: `${targetName} completed`,
        detail,
        ...(contextAssembly ? { contextAssembly } : {}),
      };
    case 'followup_action':
      return {
        id: event.id,
        runId,
        timestamp: event.timestamp,
        type: 'note',
        status: 'succeeded',
        source: 'system',
        title: buildDelegatedWorkerFollowUpTitle(event, targetName),
        detail,
        ...(contextAssembly ? { contextAssembly } : {}),
      };
    case 'failed':
    default:
      return {
        id: event.id,
        runId,
        timestamp: event.timestamp,
        type: 'handoff_completed',
        status: 'failed',
        source: 'system',
        title: `${targetName} failed`,
        detail,
        ...(contextAssembly ? { contextAssembly } : {}),
      };
  }
}

function buildDelegatedExecutionEventItem(runId: string, event: ExecutionEvent): DashboardRunTimelineItem {
  const toolName = nonEmptyText(typeof event.payload.toolName === 'string' ? event.payload.toolName : undefined);
  const interruptionKind = nonEmptyText(typeof event.payload.kind === 'string' ? event.payload.kind : undefined);
  const verificationDecision = nonEmptyText(typeof event.payload.decision === 'string' ? event.payload.decision : undefined);
  const status = mapDelegatedExecutionEventStatus(event);
  switch (event.type) {
    case 'tool_call_started':
      return {
        id: `execution-event:${event.eventId}:${runId}`,
        runId,
        timestamp: event.timestamp,
        type: 'tool_call_started',
        status,
        source: 'system',
        title: `Tool started: ${humanizeToolName(toolName ?? 'tool')}`,
        ...(toolName ? { toolName } : {}),
        ...(buildDelegatedExecutionEventDetail(event) ? { detail: buildDelegatedExecutionEventDetail(event) } : {}),
      };
    case 'tool_call_completed':
      return {
        id: `execution-event:${event.eventId}:${runId}`,
        runId,
        timestamp: event.timestamp,
        type: 'tool_call_completed',
        status,
        source: 'system',
        title: buildDelegatedExecutionCompletionTitle(toolName, event),
        ...(toolName ? { toolName } : {}),
        ...(buildDelegatedExecutionEventDetail(event) ? { detail: buildDelegatedExecutionEventDetail(event) } : {}),
      };
    case 'interruption_requested':
      return {
        id: `execution-event:${event.eventId}:${runId}`,
        runId,
        timestamp: event.timestamp,
        type: interruptionKind === 'approval' ? 'approval_requested' : 'note',
        status,
        source: 'system',
        title: interruptionKind === 'approval'
          ? 'Approval requested'
          : 'Delegated interruption requested',
        ...(buildDelegatedExecutionEventDetail(event) ? { detail: buildDelegatedExecutionEventDetail(event) } : {}),
      };
    case 'interruption_resolved':
      return {
        id: `execution-event:${event.eventId}:${runId}`,
        runId,
        timestamp: event.timestamp,
        type: interruptionKind === 'approval' ? 'approval_resolved' : 'note',
        status,
        source: 'system',
        title: interruptionKind === 'approval'
          ? 'Approval resolved'
          : 'Delegated interruption resolved',
        ...(buildDelegatedExecutionEventDetail(event) ? { detail: buildDelegatedExecutionEventDetail(event) } : {}),
      };
    case 'claim_emitted':
      return {
        id: `execution-event:${event.eventId}:${runId}`,
        runId,
        timestamp: event.timestamp,
        type: 'note',
        status,
        source: 'system',
        title: 'Delegated claim emitted',
        ...(buildDelegatedExecutionEventDetail(event) ? { detail: buildDelegatedExecutionEventDetail(event) } : {}),
      };
    case 'verification_decided':
    default:
      return {
        id: `execution-event:${event.eventId}:${runId}`,
        runId,
        timestamp: event.timestamp,
        type: 'verification_completed',
        status,
        source: 'system',
        title: verificationDecision
          ? `Verification ${verificationDecision}`
          : 'Verification completed',
        ...(buildDelegatedExecutionEventDetail(event) ? { detail: buildDelegatedExecutionEventDetail(event) } : {}),
      };
  }
}

function buildAssistantTraceItems(trace: AssistantDispatchTrace): DashboardRunTimelineItem[] {
  const items: DashboardRunTimelineItem[] = [{
    id: `trace:${trace.requestId}:queued`,
    runId: trace.runId,
    timestamp: trace.queuedAt,
    type: 'run_queued',
    status: 'info',
    source: 'orchestrator',
    title: `Queued ${trace.requestType}`,
    detail: sanitizePreview(trace.messagePreview),
  }];

  if (trace.startedAt) {
    items.push({
      id: `trace:${trace.requestId}:started`,
      runId: trace.runId,
      timestamp: trace.startedAt,
      type: 'run_started',
      status: 'running',
      source: 'orchestrator',
      title: `Started ${trace.requestType}`,
      detail: sanitizePreview(trace.messagePreview),
    });
  }

  for (const step of trace.steps) {
    const mapped = mapAssistantTraceStep(step.name, step.status, step.detail);
    if (!mapped) continue;
    items.push({
      id: `step:${trace.requestId}:${step.name}`,
      runId: trace.runId,
      timestamp: step.completedAt ?? step.startedAt,
      type: 'note',
      status: mapped.status,
      source: 'orchestrator',
      title: mapped.title,
      ...(mapped.detail ? { detail: mapped.detail } : {}),
    });
  }

  for (const node of trace.nodes) {
    items.push(...buildTraceNodeItems(trace.runId, node));
  }

  if (trace.completedAt && trace.status === 'succeeded') {
    items.push({
      id: `trace:${trace.requestId}:completed`,
      runId: trace.runId,
      timestamp: trace.completedAt,
      type: 'run_completed',
      status: 'succeeded',
      source: 'orchestrator',
      title: 'Run completed',
      detail: sanitizePreview(trace.responsePreview),
    });
  }

  if (trace.completedAt && trace.status === 'failed') {
    items.push({
      id: `trace:${trace.requestId}:failed`,
      runId: trace.runId,
      timestamp: trace.completedAt,
      type: 'run_failed',
      status: 'failed',
      source: 'orchestrator',
      title: 'Run failed',
      detail: sanitizeTimelineText(trace.error),
    });
  }

  if (trace.status === 'cancelled') {
    items.push({
      id: `trace:${trace.requestId}:cancelled`,
      runId: trace.runId,
      timestamp: trace.completedAt ?? trace.startedAt ?? trace.queuedAt,
      type: 'run_failed',
      status: 'warning',
      source: 'orchestrator',
      title: 'Run cancelled',
      detail: sanitizeTimelineText(trace.error),
    });
  }

  return items;
}

function mapAssistantTraceStep(
  stepName: string,
  stepStatus: AssistantDispatchTrace['steps'][number]['status'],
  stepDetail?: string,
): { title: string; status: DashboardRunTimelineItem['status']; detail?: string } | null {
  const normalized = nonEmptyText(stepName);
  if (!normalized || normalized === 'queue_wait' || normalized === 'handler') {
    return null;
  }

  const status = stepStatus === 'failed'
    ? 'failed'
    : stepStatus === 'running'
      ? 'running'
      : 'info';

  switch (normalized) {
    case 'message_built':
      return {
        title: 'Preparing request',
        status,
        detail: 'Message and channel context are ready.',
      };
    case 'runtime_dispatch_message':
      return {
        title: 'Running assistant',
        status,
        detail: formatRuntimeDispatchDetail(stepDetail),
      };
    case 'runtime_dispatch_fallback':
      return { title: 'Retrying with fallback', status, detail: formatTraceStepDetail(stepDetail) };
    case 'quick_action_prompt_built':
      return { title: 'Prepared quick action', status, detail: formatTraceStepDetail(stepDetail) };
    default:
      return {
        title: humanizeTraceStepName(normalized),
        status,
        ...(formatTraceStepDetail(stepDetail) ? { detail: formatTraceStepDetail(stepDetail) } : {}),
      };
  }
}

function formatRuntimeDispatchDetail(value: string | undefined): string | undefined {
  const detail = formatTraceStepDetail(value);
  if (!detail) return 'Dispatching through the shared runtime.';
  const agentMatch = /\bagent=([^\s;]+)/i.exec(detail);
  if (agentMatch?.[1]) {
    return `Dispatching through ${agentMatch[1]}.`;
  }
  return detail;
}

function formatTraceStepDetail(value: string | undefined): string | undefined {
  const sanitized = sanitizeTimelineText(value);
  if (!sanitized) return undefined;
  return sanitized
    .replace(/\bmessageId=[^\s;]+/gi, 'message ready')
    .replace(/\brequestId=[^\s;]+/gi, 'request ready');
}

function humanizeTraceStepName(stepName: string): string {
  return stepName
    .split(/[_-]+/g)
    .filter(Boolean)
    .map((part, index) => index === 0
      ? part.charAt(0).toUpperCase() + part.slice(1)
      : part)
    .join(' ');
}

function buildTraceNodeItems(runId: string, node: WorkflowTraceNode): DashboardRunTimelineItem[] {
  const contextAssembly = extractContextAssembly(node);
  if (node.kind === 'handoff') {
    return [{
      id: `node:${node.id}:${node.status === 'running' ? 'handoff_started' : 'handoff_completed'}`,
      runId,
      timestamp: node.completedAt ?? node.startedAt,
      type: node.status === 'running' ? 'handoff_started' : 'handoff_completed',
      status: node.status === 'failed'
        ? 'failed'
        : node.status === 'blocked'
          ? 'blocked'
          : node.status === 'running'
            ? 'running'
            : 'succeeded',
      source: 'orchestrator',
      title: node.status === 'failed'
        ? `Handoff failed: ${node.name}`
        : node.status === 'blocked'
          ? `Handoff blocked: ${node.name}`
          : node.status === 'running'
            ? `Handoff: ${node.name}`
            : `Handoff completed: ${node.name}`,
      detail: extractNodeDetail(node),
      nodeId: node.id,
      ...(contextAssembly ? { contextAssembly } : {}),
    }];
  }
  if (node.kind === 'tool_call') {
    const items: DashboardRunTimelineItem[] = [{
      id: `node:${node.id}:started`,
      runId,
      timestamp: node.startedAt,
      type: 'tool_call_started',
      status: node.status === 'running' ? 'running' : 'info',
      source: 'orchestrator',
      title: `Tool started: ${humanizeToolName(node.name)}`,
      detail: extractNodeDetail(node),
      nodeId: node.id,
      toolName: node.name,
      ...(contextAssembly ? { contextAssembly } : {}),
    }];
    if (node.completedAt) {
      items.push({
        id: `node:${node.id}:completed`,
        runId,
        timestamp: node.completedAt,
        type: 'tool_call_completed',
        status: mapNodeStatus(node.status),
        source: 'orchestrator',
        title: buildNodeCompletionTitle(node),
        detail: extractNodeDetail(node),
        nodeId: node.id,
        toolName: node.name,
        ...(contextAssembly ? { contextAssembly } : {}),
      });
    }
    return items;
  }

  const mapped = mapTraceNodeKind(node.kind);
  return [{
    id: `node:${node.id}:${mapped.type}`,
    runId,
    timestamp: node.completedAt ?? node.startedAt,
    type: mapped.type,
    status: mapped.status,
    source: 'orchestrator',
    title: mapped.title(node.name),
    detail: extractNodeDetail(node),
    nodeId: node.id,
    ...(contextAssembly ? { contextAssembly } : {}),
  }];
}

function buildWorkflowEventItems(
  runId: string,
  events: OrchestrationRunEvent[],
  source: 'workflow' | 'system',
): DashboardRunTimelineItem[] {
  const items: DashboardRunTimelineItem[] = [];
  for (const event of Array.isArray(events) ? events : []) {
    const item = mapWorkflowEventToItem(runId, event, source);
    if (item) items.push(item);
  }
  return items;
}

function mapWorkflowEventToItem(
  runId: string,
  event: OrchestrationRunEvent,
  source: 'workflow' | 'system',
): DashboardRunTimelineItem | null {
  const shared = {
    id: `event:${event.id}`,
    runId,
    timestamp: event.timestamp,
    source,
    detail: sanitizeTimelineText(event.message),
    nodeId: event.nodeId,
  } as const;

  switch (event.type) {
    case 'run_created':
      return { ...shared, type: 'run_started', status: 'running', title: 'Run started' };
    case 'node_started':
      return { ...shared, type: 'note', status: 'info', title: `Step started${event.nodeId ? `: ${event.nodeId}` : ''}` };
    case 'node_completed':
      return { ...shared, type: 'note', status: 'succeeded', title: `Step completed${event.nodeId ? `: ${event.nodeId}` : ''}` };
    case 'approval_requested':
      return { ...shared, type: 'approval_requested', status: 'blocked', title: 'Approval requested' };
    case 'approval_denied':
      return { ...shared, type: 'approval_resolved', status: 'failed', title: 'Approval denied' };
    case 'run_interrupted':
      return { ...shared, type: 'note', status: 'warning', title: 'Run interrupted' };
    case 'run_resumed':
      return { ...shared, type: 'note', status: 'running', title: 'Run resumed' };
    case 'handoff_started':
      return { ...shared, type: 'handoff_started', status: 'running', title: 'Handoff started' };
    case 'handoff_completed':
      return { ...shared, type: 'handoff_completed', status: 'succeeded', title: 'Handoff completed' };
    case 'verification_pending':
      return { ...shared, type: 'verification_pending', status: 'warning', title: 'Verification pending' };
    case 'verification_completed':
      return { ...shared, type: 'verification_completed', status: 'succeeded', title: 'Verification completed' };
    case 'run_completed':
      return { ...shared, type: 'run_completed', status: 'succeeded', title: 'Run completed' };
    case 'run_failed':
      return { ...shared, type: 'run_failed', status: 'failed', title: 'Run failed' };
    default:
      return null;
  }
}

function sanitizePreview(value: unknown): string | undefined {
  const normalized = nonEmptyText(typeof value === 'string' ? value : undefined);
  if (!normalized) return undefined;
  return sanitizeTimelineText(normalized.replace(/^\[Context:\s*User is currently viewing the [^\]]+\]\s*/i, ''));
}

function inferCompletedAt(baseStatus: DashboardRunStatus, lastUpdatedAt: number): number | undefined {
  if (baseStatus === 'completed'
    || baseStatus === 'failed'
    || baseStatus === 'blocked'
    || baseStatus === 'interrupted'
    || baseStatus === 'cancelled') {
    return lastUpdatedAt;
  }
  return undefined;
}

function overlayStatus(
  baseStatus: DashboardRunStatus,
  pendingApprovalCount: number,
  verificationPendingCount: number,
): DashboardRunStatus {
  if (pendingApprovalCount > 0) return 'awaiting_approval';
  if (verificationPendingCount > 0) return 'verification_pending';
  return baseStatus;
}

function mapAssistantTraceStatus(status: AssistantDispatchTrace['status']): DashboardRunStatus {
  switch (status) {
    case 'queued':
      return 'queued';
    case 'running':
      return 'running';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    case 'succeeded':
    default:
      return 'completed';
  }
}

function mapPlaybookStatus(status: 'succeeded' | 'failed' | 'awaiting_approval'): DashboardRunStatus {
  switch (status) {
    case 'awaiting_approval':
      return 'awaiting_approval';
    case 'failed':
      return 'failed';
    case 'succeeded':
    default:
      return 'completed';
  }
}

function mapScheduledTaskStatus(status: 'succeeded' | 'failed' | 'pending_approval'): DashboardRunStatus {
  switch (status) {
    case 'pending_approval':
      return 'awaiting_approval';
    case 'failed':
      return 'failed';
    case 'succeeded':
    default:
      return 'completed';
  }
}

function mapCodingBackendProgressStatus(kind: CodingBackendProgressEvent['kind']): DashboardRunStatus {
  switch (kind) {
    case 'completed':
      return 'completed';
    case 'failed':
    case 'timed_out':
      return 'failed';
    case 'started':
    case 'progress':
    default:
      return 'running';
  }
}

function deriveCodeSessionBaseStatus(
  runId: string,
  approvals: CodeSessionPendingApproval[],
  jobs: CodeSessionRecentJob[],
  verification: CodeSessionVerificationEntry[],
  session: CodeSessionRecord,
): DashboardRunStatus {
  const runJobs = jobs.filter((job) => resolveRunId(session.id, job.requestId) === runId);
  const runVerification = verification.filter((entry) => resolveRunId(session.id, entry.requestId) === runId);
  const runApprovals = approvals.filter((approval) => resolveRunId(session.id, approval.requestId) === runId);

  if (runApprovals.length > 0) return 'running';
  if (runJobs.some((job) => job.status === 'denied')) return 'blocked';
  if (runJobs.some((job) => job.status === 'failed')) return 'failed';
  if (runJobs.some((job) => job.status === 'running' || job.status === 'pending_approval')) return 'running';
  if (runVerification.some((entry) => entry.status === 'fail')) return 'failed';
  if (runVerification.some((entry) => entry.status === 'not_run')) return 'running';
  if (runJobs.length > 0 || runVerification.length > 0) return 'completed';
  const workflow = session.workState.workflow;
  if (workflow?.status === 'blocked') return 'blocked';
  if (workflow?.verificationState === 'failed') return 'failed';
  if (workflow?.status === 'in_progress') return 'running';
  if (workflow?.verificationState === 'pending' || workflow?.verificationState === 'running') return 'verification_pending';
  if (workflow?.status === 'completed') return 'completed';
  return 'queued';
}

function mapJobItemStatus(status: string): DashboardRunTimelineItem['status'] {
  if (status === 'succeeded') return 'succeeded';
  if (status === 'denied') return 'blocked';
  if (status === 'failed') return 'failed';
  return 'running';
}

function buildJobCompletionTitle(job: CodeSessionRecentJob): string {
  if (job.status === 'succeeded') return `Tool completed: ${humanizeToolName(job.toolName)}`;
  if (job.status === 'denied') return `Tool denied: ${humanizeToolName(job.toolName)}`;
  return `Tool failed: ${humanizeToolName(job.toolName)}`;
}

function mapNodeStatus(status: WorkflowTraceNode['status']): DashboardRunTimelineItem['status'] {
  if (status === 'succeeded') return 'succeeded';
  if (status === 'failed') return 'failed';
  if (status === 'blocked') return 'blocked';
  return 'running';
}

function buildNodeCompletionTitle(node: WorkflowTraceNode): string {
  if (node.status === 'blocked') return `Tool blocked: ${humanizeToolName(node.name)}`;
  if (node.status === 'failed') return `Tool failed: ${humanizeToolName(node.name)}`;
  return `Tool completed: ${humanizeToolName(node.name)}`;
}

function extractNodeDetail(node: WorkflowTraceNode): string | undefined {
  const metadata = isRecord(node.metadata) ? node.metadata : null;
  const explicitDetail = metadata && typeof metadata.detail === 'string' ? metadata.detail : null;
  const summary = metadata && typeof metadata.summary === 'string' ? metadata.summary : null;
  const result = metadata && isRecord(metadata.result) ? metadata.result : null;
  const error = result && typeof result.error === 'string' ? result.error : null;
  const message = result && typeof result.message === 'string' ? result.message : null;
  return truncateText(nonEmptyText(explicitDetail) ?? nonEmptyText(summary) ?? nonEmptyText(error) ?? nonEmptyText(message), 220);
}

function extractContextAssembly(node: WorkflowTraceNode): DashboardRunTimelineContextAssembly | undefined {
  const metadata = isRecord(node.metadata) ? node.metadata : null;
  if (!metadata) return undefined;
  const memoryScope = metadata.memoryScope === 'global' || metadata.memoryScope === 'coding_session' || metadata.memoryScope === 'none'
    ? metadata.memoryScope
    : undefined;
  const selectedMemoryEntries = Array.isArray(metadata.selectedMemoryEntries)
    ? metadata.selectedMemoryEntries
      .map((entry) => {
        if (!isRecord(entry)) return null;
        const scope = entry.scope === 'global' || entry.scope === 'coding_session'
          ? entry.scope
          : undefined;
        const category = nonEmptyText(typeof entry.category === 'string' ? entry.category : undefined);
        const createdAt = nonEmptyText(typeof entry.createdAt === 'string' ? entry.createdAt : undefined);
        const preview = sanitizeTimelineText(typeof entry.preview === 'string' ? entry.preview : undefined);
        const renderMode = entry.renderMode === 'full' || entry.renderMode === 'summary'
          ? entry.renderMode
          : null;
        const queryScore = typeof entry.queryScore === 'number' && Number.isFinite(entry.queryScore)
          ? entry.queryScore
          : 0;
        if (!category || !createdAt || !preview || !renderMode) return null;
        return {
          ...(scope ? { scope } : {}),
          category,
          createdAt,
          preview,
          renderMode,
          queryScore,
          isContextFlush: entry.isContextFlush === true,
          ...(Array.isArray(entry.matchReasons)
            ? {
                matchReasons: entry.matchReasons
                  .map((value) => typeof value === 'string' ? sanitizeTimelineText(value) : undefined)
                  .filter((value): value is string => !!value)
                  .slice(0, 3),
              }
            : {}),
        };
      })
      .filter((entry): entry is DashboardRunTimelineContextMemoryEntry => !!entry)
    : [];
  const selectedMemoryEntryCount = typeof metadata.selectedMemoryEntryCount === 'number' && Number.isFinite(metadata.selectedMemoryEntryCount)
    ? metadata.selectedMemoryEntryCount
    : undefined;
  const omittedMemoryEntryCount = typeof metadata.omittedMemoryEntryCount === 'number' && Number.isFinite(metadata.omittedMemoryEntryCount)
    ? metadata.omittedMemoryEntryCount
    : undefined;
  const sectionFootprints = Array.isArray(metadata.sectionFootprints)
    ? metadata.sectionFootprints
      .map((entry) => {
        if (!isRecord(entry)) return null;
        const section = nonEmptyText(typeof entry.section === 'string' ? entry.section : undefined);
        const chars = typeof entry.chars === 'number' && Number.isFinite(entry.chars) ? entry.chars : null;
        const included = entry.included === true || entry.included === false ? entry.included : null;
        const mode = nonEmptyText(typeof entry.mode === 'string' ? entry.mode : undefined);
        const itemCount = typeof entry.itemCount === 'number' && Number.isFinite(entry.itemCount) ? entry.itemCount : undefined;
        if (!section || chars === null || included === null) return null;
        return {
          section,
          chars,
          included,
          ...(mode ? { mode } : {}),
          ...(typeof itemCount === 'number' ? { itemCount } : {}),
        };
      })
      .filter((entry): entry is NonNullable<DashboardRunTimelineContextAssembly['sectionFootprints']>[number] => !!entry)
    : [];
  const preservedExecutionState = isRecord(metadata.preservedExecutionState)
    ? {
        ...(sanitizeTimelineText(typeof metadata.preservedExecutionState.objective === 'string' ? metadata.preservedExecutionState.objective : undefined)
          ? { objective: sanitizeTimelineText(typeof metadata.preservedExecutionState.objective === 'string' ? metadata.preservedExecutionState.objective : undefined) }
          : {}),
        ...(sanitizeTimelineText(typeof metadata.preservedExecutionState.blockerSummary === 'string' ? metadata.preservedExecutionState.blockerSummary : undefined)
          ? { blockerSummary: sanitizeTimelineText(typeof metadata.preservedExecutionState.blockerSummary === 'string' ? metadata.preservedExecutionState.blockerSummary : undefined) }
          : {}),
        ...(Array.isArray(metadata.preservedExecutionState.activeExecutionRefs)
          ? {
              activeExecutionRefs: metadata.preservedExecutionState.activeExecutionRefs
                .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
                .map((value) => value.trim()),
            }
          : {}),
        ...(sanitizeTimelineText(typeof metadata.preservedExecutionState.maintainedSummarySource === 'string' ? metadata.preservedExecutionState.maintainedSummarySource : undefined)
          ? { maintainedSummarySource: sanitizeTimelineText(typeof metadata.preservedExecutionState.maintainedSummarySource === 'string' ? metadata.preservedExecutionState.maintainedSummarySource : undefined) }
          : {}),
      }
    : undefined;
  const skillInstructionSkillIds = Array.isArray(metadata.skillInstructionSkillIds)
    ? metadata.skillInstructionSkillIds
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.trim())
    : [];
  const skillResourceSkillIds = Array.isArray(metadata.skillResourceSkillIds)
    ? metadata.skillResourceSkillIds
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.trim())
    : [];
  const skillResourcePaths = Array.isArray(metadata.skillResourcePaths)
    ? metadata.skillResourcePaths
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.trim())
    : [];
  const skillPromptCacheHits = Array.isArray(metadata.skillPromptCacheHits)
    ? metadata.skillPromptCacheHits
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.trim())
    : [];
  const skillPromptLoadReasons = Array.isArray(metadata.skillPromptLoadReasons)
    ? metadata.skillPromptLoadReasons
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.trim())
    : [];
  const skillArtifactReferences = Array.isArray(metadata.skillArtifactReferences)
    ? metadata.skillArtifactReferences
        .filter((entry): entry is DashboardRunTimelineSkillArtifactReference => {
          return !!entry
            && typeof entry === 'object'
            && typeof (entry as Record<string, unknown>).skillId === 'string'
            && typeof (entry as Record<string, unknown>).slug === 'string'
            && typeof (entry as Record<string, unknown>).title === 'string'
            && (((entry as Record<string, unknown>).scope === 'global') || ((entry as Record<string, unknown>).scope === 'coding_session'))
            && typeof (entry as Record<string, unknown>).sourceClass === 'string';
        })
        .map((entry) => ({
          skillId: entry.skillId.trim(),
          scope: entry.scope,
          slug: entry.slug.trim(),
          title: sanitizeTimelineText(entry.title) ?? entry.title.trim(),
          sourceClass: entry.sourceClass.trim(),
        }))
    : [];
  const contextAssembly: DashboardRunTimelineContextAssembly = {
    ...(sanitizeTimelineText(typeof metadata.summary === 'string' ? metadata.summary : undefined) ? { summary: sanitizeTimelineText(typeof metadata.summary === 'string' ? metadata.summary : undefined) } : {}),
    ...(sanitizeTimelineText(typeof metadata.detail === 'string' ? metadata.detail : undefined) ? { detail: sanitizeTimelineText(typeof metadata.detail === 'string' ? metadata.detail : undefined) } : {}),
    ...(memoryScope ? { memoryScope } : {}),
    ...(typeof metadata.knowledgeBaseLoaded === 'boolean' ? { knowledgeBaseLoaded: metadata.knowledgeBaseLoaded } : {}),
    ...(typeof metadata.codingMemoryLoaded === 'boolean' ? { codingMemoryLoaded: metadata.codingMemoryLoaded } : {}),
    ...(typeof metadata.codingMemoryChars === 'number' && Number.isFinite(metadata.codingMemoryChars)
      ? { codingMemoryChars: metadata.codingMemoryChars }
      : {}),
    ...(sanitizeTimelineText(typeof metadata.knowledgeBaseQueryPreview === 'string' ? metadata.knowledgeBaseQueryPreview : undefined)
      ? { knowledgeBaseQueryPreview: sanitizeTimelineText(typeof metadata.knowledgeBaseQueryPreview === 'string' ? metadata.knowledgeBaseQueryPreview : undefined) }
      : {}),
    ...(nonEmptyText(typeof metadata.continuityKey === 'string' ? metadata.continuityKey : undefined)
      ? { continuityKey: nonEmptyText(typeof metadata.continuityKey === 'string' ? metadata.continuityKey : undefined) }
      : {}),
    ...(Array.isArray(metadata.activeExecutionRefs)
      ? {
          activeExecutionRefs: metadata.activeExecutionRefs
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            .map((value) => value.trim()),
        }
      : {}),
    ...(typeof metadata.linkedSurfaceCount === 'number' && Number.isFinite(metadata.linkedSurfaceCount)
      ? { linkedSurfaceCount: metadata.linkedSurfaceCount }
      : {}),
    ...(skillInstructionSkillIds.length > 0 ? { skillInstructionSkillIds } : {}),
    ...(skillResourceSkillIds.length > 0 ? { skillResourceSkillIds } : {}),
    ...(skillResourcePaths.length > 0 ? { skillResourcePaths } : {}),
    ...(typeof metadata.skillPromptCacheHitCount === 'number' && Number.isFinite(metadata.skillPromptCacheHitCount)
      ? { skillPromptCacheHitCount: metadata.skillPromptCacheHitCount }
      : {}),
    ...(skillPromptCacheHits.length > 0 ? { skillPromptCacheHits } : {}),
    ...(skillPromptLoadReasons.length > 0 ? { skillPromptLoadReasons } : {}),
    ...(skillArtifactReferences.length > 0 ? { skillArtifactReferences } : {}),
    ...(typeof selectedMemoryEntryCount === 'number' ? { selectedMemoryEntryCount } : {}),
    ...(typeof omittedMemoryEntryCount === 'number' ? { omittedMemoryEntryCount } : {}),
    ...(selectedMemoryEntries.length > 0 ? { selectedMemoryEntries } : {}),
    ...(metadata.contextCompactionApplied === true ? { contextCompactionApplied: true } : {}),
    ...(typeof metadata.contextCharsBeforeCompaction === 'number' && Number.isFinite(metadata.contextCharsBeforeCompaction)
      ? { contextCharsBeforeCompaction: metadata.contextCharsBeforeCompaction }
      : {}),
    ...(typeof metadata.contextCharsAfterCompaction === 'number' && Number.isFinite(metadata.contextCharsAfterCompaction)
      ? { contextCharsAfterCompaction: metadata.contextCharsAfterCompaction }
      : {}),
    ...(Array.isArray(metadata.contextCompactionStages)
      ? {
          contextCompactionStages: metadata.contextCompactionStages
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            .map((value) => value.trim()),
        }
      : {}),
    ...(sanitizeTimelineText(typeof metadata.compactedSummaryPreview === 'string' ? metadata.compactedSummaryPreview : undefined)
      ? { compactedSummaryPreview: sanitizeTimelineText(typeof metadata.compactedSummaryPreview === 'string' ? metadata.compactedSummaryPreview : undefined) }
      : {}),
    ...(sectionFootprints.length > 0 ? { sectionFootprints } : {}),
    ...(preservedExecutionState && Object.keys(preservedExecutionState).length > 0 ? { preservedExecutionState } : {}),
  };
  return Object.keys(contextAssembly).length > 0 ? contextAssembly : undefined;
}

function mapTraceNodeKind(kind: WorkflowTraceNode['kind']): {
  type: DashboardRunTimelineItemType;
  status: DashboardRunTimelineItem['status'];
  title: (name: string) => string;
} {
  switch (kind) {
    case 'handoff':
      return { type: 'handoff_started', status: 'running', title: (name) => `Handoff: ${name}` };
    case 'approval':
      return { type: 'approval_requested', status: 'blocked', title: (name) => `Approval: ${name}` };
    case 'verification':
      return { type: 'verification_pending', status: 'warning', title: (name) => `Verification: ${name}` };
    default:
      return { type: 'note', status: 'info', title: (name) => name };
  }
}

function humanizeToolName(value: string): string {
  return value
    .replace(/^mcp-[^-]+-/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function humanizeVerificationKind(kind: CodeSessionVerificationEntry['kind']): string {
  switch (kind) {
    case 'lint':
      return 'Lint';
    case 'build':
      return 'Build';
    case 'test':
      return 'Tests';
    default:
      return 'Verification';
  }
}

function nonEmptyText(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function sanitizeTimelineText(value: string | null | undefined): string | undefined {
  const normalized = nonEmptyText(value);
  if (!normalized) return undefined;
  const redacted = redactSensitiveText(normalized).trim();
  return redacted ? redacted : undefined;
}

function describeDelegatedWorkerTarget(event: DelegatedWorkerProgressEvent): string {
  return nonEmptyText(event.orchestrationLabel)
    ?? nonEmptyText(event.agentName)
    ?? nonEmptyText(event.agentId)
    ?? 'Delegated worker';
}

function buildDelegatedWorkerFollowUpTitle(event: DelegatedWorkerProgressEvent, targetName: string): string {
  const actionLabel = describeDelegatedWorkerFollowUpAction(event.operatorAction, event.operatorState);
  return `${actionLabel}: ${targetName}`;
}

function describeDelegatedWorkerFollowUpAction(
  operatorAction: DelegatedWorkerProgressEvent['operatorAction'],
  operatorState: DelegatedWorkerProgressEvent['operatorState'],
): string {
  if (operatorAction === 'replay' || operatorState === 'replayed') {
    return 'Held result replayed';
  }
  if (operatorAction === 'keep_held' || operatorState === 'kept_held') {
    return 'Held result kept';
  }
  if (operatorAction === 'dismiss' || operatorState === 'dismissed') {
    return 'Held result dismissed';
  }
  return 'Held result updated';
}

function normalizeDelegatedWorkerLenses(event: DelegatedWorkerProgressEvent): string[] {
  if (!Array.isArray(event.orchestrationLenses)) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const lens of event.orchestrationLenses) {
    const value = nonEmptyText(lens);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(value);
  }
  return normalized.slice(0, 6);
}

function normalizeLaneComparisonValue(value: string | undefined): string | undefined {
  const normalized = nonEmptyText(value);
  return normalized ? normalized.toLowerCase().replace(/[^a-z0-9]+/g, '') : undefined;
}

function buildDelegatedWorkerOrchestrationTags(event: DelegatedWorkerProgressEvent): string[] {
  return [
    ...(event.orchestrationRole ? [`orchestration:${event.orchestrationRole}`] : []),
    ...normalizeDelegatedWorkerLenses(event).map((lens) => `lens:${lens}`),
  ];
}

function buildDelegatedWorkerLaneSentence(event: DelegatedWorkerProgressEvent): string | undefined {
  const laneName = nonEmptyText(event.orchestrationLabel);
  const roleLabel = event.orchestrationRole ? humanizeWorkflowValue(event.orchestrationRole) : undefined;
  const laneKey = normalizeLaneComparisonValue(laneName);
  const lensLabels = normalizeDelegatedWorkerLenses(event)
    .filter((lens) => normalizeLaneComparisonValue(lens) !== laneKey)
    .slice(0, 3)
    .map((lens) => humanizeWorkflowValue(lens));
  if (!roleLabel && lensLabels.length === 0) return undefined;
  const qualifiers = [
    roleLabel,
    ...(lensLabels.length > 0 ? lensLabels : []),
  ].filter((value): value is string => Boolean(value));
  if (laneName) {
    return qualifiers.length > 0
      ? `Specialist lane: ${laneName} (${qualifiers.join('; ')}).`
      : `Specialist lane: ${laneName}.`;
  }
  if (roleLabel) {
    return lensLabels.length > 0
      ? `Specialist lane: ${roleLabel} (${lensLabels.join('; ')}).`
      : `Specialist lane: ${roleLabel}.`;
  }
  return `Specialist lane lenses: ${lensLabels.join('; ')}.`;
}

function normalizeDelegatedWorkerProfileTier(value: string | null | undefined): string | undefined {
  const normalized = nonEmptyText(value);
  return normalized ? normalized.replaceAll('_', '-') : undefined;
}

function describeDelegatedWorkerExecutionProfile(event: DelegatedWorkerProgressEvent): string | undefined {
  const profileName = nonEmptyText(event.executionProfileName);
  const profileModel = nonEmptyText(event.executionProfileModel);
  const profileTier = normalizeDelegatedWorkerProfileTier(event.executionProfileTier);
  if (!profileName && !profileModel) return undefined;
  if (!profileName) {
    return profileModel ? `model ${profileModel}` : undefined;
  }
  const base = profileTier ? `${profileTier} profile ${profileName}` : `profile ${profileName}`;
  return profileModel && profileModel !== profileName ? `${base} (${profileModel})` : base;
}

function buildDelegatedWorkerExecutionProfileSentence(event: DelegatedWorkerProgressEvent): string | undefined {
  const label = describeDelegatedWorkerExecutionProfile(event);
  return label ? `Execution profile: ${label}.` : undefined;
}

function buildDelegatedExecutionCompletionTitle(
  toolName: string | undefined,
  event: ExecutionEvent,
): string {
  const resultStatus = nonEmptyText(typeof event.payload.resultStatus === 'string' ? event.payload.resultStatus : undefined)?.toLowerCase();
  if (resultStatus === 'pending_approval' || resultStatus === 'blocked') {
    return `Tool blocked: ${humanizeToolName(toolName ?? 'tool')}`;
  }
  if (resultStatus === 'failed' || resultStatus === 'denied' || resultStatus === 'error' || nonEmptyText(typeof event.payload.errorMessage === 'string' ? event.payload.errorMessage : undefined)) {
    return `Tool failed: ${humanizeToolName(toolName ?? 'tool')}`;
  }
  return `Tool completed: ${humanizeToolName(toolName ?? 'tool')}`;
}

function buildDelegatedExecutionEventDetail(event: ExecutionEvent): string | undefined {
  const detailParts = [
    nonEmptyText(typeof event.payload.resultMessage === 'string' ? event.payload.resultMessage : undefined),
    nonEmptyText(typeof event.payload.errorMessage === 'string' ? event.payload.errorMessage : undefined),
    nonEmptyText(typeof event.payload.prompt === 'string' ? event.payload.prompt : undefined),
    nonEmptyText(typeof event.payload.summary === 'string' ? event.payload.summary : undefined),
    Array.isArray(event.payload.reasons)
      ? event.payload.reasons
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          .join(' ')
      : undefined,
  ].filter((value): value is string => !!value);
  const detail = detailParts.join('\n');
  return truncateText(detail || undefined, 220);
}

function mapDelegatedExecutionEventStatus(event: ExecutionEvent): DashboardRunTimelineItem['status'] {
  const resultStatus = nonEmptyText(typeof event.payload.resultStatus === 'string' ? event.payload.resultStatus : undefined)?.toLowerCase();
  const decision = nonEmptyText(typeof event.payload.decision === 'string' ? event.payload.decision : undefined)?.toLowerCase();
  switch (event.type) {
    case 'tool_call_started':
      return 'running';
    case 'tool_call_completed':
      if (resultStatus === 'pending_approval' || resultStatus === 'blocked') return 'blocked';
      if (resultStatus === 'failed' || resultStatus === 'denied' || resultStatus === 'error') return 'failed';
      if (nonEmptyText(typeof event.payload.errorMessage === 'string' ? event.payload.errorMessage : undefined)) return 'failed';
      return 'succeeded';
    case 'interruption_requested':
      return 'blocked';
    case 'interruption_resolved':
      return 'succeeded';
    case 'claim_emitted':
      return 'info';
    case 'verification_decided':
    default:
      if (decision === 'satisfied') return 'succeeded';
      if (decision === 'blocked' || decision === 'policy_blocked') return 'blocked';
      if (decision === 'insufficient') return 'warning';
      if (decision === 'contradicted') return 'failed';
      return 'info';
  }
}

function buildDelegatedWorkerProgressDetail(event: DelegatedWorkerProgressEvent): string | undefined {
  const detail = sanitizeTimelineText(event.detail);
  const laneSentence = buildDelegatedWorkerLaneSentence(event);
  const profileSentence = buildDelegatedWorkerExecutionProfileSentence(event);
  const lines = detail ? [detail] : [];
  const normalizedDetail = detail?.toLowerCase() ?? '';
  if (laneSentence && !normalizedDetail.includes('specialist lane:')) {
    lines.push(laneSentence);
  }
  if (profileSentence) {
    const profileName = nonEmptyText(event.executionProfileName)?.toLowerCase();
    const profileModel = nonEmptyText(event.executionProfileModel)?.toLowerCase();
    if (!((profileName && normalizedDetail.includes(profileName)) || (profileModel && normalizedDetail.includes(profileModel)))) {
      lines.push(profileSentence);
    }
  }
  return lines.join('\n') || undefined;
}

function buildDelegatedWorkerTaskSubtitle(
  event: DelegatedWorkerProgressEvent,
  parentRunId: string,
): string | undefined {
  const base = nonEmptyText(event.requestPreview)
    ?? nonEmptyText(event.detail)
    ?? `Parent run ${parentRunId}`;
  const profileLabel = describeDelegatedWorkerExecutionProfile(event);
  return truncateText(
    profileLabel ? `${base} Uses ${profileLabel}.` : base,
    160,
  );
}

function buildDelegatedWorkerContextAssembly(
  event: DelegatedWorkerProgressEvent,
): DashboardRunTimelineContextAssembly | undefined {
  const continuityKey = nonEmptyText(event.continuityKey);
  const activeExecutionRefs = Array.isArray(event.activeExecutionRefs)
    ? event.activeExecutionRefs
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => value.trim())
    : [];
  const orchestrationLabel = nonEmptyText(event.orchestrationLabel);
  const orchestrationLenses = normalizeDelegatedWorkerLenses(event);
  if (!continuityKey && activeExecutionRefs.length === 0 && !event.orchestrationRole && !orchestrationLabel && orchestrationLenses.length === 0) {
    return undefined;
  }
  return {
    ...(continuityKey ? { continuityKey } : {}),
    ...(activeExecutionRefs.length > 0 ? { activeExecutionRefs } : {}),
    ...(event.orchestrationRole ? { orchestrationRole: event.orchestrationRole } : {}),
    ...(orchestrationLabel ? { orchestrationLabel } : {}),
    ...(orchestrationLenses.length > 0 ? { orchestrationLenses } : {}),
  };
}

function truncateText(value: string | undefined, maxLength: number): string | undefined {
  const normalized = sanitizeTimelineText(value);
  if (!normalized) return undefined;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1))}…`;
}

function mapDelegatedWorkerProgressStatus(event: DelegatedWorkerProgressEvent): DashboardRunStatus {
  switch (event.kind) {
    case 'started':
    case 'running':
      return 'running';
    case 'blocked':
      return event.unresolvedBlockerKind === 'approval' ? 'awaiting_approval' : 'blocked';
    case 'completed':
    case 'followup_action':
      return 'completed';
    case 'failed':
    default:
      return 'failed';
  }
}

function mergeTags(left: string[], right: string[]): string[] {
  return [...new Set([...left, ...right].filter((value): value is string => !!nonEmptyText(value)))];
}

function runSummaryHasTag(detail: DashboardRunDetail, tag: string): boolean {
  const normalized = nonEmptyText(tag);
  return !!normalized && detail.summary.tags.includes(normalized);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
