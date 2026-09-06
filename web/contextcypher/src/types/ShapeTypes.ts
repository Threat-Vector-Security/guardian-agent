// Shape type definitions for AI Threat Modeler nodes

export type NodeShape = 
  | 'rectangle'
  | 'rounded-rectangle'
  | 'diamond'
  | 'circle'
  | 'ellipse'
  | 'hexagon'
  | 'pentagon'
  | 'octagon'
  | 'trapezoid'
  | 'parallelogram'
  | 'triangle'
  | 'star'
  | 'shield'
  | 'cloud'
  | 'cylinder'
  | 'document'
  | 'plus'
  | 'cross'
  | 'arrow-right'
  | 'arrow-left'
  | 'arrow-up'
  | 'arrow-down'
  | 'arrow-horizontal'
  | 'arrow-vertical'
  | 'capsule'
  | 'house'
  | 'factory';

export interface ShapeProps {
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fillOpacity?: number;
  [key: string]: any; // For additional SVG attributes
}

export interface ShapeComponentProps extends ShapeProps {
  type: NodeShape;
}

// Shape metadata for UI display and categorization
export interface ShapeMetadata {
  name: string;
  displayName: string;
  category: 'basic' | 'security' | 'infrastructure' | 'specialized';
  description: string;
  aspectRatio?: 'fixed' | 'flexible'; // Some shapes like circle need fixed aspect ratio
  defaultScale?: number; // Scale factor relative to base size (1.0 = default)
  contentOffset?: { x: number; y: number }; // Offset for content positioning within shape
}

// Shape configurations with metadata
export const shapeMetadata: Record<NodeShape, ShapeMetadata> = {
  'rectangle': {
    name: 'rectangle',
    displayName: 'Rectangle',
    category: 'basic',
    description: 'Standard rectangular shape (default)',
    aspectRatio: 'flexible',
    defaultScale: 1.0
  },
  'rounded-rectangle': {
    name: 'rounded-rectangle',
    displayName: 'Rounded Rectangle',
    category: 'basic',
    description: 'Rectangle with rounded corners',
    aspectRatio: 'flexible',
    defaultScale: 1.0
  },
  'diamond': {
    name: 'diamond',
    displayName: 'Diamond',
    category: 'basic',
    description: 'Diamond/rhombus shape for decision points',
    aspectRatio: 'flexible',
    defaultScale: 1.6  // Slightly increased to ensure content area matches default node
  },
  'circle': {
    name: 'circle',
    displayName: 'Circle',
    category: 'basic',
    description: 'Perfect circle shape',
    aspectRatio: 'fixed',
    defaultScale: 1.7  // Significantly increased to ensure content area matches default node
  },
  'ellipse': {
    name: 'ellipse',
    displayName: 'Ellipse',
    category: 'basic',
    description: 'Oval shape',
    aspectRatio: 'flexible',
    defaultScale: 1.2  // Increased for better content fit
  },
  'hexagon': {
    name: 'hexagon',
    displayName: 'Hexagon',
    category: 'basic',
    description: 'Six-sided polygon',
    aspectRatio: 'flexible',
    defaultScale: 1.6  // Significantly increased for better content fit
  },
  'pentagon': {
    name: 'pentagon',
    displayName: 'Pentagon',
    category: 'basic',
    description: 'Five-sided polygon',
    aspectRatio: 'flexible',
    defaultScale: 1.6  // Significantly increased for better content fit
  },
  'octagon': {
    name: 'octagon',
    displayName: 'Octagon',
    category: 'basic',
    description: 'Eight-sided polygon',
    aspectRatio: 'flexible',
    defaultScale: 1.65  // Further increased for better content fit
  },
  'trapezoid': {
    name: 'trapezoid',
    displayName: 'Trapezoid',
    category: 'basic',
    description: 'Trapezoid shape for data flow',
    aspectRatio: 'flexible',
    defaultScale: 1.3  // Slightly increased for better content fit
  },
  'parallelogram': {
    name: 'parallelogram',
    displayName: 'Parallelogram',
    category: 'basic',
    description: 'Parallelogram for input/output',
    aspectRatio: 'flexible',
    defaultScale: 1.3  // Slightly increased for better content fit
  },
  'triangle': {
    name: 'triangle',
    displayName: 'Triangle',
    category: 'basic',
    description: 'Triangle shape for warnings or hierarchy',
    aspectRatio: 'flexible',
    defaultScale: 1.9,  // Much larger for better content area
    contentOffset: { x: 0, y: 15 }  // Move content down as triangle point is at top
  },
  'star': {
    name: 'star',
    displayName: 'Star',
    category: 'specialized',
    description: 'Star shape for critical or special nodes',
    aspectRatio: 'fixed',
    defaultScale: 2.3  // Much larger to ensure content fits well
  },
  'shield': {
    name: 'shield',
    displayName: 'Shield',
    category: 'security',
    description: 'Shield shape for security controls',
    aspectRatio: 'flexible',
    defaultScale: 1.6  // Significantly increased for better content fit
  },
  'cloud': {
    name: 'cloud',
    displayName: 'Cloud',
    category: 'infrastructure',
    description: 'Cloud shape for cloud services',
    aspectRatio: 'flexible',
    defaultScale: 1.7  // Significantly increased as cloud shape has irregular content area
  },
  'cylinder': {
    name: 'cylinder',
    displayName: 'Cylinder',
    category: 'infrastructure',
    description: 'Cylinder for databases and storage',
    aspectRatio: 'flexible',
    defaultScale: 1.15,
    contentOffset: { x: 0, y: 10 }  // Move content down due to curved top
  },
  'document': {
    name: 'document',
    displayName: 'Document',
    category: 'specialized',
    description: 'Document shape for files and logs',
    aspectRatio: 'flexible',
    defaultScale: 1.1
  },
  'plus': {
    name: 'plus',
    displayName: 'Plus/Cross',
    category: 'specialized',
    description: 'Plus or cross shape',
    aspectRatio: 'fixed',
    defaultScale: 1.9  // Further increased for better content area
  },
  'cross': {
    name: 'cross',
    displayName: 'X Cross',
    category: 'specialized',
    description: 'X-shaped cross',
    aspectRatio: 'fixed',
    defaultScale: 1.9  // Further increased for better content area
  },
  'arrow-right': {
    name: 'arrow-right',
    displayName: 'Arrow Right',
    category: 'specialized',
    description: 'Rectangle with right-pointing arrow',
    aspectRatio: 'flexible',
    defaultScale: 1.3  // Slightly increased for arrow shapes
  },
  'arrow-left': {
    name: 'arrow-left',
    displayName: 'Arrow Left',
    category: 'specialized',
    description: 'Rectangle with left-pointing arrow',
    aspectRatio: 'flexible',
    defaultScale: 1.3  // Slightly increased for arrow shapes
  },
  'arrow-up': {
    name: 'arrow-up',
    displayName: 'Arrow Up',
    category: 'specialized',
    description: 'Rectangle with up-pointing arrow',
    aspectRatio: 'flexible',
    defaultScale: 1.2
  },
  'arrow-down': {
    name: 'arrow-down',
    displayName: 'Arrow Down',
    category: 'specialized',
    description: 'Rectangle with down-pointing arrow',
    aspectRatio: 'flexible',
    defaultScale: 1.2
  },
  'arrow-horizontal': {
    name: 'arrow-horizontal',
    displayName: 'Arrow Horizontal',
    category: 'specialized',
    description: 'Bi-directional horizontal arrow',
    aspectRatio: 'flexible',
    defaultScale: 1.8  // Significantly increased for bidirectional arrow
  },
  'arrow-vertical': {
    name: 'arrow-vertical',
    displayName: 'Arrow Vertical',
    category: 'specialized',
    description: 'Bi-directional vertical arrow',
    aspectRatio: 'flexible',
    defaultScale: 1.8  // Significantly increased for bidirectional arrow
  },
  'capsule': {
    name: 'capsule',
    displayName: 'Capsule/Pill',
    category: 'basic',
    description: 'Capsule or pill shape',
    aspectRatio: 'flexible',
    defaultScale: 1.2  // Slightly increased for better content fit
  },
  'house': {
    name: 'house',
    displayName: 'House',
    category: 'infrastructure',
    description: 'House shape for on-premises systems',
    aspectRatio: 'flexible',
    defaultScale: 1.1,
    contentOffset: { x: 0, y: 15 }  // Move content down due to roof
  },
  'factory': {
    name: 'factory',
    displayName: 'Factory',
    category: 'infrastructure',
    description: 'Factory shape for industrial/OT systems',
    aspectRatio: 'flexible',
    defaultScale: 1.2,
    contentOffset: { x: 0, y: 15 }  // Move content down due to roof/chimneys
  }
};

// Get shapes by category
export function getShapesByCategory(category: ShapeMetadata['category']): NodeShape[] {
  return Object.entries(shapeMetadata)
    .filter(([_, metadata]) => metadata.category === category)
    .map(([shape]) => shape as NodeShape);
}

// Get all shape categories
export function getShapeCategories(): ShapeMetadata['category'][] {
  const categories = new Set<ShapeMetadata['category']>();
  Object.values(shapeMetadata).forEach(metadata => {
    categories.add(metadata.category);
  });
  return Array.from(categories);
}

// Default shape for nodes
export const DEFAULT_NODE_SHAPE: NodeShape = 'rounded-rectangle';