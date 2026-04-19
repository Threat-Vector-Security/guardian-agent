# Automated Maintenance Design

**Status:** Implemented current architecture  

## Purpose

Guardian needs a server-owned way to perform bounded cleanup and hygiene when the runtime has been quiet for a while.

This must not behave like a hidden assistant turn. It is maintenance owned by the runtime itself.

## Goals

- run only after a configurable idle window
- stay bounded, deterministic, and safe to skip
- remain visible through shared job and audit surfaces
- reuse the owning subsystem logic instead of duplicating cleanup rules
- preserve trust, approval, and memory-scope boundaries

## Non-Goals

- no hidden user-facing reasoning or autonomous assistant turns
- no silent rewriting of operator-curated wiki pages
- no broad semantic rewriting of durable memory on every sweep
- no bypass of existing approval or trust gates

## Ownership

The maintenance scheduler is a runtime service.

Initial implementation file:
- `src/runtime/automated-maintenance-service.ts`

The service only owns:
- idle detection
- sweep cadence
- per-scope cooldowns
- bounded scope selection

It delegates actual memory cleanup to the shared memory mutation layer:
- `src/runtime/memory-mutation-service.ts`

## Idle Model

Maintenance can run only when:

- `assistant.maintenance.enabled` is `true`
- the orchestrator has no queued or running assistant work
- the most recent orchestrator activity is older than `assistant.maintenance.idleAfterMs`

For code-session-scoped work, a code session must also be individually idle:

- `now - codeSession.lastActivityAt >= assistant.maintenance.idleAfterMs`

## Visibility

Maintenance must remain visible through existing shared surfaces:

- Assistant jobs
- Memory maintenance tables in the web UI
- audit log events

Initial audit/job event family:

- `memory_hygiene.idle_sweep`

## Initial Job Set

### 1. Idle Memory Hygiene

When the runtime is idle, Guardian may run bounded memory hygiene across:

- the primary global memory scope
- idle code-session memory scopes

Current hygiene behavior is reused from the shared memory mutation service:

- archive exact duplicate active entries
- archive near-duplicate system-managed collection entries
- archive stale system-managed derived/context-flush material

Guardrails:

- only runs when the target memory store is enabled and writable
- only considers scopes that already have stored entries
- respects `maxScopesPerSweep`
- respects per-scope cooldowns via `minIntervalMs`

## Configuration

```yaml
assistant:
  maintenance:
    enabled: true
    sweepIntervalMs: 300000
    idleAfterMs: 600000
    jobs:
      memoryHygiene:
        enabled: true
        includeGlobalScope: true
        includeCodeSessions: true
        maxScopesPerSweep: 4
        minIntervalMs: 21600000
```

Meaning:

- `sweepIntervalMs`: how often the sweeper wakes up
- `idleAfterMs`: minimum quiet window before any maintenance can run
- `maxScopesPerSweep`: hard bound on how much work one wake-up can do
- `minIntervalMs`: per-scope cooldown that prevents repeated rescans

## Safety Rules

- maintenance jobs are runtime-owned, not model-authored
- maintenance must be idempotent or safely repeatable
- failures in one scope must not block other eligible scopes
- maintenance must not write to read-only memory stores
- operator-curated pages remain editable by operators and are never auto-rewritten

## Future Extension Points

This framework is intended to host additional server-owned jobs later, for example:

- maintained code-session summary refresh
- search/index refresh
- automation-output retention pruning
- stale attachment or worker resource reaping
- connector/cache health refresh

Those jobs must follow the same rules:

- explicit config
- bounded cadence
- shared visibility
- no hidden authority
