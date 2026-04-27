export const WEB_GUARDIAN_CHAT_SURFACE_ID = 'web-guardian-chat';
export const WEB_CODE_WORKBENCH_SURFACE_ID = 'web-code-workbench';
export const CLI_GUARDIAN_CHAT_SURFACE_ID = 'cli-guardian-chat';

function trimSurfaceValue(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function getDefaultSurfaceIdForChannel(channel?: string): string | undefined {
  switch (trimSurfaceValue(channel)) {
    case 'web':
      return WEB_GUARDIAN_CHAT_SURFACE_ID;
    case 'cli':
      return CLI_GUARDIAN_CHAT_SURFACE_ID;
    default:
      return undefined;
  }
}

export function resolveConversationSurfaceId(args: {
  channel?: string;
  surfaceId?: string;
  userId?: string;
}): string {
  const explicitSurfaceId = trimSurfaceValue(args.surfaceId);
  if (explicitSurfaceId) return explicitSurfaceId;
  const defaultSurfaceId = getDefaultSurfaceIdForChannel(args.channel);
  if (defaultSurfaceId) return defaultSurfaceId;
  const userId = trimSurfaceValue(args.userId);
  return userId || 'default-surface';
}

export function resolveWebSurfaceId(
  surfaceId: string | undefined,
  fallbackSurfaceId: string = WEB_GUARDIAN_CHAT_SURFACE_ID,
): string {
  return trimSurfaceValue(surfaceId) || fallbackSurfaceId;
}

export function resolveConversationHistoryChannel(args: {
  channel?: string;
  surfaceId?: string;
}): string {
  const channel = trimSurfaceValue(args.channel) || 'web';
  const surfaceId = trimSurfaceValue(args.surfaceId);
  if (!surfaceId) {
    return channel;
  }
  return `${channel}:surface:${encodeURIComponent(surfaceId)}`;
}
