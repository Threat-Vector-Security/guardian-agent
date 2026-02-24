# Tick Engine Design (Superseded)

> **This document is historical.** The tick engine was removed in v2 in favor of an event-driven architecture. See [ADR-005 in DECISIONS.md](./DECISIONS.md) for the rationale. Kept for reference only.

## Accumulator Pattern

The tick engine borrows the **fixed-timestep accumulator** pattern from game engines:

```
lastTime = now()
accumulator = 0

loop:
  currentTime = now()
  elapsed = currentTime - lastTime
  lastTime = currentTime
  accumulator += elapsed

  while accumulator >= TICK_INTERVAL:
    tick(tickNumber++)
    accumulator -= TICK_INTERVAL

  yield to event loop via setImmediate
```

### Why this pattern?

1. **Deterministic tick rate** regardless of wall-clock jitter
2. **Catch-up processing** if a tick takes longer than expected
3. **No drift** over long periods (unlike `setInterval`)
4. **Budget-aware** — can skip catch-up ticks if budget exhausted

## Multi-Layer Scheduling

Each layer has its own accumulator and target frequency:

| Layer  | Interval  | Hz   | Purpose                    |
|--------|-----------|------|----------------------------|
| Fast   | 10ms      | 100  | Event draining             |
| Medium | 100-1000ms| 1-10 | Agent reasoning (adaptive) |
| Slow   | 10000ms   | 0.1  | Checkpointing, watchdog    |

Layers are processed in priority order each frame. A single frame may fire multiple fast ticks but only one medium tick.

## Adaptive Medium Layer

The medium layer adjusts its frequency based on agent activity:

- **Active agents working:** Tick at higher frequency (up to 10Hz)
- **All agents idle/waiting:** Tick at lower frequency (1Hz)
- **No pending events:** Can skip tick entirely

## Budget Enforcement

Each tick has a wall-clock budget (default: 50ms for medium layer):

```typescript
const start = performance.now();
// ... agent processing ...
const elapsed = performance.now() - start;
if (elapsed > budgetMs) {
  // Force yield, record overrun
}
```

## Yield to Event Loop

Between frames, we yield to Node.js via `setImmediate`. This ensures:
- I/O callbacks can fire (network responses, file reads)
- Timer callbacks can fire (scheduled retries)
- The process stays responsive to signals

## Tick Counter

Tick numbers use `bigint` to prevent overflow:
- At 100Hz: `Number.MAX_SAFE_INTEGER` overflows in ~2,854 years
- With `bigint`: effectively infinite
- Cost: negligible (bigint increment is fast)
