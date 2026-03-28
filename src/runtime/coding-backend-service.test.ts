import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CodingBackendService } from './coding-backend-service.js';
import type { CodingBackendTerminalControl } from '../channels/web-types.js';
import type { CodingBackendsConfig } from '../config/types.js';

function createMockTerminalControl(): CodingBackendTerminalControl & {
  outputCallbacks: Map<string, Set<(data: string) => void>>;
  exitCallbacks: Map<string, Set<(exitCode: number, signal: number) => void>>;
  simulateOutput: (terminalId: string, data: string) => void;
  simulateExit: (terminalId: string, exitCode: number) => void;
  openedTerminals: Array<{ terminalId: string; codeSessionId: string; shell: string; cwd: string }>;
  writtenInputs: Array<{ terminalId: string; input: string }>;
  closedTerminals: string[];
} {
  const outputCallbacks = new Map<string, Set<(data: string) => void>>();
  const exitCallbacks = new Map<string, Set<(exitCode: number, signal: number) => void>>();
  const openedTerminals: Array<{ terminalId: string; codeSessionId: string; shell: string; cwd: string }> = [];
  const writtenInputs: Array<{ terminalId: string; input: string }> = [];
  const closedTerminals: string[] = [];
  let counter = 0;

  return {
    outputCallbacks,
    exitCallbacks,
    openedTerminals,
    writtenInputs,
    closedTerminals,
    simulateOutput(terminalId: string, data: string) {
      const cbs = outputCallbacks.get(terminalId);
      if (cbs) for (const cb of cbs) cb(data);
    },
    simulateExit(terminalId: string, exitCode: number) {
      const cbs = exitCallbacks.get(terminalId);
      if (cbs) for (const cb of cbs) cb(exitCode, 0);
    },
    openTerminal: vi.fn(async (params) => {
      const terminalId = `term-${++counter}`;
      openedTerminals.push({ terminalId, codeSessionId: params.codeSessionId, shell: params.shell, cwd: params.cwd });
      return { terminalId };
    }),
    writeTerminalInput: vi.fn((terminalId, input) => {
      writtenInputs.push({ terminalId, input });
    }),
    closeTerminal: vi.fn((terminalId) => {
      closedTerminals.push(terminalId);
    }),
    onTerminalOutput: vi.fn((terminalId, cb) => {
      let set = outputCallbacks.get(terminalId);
      if (!set) { set = new Set(); outputCallbacks.set(terminalId, set); }
      set.add(cb);
      return () => { set!.delete(cb); };
    }),
    onTerminalExit: vi.fn((terminalId, cb) => {
      let set = exitCallbacks.get(terminalId);
      if (!set) { set = new Set(); exitCallbacks.set(terminalId, set); }
      set.add(cb);
      return () => { set!.delete(cb); };
    }),
  };
}

const BASE_CONFIG: CodingBackendsConfig = {
  enabled: true,
  backends: [
    {
      id: 'claude-code',
      name: 'Claude Code',
      enabled: true,
      command: 'claude',
      args: ['--print', '{{task}}'],
      timeoutMs: 5000,
      nonInteractive: true,
    },
  ],
  defaultBackend: 'claude-code',
  maxConcurrentSessions: 2,
  autoUpdate: false,
  versionCheckIntervalMs: 86_400_000,
};

describe('CodingBackendService', () => {
  let mock: ReturnType<typeof createMockTerminalControl>;
  let service: CodingBackendService;

  beforeEach(() => {
    mock = createMockTerminalControl();
    service = new CodingBackendService({ config: BASE_CONFIG, terminalControl: mock });
  });

  it('lists configured backends and available presets', () => {
    const backends = service.listBackends();
    const claudeCode = backends.find((b) => b.id === 'claude-code');
    expect(claudeCode).toBeDefined();
    expect(claudeCode!.enabled).toBe(true);
    // Presets not yet configured should appear as disabled
    const codex = backends.find((b) => b.id === 'codex');
    expect(codex).toBeDefined();
    expect(codex!.enabled).toBe(false);
  });

  it('resolves backend by id', () => {
    const backend = service.resolveBackend('claude-code');
    expect(backend).not.toBeNull();
    expect(backend!.command).toBe('claude');
  });

  it('uses canonical preset arguments for configured Codex backends', () => {
    const codexService = new CodingBackendService({
      config: {
        ...BASE_CONFIG,
        backends: [
          {
            id: 'codex',
            name: 'OpenAI Codex CLI',
            enabled: true,
            command: 'codex',
            args: ['--quiet', '{{task}}'],
            timeoutMs: 5000,
            nonInteractive: true,
          },
        ],
        defaultBackend: 'codex',
      },
      terminalControl: mock,
    });

    const backend = codexService.resolveBackend('codex');
    expect(backend).not.toBeNull();
    expect(backend!.command).toBe('codex');
    expect(backend!.args).toEqual(['exec', '--skip-git-repo-check', '--sandbox', 'workspace-write', '{{task}}']);
  });

  it('resolves default backend when no id given', () => {
    const backend = service.resolveBackend();
    expect(backend).not.toBeNull();
    expect(backend!.id).toBe('claude-code');
  });

  it('returns null for unknown backend', () => {
    expect(service.resolveBackend('nonexistent')).toBeNull();
  });

  it('launches a backend and captures successful output', async () => {
    const runPromise = service.run({
      task: 'fix the bug',
      codeSessionId: 'session-1',
      workspaceRoot: '/workspace',
    });

    // Let the async openTerminal resolve
    await new Promise((r) => setTimeout(r, 10));

    // Verify terminal was opened
    expect(mock.openedTerminals).toHaveLength(1);
    expect(mock.openedTerminals[0].codeSessionId).toBe('session-1');
    expect(mock.openedTerminals[0].cwd).toBe('/workspace');

    // Verify command was written
    expect(mock.writtenInputs).toHaveLength(1);
    expect(mock.writtenInputs[0].input).toContain('claude');
    expect(mock.writtenInputs[0].input).toContain('fix the bug');
    expect(mock.writtenInputs[0].input.endsWith('\nexit\n')).toBe(true);

    // Simulate output and exit
    const terminalId = mock.openedTerminals[0].terminalId;
    mock.simulateOutput(terminalId, 'Working on fix...\n');
    mock.simulateOutput(terminalId, 'Done! Fixed the bug.\n');
    mock.simulateExit(terminalId, 0);

    const result = await runPromise;
    expect(result.success).toBe(true);
    expect(result.status).toBe('succeeded');
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Fixed the bug');
    expect(result.backendId).toBe('claude-code');
  });

  it('reports failure on non-zero exit code', async () => {
    const runPromise = service.run({
      task: 'do something',
      codeSessionId: 'session-1',
      workspaceRoot: '/workspace',
    });

    await new Promise((r) => setTimeout(r, 10));
    const terminalId = mock.openedTerminals[0].terminalId;
    mock.simulateOutput(terminalId, 'Error: command not found\n');
    mock.simulateExit(terminalId, 127);

    const result = await runPromise;
    expect(result.success).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.exitCode).toBe(127);
    expect(result.output).toContain('command not found');
  });

  it('times out and kills the terminal', async () => {
    // Use a very short timeout for testing
    const shortConfig: CodingBackendsConfig = {
      ...BASE_CONFIG,
      backends: [{ ...BASE_CONFIG.backends[0], timeoutMs: 100 }],
    };
    const shortService = new CodingBackendService({ config: shortConfig, terminalControl: mock });

    const result = await shortService.run({
      task: 'long running task',
      codeSessionId: 'session-1',
      workspaceRoot: '/workspace',
    });

    // The 100ms timeout should fire before any exit event
    expect(result.success).toBe(false);
    expect(result.status).toBe('timed_out');
    expect(mock.closedTerminals.length).toBeGreaterThan(0);
  });

  it('returns error for disabled backend', async () => {
    const disabledConfig: CodingBackendsConfig = {
      ...BASE_CONFIG,
      backends: [{ ...BASE_CONFIG.backends[0], enabled: false }],
    };
    service.updateConfig(disabledConfig);

    const result = await service.run({
      task: 'test',
      backendId: 'claude-code',
      codeSessionId: 'session-1',
      workspaceRoot: '/workspace',
    });

    expect(result.success).toBe(false);
    expect(result.output).toContain('disabled');
  });

  it('returns error for unconfigured backend', async () => {
    const result = await service.run({
      task: 'test',
      backendId: 'nonexistent',
      codeSessionId: 'session-1',
      workspaceRoot: '/workspace',
    });

    expect(result.success).toBe(false);
    expect(result.output).toContain('not configured');
  });

  it('enforces concurrent session limit', async () => {
    // Use a fresh service with a short timeout so the runs resolve quickly
    const shortConfig: CodingBackendsConfig = {
      ...BASE_CONFIG,
      backends: [{ ...BASE_CONFIG.backends[0], timeoutMs: 200 }],
    };
    const shortService = new CodingBackendService({ config: shortConfig, terminalControl: mock });

    // Start two sessions (the max)
    const run1 = shortService.run({ task: 'task 1', codeSessionId: 'session-1', workspaceRoot: '/ws' });
    const run2 = shortService.run({ task: 'task 2', codeSessionId: 'session-1', workspaceRoot: '/ws' });
    await new Promise((r) => setTimeout(r, 10));

    // Third should fail immediately (sync check)
    const result3 = await shortService.run({ task: 'task 3', codeSessionId: 'session-1', workspaceRoot: '/ws' });
    expect(result3.success).toBe(false);
    expect(result3.output).toContain('Maximum concurrent');

    // Clean up — let timeouts resolve the first two
    mock.simulateExit(mock.openedTerminals[0].terminalId, 0);
    mock.simulateExit(mock.openedTerminals[1].terminalId, 0);
    await Promise.all([run1, run2]);
  });

  it('tracks session status', async () => {
    const runPromise = service.run({
      task: 'check status',
      codeSessionId: 'session-1',
      workspaceRoot: '/workspace',
    });
    await new Promise((r) => setTimeout(r, 10));

    // While running, should appear in status
    let status = service.getStatus();
    expect(status).toHaveLength(1);
    expect(status[0].status).toBe('running');

    // Complete
    mock.simulateExit(mock.openedTerminals[0].terminalId, 0);
    await runPromise;

    // After completion, should still appear in recent
    status = service.getStatus();
    expect(status).toHaveLength(1);
    expect(status[0].status).toBe('succeeded');
  });

  it('shell-quotes the task to prevent injection', async () => {
    const runPromise = service.run({
      task: "fix the bug'; rm -rf /; echo '",
      codeSessionId: 'session-1',
      workspaceRoot: '/workspace',
    });
    await new Promise((r) => setTimeout(r, 10));

    const input = mock.writtenInputs[0].input;
    // The task should be wrapped in single quotes with inner quotes escaped
    expect(input).toContain('claude --print');
    // Single quotes in the task are escaped as '\'' — the raw ; rm -rf / is inside quotes
    expect(input).toContain("'\\''");

    mock.simulateExit(mock.openedTerminals[0].terminalId, 0);
    await runPromise;
  });

  it('strips ANSI codes from output', async () => {
    const runPromise = service.run({
      task: 'test ansi',
      codeSessionId: 'session-1',
      workspaceRoot: '/workspace',
    });
    await new Promise((r) => setTimeout(r, 10));

    const terminalId = mock.openedTerminals[0].terminalId;
    mock.simulateOutput(terminalId, '\x1b[32mSuccess\x1b[0m: all tests pass\n');
    mock.simulateExit(terminalId, 0);

    const result = await runPromise;
    expect(result.output).toContain('Success: all tests pass');
    expect(result.output).not.toContain('\x1b[');
  });

  it('keeps the shell open for interactive backends', async () => {
    const interactiveService = new CodingBackendService({
      config: {
        ...BASE_CONFIG,
        backends: [{ ...BASE_CONFIG.backends[0], nonInteractive: false }],
      },
      terminalControl: mock,
    });

    const runPromise = interactiveService.run({
      task: 'interactive task',
      codeSessionId: 'session-1',
      workspaceRoot: '/workspace',
    });
    await new Promise((r) => setTimeout(r, 10));

    expect(mock.writtenInputs[0].input.endsWith('\nexit\n')).toBe(false);
    expect(mock.writtenInputs[0].input.endsWith('\n')).toBe(true);

    mock.simulateExit(mock.openedTerminals[0].terminalId, 0);
    await runPromise;
  });

  it('dispose is callable without active sessions', () => {
    // dispose should not throw when there are no active sessions
    service.dispose();
    expect(mock.closedTerminals).toHaveLength(0);
  });
});
