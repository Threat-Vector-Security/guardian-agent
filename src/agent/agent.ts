/**
 * Base agent — abstract class with default no-op implementations.
 *
 * Agents extend this class and override the handlers they need.
 */

import type {
  Agent,
  AgentCapabilities,
  AgentContext,
  AgentDefinition,
  AgentResourceLimits,
  AgentResponse,
  ScheduleContext,
  UserMessage,
} from './types.js';
import { DEFAULT_RESOURCE_LIMITS } from './types.js';
import type { AgentEvent } from '../queue/event-bus.js';

/** Abstract base class for agents. Override handlers as needed. */
export abstract class BaseAgent implements Agent {
  readonly id: string;
  readonly name: string;
  readonly capabilities: AgentCapabilities;

  constructor(id: string, name: string, capabilities?: Partial<AgentCapabilities>) {
    this.id = id;
    this.name = name;
    this.capabilities = {
      handleMessages: capabilities?.handleMessages ?? false,
      handleEvents: capabilities?.handleEvents ?? false,
      handleSchedule: capabilities?.handleSchedule ?? false,
    };
  }

  async onStart(_ctx: AgentContext): Promise<void> {}
  async onStop(): Promise<void> {}

  async onMessage(_message: UserMessage, _ctx: AgentContext): Promise<AgentResponse> {
    return { content: 'This agent does not handle messages.' };
  }

  async onEvent(_event: AgentEvent, _ctx: AgentContext): Promise<void> {}
  async onSchedule(_ctx: ScheduleContext): Promise<void> {}
}

/** Options for creating an agent definition. */
export interface CreateAgentOptions {
  /** The agent instance. */
  agent: Agent;
  /** LLM provider name (key in config). */
  providerName?: string;
  /** Cron schedule. */
  schedule?: string;
  /** Granted capabilities. */
  grantedCapabilities?: string[];
  /** Resource limits (merged with defaults). */
  resourceLimits?: Partial<AgentResourceLimits>;
}

/** Create an agent definition with defaults. */
export function createAgentDefinition(options: CreateAgentOptions): AgentDefinition {
  return {
    agent: options.agent,
    providerName: options.providerName,
    schedule: options.schedule,
    grantedCapabilities: Object.freeze([...(options.grantedCapabilities ?? [])]),
    resourceLimits: {
      ...DEFAULT_RESOURCE_LIMITS,
      ...options.resourceLimits,
    },
  };
}
