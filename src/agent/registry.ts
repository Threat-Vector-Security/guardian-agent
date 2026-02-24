/**
 * Agent registry — registration, discovery, and lifecycle management.
 *
 * Agents register with their definition and the registry manages
 * their runtime instances and state transitions.
 */

import { LifecycleManager } from './lifecycle.js';
import type { AgentDefinition, AgentInstance } from './types.js';
import { AgentState } from './types.js';

export class AgentRegistry {
  private agents: Map<string, AgentInstance> = new Map();
  readonly lifecycle: LifecycleManager;

  constructor(lifecycle?: LifecycleManager) {
    this.lifecycle = lifecycle ?? new LifecycleManager();
  }

  /** Register a new agent. Creates the instance in Created state. */
  register(definition: AgentDefinition): AgentInstance {
    const agentId = definition.agent.id;
    if (this.agents.has(agentId)) {
      throw new Error(`Agent '${agentId}' is already registered.`);
    }

    const instance: AgentInstance = {
      definition,
      state: AgentState.Created,
      agent: definition.agent,
      lastActivityMs: Date.now(),
      consecutiveErrors: 0,
      retryAfterMs: 0,
    };

    this.agents.set(agentId, instance);
    return instance;
  }

  /** Unregister an agent. Transitions to Dead first if needed. */
  unregister(agentId: string): void {
    const instance = this.agents.get(agentId);
    if (!instance) return;

    if (instance.state !== AgentState.Dead) {
      this.transitionState(agentId, AgentState.Dead, 'unregistered');
    }

    this.agents.delete(agentId);
  }

  /** Get an agent instance by ID. */
  get(agentId: string): AgentInstance | undefined {
    return this.agents.get(agentId);
  }

  /** Get all registered agent instances. */
  getAll(): AgentInstance[] {
    return [...this.agents.values()];
  }

  /** Get agents in a specific state. */
  getByState(state: AgentState): AgentInstance[] {
    return this.getAll().filter(a => a.state === state);
  }

  /**
   * Transition an agent's state. Validates the transition
   * and updates the instance.
   */
  transitionState(
    agentId: string,
    to: AgentState,
    reason?: string,
  ): void {
    const instance = this.agents.get(agentId);
    if (!instance) {
      throw new Error(`Agent '${agentId}' not found.`);
    }

    instance.state = this.lifecycle.transition(
      agentId,
      instance.state,
      to,
      reason,
    );
  }

  /**
   * Initialize an agent: transition to Ready.
   */
  initialize(agentId: string): void {
    const instance = this.agents.get(agentId);
    if (!instance) {
      throw new Error(`Agent '${agentId}' not found.`);
    }

    this.transitionState(agentId, AgentState.Ready, 'initialized');
  }

  /** Number of registered agents. */
  get size(): number {
    return this.agents.size;
  }

  /** Check if an agent is registered. */
  has(agentId: string): boolean {
    return this.agents.has(agentId);
  }
}
