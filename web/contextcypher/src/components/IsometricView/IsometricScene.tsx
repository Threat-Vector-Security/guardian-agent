import React, { useRef, useEffect, useMemo, Suspense, useState, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, Stats } from '@react-three/drei';
import * as THREE from 'three';
import { useAnalysisContext } from '../AnalysisContextProvider';
import { useManualAnalysis } from '../../contexts/ManualAnalysisContext';
import { convertDiagramToGame, GameEntity } from './utils/diagramToGame';
import { CAMERA_CONFIG, WORLD_CONFIG, LIGHTING_CONFIG, PERFORMANCE_CONFIG } from './utils/gameConstants';
import { SecurityZone } from './entities/SecurityZone';
import { NodeBuilding } from './entities/NodeBuilding';
import { ConnectionPath } from './entities/ConnectionPath';
import { UnrealCameraController } from './controls/UnrealCameraController';
import { TouchCameraController } from './controls/TouchCameraController';
import { Box, CircularProgress, Collapse, IconButton, Tooltip, Typography } from '@mui/material';
import { HelpCircle, X as XIcon } from 'lucide-react';
import { Theme } from '../../styles/Theme';
import QuickInspector from '../QuickInspector';
import { SecurityNode, SecurityEdge } from '../../types/SecurityTypes';
import useViewportLayout from '../../hooks/useViewportLayout';

// Loading component
const LoadingScreen: React.FC = () => (
  <Box
    sx={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      textAlign: 'center',
    }}
  >
    <CircularProgress size={60} />
    <Typography variant="h6" sx={{ mt: 2 }}>
      Loading 3D Environment...
    </Typography>
  </Box>
);

const LegendRow: React.FC<{ keys: string; desc: string }> = ({ keys, desc }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'space-between' }}>
    <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#cbd5e1', fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap' }}>
      {keys}
    </Typography>
    <Typography variant="caption" sx={{ fontSize: '0.6rem', color: '#64748b', whiteSpace: 'nowrap' }}>
      {desc}
    </Typography>
  </Box>
);

// Ground plane component
interface GroundProps {
  bounds?: { width: number; depth: number; center: THREE.Vector3 };
  theme?: Theme;
}

const Ground: React.FC<GroundProps> = ({ bounds, theme }) => {
  const groundRef = useRef<THREE.Mesh>(null);

  // Use calculated bounds or default
  const groundSize = bounds ? Math.max(bounds.width, bounds.depth) * 1.5 : WORLD_CONFIG.gridSize * 2;
  const centerX = bounds?.center.x || 0;
  const centerZ = bounds?.center.z || 0;

  return (
    <>
      {/* Ground plane only - no grid or dots */}
      <mesh
        ref={groundRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[centerX, -0.01, centerZ]}
        receiveShadow
      >
        <planeGeometry args={[groundSize, groundSize]} />
        <meshStandardMaterial color={theme?.colors.background || '#111827'} />
      </mesh>
    </>
  );
};

// Lighting setup
const Lighting: React.FC = () => {
  const dirLightRef = useRef<THREE.DirectionalLight>(null);

  useEffect(() => {
    if (dirLightRef.current && PERFORMANCE_CONFIG.shadowsEnabled) {
      dirLightRef.current.shadow.camera.left = -50;
      dirLightRef.current.shadow.camera.right = 50;
      dirLightRef.current.shadow.camera.top = 50;
      dirLightRef.current.shadow.camera.bottom = -50;
      dirLightRef.current.shadow.camera.near = 0.1;
      dirLightRef.current.shadow.camera.far = 200;
      dirLightRef.current.shadow.mapSize.width = LIGHTING_CONFIG.directional.shadowMapSize;
      dirLightRef.current.shadow.mapSize.height = LIGHTING_CONFIG.directional.shadowMapSize;
    }
  }, []);

  return (
    <>
      <ambientLight
        color={LIGHTING_CONFIG.ambient.color}
        intensity={LIGHTING_CONFIG.ambient.intensity}
      />
      <hemisphereLight
        color={LIGHTING_CONFIG.hemisphere.skyColor}
        groundColor={LIGHTING_CONFIG.hemisphere.groundColor}
        intensity={LIGHTING_CONFIG.hemisphere.intensity}
      />
      <directionalLight
        ref={dirLightRef}
        color={LIGHTING_CONFIG.directional.color}
        intensity={LIGHTING_CONFIG.directional.intensity}
        position={LIGHTING_CONFIG.directional.position}
        castShadow={PERFORMANCE_CONFIG.shadowsEnabled}
      />
    </>
  );
};

// Scene content component
interface SceneContentProps {
  nodes: any[];
  edges: any[];
  edgeMode?: 'floating' | 'fixed';
  edgeStyle?: 'smoothstep' | 'linear' | 'bezier';
  onNodeEdit?: (nodeId: string) => void;
  onEdgeEdit?: (edgeId: string) => void;
  onEntityHover?: (entity: GameEntity | null, position: THREE.Vector2 | null) => void;
  onEdgeSelect?: (entity: GameEntity, position: THREE.Vector2) => void;
  selectedNodeIds: Set<string>;
  selectedEdgeId?: string | null;
  onNodeSelect?: (entity: GameEntity, isMultiSelect: boolean) => void;
  theme?: Theme;
}

const SceneContent: React.FC<SceneContentProps> = ({
  nodes,
  edges,
  edgeMode,
  edgeStyle,
  onNodeEdit,
  onEdgeEdit,
  onEntityHover,
  onEdgeSelect,
  selectedNodeIds,
  selectedEdgeId,
  onNodeSelect,
  theme,
}) => {
  const gameData = useMemo(() => convertDiagramToGame(nodes, edges), [nodes, edges]);
  const { camera, gl } = useThree();

  // Convert 3D position to screen coordinates
  const worldToScreen = useCallback((position: THREE.Vector3): THREE.Vector2 => {
    const vector = position.clone();
    vector.project(camera);

    const widthHalf = gl.domElement.clientWidth / 2;
    const heightHalf = gl.domElement.clientHeight / 2;

    const x = (vector.x * widthHalf) + widthHalf;
    const y = -(vector.y * heightHalf) + heightHalf;

    return new THREE.Vector2(x, y);
  }, [camera, gl]);

  const handleEntityHover = useCallback((entity: GameEntity | null, worldPos: THREE.Vector3 | null) => {
    if (entity && worldPos) {
      const screenPos = worldToScreen(worldPos);
      onEntityHover?.(entity, screenPos);
    } else {
      onEntityHover?.(null, null);
    }
  }, [worldToScreen, onEntityHover]);

  const handleEdgeSelect = useCallback((entity: GameEntity, worldPos: THREE.Vector3) => {
    const screenPos = worldToScreen(worldPos);
    onEdgeSelect?.(entity, screenPos);
  }, [worldToScreen, onEdgeSelect]);

  return (
    <>
      {/* Render zones */}
      {gameData.zones.map(zone => (
        <SecurityZone
          key={zone.id}
          zone={zone}
        />
      ))}

      {/* Render entities */}
      {gameData.entities.map(entity => {
        if (entity.type === 'building') {
          const nodeId = entity.metadata.originalNode?.id;
          const isSelected = nodeId ? selectedNodeIds.has(nodeId) : false;

          return (
            <NodeBuilding
              key={entity.id}
              entity={entity}
              onEdit={onNodeEdit}
              onHover={handleEntityHover}
              onSelect={onNodeSelect}
              isSelected={isSelected}
              theme={theme}
            />
          );
        } else if (entity.type === 'path') {
          const edgeId = entity.metadata.originalEdge?.id || entity.id;
          return (
            <ConnectionPath
              key={entity.id}
              entity={entity}
              edgeMode={edgeMode}
              edgeStyle={edgeStyle}
              onEdit={onEdgeEdit}
              onHover={handleEntityHover}
              onSelect={handleEdgeSelect}
              isSelected={edgeId === selectedEdgeId}
              selectedNodeIds={selectedNodeIds}
            />
          );
        }
        return null;
      })}
    </>
  );
};

interface IsometricSceneProps {
  diagramData?: { nodes: any[], edges: any[] } | null;
  edgeMode?: 'floating' | 'fixed';
  edgeStyle?: 'smoothstep' | 'linear' | 'bezier';
  onNodeEdit?: (nodeId: string) => void;
  onEdgeEdit?: (edgeId: string) => void;
  onOpenManualFindings?: (item?: SecurityNode | SecurityEdge | null) => void;
  theme?: Theme;
  selectedNodeIds?: string[]; // Selected node IDs from parent
  onSelectionChange?: (nodeIds: string[]) => void; // Callback when selection changes
}

interface SceneWrapperProps {
  nodes: any[];
  edges: any[];
  bounds?: { width: number; depth: number; center: THREE.Vector3 };
  edgeMode?: 'floating' | 'fixed';
  edgeStyle?: 'smoothstep' | 'linear' | 'bezier';
  onNodeEdit?: (nodeId: string) => void;
  onEdgeEdit?: (edgeId: string) => void;
  onEntityHover?: (entity: GameEntity | null, position: THREE.Vector2 | null) => void;
  onEdgeSelect?: (entity: GameEntity, position: THREE.Vector2) => void;
  theme?: Theme;
  selectedNodeIds: Set<string>;
  selectedEdgeId?: string | null;
  onNodeSelect?: (entity: GameEntity, isMultiSelect: boolean) => void;
  useTouchControls: boolean;
}

const SceneWrapper: React.FC<SceneWrapperProps> = ({
  nodes,
  edges,
  bounds,
  edgeMode,
  edgeStyle,
  onNodeEdit,
  onEdgeEdit,
  onEntityHover,
  onEdgeSelect,
  theme,
  selectedNodeIds,
  selectedEdgeId,
  onNodeSelect,
  useTouchControls
}) => {
  return (
    <>
      {/* Environment and lighting */}
      <Environment preset="city" />
      <Lighting />

      {/* Atmospheric fog - far distance to avoid obscuring components */}
      <fog attach="fog" args={[theme?.colors.background || '#1e1e1e', 200, 500]} />

      {/* Ground and grid */}
      <Ground bounds={bounds} theme={theme} />

      {/* Camera controls */}
      {useTouchControls ? <TouchCameraController /> : <UnrealCameraController />}

      {/* Scene content */}
      <SceneContent
        nodes={nodes}
        edges={edges}
        edgeMode={edgeMode}
        edgeStyle={edgeStyle}
        onNodeEdit={onNodeEdit}
        onEdgeEdit={onEdgeEdit}
        onEntityHover={onEntityHover}
        onEdgeSelect={onEdgeSelect}
        selectedNodeIds={selectedNodeIds}
        selectedEdgeId={selectedEdgeId}
        onNodeSelect={onNodeSelect}
        theme={theme}
      />

      {/* Performance stats in development */}
      {process.env.NODE_ENV === 'development' && <Stats />}
    </>
  );
};

export const IsometricScene: React.FC<IsometricSceneProps> = ({
  diagramData,
  edgeMode,
  edgeStyle,
  onNodeEdit,
  onEdgeEdit,
  onOpenManualFindings = undefined,
  theme,
  selectedNodeIds: parentSelectedNodeIds,
  onSelectionChange
}) => {
  const { state } = useAnalysisContext();
  const { runAnalysis } = useManualAnalysis();
  const { viewportTier } = useViewportLayout();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredEntity, setHoveredEntity] = useState<GameEntity | null>(null);
  const [inspectorPosition, setInspectorPosition] = useState<{ x: number; y: number } | null>(null);
  const [isInspectorHovered, setIsInspectorHovered] = useState(false);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set(parentSelectedNodeIds || []));
  const inspectorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inspectorHideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInspectorHoveredRef = useRef(false);
  const isEntityHoveredRef = useRef(false);

  // Get nodes and edges from props first, then fall back to context
  const nodes = diagramData?.nodes || state.currentState?.nodes || [];
  const edges = diagramData?.edges || state.currentState?.edges || [];
  const handleOpenManualFindings = onOpenManualFindings;
  const useTouchControls = viewportTier === 'xs' || viewportTier === 'sm' || viewportTier === 'md';
  const [controlsLegendOpen, setControlsLegendOpen] = useState(true);

  useEffect(() => {
    runAnalysis({ nodes, edges });
  }, [nodes, edges, runAnalysis]);

  // Update internal selection when parent selection changes or when nodes change
  useEffect(() => {
    if (parentSelectedNodeIds) {
      setSelectedNodeIds(new Set(parentSelectedNodeIds));
    } else {
      // If no explicit selection from parent, use the selected property from nodes
      const selectedIds = nodes
        .filter(node => node.selected)
        .map(node => node.id);
      setSelectedNodeIds(new Set(selectedIds));
    }
  }, [parentSelectedNodeIds, nodes]);

  // Handle node selection with multi-select support
  const handleNodeSelect = useCallback((entity: GameEntity, isMultiSelect: boolean) => {
    if (!entity.metadata.originalNode) return;

    const nodeId = entity.metadata.originalNode.id;

    setSelectedNodeIds(prev => {
      const newSelection = new Set(prev);

      if (isMultiSelect) {
        // Toggle selection
        if (newSelection.has(nodeId)) {
          newSelection.delete(nodeId);
        } else {
          newSelection.add(nodeId);
        }
      } else {
        // Single selection - clear others
        newSelection.clear();
        newSelection.add(nodeId);
      }

      // Notify parent of selection change
      if (onSelectionChange) {
        onSelectionChange(Array.from(newSelection));
      }

      return newSelection;
    });
  }, [onSelectionChange]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Select All (Ctrl/Cmd + A)
      if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
        event.preventDefault();
        const allNodeIds = nodes.map(n => n.id);
        setSelectedNodeIds(new Set(allNodeIds));
        if (onSelectionChange) {
          onSelectionChange(allNodeIds);
        }
      }
      // Deselect All (Escape)
      else if (event.key === 'Escape') {
        event.preventDefault();
        setSelectedNodeIds(new Set());
        if (onSelectionChange) {
          onSelectionChange([]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, onSelectionChange]);

  // Handle entity hover
  const clearHideTimeout = useCallback(() => {
    if (inspectorHideTimeoutRef.current) {
      clearTimeout(inspectorHideTimeoutRef.current);
      inspectorHideTimeoutRef.current = null;
    }
  }, []);

  const scheduleHideInspector = useCallback(() => {
    clearHideTimeout();
    inspectorHideTimeoutRef.current = setTimeout(() => {
      if (!isInspectorHoveredRef.current && !isEntityHoveredRef.current) {
        setHoveredEntity(null);
        setInspectorPosition(null);
      }
    }, 300);
  }, [clearHideTimeout]);

  const handleEntityHover = useCallback((entity: GameEntity | null, screenPos: THREE.Vector2 | null) => {
    clearHideTimeout();

    // Clear any existing show timeout
    if (inspectorTimeoutRef.current) {
      clearTimeout(inspectorTimeoutRef.current);
      inspectorTimeoutRef.current = null;
    }

    if (entity && screenPos) {
      isEntityHoveredRef.current = true;
      // Set timeout to show inspector after 2 seconds
      inspectorTimeoutRef.current = setTimeout(() => {
        setHoveredEntity(entity);
        setInspectorPosition({ x: screenPos.x, y: screenPos.y });
      }, 2000);
    } else {
      isEntityHoveredRef.current = false;
      if (!isInspectorHoveredRef.current) {
        scheduleHideInspector();
      }
    }
  }, [clearHideTimeout, scheduleHideInspector]);

  const handleEdgeSelect = useCallback((entity: GameEntity, _screenPos: THREE.Vector2) => {
    clearHideTimeout();
    if (inspectorTimeoutRef.current) {
      clearTimeout(inspectorTimeoutRef.current);
      inspectorTimeoutRef.current = null;
    }
    const edgeId = entity.metadata.originalEdge?.id || entity.id;
    setSelectedEdgeId(edgeId);
  }, [clearHideTimeout]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (inspectorTimeoutRef.current) {
        clearTimeout(inspectorTimeoutRef.current);
      }
      if (inspectorHideTimeoutRef.current) {
        clearTimeout(inspectorHideTimeoutRef.current);
      }
    };
  }, []);

  // Convert GameEntity to SecurityNode or SecurityEdge
  const getInspectorItem = useCallback((): SecurityNode | SecurityEdge | null => {
    if (!hoveredEntity) return null;

    if (hoveredEntity.type === 'building' && hoveredEntity.metadata.originalNode) {
      return hoveredEntity.metadata.originalNode as SecurityNode;
    } else if (hoveredEntity.type === 'path' && hoveredEntity.metadata.originalEdge) {
      return hoveredEntity.metadata.originalEdge as SecurityEdge;
    }

    return null;
  }, [hoveredEntity]);

  // Calculate bounds for the entire diagram
  const bounds = useMemo(() => {
    const gameData = convertDiagramToGame(nodes, edges);

    let minX = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxZ = -Infinity;

    // Include zones in bounds
    gameData.zones.forEach(zone => {
      minX = Math.min(minX, zone.bounds.min.x);
      minZ = Math.min(minZ, zone.bounds.min.z);
      maxX = Math.max(maxX, zone.bounds.max.x);
      maxZ = Math.max(maxZ, zone.bounds.max.z);
    });

    // Include entities in bounds
    gameData.entities.forEach(entity => {
      const x = entity.position.x;
      const z = entity.position.z;
      const halfWidth = entity.scale.x / 2;
      const halfDepth = entity.scale.z / 2;

      minX = Math.min(minX, x - halfWidth);
      minZ = Math.min(minZ, z - halfDepth);
      maxX = Math.max(maxX, x + halfWidth);
      maxZ = Math.max(maxZ, z + halfDepth);
    });

    // If no entities, use default bounds
    if (!isFinite(minX)) {
      return undefined;
    }

    const width = maxX - minX;
    const depth = maxZ - minZ;
    const center = new THREE.Vector3(
      (minX + maxX) / 2,
      0,
      (minZ + maxZ) / 2
    );

    return { width, depth, center };
  }, [nodes, edges]);

  return (
    <Box
      ref={containerRef}
      sx={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: theme?.colors.background || '#1e1e1e',
      }}
    >
      <Canvas
        shadows={PERFORMANCE_CONFIG.shadowsEnabled}
        dpr={PERFORMANCE_CONFIG.pixelRatio}
        gl={{
          antialias: PERFORMANCE_CONFIG.antialias,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        onCreated={({ scene }) => {
          if (theme) {
            scene.background = new THREE.Color(theme.colors.background);
          }
        }}
        camera={{
          fov: CAMERA_CONFIG.fov,
          near: CAMERA_CONFIG.near,
          far: CAMERA_CONFIG.far,
          position: [50, 50, 50],
        }}
      >
        <Suspense fallback={null}>
            <SceneWrapper
            nodes={nodes}
            edges={edges}
            bounds={bounds}
            edgeMode={edgeMode}
            edgeStyle={edgeStyle}
            onNodeEdit={onNodeEdit}
            onEdgeEdit={onEdgeEdit}
            onEntityHover={handleEntityHover}
            onEdgeSelect={handleEdgeSelect}
            theme={theme}
            selectedNodeIds={selectedNodeIds}
            selectedEdgeId={selectedEdgeId}
            onNodeSelect={handleNodeSelect}
            useTouchControls={useTouchControls}
          />
        </Suspense>
      </Canvas>

      {/* QuickInspector overlay */}
      {hoveredEntity && inspectorPosition && (
        <QuickInspector
          item={getInspectorItem()}
          position={inspectorPosition}
          visible={true}
          onClose={() => {
            setHoveredEntity(null);
            setInspectorPosition(null);
          }}
          onOpenFullEditor={() => {
            const item = getInspectorItem();
            if (!item) return;

            if ('source' in item) {
              // It's an edge
              onEdgeEdit?.(item.id);
            } else {
              // It's a node
              onNodeEdit?.(item.id);
            }
            setHoveredEntity(null);
            setInspectorPosition(null);
          }}
          onOpenManualFindings={(item) => {
            handleOpenManualFindings?.(item);
            setHoveredEntity(null);
            setInspectorPosition(null);
          }}
          onInspectorMouseEnter={() => {
            setIsInspectorHovered(true);
            isInspectorHoveredRef.current = true;
            clearHideTimeout();
          }}
          onInspectorMouseLeave={() => {
            setIsInspectorHovered(false);
            isInspectorHoveredRef.current = false;
            if (!isEntityHoveredRef.current) {
              scheduleHideInspector();
            }
          }}
          allNodes={nodes}
        />
      )}

      {/* Loading overlay */}
      <Suspense fallback={<LoadingScreen />}>
        {/* Additional UI overlays can go here */}
      </Suspense>

      {/* Controls legend */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 12,
          left: 56,
          zIndex: 10,
          pointerEvents: 'auto',
        }}
      >
        <Collapse in={controlsLegendOpen} collapsedSize={0}>
          <Box
            sx={{
              bgcolor: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(6px)',
              borderRadius: 1.5,
              px: 1.5,
              pt: 0.75,
              pb: 1,
              minWidth: 170,
              color: '#e2e8f0',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.7rem', letterSpacing: 0.5, textTransform: 'uppercase', color: '#94a3b8' }}>
                Controls
              </Typography>
              <IconButton size="small" onClick={() => setControlsLegendOpen(false)} sx={{ p: 0.25, color: '#94a3b8' }}>
                <XIcon size={12} />
              </IconButton>
            </Box>
            {useTouchControls ? (
              <Box sx={{ display: 'grid', gap: 0.25 }}>
                <LegendRow keys="Drag" desc="Rotate view" />
                <LegendRow keys="Pinch" desc="Zoom in/out" />
                <LegendRow keys="2-finger drag" desc="Pan" />
                <LegendRow keys="Tap" desc="Select node" />
              </Box>
            ) : (
              <Box sx={{ display: 'grid', gap: 0.25 }}>
                <LegendRow keys="W A S D" desc="Move" />
                <LegendRow keys="Q / E" desc="Down / Up" />
                <LegendRow keys="Shift" desc="Sprint" />
                <LegendRow keys="Right-click + drag" desc="Look around" />
                <LegendRow keys="Left-click" desc="Select node" />
                <LegendRow keys="Scroll" desc="Zoom" />
                <LegendRow keys="Ctrl + A" desc="Select all" />
                <LegendRow keys="Esc" desc="Deselect" />
              </Box>
            )}
          </Box>
        </Collapse>
        {!controlsLegendOpen && (
          <Tooltip title="Show 3D controls" arrow placement="right">
            <IconButton
              size="small"
              onClick={() => setControlsLegendOpen(true)}
              sx={{
                bgcolor: 'rgba(0,0,0,0.65)',
                backdropFilter: 'blur(6px)',
                color: '#94a3b8',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.8)', color: '#e2e8f0' },
                p: 0.75,
              }}
            >
              <HelpCircle size={16} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
};
