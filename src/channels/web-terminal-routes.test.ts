import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCodeTerminalEnv } from './web-terminal-routes.js';

describe('web terminal routes', () => {
  it('keeps Windows shell profile state outside the workspace root', () => {
    const workspaceRoot = 'C:\\repo\\music-app';
    const env = buildCodeTerminalEnv(workspaceRoot, {}, 'win32');

    expect(env.HOME).not.toBe(workspaceRoot);
    expect(env.USERPROFILE).toBe(env.HOME);
    expect(env.HOME).toContain(resolve(tmpdir(), 'guardianagent-code-terminal-home'));
    expect(env.APPDATA).toBe(resolve(env.HOME, 'AppData', 'Roaming'));
    expect(env.LOCALAPPDATA).toBe(resolve(env.HOME, 'AppData', 'Local'));
    expect(env.npm_config_cache).toBe(resolve(workspaceRoot, '.guardianagent', 'cache', 'npm'));
  });
});
