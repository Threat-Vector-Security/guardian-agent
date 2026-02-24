/**
 * Web dashboard API response types.
 *
 * Shared data shapes for all dashboard API endpoints and SSE events.
 * Keeps web.ts and index.ts decoupled from internal runtime types.
 */

import type { AuditEvent, AuditFilter, AuditSummary } from '../guardian/audit-log.js';
import type { WatchdogResult } from '../runtime/watchdog.js';
import type { BudgetRecord } from '../runtime/budget.js';

/** Agent info returned by GET /api/agents. */
export interface DashboardAgentInfo {
  id: string;
  name: string;
  state: string;
  capabilities: readonly string[];
  provider?: string;
  schedule?: string;
  lastActivityMs: number;
  consecutiveErrors: number;
}

/** Detailed agent info returned by GET /api/agents/:id. */
export interface DashboardAgentDetail extends DashboardAgentInfo {
  resourceLimits: {
    maxInvocationBudgetMs: number;
    maxTokensPerMinute: number;
    maxConcurrentTools: number;
    maxQueueDepth: number;
  };
}

/** Redacted config returned by GET /api/config. */
export interface RedactedConfig {
  llm: Record<string, { provider: string; model: string; baseUrl?: string }>;
  defaultProvider: string;
  channels: {
    cli?: { enabled: boolean };
    telegram?: { enabled: boolean };
    web?: { enabled: boolean; port?: number; host?: string };
  };
  guardian: {
    enabled: boolean;
    rateLimit?: { maxPerMinute: number; maxPerHour: number; burstAllowed: number };
    inputSanitization?: { enabled: boolean; blockThreshold: number };
    outputScanning?: { enabled: boolean; redactSecrets: boolean };
    sentinel?: { enabled: boolean; schedule: string };
  };
  runtime: {
    maxStallDurationMs: number;
    watchdogIntervalMs: number;
    logLevel: string;
  };
}

/** Budget info returned by GET /api/budget. */
export interface DashboardBudgetInfo {
  agents: Array<{
    agentId: string;
    tokensPerMinute: number;
    concurrentInvocations: number;
    overrunCount: number;
  }>;
  recentOverruns: readonly BudgetRecord[];
}

/** Provider info returned by GET /api/providers. */
export interface DashboardProviderInfo {
  name: string;
  type: string;
  model: string;
  baseUrl?: string;
  /** 'local' for Ollama/local endpoints, 'external' for cloud APIs. */
  locality: 'local' | 'external';
  /** Whether the provider is currently reachable. */
  connected: boolean;
  /** Available models (for Ollama discovery). */
  availableModels?: string[];
}

/** SSE event pushed to dashboard clients. */
export interface SSEEvent {
  type: 'audit' | 'metrics' | 'watchdog';
  data: unknown;
}

/** SSE listener callback for real-time events. */
export type SSEListener = (event: SSEEvent) => void;

/** Dashboard API callbacks supplied by index.ts to WebChannel. */
export interface DashboardCallbacks {
  onAgents?: () => DashboardAgentInfo[];
  onAgentDetail?: (id: string) => DashboardAgentDetail | null;
  onAuditQuery?: (filter: AuditFilter) => AuditEvent[];
  onAuditSummary?: (windowMs: number) => AuditSummary;
  onConfig?: () => RedactedConfig;
  onBudget?: () => DashboardBudgetInfo;
  onWatchdog?: () => WatchdogResult[];
  onProviders?: () => DashboardProviderInfo[];
  onProvidersStatus?: () => Promise<DashboardProviderInfo[]>;
  onSSESubscribe?: (listener: SSEListener) => () => void;
  onDispatch?: (agentId: string, message: { content: string; userId?: string }) => Promise<{ content: string }>;
  onConfigUpdate?: (updates: ConfigUpdate) => Promise<{ success: boolean; message: string }>;
}

/** Fields that can be updated via POST /api/config. */
export interface ConfigUpdate {
  defaultProvider?: string;
  llm?: Record<string, {
    provider?: string;
    model?: string;
    apiKey?: string;
    baseUrl?: string;
  }>;
}
