import { describe, expect, it } from 'vitest';
import { CODING_BACKEND_PRESETS, getCodingBackendPreset } from './coding-backend-presets.js';

describe('coding-backend-presets', () => {
  it('includes the built-in coding assistant presets', () => {
    expect(CODING_BACKEND_PRESETS.map((preset) => preset.id)).toEqual(
      expect.arrayContaining(['claude-code', 'codex', 'gemini-cli', 'aider']),
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
});
