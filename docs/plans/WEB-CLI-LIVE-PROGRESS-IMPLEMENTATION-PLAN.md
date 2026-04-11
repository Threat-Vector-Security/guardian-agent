# Web And CLI Live Progress Implementation Plan

**Status:** Draft  
**Date:** 2026-04-11  
**Primary source proposal:** [Henchmen-Inspired Coding And Orchestration Uplifts Proposal](/mnt/s/Development/GuardianAgent/docs/proposals/HENCHMEN-INSPIRED-CODING-AND-ORCHESTRATION-UPLIFTS-PROPOSAL.md)  
**Related docs:** [WEBUI-DESIGN-SPEC.md](/mnt/s/Development/GuardianAgent/docs/specs/WEBUI-DESIGN-SPEC.md), [CODING-WORKSPACE-SPEC.md](/mnt/s/Development/GuardianAgent/docs/specs/CODING-WORKSPACE-SPEC.md), [FORWARD-ARCHITECTURE.md](/mnt/s/Development/GuardianAgent/docs/architecture/FORWARD-ARCHITECTURE.md), [GENERAL-CHAT-CANONICAL-CODING-SESSIONS-IMPLEMENTATION-PLAN.md](/mnt/s/Development/GuardianAgent/docs/plans/GENERAL-CHAT-CANONICAL-CODING-SESSIONS-IMPLEMENTATION-PLAN.md)

## Objective

Improve the user experience while Guardian is actively working in the Web UI and CLI so the operator sees meaningful forward motion instead of mostly waiting on a spinner or a final reply.

This plan is specifically about live progress UX, not about adding more agents.

The outcome should be:

1. the single persistent web chat feels live during long turns
2. Code remains the richest execution workbench and detail surface, not a second chat
3. CLI shows concise, meaningful progress without log spam
4. Telegram stays intentionally lighter and summary-oriented

## Current State

### What already exists

Guardian already has more streaming and progress infrastructure than the current UX suggests:

- `/api/message/stream` exists in [src/channels/web-chat-routes.ts](/mnt/s/Development/GuardianAgent/src/channels/web-chat-routes.ts)
- `onStreamDispatch` exists in [src/runtime/control-plane/dashboard-runtime-callbacks.ts](/mnt/s/Development/GuardianAgent/src/runtime/control-plane/dashboard-runtime-callbacks.ts)
- the web channel already streams SSE events in [src/channels/web.ts](/mnt/s/Development/GuardianAgent/src/channels/web.ts)
- the chat panel already subscribes to `run.timeline`, `chat.done`, and `chat.error` in [web/public/js/chat-panel.js](/mnt/s/Development/GuardianAgent/web/public/js/chat-panel.js)
- CLI already uses `onStreamDispatch` and renders request-scoped progress snapshots from `run.timeline` in [src/channels/cli.ts](/mnt/s/Development/GuardianAgent/src/channels/cli.ts)
- the Code page already renders timeline and terminal activity in [web/public/js/pages/code.js](/mnt/s/Development/GuardianAgent/web/public/js/pages/code.js)

### What is still weak

The current user experience still feels too passive because the semantics of progress are thin.

Current gaps:

- the persistent web chat mostly shows a thinking indicator plus whatever `run.timeline` already happens to emit
- the richer SSE event shapes in [src/channels/web-types.ts](/mnt/s/Development/GuardianAgent/src/channels/web-types.ts) such as `chat.tool_call` and `chat.token` exist but are not materially used
- [src/runtime/coding-backend-service.ts](/mnt/s/Development/GuardianAgent/src/runtime/coding-backend-service.ts) mostly buffers terminal output and resolves on exit rather than emitting structured backend progress
- web chat and CLI are progress-aware, but they do not yet receive a strong shared vocabulary like "reading repo", "editing", "running checks", "awaiting approval", or "summarizing"
- Telegram currently uses typing indicators, chunked replies, and approval updates in [src/channels/telegram.ts](/mnt/s/Development/GuardianAgent/src/channels/telegram.ts), which is acceptable for remote one-shot use, but not suitable as a high-frequency live-console surface

## Product Position

### Web UI

The Web UI is the primary interactive operator surface.

There is only one web chat surface: the persistent shell chat.

The Code page is not a separate coding chat. It is the richer coding workbench and detail surface for the same underlying assistant activity.

Implications:

- the persistent chat should show compact, request-scoped progress
- Code should remain the richest place to inspect active work, timelines, terminals, approvals, and verification
- the user should be able to tell whether Guardian is planning, reading, editing, verifying, blocked, or done
- the user should not have to mentally model "general chat" versus "coding chat" inside the web product

### CLI

The CLI is also an interactive operator surface.

Implications:

- it should receive the same live semantic progress as web
- output must stay concise and deduplicated
- it should prefer progress snapshots over noisy raw logs

### Telegram

Telegram should stay lightweight.

Recommended stance:

- keep it oriented toward short remote requests, approvals, and final outcomes
- do not try to replicate a live timeline console there
- optionally add one or two status updates for long-running or blocked work, but not high-frequency streaming

This matches the transport and the product expectation better than trying to mirror the full web/CLI experience.

## Architectural Decision

Use one shared progress contract and project it into different surfaces.

That means:

- shared runtime semantics
- channel-specific rendering
- no bespoke progress state machines in each client

### Canonical shared backbone

Use [src/runtime/run-timeline.ts](/mnt/s/Development/GuardianAgent/src/runtime/run-timeline.ts) as the canonical progress spine.

Do not create a separate web-only or CLI-only progress model.
Do not create a separate coding-chat progress model inside the Web UI.

### Shared orchestration rule

Progress for blocked work, approvals, clarifications, verification, and coding backends should flow through shared runtime state first:

- `IntentGateway`
- `PendingActionStore`
- `RunTimelineStore`
- code-session work state
- assistant jobs where needed

This follows the repo rule that shared orchestration should own cross-surface behavior instead of per-feature custom flows.

### Meaningful updates over token streaming

The primary goal is not token-by-token answer streaming.

The primary goal is:

- meaningful state changes
- bounded output excerpts where useful
- visible blockers
- visible verification steps
- visible completion/failure transitions

Raw token streaming can remain optional or deferred. It is not the main UX win.

### Running commentary first, answer streaming second

This uplift intentionally prioritizes semantic live commentary over incremental LLM text streaming.

Initial product intent:

- stream meaningful progress states first
- keep the final answer path stable
- avoid mixing half-formed answer text with execution-state messaging until the shared progress model is solid

If incremental answer streaming is added later, it should be:

- in the same single web chat bubble, not a different chat surface
- clearly secondary to progress semantics
- tolerant of cancellations, approvals, retries, and route/provider failover
- optional for CLI rather than mandatory

For this implementation plan, the baseline assumption is:

- progress commentary streams live
- final assistant text still lands as a completed response at the end

## Target End State

By the end of this plan:

- the single web chat shows a compact live progress card instead of a mostly static spinner
- Code shows the same run with richer timeline detail and terminal drill-down
- CLI prints concise progress lines for meaningful state changes only
- coding backend runs such as Codex or Claude Code appear as first-class live work, not just terminal subprocesses
- Telegram remains simple: typing, blocker, approval, and final result, with at most a minimal long-running status update
- the operator does not have to switch between different chat surfaces to understand what the assistant is doing

## Phase 1: Define A Shared Progress Event Contract

### Goal

Make progress semantics explicit before changing any UI.

### Deliver

Add a shared internal progress event model for request-scoped work.

Suggested shape:

- `requestId`
- `runId`
- `groupId`
- `channel`
- `agentId`
- `codeSessionId`
- `source`
- `phase`
- `title`
- `detail`
- `status`
- `terminalId?`
- `jobId?`
- `approvalId?`
- `verificationKind?`
- `artifactRefs?`

Suggested phase vocabulary:

- `starting`
- `reading_context`
- `planning`
- `editing`
- `running_tool`
- `running_checks`
- `awaiting_approval`
- `awaiting_input`
- `summarizing`
- `completed`
- `failed`

### Design rule

The event contract should be richer than today's generic note stream, but narrower than raw logs.

### Likely implementation areas

- [src/runtime/run-timeline.ts](/mnt/s/Development/GuardianAgent/src/runtime/run-timeline.ts)
- [src/runtime/orchestrator.ts](/mnt/s/Development/GuardianAgent/src/runtime/orchestrator.ts)
- [src/runtime/control-plane/dashboard-runtime-callbacks.ts](/mnt/s/Development/GuardianAgent/src/runtime/control-plane/dashboard-runtime-callbacks.ts)
- [src/channels/web-types.ts](/mnt/s/Development/GuardianAgent/src/channels/web-types.ts)

### Exit criteria

- one shared progress vocabulary exists for assistant turns
- a request can be matched to meaningful state transitions without text scraping
- web and CLI can consume the same stream without custom inference logic

## Phase 2: Instrument Coding Backends And Long-Running Execution

### Goal

Make backend-driven coding work visible as structured progress.

### Deliver

Extend [src/runtime/coding-backend-service.ts](/mnt/s/Development/GuardianAgent/src/runtime/coding-backend-service.ts) so backend runs emit structured progress into the shared contract.

Minimum events:

- backend session started
- backend phase changed
- backend waiting on approval or input
- backend verification started/finished
- backend completed/failed/timed out

Optional bounded event:

- backend output excerpt, throttled and truncated

### Initial implementation approach

Do not block on backend-specific SDKs or deep protocol integrations.

Start with a pragmatic two-layer approach:

1. generic PTY-backed lifecycle events from the existing coding backend service
2. optional backend-specific enrichers later for Codex/Claude/Gemini CLI when available

### Important rule

Raw terminal output should remain a drill-down surface, not the primary chat/CLI progress channel.

### Additional integration targets

Also instrument other visibly long-running paths where the operator currently waits with little feedback:

- approval continuation
- long tool runs
- verification runs
- code-session-heavy repo inspection

### Likely implementation areas

- [src/runtime/coding-backend-service.ts](/mnt/s/Development/GuardianAgent/src/runtime/coding-backend-service.ts)
- [src/tools/executor.ts](/mnt/s/Development/GuardianAgent/src/tools/executor.ts)
- [src/runtime/code-sessions.ts](/mnt/s/Development/GuardianAgent/src/runtime/code-sessions.ts)
- [src/runtime/pending-actions.ts](/mnt/s/Development/GuardianAgent/src/runtime/pending-actions.ts)
- [src/runtime/run-timeline.ts](/mnt/s/Development/GuardianAgent/src/runtime/run-timeline.ts)

### Exit criteria

- a coding backend run generates visible phase changes before exit
- approval waits and verification phases are explicit
- the system no longer relies on final buffered subprocess output as the primary story

## Phase 3: Upgrade Web Chat And Code UX

### Goal

Turn existing streaming into a clearer operator experience in the Web UI.

### Deliver

Replace the passive chat thinking indicator with a compact live-progress card in [web/public/js/chat-panel.js](/mnt/s/Development/GuardianAgent/web/public/js/chat-panel.js).

Suggested behavior:

- show current phase title
- show short detail text
- update in place as the run progresses
- optionally show the latest 2-3 meaningful progress items
- highlight blocked states like approval or verification pending

This card belongs to the single persistent web chat. It should not branch into a separate coding-chat experience on the Code page.

Keep Code as the richer workbench:

- detailed timeline remains on the Code page
- terminal output remains available there
- approvals, verification, and changed files stay code-session-scoped
- Code may deep-link back to the active run or current code session, but it should not pretend to be a second chat stream

### Web design constraints

Follow [WEBUI-DESIGN-SPEC.md](/mnt/s/Development/GuardianAgent/docs/specs/WEBUI-DESIGN-SPEC.md):

- chat panel stays a shell surface, not a duplicate control plane
- Code remains the canonical page for coding-session activity
- summaries in chat should stay compact and navigational, not become a second full run console

### Likely implementation areas

- [web/public/js/chat-panel.js](/mnt/s/Development/GuardianAgent/web/public/js/chat-panel.js)
- [web/public/js/pages/code.js](/mnt/s/Development/GuardianAgent/web/public/js/pages/code.js)
- [web/public/js/app.js](/mnt/s/Development/GuardianAgent/web/public/js/app.js)
- [src/channels/web.ts](/mnt/s/Development/GuardianAgent/src/channels/web.ts)
- [src/channels/web-types.ts](/mnt/s/Development/GuardianAgent/src/channels/web-types.ts)

### Exit criteria

- web chat clearly shows meaningful progress during long turns
- Code remains the detailed execution workbench
- the user can tell whether the system is working, blocked, verifying, or finished without opening a terminal by default
- there is still only one web chat surface in the product model

## Phase 4: Tighten CLI Progress Rendering

### Goal

Make CLI progress feel alive without becoming noisy.

### Deliver

Build on [src/channels/cli.ts](/mnt/s/Development/GuardianAgent/src/channels/cli.ts), which already consumes `run.timeline`, and improve:

- phase naming
- deduplication
- blocker rendering
- verification rendering
- coding backend status rendering

Recommended output style:

- one progress line per meaningful transition
- short detail suffix when useful
- stronger formatting for approval waits, failures, and verification

Do not:

- print raw token streams
- mirror every timeline item
- dump terminal output into the main chat flow by default

### Likely implementation areas

- [src/channels/cli.ts](/mnt/s/Development/GuardianAgent/src/channels/cli.ts)
- [src/runtime/run-timeline.ts](/mnt/s/Development/GuardianAgent/src/runtime/run-timeline.ts)
- [src/runtime/control-plane/dashboard-runtime-callbacks.ts](/mnt/s/Development/GuardianAgent/src/runtime/control-plane/dashboard-runtime-callbacks.ts)

### Exit criteria

- CLI shows progress for long requests without overwhelming the user
- the operator can distinguish normal work, blockers, verification, and failures
- output remains compact enough for daily terminal use

## Phase 5: Keep Telegram Minimal And Intentional

### Goal

Avoid overbuilding Telegram while still improving clarity for remote use.

### Recommendation

Keep Telegram as summary-first.

Retain:

- `typing` indicators
- chunked final responses
- approval buttons and approval-state edits

Optionally add one minimal long-running update:

- if a task exceeds a threshold, send one "still working" message
- if the request becomes blocked on approval or input, edit or append one clear status line

Do not add:

- high-frequency timeline streaming
- terminal mirroring
- verbose multi-step progress logs

### Why

Telegram is better treated as remote operator access, not as the main live-console surface.

### Likely implementation areas

- [src/channels/telegram.ts](/mnt/s/Development/GuardianAgent/src/channels/telegram.ts)

### Exit criteria

- Telegram remains simple
- long waits are less ambiguous
- there is no attempt to force full web/CLI parity onto the Telegram surface

## Non-Goals

This plan does not include:

- chain-of-thought exposure
- token-by-token answer streaming as the primary UX goal
- raw terminal mirroring into web chat or CLI by default
- a Telegram live-run console
- a second progress architecture separate from `run.timeline`
- per-channel bespoke blocker/resume logic

## Verification Plan

### Automated

Add or update tests for:

- run timeline event mapping and request matching
- coding backend progress emission
- web stream dispatch and cancellation behavior
- CLI progress rendering snapshots or equivalent assertions
- Telegram long-running/blocker behavior if minimal status updates are added

Likely test areas:

- `src/runtime/run-timeline.test.ts`
- `src/runtime/coding-backend-service.test.ts`
- `src/runtime/control-plane/dashboard-runtime-callbacks.test.ts`
- `src/channels/channels.test.ts`
- `src/channels/cli.ts` focused tests if present or newly added

### Harness and manual

Run the relevant harnesses after implementation:

- `node scripts/test-coding-assistant.mjs`
- `node scripts/test-code-ui-smoke.mjs`

Manual verification should cover:

- web chat long request
- Code page active coding session
- CLI long request with approval wait
- coding backend run in Code session
- Telegram normal request
- Telegram approval flow

## Delivery Order

1. shared progress contract
2. coding backend and long-run instrumentation
3. web chat and Code rendering uplift
4. CLI rendering uplift
5. optional Telegram minimal-status refinement

## Final Recommendation

Do not spend this effort on inventing more agents.

Spend it on making existing work visible:

- one shared progress contract
- one canonical run-timeline backbone
- compact progress in the single web chat
- rich execution detail in Code as the workbench, not as a separate chat
- concise progress in CLI
- intentionally limited status in Telegram

That will materially improve the operator experience without fighting Guardian's current architecture.
