import type { AgentContext, UserMessage } from '../../agent/types.js';
import {
  isRecord,
  summarizeGmailMessage,
  summarizeM365From,
  toBoolean,
  toNumber,
  toString,
} from '../../chat-agent-helpers.js';
import type { ToolExecutor } from '../../tools/executor.js';
import type { ContinuityThreadRecord } from '../continuity-threads.js';
import type { IntentGatewayDecision } from '../intent-gateway.js';
import {
  buildPagedListContinuationState,
  readPagedListContinuationState,
  resolvePagedListWindow,
} from '../list-continuation.js';
import { buildGmailRawMessage, parseDirectGmailWriteIntent } from '../gmail-compose.js';
import { buildPendingApprovalMetadata } from '../pending-approval-copy.js';
import type {
  PendingActionApprovalSummary,
  PendingActionRecord,
} from '../pending-actions.js';
import { isDirectMailboxReplyTarget } from './direct-intent-helpers.js';
import {
  buildReplySubject,
  extractEmailAddress,
  extractMicrosoft365EmailAddress,
  getDirectMailboxContinuationKind,
  resolveDirectMailboxReadIntent,
} from './direct-mailbox-helpers.js';

type DirectMailboxResponse =
  | string
  | { content: string; metadata?: Record<string, unknown> }
  | null;

type DirectMailboxReplyTargetResponse =
  | { to: string; subject: string }
  | string
  | { content: string; metadata?: Record<string, unknown> }
  | null;

export interface DirectMailboxDeps {
  agentId: string;
  tools?: Pick<ToolExecutor, 'isEnabled' | 'executeModelTool' | 'getApprovalSummaries'> | null;
  setApprovalFollowUp: (
    approvalId: string,
    copy: { approved: string; denied: string },
  ) => void;
  getPendingApprovals: (
    userKey: string,
    surfaceId?: string,
    nowMs?: number,
  ) => { ids: string[] } | null;
  formatPendingApprovalPrompt: (
    ids: string[],
    summaries?: Map<string, { toolName: string; argsPreview: string }>,
  ) => string;
  setPendingApprovalActionForRequest: (
    userKey: string,
    surfaceId: string | undefined,
    input: {
      prompt: string;
      approvalIds: string[];
      approvalSummaries?: PendingActionApprovalSummary[];
      originalUserContent: string;
      route?: string;
      operation?: string;
      summary?: string;
      turnRelation?: string;
      resolution?: string;
      missingFields?: string[];
      provenance?: PendingActionRecord['intent']['provenance'];
      entities?: Record<string, unknown>;
      codeSessionId?: string;
      resume?: PendingActionRecord['resume'];
    },
  ) => { action: PendingActionRecord | null; collisionPrompt?: string };
  buildPendingApprovalBlockedResponse: (
    result: { action: PendingActionRecord | null; collisionPrompt?: string },
    fallbackContent: string,
  ) => { content: string; metadata?: Record<string, unknown> };
}

export async function tryDirectGoogleWorkspaceWrite(
  input: {
    message: UserMessage;
    ctx: AgentContext;
    userKey: string;
    decision?: IntentGatewayDecision;
  },
  deps: DirectMailboxDeps,
): Promise<DirectMailboxResponse> {
  if (!deps.tools?.isEnabled()) return null;

  if (input.decision?.route === 'email_task' && input.decision.entities.emailProvider === 'm365') {
    return tryDirectMicrosoft365Write(input, deps);
  }

  const intent = parseDirectGmailWriteIntent(input.message.content);
  if (!intent) return null;

  let to = intent.to?.trim();
  let subject = intent.subject?.trim();
  const body = intent.body?.trim();

  if (intent.replyTarget === 'latest_unread') {
    if (!body) {
      return `To ${intent.mode} a reply to the newest unread Gmail message, I need the body.`;
    }
    const replyTarget = await resolveLatestUnreadGmailReplyTarget(input, deps);
    if (!replyTarget) {
      return 'I checked Gmail and could not find an unread message to reply to.';
    }
    if (typeof replyTarget === 'string') {
      return replyTarget;
    }
    if (!isDirectMailboxReplyTarget(replyTarget)) {
      return replyTarget;
    }
    to = replyTarget.to;
    subject = replyTarget.subject;
  }

  if (!to || !subject || !body) {
    const missing: string[] = [];
    if (!to) missing.push('recipient email');
    if (!subject) missing.push('subject');
    if (!body) missing.push('body');
    return `To ${intent.mode} a Gmail email, I need the ${missing.join(', ')}.`;
  }

  const raw = buildGmailRawMessage({
    to,
    subject,
    body,
  });
  const method = intent.mode === 'send' ? 'send' : 'create';
  const resource = intent.mode === 'send' ? 'users messages' : 'users drafts';
  const json = intent.mode === 'send'
    ? { raw }
    : { message: { raw } };

  const toolResult = await deps.tools.executeModelTool(
    'gws',
    {
      service: 'gmail',
      resource,
      method,
      params: { userId: 'me' },
      json,
    },
    buildMailboxToolRequest(input.message, input.ctx, deps),
  );

  if (!toBoolean(toolResult.success)) {
    const blocked = buildMailboxPendingApprovalResponse({
      deps,
      message: input.message,
      userKey: input.userKey,
      toolResult,
      followUp: {
        approved: intent.mode === 'send'
          ? 'I sent the Gmail message.'
          : 'I drafted the Gmail message.',
        denied: intent.mode === 'send'
          ? 'I did not send the Gmail message.'
          : 'I did not draft the Gmail message.',
      },
      intent: {
        route: 'email_task',
        operation: intent.mode,
        summary: intent.mode === 'send' ? 'Sends a Gmail message.' : 'Creates a Gmail draft.',
      },
      fallbackContent: `I prepared a Gmail ${intent.mode} to ${to} with subject "${subject}", but it needs approval first.`,
    });
    if (blocked) return blocked;
    const msg = toString(toolResult.message) || toString(toolResult.error) || 'Google Workspace request failed.';
    return `I tried to ${intent.mode} the Gmail message, but it failed: ${msg}`;
  }

  return intent.mode === 'send'
    ? `I sent the Gmail message to ${to} with subject "${subject}".`
    : `I drafted a Gmail message to ${to} with subject "${subject}".`;
}

export async function tryDirectGoogleWorkspaceRead(
  input: {
    message: UserMessage;
    ctx: AgentContext;
    userKey: string;
    decision?: IntentGatewayDecision;
    continuityThread?: ContinuityThreadRecord | null;
  },
  deps: DirectMailboxDeps,
): Promise<DirectMailboxResponse> {
  if (!deps.tools?.isEnabled()) return null;

  if (input.decision?.route === 'email_task' && input.decision.entities.emailProvider === 'm365') {
    return tryDirectMicrosoft365Read(input, deps);
  }

  const intent = resolveDirectMailboxReadIntent('gmail', input.message.content, input.decision, input.continuityThread);
  if (!intent) return null;
  const continuationKind = getDirectMailboxContinuationKind('gmail', intent.kind);
  const priorWindow = continuationKind
    ? readPagedListContinuationState(input.continuityThread, continuationKind)
    : null;
  const requestedWindow = continuationKind
    ? resolvePagedListWindow({
        continuityThread: input.continuityThread,
        continuationKind,
        content: input.message.content,
        total: priorWindow?.total ?? Math.max(intent.count, 1),
        turnRelation: input.decision?.turnRelation,
        defaultPageSize: Math.max(intent.count, 1),
      })
    : null;

  const listParams: Record<string, unknown> = {
    userId: 'me',
    maxResults: Math.max(
      intent.count,
      1,
      requestedWindow ? requestedWindow.offset + Math.max(requestedWindow.limit, 1) : 0,
    ),
  };
  if (intent.kind === 'gmail_unread') {
    listParams.q = 'is:unread';
  }

  const listResult = await deps.tools.executeModelTool(
    'gws',
    {
      service: 'gmail',
      resource: 'users messages',
      method: 'list',
      params: listParams,
    },
    buildMailboxToolRequest(input.message, input.ctx, deps),
  );

  if (!toBoolean(listResult.success)) {
    const blocked = buildMailboxPendingApprovalResponse({
      deps,
      message: input.message,
      userKey: input.userKey,
      toolResult: listResult,
      followUp: {
        approved: 'I completed the Gmail inbox check.',
        denied: 'I did not check Gmail.',
      },
      intent: {
        route: 'email_task',
        operation: 'read',
        summary: 'Checks Gmail for unread messages.',
      },
      fallbackContent: 'I prepared a Gmail inbox check, but it needs approval first.',
    });
    if (blocked) return blocked;
    const msg = toString(listResult.message) || toString(listResult.error) || 'Google Workspace request failed.';
    return `I tried to check Gmail for unread messages, but it failed: ${msg}`;
  }

  const output = (listResult.output && typeof listResult.output === 'object'
    ? listResult.output
    : null) as { messages?: unknown; resultSizeEstimate?: unknown } | null;
  const messages = output && Array.isArray(output.messages)
    ? output.messages as Array<{ id?: unknown }>
    : [];
  const resultSizeEstimate = output ? toNumber(output.resultSizeEstimate) : null;
  const totalMessages = Math.max(resultSizeEstimate ?? 0, messages.length, priorWindow?.total ?? 0);
  const window = continuationKind
    ? resolvePagedListWindow({
        continuityThread: input.continuityThread,
        continuationKind,
        content: input.message.content,
        total: totalMessages,
        turnRelation: input.decision?.turnRelation,
        defaultPageSize: Math.max(intent.count, 1),
      })
    : {
        offset: 0,
        limit: Math.min(messages.length, Math.max(intent.count, 1)),
        total: totalMessages,
      };
  const pageMessages = messages.slice(window.offset, window.offset + window.limit);
  const continuationState = continuationKind && (window.offset + pageMessages.length) < totalMessages
    ? buildPagedListContinuationState(continuationKind, {
        offset: window.offset,
        limit: Math.max(pageMessages.length, window.limit),
        total: totalMessages,
      }) as unknown as Record<string, unknown>
    : null;

  if (messages.length === 0) {
    if (intent.kind === 'gmail_recent_senders') {
      return 'I checked Gmail and could not find any recent messages.';
    }
    if (intent.kind === 'gmail_recent_summary') {
      return 'I checked Gmail and could not find any recent messages to summarize.';
    }
    return 'I checked Gmail and found no unread messages.';
  }

  if (pageMessages.length === 0 && window.offset >= totalMessages) {
    return continuationState
      ? { content: 'No additional Gmail messages remain.', metadata: { continuationState } }
      : 'No additional Gmail messages remain.';
  }

  const displayLimit = Math.min(pageMessages.length, Math.max(intent.count, 1));
  const summaries = [];
  for (const entry of pageMessages.slice(0, displayLimit)) {
    const id = toString(entry.id);
    if (!id) continue;

    const detailResult = await deps.tools.executeModelTool(
      'gws',
      {
        service: 'gmail',
        resource: 'users messages',
        method: 'get',
        params: {
          userId: 'me',
          messageId: id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        },
      },
      buildMailboxToolRequest(input.message, input.ctx, deps),
    );

    if (!toBoolean(detailResult.success)) continue;

    const summary = summarizeGmailMessage(detailResult.output);
    if (summary) summaries.push(summary);
  }

  if (intent.kind === 'gmail_recent_senders') {
    if (summaries.length === 0) {
      return `I found ${pageMessages.length} recent message${pageMessages.length === 1 ? '' : 's'}, but I could not read their sender metadata.`;
    }
    const lines = [`The senders of the last ${summaries.length} email${summaries.length === 1 ? '' : 's'} are:`];
    for (const [index, summary] of summaries.entries()) {
      const from = summary.from || 'Unknown sender';
      const subject = summary.subject || '(no subject)';
      lines.push(`${index + 1}. ${from} — ${subject}`);
    }
    return continuationState
      ? { content: lines.join('\n'), metadata: { continuationState } }
      : lines.join('\n');
  }

  if (intent.kind === 'gmail_recent_summary') {
    if (summaries.length === 0) {
      return `I found ${pageMessages.length} recent message${pageMessages.length === 1 ? '' : 's'}, but I could not read enough metadata to summarize them.`;
    }
    const lines = [`Here are the last ${summaries.length} email${summaries.length === 1 ? '' : 's'}:`];
    for (const [index, summary] of summaries.entries()) {
      const subject = summary.subject || '(no subject)';
      const from = summary.from || 'Unknown sender';
      lines.push(`${index + 1}. ${subject} — ${from}`);
      if (summary.date) lines.push(`   ${summary.date}`);
      if (summary.snippet) lines.push(`   ${summary.snippet}`);
    }
    return continuationState
      ? { content: lines.join('\n'), metadata: { continuationState } }
      : lines.join('\n');
  }

  const lines = [
    `I checked Gmail and found ${totalMessages} unread message${totalMessages === 1 ? '' : 's'}.`,
  ];

  if (summaries.length === 0) {
    for (const [index, entry] of pageMessages.slice(0, displayLimit).entries()) {
      const id = toString(entry.id);
      if (!id) continue;
      lines.push(`${index + 1}. Message ID: ${id}`);
    }
  } else {
    for (const [index, summary] of summaries.entries()) {
      const subject = summary.subject || '(no subject)';
      const from = summary.from || 'Unknown sender';
      lines.push(`${index + 1}. ${subject} — ${from}`);
      if (summary.date) lines.push(`   ${summary.date}`);
      if (summary.snippet) lines.push(`   ${summary.snippet}`);
    }
  }

  if (totalMessages > window.offset + displayLimit) {
    const remaining = totalMessages - (window.offset + displayLimit);
    lines.push(`...and ${remaining} more unread message${remaining === 1 ? '' : 's'}.`);
  }

  if (intent.kind === 'gmail_unread') {
    lines.push('Ask me to read or summarize any of these if you want the full details.');
  }

  return continuationState
    ? { content: lines.join('\n'), metadata: { continuationState } }
    : lines.join('\n');
}

async function tryDirectMicrosoft365Write(
  input: {
    message: UserMessage;
    ctx: AgentContext;
    userKey: string;
  },
  deps: DirectMailboxDeps,
): Promise<DirectMailboxResponse> {
  if (!deps.tools?.isEnabled()) return null;

  const intent = parseDirectGmailWriteIntent(input.message.content);
  if (!intent) return null;

  let to = intent.to?.trim();
  let subject = intent.subject?.trim();
  const body = intent.body?.trim();

  if (intent.replyTarget === 'latest_unread') {
    if (!body) {
      return `To ${intent.mode} a reply to the newest unread Outlook message, I need the body.`;
    }
    const replyTarget = await resolveLatestUnreadMicrosoft365ReplyTarget(input, deps);
    if (!replyTarget) {
      return 'I checked Outlook and could not find an unread message to reply to.';
    }
    if (typeof replyTarget === 'string') {
      return replyTarget;
    }
    if (!isDirectMailboxReplyTarget(replyTarget)) {
      return replyTarget;
    }
    to = replyTarget.to;
    subject = replyTarget.subject;
  }

  if (!to || !subject || !body) {
    const missing: string[] = [];
    if (!to) missing.push('recipient email');
    if (!subject) missing.push('subject');
    if (!body) missing.push('body');
    return `To ${intent.mode} an Outlook email, I need the ${missing.join(', ')}.`;
  }
  const toolName = intent.mode === 'send' ? 'outlook_send' : 'outlook_draft';

  const toolResult = await deps.tools.executeModelTool(
    toolName,
    { to, subject, body },
    buildMailboxToolRequest(input.message, input.ctx, deps),
  );

  if (!toBoolean(toolResult.success)) {
    const blocked = buildMailboxPendingApprovalResponse({
      deps,
      message: input.message,
      userKey: input.userKey,
      toolResult,
      followUp: {
        approved: intent.mode === 'send'
          ? 'I sent the Outlook message.'
          : 'I drafted the Outlook message.',
        denied: intent.mode === 'send'
          ? 'I did not send the Outlook message.'
          : 'I did not draft the Outlook message.',
      },
      intent: {
        route: 'email_task',
        operation: intent.mode,
        summary: intent.mode === 'send' ? 'Sends an Outlook message.' : 'Creates an Outlook draft.',
        entities: { emailProvider: 'm365' },
      },
      fallbackContent: `I prepared an Outlook ${intent.mode} to ${to} with subject "${subject}", but it needs approval first.`,
    });
    if (blocked) return blocked;
    const msg = toString(toolResult.message) || toString(toolResult.error) || 'Microsoft 365 request failed.';
    return `I tried to ${intent.mode} the Outlook message, but it failed: ${msg}`;
  }

  return intent.mode === 'send'
    ? `I sent the Outlook message to ${to} with subject "${subject}".`
    : `I drafted an Outlook message to ${to} with subject "${subject}".`;
}

async function tryDirectMicrosoft365Read(
  input: {
    message: UserMessage;
    ctx: AgentContext;
    userKey: string;
    decision?: IntentGatewayDecision;
    continuityThread?: ContinuityThreadRecord | null;
  },
  deps: DirectMailboxDeps,
): Promise<DirectMailboxResponse> {
  if (!deps.tools?.isEnabled()) return null;

  const intent = resolveDirectMailboxReadIntent('m365', input.message.content, input.decision, input.continuityThread);
  if (!intent) return null;
  const continuationKind = getDirectMailboxContinuationKind('m365', intent.kind);
  const priorWindow = continuationKind
    ? readPagedListContinuationState(input.continuityThread, continuationKind)
    : null;
  const requestedWindow = continuationKind
    ? resolvePagedListWindow({
        continuityThread: input.continuityThread,
        continuationKind,
        content: input.message.content,
        total: priorWindow?.total ?? Math.max(intent.count, 1),
        turnRelation: input.decision?.turnRelation,
        defaultPageSize: Math.max(intent.count, 1),
      })
    : null;

  const listParams: Record<string, unknown> = {
    $top: Math.max(
      intent.count,
      1,
      requestedWindow ? requestedWindow.offset + Math.max(requestedWindow.limit, 1) : 0,
    ),
    $select: 'id,subject,receivedDateTime,from,isRead',
    $orderby: 'receivedDateTime desc',
  };
  if (intent.kind === 'gmail_unread') {
    listParams.$filter = 'isRead eq false';
  }

  const listResult = await deps.tools.executeModelTool(
    'm365',
    {
      service: 'mail',
      resource: 'me/messages',
      method: 'list',
      params: listParams,
    },
    buildMailboxToolRequest(input.message, input.ctx, deps),
  );

  if (!toBoolean(listResult.success)) {
    const blocked = buildMailboxPendingApprovalResponse({
      deps,
      message: input.message,
      userKey: input.userKey,
      toolResult: listResult,
      followUp: {
        approved: 'I completed the Outlook inbox check.',
        denied: 'I did not check Outlook.',
      },
      intent: {
        route: 'email_task',
        operation: 'read',
        summary: 'Checks Outlook for recent messages.',
        entities: { emailProvider: 'm365' },
      },
      fallbackContent: 'I prepared an Outlook inbox check, but it needs approval first.',
    });
    if (blocked) return blocked;
    const msg = toString(listResult.message) || toString(listResult.error) || 'Microsoft 365 request failed.';
    return `I tried to check Outlook for messages, but it failed: ${msg}`;
  }

  const output = isRecord(listResult.output) ? listResult.output : null;
  const messages = Array.isArray(output?.value)
    ? output.value.filter((entry): entry is Record<string, unknown> => isRecord(entry))
    : [];
  const hasMore = Boolean(toString(output?.['@odata.nextLink']).trim());
  const totalMessages = Math.max(
    messages.length + (hasMore ? 1 : 0),
    priorWindow?.total ?? 0,
  );
  const window = continuationKind
    ? resolvePagedListWindow({
        continuityThread: input.continuityThread,
        continuationKind,
        content: input.message.content,
        total: totalMessages,
        turnRelation: input.decision?.turnRelation,
        defaultPageSize: Math.max(intent.count, 1),
      })
    : {
        offset: 0,
        limit: Math.min(messages.length, Math.max(intent.count, 1)),
        total: totalMessages,
      };
  const pageMessages = messages.slice(window.offset, window.offset + window.limit);
  const continuationState = continuationKind && ((window.offset + pageMessages.length) < totalMessages || hasMore)
    ? buildPagedListContinuationState(continuationKind, {
        offset: window.offset,
        limit: Math.max(pageMessages.length, window.limit),
        total: totalMessages,
      }) as unknown as Record<string, unknown>
    : null;

  if (messages.length === 0) {
    if (intent.kind === 'gmail_recent_senders') {
      return 'I checked Outlook and could not find any recent messages.';
    }
    if (intent.kind === 'gmail_recent_summary') {
      return 'I checked Outlook and could not find any recent messages to summarize.';
    }
    return 'I checked Outlook and found no unread messages.';
  }

  if (pageMessages.length === 0 && window.offset >= totalMessages) {
    return continuationState
      ? { content: 'No additional Outlook messages remain.', metadata: { continuationState } }
      : 'No additional Outlook messages remain.';
  }

  const displayLimit = Math.min(pageMessages.length, Math.max(intent.count, 1));

  if (intent.kind === 'gmail_recent_senders') {
    const lines = [`The senders of the last ${displayLimit} Outlook email${displayLimit === 1 ? '' : 's'} are:`];
    for (const [index, entry] of pageMessages.slice(0, displayLimit).entries()) {
      const from = summarizeM365From(entry.from) || 'Unknown sender';
      const subject = toString(entry.subject) || '(no subject)';
      lines.push(`${index + 1}. ${from} — ${subject}`);
    }
    return continuationState
      ? { content: lines.join('\n'), metadata: { continuationState } }
      : lines.join('\n');
  }

  if (intent.kind === 'gmail_recent_summary') {
    const lines = [`Here are the last ${displayLimit} Outlook email${displayLimit === 1 ? '' : 's'}:`];
    for (const [index, entry] of pageMessages.slice(0, displayLimit).entries()) {
      const subject = toString(entry.subject) || '(no subject)';
      const from = summarizeM365From(entry.from) || 'Unknown sender';
      lines.push(`${index + 1}. ${subject} — ${from}`);
      const received = toString(entry.receivedDateTime);
      if (received) lines.push(`   ${received}`);
    }
    return continuationState
      ? { content: lines.join('\n'), metadata: { continuationState } }
      : lines.join('\n');
  }

  const lines = [
    `Here are the latest ${displayLimit} unread Outlook message${displayLimit === 1 ? '' : 's'}:`,
  ];
  for (const [index, entry] of pageMessages.slice(0, displayLimit).entries()) {
    const subject = toString(entry.subject) || '(no subject)';
    const from = summarizeM365From(entry.from) || 'Unknown sender';
    lines.push(`${index + 1}. ${subject} — ${from}`);
    const received = toString(entry.receivedDateTime);
    if (received) lines.push(`   ${received}`);
  }
  if (totalMessages > window.offset + displayLimit) {
    const remaining = totalMessages - (window.offset + displayLimit);
    lines.push(`...and at least ${remaining} more unread Outlook message${remaining === 1 ? '' : 's'}.`);
  }
  lines.push('Ask me to read or summarize any of these if you want the full details.');
  return continuationState
    ? { content: lines.join('\n'), metadata: { continuationState } }
    : lines.join('\n');
}

async function resolveLatestUnreadGmailReplyTarget(
  input: {
    message: UserMessage;
    ctx: AgentContext;
    userKey: string;
  },
  deps: DirectMailboxDeps,
): Promise<DirectMailboxReplyTargetResponse> {
  if (!deps.tools?.isEnabled()) return null;

  const listResult = await deps.tools.executeModelTool(
    'gws',
    {
      service: 'gmail',
      resource: 'users messages',
      method: 'list',
      params: {
        userId: 'me',
        maxResults: 1,
        q: 'is:unread',
      },
    },
    buildMailboxToolRequest(input.message, input.ctx, deps),
  );

  if (!toBoolean(listResult.success)) {
    const blocked = buildPendingMailboxReplyLookupApproval(
      listResult,
      input,
      deps,
      'Gmail',
    );
    if (blocked) return blocked;
    const msg = toString(listResult.message) || toString(listResult.error) || 'Gmail request failed.';
    return `I tried to look up the newest unread Gmail message for the reply draft, but it failed: ${msg}`;
  }

  const output = isRecord(listResult.output) ? listResult.output : null;
  const messages = Array.isArray(output?.messages)
    ? output.messages.filter((entry): entry is Record<string, unknown> => isRecord(entry))
    : [];
  const newest = messages[0];
  const id = toString(newest?.id);
  if (!id) return null;

  const detailResult = await deps.tools.executeModelTool(
    'gws',
    {
      service: 'gmail',
      resource: 'users messages',
      method: 'get',
      params: {
        userId: 'me',
        messageId: id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject'],
      },
    },
    buildMailboxToolRequest(input.message, input.ctx, deps),
  );
  if (!toBoolean(detailResult.success)) {
    const msg = toString(detailResult.message) || toString(detailResult.error) || 'Gmail request failed.';
    return `I found the newest unread Gmail message, but I couldn't read enough metadata to draft the reply: ${msg}`;
  }

  const summary = summarizeGmailMessage(detailResult.output);
  const to = extractEmailAddress(summary?.from);
  if (!to) {
    return 'I found the newest unread Gmail message, but I could not determine the sender email address.';
  }
  return {
    to,
    subject: buildReplySubject(toString(summary?.subject)),
  };
}

async function resolveLatestUnreadMicrosoft365ReplyTarget(
  input: {
    message: UserMessage;
    ctx: AgentContext;
    userKey: string;
  },
  deps: DirectMailboxDeps,
): Promise<DirectMailboxReplyTargetResponse> {
  if (!deps.tools?.isEnabled()) return null;

  const listResult = await deps.tools.executeModelTool(
    'm365',
    {
      service: 'mail',
      resource: 'me/messages',
      method: 'list',
      params: {
        $top: 1,
        $filter: 'isRead eq false',
        $select: 'id,subject,receivedDateTime,from,isRead',
        $orderby: 'receivedDateTime desc',
      },
    },
    buildMailboxToolRequest(input.message, input.ctx, deps),
  );

  if (!toBoolean(listResult.success)) {
    const blocked = buildPendingMailboxReplyLookupApproval(
      listResult,
      input,
      deps,
      'Outlook',
    );
    if (blocked) return blocked;
    const msg = toString(listResult.message) || toString(listResult.error) || 'Microsoft 365 request failed.';
    return `I tried to look up the newest unread Outlook message for the reply draft, but it failed: ${msg}`;
  }

  const output = isRecord(listResult.output) ? listResult.output : null;
  const messages = Array.isArray(output?.value)
    ? output.value.filter((entry): entry is Record<string, unknown> => isRecord(entry))
    : [];
  const newest = messages[0];
  if (!newest) return null;
  const to = extractMicrosoft365EmailAddress(newest.from);
  if (!to) {
    return 'I found the newest unread Outlook message, but I could not determine the sender email address.';
  }
  return {
    to,
    subject: buildReplySubject(toString(newest.subject)),
  };
}

function buildPendingMailboxReplyLookupApproval(
  toolResult: Record<string, unknown>,
  input: {
    message: UserMessage;
    userKey: string;
  },
  deps: DirectMailboxDeps,
  providerLabel: 'Gmail' | 'Outlook',
): DirectMailboxResponse {
  return buildMailboxPendingApprovalResponse({
    deps,
    message: input.message,
    userKey: input.userKey,
    toolResult,
    followUp: {
      approved: `I looked up the newest unread ${providerLabel} message.`,
      denied: `I did not check ${providerLabel}.`,
    },
    intent: {
      route: 'email_task',
      operation: 'read',
      summary: `Checks ${providerLabel} for the newest unread message before drafting a reply.`,
    },
    fallbackContent: `I prepared a ${providerLabel} inbox check to resolve the reply target, but it needs approval first.`,
  });
}

function buildMailboxPendingApprovalResponse(input: {
  deps: DirectMailboxDeps;
  message: UserMessage;
  userKey: string;
  toolResult: Record<string, unknown>;
  followUp: { approved: string; denied: string };
  intent: {
    route: string;
    operation: string;
    summary: string;
    entities?: Record<string, unknown>;
  };
  fallbackContent: string;
}): Exclude<DirectMailboxResponse, null> | null {
  const status = toString(input.toolResult.status);
  if (status !== 'pending_approval') return null;
  const approvalId = toString(input.toolResult.approvalId);
  const existingIds = input.deps.getPendingApprovals(input.userKey)?.ids ?? [];
  const pendingIds = approvalId ? [...new Set([...existingIds, approvalId])] : existingIds;
  if (approvalId) {
    input.deps.setApprovalFollowUp(approvalId, input.followUp);
  }
  const summaries = pendingIds.length > 0 ? input.deps.tools?.getApprovalSummaries(pendingIds) : undefined;
  const prompt = input.deps.formatPendingApprovalPrompt(pendingIds, summaries);
  const pendingActionResult = input.deps.setPendingApprovalActionForRequest(
    input.userKey,
    input.message.surfaceId,
    {
      prompt,
      approvalIds: pendingIds,
      approvalSummaries: buildPendingApprovalMetadata(pendingIds, summaries),
      originalUserContent: input.message.content,
      route: input.intent.route,
      operation: input.intent.operation,
      summary: input.intent.summary,
      turnRelation: 'new_request',
      resolution: 'ready',
      ...(input.intent.entities ? { entities: input.intent.entities } : {}),
    },
  );
  return input.deps.buildPendingApprovalBlockedResponse(pendingActionResult, [
    input.fallbackContent,
    prompt,
  ].filter(Boolean).join('\n\n'));
}

function buildMailboxToolRequest(
  message: UserMessage,
  ctx: AgentContext,
  deps: DirectMailboxDeps,
) {
  return {
    origin: 'assistant' as const,
    agentId: deps.agentId,
    userId: message.userId,
    channel: message.channel,
    requestId: message.id,
    agentContext: { checkAction: ctx.checkAction },
    ...(message.metadata?.bypassApprovals ? { bypassApprovals: true } : {}),
  };
}
