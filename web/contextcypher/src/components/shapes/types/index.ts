import Rectangle from './rectangle';
import RoundedRectangle from './rounded-rectangle';
import Diamond from './diamond';
import Circle from './circle';
import Ellipse from './ellipse';
import Hexagon from './hexagon';
import Pentagon from './pentagon';
import Octagon from './octagon';
import Trapezoid from './trapezoid';
import Parallelogram from './parallelogram';
import Triangle from './triangle';
import Star from './star';
import Shield from './shield';
import Cloud from './cloud';
import Cylinder from './cylinder';
import Document from './document';
import Plus from './plus';
import Cross from './cross';
import ArrowRight from './arrow-right';
import ArrowLeft from './arrow-left';
import ArrowUp from './arrow-up';
import ArrowDown from './arrow-down';
import ArrowHorizontal from './arrow-horizontal';
import ArrowVertical from './arrow-vertical';
import Capsule from './capsule';
import House from './house';
import Factory from './factory';
import { NodeShape } from '../../../types/ShapeTypes';

// Shape component registry
export const ShapeComponents: Record<NodeShape, React.FC<any>> = {
  'rectangle': Rectangle,
  'rounded-rectangle': RoundedRectangle,
  'diamond': Diamond,
  'circle': Circle,
  'ellipse': Ellipse,
  'hexagon': Hexagon,
  'pentagon': Pentagon,
  'octagon': Octagon,
  'trapezoid': Trapezoid,
  'parallelogram': Parallelogram,
  'triangle': Triangle,
  'star': Star,
  'shield': Shield,
  'cloud': Cloud,
  'cylinder': Cylinder,
  'document': Document,
  'plus': Plus,
  'cross': Cross,
  'arrow-right': ArrowRight,
  'arrow-left': ArrowLeft,
  'arrow-up': ArrowUp,
  'arrow-down': ArrowDown,
  'arrow-horizontal': ArrowHorizontal,
  'arrow-vertical': ArrowVertical,
  'capsule': Capsule,
  'house': House,
  'factory': Factory
};