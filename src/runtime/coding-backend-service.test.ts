import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CodingBackendService } from './coding-backend-service.js';
import type { CodingBackendTerminalControl } from '../channels/web-types.js';
import type { CodingBackendsConfig } from '../config/types.js';

const codexSdkMockState = vi.hoisted(() => ({
  tasks: [] as string[],
  turnOptions: [] as unknown[],
  resumedThreadIds: [] as string[],
}));

vi.mock('@openai/codex-sdk', () => ({
  Codex: class MockCodex {
    startThread() {
      return createMockThread('thread-test');
    }

    resumeThread(threadId: string) {
      codexSdkMockState.resumedThreadIds.push(threadId);
      return createMockThread(threadId);
    }
  },
}));

function createMockThread(threadId: string) {
      return {
        id: threadId,
        async runStreamed(task = '', turnOptions?: unknown) {
          codexSdkMockState.tasks.push(task);
          codexSdkMockState.turnOptions.push(turnOptions);
          async function* events() {
            yield { type: 'thread.started', thread_id: threadId };
            yield { type: 'turn.started' };
            if (task.includes('User task:\nhang without sdk completion')) {
              await new Promise<never>(() => {});
            }
            if (task.includes('structured host launch') || task.includes('structured invalid host launch')) {
              const invalidHost = task.includes('structured invalid host launch');
              yield {
                type: 'item.completed',
                item: {
                  id: 'cmd-1',
                  type: 'command_execution',
                  command: 'node --check server.js',
                  status: 'completed',
                  aggregated_output: '',
                  exit_code: 0,
                },
              };
              yield {
                type: 'item.completed',
                item: {
                  id: 'item-1',
                  type: 'agent_message',
                  text: JSON.stringify({
                    status: 'completed',
                    summary: 'Built a dependency-free prototype app.',
                    filesChanged: ['server.js', 'public/index.html'],
                    verification: [
                      { name: 'Node syntax check', status: 'passed', evidence: 'node --check server.js' },
                    ],
                    localServer: {
                      requested: true,
                      persistentStarted: false,
                      startCommand: 'node server.js',
                      url: invalidHost ? 'https://example.com' : 'http://127.0.0.1:5123',
                      healthUrl: invalidHost ? 'https://example.com/api/status' : 'http://127.0.0.1:5123/api/status',
                    },
                    nextSteps: [],
                  }),
                },
              };
              yield {
                type: 'turn.completed',
                usage: {
                  input_tokens: 1,
                  cached_input_tokens: 0,
                  output_tokens: 1,
                  reasoning_output_tokens: 0,
                },
              };
              return;
            }
            yield {
              type: 'item.completed',
              item: { id: 'item-1', type: 'agent_message', text: 'Codex SDK finished the delegated task.' },
            };
            yield {
              type: 'turn.completed',
              usage: {
                input_tokens: 1,
                cached_input_tokens: 0,
                output_tokens: 1,
                reasoning_output_tokens: 0,
              },
            };
            if (task.includes('cleanup parse noise')) {
              throw new Error('Failed to parse item: SUCCESS: The process with PID 1234 (child process of PID 5678) has been terminated.');
            }
          }
          return { events: events() };
        },
      };
}

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

function toHostCapturePath(pathValue: string): string {
  const mnt = pathValue.match(/^\/mnt\/([a-zA-Z])\/(.*)$/);
  if (mnt) {
    const drive = mnt[1].toUpperCase();
    const rest = mnt[2].replace(/\//g, '\\');
    return `${drive}:\\${rest}`;
  }
  return pathValue;
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
    codexSdkMockState.tasks.length = 0;
    codexSdkMockState.turnOptions.length = 0;
    codexSdkMockState.resumedThreadIds.length = 0;
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
    expect(backend!.args).toEqual([
      'exec',
      '--skip-git-repo-check',
      '--sandbox',
      'workspace-write',
      '{{assistant_response_args}}',
      '{{task}}',
    ]);
  });

  it('captures Codex assistant responses separately from the raw terminal transcript', async () => {
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

    const runPromise = codexService.run({
      task: 'Summarize the repository',
      codeSessionId: 'session-1',
      workspaceRoot: '/workspace',
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(mock.writtenInputs).toHaveLength(1);
    expect(mock.writtenInputs[0].input).toContain('--output-last-message');
    const capturePath = mock.writtenInputs[0].input.match(/--output-last-message '([^']+)'/)?.[1];
    expect(capturePath).toBeTruthy();
    await writeFile(toHostCapturePath(capturePath!), 'GuardianAgent is a security-first AI assistant platform.\n', 'utf8');

    const terminalId = mock.openedTerminals[0].terminalId;
    mock.simulateOutput(terminalId, 'bash-5.2$ codex exec ...\n');
    mock.simulateOutput(terminalId, 'OpenAI Codex CLI completed.\n');
    mock.simulateExit(terminalId, 0);

    const result = await runPromise;
    expect(result.assistantResponse).toBe('GuardianAgent is a security-first AI assistant platform.');
    expect(result.output).toContain('OpenAI Codex CLI completed.');
    expect(result.output).not.toContain('GuardianAgent is a security-first AI assistant platform.');
  });

  it('runs Codex through the SDK backend without opening a terminal', async () => {
    const codexSdkService = new CodingBackendService({
      config: {
        ...BASE_CONFIG,
        backends: [
          {
            id: 'codex-sdk',
            name: 'OpenAI Codex SDK',
            enabled: true,
            adapterKind: 'codex_sdk',
            executionHost: 'windows',
            command: 'codex-sdk',
            args: ['{{task}}'],
            timeoutMs: 5000,
            nonInteractive: true,
          },
        ],
        defaultBackend: 'codex-sdk',
      },
      terminalControl: mock,
    });
    const progressDetails: string[] = [];
    codexSdkService.subscribeProgress((event) => {
      if (event.detail) progressDetails.push(event.detail);
    });

    const result = await codexSdkService.run({
      task: 'Summarize the repository',
      codeSessionId: 'session-1',
      workspaceRoot: '/workspace',
      requestId: 'req-sdk',
    });

    expect(result.success).toBe(true);
    expect(result.backendId).toBe('codex-sdk');
    expect(result.assistantResponse).toBe('Codex SDK finished the delegated task.');
    expect(result.output).toBe('Codex SDK finished the delegated task.');
    expect(result.terminalTabId).toMatch(/^sdk:/);
    expect(mock.openedTerminals).toHaveLength(0);
    expect(codexSdkMockState.tasks[0]).toContain('You are the delegated Codex SDK coding worker');
    expect(codexSdkMockState.tasks[0]).toContain('Do not call Guardian APIs');
    expect(codexSdkMockState.tasks[0]).toContain('If browser automation tools are unavailable');
    expect(codexSdkMockState.tasks[0]).toContain('Do not load or follow Codex Desktop Browser skill instructions');
    expect(codexSdkMockState.tasks[0]).toContain('do not spend time trying to keep a detached child process alive');
    expect(codexSdkMockState.tasks[0]).toContain('Guardian can start and verify the persistent process from the host');
    expect(codexSdkMockState.tasks[0]).toContain('Return only JSON matching the provided output schema');
    expect(codexSdkMockState.tasks[0]).toContain('User task:\nSummarize the repository');
    expect(codexSdkMockState.turnOptions[0]).toMatchObject({
      outputSchema: expect.objectContaining({
        type: 'object',
        required: expect.arrayContaining(['status', 'summary', 'filesChanged', 'verification', 'localServer', 'nextSteps']),
      }),
    });
    const outputSchema = (codexSdkMockState.turnOptions[0] as { outputSchema: Record<string, unknown> }).outputSchema;
    expect(outputSchema.properties).toMatchObject({
      verification: {
        items: {
          required: expect.arrayContaining(['name', 'status', 'evidence']),
        },
      },
      localServer: {
        required: expect.arrayContaining(['requested', 'persistentStarted', 'startCommand', 'url', 'healthUrl', 'notes']),
      },
    });
    expect(progressDetails).toContain('Started a Codex SDK thread.');
    expect(progressDetails).toContain('Codex SDK completed.');
  });

  it('times out Codex SDK runs when the SDK event stream stalls', async () => {
    const codexSdkService = new CodingBackendService({
      config: {
        ...BASE_CONFIG,
        backends: [
          {
            id: 'codex-sdk',
            name: 'OpenAI Codex SDK',
            enabled: true,
            adapterKind: 'codex_sdk',
            executionHost: 'windows',
            command: 'codex-sdk',
            args: ['{{task}}'],
            timeoutMs: 25,
            nonInteractive: true,
          },
        ],
        defaultBackend: 'codex-sdk',
      },
      terminalControl: mock,
    });
    const progressDetails: string[] = [];
    codexSdkService.subscribeProgress((event) => {
      if (event.detail) progressDetails.push(event.detail);
    });

    const result = await codexSdkService.run({
      task: 'hang without sdk completion',
      codeSessionId: 'session-1',
      workspaceRoot: '/workspace',
      requestId: 'req-sdk-timeout',
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('timed_out');
    expect(result.sdkThreadId).toBe('thread-test');
    expect(result.resumable).toBe(true);
    expect(result.output).toContain('Codex SDK did not finish before the timeout.');
    expect(result.output).toContain('Thread ID: thread-test');
    expect(result.output).toContain('Recent SDK progress:');
    expect(result.output).toContain('Codex SDK is working in the attached workspace.');
    expect(result.output).toContain('Resume: ask Guardian to continue the latest Codex SDK run');
    expect(result.terminalTabId).toMatch(/^sdk:/);
    expect(mock.openedTerminals).toHaveLength(0);
    expect(codexSdkService.getStatus()[0].status).toBe('timed_out');
    expect(codexSdkService.getStatus()[0].sdkThreadId).toBe('thread-test');
    expect(codexSdkService.getStatus()[0].resumable).toBe(true);
    expect(progressDetails).toContain('Started a Codex SDK thread.');
    expect(progressDetails).toContain('Codex SDK did not finish before the timeout.');
  });

  it('resumes the latest timed-out Codex SDK thread for the current workspace', async () => {
    const codexSdkService = new CodingBackendService({
      config: {
        ...BASE_CONFIG,
        backends: [
          {
            id: 'codex-sdk',
            name: 'OpenAI Codex SDK',
            enabled: true,
            adapterKind: 'codex_sdk',
            executionHost: 'windows',
            command: 'codex-sdk',
            args: ['{{task}}'],
            timeoutMs: 25,
            nonInteractive: true,
          },
        ],
        defaultBackend: 'codex-sdk',
      },
      terminalControl: mock,
    });

    const timedOut = await codexSdkService.run({
      task: 'hang without sdk completion',
      codeSessionId: 'session-1',
      workspaceRoot: '/workspace',
      requestId: 'req-sdk-timeout',
    });
    expect(timedOut.status).toBe('timed_out');
    expect(timedOut.sessionId).toBeDefined();
    expect(timedOut.sdkThreadId).toBe('thread-test');

    const resumed = await codexSdkService.run({
      task: 'finish the previous SDK work',
      codeSessionId: 'session-1',
      workspaceRoot: '/workspace',
      requestId: 'req-sdk-resume',
      resumeLatest: true,
    });

    expect(codexSdkMockState.resumedThreadIds).toEqual(['thread-test']);
    expect(codexSdkMockState.tasks.at(-1)).toContain('This is a resumed SDK thread.');
    expect(resumed.success).toBe(true);
    expect(resumed.status).toBe('succeeded');
    expect(resumed.sdkThreadId).toBe('thread-test');
    expect(resumed.resumedFromSessionId).toBe(timedOut.sessionId);
    expect(resumed.resumedFromThreadId).toBe('thread-test');
    expect(resumed.resumable).toBe(false);
  });

  it('keeps an active Codex SDK project thread after success and resumes it for the next task', async () => {
    const codexSdkService = new CodingBackendService({
      config: {
        ...BASE_CONFIG,
        backends: [
          {
            id: 'codex-sdk',
            name: 'OpenAI Codex SDK',
            enabled: true,
            adapterKind: 'codex_sdk',
            executionHost: 'windows',
            command: 'codex-sdk',
            args: ['{{task}}'],
            timeoutMs: 5000,
            nonInteractive: true,
          },
        ],
        defaultBackend: 'codex-sdk',
      },
      terminalControl: mock,
    });

    const first = await codexSdkService.run({
      task: 'Draft the design for the feature',
      codeSessionId: 'session-1',
      workspaceRoot: '/workspace',
      requestId: 'req-sdk-project-first',
    });
    expect(first.success).toBe(true);
    expect(first.codexProject).toMatchObject({
      activeThreadId: 'thread-test',
      projectObjective: 'Draft the design for the feature',
      lastRunStatus: 'succeeded',
    });

    const second = await codexSdkService.run({
      task: 'Implement the first approved phase',
      codeSessionId: 'session-1',
      workspaceRoot: '/workspace',
      requestId: 'req-sdk-project-second',
    });

    expect(codexSdkMockState.resumedThreadIds).toEqual(['thread-test']);
    expect(codexSdkMockState.tasks.at(-1)).toContain('active project-driver thread');
    expect(codexSdkMockState.tasks.at(-1)).toContain('Project objective: Draft the design for the feature');
    expect(codexSdkMockState.tasks.at(-1)).toContain('Last checkpoint: Codex SDK finished the delegated task.');
    expect(second.success).toBe(true);
    expect(second.resumedFromThreadId).toBe('thread-test');
    expect(codexSdkService.getCodexProjectStatus('session-1')[0]).toMatchObject({
      activeThreadId: 'thread-test',
      projectObjective: 'Draft the design for the feature',
      lastRunStatus: 'succeeded',
    });
  });

  it('resumes the latest Codex SDK thread after backend session history is reloaded', async () => {
    const stateRoot = await mkdtemp(join(tmpdir(), 'guardianagent-coding-backend-state-'));
    const recentSessionsPath = join(stateRoot, 'coding-backend-sessions.json');
    const config: CodingBackendsConfig = {
      ...BASE_CONFIG,
      backends: [
        {
          id: 'codex-sdk',
          name: 'OpenAI Codex SDK',
          enabled: true,
          adapterKind: 'codex_sdk',
          executionHost: 'windows',
          command: 'codex-sdk',
          args: ['{{task}}'],
          timeoutMs: 25,
          nonInteractive: true,
        },
      ],
      defaultBackend: 'codex-sdk',
    };

    try {
      const firstService = new CodingBackendService({
        config,
        terminalControl: mock,
        recentSessionsPath,
      });
      const timedOut = await firstService.run({
        task: 'hang without sdk completion',
        codeSessionId: 'session-1',
        workspaceRoot: '/workspace',
        requestId: 'req-sdk-timeout',
      });
      expect(timedOut.status).toBe('timed_out');
      expect(timedOut.sdkThreadId).toBe('thread-test');

      const reloadedService = new CodingBackendService({
        config,
        terminalControl: mock,
        recentSessionsPath,
      });
      expect(reloadedService.getStatus()[0]).toMatchObject({
        status: 'timed_out',
        sdkThreadId: 'thread-test',
        resumable: true,
      });

      const resumed = await reloadedService.run({
        task: 'finish the previous SDK work after restart',
        codeSessionId: 'session-1',
        workspaceRoot: '/workspace',
        requestId: 'req-sdk-resume-after-reload',
        resumeLatest: true,
      });

      expect(codexSdkMockState.resumedThreadIds).toEqual(['thread-test']);
      expect(resumed.success).toBe(true);
      expect(resumed.sdkThreadId).toBe('thread-test');
      expect(resumed.resumedFromSessionId).toBe(timedOut.sessionId);
    } finally {
      await rm(stateRoot, { recursive: true, force: true });
    }
  });

  it('refreshes persisted Codex SDK session history before resolving resumeLatest', async () => {
    const stateRoot = await mkdtemp(join(tmpdir(), 'guardianagent-coding-backend-state-'));
    const recentSessionsPath = join(stateRoot, 'coding-backend-sessions.json');
    const config: CodingBackendsConfig = {
      ...BASE_CONFIG,
      backends: [
        {
          id: 'codex-sdk',
          name: 'OpenAI Codex SDK',
          enabled: true,
          adapterKind: 'codex_sdk',
          executionHost: 'windows',
          command: 'codex-sdk',
          args: ['{{task}}'],
          timeoutMs: 5000,
          nonInteractive: true,
        },
      ],
      defaultBackend: 'codex-sdk',
    };

    try {
      const staleService = new CodingBackendService({
        config,
        terminalControl: mock,
        recentSessionsPath,
      });
      await writeFile(recentSessionsPath, JSON.stringify({
        version: 1,
        sessions: [
          {
            id: 'persisted-failed-sdk-run',
            backendId: 'codex-sdk',
            backendName: 'OpenAI Codex SDK',
            codeSessionId: 'session-1',
            terminalId: 'sdk:persisted-failed-sdk-run',
            task: 'failed before resume',
            status: 'failed',
            startedAt: Date.now() - 1000,
            completedAt: Date.now() - 500,
            durationMs: 500,
            sdkThreadId: 'thread-from-persisted-state',
            resumable: true,
          },
        ],
      }), 'utf8');

      const resumed = await staleService.run({
        task: 'finish persisted failed SDK work',
        codeSessionId: 'session-1',
        workspaceRoot: '/workspace',
        requestId: 'req-sdk-resume-from-refreshed-state',
        resumeLatest: true,
      });

      expect(codexSdkMockState.resumedThreadIds).toEqual(['thread-from-persisted-state']);
      expect(resumed.success).toBe(true);
      expect(resumed.sdkThreadId).toBe('thread-from-persisted-state');
      expect(resumed.resumedFromSessionId).toBe('persisted-failed-sdk-run');
    } finally {
      await rm(stateRoot, { recursive: true, force: true });
    }
  });

  it('resumes an explicit Codex SDK thread id without recent in-memory session state', async () => {
    const codexSdkService = new CodingBackendService({
      config: {
        ...BASE_CONFIG,
        backends: [
          {
            id: 'codex-sdk',
            name: 'OpenAI Codex SDK',
            enabled: true,
            adapterKind: 'codex_sdk',
            executionHost: 'windows',
            command: 'codex-sdk',
            args: ['{{task}}'],
            timeoutMs: 5000,
            nonInteractive: true,
          },
        ],
        defaultBackend: 'codex-sdk',
      },
      terminalControl: mock,
    });

    const result = await codexSdkService.run({
      task: 'continue explicit thread',
      codeSessionId: 'session-1',
      workspaceRoot: '/workspace',
      requestId: 'req-sdk-explicit-thread',
      resumeThreadId: 'thread-from-telegram',
    });

    expect(codexSdkMockState.resumedThreadIds).toEqual(['thread-from-telegram']);
    expect(result.success).toBe(true);
    expect(result.sdkThreadId).toBe('thread-from-telegram');
    expect(result.resumedFromThreadId).toBe('thread-from-telegram');
  });

  it('selects an enabled Codex SDK backend for explicit thread resume even when the default backend is CLI', async () => {
    const codexSdkService = new CodingBackendService({
      config: {
        ...BASE_CONFIG,
        backends: [
          {
            id: 'codex',
            name: 'OpenAI Codex CLI',
            enabled: true,
            adapterKind: 'terminal_cli',
            command: 'codex',
            args: ['exec', '{{task}}'],
            timeoutMs: 5000,
            nonInteractive: true,
          },
          {
            id: 'codex-sdk',
            name: 'OpenAI Codex SDK',
            enabled: true,
            adapterKind: 'codex_sdk',
            executionHost: 'windows',
            command: 'codex-sdk',
            args: ['{{task}}'],
            timeoutMs: 5000,
            nonInteractive: true,
          },
        ],
        defaultBackend: 'codex',
      },
      terminalControl: mock,
    });

    const result = await codexSdkService.run({
      task: 'continue explicit thread',
      codeSessionId: 'session-1',
      workspaceRoot: '/workspace',
      requestId: 'req-sdk-explicit-thread',
      resumeThreadId: 'thread-from-telegram',
    });

    expect(codexSdkMockState.resumedThreadIds).toEqual(['thread-from-telegram']);
    expect(result.success).toBe(true);
    expect(result.backendId).toBe('codex-sdk');
    expect(mock.openedTerminals).toHaveLength(0);
  });

  it('treats Windows Codex SDK cleanup parse noise as success after turn completion', async () => {
    const codexSdkService = new CodingBackendService({
      config: {
        ...BASE_CONFIG,
        backends: [
          {
            id: 'codex-sdk',
            name: 'OpenAI Codex SDK',
            enabled: true,
            adapterKind: 'codex_sdk',
            executionHost: 'windows',
            command: 'codex-sdk',
            args: ['{{task}}'],
            timeoutMs: 5000,
            nonInteractive: true,
          },
        ],
        defaultBackend: 'codex-sdk',
      },
      terminalControl: mock,
    });
    const progressDetails: string[] = [];
    codexSdkService.subscribeProgress((event) => {
      if (event.detail) progressDetails.push(event.detail);
    });

    const result = await codexSdkService.run({
      task: 'cleanup parse noise',
      codeSessionId: 'session-1',
      workspaceRoot: '/workspace',
      requestId: 'req-sdk-cleanup',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('succeeded');
    expect(result.exitCode).toBe(0);
    expect(result.assistantResponse).toBe('Codex SDK finished the delegated task.');
    expect(result.output).toBe('Codex SDK finished the delegated task.');
    expect(mock.openedTerminals).toHaveLength(0);
    expect(progressDetails).toContain('Codex SDK completed; ignored Windows cleanup output.');
  });

  it('uses structured Codex SDK output to start requested local servers in a host terminal', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const codexSdkService = new CodingBackendService({
        config: {
          ...BASE_CONFIG,
          backends: [
            {
              id: 'codex-sdk',
              name: 'OpenAI Codex SDK',
              enabled: true,
              adapterKind: 'codex_sdk',
              executionHost: 'windows',
              command: 'codex-sdk',
              args: ['{{task}}'],
              timeoutMs: 5000,
              nonInteractive: true,
            },
          ],
          defaultBackend: 'codex-sdk',
        },
        terminalControl: mock,
      });
      const progressDetails: string[] = [];
      codexSdkService.subscribeProgress((event) => {
        if (event.detail) progressDetails.push(event.detail);
      });

      const result = await codexSdkService.run({
        task: 'structured host launch',
        codeSessionId: 'session-1',
        workspaceRoot: '/workspace',
        requestId: 'req-sdk-structured-host',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('succeeded');
      expect(result.terminalTabId).toBe('term-1');
      expect(result.output).toContain('Codex SDK status: completed');
      expect(result.output).toContain('Built a dependency-free prototype app.');
      expect(result.output).toContain('Guardian host start:');
      expect(result.output).toContain('Started in a Guardian terminal and verified HTTP 200.');
      expect(mock.openedTerminals).toHaveLength(1);
      expect(mock.openedTerminals[0]).toMatchObject({
        terminalId: 'term-1',
        codeSessionId: 'session-1',
        cwd: '/workspace',
      });
      expect(mock.writtenInputs).toEqual([{ terminalId: 'term-1', input: 'node server.js\n' }]);
      expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:5123/api/status', expect.any(Object));
      expect(progressDetails).toContain('Codex SDK command completed exit 0: node --check server.js');
      expect(progressDetails).toContain('Starting the local app in a Guardian-owned terminal.');
      expect(progressDetails).toContain('Verified the local app over HTTP.');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('does not mark completed SDK work failed just because host persistent start is unavailable', async () => {
    const codexSdkService = new CodingBackendService({
      config: {
        ...BASE_CONFIG,
        backends: [
          {
            id: 'codex-sdk',
            name: 'OpenAI Codex SDK',
            enabled: true,
            adapterKind: 'codex_sdk',
            executionHost: 'windows',
            command: 'codex-sdk',
            args: ['{{task}}'],
            timeoutMs: 5000,
            nonInteractive: true,
          },
        ],
        defaultBackend: 'codex-sdk',
      },
      terminalControl: mock,
    });

    const result = await codexSdkService.run({
      task: 'structured invalid host launch',
      codeSessionId: 'session-1',
      workspaceRoot: '/workspace',
      requestId: 'req-sdk-invalid-host',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('succeeded');
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Guardian host start:');
    expect(result.output).toContain('Skipped host start because the SDK did not provide a loopback HTTP URL');
    expect(result.output).toContain('Treat the URL as not currently live');
    expect(result.codexProject).toMatchObject({
      activeThreadId: 'thread-test',
      lastRunStatus: 'succeeded',
      lastHostFollowupStatus: 'failed',
    });
    expect(mock.openedTerminals).toHaveLength(0);
  });

  it('summarizes Codex terminal transcript progress without exposing raw execution logs', async () => {
    const codexService = new CodingBackendService({
      config: {
        ...BASE_CONFIG,
        backends: [
          {
            id: 'codex',
            name: 'OpenAI Codex CLI',
            enabled: true,
            command: 'codex',
            args: ['exec', '--skip-git-repo-check', '--sandbox', 'workspace-write', '{{assistant_response_args}}', '{{task}}'],
            timeoutMs: 5000,
            nonInteractive: true,
          },
        ],
        defaultBackend: 'codex',
      },
      terminalControl: mock,
    });
    const progressDetails: string[] = [];
    codexService.subscribeProgress((event) => {
      if (event.kind === 'progress' || event.kind === 'completed') {
        progressDetails.push(event.detail ?? '');
      }
    });

    const runPromise = codexService.run({ task: 'Improve the app', codeSessionId: 's', workspaceRoot: '/w' });
    await new Promise((r) => setTimeout(r, 10));
    const terminalId = mock.openedTerminals[0].terminalId;
    mock.simulateOutput(terminalId,
      '/mnt/s/Development/MusicApp\n'
      + 'exec\n'
      + '/bin/bash -lc "sed -n \'1,260p\' index.html" in /mnt/s/Development/MusicApp\n'
      + 'succeeded in 114ms:\n'
      + '<!DOCTYPE html>\n',
    );
    mock.simulateExit(terminalId, 0);
    await runPromise;

    expect(progressDetails.length).toBeGreaterThan(0);
    const joined = progressDetails.join('\n');
    expect(joined).toMatch(/Working in the attached workspace|Running a workspace command|Workspace command finished/);
    expect(joined).not.toContain('/bin/bash -lc');
    expect(joined).not.toContain('sed -n');
    expect(joined).not.toContain('<!DOCTYPE html>');
    expect(joined).not.toContain('/mnt/s/Development/MusicApp');
  });

  it('falls back to parsing the Codex marker block when the capture file is empty', async () => {
    const codexService = new CodingBackendService({
      config: {
        ...BASE_CONFIG,
        backends: [
          {
            id: 'codex',
            name: 'OpenAI Codex CLI',
            enabled: true,
            command: 'codex',
            args: ['exec', '--skip-git-repo-check', '--sandbox', 'workspace-write', '{{assistant_response_args}}', '{{task}}'],
            timeoutMs: 5000,
            nonInteractive: true,
          },
        ],
        defaultBackend: 'codex',
      },
      terminalControl: mock,
    });

    const runPromise = codexService.run({ task: 't', codeSessionId: 's', workspaceRoot: '/w' });
    await new Promise((r) => setTimeout(r, 10));
    const terminalId = mock.openedTerminals[0].terminalId;
    mock.simulateOutput(terminalId,
      'bash-5.2$ codex exec ...\n'
      + 'some setup chatter\n'
      + 'codex\n'
      + 'This repo is GuardianAgent, a security-first AI assistant platform.\n'
      + 'tokens used\n33,189\nbash-5.2$ exit\n',
    );
    mock.simulateExit(terminalId, 0);
    const result = await runPromise;
    expect(result.assistantResponse).toBe('This repo is GuardianAgent, a security-first AI assistant platform.');
  });

  it('falls back to shell-wrapper stripping for Claude Code output', async () => {
    const claudeService = new CodingBackendService({
      config: {
        ...BASE_CONFIG,
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
      },
      terminalControl: mock,
    });

    const runPromise = claudeService.run({ task: 't', codeSessionId: 's', workspaceRoot: '/w' });
    await new Promise((r) => setTimeout(r, 10));
    const terminalId = mock.openedTerminals[0].terminalId;
    mock.simulateOutput(terminalId,
      'bash-5.2$ claude --print ...\n'
      + 'This repo is GuardianAgent.\nIt provides an event-driven agent system.\n'
      + 'exit\nbash-5.2$ exit\n',
    );
    mock.simulateExit(terminalId, 0);
    const result = await runPromise;
    expect(result.assistantResponse).toBe('This repo is GuardianAgent.\nIt provides an event-driven agent system.');
  });

  it('falls back to shell-wrapper stripping for Gemini CLI output', async () => {
    const geminiService = new CodingBackendService({
      config: {
        ...BASE_CONFIG,
        backends: [
          {
            id: 'gemini-cli',
            name: 'Gemini CLI',
            enabled: true,
            command: 'gemini',
            args: ['{{task}}'],
            timeoutMs: 5000,
            nonInteractive: true,
          },
        ],
        defaultBackend: 'gemini-cli',
      },
      terminalControl: mock,
    });

    const runPromise = geminiService.run({ task: 't', codeSessionId: 's', workspaceRoot: '/w' });
    await new Promise((r) => setTimeout(r, 10));
    const terminalId = mock.openedTerminals[0].terminalId;
    mock.simulateOutput(terminalId,
      'bash-5.2$ gemini ...\n'
      + 'Hello from Gemini.\n'
      + 'exit\nbash-5.2$ exit\n',
    );
    mock.simulateExit(terminalId, 0);
    const result = await runPromise;
    expect(result.assistantResponse).toBe('Hello from Gemini.');
  });

  it('falls back to extracting the last assistant block for Aider output', async () => {
    const aiderService = new CodingBackendService({
      config: {
        ...BASE_CONFIG,
        backends: [
          {
            id: 'aider',
            name: 'Aider',
            enabled: true,
            command: 'aider',
            args: ['--message', '{{task}}', '--yes'],
            timeoutMs: 5000,
            nonInteractive: true,
          },
        ],
        defaultBackend: 'aider',
      },
      terminalControl: mock,
    });

    const runPromise = aiderService.run({ task: 't', codeSessionId: 's', workspaceRoot: '/w' });
    await new Promise((r) => setTimeout(r, 10));
    const terminalId = mock.openedTerminals[0].terminalId;
    mock.simulateOutput(terminalId,
      'bash-5.2$ aider --message ...\n'
      + 'Aider v0.50.0\nAdded file foo.ts to the chat.\n'
      + '> what does this repo do?\n'
      + 'This repo is GuardianAgent.\nIt orchestrates agents.\n'
      + 'Tokens: 12,345 sent\nbash-5.2$ exit\n',
    );
    mock.simulateExit(terminalId, 0);
    const result = await runPromise;
    expect(result.assistantResponse).toContain('This repo is GuardianAgent.');
    expect(result.assistantResponse).toContain('It orchestrates agents.');
    expect(result.assistantResponse).not.toContain('Tokens:');
  });

  it('resolves default backend when no id given', () => {
    const backend = service.resolveBackend();
    expect(backend).not.toBeNull();
    expect(backend!.id).toBe('claude-code');
  });

  it('returns null for unknown backend', () => {
    expect(service.resolveBackend('nonexistent')).toBeNull();
  });

  it('does not resolve preset-only backends unless they are configured', () => {
    expect(service.resolveBackend('gemini-cli')).toBeNull();
  });

  it('launches a backend and captures successful output', async () => {
    const progressEvents: Array<{
      kind: string;
      runId: string;
      detail?: string;
    }> = [];
    service.subscribeProgress((event) => {
      progressEvents.push({
        kind: event.kind,
        runId: event.runId,
        detail: event.detail,
      });
    });

    const runPromise = service.run({
      task: 'fix the bug',
      codeSessionId: 'session-1',
      workspaceRoot: '/workspace',
      requestId: 'req-1',
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
    expect(progressEvents.map((event) => event.kind)).toEqual(['started', 'progress', 'completed']);
    expect(progressEvents.every((event) => event.runId === 'req-1')).toBe(true);
    expect(progressEvents[2]?.detail).toContain('Done! Fixed the bug.');
  });

  it('prepends AGENTS.md instructions to coding backend tasks when available', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'guardian-coding-backend-'));
    try {
      await writeFile(join(workspaceRoot, 'AGENTS.md'), 'Always run the focused verifier.');

      const runPromise = service.run({
        task: 'continue the migration',
        codeSessionId: 'session-1',
        workspaceRoot,
        requestId: 'req-instructions',
      });

      await new Promise((r) => setTimeout(r, 10));
      const terminalId = mock.openedTerminals[0].terminalId;
      const written = mock.writtenInputs[0]?.input ?? '';
      expect(written).toContain('Workspace instructions loaded from AGENTS.md');
      expect(written).toContain('Always run the focused verifier.');
      expect(written).toContain('User task:');
      expect(written).toContain('continue the migration');

      mock.simulateOutput(terminalId, 'done\n');
      mock.simulateExit(terminalId, 0);
      await runPromise;
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('uses CLAUDE.md when AGENTS.md is unavailable', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'guardian-coding-backend-'));
    try {
      await writeFile(join(workspaceRoot, 'CLAUDE.md'), 'Use the project-local fallback instructions.');

      const runPromise = service.run({
        task: 'inspect the repo',
        codeSessionId: 'session-1',
        workspaceRoot,
      });

      await new Promise((r) => setTimeout(r, 10));
      const terminalId = mock.openedTerminals[0].terminalId;
      const written = mock.writtenInputs[0]?.input ?? '';
      expect(written).toContain('Workspace instructions loaded from CLAUDE.md');
      expect(written).toContain('Use the project-local fallback instructions.');

      mock.simulateOutput(terminalId, 'done\n');
      mock.simulateExit(terminalId, 0);
      await runPromise;
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
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

  it('returns error for preset backends that are not enabled in config', async () => {
    const result = await service.run({
      task: 'test',
      backendId: 'gemini-cli',
      codeSessionId: 'session-1',
      workspaceRoot: '/workspace',
    });

    expect(result.success).toBe(false);
    expect(result.output).toContain('not enabled');
    expect(mock.openedTerminals).toHaveLength(0);
  });

  it('returns an orchestration-disabled error when the master switch is off', async () => {
    service.updateConfig({
      ...BASE_CONFIG,
      enabled: false,
    });

    const result = await service.run({
      task: 'test',
      backendId: 'claude-code',
      codeSessionId: 'session-1',
      workspaceRoot: '/workspace',
    });

    expect(result.success).toBe(false);
    expect(result.output).toContain('orchestration is not enabled');
    expect(mock.openedTerminals).toHaveLength(0);
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
