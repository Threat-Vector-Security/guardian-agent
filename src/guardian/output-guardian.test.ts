import { describe, it, expect } from 'vitest';
import { OutputGuardian } from './output-guardian.js';

describe('OutputGuardian', () => {
  describe('scanResponse', () => {
    it('should return clean for content without secrets', () => {
      const guardian = new OutputGuardian();
      const result = guardian.scanResponse('The capital of France is Paris.');

      expect(result.clean).toBe(true);
      expect(result.secrets.length).toBe(0);
      expect(result.sanitized).toBe('The capital of France is Paris.');
    });

    it('should detect and redact AWS access keys', () => {
      const guardian = new OutputGuardian();
      const content = 'Your key is AKIAIOSFODNN7EXAMPLE, use it wisely.';
      const result = guardian.scanResponse(content);

      expect(result.clean).toBe(false);
      expect(result.secrets.length).toBe(1);
      expect(result.secrets[0].pattern).toBe('AWS Access Key');
      expect(result.sanitized).toContain('[REDACTED]');
      expect(result.sanitized).not.toContain('AKIAIOSFODNN7EXAMPLE');
    });

    it('should detect and redact GitHub tokens', () => {
      const guardian = new OutputGuardian();
      const token = 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij';
      const content = `Use this token: ${token}`;
      const result = guardian.scanResponse(content);

      expect(result.clean).toBe(false);
      expect(result.sanitized).toContain('[REDACTED]');
      expect(result.sanitized).not.toContain(token);
    });

    it('should redact multiple secrets in one response', () => {
      const guardian = new OutputGuardian();
      const content = 'Key: AKIAIOSFODNN7EXAMPLE, Token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij';
      const result = guardian.scanResponse(content);

      expect(result.clean).toBe(false);
      expect(result.secrets.length).toBe(2);
      const redactedCount = (result.sanitized.match(/\[REDACTED\]/g) || []).length;
      expect(redactedCount).toBe(2);
    });

    it('should detect JWT tokens', () => {
      const guardian = new OutputGuardian();
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const content = `Bearer ${jwt}`;
      const result = guardian.scanResponse(content);

      expect(result.clean).toBe(false);
      expect(result.secrets[0].pattern).toBe('JWT Token');
    });

    it('should detect Stripe live keys', () => {
      const guardian = new OutputGuardian();
      const content = 'sk_live_abcdefghij1234567890XX';
      const result = guardian.scanResponse(content);

      expect(result.clean).toBe(false);
      expect(result.secrets[0].pattern).toBe('Stripe Live Key');
    });
  });

  describe('scanPayload', () => {
    it('should detect secrets in object payloads', () => {
      const guardian = new OutputGuardian();
      const payload = { config: 'AKIAIOSFODNN7EXAMPLE' };
      const secrets = guardian.scanPayload(payload);

      expect(secrets.length).toBe(1);
      expect(secrets[0].pattern).toBe('AWS Access Key');
    });

    it('should detect secrets in string payloads', () => {
      const guardian = new OutputGuardian();
      const secrets = guardian.scanPayload('token: sk-ant-api03-abcdefghij1234567890');

      expect(secrets.length).toBe(1);
      expect(secrets[0].pattern).toBe('Anthropic API Key');
    });

    it('should return empty for clean payloads', () => {
      const guardian = new OutputGuardian();
      const secrets = guardian.scanPayload({ message: 'Hello, world!' });

      expect(secrets.length).toBe(0);
    });
  });

  describe('scanContent', () => {
    it('should scan raw content for secrets', () => {
      const guardian = new OutputGuardian();
      const secrets = guardian.scanContent('My key is AKIAIOSFODNN7EXAMPLE');

      expect(secrets.length).toBe(1);
    });
  });
});
