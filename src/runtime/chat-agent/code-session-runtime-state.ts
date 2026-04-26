import {
  isRecord,
  toString,
} from '../../chat-agent-helpers.js';
import type { CodeSessionRecord, CodeSessionStore } from '../code-sessions.js';
import {
  deriveCodeSessionWorkflowState,
  type CodeSessionWorkflowType,
} from '../coding-workflows.js';
import { getEffectiveCodeWorkspaceTrustState } from '../code-workspace-trust.js';
import type { PromptAssemblyDiagnostics } from '../context-assembly.js';
import type { ToolExecutor } from '../../tools/executor.js';
import type { ToolJobRecord } from '../../tools/types.js';
import type { ResolvedSkill } from '../../skills/types.js';

export type CodePlanToolResult = {
  toolName: string;
  result: Record<string, unknown>;
};

type CodeSessionRuntimeTools = Pick<
  ToolExecutor,
  | 'getApprovalSummaries'
  | 'getRemoteExecutionTargets'
  | 'listJobs'
  | 'listJobsForCodeSession'
  | 'listPendingApprovalsForCodeSession'
>;

export interface CodeSessionRuntimeStateInput {
  codeSessionStore?: Pick<CodeSessionStore, 'updateSession'> | null;
  tools?: CodeSessionRuntimeTools | null;
  session: CodeSessionRecord;
  conversationUserId: string;
  conversationChannel: string;
  activeSkills: Array<Pick<ResolvedSkill, 'id'>>;
  lastToolRoundResults?: CodePlanToolResult[];
  runtimeState?: {
    contextAssembly?: PromptAssemblyDiagnostics;
    responseSource?: unknown;
    requestId?: string;
  };
  getPendingApprovals: (userKey: string) => { ids: string[] } | null | undefined;
  now?: () => number;
}

export function formatCodePlanSummary(results: CodePlanToolResult[]): string {
  const planResult = results.find((entry) => entry.toolName === 'code_plan');
  if (!planResult || !isRecord(planResult.result.output)) return '';
  const output = planResult.result.output as Record<string, unknown>;
  const goal = toString(output.goal);
  const workflow = isRecord(output.workflow) ? output.workflow : null;
  const execution = isRecord(output.execution) ? output.execution : null;
  const isolation = execution && isRecord(execution.isolation) ? execution.isolation : null;
  const plan = Array.isArray(output.plan) ? output.plan.map((step) => `- ${String(step)}`) : [];
  const verification = Array.isArray(output.verification)
    ? output.verification.map((step) => `- ${String(step)}`)
    : [];
  const isolationLevel = toString(isolation?.level).trim();
  const isolationLines = isolation && isolationLevel && isolationLevel !== 'none'
    ? [
        isolationLevel
          ? `- Level: ${isolationLevel}`
          : '',
        toString(isolation.backendKind).trim()
          ? `- Backend: ${toString(isolation.backendKind).trim()}`
          : '',
        toString(isolation.profileId).trim()
          ? `- Profile: ${toString(isolation.profileId).trim()}`
          : '',
        Array.isArray(isolation.candidateOperations) && isolation.candidateOperations.length > 0
          ? `- Candidate operations: ${isolation.candidateOperations.map((value) => String(value)).join(', ')}`
          : '',
        toString(isolation.reason).trim()
          ? `- Reason: ${toString(isolation.reason).trim()}`
          : '',
      ].filter((value) => value)
    : [];
  const sections = [
    goal ? `Goal: ${goal}` : '',
    workflow?.label ? `Workflow: ${toString(workflow.label)}` : '',
    plan.length > 0 ? `Plan:\n${plan.join('\n')}` : '',
    verification.length > 0 ? `Verification:\n${verification.join('\n')}` : '',
    isolationLines.length > 0 ? `Isolation:\n${isolationLines.join('\n')}` : '',
  ].filter((value) => value);
  return sections.join('\n\n');
}

export function extractPlannedWorkflowType(results: CodePlanToolResult[]): CodeSessionWorkflowType | null {
  const planResult = results.find((entry) => entry.toolName === 'code_plan');
  if (!planResult || !isRecord(planResult.result.output)) return null;
  const output = planResult.result.output as Record<string, unknown>;
  const workflow = isRecord(output.workflow) ? output.workflow : null;
  const value = toString(workflow?.type).trim();
  if (value === 'implementation'
    || value === 'bug_fix'
    || value === 'code_review'
    || value === 'refactor'
    || value === 'test_repair'
    || value === 'dependency_review'
    || value === 'spec_to_plan') {
    return value;
  }
  return null;
}

export function syncCodeSessionRuntimeState(input: CodeSessionRuntimeStateInput): void {
  if (!input.codeSessionStore) return;
  const lastToolRoundResults = input.lastToolRoundResults ?? [];
  const sessionPendingApprovals = input.tools?.listPendingApprovalsForCodeSession(input.session.id, 20) ?? [];
  const pending = sessionPendingApprovals.length === 0
    ? input.getPendingApprovals(`${input.conversationUserId}:${input.conversationChannel}`)
    : null;
  const approvalSummaries = pending?.ids.length
    ? input.tools?.getApprovalSummaries(pending.ids)
    : undefined;
  const pendingApprovals = sessionPendingApprovals.length > 0
    ? sessionPendingApprovals
    : pending?.ids.length
      ? pending.ids.map((id) => {
          const summary = approvalSummaries?.get(id);
          return {
            id,
            toolName: summary?.toolName ?? 'unknown',
            argsPreview: summary?.argsPreview ?? '',
            actionLabel: summary?.actionLabel ?? '',
          };
        })
      : [];
  const sessionJobs = input.tools?.listJobsForCodeSession(input.session.id, 100) ?? [];
  const recentJobs = (sessionJobs.length > 0
    ? sessionJobs
    : (input.tools?.listJobs(100) ?? [])
      .filter((job) => job.userId === input.conversationUserId && job.channel === input.conversationChannel))
    .slice(0, 20)
    .map((job: ToolJobRecord) => ({
      id: job.id,
      toolName: job.toolName,
      status: job.status,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      durationMs: job.durationMs,
      resultPreview: job.resultPreview,
      argsPreview: job.argsPreview,
      error: job.error,
      verificationStatus: job.verificationStatus,
      verificationEvidence: job.verificationEvidence,
      approvalId: job.approvalId,
      requestId: job.requestId,
      remoteExecution: job.remoteExecution
        ? { ...job.remoteExecution }
        : undefined,
    }));
  const planSummary = formatCodePlanSummary(lastToolRoundResults) || input.session.workState.planSummary;
  const workflow = deriveCodeSessionWorkflowState({
    focusSummary: input.session.workState.focusSummary,
    planSummary,
    pendingApprovals,
    recentJobs,
    verification: input.session.workState.verification,
    previous: input.session.workState.workflow,
    plannedWorkflowType: extractPlannedWorkflowType(lastToolRoundResults),
    hasRepoEvidence: Boolean(
      input.session.workState.workspaceProfile?.summary
        || input.session.workState.workspaceMap?.indexedFileCount
        || input.session.workState.workingSet?.files?.length,
    ),
    workspaceTrustState: getEffectiveCodeWorkspaceTrustState(
      input.session.workState.workspaceTrust,
      input.session.workState.workspaceTrustReview,
    ) ?? input.session.workState.workspaceTrust?.state ?? null,
    remoteExecutionTargets: input.tools?.getRemoteExecutionTargets?.(),
  });
  const nextCompactedSummary = input.runtimeState?.contextAssembly?.compactedSummaryPreview
    || (
      input.runtimeState?.contextAssembly?.contextCompactionApplied
        && typeof input.runtimeState.contextAssembly.contextCharsBeforeCompaction === 'number'
        && typeof input.runtimeState.contextAssembly.contextCharsAfterCompaction === 'number'
        ? `Older context was compacted from ${input.runtimeState.contextAssembly.contextCharsBeforeCompaction} to ${input.runtimeState.contextAssembly.contextCharsAfterCompaction} chars.${Array.isArray(input.runtimeState.contextAssembly.contextCompactionStages) && input.runtimeState.contextAssembly.contextCompactionStages.length > 0 ? ` Stages: ${input.runtimeState.contextAssembly.contextCompactionStages.join(', ')}.` : ''}`
        : input.session.workState.compactedSummary
    );
  const compactedSummaryUpdatedAt = nextCompactedSummary && nextCompactedSummary !== input.session.workState.compactedSummary
    ? (input.now ?? Date.now)()
    : input.session.workState.compactedSummaryUpdatedAt;
  const compactedSummary = nextCompactedSummary;
  const status = pendingApprovals.length > 0
    ? 'awaiting_approval'
    : recentJobs.some((job) => job.status === 'failed' || job.status === 'denied')
      ? 'blocked'
      : recentJobs.some((job) => job.status === 'running')
        ? 'active'
        : 'active';

  input.codeSessionStore.updateSession({
    sessionId: input.session.id,
    ownerUserId: input.session.ownerUserId,
    status,
    workState: {
      ...input.session.workState,
      focusSummary: input.session.workState.focusSummary,
      workspaceProfile: input.session.workState.workspaceProfile,
      planSummary,
      compactedSummary,
      compactedSummaryUpdatedAt,
      workflow,
      activeSkills: input.activeSkills.map((skill) => skill.id),
      pendingApprovals,
      recentJobs,
    },
  });
}
