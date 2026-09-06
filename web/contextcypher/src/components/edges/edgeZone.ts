type ZoneNode = { type?: string; parentId?: string; data?: Record<string, any> };

export function nodeSecurityZone(node: ZoneNode | undefined, lookup: (id: string) => ZoneNode | undefined): string | undefined {
  const ownZone = node?.data?.zone;
  const visited = new Set<ZoneNode>();
  while (node && !visited.has(node)) {
    visited.add(node);
    const zone = node.data?.zoneType || (node.type === 'securityZone' ? node.data?.zone : undefined);
    if (typeof zone === 'string' && zone) return zone;
    node = node.parentId ? lookup(node.parentId) : undefined;
  }
  return typeof ownZone === 'string' && ownZone ? ownZone : undefined;
}

/** Legacy matching zones were copied on connection creation; differing zones remain overrides. */
export function normalizeEdgeZoneData(data: Record<string, any> | undefined, sourceZone?: string): Record<string, any> {
  const original = data || {};
  const mode = original.zoneMode === 'inherit' || original.zoneMode === 'override'
    ? original.zoneMode : !original.zone || original.zone === sourceZone ? 'inherit' : 'override';
  return { ...original, zoneMode: mode, ...(mode === 'inherit' ? { zone: undefined } : {}) };
}

export function edgeZoneColor(data: Record<string, any> | undefined, sourceZone: string | undefined, palette: Record<string, string>, fallback: string): string {
  const zone = data?.zoneMode === 'inherit' || !data?.zone ? sourceZone : data.zone;
  return typeof zone === 'string' && Object.hasOwn(palette, zone) ? palette[zone] : fallback;
}
