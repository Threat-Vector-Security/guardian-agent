import React, { useState, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Html, Line, Sphere } from '@react-three/drei';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { GameEntity, flowToWorldPosition, FLOW_TO_WORLD_OFFSET, FLOW_TO_WORLD_SCALE } from '../utils/diagramToGame';
import { ZONE_COLORS, CONNECTION_CONFIGS, EDGE_BASE_HEIGHT } from '../utils/gameConstants';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import type { XYPosition } from '@xyflow/react';
import { getLabelPosition, getPathPoints } from '../../edges/edgePathUtils';
import type { ControlPointData } from '../../../types/SecurityTypes';

const CURVE_SAMPLE_STEPS = 32;

// Helper function to determine if a color is light or dark
const isLightColor = (color: string): boolean => {
  // Convert hex to RGB
  const c = new THREE.Color(color);
  // Calculate relative luminance using the formula from WCAG
  const luminance = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  // Return true if the color is light (luminance > 0.5)
  return luminance > 0.5;
};

// Animated dashed line component using custom shader
const AnimatedDashedLine: React.FC<{
  points: THREE.Vector3[];
  color: string;
  lineWidth: number;
  dashOffset: React.MutableRefObject<number>;
}> = ({ points, color, lineWidth, dashOffset }) => {
  const lineRef = useRef<any>(null);

  // Custom shader material with animated dashes
  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(color) },
        dashSize: { value: 1.0 },
        gapSize: { value: 1.0 },
        totalSize: { value: 2.0 }, // dashSize + gapSize
        time: { value: 0 },
        opacity: { value: 0.8 }
      },
      vertexShader: `
        attribute float lineDistance;
        varying float vLineDistance;

        void main() {
          vLineDistance = lineDistance;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        uniform float dashSize;
        uniform float gapSize;
        uniform float totalSize;
        uniform float time;
        uniform float opacity;

        varying float vLineDistance;

        void main() {
          float offset = vLineDistance - time * 2.0;
          float dashOn = mod(offset, totalSize);

          if (dashOn > dashSize) {
            discard;
          }

          gl_FragColor = vec4(color, opacity);
        }
      `,
      transparent: true
    });

    return mat;
  }, [color]);

  // Update time uniform for animation
  useFrame((state) => {
    if (material) {
      material.uniforms.time.value = state.clock.elapsedTime;
      dashOffset.current = state.clock.elapsedTime * 2;
    }
  });

  // Create geometry with line distances
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(points.length * 3);
    const lineDistances = new Float32Array(points.length);

    let distance = 0;
    points.forEach((point, i) => {
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;

      // Calculate cumulative distance for dashed line
      if (i > 0) {
        distance += points[i].distanceTo(points[i - 1]);
      }
      lineDistances[i] = distance;
    });

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('lineDistance', new THREE.BufferAttribute(lineDistances, 1));
    geo.computeBoundingSphere();
    return geo;
  }, [points]);

  return (
    <line ref={lineRef}>
      <primitive object={geometry} />
      <primitive object={material} />
    </line>
  );
};

const sampleQuadraticBezier = (start: XYPosition, control: XYPosition, end: XYPosition, steps = CURVE_SAMPLE_STEPS): XYPosition[] => {
  const points: XYPosition[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const x = mt * mt * start.x + 2 * mt * t * control.x + t * t * end.x;
    const y = mt * mt * start.y + 2 * mt * t * control.y + t * t * end.y;
    points.push({ x, y });
  }
  return points;
};

const sampleCubicBezier = (start: XYPosition, controlA: XYPosition, controlB: XYPosition, end: XYPosition, steps = CURVE_SAMPLE_STEPS): XYPosition[] => {
  const points: XYPosition[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;
    const x = mt3 * start.x + 3 * mt2 * t * controlA.x + 3 * mt * t2 * controlB.x + t3 * end.x;
    const y = mt3 * start.y + 3 * mt2 * t * controlA.y + 3 * mt * t2 * controlB.y + t3 * end.y;
    points.push({ x, y });
  }
  return points;
};

const sampleBezierPath = (points: XYPosition[]): XYPosition[] => {
  if (points.length <= 2) {
    return points;
  }

  if (points.length === 3) {
    return sampleQuadraticBezier(points[0], points[1], points[2]);
  }

  if (points.length === 4) {
    return sampleCubicBezier(points[0], points[1], points[2], points[3]);
  }

  const sampled: XYPosition[] = [points[0]];
  let currentStart = points[0];

  for (let i = 1; i < points.length - 1; i++) {
    const control = points[i];
    const next = points[i + 1];
    const isLast = i === points.length - 2;
    const segmentEnd = isLast ? next : { x: (control.x + next.x) / 2, y: (control.y + next.y) / 2 };
    const segmentPoints = sampleQuadraticBezier(currentStart, control, segmentEnd);

    // Avoid overlapping the previous point when concatenating the samples
    sampled.push(...segmentPoints.slice(1));
    currentStart = segmentEnd;
  }

  return sampled;
};

const worldToFlowPosition = (position: THREE.Vector3): XYPosition => ({
  x: (position.x + FLOW_TO_WORLD_OFFSET) / FLOW_TO_WORLD_SCALE,
  y: (position.z + FLOW_TO_WORLD_OFFSET) / FLOW_TO_WORLD_SCALE,
});

// Map shape types to their connection behavior
const shapeConnectionType: Record<string, 'box' | 'round' | 'angular'> = {
  // Box shapes connect at edges
  'rectangle': 'box',
  'rounded-rectangle': 'box',
  'square': 'box',
  'trapezoid': 'box',
  'parallelogram': 'box',
  'house': 'box',
  'factory': 'box',
  'document': 'box',
  'plus': 'box',
  'cross': 'box',
  'arrow-right': 'box',
  'arrow-left': 'box',
  'arrow-horizontal': 'box',
  'arrow-vertical': 'box',

  // Round shapes connect at radius
  'circle': 'round',
  'ellipse': 'round',
  'cylinder': 'round',
  'capsule': 'round',
  'cloud': 'round',

  // Angular shapes have special connection points
  'diamond': 'angular',
  'triangle': 'angular',
  'arrow-up': 'angular',
  'arrow-down': 'angular',
  'hexagon': 'angular',
  'pentagon': 'angular',
  'octagon': 'angular',
  'star': 'angular',
  'shield': 'angular',
};

const clampPointToBuildingSurface = (
  point: THREE.Vector3,
  buildingCenter?: THREE.Vector3,
  buildingScale?: THREE.Vector3,
  nodeShape?: string
): THREE.Vector3 => {
  if (!buildingCenter || !buildingScale) {
    return point;
  }

  const connectionType = shapeConnectionType[nodeShape || 'rounded-rectangle'] || 'box';
  const relative = point.clone().sub(buildingCenter);

  if (connectionType === 'round') {
    // For round shapes, clamp to radius
    const radius = Math.min(buildingScale.x, buildingScale.z) / 2;
    const distance = Math.sqrt(relative.x * relative.x + relative.z * relative.z);

    if (distance <= radius) {
      return point;
    }

    const scale = radius / distance;
    relative.x *= scale;
    relative.z *= scale;
  } else if (connectionType === 'angular') {
    // For angular shapes, use a slightly smaller box to account for vertices
    const halfX = buildingScale.x * 0.4;
    const halfZ = buildingScale.z * 0.4;

    if (Math.abs(relative.x) <= halfX && Math.abs(relative.z) <= halfZ) {
      return point;
    }

    const scaleX = relative.x !== 0 ? halfX / Math.abs(relative.x) : Number.POSITIVE_INFINITY;
    const scaleZ = relative.z !== 0 ? halfZ / Math.abs(relative.z) : Number.POSITIVE_INFINITY;
    const clampScale = Math.min(scaleX, scaleZ);

    if (!Number.isFinite(clampScale) || clampScale >= 1) {
      return point;
    }

    relative.multiplyScalar(clampScale);
  } else {
    // Box shapes - standard clamping
    const halfX = buildingScale.x / 2;
    const halfZ = buildingScale.z / 2;

    if (Math.abs(relative.x) <= halfX && Math.abs(relative.z) <= halfZ) {
      return point;
    }

    const scaleX = relative.x !== 0 ? halfX / Math.abs(relative.x) : Number.POSITIVE_INFINITY;
    const scaleZ = relative.z !== 0 ? halfZ / Math.abs(relative.z) : Number.POSITIVE_INFINITY;
    const clampScale = Math.min(scaleX, scaleZ);

    if (!Number.isFinite(clampScale) || clampScale >= 1) {
      return point;
    }

    relative.multiplyScalar(clampScale);
  }

  const clamped = buildingCenter.clone().add(relative);
  clamped.y = point.y;
  return clamped;
};

interface ConnectionPathProps {
  entity: GameEntity;
  edgeMode?: 'floating' | 'fixed';
  edgeStyle?: 'smoothstep' | 'linear' | 'bezier';
  onEdit?: (edgeId: string) => void;
  onHover?: (entity: GameEntity | null, position: THREE.Vector3 | null) => void;
  onSelect?: (entity: GameEntity, position: THREE.Vector3) => void;
  isSelected?: boolean;
  selectedNodeIds?: Set<string>;
}

export const ConnectionPath: React.FC<ConnectionPathProps> = ({
  entity,
  edgeMode = 'floating',
  edgeStyle = 'smoothstep',
  onEdit,
  onHover,
  onSelect,
  isSelected = false,
  selectedNodeIds
}) => {
  const theme = useTheme();
  const [hovered, setHovered] = useState(false);
  const dashOffsetRef = useRef(0);

  // Check if this edge is connected to a selected node
  const isConnectedToSelectedNode = useMemo(() => {
    if (!selectedNodeIds || selectedNodeIds.size === 0) return false;
    const sourceId = entity.metadata.originalEdge?.source;
    const targetId = entity.metadata.originalEdge?.target;
    return (sourceId && selectedNodeIds.has(sourceId)) || (targetId && selectedNodeIds.has(targetId));
  }, [selectedNodeIds, entity.metadata.originalEdge]);

  // Get color based on zone or edge type
  const edgeZone = entity.metadata.zone?.toLowerCase();
  const edgeType = entity.metadata.edgeType?.toLowerCase() || 'default';
  const edgeConfig = CONNECTION_CONFIGS[edgeType as keyof typeof CONNECTION_CONFIGS] || CONNECTION_CONFIGS.default;

  // Use zone color if available, otherwise use edge type color
  const pathColor = edgeZone && ZONE_COLORS[edgeZone]
    ? ZONE_COLORS[edgeZone].color
    : edgeConfig.color;

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

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect?.(entity, event.point);
  };

  const handleDoubleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    // Open the edge editor
    if (onEdit && entity.metadata.originalEdge) {
      onEdit(entity.metadata.originalEdge.id);
    }
  };

  // Get edge label (use actual label, fallback to protocol)
  const edgeLabel = (entity.metadata.originalEdge?.data as any)?.label ||
                   (entity.metadata.originalEdge?.data as any)?.protocol ||
                   entity.metadata.edgeType ||
                   'Connection';

  // Get control points from the original edge data
  const controlPointsData: ControlPointData[] = Array.isArray((entity.metadata.originalEdge?.data as any)?.controlPoints)
    ? (entity.metadata.originalEdge?.data as any).controlPoints
    : [];
  // Calculate positions for the connection
  const { edgePoints3D, controlPoints3D, labelPosition } = useMemo<{
    edgePoints3D: THREE.Vector3[];
    controlPoints3D: THREE.Vector3[];
    labelPosition: THREE.Vector3;
  }>(() => {
    const baseHeight = EDGE_BASE_HEIGHT;

    const resolvedPath2D: XYPosition[] = (() => {
      if (entity.metadata.pathPoints2D && entity.metadata.pathPoints2D.length >= 2) {
        return entity.metadata.pathPoints2D;
      }

      if (entity.metadata.sourceFlowPos && entity.metadata.targetFlowPos) {
        return getPathPoints(entity.metadata.sourceFlowPos, entity.metadata.targetFlowPos, controlPointsData);
      }

      if (entity.metadata.sourcePos && entity.metadata.targetPos) {
        const sourceFlow = worldToFlowPosition(entity.metadata.sourcePos);
        const targetFlow = worldToFlowPosition(entity.metadata.targetPos);
        return getPathPoints(sourceFlow, targetFlow, controlPointsData);
      }

      return [];
    })();

    if (resolvedPath2D.length < 2) {
      const defaultStart = entity.metadata.sourcePos?.clone() || new THREE.Vector3(entity.position.x, baseHeight, entity.position.z);
      const defaultEnd = entity.metadata.targetPos?.clone() || defaultStart.clone();
      const defaultLabel = defaultStart.clone().lerp(defaultEnd, 0.5);
      defaultLabel.y = baseHeight;

      return {
        edgePoints3D: [defaultStart, defaultEnd],
        controlPoints3D: [] as THREE.Vector3[],
        labelPosition: defaultLabel,
      };
    }

    const sampled2D = edgeStyle === 'bezier'
      ? sampleBezierPath(resolvedPath2D)
      : resolvedPath2D;

    const edgeOffset = entity.metadata.edgeOffset || 0;
    const baseStartWorld = flowToWorldPosition(resolvedPath2D[0], baseHeight);
    const baseEndWorld = flowToWorldPosition(resolvedPath2D[resolvedPath2D.length - 1], baseHeight);

    let offsetVector = new THREE.Vector3(0, 0, 0);
    if (edgeOffset !== 0) {
      const dir = new THREE.Vector3(
        baseEndWorld.x - baseStartWorld.x,
        0,
        baseEndWorld.z - baseStartWorld.z
      );
      if (dir.lengthSq() > 0.0001) {
        dir.normalize();
        const perp = new THREE.Vector3(-dir.z, 0, dir.x);
        offsetVector = perp.multiplyScalar(edgeOffset * FLOW_TO_WORLD_SCALE);
      }
    }

    const hasOffset = offsetVector.lengthSq() > 0.0001;

    const points3D = sampled2D.map((point) => {
      const worldPoint = flowToWorldPosition(point, baseHeight);
      if (hasOffset) {
        worldPoint.add(offsetVector);
      }
      return worldPoint;
    });

    if (points3D.length >= 2) {
      const sourceShape = (entity.metadata.sourceNode as any)?.shape || (entity.metadata.originalEdge?.data as any)?.sourceShape;
      const targetShape = (entity.metadata.targetNode as any)?.shape || (entity.metadata.originalEdge?.data as any)?.targetShape;

      const sourceClamped = clampPointToBuildingSurface(
        points3D[0],
        entity.metadata.sourceBuildingPosition,
        entity.metadata.sourceBuildingScale,
        sourceShape
      );
      points3D[0] = sourceClamped;

      const targetClamped = clampPointToBuildingSurface(
        points3D[points3D.length - 1],
        entity.metadata.targetBuildingPosition,
        entity.metadata.targetBuildingScale,
        targetShape
      );
      points3D[points3D.length - 1] = targetClamped;
    }

    const cp3D = controlPointsData.map((cp) => {
      const worldPoint = flowToWorldPosition({ x: cp.x, y: cp.y }, baseHeight + 0.6);
      if (hasOffset) {
        worldPoint.add(offsetVector);
      }
      return worldPoint;
    });

    const labelInfo = getLabelPosition(resolvedPath2D);
    const labelWorld = flowToWorldPosition({ x: labelInfo.x, y: labelInfo.y }, baseHeight);
    if (hasOffset) {
      labelWorld.add(offsetVector);
    }

    return {
      edgePoints3D: points3D,
      controlPoints3D: cp3D,
      labelPosition: labelWorld,
    };
  }, [controlPointsData, edgeStyle, entity]);

  // Animation state
  const shouldAnimate = hovered || isConnectedToSelectedNode || isSelected;

  // Update dash offset for animation
  useFrame((state) => {
    if (shouldAnimate) {
      // Continuously update the offset for scrolling effect
      dashOffsetRef.current = state.clock.elapsedTime * 2;
    } else {
      // Reset when not animating
      dashOffsetRef.current = 0;
    }
  });

  // Create arrow geometries for both ends
  const arrows = useMemo(() => {
    if (edgePoints3D.length < 2) return { start: null, end: null };

    const arrowLength = 1.0;
    const arrowRadius = 0.4;
    const up = new THREE.Vector3(0, 1, 0);

    // End arrow (at target)
    const lastPoint = edgePoints3D[edgePoints3D.length - 1];
    const secondLastPoint = edgePoints3D[edgePoints3D.length - 2];
    const endDirection = new THREE.Vector3()
      .subVectors(lastPoint, secondLastPoint)
      .normalize();
    const endArrowPosition = lastPoint.clone().sub(endDirection.clone().multiplyScalar(arrowLength * 0.5));
    const endQuaternion = new THREE.Quaternion();
    endQuaternion.setFromUnitVectors(up, endDirection);

    // Start arrow (at source) - ALSO pointing in the direction of flow (source to target)
    const firstPoint = edgePoints3D[0];
    const secondPoint = edgePoints3D[1];
    const startDirection = new THREE.Vector3()
      .subVectors(secondPoint, firstPoint)
      .normalize();
    const startArrowPosition = firstPoint.clone().add(startDirection.clone().multiplyScalar(arrowLength * 0.5));
    // Use the same direction as the flow (no negation) - both arrows point source to target
    const startQuaternion = new THREE.Quaternion();
    startQuaternion.setFromUnitVectors(up, startDirection);

    return {
      start: (
        <mesh position={startArrowPosition} quaternion={startQuaternion}>
          <coneGeometry args={[arrowRadius, arrowLength, 8]} />
          <meshStandardMaterial
            color={pathColor}
            emissive={pathColor}
            emissiveIntensity={shouldAnimate ? 0.3 : 0.1}
          />
        </mesh>
      ),
      end: (
        <mesh position={endArrowPosition} quaternion={endQuaternion}>
          <coneGeometry args={[arrowRadius, arrowLength, 8]} />
          <meshStandardMaterial
            color={pathColor}
            emissive={pathColor}
            emissiveIntensity={shouldAnimate ? 0.3 : 0.1}
          />
        </mesh>
      )
    };
  }, [edgePoints3D, pathColor, shouldAnimate]);

  return (
    <group>
      {/* Render the edge */}
      {edgePoints3D.length >= 2 && (
        <>
          {/* Invisible hit area for easier selection */}
          <Line
            points={edgePoints3D}
            color={pathColor}
            lineWidth={12}
            transparent
            opacity={0}
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut}
            onPointerMove={handlePointerMove}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
          />

          {/* Main edge line */}
          <Line
            points={edgePoints3D}
            color={pathColor}
            lineWidth={hovered || isConnectedToSelectedNode || isSelected ? 6 : 3}
            transparent
            opacity={0.85}
          />

          {/* Animated dash overlay when selected or connected to selected node */}
          {shouldAnimate && (
            <AnimatedDashedLine
              points={edgePoints3D}
              color={isLightColor(pathColor) ? 'black' : 'white'}
              lineWidth={hovered || isConnectedToSelectedNode || isSelected ? 7 : 4}
              dashOffset={dashOffsetRef}
            />
          )}

          {/* Arrow heads at both ends */}
          {arrows.start}
          {arrows.end}
        </>
      )}

      {/* Show control points for bezier edges (only if from 2D diagram) */}
      {edgeStyle === 'bezier' && controlPointsData.length > 0 && controlPoints3D.map((cp, index) => (
        <group key={`cp-${index}`} position={cp}>
          {/* Control point sphere */}
          <Sphere args={[0.5, 16, 16]}>
            <meshStandardMaterial
              color={pathColor}
              emissive={pathColor}
              emissiveIntensity={0.3}
              transparent
              opacity={0.9}
            />
          </Sphere>

          {/* Control point label */}
          <Html
            distanceFactor={6}
            center
            zIndexRange={[1, 0]}
            style={{
              pointerEvents: 'none',
            }}
          >
            <Box
              sx={{
                px: 0.5,
                py: 0.25,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                borderRadius: 1,
                fontSize: '9px',
                fontWeight: 'bold',
                border: `1px solid ${pathColor}`,
              }}
            >
              CP{index + 1}
            </Box>
          </Html>
        </group>
      ))}

      {/* Edge label at the midpoint */}
      <Html
        transform
        sprite
        distanceFactor={8}
        position={[labelPosition.x, labelPosition.y, labelPosition.z]}
        center
        zIndexRange={[1, 0]}
      >
        <Box
          sx={{
            px: 2,
            py: 1,
            backgroundColor: theme?.colors.surface || 'rgba(0, 0, 0, 0.85)',
            color: theme?.colors.textPrimary || 'white',
            borderRadius: 1,
            fontSize: '24px',
            fontWeight: 'bold',
            textAlign: 'center',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            textTransform: 'uppercase',
            border: `2px solid ${pathColor}`,
            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
            position: 'relative'
          }}
        >
          {edgeLabel}
        </Box>
      </Html>

      {/* Hover hint */}
      {hovered && (
        <Html distanceFactor={8} position={[labelPosition.x, labelPosition.y + 1, labelPosition.z]} zIndexRange={[1, 0]}>
          <Box
            sx={{
              px: 1,
              py: 0.5,
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              color: 'white',
              borderRadius: 1,
              fontSize: '11px',
              fontStyle: 'italic',
              pointerEvents: 'none',
            }}
          >
            Double-click to edit • Hold 2s for details
          </Box>
        </Html>
      )}
    </group>
  );
};
