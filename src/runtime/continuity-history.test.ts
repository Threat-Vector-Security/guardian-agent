import { describe, expect, it, vi } from 'vitest';
import type { CodeSessionRecord } from './code-sessions.js';
import type { ContinuityThreadRecord } from './continuity-threads.js';
import { buildContinuityAwareHistory } from './continuity-history.js';

function codeSession(overrides: Partial<CodeSessionRecord> = {}): CodeSessionRecord {
  return {
    id: 'code-session-1',
    ownerUserId: 'owner',
    ownerPrincipalId: 'owner',
    conversationUserId: 'code-session:code-session-1',
    conversationChannel: 'code-session',
    ...overrides,
  } as CodeSessionRecord;
}

function continuity(overrides: Partial<ContinuityThreadRecord> = {}): ContinuityThreadRecord {
  return {
    continuityKey: 'chat:owner',
    scope: {
      assistantId: 'chat',
      userId: 'owner',
    },
    linkedSurfaces: [],
    activeExecutionRefs: [
      { kind: 'execution', id: 'execution-1' },
      { kind: 'code_session', id: 'code-session-1' },
    ],
    createdAt: 1,
    updatedAt: 1,
    expiresAt: 2,
    ...overrides,
  };
}

describe('buildContinuityAwareHistory', () => {
  it('appends linked code-session history as the authoritative tail', () => {
    const linkedSession = codeSession();
    const conversationService = {
      getHistoryForContext: vi.fn(() => [
        { role: 'user' as const, content: 'hello guardian' },
        { role: 'assistant' as const, content: 'hello guardian' },
      ]),
      getSessionHistory: vi.fn(() => [
        { role: 'user' as const, content: 'Find where run timeline rendering is implemented.', timestamp: 1 },
        { role: 'assistant' as const, content: 'Run timeline rendering is implemented in run-timeline-context.js.', timestamp: 2 },
      ]),
    };
    const codeSessionStore = {
      getSession: vi.fn((sessionId: string, ownerUserId?: string) => (
        sessionId === linkedSession.id && (!ownerUserId || ownerUserId === linkedSession.ownerUserId)
          ? linkedSession
          : null
      )),
    };

    const result = buildContinuityAwareHistory({
      conversationService,
      codeSessionStore,
      continuityThread: continuity(),
      currentConversationKey: {
        agentId: 'chat',
        userId: 'owner',
        channel: 'web',
      },
      currentUserId: 'owner',
      currentPrincipalId: 'owner',
    });

    expect(result.linkedCodeSessionId).toBe('code-session-1');
    expect(result.history.map((entry) => entry.content)).toEqual([
      'hello guardian',
      'hello guardian',
      'Find where run timeline rendering is implemented.',
      'Run timeline rendering is implemented in run-timeline-context.js.',
    ]);
    expect(conversationService.getSessionHistory).toHaveBeenCalledWith({
      agentId: 'chat',
      userId: 'code-session:code-session-1',
      channel: 'code-session',
    }, { limit: 8 });
  });

  it('does not leak history from a continuity ref owned by another user', () => {
    const linkedSession = codeSession({
      ownerUserId: 'other-user',
      ownerPrincipalId: 'other-principal',
    });
    const conversationService = {
      getHistoryForContext: vi.fn(() => [
        { role: 'assistant' as const, content: 'current surface answer' },
      ]),
      getSessionHistory: vi.fn(() => [
        { role: 'assistant' as const, content: 'should not be visible', timestamp: 1 },
      ]),
    };
    const codeSessionStore = {
      getSession: vi.fn((sessionId: string, ownerUserId?: string) => {
        if (ownerUserId) return null;
        return sessionId === linkedSession.id ? linkedSession : null;
      }),
    };

    const result = buildContinuityAwareHistory({
      conversationService,
      codeSessionStore,
      continuityThread: continuity(),
      currentConversationKey: {
        agentId: 'chat',
        userId: 'owner',
        channel: 'web',
      },
      currentUserId: 'owner',
      currentPrincipalId: 'owner',
    });

    expect(result).toEqual({
      history: [
        { role: 'assistant', content: 'current surface answer' },
      ],
    });
    expect(conversationService.getSessionHistory).not.toHaveBeenCalled();
  });
});
