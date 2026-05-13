import type { CodingBackendConfig, CodingBackendsConfig } from '../config/types.js';
import type { CodingBackendTerminalControl } from '../channels/web-types.js';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { CODING_BACKEND_PRESETS } from './coding-backend-presets.js';
import { createLogger } from '../util/logging.js';

const log = createLogger('coding-backend');

/** Structured result from a coding backend run. */
export interface CodingBackendRunResult {
  success: boolean;
  sessionId?: string;
  backendId: string;
  backendName: string;
  task: string;
  status: 'succeeded' | 'failed' | 'timed_out';
  exitCode?: number;
  durationMs: number;
  /** Final assistant answer captured separately from the raw terminal transcript. */
  assistantResponse?: string;
  /** Cleaned output with ANSI codes stripped, truncated. */
  output: string;
  terminalTabId: string;
  codeSessionId?: string;
  sdkThreadId?: string;
  resumedFromSessionId?: string;
  resumedFromThreadId?: string;
  resumable?: boolean;
  codexProject?: CodexSdkProjectState;
}

/** Active or completed backend session. */
export interface CodingBackendSession {
  id: string;
  backendId: string;
  backendName: string;
  codeSessionId: string;
  terminalId: string;
  task: string;
  status: 'running' | 'succeeded' | 'failed' | 'timed_out';
  startedAt: number;
  completedAt?: number;
  exitCode?: number;
  durationMs?: number;
  sdkThreadId?: string;
  resumedFromSessionId?: string;
  resumedFromThreadId?: string;
  resumable?: boolean;
}

export interface CodexSdkProjectState {
  codeSessionId: string;
  workspaceRoot: string;
  backendId: string;
  activeThreadId: string;
  projectObjective: string;
  currentPhase: string;
  lastCheckpoint: string;
  lastRunSessionId?: string;
  lastRunStatus: 'running' | 'succeeded' | 'failed' | 'timed_out';
  lastHostFollowupStatus?: 'not_requested' | 'succeeded' | 'failed';
  lastFilesChanged?: string[];
  lastVerification?: CodexSdkVerificationItem[];
  lastLocalServer?: CodexSdkLocalServerHandoff;
  updatedAt: number;
}

export interface CodingBackendServiceOptions {
  config: CodingBackendsConfig;
  terminalControl: CodingBackendTerminalControl;
  recentSessionsPath?: string;
}

export type CodingBackendProgressKind =
  | 'started'
  | 'progress'
  | 'completed'
  | 'failed'
  | 'timed_out';

export interface CodingBackendProgressEvent {
  id: string;
  kind: CodingBackendProgressKind;
  runId: string;
  requestId?: string;
  codeSessionId: string;
  sessionId: string;
  terminalId: string;
  backendId: string;
  backendName: string;
  task: string;
  timestamp: number;
  detail?: string;
  exitCode?: number;
}

export type CodingBackendProgressListener = (event: CodingBackendProgressEvent) => void;

const MAX_OUTPUT_BYTES = 1_048_576; // 1MB
const MAX_TOOL_OUTPUT_CHARS = 8000;
const MAX_PROGRESS_DETAIL_CHARS = 500;
const DEFAULT_TIMEOUT_MS = 300_000; // 5 min
const CODEX_SDK_LOCAL_SERVER_VERIFY_TIMEOUT_MS = 20_000;
const CODEX_SDK_LOCAL_SERVER_VERIFY_INTERVAL_MS = 750;
const OUTPUT_PROGRESS_THROTTLE_MS = 1_200;
const WORKSPACE_INSTRUCTION_FILES = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md'] as const;
const MAX_WORKSPACE_INSTRUCTION_CHARS = 16_000;
const CODEX_SDK_RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['completed', 'partial', 'blocked', 'failed'] },
    summary: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    verification: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          status: { type: 'string', enum: ['passed', 'failed', 'skipped'] },
          evidence: { type: 'string' },
        },
        required: ['name', 'status', 'evidence'],
      },
    },
    localServer: {
      type: 'object',
      additionalProperties: false,
      properties: {
        requested: { type: 'boolean' },
        persistentStarted: { type: 'boolean' },
        startCommand: { type: 'string' },
        url: { type: 'string' },
        healthUrl: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['requested', 'persistentStarted', 'startCommand', 'url', 'healthUrl', 'notes'],
    },
    nextSteps: { type: 'array', items: { type: 'string' } },
  },
  required: ['status', 'summary', 'filesChanged', 'verification', 'localServer', 'nextSteps'],
} as const;

/** Strip ANSI escape codes from terminal output. */
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?\x07|\x1b\[.*?[@-~]/g, '');
}

/** Shell-quote a string for POSIX shells. */
function shellQuote(text: string): string {
  return `'${text.replace(/'/g, "'\\''")}'`;
}

function toWslPath(value: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) return '/';
  if (normalized.startsWith('/')) {
    return normalized.replace(/\\/g, '/');
  }
  const driveMatch = normalized.replace(/\//g, '\\').match(/^([A-Za-z]):\\(.*)$/);
  if (driveMatch) {
    const [, drive, rest] = driveMatch;
    return `/mnt/${drive.toLowerCase()}/${rest.replace(/\\/g, '/')}`;
  }
  return normalized.replace(/\\/g, '/');
}

function toShellVisiblePath(value: string, shell: string): string {
  if (process.platform !== 'win32') {
    return value;
  }
  if (shell === 'wsl' || shell === 'wsl-login') {
    return toWslPath(value);
  }
  if (shell === 'git-bash') {
    return value.replace(/\\/g, '/');
  }
  return value;
}

interface BuildCommandOptions {
  assistantResponseArgs?: string;
}

/** Build the full CLI command from config and task. */
function buildCommand(
  backend: CodingBackendConfig,
  task: string,
  cwd: string,
  options: BuildCommandOptions = {},
): string {
  const quotedTask = shellQuote(task);
  const args = backend.args
    .map((arg) => arg
      .replace(/\{\{task\}\}/g, quotedTask)
      .replace(/\{\{cwd\}\}/g, shellQuote(cwd))
      .replace(/\{\{assistant_response_args\}\}/g, options.assistantResponseArgs?.trim() || '')
      .trim())
    .filter(Boolean);
  // If args already contain the quoted task (from template), join directly.
  // Otherwise the task was interpolated into the args already.
  return [backend.command, ...args].join(' ');
}

/** Build the shell input written into the terminal PTY. */
function buildTerminalInput(backend: CodingBackendConfig, command: string): string {
  if (backend.nonInteractive === false) {
    return `${command}\n`;
  }
  // Coding backends run inside an interactive shell PTY so append exit for
  // one-shot runs; otherwise the shell stays open and the tool never resolves.
  return `${command}\nexit\n`;
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

async function readWorkspaceInstructionFile(workspaceRoot: string): Promise<{ fileName: string; content: string } | null> {
  const root = workspaceRoot.trim();
  if (!root) return null;
  for (const fileName of WORKSPACE_INSTRUCTION_FILES) {
    try {
      const content = (await readFile(join(root, fileName), 'utf8')).trim();
      if (!content) continue;
      return {
        fileName,
        content: truncateText(content, MAX_WORKSPACE_INSTRUCTION_CHARS),
      };
    } catch {
      // Try the next supported workspace instruction file.
    }
  }
  return null;
}

function buildTaskWithWorkspaceInstructions(
  task: string,
  instructions: { fileName: string; content: string } | null,
): string {
  if (!instructions) return task;
  return [
    `Workspace instructions loaded from ${instructions.fileName}. Follow these instructions for this run:`,
    '',
    instructions.content,
    '',
    'User task:',
    task,
  ].join('\n');
}

function extractProgressDetail(backendId: string, output: string, command: string): string | undefined {
  const normalizedCommand = command.trim();
  const lines = stripAnsi(output)
    .replace(/\r+/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line) continue;
    if (normalizedCommand && line === normalizedCommand) continue;
    if (line.toLowerCase() === 'exit') continue;
    const detail = summarizeBackendProgressLine(backendId, line);
    if (detail) return detail;
  }
  return undefined;
}

function summarizeBackendProgressLine(backendId: string, line: string): string | undefined {
  if (backendId !== 'codex') {
    return truncateText(line, MAX_PROGRESS_DETAIL_CHARS);
  }

  const normalized = line.trim();
  if (!normalized) return undefined;

  if (/^exec$/i.test(normalized)) {
    return 'Running a workspace command.';
  }
  if (/^codex$/i.test(normalized)) {
    return 'Preparing the next workspace step.';
  }
  if (/^(succeeded|exited)\s+in\s+\d+(?:ms|s)\b/i.test(normalized)) {
    return 'Workspace command finished.';
  }
  if (/^\/bin\/(?:bash|sh)\s+-lc\b/i.test(normalized) || /^powershell(?:\.exe)?\s+-/i.test(normalized)) {
    return 'Running a workspace command.';
  }
  if (/^(?:sed|rg|grep|find|ls|git\s+(?:status|diff|show|log)|Get-Content|Get-ChildItem)\b/i.test(normalized)) {
    return 'Inspecting workspace files.';
  }
  if (/^(?:node|npm|pnpm|yarn|python3?|npx|vite|curl)\b/i.test(normalized)) {
    return 'Checking the app locally.';
  }
  if (/^(?:apply_patch|cat\s+>|tee\s+|printf\s+)/i.test(normalized)) {
    return 'Updating workspace files.';
  }
  if (/^(?:tokens\s+used|thinking|codex\s+exec)\b/i.test(normalized)) {
    return undefined;
  }

  return 'Working in the attached workspace.';
}

function summarizeCompletionDetail(
  backendId: string,
  status: 'succeeded' | 'failed' | 'timed_out',
  output: string,
  command: string,
  exitCode?: number,
): string | undefined {
  const detail = extractProgressDetail(backendId, output, command);
  if (detail) return detail;
  if (status === 'timed_out') {
    return 'The delegated coding assistant did not finish before the timeout.';
  }
  if (typeof exitCode === 'number' && Number.isFinite(exitCode) && exitCode !== 0) {
    return `Exited with code ${exitCode}.`;
  }
  return undefined;
}

interface ActiveCodingBackendSession {
  session: CodingBackendSession;
  runId: string;
  requestId?: string;
  command: string;
  outputBuffer: string;
  assistantResponseCapture?: AssistantResponseCapture | null;
  progressSequence: number;
  lastProgressDetail?: string;
  lastProgressAt?: number;
  unsubscribeOutput: () => void;
  unsubscribeExit: () => void;
  timeoutHandle?: ReturnType<typeof setTimeout>;
  resolve?: (result: CodingBackendRunResult) => void;
}

interface CodexSdkVerificationItem {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  evidence?: string;
}

interface CodexSdkLocalServerHandoff {
  requested: boolean;
  persistentStarted?: boolean;
  startCommand?: string;
  url?: string;
  healthUrl?: string;
  notes?: string;
}

interface CodexSdkStructuredResponse {
  status: 'completed' | 'partial' | 'blocked' | 'failed';
  summary: string;
  filesChanged: string[];
  verification: CodexSdkVerificationItem[];
  localServer: CodexSdkLocalServerHandoff;
  nextSteps: string[];
}

interface CodexSdkHostLaunchResult {
  attempted: boolean;
  success?: boolean;
  terminalId?: string;
  url?: string;
  healthUrl?: string;
  message: string;
}

interface CodexSdkResumeTarget {
  threadId: string;
  sessionId?: string;
}

interface AssistantResponseCapture {
  directory: string;
  hostPath: string;
  shellPath: string;
}

function backendSupportsAssistantResponseCapture(backend: CodingBackendConfig): boolean {
  return resolveBackendAdapterKind(backend) === 'terminal_cli'
    && backend.args.some((arg) => arg.includes('{{assistant_response_args}}'));
}

function resolveBackendAdapterKind(backend: CodingBackendConfig): NonNullable<CodingBackendConfig['adapterKind']> {
  return backend.adapterKind ?? 'terminal_cli';
}

function runtimeEnvironment(env?: Record<string, string>): Record<string, string> | undefined {
  if (!env || Object.keys(env).length === 0) return undefined;
  const base = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
  return { ...base, ...env };
}

function summarizeCodexSdkEvent(event: unknown): string | undefined {
  if (!event || typeof event !== 'object') return undefined;
  const record = event as { type?: unknown; item?: unknown; message?: unknown; error?: unknown; usage?: unknown };
  if (record.type === 'thread.started') return 'Started a Codex SDK thread.';
  if (record.type === 'turn.started') return 'Codex SDK is working in the attached workspace.';
  if (record.type === 'turn.completed') return 'Codex SDK turn completed.';
  if (record.type === 'turn.failed') {
    const error = record.error as { message?: unknown } | undefined;
    return `Codex SDK turn failed: ${truncateText(String(error?.message ?? 'unknown error'), 180)}`;
  }
  if (record.type === 'error') {
    return `Codex SDK stream error: ${truncateText(String(record.message ?? 'unknown error'), 180)}`;
  }
  if (
    (record.type !== 'item.started' && record.type !== 'item.updated' && record.type !== 'item.completed')
    || !record.item
    || typeof record.item !== 'object'
  ) {
    return undefined;
  }

  const item = record.item as {
    type?: unknown;
    text?: unknown;
    changes?: unknown;
    status?: unknown;
    command?: unknown;
    exit_code?: unknown;
    server?: unknown;
    tool?: unknown;
    query?: unknown;
    message?: unknown;
    items?: unknown;
    error?: unknown;
  };
  if (item.type === 'agent_message') return 'Codex SDK produced a response.';
  if (item.type === 'reasoning' && typeof item.text === 'string' && item.text.trim()) {
    return `Codex SDK reasoning: ${truncateText(item.text.trim(), 180)}`;
  }
  if (item.type === 'command_execution') {
    const command = typeof item.command === 'string' && item.command.trim()
      ? truncateText(item.command.trim(), 180)
      : 'workspace command';
    const status = typeof item.status === 'string' ? item.status : undefined;
    const exitCode = typeof item.exit_code === 'number' ? ` exit ${item.exit_code}` : '';
    if (status === 'failed') return `Codex SDK command failed${exitCode}: ${command}`;
    if (status === 'completed') return `Codex SDK command completed${exitCode}: ${command}`;
    return `Codex SDK command running: ${command}`;
  }
  if (item.type === 'file_change') {
    const count = Array.isArray(item.changes) ? item.changes.length : 0;
    const status = item.status === 'failed' ? 'failed to apply' : 'applied';
    return count > 0
      ? `Codex SDK ${status} ${count} file change${count === 1 ? '' : 's'}.`
      : `Codex SDK ${status} file changes.`;
  }
  if (item.type === 'mcp_tool_call') {
    const server = typeof item.server === 'string' ? item.server : 'MCP';
    const tool = typeof item.tool === 'string' ? item.tool : 'tool';
    const error = item.error as { message?: unknown } | undefined;
    if (item.status === 'failed') {
      return `Codex SDK tool failed: ${server}.${tool}: ${truncateText(String(error?.message ?? 'unknown error'), 140)}`;
    }
    if (item.status === 'completed') return `Codex SDK tool completed: ${server}.${tool}.`;
    return `Codex SDK tool running: ${server}.${tool}.`;
  }
  if (item.type === 'web_search') {
    const query = typeof item.query === 'string' && item.query.trim()
      ? `: ${truncateText(item.query.trim(), 160)}`
      : '';
    return `Codex SDK searched the web${query}`;
  }
  if (item.type === 'todo_list' && Array.isArray(item.items)) {
    const todos = item.items as Array<{ text?: unknown; completed?: unknown }>;
    const completed = todos.filter((todo) => todo.completed === true).length;
    const current = todos.find((todo) => todo.completed !== true && typeof todo.text === 'string');
    const currentText = typeof current?.text === 'string' ? current.text : undefined;
    const suffix = currentText ? `; now ${truncateText(currentText, 140)}` : '';
    return `Codex SDK plan progress: ${completed}/${todos.length}${suffix}`;
  }
  if (item.type === 'error') {
    return `Codex SDK item error: ${truncateText(String(item.message ?? 'unknown error'), 180)}`;
  }
  return undefined;
}

function rememberCodexSdkProgress(progress: string[], detail: string): void {
  if (progress[progress.length - 1] === detail) return;
  progress.push(detail);
  if (progress.length > 12) progress.shift();
}

function getCodexSdkThreadId(event: unknown): string | undefined {
  if (!event || typeof event !== 'object') return undefined;
  const record = event as { type?: unknown; thread_id?: unknown };
  return record.type === 'thread.started' && typeof record.thread_id === 'string'
    ? record.thread_id
    : undefined;
}

function getCodexSdkAgentMessage(event: unknown): string | undefined {
  if (!event || typeof event !== 'object') return undefined;
  const record = event as { type?: unknown; item?: unknown };
  if (record.type !== 'item.completed' || !record.item || typeof record.item !== 'object') return undefined;
  const item = record.item as { type?: unknown; text?: unknown };
  return item.type === 'agent_message' && typeof item.text === 'string'
    ? item.text
    : undefined;
}

function isCodexSdkTurnCompleted(event: unknown): boolean {
  return Boolean(event && typeof event === 'object' && (event as { type?: unknown }).type === 'turn.completed');
}

function parseCodexSdkStructuredResponse(text: string): CodexSdkStructuredResponse | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const candidates = [trimmed];
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) candidates.push(fenced[1].trim());
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Partial<CodexSdkStructuredResponse>;
      if (!parsed || typeof parsed !== 'object') continue;
      return {
        status: normalizeCodexSdkStructuredStatus(parsed.status),
        summary: typeof parsed.summary === 'string' ? parsed.summary : '',
        filesChanged: Array.isArray(parsed.filesChanged)
          ? parsed.filesChanged.filter((item): item is string => typeof item === 'string')
          : [],
        verification: normalizeCodexSdkVerification(parsed.verification),
        localServer: normalizeCodexSdkLocalServer(parsed.localServer),
        nextSteps: Array.isArray(parsed.nextSteps)
          ? parsed.nextSteps.filter((item): item is string => typeof item === 'string')
          : [],
      };
    } catch {
      // Try the next JSON-shaped candidate.
    }
  }
  return null;
}

function normalizeCodexSdkStructuredStatus(value: unknown): CodexSdkStructuredResponse['status'] {
  return value === 'completed' || value === 'partial' || value === 'blocked' || value === 'failed'
    ? value
    : 'partial';
}

function normalizeCodexSdkVerification(value: unknown): CodexSdkVerificationItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): CodexSdkVerificationItem | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as { name?: unknown; status?: unknown; evidence?: unknown };
      if (typeof record.name !== 'string') return null;
      const status = record.status === 'passed' || record.status === 'failed' || record.status === 'skipped'
        ? record.status
        : 'skipped';
      return {
        name: record.name,
        status,
        ...(typeof record.evidence === 'string' ? { evidence: record.evidence } : {}),
      };
    })
    .filter((item): item is CodexSdkVerificationItem => Boolean(item));
}

function normalizeCodexSdkLocalServer(value: unknown): CodexSdkLocalServerHandoff {
  if (!value || typeof value !== 'object') return { requested: false };
  const record = value as {
    requested?: unknown;
    persistentStarted?: unknown;
    startCommand?: unknown;
    url?: unknown;
    healthUrl?: unknown;
    notes?: unknown;
  };
  return {
    requested: record.requested === true,
    ...(typeof record.persistentStarted === 'boolean' ? { persistentStarted: record.persistentStarted } : {}),
    ...(typeof record.startCommand === 'string' ? { startCommand: record.startCommand } : {}),
    ...(typeof record.url === 'string' ? { url: record.url } : {}),
    ...(typeof record.healthUrl === 'string' ? { healthUrl: record.healthUrl } : {}),
    ...(typeof record.notes === 'string' ? { notes: record.notes } : {}),
  };
}

function formatCodexSdkSuccessOutput(
  rawResponse: string,
  structured: CodexSdkStructuredResponse | null,
  hostLaunch: CodexSdkHostLaunchResult | null,
  threadId?: string,
): string {
  if (!structured) {
    return rawResponse || '(no output captured)';
  }

  const lines: string[] = [];
  lines.push(`Codex SDK status: ${structured.status}`);
  if (threadId) lines.push(`Thread ID: ${threadId}`);
  if (structured.summary.trim()) {
    lines.push('');
    lines.push(structured.summary.trim());
  }
  if (structured.filesChanged.length > 0) {
    lines.push('');
    lines.push('Files changed:');
    for (const file of structured.filesChanged.slice(0, 20)) {
      lines.push(`- ${file}`);
    }
    if (structured.filesChanged.length > 20) {
      lines.push(`- ...and ${structured.filesChanged.length - 20} more`);
    }
  }
  if (structured.verification.length > 0) {
    lines.push('');
    lines.push('Verification:');
    for (const check of structured.verification) {
      const evidence = check.evidence?.trim() ? ` (${check.evidence.trim()})` : '';
      lines.push(`- ${check.status}: ${check.name}${evidence}`);
    }
  }
  if (structured.localServer.requested) {
    lines.push('');
    lines.push('Local server:');
    if (structured.localServer.url) lines.push(`- URL: ${structured.localServer.url}`);
    if (structured.localServer.healthUrl) lines.push(`- Health URL: ${structured.localServer.healthUrl}`);
    if (structured.localServer.startCommand) lines.push(`- Start command: ${structured.localServer.startCommand}`);
    if (typeof structured.localServer.persistentStarted === 'boolean') {
      lines.push(`- SDK persistent start: ${structured.localServer.persistentStarted ? 'yes' : 'no'}`);
    }
    if (structured.localServer.notes?.trim()) lines.push(`- Notes: ${structured.localServer.notes.trim()}`);
  }
  if (hostLaunch?.attempted) {
    lines.push('');
    lines.push('Guardian host start:');
    lines.push(`- ${hostLaunch.message}`);
    if (hostLaunch.success === false) {
      lines.push('- The SDK task completed, but Guardian did not verify a persistent local server. Treat the URL as not currently live until a later start succeeds.');
    }
    if (hostLaunch.terminalId) lines.push(`- Terminal: ${hostLaunch.terminalId}`);
    if (hostLaunch.url) lines.push(`- URL: ${hostLaunch.url}`);
    if (hostLaunch.healthUrl) lines.push(`- Health URL: ${hostLaunch.healthUrl}`);
  }
  if (structured.nextSteps.length > 0) {
    lines.push('');
    lines.push('Next steps:');
    for (const step of structured.nextSteps) {
      lines.push(`- ${step}`);
    }
  }
  return lines.join('\n').trim();
}

function formatCodexSdkFailureOutput(params: {
  message: string;
  threadId?: string;
  finalResponse?: string;
  recentProgress: string[];
  resumable?: boolean;
}): string {
  const lines = [params.message];
  if (params.threadId) lines.push(`Thread ID: ${params.threadId}`);
  if (params.recentProgress.length > 0) {
    lines.push('');
    lines.push('Recent SDK progress:');
    for (const detail of params.recentProgress.slice(-8)) {
      lines.push(`- ${detail}`);
    }
  }
  if (params.finalResponse?.trim()) {
    lines.push('');
    lines.push('Last response fragment:');
    lines.push(truncateText(params.finalResponse.trim(), 1200));
  }
  if (params.resumable && params.threadId) {
    lines.push('');
    lines.push('Resume: ask Guardian to continue the latest Codex SDK run, or pass this thread ID as resumeThreadId.');
  }
  return lines.join('\n');
}

function normalizeLocalServerStartCommand(value: string | undefined): string | null {
  const command = String(value ?? '')
    .replace(/\0/g, '')
    .replace(/[\r\n]+/g, ' ')
    .trim();
  if (!command || command.length > 1000) return null;
  return command;
}

function isLoopbackHttpUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  } catch {
    return false;
  }
}

async function fetchLoopbackHttp(url: string, timeoutMs = 3_000): Promise<{ ok: boolean; status?: number; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return { ok: response.ok, status: response.status };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForLoopbackHttpOk(
  url: string,
  timeoutMs = CODEX_SDK_LOCAL_SERVER_VERIFY_TIMEOUT_MS,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const deadline = Date.now() + timeoutMs;
  let last: { ok: boolean; status?: number; error?: string } = { ok: false, error: 'not checked' };
  while (Date.now() < deadline) {
    last = await fetchLoopbackHttp(url);
    if (last.ok) return last;
    await new Promise((resolve) => setTimeout(resolve, CODEX_SDK_LOCAL_SERVER_VERIFY_INTERVAL_MS));
  }
  return last;
}

function isCodexSdkCleanupParseNoise(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /^Failed to parse item:\s*SUCCESS:\s+The process with PID \d+ \(child process of PID \d+\) has been terminated\./i.test(message.trim());
}

function buildCodexSdkDelegatedTask(task: string, options: {
  resumed?: boolean;
  projectState?: CodexSdkProjectState | null;
} = {}): string {
  return [
    'You are the delegated Codex SDK coding worker for GuardianAgent.',
    ...(options.resumed
      ? ['This is a resumed SDK thread. Continue from the existing thread context and focus on finishing or verifying the interrupted work.']
      : []),
    ...(options.projectState
      ? [
          'Guardian is using this SDK thread as the active project-driver thread for the attached coding workspace.',
          `Project objective: ${options.projectState.projectObjective}`,
          `Last checkpoint: ${options.projectState.lastCheckpoint || '(no checkpoint yet)'}`,
          `Last run status: ${options.projectState.lastRunStatus}`,
          'Treat the user request below as the next project instruction. If it asks for design, plan first and avoid file edits unless explicitly requested. If it asks for implementation, continue in small verifiable phases.',
        ]
      : [
          'Guardian may keep this SDK thread as the active project-driver thread for later design, implementation, test, review, and handoff turns in this coding workspace.',
        ]),
    'Complete the user task directly in the configured working directory.',
    'Do not call Guardian APIs, ask Guardian to delegate again, or invoke nested Codex, Codex SDK, or Codex CLI processes.',
    'Use only tools available inside this SDK worker. If browser automation tools are unavailable, verify local apps with shell commands, HTTP requests, server output, or runtime smoke checks.',
    'Do not load or follow Codex Desktop Browser skill instructions unless a browser tool is directly available in this worker.',
    'If the task asks you to start a long-running local server, do not spend time trying to keep a detached child process alive after the SDK command exits. Create the scripts needed to run it, do bounded smoke verification inside one command when possible, then return a one-line start command and loopback URL in localServer. Guardian can start and verify the persistent process from the host after your turn.',
    'Return only JSON matching the provided output schema. Keep verification honest: report failed or skipped checks instead of inventing success.',
    '',
    'User task:',
    task,
  ].join('\n');
}

/**
 * Extract the final assistant reply from a raw coding-backend terminal transcript.
 * Used as a fallback when the CLI's `--output-last-message` capture file is unavailable
 * (path translation, permissions, version drift). Backend-specific because each CLI
 * prints its final answer in a different format.
 */
function extractAssistantResponseFromOutput(backendId: string, output: string): string | undefined {
  const text = output.replace(/\r+/g, '\n');
  if (!text.trim()) return undefined;

  // Codex `exec` prints the answer between a `codex` marker line and a trailing
  // `tokens used <n>` summary line. Allow surrounding whitespace.
  if (backendId === 'codex') {
    const matches = [...text.matchAll(/(^|\n)\s*codex\s*\n([\s\S]*?)(?=\n\s*tokens\s+used\b|$)/gi)];
    if (matches.length > 0) {
      const last = matches[matches.length - 1];
      const body = stripTrailingShellNoise(last[2] ?? '');
      if (body) return body;
    }
    return undefined;
  }

  // Aider interleaves tool logs, diffs, and assistant prose. Its own summaries
  // come between `> <task>` and either `Tokens:` or `Applied edit` / final prompt.
  if (backendId === 'aider') {
    const tokenCutoff = text.search(/\n\s*Tokens:\s*/i);
    const trimmed = tokenCutoff >= 0 ? text.slice(0, tokenCutoff) : text;
    const afterPrompt = trimmed.match(/\n>\s+[\s\S]*?\n([\s\S]*)$/);
    const candidate = afterPrompt ? afterPrompt[1] : trimmed;
    const cleaned = stripTrailingShellNoise(stripLeadingCommandEcho(candidate));
    return cleaned || undefined;
  }

  // Claude Code (`--print`) and Gemini CLI print the assistant reply directly.
  // Strip the shell wrapper (command echo + trailing `exit` / bash prompt) and
  // return the remainder verbatim.
  if (backendId === 'claude-code' || backendId === 'gemini-cli') {
    const cleaned = stripTrailingShellNoise(stripLeadingCommandEcho(text));
    return cleaned || undefined;
  }

  // Unknown / user-configured backend: best-effort wrapper strip.
  const cleaned = stripTrailingShellNoise(stripLeadingCommandEcho(text));
  return cleaned || undefined;
}

/**
 * Remove the leading command-echo line(s) produced by the PTY shell. Drops any
 * prompt + command lines until the first line that looks like CLI output.
 */
function stripLeadingCommandEcho(text: string): string {
  const lines = text.split('\n');
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) { index += 1; continue; }
    if (/^(bash|sh|zsh|wsl)[\w.\-]*\$/.test(line)) { index += 1; continue; }
    if (/^[\w.\-]+@[\w.\-]+:[^$]*\$/.test(line)) { index += 1; continue; }
    if (/^(codex|claude|gemini|aider)\s+/.test(line)) { index += 1; continue; }
    break;
  }
  return lines.slice(index).join('\n').trim();
}

/**
 * Remove the trailing `exit` line, bash prompts left behind by the PTY shell,
 * and any `[output truncated]` marker appended by buffer capping.
 */
function stripTrailingShellNoise(text: string): string {
  let current = text.replace(/\n\[output truncated\]\s*$/i, '');
  const prune = /\n\s*(?:(?:bash|sh|zsh|wsl)[\w.\-]*\$[^\n]*|exit|logout|[\w.\-]+@[\w.\-]+:[^\n]*\$[^\n]*)\s*$/i;
  while (prune.test(current)) {
    current = current.replace(prune, '');
  }
  return current.trim();
}

async function createAssistantResponseCapture(shell: string): Promise<AssistantResponseCapture | null> {
  try {
    const directory = await mkdtemp(join(tmpdir(), 'guardianagent-coding-backend-'));
    const hostPath = join(directory, 'assistant-response.txt');
    return {
      directory,
      hostPath,
      shellPath: toShellVisiblePath(hostPath, shell),
    };
  } catch (error) {
    log.warn({ error }, 'Could not prepare assistant response capture for coding backend run');
    return null;
  }
}

async function readAssistantResponseCapture(capture?: AssistantResponseCapture | null): Promise<string | undefined> {
  if (!capture) return undefined;
  try {
    const text = (await readFile(capture.hostPath, 'utf8')).trim();
    return text || undefined;
  } catch {
    return undefined;
  }
}

async function cleanupAssistantResponseCapture(capture?: AssistantResponseCapture | null): Promise<void> {
  if (!capture) return;
  try {
    await rm(capture.directory, { recursive: true, force: true });
  } catch {
    // Ignore cleanup failures for temp capture directories.
  }
}

function readPersistedString(value: unknown, maxChars = 4000): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > maxChars ? trimmed.slice(0, maxChars) : trimmed;
}

function readPersistedNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readPersistedStatus(value: unknown): CodingBackendSession['status'] | undefined {
  return value === 'running' || value === 'succeeded' || value === 'failed' || value === 'timed_out'
    ? value
    : undefined;
}

function readPersistedProjectStatus(value: unknown): CodexSdkProjectState['lastRunStatus'] | undefined {
  return value === 'running' || value === 'succeeded' || value === 'failed' || value === 'timed_out'
    ? value
    : undefined;
}

function readPersistedHostFollowupStatus(value: unknown): CodexSdkProjectState['lastHostFollowupStatus'] | undefined {
  return value === 'not_requested' || value === 'succeeded' || value === 'failed'
    ? value
    : undefined;
}

function normalizePersistedStringArray(value: unknown, maxItems = 50, maxChars = 1000): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map((item) => readPersistedString(item, maxChars))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);
  return items.length > 0 ? items : undefined;
}

function normalizePersistedBackendSession(value: unknown, nowMs: number): CodingBackendSession | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const id = readPersistedString(record.id, 200);
  const backendId = readPersistedString(record.backendId, 200);
  const backendName = readPersistedString(record.backendName, 400);
  const codeSessionId = readPersistedString(record.codeSessionId, 200);
  const terminalId = readPersistedString(record.terminalId, 400);
  const task = readPersistedString(record.task, 8000);
  let status = readPersistedStatus(record.status);
  const startedAt = readPersistedNumber(record.startedAt);
  if (!id || !backendId || !backendName || !codeSessionId || !terminalId || !task || !status || !startedAt) {
    return null;
  }

  const completedAt = readPersistedNumber(record.completedAt);
  const exitCode = readPersistedNumber(record.exitCode);
  const durationMs = readPersistedNumber(record.durationMs);
  const sdkThreadId = readPersistedString(record.sdkThreadId, 400);
  const resumedFromSessionId = readPersistedString(record.resumedFromSessionId, 200);
  const resumedFromThreadId = readPersistedString(record.resumedFromThreadId, 400);
  const session: CodingBackendSession = {
    id,
    backendId,
    backendName,
    codeSessionId,
    terminalId,
    task,
    status,
    startedAt,
    ...(completedAt !== undefined ? { completedAt } : {}),
    ...(exitCode !== undefined ? { exitCode } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(sdkThreadId ? { sdkThreadId } : {}),
    ...(resumedFromSessionId ? { resumedFromSessionId } : {}),
    ...(resumedFromThreadId ? { resumedFromThreadId } : {}),
  };

  if (status === 'running') {
    status = 'failed';
    session.status = status;
    session.completedAt = session.completedAt ?? nowMs;
    session.durationMs = session.durationMs ?? Math.max(0, nowMs - startedAt);
  }
  session.resumable = record.resumable === true || ((status === 'failed' || status === 'timed_out') && Boolean(sdkThreadId));
  return session;
}

function normalizePersistedCodexProjectState(value: unknown): CodexSdkProjectState | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const codeSessionId = readPersistedString(record.codeSessionId, 200);
  const workspaceRoot = readPersistedString(record.workspaceRoot, 2000);
  const backendId = readPersistedString(record.backendId, 200);
  const activeThreadId = readPersistedString(record.activeThreadId, 400);
  const projectObjective = readPersistedString(record.projectObjective, 8000);
  const currentPhase = readPersistedString(record.currentPhase, 200) ?? 'active';
  const lastCheckpoint = readPersistedString(record.lastCheckpoint, 8000) ?? '';
  const lastRunStatus = readPersistedProjectStatus(record.lastRunStatus);
  const updatedAt = readPersistedNumber(record.updatedAt);
  if (!codeSessionId || !workspaceRoot || !backendId || !activeThreadId || !projectObjective || !lastRunStatus || !updatedAt) {
    return null;
  }

  const lastVerification = normalizeCodexSdkVerification(record.lastVerification);
  const lastLocalServer = normalizeCodexSdkLocalServer(record.lastLocalServer);
  return {
    codeSessionId,
    workspaceRoot,
    backendId,
    activeThreadId,
    projectObjective,
    currentPhase,
    lastCheckpoint,
    lastRunStatus,
    updatedAt,
    ...(readPersistedString(record.lastRunSessionId, 200) ? { lastRunSessionId: readPersistedString(record.lastRunSessionId, 200) } : {}),
    ...(readPersistedHostFollowupStatus(record.lastHostFollowupStatus) ? { lastHostFollowupStatus: readPersistedHostFollowupStatus(record.lastHostFollowupStatus) } : {}),
    ...(normalizePersistedStringArray(record.lastFilesChanged) ? { lastFilesChanged: normalizePersistedStringArray(record.lastFilesChanged) } : {}),
    ...(lastVerification.length > 0 ? { lastVerification } : {}),
    ...(lastLocalServer.requested ? { lastLocalServer } : {}),
  };
}

export class CodingBackendService {
  private config: CodingBackendsConfig;
  private readonly terminalControl: CodingBackendTerminalControl;
  private readonly recentSessionsPath?: string;
  private readonly activeSessions = new Map<string, ActiveCodingBackendSession>();
  private readonly recentSessions: CodingBackendSession[] = [];
  private readonly codexProjects = new Map<string, CodexSdkProjectState>();
  private readonly progressListeners = new Set<CodingBackendProgressListener>();
  private sessionCounter = 0;

  constructor(options: CodingBackendServiceOptions) {
    this.config = options.config;
    this.terminalControl = options.terminalControl;
    this.recentSessionsPath = options.recentSessionsPath?.trim() || undefined;
    this.loadRecentSessions();
  }

  private loadRecentSessions(): void {
    if (!this.recentSessionsPath) return;
    try {
      const parsed = JSON.parse(readFileSync(this.recentSessionsPath, 'utf8')) as unknown;
      const candidates = parsed && typeof parsed === 'object' && Array.isArray((parsed as { sessions?: unknown }).sessions)
        ? (parsed as { sessions: unknown[] }).sessions
        : Array.isArray(parsed)
          ? parsed
          : [];
      const projectCandidates = parsed && typeof parsed === 'object' && Array.isArray((parsed as { codexProjects?: unknown }).codexProjects)
        ? (parsed as { codexProjects: unknown[] }).codexProjects
        : [];
      const nowMs = Date.now();
      const sessions = candidates
        .map((candidate) => normalizePersistedBackendSession(candidate, nowMs))
        .filter((session): session is CodingBackendSession => Boolean(session))
        .slice(0, 50);
      this.recentSessions.splice(0, this.recentSessions.length, ...sessions);
      this.codexProjects.clear();
      for (const project of projectCandidates) {
        const normalized = normalizePersistedCodexProjectState(project);
        if (normalized) this.codexProjects.set(normalized.codeSessionId, normalized);
      }
    } catch (error) {
      if ((error as { code?: unknown }).code !== 'ENOENT') {
        log.warn({ error, path: this.recentSessionsPath }, 'Could not load coding backend session history');
      }
    }
  }

  private buildPersistedSessionSnapshot(): CodingBackendSession[] {
    const sessions: CodingBackendSession[] = [];
    const seen = new Set<string>();
    const push = (session: CodingBackendSession) => {
      if (seen.has(session.id)) return;
      seen.add(session.id);
      sessions.push({ ...session });
    };
    for (const entry of this.activeSessions.values()) push(entry.session);
    for (const session of this.recentSessions) push(session);
    return sessions.slice(0, 50);
  }

  private persistSessionsSnapshot(): void {
    if (!this.recentSessionsPath) return;
    try {
      mkdirSync(dirname(this.recentSessionsPath), { recursive: true });
      const tmpPath = `${this.recentSessionsPath}.tmp`;
      writeFileSync(
        tmpPath,
        JSON.stringify({
          version: 2,
          sessions: this.buildPersistedSessionSnapshot(),
          codexProjects: [...this.codexProjects.values()]
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, 50),
        }, null, 2),
        'utf8',
      );
      renameSync(tmpPath, this.recentSessionsPath);
    } catch (error) {
      log.warn({ error, path: this.recentSessionsPath }, 'Could not persist coding backend session history');
    }
  }

  private rememberRecentSession(session: CodingBackendSession): void {
    const existingIndex = this.recentSessions.findIndex((candidate) => candidate.id === session.id);
    if (existingIndex >= 0) this.recentSessions.splice(existingIndex, 1);
    this.recentSessions.unshift({ ...session });
    if (this.recentSessions.length > 50) this.recentSessions.length = 50;
    this.persistSessionsSnapshot();
  }

  private rememberCodexProjectState(state: CodexSdkProjectState): CodexSdkProjectState {
    this.codexProjects.set(state.codeSessionId, { ...state });
    this.persistSessionsSnapshot();
    return state;
  }

  private getCodexProjectState(codeSessionId: string): CodexSdkProjectState | null {
    this.loadRecentSessions();
    return this.codexProjects.get(codeSessionId) ?? null;
  }

  /** List available backends (config + presets merged). */
  listBackends(): Array<CodingBackendConfig & { preset?: boolean }> {
    const configuredIds = new Set(this.config.backends.map((b) => b.id));
    const backends: Array<CodingBackendConfig & { preset?: boolean }> = [];

    for (const backend of this.config.backends) {
      const preset = CODING_BACKEND_PRESETS.find((p) => p.id === backend.id);
      backends.push({
        ...preset,
        ...backend,
        preset: !!preset,
      } as CodingBackendConfig & { preset?: boolean });
    }

    // Also list known presets that aren't configured yet (as disabled)
    for (const preset of CODING_BACKEND_PRESETS) {
      if (!configuredIds.has(preset.id)) {
        backends.push({
          ...preset,
          enabled: false,
          preset: true,
        });
      }
    }

    return backends;
  }

  /** Resolve backend config by id, falling back to defaults and presets. */
  resolveBackend(backendId?: string): CodingBackendConfig | null {
    if (!this.config.enabled) {
      return null;
    }
    const id = backendId || this.config.defaultBackend;
    if (!id) {
      // Use first enabled configured backend.
      const first = this.config.backends.find((b) => b.enabled);
      if (first) return this.mergeWithPreset(first);
      return null;
    }
    const configured = this.config.backends.find((b) => b.id === id);
    if (configured) return this.mergeWithPreset(configured);
    return null;
  }

  private findEnabledCodexSdkBackendId(): string | undefined {
    const backend = this.config.backends.find((candidate) =>
      candidate.enabled && resolveBackendAdapterKind(this.mergeWithPreset(candidate)) === 'codex_sdk'
    );
    return backend?.id;
  }

  listEnabledBackendIds(): string[] {
    if (!this.config.enabled) return [];
    return this.config.backends
      .filter((backend) => backend.enabled)
      .map((backend) => backend.id);
  }

  getRunPrerequisiteError(params: {
    backendId?: string;
    codeSessionId?: string;
    workspaceRoot?: string;
  }): string | null {
    if (!this.config.enabled) {
      return 'Coding backend orchestration is not enabled. Enable it in Configuration > Integrations > Coding Assistants.';
    }

    if (!params.codeSessionId?.trim()) {
      return 'No active coding session. Create or attach to a coding session first.';
    }

    if (!params.workspaceRoot?.trim()) {
      return 'Could not determine workspace root for the current coding session.';
    }

    const requestedBackendId = params.backendId?.trim();
    if (!requestedBackendId) {
      if (this.resolveBackend()) {
        return null;
      }
      return 'No enabled coding backends are configured. Enable Codex, Claude Code, Gemini CLI, or Aider in Configuration > Integrations > Coding Assistants.';
    }

    const configured = this.config.backends.find((backend) => backend.id === requestedBackendId);
    if (!configured) {
      const preset = CODING_BACKEND_PRESETS.find((candidate) => candidate.id === requestedBackendId);
      if (preset) {
        return `Coding backend '${preset.name}' is not enabled. Enable it in Configuration > Integrations > Coding Assistants.`;
      }
      const available = this.listEnabledBackendIds();
      return `Coding backend '${requestedBackendId}' is not configured. Available: ${available.join(', ') || 'none'}. Add backends in Configuration > Integrations > Coding Assistants.`;
    }

    if (!configured.enabled) {
      const merged = this.mergeWithPreset(configured);
      return `Coding backend '${merged.name}' is disabled. Enable it in Configuration > Integrations > Coding Assistants.`;
    }

    return null;
  }

  private mergeWithPreset(config: CodingBackendConfig): CodingBackendConfig {
    const preset = CODING_BACKEND_PRESETS.find((p) => p.id === config.id);
    if (!preset) return config;
    return {
      ...preset,
      enabled: config.enabled,
      ...(config.adapterKind ? { adapterKind: config.adapterKind } : {}),
      ...(config.executionHost ? { executionHost: config.executionHost } : {}),
      ...(config.shell ? { shell: config.shell } : {}),
      ...(config.env ? { env: { ...config.env } } : {}),
      ...(typeof config.timeoutMs === 'number' ? { timeoutMs: config.timeoutMs } : {}),
      ...(typeof config.nonInteractive === 'boolean' ? { nonInteractive: config.nonInteractive } : {}),
      ...(typeof config.lastVersionCheck === 'number' ? { lastVersionCheck: config.lastVersionCheck } : {}),
      ...(typeof config.installedVersion === 'string' ? { installedVersion: config.installedVersion } : {}),
      ...(typeof config.updateAvailable === 'boolean' ? { updateAvailable: config.updateAvailable } : {}),
    };
  }

  subscribeProgress(listener: CodingBackendProgressListener): () => void {
    this.progressListeners.add(listener);
    return () => {
      this.progressListeners.delete(listener);
    };
  }

  public recordExternalProgress(runId: string, codeSessionId: string, backendName: string, task: string, message: string): void {
    const event: CodingBackendProgressEvent = {
      id: `progress-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind: 'progress',
      runId,
      requestId: runId,
      codeSessionId,
      sessionId: `ext-${runId}`,
      terminalId: 'none',
      backendId: 'remote-sandbox',
      backendName,
      task,
      timestamp: Date.now(),
      detail: message,
    };
    for (const listener of this.progressListeners) {
      try {
        listener(event);
      } catch {
        // ignore listener errors
      }
    }
  }

  private emitProgress(entry: ActiveCodingBackendSession, kind: CodingBackendProgressKind, timestamp: number, input: {
    detail?: string;
    exitCode?: number;
  } = {}): void {
    const event: CodingBackendProgressEvent = {
      id: `coding-backend:${entry.session.id}:${++entry.progressSequence}`,
      kind,
      runId: entry.runId,
      ...(entry.requestId ? { requestId: entry.requestId } : {}),
      codeSessionId: entry.session.codeSessionId,
      sessionId: entry.session.id,
      terminalId: entry.session.terminalId,
      backendId: entry.session.backendId,
      backendName: entry.session.backendName,
      task: entry.session.task,
      timestamp,
      ...(input.detail ? { detail: input.detail } : {}),
      ...(typeof input.exitCode === 'number' ? { exitCode: input.exitCode } : {}),
    };
    for (const listener of this.progressListeners) {
      listener({ ...event });
    }
  }

  private maybeEmitOutputProgress(entry: ActiveCodingBackendSession): void {
    const now = Date.now();
    if (entry.lastProgressAt && now - entry.lastProgressAt < OUTPUT_PROGRESS_THROTTLE_MS) {
      return;
    }
    const detail = extractProgressDetail(entry.session.backendId, entry.outputBuffer, entry.command);
    if (!detail || detail === entry.lastProgressDetail) return;
    entry.lastProgressDetail = detail;
    entry.lastProgressAt = now;
    this.emitProgress(entry, 'progress', now, { detail });
  }

  private findSession(sessionId: string): CodingBackendSession | null {
    const normalized = sessionId.trim();
    if (!normalized) return null;
    const active = this.activeSessions.get(normalized)?.session;
    if (active) return active;
    return this.recentSessions.find((session) => session.id === normalized) ?? null;
  }

  private findLatestResumableCodexSdkSession(input: {
    codeSessionId: string;
    backendId?: string;
  }): CodingBackendSession | null {
    this.loadRecentSessions();
    const normalizedBackendId = input.backendId?.trim();
    return this.recentSessions
      .filter((session) => session.codeSessionId === input.codeSessionId)
      .filter((session) => !normalizedBackendId || session.backendId === normalizedBackendId)
      .filter((session) => session.status === 'timed_out' || session.status === 'failed')
      .find((session) => Boolean(session.sdkThreadId?.trim())) ?? null;
  }

  private buildCodexProjectState(input: {
    codeSessionId: string;
    workspaceRoot: string;
    backendId: string;
    activeThreadId: string;
    task: string;
    sessionId: string;
    status: CodexSdkProjectState['lastRunStatus'];
    structured?: CodexSdkStructuredResponse | null;
    finalResponse?: string;
    hostLaunch?: CodexSdkHostLaunchResult | null;
  }): CodexSdkProjectState {
    const previous = this.codexProjects.get(input.codeSessionId);
    const summary = input.structured?.summary?.trim()
      || input.finalResponse?.trim()
      || previous?.lastCheckpoint
      || 'Codex SDK project thread started.';
    const hostFollowupStatus: CodexSdkProjectState['lastHostFollowupStatus'] = input.hostLaunch?.attempted
      ? input.hostLaunch.success === false ? 'failed' : 'succeeded'
      : 'not_requested';
    return {
      codeSessionId: input.codeSessionId,
      workspaceRoot: input.workspaceRoot,
      backendId: input.backendId,
      activeThreadId: input.activeThreadId,
      projectObjective: previous?.projectObjective || input.task,
      currentPhase: 'active',
      lastCheckpoint: truncateText(summary, 4000),
      lastRunSessionId: input.sessionId,
      lastRunStatus: input.status,
      lastHostFollowupStatus: hostFollowupStatus,
      updatedAt: Date.now(),
      ...(input.structured?.filesChanged.length ? { lastFilesChanged: input.structured.filesChanged.slice(0, 50) } : previous?.lastFilesChanged ? { lastFilesChanged: previous.lastFilesChanged } : {}),
      ...(input.structured?.verification.length ? { lastVerification: input.structured.verification.slice(0, 50) } : previous?.lastVerification ? { lastVerification: previous.lastVerification } : {}),
      ...(input.structured?.localServer.requested ? { lastLocalServer: input.structured.localServer } : previous?.lastLocalServer ? { lastLocalServer: previous.lastLocalServer } : {}),
    };
  }

  private resolveCodexSdkResumeTarget(input: {
    codeSessionId: string;
    backendId: string;
    resumeSessionId?: string;
    resumeThreadId?: string;
    resumeLatest?: boolean;
  }): { target: CodexSdkResumeTarget | null; error?: string } {
    const explicitThreadId = input.resumeThreadId?.trim();
    if (explicitThreadId) {
      return { target: { threadId: explicitThreadId } };
    }

    const explicitSessionId = input.resumeSessionId?.trim();
    if (explicitSessionId) {
      const session = this.findSession(explicitSessionId);
      if (!session) {
        return { target: null, error: `Could not find coding backend session '${explicitSessionId}' to resume.` };
      }
      if (session.codeSessionId !== input.codeSessionId) {
        return { target: null, error: `Coding backend session '${explicitSessionId}' belongs to a different coding workspace.` };
      }
      if (session.backendId !== input.backendId) {
        return { target: null, error: `Coding backend session '${explicitSessionId}' used backend '${session.backendId}', not '${input.backendId}'.` };
      }
      const threadId = session.sdkThreadId?.trim();
      if (!threadId) {
        return { target: null, error: `Coding backend session '${explicitSessionId}' does not have a stored Codex SDK thread ID.` };
      }
      return { target: { threadId, sessionId: session.id } };
    }

    if (input.resumeLatest === true) {
      const project = this.getCodexProjectState(input.codeSessionId);
      if (project?.activeThreadId && project.backendId === input.backendId) {
        return { target: { threadId: project.activeThreadId, sessionId: project.lastRunSessionId } };
      }
      const session = this.findLatestResumableCodexSdkSession({
        codeSessionId: input.codeSessionId,
        backendId: input.backendId,
      });
      if (!session?.sdkThreadId) {
        return { target: null, error: 'No active Codex SDK project thread or recent timed-out/failed SDK run with a stored thread ID was found for this coding workspace.' };
      }
      return { target: { threadId: session.sdkThreadId, sessionId: session.id } };
    }

    return { target: null };
  }

  /** Launch a backend to run a task. Returns when the CLI completes or times out. */
  async run(params: {
    task: string;
    backendId?: string;
    codeSessionId: string;
    workspaceRoot: string;
    requestId?: string;
    resumeSessionId?: string;
    resumeThreadId?: string;
    resumeLatest?: boolean;
  }): Promise<CodingBackendRunResult> {
    const prerequisiteError = this.getRunPrerequisiteError(params);
    if (prerequisiteError) {
      const requestedBackendId = params.backendId?.trim();
      const configured = requestedBackendId
        ? this.config.backends.find((backend) => backend.id === requestedBackendId)
        : undefined;
      const preset = requestedBackendId
        ? CODING_BACKEND_PRESETS.find((candidate) => candidate.id === requestedBackendId)
        : undefined;
      const backendName = configured
        ? this.mergeWithPreset(configured).name
        : preset?.name ?? requestedBackendId ?? 'Unknown';
      return {
        success: false,
        backendId: requestedBackendId || 'unknown',
        backendName,
        task: params.task,
        status: 'failed',
        durationMs: 0,
        output: prerequisiteError,
        terminalTabId: '',
      };
    }

    const resumeRequested = Boolean(params.resumeSessionId?.trim() || params.resumeThreadId?.trim() || params.resumeLatest);
    const latestResumeSession = !params.backendId?.trim() && params.resumeLatest === true
      ? this.findLatestResumableCodexSdkSession({ codeSessionId: params.codeSessionId })
      : null;
    const codexSdkResumeBackendId = !params.backendId?.trim() && resumeRequested
      ? latestResumeSession?.backendId ?? this.findEnabledCodexSdkBackendId()
      : undefined;
    const backend = this.resolveBackend(params.backendId || codexSdkResumeBackendId);
    if (!backend) {
      const available = this.listEnabledBackendIds();
      return {
        success: false,
        backendId: params.backendId || 'unknown',
        backendName: 'Unknown',
        task: params.task,
        status: 'failed',
        durationMs: 0,
        output: `Coding backend '${params.backendId || 'default'}' is not configured. Available: ${available.join(', ') || 'none'}. Add backends in Configuration > Integrations > Coding Assistants.`,
        terminalTabId: '',
      };
    }
    if (!backend.enabled) {
      return {
        success: false,
        backendId: backend.id,
        backendName: backend.name,
        task: params.task,
        status: 'failed',
        durationMs: 0,
        output: `Coding backend '${backend.name}' is disabled. Enable it in Configuration > Integrations > Coding Assistants.`,
        terminalTabId: '',
      };
    }

    if (resumeRequested && resolveBackendAdapterKind(backend) !== 'codex_sdk') {
      return {
        success: false,
        backendId: backend.id,
        backendName: backend.name,
        task: params.task,
        status: 'failed',
        durationMs: 0,
        output: `Coding backend '${backend.name}' cannot resume stored SDK threads. Use the Codex SDK backend for resumeThreadId/resumeLatest.`,
        terminalTabId: '',
      };
    }

    // Check concurrent session limit
    const activeForSession = [...this.activeSessions.values()]
      .filter((s) => s.session.codeSessionId === params.codeSessionId);
    const maxConcurrent = this.config.maxConcurrentSessions ?? 2;
    if (activeForSession.length >= maxConcurrent) {
      return {
        success: false,
        backendId: backend.id,
        backendName: backend.name,
        task: params.task,
        status: 'failed',
        durationMs: 0,
        output: `Maximum concurrent coding backend sessions (${maxConcurrent}) reached for this workspace. Wait for an active session to complete.`,
        terminalTabId: '',
      };
    }

    if (resolveBackendAdapterKind(backend) === 'codex_sdk') {
      return this.runCodexSdkBackend({
        backend,
        task: params.task,
        codeSessionId: params.codeSessionId,
        workspaceRoot: params.workspaceRoot,
        requestId: params.requestId,
        resumeSessionId: params.resumeSessionId ?? latestResumeSession?.id,
        resumeThreadId: params.resumeThreadId,
        resumeLatest: params.resumeLatest,
      });
    }

    const sessionId = `cb-${++this.sessionCounter}-${Date.now()}`;
    const timeoutMs = backend.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const shell = backend.shell || (process.platform === 'win32' ? 'wsl' : 'bash');
    const workspaceInstructions = await readWorkspaceInstructionFile(params.workspaceRoot);
    const task = buildTaskWithWorkspaceInstructions(params.task, workspaceInstructions);
    const assistantResponseCapture = backendSupportsAssistantResponseCapture(backend)
      ? await createAssistantResponseCapture(shell)
      : null;
    const assistantResponseArgs = assistantResponseCapture
      ? `--output-last-message ${shellQuote(assistantResponseCapture.shellPath)}`
      : '';
    const command = buildCommand(backend, task, params.workspaceRoot, { assistantResponseArgs });
    const requestId = params.requestId?.trim() || undefined;
    const runId = requestId || `code-session:${params.codeSessionId}:backend:${sessionId}`;

    log.info({
      backendId: backend.id,
      sessionId,
      task: params.task.slice(0, 100),
      workspaceInstructionFile: workspaceInstructions?.fileName,
    }, 'Launching coding backend');

    // Open terminal
    const { terminalId } = await this.terminalControl.openTerminal({
      codeSessionId: params.codeSessionId,
      shell,
      cwd: params.workspaceRoot,
      name: `[${backend.name}] ${params.task.slice(0, 40)}...`,
    });

    const startedAt = Date.now();
    const session: CodingBackendSession = {
      id: sessionId,
      backendId: backend.id,
      backendName: backend.name,
      codeSessionId: params.codeSessionId,
      terminalId,
      task: params.task,
      status: 'running',
      startedAt,
    };

    return new Promise<CodingBackendRunResult>((resolve) => {
      const complete = async (status: 'succeeded' | 'failed' | 'timed_out', exitCode?: number) => {
        const entry = this.activeSessions.get(sessionId);
        if (!entry) return; // already completed
        if (entry.timeoutHandle) clearTimeout(entry.timeoutHandle);
        entry.unsubscribeOutput();
        entry.unsubscribeExit();
        this.activeSessions.delete(sessionId);

        const durationMs = Date.now() - startedAt;
        session.status = status;
        session.completedAt = Date.now();
        session.exitCode = exitCode;
        session.durationMs = durationMs;

        this.rememberRecentSession(session);

        const cleaned = stripAnsi(entry.outputBuffer).trim();
        const truncated = cleaned.length > MAX_TOOL_OUTPUT_CHARS
          ? cleaned.slice(-MAX_TOOL_OUTPUT_CHARS) + '\n[output truncated]'
          : cleaned;
        let assistantResponse: string | undefined;
        try {
          assistantResponse = await readAssistantResponseCapture(entry.assistantResponseCapture);
        } finally {
          await cleanupAssistantResponseCapture(entry.assistantResponseCapture);
        }
        if (!assistantResponse) {
          assistantResponse = extractAssistantResponseFromOutput(backend.id, cleaned);
        }

        log.info({ backendId: backend.id, sessionId, status, exitCode, durationMs }, 'Coding backend completed');

        this.emitProgress(entry, status === 'succeeded' ? 'completed' : status, session.completedAt, {
          detail: summarizeCompletionDetail(backend.id, status, entry.outputBuffer, entry.command, exitCode),
          ...(typeof exitCode === 'number' ? { exitCode } : {}),
        });

        resolve({
          success: status === 'succeeded',
          sessionId,
          backendId: backend.id,
          backendName: backend.name,
          task: params.task,
          status,
          exitCode,
          durationMs,
          ...(assistantResponse ? { assistantResponse } : {}),
          output: truncated || `(no output captured)`,
          terminalTabId: terminalId,
          codeSessionId: params.codeSessionId,
        });
      };

      const unsubscribeOutput = this.terminalControl.onTerminalOutput(terminalId, (data) => {
        const entry = this.activeSessions.get(sessionId);
        if (!entry) return;
        entry.outputBuffer += data;
        // Cap buffer size
        if (entry.outputBuffer.length > MAX_OUTPUT_BYTES) {
          entry.outputBuffer = entry.outputBuffer.slice(-MAX_OUTPUT_BYTES);
        }
        this.maybeEmitOutputProgress(entry);
      });

      const unsubscribeExit = this.terminalControl.onTerminalExit(terminalId, (exitCode) => {
        void complete(exitCode === 0 ? 'succeeded' : 'failed', exitCode);
      });

      const timeoutHandle = setTimeout(() => {
        log.warn({ backendId: backend.id, sessionId, timeoutMs }, 'Coding backend timed out');
        this.terminalControl.closeTerminal(terminalId);
        void complete('timed_out');
      }, timeoutMs);

      this.activeSessions.set(sessionId, {
        session,
        runId,
        ...(requestId ? { requestId } : {}),
        command,
        outputBuffer: '',
        assistantResponseCapture,
        progressSequence: 0,
        unsubscribeOutput,
        unsubscribeExit,
        timeoutHandle,
        resolve,
      });
      this.persistSessionsSnapshot();

      const entry = this.activeSessions.get(sessionId);
      if (entry) {
        this.emitProgress(entry, 'started', startedAt, {
          detail: truncateText(params.task.trim(), MAX_PROGRESS_DETAIL_CHARS),
        });
      }

      // Write the command to the terminal and close one-shot shells afterwards.
      this.terminalControl.writeTerminalInput(terminalId, buildTerminalInput(backend, command));
    });
  }

  private async startCodexSdkLocalServerIfRequested(params: {
    entry: ActiveCodingBackendSession;
    structured: CodexSdkStructuredResponse | null;
    codeSessionId: string;
    workspaceRoot: string;
  }): Promise<CodexSdkHostLaunchResult | null> {
    const localServer = params.structured?.localServer;
    if (!localServer?.requested) return null;

    const verifyUrl = localServer.healthUrl?.trim() || localServer.url?.trim();
    if (!verifyUrl || !isLoopbackHttpUrl(verifyUrl)) {
      return {
        attempted: true,
        success: false,
        message: 'Skipped host start because the SDK did not provide a loopback HTTP URL to verify.',
      };
    }

    this.emitProgress(params.entry, 'progress', Date.now(), {
      detail: 'Checking whether the local app is already reachable.',
    });
    const alreadyRunning = await fetchLoopbackHttp(verifyUrl, 1_500);
    if (alreadyRunning.ok) {
      return {
        attempted: true,
        success: true,
        url: localServer.url,
        healthUrl: verifyUrl,
        message: `Local server was already reachable with HTTP ${alreadyRunning.status ?? 'ok'}.`,
      };
    }

    const command = normalizeLocalServerStartCommand(localServer.startCommand);
    if (!command) {
      return {
        attempted: true,
        success: false,
        url: localServer.url,
        healthUrl: verifyUrl,
        message: 'The SDK requested a local server, but did not provide a usable one-line start command.',
      };
    }

    this.emitProgress(params.entry, 'progress', Date.now(), {
      detail: 'Starting the local app in a Guardian-owned terminal.',
    });
    const shell = process.platform === 'win32' ? 'powershell' : 'bash';
    let terminalId: string;
    try {
      const opened = await this.terminalControl.openTerminal({
        codeSessionId: params.codeSessionId,
        shell,
        cwd: params.workspaceRoot,
        name: 'Local app server',
        cols: 120,
        rows: 30,
      });
      terminalId = opened.terminalId;
    } catch (error) {
      return {
        attempted: true,
        success: false,
        url: localServer.url,
        healthUrl: verifyUrl,
        message: `Could not open a host terminal for the local server: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
    try {
      this.terminalControl.writeTerminalInput(terminalId, `${command}\n`);
    } catch (error) {
      this.terminalControl.closeTerminal(terminalId);
      return {
        attempted: true,
        success: false,
        terminalId,
        url: localServer.url,
        healthUrl: verifyUrl,
        message: `Could not write the local server start command: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    const verified = await waitForLoopbackHttpOk(verifyUrl);
    if (verified.ok) {
      this.emitProgress(params.entry, 'progress', Date.now(), {
        detail: 'Verified the local app over HTTP.',
      });
      return {
        attempted: true,
        success: true,
        terminalId,
        url: localServer.url,
        healthUrl: verifyUrl,
        message: `Started in a Guardian terminal and verified HTTP ${verified.status ?? 'ok'}.`,
      };
    }

    this.terminalControl.closeTerminal(terminalId);
    return {
      attempted: true,
      success: false,
      terminalId,
      url: localServer.url,
      healthUrl: verifyUrl,
      message: `Started the command, but HTTP verification failed: ${verified.error ?? `status ${verified.status ?? 'unknown'}`}.`,
    };
  }

  private async runCodexSdkBackend(params: {
    backend: CodingBackendConfig;
    task: string;
    codeSessionId: string;
    workspaceRoot: string;
    requestId?: string;
    resumeSessionId?: string;
    resumeThreadId?: string;
    resumeLatest?: boolean;
  }): Promise<CodingBackendRunResult> {
    const { backend } = params;
    const existingProjectState = this.getCodexProjectState(params.codeSessionId);
    const resumeRequested = Boolean(params.resumeSessionId?.trim() || params.resumeThreadId?.trim() || params.resumeLatest);
    const resumeResolution = this.resolveCodexSdkResumeTarget({
      codeSessionId: params.codeSessionId,
      backendId: backend.id,
      resumeSessionId: params.resumeSessionId,
      resumeThreadId: params.resumeThreadId,
      resumeLatest: params.resumeLatest,
    });
    if (resumeRequested && !resumeResolution.target) {
      return {
        success: false,
        backendId: backend.id,
        backendName: backend.name,
        task: params.task,
        status: 'failed',
        durationMs: 0,
        output: resumeResolution.error ?? 'Could not resolve the Codex SDK thread to resume.',
        terminalTabId: '',
        codeSessionId: params.codeSessionId,
      };
    }
    const activeProjectTarget = !resumeRequested
      && existingProjectState?.backendId === backend.id
      && existingProjectState.activeThreadId
      ? { threadId: existingProjectState.activeThreadId, sessionId: existingProjectState.lastRunSessionId }
      : null;
    const resumeTarget = resumeResolution.target ?? activeProjectTarget;
    const sessionId = `cb-${++this.sessionCounter}-${Date.now()}`;
    const timeoutMs = backend.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const requestId = params.requestId?.trim() || undefined;
    const runId = requestId || `code-session:${params.codeSessionId}:backend:${sessionId}`;
    const terminalId = `sdk:${sessionId}`;
    const startedAt = Date.now();
    const session: CodingBackendSession = {
      id: sessionId,
      backendId: backend.id,
      backendName: backend.name,
      codeSessionId: params.codeSessionId,
      terminalId,
      task: params.task,
      status: 'running',
      startedAt,
      ...(resumeTarget ? { sdkThreadId: resumeTarget.threadId } : {}),
      ...(resumeTarget?.sessionId ? { resumedFromSessionId: resumeTarget.sessionId } : {}),
      ...(resumeTarget ? { resumedFromThreadId: resumeTarget.threadId } : {}),
    };
    const entry: ActiveCodingBackendSession = {
      session,
      runId,
      ...(requestId ? { requestId } : {}),
      command: 'codex-sdk',
      outputBuffer: '',
      progressSequence: 0,
      unsubscribeOutput: () => {},
      unsubscribeExit: () => {},
    };
    this.activeSessions.set(sessionId, entry);
    this.persistSessionsSnapshot();
    this.emitProgress(entry, 'started', startedAt, {
      detail: truncateText(params.task.trim(), MAX_PROGRESS_DETAIL_CHARS),
    });

    const abortController = new AbortController();
    let sdkTimedOut = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        sdkTimedOut = true;
        log.warn({ backendId: backend.id, sessionId, timeoutMs }, 'Codex SDK backend timed out');
        abortController.abort();
        reject(new Error('Codex SDK did not finish before the timeout.'));
      }, timeoutMs);
    });
    entry.timeoutHandle = timeoutHandle;

    let finalResponse = '';
    let sawTurnCompleted = false;
    let threadId: string | undefined;
    const recentSdkProgress: string[] = [];
    try {
      const sdkRunPromise = (async () => {
        const workspaceInstructions = await readWorkspaceInstructionFile(params.workspaceRoot);
        const task = buildCodexSdkDelegatedTask(
          buildTaskWithWorkspaceInstructions(params.task, workspaceInstructions),
          {
            resumed: Boolean(resumeTarget),
            projectState: existingProjectState,
          },
        );
        const { Codex } = await import('@openai/codex-sdk');
        const codex = new Codex({
          ...(backend.env ? { env: runtimeEnvironment(backend.env) } : {}),
        });
        const threadOptions = {
          workingDirectory: params.workspaceRoot,
          skipGitRepoCheck: true,
          sandboxMode: 'workspace-write',
          approvalPolicy: 'never',
        } as const;
        const thread = resumeTarget
          ? codex.resumeThread(resumeTarget.threadId, threadOptions)
          : codex.startThread(threadOptions);
        threadId = resumeTarget?.threadId ?? threadId;
        if (threadId) {
          session.sdkThreadId = threadId;
          this.rememberCodexProjectState(this.buildCodexProjectState({
            codeSessionId: params.codeSessionId,
            workspaceRoot: params.workspaceRoot,
            backendId: backend.id,
            activeThreadId: threadId,
            task: params.task,
            sessionId,
            status: 'running',
          }));
          this.persistSessionsSnapshot();
        }
        const { events } = await thread.runStreamed(task, {
          signal: abortController.signal,
          outputSchema: CODEX_SDK_RESULT_SCHEMA,
        });

        for await (const event of events) {
          threadId = getCodexSdkThreadId(event) ?? threadId;
          if (threadId && session.sdkThreadId !== threadId) {
            session.sdkThreadId = threadId;
            this.rememberCodexProjectState(this.buildCodexProjectState({
              codeSessionId: params.codeSessionId,
              workspaceRoot: params.workspaceRoot,
              backendId: backend.id,
              activeThreadId: threadId,
              task: params.task,
              sessionId,
              status: 'running',
            }));
            this.persistSessionsSnapshot();
          }
          const detail = summarizeCodexSdkEvent(event);
          if (detail) {
            rememberCodexSdkProgress(recentSdkProgress, detail);
            if (detail !== entry.lastProgressDetail) {
              entry.lastProgressDetail = detail;
              this.emitProgress(entry, 'progress', Date.now(), { detail });
            }
          }
          finalResponse = getCodexSdkAgentMessage(event) ?? finalResponse;
          if (isCodexSdkTurnCompleted(event)) sawTurnCompleted = true;
        }
        threadId = thread.id ?? threadId;
        if (threadId && session.sdkThreadId !== threadId) {
          session.sdkThreadId = threadId;
          this.rememberCodexProjectState(this.buildCodexProjectState({
            codeSessionId: params.codeSessionId,
            workspaceRoot: params.workspaceRoot,
            backendId: backend.id,
            activeThreadId: threadId,
            task: params.task,
            sessionId,
            status: 'running',
          }));
          this.persistSessionsSnapshot();
        }
      })();

      await Promise.race([sdkRunPromise, timeoutPromise]);

      const structured = parseCodexSdkStructuredResponse(finalResponse);
      const hostLaunch = await this.startCodexSdkLocalServerIfRequested({
        entry,
        structured,
        codeSessionId: params.codeSessionId,
        workspaceRoot: params.workspaceRoot,
      });
      const durationMs = Date.now() - startedAt;
      const succeeded = !(structured?.status === 'failed' || structured?.status === 'blocked');
      const output = formatCodexSdkSuccessOutput(finalResponse, structured, hostLaunch, threadId);
      session.status = succeeded ? 'succeeded' : 'failed';
      session.completedAt = Date.now();
      session.exitCode = succeeded ? 0 : 1;
      session.durationMs = durationMs;
      session.resumable = !succeeded && Boolean(threadId);
      const codexProject = threadId
        ? this.rememberCodexProjectState(this.buildCodexProjectState({
            codeSessionId: params.codeSessionId,
            workspaceRoot: params.workspaceRoot,
            backendId: backend.id,
            activeThreadId: threadId,
            task: params.task,
            sessionId,
            status: session.status,
            structured,
            finalResponse,
            hostLaunch,
          }))
        : undefined;
      this.rememberRecentSession(session);
      this.activeSessions.delete(sessionId);
      if (timeoutHandle) clearTimeout(timeoutHandle);
      this.emitProgress(entry, succeeded ? 'completed' : 'failed', session.completedAt, {
        detail: hostLaunch?.success
          ? 'Codex SDK completed and Guardian verified the local app.'
          : finalResponse
            ? 'Codex SDK completed.'
            : 'Codex SDK completed without a final message.',
        exitCode: session.exitCode,
      });

      return {
        success: succeeded,
        sessionId,
        backendId: backend.id,
        backendName: backend.name,
        task: params.task,
        status: succeeded ? 'succeeded' : 'failed',
        exitCode: session.exitCode,
        durationMs,
        ...(output ? { assistantResponse: output } : {}),
        output,
        terminalTabId: hostLaunch?.terminalId ?? terminalId,
        codeSessionId: params.codeSessionId,
        ...(threadId ? { sdkThreadId: threadId } : {}),
        ...(resumeTarget?.sessionId ? { resumedFromSessionId: resumeTarget.sessionId } : {}),
        ...(resumeTarget ? { resumedFromThreadId: resumeTarget.threadId } : {}),
        resumable: !succeeded && Boolean(threadId),
        ...(codexProject ? { codexProject } : {}),
      };
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const timedOut = sdkTimedOut || abortController.signal.aborted;
      if (!timedOut && sawTurnCompleted && isCodexSdkCleanupParseNoise(error)) {
        const structured = parseCodexSdkStructuredResponse(finalResponse);
        const hostLaunch = await this.startCodexSdkLocalServerIfRequested({
          entry,
          structured,
          codeSessionId: params.codeSessionId,
          workspaceRoot: params.workspaceRoot,
        });
        const cleanupDurationMs = Date.now() - startedAt;
        const succeeded = !(structured?.status === 'failed' || structured?.status === 'blocked');
        const output = formatCodexSdkSuccessOutput(
          finalResponse || 'Codex SDK completed; ignored Windows cleanup output.',
          structured,
          hostLaunch,
          threadId,
        );
        session.status = succeeded ? 'succeeded' : 'failed';
        session.completedAt = Date.now();
        session.exitCode = succeeded ? 0 : 1;
        session.durationMs = cleanupDurationMs;
        session.resumable = !succeeded && Boolean(threadId);
        const codexProject = threadId
          ? this.rememberCodexProjectState(this.buildCodexProjectState({
              codeSessionId: params.codeSessionId,
              workspaceRoot: params.workspaceRoot,
              backendId: backend.id,
              activeThreadId: threadId,
              task: params.task,
              sessionId,
              status: session.status,
              structured,
              finalResponse,
              hostLaunch,
            }))
          : undefined;
        this.rememberRecentSession(session);
        this.activeSessions.delete(sessionId);
        if (timeoutHandle) clearTimeout(timeoutHandle);
        this.emitProgress(entry, succeeded ? 'completed' : 'failed', session.completedAt, {
          detail: succeeded
            ? 'Codex SDK completed; ignored Windows cleanup output.'
            : 'Codex SDK completed but host verification failed.',
          exitCode: session.exitCode,
        });
        return {
          success: succeeded,
          sessionId,
          backendId: backend.id,
          backendName: backend.name,
          task: params.task,
          status: succeeded ? 'succeeded' : 'failed',
          exitCode: session.exitCode,
          durationMs: cleanupDurationMs,
          ...(output ? { assistantResponse: output } : {}),
          output,
          terminalTabId: hostLaunch?.terminalId ?? terminalId,
          codeSessionId: params.codeSessionId,
          ...(threadId ? { sdkThreadId: threadId } : {}),
          ...(resumeTarget?.sessionId ? { resumedFromSessionId: resumeTarget.sessionId } : {}),
          ...(resumeTarget ? { resumedFromThreadId: resumeTarget.threadId } : {}),
          resumable: !succeeded && Boolean(threadId),
          ...(codexProject ? { codexProject } : {}),
        };
      }
      session.status = timedOut ? 'timed_out' : 'failed';
      session.completedAt = Date.now();
      session.durationMs = durationMs;
      session.sdkThreadId = threadId ?? session.sdkThreadId;
      session.resumable = Boolean(threadId);
      const codexProject = threadId
        ? this.rememberCodexProjectState(this.buildCodexProjectState({
            codeSessionId: params.codeSessionId,
            workspaceRoot: params.workspaceRoot,
            backendId: backend.id,
            activeThreadId: threadId,
            task: params.task,
            sessionId,
            status: session.status,
            finalResponse,
          }))
        : undefined;
      this.rememberRecentSession(session);
      this.activeSessions.delete(sessionId);
      if (timeoutHandle) clearTimeout(timeoutHandle);
      const message = timedOut
        ? 'Codex SDK did not finish before the timeout.'
        : error instanceof Error
          ? error.message
          : String(error);
      const output = formatCodexSdkFailureOutput({
        message,
        threadId,
        finalResponse,
        recentProgress: recentSdkProgress,
        resumable: Boolean(threadId),
      });
      this.emitProgress(entry, timedOut ? 'timed_out' : 'failed', session.completedAt, {
        detail: truncateText(message, MAX_PROGRESS_DETAIL_CHARS),
      });
      return {
        success: false,
        sessionId,
        backendId: backend.id,
        backendName: backend.name,
        task: params.task,
        status: timedOut ? 'timed_out' : 'failed',
        durationMs,
        output,
        terminalTabId: terminalId,
        codeSessionId: params.codeSessionId,
        ...(threadId ? { sdkThreadId: threadId } : {}),
        ...(resumeTarget?.sessionId ? { resumedFromSessionId: resumeTarget.sessionId } : {}),
        ...(resumeTarget ? { resumedFromThreadId: resumeTarget.threadId } : {}),
        resumable: Boolean(threadId),
        ...(codexProject ? { codexProject } : {}),
      };
    }
  }

  /** Get status of active and recent backend sessions. */
  getStatus(sessionId?: string): CodingBackendSession[] {
    const active = [...this.activeSessions.values()].map((entry) => entry.session);
    const all = [...active, ...this.recentSessions];
    if (sessionId) {
      return all.filter((s) => s.id === sessionId);
    }
    return all.slice(0, 20);
  }

  getCodexProjectStatus(codeSessionId?: string): CodexSdkProjectState[] {
    this.loadRecentSessions();
    const states = [...this.codexProjects.values()]
      .filter((state) => !codeSessionId || state.codeSessionId === codeSessionId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    return states.slice(0, 20).map((state) => ({ ...state }));
  }

  /** Update config at runtime (hot-reload from UI). */
  updateConfig(config: CodingBackendsConfig): void {
    this.config = config;
  }

  /** Clean up all active sessions on shutdown. */
  dispose(): void {
    const nowMs = Date.now();
    for (const [, entry] of this.activeSessions) {
      if (entry.timeoutHandle) clearTimeout(entry.timeoutHandle);
      entry.session.status = 'failed';
      entry.session.completedAt = entry.session.completedAt ?? nowMs;
      entry.session.durationMs = entry.session.durationMs ?? Math.max(0, nowMs - entry.session.startedAt);
      entry.session.resumable = Boolean(entry.session.sdkThreadId);
      entry.unsubscribeOutput();
      entry.unsubscribeExit();
      this.terminalControl.closeTerminal(entry.session.terminalId);
    }
    this.persistSessionsSnapshot();
    this.activeSessions.clear();
    this.progressListeners.clear();
  }
}
