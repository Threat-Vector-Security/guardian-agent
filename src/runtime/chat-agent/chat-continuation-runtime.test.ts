import { describe, expect, it, vi } from 'vitest';
import type { PendingActionRecord } from '../pending-actions.js';
import type { ChatContinuationGraphResume } from './chat-continuation-graph.js';
import { executeChatContinuationPayload } from './chat-continuation-runtime.js';

describe('chat continuation payload runtime', () => {
  it('dispatches filesystem save continuations with scoped pending-action identity', async () => {
    const executeStoredFilesystemSave = vi.fn(async () => ({ content: 'saved' }));

    const result = await executeChatContinuationPayload({
      pendingAction: pendingAction(),
      resume: resume({
        type: 'filesystem_save_output',
        targetPath: 'tmp/out.txt',
        content: 'hello',
        originalUserContent: 'Save the answer.',
        allowPathRemediation: true,
        principalRole: 'not-a-role',
      }),
      approvalId: 'approval-1',
      approvalResult: { approved: true },
      createRequestId: () => 'request-resume-1',
      executeStoredFilesystemSave,
      executeStoredAutomationAuthoring: vi.fn(),
      resumeStoredToolLoopContinuation: vi.fn(),
    });

    expect(result).toEqual({ content: 'saved' });
    expect(executeStoredFilesystemSave).toHaveBeenCalledWith({
      targetPath: 'tmp/out.txt',
      content: 'hello',
      originalUserContent: 'Save the answer.',
      userKey: 'user-1:web',
      userId: 'user-1',
      channel: 'web',
      surfaceId: 'surface-1',
      principalId: 'user-1',
      principalRole: 'owner',
      requestId: 'request-resume-1',
      codeContext: undefined,
      allowPathRemediation: true,
    });
  });

  it('dispatches automation authoring continuations to the automation executor', async () => {
    const executeStoredAutomationAuthoring = vi.fn(async () => ({ content: 'automation resumed' }));
    const action = pendingAction();
    const continuation = {
      type: 'automation_authoring' as const,
      originalUserContent: 'Create an automation.',
      allowRemediation: true,
    };

    const result = await executeChatContinuationPayload({
      pendingAction: action,
      resume: resume(continuation),
      approvalId: 'approval-1',
      approvalResult: { approved: true },
      createRequestId: () => 'unused',
      executeStoredFilesystemSave: vi.fn(),
      executeStoredAutomationAuthoring,
      resumeStoredToolLoopContinuation: vi.fn(),
    });

    expect(result).toEqual({ content: 'automation resumed' });
    expect(executeStoredAutomationAuthoring).toHaveBeenCalledWith(action, continuation, { approved: true });
  });

  it('dispatches suspended tool-loop continuations and preserves the fallback response', async () => {
    const continuation = {
      type: 'suspended_tool_loop' as const,
      llmMessages: [{ role: 'user' as const, content: 'Write file.' }],
      pendingTools: [{
        approvalId: 'approval-1',
        toolCallId: 'call-1',
        jobId: 'job-1',
        name: 'fs_write',
      }],
      originalMessage: {
        id: 'message-1',
        userId: 'user-1',
        channel: 'web',
        timestamp: 1_000,
        content: 'Write file.',
      },
      requestText: 'Write file.',
      referenceTime: 1_000,
      allowModelMemoryMutation: false,
      activeSkillIds: [],
      contentTrustLevel: 'trusted' as const,
      taintReasons: [],
    };
    const resumeStoredToolLoopContinuation = vi.fn(async () => null);

    const result = await executeChatContinuationPayload({
      pendingAction: pendingAction(),
      resume: resume(continuation),
      approvalId: 'approval-1',
      approvalResult: { approved: true },
      createRequestId: () => 'unused',
      executeStoredFilesystemSave: vi.fn(),
      executeStoredAutomationAuthoring: vi.fn(),
      resumeStoredToolLoopContinuation,
    });

    expect(result).toEqual({ content: 'I could not resume the pending coding run after approval.' });
    expect(resumeStoredToolLoopContinuation).toHaveBeenCalledWith(
      expect.any(Object),
      continuation,
      {
        approvalId: 'approval-1',
        pendingActionAlreadyCleared: true,
        approvalResult: { approved: true },
      },
    );
  });
});

function pendingAction(): PendingActionRecord {
  return {
    id: 'pending-1',
    scope: {
      agentId: 'guardian',
      userId: 'user-1',
      channel: 'web',
      surfaceId: 'surface-1',
    },
    status: 'pending',
    transferPolicy: 'origin_surface_only',
    blocker: {
      kind: 'approval',
      prompt: 'Approve?',
      approvalIds: ['approval-1'],
    },
    intent: {
      originalUserContent: 'Original request.',
    },
    createdAt: 1_000,
    updatedAt: 1_000,
    expiresAt: 2_000,
  };
}

function resume(payload: ChatContinuationGraphResume['payload']): ChatContinuationGraphResume {
  return {
    graph: {
      graphId: 'graph:chat-continuation',
      executionId: 'chat-continuation',
      rootExecutionId: 'chat-continuation',
      requestId: 'request-1',
      createdAt: 1_000,
      updatedAt: 1_000,
      status: 'pending',
      intent: {
        route: 'general_assistant',
        confidence: 'high',
        operation: 'update',
        summary: 'Resume.',
        turnRelation: 'new_request',
        resolution: 'ready',
        missingFields: [],
        executionClass: 'tool_orchestration',
        entities: {},
      },
      securityContext: {},
      trigger: { type: 'user_request' },
      nodes: [],
      edges: [],
      artifacts: [],
      checkpoints: [],
    },
    nodeId: 'node:approval',
    resumeToken: 'resume-token',
    artifact: {
      artifactId: 'artifact:continuation',
      graphId: 'graph:chat-continuation',
      nodeId: 'node:approval',
      artifactType: 'ChatContinuation',
      label: 'Continuation',
      refs: [],
      trustLevel: 'trusted',
      taintReasons: [],
      redactionPolicy: 'internal_resume_payload',
      content: {
        type: 'chat_continuation',
        payload,
      },
      createdAt: 1_000,
    },
    payload,
  };
}
