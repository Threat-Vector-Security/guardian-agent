import { describe, expect, it, vi } from 'vitest';
import { resolvePlaywrightModuleSpec } from './browser-playwright-direct.js';

describe('resolvePlaywrightModuleSpec', () => {
  it('prefers the project-level playwright dependency when present', () => {
    const rootResolver = {
      resolve: vi.fn((moduleId: string) => {
        if (moduleId === 'playwright') {
          return '/repo/node_modules/playwright/index.js';
        }
        throw new Error(`unexpected resolve ${moduleId}`);
      }),
    };
    const scopeResolverFactory = vi.fn();

    expect(resolvePlaywrightModuleSpec(rootResolver, scopeResolverFactory, { cwd: '/repo' })).toEqual({
      moduleName: 'playwright',
      entryPath: '/repo/node_modules/playwright/index.js',
      source: 'project-dependency',
    });
    expect(scopeResolverFactory).not.toHaveBeenCalled();
  });

  it('falls back to the @playwright/mcp-scoped playwright dependency', () => {
    const rootResolver = {
      resolve: vi.fn((moduleId: string) => {
        if (moduleId === 'playwright') {
          throw new Error('not installed at project root');
        }
        if (moduleId === '@playwright/mcp/package.json') {
          return '/repo/node_modules/@playwright/mcp/package.json';
        }
        throw new Error(`unexpected resolve ${moduleId}`);
      }),
    };
    const scopedResolver = {
      resolve: vi.fn((moduleId: string) => {
        if (moduleId === 'playwright') {
          return '/repo/node_modules/@playwright/mcp/node_modules/playwright/index.js';
        }
        throw new Error(`unexpected resolve ${moduleId}`);
      }),
    };

    expect(resolvePlaywrightModuleSpec(rootResolver, vi.fn(() => scopedResolver), { cwd: '/repo' })).toEqual({
      moduleName: 'playwright',
      entryPath: '/repo/node_modules/@playwright/mcp/node_modules/playwright/index.js',
      source: 'playwright-mcp-dependency',
    });
  });

  it('returns null when neither the project nor @playwright/mcp exposes playwright', () => {
    const rootResolver = {
      resolve: vi.fn(() => {
        throw new Error('missing');
      }),
    };

    expect(resolvePlaywrightModuleSpec(rootResolver, vi.fn(), { cwd: '/repo' })).toBeNull();
  });
});
