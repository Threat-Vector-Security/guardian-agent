import { describe, expect, it } from 'vitest';
import { Position, type Node } from '@xyflow/react';
import { edgeNodePosition, getEdgeParams, getNodeIntersectionWithControlPoints } from '../../web/contextcypher/src/components/edges/floatingEdgeUtils.js';

const child = (id: string, parentX: number) => ({
  id, parentId: `zone-${id}`, position: { x: 40, y: 60 },
  measured: { width: 100, height: 100 }, data: {},
  internals: { positionAbsolute: { x: parentX + 40, y: 260 } }
});

describe('grouped diagram floating edges', () => {
  it('anchors children of different zones in absolute canvas coordinates', () => {
    const source = child('source', 0);
    const target = child('target', 1000);
    const result = getEdgeParams(source, target);
    expect(result).toEqual({ sx: 140, sy: 310, tx: 1040, ty: 310, sourcePos: Position.Right, targetPos: Position.Left });
    expect(source.position).toEqual({ x: 40, y: 60 });
    expect(target.position).toEqual({ x: 40, y: 60 });
  });
  it('follows parent movement without changing stored child positions', () => {
    const source = child('source', 300);
    const target = child('target', 1000);
    expect(edgeNodePosition(source)).toEqual({ x: 340, y: 260 });
    expect(getEdgeParams(source, target).sx).toBe(440);
    expect(getNodeIntersectionWithControlPoints(source, target, [{ x: 700, y: 310 }])).toEqual({ x: 440, y: 310 });
    expect(source.position).toEqual({ x: 40, y: 60 });
  });
  it('retains standalone ungrouped node geometry', () => {
    const node: Node = { id: 'plain', position: { x: 12, y: 24 }, data: {} };
    expect(edgeNodePosition(node)).toEqual(node.position);
  });
});
