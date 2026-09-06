import assert from 'node:assert/strict';
import { assetPositions, assetRemovalIds, removeAsset, updateAsset, updateGrcRecord, updateThreat } from './document';
import { asList, asRecord, dateLabel } from './api';

const original = {
  metadata: { vendorExtension: { preserve: ['all', 'values'] } },
  nodes: [{ id: 'a', type: 'vendor-node', position: { x: 5, y: 8 }, custom: 'retained', data: { label: 'Server', unknown: { nested: true }, securityContext: { customAnalysis: 7, threats: [{ id: 't', title: 'Original', vendor: 42 }] } } }, { id: 'b', data: { label: 'Client' } }],
  edges: [{ id: 'e', source: 'a', target: 'b', vendor: 'edge' }],
  grcWorkspace: { schemaVersion: '1.0', riskModel: { custom: true }, risks: [{ id: 'r', title: 'Risk', inherentScore: { rawScore: 16 } }] },
};
const renamed = updateAsset(original, 'a', { label: 'Updated' });
assert.equal(asRecord(asList(renamed.nodes)[0].data).label, 'Updated');
assert.deepEqual(asRecord(asList(renamed.nodes)[0].data).unknown, { nested: true });
assert.equal(asList(renamed.nodes)[0].type, 'vendor-node');
assert.deepEqual(renamed.metadata, original.metadata);
assert.equal(original.nodes[0].data.label, 'Server');
const threat = updateThreat(renamed, 'a', 't', { title: 'Reviewed' });
assert.deepEqual(asList(asRecord(asRecord(asList(threat.nodes)[0].data).securityContext).threats)[0], { id: 't', title: 'Reviewed', vendor: 42 });
assert.equal(asRecord(asRecord(asList(threat.nodes)[0].data).securityContext).customAnalysis, 7);
const risk = updateGrcRecord(threat, 'risks', 'r', { title: 'Reviewed risk' });
assert.deepEqual(asList(asRecord(risk.grcWorkspace).risks)[0].inherentScore, { rawScore: 16 });
assert.deepEqual(asRecord(risk.grcWorkspace).riskModel, { custom: true });
const removed = removeAsset(risk, 'a');
assert.equal(asList(removed.nodes).length, 1);
assert.equal(asList(removed.edges).length, 0);
assert.deepEqual(removed.grcWorkspace, risk.grcWorkspace);
const hierarchy = {
  extension: { preserved: true },
  nodes: [
    { id: 'zone', position: { x: 100, y: 50 } },
    { id: 'service', parentId: 'zone', position: { x: 20, y: 30 }, data: { secretExtension: 'retained' } },
    { id: 'database', parentNode: 'service', position: { x: 5, y: 8 } },
    { id: 'external', position: { x: 600, y: 70 } },
  ],
  edges: [
    { id: 'internal', source: 'service', target: 'database' },
    { id: 'external-link', source: 'database', target: 'external' },
    { id: 'retained-loop', source: 'external', target: 'external', opaque: 'preserved' },
  ],
};
assert.deepEqual([...assetRemovalIds(hierarchy, 'zone')].sort(), ['database', 'service', 'zone']);
const deletedHierarchy = removeAsset(hierarchy, 'zone');
assert.deepEqual(asList(deletedHierarchy.nodes).map(node => node.id), ['external']);
assert.deepEqual(deletedHierarchy.edges, [hierarchy.edges[2]]);
assert.deepEqual(deletedHierarchy.extension, hierarchy.extension);
assert.equal(hierarchy.nodes.length, 4, 'Deletion must not mutate the imported source.');
assert.deepEqual(assetPositions(hierarchy).get('database'), { x: 125, y: 88 });
assert.deepEqual(hierarchy.nodes[2].position, { x: 5, y: 8 }, 'Rendering must preserve relative source geometry.');
const cyclic = { nodes: [{ id: 'a', parentId: 'b' }, { id: 'b', parentId: 'a' }], edges: [] };
assert.equal(assetRemovalIds(cyclic, 'a').size, 2, 'Malformed cyclic hierarchy must terminate.');
assert.equal(assetPositions(cyclic).size, 2);
assert.equal(dateLabel(1760000000000), new Date(1760000000000).toLocaleString());
assert.equal(dateLabel('not-a-date'), 'Not recorded');
console.log('System document preservation checks passed.');
