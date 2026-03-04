# Assistant Orchestrator Spec

## Goal
Introduce a first-class assistant orchestration layer that:
- Serializes work per session (`channel + canonicalUserId + agentId`)
- Allows parallel execution across different sessions
- Exposes queue and latency state for operators in web and CLI
- Supports priority-aware request scheduling and request-level trace visibility

## Scope
- Runtime module: `src/runtime/orchestrator.ts`
- Runtime module: `src/runtime/assistant-jobs.ts`
- Dashboard API: `GET /api/assistant/state`
- Web UI: Dashboard assistant state section (consolidated from former `#/assistant` page)
- CLI: new `/assistant` command

## Session Model
- Session ID format: `<channel>:<userId>:<agentId>`
- Each session has a single active execution slot and a priority queue
- Dispatch behavior:
  - Same session: strictly serialized, with queued-order by priority (`high > normal > low`) then enqueue time
  - Different sessions: concurrent

## Tracked Metrics
- Global summary:
  - `totalRequests`, `completedRequests`, `failedRequests`
  - `runningCount`, `queuedCount`, `sessionCount`, `uptimeMs`
  - `avgExecutionMs`, `avgEndToEndMs`
- Per-session:
  - queue depth, status (`idle|queued|running`)
  - last queue wait / execution / end-to-end timings
  - success/error counts
  - last error and message/response previews
- Background jobs:
  - `running/succeeded/failed` counts
  - recent job records with source, duration, and error detail
- Policy decisions:
  - recent allow/deny/rate-limit/output policy events from audit log
  - includes controller and reason when available
- Request traces:
  - per-dispatch lifecycle (`queued/running/succeeded/failed`)
  - queue wait, execution, end-to-end timings
  - step-level trace entries (for example runtime dispatch and quick-action build steps)
  - message/response previews and error details

## Integration Contract
- `onDispatch` in dashboard callbacks routes messages through `AssistantOrchestrator.dispatch()`
- Quick actions also use orchestrator dispatch for consistent queue behavior
- Config apply/update and threat-intel scans are wrapped in tracked background jobs
- Scheduled threat-intel scans are tracked as `source=scheduled` jobs
- Output shape for consumers:
  - `orchestrator.summary`
  - `orchestrator.sessions[]`
  - `orchestrator.traces[]`
  - `jobs.summary`
  - `jobs.jobs[]`
  - `lastPolicyDecisions[]`
  - runtime context: default provider + guardian enabled + provider list

## Operational Notes
- Queue wait time highlights backlog pressure
- Execution time reflects runtime + provider latency
- End-to-end time helps compare model speed vs queueing overhead
- Priority queue counters in summary show if low-priority work is starving interactive requests
- Trace step timing helps isolate where time is spent (queueing vs runtime dispatch vs provider response)
- Idle sessions are pruned by TTL and max-session limits to bound memory
