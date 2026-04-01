import type { ChatMessage } from '../llm/types.js';

export interface ContextCompactionResult {
  applied: boolean;
  beforeChars: number;
  afterChars: number;
  capacityChars: number;
  stages: Array<'truncate_tool_calls' | 'truncate_tool_results' | 'aggressive_trim'>;
  summary?: string;
}

function truncateText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(0, maxChars - 16))}[...truncated]`;
}

function totalChars(messages: ChatMessage[]): number {
  return messages.reduce((sum, m) => {
    const toolCallChars = Array.isArray(m.toolCalls)
      ? m.toolCalls.reduce((inner, toolCall) => inner + (toolCall.arguments?.length ?? 0), 0)
      : 0;
    return sum + (m.content?.length ?? 0) + toolCallChars;
  }, 0);
}

function compactHistoricalToolMessages(messages: ChatMessage[], protectedStart: number, maxChars: number): number {
  let compacted = 0;
  for (let i = 0; i < protectedStart; i++) {
    const msg = messages[i];
    if (msg.role !== 'tool' || !msg.content || msg.content.length <= maxChars) continue;
    try {
      const parsed = JSON.parse(msg.content) as Record<string, unknown>;
      msg.content = JSON.stringify({
        success: parsed.success,
        status: parsed.status,
        summary: truncateText(String(parsed.message ?? parsed.output ?? ''), Math.max(80, maxChars - 50)),
        compacted: true,
      });
    } catch {
      msg.content = truncateText(msg.content, maxChars);
    }
    compacted += 1;
  }
  return compacted;
}

function compactHistoricalAssistantToolCalls(messages: ChatMessage[], protectedStart: number, maxArgChars: number): number {
  let compacted = 0;
  for (let i = 0; i < protectedStart; i++) {
    const msg = messages[i];
    if (msg.role !== 'assistant' || !Array.isArray(msg.toolCalls) || msg.toolCalls.length === 0) continue;
    let touched = false;
    msg.toolCalls = msg.toolCalls.map((toolCall) => ({
      ...toolCall,
      arguments: (() => {
        const original = toolCall.arguments ?? '';
        const next = truncateText(original, maxArgChars);
        if (next !== original) touched = true;
        return next;
      })(),
    }));
    if (msg.content) {
      const nextContent = truncateText(msg.content, 400);
      if (nextContent !== msg.content) touched = true;
      msg.content = nextContent;
    }
    if (touched) compacted += 1;
  }
  return compacted;
}

function aggressivelyTrimHistoricalMessages(messages: ChatMessage[], keepCount: number): string | undefined {
  const systemMessages = messages.filter((message) => message.role === 'system');
  const tail = messages.slice(-keepCount);
  const historical = messages.slice(0, Math.max(0, messages.length - keepCount));
  const preservedHistorical = historical.filter((message) => message.role === 'user').slice(-2);

  const summaryParts: string[] = [];
  for (const message of historical) {
    if (message.role === 'tool' && message.content) {
      summaryParts.push(`tool:${truncateText(message.content, 120)}`);
    } else if (message.role === 'assistant' && message.content) {
      summaryParts.push(`assistant:${truncateText(message.content, 120)}`);
    }
    if (summaryParts.length >= 4) break;
  }

  const summaryMessage: ChatMessage | null = summaryParts.length > 0
    ? {
      role: 'system',
      content: `Compacted prior work summary:\n${summaryParts.join('\n')}`,
    }
    : null;

  messages.splice(0, messages.length, ...systemMessages);
  if (summaryMessage) messages.push(summaryMessage);
  messages.push(...preservedHistorical);
  messages.push(...tail.filter((message, index, array) => {
    const firstIndex = array.findIndex((candidate) => candidate === message);
    return firstIndex === index;
  }));
  return summaryMessage?.content;
}

/**
 * Compact message history using a staged strategy as the conversation approaches
 * the token budget (approximated as budget * 4 chars per token).
 */
export function compactMessagesIfOverBudget(messages: ChatMessage[], budget: number): ContextCompactionResult {
  const capacity = budget * 4;
  const currentTotal = totalChars(messages);
  const result: ContextCompactionResult = {
    applied: false,
    beforeChars: currentTotal,
    afterChars: currentTotal,
    capacityChars: capacity,
    stages: [],
  };
  if (currentTotal <= capacity * 0.7) return result;

  const protectedCount = 6;
  const protectedStart = Math.max(0, messages.length - protectedCount);

  if (currentTotal > capacity * 0.8) {
    const compactedToolCalls = compactHistoricalAssistantToolCalls(messages, protectedStart, 400);
    const compactedToolMessages = compactHistoricalToolMessages(messages, protectedStart, 260);
    if (compactedToolCalls > 0) result.stages.push('truncate_tool_calls');
    if (compactedToolMessages > 0 && !result.stages.includes('truncate_tool_results')) {
      result.stages.push('truncate_tool_results');
    }
  }

  if (totalChars(messages) > capacity * 0.85) {
    const compactedToolMessages = compactHistoricalToolMessages(messages, protectedStart, 180);
    const compactedToolCalls = compactHistoricalAssistantToolCalls(messages, protectedStart, 180);
    if (compactedToolMessages > 0 && !result.stages.includes('truncate_tool_results')) {
      result.stages.push('truncate_tool_results');
    }
    if (compactedToolCalls > 0 && !result.stages.includes('truncate_tool_calls')) {
      result.stages.push('truncate_tool_calls');
    }
  }

  if (totalChars(messages) > capacity * 0.95) {
    const summary = aggressivelyTrimHistoricalMessages(messages, 5);
    result.stages.push('aggressive_trim');
    if (summary) result.summary = summary;
  }

  result.afterChars = totalChars(messages);
  result.applied = result.afterChars < result.beforeChars;
  if (!result.applied) {
    result.stages = [];
    delete result.summary;
  }
  return result;
}
