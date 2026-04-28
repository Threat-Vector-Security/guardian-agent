import { describe, expect, it, vi } from 'vitest';

import {
  buildDirectAutomationDeps,
  buildDirectMailboxDeps,
  buildDirectPersonalAssistantDeps,
  buildDirectSecondBrainSuccessResponse,
  buildDirectScheduledEmailAutomationDeps,
  type DirectRuntimeDepsInput,
} from './direct-runtime-deps.js';

function deps(): DirectRuntimeDepsInput {
  return {
    agentId: 'chat',
    tools: { isEnabled: vi.fn(() => true) } as never,
    conversationService: { getHistoryForContext: vi.fn(() => []) },
    setApprovalFollowUp: vi.fn(),
    getPendingApprovals: vi.fn(() => null),
    formatPendingApprovalPrompt: vi.fn(() => 'approve'),
    parsePendingActionUserKey: vi.fn(() => ({ userId: 'owner', channel: 'web' })),
    setClarificationPendingAction: vi.fn(() => ({ action: null })),
    setPendingApprovalActionForRequest: vi.fn(() => ({ action: null })),
    setChatContinuationGraphPendingApprovalActionForRequest: vi.fn(() => ({ action: null })),
    buildPendingApprovalBlockedResponse: vi.fn(() => ({ content: 'blocked' })),
    buildImmediateResponseMetadata: vi.fn(() => ({ pendingAction: { id: 'pending-1' } })),
  };
}

describe('direct runtime dependency builders', () => {
  it('shares approval and tool dependencies across direct runtimes', () => {
    const input = deps();

    expect(buildDirectMailboxDeps(input)).toMatchObject({
      agentId: 'chat',
      tools: input.tools,
      getPendingApprovals: input.getPendingApprovals,
    });
    expect(buildDirectAutomationDeps(input)).toMatchObject({
      agentId: 'chat',
      tools: input.tools,
      parsePendingActionUserKey: input.parsePendingActionUserKey,
    });
    expect(buildDirectScheduledEmailAutomationDeps(input)).toMatchObject({
      agentId: 'chat',
      tools: input.tools,
      conversationService: input.conversationService,
      getPendingApprovals: input.getPendingApprovals,
    });
    expect(buildDirectPersonalAssistantDeps(input)).toMatchObject({
      tools: input.tools,
      secondBrainService: input.secondBrainService,
    });
  });

  it('builds direct Second Brain clarification and success responses without ChatAgent wrappers', async () => {
    const input = deps();
    const personalAssistantDeps = buildDirectPersonalAssistantDeps(input);

    const clarification = personalAssistantDeps.buildClarificationResponse({
      message: {
        id: 'msg-1',
        userId: 'owner',
        channel: 'web',
        content: 'create task',
        timestamp: 1,
      },
      decision: {
        route: 'personal_assistant_task',
        confidence: 'high',
        operation: 'create',
        summary: 'Create task.',
        turnRelation: 'new_request',
        resolution: 'needs_clarification',
        missingFields: ['title'],
        executionClass: 'personal_assistant',
        preferredTier: 'local',
        requiresRepoGrounding: false,
        requiresToolSynthesis: false,
        expectedContextPressure: 'low',
        preferredAnswerPath: 'direct',
        entities: { personalItemType: 'task' },
      } as never,
      prompt: 'What is the task title?',
      field: 'title',
      missingFields: ['title'],
    });

    expect(clarification).toMatchObject({
      content: 'What is the task title?',
      metadata: { pendingAction: { id: 'pending-1' } },
    });
    expect(input.setClarificationPendingAction).toHaveBeenCalledWith(
      'owner',
      'web',
      undefined,
      expect.objectContaining({
        blockerKind: 'clarification',
        route: 'personal_assistant_task',
        operation: 'create',
      }),
    );

    expect(buildDirectSecondBrainSuccessResponse(
      { itemType: 'task', action: 'create' },
      { id: 'task-1', title: 'Book vet' },
      null,
    )).toMatchObject({
      content: 'Task created: Book vet',
      metadata: expect.objectContaining({
        continuationState: expect.any(Object),
      }),
    });
  });
});
