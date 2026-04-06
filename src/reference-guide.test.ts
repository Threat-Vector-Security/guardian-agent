import { describe, expect, it } from 'vitest';
import { formatGuideForPrompt } from './reference-guide.js';

describe('reference-guide prompt formatter', () => {
  it('formats a prompt-safe product guide summary for app usage questions', () => {
    const formatted = formatGuideForPrompt('How do I create a routine in Second Brain?');

    expect(formatted).toContain('Use this Guardian product and operator guide only when the user asks how to use Guardian');
    expect(formatted).toContain('Second Brain');
    expect(formatted).toContain('Routines');
  });

  it('keeps the GitHub repository path visible for technical users', () => {
    const formatted = formatGuideForPrompt('Where can I find the source code and technical docs?');

    expect(formatted).toContain('GitHub Repository');
    expect(formatted).toContain('Source code: https://github.com/Threat-Vector-Security/guardian-agent/tree/main/src');
  });
});
