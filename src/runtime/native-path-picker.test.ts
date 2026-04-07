import { describe, expect, it, vi } from 'vitest';
import { pickNativeSearchPath, resolveNativePathPickerBackend } from './native-path-picker.js';

describe('resolveNativePathPickerBackend', () => {
  it('uses the Windows backend on Windows hosts', async () => {
    await expect(resolveNativePathPickerBackend({
      platform: 'win32',
      env: {},
    })).resolves.toBe('windows');
  });

  it('uses the Windows backend for WSL-hosted Guardian', async () => {
    await expect(resolveNativePathPickerBackend({
      platform: 'linux',
      env: { WSL_DISTRO_NAME: 'Ubuntu' },
    })).resolves.toBe('windows');
  });

  it('uses the macOS backend on darwin hosts', async () => {
    await expect(resolveNativePathPickerBackend({
      platform: 'darwin',
      env: {},
    })).resolves.toBe('macos');
  });

  it('uses zenity on desktop Linux when available', async () => {
    const execFile = vi.fn((file, args, options, callback) => {
      callback?.(null, '/usr/bin/zenity\n', '');
      return {} as never;
    });
    await expect(resolveNativePathPickerBackend({
      platform: 'linux',
      env: { DISPLAY: ':0' },
      execFile,
    })).resolves.toBe('linux-zenity');
  });

  it('falls back to kdialog on desktop Linux when zenity is unavailable', async () => {
    const execFile = vi.fn((file, args, options, callback) => {
      if (args?.[0] === 'zenity') {
        const err = Object.assign(new Error('not found'), { code: 1 });
        callback?.(err, '', '');
        return {} as never;
      }
      callback?.(null, '/usr/bin/kdialog\n', '');
      return {} as never;
    });
    await expect(resolveNativePathPickerBackend({
      platform: 'linux',
      env: { DISPLAY: ':0' },
      execFile,
    })).resolves.toBe('linux-kdialog');
  });

  it('returns null on Linux without a desktop session', async () => {
    await expect(resolveNativePathPickerBackend({
      platform: 'linux',
      env: {},
    })).resolves.toBeNull();
  });
});

describe('pickNativeSearchPath', () => {
  it('parses Windows picker JSON payloads', async () => {
    const execFile = vi.fn((file, args, options, callback) => {
      callback?.(null, JSON.stringify({
        success: true,
        canceled: false,
        path: 'C:\\Users\\alex\\Document.pdf',
        message: 'File selected.',
      }), '');
      return {} as never;
    });
    await expect(pickNativeSearchPath('file', {
      platform: 'win32',
      env: {},
      execFile,
    })).resolves.toEqual({
      success: true,
      canceled: false,
      path: 'C:\\Users\\alex\\Document.pdf',
      message: 'File selected.',
    });
  });

  it('returns raw selected paths for macOS and Linux pickers', async () => {
    const execFile = vi.fn((file, args, options, callback) => {
      callback?.(null, '/Users/alex/Documents/report.pdf\n', '');
      return {} as never;
    });
    await expect(pickNativeSearchPath('file', {
      platform: 'darwin',
      env: {},
      execFile,
    })).resolves.toEqual({
      success: true,
      canceled: false,
      path: '/Users/alex/Documents/report.pdf',
      message: 'File selected.',
    });
  });

  it('treats picker cancellations as canceled results', async () => {
    const execFile = vi.fn((file, args, options, callback) => {
      if (file === 'which') {
        callback?.(null, '/usr/bin/zenity\n', '');
        return {} as never;
      }
      const err = Object.assign(new Error('User canceled'), { code: 1 });
      callback?.(err, '', '');
      return {} as never;
    });
    await expect(pickNativeSearchPath('file', {
      platform: 'linux',
      env: { DISPLAY: ':0' },
      execFile,
    })).resolves.toEqual({
      success: false,
      canceled: true,
      message: 'Selection cancelled.',
    });
  });

  it('returns an unsupported-host message when no backend is available', async () => {
    await expect(pickNativeSearchPath('file', {
      platform: 'linux',
      env: {},
    })).resolves.toEqual({
      success: false,
      canceled: false,
      message: 'Native path picker is currently available on Windows, macOS, and desktop Linux hosts.',
    });
  });
});
