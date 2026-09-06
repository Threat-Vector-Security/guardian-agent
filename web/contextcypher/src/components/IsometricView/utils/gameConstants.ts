import * as THREE from 'three';
import { colors } from '../../../styles/Theme';

// Camera settings for isometric view
export const CAMERA_CONFIG = {
  fov: 50,
  near: 0.1,
  far: 1000,
  position: new THREE.Vector3(50, 50, 50),
  lookAt: new THREE.Vector3(0, 0, 0),
  // Isometric angle (approximately 35.264 degrees)
  isometricAngle: Math.atan(1 / Math.sqrt(2)),
};

// Grid and world settings
export const WORLD_CONFIG = {
  gridSize: 100,
  cellSize: 5,
  groundLevel: 0,
};

export const EDGE_BASE_HEIGHT = 0.35;

// Use exact zone colors from theme
export const ZONE_COLORS = Object.entries(colors.zoneColors).reduce((acc, [key, color]) => {
  acc[key.toLowerCase()] = { color, opacity: 0.3 };
  return acc;
}, {} as Record<string, { color: string; opacity: number }>);

// Standard node size for consistency
const STANDARD_NODE_SIZE = new THREE.Vector3(4, 5, 4);

// Building configurations by node type - only geometry and size
export const BUILDING_CONFIGS: Record<string, {
  geometry: 'box' | 'cylinder' | 'cone' | 'sphere' | 'octahedron' | 'dodecahedron';
  baseSize: THREE.Vector3;
  heightMultiplier: number;
}> = {
  // Infrastructure
  server: {
    geometry: 'box',
    baseSize: STANDARD_NODE_SIZE.clone(),
    heightMultiplier: 1.0,
  },
  database: {
    geometry: 'cylinder',
    baseSize: STANDARD_NODE_SIZE.clone(),
    heightMultiplier: 1.0,
  },
  firewall: {
    geometry: 'box',
    baseSize: STANDARD_NODE_SIZE.clone(),
    heightMultiplier: 1.0,
  },
  loadbalancer: {
    geometry: 'box',
    baseSize: STANDARD_NODE_SIZE.clone(),
    heightMultiplier: 1.0,
  },
  router: {
    geometry: 'cylinder',
    baseSize: STANDARD_NODE_SIZE.clone(),
    heightMultiplier: 1.0,
  },
  switch: {
    geometry: 'box',
    baseSize: STANDARD_NODE_SIZE.clone(),
    heightMultiplier: 1.0,
  },

  // Security Components
  waf: {
    geometry: 'box',
    baseSize: STANDARD_NODE_SIZE.clone(),
    heightMultiplier: 1.0,
  },
  ids: {
    geometry: 'cylinder',
    baseSize: STANDARD_NODE_SIZE.clone(),
    heightMultiplier: 1.0,
  },
  ips: {
    geometry: 'cylinder',
    baseSize: STANDARD_NODE_SIZE.clone(),
    heightMultiplier: 1.0,
  },
  siem: {
    geometry: 'box',
    baseSize: STANDARD_NODE_SIZE.clone(),
    heightMultiplier: 1.0,
  },
  vpnGateway: {
    geometry: 'box',
    baseSize: STANDARD_NODE_SIZE.clone(),
    heightMultiplier: 1.0,
  },
  proxy: {
    geometry: 'cylinder',
    baseSize: STANDARD_NODE_SIZE.clone(),
    heightMultiplier: 1.0,
  },

  // Application Components
  webserver: {
    geometry: 'box',
    baseSize: STANDARD_NODE_SIZE.clone(),
    heightMultiplier: 1.0,
  },
  appserver: {
    geometry: 'box',
    baseSize: STANDARD_NODE_SIZE.clone(),
    heightMultiplier: 1.0,
  },
  api: {
    geometry: 'cylinder',
    baseSize: STANDARD_NODE_SIZE.clone(),
    heightMultiplier: 1.0,
  },
  microservice: {
    geometry: 'sphere',
    baseSize: STANDARD_NODE_SIZE.clone(),
    heightMultiplier: 1.0,
  },

  // Cloud Services
  cloudservice: {
    geometry: 'sphere',
    baseSize: STANDARD_NODE_SIZE.clone(),
    heightMultiplier: 1.0,
  },
  cdn: {
    geometry: 'cone',
    baseSize: STANDARD_NODE_SIZE.clone(),
    heightMultiplier: 1.0,
  },

  // Users and Endpoints
  user: {
    geometry: 'cylinder',
    baseSize: STANDARD_NODE_SIZE.clone(),
    heightMultiplier: 1.0,
  },
  attacker: {
    geometry: 'cone',
    baseSize: STANDARD_NODE_SIZE.clone(),
    heightMultiplier: 1.0,
  },
  workstation: {
    geometry: 'box',
    baseSize: STANDARD_NODE_SIZE.clone(),
    heightMultiplier: 1.0,
  },
  endpoint: {
    geometry: 'box',
    baseSize: STANDARD_NODE_SIZE.clone(),
    heightMultiplier: 1.0,
  },

  // Default for unknown types
  generic: {
    geometry: 'box',
    baseSize: STANDARD_NODE_SIZE.clone(),
    heightMultiplier: 1.0,
  },
};

// Connection/Edge configurations
export const CONNECTION_CONFIGS = {
  https: {
    color: '#22c55e',
    width: 0.5,
    animated: true,
    secure: true,
  },
  http: {
    color: '#fbbf24',
    width: 0.4,
    animated: true,
    secure: false,
  },
  tcp: {
    color: '#3b82f6',
    width: 0.3,
    animated: false,
    secure: false,
  },
  ssh: {
    color: '#10b981',
    width: 0.4,
    animated: false,
    secure: true,
  },
  vpn: {
    color: '#8b5cf6',
    width: 0.6,
    animated: true,
    secure: true,
  },
  database: {
    color: '#0ea5e9',
    width: 0.5,
    animated: false,
    secure: true,
  },
  api: {
    color: '#6366f1',
    width: 0.5,
    animated: true,
    secure: true,
  },
  default: {
    color: '#9ca3af',
    width: 0.3,
    animated: false,
    secure: false,
  },
};

// Animation settings
export const ANIMATION_CONFIG = {
  threatSpeed: 0.5,
  dataFlowSpeed: 1.0,
  rotationSpeed: 0.001,
  pulseSpeed: 0.02,
  hoverScale: 1.1,
  selectScale: 1.2,
};

// Lighting configuration
export const LIGHTING_CONFIG = {
  ambient: {
    color: 0xffffff,
    intensity: 0.6,
  },
  directional: {
    color: 0xffffff,
    intensity: 0.8,
    position: new THREE.Vector3(50, 100, 50),
    castShadow: true,
    shadowMapSize: 2048,
  },
  hemisphere: {
    skyColor: 0x87ceeb,
    groundColor: 0x362f2d,
    intensity: 0.4,
  },
};

// Performance settings
export const PERFORMANCE_CONFIG = {
  maxRenderDistance: 200,
  lodDistances: [50, 100, 150],
  shadowsEnabled: true,
  antialias: true,
  pixelRatio: Math.min(window.devicePixelRatio, 2),
};
