import { describe, expect, it } from 'vitest';
import {
  CODING_BACKEND_PRESETS,
  applyCodingBackendEnvironmentDefaults,
  getCodingBackendPreset,
} from './coding-backend-presets.js';

describe('coding-backend-presets', () => {
  it('includes the built-in coding assistant presets', () => {
    expect(CODING_BACKEND_PRESETS.map((preset) => preset.id)).toEqual(
      expect.arrayContaining(['claude-code', 'codex', 'codex-sdk', 'gemini-cli', 'aider']),
    );
  });

  it('configures Codex for non-interactive exec mode', () => {
    const codex = getCodingBackendPreset('codex');
    expect(codex).toBeDefined();
    expect(codex?.command).toBe('codex');
    expect(codex?.args).toEqual([
      'exec',
      '--skip-git-repo-check',
      '--sandbox',
      'workspace-write',
      '{{assistant_response_args}}',
      '{{task}}',
    ]);
  });

  it('configures Codex SDK as a structured backend adapter', () => {
    const codexSdk = getCodingBackendPreset('codex-sdk');
    expect(codexSdk).toBeDefined();
    expect(codexSdk?.adapterKind).toBe('codex_sdk');
    expect(codexSdk?.executionHost).toBe('auto');
    expect(codexSdk?.command).toBe('codex-sdk');
    expect(codexSdk?.timeoutMs).toBe(900_000);
  });

  it('can enable the Codex SDK backend from startup environment defaults', () => {
    const config = applyCodingBackendEnvironmentDefaults(
      {
        enabled: false,
        backends: [],
        maxConcurrentSessions: 2,
        autoUpdate: true,
        versionCheckIntervalMs: 86_400_000,
      },
      {
        GUARDIAN_CODEX_HOST: 'windows',
        GUARDIAN_CODEX_BACKEND: 'codex-sdk',
      },
    );

    expect(config.enabled).toBe(true);
    expect(config.defaultBackend).toBe('codex-sdk');
    expect(config.backends).toHaveLength(1);
    expect(config.backends[0]).toMatchObject({
      id: 'codex-sdk',
      enabled: true,
      adapterKind: 'codex_sdk',
      executionHost: 'windows',
    });
  });
});
