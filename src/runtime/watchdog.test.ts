import { describe, it, expect, beforeEach } from 'vitest';
import { Watchdog } from './watchdog.js';
import { AgentRegistry } from '../agent/registry.js';
import { LifecycleManager } from '../agent/lifecycle.js';
import { AgentState, DEFAULT_RESOURCE_LIMITS } from '../agent/types.js';
import type { AgentDefinition } from '../agent/types.js';
import { BaseAgent } from '../agent/agent.js';

class TestAgent extends BaseAgent {
  constructor(id: string) {
    super(id, `Test ${id}`);
  }
}

function createTestAgentDef(id: string): AgentDefinition {
  return {
    agent: new TestAgent(id),
    grantedCapabilities: [],
    resourceLimits: DEFAULT_RESOURCE_LIMITS,
  };
}

describe('Watchdog', () => {
  let registry: AgentRegistry;
  let watchdog: Watchdog;

  beforeEach(() => {
    const lifecycle = new LifecycleManager();
    registry = new AgentRegistry(lifecycle);
    watchdog = new Watchdog(registry, 60_000); // 60s stall threshold
  });

  describe('stall detection (timestamp-based)', () => {
    it('should detect stalled agent after maxStallDurationMs', () => {
      const def = createTestAgentDef('agent-1');
      registry.register(def);
      registry.initialize('agent-1');

      const instance = registry.get('agent-1')!;
      // Transition to Running
      registry.transitionState('agent-1', AgentState.Running, 'test');
      instance.lastActivityMs = 1000; // last active at t=1000

      // Check at t=62000 — 61s since last activity, over 60s threshold
      const results = watchdog.check(62_000);

      expect(results.length).toBe(1);
      expect(results[0]).toMatchObject({
        agentId: 'agent-1',
        action: 'stalled',
      });
      expect(results[0].stalledMs).toBe(61_000);
      expect(instance.state).toBe(AgentState.Stalled);
    });

    it('should not flag agent within stall threshold', () => {
      const def = createTestAgentDef('agent-1');
      registry.register(def);
      registry.initialize('agent-1');
      registry.transitionState('agent-1', AgentState.Running, 'test');

      const instance = registry.get('agent-1')!;
      instance.lastActivityMs = 50_000;

      // Check at t=60000 — only 10s since last activity
      const results = watchdog.check(60_000);

      expect(results.length).toBe(1);
      expect(results[0]).toMatchObject({ action: 'ok' });
    });
  });

  describe('error recording and backoff', () => {
    it('should increase consecutive error count', () => {
      const def = createTestAgentDef('agent-1');
      registry.register(def);
      const instance = registry.get('agent-1')!;

      watchdog.recordError('agent-1', 1000);
      expect(instance.consecutiveErrors).toBe(1);
      expect(instance.retryAfterMs).toBe(1000 + 30_000); // 30s backoff

      watchdog.recordError('agent-1', 2000);
      expect(instance.consecutiveErrors).toBe(2);
      expect(instance.retryAfterMs).toBe(2000 + 60_000); // 1m backoff

      watchdog.recordError('agent-1', 3000);
      expect(instance.consecutiveErrors).toBe(3);
      expect(instance.retryAfterMs).toBe(3000 + 300_000); // 5m backoff
    });

    it('should clear errors on success', () => {
      const def = createTestAgentDef('agent-1');
      registry.register(def);
      const instance = registry.get('agent-1')!;

      watchdog.recordError('agent-1');
      watchdog.recordError('agent-1');
      expect(instance.consecutiveErrors).toBe(2);

      watchdog.clearErrors('agent-1');
      expect(instance.consecutiveErrors).toBe(0);
      expect(instance.retryAfterMs).toBe(0);
    });
  });

  describe('retry after backoff', () => {
    it('should retry errored agent when backoff expires', () => {
      const def = createTestAgentDef('agent-1');
      registry.register(def);
      registry.initialize('agent-1');
      registry.transitionState('agent-1', AgentState.Running, 'test');

      const instance = registry.get('agent-1')!;

      // Transition to Errored
      registry.transitionState('agent-1', AgentState.Errored, 'test error');
      watchdog.recordError('agent-1', 1000);

      // Check before backoff expires
      let results = watchdog.check(2000); // nowMs < retryAfterMs (31000)
      const retryResult = results.find(r => r.agentId === 'agent-1');
      expect(retryResult).toBeUndefined(); // Not yet eligible

      // Check after backoff expires
      results = watchdog.check(32000); // nowMs > retryAfterMs (31000)
      const retry = results.find(r => r.agentId === 'agent-1');
      expect(retry).toMatchObject({ action: 'retry' });
      expect(instance.state).toBe(AgentState.Ready);
    });
  });

  describe('max retries exceeded', () => {
    it('should kill agent after max retries', () => {
      const def = createTestAgentDef('agent-1');
      registry.register(def);
      registry.initialize('agent-1');
      registry.transitionState('agent-1', AgentState.Running, 'test');
      registry.transitionState('agent-1', AgentState.Errored, 'error');

      const instance = registry.get('agent-1')!;

      // Set consecutive errors to max
      instance.consecutiveErrors = 5; // MAX_RETRIES = 5

      const results = watchdog.check(Date.now() + 999_999);
      const killed = results.find(r => r.agentId === 'agent-1');
      expect(killed).toMatchObject({ action: 'killed' });
      expect(instance.state).toBe(AgentState.Dead);
    });
  });

  describe('activity recording', () => {
    it('should update lastActivityMs', () => {
      const def = createTestAgentDef('agent-1');
      registry.register(def);
      const instance = registry.get('agent-1')!;

      watchdog.recordActivity('agent-1', 5000);
      expect(instance.lastActivityMs).toBe(5000);
    });
  });

  describe('start/stop', () => {
    it('should start and stop without error', () => {
      watchdog.start(100);
      watchdog.stop();
    });
  });
});
