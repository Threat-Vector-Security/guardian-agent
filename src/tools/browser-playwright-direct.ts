import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import type { Browser, BrowserContext, BrowserType, Page } from 'playwright';
import type { BrowserConfig } from '../config/types.js';
import type { ToolResult } from './types.js';

const require = createRequire(import.meta.url);

type PlaywrightModule = typeof import('playwright');
type RequireResolver = Pick<NodeRequire, 'resolve'>;
type PlaywrightModuleId = 'playwright' | 'playwright-core';

interface DirectPlaywrightScopeSession {
  context: BrowserContext;
  page: Page;
}

export interface DirectPlaywrightCapabilities {
  available: boolean;
  navigate: boolean;
  snapshot: boolean;
  interact: boolean;
  evaluate: boolean;
  moduleName?: PlaywrightModuleId;
  moduleSource?: ResolvedPlaywrightModuleSpec['source'];
  moduleEntryPath?: string;
  unavailableReason?: string;
}

export interface ResolvedPlaywrightModuleSpec {
  moduleName: PlaywrightModuleId;
  entryPath: string;
  source: 'project-dependency' | 'playwright-mcp-dependency' | 'project-path' | 'playwright-mcp-path';
}

export interface PlaywrightDirectBackendLike {
  getCapabilities(): DirectPlaywrightCapabilities;
  setBrowserConfig(browserConfig: BrowserConfig | undefined): void;
  navigate(scopeKey: string, url: string): Promise<ToolResult>;
  snapshot(scopeKey: string): Promise<ToolResult>;
  evaluate(scopeKey: string, fnSource: string): Promise<ToolResult>;
  act(
    scopeKey: string,
    input: { action: 'click' | 'type' | 'fill' | 'select'; ref: string; value?: string; label?: string },
  ): Promise<ToolResult>;
  closeAll(): Promise<void>;
}

export class DirectPlaywrightBrowserBackend implements PlaywrightDirectBackendLike {
  private browserConfig: BrowserConfig | undefined;
  private playwrightModulePromise?: Promise<PlaywrightModule>;
  private browserPromise?: Promise<Browser>;
  private readonly sessions = new Map<string, DirectPlaywrightScopeSession>();

  constructor(browserConfig?: BrowserConfig) {
    this.browserConfig = browserConfig;
  }

  getCapabilities(): DirectPlaywrightCapabilities {
    const enabled = this.browserConfig?.enabled !== false
      && this.browserConfig?.playwrightEnabled !== false;
    const playwrightModuleSpec = this.resolveCurrentModuleSpec();
    return {
      available: enabled,
      navigate: enabled,
      snapshot: enabled,
      interact: enabled,
      evaluate: enabled,
      ...(playwrightModuleSpec
        ? {
            moduleName: playwrightModuleSpec.moduleName,
            moduleSource: playwrightModuleSpec.source,
            moduleEntryPath: playwrightModuleSpec.entryPath,
          }
        : {
            unavailableReason: enabled
              ? 'Playwright launch will be attempted lazily at first browser action because no runtime was resolved during capability detection.'
              : undefined,
          }),
    };
  }

  setBrowserConfig(browserConfig: BrowserConfig | undefined): void {
    this.browserConfig = browserConfig;
    if (browserConfig?.enabled === false || browserConfig?.playwrightEnabled === false) {
      void this.closeAll();
    }
  }

  async navigate(scopeKey: string, url: string): Promise<ToolResult> {
    try {
      const page = await this.ensurePage(scopeKey);
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });
      await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => {});
      return {
        success: true,
        output: {
          url: page.url(),
          title: await safePageTitle(page),
        },
      };
    } catch (err) {
      return asFailure(err);
    }
  }

  async snapshot(scopeKey: string): Promise<ToolResult> {
    try {
      const page = await this.ensurePage(scopeKey);
      const snapshot = await (page as Page & {
        _snapshotForAI?: (input?: { timeout?: number; track?: string }) => Promise<{ full?: string; incremental?: string }>;
      })._snapshotForAI?.({
        timeout: 5_000,
        track: 'response',
      });
      if (!snapshot) {
        return { success: false, error: 'The installed Playwright runtime does not expose AI snapshot support.' };
      }
      return {
        success: true,
        output: {
          snapshot: snapshot.full ?? snapshot.incremental ?? '',
        },
      };
    } catch (err) {
      return asFailure(err);
    }
  }

  async evaluate(scopeKey: string, fnSource: string): Promise<ToolResult> {
    try {
      const page = await this.ensurePage(scopeKey);
      const result = await page.evaluate(`(${fnSource})()`);
      return {
        success: true,
        output: result,
      };
    } catch (err) {
      return asFailure(err);
    }
  }

  async act(
    scopeKey: string,
    input: { action: 'click' | 'type' | 'fill' | 'select'; ref: string; value?: string; label?: string },
  ): Promise<ToolResult> {
    try {
      const page = await this.ensurePage(scopeKey);
      const locator = await this.resolveRefLocator(scopeKey, input.ref, input.label);
      if (input.action === 'click') {
        await locator.scrollIntoViewIfNeeded().catch(() => {});
        await locator.click({ timeout: 10_000 });
      } else if (input.action === 'select') {
        await locator.selectOption(input.value ?? '');
      } else {
        await locator.fill(input.value ?? '');
      }
      return {
        success: true,
        output: {
          url: page.url(),
          action: input.action,
          ref: input.ref,
        },
      };
    } catch (err) {
      return asFailure(err);
    }
  }

  async closeAll(): Promise<void> {
    for (const session of this.sessions.values()) {
      await session.context.close().catch(() => {});
    }
    this.sessions.clear();
    const browser = await this.browserPromise?.catch(() => null);
    this.browserPromise = undefined;
    if (browser?.isConnected()) {
      await browser.close().catch(() => {});
    }
  }

  private async ensurePage(scopeKey: string): Promise<Page> {
    const existing = this.sessions.get(scopeKey);
    if (existing && !existing.page.isClosed()) {
      return existing.page;
    }

    const browser = await this.ensureBrowser();
    const context = await browser.newContext();
    const page = await context.newPage();
    this.sessions.set(scopeKey, { context, page });
    page.on('close', () => {
      const current = this.sessions.get(scopeKey);
      if (current?.page === page) {
        this.sessions.delete(scopeKey);
      }
    });
    return page;
  }

  private async ensureBrowser(): Promise<Browser> {
    if (this.browserConfig?.enabled === false || this.browserConfig?.playwrightEnabled === false) {
      throw new Error('The direct Playwright backend is disabled or unavailable.');
    }

    if (!this.browserPromise) {
      this.browserPromise = this.launchBrowser();
      this.browserPromise.catch(() => {
        this.browserPromise = undefined;
      });
    }

    const browser = await this.browserPromise;
    browser.on('disconnected', () => {
      this.browserPromise = undefined;
      this.sessions.clear();
    });
    return browser;
  }

  private async launchBrowser(): Promise<Browser> {
    const playwright = await this.loadPlaywrightModule();
    const { browserType, channel } = resolveLaunchTarget(playwright, this.browserConfig);
    return browserType.launch({
      headless: true,
      ...(channel ? { channel } : {}),
    });
  }

  private async resolveRefLocator(
    scopeKey: string,
    ref: string,
    label?: string,
  ) {
    const page = await this.ensurePage(scopeKey);
    const locator = page.locator(`aria-ref=${ref}`);
    const described = label ? locator.describe(label) : locator;
    try {
      const resolveSelector = (described as { _resolveSelector?: () => Promise<unknown> })._resolveSelector;
      if (typeof resolveSelector === 'function') {
        await resolveSelector.call(described);
      } else {
        const count = await described.count();
        if (count < 1) {
          throw new Error(`Ref ${ref} not found in the current page snapshot. Try capturing new snapshot.`);
        }
      }
      return described;
    } catch {
      throw new Error(`Ref ${ref} not found in the current page snapshot. Try capturing new snapshot.`);
    }
  }

  private async loadPlaywrightModule(): Promise<PlaywrightModule> {
    const playwrightModuleSpec = this.resolveCurrentModuleSpec();
    if (!playwrightModuleSpec) {
      throw new Error('The Playwright runtime is not available in this installation.');
    }
    this.playwrightModulePromise ??= Promise.resolve(require(playwrightModuleSpec.entryPath) as PlaywrightModule);
    return this.playwrightModulePromise;
  }

  private resolveCurrentModuleSpec(): ResolvedPlaywrightModuleSpec | null {
    return resolvePlaywrightModuleSpec();
  }
}

export function resolvePlaywrightModuleSpec(
  rootResolver: RequireResolver = require,
  scopeResolverFactory: (scopePath: string) => RequireResolver = (scopePath) => createRequire(scopePath),
  options?: { cwd?: string },
): ResolvedPlaywrightModuleSpec | null {
  for (const moduleName of ['playwright', 'playwright-core'] as const) {
    const rootEntryPath = tryResolve(rootResolver, moduleName);
    if (rootEntryPath) {
      return {
        moduleName,
        entryPath: rootEntryPath,
        source: 'project-dependency',
      };
    }
  }

  const cwd = options?.cwd ?? process.cwd();
  const explicitProjectCandidates = [
    { moduleName: 'playwright' as const, entryPath: resolve(cwd, 'node_modules', 'playwright', 'index.js') },
    { moduleName: 'playwright-core' as const, entryPath: resolve(cwd, 'node_modules', 'playwright-core', 'index.js') },
  ];
  for (const candidate of explicitProjectCandidates) {
    if (existsSync(candidate.entryPath)) {
      return {
        moduleName: candidate.moduleName,
        entryPath: candidate.entryPath,
        source: 'project-path',
      };
    }
  }

  const mcpPackagePath = tryResolve(rootResolver, '@playwright/mcp/package.json');
  if (mcpPackagePath) {
    const mcpResolver = scopeResolverFactory(mcpPackagePath);
    for (const moduleName of ['playwright', 'playwright-core'] as const) {
      const mcpEntryPath = tryResolve(mcpResolver, moduleName);
      if (mcpEntryPath) {
        return {
          moduleName,
          entryPath: mcpEntryPath,
          source: 'playwright-mcp-dependency',
        };
      }
    }
  }

  const explicitMcpCandidates = [
    { moduleName: 'playwright' as const, entryPath: resolve(cwd, 'node_modules', '@playwright', 'mcp', 'node_modules', 'playwright', 'index.js') },
    { moduleName: 'playwright-core' as const, entryPath: resolve(cwd, 'node_modules', '@playwright', 'mcp', 'node_modules', 'playwright-core', 'index.js') },
  ];
  for (const candidate of explicitMcpCandidates) {
    if (existsSync(candidate.entryPath)) {
      return {
        moduleName: candidate.moduleName,
        entryPath: candidate.entryPath,
        source: 'playwright-mcp-path',
      };
    }
  }

  return null;
}

function tryResolve(resolver: RequireResolver, moduleId: string): string | null {
  try {
    return resolver.resolve(moduleId);
  } catch {
    return null;
  }
}

function resolveLaunchTarget(
  playwright: PlaywrightModule,
  browserConfig: BrowserConfig | undefined,
): { browserType: BrowserType; channel?: string } {
  const browser = browserConfig?.playwrightBrowser ?? 'chromium';
  switch (browser) {
    case 'firefox':
      return { browserType: playwright.firefox };
    case 'webkit':
      return { browserType: playwright.webkit };
    case 'chrome':
      return { browserType: playwright.chromium, channel: 'chrome' };
    case 'msedge':
      return { browserType: playwright.chromium, channel: 'msedge' };
    case 'chromium':
    default:
      return { browserType: playwright.chromium };
  }
}

async function safePageTitle(page: Page): Promise<string | undefined> {
  try {
    return await page.title();
  } catch {
    return undefined;
  }
}

function asFailure(err: unknown): ToolResult {
  return {
    success: false,
    error: err instanceof Error ? err.message : String(err),
  };
}
