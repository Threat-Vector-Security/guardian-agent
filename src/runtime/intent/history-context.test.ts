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

  it('enriches the history query with active execution refs only', () => {
    expect(buildIntentGatewayHistoryQuery({
      content: 'Okay now do the same thing with Claude Code',
      continuity: {
        focusSummary: 'Repo summary handoff',
        lastActionableRequest: 'Use Codex in this coding workspace to inspect README.md and package.json.',
        activeExecutionRefs: ['code_session:Guardian Agent'],
      },
    })).toEqual({
      text: 'Okay now do the same thing with Claude Code',
      identifiers: ['code_session:Guardian Agent'],
    });
  });

  it('returns the raw text when continuity does not include execution refs', () => {
    expect(buildIntentGatewayHistoryQuery({
      content: 'Okay now do the same thing with Claude Code',
      continuity: {
        focusSummary: 'Repo summary handoff',
        lastActionableRequest: 'Use Codex in this coding workspace to inspect README.md and package.json.',
      },
    })).toBe('Okay now do the same thing with Claude Code');
  });
});
