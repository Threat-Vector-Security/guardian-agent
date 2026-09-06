import { describe, expect, it } from 'vitest';
import { crc32, deflateRawSync } from 'node:zlib';
import { fetchFrameworkCatalog, importControlSet, importTier3Catalogue, loadBuiltInFramework, parseDelimitedRows, previewControlSetImport } from '../../web/contextcypher/src/services/guardianGrcApi.js';
import { unzipWorkbook } from '../../web/contextcypher/src/services/guardianXlsx.js';
import { createDefaultGrcWorkspace, ensureGrcWorkspace } from '../../web/contextcypher/src/services/GrcWorkspaceService.js';

function archive(text: string, declaredSize = Buffer.byteLength(text), memberName = 'xl/workbook.xml') {
  const name = Buffer.from(memberName); const compressed = deflateRawSync(text);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(8, 8); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(declaredSize, 22); local.writeUInt16LE(name.length, 26);
  const entry = Buffer.alloc(46); entry.writeUInt32LE(0x02014b50); entry.writeUInt16LE(8, 10); entry.writeUInt32LE(compressed.length, 20); entry.writeUInt32LE(declaredSize, 24); entry.writeUInt16LE(name.length, 28);
  local.writeUInt32LE(crc32(Buffer.from(text)), 14); entry.writeUInt32LE(crc32(Buffer.from(text)), 16);
  const directoryOffset = local.length + name.length + compressed.length; const directorySize = entry.length + name.length;
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(directorySize, 12); end.writeUInt32LE(directoryOffset, 16);
  return Buffer.concat([local, name, compressed, entry, name, end]);
}

describe('restored ContextCypher GRC workflows', () => {
  it('keeps user-imported controls and saved records when a framework is not bundled', async () => {
    const imported = await importControlSet({ name: 'IEC 62443 user-supplied controls', format: 'csv', csvText: 'Control ID,Title,Description\nUSER-1,Locally authored requirement,User-provided content' });
    const original = { ...createDefaultGrcWorkspace(), controlSets: [imported.controlSet], soaEntries: imported.soaEntries };
    const restored = ensureGrcWorkspace(JSON.parse(JSON.stringify(original)));
    expect(restored.controlSets[0]).toMatchObject({ id: imported.controlSet.id, name: imported.controlSet.name, controls: [{ controlId: 'USER-1', description: 'User-provided content' }] });
    expect(restored.soaEntries[0].controlSetId).toBe(imported.controlSet.id);
  });
  it('parses quoted multiline data and BOM/semicolon dialects without losing descriptions', async () => {
    const csv = '\uFEFFControl ID;Title;Description;Family\r\nAC-1;"Policy; rules";"First line\nSecond ""quoted"" line";Access Control';
    const preview = await previewControlSetImport({ name: 'Local controls', format: 'csv', csvText: csv });
    expect(preview.totalControls).toBe(1);
    expect(preview.preview[0]).toMatchObject({ controlId: 'AC-1', title: 'Policy; rules', description: 'First line\nSecond "quoted" line', family: 'Access Control' });
    const imported = await importControlSet({ name: 'Local controls', version: '2', format: 'csv', csvText: csv, scopeType: 'diagram', scopeId: 'diagram-1' });
    expect(imported.controlSet.controls[0].description).toBe(preview.preview[0].description);
    expect(imported.soaEntries[0]).toMatchObject({ controlSetId: imported.controlSet.id, controlId: 'AC-1', scopeType: 'diagram', scopeId: 'diagram-1', implementationStatus: 'not_implemented' });
  });
  it('retains tier taxonomy enrichment and deduplication', async () => {
    const result = await importTier3Catalogue('Domain,Risk Scenario,Risk ID,CIA,Impact\nIT,Credential theft,R1,Confidentiality,Business\nIT,Credential theft,R2,Integrity,Business');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ tier2: 'Compromise of IT systems exposes sensitive information and business services.', tier3: 'Credential theft', tags: ['risk_id:r1', 'domain:it', 'cia:confidentiality', 'impact:business'] });
  });
  it('rejects malformed and excessive imports rather than silently truncating', () => {
    expect(() => parseDelimitedRows('id,title\na,"unterminated')).toThrow('unterminated');
    expect(() => parseDelimitedRows(`id,title\na,${'x'.repeat(65_537)}`)).toThrow('cell');
    expect(() => parseDelimitedRows('id,title\n' + 'a,b\n'.repeat(20_001))).toThrow('20,000');
  });
  it('loads all original framework datasets and scopes SoA rows, with real counts and family filtering', async () => {
    const catalog = await fetchFrameworkCatalog(); expect(catalog).toHaveLength(7);
    expect(catalog.some(entry => ['csa-ccm', 'iec-62443'].includes(entry.frameworkKey))).toBe(false);
    for (const frameworkKey of ['csa-ccm', 'iec-62443']) await expect(loadBuiltInFramework({ frameworkKey })).rejects.toThrow('catalogue');
    for (const entry of catalog) {
      const loaded = await loadBuiltInFramework({ frameworkKey: entry.frameworkKey, scopeType: 'assessment', scopeId: 'assessment-1' });
      expect(loaded.controlCount).toBe(entry.controlCount); expect(loaded.controlCount).toBeGreaterThan(0);
      expect(loaded.soaEntries).toHaveLength(loaded.controlCount); expect(loaded.soaEntries[0].scopeId).toBe('assessment-1');
    }
    const base = await loadBuiltInFramework({ frameworkKey: 'nist-800-53', baseControlsOnly: true, selectedFamilies: ['Access Control'] });
    expect(base.controlCount).toBeGreaterThan(0); expect(base.controlSet.controls.every(c => c.family === 'Access Control' && !c.controlId.includes('('))).toBe(true);
    expect(base.controlSet.controls.some(c => (c.description?.length || 0) > 500)).toBe(true);
    await expect(loadBuiltInFramework({ frameworkKey: '../../secrets' })).rejects.toThrow('catalogue');
  });
  it('bounds decompression and validates ZIP metadata', async () => {
    const text = '<workbook>example</workbook>';
    expect(new TextDecoder().decode((await unzipWorkbook(archive(text))).get('xl/workbook.xml'))).toBe(text);
    await expect(unzipWorkbook(archive('x'.repeat(100_000), 1))).rejects.toThrow('bounds');
    await expect(unzipWorkbook(archive(text, 40 * 1024 * 1024))).rejects.toThrow('32 MiB');
    await expect(unzipWorkbook(archive(text, Buffer.byteLength(text), '../external.xml'))).rejects.toThrow('member name');
    await expect(unzipWorkbook(archive(text).subarray(0, 25))).rejects.toThrow('directory');
  });
});
