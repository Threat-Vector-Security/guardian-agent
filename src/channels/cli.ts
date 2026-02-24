/**
 * CLI channel adapter.
 *
 * Interactive readline prompt. Commands: /agents, /status, /quit.
 * No external dependencies.
 */

import { createInterface, type Interface } from 'node:readline';
import { randomUUID } from 'node:crypto';
import type { ChannelAdapter, MessageCallback } from './types.js';
import { createLogger } from '../util/logging.js';

const log = createLogger('channel:cli');

export interface CLIChannelOptions {
  /** Default agent to route messages to. */
  defaultAgent?: string;
  /** Custom prompt string. */
  prompt?: string;
  /** Input stream (for testing). */
  input?: NodeJS.ReadableStream;
  /** Output stream (for testing). */
  output?: NodeJS.WritableStream;
}

export class CLIChannel implements ChannelAdapter {
  readonly name = 'cli';
  private rl: Interface | null = null;
  private onMessage: MessageCallback | null = null;
  private prompt: string;
  private input: NodeJS.ReadableStream;
  private output: NodeJS.WritableStream;

  constructor(options: CLIChannelOptions = {}) {
    this.prompt = options.prompt ?? 'you> ';
    this.input = options.input ?? process.stdin;
    this.output = options.output ?? process.stdout;
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
      if (!this.onMessage) {
        this.rl?.prompt();
        return;
      }

      try {
        const response = await this.onMessage({
          id: randomUUID(),
          userId: 'cli-user',
          channel: 'cli',
          content: trimmed,
          timestamp: Date.now(),
        });

        this.write(`\nassistant> ${response.content}\n\n`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.write(`\n[error] ${msg}\n\n`);
      }

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

  private write(text: string): void {
    this.output.write(text);
  }

  private async handleCommand(command: string): Promise<void> {
    switch (command) {
      case '/help':
        this.write('\nCommands:\n');
        this.write('  /agents  — List registered agents\n');
        this.write('  /status  — Show runtime status\n');
        this.write('  /quit    — Exit\n\n');
        break;

      case '/quit':
      case '/exit':
        this.write('\nShutting down...\n');
        this.rl?.close();
        break;

      default:
        this.write(`\nUnknown command: ${command}. Try /help\n\n`);
    }
  }
}
