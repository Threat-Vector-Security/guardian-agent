import { describe, expect, it, vi } from 'vitest';
import { createSecondBrainRoutineNotifier } from './routine-notifier.js';

describe('createSecondBrainRoutineNotifier', () => {
  it('delivers routine outcomes to the requested channels', async () => {
    const cliChannel = { send: vi.fn(async () => undefined) };
    const telegramChannel = { send: vi.fn(async () => undefined) };
    const webChannel = { send: vi.fn(async () => undefined) };
    const notifier = createSecondBrainRoutineNotifier({
      configRef: {
        current: {
          assistant: {
            identity: { primaryUserId: 'owner' },
          },
          channels: {
            telegram: {
              allowedChatIds: [111, 222],
            },
          },
        } as any,
      },
      getCliChannel: () => cliChannel as any,
      getTelegramChannel: () => telegramChannel as any,
      getWebChannel: () => webChannel as any,
    });

    await notifier({
      routineId: 'morning-brief',
      channels: ['telegram', 'web', 'cli', 'web'],
      importance: 'useful',
      text: 'Your morning brief is ready.',
    });

    expect(telegramChannel.send).toHaveBeenCalledTimes(2);
    expect(telegramChannel.send).toHaveBeenNthCalledWith(1, '111', 'Your morning brief is ready.');
    expect(telegramChannel.send).toHaveBeenNthCalledWith(2, '222', 'Your morning brief is ready.');
    expect(webChannel.send).toHaveBeenCalledWith('owner', 'Your morning brief is ready.');
    expect(cliChannel.send).toHaveBeenCalledWith('owner', 'Your morning brief is ready.');
  });
});
