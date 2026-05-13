import type { CodingBackendConfig, CodingBackendsConfig } from '../config/types.js';

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
    adapterKind: 'terminal_cli',
    executionHost: 'auto',
    command: 'codex',
    args: ['exec', '--skip-git-repo-check', '--sandbox', 'workspace-write', '{{assistant_response_args}}', '{{task}}'],
    versionCommand: 'codex --version',
    updateCommand: 'npm update -g @openai/codex',
    timeoutMs: 300_000,
    nonInteractive: true,
  },
  {
    id: 'codex-sdk',
    name: 'OpenAI Codex SDK',
    adapterKind: 'codex_sdk',
    executionHost: 'auto',
    command: 'codex-sdk',
    args: ['{{task}}'],
    versionCommand: 'codex --version',
    updateCommand: 'npm update @openai/codex-sdk',
    timeoutMs: 900_000,
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

export function applyCodingBackendEnvironmentDefaults(
  config: CodingBackendsConfig,
  env: NodeJS.ProcessEnv = process.env,
): CodingBackendsConfig {
  const rawBackend = env['GUARDIAN_CODEX_BACKEND']?.trim().toLowerCase();
  const rawHost = env['GUARDIAN_CODEX_HOST']?.trim().toLowerCase();
  if (!rawBackend && !rawHost) {
    return config;
  }

  const backendId = rawBackend === 'codex' || rawBackend === 'codex-cli'
    ? 'codex'
    : rawBackend === 'codex-sdk' || rawBackend === 'sdk' || rawBackend === undefined || rawBackend === ''
      ? 'codex-sdk'
      : rawBackend;
  const preset = getCodingBackendPreset(backendId);
  if (!preset) {
    return config;
  }

  const executionHost = normalizeExecutionHost(rawHost);
  const existingIndex = config.backends.findIndex((backend) => backend.id === backendId);
  const backends = [...config.backends];
  const existing = existingIndex >= 0 ? backends[existingIndex] : undefined;
  const nextBackend: CodingBackendConfig = {
    ...preset,
    ...(existing ?? {}),
    enabled: true,
    ...(executionHost ? { executionHost } : {}),
  };

  if (existingIndex >= 0) {
    backends[existingIndex] = nextBackend;
  } else {
    backends.push(nextBackend);
  }

  return {
    ...config,
    enabled: true,
    defaultBackend: backendId,
    backends,
  };
}

function normalizeExecutionHost(value: string | undefined): CodingBackendConfig['executionHost'] | undefined {
  switch (value) {
    case 'windows':
    case 'win32':
      return 'windows';
    case 'wsl':
    case 'wsl2':
      return 'wsl';
    case 'linux':
      return 'linux';
    case 'macos':
    case 'darwin':
      return 'macos';
    case 'auto':
    case undefined:
    case '':
      return undefined;
    default:
      return undefined;
  }
}
