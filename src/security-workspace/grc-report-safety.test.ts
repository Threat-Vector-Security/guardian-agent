import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createDefaultGrcWorkspace, ensureGrcWorkspace, generateReportHtml, GRC_REPORT_CATALOG } from '../../web/contextcypher/src/services/GrcWorkspaceService.js';

describe('GRC reports treat imported values as text', () => {
  const unsafe = '<img src=x onerror="alert(1)">';
  const escaped = '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;';
  const label = 'R&D <system> "quoted"';
  const workspace = () => ensureGrcWorkspace({
    ...createDefaultGrcWorkspace(),
    risks: [{ id: 'risk-1', title: label, dueDate: unsafe, owner: unsafe }],
    assessments: [{ id: 'assessment-1', title: label, owner: unsafe, dueDate: unsafe,
      riskManagementPlan: { actions: [{ id: 'action-1', title: label, owner: unsafe, dueDate: unsafe }] } }],
    governanceDocuments: [{ id: 'doc-1', title: label, owner: unsafe, nextReviewDate: unsafe }],
    controlSets: [{ id: 'controlset-1', name: label, version: unsafe, controls: [] }],
    findings: [{ id: 'finding-1', title: label, owner: unsafe, recommendations: [unsafe] }],
    threatActors: [{ id: 'actor-1', name: label, motivation: unsafe }],
    threatScenarios: [{ id: 'scenario-1', title: label, attackTechniques: [unsafe] }]
  });

  it('escapes table/date/detail values across every report exactly once', () => {
    const ws = workspace();
    for (const report of GRC_REPORT_CATALOG) {
      const html = generateReportHtml(report.id, ws);
      expect(html, report.id).not.toContain('<img');
      expect(html, report.id).not.toContain('<system>');
      expect(html, report.id).not.toContain('R&amp;amp;D');
      expect(html, report.id).toContain('R&amp;D &lt;system&gt; &quot;quoted&quot;');
      expect(html, report.id).toContain(escaped);
      expect(html).toContain('http-equiv="Content-Security-Policy"');
      expect(html).toContain("default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'");
    }
  });

  it('escapes imported severity labels while retaining the deliberate badge markup', () => {
    const ws = workspace();
    ws.risks[0].inherentScore.ratingLabel = unsafe;
    const html = generateReportHtml('risk_register', ws);
    expect(html).toContain(`<span class="badge badge-info">${escaped}</span>`);
    expect(html).not.toContain('<img');
  });

  it('does not interpret table-closing markup or already encoded text as HTML', () => {
    const ws = workspace();
    ws.risks[0].dueDate = '</td></tr></table><svg onload="alert(1)">';
    ws.risks[0].title = '&lt;img src=x&gt;';
    const html = generateReportHtml('risk_register', ws);
    expect(html).toContain('&lt;/td&gt;&lt;/tr&gt;&lt;/table&gt;&lt;svg onload=&quot;alert(1)&quot;&gt;');
    expect(html).toContain('&amp;lt;img src=x&amp;gt;');
    expect(html).not.toContain('<svg');
  });

  it('uses the same report generator for export and a sandboxed iframe preview', () => {
    const source = readFileSync(new URL('../../web/contextcypher/src/components/grc/GrcReportingTab.tsx', import.meta.url), 'utf8');
    expect(source).toContain('srcDoc={previewHtml}');
    expect(source).toContain('sandbox=""');
    expect(source).not.toContain('dangerouslySetInnerHTML');
    expect(source.match(/generateReportHtml\(selectedReportId, workspace, sectionHook.sectionConfig\)/g)).toHaveLength(2);
  });
});
