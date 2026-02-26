/**
 * Tests for trust presets.
 */

import { describe, it, expect } from 'vitest';
import { TRUST_PRESETS, applyTrustPreset, isValidTrustPreset } from './trust-presets.js';
import { DEFAULT_CONFIG } from '../config/types.js';

describe('Trust Presets', () => {
  it('should validate preset names', () => {
    expect(isValidTrustPreset('locked')).toBe(true);
    expect(isValidTrustPreset('safe')).toBe(true);
    expect(isValidTrustPreset('balanced')).toBe(true);
    expect(isValidTrustPreset('power')).toBe(true);
    expect(isValidTrustPreset('invalid')).toBe(false);
    expect(isValidTrustPreset('')).toBe(false);
  });

  it('locked preset should restrict to read_files only', () => {
    const preset = TRUST_PRESETS.locked;
    expect(preset.capabilities).toEqual(['read_files']);
    expect(preset.toolPolicyMode).toBe('approve_each');
    expect(preset.guardian.rateLimit?.maxPerMinute).toBe(10);
    expect(preset.guardian.rateLimit?.maxPerHour).toBe(100);
  });

  it('power preset should grant all capabilities', () => {
    const preset = TRUST_PRESETS.power;
    expect(preset.capabilities).toContain('read_files');
    expect(preset.capabilities).toContain('write_files');
    expect(preset.capabilities).toContain('execute_commands');
    expect(preset.capabilities).toContain('network_access');
    expect(preset.capabilities).toContain('send_email');
    expect(preset.toolPolicyMode).toBe('autonomous');
    expect(preset.guardian.rateLimit?.maxPerMinute).toBe(60);
  });

  it('should apply preset to config', () => {
    const config = { ...DEFAULT_CONFIG };
    const result = applyTrustPreset('locked', config);

    expect(result.guardian.rateLimit?.maxPerMinute).toBe(10);
    expect(result.guardian.rateLimit?.maxPerHour).toBe(100);
    expect(result.assistant.tools.policyMode).toBe('approve_each');
  });

  it('preset rate limits override existing config rate limits', () => {
    const config = {
      ...DEFAULT_CONFIG,
      guardian: {
        ...DEFAULT_CONFIG.guardian,
        rateLimit: {
          maxPerMinute: 50,
          maxPerHour: 1000,
          burstAllowed: 8,
        },
      },
    };

    const result = applyTrustPreset('locked', config);

    // Preset values override config values
    expect(result.guardian.rateLimit?.maxPerMinute).toBe(10);
    expect(result.guardian.rateLimit?.maxPerHour).toBe(100);
    expect(result.guardian.rateLimit?.burstAllowed).toBe(2);
  });

  it('non-preset guardian fields are preserved', () => {
    const config = { ...DEFAULT_CONFIG };
    config.guardian = { ...config.guardian, logDenials: false };

    const result = applyTrustPreset('locked', config);

    // Fields not covered by preset survive
    expect(result.guardian.logDenials).toBe(false);
    expect(result.guardian.enabled).toBe(DEFAULT_CONFIG.guardian.enabled);
  });

  it('should apply capabilities to agents without explicit ones', () => {
    const config = {
      ...DEFAULT_CONFIG,
      agents: [
        { id: 'agent1', name: 'Test 1' },
        { id: 'agent2', name: 'Test 2', capabilities: ['write_files'] },
      ],
    };

    const result = applyTrustPreset('locked', config);

    // agent1 gets preset capabilities
    expect(result.agents[0].capabilities).toEqual(['read_files']);
    // agent2 keeps its explicit capabilities
    expect(result.agents[1].capabilities).toEqual(['write_files']);
  });

  it('each preset should have progressively more capabilities', () => {
    const locked = TRUST_PRESETS.locked.capabilities.length;
    const safe = TRUST_PRESETS.safe.capabilities.length;
    const balanced = TRUST_PRESETS.balanced.capabilities.length;
    const power = TRUST_PRESETS.power.capabilities.length;

    expect(locked).toBeLessThan(safe);
    expect(safe).toBeLessThan(balanced);
    expect(balanced).toBeLessThan(power);
  });

  it('each preset should have progressively higher rate limits', () => {
    const locked = TRUST_PRESETS.locked.guardian.rateLimit!.maxPerMinute;
    const safe = TRUST_PRESETS.safe.guardian.rateLimit!.maxPerMinute;
    const balanced = TRUST_PRESETS.balanced.guardian.rateLimit!.maxPerMinute;
    const power = TRUST_PRESETS.power.guardian.rateLimit!.maxPerMinute;

    expect(locked).toBeLessThan(safe);
    expect(safe).toBeLessThan(balanced);
    expect(balanced).toBeLessThan(power);
  });
});
