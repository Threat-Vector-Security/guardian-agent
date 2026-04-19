import { describe, expect, it, vi } from 'vitest';

import { tryDirectCodeSessionControlFromGateway } from './code-session-control.js';
import type { AgentContext, UserMessage } from '../../agent/types.js';
import type { IntentGatewayDecision } from '../intent-gateway.js';

function createMessage(overrides: Partial<UserMessage> = {}): UserMessage {
  return {
    id: 'msg-1',
    userId: 'owner',
    channel: 'web',
    surfaceId: 'web-guardian-chat',
    content: 'What managed sandboxes are attached to this coding session?',
    timestamp: 1,
    ...overrides,
  };
}

function createCtx(): AgentContext {
  return {
    agentId: 'chat',
    emit: vi.fn(async () => undefined),
    checkAction: vi.fn(),
    capabilities: [],
  };
}

function createDecision(overrides: Partial<IntentGatewayDecision> = {}): IntentGatewayDecision {
  return {
    route: 'coding_session_control',
    confidence: 'high',
    operation: 'inspect',
    summary: 'Inspect the managed sandboxes attached to the current coding session.',
    turnRelation: 'new_request',
    resolution: 'ready',
    missingFields: [],
    executionClass: 'direct_assistant',
    preferredTier: 'local',
    requiresRepoGrounding: false,
    requiresToolSynthesis: false,
    expectedContextPressure: 'low',
    preferredAnswerPath: 'direct',
    simpleVsComplex: 'simple',
    entities: {
      codeSessionResource: 'managed_sandboxes',
    },
    ...overrides,
  };
}

describe('tryDirectCodeSessionControlFromGateway', () => {
  it('returns managed sandboxes instead of falling through to workspace listing', async () => {
    const executeDirectCodeSessionTool = vi.fn(async (toolName: string) => {
      if (toolName === 'code_session_current') {
        return {
          success: true,
          output: {
            session: {
              id: 'session-1',
              ownerUserId: 'owner',
              title: 'Guardian Agent',
              workspaceRoot: 'S:\\Development\\GuardianAgent',
              resolvedRoot: 'S:\\Development\\GuardianAgent',
              workState: {
                managedSandboxes: [],
              },
            },
          },
        };
      }
      throw new Error(`Unexpected tool ${toolName}`);
    });
    const getCodeSessionManagedSandboxes = vi.fn(async () => ({
      sandboxes: [
        {
          leaseId: 'lease-1',
          targetId: 'daytona-main',
          profileName: 'Daytona Main',
          backendKind: 'daytona_sandbox',
          sandboxId: 'sandbox-1',
          localWorkspaceRoot: 'S:\\Development\\GuardianAgent',
          remoteWorkspaceRoot: '/home/daytona/guardian-workspace',
          status: 'active',
          state: 'running',
          acquiredAt: 1,
          lastUsedAt: 2,
          trackedRemotePaths: [],
        },
      ],
    }));

    const result = await tryDirectCodeSessionControlFromGateway({
      toolsEnabled: true,
      executeDirectCodeSessionTool,
      getCodeSessionManagedSandboxes,
      getActivePendingAction: vi.fn(() => null),
      completePendingAction: vi.fn(),
      resumeCodingTask: vi.fn(async () => null),
      onMessage: vi.fn(async () => ({ content: 'unexpected' })),
      message: createMessage(),
      ctx: createCtx(),
      decision: createDecision(),
    });

    expect(getCodeSessionManagedSandboxes).toHaveBeenCalledWith('session-1', 'owner');
    expect(result).toEqual({
      content: [
        'This chat is currently attached to:',
        '- CURRENT: Guardian Agent — S:\\Development\\GuardianAgent id=session-1',
        'Managed sandboxes attached to this coding session:',
        '- Daytona Main | backend=daytona_sandbox | state=running | status=active | sandboxId=sandbox-1 | workspace=/home/daytona/guardian-workspace | canRestart=no',
      ].join('\n'),
      metadata: {
        codeSessionResolved: true,
        codeSessionId: 'session-1',
      },
    });
  });

  it('reports when the current coding session has no attached managed sandboxes', async () => {
    const executeDirectCodeSessionTool = vi.fn(async () => ({
      success: true,
      output: {
        session: {
          id: 'session-1',
          ownerUserId: 'owner',
          title: 'Guardian Agent',
          workspaceRoot: 'S:\\Development\\GuardianAgent',
          resolvedRoot: 'S:\\Development\\GuardianAgent',
          workState: {
            managedSandboxes: [],
          },
        },
      },
    }));

    const result = await tryDirectCodeSessionControlFromGateway({
      toolsEnabled: true,
      executeDirectCodeSessionTool,
      getActivePendingAction: vi.fn(() => null),
      completePendingAction: vi.fn(),
      resumeCodingTask: vi.fn(async () => null),
      onMessage: vi.fn(async () => ({ content: 'unexpected' })),
      message: createMessage(),
      ctx: createCtx(),
      decision: createDecision(),
    });

    expect(result?.content).toContain('No managed sandboxes are currently attached to this coding session.');
    expect(result?.content).not.toContain('Available coding workspaces:');
  });
});
