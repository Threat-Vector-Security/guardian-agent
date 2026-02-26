/**
 * Tests for FailoverProvider.
 */

import { describe, it, expect, vi } from 'vitest';
import { FailoverProvider } from './failover-provider.js';
import type { LLMProvider, ChatMessage, ChatResponse, ChatChunk, ModelInfo } from './types.js';

function createMockProvider(name: string, overrides?: Partial<LLMProvider>): LLMProvider {
  return {
    name,
    chat: vi.fn().mockResolvedValue({
      content: `Response from ${name}`,
      model: 'test-model',
      finishReason: 'stop',
    } satisfies ChatResponse),
    stream: vi.fn().mockImplementation(async function* () {
      yield { content: `Chunk from ${name}`, done: true } satisfies ChatChunk;
    }),
    listModels: vi.fn().mockResolvedValue([
      { id: 'test-model', name: 'Test Model', provider: name },
    ] satisfies ModelInfo[]),
    ...overrides,
  };
}

const testMessages: ChatMessage[] = [{ role: 'user', content: 'hello' }];

describe('FailoverProvider', () => {
  it('should use the highest priority provider first', async () => {
    const primary = createMockProvider('primary');
    const secondary = createMockProvider('secondary');

    const failover = new FailoverProvider([
      { name: 'primary', provider: primary, priority: 1 },
      { name: 'secondary', provider: secondary, priority: 2 },
    ]);

    const response = await failover.chat(testMessages);
    expect(response.content).toBe('Response from primary');
    expect(primary.chat).toHaveBeenCalledTimes(1);
    expect(secondary.chat).not.toHaveBeenCalled();
  });

  it('should fail over to secondary on transient error', async () => {
    const primary = createMockProvider('primary', {
      chat: vi.fn().mockRejectedValue({ status: 500, message: 'Internal Server Error' }),
    });
    const secondary = createMockProvider('secondary');

    const failover = new FailoverProvider([
      { name: 'primary', provider: primary, priority: 1 },
      { name: 'secondary', provider: secondary, priority: 2 },
    ]);

    const response = await failover.chat(testMessages);
    expect(response.content).toBe('Response from secondary');
    expect(primary.chat).toHaveBeenCalledTimes(1);
    expect(secondary.chat).toHaveBeenCalledTimes(1);
  });

  it('should fail over on timeout', async () => {
    const primary = createMockProvider('primary', {
      chat: vi.fn().mockRejectedValue(new Error('request timeout')),
    });
    const secondary = createMockProvider('secondary');

    const failover = new FailoverProvider([
      { name: 'primary', provider: primary, priority: 1 },
      { name: 'secondary', provider: secondary, priority: 2 },
    ]);

    const response = await failover.chat(testMessages);
    expect(response.content).toBe('Response from secondary');
  });

  it('should NOT fail over on auth error', async () => {
    const primary = createMockProvider('primary', {
      chat: vi.fn().mockRejectedValue({ status: 401, message: 'Unauthorized' }),
    });
    const secondary = createMockProvider('secondary');

    const failover = new FailoverProvider([
      { name: 'primary', provider: primary, priority: 1 },
      { name: 'secondary', provider: secondary, priority: 2 },
    ]);

    await expect(failover.chat(testMessages)).rejects.toEqual({ status: 401, message: 'Unauthorized' });
    expect(secondary.chat).not.toHaveBeenCalled();
  });

  it('should throw when all providers are exhausted', async () => {
    const primary = createMockProvider('primary', {
      chat: vi.fn().mockRejectedValue({ status: 500, message: 'down' }),
    });
    const secondary = createMockProvider('secondary', {
      chat: vi.fn().mockRejectedValue(new Error('timeout')),
    });

    const failover = new FailoverProvider([
      { name: 'primary', provider: primary, priority: 1 },
      { name: 'secondary', provider: secondary, priority: 2 },
    ]);

    await expect(failover.chat(testMessages)).rejects.toThrow('timeout');
  });

  it('should aggregate models from all available providers', async () => {
    const primary = createMockProvider('primary');
    const secondary = createMockProvider('secondary');

    const failover = new FailoverProvider([
      { name: 'primary', provider: primary, priority: 1 },
      { name: 'secondary', provider: secondary, priority: 2 },
    ]);

    const models = await failover.listModels();
    expect(models).toHaveLength(2);
  });

  it('should report circuit states for monitoring', async () => {
    const primary = createMockProvider('primary');
    const secondary = createMockProvider('secondary');

    const failover = new FailoverProvider([
      { name: 'primary', provider: primary, priority: 1 },
      { name: 'secondary', provider: secondary, priority: 2 },
    ]);

    const states = failover.getCircuitStates();
    expect(states).toHaveLength(2);
    expect(states[0].name).toBe('primary');
    expect(states[0].state).toBe('closed');
    expect(states[1].name).toBe('secondary');
  });
});
