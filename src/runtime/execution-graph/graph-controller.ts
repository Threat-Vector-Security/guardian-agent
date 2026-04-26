import { randomUUID } from 'node:crypto';
import type { Runtime } from '../runtime.js';
import type { OrchestrationRoleDescriptor } from '../orchestration-role-descriptors.js';
import type { RunTimelineStore } from '../run-timeline.js';
import {
  selectEscalatedDelegatedExecutionProfile,
  type SelectedExecutionProfile,
} from '../execution-profiles.js';
import type {
  IntentGatewayDecision,
  IntentGatewayRecord,
} from '../intent-gateway.js';
import type { DelegatedResultEnvelope } from '../execution/types.js';
import {
  artifactRefFromArtifact,
  type ExecutionArtifact,
} from './graph-artifacts.js';
import {
  createExecutionGraphEvent,
  type ExecutionGraphEvent,
} from './graph-events.js';
import type { ExecutionGraphStore } from './graph-store.js';
import type { ExecutionNodeKind } from './types.js';

type DelegatedTaskPlanStep = DelegatedResultEnvelope['taskContract']['plan']['steps'][number];

export interface GraphControllerTargetContext {
  orchestration?: OrchestrationRoleDescriptor;
}

export interface GraphControlledRunNodeIds {
  readNodeId: string;
  synthesisNodeId: string;
  mutationNodeId: string;
  verificationNodeId: string;
}

export interface GraphControlledRun {
  graphId: string;
  rootExecutionId: string;
  parentExecutionId?: string;
  codeSessionId?: string;
  nodeIds: GraphControlledRunNodeIds;
  currentSequence: () => number;
  updateSequenceFromEvents: (events: readonly ExecutionGraphEvent[]) => void;
  ingestGraphEvent: (event: ExecutionGraphEvent) => void;
  emitGraphEvent: (
    kind: ExecutionGraphEvent['kind'],
    payload: Record<string, unknown>,
    eventKey: string,
    options?: {
      nodeId?: string;
      nodeKind?: ExecutionNodeKind;
      producer?: ExecutionGraphEvent['producer'];
    },
  ) => ExecutionGraphEvent;
  emitArtifact: (
    artifact: ExecutionArtifact,
    nodeId: string,
    nodeKind: ExecutionNodeKind,
  ) => ExecutionGraphEvent;
}

export function createGraphControlledRun(input: {
  graphStore?: Pick<ExecutionGraphStore, 'createGraph' | 'appendEvent' | 'writeArtifact'>;
  runTimeline?: Pick<RunTimelineStore, 'ingestExecutionGraphEvent'>;
  now: () => number;
  taskRunId: string;
  requestId: string;
  gatewayDecision: IntentGatewayDecision;
  agentId: string;
  userId: string;
  channel: string;
  surfaceId?: string;
  triggerSourceId: string;
  rootExecutionId?: string;
  parentExecutionId?: string;
  codeSessionId?: string;
}): GraphControlledRun {
  const graphId = `graph:${input.taskRunId}`;
  const rootExecutionId = input.rootExecutionId ?? input.taskRunId;
  const parentExecutionId = input.parentExecutionId;
  const readNodeId = `node:${input.taskRunId}:explore`;
  const synthesisNodeId = `node:${input.taskRunId}:synthesize`;
  const mutationNodeId = `node:${input.taskRunId}:mutate`;
  const verificationNodeId = `node:${input.taskRunId}:verify`;
  input.graphStore?.createGraph({
    graphId,
    executionId: input.taskRunId,
    rootExecutionId,
    ...(parentExecutionId ? { parentExecutionId } : {}),
    requestId: input.requestId,
    runId: input.requestId,
    intent: input.gatewayDecision,
    securityContext: {
      agentId: input.agentId,
      userId: input.userId,
      channel: input.channel,
      ...(input.surfaceId ? { surfaceId: input.surfaceId } : {}),
      ...(input.codeSessionId ? { codeSessionId: input.codeSessionId } : {}),
    },
    trigger: {
      type: 'user_request',
      source: input.channel,
      sourceId: input.triggerSourceId,
    },
    nodes: [
      {
        nodeId: readNodeId,
        graphId,
        kind: 'explore_readonly',
        status: 'pending',
        title: 'Read-only evidence gathering',
        requiredInputIds: [],
        outputArtifactTypes: ['SearchResultSet', 'FileReadSet', 'EvidenceLedger'],
        allowedToolCategories: ['filesystem.read', 'search.read'],
        approvalPolicy: 'none',
        checkpointPolicy: 'phase_boundary',
      },
      {
        nodeId: synthesisNodeId,
        graphId,
        kind: 'synthesize',
        status: 'pending',
        title: 'Grounded write specification synthesis',
        requiredInputIds: [],
        outputArtifactTypes: ['EvidenceLedger', 'SynthesisDraft', 'WriteSpec'],
        allowedToolCategories: [],
        approvalPolicy: 'none',
        checkpointPolicy: 'phase_boundary',
      },
      {
        nodeId: mutationNodeId,
        graphId,
        kind: 'mutate',
        status: 'pending',
        title: 'Supervisor-owned file mutation',
        requiredInputIds: [],
        outputArtifactTypes: ['MutationReceipt', 'VerificationResult'],
        allowedToolCategories: ['filesystem.write', 'filesystem.read'],
        approvalPolicy: 'if_required',
        checkpointPolicy: 'phase_boundary',
      },
      {
        nodeId: verificationNodeId,
        graphId,
        kind: 'verify',
        status: 'pending',
        title: 'Mutation verification',
        requiredInputIds: [],
        outputArtifactTypes: ['VerificationResult'],
        allowedToolCategories: ['filesystem.read'],
        approvalPolicy: 'none',
        checkpointPolicy: 'terminal_only',
      },
    ],
    edges: [
      {
        edgeId: `${readNodeId}->${synthesisNodeId}`,
        graphId,
        fromNodeId: readNodeId,
        toNodeId: synthesisNodeId,
      },
      {
        edgeId: `${synthesisNodeId}->${mutationNodeId}`,
        graphId,
        fromNodeId: synthesisNodeId,
        toNodeId: mutationNodeId,
      },
      {
        edgeId: `${mutationNodeId}->${verificationNodeId}`,
        graphId,
        fromNodeId: mutationNodeId,
        toNodeId: verificationNodeId,
      },
    ],
  });

  let sequence = 0;
  const ingestGraphEvent = (event: ExecutionGraphEvent): void => {
    sequence = Math.max(sequence, event.sequence);
    input.runTimeline?.ingestExecutionGraphEvent(event);
    input.graphStore?.appendEvent(event);
  };
  const emitGraphEvent: GraphControlledRun['emitGraphEvent'] = (
    kind,
    payload,
    eventKey,
    options = {},
  ) => {
    sequence += 1;
    const event = createExecutionGraphEvent({
      eventId: `${graphId}:${eventKey}:${sequence}`,
      graphId,
      executionId: input.taskRunId,
      rootExecutionId,
      ...(parentExecutionId ? { parentExecutionId } : {}),
      requestId: input.requestId,
      runId: input.requestId,
      ...(options.nodeId ? { nodeId: options.nodeId } : {}),
      ...(options.nodeKind ? { nodeKind: options.nodeKind } : {}),
      kind,
      timestamp: input.now(),
      sequence,
      producer: options.producer ?? 'supervisor',
      channel: input.channel,
      agentId: input.agentId,
      userId: input.userId,
      ...(input.codeSessionId ? { codeSessionId: input.codeSessionId } : {}),
      payload,
    });
    ingestGraphEvent(event);
    return event;
  };
  const emitArtifact: GraphControlledRun['emitArtifact'] = (artifact, nodeId, nodeKind) => {
    const ref = artifactRefFromArtifact(artifact);
    input.graphStore?.writeArtifact(artifact);
    return emitGraphEvent('artifact_created', {
      artifactId: ref.artifactId,
      artifactType: ref.artifactType,
      label: ref.label,
      ...(ref.preview ? { preview: ref.preview } : {}),
      ...(ref.trustLevel ? { trustLevel: ref.trustLevel } : {}),
      ...(ref.taintReasons ? { taintReasons: ref.taintReasons } : {}),
      ...(ref.redactionPolicy ? { redactionPolicy: ref.redactionPolicy } : {}),
    }, `artifact:${artifact.artifactId}`, { nodeId, nodeKind });
  };

  return {
    graphId,
    rootExecutionId,
    ...(parentExecutionId ? { parentExecutionId } : {}),
    ...(input.codeSessionId ? { codeSessionId: input.codeSessionId } : {}),
    nodeIds: {
      readNodeId,
      synthesisNodeId,
      mutationNodeId,
      verificationNodeId,
    },
    currentSequence: () => sequence,
    updateSequenceFromEvents: (events) => {
      sequence = events.reduce((highest, event) => Math.max(highest, event.sequence), sequence);
    },
    ingestGraphEvent,
    emitGraphEvent,
    emitArtifact,
  };
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
