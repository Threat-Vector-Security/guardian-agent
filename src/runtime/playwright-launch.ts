import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { BrowserConfig } from '../config/types.js';

export interface ManagedPlaywrightLaunchSpec {
  command: string;
  args: string[];
  source: 'local-package' | 'npx';
  detail: string;
}

export function resolveManagedPlaywrightLaunch(
  browserConfig: Pick<BrowserConfig, 'playwrightBrowser' | 'playwrightCaps' | 'playwrightArgs'> | undefined,
  options?: { cwd?: string; nodePath?: string },
): ManagedPlaywrightLaunchSpec {
  const cwd = options?.cwd ?? process.cwd();
  const nodePath = options?.nodePath ?? process.execPath;
  const localCliPath = resolve(cwd, 'node_modules', '@playwright', 'mcp', 'cli.js');
  const browser = browserConfig?.playwrightBrowser ?? 'chromium';
  const caps = browserConfig?.playwrightCaps ?? 'network,storage';
  const extraArgs = browserConfig?.playwrightArgs ?? [];

  if (existsSync(localCliPath)) {
    return {
      command: nodePath,
      args: [
        localCliPath,
        '--headless',
        '--browser', browser,
        '--caps', caps,
        '--snapshot-mode', 'incremental',
        ...extraArgs,
      ],
      source: 'local-package',
      detail: localCliPath,
    };
  }

  return {
    command: 'npx',
    args: [
      '--no-install',
      '@playwright/mcp',
      '--headless',
      '--browser', browser,
      '--caps', caps,
      '--snapshot-mode', 'incremental',
      ...extraArgs,
    ],
    source: 'npx',
    detail: '@playwright/mcp',
  };
}
