import { describe, expect, it } from 'vitest';
import { normalizeIntentGatewayDecision } from './structured-recovery.js';

describe('normalizeIntentGatewayDecision', () => {
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
});
