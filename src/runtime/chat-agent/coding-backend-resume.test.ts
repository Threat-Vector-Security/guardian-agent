import { describe, expect, it } from 'vitest';
import type { PendingActionRecord } from '../pending-actions.js';
import {
  buildCodingBackendRunResumePayload,
  executeStoredCodingBackendRun,
} from './coding-backend-resume.js';
import { readCodingBackendRunResumePayload } from './direct-route-resume.js';

const pendingAction: PendingActionRecord = {
  id: 'pending-coding',
  scope: {
    agentId: 'default',
    userId: 'owner',
    channel: 'web',
    surfaceId: 'surface-1',
  },
  status: 'pending',
  transferPolicy: 'origin_surface_only',
  blocker: {
    kind: 'approval',
    prompt: 'Approve coding backend run.',
    approvalIds: ['approval-1'],
  },
  intent: {
    route: 'coding_task',
    operation: 'create',
    originalUserContent: 'Implement the feature.',
  },
  createdAt: 1,
  updatedAt: 1,
  expiresAt: 2,
};

describe('coding backend direct-route resume helpers', () => {
  it('builds a typed direct-route resume payload for pending coding backend approvals', () => {
    const resume = buildCodingBackendRunResumePayload({
      task: 'Implement the feature.',
      backendId: 'codex',
      codeSessionId: 'code-1',
      workspaceRoot: 'S:/Development/GuardianAgent',
    });

    expect(resume?.kind).toBe('direct_route');
    expect(readCodingBackendRunResumePayload(resume?.payload)).toEqual({
      type: 'coding_backend_run',
      task: 'Implement the feature.',
      backendId: 'codex',
      codeSessionId: 'code-1',
      workspaceRoot: 'S:/Development/GuardianAgent',
    });
  });

  it('formats denied coding backend approval resumes without execution metadata', async () => {
    const result = await executeStoredCodingBackendRun(
      pendingAction,
      {
        type: 'coding_backend_run',
        task: 'Implement the feature.',
        backendId: 'codex',
      },
      {
        success: true,
        approved: false,
        message: 'Denied.',
      },
    );

    expect(result).toEqual({
      content: 'The delegated run for codex was not approved.',
    });
  });

  it('normalizes approved coding backend resume results into direct-route metadata', async () => {
    const result = await executeStoredCodingBackendRun(
      pendingAction,
      {
        type: 'coding_backend_run',
        task: 'Implement the feature.',
        backendId: 'codex',
        codeSessionId: 'code-1',
      },
      {
        success: true,
        approved: true,
        message: 'Approved.',
        executionSucceeded: true,
        result: {
          success: true,
          output: {
            success: true,
            backendName: 'Codex',
            assistantResponse: 'Implemented the feature.',
            durationMs: 42,
          },
        },
      },
    );

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
