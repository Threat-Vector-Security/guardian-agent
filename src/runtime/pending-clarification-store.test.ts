import { describe, expect, it } from 'vitest';
import { PendingClarificationStore } from './pending-clarification-store.js';

describe('PendingClarificationStore', () => {
  it('stores and retrieves clarification state by logical assistant context', () => {
    const store = new PendingClarificationStore();
    store.set(
      { agentId: '__tier_shared__', userId: 'user-1', channel: 'web' },
      {
        kind: 'email_provider',
        originalUserContent: 'Check my email.',
        prompt: 'Which provider should I use?',
        createdAt: 100,
        expiresAt: 10_000,
      },
    );

    expect(store.get({ agentId: '__tier_shared__', userId: 'user-1', channel: 'web' }, 500)).toMatchObject({
      kind: 'email_provider',
      originalUserContent: 'Check my email.',
    });
  });

  it('expires stale clarification state', () => {
    const store = new PendingClarificationStore();
    store.set(
      { agentId: '__tier_shared__', userId: 'user-1', channel: 'web' },
      {
        kind: 'coding_backend',
        originalUserContent: 'Use a coding backend.',
        prompt: 'Which backend should I use?',
        createdAt: 100,
        expiresAt: 200,
      },
    );

    expect(store.get({ agentId: '__tier_shared__', userId: 'user-1', channel: 'web' }, 300)).toBeNull();
    expect(store.get({ agentId: '__tier_shared__', userId: 'user-1', channel: 'web' }, 300)).toBeNull();
  });

  it('clears clarification state without affecting other contexts', () => {
    const store = new PendingClarificationStore();
    store.set(
      { agentId: '__tier_shared__', userId: 'user-1', channel: 'web' },
      {
        kind: 'generic',
        originalUserContent: 'Do the thing.',
        prompt: 'Which thing?',
        createdAt: 100,
        expiresAt: 10_000,
      },
    );
    store.set(
      { agentId: 'default', userId: 'user-2', channel: 'cli' },
      {
        kind: 'generic',
        originalUserContent: 'Do the other thing.',
        prompt: 'Which other thing?',
        createdAt: 100,
        expiresAt: 10_000,
      },
    );

    store.clear({ agentId: '__tier_shared__', userId: 'user-1', channel: 'web' });

    expect(store.get({ agentId: '__tier_shared__', userId: 'user-1', channel: 'web' }, 500)).toBeNull();
    expect(store.get({ agentId: 'default', userId: 'user-2', channel: 'cli' }, 500)).toMatchObject({
      originalUserContent: 'Do the other thing.',
    });
  });
});
