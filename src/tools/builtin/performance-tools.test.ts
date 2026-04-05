import { describe, expect, it, vi } from 'vitest';

import { ToolRegistry } from '../registry.js';
import { registerBuiltinPerformanceTools } from './performance-tools.js';

describe('performance tools', () => {
  const runRegisteredTool = async (
    registry: ToolRegistry,
    toolName: string,
    args: Record<string, unknown>,
  ) => {
    const entry = registry.get(toolName);
    if (!entry) {
      throw new Error(`Tool '${toolName}' was not registered.`);
    }
    return entry.handler(args, {
      toolName,
      args,
      origin: 'cli',
    });
  };

  const requireString = (value: unknown, field: string): string => {
    if (typeof value !== 'string') {
      throw new Error(`${field} must be a string`);
    }
    return value;
  };

  it('loads status through the shared performance service', async () => {
    const registry = new ToolRegistry();
    registerBuiltinPerformanceTools({
      registry,
      requireString,
      asString: (value, fallback = '') => typeof value === 'string' ? value : fallback,
      asStringArray: (value) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [],
      getPerformanceService: () => ({
        getStatus: async () => ({
          activeProfile: 'coding-focus',
          os: 'win32',
          snapshot: {
            cpuPercent: 20,
            memoryMb: 4096,
            diskFreeMb: 100_000,
            activeProfile: 'coding-focus',
            sampledAt: 1_700_000_000_000,
          },
          capabilities: {
            canManageProcesses: true,
            canManagePower: false,
            canRunCleanup: false,
            canProbeLatency: true,
            supportedActionIds: ['cleanup'],
          },
          profiles: [],
          latencyTargets: [],
          history: [],
        }),
      } as any),
    });

    const result = await runRegisteredTool(registry, 'performance_status_get', {});
    expect(result.success).toBe(true);
    expect(result.output).toMatchObject({
      activeProfile: 'coding-focus',
      os: 'win32',
    });
  });

  it('generates a preview internally when running the default checked cleanup selection', async () => {
    const registry = new ToolRegistry();
    const previewAction = vi.fn(async () => ({
      previewId: 'preview-1',
      profileId: 'coding-focus',
      processTargets: [
        {
          targetId: 'pid:200',
          label: 'Discord.exe',
          suggestedReason: 'Matched an active profile terminate rule.',
          checkedByDefault: true,
          selectable: true,
          risk: 'low',
        },
        {
          targetId: 'pid:300',
          label: 'Code.exe',
          suggestedReason: 'Protected by the active profile.',
          checkedByDefault: false,
          selectable: false,
          blockedReason: 'Protected by the active profile.',
          risk: 'low',
        },
      ],
      cleanupTargets: [],
    }));
    const runAction = vi.fn(async () => ({ success: true, message: 'Stopped 1 selected process(es).' }));

    registerBuiltinPerformanceTools({
      registry,
      requireString,
      asString: (value, fallback = '') => typeof value === 'string' ? value : fallback,
      asStringArray: (value) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [],
      getPerformanceService: () => ({
        previewAction,
        runAction,
        applyProfile: vi.fn(),
        getStatus: vi.fn(),
      } as any),
    });

    const result = await runRegisteredTool(registry, 'performance_action_run', {
      actionId: 'cleanup',
      selectionMode: 'checked_by_default',
    });
    expect(result.success).toBe(true);
    expect(previewAction).toHaveBeenCalledWith('cleanup');
    expect(runAction).toHaveBeenCalledWith({
      previewId: 'preview-1',
      selectedProcessTargetIds: ['pid:200'],
      selectedCleanupTargetIds: [],
    });
  });
});
