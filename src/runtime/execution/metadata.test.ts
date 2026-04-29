import { describe, expect, it } from 'vitest';
import {
  buildDelegatedExecutionMetadata,
  buildDelegatedProtocolFailureEnvelope,
  buildDelegatedSyntheticEnvelope,
  readDelegatedResultEnvelope,
  sanitizeDelegatedEnvelopeForOperator,
  sanitizeExecutionEventsForOperator,
} from './metadata.js';
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

  it('removes raw tool payload fields from operator-facing execution events', () => {
    const sanitized = sanitizeExecutionEventsForOperator([
      {
        eventId: 'event-1',
        type: 'tool_call_completed',
        timestamp: 123,
        payload: {
          toolName: 'fs_search',
          status: 'succeeded',
          args: { query: 'token' },
          rawOutput: 'sensitive raw tool output',
          traceResultPreview: 'raw preview',
          resultSummary: 'Found 1 match.',
        },
      },
    ]);

    expect(sanitized).toEqual([
      {
        eventId: 'event-1',
        type: 'tool_call_completed',
        timestamp: 123,
        payload: {
          toolName: 'fs_search',
          status: 'succeeded',
          resultSummary: 'Found 1 match.',
        },
      },
    ]);
  });

  it('sanitizes delegated envelope events without mutating verifier metadata', () => {
    const taskContract = buildRepoInspectionTaskContract();
    const envelope = buildDelegatedSyntheticEnvelope({
      taskContract,
      runStatus: 'completed',
      stopReason: 'end_turn',
      operatorSummary: 'Completed repo inspection.',
      events: [
        {
          eventId: 'event-1',
          type: 'tool_call_completed',
          timestamp: 123,
          payload: {
            toolName: 'web_fetch',
            rawOutput: '<html>Example Domain</html>',
            traceResultPreview: 'Example Domain page body',
            status: 'succeeded',
          },
        },
      ],
    });

    const sanitized = sanitizeDelegatedEnvelopeForOperator(envelope);

    expect(sanitized).not.toBe(envelope);
    expect(sanitized.events[0].payload).toEqual({
      toolName: 'web_fetch',
      status: 'succeeded',
    });
    expect(envelope.events[0].payload.rawOutput).toBe('<html>Example Domain</html>');
    expect(envelope.events[0].payload.traceResultPreview).toBe('Example Domain page body');
  });
});
