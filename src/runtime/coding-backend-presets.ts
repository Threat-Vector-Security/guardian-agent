import type { CodingBackendConfig } from '../config/types.js';

export type CodingBackendPreset = Omit<CodingBackendConfig, 'enabled' | 'lastVersionCheck' | 'installedVersion' | 'updateAvailable'>;

/**
 * Built-in presets for known coding CLI tools.
 * Users pick a preset from the UI/CLI, and these defaults are merged with any overrides.
 */
export const CODING_BACKEND_PRESETS: CodingBackendPreset[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    command: 'claude',
    args: ['--print', '{{task}}'],
    versionCommand: 'claude --version',
    updateCommand: 'npm update -g @anthropic-ai/claude-code',
    timeoutMs: 300_000,
    nonInteractive: true,
  },
  {
    id: 'codex',
    name: 'OpenAI Codex CLI',
    command: 'codex',
    args: ['exec', '--skip-git-repo-check', '--sandbox', 'workspace-write', '{{assistant_response_args}}', '{{task}}'],
    versionCommand: 'codex --version',
    updateCommand: 'npm update -g @openai/codex',
    timeoutMs: 300_000,
    nonInteractive: true,
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    command: 'gemini',
    args: ['{{task}}'],
    versionCommand: 'gemini --version',
    updateCommand: 'npm update -g @anthropic-ai/gemini-cli',
    timeoutMs: 300_000,
    nonInteractive: true,
  },
  {
    id: 'aider',
    name: 'Aider',
    command: 'aider',
    args: ['--message', '{{task}}', '--yes'],
    versionCommand: 'aider --version',
    updateCommand: 'pip install --upgrade aider-chat',
    timeoutMs: 300_000,
    nonInteractive: true,
  },
];

/** Look up a preset by id. */
export function getCodingBackendPreset(id: string): CodingBackendPreset | undefined {
  return CODING_BACKEND_PRESETS.find((preset) => preset.id === id);
}

/** Merge a preset with user overrides to produce a full config. */
export function applyCodingBackendPreset(
  presetId: string,
  overrides?: Partial<CodingBackendConfig>,
): CodingBackendConfig | null {
  const preset = getCodingBackendPreset(presetId);
  if (!preset) return null;
  return {
    ...preset,
    enabled: true,
    ...overrides,
    id: preset.id,
  };
}
