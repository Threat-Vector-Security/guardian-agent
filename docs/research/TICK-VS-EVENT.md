# Tick-Based vs Event-Driven: Comparative Analysis

## Models Compared

| Aspect | Event-Driven (OpenClaw) | Tick-Based (OpenAgent) |
|---|---|---|
| Wake mechanism | setTimeout/cron | Continuous loop + setImmediate |
| Processing model | One-shot jobs | Persistent generator coroutines |
| Latency floor | ~1s (cron granularity) | ~10ms (fast tick layer) |
| Progress visibility | None (black box during execution) | Every tick yields status |
| Agent coordination | Shared DB/queue | In-process event queue |
| CPU when idle | Near zero | ~1% (adaptive tick rate) |
| State management | Reconstruct each invocation | Preserved in generator |

## Metrics to Measure

### Latency
- **Event response time:** Time from event emission to agent receiving it
  - Event-driven: setTimeout granularity + queue check interval
  - Tick-based: max one fast tick interval (10ms)

### Throughput
- **Agents per second:** How many agent ticks can be processed
  - Target: 100+ agent-ticks/s on medium layer

### Overhead
- **Tick loop cost:** CPU time spent in tick infrastructure vs agent work
  - Target: < 0.1ms per fast tick with 0 agents (infrastructure only)

### Coordination
- **Inter-agent message latency:** Time for agent A's message to reach agent B
  - Event-driven: next cron cycle (1s+)
  - Tick-based: next fast tick (10ms)

## Hypothesis

For a personal assistant requiring:
1. Sub-second responsiveness to user input
2. Background task monitoring
3. Multi-agent coordination (planner + executor + monitor)

The tick model will provide:
- 10-100x better event response latency
- Real-time progress visibility
- Simpler coordination (no distributed queue needed)

At the cost of:
- ~1% baseline CPU usage
- More complex scheduling logic
- Learning curve for generator-based agents

## Validation Plan

1. Build both models with identical agent logic
2. Measure latency, throughput, overhead
3. Compare code complexity (lines, cyclomatic complexity)
4. User experience: does sub-second response feel meaningfully better?
