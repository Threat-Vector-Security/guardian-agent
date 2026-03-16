import { existsSync, statSync } from 'node:fs';
import { dirname, isAbsolute, resolve, win32 as pathWin32 } from 'node:path';
import type {
  AutomationAuthoringCompilation,
  CompiledAutomationWorkflowUpsert,
} from './automation-authoring.js';

type PreflightDecision = 'allow' | 'deny' | 'require_approval';

interface ToolPreflightFix {
  type: 'tool_policy' | 'path' | 'command' | 'domain';
  value: string;
  description: string;
}

interface ToolPreflightResult {
  name: string;
  found: boolean;
  decision: PreflightDecision;
  reason: string;
  fixes: ToolPreflightFix[];
}

interface ToolPreflightRequest {
  name: string;
  args?: Record<string, unknown>;
}

interface OutputValidationTarget {
  path: string;
  autoCreatesParent: boolean;
}

interface AutomationValidationIssue {
  severity: 'error' | 'warning';
  message: string;
  fixes?: ToolPreflightFix[];
}

export interface AutomationValidationResult {
  ok: boolean;
  issues: AutomationValidationIssue[];
}

export function validateAutomationCompilation(
  compilation: AutomationAuthoringCompilation,
  requestText: string,
  preflightTools: (requests: ToolPreflightRequest[]) => ToolPreflightResult[],
  options?: { workspaceRoot?: string; allowedPaths?: string[] },
): AutomationValidationResult {
  const workspaceRoot = options?.workspaceRoot?.trim() || process.cwd();
  const allowedPaths = (options?.allowedPaths?.filter((value) => value.trim()) ?? [workspaceRoot])
    .map((value) => resolveWorkspacePath(workspaceRoot, value));
  const issues: AutomationValidationIssue[] = [];
  const validationPlan = compilation.shape === 'workflow' && compilation.workflowUpsert
    ? buildWorkflowValidationPlan(compilation.workflowUpsert)
    : buildScheduledAgentValidationPlan(requestText);
  const normalizedRequests = validationPlan.requests.map((request) => normalizeRequestPathsForWorkspace(request, workspaceRoot));

  for (const inputPath of validationPlan.inputPaths) {
    const resolvedPath = resolveWorkspacePath(workspaceRoot, inputPath);
    if (!existsSync(resolvedPath)) {
      issues.push({
        severity: 'error',
        message: `Required input '${inputPath}' does not exist yet.`,
      });
    }
  }

  for (const outputTarget of validationPlan.outputTargets) {
    const outputPath = outputTarget.path;
    const resolvedOutputPath = resolveWorkspacePath(workspaceRoot, outputPath);
    const parentDir = dirnameForAutomationPath(resolvedOutputPath);
    if (!existsSync(parentDir)) {
      if (outputTarget.autoCreatesParent) {
        issues.push({
          severity: 'warning',
          message: `Output directory for '${outputPath}' does not exist yet, but it will be created automatically at runtime.`,
        });
        continue;
      }
      issues.push({
        severity: 'error',
        message: `Output directory for '${outputPath}' does not exist yet.`,
      });
      continue;
    }
    try {
      if (!statSync(parentDir).isDirectory()) {
        issues.push({
          severity: 'error',
          message: `Output parent '${parentDir}' is not a directory.`,
        });
      }
    } catch {
      issues.push({
        severity: 'error',
        message: `Output directory for '${outputPath}' could not be inspected.`,
      });
    }
  }

  const preflightResults = normalizedRequests.length > 0
    ? preflightTools(normalizedRequests)
    : [];
  for (const [index, result] of preflightResults.entries()) {
    const request = normalizedRequests[index];
    if (!result.found) {
      issues.push({
        severity: 'error',
        message: `Validation tool '${result.name}' is unavailable.`,
      });
      continue;
    }

    if (result.decision === 'deny') {
      issues.push({
        severity: 'error',
        message: `${result.name}: ${result.reason}`,
        fixes: result.fixes,
      });
      continue;
    }

    if (result.decision === 'require_approval') {
      if (compilation.shape === 'scheduled_agent') {
        if (request && isBoundedPathWriteApproval(request, allowedPaths, workspaceRoot)) {
          issues.push({
            severity: 'warning',
            message: `${result.name}: ${result.reason}. This bounded allowed-path write is covered by approving the saved scheduled assistant task.`,
            fixes: result.fixes.filter((fix) => !(fix.type === 'tool_policy' && fix.value === result.name)),
          });
          continue;
        }
        issues.push({
          severity: 'error',
          message: `${result.name}: ${result.reason}. Scheduled assistant tasks must be execution-ready and cannot depend on future runtime approvals.`,
          fixes: result.fixes,
        });
      } else {
        issues.push({
          severity: 'warning',
          message: `${result.name}: ${result.reason}. This is covered by approving the saved workflow definition.`,
          fixes: result.fixes,
        });
      }
    }
  }

  return {
    ok: !issues.some((issue) => issue.severity === 'error'),
    issues,
  };
}

export function formatAutomationValidationFailure(
  compilation: AutomationAuthoringCompilation,
  validation: AutomationValidationResult,
): string {
  const lines = [
    `I couldn't create '${compilation.name}' yet because it is not execution-ready under the current policy.`,
    '',
    'Blockers:',
  ];

  for (const issue of validation.issues.filter((entry) => entry.severity === 'error')) {
    lines.push(`- ${issue.message}`);
  }

  const suggestedFixes = uniqueFixes(validation.issues.flatMap((issue) => issue.fixes ?? []));
  if (suggestedFixes.length > 0) {
    lines.push('');
    lines.push('Suggested fixes:');
    for (const fix of suggestedFixes) {
      lines.push(`- ${fix.description}`);
    }
  }

  if (compilation.shape === 'scheduled_agent') {
    lines.push('');
    lines.push('If you want the save-time approval to authorize fixed tool steps, use a deterministic workflow instead of a scheduled assistant task.');
  }

  return lines.join('\n');
}

function buildWorkflowValidationPlan(workflow: CompiledAutomationWorkflowUpsert): {
  requests: ToolPreflightRequest[];
  inputPaths: string[];
  outputTargets: OutputValidationTarget[];
} {
  const requests: ToolPreflightRequest[] = [];
  const inputPaths = new Set<string>();
  const outputTargets = new Map<string, OutputValidationTarget>();

  for (const step of workflow.steps ?? []) {
    if ((step.type ?? 'tool') !== 'tool' || !step.toolName) continue;
    const args = isRecord(step.args) ? step.args : {};
    requests.push({ name: step.toolName, args });
    collectPathsFromArgs(step.toolName, args, inputPaths, outputTargets);
  }

  return {
    requests,
    inputPaths: [...inputPaths],
    outputTargets: [...outputTargets.values()],
  };
}

function buildScheduledAgentValidationPlan(requestText: string): {
  requests: ToolPreflightRequest[];
  inputPaths: string[];
  outputTargets: OutputValidationTarget[];
} {
  const requests: ToolPreflightRequest[] = [];
  const inputPaths = new Set<string>();
  const outputTargets = new Map<string, OutputValidationTarget>();
  const text = requestText.trim();
  const lower = text.toLowerCase();
  const pathMentions = extractExplicitPathMentions(text);

  for (const mention of pathMentions) {
    if (mention.kind === 'input') {
      inputPaths.add(mention.path);
      requests.push({ name: 'fs_read', args: { path: mention.path } });
      continue;
    }
    registerOutputTarget(outputTargets, mention.path, { autoCreatesParent: true });
    requests.push({ name: 'fs_write', args: { path: mention.path, content: 'validation probe' } });
  }

  if (/\b(website|public presence|web search|public web|online|recent stories|news|web)\b/i.test(lower)) {
    requests.push({ name: 'web_search', args: { query: 'automation validation probe' } });
  }

  if (/\b(gmail|email|inbox|messages?)\b/i.test(lower) && /\b(check|review|summari[sz]e|list|read|scan|triage)\b/i.test(lower)) {
    requests.push({
      name: 'gws',
      args: {
        service: 'gmail',
        resource: 'users messages',
        method: 'list',
        params: { userId: 'me', maxResults: 1 },
      },
    });
  }

  if (/\b(draft|drafts|reply|replies)\b/i.test(lower)) {
    requests.push({
      name: 'gmail_draft',
      args: {
        to: 'validation@example.com',
        subject: 'Validation draft',
        body: 'Validation draft',
      },
    });
  }

  for (const url of extractExplicitUrls(text)) {
    requests.push({ name: 'web_fetch', args: { url } });
  }

  return {
    requests: dedupeRequests(requests),
    inputPaths: [...inputPaths],
    outputTargets: [...outputTargets.values()],
  };
}

function collectPathsFromArgs(
  toolName: string,
  args: Record<string, unknown>,
  inputPaths: Set<string>,
  outputTargets: Map<string, OutputValidationTarget>,
): void {
  const pathKeys = ['path', 'filePath', 'targetPath', 'workspacePath', 'csvPath', 'outputPath'];
  const autoCreatesParent = toolAutoCreatesParentDirectory(toolName, args);
  for (const key of pathKeys) {
    const value = args[key];
    if (typeof value !== 'string' || !value.trim()) continue;
    const trimmed = value.trim();
    if (key === 'outputPath' || /write|draft|send|save|mkdir/i.test(toolName)) {
      registerOutputTarget(outputTargets, trimmed, { autoCreatesParent });
    } else {
      inputPaths.add(trimmed);
    }
  }
}

function registerOutputTarget(
  targets: Map<string, OutputValidationTarget>,
  path: string,
  input: { autoCreatesParent: boolean },
): void {
  const existing = targets.get(path);
  if (!existing) {
    targets.set(path, { path, autoCreatesParent: input.autoCreatesParent });
    return;
  }
  if (input.autoCreatesParent && !existing.autoCreatesParent) {
    targets.set(path, { ...existing, autoCreatesParent: true });
  }
}

function extractExplicitPathMentions(text: string): Array<{ path: string; kind: 'input' | 'output' }> {
  const mentions: Array<{ path: string; kind: 'input' | 'output' }> = [];
  const pattern = /(`([^`]+)`)|(?<![A-Za-z0-9])((?:\.{1,2}[\\/]|[A-Za-z]:[\\/])[^"',;\n\r]+)/g;
  for (const match of text.matchAll(pattern)) {
    const path = (match[2] || match[3] || '')
      .trim()
      .replace(/^(\.{1,2}[\\/])\s+/, '$1')
      .replace(/^([A-Za-z]:[\\/])\s+/, '$1');
    const normalizedPath = normalizeMentionedPath(path);
    if (!normalizedPath) continue;
    const matchIndex = match.index ?? 0;
    const context = text.slice(Math.max(0, matchIndex - 48), matchIndex).toLowerCase();
    const kind = /\b(write|writes|save|saves|create|creates|output|summary|report|results?)\b/.test(context)
      ? 'output'
      : 'input';
    mentions.push({ path: normalizedPath, kind });
  }
  return dedupePathMentions(mentions);
}

function extractExplicitUrls(text: string): string[] {
  const urls = new Set<string>();
  const pattern = /\bhttps?:\/\/[^\s"',;]+/gi;
  for (const match of text.matchAll(pattern)) {
    const url = match[0]?.trim();
    if (url) urls.add(url);
  }
  return [...urls];
}

function dedupeRequests(requests: ToolPreflightRequest[]): ToolPreflightRequest[] {
  const seen = new Set<string>();
  const deduped: ToolPreflightRequest[] = [];
  for (const request of requests) {
    const key = JSON.stringify({ name: request.name, args: request.args ?? {} });
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(request);
  }
  return deduped;
}

function dedupePathMentions(
  mentions: Array<{ path: string; kind: 'input' | 'output' }>,
): Array<{ path: string; kind: 'input' | 'output' }> {
  const seen = new Set<string>();
  const deduped: Array<{ path: string; kind: 'input' | 'output' }> = [];
  for (const mention of mentions) {
    const key = `${mention.kind}:${mention.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(mention);
  }
  return deduped;
}

function uniqueFixes(fixes: ToolPreflightFix[]): ToolPreflightFix[] {
  const seen = new Set<string>();
  const deduped: ToolPreflightFix[] = [];
  for (const fix of fixes) {
    const key = `${fix.type}:${fix.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(fix);
  }
  return deduped;
}

function resolveWorkspacePath(workspaceRoot: string, candidate: string): string {
  if (isWindowsAbsolutePath(candidate)) {
    return candidate.replaceAll('/', '\\');
  }
  return isAbsolute(candidate) ? resolve(candidate) : resolve(workspaceRoot, candidate);
}

function dirnameForAutomationPath(candidate: string): string {
  if (isWindowsAbsolutePath(candidate)) {
    return pathWin32.dirname(candidate.replaceAll('/', '\\'));
  }
  return dirname(candidate);
}

function toolAutoCreatesParentDirectory(toolName: string, args: Record<string, unknown>): boolean {
  const normalized = toolName.trim().toLowerCase();
  if (normalized === 'fs_write' || normalized === 'doc_create') {
    return true;
  }
  if (normalized === 'fs_mkdir') {
    return args.recursive !== false;
  }
  return false;
}

function isBoundedPathWriteApproval(
  request: ToolPreflightRequest,
  allowedRoots: string[],
  workspaceRoot: string,
): boolean {
  if (request.name !== 'fs_write' && request.name !== 'fs_mkdir') {
    return false;
  }
  const targetPath = typeof request.args?.path === 'string'
    ? request.args.path
    : typeof request.args?.outputPath === 'string'
      ? request.args.outputPath
      : null;
  if (!targetPath?.trim()) return false;
  const resolvedTarget = resolveWorkspacePath(workspaceRoot, targetPath.trim());
  return allowedRoots.some((resolvedRoot) => (
    resolvedTarget === resolvedRoot
    || resolvedTarget.startsWith(`${resolvedRoot}/`)
    || resolvedTarget.startsWith(`${resolvedRoot}\\`)
  ));
}

function isWindowsAbsolutePath(candidate: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(candidate);
}

function normalizeMentionedPath(path: string): string {
  const normalized = path
    .replace(/\s+([\\/])/g, '$1')
    .replace(/([\\/])\s+/g, '$1')
    .replace(/([A-Za-z0-9._-])\s{2,}([A-Za-z0-9._-])/g, '$1$2')
    .replace(/\s+\b(?:and|then|using|with|before|after|plus)\b[\s\S]*$/i, '')
    .replace(/[.,;!?]+$/g, '')
    .trim();
  if (isWindowsAbsolutePath(normalized)) {
    return normalized.replace(/[\\/]{2,}/g, '\\');
  }
  return normalized;
}

function normalizeRequestPathsForWorkspace(
  request: ToolPreflightRequest,
  workspaceRoot: string,
): ToolPreflightRequest {
  if (!request.args) return request;
  const pathKeys = ['path', 'filePath', 'targetPath', 'workspacePath', 'csvPath', 'outputPath'];
  let changed = false;
  const args: Record<string, unknown> = { ...request.args };
  for (const key of pathKeys) {
    const value = args[key];
    if (typeof value !== 'string' || !value.trim()) continue;
    const normalized = resolveWorkspacePath(workspaceRoot, value.trim());
    if (normalized !== value) {
      args[key] = normalized;
      changed = true;
    }
  }
  return changed ? { ...request, args } : request;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
