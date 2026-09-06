const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Preserve extension fields while allowing edited records and deletions to win. */
export function preserveExtensions(original: unknown, edited: unknown): any {
  if (Array.isArray(edited)) {
    if (!Array.isArray(original)) return edited;
    const indexed = new Map(original.filter(record).filter(item => typeof item.id === 'string').map(item => [item.id, item]));
    return edited.map(item => record(item) && typeof item.id === 'string' ? preserveExtensions(indexed.get(item.id), item) : item);
  }
  if (!record(original) || !record(edited)) return edited;
  const result: Record<string, unknown> = { ...original };
  for (const [key, value] of Object.entries(edited)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    result[key] = preserveExtensions(Object.hasOwn(original, key) ? original[key] : undefined, value);
  }
  return result;
}

/** View measurements, selections and derived analysis caches are not authored changes. */
export function documentContentFingerprint(document: Record<string, any>): string {
  const { windowLayout: _layout, analysisContext, nodes, edges, ...content } = document;
  const { lastAnalyzedState: _analysisCache, ...analysis } = analysisContext || {};
  const diagramItems = (items: unknown) => Array.isArray(items) ? items.map(item => {
    if (!record(item)) return item;
    const { selected: _selected, dragging: _dragging, measured: _measured, positionAbsolute: _absolute, selectable: _selectable, draggable: _draggable, focusable: _focusable, data, ...authored } = item;
    if (!record(data)) return { ...authored, data };
    const { sourceNodeSelected: _sourceSelected, targetNodeSelected: _targetSelected, isDrawingEditMode: _drawingMode, _displayModeChanged: _displayMode, ...authoredData } = data;
    return { ...authored, data: authoredData };
  }) : items;
  return JSON.stringify({ ...content, nodes: diagramItems(nodes), edges: diagramItems(edges), analysisContext: analysis });
}
