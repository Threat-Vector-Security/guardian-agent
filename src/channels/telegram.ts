/**
 * Telegram channel adapter.
 *
 * Uses grammy bot framework. Supports polling mode.
 * Filters by allowed_chat_ids. Typing indicators.
 */

import { Bot, type Context } from 'grammy';
import { randomUUID } from 'node:crypto';
import type { ChannelAdapter, MessageCallback } from './types.js';
import { createLogger } from '../util/logging.js';

const log = createLogger('channel:telegram');

export interface TelegramChannelOptions {
  /** Telegram bot token. */
  botToken: string;
  /** Allowed chat IDs (empty = allow all). */
  allowedChatIds?: number[];
  /** Default agent to route messages to. */
  defaultAgent?: string;
}

export class TelegramChannel implements ChannelAdapter {
  readonly name = 'telegram';
  private bot: Bot;
  private onMessage: MessageCallback | null = null;
  private allowedChatIds: Set<number>;

  constructor(options: TelegramChannelOptions) {
    this.bot = new Bot(options.botToken);
    this.allowedChatIds = new Set(options.allowedChatIds ?? []);
  }

  async start(onMessage: MessageCallback): Promise<void> {
    this.onMessage = onMessage;

    this.bot.on('message:text', async (ctx: Context) => {
      if (!ctx.message?.text || !ctx.chat) return;

      // Filter by allowed chat IDs
      if (this.allowedChatIds.size > 0 && !this.allowedChatIds.has(ctx.chat.id)) {
        log.warn({ chatId: ctx.chat.id }, 'Message from unauthorized chat');
        return;
      }

      if (!this.onMessage) return;

      // Send typing indicator
      await ctx.replyWithChatAction('typing');

      try {
        const response = await this.onMessage({
          id: randomUUID(),
          userId: String(ctx.from?.id ?? ctx.chat.id),
          channel: 'telegram',
          content: ctx.message.text,
          timestamp: Date.now(),
        });

        await ctx.reply(response.content);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error({ chatId: ctx.chat.id, err: msg }, 'Error handling Telegram message');
        await ctx.reply('Sorry, an error occurred processing your message.');
      }
    });

    // Start polling
    this.bot.start({
      onStart: () => {
        log.info('Telegram bot started (polling)');
      },
    });
  }

  async stop(): Promise<void> {
    this.bot.stop();
    this.onMessage = null;
    log.info('Telegram bot stopped');
  }

  async send(userId: string, text: string): Promise<void> {
    const chatId = Number(userId);
    if (isNaN(chatId)) {
      log.error({ userId }, 'Invalid Telegram chat ID');
      return;
    }
    await this.bot.api.sendMessage(chatId, text);
  }
}
