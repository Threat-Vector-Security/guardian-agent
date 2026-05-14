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

  it('preserves Codex project artifacts from approved coding backend runs', () => {
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
        argsPreview: '{"backend":"codex-sdk"}',
        argsRedacted: { backend: 'codex-sdk' },
        status: 'succeeded',
        createdAt: 1,
        requiresApproval: true,
      },
      result: {
        success: true,
        status: 'succeeded',
        jobId: 'job-1',
        message: 'Codex SDK completed.',
        output: {
          success: true,
          backendId: 'codex-sdk',
          backendName: 'OpenAI Codex SDK',
          assistantResponse: 'Created index.html.',
          codexProject: {
            codeSessionId: 'code-1',
            workspaceRoot: 'S:/Development/Smoke',
            activeThreadId: 'thread-1',
            lastRunSessionId: 'cb-1',
            lastFilesChanged: ['index.html'],
          },
        },
      },
    });

    expect(result).toMatchObject({
      content: 'Created index.html.',
      metadata: {
        codingBackendDelegated: true,
        codingBackendId: 'codex-sdk',
        codingBackendCodexProject: {
          activeThreadId: 'thread-1',
          lastFilesChanged: ['index.html'],
        },
        continuationState: {
          kind: 'coding_backend_project',
          payload: {
            source: 'coding_backend_run',
            backendId: 'codex-sdk',
            codeSessionId: 'code-1',
            workspaceRoot: 'S:/Development/Smoke',
            activeThreadId: 'thread-1',
            lastRunSessionId: 'cb-1',
            filesChanged: ['index.html'],
          },
        },
      },
    });
  });
});
