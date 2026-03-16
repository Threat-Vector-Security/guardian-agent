# Orchestration Specification

**Status:** Implemented

This document replaces the older split between "assistant orchestrator" and "orchestration agents". Guardian now has five orchestration layers, and they solve different problems.

## 1. Authoring Orchestration

**Files:** `src/runtime/automation-authoring.ts`, `src/runtime/automation-prerouter.ts`, `src/index.ts`, `src/supervisor/worker-manager.ts`, `src/worker/worker-session.ts`

This is the natural-language-to-automation compiler path.

- Detects when the user is asking Guardian to create a workflow, automation, or scheduled task
- Runs through one shared pre-router before either the direct runtime path or the supervisor-managed brokered path enters generic LLM tool use
- Builds a typed `AutomationIR` first, then applies repair and validation before compiling native control-plane mutations
- Extracts schedule language and hard constraints such as `using built-in tools only` or `not a script`
- Chooses the right native automation shape:
  - deterministic fixed graph => workflow
  - open-ended recurring assistant work => scheduled `agent` task
- Compiles directly into `workflow_upsert`, `task_create`, or `task_update`
- Keeps approval, verification, and audit inside the normal tool control plane

This layer exists so "create an automation" becomes a native Guardian object instead of a shell script or code artifact.
It is now authoritative across both main and brokered execution paths, so agent isolation does not change automation authoring semantics.

## 2. Request Orchestration

**Files:** `src/runtime/orchestrator.ts`, `src/runtime/assistant-jobs.ts`

This is the assistant/session control plane.

- Serializes requests per session: `<channel>:<canonicalUserId>:<agentId>`
- Allows different sessions to run in parallel
- Tracks queue depth, latency, recent traces, and background jobs
- Is used by normal chat dispatch, quick actions, and scheduled assistant turns

It does **not** decide multi-agent workflow structure. It only controls when work is admitted and how it is observed.

## 3. Deterministic Workflow Runtime

**Files:** `src/runtime/connectors.ts`, `src/runtime/graph-runner.ts`, `src/runtime/graph-types.ts`, `src/runtime/run-state-store.ts`, `src/runtime/run-events.ts`

This is the graph-backed execution layer for deterministic workflows.

- compiles playbooks into graph nodes
- emits per-run `runId`
- checkpoints node completion state
- records orchestration events such as node start/completion and approval interrupts
- provides the basis for future resume/replay-safe deterministic automations

This is where Guardian borrows most directly from graph-runtime systems without adopting an external framework wholesale.

## 4. Scheduled Orchestration

**Files:** `src/runtime/scheduled-tasks.ts`, `src/runtime/connectors.ts`

This is the recurring automation layer.

- `type: "tool"` runs one tool on cron
- `type: "playbook"` runs a deterministic workflow on cron
- `type: "agent"` runs a scheduled assistant turn on cron
- `runOnce: true` turns any scheduled task into a one-shot job that disables itself after the first execution

Important distinction:

- Playbook `tool` steps execute a built-in tool or connector action
- Playbook `instruction` steps are text-only LLM synthesis inside a deterministic workflow
- Playbook `delay` steps pause the sequential pipeline for a specified duration (`delayMs`), useful for rate-limiting or cooldown between steps. In dry-run mode, delay steps return synthetic success without sleeping.
- Agent tasks dispatch a real assistant turn, so they can use skills, memory, tools, and the normal Guardian/runtime path

This is the right layer for:

- morning briefings
- recurring posture checks
- scheduled monitoring summaries
- personal-assistant reminders that must inspect multiple systems before replying
- one-time scheduled actions such as "send this email tonight once"

Approval model:

- the user approves the automation definition when it is created or updated
- the saved task records bounded authority metadata: approval expiry, approving principal, scope hash, and runaway budgets
- later scheduled executions are allowed only while that authority is still valid
- meaningful scope drift, approval expiry, repeated failures/denials, or budget exhaustion pause or block later execution
- scheduled runs now carry `runId` and orchestration events so recurring automation history is easier to inspect and correlate
- scheduled tasks hold an active-run lock, so the same automation cannot overlap itself and duplicate side effects

In plain terms:
- approval happens up front when the automation is saved
- that approval is meant to cover the bounded expected actions of the saved automation
- later runs should not keep asking again for those same expected in-scope actions
- later runs should still stop if the automation drifts, expires, exceeds budget, or attempts something outside the approved scope

## 5. Agent Composition

**Files:** `src/agent/orchestration.ts`, `src/agent/conditional.ts`

This is structured multi-agent composition inside one invocation.

- `SequentialAgent`
- `ParallelAgent`
- `LoopAgent`
- `ConditionalAgent`

Every sub-agent call still goes through `ctx.dispatch()` and then `Runtime.dispatchMessage()`, so Guardian admission and output controls remain intact.
When a step declares a handoff contract, runtime code validates it, applies context filtering (`full`, `summary_only`, `user_only`), preserves or strips taint deliberately, and blocks approval-gated or capability-invalid handoffs before the target agent runs.

## Runtime Model

```text
Scheduled trigger / user message
  -> Optional authoring orchestration
  -> Request orchestration
  -> Optional graph runtime for deterministic workflows
  -> Runtime dispatch
  -> Optional agent composition
  -> Tools / providers / sub-agents
```

For scheduled assistant automations, Guardian now follows the OpenClaw-style pattern more closely:

- cron wakes a real assistant turn
- the turn uses the same skill/tool stack as interactive chat
- the result can be delivered back through supported channels
- the turn inherits bounded schedule authority rather than indefinite background approval

## Guidance

- Use **playbooks** when the steps should be explicit and repeatable (tool steps for actions, instruction steps for LLM synthesis, delay steps for pacing)
- Use **agent tasks** when the assistant should decide what to inspect at runtime and produce a report
- Use the **automation authoring compiler** when the user is asking Guardian to create/update an automation object conversationally
- Use **handoff contracts and orchestration events** when extending multi-agent delegation or resume/approval flows, rather than introducing new ad hoc session-side mechanisms
- Use **orchestration agents** when developers need reusable multi-agent control flow inside one request
