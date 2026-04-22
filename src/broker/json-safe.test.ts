import { describe, expect, it } from 'vitest';
import { stringifyJsonTransport, toJsonTransportValue } from './json-safe.js';

describe('json-safe transport helpers', () => {
  it('normalizes broker payloads with circular references and non-json values', () => {
    const cyclic: Record<string, unknown> = {
      name: 'root',
      count: 42,
      huge: 123n,
      items: new Set(['a', 'b']),
      mapping: new Map([['key', { nested: true }]]),
    };
    cyclic.self = cyclic;

    const normalized = toJsonTransportValue(cyclic) as Record<string, unknown>;
    expect(normalized).toMatchObject({
      name: 'root',
      count: 42,
      huge: '123',
      items: ['a', 'b'],
      mapping: {
        key: {
          nested: true,
        },
      },
      self: '[Circular]',
    });
  });

  it('stringifies error objects into transport-safe json', () => {
    const payload = {
      error: new Error('boom'),
    };
    expect(() => stringifyJsonTransport(payload)).not.toThrow();
    expect(stringifyJsonTransport(payload)).toContain('"message":"boom"');
  });
});
