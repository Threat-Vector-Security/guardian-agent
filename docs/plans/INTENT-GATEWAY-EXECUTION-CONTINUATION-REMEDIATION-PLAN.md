# Intent Gateway And Execution Continuation Remediation Plan

**Date:** 2026-04-18  
**Status:** Draft  
**Origin:** Verified routing, continuation, delegation, and live-progress remediation review  
**Primary code evidence:** `src/runtime/intent-gateway.ts`, `src/runtime/intent/structured-recovery.ts`, `src/runtime/intent/unstructured-recovery.ts`, `src/runtime/intent/clarification-resolver.ts`, `src/runtime/intent/route-entity-resolution.ts`, `src/runtime/intent/request-patterns.ts`, `src/runtime/intent/history-context.ts`, `src/runtime/chat-agent/intent-gateway-orchestration.ts`, `src/runtime/pending-actions.ts`, `src/runtime/pending-action-resume.ts`, `src/runtime/continuity-threads.ts`, `src/runtime/execution-profiles.ts`, `src/runtime/routed-tool-execution.ts`, `src/supervisor/worker-manager.ts`, `src/runtime/run-timeline.ts`, `web/public/js/chat-panel.js`, `web/public/js/chat-run-tracking.js`  
**Primary docs impacted:** [FORWARD-ARCHITECTURE.md](../architecture/FORWARD-ARCHITECTURE.md), [OVERVIEW.md](../architecture/OVERVIEW.md), [INTENT-GATEWAY-ROUTING-DESIGN.md](../design/INTENT-GATEWAY-ROUTING-DESIGN.md), [RUN-TIMELINE-AND-EVENT-VIEWER-DESIGN.md](../design/RUN-TIMELINE-AND-EVENT-VIEWER-DESIGN.md), [TOOLS-CONTROL-PLANE-DESIGN.md](../design/TOOLS-CONTROL-PLANE-DESIGN.md)  
**Related plans:** `docs/plans/INTENT-GATEWAY-CAPABILITY-PLANE-UPLIFT-PLAN.md`, `docs/plans/CROSS-SURFACE-CONTINUITY-UPLIFT-PLAN.md`, `docs/plans/BACKGROUND-DELEGATION-UPLIFT-PLAN.md`, `docs/plans/WEB-CLI-LIVE-PROGRESS-IMPLEMENTATION-PLAN.md`

---

## Objective

Realign Guardian with the repo's gateway-first architecture by restoring the Intent Gateway as the only semantic interpreter for normal turns, replacing the current heuristic continuation stack with an execution-backed continuation system, and unifying delegation, blockers, and live progress around one authoritative execution-state model.

This plan is a remediation plan, not a rewrite license.

The implementation should:

1. keep the Intent Gateway as the only place where free-text user intent is semantically classified
2. move continuation, retry, approval resume, and status follow-up onto durable execution state instead of transcript heuristics
3. make repo grounding enforceable before synthesis, not just advisory metadata
4. make delegated worker outputs typed and coordinator-owned
5. separate operator-facing progress from debug tracing
6. land through dual-write and compatibility projections instead of a flag-day cutover

---

## Executive Summary

The prior research was directionally correct, but it needs one important correction:

- Guardian is still gateway-first at the front door. Normal turns are still classified through `IntentGateway` in `src/runtime/incoming-dispatch.ts` before tier routing and code-session attachment decisions are finalized.
- The real drift is that too many downstream layers are still allowed to make semantic decisions after classification. In practice, route repair, entity inference, continuity repair, retry detection, blocker resume, delegated follow-up, and run correlation are spread across several loosely connected stores and regex-heavy helpers.

The clean exit is not another patch wave.

The clean exit is:

1. introduce a first-class `ExecutionStore`
2. bind blockers, approvals, continuation, delegation, and progress to `executionId`
3. narrow post-gateway logic to deterministic normalization and explicit-id extraction only
4. enforce repo-grounding with evidence gates before synthesis
5. project the same execution state into pending actions, continuity summaries, run timeline, chat surfaces, and diagnostics

---

## Verified Current State

### 1. Gateway-first entry still exists, but semantic authority is diluted afterward

Verified:

- `src/runtime/incoming-dispatch.ts:302-313` lazily classifies each normal turn through the routing `IntentGateway`.
- `src/runtime/incoming-dispatch.ts:481-497` uses the gateway result when deciding whether to attach the current code session and how to route with tier awareness.
- `src/runtime/intent-gateway.ts:97-133` still presents a single compatibility facade for classifier execution and fallback ordering.

But:

- `src/runtime/intent-gateway.ts:136-173` mutates the returned decision with automation-name repair, historical-reference repair, email-provider repair, and clarification repair.
- `src/runtime/intent/structured-recovery.ts:147-205` repairs route, operation, entity state, and workload metadata while assembling the final decision.
- `src/runtime/intent/clarification-resolver.ts:34-120` can override route and operation based on explicit phrases, pending-action hints, and continuity hints.
- `src/runtime/intent/unstructured-recovery.ts:47-197` can recover full semantic routes such as `coding_task`, `filesystem_task`, `personal_assistant_task`, and `complex_planning_task` from unstructured content.
- `src/runtime/intent/route-entity-resolution.ts:76-215` infers route-scoped entities from free text and repair context rather than only validating structured state.
- `src/runtime/intent/request-patterns.ts:3-61`, `src/runtime/intent/history-context.ts:32-125`, and `src/runtime/intent/entity-resolvers/personal-assistant.ts:61-162` all still include regex-heavy semantic inference.

Assessment:

- The Intent Gateway is still the front door.
- The Intent Gateway is no longer the only semantic decision-maker in practice.

### 2. Continuation and retry still depend heavily on language heuristics

Verified:

- `src/runtime/chat-agent/intent-gateway-orchestration.ts:574-647` reconstructs retry intent by scanning assistant failures and then walking backward to find the prior actionable user request.
- `src/runtime/chat-agent/intent-gateway-orchestration.ts:603-657` uses heuristics to decide whether a user message counts as an actionable request, retry, backend switch, or status check.
- `src/runtime/pending-action-resume.ts:3-20` uses generic continuation regexes such as `continue`, `resume`, `do that`, and `run that`.
- `src/runtime/intent/history-context.ts:32-125` uses transcript heuristics such as `same request`, `that task`, `continue`, `retry`, and `before editing` to repair current turns against `lastActionableRequest`.

Assessment:

- Continuation is not execution-backed today.
- It is reconstructed from assistant text, prior user text, and narrow summary state.

### 3. Continuity state is bounded, but too lossy for durable orchestration

Verified:

- `src/runtime/continuity-threads.ts:34-46` stores a `ContinuityThreadRecord` with `focusSummary`, `lastActionableRequest`, `activeExecutionRefs`, `continuationState`, and `safeSummary`.
- `src/runtime/intent/history-context.ts:39-63` builds gateway history queries from only the current text, continuity summaries, and string identifiers.
- `src/runtime/intent/entity-resolvers/personal-assistant.ts:64-72` rebuilds context from pending-action prompt plus continuity summary text.

Assessment:

- The current continuity model is a bounded summary object, not a durable execution graph.
- That is a reasonable portability layer, but it is not enough to safely own retry, blocker resume, multi-step coding, or delegated follow-up.

### 4. Repo grounding is partially enforced, but not through one mandatory evidence gate

Verified:

- `src/runtime/execution-profiles.ts:167-186` and `src/runtime/message-router.ts:427-432` treat `requiresRepoGrounding` as a real routing signal.
- `src/runtime/code-session-request-scope.ts:82-95` uses `requiresRepoGrounding` to decide whether to attach the current code session.
- `src/runtime/routed-tool-execution.ts:180-195` emits correction instructions that force repo inspection before synthesis.
- `src/runtime/routed-tool-execution.ts:291-323` pushes repo-grounded tool-use rules for coding turns.
- `src/runtime/routed-tool-execution.ts:405-429` denies certain shell-based repo inspection paths when built-in repo tools should be used instead.
- `src/runtime/coding-workflows.ts:405-409` already has a "repo evidence is still missing" block in the workflow model.

But:

- `src/runtime/execution-profiles.ts:300-336` still uses `requiresRepoGrounding` mainly as a profile-selection and provider-selection input.
- There is no single execution-wide evidence bundle that must be present before a repo-grounded synthesis step can complete.
- The current protections are split between prompts, tool denials, workflow hints, and code-session attachment.

Assessment:

- The research claim that repo grounding is "purely advisory" is too strong.
- The more accurate problem is that repo grounding is enforced in several partial ways, but not by one shared evidence-first contract.

### 5. Delegated-worker handoff is still too loosely typed at the user-response boundary

Verified:

- `src/supervisor/worker-manager.ts:1526-1570` builds a bounded handoff summary with lifecycle, unresolved blocker kind, reporting mode, and next action.
- `src/supervisor/worker-manager.ts:1573-1605` still passes `result.content` straight through whenever the reporting mode remains `inline_response`.

Assessment:

- Some bounded delegated handoff work already exists.
- The remaining gap is the final handoff contract: worker output is still not strongly separated into evidence, operator summary, user-facing response, blockers, and progress payload.

### 6. Rich progress exists in the backend, but the user-facing projection is narrow and generic

Verified:

- `src/supervisor/worker-manager.ts:214-226`, `260-274`, and `484-530` emit delegated-worker progress with request id, task run id, continuity key, execution refs, orchestration label, and code-session id.
- `src/runtime/run-timeline.ts:417-463` ingests delegated progress into parent and child run entries.
- `src/runtime/run-timeline.ts:1738-1751` already stores continuity key and active execution refs as timeline context assembly.
- `web/public/js/chat-panel.js:923-929` filters timeline updates through `matchesRunTimelineRequest(...)`.
- `web/public/js/chat-run-tracking.js:5-22` matches only on `requestId`, `parentRunId`, and `codeSessionId`.

Assessment:

- The backend already knows more than the main chat currently shows.
- The chat-side correlation and rendering rules are still too narrow to reliably surface the right execution narrative.

### 7. Delegated-worker label and copy quality are still not operator-grade

Verified:

- `src/runtime/run-timeline.ts:1719-1723` prefers `agentName` before `orchestrationLabel`.
- `src/supervisor/worker-manager.ts:1451-1464` still emits generic strings such as `Brokered worker dispatch for ...` and `Worker <id> is processing the delegated request.`

Assessment:

- The system already has role metadata.
- The UI projection currently hides the most useful role name and uses generic source copy even before rendering.

### 8. The code already acknowledges that the uplift is incomplete

Verified:

- `src/supervisor/worker-manager.ts:1554-1556` contains an explicit TODO saying the background delegation uplift still needs broader run-class adoption and better timeline/query visibility.

---

## Security Assessment

This verification pass did not find a direct trust-boundary bypass in the cited paths.

Approvals, routing through shared runtime entry points, and repo/tool gating are still present.

The security risk is architectural reliability:

- sensitive resumes are reconstructed from text instead of bound to execution identity
- semantic responsibility is spread across many heuristic layers
- delegated worker output can still cross the user boundary too loosely
- progress and status surfaces can attach to the wrong run or hide the true worker role

That is a control-plane correctness problem, not a confirmed sandbox-bypass problem.

---

## Remediation Principles

1. The Intent Gateway remains the only component that may semantically classify normal free-text user intent.
2. Deterministic logic after classification may normalize explicit structured references such as approval ids, session ids, provider ids, concrete file paths, and existing execution ids.
3. Continuation means "resume this execution", not "guess the last similar request from transcript text."
4. Repo-grounded synthesis must require evidence gathered in the current execution, not just a high-level routing flag.
5. Delegated workers return structured execution results; the coordinator owns user-facing narration.
6. Operator-facing progress is a first-class event schema, not a filtered debug trace.
7. Pending actions, continuity, delegation, and run timeline become projections of one execution-state subsystem.
8. Migration must be dual-write and reversible until the new model proves itself under harness coverage.

---

## Target End State

### 1. Execution becomes the canonical runtime object

Introduce a new execution-state subsystem under `src/runtime/executions/`.

Suggested core model:

```ts
interface ExecutionRecord {
  executionId: string;
  continuityKey: string;
  scope: {
    assistantId: string;
    userId: string;
    channel: string;
    surfaceId: string;
    codeSessionId?: string;
  };
  originalRequest: {
    requestId: string;
    content: string;
    timestamp: number;
  };
  intent: {
    route: IntentGatewayRoute;
    operation: IntentGatewayOperation;
    turnRelation: IntentGatewayTurnRelation;
    resolution: IntentGatewayResolution;
    decisionSource: IntentGatewayDecisionProvenance;
    entities: Record<string, unknown>;
    requiresRepoGrounding: boolean;
    preferredAnswerPath: IntentGatewayPreferredAnswerPath;
  };
  state: 'intake' | 'running' | 'blocked' | 'completed' | 'failed' | 'cancelled';
  rootNodeId: string;
  activeNodeId?: string;
  blockerIds: string[];
  childExecutionIds: string[];
  activeEvidenceBundleIds: string[];
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

interface ExecutionNode {
  nodeId: string;
  executionId: string;
  parentNodeId?: string;
  kind:
    | 'intent_decision'
    | 'entity_resolution'
    | 'grounding'
    | 'tool_execution'
    | 'delegation'
    | 'blocker'
    | 'verification'
    | 'synthesis'
    | 'completion';
  status: 'pending' | 'running' | 'blocked' | 'completed' | 'failed' | 'cancelled';
  summary: string;
  detail?: string;
  evidenceRefs?: string[];
  createdAt: number;
  updatedAt: number;
}
```

This record becomes the authoritative state for:

- retries
- "continue"
- "did that work?"
- approvals
- clarification blockers
- workspace switches
- delegated task lineage
- run timeline correlation

### 2. Continuity becomes execution-backed, not summary-backed

Keep `ContinuityThreadStore`, but demote it to a bounded thread-level projection.

The continuity thread should hold:

- `continuityKey`
- linked surfaces
- safe focus summary
- active execution ids
- currently visible blocker ids
- last safe operator summary

It should stop being the place where semantic continuation is reconstructed from:

- `lastActionableRequest`
- free-text `focusSummary`
- narrow `continuationState.payload`

The continuation algorithm should become:

1. identify explicit execution reference, blocker token, approval id, or surface-bound active execution
2. if exactly one active execution is resumable in the current scope, bind to it
3. if multiple active executions are resumable, ask a bounded clarification that enumerates concrete execution summaries
4. only fall back to `unknown` plus a new gateway pass when no active execution safely matches

### 3. The Intent Gateway regains exclusive semantic authority

The Intent Gateway contract should remain gateway-first, but the remediation must narrow what downstream logic is allowed to do.

Allowed after classification:

- normalize enums
- validate structured outputs
- extract explicit ids, file paths, session ids, provider ids, automation ids, and approval ids
- attach known structured context
- derive execution/capability metadata deterministically

Not allowed after classification:

- re-route the request to a different semantic route based on regex heuristics
- reconstruct "same task" or "that request" from transcript text
- infer rich intent from pending-action prompt text or continuity summary text alone

If a turn is semantically ambiguous after the gateway:

- return `unknown` plus inspect-first handling, or
- create an explicit clarification blocker attached to the active execution, or
- rerun the gateway with execution-backed context

The current post-gateway repair layers should be reduced to one of three roles:

1. malformed-output recovery
2. deterministic explicit-reference extraction
3. route-scoped validation with explicit clarification when required

### 4. Repo grounding becomes an enforceable evidence contract

For `requiresRepoGrounding === true`, synthesis should be blocked unless the execution has a valid evidence bundle.

Suggested evidence bundle:

```ts
interface RepoEvidenceBundle {
  evidenceBundleId: string;
  executionId: string;
  workspaceRoot?: string;
  filesRead: Array<{ path: string; sha?: string }>;
  searchHits: Array<{ query: string; path: string }>;
  commandOutputs: Array<{ tool: string; summary: string }>;
  codeSessionRefs: string[];
  capturedAt: number;
}
```

Rules:

- repo-grounded `inspect`, `search`, and `review` turns cannot complete synthesis without at least one evidence bundle created during the current execution
- evidence creation is satisfied by real repo inspection activity, not by inherited summary text
- execution nodes must record which evidence bundle they consumed for the final synthesis step
- `coding_workflows` can remain a projection of this contract, but not the sole enforcement point

### 5. Delegated workers return typed execution results

Replace free-form delegated result passthrough with a typed contract such as:

```ts
interface DelegatedWorkerResult {
  status: 'completed' | 'blocked' | 'failed';
  userSummary?: string;
  operatorSummary: string;
  evidence: Array<{
    kind: 'file_read' | 'search_hit' | 'tool_result' | 'artifact' | 'note';
    summary: string;
    ref?: string;
  }>;
  blockers: Array<{
    kind: 'approval' | 'clarification' | 'workspace_switch' | 'auth' | 'policy';
    prompt: string;
    token?: string;
  }>;
  nextAction?: string;
  progressEvents?: OrchestrationEvent[];
  artifacts?: Array<{ kind: string; ref: string; summary?: string }>;
}
```

Rules:

- the worker never writes raw user-facing final copy directly into the parent conversation
- the coordinator merges worker evidence, blockers, and summaries into the parent execution state
- raw tool-call markup and model-internal scaffolding are stripped before the user boundary

### 6. Progress gets its own operator-facing event schema

Keep the routing trace as a debug artifact.

Add a separate execution/orchestration event schema for humans:

```ts
interface OrchestrationEvent {
  eventId: string;
  executionId: string;
  nodeId?: string;
  parentExecutionId?: string;
  continuityKey?: string;
  kind:
    | 'execution_started'
    | 'intent_decided'
    | 'grounding_started'
    | 'grounding_progress'
    | 'delegated_to_role'
    | 'awaiting_approval'
    | 'awaiting_clarification'
    | 'awaiting_workspace_switch'
    | 'resumed'
    | 'verification_started'
    | 'synthesis_started'
    | 'completed'
    | 'failed';
  title: string;
  detail?: string;
  roleLabel?: string;
  timestamp: number;
}
```

Examples of source copy:

- `Delegated to Workspace Explorer`
- `Inspecting package.json, src/index.ts, docs/architecture/OVERVIEW.md`
- `Waiting for approval to write docs/plans/...`
- `Resumed after approval`

This schema should drive web chat, CLI, Code, and operator views.

### 7. Role identity becomes first-class in the UI

For delegated work:

- `orchestrationLabel` should be preferred over generic `agentName`
- each child execution should retain its role label
- the parent coordinator remains visible as the owner of the overall execution
- the operator should always be able to distinguish the coordinator from the child specialist

---

## Phased Implementation Plan

### Phase 0: Architecture And Spec Freeze

Goal:

- align docs before code changes scatter across runtime, UI, and worker boundaries

Required updates:

- `docs/design/INTENT-GATEWAY-ROUTING-DESIGN.md`
- `docs/design/RUN-TIMELINE-AND-EVENT-VIEWER-DESIGN.md`
- `docs/design/TOOLS-CONTROL-PLANE-DESIGN.md`
- `docs/design/PENDING-ACTION-ORCHESTRATION-DESIGN.md`
- `docs/design/ORCHESTRATION-DESIGN.md`
- `docs/design/CODING-WORKSPACE-DESIGN.md`
- `docs/architecture/FORWARD-ARCHITECTURE.md`
- `docs/architecture/OVERVIEW.md`

Exit criteria:

- one agreed `ExecutionRecord` model
- one agreed blocker model
- one agreed orchestration event schema
- clear statement that post-gateway semantic rerouting is no longer allowed

### Phase 1: ExecutionStore Foundation And Dual-Write

Goal:

- create the canonical execution subsystem without breaking current surfaces

Implementation areas:

- add `src/runtime/executions/` for store, models, projections, and helpers
- assign `executionId` at request intake
- start dual-writing execution records from the current chat/runtime path
- project execution metadata into existing run timeline, assistant jobs, pending actions, and continuity threads

Compatibility strategy:

- keep `PendingActionStore`, `ContinuityThreadStore`, and `RunTimelineStore` alive as projections
- execution becomes write-authoritative for new turns, while existing readers continue to work

Exit criteria:

- every new request receives an `executionId`
- execution state is persisted
- legacy stores can resolve the same request via projections

### Phase 2: Execution-Backed Blockers And Continuation

Goal:

- remove transcript reconstruction from retry and continuation flow

Implementation areas:

- replace `findMostRecentRetryableHistoricalRequest(...)` and related helper paths with execution lookup
- attach approvals, clarifications, auth prompts, and workspace switches as execution blockers
- store retry lineage explicitly as `retryOfExecutionId`
- make "continue", "resume", "retry", and "did that work?" bind to the current execution or blocker token

Primary files to shrink or replace:

- `src/runtime/chat-agent/intent-gateway-orchestration.ts`
- `src/runtime/pending-action-resume.ts`
- `src/runtime/intent/history-context.ts`
- `src/runtime/continuity-threads.ts`

Exit criteria:

- continuation no longer requires assistant-transcript scanning to find the task being resumed
- blocker resolution re-enters the correct execution deterministically
- ambiguous resumes produce a bounded chooser instead of guessing

### Phase 3: Restore Intent Gateway Authority

Goal:

- make the gateway the only semantic classifier again

Implementation areas:

- narrow `structured-recovery.ts` to malformed-output recovery, enum normalization, and explicit reference extraction
- remove semantic route-repair behavior from `clarification-resolver.ts` where it guesses routes from regexes
- reduce `unstructured-recovery.ts` to bounded fallback recovery only when the classifier output is missing or malformed, not as a secondary semantic router
- move any remaining ambiguous semantic work back into a bounded gateway rerun or explicit clarification blocker

Primary files to reduce:

- `src/runtime/intent/structured-recovery.ts`
- `src/runtime/intent/unstructured-recovery.ts`
- `src/runtime/intent/clarification-resolver.ts`
- `src/runtime/intent/request-patterns.ts`
- `src/runtime/intent/history-context.ts`
- `src/runtime/intent/entity-resolvers/personal-assistant.ts`

Exit criteria:

- downstream deterministic code can no longer silently swap routes based on free-text pattern matching
- route, operation, and turn-relation changes happen only through the gateway or explicit blocker resolution

### Phase 4: Evidence-First Repo-Grounded Execution

Goal:

- make repo grounding a hard execution contract

Implementation areas:

- add evidence bundle creation to repo-grounded tool/read/search steps
- block repo-grounded synthesis when no evidence bundle exists
- attach evidence refs to final synthesis nodes and run timeline items
- align coding workflow state with execution evidence instead of parallel ad hoc state

Primary files:

- `src/runtime/routed-tool-execution.ts`
- `src/runtime/coding-workflows.ts`
- `src/runtime/code-session-request-scope.ts`
- `src/runtime/execution-profiles.ts`

Exit criteria:

- repo-grounded final responses are impossible without evidence
- inspect-first behavior is enforced through execution state, not just prompt wording

### Phase 5: Delegated Worker Handoff V2

Goal:

- turn delegated workers into typed contributors to the parent execution

Implementation areas:

- replace inline passthrough with structured delegated result objects
- record child executions under the parent execution graph
- move worker lifecycle, blockers, evidence, and summaries into execution projections
- ensure only the coordinator writes the user-facing completion message

Primary files:

- `src/supervisor/worker-manager.ts`
- worker-session and broker boundary files
- `src/runtime/assistant-jobs.ts`
- `src/runtime/run-timeline.ts`

Exit criteria:

- raw delegated content is never blindly passed through inline
- child roles, blockers, evidence, and next steps are inspectable as first-class execution state

### Phase 6: Orchestration Events And UI Correlation

Goal:

- make live progress human-readable and execution-aware across surfaces

Implementation areas:

- add `executionId` and `nodeId` to run timeline and chat correlation payloads
- switch chat matching from `{ requestId, parentRunId, codeSessionId }` to `{ executionId, nodeId, continuityKey }` with request id as compatibility fallback
- prefer role labels over generic agent names in UI-facing titles
- replace generic delegated copy with curated operator text

Primary files:

- `src/runtime/run-timeline.ts`
- `web/public/js/chat-panel.js`
- `web/public/js/chat-run-tracking.js`
- CLI rendering code
- dashboard runtime callbacks and channel event types

Exit criteria:

- web chat and CLI subscribe to the right execution reliably
- delegated child work shows the specialist role label
- the operator sees meaningful execution narration instead of generic broker text

### Phase 7: Remove Legacy Heuristics And Collapse Compatibility Shims

Goal:

- stop paying permanent complexity cost for the transition

Implementation areas:

- remove obsolete regex repair paths
- remove `lastActionableRequest`-driven continuation logic from the gateway path
- demote legacy stores to read-only projections temporarily, then delete dead adapters
- update tests and docs to describe the execution-first model as the only supported architecture

Exit criteria:

- the old heuristic continuation and route-repair code is no longer on the main path
- one subsystem owns execution, blockers, progress, and continuation

---

## Recommended Module Layout

Suggested new runtime area:

```text
src/runtime/executions/
  execution-store.ts
  execution-model.ts
  execution-blockers.ts
  execution-evidence.ts
  execution-projections.ts
  execution-events.ts
  execution-resume.ts
  execution-migrations.ts
```

Projection adapters should bridge into:

- `PendingActionStore`
- `ContinuityThreadStore`
- `RunTimelineStore`
- assistant jobs / dashboard operator views

This follows the repo rule that shared orchestration must own blocked work, approvals, clarifications, continuation, and cross-surface behavior.

---

## Plan Relationship To Existing Documents

This remediation plan should consolidate and refocus overlapping work from the following plans:

- `INTENT-GATEWAY-CAPABILITY-PLANE-UPLIFT-PLAN.md`
  - keep the staged gateway/capability split
  - tighten it with a stronger rule that downstream code cannot semantically reroute free text
- `CROSS-SURFACE-CONTINUITY-UPLIFT-PLAN.md`
  - keep the continuity-thread concept
  - change it from the primary continuation substrate into a projection over active executions
- `BACKGROUND-DELEGATION-UPLIFT-PLAN.md`
  - keep delegated lineage and bounded handoff ideas
  - replace inline delegated output with typed execution results
- `WEB-CLI-LIVE-PROGRESS-IMPLEMENTATION-PLAN.md`
  - keep the one-shared-progress-contract direction
  - move correlation from request-id matching to execution-id matching

If this remediation plan is accepted, those plans should be updated to reference this document as the canonical alignment plan for routing, continuation, delegation, and progress state.

---

## Risks And Guardrails

### Primary risks

- dual-write drift between execution state and current legacy stores
- resuming the wrong execution during the migration period
- accidentally breaking approval and workspace-switch behavior while moving blockers
- UI regressions if request-id-only assumptions are removed too early
- documentation drift if specs are not updated before partial code changes land

### Guardrails

- no flag-day replacement of pending actions, continuity threads, or run timeline
- add execution ids first, then migrate behavior, then remove heuristics
- maintain origin-surface approval rules until explicit secure takeover exists
- keep routing trace intact as a parallel debug artifact during the rollout
- require characterization coverage before deleting old continuation code

---

## Verification Plan

### Unit and integration coverage

Add or update tests for:

- execution store persistence and migration
- execution-backed resume and retry resolution
- blocker creation, resolution, and cross-surface visibility
- repo evidence bundle enforcement
- delegated worker structured result handling
- run timeline correlation by `executionId`
- web chat run-matching and specialist-label rendering

### Required repo commands

- `npm run check`
- `npm test`
- focused Vitest runs for touched runtime, supervisor, and web tracking files

### Required harnesses for this architecture change

Because this work touches routing, approvals, coding behavior, and web progress, the implementation phases should include:

- `node scripts/test-coding-assistant.mjs`
- `node scripts/test-code-ui-smoke.mjs`
- `node scripts/test-contextual-security-uplifts.mjs`

Where applicable, also run the real-model lane:

- `HARNESS_USE_REAL_OLLAMA=1 node scripts/test-coding-assistant.mjs --use-ollama`

### Trace validation

For every phase that changes routing, continuation, delegation, or progress correlation, inspect:

- `~/.guardianagent/routing/intent-routing.jsonl`

Confirm that:

- the gateway still classifies every normal turn
- continuation binds to explicit execution ids or blocker tokens
- delegated child work carries execution lineage
- UI-facing progress projections match the underlying execution events

---

## Success Criteria

This remediation is complete when all of the following are true:

1. a normal free-text user turn is semantically classified exactly once by the Intent Gateway
2. continuation, retry, approval resume, and status follow-up bind to `executionId` rather than transcript heuristics
3. repo-grounded synthesis is impossible without execution evidence
4. delegated workers return typed results and no raw internal markup can leak inline
5. web chat, CLI, and operator views follow the same execution using the same correlation ids
6. specialist role labels are visible in progress and timeline views
7. legacy heuristic continuation and semantic-repair layers are no longer on the main path

---

## Recommended Starting Slice

The safest first implementation slice is:

1. spec freeze plus `ExecutionRecord` schema
2. assign `executionId` at intake and dual-write it into current stores
3. convert approvals, clarifications, and workspace switches into execution blockers while keeping the current pending-action projection
4. switch chat/timeline correlation to carry `executionId` alongside existing request ids

That gives the program one durable backbone before it starts removing heuristic routing and continuation code.
