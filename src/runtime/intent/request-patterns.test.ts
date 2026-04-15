import { describe, expect, it } from 'vitest';

import { isExplicitComplexPlanningRequest } from './request-patterns.js';

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
});
