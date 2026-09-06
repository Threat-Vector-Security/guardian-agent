import { describe, expect, it } from 'vitest';
import { documentContentFingerprint, preserveExtensions } from '../../web/contextcypher/document-preservation.js';

describe('ContextCypher extension preservation', () => {
  it('keeps hydration caches and view interactions clean while detecting authored changes', () => {
    const loaded = { systemName: 'Saved', nodes: [{ id: 'n', position: { x: 10, y: 20 }, data: { label: 'Server' } }], edges: [{ id: 'e', source: 'n', target: 'n', data: {} }], analysisContext: { customContext: { content: 'Original' } } };
    const viewed = { ...loaded, nodes: [{ ...loaded.nodes[0], selected: true, measured: { width: 100, height: 80 }, draggable: true }], edges: [{ ...loaded.edges[0], data: { sourceNodeSelected: true, targetNodeSelected: false, isDrawingEditMode: false } }], windowLayout: { windows: [{ id: 'opened' }] }, analysisContext: { ...loaded.analysisContext, lastAnalyzedState: { timestamp: Date.now() } } };
    expect(documentContentFingerprint(viewed)).toBe(documentContentFingerprint(loaded));
    expect(documentContentFingerprint({ ...viewed, nodes: [{ ...viewed.nodes[0], position: { x: 11, y: 20 } }] })).not.toBe(documentContentFingerprint(loaded));
    expect(documentContentFingerprint({ ...viewed, grcWorkspace: { risks: [{ id: 'risk', name: 'New risk' }] } })).not.toBe(documentContentFingerprint(loaded));
    expect(documentContentFingerprint({ ...viewed, analysisContext: { customContext: { content: 'Edited' } } })).not.toBe(documentContentFingerprint(loaded));
  });
  it('keeps unknown nested fields without resurrecting deleted records or cleared values', () => {
    const original = { extension: { owner: 'retained' }, assets: [{ id: 'a', name: 'before', extension: 42 }, { id: 'deleted' }], context: 'old' };
    const result = preserveExtensions(original, { assets: [{ id: 'a', name: 'after' }], context: null });
    expect(result).toEqual({ extension: { owner: 'retained' }, assets: [{ id: 'a', name: 'after', extension: 42 }], context: null });
    expect(original.assets[0].name).toBe('before');
  });
  it('ignores dangerous edited object keys', () => {
    const result = preserveExtensions({}, JSON.parse('{"__proto__":{"polluted":true},"safe":1}'));
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(result.safe).toBe(1);
    expect(result.polluted).toBeUndefined();
  });
  it('retains imported analysis and window extensions through an unrelated edit', () => {
    const imported = {
      systemName: 'Imported',
      analysisContext: { customContext: { content: 'Architecture', timestamp: '2026-01-01', extension: { provenance: 'source' } } },
      windowLayout: { extension: true, windows: [{ id: 'editor-1', position: { x: 10, y: 20 }, extension: 'keep' }, { id: 'closed' }] }
    };
    const saved = preserveExtensions(imported, {
      systemName: 'Renamed',
      analysisContext: { customContext: { content: 'Architecture', timestamp: '2026-01-01' } },
      windowLayout: { windows: [{ id: 'editor-1', position: { x: 10, y: 20 } }] }
    });
    expect(saved.analysisContext.customContext.extension).toEqual({ provenance: 'source' });
    expect(saved.windowLayout).toEqual({ extension: true, windows: [{ id: 'editor-1', position: { x: 10, y: 20 }, extension: 'keep' }] });
    expect(saved.systemName).toBe('Renamed');
  });
});
