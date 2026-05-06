import { describe, expect, it, vi } from 'vitest';
import type { AgentContext } from '../../agent/types.js';
import type { ChatMessage, ChatResponse } from '../../llm/types.js';
import {
  chatWithAlternateProvider,
  chatWithFallback,
  chatWithRoutingMetadata,
  isRetryableExternalProviderError,
  resolvePreferredProviderOrder,
} from './provider-fallback.js';

const messages: ChatMessage[] = [{ role: 'user', content: 'hello' }];
const response = (content: string): ChatResponse => ({
  content,
  toolCalls: [],
  model: 'test-model',
  finishReason: 'stop',
});

function ctx(name: string, chat = vi.fn(async () => response('primary'))): AgentContext {
  return {
    agentId: 'chat',
    emit: vi.fn(async () => {}),
    llm: {
      name,
      chat,
    } as never,
    checkAction: vi.fn(),
    capabilities: [],
  };
}

describe('provider fallback runtime', () => {
  it('normalizes preferred provider order', () => {
    expect(resolvePreferredProviderOrder([' ollama-cloud ', '', 'openai', 'ollama-cloud'])).toEqual([
      'ollama-cloud',
      'openai',
    ]);
    expect(resolvePreferredProviderOrder([])).toBeUndefined();
  });

  it('starts on the selected provider when it differs from the current context provider', async () => {
    const primaryChat = vi.fn(async () => response('primary'));
    const fallbackChain = {
      chatWithProviderOrder: vi.fn(async () => ({
        providerName: 'ollama-cloud-coding',
        usedFallback: false,
        skipped: [],
        response: response('selected provider'),
      })),
      chatWithFallback: vi.fn(),
      chatWithFallbackAfterPrimary: vi.fn(),
      chatWithFallbackAfterProvider: vi.fn(),
    };

    const result = await chatWithRoutingMetadata({
      agentId: 'chat',
      ctx: ctx('ollama', primaryChat),
      messages,
      fallbackProviderOrder: ['ollama-cloud-coding', 'openai'],
      fallbackChain,
      log: { warn: vi.fn() },
    });

    expect(primaryChat).not.toHaveBeenCalled();
    expect(fallbackChain.chatWithProviderOrder).toHaveBeenCalledWith(
      ['ollama-cloud-coding', 'openai'],
      messages,
      undefined,
    );
    expect(result).toMatchObject({
      providerName: 'ollama-cloud-coding',
      providerLocality: 'external',
      response: { content: 'selected provider' },
      usedFallback: false,
    });
  });

  it('marks provider-order responses as fallback when the selected provider was skipped', async () => {
    const fallbackChain = {
      chatWithProviderOrder: vi.fn(async () => ({
        providerName: 'nvidia-general',
        usedFallback: false,
        skipped: ['ollama-cloud-coding'],
        response: response('alternate provider'),
      })),
      chatWithFallback: vi.fn(),
      chatWithFallbackAfterPrimary: vi.fn(),
      chatWithFallbackAfterProvider: vi.fn(),
    };

    const result = await chatWithRoutingMetadata({
      agentId: 'chat',
      ctx: ctx('ollama'),
      messages,
      fallbackProviderOrder: ['ollama-cloud-coding', 'nvidia-general'],
      fallbackChain,
      log: { warn: vi.fn() },
    });

    expect(result).toMatchObject({
      providerName: 'nvidia-general',
      providerLocality: 'external',
      response: { content: 'alternate provider' },
      usedFallback: true,
    });
  });

  it('falls back after a primary provider failure', async () => {
    const primaryChat = vi.fn(async () => {
      throw new Error('provider unavailable');
    });
    const fallbackChain = {
      chatWithProviderOrder: vi.fn(),
      chatWithFallback: vi.fn(async () => ({
        providerName: 'openai',
        usedFallback: true,
        skipped: ['ollama'],
        response: response('fallback'),
      })),
      chatWithFallbackAfterPrimary: vi.fn(),
      chatWithFallbackAfterProvider: vi.fn(),
    };

    const result = await chatWithFallback({
      agentId: 'chat',
      ctx: ctx('ollama', primaryChat),
      messages,
      fallbackChain,
      log: { warn: vi.fn() },
    });

    expect(result.content).toBe('fallback');
    expect(fallbackChain.chatWithFallback).toHaveBeenCalledWith(messages, undefined);
  });

  it('centralizes alternate-provider retry after a named provider', async () => {
    const fallbackChain = {
      chatWithProviderOrder: vi.fn(),
      chatWithFallback: vi.fn(),
      chatWithFallbackAfterPrimary: vi.fn(),
      chatWithFallbackAfterProvider: vi.fn(async () => ({
        providerName: 'openai',
        usedFallback: true,
        skipped: ['ollama'],
        response: response('alternate'),
      })),
    };

    const result = await chatWithAlternateProvider({
      primaryProviderName: 'ollama',
      messages,
      fallbackProviderOrder: ['ollama', 'openai'],
      fallbackChain,
    });

    expect(result).toMatchObject({
      providerName: 'openai',
      providerLocality: 'external',
      usedFallback: true,
      response: { content: 'alternate' },
    });
    expect(fallbackChain.chatWithFallbackAfterProvider).toHaveBeenCalledWith(
      'ollama',
      ['ollama', 'openai'],
      messages,
      undefined,
    );
  });

  it('recognizes retryable external provider errors', () => {
    expect(isRetryableExternalProviderError(new Error('HTTP 503 service unavailable'))).toBe(true);
    expect(isRetryableExternalProviderError(new Error('429 rate limit exceeded'))).toBe(true);
    expect(isRetryableExternalProviderError(new Error('invalid api key'))).toBe(false);
  });

  it('keeps selected external provider-order retries inside the selected tier', async () => {
    const fallbackChain = {
      chatWithProviderOrder: vi.fn(async () => ({
        providerName: 'nvidia-general',
        usedFallback: true,
        skipped: ['ollama-cloud-coding'],
        response: response('same-tier fallback'),
      })),
      chatWithFallback: vi.fn(),
      chatWithFallbackAfterPrimary: vi.fn(),
      chatWithFallbackAfterProvider: vi.fn(),
    };

    const result = await chatWithRoutingMetadata({
      agentId: 'chat',
      ctx: ctx('ollama_cloud'),
      messages,
      fallbackProviderOrder: ['ollama-cloud-coding', 'nvidia-general', 'openai', 'ollama'],
      selectedExecutionProfile: {
        providerName: 'ollama-cloud-coding',
        providerType: 'ollama_cloud',
        providerTier: 'managed_cloud',
        fallbackProviderTiers: {
          'ollama-cloud-coding': 'managed_cloud',
          'nvidia-general': 'managed_cloud',
          openai: 'frontier',
          ollama: 'local',
        },
      },
      fallbackChain,
      log: { warn: vi.fn() },
    });

    expect(fallbackChain.chatWithProviderOrder).toHaveBeenCalledWith(
      ['ollama-cloud-coding', 'nvidia-general'],
      messages,
      undefined,
    );
    expect(result).toMatchObject({
      providerName: 'nvidia-general',
      providerLocality: 'external',
      response: { content: 'same-tier fallback' },
      usedFallback: true,
      notice: 'Retried within the selected external model tier after the first provider was unavailable.',
    });
  });

  it('constrains retryable external primary failures to same-tier fallback order', async () => {
    const primaryChat = vi.fn(async () => {
      throw new Error('HTTP 503 service unavailable');
    });
    const fallbackChain = {
      chatWithProviderOrder: vi.fn(),
      chatWithFallback: vi.fn(),
      chatWithFallbackAfterPrimary: vi.fn(),
      chatWithFallbackAfterProvider: vi.fn(async () => ({
        providerName: 'nvidia-general',
        usedFallback: true,
        skipped: ['ollama-cloud-coding'],
        response: response('same-tier fallback'),
      })),
    };

    const result = await chatWithRoutingMetadata({
      agentId: 'chat',
      ctx: ctx('ollama_cloud', primaryChat),
      messages,
      fallbackProviderOrder: ['ollama_cloud', 'ollama-cloud-coding', 'nvidia-general', 'openai', 'ollama'],
      selectedExecutionProfile: {
        providerName: 'ollama-cloud-coding',
        providerType: 'ollama_cloud',
        providerTier: 'managed_cloud',
        fallbackProviderTiers: {
          ollama_cloud: 'managed_cloud',
          'ollama-cloud-coding': 'managed_cloud',
          'nvidia-general': 'managed_cloud',
          openai: 'frontier',
          ollama: 'local',
        },
      },
      fallbackChain,
      log: { warn: vi.fn() },
    });

    expect(fallbackChain.chatWithFallbackAfterProvider).toHaveBeenCalledWith(
      'ollama_cloud',
      ['ollama_cloud', 'ollama-cloud-coding', 'nvidia-general'],
      messages,
      undefined,
    );
    expect(result).toMatchObject({
      providerName: 'nvidia-general',
      providerLocality: 'external',
      usedFallback: true,
      notice: 'Retried within the selected external model tier after a retryable provider error.',
    });
  });
});
