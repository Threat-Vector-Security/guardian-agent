import { describe, expect, it } from 'vitest';
import { sanitizeShellArgs, scanWriteContent, validateArgSize } from './argument-sanitizer.js';

describe('sanitizeShellArgs', () => {
  it('allows simple allowlisted commands', () => {
    const result = sanitizeShellArgs('git status', ['git', 'npm']);
    expect(result.safe).toBe(true);
  });

  it('rejects shell control operators even when the prefix is allowlisted', () => {
    const result = sanitizeShellArgs('git status && cat /etc/passwd', ['git']);
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('shell control operators');
  });

  it('rejects inline interpreter eval even when the prefix is allowlisted', () => {
    const result = sanitizeShellArgs('python3 -c "print(1)"', ['python3']);
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('inline interpreter evaluation');
  });

  it('rejects package launchers even when the prefix is allowlisted', () => {
    const result = sanitizeShellArgs('npm exec eslint .', ['npm']);
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('package launcher');
  });
});

describe('scanWriteContent', () => {
  it('detects both secrets and PII in write content', () => {
    const result = scanWriteContent('AWS key AKIAIOSFODNN7EXAMPLE and DOB: 01/31/1988');

    expect(result.secrets.map((match) => match.pattern)).toContain('AWS Access Key');
    expect(result.pii.map((match) => match.entity)).toContain('date_of_birth');
  });
});

describe('validateArgSize', () => {
  it('accepts small argument payloads', () => {
    const result = validateArgSize({ path: 'notes.txt', content: 'hello' }, 64);
    expect(result.valid).toBe(true);
  });

  it('rejects oversized argument payloads', () => {
    const result = validateArgSize({ content: 'x'.repeat(256) }, 64);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('byte limit');
  });
});
