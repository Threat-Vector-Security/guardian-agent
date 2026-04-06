import { describe, expect, it, vi } from 'vitest';
import type { AgentContext, UserMessage } from './agent/types.js';
import { createChatAgentClass } from './chat-agent.js';

describe('LLMChatAgent direct intent metadata', () => {
  it('backfills responseSource for direct intent responses so the UI does not show them as system output', async () => {
    const ChatAgent = createChatAgentClass({
      log: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as never,
    });
    const agent = new ChatAgent('chat', 'Chat');
    const message: UserMessage = {
      id: 'msg-1',
      userId: 'owner',
      channel: 'web',
      content: 'Search the repo for "ollama_cloud" and tell me which files define its routing.',
      timestamp: Date.now(),
    };
    const ctx: AgentContext = {
      agentId: 'chat',
      emit: vi.fn(async () => {}),
      llm: { name: 'ollama_cloud' } as never,
      checkAction: vi.fn(),
      capabilities: [],
    };

    const response = await (agent as any).buildDirectIntentResponse({
      candidate: 'filesystem',
      result: 'I searched "S:\\Development\\GuardianAgent" for "ollama_cloud".',
      message,
      routingMessage: message,
      intentGateway: {
        available: true,
        decision: {
          route: 'coding_task',
          operation: 'search',
          summary: 'Search the repo.',
          confidence: 'high',
          turnRelation: 'new_request',
          resolution: 'ready',
          missingFields: [],
          entities: {},
        },
      },
      ctx,
      activeSkills: [],
      conversationKey: { userId: 'owner', channel: 'web' },
    });

    expect(response.metadata?.responseSource).toMatchObject({
      locality: 'external',
      providerName: 'ollama_cloud',
      providerTier: 'managed_cloud',
      usedFallback: false,
    });
  });
});
