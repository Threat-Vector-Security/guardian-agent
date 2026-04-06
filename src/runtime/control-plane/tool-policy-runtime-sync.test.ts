import { describe, expect, it, vi } from 'vitest';

import { syncLiveToolPolicyFromConfig } from './tool-policy-runtime-sync.js';

describe('syncLiveToolPolicyFromConfig', () => {
  it('applies the current tool sandbox policy and shell allowlist live', () => {
    const toolExecutor = {
      updatePolicy: vi.fn(),
    };
    const runtime = {
      applyShellAllowedCommands: vi.fn(),
    };

    syncLiveToolPolicyFromConfig(toolExecutor, runtime, {
      policyMode: 'approve_by_policy',
      toolPolicies: { fs_write: 'manual' },
      allowedPaths: ['S:\\Development\\GuardianAgent', 'S:\\Development'],
      allowedCommands: ['git', 'node'],
      allowedDomains: ['github.com'],
    });

    expect(toolExecutor.updatePolicy).toHaveBeenCalledWith({
      mode: 'approve_by_policy',
      toolPolicies: { fs_write: 'manual' },
      sandbox: {
        allowedPaths: ['S:\\Development\\GuardianAgent', 'S:\\Development'],
        allowedCommands: ['git', 'node'],
        allowedDomains: ['github.com'],
      },
    });
    expect(runtime.applyShellAllowedCommands).toHaveBeenCalledWith(['git', 'node']);
  });
});
