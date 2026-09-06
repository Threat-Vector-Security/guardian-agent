import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { Box, Typography } from '@mui/material';
import { GameZone } from '../utils/diagramToGame';

interface SecurityZoneProps {
  zone: GameZone;
}

export const SecurityZone: React.FC<SecurityZoneProps> = ({
  zone
}) => {
  // Calculate zone dimensions
  const dimensions = useMemo(() => {
    const width = zone.bounds.max.x - zone.bounds.min.x;
    const height = zone.bounds.max.y - zone.bounds.min.y;
    const depth = zone.bounds.max.z - zone.bounds.min.z;
    const center = new THREE.Vector3(
      (zone.bounds.min.x + zone.bounds.max.x) / 2,
      zone.bounds.min.y + height / 2,
      (zone.bounds.min.z + zone.bounds.max.z) / 2
    );
    return { width, height, depth, center };
  }, [zone.bounds]);

  // Create outline geometry
  const outlineGeometry = useMemo(() => {
    const { width, height, depth } = dimensions;
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const edges = new THREE.EdgesGeometry(geometry);
    return edges;
  }, [dimensions]);

  return (
    <group position={dimensions.center}>
      {/* Zone volume */}
      <mesh receiveShadow>
        <boxGeometry args={[dimensions.width, dimensions.height, dimensions.depth]} />
        <meshPhysicalMaterial
          color={zone.color}
          transparent
          opacity={zone.opacity * 0.3}
          side={THREE.DoubleSide}
          roughness={0.8}
          metalness={0.1}
          depthWrite={false}
        />
      </mesh>

      {/* Zone outline */}
      <lineSegments geometry={outlineGeometry}>
        <lineBasicMaterial
          color={zone.color}
          linewidth={2}
          transparent
          opacity={0.8}
        />
      </lineSegments>

      {/* Ground plane for zone */}
      <mesh position={[0, -dimensions.height / 2 + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[dimensions.width, dimensions.depth]} />
        <meshStandardMaterial
          color={zone.color}
          transparent
          opacity={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Zone label */}
      <Html
        distanceFactor={15}
        position={[0, dimensions.height / 2 + 2, 0]}
        center
        zIndexRange={[1, 0]}
      >
        <Box
          sx={{
            px: 2,
            py: 1,
            backgroundColor: zone.color + 'CC', // Add alpha for semi-transparency
            color: 'white',
            borderRadius: 2,
            fontSize: '64px',
            fontWeight: 'bold',
            textAlign: 'center',
            textTransform: 'capitalize',
            pointerEvents: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          {zone.type} Zone
        </Box>
      </Html>

    </group>
  );
};
