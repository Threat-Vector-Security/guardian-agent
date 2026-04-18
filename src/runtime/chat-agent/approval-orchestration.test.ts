import { describe, expect, it, vi } from 'vitest';

import type { AgentContext, UserMessage } from '../../agent/types.js';
import { handleApprovalMessage, syncPendingApprovalsFromExecutor } from './approval-orchestration.js';

describe('approval-orchestration', () => {
  it('suppresses generic tool-completed copy when a direct-route approval resumes into a final response', async () => {
    const pendingAction = {
      id: 'pending-1',
      scope: {
        agentId: 'chat',
        userId: 'owner',
        channel: 'web',
        surfaceId: 'owner',
      },
      status: 'pending',
      transferPolicy: 'origin_surface_only',
      blocker: {
        kind: 'approval',
        prompt: 'Approve note save',
        approvalIds: ['approval-1'],
      },
      intent: {
        route: 'personal_assistant_task',
        operation: 'create',
        originalUserContent: 'Save this note.',
      },
      resume: {
        kind: 'direct_route',
        payload: {
          type: 'second_brain_mutation',
        },
      },
      createdAt: 1,
      updatedAt: 1,
      expiresAt: 2,
    } as const;

    const message: UserMessage = {
      id: 'msg-1',
      userId: 'owner',
      channel: 'web',
      surfaceId: 'owner',
      content: 'yes',
      timestamp: Date.now(),
    };
    const ctx: AgentContext = {
      agentId: 'chat',
      emit: vi.fn(async () => {}),
      llm: { name: 'test' } as never,
      checkAction: vi.fn(),
      capabilities: [],
    };

    const result = await handleApprovalMessage({
      message,
      ctx,
      tools: {
        decideApproval: vi.fn(async () => ({
          success: true,
          message: "Tool 'second_brain_note_upsert' completed.",
        })),
        getApprovalSummaries: vi.fn(() => new Map()),
        listPendingApprovalIdsForUser: vi.fn(() => []),
      },
      getPendingApprovalAction: vi.fn(() => pendingAction as never),
      setPendingApprovals: vi.fn(),
      setPendingApprovalAction: vi.fn(() => ({ action: pendingAction })),
      completePendingAction: vi.fn(),
      takeApprovalFollowUp: vi.fn(() => null),
      clearApprovalFollowUp: vi.fn(),
      getAutomationApprovalContinuation: vi.fn(() => null),
      setAutomationApprovalContinuation: vi.fn(),
      clearAutomationApprovalContinuation: vi.fn(),
      tryDirectAutomationAuthoring: vi.fn(async () => null),
      resumeStoredToolLoopPendingAction: vi.fn(async () => null),
      resumeStoredDirectRoutePendingAction: vi.fn(async () => ({
        content: 'Note created: Smoke Test Note',
      })),
      normalizeDirectRouteContinuationResponse: vi.fn((response) => response),
      withCurrentPendingActionMetadata: vi.fn((metadata) => metadata),
      formatPendingApprovalPrompt: vi.fn(() => 'Approve it'),
      resolveApprovalTargets: vi.fn(() => ({ ids: ['approval-1'], errors: [] })),
    });

    expect(result?.content).toBe('Note created: Smoke Test Note');
  });

  it('does not synthesize a pending approval action on unrelated turns when only live approvals remain', () => {
    const setPendingApprovals = vi.fn();

    syncPendingApprovalsFromExecutor({
      tools: {
        isEnabled: () => true,
        listPendingApprovalIdsForUser: () => ['approval-1'],
      },
      sourceUserId: 'owner',
      sourceChannel: 'web',
      targetUserId: 'owner',
      targetChannel: 'web',
      surfaceId: 'web-guardian-chat',
      getPendingApprovalAction: () => null,
      setPendingApprovals,
      updatePendingAction: vi.fn(),
    });

    expect(setPendingApprovals).not.toHaveBeenCalled();
  });

  it('preserves execution binding when partial approval resolution rebuilds the pending approval action', async () => {
    const pendingAction = {
      id: 'pending-1',
      scope: {
        agentId: 'chat',
        userId: 'owner',
        channel: 'web',
        surfaceId: 'owner',
      },
      status: 'pending',
      transferPolicy: 'origin_surface_only',
      blocker: {
        kind: 'approval',
        prompt: 'Approve the remaining actions',
        approvalIds: ['approval-1', 'approval-2'],
      },
      intent: {
        route: 'coding_task',
        operation: 'update',
        originalUserContent: 'Refactor the orchestration stack.',
      },
      executionId: 'exec-1',
      rootExecutionId: 'exec-root',
      codeSessionId: 'session-1',
      createdAt: 1,
      updatedAt: 1,
      expiresAt: 2,
    } as const;

    const setPendingApprovalAction = vi.fn(() => ({ action: pendingAction }));

    const result = await handleApprovalMessage({
      message: {
        id: 'msg-2',
        userId: 'owner',
        channel: 'web',
        surfaceId: 'owner',
        content: 'approve the first one',
        timestamp: Date.now(),
      },
      ctx: {
        agentId: 'chat',
        emit: vi.fn(async () => {}),
        checkAction: vi.fn(),
        capabilities: [],
      },
      tools: {
        decideApproval: vi.fn(async () => ({
          success: true,
          message: 'Approved and executed.',
        })),
        getApprovalSummaries: vi.fn(() => new Map()),
        listPendingApprovalIdsForUser: vi.fn(() => ['approval-2']),
      },
      getPendingApprovalAction: vi.fn(() => pendingAction as never),
      setPendingApprovals: vi.fn(),
      setPendingApprovalAction,
      completePendingAction: vi.fn(),
      takeApprovalFollowUp: vi.fn(() => null),
      clearApprovalFollowUp: vi.fn(),
      getAutomationApprovalContinuation: vi.fn(() => null),
      setAutomationApprovalContinuation: vi.fn(),
      clearAutomationApprovalContinuation: vi.fn(),
      tryDirectAutomationAuthoring: vi.fn(async () => null),
      resumeStoredToolLoopPendingAction: vi.fn(async () => null),
      resumeStoredDirectRoutePendingAction: vi.fn(async () => null),
      normalizeDirectRouteContinuationResponse: vi.fn((response) => response),
      withCurrentPendingActionMetadata: vi.fn((metadata) => metadata),
      formatPendingApprovalPrompt: vi.fn(() => 'Approve the remaining action'),
      resolveApprovalTargets: vi.fn(() => ({ ids: ['approval-1'], errors: [] })),
    });

    expect(result?.content).toContain('Approve the remaining action');
    expect(setPendingApprovalAction).toHaveBeenCalledWith(
      'owner',
      'web',
      'owner',
      expect.objectContaining({
        executionId: 'exec-1',
        rootExecutionId: 'exec-root',
        codeSessionId: 'session-1',
      }),
    );
  });
});
