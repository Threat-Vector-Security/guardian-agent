import type { AnalyticsService } from '../runtime/analytics.js';
import type { NotificationService } from '../runtime/notifications.js';
import type { Runtime } from '../runtime/runtime.js';
import type { ConversationService } from '../runtime/conversation.js';
import type { CodeSessionStore } from '../runtime/code-sessions.js';
import type { MCPClientManager } from '../tools/mcp-client.js';
import type { ToolExecutor } from '../tools/executor.js';

export interface BootstrapChannelStopEntry {
  name: string;
  stop: () => Promise<void>;
}

interface LoggerLike {
  info(data: unknown, message?: string): void;
  warn(data: unknown, message?: string): void;
  error(data: unknown, message?: string): void;
}

interface ForceExitTimerHandle {
  unref?: () => void;
}

export function createShutdownHandler(args: {
  channels: BootstrapChannelStopEntry[];
  clearManagedIntervals: () => void;
  mcpManager?: Pick<MCPClientManager, 'disconnectAll'>;
  toolExecutor: Pick<ToolExecutor, 'dispose'>;
  notificationService: Pick<NotificationService, 'stop'>;
  runtime: Pick<Runtime, 'stop'>;
  conversations: Pick<ConversationService, 'close'>;
  codeSessionStore: Pick<CodeSessionStore, 'close'>;
  analytics: Pick<AnalyticsService, 'close'>;
  settleTerminalForExit: () => Promise<void>;
  log: LoggerLike;
  scheduleForceExit?: (callback: () => void, delayMs: number) => ForceExitTimerHandle;
  setExitCode?: (code: number) => void;
  forceExit?: (code: number) => void;
}): (signal: string) => Promise<void> {
  let shuttingDown = false;

  return async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    args.log.info({ signal }, 'Shutting down...');

    const forceExitTimer = (args.scheduleForceExit ?? ((callback, delayMs) => setTimeout(callback, delayMs)))(
      () => {
        args.log.warn('Graceful shutdown timed out, forcing exit');
        (args.forceExit ?? ((code: number) => process.exit(code)))(1);
      },
      5_000,
    );
    forceExitTimer.unref?.();

    for (const channel of args.channels) {
      try {
        await channel.stop();
      } catch (err) {
        args.log.error({ channel: channel.name, err }, 'Error stopping channel');
      }
    }

    args.clearManagedIntervals();

    if (args.mcpManager) {
      try {
        await args.mcpManager.disconnectAll();
      } catch (err) {
        args.log.error({ err }, 'Error disconnecting MCP servers');
      }
    }

    try {
      await args.toolExecutor.dispose();
    } catch (err) {
      args.log.error({ err }, 'Error disposing tool executor');
    }

    args.notificationService.stop();
    await args.runtime.stop();
    args.conversations.close();
    args.codeSessionStore.close();
    args.analytics.close();

    (args.setExitCode ?? ((code: number) => { process.exitCode = code; }))(0);
    await args.settleTerminalForExit();
  };
}
