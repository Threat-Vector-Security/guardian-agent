import { describe, expect, it } from 'vitest';
import { edgeZoneColor, nodeSecurityZone, normalizeEdgeZoneData } from '../../web/contextcypher/src/components/edges/edgeZone.js';

const palette = { Internal: '#111111', External: '#222222', Trusted: '#333333' };

describe('automatic edge security zone colors', () => {
  it('migrates source-copied legacy zones once and follows source changes', () => {
    const loaded = normalizeEdgeZoneData({ zone: 'Internal', extension: { keep: true } }, 'Internal');
    expect(loaded).toEqual({ zone: undefined, zoneMode: 'inherit', extension: { keep: true } });
    expect(edgeZoneColor(loaded, 'Internal', palette, '#000')).toBe('#111111');
    expect(edgeZoneColor(loaded, 'External', palette, '#000')).toBe('#222222');
    expect(normalizeEdgeZoneData(loaded, 'External')).toEqual(loaded);
  });
  it('preserves overrides and immediately uses changed overrides and palette colors', () => {
    const loaded = normalizeEdgeZoneData({ zone: 'Trusted' }, 'Internal');
    expect(loaded.zoneMode).toBe('override');
    expect(edgeZoneColor(loaded, 'External', palette, '#000')).toBe('#333333');
    expect(edgeZoneColor({ ...loaded, zone: 'External' }, 'Internal', palette, '#000')).toBe('#222222');
    expect(edgeZoneColor(loaded, 'Internal', { ...palette, Trusted: '#abcdef' }, '#000')).toBe('#abcdef');
    expect(normalizeEdgeZoneData({ zone: 'Internal', zoneMode: 'override' }, 'Internal').zoneMode).toBe('override');
  });
  it('inherits missing zones through a containing zone and handles unavailable zones', () => {
    const zone = { data: { zoneType: 'External' } };
    expect(nodeSecurityZone({ parentId: 'zone', data: {} }, () => zone)).toBe('External');
    const child = { parentId: 'zone', data: { zone: 'Internal' } };
    expect(nodeSecurityZone(child, () => zone)).toBe('External');
    expect(nodeSecurityZone(child, () => ({ data: { zoneType: 'Trusted' } }))).toBe('Trusted');
    expect(edgeZoneColor(normalizeEdgeZoneData(undefined), 'External', palette, '#000')).toBe('#222222');
    expect(edgeZoneColor(undefined, undefined, palette, '#000')).toBe('#000');
  });
});
