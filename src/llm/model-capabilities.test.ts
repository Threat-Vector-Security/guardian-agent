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
    expect(ordinary.settings.reasoningEffort.supported).toBe(false);
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
});
