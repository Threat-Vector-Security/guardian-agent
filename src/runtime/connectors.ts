/**
 * Connector + Playbook runtime service (Option 2).
 *
 * Executes declarative playbooks through the existing ToolExecutor pipeline so
 * Guardian checks, tool policy, and approvals remain the enforcement boundary.
 */

import { randomUUID } from 'node:crypto';
import { isAbsolute, resolve } from 'node:path';
import type {
  AssistantConnectorsConfig,
  AssistantConnectorPackConfig,
  AssistantConnectorPlaybookDefinition,
  AssistantConnectorPlaybookStepDefinition,
  AutomationOutputHandlingConfig,
  ConnectorExecutionMode,
} from '../config/types.js';
import type { ToolExecutionRequest, ToolRunResponse } from '../tools/types.js';
import type { AutomationPromotedFindingRef } from './automation-output.js';
import { GraphRunner } from './graph-runner.js';
import type { GraphNodeExecutionResult, PlaybookGraphDefinition } from './graph-types.js';
import { createRunEvent, type OrchestrationRunEvent } from './run-events.js';
import { InMemoryRunStateStore } from './run-state-store.js';

const MAX_RUN_HISTORY = 200;

type PlaybookStepStatus = 'succeeded' | 'failed' | 'pending_approval';
type PlaybookRunStatus = 'succeeded' | 'failed' | 'awaiting_approval';

export interface PlaybookStepRunResult {
  stepId: string;
  toolName: string;
  packId: string;
  status: PlaybookStepStatus;
  message: string;
  jobId?: string;
  approvalId?: string;
  durationMs: number;
  output?: unknown;
}

export interface PlaybookRunRecord {
  id: string;
  runId: string;
  graphId: string;
  playbookId: string;
  playbookName: string;
  createdAt: number;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  dryRun: boolean;
  status: PlaybookRunStatus;
  message: string;
  steps: PlaybookStepRunResult[];
  outputHandling?: AutomationOutputHandlingConfig;
  promotedFindings?: AutomationPromotedFindingRef[];
  requestedBy?: string;
  origin: ToolExecutionRequest['origin'];
  events: OrchestrationRunEvent[];
}

export interface ConnectorFrameworkState {
  summary: {
    enabled: boolean;
    executionMode: ConnectorExecutionMode;
    maxConnectorCallsPerRun: number;
    packCount: number;
    enabledPackCount: number;
    playbookCount: number;
    enabledPlaybookCount: number;
    runCount: number;
    dryRunQualifiedCount: number;
  };
  packs: AssistantConnectorPackConfig[];
  playbooks: AssistantConnectorPlaybookDefinition[];
  runs: PlaybookRunRecord[];
  playbooksConfig: {
    enabled: boolean;
    maxSteps: number;
    maxParallelSteps: number;
    defaultStepTimeoutMs: number;
    requireSignedDefinitions: boolean;
    requireDryRunOnFirstExecution: boolean;
  };
  studio: AssistantConnectorsConfig['studio'];
}

export interface ConnectorSettingsUpdate {
  enabled?: boolean;
  executionMode?: ConnectorExecutionMode;
  maxConnectorCallsPerRun?: number;
  playbooks?: Partial<AssistantConnectorsConfig['playbooks']>;
  studio?: Partial<AssistantConnectorsConfig['studio']>;
}

export interface ConnectorPlaybookRunInput {
  playbookId: string;
  dryRun?: boolean;
  origin: ToolExecutionRequest['origin'];
  agentId?: string;
  userId?: string;
  channel?: string;
  requestedBy?: string;
  bypassApprovals?: boolean;
}

export interface ConnectorPlaybookRunResult {
  success: boolean;
  status: PlaybookRunStatus;
  message: string;
  run: PlaybookRunRecord;
}

/** Callback that sends a prompt to an LLM and returns the text response. */
export type RunInstructionFn = (
  prompt: string,
  provider?: string,
  maxTokens?: number,
) => Promise<string>;

interface ConnectorPlaybookServiceOptions {
  config: AssistantConnectorsConfig;
  runTool: (request: ToolExecutionRequest) => Promise<ToolRunResponse>;
  /** Optional LLM callback for instruction steps. Required if playbooks use instruction steps. */
  runInstruction?: RunInstructionFn;
  /** Optional output scanner (e.g. OutputGuardian) for instruction step responses. */
  scanOutput?: (text: string) => Promise<string>;
  now?: () => number;
  runStateStore?: InMemoryRunStateStore<PlaybookStepRunResult>;
}

export class ConnectorPlaybookService {
  private config: AssistantConnectorsConfig;
  private readonly runTool: (request: ToolExecutionRequest) => Promise<ToolRunResponse>;
  private readonly runInstruction?: RunInstructionFn;
  private readonly scanOutput?: (text: string) => Promise<string>;
  private readonly now: () => number;
  private readonly graphRunner: GraphRunner<PlaybookStepRunResult>;
  private readonly runs: PlaybookRunRecord[] = [];
  private readonly dryRunQualified = new Set<string>();

  constructor(options: ConnectorPlaybookServiceOptions) {
    this.config = cloneConnectorsConfig(options.config);
    this.runTool = options.runTool;
    this.runInstruction = options.runInstruction;
    this.scanOutput = options.scanOutput;
    this.now = options.now ?? Date.now;
    this.graphRunner = new GraphRunner<PlaybookStepRunResult>({
      now: this.now,
      store: options.runStateStore ?? new InMemoryRunStateStore<PlaybookStepRunResult>(),
    });
  }

  getConfig(): AssistantConnectorsConfig {
    return cloneConnectorsConfig(this.config);
  }

  updateConfig(config: AssistantConnectorsConfig): void {
    this.config = cloneConnectorsConfig(config);
  }

  getState(limitRuns = 50): ConnectorFrameworkState {
    const packs = this.config.packs.map(clonePack);
    const playbooks = this.config.playbooks.definitions.map(clonePlaybook);
    return {
      summary: {
        enabled: this.config.enabled,
        executionMode: this.config.executionMode,
        maxConnectorCallsPerRun: this.config.maxConnectorCallsPerRun,
        packCount: packs.length,
        enabledPackCount: packs.filter((pack) => pack.enabled).length,
        playbookCount: playbooks.length,
        enabledPlaybookCount: playbooks.filter((playbook) => playbook.enabled).length,
        runCount: this.runs.length,
        dryRunQualifiedCount: this.dryRunQualified.size,
      },
      packs,
      playbooks,
      runs: this.runs.slice(0, Math.max(1, limitRuns)).map((run) => ({
        ...run,
        steps: run.steps.map((step) => ({ ...step })),
        events: run.events.map((event) => ({ ...event })),
      })),
      playbooksConfig: {
        enabled: this.config.playbooks.enabled,
        maxSteps: this.config.playbooks.maxSteps,
        maxParallelSteps: this.config.playbooks.maxParallelSteps,
        defaultStepTimeoutMs: this.config.playbooks.defaultStepTimeoutMs,
        requireSignedDefinitions: this.config.playbooks.requireSignedDefinitions,
        requireDryRunOnFirstExecution: this.config.playbooks.requireDryRunOnFirstExecution,
      },
      studio: { ...this.config.studio },
    };
  }

  updateSettings(update: ConnectorSettingsUpdate): { success: boolean; message: string } {
    if (update.enabled !== undefined) {
      this.config.enabled = update.enabled;
    }
    if (update.executionMode) {
      this.config.executionMode = update.executionMode;
    }
    if (update.maxConnectorCallsPerRun !== undefined) {
      this.config.maxConnectorCallsPerRun = update.maxConnectorCallsPerRun;
    }
    if (update.playbooks) {
      this.config.playbooks = {
        ...this.config.playbooks,
        ...update.playbooks,
      };
    }
    if (update.studio) {
      this.config.studio = {
        ...this.config.studio,
        ...update.studio,
      };
    }
    return { success: true, message: 'Connector settings updated.' };
  }

  upsertPack(pack: AssistantConnectorPackConfig): { success: boolean; message: string } {
    const index = this.config.packs.findIndex((existing) => existing.id === pack.id);
    if (index >= 0) {
      this.config.packs[index] = clonePack(pack);
      return { success: true, message: `Updated connector pack '${pack.id}'.` };
    }
    this.config.packs.push(clonePack(pack));
    return { success: true, message: `Added connector pack '${pack.id}'.` };
  }

  deletePack(packId: string): { success: boolean; message: string } {
    const index = this.config.packs.findIndex((pack) => pack.id === packId);
    if (index < 0) {
      return { success: false, message: `Connector pack '${packId}' not found.` };
    }
    this.config.packs.splice(index, 1);
    return { success: true, message: `Deleted connector pack '${packId}'.` };
  }

  upsertPlaybook(playbook: AssistantConnectorPlaybookDefinition): { success: boolean; message: string } {
    const index = this.config.playbooks.definitions.findIndex((existing) => existing.id === playbook.id);
    if (index >= 0) {
      this.config.playbooks.definitions[index] = clonePlaybook(playbook);
      return { success: true, message: `Updated playbook '${playbook.id}'.` };
    }
    this.config.playbooks.definitions.push(clonePlaybook(playbook));
    return { success: true, message: `Added playbook '${playbook.id}'.` };
  }

  deletePlaybook(playbookId: string): { success: boolean; message: string } {
    const index = this.config.playbooks.definitions.findIndex((playbook) => playbook.id === playbookId);
    if (index < 0) {
      return { success: false, message: `Playbook '${playbookId}' not found.` };
    }
    this.config.playbooks.definitions.splice(index, 1);
    this.dryRunQualified.delete(playbookId);
    return { success: true, message: `Deleted playbook '${playbookId}'.` };
  }

  async runPlaybook(input: ConnectorPlaybookRunInput): Promise<ConnectorPlaybookRunResult> {
    const playbook = this.config.playbooks.definitions.find((candidate) => candidate.id === input.playbookId);
    if (!this.config.enabled) {
      return this.buildDeniedRun(input, playbook, 'Connector framework is disabled.');
    }
    if (!this.config.playbooks.enabled) {
      return this.buildDeniedRun(input, playbook, 'Playbook execution is disabled.');
    }
    if (!playbook) {
      return this.buildDeniedRun(input, undefined, `Playbook '${input.playbookId}' not found.`);
    }
    if (!playbook.enabled) {
      return this.buildDeniedRun(input, playbook, `Playbook '${playbook.id}' is disabled.`);
    }
    if (this.config.playbooks.requireSignedDefinitions && !playbook.signature?.trim()) {
      return this.buildDeniedRun(input, playbook, `Playbook '${playbook.id}' requires a signature.`);
    }
    if (
      this.config.playbooks.requireDryRunOnFirstExecution &&
      !input.dryRun &&
      !this.dryRunQualified.has(playbook.id)
    ) {
      return this.buildDeniedRun(
        input,
        playbook,
        `Playbook '${playbook.id}' requires a successful dry-run before live execution.`,
      );
    }

    if (playbook.steps.length > this.config.playbooks.maxSteps) {
      return this.buildDeniedRun(
        input,
        playbook,
        `Playbook '${playbook.id}' exceeds configured maxSteps (${this.config.playbooks.maxSteps}).`,
      );
    }
    if (playbook.steps.length > this.config.maxConnectorCallsPerRun) {
      return this.buildDeniedRun(
        input,
        playbook,
        `Playbook '${playbook.id}' exceeds maxConnectorCallsPerRun (${this.config.maxConnectorCallsPerRun}).`,
      );
    }

    const startedAt = this.now();
    const graph = compilePlaybookToGraph(playbook);
    const graphResult = await this.graphRunner.run(graph, {
      executeStep: async (node, priorResults) => {
        const result = await this.executeStep(node.step, input, priorResults);
        return {
          status: result.status,
          results: [result],
          message: result.message,
        } satisfies GraphNodeExecutionResult<PlaybookStepRunResult>;
      },
      executeParallel: async (node, priorResults) => {
        const results = await Promise.all(node.steps.map((step) => this.executeStep(step, input, priorResults)));
        const hasPending = results.some((result) => result.status === 'pending_approval');
        const hasHardFailure = results.some((result) => {
          if (result.status !== 'failed') return false;
          const def = node.steps.find((item) => item.id === result.stepId);
          return !def?.continueOnError;
        });
        return {
          status: hasPending ? 'pending_approval' : hasHardFailure ? 'failed' : 'succeeded',
          results,
          message: hasPending
            ? `Playbook '${playbook.id}' paused for approval.`
            : hasHardFailure
              ? `Playbook '${playbook.id}' completed with failures.`
              : `Playbook '${playbook.id}' completed successfully.`,
        } satisfies GraphNodeExecutionResult<PlaybookStepRunResult>;
      },
    });

    const steps = graphResult.results;
    const status: PlaybookRunStatus = graphResult.status === 'awaiting_approval'
      ? 'awaiting_approval'
      : graphResult.status === 'failed'
        ? 'failed'
        : 'succeeded';
    const message = graphResult.message;

    const completedAt = this.now();
    const run: PlaybookRunRecord = {
      id: randomUUID(),
      runId: graphResult.runId,
      graphId: graphResult.graphId,
      playbookId: playbook.id,
      playbookName: playbook.name,
      createdAt: startedAt,
      startedAt,
      completedAt,
      durationMs: completedAt - startedAt,
      dryRun: !!input.dryRun,
      status,
      message,
      steps,
      outputHandling: playbook.outputHandling,
      requestedBy: input.requestedBy,
      origin: input.origin,
      events: graphResult.events.map((event) => ({ ...event })),
    };
    this.recordRun(run);

    if (input.dryRun && status === 'succeeded') {
      this.dryRunQualified.add(playbook.id);
    }

    return {
      success: status === 'succeeded',
      status,
      message,
      run,
    };
  }

  private async executeStep(
    step: AssistantConnectorPlaybookStepDefinition,
    input: ConnectorPlaybookRunInput,
    priorResults?: PlaybookStepRunResult[],
  ): Promise<PlaybookStepRunResult> {
    if (step.type === 'instruction') {
      return this.executeInstructionStep(step, input, priorResults ?? []);
    }

    if (step.type === 'delay') {
      return this.executeDelayStep(step, input);
    }

    const startedAt = this.now();
    const scopedPackId = normalizeStepPackId(step.packId);
    const pack = scopedPackId
      ? this.config.packs.find((candidate) => candidate.id === scopedPackId)
      : undefined;
    if (scopedPackId && (!pack || !pack.enabled)) {
      return {
        stepId: step.id,
        toolName: step.toolName,
        packId: scopedPackId,
        status: 'failed',
        message: `Tool access profile '${scopedPackId}' is unavailable.`,
        durationMs: this.now() - startedAt,
      };
    }

    const args = isRecord(step.args)
      ? resolveStepTemplates(step.args, priorResults ?? [])
      : {};
    if (pack) {
      const capability = inferCapability(step.toolName);
      if (!capabilityAllowed(capability, pack.allowedCapabilities)) {
        return {
          stepId: step.id,
          toolName: step.toolName,
          packId: scopedPackId,
          status: 'failed',
          message: `Capability '${capability}' is not allowed for access profile '${pack.id}'.`,
          durationMs: this.now() - startedAt,
        };
      }

      const pathCheck = checkArgsPaths(args, pack.allowedPaths);
      if (!pathCheck.allowed) {
        return {
          stepId: step.id,
          toolName: step.toolName,
          packId: scopedPackId,
          status: 'failed',
          message: pathCheck.reason,
          durationMs: this.now() - startedAt,
        };
      }

      const commandCheck = checkArgsCommands(args, pack.allowedCommands);
      if (!commandCheck.allowed) {
        return {
          stepId: step.id,
          toolName: step.toolName,
          packId: scopedPackId,
          status: 'failed',
          message: commandCheck.reason,
          durationMs: this.now() - startedAt,
        };
      }

      const hostCheck = checkArgsHosts(args, pack.allowedHosts);
      if (!hostCheck.allowed) {
        return {
          stepId: step.id,
          toolName: step.toolName,
          packId: scopedPackId,
          status: 'failed',
          message: hostCheck.reason,
          durationMs: this.now() - startedAt,
        };
      }
    }

    const timeoutMs = step.timeoutMs ?? this.config.playbooks.defaultStepTimeoutMs;
    try {
      const toolResult = await withTimeout(
        this.runTool({
          toolName: step.toolName,
          args,
          origin: input.origin,
          agentId: input.agentId,
          userId: input.userId,
          channel: input.channel,
          dryRun: !!input.dryRun,
          bypassApprovals: input.bypassApprovals === true,
        }),
        timeoutMs,
      );

      const status: PlaybookStepStatus = toolResult.status === 'pending_approval'
        ? 'pending_approval'
        : toolResult.success
          ? 'succeeded'
          : 'failed';

      return {
        stepId: step.id,
        toolName: step.toolName,
        packId: scopedPackId,
        status,
        message: toolResult.message,
        jobId: toolResult.jobId,
        approvalId: toolResult.approvalId,
        durationMs: this.now() - startedAt,
        output: toolResult.output,
      };
    } catch (err) {
      return {
        stepId: step.id,
        toolName: step.toolName,
        packId: scopedPackId,
        status: 'failed',
        message: err instanceof Error ? err.message : String(err),
        durationMs: this.now() - startedAt,
      };
    }
  }

  private async executeInstructionStep(
    step: AssistantConnectorPlaybookStepDefinition,
    input: ConnectorPlaybookRunInput,
    priorResults: PlaybookStepRunResult[],
  ): Promise<PlaybookStepRunResult> {
    const startedAt = this.now();

    if (!step.instruction?.trim()) {
      return {
        stepId: step.id,
        toolName: '_instruction',
        packId: '',
        status: 'failed',
        message: 'Instruction step has no instruction text.',
        durationMs: this.now() - startedAt,
      };
    }

    if (!this.runInstruction) {
      return {
        stepId: step.id,
        toolName: '_instruction',
        packId: '',
        status: 'failed',
        message: 'Instruction steps require an LLM provider but none is configured.',
        durationMs: this.now() - startedAt,
      };
    }

    // Dry-run: return synthetic success without calling the LLM.
    if (input.dryRun) {
      return {
        stepId: step.id,
        toolName: '_instruction',
        packId: '',
        status: 'succeeded',
        message: 'Instruction step (dry-run — LLM not called).',
        durationMs: this.now() - startedAt,
        output: '[dry-run: instruction output would appear here]',
      };
    }

    // Build context from prior step outputs.
    const context = priorResults
      .filter((r) => r.output != null)
      .map((r) => `### Step "${r.stepId}" (${r.toolName}) — ${r.status}\n${formatStepOutput(r.output)}`)
      .join('\n\n');

    const prompt = [
      'You are processing an automation pipeline step.',
      'Below are the outputs from prior steps in this automation:\n',
      context || '(no prior step outputs)',
      '\n---\n',
      'Your instruction for this step:\n',
      step.instruction,
      '\nRespond with the requested output only. Do not explain the automation or reference these instructions.',
    ].join('\n');

    const timeoutMs = step.timeoutMs ?? this.config.playbooks.defaultStepTimeoutMs;
    try {
      const raw = await withTimeout(
        this.runInstruction(prompt, step.llmProvider, step.maxTokens ?? 2048),
        timeoutMs,
      );

      // Optionally scan LLM output (e.g. OutputGuardian secret/PII redaction).
      const output = this.scanOutput ? await this.scanOutput(raw) : raw;

      return {
        stepId: step.id,
        toolName: '_instruction',
        packId: '',
        status: 'succeeded',
        message: 'Instruction completed.',
        durationMs: this.now() - startedAt,
        output,
      };
    } catch (err) {
      return {
        stepId: step.id,
        toolName: '_instruction',
        packId: '',
        status: 'failed',
        message: err instanceof Error ? err.message : String(err),
        durationMs: this.now() - startedAt,
      };
    }
  }

  private async executeDelayStep(
    step: AssistantConnectorPlaybookStepDefinition,
    input: ConnectorPlaybookRunInput,
  ): Promise<PlaybookStepRunResult> {
    const startedAt = this.now();
    const delayMs = step.delayMs;
    if (!delayMs || delayMs <= 0) {
      return {
        stepId: step.id,
        toolName: '_delay',
        packId: '',
        status: 'failed',
        message: 'Delay step requires delayMs > 0.',
        durationMs: this.now() - startedAt,
      };
    }

    // Ensure per-step timeout won't kill a valid delay
    if (!step.timeoutMs) {
      step.timeoutMs = delayMs + 5000;
    }

    if (input.dryRun) {
      return {
        stepId: step.id,
        toolName: '_delay',
        packId: '',
        status: 'succeeded',
        message: `Delay step: would pause for ${delayMs}ms (skipped in dry run).`,
        durationMs: this.now() - startedAt,
        output: `Dry run — skipped ${delayMs}ms delay.`,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));

    return {
      stepId: step.id,
      toolName: '_delay',
      packId: '',
      status: 'succeeded',
      message: `Paused for ${delayMs}ms.`,
      durationMs: this.now() - startedAt,
      output: `Delay completed (${delayMs}ms).`,
    };
  }

  private buildDeniedRun(
    input: ConnectorPlaybookRunInput,
    playbook: AssistantConnectorPlaybookDefinition | undefined,
    reason: string,
  ): ConnectorPlaybookRunResult {
    const now = this.now();
    const runId = randomUUID();
    const run: PlaybookRunRecord = {
      id: randomUUID(),
      playbookId: playbook?.id ?? input.playbookId,
      playbookName: playbook?.name ?? input.playbookId,
      runId,
      graphId: playbook?.id ?? input.playbookId,
      createdAt: now,
      startedAt: now,
      completedAt: now,
      durationMs: 0,
      dryRun: !!input.dryRun,
      status: 'failed',
      message: reason,
      steps: [],
      outputHandling: playbook?.outputHandling,
      requestedBy: input.requestedBy,
      origin: input.origin,
      events: [
        createRunEvent(runId, 'run_failed', now, {
          message: reason,
        }),
      ],
    };
    this.recordRun(run);
    return { success: false, status: 'failed', message: reason, run };
  }

  private recordRun(run: PlaybookRunRecord): void {
    this.runs.unshift(run);
    while (this.runs.length > MAX_RUN_HISTORY) {
      this.runs.pop();
    }
  }
}

function compilePlaybookToGraph(playbook: AssistantConnectorPlaybookDefinition): PlaybookGraphDefinition {
  const graphId = `${playbook.id}:v1`;
  if (playbook.mode === 'parallel') {
    return {
      id: graphId,
      name: playbook.name,
      playbookId: playbook.id,
      entryNodeId: 'start',
      nodes: [
        { id: 'start', type: 'start', next: 'parallel' },
        { id: 'parallel', type: 'parallel', steps: playbook.steps.map((step) => ({ ...step })), next: 'end' },
        { id: 'end', type: 'end' },
      ],
    };
  }

  const nodes: PlaybookGraphDefinition['nodes'] = [{ id: 'start', type: 'start', next: playbook.steps[0]?.id || 'end' }];
  for (const [index, step] of playbook.steps.entries()) {
    nodes.push({
      id: step.id,
      type: 'step',
      step: { ...step },
      next: playbook.steps[index + 1]?.id || 'end',
    });
  }
  nodes.push({ id: 'end', type: 'end' });
  return {
    id: graphId,
    name: playbook.name,
    playbookId: playbook.id,
    entryNodeId: 'start',
    nodes,
  };
}

function capabilityAllowed(capability: string, allowedCapabilities: string[]): boolean {
  if (allowedCapabilities.length === 0) return false;
  return allowedCapabilities.includes('*') || allowedCapabilities.includes(capability);
}

function normalizeStepPackId(packId: string | null | undefined): string {
  const normalized = (packId ?? '').trim();
  if (!normalized) return '';
  return normalized.toLowerCase() === 'default' ? '' : normalized;
}

function inferCapability(toolName: string): string {
  if (toolName.startsWith('fs_') || toolName === 'doc_create') {
    return toolName === 'fs_read' || toolName === 'fs_list' || toolName === 'fs_search'
      ? 'filesystem.read'
      : 'filesystem.write';
  }
  if (toolName === 'shell_safe' || toolName === 'run_command') return 'shell.execute';
  if (toolName.startsWith('contacts_') || toolName.startsWith('campaign_') || toolName.startsWith('gmail_')) {
    return 'email.workflow';
  }
  if (toolName.startsWith('intel_') || toolName === 'forum_post') return 'intel.operations';
  if (toolName.startsWith('net_')) return 'network.read';
  if (toolName.startsWith('sys_')) return 'system.read';
  if (toolName.startsWith('mcp-')) return 'mcp.tools';
  return 'network.http';
}

function checkArgsPaths(args: Record<string, unknown>, allowedPaths: string[]): { allowed: boolean; reason: string } {
  const keys = ['path', 'filePath', 'targetPath', 'outputPath', 'workspacePath', 'csvPath'];
  const candidates = keys
    .map((key) => args[key])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  for (const candidate of candidates) {
    if (!isPathWithinAllowedRoots(candidate, allowedPaths)) {
      return { allowed: false, reason: `Path '${candidate}' is outside the allowed paths for this access profile.` };
    }
  }
  return { allowed: true, reason: 'ok' };
}

function checkArgsCommands(args: Record<string, unknown>, allowedCommands: string[]): { allowed: boolean; reason: string } {
  const keys = ['command', 'cmd'];
  const candidates = keys
    .map((key) => args[key])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  for (const candidate of candidates) {
    const normalized = candidate.trim();
    const allowed = allowedCommands.some((prefix) =>
      normalized === prefix || normalized.startsWith(`${prefix} `),
    );
    if (!allowed) {
      return { allowed: false, reason: `Command '${candidate}' is outside the allowed commands for this access profile.` };
    }
  }
  return { allowed: true, reason: 'ok' };
}

function checkArgsHosts(args: Record<string, unknown>, allowedHosts: string[]): { allowed: boolean; reason: string } {
  const keys = ['url', 'baseUrl', 'endpoint', 'targetUrl'];
  const candidates = keys
    .map((key) => args[key])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      const host = url.hostname.toLowerCase();
      const allowed = allowedHosts.some((allowedHost) => {
        const normalized = allowedHost.trim().toLowerCase();
        return host === normalized || host.endsWith(`.${normalized}`);
      });
      if (!allowed) {
        return { allowed: false, reason: `Host '${host}' is outside the allowed hosts for this access profile.` };
      }
    } catch {
      return { allowed: false, reason: `Invalid URL '${candidate}'.` };
    }
  }
  return { allowed: true, reason: 'ok' };
}

function normalizePathValue(value: string): string {
  const trimmed = value.trim();
  const resolved = isAbsolute(trimmed) ? trimmed : resolve(process.cwd(), trimmed);
  return resolved.replaceAll('\\', '/').toLowerCase();
}

function isPathWithinAllowedRoots(candidate: string, allowedRoots: string[]): boolean {
  const normalizedCandidate = normalizePathValue(candidate);
  for (const root of allowedRoots) {
    const normalizedRoot = normalizePathValue(root);
    if (normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(`${normalizedRoot}/`)) {
      return true;
    }
  }
  return false;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Step timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cloneConnectorsConfig(config: AssistantConnectorsConfig): AssistantConnectorsConfig {
  return {
    enabled: config.enabled,
    executionMode: config.executionMode,
    maxConnectorCallsPerRun: config.maxConnectorCallsPerRun,
    packs: config.packs.map(clonePack),
    playbooks: {
      ...config.playbooks,
      definitions: config.playbooks.definitions.map(clonePlaybook),
    },
    studio: { ...config.studio },
  };
}

function clonePack(pack: AssistantConnectorPackConfig): AssistantConnectorPackConfig {
  return {
    ...pack,
    allowedCapabilities: [...pack.allowedCapabilities],
    allowedHosts: [...pack.allowedHosts],
    allowedPaths: [...pack.allowedPaths],
    allowedCommands: [...pack.allowedCommands],
  };
}

function clonePlaybook(playbook: AssistantConnectorPlaybookDefinition): AssistantConnectorPlaybookDefinition {
  return {
    ...playbook,
    outputHandling: playbook.outputHandling ? { ...playbook.outputHandling } : undefined,
    steps: playbook.steps.map(cloneStep),
  };
}

function cloneStep(step: AssistantConnectorPlaybookStepDefinition): AssistantConnectorPlaybookStepDefinition {
  return {
    ...step,
    args: step.args ? { ...step.args } : undefined,
  };
}

function resolveStepTemplates(
  value: Record<string, unknown>,
  priorResults: PlaybookStepRunResult[],
): Record<string, unknown> {
  return resolveTemplateValue(value, priorResults) as Record<string, unknown>;
}

function resolveTemplateValue(value: unknown, priorResults: PlaybookStepRunResult[]): unknown {
  if (typeof value === 'string') {
    return replaceStepPlaceholders(value, priorResults);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => resolveTemplateValue(entry, priorResults));
  }
  if (isRecord(value)) {
    const resolved: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      resolved[key] = resolveTemplateValue(entry, priorResults);
    }
    return resolved;
  }
  return value;
}

function replaceStepPlaceholders(template: string, priorResults: PlaybookStepRunResult[]): unknown {
  const exactMatch = template.match(/^\$\{([^.}]+)\.(output|message|status)\}$/);
  if (exactMatch) {
    return resolveStepPlaceholderValue(exactMatch[1], exactMatch[2], priorResults);
  }

  return template.replace(/\$\{([^.}]+)\.(output|message|status)\}/g, (_match, stepId: string, field: string) => {
    const resolved = resolveStepPlaceholderValue(stepId, field, priorResults);
    return typeof resolved === 'string' ? resolved : formatStepOutput(resolved);
  });
}

function resolveStepPlaceholderValue(
  stepId: string,
  field: string,
  priorResults: PlaybookStepRunResult[],
): unknown {
  const step = priorResults.find((result) => result.stepId === stepId);
  if (!step) return '';
  if (field === 'output') return step.output ?? '';
  if (field === 'message') return step.message;
  if (field === 'status') return step.status;
  return '';
}

function formatStepOutput(output: unknown): string {
  if (output === null || output === undefined) return '';
  if (typeof output === 'string') return output;
  try {
    return JSON.stringify(output, null, 2);
  } catch {
    return String(output);
  }
}
