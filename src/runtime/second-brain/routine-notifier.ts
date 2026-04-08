import type { GuardianAgentConfig } from '../../config/types.js';
import type { CLIChannel } from '../../channels/cli.js';
import type { TelegramChannel } from '../../channels/telegram.js';
import type { WebChannel } from '../../channels/web.js';
import type { HorizonRoutineOutcome } from './horizon-scanner.js';

async function sendTelegramIfConfigured(
  telegramChannel: Pick<TelegramChannel, 'send'> | null,
  chatIds: readonly number[],
  text: string,
): Promise<void> {
  if (!telegramChannel || chatIds.length === 0) {
    return;
  }
  for (const chatId of chatIds) {
    await telegramChannel.send(String(chatId), text);
  }
}

export function createSecondBrainRoutineNotifier(args: {
  configRef: { current: GuardianAgentConfig };
  getCliChannel: () => Pick<CLIChannel, 'send'> | null;
  getTelegramChannel: () => Pick<TelegramChannel, 'send'> | null;
  getWebChannel: () => Pick<WebChannel, 'send'> | null;
}): (outcome: HorizonRoutineOutcome) => Promise<void> {
  return async (outcome: HorizonRoutineOutcome): Promise<void> => {
    const text = outcome.text.trim();
    if (!text) {
      return;
    }
    const channels = [...new Set(outcome.channels)];
    if (channels.length === 0) {
      return;
    }

    for (const channel of channels) {
      if (channel === 'telegram') {
        await sendTelegramIfConfigured(
          args.getTelegramChannel(),
          args.configRef.current.channels.telegram?.allowedChatIds ?? [],
          text,
        );
        continue;
      }
      if (channel === 'web') {
        const webChannel = args.getWebChannel();
        if (!webChannel) {
          continue;
        }
        await webChannel.send(args.configRef.current.assistant.identity.primaryUserId, text);
        continue;
      }
      if (channel === 'cli') {
        const cliChannel = args.getCliChannel();
        if (!cliChannel) {
          continue;
        }
        await cliChannel.send(args.configRef.current.assistant.identity.primaryUserId, text);
      }
    }
  };
}
