import { describe, expect, it, vi } from 'vitest';

import { PendingActionStore } from '../pending-actions.js';
import { createToolsDashboardCallbacks } from './tools-dashboard-callbacks.js';

describe('createToolsDashboardCallbacks', () => {
  it('reports skill provider readiness and disabled reasons without bypassing managed-provider gating', () => {
    const callbacks = createToolsDashboardCallbacks({
      configRef: {
        current: {
          channels: { web: { defaultAgent: 'default' } },
          agents: [{ id: 'default' }],
          llm: {},
          assistant: {
            tools: {
              providerRouting: {},
              providerRoutingEnabled: true,
            },
            skills: {
              enabled: true,
              autoSelect: true,
              maxActivePerRequest: 3,
              disabledSkills: [],
            },
          },
        } as never,
      },
      toolExecutor: {} as never,
      skillRegistry: {
        listStatus: vi.fn(() => [
          { id: 'gmail-helper', enabled: true, requiredManagedProvider: 'gws' },
          { id: 'outlook-helper', enabled: true, requiredManagedProvider: 'm365' },
          { id: 'manual-helper', enabled: false },
        ]),
      } as never,
      enabledManagedProviders: new Set(['gws']),
      identity: {
        resolveCanonicalUserId: vi.fn(() => 'owner'),
      } as never,
      pendingActionStore: new PendingActionStore({
        enabled: false,
        sqlitePath: '/tmp/guardianagent-tools-dashboard-skills-state.test.sqlite',
      }),
      codeSessionStore: {} as never,
      chatAgents: [],
      workerManager: null,
      resolveSharedStateAgentId: (agentId) => agentId,
      getCodeSessionSurfaceId: () => 'web-guardian-chat',
      readMessageSurfaceId: () => undefined,
      readCodeRequestMetadata: () => undefined,
      persistToolsState: () => ({ success: true, message: 'ok' }),
      persistSkillsState: () => ({ success: true, message: 'ok' }),
      applyBrowserRuntimeConfig: async () => ({ success: true, message: 'ok' }),
      decideDashboardToolApproval: vi.fn() as never,
      getCategoryDefaults: () => ({}),
      trackSystemAnalytics: vi.fn(),
      trackToolRunAnalytics: vi.fn(),
    });

    const result = callbacks.onSkillsState?.();

    expect(result).toEqual({
      enabled: true,
      autoSelect: true,
      maxActivePerRequest: 3,
      managedProviders: [
        { id: 'gws', enabled: true },
        { id: 'm365', enabled: false },
      ],
      skills: [
        { id: 'gmail-helper', enabled: true, requiredManagedProvider: 'gws', providerReady: true, disabledReason: undefined },
        {
          id: 'outlook-helper',
          enabled: true,
          requiredManagedProvider: 'm365',
          providerReady: false,
          disabledReason: "Requires managed provider 'm365' to be enabled and connected.",
        },
        { id: 'manual-helper', enabled: false, providerReady: undefined, disabledReason: 'Disabled at runtime.' },
      ],
    });
  });

  it('rolls back skill state when persistence fails', () => {
    const skills = [
      { id: 'gmail-helper', enabled: false, requiredManagedProvider: 'gws' },
      { id: 'manual-helper', enabled: true },
    ];
    const skillRegistry = {
      listStatus: vi.fn(() => skills.map((skill) => ({ ...skill }))),
      enable: vi.fn((skillId: string) => {
        const skill = skills.find((entry) => entry.id === skillId);
        if (!skill) return false;
        skill.enabled = true;
        return true;
      }),
      disable: vi.fn((skillId: string) => {
        const skill = skills.find((entry) => entry.id === skillId);
        if (!skill) return false;
        skill.enabled = false;
        return true;
      }),
    };
    const configRef = {
      current: {
        channels: { web: { defaultAgent: 'default' } },
        agents: [{ id: 'default' }],
        llm: {},
        assistant: {
          tools: {
            providerRouting: {},
            providerRoutingEnabled: true,
          },
          skills: {
            enabled: true,
            autoSelect: true,
            maxActivePerRequest: 3,
            disabledSkills: ['gmail-helper'],
          },
        },
      } as never,
    };

    const callbacks = createToolsDashboardCallbacks({
      configRef,
      toolExecutor: {} as never,
      skillRegistry: skillRegistry as never,
      enabledManagedProviders: new Set(['gws']),
      identity: {
        resolveCanonicalUserId: vi.fn(() => 'owner'),
      } as never,
      pendingActionStore: new PendingActionStore({
        enabled: false,
        sqlitePath: '/tmp/guardianagent-tools-dashboard-skills-rollback.test.sqlite',
      }),
      codeSessionStore: {} as never,
      chatAgents: [],
      workerManager: null,
      resolveSharedStateAgentId: (agentId) => agentId,
      getCodeSessionSurfaceId: () => 'web-guardian-chat',
      readMessageSurfaceId: () => undefined,
      readCodeRequestMetadata: () => undefined,
      persistToolsState: () => ({ success: true, message: 'ok' }),
      persistSkillsState: () => ({ success: false, message: 'disk write failed' }),
      applyBrowserRuntimeConfig: async () => ({ success: true, message: 'ok' }),
      decideDashboardToolApproval: vi.fn() as never,
      getCategoryDefaults: () => ({}),
      trackSystemAnalytics: vi.fn(),
      trackToolRunAnalytics: vi.fn(),
    });

    const result = callbacks.onSkillsUpdate?.({ skillId: 'gmail-helper', enabled: true });

    expect(result).toEqual({ success: false, message: 'disk write failed' });
    expect(skillRegistry.enable).toHaveBeenCalledWith('gmail-helper');
    expect(skillRegistry.disable).toHaveBeenCalledWith('gmail-helper');
    expect(configRef.current.assistant.skills.disabledSkills).toEqual(['gmail-helper']);
    expect(skills.find((skill) => skill.id === 'gmail-helper')?.enabled).toBe(false);
  });

  it('clears the current surface pending action and denies live approvals during pending-state reset', async () => {
    const nowMs = 1_710_000_000_000;
    const pendingActionStore = new PendingActionStore({
      enabled: false,
      sqlitePath: '/tmp/guardianagent-tools-dashboard-pending-reset.test.sqlite',
      now: () => nowMs,
    });
    const created = pendingActionStore.replaceActive({
      agentId: 'default',
      userId: 'owner',
      channel: 'web',
      surfaceId: 'web-guardian-chat',
    }, {
      status: 'pending',
      transferPolicy: 'origin_surface_only',
      blocker: {
        kind: 'approval',
        prompt: 'Waiting for approval.',
        approvalIds: ['approval-live', 'approval-stale'],
      },
      intent: {
        route: 'email_task',
        operation: 'read',
        originalUserContent: 'Check my email.',
      },
      expiresAt: nowMs + 30 * 60_000,
    }, nowMs);
    const chatAgentReset = vi.fn();
    const workerManagerReset = vi.fn();
    const decideApproval = vi
      .fn()
      .mockResolvedValueOnce({ success: true, message: 'Denied approval-live.' })
      .mockResolvedValueOnce({ success: false, message: "Approval 'approval-stale' not found." });
    const trackSystemAnalytics = vi.fn();

    const callbacks = createToolsDashboardCallbacks({
      configRef: {
        current: {
          channels: { web: { defaultAgent: 'default' } },
          agents: [{ id: 'default' }],
          llm: {},
          assistant: {
            tools: {
              providerRouting: {},
              providerRoutingEnabled: true,
            },
          },
        } as never,
      },
      toolExecutor: {
        listPendingApprovalIdsForUser: vi.fn(() => ['approval-live']),
        decideApproval,
        getApprovalSummaries: vi.fn(() => new Map()),
      } as never,
      skillRegistry: null,
      enabledManagedProviders: new Set(),
      identity: {
        resolveCanonicalUserId: vi.fn(() => 'owner'),
      } as never,
      pendingActionStore,
      codeSessionStore: {} as never,
      chatAgents: [{ resetPendingState: chatAgentReset }],
      workerManager: { resetPendingState: workerManagerReset },
      resolveSharedStateAgentId: (agentId) => agentId,
      getCodeSessionSurfaceId: () => 'web-guardian-chat',
      readMessageSurfaceId: () => undefined,
      readCodeRequestMetadata: () => undefined,
      persistToolsState: () => ({ success: true, message: 'ok' }),
      persistSkillsState: () => ({ success: true, message: 'ok' }),
      applyBrowserRuntimeConfig: async () => ({ success: true, message: 'ok' }),
      decideDashboardToolApproval: vi.fn() as never,
      getCategoryDefaults: () => ({}),
      trackSystemAnalytics,
      trackToolRunAnalytics: vi.fn(),
    });

    const result = await callbacks.onPendingActionReset?.({
      userId: 'web-user',
      principalId: 'owner',
      principalRole: 'owner',
      channel: 'web',
      surfaceId: 'web-guardian-chat',
    });

    expect(result).toEqual({
      success: true,
      message: 'Cleared pending state for this chat: cleared 1 pending action, cleared 1 pending approval, dropped 1 stale approval reference.',
      details: {
        clearedPendingActionId: created.id,
        clearedApprovalIds: ['approval-live'],
        ignoredApprovalIds: ['approval-stale'],
        failedApprovalIds: [],
      },
    });
    expect(pendingActionStore.get(created.id)?.status).toBe('cancelled');
    expect(decideApproval).toHaveBeenCalledTimes(2);
    expect(decideApproval).toHaveBeenNthCalledWith(
      1,
      'approval-live',
      'denied',
      'owner',
      'owner',
      'Cleared from chat pending-state reset.',
    );
    expect(decideApproval).toHaveBeenNthCalledWith(
      2,
      'approval-stale',
      'denied',
      'owner',
      'owner',
      'Cleared from chat pending-state reset.',
    );
    expect(chatAgentReset).toHaveBeenCalledTimes(2);
    expect(chatAgentReset).toHaveBeenNthCalledWith(1, {
      userId: 'owner',
      channel: 'web',
      surfaceId: 'web-guardian-chat',
      approvalIds: ['approval-live', 'approval-stale'],
    });
    expect(chatAgentReset).toHaveBeenNthCalledWith(2, {
      userId: 'web-user',
      channel: 'web',
      surfaceId: 'web-guardian-chat',
      approvalIds: ['approval-live', 'approval-stale'],
    });
    expect(workerManagerReset).toHaveBeenCalledTimes(2);
    expect(workerManagerReset).toHaveBeenNthCalledWith(1, {
      userId: 'owner',
      channel: 'web',
      approvalIds: ['approval-live', 'approval-stale'],
    });
    expect(workerManagerReset).toHaveBeenNthCalledWith(2, {
      userId: 'web-user',
      channel: 'web',
      approvalIds: ['approval-live', 'approval-stale'],
    });
    expect(trackSystemAnalytics).toHaveBeenCalledWith('chat_pending_state_reset', {
      channel: 'web',
      surfaceId: 'web-guardian-chat',
      pendingActionCleared: true,
      clearedApprovalCount: 1,
      staleApprovalReferenceCount: 1,
      failedApprovalCount: 0,
    });
  });
});
