import { describe, expect, it } from 'vitest';
import {
  normalizeIntentGatewayDecision,
  parseIntentGatewayDecision,
  splitSequentialRequestClauses,
} from './structured-recovery.js';

describe('normalizeIntentGatewayDecision', () => {
  it('does not infer a route from unstructured classifier prose', () => {
    const parsed = parseIntentGatewayDecision({
      content: 'I need to inspect the repo before answering. Which files should I check?',
      model: 'test-gateway',
      finishReason: 'stop',
    }, {
      sourceContent: 'Inspect this repo and tell me which files implement delegated worker progress. Do not edit anything.',
    });

    expect(parsed.available).toBe(false);
    expect(parsed.rawStructuredDecision).toBeUndefined();
    expect(parsed.decision.route).toBe('unknown');
    expect(parsed.decision.provenance?.route).toBe('classifier.primary');
  });

  it('does not silently promote a classified general assistant turn into coding_task', () => {
    const decision = normalizeIntentGatewayDecision({
      route: 'general_assistant',
      confidence: 'high',
      operation: 'inspect',
      summary: 'Explain the request.',
    }, {
      sourceContent: 'Inspect this repo and tell me which files implement delegated worker progress and run timeline rendering. Do not edit anything.',
    });

    expect(decision.route).toBe('general_assistant');
    expect(decision.operation).toBe('inspect');
    expect(decision.provenance?.route).toBe('classifier.primary');
  });

  it('allows unknown-only structured recovery when the classifier leaves route and operation unresolved', () => {
    const decision = normalizeIntentGatewayDecision({
      route: 'unknown',
      confidence: 'low',
      operation: 'unknown',
      summary: 'Unknown request.',
    }, {
      sourceContent: 'Inspect this repo and tell me which files implement delegated worker progress and run timeline rendering. Do not edit anything.',
    });

    expect(decision.route).toBe('coding_task');
    expect(decision.operation).toBe('inspect');
    expect(decision.provenance?.route).toBe('repair.structured');
    expect(decision.provenance?.operation).toBe('repair.structured');
  });

  it('re-derives workload metadata when route and operation are repaired', () => {
    const decision = normalizeIntentGatewayDecision({
      route: 'unknown',
      confidence: 'low',
      operation: 'unknown',
      summary: 'Routing provider unavailable.',
      executionClass: 'direct_assistant',
      preferredTier: 'local',
      requiresRepoGrounding: false,
      requiresToolSynthesis: false,
      expectedContextPressure: 'low',
      preferredAnswerPath: 'direct',
      simpleVsComplex: 'simple',
    }, {
      sourceContent: 'Inspect this repo and tell me which web pages consume run-timeline-context.js. Do not edit anything.',
    }, {
      classifierSource: 'classifier.route_only_fallback',
    });

    expect(decision.route).toBe('coding_task');
    expect(decision.operation).toBe('inspect');
    expect(decision.executionClass).toBe('repo_grounded');
    expect(decision.preferredTier).toBe('external');
    expect(decision.requiresRepoGrounding).toBe(true);
    expect(decision.requiresToolSynthesis).toBe(true);
    expect(decision.expectedContextPressure).toBe('high');
    expect(decision.preferredAnswerPath).toBe('chat_synthesis');
    expect(decision.simpleVsComplex).toBe('complex');
    expect(decision.provenance).toMatchObject({
      executionClass: 'derived.workload',
      preferredTier: 'derived.workload',
      requiresRepoGrounding: 'derived.workload',
      requiresToolSynthesis: 'derived.workload',
      expectedContextPressure: 'derived.workload',
      preferredAnswerPath: 'derived.workload',
      simpleVsComplex: 'derived.workload',
    });
  });

  it('moves exact-file requirements onto gateway-owned decision state', () => {
    const decision = normalizeIntentGatewayDecision({
      route: 'coding_task',
      confidence: 'high',
      operation: 'inspect',
      summary: 'Inspect the repository.',
      executionClass: 'repo_grounded',
      requiresRepoGrounding: true,
    }, {
      sourceContent: 'Inspect this repo and tell me which files implement delegated worker progress and run timeline rendering. Do not edit anything.',
    });

    expect(decision.requireExactFileReferences).toBe(true);
    expect(decision.provenance?.requireExactFileReferences).toBe('derived.workload');
  });

  it('does not create a separate step for "Do not edit anything" modifier clauses', () => {
    // "Do not edit anything" should be dropped from planned steps, not treated as a step.
    const clauses = splitSequentialRequestClauses(
      'Inspect this repo and tell me which files implement delegated worker progress and run timeline rendering. Do not edit anything.',
    );
    // The "Do not edit anything" clause should not appear as a step
    const hasReadonlyStep = clauses.some(clause =>
      /\bdo not edit\b/i.test(clause) || /\bdon'?t edit\b/i.test(clause),
    );
    expect(hasReadonlyStep).toBe(false);
  });

  it('merges answer-constraint clauses like "Cite exact file names" into the prior step', () => {
    // "Cite exact file names and symbol names" should merge into the prior clause
    // and NOT appear as a separate step. Since merging reduces to a single clause,
    // splitSequentialRequestClauses returns [] for single-clause results,
    // but the merged result should still contain the cite modifier.
    const sourceContent = 'Inspect this repo and tell me which files define the contract. Cite exact file names and symbol names.';
    const clauses = splitSequentialRequestClauses(sourceContent);
    // After merging, the cite clause is merged into the inspect clause.
    // If only one clause remains, splitSequentialRequestClauses returns [].
    // Verify that "Cite exact file names" does not appear as a standalone step.
    const hasCiteStep = clauses.some(clause =>
      /^\s*cite\s+/i.test(clause.trim()),
    );
    expect(hasCiteStep).toBe(false);
  });

  it('replaces collapsed model plans with synthesized read/write hybrid steps', () => {
    const decision = normalizeIntentGatewayDecision({
      route: 'coding_task',
      confidence: 'low',
      operation: 'run',
      summary: 'Tell me the current coding workspace path, then create a file containing that path.',
      planned_steps: [
        {
          kind: 'tool_call',
          summary: 'Tell me the current coding workspace path, then create tmp/manual-web/workspace-check.txt containing that path.',
          required: true,
        },
      ],
    }, {
      sourceContent: 'Tell me the current coding workspace path, then create tmp/manual-web/workspace-check.txt containing that path.',
    });

    expect(decision.plannedSteps?.map((step) => step.kind)).toEqual(['answer', 'write']);
    expect(decision.plannedSteps?.[1]?.dependsOn).toEqual(['step_1']);
  });

  it('synthesizes read/write hybrid steps when the classifier omits planned_steps', () => {
    const decision = normalizeIntentGatewayDecision({
      route: 'coding_task',
      confidence: 'high',
      operation: 'inspect',
      summary: 'Search src/runtime for planned_steps and write a concise summary to tmp/orchestration-openrouter/planned-steps-summary.txt.',
      turnRelation: 'new_request',
      resolution: 'ready',
      executionClass: 'repo_grounded',
      preferredTier: 'external',
      requiresRepoGrounding: true,
      requiresToolSynthesis: false,
      expectedContextPressure: 'medium',
      preferredAnswerPath: 'tool_loop',
      simpleVsComplex: 'complex',
    }, {
      sourceContent: 'Search src/runtime for planned_steps. Write a concise summary of what you find to tmp/orchestration-openrouter/planned-steps-summary.txt.',
    });

    expect(decision.plannedSteps).toEqual([
      expect.objectContaining({
        kind: 'search',
        expectedToolCategories: ['search', 'read'],
        required: true,
      }),
      expect.objectContaining({
        kind: 'write',
        expectedToolCategories: ['write'],
        required: true,
        dependsOn: ['step_1'],
      }),
    ]);
  });

  it('does not repair an explicit filesystem save with a path into a Second Brain note save', () => {
    const decision = normalizeIntentGatewayDecision({
      route: 'filesystem_task',
      confidence: 'high',
      operation: 'save',
      summary: 'Write a status note to tmp/manual-web/continuity-user-experience-summary.txt.',
      turnRelation: 'new_request',
      resolution: 'ready',
      path: 'tmp/manual-web/continuity-user-experience-summary.txt',
      executionClass: 'direct_assistant',
      preferredTier: 'local',
      requiresRepoGrounding: false,
      requiresToolSynthesis: false,
      expectedContextPressure: 'medium',
      preferredAnswerPath: 'tool_loop',
      simpleVsComplex: 'complex',
    }, {
      sourceContent: 'Based on our last few messages, write a short status note to tmp/manual-web/continuity-user-experience-summary.txt covering what worked, what was confusing, and what should be improved next.',
    });

    expect(decision.route).toBe('filesystem_task');
    expect(decision.entities.path).toBe('tmp/manual-web/continuity-user-experience-summary.txt');
    expect(decision.provenance?.route).toBe('classifier.primary');
  });

  it('repairs a path-bearing Second Brain misclassification into a filesystem save', () => {
    const decision = normalizeIntentGatewayDecision({
      route: 'personal_assistant_task',
      confidence: 'medium',
      operation: 'save',
      summary: 'Write a status note to tmp/manual-web/continuity-user-experience-summary.txt.',
      turnRelation: 'new_request',
      resolution: 'ready',
      path: 'tmp/manual-web/continuity-user-experience-summary.txt',
      personalItemType: 'note',
      executionClass: 'direct_assistant',
      preferredTier: 'local',
      requiresRepoGrounding: false,
      requiresToolSynthesis: false,
      expectedContextPressure: 'medium',
      preferredAnswerPath: 'tool_loop',
      simpleVsComplex: 'complex',
    }, {
      sourceContent: 'Based on our last few messages, write a short status note to tmp/manual-web/continuity-user-experience-summary.txt covering what worked, what was confusing, and what should be improved next.',
    });

    expect(decision.route).toBe('filesystem_task');
    expect(decision.entities.path).toBe('tmp/manual-web/continuity-user-experience-summary.txt');
    expect(decision.provenance?.route).toBe('repair.structured');
  });

  it('normalizes automation catalog list plans into automation evidence plus answer synthesis', () => {
    const decision = normalizeIntentGatewayDecision({
      route: 'automation_control',
      confidence: 'high',
      operation: 'list',
      summary: 'Find matching automations and suggest one useful automation to create.',
      turnRelation: 'new_request',
      resolution: 'ready',
      executionClass: 'tool_orchestration',
      preferredTier: 'external',
      requiresRepoGrounding: false,
      requiresToolSynthesis: false,
      expectedContextPressure: 'low',
      preferredAnswerPath: 'tool_loop',
      simpleVsComplex: 'complex',
      plannedSteps: [
        {
          kind: 'search',
          summary: 'Search existing automations.',
          expectedToolCategories: ['search'],
          required: true,
        },
        {
          kind: 'write',
          summary: 'Suggest one useful automation to create.',
          expectedToolCategories: ['write'],
          required: true,
          dependsOn: ['step_1'],
        },
      ],
    }, {
      sourceContent: 'Find any automations related to approval, routing, or code review, then suggest one useful automation I could create. Do not create it yet.',
    });

    expect(decision.operation).toBe('read');
    expect(decision.provenance?.operation).toBe('repair.structured');
    expect(decision.plannedSteps).toEqual([
      expect.objectContaining({
        kind: 'read',
        expectedToolCategories: ['automation_list'],
      }),
      expect.objectContaining({
        kind: 'answer',
        dependsOn: ['step_1'],
      }),
    ]);
    expect(decision.plannedSteps?.[1]?.expectedToolCategories).toBeUndefined();
    expect(decision.executionClass).toBe('tool_orchestration');
    expect(decision.requiresToolSynthesis).toBe(true);
    expect(decision.preferredAnswerPath).toBe('tool_loop');
  });

  it('preserves mixed automation and routine evidence plans on the orchestrated general route', () => {
    const decision = normalizeIntentGatewayDecision({
      route: 'general_assistant',
      confidence: 'high',
      operation: 'search',
      summary: 'Find matching automations and routines, then suggest one useful automation to create.',
      turnRelation: 'new_request',
      resolution: 'ready',
      executionClass: 'direct_assistant',
      preferredTier: 'local',
      requiresRepoGrounding: false,
      requiresToolSynthesis: false,
      expectedContextPressure: 'low',
      preferredAnswerPath: 'direct',
      simpleVsComplex: 'simple',
      plannedSteps: [
        {
          kind: 'read',
          summary: 'Search existing automations.',
          expectedToolCategories: ['automation_list'],
          required: true,
        },
        {
          kind: 'read',
          summary: 'Search existing Second Brain routines.',
          expectedToolCategories: ['second_brain_routine_list', 'second_brain_routine_catalog'],
          required: true,
        },
        {
          kind: 'answer',
          summary: 'Suggest one useful automation to create.',
          required: true,
          dependsOn: ['step_1', 'step_2'],
        },
      ],
    }, {
      sourceContent: 'Find any automations or routines related to approval, routing, or code review, then suggest one useful automation I could create. Do not create it yet.',
    });

    expect(decision.route).toBe('general_assistant');
    expect(decision.plannedSteps).toEqual([
      expect.objectContaining({
        kind: 'read',
        expectedToolCategories: ['automation_list'],
      }),
      expect.objectContaining({
        kind: 'read',
        expectedToolCategories: ['second_brain_routine_list', 'second_brain_routine_catalog'],
      }),
      expect.objectContaining({
        kind: 'answer',
        dependsOn: ['step_1', 'step_2'],
      }),
    ]);
    expect(decision.executionClass).toBe('tool_orchestration');
    expect(decision.preferredTier).toBe('external');
    expect(decision.requiresToolSynthesis).toBe(true);
    expect(decision.expectedContextPressure).toBe('medium');
    expect(decision.preferredAnswerPath).toBe('tool_loop');
    expect(decision.simpleVsComplex).toBe('complex');
    expect(decision.provenance).toMatchObject({
      executionClass: 'derived.workload',
      preferredTier: 'derived.workload',
      requiresToolSynthesis: 'derived.workload',
      expectedContextPressure: 'derived.workload',
      preferredAnswerPath: 'derived.workload',
      simpleVsComplex: 'derived.workload',
    });
  });

  it('routes automation evidence plus answer plans through tool-backed synthesis even when the classifier says direct', () => {
    const decision = normalizeIntentGatewayDecision({
      route: 'automation_control',
      confidence: 'low',
      operation: 'search',
      summary: 'Find matching automations and suggest one useful automation to create.',
      turnRelation: 'new_request',
      resolution: 'ready',
      executionClass: 'direct_assistant',
      preferredTier: 'local',
      requiresRepoGrounding: false,
      requiresToolSynthesis: false,
      expectedContextPressure: 'low',
      preferredAnswerPath: 'direct',
      simpleVsComplex: 'complex',
      plannedSteps: [
        {
          kind: 'read',
          summary: 'Find matching automations and routines.',
          expectedToolCategories: ['automation_list'],
          required: true,
        },
        {
          kind: 'answer',
          summary: 'Suggest one useful automation to create.',
          required: true,
          dependsOn: ['step_1'],
        },
      ],
    }, {
      sourceContent: 'Find any automations or routines related to approval, routing, or code review, then suggest one useful automation I could create. Do not create it yet.',
    });

    expect(decision.operation).toBe('search');
    expect(decision.executionClass).toBe('tool_orchestration');
    expect(decision.preferredTier).toBe('external');
    expect(decision.requiresToolSynthesis).toBe(true);
    expect(decision.expectedContextPressure).toBe('medium');
    expect(decision.preferredAnswerPath).toBe('tool_loop');
    expect(decision.provenance).toMatchObject({
      executionClass: 'derived.workload',
      preferredTier: 'derived.workload',
      requiresToolSynthesis: 'derived.workload',
      expectedContextPressure: 'derived.workload',
      preferredAnswerPath: 'derived.workload',
    });
  });

  it('treats generic write steps as answer synthesis for general read/search tool plans', () => {
    const decision = normalizeIntentGatewayDecision({
      route: 'general_assistant',
      confidence: 'low',
      operation: 'search',
      summary: 'Find matching automations and routines, then suggest one useful automation.',
      turnRelation: 'new_request',
      resolution: 'ready',
      executionClass: 'tool_orchestration',
      preferredTier: 'external',
      requiresRepoGrounding: false,
      requiresToolSynthesis: true,
      expectedContextPressure: 'low',
      preferredAnswerPath: 'tool_loop',
      simpleVsComplex: 'simple',
      plannedSteps: [
        {
          kind: 'search',
          summary: 'Find matching automations and routines.',
          required: true,
        },
        {
          kind: 'write',
          summary: 'Suggest one useful automation to create.',
          required: true,
          dependsOn: ['step_1'],
        },
      ],
    }, {
      sourceContent: 'Find any automations or routines related to approval, routing, or code review, then suggest one useful automation I could create. Do not create it yet.',
    });

    expect(decision.route).toBe('general_assistant');
    expect(decision.plannedSteps?.map((step) => step.kind)).toEqual(['search', 'answer']);
    expect(decision.plannedSteps?.[1]?.expectedToolCategories).toBeUndefined();
    expect(decision.requiresToolSynthesis).toBe(true);
    expect(decision.preferredAnswerPath).toBe('tool_loop');
  });

  it('normalizes read-only Second Brain routine plans into routine evidence plus answer synthesis', () => {
    const decision = normalizeIntentGatewayDecision({
      route: 'personal_assistant_task',
      confidence: 'low',
      operation: 'read',
      personalItemType: 'routine',
      query: 'approval or routing or code review',
      summary: 'Find matching routines and suggest one useful automation.',
      turnRelation: 'new_request',
      resolution: 'ready',
      executionClass: 'direct_assistant',
      preferredTier: 'local',
      requiresRepoGrounding: false,
      requiresToolSynthesis: false,
      expectedContextPressure: 'medium',
      preferredAnswerPath: 'direct',
      simpleVsComplex: 'complex',
      plannedSteps: [
        {
          kind: 'search',
          summary: 'Search matching routines.',
          required: true,
        },
        {
          kind: 'write',
          summary: 'Suggest one useful automation to create.',
          required: true,
          dependsOn: ['step_1'],
        },
      ],
    }, {
      sourceContent: 'Find any automations or routines related to approval, routing, or code review, then suggest one useful automation I could create. Do not create it yet.',
    });

    expect(decision.plannedSteps).toEqual([
      expect.objectContaining({
        kind: 'read',
        expectedToolCategories: ['second_brain_routine_list', 'second_brain_routine_catalog'],
      }),
      expect.objectContaining({
        kind: 'answer',
        dependsOn: ['step_1'],
      }),
    ]);
    expect(decision.plannedSteps?.[1]?.expectedToolCategories).toBeUndefined();
    expect(decision.executionClass).toBe('tool_orchestration');
    expect(decision.requiresToolSynthesis).toBe(true);
    expect(decision.preferredAnswerPath).toBe('tool_loop');
  });
});
