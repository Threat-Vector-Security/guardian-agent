import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_SHELL_LAYER,
  LEGACY_WORKSTATION_MODE_KEY,
  SHELL_LAYER_STORAGE_KEY,
  getSavedShellLayer,
  normalizeShellLayer,
  setSavedShellLayer,
} from '../web/public/js/shell-layout.js';

function createMemoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => {
      data.clear();
    },
  };
}

describe('web shell layout preferences', () => {
  let storage: ReturnType<typeof createMemoryStorage>;

  beforeEach(() => {
    storage = createMemoryStorage();
    vi.stubGlobal('localStorage', storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults new browser sessions to the focused chat shell', () => {
    expect(DEFAULT_SHELL_LAYER).toBe('focused');
    expect(getSavedShellLayer()).toBe('focused');
  });

  it('migrates the legacy workstation boolean when the named layer is absent', () => {
    storage.setItem(LEGACY_WORKSTATION_MODE_KEY, 'true');
    expect(getSavedShellLayer()).toBe('workstation');

    storage.setItem(LEGACY_WORKSTATION_MODE_KEY, 'false');
    expect(getSavedShellLayer()).toBe('classic');
  });

  it('normalizes old web-browser labels to workstation', () => {
    expect(normalizeShellLayer('web-browser')).toBe('workstation');
    expect(normalizeShellLayer('desktop')).toBe('workstation');
    expect(normalizeShellLayer('missing')).toBe('focused');
  });

  it('persists named shell layers while keeping legacy workstation state in sync', () => {
    expect(setSavedShellLayer('focused', { dispatch: false })).toBe('focused');
    expect(storage.getItem(SHELL_LAYER_STORAGE_KEY)).toBe('focused');
    expect(storage.getItem(LEGACY_WORKSTATION_MODE_KEY)).toBe('false');

    expect(setSavedShellLayer('workstation', { dispatch: false })).toBe('workstation');
    expect(storage.getItem(SHELL_LAYER_STORAGE_KEY)).toBe('workstation');
    expect(storage.getItem(LEGACY_WORKSTATION_MODE_KEY)).toBe('true');
  });
});
