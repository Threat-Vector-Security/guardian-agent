/**
 * Orchestration agents — structured multi-agent composition patterns.
 *
 * Inspired by Google ADK's SequentialAgent/ParallelAgent/LoopAgent,
 * but integrated with GuardianAgent's security model. All sub-agent
 * invocations pass through the Guardian admission pipeline.
 *
 * Patterns:
 *   SequentialAgent — runs sub-agents in order, passing state between steps
 *   ParallelAgent   — runs sub-agents concurrently, collecting all results
 *   LoopAgent       — runs a sub-agent repeatedly until a condition is met
 */

import { BaseAgent } from './agent.js';
import type {
  AgentContext,
  AgentDispatchOptions,
  AgentResponse,
  UserMessage,
} from './types.js';
import { SharedState } from '../runtime/shared-state.js';
import type { AgentHandoffContract } from '../runtime/handoffs.js';
import Ajv from 'ajv';
import { createLogger } from '../util/logging.js';

const log = createLogger('orchestration');

// ─── Orchestration Types ──────────────────────────────────────

export interface OrchestrationStepContract {
  key: string;
  schema: Record<string, unknown>;
  maxBytes?: number;
  sanitize?: 'none' | 'llm_text' | 'json_text';
}

export type ValidationMode = 'warn' | 'enforce' | 'none';

/** Per-step retry configuration with exponential backoff. */
export interface StepRetryPolicy {
  maxRetries: number;
  initialDelayMs?: number;
  backoffMultiplier?: number;
  maxDelayMs?: number;
  retryableError?: (error: Error) => boolean;
}

/** Fail-branch: agent invoked when a step fails all retries. */
export interface StepFailBranch {
  agentId: string;
  inputKey?: string;
  outputKey?: string;
  inputContract?: OrchestrationStepContract;
  outputContract?: OrchestrationStepContract;
}

/** A single step in an orchestration pipeline. */
export interface OrchestrationStep {
  /** Target agent ID to invoke. */
  agentId: string;
  /**
   * Key in shared state to read as input content override.
   * If set and the key exists, this value replaces the user message content.
   */
  inputKey?: string;
  /**
   * Key in shared state to write this step's response content.
   * If not set, defaults to the agent ID.
   */
  outputKey?: string;

  inputContract?: OrchestrationStepContract;
  outputContract?: OrchestrationStepContract;

  /** Retry policy for this step. If not set, no retries. */
  retry?: StepRetryPolicy;
  /** Fail-branch: agent invoked when step fails all retries. */
  onError?: StepFailBranch;
  /** Optional handoff contract for this step's downstream dispatch. */
  handoff?: Omit<AgentHandoffContract, 'id' | 'sourceAgentId' | 'targetAgentId'> & {
    id?: string;
  };
}

/** Options for SequentialAgent construction. */
export interface SequentialAgentOptions {
  /** Ordered list of steps to execute. */
  steps: OrchestrationStep[];
  /**
   * Whether to stop the pipeline on the first step that returns an error.
   * Default: true.
   */
  stopOnError?: boolean;
  validationMode?: ValidationMode;
}

/** Options for ParallelAgent construction. */
export interface ParallelAgentOptions {
  /** Steps to execute concurrently. */
  steps: OrchestrationStep[];
  /**
   * Maximum concurrent invocations. 0 = unlimited.
   * Default: 0.
   */
  maxConcurrency?: number;
  validationMode?: ValidationMode;
}

/** Condition function for LoopAgent — return true to continue looping. */
export type LoopCondition = (
  iteration: number,
  lastResponse: AgentResponse | undefined,
  state: SharedState,
) => boolean;

/** Array iteration configuration for LoopAgent. */
export interface LoopArrayConfig {
  /** SharedState key containing the JSON array to iterate. */
  key: string;
  /** Max concurrent iterations. Default: 1 (sequential). */
  concurrency?: number;
  /** SharedState key to write results array. Default: 'results'. */
  collectKey?: string;
  /** SharedState key for current item within each iteration. Default: 'item'. */
  itemKey?: string;
  /** SharedState key for current index within each iteration. Default: 'index'. */
  indexKey?: string;
}

/** Options for LoopAgent construction. */
export interface LoopAgentOptions {
  /** Agent to invoke on each iteration. */
  agentId: string;
  /** Key in shared state to read as input for each iteration. */
  inputKey?: string;
  /** Key in shared state to write each iteration's output. */
  outputKey?: string;
  inputContract?: OrchestrationStepContract;
  outputContract?: OrchestrationStepContract;
  /**
   * Continue looping while this returns true.
   * Default: loops while the last response content is non-empty, up to maxIterations.
   */
  condition?: LoopCondition;
  /** Maximum iterations to prevent infinite loops. Default: 10. */
  maxIterations?: number;
  validationMode?: ValidationMode;
  /** Array iteration mode. When set, iterates over an array in SharedState. */
  items?: LoopArrayConfig;
}

/** Retry tracking info for observability. */
export interface RetryRecord {
  agentId: string;
  attempts: number;
  usedFailBranch: boolean;
}

// ─── Contract Validation ──────────────────────────────────────

function validateContract(
  contract: OrchestrationStepContract | undefined,
  value: unknown,
  mode: ValidationMode,
  agentId: string,
): { valid: boolean; error?: string; parsedValue?: unknown; status: 'none' | 'warned' | 'enforced' } {
  if (!contract || mode === 'none') return { valid: true, parsedValue: value, status: 'none' };

  let parsed = value;
  if (typeof value === 'string' && contract.sanitize === 'json_text') {
    try {
      const match = value.match(/```(?:json)?\n([\s\S]*?)\n```/) || value.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[1] ?? match[0]);
      } else {
        parsed = JSON.parse(value);
      }
    } catch (e) {
      const err = `Failed to parse json_text for contract '${contract.key}': ${e instanceof Error ? e.message : String(e)}`;
      if (mode === 'enforce') return { valid: false, error: err, status: 'none' };
      log.warn({ agentId, key: contract.key, err }, 'Contract JSON parse warning');
    }
  }

  const AjvClass = (Ajv as any).default || Ajv;
  const ajv = new AjvClass({ strict: false, allErrors: true });
  try {
    const validate = ajv.compile(contract.schema);
    const valid = validate(parsed);
    if (!valid) {
      const err = `Contract validation failed for '${contract.key}': ${ajv.errorsText(validate.errors)}`;
      if (mode === 'enforce') return { valid: false, error: err, status: 'none' };
      log.warn({ agentId, key: contract.key, errors: validate.errors }, 'Contract validation warning');
      return { valid: true, parsedValue: parsed, status: 'warned' };
    }
  } catch (e) {
    const err = `Schema compile failed for '${contract.key}': ${e instanceof Error ? e.message : String(e)}`;
    if (mode === 'enforce') return { valid: false, error: err, status: 'none' };
    log.warn({ agentId, key: contract.key, err }, 'Contract schema warning');
    return { valid: true, parsedValue: parsed, status: 'warned' };
  }

  if (contract.maxBytes) {
    const size = typeof parsed === 'string' ? parsed.length : JSON.stringify(parsed)?.length || 0;
    if (size > contract.maxBytes) {
      const err = `Contract size exceeded for '${contract.key}': ${size} > ${contract.maxBytes}`;
      if (mode === 'enforce') return { valid: false, error: err, status: 'none' };
      log.warn({ agentId, key: contract.key, size, maxBytes: contract.maxBytes }, 'Contract size warning');
      return { valid: true, parsedValue: parsed, status: 'warned' };
    }
  }

  return { valid: true, parsedValue: parsed, status: mode === 'enforce' ? 'enforced' : 'none' };
}

// ─── Shared Utilities ─────────────────────────────────────────

/** Resolve input content for a step from SharedState and validate input contract. */
export function prepareStepInput(
  step: { inputKey?: string; inputContract?: OrchestrationStepContract; agentId: string },
  state: SharedState,
  message: UserMessage,
  validationMode: ValidationMode,
): UserMessage {
  let inputContent = message.content;
  const nextMetadata: Record<string, unknown> = { ...(message.metadata ?? {}) };
  if (step.inputKey && state.has(step.inputKey)) {
    const stateValue = state.get<string>(step.inputKey);
    if (typeof stateValue === 'string') {
      inputContent = stateValue;
    }
    const stateMeta = state.getMetadata(step.inputKey);
    if (stateMeta?.taintReasons?.length) {
      nextMetadata.taintReasons = [...stateMeta.taintReasons];
    }
    nextMetadata.handoffSourceKey = step.inputKey;
  }

  if (step.inputContract) {
    const check = validateContract(step.inputContract, inputContent, validationMode, step.agentId);
    if (!check.valid) throw new Error(check.error);
    if (typeof check.parsedValue === 'string') inputContent = check.parsedValue;
    else inputContent = JSON.stringify(check.parsedValue);
  }

  const summary = typeof inputContent === 'string'
    ? inputContent.trim().slice(0, 240)
    : JSON.stringify(inputContent).slice(0, 240);
  nextMetadata.summary = summary;
  return { ...message, content: inputContent, metadata: nextMetadata };
}

function createStepHandoffContract(
  sourceAgentId: string,
  step: OrchestrationStep,
): AgentHandoffContract | undefined {
  if (!step.handoff) return undefined;
  return {
    id: step.handoff.id?.trim() || `${sourceAgentId}->${step.agentId}`,
    sourceAgentId,
    targetAgentId: step.agentId,
    allowedCapabilities: [...step.handoff.allowedCapabilities],
    contextMode: step.handoff.contextMode,
    preserveTaint: step.handoff.preserveTaint,
    requireApproval: step.handoff.requireApproval,
  };
}

/** Validate output contract and write step result to SharedState. */
export function recordStepOutput(
  step: { outputKey?: string; outputContract?: OrchestrationStepContract; agentId: string },
  state: SharedState,
  response: AgentResponse,
  validationMode: ValidationMode,
): { content: string; response: AgentResponse } {
  const outputKey = step.outputKey ?? step.agentId;
  let outputContent = response.content;
  let validationStatus: 'none' | 'warned' | 'enforced' | 'failed' = 'none';

  if (step.outputContract) {
    const check = validateContract(step.outputContract, response.content, validationMode, step.agentId);
    if (!check.valid) throw new Error(check.error);
    validationStatus = check.status;
    if (typeof check.parsedValue === 'string') outputContent = check.parsedValue;
    else outputContent = JSON.stringify(check.parsedValue);
  }

  state.set(outputKey, outputContent, {
    producerAgent: step.agentId,
    schemaId: step.outputContract?.key,
    validationStatus,
  });

  return { content: outputContent, response: { ...response, content: outputContent } };
}

/** Execute a dispatch call with optional retry and exponential backoff. */
export async function executeWithRetry(
  dispatch: (agentId: string, message: UserMessage, options?: AgentDispatchOptions) => Promise<AgentResponse>,
  agentId: string,
  message: UserMessage,
  policy: StepRetryPolicy | undefined,
  options?: AgentDispatchOptions,
): Promise<{ response: AgentResponse; attempts: number }> {
  const maxRetries = policy?.maxRetries ?? 0;
  const initialDelay = policy?.initialDelayMs ?? 1000;
  const multiplier = policy?.backoffMultiplier ?? 2;
  const maxDelay = policy?.maxDelayMs ?? 30_000;
  const isRetryable = policy?.retryableError ?? (() => true);

  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await dispatch(agentId, message, options);
      return { response, attempts: attempt + 1 };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries && isRetryable(lastError)) {
        const delay = Math.min(initialDelay * Math.pow(multiplier, attempt), maxDelay);
        log.warn({ agentId, attempt: attempt + 1, maxRetries, delay, error: lastError.message }, 'Step failed, retrying');
        await new Promise(r => setTimeout(r, delay));
      } else {
        break;
      }
    }
  }
  throw lastError!;
}

/** Execute tasks with a concurrency limit using a simple worker pool. */
export async function runWithConcurrencyLimit<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  limit: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index]);
    }
  };

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/** Result from running steps sequentially. */
export interface SequentialRunResult {
  stepResults: Array<{ agentId: string; response: AgentResponse }>;
  retriedSteps: RetryRecord[];
  lastContent: string | undefined;
  stoppedAt?: string;
  error?: string;
}

/** Run an array of steps sequentially with retry/fail-branch support. */
export async function runStepsSequentially(
  steps: OrchestrationStep[],
  message: UserMessage,
  state: SharedState,
  dispatch: (agentId: string, message: UserMessage, options?: AgentDispatchOptions) => Promise<AgentResponse>,
  validationMode: ValidationMode,
  stopOnError: boolean,
  sourceAgentId = 'orchestrator',
): Promise<SequentialRunResult> {
  const stepResults: Array<{ agentId: string; response: AgentResponse }> = [];
  const retriedSteps: RetryRecord[] = [];

  for (const step of steps) {
    const stepMessage = prepareStepInput(step, state, message, validationMode);
    const handoff = createStepHandoffContract(sourceAgentId, step);

    try {
      const { response, attempts } = await executeWithRetry(
        dispatch,
        step.agentId,
        stepMessage,
        step.retry,
        handoff ? { handoff } : undefined,
      );
      const recorded = recordStepOutput(step, state, response, validationMode);
      stepResults.push({ agentId: step.agentId, response: recorded.response });
      if (attempts > 1) {
        retriedSteps.push({ agentId: step.agentId, attempts, usedFailBranch: false });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const retryAttempts = (step.retry?.maxRetries ?? 0) + 1;

      if (step.onError) {
        // Store error context for fail-branch agent
        const errorKey = `${step.outputKey ?? step.agentId}:error`;
        state.set(errorKey, errorMsg);
        try {
          const fbMessage = prepareStepInput(step.onError, state, message, validationMode);
          const fbResponse = await dispatch(step.onError.agentId, fbMessage);
          const fbOutputKey = step.onError.outputKey ?? step.outputKey;
          const fbStep = { ...step.onError, outputKey: fbOutputKey };
          const recorded = recordStepOutput(fbStep, state, fbResponse, validationMode);
          stepResults.push({ agentId: step.onError.agentId, response: recorded.response });
          retriedSteps.push({ agentId: step.agentId, attempts: retryAttempts, usedFailBranch: true });
          continue; // fail-branch succeeded, pipeline continues
        } catch {
          // fail-branch also failed, fall through to stopOnError
        }
      }

      const outputKey = step.outputKey ?? step.agentId;
      state.set(outputKey, `[Error: ${errorMsg}]`, { validationStatus: 'failed' });

      if (retryAttempts > 1) {
        retriedSteps.push({ agentId: step.agentId, attempts: retryAttempts, usedFailBranch: false });
      }

      if (stopOnError) {
        return {
          stepResults,
          retriedSteps,
          lastContent: undefined,
          stoppedAt: step.agentId,
          error: errorMsg,
        };
      }
    }
  }

  const lastResult = stepResults[stepResults.length - 1];
  return {
    stepResults,
    retriedSteps,
    lastContent: lastResult?.response.content,
  };
}

// ─── Sequential Agent ─────────────────────────────────────────

/**
 * Runs sub-agents in sequence, passing state between steps.
 *
 * Each step can read its input from shared state (via inputKey) and
 * writes its output to shared state (via outputKey or agent ID).
 * The final step's response is returned as the overall response.
 *
 * All sub-agent calls go through `ctx.dispatch()` which enforces
 * the full Guardian admission pipeline.
 */
export class SequentialAgent extends BaseAgent {
  private steps: OrchestrationStep[];
  private stopOnError: boolean;
  private validationMode: ValidationMode;

  constructor(id: string, name: string, options: SequentialAgentOptions) {
    super(id, name, { handleMessages: true, handleEvents: false, handleSchedule: false });
    this.steps = options.steps;
    this.stopOnError = options.stopOnError ?? true;
    this.validationMode = options.validationMode ?? 'warn';
  }

  async onMessage(message: UserMessage, ctx: AgentContext): Promise<AgentResponse> {
    if (!ctx.dispatch) {
      return { content: '[SequentialAgent requires dispatch capability in context]' };
    }

    const state = new SharedState();
    state.set('input', message.content);

    const result = await runStepsSequentially(
      this.steps, message, state, ctx.dispatch, this.validationMode, this.stopOnError, this.id,
    );

    state.clearTemp();

    if (result.stoppedAt) {
      return {
        content: `[Pipeline stopped at step '${result.stoppedAt}': ${result.error}]`,
        metadata: {
          orchestration: 'sequential',
          stoppedAt: result.stoppedAt,
          completedSteps: result.stepResults.length,
          totalSteps: this.steps.length,
          retriedSteps: result.retriedSteps.length > 0 ? result.retriedSteps : undefined,
          state: state.snapshot(),
        },
      };
    }

    return {
      content: result.lastContent ?? '[No steps completed]',
      metadata: {
        orchestration: 'sequential',
        completedSteps: result.stepResults.length,
        totalSteps: this.steps.length,
        retriedSteps: result.retriedSteps.length > 0 ? result.retriedSteps : undefined,
        state: state.snapshot(),
      },
    };
  }
}

// ─── Parallel Agent ───────────────────────────────────────────

/**
 * Runs sub-agents concurrently, collecting all results.
 *
 * All steps execute in parallel (optionally limited by maxConcurrency).
 * Results are written to shared state under each step's outputKey.
 * The combined results are returned as the overall response.
 *
 * All sub-agent calls go through `ctx.dispatch()` which enforces
 * the full Guardian admission pipeline.
 */
export class ParallelAgent extends BaseAgent {
  private steps: OrchestrationStep[];
  private maxConcurrency: number;
  private validationMode: ValidationMode;

  constructor(id: string, name: string, options: ParallelAgentOptions) {
    super(id, name, { handleMessages: true, handleEvents: false, handleSchedule: false });
    this.steps = options.steps;
    this.maxConcurrency = options.maxConcurrency ?? 0;
    this.validationMode = options.validationMode ?? 'warn';
  }

  async onMessage(message: UserMessage, ctx: AgentContext): Promise<AgentResponse> {
    if (!ctx.dispatch) {
      return { content: '[ParallelAgent requires dispatch capability in context]' };
    }

    const state = new SharedState();
    state.set('input', message.content);
    const retriedSteps: RetryRecord[] = [];

    const executeStep = async (step: OrchestrationStep): Promise<{
      agentId: string;
      response?: AgentResponse;
      error?: string;
    }> => {
      let stepMessage: UserMessage;
      try {
        stepMessage = prepareStepInput(step, state, message, this.validationMode);
      } catch (err) {
        return { agentId: step.agentId, error: err instanceof Error ? err.message : String(err) };
      }

      try {
        const handoff = createStepHandoffContract(this.id, step);
        const { response, attempts } = await executeWithRetry(
          ctx.dispatch!,
          step.agentId,
          stepMessage,
          step.retry,
          handoff ? { handoff } : undefined,
        );
        const recorded = recordStepOutput(step, state, response, this.validationMode);
        if (attempts > 1) {
          retriedSteps.push({ agentId: step.agentId, attempts, usedFailBranch: false });
        }
        return { agentId: step.agentId, response: recorded.response };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const retryAttempts = (step.retry?.maxRetries ?? 0) + 1;

        // Try fail-branch
        if (step.onError) {
          const errorKey = `${step.outputKey ?? step.agentId}:error`;
          state.set(errorKey, errorMsg);
          try {
            const fbMessage = prepareStepInput(step.onError, state, message, this.validationMode);
            const fbResponse = await ctx.dispatch!(step.onError.agentId, fbMessage);
            const fbOutputKey = step.onError.outputKey ?? step.outputKey;
            const fbStep = { ...step.onError, outputKey: fbOutputKey };
            const recorded = recordStepOutput(fbStep, state, fbResponse, this.validationMode);
            retriedSteps.push({ agentId: step.agentId, attempts: retryAttempts, usedFailBranch: true });
            return { agentId: step.agentId, response: recorded.response };
          } catch {
            // fail-branch also failed
          }
        }

        const outputKey = step.outputKey ?? step.agentId;
        state.set(outputKey, `[Error: ${errorMsg}]`, { validationStatus: 'failed' });
        if (retryAttempts > 1) {
          retriedSteps.push({ agentId: step.agentId, attempts: retryAttempts, usedFailBranch: false });
        }
        return { agentId: step.agentId, error: errorMsg };
      }
    };

    let results: Awaited<ReturnType<typeof executeStep>>[];

    if (this.maxConcurrency > 0) {
      results = await runWithConcurrencyLimit(this.steps, executeStep, this.maxConcurrency);
    } else {
      results = await Promise.all(this.steps.map(executeStep));
    }

    state.clearTemp();

    // Combine results
    const succeeded = results.filter(r => r.response);
    const failed = results.filter(r => r.error);

    const combinedContent = results
      .map(r => {
        if (r.response) return `[${r.agentId}]: ${r.response.content}`;
        return `[${r.agentId}]: Error — ${r.error}`;
      })
      .join('\n\n');

    return {
      content: combinedContent,
      metadata: {
        orchestration: 'parallel',
        totalSteps: this.steps.length,
        succeeded: succeeded.length,
        failed: failed.length,
        retriedSteps: retriedSteps.length > 0 ? retriedSteps : undefined,
        state: state.snapshot(),
      },
    };
  }
}

// ─── Loop Agent ───────────────────────────────────────────────

/**
 * Runs a single sub-agent repeatedly until a condition is met,
 * or iterates over an array of items.
 *
 * Each iteration can feed the previous iteration's output as input.
 * Includes a mandatory maxIterations cap to prevent infinite loops.
 *
 * All sub-agent calls go through `ctx.dispatch()` which enforces
 * the full Guardian admission pipeline.
 */
export class LoopAgent extends BaseAgent {
  private targetAgentId: string;
  private inputKey?: string;
  private outputKey?: string;
  private inputContract?: OrchestrationStepContract;
  private outputContract?: OrchestrationStepContract;
  private condition: LoopCondition;
  private maxIterations: number;
  private validationMode: ValidationMode;
  private itemsConfig?: LoopArrayConfig;

  constructor(id: string, name: string, options: LoopAgentOptions) {
    super(id, name, { handleMessages: true, handleEvents: false, handleSchedule: false });
    this.targetAgentId = options.agentId;
    this.inputKey = options.inputKey;
    this.outputKey = options.outputKey;
    this.inputContract = options.inputContract;
    this.outputContract = options.outputContract;
    this.maxIterations = options.maxIterations ?? 10;
    this.validationMode = options.validationMode ?? 'warn';
    this.itemsConfig = options.items;
    this.condition = options.condition ?? ((iteration, lastResponse) => {
      if (iteration >= this.maxIterations) return false;
      if (!lastResponse) return true;
      return lastResponse.content.length > 0 && !lastResponse.content.startsWith('[Error');
    });

    if (this.itemsConfig && options.condition) {
      log.warn({ agentId: id }, 'LoopAgent: both items and condition set; items mode takes precedence');
    }
  }

  async onMessage(message: UserMessage, ctx: AgentContext): Promise<AgentResponse> {
    if (!ctx.dispatch) {
      return { content: '[LoopAgent requires dispatch capability in context]' };
    }

    const state = new SharedState();
    state.set('input', message.content);

    if (this.itemsConfig) {
      return this.iterateArray(message, ctx, state);
    }

    return this.iterateCondition(message, ctx, state);
  }

  /** Condition-based loop (original behavior). */
  private async iterateCondition(
    message: UserMessage,
    ctx: AgentContext,
    state: SharedState,
  ): Promise<AgentResponse> {
    let lastResponse: AgentResponse | undefined;
    let iteration = 0;

    while (iteration < this.maxIterations && this.condition(iteration, lastResponse, state)) {
      // Determine input content
      let inputContent = message.content;
      if (this.inputKey && state.has(this.inputKey)) {
        const stateValue = state.get<string>(this.inputKey);
        if (typeof stateValue === 'string') {
          inputContent = stateValue;
        }
      } else if (lastResponse) {
        inputContent = lastResponse.content;
      }

      if (this.inputContract) {
        const check = validateContract(this.inputContract, inputContent, this.validationMode, this.targetAgentId);
        if (!check.valid) {
          return { content: `[Loop stopped at iteration ${iteration}: ${check.error}]`, metadata: { orchestration: 'loop', iterations: iteration, stoppedByError: true } };
        }
        if (typeof check.parsedValue === 'string') inputContent = check.parsedValue;
        else inputContent = JSON.stringify(check.parsedValue);
      }

      const stepMessage: UserMessage = { ...message, content: inputContent };
      const handoff = {
        id: `${this.id}->${this.targetAgentId}`,
        sourceAgentId: this.id,
        targetAgentId: this.targetAgentId,
        allowedCapabilities: ['agent.dispatch'],
        contextMode: 'full' as const,
        preserveTaint: true,
        requireApproval: false,
      };

      try {
        lastResponse = await ctx.dispatch!(this.targetAgentId, stepMessage, { handoff });
        const outputKey = this.outputKey ?? this.targetAgentId;

        let outputContent = lastResponse.content;
        let validationStatus: 'none' | 'warned' | 'enforced' | 'failed' = 'none';

        if (this.outputContract) {
          const check = validateContract(this.outputContract, lastResponse.content, this.validationMode, this.targetAgentId);
          if (!check.valid) throw new Error(check.error);
          validationStatus = check.status;
          if (typeof check.parsedValue === 'string') outputContent = check.parsedValue;
          else outputContent = JSON.stringify(check.parsedValue);
          lastResponse = { ...lastResponse, content: outputContent };
        }

        state.set(outputKey, outputContent, {
          producerAgent: this.targetAgentId,
          schemaId: this.outputContract?.key,
          validationStatus,
        });
        state.set('temp:iteration', iteration);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        state.clearTemp();
        return {
          content: `[Loop stopped at iteration ${iteration}: ${errorMsg}]`,
          metadata: {
            orchestration: 'loop',
            iterations: iteration,
            maxIterations: this.maxIterations,
            stoppedByError: true,
          },
        };
      }

      iteration++;
    }

    state.clearTemp();

    return {
      content: lastResponse?.content ?? '[No iterations completed]',
      metadata: {
        orchestration: 'loop',
        iterations: iteration,
        maxIterations: this.maxIterations,
        state: state.snapshot(),
      },
    };
  }

  /** Array iteration mode: map over items with configurable concurrency. */
  private async iterateArray(
    message: UserMessage,
    ctx: AgentContext,
    state: SharedState,
  ): Promise<AgentResponse> {
    const {
      key,
      concurrency = 1,
      collectKey = 'results',
      itemKey = 'item',
      indexKey = 'index',
    } = this.itemsConfig!;

    const rawValue = state.get<string>(key);
    let items: unknown[];
    try {
      items = JSON.parse(rawValue ?? '[]');
    } catch {
      return {
        content: `[LoopAgent array error: SharedState key '${key}' is not valid JSON]`,
        metadata: { orchestration: 'loop', mode: 'array_iteration', stoppedByError: true },
      };
    }
    if (!Array.isArray(items)) {
      return {
        content: `[LoopAgent array error: SharedState key '${key}' is not an array]`,
        metadata: { orchestration: 'loop', mode: 'array_iteration', stoppedByError: true },
      };
    }

    // Cap at maxIterations
    const effectiveItems = items.slice(0, this.maxIterations);
    const results: Array<{ content: string; error?: string }> = [];

    const processItem = async (item: unknown, idx: number): Promise<{ content: string; error?: string }> => {
      state.set(`temp:${itemKey}`, JSON.stringify(item));
      state.set(`temp:${indexKey}`, String(idx));

      const inputContent = JSON.stringify(item);
      const stepMessage: UserMessage = { ...message, content: inputContent };
      const handoff = {
        id: `${this.id}->${this.targetAgentId}`,
        sourceAgentId: this.id,
        targetAgentId: this.targetAgentId,
        allowedCapabilities: ['agent.dispatch'],
        contextMode: 'full' as const,
        preserveTaint: true,
        requireApproval: false,
      };

      try {
        const response = await ctx.dispatch!(this.targetAgentId, stepMessage, { handoff });
        return { content: response.content };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return { content: `[Error: ${errorMsg}]`, error: errorMsg };
      }
    };

    if (concurrency <= 1) {
      for (let i = 0; i < effectiveItems.length; i++) {
        results.push(await processItem(effectiveItems[i], i));
      }
    } else {
      const limit = Math.min(concurrency, 10);
      const settled = await runWithConcurrencyLimit(
        effectiveItems.map((item, i) => ({ item, idx: i })),
        async ({ item, idx }) => processItem(item, idx),
        limit,
      );
      results.push(...settled);
    }

    const resultContents = results.map(r => r.content);
    state.set(collectKey, JSON.stringify(resultContents));
    state.clearTemp();

    const errorCount = results.filter(r => r.error).length;

    return {
      content: `Processed ${effectiveItems.length} items (${errorCount} errors)`,
      metadata: {
        orchestration: 'loop',
        mode: 'array_iteration',
        itemCount: effectiveItems.length,
        totalItems: items.length,
        errors: errorCount,
        state: state.snapshot(),
      },
    };
  }
}
