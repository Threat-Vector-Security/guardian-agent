import { describe, expect, it } from 'vitest';
import { CONTEXT_LIMITS, calculateContextRisk, exportContextCypher, getContextGraph, getLinkedContext, importContextCypher, inspectContextCypher, updateContextDocument, updateContextGraph } from './contextcypher.js';

const document = () => ({
  systemName: 'Workstation model',
  nodes: [{ id: 'endpoint', type: 'server', position: { x: 3, y: 4 }, data: { label: 'Local workstation', unknownPlugin: { enabled: true } } }, { id: 'router', type: 'router' }],
  edges: [{ id: 'connection', source: 'endpoint', target: 'router', data: { protocol: 'HTTPS', controlPoints: [{ x: 5, y: 9 }] } }],
  metadata: { version: '1.0', custom: ['retained', 12, null] },
  drawings: [{ id: 'annotation', text: 'Untrusted notes' }],
  analysisContext: { messageHistory: [{ text: 'Keep original context' }], importedThreatIntel: { raw: '{"unknown":true}' } },
  manualAnalysis: { arbitrarySavedState: [1, { untouched: true }] },
  threatModelUserState: { mitigations: { endpoint: 'review' }, strideOverrides: [] },
  windowLayout: { activeWindowId: 'node:endpoint' },
  grcWorkspace: {
    schemaVersion: '1.0',
    assets: [{ id: 'asset', diagramRefs: [{ diagramId: 'main', nodeId: 'endpoint' }] }],
    findings: [{ id: 'finding', relatedEdgeIds: ['connection'], relatedNodeIds: ['endpoint'], linkedRiskIds: ['risk'] }],
    risks: [{ id: 'risk', assetIds: ['asset'], diagramLinks: [{ diagramId: 'main', nodeIds: ['endpoint'] }] }],
    implementedControls: [{ id: 'control', linkedRiskIds: ['risk'] }],
    soaEntries: [{ id: 'soa', mitigatesRiskIds: ['risk'] }],
    assessments: [{ id: 'assessment', futureField: { preserved: 'yes' } }],
    riskModel: { version: '1.0', likelihoodScale: [{ id: 'likely', value: 4 }, { id: 'max', value: 5 }], impactScale: [{ id: 'major', value: 4 }, { id: 'max', value: 5 }], appetiteThresholdScore: 16 },
  },
});

describe('ContextCypher workspace migration', () => {
  it('round trips every domain and unknown field, with exact original UTF-8 text', () => {
    const text = '\ufeff' + JSON.stringify(document(), null, 4) + '\r\n';
    const imported = importContextCypher(text);
    expect(imported.document).toEqual(document());
    expect(Object.isFrozen(imported.original)).toBe(true);
    expect(imported.original.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(exportContextCypher(imported, 'original')).toBe(text);
    expect(JSON.parse(exportContextCypher(imported, 'contextcypher'))).toEqual(document());
    expect(importContextCypher(exportContextCypher(imported))).toEqual(imported);
  });

  it('edits graph state without changing IDs, unknown domains, or source provenance', () => {
    const imported = importContextCypher(JSON.stringify(document()));
    const graph = getContextGraph(imported);
    graph.nodes[0].position = { x: 100, y: 200 };
    const edited = updateContextGraph(imported, { nodes: graph.nodes });
    expect(edited.document.nodes).not.toEqual(imported.document.nodes);
    expect(edited.document.grcWorkspace).toEqual(imported.document.grcWorkspace);
    expect(edited.original).toEqual(imported.original);
    expect(getContextGraph(edited).nodes.map(node => node.id)).toEqual(['endpoint', 'router']);
    expect(importContextCypher(exportContextCypher(edited)).document).toEqual(edited.document);
    expect(exportContextCypher(edited, 'original')).toBe(JSON.stringify(document()));
  });

  it('supports empty documents and retains future Guardian envelope fields', () => {
    const envelope = importContextCypher('{"nodes":[],"edges":[],"future":{"a":1}}');
    const restored = importContextCypher(JSON.stringify({ ...envelope, futureEnvelope: { ok: true } }));
    expect(inspectContextCypher(restored)).toMatchObject({ valid: true, format: 'guardian-context', nodeCount: 0, edgeCount: 0 });
    expect(JSON.parse(exportContextCypher(updateContextDocument(restored, envelope.document))).futureEnvelope).toEqual({ ok: true });
  });

  it('rejects corrupt provenance and unsupported envelope versions', () => {
    const envelope = importContextCypher(JSON.stringify(document()));
    expect(() => importContextCypher(JSON.stringify({ ...envelope, original: { ...envelope.original, sha256: '0'.repeat(64) } }))).toThrow('integrity');
    expect(() => importContextCypher(JSON.stringify({ ...envelope, version: 2 }))).toThrow('version');
    expect(() => importContextCypher(JSON.stringify({ ...envelope, original: { ...envelope.original, data: envelope.original.data + '\n' } }))).toThrow('integrity');
  });

  it.each([
    { nodes: [{ id: 'x' }, { id: 'x' }], edges: [] },
    { nodes: [{ id: 'x' }], edges: [{ id: 'e', source: 'x', target: 'missing' }] },
    { nodes: [{ id: 'x' }], edges: [{ id: 'e', source: 'x', target: 'x' }, { id: 'e', source: 'x', target: 'x' }] },
    { nodes: [{ id: '' }], edges: [] },
    { nodes: [{ id: 'x', parentId: 'x' }], edges: [] },
    { nodes: [{ id: 'x', parentNode: 'y' }, { id: 'y', parentNode: 'x' }], edges: [] },
    { nodes: {}, edges: [] },
    { grcWorkspace: {} },
  ])('rejects invalid graphs without dropping or repairing data', invalid => {
    expect(inspectContextCypher(invalid).valid).toBe(false);
    expect(() => importContextCypher(JSON.stringify(invalid))).toThrow();
  });

  it('rejects encrypted formats explicitly instead of treating ciphertext as a diagram', () => {
    expect(inspectContextCypher({ encrypted: true, ciphertext: 'opaque' })).toMatchObject({ valid: false, format: 'encrypted' });
    expect(() => importContextCypher('{"encryptedData":"opaque"}')).toThrow('Encrypted workspace');
    expect(() => importContextCypher('opaque binary')).toThrow('plaintext JSON');
  });

  it('rejects prototype keys, accessors, cycles, invalid numbers and excessive nesting', () => {
    expect(() => importContextCypher('{"nodes":[],"edges":[],"metadata":{"__proto__":{"admin":true}}}')).toThrow('unsafe object key');
    expect(() => importContextCypher('{"nodes":[],"edges":[],"n":1e999}')).toThrow('finite JSON');
    let nested: unknown = {};
    for (let i = 0; i < 70; i++) nested = { child: nested };
    expect(inspectContextCypher({ nodes: [], edges: [], nested }).valid).toBe(false);
    const cyclic: Record<string, unknown> = { nodes: [], edges: [] };
    cyclic.self = cyclic;
    expect(inspectContextCypher(cyclic).errors[0]).toContain('cycles');
    let called = false;
    const accessor = Object.defineProperty({ nodes: [], edges: [] }, 'secret', { enumerable: true, get: () => { called = true; return 1; } });
    expect(inspectContextCypher(accessor).valid).toBe(false);
    expect(called).toBe(false);
    expect(inspectContextCypher({ nodes: [], edges: [], sparse: new Array(3) }).valid).toBe(false);
  });

  it('links node and edge context via stored asset, finding and risk references', () => {
    const envelope = importContextCypher(JSON.stringify(document()));
    const linked = getLinkedContext(envelope, { nodeId: 'endpoint', diagramId: 'main' });
    expect(linked.assets.map(item => item.id)).toEqual(['asset']);
    expect(linked.risks.map(item => item.id)).toEqual(['risk']);
    expect(linked.controls.map(item => item.id)).toEqual(['control', 'soa']);
    expect(getLinkedContext(envelope, { edgeId: 'connection' }).findings).toHaveLength(1);
    expect(getLinkedContext(envelope, { nodeId: 'nonexistent' })).toEqual({ assets: [], findings: [], risks: [], controls: [] });
    expect(getLinkedContext(envelope, {})).toEqual({ assets: [], findings: [], risks: [], controls: [] });
  });

  it('rejects oversize documents and graph edits that would strand existing edges', () => {
    expect(() => importContextCypher(JSON.stringify({ nodes: [], edges: [], text: 'x'.repeat(CONTEXT_LIMITS.documentBytes) }))).toThrow('byte limit');
    const envelope = importContextCypher(JSON.stringify(document()));
    expect(() => updateContextGraph(envelope, { nodes: [{ id: 'router' }] })).toThrow('missing source or target');
    expect(getContextGraph(envelope).nodes).toHaveLength(2);
    expect(inspectContextCypher({ nodes: Array.from({ length: CONTEXT_LIMITS.nodes + 1 }, (_, id) => ({ id: String(id) })), edges: [] }).errors[0]).toContain('graph limit');
  });

  it('does not synthesize links from malformed unknown GRC records', () => {
    const envelope = importContextCypher(JSON.stringify({ nodes: [{ id: 'x' }], edges: [], grcWorkspace: { findings: [{ id: null, relatedNodeIds: ['x'] }], risks: [{ id: 'unrelated' }] } }));
    expect(getLinkedContext(envelope, { nodeId: 'x' })).toEqual({ assets: [], findings: [], risks: [], controls: [] });
  });

  it('calculates scores with source thresholds, explicit custom bands and appetite equality', () => {
    const envelope = importContextCypher(JSON.stringify(document()));
    expect(calculateContextRisk(envelope, 'likely', 'major')).toMatchObject({ rawScore: 16, ratingLabel: 'High', exceedsAppetite: true });
    const custom = document();
    const updated = updateContextDocument(envelope, { ...custom, grcWorkspace: { ...custom.grcWorkspace, config: { ratingBands: [{ label: 'Review', minScoreRatio: 0.6, color: '#123456' }, { label: 'Accepted', minScoreRatio: 0, color: '#000000' }] } } });
    expect(calculateContextRisk(updated, 'likely', 'major')).toMatchObject({ rawScore: 16, ratingLabel: 'Review', color: '#123456' });
    expect(() => calculateContextRisk(envelope, 'unknown', 'major')).toThrow('does not exist');
  });
});
