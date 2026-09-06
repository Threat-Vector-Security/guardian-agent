# ReactFlow Performance Optimization Guide

## Implementation Priority

### **CRITICAL - Immediate Impact (INP reduction: 792ms → ~200ms)**

#### 1. Replace Event Handlers (20 minutes)
Replace the existing `onNodesChange` and `onSelectionChange` handlers with optimized versions:

```tsx
// In DiagramEditor.tsx, replace existing handlers
import { useOptimizedNodeHandler } from './performance-optimizations/OptimizedNodeHandler';
import { useOptimizedSelectionHandler } from './performance-optimizations/OptimizedSelectionHandler';

// Replace existing onNodesChange
const { onNodesChange } = useOptimizedNodeHandler({
  setNodes, setEdges, trackChanges, snapToGrid, GRID_SIZE, windowManager
});

// Replace existing onSelectionChange  
const { onSelectionChange } = useOptimizedSelectionHandler({
  setNodes, setSelectedNodeIds, nodes
});
```

**Expected Impact**: 60-70% INP reduction (792ms → ~250ms)

#### 2. Fix Debounced Functions (10 minutes)
Replace the problematic debounced functions:

```tsx
// Replace existing debouncedTrackChanges
import { useOptimizedChangeTracking } from './performance-optimizations/OptimizedDebouncing';

const debouncedTrackChanges = useOptimizedChangeTracking(trackChanges);
```

**Expected Impact**: Additional 20% improvement (~250ms → ~200ms)

#### 3. Remove setTimeout Hacks (5 minutes)
Remove all edge re-rendering setTimeout calls:

```tsx
// ❌ Remove these patterns throughout the file
setTimeout(() => {
  setEdges(edgesToRerender.map(edge => ({ ...edge })));
}, 50);

// ✅ Replace with immediate update
setEdges(edgesToRerender);
```

**Expected Impact**: 10-15% improvement, eliminates render delays

### **HIGH - Medium Term Gains**

#### 4. Implement Virtualization (45 minutes)
For diagrams with >50 nodes, implement viewport-based virtualization:

```tsx
import { useVirtualization } from './performance-optimizations/Virtualization';

const { visibleNodes, visibleEdges } = useVirtualization(nodes, edges, viewport);
```

#### 5. Optimize SecurityNode Components (30 minutes)
Replace SecurityNode components with memoized versions:

```tsx
import OptimizedSecurityNode from './performance-optimizations/MemoizedSecurityNode';

// Update nodeTypes mapping
const nodeTypes = useMemo(() => ({
  // Replace all existing node types with optimized versions
  server: OptimizedSecurityNode,
  user: OptimizedSecurityNode,
  // ... etc
}), []);
```

## Performance Monitoring Setup

Add performance tracking to measure improvements:

```tsx
// Add to DiagramEditor.tsx
const performanceMetrics = useRef({
  interactionStart: 0,
  renderTime: 0
});

const handlePointerDown = useCallback((event) => {
  performanceMetrics.current.interactionStart = performance.now();
}, []);

const handlePointerUp = useCallback((event) => {
  const interactionTime = performance.now() - performanceMetrics.current.interactionStart;
  if (interactionTime > 200) {
    console.warn(`Slow interaction detected: ${interactionTime}ms`);
  }
}, []);
```

## Critical Fixes Summary

### Before Optimization:
- **INP**: 792ms (poor)
- **LCP**: 3.04s (needs improvement)  
- **Main Thread Blocking**: 706ms on pointer interactions
- **Issues**: 65+ setTimeout calls, non-optimized re-renders, complex event handlers

### After Optimization (Estimated):
- **INP**: ~180ms (good)
- **LCP**: ~2.1s (acceptable)
- **Main Thread Blocking**: ~120ms (acceptable)
- **Improvements**: Batched updates, optimized event handlers, eliminated setTimeout hacks

## Quick Implementation Checklist

- [ ] **Step 1**: Copy optimization files to `/src/performance-optimizations/`
- [ ] **Step 2**: Replace `onNodesChange` handler (lines 790-898)
- [ ] **Step 3**: Replace `onSelectionChange` handler (lines 2884-2950)  
- [ ] **Step 4**: Replace `debouncedTrackChanges` (lines 305-313)
- [ ] **Step 5**: Remove setTimeout edge re-rendering (search for "setTimeout")
- [ ] **Step 6**: Test with performance profiler
- [ ] **Step 7**: Implement node virtualization for large diagrams
- [ ] **Step 8**: Replace SecurityNode components with memoized versions

## Testing

1. **Before changes**: Record Web Vitals metrics
2. **After each step**: Measure INP improvement
3. **Load test**: Create diagram with 100+ nodes
4. **Interaction test**: Rapid drag/select operations
5. **Memory test**: Check for memory leaks during extended use

## Expected Timeline

- **Phase 1** (Critical fixes): 35 minutes → 70% improvement
- **Phase 2** (Component optimization): 75 minutes → Additional 15% improvement  
- **Phase 3** (Virtualization): 120 minutes → Scales to 1000+ nodes

**Total estimated development time**: 3-4 hours for complete optimization
**Expected performance gain**: INP from 792ms to ~150ms (80% improvement)