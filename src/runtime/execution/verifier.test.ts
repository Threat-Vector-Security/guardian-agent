import { describe, expect, it } from 'vitest';
import type {
  DelegatedResultEnvelope,
  DelegatedTaskContract,
  EvidenceReceipt,
  Interruption,
  ProviderSelectionSnapshot,
  StepReceipt,
  WorkerStopReason,
} from './types.js';
import { buildStepReceipts, computeWorkerRunStatus, matchPlannedStepForTool } from './task-plan.js';
import { buildDelegatedTaskContract, verifyDelegatedResult } from './verifier.js';

function buildRepoInspectionTaskContract(overrides: Partial<DelegatedTaskContract> = {}): DelegatedTaskContract {
  const requireExactFileReferences = overrides.requireExactFileReferences === true;
  return {
    ...buildDelegatedTaskContract({
      route: 'coding_task',
      confidence: 'high',
      operation: 'inspect',
      summary: 'Inspect the repository and report grounded findings.',
      turnRelation: 'new_request',
      resolution: 'ready',
      missingFields: [],
      executionClass: 'repo_grounded',
      preferredTier: 'external',
      requiresRepoGrounding: true,
      requiresToolSynthesis: true,
      requireExactFileReferences,
      expectedContextPressure: 'medium',
      preferredAnswerPath: 'chat_synthesis',
      entities: {},
    }),
    ...overrides,
  };
}

function buildToolExecutionTaskContract(overrides: Partial<DelegatedTaskContract> = {}): DelegatedTaskContract {
  return {
    ...buildDelegatedTaskContract({
      route: 'coding_task',
      confidence: 'high',
      operation: 'run',
      summary: 'Run the requested command in the remote sandbox.',
      turnRelation: 'new_request',
      resolution: 'ready',
      missingFields: [],
      executionClass: 'repo_grounded',
      preferredTier: 'external',
      requiresRepoGrounding: true,
      requiresToolSynthesis: true,
      requireExactFileReferences: false,
      expectedContextPressure: 'medium',
      preferredAnswerPath: 'tool_loop',
      entities: {},
    }),
    ...overrides,
  };
}

function buildEnvelope(input?: {
  taskContract?: DelegatedTaskContract;
  finalUserAnswer?: string;
  operatorSummary?: string;
  claims?: DelegatedResultEnvelope['claims'];
  evidenceReceipts?: EvidenceReceipt[];
  interruptions?: Interruption[];
  events?: DelegatedResultEnvelope['events'];
  stopReason?: WorkerStopReason;
  modelProvenance?: ProviderSelectionSnapshot;
  stepReceipts?: StepReceipt[];
  runStatus?: DelegatedResultEnvelope['runStatus'];
}): DelegatedResultEnvelope {
  const taskContract = input?.taskContract ?? buildRepoInspectionTaskContract();
  const evidenceReceipts = [...(input?.evidenceReceipts ?? [])];
  const interruptions = [...(input?.interruptions ?? [])];
  const primaryStepId = taskContract.plan.steps[0]?.stepId;
  const receiptStepIds = new Map<string, string>();
  for (const receipt of evidenceReceipts) {
    const matchedStepId = matchPlannedStepForTool({
      plannedTask: taskContract.plan,
      toolName: receipt.toolName ?? 'tool_call',
      args: { refs: receipt.refs },
    });
    if (matchedStepId) {
      receiptStepIds.set(receipt.receiptId, matchedStepId);
    }
  }
  const stepReceipts: StepReceipt[] = input?.stepReceipts ?? buildStepReceipts({
    plannedTask: taskContract.plan,
    evidenceReceipts,
    toolReceiptStepIds: receiptStepIds,
    interruptions,
  });
  const stopReason = input?.stopReason ?? 'end_turn';
  const runStatus = input?.runStatus ?? computeWorkerRunStatus(
    taskContract.plan,
    stepReceipts,
    interruptions,
    stopReason,
  );
  const finalUserAnswer = runStatus === 'completed'
    ? input?.finalUserAnswer ?? 'Completed the delegated inspection.'
    : undefined;
  return {
    taskContract,
    runStatus,
    stopReason,
    stepReceipts,
    ...(finalUserAnswer ? { finalUserAnswer } : {}),
    operatorSummary: input?.operatorSummary ?? finalUserAnswer ?? 'Delegated worker did not finish cleanly.',
    claims: input?.claims ?? [],
    evidenceReceipts,
    interruptions,
    artifacts: [],
    ...(input?.modelProvenance ? { modelProvenance: input.modelProvenance } : {}),
    events: input?.events ?? [],
  };
}

describe('verifyDelegatedResult', () => {
  it('injects a read step for exact-file repo inspections before the final answer step', () => {
    const taskContract = buildDelegatedTaskContract({
      route: 'coding_task',
      confidence: 'high',
      operation: 'inspect',
      summary: 'Inspect the repository and return the exact files.',
      turnRelation: 'new_request',
      resolution: 'ready',
      missingFields: [],
      executionClass: 'repo_grounded',
      preferredTier: 'external',
      requiresRepoGrounding: true,
      requiresToolSynthesis: true,
      requireExactFileReferences: true,
      expectedContextPressure: 'medium',
      preferredAnswerPath: 'chat_synthesis',
      plannedSteps: [
        { kind: 'search', summary: 'Search the repo for the relevant implementation files.', required: true },
        { kind: 'answer', summary: 'Answer with the exact files backed by the repo evidence.', required: true, dependsOn: ['step_1'] },
      ],
      entities: {},
    });

    expect(taskContract.plan.steps.map((step) => step.kind)).toEqual(['search', 'read', 'answer']);
    expect(taskContract.plan.steps[1]).toMatchObject({
      kind: 'read',
      expectedToolCategories: ['fs_read', 'fs_list', 'code_symbol_search'],
    });
  });

  it('does not treat dependent answer steps as satisfied when the required read step is still missing', () => {
    const taskContract = buildDelegatedTaskContract({
      route: 'coding_task',
      confidence: 'high',
      operation: 'inspect',
      summary: 'Inspect the repository and return the exact files.',
      turnRelation: 'new_request',
      resolution: 'ready',
      missingFields: [],
      executionClass: 'repo_grounded',
      preferredTier: 'external',
      requiresRepoGrounding: true,
      requiresToolSynthesis: true,
      requireExactFileReferences: true,
      expectedContextPressure: 'medium',
      preferredAnswerPath: 'chat_synthesis',
      plannedSteps: [
        { kind: 'search', summary: 'Search the repo for candidate files.', required: true },
        { kind: 'read', summary: 'Read the exact implementation files.', required: true, dependsOn: ['step_1'] },
        { kind: 'answer', summary: 'Answer with the exact grounded files.', required: true, dependsOn: ['step_2'] },
      ],
      entities: {},
    });
    const decision = verifyDelegatedResult({
      envelope: buildEnvelope({
        taskContract,
        stepReceipts: [
          {
            stepId: 'step_1',
            status: 'satisfied',
            evidenceReceiptIds: ['receipt-search'],
            summary: 'Search found candidate files.',
            startedAt: 1,
            endedAt: 2,
          },
          {
            stepId: 'step_2',
            status: 'failed',
            evidenceReceiptIds: [],
            summary: 'Read the exact implementation files.',
            startedAt: 0,
            endedAt: 0,
          },
          {
            stepId: 'step_3',
            status: 'satisfied',
            evidenceReceiptIds: ['receipt-answer'],
            summary: 'The files are src/support/workerProgress.ts and src/timeline/renderTimeline.ts.',
            startedAt: 3,
            endedAt: 4,
          },
        ],
      }),
    });

    expect(decision).toMatchObject({
      decision: 'insufficient',
      retryable: true,
      unsatisfiedStepIds: ['step_2', 'step_3'],
    });
    expect(decision.requiredNextAction).toContain('step_2');
    expect(decision.requiredNextAction).toContain('step_3');
  });

  it('treats failed repo-grounded tool receipts as a contradiction with retryable failed steps', () => {
    const decision = verifyDelegatedResult({
      envelope: buildEnvelope({
        finalUserAnswer: 'The remote sandbox command failed with a 502 from Daytona Main, so I could not complete the inspection.',
        operatorSummary: 'The remote sandbox command failed with a 502 from Daytona Main.',
        evidenceReceipts: [{
          receiptId: 'receipt-1',
          sourceType: 'tool_call',
          toolName: 'code_remote_exec',
          status: 'failed',
          refs: [],
          summary: 'Remote sandbox command failed on Daytona Main. stderr: Request failed with status code 502',
          startedAt: 1,
          endedAt: 2,
        }],
      }),
    });

    expect(decision).toMatchObject({
      decision: 'contradicted',
      retryable: true,
      requiredNextAction: expect.stringContaining('step_1'),
      unsatisfiedStepIds: ['step_1'],
    });
    expect(decision.reasons[0]).toContain('Remote sandbox command failed on Daytona Main');
  });

  it('requires exact-file answers to cite the successful file claims they collected', () => {
    const taskContract = buildRepoInspectionTaskContract({
      requireExactFileReferences: true,
      summary: 'Inspect the repository and return the exact files.',
    });
    const decision = verifyDelegatedResult({
      envelope: buildEnvelope({
        taskContract,
        finalUserAnswer: 'I found the delegated worker progress and run timeline implementation after inspecting the repo.',
        operatorSummary: 'I found the delegated worker progress and run timeline implementation after inspecting the repo.',
        evidenceReceipts: [{
          receiptId: 'receipt-1',
          sourceType: 'tool_call',
          toolName: 'fs_read',
          status: 'succeeded',
          refs: ['src/supervisor/worker-manager.ts'],
          summary: 'Read src/supervisor/worker-manager.ts',
          startedAt: 1,
          endedAt: 2,
        }],
        claims: [{
          claimId: 'claim-file-1',
          kind: 'file_reference',
          subject: 'src/supervisor/worker-manager.ts',
          value: 'src/supervisor/worker-manager.ts',
          evidenceReceiptIds: ['receipt-1'],
          confidence: 0.8,
        }],
      }),
    });

    expect(decision).toMatchObject({
      decision: 'insufficient',
      retryable: true,
      missingEvidenceKinds: ['file_reference_claim'],
    });
    expect(decision.reasons[0]).toContain('did not cite');
  });

  it('does not accept discovery-only success as execution evidence for command runs', () => {
    const decision = verifyDelegatedResult({
      envelope: buildEnvelope({
        taskContract: buildToolExecutionTaskContract(),
        finalUserAnswer: 'I found the code_remote_exec tool but have not run the command yet.',
        operatorSummary: 'I found the code_remote_exec tool but have not run the command yet.',
        evidenceReceipts: [{
          receiptId: 'receipt-1',
          sourceType: 'tool_call',
          toolName: 'find_tools',
          status: 'succeeded',
          refs: [],
          summary: 'Discovered code_remote_exec.',
          startedAt: 1,
          endedAt: 2,
        }],
      }),
    });

    expect(decision).toMatchObject({
      decision: 'insufficient',
      retryable: true,
      unsatisfiedStepIds: ['step_1'],
    });
  });

  it('accepts OpenAI dated snapshot ids when they match the selected alias model', () => {
    const taskContract = buildRepoInspectionTaskContract();
    const decision = verifyDelegatedResult({
      executionProfile: {
        id: 'frontier_deep',
        providerName: 'openai',
        providerType: 'openai',
        providerModel: 'gpt-4o',
        providerLocality: 'external',
        providerTier: 'frontier',
        requestedTier: 'external',
        preferredAnswerPath: 'direct',
        expectedContextPressure: 'low',
        contextBudget: 36_000,
        toolContextMode: 'tight',
        maxAdditionalSections: 2,
        maxRuntimeNotices: 2,
        reason: 'test profile',
      },
      envelope: buildEnvelope({
        taskContract,
        runStatus: 'completed',
        stepReceipts: [{
          stepId: taskContract.plan.steps[0]!.stepId,
          status: 'satisfied',
          evidenceReceiptIds: ['receipt-1'],
          summary: 'Read the relevant repo file.',
          startedAt: 1,
          endedAt: 2,
        }],
        evidenceReceipts: [{
          receiptId: 'receipt-1',
          sourceType: 'tool_call',
          toolName: 'fs_read',
          status: 'succeeded',
          refs: ['src/runtime/run-timeline.ts'],
          summary: 'Read src/runtime/run-timeline.ts',
          startedAt: 1,
          endedAt: 2,
        }],
        modelProvenance: {
          resolvedProviderName: 'openai',
          resolvedProviderType: 'openai',
          resolvedProviderProfileName: 'openai',
          resolvedProviderModel: 'gpt-4o-2024-08-06',
        },
      }),
    });

    expect(decision.decision).toBe('satisfied');
  });

  it('still rejects real model drift when the reported model is not the selected alias', () => {
    const decision = verifyDelegatedResult({
      executionProfile: {
        id: 'frontier_deep',
        providerName: 'openai',
        providerType: 'openai',
        providerModel: 'gpt-4o',
        providerLocality: 'external',
        providerTier: 'frontier',
        requestedTier: 'external',
        preferredAnswerPath: 'direct',
        expectedContextPressure: 'low',
        contextBudget: 36_000,
        toolContextMode: 'tight',
        maxAdditionalSections: 2,
        maxRuntimeNotices: 2,
        reason: 'test profile',
      },
      envelope: buildEnvelope({
        modelProvenance: {
          resolvedProviderName: 'openai',
          resolvedProviderType: 'openai',
          resolvedProviderProfileName: 'openai',
          resolvedProviderModel: 'gpt-4o-mini-2024-07-18',
        },
      }),
    });

    expect(decision).toMatchObject({
      decision: 'contradicted',
      retryable: false,
      missingEvidenceKinds: ['provider_selection'],
    });
    expect(decision.reasons[0]).toContain("gpt-4o-mini-2024-07-18");
  });

  it('treats failed execution receipts as a contradiction for command runs', () => {
    const decision = verifyDelegatedResult({
      envelope: buildEnvelope({
        taskContract: buildToolExecutionTaskContract(),
        finalUserAnswer: 'The remote sandbox command failed with a 502 from Daytona Main.',
        operatorSummary: 'The remote sandbox command failed with a 502 from Daytona Main.',
        evidenceReceipts: [{
          receiptId: 'receipt-1',
          sourceType: 'tool_call',
          toolName: 'code_remote_exec',
          status: 'failed',
          refs: [],
          summary: 'Remote sandbox command failed on Daytona Main. stderr: Request failed with status code 502',
          startedAt: 1,
          endedAt: 2,
        }],
      }),
    });

    expect(decision).toMatchObject({
      decision: 'contradicted',
      retryable: true,
      requiredNextAction: expect.stringContaining('step_1'),
      unsatisfiedStepIds: ['step_1'],
    });
    expect(decision.reasons[0]).toContain('Remote sandbox command failed on Daytona Main');
  });
});
