import { describe, expect, it } from 'vitest';

import { inferModelCapabilities } from './model-capabilities.js';

describe('inferModelCapabilities', () => {
  it('marks live-listed models and exposes baseline controls', () => {
    const capabilities = inferModelCapabilities({
      providerType: 'openai',
      model: 'gpt-4o',
      liveModels: [{ id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', contextWindow: 128_000 }],
    });

    expect(capabilities).toMatchObject({
      providerType: 'openai',
      model: 'gpt-4o',
      liveModelListed: true,
      contextWindow: 128_000,
      settings: {
        maxTokens: { supported: true, source: 'provider_metadata' },
        temperature: { supported: true, source: 'provider_metadata' },
        topP: { supported: true, source: 'provider_metadata' },
      },
    });
  });

  it('exposes OpenAI reasoning controls only for known reasoning model families', () => {
    const reasoning = inferModelCapabilities({
      providerType: 'openai',
      model: 'gpt-5.1',
    });
    const ordinary = inferModelCapabilities({
      providerType: 'openai',
      model: 'gpt-4o',
    });

    expect(reasoning.settings.reasoningEffort).toMatchObject({
      supported: true,
      values: ['minimal', 'low', 'medium', 'high'],
    });
    expect(reasoning.settings.verbosity).toMatchObject({
      supported: true,
      values: ['low', 'medium', 'high'],
    });
    expect(reasoning.settings.reasoningBudget).toMatchObject({
      supported: true,
      default: 1024,
    });
    expect(ordinary.settings.reasoningEffort.supported).toBe(false);
    expect(ordinary.settings.reasoningBudget.supported).toBe(false);
  });

  it('prefers live provider-supported parameters over model-family assumptions', () => {
    const capabilities = inferModelCapabilities({
      providerType: 'openrouter',
      model: 'openai/gpt-5.1',
      liveModels: [
        {
          id: 'openai/gpt-5.1',
          name: 'GPT-5.1',
          provider: 'openrouter',
          supportedParameters: [
            'temperature',
            'top_p',
            'reasoning_effort',
            'reasoning.max_tokens',
            'verbosity',
            'tool_choice',
          ],
        },
      ],
    });

    expect(capabilities.settings.temperature).toMatchObject({
      supported: true,
      source: 'api',
    });
    expect(capabilities.settings.reasoningEffort).toMatchObject({
      supported: true,
      source: 'api',
      values: ['minimal', 'low', 'medium', 'high'],
    });
    expect(capabilities.settings.reasoningBudget).toMatchObject({
      supported: true,
      source: 'api',
    });
    expect(capabilities.settings.verbosity).toMatchObject({
      supported: true,
      source: 'api',
      values: ['low', 'medium', 'high'],
    });
    expect(capabilities.settings.parallelToolCalls).toMatchObject({
      supported: false,
      source: 'api',
    });
  });

  it('maps Ollama reasoning to think mode and hides hosted-only knobs', () => {
    const capabilities = inferModelCapabilities({
      providerType: 'ollama',
      model: 'qwen3:32b',
    });

    expect(capabilities.settings.reasoningEffort).toMatchObject({
      supported: true,
      source: 'provider_metadata',
    });
    expect(capabilities.settings.ollamaThink).toMatchObject({
      supported: true,
      values: ['default', 'off', 'on', 'low', 'medium', 'high'],
    });
    expect(capabilities.settings.toolChoice.supported).toBe(false);
  });

  it('uses live Ollama thinking capability metadata when available', () => {
    const thinking = inferModelCapabilities({
      providerType: 'ollama',
      model: 'qwen3:32b',
      liveModels: [
        { id: 'qwen3:32b', name: 'qwen3:32b', provider: 'ollama', capabilities: ['completion', 'thinking'] },
      ],
    });
    const plain = inferModelCapabilities({
      providerType: 'ollama',
      model: 'mistral',
      liveModels: [
        { id: 'mistral', name: 'mistral', provider: 'ollama', capabilities: ['completion'] },
      ],
    });

    expect(thinking.settings.ollamaThink).toMatchObject({
      supported: true,
      source: 'api',
    });
    expect(thinking.settings.reasoningEffort).toMatchObject({
      supported: true,
      source: 'api',
    });
    expect(plain.settings.ollamaThink).toMatchObject({
      supported: false,
      source: 'api',
    });
    expect(plain.settings.reasoningEffort.supported).toBe(false);
  });
});
