import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useReactFlow, useKeyPress, Node, useStore, useStoreApi, ReactFlowState, useNodes, useEdges, addEdge } from '@xyflow/react';
import { useAnalysisContext } from './AnalysisContextProvider';
import { 
  Drawing, 
  DrawingTool, 
  DrawingStyle, 
  Point,
  StyleSettings
} from '../types/AnalysisTypes';
import { 
  Box, 
  IconButton, 
  Tooltip, 
  Popover,
  Slider,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Stack,
  Typography,
  Divider,
  useTheme,
  Chip,
  Button,
  ButtonGroup,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  alpha
} from '@mui/material';
import { colors } from '../styles/Theme';
import { getResponsivePanelWidths } from '../styles/layout';
import useViewportLayout from '../hooks/useViewportLayout';
import { HexColorPicker } from 'react-colorful';
import { 
  ArrowRight, Circle, MousePointer, Pencil, Settings, Square, Type, Eraser, Ban,
  Grid3x3, Eye, EyeOff, Map as MapIcon, Lock, Unlock, ZoomIn, ZoomOut, Maximize,
  Hand, Edit, Palette, RotateCcw, Save
} from 'lucide-react';
import { calculateDrawingMetadata, calculateBoundsFromPath } from '../utils/drawingMetadata';
import { SecurityNode, SecurityEdge } from '../types/SecurityTypes';
import { Points } from '../types/DrawingTypes';
import { getDrawingBounds, pointsToPath, pointsToSimplePath } from '../utils/drawingPath';
import { DrawingAnalyzer } from '../services/DrawingAnalyzer';
import { drawingStyleService } from '../services/DrawingStyleService';

// Load saved styles or use defaults
const loadDefaultStyles = (): Record<DrawingTool, DrawingStyle> => {
  const savedStyles = drawingStyleService.loadStyles();
  
  const defaults: Record<DrawingTool, DrawingStyle> = {
    select: {
      stroke: colors.textPrimary,
      strokeWidth: 1,
      opacity: 1,
      strokeDasharray: undefined,
      fill: 'none',
      fontSize: undefined
    },
    pencil: savedStyles?.pencil || {
      stroke: colors.textPrimary,
      strokeWidth: 2,
      opacity: 0.9,
      strokeDasharray: undefined,
      fill: 'none',
      fillOpacity: 0,
      fontSize: undefined
    },
    rectangle: savedStyles?.rectangle || {
      stroke: colors.primary,
      strokeWidth: 2,
      opacity: 0.7,
      strokeDasharray: undefined,
      fill: 'none',
      fillOpacity: 0,
      fontSize: undefined
    },
    circle: savedStyles?.circle || {
      stroke: colors.success,
      strokeWidth: 2,
      opacity: 0.7,
      strokeDasharray: undefined,
      fill: 'none',
      fillOpacity: 0,
      fontSize: undefined
    },
    arrow: savedStyles?.arrow || {
      stroke: colors.warning,
      strokeWidth: 2,
      opacity: 0.9,
      strokeDasharray: undefined,
      fill: 'none',
      fontSize: undefined
    },
    text: savedStyles?.text || {
      stroke: colors.textPrimary,
      strokeWidth: 1,
      opacity: 1,
      strokeDasharray: undefined,
      fill: colors.textPrimary,
      fontSize: 18
    },
    eraser: {
      stroke: colors.error,
      strokeWidth: 20,
      opacity: 0.3,
      strokeDasharray: undefined,
      fill: 'none',
      fontSize: undefined
    }
  };
  
  return defaults;
};

const DEFAULT_STYLES = loadDefaultStyles();

// Helper function to get initial style for a tool
export const getInitialStyle = (tool: DrawingTool): DrawingStyle => {
  const DEFAULT_STYLES = loadDefaultStyles();
  return {
    ...DEFAULT_STYLES[tool],
    // Deep clone to avoid reference issues
    fill: DEFAULT_STYLES[tool].fill,
    strokeDasharray: DEFAULT_STYLES[tool].strokeDasharray,
    fontSize: DEFAULT_STYLES[tool].fontSize
  };
};
  
// Helper to merge style with tool defaults
export const mergeWithDefaultStyle = (tool: DrawingTool, style: Partial<DrawingStyle>): DrawingStyle => {
  const DEFAULT_STYLES = loadDefaultStyles();
  return {
    ...DEFAULT_STYLES[tool],
    ...style
  };
};

// Update DASH_PATTERNS as well
const DASH_PATTERNS = [
  { label: 'Solid', value: 'none' },
  { label: 'Dashed', value: '5,5' },
  { label: 'Dotted', value: '2,2' },
  { label: 'Dash-Dot', value: '10,5,2,5' }
] as const;

const DEFAULT_DRAWING_LAYOUT = getResponsivePanelWidths(typeof window !== 'undefined' ? window.innerWidth : 1440);

// Function to scale dash pattern based on stroke width
const scaleDashPattern = (pattern: string | undefined, strokeWidth: number): string | undefined => {
  if (!pattern || pattern === 'none' || !strokeWidth) return undefined;
  
  // Base stroke width for the patterns (designed for 2px lines)
  const baseWidth = 2;
  const scale = strokeWidth / baseWidth;
  
  // Parse and scale each number in the pattern
  return pattern.split(',').map(val => {
    const num = parseFloat(val.trim());
    return Math.round(num * scale).toString();
  }).join(',');
};

  const TOOL_SHORTCUTS: Record<string, DrawingTool> = {
    v: 'select',
    p: 'pencil',
    r: 'rectangle',
    c: 'circle',
    w: 'arrow',
    t: 'text'
  };


  interface StylePanelProps {
    settings: StyleSettings;
    onUpdate: (newSettings: StyleSettings) => void;
  }

  const StylePanel: React.FC<StylePanelProps> = ({ settings, onUpdate }) => {
  const theme = useTheme();
  const [currentStrokeColor, setCurrentStrokeColor] = useState(settings.stroke || theme.colors.textPrimary);
  const [currentFillColor, setCurrentFillColor] = useState(settings.fill ?? 'transparent');
  const [savedMessage, setSavedMessage] = useState(false);
  const isShapeTool = ['rectangle', 'circle'].includes(settings.type);
  const isFreehandTool = settings.type === 'pencil';
  
  // Update colors when settings change (e.g., when switching tools)
  useEffect(() => {
    setCurrentStrokeColor(settings.stroke || theme.colors.textPrimary);
    setCurrentFillColor(settings.fill ?? 'transparent');
  }, [settings.stroke, settings.fill, theme.colors.textPrimary]);

  const updateSettings = useCallback((updates: Partial<DrawingStyle>) => {
    const newSettings = {
      ...settings,
      ...updates,
      type: settings.type,
      strokeWidth: updates.strokeWidth ?? settings.strokeWidth ?? 1,
      opacity: updates.opacity ?? settings.opacity ?? 1
    };
    onUpdate(newSettings);
    
    // Save to localStorage for persistence
    if (settings.type !== 'select' && settings.type !== 'eraser') {
      drawingStyleService.saveToolStyle(settings.type as any, newSettings);
      setSavedMessage(true);
      setTimeout(() => setSavedMessage(false), 2000);
    }
  }, [settings, onUpdate]);

  const resetToDefaults = useCallback(() => {
    const defaultStyle = {
      ...DEFAULT_STYLES[settings.type],
      type: settings.type
    };
    onUpdate(defaultStyle);
    if (settings.type !== 'select' && settings.type !== 'eraser') {
      drawingStyleService.saveToolStyle(settings.type as any, defaultStyle);
    }
  }, [settings.type, onUpdate]);

  return (
    <Paper 
      elevation={3}
      sx={{ 
        width: '320px',
        background: theme.colors.surface,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '12px',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <Box sx={{ 
        p: 2, 
        background: alpha(theme.colors.primary, 0.05),
        borderBottom: `1px solid ${theme.colors.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Palette size={20} color={theme.colors.primary} />
          <Typography variant="subtitle1" fontWeight={600}>
            Style Settings
          </Typography>
        </Box>
        {savedMessage && (
          <Chip 
            label="Saved" 
            size="small" 
            color="success" 
            sx={{ opacity: 0.8 }}
          />
        )}
      </Box>
      
      <Box sx={{ p: 2 }}>
        <Stack spacing={3}>
          {/* Stroke Settings */}
          <Box>
            <Typography variant="subtitle2" sx={{ 
              color: theme.colors.textSecondary, 
              mb: 2,
              fontWeight: 500 
            }}>
              Stroke Settings
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ 
                color: theme.colors.textSecondary, 
                mb: 1, 
                display: 'block' 
              }}>
                Color
              </Typography>
              <HexColorPicker
                color={currentStrokeColor}
                onChange={(color) => {
                  setCurrentStrokeColor(color);
                  updateSettings({ stroke: color });
                }}
                style={{ width: '100%', height: '120px' }}
              />
            </Box>
            
            {/* Stroke Width */}
            <Box>
              <Typography variant="caption" sx={{ 
                color: theme.colors.textSecondary, 
                mb: 1, 
                display: 'block' 
              }}>
                Width: {settings.strokeWidth ?? 1}px
              </Typography>
              <Slider
                value={settings.strokeWidth ?? 1}
                onChange={(_, value) => updateSettings({ 
                  strokeWidth: value as number 
                })}
                min={1}
                max={20}
                step={1}
                marks={[
                  { value: 1, label: 'Thin' },
                  { value: 10, label: 'Medium' },
                  { value: 20, label: 'Thick' }
                ]}
                valueLabelDisplay="auto"
                sx={{
                  color: theme.colors.primary,
                  '& .MuiSlider-thumb': {
                    bgcolor: theme.colors.surface,
                    border: `2px solid ${theme.colors.primary}`,
                  },
                  '& .MuiSlider-mark': {
                    bgcolor: 'transparent',
                  },
                  '& .MuiSlider-markLabel': {
                    fontSize: '0.7rem',
                    color: theme.colors.textSecondary
                  }
                }}
              />
            </Box>
          </Box>
  
          {/* Fill Settings - Show ONLY for shape tools */}
          {isShapeTool && (
            <Box>
              <Typography variant="subtitle2" sx={{ 
                color: theme.colors.textSecondary, 
                mb: 2,
                fontWeight: 500
              }}>
                Fill Settings
              </Typography>
              <Box sx={{ 
                display: 'flex', 
                gap: 1, 
                mb: 2,
                alignItems: 'flex-start'
              }}>
                <ToggleButtonGroup
                  value={currentFillColor === 'transparent' ? 'none' : 'color'}
                  exclusive
                  onChange={(_, value) => {
                    if (value === 'none') {
                      setCurrentFillColor('transparent');
                      updateSettings({ 
                        fill: 'transparent',
                        fillOpacity: 0
                      });
                    } else if (value === 'color') {
                      const defaultFillColor = settings.stroke || theme.colors.primary;
                      setCurrentFillColor(defaultFillColor);
                      updateSettings({ 
                        fill: defaultFillColor,
                        fillOpacity: settings.fillOpacity || 0.3
                      });
                    }
                  }}
                  size="small"
                  sx={{ flexShrink: 0 }}
                >
                  <ToggleButton 
                    value="none" 
                    sx={{ 
                      px: 1.5,
                      '&.Mui-selected': {
                        bgcolor: alpha(theme.colors.error, 0.1),
                        borderColor: theme.colors.error,
                        '&:hover': {
                          bgcolor: alpha(theme.colors.error, 0.2),
                        }
                      }
                    }}
                  >
                    <Ban size={16} />
                  </ToggleButton>
                  <ToggleButton 
                    value="color" 
                    sx={{ 
                      px: 1.5,
                      '&.Mui-selected': {
                        bgcolor: alpha(theme.colors.primary, 0.1),
                        borderColor: theme.colors.primary,
                        '&:hover': {
                          bgcolor: alpha(theme.colors.primary, 0.2),
                        }
                      }
                    }}
                  >
                    <Square 
                      size={16} 
                      fill={currentFillColor === 'transparent' ? 'none' : currentFillColor} 
                      stroke={currentFillColor === 'transparent' ? theme.colors.textSecondary : currentFillColor}
                      strokeWidth={2}
                    />
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
              
              {/* Color Picker - Always visible for shapes */}
              <Box sx={{ 
                opacity: currentFillColor === 'transparent' ? 0.3 : 1,
                pointerEvents: currentFillColor === 'transparent' ? 'none' : 'auto',
                transition: 'opacity 0.2s'
              }}>
                <HexColorPicker
                  color={currentFillColor === 'transparent' ? theme.colors.primary : currentFillColor}
                  onChange={(color) => {
                    setCurrentFillColor(color);
                    updateSettings({ 
                      fill: color,
                      fillOpacity: settings.fillOpacity ?? 0.5
                    });
                  }}
                  style={{ width: '100%', height: '120px' }}
                />
              </Box>
              
              {/* Fill Opacity Slider */}
              {currentFillColor !== 'transparent' && (
                <Box>
                  <Typography variant="caption" sx={{ 
                    color: theme.colors.textSecondary, 
                    mb: 1, 
                    display: 'block'
                  }}>
                    Fill Opacity: {Math.round((settings.fillOpacity ?? 0.5) * 100)}%
                  </Typography>
                  <Slider
                    value={settings.fillOpacity ?? 0.5}
                    onChange={(_, value) => updateSettings({ 
                      fillOpacity: value as number,
                      fill: currentFillColor
                    })}
                    min={0}
                    max={1}
                    step={0.05}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
                    sx={{
                      color: theme.colors.primary,
                      '& .MuiSlider-thumb': {
                        bgcolor: theme.colors.surface,
                        border: `2px solid ${theme.colors.primary}`,
                      }
                    }}
                  />
                </Box>
              )}
            </Box>
          )}
  
          {/* Line Style Selector */}
          <Box>
            <Typography variant="caption" sx={{ 
              color: theme.colors.textSecondary, 
              mb: 1, 
              display: 'block' 
            }}>
              Line Style
            </Typography>
            <ToggleButtonGroup
              value={settings.strokeDasharray || 'none'}
              exclusive
              onChange={(_, value) => updateSettings({
                strokeDasharray: value === 'none' ? undefined : value
              })}
              size="small"
              fullWidth
            >
              {DASH_PATTERNS.map(pattern => (
                <ToggleButton 
                  key={pattern.value} 
                  value={pattern.value}
                      sx={{ 
                        py: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.5,
                        minHeight: 60
                      }}
                    >
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'center' }}>
                        {/* Thickness preview - always solid */}
                        {settings.strokeWidth > 2 && (
                          <svg width="60" height={Math.max(4, settings.strokeWidth || 2)}>
                            <line
                              x1="0"
                              y1={(settings.strokeWidth || 2) / 2}
                              x2="60"
                              y2={(settings.strokeWidth || 2) / 2}
                              stroke={currentStrokeColor}
                              strokeWidth={settings.strokeWidth || 2}
                              strokeLinecap="round"
                              opacity={0.7}
                            />
                          </svg>
                        )}
                        {/* Pattern preview - always thin */}
                        <svg width="40" height="4">
                          <line
                            x1="0"
                            y1="2"
                            x2="40"
                            y2="2"
                            stroke={currentStrokeColor}
                            strokeWidth="2"
                            strokeDasharray={pattern.value === 'none' ? undefined : pattern.value}
                            strokeLinecap="round"
                          />
                        </svg>
                      </Box>
                      <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>
                        {pattern.label}
                      </Typography>
                    </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
          
          {/* Global Opacity */}
          <Box>
            <Typography variant="caption" sx={{ 
              color: theme.colors.textSecondary, 
              mb: 1, 
              display: 'block' 
            }}>
              Overall Opacity: {Math.round((settings.opacity ?? 1) * 100)}%
            </Typography>
            <Slider
              value={settings.opacity ?? 1}
              onChange={(_, value) => updateSettings({ 
                opacity: value as number 
              })}
              min={0.1}
              max={1}
              step={0.1}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
              sx={{
                color: theme.colors.primary,
                '& .MuiSlider-thumb': {
                  bgcolor: theme.colors.surface,
                  border: `2px solid ${theme.colors.primary}`,
                }
              }}
            />
          </Box>
  
          {/* Font Size Selector - Only show for text tool */}
          {settings.type === 'text' && (
            <Box>
              <Typography variant="caption" sx={{ color: theme.colors.textSecondary, mb: 1, display: 'block' }}>
                Font Size: {settings.fontSize}px
              </Typography>
              <Slider
                value={settings.fontSize ?? 14}
                onChange={(_, value) => updateSettings({ 
                  fontSize: value as number 
                })}
                min={8}
                max={72}
                step={1}
                marks={[
                  { value: 8, label: '8px' },
                  { value: 14, label: '14px' },
                  { value: 72, label: '72px' }
                ]}
                valueLabelDisplay="auto"
                sx={{
                  color: theme.colors.primary,
                  '& .MuiSlider-thumb': {
                    bgcolor: colors.surface,
                    border: `2px solid ${colors.primary}`,
                  },
                  '& .MuiSlider-track': {
                    bgcolor: theme.colors.primary,
                  },
                  '& .MuiSlider-rail': {
                    bgcolor: theme.colors.border,
                  }
                }}
              />
            </Box>
          )}
        </Stack>
        
        {/* Reset Button */}
        <Box sx={{ 
          mt: 3, 
          pt: 2, 
          borderTop: `1px solid ${theme.colors.border}` 
        }}>
          <Button
            onClick={resetToDefaults}
            startIcon={<RotateCcw size={16} />}
            variant="outlined"
            size="small"
            fullWidth
            sx={{ 
              color: theme.colors.textSecondary,
              borderColor: theme.colors.border,
              '&:hover': {
                borderColor: theme.colors.primary,
                bgcolor: alpha(theme.colors.primary, 0.05)
              }
            }}
          >
            Reset to Defaults
          </Button>
        </Box>
      </Box>
    </Paper>
  );
  };
  



  interface TextInputPosition {
    screenX: number;
    screenY: number;
    flowX: number;
    flowY: number;
  }

  interface DrawingLayerProps {
    isNodeToolboxOpen?: boolean;
    leftPanelWidth?: number;
    snapToGrid?: boolean;
    showGrid?: boolean;
    showMinimap?: boolean;
    isInteractiveLocked?: boolean;
    onToggleSnapToGrid?: () => void;
    onToggleGrid?: () => void;
    onToggleMinimap?: () => void;
    onToggleInteractiveLock?: () => void;
    onZoomIn?: () => void;
    onZoomOut?: () => void;
    onFitView?: () => void;
    onDrawingEditModeChange?: (isEditMode: boolean) => void;
    onDrawingToolChange?: (tool: DrawingTool) => void;
  }

  const DrawingLayer: React.FC<DrawingLayerProps> = ({ 
    isNodeToolboxOpen = true,
    leftPanelWidth = DEFAULT_DRAWING_LAYOUT.toolbox,
    snapToGrid = false,
    showGrid = true,
    showMinimap = true,
    isInteractiveLocked = false,
    onToggleSnapToGrid,
    onToggleGrid,
    onToggleMinimap,
    onToggleInteractiveLock,
    onZoomIn,
    onZoomOut,
    onFitView,
    onDrawingEditModeChange,
    onDrawingToolChange
  }) => {
    const theme = useTheme();
    const { viewportTier, viewport: layoutViewport } = useViewportLayout();
    const isPhoneViewport =
      viewportTier === 'xs' ||
      viewportTier === 'sm' ||
      (viewportTier === 'md' && layoutViewport.height <= 540);
    const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [currentPoints, setCurrentPoints] = useState<Points>([]);
  const [selectedTool, setSelectedTool] = useState<DrawingTool>('select');
  const [selectedDrawing, setSelectedDrawing] = useState<string | null>(null);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [endPoint, setEndPoint] = useState<Point | null>(null);
  const [styleSettings, setStyleSettings] = useState<StyleSettings>({ ...DEFAULT_STYLES.select, type: 'select' });
  const [styleAnchorEl, setStyleAnchorEl] = useState<null | HTMLElement>(null);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInputPosition, setTextInputPosition] = useState<TextInputPosition | null>(null);
  const [currentText, setCurrentText] = useState('');
  const [isDrawingEditMode, setIsDrawingEditMode] = useState(false);
  
  // Focus text input when it appears
  useEffect(() => {
    if (showTextInput && textInputRef.current) {
      // Use RAF to ensure DOM is ready
      requestAnimationFrame(() => {
        textInputRef.current?.focus();
        textInputRef.current?.select();
      });
    }
  }, [showTextInput]);
  
  

  // Drawing context no longer needed - drawings are nodes now
  // const { state, addDrawing, removeDrawing } = useAnalysisContext();
  // const { drawings } = state;
  
  // Removed svgRef - no longer using SVG overlay
  const textInputRef = useRef<HTMLInputElement>(null);
  const deletePressed = useKeyPress(['Delete', 'Backspace']);

  const { getNodes, getEdges, addNodes, setNodes } = useReactFlow();
  const reactFlowNodes = useNodes();
  const reactFlowEdges = useEdges();

  // Subscribe to viewport ONLY when actively drawing (non-select tool or mid-stroke).
  // When in select mode / panning, reading viewport on-demand via storeApi avoids
  // ~300 ms re-renders of this 1800-line component on every pan frame.
  const isDrawingActive = isDrawing || (selectedTool !== 'select');
  const storeApi = useStoreApi();
  const drawViewport = useStore(
    (s: ReactFlowState) => ({ x: s.transform[0], y: s.transform[1], zoom: s.transform[2] }),
    isDrawingActive ? undefined : () => true   // when NOT drawing, equality fn always returns true → never re-render
  );
  const viewportRef = useRef({ x: 0, y: 0, zoom: 1 });
  if (isDrawingActive) {
    viewportRef.current = drawViewport;
  }
  const viewport = viewportRef.current;

  // Imperative getter for callbacks that need fresh viewport without subscribing
  const getViewport = useCallback(() => {
    const t = storeApi.getState().transform;
    return { x: t[0], y: t[1], zoom: t[2] };
  }, [storeApi]);

  // Convert screen coordinates to flow coordinates (reads viewport imperatively to avoid stale closure)
  const getFlowPosition = useCallback((event: React.MouseEvent): Point => {
    const canvas = document.querySelector('.react-flow__renderer') as HTMLElement;
    if (!canvas) return { x: 0, y: 0 };
    const bounds = canvas.getBoundingClientRect();
    const vp = getViewport();
    const x = (event.clientX - bounds.left - vp.x) / vp.zoom;
    const y = (event.clientY - bounds.top - vp.y) / vp.zoom;
    return { x, y };
  }, [getViewport]);


  // Drawing tools are now always enabled (no toggle needed)

  // Listen for text annotation updates
  useEffect(() => {
    const handleTextAnnotationUpdate = (event: CustomEvent) => {
      const { nodeId, text } = event.detail;
      setNodes((nodes: Node[]) => 
        nodes.map(node => 
          node.id === nodeId 
            ? { ...node, data: { ...node.data, text } }
            : node
        )
      );
    };

    window.addEventListener('updateTextAnnotation', handleTextAnnotationUpdate as any);
    return () => {
      window.removeEventListener('updateTextAnnotation', handleTextAnnotationUpdate as any);
    };
  }, [setNodes]);

  // Update handleToolChange - tools are always available
  const handleToolChange = (tool: DrawingTool) => {
    setSelectedTool(tool);
    
    // Load saved styles or use defaults
    const savedStyle = tool !== 'select' && tool !== 'eraser' 
      ? drawingStyleService.getToolStyle(tool as any) 
      : null;
    
    setStyleSettings({ 
      ...(savedStyle || DEFAULT_STYLES[tool]), 
      type: tool 
    });
    
    // Notify parent about tool change
    onDrawingToolChange?.(tool);
  };

  // No toggle handler needed - tools are always available

  // Removed wheel event handling - ReactFlow handles this natively

  // Toggle drawing edit mode
  const toggleDrawingEditMode = useCallback(() => {
    setIsDrawingEditMode(prev => {
      const newValue = !prev;
      onDrawingEditModeChange?.(newValue);
      return newValue;
    });
  }, [onDrawingEditModeChange]);

  
  // When edit mode changes, update all drawing nodes
  useEffect(() => {
    setNodes(nodes => nodes.map(node => {
      if (node.type === 'freehand' || node.type === 'shape' || node.type === 'textAnnotation') {
        return { 
          ...node, 
          selectable: isDrawingEditMode,
          draggable: isDrawingEditMode,
          connectable: false,
          focusable: isDrawingEditMode
        };
      }
      return node;
    }));
  }, [isDrawingEditMode, setNodes]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't process shortcuts if text input is active
      if (showTextInput) return;
      
      // Don't process if typing in any input field
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        return;
      }
      
      const tool = TOOL_SHORTCUTS[e.key];
      if (tool) {
        handleToolChange(tool);
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    return () => window.removeEventListener('keypress', handleKeyPress);
  }, [showTextInput, handleToolChange]);

  // Handle deletion of selected drawing
  useEffect(() => {
    if (deletePressed && selectedDrawing) {
      // Now we delete nodes instead of drawings
      setNodes((nodes: Node[]) => nodes.filter(n => n.id !== selectedDrawing));
      setSelectedDrawing(null);
    }
  }, [deletePressed, selectedDrawing, setNodes]);

  // Enhanced eraser functionality for nodes
  const handleEraserAction = useCallback((e: React.MouseEvent) => {
    if (selectedTool !== 'eraser') return;
    
    const eraserRadius = (styleSettings.strokeWidth || 20);
    const mousePos = getFlowPosition(e);

    // Get all drawing nodes (freehand, shape, textAnnotation)
    const drawingNodes = reactFlowNodes.filter(node => 
      ['freehand', 'shape', 'textAnnotation'].includes(node.type || '')
    );

    // Find nodes to remove
    const nodesToRemove: string[] = [];
    
    drawingNodes.forEach(node => {
      const nodeWidth = node.width || 100;
      const nodeHeight = node.height || 100;
      
      // Check if eraser overlaps with node bounds
      if (
        mousePos.x >= node.position.x - eraserRadius &&
        mousePos.x <= node.position.x + nodeWidth + eraserRadius &&
        mousePos.y >= node.position.y - eraserRadius &&
        mousePos.y <= node.position.y + nodeHeight + eraserRadius
      ) {
        // Calculate distance to node center for more precise erasing
        const nodeCenter = {
          x: node.position.x + nodeWidth / 2,
          y: node.position.y + nodeHeight / 2
        };
        
        const distance = Math.sqrt(
          Math.pow(mousePos.x - nodeCenter.x, 2) + 
          Math.pow(mousePos.y - nodeCenter.y, 2)
        );
        
        // If within eraser radius plus half the node size, remove it
        if (distance <= eraserRadius + Math.max(nodeWidth, nodeHeight) / 2) {
          nodesToRemove.push(node.id);
        }
      }
    });
    
    // Remove nodes
    if (nodesToRemove.length > 0) {
      setNodes((nodes: Node[]) => nodes.filter(n => !nodesToRemove.includes(n.id)));
    }
    
    return nodesToRemove.length > 0;
  }, [selectedTool, reactFlowNodes, getFlowPosition, styleSettings.strokeWidth, setNodes]);

  // Add a dedicated eraser mode handler
  const startErasing = useCallback((e: React.MouseEvent) => {
    if (selectedTool !== 'eraser' || isDrawingEditMode) return;
    setIsDrawing(true); // Use isDrawing state to track erasing mode
    handleEraserAction(e); // Try to erase on the initial click
  }, [selectedTool, isDrawingEditMode, handleEraserAction]);
  
  const continueErasing = useCallback((e: React.MouseEvent) => {
    if (selectedTool !== 'eraser' || !isDrawing) return;
    handleEraserAction(e);
  }, [selectedTool, isDrawing, handleEraserAction]);
  
  const stopErasing = useCallback(() => {
    if (selectedTool === 'eraser' && isDrawing) {
      setIsDrawing(false);
    }
  }, [selectedTool, isDrawing]);

  const createArrowPath = (start: Point, end: Point): string => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const angle = Math.atan2(dy, dx);
    const headLength = 10 / getViewport().zoom;
    const headAngle = Math.PI / 6;

    const headPoint1 = {
      x: end.x - headLength * Math.cos(angle - headAngle),
      y: end.y - headLength * Math.sin(angle - headAngle)
    };
    const headPoint2 = {
      x: end.x - headLength * Math.cos(angle + headAngle),
      y: end.y - headLength * Math.sin(angle + headAngle)
    };

    return `M ${start.x} ${start.y} L ${end.x} ${end.y} M ${headPoint1.x} ${headPoint1.y} L ${end.x} ${end.y} L ${headPoint2.x} ${headPoint2.y}`;
  };

  const findNearestNode = useCallback((position: Point): Node | null => {
    const nodes = getNodes();
    let nearestNode: Node | null = null;
    let shortestDistance = Infinity;

    nodes.forEach(node => {
      // Convert node position to flow coordinates
      const nodeX = node.position.x;
      const nodeY = node.position.y;

      const distance = Math.sqrt(
        Math.pow(position.x - nodeX, 2) + 
        Math.pow(position.y - nodeY, 2)
      );

      if (distance < shortestDistance) {
        shortestDistance = distance;
        nearestNode = node;
      }
    });

    // Only return the node if it's within a reasonable distance (e.g., 100 pixels)
    return shortestDistance < 100 ? nearestNode : null;
  }, [getNodes]);

  const createDrawing = useCallback((path: string): Drawing => {
    const nearestNode = startPoint ? findNearestNode(startPoint) : null;
    
    const isShapeTool = ['rectangle', 'circle'].includes(selectedTool);
    
    const drawing: Drawing = {
      id: `drawing-${Date.now()}`,
      type: selectedTool,
      path,
      style: {
        ...styleSettings,
        // Only apply fill to shape tools
        fill: isShapeTool ? styleSettings.fill : 'none',
        fillOpacity: isShapeTool ? styleSettings.fillOpacity : 0
      }
    };

    // Only add position properties if we have a nearest node
    if (nearestNode && startPoint) {
      drawing.associatedNodeId = nearestNode.id;
      drawing.position = startPoint;
      drawing.relativePosition = {
        x: startPoint.x - nearestNode.position.x,
        y: startPoint.y - nearestNode.position.y
      };
    }

    // Calculate bounds based on path (which includes shape data)
    if (path) {
      drawing.bounds = calculateBoundsFromPath(path);
    }

    // Calculate spatial metadata (nearby nodes, overlapping nodes, etc.)
    const currentNodes = getNodes() as SecurityNode[];
    const currentEdges = getEdges() as SecurityEdge[];
    // Exclude zones by default for clearer security focus
    const metadata = calculateDrawingMetadata(drawing, currentNodes, currentEdges, 5, 3, false);
    Object.assign(drawing, metadata);

    return drawing;
  }, [selectedTool, styleSettings, startPoint, findNearestNode, getNodes, getEdges]);

  const startDrawing = useCallback((e: React.MouseEvent) => {
    if (selectedTool === 'select' || isDrawingEditMode) return; // Don't draw when in select mode or edit mode
    
    // Only start drawing with left mouse button
    if (e.button !== 0) return;
    
    // Prevent default to stop any unwanted behavior
    e.preventDefault();
    e.stopPropagation();
    
    const pos = getFlowPosition(e);
    // const nearestNode = findNearestNode(pos); // Not currently used
    
    setStartPoint(pos);
    setIsDrawing(true);
    
    // Initialize points for pencil tool
    if (selectedTool === 'pencil') {
      setCurrentPoints([[pos.x, pos.y, 0.5]]);
    }
    
  }, [selectedTool, isDrawingEditMode, getFlowPosition, findNearestNode]);

  const draw = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || selectedTool === 'select') return;
    
    e.preventDefault();
    const currentPoint = getFlowPosition(e);
    setEndPoint(currentPoint);
    
    switch (selectedTool) {
      case 'pencil':
        setCurrentPath(prev => {
          // If this is the first point, start with M (move to)
          if (!prev) return `M ${currentPoint.x} ${currentPoint.y}`;
          // Otherwise add a line to the current point
          return `${prev} L ${currentPoint.x} ${currentPoint.y}`;
        });
        // Also collect points for perfect-freehand
        setCurrentPoints(prev => [...prev, [currentPoint.x, currentPoint.y, 0.5]]);
        break;
      case 'rectangle':
        if (!startPoint) return;
        setCurrentPath(
          `M ${startPoint.x} ${startPoint.y} ` +
          `L ${currentPoint.x} ${startPoint.y} ` +
          `L ${currentPoint.x} ${currentPoint.y} ` +
          `L ${startPoint.x} ${currentPoint.y} Z`
        );
        break;
      case 'circle':
        if (!startPoint) return;
        const radius = Math.sqrt(
          Math.pow(currentPoint.x - startPoint.x, 2) + 
          Math.pow(currentPoint.y - startPoint.y, 2)
        );
        setCurrentPath(
          `M ${startPoint.x - radius} ${startPoint.y} ` +
          `a ${radius} ${radius} 0 1 0 ${radius * 2} 0 ` +
          `a ${radius} ${radius} 0 1 0 ${-radius * 2} 0`
        );
        break;
      case 'arrow':
        if (!startPoint) return;
        setCurrentPath(createArrowPath(startPoint, currentPoint));
        break;
    }
  }, [isDrawing, selectedTool, startPoint, handleEraserAction, createArrowPath, getFlowPosition]);

  const stopDrawing = useCallback(() => {
    if (isDrawing && currentPath && selectedTool !== 'select' && selectedTool !== 'text') {
      // Convert drawing to node instead of adding to drawings array
      if (selectedTool === 'pencil') {
        // Convert pencil drawing to freehand node
        const points: Points = [];
        // Parse path to extract points
        const pathParts = currentPath.split(/[ML]/).filter(p => p.trim());
        pathParts.forEach(part => {
          const [x, y] = part.trim().split(' ').map(Number);
          if (!isNaN(x) && !isNaN(y)) {
            points.push([x, y, 0.5]);
          }
        });
        
        const bounds = getDrawingBounds(points);
        const newNode: Node = {
          id: `freehand-${Date.now()}`,
          type: 'freehand',
          position: { x: bounds.x, y: bounds.y },
          selectable: false,
          draggable: false,
          connectable: false,
          focusable: false,
          data: {
            points: points.map(([x, y, p]) => [x - bounds.x, y - bounds.y, p]) as Points,
            initialSize: { width: bounds.width, height: bounds.height },
            style: {
              stroke: styleSettings.stroke,
              strokeWidth: styleSettings.strokeWidth,
              opacity: styleSettings.opacity,
              strokeDasharray: styleSettings.strokeDasharray,
              fill: styleSettings.fill || styleSettings.stroke,
              fillOpacity: styleSettings.fillOpacity ?? 0.8
            },
            drawingAnalysis: DrawingAnalyzer.interpretDrawing({
              id: '',
              type: 'pencil',
              path: currentPath,
              style: styleSettings
            })
          },
          width: bounds.width,
          height: bounds.height
        };
        addNodes(newNode);
      } else if (['rectangle', 'circle', 'arrow'].includes(selectedTool) && startPoint) {
        // Convert shape drawing to shape node
        if (selectedTool === 'circle' && endPoint) {
          // For circles, calculate from the drawn radius
          const radius = Math.sqrt(
            Math.pow(endPoint.x - startPoint.x, 2) + 
            Math.pow(endPoint.y - startPoint.y, 2)
          );
          const diameter = radius * 2;
          
          // Ensure we have a minimum size for visibility
          const finalDiameter = Math.max(diameter, 10);
          
          const newNode: Node = {
            id: `shape-${Date.now()}`,
            type: 'shape',
            position: { 
              x: startPoint.x - finalDiameter / 2,
              y: startPoint.y - finalDiameter / 2
            },
            selectable: false,
            draggable: false,
            connectable: false,
            focusable: false,
            data: {
              shapeType: 'circle',
              style: {
                stroke: styleSettings.stroke,
                strokeWidth: styleSettings.strokeWidth,
                opacity: styleSettings.opacity,
                strokeDasharray: styleSettings.strokeDasharray,
                fill: styleSettings.fill ?? 'none',
                fillOpacity: styleSettings.fillOpacity ?? 0
              },
              drawingAnalysis: DrawingAnalyzer.interpretDrawing({
                id: '',
                type: 'circle',
                path: currentPath,
                style: styleSettings
              })
            },
            width: finalDiameter,
            height: finalDiameter
          };
          addNodes(newNode);
        } else {
          // For rectangles and arrows
          const bounds = calculateBoundsFromPath(currentPath);
          if (!bounds) return;
          
          const newNode: Node = {
            id: `shape-${Date.now()}`,
            type: 'shape',
            position: { 
              x: Math.min(bounds.minX, bounds.maxX), 
              y: Math.min(bounds.minY, bounds.maxY) 
            },
            selectable: false,
            draggable: false,
            connectable: false,
            focusable: false,
            data: {
              shapeType: selectedTool as 'rectangle' | 'arrow',
              style: {
                stroke: styleSettings.stroke,
                strokeWidth: styleSettings.strokeWidth,
                opacity: styleSettings.opacity,
                strokeDasharray: styleSettings.strokeDasharray,
                fill: styleSettings.fill ?? 'none',
                fillOpacity: styleSettings.fillOpacity ?? 0
              },
              drawingAnalysis: DrawingAnalyzer.interpretDrawing({
                id: '',
                type: selectedTool,
                path: currentPath,
                style: styleSettings
              })
            },
            width: Math.abs(bounds.width),
            height: Math.abs(bounds.height)
          };
          addNodes(newNode);
        }
      }
    }
    
    setIsDrawing(false);
    setCurrentPath('');
    setCurrentPoints([]);
    setStartPoint(null);
    setEndPoint(null);
  }, [isDrawing, currentPath, selectedTool, styleSettings, addNodes, startPoint, endPoint, getFlowPosition]);


  const handleStyleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setStyleAnchorEl(event.currentTarget);
  };

  const handleStyleClose = () => {
    setStyleAnchorEl(null);
  };

  const handleTextSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (textInputPosition && currentText.trim()) {
      // Use flow coordinates for node position
      const position = { x: textInputPosition.flowX, y: textInputPosition.flowY };
      
      // Calculate width based on text length and font size
      const fontSize = styleSettings.fontSize || 18;
      const estimatedWidth = Math.max(150, currentText.trim().length * fontSize * 0.6);
      const estimatedHeight = Math.max(50, fontSize * 2);
      
      const newNode: Node = {
        id: `text-${Date.now()}`,
        type: 'textAnnotation',
        position,
        selectable: false,
        draggable: false,
        connectable: false,
        focusable: false,
        data: {
          text: currentText.trim(),
          style: {
            stroke: styleSettings.stroke || theme.colors.textPrimary,
            fontSize: fontSize,
            opacity: styleSettings.opacity || 1
          },
          drawingAnalysis: `Text annotation: "${currentText.trim()}"`
        },
        width: estimatedWidth,
        height: estimatedHeight
      };
      addNodes(newNode);
      
      console.log('handleTextSubmit - hiding text input');
      setShowTextInput(false);
      setCurrentText('');
      setTextInputPosition(null);
    }
  }, [textInputPosition, currentText, styleSettings, addNodes, viewport, theme.colors.textPrimary]);
  

  // Move buttonStyle inside component
  type ToolboxButtonType = 'select' | 'pencil' | 'rectangle' | 'circle' | 'arrow' | 'text' | 'eraser' | 'settings';

  const buttonStyle = (tool: ToolboxButtonType) => ({
    ...toolboxStyles.button,
    // Highlight the currently selected tool
    ...((selectedTool === tool || (tool === 'settings' && Boolean(styleAnchorEl))) && {
      background: theme.colors.primary,
      color: theme.palette.primary.contrastText,
      borderColor: theme.colors.primary
    })
  });


  const handleTextClick = useCallback((e: React.MouseEvent) => {
    if (selectedTool !== 'text' || isDrawingEditMode) return;

    // Prevent event from bubbling
    e.preventDefault();
    e.stopPropagation();

    // Store both screen and flow positions
    const screenPosition = { x: e.clientX, y: e.clientY };
    const flowPosition = getFlowPosition(e);
    
    console.log('Text click positions:', { screenPosition, flowPosition });
    
    // Use screen position for input display, flow position for node creation
    setTextInputPosition({ 
      screenX: screenPosition.x, 
      screenY: screenPosition.y,
      flowX: flowPosition.x,
      flowY: flowPosition.y
    });
    setShowTextInput(true);
  }, [selectedTool, isDrawingEditMode, getFlowPosition]);

  // Add performance optimizations
  const debouncedDraw = useMemo(() => {
    let lastCall = 0;
    const minDelay = 16; // ~60fps

    return (e: React.MouseEvent) => {
      const now = Date.now();
      if (now - lastCall >= minDelay) {
        draw(e);
        lastCall = now;
      }
    };
  }, [draw]);

  // Add useEffect to attach event listeners to the parent ReactFlow canvas
  useEffect(() => {
    const canvas = document.querySelector('.react-flow__renderer') as HTMLElement;
    if (!canvas) return;

    // Update cursor based on selected tool
    if (selectedTool === 'select' || isDrawingEditMode) {
      canvas.style.cursor = '';
    } else if (selectedTool === 'eraser') {
      canvas.style.cursor = 'cell';
    } else {
      canvas.style.cursor = 'crosshair';
    }

    if (selectedTool === 'select' || isDrawingEditMode) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // Only left click
      if (selectedTool === 'text') {
        handleTextClick(e as any);
      } else if (selectedTool === 'eraser') {
        startErasing(e as any);
      } else {
        startDrawing(e as any);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (selectedTool === 'eraser' && isDrawing) {
        continueErasing(e as any);
      } else if (isDrawing) {
        debouncedDraw(e as any);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (selectedTool === 'eraser') {
        stopErasing();
      } else if (isDrawing) {
        stopDrawing();
      }
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [selectedTool, isDrawingEditMode, isDrawing, startDrawing, debouncedDraw, stopDrawing, 
      startErasing, continueErasing, stopErasing, handleTextClick]);

  // Enhanced toolbox styles with theme support
  const leftOffset = `${Math.round(leftPanelWidth)}px`;
  const mobileEdgeGap = 12;
  const toolButtonSize = isPhoneViewport ? 40 : 32;
  const toolboxWidth = isPhoneViewport ? `calc(100vw - ${mobileEdgeGap * 2}px)` : undefined;

  const toolboxStyles = {
    container: {
      position: 'fixed',
      left: isPhoneViewport ? '50%' : (isNodeToolboxOpen ? leftOffset : '0'),
      top: isPhoneViewport ? 'auto' : '112px', // Aligned with bottom of tab switcher (64px header + 48px tabs)
      bottom: isPhoneViewport ? `${mobileEdgeGap}px` : 'auto',
      transform: isPhoneViewport ? 'translateX(-50%)' : 'none',
      backgroundColor: theme.colors.surface,
      borderRadius: isPhoneViewport ? '12px' : (isNodeToolboxOpen ? '0 8px 8px 0' : '0 8px 8px 0'),
      border: `1px solid ${theme.colors.border}`,
      borderLeft: isPhoneViewport ? `1px solid ${theme.colors.border}` : (isNodeToolboxOpen ? 'none' : `1px solid ${theme.colors.border}`),
      display: 'flex',
      flexDirection: isPhoneViewport ? 'row' : 'column',
      gap: '2px',
      padding: '4px',
      zIndex: 800,
      transition: isPhoneViewport ? 'none' : 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      width: toolboxWidth || 'auto',
      maxWidth: isPhoneViewport ? '100%' : 'none',
      overflowX: isPhoneViewport ? 'auto' : 'visible',
      boxShadow: isPhoneViewport ? '0 8px 20px rgba(0,0,0,0.2)' : 'none',
    },
    buttonGroup: {
      display: 'flex',
      flexDirection: isPhoneViewport ? 'row' : 'column',
      gap: '2px',
    },
    button: {
      width: `${toolButtonSize}px`,
      height: `${toolButtonSize}px`,
      padding: '6px',
      minWidth: `${toolButtonSize}px`,
      background: theme.colors.surface,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: '4px',
      color: theme.colors.textPrimary,
      '&:hover': {
        background: theme.colors.surfaceHover,
        borderColor: theme.colors.primary
      },
      '&.Mui-disabled': {
        opacity: 0.5,
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        pointerEvents: 'none'
      }
    },
    stylePanel: {
      padding: '16px',
      width: isPhoneViewport ? 'min(360px, calc(100vw - 24px))' : '280px',
      background: theme.colors.surface,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: '8px',
      color: theme.colors.textPrimary
    },
    colorSection: {
      marginBottom: '16px'
    },
    sliderLabel: {
      color: theme.colors.textSecondary,
      fontSize: '12px',
      marginBottom: '8px'
    }
  };

  // Update SVG and text input rendering
  return (
    <>
      {/* Drawing Edit Mode Indicator */}
      {isDrawingEditMode && (
        <Box
          sx={{
            position: 'fixed',
            left: isPhoneViewport ? '50%' : (isNodeToolboxOpen ? leftOffset : '0'),
            top: isPhoneViewport ? '72px' : '80px',
            zIndex: 801,
            transform: isPhoneViewport ? 'translateX(-50%)' : 'none',
            transition: isPhoneViewport ? 'none' : 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            paddingLeft: isPhoneViewport ? 0 : '4px',
          }}
        >
          <Chip
            icon={<Edit size={14} style={{ marginLeft: '4px' }} />}
            label="Drawing Edit Mode Active"
            size="small"
            color="warning"
            sx={{
              backgroundColor: theme.colors.warning,
              color: '#fff',
              fontWeight: 500,
              fontSize: '12px',
              height: '24px',
              '& .MuiChip-label': {
                padding: '0 8px',
              },
              '& .MuiChip-icon': {
                color: '#fff',
              }
            }}
          />
        </Box>
      )}

      {/* Drawing Toolbox */}
      <Box sx={toolboxStyles.container}>
        <Box sx={toolboxStyles.buttonGroup}>
          <Tooltip title="Select Tool (V)" placement="right">
            <IconButton
              onClick={() => handleToolChange('select')}
              sx={buttonStyle('select')}
            >
              <MousePointer size={16} />
            </IconButton>
          </Tooltip>
          <Divider
            orientation={isPhoneViewport ? 'vertical' : 'horizontal'}
            sx={isPhoneViewport
              ? { height: '70%', alignSelf: 'center', mx: 0.5, borderColor: theme.colors.border }
              : { width: '80%', alignSelf: 'center', my: 0.5, borderColor: theme.colors.border }}
          />
          <Tooltip title="Edit Drawings" placement="right">
            <IconButton
              onClick={toggleDrawingEditMode}
              sx={{
                ...toolboxStyles.button,
                backgroundColor: isDrawingEditMode ? theme.colors.warning : theme.colors.surface,
                color: isDrawingEditMode ? '#fff' : theme.colors.textPrimary,
                borderColor: isDrawingEditMode ? theme.colors.warning : theme.colors.border,
                '&:hover': {
                  backgroundColor: isDrawingEditMode ? theme.colors.warning : theme.colors.surfaceHover,
                  borderColor: theme.colors.warning,
                  opacity: isDrawingEditMode ? 0.9 : 1,
                }
              }}
            >
              <Edit size={16} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Pencil (P)" placement="right">
            <IconButton
              onClick={() => handleToolChange('pencil')}
              sx={buttonStyle('pencil')}
            >
              <Pencil size={16} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Rectangle (R)" placement="right">
            <IconButton
              onClick={() => handleToolChange('rectangle')}
              sx={buttonStyle('rectangle')}
            >
              <Square size={16} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Circle (C)" placement="right">
            <IconButton
              onClick={() => handleToolChange('circle')}
              sx={buttonStyle('circle')}
            >
              <Circle size={16} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Arrow (W)" placement="right">
            <IconButton
              onClick={() => handleToolChange('arrow')}
              sx={buttonStyle('arrow')}
            >
              <ArrowRight size={16} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Text (T)" placement="right">
            <IconButton
              onClick={() => handleToolChange('text')}
              sx={buttonStyle('text')}
            >
              <Type size={16} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Eraser" placement="right">
            <IconButton
              onClick={() => handleToolChange('eraser')}
              sx={buttonStyle('eraser')}
            >
              <Eraser size={16} />
            </IconButton>
          </Tooltip>
          <Divider
            orientation={isPhoneViewport ? 'vertical' : 'horizontal'}
            sx={isPhoneViewport
              ? { height: '70%', alignSelf: 'center', mx: 0.5, borderColor: theme.colors.border }
              : { width: '80%', alignSelf: 'center', my: 0.5, borderColor: theme.colors.border }}
          />
          <Tooltip title="Style Settings" placement="right">
            <IconButton
              onClick={handleStyleOpen}
              sx={buttonStyle('settings')}
            >
              <Settings size={16} />
            </IconButton>
          </Tooltip>
          
          {/* Canvas Controls Section */}
          <Divider
            orientation={isPhoneViewport ? 'vertical' : 'horizontal'}
            sx={isPhoneViewport
              ? { height: '70%', alignSelf: 'center', mx: 0.5, borderColor: theme.colors.border }
              : { width: '80%', alignSelf: 'center', my: 0.5, borderColor: theme.colors.border }}
          />
          
          {/* Zoom Controls */}
          <Tooltip title="Zoom In" placement="right">
            <IconButton
              onClick={onZoomIn}
              sx={{
                ...toolboxStyles.button,
                color: theme.colors.textPrimary,
              }}
            >
              <ZoomIn size={16} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Zoom Out" placement="right">
            <IconButton
              onClick={onZoomOut}
              sx={{
                ...toolboxStyles.button,
                color: theme.colors.textPrimary,
              }}
            >
              <ZoomOut size={16} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Fit to View" placement="right">
            <IconButton
              onClick={() => onFitView?.()}
              sx={{
                ...toolboxStyles.button,
                color: theme.colors.textPrimary,
              }}
            >
              <Maximize size={16} />
            </IconButton>
          </Tooltip>
          
          <Divider
            orientation={isPhoneViewport ? 'vertical' : 'horizontal'}
            sx={isPhoneViewport
              ? { height: '70%', alignSelf: 'center', mx: 0.5, borderColor: theme.colors.border }
              : { width: '80%', alignSelf: 'center', my: 0.5, borderColor: theme.colors.border }}
          />
          
          {/* Grid and View Controls */}
          <Tooltip title={snapToGrid ? "Disable snap to grid" : "Enable snap to grid"} placement="right">
            <IconButton
              onClick={onToggleSnapToGrid}
              sx={{
                ...toolboxStyles.button,
                backgroundColor: snapToGrid ? theme.colors.primary : theme.colors.surface,
                color: snapToGrid ? '#fff' : theme.colors.textPrimary,
                '&:hover': {
                  backgroundColor: snapToGrid ? theme.colors.primaryHover : theme.colors.surfaceHover,
                  borderColor: theme.colors.primary,
                }
              }}
            >
              <Grid3x3 size={16} />
            </IconButton>
          </Tooltip>
          <Tooltip title={showGrid ? "Hide grid" : "Show grid"} placement="right">
            <IconButton
              onClick={onToggleGrid}
              sx={{
                ...toolboxStyles.button,
                backgroundColor: showGrid ? theme.colors.primary : theme.colors.surface,
                color: showGrid ? '#fff' : theme.colors.textPrimary,
                '&:hover': {
                  backgroundColor: showGrid ? theme.colors.primaryHover : theme.colors.surfaceHover,
                  borderColor: theme.colors.primary,
                }
              }}
            >
              {showGrid ? <Eye size={16} /> : <EyeOff size={16} />}
            </IconButton>
          </Tooltip>
          <Tooltip title={showMinimap ? "Hide minimap" : "Show minimap"} placement="right">
            <IconButton
              onClick={onToggleMinimap}
              sx={{
                ...toolboxStyles.button,
                backgroundColor: showMinimap ? theme.colors.primary : theme.colors.surface,
                color: showMinimap ? '#fff' : theme.colors.textPrimary,
                '&:hover': {
                  backgroundColor: showMinimap ? theme.colors.primaryHover : theme.colors.surfaceHover,
                  borderColor: theme.colors.primary,
                }
              }}
            >
              <MapIcon size={16} />
            </IconButton>
          </Tooltip>
          <Tooltip title={isInteractiveLocked ? "Unlock pan & zoom" : "Lock pan & zoom"} placement="right">
            <IconButton
              onClick={onToggleInteractiveLock}
              sx={{
                ...toolboxStyles.button,
                backgroundColor: isInteractiveLocked ? theme.colors.warning : theme.colors.surface,
                color: isInteractiveLocked ? '#fff' : theme.colors.textPrimary,
                '&:hover': {
                  backgroundColor: isInteractiveLocked ? theme.colors.warning : theme.colors.surfaceHover,
                  borderColor: theme.colors.warning,
                  opacity: isInteractiveLocked ? 0.9 : 1,
                }
              }}
            >
              {isInteractiveLocked ? <Lock size={16} /> : <Unlock size={16} />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Style Settings Popover */}
      <Popover
        open={Boolean(styleAnchorEl)}
        anchorEl={styleAnchorEl}
        onClose={handleStyleClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
      >
        <StylePanel
          settings={styleSettings}
          onUpdate={(newSettings) => {
            setStyleSettings(newSettings);
          }}
        />
      </Popover>

      {/* Drawing preview SVG */}
      {isDrawing && (currentPath || currentPoints.length > 0) && (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 5
          }}
        >
          <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
            {selectedTool === 'pencil' && currentPoints.length > 0 && (
              <path
                d={pointsToSimplePath(currentPoints)}
                fill="none"
                stroke={styleSettings.stroke}
                strokeWidth={styleSettings.strokeWidth}
                strokeDasharray={scaleDashPattern(styleSettings.strokeDasharray, styleSettings.strokeWidth || 1)}
                opacity={styleSettings.opacity}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {(selectedTool === 'rectangle' || selectedTool === 'circle') && (
              <path
                d={currentPath}
                fill={styleSettings.fill || 'none'}
                fillOpacity={styleSettings.fillOpacity || 0}
                stroke={styleSettings.stroke}
                strokeWidth={styleSettings.strokeWidth}
                opacity={styleSettings.opacity}
                strokeDasharray={scaleDashPattern(styleSettings.strokeDasharray, styleSettings.strokeWidth || 1)}
              />
            )}
            {selectedTool === 'arrow' && (
              <path
                d={currentPath}
                fill="none"
                stroke={styleSettings.stroke}
                strokeWidth={styleSettings.strokeWidth}
                opacity={styleSettings.opacity}
                strokeDasharray={scaleDashPattern(styleSettings.strokeDasharray, styleSettings.strokeWidth || 1)}
              />
            )}
          </g>
        </svg>
      )}

      {/* Text Input */}
      {showTextInput && textInputPosition ? (
        <>
          {/* Click outside to cancel */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'transparent',
              zIndex: 99998,
              pointerEvents: 'all'
            }}
            onClick={() => {
              console.log('Overlay clicked - canceling text input');
              setShowTextInput(false);
              setCurrentText('');
            }}
          />
          <div
            id="text-input-container"
            style={{
              position: 'fixed',
              left: `${textInputPosition.screenX}px`,
              top: `${textInputPosition.screenY}px`,
              transform: 'translate(-50%, -50%)',
              zIndex: 99999,
              backgroundColor: theme.colors.surface,
              border: `2px solid ${theme.colors.primary}`,
              borderRadius: '8px',
              padding: '4px',
              boxShadow: `0 2px 8px ${alpha(theme.colors.primary, 0.25)}`,
              pointerEvents: 'all'
            }}
          >
            <input
              ref={textInputRef}
              type="text"
              value={currentText}
              onChange={(e) => setCurrentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleTextSubmit();
                } else if (e.key === 'Escape') {
                  console.log('Escape pressed - hiding text input');
                  setShowTextInput(false);
                  setCurrentText('');
                }
              }}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '8px 12px',
                color: theme.colors.textPrimary,
                minWidth: '150px',
                fontSize: '18px',
                fontWeight: 500,
                outline: 'none'
              }}
              placeholder="Enter text..."
              autoFocus
            />
        </div>
        </>
      ) : null}
    </>
  );
};

export default DrawingLayer;
export type { DrawingTool, DrawingStyle, Point, Drawing };
