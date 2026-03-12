/**
 * Shared state identity helpers for tier-routed chat agents.
 *
 * Local and external tier agents are two execution backends for one logical
 * assistant. Conversation history and persistent memory should therefore use
 * one shared state key across those backends.
 */

export const SHARED_TIER_AGENT_STATE_ID = '__tier_shared__';

export interface TierAgentIds {
  localAgentId?: string;
  externalAgentId?: string;
}

export function resolveAgentStateId(
  agentId: string | undefined,
  tierAgents: TierAgentIds,
): string | undefined {
  if (!agentId) return agentId;
  if (agentId === tierAgents.localAgentId || agentId === tierAgents.externalAgentId) {
    return SHARED_TIER_AGENT_STATE_ID;
  }
  return agentId;
}
