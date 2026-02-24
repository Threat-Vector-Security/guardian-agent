#!/usr/bin/env node
/**
 * GuardianAgent — Entry point.
 *
 * Load config → create Runtime → register agents → start channels →
 * handle SIGINT/SIGTERM for graceful shutdown.
 */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { exec } from 'node:child_process';
import { platform } from 'node:os';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { loadConfig, DEFAULT_CONFIG_PATH } from './config/loader.js';
import type { GuardianAgentConfig } from './config/types.js';
import yaml from 'js-yaml';
import { Runtime } from './runtime/runtime.js';
import { CLIChannel } from './channels/cli.js';
import { TelegramChannel } from './channels/telegram.js';
import { WebChannel } from './channels/web.js';
import type { DashboardCallbacks, DashboardAgentInfo, DashboardAgentDetail, DashboardProviderInfo, RedactedConfig, SSEListener } from './channels/web-types.js';
import type { LLMConfig } from './config/types.js';
import { BaseAgent } from './agent/agent.js';
import { createAgentDefinition } from './agent/agent.js';
import type { AgentContext, AgentResponse, UserMessage } from './agent/types.js';
import { SentinelAgent } from './agents/sentinel.js';
import { createLogger } from './util/logging.js';

const log = createLogger('main');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Default chat agent that uses the configured LLM provider. */
class ChatAgent extends BaseAgent {
  private systemPrompt: string;

  constructor(id: string, name: string, systemPrompt?: string) {
    super(id, name, { handleMessages: true });
    this.systemPrompt = systemPrompt ?? 'You are a helpful assistant.';
  }

  async onMessage(message: UserMessage, ctx: AgentContext): Promise<AgentResponse> {
    if (!ctx.llm) {
      return { content: 'No LLM provider configured.' };
    }

    const response = await ctx.llm.chat([
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: message.content },
    ]);

    return { content: response.content };
  }
}

/** Strip sensitive fields from config for the dashboard. */
function redactConfig(config: GuardianAgentConfig): RedactedConfig {
  const llm: Record<string, { provider: string; model: string; baseUrl?: string }> = {};
  for (const [name, cfg] of Object.entries(config.llm)) {
    llm[name] = {
      provider: cfg.provider,
      model: cfg.model,
      baseUrl: cfg.baseUrl,
    };
  }

  return {
    llm,
    defaultProvider: config.defaultProvider,
    channels: {
      cli: config.channels.cli ? { enabled: config.channels.cli.enabled } : undefined,
      telegram: config.channels.telegram ? { enabled: config.channels.telegram.enabled } : undefined,
      web: config.channels.web ? {
        enabled: config.channels.web.enabled,
        port: config.channels.web.port,
        host: config.channels.web.host,
      } : undefined,
    },
    guardian: {
      enabled: config.guardian.enabled,
      rateLimit: config.guardian.rateLimit,
      inputSanitization: config.guardian.inputSanitization,
      outputScanning: config.guardian.outputScanning,
      sentinel: config.guardian.sentinel ? {
        enabled: config.guardian.sentinel.enabled,
        schedule: config.guardian.sentinel.schedule,
      } : undefined,
    },
    runtime: config.runtime,
  };
}

/** Build dashboard callbacks wired to runtime internals. */
function buildDashboardCallbacks(runtime: Runtime, config: GuardianAgentConfig): DashboardCallbacks {
  return {
    onAgents: (): DashboardAgentInfo[] => {
      return runtime.registry.getAll().map(inst => ({
        id: inst.agent.id,
        name: inst.agent.name,
        state: inst.state,
        capabilities: inst.definition.grantedCapabilities,
        provider: inst.definition.providerName,
        schedule: inst.definition.schedule,
        lastActivityMs: inst.lastActivityMs,
        consecutiveErrors: inst.consecutiveErrors,
      }));
    },

    onAgentDetail: (id: string): DashboardAgentDetail | null => {
      const inst = runtime.registry.get(id);
      if (!inst) return null;
      return {
        id: inst.agent.id,
        name: inst.agent.name,
        state: inst.state,
        capabilities: inst.definition.grantedCapabilities,
        provider: inst.definition.providerName,
        schedule: inst.definition.schedule,
        lastActivityMs: inst.lastActivityMs,
        consecutiveErrors: inst.consecutiveErrors,
        resourceLimits: { ...inst.definition.resourceLimits },
      };
    },

    onAuditQuery: (filter) => runtime.auditLog.query(filter),

    onAuditSummary: (windowMs) => runtime.auditLog.getSummary(windowMs),

    onConfig: () => redactConfig(config),

    onBudget: () => {
      const agents = runtime.registry.getAll().map(inst => ({
        agentId: inst.agent.id,
        tokensPerMinute: runtime.budget.getTokensPerMinute(inst.agent.id),
        concurrentInvocations: runtime.budget.getConcurrentCount(inst.agent.id),
        overrunCount: runtime.budget.getOverrunCount(inst.agent.id),
      }));
      return {
        agents,
        recentOverruns: runtime.budget.getOverruns(),
      };
    },

    onWatchdog: () => runtime.watchdog.check(),

    onProviders: () => {
      const providers: DashboardProviderInfo[] = [];
      for (const [name, provider] of runtime.providers) {
        const llmConfig = config.llm[name] as LLMConfig | undefined;
        const isLocal = provider.name === 'ollama' ||
          (llmConfig?.baseUrl && (llmConfig.baseUrl.includes('localhost') || llmConfig.baseUrl.includes('127.0.0.1')));

        providers.push({
          name,
          type: provider.name,
          model: llmConfig?.model ?? 'unknown',
          baseUrl: llmConfig?.baseUrl,
          locality: isLocal ? 'local' : 'external',
          connected: false, // will be checked async by /api/providers/status
        });
      }
      return providers;
    },

    onProvidersStatus: async () => {
      const results: DashboardProviderInfo[] = [];
      for (const [name, provider] of runtime.providers) {
        const llmConfig = config.llm[name] as LLMConfig | undefined;
        const isLocal = provider.name === 'ollama' ||
          (llmConfig?.baseUrl && (llmConfig.baseUrl.includes('localhost') || llmConfig.baseUrl.includes('127.0.0.1')));

        let connected = false;
        let availableModels: string[] | undefined;

        try {
          const models = await provider.listModels();
          connected = true;
          if (models.length > 0) {
            availableModels = models.map(m => m.id);
          }
        } catch {
          connected = false;
        }

        results.push({
          name,
          type: provider.name,
          model: llmConfig?.model ?? 'unknown',
          baseUrl: llmConfig?.baseUrl,
          locality: isLocal ? 'local' : 'external',
          connected,
          availableModels,
        });
      }
      return results;
    },

    onSSESubscribe: (listener: SSEListener): (() => void) => {
      const cleanups: Array<() => void> = [];

      // Real-time audit events
      const unsubAudit = runtime.auditLog.addListener((event) => {
        listener({ type: 'audit', data: event });
      });
      cleanups.push(unsubAudit);

      // Metrics every 5s
      const metricsInterval = setInterval(() => {
        const agents = runtime.registry.getAll().map(inst => ({
          id: inst.agent.id,
          name: inst.agent.name,
          state: inst.state,
          lastActivityMs: inst.lastActivityMs,
        }));
        listener({
          type: 'metrics',
          data: {
            agents,
            eventBusPending: runtime.eventBus.pending,
            timestamp: Date.now(),
          },
        });
      }, 5_000);
      cleanups.push(() => clearInterval(metricsInterval));

      // Watchdog every 10s
      const watchdogInterval = setInterval(() => {
        listener({
          type: 'watchdog',
          data: {
            results: runtime.watchdog.check(),
            timestamp: Date.now(),
          },
        });
      }, 10_000);
      cleanups.push(() => clearInterval(watchdogInterval));

      return () => {
        for (const cleanup of cleanups) {
          cleanup();
        }
      };
    },

    onDispatch: async (agentId, msg) => {
      const message: UserMessage = {
        id: randomUUID(),
        userId: msg.userId ?? 'web-dashboard',
        channel: 'web',
        content: msg.content,
        timestamp: Date.now(),
      };
      return runtime.dispatchMessage(agentId, message);
    },

    onConfigUpdate: async (updates) => {
      const configPath = process.argv[2] ?? DEFAULT_CONFIG_PATH;

      // Read existing file or start fresh
      let rawConfig: Record<string, unknown> = {};
      if (existsSync(configPath)) {
        const content = readFileSync(configPath, 'utf-8');
        rawConfig = (yaml.load(content) as Record<string, unknown>) ?? {};
      }

      // Apply updates
      if (updates.defaultProvider) {
        rawConfig.defaultProvider = updates.defaultProvider;
      }

      if (updates.llm) {
        const llmSection = (rawConfig.llm ?? {}) as Record<string, Record<string, unknown>>;
        for (const [name, providerUpdates] of Object.entries(updates.llm)) {
          if (!llmSection[name]) {
            llmSection[name] = {};
          }
          if (providerUpdates.provider) llmSection[name].provider = providerUpdates.provider;
          if (providerUpdates.model) llmSection[name].model = providerUpdates.model;
          if (providerUpdates.apiKey) llmSection[name].apiKey = providerUpdates.apiKey;
          if (providerUpdates.baseUrl) llmSection[name].baseUrl = providerUpdates.baseUrl;
        }
        rawConfig.llm = llmSection;
      }

      // Write back
      const yamlStr = yaml.dump(rawConfig, { lineWidth: -1, noRefs: true });
      writeFileSync(configPath, yamlStr, 'utf-8');

      return {
        success: true,
        message: 'Config saved. Restart to apply changes.',
      };
    },
  };
}

/** Open a URL in the user's default browser. */
function openBrowser(url: string): void {
  const os = platform();
  const cmd = os === 'win32' ? `start "" "${url}"`
    : os === 'darwin' ? `open "${url}"`
    : `xdg-open "${url}"`;

  exec(cmd, (err) => {
    if (err) {
      log.info({ url }, 'Dashboard available at');
    }
  });
}

async function main(): Promise<void> {
  const configPath = process.argv[2];
  const config = loadConfig(configPath);

  const runtime = new Runtime(config);

  // Register agents from config (or a default chat agent)
  if (config.agents.length > 0) {
    for (const agentConfig of config.agents) {
      const agent = new ChatAgent(
        agentConfig.id,
        agentConfig.name,
        agentConfig.systemPrompt,
      );
      runtime.registerAgent(createAgentDefinition({
        agent,
        providerName: agentConfig.provider,
        schedule: agentConfig.schedule,
        grantedCapabilities: agentConfig.capabilities,
        resourceLimits: agentConfig.resourceLimits,
      }));
    }
  } else {
    // Default agent
    const defaultAgent = new ChatAgent('default', 'GuardianAgent');
    runtime.registerAgent(createAgentDefinition({
      agent: defaultAgent,
    }));
  }

  // Register Sentinel agent if enabled
  const sentinelConfig = config.guardian?.sentinel;
  if (sentinelConfig?.enabled !== false) {
    const sentinel = new SentinelAgent(sentinelConfig?.anomalyThresholds);
    runtime.registerAgent(createAgentDefinition({
      agent: sentinel,
      schedule: sentinelConfig?.schedule ?? '*/5 * * * *',
    }));
  }

  // Start channels
  const channels: { name: string; stop: () => Promise<void> }[] = [];

  const defaultAgentId = config.agents[0]?.id ?? 'default';
  const dashboardCallbacks = buildDashboardCallbacks(runtime, config);

  if (config.channels.cli?.enabled) {
    const cli = new CLIChannel({
      defaultAgent: config.channels.cli.defaultAgent ?? defaultAgentId,
      dashboard: dashboardCallbacks,
      onAgents: () => runtime.registry.getAll().map(inst => ({
        id: inst.agent.id,
        name: inst.agent.name,
        state: inst.state,
        capabilities: inst.definition.grantedCapabilities,
      })),
      onStatus: () => ({
        running: runtime.isRunning(),
        agentCount: runtime.registry.size,
        guardianEnabled: config.guardian.enabled,
        providers: [...runtime.providers.keys()],
      }),
    });
    await cli.start(async (msg) => {
      return runtime.dispatchMessage(
        config.channels.cli?.defaultAgent ?? defaultAgentId,
        msg,
      );
    });
    channels.push({ name: 'cli', stop: () => cli.stop() });
  }

  if (config.channels.telegram?.enabled && config.channels.telegram.botToken) {
    const telegram = new TelegramChannel({
      botToken: config.channels.telegram.botToken,
      allowedChatIds: config.channels.telegram.allowedChatIds,
      defaultAgent: config.channels.telegram.defaultAgent ?? defaultAgentId,
    });
    await telegram.start(async (msg) => {
      return runtime.dispatchMessage(
        config.channels.telegram?.defaultAgent ?? defaultAgentId,
        msg,
      );
    });
    channels.push({ name: 'telegram', stop: () => telegram.stop() });
  }

  if (config.channels.web?.enabled) {
    const web = new WebChannel({
      port: config.channels.web.port,
      host: config.channels.web.host,
      defaultAgent: config.channels.web.defaultAgent ?? defaultAgentId,
      authToken: config.channels.web.authToken,
      allowedOrigins: config.channels.web.allowedOrigins,
      maxBodyBytes: config.channels.web.maxBodyBytes,
      staticDir: join(__dirname, '..', 'web', 'public'),
      dashboard: dashboardCallbacks,
    });
    await web.start(async (msg) => {
      return runtime.dispatchMessage(
        config.channels.web?.defaultAgent ?? defaultAgentId,
        msg,
      );
    });
    channels.push({ name: 'web', stop: () => web.stop() });

    // Open browser to dashboard
    const webUrl = `http://${config.channels.web.host ?? 'localhost'}:${config.channels.web.port ?? 3000}`;
    openBrowser(webUrl);
  }

  // Start runtime
  await runtime.start();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    log.info({ signal }, 'Shutting down...');

    for (const channel of channels) {
      try {
        await channel.stop();
      } catch (err) {
        log.error({ channel: channel.name, err }, 'Error stopping channel');
      }
    }

    await runtime.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  log.error({ err }, 'Fatal error');
  process.exit(1);
});
