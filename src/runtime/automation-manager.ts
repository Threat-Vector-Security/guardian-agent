import type { AssistantConnectorPlaybookDefinition } from '../config/types.js';
import type { ScheduledTaskDefinition } from './scheduled-tasks.js';
import { buildSavedAutomationCatalogEntries, type SavedAutomationCatalogEntry } from './automation-catalog.js';

export type SavedAutomationOperationKind =
  | 'set_workflow_enabled'
  | 'set_task_enabled'
  | 'delete_workflow'
  | 'delete_task'
  | 'run_workflow'
  | 'run_task';

export interface SavedAutomationOperation {
  kind: SavedAutomationOperationKind;
  args: Record<string, unknown>;
}

export interface AutomationManagerControlPlane {
  listWorkflows(): AssistantConnectorPlaybookDefinition[];
  listTasks(): ScheduledTaskDefinition[];
  upsertWorkflow(workflow: AssistantConnectorPlaybookDefinition): { success: boolean; message: string };
  updateTask(id: string, input: Record<string, unknown>): { success: boolean; message: string };
  deleteWorkflow(id: string): { success: boolean; message: string };
  deleteTask(id: string): { success: boolean; message: string };
  runWorkflow(input: {
    workflowId: string;
    dryRun?: boolean;
    origin?: 'assistant' | 'cli' | 'web';
    agentId?: string;
    userId?: string;
    channel?: string;
    requestedBy?: string;
  }): Promise<unknown> | unknown;
  runTask(id: string): Promise<unknown> | unknown;
}

export function listSavedAutomations(controlPlane: AutomationManagerControlPlane): SavedAutomationCatalogEntry[] {
  return buildSavedAutomationCatalogEntries(
    controlPlane.listWorkflows().map(cloneWorkflow),
    controlPlane.listTasks().map(cloneTask),
  );
}

export function getSavedAutomationById(
  controlPlane: AutomationManagerControlPlane,
  automationId: string,
): SavedAutomationCatalogEntry | null {
  const normalized = automationId.trim();
  if (!normalized) return null;
  return listSavedAutomations(controlPlane).find((entry) => entry.id === normalized) ?? null;
}

export function setSavedAutomationEnabled(
  controlPlane: AutomationManagerControlPlane,
  automationId: string,
  enabled: boolean,
): { success: boolean; message: string } {
  const selected = getSavedAutomationById(controlPlane, automationId);
  if (!selected) {
    return { success: false, message: `Automation '${automationId}' not found.` };
  }

  const planned = planSavedAutomationToggle(selected, enabled);
  const [operation] = planned.operations;
  if (!operation) {
    return { success: false, message: `Automation '${automationId}' cannot be toggled.` };
  }
  const result = executeMutationOperation(controlPlane, operation);
  if (!result.success) {
    return result;
  }
  return {
    success: true,
    message: enabled ? `Enabled '${selected.name}'.` : `Disabled '${selected.name}'.`,
  };
}

export function deleteSavedAutomation(
  controlPlane: AutomationManagerControlPlane,
  automationId: string,
): { success: boolean; message: string } {
  const selected = getSavedAutomationById(controlPlane, automationId);
  if (!selected) {
    return { success: false, message: `Automation '${automationId}' not found.` };
  }

  const planned = planSavedAutomationDelete(selected);
  const failures: string[] = [];
  for (const operation of planned.operations) {
    const taskResult = executeMutationOperation(controlPlane, operation);
    if (!taskResult.success) {
      const targetId = toNonEmptyString(operation.args.taskId)
        || toNonEmptyString(operation.args.workflowId)
        || selected.id;
      failures.push(taskResult.message || `Could not delete '${targetId}'.`);
    }
  }

  if (failures.length > 0) {
    return { success: false, message: failures.join(' ') };
  }

  return { success: true, message: `Deleted '${selected.name}'.` };
}

export async function runSavedAutomation(
  controlPlane: AutomationManagerControlPlane,
  automationId: string,
  options?: {
    dryRun?: boolean;
    origin?: 'assistant' | 'cli' | 'web';
    agentId?: string;
    userId?: string;
    channel?: string;
    requestedBy?: string;
  },
): Promise<Record<string, unknown>> {
  const selected = getSavedAutomationById(controlPlane, automationId);
  if (!selected) {
    return { success: false, message: `Automation '${automationId}' not found.` };
  }

  const planned = planSavedAutomationRun(selected);
  const [operation] = planned.operations;
  if (!operation) {
    return { success: false, message: `Automation '${automationId}' cannot be run.` };
  }

  const result = await executeAsyncMutationOperation(controlPlane, operation, options);
  return isRecord(result)
    ? normalizeAutomationRunResult(selected, result)
    : { success: false, message: 'Automation run returned an invalid result.' };
}

export function planSavedAutomationRun(
  entry: SavedAutomationCatalogEntry,
): { entry: SavedAutomationCatalogEntry; operations: SavedAutomationOperation[] } {
  if (entry.workflow) {
    return {
      entry,
      operations: [{
        kind: 'run_workflow',
        args: {
          workflowId: entry.workflow.id,
        },
      }],
    };
  }

  const taskId = toNonEmptyString(entry.task?.id);
  return {
    entry,
    operations: taskId
      ? [{ kind: 'run_task', args: { taskId } }]
      : [],
  };
}

export function planSavedAutomationToggle(
  entry: SavedAutomationCatalogEntry,
  desiredEnabled?: boolean,
): {
  entry: SavedAutomationCatalogEntry;
  enabled: boolean;
  operations: SavedAutomationOperation[];
} {
  const enabled = typeof desiredEnabled === 'boolean' ? desiredEnabled : !entry.enabled;
  if (entry.workflow) {
    return {
      entry,
      enabled,
      operations: [{
        kind: 'set_workflow_enabled',
        args: buildWorkflowToggleArgs(entry.workflow, enabled),
      }],
    };
  }

  const taskId = toNonEmptyString(entry.task?.id);
  return {
    entry,
    enabled,
    operations: taskId
      ? [{ kind: 'set_task_enabled', args: { taskId, enabled } }]
      : [],
  };
}

export function planSavedAutomationDelete(
  entry: SavedAutomationCatalogEntry,
): { entry: SavedAutomationCatalogEntry; operations: SavedAutomationOperation[] } {
  const operations: SavedAutomationOperation[] = [];
  const taskId = toNonEmptyString(entry.task?.id);
  const workflowId = toNonEmptyString(entry.workflow?.id);
  if (taskId) {
    operations.push({ kind: 'delete_task', args: { taskId } });
  }
  if (workflowId) {
    operations.push({ kind: 'delete_workflow', args: { workflowId } });
  }
  return { entry, operations };
}

export function buildWorkflowToggleArgs(
  workflow: AssistantConnectorPlaybookDefinition,
  enabled: boolean,
): Record<string, unknown> {
  return {
    ...cloneWorkflow(workflow),
    enabled,
  };
}

function cloneWorkflow(workflow: AssistantConnectorPlaybookDefinition): AssistantConnectorPlaybookDefinition {
  return {
    ...workflow,
    steps: workflow.steps.map((step) => ({ ...step })),
    ...(workflow.outputHandling ? { outputHandling: { ...workflow.outputHandling } } : {}),
  };
}

function cloneTask(task: ScheduledTaskDefinition): ScheduledTaskDefinition {
  return {
    ...task,
    ...(task.args ? { args: { ...task.args } } : {}),
    ...(task.eventTrigger ? { eventTrigger: { ...task.eventTrigger } } : {}),
    ...(task.outputHandling ? { outputHandling: { ...task.outputHandling } } : {}),
  };
}

function executeMutationOperation(
  controlPlane: AutomationManagerControlPlane,
  operation: SavedAutomationOperation,
): { success: boolean; message: string } {
  switch (operation.kind) {
    case 'set_workflow_enabled':
      return controlPlane.upsertWorkflow(operation.args as unknown as AssistantConnectorPlaybookDefinition);
    case 'set_task_enabled': {
      const taskId = toNonEmptyString(operation.args.taskId) || '';
      const { taskId: _taskId, ...input } = operation.args;
      return controlPlane.updateTask(taskId, input);
    }
    case 'delete_workflow':
      return controlPlane.deleteWorkflow(toNonEmptyString(operation.args.workflowId) || '');
    case 'delete_task':
      return controlPlane.deleteTask(toNonEmptyString(operation.args.taskId) || '');
    default:
      return { success: false, message: `Mutation '${operation.kind}' is not supported in direct control.` };
  }
}

async function executeAsyncMutationOperation(
  controlPlane: AutomationManagerControlPlane,
  operation: SavedAutomationOperation,
  options?: {
    dryRun?: boolean;
    origin?: 'assistant' | 'cli' | 'web';
    agentId?: string;
    userId?: string;
    channel?: string;
    requestedBy?: string;
  },
): Promise<unknown> {
  switch (operation.kind) {
    case 'run_workflow':
      return controlPlane.runWorkflow({
        workflowId: toNonEmptyString(operation.args.workflowId) || '',
        dryRun: options?.dryRun === true,
        origin: options?.origin,
        agentId: options?.agentId,
        userId: options?.userId,
        channel: options?.channel,
        requestedBy: options?.requestedBy,
      });
    case 'run_task':
      return controlPlane.runTask(toNonEmptyString(operation.args.taskId) || '');
    default:
      return { success: false, message: `Run '${operation.kind}' is not supported in direct control.` };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeAutomationRunResult(
  entry: SavedAutomationCatalogEntry,
  result: Record<string, unknown>,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...result };
  if (normalized.success === true) {
    normalized.message = `Ran '${entry.name}'.`;
  }
  if (!entry.workflow) {
    return normalized;
  }

  const run = isRecord(result.run) ? result.run : null;
  if (!run) {
    return normalized;
  }

  normalized.run = {
    ...run,
    automationId: toNonEmptyString(run.automationId) || toNonEmptyString(run.playbookId) || entry.id,
    automationName: toNonEmptyString(run.automationName) || toNonEmptyString(run.playbookName) || entry.name,
    source: 'automation',
  };
  return normalized;
}

function toNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
