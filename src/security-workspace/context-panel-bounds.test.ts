import { describe, expect, it } from 'vitest';
import { fitPanel } from '../../web/contextcypher/src/utils/panelBounds.js';

describe('embedded ContextCypher panel bounds', () => {
  it('keeps a dragged panel inside the workspace rather than the browser window', () => {
    expect(fitPanel({ x: 1300, y: 800 }, { width: 420, height: 500 }, { left: 240, top: 64, right: 1100, bottom: 720 })).toEqual({ x: 680, y: 220, width: 420, height: 500 });
  });
  it('shrinks oversized restored panels to retain all controls on narrow workspaces', () => {
    expect(fitPanel({ x: -100, y: -50 }, { width: 800, height: 900 }, { left: 0, top: 50, right: 360, bottom: 600 })).toEqual({ x: 0, y: 50, width: 360, height: 550 });
  });
});
