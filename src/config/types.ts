/**
 * Configuration types for GuardianAgent.
 *
 * Loaded from ~/.openagent/config.yaml with environment variable
 * interpolation and deep-merged with defaults.
 */

/** Top-level configuration. */
export interface GuardianAgentConfig {
  /** LLM provider configurations. */
  llm: Record<string, LLMConfig>;
  /** Default LLM provider name (key in llm map). */
  defaultProvider: string;
  /** Agent configurations. */
  agents: AgentConfig[];
  /** Channel configurations. */
  channels: ChannelsConfig;
  /** Guardian security configuration. */
  guardian: GuardianConfig;
  /** Runtime configuration. */
  runtime: RuntimeConfig;
}

/** Configuration for a single LLM provider. */
export interface LLMConfig {
  /** Provider type: 'ollama' | 'anthropic' | 'openai'. */
  provider: 'ollama' | 'anthropic' | 'openai';
  /** API key (supports ${ENV_VAR} interpolation). */
  apiKey?: string;
  /** Base URL for the API. */
  baseUrl?: string;
  /** Default model to use. */
  model: string;
  /** Maximum tokens in response. */
  maxTokens?: number;
  /** Temperature for generation. */
  temperature?: number;
  /** Request timeout in milliseconds. */
  timeoutMs?: number;
}

/** Configuration for an agent instance. */
export interface AgentConfig {
  /** Unique agent identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Which LLM provider to use (key in llm map). */
  provider?: string;
  /** System prompt for this agent. */
  systemPrompt?: string;
  /** Cron schedule for periodic execution. */
  schedule?: string;
  /** Capabilities granted to this agent. */
  capabilities?: string[];
  /** Resource limits. */
  resourceLimits?: Partial<AgentResourceLimitsConfig>;
}

/** Resource limits for an agent (config layer). */
export interface AgentResourceLimitsConfig {
  /** Maximum wall-clock ms per invocation. */
  maxInvocationBudgetMs: number;
  /** Maximum LLM tokens per minute (0 = unlimited). */
  maxTokensPerMinute: number;
  /** Maximum concurrent tool executions (0 = unlimited). */
  maxConcurrentTools: number;
  /** Maximum pending events in agent's queue (0 = unlimited). */
  maxQueueDepth: number;
}

/** Channel adapter configurations. */
export interface ChannelsConfig {
  /** CLI channel configuration. */
  cli?: {
    enabled: boolean;
    /** Default agent to route messages to. */
    defaultAgent?: string;
  };
  /** Telegram channel configuration. */
  telegram?: {
    enabled: boolean;
    /** Bot token (supports ${ENV_VAR} interpolation). */
    botToken?: string;
    /** Allowed chat IDs (empty = allow all). */
    allowedChatIds?: number[];
    /** Default agent to route messages to. */
    defaultAgent?: string;
    /** Use polling (true) or webhook (false). */
    polling?: boolean;
  };
  /** Web UI channel configuration. */
  web?: {
    enabled: boolean;
    /** Port to listen on. */
    port?: number;
    /** Host to bind to. */
    host?: string;
    /** Default agent to route messages to. */
    defaultAgent?: string;
    /** Bearer token for authentication. If set, all non-health requests require it. */
    authToken?: string;
    /** Allowed CORS origins (default: none / same-origin). */
    allowedOrigins?: string[];
    /** Maximum request body size in bytes (default: 1 MB). */
    maxBodyBytes?: number;
  };
}

/** Guardian security configuration. */
export interface GuardianConfig {
  /** Enable/disable the Guardian. */
  enabled: boolean;
  /** Paths that are always denied. */
  deniedPaths?: string[];
  /** Additional secret patterns (regex strings). */
  additionalSecretPatterns?: string[];
  /** Whether to log denied actions. */
  logDenials?: boolean;
  /** Rate limiting configuration. */
  rateLimit?: {
    /** Maximum requests per minute per agent (default: 30). */
    maxPerMinute: number;
    /** Maximum requests per hour per agent (default: 500). */
    maxPerHour: number;
    /** Maximum burst requests within 10 seconds (default: 5). */
    burstAllowed: number;
  };
  /** Input sanitization configuration. */
  inputSanitization?: {
    /** Enable input sanitization (default: true). */
    enabled: boolean;
    /** Injection score threshold to block (default: 3). */
    blockThreshold: number;
  };
  /** Output scanning configuration. */
  outputScanning?: {
    /** Enable output scanning (default: true). */
    enabled: boolean;
    /** Redact secrets (true) vs block entirely (false). Default: true. */
    redactSecrets: boolean;
  };
  /** Sentinel agent configuration. */
  sentinel?: {
    /** Enable Sentinel agent (default: true). */
    enabled: boolean;
    /** Cron schedule for analysis (default: every 5 min). */
    schedule: string;
    /** Anomaly detection thresholds. */
    anomalyThresholds?: {
      /** Denial rate multiplier to trigger volume spike (default: 3). */
      volumeSpikeMultiplier: number;
      /** Max denied action types before capability probe alert (default: 5). */
      capabilityProbeThreshold: number;
      /** Max secret detections per agent before alert (default: 3). */
      secretDetectionThreshold: number;
    };
  };
  /** Audit log configuration. */
  auditLog?: {
    /** Maximum events to keep in memory (default: 10000). */
    maxEvents: number;
  };
}

/** Runtime configuration. */
export interface RuntimeConfig {
  /** Watchdog stall detection timeout (ms). */
  maxStallDurationMs: number;
  /** Watchdog check interval (ms). */
  watchdogIntervalMs: number;
  /** Log level. */
  logLevel: string;
}

/** Default configuration values. */
export const DEFAULT_CONFIG: GuardianAgentConfig = {
  llm: {
    ollama: {
      provider: 'ollama',
      baseUrl: 'http://localhost:11434',
      model: 'llama3.2',
      maxTokens: 2048,
      temperature: 0.7,
      timeoutMs: 120_000,
    },
  },
  defaultProvider: 'ollama',
  agents: [],
  channels: {
    cli: { enabled: true },
    telegram: { enabled: false, polling: true },
    web: { enabled: false, port: 3000, host: 'localhost' },
  },
  guardian: {
    enabled: true,
    deniedPaths: [],
    additionalSecretPatterns: [],
    logDenials: true,
    rateLimit: {
      maxPerMinute: 30,
      maxPerHour: 500,
      burstAllowed: 5,
    },
    inputSanitization: {
      enabled: true,
      blockThreshold: 3,
    },
    outputScanning: {
      enabled: true,
      redactSecrets: true,
    },
    sentinel: {
      enabled: true,
      schedule: '*/5 * * * *',
      anomalyThresholds: {
        volumeSpikeMultiplier: 3,
        capabilityProbeThreshold: 5,
        secretDetectionThreshold: 3,
      },
    },
    auditLog: {
      maxEvents: 10_000,
    },
  },
  runtime: {
    maxStallDurationMs: 60_000,
    watchdogIntervalMs: 10_000,
    logLevel: 'info',
  },
};
