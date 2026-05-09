import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createWorkspaceDashboardCallbacks } from './workspace-dashboard-callbacks.js';
import { CodeSessionStore } from '../code-sessions.js';
import { ConversationService } from '../conversation.js';
import { IdentityService } from '../identity.js';
import { RunTimelineStore } from '../run-timeline.js';

describe('workspace dashboard callbacks', () => {
  it('clears code-session current-context state when resetting the attached conversation', () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), 'ga-dashboard-reset-'));
    try {
      const codeSessionStore = new CodeSessionStore({
        enabled: false,
        sqlitePath: ':memory:',
        now: () => 10,
      });
      const session = codeSessionStore.createSession({
        ownerUserId: 'owner',
        ownerPrincipalId: 'web-open',
        title: 'Music Platform',
        workspaceRoot,
      });
      codeSessionStore.updateSession({
        sessionId: session.id,
        ownerUserId: 'owner',
        status: 'awaiting_approval',
        uiState: {
          selectedFilePath: join(workspaceRoot, 'server.js'),
        },
        workState: {
          focusSummary: 'Continue the stale MusicApp build.',
          planSummary: 'Old plan',
          compactedSummary: 'Old compacted summary',
          pendingApprovals: [{ id: 'approval-1', toolName: 'code_remote_exec', argsPreview: '{}' }],
          recentJobs: [{ id: 'job-1', toolName: 'code_remote_exec', status: 'pending_approval' }],
          changedFiles: ['server.js'],
          verification: [{
            id: 'runtime',
            kind: 'manual',
            status: 'warn',
            summary: 'Old verification state.',
            timestamp: 9,
          }],
        },
      });

      const callbacks = createWorkspaceDashboardCallbacks({
        codeSessionStore,
        identity: new IdentityService({ mode: 'single_user', primaryUserId: 'owner' }),
        conversations: new ConversationService({
          enabled: false,
          sqlitePath: ':memory:',
          retentionDays: 30,
        }),
        pendingActionStore: {
          cancelActiveForAssistantUser: vi.fn(() => []),
          cancelActiveForCodeSession: vi.fn(() => []),
        } as never,
        runTimeline: new RunTimelineStore(),
        toolExecutor: {} as never,
        refreshRunTimelineSnapshots: vi.fn(),
        maybeScheduleCodeSession: (value) => value,
        hydrateCodeSessionRuntimeState: (value) => value,
        buildCodeSessionSnapshot: (value) => value as never,
        getCodeSessionSandboxes: () => ({ sandboxes: [] }) as never,
        createCodeSessionSandbox: () => ({ success: false }) as never,
        deleteCodeSessionSandbox: () => ({ success: false }) as never,
        releaseCodeSessionSandboxes: vi.fn(),
        getCodeSessionSurfaceId: () => 'web-guardian-chat',
        resetCodeSessionWorkspacePolicy: vi.fn(),
        reconcileConfiguredAllowedPaths: vi.fn(),
        approvalBelongsToCodeSession: () => false,
        resolveDashboardCodeSessionRequest: () => ({
          resolvedChannel: 'web',
          resolvedSurfaceId: 'web-guardian-chat',
          canonicalUserId: 'owner',
          resolvedSession: null,
        }),
        decideDashboardToolApproval: vi.fn(),
        createStructuredRequestError: (message: string) => new Error(message),
        getCodeSessionConversationKey: (value) => ({
          agentId: 'default',
          userId: value.conversationUserId,
          channel: value.conversationChannel,
        }),
        resolveSharedStateAgentId: (agentId?: string) => agentId,
        trackConversationReset: vi.fn(),
      });

      const result = callbacks.onCodeSessionResetConversation?.({
        sessionId: session.id,
        userId: 'web-user',
        channel: 'web',
        principalId: 'web-open',
        surfaceId: 'web-guardian-chat',
      });

      expect(result).toMatchObject({ success: true, message: 'Conversation reset.' });
      const reset = codeSessionStore.getSession(session.id, 'owner');
      expect(reset?.status).toBe('active');
      expect(reset?.uiState.selectedFilePath).toBeNull();
      expect(reset?.workState.focusSummary).toBe('');
      expect(reset?.workState.planSummary).toBe('');
      expect(reset?.workState.compactedSummary).toBe('');
      expect(reset?.workState.pendingApprovals).toEqual([]);
      expect(reset?.workState.recentJobs).toEqual([]);
      expect(reset?.workState.changedFiles).toEqual([]);
      expect(reset?.workState.verification).toEqual([]);
      expect(reset?.workState.workspaceProfile).toBeTruthy();
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });
});
