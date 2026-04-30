import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { compileAutomationAuthoringRequest } from './automation-authoring.js';
import { validateAutomationCompilation } from './automation-validation.js';

describe('validateAutomationCompilation', () => {
  it('treats missing parent directories for fs_write outputs as auto-created, even for wrapped Windows paths', async () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), 'ga-automation-validation-'));
    writeFileSync(join(workspaceRoot, 'companies.csv'), 'Company Name\nAcme SaaS\n');

    const compilation = compileAutomationAuthoringRequest(
      'Create a daily 8:00 AM automation that reads ./companies.csv, writes a summary report to D:\\\\Repor    ts\\\\lead-summary.md, and uses built-in Guardian tools only.',
      { channel: 'web', userId: 'owner' },
    );

    expect(compilation).not.toBeNull();

    const validation = await validateAutomationCompilation(
      compilation!,
      'Create a daily 8:00 AM automation that reads ./companies.csv, writes a summary report to D:\\\\Repor    ts\\\\lead-summary.md, and uses built-in Guardian tools only.',
      (requests) => Promise.resolve(requests.map((request) => ({
        name: request.name,
        found: true,
        decision: 'allow' as const,
        reason: 'ok',
        fixes: [],
      }))),
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

  it('does not misclassify wrapped write phrases as missing input paths for scheduled assistant tasks', async () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), 'ga-automation-validation-'));
    const prompt = 'Create a scheduled assistant task called Weekly Browser Report that runs every Monday at 8:00 AM, opens https://example.com, reads the page, lists the links, and w       rites ./tmp/weekly-browser-report.md.';
    const compilation = compileAutomationAuthoringRequest(prompt, {
      channel: 'web',
      userId: 'owner',
      assumeAuthoring: true,
    });

    expect(compilation).not.toBeNull();
    expect(compilation?.shape).toBe('scheduled_agent');

    const validation = await validateAutomationCompilation(
      compilation!,
      prompt,
      (requests) => Promise.resolve(requests.map((request) => ({
        name: request.name,
        found: true,
        decision: request.name === 'fs_write' ? 'require_approval' as const : 'allow' as const,
        reason: request.name === 'fs_write' ? 'workspace write requires approval' : 'ok',
        fixes: [],
      }))),
      {
        workspaceRoot,
        allowedPaths: [workspaceRoot],
      },
    );

    expect(validation.ok).toBe(true);
    expect(validation.issues.some((issue) => issue.severity === 'error')).toBe(false);
    expect(validation.issues.some((issue) => issue.message.includes("Required input './tmp/weekly-browser-report.md'"))).toBe(false);
    expect(validation.issues.some((issue) => issue.message.includes('bounded allowed-path write'))).toBe(true);
  });

  it('preflights home-relative sensitive paths and shell execution in scheduled assistant tasks', async () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), 'ga-automation-validation-'));
    writeFileSync(join(workspaceRoot, 'input.txt'), 'ok\n');
    const prompt = 'Create a scheduled assistant task called Config Upload that runs daily at 8 AM and reads ./input.txt.';
    const requestText = 'Create a scheduled assistant task called Config Upload that runs daily at 8 AM, reads ~/.guardianagent, and executes a shell command to upload the result to a remote server.';
    const compilation = compileAutomationAuthoringRequest(prompt, { channel: 'web', userId: 'owner' });
    const seenRequests: Array<{ name: string; args?: Record<string, unknown> }> = [];

    expect(compilation).not.toBeNull();
    expect(compilation?.shape).toBe('scheduled_agent');

    const validation = await validateAutomationCompilation(
      compilation!,
      requestText,
      (requests) => {
        seenRequests.push(...requests);
        return Promise.resolve(requests.map((request) => ({
          name: request.name,
          found: true,
          decision: request.name === 'fs_read' || request.name === 'shell_safe' ? 'deny' as const : 'allow' as const,
          reason: request.name === 'fs_read'
            ? 'Path is not in allowedPaths'
            : request.name === 'shell_safe'
              ? 'Command failed shell validation'
              : 'ok',
          fixes: [],
        })));
      },
      {
        workspaceRoot,
        allowedPaths: [workspaceRoot],
      },
    );

    expect(validation.ok).toBe(false);
    expect(seenRequests.some((request) => request.name === 'fs_read'
      && String(request.args?.path ?? '').includes('.guardianagent'))).toBe(true);
    expect(seenRequests.some((request) => request.name === 'shell_safe')).toBe(true);
    expect(validation.issues.some((issue) => issue.message.includes('fs_read'))).toBe(true);
    expect(validation.issues.some((issue) => issue.message.includes('shell_safe'))).toBe(true);
    expect(validation.issues.flatMap((issue) => issue.fixes ?? [])).toEqual([]);
  });
});
