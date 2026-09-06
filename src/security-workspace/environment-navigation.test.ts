import { afterEach, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { SecurityStore } from './store.js';
import { SecurityWorkspace } from './service.js';
import EnvironmentsPage from '../../web/security/environments.js';

const state = vi.hoisted(() => ({ hook: 0, operation: vi.fn() }));
vi.mock('react', async importOriginal => ({ ...await importOriginal<typeof import('react')>(), useState: (initial: unknown) => {
  const index = state.hook++;
  const value = index === 1 ? { source: 'local', scope: 'device:test', collectedAt: 1, nodeCount: 0, edgeCount: 0, warnings: [], coverage: [], document: { systemName: 'Observed', nodes: [], edges: [] } } : index === 5 ? 'Observed' : initial;
  return [value, vi.fn()];
} }));
vi.mock('../../web/security/api.js', async importOriginal => ({ ...await importOriginal<typeof import('../../web/security/api.js')>(), operation: (...args: unknown[]) => state.operation(...args), useOperation: () => ({ data: { items: [] }, error: '', loading: false, refresh: vi.fn() }) }));
vi.mock('@xyflow/react', () => ({ Background: () => null, Controls: () => null, ReactFlow: () => null }));

afterEach(() => { state.hook = 0; vi.unstubAllGlobals(); vi.clearAllMocks(); });

function createButton(element: any): any {
  if (element?.type === 'button' && Array.isArray(element.props.children) && element.props.children.includes('Create editable system')) return element;
  const children = element?.props?.children;
  for (const child of Array.isArray(children) ? children.flat(Infinity) : [children]) {
    const found = child && typeof child === 'object' ? createButton(child) : undefined;
    if (found) return found;
  }
}

it.each([true, false])('opens the actual project from the import envelope (callback=%s)', async callback => {
  const dir = mkdtempSync(join(tmpdir(), 'guardian-map-navigation-'));
  const store = new SecurityStore(dir);
  const workspace = new SecurityWorkspace(store, { check: async () => { throw new Error('Unexpected collection'); }, requestScan: async () => { throw new Error('Unexpected scan'); } });
  try {
    const principal = store.createClient({ name: 'admin', role: 'admin', scopes: ['admin'], expiresAt: Date.now() + 600000 }, 'bootstrap').client;
    state.operation.mockImplementation((name, input) => workspace.execute(principal, 'admin', name, input));
    const open = vi.fn();
    const location = { hash: '' };
    vi.stubGlobal('location', location);
    const tree = EnvironmentsPage({ principal, ...(callback ? { onOpenProject: open } : {}) });
    const button = createButton(tree);
    expect(button).toBeDefined();
    await button.props.onClick();
    // The UI intentionally voids event promises; wait for the real service response handler.
    await vi.waitFor(() => expect(store.count('project')).toBe(1));
    const project = store.list<{ id: string }>('project')[0];
    await vi.waitFor(() => callback ? expect(open).toHaveBeenCalledWith(project.id) : expect(location.hash).toBe(`systems?project=${encodeURIComponent(project.id)}`));
  } finally {
    await workspace.close(); store.close();
    if (dirname(resolve(dir)) !== resolve(tmpdir()) || !basename(dir).startsWith('guardian-map-navigation-')) throw new Error('Unexpected test directory');
    rmSync(dir, { recursive: true, force: true });
  }
});
