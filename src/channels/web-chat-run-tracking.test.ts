import { describe, expect, it } from 'vitest';

import { matchesRunTimelineRequest } from '../../web/public/js/chat-run-tracking.js';

describe('matchesRunTimelineRequest', () => {
  it('matches the active request inside a focused code session', () => {
    expect(matchesRunTimelineRequest(
      {
        summary: {
          runId: 'req-2',
          codeSessionId: 'session-1',
        },
      },
      {
        requestId: 'req-2',
        codeSessionId: 'session-1',
      },
    )).toBe(true);
  });

  it('rejects older run activity from the same code session when a new request is active', () => {
    expect(matchesRunTimelineRequest(
      {
        summary: {
          runId: 'req-1',
          codeSessionId: 'session-1',
        },
      },
      {
        requestId: 'req-2',
        codeSessionId: 'session-1',
      },
    )).toBe(false);
  });

  it('falls back to code-session matching only when no request id is available', () => {
    expect(matchesRunTimelineRequest(
      {
        summary: {
          runId: 'req-1',
          codeSessionId: 'session-1',
        },
      },
      {
        codeSessionId: 'session-1',
      },
    )).toBe(true);
  });
});
