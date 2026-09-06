import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveFile } from '../../web/shared/file-dialogs.js';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('file destination selection', () => {
  it('opens the native picker before asynchronous generation and closes the completed write', async () => {
    const order: string[] = [];
    const blob = new Blob(['exact saved content']);
    const write = vi.fn(async (value: Blob) => { expect(value).toBe(blob); order.push('write'); });
    const close = vi.fn(async () => { order.push('close'); });
    const picker = vi.fn(async () => { order.push('picker'); return { createWritable: async () => ({ write, close }) }; });
    vi.stubGlobal('window', { showSaveFilePicker: picker });
    const pending = saveFile('report.pdf', async () => { order.push('generate'); return blob; });
    expect(order).toEqual(['picker']);
    expect(await pending).toBe(true);
    expect(order).toEqual(['picker', 'generate', 'write', 'close']);
    expect(picker).toHaveBeenCalledWith(expect.objectContaining({ suggestedName: 'report.pdf', types: [{ description: 'PDF file', accept: { 'application/pdf': ['.pdf'] } }] }));
  });

  it('does not generate or download after cancel, and does not disguise permission failures as downloads', async () => {
    const generate = vi.fn();
    const confirm = vi.fn();
    const picker = vi.fn().mockRejectedValueOnce(new DOMException('Cancelled', 'AbortError')).mockRejectedValueOnce(new DOMException('Blocked', 'SecurityError'));
    vi.stubGlobal('window', { showSaveFilePicker: picker, confirm });
    expect(await saveFile('model.json', generate)).toBe(false);
    await expect(saveFile('model.json', generate)).rejects.toMatchObject({ name: 'SecurityError' });
    expect(generate).not.toHaveBeenCalled(); expect(confirm).not.toHaveBeenCalled();
  });

  it('aborts a failed write and never reports success or falls back to another destination', async () => {
    const abort = vi.fn(async () => {});
    const close = vi.fn();
    vi.stubGlobal('window', { showSaveFilePicker: async () => ({ createWritable: async () => ({ write: async () => { throw new Error('Disk full'); }, close, abort }) }) });
    await expect(saveFile('model.json', new Blob(['data']))).rejects.toThrow('Disk full');
    expect(abort).toHaveBeenCalledOnce(); expect(close).not.toHaveBeenCalled();
  });

  it('requires an explicit download choice when a native picker is unavailable', async () => {
    vi.useFakeTimers();
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    const click = vi.fn(); const remove = vi.fn();
    const anchor = { click, remove, href: '', download: '' };
    vi.stubGlobal('window', { confirm });
    vi.stubGlobal('document', { createElement: () => anchor, body: { appendChild: vi.fn() } });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const generate = vi.fn(async () => new Blob(['data']));
    expect(await saveFile('report.txt', generate)).toBe(false);
    expect(generate).not.toHaveBeenCalled();
    expect(await saveFile('report.txt', generate)).toBe(true);
    expect(anchor.download).toBe('report.txt'); expect(click).toHaveBeenCalledOnce(); expect(remove).toHaveBeenCalledOnce();
    vi.runAllTimers(); expect(revoke).toHaveBeenCalledWith('blob:test');
  });
});
