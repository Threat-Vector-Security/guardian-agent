import { describe, expect, it } from 'vitest';

import type { ContinuityThreadRecord } from '../continuity-threads.js';
import type { IntentGatewayDecision } from '../intent-gateway.js';
import { buildPagedListContinuationState } from '../list-continuation.js';
import {
  buildReplySubject,
  extractEmailAddress,
  extractMicrosoft365EmailAddress,
  getDirectMailboxContinuationKind,
  resolveDirectMailboxReadIntent,
} from './direct-mailbox-helpers.js';

function continuityRecord(kind: string): ContinuityThreadRecord {
  return {
    continuityKey: 'assistant:user-1',
    scope: {
      assistantId: 'assistant',
      userId: 'user-1',
    },
    linkedSurfaces: [],
    continuationState: buildPagedListContinuationState(kind, {
      offset: 0,
      limit: 4,
      total: 10,
    }),
    createdAt: 1,
    updatedAt: 1,
    expiresAt: 2,
  };
}

function emailReadDecision(overrides: Partial<IntentGatewayDecision> = {}): IntentGatewayDecision {
  return {
    route: 'email_task',
    confidence: 'high',
    operation: 'read',
    summary: 'Read mailbox messages.',
    turnRelation: 'new_request',
    resolution: 'ready',
    missingFields: [],
    executionClass: 'tool_orchestration',
    preferredTier: 'local',
    requiresRepoGrounding: false,
    requiresToolSynthesis: false,
    expectedContextPressure: 'low',
    preferredAnswerPath: 'direct',
    entities: {},
    ...overrides,
  };
}

describe('direct mailbox helpers', () => {
  it('maps provider-specific continuation kinds without chat-agent state', () => {
    expect(getDirectMailboxContinuationKind('gmail', 'gmail_unread')).toBe('gmail_unread_list');
    expect(getDirectMailboxContinuationKind('gmail', 'gmail_recent_summary')).toBe('gmail_recent_summary_list');
    expect(getDirectMailboxContinuationKind('m365', 'gmail_recent_senders')).toBe('m365_recent_senders_list');
  });

  it('resolves decision-driven and continuation-driven read intents', () => {
    expect(resolveDirectMailboxReadIntent(
      'm365',
      'show me the latest 3 outlook emails',
      emailReadDecision({ entities: { emailProvider: 'm365', mailboxReadMode: 'latest' } }),
    )).toEqual({
      kind: 'gmail_recent_summary',
      count: 3,
    });

    expect(resolveDirectMailboxReadIntent(
      'gmail',
      'show more',
      emailReadDecision({ turnRelation: 'continuation' }),
      continuityRecord('gmail_recent_senders_list'),
    )).toEqual({
      kind: 'gmail_recent_senders',
      count: 4,
    });
  });

  it('formats reply targets and extracts mailbox addresses', () => {
    expect(buildReplySubject('Quarterly plan')).toBe('Re: Quarterly plan');
    expect(buildReplySubject('Re: Quarterly plan')).toBe('Re: Quarterly plan');
    expect(extractEmailAddress('Ada Lovelace <ada@example.com>')).toBe('ada@example.com');
    expect(extractMicrosoft365EmailAddress({ emailAddress: { address: 'grace@example.com' } })).toBe('grace@example.com');
  });
});
