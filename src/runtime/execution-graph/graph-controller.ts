import { randomUUID } from 'node:crypto';
import type { Runtime } from '../runtime.js';
import type { OrchestrationRoleDescriptor } from '../orchestration-role-descriptors.js';
import {
  selectEscalatedDelegatedExecutionProfile,
  type SelectedExecutionProfile,
} from '../execution-profiles.js';
import type {
  IntentGatewayDecision,
  IntentGatewayRecord,
} from '../intent-gateway.js';
import type { DelegatedResultEnvelope } from '../execution/types.js';

type DelegatedTaskPlanStep = DelegatedResultEnvelope['taskContract']['plan']['steps'][number];

export interface GraphControllerTargetContext {
  orchestration?: OrchestrationRoleDescriptor;
}

function cloneReadOnlyPlannedStepsFromTaskContract(
  taskContract: DelegatedResultEnvelope['taskContract'],
): NonNullable<IntentGatewayDecision['plannedSteps']> | undefined {
  const readOnlySteps = taskContract.plan.steps
    .filter((step) => isGraphReadStep(step))
    .map((step) => ({
      kind: step.kind,
      summary: step.summary,
      ...(step.expectedToolCategories?.length
        ? { expectedToolCategories: [...step.expectedToolCategories] }
        : {}),
      ...(step.required === false ? { required: false } : {}),
      ...(step.dependsOn?.length ? { dependsOn: [...step.dependsOn] } : {}),
    }));
  return readOnlySteps.length > 0 ? readOnlySteps : undefined;
}

export function buildGraphReadOnlyIntentGatewayRecord(input: {
  baseRecord: IntentGatewayRecord | null | undefined;
  baseDecision: IntentGatewayDecision | undefined;
  taskContract: DelegatedResultEnvelope['taskContract'];
  originalRequest: string;
}): IntentGatewayRecord | null {
  const plannedSteps = cloneReadOnlyPlannedStepsFromTaskContract(input.taskContract);
  if (!plannedSteps || plannedSteps.length <= 0) {
    return null;
  }
  const baseDecision = input.baseDecision ?? input.baseRecord?.decision;
  if (!baseDecision) {
    return null;
  }
  const readOnlySummary = `Read-only exploration for graph-controlled task: ${input.taskContract.summary?.trim() || baseDecision.summary}`;
  return {
    mode: input.baseRecord?.mode ?? 'confirmation',
    available: input.baseRecord?.available ?? true,
    model: input.baseRecord?.model ?? 'execution-graph.readonly',
    latencyMs: input.baseRecord?.latencyMs ?? 0,
    ...(input.baseRecord?.promptProfile ? { promptProfile: input.baseRecord.promptProfile } : {}),
    decision: {
      ...baseDecision,
      operation: plannedSteps.some((step) => step.kind === 'search') ? 'search' : 'inspect',
      summary: readOnlySummary,
      resolvedContent: buildGraphReadOnlyExplorationPrompt({
        originalRequest: input.originalRequest,
        taskContract: input.taskContract,
      }),
      executionClass: 'repo_grounded',
      preferredTier: 'external',
      requiresRepoGrounding: true,
      requiresToolSynthesis: true,
      requireExactFileReferences: input.taskContract.requireExactFileReferences,
      preferredAnswerPath: 'tool_loop',
      plannedSteps,
      provenance: {
        ...(baseDecision.provenance ?? {}),
        operation: 'derived.workload',
        resolvedContent: 'derived.workload',
        executionClass: 'derived.workload',
        requiresRepoGrounding: 'derived.workload',
        requiresToolSynthesis: 'derived.workload',
        preferredAnswerPath: 'derived.workload',
      },
    },
  };
}

function isGraphReadStep(step: DelegatedTaskPlanStep): boolean {
  return step.required !== false && (step.kind === 'search' || step.kind === 'read');
}

function isGraphWriteStep(step: DelegatedTaskPlanStep): boolean {
  return step.required !== false && step.kind === 'write';
}

export function shouldUseGraphControlledExecution(input: {
  taskContract: DelegatedResultEnvelope['taskContract'];
  decision: IntentGatewayDecision | undefined;
  executionProfile?: SelectedExecutionProfile;
}): boolean {
  if (!input.executionProfile) {
    return false;
  }
  if (input.decision?.executionClass === 'security_analysis') {
    return false;
  }
  const route = input.decision?.route ?? input.taskContract.route;
  if (route !== 'coding_task' && route !== 'filesystem_task') {
    return false;
  }
  if (!hasConcreteGraphMutationContract(input.decision, route)) {
    return false;
  }
  const requiredSteps = input.taskContract.plan.steps.filter((step) => step.required !== false);
  const hasReadPhase = requiredSteps.some((step) => isGraphReadStep(step));
  const hasWritePhase = requiredSteps.some((step) => isGraphWriteStep(step));
  return hasReadPhase && hasWritePhase;
}

function hasConcreteGraphMutationContract(
  decision: IntentGatewayDecision | undefined,
  route: IntentGatewayDecision['route'] | DelegatedResultEnvelope['taskContract']['route'],
): boolean {
  if (!decision) {
    return false;
  }
  if (decision.confidence === 'low') {
    return false;
  }
  if (
    decision.provenance?.route === 'repair.unstructured'
    || decision.provenance?.operation === 'repair.unstructured'
  ) {
    return false;
  }
  if (route === 'filesystem_task' && !decision.entities.path?.trim()) {
    return false;
  }
  return true;
}

export function selectGraphControllerExecutionProfile(input: {
  runtime: Runtime;
  target: GraphControllerTargetContext;
  decision: IntentGatewayDecision | undefined;
  currentProfile?: SelectedExecutionProfile;
}): SelectedExecutionProfile | undefined {
  const currentProfile = input.currentProfile;
  if (currentProfile && currentProfile.providerTier !== 'local') {
    return currentProfile;
  }
  const escalated = selectEscalatedDelegatedExecutionProfile({
    config: input.runtime.getConfigSnapshot(),
    currentProfile,
    parentProfile: currentProfile,
    gatewayDecision: input.decision,
    orchestration: input.target.orchestration,
    mode: currentProfile?.routingMode ?? 'auto',
  });
  return escalated ?? currentProfile;
}

export function buildGraphControlledTaskRunId(requestId: string): string {
  return `graph-run:${requestId || randomUUID()}`;
}

function buildGraphReadOnlyExplorationPrompt(input: {
  originalRequest: string;
  taskContract: DelegatedResultEnvelope['taskContract'];
}): string {
  const readSteps = input.taskContract.plan.steps
    .filter((step) => isGraphReadStep(step))
    .map((step) => `- ${step.stepId}: ${step.summary}`);
  const writeSteps = input.taskContract.plan.steps
    .filter((step) => isGraphWriteStep(step))
    .map((step) => `- ${step.stepId}: ${step.summary}`);
  return [
    'Read-only execution graph exploration node.',
    'Do not create, edit, delete, rename, patch, or run shell commands.',
    '',
    `Original request: ${input.originalRequest}`,
    '',
    'Explore these required read/search steps:',
    ...(readSteps.length > 0 ? readSteps : ['- None']),
    '',
    'The graph controller will decide and perform these write steps after grounded synthesis:',
    ...(writeSteps.length > 0 ? writeSteps : ['- None']),
    '',
    'Return a concise evidence summary for the graph synthesis node. Include the files, symbols, matches, and constraints it should use.',
  ].join('\n');
}
