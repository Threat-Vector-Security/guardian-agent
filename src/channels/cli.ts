/**
 * CLI channel adapter.
 *
 * Interactive readline prompt with full dashboard parity.
 * Commands: /chat, /agents, /agent, /status, /providers, /budget, /watchdog,
 * /config, /audit, /security, /models, /clear, /help, /quit, /exit.
 *
 * Accepts the same DashboardCallbacks interface as the web channel for
 * instant feature parity with zero duplication.
 */

import { createInterface, type Interface } from 'node:readline';
import { randomUUID } from 'node:crypto';
import type { ChannelAdapter, MessageCallback } from './types.js';
import type { DashboardCallbacks } from './web-types.js';
import { createLogger } from '../util/logging.js';

const log = createLogger('channel:cli');

/** Info returned by the legacy /agents callback. */
export interface AgentInfo {
  id: string;
  name: string;
  state: string;
  capabilities: readonly string[];
}

/** Info returned by the legacy /status callback. */
export interface RuntimeStatus {
  running: boolean;
  agentCount: number;
  guardianEnabled: boolean;
  providers: string[];
}

export interface CLIChannelOptions {
  /** Default agent to route messages to. */
  defaultAgent?: string;
  /** Custom prompt string. */
  prompt?: string;
  /** Input stream (for testing). */
  input?: NodeJS.ReadableStream;
  /** Output stream (for testing). */
  output?: NodeJS.WritableStream;
  /** Legacy callback to list registered agents. */
  onAgents?: () => AgentInfo[];
  /** Legacy callback to get runtime status. */
  onStatus?: () => RuntimeStatus;
  /** Dashboard callbacks — provides full feature parity with web UI. */
  dashboard?: DashboardCallbacks;
}

export class CLIChannel implements ChannelAdapter {
  readonly name = 'cli';
  private rl: Interface | null = null;
  private onMessage: MessageCallback | null = null;
  private prompt: string;
  private input: NodeJS.ReadableStream;
  private output: NodeJS.WritableStream;
  private onAgents?: () => AgentInfo[];
  private onStatus?: () => RuntimeStatus;
  private dashboard?: DashboardCallbacks;
  private activeAgentId: string | undefined;
  private defaultAgentId: string | undefined;
  private useColor: boolean;

  constructor(options: CLIChannelOptions = {}) {
    this.prompt = options.prompt ?? 'you> ';
    this.input = options.input ?? process.stdin;
    this.output = options.output ?? process.stdout;
    this.onAgents = options.onAgents;
    this.onStatus = options.onStatus;
    this.dashboard = options.dashboard;
    this.defaultAgentId = options.defaultAgent;
    this.useColor = !!(this.output as NodeJS.WriteStream).isTTY;
  }

  async start(onMessage: MessageCallback): Promise<void> {
    this.onMessage = onMessage;

    this.rl = createInterface({
      input: this.input,
      output: this.output,
      prompt: this.prompt,
    });

    this.write('\nGuardianAgent CLI — Type a message or /help for commands.\n\n');
    this.rl.prompt();

    this.rl.on('line', async (line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        this.rl?.prompt();
        return;
      }

      // Handle commands
      if (trimmed.startsWith('/')) {
        await this.handleCommand(trimmed);
        this.rl?.prompt();
        return;
      }

      // Send message to agent
      await this.handleUserMessage(trimmed);
      this.rl?.prompt();
    });

    this.rl.on('close', () => {
      this.write('\nGoodbye!\n');
    });

    log.info('CLI channel started');
  }

  async stop(): Promise<void> {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    this.onMessage = null;
    log.info('CLI channel stopped');
  }

  async send(_userId: string, text: string): Promise<void> {
    this.write(`\nassistant> ${text}\n\n`);
    this.rl?.prompt();
  }

  // ─── Message handling ────────────────────────────────────────

  private async handleUserMessage(text: string): Promise<void> {
    // If active agent is set and dashboard dispatch is available, use it
    if (this.activeAgentId && this.dashboard?.onDispatch) {
      try {
        const response = await this.dashboard.onDispatch(this.activeAgentId, {
          content: text,
          userId: 'cli-user',
        });
        this.write(`\nassistant> ${response.content}\n\n`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.write(`\n${this.red('[error]')} ${msg}\n\n`);
      }
      return;
    }

    // Default: send via onMessage callback
    if (!this.onMessage) return;

    try {
      const response = await this.onMessage({
        id: randomUUID(),
        userId: 'cli-user',
        channel: 'cli',
        content: text,
        timestamp: Date.now(),
      });
      this.write(`\nassistant> ${response.content}\n\n`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.write(`\n${this.red('[error]')} ${msg}\n\n`);
    }
  }

  // ─── Command dispatch ────────────────────────────────────────

  private async handleCommand(commandLine: string): Promise<void> {
    const parts = commandLine.slice(1).split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'help':
        this.handleHelp();
        break;
      case 'chat':
        await this.handleChat(args);
        break;
      case 'agents':
        this.handleAgents();
        break;
      case 'agent':
        this.handleAgentDetail(args);
        break;
      case 'status':
        this.handleStatus();
        break;
      case 'providers':
        await this.handleProviders();
        break;
      case 'budget':
        this.handleBudget();
        break;
      case 'watchdog':
        this.handleWatchdog();
        break;
      case 'config':
        await this.handleConfig(args);
        break;
      case 'audit':
        this.handleAudit(args);
        break;
      case 'security':
        this.handleSecurity();
        break;
      case 'models':
        await this.handleModels(args);
        break;
      case 'clear':
        this.handleClear();
        break;
      case 'quit':
      case 'exit':
        this.write('\nShutting down...\n');
        this.rl?.close();
        break;
      default:
        this.write(`\nUnknown command: /${cmd}. Try /help\n\n`);
    }
  }

  // ─── /help ───────────────────────────────────────────────────

  private handleHelp(): void {
    this.write('\n');
    this.write(this.bold('Chat\n'));
    this.write('  /chat [agentId]                        Switch active agent or show current\n');
    this.write('  <text>                                 Send message to active agent\n');
    this.write('\n');
    this.write(this.bold('Status & Monitoring\n'));
    this.write('  /status                                Runtime status overview\n');
    this.write('  /agents                                List all agents\n');
    this.write('  /agent <id>                            Detailed agent info\n');
    this.write('  /providers                             Provider connectivity check\n');
    this.write('  /budget                                Per-agent resource usage\n');
    this.write('  /watchdog                              Watchdog check results\n');
    this.write('\n');
    this.write(this.bold('Configuration\n'));
    this.write('  /config                                View full config (redacted)\n');
    this.write('  /config provider <name>                View specific provider\n');
    this.write('  /config set default <provider>         Change default provider\n');
    this.write('  /config set <provider> <field> <value> Edit provider field\n');
    this.write('  /config add <name> <type> <model> [apiKey]  Add provider\n');
    this.write('  /config test [provider]                Test provider connectivity\n');
    this.write('\n');
    this.write(this.bold('Security & Audit\n'));
    this.write('  /audit [limit]                         Recent audit events\n');
    this.write('  /audit filter <field> <value>          Filter events\n');
    this.write('  /audit summary [windowMs]              Audit stats summary\n');
    this.write('  /security                              Security overview\n');
    this.write('\n');
    this.write(this.bold('Models & General\n'));
    this.write('  /models [provider]                     List available models\n');
    this.write('  /clear                                 Clear screen\n');
    this.write('  /help                                  Show this help\n');
    this.write('  /quit, /exit                           Exit\n');
    this.write('\n');
  }

  // ─── /chat ───────────────────────────────────────────────────

  private async handleChat(args: string[]): Promise<void> {
    if (args.length === 0) {
      // Show current active agent and available agents
      const current = this.activeAgentId ?? this.defaultAgentId ?? 'default';
      this.write(`\nActive agent: ${this.cyan(current)}\n`);

      const agents = this.dashboard?.onAgents?.() ?? this.onAgents?.();
      if (agents && agents.length > 0) {
        this.write('Available agents:\n');
        for (const a of agents) {
          const marker = a.id === (this.activeAgentId ?? this.defaultAgentId) ? ' (active)' : '';
          this.write(`  ${a.id} — ${a.name}${marker}\n`);
        }
      }
      this.write('\n');
      return;
    }

    const agentId = args[0];

    // Validate agent exists if dashboard is available
    if (this.dashboard?.onAgentDetail) {
      const detail = this.dashboard.onAgentDetail(agentId);
      if (!detail) {
        this.write(`\n${this.red('Error:')} Agent "${agentId}" not found.\n\n`);
        return;
      }
    }

    this.activeAgentId = agentId;
    const newPrompt = `you (${agentId})> `;
    this.prompt = newPrompt;
    this.rl?.setPrompt(newPrompt);
    this.write(`\nSwitched to agent: ${this.cyan(agentId)}\n\n`);
  }

  // ─── /agents ─────────────────────────────────────────────────

  private handleAgents(): void {
    // Prefer dashboard callbacks for richer data
    if (this.dashboard?.onAgents) {
      const agents = this.dashboard.onAgents();
      if (agents.length === 0) {
        this.write('\nNo agents registered.\n\n');
        return;
      }

      const headers = ['ID', 'Name', 'State', 'Provider', 'Errors', 'Capabilities'];
      const rows = agents.map(a => [
        a.id,
        a.name,
        this.colorState(a.state),
        a.provider ?? '-',
        String(a.consecutiveErrors),
        a.capabilities.length > 0 ? a.capabilities.join(', ') : 'none',
      ]);

      this.write('\n');
      this.writeTable(headers, rows);
      this.write('\n');
      return;
    }

    // Legacy fallback
    if (!this.onAgents) {
      this.write('\nAgent listing not available.\n\n');
      return;
    }
    this.writeAgentsLegacy(this.onAgents());
  }

  // ─── /agent <id> ─────────────────────────────────────────────

  private handleAgentDetail(args: string[]): void {
    if (args.length === 0) {
      this.write('\nUsage: /agent <id>\n\n');
      return;
    }

    if (!this.dashboard?.onAgentDetail) {
      this.write('\nAgent detail not available.\n\n');
      return;
    }

    const detail = this.dashboard.onAgentDetail(args[0]);
    if (!detail) {
      this.write(`\nAgent "${args[0]}" not found.\n\n`);
      return;
    }

    this.write('\n');
    this.write(this.bold(`Agent: ${detail.name}\n`));
    this.write(`  ID:           ${detail.id}\n`);
    this.write(`  State:        ${this.colorState(detail.state)}\n`);
    this.write(`  Provider:     ${detail.provider ?? '-'}\n`);
    this.write(`  Schedule:     ${detail.schedule ?? '-'}\n`);
    this.write(`  Errors:       ${detail.consecutiveErrors}\n`);
    this.write(`  Last active:  ${detail.lastActivityMs > 0 ? this.formatTimeAgo(detail.lastActivityMs) : '-'}\n`);
    this.write(`  Capabilities: ${detail.capabilities.length > 0 ? detail.capabilities.join(', ') : 'none'}\n`);

    if (detail.resourceLimits) {
      const rl = detail.resourceLimits;
      this.write(`  Resource limits:\n`);
      this.write(`    Max invocation:   ${rl.maxInvocationBudgetMs}ms\n`);
      this.write(`    Max tokens/min:   ${rl.maxTokensPerMinute}\n`);
      this.write(`    Max concurrent:   ${rl.maxConcurrentTools}\n`);
      this.write(`    Max queue depth:  ${rl.maxQueueDepth}\n`);
    }
    this.write('\n');
  }

  // ─── /status ─────────────────────────────────────────────────

  private handleStatus(): void {
    if (this.dashboard) {
      this.writeEnhancedStatus();
      return;
    }

    // Legacy fallback
    if (!this.onStatus) {
      this.write('\nStatus not available.\n\n');
      return;
    }
    this.writeStatusLegacy(this.onStatus());
  }

  private writeEnhancedStatus(): void {
    this.write('\n');

    // Config section
    const config = this.dashboard!.onConfig?.();
    if (config) {
      this.write(this.bold('Runtime\n'));
      this.write(`  Default provider:  ${config.defaultProvider}\n`);
      this.write(`  Guardian:          ${config.guardian.enabled ? this.green('enabled') : this.red('disabled')}\n`);
      this.write(`  Max stall:         ${config.runtime.maxStallDurationMs}ms\n`);
      this.write(`  Watchdog interval: ${config.runtime.watchdogIntervalMs}ms\n`);
      this.write(`  Log level:         ${config.runtime.logLevel}\n`);
      this.write('\n');
    }

    // Providers section
    const providers = this.dashboard!.onProviders?.();
    if (providers && providers.length > 0) {
      this.write(this.bold('Providers\n'));
      for (const p of providers) {
        this.write(`  ${p.name}: ${p.type} (${p.model}) — ${p.locality}\n`);
      }
      this.write('\n');
    }

    // Agents by state
    const agents = this.dashboard!.onAgents?.();
    if (agents) {
      const stateCounts: Record<string, number> = {};
      for (const a of agents) {
        stateCounts[a.state] = (stateCounts[a.state] ?? 0) + 1;
      }
      this.write(this.bold('Agents\n'));
      this.write(`  Total: ${agents.length}\n`);
      for (const [state, count] of Object.entries(stateCounts)) {
        this.write(`  ${this.colorState(state)}: ${count}\n`);
      }
      this.write('\n');
    }
  }

  // ─── /providers ──────────────────────────────────────────────

  private async handleProviders(): Promise<void> {
    if (!this.dashboard?.onProvidersStatus) {
      this.write('\nProvider info not available.\n\n');
      return;
    }

    this.write('\nChecking provider connectivity...\n');
    const providers = await this.dashboard.onProvidersStatus();

    if (providers.length === 0) {
      this.write('No providers configured.\n\n');
      return;
    }

    const headers = ['Name', 'Type', 'Model', 'Locality', 'Status'];
    const rows = providers.map(p => [
      p.name,
      p.type,
      p.model,
      p.locality,
      p.connected ? this.green('PASS') : this.red('FAIL'),
    ]);

    this.write('\n');
    this.writeTable(headers, rows);

    // Show available models
    for (const p of providers) {
      if (p.availableModels && p.availableModels.length > 0) {
        this.write(`\n${this.bold(p.name)} models: ${p.availableModels.join(', ')}\n`);
      }
    }
    this.write('\n');
  }

  // ─── /budget ─────────────────────────────────────────────────

  private handleBudget(): void {
    if (!this.dashboard?.onBudget) {
      this.write('\nBudget info not available.\n\n');
      return;
    }

    const budget = this.dashboard.onBudget();

    if (budget.agents.length === 0) {
      this.write('\nNo budget data.\n\n');
      return;
    }

    const headers = ['Agent', 'Tokens/min', 'Concurrent', 'Overruns'];
    const rows = budget.agents.map(a => [
      a.agentId,
      String(a.tokensPerMinute),
      String(a.concurrentInvocations),
      String(a.overrunCount),
    ]);

    this.write('\n');
    this.writeTable(headers, rows);

    if (budget.recentOverruns.length > 0) {
      this.write(`\n${this.bold('Recent overruns:')}\n`);
      for (const o of budget.recentOverruns.slice(-5)) {
        this.write(`  ${o.agentId}: ${o.invocationType} — ${Math.round(o.usedMs)}ms / ${o.budgetMs}ms\n`);
      }
    }
    this.write('\n');
  }

  // ─── /watchdog ───────────────────────────────────────────────

  private handleWatchdog(): void {
    if (!this.dashboard?.onWatchdog) {
      this.write('\nWatchdog not available.\n\n');
      return;
    }

    const results = this.dashboard.onWatchdog();

    if (results.length === 0) {
      this.write('\nNo watchdog results.\n\n');
      return;
    }

    const headers = ['Agent', 'Status', 'Details'];
    const rows = results.map(r => {
      let status: string;
      switch (r.action) {
        case 'ok': status = this.green('OK'); break;
        case 'stalled': status = this.yellow('STALLED'); break;
        case 'retry': status = this.yellow('RETRY'); break;
        case 'killed': status = this.red('KILLED'); break;
        default: status = r.action;
      }
      const details: string[] = [];
      if (r.stalledMs !== undefined) details.push(`stalled ${Math.round(r.stalledMs / 1000)}s`);
      if (r.consecutiveErrors !== undefined) details.push(`errors: ${r.consecutiveErrors}`);
      return [r.agentId, status, details.join(', ') || '-'];
    });

    this.write('\n');
    this.writeTable(headers, rows);
    this.write('\n');
  }

  // ─── /config ─────────────────────────────────────────────────

  private async handleConfig(args: string[]): Promise<void> {
    if (args.length === 0) {
      this.writeRedactedConfig();
      return;
    }

    const subCmd = args[0].toLowerCase();

    switch (subCmd) {
      case 'provider':
        this.handleConfigProvider(args.slice(1));
        break;
      case 'set':
        await this.handleConfigSet(args.slice(1));
        break;
      case 'add':
        await this.handleConfigAdd(args.slice(1));
        break;
      case 'test':
        await this.handleConfigTest(args.slice(1));
        break;
      default:
        this.write(`\nUnknown config subcommand: ${subCmd}\n`);
        this.write('Usage: /config [provider|set|add|test]\n\n');
    }
  }

  private writeRedactedConfig(): void {
    if (!this.dashboard?.onConfig) {
      this.write('\nConfig not available.\n\n');
      return;
    }

    const config = this.dashboard.onConfig();

    this.write('\n');
    this.write(this.bold('LLM Providers\n'));
    for (const [name, cfg] of Object.entries(config.llm)) {
      const isDefault = name === config.defaultProvider ? this.green(' (default)') : '';
      this.write(`  ${this.cyan(name)}${isDefault}\n`);
      this.write(`    provider: ${cfg.provider}\n`);
      this.write(`    model:    ${cfg.model}\n`);
      if (cfg.baseUrl) this.write(`    baseUrl:  ${cfg.baseUrl}\n`);
    }

    this.write('\n');
    this.write(this.bold('Channels\n'));
    if (config.channels.cli) this.write(`  CLI:      ${config.channels.cli.enabled ? 'enabled' : 'disabled'}\n`);
    if (config.channels.telegram) this.write(`  Telegram: ${config.channels.telegram.enabled ? 'enabled' : 'disabled'}\n`);
    if (config.channels.web) {
      this.write(`  Web:      ${config.channels.web.enabled ? 'enabled' : 'disabled'}`);
      if (config.channels.web.port) this.write(` (port ${config.channels.web.port})`);
      this.write('\n');
    }

    this.write('\n');
    this.write(this.bold('Guardian\n'));
    this.write(`  Enabled: ${config.guardian.enabled ? this.green('yes') : this.red('no')}\n`);
    if (config.guardian.rateLimit) {
      this.write(`  Rate limit: ${config.guardian.rateLimit.maxPerMinute}/min, ${config.guardian.rateLimit.maxPerHour}/hr, burst ${config.guardian.rateLimit.burstAllowed}\n`);
    }
    if (config.guardian.inputSanitization) {
      this.write(`  Input sanitization: ${config.guardian.inputSanitization.enabled ? 'enabled' : 'disabled'} (threshold ${config.guardian.inputSanitization.blockThreshold})\n`);
    }
    if (config.guardian.outputScanning) {
      this.write(`  Output scanning: ${config.guardian.outputScanning.enabled ? 'enabled' : 'disabled'} (redact: ${config.guardian.outputScanning.redactSecrets})\n`);
    }
    if (config.guardian.sentinel) {
      this.write(`  Sentinel: ${config.guardian.sentinel.enabled ? 'enabled' : 'disabled'} (${config.guardian.sentinel.schedule})\n`);
    }

    this.write('\n');
    this.write(this.bold('Runtime\n'));
    this.write(`  Max stall:         ${config.runtime.maxStallDurationMs}ms\n`);
    this.write(`  Watchdog interval: ${config.runtime.watchdogIntervalMs}ms\n`);
    this.write(`  Log level:         ${config.runtime.logLevel}\n`);
    this.write('\n');
  }

  private handleConfigProvider(args: string[]): void {
    if (args.length === 0) {
      this.write('\nUsage: /config provider <name>\n\n');
      return;
    }

    if (!this.dashboard?.onConfig) {
      this.write('\nConfig not available.\n\n');
      return;
    }

    const config = this.dashboard.onConfig();
    const name = args[0];
    const provider = config.llm[name];

    if (!provider) {
      this.write(`\nProvider "${name}" not found.\n`);
      this.write(`Available: ${Object.keys(config.llm).join(', ')}\n\n`);
      return;
    }

    const isDefault = name === config.defaultProvider;
    this.write('\n');
    this.write(this.bold(`Provider: ${name}${isDefault ? ' (default)' : ''}\n`));
    this.write(`  Type:    ${provider.provider}\n`);
    this.write(`  Model:   ${provider.model}\n`);
    if (provider.baseUrl) this.write(`  Base URL: ${provider.baseUrl}\n`);
    this.write('\n');
  }

  private async handleConfigSet(args: string[]): Promise<void> {
    if (!this.dashboard?.onConfigUpdate) {
      this.write('\nConfig updates not available.\n\n');
      return;
    }

    if (args.length < 2) {
      this.write('\nUsage:\n');
      this.write('  /config set default <provider>\n');
      this.write('  /config set <provider> model|baseUrl|apiKey <value>\n\n');
      return;
    }

    if (args[0] === 'default') {
      const result = await this.dashboard.onConfigUpdate({ defaultProvider: args[1] });
      this.write(`\n${result.success ? this.green('OK') : this.red('FAIL')}: ${result.message}\n\n`);
      return;
    }

    // /config set <provider> <field> <value>
    if (args.length < 3) {
      this.write('\nUsage: /config set <provider> model|baseUrl|apiKey <value>\n\n');
      return;
    }

    const [provider, field, ...valueParts] = args;
    const value = valueParts.join(' ');
    const validFields = ['model', 'baseUrl', 'apiKey', 'baseurl', 'apikey'];

    if (!validFields.includes(field)) {
      this.write(`\nInvalid field: ${field}. Use model, baseUrl, or apiKey.\n\n`);
      return;
    }

    const normalizedField = field === 'baseurl' ? 'baseUrl' : field === 'apikey' ? 'apiKey' : field;
    const result = await this.dashboard.onConfigUpdate({
      llm: { [provider]: { [normalizedField]: value } },
    });
    this.write(`\n${result.success ? this.green('OK') : this.red('FAIL')}: ${result.message}\n\n`);
  }

  private async handleConfigAdd(args: string[]): Promise<void> {
    if (!this.dashboard?.onConfigUpdate) {
      this.write('\nConfig updates not available.\n\n');
      return;
    }

    if (args.length < 3) {
      this.write('\nUsage: /config add <name> <type> <model> [apiKey]\n');
      this.write('  type: ollama, anthropic, openai\n\n');
      return;
    }

    const [name, type, model, apiKey] = args;
    const validTypes = ['ollama', 'anthropic', 'openai'];

    if (!validTypes.includes(type)) {
      this.write(`\nInvalid provider type: ${type}. Use: ${validTypes.join(', ')}\n\n`);
      return;
    }

    const providerUpdate: Record<string, string> = { provider: type, model };
    if (apiKey) providerUpdate.apiKey = apiKey;

    const result = await this.dashboard.onConfigUpdate({
      llm: { [name]: providerUpdate },
    });
    this.write(`\n${result.success ? this.green('OK') : this.red('FAIL')}: ${result.message}\n\n`);
  }

  private async handleConfigTest(args: string[]): Promise<void> {
    if (!this.dashboard?.onProvidersStatus) {
      this.write('\nProvider testing not available.\n\n');
      return;
    }

    this.write('\nTesting provider connectivity...\n');
    const providers = await this.dashboard.onProvidersStatus();

    // Filter to specific provider if requested
    const filtered = args.length > 0
      ? providers.filter(p => p.name === args[0])
      : providers;

    if (filtered.length === 0) {
      this.write(`Provider "${args[0]}" not found.\n\n`);
      return;
    }

    for (const p of filtered) {
      const status = p.connected ? this.green('PASS') : this.red('FAIL');
      this.write(`  ${p.name}: ${status}\n`);
      if (p.availableModels && p.availableModels.length > 0) {
        this.write(`    Models: ${p.availableModels.join(', ')}\n`);
      }
    }
    this.write('\n');
  }

  // ─── /audit ──────────────────────────────────────────────────

  private handleAudit(args: string[]): void {
    if (!this.dashboard?.onAuditQuery) {
      this.write('\nAudit log not available.\n\n');
      return;
    }

    // /audit summary [windowMs]
    if (args[0] === 'summary') {
      this.handleAuditSummary(args.slice(1));
      return;
    }

    // /audit filter <field> <value>
    if (args[0] === 'filter') {
      this.handleAuditFilter(args.slice(1));
      return;
    }

    // /audit [limit]
    const limit = args.length > 0 ? parseInt(args[0], 10) : 20;
    const events = this.dashboard.onAuditQuery({ limit: isNaN(limit) ? 20 : limit });

    if (events.length === 0) {
      this.write('\nNo audit events.\n\n');
      return;
    }

    this.write('\n');
    for (const e of events) {
      const time = new Date(e.timestamp).toLocaleTimeString();
      const severity = this.colorSeverity(e.severity);
      const controller = e.controller ? ` [${e.controller}]` : '';
      this.write(`  ${this.dim(time)} ${severity} ${e.type} ${this.dim(e.agentId)}${controller}\n`);
    }
    this.write('\n');
  }

  private handleAuditFilter(args: string[]): void {
    if (args.length < 2) {
      this.write('\nUsage: /audit filter type|severity|agent <value>\n\n');
      return;
    }

    const [field, value] = args;
    const filter: Record<string, unknown> = { limit: 50 };

    switch (field) {
      case 'type': filter.type = value; break;
      case 'severity': filter.severity = value; break;
      case 'agent': filter.agentId = value; break;
      default:
        this.write(`\nInvalid filter field: ${field}. Use type, severity, or agent.\n\n`);
        return;
    }

    const events = this.dashboard!.onAuditQuery!(filter as Parameters<NonNullable<DashboardCallbacks['onAuditQuery']>>[0]);

    if (events.length === 0) {
      this.write('\nNo matching events.\n\n');
      return;
    }

    this.write('\n');
    for (const e of events) {
      const time = new Date(e.timestamp).toLocaleTimeString();
      const severity = this.colorSeverity(e.severity);
      const controller = e.controller ? ` [${e.controller}]` : '';
      this.write(`  ${this.dim(time)} ${severity} ${e.type} ${this.dim(e.agentId)}${controller}\n`);
    }
    this.write('\n');
  }

  private handleAuditSummary(args: string[]): void {
    if (!this.dashboard?.onAuditSummary) {
      this.write('\nAudit summary not available.\n\n');
      return;
    }

    const windowMs = args.length > 0 ? parseInt(args[0], 10) : 3_600_000;
    const summary = this.dashboard.onAuditSummary(isNaN(windowMs) ? 3_600_000 : windowMs);

    this.write('\n');
    this.write(this.bold('Audit Summary\n'));
    this.write(`  Window: ${Math.round((isNaN(windowMs) ? 3_600_000 : windowMs) / 60_000)} minutes\n`);
    this.write(`  Total events: ${summary.totalEvents}\n`);
    this.write('\n');

    this.write('  By severity:\n');
    for (const [sev, count] of Object.entries(summary.bySeverity)) {
      if (count > 0) this.write(`    ${this.colorSeverity(sev as 'info' | 'warn' | 'critical')}: ${count}\n`);
    }

    if (Object.keys(summary.byType).length > 0) {
      this.write('\n  By type:\n');
      for (const [type, count] of Object.entries(summary.byType)) {
        this.write(`    ${type}: ${count}\n`);
      }
    }

    if (summary.topDeniedAgents.length > 0) {
      this.write('\n  Top denied agents:\n');
      for (const a of summary.topDeniedAgents) {
        this.write(`    ${a.agentId}: ${a.count} denials\n`);
      }
    }

    if (summary.topControllers.length > 0) {
      this.write('\n  Top controllers:\n');
      for (const c of summary.topControllers) {
        this.write(`    ${c.controller}: ${c.count}\n`);
      }
    }
    this.write('\n');
  }

  // ─── /security ───────────────────────────────────────────────

  private handleSecurity(): void {
    this.write('\n');
    this.write(this.bold('Security Overview\n'));

    // Guardian config
    const config = this.dashboard?.onConfig?.();
    if (config) {
      this.write(`\n  Guardian: ${config.guardian.enabled ? this.green('ENABLED') : this.red('DISABLED')}\n`);
      if (config.guardian.rateLimit) {
        this.write(`  Rate limit: ${config.guardian.rateLimit.maxPerMinute}/min, ${config.guardian.rateLimit.maxPerHour}/hr\n`);
      }
      if (config.guardian.inputSanitization) {
        this.write(`  Input sanitization: ${config.guardian.inputSanitization.enabled ? 'on' : 'off'}\n`);
      }
      if (config.guardian.outputScanning) {
        this.write(`  Output scanning: ${config.guardian.outputScanning.enabled ? 'on' : 'off'}\n`);
      }
      if (config.guardian.sentinel) {
        this.write(`  Sentinel: ${config.guardian.sentinel.enabled ? 'on' : 'off'} (${config.guardian.sentinel.schedule})\n`);
      }
    }

    // Last-hour audit summary
    if (this.dashboard?.onAuditSummary) {
      const summary = this.dashboard.onAuditSummary(3_600_000);
      this.write('\n');
      this.write(this.bold('  Last hour:\n'));
      this.write(`    Total events:    ${summary.totalEvents}\n`);

      const denials = (summary.byType['action_denied'] ?? 0) + (summary.byType['rate_limited'] ?? 0);
      const secrets = (summary.byType['secret_detected'] ?? 0) + (summary.byType['output_blocked'] ?? 0) + (summary.byType['output_redacted'] ?? 0);
      const anomalies = summary.byType['anomaly_detected'] ?? 0;

      this.write(`    Denials:         ${denials > 0 ? this.yellow(String(denials)) : '0'}\n`);
      this.write(`    Secret events:   ${secrets > 0 ? this.red(String(secrets)) : '0'}\n`);
      this.write(`    Anomalies:       ${anomalies > 0 ? this.red(String(anomalies)) : '0'}\n`);
      this.write(`    Critical:        ${summary.bySeverity.critical > 0 ? this.red(String(summary.bySeverity.critical)) : '0'}\n`);
    } else {
      this.write('\n  Audit data not available.\n');
    }
    this.write('\n');
  }

  // ─── /models ─────────────────────────────────────────────────

  private async handleModels(args: string[]): Promise<void> {
    if (!this.dashboard?.onProvidersStatus) {
      this.write('\nModel listing not available.\n\n');
      return;
    }

    const providers = await this.dashboard.onProvidersStatus();

    // Filter to specific provider if requested
    const filtered = args.length > 0
      ? providers.filter(p => p.name === args[0])
      : providers;

    if (filtered.length === 0) {
      if (args.length > 0) {
        this.write(`\nProvider "${args[0]}" not found.\n\n`);
      } else {
        this.write('\nNo providers configured.\n\n');
      }
      return;
    }

    this.write('\n');
    for (const p of filtered) {
      this.write(this.bold(`${p.name}`) + ` (${p.type}):\n`);
      const activeModel = p.model;

      if (p.availableModels && p.availableModels.length > 0) {
        for (const m of p.availableModels) {
          const marker = m === activeModel ? this.green(' (active)') : '';
          this.write(`  ${m}${marker}\n`);
        }
      } else if (p.connected) {
        this.write(`  ${activeModel}${this.green(' (active)')}\n`);
      } else {
        this.write(`  ${this.dim('Unable to list models — provider not connected')}\n`);
      }
    }
    this.write('\n');
  }

  // ─── /clear ──────────────────────────────────────────────────

  private handleClear(): void {
    this.write('\x1b[2J\x1b[H');
  }

  // ─── Formatting helpers ──────────────────────────────────────

  private write(text: string): void {
    this.output.write(text);
  }

  private green(text: string): string {
    return this.useColor ? `\x1b[32m${text}\x1b[0m` : text;
  }

  private red(text: string): string {
    return this.useColor ? `\x1b[31m${text}\x1b[0m` : text;
  }

  private yellow(text: string): string {
    return this.useColor ? `\x1b[33m${text}\x1b[0m` : text;
  }

  private cyan(text: string): string {
    return this.useColor ? `\x1b[36m${text}\x1b[0m` : text;
  }

  private bold(text: string): string {
    return this.useColor ? `\x1b[1m${text}\x1b[0m` : text;
  }

  private dim(text: string): string {
    return this.useColor ? `\x1b[2m${text}\x1b[0m` : text;
  }

  private stripAnsi(text: string): string {
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }

  private colorState(state: string): string {
    switch (state) {
      case 'running':
      case 'idle':
      case 'ready':
        return this.green(state);
      case 'errored':
      case 'dead':
        return this.red(state);
      case 'stalled':
      case 'paused':
        return this.yellow(state);
      default:
        return state;
    }
  }

  private colorSeverity(severity: string): string {
    switch (severity) {
      case 'critical': return this.red(severity);
      case 'warn': return this.yellow(severity);
      case 'info': return this.dim(severity);
      default: return severity;
    }
  }

  private formatTimeAgo(timestampMs: number): string {
    const diff = Date.now() - timestampMs;
    if (diff < 1000) return 'just now';
    if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
    if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
    return `${Math.round(diff / 3_600_000)}h ago`;
  }

  private writeTable(headers: string[], rows: string[][]): void {
    // Calculate column widths (use stripped text for width calculation)
    const colWidths = headers.map((h, i) => {
      const maxRowWidth = rows.reduce((max, row) => {
        return Math.max(max, this.stripAnsi(row[i] ?? '').length);
      }, 0);
      return Math.max(h.length, maxRowWidth);
    });

    // Header
    const headerLine = headers.map((h, i) => this.bold(h.padEnd(colWidths[i]))).join('  ');
    this.write(`  ${headerLine}\n`);

    // Separator
    const sep = colWidths.map(w => '─'.repeat(w)).join('──');
    this.write(`  ${sep}\n`);

    // Rows
    for (const row of rows) {
      const line = row.map((cell, i) => {
        const stripped = this.stripAnsi(cell);
        const pad = colWidths[i] - stripped.length;
        return cell + ' '.repeat(Math.max(0, pad));
      }).join('  ');
      this.write(`  ${line}\n`);
    }
  }

  // ─── Legacy formatting (backward compat) ─────────────────────

  private writeAgentsLegacy(agents: AgentInfo[]): void {
    if (agents.length === 0) {
      this.write('\nNo agents registered.\n\n');
      return;
    }
    this.write('\nRegistered agents:\n');
    for (const a of agents) {
      const caps = a.capabilities.length > 0 ? a.capabilities.join(', ') : 'none';
      this.write(`  ${a.name} (${a.id}) — ${a.state} [${caps}]\n`);
    }
    this.write('\n');
  }

  private writeStatusLegacy(status: RuntimeStatus): void {
    this.write('\nRuntime status:\n');
    this.write(`  Running:   ${status.running ? 'yes' : 'no'}\n`);
    this.write(`  Agents:    ${status.agentCount}\n`);
    this.write(`  Guardian:  ${status.guardianEnabled ? 'enabled' : 'disabled'}\n`);
    this.write(`  Providers: ${status.providers.length > 0 ? status.providers.join(', ') : 'none'}\n`);
    this.write('\n');
  }
}
