import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
globalThis.window = { location: new URL('http://localhost:3007'), dispatchEvent() {}, addEventListener() {}, removeEventListener() {} };
globalThis.location = window.location;
const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
const { diagramGenerationService } = await import('../web/contextcypher/src/services/DiagramGenerationService.ts');
const { setGuardianProjectContext } = await import('../web/contextcypher/src/services/guardianApi.ts');
setGuardianProjectContext({ projectId: 'generation-test', revision: 1 });
let graph = {
  id: 'source-id', systemName: 'Preserved system', customContext: 'Original model context',
  metadata: { evidence: 'model draft', unknownMetadata: { retained: true } },
  grcWorkspace: { version: 'test', risks: [{ id: 'risk-preserved' }] },
  attackPaths: [{ id: 'path-preserved', steps: ['one', 'two'] }],
  futureField: { retained: true },
  nodes: [
    { id: 'zone', type: 'securityZone', position: { x: 100, y: 200 }, style: { width: 700, height: 400 }, data: { label: 'Trusted zone', zoneType: 'Internal', customZoneData: 'preserve' } },
    { id: 'one', type: 'workstation', parentId: 'zone', extent: 'parent', position: { x: 40, y: 70 }, width: 180, data: { label: 'Endpoint', securityContext: { threats: [{ id: 'threat-preserved', title: 'Review controls' }] }, vendorData: { assetId: 'keep' } } },
    { id: 'two', type: 'server', parentId: 'zone', extent: 'parent', position: { x: 360, y: 70 }, data: { label: 'Service', properties: { encryption: 'verified elsewhere' } } },
  ],
  edges: [{ id: 'original-edge', source: 'one', target: 'two', sourceHandle: 'source-right', targetHandle: 'target-left', type: 'floating', data: { protocol: 'HTTPS', securityContext: { threats: [{ id: 'edge-threat' }] }, vendorEdgeData: ['preserved'] } }],
};
const calls = [];
globalThis.fetch = async (_url, init) => {
  const body = JSON.parse(init.body); calls.push(body);
  return new Response(JSON.stringify({ result: { document: graph, content: JSON.stringify(graph), provider: 'test', model: 'test', jobId: 'test-job' } }));
};
async function generate() { return diagramGenerationService.generateDiagram({ userContext: 'Generate the supplied architecture', enableMultiPass: true }); }
const expected = structuredClone(graph);
const result = await generate();
assert.equal(result.success, true, result.error);
for (const [key, value] of Object.entries(expected)) assert.deepEqual(result.diagram[key], value, `full graph field ${key} must survive`);
assert.equal(result.diagram.nodes.filter(node => node.type === 'securityZone').length, 1);
assert.equal(result.passesCompleted, 1);
assert.equal(calls.length, 1, 'complete graph should not pass through lossy component improvement/layout');
assert.ok(calls[0].input.context.allowedNodeTypes.includes('securityZone'));
assert.ok(calls[0].input.context.allowedSecurityZones.includes('Internal'));
assert.match(calls[0].input.prompt, /without overlap/);
graph = {
  systemName: 'Legacy components', description: 'Legacy layout input',
  components: [
    { id: 'legacy-one', name: 'Server', type: 'server', zone: 'Internal' },
    { id: 'legacy-two', name: 'Database', type: 'database', zone: 'Internal' },
  ],
  connections: [{ from: 'Server', to: 'Database', label: 'Database query', protocol: 'TLS' }],
  primaryZone: 'Internal', dataClassification: 'Internal', customContext: 'Legacy component context',
};
const legacy = await diagramGenerationService.generateDiagram({ userContext: 'Generate server connected to database', enableMultiPass: false });
assert.equal(legacy.success, true, legacy.error);
assert.ok(legacy.diagram.nodes.some(node => node.id === 'legacy-one'));
assert.ok(legacy.diagram.nodes.some(node => node.id === 'legacy-two'));
assert.ok(legacy.diagram.edges.some(edge => edge.source === 'legacy-one' && edge.target === 'legacy-two'));
for (const invalid of [
  { nodes: [], edges: [] },
  { ...expected, edges: [{ id: 'bad-edge', source: 'one', target: 'missing' }] },
  { ...expected, nodes: expected.nodes.map(node => node.id === 'zone' ? { ...node, parentId: 'one' } : node) },
  { ...expected, nodes: [...expected.nodes, expected.nodes[0]] },
]) {
  graph = invalid;
  const rejected = await generate();
  assert.equal(rejected.success, false);
  assert.equal(rejected.diagram, undefined, 'invalid output must not manufacture a fallback graph');
}
if (process.env.GUARDIAN_REPLAY_GRAPH) {
  graph = JSON.parse(await readFile(process.env.GUARDIAN_REPLAY_GRAPH, 'utf8'));
  const actual = await generate();
  assert.equal(actual.success, true, actual.error);
  for (const [key, value] of Object.entries(graph)) assert.deepEqual(actual.diagram[key], value, `recorded graph field ${key} must survive`);
  console.log(`Recorded graph replay passed: ${graph.nodes.length} nodes, ${graph.edges.length} edges, all source fields preserved.`);
}
const source = await readFile(new URL('../web/contextcypher/src/services/DiagramGenerationService.ts', import.meta.url), 'utf8');
assert.doesNotMatch(source, /Main system component|Generated minimal fallback diagram|generateFallbackConnections/);
console.log('Diagram generation checks passed: complete graph preservation, layout constraints, invalid graph rejection, no manufactured fallback.');
