import type { AgentContext } from '../../agent/types.js';
import { getProviderTier, type ProviderTier } from '../../llm/provider-metadata.js';
import type { ChatMessage, ChatOptions, ChatResponse } from '../../llm/types.js';
import { chatProviderWithTimeout, type ModelFallbackChain } from '../../llm/model-fallback.js';
import {
  buildLocalModelTooComplicatedMessage,
  getProviderLocalityFromName,
  isLocalToolCallParseError,
  shouldBypassLocalModelComplexityGuard,
} from '../model-routing-ux.js';
import type { SelectedExecutionProfile } from '../execution-profiles.js';

export interface ProviderFallbackLogger {
  warn: (metadata: Record<string, unknown>, message: string) => void;
}

export type ChatAgentFallbackChain = Pick<
  ModelFallbackChain,
  | 'chatWithFallback'
  | 'chatWithFallbackAfterPrimary'
  | 'chatWithFallbackAfterProvider'
  | 'chatWithProviderOrder'
>;

export interface ChatWithFallbackInput {
  agentId: string;
  ctx: AgentContext;
  messages: ChatMessage[];
  options?: ChatOptions;
  fallbackProviderOrder?: string[];
  selectedExecutionProfile?: Pick<
    SelectedExecutionProfile,
    'providerName' | 'providerType' | 'providerTier' | 'fallbackProviderTiers'
  > | null;
  fallbackChain?: ChatAgentFallbackChain;
  log: ProviderFallbackLogger;
}

export interface ChatWithRoutingMetadataResult {
  response: ChatResponse;
  providerName: string;
  providerLocality: 'local' | 'external';
  usedFallback: boolean;
  notice?: string;
  durationMs: number;
}

export interface AlternateProviderChatResult {
  response: ChatResponse;
  providerName: string;
  providerLocality: 'local' | 'external';
  usedFallback: boolean;
  durationMs: number;
}

export function resolvePreferredProviderOrder(
  fallbackProviderOrder?: string[],
): string[] | undefined {
  if (!Array.isArray(fallbackProviderOrder) || fallbackProviderOrder.length <= 0) {
    return undefined;
  }
  const normalized = [...new Set(
    fallbackProviderOrder
      .map((providerName) => providerName.trim())
      .filter((providerName) => providerName.length > 0),
  )];
  return normalized.length > 0 ? normalized : undefined;
}

export function shouldStartChatWithPreferredProvider(input: {
  fallbackChain?: ChatAgentFallbackChain;
  primaryProviderName?: string;
  preferredProviderOrder?: string[];
}): boolean {
  if (!input.fallbackChain || !input.preferredProviderOrder || input.preferredProviderOrder.length <= 0) {
    return false;
  }
  const preferredPrimary = input.preferredProviderOrder[0]?.trim() || '';
  if (!preferredPrimary) return false;
  return preferredPrimary !== (input.primaryProviderName?.trim() || '');
}

function providerNameIdentity(providerName: string | undefined): string {
  return (providerName ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function inferProviderTierFromName(providerName: string | undefined): ProviderTier | undefined {
  const normalized = providerNameIdentity(providerName);
  if (!normalized) return undefined;
  const direct = getProviderTier(providerName);
  if (direct) return direct;
  if (normalized.startsWith('ollamacloud') || normalized.startsWith('openrouter') || normalized.startsWith('nvidia')) {
    return 'managed_cloud';
  }
  if (normalized.startsWith('ollama')) {
    return 'local';
  }
  if (
    normalized.startsWith('openai')
    || normalized.startsWith('anthropic')
    || normalized.startsWith('claude')
    || normalized.startsWith('groq')
    || normalized.startsWith('mistral')
    || normalized.startsWith('deepseek')
    || normalized.startsWith('together')
    || normalized.startsWith('xai')
    || normalized.startsWith('grok')
    || normalized.startsWith('google')
    || normalized.startsWith('gemini')
  ) {
    return 'frontier';
  }
  return undefined;
}

function resolveProviderTierFromProfile(
  providerName: string | undefined,
  profile: ChatWithFallbackInput['selectedExecutionProfile'],
): ProviderTier | undefined {
  const trimmed = providerName?.trim();
  if (!trimmed) return undefined;
  if (profile?.fallbackProviderTiers?.[trimmed]) {
    return profile.fallbackProviderTiers[trimmed];
  }
  if (
    profile
    && (
      providerNameIdentity(trimmed) === providerNameIdentity(profile.providerName)
      || providerNameIdentity(trimmed) === providerNameIdentity(profile.providerType)
    )
  ) {
    return profile.providerTier;
  }
  return inferProviderTierFromName(trimmed);
}

export function isRetryableExternalProviderError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b(?:429|500|502|503|504)\b/i.test(message)
    || /\b(?:rate limit|too many requests|overload|overloaded|temporarily unavailable|service unavailable|internal server error|bad gateway|gateway timeout|timeout|timed out|econnreset|etimedout)\b/i.test(message);
}

function constrainExternalProviderOrderToTier(input: {
  providerOrder: string[];
  primaryProviderName: string;
  primaryProviderLocality: 'local' | 'external';
  selectedExecutionProfile?: ChatWithFallbackInput['selectedExecutionProfile'];
}): { providerOrder: string[]; constrained: boolean } {
  if (input.primaryProviderLocality !== 'external') {
    return { providerOrder: input.providerOrder, constrained: false };
  }
  const primaryTier = input.selectedExecutionProfile?.providerTier
    ?? resolveProviderTierFromProfile(input.primaryProviderName, input.selectedExecutionProfile);
  if (primaryTier !== 'managed_cloud' && primaryTier !== 'frontier') {
    return { providerOrder: input.providerOrder, constrained: false };
  }
  const constrained = input.providerOrder.filter((providerName) => (
    resolveProviderTierFromProfile(providerName, input.selectedExecutionProfile) === primaryTier
  ));
  const providerOrder = constrained.length > 0 ? constrained : input.providerOrder.slice(0, 1);
  return {
    providerOrder,
    constrained: providerOrder.length !== input.providerOrder.length,
  };
}

export async function chatWithFallback(input: ChatWithFallbackInput): Promise<ChatResponse> {
  const preferredOrder = resolvePreferredProviderOrder(input.fallbackProviderOrder);
  const primaryProviderName = input.ctx.llm?.name?.trim();
  const primaryProviderLocality = getProviderLocalityFromName(primaryProviderName);
  if (shouldStartChatWithPreferredProvider({
    fallbackChain: input.fallbackChain,
    primaryProviderName,
    preferredProviderOrder: preferredOrder,
  })) {
    const retryOrder = constrainExternalProviderOrderToTier({
      providerOrder: preferredOrder!,
      primaryProviderName: primaryProviderName ?? preferredOrder![0] ?? 'unknown',
      primaryProviderLocality,
      selectedExecutionProfile: input.selectedExecutionProfile,
    }).providerOrder;
    return (await input.fallbackChain!.chatWithProviderOrder(retryOrder, input.messages, input.options)).response;
  }
  if (!input.fallbackChain) {
    return chatProviderWithTimeout({
      provider: input.ctx.llm!,
      providerName: input.ctx.llm?.name ?? 'unknown',
      messages: input.messages,
      options: input.options,
    });
  }
  try {
    return await chatProviderWithTimeout({
      provider: input.ctx.llm!,
      providerName: input.ctx.llm?.name ?? 'unknown',
      messages: input.messages,
      options: input.options,
    });
  } catch (primaryError) {
    input.log.warn(
      { agent: input.agentId, error: primaryError instanceof Error ? primaryError.message : String(primaryError) },
      'Primary LLM failed, trying fallback chain',
    );
    const retryOrder = preferredOrder && primaryProviderLocality === 'external' && isRetryableExternalProviderError(primaryError)
      ? constrainExternalProviderOrderToTier({
        providerOrder: preferredOrder,
        primaryProviderName: input.ctx.llm?.name ?? 'unknown',
        primaryProviderLocality,
        selectedExecutionProfile: input.selectedExecutionProfile,
      }).providerOrder
      : preferredOrder;
    const result = retryOrder
      ? await input.fallbackChain.chatWithFallbackAfterProvider(input.ctx.llm?.name ?? 'unknown', retryOrder, input.messages, input.options)
      : await input.fallbackChain.chatWithFallback(input.messages, input.options);
    return result.response;
  }
}

export async function chatWithAlternateProvider(input: {
  primaryProviderName?: string;
  messages: ChatMessage[];
  options?: ChatOptions;
  fallbackProviderOrder?: string[];
  fallbackChain?: ChatAgentFallbackChain;
}): Promise<AlternateProviderChatResult | null> {
  if (!input.fallbackChain) return null;
  const preferredOrder = resolvePreferredProviderOrder(input.fallbackProviderOrder);
  const primaryProviderName = input.primaryProviderName?.trim() || 'unknown';
  const startedAt = Date.now();
  const result = preferredOrder
    ? await input.fallbackChain.chatWithFallbackAfterProvider(
      primaryProviderName,
      preferredOrder,
      input.messages,
      input.options,
    )
    : await input.fallbackChain.chatWithFallbackAfterPrimary(input.messages, input.options);
  return {
    response: result.response,
    providerName: result.providerName,
    providerLocality: getProviderLocalityFromName(result.providerName),
    usedFallback: true,
    durationMs: Math.max(0, Date.now() - startedAt),
  };
}

export async function chatWithRoutingMetadata(
  input: ChatWithFallbackInput,
): Promise<ChatWithRoutingMetadataResult> {
  const primaryProviderName = input.ctx.llm?.name ?? 'unknown';
  const primaryProviderLocality = getProviderLocalityFromName(primaryProviderName);
  const preferredOrder = resolvePreferredProviderOrder(input.fallbackProviderOrder);

  if (shouldStartChatWithPreferredProvider({
    fallbackChain: input.fallbackChain,
    primaryProviderName,
    preferredProviderOrder: preferredOrder,
  })) {
    const startedAt = Date.now();
    const retryOrder = constrainExternalProviderOrderToTier({
      providerOrder: preferredOrder!,
      primaryProviderName,
      primaryProviderLocality,
      selectedExecutionProfile: input.selectedExecutionProfile,
    });
    const result = await input.fallbackChain!.chatWithProviderOrder(retryOrder.providerOrder, input.messages, input.options);
    const selectedProviderName = preferredOrder?.[0];
    return {
      response: result.response,
      providerName: result.providerName,
      providerLocality: getProviderLocalityFromName(result.providerName),
      usedFallback: result.usedFallback || (!!selectedProviderName && result.providerName !== selectedProviderName),
      ...(retryOrder.constrained && (result.usedFallback || (!!selectedProviderName && result.providerName !== selectedProviderName))
        ? { notice: 'Retried within the selected external model tier after the first provider was unavailable.' }
        : {}),
      durationMs: Math.max(0, Date.now() - startedAt),
    };
  }

  if (!input.fallbackChain) {
    try {
      const startedAt = Date.now();
      const response = await chatProviderWithTimeout({
        provider: input.ctx.llm!,
        providerName: primaryProviderName,
        messages: input.messages,
        options: input.options,
      });
      return {
        response,
        providerName: primaryProviderName,
        providerLocality: primaryProviderLocality,
        usedFallback: false,
        durationMs: Math.max(0, Date.now() - startedAt),
      };
    } catch (primaryError) {
      if (primaryProviderLocality === 'local' && isLocalToolCallParseError(primaryError)) {
        if (shouldBypassLocalModelComplexityGuard()) {
          throw primaryError;
        }
        throw new Error(buildLocalModelTooComplicatedMessage());
      }
      throw primaryError;
    }
  }

  try {
    const startedAt = Date.now();
    const response = await chatProviderWithTimeout({
      provider: input.ctx.llm!,
      providerName: primaryProviderName,
      messages: input.messages,
      options: input.options,
    });
    return {
      response,
      providerName: primaryProviderName,
      providerLocality: primaryProviderLocality,
      usedFallback: false,
      durationMs: Math.max(0, Date.now() - startedAt),
    };
  } catch (primaryError) {
    input.log.warn(
      { agent: input.agentId, error: primaryError instanceof Error ? primaryError.message : String(primaryError) },
      'Primary LLM failed, trying fallback chain',
    );

    if (primaryProviderLocality === 'local' && isLocalToolCallParseError(primaryError)) {
      if (shouldBypassLocalModelComplexityGuard()) {
        throw primaryError;
      }
      try {
        const startedAt = Date.now();
        const result = preferredOrder
          ? await input.fallbackChain.chatWithFallbackAfterProvider(primaryProviderName, preferredOrder, input.messages, input.options)
          : await input.fallbackChain.chatWithFallbackAfterPrimary(input.messages, input.options);
        return {
          response: result.response,
          providerName: result.providerName,
          providerLocality: getProviderLocalityFromName(result.providerName),
          usedFallback: true,
          notice: 'Retried with an alternate model after the local model failed to format a tool call.',
          durationMs: Math.max(0, Date.now() - startedAt),
        };
      } catch (fallbackError) {
        input.log.warn(
          { agent: input.agentId, error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError) },
          'No alternate model available after local tool-call parsing failure',
        );
        throw new Error(buildLocalModelTooComplicatedMessage());
      }
    }

    const startedAt = Date.now();
    const retryOrder = preferredOrder && primaryProviderLocality === 'external' && isRetryableExternalProviderError(primaryError)
      ? constrainExternalProviderOrderToTier({
        providerOrder: preferredOrder,
        primaryProviderName,
        primaryProviderLocality,
        selectedExecutionProfile: input.selectedExecutionProfile,
      })
      : { providerOrder: preferredOrder, constrained: false };
    const result = retryOrder.providerOrder
      ? await input.fallbackChain.chatWithFallbackAfterProvider(primaryProviderName, retryOrder.providerOrder, input.messages, input.options)
      : await input.fallbackChain.chatWithFallback(input.messages, input.options);
    return {
      response: result.response,
      providerName: result.providerName,
      providerLocality: getProviderLocalityFromName(result.providerName),
      usedFallback: result.usedFallback || result.providerName !== primaryProviderName,
      ...(retryOrder.constrained
        ? { notice: 'Retried within the selected external model tier after a retryable provider error.' }
        : {}),
      durationMs: Math.max(0, Date.now() - startedAt),
    };
  }
}
