export type ViewportTier = 'xs' | 'sm' | 'md' | 'lg';
export type PanelPresentation = 'docked' | 'overlay' | 'fullscreen';
export type ToolbarDensity = 'compact' | 'full';

export const APP_SHELL_DIMENSIONS = {
  appBarHeight: 64,
  panelToggleBottomOffset: 38,
  panelToggleMinWidth: 32,
  panelToggleMinHeight: 80,
  floatingWindowBoundsPadding: 10,
  compactToolbarHeight: 56,
  mobileEdgePadding: 12
} as const;

export interface ResponsivePanelWidths {
  toolbox: number;
  analysis: number;
  inspector: number;
  floatingEditor: number;
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

export const getViewportTier = (viewportWidth: number): ViewportTier => {
  if (viewportWidth < 600) return 'xs';
  if (viewportWidth < 900) return 'sm';
  if (viewportWidth < 1200) return 'md';
  return 'lg';
};

export const getToolbarDensity = (tier: ViewportTier): ToolbarDensity => {
  return tier === 'lg' ? 'full' : 'compact';
};

export const getPanelPresentation = (
  tier: ViewportTier,
  panel: 'toolbox' | 'analysis'
): PanelPresentation => {
  if (tier === 'lg') return 'docked';
  if (tier === 'md') {
    return panel === 'toolbox' ? 'docked' : 'overlay';
  }
  return 'fullscreen';
};

export const getResponsivePanelWidths = (viewportWidth: number): ResponsivePanelWidths => {
  const tier = getViewportTier(viewportWidth);

  if (tier === 'xs') {
    return {
      toolbox: clamp(Math.round(viewportWidth * 0.9), 260, 340),
      analysis: clamp(Math.round(viewportWidth * 0.95), 300, 420),
      inspector: clamp(Math.round(viewportWidth * 0.92), 260, 360),
      floatingEditor: clamp(Math.round(viewportWidth * 0.94), 300, 420)
    };
  }

  if (tier === 'sm') {
    return {
      toolbox: clamp(Math.round(viewportWidth * 0.42), 280, 340),
      analysis: clamp(Math.round(viewportWidth * 0.5), 320, 460),
      inspector: clamp(Math.round(viewportWidth * 0.5), 300, 420),
      floatingEditor: clamp(Math.round(viewportWidth * 0.5), 320, 460)
    };
  }

  if (tier === 'md') {
    return {
      toolbox: clamp(Math.round(viewportWidth * 0.32), 280, 340),
      analysis: clamp(Math.round(viewportWidth * 0.42), 340, 480),
      inspector: clamp(Math.round(viewportWidth * 0.45), 320, 440),
      floatingEditor: clamp(Math.round(viewportWidth * 0.42), 360, 500)
    };
  }

  return {
    toolbox: clamp(Math.round(viewportWidth * 0.24), 300, 360),
    analysis: clamp(Math.round(viewportWidth * 0.3), 400, 520),
    inspector: clamp(Math.round(viewportWidth * 0.26), 360, 460),
    floatingEditor: clamp(Math.round(viewportWidth * 0.26), 400, 520)
  };
};
