import type { CodingBackendConfig, CodingBackendsConfig } from '../config/types.js';
import type { CodingBackendTerminalControl } from '../channels/web-types.js';
import { CODING_BACKEND_PRESETS } from './coding-backend-presets.js';
import { createLogger } from '../util/logging.js';

const log = createLogger('coding-backend');

/** Structured result from a coding backend run. */
export interface CodingBackendRunResult {
  success: boolean;
  backendId: string;
  backendName: string;
  task: string;
  status: 'succeeded' | 'failed' | 'timed_out';
  exitCode?: number;
  durationMs: number;
  /** Cleaned output with ANSI codes stripped, truncated. */
  output: string;
  terminalTabId: string;
}

/** Active or completed backend session. */
export interface CodingBackendSession {
  id: string;
  backendId: string;
  backendName: string;
  codeSessionId: string;
  terminalId: string;
  task: string;
  status: 'running' | 'succeeded' | 'failed' | 'timed_out';
  startedAt: number;
  completedAt?: number;
  exitCode?: number;
  durationMs?: number;
}

export interface CodingBackendServiceOptions {
  config: CodingBackendsConfig;
  terminalControl: CodingBackendTerminalControl;
}

const MAX_OUTPUT_BYTES = 1_048_576; // 1MB
const MAX_TOOL_OUTPUT_CHARS = 8000;
const DEFAULT_TIMEOUT_MS = 300_000; // 5 min

/** Strip ANSI escape codes from terminal output. */
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?\x07|\x1b\[.*?[@-~]/g, '');
}

/** Shell-quote a string for POSIX shells. */
function shellQuote(text: string): string {
  return `'${text.replace(/'/g, "'\\''")}'`;
}

/** Build the full CLI command from config and task. */
function buildCommand(backend: CodingBackendConfig, task: string, cwd: string): string {
  const quotedTask = shellQuote(task);
  const args = backend.args.map((arg) =>
    arg.replace(/\{\{task\}\}/g, quotedTask).replace(/\{\{cwd\}\}/g, shellQuote(cwd)),
  );
  // If args already contain the quoted task (from template), join directly.
  // Otherwise the task was interpolated into the args already.
  return [backend.command, ...args].join(' ');
}

/** Build the shell input written into the terminal PTY. */
function buildTerminalInput(backend: CodingBackendConfig, command: string): string {
  if (backend.nonInteractive === false) {
    return `${command}\n`;
  }
  // Coding backends run inside an interactive shell PTY so append exit for
  // one-shot runs; otherwise the shell stays open and the tool never resolves.
  return `${command}\nexit\n`;
}

export class CodingBackendService {
  private config: CodingBackendsConfig;
  private readonly terminalControl: CodingBackendTerminalControl;
  private readonly activeSessions = new Map<string, {
    session: CodingBackendSession;
    outputBuffer: string;
    unsubscribeOutput: () => void;
    unsubscribeExit: () => void;
    timeoutHandle?: ReturnType<typeof setTimeout>;
    resolve?: (result: CodingBackendRunResult) => void;
  }>();
  private readonly recentSessions: CodingBackendSession[] = [];
  private sessionCounter = 0;

  constructor(options: CodingBackendServiceOptions) {
    this.config = options.config;
    this.terminalControl = options.terminalControl;
  }

  /** List available backends (config + presets merged). */
  listBackends(): Array<CodingBackendConfig & { preset?: boolean }> {
    const configuredIds = new Set(this.config.backends.map((b) => b.id));
    const backends: Array<CodingBackendConfig & { preset?: boolean }> = [];

    for (const backend of this.config.backends) {
      const preset = CODING_BACKEND_PRESETS.find((p) => p.id === backend.id);
      backends.push({
        ...preset,
        ...backend,
        preset: !!preset,
      } as CodingBackendConfig & { preset?: boolean });
    }

    // Also list known presets that aren't configured yet (as disabled)
    for (const preset of CODING_BACKEND_PRESETS) {
      if (!configuredIds.has(preset.id)) {
        backends.push({
          ...preset,
          enabled: false,
          preset: true,
        });
      }
    }

    return backends;
  }

  /** Resolve backend config by id, falling back to defaults and presets. */
  resolveBackend(backendId?: string): CodingBackendConfig | null {
    const id = backendId || this.config.defaultBackend;
    if (!id) {
      // Use first enabled backend
      const first = this.config.backends.find((b) => b.enabled);
      if (first) return this.mergeWithPreset(first);
      return null;
    }
    const configured = this.config.backends.find((b) => b.id === id);
    if (configured) return this.mergeWithPreset(configured);
    // Check presets
    const preset = CODING_BACKEND_PRESETS.find((p) => p.id === id);
    if (preset) return { ...preset, enabled: true };
    return null;
  }

  private mergeWithPreset(config: CodingBackendConfig): CodingBackendConfig {
    const preset = CODING_BACKEND_PRESETS.find((p) => p.id === config.id);
    if (!preset) return config;
    return {
      ...preset,
      enabled: config.enabled,
      ...(config.shell ? { shell: config.shell } : {}),
      ...(config.env ? { env: { ...config.env } } : {}),
      ...(typeof config.timeoutMs === 'number' ? { timeoutMs: config.timeoutMs } : {}),
      ...(typeof config.nonInteractive === 'boolean' ? { nonInteractive: config.nonInteractive } : {}),
      ...(typeof config.lastVersionCheck === 'number' ? { lastVersionCheck: config.lastVersionCheck } : {}),
      ...(typeof config.installedVersion === 'string' ? { installedVersion: config.installedVersion } : {}),
      ...(typeof config.updateAvailable === 'boolean' ? { updateAvailable: config.updateAvailable } : {}),
    };
  }

  /** Launch a backend to run a task. Returns when the CLI completes or times out. */
  async run(params: {
    task: string;
    backendId?: string;
    codeSessionId: string;
    workspaceRoot: string;
  }): Promise<CodingBackendRunResult> {
    const backend = this.resolveBackend(params.backendId);
    if (!backend) {
      const available = this.config.backends.filter((b) => b.enabled).map((b) => b.id);
      return {
        success: false,
        backendId: params.backendId || 'unknown',
        backendName: 'Unknown',
        task: params.task,
        status: 'failed',
        durationMs: 0,
        output: `Coding backend '${params.backendId || 'default'}' is not configured. Available: ${available.join(', ') || 'none'}. Add backends in Configuration > Integrations > Coding Assistants.`,
        terminalTabId: '',
      };
    }
    if (!backend.enabled) {
      return {
        success: false,
        backendId: backend.id,
        backendName: backend.name,
        task: params.task,
        status: 'failed',
        durationMs: 0,
        output: `Coding backend '${backend.name}' is disabled. Enable it in Configuration > Integrations > Coding Assistants.`,
        terminalTabId: '',
      };
    }

    // Check concurrent session limit
    const activeForSession = [...this.activeSessions.values()]
      .filter((s) => s.session.codeSessionId === params.codeSessionId);
    const maxConcurrent = this.config.maxConcurrentSessions ?? 2;
    if (activeForSession.length >= maxConcurrent) {
      return {
        success: false,
        backendId: backend.id,
        backendName: backend.name,
        task: params.task,
        status: 'failed',
        durationMs: 0,
        output: `Maximum concurrent coding backend sessions (${maxConcurrent}) reached for this workspace. Wait for an active session to complete.`,
        terminalTabId: '',
      };
    }

    const sessionId = `cb-${++this.sessionCounter}-${Date.now()}`;
    const command = buildCommand(backend, params.task, params.workspaceRoot);
    const timeoutMs = backend.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const shell = backend.shell || (process.platform === 'win32' ? 'wsl' : 'bash');

    log.info({ backendId: backend.id, sessionId, task: params.task.slice(0, 100) }, 'Launching coding backend');

    // Open terminal
    const { terminalId } = await this.terminalControl.openTerminal({
      codeSessionId: params.codeSessionId,
      shell,
      cwd: params.workspaceRoot,
      name: `[${backend.name}] ${params.task.slice(0, 40)}...`,
    });

    const startedAt = Date.now();
    const session: CodingBackendSession = {
      id: sessionId,
      backendId: backend.id,
      backendName: backend.name,
      codeSessionId: params.codeSessionId,
      terminalId,
      task: params.task,
      status: 'running',
      startedAt,
    };

    return new Promise<CodingBackendRunResult>((resolve) => {
      let outputBuffer = '';

      const complete = (status: 'succeeded' | 'failed' | 'timed_out', exitCode?: number) => {
        const entry = this.activeSessions.get(sessionId);
        if (!entry) return; // already completed
        if (entry.timeoutHandle) clearTimeout(entry.timeoutHandle);
        entry.unsubscribeOutput();
        entry.unsubscribeExit();
        this.activeSessions.delete(sessionId);

        const durationMs = Date.now() - startedAt;
        session.status = status;
        session.completedAt = Date.now();
        session.exitCode = exitCode;
        session.durationMs = durationMs;

        this.recentSessions.unshift(session);
        if (this.recentSessions.length > 50) this.recentSessions.length = 50;

        const cleaned = stripAnsi(entry.outputBuffer).trim();
        const truncated = cleaned.length > MAX_TOOL_OUTPUT_CHARS
          ? cleaned.slice(-MAX_TOOL_OUTPUT_CHARS) + '\n[output truncated]'
          : cleaned;

        log.info({ backendId: backend.id, sessionId, status, exitCode, durationMs }, 'Coding backend completed');

        resolve({
          success: status === 'succeeded',
          backendId: backend.id,
          backendName: backend.name,
          task: params.task,
          status,
          exitCode,
          durationMs,
          output: truncated || `(no output captured)`,
          terminalTabId: terminalId,
        });
      };

      const unsubscribeOutput = this.terminalControl.onTerminalOutput(terminalId, (data) => {
        outputBuffer += data;
        // Cap buffer size
        if (outputBuffer.length > MAX_OUTPUT_BYTES) {
          outputBuffer = outputBuffer.slice(-MAX_OUTPUT_BYTES);
        }
        const entry = this.activeSessions.get(sessionId);
        if (entry) entry.outputBuffer = outputBuffer;
      });

      const unsubscribeExit = this.terminalControl.onTerminalExit(terminalId, (exitCode) => {
        complete(exitCode === 0 ? 'succeeded' : 'failed', exitCode);
      });

      const timeoutHandle = setTimeout(() => {
        log.warn({ backendId: backend.id, sessionId, timeoutMs }, 'Coding backend timed out');
        this.terminalControl.closeTerminal(terminalId);
        complete('timed_out');
      }, timeoutMs);

      this.activeSessions.set(sessionId, {
        session,
        outputBuffer: '',
        unsubscribeOutput,
        unsubscribeExit,
        timeoutHandle,
        resolve,
      });

      // Write the command to the terminal and close one-shot shells afterwards.
      this.terminalControl.writeTerminalInput(terminalId, buildTerminalInput(backend, command));
    });
  }

  /** Get status of active and recent backend sessions. */
  getStatus(sessionId?: string): CodingBackendSession[] {
    const active = [...this.activeSessions.values()].map((entry) => entry.session);
    const all = [...active, ...this.recentSessions];
    if (sessionId) {
      return all.filter((s) => s.id === sessionId);
    }
    return all.slice(0, 20);
  }

  /** Update config at runtime (hot-reload from UI). */
  updateConfig(config: CodingBackendsConfig): void {
    this.config = config;
  }

  /** Clean up all active sessions on shutdown. */
  dispose(): void {
    for (const [, entry] of this.activeSessions) {
      if (entry.timeoutHandle) clearTimeout(entry.timeoutHandle);
      entry.unsubscribeOutput();
      entry.unsubscribeExit();
      this.terminalControl.closeTerminal(entry.session.terminalId);
    }
    this.activeSessions.clear();
  }
}
