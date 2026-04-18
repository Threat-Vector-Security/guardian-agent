import { describe, expect, it } from 'vitest';

import {
  isExplicitComplexPlanningRequest,
  looksLikePendingActionContextTurn,
} from './request-patterns.js';

describe('request-patterns', () => {
  it('recognizes malformed explicit complex-planning cue text that still names the planner path for this request', () => {
    expect(isExplicitComplexPlanningRequest(
      'se your complex-planning path for this request. In tmp/manual-dag-smoke-2, create notes.txt.',
    )).toBe(true);
  });

  it('does not treat explanatory mentions of the planner path as explicit execution requests', () => {
    expect(isExplicitComplexPlanningRequest(
      'Explain how the complex-planning path works.',
    )).toBe(false);
  });

  it('detects turns that should keep pending approval context attached', () => {
    expect(looksLikePendingActionContextTurn('Can you use Claude Code instead?')).toBe(true);
    expect(looksLikePendingActionContextTurn('What pending approvals do I have right now?')).toBe(true);
    expect(looksLikePendingActionContextTurn('What happened to that last request?')).toBe(true);
  });

  it('does not treat unrelated fresh text as pending approval follow-up context', () => {
    expect(looksLikePendingActionContextTurn('Hiroshima')).toBe(false);
  });
});
