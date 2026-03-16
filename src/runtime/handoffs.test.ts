import { describe, expect, it } from 'vitest';
import { applyHandoffContract } from './handoffs.js';
import { validateHandoffContract } from './handoff-policy.js';

describe('handoff contracts', () => {
  it('filters payloads according to the context mode', () => {
    const payload = applyHandoffContract(
      {
        id: 'handoff-1',
        sourceAgentId: 'triage',
        targetAgentId: 'research',
        allowedCapabilities: ['web.read'],
        contextMode: 'summary_only',
        preserveTaint: true,
        requireApproval: false,
      },
      {
        content: 'full content',
        summary: 'summary only',
        taintReasons: ['remote_html'],
      },
    );

    expect(payload.content).toBe('summary only');
    expect(payload.taintReasons).toEqual(['remote_html']);
  });

  it('rejects invalid handoff contracts', () => {
    const validation = validateHandoffContract({
      id: 'bad',
      sourceAgentId: 'same',
      targetAgentId: 'same',
      allowedCapabilities: [],
      contextMode: 'full',
      preserveTaint: false,
      requireApproval: true,
    });

    expect(validation.ok).toBe(false);
  });
});
