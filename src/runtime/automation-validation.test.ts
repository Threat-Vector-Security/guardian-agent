import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { compileAutomationAuthoringRequest } from './automation-authoring.js';
import { validateAutomationCompilation } from './automation-validation.js';

describe('validateAutomationCompilation', () => {
  it('treats missing parent directories for fs_write outputs as auto-created, even for wrapped Windows paths', () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), 'ga-automation-validation-'));
    writeFileSync(join(workspaceRoot, 'companies.csv'), 'Company Name\nAcme SaaS\n');

    const compilation = compileAutomationAuthoringRequest(
      'Create a daily 8:00 AM automation that reads ./companies.csv, writes a summary report to D:\\\\Repor    ts\\\\lead-summary.md, and uses built-in Guardian tools only.',
      { channel: 'web', userId: 'owner' },
    );

    expect(compilation).not.toBeNull();

    const validation = validateAutomationCompilation(
      compilation!,
      'Create a daily 8:00 AM automation that reads ./companies.csv, writes a summary report to D:\\\\Repor    ts\\\\lead-summary.md, and uses built-in Guardian tools only.',
      (requests) => requests.map((request) => ({
        name: request.name,
        found: true,
        decision: 'allow' as const,
        reason: 'ok',
        fixes: [],
      })),
      {
        workspaceRoot,
        allowedPaths: [workspaceRoot, 'D:\\Reports\\lead-summary.md'],
      },
    );

    expect(validation.ok).toBe(true);
    expect(validation.issues).toEqual([
      expect.objectContaining({
        severity: 'warning',
        message: "Output directory for 'D:\\Reports\\lead-summary.md' does not exist yet, but it will be created automatically at runtime.",
      }),
    ]);
  });
});
