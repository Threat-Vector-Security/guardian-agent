import { afterAll, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { crc32, deflateRawSync } from 'node:zlib';
import { jsPDF } from 'jspdf';
import { fetchFrameworkCatalog, importControlSet, loadBuiltInFramework } from '../guardianGrcApi';
import { buildRiskMatrix, calculateRiskScore, computeGrcDashboardMetrics, createDefaultGrcWorkspace, ensureGrcWorkspace, exportPlansCsv, exportSoaCsv, generateWorkflowTasksFromGaps, resolveAssessmentRiskIds, resolveRiskAppetite, rescoreRisks } from '../GrcWorkspaceService';

// Run with the existing ContextCypher jsdom package; no dependency installation is needed.
const require = createRequire(import.meta.url);
const { JSDOM } = require(process.env.GUARDIAN_GRC_DOM_MODULE || 'jsdom');
const dom = new JSDOM('');
vi.stubGlobal('DOMParser', dom.window.DOMParser);
afterAll(() => { dom.window.close(); vi.unstubAllGlobals(); });

function xlsx(members: Record<string, string>): string {
  const data: Buffer[] = []; const directory: Buffer[] = []; let offset = 0;
  for (const [path, text] of Object.entries(members)) {
    const name = Buffer.from(path); const body = deflateRawSync(text); const size = Buffer.byteLength(text); const checksum = crc32(Buffer.from(text));
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(8, 8); local.writeUInt32LE(checksum, 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(size, 22); local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(8, 10); central.writeUInt32LE(checksum, 16); central.writeUInt32LE(body.length, 20); central.writeUInt32LE(size, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    data.push(local, name, body); directory.push(central, name); offset += local.length + name.length + body.length;
  }
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(Object.keys(members).length, 8); end.writeUInt16LE(Object.keys(members).length, 10); end.writeUInt32LE(directory.reduce((sum, b) => sum + b.length, 0), 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...data, ...directory, end]).toString('base64');
}

describe('restored GRC service workflow acceptance', () => {
  it('imports a real zipped XLSX including shared strings, inline strings and selected worksheet into scoped SoA', async () => {
    const encoded = xlsx({
      'xl/workbook.xml': '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Readme" r:id="r1"/><sheet name="Controls" r:id="r2"/></sheets></workbook>',
      'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Target="worksheets/sheet1.xml" Id="r1"/><Relationship Target="worksheets/sheet2.xml" Id="r2"/></Relationships>',
      'xl/sharedStrings.xml': '<sst><si><t>Control ID</t></si><si><t>Title</t></si><si><t>Description</t></si><si><t>AC-1</t></si><si><r><t>Access </t></r><r><t>policy</t></r></si></sst>',
      'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Read me only</t></is></c></row></sheetData></worksheet>',
      'xl/worksheets/sheet2.xml': '<worksheet><sheetData><row r="1"><c t="s" r="A1"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row><row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" t="s"><v>4</v></c><c r="C2" t="inlineStr"><is><t>R&amp;D &lt;policy&gt;</t></is></c></row></sheetData></worksheet>'
    });
    const imported = await importControlSet({ name: 'Workbook controls', format: 'xlsx', xlsxBase64: encoded, scopeType: 'assessment', scopeId: 'assessment-1' });
    expect(imported.controlSet.controls).toHaveLength(1);
    expect(imported.controlSet.controls[0]).toMatchObject({ controlId: 'AC-1', title: 'Access policy', description: 'R&D <policy>' });
    expect(imported.soaEntries[0]).toMatchObject({ scopeType: 'assessment', scopeId: 'assessment-1', controlId: 'AC-1' });
  });

  it('rejects external XLSX links and XML entities through the complete import path', async () => {
    const members = { 'xl/workbook.xml': '<workbook><sheets><sheet name="Controls" r:id="r1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></sheets></workbook>', 'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="r1" TargetMode="External" Target="https://example.invalid/private"/></Relationships>' };
    await expect(importControlSet({ name: 'Bad workbook', format: 'xlsx', xlsxBase64: xlsx(members) })).rejects.toThrow('relationship');
    members['xl/workbook.xml'] = '<!DOCTYPE workbook [<!ENTITY x SYSTEM "file:///secrets">]><workbook>&x;</workbook>';
    await expect(importControlSet({ name: 'Bad workbook', format: 'xlsx', xlsxBase64: xlsx(members) })).rejects.toThrow('entities');
  });

  it('imports all seven bundled frameworks and preserves control/SoA identities through actual workspace JSON normalization', async () => {
    const ws = createDefaultGrcWorkspace();
    for (const entry of await fetchFrameworkCatalog()) {
      const result = await loadBuiltInFramework({ frameworkKey: entry.frameworkKey });
      ws.controlSets.push(result.controlSet); ws.soaEntries.push(...result.soaEntries);
    }
    const csv = await importControlSet({ name: 'Own controls', format: 'csv', csvText: 'Control ID,Title,Description\nLOCAL-1,"Review, approve","Keep full details"' });
    ws.controlSets.push(csv.controlSet); ws.soaEntries.push(...csv.soaEntries);
    ws.soaEntries[0].implementationStatus = 'implemented';
    ws.soaEntries[0].justification = 'Verified control execution';
    ws.soaEntries[0].evidence = [{ id: 'evidence-1', kind: 'note', name: 'Review record', note: 'Implementation reviewed', createdAt: new Date().toISOString() }];
    const restored = ensureGrcWorkspace(JSON.parse(JSON.stringify(ws)));
    expect(restored.controlSets).toHaveLength(8); expect(restored.soaEntries).toHaveLength(ws.soaEntries.length);
    expect(restored.controlSets.flatMap(c => c.controls).map(c => c.controlId)).toEqual(ws.controlSets.flatMap(c => c.controls).map(c => c.controlId));
    expect(exportSoaCsv(restored)).toContain('LOCAL-1');
    expect(restored.soaEntries[0]).toMatchObject({ implementationStatus: 'implemented', justification: 'Verified control execution', evidence: [{ id: 'evidence-1', note: 'Implementation reviewed' }] });
    const metrics = computeGrcDashboardMetrics(restored); expect(metrics.controlSetCount).toBe(8); expect(metrics.implementedControlCount).toBe(1); expect(metrics.notImplementedControlCount).toBe(restored.soaEntries.length - 1);
  });

  it('scores custom scales, applies scoped appetite, resolves assessments, creates gap tasks and persists implementation changes', () => {
    let ws = ensureGrcWorkspace({ ...createDefaultGrcWorkspace(), assets: [{ id: 'asset-1', name: 'Database', domain: 'it', businessCriticality: 5 }], risks: [{ id: 'risk-1', title: 'Data access', assetIds: ['asset-1'], tierPath: { tier1: 'Business' } }], assessments: [{ id: 'assessment-1', title: 'System review', riskIds: ['risk-1'] }] });
    ws.riskModel.likelihoodScale = [{ id: 'unlikely', label: 'Unlikely', value: 1 }, { id: 'likely', label: 'Likely', value: 4 }];
    ws.riskModel.impactScale = [{ id: 'minor', label: 'Minor', value: 1 }, { id: 'major', label: 'Major', value: 3 }];
    ws.riskModel.matrix = buildRiskMatrix(ws.riskModel.likelihoodScale, ws.riskModel.impactScale, 8);
    expect(ws.riskModel.matrix).toHaveLength(4);
    ws.risks[0].inherentScore = calculateRiskScore(ws.riskModel, 'likely', 'major', ws.config);
    ws.risks[0].residualScore = calculateRiskScore(ws.riskModel, 'unlikely', 'minor', ws.config);
    expect(ws.risks[0].inherentScore.rawScore).toBe(12);
    ws.appetiteRules = [{ id: 'general', name: 'General', thresholdScore: 10 }, { id: 'it', name: 'IT rule', scopeAssetDomain: 'it', thresholdScore: 6 }, { id: 'tier', name: 'Business rule', scopeTier1: 'business', thresholdScore: 4 }];
    expect(resolveRiskAppetite(ws.risks[0], ws)).toBe(4);
    ws = rescoreRisks(ws); expect(ws.risks[0].inherentScore.exceedsAppetite).toBe(true);
    expect(ws.risks[0].residualScore).toMatchObject({ rawScore: 1, exceedsAppetite: false });
    expect(resolveAssessmentRiskIds(ws, [], {})).toContain('risk-1');
    const generated = generateWorkflowTasksFromGaps(ws); expect(generated.addedCount).toBeGreaterThan(0);
    expect(generateWorkflowTasksFromGaps(generated.workspace).addedCount).toBe(0);
    expect(exportPlansCsv(ensureGrcWorkspace(JSON.parse(JSON.stringify(generated.workspace))))).toContain('System review');
  });

  it('produces an actual PDF Blob with report text using the installed PDF generator', async () => {
    const pdf = new jsPDF('p', 'mm', 'a4'); pdf.text('GRC Assessment: controls and residual risk', 12, 12);
    const blob = pdf.output('blob'); expect(blob.type).toBe('application/pdf');
    const text = await blob.text(); expect(text.startsWith('%PDF-')).toBe(true); expect(text).toContain('GRC Assessment: controls and residual risk');
  });
});
