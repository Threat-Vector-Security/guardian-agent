import { describe, expect, it } from 'vitest';

import {
  canTestProviderConnection,
  summarizeModelCapabilitySettings,
} from '../web/public/js/provider-editor-state.js';

describe('provider editor state', () => {
  it('allows connection tests only for saved provider profiles', () => {
    expect(canTestProviderConnection('xai-main', 'xai-main')).toBe(true);
    expect(canTestProviderConnection(null, 'xai-main')).toBe(false);
    expect(canTestProviderConnection('xai-main', 'xai-draft')).toBe(false);
    expect(canTestProviderConnection('   ', 'xai-main')).toBe(false);
  });

  it('summarizes unloaded model capability metadata with safe-default wording', () => {
    expect(summarizeModelCapabilitySettings(null)).toContain('Capability metadata is not loaded yet');
    expect(summarizeModelCapabilitySettings({})).toContain('unsupported advanced options are left at provider defaults');
  });

  it('summarizes live API capability metadata and supported controls', () => {
    const summary = summarizeModelCapabilitySettings({
      liveModelListed: true,
      settings: {
        reasoningEffort: { supported: true, source: 'api' },
        reasoningSummary: { supported: false, source: 'api' },
        verbosity: { supported: false, source: 'fallback' },
        parallelToolCalls: { supported: false, source: 'fallback' },
        toolChoice: { supported: false, source: 'fallback' },
        ollamaThink: { supported: true, source: 'api' },
        nativeOllamaOptions: { supported: true, source: 'provider_metadata' },
      },
    });

    expect(summary).toContain('Model found in the live catalog');
    expect(summary).toContain('live model API metadata');
    expect(summary).toContain('Reasoning effort');
    expect(summary).toContain('Think mode');
    expect(summary).toContain('Guardian retries with the safe baseline');
  });

  it('summarizes model-family defaults when live metadata is unavailable', () => {
    const summary = summarizeModelCapabilitySettings({
      liveModelListed: false,
      settings: {
        reasoningEffort: { supported: true, source: 'model_heuristic' },
        reasoningSummary: { supported: true, source: 'model_heuristic' },
        verbosity: { supported: true, source: 'model_heuristic' },
      },
    });

    expect(summary).toContain('Model-specific live catalog data was not returned');
    expect(summary).toContain('model-family defaults');
    expect(summary).toContain('Verbosity');
  });
});
