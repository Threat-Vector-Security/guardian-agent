import { describe, expect, it, vi } from 'vitest';

import { buildToolLoopResumePayload } from './tool-loop-resume.js';
import { resumeStoredToolLoopPendingAction } from './tool-loop-runtime.js';
import type { PendingActionRecord } from '../pending-actions.js';

describe('tool-loop-runtime', () => {
  it('does not treat intermediate retry narration as a completed resumed tool-loop answer', async () => {
    const pendingAction: PendingActionRecord = {
      id: 'pending-1',
      scope: {
        agentId: 'chat',
        userId: 'owner',
        channel: 'web',
        surfaceId: 'web-guardian-chat',
      },
      status: 'pending',
      transferPolicy: 'linked_surfaces_same_user',
      blocker: {
        kind: 'approval',
        prompt: 'Approve the remote command.',
        approvalIds: ['approval-1'],
      },
      intent: {
        route: 'coding_task',
        operation: 'run',
        originalUserContent: 'Run `pwd` in the remote sandbox.',
        summary: 'Run a remote sandbox command.',
        turnRelation: 'new_request',
        resolution: 'ready',
        missingFields: [],
        entities: {},
      },
      resume: {
        kind: 'tool_loop',
        payload: buildToolLoopResumePayload({
          llmMessages: [
            { role: 'system', content: 'system prompt' },
            { role: 'user', content: 'Run `pwd` in the remote sandbox.' },
          ],
          pendingTools: [
            {
              approvalId: 'approval-1',
              toolCallId: 'tool-call-1',
              jobId: 'job-1',
              name: 'code_remote_exec',
            },
          ],
          originalMessage: {
            id: 'msg-1',
            userId: 'owner',
            channel: 'web',
            surfaceId: 'web-guardian-chat',
            timestamp: 1,
            content: 'Run `pwd` in the remote sandbox.',
          },
          requestText: 'Run `pwd` in the remote sandbox.',
          referenceTime: 1,
          allowModelMemoryMutation: false,
          activeSkillIds: [],
          contentTrustLevel: 'trusted',
          taintReasons: [],
          intentDecision: {
            route: 'coding_task',
            operation: 'run',
            summary: 'Run a remote sandbox command.',
            confidence: 'high',
            turnRelation: 'new_request',
            resolution: 'ready',
            missingFields: [],
            executionClass: 'repo_grounded',
            preferredTier: 'external',
            requiresRepoGrounding: true,
            requiresToolSynthesis: true,
            expectedContextPressure: 'medium',
            preferredAnswerPath: 'tool_loop',
            simpleVsComplex: 'complex',
            entities: {},
          },
        }),
      },
      createdAt: 1,
      updatedAt: 1,
      expiresAt: 2,
    };

    const chatFn = vi.fn(async () => ({
      content: 'Let me retry once to rule out a transient issue:',
      toolCalls: [],
      model: 'test-model',
      finishReason: 'stop' as const,
    }));

    const result = await resumeStoredToolLoopPendingAction({
      pendingAction,
      options: {
        approvalId: 'approval-1',
        approvalResult: {
          success: true,
          approved: true,
          executionSucceeded: false,
          message: "Tool 'code_remote_exec' failed.",
          result: {
            success: false,
            error: 'Remote sandbox command failed on Daytona Main.',
          },
        },
      },
      agentId: 'chat',
      tools: {
        executeModelTool: vi.fn(),
        getApprovalSummaries: vi.fn(() => new Map()),
        getToolDefinition: vi.fn(() => undefined),
        isEnabled: vi.fn(() => true),
        listAlwaysLoadedDefinitions: vi.fn(() => []),
        listCodeSessionEagerToolDefinitions: vi.fn(() => []),
        listJobs: vi.fn(() => []),
      },
      secondBrainService: null,
      maxToolRounds: 2,
      contextBudget: 32_000,
      normalizePrincipalRole: () => 'owner',
      buildChatRunner: () => ({
        providerLocality: 'external',
        chatFn,
      }),
      completePendingAction: vi.fn(),
      sanitizeToolResultForLlm: vi.fn((_toolName, result) => ({
        sanitized: result,
        threats: [],
        trustLevel: 'trusted',
        taintReasons: [],
      })),
      isResponseDegraded: vi.fn(() => false),
      storeSuspendedSession: vi.fn(),
      setPendingApprovalAction: vi.fn(() => {
        throw new Error('unexpected pending approval');
      }),
      buildPendingApprovalBlockedResponse: vi.fn(() => {
        throw new Error('unexpected blocked response');
      }),
    });

    expect(chatFn).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      content: 'I could not resume the pending coding run after approval.',
    });
  });
});
