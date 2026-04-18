import { describe, expect, it } from 'vitest';

import {
  buildIntentGatewayHistoryQuery,
  resolveHistoricalCodingBackendRequest,
  shouldRepairHistoricalCodingBackendTurn,
} from './history-context.js';

describe('intent history context helpers', () => {
  it('returns the raw content when no continuity context is available', () => {
    expect(buildIntentGatewayHistoryQuery({
      content: 'Use Codex to inspect README.md.',
      continuity: null,
    })).toBe('Use Codex to inspect README.md.');
  });

  it('enriches the history query with continuity focus and execution refs', () => {
    expect(buildIntentGatewayHistoryQuery({
      content: 'Okay now do the same thing with Claude Code',
      continuity: {
        focusSummary: 'Repo summary handoff',
        lastActionableRequest: 'Use Codex in this coding workspace to inspect README.md and package.json.',
        activeExecutionRefs: ['code_session:Guardian Agent'],
      },
    })).toEqual({
      text: 'Okay now do the same thing with Claude Code',
      focusTexts: [
        'Use Codex in this coding workspace to inspect README.md and package.json.',
        'Repo summary handoff',
      ],
      identifiers: ['code_session:Guardian Agent'],
    });
  });

  it('reconstructs a short backend follow-up from the last actionable request', () => {
    expect(shouldRepairHistoricalCodingBackendTurn({
      content: 'Okay now do the same thing with Claude Code',
      lastActionableRequest: 'Use Codex in this coding workspace to inspect README.md and package.json, then reply with a short summary of what this repo does. Do not change any files.',
    })).toBe(true);

    expect(resolveHistoricalCodingBackendRequest({
      backendId: 'claude-code',
      content: 'Okay now do the same thing with Claude Code',
      lastActionableRequest: 'Use Codex in this coding workspace to inspect README.md and package.json, then reply with a short summary of what this repo does. Do not change any files.',
    })).toBe('Use claude-code for this request: Use Codex in this coding workspace to inspect README.md and package.json, then reply with a short summary of what this repo does. Do not change any files.');
  });
});
