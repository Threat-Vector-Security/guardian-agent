import { describe, expect, it, vi } from 'vitest';

import { resumeStoredCapabilityContinuationPendingAction } from './capability-continuation-runtime.js';

describe('capability continuation runtime', () => {
  it('dispatches automation authoring resume payloads to the automation authoring executor', async () => {
    const pendingAction = {
      id: 'pending-automation',
      scope: {
        agentId: 'default',
        userId: 'owner',
        channel: 'web',
        surfaceId: 'web-guardian-chat',
      },
      status: 'pending',
      transferPolicy: 'origin_surface_only',
      blocker: {
        kind: 'approval',
        prompt: 'Approve policy remediation',
        approvalIds: ['approval-1'],
      },
      intent: {
        route: 'automation_authoring',
        operation: 'create',
        originalUserContent: 'Create a daily automation.',
      },
      resume: {
        kind: 'capability_continuation',
        payload: {
          type: 'automation_authoring',
          originalUserContent: 'Create a daily automation.',
          allowRemediation: true,
        },
      },
      createdAt: 1,
      updatedAt: 1,
      expiresAt: 2,
    } as const;
    const completePendingAction = vi.fn();
    const executeStoredAutomationAuthoring = vi.fn(async () => ({
      content: 'Automation created.',
    }));

    const result = await resumeStoredCapabilityContinuationPendingAction({
      pendingAction,
      options: {
        approvalResult: {
          success: true,
          approved: true,
          message: 'Approved.',
        },
      },
      completePendingAction,
      executeStoredFilesystemSave: vi.fn(),
      executeStoredAutomationAuthoring,
    });

    expect(result).toEqual({ content: 'Automation created.' });
    expect(completePendingAction).toHaveBeenCalledWith('pending-automation');
    expect(executeStoredAutomationAuthoring).toHaveBeenCalledWith(
      pendingAction,
      expect.objectContaining({
        type: 'automation_authoring',
        originalUserContent: 'Create a daily automation.',
      }),
      expect.objectContaining({ approved: true }),
    );
  });
});
