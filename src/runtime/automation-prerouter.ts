import type { AgentContext, UserMessage } from '../agent/types.js';
import {
  buildTaskUpdateForCompiledAutomation,
  compileAutomationAuthoringRequest,
  findMatchingScheduledAutomationTask,
  type ExistingAutomationTask,
} from './automation-authoring.js';
import {
  formatAutomationValidationFailure,
  validateAutomationCompilation,
  type AutomationValidationResult,
} from './automation-validation.js';
import type { ToolExecutionRequest } from '../tools/types.js';

export interface AutomationPendingApprovalMetadata {
  id: string;
  toolName: string;
  argsPreview: string;
}

export interface AutomationPreRouteResult {
  content: string;
  metadata?: {
    pendingApprovals?: AutomationPendingApprovalMetadata[];
    resumeAutomationAfterApprovals?: boolean;
  };
}

interface AutomationPreRouteParams {
  agentId: string;
  message: UserMessage;
  checkAction?: AgentContext['checkAction'];
  preflightTools?: (requests: Array<{ name: string; args?: Record<string, unknown> }>) => Array<{
    name: string;
    found: boolean;
    decision: 'allow' | 'deny' | 'require_approval';
    reason: string;
    fixes: Array<{ type: 'tool_policy' | 'path' | 'command' | 'domain'; value: string; description: string }>;
  }>;
  workspaceRoot?: string;
  allowedPaths?: string[];
  executeTool: (
    toolName: 'task_list' | 'task_create' | 'task_update' | 'workflow_upsert' | 'update_tool_policy',
    args: Record<string, unknown>,
    request: Omit<ToolExecutionRequest, 'toolName' | 'args'>,
  ) => Promise<Record<string, unknown>>;
  trackPendingApproval?: (approvalId: string) => void;
  onPendingApproval?: (input: {
    approvalId: string;
    toolName: 'task_create' | 'task_update' | 'workflow_upsert';
    automationName: string;
    verb: 'created' | 'updated';
  }) => void;
  formatPendingApprovalPrompt?: (ids: string[]) => string;
  resolvePendingApprovalMetadata?: (ids: string[], fallback: AutomationPendingApprovalMetadata[]) => AutomationPendingApprovalMetadata[];
}

export async function tryAutomationPreRoute(
  params: AutomationPreRouteParams,
  options?: { allowRemediation?: boolean },
): Promise<AutomationPreRouteResult | null> {
  const compilation = compileAutomationAuthoringRequest(params.message.content, {
    channel: params.message.channel,
    userId: params.message.userId,
  });
  if (!compilation) return null;

  if (params.preflightTools) {
    const validation = validateAutomationCompilation(
      compilation,
      params.message.content,
      params.preflightTools,
      { workspaceRoot: params.workspaceRoot, allowedPaths: params.allowedPaths },
    );
    if (!validation.ok) {
      if (options?.allowRemediation !== false) {
        const remediated = await tryAutomationRemediation(params, compilation.name, validation, toolRequestFor(params));
        if (remediated) return remediated;
      }
      return {
        content: formatAutomationValidationFailure(compilation, validation),
      };
    }
  }

  const toolRequest: Omit<ToolExecutionRequest, 'toolName' | 'args'> = {
    ...toolRequestFor(params),
  };

  if (compilation.shape === 'scheduled_agent' && compilation.taskCreate) {
    const existingTasks = await listExistingAutomationTasks(params.executeTool, toolRequest);
    const matchedTask = findMatchingScheduledAutomationTask(existingTasks, compilation);
    const toolName = matchedTask ? 'task_update' : 'task_create';
    const args = matchedTask
      ? buildTaskUpdateForCompiledAutomation(matchedTask.id, compilation, {
          channel: params.message.channel,
          userId: params.message.userId,
        })
      : compilation.taskCreate;
    if (!args) return null;

    const toolResult = await params.executeTool(toolName, args as unknown as Record<string, unknown>, toolRequest);
    return formatAutomationPreRouteResult({
      toolName,
      automationName: compilation.name,
      cron: compilation.schedule?.cron,
      toolResult,
      verb: matchedTask ? 'updated' : 'created',
      argsPreview: JSON.stringify(args).slice(0, 160),
      onPendingApproval: params.onPendingApproval,
      trackPendingApproval: params.trackPendingApproval,
      formatPendingApprovalPrompt: params.formatPendingApprovalPrompt,
      resolvePendingApprovalMetadata: params.resolvePendingApprovalMetadata,
    });
  }

  if (compilation.workflowUpsert) {
    const toolResult = await params.executeTool(
      'workflow_upsert',
      compilation.workflowUpsert as unknown as Record<string, unknown>,
      toolRequest,
    );
    return formatAutomationPreRouteResult({
      toolName: 'workflow_upsert',
      automationName: compilation.name,
      cron: compilation.schedule?.cron,
      toolResult,
      verb: 'created',
      argsPreview: JSON.stringify(compilation.workflowUpsert).slice(0, 160),
      onPendingApproval: params.onPendingApproval,
      trackPendingApproval: params.trackPendingApproval,
      formatPendingApprovalPrompt: params.formatPendingApprovalPrompt,
      resolvePendingApprovalMetadata: params.resolvePendingApprovalMetadata,
    });
  }

  return null;
}

function toolRequestFor(params: AutomationPreRouteParams): Omit<ToolExecutionRequest, 'toolName' | 'args'> {
  return {
    origin: 'assistant',
    agentId: params.agentId,
    userId: params.message.userId,
    principalId: params.message.principalId,
    principalRole: params.message.principalRole,
    channel: params.message.channel,
    requestId: params.message.id,
    agentContext: params.checkAction ? { checkAction: params.checkAction } : undefined,
  };
}

async function listExistingAutomationTasks(
  executeTool: AutomationPreRouteParams['executeTool'],
  request: Omit<ToolExecutionRequest, 'toolName' | 'args'>,
): Promise<ExistingAutomationTask[]> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await executeTool('task_list', {}, request);
    if (!toBoolean(result.success)) return [];
    const output = isRecord(result.output) ? result.output : null;
    if (!output || !Array.isArray(output.tasks)) return [];
    const tasks = output.tasks
      .map((task) => (isRecord(task) ? task : null))
      .filter((task): task is Record<string, unknown> => Boolean(task))
      .map((task) => ({
        id: toString(task.id),
        name: toString(task.name),
        type: toString(task.type),
        target: toString(task.target),
        cron: toString(task.cron),
        prompt: toString(task.prompt) || undefined,
        channel: toString(task.channel) || undefined,
        userId: toString(task.userId) || undefined,
        deliver: typeof task.deliver === 'boolean' ? task.deliver : undefined,
      }))
      .filter((task) => Boolean(task.id && task.name && task.type && task.target && task.cron));
    if (tasks.length > 0 || attempt === 2) {
      return tasks;
    }
    await sleep(100);
  }
  return [];
}

function formatAutomationPreRouteResult(input: {
  toolName: 'task_create' | 'task_update' | 'workflow_upsert';
  automationName: string;
  cron: string | undefined;
  toolResult: Record<string, unknown>;
  verb: 'created' | 'updated';
  argsPreview: string;
  onPendingApproval?: AutomationPreRouteParams['onPendingApproval'];
  trackPendingApproval?: AutomationPreRouteParams['trackPendingApproval'];
  formatPendingApprovalPrompt?: AutomationPreRouteParams['formatPendingApprovalPrompt'];
  resolvePendingApprovalMetadata?: AutomationPreRouteParams['resolvePendingApprovalMetadata'];
}): AutomationPreRouteResult {
  if (!toBoolean(input.toolResult.success)) {
    const status = toString(input.toolResult.status);
    if (status === 'pending_approval') {
      const approvalId = toString(input.toolResult.approvalId);
      if (approvalId) {
        input.trackPendingApproval?.(approvalId);
        input.onPendingApproval?.({
          approvalId,
          toolName: input.toolName,
          automationName: input.automationName,
          verb: input.verb,
        });
      }
      const summary = input.toolName === 'workflow_upsert'
        ? `I prepared the native Guardian workflow '${input.automationName}'${input.cron ? ` on ${input.cron}` : ''}.`
        : `I prepared the native Guardian scheduled assistant task '${input.automationName}'${input.cron ? ` on ${input.cron}` : ''}.`;
      const fallback = approvalId
        ? [{
            id: approvalId,
            toolName: input.toolName,
            argsPreview: input.argsPreview,
          }]
        : [];
      const pendingApprovals = input.resolvePendingApprovalMetadata
        ? input.resolvePendingApprovalMetadata(approvalId ? [approvalId] : [], fallback)
        : fallback;
      const prompt = input.formatPendingApprovalPrompt
        ? input.formatPendingApprovalPrompt(approvalId ? [approvalId] : [])
        : 'This action needs approval before I can continue.';
      return {
        content: [summary, prompt].filter(Boolean).join('\n\n'),
        metadata: pendingApprovals.length > 0 ? { pendingApprovals } : undefined,
      };
    }
    const msg = toString(input.toolResult.message) || 'Automation change failed.';
    return {
      content: `I tried to ${input.verb === 'updated' ? 'update' : 'create'} '${input.automationName}', but it failed: ${msg}`,
    };
  }

  if (input.toolName === 'workflow_upsert') {
    return {
      content: toString(input.toolResult.message) || `Workflow '${input.automationName}' ${input.verb}.`,
    };
  }
  if (input.toolName === 'task_update') {
    return {
      content: `Updated scheduled assistant task '${input.automationName}'${input.cron ? ` on ${input.cron}` : ''}.`,
    };
  }
  return {
    content: `Created scheduled assistant task '${input.automationName}'${input.cron ? ` on ${input.cron}` : ''}.`,
  };
}

async function tryAutomationRemediation(
  params: AutomationPreRouteParams,
  automationName: string,
  validation: AutomationValidationResult,
  toolRequest: Omit<ToolExecutionRequest, 'toolName' | 'args'>,
): Promise<AutomationPreRouteResult | null> {
  const fixes = uniqueAutomationFixes(validation.issues.flatMap((issue) => issue.fixes ?? []));
  const remediationSteps = fixes
    .map((fix) => toPolicyRemediation(fix))
    .filter((fix): fix is { action: string; value: string; description: string } => Boolean(fix));
  if (remediationSteps.length === 0) return null;

  const pendingIds: string[] = [];
  const fallbackMetadata: AutomationPendingApprovalMetadata[] = [];
  let appliedAny = false;

  for (const step of remediationSteps) {
    const result = await params.executeTool(
      'update_tool_policy',
      { action: step.action, value: step.value },
      toolRequest,
    );
    if (!toBoolean(result.success)) {
      const approvalId = toString(result.approvalId);
      const status = toString(result.status);
      if (status === 'pending_approval' && approvalId) {
        pendingIds.push(approvalId);
        params.trackPendingApproval?.(approvalId);
        fallbackMetadata.push({
          id: approvalId,
          toolName: 'update_tool_policy',
          argsPreview: JSON.stringify({ action: step.action, value: step.value }),
        });
        continue;
      }
      continue;
    }
    appliedAny = true;
  }

  if (pendingIds.length > 0) {
    const summary = `I found fixable policy blockers for '${automationName}' and prepared the required policy changes so I can continue once you approve them.`;
    const pendingApprovals = params.resolvePendingApprovalMetadata
      ? params.resolvePendingApprovalMetadata(pendingIds, fallbackMetadata)
      : fallbackMetadata;
    const prompt = params.formatPendingApprovalPrompt
      ? params.formatPendingApprovalPrompt(pendingIds)
      : 'This action needs approval before I can continue.';
    return {
      content: [summary, prompt].filter(Boolean).join('\n\n'),
      metadata: {
        pendingApprovals,
        resumeAutomationAfterApprovals: true,
      },
    };
  }

  if (!appliedAny) return null;

  return tryAutomationPreRoute(params, { allowRemediation: false });
}

function uniqueAutomationFixes(
  fixes: Array<{ type: 'tool_policy' | 'path' | 'command' | 'domain'; value: string; description: string }>,
): Array<{ type: 'tool_policy' | 'path' | 'command' | 'domain'; value: string; description: string }> {
  const seen = new Set<string>();
  const deduped: Array<{ type: 'tool_policy' | 'path' | 'command' | 'domain'; value: string; description: string }> = [];
  for (const fix of fixes) {
    const key = `${fix.type}:${fix.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(fix);
  }
  return deduped;
}

function toPolicyRemediation(
  fix: { type: 'tool_policy' | 'path' | 'command' | 'domain'; value: string; description: string },
): { action: string; value: string; description: string } | null {
  switch (fix.type) {
    case 'path':
      return { action: 'add_path', value: fix.value, description: fix.description };
    case 'domain':
      return { action: 'add_domain', value: fix.value, description: fix.description };
    case 'command':
      return { action: 'add_command', value: fix.value, description: fix.description };
    case 'tool_policy':
      return { action: 'set_tool_policy_auto', value: fix.value, description: fix.description };
    default:
      return null;
  }
}

function toString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toBoolean(value: unknown): boolean {
  return value === true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
