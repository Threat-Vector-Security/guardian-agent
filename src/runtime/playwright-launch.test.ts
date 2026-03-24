import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveManagedPlaywrightLaunch } from './playwright-launch.js';

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

function makeTempDir(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), `${prefix}-`));
  tempRoots.push(root);
  return root;
}

describe('resolveManagedPlaywrightLaunch', () => {
  it('prefers the repo-local @playwright/mcp cli when installed', () => {
    const root = makeTempDir('playwright-launch-local');
    const packageDir = join(root, 'node_modules', '@playwright', 'mcp');
    mkdirSync(packageDir, { recursive: true });
    writeFileSync(join(packageDir, 'cli.js'), '#!/usr/bin/env node\n');

    const result = resolveManagedPlaywrightLaunch(
      {
        playwrightBrowser: 'firefox',
        playwrightCaps: 'network,storage,vision',
        playwrightArgs: ['--no-sandbox'],
      },
      { cwd: root, nodePath: '/custom/node' },
    );

    expect(result).toEqual({
      command: '/custom/node',
      args: [
        join(packageDir, 'cli.js'),
        '--headless',
        '--browser', 'firefox',
        '--caps', 'network,storage,vision',
        '--snapshot-mode', 'incremental',
        '--no-sandbox',
      ],
      source: 'local-package',
      detail: join(packageDir, 'cli.js'),
    });
  });

  it('falls back to npx when the local package is missing', () => {
    const root = makeTempDir('playwright-launch-npx');

    const result = resolveManagedPlaywrightLaunch(
      { playwrightBrowser: 'chromium', playwrightCaps: 'network,storage' },
      { cwd: root },
    );

    expect(result).toEqual({
      command: 'npx',
      args: [
        '--no-install',
        '@playwright/mcp',
        '--headless',
        '--browser', 'chromium',
        '--caps', 'network,storage',
        '--snapshot-mode', 'incremental',
      ],
      source: 'npx',
      detail: '@playwright/mcp',
    });
  });
});
