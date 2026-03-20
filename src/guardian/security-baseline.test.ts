import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../config/types.js';
import {
  enforceSecurityBaseline,
  isSecurityBaselineDisabled,
  previewSecurityBaselineViolations,
  SECURITY_BASELINE,
} from './security-baseline.js';

describe('security baseline', () => {
  it('enforces the compiled minimum posture', () => {
    const config = structuredClone(DEFAULT_CONFIG);
    config.guardian.enabled = false;
    config.guardian.guardianAgent = {
      enabled: false,
      llmProvider: 'auto',
      failOpen: true,
    };
    config.guardian.deniedPaths = [];
    config.guardian.policy = {
      enabled: false,
      mode: 'off',
    };
    config.assistant.tools.policyMode = 'autonomous';
    config.approval_policy = 'autonomous';

    const violations = enforceSecurityBaseline(config, 'config_file');

    expect(violations.map((entry) => entry.field)).toEqual(expect.arrayContaining([
      'guardian.enabled',
      'guardian.guardianAgent.enabled',
      'guardian.guardianAgent.failOpen',
      'guardian.deniedPaths',
      'guardian.policy.enabled',
      'guardian.policy.mode',
      'assistant.tools.policyMode',
    ]));
    expect(config.guardian.enabled).toBe(true);
    expect(config.guardian.guardianAgent.enabled).toBe(true);
    expect(config.guardian.guardianAgent.failOpen).toBe(false);
    expect(config.guardian.deniedPaths).toEqual(expect.arrayContaining(SECURITY_BASELINE.minimumDeniedPaths));
    expect(config.guardian.policy.enabled).toBe(true);
    expect(config.guardian.policy.mode).toBe('shadow');
    expect(config.assistant.tools.policyMode).toBe('approve_by_policy');
    expect(config.approval_policy).toBe('auto-approve');
  });

  it('can preview violations without mutating the source config', () => {
    const config = structuredClone(DEFAULT_CONFIG);
    config.guardian.enabled = false;

    const violations = previewSecurityBaselineViolations(config, 'web_api');

    expect(violations).toHaveLength(1);
    expect(violations[0]?.field).toBe('guardian.enabled');
    expect(config.guardian.enabled).toBe(false);
  });

  it('can be disabled only via environment override', () => {
    vi.stubEnv('GUARDIAN_DISABLE_BASELINE', '1');
    expect(isSecurityBaselineDisabled()).toBe(true);

    const config = structuredClone(DEFAULT_CONFIG);
    config.guardian.enabled = false;

    const violations = enforceSecurityBaseline(config, 'runtime');
    expect(violations).toEqual([]);
    expect(config.guardian.enabled).toBe(false);

    vi.unstubAllEnvs();
  });
});
