import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, type GuardianAgentConfig } from '../config/types.js';
import {
  attachSelectedExecutionProfileMetadata,
  readSelectedExecutionProfileMetadata,
  selectExecutionProfile,
} from './execution-profiles.js';
import type { IntentGatewayDecision } from './intent-gateway.js';

function createConfig(): GuardianAgentConfig {
  const config = structuredClone(DEFAULT_CONFIG) as GuardianAgentConfig;
  config.llm['ollama-cloud-general'] = {
    provider: 'ollama_cloud',
    model: 'gpt-oss:120b',
    credentialRef: 'llm.ollama_cloud.primary',
  };
  config.llm['ollama-cloud-tools'] = {
    provider: 'ollama_cloud',
    model: 'qwen3:32b',
    credentialRef: 'llm.ollama_cloud.tools',
  };
  config.llm['ollama-cloud-coding'] = {
    provider: 'ollama_cloud',
    model: 'qwen3-coder-next',
    credentialRef: 'llm.ollama_cloud.coding',
  };
  config.llm.anthropic = {
    provider: 'anthropic',
    model: 'claude-opus-4.6',
    apiKey: 'test-key',
  };
  config.assistant.tools.preferredProviders = {
    local: 'ollama',
    managedCloud: 'ollama-cloud-general',
    frontier: 'anthropic',
  };
  config.assistant.tools.modelSelection = {
    ...(config.assistant.tools.modelSelection || {}),
    autoPolicy: 'balanced',
    preferManagedCloudForLowPressureExternal: true,
    preferFrontierForRepoGrounded: true,
    preferFrontierForSecurity: true,
    managedCloudRouting: {
      enabled: true,
      roleBindings: {
        general: 'ollama-cloud-general',
        toolLoop: 'ollama-cloud-tools',
        coding: 'ollama-cloud-coding',
      },
    },
  };
  return config;
}

function createGatewayDecision(
  overrides: Partial<IntentGatewayDecision> = {},
): IntentGatewayDecision {
  return {
    route: 'coding_task',
    confidence: 'high',
    operation: 'inspect',
    summary: 'Inspect the repo change.',
    turnRelation: 'new_request',
    resolution: 'ready',
    missingFields: [],
    executionClass: 'repo_grounded',
    preferredTier: 'external',
    requiresRepoGrounding: true,
    requiresToolSynthesis: true,
    expectedContextPressure: 'high',
    preferredAnswerPath: 'chat_synthesis',
    entities: {},
    ...overrides,
  };
}

describe('execution profiles', () => {
  it('prefers managed cloud for lower-pressure external work in balanced auto mode', () => {
    const profile = selectExecutionProfile({
      config: createConfig(),
      routeDecision: { tier: 'external' },
      gatewayDecision: createGatewayDecision({
        route: 'email_task',
        operation: 'read',
        executionClass: 'provider_crud',
        requiresRepoGrounding: false,
        requiresToolSynthesis: true,
        expectedContextPressure: 'low',
        preferredAnswerPath: 'tool_loop',
      }),
      mode: 'auto',
    });

    expect(profile).toMatchObject({
      providerName: 'ollama-cloud-tools',
      providerTier: 'managed_cloud',
      id: 'managed_cloud_tool',
      toolContextMode: 'tight',
    });
    expect(profile?.fallbackProviderOrder).toEqual([
      'ollama-cloud-tools',
      'anthropic',
      'ollama',
      'ollama-cloud-general',
      'ollama-cloud-coding',
    ]);
  });

  it('prefers frontier for heavier repo-grounded synthesis in balanced auto mode', () => {
    const profile = selectExecutionProfile({
      config: createConfig(),
      routeDecision: { tier: 'external' },
      gatewayDecision: createGatewayDecision(),
      mode: 'auto',
    });

    expect(profile).toMatchObject({
      providerName: 'anthropic',
      providerTier: 'frontier',
      id: 'frontier_deep',
      preferredAnswerPath: 'chat_synthesis',
      expectedContextPressure: 'high',
    });
    expect(profile?.fallbackProviderOrder).toEqual([
      'anthropic',
      'ollama-cloud-general',
      'ollama-cloud-coding',
      'ollama-cloud-tools',
      'ollama',
    ]);
  });

  it('uses the managed-cloud coding profile when managed-cloud-only mode forces coding through that tier', () => {
    const profile = selectExecutionProfile({
      config: createConfig(),
      routeDecision: { tier: 'external' },
      gatewayDecision: createGatewayDecision(),
      mode: 'managed-cloud-only',
    });

    expect(profile).toMatchObject({
      providerName: 'ollama-cloud-coding',
      providerTier: 'managed_cloud',
      id: 'managed_cloud_tool',
    });
  });

  it('falls back to the general managed-cloud profile when a specific role binding is unset', () => {
    const config = createConfig();
    config.assistant.tools.modelSelection = {
      ...(config.assistant.tools.modelSelection || {}),
      managedCloudRouting: {
        enabled: true,
        roleBindings: {
          general: 'ollama-cloud-general',
        },
      },
    };

    const profile = selectExecutionProfile({
      config,
      routeDecision: { tier: 'external' },
      gatewayDecision: createGatewayDecision({
        route: 'email_task',
        operation: 'read',
        executionClass: 'provider_crud',
        requiresRepoGrounding: false,
        requiresToolSynthesis: true,
        expectedContextPressure: 'low',
        preferredAnswerPath: 'tool_loop',
      }),
      mode: 'auto',
    });

    expect(profile).toMatchObject({
      providerName: 'ollama-cloud-general',
      providerTier: 'managed_cloud',
    });
  });

  it('infers a managed-cloud role provider from profile names when no role bindings are configured', () => {
    const config = createConfig();
    config.assistant.tools.modelSelection = {
      ...(config.assistant.tools.modelSelection || {}),
      managedCloudRouting: {
        enabled: true,
        roleBindings: {},
      },
    };

    const profile = selectExecutionProfile({
      config,
      routeDecision: { tier: 'external' },
      gatewayDecision: createGatewayDecision({
        route: 'email_task',
        operation: 'read',
        executionClass: 'provider_crud',
        requiresRepoGrounding: false,
        requiresToolSynthesis: true,
        expectedContextPressure: 'low',
        preferredAnswerPath: 'tool_loop',
      }),
      mode: 'auto',
    });

    expect(profile).toMatchObject({
      providerName: 'ollama-cloud-tools',
      providerTier: 'managed_cloud',
    });
  });

  it('falls back to the preferred managed-cloud provider when managed-cloud role routing is disabled', () => {
    const config = createConfig();
    config.assistant.tools.modelSelection = {
      ...(config.assistant.tools.modelSelection || {}),
      managedCloudRouting: {
        enabled: false,
        roleBindings: {
          general: 'ollama-cloud-general',
          toolLoop: 'ollama-cloud-tools',
          coding: 'ollama-cloud-coding',
        },
      },
    };

    const profile = selectExecutionProfile({
      config,
      routeDecision: { tier: 'external' },
      gatewayDecision: createGatewayDecision({
        route: 'email_task',
        operation: 'read',
        executionClass: 'provider_crud',
        requiresRepoGrounding: false,
        requiresToolSynthesis: true,
        expectedContextPressure: 'low',
        preferredAnswerPath: 'tool_loop',
      }),
      mode: 'auto',
    });

    expect(profile).toMatchObject({
      providerName: 'ollama-cloud-general',
      providerTier: 'managed_cloud',
    });
  });

  it('round-trips execution profile metadata through message metadata', () => {
    const profile = selectExecutionProfile({
      config: createConfig(),
      routeDecision: { tier: 'external' },
      gatewayDecision: createGatewayDecision(),
      mode: 'auto',
    });
    expect(profile).toBeTruthy();

    const metadata = attachSelectedExecutionProfileMetadata({ existing: true }, profile);
    expect(readSelectedExecutionProfileMetadata(metadata)).toEqual(profile);
  });
});
