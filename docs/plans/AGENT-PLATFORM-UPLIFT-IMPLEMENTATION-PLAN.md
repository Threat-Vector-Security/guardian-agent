# Agent Platform Uplift Implementation Plan

## Status

Draft implementation roadmap. This is the tracked successor to the earlier generic uplift notes in `docs/research/claude-code-source-deep-dive/`.

## Inputs

- Claude Code source deep-dive research
- GuardianAgent current architecture and security model
- comparative audit of `/mnt/s/Development/everything-claude-code`

## Purpose

Improve GuardianAgent reliability, efficiency, and intelligence without weakening the security posture defined in `SECURITY.md`, `docs/architecture/OVERVIEW.md`, and the intent-gateway / pending-action / memory specs.

## Non-Negotiable Invariants

- Intent routing stays gateway-first.
- Supervisor-side framework code remains the trusted control plane.
- LLM, user, tool, remote, and memory content remain untrusted by default.
- Approval and policy choke points remain authoritative for non-read-only actions.
- Memory trust, provenance, and quarantine semantics are preserved.
- Degraded-host risky surfaces stay fail-closed by default.
- New operator or automation features must attach to shared orchestration state, not bespoke per-tool flows.

## What To Adopt From `everything-claude-code`

### 1. State-backed operator surface

Adopt the idea, not the exact implementation.

Guardian should expose a first-class operator view for:

- active sessions
- active and blocked tasks
- pending approvals
- recent governance or security events
- context and cost pressure
- install or integration health where relevant

Why it matters:

- ECC's SQLite-backed status surface is a useful pattern for runtime introspection.
- Guardian already has richer runtime state than ECC, but it is not yet surfaced as one coherent operator plane.

Guardian shape:

- runtime-owned task and session ledgers
- web and CLI status views driven from the same metadata
- no prompt-only hidden state for "what is running or blocked"

### 2. Deterministic audit rails

Adopt strongly.

ECC's `harness-audit` pattern is the right idea: deterministic checks first, model synthesis second.

Guardian should add deterministic audit tooling for:

- runtime configuration drift
- policy and sandbox posture
- MCP and connector exposure
- approval and pending-action rendering coverage
- memory provenance coverage
- test and eval coverage for critical paths

This should be script-backed and reproducible for the same commit.

### 3. Profile-gated runtime behavior

Adopt in Guardian terms.

ECC uses hook profiles such as `minimal`, `standard`, and `strict`. Guardian already has trust presets and policy modes, but the adjacent runtime behaviors are still spread across features.

Guardian should converge on explicit runtime profiles for:

- quality gate strictness
- background maintenance intensity
- notification verbosity
- local-model fallback behavior
- optional operator diagnostics

These profiles must never bypass the security invariants above.

### 4. Provenance and catalog discipline

Adopt strongly.

ECC is directionally correct on provenance metadata and generated catalog truth. Guardian should extend that discipline to:

- skills
- prompt bundles
- MCP/provider descriptors
- imported research or policy packs
- learned patterns and memory-derived artifacts

Each imported or generated artifact should carry source, trust, timestamp, and promotion status.

### 5. Manual session snapshot and resume exports

Adopt partially.

ECC's `/save-session` and `/resume-session` commands are useful as user-facing exports, but they should not be Guardian's primary persistence model.

Guardian should use:

- transcript-first runtime persistence as the primary truth
- optional exportable session briefs as a fallback, handoff, or audit artifact
- deterministic resume state restoration instead of relying on manual summaries alone

### 6. Context-budget inspection

Adopt strongly.

ECC's `context-budget` idea maps directly onto Guardian's compaction and cost work. Guardian should provide a deterministic context budget report that shows:

- prompt fixed cost
- dynamic tail cost
- tool registry footprint
- memory block footprint
- compaction history
- cost by run and by worker

### 7. Reviewed learning, not free-form learning

Adopt the caution, not the auto-learning surface.

ECC's continuous-learning direction is useful, but Guardian should only keep the reviewed, quarantined, provenance-carrying parts.

Guardian should prefer:

- candidate extraction into quarantine
- deterministic evidence capture
- operator review or explicit promotion
- narrow promotion targets such as rules, skills, or summaries

Guardian should avoid auto-promoting raw session content into durable trusted behavior.

## What Not To Adopt Directly

### 1. Slash-command sprawl

ECC exposes dozens of commands. Guardian should not mirror that surface area. Most value should stay behind shared runtime primitives and a smaller set of operator-visible controls.

### 2. Agent proliferation

ECC's catalog has many specialized agents. Guardian should keep role specialization narrow and runtime-backed:

- coordinator
- explorer
- implementer
- verifier

Only add more roles where tooling, context, and output contracts genuinely differ.

### 3. Hook-heavy control logic

ECC leans heavily on hook surfaces because that fits its host harness model. Guardian should keep primary control logic in the runtime, with hooks or post-action checks only where the runtime cannot provide the control itself.

### 4. Heuristic-only model routing

ECC's `model-route` command is directionally useful but too heuristic to be a control plane. Guardian should keep typed routing and deterministic policy gates ahead of model choice.

### 5. Imported artifact bulk

ECC is a large installable ecosystem. Guardian should not import large external skill or rules packs wholesale. Port only audited ideas into Guardian-native specs, policies, or runtime code.

## Replacements To The Earlier Generic Plan

The generic plan stays directionally correct, but these changes should now be explicit:

- replace vague "observability split" with a concrete operator surface backed by runtime ledgers
- replace generic "cost ledger" language with a combined context-and-cost budget report
- replace "continuous learning" as an implicit good with reviewed-learning and provenance gates
- replace implicit plugin growth with cataloged capability packs and artifact provenance
- replace manual session-note style persistence as a primary tool with transcript-first persistence plus optional export briefs

## Updated Delivery Phases

## Phase 0: Runtime Ledger And Operator Truth

Goal:
Make runtime state inspectable and canonical.

Work:

- finalize session, task, approval, and blocker ledgers
- expose a shared operator status surface for web and CLI
- ensure blocked, running, resumed, and terminal states are visible without transcript scraping
- add deterministic state snapshots for harness assertions

Acceptance:

- every active task and blocker is queryable from shared runtime state
- UI surfaces render from the same underlying task and approval records
- restart and resume do not lose operator-visible state

## Phase 1: Resume, Budget, And Compaction Maturity

Goal:
Make long sessions stable and cheap enough to trust.

Work:

- finish resume classification and continuation synthesis
- add deterministic context-budget reporting
- persist cost and budget usage across resume
- extend multi-stage compaction with traceable boundaries and outcomes

Acceptance:

- resumed sessions preserve execution context and budget state
- context pressure is inspectable before failure
- long sessions compact predictably instead of failing silently

## Phase 2: Deterministic Audit And Quality Gates

Goal:
Turn operational correctness into something measurable.

Work:

- add a Guardian audit script for runtime posture, policy coverage, and integration exposure
- add deterministic checks for approval rendering, memory provenance, and integration config drift
- wire the audit surface into harness and CI lanes where appropriate

Acceptance:

- the same commit yields the same audit score and findings
- critical control-plane regressions fail deterministic checks before manual review
- audit output points to concrete files and missing controls

## Phase 3: Role-Specialized Orchestration

Goal:
Make delegation explicit, inspectable, and cheaper.

Work:

- keep coordinator, explorer, implementer, and verifier as the core role set
- narrow tool pools and context slices per role
- add standardized handoff objects and verdict contracts
- keep verifier passes fresh-context and minimally polluted

Acceptance:

- delegated work has explicit ownership, state, and verdicts
- verification is separable from implementation
- orchestration state is no longer hidden in prompt text

## Phase 4: Capability Catalog And Provenance Governance

Goal:
Treat runtime extensions as governed artifacts.

Work:

- add provenance metadata for imported/generated skills, prompts, and capability packs
- create generated catalog truth for operator-visible capabilities
- add promotion states such as candidate, reviewed, active, deprecated
- keep third-party integrations namespaced and policy-shaped

Acceptance:

- every non-native artifact has source and trust metadata
- catalog drift is detectable automatically
- promotion into active use is auditable

## Phase 5: External Host Surface And Settings Discipline

Goal:
Expose Guardian cleanly without UI coupling or config drift.

Work:

- continue the process-transport SDK work
- expose status, interrupt, and budget APIs beside prompt/session APIs
- formalize layered settings and reload semantics
- add runtime profiles for diagnostics and maintenance intensity

Acceptance:

- hosts can drive Guardian without importing UI code
- settings changes resolve deterministically
- profile changes do not bypass approval or policy controls

## Phase 6: Bounded Maintenance And Reviewed Learning

Goal:
Add helpful background behavior without uncontrolled autonomy.

Work:

- add bounded background maintenance for consolidation and health checks
- add candidate extraction for learning artifacts into quarantine
- require explicit review or promotion before broader reuse
- keep notifications and proactive behavior separately disableable

Acceptance:

- background behavior is observable, killable, and bounded
- extracted patterns do not silently become trusted behavior
- learning improves operator leverage without becoming a poisoning channel

## Immediate Next Slices

Highest-value additions after the current memory phase:

1. Operator status ledger and shared status UI/CLI surface.
2. Deterministic Guardian audit script and scorecard.
3. Context-budget report that joins prompt cost, compaction, and worker usage.
4. Provenance metadata for imported/generated skills and prompt artifacts.
5. Reviewed-learning pipeline with quarantine and promotion states.

## Implementation Notes

- Use deterministic scripts for fact collection and scoring whenever possible.
- Let LLMs synthesize or prioritize after the deterministic collection step, not before.
- Keep all new user-facing surfaces mapped back to shared runtime state.
- Prefer additive operator tooling over wider end-user command surfaces.
- Port ideas, not branding or repo-local harness conventions.
