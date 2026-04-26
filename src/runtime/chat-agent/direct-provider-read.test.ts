import { describe, expect, it, vi } from 'vitest';

import type { AgentContext, UserMessage } from '../../agent/types.js';
import type { IntentGatewayDecision } from '../intent-gateway.js';
import {
  formatDirectProviderModelsResponse,
  tryDirectProviderRead,
} from './direct-provider-read.js';

const baseMessage: UserMessage = {
  id: 'msg-provider-list',
  userId: 'owner',
  channel: 'web',
  content: 'List my configured AI providers.',
  timestamp: 1_700_000_000_000,
};

const baseCtx: AgentContext = {
  agentId: 'chat',
  emit: vi.fn(async () => {}),
  llm: { name: 'ollama_cloud' } as never,
  checkAction: vi.fn(),
  capabilities: [],
};

const providerReadDecision: IntentGatewayDecision = {
  route: 'general_assistant',
  operation: 'read',
  confidence: 'high',
  summary: 'Lists configured AI providers.',
  turnRelation: 'new_request',
  resolution: 'ready',
  missingFields: [],
  executionClass: 'provider_crud',
  preferredTier: 'external',
  requiresRepoGrounding: false,
  requiresToolSynthesis: true,
  expectedContextPressure: 'medium',
  preferredAnswerPath: 'tool_loop',
  entities: { uiSurface: 'config' },
};

describe('direct provider read runtime', () => {
  it('formats configured provider inventory', async () => {
    const tools = {
      isEnabled: vi.fn(() => true),
      executeModelTool: vi.fn(async (toolName: string) => {
        expect(toolName).toBe('llm_provider_list');
        return {
          success: true,
          output: {
            providers: [
              {
                name: 'ollama',
                type: 'ollama',
                model: 'gemma4:26b',
                tier: 'local',
                connected: true,
                isPreferredLocal: true,
              },
              {
                name: 'ollama-cloud-tools',
                type: 'ollama_cloud',
                model: 'glm-4.7',
                tier: 'managed_cloud',
                connected: true,
                isPreferredManagedCloud: true,
              },
            ],
          },
        };
      }),
    };

    const result = await tryDirectProviderRead({
      agentId: 'chat',
      tools: tools as never,
      message: baseMessage,
      ctx: baseCtx,
      decision: providerReadDecision,
    });

    const content = typeof result === 'string' ? result : result?.content ?? '';
    expect(content).toContain('Configured AI providers:');
    expect(content).toContain('ollama [local · ollama] model gemma4:26b');
    expect(content).toContain('ollama-cloud-tools [managed cloud · ollama_cloud] model glm-4.7');
  });

  it('formats provider model catalogs', () => {
    expect(formatDirectProviderModelsResponse(
      { name: 'ollama-cloud-tools', model: 'glm-4.7' },
      { activeModel: 'gpt-oss:120b', models: ['gpt-oss:120b', 'glm-4.7'] },
    )).toContain('Available models for ollama-cloud-tools:');
  });
});
