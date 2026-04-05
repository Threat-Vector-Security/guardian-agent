import type { PerformanceActionPreview } from '../../channels/web-types.js';
import type { PerformanceService } from '../../runtime/performance-service.js';
import { ToolRegistry } from '../registry.js';

interface PerformanceToolRegistrarContext {
  registry: ToolRegistry;
  requireString: (value: unknown, field: string) => string;
  asString: (value: unknown, fallback?: string) => string;
  asStringArray: (value: unknown) => string[];
  getPerformanceService: () => PerformanceService | undefined;
}

type PerformanceSelectionMode = 'checked_by_default' | 'all_selectable';

function getPerformanceServiceOrError(
  context: PerformanceToolRegistrarContext,
): { service?: PerformanceService; error?: string } {
  const service = context.getPerformanceService();
  if (!service) {
    return { error: 'Performance management is not available in this runtime.' };
  }
  return { service };
}

function normalizeSelectionMode(value: string): PerformanceSelectionMode {
  return value === 'all_selectable' ? value : 'checked_by_default';
}

function buildSelectedTargetIds(
  preview: PerformanceActionPreview,
  mode: PerformanceSelectionMode,
): { processIds: string[]; cleanupIds: string[] } {
  const predicate = mode === 'all_selectable'
    ? (target: PerformanceActionPreview['processTargets'][number]) => target.selectable
    : (target: PerformanceActionPreview['processTargets'][number]) => target.selectable && target.checkedByDefault;
  return {
    processIds: preview.processTargets.filter(predicate).map((target) => target.targetId),
    cleanupIds: preview.cleanupTargets.filter(predicate).map((target) => target.targetId),
  };
}

export function registerBuiltinPerformanceTools(context: PerformanceToolRegistrarContext): void {
  context.registry.register(
    {
      name: 'performance_status_get',
      description: 'Load the current host performance status, including the active profile, host metrics, configured profiles, latency probes, and recent performance actions.',
      shortDescription: 'Load current performance status, profiles, latency, and recent actions.',
      risk: 'read_only',
      category: 'system',
      deferLoading: true,
      parameters: {
        type: 'object',
        properties: {},
      },
      examples: [
        { input: {}, description: 'Load the current host performance status' },
      ],
    },
    async () => {
      const { service, error } = getPerformanceServiceOrError(context);
      if (!service) {
        return { success: false, error };
      }
      const status = await service.getStatus();
      return {
        success: true,
        message: `Loaded performance status for profile '${status.activeProfile}'.`,
        output: status,
      };
    },
  );

  context.registry.register(
    {
      name: 'performance_profile_apply',
      description: 'Switch the active performance profile used by Guardian for workstation monitoring and profile-aware cleanup behavior. This may also attempt host-side power tuning when supported.',
      shortDescription: 'Apply a configured performance profile.',
      risk: 'mutating',
      category: 'system',
      deferLoading: true,
      parameters: {
        type: 'object',
        properties: {
          profileId: {
            type: 'string',
            description: 'Configured performance profile id to activate.',
          },
        },
        required: ['profileId'],
      },
      examples: [
        { input: { profileId: 'coding-focus' }, description: 'Switch to the Coding Focus profile' },
      ],
    },
    async (args) => {
      const { service, error } = getPerformanceServiceOrError(context);
      if (!service) {
        return { success: false, error };
      }
      const profileId = context.requireString(args.profileId, 'profileId').trim();
      const result = await service.applyProfile(profileId);
      if (!result.success) {
        return { success: false, error: result.message };
      }
      return {
        success: true,
        message: result.message,
        output: {
          profileId,
          message: result.message,
        },
      };
    },
  );

  context.registry.register(
    {
      name: 'performance_action_preview',
      description: 'Preview a reviewed performance action before running it. Use this to inspect which process or cleanup targets Guardian recommends and which rows are protected.',
      shortDescription: 'Preview recommended performance cleanup targets.',
      risk: 'read_only',
      category: 'system',
      deferLoading: true,
      parameters: {
        type: 'object',
        properties: {
          actionId: {
            type: 'string',
            description: 'Performance action id to preview. Currently cleanup is supported.',
          },
        },
      },
      examples: [
        { input: { actionId: 'cleanup' }, description: 'Preview the recommended cleanup targets' },
      ],
    },
    async (args) => {
      const { service, error } = getPerformanceServiceOrError(context);
      if (!service) {
        return { success: false, error };
      }
      const actionId = context.asString(args.actionId, 'cleanup').trim() || 'cleanup';
      const preview = await service.previewAction(actionId);
      return {
        success: true,
        message: `Loaded performance preview '${preview.previewId}' for action '${actionId}'.`,
        output: preview,
      };
    },
  );

  context.registry.register(
    {
      name: 'performance_action_run',
      description: 'Run a reviewed performance action. You can either submit an existing preview with explicit selected target ids, or let Guardian generate a fresh preview and run the default recommended or all selectable targets.',
      shortDescription: 'Run a reviewed performance cleanup action.',
      risk: 'mutating',
      category: 'system',
      deferLoading: true,
      parameters: {
        type: 'object',
        properties: {
          previewId: {
            type: 'string',
            description: 'Existing preview id returned by performance_action_preview when you want explicit target selection.',
          },
          actionId: {
            type: 'string',
            description: 'Action id to preview and run when previewId is omitted. Currently cleanup is supported.',
          },
          selectionMode: {
            type: 'string',
            enum: ['checked_by_default', 'all_selectable'],
            description: 'When previewId is omitted, choose whether Guardian runs only the default-checked rows or every selectable row.',
          },
          selectedProcessTargetIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Explicit process target ids from a previous preview. Required when previewId is supplied.',
          },
          selectedCleanupTargetIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Explicit cleanup target ids from a previous preview. Required when previewId is supplied.',
          },
        },
      },
      examples: [
        { input: { actionId: 'cleanup', selectionMode: 'checked_by_default' }, description: 'Generate a fresh preview and run only the recommended default-checked rows' },
        { input: { previewId: 'preview-123', selectedProcessTargetIds: ['pid:4242'] }, description: 'Run one explicit process target from an existing preview' },
      ],
    },
    async (args) => {
      const { service, error } = getPerformanceServiceOrError(context);
      if (!service) {
        return { success: false, error };
      }

      const previewId = context.asString(args.previewId).trim();
      const selectedProcessTargetIds = context.asStringArray(args.selectedProcessTargetIds);
      const selectedCleanupTargetIds = context.asStringArray(args.selectedCleanupTargetIds);

      let resolvedPreviewId = previewId;
      let selectionMode: PerformanceSelectionMode | undefined;
      if (!resolvedPreviewId) {
        const actionId = context.asString(args.actionId, 'cleanup').trim() || 'cleanup';
        selectionMode = normalizeSelectionMode(context.asString(args.selectionMode, 'checked_by_default').trim().toLowerCase());
        const preview = await service.previewAction(actionId);
        resolvedPreviewId = preview.previewId;
        const selectedTargets = buildSelectedTargetIds(preview, selectionMode);
        selectedProcessTargetIds.push(...selectedTargets.processIds);
        selectedCleanupTargetIds.push(...selectedTargets.cleanupIds);
      }

      if (!resolvedPreviewId) {
        return { success: false, error: 'previewId is required when no fresh preview can be generated.' };
      }

      if (selectedProcessTargetIds.length === 0 && selectedCleanupTargetIds.length === 0) {
        return {
          success: false,
          error: previewId
            ? 'Select at least one preview target before running the action.'
            : 'The generated preview did not contain any selectable targets.',
        };
      }

      const result = await service.runAction({
        previewId: resolvedPreviewId,
        selectedProcessTargetIds,
        selectedCleanupTargetIds,
      });
      if (!result.success) {
        return { success: false, error: result.message };
      }
      return {
        success: true,
        message: result.message,
        output: {
          previewId: resolvedPreviewId,
          selectionMode: selectionMode ?? 'explicit',
          selectedProcessTargetIds,
          selectedCleanupTargetIds,
          message: result.message,
        },
      };
    },
  );
}
