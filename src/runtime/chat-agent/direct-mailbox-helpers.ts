import {
  isRecord,
  parseDirectGoogleWorkspaceIntent,
  parseRequestedEmailCount,
  toString,
} from '../../chat-agent-helpers.js';
import type { ContinuityThreadRecord } from '../continuity-threads.js';
import type { IntentGatewayDecision } from '../intent-gateway.js';
import {
  hasPagedListFollowUpRequest,
  readPagedListContinuationState,
} from '../list-continuation.js';

const GMAIL_UNREAD_CONTINUATION_KIND = 'gmail_unread_list';
const GMAIL_RECENT_SENDERS_CONTINUATION_KIND = 'gmail_recent_senders_list';
const GMAIL_RECENT_SUMMARY_CONTINUATION_KIND = 'gmail_recent_summary_list';
const M365_UNREAD_CONTINUATION_KIND = 'm365_unread_list';
const M365_RECENT_SENDERS_CONTINUATION_KIND = 'm365_recent_senders_list';
const M365_RECENT_SUMMARY_CONTINUATION_KIND = 'm365_recent_summary_list';

type DirectMailboxProvider = 'gmail' | 'm365';
type DirectMailboxReadIntent = NonNullable<ReturnType<typeof parseDirectGoogleWorkspaceIntent>>;

export function getDirectMailboxContinuationKind(
  provider: DirectMailboxProvider,
  kind: DirectMailboxReadIntent['kind'],
): string {
  if (provider === 'gmail') {
    switch (kind) {
      case 'gmail_recent_senders':
        return GMAIL_RECENT_SENDERS_CONTINUATION_KIND;
      case 'gmail_recent_summary':
        return GMAIL_RECENT_SUMMARY_CONTINUATION_KIND;
      case 'gmail_unread':
      default:
        return GMAIL_UNREAD_CONTINUATION_KIND;
    }
  }
  switch (kind) {
    case 'gmail_recent_senders':
      return M365_RECENT_SENDERS_CONTINUATION_KIND;
    case 'gmail_recent_summary':
      return M365_RECENT_SUMMARY_CONTINUATION_KIND;
    case 'gmail_unread':
    default:
      return M365_UNREAD_CONTINUATION_KIND;
  }
}

export function resolveDirectMailboxReadIntent(
  provider: DirectMailboxProvider,
  content: string,
  decision?: IntentGatewayDecision | null,
  continuityThread?: ContinuityThreadRecord | null,
): DirectMailboxReadIntent | null {
  const decisionDriven = resolveDecisionMailboxReadIntent(provider, content, decision);
  if (decisionDriven) return decisionDriven;
  const parsed = parseDirectGoogleWorkspaceIntent(content);
  if (parsed) return parsed;
  if (!hasPagedListFollowUpRequest(content, decision?.turnRelation)) {
    return null;
  }
  const continuationKinds = provider === 'gmail'
    ? [
        [GMAIL_UNREAD_CONTINUATION_KIND, 'gmail_unread'],
        [GMAIL_RECENT_SENDERS_CONTINUATION_KIND, 'gmail_recent_senders'],
        [GMAIL_RECENT_SUMMARY_CONTINUATION_KIND, 'gmail_recent_summary'],
      ] as const
    : [
        [M365_UNREAD_CONTINUATION_KIND, 'gmail_unread'],
        [M365_RECENT_SENDERS_CONTINUATION_KIND, 'gmail_recent_senders'],
        [M365_RECENT_SUMMARY_CONTINUATION_KIND, 'gmail_recent_summary'],
      ] as const;
  for (const [continuationKind, kind] of continuationKinds) {
    const prior = readPagedListContinuationState(continuityThread, continuationKind);
    if (!prior) continue;
    return {
      kind,
      count: Math.max(1, prior.limit),
    };
  }
  return null;
}

function resolveDecisionMailboxReadIntent(
  provider: DirectMailboxProvider,
  content: string,
  decision?: IntentGatewayDecision | null,
): DirectMailboxReadIntent | null {
  if (!decision || decision.route !== 'email_task' || decision.operation !== 'read') {
    return null;
  }
  const declaredProvider = decision.entities.emailProvider;
  if (declaredProvider && ((provider === 'gmail' && declaredProvider !== 'gws')
    || (provider === 'm365' && declaredProvider !== 'm365'))) {
    return null;
  }
  const mailboxReadMode = decision.entities.mailboxReadMode;
  if (!mailboxReadMode) return null;
  return {
    kind: mailboxReadMode === 'latest' ? 'gmail_recent_summary' : 'gmail_unread',
    count: parseRequestedEmailCount(content),
  };
}

export function buildReplySubject(subject: string): string {
  const trimmed = subject.trim() || '(no subject)';
  return /^re:/i.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}

export function extractEmailAddress(value: string | undefined): string {
  const text = toString(value).trim();
  if (!text) return '';
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0]?.trim() ?? '';
}

export function extractMicrosoft365EmailAddress(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  const emailAddress = isRecord(record.emailAddress) ? record.emailAddress : null;
  return toString(emailAddress?.address).trim();
}
