import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode, type RefObject } from 'react';
import { useTheme } from '@mui/material/styles';
import {
  APP_SHELL_DIMENSIONS,
  PanelPresentation,
  ToolbarDensity,
  ViewportTier,
  getPanelPresentation,
  getResponsivePanelWidths,
  getToolbarDensity,
  getViewportTier
} from '../styles/layout';

interface ViewportSize {
  width: number;
  height: number;
}

const WorkspaceViewport = createContext<ViewportSize | null>(null);

/** Embedded workspaces own their available size; browser viewport remains the standalone fallback. */
export function WorkspaceViewportProvider({ containerRef, children }: { containerRef: RefObject<HTMLElement | null>; children: ReactNode }) {
  const [size, setSize] = useState<ViewportSize | null>(null);
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () => setSize(previous => {
      const next = { width: element.clientWidth, height: element.clientHeight };
      return previous?.width === next.width && previous?.height === next.height ? previous : next;
    });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [containerRef]);
  return createElement(WorkspaceViewport.Provider, { value: size }, children);
}

const getViewportSize = (): ViewportSize => {
  if (typeof window === 'undefined') {
    return { width: 1440, height: 900 };
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight
  };
};

export interface ViewportLayoutState {
  viewport: ViewportSize;
  viewportTier: ViewportTier;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isCompact: boolean;
  toolbarDensity: ToolbarDensity;
  toolboxPresentation: PanelPresentation;
  analysisPresentation: PanelPresentation;
  panelWidths: ReturnType<typeof getResponsivePanelWidths>;
  appShell: typeof APP_SHELL_DIMENSIONS;
}

export const useViewportLayout = (): ViewportLayoutState => {
  const theme = useTheme();
  const workspace = useContext(WorkspaceViewport);
  const [browserViewport, setViewport] = useState<ViewportSize>(getViewportSize);
  const viewport = workspace || browserViewport;

  const isMobile = viewport.width < theme.breakpoints.values.sm;
  const isDesktop = viewport.width >= theme.breakpoints.values.lg;
  const isTablet = !isMobile && !isDesktop;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let rafId: number | null = null;
    const handleResize = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        setViewport(getViewportSize());
      });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  const viewportTier = useMemo(() => getViewportTier(viewport.width), [viewport.width]);
  const panelWidths = useMemo(() => getResponsivePanelWidths(viewport.width), [viewport.width]);
  const toolbarDensity = useMemo(() => getToolbarDensity(viewportTier), [viewportTier]);
  const toolboxPresentation = useMemo(
    () => getPanelPresentation(viewportTier, 'toolbox'),
    [viewportTier]
  );
  const analysisPresentation = useMemo(
    () => getPanelPresentation(viewportTier, 'analysis'),
    [viewportTier]
  );

  return {
    viewport,
    viewportTier,
    isMobile,
    isTablet,
    isDesktop,
    isCompact: !isDesktop,
    toolbarDensity,
    toolboxPresentation,
    analysisPresentation,
    panelWidths,
    appShell: APP_SHELL_DIMENSIONS
  };
};

export default useViewportLayout;
