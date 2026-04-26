import { describe, expect, it, vi } from 'vitest';
import type { UserMessage } from '../../agent/types.js';
import type { PendingActionRecord } from '../pending-actions.js';
import {
  isPendingApprovalStatusQuery,
  tryBuildDirectPendingApprovalStatusResponse,
} from './pending-approval-status.js';

describe('pending approval status helper', () => {
  it('keeps exact pre-gateway approval status matching narrow', () => {
    expect(isPendingApprovalStatusQuery('pending approvals?', { exactOnly: true })).toBe(true);
    expect(isPendingApprovalStatusQuery('approvals pending?', { exactOnly: true })).toBe(true);
    expect(isPendingApprovalStatusQuery('What pending approvals do I have right now?', { exactOnly: true })).toBe(false);
    expect(isPendingApprovalStatusQuery('Which files implement pending approvals?', { exactOnly: true })).toBe(false);
  });

  it('accepts broad status phrasing without consuming repo-inspection questions', () => {
    expect(isPendingApprovalStatusQuery('What pending approvals do I have right now?')).toBe(true);
    expect(isPendingApprovalStatusQuery('Show my current pending approvals')).toBe(true);
    expect(isPendingApprovalStatusQuery('Are there any pending approvals today?')).toBe(true);
    expect(isPendingApprovalStatusQuery('Which files implement pending approvals?')).toBe(false);
  });

  it('builds status from live approvals through pending-action state', () => {
    const message: UserMessage = {
      id: 'msg-1',
      userId: 'owner',
      channel: 'web',
      surfaceId: 'web-chat',
      content: 'pending approvals?',
      timestamp: 1_710_000_000_000,
    };
    const pendingAction: PendingActionRecord = {
      id: 'pending-1',
      scope: {
        agentId: 'chat',
        userId: 'owner',
        channel: 'web',
        surfaceId: 'web-chat',
      },
      status: 'pending',
      transferPolicy: 'origin_surface_only',
      blocker: {
        kind: 'approval',
        prompt: 'Approve file write.',
        approvalIds: ['approval-1'],
      },
      intent: {
        route: 'filesystem_task',
        originalUserContent: 'Write a file.',
      },
      createdAt: 1_710_000_000_000,
      updatedAt: 1_710_000_000_000,
      expiresAt: 1_710_001_800_000,
    };
    const setPendingApprovals = vi.fn();
    const getPendingApprovalAction = vi
      .fn<[string, string, string?], PendingActionRecord | null>()
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(pendingAction);
    const formatPendingApprovalPrompt = vi.fn(() => 'Approval required.');

    const response = tryBuildDirectPendingApprovalStatusResponse(message, {
      tools: {
        isEnabled: () => true,
        listPendingApprovalIdsForUser: vi.fn(() => ['approval-1']),
        getApprovalSummaries: vi.fn(() => new Map([[
          'approval-1',
          { toolName: 'fs_write', argsPreview: '{"path":"tmp/file.txt"}' },
        ]])),
      },
      getCodeSessionSurfaceId: () => 'web-chat',
      getPendingApprovalAction,
      setPendingApprovals,
      formatPendingApprovalPrompt,
    });

    expect(setPendingApprovals).toHaveBeenCalledWith('owner:web', ['approval-1'], 'web-chat');
    expect(formatPendingApprovalPrompt).toHaveBeenCalledWith(
      ['approval-1'],
      expect.any(Map),
    );
    expect(response?.content).toBe('Approval required.');
    expect(response?.metadata?.pendingAction).toMatchObject({
      id: 'pending-1',
      blocker: {
        kind: 'approval',
        approvalIds: ['approval-1'],
      },
    });
  });
});
