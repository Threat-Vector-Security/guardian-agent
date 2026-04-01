/**
 * Tool execution runtime with policy, sandboxing, and approvals.
 */

import Ajv from 'ajv';
import { randomUUID } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { access, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { delimiter, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { sanitizeShellArgs, scanWriteContent, validateArgSize } from '../guardian/argument-sanitizer.js';
import {
  classifyParsedCommandExecution,
  getExecutionIdentityBlockReason,
  splitCommands,
  tokenize,
  validateShellCommand,
  type ParsedCommand,
  type ShellExecutionClass,
} from '../guardian/shell-validator.js';
import { normalizeHttpUrlInput, normalizeHttpUrlRecord, normalizeOptionalHttpUrlInput } from '../config/input-normalization.js';
import type { ThreatIntelService } from '../runtime/threat-intel.js';
import type {
  AiSecurityRunSource,
  AiSecurityScanResult,
  AiSecurityService,
} from '../runtime/ai-security.js';
import type { CodingBackendService } from '../runtime/coding-backend-service.js';
import type { PackageInstallTrustService } from '../runtime/package-install-trust-service.js';
import {
  isInstallLikePackageManagerCommand,
  parseManagedPackageInstallCommand,
} from '../runtime/package-install-trust.js';
import { MarketingStore } from './marketing-store.js';
import { ToolApprovalStore } from './approvals.js';
import { ToolRegistry } from './registry.js';
import { hashRedactedObject, redactSensitiveValue } from '../util/crypto-guardrails.js';
import type {
  ToolApprovalRequest,
  ToolCategory,
  ToolDecision,
  ToolDefinition,
  ToolExecutionRequest,
  ToolJobRecord,
  ToolJobStatus,
  ToolPolicyMode,
  ToolPolicySetting,
  ToolPolicySnapshot,
  ToolResult,
  ToolRunResponse,
  ToolRuntimeNotice,
} from './types.js';
import { TOOL_CATEGORIES, BUILTIN_TOOL_CATEGORIES } from './types.js';
import { MCPClientManager } from './mcp-client.js';
import { HybridBrowserService, type HybridBrowserMode } from './browser-hybrid.js';
import {
  DEFAULT_TOOL_ALLOWED_COMMANDS,
  type AssistantCloudConfig,
  type AssistantNetworkConfig,
  type BrowserConfig,
  type WebSearchConfig,
} from '../config/types.js';
import type { ConversationService } from '../runtime/conversation.js';
import type { AgentMemoryStore } from '../runtime/agent-memory-store.js';
import type { CodeSessionStore } from '../runtime/code-sessions.js';
import { resolveCodeSessionTarget } from '../runtime/code-session-targets.js';
import { getEffectiveCodeWorkspaceTrustState } from '../runtime/code-workspace-trust.js';
import { isPrivateAddress } from '../guardian/ssrf-protection.js';
import { sandboxedExec, sandboxedSpawn, type SandboxConfig, DEFAULT_SANDBOX_CONFIG } from '../sandbox/index.js';
import type { SandboxHealth, SandboxProfile } from '../sandbox/types.js';
import {
  isBrowserMcpToolName,
  isDegradedSandboxFallbackActive,
  isStrictSandboxLockdown,
  listEnabledDegradedFallbackAllowances,
  resolveDegradedFallbackConfig,
} from '../sandbox/security-controls.js';
import { realpath } from 'node:fs/promises';
import type { DeviceInventoryService } from '../runtime/device-inventory.js';
import type { NetworkBaselineService } from '../runtime/network-baseline.js';
import { classifyDevice, lookupOuiVendor } from '../runtime/network-intelligence.js';
import type { NetworkTrafficService, TrafficConnectionSample } from '../runtime/network-traffic.js';
import type { HostMonitoringService, HostMonitorReport } from '../runtime/host-monitor.js';
import type { GatewayFirewallMonitoringService, GatewayMonitorReport } from '../runtime/gateway-monitor.js';
import type { ContainmentService } from '../runtime/containment-service.js';
import type { WindowsDefenderProvider } from '../runtime/windows-defender-provider.js';
import type { SavedAutomationCatalogEntry } from '../runtime/automation-catalog.js';
import type { AutomationSaveInput } from '../runtime/automation-save.js';
import type { AutomationOutputStore } from '../runtime/automation-output-store.js';
import type { ScheduledTaskEventTrigger } from '../runtime/scheduled-tasks.js';
import { parseBanner, inferServiceFromPort } from '../runtime/network-fingerprinting.js';
import { parseAirportWifi, parseNetshWifi, parseNmcliWifi, correlateWifiClients } from '../runtime/network-wifi.js';
import {
  getMemoryMutationIntentDeniedMessage,
  isDirectMemoryMutationToolName,
  isElevatedMemoryMutationToolName,
  isMemoryMutationToolName,
} from '../util/memory-intent.js';
import { AwsClient, type AwsInstanceConfig } from './cloud/aws-client.js';
import { AzureClient, type AzureInstanceConfig, type AzureServiceName } from './cloud/azure-client.js';
import { CpanelClient, type CpanelInstanceConfig } from './cloud/cpanel-client.js';
import { normalizeCpanelConnectionConfig } from './cloud/cpanel-profile.js';
import { CloudflareClient, type CloudflareInstanceConfig } from './cloud/cloudflare-client.js';
import { GcpClient, type GcpInstanceConfig, type GcpServiceName } from './cloud/gcp-client.js';
import { VercelClient, type VercelInstanceConfig } from './cloud/vercel-client.js';
import {
  WorkspaceDependencyLedger,
  captureJsDependencySnapshot,
  detectJsDependencyMutationIntent,
  diffJsDependencySnapshots,
  type JsDependencyMutationIntent,
  type JsDependencySnapshot,
} from '../runtime/workspace-dependency-ledger.js';
import { registerBuiltinWebTools } from './builtin/web-tools.js';
import { registerBuiltinAutomationTools } from './builtin/automation-tools.js';
import { registerBuiltinContactsEmailTools } from './builtin/contacts-email-tools.js';
import { registerBuiltinFilesystemTools } from './builtin/filesystem-tools.js';
import { registerBuiltinSecurityIntelTools } from './builtin/security-intel-tools.js';
import { registerBuiltinSearchTools } from './builtin/search-tools.js';
import { registerBuiltinWorkspaceTools } from './builtin/workspace-tools.js';
import { registerBuiltinCloudTools } from './builtin/cloud-tools.js';
import { syncBuiltinBrowserTools } from './builtin/browser-tools.js';

const MAX_JOBS = 200;
const MAX_APPROVALS = 200;
const MAX_READ_BYTES = 1_000_000;
const MAX_FETCH_BYTES = 500_000;
const MAX_WEB_FETCH_CHARS = 20_000;
const MAX_CAMPAIGN_RECIPIENTS = 500;
const MAX_SEARCH_RESULTS = 200;
const MAX_SEARCH_FILES = 100_000;
const MAX_SEARCH_FILE_BYTES = 1_000_000;
const SEARCH_CACHE_TTL_MS = 300_000; // 5 minutes
const MAX_TOOL_ARG_BYTES = 128_000;
const TOOL_CHAIN_TTL_MS = 10 * 60_000;
const MAX_TOOL_CALLS_PER_CHAIN = 24;
const MAX_NON_READ_ONLY_CALLS_PER_CHAIN = 8;
const MAX_IDENTICAL_CALLS_PER_CHAIN = 3;
const MAX_IDENTICAL_FAILURES_PER_CHAIN = 2;
const DEGRADED_PACKAGE_MANAGER_HINT = 'assistant.tools.sandbox.degradedFallback.allowPackageManagers';
const POSIX_SHELL_BUILTINS = new Set(['type']);
const WINDOWS_SHELL_BUILTINS = new Set(['cd', 'dir', 'echo', 'type']);
const WINDOWS_DIRECT_EXECUTABLE_EXTENSIONS = new Set(['.com', '.exe']);
type PersistentMemorySearchMatch = {
  id: string;
  createdAt: string;
  category?: string;
  summary?: string;
  content: string;
  trustLevel?: string;
  status?: string;
  tags?: string[];
  provenance?: Record<string, unknown>;
  matchScore: number;
};
type ConversationMemorySearchCandidate = {
  key: string;
  source: 'conversation';
  type: 'conversation_message';
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  channel: string;
  sessionId: string;
  scoreHint: number;
};
type PersistentMemorySearchCandidate = {
  key: string;
  source: 'global' | 'code_session';
  type: 'memory_entry';
  entryId: string;
  createdAt: string;
  category?: string;
  summary?: string;
  content: string;
  trustLevel?: string;
  status?: string;
  tags?: string[];
  provenance?: Record<string, unknown>;
  scoreHint: number;
};
type UnifiedMemorySearchCandidate = ConversationMemorySearchCandidate | PersistentMemorySearchCandidate;
type PersistentMemoryContextTarget = {
  source: 'global' | 'code_session';
  id: string;
  store?: AgentMemoryStore;
  guardPath: string;
};
const CODE_ASSISTANT_ALLOWED_COMMANDS = [
  'git',
  'node',
  'npm',
  'npx',
  'pnpm',
  'yarn',
  'bun',
  'python',
  'python3',
  'pip',
  'pip3',
  'uv',
  'pytest',
  'cargo',
  'rustc',
  'go',
  'gofmt',
  'java',
  'javac',
  'gradle',
  'mvn',
  'dotnet',
  'php',
  'composer',
  'ruby',
  'bundle',
  'gem',
  'deno',
  'make',
  'cmake',
  'ollama',
  'ls',
  'dir',
  'pwd',
  'echo',
  'cat',
  'head',
  'tail',
  'wc',
  'which',
  'type',
  'file',
  'find',
  'rg',
  'grep',
  'sed',
  'awk',
] as const;
const CODE_DISALLOWED_SHELL_TOKENS = new Map<string, string>([
  ['-C', 'Directory override flags like git -C are blocked in the Coding Workspace. Use cwd or the session workspace root instead.'],
  ['--git-dir', 'Git repository indirection is blocked in the Coding Workspace.'],
  ['--work-tree', 'Git work tree overrides are blocked in the Coding Workspace.'],
  ['--super-prefix', 'Git prefix overrides are blocked in the Coding Workspace.'],
  ['--exec-path', 'Git exec-path overrides are blocked in the Coding Workspace.'],
  ['--prefix', 'Prefix overrides are blocked in the Coding Workspace.'],
  ['--cwd', 'Working-directory override flags are blocked in the Coding Workspace. Use the tool cwd field instead.'],
  ['--cache', 'Cache path overrides are blocked in the Coding Workspace.'],
  ['--cache-dir', 'Cache path overrides are blocked in the Coding Workspace.'],
  ['--userconfig', 'User config overrides are blocked in the Coding Workspace.'],
  ['--globalconfig', 'Global config overrides are blocked in the Coding Workspace.'],
  ['-g', 'Global installs are blocked in the Coding Workspace.'],
  ['--global', 'Global installs are blocked in the Coding Workspace.'],
  ['global', 'Global installs are blocked in the Coding Workspace.'],
  ['--location=global', 'Global installs are blocked in the Coding Workspace.'],
  ['--user', 'User-level installs are blocked in the Coding Workspace.'],
]);
const CODE_DISALLOWED_SHELL_TOKEN_PREFIXES = new Map<string, string>([
  ['--git-dir=', 'Git repository indirection is blocked in the Coding Workspace.'],
  ['--work-tree=', 'Git work tree overrides are blocked in the Coding Workspace.'],
  ['--prefix=', 'Prefix overrides are blocked in the Coding Workspace.'],
  ['--cwd=', 'Working-directory override flags are blocked in the Coding Workspace.'],
  ['--cache=', 'Cache path overrides are blocked in the Coding Workspace.'],
  ['--cache-dir=', 'Cache path overrides are blocked in the Coding Workspace.'],
  ['--userconfig=', 'User config overrides are blocked in the Coding Workspace.'],
  ['--globalconfig=', 'Global config overrides are blocked in the Coding Workspace.'],
]);
const CODE_SESSION_SAFE_AUTO_APPROVED_TOOLS = new Set([
  'code_edit',
  'code_patch',
  'code_create',
  'code_plan',
  'code_git_diff',
  'code_symbol_search',
  'fs_read',
  'fs_write',
  'fs_search',
  'fs_list',
  'fs_mkdir',
  'fs_move',
  'fs_copy',
  'fs_delete',
  'memory_search',
  'memory_recall',
  'doc_create',
]);
const CODE_SESSION_TRUSTED_EXECUTION_TOOLS = new Set([
  'shell_safe',
  'code_git_commit',
  'code_test',
  'code_build',
  'code_lint',
  'automation_save',
  'automation_set_enabled',
  'automation_run',
  'automation_delete',
]);
const CODE_SESSION_UNTRUSTED_APPROVAL_TOOLS = new Set([
  'shell_safe',
  ...CODE_SESSION_TRUSTED_EXECUTION_TOOLS,
]);

type ShellExecMode = 'direct_exec' | 'shell_fallback';

interface ShellCommandPlan {
  commands: ParsedCommand[];
  entryCommand: string;
  argv: string[];
  executionClass: ShellExecutionClass;
  requestedViaShell: boolean;
  execMode: ShellExecMode;
  resolvedExecutable?: string;
}

interface ShellCommandCheck {
  safe: boolean;
  reason?: string;
  plan?: ShellCommandPlan;
}

interface PendingJsDependencyTracking {
  intent: JsDependencyMutationIntent;
  before: JsDependencySnapshot | null;
  workspaceRoot: string;
  cwd: string;
}

function normalizeShellCommandName(command: string): string {
  const trimmed = command.trim().replace(/[\\/]+$/, '');
  if (!trimmed) return '';
  const basename = trimmed.split(/[\\/]/).pop();
  return (basename || trimmed).toLowerCase();
}
type AwsServiceName =
  | 'sts'
  | 'ec2'
  | 's3'
  | 'route53'
  | 'lambda'
  | 'cloudwatch'
  | 'cloudwatchLogs'
  | 'rds'
  | 'iam'
  | 'costExplorer';

function emptyCloudConfig(): AssistantCloudConfig {
  return {
    enabled: false,
    cpanelProfiles: [],
    vercelProfiles: [],
    cloudflareProfiles: [],
    awsProfiles: [],
    gcpProfiles: [],
    azureProfiles: [],
  };
}

function normalizeCodeText(value: string): string {
  return value.replace(/\r\n/g, '\n');
}

function normalizeHttpUrlLikeInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function buildNormalizedIndexMap(original: string): number[] {
  const map: number[] = [];
  for (let i = 0; i < original.length; i++) {
    if (original[i] === '\r' && original[i + 1] === '\n') continue;
    map.push(i);
  }
  map.push(original.length);
  return map;
}

function lineOffsets(value: string): number[] {
  const offsets = [0];
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '\n') offsets.push(i + 1);
  }
  return offsets;
}

function normalizeLineRange(
  haystack: string,
  needle: string,
  normalizer: (value: string) => string,
): { start: number; end: number } | null {
  const haystackLines = haystack.split('\n');
  const needleLines = needle.split('\n');
  if (needleLines.length === 0 || haystackLines.length < needleLines.length) {
    return null;
  }

  const offsets = lineOffsets(haystack);
  const normalizedNeedle = normalizer(needle);
  for (let i = 0; i <= haystackLines.length - needleLines.length; i++) {
    const segment = haystackLines.slice(i, i + needleLines.length).join('\n');
    if (normalizer(segment) === normalizedNeedle) {
      const start = offsets[i] ?? 0;
      const end = i + needleLines.length < offsets.length
        ? offsets[i + needleLines.length] - 1
        : haystack.length;
      return { start, end };
    }
  }
  return null;
}

function findCodeEditRange(
  original: string,
  oldString: string,
): { start: number; end: number; strategy: string } | null {
  if (!oldString) return null;

  const exact = original.indexOf(oldString);
  if (exact >= 0) {
    return { start: exact, end: exact + oldString.length, strategy: 'exact' };
  }

  const normalizedOriginal = normalizeCodeText(original);
  const normalizedTarget = normalizeCodeText(oldString);
  const indexMap = buildNormalizedIndexMap(original);

  const normalizedExact = normalizedOriginal.indexOf(normalizedTarget);
  if (normalizedExact >= 0) {
    return {
      start: indexMap[normalizedExact] ?? 0,
      end: indexMap[normalizedExact + normalizedTarget.length] ?? original.length,
      strategy: 'line-ending-normalized',
    };
  }

  const trimmed = normalizeLineRange(
    normalizedOriginal,
    normalizedTarget,
    (value) => value.split('\n').map((line) => line.trim()).join('\n'),
  );
  if (trimmed) {
    return {
      start: indexMap[trimmed.start] ?? 0,
      end: indexMap[trimmed.end] ?? original.length,
      strategy: 'trimmed-lines',
    };
  }

  const indentInsensitive = normalizeLineRange(
    normalizedOriginal,
    normalizedTarget,
    (value) => value.split('\n').map((line) => line.trimStart()).join('\n'),
  );
  if (indentInsensitive) {
    return {
      start: indexMap[indentInsensitive.start] ?? 0,
      end: indexMap[indentInsensitive.end] ?? original.length,
      strategy: 'indentation-insensitive',
    };
  }

  const collapsedWhitespace = normalizeLineRange(
    normalizedOriginal,
    normalizedTarget,
    (value) => value.replace(/[ \t]+/g, ' ').trim(),
  );
  if (collapsedWhitespace) {
    return {
      start: indexMap[collapsedWhitespace.start] ?? 0,
      end: indexMap[collapsedWhitespace.end] ?? original.length,
      strategy: 'whitespace-collapsed',
    };
  }

  return null;
}

interface CodingQualityCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail' | 'not_run';
  details: string;
}

interface CodingQualityReport {
  passed: boolean;
  checks: CodingQualityCheck[];
}

type ToolPreflightRequest = string | { name: string; args?: Record<string, unknown> };

type ToolPreflightFix = {
  type: 'tool_policy' | 'domain' | 'command' | 'path';
  value: string;
  description: string;
};

type ToolPreflightResult = {
  name: string;
  found: boolean;
  risk: string;
  decision: 'allow' | 'deny' | 'require_approval';
  reason: string;
  fixes: ToolPreflightFix[];
};

function collectDebugArtifactMatches(content: string): string[] {
  const patterns: Array<{ label: string; regex: RegExp }> = [
    { label: 'console.log', regex: /\bconsole\.log\s*\(/g },
    { label: 'debugger', regex: /\bdebugger\b/g },
    { label: 'print()', regex: /\bprint\s*\(/g },
    { label: 'dump()', regex: /\bdump\s*\(/g },
  ];
  const matches: string[] = [];
  for (const pattern of patterns) {
    if (pattern.regex.test(content)) matches.push(pattern.label);
  }
  return matches;
}

function collectIncompleteMarkers(content: string): string[] {
  const markers = ['TODO', 'FIXME', 'HACK', 'XXX'];
  return markers.filter((marker) => content.includes(marker));
}

function extractPatchTargets(patch: string): string[] {
  const targets = new Set<string>();
  for (const line of patch.split(/\r?\n/g)) {
    if (!line.startsWith('+++ ')) continue;
    const raw = line.slice(4).trim();
    if (!raw || raw === '/dev/null') continue;
    const normalized = raw.replace(/^[ab]\//, '').trim();
    if (normalized) targets.add(normalized);
  }
  return [...targets];
}

export interface ToolExecutorOptions {
  enabled: boolean;
  workspaceRoot: string;
  policyMode: ToolPolicyMode;
  toolPolicies?: Record<string, ToolPolicySetting>;
  allowedPaths?: string[];
  allowedCommands?: string[];
  allowedDomains?: string[];
  threatIntel?: ThreatIntelService;
  assistantSecurity?: AiSecurityService;
  packageInstallTrust?: PackageInstallTrustService;
  runAssistantSecurityScan?: (input: {
    profileId?: string;
    targetIds?: string[];
    source?: AiSecurityRunSource;
    requestedBy?: string;
  }) => Promise<AiSecurityScanResult>;
  allowExternalPosting?: boolean;
  /** MCP client manager for external tool server integration. */
  mcpManager?: MCPClientManager;
  /** Web search configuration. Auto-selects best available provider (Brave > Perplexity > DuckDuckGo). */
  webSearch?: WebSearchConfig;
  /** Browser automation configuration (Playwright MCP wrappers). */
  browserConfig?: BrowserConfig;
  /** Allow wrapper tools to fall back to direct Playwright when managed MCP is unavailable. */
  enableDirectPlaywrightFallback?: boolean;
  /** Cloud and hosting provider integrations. */
  cloudConfig?: AssistantCloudConfig;
  /** Tool categories to disable at startup. */
  disabledCategories?: ToolCategory[];
  /** Conversation service for memory_search tool. */
  conversationService?: ConversationService;
  /** Agent memory store for memory_get/memory_save tools. */
  agentMemoryStore?: AgentMemoryStore;
  /** Private historical output store for saved automation runs. */
  automationOutputStore?: AutomationOutputStore;
  /** Dedicated memory store for backend-owned coding sessions. */
  codeSessionMemoryStore?: AgentMemoryStore;
  /** Backend-owned coding session store for multi-surface coding workflows. */
  codeSessionStore?: CodeSessionStore;
  /** Resolve logical state identity for chat memory/session operations. */
  resolveStateAgentId?: (agentId?: string) => string | undefined;
  /** Document search service for indexed document collections (hybrid BM25 + vector). */
  docSearch?: import('../search/search-service.js').SearchService;
  /** Native Google Workspace service (googleapis SDK, replaces gws CLI). */
  googleService?: import('../google/google-service.js').GoogleService;
  /** Native Microsoft 365 service (Graph REST API). */
  microsoftService?: import('../microsoft/microsoft-service.js').MicrosoftService;
  /** Device inventory for network intelligence/baseline tools. */
  deviceInventory?: DeviceInventoryService;
  /** Network baseline and anomaly service. */
  networkBaseline?: NetworkBaselineService;
  /** Traffic baseline + threat analysis service. */
  networkTraffic?: NetworkTrafficService;
  /** Host workstation monitoring service. */
  hostMonitor?: HostMonitoringService;
  /** Centralized host-monitor check wrapper so alerts are audited/notified consistently. */
  runHostMonitorCheck?: (source: string) => Promise<HostMonitorReport>;
  /** Gateway firewall monitoring service. */
  gatewayMonitor?: GatewayFirewallMonitoringService;
  /** Centralized gateway-monitor check wrapper so alerts are audited/notified consistently. */
  runGatewayMonitorCheck?: (source: string) => Promise<GatewayMonitorReport>;
  /** Native Windows Defender status and action provider. */
  windowsDefender?: WindowsDefenderProvider;
  /** Security containment evaluation for effective mode and bounded response state. */
  containmentService?: ContainmentService;
  /** Network feature configuration. */
  networkConfig?: AssistantNetworkConfig;
  /** External coding CLI backend orchestration service. */
  codingBackendService?: CodingBackendService;
  /** OS-level process sandbox configuration. */
  sandboxConfig?: SandboxConfig;
  /** Current sandbox health summary. */
  sandboxHealth?: SandboxHealth;
  now?: () => number;
  onCheckAction?: (action: {
    type: string;
    params: Record<string, unknown>;
    agentId: string;
    origin: ToolExecutionRequest['origin'];
  }) => void;
  /** Controls which policy areas the assistant can modify via chat (always requires approval). */
  agentPolicyUpdates?: import('../config/types.js').AgentPolicyUpdatesConfig;
  /** Callback to persist policy changes to config file after update_tool_policy modifies them. */
  onPolicyUpdate?: (
    policy: ToolPolicySnapshot,
    meta?: { browserAllowedDomains?: string[] },
  ) => void;
  /** Async pre-execution hook (Guardian Agent inline evaluation). Called after
   *  sync Guardian checks pass but before the tool handler runs. Can deny. */
  onPreExecute?: (action: {
    type: string;
    toolName: string;
    category?: ToolCategory;
    params: Record<string, unknown>;
    agentId: string;
    origin: ToolExecutionRequest['origin'];
    scheduleId?: string;
    channel?: string;
    principalId?: string;
  }) => Promise<{ allowed: boolean; reason?: string }>;
  /** Executed tool trajectories for eval/tracing. */
  onToolExecuted?: (
    toolName: string,
    args: Record<string, unknown>,
    result: { success: boolean; status: string; message?: string; durationMs: number; error?: string; approvalId?: string },
    request: ToolExecutionRequest
  ) => void;
  onApprovalDecided?: (
    approvalId: string,
    decision: 'approved' | 'denied',
    result: ToolApprovalDecisionResult,
  ) => void | Promise<void>;
}

export interface ToolPolicyUpdate {
  mode?: ToolPolicyMode;
  toolPolicies?: Record<string, ToolPolicySetting>;
  sandbox?: {
    allowedPaths?: string[];
    allowedCommands?: string[];
    allowedDomains?: string[];
  };
}

export interface ToolApprovalDecisionResult {
  success: boolean;
  message: string;
  job?: ToolJobRecord;
  result?: ToolRunResponse;
}

interface PendingApprovalContext {
  request: ToolExecutionRequest;
  args: Record<string, unknown>;
}

interface ToolChainBudgetState {
  totalCalls: number;
  nonReadOnlyCalls: number;
  signatureCounts: Map<string, number>;
  signatureFailureCounts: Map<string, number>;
  lastSeenAt: number;
}

interface AutomationWorkflowSummary {
  id: string;
  name: string;
  enabled: boolean;
  mode: string;
  description?: string;
  schedule?: string;
  steps?: Array<Record<string, unknown>>;
}

interface AutomationTaskSummary {
  id: string;
  name: string;
  description?: string;
  type: 'tool' | 'playbook' | 'agent';
  target: string;
  cron?: string;
  eventTrigger?: ScheduledTaskEventTrigger;
  enabled: boolean;
  args?: Record<string, unknown>;
  prompt?: string;
  channel?: string;
  userId?: string;
  deliver?: boolean;
  runOnce?: boolean;
  approvalExpiresAt?: number;
  approvedByPrincipal?: string;
  scopeHash?: string;
  maxRunsPerWindow?: number;
  dailySpendCap?: number;
  providerSpendCap?: number;
  consecutiveFailureCount?: number;
  consecutiveDeniedCount?: number;
  autoPausedReason?: string;
  emitEvent?: string;
}

interface AutomationControlPlane {
  listAutomations: () => SavedAutomationCatalogEntry[];
  saveAutomation: (input: AutomationSaveInput) => { success: boolean; message: string; automationId?: string; taskId?: string };
  setAutomationEnabled: (automationId: string, enabled: boolean) => { success: boolean; message: string };
  deleteAutomation: (automationId: string) => { success: boolean; message: string };
  runAutomation: (input: {
    automationId: string;
    dryRun?: boolean;
    origin?: ToolExecutionRequest['origin'];
    agentId?: string;
    userId?: string;
    channel?: string;
    requestedBy?: string;
  }) => Promise<Record<string, unknown>> | Record<string, unknown>;
  listWorkflows: () => AutomationWorkflowSummary[];
  upsertWorkflow: (workflow: Record<string, unknown>) => { success: boolean; message: string };
  deleteWorkflow: (workflowId: string) => { success: boolean; message: string };
  runWorkflow: (input: {
    workflowId: string;
    dryRun?: boolean;
    origin?: ToolExecutionRequest['origin'];
    agentId?: string;
    userId?: string;
    channel?: string;
    requestedBy?: string;
  }) => Promise<{ success: boolean; message: string; status: string; run?: unknown }> | { success: boolean; message: string; status: string; run?: unknown };
  listTasks: () => AutomationTaskSummary[];
  createTask: (input: Record<string, unknown>) => { success: boolean; message: string; task?: AutomationTaskSummary };
  updateTask: (id: string, input: Record<string, unknown>) => { success: boolean; message: string };
  runTask: (id: string) => Promise<{ success: boolean; message: string }> | { success: boolean; message: string };
  deleteTask: (id: string) => { success: boolean; message: string };
}

export class ToolExecutor {
  private readonly registry = new ToolRegistry();
  private readonly approvals = new ToolApprovalStore();
  private readonly dependencyLedgers = new Map<string, WorkspaceDependencyLedger>();
  private readonly jobs: ToolJobRecord[] = [];
  private readonly jobsById = new Map<string, ToolJobRecord>();
  private readonly pendingApprovalContexts = new Map<string, PendingApprovalContext>();
  private readonly toolChainBudgets = new Map<string, ToolChainBudgetState>();
  private readonly options: ToolExecutorOptions;
  private automationControlPlane?: AutomationControlPlane;
  private readonly marketingStore: MarketingStore;
  private readonly mcpManager?: MCPClientManager;
  private readonly hybridBrowser?: HybridBrowserService;
  private webSearchConfig: WebSearchConfig;
  private readonly searchCache = new Map<string, { results: unknown; timestamp: number }>();
  private readonly now: () => number;
  private readonly disabledCategories: Set<string>;
  private readonly sandboxConfig: SandboxConfig;
  private readonly sandboxHealth?: SandboxHealth;
  private readonly networkConfig: AssistantNetworkConfig;
  private cloudConfig: AssistantCloudConfig;
  private policy: ToolPolicySnapshot;
  private readonly runtimeNotices: ToolRuntimeNotice[] = [];

  constructor(options: ToolExecutorOptions) {
    this.options = options;
    this.now = options.now ?? Date.now;
    this.disabledCategories = new Set(options.disabledCategories ?? []);
    this.mcpManager = options.mcpManager;
    this.hybridBrowser = this.mcpManager ? new HybridBrowserService(this.mcpManager, {
      now: this.now,
      browserConfig: options.browserConfig,
      enableDirectPlaywright: options.enableDirectPlaywrightFallback === true,
    }) : undefined;
    this.webSearchConfig = options.webSearch ?? {};
    this.sandboxConfig = options.sandboxConfig ?? DEFAULT_SANDBOX_CONFIG;
    this.sandboxHealth = options.sandboxHealth;
    this.cloudConfig = options.cloudConfig ?? emptyCloudConfig();
    this.networkConfig = options.networkConfig ?? {
      deviceIntelligence: { enabled: true, ouiDatabase: 'bundled', autoClassify: true },
      baseline: {
        enabled: true,
        minSnapshotsForBaseline: 3,
        dedupeWindowMs: 1_800_000,
        anomalyRules: {
          newDevice: { enabled: true, severity: 'medium' },
          portChange: { enabled: true, severity: 'low' },
          arpSpoofing: { enabled: true, severity: 'critical' },
          unusualService: { enabled: true, severity: 'medium' },
          deviceGone: { enabled: true, severity: 'low' },
          massPortOpen: { enabled: true, severity: 'high' },
        },
      },
      fingerprinting: { enabled: true, bannerTimeout: 3000, maxConcurrentPerDevice: 5, autoFingerprint: false },
      wifi: { enabled: false, platform: 'auto', scanInterval: 300 },
      trafficAnalysis: {
        enabled: false,
        dataSource: 'ss',
        flowRetention: 86_400_000,
        threatRules: {
          dataExfiltration: { enabled: true, thresholdMB: 100, windowMinutes: 60 },
          portScanning: { enabled: true, portThreshold: 20, windowSeconds: 60 },
          beaconing: { enabled: true, minIntervals: 10, tolerancePercent: 5 },
        },
      },
      connections: [],
    };
    this.marketingStore = new MarketingStore(options.workspaceRoot, this.now);
    this.policy = {
      mode: options.policyMode,
      toolPolicies: { ...(options.toolPolicies ?? {}) },
      sandbox: {
        allowedPaths: options.allowedPaths?.length
          ? [...options.allowedPaths]
          : [options.workspaceRoot],
        allowedCommands: options.allowedCommands?.length
          ? [...options.allowedCommands]
          : [...DEFAULT_TOOL_ALLOWED_COMMANDS],
        allowedDomains: options.allowedDomains?.length
          ? [...options.allowedDomains]
          : ['localhost', '127.0.0.1', 'moltbook.com'],
      },
    };
    this.initializeSandboxNotices();
    this.registerBuiltinTools();
    if (this.mcpManager) {
      this.refreshDynamicMcpTooling();
    }
  }

  /**
   * Register all tools discovered from connected MCP servers.
   *
   * Each MCP tool is registered with a handler that delegates to
   * MCPClientManager.callTool(). The tool name is namespaced as
   * mcp-<serverId>-<toolName> to prevent collisions.
   *
   * Call this again after connecting new MCP servers to refresh.
   */
  registerMCPTools(): void {
    this.refreshDynamicMcpTooling();
  }

  refreshDynamicMcpTooling(): void {
    if (!this.mcpManager) return;

    const definitions = this.mcpManager.getAllToolDefinitions();
    const currentNames = new Set(definitions.map((definition) => definition.name));
    for (const registered of this.registry.listDefinitions()) {
      if (registered.name.startsWith('mcp-') && !currentNames.has(registered.name)) {
        this.registry.unregister(registered.name);
      }
    }

    for (const def of definitions) {
      const normalizedDef = !def.category
        ? {
          ...def,
          category: isBrowserMcpToolName(def.name) ? 'browser' as const : 'mcp' as const,
        }
        : def;
      const manager = this.mcpManager;
      this.registry.register(normalizedDef, async (args, request) => {
        const guard = inferMCPGuardAction(normalizedDef);
        if (guard) {
          this.guardAction(request, guard.type, {
            toolName: normalizedDef.name,
            ...guard.params,
          });
        }
        return manager.callTool(normalizedDef.name, args);
      });
    }

    this.syncHybridBrowserTools();
  }

  setBrowserConfig(browserConfig: BrowserConfig | undefined): void {
    this.options.browserConfig = browserConfig;
    this.hybridBrowser?.setBrowserConfig(browserConfig);
  }

  setCodingBackendService(codingBackendService: CodingBackendService | undefined): void {
    this.options.codingBackendService = codingBackendService;
  }

  private syncHybridBrowserTools(): void {
    syncBuiltinBrowserTools({
      registry: this.registry,
      hybridBrowser: this.hybridBrowser,
      browserConfig: this.options.browserConfig,
      getHybridBrowserScopeKey: (request) => this.getHybridBrowserScopeKey(request),
      normalizeBrowserUrlArg: (toolName, value) => this.normalizeBrowserUrlArg(toolName, value),
      normalizeHybridBrowserMode: (value) => this.normalizeHybridBrowserMode(value),
      asString,
      guardAction: (request, action, details) => this.guardAction(request, action, details),
    });
  }

  private getHybridBrowserScopeKey(request: Partial<ToolExecutionRequest>): string {
    const codeSessionId = request.codeContext?.sessionId?.trim();
    if (codeSessionId) return `code:${codeSessionId}`;
    const principalId = request.principalId?.trim();
    if (principalId) return `principal:${request.channel ?? 'unknown'}:${principalId}`;
    const userId = request.userId?.trim();
    if (userId) return `user:${request.channel ?? 'unknown'}:${userId}`;
    const requestId = request.requestId?.trim();
    if (requestId) return `request:${requestId}`;
    return `agent:${request.agentId ?? 'assistant-tools'}`;
  }

  private normalizeBrowserUrlArg(
    toolName: string,
    value: unknown,
  ): { url?: string; error?: string } {
    const raw = asString(value, '').trim();
    if (!raw) return {};
    const urlText = normalizeHttpUrlLikeInput(raw);
    let parsed: URL;
    try {
      parsed = new URL(urlText);
    } catch {
      return { error: `Invalid URL '${raw}'.` };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { error: 'Browser tools only support http and https URLs.' };
    }
    if (isPrivateAddress(parsed.hostname)) {
      return { error: `Blocked: ${parsed.hostname} is a private/internal address (SSRF protection).` };
    }
    const host = parsed.hostname.toLowerCase();
    if (!this.isHostAllowedForTool(toolName, host)) {
      return {
        error: this.isBrowserFacingTool(toolName)
          ? `Host '${host}' is not in the browser allowedDomains.`
          : `Host '${host}' is not in allowedDomains.`,
      };
    }
    return { url: urlText };
  }

  private normalizeHybridBrowserMode(value: unknown): HybridBrowserMode {
    const mode = asString(value, 'auto').trim().toLowerCase();
    return mode === 'read' || mode === 'interactive' ? mode : 'auto';
  }

  isEnabled(): boolean {
    return this.options.enabled;
  }

  getBrowserCapabilities(): { available: boolean; read: string; interact: string; directBackend: boolean; mcpTools: number } {
    const capabilities = this.hybridBrowser?.getCapabilities();
    return {
      available: capabilities?.available ?? false,
      read: capabilities?.preferredReadBackend ?? 'none',
      interact: capabilities?.preferredInteractionBackend ?? 'none',
      directBackend: !!capabilities?.backends.playwright.moduleName || !!capabilities?.backends.playwright.unavailableReason,
      mcpTools: this.mcpManager?.getAllToolDefinitions().filter(d => d.name.startsWith('mcp-playwright-')).length ?? 0,
    };
  }

  setAutomationControlPlane(controlPlane: AutomationControlPlane | undefined): void {
    this.automationControlPlane = controlPlane;
  }

  /** Look up a single tool definition by name. */
  getToolDefinition(name: string): ToolDefinition | undefined {
    return this.registry.get(name)?.definition;
  }

  listToolDefinitions(): ToolDefinition[] {
    return this.registry.listDefinitions().filter(
      (def) => this.isAssistantVisibleTool(def)
        && this.isCategoryEnabled(def.category)
        && !this.getSandboxBlockReason(def.name, def.category),
    );
  }

  /** Return only always-loaded (non-deferred) tool definitions, respecting category/sandbox filters. */
  listAlwaysLoadedDefinitions(): ToolDefinition[] {
    const definitions = [...this.registry.listAlwaysLoaded()];
    if (this.options.googleService) {
      for (const toolName of ['gws', 'gws_schema', 'gmail_draft']) {
        const def = this.registry.get(toolName)?.definition;
        if (def) definitions.push(def);
      }
    }
    if (this.options.microsoftService) {
      for (const toolName of ['m365', 'm365_schema', 'outlook_draft']) {
        const def = this.registry.get(toolName)?.definition;
        if (def) definitions.push(def);
      }
    }

    return uniqueBy(definitions, (def) => def.name).filter(
      (def) => this.isAssistantVisibleTool(def)
        && this.isCategoryEnabled(def.category)
        && !this.getSandboxBlockReason(def.name, def.category),
    );
  }

  /** Return coding-category tool definitions (normally deferred) for eager loading in code sessions. */
  listCodingToolDefinitions(): ToolDefinition[] {
    const codingToolNames = [
      'code_edit', 'code_patch', 'code_create', 'code_plan', 'code_git_diff',
      'code_test', 'code_build', 'code_lint', 'code_symbol_search',
      'fs_write', 'fs_mkdir', 'fs_move', 'fs_copy', 'fs_delete',
      'doc_create',
      'automation_list', 'automation_output_search', 'automation_output_read',
      'automation_save', 'automation_set_enabled', 'automation_run', 'automation_delete',
    ];
    const defs: ToolDefinition[] = [];
    for (const name of codingToolNames) {
      const entry = this.registry.get(name);
      if (entry && this.isCategoryEnabled(entry.definition.category)) {
        defs.push(entry.definition);
      }
    }
    return defs;
  }

  /** Return a small read-first coding subset for the first code-session tool round. */
  listCodeSessionEagerToolDefinitions(): ToolDefinition[] {
    const eagerToolNames = [
      'code_plan',
      'code_symbol_search',
      'code_git_diff',
      'code_test',
      'code_build',
      'code_lint',
    ];
    const defs: ToolDefinition[] = [];
    for (const name of eagerToolNames) {
      const entry = this.registry.get(name);
      if (entry && this.isCategoryEnabled(entry.definition.category)) {
        defs.push(entry.definition);
      }
    }
    return defs;
  }

  /** Search tools by keyword, returning full definitions (including deferred). */
  searchTools(query: string, maxResults: number = 10): ToolDefinition[] {
    return this.registry.searchTools(query, maxResults).filter(
      (def) => this.isAssistantVisibleTool(def)
        && this.isCategoryEnabled(def.category)
        && !this.getSandboxBlockReason(def.name, def.category),
    );
  }

  getRuntimeNotices(): ToolRuntimeNotice[] {
    return [...this.runtimeNotices];
  }

  setGoogleService(googleService: import('../google/google-service.js').GoogleService | undefined): void {
    this.options.googleService = googleService;
  }

  setMicrosoftService(microsoftService: import('../microsoft/microsoft-service.js').MicrosoftService | undefined): void {
    this.options.microsoftService = microsoftService;
  }

  setCloudConfig(cloudConfig: AssistantCloudConfig | undefined): void {
    this.cloudConfig = cloudConfig ?? emptyCloudConfig();
  }

  setDocSearch(docSearch: import('../search/search-service.js').SearchService | undefined): void {
    this.options.docSearch = docSearch;
  }

  /** Context summary for LLM system prompt — workspace root, allowed paths, policy mode. */
  getToolContext(request?: Partial<ToolExecutionRequest>): string {
    const enabledCategories = this.getCategoryInfo()
      .filter((category) => category.enabled)
      .map((category) => `${category.category} (${category.toolCount})`);
    const policyUpdateActions = this.describePolicyUpdateActions();
    const effectiveWorkspaceRoot = this.getEffectiveWorkspaceRoot(request);
    const effectiveAllowedPaths = uniqueNonEmpty(this.getEffectiveAllowedPaths(request));
    const effectiveAllowedCommands = uniqueNonEmpty(this.getEffectiveAllowedCommands(request));
    const codeWorkspaceRoot = this.getCodeWorkspaceRoot(request);
    const lines: string[] = [
      `Workspace root (default for file operations): ${effectiveWorkspaceRoot}`,
      `Policy mode: ${this.policy.mode}`,
      `Allowed paths: ${effectiveAllowedPaths.join(', ') || '(workspace root only)'}`,
      `Allowed commands: ${effectiveAllowedCommands.join(', ') || '(none)'}`,
      'Execution identity policy: inline interpreter eval, shell-expression launchers, and package launchers such as npx/npm exec are blocked even when the base command prefix is allowlisted.',
      'Execution mode: simple direct-binary commands run without shell parsing when possible; shell fallback is reserved for shell-builtins, chained commands, redirects, and platform wrapper cases.',
      `Enabled tool categories: ${enabledCategories.join(', ') || '(none)'}`,
      policyUpdateActions,
      'Additional tools may be hidden by deferred loading. Use find_tools to discover tools that are not currently visible.',
    ];
    if (codeWorkspaceRoot) {
      lines.push(
        `Active coding session workspace: ${codeWorkspaceRoot}`,
        'For this coding-session request, the workspace root above is already trusted. Do not call update_tool_policy to add that same path unless the user explicitly wants to widen the persistent global allowlist.',
      );
    }
    lines.push(...this.getDependencyAwarenessContextLines(effectiveWorkspaceRoot));
    if (this.policy.sandbox.allowedDomains.length > 0) {
      lines.push(`Allowed domains: ${this.policy.sandbox.allowedDomains.join(', ')}`);
    }
    lines.push(...this.describeBrowserContextLines());
    lines.push(...this.describeGoogleContextLines());
    lines.push(...this.describeCloudContextLines());
    return lines.join('\n');
  }

  private describePolicyUpdateActions(): string {
    const updates = this.options.agentPolicyUpdates;
    const enabledActions: string[] = [];
    if (updates?.allowedPaths) enabledActions.push('add_path', 'remove_path');
    if (updates?.allowedCommands) enabledActions.push('add_command', 'remove_command');
    if (updates?.allowedDomains) enabledActions.push('add_domain', 'remove_domain');
    if (enabledActions.length === 0) {
      return 'Policy updates via chat: disabled';
    }
    return `Policy updates via chat: enabled via update_tool_policy (${enabledActions.join(', ')})`;
  }

  private describeBrowserContextLines(): string[] {
    const capabilities = this.hybridBrowser?.getCapabilities();
    if (!capabilities?.available) {
      return ['Browser automation: unavailable'];
    }

    const readBackend = capabilities.preferredReadBackend ?? 'none';
    const interactionBackend = capabilities.preferredInteractionBackend ?? 'none';
    const browserAllowedDomains = this.getBrowserAllowedDomains();
    const browserUsesDedicatedAllowlist = Array.isArray(this.options.browserConfig?.allowedDomains)
      && this.options.browserConfig.allowedDomains.length > 0;
    const lines = [
      `Browser automation: available (read=${readBackend}, interact=${interactionBackend})`,
      'Use Guardian-native browser tools first: browser_capabilities, browser_navigate, browser_read, browser_links, browser_extract, browser_state, and browser_act.',
      `Browser allowed domains: ${browserAllowedDomains.join(', ') || '(none)'}${browserUsesDedicatedAllowlist ? '' : ' (inherits general allowedDomains)'}`,
    ];
    lines.push('Browser reads, link extraction, structured extraction, and interactive actions all run through the Playwright wrapper lane.');
    if (capabilities.wrappers.browserState && capabilities.wrappers.browserAct) {
      lines.push('For deterministic page mutation, capture browser_state first and then call browser_act with the returned stateId plus a stable ref.');
    }
    if (capabilities.wrappers.browserInteract) {
      lines.push('browser_interact remains available as a compatibility shim; use action=list for discovery, but prefer browser_state/browser_act for new flows and saved automations.');
    }
    if (!capabilities.backends.playwright.available) {
      lines.push('Interactive browser actions are unavailable because the Playwright backend is not connected.');
    }
    return lines;
  }

  private describeCloudContextLines(): string[] {
    if (!this.cloudConfig.enabled) {
      return ['Cloud tools: disabled'];
    }

    const lines: string[] = [
      'Cloud tools: enabled',
      'Cloud tool families available via find_tools: cpanel_*, whm_*, vercel_*, cf_*, aws_*, gcp_*, azure_*',
      'Use configured cloud profile ids exactly as listed below when calling cloud tools. If a matching profile is listed, do not ask the user to repeat host or credential details.',
    ];

    const profileLines = [
      ...this.describeCpanelProfilesForContext(),
      ...this.describeVercelProfilesForContext(),
      ...this.describeCloudflareProfilesForContext(),
      ...this.describeAwsProfilesForContext(),
      ...this.describeGcpProfilesForContext(),
      ...this.describeAzureProfilesForContext(),
    ];

    if (profileLines.length === 0) {
      lines.push('Configured cloud profiles: none');
      return lines;
    }

    lines.push('Configured cloud profiles:');
    lines.push(...profileLines);
    return lines;
  }

  private describeGoogleContextLines(): string[] {
    const googleSvc = this.options.googleService;
    if (!googleSvc) {
      return ['Google Workspace: unavailable'];
    }

    const services = googleSvc.getEnabledServices();
    const status = googleSvc.isAuthenticated() ? 'connected' : 'not connected';
    const lines = [
      `Google Workspace: ${status}`,
      `Google Workspace services: ${services.join(', ') || '(none)'}`,
      'Google Workspace authentication is automatic for gws/gmail tools. Do not ask the user for OAuth access tokens.',
    ];
    if (!googleSvc.isAuthenticated()) {
      lines.push('If a Google action fails for auth, tell the user to connect Google Workspace in Settings instead of asking for raw tokens.');
    }
    return lines;
  }

  private describeCpanelProfilesForContext(): string[] {
    return (this.cloudConfig.cpanelProfiles ?? []).map((profile) => {
      const normalized = normalizeCpanelConnectionConfig({
        id: profile.id,
        name: profile.name,
        host: profile.host,
        port: profile.port,
        username: profile.username,
        apiToken: profile.apiToken ?? '',
        type: profile.type,
        ssl: profile.ssl,
        allowSelfSigned: profile.allowSelfSigned,
        defaultCpanelUser: profile.defaultCpanelUser,
      });
      const endpoint = this.describeCloudEndpoint(normalized);
      const suggestedTool = profile.type === 'whm' ? 'whm_status' : 'cpanel_account';
      const defaultAccount = profile.defaultCpanelUser?.trim()
        ? ` defaultCpanelUser=${profile.defaultCpanelUser.trim()}`
        : '';
      return `- ${profile.id}: provider=${profile.type} label="${profile.name}" endpoint=${endpoint} username=${profile.username} credential=${profile.apiToken?.trim() ? 'ready' : 'missing'} hostAllowlisted=${this.isHostAllowed(normalized.host) ? 'yes' : 'no'} suggestedReadOnlyTest=${suggestedTool}${defaultAccount}`;
    });
  }

  private describeVercelProfilesForContext(): string[] {
    return (this.cloudConfig.vercelProfiles ?? []).map((profile) => {
      const endpoint = this.describeVercelEndpoint({
        id: profile.id,
        name: profile.name,
        apiBaseUrl: profile.apiBaseUrl,
        apiToken: profile.apiToken ?? '',
        teamId: profile.teamId,
        slug: profile.slug,
      });
      const host = new URL(endpoint).hostname;
      return `- ${profile.id}: provider=vercel label="${profile.name}" endpoint=${endpoint} credential=${profile.apiToken?.trim() ? 'ready' : 'missing'} hostAllowlisted=${this.isHostAllowed(host) ? 'yes' : 'no'} suggestedReadOnlyTest=vercel_status`;
    });
  }

  private describeCloudflareProfilesForContext(): string[] {
    return (this.cloudConfig.cloudflareProfiles ?? []).map((profile) => {
      const endpoint = this.describeCloudflareEndpoint({
        id: profile.id,
        name: profile.name,
        apiBaseUrl: profile.apiBaseUrl,
        apiToken: profile.apiToken ?? '',
        accountId: profile.accountId,
        defaultZoneId: profile.defaultZoneId,
      });
      const host = new URL(endpoint).hostname;
      return `- ${profile.id}: provider=cloudflare label="${profile.name}" endpoint=${endpoint} credential=${profile.apiToken?.trim() ? 'ready' : 'missing'} hostAllowlisted=${this.isHostAllowed(host) ? 'yes' : 'no'} suggestedReadOnlyTest=cf_status`;
    });
  }

  private describeAwsProfilesForContext(): string[] {
    return (this.cloudConfig.awsProfiles ?? []).map((profile) => {
      const endpoint = this.describeAwsEndpoint({
        id: profile.id,
        name: profile.name,
        region: profile.region,
        accessKeyId: profile.accessKeyId,
        secretAccessKey: profile.secretAccessKey,
        sessionToken: profile.sessionToken,
        endpoints: profile.endpoints,
      }, 'sts');
      const host = new URL(endpoint).hostname;
      const hasCredential = !!profile.accessKeyId?.trim() && !!profile.secretAccessKey?.trim();
      return `- ${profile.id}: provider=aws label="${profile.name}" region=${profile.region} endpoint=${endpoint} credential=${hasCredential || !!profile.sessionToken?.trim() ? 'ready' : 'ambient-or-missing'} hostAllowlisted=${this.isHostAllowed(host) ? 'yes' : 'no'} suggestedReadOnlyTest=aws_status`;
    });
  }

  private describeGcpProfilesForContext(): string[] {
    return (this.cloudConfig.gcpProfiles ?? []).map((profile) => {
      const endpoint = this.describeGcpEndpoint({
        id: profile.id,
        name: profile.name,
        projectId: profile.projectId,
        location: profile.location,
        accessToken: profile.accessToken,
        serviceAccountJson: profile.serviceAccountJson,
        endpoints: profile.endpoints,
      }, 'cloudResourceManager');
      const host = new URL(endpoint).hostname;
      const hasCredential = !!profile.accessToken?.trim() || !!profile.serviceAccountJson?.trim();
      return `- ${profile.id}: provider=gcp label="${profile.name}" project=${profile.projectId} endpoint=${endpoint} credential=${hasCredential ? 'ready' : 'missing'} hostAllowlisted=${this.isHostAllowed(host) ? 'yes' : 'no'} suggestedReadOnlyTest=gcp_status`;
    });
  }

  private describeAzureProfilesForContext(): string[] {
    return (this.cloudConfig.azureProfiles ?? []).map((profile) => {
      const endpoint = this.describeAzureEndpoint({
        id: profile.id,
        name: profile.name,
        subscriptionId: profile.subscriptionId,
        tenantId: profile.tenantId,
        accessToken: profile.accessToken,
        clientId: profile.clientId,
        clientSecret: profile.clientSecret,
        defaultResourceGroup: profile.defaultResourceGroup,
        blobBaseUrl: profile.blobBaseUrl,
        endpoints: profile.endpoints,
      }, 'management');
      const host = new URL(endpoint).hostname;
      const hasCredential = !!profile.accessToken?.trim() || (!!profile.clientId?.trim() && !!profile.clientSecret?.trim());
      return `- ${profile.id}: provider=azure label="${profile.name}" subscription=${profile.subscriptionId} endpoint=${endpoint} credential=${hasCredential ? 'ready' : 'missing'} hostAllowlisted=${this.isHostAllowed(host) ? 'yes' : 'no'} suggestedReadOnlyTest=azure_status`;
    });
  }

  getSandboxHealth(): SandboxHealth | undefined {
    return this.sandboxHealth;
  }

  getPolicy(): ToolPolicySnapshot {
    return {
      mode: this.policy.mode,
      toolPolicies: { ...this.policy.toolPolicies },
      sandbox: {
        allowedPaths: [...this.policy.sandbox.allowedPaths],
        allowedCommands: [...this.policy.sandbox.allowedCommands],
        allowedDomains: [...this.policy.sandbox.allowedDomains],
      },
    };
  }

  updatePolicy(update: ToolPolicyUpdate): ToolPolicySnapshot {
    if (update.mode) {
      this.policy.mode = update.mode;
    }
    if (update.toolPolicies) {
      this.policy.toolPolicies = {
        ...this.policy.toolPolicies,
        ...update.toolPolicies,
      };
    }
    if (update.sandbox?.allowedPaths) {
      this.policy.sandbox.allowedPaths = uniqueNonEmpty(update.sandbox.allowedPaths);
    }
    if (update.sandbox?.allowedCommands) {
      this.policy.sandbox.allowedCommands = uniqueNonEmpty(update.sandbox.allowedCommands);
    }
    if (update.sandbox?.allowedDomains) {
      this.policy.sandbox.allowedDomains = uniqueNonEmpty(update.sandbox.allowedDomains.map((host) => host.toLowerCase()));
    }
    return this.getPolicy();
  }

  private getCodeWorkspaceRoot(request?: Partial<ToolExecutionRequest>): string | undefined {
    const rawRoot = request?.codeContext?.workspaceRoot?.trim();
    if (!rawRoot) return undefined;
    const normalizedRoot = normalizePathForHost(rawRoot);
    return isAbsolute(normalizedRoot)
      ? resolve(normalizedRoot)
      : resolve(this.options.workspaceRoot, normalizedRoot);
  }

  private getEffectiveWorkspaceRoot(request?: Partial<ToolExecutionRequest>): string {
    return this.getCodeWorkspaceRoot(request) ?? this.options.workspaceRoot;
  }

  private getEffectiveAllowedPaths(request?: Partial<ToolExecutionRequest>): string[] {
    const codeWorkspaceRoot = this.getCodeWorkspaceRoot(request);
    if (codeWorkspaceRoot) {
      return [codeWorkspaceRoot];
    }
    return this.policy.sandbox.allowedPaths.length > 0
      ? this.policy.sandbox.allowedPaths
      : [this.options.workspaceRoot];
  }

  private getEffectiveAllowedCommands(request?: Partial<ToolExecutionRequest>): string[] {
    if (this.getCodeWorkspaceRoot(request)) {
      return [...CODE_ASSISTANT_ALLOWED_COMMANDS];
    }
    return this.policy.sandbox.allowedCommands;
  }

  private getDependencyLedger(workspaceRoot: string): WorkspaceDependencyLedger {
    const normalizedWorkspaceRoot = resolve(workspaceRoot);
    let ledger = this.dependencyLedgers.get(normalizedWorkspaceRoot);
    if (!ledger) {
      ledger = new WorkspaceDependencyLedger(normalizedWorkspaceRoot);
      this.dependencyLedgers.set(normalizedWorkspaceRoot, ledger);
    }
    return ledger;
  }

  private getDependencyAwarenessContextLines(workspaceRoot: string): string[] {
    try {
      return this.getDependencyLedger(workspaceRoot).buildPromptLines();
    } catch {
      return [];
    }
  }

  private prepareJsDependencyTracking(
    commands: ParsedCommand[],
    cwd: string,
    request?: Partial<ToolExecutionRequest>,
  ): PendingJsDependencyTracking | null {
    const intent = commands
      .map((parsedCommand) => detectJsDependencyMutationIntent(parsedCommand))
      .find((value): value is JsDependencyMutationIntent => value !== null);
    if (!intent) return null;

    const workspaceRoot = this.getEffectiveWorkspaceRoot(request);
    try {
      return {
        intent,
        before: captureJsDependencySnapshot(workspaceRoot, cwd),
        workspaceRoot,
        cwd,
      };
    } catch {
      return null;
    }
  }

  private finalizeJsDependencyTracking(tracking: PendingJsDependencyTracking | null, command: string): void {
    if (!tracking) return;
    try {
      const after = captureJsDependencySnapshot(tracking.workspaceRoot, tracking.cwd);
      if (!after) return;
      const diff = diffJsDependencySnapshots(tracking.before, after);
      if (!diff) return;

      this.getDependencyLedger(tracking.workspaceRoot).recordMutation({
        intent: tracking.intent,
        command,
        cwd: tracking.cwd,
        before: tracking.before,
        after,
        diff,
        now: this.now,
      });
    } catch {
      // Dependency-awareness bookkeeping should not make the shell command fail.
    }
  }

  private isCodeWorkspacePolicyNoOp(
    definition: ToolDefinition,
    args: Record<string, unknown>,
    request?: Partial<ToolExecutionRequest>,
  ): boolean {
    if (definition.name !== 'update_tool_policy') return false;
    const codeWorkspaceRoot = this.getCodeWorkspaceRoot(request);
    if (!codeWorkspaceRoot) return false;
    const action = asString(args.action, '').trim();
    const value = asString(args.value, '').trim();
    if (action !== 'add_path' || !value) return false;
    const normalizedValue = normalizePathForHost(value);
    const resolvedValue = isAbsolute(normalizedValue)
      ? resolve(normalizedValue)
      : resolve(codeWorkspaceRoot, normalizedValue);
    return isPathInside(resolvedValue, codeWorkspaceRoot);
  }

  /** Auto-approve tools that belong to the coding workflow when operating inside the code session workspace. */
  private isCodeSessionWorkspaceTool(
    definition: ToolDefinition,
    request?: Partial<ToolExecutionRequest>,
  ): boolean {
    if (!this.getCodeWorkspaceRoot(request)) return false;
    return CODE_SESSION_SAFE_AUTO_APPROVED_TOOLS.has(definition.name)
      || (
        this.isCodeSessionTrustCleared(request)
        && (
          CODE_SESSION_TRUSTED_EXECUTION_TOOLS.has(definition.name)
          || isDirectMemoryMutationToolName(definition.name)
        )
      );
  }

  private getCodeSessionSurfaceId(request?: Partial<ToolExecutionRequest>): string {
    const surfaceId = request?.surfaceId?.trim();
    const userId = request?.userId?.trim();
    return surfaceId || userId || 'default-surface';
  }

  private listOwnedCodeSessions(request?: Partial<ToolExecutionRequest>) {
    const ownerUserId = request?.userId?.trim();
    if (!ownerUserId || !this.options.codeSessionStore) return [];
    return this.options.codeSessionStore.listSessionsForUser(ownerUserId);
  }

  private getOwnedCodeSession(sessionId: string, request?: Partial<ToolExecutionRequest>) {
    const ownerUserId = request?.userId?.trim();
    if (!ownerUserId || !this.options.codeSessionStore) return null;
    return this.options.codeSessionStore.getSession(sessionId, ownerUserId);
  }

  private resolveOwnedCodeSessionTarget(
    target: string,
    request?: Partial<ToolExecutionRequest>,
  ): {
    session?: ReturnType<ToolExecutor['listOwnedCodeSessions']>[number];
    error?: string;
  } {
    return resolveCodeSessionTarget(target, this.listOwnedCodeSessions(request));
  }

  private getCurrentCodeSessionRecord(request?: Partial<ToolExecutionRequest>) {
    const sessionId = request?.codeContext?.sessionId?.trim();
    if (!sessionId) return null;
    return this.getOwnedCodeSession(sessionId, request)
      ?? this.options.codeSessionStore?.getSession(sessionId)
      ?? null;
  }

  private getCurrentCodeSessionTrustState(request?: Partial<ToolExecutionRequest>): string | null {
    const session = this.getCurrentCodeSessionRecord(request);
    return getEffectiveCodeWorkspaceTrustState(
      session?.workState.workspaceTrust,
      session?.workState.workspaceTrustReview,
    ) ?? null;
  }

  private isCodeSessionTrustCleared(request?: Partial<ToolExecutionRequest>): boolean {
    return this.getCurrentCodeSessionTrustState(request) === 'trusted';
  }

  private isReadOnlyShellCommand(command: string): boolean {
    const fullCmd = command.trim();
    if (!fullCmd) return false;
    const firstWord = fullCmd.split(/\s+/)[0];
    const readOnlyCommands = ['ls', 'dir', 'pwd', 'whoami', 'hostname', 'uname', 'date', 'echo',
      'cat', 'head', 'tail', 'wc', 'file', 'which', 'type'];
    const readOnlyPrefixed = ['git status', 'git diff', 'git log', 'git branch', 'git remote',
      'git tag', 'node --version', 'npm --version', 'npm ls'];
    return readOnlyCommands.includes(firstWord)
      || readOnlyPrefixed.some((candidate) => fullCmd === candidate || fullCmd.startsWith(`${candidate} `));
  }

  private decideCodeSessionTrust(
    definition: ToolDefinition,
    args: Record<string, unknown>,
    request?: Partial<ToolExecutionRequest>,
  ): ToolDecision | null {
    if (!this.getCodeWorkspaceRoot(request)) return null;
    const trustState = this.getCurrentCodeSessionTrustState(request);
    if (!trustState || trustState === 'trusted') return null;

    if (definition.name === 'shell_safe') {
      const command = asString(args.command).trim();
      return this.isReadOnlyShellCommand(command) ? 'allow' : 'require_approval';
    }

    if (isMemoryMutationToolName(definition.name)) {
      return 'require_approval';
    }

    return CODE_SESSION_UNTRUSTED_APPROVAL_TOOLS.has(definition.name)
      ? 'require_approval'
      : null;
  }

  private getCurrentCodeSessionMemoryContext(
    request?: Partial<ToolExecutionRequest>,
  ): { sessionId: string; store?: AgentMemoryStore } | null {
    const sessionId = request?.codeContext?.sessionId?.trim();
    if (!sessionId) return null;
    return {
      sessionId,
      store: this.options.codeSessionMemoryStore,
    };
  }

  private resolveCodeSessionMemoryContext(
    sessionId: string | undefined,
    request?: Partial<ToolExecutionRequest>,
  ): { sessionId: string; store?: AgentMemoryStore } | null {
    const trimmed = sessionId?.trim();
    if (!trimmed) {
      return this.getCurrentCodeSessionMemoryContext(request);
    }
    if (request?.codeContext?.sessionId?.trim() === trimmed) {
      return {
        sessionId: trimmed,
        store: this.options.codeSessionMemoryStore,
      };
    }
    const owned = this.getOwnedCodeSession(trimmed, request);
    if (!owned) return null;
    return {
      sessionId: trimmed,
      store: this.options.codeSessionMemoryStore,
    };
  }

  private getGlobalMemoryContext(
    request?: Partial<ToolExecutionRequest>,
    explicitAgentId?: string,
  ): {
    agentId: string;
    store?: AgentMemoryStore;
  } {
    const requestAgentId = explicitAgentId?.trim() || asString(request?.agentId);
    const stateAgentId = this.options.resolveStateAgentId?.(requestAgentId) ?? requestAgentId;
    return {
      agentId: stateAgentId || 'default',
      store: this.options.agentMemoryStore,
    };
  }

  private searchPersistentMemoryEntries(
    store: AgentMemoryStore,
    targetId: string,
    query: string,
    limit: number,
  ): PersistentMemorySearchMatch[] {
    const normalizedQuery = this.normalizePersistentMemorySearchText(query);
    if (!normalizedQuery) {
      return [];
    }

    const queryTerms = this.extractPersistentMemorySearchTerms(normalizedQuery);
    const identifierFragments = this.extractPersistentMemorySearchIdentifiers(query);
    const preview = (value: string) => value.length > 500 ? `${value.slice(0, 500)}...` : value;

    const matches: Array<PersistentMemorySearchMatch & {
      recencyIndex: number;
      fullComparableHit: boolean;
      matchedIdentifierCount: number;
    }> = [];
    store.getEntries(targetId).forEach((entry, index) => {
      const content = this.normalizePersistentMemorySearchText(entry.content);
      const summary = this.normalizePersistentMemorySearchText(entry.summary ?? '');
      const category = this.normalizePersistentMemorySearchText(entry.category ?? '');
      const tags = Array.isArray(entry.tags) ? this.normalizePersistentMemorySearchText(entry.tags.join(' ')) : '';
      const comparableContent = this.buildPersistentMemoryComparable(content);
      const comparableSummary = this.buildPersistentMemoryComparable(summary);
      const comparableCategory = this.buildPersistentMemoryComparable(category);
      const comparableTags = this.buildPersistentMemoryComparable(tags);
      const comparableQuery = this.buildPersistentMemoryComparable(normalizedQuery);
      const fullComparableHit = comparableQuery.length > 0 && (
        comparableContent.includes(comparableQuery)
        || comparableSummary.includes(comparableQuery)
        || comparableCategory.includes(comparableQuery)
        || comparableTags.includes(comparableQuery)
      );
      const matchedIdentifierCount = identifierFragments.filter((fragment) => (
        comparableContent.includes(fragment)
        || comparableSummary.includes(fragment)
        || comparableCategory.includes(fragment)
        || comparableTags.includes(fragment)
      )).length;

      let matchScore = 0;
      if (fullComparableHit) matchScore += 240;
      if (content.includes(normalizedQuery)) matchScore += 120;
      if (summary.includes(normalizedQuery)) matchScore += 150;
      if (category.includes(normalizedQuery)) matchScore += 90;
      if (tags.includes(normalizedQuery)) matchScore += 60;
      if (content.startsWith(normalizedQuery) || summary.startsWith(normalizedQuery)) matchScore += 20;

      for (const term of queryTerms) {
        if (term.length < 2) continue;
        if (content.includes(term)) matchScore += 12;
        if (summary.includes(term)) matchScore += 18;
        if (category.includes(term)) matchScore += 10;
        if (tags.includes(term)) matchScore += 6;
      }

      if (matchScore < 1) {
        return;
      }

      matches.push({
        id: entry.id,
        createdAt: entry.createdAt,
        category: entry.category,
        summary: entry.summary,
        content: preview(entry.content),
        trustLevel: entry.trustLevel,
        status: entry.status,
        tags: entry.tags ? [...entry.tags] : undefined,
        provenance: entry.provenance ? { ...entry.provenance } as Record<string, unknown> : undefined,
        matchScore,
        recencyIndex: index,
        fullComparableHit,
        matchedIdentifierCount,
      });
    });

    const filtered = identifierFragments.length > 0
      ? matches.filter((entry) => entry.matchedIdentifierCount > 0)
      : (matches.some((entry) => entry.fullComparableHit)
          ? matches.filter((entry) => entry.fullComparableHit)
          : matches);

    return filtered
      .sort((a, b) => b.matchScore - a.matchScore || a.recencyIndex - b.recencyIndex)
      .slice(0, limit)
      .map(({ recencyIndex: _recencyIndex, fullComparableHit: _fullComparableHit, matchedIdentifierCount: _matchedIdentifierCount, ...entry }) => entry);
  }

  private normalizePersistentMemorySearchText(value: string): string {
    return value
      .toLowerCase()
      .replace(/\s*-\s*/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractPersistentMemorySearchTerms(value: string): string[] {
    return [...new Set(
      value
        .split(/[^a-z0-9]+/)
        .map((term) => term.trim())
        .filter((term) => term.length >= 2),
    )];
  }

  private extractPersistentMemorySearchIdentifiers(query: string): string[] {
    return [...new Set(
      query
        .split(/\b(?:and|or)\b|[,;]+/i)
        .map((fragment) => this.buildPersistentMemoryComparable(fragment))
        .filter((fragment) => fragment.length >= 10 && /\d/.test(fragment)),
    )];
  }

  private buildPersistentMemoryComparable(value: string): string {
    return value.replace(/[^a-z0-9]+/g, '');
  }

  private normalizeMemorySearchScope(input: unknown): 'conversation' | 'persistent' | 'both' | null {
    const scope = asString(input, 'both').trim().toLowerCase();
    if (scope === 'conversation' || scope === 'persistent' || scope === 'both') {
      return scope;
    }
    return null;
  }

  private normalizePersistentMemoryScope(
    input: unknown,
    request?: Partial<ToolExecutionRequest>,
    fallbackScope?: 'global' | 'code_session' | 'both',
  ): 'global' | 'code_session' | 'both' | null {
    const explicit = typeof input === 'string' && input.trim().length > 0;
    const fallback = fallbackScope ?? (request?.codeContext?.sessionId?.trim() ? 'both' : 'global');
    const scope = asString(input, explicit ? '' : fallback).trim().toLowerCase();
    if (!scope) return fallback;
    if (scope === 'global' || scope === 'code_session' || scope === 'both') {
      return scope;
    }
    return null;
  }

  private normalizeMemoryMutationScope(input: unknown): 'global' | 'code_session' | null {
    const scope = asString(input, 'global').trim().toLowerCase();
    if (scope === 'global' || scope === 'code_session') {
      return scope;
    }
    return null;
  }

  private resolvePersistentMemoryContexts(
    targetScope: 'global' | 'code_session' | 'both',
    sessionId: string | undefined,
    request?: Partial<ToolExecutionRequest>,
    explicitGlobalAgentId?: string,
  ): { contexts: PersistentMemoryContextTarget[]; error?: string } {
    const contexts: PersistentMemoryContextTarget[] = [];
    if (targetScope === 'global' || targetScope === 'both') {
      const globalMemory = this.getGlobalMemoryContext(request, explicitGlobalAgentId);
      contexts.push({
        source: 'global',
        id: globalMemory.agentId,
        store: globalMemory.store,
        guardPath: 'memory:knowledge_base',
      });
    }
    if (targetScope === 'code_session' || targetScope === 'both') {
      const codeMemory = this.resolveCodeSessionMemoryContext(sessionId, request);
      if (!codeMemory) {
        return {
          contexts,
          error: 'A reachable code session is required to access code-session memory.',
        };
      }
      contexts.push({
        source: 'code_session',
        id: codeMemory.sessionId,
        store: codeMemory.store,
        guardPath: `memory:code_session:${codeMemory.sessionId}`,
      });
    }
    return { contexts };
  }

  private fuseRankedMemorySearchResults(
    sources: UnifiedMemorySearchCandidate[][],
    limit: number,
  ): Array<UnifiedMemorySearchCandidate & { score: number; rank: number }> {
    const fused = new Map<string, { item: UnifiedMemorySearchCandidate; score: number }>();
    const reciprocalRankOffset = 60;

    for (const source of sources) {
      source.forEach((item, index) => {
        const contribution = 1 / (reciprocalRankOffset + index + 1);
        const existing = fused.get(item.key);
        if (existing) {
          existing.score += contribution;
        } else {
          fused.set(item.key, { item, score: contribution });
        }
      });
    }

    return [...fused.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((entry, index) => ({
        ...entry.item,
        score: Number(entry.score.toFixed(6)),
        rank: index + 1,
      }));
  }

  private summarizeCodeSession(session: {
    id: string;
    title: string;
    workspaceRoot: string;
    resolvedRoot: string;
    agentId: string | null;
    status: string;
    lastActivityAt: number;
    workState: {
      focusSummary: string;
      planSummary: string;
      compactedSummary: string;
      pendingApprovals: unknown[];
      recentJobs: unknown[];
      activeSkills: string[];
      workspaceProfile?: {
        repoName?: string;
        repoKind?: string;
        summary?: string;
        stack?: string[];
      } | null;
      workspaceMap?: {
        indexedFileCount?: number;
        totalDiscoveredFiles?: number;
        truncated?: boolean;
        notableFiles?: string[];
      } | null;
      workingSet?: {
        query?: string;
        rationale?: string;
        files?: Array<{ path?: string }>;
      } | null;
    };
  }) {
    const pendingApprovals = Array.isArray(session.workState.pendingApprovals)
      ? session.workState.pendingApprovals.length
      : 0;
    const recentJobs = Array.isArray(session.workState.recentJobs)
      ? session.workState.recentJobs.length
      : 0;
    return {
      id: session.id,
      title: session.title,
      workspaceRoot: session.workspaceRoot,
      resolvedRoot: session.resolvedRoot,
      agentId: session.agentId,
      status: session.status,
      lastActivityAt: session.lastActivityAt,
      pendingApprovalCount: pendingApprovals,
      recentJobCount: recentJobs,
      activeSkills: Array.isArray(session.workState.activeSkills) ? [...session.workState.activeSkills] : [],
      focusSummary: session.workState.focusSummary || '',
      planSummary: session.workState.planSummary || '',
      compactedSummary: session.workState.compactedSummary || '',
      workspaceProfile: session.workState.workspaceProfile
        ? {
            repoName: session.workState.workspaceProfile.repoName || '',
            repoKind: session.workState.workspaceProfile.repoKind || '',
            summary: session.workState.workspaceProfile.summary || '',
            stack: Array.isArray(session.workState.workspaceProfile.stack)
              ? [...session.workState.workspaceProfile.stack]
              : [],
          }
        : null,
      workspaceMap: session.workState.workspaceMap
        ? {
            indexedFileCount: Number(session.workState.workspaceMap.indexedFileCount) || 0,
            totalDiscoveredFiles: Number(session.workState.workspaceMap.totalDiscoveredFiles) || 0,
            truncated: !!session.workState.workspaceMap.truncated,
            notableFiles: Array.isArray(session.workState.workspaceMap.notableFiles)
              ? [...session.workState.workspaceMap.notableFiles]
              : [],
          }
        : null,
      workingSet: session.workState.workingSet
        ? {
            query: session.workState.workingSet.query || '',
            rationale: session.workState.workingSet.rationale || '',
            files: Array.isArray(session.workState.workingSet.files)
              ? session.workState.workingSet.files.map((entry) => ({ path: entry.path || '' }))
              : [],
          }
        : null,
    };
  }

  private buildCodeShellEnv(workspaceRoot: string): Record<string, string> {
    const cacheRoot = resolve(workspaceRoot, '.guardianagent', 'cache');
    return {
      npm_config_cache: resolve(cacheRoot, 'npm'),
      NPM_CONFIG_CACHE: resolve(cacheRoot, 'npm'),
      YARN_CACHE_FOLDER: resolve(cacheRoot, 'yarn'),
      PNPM_STORE_DIR: resolve(cacheRoot, 'pnpm'),
      PIP_CACHE_DIR: resolve(cacheRoot, 'pip'),
      UV_CACHE_DIR: resolve(cacheRoot, 'uv'),
      CARGO_HOME: resolve(cacheRoot, 'cargo'),
      RUSTUP_HOME: resolve(cacheRoot, 'rustup'),
      GOCACHE: resolve(cacheRoot, 'go-build'),
      GOMODCACHE: resolve(cacheRoot, 'go-mod'),
      BUNDLE_PATH: resolve(cacheRoot, 'bundle'),
      COMPOSER_HOME: resolve(cacheRoot, 'composer'),
      DOTNET_CLI_HOME: resolve(cacheRoot, 'dotnet'),
    };
  }

  private looksLikePathToken(token: string): boolean {
    if (!token) return false;
    if (token === '.' || token === '..') return true;
    if (token.startsWith('./') || token.startsWith('../')) return true;
    if (token.startsWith('~')) return true;
    if (token.includes('/') || token.includes('\\')) return true;
    return /^[a-zA-Z]:[\\/]/.test(token);
  }

  private isCodePathTokenDenied(token: string, workspaceRoot: string, cwd: string): boolean {
    const trimmed = token.trim();
    if (!trimmed) return false;
    if (!this.looksLikePathToken(trimmed)) return false;
    if (trimmed.startsWith('~')) return true;
    const normalized = normalizePathForHost(trimmed);
    const resolvedTokenPath = isAbsolute(normalized)
      ? resolve(normalized)
      : resolve(cwd, normalized);
    return !isPathInside(resolvedTokenPath, workspaceRoot);
  }

  private getCodeShellTokenBlockReason(commands: ParsedCommand[]): string | undefined {
    for (const command of commands) {
      for (const token of command.args) {
        const exact = CODE_DISALLOWED_SHELL_TOKENS.get(token);
        if (exact) return exact;
        for (const [prefix, reason] of CODE_DISALLOWED_SHELL_TOKEN_PREFIXES.entries()) {
          if (token.startsWith(prefix)) return reason;
        }
      }
    }
    return undefined;
  }

  private getShellBuiltinCommands(): ReadonlySet<string> {
    return process.platform === 'win32' ? WINDOWS_SHELL_BUILTINS : POSIX_SHELL_BUILTINS;
  }

  private buildShellCommandPlan(commands: ParsedCommand[]): ShellCommandPlan {
    const entry = commands[0]!;
    const entryCommand = entry.command;
    const argv = [...entry.args];
    const requestedViaShell = commands.length > 1
      || entry.redirects.length > 0
      || this.getShellBuiltinCommands().has(normalizeShellCommandName(entryCommand));

    return {
      commands,
      entryCommand,
      argv,
      executionClass: classifyParsedCommandExecution(entry),
      requestedViaShell,
      execMode: requestedViaShell ? 'shell_fallback' : 'direct_exec',
    };
  }

  private async canExecuteResolvedPath(candidate: string): Promise<boolean> {
    try {
      const info = await stat(candidate);
      if (!info.isFile()) {
        return false;
      }
      if (process.platform === 'win32') {
        return true;
      }
      await access(candidate, fsConstants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  private getEnvPathValue(env?: Record<string, string>): string {
    return env?.PATH
      ?? env?.Path
      ?? env?.path
      ?? process.env.PATH
      ?? process.env.Path
      ?? '';
  }

  private getWindowsPathExtensions(env?: Record<string, string>): string[] {
    const pathExt = env?.PATHEXT ?? process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD';
    return pathExt
      .split(';')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => value.toLowerCase());
  }

  private async resolveShellExecutable(
    entryCommand: string,
    cwd: string,
    env?: Record<string, string>,
  ): Promise<string | undefined> {
    const trimmed = entryCommand.trim();
    if (!trimmed) return undefined;

    if (this.looksLikePathToken(trimmed)) {
      const normalized = normalizePathForHost(trimmed);
      const candidate = isAbsolute(normalized)
        ? resolve(normalized)
        : resolve(cwd, normalized);
      return await this.canExecuteResolvedPath(candidate) ? candidate : undefined;
    }

    const pathEntries = this.getEnvPathValue(env)
      .split(delimiter)
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (pathEntries.length === 0) {
      return undefined;
    }

    const hasExtension = /\.[^\\/]+$/.test(trimmed);
    const windowsExts = process.platform === 'win32'
      ? (hasExtension ? [''] : this.getWindowsPathExtensions(env))
      : [''];

    for (const dir of pathEntries) {
      for (const ext of windowsExts) {
        const candidate = resolve(dir, process.platform === 'win32' ? `${trimmed}${ext}` : trimmed);
        if (await this.canExecuteResolvedPath(candidate)) {
          return candidate;
        }
      }
    }

    return undefined;
  }

  private async finalizeShellCommandPlan(
    plan: ShellCommandPlan,
    cwd: string,
    env?: Record<string, string>,
  ): Promise<ShellCommandPlan> {
    const resolvedExecutable = await this.resolveShellExecutable(plan.entryCommand, cwd, env);
    if (process.platform !== 'win32') {
      return { ...plan, resolvedExecutable };
    }

    if (plan.execMode !== 'direct_exec') {
      return { ...plan, resolvedExecutable };
    }

    const lowerResolved = resolvedExecutable?.toLowerCase() ?? '';
    const nativeExecutable = lowerResolved && [...WINDOWS_DIRECT_EXECUTABLE_EXTENSIONS].some((ext) => lowerResolved.endsWith(ext));
    if (!nativeExecutable) {
      return {
        ...plan,
        resolvedExecutable,
        execMode: 'shell_fallback',
      };
    }

    return { ...plan, resolvedExecutable };
  }

  private validateShellCommandForRequest(
    command: string,
    request?: Partial<ToolExecutionRequest>,
    cwd?: string,
  ): ShellCommandCheck {
    const allowedCommands = this.getEffectiveAllowedCommands(request);
    const codeWorkspaceRoot = this.getCodeWorkspaceRoot(request);
    if (!codeWorkspaceRoot) {
      const shellCheck = sanitizeShellArgs(command, allowedCommands);
      if (!shellCheck.safe) {
        return shellCheck;
      }
      try {
        const commands = splitCommands(tokenize(command));
        if (commands.length === 0) {
          return { safe: false, reason: 'Command failed shell parsing.' };
        }
        return { safe: true, plan: this.buildShellCommandPlan(commands) };
      } catch {
        return { safe: false, reason: 'Command failed shell parsing.' };
      }
    }

    const effectiveCwd = cwd ?? codeWorkspaceRoot;
    const validation = validateShellCommand(
      command,
      allowedCommands,
      (candidate) => this.isCodePathTokenDenied(candidate, codeWorkspaceRoot, effectiveCwd),
    );
    if (!validation.valid) {
      return {
        safe: false,
        reason: validation.reason ?? 'Command failed Coding Workspace shell validation.',
      };
    }

    const tokenBlockReason = this.getCodeShellTokenBlockReason(validation.commands);
    if (tokenBlockReason) {
      return { safe: false, reason: tokenBlockReason };
    }

    const executionIdentityReason = getExecutionIdentityBlockReason(validation.commands);
    if (executionIdentityReason) {
      return { safe: false, reason: executionIdentityReason };
    }

    return { safe: true, plan: this.buildShellCommandPlan(validation.commands) };
  }

  /**
   * Pre-flight validation: check what approval decision each tool would get
   * under the current policy, and suggest fixes the user can apply.
   */
  preflightTools(requests: ToolPreflightRequest[]): ToolPreflightResult[] {
    return requests.map((request) => {
      const name = typeof request === 'string' ? request : request.name;
      const args = isRecord(request) && isRecord(request.args) ? request.args : {};
      const entry = this.registry.get(name);
      if (!entry) {
        return { name, found: false, risk: 'unknown', decision: 'deny' as const, reason: 'Tool not found', fixes: [] };
      }
      const def = entry.definition;
      const baseDecision = this.decide(def, args);
      let decision = baseDecision;
      const fixes: ToolPreflightFix[] = [];

      if (baseDecision === 'require_approval') {
        // Suggest per-tool auto policy override
        fixes.push({
          type: 'tool_policy',
          value: name,
          description: `Set per-tool policy for "${name}" to auto-approve`,
        });
      }

      const sandboxCheck = this.preflightSandbox(def.name, args);
      let reason = this.describePreflightDecision(def, name, baseDecision);
      if (sandboxCheck) {
        decision = 'deny';
        reason = baseDecision === 'require_approval'
          ? `${sandboxCheck.reason} Also requires approval under the current tool policy.`
          : sandboxCheck.reason;
        if (sandboxCheck.fix) fixes.push(sandboxCheck.fix);
      }

      return { name, found: true, risk: def.risk, decision, reason, fixes };
    });
  }

  private describePreflightDecision(definition: ToolDefinition, name: string, decision: ToolDecision): string {
    if (decision === 'allow') {
      if (isDirectMemoryMutationToolName(name)) {
        return 'Direct memory writes auto-approve after explicit remember intent and trust checks.';
      }
      return definition.risk === 'read_only' ? 'Read-only tool, auto-approved' : 'Approved by current policy';
    }
    if (decision === 'deny') {
      const explicit = this.policy.toolPolicies[name];
      return explicit === 'deny' ? 'Explicitly denied by per-tool policy' : 'Blocked by tool policy';
    }
    if (isElevatedMemoryMutationToolName(name)) {
      return 'Elevated memory mutations require approval.';
    }
    if (definition.risk === 'external_post') {
      return 'External post tools always require approval';
    }
    if (definition.risk === 'mutating') {
      return `Mutating tool requires approval in "${this.policy.mode}" mode`;
    }
    return `Tool risk "${definition.risk}" requires approval in "${this.policy.mode}" mode`;
  }

  private preflightSandbox(toolName: string, args: Record<string, unknown>): { reason: string; fix?: ToolPreflightFix } | null {
    if (toolName === 'package_install') {
      const command = asString(args.command).trim();
      if (!command) return null;
      const degradedPackageManagerReason = this.getDegradedPackageManagerBlockReason(command);
      if (degradedPackageManagerReason) {
        return { reason: degradedPackageManagerReason };
      }
      const planned = parseManagedPackageInstallCommand(command);
      if (!planned.success) {
        return { reason: planned.error ?? 'Managed package install planning failed.' };
      }
      return null;
    }

    const pathCheck = this.preflightPathArgs(args);
    if (pathCheck) return pathCheck;

    const commandCheck = this.preflightCommandArgs(args);
    if (commandCheck) return commandCheck;

    const hostCheck = this.preflightHostArgs(toolName, args);
    if (hostCheck) return hostCheck;

    return null;
  }

  private preflightPathArgs(args: Record<string, unknown>): { reason: string; fix?: ToolPreflightFix } | null {
    const keys = ['path', 'filePath', 'targetPath', 'outputPath', 'workspacePath', 'csvPath'];
    for (const key of keys) {
      const value = args[key];
      if (typeof value !== 'string' || !value.trim()) continue;
      if (this.isPathAllowedForPreflight(value)) continue;
      return {
        reason: `Path '${value}' is not in allowedPaths.`,
        fix: {
          type: 'path',
          value,
          description: `Add '${value}' to allowed paths`,
        },
      };
    }
    return null;
  }

  private preflightCommandArgs(args: Record<string, unknown>): { reason: string; fix?: ToolPreflightFix } | null {
    const keys = ['command', 'cmd'];
    for (const key of keys) {
      const value = args[key];
      if (typeof value !== 'string' || !value.trim()) continue;
      const normalized = value.trim();
      const degradedPackageManagerReason = this.getDegradedPackageManagerBlockReason(normalized);
      if (degradedPackageManagerReason) {
        return { reason: degradedPackageManagerReason };
      }
      const shellCheck = sanitizeShellArgs(normalized, this.policy.sandbox.allowedCommands);
      if (shellCheck.safe) continue;
      const isAllowlistMiss = shellCheck.reason === `Command is not allowlisted: '${normalized}'.`;
      return isAllowlistMiss
        ? {
          reason: `Command '${normalized}' is not in allowedCommands.`,
          fix: {
            type: 'command',
            value: normalized,
            description: `Add '${normalized}' to allowed commands`,
          },
        }
        : {
          reason: shellCheck.reason ?? `Command '${normalized}' failed shell validation.`,
        };
    }
    return null;
  }

  private getDegradedPackageManagerBlockReason(command: string): string | null {
    if (!isDegradedSandboxFallbackActive(this.sandboxConfig, this.sandboxHealth)) return null;
    if (resolveDegradedFallbackConfig(this.sandboxConfig).allowPackageManagers) return null;
    const tokens = tokenize(command).map((token) => token.toLowerCase());
    if (tokens.length === 0) return null;

    const [first, second, third, fourth] = tokens;
    const isInstallLike = (
      first === 'npx'
      || (first === 'npm' && ['install', 'i', 'ci', 'add', 'update', 'exec'].includes(second ?? ''))
      || (first === 'pnpm' && ['install', 'i', 'add', 'dlx', 'update', 'up'].includes(second ?? ''))
      || (first === 'yarn' && ['install', 'add', 'dlx', 'upgrade', 'up'].includes(second ?? ''))
      || (first === 'bun' && ['install', 'add', 'x'].includes(second ?? ''))
      || ((first === 'pip' || first === 'pip3') && ['install', 'download'].includes(second ?? ''))
      || ((first === 'python' || first === 'python3') && second === '-m' && third === 'pip' && ['install', 'download'].includes(fourth ?? ''))
      || (first === 'uv' && (
        ['add', 'sync'].includes(second ?? '')
        || (second === 'pip' && ['install', 'sync'].includes(third ?? ''))
        || (second === 'tool' && ['install', 'run'].includes(third ?? ''))
      ))
      || (first === 'cargo' && ['install', 'add'].includes(second ?? ''))
      || (first === 'go' && ['get', 'install'].includes(second ?? ''))
      || (first === 'composer' && ['install', 'require', 'update'].includes(second ?? ''))
      || (first === 'bundle' && second === 'install')
      || (first === 'gem' && second === 'install')
      || (first === 'dotnet' && ['restore', 'add', 'tool'].includes(second ?? ''))
    );

    if (!isInstallLike) return null;
    return `Install-like package manager commands are blocked on degraded sandbox backends unless ${DEGRADED_PACKAGE_MANAGER_HINT} is enabled.`;
  }

  private preflightHostArgs(toolName: string, args: Record<string, unknown>): { reason: string; fix?: ToolPreflightFix } | null {
    const explicitHost = this.extractHostFromArgs(args);
    if (explicitHost) {
      if (explicitHost.invalidValue) {
        return {
          reason: `Invalid URL '${explicitHost.invalidValue}'.`,
        };
      }
      const host = explicitHost.host;
      if (!host) return null;
      if (isPrivateAddress(host)) {
        return {
          reason: `Blocked: ${host} is a private/internal address (SSRF protection).`,
        };
      }
      if (!this.isHostAllowedForTool(toolName, host)) {
        return {
          reason: this.isBrowserFacingTool(toolName)
            ? `Host '${host}' is not in the browser allowedDomains.`
            : `Host '${host}' is not in allowedDomains.`,
          fix: {
            type: 'domain',
            value: host,
            description: this.isBrowserFacingTool(toolName)
              ? `Add '${host}' to browser allowed domains`
              : `Add '${host}' to allowed domains`,
          },
        };
      }
      return null;
    }

    if (toolName === 'web_search') {
      const provider = this.resolveSearchProvider(asString(args.provider, 'auto'));
      const blocked = this.getWebSearchRequiredHosts(provider).find((host) => !this.isHostAllowed(host));
      if (blocked) {
        return {
          reason: `Web search provider '${provider}' is blocked by allowedDomains.`,
          fix: {
            type: 'domain',
            value: blocked,
            description: `Add '${blocked}' to allowed domains`,
          },
        };
      }
    }

    return null;
  }

  private extractHostFromArgs(args: Record<string, unknown>): { host: string; invalidValue?: undefined } | { host?: undefined; invalidValue: string } | null {
    const keys = ['url', 'baseUrl', 'endpoint', 'targetUrl'];
    for (const key of keys) {
      const value = args[key];
      if (typeof value !== 'string' || !value.trim()) continue;
      try {
        return { host: new URL(normalizeHttpUrlLikeInput(value)).hostname.toLowerCase() };
      } catch {
        return { invalidValue: value };
      }
    }
    return null;
  }

  private isBrowserFacingTool(toolName: string): boolean {
    return toolName.startsWith('browser_') || isBrowserMcpToolName(toolName);
  }

  private isAssistantVisibleTool(definition: ToolDefinition): boolean {
    return !isBrowserMcpToolName(definition.name);
  }

  private getBrowserAllowedDomains(): string[] {
    return this.options.browserConfig?.allowedDomains?.length
      ? this.options.browserConfig.allowedDomains
      : this.policy.sandbox.allowedDomains;
  }

  private getExplicitBrowserAllowedDomains(): string[] | null {
    return Array.isArray(this.options.browserConfig?.allowedDomains) && this.options.browserConfig.allowedDomains.length > 0
      ? [...this.options.browserConfig.allowedDomains]
      : null;
  }

  private isHostAllowedForTool(toolName: string, host: string): boolean {
    return this.isBrowserFacingTool(toolName)
      ? this.isHostAllowed(host, this.getBrowserAllowedDomains())
      : this.isHostAllowed(host);
  }

  private isPathAllowedForPreflight(candidate: string): boolean {
    const trimmed = candidate.trim();
    if (!trimmed) return false;
    const normalizedCandidate = this.normalizePreflightPath(trimmed);
    const roots = this.policy.sandbox.allowedPaths.length > 0
      ? this.policy.sandbox.allowedPaths
      : [this.options.workspaceRoot];
    return roots.some((root) => {
      const normalizedRoot = this.normalizePreflightPath(root);
      return normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(`${normalizedRoot}/`);
    });
  }

  private normalizePreflightPath(value: string): string {
    const resolvedPath = isAbsolute(value) ? resolve(value) : resolve(this.options.workspaceRoot, value);
    return resolvedPath.replaceAll('\\', '/').toLowerCase();
  }

  private getWebSearchRequiredHosts(provider: 'duckduckgo' | 'brave' | 'perplexity'): string[] {
    return provider === 'duckduckgo'
      ? ['html.duckduckgo.com']
      : provider === 'brave'
        ? ['api.search.brave.com']
        : this.webSearchConfig.perplexityApiKey
          ? ['api.perplexity.ai']
          : ['openrouter.ai'];
  }

  updateWebSearchConfig(cfg: WebSearchConfig): void {
    this.webSearchConfig = { ...cfg };
    // Clear cache so new provider takes effect immediately
    this.searchCache.clear();
  }

  /** Check whether a tool category is enabled. Undefined category remains enabled. */
  private isCategoryEnabled(category?: string): boolean {
    if (!category) return true;
    return !this.disabledCategories.has(category);
  }

  /** Return info about all 10 tool categories with current enable/disable status. */
  getCategoryInfo(): Array<{
    category: ToolCategory;
    label: string;
    description: string;
    toolCount: number;
    enabled: boolean;
    disabledReason?: string;
  }> {
    return (Object.keys(TOOL_CATEGORIES) as ToolCategory[]).map((cat) => ({
      category: cat,
      label: TOOL_CATEGORIES[cat].label,
      description: TOOL_CATEGORIES[cat].description,
      toolCount: BUILTIN_TOOL_CATEGORIES[cat].length,
      enabled: !this.disabledCategories.has(cat) && !this.getSandboxBlockedCategoryReason(cat),
      disabledReason: this.disabledCategories.has(cat)
        ? 'Disabled by policy.'
        : this.getSandboxBlockedCategoryReason(cat) ?? undefined,
    }));
  }

  /** Get currently disabled categories. */
  getDisabledCategories(): ToolCategory[] {
    return [...this.disabledCategories] as ToolCategory[];
  }

  /** Enable or disable a tool category at runtime (no restart required). */
  setCategoryEnabled(category: ToolCategory, enabled: boolean): void {
    if (enabled) {
      this.disabledCategories.delete(category);
    } else {
      this.disabledCategories.add(category);
    }
  }

  /** Dispose resources. Call on shutdown. */
  async dispose(): Promise<void> {
    // Browser sessions are now managed by MCP servers (no local cleanup needed)
    this.options.codingBackendService?.dispose();
  }

  listJobs(limit = 50): ToolJobRecord[] {
    return this.jobs.slice(0, Math.max(1, limit));
  }

  listApprovals(limit = 50, status?: 'pending' | 'approved' | 'denied') {
    return this.approvals.list(Math.min(MAX_APPROVALS, Math.max(1, limit)), status);
  }

  listPendingApprovalIdsForUser(
    userId: string | undefined,
    channel: string | undefined,
    options?: { includeUnscoped?: boolean; limit?: number; principalId?: string },
  ): string[] {
    const normalizedUserId = (userId ?? '').trim();
    const normalizedChannel = (channel ?? '').trim();
    const normalizedPrincipalId = (options?.principalId ?? '').trim();
    const includeUnscoped = options?.includeUnscoped === true;
    const limit = Math.min(MAX_APPROVALS, Math.max(1, options?.limit ?? MAX_APPROVALS));
    const pending = this.approvals.list(limit, 'pending');
    const ids: string[] = [];

    for (const approval of pending) {
      const job = this.jobsById.get(approval.jobId);
      if (!job) continue;
      const jobUserId = (job.userId ?? '').trim();
      const jobPrincipalId = (job.principalId ?? approval.requestedByPrincipal ?? '').trim();
      const jobChannel = (job.channel ?? '').trim();
      const scopedMatch = normalizedUserId.length > 0
        && normalizedChannel.length > 0
        && jobUserId === normalizedUserId
        && jobChannel === normalizedChannel;
      const principalMatch = normalizedPrincipalId.length > 0 && jobPrincipalId === normalizedPrincipalId;
      const unscopedMatch = includeUnscoped && jobUserId.length === 0 && jobChannel.length === 0;
      if ((principalMatch && (normalizedChannel.length === 0 || jobChannel === normalizedChannel)) || scopedMatch || unscopedMatch) {
        ids.push(approval.id);
      }
    }

    return ids;
  }

  listJobsForCodeSession(codeSessionId: string, limit = 50): ToolJobRecord[] {
    const normalizedCodeSessionId = codeSessionId.trim();
    if (!normalizedCodeSessionId) return [];
    return this.jobs
      .filter((job) => job.codeSessionId === normalizedCodeSessionId)
      .slice(0, Math.max(1, limit));
  }

  listPendingApprovalsForCodeSession(
    codeSessionId: string,
    limit = 50,
  ): Array<{
    id: string;
    toolName: string;
    argsPreview: string;
    createdAt: number;
    risk: ToolDefinition['risk'];
    origin: ToolApprovalRequest['origin'];
    jobId?: string;
    requestId?: string;
  }> {
    const normalizedCodeSessionId = codeSessionId.trim();
    if (!normalizedCodeSessionId) return [];
    return this.approvals
      .list(Math.min(MAX_APPROVALS, Math.max(1, limit)), 'pending')
      .filter((approval) => approval.codeSessionId === normalizedCodeSessionId)
      .map((approval) => {
        const job = this.jobsById.get(approval.jobId);
        return {
          id: approval.id,
          toolName: approval.toolName,
          argsPreview: job?.argsPreview ?? JSON.stringify(approval.args).slice(0, 120),
          createdAt: approval.createdAt,
          risk: approval.risk,
          origin: approval.origin,
          jobId: approval.jobId,
          requestId: job?.requestId,
        };
      });
  }

  approvalBelongsToCodeSession(approvalId: string, codeSessionId: string): boolean {
    const normalizedApprovalId = approvalId.trim();
    const normalizedCodeSessionId = codeSessionId.trim();
    if (!normalizedApprovalId || !normalizedCodeSessionId) return false;
    const approval = this.approvals.get(normalizedApprovalId);
    if (!approval) return false;
    if (approval.codeSessionId) return approval.codeSessionId === normalizedCodeSessionId;
    const job = this.jobsById.get(approval.jobId);
    return job?.codeSessionId === normalizedCodeSessionId;
  }

  /** Return approval ID → tool name + args preview for display in approval prompts. */
  getApprovalSummaries(approvalIds: string[]): Map<string, { toolName: string; argsPreview: string }> {
    const result = new Map<string, { toolName: string; argsPreview: string }>();
    for (const id of approvalIds) {
      const pending = this.approvals.list(MAX_APPROVALS, 'pending');
      const approval = pending.find(a => a.id === id);
      if (approval) {
        const job = this.jobsById.get(approval.jobId);
        result.set(id, {
          toolName: approval.toolName,
          argsPreview: job?.argsPreview ?? JSON.stringify(approval.args).slice(0, 120),
        });
      }
    }
    return result;
  }

  async runTool(request: ToolExecutionRequest): Promise<ToolRunResponse> {
    if (!this.options.enabled) {
      return {
        success: false,
        status: 'denied',
        jobId: randomUUID(),
        message: 'Tools are disabled.',
      };
    }

    const args = request.args ?? {};
    const entry = this.registry.get(request.toolName);
    if (!entry) {
      return {
        success: false,
        status: 'failed',
        jobId: randomUUID(),
        message: `Unknown tool '${request.toolName}'.`,
      };
    }

    // Defense-in-depth: block tools in disabled categories even if registered
    if (!this.isCategoryEnabled(entry.definition.category)) {
      return {
        success: false,
        status: 'denied',
        jobId: randomUUID(),
        message: `Tool '${request.toolName}' is in disabled category '${entry.definition.category}'.`,
      };
    }

    const sandboxBlockReason = this.getSandboxBlockReason(entry.definition.name, entry.definition.category);
    if (sandboxBlockReason) {
      return {
        success: false,
        status: 'denied',
        jobId: randomUUID(),
        message: sandboxBlockReason,
      };
    }

    const sizeValidation = validateArgSize(args, MAX_TOOL_ARG_BYTES);
    if (!sizeValidation.valid) {
      return {
        success: false,
        status: 'failed',
        jobId: randomUUID(),
        message: sizeValidation.reason ?? 'Tool arguments exceeded the maximum size.',
      };
    }

    const job = this.createJob(entry.definition, request, args);
    const toolChainBudgetError = this.consumeToolChainBudget(entry.definition, request, job.argsHash);
    if (toolChainBudgetError) {
      job.status = 'denied';
      job.completedAt = this.now();
      job.durationMs = 0;
      job.error = sanitizePreview(toolChainBudgetError);
      this.recordToolChainOutcome(entry.definition, request, job.argsHash, job.status);
      return {
        success: false,
        status: job.status,
        jobId: job.id,
        message: toolChainBudgetError,
      };
    }
    const argsValidationError = this.validateToolArgs(entry.definition, args);
    if (argsValidationError) {
      job.status = 'failed';
      job.completedAt = this.now();
      job.durationMs = 0;
      job.error = sanitizePreview(argsValidationError);
      this.recordToolChainOutcome(entry.definition, request, job.argsHash, job.status);
      return {
        success: false,
        status: job.status,
        jobId: job.id,
        message: job.error,
      };
    }

    const memoryMutationIntentError = this.getMemoryMutationIntentError(entry.definition.name, request);
    if (memoryMutationIntentError) {
      job.status = 'denied';
      job.completedAt = this.now();
      job.durationMs = 0;
      job.error = sanitizePreview(memoryMutationIntentError);
      this.recordToolChainOutcome(entry.definition, request, job.argsHash, job.status);
      return {
        success: false,
        status: job.status,
        jobId: job.id,
        message: memoryMutationIntentError,
      };
    }

    const preApprovalError = await this.validateBeforeApproval(entry.definition.name, args, request);
    if (preApprovalError) {
      job.status = 'failed';
      job.completedAt = this.now();
      job.durationMs = 0;
      job.error = sanitizePreview(preApprovalError);
      this.recordToolChainOutcome(entry.definition, request, job.argsHash, job.status);
      return {
        success: false,
        status: job.status,
        jobId: job.id,
        message: preApprovalError,
      };
    }

    const decision = this.decide(entry.definition, args, request);
    if (decision === 'deny') {
      job.status = 'denied';
      job.completedAt = this.now();
      job.durationMs = 0;
      job.error = 'Blocked by tool policy.';
      this.recordToolChainOutcome(entry.definition, request, job.argsHash, job.status);
      return {
        success: false,
        status: job.status,
        jobId: job.id,
        message: job.error,
      };
    }

    if (decision === 'require_approval') {
      if (request.bypassApprovals) {
        return await this.execute(job, request, args, entry.handler);
      }

      // Caching / Retry Loop Fix: If the LLM just retried the exact same tool
      // call after it was already approved and executed, return the previous result.
      if (job.argsHash) {
        const recentApproved = this.approvals.list(50, 'approved').find(
          (a) => a.toolName === job.toolName
            && a.argsHash === job.argsHash
            && (a.codeSessionId ?? '') === (job.codeSessionId ?? '')
            && a.decidedAt
            && (this.now() - a.decidedAt) < 5 * 60_000
        );
        if (recentApproved) {
          const oldJob = this.jobsById.get(recentApproved.jobId);
          if (oldJob && oldJob.status === 'succeeded') {
            job.status = 'succeeded';
            job.completedAt = this.now();
            job.durationMs = 0;
            job.resultPreview = oldJob.resultPreview;
            return {
              success: true,
              status: 'succeeded',
              jobId: job.id,
              message: oldJob.resultPreview || 'Already approved and executed successfully.',
            };
          } else if (oldJob && oldJob.status === 'failed') {
            job.status = 'failed';
            job.completedAt = this.now();
            job.durationMs = 0;
            job.error = oldJob.error;
            return {
              success: false,
              status: 'failed',
              jobId: job.id,
              message: oldJob.error || 'Previously failed execution.',
            };
          }
          // If approved but somehow pending execution, execute it now!
          return await this.execute(job, request, args, entry.handler);
        }
      }

      const redactedArgs = redactSensitiveValue(args);
      const approvalArgs = isRecord(redactedArgs) ? redactedArgs : {};
      const approval = this.approvals.create(
        job,
        approvalArgs,
        job.argsHash,
        request.principalId ?? request.userId,
        request.principalRole ?? 'owner',
        this.now,
      );
      job.status = 'pending_approval';
      job.approvalId = approval.id;
      this.pendingApprovalContexts.set(approval.id, { request, args });
      return {
        success: false,
        status: job.status,
        jobId: job.id,
        approvalId: approval.id,
        message: `Tool '${request.toolName}' is awaiting approval.`,
      };
    }

    const result = await this.execute(job, request, args, entry.handler);
    return result;
  }

  async decideApproval(
    approvalId: string,
    decision: 'approved' | 'denied',
    actor: string,
    actorRole: import('./types.js').PrincipalRole = 'owner',
    reason?: string,
  ): Promise<ToolApprovalDecisionResult> {
    const approval = this.approvals.decide(approvalId, decision, actor, actorRole, reason, this.now);
    if (!approval) {
      return { success: false, message: `Approval '${approvalId}' not found.` };
    }
    if (approval.status === 'pending') {
      return { success: false, message: approval.reason ?? `Approval '${approvalId}' is not authorized for actor '${actor}'.` };
    }

    const job = this.jobsById.get(approval.jobId);
    if (!job) {
      return { success: false, message: `Job '${approval.jobId}' for approval '${approvalId}' was not found.` };
    }

    if (decision === 'denied') {
      job.status = 'denied';
      job.completedAt = this.now();
      job.durationMs = 0;
      job.error = reason?.trim() || 'Denied by user.';
      this.pendingApprovalContexts.delete(approvalId);
      const deniedResult: ToolApprovalDecisionResult = {
        success: true,
        message: `Denied approval '${approvalId}'.`,
        job,
      };
      try {
        await this.options.onApprovalDecided?.(approvalId, decision, deniedResult);
      } catch {
        // Approval side-effects should not change the approval outcome.
      }
      return deniedResult;
    }

    const pending = this.pendingApprovalContexts.get(approvalId);
    if (!pending) {
      return { success: false, message: `No pending context found for approval '${approvalId}'.` };
    }
    this.pendingApprovalContexts.delete(approvalId);

    const entry = this.registry.get(job.toolName);
    if (!entry) {
      job.status = 'failed';
      job.error = `Tool '${job.toolName}' no longer exists.`;
      job.completedAt = this.now();
      return { success: false, message: job.error, job };
    }

    const result = await this.execute(job, pending.request, pending.args, entry.handler);
    const approvalResult: ToolApprovalDecisionResult = {
      success: result.success,
      message: result.message,
      job,
      result,
    };
    try {
      await this.options.onApprovalDecided?.(approvalId, decision, approvalResult);
    } catch {
      // Approval side-effects should not change the approval outcome.
    }
    return approvalResult;
  }

  async executeModelTool(
    toolName: string,
    args: Record<string, unknown>,
    request: Omit<ToolExecutionRequest, 'toolName' | 'args'>,
  ): Promise<Record<string, unknown>> {
    const result = await this.runTool({
      ...request,
      toolName,
      args,
    });
    return {
      success: result.success,
      status: result.status,
      message: result.message,
      error: result.error,
      jobId: result.jobId,
      approvalId: result.approvalId,
      output: result.output,
    };
  }

  private createJob(
    definition: ToolDefinition,
    request: ToolExecutionRequest,
    args: Record<string, unknown>,
  ): ToolJobRecord {
    const redactedArgs = hashRedactedObject(args);
    const argsPreview = formatToolArgsPreview(definition.name, redactedArgs.redacted);
    const job: ToolJobRecord = {
      id: randomUUID(),
      toolName: definition.name,
      risk: definition.risk,
      origin: request.origin,
      ...(request.codeContext?.sessionId?.trim() ? { codeSessionId: request.codeContext.sessionId.trim() } : {}),
      agentId: request.agentId,
      userId: request.userId,
      principalId: request.principalId,
      principalRole: request.principalRole,
      channel: request.channel,
      requestId: request.requestId,
      argsHash: redactedArgs.hash,
      argsRedacted: (redactedArgs.redacted && typeof redactedArgs.redacted === 'object')
        ? redactedArgs.redacted as Record<string, unknown>
        : undefined,
      argsPreview,
      status: 'running',
      createdAt: this.now(),
      requiresApproval: false,
    };
    this.jobs.unshift(job);
    this.jobsById.set(job.id, job);
    while (this.jobs.length > MAX_JOBS) {
      const removed = this.jobs.pop();
      if (removed) this.jobsById.delete(removed.id);
    }
    return job;
  }

  private pruneToolChainBudgets(): void {
    const cutoff = this.now() - TOOL_CHAIN_TTL_MS;
    for (const [key, state] of this.toolChainBudgets.entries()) {
      if (state.lastSeenAt < cutoff) {
        this.toolChainBudgets.delete(key);
      }
    }
  }

  private resolveToolChainKey(request: Partial<ToolExecutionRequest>): string | null {
    const requestId = request.requestId?.trim();
    if (requestId) return `request:${requestId}`;
    const scheduleId = request.scheduleId?.trim();
    if (scheduleId) return `schedule:${scheduleId}`;
    return null;
  }

  private getToolChainBudget(request: Partial<ToolExecutionRequest>): ToolChainBudgetState | null {
    const key = this.resolveToolChainKey(request);
    if (!key) return null;
    this.pruneToolChainBudgets();
    const existing = this.toolChainBudgets.get(key);
    if (existing) {
      existing.lastSeenAt = this.now();
      return existing;
    }
    const created: ToolChainBudgetState = {
      totalCalls: 0,
      nonReadOnlyCalls: 0,
      signatureCounts: new Map(),
      signatureFailureCounts: new Map(),
      lastSeenAt: this.now(),
    };
    this.toolChainBudgets.set(key, created);
    return created;
  }

  private consumeToolChainBudget(
    definition: ToolDefinition,
    request: Partial<ToolExecutionRequest>,
    argsHash: string | undefined,
  ): string | null {
    const budget = this.getToolChainBudget(request);
    if (!budget) return null;

    const signature = argsHash ? `${definition.name}:${argsHash}` : undefined;
    if (signature) {
      const priorFailures = budget.signatureFailureCounts.get(signature) ?? 0;
      if (priorFailures >= MAX_IDENTICAL_FAILURES_PER_CHAIN) {
        return `Blocked runaway retry for '${definition.name}': the same action has already failed ${priorFailures} times in this execution chain.`;
      }
    }

    budget.totalCalls += 1;
    if (budget.totalCalls > MAX_TOOL_CALLS_PER_CHAIN) {
      return `Blocked runaway tool execution: exceeded ${MAX_TOOL_CALLS_PER_CHAIN} tool calls in one execution chain.`;
    }

    if (definition.risk !== 'read_only') {
      budget.nonReadOnlyCalls += 1;
      if (budget.nonReadOnlyCalls > MAX_NON_READ_ONLY_CALLS_PER_CHAIN) {
        return `Blocked runaway tool execution: exceeded ${MAX_NON_READ_ONLY_CALLS_PER_CHAIN} non-read-only tool calls in one execution chain.`;
      }
    }

    if (signature) {
      const count = (budget.signatureCounts.get(signature) ?? 0) + 1;
      budget.signatureCounts.set(signature, count);
      if (count > MAX_IDENTICAL_CALLS_PER_CHAIN) {
        return `Blocked runaway tool execution: '${definition.name}' was requested more than ${MAX_IDENTICAL_CALLS_PER_CHAIN} times with the same arguments in one execution chain.`;
      }
    }

    return null;
  }

  private recordToolChainOutcome(
    definition: ToolDefinition,
    request: Partial<ToolExecutionRequest>,
    argsHash: string | undefined,
    status: ToolJobStatus,
  ): void {
    const budget = this.getToolChainBudget(request);
    if (!budget || !argsHash) return;
    if (status !== 'failed' && status !== 'denied') return;
    const signature = `${definition.name}:${argsHash}`;
    budget.signatureFailureCounts.set(signature, (budget.signatureFailureCounts.get(signature) ?? 0) + 1);
  }

  private decide(
    definition: ToolDefinition,
    args: Record<string, unknown>,
    request: Partial<ToolExecutionRequest> = {},
  ): ToolDecision {
    if (!this.options.enabled) return 'deny';

    const contentTrustLevel = request.contentTrustLevel ?? 'trusted';
    const derivedFromTaintedContent = request.derivedFromTaintedContent === true;
    const memoryMutationDecision = this.decideMemoryMutationTrust(definition.name, request);

    if (memoryMutationDecision) {
      return memoryMutationDecision;
    }

    if (contentTrustLevel === 'quarantined' && definition.risk !== 'read_only') {
      return 'deny';
    }
    if (derivedFromTaintedContent) {
      if (definition.risk !== 'read_only') {
        return 'require_approval';
      }
    }

    const explicit = this.policy.toolPolicies[definition.name];
    if (explicit === 'deny') {
      return 'deny';
    }

    const codeSessionTrustDecision = this.decideCodeSessionTrust(definition, args, request);
    if (codeSessionTrustDecision) {
      return codeSessionTrustDecision;
    }

    const defaultMemoryMutationDecision = this.decideDefaultMemoryMutationPolicy(definition.name);
    if (defaultMemoryMutationDecision) {
      return defaultMemoryMutationDecision;
    }

    if (explicit) {
      if (explicit === 'auto') return 'allow';
      if (explicit === 'manual') return 'require_approval';
    }

    const browserDecision = this.decideBrowserTool(definition.name, args);
    if (browserDecision) {
      return browserDecision;
    }

    const gwsDecision = this.decideGwsTool(definition.name, args);
    if (gwsDecision) {
      return gwsDecision;
    }

    if (this.isCodeWorkspacePolicyNoOp(definition, args, request)) {
      return 'allow';
    }

    // Auto-approve coding and filesystem tools operating within the code session workspace.
    // The user granted trust to this workspace by creating the session.
    if (this.isCodeSessionWorkspaceTool(definition, request)) {
      return 'allow';
    }

    const m365Decision = this.decideM365Tool(definition.name, args);
    if (m365Decision) {
      return m365Decision;
    }

    const cloudDecision = this.decideCloudTool(definition.name, args);
    if (cloudDecision) {
      return cloudDecision;
    }

    // Read-only shell commands skip approval even under approve_by_policy
    if (definition.name === 'shell_safe' && this.policy.mode !== 'approve_each') {
      const fullCmd = ((args as Record<string, unknown>).command as string ?? '').trim();
      if (this.isReadOnlyShellCommand(fullCmd)) {
        return 'allow';
      }
    }

    if (definition.risk === 'external_post') {
      return 'require_approval';
    }

    switch (this.policy.mode) {
      case 'approve_each':
        return definition.risk === 'read_only' ? 'allow' : 'require_approval';
      case 'autonomous':
        return 'allow';
      case 'approve_by_policy':
      default:
        if (definition.risk === 'read_only') return 'allow';
        if (definition.risk === 'network') return 'allow';
        return 'require_approval';
    }
  }

  private decideMemoryMutationTrust(
    toolName: string,
    request: Partial<ToolExecutionRequest>,
  ): ToolDecision | null {
    if (!isMemoryMutationToolName(toolName)) {
      return null;
    }
    const contentTrustLevel = request.contentTrustLevel ?? 'trusted';
    if (contentTrustLevel === 'quarantined') {
      return 'deny';
    }
    return request.derivedFromTaintedContent === true ? 'require_approval' : null;
  }

  private decideDefaultMemoryMutationPolicy(toolName: string): ToolDecision | null {
    if (isDirectMemoryMutationToolName(toolName)) {
      return 'allow';
    }
    if (isElevatedMemoryMutationToolName(toolName)) {
      return 'require_approval';
    }
    return null;
  }

  private decideBrowserTool(toolName: string, args: Record<string, unknown>): ToolDecision | null {
    if (toolName === 'browser_state') {
      return 'allow';
    }

    if (toolName === 'browser_act') {
      return hasValidBrowserMutationArgs(args)
        ? (this.policy.mode === 'autonomous' ? 'allow' : 'require_approval')
        : 'allow';
    }

    if (toolName !== 'browser_interact') {
      return null;
    }

    const action = asString(args.action, 'list').trim().toLowerCase();
    if (action === 'list') {
      return 'allow';
    }

    return hasValidBrowserMutationArgs(args)
      ? (this.policy.mode === 'autonomous' ? 'allow' : 'require_approval')
      : 'allow';
  }

  private decideGwsTool(toolName: string, args: Record<string, unknown>): ToolDecision | null {
    if (toolName !== 'gws') return null;

    const service = asString(args.service).trim().toLowerCase();
    const method = asString(args.method).trim().toLowerCase();
    const resource = asString(args.resource).trim().toLowerCase();
    const isWrite = /\b(create|insert|update|patch|delete|send|remove|modify)\b/i.test(method);

    // Reads for all services pass through to default policy (network → allow)
    if (!isWrite) return null;

    // Gmail send is always approval-gated regardless of policy mode
    if (service === 'gmail' && method === 'send') {
      return 'require_approval';
    }

    // Gmail drafts: approval-gated in non-autonomous modes
    if (service === 'gmail' && resource.includes('draft')) {
      return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
    }

    // All other GWS write operations: approval-gated in non-autonomous modes
    // Covers calendar, drive, docs, sheets, and any future services (fail-closed)
    return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
  }

  private decideM365Tool(toolName: string, args: Record<string, unknown>): ToolDecision | null {
    if (toolName !== 'm365') return null;

    const service = asString(args.service).trim().toLowerCase();
    const method = asString(args.method).trim().toLowerCase();
    const isWrite = /\b(create|insert|update|patch|delete|send|remove|modify|forward|reply)\b/i.test(method);

    // Reads for all services pass through to default policy (network → allow)
    if (!isWrite) return null;

    // Outlook send is always approval-gated regardless of policy mode
    if (service === 'mail' && method === 'send') {
      return 'require_approval';
    }

    // All other M365 write operations: approval-gated in non-autonomous modes
    return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
  }

  private decideCloudTool(toolName: string, args: Record<string, unknown>): ToolDecision | null {
    if (toolName === 'whm_accounts') {
      const action = asString(args.action, 'list').trim().toLowerCase();
      if (action === 'list') return 'allow';
      return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
    }

    if (toolName === 'cpanel_domains') {
      const action = asString(args.action).trim().toLowerCase();
      if (action === 'list' || action === 'list_redirects') return 'allow';
      return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
    }

    if (toolName === 'cpanel_dns') {
      const action = asString(args.action).trim().toLowerCase();
      if (action === 'parse_zone') return 'allow';
      return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
    }

    if (toolName === 'cpanel_backups') {
      const action = asString(args.action, 'list').trim().toLowerCase();
      if (action === 'list') return 'allow';
      return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
    }

    if (toolName === 'cpanel_ssl') {
      const action = asString(args.action).trim().toLowerCase();
      if (action === 'list_certs' || action === 'fetch_best_for_domain') return 'allow';
      return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
    }

    if (toolName === 'vercel_projects') {
      const action = asString(args.action, 'list').trim().toLowerCase();
      if (action === 'list' || action === 'get') return 'allow';
      return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
    }

    if (toolName === 'vercel_deployments') {
      const action = asString(args.action, 'list').trim().toLowerCase();
      if (action === 'list' || action === 'get') return 'allow';
      return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
    }

    if (toolName === 'vercel_domains') {
      const action = asString(args.action, 'list').trim().toLowerCase();
      if (action === 'list' || action === 'get') return 'allow';
      return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
    }

    if (toolName === 'vercel_env') {
      const action = asString(args.action, 'list').trim().toLowerCase();
      if (action === 'list') return 'allow';
      return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
    }

    if (toolName === 'vercel_status' || toolName === 'vercel_logs') {
      return 'allow';
    }

    if (toolName === 'cf_status') {
      return 'allow';
    }

    if (toolName === 'cf_dns') {
      const action = asString(args.action, 'list').trim().toLowerCase();
      if (action === 'list' || action === 'get') return 'allow';
      return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
    }

    if (toolName === 'cf_ssl') {
      const action = asString(args.action, 'list_settings').trim().toLowerCase();
      if (action === 'list_settings' || action === 'get_setting') return 'allow';
      return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
    }

    if (toolName === 'cf_cache') {
      return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
    }

    if (toolName === 'aws_status' || toolName === 'aws_cloudwatch' || toolName === 'aws_iam' || toolName === 'aws_costs') {
      return 'allow';
    }

    if (toolName === 'aws_ec2_instances') {
      const action = asString(args.action, 'list').trim().toLowerCase();
      if (action === 'list' || action === 'describe') return 'allow';
      return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
    }

    if (toolName === 'aws_ec2_security_groups') {
      const action = asString(args.action, 'list').trim().toLowerCase();
      if (action === 'list' || action === 'describe') return 'allow';
      return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
    }

    if (toolName === 'aws_s3_buckets') {
      const action = asString(args.action, 'list_buckets').trim().toLowerCase();
      if (action === 'list_buckets' || action === 'list_objects' || action === 'get_object') return 'allow';
      return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
    }

    if (toolName === 'aws_route53') {
      const action = asString(args.action, 'list_zones').trim().toLowerCase();
      if (action === 'list_zones' || action === 'list_records') return 'allow';
      return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
    }

    if (toolName === 'aws_lambda') {
      const action = asString(args.action, 'list').trim().toLowerCase();
      if (action === 'list' || action === 'get') return 'allow';
      return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
    }

    if (toolName === 'aws_rds') {
      const action = asString(args.action, 'list').trim().toLowerCase();
      if (action === 'list') return 'allow';
      return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
    }

    if (toolName === 'gcp_status' || toolName === 'gcp_logs') {
      return 'allow';
    }

    if (toolName === 'gcp_compute') {
      const action = asString(args.action, 'list').trim().toLowerCase();
      if (action === 'list' || action === 'get') return 'allow';
      return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
    }

    if (toolName === 'gcp_cloud_run') {
      const action = asString(args.action, 'list_services').trim().toLowerCase();
      if (action === 'list_services' || action === 'get_service' || action === 'list_revisions') return 'allow';
      return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
    }

    if (toolName === 'gcp_storage') {
      const action = asString(args.action, 'list_buckets').trim().toLowerCase();
      if (action === 'list_buckets' || action === 'list_objects' || action === 'get_object') return 'allow';
      return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
    }

    if (toolName === 'gcp_dns') {
      const action = asString(args.action, 'list_zones').trim().toLowerCase();
      if (action === 'list_zones' || action === 'list_records') return 'allow';
      return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
    }

    if (toolName === 'azure_status' || toolName === 'azure_monitor') {
      return 'allow';
    }

    if (toolName === 'azure_vms') {
      const action = asString(args.action, 'list').trim().toLowerCase();
      if (action === 'list' || action === 'get') return 'allow';
      return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
    }

    if (toolName === 'azure_app_service') {
      const action = asString(args.action, 'list').trim().toLowerCase();
      if (action === 'list' || action === 'get' || action === 'config') return 'allow';
      return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
    }

    if (toolName === 'azure_storage') {
      const action = asString(args.action, 'list_accounts').trim().toLowerCase();
      if (action === 'list_accounts' || action === 'list_containers' || action === 'list_blobs') return 'allow';
      return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
    }

    if (toolName === 'azure_dns') {
      const action = asString(args.action, 'list_zones').trim().toLowerCase();
      if (action === 'list_zones' || action === 'list_records') return 'allow';
      return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
    }

    if (toolName === 'whm_dns') {
      const action = asString(args.action, 'list').trim().toLowerCase();
      if (action === 'list' || action === 'parse_zone') return 'allow';
      return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
    }

    if (toolName === 'whm_ssl') {
      const action = asString(args.action).trim().toLowerCase();
      if (action === 'list_providers' || action === 'get_excluded_domains') return 'allow';
      return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
    }

    if (toolName === 'whm_backup') {
      const action = asString(args.action).trim().toLowerCase();
      if (action === 'config_get' || action === 'destination_list' || action === 'date_list' || action === 'user_list') return 'allow';
      return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
    }

    if (toolName === 'whm_services') {
      const action = asString(args.action).trim().toLowerCase();
      if (action === 'status' || action === 'get_config') return 'allow';
      return this.policy.mode === 'autonomous' ? 'allow' : 'require_approval';
    }

    return null;
  }

  private validateToolArgs(definition: ToolDefinition, args: Record<string, unknown>): string | null {
    const schema = definition.parameters;
    if (!isRecord(schema) || schema.type !== 'object') return null;

    try {
      const AjvClass = (Ajv as any).default || Ajv;
      const ajv = new AjvClass({ strict: false, allErrors: true, coerceTypes: false });
      const validate = ajv.compile(schema);
      const valid = validate(args);
      if (!valid && validate.errors) {
        return `Schema validation failed: ${ajv.errorsText(validate.errors)}`;
      }
    } catch (err) {
      return `Schema compilation failed: ${err instanceof Error ? err.message : String(err)}`;
    }

    return null;
  }

  private async validateBeforeApproval(
    toolName: string,
    args: Record<string, unknown>,
    request?: Partial<ToolExecutionRequest>,
  ): Promise<string | null> {
    if (isMemoryMutationToolName(toolName)) {
      return this.getMemoryMutationReadOnlyError(args, request);
    }

    if (toolName === 'shell_safe') {
      const command = typeof args.command === 'string' ? args.command.trim() : '';
      if (!command) {
        return null;
      }
      if (isInstallLikePackageManagerCommand(command)) {
        const plannedInstall = parseManagedPackageInstallCommand(command);
        return plannedInstall.success
          ? 'Install-like package manager commands must use package_install so Guardian can stage and review the package artifacts first.'
          : `Install-like package manager commands must use package_install. ${plannedInstall.error ?? 'This install form is not supported by managed package installs in v1.'}`;
      }
      const cwd = typeof args.cwd === 'string' && args.cwd.trim()
        ? await this.resolveAllowedPath(args.cwd.trim(), request)
        : this.getEffectiveWorkspaceRoot(request);
      const shellCheck = this.validateShellCommandForRequest(command, request, cwd);
      return shellCheck.safe ? null : shellCheck.reason ?? 'Command failed shell safety validation.';
    }

    if (toolName === 'package_install') {
      const command = typeof args.command === 'string' ? args.command.trim() : '';
      if (!command) {
        return 'command is required';
      }
      const plannedInstall = parseManagedPackageInstallCommand(command);
      return plannedInstall.success ? null : (plannedInstall.error ?? 'Managed package install planning failed.');
    }

    if (toolName === 'fs_read' || toolName === 'fs_write' || toolName === 'fs_mkdir' || toolName === 'fs_delete' || toolName === 'doc_create') {
      const path = typeof args.path === 'string' ? args.path.trim() : '';
      if (path) {
        try {
          await this.resolveAllowedPath(path, request);
        } catch (err) {
          return err instanceof Error ? err.message : String(err);
        }
      }
    }

    if (toolName === 'fs_move' || toolName === 'fs_copy') {
      const source = typeof args.source === 'string' ? args.source.trim() : '';
      const destination = typeof args.destination === 'string' ? args.destination.trim() : '';
      for (const path of [source, destination]) {
        if (!path) continue;
        try {
          await this.resolveAllowedPath(path, request);
        } catch (err) {
          return err instanceof Error ? err.message : String(err);
        }
      }
    }

    if (this.isBrowserFacingTool(toolName)) {
      const validated = this.normalizeBrowserUrlArg(toolName, args.url);
      if (validated.error) {
        return validated.error;
      }
    }

    if (toolName === 'contacts_import_csv') {
      const csvPath = typeof args.csvPath === 'string' ? args.csvPath.trim() : '';
      if (csvPath) {
        try {
          await this.resolveAllowedPath(csvPath, request);
        } catch (err) {
          return err instanceof Error ? err.message : String(err);
        }
      }
    }

    if (toolName === 'whm_accounts') {
      try {
        this.createWhmClient(requireString(args.profile, 'profile'));
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      const action = requireString(args.action, 'action').trim().toLowerCase();
      if (action === 'create') {
        if (!asString(args.username).trim()) return 'username is required for create';
        if (!asString(args.domain).trim()) return 'domain is required for create';
        if (!asString(args.password).trim()) return 'password is required for create';
      } else if (action === 'suspend' || action === 'unsuspend' || action === 'modify' || action === 'remove') {
        if (!asString(args.username).trim()) return `username is required for ${action}`;
      }
    }

    if (toolName === 'cpanel_domains') {
      try {
        this.resolveCpanelAccountContext(requireString(args.profile, 'profile'), asString(args.account));
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      const action = requireString(args.action, 'action').trim().toLowerCase();
      if ((action === 'add_subdomain' || action === 'delete_subdomain') && !asString(args.domain).trim()) {
        return `domain is required for ${action}`;
      }
      if ((action === 'add_subdomain' || action === 'delete_subdomain') && !asString(args.rootDomain).trim()) {
        return `rootDomain is required for ${action}`;
      }
      if (action === 'add_redirect') {
        if (!asString(args.domain).trim()) return 'domain is required for add_redirect';
        if (!asString(args.destination).trim()) return 'destination is required for add_redirect';
      }
      if (action === 'delete_redirect' && !asString(args.redirectId).trim()) {
        return 'redirectId is required for delete_redirect';
      }
    }

    if (toolName === 'cpanel_dns') {
      try {
        this.resolveCpanelAccountContext(requireString(args.profile, 'profile'), asString(args.account));
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      const action = requireString(args.action, 'action').trim().toLowerCase();
      if (!asString(args.zone).trim()) return 'zone is required for cpanel_dns actions';
      if (action === 'mass_edit_zone') {
        const add = Array.isArray(args.add) ? args.add.length : 0;
        const edit = Array.isArray(args.edit) ? args.edit.length : 0;
        const remove = Array.isArray(args.remove) ? args.remove.length : 0;
        if (add + edit + remove === 0) return 'mass_edit_zone requires at least one add, edit, or remove entry';
      }
    }

    if (toolName === 'cpanel_backups') {
      try {
        this.resolveCpanelAccountContext(requireString(args.profile, 'profile'), asString(args.account));
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      requireString(args.action, 'action');
    }

    if (toolName === 'cpanel_ssl') {
      try {
        this.resolveCpanelAccountContext(requireString(args.profile, 'profile'), asString(args.account));
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      const action = requireString(args.action, 'action').trim().toLowerCase();
      if (action !== 'list_certs' && !asString(args.domain).trim()) return `domain is required for ${action}`;
      if (action === 'install_ssl') {
        if (!asString(args.certificate).trim()) return 'certificate is required for install_ssl';
        if (!asString(args.privateKey).trim()) return 'privateKey is required for install_ssl';
      }
    }

    if (toolName === 'vercel_status') {
      try {
        this.createVercelClient(requireString(args.profile, 'profile'));
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
    }

    if (toolName === 'vercel_projects') {
      try {
        this.createVercelClient(requireString(args.profile, 'profile'));
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      const action = requireString(args.action, 'action').trim().toLowerCase();
      if ((action === 'get' || action === 'update' || action === 'delete') && !asString(args.project).trim()) {
        return `project is required for ${action}`;
      }
      if (action === 'create' && !asString(args.name).trim() && !isRecord(args.settings)) {
        return 'name or settings object is required for create';
      }
      if (action === 'update' && !isRecord(args.settings) && !asString(args.name).trim()) {
        return 'settings object or name is required for update';
      }
    }

    if (toolName === 'vercel_deployments') {
      try {
        this.createVercelClient(requireString(args.profile, 'profile'));
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      const action = requireString(args.action, 'action').trim().toLowerCase();
      if ((action === 'get' || action === 'cancel') && !asString(args.deploymentId).trim()) {
        return `deploymentId is required for ${action}`;
      }
      if (action === 'promote') {
        if (!asString(args.project).trim()) return 'project is required for promote';
        if (!asString(args.deploymentId).trim()) return 'deploymentId is required for promote';
      }
      if (action === 'create' && !isRecord(args.deployment) && !asString(args.project).trim()) {
        return 'deployment object or project is required for create';
      }
    }

    if (toolName === 'vercel_domains') {
      try {
        this.createVercelClient(requireString(args.profile, 'profile'));
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      const action = requireString(args.action, 'action').trim().toLowerCase();
      if (!asString(args.project).trim()) return 'project is required for vercel_domains actions';
      if ((action === 'get' || action === 'add' || action === 'update' || action === 'remove' || action === 'verify') && !asString(args.domain).trim()) {
        return `domain is required for ${action}`;
      }
    }

    if (toolName === 'vercel_env') {
      try {
        this.createVercelClient(requireString(args.profile, 'profile'));
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      const action = requireString(args.action, 'action').trim().toLowerCase();
      if (!asString(args.project).trim()) return 'project is required for vercel_env actions';
      if ((action === 'update' || action === 'delete') && !asString(args.envId).trim()) {
        return `envId is required for ${action}`;
      }
      if ((action === 'create' || action === 'update') && !isRecord(args.env) && !asString(args.key).trim()) {
        return `env object or key is required for ${action}`;
      }
      if ((action === 'create' || action === 'update') && !isRecord(args.env) && !asString(args.value).trim()) {
        return `value is required for ${action}`;
      }
    }

    if (toolName === 'vercel_logs') {
      try {
        this.createVercelClient(requireString(args.profile, 'profile'));
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      const action = requireString(args.action, 'action').trim().toLowerCase();
      if (action === 'runtime') {
        if (!asString(args.project).trim()) return 'project is required for runtime logs';
        if (!asString(args.deploymentId).trim()) return 'deploymentId is required for runtime logs';
      } else if (action === 'events') {
        if (!asString(args.deploymentId).trim()) return 'deploymentId is required for deployment events';
      }
    }

    if (toolName === 'cf_status') {
      try {
        this.createCloudflareClient(requireString(args.profile, 'profile'));
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
    }

    if (toolName === 'cf_dns') {
      try {
        this.createCloudflareClient(requireString(args.profile, 'profile'));
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      const action = requireString(args.action, 'action').trim().toLowerCase();
      if ((action === 'get' || action === 'update' || action === 'delete') && !asString(args.recordId).trim()) {
        return `recordId is required for ${action}`;
      }
      if ((action === 'create' || action === 'update') && !isRecord(args.record)) {
        if (!asString(args.type).trim()) return `type is required for ${action}`;
        if (!asString(args.name).trim()) return `name is required for ${action}`;
        if (!asString(args.content).trim()) return `content is required for ${action}`;
      }
    }

    if (toolName === 'cf_ssl') {
      try {
        this.createCloudflareClient(requireString(args.profile, 'profile'));
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      const action = requireString(args.action, 'action').trim().toLowerCase();
      if ((action === 'get_setting' || action === 'update_setting') && !asString(args.settingId).trim()) {
        return `settingId is required for ${action}`;
      }
      if (action === 'update_setting' && args.value === undefined) {
        return 'value is required for update_setting';
      }
    }

    if (toolName === 'cf_cache') {
      try {
        this.createCloudflareClient(requireString(args.profile, 'profile'));
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      const action = requireString(args.action, 'action').trim().toLowerCase();
      if (action === 'purge_files' && asStringArray(args.files).length === 0) return 'files is required for purge_files';
      if (action === 'purge_tags' && asStringArray(args.tags).length === 0) return 'tags is required for purge_tags';
      if (action === 'purge_hosts' && asStringArray(args.hosts).length === 0) return 'hosts is required for purge_hosts';
      if (action === 'purge_prefixes' && asStringArray(args.prefixes).length === 0) return 'prefixes is required for purge_prefixes';
    }

    if (toolName === 'aws_status') {
      try {
        this.createAwsClient(requireString(args.profile, 'profile'), 'sts');
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
    }

    if (toolName === 'aws_ec2_instances') {
      try {
        this.createAwsClient(requireString(args.profile, 'profile'), 'ec2');
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      const action = requireString(args.action, 'action').trim().toLowerCase();
      if ((action === 'start' || action === 'stop' || action === 'reboot' || action === 'describe') && asStringArray(args.instanceIds).length === 0) {
        return `instanceIds is required for ${action}`;
      }
    }

    if (toolName === 'aws_ec2_security_groups') {
      try {
        this.createAwsClient(requireString(args.profile, 'profile'), 'ec2');
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      const action = requireString(args.action, 'action').trim().toLowerCase();
      if ((action === 'authorize_ingress' || action === 'revoke_ingress') && !asString(args.groupId).trim()) {
        return `groupId is required for ${action}`;
      }
      if ((action === 'authorize_ingress' || action === 'revoke_ingress') && !asString(args.protocol).trim()) {
        return `protocol is required for ${action}`;
      }
    }

    if (toolName === 'aws_s3_buckets') {
      try {
        this.createAwsClient(requireString(args.profile, 'profile'), 's3');
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      const action = requireString(args.action, 'action').trim().toLowerCase();
      if ((action === 'create_bucket' || action === 'delete_bucket' || action === 'list_objects' || action === 'get_object' || action === 'put_object' || action === 'delete_object') && !asString(args.bucket).trim()) {
        return `bucket is required for ${action}`;
      }
      if ((action === 'get_object' || action === 'put_object' || action === 'delete_object') && !asString(args.key).trim()) {
        return `key is required for ${action}`;
      }
      if (action === 'put_object' && !asString(args.body).trim()) {
        return 'body is required for put_object';
      }
    }

    if (toolName === 'aws_route53') {
      try {
        this.createAwsClient(requireString(args.profile, 'profile'), 'route53');
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      const action = requireString(args.action, 'action').trim().toLowerCase();
      if ((action === 'list_records' || action === 'change_records') && !asString(args.hostedZoneId).trim()) {
        return `hostedZoneId is required for ${action}`;
      }
      if (action === 'change_records' && !Array.isArray(args.changes) && !asString(args.changeAction).trim()) {
        return 'changes array or changeAction is required for change_records';
      }
    }

    if (toolName === 'aws_lambda') {
      try {
        this.createAwsClient(requireString(args.profile, 'profile'), 'lambda');
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      const action = requireString(args.action, 'action').trim().toLowerCase();
      if ((action === 'get' || action === 'invoke') && !asString(args.functionName).trim()) {
        return `functionName is required for ${action}`;
      }
    }

    if (toolName === 'aws_cloudwatch') {
      try {
        this.createAwsClient(requireString(args.profile, 'profile'), 'cloudwatch');
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      const action = requireString(args.action, 'action').trim().toLowerCase();
      if (action === 'logs' && !asString(args.logGroupName).trim()) {
        return 'logGroupName is required for logs';
      }
    }

    if (toolName === 'aws_rds') {
      try {
        this.createAwsClient(requireString(args.profile, 'profile'), 'rds');
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      const action = requireString(args.action, 'action').trim().toLowerCase();
      if ((action === 'start' || action === 'stop' || action === 'reboot') && !asString(args.dbInstanceIdentifier).trim()) {
        return `dbInstanceIdentifier is required for ${action}`;
      }
    }

    if (toolName === 'aws_iam') {
      try {
        this.createAwsClient(requireString(args.profile, 'profile'), 'iam');
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
    }

    if (toolName === 'aws_costs') {
      try {
        this.createAwsClient(requireString(args.profile, 'profile'), 'costExplorer');
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      if (!isRecord(args.timePeriod)) return 'timePeriod object is required for aws_costs';
    }

    if (toolName === 'gcp_status') {
      try {
        this.createGcpClient(requireString(args.profile, 'profile'), 'cloudResourceManager');
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
    }

    if (toolName === 'gcp_compute') {
      try {
        this.createGcpClient(requireString(args.profile, 'profile'), 'compute');
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      const action = requireString(args.action, 'action').trim().toLowerCase();
      if ((action === 'get' || action === 'start' || action === 'stop' || action === 'reset') && !asString(args.zone).trim()) {
        return `zone is required for ${action}`;
      }
      if ((action === 'get' || action === 'start' || action === 'stop' || action === 'reset') && !asString(args.instance).trim()) {
        return `instance is required for ${action}`;
      }
    }

    if (toolName === 'gcp_cloud_run') {
      try {
        this.createGcpClient(requireString(args.profile, 'profile'), 'run');
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      const action = requireString(args.action, 'action').trim().toLowerCase();
      if ((action === 'list_services' || action === 'list_revisions' || action === 'get_service' || action === 'update_traffic' || action === 'delete_service') && !this.resolveGcpLocation(args.location, requireString(args.profile, 'profile'), false)) {
        return `location is required for ${action} when the GCP profile has no default location`;
      }
      if ((action === 'get_service' || action === 'update_traffic' || action === 'delete_service') && !asString(args.service).trim()) {
        return `service is required for ${action}`;
      }
      if (action === 'update_traffic' && !Array.isArray(args.traffic)) {
        return 'traffic array is required for update_traffic';
      }
    }

    if (toolName === 'gcp_storage') {
      try {
        this.createGcpClient(requireString(args.profile, 'profile'), 'storage');
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      const action = requireString(args.action, 'action').trim().toLowerCase();
      if ((action === 'create_bucket' || action === 'delete_bucket' || action === 'list_objects' || action === 'get_object' || action === 'put_object' || action === 'delete_object') && !asString(args.bucket).trim()) {
        return `bucket is required for ${action}`;
      }
      if ((action === 'get_object' || action === 'put_object' || action === 'delete_object') && !asString(args.object).trim()) {
        return `object is required for ${action}`;
      }
      if (action === 'put_object' && !asString(args.body).trim()) {
        return 'body is required for put_object';
      }
    }

    if (toolName === 'gcp_dns') {
      try {
        this.createGcpClient(requireString(args.profile, 'profile'), 'dns');
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      const action = requireString(args.action, 'action').trim().toLowerCase();
      if ((action === 'list_records' || action === 'change_records') && !asString(args.managedZone).trim()) {
        return `managedZone is required for ${action}`;
      }
      if (action === 'change_records' && !Array.isArray(args.additions) && !Array.isArray(args.deletions)) {
        return 'additions or deletions array is required for change_records';
      }
    }

    if (toolName === 'gcp_logs') {
      try {
        this.createGcpClient(requireString(args.profile, 'profile'), 'logging');
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
    }

    if (toolName === 'azure_status') {
      try {
        this.createAzureClient(requireString(args.profile, 'profile'), 'management');
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
    }

    if (toolName === 'azure_vms') {
      try {
        this.createAzureClient(requireString(args.profile, 'profile'), 'management');
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      const action = requireString(args.action, 'action').trim().toLowerCase();
      if ((action === 'get' || action === 'start' || action === 'stop' || action === 'restart' || action === 'deallocate') && !this.resolveAzureResourceGroup(args.resourceGroup, requireString(args.profile, 'profile'), false)) {
        return `resourceGroup is required for ${action} when the Azure profile has no default resource group`;
      }
      if ((action === 'get' || action === 'start' || action === 'stop' || action === 'restart' || action === 'deallocate') && !asString(args.vmName).trim()) {
        return `vmName is required for ${action}`;
      }
    }

    if (toolName === 'azure_app_service') {
      try {
        this.createAzureClient(requireString(args.profile, 'profile'), 'management');
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      const action = requireString(args.action, 'action').trim().toLowerCase();
      if ((action === 'get' || action === 'config' || action === 'restart' || action === 'delete') && !this.resolveAzureResourceGroup(args.resourceGroup, requireString(args.profile, 'profile'), false)) {
        return `resourceGroup is required for ${action} when the Azure profile has no default resource group`;
      }
      if ((action === 'get' || action === 'config' || action === 'restart' || action === 'delete') && !asString(args.name).trim()) {
        return `name is required for ${action}`;
      }
    }

    if (toolName === 'azure_storage') {
      try {
        this.createAzureClient(requireString(args.profile, 'profile'), asString(args.action).trim().toLowerCase() === 'list_accounts' ? 'management' : 'blob');
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      const action = requireString(args.action, 'action').trim().toLowerCase();
      if ((action === 'list_containers' || action === 'create_container' || action === 'delete_container' || action === 'list_blobs' || action === 'put_blob' || action === 'delete_blob') && !asString(args.accountName).trim()) {
        return `accountName is required for ${action}`;
      }
      if ((action === 'create_container' || action === 'delete_container' || action === 'list_blobs' || action === 'put_blob' || action === 'delete_blob') && !asString(args.container).trim()) {
        return `container is required for ${action}`;
      }
      if ((action === 'put_blob' || action === 'delete_blob') && !asString(args.blobName).trim()) {
        return `blobName is required for ${action}`;
      }
      if (action === 'put_blob' && !asString(args.body).trim()) {
        return 'body is required for put_blob';
      }
    }

    if (toolName === 'azure_dns') {
      try {
        this.createAzureClient(requireString(args.profile, 'profile'), 'management');
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      const action = requireString(args.action, 'action').trim().toLowerCase();
      if ((action === 'list_zones' || action === 'list_records' || action === 'upsert_record_set' || action === 'delete_record_set') && !this.resolveAzureResourceGroup(args.resourceGroup, requireString(args.profile, 'profile'), false)) {
        return `resourceGroup is required for ${action} when the Azure profile has no default resource group`;
      }
      if ((action === 'list_records' || action === 'upsert_record_set' || action === 'delete_record_set') && !asString(args.zoneName).trim()) {
        return `zoneName is required for ${action}`;
      }
      if ((action === 'upsert_record_set' || action === 'delete_record_set') && !asString(args.recordType).trim()) {
        return `recordType is required for ${action}`;
      }
      if ((action === 'upsert_record_set' || action === 'delete_record_set') && !asString(args.relativeRecordSetName).trim()) {
        return `relativeRecordSetName is required for ${action}`;
      }
      if (action === 'upsert_record_set' && !isRecord(args.recordSet)) {
        return 'recordSet object is required for upsert_record_set';
      }
    }

    if (toolName === 'azure_monitor') {
      try {
        this.createAzureClient(requireString(args.profile, 'profile'), 'management');
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      const action = requireString(args.action, 'action').trim().toLowerCase();
      if (action === 'metrics' && !asString(args.resourceId).trim()) {
        return 'resourceId is required for metrics';
      }
      if (action === 'metrics' && !asString(args.metricnames).trim()) {
        return 'metricnames is required for metrics';
      }
    }

    if (toolName === 'whm_dns') {
      try {
        this.createWhmClient(requireString(args.profile, 'profile'));
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      const action = requireString(args.action, 'action').trim().toLowerCase();
      if (action === 'parse_zone' && !asString(args.zone).trim()) return 'zone is required for parse_zone';
      if ((action === 'create_zone' || action === 'delete_zone' || action === 'reset_zone') && !asString(args.domain).trim()) {
        return `domain is required for ${action}`;
      }
      if (action === 'create_zone' && !asString(args.ip).trim()) return 'ip is required for create_zone';
    }

    if (toolName === 'whm_ssl') {
      try {
        this.createWhmClient(requireString(args.profile, 'profile'));
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      const action = requireString(args.action, 'action').trim().toLowerCase();
      if ((action === 'check_user' || action === 'get_excluded_domains' || action === 'set_excluded_domains') && !asString(args.username).trim()) {
        return `username is required for ${action}`;
      }
      if (action === 'set_provider' && !asString(args.provider).trim()) return 'provider is required for set_provider';
    }

    if (toolName === 'whm_backup') {
      try {
        this.createWhmClient(requireString(args.profile, 'profile'));
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      const action = requireString(args.action, 'action').trim().toLowerCase();
      if (action === 'user_list' && !asString(args.restorePoint).trim()) return 'restorePoint is required for user_list';
      if (action === 'config_set' && !isRecord(args.settings)) return 'settings object is required for config_set';
    }

    if (toolName === 'whm_services') {
      try {
        this.createWhmClient(requireString(args.profile, 'profile'));
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      const action = requireString(args.action, 'action').trim().toLowerCase();
      if ((action === 'get_config' || action === 'restart') && !asString(args.service).trim()) {
        return `service is required for ${action}`;
      }
    }

    if (toolName === 'fs_write' || toolName === 'doc_create') {
      const content = typeof args.content === 'string' ? args.content : '';
      if (!content) {
        return null;
      }
      const contentScan = scanWriteContent(content);
      if (contentScan.secrets.length > 0) {
        const patterns = [...new Set(contentScan.secrets.map((match) => match.pattern))];
        return `Write content contains secrets: ${patterns.join(', ')}.`;
      }
      if (contentScan.pii.length > 0) {
        const patterns = [...new Set(contentScan.pii.map((match) => match.label))];
        return `Write content contains PII: ${patterns.join(', ')}.`;
      }
    }

    return null;
  }

  private getMemoryMutationIntentError(
    toolName: string,
    request?: Partial<ToolExecutionRequest>,
  ): string | null {
    if (!isMemoryMutationToolName(toolName)) {
      return null;
    }
    if (request?.origin !== 'assistant') {
      return null;
    }
    return request.allowModelMemoryMutation === true
      ? null
      : getMemoryMutationIntentDeniedMessage(toolName);
  }

  private getMemoryMutationReadOnlyError(
    args?: Record<string, unknown>,
    request?: Partial<ToolExecutionRequest>,
  ): string | null {
    const targetScope = this.normalizeMemoryMutationScope(args?.scope);
    if (targetScope === 'code_session') {
      const codeMemory = this.resolveCodeSessionMemoryContext(asString(args?.sessionId), request);
      if (!codeMemory) {
        return 'A reachable code session is required to save code-session memory.';
      }
      if (codeMemory?.store?.isReadOnly()) {
        return 'Code-session memory is read-only.';
      }
      return null;
    }
    const globalMemory = this.getGlobalMemoryContext(request);
    if (globalMemory.store?.isReadOnly()) {
      return 'Persistent memory is read-only.';
    }
    return null;
  }

  private async execute(
    job: ToolJobRecord,
    request: ToolExecutionRequest,
    args: Record<string, unknown>,
    handler: (args: Record<string, unknown>, request: ToolExecutionRequest) => Promise<ToolResult>,
  ): Promise<ToolRunResponse> {
    job.status = 'running';
    job.startedAt = this.now();

    // Dry-run mode: validate but don't execute mutating operations
    if (request.dryRun && job.risk !== 'read_only') {
      job.status = 'succeeded';
      job.completedAt = this.now();
      job.durationMs = 0;
      job.resultPreview = '[dry-run preview]';
      const preview = this.buildDryRunPreview(job.toolName, args);
      return {
        success: true,
        status: job.status,
        jobId: job.id,
        message: `[DRY RUN] Tool '${job.toolName}' validated. ${preview}`,
        output: { dryRun: true, preview, args },
      };
    }

    // Guardian Agent inline LLM evaluation — runs before tool handler on non-read actions
    if (this.options.onPreExecute && job.risk !== 'read_only') {
      try {
        const evaluation = await this.options.onPreExecute({
          type: job.risk ?? 'mutating',
          toolName: job.toolName,
          category: this.registry.get(job.toolName)?.definition.category,
          params: args,
          agentId: request.agentId ?? 'assistant-tools',
          origin: request.origin,
          scheduleId: request.scheduleId,
          channel: request.channel,
          principalId: request.principalId,
        });
      if (!evaluation.allowed) {
        job.status = 'denied';
        job.completedAt = this.now();
        job.durationMs = job.completedAt - (job.startedAt ?? job.createdAt);
        job.error = `Blocked by Guardian Agent: ${evaluation.reason ?? 'action deemed too risky'}`;
        const definition = this.registry.get(job.toolName)?.definition;
        if (definition) {
          this.recordToolChainOutcome(definition, request, job.argsHash, job.status);
        }
        return {
          success: false,
          status: job.status,
            jobId: job.id,
            message: job.error,
          };
        }
      } catch (err) {
        // Guardian Agent evaluation failed — fail-closed (block action)
        job.status = 'denied';
        job.completedAt = this.now();
        job.durationMs = job.completedAt - (job.startedAt ?? job.createdAt);
        job.error = `Blocked: Guardian Agent evaluation unavailable — ${err instanceof Error ? err.message : String(err)}`;
        const definition = this.registry.get(job.toolName)?.definition;
        if (definition) {
          this.recordToolChainOutcome(definition, request, job.argsHash, job.status);
        }
        return {
          success: false,
          status: job.status,
          jobId: job.id,
          message: job.error,
        };
      }
    }

    try {
      const result = await handler(args, request);
      if (!result.success) {
        const fullError = result.error ?? 'Tool failed.';
        job.status = 'failed';
        job.error = sanitizePreview(fullError);
        job.completedAt = this.now();
        job.durationMs = job.completedAt - (job.startedAt ?? job.createdAt);
        const definition = this.registry.get(job.toolName)?.definition;
        if (definition) {
          this.recordToolChainOutcome(definition, request, job.argsHash, job.status);
        }
        return {
          success: false,
          status: job.status,
          jobId: job.id,
          message: fullError,
        };
      }

      job.status = 'succeeded';
      job.completedAt = this.now();
      job.durationMs = job.completedAt - (job.startedAt ?? job.createdAt);
      job.resultPreview = sanitizePreview(JSON.stringify(result.output ?? {}));
      const verification = await this.verifyExecution(job.toolName, args, result);
      job.verificationStatus = verification.status;
      job.verificationEvidence = verification.evidence;
      const successMessage = extractToolSuccessMessage(job.toolName, result.output, result.message);
      
      const successResponse: ToolRunResponse = {
        success: true,
        status: job.status,
        jobId: job.id,
        message: successMessage,
        output: result.output,
        verificationStatus: verification.status,
      };
      
      this.options.onToolExecuted?.(
        request.toolName,
        args,
        {
          success: successResponse.success,
          status: successResponse.status,
          message: successResponse.message,
          durationMs: job.durationMs,
          approvalId: job.approvalId,
        },
        request
      );
      
      return successResponse;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      job.status = 'failed';
      job.error = sanitizePreview(message);
      job.completedAt = this.now();
      job.durationMs = job.completedAt - (job.startedAt ?? job.createdAt);
      const definition = this.registry.get(job.toolName)?.definition;
      if (definition) {
        this.recordToolChainOutcome(definition, request, job.argsHash, job.status);
      }
      
      const failedResponse: ToolRunResponse = {
        success: false,
        status: job.status,
        jobId: job.id,
        message,
      };
      
      this.options.onToolExecuted?.(
        request.toolName,
        args,
        {
          success: failedResponse.success,
          status: failedResponse.status,
          message: failedResponse.message,
          error: job.error,
          durationMs: job.durationMs,
          approvalId: job.approvalId,
        },
        request
      );
      
      return failedResponse;
    }
  }

  private async verifyExecution(
    toolName: string,
    args: Record<string, unknown>,
    result: ToolResult,
  ): Promise<{ status: import('./types.js').VerificationStatus; evidence: string }> {
    if (result.verificationStatus) {
      return {
        status: result.verificationStatus,
        evidence: result.verificationEvidence ?? 'Tool provided explicit verification state.',
      };
    }

    switch (toolName) {
      case 'memory_save': {
        const output = isRecord(result.output) ? result.output : {};
        const memoryStore = this.options.agentMemoryStore;
        const agentId = typeof output.agentId === 'string' ? output.agentId : '';
        const entryId = typeof output.entryId === 'string' ? output.entryId : '';
        if (memoryStore && agentId && entryId) {
          return memoryStore.isEntryActive(agentId, entryId)
            ? { status: 'verified', evidence: `Memory entry ${entryId} is active.` }
            : { status: 'unverified', evidence: `Memory entry ${entryId} is not active.` };
        }
        return { status: 'unverified', evidence: 'Memory entry identity missing from tool output.' };
      }
      case 'automation_save': {
        const automationId = typeof args.id === 'string' ? args.id.trim() : '';
        const automation = automationId
          ? this.automationControlPlane?.listAutomations().find((entry) => entry.id === automationId)
          : undefined;
        if (automation) {
          return { status: 'verified', evidence: `Automation ${automation.id} exists.` };
        }
        const output = isRecord(result.output) ? result.output : {};
        const savedId = asString(output.automationId).trim();
        if (savedId && this.automationControlPlane?.listAutomations().some((entry) => entry.id === savedId)) {
          return { status: 'verified', evidence: `Automation ${savedId} exists.` };
        }
        return { status: 'unverified', evidence: 'Automation was not found after save.' };
      }
      default:
        return { status: 'unverified', evidence: 'No verifier is defined for this tool.' };
    }
  }

  private buildDryRunPreview(toolName: string, args: Record<string, unknown>): string {
    switch (toolName) {
      case 'fs_write':
        return `Would ${args.append ? 'append to' : 'write'} file '${args.path}' (${String(args.content ?? '').length} chars)`;
      case 'doc_create':
        return `Would create document '${args.filename}'`;
      case 'run_command':
        return `Would execute: ${args.command}`;
      case 'http_fetch':
        return `Would fetch URL: ${args.url}`;
      case 'web_search':
        return `Would search the web for: "${args.query}" (provider: ${args.provider || 'auto'})`;
      case 'web_fetch':
        return `Would fetch and extract content from: ${args.url}`;
      case 'forum_post':
        return `Would post to forum thread '${args.threadId}'`;
      case 'intel_action':
        return `Would perform intel action '${args.action}' on finding '${args.findingId}'`;
      case 'whm_accounts': {
        const action = asString(args.action, 'list').trim().toLowerCase();
        if (action === 'create') {
          return `Would create WHM account '${args.username}' for domain '${args.domain}'`;
        }
        if (action === 'suspend' || action === 'unsuspend' || action === 'modify' || action === 'remove') {
          return `Would ${action} WHM account '${args.username}'`;
        }
        return `Would list WHM accounts for profile '${args.profile}'`;
      }
      case 'cpanel_domains': {
        const action = asString(args.action).trim().toLowerCase();
        if (action === 'add_subdomain') {
          return `Would add subdomain '${args.domain}' under '${args.rootDomain}'`;
        }
        if (action === 'delete_subdomain') {
          return `Would delete subdomain '${args.domain}' under '${args.rootDomain}'`;
        }
        if (action === 'add_redirect') {
          return `Would add redirect for '${args.domain}' to '${args.destination}'`;
        }
        if (action === 'delete_redirect') {
          return `Would delete redirect '${args.redirectId}'`;
        }
        return `Would inspect domains for profile '${args.profile}'`;
      }
      case 'cpanel_dns': {
        const action = asString(args.action).trim().toLowerCase();
        if (action === 'mass_edit_zone') {
          return `Would apply DNS changes to zone '${args.zone}'`;
        }
        return `Would parse DNS zone '${args.zone}'`;
      }
      case 'cpanel_backups':
        return asString(args.action, 'list').trim().toLowerCase() === 'create'
          ? `Would create a full backup for profile '${args.profile}'`
          : `Would list backups for profile '${args.profile}'`;
      case 'cpanel_ssl': {
        const action = asString(args.action).trim().toLowerCase();
        if (action === 'install_ssl') return `Would install SSL for '${args.domain}'`;
        if (action === 'delete_ssl') return `Would delete SSL for '${args.domain}'`;
        if (action === 'fetch_best_for_domain') return `Would inspect best SSL certificate for '${args.domain}'`;
        return `Would list SSL certificates for profile '${args.profile}'`;
      }
      case 'vercel_status':
        return `Would summarize Vercel account status for profile '${args.profile}'`;
      case 'vercel_projects': {
        const action = asString(args.action, 'list').trim().toLowerCase();
        if (action === 'create') return `Would create Vercel project '${args.name ?? '(from settings)'}'`;
        if (action === 'update') return `Would update Vercel project '${args.project}'`;
        if (action === 'delete') return `Would delete Vercel project '${args.project}'`;
        if (action === 'get') return `Would inspect Vercel project '${args.project}'`;
        return `Would list Vercel projects for profile '${args.profile}'`;
      }
      case 'vercel_deployments': {
        const action = asString(args.action, 'list').trim().toLowerCase();
        if (action === 'create') return `Would create a Vercel deployment for project '${args.project ?? '(from deployment payload)'}'`;
        if (action === 'cancel') return `Would cancel Vercel deployment '${args.deploymentId}'`;
        if (action === 'promote') return `Would promote deployment '${args.deploymentId}' for project '${args.project}'`;
        if (action === 'get') return `Would inspect Vercel deployment '${args.deploymentId}'`;
        return `Would list Vercel deployments for profile '${args.profile}'`;
      }
      case 'vercel_domains': {
        const action = asString(args.action, 'list').trim().toLowerCase();
        if (action === 'add') return `Would add Vercel domain '${args.domain}' to project '${args.project}'`;
        if (action === 'update') return `Would update Vercel domain '${args.domain}' on project '${args.project}'`;
        if (action === 'remove') return `Would remove Vercel domain '${args.domain}' from project '${args.project}'`;
        if (action === 'verify') return `Would verify Vercel domain '${args.domain}' on project '${args.project}'`;
        if (action === 'get') return `Would inspect Vercel domain '${args.domain}' on project '${args.project}'`;
        return `Would list Vercel domains for project '${args.project}'`;
      }
      case 'vercel_env': {
        const action = asString(args.action, 'list').trim().toLowerCase();
        if (action === 'create') return `Would create Vercel env '${args.key ?? '(from env payload)'}' on project '${args.project}'`;
        if (action === 'update') return `Would update Vercel env '${args.envId}' on project '${args.project}'`;
        if (action === 'delete') return `Would delete Vercel env '${args.envId}' on project '${args.project}'`;
        return `Would list Vercel env vars for project '${args.project}'`;
      }
      case 'vercel_logs':
        return asString(args.action, 'runtime').trim().toLowerCase() === 'events'
          ? `Would fetch Vercel deployment events for '${args.deploymentId}'`
          : `Would fetch Vercel runtime logs for deployment '${args.deploymentId}'`;
      case 'cf_status':
        return `Would summarize Cloudflare zones for profile '${args.profile}'`;
      case 'cf_dns': {
        const action = asString(args.action, 'list').trim().toLowerCase();
        if (action === 'create') return `Would create Cloudflare DNS record '${args.type} ${args.name}'`;
        if (action === 'update') return `Would update Cloudflare DNS record '${args.recordId}'`;
        if (action === 'delete') return `Would delete Cloudflare DNS record '${args.recordId}'`;
        if (action === 'get') return `Would inspect Cloudflare DNS record '${args.recordId}'`;
        return `Would list Cloudflare DNS records for zone '${args.zoneId ?? args.zone ?? '(default)'}'`;
      }
      case 'cf_ssl': {
        const action = asString(args.action, 'list_settings').trim().toLowerCase();
        if (action === 'update_setting') return `Would set Cloudflare SSL setting '${args.settingId}'`;
        if (action === 'get_setting') return `Would inspect Cloudflare SSL setting '${args.settingId}'`;
        return `Would list Cloudflare SSL settings for zone '${args.zoneId ?? args.zone ?? '(default)'}'`;
      }
      case 'cf_cache': {
        const action = asString(args.action, 'purge_everything').trim().toLowerCase();
        if (action === 'purge_files') return `Would purge ${asStringArray(args.files).length} Cloudflare cached file URLs for zone '${args.zoneId ?? args.zone ?? '(default)'}'`;
        if (action === 'purge_tags') return `Would purge Cloudflare cache tags for zone '${args.zoneId ?? args.zone ?? '(default)'}'`;
        if (action === 'purge_hosts') return `Would purge Cloudflare cache hosts for zone '${args.zoneId ?? args.zone ?? '(default)'}'`;
        if (action === 'purge_prefixes') return `Would purge Cloudflare cache prefixes for zone '${args.zoneId ?? args.zone ?? '(default)'}'`;
        return `Would purge all Cloudflare cache for zone '${args.zoneId ?? args.zone ?? '(default)'}'`;
      }
      case 'aws_status':
        return `Would inspect AWS account status for profile '${args.profile}'`;
      case 'aws_ec2_instances': {
        const action = asString(args.action, 'list').trim().toLowerCase();
        if (action === 'start' || action === 'stop' || action === 'reboot') return `Would ${action} EC2 instances '${asStringArray(args.instanceIds).join(', ')}'`;
        if (action === 'describe') return `Would describe EC2 instances '${asStringArray(args.instanceIds).join(', ')}'`;
        return `Would list EC2 instances for profile '${args.profile}'`;
      }
      case 'aws_ec2_security_groups': {
        const action = asString(args.action, 'list').trim().toLowerCase();
        if (action === 'authorize_ingress' || action === 'revoke_ingress') return `Would ${action} on security group '${args.groupId}'`;
        return `Would list EC2 security groups for profile '${args.profile}'`;
      }
      case 'aws_s3_buckets': {
        const action = asString(args.action, 'list_buckets').trim().toLowerCase();
        if (action === 'create_bucket') return `Would create S3 bucket '${args.bucket}'`;
        if (action === 'delete_bucket') return `Would delete S3 bucket '${args.bucket}'`;
        if (action === 'put_object') return `Would put S3 object '${args.key}' in bucket '${args.bucket}'`;
        if (action === 'delete_object') return `Would delete S3 object '${args.key}' in bucket '${args.bucket}'`;
        if (action === 'get_object') return `Would fetch S3 object '${args.key}' from bucket '${args.bucket}'`;
        if (action === 'list_objects') return `Would list S3 objects in bucket '${args.bucket}'`;
        return `Would list S3 buckets for profile '${args.profile}'`;
      }
      case 'aws_route53': {
        const action = asString(args.action, 'list_zones').trim().toLowerCase();
        if (action === 'change_records') return `Would change Route53 records in hosted zone '${args.hostedZoneId}'`;
        if (action === 'list_records') return `Would list Route53 records in hosted zone '${args.hostedZoneId}'`;
        return `Would list Route53 hosted zones for profile '${args.profile}'`;
      }
      case 'aws_lambda': {
        const action = asString(args.action, 'list').trim().toLowerCase();
        if (action === 'invoke') return `Would invoke Lambda function '${args.functionName}'`;
        if (action === 'get') return `Would inspect Lambda function '${args.functionName}'`;
        return `Would list Lambda functions for profile '${args.profile}'`;
      }
      case 'aws_cloudwatch': {
        const action = asString(args.action, 'metrics').trim().toLowerCase();
        if (action === 'logs') return `Would fetch CloudWatch logs for '${args.logGroupName}'`;
        if (action === 'alarms') return `Would list CloudWatch alarms for profile '${args.profile}'`;
        return `Would list CloudWatch metrics for profile '${args.profile}'`;
      }
      case 'aws_rds': {
        const action = asString(args.action, 'list').trim().toLowerCase();
        if (action === 'start' || action === 'stop' || action === 'reboot') return `Would ${action} RDS instance '${args.dbInstanceIdentifier}'`;
        return `Would list RDS instances for profile '${args.profile}'`;
      }
      case 'aws_iam': {
        const action = asString(args.action, 'list_users').trim().toLowerCase();
        return `Would run AWS IAM action '${action}' for profile '${args.profile}'`;
      }
      case 'aws_costs':
        return `Would query AWS cost and usage for profile '${args.profile}'`;
      case 'gcp_status':
        return `Would inspect GCP project status for profile '${args.profile}'`;
      case 'gcp_compute': {
        const action = asString(args.action, 'list').trim().toLowerCase();
        if (action === 'start' || action === 'stop' || action === 'reset') return `Would ${action} GCE instance '${args.instance}' in zone '${args.zone}'`;
        if (action === 'get') return `Would inspect GCE instance '${args.instance}' in zone '${args.zone}'`;
        return `Would list GCE instances for profile '${args.profile}'`;
      }
      case 'gcp_cloud_run': {
        const action = asString(args.action, 'list_services').trim().toLowerCase();
        if (action === 'get_service') return `Would inspect Cloud Run service '${args.service}'`;
        if (action === 'update_traffic') return `Would update Cloud Run traffic for service '${args.service}'`;
        if (action === 'delete_service') return `Would delete Cloud Run service '${args.service}'`;
        if (action === 'list_revisions') return `Would list Cloud Run revisions in location '${args.location ?? '(profile default)'}'`;
        return `Would list Cloud Run services in location '${args.location ?? '(profile default)'}'`;
      }
      case 'gcp_storage': {
        const action = asString(args.action, 'list_buckets').trim().toLowerCase();
        if (action === 'create_bucket') return `Would create GCS bucket '${args.bucket}'`;
        if (action === 'delete_bucket') return `Would delete GCS bucket '${args.bucket}'`;
        if (action === 'put_object') return `Would put GCS object '${args.object}' in bucket '${args.bucket}'`;
        if (action === 'delete_object') return `Would delete GCS object '${args.object}' from bucket '${args.bucket}'`;
        if (action === 'get_object') return `Would fetch GCS object '${args.object}' from bucket '${args.bucket}'`;
        if (action === 'list_objects') return `Would list GCS objects in bucket '${args.bucket}'`;
        return `Would list GCS buckets for profile '${args.profile}'`;
      }
      case 'gcp_dns': {
        const action = asString(args.action, 'list_zones').trim().toLowerCase();
        if (action === 'change_records') return `Would change Cloud DNS records in managed zone '${args.managedZone}'`;
        if (action === 'list_records') return `Would list Cloud DNS records in managed zone '${args.managedZone}'`;
        return `Would list Cloud DNS managed zones for profile '${args.profile}'`;
      }
      case 'gcp_logs':
        return `Would query Cloud Logging entries for profile '${args.profile}'`;
      case 'azure_status':
        return `Would inspect Azure subscription status for profile '${args.profile}'`;
      case 'azure_vms': {
        const action = asString(args.action, 'list').trim().toLowerCase();
        if (action === 'start' || action === 'stop' || action === 'restart' || action === 'deallocate') return `Would ${action} Azure VM '${args.vmName}'`;
        if (action === 'get') return `Would inspect Azure VM '${args.vmName}'`;
        return `Would list Azure VMs for profile '${args.profile}'`;
      }
      case 'azure_app_service': {
        const action = asString(args.action, 'list').trim().toLowerCase();
        if (action === 'delete') return `Would delete Azure Web App '${args.name}'`;
        if (action === 'restart') return `Would restart Azure Web App '${args.name}'`;
        if (action === 'config') return `Would inspect Azure Web App config for '${args.name}'`;
        if (action === 'get') return `Would inspect Azure Web App '${args.name}'`;
        return `Would list Azure Web Apps for profile '${args.profile}'`;
      }
      case 'azure_storage': {
        const action = asString(args.action, 'list_accounts').trim().toLowerCase();
        if (action === 'create_container') return `Would create Azure blob container '${args.container}' in account '${args.accountName}'`;
        if (action === 'delete_container') return `Would delete Azure blob container '${args.container}' in account '${args.accountName}'`;
        if (action === 'put_blob') return `Would upload blob '${args.blobName}' to container '${args.container}'`;
        if (action === 'delete_blob') return `Would delete blob '${args.blobName}' from container '${args.container}'`;
        if (action === 'list_blobs') return `Would list blobs in container '${args.container}'`;
        if (action === 'list_containers') return `Would list containers for storage account '${args.accountName}'`;
        return `Would list Azure storage accounts for profile '${args.profile}'`;
      }
      case 'azure_dns': {
        const action = asString(args.action, 'list_zones').trim().toLowerCase();
        if (action === 'upsert_record_set') return `Would upsert Azure DNS record set '${args.relativeRecordSetName}'`;
        if (action === 'delete_record_set') return `Would delete Azure DNS record set '${args.relativeRecordSetName}'`;
        if (action === 'list_records') return `Would list Azure DNS records for zone '${args.zoneName}'`;
        return `Would list Azure DNS zones for profile '${args.profile}'`;
      }
      case 'azure_monitor': {
        const action = asString(args.action, 'activity_logs').trim().toLowerCase();
        if (action === 'metrics') return `Would fetch Azure Monitor metrics for resource '${args.resourceId}'`;
        return `Would list Azure activity logs for profile '${args.profile}'`;
      }
      case 'whm_dns': {
        const action = asString(args.action, 'list').trim().toLowerCase();
        if (action === 'create_zone') return `Would create WHM DNS zone '${args.domain}'`;
        if (action === 'delete_zone') return `Would delete WHM DNS zone '${args.domain}'`;
        if (action === 'reset_zone') return `Would reset WHM DNS zone '${args.domain}'`;
        if (action === 'parse_zone') return `Would parse WHM DNS zone '${args.zone}'`;
        return `Would list WHM DNS zones for profile '${args.profile}'`;
      }
      case 'whm_ssl': {
        const action = asString(args.action).trim().toLowerCase();
        if (action === 'set_provider') return `Would set WHM AutoSSL provider to '${args.provider}'`;
        if (action === 'check_user') return `Would start AutoSSL check for '${args.username}'`;
        if (action === 'check_all') return 'Would start AutoSSL checks for all users';
        if (action === 'set_excluded_domains') return `Would update AutoSSL excluded domains for '${args.username}'`;
        if (action === 'get_excluded_domains') return `Would list AutoSSL excluded domains for '${args.username}'`;
        return `Would list WHM AutoSSL providers for profile '${args.profile}'`;
      }
      case 'whm_backup': {
        const action = asString(args.action).trim().toLowerCase();
        if (action === 'config_set') return `Would update WHM backup configuration for profile '${args.profile}'`;
        if (action === 'toggle_all') return `Would set WHM backup skip-all=${!!args.state} for version '${args.backupVersion ?? 'backup'}'`;
        if (action === 'user_list') return `Would list backup users for restore point '${args.restorePoint}'`;
        return `Would inspect WHM backup state with action '${action}'`;
      }
      case 'whm_services': {
        const action = asString(args.action).trim().toLowerCase();
        if (action === 'restart') return `Would restart WHM service '${args.service}'`;
        if (action === 'get_config') return `Would fetch WHM service config for '${args.service}'`;
        return `Would inspect WHM service status for profile '${args.profile}'`;
      }
      default:
        return `Would execute tool '${toolName}' with args: ${sanitizePreview(JSON.stringify(args))}`;
    }
  }

  private buildCodingPlan(task: string, cwd: string, selectedFiles: string[]): Record<string, unknown> {
    const normalizedTask = task.trim();
    const lower = normalizedTask.toLowerCase();
    const inspect = selectedFiles.length > 0 ? selectedFiles : ['relevant source files', 'tests', 'config'];
    const changes: string[] = [];
    const verification: string[] = [];
    const risks: string[] = [];

    if (/refactor|cleanup|restructure/.test(lower)) {
      changes.push('Restructure implementation while preserving behavior.');
      verification.push('Run targeted tests covering affected flows.');
      risks.push('Behavior regressions caused by broad mechanical edits.');
    }
    if (/fix|bug|issue|error|fail/.test(lower)) {
      changes.push('Patch the failing logic and add or update regression coverage.');
      verification.push('Reproduce the original failure, then rerun the failing checks.');
      risks.push('Fixing symptoms without addressing the root cause.');
    }
    if (/feature|implement|add support|introduce/.test(lower)) {
      changes.push('Add the requested functionality and integrate it with existing patterns.');
      verification.push('Run focused tests and a build/lint pass if available.');
      risks.push('Scope creep into unrelated modules.');
    }

    if (changes.length === 0) {
      changes.push('Inspect the relevant code paths and make the minimum safe change needed.');
    }
    if (verification.length === 0) {
      verification.push('Run the narrowest available verification for the touched area.');
    }
    if (risks.length === 0) {
      risks.push('Unknown constraints until the relevant files are inspected.');
    }

    return {
      goal: normalizedTask,
      cwd,
      inspect,
      changes,
      verification,
      risks,
      plan: [
        'Inspect the files and tests most likely to be affected.',
        'Confirm the intended change boundary before editing.',
        'Make the smallest coherent code change.',
        'Review the diff and run targeted verification.',
      ],
    };
  }

  private async buildCodingQualityReportForFiles(paths: string[], cwd?: string): Promise<CodingQualityReport> {
    const checks: CodingQualityCheck[] = [];
    let largeChangeDetected = false;

    for (const path of paths) {
      try {
        const content = await readFile(path, 'utf-8');
        const debugArtifacts = collectDebugArtifactMatches(content);
        const incompleteMarkers = collectIncompleteMarkers(content);
        const lineCount = content.split('\n').length;

        checks.push({
          name: `debug_artifacts:${path}`,
          status: debugArtifacts.length > 0 ? 'warn' : 'pass',
          details: debugArtifacts.length > 0
            ? `Detected debug-oriented patterns: ${debugArtifacts.join(', ')}.`
            : 'No obvious debug artifacts detected.',
        });
        checks.push({
          name: `incomplete_markers:${path}`,
          status: incompleteMarkers.length > 0 ? 'warn' : 'pass',
          details: incompleteMarkers.length > 0
            ? `Detected incomplete markers: ${incompleteMarkers.join(', ')}.`
            : 'No TODO/FIXME markers detected.',
        });
        if (lineCount > 500) {
          largeChangeDetected = true;
        }
      } catch {
        checks.push({
          name: `file_read:${path}`,
          status: 'warn',
          details: 'Unable to re-read file for quality inspection.',
        });
      }
    }

    checks.push({
      name: 'large_change',
      status: largeChangeDetected ? 'warn' : 'pass',
      details: largeChangeDetected
        ? 'At least one touched file exceeds 500 lines after the change. Review scope carefully.'
        : 'No large-file warning triggered.',
    });

    if (cwd) {
      try {
        const { stdout, stderr } = await this.sandboxExec('git diff --stat', 'read-only', { cwd, timeout: 15_000, maxBuffer: 200_000 });
        const diffSummary = truncateOutput(stdout || stderr || '').trim();
        checks.push({
          name: 'git_diff_stat',
          status: diffSummary ? 'pass' : 'not_run',
          details: diffSummary || 'git diff --stat returned no output.',
        });
      } catch {
        checks.push({
          name: 'git_diff_stat',
          status: 'not_run',
          details: 'git diff --stat unavailable for this workspace.',
        });
      }
    }

    return {
      passed: checks.every((check) => check.status !== 'fail'),
      checks,
    };
  }

  private registerBuiltinTools(): void {
    // ── find_tools meta-tool (always loaded) ──
    this.registry.register(
      {
        name: 'find_tools',
        description: 'Search available tools by keyword. Returns matching tool names and schemas so you can call them. IMPORTANT: Most tools are not visible until you search for them. If a user asks you to use a specific tool by name, or you need a tool that is not in your current list, you MUST call find_tools first to load it.',
        shortDescription: 'Search and load tools by keyword. IMPORTANT: call this first to discover tools not in your current list.',
        risk: 'read_only',
        category: 'system',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search keywords (e.g. "network scan", "file write", "email").' },
            maxResults: { type: 'number', description: 'Maximum tools to return (default: 10).' },
          },
          required: ['query'],
        },
        examples: [
          { input: { query: 'network scan' }, description: 'Find network scanning tools' },
          { input: { query: 'file write create' }, description: 'Find tools for creating/writing files' },
          { input: { query: 'email gmail send' }, description: 'Find email-related tools' },
        ],
      },
      async (args) => {
        const query = (args.query as string)?.trim();
        if (!query) return { success: false, error: 'query is required' };
        const maxResults = Math.min(20, Math.max(1, (args.maxResults as number) || 10));
        const matches = this.searchTools(query, maxResults);
        return {
          success: true,
          output: {
            query,
            matchCount: matches.length,
            tools: matches.map((def) => ({
              name: def.name,
              description: def.shortDescription ?? def.description,
              category: def.category,
              risk: def.risk,
              parameters: def.parameters,
              examples: def.examples,
            })),
          },
        };
      },
    );

    registerBuiltinFilesystemTools({
      registry: this.registry,
      requireString,
      requireStringAllowEmpty,
      asString,
      asNumber,
      guardAction: (request, action, details) => this.guardAction(request, action, details),
      resolveAllowedPath: (inputPath, request) => this.resolveAllowedPath(inputPath, request),
      maxSearchResults: MAX_SEARCH_RESULTS,
      maxSearchFiles: MAX_SEARCH_FILES,
      maxSearchFileBytes: MAX_SEARCH_FILE_BYTES,
      maxReadBytes: MAX_READ_BYTES,
    });

    this.registry.register(
      {
        name: 'package_install',
        description: 'Run a managed package install through Guardian\'s staged trust path. Supported in v1 for explicit public-registry npm/pnpm/yarn/bun add-style commands and pip install commands. Guardian stages the requested top-level artifacts, runs bounded static checks plus native AV when available, and only then proceeds with the install. Mutating — requires approval. Requires execute_commands capability.',
        shortDescription: 'Stage, review, and then run a managed package install.',
        risk: 'mutating',
        category: 'shell',
        examples: [
          { input: { command: 'npm install lodash' }, description: 'Stage and install a Node package through the managed trust path' },
          { input: { command: 'pip install requests', allowCaution: true }, description: 'Proceed with a managed pip install after accepting caution-level findings' },
        ],
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Package-manager command to run through the managed install path.' },
            cwd: { type: 'string', description: 'Optional working directory for the install command. Unlike shell_safe, this is not limited to allowedPaths.' },
            allowCaution: { type: 'boolean', description: 'Proceed when the staged review result is caution. Blocked findings still stop the install.' },
          },
          required: ['command'],
        },
      },
      async (args, request) => {
        if (!this.options.packageInstallTrust) {
          return { success: false, error: 'Managed package install trust is not available in this Guardian runtime.' };
        }
        const command = requireString(args.command, 'command').trim();
        const cwd = asString(args.cwd).trim() || undefined;
        const allowCaution = !!args.allowCaution;
        this.guardAction(request, 'execute_command', {
          command,
          cwd,
          managed: true,
          tool: 'package_install',
          allowCaution,
        });
        const result = await this.options.packageInstallTrust.runManagedInstall({
          command,
          cwd,
          allowCaution,
        });
        if (!result.success) {
          return {
            success: false,
            error: result.message,
          };
        }
        return {
          success: true,
          message: result.message,
          output: {
            status: result.status,
            alertId: result.alertId,
            event: result.event,
            message: result.message,
          },
        };
      },
    );

    this.registry.register(
      {
        name: 'shell_safe',
        description: 'Run an allowlisted shell command from the workspace root. Command prefix must match allowedCommands list. Max 60s timeout, 1MB output buffer. Security: command validated against allowlist before execution; simple direct-binary commands use structured direct exec when possible; inline interpreter eval, package launchers, and shell-expression launchers are blocked. Mutating — requires approval. Requires execute_commands capability.',
        shortDescription: 'Run an allowlisted shell command. Returns stdout, stderr, exit code.',
        risk: 'mutating',
        category: 'shell',
        examples: [
          { input: { command: 'git status' }, description: 'Check git repository status' },
          { input: { command: 'npm test', timeoutMs: 30000 }, description: 'Run tests with 30s timeout' },
        ],
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Command line to execute.' },
            cwd: { type: 'string', description: 'Optional working directory inside allowed paths. Defaults to workspace root.' },
            timeoutMs: { type: 'number', description: 'Timeout in milliseconds (max 60000).' },
          },
          required: ['command'],
        },
      },
      async (args, request) => {
        const command = requireString(args.command, 'command').trim();
        const cwd = args.cwd
          ? await this.resolveAllowedPath(requireString(args.cwd, 'cwd'), request)
          : this.getEffectiveWorkspaceRoot(request);
        const shellCheck = this.validateShellCommandForRequest(command, request, cwd);
        if (!shellCheck.safe) {
          return {
            success: false,
            error: shellCheck.reason ?? `Command is not allowlisted: '${command}'.`,
          };
        }
        const degradedPackageManagerReason = this.getDegradedPackageManagerBlockReason(command);
        if (degradedPackageManagerReason) {
          return {
            success: false,
            error: degradedPackageManagerReason,
          };
        }
        if (!shellCheck.plan) {
          return {
            success: false,
            error: 'Command failed execution planning.',
          };
        }
        const timeoutMs = Math.max(500, Math.min(60_000, asNumber(args.timeoutMs, 15_000)));
        const env = this.getCodeWorkspaceRoot(request)
          ? this.buildCodeShellEnv(this.getEffectiveWorkspaceRoot(request))
          : undefined;
        const executionPlan = await this.finalizeShellCommandPlan(
          shellCheck.plan,
          cwd,
          env,
        );
        const executionMetadata = {
          entryCommand: executionPlan.entryCommand,
          argv: executionPlan.argv,
          executionClass: executionPlan.executionClass,
          requestedViaShell: executionPlan.requestedViaShell,
          execMode: executionPlan.execMode,
          resolvedExecutable: executionPlan.resolvedExecutable,
        };
        const dependencyTracking = this.prepareJsDependencyTracking(shellCheck.plan.commands, cwd, request);
        this.guardAction(request, 'execute_command', {
          command,
          cwd,
          ...executionMetadata,
        });
        try {
          const { stdout, stderr } = executionPlan.execMode === 'direct_exec'
            ? await this.sandboxExecFile(
              executionPlan.resolvedExecutable ?? executionPlan.entryCommand,
              executionPlan.argv,
              'workspace-write',
              {
                cwd,
                timeout: timeoutMs,
                maxBuffer: 1_000_000,
                env,
              },
            )
            : await this.sandboxExec(command, 'workspace-write', {
              cwd,
              timeout: timeoutMs,
              maxBuffer: 1_000_000,
              env,
            });
          this.finalizeJsDependencyTracking(dependencyTracking, command);
          return {
            success: true,
            output: {
              command,
              cwd,
              entryCommand: executionPlan.entryCommand,
              argv: executionPlan.argv,
              executionClass: executionPlan.executionClass,
              requestedViaShell: executionPlan.requestedViaShell,
              execMode: executionPlan.execMode,
              resolvedExecutable: executionPlan.resolvedExecutable,
              stdout: truncateOutput(stdout),
              stderr: truncateOutput(stderr),
            },
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            success: false,
            error: `Command failed: ${message}`,
          };
        }
      },
    );

    this.registry.register(
      {
        name: 'code_session_list',
        description: 'List backend-owned coding sessions for the current user. Use this when the user wants to continue, inspect, or compare existing coding work across web, CLI, or Telegram.',
        shortDescription: 'List the current user\'s backend-owned coding sessions.',
        risk: 'read_only',
        category: 'coding',
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Maximum sessions to return (default 20).' },
          },
        },
      },
      async (args, request) => {
        const sessions = this.listOwnedCodeSessions(request)
          .slice(0, Math.max(1, Math.min(50, asNumber(args.limit, 20))))
          .map((session) => this.summarizeCodeSession(session));
        return {
          success: true,
          output: { sessions },
        };
      },
    );

    this.registry.register(
      {
        name: 'code_session_current',
        description: 'Show the coding session currently attached to this chat surface, if any.',
        shortDescription: 'Show the current attached coding session for this surface.',
        risk: 'read_only',
        category: 'coding',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      async (_args, request) => {
        if (!this.options.codeSessionStore) {
          return { success: false, error: 'Code session store is not available.' };
        }
        const userId = request.userId?.trim();
        const channel = request.channel?.trim();
        if (!userId || !channel) {
          return { success: false, error: 'Current user context is unavailable.' };
        }
        const resolved = this.options.codeSessionStore.resolveForRequest({
          userId,
          principalId: request.principalId,
          channel,
          surfaceId: this.getCodeSessionSurfaceId(request),
          touchAttachment: false,
        });
        return {
          success: true,
          output: {
            session: resolved ? this.summarizeCodeSession(resolved.session) : null,
            attached: !!resolved,
          },
        };
      },
    );

    this.registry.register(
      {
        name: 'code_session_create',
        description: 'Create a backend-owned coding session for a workspace. Use this to start repo-scoped coding work that can later be resumed from other channels.',
        shortDescription: 'Create a backend-owned coding session for a workspace.',
        risk: 'read_only',
        category: 'coding',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Human-readable title for the coding session.' },
            workspaceRoot: { type: 'string', description: 'Workspace or repo root for the coding session.' },
            agentId: { type: 'string', description: 'Optional bound agent id for the coding session.' },
            attach: { type: 'boolean', description: 'Attach the current chat surface to the new coding session.' },
          },
          required: ['title', 'workspaceRoot'],
        },
      },
      async (args, request) => {
        if (!this.options.codeSessionStore) {
          return { success: false, error: 'Code session store is not available.' };
        }
        const ownerUserId = request.userId?.trim();
        const channel = request.channel?.trim();
        if (!ownerUserId || !channel) {
          return { success: false, error: 'Current user context is unavailable.' };
        }
        const session = this.options.codeSessionStore.createSession({
          ownerUserId,
          ownerPrincipalId: request.principalId,
          title: requireString(args.title, 'title'),
          workspaceRoot: requireString(args.workspaceRoot, 'workspaceRoot'),
          agentId: asString(args.agentId, '').trim() || null,
        });
        if (args.attach !== false) {
          this.options.codeSessionStore.attachSession({
            sessionId: session.id,
            userId: ownerUserId,
            principalId: request.principalId,
            channel,
            surfaceId: this.getCodeSessionSurfaceId(request),
            mode: 'controller',
          });
        }
        return {
          success: true,
          output: {
            session: this.summarizeCodeSession(session),
            attached: args.attach !== false,
          },
        };
      },
    );

    this.registry.register(
      {
        name: 'code_session_attach',
        description: 'Attach this chat surface to an existing backend-owned coding session so later messages share that coding workspace and conversation context.',
        shortDescription: 'Attach this chat surface to an existing coding session.',
        risk: 'read_only',
        category: 'coding',
        parameters: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'The code session target to attach to. This can be an id, title, or workspace path match.' },
          },
          required: ['sessionId'],
        },
      },
      async (args, request) => {
        if (!this.options.codeSessionStore) {
          return { success: false, error: 'Code session store is not available.' };
        }
        const ownerUserId = request.userId?.trim();
        const channel = request.channel?.trim();
        if (!ownerUserId || !channel) {
          return { success: false, error: 'Current user context is unavailable.' };
        }
        const target = requireString(args.sessionId, 'sessionId').trim();
        const resolved = this.resolveOwnedCodeSessionTarget(target, request);
        if (!resolved.session) {
          return { success: false, error: resolved.error ?? `Code session '${target}' was not found for the current user.` };
        }
        const session = resolved.session;
        const attachment = this.options.codeSessionStore.attachSession({
          sessionId: session.id,
          userId: ownerUserId,
          principalId: request.principalId,
          channel,
          surfaceId: this.getCodeSessionSurfaceId(request),
          mode: 'controller',
        });
        return {
          success: true,
          output: {
            session: this.summarizeCodeSession(session),
            attachment,
          },
        };
      },
    );

    this.registry.register(
      {
        name: 'code_session_detach',
        description: 'Detach this chat surface from its current backend-owned coding session.',
        shortDescription: 'Detach this chat surface from the current coding session.',
        risk: 'read_only',
        category: 'coding',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      async (_args, request) => {
        if (!this.options.codeSessionStore) {
          return { success: false, error: 'Code session store is not available.' };
        }
        const ownerUserId = request.userId?.trim();
        const channel = request.channel?.trim();
        if (!ownerUserId || !channel) {
          return { success: false, error: 'Current user context is unavailable.' };
        }
        const detached = this.options.codeSessionStore.detachSession({
          userId: ownerUserId,
          channel,
          surfaceId: this.getCodeSessionSurfaceId(request),
        });
        return {
          success: true,
          output: { detached },
        };
      },
    );

    this.registry.register(
      {
        name: 'code_symbol_search',
        description: 'Search code symbols, identifiers, or text patterns inside a project tree. Delegates to filesystem search with code-oriented defaults.',
        shortDescription: 'Search symbols or identifiers in source trees.',
        risk: 'read_only',
        category: 'coding',
        deferLoading: true,
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Project or source root to search.' },
            query: { type: 'string', description: 'Symbol, identifier, or text to search for.' },
            mode: { type: 'string', description: "Search mode: 'name', 'content', or 'auto' (default: auto)." },
            maxResults: { type: 'number', description: 'Maximum matches to return (default 25).' },
          },
          required: ['query'],
        },
      },
      async (args, request) => {
        const delegate = this.registry.get('fs_search');
        if (!delegate) return { success: false, error: 'fs_search is not available' };
        return delegate.handler({
          path: asString(args.path, '.'),
          query: args.query,
          mode: asString(args.mode, 'auto'),
          maxResults: asNumber(args.maxResults, 25),
          maxDepth: 20,
          maxFiles: 25_000,
          maxFileBytes: 250_000,
        }, request);
      },
    );

    this.registry.register(
      {
        name: 'code_edit',
        description: 'Apply a targeted code edit using OpenDev-style progressive matching. Tries exact, line-ending-normalized, trimmed-line, indentation-insensitive, and whitespace-collapsed matching before failing.',
        shortDescription: 'Apply a targeted code edit with progressive block matching.',
        risk: 'mutating',
        category: 'coding',
        deferLoading: true,
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File to edit.' },
            oldString: { type: 'string', description: 'Existing code block to replace.' },
            newString: { type: 'string', description: 'Replacement code block.' },
          },
          required: ['path', 'oldString', 'newString'],
        },
      },
      async (args, request) => {
        const rawPath = requireString(args.path, 'path');
        const oldString = requireStringAllowEmpty(args.oldString, 'oldString');
        const newString = requireStringAllowEmpty(args.newString, 'newString');
        const safePath = await this.resolveAllowedPath(rawPath, request);
        const source = await readFile(safePath, 'utf-8');
        const match = findCodeEditRange(source, oldString);
        if (!match) {
          return {
            success: false,
            error: 'Unable to match oldString in target file after progressive code matching passes.',
          };
        }
        const next = source.slice(0, match.start) + newString + source.slice(match.end);
        const contentScan = scanWriteContent(next);
        if (contentScan.secrets.length > 0 || contentScan.pii.length > 0) {
          const findings = [
            ...new Set(contentScan.secrets.map((entry) => entry.pattern)),
            ...new Set(contentScan.pii.map((entry) => entry.label)),
          ];
          return {
            success: false,
            error: `Edited file rejected by security policy: ${findings.join(', ')}.`,
          };
        }
        this.guardAction(request, 'write_file', { path: rawPath, content: next });
        await writeFile(safePath, next, 'utf-8');
        const qualityReport = await this.buildCodingQualityReportForFiles([safePath], dirname(safePath));
        return {
          success: true,
          output: {
            path: safePath,
            strategy: match.strategy,
            bytes: Buffer.byteLength(next, 'utf-8'),
            qualityReport,
          },
        };
      },
    );

    this.registry.register(
      {
        name: 'code_patch',
        description: 'Apply a unified diff patch inside the workspace. Validates patch target paths and uses git apply semantics when available.',
        shortDescription: 'Apply a unified diff patch in the workspace.',
        risk: 'mutating',
        category: 'coding',
        deferLoading: true,
        parameters: {
          type: 'object',
          properties: {
            cwd: { type: 'string', description: 'Project root to apply the patch from. Defaults to workspace root.' },
            patch: { type: 'string', description: 'Unified diff patch to apply.' },
          },
          required: ['patch'],
        },
      },
      async (args, request) => {
        const patch = requireString(args.patch, 'patch');
        const cwd = args.cwd
          ? await this.resolveAllowedPath(requireString(args.cwd, 'cwd'), request)
          : this.getEffectiveWorkspaceRoot(request);
        const targets = extractPatchTargets(patch);
        if (targets.length === 0) {
          return { success: false, error: 'Patch did not contain any target files.' };
        }
        const resolvedTargets = await Promise.all(targets.map((target) => this.resolveAllowedPath(resolve(cwd, target), request)));
        this.guardAction(request, 'write_file', { cwd, files: targets, patch });

        const patchDir = resolve(this.getEffectiveWorkspaceRoot(request), '.guardianagent', 'tmp');
        await mkdir(patchDir, { recursive: true });
        const patchFile = resolve(patchDir, `patch-${randomUUID()}.diff`);
        await writeFile(patchFile, patch, 'utf-8');
        try {
          const env = this.getCodeWorkspaceRoot(request)
            ? this.buildCodeShellEnv(this.getEffectiveWorkspaceRoot(request))
            : undefined;
          await this.sandboxExecFile('git', ['apply', '--whitespace=nowarn', patchFile], 'workspace-write', {
            cwd,
            timeout: 30_000,
            maxBuffer: 500_000,
            env,
          });
        } catch (err) {
          return {
            success: false,
            error: `Patch failed: ${err instanceof Error ? err.message : String(err)}`,
          };
        } finally {
          await rm(patchFile, { force: true }).catch(() => undefined);
        }

        const qualityReport = await this.buildCodingQualityReportForFiles(resolvedTargets, cwd);
        return {
          success: true,
          output: {
            cwd,
            files: targets,
            qualityReport,
          },
        };
      },
    );

    this.registry.register(
      {
        name: 'code_create',
        description: 'Create a new source file inside the allowed workspace. Fails if the file already exists unless overwrite=true is provided.',
        shortDescription: 'Create a new source file in the workspace.',
        risk: 'mutating',
        category: 'coding',
        deferLoading: true,
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File to create.' },
            content: { type: 'string', description: 'Initial file contents.' },
            overwrite: { type: 'boolean', description: 'Allow replacing an existing file.' },
          },
          required: ['path', 'content'],
        },
      },
      async (args, request) => {
        const rawPath = requireString(args.path, 'path');
        const overwrite = !!args.overwrite;
        const safePath = await this.resolveAllowedPath(rawPath, request);
        try {
          await stat(safePath);
          if (!overwrite) {
            return {
              success: false,
              error: 'Target file already exists. Pass overwrite=true to replace it.',
            };
          }
        } catch {
          // File does not exist yet.
        }

        const delegate = this.registry.get('fs_write');
        if (!delegate) return { success: false, error: 'fs_write is not available' };
        const result = await delegate.handler({
          path: rawPath,
          content: requireStringAllowEmpty(args.content, 'content'),
          append: false,
        }, request);
        if (!result.success) return result;
        const qualityReport = await this.buildCodingQualityReportForFiles([safePath], dirname(safePath));
        return {
          ...result,
          output: {
            ...(isRecord(result.output) ? result.output : {}),
            qualityReport,
          },
        };
      },
    );

    this.registry.register(
      {
        name: 'code_plan',
        description: 'Generate a structured implementation plan for a coding task before making changes. Read-only helper for complex tasks.',
        shortDescription: 'Generate a structured coding plan.',
        risk: 'read_only',
        category: 'coding',
        deferLoading: true,
        parameters: {
          type: 'object',
          properties: {
            task: { type: 'string', description: 'Task or coding objective to plan.' },
            cwd: { type: 'string', description: 'Project root or working directory.' },
            selectedFiles: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional list of files already identified as relevant.',
            },
          },
          required: ['task'],
        },
      },
      async (args, request) => {
        const task = requireString(args.task, 'task');
        const cwd = args.cwd
          ? await this.resolveAllowedPath(requireString(args.cwd, 'cwd'), request)
          : this.getEffectiveWorkspaceRoot(request);
        const selectedFiles = Array.isArray(args.selectedFiles)
          ? args.selectedFiles.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          : [];
        return {
          success: true,
          output: this.buildCodingPlan(task, cwd, selectedFiles),
        };
      },
    );

    this.registry.register(
      {
        name: 'code_git_diff',
        description: 'Show git diff output for the current project or a specific file path. Executes from a validated working directory.',
        shortDescription: 'Show git diff for a project or file.',
        risk: 'read_only',
        category: 'coding',
        deferLoading: true,
        parameters: {
          type: 'object',
          properties: {
            cwd: { type: 'string', description: 'Project root to run git diff from.' },
            path: { type: 'string', description: 'Optional path to limit diff to a file or directory.' },
            staged: { type: 'boolean', description: 'Use --staged when true.' },
          },
          required: ['cwd'],
        },
      },
      async (args, request) => {
        const cwd = await this.resolveAllowedPath(requireString(args.cwd, 'cwd'), request);
        const staged = !!args.staged;
        const timeoutMs = Math.max(500, Math.min(60_000, asNumber(args.timeoutMs, 15_000)));
        const gitArgs = ['diff'];
        if (staged) gitArgs.push('--staged');
        const maybePath = asString(args.path, '').trim();
        if (maybePath) {
          const resolvedPath = await this.resolveAllowedPath(resolve(cwd, maybePath), request);
          const relativePath = relative(cwd, resolvedPath).replace(/\\/g, '/');
          gitArgs.push('--', relativePath || '.');
        }
        try {
          const env = this.getCodeWorkspaceRoot(request)
            ? this.buildCodeShellEnv(this.getEffectiveWorkspaceRoot(request))
            : undefined;
          const { stdout, stderr } = await this.sandboxExecFile('git', gitArgs, 'read-only', {
            cwd,
            timeout: timeoutMs,
            maxBuffer: 1_000_000,
            env,
          });
          return {
            success: true,
            output: {
              command: ['git', ...gitArgs].join(' '),
              cwd,
              stdout: truncateOutput(stdout),
              stderr: truncateOutput(stderr),
            },
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            success: false,
            error: `git diff failed: ${message}`,
          };
        }
      },
    );

    this.registry.register(
      {
        name: 'code_git_commit',
        description: 'Stage changes and create a git commit from a validated project directory. Mutating and approval-gated.',
        shortDescription: 'Stage changes and create a git commit.',
        risk: 'mutating',
        category: 'coding',
        deferLoading: true,
        parameters: {
          type: 'object',
          properties: {
            cwd: { type: 'string', description: 'Project root to commit from.' },
            message: { type: 'string', description: 'Commit message.' },
            paths: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional relative paths to stage. Defaults to all changes.',
            },
          },
          required: ['cwd', 'message'],
        },
      },
      async (args, request) => {
        const cwd = await this.resolveAllowedPath(requireString(args.cwd, 'cwd'), request);
        const message = requireString(args.message, 'message').trim();
        const paths = Array.isArray(args.paths)
          ? args.paths.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          : [];
        if (!message) {
          return { success: false, error: 'Commit message is required.' };
        }
        for (const target of paths) {
          await this.resolveAllowedPath(resolve(cwd, target), request);
        }
        this.guardAction(request, 'execute_command', { command: 'git commit', cwd, message, paths });
        const relativePaths = paths.length > 0
          ? await Promise.all(paths.map(async (target) => {
              const resolvedPath = await this.resolveAllowedPath(resolve(cwd, target), request);
              return relative(cwd, resolvedPath).replace(/\\/g, '/') || '.';
            }))
          : [];
        try {
          const env = this.getCodeWorkspaceRoot(request)
            ? this.buildCodeShellEnv(this.getEffectiveWorkspaceRoot(request))
            : undefined;
          await this.sandboxExecFile('git', relativePaths.length > 0 ? ['add', '--', ...relativePaths] : ['add', '-A'], 'workspace-write', {
            cwd,
            timeout: 30_000,
            maxBuffer: 500_000,
            env,
          });
          const { stdout, stderr } = await this.sandboxExecFile('git', ['commit', '-m', message], 'workspace-write', {
            cwd,
            timeout: 30_000,
            maxBuffer: 500_000,
            env,
          });
          return {
            success: true,
            output: {
              cwd,
              message,
              stdout: truncateOutput(stdout),
              stderr: truncateOutput(stderr),
            },
          };
        } catch (err) {
          return {
            success: false,
            error: `git commit failed: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      },
    );

    this.registry.register(
      {
        name: 'code_test',
        description: 'Run an allowlisted test command inside a validated project directory.',
        shortDescription: 'Run tests from a project directory.',
        risk: 'mutating',
        category: 'coding',
        deferLoading: true,
        parameters: {
          type: 'object',
          properties: {
            cwd: { type: 'string', description: 'Project root to run tests from.' },
            command: { type: 'string', description: 'Allowlisted test command to execute.' },
            timeoutMs: { type: 'number', description: 'Timeout in milliseconds (max 60000).' },
          },
          required: ['cwd', 'command'],
        },
      },
      async (args, request) => {
        const delegate = this.registry.get('shell_safe');
        if (!delegate) return { success: false, error: 'shell_safe is not available' };
        return delegate.handler({
          command: requireString(args.command, 'command'),
          cwd: requireString(args.cwd, 'cwd'),
          timeoutMs: asNumber(args.timeoutMs, 30_000),
        }, request);
      },
    );

    this.registry.register(
      {
        name: 'code_build',
        description: 'Run an allowlisted build command inside a validated project directory.',
        shortDescription: 'Run a build command from a project directory.',
        risk: 'mutating',
        category: 'coding',
        deferLoading: true,
        parameters: {
          type: 'object',
          properties: {
            cwd: { type: 'string', description: 'Project root to run the build from.' },
            command: { type: 'string', description: 'Allowlisted build command to execute.' },
            timeoutMs: { type: 'number', description: 'Timeout in milliseconds (max 60000).' },
          },
          required: ['cwd', 'command'],
        },
      },
      async (args, request) => {
        const delegate = this.registry.get('shell_safe');
        if (!delegate) return { success: false, error: 'shell_safe is not available' };
        return delegate.handler({
          command: requireString(args.command, 'command'),
          cwd: requireString(args.cwd, 'cwd'),
          timeoutMs: asNumber(args.timeoutMs, 30_000),
        }, request);
      },
    );

    this.registry.register(
      {
        name: 'code_lint',
        description: 'Run an allowlisted lint or static analysis command inside a validated project directory.',
        shortDescription: 'Run lint or static analysis from a project directory.',
        risk: 'mutating',
        category: 'coding',
        deferLoading: true,
        parameters: {
          type: 'object',
          properties: {
            cwd: { type: 'string', description: 'Project root to run the command from.' },
            command: { type: 'string', description: 'Allowlisted lint command to execute.' },
            timeoutMs: { type: 'number', description: 'Timeout in milliseconds (max 60000).' },
          },
          required: ['cwd', 'command'],
        },
      },
      async (args, request) => {
        const delegate = this.registry.get('shell_safe');
        if (!delegate) return { success: false, error: 'shell_safe is not available' };
        return delegate.handler({
          command: requireString(args.command, 'command'),
          cwd: requireString(args.cwd, 'cwd'),
          timeoutMs: asNumber(args.timeoutMs, 30_000),
        }, request);
      },
    );

    // ── Coding Backend Orchestration ──────────────────────────

    this.registry.register(
      {
        name: 'coding_backend_list',
        description: 'List available external coding CLI backends (Claude Code, Codex, Gemini CLI, etc.) and their status.',
        shortDescription: 'List configured coding backends.',
        risk: 'read_only',
        category: 'coding',
        deferLoading: true,
        parameters: { type: 'object', properties: {} },
      },
      async () => {
        if (!this.options.codingBackendService) {
          return { success: false, error: 'Coding backend orchestration is not enabled. Enable it in Configuration > Integrations > Coding Assistants.' };
        }
        const backends = this.options.codingBackendService.listBackends();
        return {
          success: true,
          output: {
            backends: backends.map((b) => ({
              id: b.id,
              name: b.name,
              enabled: b.enabled,
              command: b.command,
              preset: b.preset ?? false,
              installedVersion: b.installedVersion,
              updateAvailable: b.updateAvailable,
            })),
          },
        };
      },
    );

    this.registry.register(
      {
        name: 'coding_backend_run',
        description: 'Launch an external coding CLI (Claude Code, Codex, Gemini CLI, etc.) to perform a coding task in the current workspace. Opens a visible terminal tab so the user can observe progress. Returns structured results when the CLI finishes. After the backend completes, verify the work using code_git_diff, code_test, or code_build.',
        shortDescription: 'Delegate a coding task to an external coding CLI.',
        risk: 'mutating',
        category: 'coding',
        deferLoading: true,
        parameters: {
          type: 'object',
          properties: {
            task: { type: 'string', description: 'The coding task to delegate to the external CLI.' },
            backend: { type: 'string', description: 'Backend id (e.g. claude-code, codex, gemini-cli). Uses the default backend if omitted.' },
          },
          required: ['task'],
        },
        examples: [
          { input: { task: 'Add unit tests for the auth module', backend: 'claude-code' }, description: 'Delegate test authoring to Claude Code' },
          { input: { task: 'Fix the TypeScript compilation errors in src/api/' }, description: 'Delegate bug fix to default backend' },
        ],
      },
      async (args, request) => {
        if (!this.options.codingBackendService) {
          return { success: false, error: 'Coding backend orchestration is not enabled. Enable it in Configuration > Integrations > Coding Assistants.' };
        }
        const task = requireString(args.task, 'task');
        const backendId = typeof args.backend === 'string' ? args.backend.trim() : undefined;
        const codeSessionId = request.codeContext?.sessionId;
        if (!codeSessionId) {
          return { success: false, error: 'No active coding session. Create or attach to a coding session first.' };
        }
        const session = this.getCurrentCodeSessionRecord(request);
        const workspaceRoot = session?.resolvedRoot || session?.workspaceRoot;
        if (!workspaceRoot) {
          return { success: false, error: 'Could not determine workspace root for the current coding session.' };
        }
        const result = await this.options.codingBackendService.run({
          task,
          backendId,
          codeSessionId,
          workspaceRoot,
        });
        return {
          success: result.success,
          output: result,
        };
      },
    );

    this.registry.register(
      {
        name: 'coding_backend_status',
        description: 'Check the status of active or recent coding backend sessions in the current workspace.',
        shortDescription: 'Check status of coding backend sessions.',
        risk: 'read_only',
        category: 'coding',
        deferLoading: true,
        parameters: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Specific backend session id. Lists all recent if omitted.' },
          },
        },
      },
      async (args, request) => {
        if (!this.options.codingBackendService) {
          return { success: false, error: 'Coding backend orchestration is not enabled.' };
        }
        const sessionId = typeof args.sessionId === 'string' ? args.sessionId.trim() : undefined;
        const codeSessionId = request.codeContext?.sessionId?.trim();
        const sessions = this.options.codingBackendService
          .getStatus(sessionId)
          .filter((session) => sessionId || !codeSessionId || session.codeSessionId === codeSessionId);
        return {
          success: true,
          output: { sessions },
        };
      },
    );

    registerBuiltinWebTools({
      registry: this.registry,
      requireString,
      asNumber,
      asString,
      normalizeHttpUrlLikeInput,
      stripHtml,
      extractReadableContent,
      isHostAllowed: (host) => this.isHostAllowed(host),
      guardAction: (request, action, details) => this.guardAction(request, action, details),
      resolveSearchProvider: (value) => this.resolveSearchProvider(value),
      assertWebSearchHostsAllowed: (provider) => this.assertWebSearchHostsAllowed(provider),
      searchCache: this.searchCache,
      webSearchConfig: this.webSearchConfig,
      defaultSearchCacheTtlMs: SEARCH_CACHE_TTL_MS,
      now: () => this.now(),
      searchBrave: (query, maxResults) => this.searchBrave(query, maxResults),
      searchPerplexity: (query, maxResults) => this.searchPerplexity(query, maxResults),
      searchDuckDuckGo: (query, maxResults) => this.searchDuckDuckGo(query, maxResults),
      maxFetchBytes: MAX_FETCH_BYTES,
      maxWebFetchChars: MAX_WEB_FETCH_CHARS,
    });

    registerBuiltinContactsEmailTools({
      registry: this.registry,
      marketingStore: this.marketingStore,
      requireString,
      asNumber,
      asString,
      asStringArray,
      isHostAllowed: (host) => this.isHostAllowed(host),
      guardAction: (request, action, details) => this.guardAction(request, action, details),
      resolveAllowedPath: (inputPath, request) => this.resolveAllowedPath(inputPath, request),
      getGoogleService: () => this.options.googleService,
      assertGmailHostAllowed: () => this.assertGmailHostAllowed(),
      maxFetchBytes: MAX_FETCH_BYTES,
      maxCampaignRecipients: MAX_CAMPAIGN_RECIPIENTS,
    });

    registerBuiltinSecurityIntelTools({
      registry: this.registry,
      requireString,
      asString,
      asStringArray,
      asNumber,
      guardAction: (request, action, details) => this.guardAction(request, action, details),
      isHostAllowed: (host) => this.isHostAllowed(host),
      threatIntel: this.options.threatIntel,
      assistantSecurity: this.options.assistantSecurity,
      runAssistantSecurityScan: this.options.runAssistantSecurityScan,
      allowExternalPosting: this.options.allowExternalPosting,
      hostMonitor: this.options.hostMonitor,
      runHostMonitorCheck: this.options.runHostMonitorCheck,
      gatewayMonitor: this.options.gatewayMonitor,
      runGatewayMonitorCheck: this.options.runGatewayMonitorCheck,
      windowsDefender: this.options.windowsDefender,
      networkBaseline: this.options.networkBaseline,
      packageInstallTrust: this.options.packageInstallTrust,
      containmentService: this.options.containmentService,
    });

    // ── Network Tools ────────────────────────────────────────────

    this.registry.register(
      {
        name: 'net_ping',
        description: 'Ping a host to check reachability and measure latency. Returns packet loss and RTT stats. Security: restricted to private/local network addresses only (RFC1918, link-local, localhost) to prevent external reconnaissance. Requires network_access capability.',
        shortDescription: 'Ping a host to check reachability and measure latency.',
        risk: 'read_only',
        category: 'network',
        deferLoading: true,
        parameters: {
          type: 'object',
          properties: {
            host: { type: 'string', description: 'Host or IP to ping (private/local networks only).' },
            count: { type: 'number', description: 'Number of pings (1-10, default 4).' },
          },
          required: ['host'],
        },
      },
      async (args, request) => {
        const host = validateHostParam(requireString(args.host, 'host'));
        requireLocalNetwork(host);
        const count = Math.max(1, Math.min(10, asNumber(args.count, 4)));
        this.guardAction(request, 'network_probe', { host, count });
        const isWsl = process.platform === 'win32' && !!(process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP);
        const effectivePlatform = isWsl ? 'linux' : process.platform;
        let cmd: string;
        if (effectivePlatform === 'win32') {
          cmd = `ping -n ${count} ${host}`;
        } else if (effectivePlatform === 'darwin') {
          // macOS: -W is wait time in milliseconds per packet
          cmd = `ping -c ${count} -W 3000 ${host}`;
        } else {
          // Linux / WSL2: -W is overall deadline in seconds
          cmd = `ping -c ${count} -W 3 ${host}`;
        }
        try {
          const { stdout } = await this.sandboxExec(cmd, 'read-only', { networkAccess: true, timeout: 30_000 });
          const parsed = parsePingOutput(stdout, host);
          return { success: true, output: parsed };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (message.includes('100% packet loss') || message.includes('100.0% packet loss')) {
            return { success: true, output: { host, reachable: false, packetsSent: count, packetsReceived: 0, packetLossPercent: 100, rttAvgMs: null } };
          }
          if (isLoopbackTarget(host) && isPingPermissionDenied(message)) {
            return {
              success: true,
              output: {
                host,
                reachable: true,
                packetsSent: count,
                packetsReceived: count,
                packetLossPercent: 0,
                rttAvgMs: null,
                method: 'loopback_fallback',
              },
            };
          }
          return { success: false, error: `Ping failed: ${message}` };
        }
      },
    );

    this.registry.register(
      {
        name: 'net_arp_scan',
        description: 'Discover devices on the local network via ARP table. Uses ip neigh (Linux) or arp -a (macOS/Windows). Returns IP, MAC, and state for each neighbor. Security: local-only — reads system ARP cache. Requires network_access capability.',
        shortDescription: 'Discover devices on the local network. Returns IP, MAC, and state.',
        risk: 'read_only',
        category: 'network',
        deferLoading: true,
        parameters: {
          type: 'object',
        shortDescription: 'Discover contact emails from a public web page.',
          properties: {
            connectionId: { type: 'string', description: 'Optional assistant.network.connections id to scope scan behavior.' },
          },
        },
      },
      async (args, request) => {
        const connectionId = asString(args.connectionId).trim();
        const connection = connectionId ? this.getConnectionProfile(connectionId) : undefined;
        if (connectionId && !connection) {
          return { success: false, error: `Unknown network connection profile '${connectionId}'.` };
        }
        this.guardAction(request, 'network_probe', { action: 'arp_scan', connectionId: connectionId || undefined });

        if (connection?.type === 'remote') {
          if (!connection.host) {
            return { success: false, error: `Connection '${connection.id}' is remote but host is not configured.` };
          }
          const host = validateHostParam(connection.host);
          const sshUser = connection.sshUser ? sanitizeSshUser(connection.sshUser) : '';
          const sshTarget = `${sshUser ? `${sshUser}@` : ''}${host}`;
          const remoteCommand = (connection.remoteScanCommand?.trim() || 'ip neigh show')
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\$/g, '\\$')
            .replace(/`/g, '\\`')
            .replace(/!/g, '\\!');
          try {
            const { stdout } = await this.sandboxExec(
              `ssh -o BatchMode=yes -o ConnectTimeout=8 ${sshTarget} "${remoteCommand}"`,
              'read-only',
              { networkAccess: true, timeout: 30_000 },
            );
            const parsed = parseArpLinux(stdout);
            return {
              success: true,
              output: {
                connectionId: connection.id,
                connectionType: connection.type,
                devices: parsed.length > 0 ? parsed : parseArpWindows(stdout),
              },
            };
          } catch (err) {
            return { success: false, error: `Remote ARP scan failed: ${err instanceof Error ? err.message : String(err)}` };
          }
        }

        const isLinux = process.platform === 'linux';
        // Linux has `ip neigh show`; macOS and Windows use `arp -a`
        if (isLinux) {
          try {
            const iface = connection?.interface ? sanitizeInterfaceName(connection.interface) : '';
            const cmd = iface ? `ip neigh show dev ${iface}` : 'ip neigh show';
            const { stdout } = await this.sandboxExec(cmd, 'read-only', { networkAccess: true, timeout: 10_000 });
            return {
              success: true,
              output: {
                connectionId: connection?.id ?? null,
                connectionType: connection?.type ?? 'lan',
                devices: parseArpLinux(stdout),
              },
            };
          } catch {
            // Fallback to arp -a if ip command not available (e.g. minimal containers)
            try {
              const { stdout } = await this.sandboxExec('arp -a', 'read-only', { networkAccess: true, timeout: 10_000 });
              return {
                success: true,
                output: {
                  connectionId: connection?.id ?? null,
                  connectionType: connection?.type ?? 'lan',
                  devices: parseArpWindows(stdout),
                },
              };
            } catch (err2) {
              return { success: false, error: `ARP scan failed: ${err2 instanceof Error ? err2.message : String(err2)}` };
            }
          }
        }
        // macOS (darwin) and Windows both support `arp -a`
        try {
          const { stdout } = await this.sandboxExec('arp -a', 'read-only', { networkAccess: true, timeout: 10_000 });
          return {
            success: true,
            output: {
              connectionId: connection?.id ?? null,
              connectionType: connection?.type ?? (process.platform === 'darwin' ? 'wifi' : 'lan'),
              devices: parseArpWindows(stdout),
            },
          };
        } catch (err) {
          return { success: false, error: `ARP scan failed: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    );

    this.registry.register(
      {
        name: 'net_port_check',
        description: 'Check if TCP ports are open on a host. Tests up to 20 ports with 3s timeout each. Security: restricted to private/local network addresses only (RFC1918, link-local, localhost). Requires network_access capability.',
        shortDescription: 'Check if TCP ports are open on a host.',
        risk: 'read_only',
        category: 'network',
        deferLoading: true,
        parameters: {
          type: 'object',
          properties: {
            host: { type: 'string', description: 'Host or IP to check (private/local networks only).' },
            ports: { type: 'array', items: { type: 'number' }, description: 'Ports to check (max 20).' },
          },
          required: ['host', 'ports'],
        },
      },
      async (args, request) => {
        const host = validateHostParam(requireString(args.host, 'host'));
        requireLocalNetwork(host);
        const rawPorts = Array.isArray(args.ports) ? args.ports : [];
        const ports = rawPorts.slice(0, 20).map(Number).filter((p) => p > 0 && p <= 65535);
        if (ports.length === 0) return { success: false, error: 'No valid ports specified.' };
        this.guardAction(request, 'network_probe', { host, ports });
        const results = await Promise.all(
          ports.map((port) => checkTcpPort(host, port, 3000)),
        );
        return { success: true, output: { host, results } };
      },
    );

    this.registry.register(
      {
        name: 'net_interfaces',
        description: 'List network interfaces with IP addresses, MAC addresses, and netmasks. Read-only — reads from OS network stack. Requires network_access capability.',
        shortDescription: 'List network interfaces with IPs and MAC addresses.',
        risk: 'read_only',
        category: 'network',
        deferLoading: true,
        parameters: { type: 'object', properties: {} },
      },
      async (_args, request) => {
        const { networkInterfaces } = await import('node:os');
        this.guardAction(request, 'network_probe', { action: 'list_interfaces' });
        const ifaces = networkInterfaces();
        const interfaces = Object.entries(ifaces)
          .filter(([, addrs]) => addrs != null)
          .map(([name, addrs]) => ({
            name,
            mac: addrs![0]?.mac ?? 'unknown',
            addresses: addrs!.map((a) => ({
              address: a.address,
              family: a.family,
              netmask: a.netmask,
              internal: a.internal,
            })),
          }));
        return { success: true, output: { interfaces } };
      },
    );

    this.registry.register(
      {
        name: 'net_connections',
        description: 'List active network connections on this machine. Uses ss (Linux) or netstat -an (macOS/Windows). Optional state filter (ESTABLISHED, LISTEN, etc.). Read-only — reads from OS network stack. Requires network_access capability.',
        shortDescription: 'List active network connections on this machine.',
        risk: 'read_only',
        category: 'network',
        deferLoading: true,
        parameters: {
          type: 'object',
          properties: {
            state: { type: 'string', description: 'Optional filter: ESTABLISHED, LISTEN, TIME_WAIT, etc.' },
          },
        },
      },
      async (args, request) => {
        const stateFilter = asString(args.state).toUpperCase().trim();
        this.guardAction(request, 'network_probe', { action: 'list_connections', state: stateFilter || undefined });
        try {
          const connections = await this.collectLocalConnections(stateFilter);
          let ingest: ReturnType<NetworkTrafficService['ingestConnections']> | undefined;
          if (this.options.networkTraffic && this.networkConfig.trafficAnalysis.enabled) {
            ingest = this.options.networkTraffic.ingestConnections(
              connections.map((connection) => toTrafficSample(connection)),
            );
            if (ingest.threats.length > 0 && this.options.networkBaseline) {
              this.options.networkBaseline.recordExternalThreats(
                ingest.threats.map((threat) => ({
                  type: threat.type,
                  severity: threat.severity,
                  timestamp: threat.timestamp,
                  ip: threat.srcIp,
                  description: threat.description,
                  dedupeKey: threat.dedupeKey,
                  evidence: threat.evidence,
                })),
              );
            }
          }
          return { success: true, output: { connections, ingest } };
        } catch (err) {
          return { success: false, error: `Connections query failed: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    );

    this.registry.register(
      {
        name: 'net_dns_lookup',
        description: 'Resolve hostname to IPs or reverse-lookup an IP. Supports A, AAAA, MX, and PTR record types. Uses system DNS resolver. Requires network_access capability.',
        shortDescription: 'Resolve hostname to IPs or reverse-lookup an IP.',
        risk: 'read_only',
        category: 'network',
        deferLoading: true,
        parameters: {
          type: 'object',
          properties: {
            target: { type: 'string', description: 'Hostname or IP to resolve.' },
            type: { type: 'string', description: 'Record type: A, AAAA, MX, PTR (default: A).' },
          },
          required: ['target'],
        },
      },
      async (args, request) => {
        const target = validateHostParam(requireString(args.target, 'target'));
        const recordType = asString(args.type, 'A').toUpperCase();
        if (!['A', 'AAAA', 'MX', 'PTR'].includes(recordType)) {
          return { success: false, error: 'Unsupported record type. Use A, AAAA, MX, or PTR.' };
        }
        this.guardAction(request, 'network_probe', { target, type: recordType });
        const dns = await import('node:dns');
        const dnsPromises = dns.promises;

        // Try system resolver first, fall back to well-known public DNS
        const resolverConfigs: Array<string[] | null> = [null, ['8.8.8.8', '1.1.1.1']];
        for (const servers of resolverConfigs) {
          const resolver = new dnsPromises.Resolver();
          if (servers) resolver.setServers(servers);
          try {
            let records: string[];
            switch (recordType) {
              case 'AAAA':
                records = await resolver.resolve6(target);
                break;
              case 'MX':
                records = (await resolver.resolveMx(target)).map((r) => `${r.priority} ${r.exchange}`);
                break;
              case 'PTR':
                records = await resolver.reverse(target);
                break;
              default:
                records = await resolver.resolve4(target);
                break;
            }
            return { success: true, output: { target, type: recordType, records, ...(servers ? { resolver: 'fallback' } : {}) } };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            // If system DNS refused/timed out, try fallback servers
            if (servers || (!msg.includes('ECONNREFUSED') && !msg.includes('ETIMEOUT') && !msg.includes('EAI_AGAIN'))) {
              return { success: false, error: `DNS lookup failed: ${msg}` };
            }
            // Continue to fallback
          }
        }
        return { success: false, error: 'DNS lookup failed: all resolvers exhausted' };
      },
    );

    this.registry.register(
      {
        name: 'net_traceroute',
        description: 'Trace route to a host showing each network hop. Max 30 hops with 2s timeout per hop. Security: restricted to private/local network addresses only (RFC1918, link-local, localhost). Requires network_access capability.',
        shortDescription: 'Trace route to a host showing each network hop.',
        risk: 'read_only',
        category: 'network',
        deferLoading: true,
        parameters: {
          type: 'object',
          properties: {
            host: { type: 'string', description: 'Host or IP to trace (private/local networks only).' },
            maxHops: { type: 'number', description: 'Maximum hops (1-30, default 15).' },
          },
          required: ['host'],
        },
      },
      async (args, request) => {
        const host = validateHostParam(requireString(args.host, 'host'));
        requireLocalNetwork(host);
        const maxHops = Math.max(1, Math.min(30, asNumber(args.maxHops, 15)));
        this.guardAction(request, 'network_probe', { host, maxHops });
        const isWin = process.platform === 'win32';
        const cmd = isWin ? `tracert -h ${maxHops} -w 2000 ${host}` : `traceroute -m ${maxHops} -w 2 ${host}`;
        try {
          const { stdout } = await this.sandboxExec(cmd, 'read-only', { networkAccess: true, timeout: 60_000 });
          const hops = parseTracerouteOutput(stdout);
          return { success: true, output: { host, hops } };
        } catch (err) {
          return { success: false, error: `Traceroute failed: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    );

    this.registry.register(
      {
        name: 'net_oui_lookup',
        description: 'Look up MAC vendor from OUI prefix. Returns vendor if known from bundled lookup table. Read-only.',
        shortDescription: 'Look up MAC address vendor from OUI prefix.',
        risk: 'read_only',
        category: 'network',
        deferLoading: true,
        parameters: {
          type: 'object',
          properties: {
            mac: { type: 'string', description: 'MAC address (e.g. aa:bb:cc:dd:ee:ff).' },
          },
          required: ['mac'],
        },
      },
      async (args, request) => {
        const mac = requireString(args.mac, 'mac').trim();
        this.guardAction(request, 'network_probe', { action: 'oui_lookup', mac });
        return {
          success: true,
          output: {
            mac,
            vendor: lookupOuiVendor(mac) ?? null,
          },
        };
      },
    );

    this.registry.register(
      {
        name: 'net_classify',
        description: 'Classify discovered devices by type using vendor, hostname, and open-port heuristics. Read-only.',
        shortDescription: 'Classify devices by type using vendor, hostname, and ports.',
        risk: 'read_only',
        category: 'network',
        deferLoading: true,
        parameters: {
          type: 'object',
          properties: {
            mac: { type: 'string', description: 'Optional MAC filter.' },
            ip: { type: 'string', description: 'Optional IP filter.' },
          },
        },
      },
      async (args, request) => {
        this.guardAction(request, 'network_probe', { action: 'classify' });
        if (!this.options.deviceInventory) {
          return { success: false, error: 'Device inventory service is not available.' };
        }
        const macFilter = asString(args.mac).trim().toLowerCase();
        const ipFilter = asString(args.ip).trim();
        const devices = this.options.deviceInventory.listDevices().filter((d) => {
          if (macFilter && d.mac.toLowerCase() !== macFilter) return false;
          if (ipFilter && d.ip !== ipFilter) return false;
          return true;
        });
        const classified = devices.map((d) => {
          const vendor = d.vendor ?? lookupOuiVendor(d.mac);
          const cls = classifyDevice({
            vendor,
            hostname: d.hostname,
            openPorts: d.openPorts,
          });
          return {
            ip: d.ip,
            mac: d.mac,
            hostname: d.hostname,
            vendor,
            deviceType: cls.deviceType,
            confidence: cls.confidence,
            matchedSignals: cls.matchedSignals,
            openPorts: d.openPorts,
          };
        });
        return {
          success: true,
          output: {
            count: classified.length,
            devices: classified,
          },
        };
      },
    );

    this.registry.register(
      {
        name: 'net_banner_grab',
        description: 'Grab service banners from open ports on a local/private-network host. Protocol-aware for HTTP/SSH/SMTP/FTP with configurable timeout and concurrency. Requires network_access capability.',
        shortDescription: 'Grab service banners from open ports on a device.',
        risk: 'read_only',
        category: 'network',
        deferLoading: true,
        parameters: {
          type: 'object',
        shortDescription: 'Check if TCP ports are open on a host.',
          properties: {
            host: { type: 'string', description: 'Host or IP to fingerprint (private/local only).' },
            ports: { type: 'array', items: { type: 'number' }, description: 'Optional explicit ports (max 50).' },
          },
          required: ['host'],
        },
      },
      async (args, request) => {
        if (!this.networkConfig.fingerprinting.enabled) {
          return { success: false, error: 'Network fingerprinting is disabled in configuration.' };
        }
        const host = validateHostParam(requireString(args.host, 'host'));
        requireLocalNetwork(host);
        this.guardAction(request, 'network_probe', { action: 'banner_grab', host });

        const explicitPorts = Array.isArray(args.ports)
          ? args.ports.map(Number).filter((value) => Number.isFinite(value) && value > 0 && value <= 65535)
          : [];
        let ports = explicitPorts.slice(0, 50);
        if (ports.length === 0 && this.options.deviceInventory) {
          const device = this.options.deviceInventory.listDevices().find((entry) => entry.ip === host);
          if (device) ports = device.openPorts.slice(0, 50);
        }
        if (ports.length === 0) {
          ports = [21, 22, 25, 53, 80, 110, 143, 443, 445, 554, 631, 3306, 5432, 8080, 8443];
        }
        ports = [...new Set(ports)].sort((a, b) => a - b);

        const timeoutMs = Math.max(500, this.networkConfig.fingerprinting.bannerTimeout);
        const maxConcurrent = Math.max(1, this.networkConfig.fingerprinting.maxConcurrentPerDevice);
        const queue = [...ports];
        const fingerprints: ReturnType<typeof parseBanner>[] = [];
        const failures: Array<{ port: number; error: string }> = [];

        const worker = async (): Promise<void> => {
          while (queue.length > 0) {
            const port = queue.shift();
            if (port === undefined) return;
            try {
              const banner = await grabPortBanner(host, port, timeoutMs);
              if (banner) {
                fingerprints.push(parseBanner(port, banner));
              } else {
                fingerprints.push({
                  port,
                  service: inferServiceFromPort(port),
                  banner: '',
                });
              }
            } catch (err) {
              failures.push({ port, error: err instanceof Error ? err.message : String(err) });
            }
          }
        };

        await Promise.all(
          Array.from({ length: Math.min(maxConcurrent, ports.length) }, () => worker()),
        );

        if (this.options.deviceInventory) {
          this.options.deviceInventory.updateDeviceByIp(host, { fingerprints });
        }

        return {
          success: true,
          output: {
            host,
            portsScanned: ports.length,
            fingerprints: fingerprints.sort((a, b) => a.port - b.port),
            failures,
          },
        };
      },
    );

    this.registry.register(
      {
        name: 'net_fingerprint',
        description: 'Run full device fingerprinting (OUI vendor + optional port check + banner grab + classification). Requires network_access capability.',
        shortDescription: 'Run full device fingerprinting with OUI and banner analysis.',
        risk: 'read_only',
        category: 'network',
        deferLoading: true,
        parameters: {
          type: 'object',
        shortDescription: 'Run full device fingerprinting with OUI and banner analysis.',
          properties: {
            host: { type: 'string', description: 'Host/IP to fingerprint (private/local only).' },
            mac: { type: 'string', description: 'Optional MAC to look up from device inventory.' },
            ports: { type: 'array', items: { type: 'number' }, description: 'Optional explicit ports to probe.' },
            portScan: { type: 'boolean', description: 'Run port scan if open ports are unknown (default true).' },
          },
        },
      },
      async (args, request) => {
        if (!this.networkConfig.fingerprinting.enabled) {
          return { success: false, error: 'Network fingerprinting is disabled in configuration.' };
        }
        this.guardAction(request, 'network_probe', { action: 'fingerprint' });
        const macFilter = asString(args.mac).trim().toLowerCase();
        let host = asString(args.host).trim();
        let inventoryDevice: ReturnType<DeviceInventoryService['listDevices']>[number] | undefined;
        if (!host && macFilter && this.options.deviceInventory) {
          inventoryDevice = this.options.deviceInventory.listDevices().find((entry) => entry.mac === macFilter);
          host = inventoryDevice?.ip ?? '';
        }
        if (!host) {
          return { success: false, error: 'host is required (or provide mac with a matching inventory device).' };
        }
        host = validateHostParam(host);
        requireLocalNetwork(host);

        let openPorts = Array.isArray(args.ports)
          ? args.ports.map(Number).filter((value) => Number.isFinite(value) && value > 0 && value <= 65535)
          : [];

        if (openPorts.length === 0) {
          if (!inventoryDevice && this.options.deviceInventory) {
            inventoryDevice = this.options.deviceInventory.listDevices().find((entry) => entry.ip === host);
          }
          if (inventoryDevice?.openPorts.length) {
            openPorts = inventoryDevice.openPorts.slice();
          }
        }

        const shouldPortScan = args.portScan !== false;
        if (openPorts.length === 0 && shouldPortScan) {
          const candidatePorts = [21, 22, 23, 25, 53, 80, 110, 139, 143, 443, 445, 515, 554, 631, 2049, 3306, 3389, 5432, 8080, 8443, 9100];
          const portResults = await Promise.all(candidatePorts.map((port) => checkTcpPort(host, port, 1500)));
          openPorts = portResults.filter((entry) => entry.open).map((entry) => entry.port);
        }
        openPorts = [...new Set(openPorts)].sort((a, b) => a - b);

        const timeoutMs = Math.max(500, this.networkConfig.fingerprinting.bannerTimeout);
        const maxConcurrent = Math.max(1, this.networkConfig.fingerprinting.maxConcurrentPerDevice);
        const queue = [...openPorts];
        const fingerprints: ReturnType<typeof parseBanner>[] = [];
        const worker = async (): Promise<void> => {
          while (queue.length > 0) {
            const port = queue.shift();
            if (port === undefined) return;
            const banner = await grabPortBanner(host, port, timeoutMs).catch(() => null);
            if (banner) {
              fingerprints.push(parseBanner(port, banner));
            }
          }
        };
        await Promise.all(
          Array.from({ length: Math.min(maxConcurrent, Math.max(1, openPorts.length)) }, () => worker()),
        );

        const vendor = inventoryDevice?.vendor ?? (macFilter ? lookupOuiVendor(macFilter) : undefined);
        const classification = classifyDevice({
          vendor,
          hostname: inventoryDevice?.hostname ?? null,
          openPorts,
        });

        if (this.options.deviceInventory) {
          this.options.deviceInventory.updateDeviceByIp(host, {
            openPorts,
            vendor,
            fingerprints,
          });
        }

        return {
          success: true,
          output: {
            host,
            mac: inventoryDevice?.mac ?? (macFilter || null),
            vendor: vendor ?? null,
            openPorts,
            fingerprints: fingerprints.sort((a, b) => a.port - b.port),
            classification: {
              deviceType: classification.deviceType,
              confidence: classification.confidence,
              matchedSignals: classification.matchedSignals,
            },
          },
        };
      },
    );

    this.registry.register(
      {
        name: 'net_wifi_scan',
        description: 'Scan nearby WiFi networks (SSID/BSSID/signal/security). Uses nmcli (Linux), airport (macOS), or netsh (Windows). Requires network_access capability.',
        shortDescription: 'Scan nearby WiFi networks. Returns SSID, signal, security.',
        risk: 'read_only',
        category: 'network',
        deferLoading: true,
        parameters: {
          type: 'object',
          properties: {
            platform: { type: 'string', description: 'Optional platform override: auto, linux, macos, windows.' },
            force: { type: 'boolean', description: 'Run even if assistant.network.wifi.enabled is false.' },
            connectionId: { type: 'string', description: 'Optional assistant.network.connections id (must be wifi or auto-compatible).' },
          },
        },
      },
      async (args, request) => {
        const force = !!args.force;
        if (!force && !this.networkConfig.wifi.enabled) {
          return { success: false, error: 'WiFi monitoring is disabled in configuration (assistant.network.wifi.enabled=false).' };
        }
        this.guardAction(request, 'network_probe', { action: 'wifi_scan' });
        const connectionId = asString(args.connectionId).trim();
        const connection = connectionId ? this.getConnectionProfile(connectionId) : undefined;
        if (connectionId && !connection) {
          return { success: false, error: `Unknown network connection profile '${connectionId}'.` };
        }
        if (connection && connection.type !== 'wifi') {
          return { success: false, error: `Connection '${connection.id}' is type '${connection.type}', expected 'wifi'.` };
        }
        const override = asString(args.platform).trim().toLowerCase();
        const resolvedPlatform = override || this.networkConfig.wifi.platform;
        const platform = resolvedPlatform === 'auto'
          ? (process.platform === 'darwin' ? 'macos' : process.platform === 'win32' ? 'windows' : 'linux')
          : resolvedPlatform;

        try {
          if (platform === 'linux') {
            const { stdout } = await this.sandboxExec(
              'nmcli -t -f SSID,BSSID,SIGNAL,CHAN,SECURITY dev wifi list',
              'read-only',
              { networkAccess: true, timeout: 20_000 },
            );
            let networks = parseNmcliWifi(stdout);
            if (connection?.ssid) {
              networks = networks.filter((network) => network.ssid === connection.ssid);
            }
            return { success: true, output: { platform, connectionId: connection?.id ?? null, count: networks.length, networks } };
          }
          if (platform === 'macos') {
            const { stdout } = await this.sandboxExec(
              '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -s',
              'read-only',
              { networkAccess: true, timeout: 20_000 },
            );
            let networks = parseAirportWifi(stdout);
            if (connection?.ssid) {
              networks = networks.filter((network) => network.ssid === connection.ssid);
            }
            return { success: true, output: { platform, connectionId: connection?.id ?? null, count: networks.length, networks } };
          }
          const { stdout } = await this.sandboxExec(
            'netsh.exe wlan show networks mode=bssid',
            'read-only',
            { networkAccess: true, timeout: 20_000 },
          );
          let networks = parseNetshWifi(stdout);
          if (connection?.ssid) {
            networks = networks.filter((network) => network.ssid === connection.ssid);
          }
          return { success: true, output: { platform: 'windows', connectionId: connection?.id ?? null, count: networks.length, networks } };
        } catch (err) {
          return { success: false, error: `WiFi scan failed: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    );

    this.registry.register(
      {
        name: 'net_wifi_clients',
        description: 'List likely WiFi clients by correlating ARP-neighbor observations with discovered devices. Requires network_access capability.',
        shortDescription: 'List WiFi clients by correlating ARP and interface data.',
        risk: 'read_only',
        category: 'network',
        deferLoading: true,
        parameters: {
          type: 'object',
          properties: {
            force: { type: 'boolean', description: 'Run even if assistant.network.wifi.enabled is false.' },
          },
        },
      },
      async (args, request) => {
        const force = !!args.force;
        if (!force && !this.networkConfig.wifi.enabled) {
          return { success: false, error: 'WiFi monitoring is disabled in configuration (assistant.network.wifi.enabled=false).' };
        }
        this.guardAction(request, 'network_probe', { action: 'wifi_clients' });
        const platform = process.platform;
        let arpRows: Array<{ ip: string; mac: string; state: string }> = [];
        try {
          if (platform === 'linux') {
            try {
              const { stdout } = await this.sandboxExec('ip neigh show', 'read-only', { networkAccess: true, timeout: 10_000 });
              arpRows = parseArpLinux(stdout);
            } catch {
              const { stdout } = await this.sandboxExec('arp -a', 'read-only', { networkAccess: true, timeout: 10_000 });
              arpRows = parseArpWindows(stdout);
            }
          } else {
            const { stdout } = await this.sandboxExec('arp -a', 'read-only', { networkAccess: true, timeout: 10_000 });
            arpRows = parseArpWindows(stdout);
          }
        } catch (err) {
          return { success: false, error: `WiFi client enumeration failed: ${err instanceof Error ? err.message : String(err)}` };
        }

        const devices = this.options.deviceInventory?.listDevices() ?? [];
        const byMac = new Map(devices.map((device) => [device.mac.toLowerCase(), device]));
        const clients = arpRows
          .filter((row) => row.mac && row.mac !== 'unknown')
          .map((row) => {
            const known = byMac.get(row.mac.toLowerCase());
            return {
              ip: row.ip,
              mac: row.mac.toLowerCase(),
              state: row.state,
              hostname: known?.hostname ?? null,
              vendor: known?.vendor ?? lookupOuiVendor(row.mac),
              deviceType: known?.deviceType ?? null,
              trusted: known?.trusted ?? false,
            };
          });

        return {
          success: true,
          output: {
            count: clients.length,
            clients,
            correlatedKnownDevices: correlateWifiClients(devices),
          },
        };
      },
    );

    this.registry.register(
      {
        name: 'net_connection_profiles',
        description: 'List configured assistant.network connection profiles with interface/host health hints.',
        shortDescription: 'List configured network connection profiles.',
        risk: 'read_only',
        category: 'network',
        deferLoading: true,
        parameters: { type: 'object', properties: {} },
      },
      async (_args, request) => {
        this.guardAction(request, 'network_probe', { action: 'connection_profiles' });
        const { networkInterfaces } = await import('node:os');
        const ifaces = networkInterfaces();
        const profiles = this.networkConfig.connections.map((connection) => {
          const iface = connection.interface ? ifaces[connection.interface] : undefined;
          return {
            ...connection,
            interfacePresent: connection.interface ? Boolean(iface && iface.length > 0) : undefined,
            interfaceAddresses: iface
              ? iface.map((entry) => ({ address: entry.address, family: entry.family, internal: entry.internal }))
              : [],
          };
        });
        return {
          success: true,
          output: {
            count: profiles.length,
            profiles,
          },
        };
      },
    );

    this.registry.register(
      {
        name: 'net_traffic_baseline',
        description: 'Build/query traffic baseline from local connection metadata. Optional refresh runs a live connection capture first. Requires network_access capability.',
        shortDescription: 'Build or query traffic baseline from local connections.',
        risk: 'read_only',
        category: 'network',
        deferLoading: true,
        parameters: {
          type: 'object',
          properties: {
            refresh: { type: 'boolean', description: 'Capture current connections before returning baseline snapshot.' },
            state: { type: 'string', description: 'Optional connection state filter for refresh capture.' },
            limitFlows: { type: 'number', description: 'Recent flow sample size (default 100).' },
          },
        },
      },
      async (args, request) => {
        this.guardAction(request, 'network_probe', { action: 'traffic_baseline' });
        if (!this.options.networkTraffic) {
          return { success: false, error: 'Network traffic service is not available.' };
        }

        const refresh = args.refresh !== false;
        let ingest: { flowCount: number; added: number; threats: unknown[] } | null = null;
        if (refresh) {
          const stateFilter = asString(args.state).toUpperCase().trim();
          const connections = await this.collectLocalConnections(stateFilter);
          ingest = this.options.networkTraffic.ingestConnections(
            connections.map((connection) => toTrafficSample(connection)),
          );
        }

        const limit = Math.max(1, Math.min(500, asNumber(args.limitFlows, 100)));
        return {
          success: true,
          output: {
            snapshot: this.options.networkTraffic.getSnapshot(),
            ingest,
            recentFlows: this.options.networkTraffic.listRecentFlows({ limit }),
          },
        };
      },
    );

    this.registry.register(
      {
        name: 'net_threat_check',
        description: 'Run traffic-based threat detection rules (exfiltration, scanning, beaconing, lateral movement, unusual external). Optional refresh captures live connections first. Requires network_access capability.',
        shortDescription: 'Run traffic-based threat detection rules.',
        risk: 'read_only',
        category: 'network',
        deferLoading: true,
        parameters: {
          type: 'object',
          properties: {
            refresh: { type: 'boolean', description: 'Capture current local connections before analysis (default true).' },
            state: { type: 'string', description: 'Optional connection state filter for refresh capture.' },
            includeLow: { type: 'boolean', description: 'Include low-severity findings in output.' },
          },
        },
      },
      async (args, request) => {
        this.guardAction(request, 'network_probe', { action: 'threat_check' });
        if (!this.options.networkTraffic) {
          return { success: false, error: 'Network traffic service is not available.' };
        }

        const refresh = args.refresh !== false;
        let ingestResult: { flowCount: number; added: number; threats: ReturnType<NetworkTrafficService['ingestConnections']>['threats'] } | null = null;
        if (refresh) {
          const stateFilter = asString(args.state).toUpperCase().trim();
          const connections = await this.collectLocalConnections(stateFilter);
          ingestResult = this.options.networkTraffic.ingestConnections(
            connections.map((connection) => toTrafficSample(connection)),
          );
        }

        let threats = ingestResult?.threats ?? [];
        if (!args.includeLow) {
          threats = threats.filter((threat) => threat.severity !== 'low');
        }

        let emittedAlerts: unknown[] = [];
        if (threats.length > 0 && this.options.networkBaseline) {
          emittedAlerts = this.options.networkBaseline.recordExternalThreats(
            threats.map((threat) => ({
              type: threat.type,
              severity: threat.severity,
              timestamp: threat.timestamp,
              ip: threat.srcIp,
              description: threat.description,
              dedupeKey: threat.dedupeKey,
              evidence: threat.evidence,
            })),
          );
        }

        return {
          success: true,
          output: {
            snapshot: this.options.networkTraffic.getSnapshot(),
            threats,
            threatCount: threats.length,
            emittedAlerts,
          },
        };
      },
    );

    this.registry.register(
      {
        name: 'net_baseline',
        description: 'Get network baseline status and device profile summary. Read-only.',
        shortDescription: 'Get network baseline status and device profile summary.',
        risk: 'read_only',
        category: 'network',
        deferLoading: true,
        parameters: {
          type: 'object',
          properties: {
            includeDevices: { type: 'boolean', description: 'Include known device records in response.' },
          },
        },
      },
      async (args, request) => {
        this.guardAction(request, 'network_probe', { action: 'baseline_status' });
        if (!this.networkConfig.baseline.enabled) {
          return { success: false, error: 'Network baseline monitoring is disabled in configuration.' };
        }
        if (!this.options.networkBaseline) {
          return { success: false, error: 'Network baseline service is not available.' };
        }
        const includeDevices = !!args.includeDevices;
        const snapshot = this.options.networkBaseline.getSnapshot();
        return {
          success: true,
          output: {
            snapshotCount: snapshot.snapshotCount,
            minSnapshotsForBaseline: snapshot.minSnapshotsForBaseline,
            baselineReady: snapshot.baselineReady,
            lastUpdatedAt: snapshot.lastUpdatedAt,
            knownDeviceCount: snapshot.knownDevices.length,
            knownDevices: includeDevices ? snapshot.knownDevices : undefined,
          },
        };
      },
    );

    this.registry.register(
      {
        name: 'net_anomaly_check',
        description: 'Run anomaly detection against current discovered devices and update network alert state. Read-only.',
        shortDescription: 'Run anomaly detection against current device inventory.',
        risk: 'read_only',
        category: 'network',
        deferLoading: true,
        parameters: { type: 'object', properties: {} },
      },
      async (_args, request) => {
        this.guardAction(request, 'network_probe', { action: 'anomaly_check' });
        if (!this.networkConfig.baseline.enabled) {
          return { success: false, error: 'Network baseline monitoring is disabled in configuration.' };
        }
        if (!this.options.networkBaseline || !this.options.deviceInventory) {
          return { success: false, error: 'Network baseline or device inventory service is not available.' };
        }
        const report = this.options.networkBaseline.runSnapshot(this.options.deviceInventory.listDevices());
        return { success: true, output: report };
      },
    );

    this.registry.register(
      {
        name: 'net_threat_summary',
        description: 'Summarize active network alerts and baseline readiness. Read-only.',
        shortDescription: 'Summarize active network alerts and baseline readiness.',
        risk: 'read_only',
        category: 'network',
        deferLoading: true,
        parameters: {
          type: 'object',
          properties: {
            includeAcknowledged: { type: 'boolean', description: 'Include acknowledged alerts.' },
            limit: { type: 'number', description: 'Maximum alerts to return (default 50).' },
          },
        },
      },
      async (args, request) => {
        this.guardAction(request, 'network_probe', { action: 'threat_summary' });
        if (!this.networkConfig.baseline.enabled) {
          return { success: false, error: 'Network baseline monitoring is disabled in configuration.' };
        }
        if (!this.options.networkBaseline) {
          return { success: false, error: 'Network baseline service is not available.' };
        }
        const includeAcknowledged = !!args.includeAcknowledged;
        const limit = Math.max(1, Math.min(200, asNumber(args.limit, 50)));
        const alerts = this.options.networkBaseline.listAlerts({ includeAcknowledged, limit });
        const bySeverity = {
          low: alerts.filter((a) => a.severity === 'low').length,
          medium: alerts.filter((a) => a.severity === 'medium').length,
          high: alerts.filter((a) => a.severity === 'high').length,
          critical: alerts.filter((a) => a.severity === 'critical').length,
        };
        const baseline = this.options.networkBaseline.getSnapshot();
        return {
          success: true,
          output: {
            baselineReady: baseline.baselineReady,
            snapshotCount: baseline.snapshotCount,
            activeAlertCount: alerts.length,
            bySeverity,
            alerts,
          },
        };
      },
    );

    registerBuiltinCloudTools({
      registry: this.registry,
      requireString,
      asString,
      asNumber,
      asStringArray,
      guardAction: (request, action, details) => this.guardAction(request, action, details),
      createWhmClient: (profileId) => this.createWhmClient(profileId),
      resolveCpanelAccountContext: (profileId, requestedAccount) => this.resolveCpanelAccountContext(profileId, requestedAccount),
      createVercelClient: (profileId) => this.createVercelClient(profileId),
      createCloudflareClient: (profileId) => this.createCloudflareClient(profileId),
      createAwsClient: (profileId, service) => this.createAwsClient(profileId, service),
      createGcpClient: (profileId, service) => this.createGcpClient(profileId, service),
      createAzureClient: (profileId, service) => this.createAzureClient(profileId, service),
      describeCloudEndpoint: (profile) => this.describeCloudEndpoint(profile),
      describeVercelEndpoint: (profile) => this.describeVercelEndpoint(profile),
      describeCloudflareEndpoint: (profile) => this.describeCloudflareEndpoint(profile),
      describeAwsEndpoint: (profile, service) => this.describeAwsEndpoint(profile, service),
      describeGcpEndpoint: (profile, service) => this.describeGcpEndpoint(profile, service),
      describeAzureEndpoint: (profile, service, accountName) => this.describeAzureEndpoint(profile, service, accountName),
      resolveGcpLocation: (value, profileId, throwOnMissing) => this.resolveGcpLocation(value, profileId, throwOnMissing),
      resolveAzureResourceGroup: (value, profileId, throwOnMissing) => this.resolveAzureResourceGroup(value, profileId, throwOnMissing),
    });

    // ── System Tools ─────────────────────────────────────────────

    this.registry.register(
      {
        name: 'sys_info',
        description: 'Get OS info, hostname, uptime, architecture, CPU count, and total memory. Read-only — reads from OS APIs, no network calls.',
        shortDescription: 'Get OS info, hostname, uptime, and CPU details.',
        risk: 'read_only',
        category: 'system',
        parameters: { type: 'object', properties: {} },
      },
      async (_args, request) => {
        const os = await import('node:os');
        this.guardAction(request, 'system_info', { action: 'sys_info' });
        return {
          success: true,
          output: {
            hostname: os.hostname(),
            platform: os.platform(),
            release: os.release(),
            arch: os.arch(),
            uptime: os.uptime(),
            type: os.type(),
            cpuCount: os.cpus().length,
            totalMemoryMB: Math.round(os.totalmem() / 1_048_576),
          },
        };
      },
    );

    this.registry.register(
      {
        name: 'sys_resources',
        description: 'Get current CPU load averages, memory usage, and disk usage. Uses df (Linux/macOS) or wmic (Windows) for disk info. Read-only — no network calls.',
        shortDescription: 'Get current CPU load, memory usage, and disk space.',
        risk: 'read_only',
        category: 'system',
        parameters: { type: 'object', properties: {} },
      },
      async (_args, request) => {
        const os = await import('node:os');
        this.guardAction(request, 'system_info', { action: 'sys_resources' });
        const totalMB = Math.round(os.totalmem() / 1_048_576);
        const freeMB = Math.round(os.freemem() / 1_048_576);
        const [loadAvg1m, loadAvg5m, loadAvg15m] = os.loadavg();
        const memory = { totalMB, freeMB, usedPercent: Math.round(((totalMB - freeMB) / totalMB) * 100) };
        const cpu = { loadAvg1m: +loadAvg1m.toFixed(2), loadAvg5m: +loadAvg5m.toFixed(2), loadAvg15m: +loadAvg15m.toFixed(2), cores: os.cpus().length };

        let disks: Array<{ filesystem: string; sizeMB: number; usedMB: number; availableMB: number; usedPercent: number; mount: string }> = [];
        try {
          const isWin = process.platform === 'win32';
          if (isWin) {
            const { stdout } = await this.sandboxExec('wmic logicaldisk get size,freespace,caption /format:csv', 'read-only', { timeout: 10_000 });
            disks = parseDiskWindows(stdout);
          } else {
            const { stdout } = await this.sandboxExec('df -Pm', 'read-only', { timeout: 10_000 });
            disks = parseDiskLinux(stdout);
          }
        } catch { /* disk info is best-effort */ }

        return { success: true, output: { memory, cpu, disks } };
      },
    );

    this.registry.register(
      {
        name: 'sys_processes',
        description: 'List top processes sorted by CPU or memory usage. Returns up to 50 processes with PID, CPU%, MEM%, and command. Read-only — no network calls.',
        shortDescription: 'List top processes sorted by CPU or memory usage.',
        risk: 'read_only',
        category: 'system',
        deferLoading: true,
        parameters: {
          type: 'object',
          properties: {
            sortBy: { type: 'string', description: 'Sort by: cpu or memory (default: cpu).' },
            limit: { type: 'number', description: 'Max processes to return (1-50, default 20).' },
          },
        },
      },
      async (args, request) => {
        const sortBy = asString(args.sortBy, 'cpu').toLowerCase() === 'memory' ? 'memory' : 'cpu';
        const limit = Math.max(1, Math.min(50, asNumber(args.limit, 20)));
        this.guardAction(request, 'system_info', { action: 'sys_processes', sortBy, limit });
        const platform = process.platform;
        try {
          if (platform === 'win32') {
            const { stdout } = await this.sandboxExec('tasklist /FO CSV /NH', 'read-only', { timeout: 10_000 });
            const processes = parseTasklistWindows(stdout, limit);
            return { success: true, output: { processes } };
          }
          if (platform === 'darwin') {
            // macOS BSD ps: -r sorts by CPU, -m sorts by memory (no --sort)
            const flag = sortBy === 'memory' ? '-m' : '-r';
            const { stdout } = await this.sandboxExec(`ps aux ${flag}`, 'read-only', { timeout: 10_000 });
            const processes = parsePsLinux(stdout, limit);
            return { success: true, output: { processes } };
          }
          // Linux GNU ps: supports --sort
          const sortFlag = sortBy === 'memory' ? '-%mem' : '-%cpu';
          const { stdout } = await this.sandboxExec(`ps aux --sort=${sortFlag}`, 'read-only', { timeout: 10_000 });
          const processes = parsePsLinux(stdout, limit);
          return { success: true, output: { processes } };
        } catch (err) {
          return { success: false, error: `Process listing failed: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    );

    this.registry.register(
      {
        name: 'sys_services',
        description: 'List services and their status. Uses systemctl on Linux, launchctl on macOS. Optional name filter. Not available on Windows. Read-only — no network calls.',
        shortDescription: 'List services and their status.',
        risk: 'read_only',
        category: 'system',
        deferLoading: true,
        parameters: {
          type: 'object',
          properties: {
            filter: { type: 'string', description: 'Optional filter string for service names.' },
          },
        },
      },
      async (args, request) => {
        const platform = process.platform;
        if (platform === 'win32') {
          return { success: false, error: 'sys_services is not available on Windows. Use sys_processes instead.' };
        }
        const filter = asString(args.filter).trim();
        this.guardAction(request, 'system_info', { action: 'sys_services', filter: filter || undefined });

        if (platform === 'darwin') {
          try {
            const { stdout } = await this.sandboxExec('launchctl list', 'read-only', { timeout: 10_000 });
            const services = parseLaunchctlOutput(stdout, filter);
            return { success: true, output: { services } };
          } catch (err) {
            return { success: false, error: `Service listing failed: ${err instanceof Error ? err.message : String(err)}` };
          }
        }

        // Linux — try systemctl
        try {
          const { stdout } = await this.sandboxExec(
            'systemctl list-units --type=service --all --no-pager --plain',
            'read-only',
            { timeout: 10_000 },
          );
          const services = parseSystemctlOutput(stdout, filter);
          return { success: true, output: { services } };
        } catch (err) {
          return { success: false, error: `Service listing failed (systemd may not be available): ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    );

    // ── Memory Tools ────────────────────────────────────────────────
    this.registry.register(
      {
        name: 'memory_search',
        description: 'Search conversation history, persistent memory, or both. Conversation results use FTS5 BM25 ranking when available; persistent-memory results use deterministic field-aware ranking. In Code sessions, persistent search defaults to both global and code-session memory unless persistentScope is set.',
        shortDescription: 'Search conversation history and persistent memory.',
        risk: 'read_only',
        category: 'memory',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query (words, phrases). Supports FTS5 syntax when available.' },
            scope: {
              type: 'string',
              enum: ['conversation', 'persistent', 'both'],
              description: 'Which memory surface to search. Defaults to both.',
            },
            persistentScope: {
              type: 'string',
              enum: ['global', 'code_session', 'both'],
              description: 'Which persistent memory scope to search when scope includes persistent memory. Defaults to global outside Code and both inside Code.',
            },
            sessionId: {
              type: 'string',
              description: 'Required when persistentScope includes code_session and the current request is not already attached to that coding session.',
            },
            limit: { type: 'number', description: 'Maximum results to return (default: 10, max: 50).' },
          },
          required: ['query'],
        },
      },
      async (args, request) => {
        const query = asString(args.query).trim();
        if (!query) return { success: false, error: 'Query is required.' };
        const scope = this.normalizeMemorySearchScope(args.scope);
        if (!scope) {
          return { success: false, error: 'scope must be one of "conversation", "persistent", or "both".' };
        }
        const persistentScope = this.normalizePersistentMemoryScope(args.persistentScope, request);
        if (!persistentScope) {
          return { success: false, error: 'persistentScope must be one of "global", "code_session", or "both".' };
        }
        const persistentSessionId = asString(args.sessionId).trim() || undefined;

        const conversationService = this.options.conversationService;
        const limit = Math.min(Math.max(asNumber(args.limit, 10), 1), 50);
        const searchConversation = scope === 'conversation' || scope === 'both';
        const searchPersistent = scope === 'persistent' || scope === 'both';
        const requestAgentId = asString(request.agentId);
        const stateAgentId = this.options.resolveStateAgentId?.(requestAgentId) ?? requestAgentId;

        const conversationRanked: ConversationMemorySearchCandidate[] = [];
        if (searchConversation && conversationService) {
          this.guardAction(request, 'read_file', { path: 'memory:conversation_search', query });
          const results = conversationService.searchMessages(query, {
            userId: asString(request.userId),
            agentId: stateAgentId,
            limit: Math.min(limit * 2, 100),
          });
          results.forEach((row, index) => {
            conversationRanked.push({
              key: `conversation:${row.sessionId}:${row.timestamp}:${row.role}:${index}`,
              source: 'conversation',
              type: 'conversation_message',
              role: row.role,
              content: row.content.length > 500 ? `${row.content.slice(0, 500)}...` : row.content,
              timestamp: row.timestamp,
              channel: row.channel,
              sessionId: row.sessionId,
              scoreHint: row.score,
            });
          });
        }

        const persistentRanked: PersistentMemorySearchCandidate[] = [];
        const searchedPersistentScopes: Array<'global' | 'code_session'> = [];
        if (searchPersistent) {
          const resolvedPersistent = this.resolvePersistentMemoryContexts(persistentScope, persistentSessionId, request);
          if (resolvedPersistent.error) {
            return { success: false, error: resolvedPersistent.error };
          }
          for (const persistentContext of resolvedPersistent.contexts) {
            if (!persistentContext.store) continue;
            searchedPersistentScopes.push(persistentContext.source);
            this.guardAction(request, 'read_file', { path: persistentContext.guardPath, query });
            const results = this.searchPersistentMemoryEntries(
              persistentContext.store,
              persistentContext.id,
              query,
              Math.min(limit * 2, 100),
            );
            results.forEach((entry) => {
              persistentRanked.push({
                key: `${persistentContext.source}:${entry.id}`,
                source: persistentContext.source,
                type: 'memory_entry',
                entryId: entry.id,
                createdAt: entry.createdAt,
                category: entry.category,
                summary: entry.summary,
                content: entry.content,
                trustLevel: entry.trustLevel,
                status: entry.status,
                tags: entry.tags,
                provenance: entry.provenance,
                scoreHint: entry.matchScore,
              });
            });
          }
        }

        if (scope === 'conversation' && !conversationService) {
          return { success: false, error: 'Conversation memory is not enabled.' };
        }
        if (scope === 'persistent' && searchedPersistentScopes.length === 0) {
          return { success: false, error: 'Persistent memory is not enabled.' };
        }

        const fusedResults = this.fuseRankedMemorySearchResults(
          [
            ...(searchConversation ? [conversationRanked] : []),
            ...(searchPersistent ? [persistentRanked] : []),
          ],
          limit,
        );

        return {
          success: true,
          output: {
            query,
            scope,
            hasFTS: conversationService?.hasFTS ?? false,
            currentPersistentScope: 'global',
            persistentScopesSearched: searchedPersistentScopes,
            resultCount: fusedResults.length,
            results: fusedResults.map((result) => ({
              rank: result.rank,
              score: result.score,
              source: result.source,
              type: result.type,
              content: result.content,
              ...(result.type === 'conversation_message'
                ? {
                  role: result.role,
                  timestamp: result.timestamp,
                  channel: result.channel,
                  sessionId: result.sessionId,
                  sourceScore: result.scoreHint,
                }
                : {
                  entryId: result.entryId,
                  createdAt: result.createdAt,
                  category: result.category,
                  summary: result.summary,
                  trustLevel: result.trustLevel,
                  status: result.status,
                  tags: result.tags,
                  provenance: result.provenance,
                  sourceScore: result.scoreHint,
                }),
            })),
          },
        };
      },
    );

    this.registry.register(
      {
        name: 'memory_recall',
        description: 'Retrieve persistent long-term memory. Global memory remains the primary scope. Code-session memory is available explicitly as session-local augment memory.',
        shortDescription: 'Retrieve global or code-session persistent memory.',
        risk: 'read_only',
        category: 'memory',
        deferLoading: true,
        parameters: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'Agent ID to retrieve knowledge base for (defaults to current agent).' },
            scope: {
              type: 'string',
              enum: ['global', 'code_session', 'both'],
              description: 'Which persistent memory scope to retrieve. Defaults to global.',
            },
            sessionId: {
              type: 'string',
              description: 'Required when scope includes code_session and the current request is not already attached to that coding session.',
            },
          },
        },
      },
      async (args, request) => {
        const scope = this.normalizePersistentMemoryScope(args.scope, request, 'global');
        if (!scope) {
          return { success: false, error: 'scope must be one of "global", "code_session", or "both".' };
        }
        const resolved = this.resolvePersistentMemoryContexts(scope, asString(args.sessionId), request, asString(args.agentId));
        if (resolved.error) {
          return { success: false, error: resolved.error };
        }

        const outputs: Array<{
          scope: 'global' | 'code_session';
          agentId?: string;
          codeSessionId?: string;
          exists: boolean;
          sizeChars: number;
          entries: Array<{
            id: string;
            createdAt: string;
            category?: string;
            summary?: string;
            content: string;
            trustLevel?: string;
            status?: string;
          }>;
          content: string;
        }> = [];

        for (const context of resolved.contexts) {
          this.guardAction(request, 'read_file', { path: context.guardPath });
          if (!context.store) {
            return {
              success: false,
              error: context.source === 'global'
                ? 'Knowledge base is not enabled.'
                : 'Code-session memory is not enabled.',
            };
          }
          const content = context.store.load(context.id);
          outputs.push({
            scope: context.source,
            ...(context.source === 'global' ? { agentId: context.id } : { codeSessionId: context.id }),
            exists: context.store.exists(context.id),
            sizeChars: context.store.size(context.id),
            entries: context.store.getEntries(context.id).map((entry) => ({
              id: entry.id,
              createdAt: entry.createdAt,
              category: entry.category,
              summary: entry.summary,
              content: entry.content,
              trustLevel: entry.trustLevel,
              status: entry.status,
            })),
            content: content || (context.source === 'global'
              ? '(empty — no memories stored yet)'
              : '(empty — no coding memories stored yet)'),
          });
        }

        if (scope === 'both') {
          return {
            success: true,
            output: {
              scope: 'both',
              global: outputs.find((entry) => entry.scope === 'global') ?? null,
              codeSession: outputs.find((entry) => entry.scope === 'code_session') ?? null,
            },
          };
        }

        const only = outputs[0];
        return {
          success: true,
          output: only,
        };
      },
    );

    this.registry.register(
      {
        name: 'memory_save',
        description: 'Save a fact, preference, decision, or summary to persistent long-term memory. Global memory is the default target. Use scope=code_session for session-local coding memory.',
        shortDescription: 'Save a fact or summary to global or code-session memory.',
        risk: 'mutating',
        category: 'memory',
        parameters: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'The fact, preference, or summary to remember.' },
            summary: { type: 'string', description: 'Optional short gist used when memory is packed back into prompt context.' },
            category: { type: 'string', description: 'Optional category heading (e.g., "Preferences", "Decisions", "Facts", "Project Notes").' },
            scope: {
              type: 'string',
              enum: ['global', 'code_session'],
              description: 'Which persistent memory scope to write. Defaults to global.',
            },
            sessionId: {
              type: 'string',
              description: 'Required when scope=code_session and the current request is not already attached to that coding session.',
            },
          },
          required: ['content'],
        },
      },
      async (args, request) => {
        const content = asString(args.content).trim();
        if (!content) return { success: false, error: 'Content is required.' };
        const summary = asString(args.summary).trim() || undefined;
        const category = asString(args.category).trim() || undefined;
        const targetScope = this.normalizeMemoryMutationScope(args.scope);
        if (!targetScope) {
          return { success: false, error: 'scope must be one of "global" or "code_session".' };
        }
        const readOnlyError = this.getMemoryMutationReadOnlyError(args, request);
        if (readOnlyError) {
          return { success: false, error: readOnlyError };
        }
        const requestTrustLevel = request.contentTrustLevel ?? 'trusted';
        const trustLevel = requestTrustLevel === 'trusted' ? 'trusted' : 'untrusted';
        const status = requestTrustLevel === 'trusted' && !request.derivedFromTaintedContent
          ? 'active'
          : 'quarantined';

        if (targetScope === 'code_session') {
          const codeMemory = this.resolveCodeSessionMemoryContext(asString(args.sessionId), request);
          if (!codeMemory) {
            return { success: false, error: 'A reachable code session is required to save code-session memory.' };
          }
          this.guardAction(request, 'write_file', { path: `memory:code_session:${codeMemory.sessionId}`, content });
          if (!codeMemory.store) {
            return { success: false, error: 'Code-session memory is not enabled.' };
          }
          const stored = codeMemory.store.append(codeMemory.sessionId, {
            content,
            summary,
            createdAt: new Date().toISOString().slice(0, 10),
            category,
            sourceType: requestTrustLevel === 'trusted' ? 'user' : 'remote_tool',
            trustLevel,
            status,
            createdByPrincipal: request.principalId ?? request.userId,
            provenance: {
              sessionId: codeMemory.sessionId,
              taintReasons: request.taintReasons,
            },
          });

          return {
            success: true,
            output: {
              scope: 'code_session',
              codeSessionId: codeMemory.sessionId,
              entryId: stored.id,
              saved: content,
              summary: stored.summary,
              category: category ?? '(uncategorized)',
              status: stored.status,
              trustLevel: stored.trustLevel,
              totalSizeChars: codeMemory.store.size(codeMemory.sessionId),
            },
            verificationStatus: codeMemory.store.isEntryActive(codeMemory.sessionId, stored.id) ? 'verified' : 'unverified',
            verificationEvidence: codeMemory.store.isEntryActive(codeMemory.sessionId, stored.id)
              ? `Code-session memory entry ${stored.id} is active.`
              : `Code-session memory entry ${stored.id} was persisted as ${stored.status}.`,
          };
        }

        this.guardAction(request, 'write_file', { path: 'memory:knowledge_base', content });

        const globalMemory = this.getGlobalMemoryContext(request);
        if (!globalMemory.store) {
          return { success: false, error: 'Knowledge base is not enabled.' };
        }

        const stored = globalMemory.store.append(globalMemory.agentId, {
          content,
          summary,
          createdAt: new Date().toISOString().slice(0, 10),
          category,
          sourceType: requestTrustLevel === 'trusted' ? 'user' : 'remote_tool',
          trustLevel,
          status,
          createdByPrincipal: request.principalId ?? request.userId,
          provenance: {
            sessionId: request.scheduleId,
            taintReasons: request.taintReasons,
          },
        });

        return {
          success: true,
          output: {
            scope: 'global',
            agentId: globalMemory.agentId,
            entryId: stored.id,
            saved: content,
            summary: stored.summary,
            category: category ?? '(uncategorized)',
            status: stored.status,
            trustLevel: stored.trustLevel,
            totalSizeChars: globalMemory.store.size(globalMemory.agentId),
          },
          verificationStatus: globalMemory.store.isEntryActive(globalMemory.agentId, stored.id) ? 'verified' : 'unverified',
          verificationEvidence: globalMemory.store.isEntryActive(globalMemory.agentId, stored.id)
            ? `Memory entry ${stored.id} is active in the knowledge base.`
            : `Memory entry ${stored.id} was persisted as ${stored.status}.`,
        };
      },
    );

    this.registry.register(
      {
        name: 'memory_bridge_search',
        description: 'Read-only search across the other persistent memory scope. Use this to search global memory from a Code session, or to search a Code-session memory from outside it, without changing the current context or objective.',
        shortDescription: 'Read-only search across another persistent memory scope.',
        risk: 'read_only',
        category: 'memory',
        deferLoading: true,
        parameters: {
          type: 'object',
          properties: {
            targetScope: {
              type: 'string',
              enum: ['global', 'code_session'],
              description: 'Which persistent memory scope to search.',
            },
            query: { type: 'string', description: 'The text to search for.' },
            sessionId: { type: 'string', description: 'Required when searching a specific code-session memory from outside that session.' },
            limit: { type: 'number', description: 'Maximum number of results to return (default 10).' },
          },
          required: ['targetScope', 'query'],
        },
      },
      async (args, request) => {
        const targetScope = asString(args.targetScope).trim().toLowerCase();
        const query = asString(args.query).trim();
        if (targetScope !== 'global' && targetScope !== 'code_session') {
          return { success: false, error: 'targetScope must be "global" or "code_session".' };
        }
        if (!query) {
          return { success: false, error: 'Query is required.' };
        }

        const limit = Math.min(Math.max(asNumber(args.limit, 10), 1), 20);

        if (targetScope === 'global') {
          this.guardAction(request, 'read_file', { path: 'memory:bridge:global', query });
          const globalMemory = this.getGlobalMemoryContext(request);
          if (!globalMemory.store) {
            return { success: false, error: 'Knowledge base is not enabled.' };
          }
          const results = this.searchPersistentMemoryEntries(globalMemory.store, globalMemory.agentId, query, limit);
          return {
            success: true,
            output: {
              referenceOnly: true,
              sourceScope: 'global',
              agentId: globalMemory.agentId,
              query,
              resultCount: results.length,
              results,
            },
            message: results.length > 0
              ? `Found ${results.length} reference memory entr${results.length === 1 ? 'y' : 'ies'} in global memory.`
              : 'No matching entries found in global memory.',
          };
        }

        const codeMemory = this.resolveCodeSessionMemoryContext(asString(args.sessionId), request);
        if (!codeMemory) {
          return { success: false, error: 'A reachable code session is required to search code-session memory.' };
        }
        this.guardAction(request, 'read_file', { path: `memory:bridge:code_session:${codeMemory.sessionId}`, query });
        if (!codeMemory.store) {
          return { success: false, error: 'Code-session memory is not enabled.' };
        }
        const results = this.searchPersistentMemoryEntries(codeMemory.store, codeMemory.sessionId, query, limit);
        return {
          success: true,
          output: {
            referenceOnly: true,
            sourceScope: 'code_session',
            codeSessionId: codeMemory.sessionId,
            query,
            resultCount: results.length,
            results,
          },
          message: results.length > 0
            ? `Found ${results.length} reference memory entr${results.length === 1 ? 'y' : 'ies'} in code-session memory.`
            : 'No matching entries found in code-session memory.',
        };
      },
    );

    registerBuiltinSearchTools({
      registry: this.registry,
      getDocSearch: () => this.options.docSearch,
      asString,
      asNumber,
    });

    registerBuiltinWorkspaceTools({
      registry: this.registry,
      requireString,
      asString,
      asNumber,
      guardAction: (request, action, details) => this.guardAction(request, action, details),
      getGoogleService: () => this.options.googleService,
      getMicrosoftService: () => this.options.microsoftService,
    });

    registerBuiltinAutomationTools({
      registry: this.registry,
      requireString,
      requireBoolean,
      asString,
      asNumber,
      isRecord,
      guardAction: (request, action, details) => this.guardAction(request, action, details),
      getAutomationControlPlane: () => this.automationControlPlane,
      getAutomationOutputStore: () => this.options.automationOutputStore,
      hasTool: (toolName) => Boolean(this.registry.get(toolName)),
    });

    // ── Policy Update Tool ───────────────────────────────────────
    // Allows the assistant to modify allowed paths/commands/domains with mandatory user approval.
    // Configurable per-action via agentPolicyUpdates config.

    const policyUpdates = this.options.agentPolicyUpdates;
    if (policyUpdates?.allowedPaths || policyUpdates?.allowedCommands || policyUpdates?.allowedDomains) {
      const enabledActions: string[] = [];
      if (policyUpdates.allowedPaths) enabledActions.push('add_path', 'remove_path');
      if (policyUpdates.allowedCommands) enabledActions.push('add_command', 'remove_command');
      if (policyUpdates.allowedDomains) enabledActions.push('add_domain', 'remove_domain');
      if (policyUpdates.toolPolicies) enabledActions.push('set_tool_policy_auto', 'set_tool_policy_manual', 'set_tool_policy_deny');

      this.registry.register(
        {
          name: 'update_tool_policy',
          description: `Update tool sandbox policy (allowed paths, commands, or domains). Always requires user approval regardless of policy mode. ` +
            `Enabled actions: ${enabledActions.join(', ')}. ` +
            `Use this when the user asks to grant access to a directory, allow a command, or add a domain.`,
          shortDescription: 'Update tool sandbox policy (paths, commands, domains).',
          risk: 'external_post',  // Forces approval in all policy modes
          category: 'system',
          parameters: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                description: `Action to perform: ${enabledActions.join(', ')}.`,
              },
              value: {
                type: 'string',
                description: 'The path, command prefix, or domain to add/remove.',
              },
            },
            required: ['action', 'value'],
          },
        },
        async (args, request) => {
          const action = requireString(args.action, 'action').trim();
          const value = requireString(args.value, 'value').trim();
          if (!value) return { success: false, error: 'Value cannot be empty.' };
          if (!enabledActions.includes(action)) {
            return { success: false, error: `Action '${action}' is not enabled. Enabled actions: ${enabledActions.join(', ')}.` };
          }

          if (action === 'add_path' && this.isCodeWorkspacePolicyNoOp({ name: 'update_tool_policy' } as ToolDefinition, { action, value }, request)) {
            return {
              success: true,
              output: {
                message: `Path '${value}' is already trusted for the active coding session workspace.`,
                allowedPaths: this.getEffectiveAllowedPaths(request),
              },
            };
          }

          const current = this.getPolicy();
          let updated: ToolPolicyUpdate;
          let browserAllowedDomainsUpdate: string[] | undefined;

          switch (action) {
            case 'add_path': {
              if (current.sandbox.allowedPaths.includes(value)) {
                return { success: true, output: { message: `Path '${value}' is already in the allowlist.`, allowedPaths: current.sandbox.allowedPaths } };
              }
              updated = { sandbox: { allowedPaths: [...current.sandbox.allowedPaths, value] } };
              break;
            }
            case 'remove_path': {
              const filtered = current.sandbox.allowedPaths.filter(p => p !== value);
              if (filtered.length === current.sandbox.allowedPaths.length) {
                return { success: false, error: `Path '${value}' is not in the allowlist.` };
              }
              if (filtered.length === 0) {
                return { success: false, error: 'Cannot remove the last allowed path — at least one must remain.' };
              }
              updated = { sandbox: { allowedPaths: filtered } };
              break;
            }
            case 'add_command': {
              if (current.sandbox.allowedCommands.includes(value)) {
                return { success: true, output: { message: `Command '${value}' is already in the allowlist.`, allowedCommands: current.sandbox.allowedCommands } };
              }
              updated = { sandbox: { allowedCommands: [...current.sandbox.allowedCommands, value] } };
              break;
            }
            case 'remove_command': {
              const filtered = current.sandbox.allowedCommands.filter(c => c !== value);
              if (filtered.length === current.sandbox.allowedCommands.length) {
                return { success: false, error: `Command '${value}' is not in the allowlist.` };
              }
              updated = { sandbox: { allowedCommands: filtered } };
              break;
            }
            case 'add_domain': {
              const normalizedValue = value.toLowerCase();
              const currentBrowserDomains = this.getExplicitBrowserAllowedDomains();
              const browserNeedsUpdate = !!currentBrowserDomains && !currentBrowserDomains.includes(normalizedValue);
              if (current.sandbox.allowedDomains.includes(normalizedValue) && !browserNeedsUpdate) {
                return { success: true, output: { message: `Domain '${normalizedValue}' is already in the allowlist.`, allowedDomains: current.sandbox.allowedDomains } };
              }
              updated = current.sandbox.allowedDomains.includes(normalizedValue)
                ? {}
                : { sandbox: { allowedDomains: [...current.sandbox.allowedDomains, normalizedValue] } };
              if (browserNeedsUpdate) {
                browserAllowedDomainsUpdate = [...currentBrowserDomains!, normalizedValue];
                this.options.browserConfig = {
                  ...(this.options.browserConfig ?? { enabled: true }),
                  allowedDomains: browserAllowedDomainsUpdate,
                };
              }
              break;
            }
            case 'remove_domain': {
              const normalizedValue = value.toLowerCase();
              const filtered = current.sandbox.allowedDomains.filter((d) => d !== normalizedValue);
              const currentBrowserDomains = this.getExplicitBrowserAllowedDomains();
              const browserHasDomain = !!currentBrowserDomains && currentBrowserDomains.includes(normalizedValue);
              if (filtered.length === current.sandbox.allowedDomains.length && !browserHasDomain) {
                return { success: false, error: `Domain '${normalizedValue}' is not in the allowlist.` };
              }
              updated = filtered.length === current.sandbox.allowedDomains.length
                ? {}
                : { sandbox: { allowedDomains: filtered } };
              if (browserHasDomain) {
                browserAllowedDomainsUpdate = currentBrowserDomains!.filter((d) => d !== normalizedValue);
                this.options.browserConfig = {
                  ...(this.options.browserConfig ?? { enabled: true }),
                  allowedDomains: browserAllowedDomainsUpdate,
                };
              }
              break;
            }
            case 'set_tool_policy_auto': {
              updated = { toolPolicies: { [value]: 'auto' } };
              break;
            }
            case 'set_tool_policy_manual': {
              updated = { toolPolicies: { [value]: 'manual' } };
              break;
            }
            case 'set_tool_policy_deny': {
              updated = { toolPolicies: { [value]: 'deny' } };
              break;
            }
            default:
              return { success: false, error: `Unknown action: ${action}` };
          }

          const result = updated.mode || updated.toolPolicies || updated.sandbox
            ? this.updatePolicy(updated)
            : current;
          // Persist to config file so changes survive reloads and restarts
          try { this.options.onPolicyUpdate?.(result, browserAllowedDomainsUpdate ? { browserAllowedDomains: browserAllowedDomainsUpdate } : undefined); } catch { /* best-effort persist */ }
          return {
            success: true,
            output: {
              message: `Policy updated: ${action} '${value}'.`,
              allowedPaths: result.sandbox.allowedPaths,
              allowedCommands: result.sandbox.allowedCommands,
              allowedDomains: result.sandbox.allowedDomains,
              ...(browserAllowedDomainsUpdate ? { browserAllowedDomains: browserAllowedDomainsUpdate } : {}),
            },
          };
        },
      );
    }
  }

  private assertGmailHostAllowed(): void {
    const host = 'gmail.googleapis.com';
    if (!this.isHostAllowed(host)) {
      throw new Error(`Host '${host}' is not in allowedDomains. Add it in tools policy before sending.`);
    }
  }

  private async resolveAllowedPath(inputPath: string, request?: Partial<ToolExecutionRequest>): Promise<string> {
    const normalizedInput = normalizePathForHost(inputPath);
    let candidate = isAbsolute(normalizedInput)
      ? resolve(normalizedInput)
      : resolve(this.getEffectiveWorkspaceRoot(request), normalizedInput);
    // Resolve symlinks to prevent traversal via symlink to sensitive paths
    try {
      candidate = await realpath(candidate);
    } catch {
      // Path may not exist yet (e.g. write_file creating new file) — use resolved path
    }
    const roots = await Promise.all(
      uniqueNonEmpty(this.getEffectiveAllowedPaths(request))
        .map(async (root) => {
          const resolvedRoot = resolve(normalizePathForHost(root));
          try {
            return await realpath(resolvedRoot);
          } catch {
            return resolvedRoot;
          }
        }),
    );
    const allowed = roots.some((root) => isPathInside(candidate, root));
    if (!allowed) {
      const preview = roots.slice(0, 4).join(', ') || '(none)';
      throw new Error(
        `Path '${inputPath}' is outside allowed paths. Allowed roots: ${preview}. ` +
        'Use the update_tool_policy tool to add the path, or update manually via Tools policy > Allowed Paths (web) / /tools policy paths (CLI).',
      );
    }
    return candidate;
  }

  // ── Search provider helpers ───────────────────────────────────

  private resolveSearchProvider(requested: string): 'duckduckgo' | 'brave' | 'perplexity' {
    if (requested === 'brave') return 'brave';
    if (requested === 'perplexity') return 'perplexity';
    if (requested === 'duckduckgo') return 'duckduckgo';
    // Auto: prefer Brave (one API key covers search + free summarizer) > Perplexity > DuckDuckGo.
    // Keys come from config (with ${ENV_VAR} interpolation) — same as LLM API keys.
    const cfg = this.webSearchConfig;
    if (cfg.braveApiKey) return 'brave';
    if (cfg.perplexityApiKey || cfg.openRouterApiKey) return 'perplexity';
    return 'duckduckgo';
  }

  private async searchDuckDuckGo(
    query: string,
    maxResults: number,
  ): Promise<{ query: string; provider: 'duckduckgo'; results: Array<{ title: string; url: string; snippet: string }> }> {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': 'GuardianAgent-Tools/1.0',
          'Accept': 'text/html',
        },
      });
      const html = await response.text();
      const results = parseDuckDuckGoResults(html, maxResults);
      return { query, provider: 'duckduckgo', results };
    } finally {
      clearTimeout(timer);
    }
  }

  private async searchBrave(
    query: string,
    maxResults: number,
  ): Promise<{ query: string; provider: 'brave'; results: Array<{ title: string; url: string; snippet: string }>; answer?: string }> {
    const apiKey = this.webSearchConfig.braveApiKey;
    if (!apiKey) throw new Error('Brave API key not configured. Set braveApiKey: ${BRAVE_API_KEY} in assistant.tools.webSearch config.');

    // Step 1: Web search with summary=1 to request a summarizer key.
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}&summary=1`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': apiKey,
        },
      });
      if (!response.ok) {
        throw new Error(`Brave API returned ${response.status}: ${await response.text().catch(() => '')}`);
      }
      const data = await response.json() as {
        web?: { results?: Array<{ title: string; url: string; description: string }> };
        summarizer?: { key?: string };
      };
      const results = (data.web?.results ?? []).slice(0, maxResults).map((r) => ({
        title: r.title ?? '',
        url: r.url ?? '',
        snippet: r.description ?? '',
      }));

      // Step 2: If a summarizer key is available, fetch the synthesized answer (FREE — no extra cost).
      let answer: string | undefined;
      const summarizerKey = data.summarizer?.key;
      if (summarizerKey) {
        try {
          answer = await this.fetchBraveSummary(apiKey, summarizerKey, controller.signal);
        } catch {
          // Summarizer is best-effort; return structured results without answer.
        }
      }

      return { query, provider: 'brave', results, answer };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Fetch a synthesized answer from the Brave Summarizer API.
   * Summarizer requests are FREE — only the initial web search counts toward quota.
   */
  private async fetchBraveSummary(apiKey: string, summarizerKey: string, signal: AbortSignal): Promise<string> {
    const url = `https://api.search.brave.com/res/v1/summarizer/search?key=${encodeURIComponent(summarizerKey)}&entity_info=1`;
    const response = await fetch(url, {
      method: 'GET',
      signal,
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': apiKey,
      },
    });
    if (!response.ok) {
      throw new Error(`Brave Summarizer returned ${response.status}`);
    }
    const data = await response.json() as {
      title?: string;
      summary?: Array<{ type?: string; data?: string; children?: Array<{ data?: string }> }>;
    };

    // Extract text from the structured summary nodes.
    if (!data.summary?.length) return '';
    const parts: string[] = [];
    for (const node of data.summary) {
      if (node.data) parts.push(node.data);
      if (node.children) {
        for (const child of node.children) {
          if (child.data) parts.push(child.data);
        }
      }
    }
    return parts.join(' ').trim();
  }

  private async searchPerplexity(
    query: string,
    maxResults: number,
  ): Promise<{ query: string; provider: 'perplexity'; results: Array<{ title: string; url: string; snippet: string }>; answer?: string }> {
    // Support both direct Perplexity API and OpenRouter proxy.
    // Keys come from config with ${ENV_VAR} interpolation — same as LLM API keys.
    const cfg = this.webSearchConfig;
    const directKey = cfg.perplexityApiKey;
    const openRouterKey = cfg.openRouterApiKey;

    if (!directKey && !openRouterKey) {
      throw new Error('Perplexity API key not configured. Set perplexityApiKey: ${PERPLEXITY_API_KEY} (or openRouterApiKey: ${OPENROUTER_API_KEY}) in assistant.tools.webSearch config.');
    }

    const useOpenRouter = !directKey && !!openRouterKey;
    const apiKey = directKey || openRouterKey!;
    const apiUrl = useOpenRouter
      ? 'https://openrouter.ai/api/v1/chat/completions'
      : 'https://api.perplexity.ai/chat/completions';
    const model = useOpenRouter ? 'perplexity/sonar' : 'sonar';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
      if (useOpenRouter) {
        headers['HTTP-Referer'] = 'https://guardianagent.local';
        headers['X-Title'] = 'GuardianAgent';
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        signal: controller.signal,
        headers,
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: query }],
        }),
      });
      if (!response.ok) {
        throw new Error(`Perplexity API returned ${response.status}: ${await response.text().catch(() => '')}`);
      }
      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        citations?: Array<string | { url: string; title?: string }>;
      };
      const answer = data.choices?.[0]?.message?.content ?? '';
      const citations = (data.citations ?? []).slice(0, maxResults);
      const results = citations.map((c, i) => {
        if (typeof c === 'string') return { title: `Source ${i + 1}`, url: c, snippet: '' };
        return { title: c.title ?? `Source ${i + 1}`, url: c.url, snippet: '' };
      });
      return { query, provider: 'perplexity', results, answer };
    } finally {
      clearTimeout(timer);
    }
  }

  private assertWebSearchHostsAllowed(provider: 'duckduckgo' | 'brave' | 'perplexity'): void {
    const requiredHosts = this.getWebSearchRequiredHosts(provider);
    const blocked = requiredHosts.filter((host) => !this.isHostAllowed(host));
    if (blocked.length > 0) {
      throw new Error(
        `Web search provider '${provider}' is blocked by allowedDomains. ` +
        `Add: ${blocked.join(', ')}`,
      );
    }
  }

  private createWhmClient(profileId: string): CpanelClient {
    const config = this.getCloudCpanelProfile(profileId);
    if (config.type !== 'whm') {
      throw new Error(`Profile '${profileId}' is not a WHM profile.`);
    }
    return new CpanelClient(config);
  }

  private resolveCpanelAccountContext(profileId: string, requestedAccount?: string): {
    client: CpanelClient;
    account?: string;
  } {
    const config = this.getCloudCpanelProfile(profileId);
    const client = new CpanelClient(config);
    if (config.type === 'cpanel') {
      return {
        client,
        account: config.username,
      };
    }

    const account = requestedAccount?.trim() || config.defaultCpanelUser?.trim();
    if (!account) {
      throw new Error(`WHM profile '${profileId}' requires an account argument or defaultCpanelUser.`);
    }
    return { client, account };
  }

  private getCloudCpanelProfile(profileId: string): CpanelInstanceConfig {
    if (!this.cloudConfig.enabled) {
      throw new Error('Cloud tools are disabled in assistant.tools.cloud.enabled.');
    }
    const id = profileId.trim();
    if (!id) {
      throw new Error('profile is required');
    }
    const profile = (this.cloudConfig.cpanelProfiles ?? []).find((entry) => entry.id === id);
    if (!profile) {
      throw new Error(`Unknown cloud profile '${id}'.`);
    }
    if (!profile.apiToken?.trim()) {
      throw new Error(`Cloud profile '${id}' does not have a resolved API token.`);
    }
    let normalized: CpanelInstanceConfig;
    try {
      normalized = normalizeCpanelConnectionConfig({
        id: profile.id,
        name: profile.name,
        host: profile.host,
        port: profile.port,
        username: profile.username,
        apiToken: profile.apiToken,
        type: profile.type,
        ssl: profile.ssl,
        allowSelfSigned: profile.allowSelfSigned,
        defaultCpanelUser: profile.defaultCpanelUser,
      });
    } catch (error) {
      throw new Error(`Cloud profile '${id}' has an invalid host: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!this.isHostAllowed(normalized.host)) {
      throw new Error(`Host '${normalized.host}' is not in allowedDomains.`);
    }

    return normalized;
  }

  private createVercelClient(profileId: string): VercelClient {
    const config = this.getCloudVercelProfile(profileId);
    return new VercelClient(config);
  }

  private createCloudflareClient(profileId: string): CloudflareClient {
    const config = this.getCloudflareProfile(profileId);
    return new CloudflareClient(config);
  }

  private createAwsClient(profileId: string, service?: AwsServiceName): AwsClient {
    const config = this.getCloudAwsProfile(profileId, service);
    return new AwsClient(config);
  }

  private createGcpClient(profileId: string, service?: GcpServiceName): GcpClient {
    const config = this.getCloudGcpProfile(profileId, service);
    return new GcpClient(config);
  }

  private createAzureClient(profileId: string, service?: AzureServiceName): AzureClient {
    const config = this.getCloudAzureProfile(profileId, service);
    return new AzureClient(config);
  }

  private getCloudVercelProfile(profileId: string): VercelInstanceConfig {
    if (!this.cloudConfig.enabled) {
      throw new Error('Cloud tools are disabled in assistant.tools.cloud.enabled.');
    }
    const id = profileId.trim();
    if (!id) {
      throw new Error('profile is required');
    }
    const profile = (this.cloudConfig.vercelProfiles ?? []).find((entry) => entry.id === id);
    if (!profile) {
      throw new Error(`Unknown Vercel profile '${id}'.`);
    }
    if (!profile.apiToken?.trim()) {
      throw new Error(`Vercel profile '${id}' does not have a resolved API token.`);
    }
    if (profile.teamId?.trim() && profile.slug?.trim()) {
      throw new Error(`Vercel profile '${id}' cannot set both teamId and slug.`);
    }

    let baseUrl: URL;
    try {
      baseUrl = new URL(normalizeOptionalHttpUrlInput(profile.apiBaseUrl) || 'https://api.vercel.com');
    } catch {
      throw new Error(`Vercel profile '${id}' has an invalid apiBaseUrl.`);
    }
    if (!this.isHostAllowed(baseUrl.hostname)) {
      throw new Error(`Host '${baseUrl.hostname}' is not in allowedDomains.`);
    }

    return {
      id: profile.id,
      name: profile.name,
      apiBaseUrl: normalizeHttpUrlInput(baseUrl.toString()),
      apiToken: profile.apiToken,
      teamId: profile.teamId,
      slug: profile.slug,
    };
  }

  private getCloudflareProfile(profileId: string): CloudflareInstanceConfig {
    if (!this.cloudConfig.enabled) {
      throw new Error('Cloud tools are disabled in assistant.tools.cloud.enabled.');
    }
    const id = profileId.trim();
    if (!id) {
      throw new Error('profile is required');
    }
    const profile = (this.cloudConfig.cloudflareProfiles ?? []).find((entry) => entry.id === id);
    if (!profile) {
      throw new Error(`Unknown Cloudflare profile '${id}'.`);
    }
    if (!profile.apiToken?.trim()) {
      throw new Error(`Cloudflare profile '${id}' does not have a resolved API token.`);
    }

    let baseUrl: URL;
    try {
      baseUrl = new URL(normalizeOptionalHttpUrlInput(profile.apiBaseUrl) || 'https://api.cloudflare.com/client/v4');
    } catch {
      throw new Error(`Cloudflare profile '${id}' has an invalid apiBaseUrl.`);
    }
    if (!this.isHostAllowed(baseUrl.hostname)) {
      throw new Error(`Host '${baseUrl.hostname}' is not in allowedDomains.`);
    }

    return {
      id: profile.id,
      name: profile.name,
      apiBaseUrl: normalizeHttpUrlInput(baseUrl.toString()),
      apiToken: profile.apiToken,
      accountId: profile.accountId,
      defaultZoneId: profile.defaultZoneId,
    };
  }

  private getCloudAwsProfile(profileId: string, service?: AwsServiceName): AwsInstanceConfig {
    if (!this.cloudConfig.enabled) {
      throw new Error('Cloud tools are disabled in assistant.tools.cloud.enabled.');
    }
    const id = profileId.trim();
    if (!id) {
      throw new Error('profile is required');
    }
    const profile = (this.cloudConfig.awsProfiles ?? []).find((entry) => entry.id === id);
    if (!profile) {
      throw new Error(`Unknown AWS profile '${id}'.`);
    }
    const hasAccessKey = !!profile.accessKeyId?.trim();
    const hasSecretKey = !!profile.secretAccessKey?.trim();
    if (hasAccessKey !== hasSecretKey) {
      throw new Error(`AWS profile '${id}' must provide both accessKeyId and secretAccessKey when using explicit credentials.`);
    }

    const config: AwsInstanceConfig = {
      id: profile.id,
      name: profile.name,
      region: profile.region,
      accessKeyId: profile.accessKeyId,
      secretAccessKey: profile.secretAccessKey,
      sessionToken: profile.sessionToken,
      endpoints: normalizeHttpUrlRecord(profile.endpoints),
    };
    const host = this.describeAwsEndpoint(config, service ?? 'sts');
    const parsed = new URL(host);
    if (!this.isHostAllowed(parsed.hostname)) {
      throw new Error(`Host '${parsed.hostname}' is not in allowedDomains.`);
    }
    return config;
  }

  private getCloudGcpProfile(profileId: string, service?: GcpServiceName): GcpInstanceConfig {
    if (!this.cloudConfig.enabled) {
      throw new Error('Cloud tools are disabled in assistant.tools.cloud.enabled.');
    }
    const id = profileId.trim();
    if (!id) {
      throw new Error('profile is required');
    }
    const profile = (this.cloudConfig.gcpProfiles ?? []).find((entry) => entry.id === id);
    if (!profile) {
      throw new Error(`Unknown GCP profile '${id}'.`);
    }
    const hasAccessToken = !!profile.accessToken?.trim();
    const hasServiceAccount = !!profile.serviceAccountJson?.trim();
    if (!hasAccessToken && !hasServiceAccount) {
      throw new Error(`GCP profile '${id}' does not have a resolved access token or service account JSON.`);
    }
    const config: GcpInstanceConfig = {
      id: profile.id,
      name: profile.name,
      projectId: profile.projectId,
      location: profile.location,
      accessToken: profile.accessToken,
      serviceAccountJson: profile.serviceAccountJson,
      endpoints: normalizeHttpUrlRecord(profile.endpoints),
    };
    const host = this.describeGcpEndpoint(config, service ?? 'cloudResourceManager');
    const parsed = new URL(host);
    if (!this.isHostAllowed(parsed.hostname)) {
      throw new Error(`Host '${parsed.hostname}' is not in allowedDomains.`);
    }
    for (const [endpointName, endpoint] of Object.entries(config.endpoints ?? {})) {
      if (!endpoint?.trim()) continue;
      const endpointHost = new URL(endpoint).hostname;
      if (!this.isHostAllowed(endpointHost)) {
        throw new Error(`Host '${endpointHost}' is not in allowedDomains for GCP endpoint '${endpointName}'.`);
      }
    }
    if (hasServiceAccount) {
      const tokenHost = new URL(this.describeGcpEndpoint(config, 'oauth2Token'));
      if (!this.isHostAllowed(tokenHost.hostname)) {
        throw new Error(`Host '${tokenHost.hostname}' is not in allowedDomains.`);
      }
    }
    if (!config.projectId.trim()) {
      throw new Error(`GCP profile '${id}' must define projectId.`);
    }
    return config;
  }

  private getCloudAzureProfile(profileId: string, service?: AzureServiceName): AzureInstanceConfig {
    if (!this.cloudConfig.enabled) {
      throw new Error('Cloud tools are disabled in assistant.tools.cloud.enabled.');
    }
    const id = profileId.trim();
    if (!id) {
      throw new Error('profile is required');
    }
    const profile = (this.cloudConfig.azureProfiles ?? []).find((entry) => entry.id === id);
    if (!profile) {
      throw new Error(`Unknown Azure profile '${id}'.`);
    }
    const hasAccessToken = !!profile.accessToken?.trim();
    const hasClientId = !!profile.clientId?.trim();
    const hasClientSecret = !!profile.clientSecret?.trim();
    if (!hasAccessToken && !(profile.tenantId?.trim() && hasClientId && hasClientSecret)) {
      throw new Error(`Azure profile '${id}' does not have a resolved access token or service principal credentials.`);
    }
    if (hasClientId !== hasClientSecret) {
      throw new Error(`Azure profile '${id}' must provide both clientId and clientSecret together.`);
    }
    const config: AzureInstanceConfig = {
      id: profile.id,
      name: profile.name,
      subscriptionId: profile.subscriptionId,
      tenantId: profile.tenantId,
      accessToken: profile.accessToken,
      clientId: profile.clientId,
      clientSecret: profile.clientSecret,
      defaultResourceGroup: profile.defaultResourceGroup,
      blobBaseUrl: normalizeOptionalHttpUrlInput(profile.blobBaseUrl),
      endpoints: normalizeHttpUrlRecord(profile.endpoints),
    };
    const endpoint = this.describeAzureEndpoint(config, service ?? 'management');
    const endpointHost = new URL(endpoint).hostname;
    if (!this.isHostAllowed(endpointHost)) {
      throw new Error(`Host '${endpointHost}' is not in allowedDomains.`);
    }
    if (config.blobBaseUrl?.trim()) {
      const blobHost = new URL(config.blobBaseUrl).hostname;
      if (!this.isHostAllowed(blobHost)) {
        throw new Error(`Host '${blobHost}' is not in allowedDomains.`);
      }
    } else if (service === 'blob' && !this.isHostAllowed('blob.core.windows.net')) {
      throw new Error(`Host 'blob.core.windows.net' is not in allowedDomains.`);
    }
    return config;
  }

  private describeCloudEndpoint(profile: CpanelInstanceConfig): string {
    const normalized = normalizeCpanelConnectionConfig(profile);
    const ssl = normalized.ssl !== false;
    const defaultPort = normalized.type === 'whm'
      ? (ssl ? 2087 : 2086)
      : (ssl ? 2083 : 2082);
    const port = normalized.port ?? defaultPort;
    return `${ssl ? 'https' : 'http'}://${normalized.host}:${port}`;
  }

  private describeVercelEndpoint(profile: VercelInstanceConfig): string {
    return normalizeHttpUrlInput(profile.apiBaseUrl?.trim() || 'https://api.vercel.com');
  }

  private describeCloudflareEndpoint(profile: CloudflareInstanceConfig): string {
    return normalizeHttpUrlInput(profile.apiBaseUrl?.trim() || 'https://api.cloudflare.com/client/v4');
  }

  private describeAwsEndpoint(profile: AwsInstanceConfig, service: AwsServiceName): string {
    const override = profile.endpoints?.[service];
    if (override?.trim()) {
      return normalizeHttpUrlInput(override);
    }
    const region = profile.region;
    switch (service) {
      case 'iam':
        return 'https://iam.amazonaws.com';
      case 'route53':
        return 'https://route53.amazonaws.com';
      case 'costExplorer':
        return 'https://ce.us-east-1.amazonaws.com';
      case 'cloudwatch':
        return `https://monitoring.${region}.amazonaws.com`;
      case 'cloudwatchLogs':
        return `https://logs.${region}.amazonaws.com`;
      case 's3':
        return `https://s3.${region}.amazonaws.com`;
      default:
        return `https://${service}.${region}.amazonaws.com`;
    }
  }

  private describeGcpEndpoint(profile: GcpInstanceConfig, service: GcpServiceName): string {
    const override = profile.endpoints?.[service];
    if (override?.trim()) {
      return normalizeHttpUrlInput(override);
    }
    switch (service) {
      case 'oauth2Token':
        return 'https://oauth2.googleapis.com/token';
      case 'cloudResourceManager':
        return 'https://cloudresourcemanager.googleapis.com';
      case 'serviceUsage':
        return 'https://serviceusage.googleapis.com';
      case 'compute':
        return 'https://compute.googleapis.com';
      case 'run':
        return 'https://run.googleapis.com';
      case 'storage':
        return 'https://storage.googleapis.com';
      case 'dns':
        return 'https://dns.googleapis.com';
      case 'logging':
        return 'https://logging.googleapis.com';
    }
  }

  private describeAzureEndpoint(profile: AzureInstanceConfig, service: AzureServiceName, accountName?: string): string {
    switch (service) {
      case 'oauth2Token':
        return profile.endpoints?.oauth2Token?.trim()
          ? normalizeHttpUrlInput(profile.endpoints.oauth2Token)
          : `https://login.microsoftonline.com/${encodeURIComponent(profile.tenantId?.trim() || 'common')}/oauth2/v2.0/token`;
      case 'blob':
        return normalizeOptionalHttpUrlInput(profile.blobBaseUrl) || `https://${accountName?.trim() || 'account'}.blob.core.windows.net`;
      case 'management':
      default:
        return profile.endpoints?.management?.trim()
          ? normalizeHttpUrlInput(profile.endpoints.management)
          : 'https://management.azure.com';
    }
  }

  private resolveGcpLocation(value: unknown, profileId: string, throwOnMissing: boolean = true): string {
    const explicit = asString(value).trim();
    if (explicit) return explicit;
    const profile = (this.cloudConfig.gcpProfiles ?? []).find((entry) => entry.id === profileId.trim());
    const fallback = profile?.location?.trim();
    if (fallback) return fallback;
    if (throwOnMissing) {
      throw new Error(`location is required when GCP profile '${profileId}' has no default location.`);
    }
    return '';
  }

  private resolveAzureResourceGroup(value: unknown, profileId: string, throwOnMissing: boolean = true): string {
    const explicit = asString(value).trim();
    if (explicit) return explicit;
    const profile = (this.cloudConfig.azureProfiles ?? []).find((entry) => entry.id === profileId.trim());
    const fallback = profile?.defaultResourceGroup?.trim();
    if (fallback) return fallback;
    if (throwOnMissing) {
      throw new Error(`resourceGroup is required when Azure profile '${profileId}' has no default resource group.`);
    }
    return '';
  }

  private isHostAllowed(host: string, allowedDomains: string[] = this.policy.sandbox.allowedDomains): boolean {
    const normalized = host.trim().toLowerCase();
    if (!normalized) return false;
    return allowedDomains.some((allowedHost) => {
      const allowed = allowedHost.trim().toLowerCase();
      return normalized === allowed || normalized.endsWith(`.${allowed}`);
    });
  }

  /** Execute a command through the OS-level sandbox. */
  private sandboxExec(
    command: string,
    profile: SandboxProfile,
    opts: { networkAccess?: boolean; cwd?: string; timeout?: number; maxBuffer?: number; env?: Record<string, string> } = {},
  ): Promise<{ stdout: string; stderr: string }> {
    return sandboxedExec(command, this.sandboxConfig, {
      profile,
      networkAccess: opts.networkAccess,
      cwd: opts.cwd ?? this.options.workspaceRoot,
      timeout: opts.timeout,
      maxBuffer: opts.maxBuffer,
      env: opts.env,
    });
  }

  private async sandboxExecFile(
    command: string,
    args: string[],
    profile: SandboxProfile,
    opts: { networkAccess?: boolean; cwd?: string; timeout?: number; maxBuffer?: number; env?: Record<string, string> } = {},
  ): Promise<{ stdout: string; stderr: string }> {
    const child = await sandboxedSpawn(command, args, this.sandboxConfig, {
      profile,
      networkAccess: opts.networkAccess,
      cwd: opts.cwd ?? this.options.workspaceRoot,
      env: opts.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsShell: false,
    });

    const maxBuffer = Math.max(1_024, opts.maxBuffer ?? 1_000_000);
    let stdout = '';
    let stderr = '';
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let timedOut = false;
    let overflow = false;
    const timeoutHandle = opts.timeout
      ? setTimeout(() => {
          timedOut = true;
          child.kill();
        }, opts.timeout)
      : null;

    const appendChunk = (chunk: string | Buffer, target: 'stdout' | 'stderr') => {
      const text = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
      const bytes = Buffer.byteLength(text);
      if (target === 'stdout') {
        stdoutBytes += bytes;
        if (stdoutBytes > maxBuffer) {
          overflow = true;
          child.kill();
          return;
        }
        stdout += text;
        return;
      }
      stderrBytes += bytes;
      if (stderrBytes > maxBuffer) {
        overflow = true;
        child.kill();
        return;
      }
      stderr += text;
    };

    return await new Promise<{ stdout: string; stderr: string }>((resolvePromise, rejectPromise) => {
      child.stdout?.on('data', (chunk) => appendChunk(chunk, 'stdout'));
      child.stderr?.on('data', (chunk) => appendChunk(chunk, 'stderr'));
      child.on('error', (error) => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        rejectPromise(error);
      });
      child.on('close', (code, signal) => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        if (timedOut) {
          rejectPromise(new Error(`Command timed out after ${opts.timeout}ms.`));
          return;
        }
        if (overflow) {
          rejectPromise(new Error(`Command output exceeded max buffer (${maxBuffer} bytes).`));
          return;
        }
        if ((code ?? 0) !== 0) {
          const detail = stderr.trim() || stdout.trim() || `exit code ${code ?? 'unknown'}${signal ? ` (${signal})` : ''}`;
          rejectPromise(new Error(detail));
          return;
        }
        resolvePromise({ stdout, stderr });
      });
    });
  }

  private async collectLocalConnections(
    stateFilter: string,
  ): Promise<Array<{
    protocol: string;
    localAddress: string;
    localPort: number;
    remoteAddress: string;
    remotePort: number;
    state: string;
    process: string | null;
  }>> {
    const platform = process.platform;
    if (platform === 'linux') {
      try {
        const { stdout } = await this.sandboxExec('ss -tunap', 'read-only', { networkAccess: true, timeout: 10_000 });
        return parseSsLinux(stdout, stateFilter);
      } catch {
        const { stdout } = await this.sandboxExec('netstat -an', 'read-only', { networkAccess: true, timeout: 10_000 });
        return parseNetstatWindows(stdout, stateFilter);
      }
    }
    const { stdout } = await this.sandboxExec('netstat -an', 'read-only', { networkAccess: true, timeout: 10_000 });
    return parseNetstatWindows(stdout, stateFilter);
  }

  private getConnectionProfile(connectionId: string): AssistantNetworkConfig['connections'][number] | undefined {
    const id = connectionId.trim();
    if (!id) return undefined;
    return this.networkConfig.connections.find((connection) => connection.id === id);
  }

  private guardAction(
    request: ToolExecutionRequest,
    type: string,
    params: Record<string, unknown>,
  ): void {
    const effectiveParams = request.codeContext && type === 'execute_command'
      ? {
          ...params,
          allowedCommandsOverride: this.getEffectiveAllowedCommands(request),
        }
      : params;
    if (request.agentContext) {
      request.agentContext.checkAction({ type, params: effectiveParams });
      return;
    }
    if (!this.options.onCheckAction) return;
    this.options.onCheckAction({
      type,
      params: effectiveParams,
      origin: request.origin,
      agentId: request.agentId ?? 'assistant-tools',
    });
  }

  private initializeSandboxNotices(): void {
    const health = this.sandboxHealth;
    if (!health || !this.sandboxConfig.enabled) return;
    if (isStrictSandboxLockdown(this.sandboxConfig, health)) {
      this.runtimeNotices.push({
        level: 'warn',
        message: [
          `Strict sandbox mode is active: risky subprocess-backed tools are disabled on ${health.platform}.`,
          health.reasons[0] ?? '',
          'This host also lacks descendant executable identity enforcement for child processes, so strict mode fails closed for risky subprocess-backed tools.',
          'To unlock them safely, run on Linux/Unix with bubblewrap available, or use the Windows portable app with guardian-sandbox-win.exe AppContainer helper.',
          'If you still want degraded access, you must explicitly set assistant.tools.sandbox.enforcementMode: permissive.',
        ].join(' ').trim(),
      });
      return;
    }
    if ((health.enforcementMode ?? 'permissive') !== 'strict') {
      const enabledAllowances = listEnabledDegradedFallbackAllowances(this.sandboxConfig);
      this.runtimeNotices.push({
        level: health.availability === 'strong' ? 'info' : 'warn',
        message: [
          `Permissive sandbox mode is explicitly enabled on ${health.platform}.`,
          health.availability === 'strong'
            ? 'Strong sandboxing is available, but permissive mode still allows degraded fallbacks if your configuration changes.'
            : (
              enabledAllowances.length > 0
                ? `Degraded fallback overrides are enabled for ${enabledAllowances.join(', ')} while only ${health.availability} sandbox isolation is available.`
                : `Only ${health.availability} sandbox isolation is available, but degraded-backend overrides keep high-risk surfaces blocked by default.`
            ),
          'Current shell execution identity coverage is app-layer only: Guardian validates the requested command and may use direct exec for simple binaries, but it does not yet enforce descendant executable identity for child processes.',
          'Use this only if you accept higher host risk.',
          'Safer options: run on Linux/Unix with bubblewrap available, or use the Windows portable app with guardian-sandbox-win.exe AppContainer helper.',
        ].join(' '),
      });
    }
  }

  private getSandboxBlockedCategoryReason(category: ToolCategory): string | null {
    const health = this.sandboxHealth;
    if (!health || !this.sandboxConfig.enabled) return null;
    if (isStrictSandboxLockdown(this.sandboxConfig, health)) {
      const blockedCategories = new Set<ToolCategory>(['shell', 'browser', 'network', 'system', 'search']);
      if (!blockedCategories.has(category)) return null;
      return `Blocked by strict sandbox mode: no strong sandbox backend is available on ${health.platform}.`;
    }
    if (!isDegradedSandboxFallbackActive(this.sandboxConfig, health)) return null;

    const degradedFallback = resolveDegradedFallbackConfig(this.sandboxConfig);
    if (category === 'browser' && !degradedFallback.allowBrowserTools) {
      return 'Blocked on degraded sandbox backends by default: browser automation requires assistant.tools.sandbox.degradedFallback.allowBrowserTools.';
    }
    if (category === 'network' && !degradedFallback.allowNetworkTools) {
      return 'Blocked on degraded sandbox backends by default: network tools require assistant.tools.sandbox.degradedFallback.allowNetworkTools.';
    }
    return null;
  }

  private getSandboxBlockReason(toolName: string, category?: string): string | null {
    const health = this.sandboxHealth;
    if (!health || !this.sandboxConfig.enabled) return null;
    if (toolName === 'find_tools' || toolName === 'update_tool_policy') {
      return null;
    }

    if (isStrictSandboxLockdown(this.sandboxConfig, health)) {
      if (toolName.startsWith('mcp-')) {
        return `Tool '${toolName}' is blocked by strict sandbox mode because MCP server processes require a strong sandbox backend on ${health.platform}.`;
      }
      if (category && this.getSandboxBlockedCategoryReason(category as ToolCategory)) {
        return `Tool '${toolName}' is blocked by strict sandbox mode because category '${category}' requires strong subprocess isolation on ${health.platform}.`;
      }
      return null;
    }
    if (isDegradedSandboxFallbackActive(this.sandboxConfig, health)) {
      const degradedFallback = resolveDegradedFallbackConfig(this.sandboxConfig);
      if (toolName === 'package_install' && !degradedFallback.allowPackageManagers) {
        return `Tool '${toolName}' is blocked on degraded sandbox backends by default because managed package installs require ${DEGRADED_PACKAGE_MANAGER_HINT}.`;
      }
      if (toolName === 'web_search' && !degradedFallback.allowNetworkTools) {
        return `Tool '${toolName}' is blocked on degraded sandbox backends by default because network and web search access require assistant.tools.sandbox.degradedFallback.allowNetworkTools.`;
      }
      if (toolName === 'chrome_job' && !degradedFallback.allowBrowserTools) {
        return `Tool '${toolName}' is blocked on degraded sandbox backends by default because browser automation requires assistant.tools.sandbox.degradedFallback.allowBrowserTools.`;
      }
      if (toolName.startsWith('mcp-') && !isBrowserMcpToolName(toolName) && !degradedFallback.allowMcpServers) {
        return `Tool '${toolName}' is blocked on degraded sandbox backends by default because third-party MCP servers require assistant.tools.sandbox.degradedFallback.allowMcpServers.`;
      }
      if (isBrowserMcpToolName(toolName) && !degradedFallback.allowBrowserTools) {
        return `Tool '${toolName}' is blocked on degraded sandbox backends by default because browser automation requires assistant.tools.sandbox.degradedFallback.allowBrowserTools.`;
      }
      if (category && this.getSandboxBlockedCategoryReason(category as ToolCategory)) {
        return `Tool '${toolName}' is blocked on degraded sandbox backends by default because category '${category}' remains restricted until you explicitly enable it.`;
      }
    }
    return null;
  }
}

function stripHtml(value: string): string {
  return htmlToText(value, { skipTagContent: new Set(['script', 'style', 'noscript', 'svg', 'canvas']) });
}

function truncateOutput(value: string): string {
  if (!value) return '';
  return value.length > 8000 ? `${value.slice(0, 8000)}\n...[truncated]` : value;
}

function sanitizePreview(value: string): string {
  if (!value) return '';
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned.length > 240 ? `${cleaned.slice(0, 240)}...` : cleaned;
}

/**
 * Extract readable text content from HTML.
 * Prefers <article> or <main> if present; strips nav/footer/header/script/style.
 */
function extractReadableContent(html: string): string {
  const article = findFirstElementInnerHtml(html, 'article');
  const main = findFirstElementInnerHtml(html, 'main');
  const body = article ?? main ?? html;
  const title = stripHtml(findFirstElementInnerHtml(html, 'title') ?? '').trim();
  const bodyText = htmlToText(body, {
    skipTagContent: new Set(['script', 'style', 'nav', 'footer', 'header', 'aside', 'noscript', 'svg', 'canvas', 'iframe']),
  })
    .replace(/\s+/g, ' ')
    .trim();

  return title ? `${title}\n\n${bodyText}` : bodyText;
}

type ParsedHtmlElement = {
  tagName: string;
  attributes: Record<string, string>;
  innerHtml: string;
};

type HtmlTextOptions = {
  skipTagContent?: ReadonlySet<string>;
};

const BLOCK_HTML_TAGS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'body',
  'br',
  'dd',
  'details',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
]);

const VOID_HTML_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

function parseDuckDuckGoResults(
  html: string,
  maxResults: number,
): Array<{ title: string; url: string; snippet: string }> {
  const results: Array<{ title: string; url: string; snippet: string }> = [];
  const resultBlocks = findHtmlElementsByClass(html, 'result');
  for (const block of resultBlocks) {
    if (results.length >= maxResults) break;
    const link = findHtmlElementsByClass(block.innerHtml, 'result__a', 'a')[0];
    if (!link) continue;
    const snippet = findHtmlElementsByClass(block.innerHtml, 'result__snippet')[0];
    const href = normalizeDuckDuckGoResultUrl(link.attributes.href ?? '');
    if (!href) continue;
    results.push({
      title: stripHtml(link.innerHtml).trim(),
      url: href,
      snippet: snippet ? stripHtml(snippet.innerHtml).replace(/\s+/g, ' ').trim() : '',
    });
  }
  return results;
}

function normalizeDuckDuckGoResultUrl(rawHref: string): string {
  const href = rawHref.trim();
  if (!href) return '';
  try {
    const parsed = new URL(href, 'https://html.duckduckgo.com');
    const redirected = parsed.searchParams.get('uddg');
    return redirected?.trim() || parsed.toString();
  } catch {
    return href;
  }
}

function htmlToText(value: string, options: HtmlTextOptions = {}): string {
  if (!value) return '';
  const skipTagContent = options.skipTagContent ?? new Set<string>();
  let text = '';
  const appendSeparator = () => {
    if (text && !/\s$/.test(text)) {
      text += ' ';
    }
  };
  let index = 0;
  while (index < value.length) {
    const ch = value[index];
    if (ch !== '<') {
      text += ch;
      index += 1;
      continue;
    }

    if (value.startsWith('<!--', index)) {
      const commentEnd = value.indexOf('-->', index + 4);
      index = commentEnd === -1 ? value.length : commentEnd + 3;
      appendSeparator();
      continue;
    }

    const tag = parseHtmlStartTag(value, index);
    if (!tag) {
      text += ch;
      index += 1;
      continue;
    }

    const tagName = tag.tagName.toLowerCase();
    if (!tag.isClosing && shouldSkipHtmlTag(tagName, tag.attributes, skipTagContent) && !VOID_HTML_TAGS.has(tagName)) {
      const close = findMatchingClosingTag(value, tagName, tag.startTagEnd + 1);
      index = close === -1 ? value.length : close + (`</${tagName}>`).length;
      appendSeparator();
      continue;
    }

    index = tag.startTagEnd + 1;
    if (BLOCK_HTML_TAGS.has(tagName)) {
      appendSeparator();
    }
  }

  return decodeHtmlEntities(text)
    .replace(/\s+/g, ' ')
    .trim();
}

function shouldSkipHtmlTag(
  tagName: string,
  attributes: Record<string, string>,
  skipTagContent: ReadonlySet<string>,
): boolean {
  if (skipTagContent.has(tagName)) {
    return true;
  }
  if (tagName === 'template') {
    return true;
  }
  if (attributes.hidden !== undefined || attributes.inert !== undefined) {
    return true;
  }
  if ((attributes['aria-hidden'] ?? '').trim().toLowerCase() === 'true') {
    return true;
  }
  if (tagName === 'input' && (attributes.type ?? '').trim().toLowerCase() === 'hidden') {
    return true;
  }
  const style = (attributes.style ?? '').replace(/\s+/g, '').toLowerCase();
  return style.includes('display:none')
    || style.includes('visibility:hidden')
    || style.includes('content-visibility:hidden');
}

function findFirstElementInnerHtml(html: string, tagName: string): string | undefined {
  return findHtmlElementsByTagName(html, tagName)[0]?.innerHtml;
}

function findHtmlElementsByClass(html: string, className: string, tagName?: string): ParsedHtmlElement[] {
  const classToken = className.trim();
  if (!classToken) return [];
  const matches: ParsedHtmlElement[] = [];
  let index = 0;
  while (index < html.length) {
    const open = html.indexOf('<', index);
    if (open === -1) break;
    const tag = parseHtmlStartTag(html, open);
    if (!tag) {
      index = open + 1;
      continue;
    }
    index = tag.startTagEnd + 1;
    if (tag.isClosing) continue;
    if (tagName && tag.tagName !== tagName) continue;
    const classAttr = tag.attributes.class;
    if (!classAttr || !classAttr.split(/\s+/).includes(classToken)) continue;
    if (VOID_HTML_TAGS.has(tag.tagName)) continue;
    const close = findMatchingClosingTag(html, tag.tagName, tag.startTagEnd + 1);
    if (close === -1) continue;
    matches.push({
      tagName: tag.tagName,
      attributes: tag.attributes,
      innerHtml: html.slice(tag.startTagEnd + 1, close),
    });
  }
  return matches;
}

function findHtmlElementsByTagName(html: string, tagName: string): ParsedHtmlElement[] {
  const normalizedTag = tagName.toLowerCase();
  const matches: ParsedHtmlElement[] = [];
  let index = 0;
  while (index < html.length) {
    const open = html.indexOf('<', index);
    if (open === -1) break;
    const tag = parseHtmlStartTag(html, open);
    if (!tag) {
      index = open + 1;
      continue;
    }
    index = tag.startTagEnd + 1;
    if (tag.isClosing || tag.tagName !== normalizedTag || VOID_HTML_TAGS.has(tag.tagName)) continue;
    const close = findMatchingClosingTag(html, tag.tagName, tag.startTagEnd + 1);
    if (close === -1) continue;
    matches.push({
      tagName: tag.tagName,
      attributes: tag.attributes,
      innerHtml: html.slice(tag.startTagEnd + 1, close),
    });
  }
  return matches;
}

function parseHtmlStartTag(
  html: string,
  start: number,
): { tagName: string; attributes: Record<string, string>; startTagEnd: number; isClosing: boolean } | null {
  if (html[start] !== '<') return null;
  const next = html[start + 1];
  if (!next || next === '!' || next === '?') return null;
  const isClosing = next === '/';
  let cursor = start + (isClosing ? 2 : 1);
  while (cursor < html.length && /\s/.test(html[cursor])) cursor += 1;
  const nameStart = cursor;
  while (cursor < html.length && /[A-Za-z0-9:-]/.test(html[cursor])) cursor += 1;
  if (cursor === nameStart) return null;
  const tagName = html.slice(nameStart, cursor).toLowerCase();
  const startTagEnd = findTagEnd(html, cursor);
  if (startTagEnd === -1) return null;
  if (isClosing) {
    return { tagName, attributes: {}, startTagEnd, isClosing: true };
  }
  const attributes = parseHtmlAttributes(html.slice(cursor, startTagEnd));
  return { tagName, attributes, startTagEnd, isClosing: false };
}

function findTagEnd(html: string, start: number): number {
  let quote: '"' | "'" | null = null;
  for (let index = start; index < html.length; index += 1) {
    const ch = html[index];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === '\'') {
      quote = ch;
      continue;
    }
    if (ch === '>') return index;
  }
  return -1;
}

function parseHtmlAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  let index = 0;
  while (index < source.length) {
    while (index < source.length && /[\s/]/.test(source[index])) index += 1;
    if (index >= source.length) break;
    const nameStart = index;
    while (index < source.length && /[^\s=/>]/.test(source[index])) index += 1;
    const rawName = source.slice(nameStart, index).trim().toLowerCase();
    if (!rawName) {
      index += 1;
      continue;
    }
    while (index < source.length && /\s/.test(source[index])) index += 1;
    if (source[index] !== '=') {
      attributes[rawName] = '';
      continue;
    }
    index += 1;
    while (index < source.length && /\s/.test(source[index])) index += 1;
    if (index >= source.length) {
      attributes[rawName] = '';
      break;
    }
    const quote = source[index];
    if (quote === '"' || quote === '\'') {
      index += 1;
      const valueStart = index;
      while (index < source.length && source[index] !== quote) index += 1;
      attributes[rawName] = decodeHtmlEntities(source.slice(valueStart, index));
      if (index < source.length) index += 1;
      continue;
    }
    const valueStart = index;
    while (index < source.length && /[^\s>]/.test(source[index])) index += 1;
    attributes[rawName] = decodeHtmlEntities(source.slice(valueStart, index));
  }
  return attributes;
}

function findMatchingClosingTag(html: string, tagName: string, fromIndex: number): number {
  const openNeedle = `<${tagName}`;
  const closeNeedle = `</${tagName}`;
  let depth = 0;
  let index = fromIndex;
  while (index < html.length) {
    const nextOpen = html.indexOf(openNeedle, index);
    const nextClose = html.indexOf(closeNeedle, index);
    if (nextClose === -1) return -1;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      const nested = parseHtmlStartTag(html, nextOpen);
      if (nested && !nested.isClosing && nested.tagName === tagName && !VOID_HTML_TAGS.has(tagName)) {
        depth += 1;
        index = nested.startTagEnd + 1;
        continue;
      }
      index = nextOpen + openNeedle.length;
      continue;
    }
    const closing = parseHtmlStartTag(html, nextClose);
    if (!closing || !closing.isClosing || closing.tagName !== tagName) {
      index = nextClose + closeNeedle.length;
      continue;
    }
    if (depth === 0) return nextClose;
    depth -= 1;
    index = closing.startTagEnd + 1;
  }
  return -1;
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#(?:x[0-9a-fA-F]+|\d+)|[a-zA-Z]+);/g, (match, entity: string) => {
    const normalized = entity.toLowerCase();
    if (normalized === 'nbsp') return ' ';
    if (normalized === 'amp') return '&';
    if (normalized === 'lt') return '<';
    if (normalized === 'gt') return '>';
    if (normalized === 'quot') return '"';
    if (normalized === '#39' || normalized === 'apos') return '\'';
    if (normalized.startsWith('#x')) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(codePoint) && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
    }
    if (normalized.startsWith('#')) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(codePoint) && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
    }
    return match;
  });
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function uniqueBy<T>(values: T[], key: (value: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const value of values) {
    const id = key(value);
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(value);
  }
  return result;
}

function isPathInside(candidate: string, root: string): boolean {
  const normalizedCandidate = sep === '\\' ? candidate.toLowerCase() : candidate;
  const normalizedRoot = sep === '\\' ? root.toLowerCase() : root;
  if (normalizedCandidate === normalizedRoot) return true;
  return normalizedCandidate.startsWith(
    normalizedRoot.endsWith(sep) ? normalizedRoot : `${normalizedRoot}${sep}`,
  );
}

function normalizePathForHost(inputPath: string): string {
  const trimmed = inputPath.trim();
  if (!trimmed) return trimmed;

  // Linux/WSL runtime: accept Windows drive-letter paths (C:\...) from UI/chat.
  if (sep === '/') {
    const driveMatch = trimmed.match(/^([a-zA-Z]):[\\/](.*)$/);
    if (driveMatch) {
      const drive = driveMatch[1].toLowerCase();
      const rest = driveMatch[2].replace(/\\/g, '/');
      return `/mnt/${drive}/${rest}`;
    }
    return trimmed.replace(/\\/g, '/');
  }

  // Native Windows runtime: accept WSL /mnt/<drive>/... paths.
  const mntMatch = trimmed.match(/^\/mnt\/([a-zA-Z])\/(.*)$/);
  if (mntMatch) {
    const drive = mntMatch[1].toUpperCase();
    const rest = mntMatch[2].replace(/\//g, '\\');
    return `${drive}:\\${rest}`;
  }
  return trimmed.replace(/\//g, '\\');
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function looksLikeStableBrowserRef(value: unknown): boolean {
  return typeof value === 'string' && /^[A-Za-z0-9:_-]{1,120}$/.test(value.trim());
}

function hasValidBrowserMutationArgs(args: Record<string, unknown>): boolean {
  const action = asString(args.action, 'click').trim().toLowerCase();
  const stateId = asString(args.stateId).trim();
  if (!stateId) return false;
  const hasRef = looksLikeStableBrowserRef(args.ref) || looksLikeStableBrowserRef(args.element);
  if (!hasRef) return false;
  if (action === 'type' || action === 'fill' || action === 'select') {
    return typeof args.value === 'string' && args.value.length > 0;
  }
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`'${field}' must be a non-empty string.`);
  }
  return value;
}

function requireStringAllowEmpty(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`'${field}' must be a string.`);
  }
  return value;
}

function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`'${field}' must be a boolean.`);
  }
  return value;
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}


// ── Network & System Tool Helpers ──────────────────────────────

/**
 * Validate and sanitize a host parameter to prevent command injection.
 * Allows hostnames, IPv4, and IPv6 addresses only.
 */
export function validateHostParam(host: string): string {
  const trimmed = host.trim();
  if (!trimmed || trimmed.length > 253) throw new Error('Invalid host: empty or too long.');
  const candidate = trimmed.startsWith('[') && trimmed.endsWith(']') ? trimmed.slice(1, -1) : trimmed;
  if (isIP(candidate)) return candidate;
  if (isValidHostname(candidate)) return candidate;
  throw new Error('Invalid host: must be a hostname or IP address.');
}

function isValidHostname(host: string): boolean {
  if (!host || host.length > 253) return false;
  const labels = host.split('.');
  return labels.every((label) => /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label));
}

function sanitizeInterfaceName(name: string): string {
  const value = name.trim();
  if (!value) throw new Error('Interface name cannot be empty.');
  if (!/^[a-zA-Z0-9_.:-]+$/.test(value)) {
    throw new Error('Interface name contains invalid characters.');
  }
  return value;
}

function sanitizeSshUser(user: string): string {
  const value = user.trim();
  if (!value) throw new Error('SSH username cannot be empty.');
  if (!/^[a-zA-Z0-9_.-]+$/.test(value)) {
    throw new Error('SSH username contains invalid characters.');
  }
  return value;
}

/**
 * Check whether a hostname or IP is within private/local network ranges.
 * Allows: RFC1918 (10.x, 172.16-31.x, 192.168.x), link-local (169.254.x),
 * loopback (127.x, ::1), and local hostnames (localhost, *.local).
 * Blocks everything else to prevent external reconnaissance.
 */
function isLocalNetworkTarget(host: string): boolean {
  const h = host.toLowerCase().trim();

  // Loopback / localhost
  if (h === 'localhost' || h === '::1' || h === '0.0.0.0') return true;
  if (h.endsWith('.localhost')) return true;

  // .local mDNS names (common for home networks)
  if (h.endsWith('.local')) return true;

  // IPv4 checks
  const ipv4Match = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (a === 127) return true;                         // 127.0.0.0/8
    if (a === 10) return true;                          // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
    if (a === 192 && b === 168) return true;             // 192.168.0.0/16
    if (a === 169 && b === 254) return true;             // 169.254.0.0/16 link-local
    return false;
  }

  // IPv6 link-local (fe80::)
  if (h.startsWith('fe80:')) return true;

  // IPv6 unique local (fd00::/8, fc00::/7)
  if (h.startsWith('fd') || h.startsWith('fc')) return true;

  // Bare hostnames (no dots) are likely on the local network
  if (!h.includes('.') && !h.includes(':')) return true;

  return false;
}

function isLoopbackTarget(host: string): boolean {
  const h = host.toLowerCase().trim();
  if (h === 'localhost' || h === '::1') return true;
  if (h.endsWith('.localhost')) return true;
  return /^127(?:\.\d{1,3}){3}$/.test(h);
}

function isPingPermissionDenied(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('operation not permitted')
    || lower.includes('permission denied')
    || lower.includes('lacking privilege')
    || lower.includes('raw socket');
}

/**
 * Throw an error if the target host is not on the local/private network.
 * Used by net_ping, net_port_check, net_traceroute to prevent external recon.
 */
function requireLocalNetwork(host: string): void {
  if (!isLocalNetworkTarget(host)) {
    throw new Error(
      `Host '${host}' is not a private/local network address. ` +
      'Network probing tools are restricted to local networks only ' +
      '(10.x, 172.16-31.x, 192.168.x, localhost, *.local) ' +
      'to avoid triggering external IDS/IPS alerts.',
    );
  }
}

/** Common port → service name mapping. */
const COMMON_PORTS: Record<number, string> = {
  21: 'ftp', 22: 'ssh', 23: 'telnet', 25: 'smtp', 53: 'dns',
  80: 'http', 110: 'pop3', 143: 'imap', 443: 'https', 445: 'smb',
  993: 'imaps', 995: 'pop3s', 1433: 'mssql', 1521: 'oracle',
  3306: 'mysql', 3389: 'rdp', 5432: 'postgresql', 5900: 'vnc',
  6379: 'redis', 8080: 'http-alt', 8443: 'https-alt', 8888: 'http-alt',
  9090: 'prometheus', 27017: 'mongodb',
};

/** Check a single TCP port with a connect timeout. */
async function checkTcpPort(host: string, port: number, timeoutMs: number): Promise<{ port: number; open: boolean; service: string | null }> {
  const { Socket } = await import('node:net');
  return new Promise((resolve) => {
    const socket = new Socket();
    let resolved = false;
    const done = (open: boolean) => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve({ port, open, service: open ? (COMMON_PORTS[port] ?? null) : null });
    };
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => done(true));
    socket.on('timeout', () => done(false));
    socket.on('error', () => done(false));
    socket.connect(port, host);
  });
}

function toTrafficSample(connection: {
  protocol: string;
  localAddress: string;
  localPort: number;
  remoteAddress: string;
  remotePort: number;
  state: string;
}): TrafficConnectionSample {
  return {
    protocol: connection.protocol,
    localAddress: connection.localAddress,
    localPort: connection.localPort,
    remoteAddress: connection.remoteAddress,
    remotePort: connection.remotePort,
    state: connection.state,
  };
}

async function grabPortBanner(host: string, port: number, timeoutMs: number): Promise<string | null> {
  const isHttp = port === 80 || port === 8080 || port === 8000;
  const isHttps = port === 443 || port === 8443;
  if (isHttps) {
    const tls = await import('node:tls');
    return new Promise((resolve, reject) => {
      const socket = tls.connect({
        host,
        port,
        rejectUnauthorized: false,
      });
      let resolved = false;
      let data = '';
      const done = (value: string | null): void => {
        if (resolved) return;
        resolved = true;
        socket.destroy();
        resolve(value);
      };
      socket.setTimeout(timeoutMs);
      socket.on('secureConnect', () => {
        socket.write(`HEAD / HTTP/1.0\r\nHost: ${host}\r\nConnection: close\r\n\r\n`);
      });
      socket.on('data', (chunk: Buffer | string) => {
        data += chunk.toString('utf-8');
        if (data.length > 8192) done(data.slice(0, 8192));
      });
      socket.on('end', () => done(data || null));
      socket.on('timeout', () => done(data || null));
      socket.on('error', (err) => reject(err));
    });
  }

  const { Socket } = await import('node:net');
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    let resolved = false;
    let data = '';
    const done = (value: string | null): void => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => {
      if (isHttp) {
        socket.write(`HEAD / HTTP/1.0\r\nHost: ${host}\r\nConnection: close\r\n\r\n`);
      }
    });
    socket.on('data', (chunk: Buffer | string) => {
      data += chunk.toString('utf-8');
      if (data.length > 8192) done(data.slice(0, 8192));
    });
    socket.on('end', () => done(data || null));
    socket.on('timeout', () => done(data || null));
    socket.on('error', (err) => reject(err));
    socket.connect(port, host);
  });
}

/** Parse ping output for packet stats and RTT. */
function parsePingOutput(stdout: string, host: string): {
  host: string; reachable: boolean; packetsSent: number; packetsReceived: number; packetLossPercent: number; rttAvgMs: number | null;
} {
  const lossMatch = stdout.match(/(\d+)%\s*(?:packet\s*)?loss/i);
  const packetLoss = lossMatch ? parseInt(lossMatch[1], 10) : 100;
  const sentMatch = stdout.match(/(\d+)\s*(?:packets?\s*)?(?:transmitted|sent)/i);
  const recvMatch = stdout.match(/(\d+)\s*(?:packets?\s*)?received/i);
  const rttMatch = stdout.match(/(?:avg|average)[^=]*=\s*([\d.]+)/i)
    || stdout.match(/\d+\.\d+\/([\d.]+)\/\d+\.\d+/);
  return {
    host,
    reachable: packetLoss < 100,
    packetsSent: sentMatch ? parseInt(sentMatch[1], 10) : 0,
    packetsReceived: recvMatch ? parseInt(recvMatch[1], 10) : 0,
    packetLossPercent: packetLoss,
    rttAvgMs: rttMatch ? parseFloat(rttMatch[1]) : null,
  };
}

/** Parse `ip neigh show` output (Linux). */
function parseArpLinux(stdout: string): Array<{ ip: string; mac: string; state: string }> {
  return stdout.split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      const ip = parts[0] ?? '';
      const llIdx = parts.indexOf('lladdr');
      const mac = llIdx >= 0 ? (parts[llIdx + 1] ?? 'unknown') : 'unknown';
      const state = parts[parts.length - 1] ?? 'unknown';
      return { ip, mac, state };
    })
    .filter((d) => d.ip && d.ip !== 'Destination');
}

/** Parse `arp -a` output (Windows/fallback). */
function parseArpWindows(stdout: string): Array<{ ip: string; mac: string; state: string }> {
  return stdout.split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const match = line.trim().match(/^\s*(?:\?\s+\()?(\d+\.\d+\.\d+\.\d+)\)?\s+(?:at\s+)?([0-9a-fA-F:.-]+)\s+(.*)$/);
      if (!match) return null;
      return { ip: match[1], mac: match[2], state: match[3]?.trim() || 'unknown' };
    })
    .filter((d): d is { ip: string; mac: string; state: string } => d !== null);
}

/** Parse `ss -tunap` output (Linux). */
function parseSsLinux(stdout: string, stateFilter: string): Array<{
  protocol: string; localAddress: string; localPort: number; remoteAddress: string; remotePort: number; state: string; process: string | null;
}> {
  const lines = stdout.split('\n').slice(1).filter((l) => l.trim());
  const results: Array<{
    protocol: string; localAddress: string; localPort: number; remoteAddress: string; remotePort: number; state: string; process: string | null;
  }> = [];
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;
    const proto = parts[0];
    const state = parts[1];
    const local = parts[4] ?? '';
    const remote = parts[5] ?? '';
    const procInfo = parts.slice(6).join(' ');
    if (stateFilter && state.toUpperCase() !== stateFilter) continue;
    const [localAddr, localPort] = splitAddress(local);
    const [remoteAddr, remotePort] = splitAddress(remote);
    results.push({
      protocol: proto,
      localAddress: localAddr,
      localPort: parseInt(localPort, 10) || 0,
      remoteAddress: remoteAddr,
      remotePort: parseInt(remotePort, 10) || 0,
      state,
      process: procInfo || null,
    });
  }
  return results.slice(0, 200);
}

/** Parse `netstat -an` output (Windows). */
function parseNetstatWindows(stdout: string, stateFilter: string): Array<{
  protocol: string; localAddress: string; localPort: number; remoteAddress: string; remotePort: number; state: string; process: string | null;
}> {
  const lines = stdout.split('\n').filter((l) => /^\s*(TCP|UDP)/i.test(l));
  const results: Array<{
    protocol: string; localAddress: string; localPort: number; remoteAddress: string; remotePort: number; state: string; process: string | null;
  }> = [];
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) continue;
    const proto = parts[0];
    const local = parts[1] ?? '';
    const remote = parts[2] ?? '';
    const state = parts[3] ?? '';
    if (stateFilter && state.toUpperCase() !== stateFilter) continue;
    const [localAddr, localPort] = splitAddress(local);
    const [remoteAddr, remotePort] = splitAddress(remote);
    results.push({
      protocol: proto,
      localAddress: localAddr,
      localPort: parseInt(localPort, 10) || 0,
      remoteAddress: remoteAddr,
      remotePort: parseInt(remotePort, 10) || 0,
      state,
      process: null,
    });
  }
  return results.slice(0, 200);
}

/** Split "addr:port" into [addr, port]. Handles IPv6 bracket notation. */
function splitAddress(addrPort: string): [string, string] {
  // IPv6 bracket notation: [::1]:443
  const bracketMatch = addrPort.match(/^\[([^\]]+)]:(\d+)$/);
  if (bracketMatch) return [bracketMatch[1], bracketMatch[2]];
  // Regular addr:port
  const lastColon = addrPort.lastIndexOf(':');
  if (lastColon <= 0) return [addrPort, '0'];
  return [addrPort.slice(0, lastColon), addrPort.slice(lastColon + 1)];
}

/** Parse traceroute/tracert output. */
function parseTracerouteOutput(stdout: string): Array<{ hop: number; ip: string | null; hostname: string | null; rttMs: number | null }> {
  const lines = stdout.split('\n').filter((l) => l.trim());
  const hops: Array<{ hop: number; ip: string | null; hostname: string | null; rttMs: number | null }> = [];
  for (const line of lines) {
    const hopMatch = line.match(/^\s*(\d+)\s+/);
    if (!hopMatch) continue;
    const hop = parseInt(hopMatch[1], 10);
    const ipMatch = line.match(/(\d+\.\d+\.\d+\.\d+)/);
    const rttMatch = line.match(/([\d.]+)\s*ms/);
    const hostMatch = line.match(/\s+([a-zA-Z][\w.-]+)\s+\(/);
    hops.push({
      hop,
      ip: ipMatch ? ipMatch[1] : null,
      hostname: hostMatch ? hostMatch[1] : null,
      rttMs: rttMatch ? parseFloat(rttMatch[1]) : null,
    });
  }
  return hops;
}

/** Parse `df -Pm` output (Linux/macOS). */
function parseDiskLinux(stdout: string): Array<{ filesystem: string; sizeMB: number; usedMB: number; availableMB: number; usedPercent: number; mount: string }> {
  return stdout.split('\n').slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 6) return null;
      return {
        filesystem: parts[0],
        sizeMB: parseInt(parts[1], 10) || 0,
        usedMB: parseInt(parts[2], 10) || 0,
        availableMB: parseInt(parts[3], 10) || 0,
        usedPercent: parseInt(parts[4], 10) || 0,
        mount: parts[5],
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);
}

/** Parse Windows wmic disk output. */
function parseDiskWindows(stdout: string): Array<{ filesystem: string; sizeMB: number; usedMB: number; availableMB: number; usedPercent: number; mount: string }> {
  return stdout.split('\n')
    .filter((l) => l.includes(',') && !l.startsWith('Node'))
    .map((line) => {
      const parts = line.trim().split(',');
      if (parts.length < 3) return null;
      const caption = parts[1]?.trim() ?? '';
      const freeSpace = parseInt(parts[2]?.trim() ?? '0', 10);
      const size = parseInt(parts[3]?.trim() ?? '0', 10);
      if (!size) return null;
      const sizeMB = Math.round(size / 1_048_576);
      const freeMB = Math.round(freeSpace / 1_048_576);
      const usedMB = sizeMB - freeMB;
      return {
        filesystem: caption,
        sizeMB,
        usedMB,
        availableMB: freeMB,
        usedPercent: sizeMB > 0 ? Math.round((usedMB / sizeMB) * 100) : 0,
        mount: caption,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);
}

/** Parse `ps aux` output (Linux). */
function parsePsLinux(stdout: string, limit: number): Array<{ pid: number; user: string; cpuPercent: number; memoryPercent: number; command: string }> {
  return stdout.split('\n').slice(1)
    .filter((l) => l.trim())
    .slice(0, limit)
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 11) return null;
      return {
        pid: parseInt(parts[1], 10),
        user: parts[0],
        cpuPercent: parseFloat(parts[2]) || 0,
        memoryPercent: parseFloat(parts[3]) || 0,
        command: parts.slice(10).join(' '),
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);
}

/** Parse `tasklist` CSV output (Windows). */
function parseTasklistWindows(stdout: string, limit: number): Array<{ pid: number; user: string; cpuPercent: number; memoryPercent: number; command: string }> {
  return stdout.split('\n')
    .filter((l) => l.trim())
    .slice(0, limit)
    .map((line) => {
      const parts = line.replace(/"/g, '').split(',');
      if (parts.length < 2) return null;
      return {
        pid: parseInt(parts[1]?.trim() ?? '0', 10),
        user: 'N/A',
        cpuPercent: 0,
        memoryPercent: 0,
        command: parts[0]?.trim() ?? '',
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);
}

/** Parse `launchctl list` output (macOS). */
function parseLaunchctlOutput(stdout: string, filter: string): Array<{ name: string; active: string; sub: string; description: string }> {
  const normalizedFilter = filter.toLowerCase();
  // launchctl list output: PID\tStatus\tLabel
  return stdout.split('\n')
    .slice(1) // skip header
    .filter((l) => l.trim())
    .map((line) => {
      const parts = line.trim().split('\t');
      if (parts.length < 3) return null;
      const pid = parts[0]?.trim() ?? '-';
      const status = parts[1]?.trim() ?? '0';
      const label = parts[2]?.trim() ?? '';
      if (!label) return null;
      if (normalizedFilter && !label.toLowerCase().includes(normalizedFilter)) return null;
      return {
        name: label,
        active: pid !== '-' ? 'active' : 'inactive',
        sub: pid !== '-' ? `running (PID ${pid})` : `exit code ${status}`,
        description: label,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);
}

/** Parse `systemctl list-units --type=service` output. */
function parseSystemctlOutput(stdout: string, filter: string): Array<{ name: string; active: string; sub: string; description: string }> {
  const normalizedFilter = filter.toLowerCase();
  return stdout.split('\n')
    .filter((l) => l.includes('.service'))
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 4) return null;
      const name = parts[0]?.replace('.service', '') ?? '';
      if (normalizedFilter && !name.toLowerCase().includes(normalizedFilter)) return null;
      return {
        name,
        active: parts[2] ?? 'unknown',
        sub: parts[3] ?? 'unknown',
        description: parts.slice(4).join(' '),
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);
}

function inferMCPGuardAction(def: ToolDefinition): { type: string; params?: Record<string, unknown> } | null {
  const parsed = MCPClientManager.parseToolName(def.name);
  if (!parsed) return { type: 'mcp_tool', params: { toolName: def.name } };
  if (parsed.serverId !== 'gws') {
    return { type: 'mcp_tool', params: { serverId: parsed.serverId, toolName: parsed.toolName } };
  }

  const capabilityAction = inferGoogleWorkspaceCapabilityAction(parsed.toolName, def.description);
  if (!capabilityAction) {
    return { type: 'mcp_tool', params: { serverId: parsed.serverId, toolName: parsed.toolName } };
  }

  return {
    type: capabilityAction,
    params: {
      serverId: parsed.serverId,
      toolName: parsed.toolName,
    },
  };
}

function inferGoogleWorkspaceCapabilityAction(toolName: string, description: string): string | null {
  const combined = `${toolName} ${description}`.toLowerCase();
  const isWrite = /\b(create|update|edit|modify|delete|insert|append|upload|move|trash|share|send|publish|write|draft)\b/.test(combined);
  const isDraft = /\bdraft\b/.test(combined);

  if (/\b(gmail|mail|message|email)\b/.test(combined)) {
    if (/\bsend\b/.test(combined)) return 'send_email';
    if (isDraft) return 'draft_email';
    return 'read_email';
  }
  if (/\b(calendar|event)\b/.test(combined)) {
    return isWrite ? 'write_calendar' : 'read_calendar';
  }
  if (/\b(drive|file|folder)\b/.test(combined)) {
    return isWrite ? 'write_drive' : 'read_drive';
  }
  if (/\b(docs|document)\b/.test(combined)) {
    return isWrite ? 'write_docs' : 'read_docs';
  }
  if (/\b(sheets|spreadsheet)\b/.test(combined)) {
    return isWrite ? 'write_sheets' : 'read_sheets';
  }

  return null;
}

function formatToolArgsPreview(toolName: string, redactedArgs: unknown): string {
  if (toolName === 'automation_save') {
    const summary = summarizeAutomationSavePreview(isRecord(redactedArgs) ? redactedArgs : {});
    if (summary) return sanitizePreview(summary);
  }
  if (toolName === 'automation_set_enabled') {
    const summary = summarizeAutomationTogglePreview(isRecord(redactedArgs) ? redactedArgs : {});
    if (summary) return sanitizePreview(summary);
  }
  if (toolName === 'automation_run') {
    const summary = summarizeAutomationRunPreview(isRecord(redactedArgs) ? redactedArgs : {});
    if (summary) return sanitizePreview(summary);
  }
  if (toolName === 'automation_delete') {
    const summary = summarizeAutomationDeletePreview(isRecord(redactedArgs) ? redactedArgs : {});
    if (summary) return sanitizePreview(summary);
  }
  if (toolName === 'gws') {
    const summary = summarizeGwsPreview(isRecord(redactedArgs) ? redactedArgs : {});
    if (summary) return sanitizePreview(summary);
  }
  return sanitizePreview(JSON.stringify(redactedArgs));
}

function summarizeAutomationSavePreview(args: Record<string, unknown>): string | null {
  const name = asString(args.name).trim() || asString(args.id).trim();
  const kind = asString(args.kind).trim();
  if (!name || !kind) return null;
  if (kind === 'assistant_task') {
    const schedule = isRecord(args.schedule) ? args.schedule : null;
    const cron = schedule ? asString(schedule.cron).trim() : '';
    return cron
      ? `save scheduled assistant automation ${name} on ${cron}`
      : `save manual assistant automation ${name}`;
  }
  if (kind === 'standalone_task') {
    const task = isRecord(args.task) ? args.task : null;
    const target = asString(task?.target).trim();
    const schedule = isRecord(args.schedule) ? args.schedule : null;
    const cron = schedule ? asString(schedule.cron).trim() : '';
    const runOnce = schedule?.runOnce === true;
    if (target === 'gws') {
      const gwsSummary = summarizeGwsPreview(isRecord(task?.args) ? task?.args : {});
      if (gwsSummary) {
        return `save ${runOnce ? 'one-shot' : cron ? 'scheduled' : 'manual'} tool automation ${name}: ${gwsSummary}${cron ? ` on ${cron}` : ''}`;
      }
    }
    return `save ${runOnce ? 'one-shot' : cron ? 'scheduled' : 'manual'} tool automation ${name}${target ? ` targeting ${target}` : ''}${cron ? ` on ${cron}` : ''}`;
  }
  const mode = asString(args.mode, 'sequential').trim() || 'sequential';
  const steps = Array.isArray(args.steps) ? args.steps.length : 0;
  const schedule = isRecord(args.schedule) ? args.schedule : null;
  const cron = schedule ? asString(schedule.cron).trim() : '';
  return `save automation ${name} (${mode}, ${steps} step${steps === 1 ? '' : 's'}${cron ? `, schedule ${cron}` : ''})`;
}

function summarizeAutomationTogglePreview(args: Record<string, unknown>): string | null {
  const automationId = asString(args.automationId).trim();
  if (!automationId || typeof args.enabled !== 'boolean') return null;
  return `${args.enabled ? 'enable' : 'disable'} automation ${automationId}`;
}

function summarizeAutomationRunPreview(args: Record<string, unknown>): string | null {
  const automationId = asString(args.automationId).trim();
  if (!automationId) return null;
  return `${args.dryRun === true ? 'dry-run' : 'run'} automation ${automationId}`;
}

function summarizeAutomationDeletePreview(args: Record<string, unknown>): string | null {
  const automationId = asString(args.automationId).trim();
  if (!automationId) return null;
  return `delete automation ${automationId}`;
}

function summarizeGwsPreview(args: Record<string, unknown>): string | null {
  const service = asString(args.service).trim().toLowerCase();
  const resource = asString(args.resource).trim().toLowerCase();
  const method = asString(args.method).trim().toLowerCase();
  if (!service || !method) return null;

  if (service === 'gmail' && resource === 'users messages' && method === 'send') {
    const payload = extractRawMessageSummary(args);
    if (payload) {
      return `send Gmail to ${payload.to || '(unknown recipient)'}${payload.subject ? ` with subject "${payload.subject}"` : ''}`;
    }
    return 'send Gmail message';
  }

  if (service === 'gmail' && resource === 'users drafts' && method === 'create') {
    const payload = extractRawMessageSummary(args);
    if (payload) {
      return `draft Gmail to ${payload.to || '(unknown recipient)'}${payload.subject ? ` with subject "${payload.subject}"` : ''}`;
    }
    return 'create Gmail draft';
  }

  if (service === 'calendar' && resource === 'events' && method === 'list') {
    return 'list calendar events';
  }

  return `${service} ${resource || 'request'} ${method}`.trim();
}

function extractRawMessageSummary(args: Record<string, unknown>): { to?: string; subject?: string } | null {
  const json = isRecord(args.json) ? args.json : {};
  const raw = asString(json.raw) || asString(isRecord(json.message) ? json.message.raw : undefined);
  if (!raw) return null;
  try {
    const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (normalized.length % 4 || 4)) % 4;
    const padded = normalized + '='.repeat(padLength);
    const decoded = Buffer.from(padded, 'base64').toString('utf-8');
    const lines = decoded.split(/\r?\n/);
    const to = lines.find((line) => /^to:/i.test(line))?.replace(/^to:\s*/i, '').trim();
    const subject = lines.find((line) => /^subject:/i.test(line))?.replace(/^subject:\s*/i, '').trim();
    return { to: to || undefined, subject: subject || undefined };
  } catch {
    return null;
  }
}

function extractToolSuccessMessage(
  toolName: string,
  output: unknown,
  explicitMessage?: string,
): string {
  const message = explicitMessage?.trim()
    || extractAutomationSuccessMessage(toolName, output)
    || extractCodingBackendSuccessMessage(toolName, output)
    || extractOutputMessage(output);
  return message || `Tool '${toolName}' completed.`;
}

function extractAutomationSuccessMessage(toolName: string, output: unknown): string {
  if (!isRecord(output)) return '';

  if (toolName === 'automation_save') {
    const automationId = asString(output.automationId).trim();
    const taskId = asString(output.taskId).trim();
    const message = asString(output.message).trim();
    if (automationId) {
      return `${message || 'Saved.'}${taskId ? ` Automation id: ${automationId}. Linked task: ${taskId}.` : ` Automation id: ${automationId}.`}`;
    }
  }

  return '';
}

function extractCodingBackendSuccessMessage(toolName: string, output: unknown): string {
  if (toolName !== 'coding_backend_run' || !isRecord(output)) return '';
  const backendName = asString(output.backendName).trim() || 'Coding backend';
  const rawOutput = asString(output.output).trim();
  if (!rawOutput || rawOutput === '(no output captured)') {
    return `${backendName} completed.`;
  }
  return `${backendName} completed.\n\n${rawOutput}`;
}

function extractOutputMessage(output: unknown): string {
  if (!isRecord(output)) return '';
  return asString(output.message).trim();
}
