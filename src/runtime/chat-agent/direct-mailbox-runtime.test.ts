import { describe, expect, it, vi } from 'vitest';

import type { AgentContext, UserMessage } from '../../agent/types.js';
import type { IntentGatewayDecision } from '../intent-gateway.js';
import type { PendingActionRecord } from '../pending-actions.js';
import {
  type DirectMailboxDeps,
  tryDirectGoogleWorkspaceRead,
  tryDirectGoogleWorkspaceWrite,
} from './direct-mailbox-runtime.js';

function makeMessage(content: string): UserMessage {
  return {
    id: 'msg-1',
    userId: 'owner',
    channel: 'web',
    surfaceId: 'surface-1',
    timestamp: 1,
    content,
  };
}

function makeDeps(overrides?: Partial<DirectMailboxDeps>): DirectMailboxDeps {
  return {
    agentId: 'agent-1',
    tools: {
      isEnabled: () => true,
      executeModelTool: vi.fn(async () => ({ success: true })),
      getApprovalSummaries: vi.fn(() => new Map()),
    },
    setApprovalFollowUp: vi.fn(),
    getPendingApprovals: vi.fn(() => null),
    formatPendingApprovalPrompt: vi.fn(() => 'Approve it.'),
    setPendingApprovalActionForRequest: vi.fn(() => ({
      action: { id: 'pending-1' } as PendingActionRecord,
    })),
    buildPendingApprovalBlockedResponse: vi.fn((_, fallbackContent) => ({ content: fallbackContent })),
    ...overrides,
  };
}

function m365WriteDecision(): IntentGatewayDecision {
  return {
    route: 'email_task',
    confidence: 'high',
    operation: 'send',
    summary: 'Send an email.',
    turnRelation: 'new_request',
    resolution: 'ready',
    missingFields: [],
    executionClass: 'provider_crud',
    preferredTier: 'external',
    requiresRepoGrounding: false,
    requiresToolSynthesis: true,
    requireExactFileReferences: false,
    expectedContextPressure: 'medium',
    preferredAnswerPath: 'tool_loop',
    simpleVsComplex: 'simple',
    plannedSteps: [],
    entities: {
      emailProvider: 'm365',
    },
  };
}

describe('direct mailbox runtime', () => {
  it('sends Gmail compose requests through the shared tool executor', async () => {
    const deps = makeDeps();

    const result = await tryDirectGoogleWorkspaceWrite({
      message: makeMessage('send to alex@example.com subject is Status, body Everything is green.'),
      ctx: { checkAction: vi.fn() } as unknown as AgentContext,
      userKey: 'owner:web',
    }, deps);

    expect(result).toBe('I sent the Gmail message to alex@example.com with subject "Status".');
    expect(deps.tools?.executeModelTool).toHaveBeenCalledWith(
      'gws',
      expect.objectContaining({
        service: 'gmail',
        resource: 'users messages',
        method: 'send',
        params: { userId: 'me' },
      }),
      expect.objectContaining({
        origin: 'assistant',
        agentId: 'agent-1',
        userId: 'owner',
        channel: 'web',
        requestId: 'msg-1',
      }),
    );
  });

  it('routes Microsoft 365 write approvals through shared pending-action metadata', async () => {
    const deps = makeDeps({
      tools: {
        isEnabled: () => true,
        executeModelTool: vi.fn(async () => ({
          success: false,
          status: 'pending_approval',
          approvalId: 'approval-1',
        })),
        getApprovalSummaries: vi.fn(() => new Map([
          ['approval-1', { toolName: 'outlook_send', argsPreview: 'send email' }],
        ])),
      },
    });
    const message = makeMessage('send to alex@example.com subject is Status, body Everything is green.');

    const result = await tryDirectGoogleWorkspaceWrite({
      message,
      ctx: { checkAction: vi.fn() } as unknown as AgentContext,
      userKey: 'owner:web',
      decision: m365WriteDecision(),
    }, deps);

    expect(result).toEqual({
      content: 'I prepared an Outlook send to alex@example.com with subject "Status", but it needs approval first.\n\nApprove it.',
    });
    expect(deps.tools?.executeModelTool).toHaveBeenCalledWith(
      'outlook_send',
      { to: 'alex@example.com', subject: 'Status', body: 'Everything is green.' },
      expect.any(Object),
    );
    expect(deps.setPendingApprovalActionForRequest).toHaveBeenCalledWith(
      'owner:web',
      'surface-1',
      expect.objectContaining({
        approvalIds: ['approval-1'],
        route: 'email_task',
        operation: 'send',
        summary: 'Sends an Outlook message.',
        entities: { emailProvider: 'm365' },
      }),
    );
  });

  it('returns a direct Gmail empty-inbox response without building pending state', async () => {
    const deps = makeDeps({
      tools: {
        isEnabled: () => true,
        executeModelTool: vi.fn(async () => ({
          success: true,
          output: {
            messages: [],
            resultSizeEstimate: 0,
          },
        })),
        getApprovalSummaries: vi.fn(() => new Map()),
      },
    });

    const result = await tryDirectGoogleWorkspaceRead({
      message: makeMessage('Check my unread Gmail mail.'),
      ctx: { checkAction: vi.fn() } as unknown as AgentContext,
      userKey: 'owner:web',
    }, deps);

    expect(result).toBe('I checked Gmail and found no unread messages.');
    expect(deps.setPendingApprovalActionForRequest).not.toHaveBeenCalled();
  });
});
