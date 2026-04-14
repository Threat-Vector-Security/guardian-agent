import { randomUUID } from 'node:crypto';

import { toBoolean, toString } from '../../chat-agent-helpers.js';
import type { ToolApprovalDecisionResult, ToolExecutor } from '../../tools/executor.js';
import type { PendingActionRecord } from '../pending-actions.js';
import type {
  SecondBrainMutationResumePayload,
} from './direct-route-resume.js';

export async function executeStoredSecondBrainMutation<TContinuityThread, TFocusState>(input: {
  pendingAction: PendingActionRecord;
  resume: SecondBrainMutationResumePayload;
  approvalResult?: ToolApprovalDecisionResult;
  agentId: string;
  tools?: Pick<ToolExecutor, 'isEnabled' | 'executeModelTool'> | null;
  getContinuityThread: (userId: string, nowMs?: number) => TContinuityThread;
  readSecondBrainFocusContinuationState: (continuityThread: TContinuityThread) => TFocusState;
  buildDirectSecondBrainMutationSuccessResponse: (
    descriptor: {
      itemType: SecondBrainMutationResumePayload['itemType'];
      action: SecondBrainMutationResumePayload['action'];
      fallbackId?: string;
      fallbackLabel?: string;
    },
    output: unknown,
    focusState: TFocusState,
  ) => { content: string; metadata?: Record<string, unknown> };
}): Promise<{ content: string; metadata?: Record<string, unknown> }> {
  if (input.approvalResult && !input.approvalResult.success) {
    const errorMessage = toString(input.approvalResult.message).trim() || 'Second Brain update failed.';
    return { content: `I couldn't complete the local Second Brain update: ${errorMessage}` };
  }

  let output = input.approvalResult?.result?.output;
  if (output === undefined) {
    if (!input.tools?.isEnabled()) {
      return { content: 'Second Brain tools are unavailable right now.' };
    }
    const toolResult = await input.tools.executeModelTool(
      input.resume.toolName,
      input.resume.args,
      {
        origin: 'assistant',
        agentId: input.agentId,
        userId: input.pendingAction.scope.userId,
        channel: input.pendingAction.scope.channel,
        surfaceId: input.pendingAction.scope.surfaceId,
        requestId: randomUUID(),
      },
    );
    if (!toBoolean(toolResult.success)) {
      const errorMessage = toString(toolResult.message) || toString(toolResult.error) || 'Second Brain update failed.';
      return { content: `I couldn't complete the local Second Brain update: ${errorMessage}` };
    }
    output = toolResult.output;
  }

  const focusState = input.readSecondBrainFocusContinuationState(
    input.getContinuityThread(input.pendingAction.scope.userId),
  );
  return input.buildDirectSecondBrainMutationSuccessResponse(
    {
      itemType: input.resume.itemType,
      action: input.resume.action,
      fallbackId: input.resume.fallbackId,
      fallbackLabel: input.resume.fallbackLabel,
    },
    output,
    focusState,
  );
}
