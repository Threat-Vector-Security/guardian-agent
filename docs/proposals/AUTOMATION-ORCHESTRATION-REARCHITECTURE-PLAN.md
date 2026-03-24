# Automation And Orchestration Re-Architecture Plan

**Date:** 2026-03-24  
**Status:** In Progress  
**Owner:** GuardianAgent runtime

## Goal

Replace brittle message-pattern routing for automation, browser, and UI-control requests with a typed control-plane architecture built around:

- explicit intent classification
- typed automation specifications
- durable execution state
- one automation domain model across chat and web UI
- operator-visible timeline, approvals, and takeover state

## Problem Statement

The current path mixes overlapping concerns across:

- direct browser pre-routing in `src/runtime/browser-prerouter.ts`
- automation authoring heuristics in `src/runtime/automation-authoring.ts`
- automation execution in `src/runtime/automation-prerouter.ts`
- early-return route order in `src/index.ts`
- web catalog reconstruction in `web/public/js/pages/automations.js`

This creates four failure modes:

1. small wording changes change system behavior
2. create/update/delete/run/toggle requests can drift between automation and browser paths
3. chat and UI do not operate on one canonical automation object model
4. approvals, takeovers, and run visibility are attached after the fact instead of being first-class runtime states

## Design Principles

- No regex or keyword matching as the primary routing authority
- No split ownership between chat authoring and UI mutation semantics
- No separate workflow/task mental models at the product surface
- No non-durable pause/resume semantics
- Keep Guardian's existing approval, audit, SSRF, sandbox, and policy boundaries

## Target Architecture

### 1. Intent Gateway

A single typed gateway classifies incoming requests into one of:

- `automation_authoring`
- `automation_control`
- `ui_control`
- `browser_task`
- `general_assistant`

Requirements:

- schema-constrained structured output
- confidence + rationale
- canonical operation extraction such as `create`, `update`, `delete`, `run`, `toggle`, `clone`, `inspect`
- no tool execution at classification time

### 2. Automation Spec V2

Replace heuristic compilation with a typed draftable specification:

- identity: `name`, `description`, `labels`
- trigger: `manual`, `schedule`, `event`
- execution style: `deterministic_workflow`, `assistant_runbook`, `hybrid`
- inputs and artifacts
- capabilities and policy requirements
- approval points
- takeover points
- browser/session requirements

Compile failures must produce structured missing-field results, never `null`.

### 3. Unified Automation Domain

Replace split workflow/task handling with one domain model:

- `AutomationDefinition`
- `AutomationRun`
- `AutomationArtifact`
- `AutomationApprovalState`
- `AutomationTakeoverState`

Schedules and manual execution are trigger modes, not different product objects.

### 4. Durable Runtime

All runs become state machines with persisted transitions:

- `draft`
- `ready`
- `running`
- `awaiting_approval`
- `takeover_required`
- `paused`
- `completed`
- `failed`
- `cancelled`

### 5. Operator Surface

The web UI becomes a control-plane client, not a reconstruction layer.

It must show:

- definitions
- runs
- timeline
- approvals
- takeover/resume
- artifacts

## Implementation Phases

## Phase 1: Intent Gateway In Shadow Mode

### Deliver

- new `IntentGateway` with schema-constrained classification
- no production routing changes yet
- shadow classification attached to current automation/browser entry points
- logs and response metadata for comparison against current behavior
- focused tests around classifier parsing and failure handling

### Exit Criteria

- Guardian can classify candidate requests into the target route set without affecting live routing
- shadow records clearly show where current routing disagrees with the new gateway
- no user-visible regression in automation or browser handling

## Phase 2: Automation Spec V2

### Deliver

- new typed `AutomationSpecV2`
- slot-filling / missing-field result model
- authoring compiler that produces drafts and validated specs
- explicit conversion into control-plane mutations

### Exit Criteria

- authoring never falls through to browser routing
- incomplete requests return structured clarification targets
- manual, scheduled, and hybrid requests are represented without heuristic shape guessing

## Phase 3: Unified Automation Domain Service

### Deliver

- one backend service for create/update/delete/run/toggle/clone/pause/resume
- one storage model for workflows and assistant automations
- migration adapter from legacy workflow/task objects
- one API contract used by both chat and web UI

### Exit Criteria

- UI and chat mutate the same backend objects
- enable/disable/delete/run behavior is consistent across all automation types

## Phase 4: Durable Run Engine

### Deliver

- durable run store with checkpointing
- explicit approval and takeover runtime states
- resumable execution context
- canonical run timeline events

### Exit Criteria

- approval and takeover are runtime states, not string-level conventions
- resumed runs continue safely without replaying unsafe side effects

## Phase 5: Operator And Browser Integration

### Deliver

- browser operator nodes with DOM-first, vision-fallback execution
- persistent browser session/run artifact model
- timeline playback for browser and automation runs
- user takeover/resume UI

### Exit Criteria

- browser automation is a first-class run surface
- operator-visible evidence exists for every browser-affecting run

## Phase 6: Cutover And Deletion

### Deliver

- route production traffic through `IntentGateway`
- delete legacy pre-routing heuristics
- remove duplicated workflow/task UI reconstruction
- update docs and reference guide

### Exit Criteria

- `automation-authoring.ts` no longer owns top-level route selection
- `browser-prerouter.ts` no longer acts as a competing message classifier
- `automations.js` no longer merges separate workflow/task models client-side

## Deletion Targets

These are expected to shrink drastically or be removed by the end state:

- `src/runtime/browser-prerouter.ts`
- `src/runtime/automation-prerouter.ts`
- top-level heuristic routing in `src/runtime/automation-authoring.ts`
- workflow/task split reconstruction logic in `web/public/js/pages/automations.js`

## Verification Strategy

- golden prompt suite for authoring/control/browser/UI requests
- shadow comparison between legacy route and `IntentGateway`
- approval/takeover/resume integration tests
- UI mutation contract tests for toggle/delete/run/clone
- regression prompts from real operator failures

## Current Work

This change set starts Phase 1 only, and expands shadow classification across the current direct-action surfaces in chat:

- filesystem search
- scheduled email automation creation
- automation authoring
- workspace read/write shortcuts
- browser task shortcuts
- direct web search
