import { describe, expect, it } from 'vitest';

import {
  buildIntentGatewayHistoryQuery,
} from './history-context.js';

describe('intent history context helpers', () => {
  it('returns the raw content when no continuity context is available', () => {
    expect(buildIntentGatewayHistoryQuery({
      content: 'Use Codex to inspect README.md.',
      continuity: null,
    })).toBe('Use Codex to inspect README.md.');
  });

  it('enriches standalone history queries with active execution refs only', () => {
    expect(buildIntentGatewayHistoryQuery({
      content: 'Use Claude Code for the README inspection',
      continuity: {
        focusSummary: 'Repo summary handoff',
        lastActionableRequest: 'Use Codex in this coding workspace to inspect README.md and package.json.',
        activeExecutionRefs: ['code_session:Guardian Agent'],
      },
    })).toEqual({
      text: 'Use Claude Code for the README inspection',
      identifiers: ['code_session:Guardian Agent'],
    });
  });

  it('returns the raw text when continuity does not include execution refs', () => {
    expect(buildIntentGatewayHistoryQuery({
      content: 'Use Claude Code for the README inspection',
      continuity: {
        focusSummary: 'Repo summary handoff',
        lastActionableRequest: 'Use Codex in this coding workspace to inspect README.md and package.json.',
      },
    })).toBe('Use Claude Code for the README inspection');
  });

  it('uses recent history for transcript-reference follow-ups', () => {
    expect(buildIntentGatewayHistoryQuery({
      content: 'Summarize the last three things I asked about.',
      continuity: {
        activeExecutionRefs: ['execution:automation-list'],
      },
    })).toBeUndefined();
    expect(buildIntentGatewayHistoryQuery({
      content: 'Which of those look security-related?',
      continuity: null,
    })).toBeUndefined();
  });
});
