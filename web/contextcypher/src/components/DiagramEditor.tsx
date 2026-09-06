import { saveFile } from '../../../shared/file-dialogs';
// DiagramEditor.tsx
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { debounce } from 'lodash';
import { mergeDiagrams, validateMergedDiagram } from '../utils/diagramMergeUtils';
import { preserveExtensions } from '../../document-preservation';
import { nodeSecurityZone, normalizeEdgeZoneData } from './edges/edgeZone';
import {
  Background,
  Connection,
  Node,
  ReactFlowProvider,
  ReactFlowInstance,
  applyNodeChanges,
  applyEdgeChanges,
  // getRectOfNodes,  // Removed in v12
  // getTransformForBounds,  // Removed in v12
  getNodesBounds,
  NodeChange,
  NodeRemoveChange,
  EdgeChange,
  EdgeRemoveChange,
  EdgeMouseHandler,
  // updateEdge,  // Removed in v12
  Edge,
  // OnEdgeUpdateFunc,  // Type changed in v12
  OnConnectStart,
  OnConnectEnd,
  NodeProps
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import html2canvas from 'html2canvas';

// Import performance optimization utilities
import { useOptimizedNodeHandler } from '../utils/performance/useOptimizedNodeHandler';
import { useOptimizedSelectionHandler } from '../utils/performance/useOptimizedSelectionHandler';
import { useStableCallback, useStableDebounce } from '../utils/performance/useStableCallback';

import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  TextField,
  Tooltip,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Link
} from '@mui/material';

import { Settings as SettingsIcon, ChevronLeft, ChevronRight, Trash2, Eye, EyeOff, Scissors, Box as BoxIcon, X } from 'lucide-react';

// Import all types from SecurityTypes
import {
  SecurityNode,
  SecurityNodeType,
  SecurityZone,
  SecurityNodeData,
  isSecurityZoneNode,
  getZoneDefaults,
  SecurityEdgeData,
  SecurityEdge,
  BaseMetadata,
  defaultSecuritySettings,
  ThreatData
} from '../types/SecurityTypes';

// Local component imports
import NodeToolbox from './NodeToolbox';
import ThreatAnalysisMainPanel from './ThreatAnalysisMainPanel';
import { ThreatAnalysisPanelRef } from './ThreatAnalysisPanel';
import AnalysisPanel from './AnalysisPanel';
import { NodeComponents, nodeTypeConfig } from './SecurityNodes';
import { FreehandNode } from './nodes/FreehandNode';
import { ShapeNode } from './nodes/ShapeNode';
import { TextAnnotationNode } from './nodes/TextAnnotationNode';
import IconOnlyNode from './nodes/IconOnlyNode';
import { serializeNodesForSave, deserializeNodesFromLoad } from '../utils/iconSerialization';
import NodeEditor from './NodeEditor';
import { SettingsDrawer } from './SettingsDrawer';
import EdgeEditor from './EdgeEditor';
import SecurityEdgeComponent from './SecurityEdge';
import QuadraticEdge from './edges/QuadraticEdge';
import EditableSecurityEdge from './edges/EditableSecurityEdge';
import SecurityZoneNode from './SecurityZoneNode';
import { useAnalysisContext } from './AnalysisContextProvider';
import { useManualAnalysis } from '../contexts/ManualAnalysisContext';
import { useSettings } from '../settings/SettingsContext';
import { OnboardingSettings, RecentDiagramFile } from '../types/SettingsTypes';
import { loadSettings, saveSettings } from '../settings/settings';
import ExamplesDropdown from './ExamplesDropdown';
import AutosaveConfirmDialog from './AutosaveConfirmDialog';
import ClearDiagramDialog from './ClearDiagramDialog';
import ImportConfirmDialog from './ImportConfirmDialog';
import { WindowManagerProvider, useWindowManager } from '../contexts/WindowManagerContext';
import WindowManager from './WindowManager';
import QuickInspector from './QuickInspector';
import AttackPathsPanel from './diagram/AttackPathsPanel';
import MethodologyGuidePanel from './diagram/MethodologyGuidePanel';
import DocumentFurniture from './diagram/DocumentFurniture';
import DfdQuickPalette from './diagram/DfdQuickPalette';
import ProcessSpine, { ScopeDialog, SpineStage, formatScopeAsContext, parseScopeFromContext } from './diagram/ProcessSpine';
import GetStartedDialog from './GetStartedDialog';
import { isFeatureEnabled } from '../config/featureFlags';
import { DiagramLensProvider, DiagramLens, DiagramLensState } from '../contexts/DiagramLensContext';
import LensSwitcher, { LensBanner } from './diagram/LensSwitcher';
import ThreatRegisterPanel from './diagram/ThreatRegisterPanel';
import { exportThreatModelAsCode, generateDrawioXml, generateHtmlReport, downloadTextFile } from '../utils/threatModelExport';
import ToolbarMenu from './ToolbarMenu';
import DiagramImportDialog from './DiagramImportDialog';
import { MenuProvider } from '../contexts/MenuContext';
import DiagramEditorWithCopyPaste from './DiagramEditorWithCopyPaste';
import { DiagramEditorInnerHandle } from './DiagramEditorInner';
import { IsometricScene } from './IsometricView/IsometricScene';
import { ToastProvider, useToast } from '../contexts/ToastContext';
import { AutosaveCountdown } from './AutosaveCountdown';
import {
  Save as SaveIconLucide,
  FolderOpen,
  Download,
  Upload,
  Image,
  FileImage,
  FilePlus,
  Undo,
  Redo,
  Copy,
  Clipboard,
  ZoomIn,
  ZoomOut,
  Maximize,
  Grid3x3,
  Map,
  Grid,
  Lock,
  Unlock,
  Info,
  Shield
} from 'lucide-react';
import { AppModuleMode, DiagramAttackPath, DiagramContextSnapshot, GrcWorkspace } from '../types/GrcTypes';
import type { ThreatModelUserState, MitigationStatus, StrideElementOverride } from '../types/ManualAnalysisTypes';
import { DiagramFileActions } from './grc/GrcModule';

// Local style imports
import { colors, getTheme } from '../styles/Theme';
import useViewportLayout from '../hooks/useViewportLayout';
import '../styles/DiagramEditor.css';
import '../styles/ModernStyles.css';

// Local API imports
import { chatWithAnalysisResponse } from '../services/AIRequestService';
import { ChatMessage } from '../types/ChatTypes';
import { DiagramData, AnalysisContext } from '../types/AnalysisTypes';

// Local Service and utility imports
import { getDefaultIconForType } from '../utils/iconUtils';
import { getDefaultShapeForType } from '../utils/shapeDefaults';
import { generateUniqueNodeLabel } from '../utils/labelUtils';
import { getDFDCategoryForNodeType } from '../utils/dfdCategoryMappings';
// Import the initial system data
import { ExampleSystem, exampleSystems, initialSystem } from '../data/exampleSystems';
import { getId } from '../utils/idUtils';
import DrawingLayer, { DrawingTool } from './DrawingLayerComponent';
import { DiagramSanitizer, SanitizationResult } from '../services/ClientDiagramSanitizer';
import { diagramGenerationService } from '../services/DiagramGenerationService';
import { updateEdgeWithIndexCode, migrateEdgeIndexCodes, updateNodesWithIndexCodes, updateEdgesWithIndexCodes } from '../utils/edgeIndexing';
import { controlPointEvents } from '../utils/controlPointEvents';
import { exportDiagramAsTypescript } from '../utils/exportAsTypescript';
import {
  deleteRecentDiagramFileHandle,
  getRecentDiagramFileHandle,
  saveRecentDiagramFileHandle
} from '../services/RecentDiagramFilesService';

// File System API types are defined globally in src/types/file-system-access.d.ts

// Saving Data
interface SavedDiagramData {
  systemName: string;
  nodes: SecurityNode[];
  edges: SecurityEdge[];
  metadata: {
    version: string;
    created: string;
    type: string;
    zoneTypes?: SecurityZone[];
    nodeCount?: number;
    edgeCount?: number;
  };
  analysisContext: {
    messageHistory: ChatMessage[];
    lastAnalyzedState: {
      nodes: SecurityNode[];
      edges: SecurityEdge[];
    } | null;
    customContext?: {
      content: string;
      sanitizedContent: string;
      timestamp: Date;
    };
    importedThreatIntel?: {
      raw: string;
      processed: any;
      metadata: {
        totalImported: number;
        relevantExtracted: number;
        importDate: string;
        source: string;
      };
    };
  };
  zoneConfiguration?: {
    styles: Record<SecurityZone, {
      background?: string;
      opacity?: number;
      zIndex: number;
    }>;
  };
  windowLayout?: {
    windows: Array<{
      id: string;
      type: 'node' | 'edge';
      contentId: string;
      position: { x: number; y: number };
      size: { width: number; height: number };
      isMinimized: boolean;
      zIndex: number;
    }>;
    activeWindowId?: string | null;
  };
  grcWorkspace?: unknown;
  attackPaths?: DiagramAttackPath[];
  threatModelUserState?: ThreatModelUserState;
}

const VALID_RISK_LEVELS = new Set(['Critical', 'High', 'Medium', 'Low', 'Info']);
const VALID_STRIDE = new Set(['Spoofing', 'Tampering', 'Repudiation', 'Information Disclosure', 'Denial of Service', 'Elevation of Privilege']);

const normalizeAttackPaths = (raw: unknown): DiagramAttackPath[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
    .map(item => ({
      ...item,
      id: typeof item.id === 'string' ? item.id : `path-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: typeof item.name === 'string' ? item.name : 'Unnamed Path',
      strideCategory: (typeof item.strideCategory === 'string' && VALID_STRIDE.has(item.strideCategory)
        ? item.strideCategory
        : 'Tampering') as DiagramAttackPath['strideCategory'],
      riskLevel: (typeof item.riskLevel === 'string' && VALID_RISK_LEVELS.has(item.riskLevel)
        ? item.riskLevel
        : 'Medium') as DiagramAttackPath['riskLevel'],
      description: typeof item.description === 'string' ? item.description : '',
      steps: Array.isArray(item.steps)
        ? item.steps
            .filter((s): s is Record<string, unknown> => s !== null && typeof s === 'object')
            .map((s, idx) => ({
              ...s,
              order: typeof s.order === 'number' ? s.order : idx,
              edgeId: typeof s.edgeId === 'string' ? s.edgeId : '',
              sourceNodeId: typeof s.sourceNodeId === 'string' ? s.sourceNodeId : '',
              targetNodeId: typeof s.targetNodeId === 'string' ? s.targetNodeId : '',
              ...(typeof s.technique === 'string' ? { technique: s.technique } : {})
            }))
            .filter(s => s.edgeId && s.sourceNodeId && s.targetNodeId)
        : [],
      ...(Array.isArray(item.mitreTechniques) ? { mitreTechniques: item.mitreTechniques.filter((t: unknown) => typeof t === 'string') } : {}),
      ...(typeof item.pastaStage === 'string' ? { pastaStage: item.pastaStage as unknown as DiagramAttackPath['pastaStage'] } : {}),
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString()
    }));
};

const normalizeThreatModelUserState = (raw: unknown): ThreatModelUserState => {
  const fallback: ThreatModelUserState = { mitigations: {}, strideOverrides: [] };
  if (raw === null || raw === undefined || typeof raw !== 'object') return fallback;
  const obj = raw as Record<string, unknown>;
  const mitigations: ThreatModelUserState['mitigations'] = {};
  if (obj.mitigations && typeof obj.mitigations === 'object' && !Array.isArray(obj.mitigations)) {
    for (const [key, val] of Object.entries(obj.mitigations as Record<string, unknown>)) {
      if (val && typeof val === 'object' && 'status' in val) {
        const v = val as Record<string, unknown>;
        if (typeof v.status === 'string') {
          mitigations[key] = {
            ...v,
            status: v.status as ThreatModelUserState['mitigations'][string]['status'],
            ...(typeof v.notes === 'string' ? { notes: v.notes } : {})
          };
        }
      }
    }
  }
  const strideOverrides: ThreatModelUserState['strideOverrides'] = [];
  if (Array.isArray(obj.strideOverrides)) {
    for (const item of obj.strideOverrides) {
      if (item && typeof item === 'object' && 'elementId' in item && typeof (item as Record<string, unknown>).elementId === 'string') {
        const it = item as Record<string, unknown>;
        strideOverrides.push({
          ...it,
          elementId: it.elementId as string,
          overrides: (it.overrides && typeof it.overrides === 'object' ? it.overrides : {}) as ThreatModelUserState['strideOverrides'][number]['overrides']
        });
      }
    }
  }
  return { ...obj, mitigations, strideOverrides };
};

// suppress ResizeObserver error in development and production
const resizeObserverError = (e: Event) => {
  const errorEvent = e as ErrorEvent;
  if (errorEvent.message && errorEvent.message.includes('ResizeObserver loop completed with undelivered notifications')) {
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }
};

// Handle both error events and unhandled rejections
window.addEventListener('error', resizeObserverError);
window.addEventListener('unhandledrejection', resizeObserverError);

// Additional ResizeObserver polyfill for browser environment
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() { }
    disconnect() { }
    unobserve() { }
  };
}

const DEFAULT_ONBOARDING_STATE: OnboardingSettings = {
  showInitialDiagramPrompt: true,
  tutorialCompleted: false
};

const MAX_RECENT_DIAGRAM_FILES = 8;

const TUTORIAL_STEPS: Array<{ title: string; description: string; tips: string[] }> = [
  {
    title: 'Add security zones and nodes',
    description: 'Open the Node Toolbox and drag/drop security zones plus vendor nodes onto the canvas to build your architecture.',
    tips: [
      'Use the Quick Node Selector (press /) to search for specific services or icons without scrolling.',
      'Drop zones first, then place nodes inside them for cleaner layouts.'
    ]
  },
  {
    title: 'Connect systems and data flows',
    description: 'Click a node handle and drag to another node to create an edge that represents the connection between components.',
    tips: [
      'Switch between smoothstep, linear, or curved edges from the Appearance tab when you want a different style.',
      'Double-click an edge to insert a pivot point so you can reroute it and keep the diagram tidy.'
    ]
  },
  {
    title: 'Open node and edge editors',
    description: 'Double-click a node or edge (or select it and press Enter) to open the editor where you can add metadata, controls, and threat context.',
    tips: [
      'Floating editor windows let you fill out metadata, controls, and evidence without leaving the canvas.',
      'Keep node and edge details up to date so automated analysis has the right context.'
    ]
  },
  {
    title: 'Represent trust boundaries',
    description: 'Use the Security Zone property on nodes and connections to show which trust boundary each component belongs to.',
    tips: [
      'Assign zones like Internet, DMZ, Internal, or Cloud so reviewers immediately see separation of duties.',
      'Color-coded zones make it obvious when data crosses a boundary that needs additional controls.'
    ]
  },
  {
    title: 'Explore more resources',
    description: 'Open the Tutorial tab inside Settings for walkthroughs, and bookmark https://threatvectorsecurity.com/guide/ for the full ContextCypher guide.',
    tips: [
      'Settings → Tutorial includes quick tips, reference cards, and upcoming feature previews.',
      'Use https://threatvectorsecurity.com/guide/ to follow deployment guides, pro tips, and release updates.'
    ]
  }
];


// Helper function to migrate handle IDs from old format to new format
const migrateHandleIds = (edges: SecurityEdge[]): SecurityEdge[] => {
  return edges.map(edge => {
    let sourceHandle = edge.sourceHandle;
    let targetHandle = edge.targetHandle;

    // Migrate old format (e.g., "top-source", "right-target") to new format (e.g., "top", "right")
    if (sourceHandle && (sourceHandle.endsWith('-source') || sourceHandle.endsWith('-target'))) {
      sourceHandle = sourceHandle.replace(/-source|-target$/, '');
    }
    if (targetHandle && (targetHandle.endsWith('-source') || targetHandle.endsWith('-target'))) {
      targetHandle = targetHandle.replace(/-source|-target$/, '');
    }

    // Only return a new object if handles actually changed
    if (sourceHandle !== edge.sourceHandle || targetHandle !== edge.targetHandle) {
      return {
        ...edge,
        sourceHandle,
        targetHandle
      };
    }

    return edge;
  });
};

// DiagramEditor component
export interface GuardianDocumentBridge {
  initialDocument: Record<string, any>;
  onDraftChange: (document: Record<string, any>) => void;
  onSave: (document: Record<string, any>) => Promise<boolean>;
  onImport: (document: Record<string, any>) => Promise<void>;
}

interface DiagramEditorProps {
  guardian?: GuardianDocumentBridge;
  onViewChange?: (view: 'diagram' | 'isometric', diagramData?: { nodes: any[], edges: any[] }) => void;
  onboardingReady?: boolean;
  activeModule?: AppModuleMode;
  onSwitchModule?: (mode: AppModuleMode) => void;
  grcWorkspace?: GrcWorkspace;
  onGrcWorkspaceLoad?: (workspace: unknown) => void;
  onDiagramContextChange?: (snapshot: DiagramContextSnapshot) => void;
  onFileActionsReady?: (actions: DiagramFileActions) => void;
}

const DiagramEditor: React.FC<DiagramEditorProps> = ({
  onViewChange,
  onboardingReady = false,
  activeModule = 'diagram',
  onSwitchModule,
  grcWorkspace,
  onGrcWorkspaceLoad,
  onDiagramContextChange,
  onFileActionsReady,
  guardian
}) => {
  const retainedDocument = useRef<Record<string, any>>(guardian?.initialDocument || {});
  const [guardianLoaded, setGuardianLoaded] = useState(!guardian);
  const guardianRef = useRef(guardian);
  guardianRef.current = guardian;
  const {
    state: analysisState,
    trackChanges,
    addMessage,
    setCustomContext,
    setImportedThreatIntel,
    resetContext,
    clearMessages
  } = useAnalysisContext();
  // clearMessages is available but not currently used

  // Get toast function
  const { showToast } = useToast();

  // Settings for autosave
  const { settings, updateSettings } = useSettings();
  const recentDiagramFiles = settings.recentDiagramFiles || [];
  const { findings: manualFindings, runAnalysis: runManualAnalysis } = useManualAnalysis();
  const currentTheme = getTheme(settings.theme, settings.customTheme);
  const {
    viewport,
    viewportTier,
    toolbarDensity,
    toolboxPresentation,
    analysisPresentation,
    panelWidths,
    appShell
  } = useViewportLayout();
  const responsiveToolboxWidth = Math.round(panelWidths.toolbox);
  const responsiveAnalysisWidth = Math.round(panelWidths.analysis);
  const isDesktopViewport = viewportTier === 'lg';
  const isPhoneViewport = viewportTier === 'xs' || viewportTier === 'sm';
  const isSmallTouchViewport = isPhoneViewport || (viewportTier === 'md' && viewport.height <= 540);
  const isCompactViewport = toolbarDensity === 'compact';
  const allowFloatingEditors = settings.useFloatingWindows !== false && isDesktopViewport;
  const toolbarHeight = isCompactViewport ? appShell.compactToolbarHeight : appShell.appBarHeight;
  const [nodes, setNodes] = useState<SecurityNode[]>([]);
  const [edges, setEdges] = useState<SecurityEdge[]>([]);
  const [currentView, setCurrentView] = useState<'diagram' | 'isometric'>('diagram');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  // Helper function to fit and center the diagram
  const fitDiagram = useCallback(() => {
    if (!reactFlowInstance) return;

    // Get all nodes to check if diagram is empty
    const nodeCount = nodes.length;

    if (nodeCount === 0) {
      // If no nodes, just center the view
      reactFlowInstance.setViewport({ x: 0, y: 0, zoom: 1 });
      return;
    }

    // Fit view with appropriate padding and zoom constraints
    reactFlowInstance.fitView({
      padding: 0.15, // 15% padding around the diagram
      includeHiddenNodes: false,
      minZoom: 0.5, // Don't zoom out too much
      maxZoom: 1.5, // Don't zoom in too much
      duration: 800 // Smooth animation
    });
  }, [reactFlowInstance, nodes.length]);

  // Center diagram only on initial load, not when adding new nodes
  const [hasInitiallyFitted, setHasInitiallyFitted] = useState(false);

  useEffect(() => {
    if (reactFlowInstance && nodes.length > 0 && !hasInitiallyFitted) {
      // Wait slightly longer while edge state is still being staged.
      // This avoids fitting before ReactFlow has measured edge anchors.
      const fitDelay = edges.length > 0 ? 100 : 260;
      const timer = setTimeout(() => {
        fitDiagram();
        setHasInitiallyFitted(true);
      }, fitDelay);
      return () => clearTimeout(timer);
    }
  }, [reactFlowInstance, nodes.length, edges.length, fitDiagram, hasInitiallyFitted]);

  // Debounced tracking for AI context to avoid excessive updates during interactions
  const debouncedTrackChanges = useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    return (data: { nodes: SecurityNode[]; edges: SecurityEdge[] }) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        trackChanges(data);
      }, 250); // 250ms debounce
    };
  }, [trackChanges]);

  const manualAnalysisTimer = useRef<NodeJS.Timeout | null>(null);
  const [attackPaths, setAttackPaths] = useState<DiagramAttackPath[]>([]);
  const [selectedAttackPathId, setSelectedAttackPathId] = useState<string | null>(null);
  const [isPathBuildingMode, setIsPathBuildingMode] = useState(false);
  const [expandedAttackPathIds, setExpandedAttackPathIds] = useState<Set<string>>(new Set());
  const [threatModelUserState, setThreatModelUserState] = useState<ThreatModelUserState>({ mitigations: {}, strideOverrides: [] });

  useEffect(() => {
    if (manualAnalysisTimer.current) {
      clearTimeout(manualAnalysisTimer.current);
    }
    manualAnalysisTimer.current = setTimeout(() => {
      runManualAnalysis({ nodes, edges, attackPaths });
    }, 300);

    return () => {
      if (manualAnalysisTimer.current) {
        clearTimeout(manualAnalysisTimer.current);
      }
    };
  }, [nodes, edges, attackPaths, runManualAnalysis]);
  const [selectedNode, setSelectedNode] = useState<SecurityNode | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Quick Inspector state
  const [quickInspectorItem, setQuickInspectorItem] = useState<SecurityNode | SecurityEdge | null>(null);
  const [quickInspectorPosition, setQuickInspectorPosition] = useState({ x: 0, y: 0 });
  const [showQuickInspector, setShowQuickInspector] = useState(false);
  const quickInspectorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const QUICK_INSPECTOR_DELAY = 1500; // ms delay before showing inspector
  const inspectorHoverRef = useRef(false);
  const isControlPointDragging = useRef(false); // Track control point dragging state

  const handleInspectorMouseEnter = () => {
    inspectorHoverRef.current = true;
    // Cancel any pending hide
    if (quickInspectorTimeoutRef.current) {
      clearTimeout(quickInspectorTimeoutRef.current);
      quickInspectorTimeoutRef.current = null;
    }
  };

  const handleInspectorMouseLeave = () => {
    inspectorHoverRef.current = false;
    // Hide after short delay if not hovering over node/edge anymore
    setTimeout(() => {
      if (!inspectorHoverRef.current) {
        setShowQuickInspector(false);
      }
    }, 200);
  };

  // Snap to grid state - use from settings
  const snapToGrid = settings.snapToGrid ?? true;
  const GRID_SIZE = 50; // Same as in DiagramGenerationService
  const ICON_NODE_SIZE = 50;
  const DEFAULT_GRID_OFFSET = { x: 10, y: -5 };
  const ICON_GRID_OFFSET = { x: -(ICON_NODE_SIZE / 2), y: -(ICON_NODE_SIZE / 2) };

  const isDrawingNodeType = useCallback((nodeType?: string) => {
    if (!nodeType) return false;
    return ['freehand', 'shape', 'textAnnotation'].includes(nodeType);
  }, []);

  const isInspectorEligibleNodeType = useCallback((nodeType?: string) => {
    if (!nodeType) return false;
    return !['securityZone', 'freehand', 'shape', 'textAnnotation'].includes(nodeType);
  }, []);

  const getGridSnapOffset = useCallback((nodeType?: string) => {
    if (settings.nodeDisplayMode !== 'icon') return DEFAULT_GRID_OFFSET;
    if (!nodeType || nodeType === 'securityZone' || isDrawingNodeType(nodeType)) {
      return DEFAULT_GRID_OFFSET;
    }
    return ICON_GRID_OFFSET;
  }, [settings.nodeDisplayMode, isDrawingNodeType]);

  const snapPositionToGrid = useCallback((position: { x: number; y: number }, nodeType?: string) => {
    if (!snapToGrid) return position;
    const offset = getGridSnapOffset(nodeType);
    return {
      x: Math.round(position.x / GRID_SIZE) * GRID_SIZE + offset.x,
      y: Math.round(position.y / GRID_SIZE) * GRID_SIZE + offset.y
    };
  }, [snapToGrid, GRID_SIZE, getGridSnapOffset]);

  const snapNodesToGrid = useCallback((inputNodes: SecurityNode[]) => {
    if (!snapToGrid) return inputNodes;
    return inputNodes.map(node => {
      if (isSecurityZoneNode(node) || isDrawingNodeType(node.type as string)) {
        return node;
      }
      return {
        ...node,
        position: snapPositionToGrid(node.position, node.type as string)
      };
    });
  }, [snapToGrid, snapPositionToGrid, isDrawingNodeType]);

  // Add scroll position preservation for drawer interactions
  const preserveScrollPosition = useCallback(() => {
    // Save the current scroll position in the analysis panel before opening drawers
    if (analysisPanelRef.current) {
      // We don't need to do anything here as the AnalysisPanel now handles its own scroll preservation
      // This is just a placeholder for future drawer interactions that might need coordination
    }
  }, []);

  const handleOpenSettings = useCallback(() => {
    preserveScrollPosition();
    setIsSettingsOpen(true);
  }, [preserveScrollPosition]);

  // Window Manager context - moved up to prevent temporal dead zone
  const windowManager = useWindowManager();

  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
    // No need to restore scroll position here as AnalysisPanel handles it internally
  }, []);

  useEffect(() => {
    if (allowFloatingEditors) return;
    if (!windowManager?.windows?.length) return;

    windowManager.windows.forEach((window) => {
      windowManager.closeWindow(window.id);
    });
  }, [allowFloatingEditors, windowManager]);

  // Listen for deep link events to open settings
  useEffect(() => {
    const handleOpenSettingsEvent = (event: CustomEvent) => {
      setIsSettingsOpen(true);

      // Navigate to specific tab if provided
      if (event.detail?.tab) {
        setTimeout(() => {
          const tab = document.querySelector(`[data-tab="${event.detail.tab}"]`);
          if (tab) {
            (tab as HTMLElement).click();
          }
        }, 300);
      }
    };

    window.addEventListener('open-settings', handleOpenSettingsEvent as EventListener);

    return () => {
      window.removeEventListener('open-settings', handleOpenSettingsEvent as EventListener);
    };
  }, []);

  const [selectedEdge, setSelectedEdge] = useState<SecurityEdge | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const analysisPanelRef = useRef<any>(null);

  // Performance optimization: refs for frequently accessed values
  const nodesRef = useRef<SecurityNode[]>(nodes);
  const edgesRef = useRef<SecurityEdge[]>(edges);
  const selectedNodeRef = useRef<SecurityNode | null>(selectedNode);

  // Keep refs in sync
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    selectedNodeRef.current = selectedNode;
  }, [selectedNode]);
  const threatAnalysisPanelRef = useRef<ThreatAnalysisPanelRef>(null);
  //state for current file
  const [currentFile, setCurrentFile] = useState<{ name: string, handle: FileSystemFileHandle | null }>({
    name: 'untitled.json',
    handle: null
  });

  // State for system name
  const [systemName, setSystemName] = useState<string>('Untitled System');
  const systemNameRef = useRef<string>(systemName);

  useEffect(() => {
    systemNameRef.current = systemName;
  }, [systemName]);

  useEffect(() => {
    if (!onDiagramContextChange) {
      return;
    }

    onDiagramContextChange({
      diagramId: currentFile.name || 'active-diagram',
      systemName,
      nodes: nodes.map(node => ({
        id: node.id,
        type: node.type,
        label: typeof node.data?.label === 'string' ? node.data.label : undefined,
        zone: typeof (node.data as any)?.zone === 'string'
          ? (node.data as any).zone
          : (typeof (node.data as any)?.zoneType === 'string' ? (node.data as any).zoneType : undefined),
        protocols: Array.isArray((node.data as any)?.protocols)
          ? ((node.data as any).protocols as string[])
          : undefined,
        indexCode: typeof (node.data as any)?.indexCode === 'string' ? (node.data as any).indexCode : undefined
      })),
      edges: edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: typeof edge.data?.label === 'string' ? edge.data.label : undefined,
        zone: typeof (edge.data as any)?.zone === 'string' ? (edge.data as any).zone : undefined,
        protocol: typeof (edge.data as any)?.protocol === 'string' ? (edge.data as any).protocol : undefined,
        indexCode: typeof (edge.data as any)?.indexCode === 'string' ? (edge.data as any).indexCode : undefined
      })),
      edgeCount: edges.length,
      attackPaths,
      selectedNodeIds,
      updatedAt: new Date().toISOString()
    });
  }, [currentFile.name, edges, nodes, onDiagramContextChange, selectedNodeIds, systemName, attackPaths]);


  const onboardingPromptSeenRef = useRef(false);
  const [showOnboardingPrompt, setShowOnboardingPrompt] = useState(false);
  const [showTutorialDialog, setShowTutorialDialog] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);

  const persistOnboarding = useCallback((overrides: Partial<OnboardingSettings>) => {
    const currentState = settings.onboarding ?? DEFAULT_ONBOARDING_STATE;
    updateSettings({
      onboarding: {
        ...currentState,
        ...overrides
      }
    });
  }, [settings.onboarding, updateSettings]);

  useEffect(() => {
    if (!onboardingReady) return;
    if (onboardingPromptSeenRef.current) return;
    onboardingPromptSeenRef.current = true;
    setShowOnboardingPrompt(true);
  }, [onboardingReady]);

  // const { drawings } = analysisState; // Drawings are now nodes

  // Autosave dialog state
  const [isAutosaveDialogOpen, setIsAutosaveDialogOpen] = useState(false);

  // Clear diagram dialog state
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);

  // Import dialog state
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<ExampleSystem | null>(null);
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);

  // Clear diagram function (requires dialog state setters above)
  const clearDiagram = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setCustomContext(null);
    setImportedThreatIntel(null);
    setCurrentFile({ name: 'untitled.json', handle: null });
    setSystemName('Untitled System');
    clearMessages();
    if (windowManager && windowManager.windows) {
      windowManager.windows.forEach(window => {
        windowManager.closeWindow(window.id);
      });
    }
    onGrcWorkspaceLoad?.(null);
    setAttackPaths([]);
    setSelectedAttackPathId(null);
    setIsPathBuildingMode(false);
    setThreatModelUserState({ mitigations: {}, strideOverrides: [] });
    setIsClearDialogOpen(false);
  }, [
    setCustomContext,
    setImportedThreatIntel,
    clearMessages,
    windowManager,
    setIsClearDialogOpen,
    onGrcWorkspaceLoad
  ]);

  const handleDismissOnboardingPrompt = useCallback(() => {
    setShowOnboardingPrompt(false);
  }, []);

  const createRecentFileId = useCallback((fileName: string): string => {
    const slug = fileName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    return `${slug || 'diagram'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }, []);

  const removeRecentDiagramFileEntry = useCallback(async (fileId: string) => {
    const nextRecent = recentDiagramFiles.filter(file => file.id !== fileId);
    updateSettings({ recentDiagramFiles: nextRecent });
    await deleteRecentDiagramFileHandle(fileId);
  }, [recentDiagramFiles, updateSettings]);

  const trackRecentDiagramFile = useCallback(async (fileHandle: FileSystemFileHandle | null) => {
    if (!fileHandle) {
      return;
    }

    const newRecentFileId = createRecentFileId(fileHandle.name);
    const persisted = await saveRecentDiagramFileHandle(newRecentFileId, fileHandle);
    if (!persisted) {
      return;
    }

    const now = new Date().toISOString();
    const newEntry: RecentDiagramFile = {
      id: newRecentFileId,
      name: fileHandle.name,
      lastOpenedAt: now
    };

    const withoutSameName = recentDiagramFiles.filter(file => file.name !== fileHandle.name);
    const nextRecent = [newEntry, ...withoutSameName].slice(0, MAX_RECENT_DIAGRAM_FILES);
    const keptIds = new Set(nextRecent.map(file => file.id));
    const removedIds = recentDiagramFiles
      .map(file => file.id)
      .filter(id => !keptIds.has(id));

    updateSettings({ recentDiagramFiles: nextRecent });
    await Promise.all(removedIds.map(id => deleteRecentDiagramFileHandle(id)));
  }, [createRecentFileId, recentDiagramFiles, updateSettings]);

  const ensureRecentFileReadPermission = useCallback(async (fileHandle: FileSystemFileHandle): Promise<boolean> => {
    const permissionHandle = fileHandle as any;

    if (typeof permissionHandle.queryPermission === 'function') {
      const currentPermission = await permissionHandle.queryPermission({ mode: 'read' });
      if (currentPermission === 'granted') {
        return true;
      }
      if (currentPermission === 'denied') {
        return false;
      }
    }

    if (typeof permissionHandle.requestPermission === 'function') {
      const requestedPermission = await permissionHandle.requestPermission({ mode: 'read' });
      return requestedPermission === 'granted';
    }

    return true;
  }, []);

  const handleStartFreshFromOnboarding = useCallback(() => {
    clearDiagram();
    setShowOnboardingPrompt(false);
  }, [clearDiagram]);

  const handleStartTutorial = useCallback(() => {
    setShowOnboardingPrompt(false);
    setShowTutorialDialog(true);
    setTutorialStepIndex(0);
  }, []);

  const handleCloseTutorial = useCallback(() => {
    setShowTutorialDialog(false);
  }, []);

  const openTutorialManually = useCallback(() => {
    setShowTutorialDialog(true);
    setTutorialStepIndex(0);
  }, []);

  const handleNextTutorialStep = useCallback(() => {
    setTutorialStepIndex(prev => Math.min(prev + 1, TUTORIAL_STEPS.length - 1));
  }, []);

  const handlePreviousTutorialStep = useCallback(() => {
    setTutorialStepIndex(prev => Math.max(prev - 1, 0));
  }, []);

  const handleFinishTutorial = useCallback(() => {
    setShowTutorialDialog(false);
    setTutorialStepIndex(0);
    persistOnboarding({
      tutorialCompleted: true
    });
  }, [persistOnboarding]);

  // View state
  const [showGrid, setShowGrid] = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);
  const [showDocumentBlocks, setShowDocumentBlocks] = useState(true);
  const v2OnboardingEnabled = isFeatureEnabled('v2Onboarding');
  const [showQuickPalette, setShowQuickPalette] = useState(v2OnboardingEnabled);
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
  const [isInteractiveLocked, setIsInteractiveLocked] = useState(false);
  const [isDrawingEditMode, setIsDrawingEditMode] = useState(false);
  const [currentDrawingTool, setCurrentDrawingTool] = useState<DrawingTool>('select');
  const [touchMultiSelectMode, setTouchMultiSelectMode] = useState(false);

  // Interactive lock toggle
  const toggleInteractiveLock = useCallback(() => {
    setIsInteractiveLocked(prev => !prev);
  }, []);

  useEffect(() => {
    if (!isSmallTouchViewport || currentView !== 'diagram' || isInteractiveLocked) {
      setTouchMultiSelectMode(false);
    }
  }, [currentView, isInteractiveLocked, isSmallTouchViewport]);

  // Update edges and security nodes when drawing edit mode changes
  useEffect(() => {
    // Update edges
    setEdges(edges => edges.map(edge => ({
      ...edge,
      selectable: !isDrawingEditMode,
      focusable: !isDrawingEditMode,
      // Pass the state to edge data so it can update its styling
      data: {
        ...edge.data,
        isDrawingEditMode
      }
    })));

    // Update nodes based on drawing edit mode
    setNodes(nodes => nodes.map(node => {
      // Check if it's a drawing node by looking at the type string
      const nodeType = node.type as string;
      const isDrawingNode = ['freehand', 'shape', 'textAnnotation'].includes(nodeType);

      if (isDrawingNode) {
        // Drawing nodes are only selectable when in drawing edit mode
        return {
          ...node,
          selectable: isDrawingEditMode,
          draggable: isDrawingEditMode,
          focusable: isDrawingEditMode
        };
      } else {
        // Security nodes are only selectable when NOT in drawing edit mode
        return {
          ...node,
          selectable: !isDrawingEditMode,
          draggable: !isDrawingEditMode,
          focusable: !isDrawingEditMode
        };
      }
    }));
  }, [isDrawingEditMode, setEdges, setNodes]);

  // Center canvas function
  const centerCanvas = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.fitView({ padding: 0.15 });
    }
  }, [reactFlowInstance]);

  // Center on specific node
  const centerOnNode = useCallback((nodeId: string) => {
    if (!reactFlowInstance) return;

    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      const zoom = reactFlowInstance.getZoom();
      reactFlowInstance.setCenter(node.position.x + (node.width || 200) / 2, node.position.y + (node.height || 100) / 2, {
        zoom: zoom, // Maintain current zoom level
        duration: 800
      });
    }
  }, [reactFlowInstance, nodes]);

  const focusNodeNearPanel = useCallback((nodeId: string) => {
    if (!reactFlowInstance) return;
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const zoom = reactFlowInstance.getZoom();
    const viewportHeight = window.innerHeight;
    const nodeX = node.position.x;
    const nodeY = node.position.y + (node.height || 100) / 2;
    const screenX = responsiveToolboxWidth + 50;
    const screenY = viewportHeight / 2;
    reactFlowInstance.setViewport({
      x: screenX - nodeX * zoom,
      y: screenY - nodeY * zoom,
      zoom
    }, { duration: 500 });
  }, [reactFlowInstance, nodes, responsiveToolboxWidth]);

  const selectNodeById = useCallback((nodeId: string) => {
    setNodes(prev => prev.map(node => ({
      ...node,
      selected: node.id === nodeId
    })));
    setEdges(prev => prev.map(edge => ({
      ...edge,
      selected: false
    })));
    setSelectedNodeIds([nodeId]);
  }, [setNodes, setEdges, setSelectedNodeIds]);

  const selectEdgeById = useCallback((edgeId: string) => {
    setNodes(prev => prev.map(node => ({
      ...node,
      selected: false
    })));
    setEdges(prev => prev.map(edge => ({
      ...edge,
      selected: edge.id === edgeId
    })));
    setSelectedNodeIds([]);
  }, [setNodes, setEdges, setSelectedNodeIds]);

  const focusNodeFromFindings = useCallback((nodeId: string) => {
    if (!reactFlowInstance) return;
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    selectNodeById(nodeId);
    const zoom = Math.max(reactFlowInstance.getZoom(), 1.25);
    reactFlowInstance.setCenter(node.position.x + (node.width || 200) / 2, node.position.y + (node.height || 100) / 2, {
      zoom,
      duration: 800
    });
  }, [reactFlowInstance, nodes, selectNodeById]);

  // Center on specific edge
  const centerOnEdge = useCallback((edgeId: string) => {
    if (!reactFlowInstance) return;

    const edge = edges.find(e => e.id === edgeId);
    if (edge) {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);

      if (sourceNode && targetNode) {
        // Calculate center point between source and target
        const centerX = (sourceNode.position.x + targetNode.position.x) / 2 + ((sourceNode.width || 200) + (targetNode.width || 200)) / 4;
        const centerY = (sourceNode.position.y + targetNode.position.y) / 2 + ((sourceNode.height || 100) + (targetNode.height || 100)) / 4;

        const zoom = reactFlowInstance.getZoom();
        reactFlowInstance.setCenter(centerX, centerY, {
          zoom: zoom, // Maintain current zoom level
          duration: 800
        });
      }
    }
  }, [reactFlowInstance, edges, nodes]);

  const focusEdgeFromFindings = useCallback((edgeId: string) => {
    if (!reactFlowInstance) return;
    const edge = edges.find(e => e.id === edgeId);
    if (!edge) return;
    selectEdgeById(edgeId);
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    if (!sourceNode || !targetNode) return;
    const centerX = (sourceNode.position.x + targetNode.position.x) / 2 + ((sourceNode.width || 200) + (targetNode.width || 200)) / 4;
    const centerY = (sourceNode.position.y + targetNode.position.y) / 2 + ((sourceNode.height || 100) + (targetNode.height || 100)) / 4;
    const zoom = Math.max(reactFlowInstance.getZoom(), 1.25);
    reactFlowInstance.setCenter(centerX, centerY, {
      zoom,
      duration: 800
    });
  }, [reactFlowInstance, edges, nodes, selectEdgeById]);


  // Undo/Redo state will be managed in the inner component
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const undoRef = useRef<() => void>(() => { });
  const redoRef = useRef<() => void>(() => { });
  const diagramEditorInnerRef = useRef<DiagramEditorInnerHandle>(null);

  const refreshNodeInternalsAfterCommit = useCallback(
    (fitViewOptions?: { padding?: number; duration?: number }) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          diagramEditorInnerRef.current?.updateAllNodeInternals();

          // Second pass catches late layout measurements (icons/fonts/edge commit).
          setTimeout(() => {
            requestAnimationFrame(() => {
              diagramEditorInnerRef.current?.updateAllNodeInternals();

              if (fitViewOptions && reactFlowInstance) {
                reactFlowInstance.fitView({
                  padding: fitViewOptions.padding ?? 0.1,
                  duration: fitViewOptions.duration ?? 400
                });
              }

              // Third pass: final stabilization after fitView completes and all
              // measurements are settled. This catches edge cases where ResizeObserver
              // fires late or font/icon loading causes dimension changes.
              setTimeout(() => {
                diagramEditorInnerRef.current?.updateAllNodeInternals();
              }, 300);
            });
          }, 120);
        });
      });
    },
    [reactFlowInstance]
  );

  // Update undo/redo state and refs when inner component changes
  useEffect(() => {
    // Use longer polling interval to reduce performance impact
    const interval = setInterval(() => {
      if (diagramEditorInnerRef.current) {
        try {
          const inner = diagramEditorInnerRef.current;
          // Only update state if values actually changed
          setCanUndo(prev => {
            if (prev !== inner.canUndo) return inner.canUndo;
            return prev;
          });
          setCanRedo(prev => {
            if (prev !== inner.canRedo) return inner.canRedo;
            return prev;
          });
          undoRef.current = inner.undo;
          redoRef.current = inner.redo;
        } catch (error) {
          // Ignore errors during initialization in production builds
          // ReactFlow's internal state might not be ready yet
        }
      }
    }, 1000); // Increased interval to 1000ms to reduce CPU usage during dragging

    return () => clearInterval(interval);
  }, []);

  const [nextAutosaveAt, setNextAutosaveAt] = useState<number | null>(null);

  // Refs to store current state for timer access
  const currentFileRef = useRef(currentFile);
  const saveRef = useRef<(() => Promise<void>) | null>(null);

  // Update refs whenever dependencies change
  useEffect(() => {
    currentFileRef.current = currentFile;
  }, [currentFile]);

  const clearEdgeControlPoints = useCallback(() => {
    setEdges((prevEdges) =>
      prevEdges.map((edge) => {
        const data = edge.data as any;
        if (!data?.controlPoints?.length) return edge;
        return {
          ...edge,
          data: {
            ...data,
            controlPoints: []
          }
        };
      })
    );
  }, [setEdges]);

  const edgeTypes = useMemo(() => ({
    securityEdge: EditableSecurityEdge
  }), []);

  const handleChat = async (message: string, context?: AnalysisContext) => {
    console.log('Starting chat request:', {
      messageLength: message.length,
      hasContext: !!context,
      hasCustomContext: !!context?.customContext,
      messageHistoryLength: context?.messageHistory?.length || 0,
      timestamp: new Date().toISOString()
    });

    try {
      // If no context provided, create one from the current diagram state
      let chatContext = context;

      if (!context) {
        // Create diagram data for analysis
        const diagramData: DiagramData = {
          nodes: serializeNodesForSave(nodes),
          edges,
          metadata: {
            version: '1.0',
            lastModified: new Date(),
            // drawings are now nodes
          }
        };
        chatContext = {
          diagram: diagramData,
          customContext: analysisState.customContext,
          // drawings are now nodes,
          messageHistory: analysisState.messageHistory,
          threatIntel: null,
          metadata: {
            timestamp: new Date(),
            version: process.env.REACT_APP_VERSION,
            systemType: 'diagram-analysis',
            isInitialSystem: false,
            customContext: analysisState.customContext ?? undefined,
            environment: process.env.NODE_ENV
          }
        };
      }

      // Ensure chatContext is defined
      if (!chatContext) {
        throw new Error('Failed to create chat context');
      }

      console.log('Chat context prepared:', {
        hasContext: !!chatContext,
        diagramNodes: chatContext.diagram?.nodes?.length || 0,
        diagramEdges: chatContext.diagram?.edges?.length || 0,
        hasCustomContext: !!chatContext.customContext,
        messageHistoryLength: chatContext.messageHistory?.length || 0,
        hasAdditionalContext: !!chatContext.additionalContext
      });

      const response = await chatWithAnalysisResponse(message, chatContext);

      console.log('Chat response received:', {
        hasResponse: !!response,
        hasChoices: !!response?.choices,
        choicesLength: response?.choices?.length || 0,
        timestamp: new Date().toISOString()
      });

      return response;
    } catch (error) {
      console.error('Chat handler error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        type: error?.constructor?.name,
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  };

  const openNodeEditor = useCallback((node: SecurityNode) => {
    if (allowFloatingEditors) {
      const isZoneNode = node.type === 'securityZone';
      const editorWidth = Math.round(panelWidths.floatingEditor);
      windowManager.openWindow({
        id: `node-${node.id}`,
        type: 'node',
        title: `Edit ${node.type}: ${node.data?.label || node.id}`,
        content: node,
        position: windowManager.getNextPosition(),
        size: isZoneNode
          ? { width: editorWidth, height: 420 }
          : { width: editorWidth, height: 680 }
      });
      return;
    }

    setSelectedNode(node);
    setIsEditing(true);
  }, [allowFloatingEditors, panelWidths.floatingEditor, windowManager]);

  const openEdgeEditor = useCallback((edge: SecurityEdge) => {
    if (allowFloatingEditors) {
      const editorWidth = Math.max(340, Math.round(panelWidths.floatingEditor * 0.9));
      windowManager.openWindow({
        id: `edge-${edge.id}`,
        type: 'edge',
        title: `Edit Connection: ${edge.data?.label || edge.id}`,
        content: edge,
        position: windowManager.getNextPosition(),
        size: { width: editorWidth, height: 560 }
      });
      return;
    }

    setSelectedEdge(edge);
    setIsEdgeEditorVisible(true);
  }, [allowFloatingEditors, panelWidths.floatingEditor, windowManager]);

  // Simplified node double click handler
  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: any) => {
    // Ignore double-clicks on drawing nodes (freehand, shape, textAnnotation) only
    if (node.type === 'freehand' || node.type === 'shape' || node.type === 'textAnnotation') {
      return;
    }

    // Clear any pending QuickInspector timeout
    if (quickInspectorTimeoutRef.current) {
      clearTimeout(quickInspectorTimeoutRef.current);
      quickInspectorTimeoutRef.current = null;
    }
    // Hide QuickInspector if it's showing
    setShowQuickInspector(false);
    setQuickInspectorItem(null);

    openNodeEditor(node as SecurityNode);
  }, [openNodeEditor]);

  // Define node types dynamically from nodeTypeConfig
  // This ensures any new nodes added to nodeTypeConfig are automatically available
  // Memoize the security zone component separately to prevent recreation
  const SecurityZoneWrapper = useCallback((props: NodeProps) => (
    <SecurityZoneNode
      {...props}
      data={{
        ...props.data
      }}
    />
  ), []);

  const nodeTypes = useMemo(() => {
    const types: Record<string, React.ComponentType<NodeProps>> = {};

    // Check if we're in icon-only mode
    const isIconMode = settings.nodeDisplayMode === 'icon';

    // Automatically add all nodes from nodeTypeConfig
    Object.keys(nodeTypeConfig).forEach(nodeType => {
      if (isIconMode) {
        // Use IconOnlyNode for all security node types in icon mode
        types[nodeType] = IconOnlyNode;
      } else {
        // Use regular expanded nodes
        const componentName = nodeType.charAt(0).toUpperCase() + nodeType.slice(1) + 'Node';
        if (NodeComponents[componentName]) {
          // Wrap the component to adapt NodeProps to SecurityNodeProps
          types[nodeType] = (props: NodeProps) => {
            const Component = NodeComponents[componentName];
            // Pass isDrawingEditMode to security nodes
            const nodeData = {
              ...props.data,
              isDrawingEditMode
            } as any; // Type assertion needed because ReactFlow NodeProps doesn't match SecurityNodeData exactly
            return <Component id={props.id} data={nodeData} selected={props.selected || false} />;
          };
        }
      }
    });

    // Add the special security zone node (not affected by icon mode)
    types.securityZone = SecurityZoneWrapper;

    // Add drawing node types (not affected by icon mode)
    types.freehand = FreehandNode as React.ComponentType<NodeProps>;
    types.shape = ShapeNode as React.ComponentType<NodeProps>;
    types.textAnnotation = TextAnnotationNode as React.ComponentType<NodeProps>;

    return types;
  }, [SecurityZoneWrapper, isDrawingEditMode, settings.nodeDisplayMode]);

  // Add state logging on render
  useEffect(() => {
    console.log('Editor state changed:', {
      isEditing,
      selectedNode,
      isDialogVisible: isEditing && selectedNode !== null
    });
  }, [isEditing, selectedNode]);

  // Control point event listeners
  useEffect(() => {
    // Make controlPointEvents globally available
    (window as any).controlPointEvents = controlPointEvents;

    // Handle control point click - close QuickInspector
    const handleControlPointClick = () => {
      console.log('Control point clicked - closing QuickInspector');
      setShowQuickInspector(false);
      setQuickInspectorItem(null);
      if (quickInspectorTimeoutRef.current) {
        clearTimeout(quickInspectorTimeoutRef.current);
        quickInspectorTimeoutRef.current = null;
      }
    };

    // Handle control point drag start - prevent QuickInspector
    const handleControlPointDragStart = () => {
      console.log('Control point drag started');
      isControlPointDragging.current = true;
      setShowQuickInspector(false);
      setQuickInspectorItem(null);
      if (quickInspectorTimeoutRef.current) {
        clearTimeout(quickInspectorTimeoutRef.current);
        quickInspectorTimeoutRef.current = null;
      }
    };

    // Handle control point drag end
    const handleControlPointDragEnd = () => {
      console.log('Control point drag ended');
      isControlPointDragging.current = false;
    };

    controlPointEvents.addEventListener('controlpoint-click', handleControlPointClick);
    controlPointEvents.addEventListener('controlpoint-drag-start', handleControlPointDragStart);
    controlPointEvents.addEventListener('controlpoint-drag-end', handleControlPointDragEnd);

    return () => {
      controlPointEvents.removeEventListener('controlpoint-click', handleControlPointClick);
      controlPointEvents.removeEventListener('controlpoint-drag-start', handleControlPointDragStart);
      controlPointEvents.removeEventListener('controlpoint-drag-end', handleControlPointDragEnd);
    };
  }, []);

  const handleEdgeDoubleClick: EdgeMouseHandler = useCallback(
    (event, edge) => {
      console.log('Edge double click:', { edge, time: new Date().toISOString() });
      event.preventDefault();
      event.stopPropagation();

      // Clear any pending QuickInspector timeout
      if (quickInspectorTimeoutRef.current) {
        clearTimeout(quickInspectorTimeoutRef.current);
        quickInspectorTimeoutRef.current = null;
      }
      // Hide QuickInspector if it's showing
      setShowQuickInspector(false);
      setQuickInspectorItem(null);

      openEdgeEditor(edge as SecurityEdge);
    },
    [openEdgeEditor]
  );

  // Add visibility tracking
  const [isEdgeEditorVisible, setIsEdgeEditorVisible] = useState(false);

  useEffect(() => {
    if (selectedEdge) {
      setIsEdgeEditorVisible(true);
      console.log('Opening edge editor:', { selectedEdge, isEdgeEditorVisible: true });
    } else {
      setIsEdgeEditorVisible(false);
    }
  }, [selectedEdge]);

  // Display changes re-measure handles without changing authored positions or connections.
  const prevNodeDisplayMode = useRef(settings.nodeDisplayMode);
  useEffect(() => {
    if (prevNodeDisplayMode.current !== settings.nodeDisplayMode && reactFlowInstance) {
      prevNodeDisplayMode.current = settings.nodeDisplayMode;
      refreshNodeInternalsAfterCommit({ padding: 0.1, duration: 200 });
    }
  }, [settings.nodeDisplayMode, reactFlowInstance, refreshNodeInternalsAfterCommit]);

  const handleEdgeSave = (updatedEdge: SecurityEdge) => {
    console.log('DiagramEditor: handleEdgeSave called with:', {
      id: updatedEdge.id,
      data: updatedEdge.data,
      portRange: updatedEdge.data?.portRange
    });

    // Update the edge with recomputed index code
    const edgeWithUpdatedIndexCode = updateEdgeWithIndexCode(updatedEdge, nodes);

    setEdges(eds => {
      const newEdges = eds.map(edge =>
        edge.id === edgeWithUpdatedIndexCode.id ? edgeWithUpdatedIndexCode : edge
      );
      console.log('DiagramEditor: Updated edges:', newEdges.find(e => e.id === edgeWithUpdatedIndexCode.id));
      return newEdges;
    });
    setSelectedEdge(null);

    // Update QuickInspector if it's showing this edge
    if (quickInspectorItem && 'source' in quickInspectorItem && quickInspectorItem.id === edgeWithUpdatedIndexCode.id) {
      setQuickInspectorItem(edgeWithUpdatedIndexCode);
    }
  };

  // Create a wrapper for closeWindow function for the optimized handler
  const closeWindowsForNodes = useCallback((nodeIds: string[]) => {
    nodeIds.forEach((nodeId) => {
      try {
        windowManager.closeWindow(`node-${nodeId}`);
      } catch { }
    });

    // Close modal editor if it is open for a removed node
    if (selectedNodeRef.current && nodeIds.includes(selectedNodeRef.current.id)) {
      setIsEditing(false);
      setSelectedNode(null);
    }
  }, [windowManager, selectedNodeRef, setIsEditing, setSelectedNode]);

  // Use optimized node handler for better performance
  const onNodesChange = useOptimizedNodeHandler({
    onNodesChange: (changes: NodeChange[]) => {
      // Check for removal changes
      const hasRemovalChanges = changes.some(change => change.type === 'remove');

      // Apply grid snapping to position changes if enabled
      const modifiedChanges = changes.map(change => {
        if (snapToGrid && change.type === 'position' && change.position) {
          // Find the node to check if it's a security zone
          const node = nodesRef.current.find(n => n.id === change.id);
          const isZone = node && isSecurityZoneNode(node);

          // Don't snap security zones, only regular nodes
          if (!isZone) {
            return {
              ...change,
              position: snapPositionToGrid(change.position, node?.type as string)
            };
          }
        }
        return change;
      });

      setNodes((currentNodes) => {
        // Filter out selection changes for security zones that aren't already selectable
        const filteredChanges = modifiedChanges.filter(change => {
          if (change.type === 'select') {
            const node = currentNodes.find(n => n.id === change.id);
            if (node && node.type === 'securityZone' && !node.selectable) {
              return false; // Don't allow this selection change
            }
          }
          return true;
        });

        // Cast nodes to the ReactFlow Node type before applying changes
        const updatedNodes = applyNodeChanges(
          filteredChanges,
          currentNodes as any
        ) as SecurityNode[];

        // Check if any nodes were removed (which would affect index codes)
        if (hasRemovalChanges) {
          // Recompute index codes for all remaining nodes
          return updateNodesWithIndexCodes(updatedNodes);
        }

        return updatedNodes;
      });

      // Track changes after removal
      if (hasRemovalChanges) {
        // Use RAF instead of setTimeout for better performance
        requestAnimationFrame(() => {
          setNodes((currentNodes) => {
            setEdges((currentEdges) => {
              debouncedTrackChanges({ nodes: currentNodes, edges: currentEdges });
              return currentEdges;
            });
            return currentNodes;
          });
        });
      }
    },
    onBeforeRemove: closeWindowsForNodes
  });

  const handleNodeUpdate = useCallback(
    (updatedNode: SecurityNode) => {
      console.log('DiagramEditor: Updating node:', updatedNode.id);
      console.log('DiagramEditor: Received icon data:', {
        icon: 'icon' in updatedNode.data ? updatedNode.data.icon : undefined,
        iconType: 'icon' in updatedNode.data ? typeof updatedNode.data.icon : 'N/A',
        hasIcon: 'icon' in updatedNode.data ? !!updatedNode.data.icon : false
      });

      // Create an updated nodes array so we can use it both for state and for change tracking
      const updatedNodes = nodes.map((node): SecurityNode => {
        if (node.id !== updatedNode.id) return node;

        // --- Zone nodes ---
        if (isSecurityZoneNode(node)) {
          const { icon, ...zoneData } = updatedNode.data as any;

          return {
            ...node,
            type: 'securityZone',
            position: node.position,
            data: {
              ...zoneData,
              zoneType: zoneData.zoneType,
            },
            style: {
              ...(node.style || {}),
              width: (updatedNode.style as any)?.width || (node.style as any)?.width || 400,
              height: (updatedNode.style as any)?.height || (node.style as any)?.height || 300,
              background: (updatedNode.style as any)?.background || (node.style as any)?.background,
              opacity: (updatedNode.style as any)?.opacity || (node.style as any)?.opacity,
              zIndex: (updatedNode.style as any)?.zIndex ?? (node.style as any)?.zIndex ?? -1,
            },
          } as SecurityNode;
        }

        // --- Regular nodes ---
        const nodeData = updatedNode.data as SecurityNodeData;

        // Preserve the icon exactly as provided
        const finalIcon = nodeData.icon;

        console.log('DiagramEditor: Setting final icon:', {
          nodeId: node.id,
          originalIcon: node.data.icon,
          newIcon: finalIcon,
          hasNewIcon: !!finalIcon
        });

        return {
          ...node,
          position: node.position,
          data: {
            ...nodeData,
            icon: finalIcon,
          },
        } as SecurityNode;
      });


      // Update state with recomputed index codes
      const nodesWithUpdatedIndexCodes = updateNodesWithIndexCodes(updatedNodes);
      setNodes(nodesWithUpdatedIndexCodes);

      // Update edges with new index codes since node zones may have changed
      const edgesWithUpdatedIndexCodes = updateEdgesWithIndexCodes(edges, nodesWithUpdatedIndexCodes);
      setEdges(edgesWithUpdatedIndexCodes);

      // Immediately propagate changes to analysis context so prompt contains latest node metadata
      trackChanges({
        nodes: nodesWithUpdatedIndexCodes,
        edges: edgesWithUpdatedIndexCodes,
      });

      // Update QuickInspector if it's showing this node
      if (quickInspectorItem && !('source' in quickInspectorItem) && quickInspectorItem.id === updatedNode.id) {
        const updatedNodeForInspector = nodesWithUpdatedIndexCodes.find(n => n.id === updatedNode.id);
        if (updatedNodeForInspector) {
          setQuickInspectorItem(updatedNodeForInspector);
        }
      }

      // Only close modal dialog if using modal mode
      if (!allowFloatingEditors) {
        setIsEditing(false);
        setSelectedNode(null);
      }
    },
    [allowFloatingEditors, edges, nodes, trackChanges],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      // Check for removals BEFORE applying changes
      const hasRemovalChanges = changes.some(change => change.type === 'remove');
      if (hasRemovalChanges && edges.length > 0) {
        // Capture state BEFORE deletion
        // takeSnapshot is now handled in DiagramEditorInner
      }

      // Close any open editors for edges being removed
      const removedEdgeIds = changes
        .filter((change): change is EdgeRemoveChange => change.type === 'remove')
        .map((change) => change.id);

      if (removedEdgeIds.length > 0) {
        removedEdgeIds.forEach((edgeId) => {
          try {
            windowManager.closeWindow(`edge-${edgeId}`);
          } catch { }
        });

        if (selectedEdge && removedEdgeIds.includes(selectedEdge.id)) {
          setSelectedEdge(null);
          setIsEdgeEditorVisible(false);
        }
      }

      setEdges((currentEdges) => {
        const updatedEdges = applyEdgeChanges(changes, currentEdges);

        // Ensure edges maintain their data and type
        const validatedEdges = updatedEdges.map(edge => ({
          ...edge,
          type: 'securityEdge' as const,
          data: {
            // Preserve ALL existing edge data including indexCode
            ...(edge.data as SecurityEdgeData),
            // Apply defaults only for missing properties
            label: (edge.data as SecurityEdgeData)?.label || 'Connection',
            protocol: (edge.data as SecurityEdgeData)?.protocol || 'HTTPS',
            encryption: (edge.data as SecurityEdgeData)?.encryption || 'TLS 1.3',
            // securityLevel removed - no longer part of SecurityEdgeData
            dataClassification: (edge.data as SecurityEdgeData)?.dataClassification || 'Internal' as const,
            zone: (edge.data as SecurityEdgeData)?.zone || 'Internal' as SecurityZone
          }
        })) as SecurityEdge[];

        // Only track changes for non-selection updates to avoid lag during interactions
        const hasSelectionChanges = changes.some(change => change.type === 'select');
        const hasAddChanges = changes.some(change => change.type === 'add');

        if (!hasSelectionChanges) {
          // Defer tracking to avoid blocking the render
          setTimeout(() => {
            // Get the latest nodes from state
            setNodes((currentNodes) => {
              trackChanges({
                nodes: currentNodes,
                edges: validatedEdges
              });

              // Note: We don't handle 'add' changes here because history is captured
              // BEFORE additions in onConnect for proper undo behavior

              return currentNodes;
            });
          }, 16); // Use RAF timing
        }

        return validatedEdges;
      });
    },
    [nodes, edges, trackChanges, windowManager, selectedEdge]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      const source = params.source ?? '';
      const target = params.target ?? '';

      if (!source || !target) return;

      // Capture state BEFORE creating the new connection for proper undo
      diagramEditorInnerRef.current?.takeSnapshot();

      setNodes(currentNodes => {
        // Generate unique edge ID to support multiple connections between same nodes
        const generateUniqueEdgeId = (edges: SecurityEdge[], source: string, target: string, sourceHandle?: string, targetHandle?: string): string => {
          const baseId = `e${source}-${target}`;

          // Include handle information for additional uniqueness
          const handleSuffix = sourceHandle && targetHandle ? `-${sourceHandle}-${targetHandle}` : '';
          const baseWithHandles = `${baseId}${handleSuffix}`;

          // Check for existing edges with same base pattern
          const existingEdges = edges.filter(edge => edge.id.startsWith(baseWithHandles));

          if (existingEdges.length === 0) {
            return baseWithHandles;
          }

          // Find next available number suffix
          let counter = 1;
          let uniqueId = `${baseWithHandles}-${counter}`;
          while (edges.some(edge => edge.id === uniqueId)) {
            counter++;
            uniqueId = `${baseWithHandles}-${counter}`;
          }

          return uniqueId;
        };

        setEdges(eds => {
          const newEdge: SecurityEdge = {
            ...params,
            source,
            target,
            id: generateUniqueEdgeId(eds, source, target, params.sourceHandle || undefined, params.targetHandle || undefined),
            type: 'securityEdge' as const,
            animated: false,
            data: {
              label: 'Connection',
              protocol: 'none',
              encryption: 'none',
              // securityLevel removed - no longer part of SecurityEdgeData
              dataClassification: 'Public' as const,
              zoneMode: 'inherit'
            },
            sourceHandle: params.sourceHandle || undefined,
            targetHandle: params.targetHandle || undefined,
            style: {
              strokeWidth: 2,
              stroke: colors.primary
            }
          };

          if (process.env.NODE_ENV === 'development') {
            console.log('Creating new edge:', newEdge);
          }

          // Use direct array manipulation instead of addEdge to allow multiple connections
          // between the same source and target handles
          const edgeWithIndexCode = updateEdgeWithIndexCode(newEdge, currentNodes);
          const updatedEdges = [...eds, edgeWithIndexCode];

          if (process.env.NODE_ENV === 'development') {
            console.log('Edge state updated:', {
              previousCount: eds.length,
              newCount: updatedEdges.length,
              addedEdge: edgeWithIndexCode.id,
              indexCode: edgeWithIndexCode.data?.indexCode
            });
          }

          // Use debounced tracking for new edges
          debouncedTrackChanges({
            nodes: currentNodes,
            edges: updatedEdges
          });

          // Note: takeSnapshot is called BEFORE the connection is made,
          // not after, to ensure proper undo behavior

          return updatedEdges;
        });

        return currentNodes; // Return nodes unchanged
      });
    },
    [debouncedTrackChanges, nodes, edges]
  );

  // Debounced edge validation to prevent performance issues during interactions
  const validateEdgesDebounced = useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    return () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (edges.length > 0) {
          const validEdges = edges.filter(edge => {
            const sourceExists = nodes.some(n => n.id === edge.source);
            const targetExists = nodes.some(n => n.id === edge.target);
            const hasValidType = edge.type === 'securityEdge';
            return sourceExists && targetExists && hasValidType;
          });

          if (validEdges.length !== edges.length && validEdges.length >= 0) {
            setEdges(validEdges);
          }
        }
      }, 100); // Debounce validation
    };
  }, [edges, nodes, setEdges]);

  useEffect(() => {
    validateEdgesDebounced();
  }, [validateEdgesDebounced]);

  // Memoize selected nodes and edges to avoid recalculation
  const selectedNodes = useMemo(() => nodes.filter(node => node.selected), [nodes]);
  const selectedEdges = useMemo(() => edges.filter(edge => edge.selected), [edges]);
  const selectedInspectableNodes = useMemo(
    () => selectedNodes.filter((node) => isInspectorEligibleNodeType(node.type as string)),
    [isInspectorEligibleNodeType, selectedNodes]
  );
  const singleInspectorSelection = useMemo<SecurityNode | SecurityEdge | null>(() => {
    if (selectedInspectableNodes.length === 1 && selectedEdges.length === 0) {
      return selectedInspectableNodes[0] as SecurityNode;
    }
    if (selectedInspectableNodes.length === 0 && selectedEdges.length === 1) {
      return selectedEdges[0] as SecurityEdge;
    }
    return null;
  }, [selectedEdges, selectedInspectableNodes]);

  const handleOpenCompactQuickInspector = useCallback(() => {
    if (!singleInspectorSelection) return;

    if (quickInspectorTimeoutRef.current) {
      clearTimeout(quickInspectorTimeoutRef.current);
      quickInspectorTimeoutRef.current = null;
    }

    setQuickInspectorItem(singleInspectorSelection);
    setQuickInspectorPosition({
      x: window.innerWidth * 0.5,
      y: 120
    });
    setShowQuickInspector(true);
  }, [singleInspectorSelection]);

  useEffect(() => {
    if (!isCompactViewport || !showQuickInspector) return;

    if (!quickInspectorItem || !singleInspectorSelection) {
      setShowQuickInspector(false);
      setQuickInspectorItem(null);
      return;
    }

    const isSameType = ('source' in quickInspectorItem) === ('source' in singleInspectorSelection);
    const isSameItem = quickInspectorItem.id === singleInspectorSelection.id;
    if (!isSameType || !isSameItem) {
      setShowQuickInspector(false);
      setQuickInspectorItem(null);
    }
  }, [isCompactViewport, quickInspectorItem, showQuickInspector, singleInspectorSelection]);


  // Memoize security zone calculations
  const securityZoneNodes = useMemo(() => nodes.filter(isSecurityZoneNode), [nodes]);
  const zoneTypes = useMemo(() =>
    Array.from(new Set(securityZoneNodes.map(node => node.data.zoneType))),
    [securityZoneNodes]
  );

  // Optimized selection monitoring with debouncing
  const selectionMonitorDebounced = useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    return () => {
      if (process.env.NODE_ENV === 'development') {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          if (selectedEdges.length > 0 || selectedNodes.length > 0) {
            console.log('Selection update:', {
              selectedEdges: selectedEdges.length,
              selectedNodes: selectedNodes.length
            });
          }
        }, 100);
      }
    };
  }, [selectedEdges, selectedNodes]);

  useEffect(() => {
    selectionMonitorDebounced();
  }, [selectionMonitorDebounced]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      const type = event.dataTransfer.getData('application/reactflow') as SecurityNodeType;
      const zoneType = event.dataTransfer.getData('zoneType') as SecurityZone;

      if (!reactFlowInstance || !reactFlowBounds || !type) {
        return;
      }

      let position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Apply grid snapping to dropped nodes if enabled (but not to security zones)
      if (snapToGrid && type !== 'securityZone') {
        position = snapPositionToGrid(position, type);
      }

      let newNode: SecurityNode;
      if (type === 'securityZone') {
        // For security zones, use zone defaults
        const zoneDefaults = getZoneDefaults(zoneType);
        const zoneColor = colors.zoneColors[zoneType as keyof typeof colors.zoneColors];

        // Generate a unique label for the security zone
        const zoneLabelBase = `${zoneType} Zone`;
        const uniqueZoneLabel = generateUniqueNodeLabel(zoneLabelBase, nodes);

        newNode = {
          id: getId(),
          type: 'securityZone',
          position,
          data: {
            ...zoneDefaults,
            label: uniqueZoneLabel,
            description: `${zoneType} security zone`,
            zoneType: zoneType
          },
          style: {
            width: 400,
            height: 300,
            background: `${zoneColor}40`, // Using 25% opacity (40 in hex)
            zIndex: -1
          },
          selectable: false,
          draggable: false
        };
      } else {
        // For regular nodes, use security defaults from configuration
        const iconDefaults = getDefaultIconForType(type);
        const shapeDefaults = getDefaultShapeForType(type);

        // Check if it's a DFD node type
        const isDFDNode = (type as string).startsWith('dfd');

        // Get defaults - for DFD nodes, use the defaultSecuritySettings which have optional zones
        const nodeDefaults = defaultSecuritySettings[type as keyof typeof defaultSecuritySettings];
        const securityDefaults = nodeDefaults || {
          zone: isDFDNode ? undefined : ('Internal' as SecurityZone),
          dataClassification: 'Internal' as const
        };

        // Generate a unique label for the new node
        const uniqueLabel = generateUniqueNodeLabel(type, nodes);

        // Get DFD categorization if applicable
        const dfdCategory = getDFDCategoryForNodeType(type);

        newNode = {
          id: getId(),
          type,
          position,
          data: {
            ...securityDefaults,
            icon: iconDefaults,
            shape: shapeDefaults,
            label: uniqueLabel,
            // Add DFD categorization if applicable
            ...(dfdCategory && {
              dfdCategory: dfdCategory
            })
          }
        } as SecurityNode;
      }

      // Capture state BEFORE adding the new node for proper undo
      diagramEditorInnerRef.current?.takeSnapshot();

      const updatedNodes = [...nodes, newNode];
      const updatedNodesWithIndexCodes = updateNodesWithIndexCodes(updatedNodes);
      setNodes(updatedNodesWithIndexCodes);
      // Use debounced tracking
      debouncedTrackChanges({
        nodes: updatedNodes,
        edges: edges
      });
    },
    [reactFlowInstance, edges, debouncedTrackChanges, nodes, snapToGrid, GRID_SIZE, snapPositionToGrid]
  );

  const onDragStart = useCallback((
    event: React.DragEvent,
    nodeType: SecurityNodeType,
    zoneType?: SecurityZone
  ) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    if (zoneType) {
      event.dataTransfer.setData('zoneType', zoneType);
    }
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  const onNodeCreate = useCallback((
    nodeType: SecurityNodeType,
    zoneType?: SecurityZone
  ) => {
    if (!reactFlowInstance) return;

    // Get the React Flow container bounds
    const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
    if (!reactFlowBounds) return;

    // On compact viewports place near the center of the canvas for touch-first flows.
    const viewportPosition = isCompactViewport
      ? {
        x: reactFlowBounds.left + reactFlowBounds.width * 0.5,
        y: reactFlowBounds.top + Math.min(220, reactFlowBounds.height * 0.35)
      }
      : {
        x: responsiveToolboxWidth + 50,
        y: 100 // Top margin
      };

    // Convert viewport position to flow position
    let position = reactFlowInstance.screenToFlowPosition(viewportPosition);

    // Apply grid snapping if enabled (but not to security zones)
    if (snapToGrid && nodeType !== 'securityZone') {
      position = snapPositionToGrid(position, nodeType);
    }

    let newNode: SecurityNode;
    if (nodeType === 'securityZone' && zoneType) {
      // For security zones, use zone defaults
      const zoneDefaults = getZoneDefaults(zoneType);
      const zoneColor = colors.zoneColors[zoneType as keyof typeof colors.zoneColors];

      // Generate a unique label for the security zone
      const zoneLabelBase = `${zoneType} Zone`;
      const uniqueZoneLabel = generateUniqueNodeLabel(zoneLabelBase, nodes);

      newNode = {
        id: getId(),
        type: 'securityZone',
        position,
        data: {
          ...zoneDefaults,
          label: uniqueZoneLabel,
          description: `${zoneType} security zone`,
          zoneType: zoneType
        },
        style: {
          width: 400,
          height: 300,
          background: `${zoneColor}40`, // Using 25% opacity (40 in hex)
          zIndex: -1
        },
        selectable: false,
        draggable: false
      };
    } else {
      // For regular nodes, use security defaults from configuration
      const iconDefaults = getDefaultIconForType(nodeType);
      const shapeDefaults = getDefaultShapeForType(nodeType);

      // Check if it's a DFD node type
      const isDFDNode = (nodeType as string).startsWith('dfd');

      // Get defaults - for DFD nodes, use the defaultSecuritySettings which have optional zones
      const nodeDefaults = defaultSecuritySettings[nodeType as keyof typeof defaultSecuritySettings];
      const securityDefaults = nodeDefaults || {
        zone: isDFDNode ? undefined : ('Internal' as SecurityZone),
        dataClassification: 'Internal' as const
      };

      // Generate a unique label for the new node
      const uniqueLabel = generateUniqueNodeLabel(nodeType, nodes);

      // Get DFD categorization if applicable
      const dfdCategory = getDFDCategoryForNodeType(nodeType);

      newNode = {
        id: getId(),
        type: nodeType,
        position,
        data: {
          ...securityDefaults,
          icon: iconDefaults,
          shape: shapeDefaults,
          label: uniqueLabel,
          // Add DFD categorization if applicable
          ...(dfdCategory && {
            dfdCategory: dfdCategory
          })
        }
      } as SecurityNode;
    }

    // Capture state BEFORE adding the new node for proper undo
    diagramEditorInnerRef.current?.takeSnapshot();

    const updatedNodes = [...nodes, newNode];
    const updatedNodesWithIndexCodes = updateNodesWithIndexCodes(updatedNodes);
    setNodes(updatedNodesWithIndexCodes);

    // Use debounced tracking
    debouncedTrackChanges({
      nodes: updatedNodes,
      edges: edges
    });

    // Give canvas focus back on compact devices after quick-add.
    if (!isDesktopViewport) {
      setIsNodeToolboxOpen(false);
    }
  }, [reactFlowInstance, edges, debouncedTrackChanges, nodes, snapToGrid, GRID_SIZE, snapPositionToGrid, responsiveToolboxWidth, isCompactViewport, isDesktopViewport]);

  const onAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const response = await chatWithAnalysisResponse(
        "Please provide a full security analysis of this system architecture.",
        {
          diagram: {
            nodes: serializeNodesForSave(nodes),
            edges,
            metadata: {
              version: '1.0',
              lastModified: new Date(),
              // drawings are now nodes
            }
          },
          customContext: null,
          // drawings are now nodes,
          messageHistory: [],
          threatIntel: null
        }
      );

      addMessage({
        id: Date.now().toString(),
        type: 'analysis',
        content: response.choices[0].message.content,
        timestamp: new Date(),

      });
    } catch (error) {
      console.error('Analysis failed:', error);
      addMessage({
        id: Date.now().toString(),
        type: 'error',
        content: error instanceof Error ? error.message : 'Failed to analyze diagram',
        timestamp: new Date()
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // File System Access API types are defined globally in src/types/file-system-access.d.ts

  // Update your saveAs function
  // Guardian owns durable storage. File export remains an explicit portable copy.
  const guardianDocument = useMemo(() => preserveExtensions(retainedDocument.current, {
    ...retainedDocument.current,
    systemName,
    nodes: serializeNodesForSave(nodes),
    edges,
    metadata: { ...retainedDocument.current.metadata, version: retainedDocument.current.metadata?.version || '1.0', zoneTypes, nodeCount: nodes.length, edgeCount: edges.length },
    analysisContext: {
      ...retainedDocument.current.analysisContext,
      messageHistory: analysisState.messageHistory,
      lastAnalyzedState: analysisState.currentState,
      customContext: analysisState.customContext,
      importedThreatIntel: analysisState.importedThreatIntel
    },
    grcWorkspace,
    attackPaths,
    threatModelUserState,
    zoneConfiguration: {
      ...retainedDocument.current.zoneConfiguration,
      styles: nodes.filter(isSecurityZoneNode).reduce((styles, node) => ({
        ...styles,
        [node.data.zoneType]: {
          ...retainedDocument.current.zoneConfiguration?.styles?.[node.data.zoneType],
          background: node.style?.background, opacity: node.style?.opacity, zIndex: node.style?.zIndex ?? -1
        }
      }), { ...retainedDocument.current.zoneConfiguration?.styles })
    },
    windowLayout: {
      ...retainedDocument.current.windowLayout,
      windows: !allowFloatingEditors ? retainedDocument.current.windowLayout?.windows || [] : windowManager.windows.filter(w => w.type === 'node' || w.type === 'edge').map(w => ({
        id: w.id, type: w.type, contentId: String(w.content.id), position: w.position,
        size: w.size, isMinimized: w.isMinimized, zIndex: w.zIndex
      })),
      activeWindowId: windowManager.activeWindowId
    }
  }), [nodes, edges, systemName, zoneTypes, analysisState, grcWorkspace, attackPaths, threatModelUserState, windowManager.windows, windowManager.activeWindowId, allowFloatingEditors]);

  useEffect(() => {
    if (guardianLoaded) guardianRef.current?.onDraftChange(guardianDocument);
  }, [guardianLoaded, guardianDocument]);

  const saveAs = useCallback(async () => {
    if (guardianRef.current) {
      try {
        const saved = await saveFile(
          `${(systemName || 'system').replace(/[^a-z0-9_-]/gi, '-').slice(0, 100)}.json`,
          new Blob([JSON.stringify(guardianDocument, null, 2)], { type: 'application/json' }),
        );
        if (saved) showToast('Portable system copy saved', 'success');
        return saved;
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to save the system copy', 'error');
        return false;
      }
    }
    if (!reactFlowInstance) return;

    try {
      // Data integrity check - ensure all nodes and edges are consistent
      console.log('[SAVE] Starting data integrity check');

      // Validate nodes
      const validNodes = nodes.filter(node => {
        if (!node || !node.id || !node.type) {
          console.warn('[SAVE] Invalid node found, excluding from save:', node);
          return false;
        }
        return true;
      });

      // Validate edges - ensure both source and target exist
      const nodeIds = new Set(validNodes.map(n => n.id));
      const validEdges = edges.filter(edge => {
        if (!edge || !edge.id || !edge.source || !edge.target) {
          console.warn('[SAVE] Invalid edge found, excluding from save:', edge);
          return false;
        }
        if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
          console.warn('[SAVE] Edge references non-existent node, excluding:', edge);
          return false;
        }
        return true;
      });

      console.log(`[SAVE] Data integrity check complete: ${validNodes.length} nodes, ${validEdges.length} edges`);

      // Debug: Check for edges with control points
      const edgesWithControlPoints = validEdges.filter(edge =>
        edge.data?.controlPoints && edge.data.controlPoints.length > 0
      );
      if (edgesWithControlPoints.length > 0) {
        console.log(`[SAVE] Found ${edgesWithControlPoints.length} edges with control points`);
        edgesWithControlPoints.forEach(edge => {
          console.log(`[SAVE] Edge ${edge.id} has ${edge.data?.controlPoints?.length} control points`);
        });
      }

      const saveData: SavedDiagramData = {
        systemName,
        nodes: serializeNodesForSave(validNodes),
        edges: validEdges,
        metadata: {
          version: '1.0',
          created: new Date().toISOString(),
          type: 'AI Threat Model',
          zoneTypes: zoneTypes,
          // drawings are now nodes,
          nodeCount: validNodes.length,
          edgeCount: validEdges.length
        },
        analysisContext: {
          messageHistory: analysisState.messageHistory,
          lastAnalyzedState: analysisState.currentState ? {
            nodes: analysisState.currentState.nodes as SecurityNode[],
            edges: analysisState.currentState.edges as SecurityEdge[],
            // drawings are now nodes
          } : null,
          customContext: analysisState.customContext ? {
            content: analysisState.customContext.content,
            sanitizedContent: analysisState.customContext.sanitizedContent,
            timestamp: analysisState.customContext.timestamp
          } : undefined,
          importedThreatIntel: analysisState.importedThreatIntel ? {
            raw: analysisState.importedThreatIntel.raw,
            processed: analysisState.importedThreatIntel.processed,
            metadata: analysisState.importedThreatIntel.metadata
          } : undefined
        },
        zoneConfiguration: {
          styles: validNodes
            .filter(isSecurityZoneNode)
            .reduce((styles, node) => ({
              ...styles,
              [node.data.zoneType]: {
                background: node.style?.background,
                opacity: node.style?.opacity,
                zIndex: node.style?.zIndex || -1
              }
            }), {} as Record<SecurityZone, any>)
        },
        windowLayout: {
          windows: windowManager.windows.filter(w => w.type === 'node' || w.type === 'edge').map(w => ({
            id: w.id,
            type: w.type as 'node' | 'edge',
            contentId: String(w.content.id),
            position: w.position,
            size: w.size,
            isMinimized: w.isMinimized,
            zIndex: w.zIndex
          })),
          activeWindowId: windowManager.activeWindowId
        },
        grcWorkspace,
        attackPaths: attackPaths.length > 0 ? attackPaths : undefined,
        threatModelUserState: (Object.keys(threatModelUserState.mitigations).length > 0 || threatModelUserState.strideOverrides.length > 0) ? threatModelUserState : undefined
      };

      const saveWithBrowserDownload = async () => {
        const filename = (systemName || 'threat-model').replace(/[^a-zA-Z0-9\s-_]/g, '').replace(/\s+/g, '-').toLowerCase() + '.json';
        return saveFile(filename, new Blob([JSON.stringify(saveData, null, 2)], { type: 'application/json' }));
      };

      if ('showSaveFilePicker' in window) {
        try {
          const sanitizedSystemName = (systemName || '').replace(/[^a-zA-Z0-9\s-_]/g, '').replace(/\s+/g, '-').toLowerCase();
          const suggestedFilename = sanitizedSystemName ? `${sanitizedSystemName}.json` : 'threat-model.json';

          const handle = await window.showSaveFilePicker({
            suggestedName: suggestedFilename,
            types: [{
              description: 'JSON Files',
              accept: { 'application/json': ['.json'] },
            }],
          });

          const writable = await handle.createWritable();
          await writable.write(JSON.stringify(saveData, null, 2));
          await writable.close();

          // Update current file
          setCurrentFile({
            handle,
            name: handle.name
          });
          void trackRecentDiagramFile(handle);

          addMessage({
            id: Date.now().toString(),
            type: 'response',
            content: `Saved as ${handle.name}`,
            timestamp: new Date()
          });

          // Scroll chat panel to bottom to show the save message
          setTimeout(() => {
            analysisPanelRef.current?.scrollToBottom();
          }, 100);
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            return false;
          }
          throw err;
        }
      } else {
        // The shared helper explicitly offers a browser download when a picker is unavailable.
        return await saveWithBrowserDownload();
      }

      return true; // Indicate successful save

    } catch (err) {
      console.error('Failed to save file:', err);

      // Check if user cancelled
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Save cancelled by user');
        return false; // User cancelled
      }

      addMessage({
        id: Date.now().toString(),
        type: 'response',
        content: 'Failed to save file: ' + (err instanceof Error ? err.message : 'Unknown error'),
        timestamp: new Date()
      });

      // Scroll chat panel to bottom to show the error message
      setTimeout(() => {
        analysisPanelRef.current?.scrollToBottom();
      }, 100);

      return false; // Indicate save failure
    }
  }, [reactFlowInstance, nodes, edges, analysisState, addMessage, systemName, zoneTypes, grcWorkspace, trackRecentDiagramFile, guardianDocument, showToast]);

  // Then declare save which uses saveAs
  const save = useCallback(async () => {
    if (guardianRef.current) return guardianRef.current.onSave(guardianDocument);
    if (!reactFlowInstance || !currentFile.handle) {
      return await saveAs();  // Return the result of saveAs
    }

    try {
      // Data integrity check - same as saveAs
      console.log('[SAVE] Starting data integrity check');

      // Validate nodes
      const validNodes = nodes.filter(node => {
        if (!node || !node.id || !node.type) {
          console.warn('[SAVE] Invalid node found, excluding from save:', node);
          return false;
        }
        return true;
      });

      // Validate edges - ensure both source and target exist
      const nodeIds = new Set(validNodes.map(n => n.id));
      const validEdges = edges.filter(edge => {
        if (!edge || !edge.id || !edge.source || !edge.target) {
          console.warn('[SAVE] Invalid edge found, excluding from save:', edge);
          return false;
        }
        if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
          console.warn('[SAVE] Edge references non-existent node, excluding:', edge);
          return false;
        }
        return true;
      });

      console.log(`[SAVE] Data integrity check complete: ${validNodes.length} nodes, ${validEdges.length} edges`);

      // Debug: Check for edges with control points
      const edgesWithControlPoints = validEdges.filter(edge =>
        edge.data?.controlPoints && edge.data.controlPoints.length > 0
      );
      if (edgesWithControlPoints.length > 0) {
        console.log(`[SAVE] Found ${edgesWithControlPoints.length} edges with control points`);
        edgesWithControlPoints.forEach(edge => {
          console.log(`[SAVE] Edge ${edge.id} has ${edge.data?.controlPoints?.length} control points`);
        });
      }

      const saveData: SavedDiagramData = {
        systemName,
        nodes: serializeNodesForSave(validNodes),
        edges: validEdges,
        metadata: {
          version: '1.0',
          created: new Date().toISOString(),
          type: 'AI Threat Model',
          zoneTypes: zoneTypes,
          // drawings are now nodes,
          nodeCount: validNodes.length,
          edgeCount: validEdges.length
        },
        analysisContext: {
          messageHistory: analysisState.messageHistory,
          lastAnalyzedState: analysisState.currentState ? {
            nodes: analysisState.currentState.nodes as SecurityNode[],
            edges: analysisState.currentState.edges as SecurityEdge[],
            // drawings are now nodes
          } : null,
          customContext: analysisState.customContext ? {
            content: analysisState.customContext.content,
            sanitizedContent: analysisState.customContext.sanitizedContent,
            timestamp: analysisState.customContext.timestamp
          } : undefined,
          importedThreatIntel: analysisState.importedThreatIntel ? {
            raw: analysisState.importedThreatIntel.raw,
            processed: analysisState.importedThreatIntel.processed,
            metadata: analysisState.importedThreatIntel.metadata
          } : undefined
        },
        zoneConfiguration: {
          styles: validNodes
            .filter(isSecurityZoneNode)
            .reduce((styles, node) => ({
              ...styles,
              [node.data.zoneType]: {
                background: node.style?.background,
                opacity: node.style?.opacity,
                zIndex: node.style?.zIndex || -1
              }
            }), {} as Record<SecurityZone, any>)
        },
        windowLayout: {
          windows: windowManager.windows.filter(w => w.type === 'node' || w.type === 'edge').map(w => ({
            id: w.id,
            type: w.type as 'node' | 'edge',
            contentId: String(w.content.id),
            position: w.position,
            size: w.size,
            isMinimized: w.isMinimized,
            zIndex: w.zIndex
          })),
          activeWindowId: windowManager.activeWindowId
        },
        grcWorkspace,
        attackPaths: attackPaths.length > 0 ? attackPaths : undefined,
        threatModelUserState: (Object.keys(threatModelUserState.mitigations).length > 0 || threatModelUserState.strideOverrides.length > 0) ? threatModelUserState : undefined
      };

      // Use the existing file handle to save
      if (currentFile.handle && 'createWritable' in currentFile.handle) {
        const fileHandle = currentFile.handle as FileSystemFileHandle;
        const writable = await (fileHandle as any).createWritable();
        await writable.write(JSON.stringify(saveData, null, 2));
        await writable.close();
      } else {
        throw new Error('File handle does not support writing');
      }

      addMessage({
        id: Date.now().toString(),
        type: 'response',
        content: `Saved to ${currentFile.name}`,
        timestamp: new Date()
      });

      // Scroll chat panel to bottom to show the save message
      setTimeout(() => {
        analysisPanelRef.current?.scrollToBottom();
      }, 100);

      return true; // Indicate successful save

    } catch (err) {
      console.error('Failed to save file:', err);
      addMessage({
        id: Date.now().toString(),
        type: 'response',
        content: 'Failed to save file: ' + (err instanceof Error ? err.message : 'Unknown error'),
        timestamp: new Date()
      });

      // Scroll chat panel to bottom to show the error message
      setTimeout(() => {
        analysisPanelRef.current?.scrollToBottom();
      }, 100);

      return false; // Indicate save failure
    }
  }, [reactFlowInstance, currentFile, nodes, edges, analysisState, addMessage, saveAs, systemName, zoneTypes, grcWorkspace, guardianDocument]);

  // Update save ref when save function changes
  useEffect(() => {
    saveRef.current = async () => {
      await save();
    };
  }, [save]);

  // Expose file actions to parent (for GRC module shared menus)
  const loadExampleSystemRef = useRef<((example: ExampleSystem) => void) | null>(null);
  const onLoadRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (onFileActionsReady) {
      onFileActionsReady({
        save: async () => { await save(); },
        saveAs: async () => { await saveAs(); },
        open: () => { onLoadRef.current?.(); },
        loadExample: (example: ExampleSystem) => { loadExampleSystemRef.current?.(example); },
        getCurrentDiagram: () => ({
          nodes: nodesRef.current,
          edges: edgesRef.current,
          metadata: {
            version: '1.0',
            lastModified: new Date()
          }
        }),
        getSystemName: () => systemNameRef.current,
        setSystemName: (name: string) => {
          setSystemName(name);
        }
      });
    }
  }, [onFileActionsReady, save, saveAs]);

  // Autosave functionality
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleAutosaveConfirm = useCallback(async () => {
    setIsAutosaveDialogOpen(false);
    try {
      const saved = guardianRef.current ? await save() : await saveAs();
      if (saved) console.log('Autosave confirmed');
    } catch (error) {
      console.error('Autosave Save As failed:', error);
    }
  }, [save, saveAs]);

  const handleAutosaveCancel = useCallback(() => {
    setIsAutosaveDialogOpen(false);
    console.log('Autosave cancelled by user');
  }, []);

  useEffect(() => {
    console.log('Autosave useEffect triggered', {
      enabled: settings.autosave.enabled,
      intervalMinutes: settings.autosave.intervalMinutes,
      hasTimers: !!autosaveTimerRef.current
    });

    // Clear any existing timers
    if (autosaveTimerRef.current) {
      console.log('Clearing existing autosave timer');
      clearInterval(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    // Countdown timer removed - now handled in AutosaveCountdown component

    // Guardian project autosave is owned by ProjectWorkbench's revision-checked save flow.
    // This timer only owns standalone files.
    if (settings.autosave.enabled && !guardianRef.current) {
      const intervalMs = settings.autosave.intervalMinutes * 60 * 1000;

      setNextAutosaveAt(Date.now() + intervalMs);

      // Start autosave timer - use ref to access current state
      autosaveTimerRef.current = setInterval(async () => {
        setNextAutosaveAt(Date.now() + intervalMs);
        try {
          console.log('Autosave timer fired - checking current file state');
          const currentFileState = currentFileRef.current;

          console.log('Current file state:', { hasHandle: !!currentFileState.handle, fileName: currentFileState.name });

          // Execute autosave logic
          if (currentFileState.handle) {
            console.log('Autosave: Saving to existing file');
            if (saveRef.current) {
              await saveRef.current();
              console.log('Autosave completed');
            }
          } else {
            console.log('Autosave: No existing file, showing dialog');
            setIsAutosaveDialogOpen(true);
          }
        } catch (error) {
          console.error('Autosave timer error:', error);
        }
      }, intervalMs);

      console.log(`Autosave timer started: ${settings.autosave.intervalMinutes} minute intervals`);
    } else {
      setNextAutosaveAt(null);
    }

    // Cleanup on unmount or settings change
    return () => {
      if (autosaveTimerRef.current) {
        clearInterval(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [settings.autosave.enabled, settings.autosave.intervalMinutes]);

  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      debouncedTrackChanges({ nodes, edges });
    }
  }, [nodes, edges, debouncedTrackChanges]);

  // Update edge data when selected nodes change
  // Use a ref to track if we're currently dragging to avoid updates during drag
  const isDraggingRef = useRef(false);

  useEffect(() => {
    // Skip edge updates if we're dragging
    if (isDraggingRef.current) return;

    // Debounce edge updates to avoid too frequent changes
    const timeoutId = setTimeout(() => {
      if (selectedNodeIds.length === 0) {
        // No nodes selected, remove animation data from all edges
        setEdges(prevEdges =>
          prevEdges.map(edge => ({
            ...edge,
            data: {
              ...edge.data,
              sourceNodeSelected: false,
              targetNodeSelected: false
            }
          }))
        );
      } else {
        // Update edges with selection state
        setEdges(prevEdges =>
          prevEdges.map(edge => ({
            ...edge,
            data: {
              ...edge.data,
              sourceNodeSelected: selectedNodeIds.includes(edge.source),
              targetNodeSelected: selectedNodeIds.includes(edge.target)
            }
          }))
        );
      }
    }, 10); // Reduced delay for more responsive edge animations

    return () => clearTimeout(timeoutId);
  }, [selectedNodeIds]);

  // load diagram from file
  const onLoad = async (
    event?: React.ChangeEvent<HTMLInputElement>,
    recentFileHandle?: FileSystemFileHandle | null,
    options?: { skipUnsavedPrompt?: boolean; document?: Record<string, any> }
  ) => {
    const hasInputFile = !!event?.target?.files?.length;

    // Check if current diagram has unsaved changes (only for primary trigger)
    if (!hasInputFile && !options?.skipUnsavedPrompt) {
      const hasChanges = nodes.length > 0 || edges.length > 0;
      if (hasChanges && !window.confirm('Loading a file will clear the current diagram. Continue?')) {
        return;
      }
    }

    try {
      let fileContent: string;
      let openedFilename = '';
      let openedFileHandle: FileSystemFileHandle | null = null;

      if (options?.document) {
        fileContent = JSON.stringify(options.document);
        openedFilename = options.document.systemName || 'Guardian system';
      } else if (recentFileHandle) {
        const file = await recentFileHandle.getFile();
        fileContent = await file.text();
        openedFilename = recentFileHandle.name;
        openedFileHandle = recentFileHandle;
      } else if (hasInputFile && event?.target?.files?.length) {
        const file = event.target.files[0];
        fileContent = await file.text();
        openedFilename = file.name;
        openedFileHandle = null;
        // Reset so same filename can be selected again later.
        event.target.value = '';
      } else if ('showOpenFilePicker' in window) {
        try {
          const [fileHandle] = await window.showOpenFilePicker({
            types: [{
              description: 'JSON Files',
              accept: { 'application/json': ['.json'] }
            }]
          });

          const file = await fileHandle.getFile();
          fileContent = await file.text();
          openedFilename = fileHandle.name;
          openedFileHandle = fileHandle;
        } catch (pickerError) {
          // User cancelled
          if (pickerError instanceof Error && pickerError.name === 'AbortError') {
            return;
          }

          // Fallback to hidden input (helps on mobile/tablet browsers with partial support)
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
            return;
          }

          throw pickerError;
        }
      } else {
        // Fallback for browsers without File System Access API
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
          fileInputRef.current.click();
          return;
        }

        throw new Error('File picker is not available in this browser');
      }

      // Update current file reference
      setCurrentFile({
        name: openedFilename,
        handle: openedFileHandle
      });

      const loadedData = JSON.parse(fileContent) as SavedDiagramData;

      // Validate loaded data structure
      if (!loadedData || !Array.isArray(loadedData.nodes) || !Array.isArray(loadedData.edges)) {
        throw new Error('Invalid diagram file format: Missing nodes or edges arrays');
      }
      if (guardianRef.current && !options?.document) {
        await guardianRef.current.onImport(loadedData as unknown as Record<string, any>);
        return;
      }
      retainedDocument.current = loadedData;
      onGrcWorkspaceLoad?.(loadedData.grcWorkspace ?? null);
      setAttackPaths(normalizeAttackPaths(loadedData.attackPaths));
      setSelectedAttackPathId(null);
      setIsPathBuildingMode(false);
      setThreatModelUserState(normalizeThreatModelUserState(loadedData.threatModelUserState));

      // Comprehensive reset before loading new file
      console.log('[LOAD-FILE] Starting comprehensive system reset');

      // 1. Reset AI chat context
      resetContext();
      if (Array.isArray(loadedData.analysisContext?.messageHistory)) {
        loadedData.analysisContext.messageHistory.forEach(message => addMessage({ ...message, timestamp: new Date(message.timestamp) }));
      }

      // 2. Clear ALL existing nodes and edges first
      setNodes([]);
      setEdges([]);

      // 3. Clear system name
      setSystemName('');

      // 4. Clear custom context
      setCustomContext(null);

      // 5. Drawings will be cleared through resetContext

      console.log('[LOAD-FILE] System cleared, loading file data');

      // Function to map old handle IDs to new simplified handle IDs
      const mapHandleId = (oldHandleId: string | null | undefined): string | undefined => {
        if (!oldHandleId) return undefined;

        // Map old handle IDs to the new simplified format used in SecurityNodes
        if (oldHandleId.includes('top')) {
          return 'top';
        }
        if (oldHandleId.includes('right')) {
          return 'right';
        }
        if (oldHandleId.includes('bottom')) {
          return 'bottom';
        }
        if (oldHandleId.includes('left')) {
          return 'left';
        }

        // For exact matches (already simplified)
        if (['top', 'right', 'bottom', 'left'].includes(oldHandleId)) {
          return oldHandleId;
        }

        return oldHandleId;
      };

      // Reset the fitted flag so the loaded diagram gets centered
      setHasInitiallyFitted(false);

      // Load diagram data - create new edges with updated handle IDs
      const updatedEdges = loadedData.edges.map(edge => {
        // Extract the original edge properties
        const { id, source, target, type, data, animated, selected, style } = edge;

        // Create a new edge with the correct handle IDs
        return {
          ...edge,
          id,
          source,
          target,
          type: type || 'securityEdge',
          data: normalizeEdgeZoneData(data, nodeSecurityZone(loadedData.nodes.find(node => node.id === source), id => loadedData.nodes.find(node => node.id === id))) as SecurityEdgeData,
          animated,
          selected,
          style,
          // Map the handle IDs to the new format
          sourceHandle: mapHandleId(edge.sourceHandle as string | undefined),
          targetHandle: mapHandleId(edge.targetHandle as string | undefined)
        } as SecurityEdge;
      });

      // Process nodes to ensure icons are set and threat data is cleaned
      const processedNodes = loadedData.nodes
        .filter((node): node is SecurityNode => {
          if (!node || !node.type) {
            console.warn('Invalid node found, skipping:', node);
            return false;
          }
          return true;
        })
        .map((node: SecurityNode): SecurityNode => {
          if (isSecurityZoneNode(node)) {
            return node;
          } else {
            // Remove any stale threat analysis data
            const cleanData = { ...node.data } as any;

            // Add DFD categorization if applicable and not already present
            if (!cleanData.dfdCategory && node.type) {
              const dfdCategory = getDFDCategoryForNodeType(node.type);
              if (dfdCategory) {
                cleanData.dfdCategory = dfdCategory;
              }
            }

            return {
              ...node,
              data: {
                ...cleanData,
                icon: cleanData.icon || getDefaultIconForType(node.type)
              }
            } as SecurityNode;
          }
        });

      // Update nodes and edges (with handle migration)
      const loadedNodes = deserializeNodesFromLoad(processedNodes);
      const snappedLoadedNodes = guardianRef.current ? loadedNodes : snapNodesToGrid(loadedNodes);
      const nodesWithIndexCodes = updateNodesWithIndexCodes(snappedLoadedNodes);
      setNodes(nodesWithIndexCodes);
      const migratedEdges = migrateHandleIds(updatedEdges as SecurityEdge[]);
      const edgesWithIndexCodes = migrateEdgeIndexCodes(migratedEdges, nodesWithIndexCodes);

      // Debug: Check for loaded edges with control points
      const loadedEdgesWithControlPoints = edgesWithIndexCodes.filter(edge =>
        edge.data?.controlPoints && edge.data.controlPoints.length > 0
      );
      if (loadedEdgesWithControlPoints.length > 0) {
        console.log(`[LOAD] Found ${loadedEdgesWithControlPoints.length} edges with control points`);
        loadedEdgesWithControlPoints.forEach(edge => {
          console.log(`[LOAD] Edge ${edge.id} has ${edge.data?.controlPoints?.length} control points:`, edge.data?.controlPoints);
        });
      } else {
        console.log('[LOAD] No edges with control points found in loaded file');
      }

      setEdges(edgesWithIndexCodes);

      refreshNodeInternalsAfterCommit({ padding: 0.1, duration: 400 });

      // Restore system name if it exists
      if (loadedData.systemName) {
        setSystemName(loadedData.systemName);
      }

      // Drawings are now nodes - no need to restore separately

      // Restore custom context if it exists (but not message history - start fresh)
      if (loadedData.analysisContext?.customContext) {
        const { content, sanitizedContent, timestamp } = loadedData.analysisContext.customContext;
        setCustomContext({
          content,
          sanitizedContent,
          timestamp: new Date(timestamp)
        });
      } else {
        setCustomContext(null);
      }

      // Restore imported threat intel if it exists
      if (loadedData.analysisContext?.importedThreatIntel) {
        setImportedThreatIntel(loadedData.analysisContext.importedThreatIntel);
      } else {
        setImportedThreatIntel(null);
      }

      // Track changes
      trackChanges({
        nodes: processedNodes,
        edges: updatedEdges,
        metadata: {
          lastModified: new Date(),
          version: loadedData.metadata?.version || '1.0',
          // drawings are now nodes
          zoneConfiguration: loadedData.zoneConfiguration?.styles
        }
      });

      // The useEffect watching reactFlowInstance will auto-center the diagram

      addMessage({
        id: Date.now().toString(),
        type: 'response',
        content: `Loaded ${openedFilename} successfully. ` +
          `${processedNodes.length} nodes, ${updatedEdges.length} edges, ` +
          ``,
        timestamp: new Date()
      });

      if (openedFileHandle) {
        await trackRecentDiagramFile(openedFileHandle);
      }

      // The useEffect watching reactFlowInstance will auto-center the diagram

      // Restore window layout if present
      if (loadedData.windowLayout && Array.isArray(loadedData.windowLayout.windows) && allowFloatingEditors) {
        loadedData.windowLayout.windows.forEach(w => {
          const content = w.type === 'node'
            ? loadedNodes.find(n => n.id === w.contentId)
            : edgesWithIndexCodes.find(e => e.id === w.contentId);
          if (!content) return;

          const existing = windowManager.windows.find(win => win.id === w.id);
          if (!existing) {
            windowManager.openWindow({
              id: w.id,
              type: w.type,
              title: w.type === 'node'
                ? `Edit ${(content as any).type}: ${(content as any).data?.label || (content as any).id}`
                : `Edit Connection: ${(content as any).data?.label || (content as any).id}`,
              content: content as any,
              position: w.position,
              size: w.size
            });
          }
          // Apply persisted state (position/size/minimized/zIndex)
          windowManager.updateWindow(w.id, {
            position: w.position,
            size: w.size,
            isMinimized: w.isMinimized,
            zIndex: w.zIndex,
          });
        });

        if (loadedData.windowLayout.activeWindowId) {
          try {
            windowManager.focusWindow(loadedData.windowLayout.activeWindowId);
          } catch { }
        }
      }

    } catch (err) {
      console.error('Failed to load file:', err);
      addMessage({
        id: Date.now().toString(),
        type: 'response',
        content: 'Failed to load file: ' + (err instanceof Error ? err.message : 'Unknown error'),
        timestamp: new Date()
      });
    }
  };

  const handleOpenDiagramFromOnboarding = useCallback(() => {
    setShowOnboardingPrompt(false);
    onLoad(undefined, null, { skipUnsavedPrompt: true });
  }, [onLoad]);

  const handleOpenRecentDiagramFromOnboarding = useCallback(async (recentFile: RecentDiagramFile) => {
    const fileHandle = await getRecentDiagramFileHandle(recentFile.id);
    if (!fileHandle) {
      await removeRecentDiagramFileEntry(recentFile.id);
      addMessage({
        id: Date.now().toString(),
        type: 'response',
        content: `Recent file "${recentFile.name}" is no longer available. It was removed from the list.`,
        timestamp: new Date()
      });
      return;
    }

    const hasPermission = await ensureRecentFileReadPermission(fileHandle);
    if (!hasPermission) {
      addMessage({
        id: Date.now().toString(),
        type: 'response',
        content: `Permission to open "${recentFile.name}" was not granted.`,
        timestamp: new Date()
      });
      return;
    }

    setShowOnboardingPrompt(false);
    await onLoad(undefined, fileHandle, { skipUnsavedPrompt: true });
  }, [addMessage, ensureRecentFileReadPermission, onLoad, removeRecentDiagramFileEntry]);

  const loadExampleSystem = (exampleSystem: ExampleSystem) => {
    if (guardianRef.current) {
      void guardianRef.current.onImport({
        ...exampleSystem,
        systemName: exampleSystem.name,
        analysisContext: {
          ...(exampleSystem as any).analysisContext,
          customContext: exampleSystem.customContext ? { content: exampleSystem.customContext, sanitizedContent: DiagramSanitizer.sanitizeContextText(exampleSystem.customContext), timestamp: new Date().toISOString() } : undefined
        }
      });
      return;
    }
    // Comprehensive reset before loading new system
    console.log('[LOAD-EXAMPLE] Starting comprehensive system reset for:', exampleSystem?.name || 'unknown');

    if (!exampleSystem || !exampleSystem.nodes || !exampleSystem.edges) {
      console.error('[LOAD-EXAMPLE] Invalid example system:', exampleSystem);
      return;
    }

    // 1. Reset AI chat context
    resetContext();

    // 2. Clear ALL existing nodes and edges first
    setNodes([]);
    setEdges([]);

    // 3. Clear system name
    setSystemName('');

    // 4. Clear custom context
    setCustomContext(null);

    // 5. Update current file reference with example ID
    setCurrentFile({ name: exampleSystem.id || '', handle: null });
    onGrcWorkspaceLoad?.(exampleSystem.grcWorkspace ?? null);
    setAttackPaths(normalizeAttackPaths(exampleSystem.attackPaths));
    setSelectedAttackPathId(null);
    setIsPathBuildingMode(false);
    setThreatModelUserState({ mitigations: {}, strideOverrides: [] });

    // 6. Drawings will be cleared through resetContext above

    // 7. Close all floating windows before loading new system
    if (windowManager && windowManager.windows) {
      windowManager.windows.forEach(window => {
        windowManager.closeWindow(window.id);
      });
    }

    // 8. Small delay to ensure React state updates are processed
    setTimeout(() => {
      console.log('[LOAD-EXAMPLE] Loading new example system:', exampleSystem.name);
      console.log('[LOAD-EXAMPLE] Nodes to load:', exampleSystem.nodes.length);
      console.log('[LOAD-EXAMPLE] Edges to load:', exampleSystem.edges.length);

      // Reset the fitted flag so the new system gets centered
      setHasInitiallyFitted(false);

      // Function to map old handle IDs to new simplified handle IDs
      const mapHandleId = (oldHandleId: string | null | undefined): string | undefined => {
        if (!oldHandleId) return undefined;

        // Map old handle IDs to the new simplified format used in SecurityNodes
        if (oldHandleId.includes('top')) {
          return 'top';
        }
        if (oldHandleId.includes('right')) {
          return 'right';
        }
        if (oldHandleId.includes('bottom')) {
          return 'bottom';
        }
        if (oldHandleId.includes('left')) {
          return 'left';
        }

        // For exact matches (already simplified)
        if (['top', 'right', 'bottom', 'left'].includes(oldHandleId)) {
          return oldHandleId;
        }

        return oldHandleId;
      };

      // Helper function to calculate best handle position based on node positions
      const calculateHandle = (sourceNode: SecurityNode, targetNode: SecurityNode, isSource: boolean): string => {
        const dx = targetNode.position.x - sourceNode.position.x;
        const dy = targetNode.position.y - sourceNode.position.y;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        // For the source node, we look at where the target is relative to it
        // For the target node, we look at where the source is relative to it
        if (isSource) {
          // Source handle: where is the target relative to source?
          if (absDx > absDy) {
            // Horizontal connection
            return dx > 0 ? 'right' : 'left';
          } else {
            // Vertical connection
            return dy > 0 ? 'bottom' : 'top';
          }
        } else {
          // Target handle: where is the source relative to target?
          if (absDx > absDy) {
            // Horizontal connection
            return dx > 0 ? 'left' : 'right';
          } else {
            // Vertical connection
            return dy > 0 ? 'top' : 'bottom';
          }
        }
      };

      // Create new edges with updated handle IDs
      const updatedEdges = exampleSystem.edges.map(edge => {
        // Find source and target nodes
        const sourceNode = exampleSystem.nodes.find(n => n.id === edge.source);
        const targetNode = exampleSystem.nodes.find(n => n.id === edge.target);

        // Calculate handles if not specified and nodes exist
        let sourceHandle = mapHandleId(edge.sourceHandle as string | undefined);
        let targetHandle = mapHandleId(edge.targetHandle as string | undefined);

        if (!sourceHandle && sourceNode && targetNode) {
          sourceHandle = calculateHandle(sourceNode, targetNode, true);
        }
        if (!targetHandle && sourceNode && targetNode) {
          targetHandle = calculateHandle(sourceNode, targetNode, false);
        }


        // Create a new edge with the correct handle IDs
        const newEdge: SecurityEdge = {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: 'securityEdge',
          data: edge.data,
          sourceHandle,
          targetHandle
        };

        // Add optional properties if they exist
        if (edge.animated !== undefined) newEdge.animated = edge.animated;
        if (edge.selected !== undefined) newEdge.selected = edge.selected;
        if (edge.style !== undefined) newEdge.style = edge.style;

        return newEdge;
      });

      // Clean nodes of any threat data before loading
      const cleanedNodes = exampleSystem.nodes.map(node => {
        if (node.type === 'securityZone') {
          return node;
        }

        // Remove any threat analysis data from the node
        const cleanData = { ...node.data } as any;

        // Add DFD categorization if applicable and not already present
        if (!cleanData.dfdCategory && node.type) {
          const dfdCategory = getDFDCategoryForNodeType(node.type);
          if (dfdCategory) {
            cleanData.dfdCategory = dfdCategory;
          }
        }

        return {
          ...node,
          data: cleanData
        };
      });

      const exampleNodes = deserializeNodesFromLoad(cleanedNodes);
      console.log('[LOAD-EXAMPLE] Deserialized nodes:', exampleNodes.length);
      const snappedExampleNodes = snapNodesToGrid(exampleNodes);

      const exampleNodesWithIndexCodes = updateNodesWithIndexCodes(snappedExampleNodes);
      console.log('[LOAD-EXAMPLE] Nodes with index codes:', exampleNodesWithIndexCodes.length);

      setNodes(exampleNodesWithIndexCodes);

      const migratedExampleEdges = migrateHandleIds(updatedEdges as SecurityEdge[]);
      console.log('[LOAD-EXAMPLE] Migrated edges:', migratedExampleEdges.length);

      const exampleEdgesWithIndexCodes = migrateEdgeIndexCodes(migratedExampleEdges, exampleNodesWithIndexCodes);
      console.log('[LOAD-EXAMPLE] Edges with index codes:', exampleEdgesWithIndexCodes.length);

      setSystemName(exampleSystem.name);

      // Delay edge loading to ensure nodes are rendered in ReactFlow's internal store
      setTimeout(() => {
        setEdges(exampleEdgesWithIndexCodes);

        // Recalculate handles and fit once anchor positions are stable.
        refreshNodeInternalsAfterCommit({ padding: 0.1, duration: 400 });
      }, 150);

      // Set custom context if available
      if (exampleSystem.customContext) {
        const sanitizedContent = DiagramSanitizer.sanitizeContextText(exampleSystem.customContext);
        setCustomContext({
          content: exampleSystem.customContext,
          sanitizedContent,
          timestamp: new Date()
        });
      } else {
        // Clear custom context if the example doesn't have one
        setCustomContext(null);
      }

      console.log('[LOAD-EXAMPLE] Example system loaded successfully');
    }, 100); // 100ms delay to ensure state is cleared
  };

  loadExampleSystemRef.current = loadExampleSystem;
  onLoadRef.current = () => onLoad();

  // Load example system on mount
  useEffect(() => {
    if (guardianRef.current) {
      void onLoad(undefined, null, { skipUnsavedPrompt: true, document: guardianRef.current.initialDocument }).then(() => setGuardianLoaded(true));
      return;
    }
    if (nodes.length === 0 && edges.length === 0) {
      console.log('Loading example system on mount...');

      const exampleSystem = initialSystem;
      onGrcWorkspaceLoad?.(exampleSystem.grcWorkspace ?? null);

      // Reset AI chat context when loading a new system
      resetContext();

      let nodesToLoad = exampleSystem.nodes;
      let edgesToLoad = exampleSystem.edges;

      // Set custom context if available
      if (exampleSystem.customContext) {
        setCustomContext({
          content: exampleSystem.customContext,
          sanitizedContent: exampleSystem.customContext, // Pass raw context
          timestamp: new Date()
        });
      } else {
        setCustomContext(null);
      }

      const loadedNodes = deserializeNodesFromLoad(nodesToLoad);
      const snappedLoadedNodes = snapNodesToGrid(loadedNodes);
      const loadedNodesWithIndexCodes = updateNodesWithIndexCodes(snappedLoadedNodes);
      setNodes(loadedNodesWithIndexCodes);
      const migratedEdges = migrateHandleIds(edgesToLoad as SecurityEdge[]);
      const edgesWithIndexCodes = migrateEdgeIndexCodes(migratedEdges, loadedNodesWithIndexCodes);
      setSystemName(exampleSystem.name);
      setAttackPaths(normalizeAttackPaths(exampleSystem.attackPaths));

      // Delay edge loading to ensure nodes are rendered in ReactFlow's internal store
      setTimeout(() => {
        setEdges(edgesWithIndexCodes);

        // Recalculate handles after staged edge commit.
        refreshNodeInternalsAfterCommit();
      }, 150);

      // The useEffect hook that depends on `[nodes, edges]` will automatically
      // call `debouncedTrackChanges`, ensuring the context is updated correctly.

      // The useEffect watching reactFlowInstance will auto-center the diagram
    }
  }, []);  // Run once on mount

  const [isAnalysisPanelOpen, setIsAnalysisPanelOpen] = useState(() => {
    try { return localStorage.getItem('diagram-analysis-panel-open') === 'true'; } catch { return false; }
  });
  const [isNodeToolboxOpen, setIsNodeToolboxOpen] = useState(() => {
    try { const v = localStorage.getItem('diagram-toolbox-open'); return v === null ? true : v === 'true'; } catch { return true; }
  });
  const [isMethodologyGuideOpen, setIsMethodologyGuideOpen] = useState(false);
  const [leftPanelTab, setLeftPanelTab] = useState<'toolbox' | 'analysis' | 'attackpaths' | 'register'>(() => {
    try {
      const saved = localStorage.getItem('diagram-left-panel-tab');
      if (saved === 'toolbox' || saved === 'analysis' || saved === 'attackpaths' || saved === 'register') return saved;
    } catch {}
    return 'toolbox';
  });
  const toolboxDocked = toolboxPresentation === 'docked';
  const analysisDocked = analysisPresentation === 'docked';
  const toolboxFullscreen = toolboxPresentation === 'fullscreen';
  const analysisFullscreen = analysisPresentation === 'fullscreen';
  const showLeftToggle = toolboxDocked && !isSmallTouchViewport;
  const showRightToggle = analysisDocked && !isSmallTouchViewport;
  const hideToolbarForOpenPanel = isPhoneViewport && (isNodeToolboxOpen || isAnalysisPanelOpen);
  const shouldOffsetCanvasForToolbox = toolboxDocked && isNodeToolboxOpen;
  const shouldOffsetShellForAnalysis = analysisDocked && isAnalysisPanelOpen;
  const toolboxPanelWidth = responsiveToolboxWidth;
  const analysisPanelWidth = responsiveAnalysisWidth;
  const toolboxPanelWidthPx = `${toolboxPanelWidth}px`;
  const analysisPanelWidthPx = `${analysisPanelWidth}px`;
  const panelToggleBottomOffsetPx = `${appShell.panelToggleBottomOffset}px`;
  const appBarHeightPx = `${hideToolbarForOpenPanel ? 0 : toolbarHeight}px`;

  const handleToggleAnalysisPanel = useCallback(() => {
    preserveScrollPosition();
    setIsAnalysisPanelOpen(prev => {
      const next = !prev;
      if (next && analysisFullscreen) {
        setIsNodeToolboxOpen(false);
      }
      return next;
    });
  }, [preserveScrollPosition, analysisFullscreen]);

  const handleToggleNodeToolbox = useCallback(() => {
    setIsNodeToolboxOpen(prev => {
      const next = !prev;
      if (next && toolboxFullscreen) {
        setIsAnalysisPanelOpen(false);
      }
      return next;
    });
  }, [toolboxFullscreen]);

  const handleToggleMethodologyGuide = useCallback(() => {
    setIsMethodologyGuideOpen(prev => {
      const next = !prev;
      if (next && isSettingsOpen) {
        setIsSettingsOpen(false);
      }
      return next;
    });
  }, [isSettingsOpen]);

  useEffect(() => {
    if (!isSmallTouchViewport) return;
    if (isNodeToolboxOpen && isAnalysisPanelOpen) {
      setIsAnalysisPanelOpen(false);
    }
  }, [isSmallTouchViewport, isNodeToolboxOpen, isAnalysisPanelOpen]);

  useEffect(() => {
    try { localStorage.setItem('diagram-analysis-panel-open', String(isAnalysisPanelOpen)); } catch {}
  }, [isAnalysisPanelOpen]);

  useEffect(() => {
    try { localStorage.setItem('diagram-toolbox-open', String(isNodeToolboxOpen)); } catch {}
  }, [isNodeToolboxOpen]);

  useEffect(() => {
    try { localStorage.setItem('diagram-left-panel-tab', leftPanelTab); } catch {}
  }, [leftPanelTab]);

  useEffect(() => {
    if (!isDesktopViewport) {
      setIsAnalysisPanelOpen(false);
      setIsNodeToolboxOpen(false);
    }
  }, [isDesktopViewport]);

  // Add individual node/edge analysis handlers
  const handleAnalyzeNode = useCallback(async (nodeId: string) => {
    // First ensure the analysis panel is open and on the correct tab
    if (leftPanelTab !== 'analysis') {
      setLeftPanelTab('analysis');
      // Wait a tick for the panel to render
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const node = nodes.find(n => n.id === nodeId);
    if (!node || node.type === 'securityZone') return;

    // Select only this node by updating the nodes array
    setNodes(prevNodes => prevNodes.map(n => ({
      ...n,
      selected: n.id === nodeId
    })));

    // Wait a bit for the selection to update
    await new Promise(resolve => setTimeout(resolve, 100));

    // Use the analyzeSelectedNodes function which shows progress and cost dialog
    if (threatAnalysisPanelRef.current && threatAnalysisPanelRef.current.analyzeSelectedNodes) {
      try {
        await threatAnalysisPanelRef.current.analyzeSelectedNodes();
      } catch (error) {
        console.error('Failed to analyze node:', error);
      }
    } else {
      console.error('Threat analysis panel ref not available or analyzeSelectedNodes method not found');
    }
  }, [nodes, leftPanelTab, setLeftPanelTab, setNodes]);

  const handleAnalyzeEdge = useCallback(async (edgeId: string) => {
    if (!threatAnalysisPanelRef.current) return;

    const edge = edges.find(e => e.id === edgeId);
    if (!edge) return;

    try {
      // Call the ThreatAnalysisPanel's analyzeEdge method
      const analysisResult = await threatAnalysisPanelRef.current.analyzeEdge(edge);

      // Merge threats with existing ones for edge and append context
      const existingEdgeThreats = ((edge.data as any)?.securityContext?.threats ?? []) as ThreatData[];
      const mergedEdgeThreatsMap: Record<string, ThreatData> = {};
      [...existingEdgeThreats, ...(analysisResult.threats ?? [])].forEach(t => {
        mergedEdgeThreatsMap[t.id] = t;
      });
      const mergedEdgeThreats = Object.values(mergedEdgeThreatsMap);

      const existingEdgeContext = (edge.data as any)?.additionalContext ? ((edge.data as any).additionalContext + '\n\n') : '';

      // Update the edge with the analysis results
      const updatedEdge: SecurityEdge = {
        ...edge,
        data: {
          ...edge.data,
          additionalContext: existingEdgeContext + analysisResult.detailedAnalysis,
          securityContext: {
            threats: mergedEdgeThreats
          }
        }
      };

      // Update the edges array
      const updatedEdges = edges.map(e => e.id === edgeId ? updatedEdge : e);
      setEdges(updatedEdges);
      trackChanges({ nodes, edges: updatedEdges });

    } catch (error) {
      console.error('Failed to analyze edge:', error);
    }
  }, [nodes, edges, trackChanges]);

  // Optimized event handlers to replace inline functions
  const handleSystemNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSystemName(e.target.value);
  }, []);

  const handleToggleSnapToGrid = useCallback(() => {
    updateSettings({ snapToGrid: !snapToGrid });
  }, [snapToGrid, updateSettings]);

  const captureReactFlowAsCanvas = useCallback(async (backgroundColor: string) => {
    if (!reactFlowInstance || !reactFlowWrapper.current) {
      throw new Error('ReactFlow not ready');
    }

    const rfContainer = reactFlowWrapper.current.querySelector('.react-flow') as HTMLElement;
    if (!rfContainer) throw new Error('ReactFlow container not found');

    const savedViewport = reactFlowInstance.getViewport();
    const chromeSelectors = [
      '.react-flow__controls',
      '.react-flow__minimap',
      '.react-flow__attribution',
      '.react-flow__panel'
    ];
    const hiddenElements: HTMLElement[] = [];

    try {
      reactFlowInstance.fitView({ padding: 0.1 });
      await new Promise(resolve => setTimeout(resolve, 300));

      chromeSelectors.forEach(sel => {
        rfContainer.querySelectorAll(sel).forEach(el => {
          const htmlEl = el as HTMLElement;
          if (htmlEl.style.display !== 'none') {
            hiddenElements.push(htmlEl);
            htmlEl.style.display = 'none';
          }
        });
      });

      const canvas = await html2canvas(rfContainer, {
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true,
        backgroundColor,
        width: rfContainer.offsetWidth,
        height: rfContainer.offsetHeight
      });

      return canvas;
    } finally {
      hiddenElements.forEach(el => { el.style.display = ''; });
      reactFlowInstance.setViewport(savedViewport);
    }
  }, [reactFlowInstance]);

  // Export PNG functionality
  const handleExportPNG = useCallback(async () => {
    if (!reactFlowInstance) return;
    if (nodes.length === 0) {
      showToast('No nodes to export. Add nodes to the diagram first.', 'warning');
      return;
    }

    try {
      showToast('Preparing PNG export...', 'info');
      const saved = await saveFile(`${systemName.replace(/[^a-z0-9]/gi, '_')}_diagram.png`, async () => {
        const canvas = await captureReactFlowAsCanvas(currentTheme.colors.background || '#1e1e1e');
        return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => {
          if (blob) resolve(blob); else reject(new Error('Failed to generate PNG image'));
        }, 'image/png'));
      });
      if (saved) showToast('Diagram exported as PNG', 'success');
      return saved;

    } catch (error) {
      console.error('Error exporting PNG:', error);
      showToast('Failed to export diagram as PNG', 'error');
      return false;
    }
  }, [reactFlowInstance, nodes, systemName, currentTheme, showToast, captureReactFlowAsCanvas]);

  // Backup Settings functionality
  const handleBackupSettings = useCallback(async () => {
    try {
      // Get all settings from localStorage, excluding sensitive data
      const settings = loadSettings();

      // Remove sensitive data (API keys are already not stored in settings)
      const backupData = {
        ...settings,
        api: {
          ...settings.api,
          // Ensure no API keys are included (they're in credentials, not settings)
          providerConfig: {
            openai: {
              organizationId: settings.api.providerConfig?.openai?.organizationId,
              model: settings.api.providerConfig?.openai?.model,
              reasoningEffort: settings.api.providerConfig?.openai?.reasoningEffort,
            },
            anthropic: {
              model: settings.api.providerConfig?.anthropic?.model,
            },
            gemini: {
              projectId: settings.api.providerConfig?.gemini?.projectId,
              model: settings.api.providerConfig?.gemini?.model,
            }
          }
        }
      };

      // Add metadata
      const backup = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        application: 'ContextCypher',
        settings: backupData
      };

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const saved = await saveFile(`contextcypher-settings-backup-${timestamp}.json`, new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
      if (saved) showToast('Settings backed up successfully', 'success');
      return saved;
    } catch (error) {
      console.error('Error backing up settings:', error);
      showToast('Failed to backup settings', 'error');
      return false;
    }
  }, [showToast]);

  // Load Settings functionality
  const handleLoadSettings = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';

    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const backup = JSON.parse(text);

        // Validate backup file
        if (!backup.settings || backup.application !== 'ContextCypher') {
          showToast('Invalid settings backup file', 'error');
          return;
        }

        // Version compatibility check
        if (backup.version !== '1.0') {
          showToast('Incompatible backup version', 'error');
          return;
        }

        // Load settings
        const currentSettings = loadSettings();
        const newSettings = {
          ...currentSettings,
          ...backup.settings,
          // Preserve current API keys (they're not in the backup)
          api: {
            ...backup.settings.api,
            // Preserve current provider config API keys
            providerConfig: {
              ...backup.settings.api.providerConfig
            }
          }
        };

        // Save to localStorage
        saveSettings(newSettings);

        showToast('Settings loaded successfully. Please refresh the page for all changes to take effect.', 'success');

        // Optionally refresh after a delay
        setTimeout(() => {
          if (window.confirm('Would you like to refresh the page now to apply all settings?')) {
            window.location.reload();
          }
        }, 1000);

      } catch (error) {
        console.error('Error loading settings:', error);
        showToast('Failed to load settings. Please check the file format.', 'error');
      }
    };

    input.click();
  }, [showToast]);

  // Export SVG functionality
  const handleExportSVG = useCallback(async () => {
    if (!reactFlowInstance) return;
    if (nodes.length === 0) {
      showToast('No nodes to export. Add nodes to the diagram first.', 'warning');
      return;
    }

    try {
      const viewport = document.querySelector('.react-flow__viewport') as SVGElement;
      if (!viewport) return;

      const clonedViewport = viewport.cloneNode(true) as SVGElement;

      const nodesBounds = getNodesBounds(nodes);
      const padding = 50;
      const width = nodesBounds.width + (padding * 2);
      const height = nodesBounds.height + (padding * 2);

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', String(width));
      svg.setAttribute('height', String(height));
      svg.setAttribute('viewBox', `${nodesBounds.x - padding} ${nodesBounds.y - padding} ${width} ${height}`);
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

      const relevantPatterns = ['react-flow', 'security-', 'modern-node', 'edge-label', 'zone-'];
      let capturedCSS = '';
      try {
        for (const sheet of Array.from(document.styleSheets)) {
          try {
            for (const rule of Array.from(sheet.cssRules)) {
              const ruleText = rule.cssText;
              if (relevantPatterns.some(p => ruleText.includes(p))) {
                capturedCSS += ruleText + '\n';
              }
            }
          } catch (_e) { /* cross-origin stylesheet, skip */ }
        }
      } catch (_e) { /* styleSheets access error, skip */ }

      const styleElement = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      styleElement.textContent = capturedCSS || `
        .react-flow__edge-path { stroke: #999; fill: none; stroke-width: 1; }
        .react-flow__node { cursor: grab; }
        .react-flow__handle { fill: #555; stroke: #fff; }
      `;
      svg.appendChild(styleElement);
      svg.appendChild(clonedViewport);

      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svg);
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const saved = await saveFile(`${systemName.replace(/[^a-z0-9]/gi, '_')}_diagram.svg`, blob);
      if (saved) {
        showToast('Diagram exported as SVG', 'success');
      }
      return saved;
    } catch (error) {
      console.error('Error exporting SVG:', error);
      showToast('Failed to export diagram as SVG', 'error');
      return false;
    }
  }, [reactFlowInstance, nodes, systemName, showToast]);

  // Export JPEG functionality
  const handleExportJPEG = useCallback(async () => {
    if (!reactFlowInstance) return;
    if (nodes.length === 0) {
      showToast('No nodes to export. Add nodes to the diagram first.', 'warning');
      return;
    }

    try {
      showToast('Preparing JPEG export...', 'info');
      const saved = await saveFile(`${systemName.replace(/[^a-z0-9]/gi, '_')}_diagram.jpg`, async () => {
        const canvas = await captureReactFlowAsCanvas('#ffffff');
        return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => {
          if (blob) resolve(blob); else reject(new Error('Failed to generate JPEG image'));
        }, 'image/jpeg', 0.92));
      });
      if (saved) showToast('Diagram exported as JPEG', 'success');
      return saved;

    } catch (error) {
      console.error('Error exporting JPEG:', error);
      showToast('Failed to export diagram as JPEG', 'error');
      return false;
    }
  }, [reactFlowInstance, nodes, systemName, showToast, captureReactFlowAsCanvas]);

  // TEMPORARY: Export diagram as TypeScript for example system authoring
  const handleExportTypeScript = useCallback(async () => {
    try {
      const tsCode = exportDiagramAsTypescript({
        systemName,
        nodes: nodes as SecurityNode[],
        edges: edges as SecurityEdge[],
        attackPaths
      });
      const blob = new Blob([tsCode], { type: 'text/typescript' });
      const filename = (systemName || 'example-system').replace(/[^a-zA-Z0-9\s-_]/g, '').replace(/\s+/g, '-').toLowerCase() + '.ts';
      const saved = await saveFile(filename, blob);
      if (saved) showToast('Diagram exported as TypeScript', 'success');
      return saved;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to export TypeScript', 'error');
      return false;
    }
  }, [systemName, nodes, edges, attackPaths, showToast]);

  // Stable helper function for deselecting security zones - MUST be defined before use
  const deselectSecurityZones = useCallback((existing: SecurityNode[]): SecurityNode[] => {
    return existing.map((node): SecurityNode => {
      if (node.type !== 'securityZone') return node;

      // Ensure mandatory style fields (width/height) remain numbers
      const width = (node.style as any)?.width ?? 400;
      const height = (node.style as any)?.height ?? 300;

      return {
        ...node,
        selected: false,
        selectable: false,
        draggable: false,
        style: {
          ...(node.style || {}),
          width,
          height,
          zIndex: -1,
        },
      } as SecurityNode;
    });
  }, []);

  const handlePaneClick = useCallback(() => {
    reactFlowWrapper.current?.focus({ preventScroll: true });
    // Deselect all nodes and push zones to the back
    setNodes(prev => {
      const cleared = prev.map(n => ({ ...n, selected: false }));
      return deselectSecurityZones(cleared);
    });

    // Explicitly clear selection-derived edge animation state. Relying solely on
    // selection-change events can leave stale flags when pane clicks are swallowed.
    setSelectedNodeIds([]);
    setEdges(prevEdges => {
      let hasChanges = false;
      const updatedEdges = prevEdges.map(edge => {
        const edgeData = edge.data as SecurityEdgeData | undefined;
        const hasStaleState = edge.selected || edgeData?.sourceNodeSelected || edgeData?.targetNodeSelected;
        if (!hasStaleState) {
          return edge;
        }
        hasChanges = true;
        return {
          ...edge,
          selected: false,
          data: {
            ...(edge.data || {}),
            sourceNodeSelected: false,
            targetNodeSelected: false
          }
        } as SecurityEdge;
      });
      return hasChanges ? updatedEdges : prevEdges;
    });

    // Tell custom edges to drop transient hover state if a pointer-leave event was missed.
    document.dispatchEvent(new CustomEvent('diagram:clear-edge-hover'));

    // Close settings drawer if open
    if (isSettingsOpen) {
      setIsSettingsOpen(false);
    }

    // Close context panel if open
    analysisPanelRef.current?.closeContextPanel();
  }, [deselectSecurityZones, isSettingsOpen]);


  // Use the tracked state from analysis context, fallback to current nodes/edges
  const currentDiagram: DiagramData = useMemo(() =>
    analysisState.currentState || {
      nodes,
      edges,
      metadata: {
        version: '1.0',
        lastModified: new Date()
      }
    }, [analysisState.currentState, nodes, edges]);

  // Debug logging to track diagram state for AI analysis (only log on significant changes)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('DiagramEditor - Current diagram state for AI:', {
        usingTrackedState: !!analysisState.currentState,
        nodeCount: currentDiagram.nodes.length,
        edgeCount: currentDiagram.edges.length,
        hasMetadata: !!currentDiagram.metadata,
        timestamp: new Date().toISOString()
      });
    }
  }, [analysisState.currentState?.nodes.length, analysisState.currentState?.edges.length]); // Only log when counts actually change

  // Validate connections - allow any connection between nodes
  const isValidConnection = useCallback((connection: Connection | Edge) => {
    if ('source' in connection && 'target' in connection) {
      return connection.source !== connection.target;
    }
    return false;
  }, []);


  // Prevent panel movement when selecting nodes/edges
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    // Only respond to left-click for selection; right-click is for panning
    if ((event as any).button !== 0) {
      return;
    }

    // Clicking inside a locked security zone (but not the button) – ignore
    if (
      node.type === 'securityZone' &&
      !(event.target as HTMLElement).closest('.zone-select-button')
    ) {
      event.preventDefault();
      return;
    }

    // Check if Ctrl/Cmd key is held for multi-selection
    const isMultiSelect = event.ctrlKey || event.metaKey;
    const wasNodeSelected = nodes.some(n => n.id === node.id && n.selected);
    const isEditableNode = isInspectorEligibleNodeType(node.type as string);

    if (!isMultiSelect) {
      // Deselect all other nodes and edges when clicking a single node
      setNodes(prev => prev.map(n => ({
        ...n,
        selected: n.id === node.id
      })));
      setEdges(prev => prev.map(e => ({
        ...e,
        selected: false
      })));
    }

    // If a normal node was clicked, ensure any selected zone is sent back
    if (node.type !== 'securityZone') {
      setNodes(prev => deselectSecurityZones(prev));
    }

    if (isCompactViewport && !isMultiSelect && isEditableNode && wasNodeSelected) {
      const currentNode = (nodes.find(n => n.id === node.id) as SecurityNode | undefined) || (node as SecurityNode);
      if (quickInspectorTimeoutRef.current) {
        clearTimeout(quickInspectorTimeoutRef.current);
        quickInspectorTimeoutRef.current = null;
      }
      setShowQuickInspector(false);
      setQuickInspectorItem(null);
      openNodeEditor(currentNode);
    }

    event.stopPropagation();
  }, [deselectSecurityZones, isCompactViewport, isInspectorEligibleNodeType, nodes, openNodeEditor]);

  // Handle node hover for quick inspector
  const handleNodeMouseEnter = useCallback((event: React.MouseEvent, node: Node) => {
    if (isCompactViewport) {
      return;
    }

    // Ignore hover on drawing nodes (freehand, shape, textAnnotation) and security zones
    if (node.type === 'freehand' || node.type === 'shape' || node.type === 'textAnnotation' || node.type === 'securityZone') {
      return;
    }

    // Clear any existing timeout
    if (quickInspectorTimeoutRef.current) {
      clearTimeout(quickInspectorTimeoutRef.current);
    }

    // Skip if control point is being dragged
    if (isControlPointDragging.current) {
      return;
    }

    // Skip if cursor on a handle
    if ((event.target as HTMLElement).closest('.react-flow__handle, .modern-handle')) {
      return;
    }
    // Show quick inspector after delay
    quickInspectorTimeoutRef.current = setTimeout(() => {
      // Double-check control point isn't being dragged
      if (isControlPointDragging.current) {
        return;
      }

      const rect = (event.target as HTMLElement).getBoundingClientRect();
      // Find the current node data from our state
      const currentNode = nodes.find(n => n.id === node.id);
      if (currentNode) {
        setQuickInspectorItem(currentNode as SecurityNode);
      } else {
        setQuickInspectorItem(node as SecurityNode);
      }
      setQuickInspectorPosition({
        x: rect.right + 10,
        y: rect.top
      });
      setShowQuickInspector(true);
    }, QUICK_INSPECTOR_DELAY);
  }, [isCompactViewport, nodes]);

  const handleNodeMouseLeave = useCallback(() => {
    // Clear timeout if node is left before inspector shows
    if (quickInspectorTimeoutRef.current) {
      clearTimeout(quickInspectorTimeoutRef.current);
      quickInspectorTimeoutRef.current = null;
    }

    // Hide inspector after a small delay to allow moving to inspector
    setTimeout(() => {
      if (!inspectorHoverRef.current) {
        setShowQuickInspector(false);
      }
    }, 200);
  }, []);

  // Handle edge hover for quick inspector
  // Handle edge label mouse events for QuickInspector
  useEffect(() => {
    if (isCompactViewport) {
      return;
    }

    const handleEdgeLabelMouseEnter = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { edgeId, clientX, clientY } = customEvent.detail;

      // Clear any existing timeout
      if (quickInspectorTimeoutRef.current) {
        clearTimeout(quickInspectorTimeoutRef.current);
      }

      // Skip if control point is being dragged
      if (isControlPointDragging.current) {
        return;
      }

      // Show quick inspector after delay
      quickInspectorTimeoutRef.current = setTimeout(() => {
        // Double-check control point isn't being dragged
        if (isControlPointDragging.current) {
          return;
        }

        // Find the current edge data from our state
        const currentEdge = edges.find(e => e.id === edgeId);
        if (currentEdge) {
          setQuickInspectorItem(currentEdge as SecurityEdge);
          setQuickInspectorPosition({
            x: clientX + 10,
            y: clientY - 20
          });
          setShowQuickInspector(true);
        }
      }, QUICK_INSPECTOR_DELAY);
    };

    const handleEdgeLabelMouseLeave = () => {
      // Clear timeout if edge is left before inspector shows
      if (quickInspectorTimeoutRef.current) {
        clearTimeout(quickInspectorTimeoutRef.current);
        quickInspectorTimeoutRef.current = null;
      }

      // Hide inspector after a small delay
      setTimeout(() => {
        if (!inspectorHoverRef.current) {
          setShowQuickInspector(false);
        }
      }, 200);
    };

    // Add event listeners
    document.addEventListener('edgeLabelMouseEnter', handleEdgeLabelMouseEnter);
    document.addEventListener('edgeLabelMouseLeave', handleEdgeLabelMouseLeave);

    // Cleanup
    return () => {
      document.removeEventListener('edgeLabelMouseEnter', handleEdgeLabelMouseEnter);
      document.removeEventListener('edgeLabelMouseLeave', handleEdgeLabelMouseLeave);
    };
  }, [edges, isCompactViewport]);

  // Empty edge mouse handlers for ReactFlow (we handle via custom events now)
  const handleEdgeMouseEnter = useCallback(() => { }, []);
  const handleEdgeMouseLeave = useCallback(() => { }, []);

  // Prevent panel movement when selecting edges
  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    // Attack path building mode: toggle edge in/out of the selected path
    if (isPathBuildingMode && selectedAttackPathId) {
      event.stopPropagation();
      setAttackPaths(prev => prev.map(path => {
        if (path.id !== selectedAttackPathId) return path;
        const existingIndex = path.steps.findIndex(s => s.edgeId === edge.id);
        if (existingIndex >= 0) {
          const steps = path.steps.filter(s => s.edgeId !== edge.id).map((s, i) => ({ ...s, order: i + 1 }));
          return { ...path, steps, updatedAt: new Date().toISOString() };
        }
        const step = {
          order: path.steps.length + 1,
          edgeId: edge.id,
          sourceNodeId: edge.source,
          targetNodeId: edge.target,
          technique: ''
        };
        return { ...path, steps: [...path.steps, step], updatedAt: new Date().toISOString() };
      }));
      return;
    }

    // Only respond to left-click for selection; right-click is for panning
    if ((event as any).button !== 0) {
      return;
    }
    event.stopPropagation();

    // Check if Ctrl/Cmd key is held for multi-selection
    const isMultiSelect = event.ctrlKey || event.metaKey;
    const wasEdgeSelected = edges.some(e => e.id === edge.id && e.selected);
    const fullEdge = edges.find(e => e.id === edge.id);
    const selectedEdgeData = (fullEdge || edge) as SecurityEdge;

    if (!isMultiSelect) {
      // Deselect all nodes and other edges when clicking a single edge
      setNodes(prev => prev.map(n => ({
        ...n,
        selected: false
      })));
      setEdges(prev => prev.map(e => ({
        ...e,
        selected: e.id === edge.id
      })));
    }

    // Preserve the edge's security context when clicking
    if (fullEdge) {
      console.log('Edge clicked, preserving data:', {
        id: edge.id,
        hasSecurityContext: !!(fullEdge.data as any)?.securityContext,
        threatCount: (fullEdge.data as any)?.securityContext?.threats?.length || 0
      });
    }

    if (isCompactViewport && !isMultiSelect) {
      if (wasEdgeSelected) {
        if (quickInspectorTimeoutRef.current) {
          clearTimeout(quickInspectorTimeoutRef.current);
          quickInspectorTimeoutRef.current = null;
        }
        setShowQuickInspector(false);
        setQuickInspectorItem(null);
        openEdgeEditor(selectedEdgeData);
        return;
      }
    }
  }, [edges, isCompactViewport, openEdgeEditor]);

  // Add CSS class based on validity
  const onConnectStart: OnConnectStart = useCallback((event, { nodeId, handleId }) => {
    document.querySelectorAll('.react-flow__handle').forEach(handle => {
      handle.setAttribute('data-connecting', 'true');

      // Mark handles on the same node
      if (handle.closest('.react-flow__node')?.getAttribute('data-id') === nodeId) {
        handle.setAttribute('data-self-connect', 'true');
      }
    });
  }, []);

  // Clean up when connection ends
  const onConnectEnd: OnConnectEnd = useCallback(() => {
    document.querySelectorAll('.react-flow__handle').forEach(handle => {
      handle.removeAttribute('data-connecting');
      handle.removeAttribute('data-self-connect');
    });
  }, []);


  // Optimized selection handler with batching
  const selectionUpdateFrameRef = useRef<number | null>(null);

  const batchedSelectionHandler = useCallback((selectedNodes: Node[]) => {
    // Track selected node IDs
    const selectedIds = new Set(selectedNodes.map(n => n.id));

    // Cancel any pending selection update
    if (selectionUpdateFrameRef.current !== null) {
      cancelAnimationFrame(selectionUpdateFrameRef.current);
    }

    // Schedule batched update
    selectionUpdateFrameRef.current = requestAnimationFrame(() => {
      setNodes((prevNodes) => {
        // Only update nodes that have actually changed selection state
        let hasChanges = false;
        const updatedNodes = prevNodes.map(node => {
          const isSelected = selectedIds.has(node.id);
          const wasSelected = node.selected || false;

          // Skip if selection state hasn't changed
          if (isSelected === wasSelected) {
            return node;
          }

          hasChanges = true;

          // Handle security zone deselection
          if (node.type === 'securityZone') {
            // If the zone was selected but is no longer in the selection
            if (wasSelected && !isSelected) {
              // Use the same logic as the button click for consistency
              return {
                ...node,
                selected: false,
                selectable: false,
                draggable: false,
                style: {
                  ...(node.style || {}),
                  width: node.style?.width || 400,
                  height: node.style?.height || 300,
                  zIndex: -1
                }
              } as SecurityNode;
            }
            // Don't update if no change needed
            if (node.selected === isSelected) {
              return node;
            }
          }

          // For non-security zone nodes, just update selection
          if (node.selected === isSelected) return node;
          return {
            ...node,
            selected: isSelected
          };
        });

        // Only return new array if there were actual changes
        return hasChanges ? updatedNodes : prevNodes;
      });

      selectionUpdateFrameRef.current = null;
    });
  }, []);

  // Track if selection is in progress to prevent duplicate selection boxes
  const isSelectionInProgressRef = useRef(false);

  // Use optimized selection handler for better performance
  const onSelectionChange = useOptimizedSelectionHandler({
    onSelectionChange: ({ nodes: selectedNodes }) => {
      // Prevent duplicate selection processing
      if (isSelectionInProgressRef.current) {
        return;
      }

      isSelectionInProgressRef.current = true;

      // Use requestAnimationFrame to batch updates and prevent flashing
      requestAnimationFrame(() => {
        // Don't process if this is just the security zone selection change from the button
        // NOTE: We intentionally don't call takeSnapshot here - selection changes alone
        // are not meaningful for undo/redo. Only actual modifications (deletions, additions,
        // position changes) should be tracked in history.
        batchedSelectionHandler(selectedNodes);

        // Update selected node IDs for edge animation
        const nodeIds = selectedNodes.map(node => node.id);
        setSelectedNodeIds(nodeIds);

        // Reset flag after processing
        setTimeout(() => {
          isSelectionInProgressRef.current = false;
        }, 50);
      });
    }
  });

  const onEdgeUpdate = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      setEdges(els => {
        // Manual edge update for v12
        const updated = els.filter(e => e.id !== oldEdge.id);
        if (newConnection.source && newConnection.target) {
          const newEdge: SecurityEdge = {
            ...oldEdge,
            source: newConnection.source,
            target: newConnection.target,
            sourceHandle: newConnection.sourceHandle || null,
            targetHandle: newConnection.targetHandle || null
          } as SecurityEdge;
          updated.push(updateEdgeWithIndexCode(newEdge, nodes));
        }
        return updated;
      });
    },
    [nodes]
  );

  const handleExampleLoad = (example: ExampleSystem) => {
    if (guardianRef.current) { loadExampleSystem(example); return; }
    // Check if current diagram has unsaved changes
    const hasChanges = nodes.length > 0 || edges.length > 0;

    if (hasChanges) {
      // Store pending import and show confirmation dialog
      setPendingImport(example);
      setIsImportConfirmOpen(true);
    } else {
      // No changes, proceed with loading directly
      loadExampleSystem(example);
    }
  };

  const handleImportDiagram = (importedDiagram: ExampleSystem) => {
    if (guardianRef.current) { loadExampleSystem(importedDiagram); return; }
    // Check if current diagram has unsaved changes
    const hasChanges = nodes.length > 0 || edges.length > 0;

    if (hasChanges) {
      // Store pending import and show confirmation dialog
      setPendingImport(importedDiagram);
      setIsImportConfirmOpen(true);
    } else {
      // No changes, proceed with import directly
      performImport(importedDiagram);
    }
  };

  const performImport = (importedDiagram: ExampleSystem) => {
    if (guardianRef.current) { loadExampleSystem(importedDiagram); return; }
    // Clear current diagram and load imported one
    clearDiagram();

    // Small delay to ensure clear completes
    setTimeout(() => {
      loadExampleSystem(importedDiagram);
      // Diagram imported successfully
    }, 100);
  };

  const performMergeImport = (importedDiagram: ExampleSystem, importSource: string) => {
    // Get current diagram state
    const currentDiagram: ExampleSystem = {
      ...guardianDocument,
      id: 'merged-diagram',
      name: systemName || 'Merged Diagram',
      description: `Merged diagram including ${importSource}`,
      category: 'Cloud Infrastructure',
      primaryZone: 'Internal',
      dataClassification: 'Internal',
      customContext: analysisState.customContext?.content || '',
      nodes,
      edges
    };

    // Merge diagrams using utility function
    const mergedDiagram = mergeDiagrams(currentDiagram, importedDiagram, importSource);

    // Validate merged diagram
    const warnings = validateMergedDiagram(mergedDiagram);
    if (warnings.length > 0) {
      console.warn('Merge validation warnings:', warnings);
    }

    // Load merged diagram
    loadExampleSystem(mergedDiagram);
  };

  const handleImportSave = async () => {
    try {
      // If no current file handle exists, use saveAs instead
      let saved: boolean = false;
      if (!currentFile.handle) {
        saved = await saveAs() || false;
      } else {
        saved = await save() || false;
      }

      // Only perform import if save was successful
      if (saved && pendingImport) {
        performImport(pendingImport);
        // Close dialogs after successful save and import
        setIsImportConfirmOpen(false);
        setPendingImport(null);
      } else if (!saved) {
        // User cancelled save, keep dialog open
        console.log('Save cancelled, keeping import dialog open');
      }
    } catch (error) {
      console.error('Error during save:', error);
      // Keep dialog open on error
    }
  };

  const handleImportDiscard = () => {
    // Close dialogs and perform import without saving
    if (pendingImport) {
      performImport(pendingImport);
    }

    setIsImportConfirmOpen(false);
    setPendingImport(null);
  };

  const handleImportCancel = () => {
    // Just close the dialog without doing anything
    setIsImportConfirmOpen(false);
    setPendingImport(null);
  };

  // Load initial system context on mount
  useEffect(() => {
    if (guardianRef.current) return;
    const loadInitialContext = () => {
      // Use initialSystem instead of initialSystemData
      if (initialSystem?.customContext) {
        // Sanitize the context
        const sanitizedContent = DiagramSanitizer.sanitizeContextText(
          initialSystem.customContext
        );

        // Create initial diagram data
        const initialDiagram: DiagramData = {
          nodes: initialSystem.nodes,
          edges: initialSystem.edges,
          metadata: {
            version: '1.0',
            lastModified: new Date(),
            systemType: initialSystem.category,
            isInitialSystem: true
          }
        };

        // Sanitize diagram data
        const sanitizedDiagram: SanitizationResult = DiagramSanitizer.sanitize(initialDiagram);

        // Set sanitized context
        setCustomContext({
          content: initialSystem.customContext,
          sanitizedContent: sanitizedContent,
          timestamp: new Date()
        });

        // Track sanitized state with proper typing
        trackChanges({
          nodes: sanitizedDiagram.nodes,
          edges: sanitizedDiagram.edges,
          metadata: {
            version: '1.0',
            lastModified: new Date(),
            systemType: initialSystem.category,
            isInitialSystem: true,
            customContext: {
              content: initialSystem.customContext,
              sanitizedContent: sanitizedContent,
              timestamp: new Date()
            },
            isSanitized: sanitizedDiagram.metadata.isSanitized,
            sanitizationTimestamp: new Date().toISOString()
          } as BaseMetadata
        });
      }
    };

    loadInitialContext();
  }, []);  // Run once on mount

  const handleCanvasMouseDown = useCallback((event: React.MouseEvent) => {
    // CRITICAL: Don't interfere with text selection in analysis panel
    const target = event.target as HTMLElement;
    if (target.closest('.analysis-panel-content') || target.closest('[data-testid="analysis-panel"]')) {
      return; // Let the analysis panel handle its own events
    }

    // Allow ReactFlow to handle middle/right button for panning
    // Only stop propagation for left button (0) to keep selection semantics
    if (event.button === 0) {
      event.stopPropagation();
    }
  }, []);



  const onKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (activeModule !== 'diagram' || event.defaultPrevented || event.altKey) {
      return;
    }

    // Don't interfere with text selection in analysis panel
    const target = event.target as HTMLElement;
    if (target.closest('.analysis-panel-content') || target.closest('[data-testid="analysis-panel"]')) {
      return; // Let the analysis panel handle its own events
    }

    // Don't interfere when typing in input fields
    if (target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) {
      return;
    }

    // Handle keyboard shortcuts
    if (event.ctrlKey || event.metaKey) {
      const key = event.key.toLowerCase();

      // Skip modifier keys themselves
      if (key === 'control' || key === 'meta' || key === 'alt' || key === 'shift') {
        return;
      }

      switch (key) {
        case 'z':
          if (event.shiftKey) {
            // Ctrl+Shift+Z for redo
            event.preventDefault();
            event.stopPropagation();
            if (redoRef.current) {
              try {
                redoRef.current();
              } catch (error) {
                console.error('Redo failed:', error);
                showToast('Unable to redo at this time', 'error');
              }
            }
          } else {
            // Ctrl+Z for undo
            event.preventDefault();
            event.stopPropagation();
            if (undoRef.current) {
              try {
                undoRef.current();
              } catch (error) {
                console.error('Undo failed:', error);
                showToast('Unable to undo at this time', 'error');
              }
            }
          }
          break;
        case 'y':
          // Ctrl+Y for redo
          event.preventDefault();
          event.stopPropagation();
          if (redoRef.current) {
            try {
              redoRef.current();
            } catch (error) {
              console.error('Redo failed:', error);
              showToast('Unable to redo at this time', 'error');
            }
          }
          break;
        case 'c':
          // Ctrl+C for copy - only handle if focus is on the canvas
          // Don't intercept if user is in a panel
          const targetForCopy = event.target as HTMLElement;
          if (targetForCopy.closest('.MuiDrawer-root') ||
            targetForCopy.closest('.MuiDialog-root') ||
            targetForCopy.closest('.threat-intel-panel') ||
            targetForCopy.closest('.analysis-panel-content') ||
            targetForCopy.closest('[data-testid="analysis-panel"]') ||
            targetForCopy.tagName === 'INPUT' ||
            targetForCopy.tagName === 'TEXTAREA' ||
            targetForCopy.contentEditable === 'true') {
            return; // Let the browser handle native copy
          }

          event.preventDefault();
          event.stopPropagation();

          // Get fresh selected nodes from React Flow store (handles box selection)
          const currentNodesForCopy = reactFlowInstance ? reactFlowInstance.getNodes() : nodes;
          const currentEdgesForCopy = reactFlowInstance ? reactFlowInstance.getEdges() : edges;

          const selectedNodesForCopy = currentNodesForCopy.filter(node => {
            if (node.type === 'securityZone') {
              return node.selected && (node as any).selectable !== false;
            }
            return node.selected;
          });

          if (selectedNodesForCopy.length === 0) {
            showToast('No nodes selected to copy', 'warning');
            break;
          }

          // Get connected edges
          const selectedEdgesForCopy = (currentEdgesForCopy as SecurityEdge[]).filter((edge: SecurityEdge) => {
            const isSourceSelected = selectedNodesForCopy.some(n => n.id === edge.source);
            const isTargetSelected = selectedNodesForCopy.some(n => n.id === edge.target);
            return edge.selected || (isSourceSelected && isTargetSelected);
          });

          // Store in window for now to bypass all the state issues
          window.__clipboardNodes = JSON.parse(JSON.stringify(selectedNodesForCopy));
          window.__clipboardEdges = JSON.parse(JSON.stringify(selectedEdgesForCopy));
          // Mark these nodes as from a copy operation (not cut)
          window.__clipboardFromCut = false;

          console.log('[COPY] Stored nodes:', selectedNodesForCopy.map(n => ({
            id: n.id,
            draggable: n.draggable,
            selected: n.selected,
            type: n.type,
            selectable: n.selectable
          })));

          showToast(`Copied ${selectedNodesForCopy.length} nodes and ${selectedEdgesForCopy.length} edges`, 'success');
          break;
        case 'v':
          // Ctrl+V for paste - only handle if focus is on the canvas
          // Don't intercept if user is in a panel
          const targetForPaste = event.target as HTMLElement;
          if (targetForPaste.closest('.MuiDrawer-root') ||
            targetForPaste.closest('.MuiDialog-root') ||
            targetForPaste.closest('.threat-intel-panel') ||
            targetForPaste.closest('.analysis-panel-content') ||
            targetForPaste.closest('[data-testid="analysis-panel"]') ||
            targetForPaste.tagName === 'INPUT' ||
            targetForPaste.tagName === 'TEXTAREA' ||
            targetForPaste.contentEditable === 'true') {
            return; // Let the browser handle native paste
          }

          event.preventDefault();
          event.stopPropagation();

          if (!window.__clipboardNodes || window.__clipboardNodes.length === 0) {
            showToast('Nothing to paste', 'info');
            break;
          }

          const bufferedNodes = window.__clipboardNodes;
          const bufferedEdges = window.__clipboardEdges || [];
          const isFromCut = window.__clipboardFromCut || false;

          console.log('[PASTE] Starting paste operation:', {
            nodeCount: bufferedNodes.length,
            isFromCut,
            firstNode: bufferedNodes[0] ? {
              id: bufferedNodes[0].id,
              draggable: bufferedNodes[0].draggable,
              selected: bufferedNodes[0].selected,
              selectable: bufferedNodes[0].selectable,
              type: bufferedNodes[0].type
            } : null
          });

          // Get mouse position (we'll use center of viewport for now)
          const bounds = document.querySelector('.react-flow')?.getBoundingClientRect();
          let pastePosition = { x: 100, y: 100 };

          if (bounds && reactFlowInstance) {
            // Use center of visible viewport
            pastePosition = reactFlowInstance.screenToFlowPosition({
              x: bounds.left + bounds.width / 2,
              y: bounds.top + bounds.height / 2
            });
          }

          // Calculate center of copied nodes
          const minX = Math.min(...bufferedNodes.map(node => node.position.x));
          const minY = Math.min(...bufferedNodes.map(node => node.position.y));
          const maxX = Math.max(...bufferedNodes.map(node => node.position.x));
          const maxY = Math.max(...bufferedNodes.map(node => node.position.y));
          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;

          // Create new nodes with new IDs and positions
          const nodeIdMap: Record<string, string> = {};
          const newNodes: SecurityNode[] = bufferedNodes.map(node => {
            const newId = getId();
            nodeIdMap[node.id] = newId;

            // Reset node properties for paste
            const baseNode = {
              ...node,
              id: newId,
              position: {
                x: pastePosition.x + (node.position.x - centerX),
                y: pastePosition.y + (node.position.y - centerY)
              },
              selected: true,
              selectable: true,
              draggable: true
            };

            // Special handling for security zones
            if (node.type === 'securityZone') {
              return {
                ...baseNode,
                draggable: false,
                style: {
                  ...node.style,
                  zIndex: -1
                }
              } as SecurityNode;
            }

            return baseNode as SecurityNode;
          });

          // Create new edges with updated references
          const newEdges: SecurityEdge[] = bufferedEdges.map(edge => {
            const newId = getId();
            return {
              ...edge,
              id: newId,
              source: nodeIdMap[edge.source] || edge.source,
              target: nodeIdMap[edge.target] || edge.target,
              selected: true as boolean
            } as SecurityEdge;
          });

          console.log('[PASTE] Created new nodes:', newNodes.map(n => ({
            id: n.id,
            draggable: n.draggable,
            selected: n.selected,
            selectable: n.selectable,
            type: n.type
          })));

          // Deselect existing and add new
          const deselectedNodes = nodes.map(n => ({ ...n, selected: false }));
          const deselectedEdges = edges.map(e => ({ ...e, selected: false }));
          const updatedNodes = [...deselectedNodes, ...newNodes];
          const updatedEdges = [...deselectedEdges, ...newEdges];

          console.log('[PASTE] Setting nodes, total count:', updatedNodes.length);

          setNodes(updatedNodes);
          setEdges(updatedEdges);

          // Update selectedNodeIds to match the pasted nodes
          const pastedNodeIds = newNodes.map(n => n.id);
          setSelectedNodeIds(pastedNodeIds);

          // Simple approach - just let React Flow handle it
          setTimeout(() => {
            if (reactFlowInstance) {
              const pastedNodesInFlow = reactFlowInstance.getNodes().filter(n => pastedNodeIds.includes(n.id));

              console.log('[PASTE] Operation:', isFromCut ? 'CUT' : 'COPY');
              console.log('[PASTE] Pasted nodes in flow:', pastedNodesInFlow.map(n => ({
                id: n.id,
                draggable: n.draggable,
                selected: n.selected,
                selectable: n.selectable,
                type: n.type
              })));

              if (pastedNodesInFlow.length > 0) {
                onSelectionChange({ nodes: pastedNodesInFlow, edges: [] });
              }
            }
          }, 50);

          // Take snapshot for undo
          setTimeout(() => {
            diagramEditorInnerRef.current?.takeSnapshot();
          }, 100);

          showToast(`Pasted ${newNodes.length} nodes and ${newEdges.length} edges`, 'success');
          break;
        case 'x':
          // Ctrl+X for cut - only handle if focus is on the canvas
          // Don't intercept if user is in a panel
          const targetForCut = event.target as HTMLElement;
          if (targetForCut.closest('.MuiDrawer-root') ||
            targetForCut.closest('.MuiDialog-root') ||
            targetForCut.closest('.threat-intel-panel') ||
            targetForCut.closest('.analysis-panel-content') ||
            targetForCut.closest('[data-testid="analysis-panel"]') ||
            targetForCut.tagName === 'INPUT' ||
            targetForCut.tagName === 'TEXTAREA' ||
            targetForCut.contentEditable === 'true') {
            return; // Let the browser handle native cut
          }

          event.preventDefault();
          event.stopPropagation();

          // COPY OPERATION - EXACTLY THE SAME AS CTRL+C
          // Get fresh selected nodes from React Flow store (handles box selection)
          const currentNodesForCut = reactFlowInstance ? reactFlowInstance.getNodes() : nodes;
          const currentEdgesForCut = reactFlowInstance ? reactFlowInstance.getEdges() : edges;

          const selectedNodesForCut = currentNodesForCut.filter(node => {
            if (node.type === 'securityZone') {
              return node.selected && (node as any).selectable !== false;
            }
            return node.selected;
          });

          if (selectedNodesForCut.length === 0) {
            showToast('No nodes selected to cut', 'warning');
            break;
          }

          // Get connected edges
          const selectedEdgesForCut = (currentEdgesForCut as SecurityEdge[]).filter((edge: SecurityEdge) => {
            const isSourceSelected = selectedNodesForCut.some(n => n.id === edge.source);
            const isTargetSelected = selectedNodesForCut.some(n => n.id === edge.target);
            return edge.selected || (isSourceSelected && isTargetSelected);
          });

          // Store in window for now to bypass all the state issues
          window.__clipboardNodes = JSON.parse(JSON.stringify(selectedNodesForCut));
          window.__clipboardEdges = JSON.parse(JSON.stringify(selectedEdgesForCut));
          // Mark these nodes as from a cut operation
          window.__clipboardFromCut = true;

          console.log('[CUT] Stored nodes before deletion:', selectedNodesForCut.map(n => ({
            id: n.id,
            draggable: n.draggable,
            selected: n.selected,
            type: n.type,
            selectable: n.selectable
          })));

          showToast(`Cut ${selectedNodesForCut.length} nodes and ${selectedEdgesForCut.length} edges`, 'success');

          // NOW DELETE THE NODES (this is the ONLY difference from copy)
          // Add a longer delay to ensure React Flow clears its internal state
          const selectedNodeIds = selectedNodesForCut.map(n => n.id);

          // Use a longer timeout to ensure React Flow's internal multiselection state is cleared
          setTimeout(() => {
            setNodes(nodes.filter(node => !selectedNodeIds.includes(node.id)));
            setEdges(edges.filter(edge =>
              !selectedNodeIds.includes(edge.source) && !selectedNodeIds.includes(edge.target)
            ));
          }, 100);

          // Take snapshot for undo
          setTimeout(() => {
            diagramEditorInnerRef.current?.takeSnapshot();
          }, 50);

          showToast(`Cut ${selectedNodesForCut.length} nodes and ${selectedEdgesForCut.length} edges`, 'success');
          break;
        case 's':
          // Ctrl+S for save
          if (event.shiftKey) {
            // Ctrl+Shift+S for save as
            event.preventDefault();
            saveAs();
          } else {
            event.preventDefault();
            save();
          }
          break;
        case 'o':
          // Ctrl+O for open
          event.preventDefault();
          onLoad();
          break;
      }
    }

    // WASD Navigation is handled by global listener in useEffect

    // Default ReactFlow behavior
    if (event.key === 'Shift') {
      document.body.classList.add('react-flow__selectable');
    }
  }, [activeModule, reactFlowInstance, save, saveAs, onLoad]);

  const onKeyUp = useCallback((event: React.KeyboardEvent) => {
    if (activeModule !== 'diagram') {
      return;
    }

    // Don't interfere with text selection in analysis panel
    const target = event.target as HTMLElement;
    if (target.closest('.analysis-panel-content') || target.closest('[data-testid="analysis-panel"]')) {
      return; // Let the analysis panel handle its own events
    }

    if (event.key === 'Shift') {
      document.body.classList.remove('react-flow__selectable');
    }
  }, [activeModule]);

  // Track changes only on significant updates using debounced function
  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      debouncedTrackChanges({ nodes, edges });
    }
  }, []); // Only run on mount to prevent performance issues

  // WASD Navigation with global keyboard listener
  useEffect(() => {
    if (activeModule !== 'diagram') {
      return;
    }

    const keysPressed = new Set<string>();
    let animationFrameId: number | null = null;
    let velocity = { x: 0, y: 0 };
    let lastTime = 0;

    const maxSpeed = 25; // Maximum pixels per frame
    const acceleration = 1.5; // How quickly to reach max speed (lower = smoother start)
    const deceleration = 4; // How quickly to stop

    const updateViewport = (currentTime: number) => {
      if (!reactFlowInstance) {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
        return;
      }

      // Calculate delta time for smooth animation regardless of framerate
      const deltaTime = lastTime ? Math.min((currentTime - lastTime) / 16.67, 2) : 1; // 16.67ms = 60fps
      lastTime = currentTime;

      // Calculate target velocity based on keys pressed
      let targetVx = 0;
      let targetVy = 0;

      if (keysPressed.has('w')) targetVy = maxSpeed;
      if (keysPressed.has('s')) targetVy = -maxSpeed;
      if (keysPressed.has('a')) targetVx = maxSpeed;
      if (keysPressed.has('d')) targetVx = -maxSpeed;

      // Normalize diagonal movement to maintain consistent speed
      if (targetVx !== 0 && targetVy !== 0) {
        const factor = 0.707; // 1/sqrt(2)
        targetVx *= factor;
        targetVy *= factor;
      }

      // Smoothly interpolate velocity with easing
      const accel = keysPressed.size > 0 ? acceleration : deceleration;
      const easingFactor = accel * deltaTime * 0.05; // Reduced from 0.1 for smoother start
      velocity.x += (targetVx - velocity.x) * easingFactor;
      velocity.y += (targetVy - velocity.y) * easingFactor;

      // Apply dead zone to stop completely
      if (Math.abs(velocity.x) < 0.1) velocity.x = 0;
      if (Math.abs(velocity.y) < 0.1) velocity.y = 0;

      // Update viewport if there's movement
      if (velocity.x !== 0 || velocity.y !== 0) {
        const currentViewport = reactFlowInstance.getViewport();
        reactFlowInstance.setViewport({
          x: currentViewport.x + velocity.x * deltaTime,
          y: currentViewport.y + velocity.y * deltaTime,
          zoom: currentViewport.zoom
        });
      }

      // Continue animation if there's velocity or keys are pressed
      if (velocity.x !== 0 || velocity.y !== 0 || keysPressed.size > 0) {
        animationFrameId = requestAnimationFrame(updateViewport);
      } else {
        animationFrameId = null;
        lastTime = 0;
        // Reset velocity when completely stopped
        velocity.x = 0;
        velocity.y = 0;
      }
    };

    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      // Don't interfere when typing in input fields
      const target = event.target as HTMLElement;
      if (!reactFlowWrapper.current?.contains(target)) return;
      if (target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) {
        return;
      }

      // Don't interfere with analysis panel
      if (target.closest('.analysis-panel-content') || target.closest('[data-testid="analysis-panel"]')) {
        return;
      }

      if (!event.key) return;
      const key = event.key.toLowerCase();

      // WASD Navigation
      if (['w', 'a', 's', 'd'].includes(key)) {
        event.preventDefault();

        if (!keysPressed.has(key)) {
          keysPressed.add(key);

          // Reset velocity if starting fresh (no keys were pressed before)
          if (keysPressed.size === 1) {
            velocity.x = 0;
            velocity.y = 0;
          }

          // Start smooth scrolling immediately
          if (!animationFrameId && reactFlowInstance) {
            lastTime = performance.now();
            animationFrameId = requestAnimationFrame(updateViewport);
          }
        }
      }
    };

    const handleGlobalKeyUp = (event: KeyboardEvent) => {
      if (!event.key) return;
      const key = event.key.toLowerCase();
      keysPressed.delete(key);

      // Stop auto-scrolling if no WASD keys are pressed
      if (keysPressed.size === 0 && animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };

    // Add global listeners
    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('keyup', handleGlobalKeyUp);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('keyup', handleGlobalKeyUp);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [activeModule, reactFlowInstance]);

  // Callback to center and select a component from threat analysis
  const handleCenterComponent = useCallback((componentId: string) => {
    if (!reactFlowInstance) return;

    const node = nodes.find((n) => n.id === componentId);
    if (node) {
      // Select only this node
      setNodes((prev) => prev.map((n) => ({ ...n, selected: n.id === componentId })));
      setEdges((prev) => prev.map((e) => ({ ...e, selected: false })));

      // Center view on the node
      reactFlowInstance.setCenter(node.position.x + 100, node.position.y + 40, {
        zoom: 1.5,
        duration: 500,
      });
    }
  }, [reactFlowInstance, nodes]);

  // 📌 Listen for NodeFinder selection events to center & select components
  useEffect(() => {
    const handler = (event: Event) => {
      if (!reactFlowInstance) return;
      const detail = (event as CustomEvent).detail as { elementType: 'node' | 'edge'; id: string };
      if (!detail) return;
      const { elementType, id } = detail;

      if (elementType === 'node') {
        // Center on node
        const node = nodes.find((n) => n.id === id);
        if (node) {
          // Select it
          setNodes((prev) => prev.map((n) => ({ ...n, selected: n.id === id })));
          reactFlowInstance.setCenter(node.position.x + 100, node.position.y + 40, {
            zoom: 1.3,
            duration: 500,
          });
        }
      } else if (elementType === 'edge') {
        const edge = edges.find((e) => e.id === id);
        if (edge) {
          setEdges((prev) => prev.map((e) => ({ ...e, selected: e.id === id })));
          const source = nodes.find((n) => n.id === edge.source);
          const target = nodes.find((n) => n.id === edge.target);
          if (source && target) {
            const centerX = (source.position.x + target.position.x) / 2 + 100;
            const centerY = (source.position.y + target.position.y) / 2 + 40;
            reactFlowInstance.setCenter(centerX, centerY, { zoom: 1.3, duration: 500 });
          }
        }
      }
    };

    window.addEventListener('center-on-element', handler as EventListener);
    return () => window.removeEventListener('center-on-element', handler as EventListener);
  }, [reactFlowInstance, nodes, edges]);

  // Focus requests from GRC assets tab: switch to 2D view and center/select node.
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{
        nodeId?: string;
        force2D?: boolean;
      }>).detail;
      const nodeId = detail?.nodeId?.trim();
      if (!nodeId) {
        return;
      }

      const focusNode = () => {
        const exists = nodes.some(node => node.id === nodeId);
        if (!exists) {
          showToast(`Node "${nodeId}" not found in current diagram.`, 'warning');
          return;
        }
        selectNodeById(nodeId);
        setTimeout(() => centerOnNode(nodeId), 50);
      };

      if (detail?.force2D && currentView !== 'diagram') {
        setCurrentView('diagram');
        setTimeout(focusNode, 300);
        return;
      }

      focusNode();
    };

    window.addEventListener('grc-focus-diagram-node', handler as EventListener);
    return () => window.removeEventListener('grc-focus-diagram-node', handler as EventListener);
  }, [centerOnNode, currentView, nodes, selectNodeById, showToast]);

  // Focus requests from GRC assessment threat model canvas: switch to 2D view and center/select edge.
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{
        edgeId?: string;
        force2D?: boolean;
      }>).detail;
      const edgeId = detail?.edgeId?.trim();
      if (!edgeId) {
        return;
      }

      const focusEdge = () => {
        const exists = edges.some(edge => edge.id === edgeId);
        if (!exists) {
          showToast(`Edge "${edgeId}" not found in current diagram.`, 'warning');
          return;
        }
        selectEdgeById(edgeId);
        centerOnEdge(edgeId);
      };

      if (detail?.force2D && currentView !== 'diagram') {
        setCurrentView('diagram');
        // Let ReactFlow remount before focusing.
        setTimeout(focusEdge, 100);
        return;
      }

      focusEdge();
    };

    window.addEventListener('grc-focus-diagram-edge', handler as EventListener);
    return () => window.removeEventListener('grc-focus-diagram-edge', handler as EventListener);
  }, [centerOnEdge, currentView, edges, selectEdgeById, showToast]);

  const totalTutorialSteps = TUTORIAL_STEPS.length;
  const currentTutorialStep = TUTORIAL_STEPS[tutorialStepIndex];
  const dialogPaperStyles = {
    backgroundColor: currentTheme.colors.surface,
    color: currentTheme.colors.textPrimary,
    borderRadius: '16px',
    border: `1px solid ${currentTheme.colors.border}`,
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45)'
  };
  const dialogTitleStyles = {
    backgroundColor: currentTheme.colors.background,
    borderBottom: `1px solid ${currentTheme.colors.border}`,
    color: currentTheme.colors.textPrimary,
    fontWeight: 700
  };
  const fileMenuItems = [
    { label: guardianRef.current ? 'Save system' : 'Save', action: 'save', icon: <SaveIconLucide size={16} />, shortcut: 'Ctrl+S', disabled: !guardianRef.current && !currentFile.handle },
    { label: 'Save As...', action: 'saveAs', icon: <FilePlus size={16} />, shortcut: 'Ctrl+Shift+S' },
    { divider: true },
    { label: 'Open...', action: 'open', icon: <FolderOpen size={16} />, shortcut: 'Ctrl+O' },
    { label: 'Import Diagram...', action: 'import', icon: <Upload size={16} />, shortcut: 'Ctrl+I' },
    { divider: true },
    {
      label: 'Export As',
      action: 'export',
      icon: <Download size={16} />,
      submenu: [
        { label: 'PNG Image', action: 'exportPNG', icon: <Image size={16} /> },
        { label: 'JPEG Image', action: 'exportJPEG', icon: <Image size={16} /> },
        { label: 'SVG Vector', action: 'exportSVG', icon: <FileImage size={16} /> },
        { label: 'Threat Model Report (HTML)', action: 'exportReportHtml', icon: <FileImage size={16} /> },
        { label: 'Threat Model as Code (JSON)', action: 'exportModelJson', icon: <Download size={16} /> },
        { label: 'draw.io Diagram (.drawio)', action: 'exportDrawio', icon: <Download size={16} /> },
        { label: 'TypeScript (Dev)', action: 'exportTS', icon: <Download size={16} /> }
      ]
    },
    { divider: true },
    { label: 'Backup Settings...', action: 'backupSettings', icon: <SaveIconLucide size={16} />, shortcut: '' },
    { label: 'Load Settings...', action: 'loadSettings', icon: <FolderOpen size={16} />, shortcut: '' }
  ] as const;

  const editMenuItems = [
    { label: 'Undo', action: 'undo', icon: <Undo size={16} />, shortcut: 'Ctrl+Z', disabled: !canUndo },
    { label: 'Redo', action: 'redo', icon: <Redo size={16} />, shortcut: 'Ctrl+Y', disabled: !canRedo },
    { divider: true },
    { label: 'Cut', action: 'cut', icon: <Scissors size={16} />, shortcut: 'Ctrl+X', disabled: selectedNodes.length === 0 },
    { label: 'Copy', action: 'copy', icon: <Copy size={16} />, shortcut: 'Ctrl+C', disabled: selectedNodes.length === 0 },
    { label: 'Paste', action: 'paste', icon: <Clipboard size={16} />, shortcut: 'Ctrl+V', disabled: !(window as any).__canPaste },
    { divider: true },
    { label: 'Clear Diagram', action: 'clear', icon: <Trash2 size={16} /> }
  ] as const;

  const viewMenuItems = [
    { label: 'Zoom In', action: 'zoomIn', icon: <ZoomIn size={16} />, shortcut: 'Ctrl+Plus' },
    { label: 'Zoom Out', action: 'zoomOut', icon: <ZoomOut size={16} />, shortcut: 'Ctrl+Minus' },
    { label: 'Fit to Screen', action: 'fitView', icon: <Maximize size={16} />, shortcut: 'Ctrl+0' },
    { divider: true },
    { label: showGrid ? 'Hide Grid' : 'Show Grid', action: 'toggleGrid', icon: <Grid3x3 size={16} /> },
    { label: showMinimap ? 'Hide Minimap' : 'Show Minimap', action: 'toggleMinimap', icon: <Map size={16} /> },
    ...(currentTheme.documentStyle
      ? [{ label: showDocumentBlocks ? 'Hide Legend & Doc Info' : 'Show Legend & Doc Info', action: 'toggleDocumentBlocks', icon: <Info size={16} /> }]
      : []),
    { divider: true },
    { label: settings.nodeDisplayMode === 'icon' ? 'Expanded Nodes' : 'Icon-Only Nodes', action: 'toggleNodeMode', icon: settings.nodeDisplayMode === 'icon' ? <Eye size={16} /> : <EyeOff size={16} /> },
    { label: (settings.debugPanelEnabled ?? false) ? 'Disable Debug Panel' : 'Enable Debug Panel', action: 'toggleDebugPanel', icon: <Shield size={16} /> },
    { divider: true },
    { label: 'Run Tutorial', action: 'showTutorial', icon: <Info size={16} /> }
  ] as const;
  const flattenedFileMenuItems = (fileMenuItems as readonly any[]).flatMap((item) => {
    if (item?.submenu) {
      return item.submenu;
    }
    return [item];
  });
  const systemNameFieldWidth = isCompactViewport
    ? '100%'
    : `${Math.max(280, Math.min(520, (systemName || 'Enter system name...').length * 8 + 48))}px`;

  const handleFileMenuAction = useCallback(async (action: string) => {
    switch (action) {
      case 'save':
        save();
        break;
      case 'saveAs':
        saveAs();
        break;
      case 'open':
        onLoad();
        break;
      case 'import':
        setIsImportDialogOpen(true);
        break;
      case 'exportPNG':
        handleExportPNG();
        break;
      case 'exportReportHtml': {
        const scope = parseScopeFromContext(analysisState.customContext?.content);
        const html = generateHtmlReport(systemName, nodes, edges, attackPaths, scope);
        if (await downloadTextFile(`${(systemName || 'threat-model').replace(/[^\w-]+/g, '-')}-report.html`, html, 'text/html')) showToast('Threat model report exported', 'success');
        break;
      }
      case 'exportModelJson': {
        const scope = parseScopeFromContext(analysisState.customContext?.content);
        const json = exportThreatModelAsCode(systemName, nodes, edges, attackPaths, scope);
        if (await downloadTextFile(`${(systemName || 'threat-model').replace(/[^\w-]+/g, '-')}.threatmodel.json`, json, 'application/json')) showToast('Threat model exported as code', 'success');
        break;
      }
      case 'exportDrawio': {
        const xml = generateDrawioXml(systemName, nodes, edges);
        if (await downloadTextFile(`${(systemName || 'threat-model').replace(/[^\w-]+/g, '-')}.drawio`, xml, 'application/xml')) showToast('draw.io diagram exported', 'success');
        break;
      }
      case 'exportJPEG':
        handleExportJPEG();
        break;
      case 'exportSVG':
        handleExportSVG();
        break;
      case 'exportTS':
        handleExportTypeScript();
        break;
      case 'backupSettings':
        handleBackupSettings();
        break;
      case 'loadSettings':
        handleLoadSettings();
        break;
    }
  }, [handleBackupSettings, handleExportJPEG, handleExportPNG, handleExportSVG, handleExportTypeScript, handleLoadSettings, onLoad, save, saveAs,
      systemName, nodes, edges, attackPaths, analysisState.customContext, showToast]);

  const handleEditMenuAction = useCallback((action: string) => {
    switch (action) {
      case 'clear':
        setIsClearDialogOpen(true);
        break;
      case 'copy':
        if ((window as any).__copyPasteFunctions?.copy) {
          (window as any).__copyPasteFunctions.copy();
        }
        break;
      case 'paste':
        if ((window as any).__copyPasteFunctions?.paste) {
          (window as any).__copyPasteFunctions.paste();
        }
        break;
      case 'cut':
        if ((window as any).__copyPasteFunctions?.cut) {
          (window as any).__copyPasteFunctions.cut();
        }
        break;
      case 'undo':
        try {
          undoRef.current();
        } catch (error) {
          console.error('Undo failed:', error);
          showToast('Unable to undo at this time', 'error');
        }
        break;
      case 'redo':
        try {
          redoRef.current();
        } catch (error) {
          console.error('Redo failed:', error);
          showToast('Unable to redo at this time', 'error');
        }
        break;
    }
  }, [showToast]);

  const handleViewMenuAction = useCallback((action: string) => {
    switch (action) {
      case 'zoomIn':
        reactFlowInstance?.zoomIn();
        break;
      case 'zoomOut':
        reactFlowInstance?.zoomOut();
        break;
      case 'fitView':
        reactFlowInstance?.fitView();
        break;
      case 'toggleGrid':
        setShowGrid(!showGrid);
        break;
      case 'toggleMinimap':
        setShowMinimap(!showMinimap);
        break;
      case 'toggleDocumentBlocks':
        setShowDocumentBlocks(prev => !prev);
        break;
      case 'toggleNodeMode':
        updateSettings({ nodeDisplayMode: settings.nodeDisplayMode === 'icon' ? 'expanded' : 'icon' });
        break;
      case 'toggleDebugPanel': {
        const enabled = !(settings.debugPanelEnabled ?? false);
        updateSettings({ debugPanelEnabled: enabled });
        localStorage.setItem('debugPanelVisible', enabled ? 'true' : 'false');
        break;
      }
      case 'showTutorial':
        openTutorialManually();
        break;
    }
  }, [openTutorialManually, reactFlowInstance, settings.debugPanelEnabled, settings.nodeDisplayMode, showGrid, showMinimap, updateSettings]);

  // ---- Process spine (Scope → Model → Analyze → Treat → Report) ----
  const spineState = useMemo(() => {
    const modelNodes = nodes.filter(n => n.type !== 'securityZone');
    const allThreats = modelNodes.flatMap(n => ((n.data as any)?.securityContext?.threats ?? []) as any[]);
    const hasFindings = allThreats.length > 0 || attackPaths.length > 0;
    const treated = allThreats.length > 0 && allThreats.every(t => t?.status && t.status !== 'identified');
    return {
      scope: Boolean(analysisState.customContext?.content?.trim()),
      model: modelNodes.length > 0,
      analyze: hasFindings,
      treat: treated,
      report: false // becomes derivable when the document report ships (Phase 5)
    };
  }, [nodes, attackPaths, analysisState.customContext]);

  const handleSpineStageClick = useCallback((stage: SpineStage) => {
    switch (stage) {
      case 'scope':
        setScopeDialogOpen(true);
        break;
      case 'model':
        setShowQuickPalette(true);
        break;
      case 'treat':
        setIsNodeToolboxOpen(true);
        setLeftPanelTab(isFeatureEnabled('v2Register') ? 'register' : 'analysis');
        break;
      case 'analyze':
      case 'report':
        // Analysis tab hosts analysis runs and (until Phase 5) the report export
        setIsNodeToolboxOpen(true);
        setLeftPanelTab('analysis');
        break;
    }
  }, []);

  // ---- Canvas lenses (model / threats / attackPath / controls) ----
  const v2LensesEnabled = isFeatureEnabled('v2Lenses');
  // GRC module is opt-in under the v2 flag (proper settings toggle lands Phase 7)
  const grcHidden = isFeatureEnabled('grcOptIn');
  const v2RegisterEnabled = isFeatureEnabled('v2Register');
  const [activeLens, setActiveLens] = useState<DiagramLens>('model');

  const lensState = useMemo<DiagramLensState>(() => {
    // Note: `Map` is shadowed by the lucide-react icon import in this file
    const steps = new globalThis.Map<string, number>();
    let pathActive = false;
    if (activeLens === 'attackPath' && selectedAttackPathId) {
      const path = attackPaths.find(p => p.id === selectedAttackPathId);
      if (path?.steps?.length) {
        pathActive = true;
        let n = 1;
        [...path.steps]
          .sort((a, b) => a.order - b.order)
          .forEach(step => {
            if (!steps.has(step.sourceNodeId)) steps.set(step.sourceNodeId, n++);
            if (!steps.has(step.targetNodeId)) steps.set(step.targetNodeId, n++);
          });
      }
    }
    return { lens: v2LensesEnabled ? activeLens : 'model', pathNodeSteps: steps, pathActive: v2LensesEnabled && pathActive };
  }, [activeLens, selectedAttackPathId, attackPaths, v2LensesEnabled]);

  // Keyboard 1-4 switches lenses (when not typing)
  useEffect(() => {
    if (!v2LensesEnabled) return;
    const lensKeys: Record<string, DiagramLens> = { '1': 'model', '2': 'threats', '3': 'attackPath', '4': 'controls' };
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const el = event.target as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || el?.isContentEditable) return;
      // Escape always returns to the plain Model view
      if (event.key === 'Escape') {
        setActiveLens('model');
        return;
      }
      const lens = lensKeys[event.key];
      if (lens) {
        event.preventDefault();
        setActiveLens(lens);
        if (lens === 'attackPath') setLeftPanelTab('attackpaths');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [v2LensesEnabled]);

  const handleScopeSave = useCallback((scope: { description: string; assumptions: string; outOfScope: string }) => {
    const content = formatScopeAsContext(scope);
    setCustomContext(content
      ? { content, sanitizedContent: content, timestamp: new Date() }
      : null);
  }, [setCustomContext]);

  const handleCompactMenuAction = useCallback((action: string) => {
    if ([
      'save', 'saveAs', 'open', 'import', 'exportPNG', 'exportJPEG', 'exportSVG',
      'backupSettings', 'loadSettings'
    ].includes(action)) {
      handleFileMenuAction(action);
      return;
    }

    if (['undo', 'redo', 'cut', 'copy', 'paste', 'clear'].includes(action)) {
      handleEditMenuAction(action);
      return;
    }

    switch (action) {
      case 'toggleComponents':
        handleToggleNodeToolbox();
        return;
      case 'toggleAnalysis':
        handleToggleAnalysisPanel();
        return;
      case 'toggleTouchMultiSelect':
        setTouchMultiSelectMode(prev => !prev);
        return;
      case 'toggleViewMode':
        setCurrentView((prev) => (prev === 'diagram' ? 'isometric' : 'diagram'));
        return;
      case 'openQuickInspector':
        handleOpenCompactQuickInspector();
        return;
      default:
        break;
    }

    handleViewMenuAction(action);
  }, [
    handleEditMenuAction,
    handleFileMenuAction,
    handleOpenCompactQuickInspector,
    handleToggleAnalysisPanel,
    handleToggleNodeToolbox,
    handleViewMenuAction
  ]);

  const exampleMenuItems = useMemo(() => {
    const groupedExamples = Object.entries(exampleSystems);
    const items: any[] = [];

    groupedExamples.forEach(([category, examples], categoryIndex) => {
      items.push({
        label: category,
        action: `example-heading-${categoryIndex}`,
        disabled: true
      });

      examples.forEach((example) => {
        items.push({
          label: example.name,
          action: `example:${example.id}`
        });
      });

      if (categoryIndex < groupedExamples.length - 1) {
        items.push({ divider: true });
      }
    });

    return items;
  }, []);

  const compactViewMenuItems = useMemo(() => {
    const items: any[] = [
      ...viewMenuItems,
      { divider: true },
      {
        label: isNodeToolboxOpen ? 'Hide Components Panel' : 'Show Components Panel',
        action: 'toggleComponents',
        icon: isNodeToolboxOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />
      },
      {
        label: isAnalysisPanelOpen ? 'Hide Analysis Panel' : 'Show Analysis Panel',
        action: 'toggleAnalysis',
        icon: isAnalysisPanelOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />
      },
      {
        label: currentView === 'diagram' ? 'Switch to 3D Security View' : 'Switch to Diagram View',
        action: 'toggleViewMode',
        icon: <BoxIcon size={16} />
      },
      ...(isSmallTouchViewport && currentView === 'diagram'
        ? [{
          label: touchMultiSelectMode ? 'Disable Multi-Select Mode' : 'Enable Multi-Select Mode',
          action: 'toggleTouchMultiSelect',
          icon: <Scissors size={16} />,
          disabled: isInteractiveLocked
        }]
        : []),
      {
        label: 'Open Quick Inspector',
        action: 'openQuickInspector',
        icon: <Info size={16} />,
        disabled: !singleInspectorSelection
      }
    ];

    return items;
  }, [currentView, isAnalysisPanelOpen, isInteractiveLocked, isNodeToolboxOpen, isSmallTouchViewport, singleInspectorSelection, touchMultiSelectMode, viewMenuItems]);

  const unifiedToolbarMenuItems = useMemo(() => {
    const items: any[] = [
      { label: 'File', action: 'file', icon: <FolderOpen size={16} />, submenu: [...flattenedFileMenuItems] },
      { label: 'Edit', action: 'edit', icon: <Scissors size={16} />, submenu: [...editMenuItems] },
      { label: 'View', action: 'view', icon: <Eye size={16} />, submenu: [...compactViewMenuItems] },
      { label: 'Examples', action: 'examples', icon: <Grid size={16} />, submenu: [...exampleMenuItems] }
    ];

    return items;
  }, [
    compactViewMenuItems,
    editMenuItems,
    exampleMenuItems,
    flattenedFileMenuItems,
    viewMenuItems
  ]);

  const handleUnifiedMenuAction = useCallback((action: string) => {
    if (action.startsWith('example:')) {
      const exampleId = action.slice('example:'.length);
      const matchedExample = Object.values(exampleSystems)
        .flat()
        .find((example) => example.id === exampleId);

      if (matchedExample) {
        handleExampleLoad(matchedExample);
      }
      return;
    }

    switch (action) {
      default:
        handleCompactMenuAction(action);
    }
  }, [
    handleCompactMenuAction,
    handleExampleLoad
  ]);

  const attackPathEdgeIds = useMemo(() => {
    if (leftPanelTab !== 'attackpaths') return new Set<string>();
    const edgeIds = new Set<string>();
    for (const pathId of Array.from(expandedAttackPathIds)) {
      const path = attackPaths.find(p => p.id === pathId);
      if (path) {
        for (const step of path.steps) edgeIds.add(step.edgeId);
      }
    }
    if (isPathBuildingMode && selectedAttackPathId && !expandedAttackPathIds.has(selectedAttackPathId)) {
      const selected = attackPaths.find(p => p.id === selectedAttackPathId);
      if (selected) {
        for (const step of selected.steps) edgeIds.add(step.edgeId);
      }
    }
    return edgeIds;
  }, [attackPaths, expandedAttackPathIds, selectedAttackPathId, leftPanelTab, isPathBuildingMode]);

  const edgesWithAttackPath = useMemo(() => {
    const shouldAnnotate = attackPathEdgeIds.size > 0 || isPathBuildingMode;
    if (!shouldAnnotate) return edges;

    return edges.map(edge => ({
      ...edge,
      data: {
        ...(edge.data || {}),
        inAttackPath: attackPathEdgeIds.has(edge.id),
        isPathBuildingMode
      }
    }));
  }, [edges, attackPathEdgeIds, isPathBuildingMode]);

  // The full menu group needs room alongside the name field, including when a right panel is open.
  const compactToolbar = isCompactViewport || viewport.width - (shouldOffsetShellForAnalysis || isMethodologyGuideOpen ? Number.parseFloat(analysisPanelWidthPx) : 0) < 1750;

  return (
    <MenuProvider>
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        height: guardian ? '100%' : '100dvh',
        minHeight: guardian ? 0 : '100vh',
        width: '100%',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Main content container that will slide with panel */}
        <Box sx={{
          height: guardian ? '100%' : '100dvh',
          minHeight: guardian ? 0 : '100vh',
          display: 'flex',
          flexDirection: 'column',
          marginRight: shouldOffsetShellForAnalysis || isMethodologyGuideOpen ? analysisPanelWidthPx : 0,
          transition: 'margin-right 0.3s ease-in-out',
          position: 'relative',
          zIndex: 1
        }}>
          {/* AppBar */}
          <AppBar
            position="static"
            sx={{
              backgroundColor: currentTheme.colors.surface,
              borderBottom: 'none',
              boxShadow: 'none',
              display: hideToolbarForOpenPanel ? 'none' : 'flex'
            }}
          >
            <Toolbar
              sx={{
                minHeight: `${toolbarHeight}px !important`,
                px: isCompactViewport ? 1 : 2,
                gap: 1,
                display: 'grid',
                gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                alignItems: 'center'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0, pr: compactToolbar ? 0.5 : 2 }}>
                <Typography
                  variant="h6"
                  sx={{
                    color: currentTheme.colors.textPrimary,
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    flexShrink: 0
                  }}
                >
                  <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: isPhoneViewport ? 0 : 1 }}>
                    <Box component="span" sx={{
                      fontSize: '1.5rem',
                      background: `linear-gradient(135deg, ${currentTheme.colors.primary} 0%, ${currentTheme.colors.secondary} 100%)`,
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}>
                      ⟐
                    </Box>
                    {!isPhoneViewport && viewport.width >= 900 && (
                      <Box component="span" sx={{
                        background: `linear-gradient(135deg, ${currentTheme.colors.primary} 0%, ${currentTheme.colors.secondary} 100%)`,
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        fontWeight: 700,
                        letterSpacing: '0.5px'
                      }}>
                        ContextCypher
                      </Box>
                    )}
                  </Box>
                </Typography>
              </Box>

              <Box
                sx={{
                  minWidth: 0,
                  display: 'flex',
                    justifyContent: 'flex-start',
                    px: compactToolbar ? 0.5 : 2
                }}
              >
                <TextField
                  value={systemName}
                  onChange={handleSystemNameChange}
                  variant="outlined"
                  size="small"
                  placeholder="System name..."
                  sx={{
                    width: systemNameFieldWidth,
                    minWidth: 0,
                    maxWidth: '100%',
                    flexShrink: 1,
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: currentTheme.colors.surface,
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: currentTheme.colors.textPrimary,
                      '& fieldset': {
                        borderColor: currentTheme.colors.border,
                      },
                      '&:hover fieldset': {
                        borderColor: currentTheme.colors.primary,
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: currentTheme.colors.primary,
                      },
                    },
                    '& .MuiInputBase-input': {
                      padding: isCompactViewport ? '6px 10px' : '8px 12px',
                    },
                  }}
                />
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: isCompactViewport ? 0.25 : 0.5,
                  flexShrink: 0
                }}
              >
                {compactToolbar ? (
                  <>
                    {!showLeftToggle && (
                      <Tooltip title={isNodeToolboxOpen ? 'Close Components Panel' : 'Open Components Panel'} placement="bottom" arrow>
                        <IconButton
                          onClick={handleToggleNodeToolbox}
                          sx={{
                            color: currentTheme.colors.textPrimary,
                            '&:hover': { backgroundColor: currentTheme.colors.surfaceHover }
                          }}
                          aria-label="Toggle Components Panel"
                        >
                          {isNodeToolboxOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
                        </IconButton>
                      </Tooltip>
                    )}

                    {!showRightToggle && (
                      <Tooltip title={isAnalysisPanelOpen ? 'Close Analysis Panel' : 'Open Analysis Panel'} placement="bottom" arrow>
                        <IconButton
                          onClick={handleToggleAnalysisPanel}
                          sx={{
                            color: currentTheme.colors.textPrimary,
                            '&:hover': { backgroundColor: currentTheme.colors.surfaceHover }
                          }}
                          aria-label="Toggle Analysis Panel"
                        >
                          {isAnalysisPanelOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                        </IconButton>
                      </Tooltip>
                    )}

                    {isSmallTouchViewport && currentView === 'diagram' && (
                      <Tooltip
                        title={touchMultiSelectMode ? 'Disable multi-select mode' : 'Enable multi-select mode (drag to lasso)'}
                        placement="bottom"
                        arrow
                      >
                        <Button
                          size="small"
                          variant={touchMultiSelectMode ? 'contained' : 'outlined'}
                          color={touchMultiSelectMode ? 'primary' : 'inherit'}
                          disabled={isInteractiveLocked}
                          onClick={() => setTouchMultiSelectMode(prev => !prev)}
                          sx={{
                            textTransform: 'none',
                            fontSize: '0.72rem',
                            lineHeight: 1,
                            minWidth: 0,
                            px: 1,
                            py: 0.5,
                            borderColor: currentTheme.colors.border,
                            color: touchMultiSelectMode ? undefined : currentTheme.colors.textPrimary
                          }}
                          aria-label={touchMultiSelectMode ? 'Disable Multi-Select Mode' : 'Enable Multi-Select Mode'}
                        >
                          {touchMultiSelectMode ? 'Select On' : 'Select'}
                        </Button>
                      </Tooltip>
                    )}

                    <ToolbarMenu
                      label="Menu"
                      items={[...unifiedToolbarMenuItems] as any}
                      onItemClick={handleUnifiedMenuAction}
                      compactMode
                    />

                    {!grcHidden && (
                    <Tooltip title="Switch to GRC Module" placement="bottom" arrow>
                      <IconButton
                        onClick={() => onSwitchModule?.('grc')}
                        disabled={!onSwitchModule || activeModule === 'grc'}
                        sx={{
                          color: currentTheme.colors.textPrimary,
                          '&:hover': { backgroundColor: currentTheme.colors.surfaceHover }
                        }}
                        aria-label="Switch to GRC Module"
                      >
                        <Shield size={20} />
                      </IconButton>
                    </Tooltip>
                    )}

                    <Tooltip title="Settings" placement="bottom" arrow>
                      <IconButton
                        onClick={handleOpenSettings}
                        sx={{
                          color: currentTheme.colors.textPrimary,
                          '&:hover': { backgroundColor: currentTheme.colors.surfaceHover }
                        }}
                        aria-label="Settings"
                      >
                        <SettingsIcon size={20} />
                      </IconButton>
                    </Tooltip>
                  </>
                ) : (
                  <>
                    <ToolbarMenu label="File" items={[...fileMenuItems] as any} onItemClick={handleFileMenuAction} />
                    <ToolbarMenu label="Edit" items={[...editMenuItems] as any} onItemClick={handleEditMenuAction} />
                    <ToolbarMenu label="View" items={[...viewMenuItems] as any} onItemClick={handleViewMenuAction} />
                    <ExamplesDropdown onSelectExample={handleExampleLoad} />

                    {v2OnboardingEnabled && (
                      <Box sx={{ ml: 1, display: 'flex', alignItems: 'center' }}>
                        <ProcessSpine
                          theme={currentTheme}
                          state={spineState}
                          onStageClick={handleSpineStageClick}
                        />
                      </Box>
                    )}

                    {v2LensesEnabled && currentView === 'diagram' && (
                      <Box sx={{ ml: 1, display: 'flex', alignItems: 'center' }}>
                        <LensSwitcher
                          theme={currentTheme}
                          activeLens={activeLens}
                          onLensChange={(lens) => {
                            setActiveLens(lens);
                            if (lens === 'attackPath') setLeftPanelTab('attackpaths');
                          }}
                        />
                      </Box>
                    )}

                    <Box sx={{ mr: 0.5 }}>
                      <AutosaveCountdown
                        nextAutosaveAt={nextAutosaveAt}
                        enabled={settings.autosave.enabled && !guardian}
                      />
                    </Box>

                    {!showLeftToggle && (
                      <Tooltip title={isNodeToolboxOpen ? 'Close Components Panel' : 'Open Components Panel'} placement="bottom" arrow>
                        <IconButton
                          onClick={handleToggleNodeToolbox}
                          sx={{
                            color: currentTheme.colors.textPrimary,
                            '&:hover': { backgroundColor: currentTheme.colors.surfaceHover }
                          }}
                          aria-label="Toggle Components Panel"
                        >
                          {isNodeToolboxOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
                        </IconButton>
                      </Tooltip>
                    )}

                    {!showRightToggle && (
                      <Tooltip title={isAnalysisPanelOpen ? 'Close Analysis Panel' : 'Open Analysis Panel'} placement="bottom" arrow>
                        <IconButton
                          onClick={handleToggleAnalysisPanel}
                          sx={{
                            color: currentTheme.colors.textPrimary,
                            '&:hover': { backgroundColor: currentTheme.colors.surfaceHover }
                          }}
                          aria-label="Toggle Analysis Panel"
                        >
                          {isAnalysisPanelOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                        </IconButton>
                      </Tooltip>
                    )}

                    <Tooltip
                      title={settings.nodeDisplayMode === 'icon' ? 'Switch to Expanded Nodes' : 'Switch to Icon-Only Nodes'}
                      placement="bottom"
                      arrow
                    >
                      <IconButton
                        onClick={() => updateSettings({ nodeDisplayMode: settings.nodeDisplayMode === 'icon' ? 'expanded' : 'icon' })}
                        sx={{
                          color: currentTheme.colors.textPrimary,
                          '&:hover': { backgroundColor: currentTheme.colors.surfaceHover }
                        }}
                        aria-label="Toggle Node Display Mode"
                      >
                        {settings.nodeDisplayMode === 'icon' ? <Eye size={20} /> : <EyeOff size={20} />}
                      </IconButton>
                    </Tooltip>

                    <Tooltip
                      title={currentView === 'diagram' ? 'Switch to 3D Security View' : 'Switch to Diagram View'}
                      placement="bottom"
                      arrow
                    >
                      <IconButton
                        onClick={() => {
                          setCurrentView(currentView === 'diagram' ? 'isometric' : 'diagram');
                        }}
                        sx={{
                          color: currentTheme.colors.textPrimary,
                          '&:hover': { backgroundColor: currentTheme.colors.surfaceHover }
                        }}
                        aria-label="3D Security View"
                      >
                        <BoxIcon size={20} />
                      </IconButton>
                    </Tooltip>

                    {!grcHidden && (
                    <Tooltip title="Switch to GRC Module" placement="bottom" arrow>
                      <IconButton
                        onClick={() => onSwitchModule?.('grc')}
                        disabled={!onSwitchModule || activeModule === 'grc'}
                        sx={{
                          color: currentTheme.colors.textPrimary,
                          '&:hover': { backgroundColor: currentTheme.colors.surfaceHover }
                        }}
                        aria-label="Switch to GRC Module"
                      >
                        <Shield size={20} />
                      </IconButton>
                    </Tooltip>
                    )}

                    <Tooltip title="Settings" placement="bottom" arrow>
                      <IconButton
                        onClick={handleOpenSettings}
                        sx={{
                          color: currentTheme.colors.textPrimary,
                          '&:hover': { backgroundColor: currentTheme.colors.surfaceHover }
                        }}
                        aria-label="Settings"
                      >
                        <SettingsIcon size={20} />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
              </Box>
            </Toolbar>
          </AppBar>

          {/* Content area container */}
          <Box
            sx={{
              flexGrow: 1,
              display: 'flex',
              position: 'relative',
              overflow: 'hidden'
            }}
            onContextMenu={(e: React.MouseEvent) => {
              e.preventDefault();
            }}
          >
            {/* Flow canvas - Full width now */}
            <Box
              sx={{
                flexGrow: 1,
                position: 'relative',
                marginLeft: shouldOffsetCanvasForToolbox ? toolboxPanelWidthPx : '0',
                transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onContextMenu={(e: React.MouseEvent) => {
                e.preventDefault();
              }}
            >
              {v2OnboardingEnabled && showQuickPalette && currentView === 'diagram' && (
                <DfdQuickPalette
                  theme={currentTheme}
                  onNodeCreate={onNodeCreate}
                  onDragStart={onDragStart}
                  onClose={() => setShowQuickPalette(false)}
                />
              )}
              {v2LensesEnabled && currentView === 'diagram' && (
                <LensBanner
                  theme={currentTheme}
                  activeLens={activeLens}
                  detail={
                    activeLens === 'attackPath'
                      ? (attackPaths.find(p => p.id === selectedAttackPathId)?.name
                          ?? 'select a path in the Attack Paths panel')
                      : undefined
                  }
                  onExit={() => setActiveLens('model')}
                />
              )}
              <div
                ref={reactFlowWrapper}
                tabIndex={activeModule === 'diagram' && currentView === 'diagram' ? 0 : -1}
                role="region"
                aria-label="System diagram canvas"
                onKeyDown={onKeyDown}
                onKeyUp={onKeyUp}
                style={{
                  width: '100%',
                  height: '100%',
                  '--rf-controls-bg': currentTheme.colors.surface,
                  '--rf-controls-border': currentTheme.colors.border,
                  '--rf-controls-text': currentTheme.colors.textPrimary,
                  '--rf-controls-hover': currentTheme.colors.surfaceHover,
                  '--rf-controls-button-bg-active': currentTheme.colors.primary,
                  '--rf-controls-button-bg-active-hover': currentTheme.colors.primary
                } as React.CSSProperties}
                onContextMenu={(e) => {
                  // Prevent browser context menu to enable right-click panning
                  e.preventDefault();
                }}
              >
                {currentView === 'diagram' ? (
                  <DiagramLensProvider value={lensState}>
                  <DiagramEditorWithCopyPaste
                    ref={diagramEditorInnerRef}
                    keyboardShortcutsEnabled={activeModule === 'diagram'}
                    nodes={nodes as any}
                    edges={edgesWithAttackPath as any}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes as any}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onInit={setReactFlowInstance}
                    onDragOver={onDragOver}
                    onDrop={onDrop}
                    onNodeDoubleClick={onNodeDoubleClick}
                    onEdgeDoubleClick={handleEdgeDoubleClick}
                    onEdgeClick={onEdgeClick}
                    currentDrawingTool={currentDrawingTool}
                    isDrawingEditMode={isDrawingEditMode}
                    onNodeClick={onNodeClick}
                    onNodeMouseEnter={handleNodeMouseEnter}
                    onNodeMouseLeave={handleNodeMouseLeave}
                    onEdgeMouseEnter={handleEdgeMouseEnter}
                    onEdgeMouseLeave={handleEdgeMouseLeave}
                    onSelectionChange={onSelectionChange}
                    onPaneClick={handlePaneClick}
                    onMouseDown={handleCanvasMouseDown}
                    onKeyDown={undefined}
                    onKeyUp={undefined}
                    isInteractiveLocked={isInteractiveLocked}
                    snapToGrid={snapToGrid}
                    showGrid={showGrid}
                    showMinimap={showMinimap}
                    touchMultiSelectMode={isSmallTouchViewport && touchMultiSelectMode}
                    onToggleInteractiveLock={toggleInteractiveLock}
                    onCenterCanvas={centerCanvas}
                    onToggleSnapToGrid={handleToggleSnapToGrid}
                    defaultEdgeOptions={{
                      type: 'securityEdge',
                      style: { strokeWidth: 2 },
                      animated: false,
                    }}
                    proOptions={{
                      hideAttribution: true,
                    }}
                    isValidConnection={isValidConnection}
                    onConnectStart={onConnectStart}
                    onConnectEnd={onConnectEnd}
                    onEdgeUpdate={onEdgeUpdate}
                    reactFlowInstance={reactFlowInstance}
                  >
                    <DrawingLayer
                      isNodeToolboxOpen={isNodeToolboxOpen}
                      leftPanelWidth={toolboxPanelWidth}
                      snapToGrid={snapToGrid}
                      showGrid={showGrid}
                      showMinimap={showMinimap}
                      isInteractiveLocked={isInteractiveLocked}
                      onToggleSnapToGrid={handleToggleSnapToGrid}
                      onToggleGrid={() => setShowGrid(!showGrid)}
                      onToggleMinimap={() => setShowMinimap(!showMinimap)}
                      onToggleInteractiveLock={() => setIsInteractiveLocked(!isInteractiveLocked)}
                      onZoomIn={() => reactFlowInstance?.zoomIn()}
                      onZoomOut={() => reactFlowInstance?.zoomOut()}
                      onFitView={() => reactFlowInstance?.fitView()}
                      onDrawingEditModeChange={setIsDrawingEditMode}
                      onDrawingToolChange={(tool) => {
                        setCurrentDrawingTool(tool);
                      }}
                    />
                    {showGrid && (
                      <Background
                        color={currentTheme.name === 'dark' ? 'rgba(68,68,68,0.45)' : 'rgba(221,221,221,0.45)'}
                        gap={50}
                        size={1.5}
                      />
                    )}
                    {currentTheme.documentStyle && showDocumentBlocks && (
                      <DocumentFurniture
                        theme={currentTheme}
                        systemName={systemName}
                      />
                    )}
                  </DiagramEditorWithCopyPaste>
                  </DiagramLensProvider>
                ) : (
                  <IsometricScene
                    diagramData={{ nodes, edges }}
                    edgeMode={settings.edgeMode}
                    edgeStyle={settings.edgeStyle}
                    theme={currentTheme}
                    selectedNodeIds={selectedNodeIds}
                    onSelectionChange={(nodeIds) => {
                      // Update the nodes' selected state to sync with 2D view
                      setNodes(currentNodes =>
                        currentNodes.map(node => ({
                          ...node,
                          selected: nodeIds.includes(node.id)
                        }))
                      );
                      // Also update the selectedNodeIds for edge animations
                      setSelectedNodeIds(nodeIds);
                    }}
                    onNodeEdit={(nodeId) => {
                      const node = nodes.find(n => n.id === nodeId);
                      if (node) {
                        openNodeEditor(node);
                      }
                    }}
                    onEdgeEdit={(edgeId) => {
                      const edge = edges.find(e => e.id === edgeId);
                      if (edge) {
                        openEdgeEditor(edge as SecurityEdge);
                      }
                    }}
                  />
                )}
              </div>
            </Box>
          </Box>
        </Box>

        {showLeftToggle && (
          <Box
            onClick={handleToggleNodeToolbox}
            sx={{
              position: 'fixed',
              left: isNodeToolboxOpen ? toolboxPanelWidthPx : '0px',
              bottom: panelToggleBottomOffsetPx,
              transform: 'none',
              backgroundColor: currentTheme.colors.surface,
              border: `1px solid ${currentTheme.colors.border}`,
              borderLeft: isNodeToolboxOpen ? 'none' : `1px solid ${currentTheme.colors.border}`,
              borderRadius: isNodeToolboxOpen ? '0 8px 8px 0' : '0 8px 8px 0',
              zIndex: 800,
              padding: '12px 8px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
              minHeight: '80px',
              minWidth: '32px',
              color: currentTheme.colors.textPrimary,
              '&:hover': {
                backgroundColor: currentTheme.colors.surfaceHover,
                color: currentTheme.colors.primary,
                transform: 'translateX(2px)',
                transition: 'all 0.2s ease'
              },
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1), left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          >
            {isNodeToolboxOpen ? (
              <ChevronLeft size={20} />
            ) : (
              <ChevronRight size={20} />
            )}
            <Box
              sx={{
                writingMode: 'vertical-lr',
                textOrientation: 'mixed',
                fontSize: '0.7rem',
                fontWeight: 500,
                letterSpacing: '1px',
                marginTop: 1
              }}
            >
              TOOLBOX
            </Box>
          </Box>
        )}

        {/* Node Toolbox Drawer */}
        {!toolboxDocked && isNodeToolboxOpen && (
          <Box
            onClick={() => setIsNodeToolboxOpen(false)}
            sx={{
              position: 'fixed',
              top: appBarHeightPx,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.22)',
              zIndex: 1330
            }}
          />
        )}
        <Box
          aria-hidden={!isNodeToolboxOpen}
          sx={{
            position: 'fixed',
            left: 0,
            top: appBarHeightPx, // Below AppBar
            bottom: 0,
            width: toolboxFullscreen ? '100vw' : toolboxPanelWidthPx,
            height: `calc(${guardian ? '100%' : '100dvh'} - ${appBarHeightPx})`,
            minHeight: guardian ? 0 : `calc(100vh - ${appBarHeightPx})`,
            display: 'flex',
            transform: isNodeToolboxOpen
              ? 'translateX(0)'
              : `translateX(-${toolboxFullscreen ? '100vw' : toolboxPanelWidthPx})`,
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            zIndex: toolboxDocked ? 1000 : 1340,
            pointerEvents: isNodeToolboxOpen ? 'auto' : 'none',
            visibility: isNodeToolboxOpen ? 'visible' : 'hidden',
            isolation: 'isolate',
            willChange: 'transform',
          }}
        >
          <Box
            sx={{
              width: '100%',
              backgroundColor: currentTheme.colors.surface,
              borderRight: `1px solid ${currentTheme.colors.border}`,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              minHeight: 0,
              overflow: 'hidden'
            }}
          >
            {!toolboxDocked && (
              <Box
                sx={{
                  minHeight: 48,
                  px: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: `1px solid ${currentTheme.colors.border}`,
                  backgroundColor: currentTheme.colors.background
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Components & Analysis
                </Typography>
                <IconButton
                  onClick={() => setIsNodeToolboxOpen(false)}
                  size="small"
                  aria-label="Close Components Panel"
                  sx={{
                    color: currentTheme.colors.textSecondary,
                    '&:hover': {
                      backgroundColor: currentTheme.colors.surfaceHover,
                      color: currentTheme.colors.textPrimary
                    }
                  }}
                >
                  <X size={16} />
                </IconButton>
              </Box>
            )}
            {/* Tab Navigation */}
            <Box sx={{
              borderBottom: `1px solid ${currentTheme.colors.border}`,
              backgroundColor: currentTheme.colors.surface
            }}>
              <Tabs
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                value={leftPanelTab}
                onChange={(_: any, value: any) => {
                  setLeftPanelTab(value);
                }}
                sx={{
                  minWidth: 0,
                  maxWidth: '100%',
                  minHeight: 48,
                  '& .MuiTab-root': {
                    minHeight: 48,
                    textTransform: 'none',
                    fontSize: '14px'
                  }
                }}
              >
                <Tab value="toolbox" label="Components" />
                <Tab value="attackpaths" label="Attack Paths" sx={{ textTransform: 'none', fontSize: '14px' }} />
                <Tab value="analysis" label="Analysis" />
                {v2RegisterEnabled && <Tab value="register" label="Register" />}
              </Tabs>
            </Box>

            {/* Tab Content */}
            <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              {leftPanelTab === 'toolbox' && (
                <NodeToolbox
                  nodes={nodes}
                  edges={edges}
                  onDragStart={onDragStart}
                  onNodeCreate={onNodeCreate}
                  isCompactViewport={isCompactViewport}
                />
              )}
              {leftPanelTab === 'attackpaths' && (
                <AttackPathsPanel
                  nodes={nodes}
                  edges={edges}
                  attackPaths={attackPaths}
                  selectedPathId={selectedAttackPathId}
                  isPathBuildingMode={isPathBuildingMode}
                  expandedPathIds={expandedAttackPathIds}
                  onExpandedPathsChange={setExpandedAttackPathIds}
                  onAttackPathsChange={setAttackPaths}
                  onSelectedPathChange={setSelectedAttackPathId}
                  onPathBuildingModeChange={setIsPathBuildingMode}
                  onOpenMethodologyGuide={handleToggleMethodologyGuide}
                  onFocusNode={focusNodeNearPanel}
                  grcWorkspace={grcWorkspace as GrcWorkspace | undefined}
                  onSwitchModule={onSwitchModule}
                />
              )}
              {leftPanelTab === 'register' && v2RegisterEnabled && (
                <ThreatRegisterPanel
                  nodes={nodes}
                  onNodesUpdate={setNodes}
                  onFocusNode={focusNodeNearPanel}
                />
              )}
              {leftPanelTab === 'analysis' && (
                <ThreatAnalysisMainPanel
                  ref={threatAnalysisPanelRef}
                  nodes={nodes}
                  edges={edges}
                  selectedNodes={selectedNodes.map(node => node.id)}
                  onNodesUpdate={setNodes}
                  onCenterComponent={handleCenterComponent}
                  onSelectedNodesChange={(nodeIds) => {
                    // Update the selected property on the nodes
                    setNodes(currentNodes =>
                      currentNodes.map(node => ({
                        ...node,
                        selected: nodeIds.includes(node.id)
                      }))
                    );
                    // Also update selectedNodeIds for edge animations
                    setSelectedNodeIds(nodeIds);
                  }}
                  onEdgesUpdate={(updatedEdges) => {
                    console.log('ThreatAnalysisPanel onEdgesUpdate:', updatedEdges.length, 'edges');
                    setEdges(updatedEdges);

                    // Update QuickInspector if it's showing an edge that was updated
                    if (quickInspectorItem && 'source' in quickInspectorItem) {
                      const updatedEdge = updatedEdges.find(e => e.id === quickInspectorItem.id);
                      if (updatedEdge) {
                        setQuickInspectorItem(updatedEdge);
                      }
                    }
                  }}
                  defaultTab={0}
                  onOpenThreatIntelPanel={() => {
                    analysisPanelRef.current?.openIntelPanel();
                  }}
                />
              )}
            </Box>
          </Box>
        </Box>

        {showRightToggle && (
          <Box
            onClick={handleToggleAnalysisPanel}
            sx={{
              position: 'fixed',
              right: isAnalysisPanelOpen ? analysisPanelWidthPx : '0px',
              bottom: panelToggleBottomOffsetPx,
              transform: 'none',
              backgroundColor: currentTheme.colors.surface,
              border: `1px solid ${currentTheme.colors.border}`,
              borderRight: isAnalysisPanelOpen ? 'none' : `1px solid ${currentTheme.colors.border}`,
              borderRadius: isAnalysisPanelOpen ? '8px 0 0 8px' : '8px 0 0 8px',
              // Ensure the toggle is above the analysis panel (zIndex 1000) but below modal dialogs (zIndex 1300)
              zIndex: 1200,
              padding: '12px 8px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
              minHeight: '80px',
              minWidth: '32px',
              color: currentTheme.colors.textPrimary,
              '&:hover': {
                backgroundColor: currentTheme.colors.surfaceHover,
                color: currentTheme.colors.primary,
                transform: 'translateX(-2px)',
                transition: 'all 0.2s ease'
              },
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1), right 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          >
            {isAnalysisPanelOpen ? (
              <ChevronRight size={20} />
            ) : (
              <ChevronLeft size={20} />
            )}
            <Box
              sx={{
                writingMode: 'vertical-lr',
                textOrientation: 'mixed',
                fontSize: '0.7rem',
                fontWeight: 500,
                letterSpacing: '1px',
                marginTop: 1
              }}
            >
              ANALYSIS
            </Box>
          </Box>
        )}

        {/* Analysis Panel - Fixed position with isolation */}
        {!analysisDocked && isAnalysisPanelOpen && (
          <Box
            onClick={() => setIsAnalysisPanelOpen(false)}
            sx={{
              position: 'fixed',
              top: appBarHeightPx,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.22)',
              zIndex: 1350
            }}
          />
        )}
        <Box
          className="analysis-panel-container"
          data-testid="analysis-panel-container"
          aria-hidden={!isAnalysisPanelOpen}
          sx={{
            position: 'fixed', // Change back to fixed for stability
            right: 0,
            top: analysisDocked ? 0 : appBarHeightPx,
            bottom: 0,
            width: analysisFullscreen ? '100%' : analysisPanelWidthPx,
            maxWidth: '100%',
            boxSizing: 'border-box',
            height: analysisDocked ? (guardian ? '100%' : '100dvh') : `calc(${guardian ? '100%' : '100dvh'} - ${appBarHeightPx})`,
            minHeight: guardian ? 0 : analysisDocked ? '100vh' : `calc(100vh - ${appBarHeightPx})`,
            display: 'flex',
            transform: isAnalysisPanelOpen
              ? 'translateX(0)'
              : `translateX(${analysisFullscreen ? '100vw' : analysisPanelWidthPx})`,
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            zIndex: analysisDocked ? 1000 : 1360, // Higher z-index to ensure it stays on top
            pointerEvents: isAnalysisPanelOpen ? 'auto' : 'none',
            visibility: isAnalysisPanelOpen ? 'visible' : 'hidden',
            isolation: 'isolate', // Isolate the stacking context
            willChange: isAnalysisPanelOpen ? 'auto' : 'transform', // Only optimize when animating
            // Ensure text selection works properly
            userSelect: 'text',
            WebkitUserSelect: 'text',
            MozUserSelect: 'text',
            msUserSelect: 'text',
            // Prevent layout shifts
            backfaceVisibility: 'hidden',
            perspective: 1000,
            transformStyle: 'preserve-3d',
            touchAction: 'pan-y',
          }}
        >
          {/* Panel content */}
          <Box
            className="analysis-panel-inner"
            sx={{
              width: '100%',
              backgroundColor: currentTheme.colors.background,
              borderLeft: `1px solid ${currentTheme.colors.border}`,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              minHeight: 0,
              overflow: 'hidden',
              // Ensure text selection works properly
              userSelect: 'text',
              WebkitUserSelect: 'text',
              MozUserSelect: 'text',
              msUserSelect: 'text',
              touchAction: 'pan-y',
            }}
          >
            {!analysisDocked && (
              <Box
                sx={{
                  minHeight: 48,
                  px: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: `1px solid ${currentTheme.colors.border}`,
                  backgroundColor: currentTheme.colors.background
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  AI Threat Analysis
                </Typography>
                <IconButton
                  onClick={() => setIsAnalysisPanelOpen(false)}
                  size="small"
                  aria-label="Close Analysis Panel"
                  sx={{
                    color: currentTheme.colors.textSecondary,
                    '&:hover': {
                      backgroundColor: currentTheme.colors.surfaceHover,
                      color: currentTheme.colors.textPrimary
                    }
                  }}
                >
                  <X size={16} />
                </IconButton>
              </Box>
            )}
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <AnalysisPanel
                ref={analysisPanelRef}
                isOpen={isAnalysisPanelOpen}
                onToggle={handleToggleAnalysisPanel}
                onSendMessage={handleChat}
                onRequestAnalysis={onAnalyze}
                isAnalyzing={isAnalyzing}
                currentDiagram={currentDiagram}
                historyScope="diagram"
                onDiagramGenerated={(diagram, shouldMerge) => {
                  // Apply the generated diagram to the current editor
                  console.log('Applying generated diagram:', {
                    nodesCount: diagram.nodes?.length || 0,
                    edgesCount: diagram.edges?.length || 0,
                    edges: diagram.edges,
                    shouldMerge
                  });

                  if (diagram.nodes && diagram.edges) {
                    if (shouldMerge) {
                      // Merge with existing diagram
                      const currentExampleSystem: ExampleSystem = {
                        id: 'current',
                        name: 'Current Diagram',
                        description: 'Current diagram',
                        category: 'Enterprise Systems',
                        primaryZone: 'Internal' as SecurityZone,
                        dataClassification: 'Internal',
                        nodes: nodes,
                        edges: edges,
                        customContext: analysisState.customContext?.content || ''
                      };

                      const newExampleSystem: ExampleSystem = {
                        id: 'new',
                        name: diagram.name || 'Generated Diagram',
                        description: diagram.description || 'AI Generated',
                        category: diagram.category || 'Enterprise Systems',
                        primaryZone: diagram.primaryZone || 'Internal' as SecurityZone,
                        dataClassification: diagram.dataClassification || 'Internal',
                        nodes: diagram.nodes,
                        edges: diagram.edges,
                        customContext: diagram.customContext || ''
                      };

                      // Use the merge function
                      const mergedSystem = diagramGenerationService.mergeWithExistingDiagram(
                        currentExampleSystem,
                        newExampleSystem
                      );

                      // Apply the merged diagram
                      const mergedNodes = deserializeNodesFromLoad(mergedSystem.nodes);
                      const mergedNodesWithIndexCodes = updateNodesWithIndexCodes(mergedNodes);
                      setNodes(mergedNodesWithIndexCodes);
                      const migratedMergedEdges = migrateHandleIds(mergedSystem.edges);
                      const mergedEdgesWithIndexCodes = migrateEdgeIndexCodes(migratedMergedEdges, mergedNodesWithIndexCodes);
                      setEdges(mergedEdgesWithIndexCodes);

                      refreshNodeInternalsAfterCommit({ padding: 0.1, duration: 400 });

                      console.log('Applied merged diagram:', {
                        totalNodes: mergedSystem.nodes.length,
                        totalEdges: mergedSystem.edges.length,
                        originalNodes: nodes.length,
                        newNodes: diagram.nodes.length
                      });
                    } else {
                      // Replace with new diagram
                      // Close all floating windows before replacing the diagram
                      if (windowManager && windowManager.windows) {
                        windowManager.windows.forEach(window => {
                          windowManager.closeWindow(window.id);
                        });
                      }

                      const generatedNodes = deserializeNodesFromLoad(diagram.nodes);
                      const generatedNodesWithIndexCodes = updateNodesWithIndexCodes(generatedNodes);
                      setNodes(generatedNodesWithIndexCodes);
                      const migratedGeneratedEdges = migrateHandleIds(diagram.edges);
                      const generatedEdgesWithIndexCodes = migrateEdgeIndexCodes(migratedGeneratedEdges, generatedNodesWithIndexCodes);
                      setEdges(generatedEdgesWithIndexCodes);

                      refreshNodeInternalsAfterCommit({ padding: 0.1, duration: 400 });

                      console.log('Replaced with generated diagram:', {
                        appliedNodes: diagram.nodes.length,
                        appliedEdges: diagram.edges.length
                      });
                    }
                  }
                }}
                onSaveFile={async () => {
                  return await save() || false;
                }}
              />
            </Box>
          </Box>
        </Box>

        {/* Quick Inspector */}
        <QuickInspector
          item={quickInspectorItem}
          position={quickInspectorPosition}
          visible={showQuickInspector}
          onClose={() => setShowQuickInspector(false)}
          allNodes={nodes}
          onOpenFullEditor={() => {
            setShowQuickInspector(false);
            if (quickInspectorItem) {
              if ('source' in quickInspectorItem) {
                openEdgeEditor(quickInspectorItem as SecurityEdge);
              } else {
                openNodeEditor(quickInspectorItem as SecurityNode);
              }
            }
          }}
          onInspectorMouseEnter={handleInspectorMouseEnter}
          onInspectorMouseLeave={handleInspectorMouseLeave}
        />

        {/* Window Manager for floating panels */}
        {allowFloatingEditors && (
          <WindowManager
            nodes={nodes}
            edges={edges}
            onNodesUpdate={setNodes}
            manualFindings={manualFindings}
            onEdgesUpdate={(updatedEdges) => {
              console.log('WindowManager onEdgesUpdate:', updatedEdges.length, 'edges');
              const sampleEdge = updatedEdges[0];
              if (sampleEdge) {
                console.log('Sample edge data:', sampleEdge.data);
              }
              setEdges(updatedEdges);

              // Update QuickInspector if it's showing an edge that was updated
              if (quickInspectorItem && 'source' in quickInspectorItem) {
                const updatedEdge = updatedEdges.find(e => e.id === quickInspectorItem.id);
                if (updatedEdge) {
                  setQuickInspectorItem(updatedEdge);
                }
              }
            }}
            onAnalyzeNode={handleAnalyzeNode}
            onAnalyzeEdge={undefined}
            isAnalysisPanelOpen={isAnalysisPanelOpen}
            isNodeToolboxOpen={isNodeToolboxOpen}
            leftPanelWidth={toolboxPanelWidth}
            rightPanelWidth={analysisPanelWidth}
            onCenterOnNode={centerOnNode}
            onCenterOnEdge={centerOnEdge}
            onOpenAssessmentForZone={(zone, options) => {
              onSwitchModule?.('grc');
              window.dispatchEvent(new CustomEvent('grc-open-scope-assessment', {
                detail: {
                  zone,
                  diagramId: currentFile.name || 'active-diagram',
                  openRiskPlan: options?.openRiskPlan
                }
              }));
            }}
            onCreateAttackPath={(path) => {
              setAttackPaths(prev => [...prev, path]);
              setLeftPanelTab('attackpaths');
              setIsNodeToolboxOpen(true);
            }}
          />
        )}

        {/* Editors and Modals (only when not using floating windows) */}
        {!allowFloatingEditors && isEditing && selectedNode && (
          <NodeEditor
            key={selectedNode.id}
            node={nodes.find(n => n.id === selectedNode.id) || selectedNode}
            edges={edges}
            allNodes={nodes}
            onUpdate={handleNodeUpdate}
            onEdgesUpdate={(updatedEdges) => {
              setEdges(updatedEdges);
              trackChanges({
                nodes: nodes,
                edges: updatedEdges
              });
            }}
            onClose={() => {
              console.log('Closing editor');
              setIsEditing(false);
              setSelectedNode(null);
            }}
            isAnalysisPanelOpen={isAnalysisPanelOpen}
            isCompactViewport={isCompactViewport}
            leftPanelWidth={shouldOffsetCanvasForToolbox ? toolboxPanelWidth : 0}
            onAnalyzeNode={handleAnalyzeNode}
            onCenterOnNode={() => centerOnNode(selectedNode.id)}
            onOpenAssessmentForZone={(zone, options) => {
              onSwitchModule?.('grc');
              window.dispatchEvent(new CustomEvent('grc-open-scope-assessment', {
                detail: {
                  zone,
                  diagramId: currentFile.name || 'active-diagram',
                  openRiskPlan: options?.openRiskPlan
                }
              }));
            }}
            onCreateAttackPath={(path) => {
              setAttackPaths(prev => [...prev, path]);
              setLeftPanelTab('attackpaths');
              setIsNodeToolboxOpen(true);
            }}
          />
        )}
        {!allowFloatingEditors && selectedEdge && isEdgeEditorVisible && (
          <EdgeEditor
            key={`edge-editor-${selectedEdge.id}`}
            edge={edges.find(e => e.id === selectedEdge.id) || selectedEdge}
            onSave={handleEdgeSave}
            onClose={() => {
              console.log('Closing edge editor');
              setSelectedEdge(null);
              setIsEdgeEditorVisible(false);
            }}
            isAnalysisPanelOpen={isAnalysisPanelOpen}
            isCompactViewport={isCompactViewport}
            leftPanelWidth={shouldOffsetCanvasForToolbox ? toolboxPanelWidth : 0}
            allNodes={nodes}
            allEdges={edges}
            onAnalyzeEdge={handleAnalyzeEdge}
            onCenterOnEdge={() => centerOnEdge(selectedEdge.id)}
          />
        )}

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept=".json"
          onChange={onLoad}
        />

        {/* Methodology Guide Panel */}
        <Box
          aria-hidden={!isMethodologyGuideOpen}
          sx={{
            position: 'fixed',
            right: 0,
            top: 0,
            bottom: 0,
            width: analysisPanelWidthPx,
            maxWidth: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
            display: 'flex',
            transform: isMethodologyGuideOpen ? 'translateX(0)' : `translateX(${analysisPanelWidthPx})`,
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            zIndex: 1100,
            pointerEvents: isMethodologyGuideOpen ? 'auto' : 'none',
            visibility: isMethodologyGuideOpen ? 'visible' : 'hidden',
            borderLeft: `1px solid ${currentTheme.colors.border}`,
          }}
        >
          <Box sx={{ width: '100%', minWidth: 0, maxWidth: '100%', bgcolor: 'background.paper', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <MethodologyGuidePanel onClose={handleToggleMethodologyGuide} />
          </Box>
        </Box>

        {/* Settings drawer */}
        <SettingsDrawer
          open={isSettingsOpen}
          onClose={handleCloseSettings}
          edges={edges}
          onClearEdgeControlPoints={clearEdgeControlPoints}
        />

        {/* Autosave confirmation dialog */}
        <AutosaveConfirmDialog
          open={isAutosaveDialogOpen}
          onClose={handleAutosaveCancel}
          onConfirm={handleAutosaveConfirm}
          intervalMinutes={settings.autosave.intervalMinutes}
        />

        {/* Clear diagram confirmation dialog */}
        <ClearDiagramDialog
          open={isClearDialogOpen}
          onClose={() => setIsClearDialogOpen(false)}
          onConfirm={clearDiagram}
        />

        {/* Import diagram dialog */}
        <DiagramImportDialog
          open={isImportDialogOpen}
          onClose={() => setIsImportDialogOpen(false)}
          onImport={handleImportDiagram}
        />

        {/* Import confirmation dialog */}
        <ImportConfirmDialog
          open={isImportConfirmOpen}
          onClose={() => setIsImportConfirmOpen(false)}
          onSave={handleImportSave}
          onDiscard={handleImportDiscard}
          onCancel={handleImportCancel}
        />

        {/* v2 goal-based Get Started (feature-flagged) with legacy fallback */}
        {v2OnboardingEnabled && (
          <GetStartedDialog
            open={showOnboardingPrompt}
            onClose={handleDismissOnboardingPrompt}
            recentFiles={recentDiagramFiles}
            onOpenRecent={(file) => { void handleOpenRecentDiagramFromOnboarding(file as any); }}
            onStartManual={() => {
              clearDiagram();
              setShowQuickPalette(true);
            }}
            onOpenImport={() => setIsImportDialogOpen(true)}
            onKeepExample={() => { /* example stays loaded; just continue */ }}
            onDiagramGenerated={(diagram) => {
              if (diagram?.nodes && diagram?.edges) {
                const generatedNodes = deserializeNodesFromLoad(diagram.nodes);
                const generatedNodesWithIndexCodes = updateNodesWithIndexCodes(generatedNodes);
                setNodes(generatedNodesWithIndexCodes);
                const migratedGeneratedEdges = migrateHandleIds(diagram.edges);
                setEdges(migrateEdgeIndexCodes(migratedGeneratedEdges, generatedNodesWithIndexCodes));
                refreshNodeInternalsAfterCommit({ padding: 0.1, duration: 400 });
              }
            }}
            onSaveConfirmation={async () => 'continue'}
          />
        )}

        {v2OnboardingEnabled && (
          <ScopeDialog
            open={scopeDialogOpen}
            initial={parseScopeFromContext(analysisState.customContext?.content)}
            onClose={() => setScopeDialogOpen(false)}
            onSave={handleScopeSave}
          />
        )}

        {!v2OnboardingEnabled && <Dialog
          open={showOnboardingPrompt}
          onClose={handleDismissOnboardingPrompt}
          fullScreen={isPhoneViewport}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              ...dialogPaperStyles,
              borderRadius: isPhoneViewport ? 0 : '16px',
              maxHeight: isPhoneViewport ? '100dvh' : '90dvh',
              ...(isPhoneViewport && {
                height: '100dvh',
                display: 'flex',
                flexDirection: 'column'
              })
            }
          }}
        >
          <DialogTitle
            sx={{
              ...dialogTitleStyles,
              px: isPhoneViewport ? 2 : 3,
              py: isPhoneViewport ? 1.5 : 2
            }}
          >
            Get Started
          </DialogTitle>
          <DialogContent
            dividers
            sx={{
              backgroundColor: currentTheme.colors.surface,
              color: currentTheme.colors.textPrimary,
              px: isPhoneViewport ? 2 : 3,
              py: isPhoneViewport ? 1.5 : 2,
              overflowY: 'auto',
              flex: 1,
              minHeight: 0,
              WebkitOverflowScrolling: 'touch'
            }}
          >
            <Typography variant={isPhoneViewport ? 'body2' : 'body1'} sx={{ mb: 2 }}>
              We loaded the Vulnerable Web App example so you can explore the workspace. Would you like to clear it, open a saved diagram, or take a quick tour?
            </Typography>
            <Typography variant="subtitle2">
              Choose how you want to begin:
            </Typography>
            <Box component="ul" sx={{ pl: isPhoneViewport ? 2.5 : 3, mt: 1, mb: 0, color: currentTheme.colors.textSecondary }}>
              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                Start fresh with an empty canvas.
              </Typography>
              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                Keep the example diagram for reference.
              </Typography>
              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                Open an existing diagram (JSON) from your device.
              </Typography>
              <Typography component="li" variant="body2">
                Launch a three-step tutorial covering nodes, connections, and editors.
              </Typography>
            </Box>
            <Box
              sx={{
                mt: 2,
                pt: 2,
                borderTop: `1px solid ${currentTheme.colors.border}`
              }}
            >
              <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
                Recent Diagrams
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                Open recently used JSON files without using the file picker.
              </Typography>
              {recentDiagramFiles.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No recent diagrams yet. Open a JSON file once and it will appear here.
                </Typography>
              )}
              {recentDiagramFiles.length > 0 && (
                <Box sx={{ display: 'grid', gap: 1 }}>
                  {recentDiagramFiles.map(recentFile => (
                    <Button
                      key={recentFile.id}
                      variant="outlined"
                      onClick={() => void handleOpenRecentDiagramFromOnboarding(recentFile)}
                      sx={{
                        justifyContent: 'space-between',
                        textTransform: 'none',
                        borderColor: currentTheme.colors.border,
                        color: currentTheme.colors.textPrimary,
                        px: 1.5
                      }}
                    >
                      <Box sx={{ textAlign: 'left', overflow: 'hidden' }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {recentFile.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Last opened: {new Date(recentFile.lastOpenedAt).toLocaleString()}
                        </Typography>
                      </Box>
                    </Button>
                  ))}
                </Box>
              )}
            </Box>
          </DialogContent>
          <DialogActions
            sx={{
              px: isPhoneViewport ? 2 : 3,
              py: isPhoneViewport ? 1.5 : 2,
              borderTop: `1px solid ${currentTheme.colors.border}`,
              backgroundColor: currentTheme.colors.background,
              display: 'flex',
              flexDirection: isPhoneViewport ? 'column-reverse' : 'row',
              gap: isPhoneViewport ? 1 : 0.5,
              flexShrink: 0,
              '& > button': {
                width: isPhoneViewport ? '100%' : 'auto'
              }
            }}
          >
            <Button
              onClick={handleDismissOnboardingPrompt}
              sx={{
                color: currentTheme.colors.textSecondary,
                '&:hover': {
                  backgroundColor: currentTheme.colors.surfaceHover
                }
              }}
            >
              Keep Example
            </Button>
            <Button
              variant="outlined"
              onClick={handleStartFreshFromOnboarding}
              sx={{
                borderColor: currentTheme.colors.primary,
                color: currentTheme.colors.primary,
                '&:hover': {
                  backgroundColor: `${currentTheme.colors.primary}10`,
                  borderColor: currentTheme.colors.secondary
                }
              }}
            >
              Start Fresh
            </Button>
            <Button
              variant="outlined"
              onClick={handleOpenDiagramFromOnboarding}
              sx={{
                borderColor: currentTheme.colors.primary,
                color: currentTheme.colors.primary,
                '&:hover': {
                  backgroundColor: `${currentTheme.colors.primary}10`,
                  borderColor: currentTheme.colors.secondary
                }
              }}
            >
              Open Diagram
            </Button>
            <Button
              variant="contained"
              onClick={handleStartTutorial}
              sx={{
                backgroundColor: currentTheme.colors.primary,
                color: currentTheme.colors.background,
                '&:hover': {
                  backgroundColor: currentTheme.colors.secondary
                }
              }}
            >
              Launch Tutorial
            </Button>
          </DialogActions>
        </Dialog>}

        <Dialog
          open={showTutorialDialog}
          onClose={handleCloseTutorial}
          fullScreen={isPhoneViewport}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              ...dialogPaperStyles,
              borderRadius: isPhoneViewport ? 0 : '16px',
              maxHeight: isPhoneViewport ? '100dvh' : '90dvh',
              ...(isPhoneViewport && {
                height: '100dvh',
                display: 'flex',
                flexDirection: 'column'
              })
            }
          }}
        >
          <DialogTitle
            sx={{
              ...dialogTitleStyles,
              px: isPhoneViewport ? 2 : 3,
              py: isPhoneViewport ? 1.5 : 2
            }}
          >
            Quick Tutorial
          </DialogTitle>
          <DialogContent
            dividers
            sx={{
              backgroundColor: currentTheme.colors.surface,
              color: currentTheme.colors.textPrimary,
              px: isPhoneViewport ? 2 : 3,
              py: isPhoneViewport ? 1.5 : 2,
              overflowY: 'auto',
              flex: 1,
              minHeight: 0,
              WebkitOverflowScrolling: 'touch'
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Step {tutorialStepIndex + 1} of {totalTutorialSteps}
            </Typography>
            {currentTutorialStep && (
              <>
                <Typography variant={isPhoneViewport ? 'subtitle1' : 'h6'} sx={{ mt: 1 }}>
                  {currentTutorialStep.title}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, color: currentTheme.colors.textSecondary }}>
                  {currentTutorialStep.description}
                </Typography>
                <Box component="ul" sx={{ pl: isPhoneViewport ? 2.5 : 3, mt: 2, color: currentTheme.colors.textSecondary }}>
                  {currentTutorialStep.tips.map((tip, index) => (
                    <Typography component="li" variant="body2" sx={{ mb: 0.5 }} key={`tutorial-tip-${index}`}>
                      {tip}
                    </Typography>
                  ))}
                </Box>
              </>
            )}
          </DialogContent>
          <DialogActions
            sx={{
              px: isPhoneViewport ? 2 : 3,
              py: isPhoneViewport ? 1.5 : 2,
              borderTop: `1px solid ${currentTheme.colors.border}`,
              backgroundColor: currentTheme.colors.background,
              display: 'flex',
              flexDirection: isPhoneViewport ? 'column-reverse' : 'row',
              gap: isPhoneViewport ? 1 : 0.5,
              flexShrink: 0,
              '& > button': {
                width: isPhoneViewport ? '100%' : 'auto'
              }
            }}
          >
            <Button
              onClick={handleCloseTutorial}
              sx={{
                color: currentTheme.colors.textSecondary,
                '&:hover': {
                  backgroundColor: currentTheme.colors.surfaceHover
                }
              }}
            >
              Close
            </Button>
            <Button
              onClick={handlePreviousTutorialStep}
              disabled={tutorialStepIndex === 0}
              sx={{
                color: currentTheme.colors.textPrimary,
                opacity: tutorialStepIndex === 0 ? 0.6 : 1,
                '&:hover': {
                  backgroundColor: tutorialStepIndex === 0 ? 'transparent' : currentTheme.colors.surfaceHover
                }
              }}
            >
              Back
            </Button>
            {tutorialStepIndex < totalTutorialSteps - 1 ? (
              <Button
                variant="contained"
                onClick={handleNextTutorialStep}
                sx={{
                  backgroundColor: currentTheme.colors.primary,
                  color: currentTheme.colors.background,
                  '&:hover': {
                    backgroundColor: currentTheme.colors.secondary
                  }
                }}
              >
                Next
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleFinishTutorial}
                sx={{
                  backgroundColor: currentTheme.colors.primary,
                  color: currentTheme.colors.background,
                  '&:hover': {
                    backgroundColor: currentTheme.colors.secondary
                  }
                }}
              >
                Finish
              </Button>
            )}
          </DialogActions>
        </Dialog>
      </Box>
    </MenuProvider>
  );
};

// Wrapper component to provide WindowManager context and Toast notifications
const DiagramEditorWithWindowManager: React.FC<DiagramEditorProps> = (props) => {
  return (
    <ToastProvider>
      <WindowManagerProvider>
        <DiagramEditor {...props} />
      </WindowManagerProvider>
    </ToastProvider>
  );
};

export default DiagramEditorWithWindowManager;
