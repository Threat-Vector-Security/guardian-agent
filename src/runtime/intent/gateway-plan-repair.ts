import type { GuardianAgentConfig } from '../../config/types.js';
import type { ProviderTier } from '../../llm/provider-metadata.js';
import {
  findProviderByTier,
  providerMatchesTier,
} from '../execution-profiles.js';
import {
  enrichIntentGatewayRecordWithContentPlan,
  type IntentGatewayRecord,
} from '../intent-gateway.js';
import {
  hasGenericRequiredToolBackedAnswerPlan,
  shouldAdoptMoreConcreteToolBackedAnswerPlan,
} from './planned-steps.js';

export interface IntentGatewayPlanRepairCandidate {
  providerName: string;
  classify: () => Promise<IntentGatewayRecord | null>;
}

export interface IntentGatewayPlanRepairResult {
  attempted: boolean;
  adopted: boolean;
  providerOrder?: string[];
  providerName?: string;
  record?: IntentGatewayRecord;
}

function uniqueProviderNames(names: Array<string | null | undefined>): string[] {
  return [...new Set(
    names
      .map((name) => name?.trim() ?? '')
      .filter((name) => name.length > 0),
  )];
}

export function shouldAttemptFrontierIntentPlanRepair(
  record: IntentGatewayRecord | null | undefined,
): boolean {
  const decision = record?.decision;
  return decision?.resolution === 'ready'
    && decision.requiresToolSynthesis === true
    && hasGenericRequiredToolBackedAnswerPlan(decision);
}

function listProviderNamesForTier(
  config: GuardianAgentConfig,
  tier: ProviderTier,
): string[] {
  return uniqueProviderNames([
    findProviderByTier(config, tier),
    ...Object.entries(config.llm)
      .filter(([, llmCfg]) => providerMatchesTier(llmCfg, tier))
      .map(([name]) => name)
      .sort((left, right) => left.localeCompare(right)),
  ]);
}

export function buildFrontierIntentPlanRepairProviderOrder(input: {
  config: GuardianAgentConfig;
  currentProviderName?: string | null;
  fallbackProviderOrder?: readonly string[] | null;
  forcedProviderName?: string | null;
  selectedProviderTier?: ProviderTier | null;
}): string[] | null {
  if (input.forcedProviderName?.trim()) {
    return null;
  }
  if (input.selectedProviderTier === 'frontier') {
    return null;
  }
  const currentProviderName = input.currentProviderName?.trim();
  if (currentProviderName && providerMatchesTier(input.config.llm[currentProviderName], 'frontier')) {
    return null;
  }

  const fallbackFrontierProviders = (input.fallbackProviderOrder ?? [])
    .filter((providerName) => providerMatchesTier(input.config.llm[providerName], 'frontier'));
  const providers = uniqueProviderNames([
    findProviderByTier(input.config, 'frontier'),
    ...fallbackFrontierProviders,
    ...listProviderNamesForTier(input.config, 'frontier'),
  ]).filter((providerName) => providerName !== currentProviderName);

  return providers.length > 0 ? providers : null;
}

export async function tryRepairGenericIntentGatewayPlan(input: {
  current: IntentGatewayRecord;
  candidates: IntentGatewayPlanRepairCandidate[];
  sourceContent: string;
  onError?: (error: unknown, providerName: string) => void;
}): Promise<IntentGatewayPlanRepairResult | null> {
  if (!shouldAttemptFrontierIntentPlanRepair(input.current)) {
    return null;
  }
  const providerOrder = uniqueProviderNames(input.candidates.map((candidate) => candidate.providerName));
  if (providerOrder.length === 0) {
    return {
      attempted: false,
      adopted: false,
    };
  }

  for (const candidate of input.candidates) {
    try {
      const classified = await candidate.classify();
      const enriched = enrichIntentGatewayRecordWithContentPlan(
        classified,
        input.sourceContent,
      );
      if (enriched && shouldAdoptMoreConcreteToolBackedAnswerPlan({
        current: input.current.decision,
        candidate: enriched.decision,
      })) {
        return {
          attempted: true,
          adopted: true,
          providerOrder,
          providerName: candidate.providerName,
          record: enriched,
        };
      }
    } catch (err) {
      input.onError?.(err, candidate.providerName);
    }
  }

  return {
    attempted: true,
    adopted: false,
    providerOrder,
  };
}
