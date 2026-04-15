import type { PlanNode } from './types.js';
import { parseStructuredJsonObject } from '../../util/structured-json.js';
import { BROKER_SAFE_PLANNER_ACTION_TYPES } from './task-planner.js';

export interface RecoveryPlan {
  success: boolean;
  reason?: string;
  replacementNode?: PlanNode;
}

export class RecoveryPlanner {
  constructor(
    private readonly chatFn: (messages: any[], options?: any) => Promise<any>,
    private readonly options: {
      allowedActionTypes?: PlanNode['actionType'][];
      allowedToolNames?: string[];
    } = {},
  ) {}

  async attemptRecovery(
    objective: string,
    failedNode: PlanNode,
    errorOrReflectionReason: unknown
  ): Promise<RecoveryPlan> {
    const allowedActionTypes = this.options.allowedActionTypes ?? BROKER_SAFE_PLANNER_ACTION_TYPES;
    const allowedToolNames = Array.isArray(this.options.allowedToolNames)
      ? [...new Set(this.options.allowedToolNames
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.trim()))].sort((left, right) => left.localeCompare(right))
      : [];
    const prompt = `
You are the Guardian Agent Recovery Planner.
A sub-task within a complex Execution Plan has failed either technically or semantically.
Your job is to generate a fallback sub-task to replace the failed one while staying inside the broker-safe execution contract.

Overall Objective: ${objective}

Failed Node:
${JSON.stringify(failedNode, null, 2)}

Failure Reason / Result:
${JSON.stringify(errorOrReflectionReason, null, 2)}

Provide your answer as a JSON object with:
- "success": boolean (true if you have a recovery plan, false if it's unrecoverable)
- "reason": string (explanation of your recovery approach)
- "replacementNode": an optional PlanNode object containing the new fallback action. Ensure it has a unique ID (e.g., "recovered-<original_id>") and lists the same dependencies as the failed node.

PlanNode structure:
{
  "id": "string",
  "description": "string",
  "dependencies": ["string"],
  "actionType": ${allowedActionTypes.map((actionType) => `"${actionType}"`).join(' | ')},
  "target": "string",
  "inputPrompt": "string"
}

This brokered runtime only supports the action types listed above.
${allowedToolNames.length > 0 ? `Allowed brokered tool names in this runtime: ${allowedToolNames.join(', ')}.\n` : ''}- Prefer "tool_call" for brokered file and tool operations.
- Use "execute_code" only for one bounded remote command string, and do not wrap that command in JSON.
- Do not invent tool aliases such as "fs_readFile", "read_file", or "fs_writeFile". Use the exact brokered tool names above.
- Do not emit unsupported actions outside the allowed set above.
`;

    try {
      const response = await this.chatFn([
        { role: 'system', content: 'You are the Guardian Agent Recovery Planner. You recover failed DAG nodes with logical pivots or dynamic sandbox skills.' },
        { role: 'user', content: prompt }
      ], {
        responseFormat: { type: 'json_object' }
      });

      const content = response?.content;
      if (!content) return { success: false, reason: 'No response from recovery model.' };

      const parsed = parseStructuredJsonObject(content);
      if (!parsed) {
        return { success: false, reason: 'Failed to parse recovery response.' };
      }
      
      if (parsed.success === true && parsed.replacementNode && typeof parsed.replacementNode === 'object') {
        const replacementNode = parsed.replacementNode as PlanNode;
        // Ensure status is pending
        replacementNode.status = 'pending';
        return {
          success: true,
          reason: typeof parsed.reason === 'string' ? parsed.reason : 'Recovery plan generated.',
          replacementNode
        };
      }
      return { success: false, reason: typeof parsed.reason === 'string' ? parsed.reason : 'Failed to generate a valid replacement node.' };
    } catch (err) {
      console.error('RecoveryPlanner: Failed to parse recovery plan:', err);
      return { success: false, reason: 'Recovery parsing error.' };
    }
  }
}
