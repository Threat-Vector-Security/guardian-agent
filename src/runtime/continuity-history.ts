import type { CodeSessionRecord, CodeSessionStore } from './code-sessions.js';
import type { ConversationContextOptions, ConversationKey, ConversationService } from './conversation.js';
import type { ContinuityThreadRecord } from './continuity-threads.js';
import type { PromptAssemblyHistoryEntry } from './context-assembly.js';

export interface ContinuityAwareHistoryResult {
  history: PromptAssemblyHistoryEntry[];
  linkedCodeSessionId?: string;
}

type ContinuityHistoryConversationService = Pick<
  ConversationService,
  'getHistoryForContext' | 'getSessionHistory'
>;

type ContinuityHistoryCodeSessionStore = Pick<CodeSessionStore, 'getSession'>;

function sameConversationKey(left: ConversationKey, right: ConversationKey): boolean {
  return left.agentId === right.agentId
    && left.userId === right.userId
    && left.channel === right.channel;
}

export function mergeHistoryWithContinuityTail(
  history: readonly PromptAssemblyHistoryEntry[],
  continuityHistory: readonly PromptAssemblyHistoryEntry[],
): PromptAssemblyHistoryEntry[] {
  if (continuityHistory.length === 0) {
    return [...history];
  }
  const merged = [...history];
  for (const entry of continuityHistory) {
    const existingIndex = merged.findIndex((candidate) => (
      candidate.role === entry.role && candidate.content === entry.content
    ));
    if (existingIndex >= 0) {
      merged.splice(existingIndex, 1);
    }
    merged.push({ role: entry.role, content: entry.content });
  }
  return merged;
}

export function resolveContinuityCodeSessionForHistory(input: {
  codeSessionStore?: ContinuityHistoryCodeSessionStore | null;
  continuityThread: ContinuityThreadRecord | null;
  currentUserId: string;
  currentPrincipalId?: string;
  resolvedCodeSession?: CodeSessionRecord | null;
}): CodeSessionRecord | null {
  if (input.resolvedCodeSession) {
    return input.resolvedCodeSession;
  }
  if (!input.codeSessionStore || !input.continuityThread?.activeExecutionRefs?.length) {
    return null;
  }

  const codeSessionId = [...input.continuityThread.activeExecutionRefs]
    .reverse()
    .find((ref) => ref.kind === 'code_session' && ref.id.trim())
    ?.id.trim();
  if (!codeSessionId) {
    return null;
  }

  const ownerCandidates = new Set<string>();
  const currentUserId = input.currentUserId.trim();
  const continuityUserId = input.continuityThread.scope.userId.trim();
  if (currentUserId) ownerCandidates.add(currentUserId);
  if (continuityUserId) ownerCandidates.add(continuityUserId);

  for (const ownerUserId of ownerCandidates) {
    const session = input.codeSessionStore.getSession(codeSessionId, ownerUserId);
    if (session) return session;
  }

  const session = input.codeSessionStore.getSession(codeSessionId);
  if (!session) return null;
  if (ownerCandidates.has(session.ownerUserId)) {
    return session;
  }
  const principalId = input.currentPrincipalId?.trim();
  if (principalId && session.ownerPrincipalId === principalId) {
    return session;
  }
  return null;
}

export function getContinuityCodeSessionHistory(input: {
  conversationService?: ContinuityHistoryConversationService | null;
  codeSessionStore?: ContinuityHistoryCodeSessionStore | null;
  continuityThread: ContinuityThreadRecord | null;
  currentConversationKey: ConversationKey;
  currentUserId: string;
  currentPrincipalId?: string;
  resolvedCodeSession?: CodeSessionRecord | null;
  limit?: number;
}): { history: PromptAssemblyHistoryEntry[]; codeSessionId?: string } {
  if (!input.conversationService) {
    return { history: [] };
  }
  const session = resolveContinuityCodeSessionForHistory({
    codeSessionStore: input.codeSessionStore,
    continuityThread: input.continuityThread,
    currentUserId: input.currentUserId,
    currentPrincipalId: input.currentPrincipalId,
    resolvedCodeSession: input.resolvedCodeSession,
  });
  if (!session) {
    return { history: [] };
  }
  const conversationUserId = typeof session.conversationUserId === 'string'
    ? session.conversationUserId.trim()
    : '';
  const conversationChannel = typeof session.conversationChannel === 'string'
    ? session.conversationChannel.trim()
    : '';
  if (!conversationUserId || !conversationChannel) {
    return { history: [] };
  }
  const key: ConversationKey = {
    agentId: input.currentConversationKey.agentId,
    userId: conversationUserId,
    channel: conversationChannel,
  };
  if (sameConversationKey(key, input.currentConversationKey)) {
    return { history: [] };
  }
  return {
    codeSessionId: session.id,
    history: input.conversationService
      .getSessionHistory(key, { limit: input.limit ?? 8 })
      .map((entry) => ({ role: entry.role, content: entry.content })),
  };
}

export function buildContinuityAwareHistory(input: {
  conversationService?: ContinuityHistoryConversationService | null;
  codeSessionStore?: ContinuityHistoryCodeSessionStore | null;
  continuityThread: ContinuityThreadRecord | null;
  currentConversationKey: ConversationKey;
  currentUserId: string;
  currentPrincipalId?: string;
  resolvedCodeSession?: CodeSessionRecord | null;
  query?: ConversationContextOptions['query'];
  linkedHistoryLimit?: number;
}): ContinuityAwareHistoryResult {
  const primaryHistory = input.conversationService?.getHistoryForContext(
    input.currentConversationKey,
    input.query !== undefined ? { query: input.query } : undefined,
  ) ?? [];
  const linked = getContinuityCodeSessionHistory({
    conversationService: input.conversationService,
    codeSessionStore: input.codeSessionStore,
    continuityThread: input.continuityThread,
    currentConversationKey: input.currentConversationKey,
    currentUserId: input.currentUserId,
    currentPrincipalId: input.currentPrincipalId,
    resolvedCodeSession: input.resolvedCodeSession,
    limit: input.linkedHistoryLimit,
  });
  return {
    history: mergeHistoryWithContinuityTail(primaryHistory, linked.history),
    ...(linked.codeSessionId ? { linkedCodeSessionId: linked.codeSessionId } : {}),
  };
}
