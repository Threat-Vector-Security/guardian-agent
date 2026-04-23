import { describe, expect, it } from 'vitest';
import { buildDelegatedExecutionMetadata, buildDelegatedProtocolFailureEnvelope, readDelegatedResultEnvelope } from './metadata.js';
import { buildDelegatedTaskContract } from './verifier.js';

function buildRepoInspectionTaskContract() {
  return buildDelegatedTaskContract({
    route: 'coding_task',
    confidence: 'high',
    operation: 'inspect',
    summary: 'Inspect the repository and return grounded findings.',
    turnRelation: 'new_request',
    resolution: 'ready',
    missingFields: [],
    executionClass: 'repo_grounded',
    preferredTier: 'external',
    requiresRepoGrounding: true,
    requiresToolSynthesis: true,
    requireExactFileReferences: true,
    expectedContextPressure: 'high',
    preferredAnswerPath: 'chat_synthesis',
    entities: {},
  });
}

describe('delegated execution metadata', () => {
  it('builds a typed failure envelope that keeps required steps visible to the supervisor', () => {
    const taskContract = buildRepoInspectionTaskContract();
    const envelope = buildDelegatedProtocolFailureEnvelope(
      taskContract,
      'Delegated worker did not return a typed result envelope.',
    );

    expect(envelope.runStatus).toBe('failed');
    expect(envelope.stopReason).toBe('error');
    expect(envelope.stepReceipts).toEqual(
      taskContract.plan.steps.map((step) => expect.objectContaining({
        stepId: step.stepId,
        status: 'failed',
        evidenceReceiptIds: [],
        summary: step.summary,
      })),
    );
  });

  it('rejects incomplete delegated result metadata that is missing typed envelope fields', () => {
    const taskContract = buildRepoInspectionTaskContract();
    const metadata = buildDelegatedExecutionMetadata(
      buildDelegatedProtocolFailureEnvelope(
        taskContract,
        'Delegated worker did not return a typed result envelope.',
      ),
    );
    delete (metadata.delegatedResult as Record<string, unknown>).stepReceipts;

    expect(readDelegatedResultEnvelope(metadata)).toBeUndefined();
  });
});
