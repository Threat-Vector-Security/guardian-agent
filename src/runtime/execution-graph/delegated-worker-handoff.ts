import type {
  DelegatedWorkerHandoff,
  DelegatedWorkerReportingMode,
  DelegatedWorkerRunClass,
} from '../assistant-jobs.js';
import { readDelegatedResultEnvelope } from '../execution/metadata.js';
import type {
  DelegatedResultEnvelope,
  VerificationDecision,
} from '../execution/types.js';
import type { OrchestrationRoleDescriptor } from '../orchestration-role-descriptors.js';
import { readWorkerExecutionMetadata } from '../worker-execution-metadata.js';

const AUTOMATION_OWNED_CHANNELS = new Set(['automation', 'scheduled']);

export interface DelegatedInsufficientResultHandoffInput {
  failureSummary: string;
  decision: Pick<VerificationDecision, 'requiredNextAction'>;
}

export interface DelegatedWorkerRunClassPolicyInput {
  requestedRunClass?: unknown;
  originChannel?: string;
  codeSessionId?: string;
  orchestration?: OrchestrationRoleDescriptor;
  directReasoning?: boolean;
}

export interface DelegatedWorkerFollowUpPolicyInput {
  runClass: DelegatedWorkerRunClass;
  lifecycle: 'completed' | 'blocked' | 'failed';
  blockerKind?: string;
  requiredNextAction?: string;
}

export interface DelegatedWorkerFollowUpPolicy {
  nextAction: string;
  reportingMode: DelegatedWorkerReportingMode;
  operatorState?: DelegatedWorkerHandoff['operatorState'];
}

export function buildDelegatedInsufficientResultHandoff(
  insufficiency: DelegatedInsufficientResultHandoffInput,
  runClassInput?: DelegatedWorkerRunClass,
): DelegatedWorkerHandoff {
  return {
    summary: insufficiency.failureSummary,
    runClass: normalizeDelegatedWorkerRunClass(runClassInput),
    nextAction: insufficiency.decision.requiredNextAction
      ?? 'Inspect the delegated worker failure details before retrying.',
    reportingMode: 'inline_response',
  };
}

export function buildDelegatedHandoff(
  content: string,
  metadata: Record<string, unknown> | undefined,
  runClassInput?: DelegatedWorkerRunClass,
  verification?: VerificationDecision,
): DelegatedWorkerHandoff {
  const unresolvedBlockerKind = resolveDelegatedBlockedKind(metadata, verification);
  const lifecycle = resolveDelegatedWorkerLifecycle(metadata, unresolvedBlockerKind, verification);
  const summary = buildDelegatedFailureSummary(content, metadata, verification)
    ?? truncateDelegatedHandoffText(content, 220)
    ?? (lifecycle === 'failed' ? 'Delegated worker failed.' : 'Delegated worker completed.');
  const approvalCount = readApprovalSummaryCount(metadata);
  const runClass = normalizeDelegatedWorkerRunClass(runClassInput);
  const followUpPolicy = resolveDelegatedWorkerFollowUpPolicy({
    runClass,
    lifecycle,
    blockerKind: unresolvedBlockerKind,
    requiredNextAction: verification?.requiredNextAction,
  });

  return {
    summary,
    ...(unresolvedBlockerKind ? { unresolvedBlockerKind } : {}),
    ...(approvalCount > 0 ? { approvalCount } : {}),
    runClass,
    nextAction: followUpPolicy.nextAction,
    reportingMode: followUpPolicy.reportingMode,
    ...(followUpPolicy.operatorState ? { operatorState: followUpPolicy.operatorState } : {}),
    ...(verification?.qualityNotes && verification.qualityNotes.length > 0
      ? { qualityNotes: verification.qualityNotes }
      : {}),
  };
}

export function applyDelegatedFollowUpPolicy(
  result: { content: string; metadata?: Record<string, unknown> },
  handoff: DelegatedWorkerHandoff,
  verification?: VerificationDecision,
): { content: string; metadata?: Record<string, unknown> } {
  const lifecycle = resolveDelegatedWorkerLifecycle(result.metadata, handoff.unresolvedBlockerKind, verification);
  const metadata: Record<string, unknown> = {
    ...(result.metadata ?? {}),
    delegatedHandoff: handoff,
  };

  if (lifecycle === 'failed') {
    return {
      content: formatFailedDelegatedMessage(handoff),
      metadata,
    };
  }

  if (handoff.reportingMode !== 'status_only') {
    if (handoff.reportingMode === 'held_for_approval') {
      return {
        content: formatHeldForApprovalDelegatedMessage(handoff, metadata),
        metadata,
      };
    }
    if (handoff.reportingMode === 'held_for_operator') {
      return {
        content: formatHeldForOperatorDelegatedMessage(handoff),
        metadata,
      };
    }
    // Surface quality notes as a suffix when the verification is satisfied
    // but the answer has potential quality caveats.
    const qualitySuffix = (handoff.qualityNotes && handoff.qualityNotes.length > 0)
      ? `\n\n⚠️ ${handoff.qualityNotes.join(' ')}`
      : '';
    return {
      content: qualitySuffix ? `${result.content}${qualitySuffix}` : result.content,
      metadata,
    };
  }

  return {
    content: formatStatusOnlyDelegatedMessage(handoff, metadata),
    metadata,
  };
}

export function resolveDelegatedWorkerLifecycle(
  metadata: Record<string, unknown> | undefined,
  unresolvedBlockerKind?: string,
  verification?: VerificationDecision,
): 'completed' | 'blocked' | 'failed' {
  if (verification) {
    if (verification.decision === 'blocked' || verification.decision === 'policy_blocked') {
      return 'blocked';
    }
    if (verification.decision === 'insufficient' || verification.decision === 'contradicted') {
      return 'failed';
    }
    if (verification.decision === 'satisfied') {
      return 'completed';
    }
  }
  const workerExecution = readWorkerExecutionMetadata(metadata);
  if (workerExecution?.lifecycle) {
    return workerExecution.lifecycle;
  }
  return unresolvedBlockerKind ? 'blocked' : 'completed';
}

export function normalizeDelegatedWorkerRunClass(value: unknown): DelegatedWorkerRunClass {
  return readDelegatedWorkerRunClass(value) ?? 'short_lived';
}

export function resolveDelegatedWorkerRunClass(
  input: DelegatedWorkerRunClassPolicyInput,
): DelegatedWorkerRunClass {
  const requested = readDelegatedWorkerRunClass(input.requestedRunClass);
  if (requested) return requested;

  const originChannel = normalizeRunClassPolicyText(input.originChannel)?.toLowerCase();
  if (originChannel && AUTOMATION_OWNED_CHANNELS.has(originChannel)) {
    return 'automation_owned';
  }

  if (input.directReasoning) {
    return 'in_invocation';
  }

  if (normalizeRunClassPolicyText(input.codeSessionId) || hasDelegatedOrchestrationLens(input.orchestration, 'coding-workspace')) {
    return 'long_running';
  }

  if (input.orchestration?.role === 'coordinator') {
    return 'in_invocation';
  }

  return 'short_lived';
}

export function resolveDelegatedWorkerFollowUpPolicy(
  input: DelegatedWorkerFollowUpPolicyInput,
): DelegatedWorkerFollowUpPolicy {
  if (input.blockerKind === 'approval') {
    return {
      nextAction: 'Resolve the pending approval(s) to continue the delegated run.',
      reportingMode: 'held_for_approval',
    };
  }

  if (input.blockerKind === 'clarification') {
    return {
      nextAction: 'Resolve the clarification to continue the delegated run.',
      reportingMode: 'status_only',
    };
  }

  if (input.blockerKind === 'workspace_switch') {
    return {
      nextAction: 'Switch to the requested coding workspace to continue the delegated run.',
      reportingMode: 'status_only',
    };
  }

  if (input.blockerKind === 'policy_blocked') {
    return {
      nextAction: input.requiredNextAction ?? 'Resolve the policy blocker before retrying.',
      reportingMode: 'status_only',
    };
  }

  if (input.lifecycle === 'failed') {
    return {
      nextAction: input.requiredNextAction ?? 'Inspect the delegated worker failure details before retrying.',
      reportingMode: 'inline_response',
    };
  }

  if (input.runClass === 'long_running' || input.runClass === 'automation_owned') {
    return {
      nextAction: input.requiredNextAction ?? 'Replay or dismiss the held delegated result.',
      reportingMode: 'held_for_operator',
      operatorState: 'pending',
    };
  }

  return {
    nextAction: input.requiredNextAction ?? 'Result returned inline to the original conversation.',
    reportingMode: 'inline_response',
  };
}

export function formatFailedDelegatedMessage(handoff: DelegatedWorkerHandoff): string {
  const parts = [
    'Delegated work failed.',
    handoff.summary,
    handoff.nextAction,
  ].filter((value) => typeof value === 'string' && value.trim().length > 0);
  return [...new Set(parts)].join('\n');
}

function readDelegatedWorkerRunClass(value: unknown): DelegatedWorkerRunClass | undefined {
  switch (value) {
    case 'in_invocation':
    case 'short_lived':
    case 'long_running':
    case 'automation_owned':
      return value;
    default:
      return undefined;
  }
}

function hasDelegatedOrchestrationLens(
  orchestration: OrchestrationRoleDescriptor | undefined,
  lens: string,
): boolean {
  return (orchestration?.lenses ?? []).some((value) => normalizeRunClassPolicyText(value) === lens);
}

function normalizeRunClassPolicyText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readApprovalSummaryCount(metadata: Record<string, unknown> | undefined): number {
  const approvalInterruption = readDelegatedApprovalInterruption(metadata);
  if (approvalInterruption) {
    return approvalInterruption.approvalSummaries?.length ?? 0;
  }
  const workerExecution = readWorkerExecutionMetadata(metadata);
  if (typeof workerExecution?.pendingApprovalCount === 'number') {
    return workerExecution.pendingApprovalCount;
  }
  const pendingAction = metadata?.pendingAction;
  if (!isRecord(pendingAction) || !isRecord(pendingAction.blocker) || !Array.isArray(pendingAction.blocker.approvalSummaries)) {
    return 0;
  }
  return pendingAction.blocker.approvalSummaries.length;
}

function readPendingActionKind(metadata: Record<string, unknown> | undefined): string | undefined {
  const interruptionKind = readDelegatedInterruptionKind(metadata);
  if (interruptionKind) {
    return interruptionKind;
  }
  const workerExecution = readWorkerExecutionMetadata(metadata);
  if (workerExecution?.blockerKind?.trim()) {
    return workerExecution.blockerKind.trim();
  }
  const pendingAction = metadata?.pendingAction;
  if (!isRecord(pendingAction) || !isRecord(pendingAction.blocker)) return undefined;
  const kind = pendingAction.blocker.kind;
  return typeof kind === 'string' && kind.trim() ? kind.trim() : undefined;
}

function buildDelegatedFailureSummary(
  content: string,
  metadata: Record<string, unknown> | undefined,
  verification?: VerificationDecision,
): string | undefined {
  if (verification && verification.decision !== 'satisfied' && verification.decision !== 'blocked') {
    return verification.reasons[0]
      ?? verification.requiredNextAction
      ?? 'Delegated worker did not satisfy the task contract.';
  }
  const delegatedEnvelope = readDelegatedResultEnvelope(metadata);
  if (delegatedEnvelope) {
    if (delegatedEnvelope.runStatus === 'max_turns') {
      return 'Delegated worker ran out of turns before satisfying every required step.';
    }
    if (delegatedEnvelope.runStatus === 'incomplete') {
      const unsatisfied = delegatedEnvelope.stepReceipts
        .filter((receipt) => receipt.status !== 'satisfied')
        .map((receipt) => receipt.stepId);
      return unsatisfied.length > 0
        ? `Delegated worker stopped before satisfying required steps: ${formatDelegatedStepIds(unsatisfied)}.`
        : 'Delegated worker stopped before satisfying the task contract.';
    }
    if (delegatedEnvelope.runStatus === 'failed' && delegatedEnvelope.stopReason === 'error') {
      return 'Delegated worker failed before satisfying the required steps.';
    }
  }
  const workerExecution = readWorkerExecutionMetadata(metadata);
  if (!workerExecution || workerExecution.lifecycle !== 'failed') {
    return undefined;
  }
  if (workerExecution.completionReason === 'phantom_approval_response') {
    return 'Delegated worker claimed approval was required without creating a real approval request.';
  }
  if (
    workerExecution.completionReason === 'degraded_response'
    || workerExecution.completionReason === 'empty_response_fallback'
    || workerExecution.responseQuality === 'degraded'
  ) {
    return 'Delegated worker did not produce a usable terminal result.';
  }
  const summary = truncateDelegatedHandoffText(content, 220);
  return summary || 'Delegated worker failed.';
}

function formatStatusOnlyDelegatedMessage(
  handoff: DelegatedWorkerHandoff,
  metadata: Record<string, unknown>,
): string {
  const header = handoff.unresolvedBlockerKind === 'clarification'
    ? 'Delegated work is paused: clarification required.'
    : handoff.unresolvedBlockerKind === 'workspace_switch'
      ? 'Delegated work is paused: workspace switch required.'
      : handoff.unresolvedBlockerKind === 'policy_blocked'
        ? 'Delegated work is paused: policy blocker must be resolved.'
        : 'Delegated work is paused.';
  const blockerPrompt = readPendingActionPrompt(metadata);
  const parts = [
    header,
    blockerPrompt,
    handoff.summary,
    handoff.nextAction,
  ].filter((value) => typeof value === 'string' && value.trim().length > 0);
  return [...new Set(parts)].join('\n');
}

function formatHeldForOperatorDelegatedMessage(handoff: DelegatedWorkerHandoff): string {
  const parts = [
    'Delegated work completed and is held for operator review.',
    handoff.summary,
    handoff.nextAction,
  ].filter((value) => typeof value === 'string' && value.trim().length > 0);
  return [...new Set(parts)].join('\n');
}

function formatHeldForApprovalDelegatedMessage(
  handoff: DelegatedWorkerHandoff,
  metadata: Record<string, unknown>,
): string {
  const blockerPrompt = readPendingActionPrompt(metadata);
  const progress = formatDelegatedProgressForApprovalPause(metadata);
  const parts = [
    'Delegated work is paused: approval required.',
    blockerPrompt,
    progress,
    handoff.summary,
    handoff.nextAction,
  ].filter((value) => typeof value === 'string' && value.trim().length > 0);
  return [...new Set(parts)].join('\n');
}

function formatDelegatedProgressForApprovalPause(metadata: Record<string, unknown>): string | undefined {
  const envelope = readDelegatedResultEnvelope(metadata);
  if (!envelope || envelope.evidenceReceipts.length === 0) {
    return undefined;
  }
  const succeeded = uniqueSortedToolNames(envelope.evidenceReceipts
    .filter((receipt) => receipt.sourceType === 'tool_call' && receipt.status === 'succeeded')
    .map((receipt) => receipt.toolName));
  const failed = uniqueSortedToolNames(envelope.evidenceReceipts
    .filter((receipt) => receipt.sourceType === 'tool_call' && receipt.status === 'failed')
    .map((receipt) => receipt.toolName));
  const pending = uniqueSortedToolNames(envelope.evidenceReceipts
    .filter((receipt) => receipt.sourceType === 'tool_call' && (receipt.status === 'pending_approval' || receipt.status === 'blocked'))
    .map((receipt) => receipt.toolName));

  const parts = [
    `Partial progress: ${succeeded.length} succeeded, ${failed.length} failed, ${pending.length} pending.`,
    succeeded.length > 0 ? `Succeeded tools: ${formatToolNameList(succeeded)}.` : undefined,
    failed.length > 0 ? `Failed tools: ${formatToolNameList(failed)}.` : undefined,
    pending.length > 0 ? `Pending tools: ${formatToolNameList(pending)}.` : undefined,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);
  return parts.length > 1 ? parts.join('\n') : undefined;
}

function uniqueSortedToolNames(values: Array<string | undefined>): string[] {
  return [...new Set(values
    .map((value) => typeof value === 'string' ? value.trim() : '')
    .filter((value) => value.length > 0))]
    .sort((left, right) => left.localeCompare(right));
}

function formatToolNameList(names: string[]): string {
  const visible = names.slice(0, 8);
  const remaining = names.length - visible.length;
  return remaining > 0
    ? `${visible.join(', ')} and ${remaining} more`
    : visible.join(', ');
}

function readPendingActionPrompt(metadata: Record<string, unknown> | undefined): string | undefined {
  const interruptionPrompt = readDelegatedInterruptionPrompt(metadata);
  if (interruptionPrompt) {
    return interruptionPrompt;
  }
  const pendingAction = metadata?.pendingAction;
  if (!isRecord(pendingAction) || !isRecord(pendingAction.blocker)) return undefined;
  const prompt = pendingAction.blocker.prompt;
  return typeof prompt === 'string' && prompt.trim().length > 0 ? prompt.trim() : undefined;
}

function resolveDelegatedBlockedKind(
  metadata: Record<string, unknown> | undefined,
  verification?: VerificationDecision,
): string | undefined {
  if (verification?.decision === 'policy_blocked') {
    return 'policy_blocked';
  }
  return readPendingActionKind(metadata);
}

function readDelegatedApprovalInterruption(
  metadata: Record<string, unknown> | undefined,
): DelegatedResultEnvelope['interruptions'][number] | undefined {
  return readDelegatedResultEnvelope(metadata)?.interruptions.find((interruption) => interruption.kind === 'approval');
}

function readDelegatedInterruptionKind(
  metadata: Record<string, unknown> | undefined,
): string | undefined {
  const interruption = readDelegatedResultEnvelope(metadata)?.interruptions[0];
  if (!interruption) {
    return undefined;
  }
  switch (interruption.kind) {
    case 'approval':
    case 'clarification':
    case 'workspace_switch':
      return interruption.kind;
    case 'policy_blocked':
      return 'policy_blocked';
    default:
      return undefined;
  }
}

function readDelegatedInterruptionPrompt(
  metadata: Record<string, unknown> | undefined,
): string | undefined {
  const prompt = readDelegatedResultEnvelope(metadata)?.interruptions[0]?.prompt;
  return typeof prompt === 'string' && prompt.trim().length > 0 ? prompt.trim() : undefined;
}

function formatDelegatedStepIds(stepIds: string[]): string {
  return stepIds.join(', ');
}

function truncateDelegatedHandoffText(value: string, maxChars: number): string {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
