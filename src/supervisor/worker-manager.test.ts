import { EventEmitter } from 'node:events';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PassThrough } from 'node:stream';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DEFAULT_CONFIG, type GuardianAgentConfig } from '../config/types.js';
import {
  buildDelegatedExecutionMetadata,
  buildDelegatedSyntheticEnvelope,
  readDelegatedResultEnvelope,
} from '../runtime/execution/metadata.js';
import {
  buildFileReadSetArtifact,
  buildSearchResultSetArtifact,
} from '../runtime/execution-graph/graph-artifacts.js';
import { ExecutionGraphStore } from '../runtime/execution-graph/graph-store.js';
import {
  buildStepReceipts,
  computeWorkerRunStatus,
  findAnswerStepId,
  matchPlannedStepForTool,
} from '../runtime/execution/task-plan.js';
import type { DelegatedResultEnvelope } from '../runtime/execution/types.js';
import { buildDelegatedTaskContract } from '../runtime/execution/verifier.js';
import { APPROVAL_OUTCOME_CONTINUATION_METADATA_KEY } from '../runtime/approval-continuations.js';
import { requestNeedsExactFileReferences } from '../runtime/intent/request-patterns.js';
import { attachPreRoutedIntentGatewayMetadata, readPreRoutedIntentGatewayMetadata, type IntentGatewayDecision } from '../runtime/intent-gateway.js';
import { PendingActionStore, type PendingActionRecord } from '../runtime/pending-actions.js';
import {
  attachWorkerSuspensionMetadata,
  WORKER_SUSPENSION_SCHEMA_VERSION,
} from '../runtime/worker-suspension.js';

const workerNotifications: Array<{ method: string; params: Record<string, unknown> }> = [];
let workerMessageHandler:
  | ((params: Record<string, unknown>) => Promise<{ content: string; metadata?: Record<string, unknown> }> | { content: string; metadata?: Record<string, unknown> })
  | undefined;

function createAutomationFixtureWorkspace(): string {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'ga-worker-automation-'));
  writeFileSync(join(workspaceRoot, 'companies.csv'), 'Company Name\nAcme SaaS\n');
  return workspaceRoot;
}

function createMemoryPendingActionStore(now: () => number = () => 1): PendingActionStore {
  return new PendingActionStore({
    enabled: false,
    sqlitePath: ':memory:',
    now,
  });
}

function approvalPendingActionMetadata(
  approvals: Array<{ id: string; toolName: string; argsPreview?: string }>,
): Record<string, unknown> {
  return {
    pendingAction: {
      status: 'pending',
      blocker: {
        kind: 'approval',
        prompt: 'Waiting for approval.',
        approvalSummaries: approvals.map((approval) => ({
          argsPreview: '{}',
          ...approval,
        })),
      },
    },
  };
}

function automationAuthoringMetadata(
  metadata?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  return attachPreRoutedIntentGatewayMetadata(metadata, {
    mode: 'primary',
    available: true,
    model: 'test-model',
    latencyMs: 1,
    decision: {
      route: 'automation_authoring',
      confidence: 'high',
      operation: 'create',
      summary: 'Creates a Guardian automation.',
      turnRelation: 'new_request',
      resolution: 'ready',
      missingFields: [],
      entities: {},
    },
  });
}

function mixedAutomationAuthoringMetadata(
  metadata?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  return attachPreRoutedIntentGatewayMetadata(metadata, {
    mode: 'primary',
    available: true,
    model: 'test-model',
    latencyMs: 1,
    decision: {
      route: 'automation_authoring',
      confidence: 'high',
      operation: 'create',
      summary: 'Create an automation and coordinate repo, Second Brain, cloud, and security follow-up work.',
      turnRelation: 'new_request',
      resolution: 'ready',
      missingFields: [],
      executionClass: 'tool_orchestration',
      preferredTier: 'external',
      requiresRepoGrounding: true,
      requiresToolSynthesis: true,
      expectedContextPressure: 'high',
      preferredAnswerPath: 'tool_loop',
      simpleVsComplex: 'complex',
      plannedSteps: [
        {
          kind: 'write',
          summary: 'Create the automation definition.',
          expectedToolCategories: ['automation_save'],
          required: true,
        },
        {
          kind: 'search',
          summary: 'Search the repository for TODOs.',
          expectedToolCategories: ['fs_search'],
          required: true,
          dependsOn: ['step_1'],
        },
        {
          kind: 'write',
          summary: 'Create a Second Brain task for urgent evidence.',
          expectedToolCategories: ['second_brain_task_upsert'],
          required: true,
          dependsOn: ['step_2'],
        },
        {
          kind: 'tool_call',
          summary: 'Check WHM status for the social profile.',
          expectedToolCategories: ['whm_status'],
          required: true,
          dependsOn: ['step_3'],
        },
        {
          kind: 'tool_call',
          summary: 'Summarize Assistant Security findings.',
          expectedToolCategories: ['assistant_security_findings'],
          required: true,
          dependsOn: ['step_4'],
        },
      ],
      entities: {},
    },
  });
}

function repoGroundedCodingMetadata(
  metadata?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  return attachPreRoutedIntentGatewayMetadata(metadata, {
    mode: 'primary',
    available: true,
    model: 'test-model',
    latencyMs: 1,
    decision: {
      route: 'coding_task',
      confidence: 'high',
      operation: 'inspect',
      summary: 'Inspects the repository and reports grounded findings.',
      turnRelation: 'new_request',
      resolution: 'ready',
      missingFields: [],
      executionClass: 'repo_grounded',
      preferredTier: 'external',
      requiresRepoGrounding: true,
      requiresToolSynthesis: true,
      requireExactFileReferences: true,
      expectedContextPressure: 'medium',
      preferredAnswerPath: 'chat_synthesis',
      entities: {},
    },
  });
}

function filesystemSearchWriteMetadata(
  metadata?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  return attachPreRoutedIntentGatewayMetadata(metadata, {
    mode: 'primary',
    available: true,
    model: 'test-model',
    latencyMs: 1,
    decision: {
      route: 'filesystem_task',
      confidence: 'high',
      operation: 'run',
      summary: 'Search src/runtime for planned_steps. Write a short summary of what you find to tmp/manual-web/planned-steps-summary.txt.',
      turnRelation: 'new_request',
      resolution: 'ready',
      missingFields: [],
      executionClass: 'repo_grounded',
      preferredTier: 'external',
      requiresRepoGrounding: true,
      requiresToolSynthesis: true,
      requireExactFileReferences: false,
      expectedContextPressure: 'high',
      preferredAnswerPath: 'tool_loop',
      plannedSteps: [
        { kind: 'search', summary: 'Search src/runtime for planned_steps.', required: true },
        { kind: 'write', summary: 'Write a short summary of what you find to tmp/manual-web/planned-steps-summary.txt.', required: true },
      ],
      entities: {
        path: 'tmp/manual-web/planned-steps-summary.txt',
      },
    },
  });
}

function generalAssistantDirectMetadata(
  metadata?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  return attachPreRoutedIntentGatewayMetadata(metadata, {
    mode: 'primary',
    available: true,
    model: 'test-model',
    latencyMs: 1,
    decision: {
      route: 'general_assistant',
      confidence: 'high',
      operation: 'read',
      summary: 'User asks for a concise project summary.',
      turnRelation: 'new_request',
      resolution: 'ready',
      missingFields: [],
      executionClass: 'direct_assistant',
      preferredTier: 'local',
      requiresRepoGrounding: false,
      requiresToolSynthesis: false,
      requireExactFileReferences: false,
      expectedContextPressure: 'low',
      preferredAnswerPath: 'direct',
      entities: {},
    },
  });
}

function securityReviewMetadata(
  metadata?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  return attachPreRoutedIntentGatewayMetadata(metadata, {
    mode: 'primary',
    available: true,
    model: 'test-model',
    latencyMs: 1,
    decision: {
      route: 'security_task',
      confidence: 'high',
      operation: 'inspect',
      summary: 'Reviews source files for security or control-flow risks.',
      turnRelation: 'new_request',
      resolution: 'ready',
      missingFields: [],
      executionClass: 'security_analysis',
      preferredTier: 'external',
      requiresRepoGrounding: true,
      requiresToolSynthesis: true,
      requireExactFileReferences: true,
      expectedContextPressure: 'high',
      preferredAnswerPath: 'chat_synthesis',
      entities: {},
    },
  });
}

function filesystemMutationMetadata(
  metadata?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  return attachPreRoutedIntentGatewayMetadata(metadata, {
    mode: 'primary',
    available: true,
    model: 'test-model',
    latencyMs: 1,
    decision: {
      route: 'filesystem_task',
      confidence: 'high',
      operation: 'save',
      summary: 'Writes the requested file in the active workspace.',
      turnRelation: 'new_request',
      resolution: 'ready',
      missingFields: [],
      executionClass: 'repo_grounded',
      preferredTier: 'external',
      requiresRepoGrounding: true,
      requiresToolSynthesis: true,
      requireExactFileReferences: false,
      expectedContextPressure: 'medium',
      preferredAnswerPath: 'tool_loop',
      entities: {},
    },
  });
}

function buildTestGatewayDecisionFromRequest(params: Record<string, unknown> | undefined) {
  const request = params?.message as { content?: string; metadata?: Record<string, unknown> } | undefined;
  const requestContent = typeof request?.content === 'string' ? request.content : '';
  const preRouted = readPreRoutedIntentGatewayMetadata(request?.metadata);
  if (preRouted?.decision) {
    const decision = preRouted.decision;
    return {
      ...decision,
      ...(typeof decision.requireExactFileReferences === 'boolean'
        ? {}
        : {
            requireExactFileReferences: (
              decision.requiresRepoGrounding === true
              || decision.executionClass === 'repo_grounded'
              || decision.executionClass === 'security_analysis'
            ) && requestNeedsExactFileReferences(requestContent),
          }),
    };
  }

  const repoGrounded = /\b(?:repo|repository|workspace|codebase|files?|functions?|paths?)\b/i.test(requestContent);
  if (repoGrounded) {
    return {
      route: 'coding_task',
      confidence: 'low',
      operation: 'inspect',
      summary: 'Recovered repo-grounded delegated test request.',
      turnRelation: 'new_request',
      resolution: 'ready',
      missingFields: [],
      executionClass: 'repo_grounded',
      preferredTier: 'external',
      requiresRepoGrounding: true,
      requiresToolSynthesis: true,
      requireExactFileReferences: requestNeedsExactFileReferences(requestContent),
      expectedContextPressure: 'medium',
      preferredAnswerPath: 'chat_synthesis',
      entities: {},
    } as const;
  }

  return {
    route: 'general_assistant',
    confidence: 'low',
    operation: 'inspect',
    summary: 'Recovered direct-answer delegated test request.',
    turnRelation: 'new_request',
    resolution: 'ready',
    missingFields: [],
    executionClass: 'direct_assistant',
    preferredTier: 'external',
    requiresRepoGrounding: false,
    requiresToolSynthesis: false,
    requireExactFileReferences: false,
    expectedContextPressure: 'low',
    preferredAnswerPath: 'direct',
    entities: {},
  } as const;
}

function extractTestFileReferences(content: string): string[] {
  const matches = new Set<string>();
  const pattern = /(?:^|[\s`'"])((?:[A-Za-z0-9_.-]+[\\/])+[A-Za-z0-9_.-]+\.(?:ts|tsx|js|jsx|mjs|cjs|json|md|rs|py|go|java|yml|yaml|txt|toml))/g;
  for (const match of content.matchAll(pattern)) {
    const ref = match[1]?.trim();
    if (ref) {
      matches.add(ref.replaceAll('\\', '/'));
    }
  }
  return [...matches];
}

function ensureDelegatedResultEnvelopeForTest(
  response: { content: string; metadata?: Record<string, unknown> },
  params: Record<string, unknown> | undefined,
): { content: string; metadata?: Record<string, unknown> } {
  const metadata = response.metadata ? { ...response.metadata } : undefined;
  if (metadata?.skipTestDelegatedEnvelope === true) {
    delete metadata.skipTestDelegatedEnvelope;
    return metadata ? { ...response, metadata } : response;
  }
  if (metadata?.delegatedResult) {
    return response;
  }

  const decision = buildTestGatewayDecisionFromRequest(params);
  const taskContract = buildDelegatedTaskContract(decision);
  const workerExecution = metadata?.workerExecution as Record<string, unknown> | undefined;
  const toolResultCount = typeof workerExecution?.toolResultCount === 'number'
    ? Math.max(0, Math.trunc(workerExecution.toolResultCount))
    : 0;
  const successfulToolResultCount = typeof workerExecution?.successfulToolResultCount === 'number'
    ? Math.max(0, Math.trunc(workerExecution.successfulToolResultCount))
    : 0;
  const fileRefs = extractTestFileReferences(response.content);
  const exactFileReadReceipts = taskContract.requireExactFileReferences
    && taskContract.plan.steps.some((step) => step.kind === 'read')
    && fileRefs.length > 0;
  const receipts = Array.from({ length: successfulToolResultCount }, (_, index) => ({
    receiptId: `test-receipt-${index + 1}`,
    sourceType: 'tool_call' as const,
    toolName: exactFileReadReceipts && index > 0 ? 'fs_read' : 'fs_search',
    status: 'succeeded' as const,
    refs: exactFileReadReceipts && index > 0
      ? [fileRefs[Math.min(index - 1, fileRefs.length - 1)]!]
      : [],
    summary: exactFileReadReceipts && index > 0
      ? `Read ${fileRefs[Math.min(index - 1, fileRefs.length - 1)]!}`
      : `Test receipt ${index + 1}`,
    startedAt: index + 1,
    endedAt: index + 1,
  }));
  if (
    toolResultCount > 0
    && successfulToolResultCount === 0
    && workerExecution?.lifecycle === 'failed'
  ) {
    receipts.push({
      receiptId: 'test-receipt-failed',
      sourceType: 'tool_call',
      toolName: 'tool_call',
      status: 'failed',
      refs: [],
      summary: 'Delegated tool execution failed.',
      startedAt: toolResultCount + 1,
      endedAt: toolResultCount + 1,
    });
  }
  const readReceiptIds = receipts
    .filter((receipt) => receipt.toolName === 'fs_read' && receipt.status === 'succeeded')
    .map((receipt) => receipt.receiptId);
  const claims = [
    ...fileRefs.map((ref, index) => ({
      claimId: `test-file-${index + 1}`,
      kind: 'file_reference' as const,
      subject: ref,
      value: ref,
      evidenceReceiptIds: readReceiptIds.length > 0
        ? [readReceiptIds[Math.min(index, readReceiptIds.length - 1)]!]
        : receipts.length > 0
          ? [receipts[Math.min(index, receipts.length - 1)]!.receiptId]
        : [],
      confidence: 0.8,
    })),
    ...(taskContract.kind === 'filesystem_mutation' && receipts.length > 0
      ? [{
          claimId: 'test-filesystem-mutation',
          kind: 'filesystem_mutation' as const,
          subject: 'filesystem',
          value: response.content.trim() || 'Filesystem mutation completed.',
          evidenceReceiptIds: [receipts[0]!.receiptId],
          confidence: 0.9,
        }]
      : []),
  ];
  const pendingAction = metadata?.pendingAction as {
    blocker?: {
      kind?: string;
      prompt?: string;
      approvalSummaries?: Array<{ id: string; toolName: string; argsPreview?: string }>;
    };
  } | undefined;
  const interruptions = pendingAction?.blocker?.kind
    ? [{
        interruptionId: `test-${pendingAction.blocker.kind}`,
        kind: pendingAction.blocker.kind === 'approval'
          || pendingAction.blocker.kind === 'clarification'
          || pendingAction.blocker.kind === 'workspace_switch'
          ? pendingAction.blocker.kind
          : 'policy_blocked',
        prompt: pendingAction.blocker.prompt ?? 'Delegated worker is waiting for operator input.',
        ...(pendingAction.blocker.kind === 'approval'
          ? {
              approvalSummaries: (pendingAction.blocker.approvalSummaries ?? []).map((summary) => ({
                ...summary,
              })),
            }
          : {}),
      }]
    : [];
  const events = interruptions.length > 0
    ? [{
        eventId: `${interruptions[0]!.interruptionId}:requested`,
        type: 'interruption_requested' as const,
        timestamp: 1,
        payload: {
          kind: interruptions[0]!.kind,
          prompt: interruptions[0]!.prompt,
        },
      }]
    : response.content.trim()
      ? [{
          eventId: 'test-claim',
          type: 'claim_emitted' as const,
          timestamp: 1,
          payload: {
            kind: 'answer',
            content: response.content.trim(),
          },
        }]
      : [];
  const receiptStepIds = new Map<string, string>();
  for (const receipt of receipts) {
    const matchedStepId = matchPlannedStepForTool({
      plannedTask: taskContract.plan,
      toolName: receipt.toolName ?? 'tool_call',
      args: { refs: receipt.refs },
    });
    if (matchedStepId) {
      receiptStepIds.set(receipt.receiptId, matchedStepId);
    }
  }
  const answerStepId = findAnswerStepId(taskContract.plan);
  const answerReceipt = response.content.trim() && interruptions.length === 0 && answerStepId
    ? {
        receiptId: 'test-answer-receipt',
        sourceType: 'model_answer' as const,
        status: 'succeeded' as const,
        refs: [] as string[],
        summary: response.content.trim(),
        startedAt: Math.max(1, receipts.length + 1),
        endedAt: Math.max(1, receipts.length + 1),
      }
    : null;
  if (answerReceipt && answerStepId) {
    receiptStepIds.set(answerReceipt.receiptId, answerStepId);
  }
  const evidenceReceipts = answerReceipt ? [...receipts, answerReceipt] : receipts;
  const stopReason = interruptions.length > 0 ? 'approval_required' : 'end_turn';
  const stepReceipts = buildStepReceipts({
    plannedTask: taskContract.plan,
    evidenceReceipts,
    toolReceiptStepIds: receiptStepIds,
    ...(answerReceipt ? { finalAnswerReceiptId: answerReceipt.receiptId } : {}),
    interruptions,
  });
  const runStatus = computeWorkerRunStatus(
    taskContract.plan,
    stepReceipts,
    interruptions,
    stopReason,
  );

  return {
    ...response,
    metadata: {
      ...(metadata ?? {}),
      ...buildDelegatedExecutionMetadata({
        taskContract,
        runStatus,
        stopReason,
        stepReceipts,
        ...(response.content.trim() && interruptions.length === 0 && runStatus === 'completed'
          ? { finalUserAnswer: response.content.trim() }
          : {}),
        operatorSummary: response.content.trim() || 'Delegated worker completed.',
        claims,
        evidenceReceipts,
        interruptions,
        artifacts: [],
        events,
      }),
    },
  };
}

function createExecutionProfileTestConfig(): GuardianAgentConfig {
  const config = structuredClone(DEFAULT_CONFIG) as GuardianAgentConfig;
  config.llm['ollama-cloud-coding'] = {
    provider: 'ollama_cloud',
    model: 'qwen3-coder-next',
    credentialRef: 'llm.ollama_cloud.coding',
  };
  config.llm['openai-frontier'] = {
    provider: 'openai',
    model: 'gpt-5.4',
    apiKey: 'test-key',
  };
  config.assistant.tools.preferredProviders = {
    local: 'ollama',
    managedCloud: 'ollama-cloud-coding',
    frontier: 'openai-frontier',
  };
  config.assistant.tools.modelSelection = {
    ...(config.assistant.tools.modelSelection ?? {}),
    autoPolicy: 'balanced',
    preferManagedCloudForLowPressureExternal: true,
    preferFrontierForRepoGrounded: true,
    preferFrontierForSecurity: true,
    managedCloudRouting: {
      enabled: true,
      roleBindings: {
        coding: 'ollama-cloud-coding',
      },
    },
  };
  return config;
}

class FakeWorkerChild extends EventEmitter {
  stdin = new PassThrough();
  stdout = new PassThrough();
  stderr = new PassThrough();

  constructor() {
    super();
    this.stdin.setEncoding('utf8');
    this.stdout.setEncoding('utf8');
    this.stderr.setEncoding('utf8');

    let buffer = '';
    this.stdin.on('data', (chunk: string | Buffer) => {
      buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      while (buffer.includes('\n')) {
        const newlineIndex = buffer.indexOf('\n');
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (!line) continue;
        const message = JSON.parse(line) as { method?: string; params?: Record<string, unknown> };
        if (!message.method) continue;
        workerNotifications.push({ method: message.method, params: message.params ?? {} });
        if (message.method === 'worker.initialize') {
          this.stdout.write(`${JSON.stringify({
            jsonrpc: '2.0',
            method: 'worker.ready',
            params: { agentId: String(message.params?.agentId ?? 'unknown') },
          })}\n`);
        }
        if (message.method === 'message.handle') {
          Promise.resolve(workerMessageHandler?.(message.params ?? {}) ?? { content: 'ok' })
            .then((response) => {
              const normalizedResponse = ensureDelegatedResultEnvelopeForTest(
                response,
                message.params ?? {},
              );
              this.stdout.write(`${JSON.stringify({
                jsonrpc: '2.0',
                method: 'message.response',
                params: normalizedResponse,
              })}\n`);
            });
        }
      }
    });
  }

  kill(): boolean {
    this.emit('exit', 0, null);
    return true;
  }
}

vi.mock('../sandbox/index.js', () => ({
  sandboxedSpawn: vi.fn(async () => new FakeWorkerChild()),
  detectSandboxHealth: vi.fn(async () => ({ availability: 'degraded' })),
  DEFAULT_SANDBOX_CONFIG: {
    resourceLimits: {
      maxMemoryMb: 2048,
      maxCpuSeconds: 0,
    },
  },
}));

describe('WorkerManager', () => {
  beforeEach(() => {
    workerNotifications.length = 0;
    workerMessageHandler = undefined;
    vi.clearAllMocks();
  });

  it('refreshes the capability token when reusing a live worker', async () => {
    const { WorkerManager } = await import('./worker-manager.js');
    const sandbox = await import('../sandbox/index.js');

    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        auditLog: { record: vi.fn() },
        registry: {
          get: (agentId: string) => agentId === 'local'
            ? {
                agent: { name: 'Local Agent' },
                definition: {
                  orchestration: {
                    role: 'coordinator',
                    label: 'Primary Coordinator',
                  },
                },
              }
            : undefined,
        },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
    );

    const baseRequest = {
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm1',
        userId: 'tester',
        channel: 'web',
        content: 'hello',
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      toolContext: '',
      runtimeNotices: [],
    };

    await manager.handleMessage(baseRequest);
    const firstSpawnArgs = vi.mocked(sandbox.sandboxedSpawn).mock.calls[0]?.[1] ?? [];
    const firstSpawnSandboxConfig = vi.mocked(sandbox.sandboxedSpawn).mock.calls[0]?.[2];
    expect(firstSpawnArgs[0]).toBe('--import');
    expect(String(firstSpawnArgs[1])).toMatch(/^file:\/\//);
    expect(String(firstSpawnArgs[1]).replaceAll('\\', '/')).toContain('node_modules/tsx/dist/loader.mjs');
    expect(firstSpawnSandboxConfig?.resourceLimits?.maxMemoryMb).toBe(0);
    const normalizedReadPaths = (firstSpawnSandboxConfig?.additionalReadPaths ?? [])
      .map((value) => String(value).replaceAll('\\', '/'));
    const expectedRepoRoot = resolve(process.cwd()).replaceAll('\\', '/');
    expect(
      normalizedReadPaths,
    ).toContain(expectedRepoRoot);
    workerNotifications.length = 0;

    await manager.handleMessage({
      ...baseRequest,
      message: {
        ...baseRequest.message,
        id: 'm2',
        content: 'second message',
      },
    });

    expect(workerNotifications.map((entry) => entry.method)).toEqual([
      'capability.refreshed',
      'message.handle',
    ]);
    expect(typeof workerNotifications[0]?.params.capabilityToken).toBe('string');

    manager.shutdown();
  });

  it('cancels an in-flight brokered worker dispatch when the message aborts', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    let releaseHandlerStart: (() => void) | undefined;
    const handlerStarted = new Promise<void>((resolve) => {
      releaseHandlerStart = resolve;
    });
    let workerReceivedAbortSignal = false;
    workerMessageHandler = (params) => {
      const message = params.message as Record<string, unknown> | undefined;
      workerReceivedAbortSignal = Boolean(message?.abortSignal);
      releaseHandlerStart?.();
      return new Promise<{ content: string }>(() => undefined);
    };

    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        auditLog: { record: vi.fn() },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
    );

    const controller = new AbortController();
    const dispatch = manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-abort',
        userId: 'tester',
        channel: 'web',
        content: 'slow delegated task',
        abortSignal: controller.signal,
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      additionalSections: [],
      toolContext: '',
      runtimeNotices: [],
    });

    await handlerStarted;
    controller.abort(new Error('budget elapsed'));

    await expect(dispatch).rejects.toThrow('Worker message dispatch canceled: budget elapsed');
    expect(workerReceivedAbortSignal).toBe(false);
    expect(workerNotifications.map((entry) => entry.method)).toContain('worker.shutdown');

    manager.shutdown();
  });

  it('does not use graph-controlled mutation for general assistant read/write plans', async () => {
    const { shouldUseGraphControlledExecution } = await import('../runtime/execution-graph/graph-controller.js');
    const decision = {
      route: 'general_assistant',
      confidence: 'high',
      operation: 'inspect',
      summary: 'Find existing automations and routines, then suggest one useful automation.',
      turnRelation: 'new_request',
      resolution: 'ready',
      missingFields: [],
      executionClass: 'tool_orchestration',
      preferredTier: 'external',
      requiresRepoGrounding: false,
      requiresToolSynthesis: true,
      expectedContextPressure: 'medium',
      preferredAnswerPath: 'tool_loop',
      simpleVsComplex: 'complex',
      entities: {},
      plannedSteps: [
        {
          kind: 'search',
          summary: 'Find existing automations and routines related to approval, routing, or code review.',
          expectedToolCategories: ['automation_read', 'second_brain_routine_read'],
          required: true,
        },
        {
          kind: 'write',
          summary: 'Suggest one useful automation without creating it.',
          expectedToolCategories: ['answer'],
          required: true,
          dependsOn: ['step_1'],
        },
      ],
    } as const;

    expect(shouldUseGraphControlledExecution({
      taskContract: buildDelegatedTaskContract(decision),
      decision,
      executionProfile: {
        id: 'managed-cloud',
        providerName: 'openrouter-tools',
        providerType: 'openrouter',
        providerModel: 'moonshotai/kimi-k2.6',
        providerLocality: 'external',
        providerTier: 'managed_cloud',
        requestedTier: 'external',
        preferredAnswerPath: 'tool_loop',
        expectedContextPressure: 'medium',
        contextBudget: 32_000,
        toolContextMode: 'tight',
        maxAdditionalSections: 1,
        maxRuntimeNotices: 2,
        reason: 'test profile',
      },
    })).toBe(false);
  });

  it('does not use graph-controlled mutation for low-confidence filesystem plans without a structured write target', async () => {
    const { shouldUseGraphControlledExecution } = await import('../runtime/execution-graph/graph-controller.js');
    const decision = {
      route: 'filesystem_task',
      confidence: 'low',
      operation: 'update',
      summary: 'Search web and compare findings to the repo approach.',
      turnRelation: 'new_request',
      resolution: 'ready',
      missingFields: [],
      executionClass: 'tool_orchestration',
      preferredTier: 'external',
      requiresRepoGrounding: true,
      requiresToolSynthesis: true,
      expectedContextPressure: 'medium',
      preferredAnswerPath: 'tool_loop',
      simpleVsComplex: 'complex',
      provenance: {
        route: 'repair.structured',
        operation: 'repair.structured',
      },
      entities: {},
      plannedSteps: [
        {
          kind: 'search',
          summary: 'Search web for approval workflow best practices.',
          expectedToolCategories: ['web_search'],
          required: true,
        },
        {
          kind: 'write',
          summary: 'Compare findings to the repo approach.',
          expectedToolCategories: ['write'],
          required: true,
          dependsOn: ['step_1'],
        },
      ],
    } as const;

    expect(shouldUseGraphControlledExecution({
      taskContract: buildDelegatedTaskContract(decision),
      decision,
      executionProfile: {
        id: 'managed-cloud',
        providerName: 'openrouter-tools',
        providerType: 'openrouter',
        providerModel: 'moonshotai/kimi-k2.6',
        providerLocality: 'external',
        providerTier: 'managed_cloud',
        requestedTier: 'external',
        preferredAnswerPath: 'tool_loop',
        expectedContextPressure: 'medium',
        contextBudget: 32_000,
        toolContextMode: 'tight',
        maxAdditionalSections: 1,
        maxRuntimeNotices: 2,
        reason: 'test profile',
      },
    })).toBe(false);
  });

  it('synthesizes answer-only delegated insufficiency on the same profile after evidence is gathered', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    const decision = {
      route: 'automation_control',
      confidence: 'high',
      operation: 'read',
      summary: 'Find existing automations and routines related to approval, routing, or code review, then suggest one useful automation.',
      turnRelation: 'new_request',
      resolution: 'ready',
      missingFields: [],
      executionClass: 'tool_orchestration',
      preferredTier: 'external',
      requiresRepoGrounding: false,
      requiresToolSynthesis: true,
      expectedContextPressure: 'medium',
      preferredAnswerPath: 'tool_loop',
      simpleVsComplex: 'complex',
      entities: {},
      plannedSteps: [
        {
          kind: 'read',
          summary: 'Find existing automations and routines related to approval, routing, or code review.',
          expectedToolCategories: ['automation_list'],
          required: true,
        },
        {
          kind: 'answer',
          summary: 'Suggest one useful automation without creating it.',
          expectedToolCategories: ['answer'],
          required: true,
          dependsOn: ['step_1'],
        },
      ],
    } as const;
    const taskContract = buildDelegatedTaskContract(decision);
    const automationEvidence = {
      receiptId: 'automation-list-1',
      sourceType: 'tool_call' as const,
      toolName: 'automation_list',
      status: 'succeeded' as const,
      refs: ['automation:approval-review', 'automation:routing-watch'],
      summary: 'Found approval-review and routing-watch automations; no code-review automation exists yet.',
      startedAt: 1,
      endedAt: 2,
    };
    const toolReceiptStepIds = new Map([[automationEvidence.receiptId, 'step_1']]);
    const firstStepReceipts = buildStepReceipts({
      plannedTask: taskContract.plan,
      evidenceReceipts: [automationEvidence],
      toolReceiptStepIds,
    });
    const finalAnswer = 'Create a daily code-review readiness automation that checks pending approvals and routing failures, then posts a concise review queue summary.';
    const answerEvidence = {
      receiptId: 'answer-1',
      sourceType: 'model_answer' as const,
      status: 'succeeded' as const,
      refs: [] as string[],
      summary: finalAnswer,
      startedAt: 3,
      endedAt: 3,
    };
    const secondStepReceipts = buildStepReceipts({
      plannedTask: taskContract.plan,
      evidenceReceipts: [automationEvidence, answerEvidence],
      toolReceiptStepIds,
      finalAnswerReceiptId: answerEvidence.receiptId,
    });

    const dispatchProfiles: Array<string | undefined> = [];
    const retrySections: string[] = [];
    workerMessageHandler = (params) => {
      const executionProfile = params.executionProfile as { providerName?: string } | undefined;
      dispatchProfiles.push(executionProfile?.providerName);
      const retrySection = (params.additionalSections as Array<{ section?: string; content?: string }> | undefined)
        ?.find((section) => section.section === 'Delegated Retry Directive');
      if (retrySection?.content) {
        retrySections.push(retrySection.content);
      }
      if (dispatchProfiles.length === 1) {
        return {
          content: '',
          metadata: buildDelegatedExecutionMetadata({
            taskContract,
            runStatus: 'incomplete',
            stopReason: 'end_turn',
            stepReceipts: firstStepReceipts,
            operatorSummary: 'Found related automations but did not produce the requested recommendation.',
            claims: [],
            evidenceReceipts: [automationEvidence],
            interruptions: [],
            artifacts: [],
            events: [],
          }),
        };
      }
      return {
        content: finalAnswer,
        metadata: buildDelegatedExecutionMetadata({
          taskContract,
          runStatus: 'completed',
          stopReason: 'end_turn',
          stepReceipts: secondStepReceipts,
          finalUserAnswer: finalAnswer,
          operatorSummary: finalAnswer,
          claims: [],
          evidenceReceipts: [automationEvidence, answerEvidence],
          interruptions: [],
          artifacts: [],
          events: [],
        }),
      };
    };

    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        getConfigSnapshot: () => createExecutionProfileTestConfig(),
        auditLog: { record: vi.fn() },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
    );

    const result = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-answer-only-retry',
        userId: 'tester',
        channel: 'web',
        content: 'Find any automations or routines related to approval, routing, or code review, then suggest one useful automation I could create. Do not create it yet.',
        metadata: attachPreRoutedIntentGatewayMetadata(undefined, {
          mode: 'primary',
          available: true,
          model: 'test-model',
          latencyMs: 1,
          decision,
        }),
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      additionalSections: [],
      toolContext: '',
      runtimeNotices: [],
      executionProfile: {
        id: 'managed-cloud',
        providerName: 'openrouter-tools',
        providerType: 'openrouter',
        providerModel: 'qwen/qwen3.6-plus',
        providerLocality: 'external',
        providerTier: 'managed_cloud',
        requestedTier: 'external',
        preferredAnswerPath: 'tool_loop',
        expectedContextPressure: 'medium',
        contextBudget: 32_000,
        toolContextMode: 'tight',
        maxAdditionalSections: 2,
        maxRuntimeNotices: 2,
        fallbackProviderOrder: ['openrouter-tools', 'openai-frontier'],
        reason: 'test managed cloud profile',
        routingMode: 'auto',
        selectionSource: 'delegated_role',
      },
      delegation: {
        requestId: 'm-answer-only-retry',
        originChannel: 'web',
      },
    });

    expect(dispatchProfiles).toEqual(['openrouter-tools', 'openrouter-tools']);
    expect(retrySections).toHaveLength(0);
    expect(result.content).toBe(finalAnswer);

    manager.shutdown();
  });

  it('uses no-tools grounded synthesis on the same managed profile when answer-only retry also returns no final answer', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    const decision = {
      route: 'general_assistant',
      confidence: 'high',
      operation: 'read',
      summary: 'Search the web for approval workflow best practices, compare them to the repo approach, and do not edit files.',
      turnRelation: 'new_request',
      resolution: 'ready',
      missingFields: [],
      executionClass: 'repo_grounded',
      preferredTier: 'external',
      requiresRepoGrounding: true,
      requiresToolSynthesis: true,
      requireExactFileReferences: false,
      expectedContextPressure: 'medium',
      preferredAnswerPath: 'tool_loop',
      simpleVsComplex: 'complex',
      entities: {},
      plannedSteps: [
        {
          kind: 'search',
          summary: 'Search the web for recent best practices on agent approval workflows.',
          expectedToolCategories: ['web_search'],
          required: true,
        },
        {
          kind: 'search',
          summary: 'Inspect the repo for the current approval continuation approach.',
          expectedToolCategories: ['repo_inspect'],
          required: true,
          dependsOn: ['step_1'],
        },
        {
          kind: 'answer',
          summary: 'Compare the web best practices to this repo approach without editing files.',
          expectedToolCategories: ['answer'],
          required: true,
          dependsOn: ['step_1', 'step_2'],
        },
      ],
    } as const;
    const taskContract = buildDelegatedTaskContract(decision);
    const webEvidence = {
      receiptId: 'web-search-1',
      sourceType: 'tool_call' as const,
      toolName: 'web_search',
      status: 'succeeded' as const,
      refs: ['https://example.com/agent-approval-patterns'],
      summary: 'Current agent guidance emphasizes explicit approval gates, scoped continuations, and auditability.',
      startedAt: 1,
      endedAt: 2,
    };
    const repoEvidence = {
      receiptId: 'repo-search-1',
      sourceType: 'tool_call' as const,
      toolName: 'fs_search',
      status: 'succeeded' as const,
      refs: ['src/runtime/approval-continuations.ts', 'src/runtime/pending-actions.ts'],
      summary: 'Repo evidence found scoped approval continuations and pending-action metadata.',
      startedAt: 3,
      endedAt: 4,
    };
    const stepReceipts = buildStepReceipts({
      plannedTask: taskContract.plan,
      evidenceReceipts: [webEvidence, repoEvidence],
      toolReceiptStepIds: new Map([
        [webEvidence.receiptId, 'step_1'],
        [repoEvidence.receiptId, 'step_2'],
      ]),
    });
    const incompleteEnvelope = {
      taskContract,
      runStatus: 'incomplete' as const,
      stopReason: 'end_turn' as const,
      stepReceipts,
      operatorSummary: 'Gathered web and repo evidence but did not produce the requested comparison.',
      claims: [],
      evidenceReceipts: [webEvidence, repoEvidence],
      interruptions: [],
      artifacts: [],
      events: [],
    };
    const finalAnswer = [
      'The repo approach is aligned with current approval workflow practice: it keeps approval decisions explicit, scopes resume state through pending-action metadata, and preserves auditability.',
      'The main gap is UX resilience after evidence gathering: the orchestrator should synthesize from gathered receipts instead of asking the user to retry when only the final answer step is missing.',
    ].join('\n');

    const dispatchModes: string[] = [];
    const dispatchProfiles: Array<string | undefined> = [];
    workerMessageHandler = (params) => {
      const groundedSynthesis = !!params.groundedSynthesis;
      dispatchModes.push(groundedSynthesis ? 'synthesis' : 'delegated');
      dispatchProfiles.push((params.executionProfile as { providerName?: string } | undefined)?.providerName);
      if (groundedSynthesis) {
        const synthesisMessages = params.groundedSynthesis as { messages?: Array<{ content?: string }> };
        const combinedPrompt = synthesisMessages.messages?.map((message) => message.content ?? '').join('\n') ?? '';
        expect(combinedPrompt).toContain('web-search-1');
        expect(combinedPrompt).toContain('repo-search-1');
        expect(combinedPrompt).toContain('No tools are available');
        return {
          content: finalAnswer,
          metadata: {
            skipTestDelegatedEnvelope: true,
            groundedSynthesis: { available: true },
            workerExecution: {
              lifecycle: 'failed',
              source: 'tool_loop',
              completionReason: 'model_response',
              responseQuality: 'degraded',
              terminationReason: 'max_rounds',
            },
          },
        };
      }
      return {
        content: '',
        metadata: buildDelegatedExecutionMetadata(incompleteEnvelope),
      };
    };

    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        getConfigSnapshot: () => createExecutionProfileTestConfig(),
        auditLog: { record: vi.fn() },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
    );

    const result = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-grounded-answer-fallback',
        userId: 'tester',
        channel: 'web',
        content: 'Search the web for recent best practices on agent approval workflows, then compare them to this repo approach. Do not edit files.',
        metadata: attachPreRoutedIntentGatewayMetadata(undefined, {
          mode: 'primary',
          available: true,
          model: 'test-model',
          latencyMs: 1,
          decision,
        }),
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      additionalSections: [],
      toolContext: '',
      runtimeNotices: [],
      executionProfile: {
        id: 'managed-cloud',
        providerName: 'openrouter-tools',
        providerType: 'openrouter',
        providerModel: 'qwen/qwen3.6-plus',
        providerLocality: 'external',
        providerTier: 'managed_cloud',
        requestedTier: 'external',
        preferredAnswerPath: 'tool_loop',
        expectedContextPressure: 'medium',
        contextBudget: 32_000,
        toolContextMode: 'tight',
        maxAdditionalSections: 2,
        maxRuntimeNotices: 2,
        fallbackProviderOrder: ['openrouter-tools', 'openai-frontier'],
        reason: 'test managed cloud profile',
        routingMode: 'auto',
        selectionSource: 'delegated_role',
      },
      delegation: {
        requestId: 'm-grounded-answer-fallback',
        originChannel: 'web',
      },
    });

    expect(dispatchModes).toEqual(['delegated', 'synthesis']);
    expect(dispatchProfiles).toEqual(['openrouter-tools', 'openrouter-tools']);
    expect(result.content).toBe(finalAnswer);
    expect(result.metadata?.delegatedGroundedAnswerSynthesis).toMatchObject({
      available: true,
      reason: 'answer_only_retry',
      unsatisfiedStepIds: ['step_3'],
    });
    expect(result.metadata?.workerExecution).toBeUndefined();
    const envelope = readDelegatedResultEnvelope(result.metadata);
    expect(envelope?.verification).toMatchObject({
      decision: 'satisfied',
    });
    expect(envelope?.stepReceipts).toMatchObject([
      { stepId: 'step_1', status: 'satisfied' },
      { stepId: 'step_2', status: 'satisfied' },
      { stepId: 'step_3', status: 'satisfied' },
    ]);

    manager.shutdown();
  });

  it('does not hold a delegated app build for redundant approval once runtime evidence is already satisfied', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    const decision: IntentGatewayDecision = {
      route: 'coding_task',
      confidence: 'high',
      operation: 'create',
      summary: 'Build and verify a simple local music app.',
      turnRelation: 'new_request',
      resolution: 'ready',
      missingFields: [],
      executionClass: 'repo_grounded',
      preferredTier: 'external',
      requiresRepoGrounding: true,
      requiresToolSynthesis: true,
      expectedContextPressure: 'high',
      preferredAnswerPath: 'tool_loop',
      plannedSteps: [
        { kind: 'write', summary: 'Create the app files.', expectedToolCategories: ['repo_mutation'], required: true },
        { kind: 'tool_call', summary: 'Start or exercise the app locally and collect runtime evidence before answering.', expectedToolCategories: ['runtime_evidence'], required: true, dependsOn: ['step_1'] },
        { kind: 'answer', summary: 'Tell the user the local URL and what was verified.', required: true, dependsOn: ['step_2'] },
      ],
      entities: {},
    };
    const taskContract = buildDelegatedTaskContract(decision);
    const writeReceipt = {
      receiptId: 'receipt-write-server',
      sourceType: 'tool_call' as const,
      toolName: 'fs_write',
      status: 'succeeded' as const,
      refs: ['S:\\Development\\MusicApp\\server.js'],
      summary: 'Wrote server.js for the MusicApp.',
      startedAt: 1,
      endedAt: 2,
    };
    const runtimeReceipt = {
      receiptId: 'receipt-runtime-check',
      sourceType: 'tool_call' as const,
      toolName: 'code_build',
      status: 'succeeded' as const,
      refs: [],
      summary: 'Verified the app locally with node --check server.js.',
      startedAt: 3,
      endedAt: 4,
    };
    const interruption = {
      interruptionId: 'approval-extra-run',
      kind: 'approval' as const,
      prompt: 'Waiting for approval to run code_remote_exec.',
      approvalSummaries: [
        { id: 'approval-extra-run', toolName: 'code_remote_exec', argsPreview: '{"command":"node server.js &"}' },
      ],
    };
    const stepReceipts = buildStepReceipts({
      plannedTask: taskContract.plan,
      evidenceReceipts: [writeReceipt, runtimeReceipt],
      toolReceiptStepIds: new Map([
        [writeReceipt.receiptId, 'step_1'],
        [runtimeReceipt.receiptId, 'step_2'],
      ]),
      interruptions: [interruption],
    });
    const suspendedEnvelope = {
      taskContract,
      runStatus: 'suspended' as const,
      stopReason: 'approval_required' as const,
      stepReceipts,
      operatorSummary: 'Waiting for approval to run an extra command after local verification.',
      claims: [],
      evidenceReceipts: [writeReceipt, runtimeReceipt],
      interruptions: [interruption],
      artifacts: [],
      events: [],
    };
    const finalAnswer = 'Created the MusicApp in S:\\Development\\MusicApp, verified `node --check server.js`, and the local URL is http://localhost:3000.';
    const dispatchModes: string[] = [];

    workerMessageHandler = (params) => {
      const groundedSynthesis = !!params.groundedSynthesis;
      dispatchModes.push(groundedSynthesis ? 'synthesis' : 'delegated');
      if (groundedSynthesis) {
        const synthesisMessages = params.groundedSynthesis as { messages?: Array<{ content?: string }> };
        const combinedPrompt = synthesisMessages.messages?.map((message) => message.content ?? '').join('\n') ?? '';
        expect(combinedPrompt).toContain('receipt-runtime-check');
        expect(combinedPrompt).toContain('No tools are available');
        return {
          content: finalAnswer,
          metadata: {
            skipTestDelegatedEnvelope: true,
            workerExecution: {
              lifecycle: 'completed',
              source: 'tool_loop',
              completionReason: 'model_response',
              responseQuality: 'final',
              terminationReason: 'clean_exit',
            },
          },
        };
      }
      return {
        content: '',
        metadata: {
          ...buildDelegatedExecutionMetadata(suspendedEnvelope),
          ...approvalPendingActionMetadata([
            { id: 'approval-extra-run', toolName: 'code_remote_exec', argsPreview: '{"command":"node server.js &"}' },
          ]),
        },
      };
    };

    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        getConfigSnapshot: () => createExecutionProfileTestConfig(),
        auditLog: { record: vi.fn() },
        registry: {
          get: (agentId: string) => agentId === 'local'
            ? {
                agent: { name: 'Guardian Agent' },
                definition: {
                  orchestration: {
                    role: 'implementer',
                    label: 'Workspace Implementer',
                    lenses: ['coding-workspace'],
                  },
                },
              }
            : undefined,
        },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
    );

    const result = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-redundant-approval-after-runtime',
        userId: 'tester',
        channel: 'web',
        content: 'Build a simple music app from scratch in the attached repo and verify it runs locally.',
        metadata: attachPreRoutedIntentGatewayMetadata(undefined, {
          mode: 'primary',
          available: true,
          model: 'test-model',
          latencyMs: 1,
          decision,
        }),
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      additionalSections: [],
      toolContext: '',
      runtimeNotices: [],
      executionProfile: {
        id: 'managed_cloud_tool',
        providerName: 'ollama-cloud-coding',
        providerType: 'ollama_cloud',
        providerModel: 'glm-5.1',
        providerLocality: 'external',
        providerTier: 'managed_cloud',
        requestedTier: 'external',
        preferredAnswerPath: 'tool_loop',
        expectedContextPressure: 'high',
        contextBudget: 32_000,
        toolContextMode: 'tight',
        maxAdditionalSections: 2,
        maxRuntimeNotices: 2,
        fallbackProviderOrder: ['ollama-cloud-coding', 'openai-frontier'],
        reason: 'delegated coding role selected managed-cloud coding profile',
        routingMode: 'auto',
        selectionSource: 'delegated_role',
      },
      delegation: {
        requestId: 'm-redundant-approval-after-runtime',
        originChannel: 'web',
        codeSessionId: 'music-session',
      },
    });

    expect(dispatchModes).toEqual(['delegated', 'synthesis']);
    expect(result.content).toBe(finalAnswer);
    expect(result.content).not.toContain('approval required');
    expect(result.metadata?.pendingAction).toBeUndefined();
    expect(result.metadata?.continueConversationAfterApproval).toBeUndefined();
    expect(result.metadata?.delegatedHandoff).toMatchObject({
      reportingMode: 'inline_response',
    });
    expect((result.metadata?.delegatedHandoff as { unresolvedBlockerKind?: string } | undefined)?.unresolvedBlockerKind).toBeUndefined();
    const envelope = readDelegatedResultEnvelope(result.metadata);
    expect(envelope?.verification).toMatchObject({ decision: 'satisfied' });
    expect(envelope?.interruptions).toEqual([]);

    manager.shutdown();
  });

  it('appends the code session registry section to delegated worker prompt context when available', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    const buildRegistrySection = vi.fn(() => ({
      section: 'Code Session Registry',
      content: '<code-session-registry>\ncurrentSessionId: code-1\n</code-session-registry>',
      mode: 'metadata',
      itemCount: 2,
    }));
    const intentRoutingTrace = {
      record: vi.fn(),
    };

    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
        buildCodeSessionRegistryAdditionalSection: buildRegistrySection,
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        auditLog: { record: vi.fn() },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
      undefined,
      {
        intentRoutingTrace,
      },
    );

    await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-registry',
        userId: 'tester',
        principalId: 'tester',
        principalRole: 'owner',
        surfaceId: 'web-chat',
        channel: 'web',
        content: 'Switch back to the main repo session and inspect auth routing.',
        metadata: {
          codeContext: {
            workspaceRoot: '/repo',
            sessionId: 'code-1',
          },
        },
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      additionalSections: [{
        section: 'Existing Context',
        content: 'existing',
      }],
      toolContext: '',
      runtimeNotices: [],
    });

    expect(buildRegistrySection).toHaveBeenCalledWith({
      userId: 'tester',
      principalId: 'tester',
      principalRole: 'owner',
      channel: 'web',
      surfaceId: 'web-chat',
      codeContext: {
        workspaceRoot: '/repo',
        sessionId: 'code-1',
      },
    });
    const messageHandle = workerNotifications.find((entry) => entry.method === 'message.handle');
    expect(messageHandle?.params.additionalSections).toEqual([
      {
        section: 'Existing Context',
        content: 'existing',
      },
      {
        section: 'Code Session Registry',
        content: '<code-session-registry>\ncurrentSessionId: code-1\n</code-session-registry>',
        mode: 'metadata',
        itemCount: 2,
      },
    ]);
    const runningTrace = intentRoutingTrace.record.mock.calls
      .map(([entry]) => entry)
      .find((entry) => entry.stage === 'delegated_worker_running');
    expect(runningTrace).toMatchObject({
      stage: 'delegated_worker_running',
      details: {
        taskContractKind: 'general_answer',
        promptAdditionalSectionCount: 2,
        promptAdditionalSectionNames: ['Existing Context', 'Code Session Registry'],
        codeSessionRegistryAttached: true,
        codeSessionRegistryItemCount: 2,
      },
    });

    manager.shutdown();
  });

  it('omits the code session registry for non-code provider status workers', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    const buildRegistrySection = vi.fn(() => ({
      section: 'Code Session Registry',
      content: '<code-session-registry>\ncurrentSessionId: code-1\n</code-session-registry>',
      mode: 'metadata',
      itemCount: 2,
    }));
    const intentRoutingTrace = {
      record: vi.fn(),
    };

    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
        buildCodeSessionRegistryAdditionalSection: buildRegistrySection,
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        auditLog: { record: vi.fn() },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
      undefined,
      {
        intentRoutingTrace,
      },
    );

    await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-provider-status',
        userId: 'tester',
        principalId: 'tester',
        principalRole: 'owner',
        surfaceId: 'web-chat',
        channel: 'web',
        content: 'Check whether Google Workspace and Microsoft 365 are connected. Do not read content.',
        metadata: attachPreRoutedIntentGatewayMetadata(undefined, {
          mode: 'primary',
          available: true,
          model: 'test-model',
          latencyMs: 1,
          decision: {
            route: 'general_assistant',
            confidence: 'low',
            operation: 'inspect',
            summary: 'Check provider status.',
            turnRelation: 'new_request',
            resolution: 'ready',
            missingFields: [],
            executionClass: 'tool_orchestration',
            preferredTier: 'external',
            requiresRepoGrounding: false,
            requiresToolSynthesis: true,
            expectedContextPressure: 'medium',
            preferredAnswerPath: 'tool_loop',
            simpleVsComplex: 'complex',
            plannedSteps: [
              {
                kind: 'read',
                summary: 'Check connector authentication status.',
                expectedToolCategories: ['gws_status', 'm365_status'],
                required: true,
              },
              {
                kind: 'answer',
                summary: 'Return status summary.',
                required: true,
                dependsOn: ['step_1'],
              },
            ],
          },
        }),
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [
        {
          id: 'google-workspace',
          name: 'Google Workspace',
          description: 'Google status.',
          summary: 'Google status.',
          sourcePath: '/skills/google-workspace',
          score: 10,
        },
      ],
      additionalSections: [{
        section: 'Existing Context',
        content: 'existing',
      }],
      toolContext: '',
      runtimeNotices: [],
    });

    expect(buildRegistrySection).not.toHaveBeenCalled();
    const messageHandle = workerNotifications.find((entry) => entry.method === 'message.handle');
    expect(messageHandle?.params.additionalSections).toEqual([{
      section: 'Existing Context',
      content: 'existing',
    }]);
    const runningTrace = intentRoutingTrace.record.mock.calls
      .map(([entry]) => entry)
      .find((entry) => entry.stage === 'delegated_worker_running');
    expect(runningTrace?.details).not.toHaveProperty('codeSessionRegistryAttached');

    manager.shutdown();
  });

  it('spawns separate workers for the same surface session when the agent lane changes', async () => {
    const { WorkerManager } = await import('./worker-manager.js');
    const sandbox = await import('../sandbox/index.js');

    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        auditLog: { record: vi.fn() },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
    );

    const baseRequest = {
      sessionId: 'tester:web',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-lane-1',
        userId: 'tester',
        channel: 'web',
        content: 'hello',
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      toolContext: '',
      runtimeNotices: [],
    };

    await manager.handleMessage({
      ...baseRequest,
      agentId: 'local',
    });
    await manager.handleMessage({
      ...baseRequest,
      agentId: 'external',
      message: {
        ...baseRequest.message,
        id: 'm-lane-2',
        content: 'hello again',
      },
    });

    expect(vi.mocked(sandbox.sandboxedSpawn)).toHaveBeenCalledTimes(2);

    manager.shutdown();
  });

  it('serializes overlapping dispatches on a reused worker', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        auditLog: { record: vi.fn() },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
    );

    const starts: string[] = [];
    const finishers: Array<() => void> = [];
    workerMessageHandler = (params) => new Promise((resolve) => {
      const message = params.message as { id?: string };
      const messageId = String(message.id ?? 'unknown');
      starts.push(messageId);
      finishers.push(() => resolve({ content: `done:${messageId}` }));
    });

    const baseRequest = {
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      toolContext: '',
      runtimeNotices: [],
    };

    const first = manager.handleMessage({
      ...baseRequest,
      message: {
        id: 'm-queue-1',
        userId: 'tester',
        channel: 'web',
        content: 'first',
        timestamp: Date.now(),
      },
    });

    while (starts.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const second = manager.handleMessage({
      ...baseRequest,
      message: {
        id: 'm-queue-2',
        userId: 'tester',
        channel: 'web',
        content: 'second',
        timestamp: Date.now(),
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(starts).toEqual(['m-queue-1']);

    finishers[0]?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(starts).toEqual(['m-queue-1', 'm-queue-2']);

    finishers[1]?.();
    await expect(first).resolves.toMatchObject({ content: 'done:m-queue-1' });
    await expect(second).resolves.toMatchObject({ content: 'done:m-queue-2' });

    manager.shutdown();
  });

  it('forwards structured prompt-assembly context to the worker', async () => {
    const { WorkerManager } = await import('./worker-manager.js');
    const sandbox = await import('../sandbox/index.js');

    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        auditLog: { record: vi.fn() },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
    );

    await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-context',
        userId: 'tester',
        principalId: 'tester',
        principalRole: 'owner',
        channel: 'web',
        content: 'Continue the current task.',
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [{ role: 'user', content: 'Earlier request.' }],
      knowledgeBases: [
        { scope: 'global', content: 'Remembered preference.' },
        { scope: 'coding_session', content: 'Parser workspace note.' },
      ],
      activeSkills: [{ id: 'writing-plans', name: 'Writing Plans', description: 'plan helper', summary: 'Creates plans.', sourcePath: '/tmp/skill', score: 1 }],
      toolContext: 'Allowed roots: /tmp',
      runtimeNotices: [{ level: 'info', message: 'Notice one' }],
      continuity: {
        continuityKey: 'continuity-1',
        linkedSurfaceCount: 2,
        focusSummary: 'Continue the same task.',
      },
      pendingAction: {
        kind: 'clarification',
        prompt: 'Which provider should I use?',
        field: 'email_provider',
        transferPolicy: 'linked_surfaces_same_user',
      },
      pendingApprovalNotice: 'One unrelated approval is pending.',
    });

    const notification = workerNotifications.find((entry) => entry.method === 'message.handle');
    expect(notification?.params).toMatchObject({
      knowledgeBases: [
        { scope: 'global', content: 'Remembered preference.' },
        { scope: 'coding_session', content: 'Parser workspace note.' },
      ],
      toolContext: 'Allowed roots: /tmp',
      runtimeNotices: [{ level: 'info', message: 'Notice one' }],
      continuity: {
        continuityKey: 'continuity-1',
        linkedSurfaceCount: 2,
        focusSummary: 'Continue the same task.',
      },
      pendingAction: {
        kind: 'clarification',
        prompt: 'Which provider should I use?',
        field: 'email_provider',
        transferPolicy: 'linked_surfaces_same_user',
      },
      pendingApprovalNotice: 'One unrelated approval is pending.',
    });
    expect(vi.mocked(sandbox.sandboxedSpawn)).toHaveBeenCalledTimes(1);

    manager.shutdown();
  });

  it('tracks delegated worker lineage and bounded handoff summaries in job state', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    workerMessageHandler = () => ({
      content: 'Updated the importer validation flow and left one approval pending for the final write.',
      metadata: {
        responseSource: {
          locality: 'external',
          providerName: 'fallback-provider',
        },
        pendingAction: {
          blocker: {
            kind: 'approval',
            approvalSummaries: [
              { id: 'approval-1', toolName: 'fs_write', argsPreview: '{"path":"./tmp/out.md"}' },
            ],
          },
        },
      },
    });

    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
      } as never,
      {
        getFallbackProviderConfig: () => ({ provider: 'fallback' }),
        auditLog: { record: vi.fn() },
        registry: {
          get: (agentId: string) => agentId === 'local'
            ? {
                agent: { name: 'Local Agent' },
                definition: {
                  orchestration: {
                    role: 'coordinator',
                    label: 'Primary Coordinator',
                  },
                },
              }
            : undefined,
        },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
    );

    await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-delegated',
        userId: 'tester',
        principalId: 'tester',
        principalRole: 'owner',
        channel: 'web',
        surfaceId: 'web-chat',
        content: 'Continue the importer repair.',
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      toolContext: '',
      runtimeNotices: [],
      delegation: {
        requestId: 'm-delegated',
        executionId: 'exec-delegated',
        rootExecutionId: 'exec-root',
        originChannel: 'web',
        originSurfaceId: 'web-chat',
        continuityKey: 'continuity-1',
        activeExecutionRefs: ['code_session:Repo Fix'],
        pendingActionId: 'pending-1',
        codeSessionId: 'code-1',
      },
    });

    const state = manager.getJobState(5);
    expect(state.summary.total).toBe(1);
    expect(state.jobs[0]).toMatchObject({
      type: 'delegated_worker',
      status: 'blocked',
      metadata: {
        delegation: {
          kind: 'brokered_worker',
          lifecycle: 'blocked',
          agentId: 'local',
          agentName: 'Local Agent',
          orchestration: {
            role: 'coordinator',
            label: 'Primary Coordinator',
          },
          requestId: 'm-delegated',
          executionId: 'exec-delegated',
          rootExecutionId: 'exec-root',
          originChannel: 'web',
          originSurfaceId: 'web-chat',
          continuityKey: 'continuity-1',
          activeExecutionRefs: ['code_session:Repo Fix'],
          pendingActionId: 'pending-1',
          codeSessionId: 'code-1',
          handoff: {
            unresolvedBlockerKind: 'approval',
            approvalCount: 1,
            reportingMode: 'held_for_approval',
          },
        },
      },
    });
    expect((state.jobs[0]?.detail ?? '')).toContain('Updated the importer validation flow');

    manager.shutdown();
  });

  it('publishes delegated worker observability into the shared routing trace and run timeline', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    workerMessageHandler = () => ({
      content: 'Waiting for approval to write the final report.',
      metadata: {
        pendingAction: {
          blocker: {
            kind: 'approval',
            approvalSummaries: [
              { id: 'approval-write-1', toolName: 'fs_write', argsPreview: '{"path":"./report.md"}' },
            ],
          },
        },
      },
    });

    const intentRoutingTrace = {
      record: vi.fn(),
    };
    const runTimeline = {
      ingestDelegatedWorkerProgress: vi.fn(),
      ingestExecutionGraphEvent: vi.fn(),
    };
    const executionGraphStore = new ExecutionGraphStore({
      now: () => 123_456,
    });

    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        auditLog: { record: vi.fn() },
        registry: {
          get: (agentId: string) => agentId === 'local'
            ? {
                agent: { name: 'Local Agent' },
                definition: {
                  orchestration: {
                    role: 'coordinator',
                    label: 'Primary Coordinator',
                    lenses: ['routing', 'coordination'],
                  },
                },
              }
            : undefined,
        },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
      undefined,
      {
        intentRoutingTrace,
        runTimeline,
        executionGraphStore,
        now: () => 123_456,
      },
    );

    const result = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-observe',
        userId: 'tester',
        principalId: 'tester',
        principalRole: 'owner',
        channel: 'web',
        content: 'Continue the report export.',
        metadata: generalAssistantDirectMetadata(),
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      toolContext: '',
      runtimeNotices: [],
      executionProfile: {
        id: 'managed_cloud_tool',
        providerName: 'ollama-cloud-coding',
        providerType: 'ollama_cloud',
        providerModel: 'qwen3-coder-next',
        providerLocality: 'remote',
        providerTier: 'managed_cloud',
        requestedTier: 'external',
        preferredAnswerPath: 'tool_loop',
        expectedContextPressure: 'medium',
        contextBudget: 16_000,
        toolContextMode: 'standard',
        maxAdditionalSections: 8,
        maxRuntimeNotices: 6,
        fallbackProviderOrder: ['ollama-cloud-coding', 'openai-frontier'],
        reason: 'delegated coding role selected managed-cloud coding profile',
        selectionSource: 'delegated_role',
      },
      delegation: {
        requestId: 'm-observe',
        executionId: 'exec-observe',
        rootExecutionId: 'exec-root',
        originChannel: 'web',
        originSurfaceId: 'web-chat',
        continuityKey: 'continuity-1',
        activeExecutionRefs: ['code_session:Repo Fix'],
        pendingActionId: 'pending-1',
        codeSessionId: 'code-1',
      },
    });

    expect(intentRoutingTrace.record.mock.calls.map(([entry]) => entry.stage)).toEqual([
      'delegated_worker_started',
      'delegated_worker_running',
      'delegated_worker_contract_reconciled',
      'delegated_interruption_requested',
      'delegated_verification_decided',
      'delegated_worker_completed',
    ]);
    expect(intentRoutingTrace.record.mock.calls[0]?.[0]).toMatchObject({
      stage: 'delegated_worker_started',
      requestId: 'm-observe',
      channel: 'web',
      details: {
        originSurfaceId: 'web-chat',
        executionId: 'exec-observe',
        rootExecutionId: 'exec-root',
        taskExecutionId: expect.stringMatching(/^delegated-task:job-[^:]+$/),
        continuityKey: 'continuity-1',
        activeExecutionRefs: ['code_session:Repo Fix'],
        pendingActionId: 'pending-1',
        codeSessionId: 'code-1',
        agentName: 'Local Agent',
        orchestrationRole: 'coordinator',
        orchestrationLabel: 'Primary Coordinator',
        orchestrationLenses: ['routing', 'coordination'],
        executionProfileId: 'managed_cloud_tool',
        executionProfileName: 'ollama-cloud-coding',
        executionProfileModel: 'qwen3-coder-next',
        executionProfileTier: 'managed-cloud',
        executionProfileLocality: 'remote',
        executionProfileRequestedTier: 'external',
        executionProfileSelectionSource: 'delegated_role',
        executionProfilePreferredAnswerPath: 'tool_loop',
        executionProfileExpectedContextPressure: 'medium',
        executionProfileContextBudget: 16000,
        executionProfileToolContextMode: 'standard',
        executionProfileMaxAdditionalSections: 8,
        executionProfileMaxRuntimeNotices: 6,
        executionProfileReason: 'delegated coding role selected managed-cloud coding profile',
        taskContractKind: 'general_answer',
        taskContractAllowsAnswerFirst: true,
        taskContractRequiresEvidence: false,
        taskRunId: expect.stringMatching(/^delegated-task:job-[^:]+$/),
        lifecycle: 'running',
      },
    });
    const completedTrace = intentRoutingTrace.record.mock.calls
      .map(([entry]) => entry)
      .find((entry) => entry.stage === 'delegated_worker_completed');
    expect(completedTrace).toMatchObject({
      stage: 'delegated_worker_completed',
      requestId: 'm-observe',
      details: {
        taskRunId: expect.stringMatching(/^delegated-task:job-[^:]+$/),
        executionId: 'exec-observe',
        rootExecutionId: 'exec-root',
        taskExecutionId: expect.stringMatching(/^delegated-task:job-[^:]+$/),
        lifecycle: 'blocked',
        unresolvedBlockerKind: 'approval',
        approvalCount: 1,
        reportingMode: 'held_for_approval',
        reason: 'Waiting for approval to write the final report.',
        handoffSummary: 'Waiting for approval to write the final report.',
        handoffNextAction: 'Resolve the pending approval(s) to continue the delegated run.',
      },
    });

    expect(runTimeline.ingestDelegatedWorkerProgress.mock.calls.map(([event]) => event.kind)).toEqual([
      'started',
      'running',
      'blocked',
    ]);
    expect(runTimeline.ingestDelegatedWorkerProgress.mock.calls[1]?.[0]).toMatchObject({
      id: expect.stringMatching(/^delegated-worker:job-[^:]+:running$/),
      kind: 'running',
      requestId: 'm-observe',
      runId: 'exec-observe',
      parentRunId: 'exec-observe',
      executionId: 'exec-observe',
      rootExecutionId: 'exec-root',
      taskExecutionId: expect.stringMatching(/^delegated-task:job-[^:]+$/),
      codeSessionId: 'code-1',
      agentId: 'local',
      agentName: 'Local Agent',
      orchestrationRole: 'coordinator',
      orchestrationLabel: 'Primary Coordinator',
      orchestrationLenses: ['routing', 'coordination'],
      executionProfileName: 'ollama-cloud-coding',
      executionProfileModel: 'qwen3-coder-next',
      executionProfileTier: 'managed-cloud',
      originChannel: 'web',
      continuityKey: 'continuity-1',
      activeExecutionRefs: ['code_session:Repo Fix'],
      timestamp: 123_456,
      detail: 'Primary Coordinator is working using managed-cloud profile ollama-cloud-coding (qwen3-coder-next) in code session code-1.',
    });
    expect(runTimeline.ingestDelegatedWorkerProgress.mock.calls[2]?.[0]).toMatchObject({
      id: expect.stringMatching(/^delegated-worker:job-[^:]+:completed$/),
      kind: 'blocked',
      executionId: 'exec-observe',
      rootExecutionId: 'exec-root',
      taskExecutionId: expect.stringMatching(/^delegated-task:job-[^:]+$/),
      executionProfileName: 'ollama-cloud-coding',
      executionProfileModel: 'qwen3-coder-next',
      executionProfileTier: 'managed-cloud',
      reportingMode: 'held_for_approval',
      unresolvedBlockerKind: 'approval',
      approvalCount: 1,
      detail: 'Resolve the pending approval(s) to continue the delegated run.',
    });
    const graphEvents = runTimeline.ingestExecutionGraphEvent.mock.calls.map(([event]) => event);
    expect(graphEvents.map((event) => event.kind)).toEqual([
      'graph_started',
      'node_started',
      'artifact_created',
      'verification_completed',
      'interruption_requested',
    ]);
    expect(graphEvents[3]).toMatchObject({
      kind: 'verification_completed',
      nodeKind: 'delegated_worker',
      payload: {
        decision: 'blocked',
        valid: false,
      },
    });
    expect(graphEvents[4]).toMatchObject({
      kind: 'interruption_requested',
      nodeKind: 'delegated_worker',
      payload: {
        kind: 'approval',
        approvalCount: 1,
        reportingMode: 'held_for_approval',
      },
    });
    const delegatedGraphId = graphEvents[0]?.graphId ?? '';
    const delegatedSnapshot = executionGraphStore.getSnapshot(delegatedGraphId);
    expect(delegatedSnapshot?.graph.status).toBe('awaiting_approval');
    expect(delegatedSnapshot?.graph.nodes.map((node) => [node.kind, node.status])).toEqual([
      ['delegated_worker', 'awaiting_approval'],
    ]);
    expect(executionGraphStore.listArtifacts(delegatedGraphId).map((artifact) => artifact.artifactType)).toEqual([
      'VerificationResult',
    ]);
    expect(result.metadata?.executionGraph).toMatchObject({
      graphId: delegatedGraphId,
      status: 'awaiting_approval',
      lifecycle: 'blocked',
      verificationArtifactId: expect.stringContaining(':verification'),
    });
    expect(manager.getJobState(5).jobs[0]?.metadata).toMatchObject({
      delegation: {
        executionGraph: {
          graphId: delegatedGraphId,
          nodeId: expect.stringContaining(':delegated_worker'),
          status: 'awaiting_approval',
          lifecycle: 'blocked',
          verificationArtifactId: expect.stringContaining(':verification'),
        },
      },
    });

    manager.shutdown();
  });

  it('completes delegated worker graph projections for satisfied brokered runs', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    workerMessageHandler = () => ({
      content: 'The report export path is ready.',
    });

    const runTimeline = {
      ingestDelegatedWorkerProgress: vi.fn(),
      ingestExecutionGraphEvent: vi.fn(),
    };
    const executionGraphStore = new ExecutionGraphStore({
      now: () => 123_789,
    });
    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        auditLog: { record: vi.fn() },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
      undefined,
      {
        runTimeline,
        executionGraphStore,
        now: () => 123_789,
      },
    );

    const result = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-completed-delegated-graph',
        userId: 'tester',
        channel: 'web',
        content: 'Summarize the report export path.',
        metadata: generalAssistantDirectMetadata(),
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      toolContext: '',
      runtimeNotices: [],
      delegation: {
        requestId: 'm-completed-delegated-graph',
        executionId: 'exec-completed-delegated-graph',
        rootExecutionId: 'exec-completed-root',
        originChannel: 'web',
      },
    });

    expect(result.content).toBe('The report export path is ready.');
    expect(runTimeline.ingestDelegatedWorkerProgress.mock.calls.map(([event]) => event.kind)).toEqual([
      'started',
      'running',
      'completed',
    ]);
    const graphEvents = runTimeline.ingestExecutionGraphEvent.mock.calls.map(([event]) => event);
    expect(graphEvents.map((event) => event.kind)).toEqual([
      'graph_started',
      'node_started',
      'artifact_created',
      'verification_completed',
      'node_completed',
      'graph_completed',
    ]);
    const graphId = graphEvents[0]?.graphId ?? '';
    const snapshot = executionGraphStore.getSnapshot(graphId);
    expect(snapshot?.graph.status).toBe('completed');
    expect(snapshot?.graph.nodes.map((node) => [node.kind, node.status])).toEqual([
      ['delegated_worker', 'completed'],
    ]);
    expect(executionGraphStore.listArtifacts(graphId).map((artifact) => artifact.artifactType)).toEqual([
      'VerificationResult',
    ]);
    expect(result.metadata?.executionGraph).toMatchObject({
      graphId,
      status: 'completed',
      lifecycle: 'completed',
      verificationArtifactId: expect.stringContaining(':verification'),
    });
    expect(manager.getJobState(5).jobs[0]?.metadata).toMatchObject({
      delegation: {
        executionGraph: {
          graphId,
          nodeId: expect.stringContaining(':delegated_worker'),
          status: 'completed',
          lifecycle: 'completed',
          verificationArtifactId: expect.stringContaining(':verification'),
        },
      },
    });

    manager.shutdown();
  });

  it('normalizes clarification-blocked delegated responses into status-only output', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    workerMessageHandler = () => ({
      content: 'I need you to choose which mail provider to use before I continue.',
      metadata: {
        pendingAction: {
          blocker: {
            kind: 'clarification',
            prompt: 'Which provider should I use?',
          },
        },
      },
    });

    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        auditLog: { record: vi.fn() },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
    );

    const result = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-status-only',
        userId: 'tester',
        principalId: 'tester',
        principalRole: 'owner',
        channel: 'web',
        content: 'Continue the draft workflow.',
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      toolContext: '',
      runtimeNotices: [],
      delegation: {
        requestId: 'm-status-only',
        originChannel: 'web',
      },
    });

    expect(result.content).toContain('Delegated work is paused: clarification required.');
    expect(result.content).toContain('Which provider should I use?');
    expect(result.metadata).toMatchObject({
      delegatedHandoff: {
        reportingMode: 'status_only',
        unresolvedBlockerKind: 'clarification',
      },
    });

    manager.shutdown();
  });

  it('keeps approval-blocked delegated responses inline while exposing follow-up metadata', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    workerMessageHandler = () => ({
      content: 'Waiting for approval to write the final report.',
      metadata: {
        pendingAction: {
          blocker: {
            kind: 'approval',
            approvalSummaries: [
              { id: 'approval-write-1', toolName: 'fs_write', argsPreview: '{"path":"./report.md"}' },
            ],
          },
        },
      },
    });

    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        auditLog: { record: vi.fn() },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
    );

    const result = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-held-approval',
        userId: 'tester',
        principalId: 'tester',
        principalRole: 'owner',
        channel: 'web',
        content: 'Continue the report export.',
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      toolContext: '',
      runtimeNotices: [],
      delegation: {
        requestId: 'm-held-approval',
        originChannel: 'web',
      },
    });

    expect(result.content).toContain('Delegated work is paused: approval required.');
    expect(result.content).toContain('Waiting for approval to write the final report.');
    expect(result.content).toContain('Resolve the pending approval(s) to continue the delegated run.');
    expect(result.metadata).toMatchObject({
      delegatedHandoff: {
        reportingMode: 'held_for_approval',
        unresolvedBlockerKind: 'approval',
        approvalCount: 1,
      },
    });

    manager.shutdown();
  });

  it('resumes delegated worker approvals from graph-owned worker suspension artifacts', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    let sawContinuation = false;
    workerMessageHandler = (params) => {
      const message = (params.message ?? {}) as {
        id?: string;
        userId?: string;
        channel?: string;
        surfaceId?: string;
        content?: string;
        metadata?: Record<string, unknown>;
        timestamp?: number;
      };
      const continuation = message.metadata?.[APPROVAL_OUTCOME_CONTINUATION_METADATA_KEY] as
        | { type?: string; approvalId?: string; decision?: string; resultMessage?: string }
        | undefined;
      if (continuation?.approvalId === 'approval-graph-worker-1') {
        sawContinuation = true;
        expect(message.channel).toBe('web');
        expect(message.surfaceId).toBe('surface-1');
        expect(message.metadata?.workerSuspension).toBeTruthy();
        return {
          content: 'The delegated worker resumed from graph suspension state.',
          metadata: {
            workerExecution: {
              lifecycle: 'completed',
              source: 'tool_loop',
              completionReason: 'completed',
              responseQuality: 'final',
              toolCallCount: 1,
              toolResultCount: 1,
              successfulToolResultCount: 1,
            },
          },
        };
      }
      const baseMetadata = {
        continueConversationAfterApproval: true,
        ...approvalPendingActionMetadata([
          {
            id: 'approval-graph-worker-1',
            toolName: 'outlook_draft',
            argsPreview: '{"to":"alex@example.com"}',
          },
        ]),
      };
      return {
        content: 'Waiting for approval to create the delegated draft.',
        metadata: attachWorkerSuspensionMetadata(baseMetadata, {
          version: WORKER_SUSPENSION_SCHEMA_VERSION,
          kind: 'tool_loop',
          llmMessages: [
            {
              role: 'assistant',
              content: '',
              toolCalls: [{ id: 'call-graph-worker-1', name: 'outlook_draft', args: '{"to":"alex@example.com"}' }],
            },
          ],
          pendingTools: [{
            approvalId: 'approval-graph-worker-1',
            toolCallId: 'call-graph-worker-1',
            jobId: 'job-graph-worker-1',
            name: 'outlook_draft',
          }],
          originalMessage: {
            id: message.id ?? 'm-graph-worker',
            userId: message.userId ?? 'tester',
            principalId: 'tester',
            principalRole: 'owner',
            channel: message.channel ?? 'web',
            content: message.content ?? 'Draft an Outlook email.',
            metadata: message.metadata,
            timestamp: message.timestamp ?? 1,
          },
          createdAt: 1,
          expiresAt: 30_001,
        }),
      };
    };

    const pendingActionStore = createMemoryPendingActionStore(() => 1);
    const executionGraphStore = new ExecutionGraphStore({ now: () => 1 });
    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
        listApprovals: vi.fn(() => []),
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        auditLog: { record: vi.fn() },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
      undefined,
      {
        pendingActionStore,
        executionGraphStore,
        now: () => 1,
      },
    );

    await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-graph-worker',
        userId: 'tester',
        principalId: 'tester',
        principalRole: 'owner',
        channel: 'web:surface:surface-1',
        surfaceId: 'surface-1',
        content: 'Draft an Outlook email to alex@example.com.',
        metadata: repoGroundedCodingMetadata(),
        timestamp: 1,
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      toolContext: '',
      runtimeNotices: [],
      delegation: {
        requestId: 'm-graph-worker',
        executionId: 'exec-graph-worker',
        rootExecutionId: 'root-graph-worker',
        originChannel: 'web',
        originSurfaceId: 'surface-1',
        continuityKey: 'tester:web',
      },
    });

    const pending = pendingActionStore.findActiveByApprovalId('approval-graph-worker-1');
    expect(pending?.scope).toMatchObject({
      userId: 'tester',
      channel: 'web',
      surfaceId: 'surface-1',
    });
    expect(pending?.resume).toMatchObject({
      kind: 'execution_graph',
      payload: {
        graphId: expect.stringContaining('delegated-worker'),
        nodeKind: 'delegated_worker',
      },
    });
    expect(pending?.graphInterrupt?.artifactRefs.map((artifact) => artifact.artifactType)).toContain('WorkerSuspension');
    expect(executionGraphStore.listArtifacts(pending?.resume?.payload.graphId as string).map((artifact) => artifact.artifactType)).toContain('WorkerSuspension');

    manager.shutdown();

    const resumeManager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
        listApprovals: vi.fn(() => []),
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        auditLog: { record: vi.fn() },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
      undefined,
      {
        pendingActionStore,
        executionGraphStore,
        now: () => 2,
      },
    );

    const resumed = await resumeManager.resumeExecutionGraphPendingAction(
      pending!,
      {
        approvalId: 'approval-graph-worker-1',
        approvalResult: {
          success: true,
          approved: true,
          executionSucceeded: true,
          message: 'Draft approved.',
        },
      },
    );

    expect(resumed?.content).toBe('The delegated worker resumed from graph suspension state.');
    expect(resumed?.metadata?.executionGraph).toMatchObject({
      graphId: pending?.resume?.payload.graphId,
      status: 'succeeded',
    });
    expect(sawContinuation).toBe(true);

    resumeManager.shutdown();
  });

  it('marks delegated workers as failed when the worker loop reports a non-terminal execution state', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    workerMessageHandler = () => ({
      content: 'I will inspect the repository first and then start fixing the bug.',
      metadata: {
        workerExecution: {
          lifecycle: 'failed',
          source: 'tool_loop',
          completionReason: 'intermediate_response',
          responseQuality: 'intermediate',
          toolCallCount: 0,
          toolResultCount: 0,
        },
      },
    });

    const intentRoutingTrace = {
      record: vi.fn(),
    };
    const runTimeline = {
      ingestDelegatedWorkerProgress: vi.fn(),
    };

    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        auditLog: { record: vi.fn() },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
      undefined,
      {
        intentRoutingTrace,
        runTimeline,
        now: () => 123_456,
      },
    );

    const result = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-failed-delegated',
        userId: 'tester',
        principalId: 'tester',
        principalRole: 'owner',
        channel: 'web',
        content: 'Inspect the repo and fix the bug.',
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      toolContext: '',
      runtimeNotices: [],
      delegation: {
        requestId: 'm-failed-delegated',
        originChannel: 'web',
      },
    });

    expect(result.content).toContain('Delegated work failed.');
    expect(result.content).toContain('Delegated worker stopped before satisfying every required planned step.');

    const state = manager.getJobState(5);
    expect(state.jobs[0]).toMatchObject({
      type: 'delegated_worker',
      status: 'failed',
      metadata: {
        delegation: {
          kind: 'brokered_worker',
          lifecycle: 'failed',
          handoff: {
            reportingMode: 'inline_response',
            nextAction: expect.stringContaining('step_1'),
          },
        },
      },
    });

    expect(intentRoutingTrace.record.mock.calls.map(([entry]) => entry.stage)).toEqual([
      'delegated_worker_started',
      'delegated_worker_running',
      'recovery_advisor_started',
      'recovery_advisor_rejected',
      'delegated_worker_contract_reconciled',
      'delegated_claim_emitted',
      'delegated_verification_decided',
      'delegated_worker_failed',
    ]);
    const failedTrace = intentRoutingTrace.record.mock.calls
      .map(([entry]) => entry)
      .find((entry) => entry.stage === 'delegated_worker_failed');
    expect(failedTrace).toMatchObject({
      stage: 'delegated_worker_failed',
      requestId: 'm-failed-delegated',
      contentPreview: 'Delegated worker stopped before satisfying every required planned step.',
      details: {
        taskRunId: expect.stringMatching(/^delegated-task:job-[^:]+$/),
        lifecycle: 'failed',
        reason: 'Delegated worker stopped before satisfying every required planned step.',
        handoffSummary: 'Delegated worker stopped before satisfying every required planned step.',
        handoffNextAction: expect.stringContaining('step_1'),
      },
    });

    expect(runTimeline.ingestDelegatedWorkerProgress.mock.calls.map(([event]) => event.kind)).toEqual([
      'started',
      'running',
      'failed',
    ]);
    expect(runTimeline.ingestDelegatedWorkerProgress.mock.calls[2]?.[0]).toMatchObject({
      id: expect.stringMatching(/^delegated-worker:job-[^:]+:failed$/),
      kind: 'failed',
      requestId: 'm-failed-delegated',
      detail: 'Delegated worker stopped before satisfying every required planned step.',
    });

    manager.shutdown();
  });

  it('fails repo-grounded delegated runs that complete without any repo evidence or tool results', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    workerMessageHandler = () => ({
      content: "I'll search the repo for the relevant files next.",
      metadata: {
        workerExecution: {
          lifecycle: 'completed',
          source: 'tool_loop',
          completionReason: 'answer_first_response',
          responseQuality: 'final',
          toolCallCount: 0,
          toolResultCount: 0,
          successfulToolResultCount: 0,
        },
      },
    });

    const intentRoutingTrace = {
      record: vi.fn(),
    };
    const runTimeline = {
      ingestDelegatedWorkerProgress: vi.fn(),
    };

    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        auditLog: { record: vi.fn() },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
      undefined,
      {
        intentRoutingTrace,
        runTimeline,
        now: () => 123_456,
      },
    );

    const result = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-repo-grounding-failed',
        userId: 'tester',
        principalId: 'tester',
        principalRole: 'owner',
        channel: 'web',
        content: 'Inspect the repo and tell me which files implement delegated worker progress.',
        metadata: repoGroundedCodingMetadata(),
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      toolContext: '',
      runtimeNotices: [],
      delegation: {
        requestId: 'm-repo-grounding-failed',
        originChannel: 'web',
      },
    });

    expect(result.content).toContain('Delegated work failed.');
    expect(result.content).toContain('Delegated worker did not return the exact file references requested after repo inspection.');

    expect(intentRoutingTrace.record.mock.calls.map(([entry]) => entry.stage)).toEqual([
      'delegated_worker_started',
      'delegated_worker_running',
      'recovery_advisor_started',
      'recovery_advisor_rejected',
      'delegated_worker_contract_reconciled',
      'delegated_claim_emitted',
      'delegated_verification_decided',
      'delegated_worker_failed',
    ]);
    const repoFailureTrace = intentRoutingTrace.record.mock.calls
      .map(([entry]) => entry)
      .find((entry) => entry.stage === 'delegated_worker_failed');
    expect(repoFailureTrace).toMatchObject({
      stage: 'delegated_worker_failed',
      requestId: 'm-repo-grounding-failed',
      details: {
        lifecycle: 'failed',
        reason: 'Delegated worker did not return the exact file references requested after repo inspection.',
        handoffSummary: 'Delegated worker did not return the exact file references requested after repo inspection.',
        handoffNextAction: expect.stringContaining('step_1'),
        workerExecutionCompletionReason: 'answer_first_response',
        workerExecutionToolCallCount: 0,
        workerExecutionToolResultCount: 0,
        workerExecutionSuccessfulToolResultCount: 0,
      },
    });
    expect(runTimeline.ingestDelegatedWorkerProgress.mock.calls[2]?.[0]).toMatchObject({
      kind: 'failed',
      requestId: 'm-repo-grounding-failed',
      detail: 'Delegated worker did not return the exact file references requested after repo inspection.',
    });

    manager.shutdown();
  });

  it('allows delegated direct general-assistant turns to complete without repo evidence even when a code session is visible', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    workerMessageHandler = () => ({
      content: 'GuardianAgent is a security-first AI assistant for daily use, guarded workstation operations, and coding workflows.',
      metadata: {
        workerExecution: {
          lifecycle: 'completed',
          source: 'tool_loop',
          completionReason: 'answer_first_response',
          responseQuality: 'final',
          toolCallCount: 0,
          toolResultCount: 0,
          successfulToolResultCount: 0,
        },
      },
    });

    const intentRoutingTrace = {
      record: vi.fn(),
    };
    const runTimeline = {
      ingestDelegatedWorkerProgress: vi.fn(),
    };

    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        auditLog: { record: vi.fn() },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
      undefined,
      {
        intentRoutingTrace,
        runTimeline,
        now: () => 123_556,
      },
    );

    const result = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-general-assistant-direct',
        userId: 'tester',
        principalId: 'tester',
        principalRole: 'owner',
        channel: 'web',
        content: 'In one sentence, what is this project?',
        metadata: generalAssistantDirectMetadata(),
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      toolContext: '',
      runtimeNotices: [],
      delegation: {
        requestId: 'm-general-assistant-direct',
        originChannel: 'web',
        codeSessionId: 'code-1',
        orchestration: {
          role: 'coordinator',
          label: 'Guardian Coordinator',
        },
      },
    });

    expect(result.content).toBe('GuardianAgent is a security-first AI assistant for daily use, guarded workstation operations, and coding workflows.');
    expect(result.content).not.toContain('Delegated work failed.');
    expect(intentRoutingTrace.record.mock.calls.map(([entry]) => entry.stage)).toEqual([
      'delegated_worker_started',
      'delegated_worker_running',
      'delegated_worker_contract_reconciled',
      'delegated_claim_emitted',
      'delegated_verification_decided',
      'delegated_worker_completed',
    ]);
    expect(intentRoutingTrace.record.mock.calls[0]?.[0]).toMatchObject({
      stage: 'delegated_worker_started',
      requestId: 'm-general-assistant-direct',
      details: {
        delegatedIntentRoute: 'general_assistant',
        delegatedIntentExecutionClass: 'direct_assistant',
        delegatedIntentRequiresRepoGrounding: false,
        delegatedIntentPreferredAnswerPath: 'direct',
      },
    });
    const generalAssistantCompletedTrace = intentRoutingTrace.record.mock.calls
      .map(([entry]) => entry)
      .find((entry) => entry.stage === 'delegated_worker_completed');
    expect(generalAssistantCompletedTrace).toMatchObject({
      stage: 'delegated_worker_completed',
      requestId: 'm-general-assistant-direct',
      details: {
        lifecycle: 'completed',
        workerExecutionCompletionReason: 'answer_first_response',
        workerExecutionToolCallCount: 0,
        workerExecutionToolResultCount: 0,
        workerExecutionSuccessfulToolResultCount: 0,
      },
    });
    expect(runTimeline.ingestDelegatedWorkerProgress.mock.calls.map(([event]) => event.kind)).toEqual([
      'started',
      'running',
      'completed',
    ]);

    manager.shutdown();
  });

  it('fails delegated worker results that omit the typed result envelope', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    workerMessageHandler = () => ({
      content: 'The delegated worker progress implementation lives in src/supervisor/worker-manager.ts.',
      metadata: {
        skipTestDelegatedEnvelope: true,
        workerExecution: {
          lifecycle: 'failed',
          source: 'tool_loop',
          completionReason: 'degraded_response',
          responseQuality: 'degraded',
          terminationReason: 'disconnect',
          toolCallCount: 0,
          toolResultCount: 0,
          successfulToolResultCount: 0,
        },
      },
    });

    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        auditLog: { record: vi.fn() },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
    );

    const result = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-missing-envelope',
        userId: 'tester',
        channel: 'web',
        content: 'Inspect this repo and tell me which files implement delegated worker progress and run timeline rendering. Do not edit anything.',
        metadata: repoGroundedCodingMetadata(),
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      additionalSections: [],
      toolContext: '',
      runtimeNotices: [],
      delegation: {
        requestId: 'm-missing-envelope',
        originChannel: 'web',
      },
    });

    expect(result.content).toContain('Delegated work failed.');
    expect(result.content).toContain('typed result envelope');

    manager.shutdown();
  });

  it('retries missing-envelope delegated runs when the worker shows partial progress and hits its budget', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    const dispatchProfiles: Array<string | undefined> = [];
    workerMessageHandler = (params) => {
      const executionProfile = params.executionProfile as { providerName?: string; providerTier?: string } | undefined;
      dispatchProfiles.push(executionProfile?.providerName);
      if (executionProfile?.providerTier === 'frontier') {
        return {
          content: 'The delegated worker completion contract is defined in src/runtime/execution/types.ts, src/runtime/execution/task-plan.ts, src/runtime/execution/verifier.ts, and src/runtime/execution/metadata.ts.',
          metadata: {
            workerExecution: {
              lifecycle: 'completed',
              source: 'tool_loop',
              completionReason: 'model_response',
              responseQuality: 'final',
              terminationReason: 'clean_exit',
              toolCallCount: 4,
              toolResultCount: 4,
              successfulToolResultCount: 4,
            },
          },
        };
      }
      return {
        content: 'I searched the repo and started reading the contract files, but I ran out of turns before I could finish the final grounded answer.',
        metadata: {
          skipTestDelegatedEnvelope: true,
          workerExecution: {
            lifecycle: 'failed',
            source: 'tool_loop',
            completionReason: 'degraded_response',
            responseQuality: 'degraded',
            terminationReason: 'max_rounds',
            roundCount: 30,
            toolCallCount: 2,
            toolResultCount: 1,
            successfulToolResultCount: 1,
          },
        },
      };
    };

    const intentRoutingTrace = {
      record: vi.fn(),
    };
    const runTimeline = {
      ingestDelegatedWorkerProgress: vi.fn(),
    };
    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
        listJobs: vi.fn(() => [
          {
            id: 'job-contract-search',
            toolName: 'fs_search',
            status: 'succeeded',
            requestId: 'm-missing-envelope-budget',
            argsPreview: '{"path":"src/runtime","pattern":"DelegatedResultEnvelope"}',
            resultPreview: '{"matches":["src/runtime/execution/types.ts"]}',
            createdAt: 10,
            startedAt: 20,
            completedAt: 30,
          },
          {
            id: 'job-contract-read',
            toolName: 'fs_read',
            status: 'running',
            requestId: 'm-missing-envelope-budget',
            argsPreview: '{"path":"src/runtime/execution/verifier.ts"}',
            createdAt: 40,
            startedAt: 50,
          },
        ]),
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        getConfigSnapshot: () => createExecutionProfileTestConfig(),
        auditLog: { record: vi.fn() },
        registry: {
          get: (agentId: string) => agentId === 'local'
            ? {
                agent: { name: 'Guardian Agent' },
                definition: {
                  orchestration: {
                    role: 'explorer',
                    label: 'Workspace Explorer',
                    lenses: ['coding-workspace'],
                  },
                },
              }
            : undefined,
        },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
      undefined,
      {
        intentRoutingTrace,
        runTimeline,
        now: () => 654_000,
      },
    );

    const result = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-missing-envelope-budget',
        userId: 'tester',
        channel: 'web',
        content: 'Inspect this repo and tell me which files and functions or types now define the delegated worker completion contract. Cite exact file names and symbol names.',
        metadata: attachPreRoutedIntentGatewayMetadata(undefined, {
          mode: 'primary',
          available: true,
          model: 'test-model',
          latencyMs: 1,
          decision: {
            route: 'coding_task',
            confidence: 'high',
            operation: 'inspect',
            summary: 'Inspect the repo and identify the delegated worker completion contract files and symbols.',
            turnRelation: 'new_request',
            resolution: 'ready',
            missingFields: [],
            executionClass: 'repo_grounded',
            preferredTier: 'external',
            requiresRepoGrounding: true,
            requiresToolSynthesis: true,
            requireExactFileReferences: true,
            expectedContextPressure: 'high',
            preferredAnswerPath: 'chat_synthesis',
            plannedSteps: [
              { kind: 'search', summary: 'Search the repo for the delegated worker completion contract files.', required: true },
              { kind: 'answer', summary: 'Answer with exact file names and symbol names grounded in the repo evidence.', required: true, dependsOn: ['step_1'] },
            ],
            entities: {},
          },
        }),
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      additionalSections: [],
      toolContext: '',
      runtimeNotices: [],
      executionProfile: {
        id: 'managed_cloud_tool',
        providerName: 'ollama-cloud-coding',
        providerType: 'ollama_cloud',
        providerModel: 'qwen3-coder-next',
        providerLocality: 'external',
        providerTier: 'managed_cloud',
        requestedTier: 'external',
        preferredAnswerPath: 'tool_loop',
        expectedContextPressure: 'high',
        contextBudget: 32_000,
        toolContextMode: 'tight',
        maxAdditionalSections: 2,
        maxRuntimeNotices: 2,
        fallbackProviderOrder: ['ollama-cloud-coding', 'openai-frontier'],
        reason: 'delegated coding role selected managed-cloud coding profile',
        routingMode: 'auto',
        selectionSource: 'delegated_role',
      },
      delegation: {
        requestId: 'm-missing-envelope-budget',
        executionId: 'exec-missing-envelope-budget',
        rootExecutionId: 'exec-missing-envelope-root',
        originChannel: 'web',
        orchestration: {
          role: 'explorer',
          label: 'Workspace Explorer',
          lenses: ['coding-workspace'],
        },
      },
    });

    expect(dispatchProfiles).toEqual(['ollama-cloud-coding', 'openai-frontier']);
    expect(result.content).toContain('src/runtime/execution/types.ts');
    expect(result.content).toContain('src/runtime/execution/verifier.ts');
    expect(result.content).not.toContain('Delegated work failed.');
    expect(intentRoutingTrace.record.mock.calls.map(([entry]) => entry.stage)).toEqual([
      'delegated_worker_started',
      'delegated_worker_running',
      'delegated_job_wait_expired',
      'delegated_worker_retrying',
      'delegated_job_wait_expired',
      'delegated_worker_contract_reconciled',
      'delegated_claim_emitted',
      'delegated_verification_decided',
      'delegated_worker_completed',
    ]);

    manager.shutdown();
  });

  it('recovers worker dispatch budget aborts into verified incomplete delegated results when tool evidence exists', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    const abortController = new AbortController();
    workerMessageHandler = () => {
      setTimeout(() => abortController.abort(new Error('budget elapsed')), 0);
      return new Promise(() => undefined);
    };

    const intentRoutingTrace = {
      record: vi.fn(),
    };
    const runTimeline = {
      ingestDelegatedWorkerProgress: vi.fn(),
      ingestExecutionGraphEvent: vi.fn(),
    };
    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
        listJobs: vi.fn(() => [
          {
            id: 'job-app-package',
            toolName: 'fs_write',
            status: 'succeeded',
            requestId: 'm-app-build-timeout',
            argsPreview: '{"path":"package.json"}',
            resultPreview: '{"path":"package.json","bytesWritten":260}',
            createdAt: 10,
            startedAt: 20,
            completedAt: 30,
          },
        ]),
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        getConfigSnapshot: () => createExecutionProfileTestConfig(),
        auditLog: { record: vi.fn() },
        registry: {
          get: (agentId: string) => agentId === 'local'
            ? {
                agent: { name: 'Guardian Agent' },
                definition: {
                  orchestration: {
                    role: 'implementer',
                    label: 'Workspace Implementer',
                    lenses: ['coding-workspace'],
                  },
                },
              }
            : undefined,
        },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
      undefined,
      {
        intentRoutingTrace,
        runTimeline,
        now: () => 777_000,
      },
    );

    const result = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-app-build-timeout',
        userId: 'tester',
        channel: 'web',
        content: 'Build a simple music app from scratch in the attached repo and verify it runs locally.',
        metadata: attachPreRoutedIntentGatewayMetadata(undefined, {
          mode: 'primary',
          available: true,
          model: 'test-model',
          latencyMs: 1,
          decision: {
            route: 'coding_task',
            confidence: 'high',
            operation: 'create',
            summary: 'Build and verify a simple local music app.',
            turnRelation: 'new_request',
            resolution: 'ready',
            missingFields: [],
            executionClass: 'repo_grounded',
            preferredTier: 'external',
            requiresRepoGrounding: true,
            requiresToolSynthesis: true,
            expectedContextPressure: 'high',
            preferredAnswerPath: 'tool_loop',
            plannedSteps: [
              { kind: 'write', summary: 'Create the app files.', expectedToolCategories: ['fs_write'], required: true },
              { kind: 'tool_call', summary: 'Run or otherwise verify the app locally.', expectedToolCategories: ['runtime_evidence'], required: true, dependsOn: ['step_1'] },
              { kind: 'answer', summary: 'Tell the user the local URL and what was verified.', required: true, dependsOn: ['step_2'] },
            ],
            entities: {},
          },
        }),
        abortSignal: abortController.signal,
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      additionalSections: [],
      toolContext: '',
      runtimeNotices: [],
      executionProfile: {
        id: 'openai_frontier',
        providerName: 'openai',
        providerType: 'openai',
        providerModel: 'gpt-4o',
        providerLocality: 'external',
        providerTier: 'frontier',
        requestedTier: 'external',
        preferredAnswerPath: 'tool_loop',
        expectedContextPressure: 'high',
        contextBudget: 128_000,
        toolContextMode: 'tight',
        maxAdditionalSections: 2,
        maxRuntimeNotices: 2,
        fallbackProviderOrder: [],
        reason: 'delegated coding role selected frontier profile',
        routingMode: 'auto',
        selectionSource: 'delegated_role',
      },
      delegation: {
        requestId: 'm-app-build-timeout',
        executionId: 'exec-app-build-timeout',
        rootExecutionId: 'exec-app-build-root',
        originChannel: 'web',
        originSurfaceId: 'web-guardian-chat',
        codeSessionId: 'music-session',
        orchestration: {
          role: 'implementer',
          label: 'Workspace Implementer',
          lenses: ['coding-workspace'],
        },
      },
    });

    expect(result.content).toContain('Delegated work failed.');
    expect(result.content).toContain('Delegated worker ran out of turns before satisfying every required step.');
    expect(result.content).not.toContain('Worker message dispatch canceled');
    expect(result.metadata?.delegatedSufficiencyFailure).toMatchObject({
      decision: 'insufficient',
    });
    expect(result.metadata?.responseSource).toMatchObject({
      providerName: 'openai',
      providerTier: 'frontier',
    });
    expect(intentRoutingTrace.record.mock.calls.map(([entry]) => entry.stage)).toEqual(expect.arrayContaining([
      'delegated_worker_started',
      'delegated_worker_running',
      'delegated_worker_retrying',
      'delegated_worker_contract_reconciled',
      'delegated_verification_decided',
      'delegated_worker_failed',
    ]));
    expect(runTimeline.ingestDelegatedWorkerProgress.mock.calls.map(([event]) => event.kind)).toEqual([
      'started',
      'running',
      'running',
      'failed',
    ]);

    manager.shutdown();
  });

  it('recovers delegated retry dispatch timeouts into verified delegated failures', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(777_000);
    const { WorkerManager } = await import('./worker-manager.js');

    let manager: InstanceType<typeof WorkerManager> | undefined;
    try {
      let dispatchCount = 0;
      workerMessageHandler = () => {
        dispatchCount += 1;
        if (dispatchCount === 1) {
          return {
            content: 'I need to continue implementing and verifying the app.',
            metadata: {
              workerExecution: {
                lifecycle: 'failed',
                source: 'tool_loop',
                completionReason: 'intermediate_response',
                responseQuality: 'intermediate',
                terminationReason: 'max_rounds',
                roundCount: 3,
                toolCallCount: 0,
                toolResultCount: 0,
                successfulToolResultCount: 0,
              },
            },
          };
        }
        return new Promise(() => undefined);
      };

      const intentRoutingTrace = {
        record: vi.fn(),
      };
      manager = new WorkerManager(
        {
          listAlwaysLoadedDefinitions: () => [],
          listJobs: vi.fn(() => []),
        } as never,
        {
          getFallbackProviderConfig: () => undefined,
          getConfigSnapshot: () => createExecutionProfileTestConfig(),
          auditLog: { record: vi.fn() },
          registry: {
            get: (agentId: string) => agentId === 'local'
              ? {
                  agent: { name: 'Guardian Agent' },
                  definition: {
                    orchestration: {
                      role: 'implementer',
                      label: 'Workspace Implementer',
                      lenses: ['coding-workspace'],
                    },
                  },
                }
              : undefined,
          },
        } as never,
        {
          workerEntryPoint: 'src/worker/worker-entry.ts',
          workerMaxMemoryMb: 2048,
          workerIdleTimeoutMs: 300_000,
          workerShutdownGracePeriodMs: 10,
          capabilityTokenTtlMs: 600_000,
          capabilityTokenMaxToolCalls: 0,
        } as never,
        undefined,
        {
          intentRoutingTrace,
          now: () => Date.now(),
        },
      );

      const resultPromise = manager.handleMessage({
        sessionId: 'tester:web',
        agentId: 'local',
        userId: 'tester',
        grantedCapabilities: [],
        message: {
          id: 'm-app-build-retry-timeout',
          userId: 'tester',
          channel: 'web',
          content: 'Build a simple music app from scratch in the attached repo and verify it runs locally.',
          metadata: attachPreRoutedIntentGatewayMetadata(undefined, {
            mode: 'primary',
            available: true,
            model: 'test-model',
            latencyMs: 1,
            decision: {
              route: 'coding_task',
              confidence: 'high',
              operation: 'create',
              summary: 'Build and verify a simple local music app.',
              turnRelation: 'new_request',
              resolution: 'ready',
              missingFields: [],
              executionClass: 'repo_grounded',
              preferredTier: 'external',
              requiresRepoGrounding: true,
              requiresToolSynthesis: true,
              expectedContextPressure: 'high',
              preferredAnswerPath: 'tool_loop',
              plannedSteps: [
                { kind: 'write', summary: 'Create the app files.', expectedToolCategories: ['repo_mutation'], required: true },
                { kind: 'tool_call', summary: 'Run or otherwise verify the app locally.', expectedToolCategories: ['runtime_evidence'], required: true, dependsOn: ['step_1'] },
                { kind: 'answer', summary: 'Tell the user the local URL and what was verified.', required: true, dependsOn: ['step_2'] },
              ],
              entities: {},
            },
          }),
          timestamp: Date.now(),
        },
        systemPrompt: 'system',
        history: [],
        knowledgeBases: [],
        activeSkills: [],
        additionalSections: [],
        toolContext: '',
        runtimeNotices: [],
        executionProfile: {
          id: 'managed_cloud_tool',
          providerName: 'ollama-cloud-coding',
          providerType: 'ollama_cloud',
          providerModel: 'glm-5.1',
          providerLocality: 'external',
          providerTier: 'managed_cloud',
          requestedTier: 'external',
          preferredAnswerPath: 'tool_loop',
          expectedContextPressure: 'high',
          contextBudget: 32_000,
          toolContextMode: 'tight',
          maxAdditionalSections: 2,
          maxRuntimeNotices: 2,
          fallbackProviderOrder: ['ollama-cloud-coding', 'openai-frontier'],
          reason: 'delegated coding role selected managed-cloud coding profile',
          routingMode: 'auto',
          selectionSource: 'delegated_role',
        },
        delegation: {
          requestId: 'm-app-build-retry-timeout',
          executionId: 'exec-app-build-retry-timeout',
          rootExecutionId: 'exec-app-build-retry-timeout-root',
          originChannel: 'web',
          originSurfaceId: 'web-guardian-chat',
          codeSessionId: 'music-session',
          orchestration: {
            role: 'implementer',
            label: 'Workspace Implementer',
            lenses: ['coding-workspace'],
          },
        },
      });

      await vi.advanceTimersByTimeAsync(330_000);
      const result = await resultPromise;

      expect(dispatchCount).toBeGreaterThanOrEqual(2);
      expect(result.content).toContain('Delegated work failed.');
      expect(result.content).not.toContain('exceeded budget timeout');
      expect(result.metadata?.delegatedSufficiencyFailure).toMatchObject({
        decision: expect.stringMatching(/insufficient|contradicted/),
      });
      expect(intentRoutingTrace.record.mock.calls.map(([entry]) => entry.stage)).toEqual(expect.arrayContaining([
        'delegated_worker_retrying',
        'delegated_worker_failed',
      ]));
      expect(intentRoutingTrace.record.mock.calls.map(([entry]) => entry.stage)).not.toContain('recovery_advisor_started');
    } finally {
      manager?.shutdown();
      vi.useRealTimers();
    }
  });

  it('runs delegated runtime-evidence recovery locally when a dependency-free app missed runtime proof', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    const workspaceRoot = resolve(mkdtempSync(join(tmpdir(), 'ga-runtime-recovery-')));
    const requestId = 'm-runtime-recovery-local';
    let runtimeProofRecorded = false;
    let manager: InstanceType<typeof WorkerManager> | undefined;
    try {
      writeFileSync(join(workspaceRoot, 'server.js'), [
        'const http = require(\'http\');',
        'http.createServer((_, res) => res.end(\'ok\')).listen(3000);',
        '',
      ].join('\n'));

      const decision: IntentGatewayDecision = {
        route: 'coding_task',
        confidence: 'high',
        operation: 'create',
        summary: 'Build and verify a simple local music app.',
        turnRelation: 'new_request',
        resolution: 'ready',
        missingFields: [],
        executionClass: 'repo_grounded',
        preferredTier: 'external',
        requiresRepoGrounding: true,
        requiresToolSynthesis: true,
        expectedContextPressure: 'high',
        preferredAnswerPath: 'tool_loop',
        plannedSteps: [
          { kind: 'write', summary: 'Create the app files.', expectedToolCategories: ['repo_mutation'], required: true },
          { kind: 'tool_call', summary: 'Run or otherwise verify the app locally.', expectedToolCategories: ['runtime_evidence'], required: true, dependsOn: ['step_1'] },
          { kind: 'answer', summary: 'Tell the user the local URL and what was verified.', required: true, dependsOn: ['step_2'] },
        ],
        entities: {},
      };
      const taskContract = buildDelegatedTaskContract(decision);
      const workerAnswer = 'Created a dependency-free Node music app at http://localhost:3000.';
      workerMessageHandler = () => {
        const writeReceipt = {
          receiptId: 'receipt-write-server',
          sourceType: 'tool_call' as const,
          toolName: 'fs_write',
          status: 'succeeded' as const,
          refs: [join(workspaceRoot, 'server.js')],
          summary: 'Wrote server.js.',
          startedAt: 1,
          endedAt: 2,
        };
        const answerReceipt = {
          receiptId: 'receipt-answer',
          sourceType: 'model_answer' as const,
          status: 'succeeded' as const,
          refs: [] as string[],
          summary: workerAnswer,
          startedAt: 3,
          endedAt: 3,
        };
        const toolReceiptStepIds = new Map<string, string>([
          [writeReceipt.receiptId, 'step_1'],
          [answerReceipt.receiptId, 'step_3'],
        ]);
        const evidenceReceipts = [writeReceipt, answerReceipt];
        const stepReceipts = buildStepReceipts({
          plannedTask: taskContract.plan,
          evidenceReceipts,
          toolReceiptStepIds,
          finalAnswerReceiptId: answerReceipt.receiptId,
          interruptions: [],
        });
        const runStatus = computeWorkerRunStatus(taskContract.plan, stepReceipts, [], 'end_turn');
        return {
          content: workerAnswer,
          metadata: buildDelegatedExecutionMetadata({
            taskContract,
            runStatus,
            stopReason: 'end_turn',
            stepReceipts,
            finalUserAnswer: workerAnswer,
            operatorSummary: workerAnswer,
            claims: [],
            evidenceReceipts,
            interruptions: [],
            artifacts: [],
            events: [],
          }),
        };
      };

      const jobs = [
        {
          id: 'job-write-server',
          toolName: 'fs_write',
          status: 'succeeded',
          requestId,
          argsPreview: JSON.stringify({ path: join(workspaceRoot, 'server.js') }),
          resultPreview: JSON.stringify({ path: join(workspaceRoot, 'server.js'), bytesWritten: 80 }),
          createdAt: 1,
          startedAt: 1,
          completedAt: 2,
        },
      ];
      const runTool = vi.fn(async (request) => {
        runtimeProofRecorded = true;
        jobs.push({
          id: 'job-runtime-check',
          toolName: 'code_build',
          status: 'succeeded',
          requestId,
          argsPreview: JSON.stringify(request.args),
          resultPreview: JSON.stringify({
            success: true,
            verificationStatus: 'verified',
            verificationEvidence: 'Local build check passed.',
          }),
          createdAt: 4,
          startedAt: 4,
          completedAt: 5,
        });
        return {
          success: true,
          message: 'Local build check passed.',
          verificationStatus: 'verified',
        };
      });
      const intentRoutingTrace = { record: vi.fn() };
      manager = new WorkerManager(
        {
          listAlwaysLoadedDefinitions: () => [],
          listJobs: vi.fn(() => runtimeProofRecorded ? jobs : jobs.slice(0, 1)),
          runTool,
        } as never,
        {
          getFallbackProviderConfig: () => undefined,
          getConfigSnapshot: () => createExecutionProfileTestConfig(),
          auditLog: { record: vi.fn() },
          registry: {
            get: (agentId: string) => agentId === 'local'
              ? {
                  agent: { name: 'Guardian Agent' },
                  definition: {
                    orchestration: {
                      role: 'implementer',
                      label: 'Workspace Implementer',
                      lenses: ['coding-workspace'],
                    },
                  },
                }
              : undefined,
          },
        } as never,
        {
          workerEntryPoint: 'src/worker/worker-entry.ts',
          workerMaxMemoryMb: 2048,
          workerIdleTimeoutMs: 300_000,
          workerShutdownGracePeriodMs: 10,
          capabilityTokenTtlMs: 600_000,
          capabilityTokenMaxToolCalls: 0,
        } as never,
        undefined,
        {
          intentRoutingTrace,
          now: () => 777_300,
        },
      );

      const result = await manager.handleMessage({
        sessionId: 'tester:web',
        agentId: 'local',
        userId: 'tester',
        grantedCapabilities: [],
        message: {
          id: requestId,
          userId: 'tester',
          channel: 'web',
          content: 'Build a simple music app from scratch in the attached repo and verify it runs locally.',
          metadata: attachPreRoutedIntentGatewayMetadata({
            codeContext: {
              workspaceRoot,
              sessionId: 'music-session',
            },
          }, {
            mode: 'primary',
            available: true,
            model: 'test-model',
            latencyMs: 1,
            decision,
          }),
          timestamp: Date.now(),
        },
        systemPrompt: 'system',
        history: [],
        knowledgeBases: [],
        activeSkills: [],
        additionalSections: [],
        toolContext: '',
        runtimeNotices: [],
        executionProfile: {
          id: 'managed_cloud_tool',
          providerName: 'ollama-cloud-coding',
          providerType: 'ollama_cloud',
          providerModel: 'glm-5.1',
          providerLocality: 'external',
          providerTier: 'managed_cloud',
          requestedTier: 'external',
          preferredAnswerPath: 'tool_loop',
          expectedContextPressure: 'high',
          contextBudget: 32_000,
          toolContextMode: 'tight',
          maxAdditionalSections: 2,
          maxRuntimeNotices: 2,
          fallbackProviderOrder: ['ollama-cloud-coding', 'openai-frontier'],
          reason: 'delegated coding role selected managed-cloud coding profile',
          routingMode: 'auto',
          selectionSource: 'delegated_role',
        },
        delegation: {
          requestId,
          executionId: 'exec-runtime-recovery-local',
          rootExecutionId: 'exec-runtime-recovery-root',
          originChannel: 'web',
          originSurfaceId: 'web-guardian-chat',
          codeSessionId: 'music-session',
          orchestration: {
            role: 'implementer',
            label: 'Workspace Implementer',
            lenses: ['coding-workspace'],
          },
        },
      });

      expect(runTool).toHaveBeenCalledWith(expect.objectContaining({
        toolName: 'code_build',
        args: {
          cwd: workspaceRoot,
          command: 'node --check server.js',
          timeoutMs: 30_000,
          isolation: 'local',
        },
        codeContext: {
          workspaceRoot,
          sessionId: 'music-session',
        },
      }));
      expect(result.content).not.toContain('Delegated work failed.');
      expect(readDelegatedResultEnvelope(result.metadata)?.verification).toMatchObject({
        decision: 'satisfied',
      });
      expect(intentRoutingTrace.record.mock.calls.map(([entry]) => entry.stage)).toEqual(expect.arrayContaining([
        'delegated_worker_retrying',
        'delegated_worker_completed',
      ]));
    } finally {
      manager?.shutdown();
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('diagnoses partial static apps and runs static runtime recovery after retry fills missing assets', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    const workspaceRoot = resolve(mkdtempSync(join(tmpdir(), 'ga-static-runtime-recovery-')));
    const requestId = 'm-static-runtime-recovery';
    let manager: InstanceType<typeof WorkerManager> | undefined;
    let dispatchCount = 0;
    let retryDiagnostic = '';
    let runtimeCommand = '';
    let runtimeProofRecorded = false;
    try {
      const decision: IntentGatewayDecision = {
        route: 'coding_task',
        confidence: 'high',
        operation: 'create',
        summary: 'Build and verify a simple local music app.',
        turnRelation: 'new_request',
        resolution: 'ready',
        missingFields: [],
        executionClass: 'repo_grounded',
        preferredTier: 'external',
        requiresRepoGrounding: true,
        requiresToolSynthesis: true,
        expectedContextPressure: 'high',
        preferredAnswerPath: 'tool_loop',
        plannedSteps: [
          { kind: 'write', summary: 'Create the app files.', expectedToolCategories: ['repo_mutation'], required: true },
          { kind: 'tool_call', summary: 'Run or otherwise verify the app locally.', expectedToolCategories: ['runtime_evidence'], required: true, dependsOn: ['step_1'] },
          { kind: 'answer', summary: 'Tell the user the local URL and what was verified.', required: true, dependsOn: ['step_2'] },
        ],
        entities: {},
      };
      const taskContract = buildDelegatedTaskContract(decision);
      const buildResponse = (
        content: string,
        evidenceReceipts: ReturnType<typeof readDelegatedResultEnvelope> extends infer _T
          ? Array<{
              receiptId: string;
              sourceType: 'tool_call';
              toolName: string;
              status: 'succeeded';
              refs: string[];
              summary: string;
              startedAt: number;
              endedAt: number;
            }>
          : never,
      ) => {
        const answerReceipt = {
          receiptId: `receipt-answer-${dispatchCount}`,
          sourceType: 'model_answer' as const,
          status: 'succeeded' as const,
          refs: [] as string[],
          summary: content,
          startedAt: 10 + dispatchCount,
          endedAt: 10 + dispatchCount,
        };
        const toolReceiptStepIds = new Map<string, string>();
        for (const receipt of evidenceReceipts) {
          toolReceiptStepIds.set(receipt.receiptId, 'step_1');
        }
        toolReceiptStepIds.set(answerReceipt.receiptId, 'step_3');
        const allReceipts = [...evidenceReceipts, answerReceipt];
        const stepReceipts = buildStepReceipts({
          plannedTask: taskContract.plan,
          evidenceReceipts: allReceipts,
          toolReceiptStepIds,
          finalAnswerReceiptId: answerReceipt.receiptId,
          interruptions: [],
        });
        return {
          content,
          metadata: buildDelegatedExecutionMetadata({
            taskContract,
            runStatus: computeWorkerRunStatus(taskContract.plan, stepReceipts, [], 'end_turn'),
            stopReason: 'end_turn',
            stepReceipts,
            operatorSummary: content,
            finalUserAnswer: content,
            claims: [],
            evidenceReceipts: allReceipts,
            interruptions: [],
            artifacts: [],
            events: [],
          }),
        };
      };

      workerMessageHandler = (params) => {
        dispatchCount += 1;
        if (dispatchCount === 1) {
          writeFileSync(join(workspaceRoot, 'index.html'), [
            '<!doctype html>',
            '<html>',
            '<head><link rel="stylesheet" href="styles.css"></head>',
            '<body><main id="app"><h1>SoundWave</h1><div id="song-list"></div></main><script src="app.js"></script></body>',
            '</html>',
            '',
          ].join('\n'));
          writeFileSync(join(workspaceRoot, 'styles.css'), 'body { font-family: sans-serif; }\n');
          return buildResponse('Created index.html and styles.css; app.js and runtime verification remain.', [
            {
              receiptId: 'receipt-write-index',
              sourceType: 'tool_call',
              toolName: 'fs_write',
              status: 'succeeded',
              refs: [join(workspaceRoot, 'index.html')],
              summary: 'Wrote index.html.',
              startedAt: 1,
              endedAt: 2,
            },
            {
              receiptId: 'receipt-write-css',
              sourceType: 'tool_call',
              toolName: 'fs_write',
              status: 'succeeded',
              refs: [join(workspaceRoot, 'styles.css')],
              summary: 'Wrote styles.css.',
              startedAt: 3,
              endedAt: 4,
            },
          ]);
        }

        const sections = Array.isArray(params.additionalSections)
          ? params.additionalSections as Array<{ section?: string; content?: string }>
          : [];
        retryDiagnostic = sections.find((section) => section.section === 'Runtime Evidence Workspace Check')?.content ?? '';
        writeFileSync(join(workspaceRoot, 'app.js'), [
          'const songs = [{ title: "Midnight Drive", artist: "Ari Lane" }];',
          'document.getElementById("song-list").textContent = songs.map((song) => `${song.title} - ${song.artist}`).join("\\n");',
          '',
        ].join('\n'));
        return buildResponse('Created the missing app.js and the app is ready for local static runtime verification.', [
          {
            receiptId: 'receipt-write-app',
            sourceType: 'tool_call',
            toolName: 'fs_write',
            status: 'succeeded',
            refs: [join(workspaceRoot, 'app.js')],
            summary: 'Wrote app.js.',
            startedAt: 20,
            endedAt: 21,
          },
        ]);
      };

      const jobs: Array<{
        id: string;
        toolName: string;
        status: string;
        requestId: string;
        argsPreview?: string;
        resultPreview?: string;
        createdAt: number;
        startedAt: number;
        completedAt: number;
      }> = [];
      const runTool = vi.fn(async (request) => {
        const args = request.args as { command?: string };
        runtimeCommand = args.command ?? '';
        const runtimeScript = runtimeCommand.replace(/^node\s+/u, '');
        expect(runtimeScript).toMatch(/^\.guardian-runtime-check-[a-f0-9-]+\.mjs$/u);
        expect(existsSync(join(workspaceRoot, runtimeScript))).toBe(true);
        runtimeProofRecorded = true;
        jobs.push({
          id: 'job-static-runtime-check',
          toolName: 'code_build',
          status: 'succeeded',
          requestId,
          argsPreview: JSON.stringify(request.args),
          resultPreview: JSON.stringify({
            success: true,
            output: { stdout: 'Static app runtime check passed at http://127.0.0.1:41001/ with 2 linked asset(s).' },
            verificationStatus: 'verified',
          }),
          createdAt: 30,
          startedAt: 30,
          completedAt: 31,
        });
        return {
          success: true,
          message: 'Static app runtime check passed at http://127.0.0.1:41001/ with 2 linked asset(s).',
          verificationStatus: 'verified',
        };
      });
      const intentRoutingTrace = { record: vi.fn() };
      manager = new WorkerManager(
        {
          listAlwaysLoadedDefinitions: () => [],
          listJobs: vi.fn(() => runtimeProofRecorded ? jobs : []),
          runTool,
        } as never,
        {
          getFallbackProviderConfig: () => undefined,
          getConfigSnapshot: () => createExecutionProfileTestConfig(),
          auditLog: { record: vi.fn() },
          registry: {
            get: (agentId: string) => agentId === 'local'
              ? {
                  agent: { name: 'Guardian Agent' },
                  definition: {
                    orchestration: {
                      role: 'implementer',
                      label: 'Workspace Implementer',
                      lenses: ['coding-workspace'],
                    },
                  },
                }
              : undefined,
          },
        } as never,
        {
          workerEntryPoint: 'src/worker/worker-entry.ts',
          workerMaxMemoryMb: 2048,
          workerIdleTimeoutMs: 300_000,
          workerShutdownGracePeriodMs: 10,
          capabilityTokenTtlMs: 600_000,
          capabilityTokenMaxToolCalls: 0,
        } as never,
        undefined,
        {
          intentRoutingTrace,
          now: () => 778_000,
        },
      );

      const result = await manager.handleMessage({
        sessionId: 'tester:web',
        agentId: 'local',
        userId: 'tester',
        grantedCapabilities: [],
        message: {
          id: requestId,
          userId: 'tester',
          channel: 'web',
          content: 'Build a simple music app from scratch in the attached repo and verify it runs locally.',
          metadata: attachPreRoutedIntentGatewayMetadata({
            codeContext: {
              workspaceRoot,
              sessionId: 'music-session',
            },
          }, {
            mode: 'primary',
            available: true,
            model: 'test-model',
            latencyMs: 1,
            decision,
          }),
          timestamp: Date.now(),
        },
        systemPrompt: 'system',
        history: [],
        knowledgeBases: [],
        activeSkills: [],
        additionalSections: [],
        toolContext: '',
        runtimeNotices: [],
        executionProfile: {
          id: 'managed_cloud_tool',
          providerName: 'ollama-cloud-coding',
          providerType: 'ollama_cloud',
          providerModel: 'glm-5.1',
          providerLocality: 'external',
          providerTier: 'managed_cloud',
          requestedTier: 'external',
          preferredAnswerPath: 'tool_loop',
          expectedContextPressure: 'high',
          contextBudget: 32_000,
          toolContextMode: 'tight',
          maxAdditionalSections: 2,
          maxRuntimeNotices: 2,
          fallbackProviderOrder: ['ollama-cloud-coding', 'openai-frontier'],
          reason: 'delegated coding role selected managed-cloud coding profile',
          routingMode: 'auto',
          selectionSource: 'delegated_role',
        },
        delegation: {
          requestId,
          executionId: 'exec-static-runtime-recovery',
          rootExecutionId: 'exec-static-runtime-recovery-root',
          originChannel: 'web',
          originSurfaceId: 'web-guardian-chat',
          codeSessionId: 'music-session',
          orchestration: {
            role: 'implementer',
            label: 'Workspace Implementer',
            lenses: ['coding-workspace'],
          },
        },
      });

      expect(dispatchCount).toBe(2);
      expect(retryDiagnostic).toContain('Missing linked assets that must be created before runtime proof: app.js.');
      expect(retryDiagnostic).toContain('No server.js entrypoint was found.');
      expect(runTool).toHaveBeenCalledWith(expect.objectContaining({
        toolName: 'code_build',
        args: expect.objectContaining({
          cwd: workspaceRoot,
          command: expect.stringMatching(/^node \.guardian-runtime-check-[a-f0-9-]+\.mjs$/u),
          isolation: 'local',
        }),
      }));
      expect(existsSync(join(workspaceRoot, runtimeCommand.replace(/^node\s+/u, '')))).toBe(false);
      expect(result.content).not.toContain('Delegated work failed.');
      expect(result.content).toContain('Verified: Static app runtime check passed');
      expect(readDelegatedResultEnvelope(result.metadata)?.verification).toMatchObject({
        decision: 'satisfied',
      });
      expect(intentRoutingTrace.record.mock.calls.map(([entry]) => entry.stage)).toEqual(expect.arrayContaining([
        'delegated_worker_retrying',
        'delegated_worker_completed',
      ]));
    } finally {
      manager?.shutdown();
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('uses supervisor static-app completion before delegated retry when missing assets are deterministic', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    const workspaceRoot = resolve(mkdtempSync(join(tmpdir(), 'ga-static-second-retry-')));
    const publicRoot = join(workspaceRoot, 'public');
    const requestId = 'm-static-second-retry';
    let manager: InstanceType<typeof WorkerManager> | undefined;
    let dispatchCount = 0;
    let runtimeProofRecorded = false;
    try {
      const decision: IntentGatewayDecision = {
        route: 'coding_task',
        confidence: 'high',
        operation: 'create',
        summary: 'Build and verify a simple local music app.',
        turnRelation: 'new_request',
        resolution: 'ready',
        missingFields: [],
        executionClass: 'repo_grounded',
        preferredTier: 'external',
        requiresRepoGrounding: true,
        requiresToolSynthesis: true,
        expectedContextPressure: 'high',
        preferredAnswerPath: 'tool_loop',
        plannedSteps: [
          { kind: 'write', summary: 'Create the app files.', expectedToolCategories: ['repo_mutation'], required: true },
          { kind: 'tool_call', summary: 'Run or otherwise verify the app locally.', expectedToolCategories: ['runtime_evidence'], required: true, dependsOn: ['step_1'] },
          { kind: 'answer', summary: 'Tell the user the local URL and what was verified.', required: true, dependsOn: ['step_2'] },
        ],
        entities: {},
      };
      const taskContract = buildDelegatedTaskContract(decision);
      const responseWithReceipts = (
        content: string,
        receipts: DelegatedResultEnvelope['evidenceReceipts'],
      ) => {
        const answerReceipt = {
          receiptId: `receipt-answer-${dispatchCount}`,
          sourceType: 'model_answer' as const,
          status: 'succeeded' as const,
          refs: [] as string[],
          summary: content,
          startedAt: 100 + dispatchCount,
          endedAt: 100 + dispatchCount,
        };
        const toolReceiptStepIds = new Map<string, string>();
        for (const receipt of receipts) {
          const matched = matchPlannedStepForTool({
            plannedTask: taskContract.plan,
            toolName: receipt.toolName ?? 'tool_call',
            args: { path: receipt.refs[0] },
            previouslyMatchedStepIds: new Set(toolReceiptStepIds.values()),
          });
          if (matched) toolReceiptStepIds.set(receipt.receiptId, matched);
        }
        toolReceiptStepIds.set(answerReceipt.receiptId, 'step_3');
        const evidenceReceipts = [...receipts, answerReceipt];
        const stepReceipts = buildStepReceipts({
          plannedTask: taskContract.plan,
          evidenceReceipts,
          toolReceiptStepIds,
          finalAnswerReceiptId: answerReceipt.receiptId,
          interruptions: [],
        });
        return {
          content,
          metadata: buildDelegatedExecutionMetadata({
            taskContract,
            runStatus: computeWorkerRunStatus(taskContract.plan, stepReceipts, [], 'end_turn'),
            stopReason: 'end_turn',
            stepReceipts,
            operatorSummary: content,
            finalUserAnswer: content,
            claims: [],
            evidenceReceipts,
            interruptions: [],
            artifacts: [],
            events: [],
          }),
        };
      };

      const jobs: Array<{
        id: string;
        toolName: string;
        status: string;
        requestId: string;
        argsPreview?: string;
        resultPreview?: string;
        createdAt: number;
        startedAt: number;
        completedAt: number;
      }> = [];
      workerMessageHandler = (params) => {
        dispatchCount += 1;
        if (dispatchCount === 1) {
          mkdirSync(publicRoot, { recursive: true });
          writeFileSync(join(workspaceRoot, 'package.json'), JSON.stringify({
            scripts: {
              verify: 'node verify.js',
            },
          }, null, 2));
          writeFileSync(join(workspaceRoot, 'verify.js'), [
            'const { existsSync } = require("node:fs");',
            'const required = ["public/index.html", "public/styles.css", "public/app.js"];',
            'const missing = required.filter((file) => !existsSync(file));',
            'if (missing.length) {',
            '  console.error(`MISSING: ${missing.join(", ")}`);',
            '  process.exit(1);',
            '}',
            'console.log("Verify passed.");',
            '',
          ].join('\n'));
          writeFileSync(join(publicRoot, 'index.html'), [
            '<!doctype html>',
            '<html><head><link rel="stylesheet" href="styles.css"></head>',
            '<body><div id="song-list"></div><button id="btn-play">Play</button><script src="app.js"></script></body></html>',
            '',
          ].join('\n'));
          writeFileSync(join(publicRoot, 'styles.css'), 'body { font-family: sans-serif; }\n');
          jobs.push(
            {
              id: 'job-write-package-second',
              toolName: 'fs_write',
              status: 'succeeded',
              requestId,
              argsPreview: JSON.stringify({ path: join(workspaceRoot, 'package.json') }),
              resultPreview: JSON.stringify({ path: join(workspaceRoot, 'package.json'), size: 48 }),
              createdAt: 1,
              startedAt: 1,
              completedAt: 2,
            },
            {
              id: 'job-write-verify-second',
              toolName: 'fs_write',
              status: 'succeeded',
              requestId,
              argsPreview: JSON.stringify({ path: join(workspaceRoot, 'verify.js') }),
              resultPreview: JSON.stringify({ path: join(workspaceRoot, 'verify.js'), size: 250 }),
              createdAt: 3,
              startedAt: 3,
              completedAt: 4,
            },
            {
              id: 'job-write-index-second',
              toolName: 'fs_write',
              status: 'succeeded',
              requestId,
              argsPreview: JSON.stringify({ path: join(publicRoot, 'index.html') }),
              resultPreview: JSON.stringify({ path: join(publicRoot, 'index.html'), size: 180 }),
              createdAt: 5,
              startedAt: 5,
              completedAt: 6,
            },
            {
              id: 'job-write-css-second',
              toolName: 'fs_write',
              status: 'succeeded',
              requestId,
              argsPreview: JSON.stringify({ path: join(publicRoot, 'styles.css') }),
              resultPreview: JSON.stringify({ path: join(publicRoot, 'styles.css'), size: 32 }),
              createdAt: 7,
              startedAt: 7,
              completedAt: 8,
            },
          );
          return responseWithReceipts('Created public/index.html and public/styles.css; runtime remains.', [
            {
              receiptId: 'receipt-write-package-second',
              sourceType: 'tool_call',
              toolName: 'fs_write',
              status: 'succeeded',
              refs: [join(workspaceRoot, 'package.json')],
              summary: 'Wrote package.json.',
              startedAt: 1,
              endedAt: 2,
            },
            {
              receiptId: 'receipt-write-verify-second',
              sourceType: 'tool_call',
              toolName: 'fs_write',
              status: 'succeeded',
              refs: [join(workspaceRoot, 'verify.js')],
              summary: 'Wrote verify.js.',
              startedAt: 3,
              endedAt: 4,
            },
            {
              receiptId: 'receipt-write-index-second',
              sourceType: 'tool_call',
              toolName: 'fs_write',
              status: 'succeeded',
              refs: [join(publicRoot, 'index.html')],
              summary: 'Wrote public/index.html.',
              startedAt: 5,
              endedAt: 6,
            },
            {
              receiptId: 'receipt-write-css-second',
              sourceType: 'tool_call',
              toolName: 'fs_write',
              status: 'succeeded',
              refs: [join(publicRoot, 'styles.css')],
              summary: 'Wrote public/styles.css.',
              startedAt: 7,
              endedAt: 8,
            },
          ]);
        }

        const sections = Array.isArray(params.additionalSections)
          ? params.additionalSections as Array<{ section?: string; content?: string }>
          : [];
        if (dispatchCount === 2) {
          const diagnostic = sections.find((section) => section.section === 'Runtime Evidence Workspace Check')?.content;
          expect(diagnostic).toContain('package.json scripts found: verify.');
          expect(diagnostic).toContain('Static entrypoint(s) found: public/index.html.');
          expect(diagnostic).toContain('Missing linked assets that must be created before runtime proof: public/app.js.');
          return responseWithReceipts('I could not generate a final response for that request.', [
            {
              receiptId: 'receipt-read-index-second',
              sourceType: 'tool_call',
              toolName: 'fs_read',
              status: 'succeeded',
              refs: [join(publicRoot, 'index.html')],
              summary: 'Read public/index.html.',
              startedAt: 10,
              endedAt: 11,
            },
          ]);
        }

        return responseWithReceipts('I could not generate a final response for that request.', [
          {
            receiptId: 'receipt-read-index-static',
            sourceType: 'tool_call',
            toolName: 'fs_read',
            status: 'succeeded',
            refs: [join(publicRoot, 'index.html')],
            summary: 'Read public/index.html again.',
            startedAt: 20,
            endedAt: 21,
          },
        ]);
      };

      const runTool = vi.fn(async (request) => {
        if (request.toolName === 'fs_write') {
          const args = request.args as { path: string; content: string };
          writeFileSync(args.path, args.content, 'utf8');
          jobs.push({
            id: 'job-supervisor-static-write',
            toolName: 'fs_write',
            status: 'succeeded',
            requestId,
            argsPreview: JSON.stringify({ path: args.path }),
            resultPreview: JSON.stringify({ path: args.path, size: args.content.length }),
            createdAt: 22,
            startedAt: 22,
            completedAt: 23,
          });
          return {
            success: true,
            message: 'Wrote missing static app asset.',
            verificationStatus: 'verified',
          };
        }
        if (request.toolName === 'code_build') {
          const appScriptPath = join(publicRoot, 'app.js');
          const appScriptExists = existsSync(appScriptPath);
          jobs.push({
            id: appScriptExists ? 'job-static-runtime-second-success' : 'job-static-runtime-second-failed',
            toolName: 'code_build',
            status: appScriptExists ? 'succeeded' : 'failed',
            requestId,
            argsPreview: JSON.stringify(request.args),
            resultPreview: appScriptExists
              ? JSON.stringify({
                  success: true,
                  output: { stdout: 'Verify passed.' },
                  verificationStatus: 'verified',
                })
              : JSON.stringify({
                  success: false,
                  output: { stderr: 'MISSING: public/app.js' },
                  verificationStatus: 'failed',
                }),
            createdAt: 30,
            startedAt: 30,
            completedAt: appScriptExists ? 41 : 31,
          });
          runtimeProofRecorded = appScriptExists;
          if (!appScriptExists) {
            return {
              success: false,
              message: 'MISSING: public/app.js',
              verificationStatus: 'failed',
            };
          }
          return {
            success: true,
            message: 'Verify passed.',
            verificationStatus: 'verified',
          };
        }
        return {
          success: false,
          message: `Unexpected tool ${request.toolName}`,
        };
      });
      manager = new WorkerManager(
        {
          listAlwaysLoadedDefinitions: () => [],
          listJobs: vi.fn(() => runtimeProofRecorded ? jobs : jobs.filter((job) => job.toolName !== 'code_build')),
          runTool,
        } as never,
        {
          getFallbackProviderConfig: () => undefined,
          getConfigSnapshot: () => createExecutionProfileTestConfig(),
          auditLog: { record: vi.fn() },
          registry: {
            get: (agentId: string) => agentId === 'local'
              ? {
                  agent: { name: 'Guardian Agent' },
                  definition: {
                    orchestration: {
                      role: 'implementer',
                      label: 'Workspace Implementer',
                      lenses: ['coding-workspace'],
                    },
                  },
                }
              : undefined,
          },
        } as never,
        {
          workerEntryPoint: 'src/worker/worker-entry.ts',
          workerMaxMemoryMb: 2048,
          workerIdleTimeoutMs: 300_000,
          workerShutdownGracePeriodMs: 10,
          capabilityTokenTtlMs: 600_000,
          capabilityTokenMaxToolCalls: 0,
        } as never,
      );

      const result = await manager.handleMessage({
        sessionId: 'tester:web',
        agentId: 'local',
        userId: 'tester',
        grantedCapabilities: [],
        message: {
          id: requestId,
          userId: 'tester',
          channel: 'web',
          content: 'Build a simple music app from scratch in the attached repo and verify it runs locally.',
          metadata: attachPreRoutedIntentGatewayMetadata({
            codeContext: {
              workspaceRoot,
              sessionId: 'music-session',
            },
          }, {
            mode: 'primary',
            available: true,
            model: 'test-model',
            latencyMs: 1,
            decision,
          }),
          timestamp: Date.now(),
        },
        systemPrompt: 'system',
        history: [],
        knowledgeBases: [],
        activeSkills: [],
        additionalSections: [],
        toolContext: '',
        runtimeNotices: [],
        executionProfile: {
          id: 'managed_cloud_tool',
          providerName: 'ollama-cloud-coding',
          providerType: 'ollama_cloud',
          providerModel: 'glm-5.1',
          providerLocality: 'external',
          providerTier: 'managed_cloud',
          requestedTier: 'external',
          preferredAnswerPath: 'tool_loop',
          expectedContextPressure: 'high',
          contextBudget: 32_000,
          toolContextMode: 'tight',
          maxAdditionalSections: 2,
          maxRuntimeNotices: 2,
          fallbackProviderOrder: ['ollama-cloud-coding', 'openai-frontier'],
          reason: 'delegated coding role selected managed-cloud coding profile',
          routingMode: 'auto',
          selectionSource: 'delegated_role',
        },
        delegation: {
          requestId,
          executionId: 'exec-static-second-retry',
          rootExecutionId: 'exec-static-second-retry-root',
          originChannel: 'web',
          originSurfaceId: 'web-guardian-chat',
          codeSessionId: 'music-session',
          orchestration: {
            role: 'implementer',
            label: 'Workspace Implementer',
            lenses: ['coding-workspace'],
          },
        },
      });

      expect(dispatchCount).toBe(1);
      expect(runTool).toHaveBeenCalledWith(expect.objectContaining({
        toolName: 'fs_write',
        args: expect.objectContaining({
          path: join(publicRoot, 'app.js'),
          content: expect.stringContaining('Midnight Drive'),
        }),
      }));
      expect(runTool).toHaveBeenCalledWith(expect.objectContaining({
        toolName: 'fs_write',
        args: expect.objectContaining({
          content: expect.stringContaining('firstById("content-area", "main-content")'),
        }),
      }));
      expect(runTool).toHaveBeenCalledWith(expect.objectContaining({
        toolName: 'fs_write',
        args: expect.objectContaining({
          content: expect.stringContaining('ensureMusicShell()'),
        }),
      }));
      expect(runTool).toHaveBeenCalledWith(expect.objectContaining({
        toolName: 'fs_write',
        args: expect.objectContaining({
          content: expect.stringContaining('renderSongList("song-list"'),
        }),
      }));
      expect(runTool).toHaveBeenCalledWith(expect.objectContaining({
        toolName: 'fs_write',
        args: expect.objectContaining({
          content: expect.stringContaining('renderSongList("all-songs"'),
        }),
      }));
      expect(runTool).toHaveBeenCalledWith(expect.objectContaining({
        toolName: 'fs_write',
        args: expect.objectContaining({
          content: expect.stringContaining('byId("playlist-grid")'),
        }),
      }));
      expect(runTool).toHaveBeenCalledWith(expect.objectContaining({
        toolName: 'fs_write',
        args: expect.objectContaining({
          content: expect.stringContaining('byId("artist-grid")'),
        }),
      }));
      expect(runTool).toHaveBeenCalledWith(expect.objectContaining({
        toolName: 'fs_write',
        args: expect.objectContaining({
          content: expect.stringContaining('"player-song-title"'),
        }),
      }));
      expect(runTool).toHaveBeenCalledWith(expect.objectContaining({
        toolName: 'fs_write',
        args: expect.objectContaining({
          content: expect.stringContaining('byId("play-btn")'),
        }),
      }));
      expect(runTool).toHaveBeenCalledWith(expect.objectContaining({
        toolName: 'fs_write',
        args: expect.objectContaining({
          content: expect.stringContaining('byId("btn-shuffle")'),
        }),
      }));
      expect(runTool).toHaveBeenCalledWith(expect.objectContaining({
        toolName: 'code_build',
        args: expect.objectContaining({
          cwd: workspaceRoot,
          command: 'npm run verify',
        }),
      }));
      expect(result.content).toContain('Local URL:');
      expect(result.content).toContain('public/index.html');
      expect(result.content).toContain('Verified: Verify passed');
      expect(result.content).not.toContain('Delegated work failed.');
      expect(readDelegatedResultEnvelope(result.metadata)?.verification).toMatchObject({
        decision: 'satisfied',
      });
    } finally {
      manager?.shutdown();
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('requires supervisor static-app semantic proof even when a worker reports generic runtime evidence', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    const workspaceRoot = resolve(mkdtempSync(join(tmpdir(), 'ga-static-semantic-proof-')));
    const requestId = 'm-static-semantic-proof';
    let manager: InstanceType<typeof WorkerManager> | undefined;
    let dispatchCount = 0;
    let runtimeProofAttempts = 0;
    try {
      const decision: IntentGatewayDecision = {
        route: 'coding_task',
        confidence: 'high',
        operation: 'update',
        summary: 'Improve the existing static music app and verify visible playback behavior.',
        turnRelation: 'new_request',
        resolution: 'ready',
        missingFields: [],
        executionClass: 'repo_grounded',
        preferredTier: 'external',
        requiresRepoGrounding: true,
        requiresToolSynthesis: true,
        expectedContextPressure: 'medium',
        preferredAnswerPath: 'tool_loop',
        plannedSteps: [
          { kind: 'read', summary: 'Inspect the current static app files.', expectedToolCategories: ['repo_evidence'], required: true },
          { kind: 'write', summary: 'Improve the app behavior in place.', expectedToolCategories: ['repo_mutation'], required: true, dependsOn: ['step_1'] },
          { kind: 'tool_call', summary: 'Exercise the app locally and verify visible behavior.', expectedToolCategories: ['runtime_evidence'], required: true, dependsOn: ['step_2'] },
          { kind: 'answer', summary: 'Report the local URL and verification result.', required: true, dependsOn: ['step_3'] },
        ],
        entities: {},
      };
      const taskContract = buildDelegatedTaskContract(decision);
      const buildResponse = (
        content: string,
        receipts: DelegatedResultEnvelope['evidenceReceipts'],
      ) => {
        const answerReceipt = {
          receiptId: `receipt-answer-${dispatchCount}`,
          sourceType: 'model_answer' as const,
          status: 'succeeded' as const,
          refs: [] as string[],
          summary: content,
          startedAt: 100 + dispatchCount,
          endedAt: 100 + dispatchCount,
        };
        const toolReceiptStepIds = new Map<string, string>();
        for (const receipt of receipts) {
          if (receipt.receiptId.includes('read')) toolReceiptStepIds.set(receipt.receiptId, 'step_1');
          if (receipt.receiptId.includes('write')) toolReceiptStepIds.set(receipt.receiptId, 'step_2');
          if (receipt.receiptId.includes('runtime')) toolReceiptStepIds.set(receipt.receiptId, 'step_3');
        }
        toolReceiptStepIds.set(answerReceipt.receiptId, 'step_4');
        const evidenceReceipts = [...receipts, answerReceipt];
        const stepReceipts = buildStepReceipts({
          plannedTask: taskContract.plan,
          evidenceReceipts,
          toolReceiptStepIds,
          finalAnswerReceiptId: answerReceipt.receiptId,
          interruptions: [],
        });
        return {
          content,
          metadata: buildDelegatedExecutionMetadata({
            taskContract,
            runStatus: computeWorkerRunStatus(taskContract.plan, stepReceipts, [], 'end_turn'),
            stopReason: 'end_turn',
            stepReceipts,
            operatorSummary: content,
            finalUserAnswer: content,
            claims: [],
            evidenceReceipts,
            interruptions: [],
            artifacts: [],
            events: [],
          }),
        };
      };

      workerMessageHandler = () => {
        dispatchCount += 1;
        if (dispatchCount === 1) {
          writeFileSync(join(workspaceRoot, 'index.html'), [
            '<!doctype html>',
            '<html>',
            '<head><link rel="stylesheet" href="styles.css"></head>',
            '<body>',
            '<main id="app">',
            '<section id="home-view"><div id="recently-played"></div><input id="home-search-input"><div id="home-search-results"></div></section>',
            '<section id="browse-view"><input id="search-input"><div id="song-list"></div></section>',
            '<section id="playlists-view"><div id="playlist-list"></div></section>',
            '<section id="view-search"><div id="search-songs-list"></div><div id="search-playlists-list"></div><div id="search-artists-list"></div></section>',
            '<section id="view-playlist-detail"><div id="playlist-detail-content"></div></section>',
            '<section id="artists-view"><div id="artist-list"></div></section>',
            '<section id="view-artist-detail"><div id="artist-detail-content"></div></section>',
            '</main>',
            '<footer id="player-bar"><div id="player-title"></div><div id="player-artist"></div><button id="btn-prev">Prev</button><button id="btn-play">Play</button><button id="btn-next">Next</button><div id="progress-control"><div id="player-progress"></div></div></footer>',
            '<script src="app.js"></script>',
            '</body>',
            '</html>',
            '',
          ].join('\n'));
          writeFileSync(join(workspaceRoot, 'styles.css'), 'body { font-family: sans-serif; }\n');
          writeFileSync(join(workspaceRoot, 'app.js'), [
            'const songs = [{ title: "Midnight Drive", artist: "Ari Lane" }];',
            'function renderSongList(id, list) { document.getElementById(id).textContent = list.map((song) => song.title).join(", "); }',
            'renderSongList("song-list", songs);',
            'renderSongList("recently-played", songs.slice(0, 4));',
            'document.getElementById("playlist-list").textContent = "Chill Vibes";',
            'document.getElementById("artist-list").textContent = "Ari Lane";',
            'document.getElementById("playlist-detail-view");',
            'document.getElementById("artist-detail-view");',
            'document.getElementById("player-title").textContent = songs[0].title;',
            'document.getElementById("player-artist").textContent = songs[0].artist;',
            'document.getElementById("btn-play").textContent = isPlaying ? "Pause" : "Play";',
            'document.getElementById("btn-next");',
            'document.getElementById("btn-prev");',
            'document.getElementById("progress-bar");',
            '',
          ].join('\n'));
          return buildResponse('Completed. Local URL: file:///index.html Verified: shell check passed.', [
            {
              receiptId: 'receipt-read-index',
              sourceType: 'tool_call',
              toolName: 'fs_read',
              status: 'succeeded',
              refs: [join(workspaceRoot, 'index.html')],
              summary: 'Read index.html.',
              startedAt: 1,
              endedAt: 2,
            },
            {
              receiptId: 'receipt-write-index',
              sourceType: 'tool_call',
              toolName: 'fs_write',
              status: 'succeeded',
              refs: [join(workspaceRoot, 'index.html'), join(workspaceRoot, 'styles.css')],
              summary: 'Wrote updated shell files.',
              startedAt: 3,
              endedAt: 4,
            },
            {
              receiptId: 'receipt-runtime-shell',
              sourceType: 'tool_call',
              toolName: 'shell_safe',
              status: 'succeeded',
              refs: [workspaceRoot],
              summary: 'Ran a generic shell check.',
              startedAt: 5,
              endedAt: 6,
            },
          ]);
        }

        writeFileSync(join(workspaceRoot, 'app.js'), [
          'const songs = [{ title: "Midnight Drive", artist: "Ari Lane" }, { title: "Harbor Lights", artist: "Nia Vale" }];',
          'let currentIndex = 0;',
          'let isPlaying = false;',
          'let recentlyPlayed = [];',
          'const byId = (id) => document.getElementById(id);',
          'function renderSongList(id, list) { const node = byId(id); if (node) node.textContent = list.map((song) => song.title).join(", "); }',
          'function renderRecentlyPlayed() { renderSongList("recently-played", recentlyPlayed.map((index) => songs[index])); }',
          'function renderSearch(query = "") { const filtered = songs.filter((song) => song.title.toLowerCase().includes(query.toLowerCase()) || song.artist.toLowerCase().includes(query.toLowerCase())); renderSongList("home-search-results", filtered); renderSongList("song-list", filtered); renderSongList("search-songs-list", filtered); byId("search-playlists-list").textContent = "Chill Vibes"; byId("search-artists-list").textContent = "Ari Lane, Nia Vale"; byId("view-search"); }',
          'function syncPlayer() { byId("player-title").textContent = songs[currentIndex].title; byId("player-artist").textContent = songs[currentIndex].artist; byId("btn-play").textContent = isPlaying ? "[pause]" : "[play]"; byId("player-progress").style.width = "50%"; }',
          'function playSong(index) { currentIndex = index; isPlaying = true; recentlyPlayed = [index, ...recentlyPlayed.filter((item) => item !== index)].slice(0, 6); renderRecentlyPlayed(); syncPlayer(); }',
          'byId("home-search-input").addEventListener("input", (event) => renderSearch(event.target.value));',
          'byId("search-input").addEventListener("input", (event) => renderSearch(event.target.value));',
          'byId("playlist-list").textContent = "Chill Vibes";',
          'byId("artist-list").textContent = "Ari Lane, Nia Vale";',
          'byId("view-playlist-detail"); byId("playlist-detail-content").innerHTML = "<div id=\\"playlist-header\\"></div><div id=\\"playlist-songs\\"></div>"; byId("playlist-header").textContent = "Chill Vibes"; renderSongList("playlist-songs", songs);',
          'byId("view-artist-detail"); byId("artist-detail-content").innerHTML = "<div id=\\"artist-header\\"></div><div id=\\"artist-songs\\"></div>"; byId("artist-header").textContent = "Ari Lane"; renderSongList("artist-songs", songs);',
          'byId("btn-play").addEventListener("click", () => { isPlaying = !isPlaying; syncPlayer(); });',
          'byId("btn-next").addEventListener("click", () => playSong((currentIndex + 1) % songs.length));',
          'byId("btn-prev").addEventListener("click", () => playSong((currentIndex + songs.length - 1) % songs.length));',
          'byId("progress-control").addEventListener("click", () => { byId("player-progress").style.width = "75%"; });',
          'renderSearch(); playSong(0);',
          '',
        ].join('\n'));
        return buildResponse('Completed. Local URL: file:///index.html Verified: semantic static app proof passed.', [
          {
            receiptId: 'receipt-read-retry',
            sourceType: 'tool_call',
            toolName: 'fs_read',
            status: 'succeeded',
            refs: [join(workspaceRoot, 'app.js')],
            summary: 'Read app.js.',
            startedAt: 10,
            endedAt: 11,
          },
          {
            receiptId: 'receipt-write-app',
            sourceType: 'tool_call',
            toolName: 'fs_write',
            status: 'succeeded',
            refs: [join(workspaceRoot, 'app.js')],
            summary: 'Rewired app.js behavior.',
            startedAt: 12,
            endedAt: 13,
          },
          {
            receiptId: 'receipt-runtime-retry',
            sourceType: 'tool_call',
            toolName: 'shell_safe',
            status: 'succeeded',
            refs: [workspaceRoot],
            summary: 'Ran a generic shell check after retry.',
            startedAt: 14,
            endedAt: 15,
          },
        ]);
      };

      const jobs: Array<{
        id: string;
        toolName: string;
        status: string;
        requestId: string;
        argsPreview?: string;
        resultPreview?: string;
        createdAt: number;
        startedAt: number;
        completedAt: number;
      }> = [];
      const runTool = vi.fn(async (request) => {
        runtimeProofAttempts += 1;
        const args = request.args as { cwd?: string; command?: string };
        const command = args.command ?? '';
        const scriptName = command.replace(/^node\s+/u, '');
        let stdout = '';
        let stderr = '';
        let success = true;
        try {
          stdout = execFileSync(process.execPath, [scriptName], {
            cwd: args.cwd,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
          });
        } catch (error) {
          success = false;
          const execError = error as { stdout?: string | Buffer; stderr?: string | Buffer; message?: string };
          stdout = execError.stdout ? String(execError.stdout) : '';
          stderr = execError.stderr ? String(execError.stderr) : execError.message ?? '';
        }
        jobs.push({
          id: `job-static-semantic-proof-${runtimeProofAttempts}`,
          toolName: 'code_build',
          status: success ? 'succeeded' : 'failed',
          requestId,
          argsPreview: JSON.stringify(request.args),
          resultPreview: JSON.stringify({
            success,
            output: { stdout, stderr },
            verificationStatus: success ? 'verified' : 'failed',
          }),
          createdAt: 20 + runtimeProofAttempts,
          startedAt: 20 + runtimeProofAttempts,
          completedAt: 21 + runtimeProofAttempts,
        });
        return {
          success,
          status: success ? 'succeeded' : 'failed',
          jobId: `job-static-semantic-proof-${runtimeProofAttempts}`,
          message: success ? stdout : stderr,
          output: { stdout, stderr },
          verificationStatus: success ? 'verified' : 'failed',
        };
      });
      const intentRoutingTrace = { record: vi.fn() };
      manager = new WorkerManager(
        {
          listAlwaysLoadedDefinitions: () => [],
          listJobs: vi.fn(() => jobs),
          runTool,
        } as never,
        {
          getFallbackProviderConfig: () => undefined,
          getConfigSnapshot: () => createExecutionProfileTestConfig(),
          auditLog: { record: vi.fn() },
          registry: {
            get: (agentId: string) => agentId === 'local'
              ? {
                  agent: { name: 'Guardian Agent' },
                  definition: {
                    orchestration: {
                      role: 'implementer',
                      label: 'Workspace Implementer',
                      lenses: ['coding-workspace'],
                    },
                  },
                }
              : undefined,
          },
        } as never,
        {
          workerEntryPoint: 'src/worker/worker-entry.ts',
          workerMaxMemoryMb: 2048,
          workerIdleTimeoutMs: 300_000,
          workerShutdownGracePeriodMs: 10,
          capabilityTokenTtlMs: 600_000,
          capabilityTokenMaxToolCalls: 0,
        } as never,
        undefined,
        {
          intentRoutingTrace,
          now: () => 880_000 + runtimeProofAttempts,
        },
      );

      const result = await manager.handleMessage({
        sessionId: 'tester:web',
        agentId: 'local',
        userId: 'tester',
        grantedCapabilities: [],
        message: {
          id: requestId,
          userId: 'tester',
          channel: 'web',
          content: 'Continue the attached MusicApp repo, improve search, recently played, playlist and artist detail, and verify visible playback behavior.',
          metadata: attachPreRoutedIntentGatewayMetadata({
            codeContext: {
              workspaceRoot,
              sessionId: 'music-session',
            },
          }, {
            mode: 'primary',
            available: true,
            model: 'test-model',
            latencyMs: 1,
            decision,
          }),
          timestamp: Date.now(),
        },
        systemPrompt: 'system',
        history: [],
        knowledgeBases: [],
        activeSkills: [],
        additionalSections: [],
        toolContext: '',
        runtimeNotices: [],
        executionProfile: {
          id: 'managed_cloud_tool',
          providerName: 'ollama-cloud-coding',
          providerType: 'ollama_cloud',
          providerModel: 'glm-5.1',
          providerLocality: 'external',
          providerTier: 'managed_cloud',
          requestedTier: 'external',
          preferredAnswerPath: 'tool_loop',
          expectedContextPressure: 'medium',
          contextBudget: 32_000,
          toolContextMode: 'tight',
          maxAdditionalSections: 2,
          maxRuntimeNotices: 2,
          fallbackProviderOrder: ['ollama-cloud-coding', 'openai-frontier'],
          reason: 'delegated coding role selected managed-cloud coding profile',
          routingMode: 'auto',
          selectionSource: 'delegated_role',
        },
        delegation: {
          requestId,
          executionId: 'exec-static-semantic-proof',
          rootExecutionId: 'exec-static-semantic-proof-root',
          originChannel: 'web',
          originSurfaceId: 'web-guardian-chat',
          codeSessionId: 'music-session',
          orchestration: {
            role: 'implementer',
            label: 'Workspace Implementer',
            lenses: ['coding-workspace'],
          },
        },
      });

      expect(dispatchCount).toBeGreaterThan(1);
      expect(jobs.map((job) => job.resultPreview ?? '').join('\n')).toContain('Static app runtime check passed');
      expect(jobs.map((job) => job.status)).toContain('succeeded');
      expect(jobs[0]?.status).toBe('failed');
      expect(jobs[0]?.resultPreview).toContain('home-search-input');
      expect(jobs[0]?.resultPreview).toContain('fixed song slice');
      expect(result.content).not.toContain('Delegated work failed.');
      expect(readDelegatedResultEnvelope(result.metadata)?.verification).toMatchObject({
        decision: 'satisfied',
      });
      expect(intentRoutingTrace.record.mock.calls.map(([entry]) => entry.stage)).toEqual(expect.arrayContaining([
        'delegated_worker_retrying',
        'delegated_worker_completed',
      ]));
    } finally {
      manager?.shutdown();
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('keeps static-app proof failures resumable when the delegated worker is approval-paused', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    const workspaceRoot = resolve(mkdtempSync(join(tmpdir(), 'ga-static-approval-pause-')));
    const pendingActionStore = createMemoryPendingActionStore(() => 990_000);
    const executionGraphStore = new ExecutionGraphStore({
      now: () => 990_000,
    });
    let manager: InstanceType<typeof WorkerManager> | undefined;
    let runtimeProofAttempts = 0;
    try {
      writeFileSync(join(workspaceRoot, 'index.html'), [
        '<!doctype html>',
        '<html>',
        '<head><link rel="stylesheet" href="styles.css"></head>',
        '<body>',
        '<main id="main-content"></main>',
        '<footer id="player-bar"><div id="player-title"></div><div id="player-artist"></div><button id="btn-prev">Prev</button><button id="btn-play">Play</button><button id="btn-next">Next</button><div id="player-progress"></div></footer>',
        '<script src="app.js"></script>',
        '</body>',
        '</html>',
        '',
      ].join('\n'));
      writeFileSync(join(workspaceRoot, 'styles.css'), 'body { font-family: sans-serif; }\n');
      writeFileSync(join(workspaceRoot, 'app.js'), 'console.log("incomplete music app");\n');

      const decision: IntentGatewayDecision = {
        route: 'coding_task',
        confidence: 'high',
        operation: 'create',
        summary: 'Build and verify a static music app.',
        turnRelation: 'new_request',
        resolution: 'ready',
        missingFields: [],
        executionClass: 'repo_grounded',
        preferredTier: 'external',
        requiresRepoGrounding: true,
        requiresToolSynthesis: true,
        expectedContextPressure: 'medium',
        preferredAnswerPath: 'tool_loop',
        plannedSteps: [
          { kind: 'write', summary: 'Create the static app files.', expectedToolCategories: ['repo_mutation'], required: true },
          { kind: 'tool_call', summary: 'Exercise the app locally.', expectedToolCategories: ['runtime_evidence'], required: true, dependsOn: ['step_1'] },
          { kind: 'answer', summary: 'Report the URL and verification result.', required: true, dependsOn: ['step_2'] },
        ],
        entities: {},
      };

      workerMessageHandler = (params) => {
        const message = params.message as {
          id: string;
          userId: string;
          principalId?: string;
          principalRole?: 'owner' | 'delegate' | 'system';
          channel: string;
          surfaceId?: string;
          content: string;
          metadata?: Record<string, unknown>;
          timestamp?: number;
        };
        return {
          content: 'Waiting for approval to write the local static server before rerunning the app proof.',
          metadata: attachWorkerSuspensionMetadata({
            ...approvalPendingActionMetadata([
              {
                id: 'approval-static-server',
                toolName: 'fs_write',
                argsPreview: '{"path":"server.js"}',
              },
            ]),
            workerExecution: {
              lifecycle: 'blocked',
              source: 'tool_loop',
              completionReason: 'approval_pending',
              responseQuality: 'final',
              blockerKind: 'approval',
              toolCallCount: 1,
              toolResultCount: 1,
              successfulToolResultCount: 0,
              pendingApprovalCount: 1,
            },
          }, {
            version: WORKER_SUSPENSION_SCHEMA_VERSION,
            kind: 'tool_loop',
            llmMessages: [
              {
                role: 'assistant',
                content: '',
                toolCalls: [{ id: 'call-static-server', name: 'fs_write', args: '{}' }],
              },
            ],
            pendingTools: [{
              approvalId: 'approval-static-server',
              toolCallId: 'call-static-server',
              jobId: 'job-static-server',
              name: 'fs_write',
            }],
            originalMessage: {
              id: message.id,
              userId: message.userId,
              principalId: message.principalId ?? message.userId,
              principalRole: message.principalRole ?? 'owner',
              channel: message.channel,
              ...(message.surfaceId ? { surfaceId: message.surfaceId } : {}),
              content: message.content,
              metadata: message.metadata,
              timestamp: message.timestamp ?? Date.now(),
            },
            createdAt: 990_000,
            expiresAt: 990_000 + 30 * 60_000,
          }),
        };
      };

      const runTool = vi.fn(async () => {
        runtimeProofAttempts += 1;
        return {
          success: false,
          status: 'failed',
          message: 'Static app semantic check failed: song list container is missing from index.html',
          output: {
            stderr: 'Static app semantic check failed: song list container is missing from index.html',
          },
          verificationStatus: 'failed',
        };
      });

      manager = new WorkerManager(
        {
          listAlwaysLoadedDefinitions: () => [],
          listJobs: vi.fn(() => []),
          runTool,
        } as never,
        {
          getFallbackProviderConfig: () => undefined,
          getConfigSnapshot: () => createExecutionProfileTestConfig(),
          auditLog: { record: vi.fn() },
          registry: {
            get: (agentId: string) => agentId === 'local'
              ? {
                  agent: { name: 'Guardian Agent' },
                  definition: {
                    orchestration: {
                      role: 'implementer',
                      label: 'Workspace Implementer',
                      lenses: ['coding-workspace'],
                    },
                  },
                }
              : undefined,
          },
        } as never,
        {
          workerEntryPoint: 'src/worker/worker-entry.ts',
          workerMaxMemoryMb: 2048,
          workerIdleTimeoutMs: 300_000,
          workerShutdownGracePeriodMs: 10,
          capabilityTokenTtlMs: 600_000,
          capabilityTokenMaxToolCalls: 0,
        } as never,
        undefined,
        {
          pendingActionStore,
          executionGraphStore,
          now: () => 990_000,
        },
      );

      const result = await manager.handleMessage({
        sessionId: 'tester:web',
        agentId: 'local',
        userId: 'tester',
        grantedCapabilities: [],
        message: {
          id: 'm-static-approval-pause',
          userId: 'tester',
          principalId: 'tester',
          principalRole: 'owner',
          channel: 'web',
          surfaceId: 'web-guardian-chat',
          content: 'Build a static MusicApp and verify it locally.',
          metadata: attachPreRoutedIntentGatewayMetadata({
            codeContext: {
              workspaceRoot,
              sessionId: 'music-session',
            },
          }, {
            mode: 'primary',
            available: true,
            model: 'test-model',
            latencyMs: 1,
            decision,
          }),
          timestamp: Date.now(),
        },
        systemPrompt: 'system',
        history: [],
        knowledgeBases: [],
        activeSkills: [],
        additionalSections: [],
        toolContext: '',
        runtimeNotices: [],
        executionProfile: {
          id: 'managed_cloud_tool',
          providerName: 'ollama-cloud-coding',
          providerType: 'ollama_cloud',
          providerModel: 'glm-5.1',
          providerLocality: 'external',
          providerTier: 'managed_cloud',
          requestedTier: 'external',
          preferredAnswerPath: 'tool_loop',
          expectedContextPressure: 'medium',
          contextBudget: 32_000,
          toolContextMode: 'tight',
          maxAdditionalSections: 2,
          maxRuntimeNotices: 2,
          fallbackProviderOrder: ['ollama-cloud-coding', 'openai-frontier'],
          reason: 'delegated coding role selected managed-cloud coding profile',
          routingMode: 'auto',
          selectionSource: 'delegated_role',
        },
        delegation: {
          requestId: 'm-static-approval-pause',
          executionId: 'exec-static-approval-pause',
          rootExecutionId: 'exec-static-approval-root',
          originChannel: 'web',
          originSurfaceId: 'web-guardian-chat',
          codeSessionId: 'music-session',
          orchestration: {
            role: 'implementer',
            label: 'Workspace Implementer',
            lenses: ['coding-workspace'],
          },
        },
      });

      expect(runtimeProofAttempts).toBeGreaterThan(0);
      expect(result.content).toContain('Delegated work is paused: approval required.');
      expect(result.content).not.toContain('Delegated work failed.');
      expect(result.metadata?.delegatedHandoff).toMatchObject({
        unresolvedBlockerKind: 'approval',
        reportingMode: 'held_for_approval',
      });
      expect(result.metadata?.pendingAction).toMatchObject({
        blocker: {
          approvalSummaries: [
            expect.objectContaining({
              id: 'approval-static-server',
              toolName: 'fs_write',
            }),
          ],
        },
      });
      expect(result.metadata?.executionGraph).toMatchObject({
        status: 'awaiting_approval',
        lifecycle: 'blocked',
      });
      expect(pendingActionStore.findActiveByApprovalId('approval-static-server')).toBeTruthy();
    } finally {
      manager?.shutdown();
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('waits for in-flight delegated evidence jobs before failing a missing non-answer step', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { WorkerManager } = await import('./worker-manager.js');

    let manager: { shutdown: () => void } | undefined;
    try {
      workerMessageHandler = (params) => {
        if (params.groundedSynthesis) {
          return {
            content: [
              '- Automation: success, 38 listed.',
              '- Repo: success, src/runtime/chat-agent/live-tool-loop-controller.ts.',
            ].join('\n'),
            metadata: {
              workerExecution: {
                lifecycle: 'completed',
                source: 'tool_loop',
                completionReason: 'model_response',
                responseQuality: 'final',
                terminationReason: 'clean_exit',
                toolCallCount: 0,
                toolResultCount: 0,
                successfulToolResultCount: 0,
              },
            },
          };
        }
        return {
          content: 'I started the status sweep, but the repo search is still finishing.',
          metadata: {
            skipTestDelegatedEnvelope: true,
            workerExecution: {
              lifecycle: 'completed',
              source: 'tool_loop',
              completionReason: 'empty_response_fallback',
              responseQuality: 'final',
              terminationReason: 'clean_exit',
              roundCount: 4,
              toolCallCount: 2,
              toolResultCount: 1,
              successfulToolResultCount: 1,
            },
          },
        };
      };

      const listJobs = vi.fn(() => {
        const searchCompleted = Date.now() >= 10_000;
        return [
          {
            id: 'job-automation-list',
            toolName: 'automation_list',
            status: 'succeeded',
            requestId: 'm-inflight-evidence',
            argsPreview: '{}',
            resultPreview: '{"count":38}',
            createdAt: 1,
            startedAt: 2,
            completedAt: 3,
          },
          {
            id: 'job-code-symbol-search',
            toolName: 'code_symbol_search',
            status: searchCompleted ? 'succeeded' : 'running',
            requestId: 'm-inflight-evidence',
            argsPreview: '{"query":"runLiveToolLoopController","path":"S:\\\\Development\\\\GuardianAgent"}',
            resultPreview: searchCompleted
              ? '{"matches":[{"path":"S:\\\\Development\\\\GuardianAgent\\\\src\\\\runtime\\\\chat-agent\\\\live-tool-loop-controller.ts","relativePath":"src/runtime/chat-agent/live-tool-loop-controller.ts"}]}'
              : undefined,
            createdAt: 4,
            startedAt: 5,
            ...(searchCompleted ? { completedAt: 10_000 } : {}),
          },
        ];
      });
      const intentRoutingTrace = { record: vi.fn() };
      const runTimeline = { ingestDelegatedWorkerProgress: vi.fn() };
      manager = new WorkerManager(
        {
          listAlwaysLoadedDefinitions: () => [],
          listJobs,
        } as never,
        {
          getFallbackProviderConfig: () => undefined,
          getConfigSnapshot: () => createExecutionProfileTestConfig(),
          auditLog: { record: vi.fn() },
          registry: {
            get: (agentId: string) => agentId === 'local'
              ? {
                  agent: { name: 'Guardian Agent' },
                  definition: {
                    orchestration: {
                      role: 'coordinator',
                      label: 'Guardian Coordinator',
                    },
                  },
                }
              : undefined,
          },
        } as never,
        {
          workerEntryPoint: 'src/worker/worker-entry.ts',
          workerMaxMemoryMb: 2048,
          workerIdleTimeoutMs: 300_000,
          workerShutdownGracePeriodMs: 10,
          capabilityTokenTtlMs: 600_000,
          capabilityTokenMaxToolCalls: 0,
        } as never,
        undefined,
        {
          intentRoutingTrace,
          runTimeline,
          now: () => Date.now(),
        },
      );

      const resultPromise = manager.handleMessage({
        sessionId: 'tester:web',
        agentId: 'local',
        userId: 'tester',
        grantedCapabilities: [],
        message: {
          id: 'm-inflight-evidence',
          userId: 'tester',
          channel: 'web',
          content: 'List automations, search this repo for where runLiveToolLoopController is defined, and return a short answer.',
          metadata: attachPreRoutedIntentGatewayMetadata(undefined, {
            mode: 'primary',
            available: true,
            model: 'test-model',
            latencyMs: 1,
            decision: {
              route: 'general_assistant',
              confidence: 'high',
              operation: 'run',
              summary: 'Read automations, search the repo, and answer.',
              turnRelation: 'new_request',
              resolution: 'ready',
              missingFields: [],
              executionClass: 'tool_orchestration',
              preferredTier: 'external',
              requiresRepoGrounding: false,
              requiresToolSynthesis: true,
              requireExactFileReferences: false,
              expectedContextPressure: 'medium',
              preferredAnswerPath: 'tool_loop',
              plannedSteps: [
                { kind: 'read', summary: 'List saved automations.', expectedToolCategories: ['automation_list'], required: true },
                { kind: 'search', summary: 'Search this repo for where runLiveToolLoopController is defined.', expectedToolCategories: ['code_symbol_search'], required: true },
                { kind: 'answer', summary: 'Return the final answer.', required: true, dependsOn: ['step_1', 'step_2'] },
              ],
              entities: {},
            },
          }),
          timestamp: Date.now(),
        },
        systemPrompt: 'system',
        history: [],
        knowledgeBases: [],
        activeSkills: [],
        additionalSections: [],
        toolContext: '',
        runtimeNotices: [],
        executionProfile: {
          id: 'managed_cloud_tool',
          providerName: 'ollama-cloud-tools',
          providerType: 'ollama_cloud',
          providerModel: 'glm-4.7',
          providerLocality: 'external',
          providerTier: 'managed_cloud',
          requestedTier: 'external',
          preferredAnswerPath: 'tool_loop',
          expectedContextPressure: 'medium',
          contextBudget: 32_000,
          toolContextMode: 'tight',
          maxAdditionalSections: 1,
          maxRuntimeNotices: 2,
          fallbackProviderOrder: ['ollama-cloud-tools'],
          reason: 'test',
          routingMode: 'auto',
          selectionSource: 'delegated_role',
        },
        delegation: {
          requestId: 'm-inflight-evidence',
          executionId: 'exec-inflight-evidence',
          rootExecutionId: 'exec-inflight-evidence',
          originChannel: 'web',
        },
      });

      await vi.advanceTimersByTimeAsync(70_000);
      const result = await resultPromise;

      expect(result.content).toContain('src/runtime/chat-agent/live-tool-loop-controller.ts');
      expect(result.content).not.toContain('Delegated work failed.');
      expect(listJobs.mock.calls.length).toBeGreaterThan(2);
      expect(intentRoutingTrace.record.mock.calls.map(([entry]) => entry.stage)).toEqual(expect.arrayContaining([
        'delegated_job_wait_expired',
        'delegated_worker_retrying',
        'delegated_worker_completed',
      ]));
    } finally {
      manager?.shutdown();
      vi.useRealTimers();
    }
  });

  it('retries insufficient exact-file delegated repo inspections with an escalated frontier profile', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    const dispatchProfiles: Array<string | undefined> = [];
    workerMessageHandler = (params) => {
      const executionProfile = params.executionProfile as { providerName?: string; providerTier?: string } | undefined;
      dispatchProfiles.push(executionProfile?.providerName);
      if (executionProfile?.providerTier === 'frontier') {
        return {
          content: [
            'The delegated worker progress implementation lives in `src/supervisor/worker-manager.ts` and `src/runtime/run-timeline.ts`.',
            'The web-side timeline matching/rendering path lives in `web/public/js/chat-run-tracking.js` and `web/public/js/chat-panel.js`.',
          ].join('\n'),
          metadata: {
            workerExecution: {
              lifecycle: 'completed',
              source: 'tool_loop',
              completionReason: 'model_response',
              responseQuality: 'final',
              toolCallCount: 4,
              toolResultCount: 4,
              successfulToolResultCount: 4,
            },
          },
        };
      }
      return {
        content: 'The searches confirmed the files exist, but the detailed match output was truncated so I cannot give you exact file paths with confidence. Would you like me to run narrower searches?',
        metadata: {
          workerExecution: {
            lifecycle: 'completed',
            source: 'tool_loop',
            completionReason: 'tool_result_recovery',
            responseQuality: 'final',
            toolCallCount: 4,
            toolResultCount: 4,
            successfulToolResultCount: 4,
          },
        },
      };
    };

    const intentRoutingTrace = {
      record: vi.fn(),
    };
    const runTimeline = {
      ingestDelegatedWorkerProgress: vi.fn(),
    };
    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        getConfigSnapshot: () => createExecutionProfileTestConfig(),
        auditLog: { record: vi.fn() },
        registry: {
          get: (agentId: string) => agentId === 'local'
            ? {
                agent: { name: 'Guardian Agent' },
                definition: {
                  orchestration: {
                    role: 'explorer',
                    label: 'Workspace Explorer',
                    lenses: ['coding-workspace'],
                  },
                },
              }
            : undefined,
        },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
      undefined,
      {
        intentRoutingTrace,
        runTimeline,
        now: () => 321_000,
      },
    );

    const result = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-retry-exact-files',
        userId: 'tester',
        channel: 'web',
        content: 'Inspect this repo and tell me which files implement delegated worker progress and run timeline rendering. Do not edit anything.',
        metadata: repoGroundedCodingMetadata(),
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      additionalSections: [],
      toolContext: '',
      runtimeNotices: [],
      executionProfile: {
        id: 'managed_cloud_tool',
        providerName: 'ollama-cloud-coding',
        providerType: 'ollama_cloud',
        providerModel: 'qwen3-coder-next',
        providerLocality: 'external',
        providerTier: 'managed_cloud',
        requestedTier: 'external',
        preferredAnswerPath: 'tool_loop',
        expectedContextPressure: 'medium',
        contextBudget: 32_000,
        toolContextMode: 'tight',
        maxAdditionalSections: 2,
        maxRuntimeNotices: 2,
        fallbackProviderOrder: ['ollama-cloud-coding', 'openai-frontier'],
        reason: 'delegated coding role selected managed-cloud coding profile',
        routingMode: 'auto',
        selectionSource: 'delegated_role',
      },
      delegation: {
        requestId: 'm-retry-exact-files',
        executionId: 'exec-retry-exact-files',
        rootExecutionId: 'exec-retry-root',
        originChannel: 'web',
        orchestration: {
          role: 'explorer',
          label: 'Workspace Explorer',
          lenses: ['coding-workspace'],
        },
      },
    });

    expect(dispatchProfiles).toEqual(['ollama-cloud-coding', 'openai-frontier']);
    expect(result.content).toContain('src/supervisor/worker-manager.ts');
    expect(result.content).toContain('src/runtime/run-timeline.ts');
    expect(result.content).toContain('web/public/js/chat-run-tracking.js');
    expect(result.content).toContain('web/public/js/chat-panel.js');

    expect(intentRoutingTrace.record.mock.calls.map(([entry]) => entry.stage)).toEqual([
      'delegated_worker_started',
      'delegated_worker_running',
      'delegated_worker_retrying',
      'delegated_worker_contract_reconciled',
      'delegated_claim_emitted',
      'delegated_verification_decided',
      'delegated_worker_completed',
    ]);
    expect(intentRoutingTrace.record.mock.calls[2]?.[0]).toMatchObject({
      stage: 'delegated_worker_retrying',
      requestId: 'm-retry-exact-files',
      details: {
        executionProfileName: 'openai-frontier',
        executionProfileTier: 'frontier',
      },
    });
    expect(runTimeline.ingestDelegatedWorkerProgress.mock.calls.map(([event]) => event.kind)).toEqual([
      'started',
      'running',
      'running',
      'completed',
    ]);
    expect(runTimeline.ingestDelegatedWorkerProgress.mock.calls[2]?.[0]).toMatchObject({
      kind: 'running',
      executionProfileName: 'openai-frontier',
      executionProfileTier: 'frontier',
      detail: expect.stringContaining('Retrying Workspace Explorer'),
    });

    manager.shutdown();
  });

  it('fails exact-file delegated repo inspections after exhausting a same-profile corrective retry when no stronger escalation profile is available', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    const dispatchProfiles: Array<string | undefined> = [];
    workerMessageHandler = (params) => {
      const executionProfile = params.executionProfile as { providerName?: string } | undefined;
      dispatchProfiles.push(executionProfile?.providerName);
      return {
        content: 'The searches confirmed the files exist, but the detailed match output was truncated so I cannot give you exact file paths with confidence.',
        metadata: {
          workerExecution: {
            lifecycle: 'completed',
            source: 'tool_loop',
            completionReason: 'tool_result_recovery',
            responseQuality: 'final',
            toolCallCount: 3,
            toolResultCount: 3,
            successfulToolResultCount: 3,
          },
        },
      };
    };

    const intentRoutingTrace = {
      record: vi.fn(),
    };
    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        getConfigSnapshot: () => {
          const config = createExecutionProfileTestConfig();
          delete config.llm['openai-frontier'];
          config.assistant.tools.preferredProviders = {
            ...config.assistant.tools.preferredProviders,
            frontier: '',
          };
          return config;
        },
        auditLog: { record: vi.fn() },
        registry: {
          get: () => undefined,
        },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
      undefined,
      {
        intentRoutingTrace,
      },
    );

    const result = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-fail-exact-files',
        userId: 'tester',
        channel: 'web',
        content: 'Inspect this repo and tell me which files implement delegated worker progress and run timeline rendering. Do not edit anything.',
        metadata: repoGroundedCodingMetadata(),
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      additionalSections: [],
      toolContext: '',
      runtimeNotices: [],
      executionProfile: {
        id: 'managed_cloud_tool',
        providerName: 'ollama-cloud-coding',
        providerType: 'ollama_cloud',
        providerModel: 'qwen3-coder-next',
        providerLocality: 'external',
        providerTier: 'managed_cloud',
        requestedTier: 'external',
        preferredAnswerPath: 'tool_loop',
        expectedContextPressure: 'medium',
        contextBudget: 32_000,
        toolContextMode: 'tight',
        maxAdditionalSections: 2,
        maxRuntimeNotices: 2,
        fallbackProviderOrder: ['ollama-cloud-coding'],
        reason: 'delegated coding role selected managed-cloud coding profile',
        routingMode: 'auto',
        selectionSource: 'delegated_role',
      },
      delegation: {
        requestId: 'm-fail-exact-files',
        originChannel: 'web',
      },
    });

    expect(dispatchProfiles).toEqual(['ollama-cloud-coding', 'ollama-cloud-coding', 'ollama-cloud-coding']);
    expect(result.content).toContain('Delegated work failed.');
    expect(result.content).toContain('exact file references requested');
    expect(intentRoutingTrace.record.mock.calls.map(([entry]) => entry.stage)).toEqual([
      'delegated_worker_started',
      'delegated_worker_running',
      'delegated_worker_retrying',
      'recovery_advisor_started',
      'recovery_advisor_rejected',
      'delegated_worker_contract_reconciled',
      'delegated_claim_emitted',
      'delegated_verification_decided',
      'delegated_worker_failed',
    ]);

    manager.shutdown();
  });

  it('records verifier-failure trace diagnostics with tool previews without exposing them in returned metadata', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    const gatewayDecision = readPreRoutedIntentGatewayMetadata(repoGroundedCodingMetadata())?.decision;
    const intentRoutingTrace = {
      record: vi.fn(),
    };

    workerMessageHandler = () => ({
      content: 'The search output was truncated, so I cannot provide exact grounded file references yet.',
      metadata: {
        delegatedResult: {
          taskContract: buildDelegatedTaskContract(gatewayDecision),
          operatorSummary: 'Search output was truncated before exact file references could be proven.',
          claims: [],
          evidenceReceipts: [],
          interruptions: [],
          artifacts: [],
          events: [{
            eventId: 'tool-1:completed',
            nodeId: 'tool-1',
            type: 'tool_call_completed',
            timestamp: 1,
            payload: {
              toolCallId: 'tool-1',
              toolName: 'fs_search',
              resultStatus: 'succeeded',
              resultMessage: 'Search completed.',
              traceResultPreview: '{"success":true,"output":{"matches":["src/runtime/intent-routing-trace.ts [content] trace details"]}}',
            },
          }],
        },
        workerExecution: {
          lifecycle: 'completed',
          source: 'tool_loop',
          completionReason: 'model_response',
          responseQuality: 'final',
          toolCallCount: 1,
          toolResultCount: 1,
          successfulToolResultCount: 1,
        },
      },
    });

    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
        listJobs: () => [{
          id: 'job-1',
          toolName: 'fs_search',
          risk: 'read_only',
          origin: 'assistant',
          argsPreview: '{"query":"trace"}',
          status: 'succeeded',
          createdAt: 1,
          requestId: 'm-trace-failure',
          resultPreview: '{"matches":["src/runtime/intent-routing-trace.ts"]}',
          requiresApproval: false,
        }],
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        auditLog: { record: vi.fn() },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
      undefined,
      {
        intentRoutingTrace,
      },
    );

    const result = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-trace-failure',
        userId: 'tester',
        channel: 'web',
        content: 'Inspect this repo and tell me which files implement delegated worker progress and run timeline rendering. Do not edit anything.',
        metadata: repoGroundedCodingMetadata(),
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      additionalSections: [],
      toolContext: '',
      runtimeNotices: [],
      delegation: {
        requestId: 'm-trace-failure',
        originChannel: 'web',
      },
    });

    const verificationTrace = intentRoutingTrace.record.mock.calls
      .map(([entry]) => entry)
      .find((entry) => entry.stage === 'delegated_verification_decided');
    expect(verificationTrace?.details.verificationFailureDiagnostics).toMatchObject({
      requestId: 'm-trace-failure',
      jobSnapshots: [{
        toolName: 'fs_search',
        resultPreview: '{"matches":["src/runtime/intent-routing-trace.ts"]}',
      }],
    });
    expect(JSON.stringify(result.metadata ?? {})).not.toContain('traceResultPreview');

    manager.shutdown();
  });

  it('retries exact-file delegated repo inspections on the same frontier profile when truncated search output can be corrected without escalation', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    const dispatchProfiles: Array<string | undefined> = [];
    let attempts = 0;
    workerMessageHandler = (params) => {
      const executionProfile = params.executionProfile as { providerName?: string } | undefined;
      dispatchProfiles.push(executionProfile?.providerName);
      attempts += 1;
      if (attempts > 1) {
        return {
          content: [
            'Live progress in chat is rendered in `web/public/js/chat-panel.js` and matched in `web/public/js/chat-run-tracking.js`.',
            'Repo timelines are rendered in `web/public/js/pages/code.js`, `web/public/js/pages/system.js`, and `web/public/js/pages/automations.js`.',
          ].join('\n'),
          metadata: {
            workerExecution: {
              lifecycle: 'completed',
              source: 'tool_loop',
              completionReason: 'model_response',
              responseQuality: 'final',
              toolCallCount: 5,
              toolResultCount: 5,
              successfulToolResultCount: 5,
            },
          },
        };
      }
      return {
        content: [
          'The filename searches found matches for "progress" and "timeline", but the tool output was truncated and I cannot surface the exact file names yet.',
          'I would need to drill into likely directories next.',
        ].join(' '),
        metadata: {
          workerExecution: {
            lifecycle: 'completed',
            source: 'tool_loop',
            completionReason: 'tool_result_recovery',
            responseQuality: 'final',
            toolCallCount: 3,
            toolResultCount: 3,
            successfulToolResultCount: 3,
          },
        },
      };
    };

    const intentRoutingTrace = {
      record: vi.fn(),
    };
    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        getConfigSnapshot: () => {
          const config = createExecutionProfileTestConfig();
          delete config.llm['ollama-cloud-coding'];
          config.assistant.tools.preferredProviders = {
            ...config.assistant.tools.preferredProviders,
            managedCloud: '',
          };
          return config;
        },
        auditLog: { record: vi.fn() },
        registry: {
          get: (agentId: string) => agentId === 'local'
            ? {
                agent: { name: 'Guardian Agent' },
                definition: {
                  orchestration: {
                    role: 'explorer',
                    label: 'Workspace Explorer',
                    lenses: ['coding-workspace'],
                  },
                },
              }
            : undefined,
        },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
      undefined,
      {
        intentRoutingTrace,
        now: () => 400_200,
      },
    );

    const result = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-retry-same-profile-exact-files',
        userId: 'tester',
        channel: 'web',
        content: 'Inspect the repo and name the client-side files that render live progress or timeline activity. Do not edit anything.',
        metadata: repoGroundedCodingMetadata(),
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      additionalSections: [],
      toolContext: '',
      runtimeNotices: [],
      executionProfile: {
        id: 'openai-frontier',
        providerName: 'openai-frontier',
        providerType: 'openai',
        providerModel: 'gpt-5.4',
        providerLocality: 'external',
        providerTier: 'frontier',
        requestedTier: 'external',
        preferredAnswerPath: 'tool_loop',
        expectedContextPressure: 'medium',
        contextBudget: 32_000,
        toolContextMode: 'tight',
        maxAdditionalSections: 2,
        maxRuntimeNotices: 2,
        fallbackProviderOrder: ['openai-frontier'],
        reason: 'frontier repo inspection profile selected',
        routingMode: 'auto',
        selectionSource: 'delegated_role',
      },
      delegation: {
        requestId: 'm-retry-same-profile-exact-files',
        executionId: 'exec-retry-same-profile-exact-files',
        rootExecutionId: 'exec-retry-same-profile-exact-files-root',
        originChannel: 'web',
        orchestration: {
          role: 'explorer',
          label: 'Workspace Explorer',
          lenses: ['coding-workspace'],
        },
      },
    });

    expect(dispatchProfiles).toEqual(['openai-frontier', 'openai-frontier']);
    expect(result.content).toContain('web/public/js/chat-panel.js');
    expect(result.content).toContain('web/public/js/chat-run-tracking.js');
    expect(result.content).toContain('web/public/js/pages/code.js');
    expect(intentRoutingTrace.record.mock.calls.map(([entry]) => entry.stage)).toEqual([
      'delegated_worker_started',
      'delegated_worker_running',
      'delegated_worker_retrying',
      'delegated_worker_contract_reconciled',
      'delegated_claim_emitted',
      'delegated_verification_decided',
      'delegated_worker_completed',
    ]);

    manager.shutdown();
  });

  it('escalates exact-file delegated repo inspections from derived workspace intent when pre-routed metadata is unavailable', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    const dispatchProfiles: Array<string | undefined> = [];
    workerMessageHandler = (params) => {
      const executionProfile = params.executionProfile as { providerName?: string; providerTier?: string } | undefined;
      dispatchProfiles.push(executionProfile?.providerName);
      if (executionProfile?.providerTier === 'frontier') {
        return {
          content: [
            'Delegated worker progress is implemented in `src/supervisor/worker-manager.ts` and `src/runtime/run-timeline.ts`.',
            'Run timeline rendering is implemented in `web/public/js/chat-panel.js` and `web/public/js/chat-run-tracking.js`.',
          ].join('\n'),
          metadata: {
            workerExecution: {
              lifecycle: 'completed',
              source: 'tool_loop',
              completionReason: 'model_response',
              responseQuality: 'final',
              toolCallCount: 4,
              toolResultCount: 4,
              successfulToolResultCount: 4,
            },
          },
        };
      }
      return {
        content: 'The searches confirmed the files exist, but the detailed match output was truncated so I cannot give you exact file paths with confidence. Would you like me to run narrower searches?',
        metadata: {
          workerExecution: {
            lifecycle: 'completed',
            source: 'tool_loop',
            completionReason: 'tool_result_recovery',
            responseQuality: 'final',
            toolCallCount: 3,
            toolResultCount: 3,
            successfulToolResultCount: 3,
          },
        },
      };
    };

    const intentRoutingTrace = {
      record: vi.fn(),
    };
    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        getConfigSnapshot: () => createExecutionProfileTestConfig(),
        auditLog: { record: vi.fn() },
        registry: {
          get: (agentId: string) => agentId === 'local'
            ? {
                agent: { name: 'Guardian Agent' },
                definition: {
                  orchestration: {
                    role: 'explorer',
                    label: 'Workspace Explorer',
                    lenses: ['coding-workspace'],
                  },
                },
              }
            : undefined,
        },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
      undefined,
      {
        intentRoutingTrace,
        now: () => 654_321,
      },
    );

    const result = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-retry-derived-exact-files',
        userId: 'tester',
        channel: 'web',
        content: 'Inspect this repo and tell me which files implement delegated worker progress and run timeline rendering. Do not edit anything.',
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      additionalSections: [],
      toolContext: '',
      runtimeNotices: [],
      executionProfile: {
        id: 'managed_cloud_tool',
        providerName: 'ollama-cloud-coding',
        providerType: 'ollama_cloud',
        providerModel: 'minimax-m2.7',
        providerLocality: 'external',
        providerTier: 'managed_cloud',
        requestedTier: 'external',
        preferredAnswerPath: 'tool_loop',
        expectedContextPressure: 'medium',
        contextBudget: 32_000,
        toolContextMode: 'tight',
        maxAdditionalSections: 2,
        maxRuntimeNotices: 2,
        fallbackProviderOrder: ['ollama-cloud-coding', 'openai-frontier'],
        reason: 'delegated coding role selected managed-cloud coding profile',
        routingMode: 'auto',
        selectionSource: 'delegated_role',
      },
      delegation: {
        requestId: 'm-retry-derived-exact-files',
        executionId: 'exec-retry-derived-exact-files',
        rootExecutionId: 'exec-retry-derived-root',
        originChannel: 'web',
        orchestration: {
          role: 'explorer',
          label: 'Workspace Explorer',
          lenses: ['coding-workspace'],
        },
      },
    });

    expect(dispatchProfiles).toEqual(['ollama-cloud-coding', 'openai-frontier']);
    expect(result.content).toContain('src/supervisor/worker-manager.ts');
    expect(result.content).toContain('src/runtime/run-timeline.ts');
    expect(result.content).toContain('web/public/js/chat-panel.js');
    expect(result.content).toContain('web/public/js/chat-run-tracking.js');
    expect(intentRoutingTrace.record.mock.calls.map(([entry]) => entry.stage)).toEqual([
      'delegated_worker_started',
      'delegated_worker_running',
      'delegated_worker_retrying',
      'delegated_worker_contract_reconciled',
      'delegated_claim_emitted',
      'delegated_verification_decided',
      'delegated_worker_completed',
    ]);
    expect(intentRoutingTrace.record.mock.calls[0]?.[0]).toMatchObject({
      stage: 'delegated_worker_started',
      details: {
        delegatedIntentSource: 'delegated_derived',
        delegatedIntentRoute: 'coding_task',
        delegatedIntentExecutionClass: 'repo_grounded',
        delegatedIntentRequiresRepoGrounding: true,
      },
    });

    manager.shutdown();
  });

  it('retries delegated repo inspections that answer code-path requests with an ungrounded "not found" summary', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    const dispatchProfiles: Array<string | undefined> = [];
    workerMessageHandler = (params) => {
      const executionProfile = params.executionProfile as { providerName?: string; providerTier?: string } | undefined;
      dispatchProfiles.push(executionProfile?.providerName);
      if (executionProfile?.providerTier === 'frontier') {
        return {
          content: [
            'Delegated worker progress is rendered in `web/public/js/chat-panel.js`.',
            'The run timeline client-side updates are normalized in `web/public/js/chat-run-tracking.js`.',
          ].join('\n'),
          metadata: {
            workerExecution: {
              lifecycle: 'completed',
              source: 'tool_loop',
              completionReason: 'model_response',
              responseQuality: 'final',
              toolCallCount: 4,
              toolResultCount: 4,
              successfulToolResultCount: 4,
            },
          },
        };
      }
      return {
        content: [
          'The search found no client-side files matching "progress", "timeline", "activity", or "live render" patterns.',
          'This aligns with the repo profile: GuardianAgent is a backend Node.js/TypeScript agent project, not a frontend UI application.',
          'Repo map directories show no client/, ui/, or src/ client folders listed.',
        ].join(' '),
        metadata: {
          workerExecution: {
            lifecycle: 'completed',
            source: 'tool_loop',
            completionReason: 'model_response',
            responseQuality: 'final',
            toolCallCount: 4,
            toolResultCount: 4,
            successfulToolResultCount: 4,
          },
        },
      };
    };

    const intentRoutingTrace = {
      record: vi.fn(),
    };
    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        getConfigSnapshot: () => createExecutionProfileTestConfig(),
        auditLog: { record: vi.fn() },
        registry: {
          get: (agentId: string) => agentId === 'local'
            ? {
                agent: { name: 'Guardian Agent' },
                definition: {
                  orchestration: {
                    role: 'explorer',
                    label: 'Workspace Explorer',
                    lenses: ['coding-workspace'],
                  },
                },
              }
            : undefined,
        },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
      undefined,
      {
        intentRoutingTrace,
        now: () => 777_100,
      },
    );

    const result = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-retry-code-paths',
        userId: 'tester',
        channel: 'web',
        content: 'Inspect the repo and summarize where delegated worker progress is rendered in the web UI. Name the client-side code paths only.',
        metadata: repoGroundedCodingMetadata(),
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      additionalSections: [],
      toolContext: '',
      runtimeNotices: [],
      executionProfile: {
        id: 'managed_cloud_tool',
        providerName: 'ollama-cloud-coding',
        providerType: 'ollama_cloud',
        providerModel: 'minimax-m2.7',
        providerLocality: 'external',
        providerTier: 'managed_cloud',
        requestedTier: 'external',
        preferredAnswerPath: 'tool_loop',
        expectedContextPressure: 'medium',
        contextBudget: 32_000,
        toolContextMode: 'tight',
        maxAdditionalSections: 2,
        maxRuntimeNotices: 2,
        fallbackProviderOrder: ['ollama-cloud-coding', 'openai-frontier'],
        reason: 'delegated coding role selected managed-cloud coding profile',
        routingMode: 'auto',
        selectionSource: 'delegated_role',
      },
      delegation: {
        requestId: 'm-retry-code-paths',
        executionId: 'exec-retry-code-paths',
        rootExecutionId: 'exec-retry-code-paths-root',
        originChannel: 'web',
        orchestration: {
          role: 'explorer',
          label: 'Workspace Explorer',
          lenses: ['coding-workspace'],
        },
      },
    });

    expect(dispatchProfiles).toEqual(['ollama-cloud-coding', 'openai-frontier']);
    expect(result.content).toContain('web/public/js/chat-panel.js');
    expect(result.content).toContain('web/public/js/chat-run-tracking.js');
    expect(intentRoutingTrace.record.mock.calls.map(([entry]) => entry.stage)).toEqual([
      'delegated_worker_started',
      'delegated_worker_running',
      'delegated_worker_retrying',
      'delegated_worker_contract_reconciled',
      'delegated_claim_emitted',
      'delegated_verification_decided',
      'delegated_worker_completed',
    ]);

    manager.shutdown();
  });

  it('retries imperative client-side file requests when the delegated worker stops at truncated filename-search summaries', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    const dispatchProfiles: Array<string | undefined> = [];
    workerMessageHandler = (params) => {
      const executionProfile = params.executionProfile as { providerName?: string; providerTier?: string } | undefined;
      dispatchProfiles.push(executionProfile?.providerName);
      if (executionProfile?.providerTier === 'frontier') {
        return {
          content: [
            'Live progress in chat is rendered in `web/public/js/chat-panel.js` and matched in `web/public/js/chat-run-tracking.js`.',
            'Broader timeline activity is rendered in `web/public/js/pages/code.js`, `web/public/js/pages/system.js`, and `web/public/js/pages/automations.js`.',
          ].join('\n'),
          metadata: {
            workerExecution: {
              lifecycle: 'completed',
              source: 'tool_loop',
              completionReason: 'model_response',
              responseQuality: 'final',
              toolCallCount: 5,
              toolResultCount: 5,
              successfulToolResultCount: 5,
            },
          },
        };
      }
      return {
        content: [
          'The filename searches this time did find matches, but the tool output was truncated and I cannot see the actual file names from the serialized results.',
          'The repo has a `demo/` directory and an `examples/` directory at the top level, which are the most likely locations for any client-side rendering code.',
          'To get you the specific file names, I would need to do a focused `fs_list` on those directories or read the search results at a narrower scope. Want me to drill into those directories next?',
        ].join(' '),
        metadata: {
          workerExecution: {
            lifecycle: 'completed',
            source: 'tool_loop',
            completionReason: 'tool_result_recovery',
            responseQuality: 'final',
            toolCallCount: 4,
            toolResultCount: 4,
            successfulToolResultCount: 4,
          },
        },
      };
    };

    const intentRoutingTrace = {
      record: vi.fn(),
    };
    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        getConfigSnapshot: () => createExecutionProfileTestConfig(),
        auditLog: { record: vi.fn() },
        registry: {
          get: (agentId: string) => agentId === 'local'
            ? {
                agent: { name: 'Guardian Agent' },
                definition: {
                  orchestration: {
                    role: 'explorer',
                    label: 'Workspace Explorer',
                    lenses: ['coding-workspace'],
                  },
                },
              }
            : undefined,
        },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
      undefined,
      {
        intentRoutingTrace,
        now: () => 777_150,
      },
    );

    const result = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-retry-client-side-files',
        userId: 'tester',
        channel: 'web',
        content: 'Inspect the repo and name the client-side files that render live progress or timeline activity. Do not edit anything.',
        metadata: repoGroundedCodingMetadata(),
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      additionalSections: [],
      toolContext: '',
      runtimeNotices: [],
      executionProfile: {
        id: 'managed_cloud_tool',
        providerName: 'ollama-cloud-coding',
        providerType: 'ollama_cloud',
        providerModel: 'minimax-m2.7',
        providerLocality: 'external',
        providerTier: 'managed_cloud',
        requestedTier: 'external',
        preferredAnswerPath: 'tool_loop',
        expectedContextPressure: 'medium',
        contextBudget: 32_000,
        toolContextMode: 'tight',
        maxAdditionalSections: 2,
        maxRuntimeNotices: 2,
        fallbackProviderOrder: ['ollama-cloud-coding', 'openai-frontier'],
        reason: 'delegated coding role selected managed-cloud coding profile',
        routingMode: 'auto',
        selectionSource: 'delegated_role',
      },
      delegation: {
        requestId: 'm-retry-client-side-files',
        executionId: 'exec-retry-client-side-files',
        rootExecutionId: 'exec-retry-client-side-files-root',
        originChannel: 'web',
        orchestration: {
          role: 'explorer',
          label: 'Workspace Explorer',
          lenses: ['coding-workspace'],
        },
      },
    });

    expect(dispatchProfiles).toEqual(['ollama-cloud-coding', 'openai-frontier']);
    expect(result.content).toContain('web/public/js/chat-panel.js');
    expect(result.content).toContain('web/public/js/chat-run-tracking.js');
    expect(result.content).toContain('web/public/js/pages/system.js');
    expect(intentRoutingTrace.record.mock.calls.map(([entry]) => entry.stage)).toEqual([
      'delegated_worker_started',
      'delegated_worker_running',
      'delegated_worker_retrying',
      'delegated_worker_contract_reconciled',
      'delegated_claim_emitted',
      'delegated_verification_decided',
      'delegated_worker_completed',
    ]);

    manager.shutdown();
  });

  it('retries delegated repo inspections that claim they cannot identify the requested files and functions', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    const dispatchProfiles: Array<string | undefined> = [];
    workerMessageHandler = (params) => {
      const executionProfile = params.executionProfile as { providerName?: string; providerTier?: string } | undefined;
      dispatchProfiles.push(executionProfile?.providerName);
      if (executionProfile?.providerTier === 'frontier') {
        return {
          content: [
            'Delegated local model selection is aligned in `src/runtime/execution-profiles.ts`.',
            'The explicit local default provider resolution is applied in `resolveDelegatedExecutionDecision` and `selectEscalatedDelegatedExecutionProfile`.',
          ].join('\n'),
          metadata: {
            workerExecution: {
              lifecycle: 'completed',
              source: 'tool_loop',
              completionReason: 'model_response',
              responseQuality: 'final',
              toolCallCount: 3,
              toolResultCount: 3,
              successfulToolResultCount: 3,
            },
          },
        };
      }
      return {
        content: 'Based on the tool results available in this conversation, I cannot identify any files or functions that keep delegated local model selection aligned with an explicit local default provider.',
        metadata: {
          workerExecution: {
            lifecycle: 'completed',
            source: 'tool_loop',
            completionReason: 'model_response',
            responseQuality: 'final',
            toolCallCount: 3,
            toolResultCount: 3,
            successfulToolResultCount: 3,
          },
        },
      };
    };

    const intentRoutingTrace = {
      record: vi.fn(),
    };
    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        getConfigSnapshot: () => createExecutionProfileTestConfig(),
        auditLog: { record: vi.fn() },
        registry: {
          get: (agentId: string) => agentId === 'local'
            ? {
                agent: { name: 'Guardian Agent' },
                definition: {
                  orchestration: {
                    role: 'explorer',
                    label: 'Provider Explorer',
                    lenses: ['coding-workspace'],
                  },
                },
              }
            : undefined,
        },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
      undefined,
      {
        intentRoutingTrace,
        now: () => 777_200,
      },
    );

    const result = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-retry-files-and-functions',
        userId: 'tester',
        channel: 'web',
        content: 'Inspect the repo and tell me which files and functions now keep delegated local model selection aligned with an explicit local default provider. Cite exact file names and function names.',
        metadata: repoGroundedCodingMetadata(),
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      additionalSections: [],
      toolContext: '',
      runtimeNotices: [],
      executionProfile: {
        id: 'managed_cloud_tool',
        providerName: 'ollama-cloud-tools',
        providerType: 'ollama_cloud',
        providerModel: 'glm-4.7',
        providerLocality: 'external',
        providerTier: 'managed_cloud',
        requestedTier: 'external',
        preferredAnswerPath: 'tool_loop',
        expectedContextPressure: 'medium',
        contextBudget: 32_000,
        toolContextMode: 'tight',
        maxAdditionalSections: 2,
        maxRuntimeNotices: 2,
        fallbackProviderOrder: ['ollama-cloud-tools', 'openai-frontier'],
        reason: 'delegated explorer selected managed-cloud tools profile',
        routingMode: 'auto',
        selectionSource: 'delegated_role',
      },
      delegation: {
        requestId: 'm-retry-files-and-functions',
        executionId: 'exec-retry-files-and-functions',
        rootExecutionId: 'exec-retry-files-and-functions-root',
        originChannel: 'web',
        orchestration: {
          role: 'explorer',
          label: 'Provider Explorer',
          lenses: ['coding-workspace'],
        },
      },
    });

    expect(dispatchProfiles).toEqual(['ollama-cloud-tools', 'openai-frontier']);
    expect(result.content).toContain('src/runtime/execution-profiles.ts');
    expect(result.content).toContain('resolveDelegatedExecutionDecision');
    expect(result.content).toContain('selectEscalatedDelegatedExecutionProfile');
    expect(intentRoutingTrace.record.mock.calls.map(([entry]) => entry.stage)).toEqual([
      'delegated_worker_started',
      'delegated_worker_running',
      'delegated_worker_retrying',
      'delegated_worker_contract_reconciled',
      'delegated_claim_emitted',
      'delegated_verification_decided',
      'delegated_worker_completed',
    ]);

    manager.shutdown();
  });

  it('retries non-terminal delegated workspace progress updates on a stronger frontier profile', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    const dispatchProfiles: Array<string | undefined> = [];
    workerMessageHandler = (params) => {
      const executionProfile = params.executionProfile as { providerName?: string; providerTier?: string } | undefined;
      dispatchProfiles.push(executionProfile?.providerName);
      if (executionProfile?.providerTier === 'frontier') {
        return {
          content: 'The delegated worker progress implementation lives in `src/supervisor/worker-manager.ts`, and the run timeline rendering path lives in `web/public/js/chat-panel.js`.',
          metadata: {
            workerExecution: {
              lifecycle: 'completed',
              source: 'tool_loop',
              completionReason: 'model_response',
              responseQuality: 'final',
              toolCallCount: 2,
              toolResultCount: 2,
              successfulToolResultCount: 2,
            },
          },
        };
      }
      return {
        content: 'I will inspect the repository first and then return the exact files.',
        metadata: {
          workerExecution: {
            lifecycle: 'failed',
            source: 'tool_loop',
            completionReason: 'intermediate_response',
            responseQuality: 'intermediate',
            toolCallCount: 1,
            toolResultCount: 0,
          },
        },
      };
    };

    const intentRoutingTrace = {
      record: vi.fn(),
    };
    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        getConfigSnapshot: () => createExecutionProfileTestConfig(),
        auditLog: { record: vi.fn() },
        registry: {
          get: (agentId: string) => agentId === 'local'
            ? {
                agent: { name: 'Guardian Agent' },
                definition: {
                  orchestration: {
                    role: 'explorer',
                    label: 'Workspace Explorer',
                    lenses: ['coding-workspace'],
                  },
                },
              }
            : undefined,
        },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
      undefined,
      {
        intentRoutingTrace,
        now: () => 777_000,
      },
    );

    const result = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-retry-terminal-result',
        userId: 'tester',
        channel: 'web',
        content: 'Inspect this repo and tell me which files implement delegated worker progress and run timeline rendering. Do not edit anything.',
        metadata: repoGroundedCodingMetadata(),
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      additionalSections: [],
      toolContext: '',
      runtimeNotices: [],
      executionProfile: {
        id: 'managed_cloud_tool',
        providerName: 'ollama-cloud-coding',
        providerType: 'ollama_cloud',
        providerModel: 'glm-5.1',
        providerLocality: 'external',
        providerTier: 'managed_cloud',
        requestedTier: 'external',
        preferredAnswerPath: 'tool_loop',
        expectedContextPressure: 'medium',
        contextBudget: 32_000,
        toolContextMode: 'tight',
        maxAdditionalSections: 2,
        maxRuntimeNotices: 2,
        fallbackProviderOrder: ['ollama-cloud-coding', 'openai-frontier'],
        reason: 'delegated coding role selected managed-cloud coding profile',
        routingMode: 'auto',
        selectionSource: 'delegated_role',
      },
      delegation: {
        requestId: 'm-retry-terminal-result',
        executionId: 'exec-retry-terminal-result',
        rootExecutionId: 'exec-retry-terminal-root',
        originChannel: 'web',
        orchestration: {
          role: 'explorer',
          label: 'Workspace Explorer',
          lenses: ['coding-workspace'],
        },
      },
    });

    expect(dispatchProfiles).toEqual(['ollama-cloud-coding', 'openai-frontier']);
    expect(result.content).toContain('src/supervisor/worker-manager.ts');
    expect(result.content).toContain('web/public/js/chat-panel.js');
    expect(result.metadata?.responseSource).toMatchObject({
      providerName: 'openai',
      providerTier: 'frontier',
    });
    expect(intentRoutingTrace.record.mock.calls.map(([entry]) => entry.stage)).toEqual([
      'delegated_worker_started',
      'delegated_worker_running',
      'delegated_worker_retrying',
      'delegated_worker_contract_reconciled',
      'delegated_claim_emitted',
      'delegated_verification_decided',
      'delegated_worker_completed',
    ]);
    expect(intentRoutingTrace.record.mock.calls[2]?.[0]).toMatchObject({
      stage: 'delegated_worker_retrying',
      details: {
        reason: expect.stringContaining('required steps remain unsatisfied'),
        executionProfileName: 'openai-frontier',
        executionProfileTier: 'frontier',
      },
    });

    manager.shutdown();
  });

  it('keeps delegated retry guidance advisory without carrying prior receipts into the worker', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    const retryDirectives: string[] = [];
    let dispatchCount = 0;
    workerMessageHandler = (params) => {
      dispatchCount += 1;
      const retryDirective = Array.isArray(params.additionalSections)
        ? (params.additionalSections as Array<{ section?: string; content?: string }>)
            .find((section) => section.section === 'Delegated Retry Directive')?.content ?? ''
        : '';
      retryDirectives.push(retryDirective);

      if (dispatchCount === 1) {
        const gatewayDecision = readPreRoutedIntentGatewayMetadata(repoGroundedCodingMetadata())?.decision;
        const taskContract = buildDelegatedTaskContract(gatewayDecision);
        return {
          content: 'I found likely files, but I still need to inspect them directly.',
          metadata: buildDelegatedExecutionMetadata({
            taskContract,
            runStatus: 'incomplete',
            stopReason: 'end_turn',
            stepReceipts: [
              {
                stepId: 'step_1',
                status: 'satisfied',
                evidenceReceiptIds: ['receipt-search'],
                summary: 'Search found candidate files.',
                startedAt: 1,
                endedAt: 2,
              },
              {
                stepId: 'step_2',
                status: 'failed',
                evidenceReceiptIds: [],
                summary: 'Read the specific implementation files needed to ground the exact file references.',
                startedAt: 0,
                endedAt: 0,
              },
              {
                stepId: 'step_3',
                status: 'satisfied',
                evidenceReceiptIds: ['receipt-answer'],
                summary: 'The likely files are src/support/workerProgress.ts and src/timeline/renderTimeline.ts.',
                startedAt: 3,
                endedAt: 4,
              },
            ],
            operatorSummary: 'The likely files are src/support/workerProgress.ts and src/timeline/renderTimeline.ts.',
            claims: [],
            evidenceReceipts: [
              {
                receiptId: 'receipt-search',
                sourceType: 'tool_call',
                toolName: 'fs_search',
                status: 'succeeded',
                refs: [
                  'src/supervisor/worker-manager.ts',
                  'src/runtime/run-timeline.ts',
                  'web/public/js/chat-panel.js',
                  'web/public/js/chat-run-tracking.js',
                ],
                summary: 'Search found candidate implementation files.',
                startedAt: 1,
                endedAt: 2,
              },
              {
                receiptId: 'receipt-answer',
                sourceType: 'model_answer',
                status: 'succeeded',
                refs: [],
                summary: 'The likely files are src/support/workerProgress.ts and src/timeline/renderTimeline.ts.',
                startedAt: 3,
                endedAt: 4,
              },
            ],
            interruptions: [],
            artifacts: [],
            events: [],
          }),
        };
      }

      return {
        content: 'The delegated worker progress implementation lives in `src/supervisor/worker-manager.ts`, and the run timeline rendering path lives in `web/public/js/chat-panel.js`.',
        metadata: {
          workerExecution: {
            lifecycle: 'completed',
            source: 'tool_loop',
            completionReason: 'model_response',
            responseQuality: 'final',
            toolCallCount: 2,
            toolResultCount: 2,
            successfulToolResultCount: 2,
          },
        },
      };
    };

    const intentRoutingTrace = {
      record: vi.fn(),
    };
    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        getConfigSnapshot: () => createExecutionProfileTestConfig(),
        auditLog: { record: vi.fn() },
        registry: {
          get: (agentId: string) => agentId === 'local'
            ? {
                agent: { name: 'Guardian Agent' },
                definition: {
                  orchestration: {
                    role: 'explorer',
                    label: 'Workspace Explorer',
                    lenses: ['coding-workspace'],
                  },
                },
              }
            : undefined,
        },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
      undefined,
      {
        intentRoutingTrace,
        now: () => 888_000,
      },
    );

    const result = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-exact-file-retry-deps',
        userId: 'tester',
        channel: 'web',
        content: 'Inspect this repo and tell me which files implement delegated worker progress and run timeline rendering. Do not edit anything.',
        metadata: repoGroundedCodingMetadata(),
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      additionalSections: [],
      toolContext: '',
      runtimeNotices: [],
      executionProfile: {
        id: 'managed_cloud_tool',
        providerName: 'ollama-cloud-coding',
        providerType: 'ollama_cloud',
        providerModel: 'glm-5.1',
        providerLocality: 'external',
        providerTier: 'managed_cloud',
        requestedTier: 'external',
        preferredAnswerPath: 'tool_loop',
        expectedContextPressure: 'medium',
        contextBudget: 32_000,
        toolContextMode: 'tight',
        maxAdditionalSections: 2,
        maxRuntimeNotices: 2,
        fallbackProviderOrder: ['ollama-cloud-coding', 'openai-frontier'],
        reason: 'delegated coding role selected managed-cloud coding profile',
        routingMode: 'auto',
        selectionSource: 'delegated_role',
      },
      delegation: {
        requestId: 'm-exact-file-retry-deps',
        executionId: 'exec-exact-file-retry-deps',
        rootExecutionId: 'exec-exact-file-retry-root',
        originChannel: 'web',
        orchestration: {
          role: 'explorer',
          label: 'Workspace Explorer',
          lenses: ['coding-workspace'],
        },
      },
    });

    expect(result.content).toContain('src/supervisor/worker-manager.ts');
    expect(result.content).toContain('web/public/js/chat-panel.js');
    expect(retryDirectives[1]).toContain('Grounded file/path candidates from already satisfied steps:');
    expect(retryDirectives[1]).toContain('src/supervisor/worker-manager.ts');
    expect(retryDirectives[1]).toContain('src/runtime/run-timeline.ts');
    expect(retryDirectives[1]).toContain('web/public/js/chat-panel.js');
    expect(retryDirectives[1]).toContain('Reuse those grounded candidates before starting any new speculative search.');
    expect(intentRoutingTrace.record.mock.calls[2]?.[0]).toMatchObject({
      stage: 'delegated_worker_retrying',
    });

    manager.shutdown();
  });

  it('records validated recovery-advisor guidance as advisory graph recovery without a final worker retry', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    const dispatchModes: string[] = [];
    workerMessageHandler = (params) => {
      if (params.recoveryAdvisor) {
        dispatchModes.push('advisor');
        return {
          content: JSON.stringify({
            decision: 'retry',
            reason: 'The write step has no filesystem mutation receipt.',
            actions: [{
              stepId: 'step_2',
              strategy: 'complete_missing_write',
              toolName: 'fs_write',
            }],
          }),
          metadata: {
            recoveryAdvisor: {
              available: true,
              proposal: {
                decision: 'retry',
                reason: 'The write step has no filesystem mutation receipt.',
                actions: [{
                  stepId: 'step_2',
                  strategy: 'complete_missing_write',
                  toolName: 'fs_write',
                }],
              },
            },
          },
        };
      }

      dispatchModes.push('worker');

      const gatewayDecision = readPreRoutedIntentGatewayMetadata(filesystemSearchWriteMetadata())?.decision;
      const taskContract = buildDelegatedTaskContract(gatewayDecision);
      return {
        content: 'I searched src/runtime for planned_steps but did not write the summary file.',
        metadata: buildDelegatedExecutionMetadata({
          taskContract,
          runStatus: 'incomplete',
          stopReason: 'end_turn',
          stepReceipts: taskContract.plan.steps.map((step) => ({
            stepId: step.stepId,
            status: step.stepId === 'step_1' ? 'satisfied' as const : 'failed' as const,
            evidenceReceiptIds: step.stepId === 'step_1'
              ? [`receipt-${step.stepId}`]
              : [],
            summary: step.summary,
            startedAt: 1,
            endedAt: 2,
          })),
          operatorSummary: 'I searched src/runtime for planned_steps but did not write the summary file.',
          claims: [],
          evidenceReceipts: [
            {
              receiptId: 'receipt-step_1',
              sourceType: 'tool_call',
              toolName: 'fs_search',
              status: 'succeeded',
              refs: ['src/runtime/intent/route-classifier.ts'],
              summary: 'Searched src/runtime for planned_steps.',
              startedAt: 1,
              endedAt: 2,
            },
          ],
          interruptions: [],
          artifacts: [],
          events: [],
        }),
      };
    };

    const jobs = [
      {
        id: 'job-planned-steps-search',
        toolName: 'fs_search',
        status: 'succeeded',
        requestId: 'm-search-write-recovery',
        argsPreview: '{"path":"src/runtime","query":"planned_steps","mode":"content"}',
        resultPreview: '{"matches":[{"path":"src/runtime/intent/route-classifier.ts"}]}',
        createdAt: 10,
        startedAt: 20,
        completedAt: 30,
      },
      {
        id: 'job-planned-steps-write',
        toolName: 'fs_write',
        status: 'succeeded',
        requestId: 'm-search-write-recovery',
        argsPreview: '{"path":"tmp/manual-web/planned-steps-summary.txt","content":"planned_steps summary"}',
        resultPreview: '{"path":"tmp/manual-web/planned-steps-summary.txt","bytesWritten":21}',
        createdAt: 40,
        startedAt: 50,
        completedAt: 60,
      },
    ];
    const intentRoutingTrace = {
      record: vi.fn(),
    };
    const runTimeline = {
      ingestDelegatedWorkerProgress: vi.fn(),
      ingestDelegatedExecutionEvents: vi.fn(),
      ingestExecutionGraphEvent: vi.fn(),
    };
    const executionGraphStore = new ExecutionGraphStore({
      now: () => 1_010_000,
    });
    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
        listJobs: vi.fn(() => jobs.slice(0, 1)),
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        auditLog: { record: vi.fn() },
        registry: {
          get: (agentId: string) => agentId === 'local'
            ? {
                agent: { name: 'Guardian Agent' },
                definition: {
                  orchestration: {
                    role: 'implementer',
                    label: 'Workspace Implementer',
                    lenses: ['coding-workspace'],
                  },
                },
              }
            : undefined,
        },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
      undefined,
      {
        intentRoutingTrace,
        runTimeline,
        executionGraphStore,
        now: () => 1_010_000,
      },
    );

    const result = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-search-write-recovery',
        userId: 'tester',
        channel: 'web',
        content: 'Search src/runtime for planned_steps. Write a short summary of what you find to tmp/manual-web/planned-steps-summary.txt.',
        metadata: filesystemSearchWriteMetadata(),
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      additionalSections: [],
      toolContext: '',
      runtimeNotices: [],
      delegation: {
        requestId: 'm-search-write-recovery',
        executionId: 'exec-search-write-recovery',
        rootExecutionId: 'exec-search-write-root',
        originChannel: 'web',
        orchestration: {
          role: 'implementer',
          label: 'Workspace Implementer',
          lenses: ['coding-workspace'],
        },
      },
    });

    expect(dispatchModes).toEqual(['worker', 'advisor']);
    expect(result.content).toContain('Delegated work failed.');
    expect(result.content).toContain('step_2 (Write a short summary');
    expect(result.metadata?.executionGraphRecovery).toMatchObject({
      adviceSource: 'llm',
      actionKinds: ['retry_node'],
    });
    const recoveryMetadata = result.metadata?.executionGraphRecovery as { graphId?: string } | undefined;
    const graphId = recoveryMetadata?.graphId ?? '';
    const graphEvents = runTimeline.ingestExecutionGraphEvent.mock.calls.map(([event]) => event);
    const delegatedEvents = graphEvents.filter((event) => event.graphId.endsWith(':delegated-worker'));
    expect(delegatedEvents.map((event) => event.kind)).toEqual([
      'graph_started',
      'node_started',
      'artifact_created',
      'verification_completed',
      'node_failed',
      'graph_failed',
    ]);
    const delegatedSnapshot = executionGraphStore.getSnapshot(delegatedEvents[0]?.graphId ?? '');
    expect(delegatedSnapshot?.graph.status).toBe('failed');
    expect(delegatedSnapshot?.graph.nodes.map((node) => [node.kind, node.status])).toEqual([
      ['delegated_worker', 'failed'],
    ]);
    expect(executionGraphStore.listArtifacts(delegatedEvents[0]?.graphId ?? '').map((artifact) => artifact.artifactType)).toEqual([
      'VerificationResult',
    ]);
    expect(result.metadata?.executionGraph).toMatchObject({
      graphId: delegatedEvents[0]?.graphId,
      status: 'failed',
      lifecycle: 'failed',
      verificationArtifactId: expect.stringContaining(':verification'),
    });
    expect(manager.getJobState(5).jobs[0]?.metadata).toMatchObject({
      delegation: {
        executionGraph: {
          graphId: delegatedEvents[0]?.graphId,
          nodeId: expect.stringContaining(':delegated_worker'),
          status: 'failed',
          lifecycle: 'failed',
          verificationArtifactId: expect.stringContaining(':verification'),
        },
      },
    });
    const recoveryEvents = graphEvents.filter((event) => event.graphId === graphId);
    expect(recoveryEvents.map((event) => event.kind)).toEqual([
      'graph_started',
      'node_started',
      'artifact_created',
      'recovery_proposed',
      'node_completed',
      'graph_completed',
    ]);
    const recoverySnapshot = executionGraphStore.getSnapshot(graphId);
    expect(recoverySnapshot?.graph.status).toBe('completed');
    expect(recoverySnapshot?.graph.nodes.map((node) => [node.kind, node.status])).toEqual([
      ['delegated_worker', 'failed'],
      ['recover', 'completed'],
    ]);
    expect(recoverySnapshot?.events.map((event) => event.kind)).toEqual([
      'graph_started',
      'node_started',
      'artifact_created',
      'recovery_proposed',
      'node_completed',
      'graph_completed',
    ]);
    expect(executionGraphStore.listArtifacts(graphId).map((artifact) => artifact.artifactType)).toEqual([
      'RecoveryProposal',
    ]);
    expect(intentRoutingTrace.record.mock.calls.map(([entry]) => entry.stage)).toEqual(expect.arrayContaining([
      'recovery_advisor_started',
      'recovery_advisor_completed',
      'delegated_worker_failed',
    ]));

    manager.shutdown();
  });

  it('runs read/write repo tasks through the graph controller without delegated handoff', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    const dispatchModes: string[] = [];
    workerMessageHandler = (params) => {
      const directReasoning = params.directReasoning === true;
      const groundedSynthesis = !!params.groundedSynthesis;
      dispatchModes.push(directReasoning ? 'direct' : groundedSynthesis ? 'synthesis' : 'delegated');
      const gateway = readPreRoutedIntentGatewayMetadata(
        (params.message as { metadata?: Record<string, unknown> } | undefined)?.metadata,
      );

      if (directReasoning) {
        expect(gateway?.decision.operation).toBe('search');
        expect(gateway?.decision.executionClass).toBe('repo_grounded');
        expect((params.message as { content?: string } | undefined)?.content).toContain('Read-only execution graph exploration node');
        const context = params.directReasoningGraphContext as { graphId: string; nodeId: string };
        return {
          content: 'Found planned_steps references in src/runtime/intent/route-classifier.ts.',
          metadata: {
            skipTestDelegatedEnvelope: true,
            directReasoning: true,
            directReasoningMode: 'brokered_readonly',
            executionGraphArtifacts: [
              buildSearchResultSetArtifact({
                graphId: context.graphId,
                nodeId: context.nodeId,
                query: 'planned_steps',
                matches: [{ path: 'src/runtime/intent/route-classifier.ts', line: 42, snippet: 'planned_steps' }],
                createdAt: 1_111_000,
              }),
              buildFileReadSetArtifact({
                graphId: context.graphId,
                nodeId: context.nodeId,
                path: 'src/runtime/intent/route-classifier.ts',
                content: 'planned_steps appears in src/runtime/intent/route-classifier.ts.\n',
                createdAt: 1_111_000,
              }),
            ],
          },
        };
      }

      if (groundedSynthesis) {
        expect(params.groundedSynthesis).toMatchObject({
          responseFormat: {
            type: 'json_schema',
            name: 'graph_write_spec_candidate',
          },
        });
        return {
          content: JSON.stringify({
            path: 'tmp/manual-web/planned-steps-summary.txt',
            content: 'planned_steps appears in src/runtime/intent/route-classifier.ts.\n',
            append: false,
            summary: 'Summarize grounded planned_steps evidence.',
          }),
          metadata: {
            skipTestDelegatedEnvelope: true,
            groundedSynthesis: { available: true },
          },
        };
      }

      throw new Error('Delegated worker path should not run for graph-controlled read/write tasks.');
    };

    const intentRoutingTrace = {
      record: vi.fn(),
    };
    const runTimeline = {
      ingestDelegatedWorkerProgress: vi.fn(),
      ingestDelegatedExecutionEvents: vi.fn(),
      ingestExecutionGraphEvent: vi.fn(),
    };
    const executeModelTool = vi.fn(async (toolName: string, args: Record<string, unknown>) => {
      if (toolName === 'fs_write') {
        return {
          success: true,
          status: 'succeeded',
          jobId: 'job-graph-write',
          message: 'Tool fs_write completed.',
          output: { path: args.path },
        };
      }
      if (toolName === 'fs_read') {
        return {
          success: true,
          status: 'succeeded',
          jobId: 'job-graph-readback',
          message: 'Tool fs_read completed.',
          output: {
            path: args.path,
            content: 'planned_steps appears in src/runtime/intent/route-classifier.ts.\n',
          },
        };
      }
      throw new Error(`Unexpected tool ${toolName}`);
    });
    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
        listJobs: vi.fn(() => []),
        executeModelTool,
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        getConfigSnapshot: () => createExecutionProfileTestConfig(),
        auditLog: { record: vi.fn() },
        registry: {
          get: (agentId: string) => agentId === 'local'
            ? {
                agent: { name: 'Guardian Agent' },
                definition: {
                  orchestration: {
                    role: 'implementer',
                    label: 'Workspace Implementer',
                    lenses: ['coding-workspace'],
                  },
                },
              }
            : undefined,
        },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
      undefined,
      {
        intentRoutingTrace,
        runTimeline,
        now: () => 1_111_000,
      },
    );

    const result = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-search-write-graph',
        userId: 'tester',
        channel: 'web',
        content: 'Search src/runtime for planned_steps. Write a short summary of what you find to tmp/manual-web/planned-steps-summary.txt.',
        metadata: filesystemSearchWriteMetadata(),
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      additionalSections: [],
      toolContext: '',
      runtimeNotices: [],
      executionProfile: {
        id: 'managed_cloud_tool',
        providerName: 'ollama-cloud-coding',
        providerType: 'ollama_cloud',
        providerModel: 'glm-5.1',
        providerLocality: 'external',
        providerTier: 'managed_cloud',
        requestedTier: 'external',
        preferredAnswerPath: 'tool_loop',
        expectedContextPressure: 'high',
        contextBudget: 32_000,
        toolContextMode: 'tight',
        maxAdditionalSections: 2,
        maxRuntimeNotices: 2,
        fallbackProviderOrder: ['ollama-cloud-coding', 'openai-frontier'],
        reason: 'delegated coding role selected managed-cloud coding profile',
        routingMode: 'auto',
        selectionSource: 'delegated_role',
      },
      delegation: {
        requestId: 'm-search-write-graph',
        executionId: 'exec-search-write-graph',
        rootExecutionId: 'exec-search-write-root',
        originChannel: 'web',
        orchestration: {
          role: 'implementer',
          label: 'Workspace Implementer',
          lenses: ['coding-workspace'],
        },
      },
    });

    expect(dispatchModes).toEqual(['direct', 'synthesis']);
    expect(executeModelTool.mock.calls.map(([toolName]) => toolName)).toEqual(['fs_write', 'fs_read']);
    expect(runTimeline.ingestExecutionGraphEvent.mock.calls.map(([event]) => event.kind)).toEqual(expect.arrayContaining([
      'graph_started',
      'node_started',
      'tool_call_started',
      'verification_completed',
      'graph_completed',
    ]));
    const verificationEvent = runTimeline.ingestExecutionGraphEvent.mock.calls
      .map(([event]) => event)
      .find((event) => event.kind === 'verification_completed');
    expect(verificationEvent).toMatchObject({
      nodeKind: 'verify',
      nodeId: expect.stringContaining(':verify'),
    });
    expect(result.content).toContain('Wrote tmp/manual-web/planned-steps-summary.txt and verified');
    expect(result.metadata?.executionGraph).toMatchObject({
      status: 'succeeded',
      writeSpecArtifactId: expect.stringContaining('write-spec'),
      verificationArtifactId: expect.stringContaining('verification'),
    });

    manager.shutdown();
  });

  it('falls back to delegated orchestration when graph read-only evidence cannot use a non-local profile', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    const dispatchModes: string[] = [];
    workerMessageHandler = (params) => {
      const directReasoning = params.directReasoning === true;
      const groundedSynthesis = !!params.groundedSynthesis;
      dispatchModes.push(directReasoning ? 'direct' : groundedSynthesis ? 'synthesis' : 'delegated');
      expect(directReasoning).toBe(false);
      expect(groundedSynthesis).toBe(false);

      const gateway = readPreRoutedIntentGatewayMetadata(
        (params.message as { metadata?: Record<string, unknown> } | undefined)?.metadata,
      );
      const taskContract = buildDelegatedTaskContract(gateway?.decision);
      const evidenceReceipts = [
        {
          receiptId: 'fallback-search',
          sourceType: 'tool_call' as const,
          toolName: 'fs_search',
          status: 'succeeded' as const,
          refs: ['src/runtime/intent/route-classifier.ts'],
          summary: 'Searched src/runtime for planned_steps.',
          startedAt: 1,
          endedAt: 1,
        },
        {
          receiptId: 'fallback-write',
          sourceType: 'tool_call' as const,
          toolName: 'fs_write',
          status: 'succeeded' as const,
          refs: ['tmp/manual-web/planned-steps-summary.txt'],
          summary: 'Wrote tmp/manual-web/planned-steps-summary.txt.',
          startedAt: 2,
          endedAt: 2,
        },
      ];
      const matchedStepIds = new Map<string, string>();
      for (const receipt of evidenceReceipts) {
        const matchedStepId = matchPlannedStepForTool({
          plannedTask: taskContract.plan,
          toolName: receipt.toolName,
          args: { refs: receipt.refs },
          previouslyMatchedStepIds: new Set(matchedStepIds.values()),
        });
        if (matchedStepId) {
          matchedStepIds.set(receipt.receiptId, matchedStepId);
        }
      }
      const stepReceipts = buildStepReceipts({
        plannedTask: taskContract.plan,
        evidenceReceipts,
        toolReceiptStepIds: matchedStepIds,
      });
      const runStatus = computeWorkerRunStatus(taskContract.plan, stepReceipts, [], 'end_turn');
      const content = 'Delegated fallback wrote tmp/manual-web/planned-steps-summary.txt.';
      return {
        content,
        metadata: buildDelegatedExecutionMetadata({
          taskContract,
          runStatus,
          stopReason: 'end_turn',
          stepReceipts,
          finalUserAnswer: content,
          operatorSummary: content,
          claims: [],
          evidenceReceipts,
          interruptions: [],
          artifacts: [],
          events: [],
        }),
      };
    };

    const intentRoutingTrace = {
      record: vi.fn(),
    };
    const runTimeline = {
      ingestDelegatedWorkerProgress: vi.fn(),
      ingestDelegatedExecutionEvents: vi.fn(),
      ingestExecutionGraphEvent: vi.fn(),
    };
    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
        listJobs: vi.fn(() => []),
        executeModelTool: vi.fn(),
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        getConfigSnapshot: () => structuredClone(DEFAULT_CONFIG) as GuardianAgentConfig,
        auditLog: { record: vi.fn() },
        registry: {
          get: (agentId: string) => agentId === 'local'
            ? {
                agent: { name: 'Guardian Agent' },
                definition: {
                  orchestration: {
                    role: 'implementer',
                    label: 'Workspace Implementer',
                    lenses: ['coding-workspace'],
                  },
                },
              }
            : undefined,
        },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
      undefined,
      {
        intentRoutingTrace,
        runTimeline,
        now: () => 1_111_500,
      },
    );

    const result = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-search-write-local-fallback',
        userId: 'tester',
        channel: 'web',
        content: 'Search src/runtime for planned_steps. Write a short summary of what you find to tmp/manual-web/planned-steps-summary.txt.',
        metadata: filesystemSearchWriteMetadata(),
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      additionalSections: [],
      toolContext: '',
      runtimeNotices: [],
      executionProfile: {
        id: 'local_tool',
        providerName: 'local',
        providerType: 'ollama',
        providerModel: 'test-local',
        providerLocality: 'local',
        providerTier: 'local',
        requestedTier: 'local',
        preferredAnswerPath: 'tool_loop',
        expectedContextPressure: 'medium',
        contextBudget: 16_000,
        toolContextMode: 'tight',
        maxAdditionalSections: 2,
        maxRuntimeNotices: 2,
        fallbackProviderOrder: ['local'],
        reason: 'local-only test profile',
        routingMode: 'auto',
        selectionSource: 'primary',
      },
      delegation: {
        requestId: 'm-search-write-local-fallback',
        executionId: 'exec-search-write-local-fallback',
        rootExecutionId: 'exec-search-write-local-root',
        originChannel: 'web',
        orchestration: {
          role: 'implementer',
          label: 'Workspace Implementer',
          lenses: ['coding-workspace'],
        },
      },
    });

    expect(dispatchModes).toEqual(['delegated']);
    expect(result.content).toContain('Delegated fallback wrote');
    expect(result.content).not.toContain('Execution graph could not complete');
    expect(runTimeline.ingestExecutionGraphEvent.mock.calls
      .map(([event]) => event.kind))
      .not.toContain('graph_failed');

    manager.shutdown();
  });

  it('pauses graph-controlled mutation with an execution-graph pending action when approval is required', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    const dispatchModes: string[] = [];
    workerMessageHandler = (params) => {
      const directReasoning = params.directReasoning === true;
      const groundedSynthesis = !!params.groundedSynthesis;
      dispatchModes.push(directReasoning ? 'direct' : groundedSynthesis ? 'synthesis' : 'delegated');
      if (directReasoning) {
        const context = params.directReasoningGraphContext as { graphId: string; nodeId: string };
        return {
          content: 'Found planned_steps references in src/runtime/intent/route-classifier.ts.',
          metadata: {
            skipTestDelegatedEnvelope: true,
            directReasoning: true,
            directReasoningMode: 'brokered_readonly',
            executionGraphArtifacts: [
              buildSearchResultSetArtifact({
                graphId: context.graphId,
                nodeId: context.nodeId,
                query: 'planned_steps',
                matches: [{ path: 'src/runtime/intent/route-classifier.ts', line: 42, snippet: 'planned_steps' }],
                createdAt: 1_112_000,
              }),
            ],
          },
        };
      }
      if (groundedSynthesis) {
        return {
          content: JSON.stringify({
            path: 'tmp/manual-web/planned-steps-summary.txt',
            content: 'planned_steps appears in src/runtime/intent/route-classifier.ts.\n',
            append: false,
            summary: 'Summarize grounded planned_steps evidence.',
          }),
          metadata: {
            skipTestDelegatedEnvelope: true,
            groundedSynthesis: { available: true },
          },
        };
      }
      throw new Error('Delegated worker path should not run for graph-controlled approval pauses.');
    };

    const intentRoutingTrace = {
      record: vi.fn(),
    };
    const runTimeline = {
      ingestExecutionGraphEvent: vi.fn(),
    };
    let capturedPendingAction: PendingActionRecord | undefined;
    const pendingActionStore = {
      replaceActive: vi.fn((_scope, draft) => {
        capturedPendingAction = {
        id: 'pending-graph-1',
        scope: _scope,
        ...draft,
          createdAt: 1_112_000,
          updatedAt: 1_112_000,
        } as PendingActionRecord;
        return capturedPendingAction;
      }),
    };
    const executionGraphStore = new ExecutionGraphStore({
      now: () => 1_112_000,
    });
    const synthesizedContent = 'planned_steps appears in src/runtime/intent/route-classifier.ts.\n';
    const executeModelTool = vi.fn(async (toolName: string, args: Record<string, unknown>) => {
      if (toolName === 'fs_write') {
        return {
          success: false,
          status: 'pending_approval',
          approvalId: 'approval-graph-write',
          jobId: 'job-graph-write',
          message: 'Approval required.',
        };
      }
      if (toolName === 'fs_read') {
        return {
          success: true,
          status: 'succeeded',
          jobId: 'job-graph-readback',
          output: {
            path: args.path,
            bytes: Buffer.byteLength(synthesizedContent, 'utf-8'),
            truncated: false,
            content: synthesizedContent,
          },
        };
      }
      throw new Error(`Unexpected tool ${toolName}`);
    });
    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
        listJobs: vi.fn(() => []),
        executeModelTool,
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        getConfigSnapshot: () => createExecutionProfileTestConfig(),
        auditLog: { record: vi.fn() },
        registry: {
          get: (agentId: string) => agentId === 'local'
            ? {
                agent: { name: 'Guardian Agent' },
                definition: {
                  orchestration: {
                    role: 'implementer',
                    label: 'Workspace Implementer',
                    lenses: ['coding-workspace'],
                  },
                },
              }
            : undefined,
        },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
      undefined,
      {
        intentRoutingTrace,
        runTimeline,
        pendingActionStore,
        executionGraphStore,
        now: () => 1_112_000,
      },
    );

    const result = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-search-write-graph-approval',
        userId: 'tester',
        channel: 'web',
        content: 'Search src/runtime for planned_steps. Write a short summary of what you find to tmp/manual-web/planned-steps-summary.txt.',
        metadata: filesystemSearchWriteMetadata(),
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      additionalSections: [],
      toolContext: '',
      runtimeNotices: [],
      executionProfile: {
        id: 'managed_cloud_tool',
        providerName: 'ollama-cloud-coding',
        providerType: 'ollama_cloud',
        providerModel: 'glm-5.1',
        providerLocality: 'external',
        providerTier: 'managed_cloud',
        requestedTier: 'external',
        preferredAnswerPath: 'tool_loop',
        expectedContextPressure: 'high',
        contextBudget: 32_000,
        toolContextMode: 'tight',
        maxAdditionalSections: 2,
        maxRuntimeNotices: 2,
        fallbackProviderOrder: ['ollama-cloud-coding', 'openai-frontier'],
        reason: 'delegated coding role selected managed-cloud coding profile',
        routingMode: 'auto',
        selectionSource: 'delegated_role',
      },
      delegation: {
        requestId: 'm-search-write-graph-approval',
        executionId: 'exec-search-write-graph-approval',
        rootExecutionId: 'exec-search-write-root',
        originChannel: 'web',
        orchestration: {
          role: 'implementer',
          label: 'Workspace Implementer',
          lenses: ['coding-workspace'],
        },
      },
    });

    expect(dispatchModes).toEqual(['direct', 'synthesis']);
    expect(result.metadata?.executionGraph).toMatchObject({
      status: 'awaiting_approval',
      receiptArtifactId: expect.stringContaining('mutation-receipt'),
    });
    expect(result.metadata?.pendingAction).toMatchObject({
      status: 'pending',
      blocker: {
        kind: 'approval',
        approvalSummaries: [expect.objectContaining({ id: 'approval-graph-write', toolName: 'fs_write' })],
      },
    });
    expect(pendingActionStore.replaceActive).toHaveBeenCalledOnce();
    expect(runTimeline.ingestExecutionGraphEvent.mock.calls.map(([event]) => event.kind)).toEqual(expect.arrayContaining([
      'approval_requested',
    ]));
    const executionGraphMetadata = result.metadata?.executionGraph as { graphId?: string } | undefined;
    const graphId = executionGraphMetadata?.graphId ?? '';
    const snapshot = executionGraphStore.getSnapshot(graphId);
    expect(snapshot?.graph.status).toBe('awaiting_approval');
    expect(snapshot?.graph.nodes.find((node) => node.kind === 'mutate')?.status).toBe('awaiting_approval');
    expect(snapshot?.graph.nodes.find((node) => node.kind === 'verify')?.status).toBe('pending');
    expect(snapshot?.graph.checkpoints.map((checkpoint) => checkpoint.reason)).toContain('approval_interrupt');
    expect(executionGraphStore.listArtifacts(graphId).map((artifact) => artifact.artifactType)).toEqual(expect.arrayContaining([
      'SearchResultSet',
      'EvidenceLedger',
      'SynthesisDraft',
      'WriteSpec',
      'MutationReceipt',
    ]));

    const resumeManager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
        listJobs: vi.fn(() => []),
        executeModelTool,
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        getConfigSnapshot: () => createExecutionProfileTestConfig(),
        auditLog: { record: vi.fn() },
        registry: {
          get: () => undefined,
        },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
      undefined,
      {
        intentRoutingTrace,
        runTimeline,
        executionGraphStore,
        now: () => 1_112_100,
      },
    );
    const resumed = await resumeManager.resumeExecutionGraphPendingAction(
      capturedPendingAction!,
      {
        approvalId: 'approval-graph-write',
        approvalResult: {
          success: true,
          approved: true,
          executionSucceeded: true,
          message: 'Approved and executed.',
          job: { id: 'job-graph-write', status: 'succeeded' } as never,
          result: {
            success: true,
            output: {
              size: Buffer.byteLength(synthesizedContent, 'utf-8'),
            },
          } as never,
        },
      },
    );
    expect(resumed?.content).toContain('Wrote tmp/manual-web/planned-steps-summary.txt');
    expect(resumed?.metadata?.executionGraph).toMatchObject({
      graphId,
      status: 'succeeded',
      verificationArtifactId: expect.stringContaining('verification'),
    });
    const resumedSnapshot = executionGraphStore.getSnapshot(graphId);
    expect(resumedSnapshot?.graph.status).toBe('completed');
    expect(resumedSnapshot?.graph.nodes.find((node) => node.kind === 'mutate')?.status).toBe('completed');
    expect(resumedSnapshot?.graph.nodes.find((node) => node.kind === 'verify')?.status).toBe('completed');
    expect(executionGraphStore.listArtifacts(graphId).map((artifact) => artifact.artifactType)).toEqual(expect.arrayContaining([
      'VerificationResult',
    ]));
    expect(executeModelTool).toHaveBeenCalledWith(
      'fs_read',
      expect.objectContaining({ path: 'tmp/manual-web/planned-steps-summary.txt' }),
      expect.objectContaining({ requestId: 'm-search-write-graph-approval', userId: 'tester' }),
    );

    resumeManager.shutdown();
    manager.shutdown();
  });

  it('fails source-backed delegated security reviews that finish without any successful tool evidence', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    workerMessageHandler = () => ({
      content: 'High: src/delegate/resume.ts allows stale approvals to resume the task.',
      metadata: {
        workerExecution: {
          lifecycle: 'completed',
          source: 'tool_loop',
          completionReason: 'model_response',
          responseQuality: 'final',
          toolCallCount: 3,
          toolResultCount: 3,
          successfulToolResultCount: 0,
        },
      },
    });

    const intentRoutingTrace = {
      record: vi.fn(),
    };

    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        auditLog: { record: vi.fn() },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
      undefined,
      {
        intentRoutingTrace,
        now: () => 123_456,
      },
    );

    const result = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-security-evidence-failed',
        userId: 'tester',
        principalId: 'tester',
        principalRole: 'owner',
        channel: 'web',
        content: 'Review the delegated execution, approval, and resume flow for security or control-flow risks. Cite exact files.',
        metadata: securityReviewMetadata(),
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      toolContext: '',
      runtimeNotices: [],
      delegation: {
        requestId: 'm-security-evidence-failed',
        originChannel: 'web',
        codeSessionId: 'code-1',
      },
    });

    expect(result.content).toContain('Delegated work failed.');
    expect(result.content).toContain('Delegated worker stopped before satisfying every required planned step.');
    const verificationTrace = intentRoutingTrace.record.mock.calls
      .map(([entry]) => entry)
      .find((entry) => entry.stage === 'delegated_verification_decided');
    expect(verificationTrace).toMatchObject({
      stage: 'delegated_verification_decided',
      requestId: 'm-security-evidence-failed',
      details: {
        decision: 'insufficient',
        summary: 'Delegated worker stopped before satisfying every required planned step.',
        missingEvidenceKinds: ['read'],
        unsatisfiedStepIds: ['step_1'],
      },
    });

    manager.shutdown();
  });

  it('keeps filesystem mutation turns blocked when a real approval is pending', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    workerMessageHandler = () => ({
      content: 'Waiting for approval to add D:\\GuardianTraceApprovalSmoke before writing notes.md.',
      metadata: {
        pendingAction: {
          status: 'pending',
          blocker: {
            kind: 'approval',
            prompt: 'Waiting for approval.',
            approvalSummaries: [
              { id: 'approval-path-1', toolName: 'update_tool_policy', argsPreview: '{"path":"D:\\\\GuardianTraceApprovalSmoke"}' },
            ],
          },
        },
        workerExecution: {
          lifecycle: 'blocked',
          source: 'tool_loop',
          completionReason: 'approval_pending',
          responseQuality: 'final',
          blockerKind: 'approval',
          toolCallCount: 1,
          toolResultCount: 1,
          successfulToolResultCount: 0,
          pendingApprovalCount: 1,
        },
      },
    });

    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        auditLog: { record: vi.fn() },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
    );

    const result = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-filesystem-approval-pending',
        userId: 'tester',
        principalId: 'tester',
        principalRole: 'owner',
        channel: 'web',
        content: 'Create D:\\GuardianTraceApprovalSmoke\\notes.md with 3 bullets about delegated trace troubleshooting.',
        metadata: filesystemMutationMetadata(),
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      toolContext: '',
      runtimeNotices: [],
      delegation: {
        requestId: 'm-filesystem-approval-pending',
        originChannel: 'web',
      },
    });

    expect(result.content).toContain('Waiting for approval to add D:\\GuardianTraceApprovalSmoke');
    expect(result.content).not.toContain('Delegated work failed.');

    manager.shutdown();
  });

  it('classifies code-session delegated results as long-running for operator replay and dismissal', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    workerMessageHandler = () => ({
      content: 'Digest complete.\n- README reviewed\n- package.json reviewed',
      metadata: {},
    });
    const runTimeline = {
      ingestDelegatedWorkerProgress: vi.fn(),
      ingestDelegatedExecutionEvents: vi.fn(),
      ingestExecutionGraphEvent: vi.fn(),
    };
    const intentRoutingTrace = { record: vi.fn() };
    const auditLog = { record: vi.fn() };

    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        auditLog,
        outputGuardian: {
          scanResponse: vi.fn((content: string) => ({ clean: true, secrets: [], sanitized: content })),
        },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
      undefined,
      {
        intentRoutingTrace,
        runTimeline,
        now: () => 987_000,
      },
    );

    const result = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-held-operator',
        userId: 'tester',
        principalId: 'tester',
        principalRole: 'owner',
        channel: 'web',
        content: 'Run the long repository digest.',
        metadata: generalAssistantDirectMetadata(),
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      toolContext: '',
      runtimeNotices: [],
      delegation: {
        requestId: 'm-held-operator',
        executionId: 'exec-held-operator',
        rootExecutionId: 'root-held-operator',
        originChannel: 'code-session',
        originSurfaceId: 'web-guardian-chat',
        continuityKey: 'continuity-held-operator',
        activeExecutionRefs: ['code_session:Guardian Agent', 'delegated:repo-digest'],
        codeSessionId: 'code-held-operator',
      },
    });

    expect(result.content).toContain('Delegated work completed and is held for operator review.');
    expect(result.metadata).toMatchObject({
      delegatedHandoff: {
        reportingMode: 'held_for_operator',
        runClass: 'long_running',
        operatorState: 'pending',
      },
    });

    const state = manager.getJobState(5);
    const jobId = state.jobs[0]?.id;
    expect(jobId).toBeTruthy();
    expect(state.jobs[0]?.metadata).toMatchObject({
      delegation: {
        executionId: 'exec-held-operator',
        rootExecutionId: 'root-held-operator',
        originSurfaceId: 'web-guardian-chat',
        continuityKey: 'continuity-held-operator',
        activeExecutionRefs: ['code_session:Guardian Agent', 'delegated:repo-digest'],
        codeSessionId: 'code-held-operator',
        runClass: 'long_running',
        handoff: {
          reportingMode: 'held_for_operator',
          operatorState: 'pending',
        },
      },
    });

    const actor = {
      userId: 'operator-1',
      principalId: 'web-session:operator-1',
      principalRole: 'owner',
      channel: 'web',
      surfaceId: 'web-guardian-chat',
    };

    const replayed = manager.applyJobFollowUpAction(jobId!, 'replay', actor);
    expect(replayed).toMatchObject({
      success: true,
      details: {
        content: 'Digest complete.\n- README reviewed\n- package.json reviewed',
        redacted: false,
        continuityKey: 'continuity-held-operator',
        activeExecutionRefs: ['code_session:Guardian Agent', 'delegated:repo-digest'],
        codeSessionId: 'code-held-operator',
        runClass: 'long_running',
        originSurfaceId: 'web-guardian-chat',
        executionId: 'exec-held-operator',
        rootExecutionId: 'root-held-operator',
      },
    });
    expect(runTimeline.ingestDelegatedWorkerProgress).toHaveBeenLastCalledWith(expect.objectContaining({
      id: `delegated-worker:${jobId}:followup:replayed`,
      kind: 'followup_action',
      requestId: 'm-held-operator',
      runId: 'exec-held-operator',
      parentRunId: 'exec-held-operator',
      executionId: 'exec-held-operator',
      rootExecutionId: 'root-held-operator',
      taskRunId: `delegated-task:${jobId}`,
      codeSessionId: 'code-held-operator',
      agentId: 'local',
      originChannel: 'code-session',
      runClass: 'long_running',
      reportingMode: 'held_for_operator',
      operatorAction: 'replay',
      operatorState: 'replayed',
      continuityKey: 'continuity-held-operator',
      activeExecutionRefs: ['code_session:Guardian Agent', 'delegated:repo-digest'],
      detail: 'Operator replayed the held delegated result to the conversation.',
      timestamp: 987_000,
    }));
    expect(intentRoutingTrace.record).toHaveBeenLastCalledWith(expect.objectContaining({
      stage: 'delegated_worker_followup_action',
      requestId: 'm-held-operator',
      messageId: 'm-held-operator',
      userId: 'operator-1',
      channel: 'web',
      agentId: 'local',
      contentPreview: 'Operator replayed the held delegated result to the conversation.',
      details: expect.objectContaining({
        jobId,
        taskRunId: `delegated-task:${jobId}`,
        lifecycle: 'completed',
        executionId: 'exec-held-operator',
        rootExecutionId: 'root-held-operator',
        originSurfaceId: 'web-guardian-chat',
        continuityKey: 'continuity-held-operator',
        activeExecutionRefs: ['code_session:Guardian Agent', 'delegated:repo-digest'],
        codeSessionId: 'code-held-operator',
        runClass: 'long_running',
        reportingMode: 'held_for_operator',
        operatorAction: 'replay',
        operatorState: 'replayed',
        actorPrincipalId: 'web-session:operator-1',
        actorPrincipalRole: 'owner',
        actorSurfaceId: 'web-guardian-chat',
      }),
    }));
    expect(auditLog.record).toHaveBeenLastCalledWith(expect.objectContaining({
      type: 'broker_action',
      userId: 'operator-1',
      channel: 'web',
      details: expect.objectContaining({
        actionType: 'delegated_worker_followup_replayed',
        actorPrincipalId: 'web-session:operator-1',
        actorPrincipalRole: 'owner',
        actorSurfaceId: 'web-guardian-chat',
      }),
    }));

    const afterReplay = manager.getJobState(5);
    expect(afterReplay.jobs[0]?.metadata).toMatchObject({
      delegation: {
        executionId: 'exec-held-operator',
        rootExecutionId: 'root-held-operator',
        originSurfaceId: 'web-guardian-chat',
        continuityKey: 'continuity-held-operator',
        activeExecutionRefs: ['code_session:Guardian Agent', 'delegated:repo-digest'],
        codeSessionId: 'code-held-operator',
        handoff: {
          operatorState: 'replayed',
        },
      },
    });
    const deferredUntil = 987_000 + 15 * 60_000;
    const deferred = manager.applyJobFollowUpAction(jobId!, 'defer', actor, { deferForMinutes: 15 });
    expect(deferred).toMatchObject({
      success: true,
      message: `Deferred held delegated result for ${jobId}.`,
      details: {
        deferredUntil,
      },
    });
    expect(runTimeline.ingestDelegatedWorkerProgress).toHaveBeenLastCalledWith(expect.objectContaining({
      id: `delegated-worker:${jobId}:followup:deferred`,
      kind: 'followup_action',
      operatorAction: 'defer',
      operatorState: 'deferred',
      deferredUntil,
      continuityKey: 'continuity-held-operator',
      activeExecutionRefs: ['code_session:Guardian Agent', 'delegated:repo-digest'],
      detail: `Operator deferred the delegated result until ${new Date(deferredUntil).toISOString()}.`,
    }));
    expect(intentRoutingTrace.record).toHaveBeenLastCalledWith(expect.objectContaining({
      stage: 'delegated_worker_followup_action',
      requestId: 'm-held-operator',
      userId: 'operator-1',
      channel: 'web',
      details: expect.objectContaining({
        jobId,
        operatorAction: 'defer',
        operatorState: 'deferred',
        deferredUntil,
        actorPrincipalId: 'web-session:operator-1',
        actorPrincipalRole: 'owner',
        actorSurfaceId: 'web-guardian-chat',
      }),
    }));

    const afterDefer = manager.getJobState(5);
    expect(afterDefer.jobs[0]?.metadata).toMatchObject({
      delegation: {
        handoff: {
          operatorState: 'deferred',
          deferredUntil,
        },
      },
    });

    const dismissed = manager.applyJobFollowUpAction(jobId!, 'dismiss', actor);
    expect(dismissed).toMatchObject({
      success: true,
      message: `Dismissed held delegated result for ${jobId}.`,
    });
    expect(runTimeline.ingestDelegatedWorkerProgress).toHaveBeenLastCalledWith(expect.objectContaining({
      id: `delegated-worker:${jobId}:followup:dismissed`,
      kind: 'followup_action',
      operatorAction: 'dismiss',
      operatorState: 'dismissed',
      continuityKey: 'continuity-held-operator',
      activeExecutionRefs: ['code_session:Guardian Agent', 'delegated:repo-digest'],
      detail: 'Operator dismissed the held delegated result.',
    }));
    expect(intentRoutingTrace.record).toHaveBeenLastCalledWith(expect.objectContaining({
      stage: 'delegated_worker_followup_action',
      requestId: 'm-held-operator',
      userId: 'operator-1',
      channel: 'web',
      details: expect.objectContaining({
        jobId,
        operatorAction: 'dismiss',
        operatorState: 'dismissed',
        actorPrincipalId: 'web-session:operator-1',
        actorPrincipalRole: 'owner',
        actorSurfaceId: 'web-guardian-chat',
      }),
    }));

    const replayAfterDismiss = manager.applyJobFollowUpAction(jobId!, 'replay');
    expect(replayAfterDismiss).toMatchObject({
      success: false,
      errorCode: 'JOB_ALREADY_DISMISSED',
    });

    manager.shutdown();
  });

  it('intercepts automation authoring before brokered worker dispatch', async () => {
    const { WorkerManager } = await import('./worker-manager.js');
    const sandbox = await import('../sandbox/index.js');
    const workspaceRoot = createAutomationFixtureWorkspace();

    const executeModelTool = vi.fn(async (toolName: string) => {
      if (toolName === 'automation_list') {
        return { success: true, output: { automations: [] } };
      }
      if (toolName === 'automation_save') {
        return {
          success: false,
          status: 'pending_approval',
          approvalId: 'approval-automation-1',
        };
      }
      throw new Error(`Unexpected tool ${toolName}`);
    });

    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
        executeModelTool,
        getApprovalSummaries: () => new Map([
          ['approval-automation-1', { toolName: 'automation_save', argsPreview: '{"name":"Weekday Lead Research"}' }],
        ]),
        getPolicy: () => ({
          sandbox: {
            allowedPaths: [workspaceRoot],
          },
        }),
        decideApproval: vi.fn(),
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        auditLog: { record: vi.fn() },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
    );

    const response = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-automation',
        userId: 'tester',
        principalId: 'tester',
        principalRole: 'owner',
        channel: 'web',
        metadata: automationAuthoringMetadata(),
        content: 'Build a weekday lead research workflow that reads ./companies.csv, researches each company\'s website and public presence, scores fit from 1-5 using a simple B2B SaaS ICP, writes results to ./lead-research-output.csv, and creates ./lead-research-summary.md. Use built-in Guardian tools only. Do not create any shell script, Python script, or code file.',
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      toolContext: '',
      runtimeNotices: [],
    });

    expect(response.content).toContain('native Guardian scheduled assistant task');
    expect(response.metadata).toMatchObject({
      pendingAction: {
        blocker: {
          approvalSummaries: [
            {
              id: 'approval-automation-1',
              toolName: 'automation_save',
            },
          ],
        },
      },
    });
    expect(executeModelTool).toHaveBeenNthCalledWith(
      1,
      'automation_list',
      {},
      expect.objectContaining({ channel: 'web', userId: 'tester' }),
    );
    expect(executeModelTool.mock.calls.some((call) => (
      call[0] === 'automation_save'
      && call[1]?.name === 'Weekday Lead Research'
      && call[1]?.kind === 'assistant_task'
    ))).toBe(true);
    expect(vi.mocked(sandbox.sandboxedSpawn)).not.toHaveBeenCalled();

    manager.shutdown();
  });

  it('delegates mixed automation plans instead of using native automation authoring', async () => {
    const { WorkerManager } = await import('./worker-manager.js');
    const sandbox = await import('../sandbox/index.js');

    const executeModelTool = vi.fn();
    workerMessageHandler = (params) => {
      const request = params.message as { metadata?: Record<string, unknown> } | undefined;
      const gateway = readPreRoutedIntentGatewayMetadata(request?.metadata);
      expect(gateway?.decision.route).toBe('automation_authoring');
      expect(gateway?.decision.plannedSteps?.map((step) => step.expectedToolCategories?.[0])).toEqual([
        'automation_save',
        'fs_search',
        'second_brain_task_upsert',
        'whm_status',
        'assistant_security_findings',
      ]);
      const taskContract = buildDelegatedTaskContract(gateway?.decision);
      const now = Date.now();
      return {
        content: 'Delegated mixed automation plan through the brokered worker.',
        metadata: buildDelegatedExecutionMetadata(buildDelegatedSyntheticEnvelope({
          taskContract,
          runStatus: 'completed',
          stopReason: 'end_turn',
          operatorSummary: 'Delegated mixed automation plan through the brokered worker.',
          stepReceipts: taskContract.plan.steps.map((step, index) => ({
            stepId: step.id,
            status: 'satisfied',
            evidenceReceiptIds: [`evidence-${index + 1}`],
            summary: step.summary,
            startedAt: now + index,
            endedAt: now + index + 1,
          })),
          evidenceReceipts: taskContract.plan.steps.map((step, index) => ({
            receiptId: `evidence-${index + 1}`,
            sourceType: 'tool_call',
            toolName: step.expectedToolCategories?.[0],
            status: 'succeeded',
            refs: [],
            summary: step.summary,
            startedAt: now + index,
            endedAt: now + index + 1,
          })),
        })),
      };
    };

    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
        executeModelTool,
        getApprovalSummaries: () => new Map(),
        decideApproval: vi.fn(),
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        auditLog: { record: vi.fn() },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
    );

    const response = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-mixed-automation',
        userId: 'tester',
        principalId: 'tester',
        principalRole: 'owner',
        channel: 'web',
        metadata: mixedAutomationAuthoringMetadata(),
        content: 'Create an automation that checks the Guardian repo for TODOs, saves a Second Brain task for anything urgent, checks whm_status profileId social, and summarizes assistant_security_findings.',
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      toolContext: '',
      runtimeNotices: [],
    });

    expect(response.content).toContain('Delegated mixed automation plan');
    expect(executeModelTool).not.toHaveBeenCalled();
    expect(vi.mocked(sandbox.sandboxedSpawn)).toHaveBeenCalledTimes(1);

    manager.shutdown();
  });

  it('continues automation creation after remediation approvals are granted', async () => {
    const { WorkerManager } = await import('./worker-manager.js');
    const sandbox = await import('../sandbox/index.js');

    let pathAllowed = false;
    const externalPath = 'D:\\Reports\\lead-summary.md';
    const workspaceRoot = createAutomationFixtureWorkspace();
    const executeModelTool = vi.fn(async (toolName: string, args?: Record<string, unknown>) => {
      if (toolName === 'update_tool_policy') {
        return {
          success: false,
          status: 'pending_approval',
          approvalId: 'approval-policy-1',
        };
      }
      if (toolName === 'automation_list') {
        return { success: true, output: { automations: [] } };
      }
      if (toolName === 'automation_save') {
        return {
          success: false,
          status: 'pending_approval',
          approvalId: 'approval-task-1',
        };
      }
      throw new Error(`Unexpected tool ${toolName} ${JSON.stringify(args)}`);
    });

    const decideApproval = vi.fn(async (approvalId: string) => {
      if (approvalId === 'approval-policy-1') {
        pathAllowed = true;
        return { success: true, message: `Policy updated: add_path '${externalPath}'.` };
      }
      if (approvalId === 'approval-task-1') {
        return { success: true, message: "Scheduled assistant task 'Daily Lead Summary' created." };
      }
      return { success: false, message: `Unknown approval ${approvalId}` };
    });

    const pendingActionStore = createMemoryPendingActionStore();
    const executionGraphStore = new ExecutionGraphStore();
    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
        executeModelTool,
        decideApproval,
        getApprovalSummaries: () => new Map([
          ['approval-policy-1', { toolName: 'update_tool_policy', argsPreview: `{"action":"add_path","value":"${externalPath}"}` }],
          ['approval-task-1', { toolName: 'automation_save', argsPreview: '{"name":"Daily Lead Summary"}' }],
        ]),
        getPolicy: () => ({
          sandbox: {
            allowedPaths: pathAllowed
              ? [workspaceRoot, externalPath]
              : [workspaceRoot],
          },
        }),
        preflightTools: (requests: Array<{ name: string; args?: Record<string, unknown> }>) => requests.map((request) => {
          if (request.name === 'fs_write' && !pathAllowed) {
            return {
              name: request.name,
              found: true,
              decision: 'deny' as const,
              reason: 'Path is not in allowedPaths',
              fixes: [{ type: 'path' as const, value: externalPath, description: `Add ${externalPath} to allowed paths` }],
            };
          }
          return {
            name: request.name,
            found: true,
            decision: 'allow' as const,
            reason: 'ok',
            fixes: [],
          };
        }),
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        auditLog: { record: vi.fn() },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
      undefined,
      { pendingActionStore, executionGraphStore },
    );

    const createRequest = {
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-remediation',
        userId: 'tester',
        principalId: 'tester',
        principalRole: 'owner' as const,
        channel: 'web' as const,
        metadata: automationAuthoringMetadata(),
        content: `Create a daily 8:00 AM automation that reads ./companies.csv, writes a summary report to ${externalPath}, and uses built-in Guardian tools only.`,
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      toolContext: '',
      runtimeNotices: [],
    };

    const initial = await manager.handleMessage(createRequest);
    expect(initial.content).toContain('fixable policy blockers');
    expect(initial.metadata).toMatchObject({
      pendingAction: {
        blocker: {
          approvalSummaries: [
            {
              id: 'approval-policy-1',
              toolName: 'update_tool_policy',
            },
          ],
        },
      },
      resumeAutomationAfterApprovals: true,
    });

    const approved = await manager.handleMessage({
      ...createRequest,
      message: {
        ...createRequest.message,
        id: 'm-remediation-approve',
        content: 'yes',
      },
    });

    expect(approved.content).toContain(`Policy updated: add_path '${externalPath}'.`);
    expect(approved.content).toContain('native Guardian scheduled assistant task');
    expect(approved.metadata).toMatchObject({
      pendingAction: {
        blocker: {
          approvalSummaries: [
            {
              id: 'approval-task-1',
              toolName: 'automation_save',
            },
          ],
        },
      },
    });
    expect(pathAllowed).toBe(true);
    expect(vi.mocked(sandbox.sandboxedSpawn)).not.toHaveBeenCalled();

    manager.shutdown();
  });

  it('continues workflow creation after remediation approvals are granted', async () => {
    const { WorkerManager } = await import('./worker-manager.js');
    const sandbox = await import('../sandbox/index.js');

    let pathAllowed = false;
    const externalPath = 'D:\\Reports\\lead-research-summary.md';
    const workspaceRoot = createAutomationFixtureWorkspace();
    const executeModelTool = vi.fn(async (toolName: string, args?: Record<string, unknown>) => {
      if (toolName === 'update_tool_policy') {
        return {
          success: false,
          status: 'pending_approval',
          approvalId: 'approval-workflow-policy-1',
        };
      }
      if (toolName === 'automation_list') {
        return { success: true, output: { automations: [] } };
      }
      if (toolName === 'automation_save') {
        return {
          success: false,
          status: 'pending_approval',
          approvalId: 'approval-workflow-create-1',
        };
      }
      throw new Error(`Unexpected tool ${toolName} ${JSON.stringify(args)}`);
    });

    const decideApproval = vi.fn(async (approvalId: string) => {
      if (approvalId === 'approval-workflow-policy-1') {
        pathAllowed = true;
        return { success: true, message: `Policy updated: add_path '${externalPath}'.` };
      }
      if (approvalId === 'approval-workflow-create-1') {
        return { success: true, message: "Workflow 'Lead Research Summary Workflow' created." };
      }
      return { success: false, message: `Unknown approval ${approvalId}` };
    });

    const pendingActionStore = createMemoryPendingActionStore();
    const executionGraphStore = new ExecutionGraphStore();
    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
        executeModelTool,
        decideApproval,
        getApprovalSummaries: () => new Map([
          ['approval-workflow-policy-1', { toolName: 'update_tool_policy', argsPreview: `{"action":"add_path","value":"${externalPath}"}` }],
          ['approval-workflow-create-1', { toolName: 'automation_save', argsPreview: '{"name":"Lead Research Summary Workflow"}' }],
        ]),
        listPendingApprovalIdsForUser: () => pathAllowed ? [] : ['approval-workflow-policy-1'],
        getPolicy: () => ({
          sandbox: {
            allowedPaths: pathAllowed
              ? [workspaceRoot, externalPath]
              : [workspaceRoot],
          },
        }),
        preflightTools: (requests: Array<{ name: string; args?: Record<string, unknown> }>) => requests.map((request) => {
          if (request.name === 'fs_write' && !pathAllowed) {
            return {
              name: request.name,
              found: true,
              decision: 'deny' as const,
              reason: 'Path is not in allowedPaths',
              fixes: [{ type: 'path' as const, value: externalPath, description: `Add ${externalPath} to allowed paths` }],
            };
          }
          return {
            name: request.name,
            found: true,
            decision: 'allow' as const,
            reason: 'ok',
            fixes: [],
          };
        }),
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        auditLog: { record: vi.fn() },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
      undefined,
      { pendingActionStore, executionGraphStore },
    );

    const createRequest = {
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-workflow-remediation',
        userId: 'tester',
        principalId: 'tester',
        principalRole: 'owner' as const,
        channel: 'web' as const,
        metadata: automationAuthoringMetadata(),
        content: `Create a sequential Guardian workflow that first reads ./companies.csv, then runs a fixed summarization step, then writes ${externalPath}.`,
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      toolContext: '',
      runtimeNotices: [],
    };

    const initial = await manager.handleMessage(createRequest);
    expect(initial.content).toContain('fixable policy blockers');
    expect(initial.metadata).toMatchObject({
      pendingAction: {
        blocker: {
          approvalSummaries: [
            {
              id: 'approval-workflow-policy-1',
              toolName: 'update_tool_policy',
            },
          ],
        },
      },
      resumeAutomationAfterApprovals: true,
    });

    const approved = await manager.handleMessage({
      ...createRequest,
      message: {
        ...createRequest.message,
        id: 'm-workflow-remediation-approve',
        content: 'yes',
      },
    });

    expect(approved.content).toContain(`Policy updated: add_path '${externalPath}'.`);
    expect(approved.content).toContain("native Guardian step-based automation");
    expect(approved.metadata).toMatchObject({
      pendingAction: {
        blocker: {
          approvalSummaries: [
            {
              id: 'approval-workflow-create-1',
              toolName: 'automation_save',
            },
          ],
        },
      },
    });
    expect(pathAllowed).toBe(true);
    expect(executeModelTool.mock.calls.some((call) => call[0] === 'automation_save')).toBe(true);
    expect(vi.mocked(sandbox.sandboxedSpawn)).not.toHaveBeenCalled();

    manager.shutdown();
  });

  it('does not expose resumable worker approval metadata without graph suspension ownership', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    workerMessageHandler = (params) => {
      const message = (params.message ?? {}) as {
        metadata?: Record<string, unknown>;
      };
      const continuation = message.metadata?.[APPROVAL_OUTCOME_CONTINUATION_METADATA_KEY] as
        | { type?: string; approvalId?: string; decision?: string; resultMessage?: string }
        | undefined;
      if (continuation?.type === 'approval_outcome') {
        expect(continuation).toMatchObject({
          approvalId: 'approval-outlook-1',
          decision: 'approved',
          resultMessage: 'Outlook draft created.',
        });
        return { content: 'The Outlook draft is present in Drafts.' };
      }
      return {
        content: 'Waiting for approval to create the Outlook draft.',
        metadata: {
          continueConversationAfterApproval: true,
          ...approvalPendingActionMetadata([
            {
              id: 'approval-outlook-1',
              toolName: 'outlook_draft',
              argsPreview: '{"to":"alex@example.com","subject":"Test One"}',
            },
          ]),
        },
      };
    };

    const pendingActionStore = {
      replaceActive: vi.fn((scope, record) => ({
        id: 'pending-worker-approval-1',
        scope,
        createdAt: 1,
        updatedAt: 1,
        ...record,
      } satisfies PendingActionRecord)),
    };

    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
        listApprovals: vi.fn(() => []),
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        auditLog: { record: vi.fn() },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
      undefined,
      {
        pendingActionStore,
        now: () => 1,
      },
    );

    const initial = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-outlook',
        userId: 'tester',
        principalId: 'tester',
        principalRole: 'owner',
        channel: 'web',
        content: 'Draft an Outlook email to alex@example.com.',
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      toolContext: '',
      runtimeNotices: [],
    });

    expect(initial.metadata?.pendingAction).toBeUndefined();
    expect(initial.metadata?.continueConversationAfterApproval).toBeUndefined();
    expect(pendingActionStore.replaceActive).not.toHaveBeenCalled();

    manager.shutdown();
  });

  it('does not mark direct pending approvals as resumable worker conversations without an explicit continuation flag', async () => {
    const { WorkerManager } = await import('./worker-manager.js');

    workerMessageHandler = () => ({
      content: 'Waiting for approval to run the automation.',
      metadata: approvalPendingActionMetadata([
        {
          id: 'approval-auto-run-1',
          toolName: 'automation_run',
          argsPreview: '{"automationId":"browser-read-smoke"}',
        },
      ]),
    });

    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
        listApprovals: vi.fn(() => []),
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        auditLog: { record: vi.fn() },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
    );

    const result = await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-auto-run',
        userId: 'tester',
        principalId: 'tester',
        principalRole: 'owner',
        channel: 'web',
        content: 'Run Browser Read Smoke now.',
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      toolContext: '',
      runtimeNotices: [],
    });

    expect(result.metadata?.pendingAction).toBeUndefined();
    expect(result.metadata?.continueConversationAfterApproval).toBeUndefined();

    manager.shutdown();
  });

  it('stores new pending actions created while a worker approval continuation is running', async () => {
    const { WorkerManager } = await import('./worker-manager.js');
    const continuationTaskContract = buildDelegatedTaskContract(undefined);
    const continuationToolMetadata = (toolName: string, status: 'succeeded' | 'pending_approval') => buildDelegatedExecutionMetadata(
      buildDelegatedSyntheticEnvelope({
        taskContract: continuationTaskContract,
        runStatus: status === 'pending_approval' ? 'suspended' : 'completed',
        stopReason: status === 'pending_approval' ? 'approval_required' : 'end_turn',
        operatorSummary: `${toolName} ${status}.`,
        evidenceReceipts: [{
          receiptId: `receipt-${toolName}-${status}`,
          sourceType: 'tool_call',
          toolName,
          status,
          refs: [],
          summary: `${toolName} ${status}.`,
          startedAt: 10,
          endedAt: 11,
        }],
        events: [
          {
            eventId: `${toolName}:${status}:started`,
            type: 'tool_call_started',
            timestamp: 10,
            payload: {
              toolName,
              summary: `${toolName} started.`,
            },
          },
          {
            eventId: `${toolName}:${status}:completed`,
            type: 'tool_call_completed',
            timestamp: 11,
            payload: {
              toolName,
              resultStatus: status,
              summary: `${toolName} ${status}.`,
            },
          },
        ],
      }),
    );
    const suspendedWorkerMetadata = (
      baseMetadata: Record<string, unknown>,
      message: {
        id?: string;
        userId?: string;
        principalId?: string;
        principalRole?: 'owner' | 'delegate' | 'system';
        channel?: string;
        surfaceId?: string;
        content?: string;
        metadata?: Record<string, unknown>;
        timestamp?: number;
      },
      approval: { id: string; toolName: string },
    ) => attachWorkerSuspensionMetadata(baseMetadata, {
      version: WORKER_SUSPENSION_SCHEMA_VERSION,
      kind: 'tool_loop',
      llmMessages: [
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: `call-${approval.id}`, name: approval.toolName, args: '{}' }],
        },
      ],
      pendingTools: [{
        approvalId: approval.id,
        toolCallId: `call-${approval.id}`,
        jobId: `job-${approval.id}`,
        name: approval.toolName,
      }],
      originalMessage: {
        id: message.id ?? 'm-security-follow-up',
        userId: message.userId ?? 'tester',
        principalId: message.principalId ?? 'tester',
        principalRole: message.principalRole ?? 'owner',
        channel: message.channel ?? 'web',
        ...(message.surfaceId ? { surfaceId: message.surfaceId } : {}),
        content: message.content ?? 'Create a security follow-up task and weekly automation.',
        metadata: message.metadata,
        timestamp: message.timestamp ?? 1,
      },
      createdAt: 1,
      expiresAt: 30_001,
    });

    workerMessageHandler = (params) => {
      const message = (params.message ?? {}) as {
        id?: string;
        userId?: string;
        principalId?: string;
        principalRole?: 'owner' | 'delegate' | 'system';
        channel?: string;
        surfaceId?: string;
        content?: string;
        metadata?: Record<string, unknown>;
        timestamp?: number;
      };
      const continuation = message.metadata?.[APPROVAL_OUTCOME_CONTINUATION_METADATA_KEY] as
        | { type?: string; approvalId?: string; decision?: string; resultMessage?: string }
        | undefined;
      if (continuation?.approvalId === 'approval-note-1') {
        return {
          content: 'Waiting for approval to create the weekly automation.',
          metadata: suspendedWorkerMetadata({
            continueConversationAfterApproval: true,
            ...approvalPendingActionMetadata([
              {
                id: 'approval-automation-2',
                toolName: 'automation_save',
                argsPreview: '{"name":"Weekly Security Posture Check"}',
              },
            ]),
            ...continuationToolMetadata('second_brain_task_upsert', 'succeeded'),
            executionEvents: [
              ...(continuationToolMetadata('second_brain_task_upsert', 'succeeded').executionEvents as unknown[]),
              ...(continuationToolMetadata('automation_save', 'pending_approval').executionEvents as unknown[]),
            ],
          }, message, { id: 'approval-automation-2', toolName: 'automation_save' }),
        };
      }
      if (continuation?.approvalId === 'approval-automation-2') {
        return {
          content: 'Created the task and weekly automation.',
          metadata: {
            ...continuationToolMetadata('automation_save', 'succeeded'),
            workerExecution: {
              lifecycle: 'failed',
              source: 'tool_loop',
              completionReason: 'model_response',
              responseQuality: 'final',
              terminationReason: 'clean_exit',
            },
          },
        };
      }
      return {
        content: 'Waiting for approval to create the Second Brain task.',
        metadata: suspendedWorkerMetadata({
          continueConversationAfterApproval: true,
          ...approvalPendingActionMetadata([
            {
              id: 'approval-note-1',
              toolName: 'second_brain_task_upsert',
              argsPreview: '{"title":"Review Guardian security posture findings"}',
            },
          ]),
        }, message, { id: 'approval-note-1', toolName: 'second_brain_task_upsert' }),
      };
    };

    const pendingActionStore = createMemoryPendingActionStore(() => 1);
    const executionGraphStore = new ExecutionGraphStore({ now: () => 1 });
    const intentRoutingTrace = {
      record: vi.fn(),
    };
    const runTimeline = {
      ingestDelegatedWorkerProgress: vi.fn(),
      ingestExecutionGraphEvent: vi.fn(),
      ingestDelegatedExecutionEvents: vi.fn(),
    };

    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
        listApprovals: vi.fn(() => []),
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        auditLog: { record: vi.fn() },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
      undefined,
      {
        pendingActionStore,
        executionGraphStore,
        intentRoutingTrace,
        runTimeline,
        now: () => 1,
      },
    );

    await manager.handleMessage({
      sessionId: 'tester:web',
      agentId: 'local',
      userId: 'tester',
      grantedCapabilities: [],
      message: {
        id: 'm-security-follow-up',
        userId: 'tester',
        principalId: 'tester',
        principalRole: 'owner',
        channel: 'web',
        surfaceId: 'surface-1',
        content: 'Create a security follow-up task and weekly automation.',
        metadata: repoGroundedCodingMetadata(),
        timestamp: Date.now(),
      },
      systemPrompt: 'system',
      history: [],
      knowledgeBases: [],
      activeSkills: [],
      toolContext: '',
      runtimeNotices: [],
    });

    const firstPending = pendingActionStore.findActiveByApprovalId('approval-note-1');
    expect(firstPending?.resume).toMatchObject({
      kind: 'execution_graph',
      payload: {
        graphId: expect.stringContaining('delegated-worker'),
        nodeKind: 'delegated_worker',
      },
    });

    const afterFirstApproval = await manager.resumeExecutionGraphPendingAction(
      firstPending!,
      {
        approvalId: 'approval-note-1',
        approvalResult: {
          success: true,
          approved: true,
          executionSucceeded: true,
          message: 'Task created.',
        },
      },
    );

    expect(afterFirstApproval?.metadata).toMatchObject({
      pendingAction: {
        blocker: {
          approvalIds: ['approval-automation-2'],
          approvalSummaries: [
            {
              id: 'approval-automation-2',
              toolName: 'automation_save',
            },
          ],
        },
      },
      continueConversationAfterApproval: true,
    });
    const secondPending = pendingActionStore.findActiveByApprovalId('approval-automation-2');
    expect(secondPending?.resume).toMatchObject({
      kind: 'execution_graph',
      payload: {
        graphId: firstPending?.resume?.payload.graphId,
        nodeKind: 'delegated_worker',
      },
    });
    const traceCountBeforeFinalApproval = intentRoutingTrace.record.mock.calls.length;
    const timelineCountBeforeFinalApproval = runTimeline.ingestDelegatedExecutionEvents.mock.calls.length;

    const completed = await manager.resumeExecutionGraphPendingAction(
      secondPending!,
      {
        approvalId: 'approval-automation-2',
        approvalResult: {
          success: true,
          approved: true,
          executionSucceeded: true,
          message: 'Automation created.',
        },
      },
    );

    expect(completed?.content).toBe('Created the task and weekly automation.');
    expect(completed?.metadata?.workerExecution).toBeUndefined();
    const finalApprovalTraceEntries = intentRoutingTrace.record.mock.calls
      .slice(traceCountBeforeFinalApproval)
      .map(([entry]) => entry);
    expect(finalApprovalTraceEntries).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        stage: 'delegated_interruption_requested',
      }),
      expect.objectContaining({
        stage: 'delegated_tool_call_completed',
        details: expect.objectContaining({
          resultStatus: 'pending_approval',
        }),
      }),
    ]));
    const finalApprovalTimelineCalls = runTimeline.ingestDelegatedExecutionEvents.mock.calls
      .slice(timelineCountBeforeFinalApproval)
      .map(([call]) => call);
    expect(finalApprovalTimelineCalls.flatMap((call) => call.events)).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'interruption_requested',
      }),
      expect.objectContaining({
        type: 'tool_call_completed',
        payload: expect.objectContaining({
          resultStatus: 'pending_approval',
        }),
      }),
    ]));
    const continuationToolTraces = intentRoutingTrace.record.mock.calls
      .map(([entry]) => entry)
      .filter((entry) => entry.stage === 'delegated_tool_call_completed');
    expect(continuationToolTraces).toEqual(expect.arrayContaining([
      expect.objectContaining({
        requestId: 'm-security-follow-up',
        details: expect.objectContaining({
          toolName: 'second_brain_task_upsert',
          resultStatus: 'succeeded',
        }),
      }),
      expect.objectContaining({
        requestId: 'm-security-follow-up',
        details: expect.objectContaining({
          toolName: 'automation_save',
          resultStatus: 'pending_approval',
        }),
      }),
      expect.objectContaining({
        requestId: 'm-security-follow-up',
        details: expect.objectContaining({
          toolName: 'automation_save',
          resultStatus: 'succeeded',
        }),
      }),
    ]));
    const delegatedTimelineEvents = runTimeline.ingestDelegatedExecutionEvents.mock.calls.map(([call]) => call);
    expect(delegatedTimelineEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        parentRunId: 'm-security-follow-up',
        taskRunId: expect.stringMatching(/^delegated-task:job-[^:]+$/),
        events: expect.arrayContaining([
          expect.objectContaining({
            type: 'tool_call_completed',
            payload: expect.objectContaining({
              toolName: 'automation_save',
              resultStatus: 'succeeded',
            }),
          }),
        ]),
      }),
    ]));
    manager.shutdown();
  });

  it('does not abort shutdown when worker workspace cleanup is busy', async () => {
    const { WorkerManager } = await import('./worker-manager.js');
    const workspacePath = join(tmpdir(), `ga-worker-busy-${Date.now()}`);
    mkdirSync(workspacePath, { recursive: true });

    const manager = new WorkerManager(
      {
        listAlwaysLoadedDefinitions: () => [],
      } as never,
      {
        getFallbackProviderConfig: () => undefined,
        auditLog: { record: vi.fn() },
      } as never,
      {
        workerEntryPoint: 'src/worker/worker-entry.ts',
        workerMaxMemoryMb: 2048,
        workerIdleTimeoutMs: 300_000,
        workerShutdownGracePeriodMs: 10,
        capabilityTokenTtlMs: 600_000,
        capabilityTokenMaxToolCalls: 0,
      } as never,
    );

    const worker = {
      id: 'worker-busy',
      sessionId: 'tester:web',
      workerSessionKey: 'tester:web::local',
      agentId: 'local',
      authorizedBy: 'tester',
      grantedCapabilities: [],
      process: new FakeWorkerChild(),
      brokerServer: { sendNotification: vi.fn() },
      workspacePath,
      lastActivityMs: Date.now(),
      status: 'ready' as 'starting' | 'ready' | 'error' | 'shutting_down',
      dispatchQueue: Promise.resolve(),
    };

    const managerState = manager as unknown as {
      workers: Map<string, typeof worker>;
      sessionToWorker: Map<string, string>;
      removeWorkspacePath: (workspacePath: string) => void;
    };

    managerState.workers.set(worker.id, worker);
    managerState.sessionToWorker.set(worker.workerSessionKey, worker.id);
    const removeWorkspacePath = vi.fn(() => {
      throw Object.assign(new Error('resource busy or locked'), { code: 'EBUSY' });
    });
    managerState.removeWorkspacePath = removeWorkspacePath;

    expect(() => manager.shutdown()).not.toThrow();
    expect(worker.status).toBe('shutting_down');
    expect(removeWorkspacePath).toHaveBeenCalledWith(worker.workspacePath);
    expect(managerState.workers.size).toBe(0);
    expect(managerState.sessionToWorker.size).toBe(0);

    rmSync(workspacePath, { recursive: true, force: true });
  });
});
