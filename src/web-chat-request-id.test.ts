import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('createClientRequestId', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('prefers crypto.randomUUID when available', async () => {
    const randomUUID = vi.fn(() => 'uuid-from-randomUUID');
    vi.stubGlobal('crypto', { randomUUID });

    const { createClientRequestId } = await import('../web/public/js/chat-request-id.js');

    expect(createClientRequestId()).toBe('uuid-from-randomUUID');
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  it('builds an RFC 4122 id from crypto.getRandomValues when randomUUID is unavailable', async () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (buffer: Uint8Array) => {
        buffer.set([
          0x00,
          0x11,
          0x22,
          0x33,
          0x44,
          0x55,
          0x66,
          0x77,
          0x88,
          0x99,
          0xaa,
          0xbb,
          0xcc,
          0xdd,
          0xee,
          0xff,
        ]);
        return buffer;
      },
    });

    const { createClientRequestId } = await import('../web/public/js/chat-request-id.js');

    expect(createClientRequestId()).toBe('00112233-4455-4677-8899-aabbccddeeff');
  });

  it('falls back to a monotonic id when Web Crypto is unavailable', async () => {
    vi.stubGlobal('crypto', undefined);
    vi.spyOn(Date, 'now').mockReturnValue(1_710_000_000_000);

    const { createClientRequestId } = await import('../web/public/js/chat-request-id.js');

    expect(createClientRequestId()).toBe('web-1710000000000-1');
    expect(createClientRequestId()).toBe('web-1710000000000-2');
  });
});
