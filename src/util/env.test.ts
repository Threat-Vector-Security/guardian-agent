import { describe, expect, it, vi, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { getGuardianBaseDir } from './env.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getGuardianBaseDir', () => {
  it('uses GUARDIAN_BASE_DIR when set', () => {
    vi.stubEnv('GUARDIAN_BASE_DIR', './tmp/guardian-data');

    expect(getGuardianBaseDir()).toBe(resolve('./tmp/guardian-data'));
  });
});
