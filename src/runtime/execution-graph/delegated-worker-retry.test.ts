import { describe, expect, it } from 'vitest';
import type { SelectedExecutionProfile } from '../execution-profiles.js';
import type {
  DelegatedResultEnvelope,
  DelegatedTaskContract,
  PlannedStep,
} from '../execution/types.js';
import type { IntentGatewayDecision, IntentGatewayRecord } from '../intent-gateway.js';
import {
  appendDelegatedRetrySection,
  buildDelegatedRetryableFailure,
  buildDelegatedRetryDetail,
  buildDelegatedRetryIntentGatewayRecord,
  formatDelegatedStepIds,
  isDelegatedAnswerSynthesisRetry,
  shouldAdoptDelegatedTaskContract,
  shouldRetryDelegatedAnswerSynthesisOnSameProfile,
} from './delegated-worker-retry.js';

describe('delegated worker retry graph policy', () => {
  it('builds answer-synthesis retry failures from typed verification state', () => {
    const envelope = delegatedEnvelope({
      taskContract: taskContract({
        steps: [
          { stepId: 'read', kind: 'read', summary: 'Read implementation files.' },
          { stepId: 'answer', kind: 'answer', summary: 'Answer from the gathered evidence.' },
        ],
      }),
      stepReceipts: [{
        stepId: 'read',
        status: 'satisfied',
        evidenceReceiptIds: ['receipt-read'],
        summary: 'Read implementation files.',
        startedAt: 1,
        endedAt: 2,
      }],
      evidenceReceipts: [{
        receiptId: 'receipt-read',
        sourceType: 'tool_call',
        toolName: 'fs_read',
        status: 'succeeded',
        refs: ['src\\runtime\\execution-graph\\graph-controller.ts'],
        summary: 'Read graph controller.',
        startedAt: 1,
        endedAt: 2,
      }],
    });
    const failure = buildDelegatedRetryableFailure({
      decision: 'insufficient',
      reasons: ['The worker gathered evidence but did not answer.'],
      retryable: true,
      missingEvidenceKinds: ['answer'],
      unsatisfiedStepIds: ['answer'],
    }, envelope);

    expect(failure).toMatchObject({
      retryReason: 'required steps remain unsatisfied (answer)',
      unsatisfiedSteps: [{
        stepId: 'answer',
        kind: 'answer',
        summary: 'Answer from the gathered evidence.',
        status: 'missing',
      }],
      satisfiedSteps: [{
        stepId: 'read',
        refs: ['src/runtime/execution-graph/graph-controller.ts'],
      }],
    });
    expect(isDelegatedAnswerSynthesisRetry(failure!)).toBe(true);
    expect(shouldRetryDelegatedAnswerSynthesisOnSameProfile(failure!, executionProfile())).toBe(true);

    const retrySections = appendDelegatedRetrySection([], failure!, { sameProfile: true });
    expect(retrySections).toHaveLength(1);
    expect(retrySections[0]?.section).toBe('Delegated Retry Directive');
    expect(retrySections[0]?.content).toContain('answer-synthesis retry');
    expect(retrySections[0]?.content).toContain('src/runtime/execution-graph/graph-controller.ts');
    expect(buildDelegatedRetryDetail(
      'Workspace Explorer',
      executionProfile(),
      failure!,
      'code-session-1',
    )).toContain('Retrying Workspace Explorer with openrouter / moonshotai/kimi-k2.6 in code session code-session-1 because required steps remain unsatisfied (answer)');
  });

  it('owns retry gateway repair and task-contract adoption outside WorkerManager', () => {
    const current = taskContract({
      planId: 'plan-current',
      steps: [
        { stepId: 'read', kind: 'read', summary: 'Read files.' },
      ],
    });
    const candidate = taskContract({
      planId: 'plan-candidate',
      summary: 'Inspect and answer.',
      steps: [
        { stepId: 'read', kind: 'read', summary: 'Read files.' },
        { stepId: 'answer', kind: 'answer', summary: 'Answer with exact paths.' },
      ],
    });
    const baseRecord: IntentGatewayRecord = {
      mode: 'confirmation',
      available: true,
      model: 'gateway-model',
      latencyMs: 12,
      decision: gatewayDecision(),
    };

    expect(shouldAdoptDelegatedTaskContract(current, candidate)).toBe(true);
    const retryRecord = buildDelegatedRetryIntentGatewayRecord({
      baseRecord,
      baseDecision: undefined,
      taskContract: candidate,
    });

    expect(retryRecord?.decision).toMatchObject({
      route: 'coding_task',
      operation: 'inspect',
      summary: 'Inspect and answer.',
      requireExactFileReferences: true,
      plannedSteps: [
        { kind: 'read', summary: 'Read files.' },
        { kind: 'answer', summary: 'Answer with exact paths.' },
      ],
    });
  });

  it('preserves exact-file and generic grounding retry guidance', () => {
    const exactFailure = buildDelegatedRetryableFailure({
      decision: 'insufficient',
      reasons: ['Missing exact files.'],
      retryable: true,
      missingEvidenceKinds: ['file_reference_claim'],
      unsatisfiedStepIds: ['read'],
    }, delegatedEnvelope({
      taskContract: taskContract({
        requireExactFileReferences: true,
        steps: [
          { stepId: 'read', kind: 'read', summary: 'Read implementation files.' },
        ],
      }),
    }));
    expect(exactFailure?.failureSummary).toBe('Delegated worker did not return the exact file references requested after repo inspection.');

    const genericFailure = buildDelegatedRetryableFailure({
      decision: 'insufficient',
      reasons: ['Grounding incomplete.'],
      retryable: true,
      missingEvidenceKinds: ['repo_evidence'],
      unsatisfiedStepIds: [],
    }, delegatedEnvelope({
      taskContract: taskContract({
        steps: [
          { stepId: 'read', kind: 'read', summary: 'Read implementation files.' },
        ],
      }),
    }));
    const retrySection = appendDelegatedRetrySection([], genericFailure!)[0]?.content ?? '';
    expect(retrySection).toContain('Do not invent filenames or sibling paths after an ENOENT or a failed read/list call.');
    expect(retrySection).toContain('If a search result is truncated or only reports that matches exist');
    expect(formatDelegatedStepIds(['read', 'answer'])).toBe('read, answer');
  });
});

function gatewayDecision(): IntentGatewayDecision {
  return {
    route: 'coding_task',
    confidence: 'high',
    operation: 'inspect',
    summary: 'Inspect files.',
    turnRelation: 'new_request',
    resolution: 'ready',
    missingFields: [],
    executionClass: 'repo_grounded',
    entities: {},
  };
}

function taskContract(input: {
  planId?: string;
  summary?: string;
  requireExactFileReferences?: boolean;
  steps: Array<Omit<PlannedStep, 'required'> & { required?: boolean }>;
}): DelegatedTaskContract {
  return {
    kind: 'repo_inspection',
    route: 'coding_task',
    operation: 'inspect',
    requiresEvidence: true,
    allowsAnswerFirst: false,
    requireExactFileReferences: input.requireExactFileReferences ?? true,
    summary: input.summary ?? 'Inspect files.',
    plan: {
      planId: input.planId ?? 'plan-1',
      steps: input.steps.map((step) => ({
        ...step,
        required: step.required ?? true,
      })),
      allowAdditionalSteps: false,
    },
  };
}

function delegatedEnvelope(input: {
  taskContract?: DelegatedTaskContract;
  stepReceipts?: DelegatedResultEnvelope['stepReceipts'];
  evidenceReceipts?: DelegatedResultEnvelope['evidenceReceipts'];
}): DelegatedResultEnvelope {
  return {
    taskContract: input.taskContract ?? taskContract({
      steps: [
        { stepId: 'answer', kind: 'answer', summary: 'Answer.' },
      ],
    }),
    runStatus: 'incomplete',
    stopReason: 'end_turn',
    stepReceipts: input.stepReceipts ?? [],
    operatorSummary: 'Incomplete.',
    claims: [],
    evidenceReceipts: input.evidenceReceipts ?? [],
    interruptions: [],
    artifacts: [],
    events: [],
  };
}

function executionProfile(): SelectedExecutionProfile {
  return {
    id: 'managed_cloud_tool',
    providerName: 'openrouter',
    providerType: 'openrouter',
    providerModel: 'moonshotai/kimi-k2.6',
    providerLocality: 'external',
    providerTier: 'managed_cloud',
    requestedTier: 'external',
    preferredAnswerPath: 'tool_loop',
    expectedContextPressure: 'medium',
    contextBudget: 64_000,
    toolContextMode: 'standard',
    maxAdditionalSections: 3,
    maxRuntimeNotices: 6,
    fallbackProviderOrder: [],
    reason: 'test',
  };
}
