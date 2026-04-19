import { describe, expect, it } from 'vitest';
import type { DelegatedResultEnvelope } from './types.js';
import { verifyDelegatedResult } from './verifier.js';

function buildBaseEnvelope(
  overrides: Partial<DelegatedResultEnvelope> = {},
): DelegatedResultEnvelope {
  return {
    taskContract: {
      kind: 'repo_inspection',
      route: 'coding_task',
      operation: 'inspect',
      requiresEvidence: true,
      allowsAnswerFirst: false,
      requireExactFileReferences: false,
      summary: 'Inspect the repository and report grounded findings.',
    },
    finalUserAnswer: 'Completed the delegated inspection.',
    operatorSummary: 'Completed the delegated inspection.',
    claims: [],
    evidenceReceipts: [],
    interruptions: [],
    artifacts: [],
    events: [{
      eventId: 'claim-1',
      type: 'claim_emitted',
      timestamp: 1,
      payload: {
        kind: 'answer',
        content: 'Completed the delegated inspection.',
      },
    }],
    verificationHints: {
      completionReason: 'model_response',
      responseQuality: 'final',
    },
    ...overrides,
  };
}

describe('verifyDelegatedResult', () => {
  it('treats failed repo-grounded tool receipts as a real blocker instead of missing evidence', () => {
    const decision = verifyDelegatedResult({
      envelope: buildBaseEnvelope({
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
      decision: 'blocked',
      retryable: false,
      requiredNextAction: 'Remote sandbox command failed on Daytona Main. stderr: Request failed with status code 502',
    });
  });

  it('requires exact-file answers to cite the successful file claims they collected', () => {
    const decision = verifyDelegatedResult({
      envelope: buildBaseEnvelope({
        taskContract: {
          kind: 'repo_inspection',
          route: 'coding_task',
          operation: 'inspect',
          requiresEvidence: true,
          allowsAnswerFirst: false,
          requireExactFileReferences: true,
          summary: 'Inspect the repository and return the exact files.',
        },
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

  it('does not accept find_tools-only success as execution evidence for command runs', () => {
    const decision = verifyDelegatedResult({
      envelope: buildBaseEnvelope({
        taskContract: {
          kind: 'tool_execution',
          route: 'coding_task',
          operation: 'run',
          requiresEvidence: true,
          allowsAnswerFirst: false,
          requireExactFileReferences: false,
          summary: 'Run the requested command in the remote sandbox.',
        },
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
      missingEvidenceKinds: ['execution_evidence'],
    });
  });

  it('treats failed execution receipts as a real blocker for command runs', () => {
    const decision = verifyDelegatedResult({
      envelope: buildBaseEnvelope({
        taskContract: {
          kind: 'tool_execution',
          route: 'coding_task',
          operation: 'run',
          requiresEvidence: true,
          allowsAnswerFirst: false,
          requireExactFileReferences: false,
          summary: 'Run the requested command in the remote sandbox.',
        },
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
      decision: 'blocked',
      retryable: false,
      requiredNextAction: 'Remote sandbox command failed on Daytona Main. stderr: Request failed with status code 502',
    });
  });
});
