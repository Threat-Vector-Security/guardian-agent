import { describe, expect, it, vi } from 'vitest';
import type { ChatResponse } from '../llm/types.js';
import { BrokeredWorkerSession } from './worker-session.js';

const baseParams = {
  systemPrompt: 'system',
  history: [],
  knowledgeBases: [],
  activeSkills: [],
  toolContext: '',
  runtimeNotices: [],
};

describe('BrokeredWorkerSession automation control', () => {
  it('refreshes loaded tools for code-session turns so coding helpers are visible to the worker', async () => {
    let loadedTools = [
      {
        name: 'fs_list',
        description: 'List files.',
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'code_plan',
        description: 'Generate a coding plan.',
        parameters: { type: 'object', properties: { task: { type: 'string' } } },
      },
    ];
    const listLoadedTools = vi.fn(async () => loadedTools);
    const llmChat = vi.fn(async (_messages, options) => {
      const firstTool = options?.tools?.[0]?.name;
      if (firstTool === 'route_intent') {
        return {
          content: JSON.stringify({
            route: 'none',
            confidence: 'low',
            summary: 'Stay in the normal coding assistant path.',
          }),
          model: 'test-model',
          finishReason: 'stop',
        } satisfies ChatResponse;
      }
      return {
        content: 'Acceptance Gates\n- Keep the change bounded.\n\nExisting Checks To Reuse\n- Run the existing coding harness.',
        model: 'test-model',
        finishReason: 'stop',
        toolCalls: [],
        providerLocality: 'external',
        providerName: 'anthropic',
      } as ChatResponse;
    });

    const session = new BrokeredWorkerSession({
      getAlwaysLoadedTools: () => loadedTools,
      listLoadedTools,
      llmChat,
      callTool: vi.fn(),
      listJobs: vi.fn(async () => []),
      decideApproval: vi.fn(),
      getApprovalResult: vi.fn(),
    } as never);

    await session.handleMessage({
      ...baseParams,
      message: {
        id: 'msg-code-1',
        userId: 'owner',
        principalId: 'owner',
        principalRole: 'owner',
        channel: 'web',
        content: 'Write an implementation plan before editing anything.',
        timestamp: Date.now(),
        metadata: {
          codeContext: {
            workspaceRoot: '/repo',
            sessionId: 'code-1',
          },
        },
      },
    });

    expect(listLoadedTools).toHaveBeenCalledWith({
      codeContext: {
        workspaceRoot: '/repo',
        sessionId: 'code-1',
      },
    });
    expect(llmChat).toHaveBeenCalled();
    const codingCall = llmChat.mock.calls.find((call) => Array.isArray(call[1]?.tools) && call[1]?.tools.some((tool: { name: string }) => tool.name === 'code_plan'));
    const seenTools = codingCall?.[1]?.tools?.map((tool: { name: string }) => tool.name) ?? [];
    expect(seenTools).toContain('code_plan');
  });

  it('suppresses approval-looking text when no real approval metadata exists', async () => {
    const llmChat = vi.fn(async (_messages, options) => {
      const firstTool = options?.tools?.[0]?.name;
      if (firstTool === 'route_intent') {
        return {
          content: JSON.stringify({
            route: 'none',
            confidence: 'low',
            summary: 'Stay in the normal assistant path.',
          }),
          model: 'test-model',
          finishReason: 'stop',
        } satisfies ChatResponse;
      }
      return {
        content: [
          'Great news — Claude Code is now enabled!',
          '',
          'Now let me run the connection test with Claude Code:',
          '',
          'Waiting for approval to run coding_backend_run - {"task":"Say hello and confirm you are working.","backend":"claude-code"}.',
        ].join('\n'),
        model: 'test-model',
        finishReason: 'stop',
        toolCalls: [],
        providerLocality: 'external',
        providerName: 'anthropic',
      } as ChatResponse;
    });

    const session = new BrokeredWorkerSession({
      getAlwaysLoadedTools: () => [],
      llmChat,
      callTool: vi.fn(),
      listJobs: vi.fn(async () => []),
      decideApproval: vi.fn(),
      getApprovalResult: vi.fn(),
    } as never);

    const result = await session.handleMessage({
      ...baseParams,
      message: {
        id: 'msg-phantom-approval',
        userId: 'owner',
        principalId: 'owner',
        principalRole: 'owner',
        channel: 'web',
        content: 'Try Claude Code again.',
        timestamp: Date.now(),
      },
    });

    expect(result.content).toBe('I did not create a real approval request for that action. Please try again.');
    expect(result.metadata).toMatchObject({
      responseSource: {
        locality: 'external',
        providerName: 'anthropic',
      },
    });
    expect(result.metadata).not.toHaveProperty('pendingApprovals');
  });

  it('answers tool-report questions only after the gateway classifies the turn as general assistant', async () => {
    const llmChat = vi.fn(async (_messages, options) => {
      const firstTool = options?.tools?.[0]?.name;
      if (firstTool === 'route_intent') {
        return {
          content: JSON.stringify({
            route: 'general_assistant',
            confidence: 'high',
            operation: 'unknown',
            summary: 'General assistant question.',
          }),
          model: 'test-model',
          finishReason: 'stop',
        } satisfies ChatResponse;
      }
      throw new Error(`Unexpected llmChat tool ${firstTool}`);
    });
    const listJobs = vi.fn(async () => [{
      toolName: 'browser_read',
      status: 'succeeded',
      argsRedacted: { url: 'https://example.com' },
      completedAt: Date.now(),
    }]);

    const session = new BrokeredWorkerSession({
      getAlwaysLoadedTools: () => [],
      llmChat,
      callTool: vi.fn(),
      listJobs,
      decideApproval: vi.fn(),
      getApprovalResult: vi.fn(),
    } as never);

    const result = await session.handleMessage({
      ...baseParams,
      message: {
        id: 'msg-tool-report',
        userId: 'owner',
        principalId: 'owner',
        principalRole: 'owner',
        channel: 'web',
        content: 'What tools did you use?',
        timestamp: Date.now(),
      },
    });

    expect(result.content).toContain('browser_read');
    expect(result.metadata).toMatchObject({
      intentGateway: {
        route: 'general_assistant',
      },
    });
    expect(listJobs).toHaveBeenCalledWith('owner', undefined, 50);
    expect(llmChat).toHaveBeenCalledTimes(1);
  });

  it('inspects saved automations through the canonical automation catalog in brokered sessions', async () => {
    const llmChat = vi.fn(async (_messages, options) => {
      const firstTool = options?.tools?.[0]?.name;
      if (firstTool === 'route_intent') {
        return {
          content: JSON.stringify({
            route: 'automation_control',
            confidence: 'high',
            operation: 'inspect',
            summary: 'Inspect an existing automation.',
          }),
          model: 'test-model',
          finishReason: 'stop',
        } satisfies ChatResponse;
      }
      if (firstTool === 'resolve_automation_name') {
        return {
          content: JSON.stringify({
            automationName: 'Browser Read Smoke',
          }),
          model: 'test-model',
          finishReason: 'stop',
        } satisfies ChatResponse;
      }
      throw new Error(`Unexpected llmChat tool ${firstTool}`);
    });

    const callTool = vi.fn(async (request: { toolName: string }) => {
      if (request.toolName === 'automation_list') {
        return {
          success: true,
          status: 'succeeded',
          jobId: 'job-automation-list',
          message: 'Listed automations.',
          output: {
            count: 1,
            automations: [{
              id: 'browser-read-smoke',
              name: 'Browser Read Smoke',
              kind: 'workflow',
              enabled: true,
              workflow: {
                id: 'browser-read-smoke',
                name: 'Browser Read Smoke',
                enabled: true,
                mode: 'sequential',
                description: 'Reads example.com.',
                steps: [{ id: 'step-1', toolName: 'browser_navigate' }],
              },
            }],
          },
        };
      }
      throw new Error(`Unexpected tool ${request.toolName}`);
    });

    const session = new BrokeredWorkerSession({
      getAlwaysLoadedTools: () => [],
      llmChat,
      callTool,
      listJobs: vi.fn(async () => []),
      decideApproval: vi.fn(),
      getApprovalResult: vi.fn(),
    } as never);

    const result = await session.handleMessage({
      ...baseParams,
      message: {
        id: 'msg-1',
        userId: 'owner',
        principalId: 'owner',
        principalRole: 'owner',
        channel: 'web',
        content: 'Show me the automation Browser Read Smoke.',
        timestamp: Date.now(),
      },
    });

    expect(result.content).toContain('Browser Read Smoke (workflow)');
    expect(result.content).toContain('Steps:');
    expect(result.metadata).toMatchObject({
      intentGateway: {
        route: 'automation_control',
        operation: 'inspect',
        entities: {
          automationName: 'Browser Read Smoke',
        },
      },
    });
    expect(callTool).toHaveBeenCalledTimes(1);
    expect(callTool).toHaveBeenCalledWith(expect.objectContaining({
      toolName: 'automation_list',
    }));
  });

  it('runs saved automations through automation_run in brokered sessions', async () => {
    const llmChat = vi.fn(async () => ({
      content: JSON.stringify({
        route: 'automation_control',
        confidence: 'high',
        operation: 'run',
        summary: 'Run an existing automation.',
        automationName: 'Browser Read Smoke',
      }),
      model: 'test-model',
      finishReason: 'stop',
    } satisfies ChatResponse));

    const callTool = vi.fn(async (request: { toolName: string; args?: Record<string, unknown> }) => {
      if (request.toolName === 'automation_list') {
        return {
          success: true,
          status: 'succeeded',
          jobId: 'job-automation-list',
          message: 'Listed automations.',
          output: {
            count: 1,
            automations: [{
              id: 'browser-read-smoke',
              name: 'Browser Read Smoke',
              kind: 'workflow',
              enabled: true,
              workflow: {
                id: 'browser-read-smoke',
                name: 'Browser Read Smoke',
                enabled: true,
                mode: 'sequential',
                steps: [{ id: 'step-1', toolName: 'browser_navigate' }],
              },
            }],
          },
        };
      }
      if (request.toolName === 'automation_run') {
        expect(request.args).toEqual({ automationId: 'browser-read-smoke' });
        return {
          success: true,
          status: 'succeeded',
          jobId: 'job-automation-run',
          message: "Ran 'Browser Read Smoke'.",
          output: {
            success: true,
            message: "Ran 'Browser Read Smoke'.",
          },
        };
      }
      throw new Error(`Unexpected tool ${request.toolName}`);
    });

    const session = new BrokeredWorkerSession({
      getAlwaysLoadedTools: () => [],
      llmChat,
      callTool,
      listJobs: vi.fn(async () => []),
      decideApproval: vi.fn(),
      getApprovalResult: vi.fn(),
    } as never);

    const result = await session.handleMessage({
      ...baseParams,
      message: {
        id: 'msg-2',
        userId: 'owner',
        principalId: 'owner',
        principalRole: 'owner',
        channel: 'web',
        content: 'Run Browser Read Smoke now.',
        timestamp: Date.now(),
      },
    });

    expect(result.content).toContain("Ran 'Browser Read Smoke'.");
    expect(callTool.mock.calls.map((call) => call[0]?.toolName)).toEqual([
      'automation_list',
      'automation_run',
    ]);
  });

  it('normalizes local Second Brain calendar mutations in brokered sessions', async () => {
    const referenceTime = new Date(2026, 3, 5, 0, 20, 0, 0).getTime();
    const expectedStart = new Date(2026, 3, 6, 12, 0, 0, 0).getTime();
    const expectedEnd = new Date(2026, 3, 6, 13, 0, 0, 0).getTime();
    const llmChat = vi.fn(async (messages, options) => {
      const firstTool = options?.tools?.[0]?.name;
      if (firstTool === 'route_intent') {
        return {
          content: JSON.stringify({
            route: 'personal_assistant_task',
            confidence: 'high',
            operation: 'create',
            summary: 'Create a local calendar event.',
            personalItemType: 'calendar',
            calendarTarget: 'local',
          }),
          model: 'test-model',
          finishReason: 'stop',
        } satisfies ChatResponse;
      }
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === 'tool') {
        return {
          content: 'Saved the event in the local calendar.',
          model: 'test-model',
          finishReason: 'stop',
          toolCalls: [],
          providerLocality: 'external',
          providerName: 'anthropic',
        } as ChatResponse;
      }
      return {
        content: '',
        model: 'test-model',
        finishReason: 'tool_calls',
        toolCalls: [{
          id: 'tool-calendar-local',
          name: 'second_brain_calendar_upsert',
          arguments: JSON.stringify({
            title: "Doctor's Appointment",
            startsAt: expectedStart,
            endsAt: expectedStart,
            location: "Narangba doctor's surgery",
          }),
        }],
        providerLocality: 'external',
        providerName: 'anthropic',
      } as ChatResponse;
    });

    const callTool = vi.fn(async (request: { toolName: string; args: Record<string, unknown> }) => {
      expect(request.toolName).toBe('second_brain_calendar_upsert');
      expect(request.args).toMatchObject({
        title: "Doctor's Appointment",
        startsAt: expectedStart,
        endsAt: expectedEnd,
        location: "Narangba doctor's surgery",
      });
      return {
        success: true,
        status: 'succeeded',
        jobId: 'job-calendar-local',
        message: 'Saved event.',
        output: {
          event: {
            startsAt: expectedStart,
            endsAt: expectedEnd,
          },
        },
      };
    });

    const session = new BrokeredWorkerSession({
      getAlwaysLoadedTools: () => [{
        name: 'second_brain_calendar_upsert',
        description: 'Create or update a local calendar entry.',
        parameters: { type: 'object', properties: {} },
        risk: 'medium',
      }],
      llmChat,
      callTool,
      listJobs: vi.fn(async () => []),
      decideApproval: vi.fn(),
      getApprovalResult: vi.fn(),
    } as never);

    const result = await session.handleMessage({
      ...baseParams,
      message: {
        id: 'msg-local-calendar',
        userId: 'owner',
        principalId: 'owner',
        principalRole: 'owner',
        channel: 'web',
        content: "Add a calendar entry for tomorrow at 12 pm for a doctor's appointment at Narangba doctor's surgery.",
        timestamp: referenceTime,
      },
    });

    expect(callTool).toHaveBeenCalledTimes(1);
    expect(result.content).toBe('Saved the event in the local calendar.');
  });

  it('blocks provider calendar mutations when the routed turn is local Second Brain work', async () => {
    const llmChat = vi.fn(async (messages, options) => {
      const firstTool = options?.tools?.[0]?.name;
      if (firstTool === 'route_intent') {
        return {
          content: JSON.stringify({
            route: 'personal_assistant_task',
            confidence: 'high',
            operation: 'create',
            summary: 'Create a local calendar event.',
            personalItemType: 'calendar',
            calendarTarget: 'local',
          }),
          model: 'test-model',
          finishReason: 'stop',
        } satisfies ChatResponse;
      }
      const systemPrompt = messages.find((entry) => entry.role === 'system')?.content ?? '';
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === 'tool') {
        expect(lastMessage.content).toContain('local Second Brain calendar');
        return {
          content: 'Stayed on the local calendar path.',
          model: 'test-model',
          finishReason: 'stop',
          toolCalls: [],
          providerLocality: 'external',
          providerName: 'anthropic',
        } as ChatResponse;
      }
      expect(systemPrompt).toContain('[routed-intent]');
      expect(systemPrompt).toContain('route: personal_assistant_task');
      expect(systemPrompt).toContain('Do not ask the user to choose Google or Microsoft for this turn.');
      return {
        content: '',
        model: 'test-model',
        finishReason: 'tool_calls',
        toolCalls: [{
          id: 'tool-gws-calendar',
          name: 'gws',
          arguments: JSON.stringify({
            method: 'calendar events create',
          }),
        }],
        providerLocality: 'external',
        providerName: 'anthropic',
      } as ChatResponse;
    });

    const callTool = vi.fn();
    const session = new BrokeredWorkerSession({
      getAlwaysLoadedTools: () => [{
        name: 'gws',
        description: 'Google Workspace integration.',
        parameters: { type: 'object', properties: {} },
        risk: 'high',
      }],
      llmChat,
      callTool,
      listJobs: vi.fn(async () => []),
      decideApproval: vi.fn(),
      getApprovalResult: vi.fn(),
    } as never);

    const result = await session.handleMessage({
      ...baseParams,
      message: {
        id: 'msg-gws-denied',
        userId: 'owner',
        principalId: 'owner',
        principalRole: 'owner',
        channel: 'web',
        content: "Add a calendar entry for tomorrow at 12 pm for a doctor's appointment at Narangba doctor's surgery.",
        timestamp: new Date(2026, 3, 5, 0, 20, 0, 0).getTime(),
      },
    });

    expect(callTool).not.toHaveBeenCalled();
    expect(result.content).toBe('Stayed on the local calendar path.');
  });
});
