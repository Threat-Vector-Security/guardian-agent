#!/usr/bin/env node
/**
 * GuardianAgent — Entry point.
 *
 * Load config → create Runtime → register agents → start channels →
 * handle SIGINT/SIGTERM for graceful shutdown.
 */

import { loadConfig } from './config/loader.js';
import { Runtime } from './runtime/runtime.js';
import { CLIChannel } from './channels/cli.js';
import { TelegramChannel } from './channels/telegram.js';
import { WebChannel } from './channels/web.js';
import { BaseAgent } from './agent/agent.js';
import { createAgentDefinition } from './agent/agent.js';
import type { AgentContext, AgentResponse, UserMessage } from './agent/types.js';
import { SentinelAgent } from './agents/sentinel.js';
import { createLogger } from './util/logging.js';

const log = createLogger('main');

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

  if (config.channels.cli?.enabled) {
    const cli = new CLIChannel({
      defaultAgent: config.channels.cli.defaultAgent ?? defaultAgentId,
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
    });
    await web.start(async (msg) => {
      return runtime.dispatchMessage(
        config.channels.web?.defaultAgent ?? defaultAgentId,
        msg,
      );
    });
    channels.push({ name: 'web', stop: () => web.stop() });
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
