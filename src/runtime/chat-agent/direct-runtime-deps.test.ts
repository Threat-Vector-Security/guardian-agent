import { describe, expect, it, vi } from 'vitest';

import {
  buildDirectAutomationDeps,
  buildDirectMailboxDeps,
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
  });
});
