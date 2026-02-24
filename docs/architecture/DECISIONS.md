# Architecture Decision Records

## ADR-001: Tick Loop over Cron/Event-Driven

**Status:** Superseded by ADR-005

**Context:** Traditional AI agent systems use cron jobs or event-driven architectures. These have latency gaps between events and make it hard to monitor agent progress in real-time.

**Decision:** Use a game-engine-style tick loop with accumulator pattern.

**Outcome:** Replaced in v2 — see ADR-005.

---

## ADR-002: Agents as Async Generators

**Status:** Superseded by ADR-005

**Context:** Need a mechanism for agents to yield control, report progress, and resume without losing state.

**Decision:** Agents are `AsyncGenerator<AgentYield, void, TickContext>`.

**Outcome:** Replaced by async class pattern in v2 — see ADR-005.

---

## ADR-003: bigint Tick Counters

**Status:** Retired

**Context:** At 100Hz, `Number.MAX_SAFE_INTEGER` would overflow in ~2,854 years.

**Decision:** Use `bigint` for all tick counters.

**Outcome:** Tick system removed in v2. Timestamp-based tracking uses standard `number` (ms).

---

## ADR-004: Exponential Backoff Schedule from OpenClaw

**Status:** Accepted

**Context:** Need a backoff strategy for agent errors. OpenClaw's schedule [30s, 1m, 5m, 15m, 60m] is battle-tested.

**Decision:** Adopt OpenClaw's `ERROR_BACKOFF_SCHEDULE_MS` directly.

**Consequences:**
- (+) Proven in production
- (+) Prevents thundering herd on transient failures
- (+) Reasonable progression for LLM API errors

---

## ADR-005: Tick Engine → Event-Driven Pivot

**Status:** Accepted

**Context:** The tick loop was over-engineered for a personal assistant. LLM inference (2-30s) dominates all timing, making sub-10ms event response irrelevant. The tick engine added complexity for generators, accumulators, and layer scheduling with no practical benefit for the target use case.

**Decision:** Replace tick-based architecture with event-driven async class pattern. Agents implement `onMessage`, `onEvent`, `onSchedule` handlers. Runtime dispatches work directly.

**Consequences:**
- (+) Simpler agent authoring (async classes vs generators)
- (+) Enables future SaaS deployment (no persistent tick loop)
- (+) Easier to reason about and debug
- (+) Natural fit for LLM latencies (2-30s per call)
- (-) Lost sub-second cooperative scheduling (not needed for LLM agents)
- (-) Required full codebase rewrite of tick/ and executor

**What was kept:** Agent lifecycle state machine, exponential backoff, watchdog (adapted to timestamp-based), budget tracking.

---

## ADR-006: Unified LLM Provider Abstraction

**Status:** Accepted

**Context:** Need to support Ollama (local), Anthropic (Claude), and OpenAI from a single agent codebase. LangChain was considered but rejected for being too heavy and opaque.

**Decision:** Direct SDK wrappers behind a unified `LLMProvider` interface with `chat()` and `stream()` methods.

**Consequences:**
- (+) Full debuggability — no framework abstraction layers
- (+) Minimal dependencies per provider
- (+) Streaming via AsyncGenerator is natural
- (-) Must maintain provider-specific mapping code
- (-) No automatic retry/fallback (must implement ourselves)

---

## ADR-007: Guardian Security System

**Status:** Accepted (expanded in ADR-008)

**Context:** AI agents can accidentally exfiltrate secrets, write to sensitive paths, or perform actions outside their intended scope. Users need protection from agents.

**Decision:** Admission controller pipeline with composable validators: CapabilityController (per-agent permissions), SecretScanController (regex-based secret detection), DeniedPathController (blocked file paths).

**Consequences:**
- (+) Defense-in-depth: multiple independent checks
- (+) Extensible via custom controllers
- (+) Fail-closed: deny by default if controller rejects
- (-) Regex-based secret detection has false positives/negatives
- (-) Capability model needs careful design as features grow

---

## ADR-008: Three-Layer Defense Architecture

**Status:** Accepted

**Context:** The original Guardian (ADR-007) was built but **never wired into the Runtime dispatch path**. Messages reached agents without any security checks. Additionally, analysis of real AI agent incidents (see `docs/research/AI-AGENT-SECURITY-REPORT.md`) and OpenClaw patterns (see `docs/research/OPENCLAW-ANALYSIS.md`) revealed critical gaps: no input sanitization, no rate limiting, no output scanning, no audit trail, and no retrospective analysis.

**Decision:** Expand Guardian into a three-layer defense system:

- **Layer 1 (Proactive):** Admission controller pipeline wired into `Runtime.dispatchMessage()` before agent execution. Five controllers in order: InputSanitizer (mutating), RateLimiter, CapabilityController, SecretScanController, DeniedPathController.
- **Layer 2 (Output):** OutputGuardian scans LLM responses after agent execution but before user delivery. Also scans inter-agent event payloads in `ctx.emit()`.
- **Layer 3 (Sentinel):** SentinelAgent runs on cron schedule, analyzes AuditLog for anomalous patterns using heuristic rules and optional LLM-enhanced analysis.

Cross-cutting: AuditLog records all security events in an in-memory ring buffer (12 event types, queryable, configurable).

**Consequences:**
- (+) Defense-in-depth at every stage: input → processing → output → retrospective
- (+) Input sanitization catches prompt injection before agent sees the message
- (+) Output redaction prevents credential leaks in LLM responses without blocking useful content
- (+) AuditLog provides structured data for both real-time monitoring and forensic analysis
- (+) Sentinel detects slow-burn attacks that individual controllers miss
- (+) All features configurable and individually toggleable
- (-) Additional latency for each message (~ms for regex scanning, negligible)
- (-) In-memory audit log loses data on restart (future: persist to disk/DB)
- (-) Heuristic injection detection has false positive/negative tradeoffs

---

## ADR-009: Output Redaction vs Blocking

**Status:** Accepted

**Context:** When the OutputGuardian detects a secret in an LLM response, two strategies are possible: (1) block the entire response, or (2) redact just the secret and let the rest through.

**Decision:** Default to **redaction** (`[REDACTED]` markers) with blocking as a configurable fallback.

**Rationale:**
- LLM responses are expensive (latency + tokens). Blocking wastes the entire response for a single leaked credential.
- Users expect useful output. A response like "The API key is [REDACTED] and you should configure it in..." is far more useful than "[Response blocked: credential leak detected]".
- The AuditLog records every redaction with pattern details, so operators have full visibility.
- Blocking is still available via `guardian.outputScanning.redactSecrets: false` for high-security deployments.

**Implementation:** Offset-based replacement using `rawMatch` field on `SecretMatch` — replace from end of string backward to preserve earlier offsets.

**Consequences:**
- (+) Users get useful responses even when secrets leak
- (+) AuditLog captures full detection details for review
- (+) Configurable: operators can choose block mode for stricter security
- (-) Redacted response may be confusing if context around the secret is also important
- (-) Requires accurate `rawMatch` tracking (added to SecretMatch interface)

---

## ADR-010: Mutating vs Validating Controller Phases

**Status:** Accepted

**Context:** The Guardian pipeline needs to support two types of controllers: those that modify the action (e.g., stripping invisible characters from input) and those that only approve/deny (e.g., capability checks).

**Decision:** Two-phase pipeline: **mutating** controllers run first, **validating** controllers run second. Controllers return `null` to pass through, a denial result to short-circuit, or a result with `mutatedAction` to modify the action for downstream controllers.

**Rationale:**
- Mutating controllers (InputSanitizer) must run first so validating controllers see cleaned content
- This mirrors Kubernetes admission controller design (mutating webhooks → validating webhooks)
- Pipeline ordering is enforced by `Guardian.use()` which sorts by phase

**Consequences:**
- (+) Clean separation of concerns between mutation and validation
- (+) Validating controllers always see sanitized input
- (+) Familiar pattern for anyone who knows Kubernetes admission control
- (-) Mutating controllers can mask original input, making debugging harder (mitigated by AuditLog recording original lengths)

---

## ADR-011: Agent Self-Check via Context

**Status:** Accepted

**Context:** Agents sometimes need to know whether a planned action would be allowed before attempting it (e.g., check if a file write is permitted before doing expensive computation to generate the content).

**Decision:** Add `checkAction()` and `capabilities` to `AgentContext`. The `checkAction()` method calls `Guardian.check()` with the agent's granted capabilities and throws on denial.

**Rationale:**
- Agents should be able to fail gracefully instead of attempting denied actions
- The capabilities list lets agents adapt their behavior based on permissions
- Throwing on denial is consistent with the rest of the error handling model

**Implementation:** `Runtime.createAgentContext()` injects both fields, wired to the Guardian instance and the agent's `AgentDefinition.grantedCapabilities`.

**Consequences:**
- (+) Agents can make informed decisions about what they can/cannot do
- (+) Denied actions still recorded in AuditLog even when pre-checked
- (+) Read-only capabilities list prevents privilege escalation
- (-) Adds to AgentContext interface surface area
