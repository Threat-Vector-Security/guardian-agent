import { asList, asRecord, type RecordData } from './api';

/** Change only the intended fields; imported schemas and extension data remain opaque. */
export function updateAsset(document: RecordData, id: string, patch: RecordData): RecordData {
  return { ...document, nodes: asList(document.nodes).map(node => node.id === id ? { ...node, data: { ...asRecord(node.data), ...patch } } : node) };
}

export function updateThreat(document: RecordData, nodeId: string, threatId: string, patch: RecordData): RecordData {
  const node = asList(document.nodes).find(item => item.id === nodeId);
  const context = asRecord(asRecord(node?.data).securityContext);
  return updateAsset(document, nodeId, { securityContext: { ...context, threats: asList(context.threats).map(threat => threat.id === threatId ? { ...threat, ...patch } : threat) } });
}

export function removeAsset(document: RecordData, id: string): RecordData {
  const removed = assetRemovalIds(document, id);
  return { ...document, nodes: asList(document.nodes).filter(node => !removed.has(String(node.id))), edges: asList(document.edges).filter(edge => !removed.has(String(edge.source)) && !removed.has(String(edge.target))) };
}

export function assetRemovalIds(document: RecordData, id: string): Set<string> {
  const children = new Map<string, string[]>();
  for (const node of asList(document.nodes)) {
    const parent = node.parentId ?? node.parentNode;
    if (typeof parent !== 'string') continue;
    children.set(parent, [...(children.get(parent) ?? []), String(node.id)]);
  }
  const removed = new Set<string>();
  const pending = [id];
  while (pending.length) {
    const current = pending.pop()!;
    if (removed.has(current)) continue;
    removed.add(current);
    pending.push(...(children.get(current) ?? []));
  }
  return removed;
}

/** The common renderer uses absolute positions without rewriting imported parent-relative geometry. */
export function assetPositions(document: RecordData): Map<string, { x: number; y: number }> {
  const nodes = new Map(asList(document.nodes).map(node => [String(node.id), node]));
  const result = new Map<string, { x: number; y: number }>();
  for (const [id, node] of nodes) {
    let cursor: RecordData | undefined = node;
    let x = 0;
    let y = 0;
    const visited = new Set<string>();
    while (cursor && !visited.has(String(cursor.id))) {
      visited.add(String(cursor.id));
      const position = asRecord(cursor.position);
      x += typeof position.x === 'number' && Number.isFinite(position.x) ? position.x : 0;
      y += typeof position.y === 'number' && Number.isFinite(position.y) ? position.y : 0;
      cursor = nodes.get(String(cursor.parentId ?? cursor.parentNode));
    }
    result.set(id, { x, y });
  }
  return result;
}

export function updateGrcRecord(document: RecordData, collection: string, id: string, patch: RecordData): RecordData {
  const workspace = asRecord(document.grcWorkspace);
  return { ...document, grcWorkspace: { ...workspace, [collection]: asList(workspace[collection]).map(item => item.id === id ? { ...item, ...patch } : item) } };
}
