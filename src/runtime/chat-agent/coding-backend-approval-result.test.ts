import { describe, expect, it } from 'vitest';
import { formatCodingBackendApprovalResult } from './coding-backend-approval-result.js';

describe('coding backend approval result formatting', () => {
  it('ignores non-coding-backend approval results', () => {
    const result = formatCodingBackendApprovalResult({
      success: true,
      approved: true,
      message: 'Approved.',
      job: {
        id: 'job-1',
        toolName: 'fs_write',
        risk: 'mutating',
        origin: 'assistant',
        argsPreview: '{}',
        status: 'succeeded',
        createdAt: 1,
        requiresApproval: true,
      },
    });

    expect(result).toBeNull();
  });

  it('formats denied coding backend approvals without execution metadata', () => {
    const result = formatCodingBackendApprovalResult({
      success: true,
      approved: false,
      message: 'Denied.',
      job: {
        id: 'job-1',
        toolName: 'coding_backend_run',
        risk: 'mutating',
        origin: 'assistant',
        argsPreview: '{"backend":"codex"}',
        argsRedacted: { backend: 'codex' },
        status: 'denied',
        createdAt: 1,
        requiresApproval: true,
      },
    });

    expect(result).toEqual({
      content: 'The delegated run for codex was not approved.',
    });
  });

  it('normalizes approved coding backend tool results into response metadata', () => {
    const result = formatCodingBackendApprovalResult({
      success: true,
      approved: true,
      message: 'Approved.',
      executionSucceeded: true,
      job: {
        id: 'job-1',
        toolName: 'coding_backend_run',
        risk: 'mutating',
        origin: 'assistant',
        codeSessionId: 'code-1',
        argsPreview: '{"backend":"codex"}',
        argsRedacted: { backend: 'codex' },
        status: 'succeeded',
        createdAt: 1,
        requiresApproval: true,
      },
      result: {
        success: true,
        status: 'succeeded',
        jobId: 'job-1',
        message: 'Codex completed.',
        output: {
          success: true,
          backendId: 'codex',
          backendName: 'Codex',
          assistantResponse: 'Implemented the feature.',
          durationMs: 42,
        },
      },
    });

    expect(result).toMatchObject({
      content: 'Implemented the feature.',
      metadata: {
        codingBackendDelegated: true,
        codingBackendId: 'codex',
        codeSessionResolved: true,
        codeSessionId: 'code-1',
        responseSource: {
          providerName: 'Codex',
          durationMs: 42,
        },
      },
    });
  });
});
