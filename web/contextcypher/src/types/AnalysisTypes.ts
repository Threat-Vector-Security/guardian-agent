// src/types/AnalysisTypes.ts

import { SecurityNode, SecurityEdge, SecurityZone, DiagramMetadata } from './SecurityTypes';
import { ChatMessage } from './ChatTypes';
import { colors } from '../styles/Theme';
import { 
  ThreatIntelData, 
  NodeAnalysis, 
  ConnectionAnalysis
} from './ThreatIntelTypes';   
import { ThreatIntelState } from './ThreatIntelTypes';

// Base metadata interface that can be shared
export interface BaseMetadata {
  lastModified?: Date;
  version?: string;
  zoneConfiguration?: Record<string, any>;
  isChangeAnalysis?: boolean;
  previousVersion?: string;
  isSanitized?: boolean;
  systemType?: string;
  isInitialSystem?: boolean;
  customContext?: CustomContext;
  sanitizationTimestamp?: string;
  environment?: string;
  analysisMode?: 'pasta';
  timestamp?: Date;
}

export interface DiagramData {
  nodes: SecurityNode[];
  edges: SecurityEdge[];
  metadata?: BaseMetadata;
}

// Drawing Types
export type DrawingTool = 'select' | 'pencil' | 'rectangle' | 'circle' | 'arrow' | 'text' | 'eraser';

export interface Point {
  x: number;
  y: number;
}

export interface DrawingStyle {
  stroke: string;
  strokeWidth: number;
  opacity: number;
  strokeDasharray?: string;
  fill?: string;
  fillOpacity?: number;
  fontSize?: number;
}

export interface Drawing {
  id: string;
  type: DrawingTool;
  path?: string;
  text?: string;
  position?: Point;
  style: DrawingStyle;
  associatedNodeId?: string;
  relativePosition?: Point;
  // Enhanced spatial metadata
  bounds?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
  nearbyNodes?: Array<{
    nodeId: string;
    nodeLabel: string;
    nodeType: string;
    distance: number;
    direction: 'north' | 'south' | 'east' | 'west' | 'northeast' | 'northwest' | 'southeast' | 'southwest' | 'center';
    isZone?: boolean; // Indicates if this is a security zone node
  }>;
  overlappingNodes?: string[]; // Node IDs that the drawing overlaps
  nearbyEdges?: Array<{
    edgeId: string;
    sourceLabel: string;
    targetLabel: string;
    distance: number; // Distance to nearest point on edge
    protocol?: string;
    encryption?: string;
    securityLevel?: string;
  }>;
  // Geometric relationships for precise drawing context
  geometricRelationships?: {
    connectsNodes?: {
      source?: {
        id: string;
        label: string;
        type: string;
      } | null;
      target?: {
        id: string;
        label: string;
        type: string;
      } | null;
    };
    containsNodes?: Array<{
      id: string;
      label: string;
      type: string;
    }>;
    textAnnotation?: {
      text: string;
      closestNode?: {
        id: string;
        label: string;
        type: string;
        distance: number;
      } | null;
      closestEdge?: {
        source: string;
        target: string;
        distance: number;
      } | null;
    };
    arrowContext?: {
      startPoint: {
        closestNode?: {
          id: string;
          label: string;
          type: string;
          distance: number;
        } | null;
        closestEdge?: {
          id: string;
          source: string;
          target: string;
          distance: number;
        } | null;
      };
      endPoint: {
        closestNode?: {
          id: string;
          label: string;
          type: string;
          distance: number;
        } | null;
        closestEdge?: {
          id: string;
          source: string;
          target: string;
          distance: number;
        } | null;
      };
    };
  };
  description?: string; // Optional user-provided description
  timestamp?: Date;
}

export interface CustomContext {
  content: string;
  sanitizedContent: string;
  timestamp: Date;
}

export interface DiagramChanges {
  nodes: {
    added: SecurityNode[];
    modified: SecurityNode[];
    removed: SecurityNode[];
  };
  edges: {
    added: SecurityEdge[];
    modified: SecurityEdge[];
    removed: SecurityEdge[];
  };
  zones: {
    added: SecurityZone[];
    modified: SecurityZone[];
    removed: SecurityZone[];
  };
  metadata: {
    timestamp: Date;
    changeType: 'node' | 'edge' | 'zone';
    batchId: string;
  };
  threatIntel: ThreatIntelState;
}

export interface AnalysisMetadata {
  lastAnalysis: Date;
  pendingChanges: boolean;
  analysisInProgress: boolean;
}

export interface AnalysisContextState {
  previousState: DiagramData | null;
  currentState: DiagramData | null;
  changes: DiagramChanges;
  messageHistory: ChatMessage[];
  customContext: CustomContext | null;
  analysisMetadata: AnalysisMetadata;
  drawings: Drawing[];
  threatIntel: ThreatIntelState;
}

export interface AnalysisContextValue {
  // State
  state: AnalysisContextState;

  // Message Management
  addMessage: (message: ChatMessage) => void;
  removeMessage: (messageId: string) => void;
  clearMessages: () => void;
  readonly messageHistory: ChatMessage[];  // Read-only access to messages

  // Drawing Management
  addDrawing: (drawing: Drawing) => void;
  updateDrawing: (drawing: Drawing) => void;
  removeDrawing: (drawingId: string) => void;
  clearDrawings: () => void;
  readonly drawings: Drawing[];  // Read-only access to drawings

  // Context Management
  trackChanges: (newState: DiagramData) => void;
  setAnalysisStatus: (status: boolean) => void;
  setCustomContext: (context: CustomContext | null) => void;
  readonly customContext: CustomContext | null;  // Read-only access to context

  // Threat Intel Management
  updateThreatIntel: (data: ThreatIntelData | null) => void;
  setThreatIntelLoading: (isLoading: boolean) => void;
  updateNodeAnalysis: (nodeId: string, analysis: NodeAnalysis) => void;
  updateConnectionAnalysis: (connectionId: string, analysis: ConnectionAnalysis) => void;
  readonly threatIntel: ThreatIntelState;  // Read-only access to threat intel
}

export interface SavedDiagramData {
  nodes: SecurityNode[];
  edges: SecurityEdge[];
  metadata: {
    version: string;
    created: string;
    type: string;
    zoneTypes?: SecurityZone[];
  };
  analysisContext: {
    messageHistory: ChatMessage[];
    lastAnalyzedState: {
      nodes: SecurityNode[];
      edges: SecurityEdge[];
      drawings: Drawing[];
    } | null;
    customContext?: {
      content: string;
      sanitizedContent: string;
      timestamp: Date;
    };
    importedThreatIntel?: {
      raw: string;
      processed: any;
      filtered?: string;
      metadata: {
        totalImported: number;
        relevantExtracted: number;
        importDate: string;
        source: string;
        format?: 'stix' | 'csv' | 'json' | 'misp' | 'unknown';
        topThreats?: string[];
        matchedComponents?: string[];
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
}

// Enhanced drawing styles with proper typing
export const DRAWING_STYLES: Record<DrawingTool, DrawingStyle> = {
  select: {
    stroke: '#000000',
    strokeWidth: 1,
    opacity: 1,
    strokeDasharray: undefined,
  },
  pencil: {
    stroke: '#000000',
    strokeWidth: 1,
    opacity: 0.8,
    strokeDasharray: undefined,
  },
  rectangle: {
    stroke: '#1565C0',
    strokeWidth: 2,
    opacity: 0.7,
    fill: 'none',
    strokeDasharray: undefined,
  },
  circle: {
    stroke: '#2E7D32',
    strokeWidth: 2,
    opacity: 0.7,
    fill: 'none',
    strokeDasharray: undefined,
  },
  arrow: {
    stroke: '#E65100',
    strokeWidth: 2,
    opacity: 0.9,
    strokeDasharray: undefined,
  },
  text: {
    stroke: '#000000',
    strokeWidth: 1,
    opacity: 1,
    fontSize: 14,
    strokeDasharray: undefined,
  },
  eraser: {
    stroke: colors.error,
    strokeWidth: 20,
    opacity: 0.3,
    strokeDasharray: undefined,
  }
};

// Helper functions
export const getDefaultStyle = (tool: DrawingTool): DrawingStyle => {
  return DRAWING_STYLES[tool];
};

export const adjustStyleForZoom = (style: DrawingStyle, zoom: number): DrawingStyle => {
  return {
    ...style,
    strokeWidth: (style.strokeWidth ?? 1) / zoom,
    fontSize: style.fontSize ? style.fontSize / zoom : undefined
  };
};

export const defaultDrawingConfig = {
  minTextSize: 10,
  maxTextSize: 32,
  calloutPadding: 8,
  arrowHeadSize: 8,
  defaultOpacity: 0.8,
  selectedOpacity: 1,
  hoverOpacity: 0.9,
  gridSnap: 5,
  minDimension: 20,
  maxDimension: 500
} as const;

export interface ToolboxConfig {
  position: {
    top: number;
    right: number;
  };
  spacing: {
    group: number;
    item: number;
  };
  dimensions: {
    button: {
      width: number;
      height: number;
    };
    icon: {
      size: number;
    };
  };
}

export const defaultToolboxConfig: ToolboxConfig = {
  position: {
    top: 20,
    right: 20
  },
  spacing: {
    group: 8,
    item: 4
  },
  dimensions: {
    button: {
      width: 32,
      height: 32
    },
    icon: {
      size: 18
    }
  }
};

export interface ShapeDimensions {
  width: number;
  height: number;
  x: number;
  y: number;
}

export type DrawingAction = 
  | { type: 'ADD_DRAWING'; payload: Drawing }
  | { type: 'UPDATE_DRAWING'; payload: Drawing }
  | { type: 'REMOVE_DRAWING'; payload: string }
  | { type: 'CLEAR_DRAWINGS' }
  | { type: 'UPDATE_DRAWING_TEXT'; payload: { id: string; text: string } }
  | { type: 'UPDATE_DRAWING_STYLE'; payload: { id: string; style: Partial<DrawingStyle> } }
  | { type: 'UPDATE_DRAWING_POSITION'; payload: { id: string; position: { x: number; y: number } } };

// Helper functions
export const calculateShapeDimensions = (
  startPos: Point,
  currentPos: Point
): ShapeDimensions => {
  const width = Math.abs(currentPos.x - startPos.x);
  const height = Math.abs(currentPos.y - startPos.y);
  const x = Math.min(startPos.x, currentPos.x);
  const y = Math.min(startPos.y, currentPos.y);
  return { width, height, x, y };
};

export interface StyleSettings extends DrawingStyle {
  type: DrawingTool;
}

// Security Assessment
export interface SecurityAssessment {
  metadata: {
    date: string;
    version: string;
    diagramName?: string;
    analyst?: string;
  };
}

// Analysis Context
export interface AnalysisContext {
  diagram: DiagramData;  // Keep both diagram and diagramState for backward compatibility
  diagramState?: DiagramData;
  customContext: CustomContext | null;
  messageHistory: ChatMessage[];  // Keep both messageHistory and chatHistory
  chatHistory?: ChatMessage[];
  threatIntel?: ThreatIntelData | null;
  importedThreatIntel?: {
    raw: string;
    processed: any;
    filtered?: string;
    metadata: {
      totalImported: number;
      relevantExtracted: number;
      importDate: string;
      source: string;
      format?: 'stix' | 'csv' | 'json' | 'misp' | 'unknown';
      topThreats?: string[];
      matchedComponents?: string[];
    };
  };
  metadata?: BaseMetadata;
  analysisHistory?: AnalysisResult[];
  previousDiagram?: DiagramData | null;  // Track previous state for change detection
  diagramChanges?: string[];  // List of recent changes
  additionalContext?: string;  // Previously identified threats from automated analysis
}

export interface ThreatAnalysisState {
  data: ThreatIntelData | null;
  lastUpdated: Date | null;
  isLoading: boolean;
  error: Error | null;
  nodeAnalysis: Record<string, NodeAnalysis>;
  connectionAnalysis: Record<string, ConnectionAnalysis>;
}

export interface SanitizationMetadata {
  status: 'sanitized' | 'failed';
  timestamp: string;
  message?: string;
  preservedProperties: string[];
  isSanitized: boolean;
}

export interface SanitizationResult extends Omit<DiagramData, 'metadata'> {
  metadata: SanitizationMetadata & Partial<DiagramMetadata>;
}

export interface AnalysisResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  metadata?: {
    provider?: string;
    threatIntelSources?: {
      mitre: number;
      github: number;
      alienVault: number;
      nvd: number;
    };
    timestamp: string;
    isAnalysis?: boolean;
    tokenInfo?: {
      promptTokens: number;
      responseTokens: number;
      totalTokens: number;
    };
  };
}

// Add ApiResponse type
export interface ApiResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  threatIntelData?: ThreatIntelData;
  metadata?: {
    provider?: string;
    threatIntelSources?: {
      severity?: string;
      affectedNodes?: string[];
      mitre?: number;
      github?: number;
      alienVault?: number;
      nvd?: number;
    };
    timestamp: string;
    isAnalysis?: boolean;
    tokenInfo?: {
      promptTokens: number;
      responseTokens: number;
      totalTokens: number;
    };
  };
}

// Update AdditionalContext interface
export interface AdditionalContext {
  customContext?: CustomContext | null;
  threatIntel?: ThreatIntelData | null;
  messageHistory?: ChatMessage[];
  metadata?: {
    timestamp: string;
    version?: string;
    environment?: string;
    isAnalysis?: boolean;
    hasCustomContext?: boolean;
    systemType?: string;
    isInitialSystem?: boolean;
    isSanitized?: boolean;
  };
}

// MCP Types
export interface ContextWindow {
  id: string;
  content: string;
  type: 'diagram' | 'chat' | 'custom' | 'system';
  timestamp: Date;
  relevanceScore: number;
  metadata: {
    source: string;
    version: string;
  };
}

export interface MCPContext {
  diagramState: DiagramData;
  customContext: CustomContext | null;
  chatHistory: ChatMessage[];
  analysisHistory: AnalysisResult[];
  relevantContext?: string;
  recentChanges?: string;
  systemState?: string;
  metadata: {
    version: string;
    timestamp: Date;
    contextScore: number;
  };
}

export interface MCPServiceConfig {
  windowSize?: number;
  minRelevanceScore?: number;
  maxWindows?: number;
}

export interface AnalysisResult {
  id: string;
  timestamp: Date;
  content: string;
  type: 'security' | 'architecture' | 'compliance';
  metadata?: Record<string, unknown>;
}
