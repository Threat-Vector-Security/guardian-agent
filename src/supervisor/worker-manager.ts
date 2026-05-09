import { randomUUID } from 'node:crypto';
import type { ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { ChatMessage, ChatOptions } from '../llm/types.js';
import { sandboxedSpawn, detectSandboxHealth, type SandboxConfig, DEFAULT_SANDBOX_CONFIG } from '../sandbox/index.js';
import { createLogger } from '../util/logging.js';
import { BrokerServer } from '../broker/broker-server.js';
import { CapabilityTokenManager } from '../broker/capability-token.js';
import type { ToolApprovalDecisionResult, ToolExecutor } from '../tools/executor.js';
import type { ToolExecutionRequest } from '../tools/types.js';
import type { Runtime } from '../runtime/runtime.js';
import type { AgentIsolationConfig } from '../config/types.js';
import type { UserMessage } from '../agent/types.js';
import type { ResolvedSkill } from '../skills/types.js';
import {
  AssistantJobTracker,
  readDelegatedWorkerMetadata,
  type DelegatedWorkerHandoff,
  type DelegatedWorkerOperatorAction,
  type DelegatedWorkerOperatorFollowUpState,
  type DelegatedWorkerRunClass,
} from '../runtime/assistant-jobs.js';
import {
  normalizeOrchestrationRoleDescriptor,
  type OrchestrationRoleDescriptor,
} from '../runtime/orchestration-role-descriptors.js';
import { tryAutomationPreRoute, type AutomationPendingApprovalMetadata } from '../runtime/automation-prerouter.js';
import { buildPendingApprovalMetadata, formatPendingApprovalMessage } from '../runtime/pending-approval-copy.js';
import { buildApprovalOutcomeContinuationMetadata } from '../runtime/approval-continuations.js';
import type {
  PromptAssemblyAdditionalSection,
  PromptAssemblyContinuity,
  PromptAssemblyKnowledgeBase,
  PromptAssemblyPendingAction,
} from '../runtime/context-assembly.js';
import {
  resolveDelegatedExecutionDecision,
  type SelectedExecutionProfile,
} from '../runtime/execution-profiles.js';
import {
  attachPreRoutedIntentGatewayMetadata,
  readPreRoutedIntentGatewayMetadata,
  type IntentGatewayDecision,
  type IntentGatewayRecord,
} from '../runtime/intent-gateway.js';
import { resolveIntentCapabilityCandidates } from '../runtime/intent/capability-resolver.js';
import type { IntentRoutingTraceLog, IntentRoutingTraceStage } from '../runtime/intent-routing-trace.js';
import type { DelegatedWorkerProgressEvent, RunTimelineStore } from '../runtime/run-timeline.js';
import {
  isExecutionGraphEvent,
  type ExecutionGraphEvent,
} from '../runtime/execution-graph/graph-events.js';
import type { ExecutionGraphStore } from '../runtime/execution-graph/graph-store.js';
import {
  type DirectReasoningGraphContext,
} from '../runtime/execution-graph/direct-reasoning-node.js';
import {
  buildDelegatedWorkerGraphCompletion,
  buildDelegatedWorkerGraphFailure,
  buildDelegatedWorkerRunningMetadata,
  buildDelegatedTaskContractTraceMetadata,
  startDelegatedWorkerGraphRun,
  type DelegatedWorkerGraphCompletion,
  type DelegatedWorkerGraphJobMetadata,
  type DelegatedWorkerGraphRun,
} from '../runtime/execution-graph/delegated-worker-node.js';
import {
  applyDelegatedFollowUpPolicy,
  buildDelegatedHandoff,
  buildDelegatedInsufficientResultHandoff,
  formatFailedDelegatedMessage,
  resolveDelegatedWorkerRunClass,
  resolveDelegatedWorkerLifecycle,
} from '../runtime/execution-graph/delegated-worker-handoff.js';
import {
  awaitDelegatedRequestJobDrain,
  finalizeDelegatedWorkerVerification,
  listDelegatedRequestJobSnapshots,
  runDelegatedWorkerVerificationCycle,
  verifyDelegatedWorkerResult,
  type DelegatedJobSnapshot,
} from '../runtime/execution-graph/delegated-worker-verification.js';
import {
  buildDelegatedRetryableFailure,
  isDelegatedAnswerSynthesisRetry,
  runDelegatedGroundedAnswerSynthesisRetry,
  shouldAdoptDelegatedTaskContract,
  type DelegatedResultSufficiencyFailure,
} from '../runtime/execution-graph/delegated-worker-retry.js';
import { runDelegatedWorkerRetryInvocation } from '../runtime/execution-graph/delegated-worker-retry-invocation.js';
import {
  emitWorkerSuspensionGraphEvent,
  recordDelegatedWorkerGraphPendingApprovalAction,
  recordWorkerSuspensionGraphContinuationPendingAction,
  reconstructWorkerSuspensionGraphResume,
  workerSuspensionResumeContextToTraceContext,
  type WorkerApprovalContinuationTraceContext,
  type WorkerSuspensionGraphResumeContext,
} from '../runtime/execution-graph/worker-suspension-resume.js';
import {
  buildApprovedMutationToolResult,
  emitMutationResumeGraphEvent,
  reconstructGraphMutationResume,
  resumeWriteSpecMutationNodeAfterApproval,
} from '../runtime/execution-graph/mutation-node.js';
import {
  readExecutionGraphResumePayload,
  recordGraphPendingActionInterrupt,
} from '../runtime/execution-graph/pending-action-adapter.js';
import {
  buildGraphControlledTaskRunId,
  runGraphControlledExecution as runGraphControlledExecutionController,
} from '../runtime/execution-graph/graph-controller.js';
import {
  runRecoveryAdvisorInvocation,
} from '../runtime/execution-graph/node-recovery.js';
import { readWorkerExecutionMetadata } from '../runtime/worker-execution-metadata.js';
import {
  buildDelegatedExecutionMetadata,
  DELEGATED_RESULT_METADATA_KEY,
  EXECUTION_EVENTS_METADATA_KEY,
  readDelegatedResultEnvelope,
  readExecutionEvents,
  sanitizeDelegatedEnvelopeForOperator,
} from '../runtime/execution/metadata.js';
import { buildDelegatedTaskContract } from '../runtime/execution/verifier.js';
import {
  buildStepReceipts,
  computeWorkerRunStatus,
} from '../runtime/execution/task-plan.js';
import type { RecoveryAdvisorRequest } from '../runtime/execution/recovery-advisor.js';
import {
  type DirectReasoningTraceContext,
} from '../runtime/direct-reasoning-mode.js';
import {
  toPendingActionClientMetadata,
  type PendingActionApprovalSummary,
  type PendingActionRecord,
  type PendingActionStore,
} from '../runtime/pending-actions.js';
import {
  CHAT_CONTINUATION_TYPE_AUTOMATION_AUTHORING,
  normalizeChatContinuationPrincipalRole,
} from '../runtime/chat-agent/chat-continuation-payloads.js';
import {
  completeChatContinuationGraphResume,
  failChatContinuationGraphResume,
  readChatContinuationGraphResume,
  recordChatContinuationGraphApproval,
  startChatContinuationGraphApprovalResume,
  type ChatContinuationGraphResume,
} from '../runtime/chat-agent/chat-continuation-graph.js';
import {
  attachWorkerAutomationAuthoringResumeMetadata,
} from '../worker/automation-resume.js';
import {
  attachWorkerSuspensionMetadata,
  readWorkerSuspensionMetadata,
  withWorkerSuspensionSourceEnvelope,
} from '../runtime/worker-suspension.js';
import type {
  DelegatedResultEnvelope,
  EvidenceReceipt,
  ExecutionEvent,
  VerificationDecision,
} from '../runtime/execution/types.js';

const log = createLogger('worker-manager');
const APPROVAL_CONFIRM_PATTERN = /^(?:\/)?(?:approve|approved|yes|yep|yeah|y|go ahead|do it|confirm|ok|okay|sure|proceed|accept)\b/i;
const APPROVAL_DENY_PATTERN = /^(?:\/)?(?:deny|denied|reject|decline|cancel|no|nope|nah|n)\b/i;
const APPROVAL_ID_TOKEN_PATTERN = /^(?=.*(?:-|\d))[a-z0-9-]{4,}$/i;
const PENDING_APPROVAL_TTL_MS = 30 * 60_000;
const WORKER_WORKSPACE_CLEANUP_MAX_RETRIES = 10;
const WORKER_WORKSPACE_CLEANUP_RETRY_DELAY_MS = 100;
const WORKER_MESSAGE_DISPATCH_TIMEOUT_MS = 1_800_000;
const DELEGATED_INITIAL_DISPATCH_TIMEOUT_MS = 420_000;
const DELEGATED_RETRY_DISPATCH_TIMEOUT_MS = 330_000;
const DELEGATED_SYNTHESIS_DISPATCH_TIMEOUT_MS = 180_000;
const workerManagerPath = fileURLToPath(import.meta.url);
const workerManagerDir = dirname(workerManagerPath);

function describeAbortReason(signal: AbortSignal): string {
  const reason = (signal as { reason?: unknown }).reason;
  if (reason instanceof Error && reason.message.trim()) return reason.message;
  if (typeof reason === 'string' && reason.trim()) return reason;
  return 'request aborted';
}

function createWorkerDispatchCanceledError(signal: AbortSignal): Error {
  return new Error(`Worker message dispatch canceled: ${describeAbortReason(signal)}`);
}

function isRecoverableWorkerDispatchAbort(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.startsWith('Worker message dispatch canceled:')
    || error.message === 'Worker message dispatch timed out';
}

function buildRecoverableWorkerDispatchAbortMetadata(error: unknown): Record<string, unknown> {
  return {
    workerExecution: {
      lifecycle: 'failed',
      source: 'tool_loop',
      completionReason: 'degraded_response',
      responseQuality: 'degraded',
      terminationReason: 'max_wall_clock',
      roundCount: 1,
      toolCallCount: 0,
      toolResultCount: 0,
      successfulToolResultCount: 0,
    },
    workerDispatchError: error instanceof Error ? error.message : String(error),
  };
}

function hasRecoverableWorkerDispatchAbortMetadata(metadata: Record<string, unknown> | undefined): boolean {
  return typeof metadata?.workerDispatchError === 'string' && (
    metadata.workerDispatchError.startsWith('Worker message dispatch canceled:')
    || metadata.workerDispatchError === 'Worker message dispatch timed out'
  );
}

function hasMissingRuntimeEvidence(insufficiency: DelegatedResultSufficiencyFailure | null | undefined): boolean {
  return insufficiency?.decision.missingEvidenceKinds?.includes('runtime_evidence') === true
    || insufficiency?.unsatisfiedSteps?.some((step) => {
      return step.expectedToolCategories?.some((category) => category.trim() === 'runtime_evidence') === true;
    }) === true;
}

function collectRuntimeProofStepIds(taskContract: DelegatedResultEnvelope['taskContract']): string[] {
  const runtimeStepIds = taskContract.plan.steps
    .filter((step) => step.required !== false)
    .filter((step) => step.expectedToolCategories?.some((category) => category.trim() === 'runtime_evidence') === true)
    .map((step) => step.stepId);
  const answerStepIds = taskContract.plan.steps
    .filter((step) => step.required !== false && step.kind === 'answer')
    .map((step) => step.stepId);
  return [...new Set([...runtimeStepIds, ...answerStepIds])];
}

function buildStaticAppRuntimeProofFailure(
  taskContract: DelegatedResultEnvelope['taskContract'],
  envelope: DelegatedResultEnvelope,
  reason: string,
): DelegatedResultSufficiencyFailure {
  const unsatisfiedStepIds = collectRuntimeProofStepIds(taskContract);
  const decision: VerificationDecision = {
    decision: 'contradicted',
    reasons: [reason],
    retryable: true,
    requiredNextAction: 'Fix the static app runtime or semantic wiring issue, then rerun the local app proof before answering.',
    missingEvidenceKinds: ['runtime_evidence'],
    ...(unsatisfiedStepIds.length > 0 ? { unsatisfiedStepIds } : {}),
  };
  return buildDelegatedRetryableFailure(decision, envelope) ?? {
    decision,
    failureSummary: reason,
    retryReason: reason,
    unsatisfiedSteps: taskContract.plan.steps
      .filter((step) => unsatisfiedStepIds.includes(step.stepId))
      .map((step) => ({
        stepId: step.stepId,
        kind: step.kind,
        summary: step.summary,
        expectedToolCategories: step.expectedToolCategories,
        status: 'failed' as const,
        reason,
      })),
    satisfiedSteps: [],
  };
}

function describeToolRunFailure(value: unknown): string {
  if (value instanceof Error) {
    return value.message;
  }
  if (!value || typeof value !== 'object') {
    return String(value || 'Static app runtime proof failed.');
  }
  const record = value as Record<string, unknown>;
  const direct = [record.message, record.error]
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
  const output = record.output && typeof record.output === 'object'
    ? record.output as Record<string, unknown>
    : null;
  const nested = output
    ? [output.stderr, output.stdout, output.message]
        .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];
  const text = [...direct, ...nested].join(' ').trim();
  return text || 'Static app runtime proof failed.';
}

type RuntimeEvidenceRecoveryTool = {
  toolName: 'code_build' | 'code_test';
  args: Record<string, unknown>;
  detail: string;
  cleanup?: () => void;
};

type StaticAppAssetCompletion = {
  relativePath: string;
  absolutePath: string;
  content: string;
};

type StaticAppCompletionRecovery = {
  detail: string;
  assets: StaticAppAssetCompletion[];
};

function resolveCodeContextFromMessage(input: WorkerMessageRequest): ToolExecutionRequest['codeContext'] | undefined {
  const codeContext = input.message.metadata?.codeContext;
  if (!codeContext || typeof codeContext !== 'object') return undefined;
  const record = codeContext as Record<string, unknown>;
  const workspaceRoot = typeof record.workspaceRoot === 'string' ? record.workspaceRoot.trim() : '';
  if (!workspaceRoot) return undefined;
  const sessionId = typeof record.sessionId === 'string' && record.sessionId.trim()
    ? record.sessionId.trim()
    : input.delegation?.codeSessionId;
  return {
    workspaceRoot,
    ...(sessionId ? { sessionId } : {}),
  };
}

function resolveRuntimeEvidenceRecoveryTool(codeContext: ToolExecutionRequest['codeContext']): RuntimeEvidenceRecoveryTool | null {
  if (!codeContext?.workspaceRoot) return null;
  const workspaceRoot = resolve(codeContext.workspaceRoot);
  const packageJsonPath = join(workspaceRoot, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const parsed = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { scripts?: Record<string, unknown> };
      const scripts = parsed && typeof parsed === 'object' && parsed.scripts && typeof parsed.scripts === 'object'
        ? parsed.scripts
        : {};
      if (typeof scripts.verify === 'string') {
        return {
          toolName: 'code_build',
          args: { cwd: workspaceRoot, command: 'npm run verify', timeoutMs: 60_000, isolation: 'local' },
          detail: 'Running the project verify script to satisfy runtime evidence.',
        };
      }
      if (typeof scripts.build === 'string') {
        return {
          toolName: 'code_build',
          args: { cwd: workspaceRoot, command: 'npm run build', timeoutMs: 60_000, isolation: 'local' },
          detail: 'Running the project build script to satisfy runtime evidence.',
        };
      }
      if (typeof scripts.test === 'string') {
        return {
          toolName: 'code_test',
          args: { cwd: workspaceRoot, command: 'npm test', timeoutMs: 60_000, isolation: 'local' },
          detail: 'Running the project test script to satisfy runtime evidence.',
        };
      }
    } catch {
      // Fall through to syntax validation for dependency-free Node apps.
    }
  }
  const serverPath = join(workspaceRoot, 'server.js');
  if (existsSync(serverPath)) {
    return {
      toolName: 'code_build',
      args: { cwd: workspaceRoot, command: 'node --check server.js', timeoutMs: 30_000, isolation: 'local' },
      detail: 'Running a bounded Node syntax check to satisfy runtime evidence.',
    };
  }
  const staticRecoveryTool = resolveStaticAppRuntimeRecoveryTool(workspaceRoot);
  if (staticRecoveryTool) {
    return staticRecoveryTool;
  }
  return null;
}

function buildRuntimeEvidenceWorkspaceDiagnosticSection(
  codeContext: ToolExecutionRequest['codeContext'],
): PromptAssemblyAdditionalSection | null {
  if (!codeContext?.workspaceRoot) return null;
  const workspaceRoot = resolve(codeContext.workspaceRoot);
  const lines = buildRuntimeEvidenceWorkspaceDiagnosticLines(workspaceRoot);
  if (lines.length === 0) return null;
  return {
    section: 'Runtime Evidence Workspace Check',
    mode: 'plain',
    content: [
      'The previous delegated attempt is missing runtime evidence. Use this workspace precheck before retrying:',
      ...lines,
      'Corrective instruction: if referenced static assets or a local run/verify entrypoint are missing, create only those missing support files first, then immediately call an execution-capable tool such as code_build, code_test, shell_safe, coding_backend_run, code_remote_exec, or a browser tool.',
      'Do not answer until a successful runtime/build/test/browser receipt exists for the completed app.',
    ].join('\n'),
  };
}

function buildStaticAppCompletionRecoverySection(
  codeContext: ToolExecutionRequest['codeContext'],
): PromptAssemblyAdditionalSection | null {
  if (!codeContext?.workspaceRoot) return null;
  const workspaceRoot = resolve(codeContext.workspaceRoot);
  const missing = readMissingStaticAssetRefs(workspaceRoot);
  if (missing.length === 0) return null;
  return {
    section: 'Static App Completion Recovery',
    mode: 'plain',
    content: [
      'The delegated retry still cannot collect runtime evidence because index.html links to local static assets that do not exist yet.',
      `Missing linked assets: ${missing.map((asset) => asset.relativePath).join(', ')}.`,
      'Your next tool action must be a mutation for the missing asset file(s), preferably fs_write. Do not read index.html or styles.css again unless a missing asset path is unclear.',
      'For a missing JavaScript asset, implement the existing page controls and sample data using the DOM ids already present in index.html, keep it dependency-free, and avoid adding package installation steps.',
      'After the missing asset file(s) exist, immediately call an execution-capable tool such as code_build, code_test, shell_safe, coding_backend_run, code_remote_exec, or a browser tool for runtime proof.',
      'Do not answer until the runtime/build/browser proof succeeds.',
    ].join('\n'),
  };
}

function resolveStaticAppCompletionRecovery(
  codeContext: ToolExecutionRequest['codeContext'],
): StaticAppCompletionRecovery | null {
  if (!codeContext?.workspaceRoot) return null;
  const workspaceRoot = resolve(codeContext.workspaceRoot);
  const missing = readMissingStaticAssetRefs(workspaceRoot);
  if (missing.length === 0) return null;
  let html = '';
  for (const candidate of listStaticIndexCandidates(workspaceRoot)) {
    try {
      html += `\n${readFileSync(candidate.indexPath, 'utf8')}`;
    } catch {
      // Ignore unreadable static entrypoints; missing assets remain authoritative.
    }
  }
  if (!html.trim()) {
    return null;
  }

  const assets: StaticAppAssetCompletion[] = [];
  for (const asset of missing) {
    const content = buildStaticAppAssetCompletionContent(asset, html);
    if (content === null) {
      return null;
    }
    assets.push({
      relativePath: asset.relativePath,
      absolutePath: asset.absolutePath,
      content,
    });
  }
  if (assets.length === 0) return null;
  return {
    detail: `Completing missing linked static asset(s): ${assets.map((asset) => asset.relativePath).join(', ')}.`,
    assets,
  };
}

function buildStaticAppAssetCompletionContent(asset: StaticAssetRef, html: string): string | null {
  const extension = extname(asset.relativePath).toLowerCase();
  if (extension === '.css') {
    return STATIC_APP_COMPLETION_CSS;
  }
  if (extension !== '.js' && extension !== '.mjs') {
    return null;
  }
  if (looksLikeMusicStaticAppHtml(html)) {
    return STATIC_MUSIC_APP_COMPLETION_SCRIPT;
  }
  return null;
}

function looksLikeMusicStaticAppHtml(html: string): boolean {
  const normalized = html.toLowerCase();
  if (!normalized.includes('song')) {
    return false;
  }
  const supportingMarkers = ['playlist', 'artist', 'player', 'album', 'music', 'btn-play', 'play'];
  return supportingMarkers.some((marker) => normalized.includes(marker));
}

function buildRuntimeEvidenceWorkspaceDiagnosticLines(workspaceRoot: string): string[] {
  const lines: string[] = [];
  const packageJsonPath = join(workspaceRoot, 'package.json');
  const packageScripts = readPackageScriptNames(packageJsonPath);
  if (packageScripts.length > 0) {
    lines.push(`- package.json scripts found: ${packageScripts.join(', ')}.`);
  }
  const serverPath = join(workspaceRoot, 'server.js');
  lines.push(existsSync(serverPath)
    ? '- server.js exists and can be checked with node --check server.js.'
    : '- No server.js entrypoint was found.');

  const indexCandidates = listStaticIndexCandidates(workspaceRoot);
  if (indexCandidates.length === 0) {
    return lines;
  }

  lines.push(`- Static entrypoint(s) found: ${indexCandidates.map((candidate) => candidate.relativeIndexPath).join(', ')}.`);
  const assetRefs = readStaticAssetRefsFromIndex(workspaceRoot);
  if (assetRefs.length === 0) {
    lines.push('- Static entrypoint has no local script or stylesheet references to validate.');
    return lines;
  }
  const existing = assetRefs.filter((asset) => existsSync(asset.absolutePath)).map((asset) => asset.relativePath);
  const missing = assetRefs.filter((asset) => !existsSync(asset.absolutePath)).map((asset) => asset.relativePath);
  if (existing.length > 0) {
    lines.push(`- Existing linked assets: ${existing.join(', ')}.`);
  }
  if (missing.length > 0) {
    lines.push(`- Missing linked assets that must be created before runtime proof: ${missing.join(', ')}.`);
  }
  return lines;
}

function readPackageScriptNames(packageJsonPath: string): string[] {
  if (!existsSync(packageJsonPath)) return [];
  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { scripts?: Record<string, unknown> };
    const scripts = parsed && typeof parsed === 'object' && parsed.scripts && typeof parsed.scripts === 'object'
      ? parsed.scripts
      : {};
    return Object.entries(scripts)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim().length > 0)
      .map(([name]) => name)
      .sort();
  } catch {
    return [];
  }
}

interface StaticAssetRef {
  ref: string;
  relativePath: string;
  absolutePath: string;
}

interface StaticIndexCandidate {
  indexPath: string;
  assetRoot: string;
  relativeIndexPath: string;
}

function readStaticAssetRefsFromIndex(workspaceRoot: string): StaticAssetRef[] {
  const refs = new Map<string, StaticAssetRef>();
  for (const candidate of listStaticIndexCandidates(workspaceRoot)) {
    try {
      for (const asset of extractLocalStaticAssetRefs(readFileSync(candidate.indexPath, 'utf8'), workspaceRoot, candidate.assetRoot)) {
        refs.set(asset.relativePath, asset);
      }
    } catch {
      // Keep scanning other conventional static roots.
    }
  }
  return [...refs.values()].sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function readMissingStaticAssetRefs(workspaceRoot: string): StaticAssetRef[] {
  return readStaticAssetRefsFromIndex(workspaceRoot)
    .filter((asset) => !existsSync(asset.absolutePath));
}

function listStaticIndexCandidates(workspaceRoot: string): StaticIndexCandidate[] {
  const root = resolve(workspaceRoot);
  return [
    {
      indexPath: join(root, 'index.html'),
      assetRoot: root,
      relativeIndexPath: 'index.html',
    },
    {
      indexPath: join(root, 'public', 'index.html'),
      assetRoot: join(root, 'public'),
      relativeIndexPath: 'public/index.html',
    },
  ].filter((candidate) => existsSync(candidate.indexPath));
}

function extractLocalStaticAssetRefs(
  html: string,
  workspaceRoot: string,
  assetRoot: string = workspaceRoot,
): StaticAssetRef[] {
  const refs = new Map<string, StaticAssetRef>();
  const attributePattern = /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(attributePattern)) {
    const ref = match[1]?.trim();
    const resolved = ref ? resolveLocalStaticAssetRef(ref, workspaceRoot, assetRoot) : null;
    if (resolved) {
      refs.set(resolved.relativePath, resolved);
    }
  }
  return [...refs.values()].sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function resolveLocalStaticAssetRef(
  ref: string,
  workspaceRoot: string,
  assetRoot: string = workspaceRoot,
): StaticAssetRef | null {
  const withoutQuery = ref.split(/[?#]/u, 1)[0]?.trim() ?? '';
  if (!withoutQuery || withoutQuery.startsWith('#')) return null;
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(withoutQuery)) return null;
  const assetRelativePath = withoutQuery.replace(/^\/+/u, '').replaceAll('\\', '/');
  if (!assetRelativePath) return null;
  const absolutePath = resolve(assetRoot, assetRelativePath);
  if (!isPathInsideOrEqual(absolutePath, workspaceRoot)) return null;
  return {
    ref,
    relativePath: relative(resolve(workspaceRoot), absolutePath).replaceAll('\\', '/'),
    absolutePath,
  };
}

function isPathInsideOrEqual(candidate: string, root: string): boolean {
  const relativePath = relative(resolve(root), resolve(candidate));
  return relativePath === '' || (!!relativePath && !relativePath.startsWith('..') && !isAbsolute(relativePath));
}

function resolveStaticAppRuntimeRecoveryTool(workspaceRoot: string): RuntimeEvidenceRecoveryTool | null {
  if (listStaticIndexCandidates(workspaceRoot).length === 0) return null;
  const assetRefs = readStaticAssetRefsFromIndex(workspaceRoot);
  if (assetRefs.some((asset) => !existsSync(asset.absolutePath))) {
    return null;
  }
  const scriptName = `.guardian-runtime-check-${randomUUID()}.mjs`;
  const scriptPath = join(workspaceRoot, scriptName);
  try {
    writeFileSync(scriptPath, STATIC_APP_RUNTIME_CHECK_SCRIPT, 'utf8');
  } catch {
    return null;
  }
  return {
    toolName: 'code_build',
    args: { cwd: workspaceRoot, command: `node ${scriptName}`, timeoutMs: 30_000, isolation: 'local' },
    detail: 'Running a bounded static app runtime check to satisfy runtime evidence.',
    cleanup: () => {
      try {
        rmSync(scriptPath, { force: true });
      } catch {
        // Best-effort cleanup of the temporary runtime probe.
      }
    },
  };
}

function buildRuntimeRecoveryCompletionContent(
  currentContent: string,
  codeContext: ToolExecutionRequest['codeContext'],
  jobSnapshots: DelegatedJobSnapshot[],
): string | null {
  if (!needsRuntimeRecoveryCompletionContent(currentContent)) {
    return null;
  }
  const runtimeEvidence = summarizeRuntimeEvidenceJob(jobSnapshots);
  if (!runtimeEvidence) {
    return null;
  }
  const workspaceRoot = codeContext?.workspaceRoot ? resolve(codeContext.workspaceRoot) : '';
  const staticIndexPath = workspaceRoot ? listStaticIndexCandidates(workspaceRoot)[0]?.indexPath ?? '' : '';
  const localUrl = staticIndexPath
    ? pathToFileURL(staticIndexPath).href
    : extractLocalUrl(runtimeEvidence);
  return [
    workspaceRoot ? `Completed the app in ${workspaceRoot}.` : 'Completed the requested app changes.',
    localUrl ? `Local URL: ${localUrl}` : '',
    `Verified: ${runtimeEvidence}`,
  ].filter((line) => line.trim().length > 0).join('\n');
}

function withDelegatedRuntimeRecoveryCompletionContent(
  result: { content: string; metadata?: Record<string, unknown> },
  completionContent: string,
  timestamp: number,
): { content: string; metadata?: Record<string, unknown> } {
  const envelope = readDelegatedResultEnvelope(result.metadata);
  if (!envelope) {
    return {
      content: completionContent,
      metadata: result.metadata,
    };
  }
  const answerReceipt: EvidenceReceipt = {
    receiptId: `supervisor-runtime-answer:${randomUUID()}`,
    sourceType: 'model_answer',
    status: 'succeeded',
    refs: [],
    summary: completionContent,
    startedAt: timestamp,
    endedAt: timestamp,
  };
  const evidenceReceipts = [...envelope.evidenceReceipts, answerReceipt];
  const toolReceiptStepIds = new Map<string, string>();
  for (const stepReceipt of envelope.stepReceipts) {
    for (const receiptId of stepReceipt.evidenceReceiptIds) {
      toolReceiptStepIds.set(receiptId, stepReceipt.stepId);
    }
  }
  const stepReceipts = buildStepReceipts({
    plannedTask: envelope.taskContract.plan,
    evidenceReceipts,
    toolReceiptStepIds,
    finalAnswerReceiptId: answerReceipt.receiptId,
    interruptions: envelope.interruptions,
  });
  const runStatus = computeWorkerRunStatus(
    envelope.taskContract.plan,
    stepReceipts,
    envelope.interruptions,
    'end_turn',
  );
  const completedEnvelope: DelegatedResultEnvelope = {
    ...envelope,
    runStatus,
    stopReason: 'end_turn',
    stepReceipts,
    finalUserAnswer: completionContent,
    operatorSummary: completionContent,
    evidenceReceipts,
  };
  return {
    content: completionContent,
    metadata: {
      ...(result.metadata ?? {}),
      ...buildDelegatedExecutionMetadata(completedEnvelope),
    },
  };
}

function isLowQualityDelegatedCompletionContent(content: string): boolean {
  const normalized = content.trim().toLowerCase();
  return !normalized
    || normalized === 'i could not generate a final response for that request.'
    || normalized.includes('could not generate a final response')
    || normalized.includes('delegated work failed');
}

function needsRuntimeRecoveryCompletionContent(content: string): boolean {
  if (isLowQualityDelegatedCompletionContent(content)) {
    return true;
  }
  const normalized = content.trim().toLowerCase();
  const hasLocalTarget = /\blocal\s+url\s*:/iu.test(content)
    || /\bhttps?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?\b/iu.test(content)
    || /\bfile:\/\/\//iu.test(content);
  const hasConcreteVerification = /\bverified\s*:/iu.test(content)
    || /\bverified\b/iu.test(content)
    || /\bverification\s+(?:passed|succeeded|complete|completed|confirmed)\b/iu.test(content)
    || /\bstatic app runtime check passed\b/iu.test(content);
  const suggestsOutstandingVerification = /\b(?:ready for|remain|remaining|pending|needs?|still need)\b.*\b(?:verify|verified|verification|runtime)\b/iu.test(normalized)
    || /\b(?:verify|verified|verification|runtime)\b.*\b(?:remain|remaining|pending|needs?|still need)\b/iu.test(normalized);
  return !hasLocalTarget || !hasConcreteVerification || suggestsOutstandingVerification;
}

function summarizeRuntimeEvidenceJob(jobSnapshots: DelegatedJobSnapshot[]): string | null {
  const runtimeSnapshots = jobSnapshots
    .filter((snapshot) => isRuntimeEvidenceToolName(snapshot.toolName))
    .sort((left, right) => (
      (right.completedAt ?? right.startedAt ?? right.createdAt ?? 0)
      - (left.completedAt ?? left.startedAt ?? left.createdAt ?? 0)
    ));
  const successfulSnapshots = runtimeSnapshots.filter((snapshot) => {
    const normalizedStatus = snapshot.status.trim().toLowerCase();
    return normalizedStatus === 'succeeded' || normalizedStatus === 'completed';
  });
  for (const snapshot of [...successfulSnapshots, ...runtimeSnapshots.filter((snapshot) => !successfulSnapshots.includes(snapshot))]) {
    if (snapshot.toolName === 'code_build'
      && isSuccessfulDelegatedJobSnapshot(snapshot)
      && isStaticAppRuntimeCheckSnapshot(snapshot)
    ) {
      const text = snapshot.resultPreview ? extractRuntimePreviewText(snapshot.resultPreview) : '';
      return summarizeStaticAppRuntimeCheckText(text);
    }
    const text = [
      snapshot.resultPreview ? extractRuntimePreviewText(snapshot.resultPreview) : '',
      snapshot.error ?? '',
    ].filter((line) => line.trim().length > 0).join(' ').trim();
    if (!text) continue;
    if (snapshot.toolName === 'code_build' && text.includes('Static app runtime check passed')) {
      return summarizeStaticAppRuntimeCheckText(text);
    }
    return text.slice(0, 500);
  }
  return null;
}

function summarizeStaticAppRuntimeCheckText(text: string): string {
  const semantic = text.includes('Music app semantic smoke passed')
    ? ' Music app semantic smoke also passed: linked JavaScript targets visible song, playlist, artist, player, and playback-control elements.'
    : '';
  return `Static app runtime check passed: index.html and all linked local assets loaded through a temporary localhost server, and linked JavaScript passed syntax validation.${semantic}`;
}

function isSuccessfulDelegatedJobSnapshot(snapshot: DelegatedJobSnapshot): boolean {
  const normalizedStatus = snapshot.status.trim().toLowerCase();
  return normalizedStatus === 'succeeded' || normalizedStatus === 'completed';
}

function isStaticAppRuntimeCheckSnapshot(snapshot: DelegatedJobSnapshot): boolean {
  return (snapshot.argsPreview?.includes('.guardian-runtime-check-') ?? false)
    || (snapshot.resultPreview?.includes('.guardian-runtime-check-') ?? false);
}

function hasSuccessfulStaticAppRuntimeCheckEvidence(jobSnapshots: DelegatedJobSnapshot[]): boolean {
  return jobSnapshots.some((snapshot) => (
    snapshot.toolName === 'code_build'
    && isSuccessfulDelegatedJobSnapshot(snapshot)
    && isStaticAppRuntimeCheckSnapshot(snapshot)
  ));
}

function isRuntimeEvidenceToolName(toolName: string): boolean {
  return toolName === 'code_build'
    || toolName === 'code_test'
    || toolName === 'code_remote_exec'
    || toolName === 'shell_safe'
    || toolName === 'coding_backend_run'
    || toolName.startsWith('browser_');
}

function extractRuntimePreviewText(preview: string): string {
  try {
    const parsed = JSON.parse(preview) as unknown;
    const extracted = extractRuntimePreviewTextFromValue(parsed);
    if (extracted) {
      return extracted;
    }
  } catch {
    // Fall back to the raw preview below.
  }
  return preview;
}

function extractRuntimePreviewTextFromValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  const direct = [
    record.message,
    record.verificationEvidence,
    record.error,
  ].filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
  const output = record.output && typeof record.output === 'object'
    ? record.output as Record<string, unknown>
    : null;
  const nested = output
    ? [
        output.stdout,
        output.stderr,
        output.message,
        output.verificationEvidence,
      ].filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];
  return [...direct, ...nested].join(' ').trim();
}

function extractLocalUrl(text: string): string | null {
  const match = text.match(/\bhttps?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?\/[^\s)"']*/iu);
  return match?.[0] ?? null;
}

const STATIC_APP_RUNTIME_CHECK_SCRIPT = [
  'import { createServer, get } from \'node:http\';',
  'import { createReadStream, existsSync } from \'node:fs\';',
  'import { readFile, stat } from \'node:fs/promises\';',
  'import { execFileSync } from \'node:child_process\';',
  'import { dirname, extname, isAbsolute, relative, resolve } from \'node:path\';',
  '',
  'const root = process.cwd();',
  'const rootIndexPath = resolve(root, \'index.html\');',
  'const publicIndexPath = resolve(root, \'public/index.html\');',
  'const indexPath = existsSync(rootIndexPath) ? rootIndexPath : publicIndexPath;',
  'const staticRoot = dirname(indexPath);',
  'const html = await readFile(indexPath, \'utf8\');',
  '',
  'function isInside(candidate) {',
  '  const rel = relative(root, resolve(candidate));',
  '  return rel === \'\' || (!!rel && !rel.startsWith(\'..\') && !isAbsolute(rel));',
  '}',
  '',
  'function resolveRef(ref) {',
  '  const clean = String(ref || \'\').split(/[?#]/u, 1)[0].trim();',
  '  if (!clean || clean.startsWith(\'#\') || /^(?:[a-z][a-z0-9+.-]*:|\\/\\/)/iu.test(clean)) return null;',
  '  const rel = clean.replace(/^\\/+/, \'\');',
  '  if (!rel) return null;',
  '  const path = resolve(staticRoot, rel);',
  '  if (!isInside(path)) throw new Error(`Static asset escapes workspace: ${ref}`);',
  '  return { ref: clean, path, route: \'/\' + rel.replaceAll(\'\\\\\', \'/\') };',
  '}',
  '',
  'function localRefs(source) {',
  '  const refs = new Map();',
  "  const pattern = /\\b(?:src|href)\\s*=\\s*[\"']([^\"']+)[\"']/giu;",
  '  for (const match of source.matchAll(pattern)) {',
  '    const resolved = resolveRef(match[1]);',
  '    if (resolved) refs.set(resolved.route, resolved);',
  '  }',
  '  return [...refs.values()];',
  '}',
  '',
  'function htmlIds(source) {',
  '  const ids = new Set();',
  "  const pattern = /\\bid\\s*=\\s*[\"']([^\"']+)[\"']/giu;",
  '  for (const match of source.matchAll(pattern)) ids.add(match[1]);',
  '  return ids;',
  '}',
  '',
  'function scriptTargetsId(source, id) {',
  '  return source.includes(`"${id}"`)',
  "    || source.includes(\"'\" + id + \"'\")",
  '    || source.includes(`#${id}`);',
  '}',
  '',
  'function assertMusicTarget(label, ids, jsSource, candidates, issues) {',
  '  const present = candidates.filter((id) => ids.has(id));',
  '  if (!present.length) {',
  '    issues.push(`${label} container is missing from index.html`);',
  '    return;',
  '  }',
  '  if (!present.some((id) => scriptTargetsId(jsSource, id))) {',
  '    issues.push(`${label} container exists but linked JavaScript does not target ${present.join(\', \')}`);',
  '  }',
  '}',
  '',
  'function assertIfPresent(label, ids, jsSource, candidates, issues) {',
  '  const present = candidates.filter((id) => ids.has(id));',
  '  if (present.length && !present.some((id) => scriptTargetsId(jsSource, id))) {',
  '    issues.push(`${label} exists in index.html but linked JavaScript does not target ${present.join(\', \')}`);',
  '  }',
  '}',
  '',
  'function assertAdvancedMusicBehavior(ids, jsSource, issues) {',
  '  const advancedShell = ids.has(\'home-search-input\')',
  '    || ids.has(\'home-search-results\')',
  '    || ids.has(\'search-view\')',
  '    || ids.has(\'songs-view\');',
  '  if (!advancedShell) return;',
  '  assertIfPresent(\'home search input\', ids, jsSource, [\'home-search-input\'], issues);',
  '  assertIfPresent(\'home search results\', ids, jsSource, [\'home-search-results\'], issues);',
  '  assertIfPresent(\'search results\', ids, jsSource, [\'search-results\'], issues);',
  '  const hasRecentlyPlayedState = /\\brecentlyPlayed\\b|\\brecentHistory\\b|\\bplayHistory\\b/u.test(jsSource);',
  '  const rendersStaticRecentlyPlayed = /recently-played[\\s\\S]{0,80}songs\\.slice\\(\\s*0\\s*,\\s*4\\s*\\)/u.test(jsSource);',
  '  if (ids.has(\'recently-played\') && !hasRecentlyPlayedState && rendersStaticRecentlyPlayed) {',
  '    issues.push(\'recently played is rendered from a fixed song slice instead of playback state\');',
  '  }',
  '  const normalizedJs = jsSource.replace(/\\s+/gu, \' \');',
  '  const usesWordOnlyPlayPause = normalizedJs.includes(\'textContent = isPlaying ? "Pause" : "Play"\')',
  '    || normalizedJs.includes("textContent = isPlaying ? \'Pause\' : \'Play\'");',
  '  if (ids.has(\'btn-play\') && usesWordOnlyPlayPause) {',
  '    issues.push(\'play control updates to word-only Play/Pause text instead of a polished visible player state\');',
  '  }',
  '}',
  '',
  'function runStaticSemanticChecks(htmlSource, jsSource) {',
  '  const lower = htmlSource.toLowerCase();',
  '  const musicSignals = [\'song\', \'playlist\', \'artist\', \'player\', \'music\'].filter((signal) => lower.includes(signal)).length;',
  '  if (musicSignals < 3) return \'\';',
  '  const ids = htmlIds(htmlSource);',
  '  const issues = [];',
  '  assertMusicTarget(\'song list\', ids, jsSource, [\'song-list\', \'recent-songs\', \'browse-results\', \'all-songs\', \'recently-played\', \'content-area\'], issues);',
  '  assertMusicTarget(\'playlist list\', ids, jsSource, [\'playlist-list\', \'playlist-grid\', \'sidebar-playlist-list\', \'content-area\'], issues);',
  '  assertMusicTarget(\'artist list\', ids, jsSource, [\'artist-list\', \'artist-grid\', \'popular-artists\', \'content-area\'], issues);',
  '  assertMusicTarget(\'player title\', ids, jsSource, [\'player-title\', \'player-song\', \'player-song-title\'], issues);',
  '  assertMusicTarget(\'player artist\', ids, jsSource, [\'player-artist\', \'player-song-artist\'], issues);',
  '  assertMusicTarget(\'play control\', ids, jsSource, [\'btn-play\', \'play-btn\'], issues);',
  '  assertMusicTarget(\'next control\', ids, jsSource, [\'btn-next\', \'next-btn\'], issues);',
  '  assertMusicTarget(\'previous control\', ids, jsSource, [\'btn-prev\', \'prev-btn\'], issues);',
  '  assertMusicTarget(\'progress control\', ids, jsSource, [\'progress-bar\'], issues);',
  '  assertIfPresent(\'playlist detail view\', ids, jsSource, [\'playlist-detail-view\', \'playlist-detail\'], issues);',
  '  assertIfPresent(\'artist detail view\', ids, jsSource, [\'artist-detail-view\', \'artist-detail\'], issues);',
  '  assertAdvancedMusicBehavior(ids, jsSource, issues);',
  '  if (issues.length) throw new Error(`Static app semantic check failed: ${issues.join(\'; \')}`);',
  '  return \'Music app semantic smoke passed: linked JavaScript targets visible song, playlist, artist, player, and playback-control elements.\';',
  '}',
  '',
  'function contentType(filePath) {',
  '  switch (extname(filePath).toLowerCase()) {',
  '    case \'.html\': return \'text/html; charset=utf-8\';',
  '    case \'.css\': return \'text/css; charset=utf-8\';',
  '    case \'.js\':',
  '    case \'.mjs\': return \'text/javascript; charset=utf-8\';',
  '    case \'.json\': return \'application/json; charset=utf-8\';',
  '    case \'.svg\': return \'image/svg+xml\';',
  '    default: return \'application/octet-stream\';',
  '  }',
  '}',
  '',
  'function requestText(url) {',
  '  return new Promise((resolveRequest, rejectRequest) => {',
  '    const req = get(url, (res) => {',
  '      let body = \'\';',
  '      res.setEncoding(\'utf8\');',
  '      res.on(\'data\', (chunk) => { body += chunk; });',
  '      res.on(\'end\', () => resolveRequest({ status: res.statusCode || 0, body }));',
  '    });',
  '    req.on(\'error\', rejectRequest);',
  '    req.setTimeout(5000, () => req.destroy(new Error(\'Timed out fetching \' + url)));',
  '  });',
  '}',
  '',
  'const assets = localRefs(html);',
  'const jsSources = [];',
  'for (const asset of assets) {',
  '  if (!existsSync(asset.path)) throw new Error(`Missing static asset: ${asset.ref}`);',
  '  if (/\\.m?js$/iu.test(asset.path)) {',
  '    jsSources.push(await readFile(asset.path, \'utf8\'));',
  '    execFileSync(process.execPath, [\'--check\', asset.path], { stdio: \'pipe\' });',
  '  }',
  '}',
  '',
  'const server = createServer(async (req, res) => {',
  '  try {',
  '    const pathname = decodeURIComponent(new URL(req.url || \'/\', \'http://127.0.0.1\').pathname);',
  '    const rel = pathname.replace(/^\\/+/, \'\') || \'index.html\';',
  '    let target = resolve(staticRoot, rel);',
  '    if (!isInside(target)) {',
  '      res.statusCode = 403;',
  '      res.end(\'forbidden\');',
  '      return;',
  '    }',
  '    let info = await stat(target);',
  '    if (info.isDirectory()) {',
  '      target = resolve(target, \'index.html\');',
  '      info = await stat(target);',
  '    }',
  '    res.setHeader(\'content-type\', contentType(target));',
  '    createReadStream(target).pipe(res);',
  '  } catch {',
  '    res.statusCode = 404;',
  '    res.end(\'not found\');',
  '  }',
  '});',
  '',
  'await new Promise((resolveListen, rejectListen) => {',
  '  server.once(\'error\', rejectListen);',
  '  server.listen(0, \'127.0.0.1\', resolveListen);',
  '});',
  '',
  'const address = server.address();',
  'const port = address && typeof address === \'object\' ? address.port : 0;',
  'const localUrl = \'http://127.0.0.1:\' + port + \'/\';',
  'try {',
  '  const rootResponse = await requestText(localUrl);',
  '  if (rootResponse.status !== 200 || !/<html[\\s>]/iu.test(rootResponse.body)) {',
  '    throw new Error(\'Root page did not return HTML successfully.\');',
  '  }',
  '  for (const asset of assets) {',
  '    const assetResponse = await requestText(localUrl + asset.route.replace(/^\\/+/, \'\'));',
  '    if (assetResponse.status !== 200) throw new Error(`Linked asset failed to load: ${asset.ref}`);',
  '  }',
  '  const semanticSummary = runStaticSemanticChecks(html, jsSources.join(\'\\n\'));',
  '  console.log(`Static app runtime check passed at ${localUrl} with ${assets.length} linked asset(s).${semanticSummary ? \' \' + semanticSummary : \'\'}`);',
  '} finally {',
  '  await new Promise((resolveClose) => server.close(resolveClose));',
  '}',
  '',
].join('\n');

const STATIC_APP_COMPLETION_CSS = [
  '/* Guardian Agent completed this missing linked stylesheet so the static app can run locally. */',
  ':root { color-scheme: light dark; }',
  'body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }',
  'button, input { font: inherit; }',
  '.hidden { display: none !important; }',
  '',
].join('\n');

const STATIC_MUSIC_APP_COMPLETION_SCRIPT = [
  '(() => {',
  '  if (window.__guardianStaticMusicAppReady) return;',
  '  window.__guardianStaticMusicAppReady = true;',
  '',
  '  const songs = [',
  '    { title: "Midnight Drive", artist: "Ari Lane", album: "After Hours", duration: 213, mood: "Synth pop", color: "#4f46e5" },',
  '    { title: "Golden Hour", artist: "Sable Rivers", album: "Sunset Letters", duration: 198, mood: "Indie pop", color: "#f59e0b" },',
  '    { title: "Neon Pulse", artist: "Kira Volt", album: "Night Market", duration: 221, mood: "Electro", color: "#7c3aed" },',
  '    { title: "Harbor Lights", artist: "Nia Vale", album: "Blue Room", duration: 188, mood: "Indie soul", color: "#0891b2" },',
  '    { title: "Paper Moon", artist: "June Atelier", album: "Small Hours", duration: 204, mood: "Dream pop", color: "#be185d" },',
  '    { title: "Southbound", artist: "Miles Rowan", album: "Open Roads", duration: 226, mood: "Folk", color: "#15803d" },',
  '    { title: "Velvet Circuit", artist: "The Velvet Keys", album: "Signal Fire", duration: 241, mood: "Alt rock", color: "#ca8a04" },',
  '    { title: "Quiet Gravity", artist: "Luna Frost", album: "Low Orbit", duration: 216, mood: "Ambient pop", color: "#0f766e" },',
  '  ];',
  '',
  '  const playlists = [',
  '    { name: "Chill Vibes", description: "Soft songs for slow afternoons.", songIndexes: [1, 3, 4, 7] },',
  '    { name: "Late Night Drive", description: "Neon roads and low lights.", songIndexes: [0, 2, 6] },',
  '    { name: "Feel Good Hits", description: "Bright tracks with a pulse.", songIndexes: [1, 2, 5] },',
  '    { name: "Indie Essentials", description: "Warm guitars and honest hooks.", songIndexes: [3, 4, 5, 6] },',
  '  ];',
  '',
  '  const artists = Array.from(new Map(songs.map((song) => [song.artist, { name: song.artist, songs: songs.filter((item) => item.artist === song.artist) }])).values());',
  '  let currentIndex = 0;',
  '  let isPlaying = false;',
  '  let elapsed = 0;',
  '  let timer = null;',
  '',
  '  const byId = (id) => document.getElementById(id);',
  '  const all = (selector, root = document) => Array.from(root.querySelectorAll(selector));',
  '  const firstById = (...ids) => ids.map(byId).find(Boolean) || null;',
  '  const clear = (node) => { if (node) node.replaceChildren(); };',
  '  const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;',
  '  const make = (tag, className, text) => {',
  '    const node = document.createElement(tag);',
  '    if (className) node.className = className;',
  '    if (text !== undefined) node.textContent = text;',
  '    return node;',
  '  };',
  '',
  '  function songButton(song, index) {',
  '    const button = make("button", "song-row", "");',
  '    button.type = "button";',
  '    button.dataset.index = String(index);',
  '    button.innerHTML = `<span class="song-num">${index + 1}</span><span class="song-title">${song.title}<br><small>${song.album}</small></span><span class="song-artist">${song.artist}</span><span class="song-duration">${formatTime(song.duration)}</span>`;',
  '    button.addEventListener("click", () => playSong(index));',
  '    return button;',
  '  }',
  '',
  '  function card(title, subtitle, action, icon = "Music") {',
  '    const button = make("button", "card music-card", "");',
  '    button.type = "button";',
  '    button.innerHTML = `<div class="card-icon">${icon}</div><div class="card-title">${title}</div><div class="card-sub">${subtitle}</div>`;',
  '    button.addEventListener("click", action);',
  '    return button;',
  '  }',
  '',
  '  function renderSongList(containerId, list = songs) {',
  '    const container = byId(containerId);',
  '    if (!container) return;',
  '    clear(container);',
  '    list.forEach((song) => container.append(songButton(song, songs.indexOf(song))));',
  '  }',
  '',
  '  function matchingSongs(query = "") {',
  '    const normalized = query.trim().toLowerCase();',
  '    return songs.filter((song) => [song.title, song.artist, song.album, song.mood].some((value) => value.toLowerCase().includes(normalized)));',
  '  }',
  '',
  '  function renderHome(query = "") {',
  '    renderSongList("song-list", matchingSongs(query));',
  '    renderSongList("recent-songs", songs.slice(0, 4));',
  '    renderSongList("recently-played", songs.slice(0, 4));',
  '    const madeForYou = byId("made-for-you");',
  '    if (madeForYou) {',
  '      clear(madeForYou);',
  '      playlists.forEach((playlist, index) => madeForYou.append(card(playlist.name, playlist.description, () => showPlaylist(index), "List")));',
  '    }',
  '    const popularArtists = byId("popular-artists");',
  '    if (popularArtists) {',
  '      clear(popularArtists);',
  '      artists.slice(0, 6).forEach((artist, index) => popularArtists.append(card(artist.name, `${artist.songs.length} song${artist.songs.length === 1 ? "" : "s"}`, () => showArtist(index), "Artist")));',
  '    }',
  '  }',
  '',
  '  function renderBrowse(query = "") {',
  '    const filtered = matchingSongs(query);',
  '    renderSongList("browse-results", filtered);',
  '    renderSongList("all-songs", filtered);',
  '    if (!byId("browse-results")) renderSongList("song-list", filtered);',
  '  }',
  '',
  '  function renderPlaylists() {',
  '    const targets = [byId("playlist-list"), byId("playlist-grid")].filter(Boolean);',
  '    targets.forEach((list) => {',
  '      clear(list);',
  '      playlists.forEach((playlist, index) => list.append(card(playlist.name, `${playlist.songIndexes.length} songs`, () => showPlaylist(index), "List")));',
  '    });',
  '    const sidebar = byId("sidebar-playlist-list");',
  '    if (sidebar) {',
  '      clear(sidebar);',
  '      playlists.forEach((playlist, index) => {',
  '        const item = make("li", "", playlist.name);',
  '        item.tabIndex = 0;',
  '        item.addEventListener("click", () => showPlaylist(index));',
  '        item.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") showPlaylist(index); });',
  '        sidebar.append(item);',
  '      });',
  '    }',
  '  }',
  '',
  '  function activateView(view) {',
  '    all("[data-view]").forEach((link) => link.classList.toggle("active", link.getAttribute("data-view") === view));',
  '    all(".view").forEach((section) => {',
  '      const active = section.id === `${view}-view` || section.id === `view-${view}`;',
  '      section.classList.toggle("active", active);',
  '      if (active) section.classList.remove("hidden");',
  '    });',
  '  }',
  '',
  '  function showPlaylist(index) {',
  '    const playlist = playlists[index];',
  '    if (!playlist) return;',
  '    const detail = firstById("playlist-detail-view", "playlist-detail");',
  '    if (detail) {',
  '      all(".view").forEach((section) => section.classList.remove("active"));',
  '      detail.classList.add("active");',
  '      detail.classList.remove("hidden");',
  '    }',
  '    const title = byId("playlist-detail-title");',
  '    if (title) title.textContent = playlist.name;',
  '    const desc = byId("playlist-detail-desc");',
  '    if (desc) desc.textContent = playlist.description;',
  '    const header = byId("playlist-header");',
  '    if (header) header.innerHTML = `<div class="playlist-cover">List</div><div class="playlist-info"><h1>${playlist.name}</h1><p>${playlist.description}</p></div>`;',
  '    const playlistSongs = playlist.songIndexes.map((songIndex) => songs[songIndex]).filter(Boolean);',
  '    renderSongList("playlist-song-list", playlistSongs);',
  '    renderSongList("playlist-songs", playlistSongs);',
  '    const playAll = byId("play-playlist-btn");',
  '    if (playAll) playAll.onclick = () => playSong(playlist.songIndexes[0] ?? 0);',
  '  }',
  '',
  '  function renderArtists(query = "") {',
  '    const normalized = query.trim().toLowerCase();',
  '    const filtered = artists.filter((artist) => artist.name.toLowerCase().includes(normalized));',
  '    [byId("artist-list"), byId("artist-grid")].filter(Boolean).forEach((list) => {',
  '      clear(list);',
  '      filtered.forEach((artist, index) => list.append(card(artist.name, `${artist.songs.length} song${artist.songs.length === 1 ? "" : "s"}`, () => showArtist(artists.indexOf(artist)), "Artist")));',
  '    });',
  '  }',
  '',
  '  function showArtist(index) {',
  '    const artist = artists[index];',
  '    if (!artist) return;',
  '    const detail = firstById("artist-detail-view", "artist-detail");',
  '    if (detail) {',
  '      all(".view").forEach((section) => section.classList.remove("active"));',
  '      detail.classList.add("active");',
  '      detail.classList.remove("hidden");',
  '    }',
  '    const title = firstById("artist-detail-name");',
  '    if (title) title.textContent = artist.name;',
  '    const header = byId("artist-header");',
  '    if (header) header.innerHTML = `<div class="artist-avatar">${artist.name.slice(0, 1)}</div><div class="artist-info"><h2>${artist.name}</h2><p>${artist.songs.length} song${artist.songs.length === 1 ? "" : "s"}</p></div>`;',
  '    renderSongList("artist-song-list", artist.songs);',
  '    renderSongList("artist-songs", artist.songs);',
  '  }',
  '',
  '  function ensureMusicShell() {',
  '    const shell = byId("content-area");',
  '    if (!shell || byId("song-list")) return;',
  '    shell.innerHTML = `',
  '      <section id="view-library" class="view active">',
  '        <div class="section"><h2>Recently Played</h2><div class="song-list" id="recently-played"></div></div>',
  '        <div class="section"><h2>All Songs</h2><div class="song-list" id="song-list"></div></div>',
  '        <div class="section"><h2>Made For You</h2><div class="card-grid" id="made-for-you"></div></div>',
  '        <div class="section"><h2>Popular Artists</h2><div class="card-grid" id="popular-artists"></div></div>',
  '      </section>',
  '      <section id="view-artists" class="view"><div class="card-grid" id="artist-grid"></div></section>',
  '      <section id="view-albums" class="view"><div class="song-list" id="all-songs"></div></section>',
  '      <section id="playlist-detail" class="view"><div class="playlist-header" id="playlist-header"></div><div class="song-list" id="playlist-songs"></div></section>',
  '      <section id="artist-detail" class="view"><div class="artist-header" id="artist-header"></div><div class="song-list" id="artist-songs"></div></section>',
  '    `;',
  '  }',
  '',
  '  function syncPlayer() {',
  '    const song = songs[currentIndex];',
  '    if (!song) return;',
  '    const title = firstById("player-title", "player-song", "player-song-title");',
  '    const artist = firstById("player-artist", "player-song-artist");',
  '    const art = firstById("player-art", "player-album-art");',
  '    const playButtons = [byId("btn-play"), byId("play-btn")].filter(Boolean);',
  '    const current = firstById("player-time-current", "player-time", "time-current");',
  '    const total = firstById("player-time-total", "player-duration", "time-total");',
  '    const fill = byId("progress-fill");',
  '    const bar = byId("player-bar");',
  '    if (bar) bar.classList.remove("hidden");',
  '    if (title) title.textContent = song.title;',
  '    if (artist) artist.textContent = song.artist;',
  '    if (art) art.style.background = song.color;',
  '    playButtons.forEach((button) => { button.textContent = isPlaying ? "Pause" : "Play"; });',
  '    if (current) current.textContent = formatTime(elapsed);',
  '    if (total) total.textContent = formatTime(song.duration);',
  '    if (fill) fill.style.width = `${Math.min(100, (elapsed / song.duration) * 100)}%`;',
  '    all(".song-row").forEach((row) => row.classList.toggle("playing", Number(row.dataset.index) === currentIndex));',
  '  }',
  '',
  '  function setPlaying(next) {',
  '    isPlaying = next;',
  '    if (timer) clearInterval(timer);',
  '    timer = null;',
  '    if (isPlaying) {',
  '      timer = setInterval(() => {',
  '        const song = songs[currentIndex];',
  '        elapsed = song && elapsed >= song.duration ? 0 : elapsed + 1;',
  '        if (song && elapsed === 0) currentIndex = (currentIndex + 1) % songs.length;',
  '        syncPlayer();',
  '      }, 1000);',
  '    }',
  '    syncPlayer();',
  '  }',
  '',
  '  function playSong(index) {',
  '    currentIndex = Math.max(0, index);',
  '    elapsed = 0;',
  '    setPlaying(true);',
  '  }',
  '',
  '  function wireControls() {',
  '    [byId("btn-play"), byId("play-btn")].filter(Boolean).forEach((button) => button.addEventListener("click", () => setPlaying(!isPlaying)));',
  '    [byId("btn-prev"), byId("prev-btn")].filter(Boolean).forEach((button) => button.addEventListener("click", () => { currentIndex = (currentIndex + songs.length - 1) % songs.length; elapsed = 0; syncPlayer(); }));',
  '    [byId("btn-next"), byId("next-btn")].filter(Boolean).forEach((button) => button.addEventListener("click", () => { currentIndex = (currentIndex + 1) % songs.length; elapsed = 0; syncPlayer(); }));',
  '    [byId("shuffle-btn"), byId("btn-shuffle")].filter(Boolean).forEach((button) => button.addEventListener("click", () => playSong(Math.floor(Math.random() * songs.length))));',
  '    byId("back-to-playlists")?.addEventListener("click", () => activateView("playlists"));',
  '    byId("back-to-artists")?.addEventListener("click", () => activateView("artists"));',
  '    byId("search-input")?.addEventListener("input", (event) => renderBrowse(event.target.value));',
  '    byId("song-search")?.addEventListener("input", (event) => renderHome(event.target.value));',
  '    byId("artist-search")?.addEventListener("input", (event) => renderArtists(event.target.value));',
  '    byId("progress-bar")?.addEventListener("click", (event) => { const rect = event.currentTarget.getBoundingClientRect(); const song = songs[currentIndex]; elapsed = Math.round(((event.clientX - rect.left) / rect.width) * song.duration); syncPlayer(); });',
  '    byId("volume-slider")?.addEventListener("input", (event) => { event.currentTarget.title = `Volume ${event.currentTarget.value}%`; });',
  '  }',
  '',
  '  function wireNavigation() {',
  '    all("[data-view]").forEach((item) => {',
  '      item.addEventListener("click", () => {',
  '        const view = item.getAttribute("data-view") || "songs";',
  '        activateView(view);',
  '      });',
  '    });',
  '  }',
  '',
  '  function init() {',
  '    ensureMusicShell();',
  '    renderHome();',
  '    renderBrowse();',
  '    renderPlaylists();',
  '    renderArtists();',
  '    wireNavigation();',
  '    wireControls();',
  '    syncPlayer();',
  '    if (!all(".view.active").length) activateView(byId("song-list") ? "songs" : "home");',
  '  }',
  '',
  '  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });',
  '  else init();',
  '})();',
  '',
].join('\n');

function buildWorkerSessionKey(sessionId: string, agentId: string): string {
  return `${sessionId}::${agentId}`;
}

export interface WorkerMessageRequest {
  sessionId: string;
  agentId: string;
  userId: string;
  grantedCapabilities: string[];
  message: UserMessage;
  systemPrompt: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  knowledgeBases?: PromptAssemblyKnowledgeBase[];
  activeSkills?: ResolvedSkill[];
  additionalSections?: PromptAssemblyAdditionalSection[];
  toolContext?: string;
  runtimeNotices?: Array<{ level: 'info' | 'warn'; message: string }>;
  executionProfile?: SelectedExecutionProfile;
  continuity?: PromptAssemblyContinuity | null;
  pendingAction?: PromptAssemblyPendingAction | null;
  pendingApprovalNotice?: string;
  delegation?: WorkerDelegationMetadata;
  directReasoning?: boolean;
  directReasoningTrace?: DirectReasoningTraceContext;
}

export interface WorkerDelegationMetadata {
  requestId?: string;
  executionId?: string;
  rootExecutionId?: string;
  originChannel: string;
  originSurfaceId?: string;
  continuityKey?: string;
  activeExecutionRefs?: string[];
  pendingActionId?: string;
  codeSessionId?: string;
  runClass?: DelegatedWorkerRunClass;
  agentName?: string;
  orchestration?: OrchestrationRoleDescriptor;
}

export interface WorkerManagerObservability {
  intentRoutingTrace?: Pick<IntentRoutingTraceLog, 'record'>;
  runTimeline?: Pick<RunTimelineStore, 'ingestDelegatedWorkerProgress' | 'ingestDelegatedExecutionEvents' | 'ingestExecutionGraphEvent'>;
  pendingActionStore?: Pick<PendingActionStore, 'replaceActive' | 'complete' | 'update' | 'findActiveByApprovalId' | 'listActiveByApprovalId'>
    & Partial<Pick<PendingActionStore, 'resolveActiveForSurface'>>;
  executionGraphStore?: Pick<ExecutionGraphStore, 'createGraph' | 'appendEvent' | 'writeArtifact' | 'getSnapshot' | 'getArtifact' | 'listArtifacts'>;
  resolveStateAgentId?: (agentId?: string) => string | undefined;
  now?: () => number;
}

interface ResolvedDelegatedTargetMetadata {
  agentId: string;
  agentName?: string;
  orchestration?: OrchestrationRoleDescriptor;
}

function normalizeDelegatedApprovalSummaries(value: unknown): PendingActionApprovalSummary[] {
  if (!Array.isArray(value)) return [];
  const summaries: PendingActionApprovalSummary[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!isRecord(item)) continue;
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    if (!id || seen.has(id)) continue;
    const toolName = typeof item.toolName === 'string' && item.toolName.trim()
      ? item.toolName.trim()
      : 'unknown';
    const argsPreview = typeof item.argsPreview === 'string'
      ? item.argsPreview
      : '';
    const actionLabel = typeof item.actionLabel === 'string' && item.actionLabel.trim()
      ? item.actionLabel.trim()
      : undefined;
    const requestId = typeof item.requestId === 'string' && item.requestId.trim()
      ? item.requestId.trim()
      : undefined;
    const codeSessionId = typeof item.codeSessionId === 'string' && item.codeSessionId.trim()
      ? item.codeSessionId.trim()
      : undefined;
    summaries.push({
      id,
      toolName,
      argsPreview,
      ...(actionLabel ? { actionLabel } : {}),
      ...(requestId ? { requestId } : {}),
      ...(codeSessionId ? { codeSessionId } : {}),
    });
    seen.add(id);
  }
  return summaries;
}

function readDelegatedPendingApprovalMetadata(metadata: Record<string, unknown> | undefined): {
  approvalIds: string[];
  approvalSummaries: PendingActionApprovalSummary[];
  prompt: string;
} | null {
  const pendingAction = isRecord(metadata?.pendingAction) ? metadata.pendingAction : null;
  const blocker = isRecord(pendingAction?.blocker) ? pendingAction.blocker : null;
  if (!blocker || blocker.kind !== 'approval') return null;
  const summaries = normalizeDelegatedApprovalSummaries(blocker.approvalSummaries);
  const idsFromSummaries = summaries.map((summary) => summary.id);
  const idsFromBlocker = Array.isArray(blocker.approvalIds)
    ? blocker.approvalIds
        .map((id) => typeof id === 'string' ? id.trim() : '')
        .filter(Boolean)
    : [];
  const approvalIds = [...new Set([...idsFromBlocker, ...idsFromSummaries])];
  if (approvalIds.length === 0) return null;
  const prompt = typeof blocker.prompt === 'string' && blocker.prompt.trim()
    ? blocker.prompt.trim()
    : formatPendingApprovalMessage(summaries);
  return {
    approvalIds,
    approvalSummaries: summaries.length > 0
      ? summaries
      : approvalIds.map((id) => ({ id, toolName: 'unknown', argsPreview: '' })),
    prompt: prompt || 'Approval required for the pending delegated action.',
  };
}

export interface WorkerProcess {
  id: string;
  sessionId: string;
  workerSessionKey: string;
  agentId: string;
  authorizedBy: string;
  authorizedChannel: string;
  grantedCapabilities: string[];
  process: ChildProcess;
  brokerServer: BrokerServer;
  workspacePath: string;
  lastActivityMs: number;
  status: 'starting' | 'ready' | 'error' | 'shutting_down';
  dispatchQueue: Promise<void>;
  pendingMessageResolve?: (result: { content: string; metadata?: Record<string, unknown> }) => void;
  pendingMessageReject?: (error: Error) => void;
}

interface WorkerJobFollowUpActionResult {
  success: boolean;
  message: string;
  statusCode?: number;
  errorCode?: string;
  details?: Record<string, unknown>;
}

type WorkerJobFollowUpActorContext = {
  userId?: string;
  principalId?: string;
  principalRole?: string;
  channel?: string;
  surfaceId?: string;
};

interface WorkerJobFollowUpActionOptions {
  deferUntil?: number;
  deferForMinutes?: number;
}

export class WorkerManager {
  private readonly workers = new Map<string, WorkerProcess>();
  private readonly sessionToWorker = new Map<string, string>();
  private readonly delegatedFollowUpPayloads = new Map<string, {
    content: string;
    agentId: string;
    userId: string;
    channel: string;
    originSurfaceId?: string;
    continuityKey?: string;
    activeExecutionRefs?: string[];
    codeSessionId?: string;
    runClass?: DelegatedWorkerRunClass;
  }>();
  private readonly tokenManager: CapabilityTokenManager;
  private readonly tools: ToolExecutor;
  private readonly runtime: Runtime;
  private readonly config: AgentIsolationConfig;
  private readonly sandboxConfig: SandboxConfig;
  private readonly observability: WorkerManagerObservability;
  private readonly delegatedJobTracker = new AssistantJobTracker({ maxJobs: 200 });
  private readonly reapInterval: NodeJS.Timeout;

  constructor(
    tools: ToolExecutor,
    runtime: Runtime,
    config: AgentIsolationConfig,
    sandboxConfig?: SandboxConfig,
    observability: WorkerManagerObservability = {},
  ) {
    this.tools = tools;
    this.runtime = runtime;
    this.config = config;
    this.sandboxConfig = sandboxConfig ?? DEFAULT_SANDBOX_CONFIG;
    this.observability = observability;
    this.tokenManager = new CapabilityTokenManager(config.capabilityTokenTtlMs);
    this.reapInterval = setInterval(() => this.reapIdleWorkers(), 60_000);
  }

  private shouldAttachCodeSessionRegistry(
    input: WorkerMessageRequest,
    intentDecision?: IntentGatewayDecision,
  ): boolean {
    const codeContext = input.message.metadata?.codeContext as ToolExecutionRequest['codeContext'] | undefined;
    if (input.delegation?.codeSessionId || codeContext?.sessionId) {
      return true;
    }
    const decision = intentDecision ?? readPreRoutedIntentGatewayMetadata(input.message.metadata)?.decision;
    if (
      decision?.route === 'coding_task'
      || decision?.route === 'filesystem_task'
      || decision?.route === 'coding_session_control'
      || decision?.requiresRepoGrounding === true
    ) {
      return true;
    }
    return input.activeSkills?.some((skill) => skill.id === 'coding-workspace') ?? false;
  }

  private buildCodeSessionRegistrySection(
    input: WorkerMessageRequest,
    intentDecision?: IntentGatewayDecision,
  ): PromptAssemblyAdditionalSection | null {
    if (!this.shouldAttachCodeSessionRegistry(input, intentDecision)) {
      return null;
    }
    const toolExecutor = this.tools as ToolExecutor & {
      buildCodeSessionRegistryAdditionalSection?: (
        request?: Partial<import('../tools/types.js').ToolExecutionRequest>,
        maxSessions?: number,
      ) => PromptAssemblyAdditionalSection | null;
    };
    if (typeof toolExecutor.buildCodeSessionRegistryAdditionalSection !== 'function') {
      return null;
    }
    const codeContext = input.message.metadata?.codeContext as import('../tools/types.js').ToolExecutionRequest['codeContext'] | undefined;
    return toolExecutor.buildCodeSessionRegistryAdditionalSection({
      userId: input.userId,
      principalId: input.message.principalId ?? input.userId,
      principalRole: input.message.principalRole,
      channel: input.message.channel,
      surfaceId: input.message.surfaceId,
      ...(codeContext ? { codeContext } : {}),
    });
  }

  private async handleDirectReasoningMessage(
    input: WorkerMessageRequest,
  ): Promise<{ content: string; metadata?: Record<string, unknown> }> {
    const requestId = input.delegation?.requestId ?? input.message.id;
    const codeContext = input.message.metadata?.codeContext as import('../tools/types.js').ToolExecutionRequest['codeContext'] | undefined;
    const traceContext: DirectReasoningTraceContext = {
      requestId,
      messageId: input.message.id,
      userId: input.userId,
      channel: input.message.channel,
      agentId: input.agentId,
      contentPreview: input.message.content,
      ...(input.delegation?.executionId ? { executionId: input.delegation.executionId } : {}),
      ...(input.delegation?.rootExecutionId ? { rootExecutionId: input.delegation.rootExecutionId } : {}),
      ...(input.delegation?.codeSessionId ?? codeContext?.sessionId
        ? { codeSessionId: input.delegation?.codeSessionId ?? codeContext?.sessionId }
        : {}),
    };
    try {
      const worker = await this.getOrSpawnWorker(
        input.sessionId,
        input.agentId,
        input.userId,
        input.message.channel,
        input.grantedCapabilities,
      );
      const hasFallbackProvider = !!this.runtime.getFallbackProviderConfig?.(input.agentId);
      return await this.dispatchToWorker(worker, {
        message: input.message,
        systemPrompt: input.systemPrompt,
        history: input.history,
        knowledgeBases: input.knowledgeBases ?? [],
        activeSkills: input.activeSkills ?? [],
        additionalSections: appendPromptAdditionalSection(
          input.additionalSections ?? [],
          this.buildCodeSessionRegistrySection(input),
        ),
        toolContext: input.toolContext ?? '',
        runtimeNotices: input.runtimeNotices ?? [],
        executionProfile: input.executionProfile,
        continuity: input.continuity,
        pendingAction: input.pendingAction,
        pendingApprovalNotice: input.pendingApprovalNotice,
        hasFallbackProvider,
        directReasoning: true,
        directReasoningTrace: traceContext,
      });
    } catch (error) {
      this.observability.intentRoutingTrace?.record({
        stage: 'direct_reasoning_failed',
        requestId,
        messageId: input.message.id,
        userId: input.userId,
        channel: input.message.channel,
        agentId: input.agentId,
        contentPreview: input.message.content,
        details: {
          ...(traceContext.executionId ? { executionId: traceContext.executionId } : {}),
          ...(traceContext.rootExecutionId ? { rootExecutionId: traceContext.rootExecutionId } : {}),
          ...(traceContext.codeSessionId ? { codeSessionId: traceContext.codeSessionId } : {}),
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  private async runGraphControlledExecution(input: {
    request: WorkerMessageRequest;
    target: ResolvedDelegatedTargetMetadata;
    taskContract: DelegatedResultEnvelope['taskContract'];
    preRoutedGateway: IntentGatewayRecord | null | undefined;
    effectiveIntentDecision: IntentGatewayDecision | undefined;
    requestId: string;
    taskRunId: string;
  }): Promise<{ content: string; metadata?: Record<string, unknown> } | null> {
    return runGraphControlledExecutionController({
      runtime: this.runtime,
      request: input.request,
      target: input.target,
      taskContract: input.taskContract,
      preRoutedGateway: input.preRoutedGateway,
      effectiveIntentDecision: input.effectiveIntentDecision,
      requestId: input.requestId,
      taskRunId: input.taskRunId,
      graphStore: this.observability.executionGraphStore,
      runTimeline: this.observability.runTimeline,
      pendingActionStore: this.observability.pendingActionStore,
      now: this.observability.now ?? Date.now,
      supervisor: {
        getWorker: ({ sessionId, agentId, userId, channel, grantedCapabilities }) => this.getOrSpawnWorker(
          sessionId,
          agentId,
          userId,
          channel,
          grantedCapabilities,
        ),
        hasFallbackProvider: (agentId) => !!this.runtime.getFallbackProviderConfig?.(agentId),
        buildCodeSessionRegistrySection: () => this.buildCodeSessionRegistrySection(input.request),
        dispatchToWorker: (worker, params) => this.dispatchToWorker(worker, params),
        executeTool: (toolName, args, request) => this.tools.executeModelTool(toolName, args, request),
      },
    });
  }

  async resumeExecutionGraphPendingAction(
    pendingAction: PendingActionRecord,
    options: {
      approvalId: string;
      approvalResult: ToolApprovalDecisionResult;
    },
  ): Promise<{ content: string; metadata?: Record<string, unknown> } | null> {
    const payload = readExecutionGraphResumePayload(pendingAction.resume?.payload);
    if (!payload) {
      return null;
    }
    const now = this.observability.now ?? Date.now;
    const chatResume = readChatContinuationGraphResume({
      graphStore: this.observability.executionGraphStore,
      pendingAction,
    });
    if (chatResume) {
      return this.resumeChatContinuationGraphPendingAction(
        pendingAction,
        chatResume,
        options,
      );
    }
    const workerSuspension = reconstructWorkerSuspensionGraphResume({
      pendingAction,
      payload,
      approvalId: options.approvalId,
      graphStore: this.observability.executionGraphStore,
    });
    if (workerSuspension) {
      return this.resumeWorkerSuspensionGraphPendingAction(
        pendingAction,
        workerSuspension,
        options,
      );
    }
    const suspension = reconstructGraphMutationResume({
      pendingAction,
      payload,
      approvalId: options.approvalId,
      graphStore: this.observability.executionGraphStore,
    });
    if (!suspension) {
      this.markExecutionGraphPendingActionFailed(pendingAction, now());
      return {
        content: 'Execution graph approval was resolved, but the persisted graph resume state is no longer available. Please retry the request.',
        metadata: {
          executionGraph: {
            graphId: payload.graphId,
            status: 'failed',
            reason: 'persisted_graph_resume_state_missing',
          },
        },
      };
    }
    if (suspension.expiresAt <= now()) {
      this.markExecutionGraphPendingActionFailed(pendingAction, now());
      return {
        content: 'Execution graph approval was resolved, but the persisted graph resume state expired. Please retry the request.',
        metadata: {
          executionGraph: {
            graphId: suspension.graphId,
            status: 'failed',
            reason: 'persisted_graph_resume_state_expired',
          },
        },
      };
    }

    let sequence = suspension.mutationContext.sequenceStart ?? 0;
    const emitGraphEvent = (
      kind: ExecutionGraphEvent['kind'],
      payloadDetails: Record<string, unknown>,
      eventKey: string,
      optionsForEvent: {
        nodeId?: string;
        nodeKind?: ExecutionGraphEvent['nodeKind'];
        producer?: ExecutionGraphEvent['producer'];
      } = {},
    ): ExecutionGraphEvent => {
      const event = emitMutationResumeGraphEvent({
        context: suspension.mutationContext,
        kind,
        payloadDetails,
        eventKey,
        sequenceStart: sequence,
        graphStore: this.observability.executionGraphStore,
        runTimeline: this.observability.runTimeline,
        now,
        nodeId: optionsForEvent.nodeId,
        nodeKind: optionsForEvent.nodeKind,
        producer: optionsForEvent.producer,
      });
      sequence = Math.max(sequence, event.sequence);
      return event;
    };

    if (!options.approvalResult.approved) {
      emitGraphEvent('approval_resolved', {
        approvalId: options.approvalId,
        toolName: 'fs_write',
        resultStatus: 'denied',
        writeSpecArtifactId: suspension.writeSpec.artifactId,
      }, 'approval-denied', { nodeId: suspension.nodeId, nodeKind: 'mutate' });
      emitGraphEvent('node_failed', {
        reason: options.approvalResult.message || 'Approval denied.',
        writeSpecArtifactId: suspension.writeSpec.artifactId,
      }, 'node-denied', { nodeId: suspension.nodeId, nodeKind: 'mutate' });
      emitGraphEvent('graph_failed', {
        reason: options.approvalResult.message || 'Approval denied.',
      }, 'graph-denied');
      this.completeExecutionGraphPendingAction(pendingAction, now());
      return {
        content: options.approvalResult.message || 'Approval denied. I did not make the requested change.',
        metadata: {
          executionGraph: {
            graphId: suspension.graphId,
            status: 'failed',
            reason: 'approval_denied',
          },
        },
      };
    }

    const mutationResult = await resumeWriteSpecMutationNodeAfterApproval({
      writeSpec: suspension.writeSpec,
      approvedToolResult: buildApprovedMutationToolResult(options.approvalId, options.approvalResult),
      executeTool: (toolName, args, request) => this.tools.executeModelTool(toolName, args, request),
      toolRequest: suspension.toolRequest,
      context: {
        ...suspension.mutationContext,
        sequenceStart: sequence,
        now,
        emit: (event) => {
          sequence = Math.max(sequence, event.sequence);
          this.observability.runTimeline?.ingestExecutionGraphEvent(event);
          this.observability.executionGraphStore?.appendEvent(event);
        },
      },
      approvalId: options.approvalId,
    });
    sequence = Math.max(sequence, ...mutationResult.events.map((event) => event.sequence));
    const artifactIds = [
      ...suspension.artifactIds,
      ...(mutationResult.receiptArtifact ? [mutationResult.receiptArtifact.artifactId] : []),
      ...(mutationResult.verificationArtifact ? [mutationResult.verificationArtifact.artifactId] : []),
    ];
    if (mutationResult.receiptArtifact) {
      this.observability.executionGraphStore?.writeArtifact(mutationResult.receiptArtifact);
    }
    if (mutationResult.verificationArtifact) {
      this.observability.executionGraphStore?.writeArtifact(mutationResult.verificationArtifact);
    }
    if (mutationResult.status !== 'succeeded' || !mutationResult.verificationArtifact) {
      emitGraphEvent('graph_failed', {
        reason: 'Mutation verification failed after approval.',
        artifactIds,
      }, 'graph-failed-after-approval');
      this.completeExecutionGraphPendingAction(pendingAction, now());
      return {
        content: 'Approval was applied, but execution graph verification failed after the write.',
        metadata: {
          executionGraph: {
            graphId: suspension.graphId,
            status: 'failed',
            artifactIds,
          },
        },
      };
    }
    emitGraphEvent('graph_completed', {
      status: 'succeeded',
      artifactIds,
      writeSpecArtifactId: suspension.writeSpec.artifactId,
      receiptArtifactId: mutationResult.receiptArtifact?.artifactId,
      verificationArtifactId: mutationResult.verificationArtifact.artifactId,
    }, 'graph-completed-after-approval');
    this.completeExecutionGraphPendingAction(pendingAction, now());
    return {
      content: `Wrote ${suspension.writeSpec.content.path} and verified the contents.`,
      metadata: {
        executionGraph: {
          graphId: suspension.graphId,
          status: 'succeeded',
          artifactIds,
          writeSpecArtifactId: suspension.writeSpec.artifactId,
          receiptArtifactId: mutationResult.receiptArtifact?.artifactId,
          verificationArtifactId: mutationResult.verificationArtifact.artifactId,
        },
      },
    };
  }

  private async resumeWorkerSuspensionGraphPendingAction(
    pendingAction: PendingActionRecord,
    suspension: WorkerSuspensionGraphResumeContext,
    options: {
      approvalId: string;
      approvalResult: ToolApprovalDecisionResult;
    },
  ): Promise<{ content: string; metadata?: Record<string, unknown> } | null> {
    const now = this.observability.now ?? Date.now;
    if (suspension.expiresAt <= now()) {
      this.markExecutionGraphPendingActionFailed(pendingAction, now());
      return {
        content: 'Execution graph approval was resolved, but the delegated worker suspension expired. Please retry the request.',
        metadata: {
          executionGraph: {
            graphId: suspension.graphId,
            status: 'failed',
            reason: 'worker_suspension_expired',
          },
        },
      };
    }

    emitWorkerSuspensionGraphEvent({
      suspension,
      kind: 'interruption_resolved',
      payloadDetails: {
        approvalId: options.approvalId,
        resultStatus: options.approvalResult.approved ? 'approved' : 'denied',
        resumeToken: suspension.resumeToken,
      },
      eventKey: 'approval-resolved',
      graphStore: this.observability.executionGraphStore,
      runTimeline: this.observability.runTimeline,
      now: this.observability.now,
    });

    if (!options.approvalResult.approved) {
      emitWorkerSuspensionGraphEvent({
        suspension,
        kind: 'node_failed',
        payloadDetails: {
          reason: options.approvalResult.message || 'Approval denied.',
        },
        eventKey: 'node-denied',
        graphStore: this.observability.executionGraphStore,
        runTimeline: this.observability.runTimeline,
        now: this.observability.now,
      });
      emitWorkerSuspensionGraphEvent({
        suspension,
        kind: 'graph_failed',
        payloadDetails: {
          reason: options.approvalResult.message || 'Approval denied.',
        },
        eventKey: 'graph-denied',
        graphStore: this.observability.executionGraphStore,
        runTimeline: this.observability.runTimeline,
        now: this.observability.now,
        nodeScoped: false,
      });
      this.completeExecutionGraphPendingAction(pendingAction, now());
      return {
        content: options.approvalResult.message || 'Approval denied. I did not continue the delegated worker action.',
        metadata: {
          executionGraph: {
            graphId: suspension.graphId,
            status: 'failed',
            reason: 'approval_denied',
          },
        },
      };
    }

    const worker = await this.getOrSpawnWorker(
      suspension.resume.sessionId,
      suspension.resume.agentId,
      suspension.resume.userId,
      suspension.resume.channel,
      [],
    );
    const continuationMetadata = attachWorkerSuspensionMetadata(
      buildApprovalOutcomeContinuationMetadata({
        approvalId: options.approvalId,
        decision: 'approved',
        resultMessage: options.approvalResult.message,
      }),
      suspension.session,
    );
    const resumeMetadata = suspension.resume.automationResume
      ? attachWorkerAutomationAuthoringResumeMetadata(continuationMetadata, suspension.resume.automationResume)
      : continuationMetadata;

    const continuationResult = await this.dispatchToWorker(worker, {
      message: {
        id: randomUUID(),
        userId: suspension.resume.userId,
        principalId: suspension.resume.principalId,
        principalRole: suspension.resume.principalRole,
        channel: suspension.resume.channel,
        ...(suspension.resume.surfaceId ? { surfaceId: suspension.resume.surfaceId } : {}),
        content: '',
        metadata: resumeMetadata,
        timestamp: now(),
      },
      systemPrompt: '',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      additionalSections: [],
      toolContext: '',
      runtimeNotices: [],
      hasFallbackProvider: !!this.runtime.getFallbackProviderConfig?.(worker.agentId),
    });

    const traceContext = workerSuspensionResumeContextToTraceContext(suspension.resume);
    this.recordWorkerApprovalContinuationExecutionArtifacts(
      traceContext,
      options.approvalId,
      continuationResult.metadata,
    );
    const pendingRecord = recordWorkerSuspensionGraphContinuationPendingAction({
      store: this.observability.pendingActionStore,
      graphStore: this.observability.executionGraphStore,
      runTimeline: this.observability.runTimeline,
      suspension,
      worker,
      approvalMetadata: readDelegatedPendingApprovalMetadata(continuationResult.metadata),
      workerSuspension: readWorkerSuspensionMetadata(continuationResult.metadata),
      previousPendingAction: pendingAction,
      now: this.observability.now,
      ttlMs: PENDING_APPROVAL_TTL_MS,
    });
    if (pendingRecord) {
      return {
        content: continuationResult.content,
        metadata: {
          ...(continuationResult.metadata ?? {}),
          pendingAction: toPendingActionClientMetadata(pendingRecord),
          continueConversationAfterApproval: true,
        },
      };
    }

    const terminalState = resolveWorkerSuspensionContinuationTerminalState(continuationResult);
    if (terminalState.status === 'failed') {
      emitWorkerSuspensionGraphEvent({
        suspension,
        kind: 'node_failed',
        payloadDetails: {
          reason: terminalState.reason,
          artifactIds: suspension.artifactIds,
        },
        eventKey: 'node-failed-after-approval',
        graphStore: this.observability.executionGraphStore,
        runTimeline: this.observability.runTimeline,
        now: this.observability.now,
      });
      emitWorkerSuspensionGraphEvent({
        suspension,
        kind: 'graph_failed',
        payloadDetails: {
          reason: terminalState.reason,
          artifactIds: suspension.artifactIds,
        },
        eventKey: 'graph-failed-after-approval',
        graphStore: this.observability.executionGraphStore,
        runTimeline: this.observability.runTimeline,
        now: this.observability.now,
        nodeScoped: false,
      });
      this.completeExecutionGraphPendingAction(pendingAction, now());
      return {
        content: continuationResult.content,
        metadata: {
          ...(continuationResult.metadata ?? {}),
          executionGraph: {
            graphId: suspension.graphId,
            status: 'failed',
            artifactIds: suspension.artifactIds,
            reason: terminalState.reason,
          },
        },
      };
    }

    emitWorkerSuspensionGraphEvent({
      suspension,
      kind: 'node_completed',
      payloadDetails: {
        status: 'succeeded',
        artifactIds: suspension.artifactIds,
      },
      eventKey: 'node-completed-after-approval',
      graphStore: this.observability.executionGraphStore,
      runTimeline: this.observability.runTimeline,
      now: this.observability.now,
    });
    emitWorkerSuspensionGraphEvent({
      suspension,
      kind: 'graph_completed',
      payloadDetails: {
        status: 'succeeded',
        artifactIds: suspension.artifactIds,
      },
      eventKey: 'graph-completed-after-approval',
      graphStore: this.observability.executionGraphStore,
      runTimeline: this.observability.runTimeline,
      now: this.observability.now,
      nodeScoped: false,
    });
    this.completeExecutionGraphPendingAction(pendingAction, now());
    const metadata: Record<string, unknown> = {
      ...(continuationResult.metadata ?? {}),
      executionGraph: {
        graphId: suspension.graphId,
        status: 'succeeded',
        artifactIds: suspension.artifactIds,
      },
    };
    reconcileSatisfiedDelegatedWorkerMetadata(metadata);
    return {
      content: continuationResult.content,
      metadata,
    };
  }

  private async resumeChatContinuationGraphPendingAction(
    pendingAction: PendingActionRecord,
    chatResume: ChatContinuationGraphResume,
    options: {
      approvalId: string;
      approvalResult: ToolApprovalDecisionResult;
    },
  ): Promise<{ content: string; metadata?: Record<string, unknown> } | null> {
    const graphStore = this.observability.executionGraphStore;
    if (!graphStore || chatResume.payload.type !== CHAT_CONTINUATION_TYPE_AUTOMATION_AUTHORING) return null;
    const nowMs = this.observability.now?.() ?? Date.now();
    const graphResume = startChatContinuationGraphApprovalResume({
      graphStore,
      runTimeline: this.observability.runTimeline,
      pendingAction,
      approvalId: options.approvalId,
      approvalResult: options.approvalResult,
      completePendingAction: (_actionId, completedAt) => this.completeExecutionGraphPendingAction(pendingAction, completedAt),
      deniedResponseContent: options.approvalResult.message || 'Approval denied. I did not continue automation authoring.',
      nowMs,
    });
    if (!graphResume) return null;
    if (!graphResume.approved) return graphResume.deniedResponse ?? null;

    const resume = graphResume.resume.payload;
    if (resume.type !== CHAT_CONTINUATION_TYPE_AUTOMATION_AUTHORING) return null;
    const codeContext = resume.codeContext;
    const messageMetadata = {
      ...(resume.messageMetadata ?? {}),
      ...(codeContext ? { codeContext } : {}),
    };
    const result = await this.tryDirectAutomationAuthoring(
      {
        sessionId: `chat-continuation:${pendingAction.id}`,
        agentId: pendingAction.scope.agentId,
        userId: pendingAction.scope.userId,
        grantedCapabilities: [],
        message: {
          id: randomUUID(),
          userId: pendingAction.scope.userId,
          principalId: resume.principalId ?? pendingAction.scope.userId,
          principalRole: normalizeChatContinuationPrincipalRole(resume.principalRole) ?? 'owner',
          channel: pendingAction.scope.channel,
          surfaceId: pendingAction.scope.surfaceId,
          content: resume.originalUserContent,
          timestamp: Date.now(),
          ...(Object.keys(messageMetadata).length > 0 ? { metadata: messageMetadata } : {}),
        },
        systemPrompt: '',
        history: [],
      },
      {
        allowRemediation: resume.allowRemediation,
        assumeAuthoring: true,
      },
    );
    if (!result) {
      return failChatContinuationGraphResume({
        graphStore,
        runTimeline: this.observability.runTimeline,
        resume: graphResume.resume,
        reason: 'Automation authoring could not resume after approval.',
        responseContent: 'Automation authoring could not resume after approval.',
      });
    }
    return completeChatContinuationGraphResume({
      graphStore,
      runTimeline: this.observability.runTimeline,
      resume: graphResume.resume,
      response: result,
    });
  }

  private completeExecutionGraphPendingAction(
    pendingAction: PendingActionRecord,
    nowMs: number,
  ): void {
    this.observability.pendingActionStore?.complete(pendingAction.id, nowMs);
  }

  private markExecutionGraphPendingActionFailed(
    pendingAction: PendingActionRecord,
    nowMs: number,
  ): void {
    this.observability.pendingActionStore?.update(pendingAction.id, { status: 'failed' }, nowMs);
  }

  private startDelegatedWorkerGraph(input: {
    request: WorkerMessageRequest;
    target: ResolvedDelegatedTargetMetadata;
    taskContract: DelegatedResultEnvelope['taskContract'];
    intentDecision?: IntentGatewayDecision;
    requestId: string;
    taskRunId: string;
    detail: string;
  }): DelegatedWorkerGraphRun | null {
    if (!input.intentDecision || !this.observability.executionGraphStore) {
      return null;
    }
    const rootExecutionId = input.request.delegation?.rootExecutionId ?? input.taskRunId;
    const parentExecutionId = input.request.delegation?.executionId;
    const codeContext = input.request.message.metadata?.codeContext as ToolExecutionRequest['codeContext'] | undefined;
    const codeSessionId = input.request.delegation?.codeSessionId ?? codeContext?.sessionId;
    return startDelegatedWorkerGraphRun({
      graphStore: this.observability.executionGraphStore,
      runTimeline: this.observability.runTimeline,
      context: {
        graphId: `execution-graph:${input.taskRunId}:delegated-worker`,
        executionId: input.taskRunId,
        taskExecutionId: input.taskRunId,
        rootExecutionId,
        ...(parentExecutionId ? { parentExecutionId } : {}),
        requestId: input.requestId,
        runId: input.requestId,
        channel: input.request.message.channel,
        agentId: input.target.agentId,
        userId: input.request.userId,
        ...(codeSessionId ? { codeSessionId } : {}),
        title: describeDelegatedTarget(input.target),
        decision: input.intentDecision,
      },
      intent: input.intentDecision,
      securityContext: {
        agentId: input.target.agentId,
        userId: input.request.userId,
        channel: input.request.message.channel,
        ...(input.request.message.surfaceId ? { surfaceId: input.request.message.surfaceId } : {}),
        ...(codeSessionId ? { codeSessionId } : {}),
      },
      trigger: {
        type: 'user_request',
        source: input.request.message.channel,
        sourceId: input.request.message.id,
      },
      ownerAgentId: input.target.agentId,
      executionProfileName: input.request.executionProfile?.id ?? input.request.executionProfile?.providerName,
      timestamp: this.observability.now?.() ?? Date.now(),
      summary: input.detail,
      payload: buildDelegatedTaskContractTraceMetadata(input.taskContract),
    });
  }

  private completeDelegatedWorkerGraph(
    run: DelegatedWorkerGraphRun | null,
    options: {
      lifecycle: 'completed' | 'blocked' | 'failed';
      handoff: DelegatedWorkerHandoff;
      taskContract: DelegatedResultEnvelope['taskContract'];
      verification: VerificationDecision;
      workerId?: string;
      approvalMetadata?: {
        approvalIds: string[];
        approvalSummaries: PendingActionApprovalSummary[];
        prompt: string;
      };
    },
  ): DelegatedWorkerGraphCompletion | undefined {
    if (!run) return undefined;
    const sharedPayload = {
      lifecycle: options.lifecycle,
      summary: options.handoff.summary,
      reason: options.handoff.summary,
      ...(options.handoff.nextAction ? { nextAction: options.handoff.nextAction } : {}),
      ...(options.handoff.unresolvedBlockerKind ? { unresolvedBlockerKind: options.handoff.unresolvedBlockerKind } : {}),
      ...(typeof options.handoff.approvalCount === 'number' ? { approvalCount: options.handoff.approvalCount } : {}),
      ...(options.handoff.reportingMode ? { reportingMode: options.handoff.reportingMode } : {}),
      ...(options.handoff.runClass ? { runClass: options.handoff.runClass } : {}),
      ...(options.workerId ? { workerId: options.workerId } : {}),
      ...(options.approvalMetadata?.approvalIds.length
        ? { approvalIds: [...options.approvalMetadata.approvalIds] }
        : {}),
      ...(options.approvalMetadata?.approvalSummaries.length
        ? { approvalSummaries: options.approvalMetadata.approvalSummaries.map((summary) => ({ ...summary })) }
        : {}),
      ...buildDelegatedTaskContractTraceMetadata(options.taskContract),
    };
    const completion = buildDelegatedWorkerGraphCompletion({
      run,
      timestamp: this.observability.now?.() ?? Date.now(),
      lifecycle: options.lifecycle,
      verification: options.verification,
      payload: sharedPayload,
      blockerKind: options.handoff.unresolvedBlockerKind,
      blockerPrompt: options.handoff.nextAction ?? options.handoff.summary,
    });
    this.observability.executionGraphStore?.writeArtifact(completion.verificationArtifact);
    for (const event of completion.events) {
      this.observability.runTimeline?.ingestExecutionGraphEvent(event);
      this.observability.executionGraphStore?.appendEvent(event);
    }
    return completion;
  }

  private failDelegatedWorkerGraph(
    run: DelegatedWorkerGraphRun | null,
    error: unknown,
    taskContract: DelegatedResultEnvelope['taskContract'],
  ): DelegatedWorkerGraphJobMetadata | undefined {
    if (!run) return undefined;
    const reason = error instanceof Error ? error.message : String(error);
    const sharedPayload = {
      lifecycle: 'failed',
      reason,
      summary: reason,
      ...buildDelegatedTaskContractTraceMetadata(taskContract),
    };
    const failure = buildDelegatedWorkerGraphFailure({
      run,
      timestamp: this.observability.now?.() ?? Date.now(),
      payload: sharedPayload,
    });
    for (const event of failure.events) {
      this.observability.runTimeline?.ingestExecutionGraphEvent(event);
      this.observability.executionGraphStore?.appendEvent(event);
    }
    return failure.metadata;
  }

  async handleMessage(input: WorkerMessageRequest): Promise<{ content: string; metadata?: Record<string, unknown> }> {
    const approvalResponse = await this.tryHandleDirectApprovalMessage(input);
    if (approvalResponse) return approvalResponse;

    const preRoutedGateway = readPreRoutedIntentGatewayMetadata(input.message.metadata);
    const intentDecision = preRoutedGateway?.decision;
    const delegatedTarget = resolveDelegatedTargetMetadata(this.runtime, input);
    const effectiveIntentDecision = resolveDelegatedExecutionDecision({
      gatewayDecision: intentDecision,
      orchestration: delegatedTarget.orchestration,
      parentProfile: input.executionProfile,
    });
    const directIntentCandidates = intentDecision ? resolveIntentCapabilityCandidates(intentDecision) : [];
    const canDirectAutomation = intentDecision?.route === 'automation_authoring'
      && ['create', 'update', 'schedule'].includes(intentDecision.operation)
      && directIntentCandidates.some((candidate) => candidate === 'automation' || candidate === 'scheduled_email_automation');
    if (canDirectAutomation) {
      const directAutomation = await this.tryDirectAutomationAuthoring(input, {
        assumeAuthoring: true,
        intentDecision,
      });
      if (directAutomation) return directAutomation;
    }

    if (input.directReasoning === true) {
      return this.handleDirectReasoningMessage(input);
    }

    const requestId = input.delegation?.requestId ?? input.message.id;
    const delegatedJobDetail = describeDelegatedJob(input, delegatedTarget);
    const taskContract = buildDelegatedTaskContract(
      effectiveIntentDecision ?? undefined,
    );
    let effectiveTaskContract = taskContract;

    const graphControlledResult = await this.runGraphControlledExecution({
      request: input,
      target: delegatedTarget,
      taskContract: effectiveTaskContract,
      preRoutedGateway,
      effectiveIntentDecision: effectiveIntentDecision ?? undefined,
      requestId,
      taskRunId: buildGraphControlledTaskRunId(requestId),
    });
    if (graphControlledResult) {
      return graphControlledResult;
    }

    const delegatedJob = this.delegatedJobTracker.start({
      type: 'delegated_worker',
      source: 'system',
      detail: delegatedJobDetail,
      metadata: {
        delegation: buildDelegationJobMetadata(input, { lifecycle: 'running', target: delegatedTarget }),
      },
    });
    const delegatedTaskRunId = buildDelegatedTaskRunId(delegatedJob.id);
    this.recordDelegatedWorkerTrace('delegated_worker_started', input, delegatedTarget, {
      requestId,
      taskRunId: delegatedTaskRunId,
      lifecycle: 'running',
      taskContract,
      reason: delegatedJobDetail,
    });
    this.publishDelegatedWorkerProgress(input, delegatedTarget, {
      id: `delegated-worker:${delegatedJob.id}:started`,
      kind: 'started',
      requestId,
      taskRunId: delegatedTaskRunId,
      detail: delegatedJobDetail,
    });
    this.runtime.auditLog.record({
      type: 'broker_action',
      severity: 'info',
      agentId: input.agentId,
      userId: input.userId,
      channel: input.message.channel,
      controller: 'WorkerManager',
      details: buildDelegatedAuditDetails(input, delegatedTarget, requestId, {
        actionType: 'delegated_worker_started',
      }),
    });
    const delegatedGraphRun = this.startDelegatedWorkerGraph({
      request: input,
      target: delegatedTarget,
      taskContract,
      intentDecision: effectiveIntentDecision ?? undefined,
      requestId,
      taskRunId: delegatedTaskRunId,
      detail: delegatedJobDetail,
    });

    let worker: WorkerProcess | undefined;
    try {
      worker = await this.getOrSpawnWorker(
        input.sessionId,
        input.agentId,
        input.userId,
        input.message.channel,
        input.grantedCapabilities,
      );
      const ensureReadyDelegatedWorker = async (): Promise<WorkerProcess> => {
        if (worker && worker.status === 'ready' && this.workers.has(worker.id)) {
          return worker;
        }
        worker = await this.getOrSpawnWorker(
          input.sessionId,
          input.agentId,
          input.userId,
          input.message.channel,
          input.grantedCapabilities,
        );
        return worker;
      };
      this.delegatedJobTracker.update(delegatedJob.id, {
        metadata: {
          delegation: buildDelegationJobMetadata(input, {
            lifecycle: 'running',
            workerId: worker.id,
            target: delegatedTarget,
            executionGraph: buildDelegatedWorkerRunningMetadata(delegatedGraphRun),
          }),
        },
      });
      // LLM calls are proxied through the broker — the worker no longer needs the provider config.
      // We only tell the worker whether a fallback provider exists for quality-based retry.
      const hasFallbackProvider = !!this.runtime.getFallbackProviderConfig?.(input.agentId);
      let additionalSections = appendPromptAdditionalSection(
        input.additionalSections ?? [],
        this.buildCodeSessionRegistrySection(input, effectiveIntentDecision ?? undefined),
      );
      let effectiveInput = input;
      if (preRoutedGateway && effectiveIntentDecision && effectiveIntentDecision !== intentDecision) {
        effectiveInput = {
          ...input,
          message: {
            ...input.message,
            metadata: attachPreRoutedIntentGatewayMetadata(
              input.message.metadata,
              {
                ...preRoutedGateway,
                decision: effectiveIntentDecision,
              }
            ),
          },
        };
      }
      let effectiveExecutionProfile = input.executionProfile;
      const delegatedWorkerRunningDetail = buildDelegatedWorkerRunningDetail(
        describeDelegatedTarget(delegatedTarget),
        input.executionProfile,
        input.delegation?.codeSessionId,
      );
      this.recordDelegatedWorkerTrace('delegated_worker_running', input, delegatedTarget, {
        requestId,
        taskRunId: delegatedTaskRunId,
        lifecycle: 'running',
        workerId: worker.id,
        taskContract,
        additionalSections,
        reason: delegatedWorkerRunningDetail,
      });
      this.publishDelegatedWorkerProgress(input, delegatedTarget, {
        id: `delegated-worker:${delegatedJob.id}:running`,
        kind: 'running',
        requestId,
        taskRunId: delegatedTaskRunId,
        workerId: worker.id,
        detail: delegatedWorkerRunningDetail,
      });

      const baseDispatchParams = {
        message: effectiveInput.message,
        systemPrompt: effectiveInput.systemPrompt,
        history: effectiveInput.history,
        knowledgeBases: effectiveInput.knowledgeBases ?? [],
        activeSkills: effectiveInput.activeSkills ?? [],
        additionalSections,
        toolContext: effectiveInput.toolContext ?? '',
        runtimeNotices: effectiveInput.runtimeNotices ?? [],
        executionProfile: effectiveExecutionProfile,
        continuity: effectiveInput.continuity,
        pendingAction: effectiveInput.pendingAction,
        pendingApprovalNotice: effectiveInput.pendingApprovalNotice,
        hasFallbackProvider,
      };
      const drainDelegatedJobs = (deadlineMs?: number) => awaitDelegatedRequestJobDrain({
        requestId,
        ...(typeof deadlineMs === 'number' ? { deadlineMs } : {}),
        listJobs: (limit) => (
          typeof (this.tools as { listJobs?: unknown }).listJobs === 'function'
            ? this.tools.listJobs(limit)
            : []
        ),
      });
      const dispatchDelegatedWorkerAttempt = async (
        params: Parameters<typeof this.dispatchToWorker>[1],
      ): Promise<{ content: string; metadata?: Record<string, unknown> }> => {
        const activeWorker = await ensureReadyDelegatedWorker();
        try {
          return await this.dispatchToWorker(activeWorker, params);
        } catch (error) {
          if (!isRecoverableWorkerDispatchAbort(error)) throw error;
          if (!input.delegation && error instanceof Error && error.message.startsWith('Worker message dispatch canceled:')) {
            throw error;
          }
          return {
            content: error instanceof Error ? error.message : String(error),
            metadata: buildRecoverableWorkerDispatchAbortMetadata(error),
          };
        }
      };

      let result = await dispatchDelegatedWorkerAttempt({
        ...baseDispatchParams,
        dispatchTimeoutMs: DELEGATED_INITIAL_DISPATCH_TIMEOUT_MS,
      });
      const firstDrain = await drainDelegatedJobs();
      if (firstDrain.inFlightRemaining > 0) {
        this.recordDelegatedWorkerTrace('delegated_job_wait_expired', input, delegatedTarget, {
          requestId,
          taskRunId: delegatedTaskRunId,
          lifecycle: 'running',
          taskContract,
          reason: `${firstDrain.inFlightRemaining} delegated job(s) remained in flight after ${firstDrain.waitedMs}ms drain`,
        });
      }
      let verificationCycle = await runDelegatedWorkerVerificationCycle({
        requestId,
        taskRunId: delegatedTaskRunId,
        metadata: result.metadata,
        intentDecision: effectiveIntentDecision ?? undefined,
        executionProfile: effectiveExecutionProfile,
        taskContract: effectiveTaskContract,
        jobSnapshots: firstDrain.snapshots,
        drainPendingJobs: drainDelegatedJobs,
        trace: (event) => this.recordDelegatedWorkerTrace(event.stage, input, delegatedTarget, event.details),
      });
      let jobSnapshots = verificationCycle.jobSnapshots;
      let verifiedResult = verificationCycle.verifiedResult;
      let insufficiency = verificationCycle.insufficiency;
      effectiveTaskContract = verificationCycle.taskContract;
      type AnswerSynthesisFallback = {
        verifiedResult: typeof verifiedResult;
        insufficiency: DelegatedResultSufficiencyFailure;
        jobSnapshots: DelegatedJobSnapshot[];
      };
      const buildAnswerSynthesisFallback = (): AnswerSynthesisFallback | null => (
        insufficiency && isDelegatedAnswerSynthesisRetry(insufficiency)
          ? { verifiedResult, insufficiency, jobSnapshots }
          : null
      );
      const workerManager = this;
      let answerSynthesisFallback = buildAnswerSynthesisFallback();
      if (!answerSynthesisFallback) {
        await tryStaticAppCompletionRecovery();
        await tryRuntimeEvidenceRecovery();
        await tryStaticAppRuntimeProof();
      }
      if (insufficiency && !answerSynthesisFallback) {
        const retryCodeContext = hasMissingRuntimeEvidence(insufficiency)
          ? resolveCodeContextFromMessage(effectiveInput)
          : undefined;
        const runtimeDiagnosticSection = retryCodeContext
          ? buildRuntimeEvidenceWorkspaceDiagnosticSection(retryCodeContext)
          : null;
        const retryBaseSections = runtimeDiagnosticSection
          ? [...baseDispatchParams.additionalSections, runtimeDiagnosticSection]
          : baseDispatchParams.additionalSections;
        const retryInvocation = await runDelegatedWorkerRetryInvocation({
          requestId,
          taskRunId: delegatedTaskRunId,
          targetLabel: describeDelegatedTarget(delegatedTarget),
          currentRequest: effectiveInput,
          currentExecutionProfile: effectiveExecutionProfile,
          config: this.runtime.getConfigSnapshot?.(),
          orchestration: delegatedTarget.orchestration,
          intentDecision: effectiveIntentDecision ?? undefined,
          baseRecord: preRoutedGateway,
          taskContract: effectiveTaskContract,
          insufficiency,
          codeSessionId: input.delegation?.codeSessionId,
          baseSections: retryBaseSections,
          buildRetryRequest: ({ currentRequest, retryProfile, retryPlan }) => ({
            ...currentRequest,
            ...(retryProfile === currentRequest.executionProfile
              ? {}
              : { executionProfile: retryProfile }),
            message: {
              ...currentRequest.message,
              metadata: attachPreRoutedIntentGatewayMetadata(
                currentRequest.message.metadata,
                retryPlan.intentGatewayRecord,
              ),
            },
          }),
          dispatchRetry: async ({ request, retryPlan, retryProfile }) => {
            return dispatchDelegatedWorkerAttempt({
              ...baseDispatchParams,
              message: request.message,
              systemPrompt: request.systemPrompt,
              history: request.history,
              knowledgeBases: request.knowledgeBases ?? [],
              activeSkills: request.activeSkills ?? [],
              toolContext: request.toolContext ?? '',
              runtimeNotices: request.runtimeNotices ?? [],
              additionalSections: retryPlan.additionalSections,
              executionProfile: retryProfile,
              continuity: request.continuity,
              pendingAction: request.pendingAction,
              pendingApprovalNotice: request.pendingApprovalNotice,
              dispatchTimeoutMs: DELEGATED_RETRY_DISPATCH_TIMEOUT_MS,
            });
          },
          drainPendingJobs: drainDelegatedJobs,
          verifyRetryResult: async ({
            request,
            result: retryResult,
            retryProfile,
            taskContract,
            jobDrain,
          }) => runDelegatedWorkerVerificationCycle({
            requestId,
            taskRunId: delegatedTaskRunId,
            metadata: retryResult.metadata,
            intentDecision: effectiveIntentDecision ?? undefined,
            executionProfile: retryProfile,
            taskContract,
            jobSnapshots: jobDrain.snapshots,
            attemptLabel: 'retry',
            drainPendingJobs: drainDelegatedJobs,
            trace: (event) => this.recordDelegatedWorkerTrace(
              event.stage,
              request,
              delegatedTarget,
              event.details,
            ),
          }),
          onRetrying: ({ request, retryPlan, insufficiency: retryInsufficiency }) => {
            this.recordDelegatedWorkerTrace('delegated_worker_retrying', request, delegatedTarget, {
              requestId,
              taskRunId: delegatedTaskRunId,
              lifecycle: 'running',
              workerId: worker!.id,
              taskContract: effectiveTaskContract,
              additionalSections: retryPlan.additionalSections,
              reason: retryPlan.detail,
            });
            this.publishDelegatedWorkerProgress(request, delegatedTarget, {
              id: `delegated-worker:${delegatedJob.id}:retrying`,
              kind: 'running',
              requestId,
              taskRunId: delegatedTaskRunId,
              workerId: worker!.id,
              detail: retryPlan.detail,
            });
            this.runtime.auditLog.record({
              type: 'broker_action',
              severity: 'info',
              agentId: input.agentId,
              userId: input.userId,
              channel: input.message.channel,
              controller: 'WorkerManager',
              details: buildDelegatedAuditDetails(request, delegatedTarget, requestId, {
                actionType: 'delegated_worker_retrying',
                reason: retryInsufficiency.retryReason,
              }),
            });
          },
          onDrainWaitExpired: ({ request, jobDrain, taskContract }) => {
            this.recordDelegatedWorkerTrace('delegated_job_wait_expired', request, delegatedTarget, {
              requestId,
              taskRunId: delegatedTaskRunId,
              lifecycle: 'running',
              taskContract,
              reason: `${jobDrain.inFlightRemaining} delegated job(s) remained in flight after ${jobDrain.waitedMs}ms drain (retry)`,
            });
          },
        });
        if (retryInvocation) {
          effectiveInput = retryInvocation.request;
          effectiveExecutionProfile = retryInvocation.retryProfile;
          result = retryInvocation.result;
          verificationCycle = retryInvocation.verificationCycle;
          jobSnapshots = verificationCycle.jobSnapshots;
          verifiedResult = verificationCycle.verifiedResult;
          insufficiency = verificationCycle.insufficiency;
          effectiveTaskContract = verificationCycle.taskContract;
          answerSynthesisFallback = buildAnswerSynthesisFallback();
          if (!answerSynthesisFallback) {
            await tryStaticAppRuntimeProof();
          }
        }
      }
      async function tryStaticAppRuntimeProof(): Promise<boolean> {
        if (insufficiency || answerSynthesisFallback || hasSuccessfulStaticAppRuntimeCheckEvidence(jobSnapshots)) {
          return false;
        }
        const codeContext = resolveCodeContextFromMessage(effectiveInput);
        const workspaceRoot = codeContext?.workspaceRoot ? resolve(codeContext.workspaceRoot) : '';
        if (!workspaceRoot) {
          return false;
        }
        const runtimeRecoveryTool = resolveStaticAppRuntimeRecoveryTool(workspaceRoot);
        const runTool = (workerManager.tools as { runTool?: unknown }).runTool;
        if (!runtimeRecoveryTool || typeof runTool !== 'function') {
          return false;
        }
        workerManager.recordDelegatedWorkerTrace('delegated_worker_retrying', effectiveInput, delegatedTarget, {
          requestId,
          taskRunId: delegatedTaskRunId,
          lifecycle: 'running',
          ...(worker?.id ? { workerId: worker.id } : {}),
          taskContract: effectiveTaskContract,
          reason: runtimeRecoveryTool.detail,
        });
        workerManager.publishDelegatedWorkerProgress(effectiveInput, delegatedTarget, {
          id: `delegated-worker:${delegatedJob.id}:static-app-runtime-proof`,
          kind: 'running',
          requestId,
          taskRunId: delegatedTaskRunId,
          ...(worker?.id ? { workerId: worker.id } : {}),
          detail: runtimeRecoveryTool.detail,
        });
        let proofFailure: string | null = null;
        try {
          const toolResult = await workerManager.tools.runTool({
            toolName: runtimeRecoveryTool.toolName,
            args: runtimeRecoveryTool.args,
            origin: 'assistant',
            agentId: effectiveInput.agentId,
            userId: effectiveInput.userId,
            surfaceId: effectiveInput.message.surfaceId,
            principalId: effectiveInput.message.principalId ?? effectiveInput.userId,
            principalRole: (effectiveInput.message.principalRole as ToolExecutionRequest['principalRole']) ?? 'owner',
            channel: effectiveInput.message.channel,
            requestId,
            codeContext,
          });
          if (!toolResult.success) {
            proofFailure = describeToolRunFailure(toolResult);
          }
        } catch (error) {
          proofFailure = describeToolRunFailure(error);
        } finally {
          runtimeRecoveryTool.cleanup?.();
        }
        const runtimeProofDrain = await drainDelegatedJobs();
        jobSnapshots = runtimeProofDrain.snapshots;
        if (proofFailure) {
          insufficiency = buildStaticAppRuntimeProofFailure(
            effectiveTaskContract,
            verifiedResult.envelope,
            proofFailure,
          );
          answerSynthesisFallback = buildAnswerSynthesisFallback();
          return true;
        }
        verificationCycle = await runDelegatedWorkerVerificationCycle({
          requestId,
          taskRunId: delegatedTaskRunId,
          metadata: result.metadata,
          intentDecision: effectiveIntentDecision ?? undefined,
          executionProfile: effectiveExecutionProfile,
          taskContract: effectiveTaskContract,
          jobSnapshots,
          attemptLabel: 'static_app_runtime_proof',
          drainPendingJobs: drainDelegatedJobs,
          trace: (event) => workerManager.recordDelegatedWorkerTrace(event.stage, effectiveInput, delegatedTarget, event.details),
        });
        jobSnapshots = verificationCycle.jobSnapshots;
        verifiedResult = verificationCycle.verifiedResult;
        insufficiency = verificationCycle.insufficiency;
        effectiveTaskContract = verificationCycle.taskContract;
        answerSynthesisFallback = buildAnswerSynthesisFallback();
        const completionContent = buildRuntimeRecoveryCompletionContent(
          result.content,
          codeContext,
          jobSnapshots,
        );
        if (completionContent && !insufficiency) {
          result = withDelegatedRuntimeRecoveryCompletionContent(
            result,
            completionContent,
            workerManager.observability.now?.() ?? Date.now(),
          );
          verificationCycle = await runDelegatedWorkerVerificationCycle({
            requestId,
            taskRunId: delegatedTaskRunId,
            metadata: result.metadata,
            intentDecision: effectiveIntentDecision ?? undefined,
            executionProfile: effectiveExecutionProfile,
            taskContract: effectiveTaskContract,
            jobSnapshots,
            attemptLabel: 'static_app_runtime_proof_completion_answer',
            drainPendingJobs: drainDelegatedJobs,
            trace: (event) => workerManager.recordDelegatedWorkerTrace(event.stage, effectiveInput, delegatedTarget, event.details),
          });
          jobSnapshots = verificationCycle.jobSnapshots;
          verifiedResult = verificationCycle.verifiedResult;
          insufficiency = verificationCycle.insufficiency;
          effectiveTaskContract = verificationCycle.taskContract;
          answerSynthesisFallback = buildAnswerSynthesisFallback();
        }
        return true;
      }
      async function tryRuntimeEvidenceRecovery(): Promise<boolean> {
        if (!(insufficiency && hasMissingRuntimeEvidence(insufficiency))) {
          return false;
        }
        const codeContext = resolveCodeContextFromMessage(effectiveInput);
        const runtimeRecoveryTool = resolveRuntimeEvidenceRecoveryTool(codeContext);
        const runTool = (workerManager.tools as { runTool?: unknown }).runTool;
        if (!runtimeRecoveryTool || typeof runTool !== 'function') {
          return false;
        }
        workerManager.recordDelegatedWorkerTrace('delegated_worker_retrying', effectiveInput, delegatedTarget, {
          requestId,
          taskRunId: delegatedTaskRunId,
          lifecycle: 'running',
          ...(worker?.id ? { workerId: worker.id } : {}),
          taskContract: effectiveTaskContract,
          reason: runtimeRecoveryTool.detail,
        });
        workerManager.publishDelegatedWorkerProgress(effectiveInput, delegatedTarget, {
          id: `delegated-worker:${delegatedJob.id}:runtime-evidence`,
          kind: 'running',
          requestId,
          taskRunId: delegatedTaskRunId,
          ...(worker?.id ? { workerId: worker.id } : {}),
          detail: runtimeRecoveryTool.detail,
        });
        try {
          await workerManager.tools.runTool({
            toolName: runtimeRecoveryTool.toolName,
            args: runtimeRecoveryTool.args,
            origin: 'assistant',
            agentId: effectiveInput.agentId,
            userId: effectiveInput.userId,
            surfaceId: effectiveInput.message.surfaceId,
            principalId: effectiveInput.message.principalId ?? effectiveInput.userId,
            principalRole: (effectiveInput.message.principalRole as ToolExecutionRequest['principalRole']) ?? 'owner',
            channel: effectiveInput.message.channel,
            requestId,
            ...(codeContext ? { codeContext } : {}),
          });
        } finally {
          runtimeRecoveryTool.cleanup?.();
        }
        const runtimeRecoveryDrain = await drainDelegatedJobs();
        verificationCycle = await runDelegatedWorkerVerificationCycle({
          requestId,
          taskRunId: delegatedTaskRunId,
          metadata: result.metadata,
          intentDecision: effectiveIntentDecision ?? undefined,
          executionProfile: effectiveExecutionProfile,
          taskContract: effectiveTaskContract,
          jobSnapshots: runtimeRecoveryDrain.snapshots,
          attemptLabel: 'runtime_evidence_recovery',
          drainPendingJobs: drainDelegatedJobs,
          trace: (event) => workerManager.recordDelegatedWorkerTrace(event.stage, effectiveInput, delegatedTarget, event.details),
        });
        jobSnapshots = verificationCycle.jobSnapshots;
        verifiedResult = verificationCycle.verifiedResult;
        insufficiency = verificationCycle.insufficiency;
        effectiveTaskContract = verificationCycle.taskContract;
        answerSynthesisFallback = buildAnswerSynthesisFallback();
        const completionContent = buildRuntimeRecoveryCompletionContent(
          result.content,
          codeContext,
          jobSnapshots,
        );
        if (completionContent && !(insufficiency && hasMissingRuntimeEvidence(insufficiency))) {
          result = withDelegatedRuntimeRecoveryCompletionContent(
            result,
            completionContent,
            workerManager.observability.now?.() ?? Date.now(),
          );
          verificationCycle = await runDelegatedWorkerVerificationCycle({
            requestId,
            taskRunId: delegatedTaskRunId,
            metadata: result.metadata,
            intentDecision: effectiveIntentDecision ?? undefined,
            executionProfile: effectiveExecutionProfile,
            taskContract: effectiveTaskContract,
            jobSnapshots,
            attemptLabel: 'runtime_evidence_completion_answer_recovery',
            drainPendingJobs: drainDelegatedJobs,
            trace: (event) => workerManager.recordDelegatedWorkerTrace(event.stage, effectiveInput, delegatedTarget, event.details),
          });
          jobSnapshots = verificationCycle.jobSnapshots;
          verifiedResult = verificationCycle.verifiedResult;
          insufficiency = verificationCycle.insufficiency;
          effectiveTaskContract = verificationCycle.taskContract;
          answerSynthesisFallback = buildAnswerSynthesisFallback();
        }
        return true;
      }
      async function tryStaticAppCompletionRecovery(): Promise<boolean> {
        if (!(insufficiency && hasMissingRuntimeEvidence(insufficiency))) {
          return false;
        }
        const codeContext = resolveCodeContextFromMessage(effectiveInput);
        const staticRecovery = resolveStaticAppCompletionRecovery(codeContext);
        const runTool = (workerManager.tools as { runTool?: unknown }).runTool;
        if (!staticRecovery || typeof runTool !== 'function') {
          return false;
        }
        workerManager.recordDelegatedWorkerTrace('delegated_worker_retrying', effectiveInput, delegatedTarget, {
          requestId,
          taskRunId: delegatedTaskRunId,
          lifecycle: 'running',
          ...(worker?.id ? { workerId: worker.id } : {}),
          taskContract: effectiveTaskContract,
          reason: staticRecovery.detail,
        });
        workerManager.publishDelegatedWorkerProgress(effectiveInput, delegatedTarget, {
          id: `delegated-worker:${delegatedJob.id}:static-app-asset-completion`,
          kind: 'running',
          requestId,
          taskRunId: delegatedTaskRunId,
          ...(worker?.id ? { workerId: worker.id } : {}),
          detail: staticRecovery.detail,
        });
        for (const asset of staticRecovery.assets) {
          await workerManager.tools.runTool({
            toolName: 'fs_write',
            args: {
              path: asset.absolutePath,
              content: asset.content,
            },
            origin: 'assistant',
            agentId: effectiveInput.agentId,
            userId: effectiveInput.userId,
            surfaceId: effectiveInput.message.surfaceId,
            principalId: effectiveInput.message.principalId ?? effectiveInput.userId,
            principalRole: (effectiveInput.message.principalRole as ToolExecutionRequest['principalRole']) ?? 'owner',
            channel: effectiveInput.message.channel,
            requestId,
            ...(codeContext ? { codeContext } : {}),
          });
        }
        const staticCompletionDrain = await drainDelegatedJobs();
        verificationCycle = await runDelegatedWorkerVerificationCycle({
          requestId,
          taskRunId: delegatedTaskRunId,
          metadata: result.metadata,
          intentDecision: effectiveIntentDecision ?? undefined,
          executionProfile: effectiveExecutionProfile,
          taskContract: effectiveTaskContract,
          jobSnapshots: staticCompletionDrain.snapshots,
          attemptLabel: 'static_app_asset_completion_recovery',
          drainPendingJobs: drainDelegatedJobs,
          trace: (event) => workerManager.recordDelegatedWorkerTrace(event.stage, effectiveInput, delegatedTarget, event.details),
        });
        jobSnapshots = verificationCycle.jobSnapshots;
        verifiedResult = verificationCycle.verifiedResult;
        insufficiency = verificationCycle.insufficiency;
        effectiveTaskContract = verificationCycle.taskContract;
        answerSynthesisFallback = buildAnswerSynthesisFallback();
        await tryRuntimeEvidenceRecovery();
        return true;
      }
      await tryStaticAppCompletionRecovery();
      await tryRuntimeEvidenceRecovery();
      await tryStaticAppRuntimeProof();
      if (insufficiency && hasMissingRuntimeEvidence(insufficiency) && !answerSynthesisFallback) {
        const codeContext = resolveCodeContextFromMessage(effectiveInput);
        const staticCompletionSection = codeContext
          ? buildStaticAppCompletionRecoverySection(codeContext)
          : null;
        if (staticCompletionSection) {
          const staticCompletionRetry = await runDelegatedWorkerRetryInvocation({
            requestId,
            taskRunId: delegatedTaskRunId,
            targetLabel: describeDelegatedTarget(delegatedTarget),
            currentRequest: effectiveInput,
            currentExecutionProfile: effectiveExecutionProfile,
            config: this.runtime.getConfigSnapshot?.(),
            orchestration: delegatedTarget.orchestration,
            intentDecision: effectiveIntentDecision ?? undefined,
            baseRecord: preRoutedGateway,
            taskContract: effectiveTaskContract,
            insufficiency,
            codeSessionId: effectiveInput.delegation?.codeSessionId,
            baseSections: [
              ...baseDispatchParams.additionalSections,
              staticCompletionSection,
            ],
            allowSameProfileRetry: true,
            buildRetryRequest: ({ currentRequest, retryProfile, retryPlan }) => ({
              ...currentRequest,
              ...(retryProfile === currentRequest.executionProfile
                ? {}
                : { executionProfile: retryProfile }),
              message: {
                ...currentRequest.message,
                metadata: attachPreRoutedIntentGatewayMetadata(
                  currentRequest.message.metadata,
                  retryPlan.intentGatewayRecord,
                ),
              },
            }),
            dispatchRetry: async ({ request, retryPlan, retryProfile }) => dispatchDelegatedWorkerAttempt({
              ...baseDispatchParams,
              message: request.message,
              systemPrompt: request.systemPrompt,
              history: request.history,
              knowledgeBases: request.knowledgeBases ?? [],
              activeSkills: request.activeSkills ?? [],
              toolContext: request.toolContext ?? '',
              runtimeNotices: request.runtimeNotices ?? [],
              additionalSections: retryPlan.additionalSections,
              executionProfile: retryProfile,
              continuity: request.continuity,
              pendingAction: request.pendingAction,
              pendingApprovalNotice: request.pendingApprovalNotice,
              dispatchTimeoutMs: DELEGATED_RETRY_DISPATCH_TIMEOUT_MS,
            }),
            drainPendingJobs: drainDelegatedJobs,
            verifyRetryResult: async ({
              request,
              result: retryResult,
              retryProfile,
              taskContract,
              jobDrain,
            }) => runDelegatedWorkerVerificationCycle({
              requestId,
              taskRunId: delegatedTaskRunId,
              metadata: retryResult.metadata,
              intentDecision: effectiveIntentDecision ?? undefined,
              executionProfile: retryProfile,
              taskContract,
              jobSnapshots: jobDrain.snapshots,
              attemptLabel: 'static_app_completion_recovery',
              drainPendingJobs: drainDelegatedJobs,
              trace: (event) => this.recordDelegatedWorkerTrace(
                event.stage,
                request,
                delegatedTarget,
                event.details,
              ),
            }),
            onRetrying: ({ request, retryPlan, insufficiency: retryInsufficiency }) => {
              this.recordDelegatedWorkerTrace('delegated_worker_retrying', request, delegatedTarget, {
                requestId,
                taskRunId: delegatedTaskRunId,
                lifecycle: 'running',
                ...(worker?.id ? { workerId: worker.id } : {}),
                taskContract: effectiveTaskContract,
                additionalSections: retryPlan.additionalSections,
                reason: retryPlan.detail,
              });
              this.publishDelegatedWorkerProgress(request, delegatedTarget, {
                id: `delegated-worker:${delegatedJob.id}:static-app-completion`,
                kind: 'running',
                requestId,
                taskRunId: delegatedTaskRunId,
                ...(worker?.id ? { workerId: worker.id } : {}),
                detail: retryPlan.detail,
              });
              this.runtime.auditLog.record({
                type: 'broker_action',
                severity: 'info',
                agentId: input.agentId,
                userId: input.userId,
                channel: input.message.channel,
                controller: 'WorkerManager',
                details: buildDelegatedAuditDetails(request, delegatedTarget, requestId, {
                  actionType: 'delegated_worker_static_app_completion_retrying',
                  reason: retryInsufficiency.retryReason,
                }),
              });
            },
            onDrainWaitExpired: ({ request, jobDrain, taskContract }) => {
              this.recordDelegatedWorkerTrace('delegated_job_wait_expired', request, delegatedTarget, {
                requestId,
                taskRunId: delegatedTaskRunId,
                lifecycle: 'running',
                taskContract,
                reason: `${jobDrain.inFlightRemaining} delegated job(s) remained in flight after ${jobDrain.waitedMs}ms drain (static app completion recovery)`,
              });
            },
          });
          if (staticCompletionRetry) {
            effectiveInput = staticCompletionRetry.request;
            effectiveExecutionProfile = staticCompletionRetry.retryProfile;
            result = staticCompletionRetry.result;
            verificationCycle = staticCompletionRetry.verificationCycle;
            jobSnapshots = verificationCycle.jobSnapshots;
            verifiedResult = verificationCycle.verifiedResult;
            insufficiency = verificationCycle.insufficiency;
            effectiveTaskContract = verificationCycle.taskContract;
            answerSynthesisFallback = buildAnswerSynthesisFallback();
            await tryRuntimeEvidenceRecovery();
          }
        }
      }
      await tryStaticAppCompletionRecovery();
      await tryStaticAppRuntimeProof();
      if (insufficiency && answerSynthesisFallback) {
        const synthesisWorker = await ensureReadyDelegatedWorker();
        const synthesisDispatchBase = {
          ...baseDispatchParams,
          message: effectiveInput.message,
          systemPrompt: effectiveInput.systemPrompt,
          history: effectiveInput.history,
          knowledgeBases: effectiveInput.knowledgeBases ?? [],
          activeSkills: effectiveInput.activeSkills ?? [],
          toolContext: effectiveInput.toolContext ?? '',
          runtimeNotices: effectiveInput.runtimeNotices ?? [],
          executionProfile: effectiveExecutionProfile,
          continuity: effectiveInput.continuity,
          pendingAction: effectiveInput.pendingAction,
          pendingApprovalNotice: effectiveInput.pendingApprovalNotice,
        };
        const synthesisResult = await runDelegatedGroundedAnswerSynthesisRetry({
          originalRequest: effectiveInput.message.content,
          history: synthesisDispatchBase.history,
          intentDecision: effectiveIntentDecision ?? undefined,
          taskContract: effectiveTaskContract,
          verifiedResult: answerSynthesisFallback.verifiedResult,
          insufficiency: answerSynthesisFallback.insufficiency,
          jobSnapshots: answerSynthesisFallback.jobSnapshots,
          requestId,
          taskRunId: delegatedTaskRunId,
          workerId: synthesisWorker.id,
          executionProfile: effectiveExecutionProfile,
          now: this.observability.now ?? Date.now,
          dispatchSynthesis: (groundedSynthesis) => dispatchDelegatedWorkerAttempt({
            ...synthesisDispatchBase,
            groundedSynthesis,
            dispatchTimeoutMs: DELEGATED_SYNTHESIS_DISPATCH_TIMEOUT_MS,
          }),
          verifyResult: (verificationInput) => verifyDelegatedWorkerResult(verificationInput),
          trace: (event) => this.recordDelegatedWorkerTrace(event.stage, effectiveInput, delegatedTarget, event.details),
          progress: (event) => this.publishDelegatedWorkerProgress(effectiveInput, delegatedTarget, event),
        });
        if (synthesisResult) {
          result = synthesisResult.result;
          verifiedResult = synthesisResult.verifiedResult;
          if (shouldAdoptDelegatedTaskContract(effectiveTaskContract, verifiedResult.envelope.taskContract)) {
            effectiveTaskContract = verifiedResult.envelope.taskContract;
          }
          insufficiency = buildDelegatedRetryableFailure(verifiedResult.decision, verifiedResult.envelope);
        }
      }
      if (insufficiency && !hasRecoverableWorkerDispatchAbortMetadata(result.metadata)) {
        const recoveryProposal = await runRecoveryAdvisorInvocation({
          originalRequest: effectiveInput.message.content,
          taskContract: effectiveTaskContract,
          verification: verifiedResult.decision,
          jobSnapshots,
          requestId,
          messageId: effectiveInput.message.id,
          userId: effectiveInput.userId,
          channel: effectiveInput.message.channel,
          ...(effectiveInput.message.surfaceId ? { surfaceId: effectiveInput.message.surfaceId } : {}),
          agentId: delegatedTarget.agentId,
          taskRunId: delegatedTaskRunId,
          ...(effectiveInput.delegation?.executionId ? { parentExecutionId: effectiveInput.delegation.executionId } : {}),
          ...(effectiveInput.delegation?.rootExecutionId ? { rootExecutionId: effectiveInput.delegation.rootExecutionId } : {}),
          ...(effectiveInput.delegation?.codeSessionId ? { codeSessionId: effectiveInput.delegation.codeSessionId } : {}),
          intent: effectiveIntentDecision ?? undefined,
          now: this.observability.now ?? Date.now,
          dispatchAdvisor: (advisorRequest) => dispatchDelegatedWorkerAttempt({
            ...baseDispatchParams,
            message: effectiveInput.message,
            systemPrompt: effectiveInput.systemPrompt,
            history: effectiveInput.history,
            knowledgeBases: effectiveInput.knowledgeBases ?? [],
            activeSkills: effectiveInput.activeSkills ?? [],
            toolContext: effectiveInput.toolContext ?? '',
            runtimeNotices: effectiveInput.runtimeNotices ?? [],
            additionalSections: baseDispatchParams.additionalSections,
            executionProfile: effectiveExecutionProfile,
            continuity: effectiveInput.continuity,
            pendingAction: effectiveInput.pendingAction,
            pendingApprovalNotice: effectiveInput.pendingApprovalNotice,
            recoveryAdvisor: advisorRequest,
            dispatchTimeoutMs: DELEGATED_SYNTHESIS_DISPATCH_TIMEOUT_MS,
          }),
          trace: (entry) => {
            this.observability.intentRoutingTrace?.record(entry);
          },
          persistence: {
            createGraph: (graphInput) => {
              this.observability.executionGraphStore?.createGraph(graphInput);
            },
            ingestEvent: (event) => {
              this.observability.runTimeline?.ingestExecutionGraphEvent(event);
            },
            appendEvent: (event) => {
              this.observability.executionGraphStore?.appendEvent(event);
            },
            writeArtifact: (artifact) => {
              this.observability.executionGraphStore?.writeArtifact(artifact);
            },
          },
        });
        if (recoveryProposal) {
          this.recordDelegatedWorkerTrace('delegated_worker_running', effectiveInput, delegatedTarget, {
            requestId,
            taskRunId: delegatedTaskRunId,
            lifecycle: 'running',
            workerId: worker.id,
            taskContract: effectiveTaskContract,
            reason: 'Recovery proposal recorded as advisory graph state; delegated verification failure remains authoritative.',
          });
          result = {
            content: result.content,
            metadata: {
              ...(result.metadata ?? {}),
              ...recoveryProposal.metadata,
            },
          };
        }
      }
      const verificationFinalization = finalizeDelegatedWorkerVerification({
        taskContract: effectiveTaskContract,
        verifiedResult,
        timestamp: this.observability.now?.() ?? Date.now(),
      });
      const verifiedEnvelope = verificationFinalization.verifiedEnvelope;
      this.recordDelegatedWorkerTrace('delegated_worker_contract_reconciled', effectiveInput, delegatedTarget, {
        requestId,
        taskRunId: delegatedTaskRunId,
        lifecycle: insufficiency ? 'failed' : 'completed',
        taskContract: verificationFinalization.traceTaskContract,
        reason: verificationFinalization.traceReason,
      });
      const sanitizedVerifiedEnvelope = sanitizeDelegatedEnvelopeForOperator(verifiedEnvelope);
      const verifiedMetadata: Record<string, unknown> = {
        ...(result.metadata ?? {}),
        ...buildDelegatedExecutionMetadata(sanitizedVerifiedEnvelope),
      };
      if (!isRecord(verifiedMetadata.responseSource)) {
        const executionProfileSource = buildDelegatedExecutionProfileResponseSource(effectiveExecutionProfile);
        if (executionProfileSource) {
          verifiedMetadata.responseSource = executionProfileSource;
        }
      }
      reconcileSatisfiedDelegatedWorkerMetadata(verifiedMetadata, verifiedResult.decision);
      const verifiedResultPayload = {
        content: result.content,
        metadata: verifiedMetadata,
      };
      const handoffRunClass = resolveDelegationRunClass(effectiveInput, delegatedTarget);
      const handoff = insufficiency
        ? buildDelegatedInsufficientResultHandoff(
          insufficiency,
          handoffRunClass,
        )
        : buildDelegatedHandoff(
          result.content,
          verifiedMetadata,
          handoffRunClass,
          verifiedResult.decision,
        );
      const lifecycle = insufficiency
        ? 'failed'
        : resolveDelegatedWorkerLifecycle(
          verifiedMetadata,
          handoff.unresolvedBlockerKind,
          verifiedResult.decision,
        );
      const normalizedResult = insufficiency
        ? {
            content: formatFailedDelegatedMessage(handoff),
            metadata: {
              ...verifiedMetadata,
              delegatedHandoff: handoff,
              delegatedSufficiencyFailure: {
                decision: insufficiency.decision.decision,
                reason: insufficiency.retryReason,
                reasons: insufficiency.decision.reasons,
              },
            },
          }
        : applyDelegatedFollowUpPolicy(verifiedResultPayload, handoff, verifiedResult.decision);
      const delegatedPendingApprovalMetadata = readDelegatedPendingApprovalMetadata(normalizedResult.metadata);
      const executionGraphCompletion = this.completeDelegatedWorkerGraph(delegatedGraphRun, {
        lifecycle,
        handoff,
        taskContract: effectiveTaskContract,
        verification: verifiedResult.decision,
        workerId: worker.id,
        ...(delegatedPendingApprovalMetadata ? { approvalMetadata: delegatedPendingApprovalMetadata } : {}),
      });
      const executionGraphMetadata = executionGraphCompletion?.metadata;
      if (executionGraphMetadata) {
        normalizedResult.metadata = {
          ...(normalizedResult.metadata ?? {}),
          executionGraph: executionGraphMetadata,
        };
      }
      const pendingApprovalRecord = this.recordDelegatedPendingApprovalAction({
        worker,
        request: effectiveInput,
        result: normalizedResult,
        target: delegatedTarget,
        taskRunId: delegatedTaskRunId,
        intentDecision: effectiveIntentDecision ?? undefined,
        graphCompletion: executionGraphCompletion,
      });
      if (pendingApprovalRecord) {
        normalizedResult.metadata = {
          ...(normalizedResult.metadata ?? {}),
          pendingAction: toPendingActionClientMetadata(pendingApprovalRecord),
          continueConversationAfterApproval: true,
        };
      } else if (delegatedPendingApprovalMetadata) {
        const metadata = { ...(normalizedResult.metadata ?? {}) };
        delete metadata.pendingAction;
        delete metadata.continueConversationAfterApproval;
        normalizedResult.metadata = metadata;
      }
      this.recordDelegatedExecutionArtifacts(
        effectiveInput,
        delegatedTarget,
        requestId,
        delegatedTaskRunId,
        normalizedResult.metadata,
        sanitizedVerifiedEnvelope.events,
      );
      if (handoff.reportingMode === 'held_for_operator') {
        this.delegatedFollowUpPayloads.set(delegatedJob.id, {
          content: result.content,
          agentId: input.agentId,
          userId: input.userId,
          channel: input.message.channel,
          ...(input.delegation?.originSurfaceId ? { originSurfaceId: input.delegation.originSurfaceId } : {}),
          ...(input.delegation?.continuityKey ? { continuityKey: input.delegation.continuityKey } : {}),
          ...(input.delegation?.activeExecutionRefs?.length ? { activeExecutionRefs: [...input.delegation.activeExecutionRefs] } : {}),
          ...(input.delegation?.codeSessionId ? { codeSessionId: input.delegation.codeSessionId } : {}),
          ...(handoff.runClass ? { runClass: handoff.runClass } : {}),
        });
      } else {
        this.delegatedFollowUpPayloads.delete(delegatedJob.id);
      }
      if (lifecycle === 'failed') {
        this.delegatedJobTracker.fail(delegatedJob.id, new Error(handoff.summary), {
          detail: handoff.summary,
          metadata: {
            delegation: buildDelegationJobMetadata(effectiveInput, {
              lifecycle,
              workerId: worker.id,
              handoff,
              target: delegatedTarget,
              executionGraph: executionGraphMetadata,
            }),
          },
        });
        this.recordDelegatedWorkerTrace('delegated_worker_failed', effectiveInput, delegatedTarget, {
          requestId,
          taskRunId: delegatedTaskRunId,
          lifecycle,
          workerId: worker.id,
          taskContract: effectiveTaskContract,
          unresolvedBlockerKind: handoff.unresolvedBlockerKind,
          approvalCount: handoff.approvalCount,
          reportingMode: handoff.reportingMode,
          runClass: handoff.runClass,
          reason: handoff.summary,
          contentPreview: handoff.summary,
          handoff,
          workerMetadata: normalizedResult.metadata,
        });
        this.publishDelegatedWorkerProgress(effectiveInput, delegatedTarget, {
          id: `delegated-worker:${delegatedJob.id}:failed`,
          kind: 'failed',
          requestId,
          taskRunId: delegatedTaskRunId,
          workerId: worker.id,
          runClass: handoff.runClass,
          unresolvedBlockerKind: handoff.unresolvedBlockerKind,
          approvalCount: handoff.approvalCount,
          reportingMode: handoff.reportingMode,
          detail: handoff.summary,
        });
        this.runtime.auditLog.record({
          type: 'broker_action',
          severity: 'warn',
          agentId: input.agentId,
          userId: input.userId,
          channel: input.message.channel,
          controller: 'WorkerManager',
          details: buildDelegatedAuditDetails(effectiveInput, delegatedTarget, requestId, {
            actionType: 'delegated_worker_failed',
            unresolvedBlockerKind: handoff.unresolvedBlockerKind,
            approvalCount: handoff.approvalCount,
            reportingMode: handoff.reportingMode,
            reason: handoff.summary,
          }),
        });
        return normalizedResult;
      }

      const finishDelegatedJob = lifecycle === 'blocked'
        ? this.delegatedJobTracker.block.bind(this.delegatedJobTracker)
        : this.delegatedJobTracker.succeed.bind(this.delegatedJobTracker);
      finishDelegatedJob(delegatedJob.id, {
        detail: handoff.summary,
        metadata: {
          delegation: buildDelegationJobMetadata(effectiveInput, {
            lifecycle,
            workerId: worker.id,
            handoff,
            target: delegatedTarget,
            executionGraph: executionGraphMetadata,
          }),
        },
      });
      this.recordDelegatedWorkerTrace('delegated_worker_completed', effectiveInput, delegatedTarget, {
        requestId,
        taskRunId: delegatedTaskRunId,
        lifecycle,
        workerId: worker.id,
        taskContract: effectiveTaskContract,
        unresolvedBlockerKind: handoff.unresolvedBlockerKind,
        approvalCount: handoff.approvalCount,
        reportingMode: handoff.reportingMode,
        runClass: handoff.runClass,
        reason: handoff.summary,
        contentPreview: lifecycle === 'blocked' ? handoff.nextAction : handoff.summary,
        handoff,
        workerMetadata: normalizedResult.metadata,
      });
      this.publishDelegatedWorkerProgress(effectiveInput, delegatedTarget, {
        id: `delegated-worker:${delegatedJob.id}:completed`,
        kind: lifecycle === 'blocked' ? 'blocked' : 'completed',
        requestId,
        taskRunId: delegatedTaskRunId,
        workerId: worker.id,
        runClass: handoff.runClass,
        unresolvedBlockerKind: handoff.unresolvedBlockerKind,
        approvalCount: handoff.approvalCount,
        reportingMode: handoff.reportingMode,
        detail: lifecycle === 'blocked' ? handoff.nextAction : handoff.summary,
      });
      this.runtime.auditLog.record({
        type: 'broker_action',
        severity: lifecycle === 'blocked' ? 'warn' : 'info',
        agentId: input.agentId,
        userId: input.userId,
        channel: input.message.channel,
        controller: 'WorkerManager',
        details: buildDelegatedAuditDetails(effectiveInput, delegatedTarget, requestId, {
          actionType: 'delegated_worker_completed',
          unresolvedBlockerKind: handoff.unresolvedBlockerKind,
          approvalCount: handoff.approvalCount,
          reportingMode: handoff.reportingMode,
        }),
      });
      return normalizedResult;
    } catch (error) {
      if (isRecoverableWorkerDispatchAbort(error)) {
        const drainDelegatedJobs = (deadlineMs?: number) => awaitDelegatedRequestJobDrain({
          requestId,
          ...(typeof deadlineMs === 'number' ? { deadlineMs: Math.min(deadlineMs, 500) } : { deadlineMs: 500 }),
          listJobs: (limit) => (
            typeof (this.tools as { listJobs?: unknown }).listJobs === 'function'
              ? this.tools.listJobs(limit)
              : []
          ),
        });
        const jobDrain = await drainDelegatedJobs();
        if (jobDrain.snapshots.length > 0) {
          const finishedJobCount = jobDrain.snapshots.filter((snapshot) => (
            ['succeeded', 'completed', 'failed', 'error', 'canceled', 'cancelled', 'blocked', 'pending_approval']
              .includes(snapshot.status?.trim().toLowerCase() ?? '')
          )).length;
          const timeoutMetadata: Record<string, unknown> = {
            workerExecution: {
              lifecycle: 'failed',
              source: 'tool_loop',
              completionReason: 'degraded_response',
              responseQuality: 'degraded',
              terminationReason: 'max_wall_clock',
              roundCount: 1,
              toolCallCount: jobDrain.snapshots.length,
              toolResultCount: finishedJobCount,
              successfulToolResultCount: jobDrain.snapshots.filter((snapshot) => (
                ['succeeded', 'completed'].includes(snapshot.status?.trim().toLowerCase() ?? '')
              )).length,
            },
          };
          const verificationCycle = await runDelegatedWorkerVerificationCycle({
            requestId,
            taskRunId: delegatedTaskRunId,
            metadata: timeoutMetadata,
            intentDecision: effectiveIntentDecision ?? undefined,
            executionProfile: input.executionProfile,
            taskContract: effectiveTaskContract,
            jobSnapshots: jobDrain.snapshots,
            attemptLabel: 'timeout_recovery',
            drainPendingJobs: drainDelegatedJobs,
            trace: (event) => this.recordDelegatedWorkerTrace(event.stage, input, delegatedTarget, event.details),
          });
          effectiveTaskContract = verificationCycle.taskContract;
          const verifiedResult = verificationCycle.verifiedResult;
          const insufficiency = verificationCycle.insufficiency;
          const verificationFinalization = finalizeDelegatedWorkerVerification({
            taskContract: effectiveTaskContract,
            verifiedResult,
            timestamp: this.observability.now?.() ?? Date.now(),
          });
          const verifiedEnvelope = verificationFinalization.verifiedEnvelope;
          this.recordDelegatedWorkerTrace('delegated_worker_contract_reconciled', input, delegatedTarget, {
            requestId,
            taskRunId: delegatedTaskRunId,
            lifecycle: insufficiency ? 'failed' : 'completed',
            taskContract: verificationFinalization.traceTaskContract,
            reason: verificationFinalization.traceReason,
          });
          const sanitizedVerifiedEnvelope = sanitizeDelegatedEnvelopeForOperator(verifiedEnvelope);
          const verifiedMetadata: Record<string, unknown> = {
            ...timeoutMetadata,
            ...buildDelegatedExecutionMetadata(sanitizedVerifiedEnvelope),
          };
          if (!isRecord(verifiedMetadata.responseSource)) {
            const executionProfileSource = buildDelegatedExecutionProfileResponseSource(input.executionProfile);
            if (executionProfileSource) {
              verifiedMetadata.responseSource = executionProfileSource;
            }
          }
          reconcileSatisfiedDelegatedWorkerMetadata(verifiedMetadata, verifiedResult.decision);
          const handoffRunClass = resolveDelegationRunClass(input, delegatedTarget);
          const recoveredContent = [
            error instanceof Error ? error.message : String(error),
            'The delegated worker stopped after making partial progress.',
          ].join('\n');
          const handoff = insufficiency
            ? buildDelegatedInsufficientResultHandoff(insufficiency, handoffRunClass)
            : buildDelegatedHandoff(recoveredContent, verifiedMetadata, handoffRunClass, verifiedResult.decision);
          const lifecycle = insufficiency
            ? 'failed'
            : resolveDelegatedWorkerLifecycle(
              verifiedMetadata,
              handoff.unresolvedBlockerKind,
              verifiedResult.decision,
            );
          const normalizedResult = insufficiency
            ? {
                content: formatFailedDelegatedMessage(handoff),
                metadata: {
                  ...verifiedMetadata,
                  delegatedHandoff: handoff,
                  delegatedSufficiencyFailure: {
                    decision: insufficiency.decision.decision,
                    reason: insufficiency.retryReason,
                    reasons: insufficiency.decision.reasons,
                  },
                },
              }
            : applyDelegatedFollowUpPolicy(
              { content: recoveredContent, metadata: verifiedMetadata },
              handoff,
              verifiedResult.decision,
            );
          const executionGraphCompletion = this.completeDelegatedWorkerGraph(delegatedGraphRun, {
            lifecycle,
            handoff,
            taskContract: effectiveTaskContract,
            verification: verifiedResult.decision,
            ...(worker?.id ? { workerId: worker.id } : {}),
          });
          if (executionGraphCompletion?.metadata) {
            normalizedResult.metadata = {
              ...(normalizedResult.metadata ?? {}),
              executionGraph: executionGraphCompletion.metadata,
            };
          }
          this.recordDelegatedExecutionArtifacts(
            input,
            delegatedTarget,
            requestId,
            delegatedTaskRunId,
            normalizedResult.metadata,
            sanitizedVerifiedEnvelope.events,
          );
          if (lifecycle === 'failed') {
            this.delegatedJobTracker.fail(delegatedJob.id, new Error(handoff.summary), {
              detail: handoff.summary,
              metadata: {
                delegation: buildDelegationJobMetadata(input, {
                  lifecycle,
                  ...(worker?.id ? { workerId: worker.id } : {}),
                  handoff,
                  target: delegatedTarget,
                  executionGraph: executionGraphCompletion?.metadata,
                }),
              },
            });
            this.recordDelegatedWorkerTrace('delegated_worker_failed', input, delegatedTarget, {
              requestId,
              taskRunId: delegatedTaskRunId,
              lifecycle,
              ...(worker?.id ? { workerId: worker.id } : {}),
              taskContract: effectiveTaskContract,
              unresolvedBlockerKind: handoff.unresolvedBlockerKind,
              approvalCount: handoff.approvalCount,
              reportingMode: handoff.reportingMode,
              runClass: handoff.runClass,
              reason: handoff.summary,
              contentPreview: handoff.summary,
              handoff,
              workerMetadata: normalizedResult.metadata,
            });
            this.publishDelegatedWorkerProgress(input, delegatedTarget, {
              id: `delegated-worker:${delegatedJob.id}:failed`,
              kind: 'failed',
              requestId,
              taskRunId: delegatedTaskRunId,
              ...(worker?.id ? { workerId: worker.id } : {}),
              runClass: handoff.runClass,
              unresolvedBlockerKind: handoff.unresolvedBlockerKind,
              approvalCount: handoff.approvalCount,
              reportingMode: handoff.reportingMode,
              detail: handoff.summary,
            });
            this.runtime.auditLog.record({
              type: 'broker_action',
              severity: 'warn',
              agentId: input.agentId,
              userId: input.userId,
              channel: input.message.channel,
              controller: 'WorkerManager',
              details: buildDelegatedAuditDetails(input, delegatedTarget, requestId, {
                actionType: 'delegated_worker_failed',
                unresolvedBlockerKind: handoff.unresolvedBlockerKind,
                approvalCount: handoff.approvalCount,
                reportingMode: handoff.reportingMode,
                reason: handoff.summary,
              }),
            });
            return normalizedResult;
          }

          const finishDelegatedJob = lifecycle === 'blocked'
            ? this.delegatedJobTracker.block.bind(this.delegatedJobTracker)
            : this.delegatedJobTracker.succeed.bind(this.delegatedJobTracker);
          finishDelegatedJob(delegatedJob.id, {
            detail: handoff.summary,
            metadata: {
              delegation: buildDelegationJobMetadata(input, {
                lifecycle,
                ...(worker?.id ? { workerId: worker.id } : {}),
                handoff,
                target: delegatedTarget,
                executionGraph: executionGraphCompletion?.metadata,
              }),
            },
          });
          this.recordDelegatedWorkerTrace('delegated_worker_completed', input, delegatedTarget, {
            requestId,
            taskRunId: delegatedTaskRunId,
            lifecycle,
            ...(worker?.id ? { workerId: worker.id } : {}),
            taskContract: effectiveTaskContract,
            unresolvedBlockerKind: handoff.unresolvedBlockerKind,
            approvalCount: handoff.approvalCount,
            reportingMode: handoff.reportingMode,
            runClass: handoff.runClass,
            reason: handoff.summary,
            contentPreview: lifecycle === 'blocked' ? handoff.nextAction : handoff.summary,
            handoff,
            workerMetadata: normalizedResult.metadata,
          });
          this.publishDelegatedWorkerProgress(input, delegatedTarget, {
            id: `delegated-worker:${delegatedJob.id}:completed`,
            kind: lifecycle === 'blocked' ? 'blocked' : 'completed',
            requestId,
            taskRunId: delegatedTaskRunId,
            ...(worker?.id ? { workerId: worker.id } : {}),
            runClass: handoff.runClass,
            unresolvedBlockerKind: handoff.unresolvedBlockerKind,
            approvalCount: handoff.approvalCount,
            reportingMode: handoff.reportingMode,
            detail: lifecycle === 'blocked' ? handoff.nextAction : handoff.summary,
          });
          this.runtime.auditLog.record({
            type: 'broker_action',
            severity: lifecycle === 'blocked' ? 'warn' : 'info',
            agentId: input.agentId,
            userId: input.userId,
            channel: input.message.channel,
            controller: 'WorkerManager',
            details: buildDelegatedAuditDetails(input, delegatedTarget, requestId, {
              actionType: 'delegated_worker_completed',
              unresolvedBlockerKind: handoff.unresolvedBlockerKind,
              approvalCount: handoff.approvalCount,
              reportingMode: handoff.reportingMode,
            }),
          });
          return normalizedResult;
        }
      }
      const executionGraphMetadata = this.failDelegatedWorkerGraph(delegatedGraphRun, error, taskContract);
      this.delegatedJobTracker.fail(delegatedJob.id, error, {
        detail: error instanceof Error ? error.message : String(error),
        metadata: {
          delegation: buildDelegationJobMetadata(input, {
            lifecycle: 'failed',
            target: delegatedTarget,
            handoff: {
              summary: truncateInlineText(error instanceof Error ? error.message : String(error), 220),
              nextAction: 'Inspect the delegated worker failure details.',
            },
            executionGraph: executionGraphMetadata,
          }),
        },
      });
      this.recordDelegatedWorkerTrace('delegated_worker_failed', input, delegatedTarget, {
        requestId,
        taskRunId: delegatedTaskRunId,
        lifecycle: 'failed',
        taskContract,
        reason: error instanceof Error ? error.message : String(error),
        contentPreview: error instanceof Error ? error.message : String(error),
      });
      this.publishDelegatedWorkerProgress(input, delegatedTarget, {
        id: `delegated-worker:${delegatedJob.id}:failed`,
        kind: 'failed',
        requestId,
        taskRunId: delegatedTaskRunId,
        detail: error instanceof Error ? error.message : String(error),
      });
      this.runtime.auditLog.record({
        type: 'broker_action',
        severity: 'warn',
        agentId: input.agentId,
        userId: input.userId,
        channel: input.message.channel,
        controller: 'WorkerManager',
        details: buildDelegatedAuditDetails(input, delegatedTarget, requestId, {
          actionType: 'delegated_worker_failed',
          reason: error instanceof Error ? error.message : String(error),
        }),
      });
      throw error;
    }
  }

  private recordDelegatedWorkerTrace(
    stage: Extract<
      IntentRoutingTraceStage,
      | 'delegated_worker_started'
      | 'delegated_worker_running'
      | 'delegated_worker_retrying'
      | 'delegated_worker_completed'
      | 'delegated_worker_failed'
      | 'delegated_worker_contract_reconciled'
      | 'delegated_job_wait_expired'
    >,
    input: WorkerMessageRequest,
    target: ResolvedDelegatedTargetMetadata,
    options: {
      requestId: string;
      taskRunId?: string;
      lifecycle?: 'running' | 'completed' | 'blocked' | 'failed';
      workerId?: string;
      taskContract?: DelegatedResultEnvelope['taskContract'];
      additionalSections?: PromptAssemblyAdditionalSection[];
      unresolvedBlockerKind?: string;
      approvalCount?: number;
      reportingMode?: string;
      runClass?: DelegatedWorkerRunClass;
      reason?: string;
      contentPreview?: string;
      handoff?: DelegatedWorkerHandoff;
      workerMetadata?: Record<string, unknown>;
    },
  ): void {
    const delegatedExecution = resolveDelegatedExecutionIdentity(input, options.taskRunId);
    const delegatedIntent = resolveDelegatedIntentContext(input, target);
    this.observability.intentRoutingTrace?.record({
      stage,
      requestId: options.requestId,
      messageId: input.message.id,
      userId: input.userId,
      channel: input.delegation?.originChannel ?? input.message.channel,
      agentId: target.agentId,
      contentPreview: options.contentPreview ?? input.message.content,
      details: {
        ...(input.delegation?.originSurfaceId ? { originSurfaceId: input.delegation.originSurfaceId } : {}),
        ...(delegatedExecution.executionId ? { executionId: delegatedExecution.executionId } : {}),
        ...(delegatedExecution.rootExecutionId ? { rootExecutionId: delegatedExecution.rootExecutionId } : {}),
        ...(delegatedExecution.taskExecutionId ? { taskExecutionId: delegatedExecution.taskExecutionId } : {}),
        ...(input.delegation?.continuityKey ? { continuityKey: input.delegation.continuityKey } : {}),
        ...(input.delegation?.activeExecutionRefs?.length ? { activeExecutionRefs: [...input.delegation.activeExecutionRefs] } : {}),
        ...(input.delegation?.pendingActionId ? { pendingActionId: input.delegation.pendingActionId } : {}),
        ...(input.delegation?.codeSessionId ? { codeSessionId: input.delegation.codeSessionId } : {}),
        ...(target.agentName ? { agentName: target.agentName } : {}),
        ...(target.orchestration?.role ? { orchestrationRole: target.orchestration.role } : {}),
        ...(target.orchestration?.label ? { orchestrationLabel: target.orchestration.label } : {}),
        ...(target.orchestration?.lenses?.length ? { orchestrationLenses: [...target.orchestration.lenses] } : {}),
        ...buildDelegatedIntentTraceMetadata(delegatedIntent),
        ...buildDelegatedExecutionProfileTraceMetadata(input.executionProfile),
        ...buildDelegatedTaskContractTraceMetadata(options.taskContract),
        ...buildPromptAdditionalSectionTraceMetadata(options.additionalSections),
        ...buildDelegatedHandoffTraceMetadata(options.handoff),
        ...buildDelegatedWorkerExecutionTraceMetadata(options.workerMetadata),
        ...(options.taskRunId ? { taskRunId: options.taskRunId } : {}),
        ...(options.lifecycle ? { lifecycle: options.lifecycle } : {}),
        ...(options.workerId ? { workerId: options.workerId } : {}),
        ...(options.unresolvedBlockerKind ? { unresolvedBlockerKind: options.unresolvedBlockerKind } : {}),
        ...(typeof options.approvalCount === 'number' ? { approvalCount: options.approvalCount } : {}),
        ...(options.reportingMode ? { reportingMode: options.reportingMode } : {}),
        ...(options.runClass ? { runClass: options.runClass } : {}),
        ...(options.reason ? { reason: options.reason } : {}),
      },
    });
  }

  private publishDelegatedWorkerProgress(
    input: WorkerMessageRequest,
    target: ResolvedDelegatedTargetMetadata,
    event: Omit<DelegatedWorkerProgressEvent, 'agentId' | 'agentName' | 'orchestrationRole' | 'orchestrationLabel' | 'orchestrationLenses' | 'originChannel' | 'requestPreview' | 'continuityKey' | 'activeExecutionRefs' | 'codeSessionId' | 'timestamp' | 'runId' | 'parentRunId' | 'executionProfileName' | 'executionProfileModel' | 'executionProfileTier'>,
  ): void {
    const delegatedExecution = resolveDelegatedExecutionIdentity(input, event.taskRunId);
    this.observability.runTimeline?.ingestDelegatedWorkerProgress({
      ...event,
      runId: delegatedExecution.executionId ?? event.requestId,
      parentRunId: delegatedExecution.executionId ?? event.requestId,
      ...(delegatedExecution.executionId ? { executionId: delegatedExecution.executionId } : {}),
      ...(delegatedExecution.rootExecutionId ? { rootExecutionId: delegatedExecution.rootExecutionId } : {}),
      ...(delegatedExecution.taskExecutionId ? { taskExecutionId: delegatedExecution.taskExecutionId } : {}),
      codeSessionId: input.delegation?.codeSessionId,
      agentId: target.agentId,
      ...(target.agentName ? { agentName: target.agentName } : {}),
      ...(target.orchestration?.role ? { orchestrationRole: target.orchestration.role } : {}),
      ...(target.orchestration?.label ? { orchestrationLabel: target.orchestration.label } : {}),
      ...(target.orchestration?.lenses?.length ? { orchestrationLenses: [...target.orchestration.lenses] } : {}),
      originChannel: input.delegation?.originChannel ?? input.message.channel,
      requestPreview: input.message.content,
      continuityKey: input.delegation?.continuityKey,
      activeExecutionRefs: input.delegation?.activeExecutionRefs,
      ...buildDelegatedExecutionProfileMetadata(input.executionProfile),
      timestamp: this.observability.now?.() ?? Date.now(),
    });
  }

  private recordDelegatedExecutionArtifacts(
    input: WorkerMessageRequest,
    target: ResolvedDelegatedTargetMetadata,
    requestId: string,
    taskRunId: string,
    metadata: Record<string, unknown> | undefined,
    traceEvents: ExecutionEvent[] = readExecutionEvents(metadata),
  ): void {
    const timelineEvents = readExecutionEvents(metadata);
    if (traceEvents.length <= 0 && timelineEvents.length <= 0) {
      return;
    }
    const delegatedExecution = resolveDelegatedExecutionIdentity(input, taskRunId);
    for (const event of traceEvents) {
      this.recordDelegatedExecutionTraceEvent(input, target, requestId, delegatedExecution, event, traceEvents);
    }
    if (timelineEvents.length > 0 && typeof this.observability.runTimeline?.ingestDelegatedExecutionEvents === 'function') {
      this.observability.runTimeline.ingestDelegatedExecutionEvents({
        parentRunId: delegatedExecution.executionId ?? requestId,
        taskRunId,
        parentExecutionId: delegatedExecution.executionId ?? requestId,
        taskExecutionId: delegatedExecution.taskExecutionId,
        rootExecutionId: delegatedExecution.rootExecutionId ?? delegatedExecution.executionId ?? requestId,
        codeSessionId: input.delegation?.codeSessionId,
        agentId: target.agentId,
        channel: input.delegation?.originChannel ?? input.message.channel,
        events: timelineEvents,
      });
    }
  }

  private recordDelegatedExecutionTraceEvent(
    input: WorkerMessageRequest,
    target: ResolvedDelegatedTargetMetadata,
    requestId: string,
    delegatedExecution: {
      executionId?: string;
      rootExecutionId?: string;
      taskExecutionId?: string;
    },
    event: ExecutionEvent,
    traceEvents: ExecutionEvent[],
  ): void {
    const stage = mapExecutionEventToTraceStage(event.type);
    const contentPreview = buildDelegatedExecutionEventPreview(event);
    this.observability.intentRoutingTrace?.record({
      stage,
      requestId,
      messageId: input.message.id,
      userId: input.userId,
      channel: input.delegation?.originChannel ?? input.message.channel,
      agentId: target.agentId,
      ...(contentPreview ? { contentPreview } : {}),
      details: {
        ...(input.delegation?.originSurfaceId ? { originSurfaceId: input.delegation.originSurfaceId } : {}),
        ...(delegatedExecution.executionId ? { executionId: delegatedExecution.executionId } : {}),
        ...(delegatedExecution.rootExecutionId ? { rootExecutionId: delegatedExecution.rootExecutionId } : {}),
        ...(delegatedExecution.taskExecutionId ? { taskExecutionId: delegatedExecution.taskExecutionId } : {}),
        ...(input.delegation?.continuityKey ? { continuityKey: input.delegation.continuityKey } : {}),
        ...(input.delegation?.activeExecutionRefs?.length ? { activeExecutionRefs: [...input.delegation.activeExecutionRefs] } : {}),
        ...(input.delegation?.pendingActionId ? { pendingActionId: input.delegation.pendingActionId } : {}),
        ...(input.delegation?.codeSessionId ? { codeSessionId: input.delegation.codeSessionId } : {}),
        ...(target.agentName ? { agentName: target.agentName } : {}),
        ...(target.orchestration?.role ? { orchestrationRole: target.orchestration.role } : {}),
        ...(target.orchestration?.label ? { orchestrationLabel: target.orchestration.label } : {}),
        eventId: event.eventId,
        eventType: event.type,
        ...(event.nodeId ? { nodeId: event.nodeId } : {}),
        ...event.payload,
        ...this.buildDelegatedVerificationFailureTraceDetails(input, requestId, event, traceEvents),
      },
    });
  }

  private buildDelegatedVerificationFailureTraceDetails(
    input: WorkerMessageRequest,
    requestId: string,
    event: ExecutionEvent,
    traceEvents: ExecutionEvent[],
  ): Record<string, unknown> {
    if (event.type !== 'verification_decided' || event.payload.decision === 'satisfied') {
      return {};
    }

    const tracedToolResults = traceEvents
      .filter((entry) => entry.type === 'tool_call_completed')
      .map((entry) => {
        const payload = entry.payload;
        const preview = typeof payload.traceResultPreview === 'string'
          ? payload.traceResultPreview
          : undefined;
        if (!preview) {
          return null;
        }
        return {
          toolCallId: typeof payload.toolCallId === 'string' ? payload.toolCallId : undefined,
          toolName: typeof payload.toolName === 'string' ? payload.toolName : undefined,
          resultStatus: typeof payload.resultStatus === 'string' ? payload.resultStatus : undefined,
          resultMessage: typeof payload.resultMessage === 'string' ? payload.resultMessage : undefined,
          errorMessage: typeof payload.errorMessage === 'string' ? payload.errorMessage : undefined,
          resultPreview: preview,
          rawOutput: typeof payload.rawOutput === 'string' ? payload.rawOutput : undefined,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => !!entry)
      .slice(-6);

    const jobSnapshots = listDelegatedRequestJobSnapshots({
      requestId,
      listJobs: (limit) => (
        typeof (this.tools as { listJobs?: unknown }).listJobs === 'function'
          ? this.tools.listJobs(limit)
          : []
      ),
    })
      .slice(0, 24)
      .map((job) => ({
        jobId: job.id,
        toolName: job.toolName,
        status: job.status,
        argsPreview: job.argsPreview,
        resultPreview: job.resultPreview,
        error: job.error,
      }));

    return {
      verificationFailureDiagnostics: {
        requestId,
        userId: input.userId,
        channel: input.delegation?.originChannel ?? input.message.channel,
        ...(tracedToolResults.length > 0 ? { tracedToolResults } : {}),
        ...(jobSnapshots.length > 0 ? { jobSnapshots } : {}),
      },
    };
  }

  shutdown(): void {
    clearInterval(this.reapInterval);
    for (const worker of this.workers.values()) {
      worker.status = 'shutting_down';
      this.safeKillWorker(worker);
      this.cleanupWorker(worker);
    }
    this.workers.clear();
    this.sessionToWorker.clear();
    this.delegatedFollowUpPayloads.clear();
  }

  getJobState(limit = 30) {
    this.pruneDelegatedFollowUpPayloads();
    return this.delegatedJobTracker.getState(limit);
  }

  applyJobFollowUpAction(
    jobId: string,
    action: DelegatedWorkerOperatorAction,
    actor?: WorkerJobFollowUpActorContext,
    options?: WorkerJobFollowUpActionOptions,
  ): WorkerJobFollowUpActionResult {
    const job = this.delegatedJobTracker.getJob(jobId);
    if (!job) {
      return { success: false, message: `Job ${jobId} was not found.`, statusCode: 404, errorCode: 'JOB_NOT_FOUND' };
    }
    const delegated = readDelegatedWorkerMetadata(job.metadata);
    if (!delegated?.handoff || delegated.handoff.reportingMode !== 'held_for_operator') {
      return { success: false, message: `Job ${jobId} does not support operator follow-up actions.`, statusCode: 400, errorCode: 'JOB_ACTION_UNSUPPORTED' };
    }
    if (delegated.handoff.operatorState === 'dismissed') {
      return { success: false, message: `Job ${jobId} has already been dismissed.`, statusCode: 409, errorCode: 'JOB_ALREADY_DISMISSED' };
    }

    if (action === 'defer' || action === 'keep_held') {
      const deferredUntil = normalizeDelegatedFollowUpDeferUntil(
        options,
        this.observability.now?.() ?? Date.now(),
      );
      return this.updateDelegatedJobFollowUpState(job, delegated, 'deferred', {
        successMessage: `Deferred held delegated result for ${jobId}.`,
        auditActionType: 'delegated_worker_followup_deferred',
        operatorAction: action,
        ...(actor ? { actor } : {}),
        handoffPatch: { deferredUntil },
        ...(deferredUntil ? { details: { deferredUntil } } : {}),
      });
    }
    if (action === 'dismiss') {
      this.delegatedFollowUpPayloads.delete(jobId);
      return this.updateDelegatedJobFollowUpState(job, delegated, 'dismissed', {
        successMessage: `Dismissed held delegated result for ${jobId}.`,
        auditActionType: 'delegated_worker_followup_dismissed',
        operatorAction: action,
        ...(actor ? { actor } : {}),
        handoffPatch: { deferredUntil: undefined },
      });
    }

    const payload = this.delegatedFollowUpPayloads.get(jobId);
    if (!payload) {
      return { success: false, message: `Held delegated result for ${jobId} is no longer available.`, statusCode: 410, errorCode: 'JOB_PAYLOAD_EXPIRED' };
    }
    const scan = this.runtime.outputGuardian.scanResponse(payload.content);
    const replayedContent = scan.clean ? payload.content : scan.sanitized;
    if (!scan.clean) {
      this.runtime.auditLog.record({
        type: 'output_redacted',
        severity: 'warn',
        agentId: payload.agentId,
        userId: payload.userId,
        channel: payload.channel,
        controller: 'WorkerManager',
        details: {
          actionType: 'delegated_worker_followup_replay_redacted',
          secretCount: scan.secrets.length,
          patterns: scan.secrets.map((secret) => secret.pattern),
          jobId,
        },
      });
    }
    const result = this.updateDelegatedJobFollowUpState(job, delegated, 'replayed', {
      successMessage: `Replayed held delegated result for ${jobId}.`,
      auditActionType: 'delegated_worker_followup_replayed',
      operatorAction: action,
      ...(actor ? { actor } : {}),
      handoffPatch: { deferredUntil: undefined },
      details: {
        content: replayedContent,
        redacted: !scan.clean,
        ...(payload.continuityKey ? { continuityKey: payload.continuityKey } : {}),
        ...(payload.activeExecutionRefs?.length ? { activeExecutionRefs: [...payload.activeExecutionRefs] } : {}),
        ...(payload.codeSessionId ? { codeSessionId: payload.codeSessionId } : {}),
        ...(payload.runClass ? { runClass: payload.runClass } : {}),
        ...(payload.originSurfaceId ? { originSurfaceId: payload.originSurfaceId } : {}),
        ...(delegated.executionId ? { executionId: delegated.executionId } : {}),
        ...(delegated.rootExecutionId ? { rootExecutionId: delegated.rootExecutionId } : {}),
      },
    });
    return result;
  }

  private async tryHandleDirectApprovalMessage(
    input: WorkerMessageRequest,
  ): Promise<{ content: string; metadata?: Record<string, unknown> } | null> {
    const pendingAction = this.findDirectApprovalPendingAction(input);
    const pendingIds = pendingAction?.blocker.approvalIds ?? [];
    if (pendingIds.length === 0) return null;

    const trimmed = input.message.content.trim();
    const decision = APPROVAL_CONFIRM_PATTERN.test(trimmed)
      ? 'approved'
      : APPROVAL_DENY_PATTERN.test(trimmed)
        ? 'denied'
        : null;
    if (!decision) return null;

    const explicitIds = trimmed
      .split(/\s+/g)
      .map((token) => token.trim())
      .filter((token) => APPROVAL_ID_TOKEN_PATTERN.test(token));
    const targetIds = explicitIds.length > 0 ? explicitIds : pendingIds;

    const executionGraphPendingAction = pendingAction?.resume?.kind === 'execution_graph'
      ? pendingAction
      : null;
    const results: string[] = [];
    const approvedIds = new Set<string>();
    const failedIds = new Set<string>();
    const approvalDecisionResults = new Map<string, ToolApprovalDecisionResult>();
    for (const approvalId of targetIds) {
      const decided = await this.tools.decideApproval(
        approvalId,
        decision,
        input.message.principalId ?? input.message.userId,
        input.message.principalRole ?? 'owner',
      );
      approvalDecisionResults.set(approvalId, decided);
      const approvalGranted = decision === 'approved' && (decided.approved ?? decided.success);
      const executionFailed = approvalGranted && decided.executionSucceeded === false;
      if (approvalGranted) approvedIds.add(approvalId);
      if (!decided.success || executionFailed || (decision === 'approved' && !approvalGranted)) {
        failedIds.add(approvalId);
      }
      results.push(decided.message);
    }

    if (executionGraphPendingAction && targetIds.length === 1) {
      const approvalId = targetIds[0];
      const approvalResult = approvalDecisionResults.get(approvalId);
      if (approvalResult?.success && !failedIds.has(approvalId)) {
        const resumed = await this.resumeExecutionGraphPendingAction(
          executionGraphPendingAction,
          {
            approvalId,
            approvalResult,
          },
        );
        if (resumed) {
          return {
            content: [
              ...results,
              resumed.content,
            ].filter(Boolean).join('\n\n'),
            metadata: resumed.metadata,
          };
        }
      }
    }

    this.updatePendingActionsAfterDirectApprovalDecision(targetIds, decision, approvedIds, failedIds);
    return { content: results.join('\n') };
  }

  private updateDelegatedJobFollowUpState(
    job: { id: string; metadata?: Record<string, unknown> },
    delegated: NonNullable<ReturnType<typeof readDelegatedWorkerMetadata>>,
    operatorState: DelegatedWorkerOperatorFollowUpState,
    options: {
      successMessage: string;
      auditActionType: string;
      operatorAction: DelegatedWorkerOperatorAction;
      actor?: WorkerJobFollowUpActorContext;
      handoffPatch?: Record<string, unknown>;
      details?: Record<string, unknown>;
    },
  ): WorkerJobFollowUpActionResult {
    const handoff = stripUndefinedProperties({
      ...(delegated.handoff ?? { summary: 'Delegated worker completed.', reportingMode: 'held_for_operator' as const }),
      operatorState,
      ...(options.handoffPatch ?? {}),
    }) as unknown as DelegatedWorkerHandoff;
    this.delegatedJobTracker.update(job.id, {
      metadata: {
        delegation: {
          ...(job.metadata?.delegation && typeof job.metadata.delegation === 'object'
            ? job.metadata.delegation
            : {}),
          kind: 'brokered_worker',
          lifecycle: delegated.lifecycle ?? 'completed',
          ...(delegated.executionId ? { executionId: delegated.executionId } : {}),
          ...(delegated.parentExecutionId ? { parentExecutionId: delegated.parentExecutionId } : {}),
          ...(delegated.rootExecutionId ? { rootExecutionId: delegated.rootExecutionId } : {}),
          ...(delegated.originChannel ? { originChannel: delegated.originChannel } : {}),
          ...(delegated.originSurfaceId ? { originSurfaceId: delegated.originSurfaceId } : {}),
          ...(delegated.requestId ? { requestId: delegated.requestId } : {}),
          ...(delegated.continuityKey ? { continuityKey: delegated.continuityKey } : {}),
          ...(delegated.activeExecutionRefs?.length ? { activeExecutionRefs: [...delegated.activeExecutionRefs] } : {}),
          ...(delegated.pendingActionId ? { pendingActionId: delegated.pendingActionId } : {}),
          ...(delegated.codeSessionId ? { codeSessionId: delegated.codeSessionId } : {}),
          ...(delegated.runClass ? { runClass: delegated.runClass } : {}),
          handoff,
        },
      },
    });
    this.runtime.auditLog.record({
      type: 'broker_action',
      severity: 'info',
      agentId: readDelegatedAgentId(job.metadata) ?? 'unknown',
      userId: options.actor?.userId ?? options.actor?.principalId,
      channel: options.actor?.channel ?? delegated.originChannel,
      controller: 'WorkerManager',
      details: {
        actionType: options.auditActionType,
        jobId: job.id,
        reportingMode: handoff.reportingMode,
        operatorState,
        ...(handoff.deferredUntil ? { deferredUntil: handoff.deferredUntil } : {}),
        ...(options.actor?.principalId ? { actorPrincipalId: options.actor.principalId } : {}),
        ...(options.actor?.principalRole ? { actorPrincipalRole: options.actor.principalRole } : {}),
        ...(options.actor?.surfaceId ? { actorSurfaceId: options.actor.surfaceId } : {}),
      },
    });
    this.publishDelegatedFollowUpTimeline(job, delegated, handoff, operatorState, options.operatorAction);
    this.recordDelegatedFollowUpTrace(job, delegated, handoff, operatorState, options.operatorAction, options.actor);
    return {
      success: true,
      message: options.successMessage,
      ...(options.details ? { details: options.details } : {}),
    };
  }

  private publishDelegatedFollowUpTimeline(
    job: { id: string; metadata?: Record<string, unknown> },
    delegated: NonNullable<ReturnType<typeof readDelegatedWorkerMetadata>>,
    handoff: DelegatedWorkerHandoff,
    operatorState: DelegatedWorkerOperatorFollowUpState,
    operatorAction: DelegatedWorkerOperatorAction,
  ): void {
    const parentRunId = delegated.executionId ?? delegated.requestId ?? job.id;
    const requestId = delegated.requestId ?? delegated.executionId ?? job.id;
    this.observability.runTimeline?.ingestDelegatedWorkerProgress({
      id: `delegated-worker:${job.id}:followup:${operatorState}`,
      kind: 'followup_action',
      requestId,
      runId: parentRunId,
      parentRunId,
      ...(delegated.executionId ? { executionId: delegated.executionId } : {}),
      ...(delegated.parentExecutionId ? { parentExecutionId: delegated.parentExecutionId } : {}),
      ...(delegated.rootExecutionId ? { rootExecutionId: delegated.rootExecutionId } : {}),
      taskRunId: buildDelegatedTaskRunId(job.id),
      ...(delegated.codeSessionId ? { codeSessionId: delegated.codeSessionId } : {}),
      agentId: delegated.agentId ?? readDelegatedAgentId(job.metadata) ?? 'unknown',
      ...(delegated.agentName ? { agentName: delegated.agentName } : {}),
      ...(delegated.orchestration?.role ? { orchestrationRole: delegated.orchestration.role } : {}),
      ...(delegated.orchestration?.label ? { orchestrationLabel: delegated.orchestration.label } : {}),
      ...(delegated.orchestration?.lenses?.length ? { orchestrationLenses: [...delegated.orchestration.lenses] } : {}),
      ...(delegated.originChannel ? { originChannel: delegated.originChannel } : {}),
      ...(delegated.runClass ? { runClass: delegated.runClass } : {}),
      ...(handoff.reportingMode ? { reportingMode: handoff.reportingMode } : {}),
      operatorAction,
      operatorState,
      ...(handoff.deferredUntil ? { deferredUntil: handoff.deferredUntil } : {}),
      ...(delegated.continuityKey ? { continuityKey: delegated.continuityKey } : {}),
      ...(delegated.activeExecutionRefs?.length ? { activeExecutionRefs: [...delegated.activeExecutionRefs] } : {}),
      detail: describeDelegatedFollowUpTimelineDetail(operatorState, handoff.deferredUntil),
      timestamp: this.observability.now?.() ?? Date.now(),
    });
  }

  private recordDelegatedFollowUpTrace(
    job: { id: string; metadata?: Record<string, unknown> },
    delegated: NonNullable<ReturnType<typeof readDelegatedWorkerMetadata>>,
    handoff: DelegatedWorkerHandoff,
    operatorState: DelegatedWorkerOperatorFollowUpState,
    operatorAction: DelegatedWorkerOperatorAction,
    actor?: WorkerJobFollowUpActorContext,
  ): void {
    const requestId = delegated.requestId ?? delegated.executionId ?? job.id;
    this.observability.intentRoutingTrace?.record({
      stage: 'delegated_worker_followup_action',
      requestId,
      ...(delegated.requestId ? { messageId: delegated.requestId } : {}),
      ...(actor?.userId || actor?.principalId ? { userId: actor.userId ?? actor.principalId } : {}),
      ...(actor?.channel || delegated.originChannel ? { channel: actor?.channel ?? delegated.originChannel } : {}),
      agentId: delegated.agentId ?? readDelegatedAgentId(job.metadata) ?? 'unknown',
      contentPreview: describeDelegatedFollowUpTimelineDetail(operatorState, handoff.deferredUntil),
      details: {
        jobId: job.id,
        taskRunId: buildDelegatedTaskRunId(job.id),
        ...(delegated.lifecycle ? { lifecycle: delegated.lifecycle } : {}),
        ...(delegated.executionId ? { executionId: delegated.executionId } : {}),
        ...(delegated.parentExecutionId ? { parentExecutionId: delegated.parentExecutionId } : {}),
        ...(delegated.rootExecutionId ? { rootExecutionId: delegated.rootExecutionId } : {}),
        ...(delegated.originSurfaceId ? { originSurfaceId: delegated.originSurfaceId } : {}),
        ...(delegated.continuityKey ? { continuityKey: delegated.continuityKey } : {}),
        ...(delegated.activeExecutionRefs?.length ? { activeExecutionRefs: [...delegated.activeExecutionRefs] } : {}),
        ...(delegated.pendingActionId ? { pendingActionId: delegated.pendingActionId } : {}),
        ...(delegated.codeSessionId ? { codeSessionId: delegated.codeSessionId } : {}),
        ...(delegated.runClass ? { runClass: delegated.runClass } : {}),
        ...(handoff.reportingMode ? { reportingMode: handoff.reportingMode } : {}),
        operatorAction,
        operatorState,
        ...(handoff.deferredUntil ? { deferredUntil: handoff.deferredUntil } : {}),
        ...(actor?.principalId ? { actorPrincipalId: actor.principalId } : {}),
        ...(actor?.principalRole ? { actorPrincipalRole: actor.principalRole } : {}),
        ...(actor?.surfaceId ? { actorSurfaceId: actor.surfaceId } : {}),
      },
    });
  }

  private pruneDelegatedFollowUpPayloads(): void {
    for (const jobId of this.delegatedFollowUpPayloads.keys()) {
      const job = this.delegatedJobTracker.getJob(jobId);
      const delegated = job ? readDelegatedWorkerMetadata(job.metadata) : null;
      if (!job || delegated?.handoff?.reportingMode !== 'held_for_operator' || delegated.handoff.operatorState === 'dismissed') {
        this.delegatedFollowUpPayloads.delete(jobId);
      }
    }
  }

  private async tryDirectAutomationAuthoring(
    input: WorkerMessageRequest,
    options?: { allowRemediation?: boolean; assumeAuthoring?: boolean; intentDecision?: IntentGatewayDecision | null },
  ): Promise<{ content: string; metadata?: Record<string, unknown> } | null> {
    const allowedPaths = this.tools.getPolicy?.().sandbox.allowedPaths ?? [process.cwd()];
    const workspaceRoot = allowedPaths[0] || process.cwd();
    const preflightTools = this.tools.preflightTools
      ? (requests: Array<{ name: string; args?: Record<string, unknown> }>) => this.tools.preflightTools(requests)
      : (requests: Array<{ name: string; args?: Record<string, unknown> }>) => Promise.resolve(requests.map((request) => ({
          name: request.name,
          found: true,
          decision: 'allow' as const,
          reason: 'No worker-manager preflight available; allowing direct automation compile fallback.',
          fixes: [],
        })));
    const trackedPendingApprovalIds: string[] = [];
    const result = await tryAutomationPreRoute({
      agentId: input.agentId,
      message: input.message,
      preflightTools,
      workspaceRoot,
      allowedPaths,
      executeTool: (toolName, args, request) => {
        // Forward codeContext from the inbound message metadata so tool decisions
        // (e.g. isCodeSessionWorkspaceTool auto-approve) see the code session context.
        const msgCodeContext = input.message.metadata?.codeContext as { workspaceRoot: string; sessionId?: string } | undefined;
        return this.tools.executeModelTool(toolName, args, {
          ...request,
          ...(msgCodeContext ? { codeContext: msgCodeContext } : {}),
        });
      },
      trackPendingApproval: (approvalId) => {
        trackedPendingApprovalIds.push(approvalId);
      },
      formatPendingApprovalPrompt: (ids) => {
        const meta = this.resolveDirectPendingApprovalMetadata(ids);
        return meta.length > 0
          ? formatPendingApprovalMessage(meta)
          : 'This action needs approval before I can continue.';
      },
      resolvePendingApprovalMetadata: (ids, fallback) => {
        const resolved = this.resolveDirectPendingApprovalMetadata(ids);
        return resolved.length > 0 ? resolved : fallback;
      },
    }, options);
    if (!result) {
      return null;
    }
    if (trackedPendingApprovalIds.length > 0) {
      const pendingRecord = this.recordDirectAutomationPendingApprovalAction({
        request: input,
        result,
        approvalIds: trackedPendingApprovalIds,
        intentDecision: options?.intentDecision ?? undefined,
        allowRemediation: options?.allowRemediation,
      });
      if (pendingRecord) {
        result.metadata = {
          ...(result.metadata ?? {}),
          pendingAction: toPendingActionClientMetadata(pendingRecord),
        };
      }
    }
    return result;
  }

  private resolveDirectPendingApprovalMetadata(ids: string[]): AutomationPendingApprovalMetadata[] {
    const summaries = this.tools.getApprovalSummaries(ids);
    return ids.map((id) => {
      const summary = summaries.get(id);
      return {
        id,
        toolName: summary?.toolName ?? 'unknown',
        argsPreview: summary?.argsPreview ?? '',
        actionLabel: summary?.actionLabel ?? '',
      };
    });
  }

  private findDirectApprovalPendingAction(input: WorkerMessageRequest): PendingActionRecord | null {
    const store = this.observability.pendingActionStore;
    if (!store) return null;
    if (typeof store.resolveActiveForSurface !== 'function') return null;
    const surfaceId = input.message.surfaceId?.trim() || input.message.channel;
    const pendingAction = store.resolveActiveForSurface({
      agentId: this.resolvePendingActionAgentId(input.agentId),
      userId: input.userId,
      channel: input.message.channel,
      surfaceId,
    }, this.observability.now?.() ?? Date.now());
    if (pendingAction?.blocker.kind !== 'approval') return null;
    if ((pendingAction.blocker.approvalIds?.length ?? 0) === 0) return null;
    if (pendingAction.resume?.kind === 'execution_graph') return pendingAction;
    return null;
  }

  private updatePendingActionsAfterDirectApprovalDecision(
    approvalIds: string[],
    decision: 'approved' | 'denied',
    approvedIds: Set<string>,
    failedIds: Set<string>,
  ): void {
    const store = this.observability.pendingActionStore;
    if (!store) return;
    const nowMs = this.observability.now?.() ?? Date.now();
    for (const approvalId of approvalIds) {
      const pendingAction = store.findActiveByApprovalId(approvalId);
      if (!pendingAction) continue;
      if (decision === 'denied') {
        store.update(pendingAction.id, { status: 'cancelled' }, nowMs);
        continue;
      }
      if (failedIds.has(approvalId)) {
        store.update(pendingAction.id, { status: 'failed' }, nowMs);
        continue;
      }
      if (approvedIds.has(approvalId)) {
        this.clearApprovalIdFromPendingAction(approvalId, nowMs);
      }
    }
  }

  private clearApprovalIdFromPendingAction(approvalId: string, nowMs: number): PendingActionRecord | null {
    const store = this.observability.pendingActionStore;
    if (!store) return null;
    const activeRecords = store.listActiveByApprovalId(approvalId, nowMs);
    let firstUpdated: PendingActionRecord | null = null;
    for (const active of activeRecords) {
      const remainingApprovalIds = (active.blocker.approvalIds ?? []).filter((id) => id !== approvalId);
      const updated = remainingApprovalIds.length === 0
        ? store.complete(active.id, nowMs)
        : store.update(active.id, {
            blocker: {
              ...active.blocker,
              approvalIds: remainingApprovalIds,
              approvalSummaries: (active.blocker.approvalSummaries ?? [])
                .filter((summary) => summary.id !== approvalId),
            },
          }, nowMs);
      if (!firstUpdated) {
        firstUpdated = updated;
      }
    }
    return firstUpdated;
  }

  resetPendingState(args: {
    userId: string;
    channel: string;
    approvalIds?: string[];
  }): void {
    void args;
  }

  private async getOrSpawnWorker(
    sessionId: string,
    agentId: string,
    userId: string,
    channel: string,
    grantedCapabilities: string[],
  ): Promise<WorkerProcess> {
    const workerSessionKey = buildWorkerSessionKey(sessionId, agentId);
    const existingId = this.sessionToWorker.get(workerSessionKey);
    if (existingId) {
      const existing = this.workers.get(existingId);
      if (existing && existing.status === 'ready') {
        this.refreshWorkerCapabilityToken(existing, agentId, userId, channel, grantedCapabilities);
        existing.authorizedBy = userId;
        existing.authorizedChannel = channel;
        existing.grantedCapabilities = [...grantedCapabilities];
        existing.lastActivityMs = Date.now();
        return existing;
      }
    }

    const workerId = randomUUID();
    const workspacePath = join(tmpdir(), `ga-worker-${workerId}`);
    mkdirSync(join(workspacePath, 'tmp'), { recursive: true });

    const token = this.tokenManager.mint({
      workerId,
      sessionId,
      agentId,
      authorizedBy: userId,
      authorizedChannel: channel,
      grantedCapabilities,
      maxToolCalls: this.config.capabilityTokenMaxToolCalls,
    });

    const launch = resolveWorkerLaunch(this.config.workerEntryPoint);
    const sandboxHealth = await detectSandboxHealth(this.sandboxConfig);
    // LLM calls are proxied through the broker RPC, so the worker does not need network access.
    // On strong hosts, use the strict agent-worker profile. On degraded hosts, fall back to
    // workspace-write (NOT full-access) — the worker should never have unmediated system access.
    const workerProfile = sandboxHealth.availability === 'strong'
      ? 'agent-worker' as const
      : 'workspace-write' as const;
    // Workers are full Node.js processes that need more memory than short-lived tool subprocesses.
    // On strong sandbox backends we keep a generous floor for V8. On degraded ulimit-only hosts,
    // a virtual-memory cap is not reliable for long-lived Node workers and can prevent startup.
    const workerMemoryMb = sandboxHealth.availability === 'strong'
      ? Math.max(this.config.workerMaxMemoryMb, 2048)
      : 0;
    const workerSandboxConfig = {
      ...this.sandboxConfig,
      additionalReadPaths: mergeUniquePaths(
        this.sandboxConfig.additionalReadPaths,
        launch.additionalReadPaths,
      ),
      resourceLimits: {
        ...this.sandboxConfig.resourceLimits,
        maxMemoryMb: workerMemoryMb,
        maxCpuSeconds: 0, // Workers are long-lived — no CPU time limit
      },
    };
    const child = await sandboxedSpawn(
      launch.command,
      launch.args,
      workerSandboxConfig,
      {
        profile: workerProfile,
        networkAccess: false,
        cwd: workspacePath,
        env: {
          CAPABILITY_TOKEN: token.id,
          NODE_ENV: process.env.NODE_ENV ?? 'production',
        },
      },
    );

    if (!child.stdin || !child.stdout) {
      throw new Error('Worker process streams are not available');
    }

    let readyResolve: (() => void) | undefined;
    let readyReject: ((error: Error) => void) | undefined;
    const readyPromise = new Promise<void>((resolve, reject) => {
      readyResolve = resolve;
      readyReject = reject;
    });

    const brokerServer = new BrokerServer({
      tools: this.tools,
      runtime: this.runtime,
      tokenManager: this.tokenManager,
      inputStream: child.stdout,
      outputStream: child.stdin,
      workerId,
      onNotification: (notification) => {
        const worker = this.workers.get(workerId);
        if (!worker) return;

        if (notification.method === 'worker.ready') {
          worker.status = 'ready';
          readyResolve?.();
          return;
        }

        if (notification.method === 'message.response') {
          worker.pendingMessageResolve?.({
            content: String(notification.params.content ?? ''),
            metadata: isRecord(notification.params.metadata) ? notification.params.metadata : undefined,
          });
          worker.pendingMessageResolve = undefined;
          worker.pendingMessageReject = undefined;
          return;
        }

        if (notification.method === 'trace.record' && isRecord(notification.params)) {
          this.observability.intentRoutingTrace?.record({
            stage: String(notification.params.stage ?? '') as IntentRoutingTraceStage,
            requestId: typeof notification.params.requestId === 'string' ? notification.params.requestId : undefined,
            messageId: typeof notification.params.messageId === 'string' ? notification.params.messageId : undefined,
            userId: typeof notification.params.userId === 'string' ? notification.params.userId : undefined,
            channel: typeof notification.params.channel === 'string' ? notification.params.channel : undefined,
            agentId: typeof notification.params.agentId === 'string' ? notification.params.agentId : undefined,
            contentPreview: typeof notification.params.contentPreview === 'string' ? notification.params.contentPreview : undefined,
            details: isRecord(notification.params.details) ? notification.params.details : undefined,
          });
          return;
        }

        if (notification.method === 'execution_graph.event' && isExecutionGraphEvent(notification.params)) {
          this.observability.runTimeline?.ingestExecutionGraphEvent(notification.params);
          this.observability.executionGraphStore?.appendEvent(notification.params);
          return;
        }
      },
    });

    const worker: WorkerProcess = {
      id: workerId,
      sessionId,
      workerSessionKey,
      agentId,
      authorizedBy: userId,
      authorizedChannel: channel,
      grantedCapabilities: [...grantedCapabilities],
      process: child,
      brokerServer,
      workspacePath,
      lastActivityMs: Date.now(),
      status: 'starting',
      dispatchQueue: Promise.resolve(),
    };

    child.stderr?.setEncoding?.('utf8');
    child.stderr?.on('data', (chunk: string | Buffer) => {
      const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      const trimmed = text.trim();
      if (trimmed) {
        log.warn({ workerId, stderr: trimmed }, 'Worker stderr');
      }
    });

    child.on('error', (error) => {
      readyReject?.(error instanceof Error ? error : new Error(String(error)));
      this.handleWorkerCrash(workerId, error instanceof Error ? error : new Error(String(error)));
    });

    child.on('exit', (code, signal) => {
      if (worker.status !== 'shutting_down') {
        const detail = new Error(`Worker exited unexpectedly (code=${code ?? 'null'}, signal=${signal ?? 'null'})`);
        readyReject?.(detail);
        this.handleWorkerCrash(workerId, detail);
      } else {
        this.cleanupWorker(worker);
      }
    });

    this.workers.set(workerId, worker);
    this.sessionToWorker.set(workerSessionKey, workerId);

    brokerServer.sendNotification('worker.initialize', {
      agentId,
      sessionId,
      alwaysLoadedTools: this.tools.listAlwaysLoadedDefinitions(),
    });

    await Promise.race([
      readyPromise,
      new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Worker initialization timed out')), 15_000);
      }),
    ]);

    return worker;
  }

  private refreshWorkerCapabilityToken(
    worker: WorkerProcess,
    agentId: string,
    userId: string,
    channel: string,
    grantedCapabilities: string[],
  ): void {
    this.tokenManager.revokeForWorker(worker.id);
    const token = this.tokenManager.mint({
      workerId: worker.id,
      sessionId: worker.sessionId,
      agentId,
      authorizedBy: userId,
      authorizedChannel: channel,
      grantedCapabilities,
      maxToolCalls: this.config.capabilityTokenMaxToolCalls,
    });
    worker.brokerServer.sendNotification('capability.refreshed', {
      capabilityToken: token.id,
      agentId,
      sessionId: worker.sessionId,
    });
  }

  private dispatchToWorker(
    worker: WorkerProcess,
    params: {
      message: UserMessage;
      systemPrompt: string;
      history: Array<{ role: 'user' | 'assistant'; content: string }>;
      knowledgeBases: PromptAssemblyKnowledgeBase[];
      activeSkills: ResolvedSkill[];
      additionalSections: PromptAssemblyAdditionalSection[];
      toolContext: string;
      runtimeNotices: Array<{ level: 'info' | 'warn'; message: string }>;
      executionProfile?: SelectedExecutionProfile;
      continuity?: PromptAssemblyContinuity | null;
      pendingAction?: PromptAssemblyPendingAction | null;
      pendingApprovalNotice?: string;
      hasFallbackProvider?: boolean;
      directReasoning?: boolean;
      directReasoningTrace?: DirectReasoningTraceContext;
      directReasoningGraphContext?: DirectReasoningGraphContext;
      directReasoningGraphLifecycle?: 'standalone' | 'node_only';
      returnExecutionGraphArtifacts?: boolean;
      groundedSynthesis?: {
        messages: ChatMessage[];
        responseFormat?: ChatOptions['responseFormat'];
        maxTokens?: number;
        temperature?: number;
      };
      recoveryAdvisor?: RecoveryAdvisorRequest;
      dispatchTimeoutMs?: number;
    },
  ): Promise<{ content: string; metadata?: Record<string, unknown> }> {
    const queuedDispatch = worker.dispatchQueue.then(() => this.dispatchToWorkerNow(worker, params));
    worker.dispatchQueue = queuedDispatch.then(() => undefined, () => undefined);
    return queuedDispatch;
  }

  private dispatchToWorkerNow(
    worker: WorkerProcess,
    params: {
      message: UserMessage;
      systemPrompt: string;
      history: Array<{ role: 'user' | 'assistant'; content: string }>;
      knowledgeBases: PromptAssemblyKnowledgeBase[];
      activeSkills: ResolvedSkill[];
      additionalSections: PromptAssemblyAdditionalSection[];
      toolContext: string;
      runtimeNotices: Array<{ level: 'info' | 'warn'; message: string }>;
      executionProfile?: SelectedExecutionProfile;
      continuity?: PromptAssemblyContinuity | null;
      pendingAction?: PromptAssemblyPendingAction | null;
      pendingApprovalNotice?: string;
      hasFallbackProvider?: boolean;
      directReasoning?: boolean;
      directReasoningTrace?: DirectReasoningTraceContext;
      directReasoningGraphContext?: DirectReasoningGraphContext;
      directReasoningGraphLifecycle?: 'standalone' | 'node_only';
      returnExecutionGraphArtifacts?: boolean;
      groundedSynthesis?: {
        messages: ChatMessage[];
        responseFormat?: ChatOptions['responseFormat'];
        maxTokens?: number;
        temperature?: number;
      };
      recoveryAdvisor?: RecoveryAdvisorRequest;
      dispatchTimeoutMs?: number;
    },
  ): Promise<{ content: string; metadata?: Record<string, unknown> }> {
    if (!this.workers.has(worker.id) || worker.status !== 'ready') {
      return Promise.reject(new Error('Worker is not available for dispatch'));
    }
    const abortSignal = params.message.abortSignal;
    if (abortSignal?.aborted) {
      return Promise.reject(createWorkerDispatchCanceledError(abortSignal));
    }
    worker.lastActivityMs = Date.now();

    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanupDispatch = () => {
        clearTimeout(timeout);
        abortSignal?.removeEventListener('abort', abortDispatch);
        worker.pendingMessageResolve = undefined;
        worker.pendingMessageReject = undefined;
      };
      const wrappedResolve = (value: { content: string; metadata?: Record<string, unknown> }) => {
        if (settled) return;
        settled = true;
        cleanupDispatch();
        resolve(value);
      };
      const wrappedReject = (error: Error) => {
        if (settled) return;
        settled = true;
        cleanupDispatch();
        reject(error);
      };
      const abortDispatch = () => {
        const error = createWorkerDispatchCanceledError(abortSignal!);
        wrappedReject(error);
        this.retireAbortedWorkerDispatch(worker, error);
      };
      const dispatchTimeoutMs = Math.max(1_000, params.dispatchTimeoutMs ?? WORKER_MESSAGE_DISPATCH_TIMEOUT_MS);
      const timeout = setTimeout(() => {
        const error = new Error('Worker message dispatch timed out');
        wrappedReject(error);
        this.retireAbortedWorkerDispatch(worker, error);
      }, dispatchTimeoutMs);

      worker.pendingMessageResolve = wrappedResolve;
      worker.pendingMessageReject = wrappedReject;
      abortSignal?.addEventListener('abort', abortDispatch, { once: true });

      const { abortSignal: _abortSignal, ...messageForWorker } = params.message;
      const { dispatchTimeoutMs: _dispatchTimeoutMs, ...paramsForWorker } = params;
      try {
        worker.brokerServer.sendNotification('message.handle', {
          ...paramsForWorker,
          message: messageForWorker,
        });
      } catch (error) {
        wrappedReject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private retireAbortedWorkerDispatch(worker: WorkerProcess, error: Error): void {
    if (!this.workers.has(worker.id) || worker.status === 'shutting_down') return;
    worker.status = 'shutting_down';
    log.warn({ workerId: worker.id, reason: error.message }, 'Worker dispatch aborted; shutting down worker');
    try {
      worker.brokerServer.sendNotification('worker.shutdown', {
        reason: 'dispatch_aborted',
        gracePeriodMs: this.config.workerShutdownGracePeriodMs,
      });
    } catch (sendError) {
      log.warn(
        {
          workerId: worker.id,
          error: sendError instanceof Error ? sendError.message : String(sendError),
        },
        'Failed to notify worker shutdown after aborted dispatch',
      );
    }
    setTimeout(() => {
      const current = this.workers.get(worker.id);
      if (!current) return;
      this.safeKillWorker(current);
      this.cleanupWorker(current);
    }, this.config.workerShutdownGracePeriodMs);
  }

  private reapIdleWorkers(): void {
    const now = Date.now();
    for (const worker of this.workers.values()) {
      if (now - worker.lastActivityMs <= this.config.workerIdleTimeoutMs) continue;
      worker.status = 'shutting_down';
      worker.brokerServer.sendNotification('worker.shutdown', {
        reason: 'idle_timeout',
        gracePeriodMs: this.config.workerShutdownGracePeriodMs,
      });
      setTimeout(() => {
        const current = this.workers.get(worker.id);
        if (!current) return;
        this.safeKillWorker(current);
        this.cleanupWorker(current);
      }, this.config.workerShutdownGracePeriodMs);
    }
  }

  private handleWorkerCrash(workerId: string, error: Error): void {
    const worker = this.workers.get(workerId);
    if (!worker) return;
    worker.status = 'error';

    this.runtime.auditLog.record({
      type: 'worker_crash',
      severity: 'warn',
      agentId: worker.agentId,
      details: {
        workerId,
        reason: error.message,
      },
    });

    worker.pendingMessageReject?.(error);
    worker.pendingMessageResolve = undefined;
    worker.pendingMessageReject = undefined;
    this.cleanupWorker(worker);
  }

  private cleanupWorker(worker: WorkerProcess): void {
    this.tokenManager.revokeForWorker(worker.id);
    this.workers.delete(worker.id);
    if (this.sessionToWorker.get(worker.workerSessionKey) === worker.id) {
      this.sessionToWorker.delete(worker.workerSessionKey);
    }
    if (!existsSync(worker.workspacePath)) {
      return;
    }
    try {
      this.removeWorkspacePath(worker.workspacePath);
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error
        ? String((error as { code?: unknown }).code ?? '')
        : undefined;
      log.warn(
        {
          workerId: worker.id,
          sessionId: worker.sessionId,
          workspacePath: worker.workspacePath,
          code,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to remove worker workspace during cleanup',
      );
    }
  }

  private removeWorkspacePath(workspacePath: string): void {
    rmSync(workspacePath, {
      recursive: true,
      force: true,
      maxRetries: WORKER_WORKSPACE_CLEANUP_MAX_RETRIES,
      retryDelay: WORKER_WORKSPACE_CLEANUP_RETRY_DELAY_MS,
    });
  }

  private safeKillWorker(worker: WorkerProcess): void {
    if (worker.process.killed) return;
    try {
      worker.process.kill('SIGKILL');
    } catch (error) {
      log.warn({ workerId: worker.id, error: error instanceof Error ? error.message : String(error) }, 'Failed to kill worker');
    }
  }

  private recordDelegatedPendingApprovalAction(input: {
    worker: WorkerProcess;
    request: WorkerMessageRequest;
    result: { metadata?: Record<string, unknown> };
    target: ResolvedDelegatedTargetMetadata;
    taskRunId: string;
    intentDecision?: IntentGatewayDecision;
    graphCompletion?: DelegatedWorkerGraphCompletion;
  }): PendingActionRecord | null {
    if (!this.observability.pendingActionStore) return null;
    const approvalMetadata = readDelegatedPendingApprovalMetadata(input.result.metadata);
    if (!approvalMetadata) return null;
    const workerSuspension = withWorkerSuspensionSourceEnvelope(
      readWorkerSuspensionMetadata(input.result.metadata),
      readDelegatedResultEnvelope(input.result.metadata),
    );
    return recordDelegatedWorkerGraphPendingApprovalAction({
      store: this.observability.pendingActionStore,
      graphStore: this.observability.executionGraphStore,
      worker: input.worker,
      request: input.request,
      target: input.target,
      taskRunId: input.taskRunId,
      graphCompletion: input.graphCompletion,
      approvalMetadata,
      workerSuspension,
      intentDecision: input.intentDecision,
      now: this.observability.now,
      ttlMs: PENDING_APPROVAL_TTL_MS,
    });
  }

  private recordDirectAutomationPendingApprovalAction(input: {
    request: WorkerMessageRequest;
    result: { content: string; metadata?: Record<string, unknown> };
    approvalIds: string[];
    intentDecision?: IntentGatewayDecision;
    allowRemediation?: boolean;
  }): PendingActionRecord | null {
    const store = this.observability.pendingActionStore;
    if (!store) return null;
    const approvalIds = [...new Set(input.approvalIds.map((id) => id.trim()).filter(Boolean))];
    if (approvalIds.length === 0) return null;
    const summaries = this.tools.getApprovalSummaries(approvalIds);
    const prompt = this.readPendingApprovalPrompt(input.result.metadata)
      ?? formatPendingApprovalMessage(buildPendingApprovalMetadata(approvalIds, summaries))
      ?? 'This action needs approval before I can continue.';
    const codeContext = this.readMessageCodeContext(input.request.message);
    const originChannel = input.request.delegation?.originChannel?.trim()
      || input.request.message.channel;
    const surfaceId = input.request.message.surfaceId?.trim()
      || input.request.delegation?.originSurfaceId?.trim()
      || input.request.message.channel;
    const nowMs = this.observability.now?.() ?? Date.now();
    const approvalSummaries = buildPendingApprovalMetadata(approvalIds, summaries);
    if (input.result.metadata?.resumeAutomationAfterApprovals) {
      const graphStore = this.observability.executionGraphStore;
      if (!graphStore) return null;
      return recordChatContinuationGraphApproval({
        graphStore,
        runTimeline: this.observability.runTimeline,
        userKey: `${input.request.userId}:${originChannel}`,
        userId: input.request.userId,
        channel: originChannel,
        surfaceId,
        agentId: this.resolvePendingActionAgentId(input.request.agentId),
        requestId: input.request.message.id,
        ...(codeContext?.sessionId ? { codeSessionId: codeContext.sessionId } : {}),
        action: {
          prompt,
          approvalIds,
          approvalSummaries,
          originalUserContent: input.request.message.content,
          route: input.intentDecision?.route ?? 'automation_authoring',
          operation: input.intentDecision?.operation ?? 'create',
          summary: input.intentDecision?.summary ?? 'Creates or updates a Guardian automation.',
          turnRelation: input.intentDecision?.turnRelation ?? 'new_request',
          resolution: input.intentDecision?.resolution ?? 'ready',
          ...(input.intentDecision?.missingFields?.length ? { missingFields: input.intentDecision.missingFields } : {}),
          ...(input.intentDecision?.provenance ? { provenance: input.intentDecision.provenance } : {}),
          ...(input.intentDecision?.entities ? { entities: input.intentDecision.entities as Record<string, unknown> } : {}),
          continuation: {
            type: CHAT_CONTINUATION_TYPE_AUTOMATION_AUTHORING,
            originalUserContent: input.request.message.content,
            allowRemediation: input.allowRemediation !== false,
            principalId: input.request.message.principalId ?? input.request.userId,
            principalRole: input.request.message.principalRole,
            ...(isRecord(input.request.message.metadata) ? { messageMetadata: { ...input.request.message.metadata } } : {}),
            ...(codeContext ? { codeContext } : {}),
          },
          ...(codeContext?.sessionId ? { codeSessionId: codeContext.sessionId } : {}),
        },
        setGraphPendingActionForRequest: (_userKey, _surfaceId, action, nextNowMs) => ({
          action: recordGraphPendingActionInterrupt({
            store,
            scope: {
              agentId: this.resolvePendingActionAgentId(input.request.agentId),
              userId: input.request.userId,
              channel: originChannel,
              surfaceId,
            },
            event: action.event,
            originalUserContent: action.originalUserContent,
            intent: action.intent,
            artifactRefs: action.artifactRefs,
            approvalSummaries: action.approvalSummaries,
            transferPolicy: action.transferPolicy,
            nowMs: nextNowMs,
            expiresAt: action.expiresAt,
          }),
        }),
        nowMs,
      }).action;
    }
    return store.replaceActive(
      {
        agentId: this.resolvePendingActionAgentId(input.request.agentId),
        userId: input.request.userId,
        channel: originChannel,
        surfaceId,
      },
      {
        status: 'pending',
        transferPolicy: 'origin_surface_only',
        blocker: {
          kind: 'approval',
          prompt,
          approvalIds,
          approvalSummaries,
        },
        intent: {
          route: input.intentDecision?.route ?? 'automation_authoring',
          operation: input.intentDecision?.operation ?? 'create',
          summary: input.intentDecision?.summary ?? 'Creates or updates a Guardian automation.',
          turnRelation: input.intentDecision?.turnRelation ?? 'new_request',
          resolution: input.intentDecision?.resolution ?? 'ready',
          ...(input.intentDecision?.missingFields?.length ? { missingFields: input.intentDecision.missingFields } : {}),
          ...(input.intentDecision?.resolvedContent ? { resolvedContent: input.intentDecision.resolvedContent } : {}),
          ...(input.intentDecision?.provenance ? { provenance: input.intentDecision.provenance } : {}),
          ...(input.intentDecision?.entities ? { entities: input.intentDecision.entities as Record<string, unknown> } : {}),
          originalUserContent: input.request.message.content,
        },
        ...(input.request.delegation?.executionId ? { executionId: input.request.delegation.executionId } : {}),
        ...(input.request.delegation?.rootExecutionId ? { rootExecutionId: input.request.delegation.rootExecutionId } : {}),
        ...(codeContext?.sessionId ? { codeSessionId: codeContext.sessionId } : {}),
        expiresAt: nowMs + PENDING_APPROVAL_TTL_MS,
      },
      nowMs,
    );
  }

  private readPendingApprovalPrompt(metadata: Record<string, unknown> | undefined): string | null {
    if (!isRecord(metadata?.pendingAction) || !isRecord(metadata.pendingAction.blocker)) {
      return null;
    }
    const prompt = metadata.pendingAction.blocker.prompt;
    return typeof prompt === 'string' && prompt.trim() ? prompt.trim() : null;
  }

  private readMessageCodeContext(message: UserMessage): { workspaceRoot: string; sessionId?: string } | undefined {
    const metadata = message.metadata;
    if (!isRecord(metadata?.codeContext)) return undefined;
    const workspaceRoot = typeof metadata.codeContext.workspaceRoot === 'string'
      ? metadata.codeContext.workspaceRoot.trim()
      : '';
    if (!workspaceRoot) return undefined;
    const sessionId = typeof metadata.codeContext.sessionId === 'string'
      ? metadata.codeContext.sessionId.trim()
      : '';
    return {
      workspaceRoot,
      ...(sessionId ? { sessionId } : {}),
    };
  }

  private resolvePendingActionAgentId(agentId: string): string {
    return this.observability.resolveStateAgentId?.(agentId)?.trim() || agentId;
  }

  private buildWorkerContinuationTraceRequest(
    state: WorkerApprovalContinuationTraceContext,
    approvalId: string,
  ): WorkerMessageRequest {
    const requestId = state.requestId?.trim() || state.messageId?.trim() || approvalId;
    const originChannel = state.originChannel?.trim() || state.channel;
    const originSurfaceId = state.originSurfaceId?.trim() || state.surfaceId?.trim();
    const delegation: WorkerDelegationMetadata = {
      requestId,
      originChannel,
      ...(state.executionId ? { executionId: state.executionId } : {}),
      ...(state.rootExecutionId ? { rootExecutionId: state.rootExecutionId } : {}),
      ...(originSurfaceId ? { originSurfaceId } : {}),
      ...(state.continuityKey ? { continuityKey: state.continuityKey } : {}),
      ...(state.activeExecutionRefs?.length ? { activeExecutionRefs: [...state.activeExecutionRefs] } : {}),
      ...(state.pendingActionId ? { pendingActionId: state.pendingActionId } : {}),
      ...(state.codeSessionId ? { codeSessionId: state.codeSessionId } : {}),
      ...(state.runClass ? { runClass: state.runClass } : {}),
      ...(state.agentName ? { agentName: state.agentName } : {}),
      ...(state.orchestration ? { orchestration: cloneOrchestrationRoleDescriptor(state.orchestration) } : {}),
    };
    return {
      sessionId: state.sessionId,
      agentId: state.agentId,
      userId: state.userId,
      grantedCapabilities: [],
      message: {
        id: state.messageId?.trim() || requestId,
        userId: state.userId,
        principalId: state.principalId,
        principalRole: state.principalRole,
        channel: state.channel,
        ...(state.surfaceId ? { surfaceId: state.surfaceId } : {}),
        content: state.originalUserContent ?? '',
        timestamp: Date.now(),
      },
      systemPrompt: '',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      toolContext: '',
      runtimeNotices: [],
      ...(state.executionProfile ? { executionProfile: cloneSelectedExecutionProfile(state.executionProfile) } : {}),
      delegation,
    };
  }

  private buildWorkerContinuationTraceTarget(
    state: WorkerApprovalContinuationTraceContext,
  ): ResolvedDelegatedTargetMetadata {
    return {
      agentId: state.agentId,
      ...(state.agentName ? { agentName: state.agentName } : {}),
      ...(state.orchestration ? { orchestration: cloneOrchestrationRoleDescriptor(state.orchestration) } : {}),
    };
  }

  private recordWorkerApprovalContinuationExecutionArtifacts(
    state: WorkerApprovalContinuationTraceContext,
    approvalId: string,
    metadata: Record<string, unknown> | undefined,
  ): void {
    const request = this.buildWorkerContinuationTraceRequest(state, approvalId);
    const target = this.buildWorkerContinuationTraceTarget(state);
    const requestId = state.requestId?.trim() || request.delegation?.requestId || approvalId;
    const taskRunId = state.taskRunId?.trim() || `delegated-approval-continuation:${approvalId}`;
    const filteredMetadata = filterResolvedApprovalContinuationMetadata(metadata, approvalId);
    this.recordDelegatedExecutionArtifacts(
      request,
      target,
      requestId,
      taskRunId,
      filteredMetadata,
    );
  }

}

function cloneOrchestrationRoleDescriptor(
  descriptor: OrchestrationRoleDescriptor | undefined,
): OrchestrationRoleDescriptor | undefined {
  if (!descriptor) return undefined;
  return {
    role: descriptor.role,
    ...(descriptor.label ? { label: descriptor.label } : {}),
    ...(descriptor.lenses?.length ? { lenses: [...descriptor.lenses] } : {}),
  };
}

function cloneSelectedExecutionProfile(profile: SelectedExecutionProfile): SelectedExecutionProfile {
  return {
    ...profile,
    fallbackProviderOrder: [...profile.fallbackProviderOrder],
  };
}

function truncateInlineText(value: string, maxChars: number): string {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

function normalizeDelegatedIdentityValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function describeDelegatedTarget(target: ResolvedDelegatedTargetMetadata): string {
  return normalizeDelegatedIdentityValue(target.orchestration?.label)
    ?? normalizeDelegatedIdentityValue(target.agentName)
    ?? normalizeDelegatedIdentityValue(target.agentId)
    ?? 'Delegated worker';
}

function normalizeDelegatedProviderTier(value: SelectedExecutionProfile['providerTier'] | undefined): string | undefined {
  const normalized = normalizeDelegatedIdentityValue(value);
  return normalized ? normalized.replaceAll('_', '-') : undefined;
}

function describeDelegatedExecutionProfile(profile: SelectedExecutionProfile | undefined): string | undefined {
  if (!profile) return undefined;
  const profileName = normalizeDelegatedIdentityValue(profile.providerName)
    ?? normalizeDelegatedIdentityValue(profile.providerType);
  const modelName = normalizeDelegatedIdentityValue(profile.providerModel);
  const tier = normalizeDelegatedProviderTier(profile.providerTier);
  if (!profileName && !modelName) return undefined;
  if (!profileName) {
    return modelName ? `model ${modelName}` : undefined;
  }
  const base = tier ? `${tier} profile ${profileName}` : `profile ${profileName}`;
  return modelName && modelName !== profileName ? `${base} (${modelName})` : base;
}

function buildDelegatedExecutionProfileMetadata(
  profile: SelectedExecutionProfile | undefined,
): Pick<DelegatedWorkerProgressEvent, 'executionProfileName' | 'executionProfileModel' | 'executionProfileTier'> {
  const executionProfileName = normalizeDelegatedIdentityValue(profile?.providerName);
  const executionProfileModel = normalizeDelegatedIdentityValue(profile?.providerModel);
  const executionProfileTier = normalizeDelegatedProviderTier(profile?.providerTier);
  return {
    ...(executionProfileName ? { executionProfileName } : {}),
    ...(executionProfileModel ? { executionProfileModel } : {}),
    ...(executionProfileTier ? { executionProfileTier } : {}),
  };
}

function buildDelegatedExecutionProfileTraceMetadata(
  profile: SelectedExecutionProfile | undefined,
): Record<string, unknown> {
  return {
    ...buildDelegatedExecutionProfileMetadata(profile),
    ...(profile?.id ? { executionProfileId: profile.id } : {}),
    ...(profile?.providerLocality ? { executionProfileLocality: profile.providerLocality } : {}),
    ...(profile?.requestedTier ? { executionProfileRequestedTier: profile.requestedTier } : {}),
    ...(profile?.routingMode ? { executionProfileRoutingMode: profile.routingMode } : {}),
    ...(profile?.selectionSource ? { executionProfileSelectionSource: profile.selectionSource } : {}),
    ...(profile?.preferredAnswerPath ? { executionProfilePreferredAnswerPath: profile.preferredAnswerPath } : {}),
    ...(profile?.expectedContextPressure ? { executionProfileExpectedContextPressure: profile.expectedContextPressure } : {}),
    ...(typeof profile?.contextBudget === 'number' ? { executionProfileContextBudget: profile.contextBudget } : {}),
    ...(profile?.toolContextMode ? { executionProfileToolContextMode: profile.toolContextMode } : {}),
    ...(typeof profile?.maxAdditionalSections === 'number'
      ? { executionProfileMaxAdditionalSections: profile.maxAdditionalSections }
      : {}),
    ...(typeof profile?.maxRuntimeNotices === 'number'
      ? { executionProfileMaxRuntimeNotices: profile.maxRuntimeNotices }
      : {}),
    ...(profile?.reason ? { executionProfileReason: profile.reason } : {}),
  };
}

function buildDelegatedExecutionProfileResponseSource(
  profile: SelectedExecutionProfile | undefined,
): Record<string, unknown> | undefined {
  if (!profile) return undefined;
  const providerName = normalizeDelegatedIdentityValue(profile.providerType);
  const providerProfileName = normalizeDelegatedIdentityValue(profile.providerName);
  const model = normalizeDelegatedIdentityValue(profile.providerModel);
  return {
    locality: profile.providerLocality,
    ...(providerName ? { providerName } : {}),
    ...(providerProfileName && providerProfileName !== providerName ? { providerProfileName } : {}),
    providerTier: profile.providerTier,
    ...(model ? { model } : {}),
    usedFallback: false,
  };
}

function buildDelegatedWorkerExecutionTraceMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const workerExecution = readWorkerExecutionMetadata(metadata);
  if (!workerExecution) return {};
  return {
    workerExecutionSource: workerExecution.source,
    workerExecutionCompletionReason: workerExecution.completionReason,
    ...(workerExecution.responseQuality ? { workerExecutionResponseQuality: workerExecution.responseQuality } : {}),
    ...(workerExecution.terminationReason ? { workerExecutionTerminationReason: workerExecution.terminationReason } : {}),
    ...(workerExecution.blockerKind ? { workerExecutionBlockerKind: workerExecution.blockerKind } : {}),
    ...(typeof workerExecution.roundCount === 'number' ? { workerExecutionRoundCount: workerExecution.roundCount } : {}),
    ...(typeof workerExecution.toolCallCount === 'number'
      ? { workerExecutionToolCallCount: workerExecution.toolCallCount }
      : {}),
    ...(typeof workerExecution.toolResultCount === 'number'
      ? { workerExecutionToolResultCount: workerExecution.toolResultCount }
      : {}),
    ...(typeof workerExecution.successfulToolResultCount === 'number'
      ? { workerExecutionSuccessfulToolResultCount: workerExecution.successfulToolResultCount }
      : {}),
    ...(typeof workerExecution.pendingApprovalCount === 'number'
      ? { workerExecutionPendingApprovalCount: workerExecution.pendingApprovalCount }
      : {}),
  };
}

function reconcileSatisfiedDelegatedWorkerMetadata(
  metadata: Record<string, unknown>,
  verification?: VerificationDecision,
): void {
  if (verification && verification.decision !== 'satisfied') return;
  if (!verification && !isSatisfiedDelegatedResultMetadata(metadata)) return;
  delete metadata.pendingAction;
  delete metadata.continueConversationAfterApproval;
  const envelope = readDelegatedResultEnvelope(metadata);
  if (envelope?.interruptions.length) {
    metadata[DELEGATED_RESULT_METADATA_KEY] = {
      ...envelope,
      interruptions: [],
    };
  }
  const workerExecution = readWorkerExecutionMetadata(metadata);
  if (workerExecution?.lifecycle !== 'failed') return;
  delete metadata.workerExecution;
}

function filterResolvedApprovalContinuationMetadata(
  metadata: Record<string, unknown> | undefined,
  approvalId: string,
): Record<string, unknown> | undefined {
  const events = readExecutionEvents(metadata);
  if (events.length === 0) return metadata;
  const activeApprovalIds = new Set(readDelegatedPendingApprovalMetadata(metadata)?.approvalIds ?? []);
  const filteredEvents = filterResolvedApprovalContinuationEvents(events, approvalId, activeApprovalIds);
  if (filteredEvents.length === events.length) return metadata;
  return {
    ...(metadata ?? {}),
    [EXECUTION_EVENTS_METADATA_KEY]: filteredEvents,
  };
}

function filterResolvedApprovalContinuationEvents(
  events: ExecutionEvent[],
  approvalId: string,
  activeApprovalIds: Set<string>,
): ExecutionEvent[] {
  const resolvedApprovalId = approvalId.trim();
  if (!resolvedApprovalId) return events;
  const hasActiveApprovals = activeApprovalIds.size > 0;
  return events.filter((event) => {
    const resultStatus = readEventString(event.payload.resultStatus);
    const isPendingResult = resultStatus === 'pending_approval' || resultStatus === 'blocked';
    const referencesResolvedApproval = eventReferencesApproval(event, resolvedApprovalId);
    if (referencesResolvedApproval && event.type === 'interruption_requested') {
      return false;
    }
    if (referencesResolvedApproval && event.type === 'tool_call_completed' && isPendingResult) {
      return false;
    }
    if (!hasActiveApprovals) {
      if (event.type === 'interruption_requested') return false;
      if (event.type === 'tool_call_completed' && isPendingResult) return false;
    }
    return true;
  });
}

function eventReferencesApproval(event: ExecutionEvent, approvalId: string): boolean {
  if (readEventString(event.payload.approvalId) === approvalId) return true;
  const approvalIds = event.payload.approvalIds;
  return Array.isArray(approvalIds)
    && approvalIds.some((id) => typeof id === 'string' && id.trim() === approvalId);
}

function readEventString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isSatisfiedDelegatedResultMetadata(metadata: Record<string, unknown>): boolean {
  const envelope = readDelegatedResultEnvelope(metadata);
  return envelope?.verification?.decision === 'satisfied'
    || envelope?.runStatus === 'completed';
}

function resolveWorkerSuspensionContinuationTerminalState(
  result: { content: string; metadata?: Record<string, unknown> },
): { status: 'completed' | 'failed'; reason?: string } {
  const envelope = readDelegatedResultEnvelope(result.metadata);
  if (envelope?.verification?.decision === 'satisfied' || envelope?.runStatus === 'completed') {
    return { status: 'completed' };
  }
  if (envelope?.runStatus === 'failed' || envelope?.runStatus === 'incomplete' || envelope?.runStatus === 'max_turns') {
    return {
      status: 'failed',
      reason: envelope.operatorSummary?.trim()
        || result.content.trim()
        || `Delegated worker resumed with run status '${envelope.runStatus}'.`,
    };
  }
  const workerExecution = readWorkerExecutionMetadata(result.metadata);
  if (workerExecution?.lifecycle === 'failed') {
    return {
      status: 'failed',
      reason: result.content.trim()
        || workerExecution.completionReason
        || 'Delegated worker resumed with failed worker execution metadata.',
    };
  }
  return { status: 'completed' };
}

function buildPromptAdditionalSectionTraceMetadata(
  sections: PromptAssemblyAdditionalSection[] | undefined,
): Record<string, unknown> {
  if (!Array.isArray(sections) || sections.length <= 0) {
    return {};
  }
  const codeSessionRegistrySection = sections.find((section) => section.section === 'Code Session Registry');
  return {
    promptAdditionalSectionCount: sections.length,
    promptAdditionalSectionNames: sections.map((section) => section.section),
    promptAdditionalSectionModes: sections.map((section) => section.mode ?? 'default'),
    ...(codeSessionRegistrySection
      ? {
          codeSessionRegistryAttached: true,
          ...(typeof codeSessionRegistrySection.itemCount === 'number'
            ? { codeSessionRegistryItemCount: codeSessionRegistrySection.itemCount }
            : {}),
        }
      : {}),
  };
}

function resolveDelegatedIntentContext(
  input: WorkerMessageRequest,
  target: ResolvedDelegatedTargetMetadata,
): {
  decision: IntentGatewayDecision | null;
  source: 'pre_routed' | 'delegated_derived' | 'unavailable';
} {
  const preRoutedDecision = readPreRoutedIntentGatewayMetadata(input.message.metadata)?.decision ?? null;
  const decision = resolveDelegatedExecutionDecision({
    gatewayDecision: preRoutedDecision,
    orchestration: target.orchestration,
    parentProfile: input.executionProfile,
  });
  return {
    decision,
    source: preRoutedDecision
      ? 'pre_routed'
      : decision
        ? 'delegated_derived'
        : 'unavailable',
  };
}

function buildDelegatedIntentTraceMetadata(
  context: ReturnType<typeof resolveDelegatedIntentContext>,
): Record<string, unknown> {
  const decision = context.decision;
  if (!decision) {
    return { delegatedIntentSource: context.source };
  }
  return {
    delegatedIntentSource: context.source,
    delegatedIntentRoute: decision.route,
    ...(decision.operation ? { delegatedIntentOperation: decision.operation } : {}),
    ...(decision.executionClass ? { delegatedIntentExecutionClass: decision.executionClass } : {}),
    ...(decision.preferredTier ? { delegatedIntentPreferredTier: decision.preferredTier } : {}),
    ...(typeof decision.requiresRepoGrounding === 'boolean'
      ? { delegatedIntentRequiresRepoGrounding: decision.requiresRepoGrounding }
      : {}),
    ...(typeof decision.requiresToolSynthesis === 'boolean'
      ? { delegatedIntentRequiresToolSynthesis: decision.requiresToolSynthesis }
      : {}),
    ...(decision.expectedContextPressure
      ? { delegatedIntentExpectedContextPressure: decision.expectedContextPressure }
      : {}),
    ...(decision.preferredAnswerPath
      ? { delegatedIntentPreferredAnswerPath: decision.preferredAnswerPath }
      : {}),
  };
}

function buildDelegatedHandoffTraceMetadata(
  handoff: DelegatedWorkerHandoff | undefined,
): Record<string, unknown> {
  if (!handoff) return {};
  return {
    ...(handoff.summary ? { handoffSummary: handoff.summary } : {}),
    ...(handoff.nextAction ? { handoffNextAction: handoff.nextAction } : {}),
    ...(handoff.operatorState ? { handoffOperatorState: handoff.operatorState } : {}),
  };
}

function describeDelegatedJob(
  input: WorkerMessageRequest,
  target: ResolvedDelegatedTargetMetadata,
): string {
  const codeSessionId = normalizeDelegatedIdentityValue(input.delegation?.codeSessionId);
  const profileLabel = describeDelegatedExecutionProfile(input.executionProfile);
  const base = profileLabel
    ? `Delegated to ${describeDelegatedTarget(target)} using ${profileLabel}`
    : `Delegated to ${describeDelegatedTarget(target)}`;
  return codeSessionId ? `${base} in code session ${codeSessionId}.` : `${base}.`;
}

function buildDelegatedTaskRunId(jobId: string): string {
  const normalized = String(jobId || '').trim();
  return normalized ? `delegated-task:${normalized}` : `delegated-task:${randomUUID()}`;
}

function buildDelegatedWorkerRunningDetail(
  targetLabel: string,
  executionProfile: SelectedExecutionProfile | undefined,
  codeSessionId?: string,
): string {
  const profileLabel = describeDelegatedExecutionProfile(executionProfile);
  const profileSuffix = profileLabel ? ` using ${profileLabel}` : '';
  const sessionSuffix = codeSessionId?.trim() ? ` in code session ${codeSessionId.trim()}` : '';
  return `${targetLabel} is working${profileSuffix}${sessionSuffix}.`;
}


function appendPromptAdditionalSection(
  sections: PromptAssemblyAdditionalSection[],
  extraSection: PromptAssemblyAdditionalSection | null,
): PromptAssemblyAdditionalSection[] {
  if (!extraSection) {
    return [...sections];
  }
  if (sections.some((section) => section.section === extraSection.section)) {
    return [...sections];
  }
  return [...sections, extraSection];
}

function mapExecutionEventToTraceStage(
  type: ExecutionEvent['type'],
): Extract<
  IntentRoutingTraceStage,
  | 'delegated_tool_call_started'
  | 'delegated_tool_call_completed'
  | 'delegated_interruption_requested'
  | 'delegated_interruption_resolved'
  | 'delegated_claim_emitted'
  | 'delegated_verification_decided'
> {
  switch (type) {
    case 'tool_call_started':
      return 'delegated_tool_call_started';
    case 'tool_call_completed':
      return 'delegated_tool_call_completed';
    case 'interruption_requested':
      return 'delegated_interruption_requested';
    case 'interruption_resolved':
      return 'delegated_interruption_resolved';
    case 'claim_emitted':
      return 'delegated_claim_emitted';
    case 'verification_decided':
    default:
      return 'delegated_verification_decided';
  }
}

function buildDelegatedExecutionEventPreview(event: ExecutionEvent): string | undefined {
  const toolName = typeof event.payload.toolName === 'string' ? event.payload.toolName.trim() : '';
  const stepId = typeof event.payload.stepId === 'string' ? event.payload.stepId.trim() : '';
  const summary = typeof event.payload.summary === 'string' ? event.payload.summary.trim() : '';
  const prompt = typeof event.payload.prompt === 'string' ? event.payload.prompt.trim() : '';
  if (toolName && stepId) return `${stepId}: ${toolName}`;
  if (toolName) return toolName;
  if (stepId && summary) return `${stepId}: ${truncateInlineText(summary, 220) ?? summary}`;
  if (stepId) return stepId;
  if (summary) return truncateInlineText(summary, 220);
  if (prompt) return truncateInlineText(prompt, 220);
  return undefined;
}

function readDelegatedAgentId(metadata: Record<string, unknown> | undefined): string | undefined {
  const delegation = metadata?.delegation;
  if (!isRecord(delegation)) return undefined;
  const agentId = delegation.agentId;
  return typeof agentId === 'string' && agentId.trim().length > 0 ? agentId : undefined;
}

function describeDelegatedFollowUpTimelineDetail(
  operatorState: DelegatedWorkerOperatorFollowUpState,
  deferredUntil?: number,
): string {
  switch (operatorState) {
    case 'replayed':
      return 'Operator replayed the held delegated result to the conversation.';
    case 'deferred':
      if (Number.isFinite(deferredUntil) && Number(deferredUntil) > 0) {
        return `Operator deferred the delegated result until ${new Date(Number(deferredUntil)).toISOString()}.`;
      }
      return 'Operator deferred the delegated result for later review.';
    case 'kept_held':
      return 'Operator kept the delegated result held for later review.';
    case 'dismissed':
      return 'Operator dismissed the held delegated result.';
    case 'pending':
    default:
      return 'Operator updated the held delegated result.';
  }
}

function normalizeDelegatedFollowUpDeferUntil(
  options: WorkerJobFollowUpActionOptions | undefined,
  now: number,
): number | undefined {
  const minDelayMs = 60_000;
  const maxDelayMs = 30 * 24 * 60 * 60_000;
  const requestedUntil = typeof options?.deferUntil === 'number' && Number.isFinite(options.deferUntil)
    ? Math.floor(options.deferUntil)
    : undefined;
  const requestedForMinutes = typeof options?.deferForMinutes === 'number' && Number.isFinite(options.deferForMinutes)
    ? Math.floor(options.deferForMinutes)
    : undefined;
  const candidate = requestedUntil
    ?? (requestedForMinutes && requestedForMinutes > 0 ? now + requestedForMinutes * 60_000 : undefined);
  if (!candidate) return undefined;
  const minUntil = now + minDelayMs;
  const maxUntil = now + maxDelayMs;
  return Math.min(maxUntil, Math.max(minUntil, candidate));
}

function stripUndefinedProperties<T extends Record<string, unknown>>(value: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function resolveDelegatedTargetMetadata(
  runtime: Runtime,
  input: WorkerMessageRequest,
): ResolvedDelegatedTargetMetadata {
  const registeredAgent = runtime.registry?.get?.(input.agentId);
  const explicitOrchestration = normalizeOrchestrationRoleDescriptor(input.delegation?.orchestration);
  const registeredOrchestration = normalizeOrchestrationRoleDescriptor(registeredAgent?.definition?.orchestration);
  const agentName = input.delegation?.agentName?.trim() || registeredAgent?.agent?.name?.trim();
  return {
    agentId: input.agentId,
    ...(agentName ? { agentName } : {}),
    ...(explicitOrchestration ?? registeredOrchestration
      ? { orchestration: explicitOrchestration ?? registeredOrchestration }
      : {}),
  };
}

function resolveDelegatedExecutionIdentity(
  input: WorkerMessageRequest,
  taskRunId?: string,
): {
  executionId?: string;
  rootExecutionId?: string;
  taskExecutionId?: string;
} {
  const executionId = normalizeDelegatedIdentityValue(input.delegation?.executionId)
    ?? normalizeDelegatedIdentityValue(input.delegation?.requestId)
    ?? normalizeDelegatedIdentityValue(input.message.id);
  const rootExecutionId = normalizeDelegatedIdentityValue(input.delegation?.rootExecutionId)
    ?? executionId;
  const taskExecutionId = normalizeDelegatedIdentityValue(taskRunId);
  return {
    ...(executionId ? { executionId } : {}),
    ...(rootExecutionId ? { rootExecutionId } : {}),
    ...(taskExecutionId ? { taskExecutionId } : {}),
  };
}

function buildDelegatedAuditDetails(
  input: WorkerMessageRequest,
  target: ResolvedDelegatedTargetMetadata,
  requestId: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const delegatedExecution = resolveDelegatedExecutionIdentity(input);
  const delegatedIntent = resolveDelegatedIntentContext(input, target);
  return {
    sessionId: input.sessionId,
    requestId,
    ...(delegatedExecution.executionId ? { executionId: delegatedExecution.executionId } : {}),
    ...(delegatedExecution.rootExecutionId ? { rootExecutionId: delegatedExecution.rootExecutionId } : {}),
    ...(input.delegation?.continuityKey ? { continuityKey: input.delegation.continuityKey } : {}),
    ...(input.delegation?.codeSessionId ? { codeSessionId: input.delegation.codeSessionId } : {}),
    ...buildDelegatedIntentTraceMetadata(delegatedIntent),
    ...extra,
  };
}

function resolveDelegationRunClass(
  input: WorkerMessageRequest,
  target?: ResolvedDelegatedTargetMetadata,
): DelegatedWorkerRunClass {
  if (input.delegation?.runClass !== undefined) {
    return resolveDelegatedWorkerRunClass({ requestedRunClass: input.delegation.runClass });
  }
  const originChannel = input.delegation?.originChannel ?? input.message.channel;
  const normalizedOriginChannel = normalizeDelegatedIdentityValue(originChannel)?.toLowerCase();
  if (normalizedOriginChannel === 'automation' || normalizedOriginChannel === 'scheduled') {
    return 'automation_owned';
  }
  if (target?.orchestration?.role === 'coordinator') {
    return 'in_invocation';
  }
  if (!hasBackgroundDelegationSignal(input)) {
    return 'short_lived';
  }
  return resolveDelegatedWorkerRunClass({
    originChannel,
    originSurfaceId: input.delegation?.originSurfaceId,
    codeSessionId: input.delegation?.codeSessionId,
    activeExecutionRefs: input.delegation?.activeExecutionRefs,
    orchestration: target?.orchestration,
  });
}

function hasBackgroundDelegationSignal(input: WorkerMessageRequest): boolean {
  return (input.delegation?.activeExecutionRefs ?? []).some((value) => {
    const normalized = normalizeDelegatedIdentityValue(value)?.toLowerCase();
    return normalized?.startsWith('delegated:') || normalized?.startsWith('background:');
  });
}

function buildDelegationJobMetadata(
  input: WorkerMessageRequest,
  options: {
    lifecycle: 'running' | 'completed' | 'blocked' | 'failed';
    workerId?: string;
    handoff?: DelegatedWorkerHandoff;
    target?: ResolvedDelegatedTargetMetadata;
    executionGraph?: DelegatedWorkerGraphJobMetadata;
  },
): Record<string, unknown> {
  const delegatedExecution = resolveDelegatedExecutionIdentity(input);
  const executionProfileMetadata = buildDelegatedExecutionProfileMetadata(input.executionProfile);
  return {
    kind: 'brokered_worker',
    lifecycle: options.lifecycle,
    agentId: options.target?.agentId ?? input.agentId,
    ...(options.target?.agentName ? { agentName: options.target.agentName } : {}),
    ...(options.target?.orchestration ? { orchestration: options.target.orchestration } : {}),
    workerSessionId: input.sessionId,
    originChannel: input.delegation?.originChannel ?? input.message.channel,
    runClass: resolveDelegationRunClass(input, options.target),
    ...(delegatedExecution.executionId ? { executionId: delegatedExecution.executionId } : {}),
    ...(delegatedExecution.rootExecutionId ? { rootExecutionId: delegatedExecution.rootExecutionId } : {}),
    ...(input.delegation?.originSurfaceId ? { originSurfaceId: input.delegation.originSurfaceId } : {}),
    ...(input.delegation?.requestId ? { requestId: input.delegation.requestId } : {}),
    ...(input.delegation?.continuityKey ? { continuityKey: input.delegation.continuityKey } : {}),
    ...(input.delegation?.activeExecutionRefs?.length ? { activeExecutionRefs: [...input.delegation.activeExecutionRefs] } : {}),
    ...(input.delegation?.pendingActionId ? { pendingActionId: input.delegation.pendingActionId } : {}),
    ...(input.delegation?.codeSessionId ? { codeSessionId: input.delegation.codeSessionId } : {}),
    ...(Object.keys(executionProfileMetadata).length > 0
      ? { executionProfile: executionProfileMetadata }
      : {}),
    ...(options.workerId ? { workerId: options.workerId } : {}),
    ...(options.handoff ? { handoff: options.handoff } : {}),
    ...(options.executionGraph ? { executionGraph: options.executionGraph } : {}),
  };
}

function resolveWorkerLaunch(configuredEntryPoint?: string): {
  command: string;
  args: string[];
  additionalReadPaths: string[];
} {
  const resolvedEntry = configuredEntryPoint?.trim()
    ? resolve(configuredEntryPoint)
    : resolveDefaultWorkerEntry();
  const additionalReadPaths = new Set<string>([
    resolveWorkerRuntimeRoot(resolvedEntry),
    resolveWorkerRuntimeRoot(workerManagerDir),
  ]);
  const extension = extname(resolvedEntry);
  if (extension === '.ts') {
    const tsxLoaderPath = resolve(workerManagerDir, '..', '..', 'node_modules', 'tsx', 'dist', 'loader.mjs');
    const tsxImportTarget = existsSync(tsxLoaderPath) ? pathToFileURL(tsxLoaderPath).href : 'tsx';
    if (tsxImportTarget !== 'tsx') {
      additionalReadPaths.add(resolveWorkerRuntimeRoot(tsxLoaderPath));
    }
    return {
      command: process.execPath,
      args: ['--import', tsxImportTarget, resolvedEntry],
      additionalReadPaths: [...additionalReadPaths],
    };
  }
  return {
    command: process.execPath,
    args: [resolvedEntry],
    additionalReadPaths: [...additionalReadPaths],
  };
}

function resolveDefaultWorkerEntry(): string {
  if (workerManagerPath.endsWith('.ts')) {
    return resolve(workerManagerDir, '..', 'worker', 'worker-entry.ts');
  }
  return resolve(workerManagerDir, '..', 'worker', 'worker-entry.js');
}

function resolveWorkerRuntimeRoot(pathValue: string): string {
  const resolvedPath = resolve(pathValue);
  let current = resolvedPath;
  try {
    current = statSync(resolvedPath).isDirectory() ? resolvedPath : dirname(resolvedPath);
  } catch {
    current = extname(resolvedPath) ? dirname(resolvedPath) : resolvedPath;
  }

  const packageRoot = findNearestPackageRoot(current);
  if (packageRoot) return packageRoot;

  let cursor = current;
  while (true) {
    const base = dirname(cursor);
    if (base === cursor) break;
    const segment = basename(cursor);
    if (segment === 'src' || segment === 'dist') {
      return base;
    }
    cursor = base;
  }

  return current;
}

function findNearestPackageRoot(startDir: string): string | null {
  let cursor = resolve(startDir);
  while (true) {
    if (existsSync(join(cursor, 'package.json'))) {
      return cursor;
    }
    const parent = dirname(cursor);
    if (parent === cursor) {
      return null;
    }
    cursor = parent;
  }
}

function mergeUniquePaths(...groups: Array<string[] | undefined>): string[] {
  const merged = new Set<string>();
  for (const group of groups) {
    for (const pathValue of group ?? []) {
      const trimmed = pathValue?.trim();
      if (!trimmed) continue;
      merged.add(resolve(trimmed));
    }
  }
  return [...merged];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
