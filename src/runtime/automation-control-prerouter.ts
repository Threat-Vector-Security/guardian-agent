import type { AgentContext, UserMessage } from '../agent/types.js';
import type { ToolExecutionRequest } from '../tools/types.js';
import type { IntentGatewayDecision } from './intent-gateway.js';

export interface AutomationControlPendingApprovalMetadata {
  id: string;
  toolName: string;
  argsPreview: string;
}

export interface AutomationControlPreRouteResult {
  content: string;
  metadata?: {
    pendingApprovals?: AutomationControlPendingApprovalMetadata[];
  };
}

type AutomationControlToolName =
  | 'workflow_list'
  | 'workflow_upsert'
  | 'workflow_delete'
  | 'workflow_run'
  | 'task_list'
  | 'task_update'
  | 'task_run'
  | 'task_delete';

interface AutomationControlPreRouteParams {
  agentId: string;
  message: UserMessage;
  checkAction?: AgentContext['checkAction'];
  executeTool: (
    toolName: AutomationControlToolName,
    args: Record<string, unknown>,
    request: Omit<ToolExecutionRequest, 'toolName' | 'args'>,
  ) => Promise<Record<string, unknown>>;
  trackPendingApproval?: (approvalId: string) => void;
  onPendingApproval?: (input: { approvalId: string; approved: string; denied: string }) => void;
  formatPendingApprovalPrompt?: (ids: string[]) => string;
  resolvePendingApprovalMetadata?: (ids: string[], fallback: AutomationControlPendingApprovalMetadata[]) => AutomationControlPendingApprovalMetadata[];
}

interface AutomationControlIntent {
  operation: 'delete' | 'toggle' | 'run' | 'inspect' | 'clone' | 'unknown';
  automationName?: string;
  enabled?: boolean;
}

interface AutomationCatalogEntry {
  id: string;
  name: string;
  description: string;
  kind: 'workflow' | 'assistant_task' | 'task';
  enabled: boolean;
  workflow?: Record<string, unknown>;
  task?: Record<string, unknown>;
}

export async function tryAutomationControlPreRoute(
  params: AutomationControlPreRouteParams,
  options?: { intentDecision?: IntentGatewayDecision | null },
): Promise<AutomationControlPreRouteResult | null> {
  const intent = resolveAutomationControlIntent(params.message.content, options?.intentDecision);
  if (!intent || intent.operation === 'clone' || intent.operation === 'unknown') return null;

  const toolRequest = toolRequestFor(params);
  const catalog = await listAutomationCatalog(params.executeTool, toolRequest);
  const selected = intent.automationName
    ? selectAutomationCatalogEntry(catalog, intent.automationName)
    : null;

  if (intent.operation === 'inspect') {
    return {
      content: renderAutomationInspectCopy(catalog, selected),
    };
  }

  if (!intent.automationName) {
    return {
      content: 'Tell me which automation you want to run, enable, disable, or delete.',
    };
  }

  if (!selected) {
    return {
      content: `I could not find an automation named '${intent.automationName}'.`,
    };
  }

  switch (intent.operation) {
    case 'run':
      return runAutomationEntry(params, toolRequest, selected);
    case 'toggle':
      return toggleAutomationEntry(params, toolRequest, selected, intent.enabled);
    case 'delete':
      return deleteAutomationEntry(params, toolRequest, selected);
    default:
      return null;
  }
}

function toolRequestFor(
  params: AutomationControlPreRouteParams,
): Omit<ToolExecutionRequest, 'toolName' | 'args'> {
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

async function listAutomationCatalog(
  executeTool: AutomationControlPreRouteParams['executeTool'],
  request: Omit<ToolExecutionRequest, 'toolName' | 'args'>,
): Promise<AutomationCatalogEntry[]> {
  const [workflowResult, taskResult] = await Promise.all([
    executeTool('workflow_list', {}, request),
    executeTool('task_list', {}, request),
  ]);

  const workflows = extractWorkflowSummaries(workflowResult);
  const tasks = extractTaskSummaries(taskResult);
  const matchedTaskIds = new Set<string>();
  const entries: AutomationCatalogEntry[] = [];

  for (const workflow of workflows) {
    const linkedTask = tasks.find((task) => (
      toString(task.type).toLowerCase() === 'workflow'
      && toString(task.target) === toString(workflow.id)
    ));
    if (linkedTask) {
      matchedTaskIds.add(toString(linkedTask.id));
    }
    entries.push({
      id: toString(workflow.id) || toString(linkedTask?.id),
      name: toString(workflow.name) || toString(linkedTask?.name) || 'Unnamed automation',
      description: toString(workflow.description),
      kind: 'workflow',
      enabled: workflow.enabled !== false,
      workflow,
      ...(linkedTask ? { task: linkedTask } : {}),
    });
  }

  for (const task of tasks) {
    const taskId = toString(task.id);
    if (!taskId || matchedTaskIds.has(taskId)) continue;
    entries.push({
      id: taskId,
      name: toString(task.name) || taskId,
      description: toString(task.description),
      kind: toString(task.type).toLowerCase() === 'agent' ? 'assistant_task' : 'task',
      enabled: task.enabled !== false,
      task,
    });
  }

  return entries.filter((entry) => entry.id && entry.name);
}

function extractWorkflowSummaries(result: Record<string, unknown>): Array<Record<string, unknown>> {
  if (!toBoolean(result.success)) return [];
  const output = isRecord(result.output) ? result.output : null;
  if (!output || !Array.isArray(output.workflows)) return [];
  return output.workflows.filter(isRecord);
}

function extractTaskSummaries(result: Record<string, unknown>): Array<Record<string, unknown>> {
  if (!toBoolean(result.success)) return [];
  const output = isRecord(result.output) ? result.output : null;
  if (!output || !Array.isArray(output.tasks)) return [];
  return output.tasks.filter(isRecord);
}

function resolveAutomationControlIntent(
  content: string,
  decision?: IntentGatewayDecision | null,
): AutomationControlIntent | null {
  if (decision) {
    const routed = resolveDecisionBackedIntent(decision);
    if (routed) return routed;
  }

  const trimmed = content.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  const hasAutomationContext = /\b(automations?|automation catalog|workflow(?:s)?|scheduled task|manual assistant automation|assistant automation|assistant task|task)\b/i.test(trimmed);
  if (/\b(list|show|what are)\b/.test(lower) && /\b(automations|automation catalog|workflows|scheduled tasks)\b/.test(lower)) {
    return { operation: 'inspect' };
  }

  const automationName = extractAutomationReference(trimmed);
  if (hasAutomationContext && /\b(delete|remove)\b/i.test(trimmed)) {
    return { operation: 'delete', automationName };
  }
  if (hasAutomationContext && /\b(run|execute|start)\b/i.test(trimmed)) {
    return { operation: 'run', automationName };
  }
  if (hasAutomationContext && /\b(enable|turn on)\b/i.test(trimmed)) {
    return { operation: 'toggle', automationName, enabled: true };
  }
  if (hasAutomationContext && /\b(disable|turn off)\b/i.test(trimmed)) {
    return { operation: 'toggle', automationName, enabled: false };
  }
  if (hasAutomationContext && /\btoggle\b/i.test(trimmed)) {
    return { operation: 'toggle', automationName };
  }
  if (hasAutomationContext && /\b(show|inspect|details?|status)\b/i.test(trimmed)) {
    return { operation: 'inspect', automationName };
  }
  return null;
}

function resolveDecisionBackedIntent(
  decision: IntentGatewayDecision,
): AutomationControlIntent | null {
  const route = decision.route;
  const automationsSurface = decision.entities.uiSurface === 'automations';
  if (route !== 'automation_control' && !(route === 'ui_control' && automationsSurface)) {
    return null;
  }

  if (!['delete', 'toggle', 'run', 'inspect', 'clone'].includes(decision.operation)) {
    return null;
  }

  return {
    operation: decision.operation as AutomationControlIntent['operation'],
    automationName: decision.entities.automationName,
    ...(typeof decision.entities.enabled === 'boolean'
      ? { enabled: decision.entities.enabled }
      : {}),
  };
}

function extractAutomationReference(text: string): string | undefined {
  const quoted = text.match(/\b(?:automation|workflow|task)\b[\s\S]{0,40}\b(?:called|named)\s+["'`]([^"'`]+)["'`]/i)
    ?? text.match(/\b(?:delete|remove|run|execute|start|enable|disable|toggle|inspect|show)\s+["'`]([^"'`]+)["'`]/i);
  if (quoted?.[1]?.trim()) {
    return quoted[1].trim();
  }

  const titled = text.match(/\b(?:delete|remove|run|execute|start|enable|disable|toggle|inspect|show)\s+([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,7})\b/);
  if (titled?.[1]?.trim()) {
    return titled[1].trim();
  }
  return undefined;
}

function selectAutomationCatalogEntry(
  catalog: AutomationCatalogEntry[],
  requestedName: string,
): AutomationCatalogEntry | null {
  const normalized = normalizeLookupKey(requestedName);
  const exact = catalog.find((entry) => normalizeLookupKey(entry.name) === normalized || normalizeLookupKey(entry.id) === normalized);
  if (exact) return exact;

  const partial = catalog.filter((entry) => normalizeLookupKey(entry.name).includes(normalized) || normalizeLookupKey(entry.id).includes(normalized));
  return partial.length === 1 ? partial[0] : null;
}

function renderAutomationInspectCopy(
  catalog: AutomationCatalogEntry[],
  selected: AutomationCatalogEntry | null,
): string {
  if (selected) {
    const lines = [
      `${selected.name} (${selected.kind === 'workflow' ? 'workflow' : selected.kind === 'assistant_task' ? 'assistant automation' : 'task'})`,
      `Enabled: ${selected.enabled ? 'yes' : 'no'}`,
    ];
    const cron = toString(selected.task?.cron);
    const eventType = readEventType(selected.task);
    if (cron) lines.push(`Schedule: ${cron}`);
    else if (eventType) lines.push(`Trigger: ${eventType}`);
    else lines.push('Schedule: manual');
    if (selected.description) lines.push(`Description: ${selected.description}`);
    if (selected.kind === 'workflow') {
      const steps = Array.isArray(selected.workflow?.steps)
        ? selected.workflow.steps.filter(isRecord).slice(0, 8)
        : [];
      if (steps.length > 0) {
        lines.push('Steps:');
        for (const step of steps) {
          lines.push(`- ${toString(step.name) || toString(step.toolName) || toString(step.id) || 'step'}`);
        }
      }
    }
    return lines.join('\n');
  }

  if (catalog.length === 0) {
    return 'There are no saved automations.';
  }

  const lines = [`Saved automations (${catalog.length}):`];
  for (const entry of catalog.slice(0, 20)) {
    const schedule = toString(entry.task?.cron) || readEventType(entry.task) || 'manual';
    lines.push(`- ${entry.name} [${entry.kind === 'workflow' ? 'workflow' : entry.kind === 'assistant_task' ? 'assistant' : 'task'} · ${entry.enabled ? 'enabled' : 'disabled'} · ${schedule}]`);
  }
  if (catalog.length > 20) {
    lines.push(`- ...and ${catalog.length - 20} more`);
  }
  return lines.join('\n');
}

async function runAutomationEntry(
  params: AutomationControlPreRouteParams,
  toolRequest: Omit<ToolExecutionRequest, 'toolName' | 'args'>,
  entry: AutomationCatalogEntry,
): Promise<AutomationControlPreRouteResult> {
  const toolName = entry.workflow ? 'workflow_run' : 'task_run';
  const args = entry.workflow
    ? { workflowId: toString(entry.workflow.id) }
    : { taskId: toString(entry.task?.id) };
  const result = await params.executeTool(toolName, args, toolRequest);
  return formatSingleAutomationMutationResult(
    params,
    result,
    toolName,
    args,
    entry.name,
    `I ran '${entry.name}'.`,
    `I did not run '${entry.name}'.`,
    `I ran '${entry.name}'.`,
  );
}

async function toggleAutomationEntry(
  params: AutomationControlPreRouteParams,
  toolRequest: Omit<ToolExecutionRequest, 'toolName' | 'args'>,
  entry: AutomationCatalogEntry,
  desiredEnabled?: boolean,
): Promise<AutomationControlPreRouteResult> {
  const enabled = typeof desiredEnabled === 'boolean' ? desiredEnabled : !entry.enabled;
  if (entry.workflow) {
    const workflowArgs = buildWorkflowToggleArgs(entry.workflow, enabled);
    const result = await params.executeTool('workflow_upsert', workflowArgs, toolRequest);
    return formatSingleAutomationMutationResult(
      params,
      result,
      'workflow_upsert',
      workflowArgs,
      entry.name,
      enabled ? `I enabled '${entry.name}'.` : `I disabled '${entry.name}'.`,
      enabled ? `I did not enable '${entry.name}'.` : `I did not disable '${entry.name}'.`,
      enabled ? `Enabled '${entry.name}'.` : `Disabled '${entry.name}'.`,
    );
  }

  const taskId = toString(entry.task?.id);
  const args = { taskId, enabled };
  const result = await params.executeTool('task_update', args, toolRequest);
  return formatSingleAutomationMutationResult(
    params,
    result,
    'task_update',
    args,
    entry.name,
    enabled ? `I enabled '${entry.name}'.` : `I disabled '${entry.name}'.`,
    enabled ? `I did not enable '${entry.name}'.` : `I did not disable '${entry.name}'.`,
    enabled ? `Enabled '${entry.name}'.` : `Disabled '${entry.name}'.`,
  );
}

function buildWorkflowToggleArgs(
  workflow: Record<string, unknown>,
  enabled: boolean,
): Record<string, unknown> {
  const outputHandling = isRecord(workflow.outputHandling) ? workflow.outputHandling : undefined;
  return {
    id: toString(workflow.id),
    name: toString(workflow.name),
    mode: toString(workflow.mode) || 'sequential',
    description: toString(workflow.description),
    enabled,
    ...(toString(workflow.schedule) ? { schedule: toString(workflow.schedule) } : {}),
    ...(outputHandling ? { outputHandling } : {}),
    steps: Array.isArray(workflow.steps)
      ? workflow.steps.filter(isRecord).map((step) => ({ ...step }))
      : [],
  };
}

async function deleteAutomationEntry(
  params: AutomationControlPreRouteParams,
  toolRequest: Omit<ToolExecutionRequest, 'toolName' | 'args'>,
  entry: AutomationCatalogEntry,
): Promise<AutomationControlPreRouteResult> {
  const messages: string[] = [];
  const pendingIds: string[] = [];
  const pendingFallback: AutomationControlPendingApprovalMetadata[] = [];

  if (entry.task) {
    const taskId = toString(entry.task.id);
    const taskResult = await params.executeTool('task_delete', { taskId }, toolRequest);
    const taskPending = collectPendingMutation(
      params,
      taskResult,
      'task_delete',
      { taskId },
      `I deleted '${entry.name}'.`,
      `I did not delete '${entry.name}'.`,
      pendingFallback,
    );
    pendingIds.push(...taskPending.pendingIds);
    if (taskPending.message) messages.push(taskPending.message);
  }

  if (entry.workflow) {
    const workflowId = toString(entry.workflow.id);
    const workflowResult = await params.executeTool('workflow_delete', { workflowId }, toolRequest);
    const workflowPending = collectPendingMutation(
      params,
      workflowResult,
      'workflow_delete',
      { workflowId },
      `I deleted '${entry.name}'.`,
      `I did not delete '${entry.name}'.`,
      pendingFallback,
    );
    pendingIds.push(...workflowPending.pendingIds);
    if (workflowPending.message) messages.push(workflowPending.message);
  }

  if (pendingIds.length > 0) {
    const prompt = params.formatPendingApprovalPrompt
      ? params.formatPendingApprovalPrompt(pendingIds)
      : 'This action needs approval before I can continue.';
    const resolvedPending = params.resolvePendingApprovalMetadata
      ? params.resolvePendingApprovalMetadata(pendingIds, pendingFallback)
      : pendingFallback;
    return {
      content: [
        `I prepared deletion of '${entry.name}'.`,
        ...messages.filter(Boolean),
        prompt,
      ].filter(Boolean).join('\n\n'),
      metadata: resolvedPending.length > 0 ? { pendingApprovals: resolvedPending } : undefined,
    };
  }

  const failures = messages.filter((line) => /^Failed:/i.test(line));
  if (failures.length > 0) {
    return {
      content: failures.join('\n'),
    };
  }

  return {
    content: `Deleted '${entry.name}'.`,
  };
}

function formatSingleAutomationMutationResult(
  params: AutomationControlPreRouteParams,
  result: Record<string, unknown>,
  toolName: 'workflow_upsert' | 'workflow_run' | 'task_update' | 'task_run',
  args: Record<string, unknown>,
  automationName: string,
  approvedCopy: string,
  deniedCopy: string,
  successCopy: string,
): AutomationControlPreRouteResult {
  const pendingFallback: AutomationControlPendingApprovalMetadata[] = [];
  const pending = collectPendingMutation(
    params,
    result,
    toolName,
    args,
    approvedCopy,
    deniedCopy,
    pendingFallback,
  );
  if (pending.pendingIds.length > 0) {
    const prompt = params.formatPendingApprovalPrompt
      ? params.formatPendingApprovalPrompt(pending.pendingIds)
      : 'This action needs approval before I can continue.';
    const resolvedPending = params.resolvePendingApprovalMetadata
      ? params.resolvePendingApprovalMetadata(pending.pendingIds, pendingFallback)
      : pendingFallback;
    return {
      content: [
        `I prepared the requested change for '${automationName}'.`,
        prompt,
      ].filter(Boolean).join('\n\n'),
      metadata: resolvedPending.length > 0 ? { pendingApprovals: resolvedPending } : undefined,
    };
  }

  if (!toBoolean(result.success)) {
    return {
      content: pending.message || `I could not update '${automationName}'.`,
    };
  }

  return {
    content: extractSuccessMessage(result) || successCopy,
  };
}

function collectPendingMutation(
  params: AutomationControlPreRouteParams,
  result: Record<string, unknown>,
  toolName: 'workflow_upsert' | 'workflow_delete' | 'workflow_run' | 'task_update' | 'task_run' | 'task_delete',
  args: Record<string, unknown>,
  approvedCopy: string,
  deniedCopy: string,
  fallback: AutomationControlPendingApprovalMetadata[],
): { pendingIds: string[]; message?: string } {
  if (toString(result.status) !== 'pending_approval') {
    if (!toBoolean(result.success)) {
      const msg = extractFailureMessage(result);
      return { pendingIds: [], message: msg ? `Failed: ${msg}` : 'Failed.' };
    }
    return { pendingIds: [] };
  }

  const approvalId = toString(result.approvalId);
  if (!approvalId) {
    return { pendingIds: [], message: 'The request is waiting for approval, but no approval id was returned.' };
  }

  params.trackPendingApproval?.(approvalId);
  params.onPendingApproval?.({
    approvalId,
    approved: approvedCopy,
    denied: deniedCopy,
  });
  fallback.push({
    id: approvalId,
    toolName,
    argsPreview: JSON.stringify(args).slice(0, 160),
  });
  return { pendingIds: [approvalId] };
}

function extractSuccessMessage(result: Record<string, unknown>): string {
  const direct = toString(result.message).trim();
  if (direct) return direct;
  const output = isRecord(result.output) ? result.output : null;
  return output ? toString(output.message).trim() : '';
}

function extractFailureMessage(result: Record<string, unknown>): string {
  const direct = toString(result.message).trim();
  if (direct) return direct;
  const error = toString(result.error).trim();
  if (error) return error;
  const output = isRecord(result.output) ? result.output : null;
  return output ? toString(output.message).trim() : '';
}

function readEventType(task: Record<string, unknown> | undefined): string {
  if (!task) return '';
  const eventTrigger = isRecord(task.eventTrigger) ? task.eventTrigger : null;
  return eventTrigger ? toString(eventTrigger.eventType) : '';
}

function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toBoolean(value: unknown): boolean {
  return value === true;
}
