import type { GuardianAgentConfig } from '../../config/types.js';

type ToolPolicyConfig = Pick<
  GuardianAgentConfig['assistant']['tools'],
  'policyMode' | 'toolPolicies' | 'allowedPaths' | 'allowedCommands' | 'allowedDomains'
>;

export interface ToolPolicyRuntimeSink {
  updatePolicy: (update: {
    mode?: ToolPolicyConfig['policyMode'];
    toolPolicies?: ToolPolicyConfig['toolPolicies'];
    sandbox?: {
      allowedPaths?: string[];
      allowedCommands?: string[];
      allowedDomains?: string[];
    };
  }) => unknown;
}

export interface ShellPolicyRuntimeSink {
  applyShellAllowedCommands: (allowedCommands: string[]) => void;
}

export function syncLiveToolPolicyFromConfig(
  toolExecutor: ToolPolicyRuntimeSink,
  runtime: ShellPolicyRuntimeSink,
  tools: ToolPolicyConfig,
): void {
  toolExecutor.updatePolicy({
    mode: tools.policyMode,
    toolPolicies: tools.toolPolicies,
    sandbox: {
      allowedPaths: tools.allowedPaths,
      allowedCommands: tools.allowedCommands,
      allowedDomains: tools.allowedDomains,
    },
  });
  runtime.applyShellAllowedCommands(tools.allowedCommands);
}
