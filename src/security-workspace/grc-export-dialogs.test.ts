import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { saveFile } from '../../web/shared/file-dialogs.js';
import { downloadHtmlFile, downloadTextFile, saveExport } from '../../web/contextcypher/src/utils/exportUtils.js';
import { downloadTextFile as exportThreatModel } from '../../web/contextcypher/src/utils/threatModelExport.js';

vi.mock('../../web/shared/file-dialogs.js', () => ({ saveFile: vi.fn() }));
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); });

describe('GRC export save dialog contract', () => {
  it('returns save completion and preserves report/interchange content', async () => {
    vi.mocked(saveFile).mockResolvedValue(true);
    expect(await downloadTextFile('R&D text', 'assessment')).toBe(true);
    expect(await downloadHtmlFile('<h1>Assessment</h1>', 'assessment')).toBe(true);
    expect(await exportThreatModel('model.drawio', '<mxfile/>', 'application/xml')).toBe(true);
    const calls = vi.mocked(saveFile).mock.calls;
    expect(calls[0][0]).toMatch(/^assessment-.*\.txt$/);
    expect(await (calls[0][1] as Blob).text()).toBe('R&D text');
    expect(calls[1][0]).toMatch(/^assessment-.*\.html$/);
    expect(await (calls[1][1] as Blob).text()).toBe('<h1>Assessment</h1>');
    expect(calls[2][0]).toBe('model.drawio');
    expect((calls[2][1] as Blob).type).toBe('application/xml');
  });

  it('keeps cancellation quiet and displays a write failure without claiming success', async () => {
    const alert = vi.fn(); vi.stubGlobal('window', { alert });
    vi.mocked(saveFile).mockResolvedValueOnce(false).mockRejectedValueOnce(new Error('Disk full'));
    expect(await downloadTextFile('report', 'assessment')).toBe(false);
    expect(alert).not.toHaveBeenCalled();
    expect(await downloadHtmlFile('report', 'assessment')).toBe(false);
    expect(alert).toHaveBeenCalledWith('The file was not saved: Disk full');
  });

  it('forwards lazy content without starting generation before the shared picker', async () => {
    const factory = vi.fn(async () => new Blob(['pdf'])); vi.mocked(saveFile).mockResolvedValue(false);
    expect(await saveExport('assessment.pdf', factory)).toBe(false);
    expect(saveFile).toHaveBeenCalledWith('assessment.pdf', factory);
    expect(factory).not.toHaveBeenCalled();
    const assessments = readFileSync(new URL('../../web/contextcypher/src/components/grc/GrcAssessmentsTab.tsx', import.meta.url), 'utf8');
    expect(assessments).toMatch(/await saveExport\([^\n]+async \(\) => \{\s+const \{ default: jsPDF \} = await import\('jspdf'\)/);
    expect(assessments).not.toContain('pdf.save(');
  });
});
