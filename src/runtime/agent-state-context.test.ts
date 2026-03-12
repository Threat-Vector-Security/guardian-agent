import { describe, expect, it } from 'vitest';
import { resolveAgentStateId, SHARED_TIER_AGENT_STATE_ID } from './agent-state-context.js';

describe('resolveAgentStateId', () => {
  it('maps local tier agent to shared state id', () => {
    expect(resolveAgentStateId('local', {
      localAgentId: 'local',
      externalAgentId: 'external',
    })).toBe(SHARED_TIER_AGENT_STATE_ID);
  });

  it('maps external tier agent to shared state id', () => {
    expect(resolveAgentStateId('external', {
      localAgentId: 'local',
      externalAgentId: 'external',
    })).toBe(SHARED_TIER_AGENT_STATE_ID);
  });

  it('leaves non-tier agents unchanged', () => {
    expect(resolveAgentStateId('default', {
      localAgentId: 'local',
      externalAgentId: 'external',
    })).toBe('default');
  });

  it('returns undefined when agent id is missing', () => {
    expect(resolveAgentStateId(undefined, {
      localAgentId: 'local',
      externalAgentId: 'external',
    })).toBeUndefined();
  });
});
