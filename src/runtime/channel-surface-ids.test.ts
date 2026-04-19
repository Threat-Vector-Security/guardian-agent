import { describe, expect, it } from 'vitest';

import {
  CLI_GUARDIAN_CHAT_SURFACE_ID,
  WEB_CODE_WORKBENCH_SURFACE_ID,
  WEB_GUARDIAN_CHAT_SURFACE_ID,
  getDefaultSurfaceIdForChannel,
  resolveConversationSurfaceId,
  resolveWebSurfaceId,
} from './channel-surface-ids.js';

describe('channel surface ids', () => {
  it('returns stable defaults for canonical chat surfaces', () => {
    expect(getDefaultSurfaceIdForChannel('web')).toBe(WEB_GUARDIAN_CHAT_SURFACE_ID);
    expect(getDefaultSurfaceIdForChannel('cli')).toBe(CLI_GUARDIAN_CHAT_SURFACE_ID);
    expect(getDefaultSurfaceIdForChannel('web ').trim()).toBe(WEB_GUARDIAN_CHAT_SURFACE_ID);
    expect(getDefaultSurfaceIdForChannel('telegram')).toBeUndefined();
  });

  it('prefers explicit surface ids and otherwise falls back by channel', () => {
    expect(resolveConversationSurfaceId({
      channel: 'web',
      userId: 'owner',
    })).toBe(WEB_GUARDIAN_CHAT_SURFACE_ID);

    expect(resolveConversationSurfaceId({
      channel: 'cli',
      userId: 'owner',
    })).toBe(CLI_GUARDIAN_CHAT_SURFACE_ID);

    expect(resolveConversationSurfaceId({
      channel: 'web',
      surfaceId: WEB_CODE_WORKBENCH_SURFACE_ID,
      userId: 'owner',
    })).toBe(WEB_CODE_WORKBENCH_SURFACE_ID);

    expect(resolveConversationSurfaceId({
      channel: 'telegram',
      userId: 'thread-42',
    })).toBe('thread-42');
  });

  it('keeps web route fallbacks anchored to the canonical guardian chat surface', () => {
    expect(resolveWebSurfaceId(undefined)).toBe(WEB_GUARDIAN_CHAT_SURFACE_ID);
    expect(resolveWebSurfaceId('')).toBe(WEB_GUARDIAN_CHAT_SURFACE_ID);
    expect(resolveWebSurfaceId('custom-surface')).toBe('custom-surface');
    expect(resolveWebSurfaceId(undefined, WEB_CODE_WORKBENCH_SURFACE_ID)).toBe(WEB_CODE_WORKBENCH_SURFACE_ID);
  });
});
