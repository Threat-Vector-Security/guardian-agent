import React, { useState } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { Box } from '@mui/material';
import { ThreeEvent } from '@react-three/fiber';
import { GameEntity } from '../utils/diagramToGame';
import { BUILDING_CONFIGS, ZONE_COLORS } from '../utils/gameConstants';
import { getNodeIcon } from '../../../utils/iconUtils';
import { nodeTypeConfig } from '../../SecurityNodes';
import { colors, Theme } from '../../../styles/Theme';

interface NodeBuildingProps {
  entity: GameEntity;
  onSelect?: (entity: GameEntity, isMultiSelect: boolean) => void;
  onEdit?: (nodeId: string) => void;
  onHover?: (entity: GameEntity | null, position: THREE.Vector3 | null) => void;
  isSelected?: boolean;
  theme?: Theme;
}

// Map 2D shapes to 3D geometries
const shapeToGeometry: Record<string, 'box' | 'cylinder' | 'cone' | 'sphere' | 'octahedron' | 'dodecahedron'> = {
  // Box-like shapes
  'rectangle': 'box',
  'rounded-rectangle': 'box',
  'square': 'box',
  'trapezoid': 'box',
  'parallelogram': 'box',
  'house': 'box',
  'factory': 'box',
  'document': 'box',

  // Diamond/angular shapes
  'diamond': 'octahedron',
  'triangle': 'cone',
  'arrow-up': 'cone',
  'arrow-down': 'cone',

  // Round shapes
  'circle': 'sphere',
  'ellipse': 'sphere',
  'cylinder': 'cylinder',
  'capsule': 'cylinder',

  // Complex shapes
  'hexagon': 'dodecahedron',
  'pentagon': 'dodecahedron',
  'octagon': 'dodecahedron',
  'star': 'dodecahedron',
  'shield': 'dodecahedron',
  'cloud': 'sphere',

  // Cross/plus shapes
  'plus': 'box',
  'cross': 'box',

  // Arrows (horizontal/vertical)
  'arrow-right': 'box',
  'arrow-left': 'box',
  'arrow-horizontal': 'box',
  'arrow-vertical': 'box',
};

export const NodeBuilding: React.FC<NodeBuildingProps> = ({
  entity,
  onSelect,
  onEdit,
  onHover,
  isSelected,
  theme
}) => {
  const [hovered, setHovered] = useState(false);

  // Get building configuration from SecurityNodes.tsx to match 2D diagram
  const nodeType = entity.metadata.nodeType || 'generic';
  const nodeConfig = nodeTypeConfig[nodeType] || nodeTypeConfig.generic;
  const buildingConfig = BUILDING_CONFIGS[nodeType] || BUILDING_CONFIGS.generic;

  // Use the node type color from nodeTypeConfig (matches 2D diagram)
  const nodeColor = colors[nodeConfig.color] as string;

  // Get shape from node data and map to 3D geometry
  const nodeShape = (entity.metadata.originalNode?.data as any)?.shape || 'rounded-rectangle';
  const geometry = shapeToGeometry[nodeShape] || buildingConfig.geometry || 'box';

  // Get zone info for the badge
  const nodeZone = entity.metadata.zone;
  const zoneColor = nodeZone && ZONE_COLORS[nodeZone.toLowerCase()]
    ? ZONE_COLORS[nodeZone.toLowerCase()].color
    : null;

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    onSelect?.(entity, event.nativeEvent.ctrlKey || event.nativeEvent.metaKey);
  };

  const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
    setHovered(true);
    document.body.style.cursor = 'pointer';
    onHover?.(entity, event.point);
  };

  const handlePointerOut = () => {
    setHovered(false);
    document.body.style.cursor = 'default';
    onHover?.(null, null);
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (hovered) {
      onHover?.(entity, event.point);
    }
  };

  const handleDoubleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    // Open the node editor
    if (onEdit && entity.metadata.originalNode) {
      onEdit(entity.metadata.originalNode.id);
    }
  };

  const accentColor = React.useMemo(() => {
    const base = new THREE.Color(nodeColor);
    const accent = base.clone();
    accent.offsetHSL(0, 0, 0.15);
    return `#${accent.getHexString()}`;
  }, [nodeColor]);

  const iconElement = React.useMemo(() => (
    getNodeIcon((entity.metadata.originalNode?.type || entity.metadata.nodeType || 'generic') as any)
  ), [entity.metadata.originalNode?.type, entity.metadata.nodeType]);

  // Get index code from node data
  const nodeIndexCode = (entity.metadata.originalNode?.data as any)?.indexCode ||
                        (entity.metadata.originalNode as any)?.indexCode ||
                        entity.metadata.indexCode;


  return (
    <group position={entity.position} rotation={entity.rotation}>
      {/* Selection ring indicator */}
      {isSelected && (
        <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[
            Math.max(entity.scale.x, entity.scale.z) * 0.7,
            Math.max(entity.scale.x, entity.scale.z) * 0.8,
            32
          ]} />
          <meshBasicMaterial
            color="#ffffff"
            opacity={0.8}
            transparent
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      <group
        castShadow
        receiveShadow
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onPointerMove={handlePointerMove}
      >
        <mesh castShadow receiveShadow>
          {/* Dynamic geometry based on shape */}
          {geometry === 'box' && (
            <boxGeometry args={[entity.scale.x, entity.scale.y, entity.scale.z]} />
          )}
          {geometry === 'cylinder' && (
            <cylinderGeometry args={[entity.scale.x / 2, entity.scale.x / 2, entity.scale.y, 32]} />
          )}
          {geometry === 'cone' && (
            <coneGeometry args={[entity.scale.x / 2, entity.scale.y, 32]} />
          )}
          {geometry === 'sphere' && (
            <sphereGeometry args={[Math.min(entity.scale.x, entity.scale.y, entity.scale.z) / 2, 32, 16]} />
          )}
          {geometry === 'octahedron' && (
            <octahedronGeometry args={[Math.min(entity.scale.x, entity.scale.y, entity.scale.z) / 2]} />
          )}
          {geometry === 'dodecahedron' && (
            <dodecahedronGeometry args={[Math.min(entity.scale.x, entity.scale.y, entity.scale.z) / 2]} />
          )}
          <meshStandardMaterial
            color={nodeColor}
            metalness={0.2}
            roughness={0.8}
            emissive={isSelected ? '#ffffff' : nodeColor}
            emissiveIntensity={isSelected ? 0.4 : (hovered ? 0.2 : 0.05)}
          />
        </mesh>
        <mesh position={[0, -entity.scale.y / 2 - 0.05, 0]} castShadow receiveShadow>
          <boxGeometry args={[entity.scale.x * 0.9, 0.1, entity.scale.z * 0.9]} />
          <meshStandardMaterial
            color="#111827"
            metalness={0.3}
            roughness={0.7}
          />
        </mesh>

        {/* Floating icon sprite above node */}
        {iconElement && (
          <Html
            position={[0, entity.scale.y / 2 + 1, 0]}
            transform
            sprite
            center
            distanceFactor={10}
            zIndexRange={[1, 0]}
            style={{ pointerEvents: 'auto', cursor: 'pointer' }}
            onClick={handleClick}
            onDoubleClick={(e) => {
              e.stopPropagation();
              handleDoubleClick({ stopPropagation: () => {} } as any);
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                pointerEvents: 'auto',
                cursor: 'pointer',
              }}
            >
              {/* Icon */}
              <Box
                sx={{
                  width: 60,
                  height: 60,
                  backgroundColor: theme?.colors.surface || 'rgba(0, 0, 0, 0.85)',
                  color: theme?.colors.textPrimary || 'white',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `3px solid ${nodeColor}`,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                }}
              >
                {React.cloneElement(iconElement, {
                  sx: {
                    fontSize: 36,
                    color: theme?.colors.textPrimary || 'white',
                    filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.8))'
                  }
                })}
              </Box>

              {/* Main label */}
              <Box
                sx={{
                  px: 2,
                  py: 1,
                  backgroundColor: theme?.colors.surface || 'rgba(0, 0, 0, 0.85)',
                  color: theme?.colors.textPrimary || 'white',
                  borderRadius: 1,
                  fontSize: '18px',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  border: `2px solid ${nodeColor}`,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.4)'
                }}
              >
                {(entity.metadata.originalNode?.data as any)?.label || entity.id}
              </Box>

              {/* Index code badge */}
              {nodeIndexCode && (
                <Box
                  sx={{
                    px: 1.5,
                    py: 0.5,
                    backgroundColor: theme?.colors.background || '#1e1e1e',
                    color: theme?.colors.textSecondary || '#9ca3af',
                    border: `1px solid ${theme?.colors.border || '#374151'}`,
                    borderRadius: '12px',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }}
                >
                  {nodeIndexCode}
                </Box>
              )}

              {/* Security Zone Badge */}
              {nodeZone && zoneColor && (
                <Box
                  sx={{
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    color: 'white',
                    border: `2px solid ${zoneColor}`,
                    borderRadius: '12px',
                    padding: '4px 12px',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    boxShadow: `0 0 12px ${zoneColor}40`,
                    textTransform: 'capitalize',
                    position: 'relative',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: zoneColor,
                      opacity: 0.2,
                      borderRadius: '10px',
                    }
                  }}
                >
                  {nodeZone}
                </Box>
              )}
            </Box>
          </Html>
        )}

      </group>


    </group>
  );
};
