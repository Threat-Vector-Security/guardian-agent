/**
 * MCP Client — Model Context Protocol client adapter for GuardianAgent.
 *
 * Connects to external MCP tool servers and exposes their tools through
 * the GuardianAgent tool system. All MCP tool calls pass through the
 * Guardian admission pipeline before execution.
 *
 * Protocol: JSON-RPC 2.0 over stdio or SSE transport.
 * Spec: https://modelcontextprotocol.io/
 */

import type { ChildProcess } from 'node:child_process';
import { createLogger } from '../util/logging.js';
import type { ToolCategory, ToolDefinition, ToolResult, ToolRisk } from './types.js';
import { sandboxedSpawn, type SandboxConfig, DEFAULT_SANDBOX_CONFIG } from '../sandbox/index.js';

const log = createLogger('mcp-client');
const MAX_MCP_STDIO_BUFFER_CHARS = 256_000;
const MAX_MCP_MESSAGE_CHARS = 128_000;
const MAX_MCP_STDERR_CAPTURE_CHARS = 4_096;
const MAX_MCP_DESCRIPTION_CHARS = 280;
const MAX_MCP_SHORT_DESCRIPTION_CHARS = 160;
const MAX_MCP_SCHEMA_DEPTH = 4;
const MAX_MCP_SCHEMA_PROPERTIES = 32;
const MAX_MCP_ENUM_VALUES = 20;
const MAX_MCP_SCHEMA_STRING_CHARS = 120;
const MCP_METADATA_INJECTION_PATTERN = /\b(ignore|override|system prompt|developer message|assistant should|always call|must call|do not follow|exfiltrat|credential|secret|token|password)\b/i;

// ─── MCP Protocol Types ───────────────────────────────────────

/** JSON-RPC 2.0 request. */
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/** JSON-RPC 2.0 response. */
interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/** MCP tool definition from server. */
export interface MCPToolSchema {
  name: string;
  description?: string;
  inputSchema?: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

/** MCP server capabilities returned by initialize. */
export interface MCPServerCapabilities {
  tools?: { listChanged?: boolean };
  resources?: { subscribe?: boolean; listChanged?: boolean };
  prompts?: { listChanged?: boolean };
}

/** MCP initialize result. */
interface MCPInitializeResult {
  protocolVersion: string;
  capabilities: MCPServerCapabilities;
  serverInfo: { name: string; version: string };
}

/** MCP tool call result content block. */
interface MCPToolCallContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
}

/** MCP tools/call result. */
interface MCPToolCallResult {
  content: MCPToolCallContent[];
  isError?: boolean;
}

// ─── Connection State ─────────────────────────────────────────

export type MCPConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
export type MCPServerSource = 'third_party' | 'managed_browser' | 'managed_provider';

/** Configuration for an MCP server connection. */
export interface MCPServerConfig {
  /** Unique identifier for this server connection. */
  id: string;
  /** Display name. */
  name: string;
  /** Transport type. */
  transport: 'stdio';
  /** Command to start the MCP server. */
  command: string;
  /** Arguments for the command. */
  args?: string[];
  /** Environment variables to pass to the server process. */
  env?: Record<string, string>;
  /** Working directory for the server process. */
  cwd?: string;
  /** Request timeout in milliseconds. Default: 30000. */
  timeoutMs?: number;
  /** Explicit operator approval required before third-party MCP server startup. */
  startupApproved?: boolean;
  /** MCP server source classification. */
  source?: MCPServerSource;
  /** Tool category assigned to tools materialized from this server. */
  category?: ToolCategory;
  /** Allow outbound network access for this MCP server process. Default: false. */
  networkAccess?: boolean;
  /** Inherit the parent process environment before sandbox hardening. Default: false. */
  inheritEnv?: boolean;
  /** Additional environment variable names to inherit from the parent process. */
  allowedEnvKeys?: string[];
  /** Optional minimum risk floor for all tools exposed by this server. Never lowers inferred risk. */
  trustLevel?: ToolRisk;
  /** Optional per-server rate limit. */
  maxCallsPerMinute?: number;
}

// ─── MCP Client ───────────────────────────────────────────────

/**
 * Client for a single MCP server connection.
 *
 * Manages the lifecycle of the server process, handles JSON-RPC
 * communication, and exposes discovered tools.
 */
export class MCPClient {
  readonly config: MCPServerConfig;
  private process: ChildProcess | null = null;
  private state: MCPConnectionState = 'disconnected';
  private _serverCapabilities: MCPServerCapabilities = {};
  private serverInfo: { name: string; version: string } = { name: '', version: '' };
  private tools: Map<string, MCPToolSchema> = new Map();
  private pendingRequests: Map<string, {
    resolve: (value: JsonRpcResponse) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = new Map();
  private buffer = '';
  private nextId = 1;
  private readonly sandboxConfig: SandboxConfig;
  private readonly recentCallTimestamps: number[] = [];

  constructor(config: MCPServerConfig, sandboxConfig?: SandboxConfig) {
    this.config = config;
    this.sandboxConfig = sandboxConfig ?? DEFAULT_SANDBOX_CONFIG;
  }

  /** Current connection state. */
  getState(): MCPConnectionState {
    return this.state;
  }

  /** Server info from initialize handshake. */
  getServerInfo(): { name: string; version: string } {
    return { ...this.serverInfo };
  }

  /** Server capabilities from initialize handshake. */
  getServerCapabilities(): MCPServerCapabilities {
    return { ...this._serverCapabilities };
  }

  /**
   * Connect to the MCP server.
   *
   * Spawns the server process, performs the initialize handshake,
   * and discovers available tools.
   */
  async connect(): Promise<void> {
    if (this.state === 'connected') return;

    this.state = 'connecting';

    try {
      this.process = await sandboxedSpawn(this.config.command, this.config.args ?? [], this.sandboxConfig, {
        profile: 'workspace-write',
        networkAccess: this.config.networkAccess ?? false,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: this.config.env,
        inheritEnv: this.config.inheritEnv ?? false,
        allowedEnvKeys: this.config.allowedEnvKeys,
        cwd: this.config.cwd,
      });

      // Collect stderr for diagnostic messages on early exit
      let stderrBuf = '';

      this.process.stdout!.on('data', (data: Buffer) => {
        this.handleStdout(data.toString());
      });

      this.process.stderr!.on('data', (data: Buffer) => {
        const text = sanitizeMcpText(data.toString(), MAX_MCP_STDERR_CAPTURE_CHARS).trim();
        if (!text) return;
        if (stderrBuf.length < MAX_MCP_STDERR_CAPTURE_CHARS) {
          const remaining = MAX_MCP_STDERR_CAPTURE_CHARS - stderrBuf.length;
          stderrBuf += `${stderrBuf ? '\n' : ''}${text.slice(0, remaining)}`;
        }
        log.warn({ server: this.config.id, stderr: text }, 'MCP server stderr');
      });

      this.process.on('exit', (code) => {
        log.info({ server: this.config.id, code }, 'MCP server exited');
        this.state = 'disconnected';
        const detail = stderrBuf ? `: ${stderrBuf.slice(0, 500)}` : '';
        this.rejectAllPending(new Error(`MCP server exited with code ${code}${detail}`));
      });

      this.process.on('error', (err) => {
        log.error({ server: this.config.id, err: err.message }, 'MCP server error');
        this.state = 'error';
        this.rejectAllPending(err);
      });

      // Initialize handshake
      const initResult = await this.sendRequest<MCPInitializeResult>('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'guardianagent', version: '1.0.0' },
      });

      this._serverCapabilities = initResult.capabilities;
      this.serverInfo = initResult.serverInfo;

      // Send initialized notification
      this.sendNotification('notifications/initialized', {});

      // Discover tools
      await this.refreshTools();

      this.state = 'connected';
      log.info({
        server: this.config.id,
        serverName: this.serverInfo.name,
        toolCount: this.tools.size,
      }, 'MCP server connected');

    } catch (err) {
      this.state = 'error';
      this.disconnect();
      throw err;
    }
  }

  /** Disconnect from the MCP server. */
  disconnect(): void {
    this.rejectAllPending(new Error('Client disconnected'));

    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }

    this.state = 'disconnected';
    this.tools.clear();
    this.buffer = '';
    log.info({ server: this.config.id }, 'MCP server disconnected');
  }

  /** Refresh the list of available tools from the server. */
  async refreshTools(): Promise<void> {
    const result = await this.sendRequest<{ tools: MCPToolSchema[] }>('tools/list', {});
    this.tools.clear();
    for (const tool of result.tools) {
      this.tools.set(tool.name, tool);
    }
  }

  /** Get all discovered tool schemas. */
  getTools(): MCPToolSchema[] {
    return [...this.tools.values()];
  }

  /**
   * Convert MCP tool schemas to GuardianAgent ToolDefinitions.
   *
   * Prefixes tool names with the server ID to avoid collisions
   * when multiple MCP servers are connected.
   */
  getToolDefinitions(): ToolDefinition[] {
    const definitions: ToolDefinition[] = [];
    for (const tool of this.getTools()) {
      if (!isSafeMcpToolName(tool.name)) {
        log.warn({ server: this.config.id, toolName: sanitizeMcpText(tool.name, 80) }, 'Skipping MCP tool with unsafe name');
        continue;
      }
      const description = buildSafeMcpDescription(tool, this.config);
      definitions.push({
        name: `mcp-${this.config.id}-${tool.name}`,
        description: description.full,
        shortDescription: description.short,
        risk: inferMcpToolRisk(tool, this.config),
        category: this.config.category ?? (this.config.source === 'managed_browser' ? 'browser' : 'mcp'),
        parameters: sanitizeMcpInputSchema(tool.inputSchema),
      });
    }
    return definitions;
  }

  /**
   * Call an MCP tool.
   *
   * This method is called AFTER the Guardian admission pipeline has
   * approved the tool execution request.
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<ToolResult> {
    if (this.state !== 'connected') {
      return { success: false, error: `MCP server '${this.config.id}' is not connected` };
    }

    if (!this.tools.has(toolName)) {
      return { success: false, error: `MCP tool '${toolName}' not found on server '${this.config.id}'` };
    }

    const rateLimitError = this.enforceRateLimit();
    if (rateLimitError) {
      return {
        success: false,
        error: rateLimitError,
        metadata: { server: this.config.id, tool: toolName },
      };
    }

    try {
      const result = await this.sendRequest<MCPToolCallResult>('tools/call', {
        name: toolName,
        arguments: args,
      });

      const textContent = formatMcpToolResultContent(result.content);

      if (result.isError) {
        return {
          success: false,
          error: textContent || 'MCP tool returned error',
          metadata: { server: this.config.id, tool: toolName },
        };
      }

      return {
        success: true,
        output: textContent,
        metadata: { server: this.config.id, tool: toolName },
      };

    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        metadata: { server: this.config.id, tool: toolName },
      };
    }
  }

  private enforceRateLimit(): string | null {
    const limit = this.config.maxCallsPerMinute;
    if (!limit || limit < 1) {
      return null;
    }

    const now = Date.now();
    const cutoff = now - 60_000;
    while (this.recentCallTimestamps.length > 0 && this.recentCallTimestamps[0] < cutoff) {
      this.recentCallTimestamps.shift();
    }

    if (this.recentCallTimestamps.length >= limit) {
      return `MCP server '${this.config.id}' exceeded maxCallsPerMinute (${limit}).`;
    }

    this.recentCallTimestamps.push(now);
    return null;
  }

  // ─── JSON-RPC Transport ───────────────────────────────────────

  private sendRequest<T>(method: string, params: Record<string, unknown>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = String(this.nextId++);
      const timeoutMs = this.config.timeoutMs ?? 30_000;

      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`MCP request '${method}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve: (response: JsonRpcResponse) => {
          if (response.error) {
            reject(new Error(`MCP error ${response.error.code}: ${response.error.message}`));
          } else {
            resolve(response.result as T);
          }
        },
        reject,
        timer,
      });

      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      this.writeMessage(request);
    });
  }

  private sendNotification(method: string, params: Record<string, unknown>): void {
    const message = {
      jsonrpc: '2.0' as const,
      method,
      params,
    };
    this.writeMessage(message);
  }

  private writeMessage(message: object): void {
    if (!this.process?.stdin?.writable) {
      throw new Error('MCP server stdin is not writable');
    }

    // Send as newline-delimited JSON (compatible with all MCP servers)
    const json = JSON.stringify(message);
    this.process.stdin.write(json + '\n');
  }

  private handleStdout(data: string): void {
    this.buffer += data;
    if (this.buffer.length > MAX_MCP_STDIO_BUFFER_CHARS) {
      this.failTransport(`MCP server '${this.config.id}' exceeded stdout buffer limit (${MAX_MCP_STDIO_BUFFER_CHARS} chars).`);
      return;
    }

    // Try Content-Length framing first (LSP-style), fall back to newline-delimited JSON.
    // Most MCP servers use newline-delimited JSON, but some use Content-Length framing.
    while (this.buffer.length > 0) {
      // Check for Content-Length header
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd !== -1) {
        const header = this.buffer.slice(0, headerEnd);
        const match = header.match(/^Content-Length:\s*(\d+)/i);
        if (match) {
          const contentLength = parseInt(match[1], 10);
          if (contentLength > MAX_MCP_MESSAGE_CHARS) {
            this.failTransport(`MCP server '${this.config.id}' emitted oversized Content-Length frame (${contentLength} chars).`);
            return;
          }
          const bodyStart = headerEnd + 4;
          if (this.buffer.length < bodyStart + contentLength) {
            break; // Wait for more data
          }
          const body = this.buffer.slice(bodyStart, bodyStart + contentLength);
          this.buffer = this.buffer.slice(bodyStart + contentLength);
          this.parseAndHandle(body);
          continue;
        }
      }

      // Newline-delimited JSON: extract complete lines
      const newlineIdx = this.buffer.indexOf('\n');
      if (newlineIdx === -1) break; // Wait for complete line
      if (newlineIdx > MAX_MCP_MESSAGE_CHARS) {
        this.failTransport(`MCP server '${this.config.id}' emitted oversized newline-delimited frame.`);
        return;
      }

      const line = this.buffer.slice(0, newlineIdx).trim();
      this.buffer = this.buffer.slice(newlineIdx + 1);

      if (line.length === 0) continue; // Skip empty lines
      this.parseAndHandle(line);
    }
  }

  private parseAndHandle(body: string): void {
    try {
      const message = JSON.parse(body) as JsonRpcResponse;
      this.handleMessage(message);
    } catch {
      log.warn({ server: this.config.id, size: body.length }, 'Failed to parse MCP message');
    }
  }

  private handleMessage(message: JsonRpcResponse): void {
    if (message.id !== undefined && message.id !== null) {
      const pending = this.pendingRequests.get(String(message.id));
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(String(message.id));
        pending.resolve(message);
      }
    }
    // Notifications (no id) are logged but not dispatched
  }

  private rejectAllPending(error: Error): void {
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }

  private failTransport(reason: string): void {
    log.error({ server: this.config.id, reason }, 'MCP transport failure');
    this.state = 'error';
    this.rejectAllPending(new Error(reason));
    this.tools.clear();
    this.buffer = '';
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }
}

// ─── MCP Client Manager ──────────────────────────────────────

/**
 * Manages multiple MCP server connections.
 *
 * Provides a unified interface for tool discovery and execution
 * across all connected MCP servers.
 */
export class MCPClientManager {
  private clients: Map<string, MCPClient> = new Map();
  private readonly sandboxConfig: SandboxConfig;

  constructor(sandboxConfig?: SandboxConfig) {
    this.sandboxConfig = sandboxConfig ?? DEFAULT_SANDBOX_CONFIG;
  }

  /** Add and connect to an MCP server. */
  async addServer(config: MCPServerConfig): Promise<void> {
    if (this.clients.has(config.id)) {
      throw new Error(`MCP server '${config.id}' is already registered`);
    }

    const client = new MCPClient(config, this.sandboxConfig);
    this.clients.set(config.id, client);
    await client.connect();
  }

  /** Remove and disconnect from an MCP server. */
  removeServer(id: string): void {
    const client = this.clients.get(id);
    if (client) {
      client.disconnect();
      this.clients.delete(id);
    }
  }

  /** Get a specific client. */
  getClient(id: string): MCPClient | undefined {
    return this.clients.get(id);
  }

  /** Get all connected clients. */
  getClients(): MCPClient[] {
    return [...this.clients.values()];
  }

  /**
   * Get all tool definitions from all connected servers.
   *
   * Tool names are prefixed with "mcp-<serverId>-" to avoid collisions.
   */
  getAllToolDefinitions(): ToolDefinition[] {
    const definitions: ToolDefinition[] = [];
    for (const client of this.clients.values()) {
      if (client.getState() === 'connected') {
        definitions.push(...client.getToolDefinitions());
      }
    }
    return definitions;
  }

  /**
   * Call a tool by its fully qualified name (mcp-<serverId>-<toolName>).
   *
   * Parses the server ID and tool name from the qualified name,
   * then delegates to the appropriate client.
   */
  async callTool(qualifiedName: string, args: Record<string, unknown>): Promise<ToolResult> {
    const parsed = MCPClientManager.parseToolName(qualifiedName);
    if (!parsed) {
      return { success: false, error: `Invalid MCP tool name: ${qualifiedName}` };
    }

    const client = this.clients.get(parsed.serverId);
    if (!client) {
      return { success: false, error: `MCP server '${parsed.serverId}' not found` };
    }

    return client.callTool(parsed.toolName, args);
  }

  /**
   * Parse a qualified MCP tool name into server ID and tool name.
   *
   * Format: mcp-<serverId>-<toolName>
   * Server IDs must be alphanumeric/underscore only (no hyphens).
   * Tool names may contain hyphens and underscores.
   */
  static parseToolName(qualifiedName: string): { serverId: string; toolName: string } | null {
    const match = qualifiedName.match(/^mcp-([a-zA-Z0-9_]+)-(.+)$/);
    if (!match) return null;
    return { serverId: match[1], toolName: match[2] };
  }

  /** Disconnect from all servers. */
  async disconnectAll(): Promise<void> {
    for (const client of this.clients.values()) {
      client.disconnect();
    }
    this.clients.clear();
  }

  /** Get status of all connections. */
  getStatus(): Array<{
    id: string;
    name: string;
    state: MCPConnectionState;
    toolCount: number;
    serverInfo: { name: string; version: string };
  }> {
    return [...this.clients.values()].map(client => ({
      id: client.config.id,
      name: client.config.name,
      state: client.getState(),
      toolCount: client.getTools().length,
      serverInfo: client.getServerInfo(),
    }));
  }
}

export function assessMcpStartupAdmission(
  config: Pick<MCPServerConfig, 'source' | 'startupApproved' | 'name'>,
): { allowed: boolean; reason: string | null } {
  if ((config.source ?? 'third_party') !== 'third_party') {
    return { allowed: true, reason: null };
  }
  if (config.startupApproved === true) {
    return { allowed: true, reason: null };
  }
  return {
    allowed: false,
    reason: `Third-party MCP server '${config.name}' is blocked until startupApproved: true is set explicitly.`,
  };
}

function inferMcpToolRisk(tool: MCPToolSchema, config: MCPServerConfig): ToolRisk {
  const source = config.source ?? 'third_party';
  const computed = source === 'managed_browser'
    ? inferManagedBrowserToolRisk(tool)
    : inferThirdPartyMcpRisk(tool);
  return applyRiskFloor(computed, config.trustLevel);
}

function inferThirdPartyMcpRisk(tool: MCPToolSchema): ToolRisk {
  const combined = `${tool.name} ${Object.keys(tool.inputSchema?.properties ?? {}).join(' ')}`
    .toLowerCase()
    .replace(/[_-]+/g, ' ');
  if (/\b(send|post|publish|notify|message|email|comment|reply|webhook|tweet|sms|invite|submit)\b/.test(combined)) {
    return 'external_post';
  }
  return 'mutating';
}

function inferManagedBrowserToolRisk(tool: MCPToolSchema): ToolRisk {
  const name = tool.name.toLowerCase().replace(/[_-]+/g, ' ');
  if (/(click|type|press|drag|fill|upload|route|cookie_|localstorage_|sessionstorage_|select_option|handle_dialog|install|run_code|evaluate)/.test(name)) {
    return 'mutating';
  }
  if (/(goto|navigate|network_requests|snapshot|markdown|links|structureddata|console_messages|wait_for|close|tabs|back|forward|reload|screenshot)/.test(name)) {
    return 'read_only';
  }
  return 'network';
}

function applyRiskFloor(inferred: ToolRisk, floor?: ToolRisk): ToolRisk {
  if (!floor) return inferred;
  const rank: Record<ToolRisk, number> = {
    read_only: 0,
    network: 1,
    mutating: 2,
    external_post: 3,
  };
  return rank[floor] > rank[inferred] ? floor : inferred;
}

function buildSafeMcpDescription(
  tool: MCPToolSchema,
  config: MCPServerConfig,
): { full: string; short: string } {
  const safeName = humanizeMcpToolName(tool.name);
  const sanitizedSourceDescription = sanitizeMcpDescription(tool.description);
  if ((config.source ?? 'third_party') === 'third_party') {
    const full = sanitizedSourceDescription
      ? `External MCP tool "${safeName}" from ${config.name}. Server metadata is treated as untrusted. Sanitized summary: ${sanitizedSourceDescription}`
      : `External MCP tool "${safeName}" from ${config.name}. Server metadata is treated as untrusted.`;
    return {
      full,
      short: truncateText(`External MCP tool "${safeName}" from ${config.name}. Review parameters and approval policy before use.`, MAX_MCP_SHORT_DESCRIPTION_CHARS),
    };
  }
  const full = sanitizedSourceDescription || `Managed MCP tool "${safeName}".`;
  return {
    full,
    short: truncateText(full, MAX_MCP_SHORT_DESCRIPTION_CHARS),
  };
}

function sanitizeMcpDescription(description: string | undefined): string {
  const cleaned = sanitizeMcpText(description ?? '', MAX_MCP_DESCRIPTION_CHARS);
  if (!cleaned) return '';
  if (MCP_METADATA_INJECTION_PATTERN.test(cleaned)) {
    return '';
  }
  return cleaned;
}

function sanitizeMcpInputSchema(schema: MCPToolSchema['inputSchema'] | undefined): Record<string, unknown> {
  if (!schema || schema.type !== 'object') {
    return { type: 'object', properties: {} };
  }
  const properties = sanitizeSchemaProperties(schema.properties, 1);
  const required = Array.isArray(schema.required)
    ? schema.required
      .filter((value): value is string => typeof value === 'string' && !!value.trim())
      .slice(0, MAX_MCP_SCHEMA_PROPERTIES)
    : undefined;
  return {
    type: 'object',
    properties,
    ...(required?.length ? { required } : {}),
  };
}

function sanitizeSchemaProperties(
  properties: Record<string, unknown> | undefined,
  depth: number,
): Record<string, unknown> {
  if (!properties || depth > MAX_MCP_SCHEMA_DEPTH) {
    return {};
  }
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties).slice(0, MAX_MCP_SCHEMA_PROPERTIES)) {
    if (!/^[a-zA-Z0-9_.-]{1,80}$/.test(key)) continue;
    const sanitizedValue = sanitizeSchemaNode(value, depth + 1);
    if (sanitizedValue) {
      sanitized[key] = sanitizedValue;
    }
  }
  return sanitized;
}

function sanitizeSchemaNode(value: unknown, depth: number): Record<string, unknown> | null {
  if (!isRecord(value) || depth > MAX_MCP_SCHEMA_DEPTH) {
    return null;
  }
  const sanitized: Record<string, unknown> = {};
  if (typeof value.type === 'string' && value.type.length <= 32) {
    sanitized.type = value.type;
  }
  if (Array.isArray(value.enum)) {
    const enumValues = value.enum
      .filter((entry) => ['string', 'number', 'boolean'].includes(typeof entry))
      .slice(0, MAX_MCP_ENUM_VALUES)
      .map((entry) => typeof entry === 'string' ? truncateText(entry, MAX_MCP_SCHEMA_STRING_CHARS) : entry);
    if (enumValues.length > 0) {
      sanitized.enum = enumValues;
    }
  }
  if (isRecord(value.items)) {
    const items = sanitizeSchemaNode(value.items, depth + 1);
    if (items) sanitized.items = items;
  }
  if (isRecord(value.properties)) {
    sanitized.properties = sanitizeSchemaProperties(value.properties as Record<string, unknown>, depth + 1);
  }
  if (Array.isArray(value.required)) {
    const required = value.required
      .filter((entry): entry is string => typeof entry === 'string' && !!entry.trim())
      .slice(0, MAX_MCP_SCHEMA_PROPERTIES);
    if (required.length > 0) sanitized.required = required;
  }
  if (typeof value.additionalProperties === 'boolean') {
    sanitized.additionalProperties = value.additionalProperties;
  } else if (isRecord(value.additionalProperties)) {
    const nested = sanitizeSchemaNode(value.additionalProperties, depth + 1);
    if (nested) sanitized.additionalProperties = nested;
  }
  for (const numericKey of ['minimum', 'maximum', 'minLength', 'maxLength', 'minItems', 'maxItems'] as const) {
    if (typeof value[numericKey] === 'number' && Number.isFinite(value[numericKey])) {
      sanitized[numericKey] = value[numericKey];
    }
  }
  if (typeof value.pattern === 'string' && value.pattern.length <= MAX_MCP_SCHEMA_STRING_CHARS) {
    sanitized.pattern = value.pattern;
  }
  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

function formatMcpToolResultContent(content: MCPToolCallContent[]): string {
  return content
    .map((entry) => {
      if (entry.type === 'text' && entry.text) {
        return entry.text;
      }
      if (entry.type === 'image') {
        return '[MCP image output omitted]';
      }
      if (entry.type === 'resource') {
        return '[MCP resource output omitted]';
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

function isSafeMcpToolName(name: string): boolean {
  return /^[a-zA-Z0-9_.-]{1,80}$/.test(name);
}

function humanizeMcpToolName(name: string): string {
  return truncateText(name.replace(/[_-]+/g, ' ').trim() || 'tool', MAX_MCP_SHORT_DESCRIPTION_CHARS);
}

function sanitizeMcpText(value: string, maxChars: number): string {
  return truncateText(
    value
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
      .replace(/[\u200b-\u200f\u2060\ufeff]/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
    maxChars,
  );
}

function truncateText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  const suffix = '...';
  return `${value.slice(0, Math.max(0, maxChars - suffix.length)).trimEnd()}${suffix}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
