// Drawing types for the new node-based drawing system
export type Points = [number, number, number][]; // [x, y, pressure]

export type DrawingNodeType = 'freehand' | 'shape' | 'textAnnotation';

export interface DrawingNodeBase {
  id: string;
  type: DrawingNodeType;
  position: { x: number; y: number };
  width?: number;
  height?: number;
  selected?: boolean;
  draggable?: boolean;
  selectable?: boolean;
  data: {
    drawingAnalysis?: string;
    associatedNodeId?: string;
    relativePosition?: { x: number; y: number };
  };
}