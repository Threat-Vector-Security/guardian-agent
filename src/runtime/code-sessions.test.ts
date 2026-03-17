import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { CodeSessionStore } from './code-sessions.js';

const testDirs: string[] = [];

function createWorkspace(name: string, files: Record<string, string>): string {
  const root = join(tmpdir(), `guardianagent-code-session-${name}-${randomUUID()}`);
  mkdirSync(root, { recursive: true });
  testDirs.push(root);
  for (const [relativePath, content] of Object.entries(files)) {
    const targetPath = join(root, relativePath);
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, content, 'utf-8');
  }
  return root;
}

afterEach(() => {
  for (const dir of testDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('CodeSessionStore', () => {
  it('creates sessions with a workspace profile', () => {
    const workspaceRoot = createWorkspace('node-app', {
      'README.md': '# Test App\n\nA sample React app.',
      'package.json': JSON.stringify({
        name: 'test-app',
        description: 'A sample React app.',
        dependencies: {
          react: '^18.0.0',
          next: '^14.0.0',
        },
      }),
      'src/index.tsx': 'export const app = true;\n',
    });
    const store = new CodeSessionStore({
      enabled: false,
      sqlitePath: join(workspaceRoot, '.guardianagent', 'code-sessions.sqlite'),
    });

    const session = store.createSession({
      ownerUserId: 'owner',
      title: 'Test Session',
      workspaceRoot,
    });

    expect(session.workState.workspaceProfile?.repoName).toBe('test-app');
    expect(session.workState.workspaceProfile?.stack).toContain('React');
    expect(session.workState.workspaceProfile?.summary).toContain('test-app');
    expect(session.workState.workspaceProfile?.inspectedFiles).toContain('README.md');
  });

  it('refreshes the workspace profile when the session root changes', () => {
    const firstRoot = createWorkspace('first', {
      'package.json': JSON.stringify({ name: 'first-app' }),
    });
    const secondRoot = createWorkspace('second', {
      'pyproject.toml': '[project]\nname = "second-app"\ndescription = "Python app"\n',
      'README.md': '# Second App\n\nPython automation worker.\n',
    });
    const store = new CodeSessionStore({
      enabled: false,
      sqlitePath: join(firstRoot, '.guardianagent', 'code-sessions.sqlite'),
    });

    const session = store.createSession({
      ownerUserId: 'owner',
      title: 'Workspace Switch',
      workspaceRoot: firstRoot,
    });
    const updated = store.updateSession({
      sessionId: session.id,
      ownerUserId: 'owner',
      workspaceRoot: secondRoot,
    });

    expect(updated?.workState.workspaceProfile?.repoName).toBe('second-app');
    expect(updated?.workState.workspaceProfile?.stack).toContain('Python');
    expect(updated?.resolvedRoot).toBe(secondRoot);
  });

  it('derives a workspace profile for older sessions that do not have one persisted', () => {
    const workspaceRoot = createWorkspace('legacy', {
      'README.md': '# Legacy App\n\nA small service.\n',
      'package.json': JSON.stringify({ name: 'legacy-app', dependencies: { express: '^4.0.0' } }),
    });
    const store = new CodeSessionStore({
      enabled: false,
      sqlitePath: join(workspaceRoot, '.guardianagent', 'code-sessions.sqlite'),
    });

    const session = store.createSession({
      ownerUserId: 'owner',
      title: 'Legacy Session',
      workspaceRoot,
    });
    store.updateSession({
      sessionId: session.id,
      ownerUserId: 'owner',
      workState: {
        workspaceProfile: null,
      },
    });

    const hydrated = store.getSession(session.id, 'owner');
    expect(hydrated?.workState.workspaceProfile?.repoName).toBe('legacy-app');
    expect(hydrated?.workState.workspaceProfile?.summary).toContain('legacy-app');
  });
});
