/**
 * Event bus — immediate async dispatch for inter-agent communication.
 *
 * Replaces the old batch-drain EventQueue with immediate delivery on emit().
 * Supports typed event subscriptions and broadcast.
 */

/** Typed event for inter-agent communication. */
export interface AgentEvent {
  /** Event type identifier (e.g., 'user.message', 'agent.response'). */
  type: string;
  /** Agent that emitted the event (or 'system'). */
  sourceAgentId: string;
  /** Target agent ID, or '*' for broadcast. */
  targetAgentId: string;
  /** Event payload (must be serializable). */
  payload: unknown;
  /** Timestamp when event was emitted (ms). */
  timestamp: number;
}

/** Callback for event delivery. */
export type EventHandler = (event: AgentEvent) => void | Promise<void>;

export class EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();
  private broadcastHandlers: EventHandler[] = [];
  private typeHandlers: Map<string, EventHandler[]> = new Map();
  private maxDepth: number;
  private pendingCount = 0;

  constructor(maxDepth: number = 10_000) {
    this.maxDepth = maxDepth;
  }

  /** Emit an event with immediate dispatch to matching handlers. */
  async emit(event: AgentEvent): Promise<boolean> {
    if (this.pendingCount >= this.maxDepth) {
      return false;
    }

    this.pendingCount++;

    try {
      const promises: Promise<void>[] = [];

      // Type-based handlers
      const typeH = this.typeHandlers.get(event.type);
      if (typeH) {
        for (const handler of typeH) {
          const result = handler(event);
          if (result instanceof Promise) promises.push(result);
        }
      }

      if (event.targetAgentId === '*') {
        // Broadcast to all specific handlers
        for (const handlers of this.handlers.values()) {
          for (const handler of handlers) {
            const result = handler(event);
            if (result instanceof Promise) promises.push(result);
          }
        }
        // And broadcast handlers
        for (const handler of this.broadcastHandlers) {
          const result = handler(event);
          if (result instanceof Promise) promises.push(result);
        }
      } else {
        // Targeted delivery
        const handlers = this.handlers.get(event.targetAgentId);
        if (handlers) {
          for (const handler of handlers) {
            const result = handler(event);
            if (result instanceof Promise) promises.push(result);
          }
        }
      }

      if (promises.length > 0) {
        await Promise.all(promises);
      }

      return true;
    } finally {
      this.pendingCount--;
    }
  }

  /** Register a handler for events targeted at a specific agent. */
  subscribe(agentId: string, handler: EventHandler): void {
    const existing = this.handlers.get(agentId) ?? [];
    existing.push(handler);
    this.handlers.set(agentId, existing);
  }

  /** Register a handler for events of a specific type. */
  subscribeByType(eventType: string, handler: EventHandler): void {
    const existing = this.typeHandlers.get(eventType) ?? [];
    existing.push(handler);
    this.typeHandlers.set(eventType, existing);
  }

  /** Register a handler for broadcast events ('*' target). */
  onBroadcast(handler: EventHandler): void {
    this.broadcastHandlers.push(handler);
  }

  /** Remove a handler for a specific agent. */
  unsubscribe(agentId: string, handler: EventHandler): void {
    const existing = this.handlers.get(agentId);
    if (!existing) return;
    this.handlers.set(agentId, existing.filter(h => h !== handler));
  }

  /** Remove ALL handlers for a specific agent (used by unregister). */
  removeHandlersForAgent(agentId: string): void {
    this.handlers.delete(agentId);
  }

  /** Remove a type handler. */
  unsubscribeByType(eventType: string, handler: EventHandler): void {
    const existing = this.typeHandlers.get(eventType);
    if (!existing) return;
    this.typeHandlers.set(eventType, existing.filter(h => h !== handler));
  }

  /** Remove all handlers. */
  removeAllHandlers(): void {
    this.handlers.clear();
    this.broadcastHandlers = [];
    this.typeHandlers.clear();
  }

  /** Current number of in-flight event dispatches. */
  get pending(): number {
    return this.pendingCount;
  }
}
