import type { SelectedExecutionProfile } from '../execution-profiles.js';
import type { IntentGatewayDecision } from '../intent-gateway.js';
import {
  buildPlannedTask,
  collectMissingEvidenceKinds,
  readUnsatisfiedRequiredSteps,
} from './task-plan.js';
import type {
  Claim,
  DelegatedResultEnvelope,
  DelegatedTaskContract,
  ProviderSelectionSnapshot,
  StepReceipt,
  VerificationDecision,
} from './types.js';

export function buildDelegatedTaskContract(
  decision: IntentGatewayDecision | null | undefined,
): DelegatedTaskContract {
  const base = buildBaseDelegatedTaskContract(decision);
  return {
    ...base,
    plan: buildPlannedTask(decision, base),
  };
}

export function verifyDelegatedResult(input: {
  envelope: DelegatedResultEnvelope;
  gatewayDecision?: IntentGatewayDecision | null;
  executionProfile?: SelectedExecutionProfile | null;
}): VerificationDecision {
  const interruptions = input.envelope.interruptions;
  if (interruptions.length > 0) {
    const approval = interruptions.find((interruption) => interruption.kind === 'approval');
    if (approval) {
      return {
        decision: 'blocked',
        reasons: [approval.prompt || 'Delegated worker is waiting for approval.'],
        retryable: false,
        requiredNextAction: 'Resolve the pending approval(s) to continue the delegated run.',
      };
    }
    const clarification = interruptions.find((interruption) => interruption.kind === 'clarification');
    if (clarification) {
      return {
        decision: 'blocked',
        reasons: [clarification.prompt || 'Delegated worker is waiting for clarification.'],
        retryable: false,
        requiredNextAction: 'Resolve the clarification to continue the delegated run.',
      };
    }
    const workspaceSwitch = interruptions.find((interruption) => interruption.kind === 'workspace_switch');
    if (workspaceSwitch) {
      return {
        decision: 'blocked',
        reasons: [workspaceSwitch.prompt || 'Delegated worker requires a workspace switch.'],
        retryable: false,
        requiredNextAction: 'Switch to the requested coding workspace to continue the delegated run.',
      };
    }
    const policyBlocked = interruptions.find((interruption) => interruption.kind === 'policy_blocked');
    if (policyBlocked) {
      return {
        decision: 'policy_blocked',
        reasons: [policyBlocked.prompt || 'Delegated worker was blocked by tool policy.'],
        retryable: false,
        requiredNextAction: 'Resolve the policy blocker or choose an allowed target before retrying.',
      };
    }
  }

  const provenanceFailure = verifyProviderSelection(input.envelope.modelProvenance, input.executionProfile);
  if (provenanceFailure) {
    return provenanceFailure;
  }

  const unsatisfiedSteps = readUnsatisfiedRequiredSteps(
    input.envelope.taskContract.plan,
    input.envelope.stepReceipts,
  );
  const unsatisfiedStepIds = unsatisfiedSteps.map((step) => step.stepId);

  if (input.envelope.runStatus === 'completed' && unsatisfiedStepIds.length === 0) {
    const exactFileReferenceFailure = verifyExactFileReferenceRequirements(input.envelope);
    if (exactFileReferenceFailure) {
      return exactFileReferenceFailure;
    }
    return {
      decision: 'satisfied',
      reasons: ['Delegated worker satisfied every required planned step.'],
      retryable: false,
    };
  }

  if (input.envelope.runStatus === 'max_turns') {
    return {
      decision: 'insufficient',
      reasons: ['Delegated worker ran out of turns before satisfying every required step.'],
      retryable: true,
      requiredNextAction: buildUnsatisfiedStepsAction(input.envelope.taskContract.plan.steps, unsatisfiedStepIds),
      missingEvidenceKinds: collectMissingEvidenceKinds(
        input.envelope.taskContract.plan,
        input.envelope.stepReceipts,
      ),
      unsatisfiedStepIds,
    };
  }

  if (input.envelope.runStatus === 'incomplete') {
    return {
      decision: 'insufficient',
      reasons: ['Delegated worker stopped before satisfying every required planned step.'],
      retryable: true,
      requiredNextAction: buildUnsatisfiedStepsAction(input.envelope.taskContract.plan.steps, unsatisfiedStepIds),
      missingEvidenceKinds: collectMissingEvidenceKinds(
        input.envelope.taskContract.plan,
        input.envelope.stepReceipts,
      ),
      unsatisfiedStepIds,
    };
  }

  if (input.envelope.runStatus === 'failed') {
    return {
      decision: 'contradicted',
      reasons: buildFailureReasons(input.envelope),
      retryable: true,
      requiredNextAction: buildUnsatisfiedStepsAction(input.envelope.taskContract.plan.steps, unsatisfiedStepIds),
      missingEvidenceKinds: collectMissingEvidenceKinds(
        input.envelope.taskContract.plan,
        input.envelope.stepReceipts,
      ),
      unsatisfiedStepIds,
    };
  }

  return {
    decision: 'blocked',
    reasons: ['Delegated worker is not in a terminal completed state yet.'],
    retryable: false,
    requiredNextAction: buildUnsatisfiedStepsAction(input.envelope.taskContract.plan.steps, unsatisfiedStepIds),
    unsatisfiedStepIds,
  };
}

function buildBaseDelegatedTaskContract(
  decision: IntentGatewayDecision | null | undefined,
): Omit<DelegatedTaskContract, 'plan'> {
  if (decision?.route === 'coding_task' && decision.operation === 'run') {
    return {
      kind: 'tool_execution',
      route: decision.route,
      operation: decision.operation,
      requiresEvidence: true,
      allowsAnswerFirst: false,
      requireExactFileReferences: false,
      summary: decision.summary,
    };
  }
  if (decision?.route === 'filesystem_task' && !isReadOnlyOperation(decision.operation)) {
    return {
      kind: 'filesystem_mutation',
      route: decision.route,
      operation: decision.operation,
      requiresEvidence: true,
      allowsAnswerFirst: false,
      requireExactFileReferences: false,
      summary: decision.summary,
    };
  }
  if (decision?.route === 'security_task' || decision?.executionClass === 'security_analysis') {
    return {
      kind: 'security_analysis',
      route: decision?.route,
      operation: decision?.operation,
      requiresEvidence: true,
      allowsAnswerFirst: false,
      requireExactFileReferences: decision?.requireExactFileReferences === true,
      summary: decision?.summary,
    };
  }
  if (decision?.requiresRepoGrounding === true || decision?.executionClass === 'repo_grounded') {
    return {
      kind: 'repo_inspection',
      route: decision.route,
      operation: decision.operation,
      requiresEvidence: true,
      allowsAnswerFirst: false,
      requireExactFileReferences: decision.requireExactFileReferences === true,
      summary: decision.summary,
    };
  }
  return {
    kind: 'general_answer',
    route: decision?.route,
    operation: decision?.operation,
    requiresEvidence: false,
    allowsAnswerFirst: true,
    requireExactFileReferences: false,
    summary: decision?.summary,
  };
}

function verifyProviderSelection(
  provenance: ProviderSelectionSnapshot | undefined,
  executionProfile: SelectedExecutionProfile | null | undefined,
): VerificationDecision | null {
  if (!provenance || !executionProfile) return null;
  const expectedProfileName = executionProfile.providerName?.trim();
  const actualProfileName = provenance.resolvedProviderProfileName?.trim() || provenance.resolvedProviderName?.trim();
  const expectedModel = executionProfile.providerModel?.trim();
  const actualModel = provenance.resolvedProviderModel?.trim();
  if (expectedProfileName && actualProfileName && expectedProfileName !== actualProfileName) {
    return {
      decision: 'contradicted',
      reasons: [`Delegated worker reported provider profile '${actualProfileName}' but the supervisor selected '${expectedProfileName}'.`],
      retryable: false,
      requiredNextAction: 'Inspect provider selection drift before retrying.',
      missingEvidenceKinds: ['provider_selection'],
    };
  }
  const expectsOpenAIModelAlias = isOpenAIProviderSelection(provenance, executionProfile);
  const normalizedExpectedModel = normalizeProviderModelForVerification(expectedModel, expectsOpenAIModelAlias);
  const normalizedActualModel = normalizeProviderModelForVerification(actualModel, expectsOpenAIModelAlias);
  if (expectedModel && actualModel && normalizedExpectedModel !== normalizedActualModel) {
    return {
      decision: 'contradicted',
      reasons: [`Delegated worker reported model '${actualModel}' but the supervisor selected '${expectedModel}'.`],
      retryable: false,
      requiredNextAction: 'Inspect provider selection drift before retrying.',
      missingEvidenceKinds: ['provider_selection'],
    };
  }
  return null;
}

function normalizeProviderIdentity(value: string | undefined): string {
  return (typeof value === 'string' ? value : '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function isOpenAIProviderSelection(
  provenance: ProviderSelectionSnapshot,
  executionProfile: SelectedExecutionProfile,
): boolean {
  return [
    executionProfile.providerType,
    executionProfile.providerName,
    provenance.resolvedProviderName,
    provenance.resolvedProviderType,
    provenance.resolvedProviderProfileName,
  ].some((value) => normalizeProviderIdentity(value) === 'openai');
}

function normalizeProviderModelForVerification(
  model: string | undefined,
  allowOpenAIAliasNormalization: boolean,
): string {
  const trimmed = model?.trim().toLowerCase() ?? '';
  if (!trimmed) return '';
  if (allowOpenAIAliasNormalization) {
    return trimmed.replace(/-\d{4}-\d{2}-\d{2}$/u, '');
  }
  return trimmed;
}

function verifyExactFileReferenceRequirements(
  envelope: DelegatedResultEnvelope,
): VerificationDecision | null {
  if (!envelope.taskContract.requireExactFileReferences) {
    return null;
  }
  const answer = envelope.finalUserAnswer?.trim() || '';
  const successfulReceiptIds = new Set(
    envelope.evidenceReceipts
      .filter((receipt) => receipt.status === 'succeeded')
      .map((receipt) => receipt.receiptId),
  );
  const fileClaims = envelope.claims.filter((claim) => (
    claim.kind === 'file_reference'
    && claim.evidenceReceiptIds.some((receiptId) => successfulReceiptIds.has(receiptId))
  ));

  if (fileClaims.length <= 0) {
    return {
      decision: 'insufficient',
      reasons: ['Delegated worker did not return the exact file references requested after repo inspection.'],
      retryable: true,
      requiredNextAction: 'Retry the delegated run and require exact file references backed by receipts.',
      missingEvidenceKinds: ['file_reference_claim'],
    };
  }
  if (!finalAnswerCitesFileReference(answer, fileClaims)) {
    return {
      decision: 'insufficient',
      reasons: ['Delegated worker collected exact file evidence but did not cite those file references in the final answer.'],
      retryable: true,
      requiredNextAction: 'Retry the delegated run and require the final answer to cite the exact files it inspected.',
      missingEvidenceKinds: ['file_reference_claim'],
    };
  }
  return null;
}

function buildFailureReasons(envelope: DelegatedResultEnvelope): string[] {
  const receiptById = new Map(envelope.evidenceReceipts.map((receipt) => [receipt.receiptId, receipt]));
  const stepById = new Map(envelope.taskContract.plan.steps.map((step) => [step.stepId, step]));
  const reasons = envelope.stepReceipts
    .filter((receipt) => receipt.status === 'failed' || receipt.status === 'blocked')
    .map((receipt) => buildFailureReasonForStep(receipt, stepById.get(receipt.stepId), receiptById))
    .filter((reason): reason is string => !!reason);
  if (reasons.length > 0) {
    return reasons;
  }
  return ['Delegated worker failed before satisfying the required planned steps.'];
}

function buildFailureReasonForStep(
  stepReceipt: StepReceipt,
  step: { summary: string } | undefined,
  receiptById: Map<string, DelegatedResultEnvelope['evidenceReceipts'][number]>,
): string | null {
  const evidenceReasons = stepReceipt.evidenceReceiptIds
    .map((receiptId) => receiptById.get(receiptId))
    .filter((receipt): receipt is NonNullable<typeof receipt> => !!receipt)
    .map((receipt) => receipt.summary?.trim())
    .filter((summary): summary is string => !!summary);
  if (evidenceReasons.length > 0) {
    return evidenceReasons[0];
  }
  const summary = stepReceipt.summary?.trim() || step?.summary?.trim();
  return summary ? `Failed to satisfy step: ${summary}` : null;
}

function isReadOnlyOperation(operation: IntentGatewayDecision['operation'] | undefined): boolean {
  return operation === 'inspect' || operation === 'read' || operation === 'search';
}

function buildUnsatisfiedStepsAction(
  plannedSteps: DelegatedResultEnvelope['taskContract']['plan']['steps'],
  unsatisfiedStepIds: string[],
): string | undefined {
  if (unsatisfiedStepIds.length === 0) return undefined;
  const stepById = new Map(plannedSteps.map((step) => [step.stepId, step]));
  return unsatisfiedStepIds
    .map((stepId) => {
      const step = stepById.get(stepId);
      return step ? `${stepId} (${step.summary})` : stepId;
    })
    .join('; ');
}

function finalAnswerCitesFileReference(answer: string, fileClaims: Claim[]): boolean {
  if (!answer.trim()) return false;
  const normalizedAnswer = normalizeFileReferenceText(answer);
  return fileClaims.some((claim) => {
    return buildComparableFileReferenceVariants(claim.subject).some((variant) => normalizedAnswer.includes(variant))
      || buildComparableFileReferenceVariants(claim.value).some((variant) => normalizedAnswer.includes(variant));
  });
}

function normalizeFileReferenceText(value: string | undefined): string {
  return value?.trim().replaceAll('\\', '/').toLowerCase() ?? '';
}

function buildComparableFileReferenceVariants(value: string | undefined): string[] {
  const normalized = normalizeFileReferenceText(value);
  if (!normalized) return [];
  const variants = new Set<string>();
  const segments = normalized.split('/').filter((segment) => segment.length > 0);
  for (let index = 0; index < segments.length; index += 1) {
    const candidate = segments.slice(index).join('/');
    if (isGenericFileReferenceCandidate(candidate)) continue;
    if (candidate.split('/').length < 2) continue;
    variants.add(candidate);
  }
  if (!isGenericFileReferenceCandidate(normalized)) {
    variants.add(normalized);
  }
  return [...variants];
}

function isGenericFileReferenceCandidate(value: string): boolean {
  if (!value || value.length <= 2) return true;
  return ['src', 'docs', 'lib', 'test', 'tests', 'bin', 'public', 'root'].includes(value);
}
