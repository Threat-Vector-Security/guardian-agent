/**
 * ConditionalAgent — first-class conditional branching for orchestration.
 *
 * Evaluates ordered branch conditions against SharedState and dispatches
 * to the first matching branch's steps. Steps within a branch run
 * sequentially, reusing the shared runStepsSequentially() utility.
 *
 * All sub-agent calls go through `ctx.dispatch()` which enforces
 * the full Guardian admission pipeline.
 */

import { BaseAgent } from './agent.js';
import type {
  AgentContext,
  AgentResponse,
  UserMessage,
} from './types.js';
import type { SharedStateView } from '../runtime/shared-state.js';
import { SharedState } from '../runtime/shared-state.js';
import type {
  OrchestrationStep,
  ValidationMode,
} from './orchestration.js';
import { runStepsSequentially } from './orchestration.js';

/** A single conditional branch with a predicate and steps. */
export interface ConditionalBranch {
  /** Human-readable name (for logging/metadata). */
  name: string;
  /** Condition predicate. First match wins. */
  condition: (state: SharedStateView, message: UserMessage) => boolean;
  /** Steps to execute when this branch is selected (run sequentially). */
  steps: OrchestrationStep[];
}

/** Options for ConditionalAgent construction. */
export interface ConditionalAgentOptions {
  /** Ordered list of branches. First matching branch wins. */
  branches: ConditionalBranch[];
  /** Default steps if no branch matches. If omitted, returns error response. */
  defaultSteps?: OrchestrationStep[];
  /** Validation mode for step contracts. */
  validationMode?: ValidationMode;
  /** Whether to stop on error within branch steps. Default: true. */
  stopOnError?: boolean;
  /** Keys to copy from parent orchestration's SharedState. */
  inheritStateKeys?: string[];
}

/**
 * Evaluates ordered conditions and dispatches to the first matching branch.
 *
 * Usage:
 * ```typescript
 * new ConditionalAgent('router', 'Intent Router', {
 *   branches: [
 *     { name: 'billing', condition: (s) => s.get('intent') === 'billing', steps: billingSteps },
 *     { name: 'technical', condition: (s) => s.get('intent') === 'technical', steps: techSteps },
 *     { name: 'general', condition: () => true, steps: generalSteps },
 *   ],
 * });
 * ```
 */
export class ConditionalAgent extends BaseAgent {
  private branches: ConditionalBranch[];
  private defaultSteps?: OrchestrationStep[];
  private validationMode: ValidationMode;
  private stopOnError: boolean;
  private inheritStateKeys: string[];

  constructor(id: string, name: string, options: ConditionalAgentOptions) {
    super(id, name, { handleMessages: true, handleEvents: false, handleSchedule: false });
    this.branches = options.branches;
    this.defaultSteps = options.defaultSteps;
    this.validationMode = options.validationMode ?? 'warn';
    this.stopOnError = options.stopOnError ?? true;
    this.inheritStateKeys = options.inheritStateKeys ?? [];
  }

  async onMessage(message: UserMessage, ctx: AgentContext): Promise<AgentResponse> {
    if (!ctx.dispatch) {
      return { content: '[ConditionalAgent requires dispatch capability in context]' };
    }

    const state = new SharedState();
    state.set('input', message.content);

    // Inherit state from parent orchestration
    if (ctx.sharedState) {
      for (const key of this.inheritStateKeys) {
        if (ctx.sharedState.has(key)) {
          state.set(key, ctx.sharedState.get(key));
        }
      }
    }

    // Evaluate branches — first match wins
    let selectedSteps: OrchestrationStep[] | undefined;
    let selectedBranch = 'default';

    for (const branch of this.branches) {
      if (branch.condition(state.asReadOnly(), message)) {
        selectedSteps = branch.steps;
        selectedBranch = branch.name;
        break;
      }
    }

    selectedSteps ??= this.defaultSteps;
    if (!selectedSteps) {
      return {
        content: '[ConditionalAgent: no branch matched]',
        metadata: { orchestration: 'conditional', branchSelected: null },
      };
    }

    const result = await runStepsSequentially(
      selectedSteps, message, state, ctx.dispatch, this.validationMode, this.stopOnError, this.id,
    );

    state.clearTemp();

    if (result.stoppedAt) {
      return {
        content: `[ConditionalAgent branch '${selectedBranch}' stopped at '${result.stoppedAt}': ${result.error}]`,
        metadata: {
          orchestration: 'conditional',
          branchSelected: selectedBranch,
          stoppedAt: result.stoppedAt,
          completedSteps: result.stepResults.length,
          totalSteps: selectedSteps.length,
          retriedSteps: result.retriedSteps.length > 0 ? result.retriedSteps : undefined,
          state: state.snapshot(),
        },
      };
    }

    return {
      content: result.lastContent ?? '[No steps completed]',
      metadata: {
        orchestration: 'conditional',
        branchSelected: selectedBranch,
        completedSteps: result.stepResults.length,
        totalSteps: selectedSteps.length,
        retriedSteps: result.retriedSteps.length > 0 ? result.retriedSteps : undefined,
        state: state.snapshot(),
      },
    };
  }
}
