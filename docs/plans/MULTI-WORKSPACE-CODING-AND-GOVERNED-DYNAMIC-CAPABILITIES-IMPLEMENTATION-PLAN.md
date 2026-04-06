# Multi-Workspace Coding And Governed Dynamic Capabilities — Implementation Plan

**Status:** Draft  
**Date:** 2026-04-06  
**Primary source proposal:** [MULTI-WORKSPACE-CODING-AND-GOVERNED-DYNAMIC-CAPABILITIES-PROPOSAL.md](/mnt/s/Development/GuardianAgent/docs/proposals/MULTI-WORKSPACE-CODING-AND-GOVERNED-DYNAMIC-CAPABILITIES-PROPOSAL.md)  
**Related plans:** [GENERAL-CHAT-CANONICAL-CODING-SESSIONS-IMPLEMENTATION-PLAN.md](/mnt/s/Development/GuardianAgent/docs/plans/GENERAL-CHAT-CANONICAL-CODING-SESSIONS-IMPLEMENTATION-PLAN.md), [BACKGROUND-DELEGATION-UPLIFT-PLAN.md](/mnt/s/Development/GuardianAgent/docs/plans/BACKGROUND-DELEGATION-UPLIFT-PLAN.md), [SKILLS-QUALITY-DISCIPLINE-UPLIFT-PLAN.md](/mnt/s/Development/GuardianAgent/docs/plans/SKILLS-QUALITY-DISCIPLINE-UPLIFT-PLAN.md), [CONTEXT-MEMORY-ORCHESTRATION-UPLIFT-PLAN.md](/mnt/s/Development/GuardianAgent/docs/plans/CONTEXT-MEMORY-ORCHESTRATION-UPLIFT-PLAN.md)  

## Objective

Deliver two connected uplifts without weakening Guardian's current security model:

1. extend backend-owned coding sessions into a multi-workspace session-portfolio model
2. add a governed dynamic-capability authoring lane for cases where curated routes and tools are insufficient

The implementation should preserve Guardian's current strengths:

- one authoritative top-level `IntentGateway`
- shared pending-action orchestration
- curated deferred tool discovery
- backend-owned code-session identity
- approval and sandbox enforcement
- operator-auditable control-plane mutation

## Current Note

One important prerequisite foundation is already landed in the worker transport path.

The `worker message dispatch timed out` failure mode was not an `IntentGateway` classification problem. It was a worker-transport and lane-isolation problem in:

- [src/supervisor/worker-manager.ts](/mnt/s/Development/GuardianAgent/src/supervisor/worker-manager.ts)
- [src/worker/worker-session.ts](/mnt/s/Development/GuardianAgent/src/worker/worker-session.ts)
- [src/chat-agent.ts](/mnt/s/Development/GuardianAgent/src/chat-agent.ts)

The landed fix established these invariants:

- worker reuse is keyed by `(sessionId, agentId)` instead of `sessionId` alone
- per-worker dispatch is serialized so overlapping `message.handle` calls cannot overwrite one another's callback state
- suspended-approval tracking uses the concrete worker session key rather than a broad shared session key
- dispatch fails fast when the worker is no longer available instead of silently reusing stale state
- downstream tool execution preserves the route that was already selected upstream, including locally routed Second Brain paths

This matters directly to this plan.

Both multi-workspace coding lanes and candidate-capability quarantine runs depend on:

- lane-specific worker identity
- serialized dispatch on a worker
- approval resume scoped to the concrete execution lane
- route preservation from upstream routing into downstream tool execution

These worker-transport guarantees should be treated as an already-landed prerequisite for the shared-foundation work in this plan, not as optional cleanup.

## Architectural Position

This plan intentionally does not turn Guardian into an open extension host.

The target design is:

- one implicit mutable coding session per conversational surface
- optional explicit visibility into other coding sessions
- explicit cross-session targeting for non-primary work
- no skill-driven runtime authority expansion
- no workspace-local auto-loaded executable capabilities
- candidate capabilities that are built, scanned, tested, approved, and only then activated

## Relationship To Existing Plans

### General chat canonical coding sessions

This plan builds on the session-focus cleanup from [GENERAL-CHAT-CANONICAL-CODING-SESSIONS-IMPLEMENTATION-PLAN.md](/mnt/s/Development/GuardianAgent/docs/plans/GENERAL-CHAT-CANONICAL-CODING-SESSIONS-IMPLEMENTATION-PLAN.md).

That plan establishes:

- one canonical coding chat surface
- one backend-owned session model
- one focused session per surface

This plan extends that model with:

- explicit referenced sessions
- child coding lanes
- cross-session inspect/compare flows

### Background delegation uplift

This plan should reuse, not replace, the delegated lineage and follow-up model from [BACKGROUND-DELEGATION-UPLIFT-PLAN.md](/mnt/s/Development/GuardianAgent/docs/plans/BACKGROUND-DELEGATION-UPLIFT-PLAN.md).

Child coding lanes should appear as another bounded producer of shared delegation state rather than a second delegation subsystem.

### Skills plans

This plan must preserve the current skills discipline:

- skills remain reviewed prompt artifacts
- skills do not create tools at runtime
- dynamic capabilities are a separate runtime-controlled path

## Non-Negotiable Rules

- Do not add regex or ad hoc keyword routing around the `IntentGateway`.
- Do not let a skill widen runtime authority.
- Do not auto-load executable capability content from arbitrary workspace paths.
- Do not silently mutate a non-primary coding session.
- Do not bypass `ToolExecutor`, approvals, audit, or sandboxing for candidate capabilities.
- Do not treat temporary activation as equivalent to permanent promotion.

## Scope

### In scope

- session portfolio metadata above the current code-session store
- explicit primary vs referenced vs delegated coding session semantics
- child coding lanes with lineage and status
- inspect, compare, and explicit target session operations
- candidate prompt/workflow artifacts
- candidate tool-adapter artifacts with quarantine, scanning, testing, approval, and expiry
- operator-visible control-plane surfaces for candidate capability review and promotion

### Out of scope

- auto-installing third-party executable skills or plugins from public registries
- changing Guardian skills to create runtime tools
- unrestricted multi-workspace mutation from one implicit chat context
- collapsing all coding sessions into one shared transcript
- bypassing `find_tools` or promoting all deferred tools to always-loaded

## Program Structure

Run the work in two tracks plus one shared foundation track.

### Track 0: Shared Foundation

- contracts
- routing
- worker transport and lane identity invariants
- control-plane state
- audit and timeline
- test harnesses

### Track A: Multi-Workspace Coding Session Portfolio

- explicit referenced sessions
- inspect and compare flows
- child coding lanes
- session graph and lineage

### Track B: Governed Dynamic Capability Authoring

- candidate artifact model
- quarantine build lane
- security and policy checks
- temporary activation
- promotion flow

## Sequencing Principles

- **Keep one implicit mutable target.** Multi-workspace awareness must not become multi-workspace ambiguity.
- **Inspect first, mutate explicitly.** Other sessions are inspectable by default, not writable by default.
- **Guard capability growth at runtime.** Build is separate from activate. Activate is separate from promote.
- **Server-owned truth only.** Chat surfaces, CLI, and Code are clients of runtime state, not separate owners.
- **Reuse shared orchestration.** Child coding lanes and candidate activation must project into existing pending-action, timeline, and audit systems.

## Phase 0: Contract And Dependency Alignment

### Goal

Define the shared contracts and sequencing dependencies before runtime behavior changes.

### Deliver

- align this plan with:
  - [GENERAL-CHAT-CANONICAL-CODING-SESSIONS-IMPLEMENTATION-PLAN.md](/mnt/s/Development/GuardianAgent/docs/plans/GENERAL-CHAT-CANONICAL-CODING-SESSIONS-IMPLEMENTATION-PLAN.md)
  - [BACKGROUND-DELEGATION-UPLIFT-PLAN.md](/mnt/s/Development/GuardianAgent/docs/plans/BACKGROUND-DELEGATION-UPLIFT-PLAN.md)
  - [SKILLS-SPEC.md](/mnt/s/Development/GuardianAgent/docs/specs/SKILLS-SPEC.md)
  - [TOOLS-CONTROL-PLANE-SPEC.md](/mnt/s/Development/GuardianAgent/docs/specs/TOOLS-CONTROL-PLANE-SPEC.md)
- define draft types for:
  - `CodeSessionLink`
  - `CodeSessionPortfolio`
  - `CapabilityCandidate`
  - candidate scan/test/admission records
- decide whether candidate-capability authoring gets:
  - a new top-level intent route, or
  - an operation under an existing architectural route
- record the already-landed worker transport prerequisites as part of the shared execution contract:
  - `(sessionId, agentId)` worker identity
  - serialized worker dispatch
  - worker-session-key-scoped suspended approvals
  - route preservation into downstream tool execution

### Likely implementation areas

- [docs/specs/ORCHESTRATION-SPEC.md](/mnt/s/Development/GuardianAgent/docs/specs/ORCHESTRATION-SPEC.md)
- [docs/specs/SKILLS-SPEC.md](/mnt/s/Development/GuardianAgent/docs/specs/SKILLS-SPEC.md)
- [docs/specs/TOOLS-CONTROL-PLANE-SPEC.md](/mnt/s/Development/GuardianAgent/docs/specs/TOOLS-CONTROL-PLANE-SPEC.md)
- [src/runtime/intent-gateway.ts](/mnt/s/Development/GuardianAgent/src/runtime/intent-gateway.ts)
- [src/config/types.ts](/mnt/s/Development/GuardianAgent/src/config/types.ts)
- [src/supervisor/worker-manager.ts](/mnt/s/Development/GuardianAgent/src/supervisor/worker-manager.ts)
- [src/worker/worker-session.ts](/mnt/s/Development/GuardianAgent/src/worker/worker-session.ts)
- [src/chat-agent.ts](/mnt/s/Development/GuardianAgent/src/chat-agent.ts)

### Exit criteria

- one agreed contract vocabulary for portfolio sessions and capability candidates
- no conflict with the existing skill and tool-control-plane rules
- implementation phases can land incrementally without architectural ambiguity

## Phase 1: Session Portfolio Core Model

### Goal

Add explicit portfolio state above the current one-primary-session model without breaking existing attachment semantics.

### Deliver

- extend the code-session runtime to support:
  - one primary session
  - zero or more referenced sessions
  - typed links between sessions
- store relationships such as:
  - `reference`
  - `comparison`
  - `delegated_worker`
  - `verification_lane`
  - `review_source`
- keep current attach/detach behavior for the primary session intact
- add read-only portfolio summary projection for chat, CLI, and web

### Likely implementation areas

- [src/runtime/code-sessions.ts](/mnt/s/Development/GuardianAgent/src/runtime/code-sessions.ts)
- [src/tools/builtin/coding-tools.ts](/mnt/s/Development/GuardianAgent/src/tools/builtin/coding-tools.ts)
- [src/channels/web-types.ts](/mnt/s/Development/GuardianAgent/src/channels/web-types.ts)
- [src/channels/web-runtime-routes.ts](/mnt/s/Development/GuardianAgent/src/channels/web-runtime-routes.ts)

### Data model direction

Suggested additions:

- `code_session_links` persistence table or equivalent durable store
- portfolio summary API per principal/surface
- session summary payload that distinguishes:
  - `primary`
  - `referenced`
  - `child/delegated`

### Exit criteria

- existing primary focus behavior still works
- referenced sessions can be attached and removed without becoming implicit mutation roots
- portfolio state is durable and inspectable

## Phase 2: Intent Gateway And Tooling For Explicit Multi-Session Operations

### Goal

Make cross-session work an explicit routed capability rather than a prompt convention.

### Deliver

- extend `IntentGateway` so it can reliably distinguish:
  - current-session navigation
  - list/inspect other sessions
  - compare sessions
  - add/remove referenced sessions
  - explicit cross-session targeting
- add or extend tools for:
  - portfolio summary
  - session inspect
  - session compare
  - reference add/remove
- ensure the model sees clear tool descriptions that reinforce:
  - one primary session for implicit mutation
  - explicit targeting required for non-primary mutations

### Likely implementation areas

- [src/runtime/intent-gateway.ts](/mnt/s/Development/GuardianAgent/src/runtime/intent-gateway.ts)
- [src/index.ts](/mnt/s/Development/GuardianAgent/src/index.ts)
- [src/tools/builtin/coding-tools.ts](/mnt/s/Development/GuardianAgent/src/tools/builtin/coding-tools.ts)
- [src/tools/executor.ts](/mnt/s/Development/GuardianAgent/src/tools/executor.ts)
- [src/reference-guide.ts](/mnt/s/Development/GuardianAgent/src/reference-guide.ts)

### Exit criteria

- natural-language requests for inspect/compare/reference/session-target actions route consistently
- ambiguous multi-workspace mutation requests fail closed or ask for clarification
- explicit target session requests carry the targeted `codeSessionId` through execution and pending-action state

## Phase 3: Prompt Context And Safety Semantics For Multi-Session Coding

### Goal

Teach Guardian how to reason about several coding sessions without confusing their scopes.

### Deliver

- update context assembly to expose:
  - primary session summary
  - bounded referenced-session summaries
  - child lane status summaries
- label each session in prompt context by role
- ensure tool context and prompt context agree on:
  - current mutable workspace
  - non-primary inspect-only sessions
- keep code-session memory scope explicit per session

### Likely implementation areas

- [src/runtime/context-assembly.ts](/mnt/s/Development/GuardianAgent/src/runtime/context-assembly.ts)
- [src/tools/tool-context.ts](/mnt/s/Development/GuardianAgent/src/tools/tool-context.ts)
- [src/prompts/code-session-core.ts](/mnt/s/Development/GuardianAgent/src/prompts/code-session-core.ts)
- [src/prompts/guardian-core.ts](/mnt/s/Development/GuardianAgent/src/prompts/guardian-core.ts)

### Exit criteria

- the model can discuss multiple sessions coherently without losing the primary workspace anchor
- prompt context never implies that referenced sessions are implicit mutation targets
- session-scoped memory stays unambiguous

## Phase 4: Child Coding Lanes And External Backend Lineage

### Goal

Turn background coding work in another workspace into a first-class child lane rather than an opaque backend run.

### Deliver

- define child coding-lane lineage back to:
  - originating request
  - originating code session
  - principal/surface
- allow explicit spawning of child coding lanes into another workspace or session
- project child-lane status into:
  - assistant jobs
  - run timeline
  - code-session summaries
- keep one-shot external coding backend runs supported, but let them report through the child-lane model when they operate outside the primary workspace

### Likely implementation areas

- [src/runtime/coding-backend-service.ts](/mnt/s/Development/GuardianAgent/src/runtime/coding-backend-service.ts)
- [src/runtime/code-sessions.ts](/mnt/s/Development/GuardianAgent/src/runtime/code-sessions.ts)
- [src/runtime/run-timeline.ts](/mnt/s/Development/GuardianAgent/src/runtime/run-timeline.ts)
- [src/runtime/assistant-jobs.ts](/mnt/s/Development/GuardianAgent/src/runtime/assistant-jobs.ts)
- [src/supervisor/worker-manager.ts](/mnt/s/Development/GuardianAgent/src/supervisor/worker-manager.ts)

### Exit criteria

- background work against another workspace is no longer just “a backend session happened”
- users and operators can see which child lane belongs to which parent session
- child lane completion uses the shared delegated-result and follow-up rules

## Phase 5: Candidate Capability Model And Quarantine Build Lane

### Goal

Create the runtime-owned artifact model for bespoke capability authoring without activating anything yet.

### Deliver

- add a durable `CapabilityCandidate` store
- define candidate kinds:
  - `prompt_artifact`
  - `workflow_artifact`
  - `tool_adapter`
- create a Guardian-owned quarantine location, for example:
  - `~/.guardianagent/capability-candidates/<id>/`
- record provenance:
  - source request
  - source route
  - requested authority
  - required tools/domains/commands/paths
  - owner principal
  - expiry
- add a build-only pipeline that can generate candidate artifacts into quarantine

### Likely implementation areas

- new `src/runtime/capability-candidates.ts`
- new `src/runtime/capability-candidate-store.ts`
- [src/config/types.ts](/mnt/s/Development/GuardianAgent/src/config/types.ts)
- [src/runtime/intent-gateway.ts](/mnt/s/Development/GuardianAgent/src/runtime/intent-gateway.ts)
- [src/runtime/pending-actions.ts](/mnt/s/Development/GuardianAgent/src/runtime/pending-actions.ts)

### User workflow contract

The expected interaction should be:

1. Guardian identifies that the current catalog is insufficient.
2. Guardian asks whether it should author a candidate capability.
3. If the user approves, Guardian builds it in quarantine only.
4. Guardian runs checks and reports the results.
5. The user can then choose discard, temporary activate, or promote.

### Exit criteria

- Guardian can build candidate artifacts without activating them
- all candidate artifacts are durable, auditable, and easy to inspect
- build is clearly separated from activate/promote

## Phase 6: Guardian Policy Checks, Security Scanning, And Isolated Tests

### Goal

Make Guardian itself the admission gate for generated capabilities.

### Deliver

- add Guardian rule-set checks for candidate capabilities:
  - requested commands vs allowlists
  - requested domains vs allowed domains
  - requested filesystem scopes
  - requested authority class
  - trust-boundary conflicts
- add static scanning for generated source/artifacts
- add isolated execution tests in a quarantined sandbox
- emit machine-readable scan/test records
- block activation on critical failures by default

### Likely implementation areas

- new `src/runtime/capability-candidate-scanner.ts`
- new `src/runtime/capability-candidate-harness.ts`
- [src/guardian/](/mnt/s/Development/GuardianAgent/src/guardian)
- [src/sandbox/](/mnt/s/Development/GuardianAgent/src/sandbox)
- [src/tools/executor.ts](/mnt/s/Development/GuardianAgent/src/tools/executor.ts)
- [scripts/](/mnt/s/Development/GuardianAgent/scripts)

### Security stance

Guardian should enforce several gates, not one:

- policy gate
- static scan gate
- isolated test gate
- approval gate
- activation gate
- promotion gate

### Exit criteria

- a candidate can be blocked by Guardian policy before activation
- failing scan/test results are explicit and user-visible
- no candidate activation path bypasses sandbox or approval logic

## Phase 7: Temporary Activation And Time-Boxed Admission

### Goal

Allow approved candidates to be used temporarily without making them permanent.

### Deliver

- add explicit temporary activation state
- activation should bind:
  - candidate id
  - owner principal
  - activation scope
  - expiry
- admit temporary tool adapters into the live tool plane only through runtime-owned registration
- ensure temporary activations:
  - appear in `/api/tools` style inventories
  - remain auditable
  - can be revoked
  - expire automatically

### Likely implementation areas

- [src/tools/registry.ts](/mnt/s/Development/GuardianAgent/src/tools/registry.ts)
- [src/tools/executor.ts](/mnt/s/Development/GuardianAgent/src/tools/executor.ts)
- new activation support under `src/runtime/capability-candidates.ts`
- control-plane routes in [src/channels/web-runtime-routes.ts](/mnt/s/Development/GuardianAgent/src/channels/web-runtime-routes.ts)

### Hard rules

- temporary activation does not equal permanent registration
- activation never converts a candidate into a skill
- temporary tools still participate in `find_tools` and ordinary policy enforcement
- activation is denied if the candidate requests authority beyond its approved contract

### Exit criteria

- users can temporarily activate an approved candidate safely
- temporary capabilities expire or can be revoked cleanly
- the live tool catalog can describe why a capability is temporary and when it expires

## Phase 8: Promotion And Permanent Capability Authoring Flow

### Goal

Turn successful candidates into curated first-class capabilities only through an explicit promotion step.

### Deliver

- add a promotion workflow that can:
  - copy reviewed content into the right permanent location
  - create or update the correct manifest/config metadata
  - require explicit approval separate from activation
  - emit audit records
- promotion targets should differ by candidate kind:
  - prompt/workflow artifacts may promote into reviewed skill/resource locations
  - tool adapters should promote through the normal capability-authoring path, not ad hoc runtime state

### Likely implementation areas

- [docs/guides/CAPABILITY-AUTHORING-GUIDE.md](/mnt/s/Development/GuardianAgent/docs/guides/CAPABILITY-AUTHORING-GUIDE.md)
- [src/skills/](/mnt/s/Development/GuardianAgent/src/skills)
- [src/tools/](/mnt/s/Development/GuardianAgent/src/tools)
- control-plane callbacks in [src/index.ts](/mnt/s/Development/GuardianAgent/src/index.ts)

### Exit criteria

- permanent promotion is an explicit operator-approved action
- promoted artifacts land in the correct curated locations
- the runtime no longer depends on quarantined candidate state after promotion

## Phase 9: Control-Plane And UX Surfaces

### Goal

Make both uplifts operable and inspectable from the existing Guardian surfaces.

### Deliver

- web UI surfaces for:
  - current session portfolio
  - referenced sessions
  - child coding lanes
  - candidate capability inventory
  - scan/test/admission state
  - temporary activation and promotion actions
- CLI surfaces for:
  - inspect portfolio
  - inspect candidate
  - activate/revoke/promote candidate
- timeline and audit visibility for:
  - child coding lane lifecycle
  - candidate build/scanning/testing
  - activation/promotion/revocation

### Likely implementation areas

- [src/channels/web-types.ts](/mnt/s/Development/GuardianAgent/src/channels/web-types.ts)
- [src/channels/web-runtime-routes.ts](/mnt/s/Development/GuardianAgent/src/channels/web-runtime-routes.ts)
- [web/public/](/mnt/s/Development/GuardianAgent/web/public)
- [src/channels/cli.ts](/mnt/s/Development/GuardianAgent/src/channels/cli.ts)
- [src/runtime/run-timeline.ts](/mnt/s/Development/GuardianAgent/src/runtime/run-timeline.ts)

### Exit criteria

- operators can inspect the session graph and candidate-capability pipeline without digging into raw files
- privileged actions stay ticket-gated
- UI surfaces are informative without becoming the source of truth

## Testing Strategy

### Unit and service tests

- `CodeSessionStore` portfolio and link semantics
- explicit target-session validation
- prompt-context primary vs referenced session formatting
- candidate artifact persistence and expiry
- scan/test/admission rule evaluation
- temporary activation and revocation

### Integration and harness tests

- multi-session attach/reference/compare flows
- child coding-lane lineage and completion handoff
- blocked cross-session mutation when target is implicit or ambiguous
- candidate build -> scan -> test -> report workflow
- candidate activation denial on policy or scan failure
- temporary activation inventory visibility
- promotion flow requiring separate approval

### Regression emphasis

The plan must explicitly protect against regressions where:

- a referenced session becomes implicitly writable
- a skill starts behaving like a runtime tool loader
- candidate capabilities bypass `find_tools`
- candidate activation bypasses approval or sandboxing
- candidate promotion writes directly into permanent locations without a separate approval step

## Documentation Updates Required

- [docs/specs/ORCHESTRATION-SPEC.md](/mnt/s/Development/GuardianAgent/docs/specs/ORCHESTRATION-SPEC.md)
- [docs/specs/SKILLS-SPEC.md](/mnt/s/Development/GuardianAgent/docs/specs/SKILLS-SPEC.md)
- [docs/specs/TOOLS-CONTROL-PLANE-SPEC.md](/mnt/s/Development/GuardianAgent/docs/specs/TOOLS-CONTROL-PLANE-SPEC.md)
- [docs/specs/CODING-WORKSPACE-SPEC.md](/mnt/s/Development/GuardianAgent/docs/specs/CODING-WORKSPACE-SPEC.md)
- [src/reference-guide.ts](/mnt/s/Development/GuardianAgent/src/reference-guide.ts)

## Recommended Delivery Order

The safest implementation order is:

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 5
6. Phase 6
7. Phase 7
8. Phase 4
9. Phase 8
10. Phase 9

Reasoning:

- session portfolio semantics should be stabilized before child lanes
- build/scanning/admission contracts should be stabilized before activation
- activation should be proven before promotion
- child coding lanes should reuse the shared lineage and follow-up model rather than inventing their own early

## First Slice Recommendation

If this needs to be staged tightly, the best first implementation slice is:

- session portfolio summaries and explicit referenced sessions
- session inspect/compare tools
- candidate prompt/workflow artifacts only
- build-only quarantine lane
- Guardian policy/scanner/test contracts without activation yet

That slice provides visible value while avoiding the higher-risk parts:

- no temporary executable activation yet
- no permanent promotion yet
- no cross-workspace background mutation yet

## End-State Success Criteria

Guardian should be able to:

- keep one primary coding workspace per surface for implicit repo-local work
- inspect and compare other coding sessions without losing primary focus
- run child coding lanes in another workspace with visible lineage and bounded follow-up
- detect when the current catalog is insufficient and ask whether to author a candidate capability
- build that candidate in quarantine
- inspect it against Guardian rules and block it if necessary
- report its location and check results to the user
- let the user choose discard, temporary activate, or promote
- require a separate approval for permanent promotion

If the implementation cannot preserve those constraints, it should stop short of activation rather than weakening Guardian's current security posture.
