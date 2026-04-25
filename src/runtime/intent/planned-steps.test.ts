import { describe, expect, it } from 'vitest';
import {
  countConcreteRequiredEvidenceSteps,
  hasGenericRequiredToolBackedAnswerPlan,
  hasRequiredToolBackedAnswerPlan,
  shouldAdoptMoreConcreteToolBackedAnswerPlan,
} from './planned-steps.js';
import type { IntentGatewayDecision } from './types.js';

function decision(plannedSteps: IntentGatewayDecision['plannedSteps']): IntentGatewayDecision {
  return {
    route: 'personal_assistant_task',
    confidence: 'medium',
    operation: 'read',
    summary: 'Read Second Brain evidence and answer.',
    turnRelation: 'new_request',
    resolution: 'ready',
    missingFields: [],
    executionClass: 'direct_assistant',
    preferredTier: 'local',
    requiresRepoGrounding: false,
    requiresToolSynthesis: false,
    expectedContextPressure: 'medium',
    preferredAnswerPath: 'direct',
    simpleVsComplex: 'complex',
    ...(plannedSteps ? { plannedSteps } : {}),
    entities: {},
  };
}

describe('planned step helpers', () => {
  it('detects required evidence plus answer plans', () => {
    expect(hasRequiredToolBackedAnswerPlan(decision([
      {
        kind: 'read',
        summary: 'Read matching routines.',
        expectedToolCategories: ['second_brain_routine_list'],
        required: true,
      },
      {
        kind: 'answer',
        summary: 'Suggest one useful routine.',
        required: true,
        dependsOn: ['step_1'],
      },
    ]))).toBe(true);
  });

  it('does not treat answer-only plans as tool-backed', () => {
    expect(hasRequiredToolBackedAnswerPlan(decision([
      {
        kind: 'answer',
        summary: 'Answer directly.',
        required: true,
      },
    ]))).toBe(false);
  });

  it('detects generic evidence categories in tool-backed answer plans', () => {
    expect(hasGenericRequiredToolBackedAnswerPlan(decision([
      {
        kind: 'search',
        summary: 'Find matching catalog evidence.',
        expectedToolCategories: ['search', 'read'],
        required: true,
      },
      {
        kind: 'answer',
        summary: 'Answer from the evidence.',
        required: true,
      },
    ]))).toBe(true);
  });

  it('scores concrete evidence categories and adopts more grounded repairs', () => {
    const generic = decision([
      {
        kind: 'search',
        summary: 'Find matching catalog evidence.',
        expectedToolCategories: ['search'],
        required: true,
      },
      {
        kind: 'answer',
        summary: 'Answer from the evidence.',
        required: true,
      },
    ]);
    const concrete = decision([
      {
        kind: 'read',
        summary: 'Read existing automations.',
        expectedToolCategories: ['automation_list'],
        required: true,
      },
      {
        kind: 'read',
        summary: 'Read existing routines.',
        expectedToolCategories: ['second_brain_routine_list', 'second_brain_routine_catalog'],
        required: true,
      },
      {
        kind: 'answer',
        summary: 'Answer from both evidence sets.',
        required: true,
      },
    ]);

    expect(countConcreteRequiredEvidenceSteps(generic)).toBe(0);
    expect(countConcreteRequiredEvidenceSteps(concrete)).toBe(2);
    expect(shouldAdoptMoreConcreteToolBackedAnswerPlan({
      current: generic,
      candidate: concrete,
    })).toBe(true);
  });
});
