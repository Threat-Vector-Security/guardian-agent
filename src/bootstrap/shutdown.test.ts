import { describe, expect, it, vi } from 'vitest';
import { createShutdownHandler } from './shutdown.js';

describe('shutdown helper', () => {
  it('stops resources and finalizes graceful shutdown', async () => {
    const channels = [
      { name: 'cli', stop: vi.fn(async () => {}) },
      { name: 'web', stop: vi.fn(async () => {}) },
    ];
    const clearManagedIntervals = vi.fn();
    const mcpManager = { disconnectAll: vi.fn(async () => {}) };
    const toolExecutor = { dispose: vi.fn(async () => {}) };
    const notificationService = { stop: vi.fn() };
    const runtime = { stop: vi.fn(async () => {}) };
    const conversations = { close: vi.fn() };
    const codeSessionStore = { close: vi.fn() };
    const analytics = { close: vi.fn() };
    const settleTerminalForExit = vi.fn(async () => {});
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const scheduleForceExit = vi.fn(() => ({ unref: vi.fn() }));
    const setExitCode = vi.fn();

    const shutdown = createShutdownHandler({
      channels,
      clearManagedIntervals,
      mcpManager,
      toolExecutor,
      notificationService,
      runtime,
      conversations,
      codeSessionStore,
      analytics,
      settleTerminalForExit,
      log,
      scheduleForceExit,
      setExitCode,
      forceExit: vi.fn(),
    });

    await shutdown('SIGTERM');

    expect(channels[0].stop).toHaveBeenCalledOnce();
    expect(channels[1].stop).toHaveBeenCalledOnce();
    expect(clearManagedIntervals).toHaveBeenCalledOnce();
    expect(mcpManager.disconnectAll).toHaveBeenCalledOnce();
    expect(toolExecutor.dispose).toHaveBeenCalledOnce();
    expect(notificationService.stop).toHaveBeenCalledOnce();
    expect(runtime.stop).toHaveBeenCalledOnce();
    expect(conversations.close).toHaveBeenCalledOnce();
    expect(codeSessionStore.close).toHaveBeenCalledOnce();
    expect(analytics.close).toHaveBeenCalledOnce();
    expect(setExitCode).toHaveBeenCalledWith(0);
    expect(settleTerminalForExit).toHaveBeenCalledOnce();
  });

  it('ignores repeated shutdown calls after the first signal', async () => {
    const channel = { name: 'cli', stop: vi.fn(async () => {}) };
    const shutdown = createShutdownHandler({
      channels: [channel],
      clearManagedIntervals: vi.fn(),
      toolExecutor: { dispose: vi.fn(async () => {}) },
      notificationService: { stop: vi.fn() },
      runtime: { stop: vi.fn(async () => {}) },
      conversations: { close: vi.fn() },
      codeSessionStore: { close: vi.fn() },
      analytics: { close: vi.fn() },
      settleTerminalForExit: vi.fn(async () => {}),
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      scheduleForceExit: () => ({ unref: vi.fn() }),
      setExitCode: vi.fn(),
      forceExit: vi.fn(),
    });

    await shutdown('SIGINT');
    await shutdown('SIGTERM');

    expect(channel.stop).toHaveBeenCalledOnce();
  });
});
