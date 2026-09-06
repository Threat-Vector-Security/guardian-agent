export interface PanelBounds { left: number; top: number; right: number; bottom: number }

export function fitPanel(position: { x: number; y: number }, size: { width: number; height: number }, bounds: PanelBounds) {
  const width = Math.min(size.width, Math.max(1, bounds.right - bounds.left));
  const height = Math.min(size.height, Math.max(1, bounds.bottom - bounds.top));
  return {
    width, height,
    x: Math.max(bounds.left, Math.min(position.x, bounds.right - width)),
    y: Math.max(bounds.top, Math.min(position.y, bounds.bottom - height))
  };
}
