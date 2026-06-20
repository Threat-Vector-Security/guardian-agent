import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardCallbacks } from '../channels/web-types.js';
import { DEFAULT_CONFIG, type GuardianAgentConfig } from '../config/types.js';
import { startBootstrapChannels } from './channel-startup.js';

const ORIGINAL_CODEX_BACKEND = process.env['GUARDIAN_CODEX_BACKEND'];
const ORIGINAL_CODEX_HOST = process.env['GUARDIAN_CODEX_HOST'];

function createConfig(): GuardianAgentConfig {
  return structuredClone(DEFAULT_CONFIG) as GuardianAgentConfig;
}

function createBaseArgs(overrides: Partial<Parameters<typeof startBootstrapChannels>[0]> = {}): Parameters<typeof startBootstrapChannels>[0] {
  const config = createConfig();
  const dashboardCallbacks: DashboardCallbacks = {};
  return {
    config,
    configRef: { current: config },
    configPath: '/tmp/guardian.yaml',
    defaultAgentId: 'default-agent',
    effectiveToken: 'token-123',
    configuredToken: 'token-123',
    rotateOnStartup: false,
    webAuthStateRef: {
      current: {
        mode: 'bearer_required',
        token: 'token-123',
        tokenSource: 'config',
        rotateOnStartup: false,
      },
    },
    dashboardCallbacks,
    runtime: {
      dispatchMessage: vi.fn(async () => ({ content: 'runtime response', metadata: { ok: true } })),
    },
    channels: [],
    prepareIncomingDispatch: vi.fn(async (_channelDefault, msg) => ({
      requestId: 'req-1',
      decision: { agentId: 'routed-agent', confidence: 'high', reason: 'test routing' },
      gateway: null,
      routedMessage: {
        ...msg,
        metadata: { routed: true },
      },
    })),
    secretStore: {} as never,
    resolveCanonicalTelegramUserId: (channelUserId: string) => `canonical:${channelUserId}`,
    resolveTelegramBotToken: vi.fn(() => undefined),
    formatGuideForTelegram: () => 'guide',
    generateSecureToken: vi.fn(() => 'generated-token'),
    previewTokenForLog: (token: string) => `preview:${token}`,
    staticDir: '/tmp/web',
    codingBackendServiceRef: { current: null },
    codingBackendsDefaultConfig: config.assistant.tools.codingBackends ?? {},
    toolExecutor: {
      getRuntimeNotices: () => [{ message: 'notice-1' }],
      setCodingBackendService: vi.fn(),
    },
    listAgents: () => [],
    getRuntimeStatus: () => ({
      running: true,
      agentCount: 1,
      guardianEnabled: true,
      providers: ['ollama'],
    }),
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    stdinIsTTY: true,
    stdoutIsTTY: true,
    ...overrides,
  };
}

describe('startBootstrapChannels', () => {
  beforeEach(() => {
    delete process.env['GUARDIAN_CODEX_BACKEND'];
    delete process.env['GUARDIAN_CODEX_HOST'];
  });

  afterEach(() => {
    if (ORIGINAL_CODEX_BACKEND === undefined) {
      delete process.env['GUARDIAN_CODEX_BACKEND'];
    } else {
      process.env['GUARDIAN_CODEX_BACKEND'] = ORIGINAL_CODEX_BACKEND;
    }
    if (ORIGINAL_CODEX_HOST === undefined) {
      delete process.env['GUARDIAN_CODEX_HOST'];
    } else {
      process.env['GUARDIAN_CODEX_HOST'] = ORIGINAL_CODEX_HOST;
    }
  });

  it('starts the CLI channel and routes messages through dashboard dispatch', async () => {
    const config = createConfig();
    config.channels.cli = { enabled: true, defaultAgent: 'cli-agent' };
    config.channels.web = { enabled: false } as never;
    config.channels.telegram = { enabled: false } as never;

    const cliStart = vi.fn(async (handler) => {
      await handler({ content: 'hello', channel: 'cli' });
    });
    const cliFactory = vi.fn(() => ({
      start: cliStart,
      stop: vi.fn(async () => {}),
      send: vi.fn(async () => {}),
      postStart: vi.fn(),
    }));
    const onDispatch = vi.fn(async () => ({ content: 'dashboard response', metadata: { ok: true } }));

    const args = createBaseArgs({
      config,
      configRef: { current: config },
      dashboardCallbacks: { onDispatch },
      createCliChannel: cliFactory,
    });

    const result = await startBootstrapChannels(args);

    expect(cliFactory).toHaveBeenCalledOnce();
    expect(result.cliChannel).not.toBeNull();
    expect(onDispatch).toHaveBeenCalledOnce();
    expect(args.channels).toHaveLength(1);
    expect(args.channels[0]?.name).toBe('cli');
  });

  it('installs telegram reload behavior that swaps the active telegram channel', async () => {
    const config = createConfig();
    config.channels.cli = { enabled: false } as never;
    config.channels.web = { enabled: false } as never;
    config.channels.telegram = {
      enabled: true,
      allowedChatIds: [123],
      defaultAgent: 'telegram-agent',
    } as never;

    const firstTelegram = {
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
      send: vi.fn(async () => {}),
    };
    const secondTelegram = {
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
      send: vi.fn(async () => {}),
    };
    const telegramFactory = vi.fn()
      .mockReturnValueOnce(firstTelegram)
      .mockReturnValueOnce(secondTelegram);
    const resolveTelegramBotToken = vi.fn(() => 'telegram-token');
    const dashboardCallbacks: DashboardCallbacks = {};

    const args = createBaseArgs({
      config,
      configRef: { current: config },
      dashboardCallbacks,
      resolveTelegramBotToken,
      createTelegramChannel: telegramFactory,
    });

    const result = await startBootstrapChannels(args);
    const reloadResult = await dashboardCallbacks.onTelegramReload?.();

    expect(firstTelegram.start).toHaveBeenCalledOnce();
    expect(firstTelegram.stop).toHaveBeenCalledOnce();
    expect(secondTelegram.start).toHaveBeenCalledOnce();
    expect(resolveTelegramBotToken).toHaveBeenCalled();
    expect(reloadResult).toEqual({ success: true, message: 'Telegram channel reloaded.' });
    expect(result.getTelegramChannel()).toBe(secondTelegram);
  });

  it('starts web when Telegram startup stalls', async () => {
    const config = createConfig();
    config.channels.cli = { enabled: false } as never;
    config.channels.web = {
      enabled: true,
      host: '127.0.0.1',
      port: 18975,
    } as never;
    config.channels.telegram = {
      enabled: true,
      allowedChatIds: [123],
      defaultAgent: 'telegram-agent',
    } as never;

    const telegram = {
      start: vi.fn(() => new Promise<void>(() => {})),
      stop: vi.fn(async () => {}),
      send: vi.fn(async () => {}),
      getKnownChatIds: vi.fn(() => []),
    };
    const webChannel = {
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
      send: vi.fn(async () => {}),
      setAuthConfig: vi.fn(),
      emitDashboardInvalidation: vi.fn(),
      getCodingBackendTerminalControl: vi.fn(() => ({}) as never),
    };

    const args = createBaseArgs({
      config,
      configRef: { current: config },
      resolveTelegramBotToken: vi.fn(() => 'telegram-token'),
      createTelegramChannel: vi.fn(() => telegram),
      createWebChannel: vi.fn(() => webChannel),
      createCodingBackendService: vi.fn(() => ({ dispose: vi.fn() }) as never),
      channelStartTimeoutMs: 1,
    });

    const result = await startBootstrapChannels(args);

    expect(telegram.start).toHaveBeenCalledOnce();
    expect(webChannel.start).toHaveBeenCalledOnce();
    expect(result.webChannel).toBe(webChannel);
    expect(args.log.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'Telegram channel failed to start — continuing without it',
    );
  });

  it('installs a Codex SDK coding backend service for Telegram without requiring the web channel', async () => {
    process.env['GUARDIAN_CODEX_BACKEND'] = 'codex-sdk';
    process.env['GUARDIAN_CODEX_HOST'] = 'windows';
    const config = createConfig();
    config.channels.cli = { enabled: false } as never;
    config.channels.web = { enabled: false } as never;
    config.channels.telegram = {
      enabled: true,
      allowedChatIds: [123],
      defaultAgent: 'telegram-agent',
    } as never;

    const telegram = {
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
      send: vi.fn(async () => {}),
      getKnownChatIds: vi.fn(() => [123]),
    };
    const createTelegramChannel = vi.fn(() => telegram);
    const codingBackendService = { dispose: vi.fn() } as never;
    const createCodingBackendService = vi.fn(() => codingBackendService);
    const setCodingBackendService = vi.fn();

    const args = createBaseArgs({
      config,
      configRef: { current: config },
      resolveTelegramBotToken: vi.fn(() => 'telegram-token'),
      createTelegramChannel,
      createCodingBackendService,
      toolExecutor: {
        getRuntimeNotices: () => [],
        setCodingBackendService,
      },
    });

    await startBootstrapChannels(args);

    expect(createCodingBackendService).toHaveBeenCalledOnce();
    expect(createCodingBackendService).toHaveBeenCalledWith(expect.objectContaining({
      config: expect.objectContaining({
        enabled: true,
        defaultBackend: 'codex-sdk',
      }),
    }));
    const serviceOptions = createCodingBackendService.mock.calls[0]?.[0];
    expect(serviceOptions?.config.backends).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'codex-sdk',
        adapterKind: 'codex_sdk',
        executionHost: 'windows',
        enabled: true,
      }),
    ]));
    await expect(serviceOptions?.terminalControl.openTerminal({
      codeSessionId: 'session-1',
      shell: 'powershell',
      cwd: 'S:\\Development\\GuardianAgent',
    })).rejects.toThrow('web channel is not running');
    expect(setCodingBackendService).toHaveBeenCalledWith(codingBackendService);
    expect(createTelegramChannel).toHaveBeenCalledOnce();
    expect(telegram.start).toHaveBeenCalledOnce();
  });

  it('starts the web channel and installs the coding backend service', async () => {
    const config = createConfig();
    config.channels.cli = { enabled: false } as never;
    config.channels.telegram = { enabled: false } as never;
    config.channels.web = {
      enabled: true,
      host: '127.0.0.1',
      port: 3000,
      defaultAgent: 'web-agent',
    } as never;

    const webChannel = {
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
      send: vi.fn(async () => {}),
      setAuthConfig: vi.fn(),
      emitDashboardInvalidation: vi.fn(),
      getCodingBackendTerminalControl: vi.fn(() => ({}) as never),
    };
    const createWebChannel = vi.fn(() => webChannel);
    const codingBackendService = { dispose: vi.fn() } as never;
    const createCodingBackendService = vi.fn(() => codingBackendService);
    const setCodingBackendService = vi.fn();
    const generateSecureToken = vi.fn(() => 'generated-token');

    const args = createBaseArgs({
      config,
      configRef: { current: config },
      configuredToken: undefined,
      effectiveToken: undefined,
      webAuthStateRef: {
        current: {
          mode: 'bearer_required',
          token: undefined,
          tokenSource: 'ephemeral',
          rotateOnStartup: false,
        },
      },
      generateSecureToken,
      createWebChannel,
      createCodingBackendService,
      toolExecutor: {
        getRuntimeNotices: () => [],
        setCodingBackendService,
      },
    });

    const result = await startBootstrapChannels(args);

    expect(generateSecureToken).toHaveBeenCalledOnce();
    expect(createWebChannel).toHaveBeenCalledOnce();
    expect(createCodingBackendService).toHaveBeenCalledOnce();
    expect(setCodingBackendService).toHaveBeenCalledWith(codingBackendService);
    expect(result.webChannel).toBe(webChannel);
    expect(args.channels.at(-1)?.name).toBe('web');
  });

  it('starts the voice channel and routes device transcripts through dashboard dispatch', async () => {
    const config = createConfig();
    config.channels.cli = { enabled: false } as never;
    config.channels.telegram = { enabled: false } as never;
    config.channels.web = { enabled: false } as never;
    config.channels.voice = {
      enabled: true,
      host: '127.0.0.1',
      port: 3107,
      defaultAgent: 'voice-agent',
      auth: { mode: 'bearer_required', token: 'voice-token' },
    } as never;

    let startHandler: ((msg: { content: string; channel: string; id?: string }) => Promise<{ content: string; metadata?: Record<string, unknown> }>) | null = null;
    const voiceChannel = {
      start: vi.fn(async (handler) => {
        startHandler = handler;
      }),
      stop: vi.fn(async () => {}),
      send: vi.fn(async () => {}),
      getDevices: vi.fn(() => []),
    };
    const createVoiceChannel = vi.fn(() => voiceChannel);
    const prepareIncomingDispatch = vi.fn(async (_channelDefault, msg) => ({
      requestId: msg.requestId ?? 'voice-req',
      decision: { agentId: 'prepared-voice-agent', confidence: 'high', reason: 'prepared' },
      gateway: null,
      routedMessage: msg,
    }));

    const args = createBaseArgs({
      config,
      configRef: { current: config },
      createVoiceChannel,
      prepareIncomingDispatch,
    });

    const result = await startBootstrapChannels(args);
    await startHandler?.({ content: 'hello from voice', channel: 'voice', id: 'voice-id' });

    expect(createVoiceChannel).toHaveBeenCalledWith(expect.objectContaining({
      host: '127.0.0.1',
      port: 3107,
      defaultAgent: 'voice-agent',
      auth: { mode: 'bearer_required', token: 'voice-token' },
    }));
    expect(result.voiceChannel).toBe(voiceChannel);
    expect(args.channels.at(-1)?.name).toBe('voice');
    expect(prepareIncomingDispatch).toHaveBeenCalledWith('voice-agent', expect.objectContaining({
      content: 'hello from voice',
      channel: 'voice',
      requestId: 'voice-id',
    }));
    expect(args.runtime.dispatchMessage).toHaveBeenCalledWith('prepared-voice-agent', expect.objectContaining({
      id: 'voice-id',
      channel: 'voice',
    }));
  });

  it('skips the voice channel when bearer auth is enabled and no token resolves', async () => {
    const config = createConfig();
    config.channels.cli = { enabled: false } as never;
    config.channels.telegram = { enabled: false } as never;
    config.channels.web = { enabled: false } as never;
    config.channels.voice = {
      enabled: true,
      auth: { mode: 'bearer_required', tokenCredentialRef: 'voice.token' },
    } as never;

    const createVoiceChannel = vi.fn();
    const args = createBaseArgs({
      config,
      configRef: { current: config },
      createVoiceChannel,
    });

    const result = await startBootstrapChannels(args);

    expect(createVoiceChannel).not.toHaveBeenCalled();
    expect(result.voiceChannel).toBeNull();
    expect(args.log.error).toHaveBeenCalledWith('Voice channel skipped because bearer authentication is enabled but no token resolved');
  });

  it('normalizes reserved channel default aliases before wiring the web channel', async () => {
    const config = createConfig();
    config.channels.cli = { enabled: false } as never;
    config.channels.telegram = { enabled: false } as never;
    config.channels.web = {
      enabled: true,
      host: '127.0.0.1',
      port: 3000,
      defaultAgent: 'external',
    } as never;

    let startHandler: ((msg: { content: string; channel: string; id?: string }) => Promise<{ content: string; metadata?: Record<string, unknown> }>) | null = null;
    const webChannel = {
      start: vi.fn(async (handler) => {
        startHandler = handler;
      }),
      stop: vi.fn(async () => {}),
      send: vi.fn(async () => {}),
      setAuthConfig: vi.fn(),
      emitDashboardInvalidation: vi.fn(),
      getCodingBackendTerminalControl: vi.fn(() => ({}) as never),
    };
    const createWebChannel = vi.fn(() => webChannel);
    const prepareIncomingDispatch = vi.fn(async (_channelDefault, msg) => ({
      requestId: msg.requestId ?? 'req-2',
      decision: { agentId: 'prepared-agent', confidence: 'high', reason: 'prepared' },
      gateway: null,
      routedMessage: msg,
    }));

    const args = createBaseArgs({
      config,
      configRef: { current: config },
      createWebChannel,
      prepareIncomingDispatch,
      resolveConfiguredAgentId: (agentId?: string) => agentId === 'external' ? undefined : agentId,
    });

    await startBootstrapChannels(args);
    await startHandler?.({ content: 'hello', channel: 'web', id: 'req-from-web-route' });

    expect(createWebChannel).toHaveBeenCalledWith(expect.objectContaining({
      defaultAgent: 'default-agent',
    }));
    expect(prepareIncomingDispatch).toHaveBeenCalledWith('default-agent', expect.objectContaining({
      content: 'hello',
      channel: 'web',
      requestId: 'req-from-web-route',
    }));
    expect(args.runtime.dispatchMessage).toHaveBeenCalledWith('prepared-agent', expect.objectContaining({
      id: 'req-from-web-route',
      requestId: 'req-from-web-route',
    }));
  });
});
