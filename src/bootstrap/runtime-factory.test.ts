import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, type GuardianAgentConfig } from '../config/types.js';
import { buildPathBoundaryPattern } from '../util/regex.js';
import {
  buildDefaultBootstrapConfigYaml,
  ensureGuardianDataDirDeniedPath,
  selectOllamaStartupModel,
} from './runtime-factory.js';

describe('runtime bootstrap helpers', () => {
  it('builds the default bootstrap config yaml with expected starter sections', () => {
    const yaml = buildDefaultBootstrapConfigYaml();
    expect(yaml).toContain('defaultProvider: ollama');
    expect(yaml).toContain('channels:');
    expect(yaml).toContain('assistant:');
    expect(yaml.endsWith('\n')).toBe(true);
  });

  it('ensures the guardian data directory denied path is present once', () => {
    const config = structuredClone(DEFAULT_CONFIG) as GuardianAgentConfig;
    config.guardian.deniedPaths = [];

    ensureGuardianDataDirDeniedPath(config, '/home/alex/.guardianagent');
    ensureGuardianDataDirDeniedPath(config, '/home/alex/.guardianagent');

    expect(config.guardian.deniedPaths).toEqual([
      buildPathBoundaryPattern('/home/alex/.guardianagent'),
    ]);
  });

  it('keeps the configured Ollama model when an exact or tagged match exists', () => {
    expect(selectOllamaStartupModel('llama3.2', ['llama3.2:latest', 'qwen2.5'])).toBeNull();
    expect(selectOllamaStartupModel('qwen2.5:7b', ['qwen2.5:7b', 'llama3.2'])).toBeNull();
  });

  it('falls back to the first available Ollama model when the configured one is missing', () => {
    expect(selectOllamaStartupModel('missing-model', ['llama3.2:latest', 'qwen2.5'])).toBe('llama3.2:latest');
    expect(selectOllamaStartupModel('missing-model', [])).toBeNull();
  });
});
