import type { IntentGatewayDecision } from '../intent-gateway.js';
import type { ExecutionPlan, PlanNode } from './types.js';
import { parseStructuredJsonObject } from '../../util/structured-json.js';

export const BROKER_SAFE_PLANNER_ACTION_TYPES: PlanNode['actionType'][] = ['tool_call', 'execute_code'];

export class TaskPlanner {
  constructor(
    private readonly chatFn: (messages: any[], options?: any) => Promise<any>,
    private readonly options: {
      allowedActionTypes?: PlanNode['actionType'][];
    } = {},
  ) {}

  async plan(objective: string, intentDecision?: IntentGatewayDecision): Promise<ExecutionPlan | null> {
    const prompt = this.buildPlannerPrompt(objective, intentDecision);
    const response = await this.chatFn([
      { role: 'system', content: 'You are the Guardian Agent Meta-Planner. You receive complex objectives and break them down into a precise Directed Acyclic Graph (DAG) of actionable sub-tasks.' },
      { role: 'user', content: prompt }
    ], {
      // Expect JSON output or tools, etc. We'll simplify to JSON for the POC.
      response_format: { type: 'json_object' }
    });

    const content = response?.content;
    if (!content) return null;

    try {
      const parsed = parseStructuredJsonObject(content);
      if (!parsed) return null;
      return {
        id: `plan-${Date.now()}`,
        originalObjective: objective,
        nodes: (parsed.nodes && typeof parsed.nodes === 'object') ? (parsed.nodes as Record<string, PlanNode>) : {},
        status: 'planning',
      };
    } catch (err) {
      console.error('TaskPlanner: Failed to parse DAG plan:', err);
      return null;
    }
  }

  private buildPlannerPrompt(objective: string, intentDecision?: IntentGatewayDecision): string {
    const allowedActionTypes = this.options.allowedActionTypes ?? BROKER_SAFE_PLANNER_ACTION_TYPES;
    const allowedActionTypeSet = new Set<PlanNode['actionType']>(allowedActionTypes);
    let prompt = `Objective: ${objective}\n`;
    if (intentDecision) {
      prompt += `Context/Intent: ${JSON.stringify(intentDecision)}\n`;
    }
    prompt += `
Please provide a JSON representation of an execution DAG (ExecutionPlan.nodes) to achieve this objective.
Structure the JSON as an object containing a "nodes" key, which is a dictionary of node IDs to PlanNode objects.
PlanNode structure:
{
  id: string,
  description: string,
  dependencies: string[] // Array of node IDs that must complete first
  actionType: ${allowedActionTypes.map((actionType) => `"${actionType}"`).join(' | ')},
  target: string // For tool_call use the exact brokered tool name. For execute_code use "code_remote_exec".
  inputPrompt: string // For tool_call this must be a JSON object string with tool arguments. For execute_code this must be one bounded remote command string.
}

This brokered runtime only supports the action types listed above.
${allowedActionTypeSet.has('tool_call') ? '- Prefer "tool_call" for file creation, directory creation, reading, writing, and other brokered tool orchestration. For example, use fs_mkdir and fs_write to create summary.md instead of embedding a script.\n' : ''}${allowedActionTypeSet.has('execute_code') ? '- Use "execute_code" only when you truly need one bounded remote shell command. Do not emit Python, Node, or shell script bodies as the inputPrompt; emit the exact command string that should run in the remote sandbox.\n' : ''}- Do not emit unsupported action types such as "skill_delegation", "routine_execution", or "delegate_task". They will be rejected by execution validation.
Return ONLY valid JSON.
`;
    return prompt;
  }
}
