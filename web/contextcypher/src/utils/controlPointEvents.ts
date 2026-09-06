// Event system for control point interactions
class ControlPointEventEmitter extends EventTarget {
  private static instance: ControlPointEventEmitter;

  private constructor() {
    super();
  }

  static getInstance(): ControlPointEventEmitter {
    if (!ControlPointEventEmitter.instance) {
      ControlPointEventEmitter.instance = new ControlPointEventEmitter();
    }
    return ControlPointEventEmitter.instance;
  }

  // Emit when control point drag starts
  emitDragStart() {
    this.dispatchEvent(new Event('controlpoint-drag-start'));
  }

  // Emit when control point drag ends
  emitDragEnd() {
    this.dispatchEvent(new Event('controlpoint-drag-end'));
  }

  // Emit when control point is clicked
  emitClick() {
    this.dispatchEvent(new Event('controlpoint-click'));
  }
}

export const controlPointEvents = ControlPointEventEmitter.getInstance();