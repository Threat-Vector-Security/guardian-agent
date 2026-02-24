/**
 * Channel adapter interface.
 *
 * Channels bridge external communication systems (CLI, Telegram, Web)
 * to the agent runtime's message dispatch.
 */

import type { UserMessage, AgentResponse } from '../agent/types.js';

/** Callback when a message is received from a channel. */
export type MessageCallback = (message: UserMessage) => Promise<AgentResponse>;

/** Channel adapter interface. */
export interface ChannelAdapter {
  /** Channel name identifier. */
  readonly name: string;

  /** Start the channel, providing a callback for incoming messages. */
  start(onMessage: MessageCallback): Promise<void>;

  /** Stop the channel. */
  stop(): Promise<void>;

  /** Send a message to a user via this channel. */
  send(userId: string, text: string): Promise<void>;
}
