# OpenClaw Analysis — Patterns to Borrow and Replace

## Patterns to Borrow

### Exponential Backoff
From `src/cron/service/timer.ts`:
```typescript
ERROR_BACKOFF_SCHEDULE_MS = [30_000, 60_000, 300_000, 900_000, 3_600_000]
```
Progressive delays: 30s → 1m → 5m → 15m → 60m. Prevents hammering failing services.

### Spin-Loop Protection
From `src/cron/service/timer.ts:25`:
```typescript
MIN_REFIRE_GAP_MS = 2000
```
Minimum 2s between firings prevents runaway loops on misconfigured schedules.

### Per-Agent State Tracking
The heartbeat runner tracks per-agent:
- `lastRunMs` — when the agent last executed
- `consecutiveErrors` — for backoff index calculation
- `isRunning` — prevent overlapping executions

### Mutex Locking
The `locked()` pattern wraps state mutations in a mutex to prevent concurrent modification. Critical for shared state in async code.

### Active Hours Checking
Agents can be configured with active hours — reasoning is paused outside those windows. Useful for cost control and user experience.

## Patterns to Replace

| OpenClaw Pattern | OpenAgent Replacement |
|---|---|
| Cron/setTimeout wake | Continuous tick loop with accumulator |
| One-shot job execution | Persistent async generator coroutines |
| Session isolation per job | Shared tick context with isolated agent state |
| Sequential job processing | Concurrent multi-agent ticks |
| Heartbeat as LLM health check | Watchdog monitoring tick-level progress |

### Why Replace?

**Cron wake → Tick loop:**
Cron has inherent latency (minimum 1s granularity). The tick loop provides sub-10ms event response for the fast layer while keeping agent reasoning at a comfortable 1-10Hz.

**One-shot → Generators:**
One-shot jobs lose state between invocations, requiring expensive context reconstruction. Generator coroutines preserve state naturally in their closure.

**Sequential → Concurrent:**
Sequential processing means agent B waits for agent A to finish. With ticks, both agents get interleaved processing each frame.

## Security Observations from OpenClaw

- Docker sandbox with workspace access modes (none/ro/rw)
- Rate limiting with exponential backoff
- Command execution with timeouts and process supervision
- Security audit system with finding classification
- These inform our compute budget and watchdog design
