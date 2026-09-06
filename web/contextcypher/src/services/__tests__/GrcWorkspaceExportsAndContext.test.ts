import { vulnerableWebAppGrcWorkspace } from '../../data/exampleSystems/vulnerableWebApp';
import {
  buildGrcPromptContext,
  createDefaultAIAssistConfig,
  ensureGrcWorkspace,
  exportFindingsCsv,
  exportRisksCsv,
  exportSoaCsv
} from '../GrcWorkspaceService';

describe('GRC export, persistence, and AI context compatibility', () => {
  it('exports risk and finding data with tier 4 values intact', () => {
    const workspace = JSON.parse(JSON.stringify(vulnerableWebAppGrcWorkspace));
    const now = '2026-02-24T00:00:00.000Z';
    const findingId = 'finding-tier4-export-test';
    const riskId = 'risk-tier4-export-test';

    workspace.findings = workspace.findings || [];
    workspace.risks = workspace.risks || [];

    workspace.findings.push({
      id: findingId,
      title: 'SQLi Input Validation Finding',
      description: 'Input validation gap identified in API boundary.',
      type: 'vulnerability',
      severity: 'high',
      source: 'manual',
      status: 'open',
      relatedNodeIds: [],
      relatedEdgeIds: [],
      linkedRiskIds: [riskId],
      linkedTaskIds: [],
      linkedAssetIds: [],
      recommendations: [],
      createdAt: now,
      updatedAt: now
    });

    const templateRisk = workspace.risks[0];
    workspace.risks.push({
      ...templateRisk,
      id: riskId,
      title: 'API SQL Injection Exposure',
      sourceFindingId: findingId,
      tierPath: {
        ...templateRisk.tierPath,
        tier4: 'SQLi Input Validation Finding'
      },
      createdAt: now,
      updatedAt: now
    });

    const risksCsv = exportRisksCsv(workspace);
    const findingsCsv = exportFindingsCsv(workspace);
    const soaCsv = exportSoaCsv(workspace);

    expect(risksCsv).toContain('Tier 4');
    expect(risksCsv).toContain('SQLi Input Validation Finding');
    expect(findingsCsv).toContain('Finding ID');
    expect(findingsCsv).toContain('SQLi Input Validation Finding');
    expect(soaCsv).toContain('Entry ID');
  });

  it('preserves tier 4 through save/load and still builds AI context', () => {
    const workspace = JSON.parse(JSON.stringify(vulnerableWebAppGrcWorkspace));
    const now = '2026-02-24T00:00:00.000Z';
    const riskId = 'risk-tier4-context-test';

    const templateRisk = workspace.risks[0];
    workspace.risks.push({
      ...templateRisk,
      id: riskId,
      title: 'Tier 4 Context Risk',
      tierPath: {
        ...templateRisk.tierPath,
        tier4: 'Authn Session Hardening'
      },
      createdAt: now,
      updatedAt: now
    });

    const saved = JSON.stringify({ grcWorkspace: workspace });
    const loaded = ensureGrcWorkspace((JSON.parse(saved) as { grcWorkspace: unknown }).grcWorkspace);
    const loadedRisk = loaded.risks.find(risk => risk.id === riskId);

    expect(loadedRisk?.tierPath.tier4).toBe('Authn Session Hardening');

    const aiConfig = {
      ...createDefaultAIAssistConfig(),
      enabled: true,
      includeRisks: true,
      includeFindings: true,
      includeSoaEntries: true
    };
    const promptContext = buildGrcPromptContext(loaded, aiConfig);

    expect(promptContext).toContain('=== GRC WORKSPACE CONTEXT ===');
    expect(promptContext).toContain('RISKS');
    expect(promptContext).toContain('Tier 4 Context Risk');
  });
});
