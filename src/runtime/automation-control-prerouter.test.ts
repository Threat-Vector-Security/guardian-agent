import { describe, expect, it, vi } from 'vitest';
import { tryAutomationControlPreRoute } from './automation-control-prerouter.js';

const baseMessage = {
  id: 'msg-1',
  userId: 'owner',
  principalId: 'owner',
  principalRole: 'owner' as const,
  agentId: 'default',
  channel: 'web',
  content: '',
};

describe('tryAutomationControlPreRoute', () => {
  it('lists the unified automation catalog when asked to inspect automations', async () => {
    const executeTool = vi.fn(async (toolName: string) => {
      if (toolName === 'workflow_list') {
        return {
          success: true,
          output: {
            workflows: [{
              id: 'browser-read-smoke',
              name: 'Browser Read Smoke',
              enabled: true,
              mode: 'sequential',
              description: 'Reads example.com.',
              steps: [{ id: 'step-1', toolName: 'browser_navigate' }],
            }],
          },
        };
      }
      if (toolName === 'task_list') {
        return {
          success: true,
          output: {
            tasks: [{
              id: 'task-1',
              name: 'Inbox Triage',
              type: 'agent',
              target: 'default',
              eventTrigger: { eventType: 'automation:manual:inbox-triage' },
              enabled: false,
            }],
          },
        };
      }
      throw new Error(`Unexpected tool ${toolName}`);
    });

    const result = await tryAutomationControlPreRoute({
      agentId: 'default',
      message: {
        ...baseMessage,
        content: 'Show me the saved automations.',
      },
      executeTool,
    });

    expect(result?.content).toContain('Saved automations (2)');
    expect(result?.content).toContain('Browser Read Smoke');
    expect(result?.content).toContain('Inbox Triage');
  });

  it('runs task-only automations through task_run', async () => {
    const executeTool = vi.fn(async (toolName: string, args: Record<string, unknown>) => {
      if (toolName === 'workflow_list') {
        return { success: true, output: { workflows: [] } };
      }
      if (toolName === 'task_list') {
        return {
          success: true,
          output: {
            tasks: [{
              id: 'task-inbox',
              name: 'Inbox Triage',
              type: 'agent',
              target: 'default',
              cron: '0 8 * * *',
              enabled: true,
            }],
          },
        };
      }
      if (toolName === 'task_run') {
        expect(args).toEqual({ taskId: 'task-inbox' });
        return {
          success: true,
          message: "Ran 'Inbox Triage'.",
        };
      }
      throw new Error(`Unexpected tool ${toolName}`);
    });

    const result = await tryAutomationControlPreRoute({
      agentId: 'default',
      message: {
        ...baseMessage,
        content: 'Run Inbox Triage.',
      },
      executeTool,
    }, {
      intentDecision: {
        route: 'automation_control',
        confidence: 'high',
        operation: 'run',
        summary: 'Run an existing automation.',
        entities: {
          automationName: 'Inbox Triage',
        },
      },
    });

    expect(result?.content).toContain("Ran 'Inbox Triage'.");
    expect(executeTool).toHaveBeenCalledWith(
      'task_run',
      { taskId: 'task-inbox' },
      expect.objectContaining({ channel: 'web', userId: 'owner' }),
    );
  });

  it('toggles workflows from automations-page intents via workflow_upsert', async () => {
    const executeTool = vi.fn(async (toolName: string, args: Record<string, unknown>) => {
      if (toolName === 'workflow_list') {
        return {
          success: true,
          output: {
            workflows: [{
              id: 'browser-read-smoke',
              name: 'Browser Read Smoke',
              enabled: true,
              mode: 'sequential',
              description: 'Reads example.com.',
              steps: [{ id: 'step-1', toolName: 'browser_navigate', args: { url: 'https://example.com' } }],
            }],
          },
        };
      }
      if (toolName === 'task_list') {
        return { success: true, output: { tasks: [] } };
      }
      if (toolName === 'workflow_upsert') {
        expect(args).toMatchObject({
          id: 'browser-read-smoke',
          name: 'Browser Read Smoke',
          enabled: false,
          mode: 'sequential',
        });
        return {
          success: true,
          message: "Disabled 'Browser Read Smoke'.",
        };
      }
      throw new Error(`Unexpected tool ${toolName}`);
    });

    const result = await tryAutomationControlPreRoute({
      agentId: 'default',
      message: {
        ...baseMessage,
        content: 'In the Automations page, disable Browser Read Smoke.',
      },
      executeTool,
    }, {
      intentDecision: {
        route: 'ui_control',
        confidence: 'high',
        operation: 'toggle',
        summary: 'Disable a saved automation from the automations page.',
        entities: {
          automationName: 'Browser Read Smoke',
          uiSurface: 'automations',
          enabled: false,
        },
      },
    });

    expect(result?.content).toContain("Disabled 'Browser Read Smoke'.");
  });

  it('prepares both task and workflow deletions when a linked automation needs approval', async () => {
    const executeTool = vi.fn(async (toolName: string, args: Record<string, unknown>) => {
      if (toolName === 'workflow_list') {
        return {
          success: true,
          output: {
            workflows: [{
              id: 'browser-read-smoke',
              name: 'Browser Read Smoke',
              enabled: true,
              mode: 'sequential',
              steps: [{ id: 'step-1', toolName: 'browser_navigate' }],
            }],
          },
        };
      }
      if (toolName === 'task_list') {
        return {
          success: true,
          output: {
            tasks: [{
              id: 'task-browser-read',
              name: 'Browser Read Smoke',
              type: 'workflow',
              target: 'browser-read-smoke',
              cron: '0 8 * * 1',
              enabled: true,
            }],
          },
        };
      }
      if (toolName === 'task_delete') {
        expect(args).toEqual({ taskId: 'task-browser-read' });
        return {
          success: false,
          status: 'pending_approval',
          approvalId: 'approval-task',
        };
      }
      if (toolName === 'workflow_delete') {
        expect(args).toEqual({ workflowId: 'browser-read-smoke' });
        return {
          success: false,
          status: 'pending_approval',
          approvalId: 'approval-workflow',
        };
      }
      throw new Error(`Unexpected tool ${toolName}`);
    });

    const trackPendingApproval = vi.fn();
    const onPendingApproval = vi.fn();

    const result = await tryAutomationControlPreRoute({
      agentId: 'default',
      message: {
        ...baseMessage,
        content: 'Delete Browser Read Smoke.',
      },
      executeTool,
      trackPendingApproval,
      onPendingApproval,
      formatPendingApprovalPrompt: () => 'Approval UI rendered.',
      resolvePendingApprovalMetadata: (_ids, fallback) => fallback,
    }, {
      intentDecision: {
        route: 'automation_control',
        confidence: 'high',
        operation: 'delete',
        summary: 'Delete an existing automation.',
        entities: {
          automationName: 'Browser Read Smoke',
        },
      },
    });

    expect(result?.content).toContain("I prepared deletion of 'Browser Read Smoke'.");
    expect(result?.content).toContain('Approval UI rendered.');
    expect(result?.metadata?.pendingApprovals).toEqual([
      {
        id: 'approval-task',
        toolName: 'task_delete',
        argsPreview: '{"taskId":"task-browser-read"}',
      },
      {
        id: 'approval-workflow',
        toolName: 'workflow_delete',
        argsPreview: '{"workflowId":"browser-read-smoke"}',
      },
    ]);
    expect(trackPendingApproval).toHaveBeenCalledWith('approval-task');
    expect(trackPendingApproval).toHaveBeenCalledWith('approval-workflow');
    expect(onPendingApproval).toHaveBeenCalledTimes(2);
  });
});
