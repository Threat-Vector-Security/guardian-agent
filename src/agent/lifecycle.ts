/**
 * Agent lifecycle state machine.
 *
 * Enforces valid state transitions and emits events for observability.
 */

import { AgentState, VALID_TRANSITIONS } from './types.js';

/** Event emitted on state transitions. */
export interface StateTransitionEvent {
  agentId: string;
  from: AgentState;
  to: AgentState;
  timestamp: number;
  reason?: string;
}

export type TransitionListener = (event: StateTransitionEvent) => void;

/** Manages lifecycle state transitions for agents. */
export class LifecycleManager {
  private listeners: TransitionListener[] = [];

  /** Check if a transition from `from` to `to` is valid. */
  isValidTransition(from: AgentState, to: AgentState): boolean {
    const allowed = VALID_TRANSITIONS.get(from);
    return allowed !== undefined && allowed.has(to);
  }

  /**
   * Attempt a state transition. Returns the new state if valid,
   * throws if the transition is not allowed.
   */
  transition(
    agentId: string,
    from: AgentState,
    to: AgentState,
    reason?: string,
  ): AgentState {
    if (!this.isValidTransition(from, to)) {
      throw new Error(
        `Invalid state transition for agent '${agentId}': ${from} → ${to}`,
      );
    }

    const event: StateTransitionEvent = {
      agentId,
      from,
      to,
      timestamp: Date.now(),
      reason,
    };

    for (const listener of this.listeners) {
      listener(event);
    }

    return to;
  }

  /** Register a listener for state transitions. */
  onTransition(listener: TransitionListener): void {
    this.listeners.push(listener);
  }

  /** Remove a transition listener. */
  offTransition(listener: TransitionListener): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /** Get all valid next states from a given state. */
  validNextStates(from: AgentState): AgentState[] {
    const allowed = VALID_TRANSITIONS.get(from);
    return allowed ? [...allowed] : [];
  }
}
