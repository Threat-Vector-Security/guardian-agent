import type { AssistantConnectorPlaybookDefinition } from '../config/types.js';
import type { ScheduledTaskDefinition } from './scheduled-tasks.js';
import { buildSavedAutomationCatalogEntries, type SavedAutomationCatalogEntry } from './automation-catalog.js';

export type SavedAutomationMutationToolName =
  | 'workflow_upsert'
  | 'workflow_delete'
  | 'workflow_run'
  | 'task_update'
  | 'task_run'
  | 'task_delete';

export interface SavedAutomationMutationOperation {
  toolName: SavedAutomationMutationToolName;
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
  return executeMutationOperation(controlPlane, operation);
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
    ? result
    : { success: false, message: 'Automation run returned an invalid result.' };
}

export function planSavedAutomationRun(
  entry: SavedAutomationCatalogEntry,
): { entry: SavedAutomationCatalogEntry; operations: SavedAutomationMutationOperation[] } {
  if (entry.workflow) {
    return {
      entry,
      operations: [{
        toolName: 'workflow_run',
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
      ? [{ toolName: 'task_run', args: { taskId } }]
      : [],
  };
}

export function planSavedAutomationToggle(
  entry: SavedAutomationCatalogEntry,
  desiredEnabled?: boolean,
): {
  entry: SavedAutomationCatalogEntry;
  enabled: boolean;
  operations: SavedAutomationMutationOperation[];
} {
  const enabled = typeof desiredEnabled === 'boolean' ? desiredEnabled : !entry.enabled;
  if (entry.workflow) {
    return {
      entry,
      enabled,
      operations: [{
        toolName: 'workflow_upsert',
        args: buildWorkflowToggleArgs(entry.workflow, enabled),
      }],
    };
  }

  const taskId = toNonEmptyString(entry.task?.id);
  return {
    entry,
    enabled,
    operations: taskId
      ? [{ toolName: 'task_update', args: { taskId, enabled } }]
      : [],
  };
}

export function planSavedAutomationDelete(
  entry: SavedAutomationCatalogEntry,
): { entry: SavedAutomationCatalogEntry; operations: SavedAutomationMutationOperation[] } {
  const operations: SavedAutomationMutationOperation[] = [];
  const taskId = toNonEmptyString(entry.task?.id);
  const workflowId = toNonEmptyString(entry.workflow?.id);
  if (taskId) {
    operations.push({ toolName: 'task_delete', args: { taskId } });
  }
  if (workflowId) {
    operations.push({ toolName: 'workflow_delete', args: { workflowId } });
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
  operation: SavedAutomationMutationOperation,
): { success: boolean; message: string } {
  switch (operation.toolName) {
    case 'workflow_upsert':
      return controlPlane.upsertWorkflow(operation.args as unknown as AssistantConnectorPlaybookDefinition);
    case 'task_update': {
      const taskId = toNonEmptyString(operation.args.taskId) || '';
      const { taskId: _taskId, ...input } = operation.args;
      return controlPlane.updateTask(taskId, input);
    }
    case 'workflow_delete':
      return controlPlane.deleteWorkflow(toNonEmptyString(operation.args.workflowId) || '');
    case 'task_delete':
      return controlPlane.deleteTask(toNonEmptyString(operation.args.taskId) || '');
    default:
      return { success: false, message: `Mutation '${operation.toolName}' is not supported in direct control.` };
  }
}

async function executeAsyncMutationOperation(
  controlPlane: AutomationManagerControlPlane,
  operation: SavedAutomationMutationOperation,
  options?: {
    dryRun?: boolean;
    origin?: 'assistant' | 'cli' | 'web';
    agentId?: string;
    userId?: string;
    channel?: string;
    requestedBy?: string;
  },
): Promise<unknown> {
  switch (operation.toolName) {
    case 'workflow_run':
      return controlPlane.runWorkflow({
        workflowId: toNonEmptyString(operation.args.workflowId) || '',
        dryRun: options?.dryRun === true,
        origin: options?.origin,
        agentId: options?.agentId,
        userId: options?.userId,
        channel: options?.channel,
        requestedBy: options?.requestedBy,
      });
    case 'task_run':
      return controlPlane.runTask(toNonEmptyString(operation.args.taskId) || '');
    default:
      return { success: false, message: `Run '${operation.toolName}' is not supported in direct control.` };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
