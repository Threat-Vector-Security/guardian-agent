import { randomUUID } from 'node:crypto';
import { CLIChannel } from '../channels/cli.js';
import { TelegramChannel } from '../channels/telegram.js';
import { VoiceChannel } from '../channels/voice.js';
import {
  ElevenLabsVoiceTranscriber,
  LocalCommandVoiceTranscriber,
  OpenAICompatibleVoiceTranscriber,
  OpenRouterVoiceTranscriber,
  type VoiceTranscriber,
} from '../channels/voice-transcription.js';
import { WebChannel, type WebAuthRuntimeConfig } from '../channels/web.js';
import type { CodingBackendTerminalControl, DashboardCallbacks } from '../channels/web-types.js';
import type { CodingBackendsConfig, GuardianAgentConfig } from '../config/types.js';
import { CodingBackendService } from '../runtime/coding-backend-service.js';
import { applyCodingBackendEnvironmentDefaults } from '../runtime/coding-backend-presets.js';
import { ConfigCredentialProvider } from '../runtime/credentials.js';
import type {
  IncomingDispatchMessage,
  PrepareIncomingDispatch,
} from '../runtime/incoming-dispatch.js';
import type { LocalSecretStore } from '../runtime/secret-store.js';
import type { Runtime } from '../runtime/runtime.js';
import type { BootstrapChannelStopEntry } from './shutdown.js';

export type BootstrapCliChannel = Pick<CLIChannel, 'start' | 'stop' | 'send' | 'postStart'>;
export type BootstrapTelegramChannel = Pick<TelegramChannel, 'start' | 'stop' | 'send' | 'getKnownChatIds'>;
export type BootstrapVoiceChannel = Pick<VoiceChannel, 'start' | 'stop' | 'send' | 'getDevices'>;
export type BootstrapWebChannel = Pick<
  WebChannel,
  'start' | 'stop' | 'send' | 'setAuthConfig' | 'getCodingBackendTerminalControl' | 'emitDashboardInvalidation'
>;

interface LoggerLike {
  info(data: unknown, message?: string): void;
  warn(data: unknown, message?: string): void;
  error(data: unknown, message?: string): void;
}

interface DispatchRuntimeLike {
  dispatchMessage: Runtime['dispatchMessage'];
}

function createChannelDispatchHandler(args: {
  channelDefault: string | undefined;
  prepareIncomingDispatch: PrepareIncomingDispatch;
  dashboardCallbacks: DashboardCallbacks;
  runtime: DispatchRuntimeLike;
}): (msg: IncomingDispatchMessage) => Promise<{ content: string; metadata?: Record<string, unknown> }> {
  return async (msg) => {
    const messageId = (msg as IncomingDispatchMessage & { id?: unknown }).id;
    const inboundRequestId = msg.requestId?.trim()
      || (typeof messageId === 'string' ? messageId.trim() : '');
    const dispatchMessage = inboundRequestId
      ? { ...msg, requestId: inboundRequestId }
      : msg;
    const prepared = await args.prepareIncomingDispatch(args.channelDefault, dispatchMessage);
    if (args.dashboardCallbacks.onDispatch) {
      return args.dashboardCallbacks.onDispatch(
        prepared.decision.agentId,
        prepared.routedMessage,
        prepared.decision,
        { requestId: prepared.requestId },
        prepared.gateway,
      );
    }
    const channel = msg.channel?.trim() || 'web';
    const userId = msg.userId?.trim() || `${channel}-user`;
    return args.runtime.dispatchMessage(prepared.decision.agentId, {
      ...dispatchMessage,
      id: prepared.requestId || dispatchMessage.requestId || randomUUID(),
      userId,
      channel,
      timestamp: Date.now(),
      metadata: prepared.routedMessage.metadata,
    });
  };
}

function upsertChannelStop(
  channels: BootstrapChannelStopEntry[],
  name: string,
  stop: () => Promise<void>,
): void {
  const idx = channels.findIndex((entry) => entry.name === name);
  if (idx >= 0) {
    channels[idx] = { name, stop };
    return;
  }
  channels.push({ name, stop });
}

function createUnavailableCodingBackendTerminalControl(): CodingBackendTerminalControl {
  return {
    async openTerminal(): Promise<{ terminalId: string }> {
      throw new Error(
        'Coding backend terminal control is unavailable because the web channel is not running. '
        + 'Codex SDK can still run without terminal control, but host-started local app servers and terminal CLI backends need the web channel.',
      );
    },
    writeTerminalInput(): void {},
    closeTerminal(): void {},
    onTerminalOutput(): () => void {
      return () => {};
    },
    onTerminalExit(): () => void {
      return () => {};
    },
  };
}

function resolveCredentialRef(args: {
  config: GuardianAgentConfig;
  secretStore: LocalSecretStore;
  ref?: string;
  purpose: string;
  log: LoggerLike;
}): string | undefined {
  const ref = args.ref?.trim();
  if (!ref) return undefined;
  try {
    return new ConfigCredentialProvider(args.config.assistant.credentials, args.secretStore)
      .require(ref, args.purpose);
  } catch (err) {
    args.log.warn({
      ref,
      purpose: args.purpose,
      error: err instanceof Error ? err.message : String(err),
    }, 'Credential resolution failed');
    return undefined;
  }
}

function createVoiceTranscriber(args: {
  config: GuardianAgentConfig;
  secretStore: LocalSecretStore;
  log: LoggerLike;
}): VoiceTranscriber | undefined {
  const voice = args.config.channels.voice;
  const transcription = voice?.transcription;
  const provider = transcription?.provider ?? 'none';
  if (!voice?.enabled || provider === 'none') return undefined;

  if (provider === 'elevenlabs') {
    const elevenLabs = transcription?.elevenLabs;
    const apiKey = resolveCredentialRef({
      config: args.config,
      secretStore: args.secretStore,
      ref: elevenLabs?.credentialRef,
      purpose: 'channels.voice.transcription.elevenLabs',
      log: args.log,
    });
    if (!apiKey) {
      args.log.warn('Voice audio transcription disabled because the ElevenLabs credential did not resolve');
      return undefined;
    }
    return new ElevenLabsVoiceTranscriber({
      apiKey,
      apiBaseUrl: elevenLabs?.apiBaseUrl,
      modelId: elevenLabs?.modelId,
      timeoutMs: transcription?.timeoutMs,
      languageCode: elevenLabs?.languageCode,
      tagAudioEvents: elevenLabs?.tagAudioEvents,
      noVerbatim: elevenLabs?.noVerbatim,
      fileFormat: elevenLabs?.fileFormat,
      enableLogging: elevenLabs?.enableLogging,
    });
  }

  if (provider === 'openrouter') {
    const openRouter = transcription?.openRouter;
    const apiKey = resolveCredentialRef({
      config: args.config,
      secretStore: args.secretStore,
      ref: openRouter?.credentialRef,
      purpose: 'channels.voice.transcription.openRouter',
      log: args.log,
    });
    if (!apiKey) {
      args.log.warn('Voice audio transcription disabled because the OpenRouter credential did not resolve');
      return undefined;
    }
    if (!openRouter?.model?.trim()) {
      args.log.warn('Voice OpenRouter transcription disabled because no model is configured');
      return undefined;
    }
    return new OpenRouterVoiceTranscriber({
      apiKey,
      baseUrl: openRouter.baseUrl,
      model: openRouter.model,
      timeoutMs: transcription?.timeoutMs,
      languageCode: openRouter.languageCode,
      audioFormat: openRouter.audioFormat,
      temperature: openRouter.temperature,
    });
  }

  if (provider === 'local_command') {
    const localCommand = transcription?.localCommand;
    if (!localCommand?.command?.trim()) {
      args.log.warn('Voice local transcription disabled because no command is configured');
      return undefined;
    }
    return new LocalCommandVoiceTranscriber({
      command: localCommand.command,
      args: localCommand.args,
      outputFormat: localCommand.outputFormat,
      timeoutMs: localCommand.timeoutMs ?? transcription?.timeoutMs,
      workingDirectory: localCommand.workingDirectory,
    });
  }

  if (provider === 'openai_compatible') {
    const compatible = transcription?.openAICompatible;
    if (!compatible?.baseUrl?.trim() || !compatible.model?.trim()) {
      args.log.warn('Voice OpenAI-compatible transcription disabled because baseUrl or model is missing');
      return undefined;
    }
    const apiKey = compatible.credentialRef
      ? resolveCredentialRef({
          config: args.config,
          secretStore: args.secretStore,
          ref: compatible.credentialRef,
          purpose: 'channels.voice.transcription.openAICompatible',
          log: args.log,
        })
      : undefined;
    return new OpenAICompatibleVoiceTranscriber({
      baseUrl: compatible.baseUrl,
      apiKey,
      model: compatible.model,
      timeoutMs: transcription?.timeoutMs,
      languageCode: compatible.languageCode,
      responseFormat: compatible.responseFormat,
    });
  }

  return undefined;
}

function resolveVoiceAuthToken(args: {
  config: GuardianAgentConfig;
  secretStore: LocalSecretStore;
  log: LoggerLike;
}): string | undefined {
  const auth = args.config.channels.voice?.auth;
  const direct = auth?.token?.trim();
  if (direct) return direct;
  return resolveCredentialRef({
    config: args.config,
    secretStore: args.secretStore,
    ref: auth?.tokenCredentialRef,
    purpose: 'channels.voice.auth',
    log: args.log,
  });
}

function shouldInstallHeadlessCodingBackendService(config: CodingBackendsConfig): boolean {
  if (!config.enabled) return false;
  const defaultBackend = config.defaultBackend
    ? config.backends.find((backend) => backend.id === config.defaultBackend)
    : undefined;
  const candidates = defaultBackend ? [defaultBackend] : config.backends;
  return candidates.some((backend) => backend.enabled && (
    backend.adapterKind === 'codex_sdk'
    || backend.id === 'codex-sdk'
  ));
}

export async function startBootstrapChannels(args: {
  config: GuardianAgentConfig;
  configRef: { current: GuardianAgentConfig };
  configPath: string;
  defaultAgentId: string;
  effectiveToken?: string;
  configuredToken?: string;
  rotateOnStartup: boolean;
  webAuthStateRef: { current: WebAuthRuntimeConfig };
  dashboardCallbacks: DashboardCallbacks;
  runtime: DispatchRuntimeLike;
  channels: BootstrapChannelStopEntry[];
  prepareIncomingDispatch: PrepareIncomingDispatch;
  resolveConfiguredAgentId?: (agentId?: string) => string | undefined;
  secretStore: LocalSecretStore;
  resolveCanonicalTelegramUserId: (channelUserId: string) => string;
  resolveTelegramBotToken: (config: GuardianAgentConfig, secretStore: LocalSecretStore) => string | undefined;
  formatGuideForTelegram: () => string;
  generateSecureToken: () => string;
  previewTokenForLog: (token: string) => string;
  staticDir: string;
  codingBackendServiceRef: { current: CodingBackendService | null };
  codingBackendsDefaultConfig: NonNullable<GuardianAgentConfig['assistant']['tools']['codingBackends']>;
  codingBackendRecentSessionsPath?: string;
  toolExecutor: { getRuntimeNotices: () => Array<{ message: string }>; setCodingBackendService: (service: CodingBackendService | undefined) => void };
  listAgents: () => Array<{
    id: string;
    name: string;
    state: string;
    capabilities: readonly string[];
    internal: boolean;
  }>;
  getRuntimeStatus: () => {
    running: boolean;
    agentCount: number;
    guardianEnabled: boolean;
    providers: string[];
  };
  log: LoggerLike;
  stdinIsTTY?: boolean;
  stdoutIsTTY?: boolean;
  createCliChannel?: (options: ConstructorParameters<typeof CLIChannel>[0]) => BootstrapCliChannel;
  createTelegramChannel?: (options: ConstructorParameters<typeof TelegramChannel>[0]) => BootstrapTelegramChannel;
  createVoiceChannel?: (options: ConstructorParameters<typeof VoiceChannel>[0]) => BootstrapVoiceChannel;
  createWebChannel?: (options: ConstructorParameters<typeof WebChannel>[0]) => BootstrapWebChannel;
  createCodingBackendService?: (
    options: ConstructorParameters<typeof CodingBackendService>[0],
  ) => CodingBackendService;
}): Promise<{
  cliChannel: BootstrapCliChannel | null;
  voiceChannel: BootstrapVoiceChannel | null;
  webChannel: BootstrapWebChannel | null;
  getTelegramChannel: () => BootstrapTelegramChannel | null;
}> {
  let cliChannel: BootstrapCliChannel | null = null;
  let activeTelegram: BootstrapTelegramChannel | null = null;
  let voiceChannel: BootstrapVoiceChannel | null = null;
  let webChannel: BootstrapWebChannel | null = null;

  const createCliChannel = args.createCliChannel ?? ((options) => new CLIChannel(options));
  const createTelegramChannel = args.createTelegramChannel ?? ((options) => new TelegramChannel(options));
  const createVoiceChannel = args.createVoiceChannel ?? ((options) => new VoiceChannel(options));
  const createWebChannel = args.createWebChannel ?? ((options) => new WebChannel(options));
  const createCodingBackendService = args.createCodingBackendService
    ?? ((options) => new CodingBackendService(options));
  const resolveConfiguredAgentId = args.resolveConfiguredAgentId
    ?? ((agentId?: string) => (typeof agentId === 'string' && agentId.trim() ? agentId.trim() : undefined));
  const resolveCodingBackendConfig = (): CodingBackendsConfig => applyCodingBackendEnvironmentDefaults(
    args.configRef.current.assistant.tools.codingBackends ?? args.codingBackendsDefaultConfig,
  );
  const installCodingBackendService = (terminalControl: CodingBackendTerminalControl): void => {
    args.codingBackendServiceRef.current?.dispose();
    args.codingBackendServiceRef.current = createCodingBackendService({
      config: resolveCodingBackendConfig(),
      terminalControl,
      ...(args.codingBackendRecentSessionsPath ? { recentSessionsPath: args.codingBackendRecentSessionsPath } : {}),
    });
    args.toolExecutor.setCodingBackendService(args.codingBackendServiceRef.current);
  };

  const canStartInteractiveCli = !!args.stdinIsTTY && !!args.stdoutIsTTY;
  if (args.config.channels.cli?.enabled && canStartInteractiveCli) {
    const cliDefaultAgent = resolveConfiguredAgentId(args.config.channels.cli.defaultAgent) ?? args.defaultAgentId;
    const enabledChannels: string[] = ['cli'];
    if (args.config.channels.web?.enabled) enabledChannels.push('web');
    if (args.config.channels.telegram?.enabled) enabledChannels.push('telegram');
    if (args.config.channels.voice?.enabled) enabledChannels.push('voice');

    const cli = createCliChannel({
      defaultAgent: cliDefaultAgent,
      defaultUserId: 'cli',
      dashboard: args.dashboardCallbacks,
      version: '1.0.0',
      configPath: args.configPath,
      startupStatus: {
        guardianEnabled: args.config.guardian.enabled,
        providerName: args.config.defaultProvider,
        channels: enabledChannels,
        dashboardUrl: args.config.channels.web?.enabled
          ? `http://${args.config.channels.web.host ?? 'localhost'}:${args.config.channels.web.port ?? 3000}`
          : undefined,
        authToken: args.effectiveToken,
        warnings: args.toolExecutor.getRuntimeNotices().map((notice) => notice.message),
      },
      onAgents: args.listAgents,
      onStatus: args.getRuntimeStatus,
    });
    await cli.start(createChannelDispatchHandler({
      channelDefault: cliDefaultAgent,
      prepareIncomingDispatch: args.prepareIncomingDispatch,
      dashboardCallbacks: args.dashboardCallbacks,
      runtime: args.runtime,
    }));
    cliChannel = cli;
    args.channels.push({ name: 'cli', stop: () => cli.stop() });
  } else if (args.config.channels.cli?.enabled) {
    args.log.info({
      stdinIsTTY: !!args.stdinIsTTY,
      stdoutIsTTY: !!args.stdoutIsTTY,
    }, 'CLI channel skipped because stdio is not interactive');
  }

  const startTelegram = async (): Promise<void> => {
    const tgConfig = args.configRef.current.channels.telegram;
    const botToken = args.resolveTelegramBotToken(args.configRef.current, args.secretStore);
    if (!tgConfig?.enabled || !botToken) return;
    const telegramDefaultAgent = resolveConfiguredAgentId(tgConfig.defaultAgent) ?? args.defaultAgentId;
    const telegram = createTelegramChannel({
      botToken,
      allowedChatIds: tgConfig.allowedChatIds,
      defaultAgent: telegramDefaultAgent,
      guideText: args.formatGuideForTelegram(),
      resolveCanonicalUserId: args.resolveCanonicalTelegramUserId,
      onQuickAction: async ({ actionId, details, userId, channel, agentId }) => {
        if (!args.dashboardCallbacks.onQuickActionRun) {
          return { content: 'Quick actions are not available.' };
        }
        return args.dashboardCallbacks.onQuickActionRun({ actionId, details, userId, channel, agentId });
      },
      onThreatIntelSummary: args.dashboardCallbacks.onThreatIntelSummary
        ? () => args.dashboardCallbacks.onThreatIntelSummary!()
        : undefined,
      onThreatIntelScan: args.dashboardCallbacks.onThreatIntelScan
        ? (input) => args.dashboardCallbacks.onThreatIntelScan!(input)
        : undefined,
      onThreatIntelFindings: args.dashboardCallbacks.onThreatIntelFindings
        ? (input) => args.dashboardCallbacks.onThreatIntelFindings!(input)
        : undefined,
      onAnalyticsTrack: (event) => args.dashboardCallbacks.onAnalyticsTrack?.(event),
      onToolsApprovalDecision: args.dashboardCallbacks.onToolsApprovalDecision
        ? (input) => args.dashboardCallbacks.onToolsApprovalDecision!(input)
        : undefined,
      onDispatch: args.dashboardCallbacks.onDispatch
        ? (agentId, msg) => args.dashboardCallbacks.onDispatch!(agentId, msg)
        : undefined,
      onSSESubscribe: args.dashboardCallbacks.onSSESubscribe
        ? (listener) => args.dashboardCallbacks.onSSESubscribe!(listener)
        : undefined,
      onResetConversation: async ({ userId, agentId }) => {
        if (!args.dashboardCallbacks.onConversationReset) {
          return { success: false, message: 'Conversation reset is not available.' };
        }
        return args.dashboardCallbacks.onConversationReset({
          agentId: agentId ?? telegramDefaultAgent,
          userId,
          channel: 'telegram',
        });
      },
    });
    await telegram.start(createChannelDispatchHandler({
      channelDefault: telegramDefaultAgent,
      prepareIncomingDispatch: args.prepareIncomingDispatch,
      dashboardCallbacks: args.dashboardCallbacks,
      runtime: args.runtime,
    }));
    activeTelegram = telegram;
    upsertChannelStop(args.channels, 'telegram', () => telegram.stop());
  };

  args.dashboardCallbacks.onTelegramReload = async () => {
    try {
      if (activeTelegram) {
        await activeTelegram.stop();
        activeTelegram = null;
        args.log.info('Telegram channel stopped for reload');
      }
      await startTelegram();
      const tgConfig = args.configRef.current.channels.telegram;
      if (tgConfig?.enabled && args.resolveTelegramBotToken(args.configRef.current, args.secretStore)) {
        args.log.info('Telegram channel reloaded');
        return { success: true, message: 'Telegram channel reloaded.' };
      }
      args.log.info('Telegram channel disabled');
      return { success: true, message: 'Telegram channel disabled.' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      args.log.error({ err }, 'Telegram reload failed');
      return { success: false, message: `Telegram reload failed: ${message}` };
    }
  };

  const bootstrapCodingBackendConfig = resolveCodingBackendConfig();
  if (shouldInstallHeadlessCodingBackendService(bootstrapCodingBackendConfig)) {
    installCodingBackendService(createUnavailableCodingBackendTerminalControl());
    args.log.info({
      defaultBackend: bootstrapCodingBackendConfig.defaultBackend,
    }, 'Coding backend service enabled for headless channels');
  }

  try {
    await startTelegram();
  } catch (err) {
    args.log.error({ err }, 'Telegram channel failed to start — continuing without it');
    console.log('  Telegram: FAILED (check bot token) — other channels unaffected');
  }

  if (args.config.channels.voice?.enabled) {
    const voiceDefaultAgent = resolveConfiguredAgentId(args.config.channels.voice.defaultAgent) ?? args.defaultAgentId;
    const voiceAuthMode = args.config.channels.voice.auth?.mode ?? 'bearer_required';
    const voiceAuthToken = resolveVoiceAuthToken({
      config: args.configRef.current,
      secretStore: args.secretStore,
      log: args.log,
    });
    if (voiceAuthMode === 'bearer_required' && !voiceAuthToken) {
      args.log.error('Voice channel skipped because bearer authentication is enabled but no token resolved');
      console.log('  Voice: skipped (missing bearer token)');
    } else {
      const voice = createVoiceChannel({
        port: args.config.channels.voice.port,
        host: args.config.channels.voice.host,
        defaultAgent: voiceDefaultAgent,
        auth: {
          mode: voiceAuthMode,
          token: voiceAuthToken,
        },
        allowedDeviceIds: args.config.channels.voice.allowedDeviceIds,
        autoRegister: args.config.channels.voice.autoRegister,
        maxBodyBytes: args.config.channels.voice.maxBodyBytes,
        transcriber: createVoiceTranscriber({
          config: args.configRef.current,
          secretStore: args.secretStore,
          log: args.log,
        }),
      });
      voiceChannel = voice;
      await voice.start(createChannelDispatchHandler({
        channelDefault: voiceDefaultAgent,
        prepareIncomingDispatch: args.prepareIncomingDispatch,
        dashboardCallbacks: args.dashboardCallbacks,
        runtime: args.runtime,
      }));
      args.channels.push({ name: 'voice', stop: () => voice.stop() });
      args.log.info({
        host: args.config.channels.voice.host ?? 'localhost',
        port: args.config.channels.voice.port ?? 3107,
      }, 'Voice channel available at');
    }
  }

  if (args.config.channels.web?.enabled) {
    const webDefaultAgent = resolveConfiguredAgentId(args.config.channels.web.defaultAgent) ?? args.defaultAgentId;
    if (args.webAuthStateRef.current.mode === 'bearer_required' && !args.webAuthStateRef.current.token) {
      args.webAuthStateRef.current = {
        ...args.webAuthStateRef.current,
        token: args.generateSecureToken(),
        tokenSource: 'ephemeral',
      };
    }
    if (args.webAuthStateRef.current.mode === 'disabled') {
      args.log.warn(
        {
          mode: args.webAuthStateRef.current.mode,
          host: args.config.channels.web.host ?? 'localhost',
          port: args.config.channels.web.port ?? 3000,
        },
        'Web dashboard bearer authentication is disabled. Only use this on trusted networks.',
      );
      if (process.stdout.isTTY && !process.env['LOG_FILE']) {
        console.log('');
        console.log('  Web Dashboard Auth');
        console.log(`  URL:   http://${args.config.channels.web.host ?? 'localhost'}:${args.config.channels.web.port ?? 3000}`);
        console.log('  Mode:  disabled');
        console.log('  The web dashboard is open without a bearer token. Use only on trusted networks.');
        console.log('');
      }
    } else if (args.webAuthStateRef.current.tokenSource === 'ephemeral') {
      const ephemeralStartupReason = args.configuredToken && args.rotateOnStartup
        ? 'Web auth rotate-on-startup is enabled. Generated a fresh ephemeral token for this run.'
        : 'No web auth token configured. Generated an ephemeral token for this run.';
      args.log.warn(
        {
          tokenPreview: args.webAuthStateRef.current.token
            ? args.previewTokenForLog(args.webAuthStateRef.current.token)
            : undefined,
          mode: args.webAuthStateRef.current.mode,
          host: args.config.channels.web.host ?? 'localhost',
          port: args.config.channels.web.port ?? 3000,
        },
        ephemeralStartupReason,
      );
      if (process.stdout.isTTY && !process.env['LOG_FILE'] && args.webAuthStateRef.current.token) {
        console.log('');
        console.log('  Web Dashboard Auth');
        console.log(`  URL:   http://${args.config.channels.web.host ?? 'localhost'}:${args.config.channels.web.port ?? 3000}`);
        console.log(`  Token: ${args.webAuthStateRef.current.token}`);
        console.log('  This token is runtime-ephemeral for this process. Exchange it for the session cookie on first login.');
        console.log('');
      }
    }

    const web = createWebChannel({
      port: args.config.channels.web.port,
      host: args.config.channels.web.host,
      defaultAgent: webDefaultAgent,
      auth: args.webAuthStateRef.current,
      authToken: args.webAuthStateRef.current.token,
      allowedOrigins: args.config.channels.web.allowedOrigins,
      maxBodyBytes: args.config.channels.web.maxBodyBytes,
      staticDir: args.staticDir,
      dashboard: args.dashboardCallbacks,
    });
    installCodingBackendService(web.getCodingBackendTerminalControl());
    webChannel = web;
    await web.start(createChannelDispatchHandler({
      channelDefault: webDefaultAgent,
      prepareIncomingDispatch: args.prepareIncomingDispatch,
      dashboardCallbacks: args.dashboardCallbacks,
      runtime: args.runtime,
    }));
    args.channels.push({
      name: 'web',
      stop: async () => {
        args.codingBackendServiceRef.current?.dispose();
        await web.stop();
      },
    });

    const webUrl = `http://${args.config.channels.web.host ?? 'localhost'}:${args.config.channels.web.port ?? 3000}`;
    args.log.info({ url: webUrl }, 'Dashboard available at');
  }

  return {
    cliChannel,
    voiceChannel,
    webChannel,
    getTelegramChannel: () => activeTelegram,
  };
}
