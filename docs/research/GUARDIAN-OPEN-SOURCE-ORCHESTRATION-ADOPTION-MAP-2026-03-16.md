# Guardian Open-Source Orchestration Adoption Map

Date: 2026-03-16

## Goal

Turn the open-source repo survey into a concrete adoption map for Guardian Agent.

This document answers:
- which repos are worth borrowing from
- what specific concepts are worth copying
- where those concepts fit in Guardian's current codebase
- what not to copy because Guardian already has stronger security/control-plane behavior
- what implementation order gives the best maturity uplift without replacing the whole runtime

This is not a proposal to swap Guardian onto another framework. The recommendation is selective adoption on top of Guardian's existing security, approvals, policy, taint, brokered worker isolation, and automation compiler.

## Bottom Line

Guardian should keep its own:
- policy and approval enforcement
- contextual-security and taint controls
- brokered execution boundary
- tool control plane
- automation readiness validation

Guardian should selectively borrow:
- graph execution, checkpoint, and interrupt/resume ideas from `langgraphjs`
- handoff, guardrail staging, and trace semantics from `openai-agents-js`
- primitive separation, suspend/resume UX, and eval discipline from `mastra`
- durability/replay ideas from `temporal`
- contract-first validation patterns from `pydantic-ai`

The highest-value near-term move is not "more prompt tuning." It is to evolve Guardian from:

`automation compiler -> task/workflow save -> runtime execution`

into:

`model-authored automation IR -> deterministic validator/repair loop -> compiled task/workflow/graph -> checkpointed runtime -> trace/evals`

## Current Guardian Baseline

Relevant current modules:
- `src/runtime/automation-prerouter.ts`
- `src/runtime/automation-authoring.ts`
- `src/runtime/automation-validation.ts`
- `src/runtime/scheduled-tasks.ts`
- `src/runtime/workflows.ts`
- `src/runtime/orchestrator.ts`
- `src/supervisor/worker-manager.ts`
- `src/worker/worker-session.ts`
- `src/tools/executor.ts`

Current strengths:
- compiler-first conversational automation creation
- execution-readiness validation before automation save
- strong approval and policy enforcement
- brokered worker isolation
- existing request-level traces
- scheduled assistant tasks, workflows, and single-tool automations

Current gaps:
- workflow runtime is still closer to "saved definition + later execution" than a first-class graph runtime
- no explicit checkpointed graph execution model for long-running automations
- handoffs and agent delegation are not yet a formal contract surface
- traces are useful, but not yet a richer run/span model across handoffs, approvals, and resumptions
- semantic automation authoring is still too heuristic and code-driven; it needs a typed IR plus repair loop

## Best Repos To Borrow From

### 1. LangGraphJS

Local clone:
- `/mnt/s/Development/agentic-orchestration-repos/langgraphjs`

Best ideas to borrow:
- `StateGraph`-style explicit graph runtime
- checkpointer-backed execution state
- `thread_id` / run identity separation from generic chat session identity
- interrupt/resume as a first-class runtime event
- subgraphs for nested or reusable automation fragments

Evidence in local clone:
- `README.md` describes LangGraphJS as a low-level orchestration framework for controllable agents with long-term memory and human-in-the-loop
- examples and docs reference `StateGraph`, `MemorySaver`, `interrupt`, `resume`, `thread_id`, and checkpointing

### 2. OpenAI Agents SDK JS

Local clone:
- `/mnt/s/Development/agentic-orchestration-repos/openai-agents-js`

Best ideas to borrow:
- explicit handoff contract instead of implicit agent-to-agent delegation
- layered guardrail model around input, tool use, output, and handoff boundaries
- session/run separation
- trace grouping and span metadata that survive multi-step orchestration

Evidence in local clone:
- `README.md` centers the design around agents, handoffs, tools, guardrails, sessions, and tracing
- examples show handoff filtering and controlled delegation

### 3. Mastra

Local clone:
- `/mnt/s/Development/agentic-orchestration-repos/mastra`

Best ideas to borrow:
- explicit split between agent, workflow, and tool primitives
- workflow composition semantics (`then`, `branch`, `parallel`)
- suspend/resume backed by storage
- observability/evals treated as built-in, not optional extras
- validation-aware routing between primitives

Evidence in local clone:
- `README.md` explicitly separates agents from graph-based workflows
- explorations include routing-agent logic and validation bridges
- workflow test utilities encode suspended/resumed workflow states as normal runtime behavior

### 4. Temporal

Local clone:
- `/mnt/s/Development/agentic-orchestration-repos/temporal`

Best ideas to borrow:
- durable execution mindset
- replay-safe orchestration logic
- activity vs workflow separation
- idempotent retries and compensation thinking

Use selectively:
- do not pull in Temporal's full operational footprint unless Guardian outgrows its current scheduler/runtime

### 5. PydanticAI

Local clone:
- `/mnt/s/Development/agentic-orchestration-repos/pydantic-ai`

Best ideas to borrow:
- model-authored structured output as a first-class contract
- validation and retry discipline when model output does not meet schema
- eval/test style for structured agent behavior

## Borrow Matrix

| Repo | Borrow | Guardian Target | Do Not Copy |
| --- | --- | --- | --- |
| `langgraphjs` | graph runtime, checkpoints, interrupts, subgraphs | `src/runtime/workflows.ts`, `src/runtime/scheduled-tasks.ts`, new `src/runtime/graph-runner.ts`, `src/runtime/run-state-store.ts` | LangChain-specific composition assumptions |
| `openai-agents-js` | handoffs, guardrail stages, trace spans, sessions | `src/runtime/orchestrator.ts`, new `src/runtime/handoffs.ts`, `src/tools/executor.ts`, `src/supervisor/worker-manager.ts` | provider-specific runtime assumptions |
| `mastra` | agent/workflow/tool primitive split, suspend/resume UX, built-in eval discipline | `src/runtime/automation-prerouter.ts`, `src/runtime/automation-authoring.ts`, `src/runtime/scheduled-tasks.ts`, web automations UI | broad framework/platform layers Guardian does not need |
| `temporal` | durable execution, replay/idempotency mindset | `src/runtime/scheduled-tasks.ts`, `src/runtime/orchestrator.ts`, queue/retry path | full Temporal infrastructure unless later justified |
| `pydantic-ai` | contract-first IR generation and validation retries | `src/runtime/automation-authoring.ts`, `src/runtime/automation-validation.ts`, compiler harness/tests | Python-specific framework behavior |

## Concrete Guardian Mapping

### A. Replace Heuristic Automation Authoring With Typed IR + Repair Loop

Current modules:
- `src/runtime/automation-prerouter.ts`
- `src/runtime/automation-authoring.ts`
- `src/runtime/automation-validation.ts`

What to add:
- `src/runtime/automation-ir.ts`
- `src/runtime/automation-ir-validator.ts`
- `src/runtime/automation-ir-repair.ts`

Borrow from:
- `pydantic-ai` for structured generation + validation retries
- `mastra` for primitive classification: `agent | workflow | tool`

Recommended shape:
- compiler does not directly emit `task_create` or `workflow_upsert`
- compiler first emits a typed `AutomationIR`
- validator returns structured blockers and warnings
- repair loop can re-ask the model to revise the IR instead of pushing more semantic logic into hardcoded heuristics
- only validated IR compiles into control-plane mutations

Why:
- preserves code ownership of safety/readiness
- moves semantic interpretation back toward the model, but under schema and validator control

### B. Introduce A First-Class Graph Runtime

Current modules:
- `src/runtime/workflows.ts`
- `src/runtime/scheduled-tasks.ts`

What to add:
- `src/runtime/graph-runner.ts`
- `src/runtime/graph-types.ts`
- `src/runtime/run-state-store.ts`
- `src/runtime/graph-checkpoints.ts`

Borrow from:
- `langgraphjs`
- `mastra`

Recommended behavior:
- deterministic workflows compile into a graph representation, not only a static step array
- graph execution persists run state after each node
- nodes may be:
  - tool execution
  - instruction/model transform
  - branch
  - parallel fan-out
  - join
  - approval interrupt
  - resume command

Why:
- gives Guardian a durable execution model for real orchestration
- makes pause/resume and run inspection much cleaner
- enables richer workflow authoring later without redoing the runtime

### C. Formalize Interrupt / Resume / Approval As Runtime Events

Current modules:
- `src/tools/executor.ts`
- `src/runtime/scheduled-tasks.ts`
- `src/supervisor/worker-manager.ts`
- `src/worker/worker-session.ts`

What to add:
- `src/runtime/run-events.ts`
- `src/runtime/approval-interrupts.ts`

Borrow from:
- `langgraphjs` interrupt/resume model
- `openai-agents-js` human-in-the-loop staging

Recommended behavior:
- approval is not only a tool-side pause; it becomes a normal run-state transition
- scheduled assistant tasks, workflows, and future handoffs can all suspend into the same event model
- resume commands operate against run ids/checkpoint ids, not just ad hoc session state

Why:
- current approval handling works, but is not yet a unified orchestration primitive

### D. Add Formal Handoffs Instead Of Implicit Delegation

Current modules:
- `src/runtime/orchestrator.ts`
- `src/supervisor/worker-manager.ts`

What to add:
- `src/runtime/handoffs.ts`
- `src/runtime/handoff-policy.ts`

Borrow from:
- `openai-agents-js`
- `agent-squad` later, if needed

Recommended behavior:
- define typed handoff contracts:
  - source agent
  - target agent
  - allowed capability set
  - message/context filter
  - taint/provenance propagation rules
- traces and audit should show handoff boundaries explicitly

Why:
- multi-agent orchestration becomes clearer and safer
- easier to reason about bounded authority and context minimization

### E. Upgrade Trace Model From Request Trace To Orchestration Trace

Current module:
- `src/runtime/orchestrator.ts`

Borrow from:
- `openai-agents-js` tracing
- `mastra` observability/evals discipline

Recommended uplift:
- keep current request traces, but add richer span types:
  - compiler
  - validator
  - save
  - graph node
  - handoff
  - approval interrupt
  - resume
  - postcondition verification
- add a stable `runId`, `groupId`, and `parentRunId`
- make traces survive scheduled executions and resumptions

Why:
- current traces are useful for debugging requests
- orchestration needs traces that also explain runtime evolution across time

### F. Make Scheduled Assistant Tasks More Durable And Replay-Safe

Current module:
- `src/runtime/scheduled-tasks.ts`

Borrow from:
- `temporal`
- `langgraphjs`

Recommended uplift:
- split orchestration decisions from effectful activity execution
- persist retry metadata and idempotency keys
- make repeated scheduled runs more replay-safe
- ensure resuming a suspended run cannot accidentally duplicate prior side effects

Why:
- scheduled assistant tasks are now powerful enough that they need stronger durability semantics

## What Guardian Should Not Outsource

Guardian should keep these native:
- `src/tools/executor.ts` as the authoritative policy/approval gate
- contextual trust and taint classification
- brokered worker isolation and capability controls
- memory trust/quarantine model
- schedule bounded-authority enforcement
- postcondition verification before user-facing success claims

Open-source repos are useful for orchestration/runtime patterns. They are not a replacement for Guardian's security model.

## Recommended Implementation Sequence

### Phase 1: Typed Automation IR

Goal:
- reduce brittle prompt-family heuristics

Implement:
- `AutomationIR`
- validator output with structured blockers/warnings
- repair loop on invalid IR
- tests for prompt families instead of only direct compiler heuristics

Success criteria:
- automation requests are model-authored into schema-valid IR
- the validator, not prompt wording alone, decides what is saveable

### Phase 2: Graph Runtime Core

Goal:
- upgrade workflows from static step arrays to durable graph execution

Implement:
- node/edge runtime
- checkpoint store
- interrupt/resume nodes
- graph run ids and state inspection

Success criteria:
- workflows can pause/resume and survive longer-running orchestration safely

### Phase 3: Formal Handoffs + Better Traces

Goal:
- make multi-agent orchestration explainable and bounded

Implement:
- typed handoffs
- filtered context transfer
- trace spans for handoffs, approvals, resumes, and verification

Success criteria:
- multi-agent delegation is explicit, reviewable, and auditable

### Phase 4: Durability And Replay Discipline

Goal:
- harden scheduled/background automations

Implement:
- idempotent activity execution
- retry metadata
- replay-safe state transitions
- compensation guidance for partial failures

Success criteria:
- long-running automations are operationally safer and easier to recover

### Phase 5: Evals As A First-Class Product Surface

Goal:
- stop learning only from ad hoc failures

Implement:
- prompt-family regression suite for automation authoring
- trace grading for orchestration runs
- real-model harness matrix over local Ollama
- workflow/handoff/interruption test scenarios

Success criteria:
- Guardian improves by encoding failures into evals, not by accumulating folklore

## Concrete Next Build Targets

If we start now, the best next code targets are:

1. `src/runtime/automation-ir.ts`
2. `src/runtime/automation-ir-validator.ts`
3. `src/runtime/automation-ir-repair.ts`
4. `src/runtime/graph-runner.ts`
5. `src/runtime/run-state-store.ts`
6. `src/runtime/handoffs.ts`
7. `src/runtime/orchestration-tracing.ts`

Then refactor:
- `src/runtime/automation-authoring.ts`
- `src/runtime/automation-prerouter.ts`
- `src/runtime/workflows.ts`
- `src/runtime/scheduled-tasks.ts`
- `src/runtime/orchestrator.ts`

## Decision

Guardian should not replace its runtime with LangGraphJS, Mastra, or OpenAI Agents SDK.

Guardian should:
- keep its security/control plane native
- adopt a typed automation IR
- evolve toward a graph runtime
- formalize handoffs and orchestration traces
- borrow durability and eval discipline instead of inventing those patterns from scratch

That is the most defensible path to a more mature agentic workflow and orchestration architecture.

## Local References Used

- `/mnt/s/Development/agentic-orchestration-repos/langgraphjs/README.md`
- `/mnt/s/Development/agentic-orchestration-repos/langgraphjs/examples/sql-agent/sql_agent.ts`
- `/mnt/s/Development/agentic-orchestration-repos/openai-agents-js/README.md`
- `/mnt/s/Development/agentic-orchestration-repos/openai-agents-js/examples/handoffs/index.ts`
- `/mnt/s/Development/agentic-orchestration-repos/mastra/README.md`
- `/mnt/s/Development/agentic-orchestration-repos/mastra/explorations/network-validation-bridge.ts`
- `/mnt/s/Development/agentic-orchestration-repos/mastra/explorations/ralph-wiggum-loop-integration.md`
- `/mnt/s/Development/GuardianAgent/src/runtime/automation-prerouter.ts`
- `/mnt/s/Development/GuardianAgent/src/runtime/automation-authoring.ts`
- `/mnt/s/Development/GuardianAgent/src/runtime/automation-validation.ts`
- `/mnt/s/Development/GuardianAgent/src/runtime/scheduled-tasks.ts`
- `/mnt/s/Development/GuardianAgent/src/runtime/workflows.ts`
- `/mnt/s/Development/GuardianAgent/src/runtime/orchestrator.ts`
- `/mnt/s/Development/GuardianAgent/src/supervisor/worker-manager.ts`
- `/mnt/s/Development/GuardianAgent/src/tools/executor.ts`
