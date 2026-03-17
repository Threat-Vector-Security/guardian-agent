import { describe, expect, it } from 'vitest';
import { getAmbiguousEmailProviderClarification } from './email-provider-routing.js';

const BOTH_MAIL_PROVIDERS = new Set(['gws', 'm365']);

describe('email-provider-routing', () => {
  it('asks for clarification on generic inbox reads when both mail providers are enabled', () => {
    expect(getAmbiguousEmailProviderClarification('Check my email.', BOTH_MAIL_PROVIDERS))
      .toContain('Which one do you want me to use?');
  });

  it('asks for clarification on generic compose requests when both mail providers are enabled', () => {
    expect(getAmbiguousEmailProviderClarification('Draft an email to alex@example.com.', BOTH_MAIL_PROVIDERS))
      .toContain('Google Workspace');
  });

  it('does not ask for clarification when Gmail is explicit', () => {
    expect(getAmbiguousEmailProviderClarification('Check my Gmail inbox.', BOTH_MAIL_PROVIDERS)).toBeNull();
  });

  it('does not ask for clarification when Outlook is explicit', () => {
    expect(getAmbiguousEmailProviderClarification('Check my Outlook email.', BOTH_MAIL_PROVIDERS)).toBeNull();
  });

  it('does not ask for clarification when only one mail provider is enabled', () => {
    expect(getAmbiguousEmailProviderClarification('Check my email.', new Set(['gws']))).toBeNull();
  });

  it('ignores general informational email questions', () => {
    expect(getAmbiguousEmailProviderClarification('Explain email authentication headers.', BOTH_MAIL_PROVIDERS)).toBeNull();
  });
});
