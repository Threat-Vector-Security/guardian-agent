import { describe, expect, it, vi } from 'vitest';
import type { AgentContext, UserMessage } from './agent/types.js';
import { createChatAgentClass } from './chat-agent.js';
import { ContinuityThreadStore } from './runtime/continuity-threads.js';

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

  it('reuses persisted paged-list continuation state for follow-up automation catalog requests', async () => {
    const ChatAgent = createChatAgentClass({
      log: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as never,
    });
    const continuityThreadStore = new ContinuityThreadStore({
      enabled: false,
      sqlitePath: '/tmp/guardianagent-chat-agent-continuity.test.sqlite',
      retentionDays: 30,
      now: () => 1_710_000_000_000,
    });
    const automations = Array.from({ length: 45 }, (_, index) => {
      const ordinal = index + 1;
      return {
        id: `automation-${ordinal}`,
        name: `Automation ${ordinal}`,
        kind: 'assistant_task',
        enabled: true,
        task: {
          id: `automation-${ordinal}`,
          name: `Automation ${ordinal}`,
          type: 'agent',
          target: 'default',
          cron: `${ordinal % 60} 8 * * 1-5`,
          enabled: true,
          createdAt: ordinal,
        },
      };
    });
    const tools = {
      isEnabled: vi.fn(() => true),
      executeModelTool: vi.fn(async (toolName: string) => {
        if (toolName === 'automation_list') {
          return {
            success: true,
            output: { automations },
          };
        }
        throw new Error(`Unexpected tool ${toolName}`);
      }),
      getApprovalSummaries: vi.fn(() => new Map()),
    };
    const agent = new ChatAgent('chat', 'Chat', undefined, undefined, tools as never);
    (agent as any).continuityThreadStore = continuityThreadStore;
    const ctx: AgentContext = {
      agentId: 'chat',
      emit: vi.fn(async () => {}),
      llm: { name: 'ollama' } as never,
      checkAction: vi.fn(),
      capabilities: [],
    };
    const firstMessage: UserMessage = {
      id: 'msg-1',
      userId: 'code-session:session-1',
      channel: 'web',
      content: 'List my automations.',
      timestamp: Date.now(),
    };
    const secondMessage: UserMessage = {
      id: 'msg-2',
      userId: 'code-session:session-1',
      channel: 'web',
      content: 'Can you list the additional 25 automations?',
      timestamp: Date.now(),
    };

    const firstResponse = await (agent as any).tryDirectAutomationControl(
      firstMessage,
      ctx,
      'owner:web',
      {
        route: 'automation_control',
        confidence: 'high',
        operation: 'read',
        turnRelation: 'new_request',
        resolution: 'ready',
        summary: 'List the automation catalog.',
        missingFields: [],
        entities: {},
      },
      continuityThreadStore.get({ assistantId: 'chat', userId: 'owner' }),
    );
    expect(firstResponse?.content).toContain('Automation catalog (45): showing 1-20');
    expect(firstResponse?.metadata?.continuationState).toEqual({
      kind: 'automation_catalog_list',
      payload: { offset: 0, limit: 20, total: 45 },
    });

    const secondResponse = await (agent as any).tryDirectAutomationControl(
      secondMessage,
      ctx,
      'owner:web',
      {
        route: 'automation_control',
        confidence: 'high',
        operation: 'read',
        turnRelation: 'follow_up',
        resolution: 'ready',
        summary: 'List more automations.',
        missingFields: [],
        entities: {},
      },
      {
        continuityKey: 'chat:owner',
        scope: { assistantId: 'chat', userId: 'owner' },
        linkedSurfaces: [],
        continuationState: {
          kind: 'automation_catalog_list',
          payload: { offset: 0, limit: 20, total: 45 },
        },
        createdAt: 1,
        updatedAt: 1,
        expiresAt: 2,
      },
    );

    expect(secondResponse?.content).toContain('Automation catalog (45): showing 21-45');
    expect(secondResponse?.content).toContain('Automation 25');
    expect(secondResponse?.content).toContain('Automation 1');
    expect(secondResponse?.content).not.toContain('Automation 45');
    expect(secondResponse?.metadata?.continuationState).toEqual({
      kind: 'automation_catalog_list',
      payload: { offset: 20, limit: 25, total: 45 },
    });
  });

  it('persists shared direct continuation state on the surface scope instead of the code-session scope', async () => {
    const ChatAgent = createChatAgentClass({
      log: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as never,
    });
    const agent = new ChatAgent('chat', 'Chat');
    const updateDirectContinuationState = vi
      .spyOn(agent as any, 'updateDirectContinuationState')
      .mockReturnValue(null);
    const ctx: AgentContext = {
      agentId: 'chat',
      emit: vi.fn(async () => {}),
      llm: { name: 'ollama' } as never,
      checkAction: vi.fn(),
      capabilities: [],
    };
    const message: UserMessage = {
      id: 'msg-1',
      userId: 'code-session:session-1',
      channel: 'code-session',
      surfaceId: 'web-guardian-chat',
      content: 'List my automations.',
      timestamp: Date.now(),
    };

    const response = await (agent as any).buildDirectIntentResponse({
      candidate: 'automation_control',
      result: {
        content: 'Automation catalog (45): showing 1-20',
        metadata: {
          continuationState: {
            kind: 'automation_catalog_list',
            payload: { offset: 0, limit: 20, total: 45 },
          },
        },
      },
      message,
      routingMessage: message,
      intentGateway: {
        available: true,
        decision: {
          route: 'automation_control',
          operation: 'read',
          summary: 'List the automation catalog.',
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
      surfaceUserId: 'owner',
      surfaceChannel: 'web',
      surfaceId: 'web-guardian-chat',
    });

    expect(response.metadata?.continuationState).toBeUndefined();
    expect(updateDirectContinuationState).toHaveBeenCalledWith(
      'owner',
      'web',
      'web-guardian-chat',
      {
        kind: 'automation_catalog_list',
        payload: { offset: 0, limit: 20, total: 45 },
      },
    );
    expect(updateDirectContinuationState).not.toHaveBeenCalledWith(
      'code-session:session-1',
      'code-session',
      'web-guardian-chat',
      {
        kind: 'automation_catalog_list',
        payload: { offset: 0, limit: 20, total: 45 },
      },
    );
  });

  it('continues Gmail unread lists from the prior window on follow-up requests', async () => {
    const ChatAgent = createChatAgentClass({
      log: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as never,
    });
    const tools = {
      isEnabled: vi.fn(() => true),
      executeModelTool: vi.fn(async (_toolName: string, args: Record<string, unknown>) => {
        if (args.method === 'list') {
          return {
            success: true,
            output: {
              messages: Array.from({ length: 5 }, (_, index) => ({ id: `gmail-${index + 1}` })),
              resultSizeEstimate: 5,
            },
          };
        }
        if (args.method === 'get') {
          const params = args.params as Record<string, unknown>;
          const id = String(params.messageId ?? params.id);
          const ordinal = Number(id.split('-').pop() ?? '0');
          return {
            success: true,
            output: {
              payload: {
                headers: [
                  { name: 'From', value: `Sender ${ordinal} <sender${ordinal}@example.com>` },
                  { name: 'Subject', value: `Subject ${ordinal}` },
                  { name: 'Date', value: `2026-04-0${ordinal}T08:00:00Z` },
                ],
              },
            },
          };
        }
        throw new Error(`Unexpected tool args ${JSON.stringify(args)}`);
      }),
    };
    const agent = new ChatAgent('chat', 'Chat', undefined, undefined, tools as never);
    const ctx: AgentContext = {
      agentId: 'chat',
      emit: vi.fn(async () => {}),
      llm: { name: 'ollama' } as never,
      checkAction: vi.fn(),
      capabilities: [],
    };

    const response = await (agent as any).tryDirectGoogleWorkspaceRead(
      {
        id: 'msg-gmail',
        userId: 'owner',
        channel: 'web',
        content: 'Show me the additional 2 emails.',
        timestamp: Date.now(),
      },
      ctx,
      'owner:web',
      {
        route: 'email_task',
        confidence: 'high',
        operation: 'read',
        turnRelation: 'follow_up',
        resolution: 'ready',
        summary: 'Show more unread Gmail messages.',
        missingFields: [],
        entities: { emailProvider: 'gmail' },
      },
      {
        continuityKey: 'chat:owner',
        scope: { assistantId: 'chat', userId: 'owner' },
        linkedSurfaces: [],
        continuationState: {
          kind: 'gmail_unread_list',
          payload: { offset: 0, limit: 3, total: 5 },
        },
        createdAt: 1,
        updatedAt: 1,
        expiresAt: 2,
      },
    );

    const content = typeof response === 'string' ? response : response?.content ?? '';
    expect(content).toContain('Subject 4');
    expect(content).toContain('Subject 5');
    expect(content).not.toContain('Subject 1');
    expect(content).not.toContain('Subject 2');
    expect(content).not.toContain('Subject 3');
    expect(tools.executeModelTool).toHaveBeenCalledWith(
      'gws',
      expect.objectContaining({
        method: 'list',
        params: expect.objectContaining({ maxResults: 5 }),
      }),
      expect.anything(),
    );
  });

  it('returns no additional Gmail messages when a natural follow-up exceeds the prior window', async () => {
    const ChatAgent = createChatAgentClass({
      log: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as never,
    });
    const tools = {
      isEnabled: vi.fn(() => true),
      executeModelTool: vi.fn(async (_toolName: string, args: Record<string, unknown>) => {
        if (args.method === 'list') {
          return {
            success: true,
            output: {
              messages: [{ id: 'gmail-1' }],
              resultSizeEstimate: 1,
            },
          };
        }
        if (args.method === 'get') {
          return {
            success: true,
            output: {
              payload: {
                headers: [
                  { name: 'From', value: 'Sender 1 <sender1@example.com>' },
                  { name: 'Subject', value: 'Subject 1' },
                ],
              },
            },
          };
        }
        throw new Error(`Unexpected tool args ${JSON.stringify(args)}`);
      }),
    };
    const agent = new ChatAgent('chat', 'Chat', undefined, undefined, tools as never);
    const ctx: AgentContext = {
      agentId: 'chat',
      emit: vi.fn(async () => {}),
      llm: { name: 'ollama' } as never,
      checkAction: vi.fn(),
      capabilities: [],
    };

    const response = await (agent as any).tryDirectGoogleWorkspaceRead(
      {
        id: 'msg-gmail-2',
        userId: 'owner',
        channel: 'web',
        content: 'Show me 2 more emails.',
        timestamp: Date.now(),
      },
      ctx,
      'owner:web',
      {
        route: 'email_task',
        confidence: 'high',
        operation: 'read',
        turnRelation: 'new_request',
        resolution: 'ready',
        summary: 'Show more unread Gmail messages.',
        missingFields: [],
        entities: { emailProvider: 'gmail' },
      },
      {
        continuityKey: 'chat:owner',
        scope: { assistantId: 'chat', userId: 'owner' },
        linkedSurfaces: [],
        continuationState: {
          kind: 'gmail_unread_list',
          payload: { offset: 0, limit: 1, total: 1 },
        },
        createdAt: 1,
        updatedAt: 1,
        expiresAt: 2,
      },
    );

    expect(response).toBe('No additional Gmail messages remain.');
    expect(tools.executeModelTool).toHaveBeenCalledWith(
      'gws',
      expect.objectContaining({
        method: 'list',
        params: expect.objectContaining({ maxResults: 2 }),
      }),
      expect.anything(),
    );
  });

  it('uses the gateway mailbox read mode to list the latest Gmail inbox messages', async () => {
    const ChatAgent = createChatAgentClass({
      log: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as never,
    });
    const tools = {
      isEnabled: vi.fn(() => true),
      executeModelTool: vi.fn(async (_toolName: string, args: Record<string, unknown>) => {
        if (args.method === 'list') {
          return {
            success: true,
            output: {
              messages: Array.from({ length: 5 }, (_, index) => ({ id: `gmail-latest-${index + 1}` })),
              resultSizeEstimate: 5,
            },
          };
        }
        if (args.method === 'get') {
          const params = args.params as Record<string, unknown>;
          const id = String(params.messageId ?? params.id);
          const ordinal = Number(id.split('-').pop() ?? '0');
          return {
            success: true,
            output: {
              payload: {
                headers: [
                  { name: 'From', value: `Sender ${ordinal} <sender${ordinal}@example.com>` },
                  { name: 'Subject', value: `Latest Subject ${ordinal}` },
                  { name: 'Date', value: `2026-04-0${ordinal}T08:00:00Z` },
                ],
              },
            },
          };
        }
        throw new Error(`Unexpected tool args ${JSON.stringify(args)}`);
      }),
    };
    const agent = new ChatAgent('chat', 'Chat', undefined, undefined, tools as never);
    const ctx: AgentContext = {
      agentId: 'chat',
      emit: vi.fn(async () => {}),
      llm: { name: 'ollama' } as never,
      checkAction: vi.fn(),
      capabilities: [],
    };

    const response = await (agent as any).tryDirectGoogleWorkspaceRead(
      {
        id: 'msg-gmail-latest',
        userId: 'owner',
        channel: 'web',
        content: 'Can you show me the newest five emails in Gmail?',
        timestamp: Date.now(),
      },
      ctx,
      'owner:web',
      {
        route: 'email_task',
        confidence: 'high',
        operation: 'read',
        turnRelation: 'new_request',
        resolution: 'ready',
        summary: 'Shows the latest Gmail inbox messages.',
        missingFields: [],
        executionClass: 'provider_crud',
        preferredTier: 'external',
        requiresRepoGrounding: false,
        requiresToolSynthesis: true,
        expectedContextPressure: 'medium',
        preferredAnswerPath: 'tool_loop',
        entities: { emailProvider: 'gws', mailboxReadMode: 'latest' },
      },
      null,
    );

    const content = typeof response === 'string' ? response : response?.content ?? '';
    expect(content).toContain('Here are the last 5 emails:');
    expect(content).toContain('Latest Subject 1');
    expect(content).toContain('Latest Subject 5');
    expect(tools.executeModelTool).toHaveBeenCalledWith(
      'gws',
      expect.objectContaining({
        method: 'list',
        params: expect.not.objectContaining({ q: 'is:unread' }),
      }),
      expect.anything(),
    );
    expect(tools.executeModelTool).toHaveBeenCalledWith(
      'gws',
      expect.objectContaining({
        method: 'get',
        params: expect.objectContaining({ messageId: 'gmail-latest-1' }),
      }),
      expect.anything(),
    );
  });

  it('formats direct Second Brain library reads as library items instead of falling back to overview', async () => {
    const ChatAgent = createChatAgentClass({
      log: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as never,
    });
    const agent = new ChatAgent('chat', 'Chat');
    (agent as any).secondBrainService = {
      listLinks: vi.fn(() => [{
        id: 'link-1',
        title: 'Example Reference',
        kind: 'reference',
        url: 'https://example.com/',
        summary: 'Library smoke test URL',
      }]),
    };

    const result = await (agent as any).tryDirectSecondBrainRead(
      {
        id: 'msg-library',
        userId: 'owner',
        channel: 'web',
        content: 'Show my library items.',
        timestamp: Date.now(),
      },
      {
        route: 'personal_assistant_task',
        operation: 'read',
        confidence: 'high',
        summary: 'Reads Second Brain library items.',
        turnRelation: 'new_request',
        resolution: 'ready',
        missingFields: [],
        entities: { personalItemType: 'library' },
      },
    );

    const content = typeof result === 'string' ? result : result?.content ?? '';
    expect(content).toContain('Library items:');
    expect(content).toContain('Example Reference [reference] - https://example.com/');
    expect(content).not.toContain('Second Brain overview:');
  });

  it('honors a gateway-provided calendar day window for direct Second Brain calendar reads', async () => {
    const ChatAgent = createChatAgentClass({
      log: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as never,
    });
    const agent = new ChatAgent('chat', 'Chat');
    const listEvents = vi.fn(() => [{
      id: 'event-1',
      title: 'Team Check-in',
      startsAt: Date.UTC(2026, 3, 10, 9, 30, 0),
      endsAt: null,
      location: 'Brisbane office',
      description: 'Team check-in at the Brisbane office.',
      source: 'local',
      createdAt: Date.UTC(2026, 3, 7, 0, 0, 0),
      updatedAt: Date.UTC(2026, 3, 7, 0, 0, 0),
    }]);
    (agent as any).secondBrainService = { listEvents };
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 3, 7, 8, 0, 0));

    try {
      const result = await (agent as any).tryDirectSecondBrainRead(
        {
          id: 'msg-calendar',
          userId: 'owner',
          channel: 'web',
          content: 'Show my calendar events for the next 7 days.',
          timestamp: Date.now(),
        },
        {
          route: 'personal_assistant_task',
          operation: 'read',
          confidence: 'high',
          summary: 'Reads calendar events for the next seven days.',
          turnRelation: 'new_request',
          resolution: 'ready',
          missingFields: [],
          entities: { personalItemType: 'calendar', calendarWindowDays: 7 },
        },
      );

      const content = typeof result === 'string' ? result : result?.content ?? '';
      expect(content).toContain('Calendar events for the next 7 days:');
      expect(listEvents).toHaveBeenCalledWith(expect.objectContaining({
        includePast: false,
        fromTime: Date.UTC(2026, 3, 7, 8, 0, 0),
        toTime: Date.UTC(2026, 3, 14, 8, 0, 0),
      }));
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('updates the focused Second Brain note directly instead of falling through to briefs', async () => {
    const ChatAgent = createChatAgentClass({
      log: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as never,
    });
    const tools = {
      isEnabled: vi.fn(() => true),
      executeModelTool: vi.fn(async (toolName: string, args: Record<string, unknown>) => {
        expect(toolName).toBe('second_brain_note_upsert');
        expect(args).toMatchObject({
          id: 'note-2',
          title: 'Smoke Test Note',
          content: 'Second Brain write smoke test note updated.',
        });
        return {
          success: true,
          output: {
            id: 'note-2',
            title: 'Smoke Test Note',
          },
        };
      }),
    };
    const agent = new ChatAgent('chat', 'Chat', undefined, undefined, tools as never);
    const ctx: AgentContext = {
      agentId: 'chat',
      emit: vi.fn(async () => {}),
      llm: { name: 'ollama' } as never,
      checkAction: vi.fn(),
      capabilities: [],
    };

    const result = await (agent as any).tryDirectSecondBrainWrite(
      {
        id: 'msg-note-update',
        userId: 'owner',
        channel: 'web',
        content: 'Update that note to say: "Second Brain write smoke test note updated."',
        timestamp: Date.now(),
      },
      ctx,
      'owner:web',
      {
        route: 'personal_assistant_task',
        operation: 'update',
        confidence: 'high',
        summary: 'Updates a local note.',
        turnRelation: 'follow_up',
        resolution: 'ready',
        missingFields: [],
        entities: { personalItemType: 'note' },
      },
      {
        continuityKey: 'chat:owner',
        scope: { assistantId: 'chat', userId: 'owner' },
        linkedSurfaces: [],
        continuationState: {
          kind: 'second_brain_focus',
          payload: {
            itemType: 'note',
            focusId: 'note-2',
            items: [
              { id: 'note-1', label: 'Test' },
              { id: 'note-2', label: 'Smoke Test Note' },
            ],
          },
        },
        createdAt: 1,
        updatedAt: 1,
        expiresAt: 2,
      },
    );

    expect(typeof result).toBe('object');
    expect((result as { content: string }).content).toBe('Note updated: Smoke Test Note');
    expect((result as { metadata?: Record<string, unknown> }).metadata?.continuationState).toEqual({
      kind: 'second_brain_focus',
      payload: {
        itemType: 'note',
        focusId: 'note-2',
        items: [{ id: 'note-2', label: 'Smoke Test Note' }],
      },
    });
  });

  it('preserves the focused Second Brain note across note list reads', async () => {
    const ChatAgent = createChatAgentClass({
      log: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as never,
    });
    const agent = new ChatAgent('chat', 'Chat');
    (agent as any).secondBrainService = {
      listNotes: vi.fn(() => [
        {
          id: 'note-1',
          title: 'Test',
          content: 'Testicles',
        },
        {
          id: 'note-2',
          title: 'Smoke Test Note',
          content: 'Second Brain write smoke test note.',
        },
      ]),
    };

    const result = await (agent as any).tryDirectSecondBrainRead(
      {
        id: 'msg-notes',
        userId: 'owner',
        channel: 'web',
        content: 'Show my notes.',
        timestamp: Date.now(),
      },
      {
        route: 'personal_assistant_task',
        operation: 'read',
        confidence: 'high',
        summary: 'Reads recent notes.',
        turnRelation: 'new_request',
        resolution: 'ready',
        missingFields: [],
        entities: { personalItemType: 'note' },
      },
      {
        continuityKey: 'chat:owner',
        scope: { assistantId: 'chat', userId: 'owner' },
        linkedSurfaces: [],
        continuationState: {
          kind: 'second_brain_focus',
          payload: {
            itemType: 'note',
            focusId: 'note-2',
            items: [{ id: 'note-2', label: 'Smoke Test Note' }],
          },
        },
        createdAt: 1,
        updatedAt: 1,
        expiresAt: 2,
      },
    );

    expect(typeof result).toBe('object');
    expect((result as { content: string }).content).toContain('Recent notes:');
    expect((result as { metadata?: Record<string, unknown> }).metadata?.continuationState).toEqual({
      kind: 'second_brain_focus',
      payload: {
        itemType: 'note',
        focusId: 'note-2',
        items: [
          { id: 'note-1', label: 'Test' },
          { id: 'note-2', label: 'Smoke Test Note' },
        ],
      },
    });
  });

  it('marks the focused Second Brain task done directly', async () => {
    const ChatAgent = createChatAgentClass({
      log: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as never,
    });
    const tools = {
      isEnabled: vi.fn(() => true),
      executeModelTool: vi.fn(async (_toolName: string, args: Record<string, unknown>) => {
        expect(args).toMatchObject({
          id: 'task-1',
          title: 'Second Brain task smoke test',
          status: 'done',
        });
        return {
          success: true,
          output: {
            id: 'task-1',
            title: 'Second Brain task smoke test',
          },
        };
      }),
    };
    const agent = new ChatAgent('chat', 'Chat', undefined, undefined, tools as never);
    (agent as any).secondBrainService = {
      getTaskById: vi.fn(() => ({
        id: 'task-1',
        title: 'Second Brain task smoke test',
        details: undefined,
        priority: 'medium',
        dueAt: Date.UTC(2026, 3, 8, 15, 0, 0),
        status: 'todo',
      })),
    };
    const ctx: AgentContext = {
      agentId: 'chat',
      emit: vi.fn(async () => {}),
      llm: { name: 'ollama' } as never,
      checkAction: vi.fn(),
      capabilities: [],
    };

    const result = await (agent as any).tryDirectSecondBrainWrite(
      {
        id: 'msg-task-done',
        userId: 'owner',
        channel: 'web',
        content: 'Mark that task as done.',
        timestamp: Date.now(),
      },
      ctx,
      'owner:web',
      {
        route: 'personal_assistant_task',
        operation: 'update',
        confidence: 'high',
        summary: 'Completes a local task.',
        turnRelation: 'follow_up',
        resolution: 'ready',
        missingFields: [],
        entities: { personalItemType: 'task' },
      },
      {
        continuityKey: 'chat:owner',
        scope: { assistantId: 'chat', userId: 'owner' },
        linkedSurfaces: [],
        continuationState: {
          kind: 'second_brain_focus',
          payload: {
            itemType: 'task',
            focusId: 'task-1',
            items: [{ id: 'task-1', label: 'Second Brain task smoke test' }],
          },
        },
        createdAt: 1,
        updatedAt: 1,
        expiresAt: 2,
      },
    );

    expect((result as { content: string }).content).toBe('Task completed: Second Brain task smoke test');
  });

  it('moves the focused local calendar event directly', async () => {
    const ChatAgent = createChatAgentClass({
      log: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as never,
    });
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 3, 7, 8, 0, 0));
    const tools = {
      isEnabled: vi.fn(() => true),
      executeModelTool: vi.fn(async (_toolName: string, args: Record<string, unknown>) => {
        expect(args.id).toBe('event-1');
        expect(args.title).toBe('Second Brain calendar smoke test');
        expect(args.startsAt).toBe(Date.UTC(2026, 3, 8, 7, 0, 0));
        return {
          success: true,
          output: {
            id: 'event-1',
            title: 'Second Brain calendar smoke test',
          },
        };
      }),
    };
    const agent = new ChatAgent('chat', 'Chat', undefined, undefined, tools as never);
    (agent as any).secondBrainService = {
      getEventById: vi.fn(() => ({
        id: 'event-1',
        title: 'Second Brain calendar smoke test',
        startsAt: Date.UTC(2026, 3, 8, 16, 0, 0),
        endsAt: Date.UTC(2026, 3, 8, 17, 0, 0),
        source: 'local',
        createdAt: Date.UTC(2026, 3, 7, 8, 0, 0),
        updatedAt: Date.UTC(2026, 3, 7, 8, 0, 0),
      })),
    };
    const ctx: AgentContext = {
      agentId: 'chat',
      emit: vi.fn(async () => {}),
      llm: { name: 'ollama' } as never,
      checkAction: vi.fn(),
      capabilities: [],
    };

    try {
      const result = await (agent as any).tryDirectSecondBrainWrite(
        {
          id: 'msg-event-move',
          userId: 'owner',
          channel: 'web',
          content: 'Move that event to tomorrow at 5:00 PM.',
          timestamp: Date.now(),
        },
        ctx,
        'owner:web',
        {
          route: 'personal_assistant_task',
          operation: 'update',
          confidence: 'high',
          summary: 'Moves a local event.',
          turnRelation: 'follow_up',
          resolution: 'ready',
          missingFields: [],
          entities: { personalItemType: 'calendar', calendarTarget: 'local' },
        },
        {
          continuityKey: 'chat:owner',
          scope: { assistantId: 'chat', userId: 'owner' },
          linkedSurfaces: [],
          continuationState: {
            kind: 'second_brain_focus',
            payload: {
              itemType: 'calendar',
              focusId: 'event-1',
              items: [{ id: 'event-1', label: 'Second Brain calendar smoke test' }],
            },
          },
          createdAt: 1,
          updatedAt: 1,
          expiresAt: 2,
        },
      );

      expect((result as { content: string }).content).toBe('Calendar event updated: Second Brain calendar smoke test');
    } finally {
      nowSpy.mockRestore();
    }
  });
});
