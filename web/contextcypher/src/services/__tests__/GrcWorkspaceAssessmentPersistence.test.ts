import { vulnerableWebAppGrcWorkspace } from '../../data/exampleSystems/vulnerableWebApp';
import { ensureGrcWorkspace } from '../GrcWorkspaceService';

describe('GRC assessment persistence', () => {
  it('preserves assessment workspace fields across JSON save/load round-trip', () => {
    const workspace = JSON.parse(JSON.stringify(vulnerableWebAppGrcWorkspace));
    workspace.assessments[0].threatModel = {
      nodes: [
        {
          id: 'tm-node-1',
          label: 'Internet User',
          sourceType: 'dfd_custom',
          position: { x: 40, y: 80 },
          nodeType: 'dfdActor'
        },
        {
          id: 'tm-node-2',
          label: 'Auth API',
          sourceType: 'diagram_node',
          position: { x: 260, y: 80 },
          diagramNodeId: 'node-auth-api'
        }
      ],
      edges: [
        {
          id: 'tm-edge-1',
          source: 'tm-node-1',
          target: 'tm-node-2',
          sourceType: 'diagram_edge',
          diagramEdgeId: 'edge-auth-login',
          pathOrder: 1,
          commentary: 'Credential stuffing path'
        }
      ],
      updatedAt: '2026-01-01T00:00:00.000Z'
    };

    const savedPayload = JSON.stringify({
      grcWorkspace: workspace
    });

    const loaded = JSON.parse(savedPayload) as { grcWorkspace: unknown };
    const normalized = ensureGrcWorkspace(loaded.grcWorkspace);
    const assessment = normalized.assessments[0];

    expect(assessment).toBeTruthy();
    expect(assessment.title).toBe('E-Commerce Platform Initial Security Assessment');
    expect(assessment.riskIds.length).toBeGreaterThan(0);
    expect(assessment.soaGapIds.length).toBeGreaterThan(0);
    expect(assessment.taskIds.length).toBeGreaterThan(0);
    expect(typeof assessment.findings).toBe('string');
    expect(typeof assessment.recommendations).toBe('string');
    expect(typeof assessment.evidenceSummary).toBe('string');
    expect(assessment.threatModel?.nodes).toHaveLength(2);
    expect(assessment.threatModel?.edges).toHaveLength(1);
    expect(assessment.threatModel?.edges[0]?.diagramEdgeId).toBe('edge-auth-login');
    expect(assessment.threatModel?.edges[0]?.pathOrder).toBe(1);
    expect(assessment.threatModel?.edges[0]?.commentary).toBe('Credential stuffing path');
  });

  it('backfills new assessment fields for older saved workspaces', () => {
    const oldStyle = JSON.parse(JSON.stringify(vulnerableWebAppGrcWorkspace));
    oldStyle.assessments = oldStyle.assessments.map((assessment: any) => {
      const { soaGapIds, taskIds, findings, recommendations, evidenceSummary, threatModel, ...rest } = assessment;
      return rest;
    });

    const normalized = ensureGrcWorkspace(oldStyle);
    const assessment = normalized.assessments[0];

    expect(Array.isArray(assessment.soaGapIds)).toBe(true);
    expect(Array.isArray(assessment.taskIds)).toBe(true);
    expect(assessment.soaGapIds).toHaveLength(0);
    expect(assessment.taskIds).toHaveLength(0);
    expect(assessment.findings).toBeUndefined();
    expect(assessment.recommendations).toBeUndefined();
    expect(assessment.evidenceSummary).toBeUndefined();
    expect(Array.isArray(assessment.threatModel?.nodes)).toBe(true);
    expect(Array.isArray(assessment.threatModel?.edges)).toBe(true);
    expect(assessment.threatModel?.nodes).toHaveLength(0);
    expect(assessment.threatModel?.edges).toHaveLength(0);
  });
});
