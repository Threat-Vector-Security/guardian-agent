import { describe, expect, it } from 'vitest';

import type { SelectedExecutionProfile } from '../execution-profiles.js';
import type { IntentGatewayDecision } from '../intent-gateway.js';
import type { DelegatedTaskContract } from '../execution/types.js';
import {
  buildGraphControlledTaskRunId,
  buildGraphReadOnlyIntentGatewayRecord,
  shouldUseGraphControlledExecution,
} from './graph-controller.js';

function baseDecision(overrides: Partial<IntentGatewayDecision> = {}): IntentGatewayDecision {
  return {
    route: 'coding_task',
    confidence: 'high',
    operation: 'update',
    summary: 'Update the repo with grounded evidence.',
    turnRelation: 'new_request',
    resolution: 'ready',
    missingFields: [],
    executionClass: 'repo_grounded',
    preferredTier: 'external',
    requiresRepoGrounding: true,
    requiresToolSynthesis: true,
    expectedContextPressure: 'high',
    preferredAnswerPath: 'tool_loop',
    entities: {},
    ...overrides,
  };
}

function taskContract(steps: DelegatedTaskContract['plan']['steps']): DelegatedTaskContract {
  return {
    kind: 'filesystem_mutation',
    route: 'coding_task',
    operation: 'update',
    requiresEvidence: true,
    allowsAnswerFirst: false,
    requireExactFileReferences: true,
    summary: 'Ground then write.',
    plan: {
      planId: 'plan-graph',
      steps,
      allowAdditionalSteps: false,
    },
  };
}

const localProfile: SelectedExecutionProfile = {
  id: 'local_tool',
  providerName: 'local',
  providerType: 'ollama',
  providerLocality: 'local',
  providerTier: 'local',
  requestedTier: 'local',
  preferredAnswerPath: 'tool_loop',
  expectedContextPressure: 'medium',
  contextBudget: 64_000,
  toolContextMode: 'standard',
  maxAdditionalSections: 8,
  maxRuntimeNotices: 4,
  fallbackProviderOrder: [],
  reason: 'test profile',
};

describe('graph-controller boundary', () => {
  it('selects graph control only for concrete read/write mutation contracts', () => {
    const contract = taskContract([
      {
        stepId: 'read-1',
        kind: 'search',
        summary: 'Find the implementation file.',
        expectedToolCategories: ['filesystem.read'],
        required: true,
      },
      {
        stepId: 'write-1',
        kind: 'write',
        summary: 'Patch the implementation file.',
        expectedToolCategories: ['filesystem.write'],
        required: true,
      },
    ]);

    expect(shouldUseGraphControlledExecution({
      taskContract: contract,
      decision: baseDecision(),
      executionProfile: localProfile,
    })).toBe(true);

    expect(shouldUseGraphControlledExecution({
      taskContract: taskContract([contract.plan.steps[0]]),
      decision: baseDecision(),
      executionProfile: localProfile,
    })).toBe(false);

    expect(shouldUseGraphControlledExecution({
      taskContract: contract,
      decision: baseDecision({ provenance: { route: 'repair.unstructured' } }),
      executionProfile: localProfile,
    })).toBe(false);
  });

  it('derives a read-only gateway decision for the exploration node', () => {
    const contract = taskContract([
      {
        stepId: 'read-1',
        kind: 'read',
        summary: 'Read the target file.',
        required: true,
      },
      {
        stepId: 'write-1',
        kind: 'write',
        summary: 'Update the target file.',
        required: true,
      },
    ]);

    const record = buildGraphReadOnlyIntentGatewayRecord({
      baseRecord: null,
      baseDecision: baseDecision(),
      taskContract: contract,
      originalRequest: 'Update the target file after reading it.',
    });

    expect(record?.model).toBe('execution-graph.readonly');
    expect(record?.decision.operation).toBe('inspect');
    expect(record?.decision.preferredAnswerPath).toBe('tool_loop');
    expect(record?.decision.plannedSteps).toEqual([
      expect.objectContaining({ kind: 'read', summary: 'Read the target file.' }),
    ]);
    expect(record?.decision.resolvedContent).toContain('Do not create, edit, delete, rename, patch, or run shell commands.');
    expect(record?.decision.resolvedContent).toContain('The graph controller will decide and perform these write steps after grounded synthesis:');
    expect(record?.decision.provenance?.operation).toBe('derived.workload');
  });

  it('keeps graph-controlled task run ids deterministic for request ids', () => {
    expect(buildGraphControlledTaskRunId('request-1')).toBe('graph-run:request-1');
  });
});
