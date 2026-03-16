# Automation Authoring Compiler

**Status:** Implemented

## Purpose

Guardian now treats conversational automation creation as a compiler problem, not a freeform tool-calling problem.

The old weak path was:

```text
user request
  -> generic chat planner
  -> raw tool call guesses
  -> sometimes workflow_upsert / task_create
  -> sometimes fs_write / code_create / shell_safe drift
```

The new canonical path is:

```text
user request
  -> automation intent detection
  -> constrained automation IR
  -> IR repair + validation
  -> native mutation compile
  -> ToolExecutor approval + verification
```

This architecture exists to stop the assistant from confusing:
- "create a Guardian automation"
- "create a script that could implement an automation"
- "create a workflow"
- "create a scheduled task"

## Why This Exists

Agent systems have converged on a common runtime model:
- tool-using agents need strong execution boundaries
- deterministic workflows and open-ended agent runs are different primitives
- approval, sandbox, and verification must sit outside the model
- orchestration quality depends on typed intermediate representations and evals, not prompt-only behavior

Guardian already had the right runtime primitives:
- `workflow_upsert`
- `task_create`
- `task_update`
- bounded scheduled-task authority
- approval-gated tool execution
- brokered worker isolation

What it lacked was a first-class authoring layer between natural-language requests and those primitives.

## Design Decision

### 1. Native Guardian primitives are authoritative

When the user asks for an automation, workflow, playbook, or scheduled task, Guardian must prefer:
- `task_create`
- `task_update`
- `workflow_upsert`

It must not default to:
- `fs_write`
- `code_create`
- `shell_safe`

unless the user explicitly asked for code or a script as the output.

### 2. Open-ended automations default to scheduled agent tasks

If the requested automation is dynamic, investigative, or content-heavy, Guardian compiles it into:

```text
task_create(type="agent", target="default", prompt=...)
```

Examples:
- inbox review and drafting
- lead research from CSV + web
- incident triage
- content pipelines
- competitor monitoring
- recurring summaries and reports

This is the preferred shape because the assistant needs to decide what to inspect at runtime.

### 3. Workflows are reserved for deterministic step graphs

If the request already describes a fixed built-in tool graph, Guardian compiles it into:

```text
workflow_upsert(id, name, mode, steps, schedule?)
```

This path is intentionally narrower. It is for explicit tool pipelines, not general open-ended agent work.

## Compiler Pipeline

### Stage 1: Intent detection

The compiler activates when the request clearly indicates automation authoring:
- create/build/set up/configure/schedule
- automation/workflow/playbook/pipeline/scheduled task

### Stage 2: Constraint extraction

The compiler extracts hard constraints such as:
- `Guardian workflow`
- `scheduled task`
- `using built-in tools only`
- `not a shell script`
- `not a code file`

These are treated as execution constraints, not soft style hints.

### Stage 3: Schedule extraction

The compiler parses common schedule language into cron:
- `daily 7:30 AM`
- `weekday`
- `every 15 minutes`
- `hourly`
- `every Monday`
- `tomorrow`

If the request is open-ended and no schedule can be safely inferred, the compiler does not guess blindly. It falls back to the normal assistant path for clarification.

Default policy:
- `weekday` with no time => `0 9 * * 1-5`
- `daily` with no time => `0 9 * * *`

### Stage 4: Shape selection

Decision rule:
- open-ended, investigative, or runtime-adaptive => scheduled `agent` task
- explicit fixed tool graph => `workflow`

### Stage 5: IR repair + validation

Guardian now repairs and validates the typed `AutomationIR` before emitting native mutations.

Repair responsibilities:
- normalize step ids and types
- remove forbidden script/code steps when constraints hard-ban them
- convert invalid empty workflow attempts into scheduled assistant automations when the request is clearly open-ended

Validation responsibilities:
- schema validity
- primitive/body consistency
- schedule requirements for assistant automations
- built-in-tools-only and no-code-artifacts constraint enforcement

### Stage 6: Native mutation compile

The compiler produces one of:
- scheduled agent task create/update payload
- workflow upsert payload

The compiled payloads already include:
- human-readable name
- concise human description for operator-facing UI surfaces
- stable slug/id
- bounded schedule budgets
- active-run protection so one scheduled task cannot overlap its own prior run
- channel/delivery defaults for scheduled reports
- a runtime prompt that reinforces native-tool execution and fail-closed behavior

For scheduled assistant tasks, the concise description and the long runtime prompt are intentionally stored separately:
- `description` is the operator-facing summary shown in automation lists and edit headers
- `prompt` is the internal scheduled instruction used at execution time

This separation prevents the UI from leaking the full internal prompt when rendering saved automations.

### Stage 7: Execution-readiness validation

Before Guardian persists a conversationally authored automation, it validates that the compiled definition is likely to work under the current policy.

Validation checks:
- required input files referenced by the request actually exist
- output parent directories exist when the target tool requires them ahead of time
- explicit path/domain constraints survive tool preflight
- deterministic workflow steps are preflighted against current policy/sandbox rules
- scheduled assistant tasks are blocked if their predicted runtime actions would still require manual approval
- scheduled tasks are refused when saved authority or runtime boundaries would guarantee a broken first run
- when blockers are fixable through supported policy updates, Guardian stages those fixes as approval-backed remediation actions and retries automation creation automatically after approval

Important nuance:
- predicted approvals for bounded workspace-local file outputs do not block scheduled assistant task creation
- those writes are treated as covered by the save-time approval for the scheduled automation definition
- missing parent directories for native file-writing outputs such as `fs_write` and `doc_create` do not block save; those tools create the parent directory at runtime
- predicted approvals for higher-impact mutations, external writes, or non-workspace side effects still block save

This means conversational automation creation is no longer "definition only". Guardian refuses to save automations that are obviously missing prerequisites or would immediately stall on policy/sandbox blockers.

### Approval workflow in practice

For native automations, Guardian now follows this lifecycle:

1. The user asks Guardian to create or update an automation.
2. The compiler turns that request into a native task or workflow definition.
3. Guardian validates whether the automation is likely to work under the current policy.
4. If Guardian finds fixable policy blockers first, it stages the required `update_tool_policy` actions and waits for approval.
5. After those fixes are approved, Guardian retries the automation creation in the same session.
6. The user approves the automation definition itself.
7. Later scheduled runs execute under that saved approval, as long as the scope, expiry window, and budgets are still valid.

What save-time approval covers:
- the automation definition itself
- bounded expected actions that are clearly part of that definition
- normal workspace-local output writes such as reports, CSVs, and markdown files

What still blocks creation:
- missing required inputs
- writes outside the approved workspace boundary
- predicted actions that would still require runtime approval because they are higher-risk or external
- unsupported blockers that Guardian cannot remediate with bounded policy updates

What can still stop a later run:
- scope drift
- expired saved approval
- budget exhaustion or auto-pause conditions
- unexpected higher-risk actions outside the approved automation scope

### Stage 8: Control-plane execution

Compiled mutations still execute through `ToolExecutor`.

That preserves:
- approvals
- policy checks
- verification
- audit records
- principal binding
- schedule authority metadata

The compiler does not bypass the security model.

## Runtime Sequence

```text
Inbound user message
  -> shared pre-router
  -> direct scheduled email compiler (specialized)
  -> direct automation authoring compiler
       -> AutomationIR
       -> repair
       -> validation
  -> if compiled:
       task_list (for agent-task dedupe/update)
       -> task_create / task_update / workflow_upsert
       -> approval boundary if required
       -> grounded response
  -> else:
       normal LLM tool-calling loop
```

The important implementation detail is that this pre-router now runs before generic tool use in every inbound path:
- the main runtime path in `src/index.ts`
- the supervisor-side brokered dispatch path in `src/supervisor/worker-manager.ts`
- the worker session keeps a defensive fallback in `src/worker/worker-session.ts`

That makes automation compilation authoritative instead of "best effort". A request cannot hit the brokered path and bypass native automation compilation anymore.

## Update Semantics

### Scheduled agent tasks

Agent-task authoring is duplicate-aware.

Before creating a new task, Guardian checks existing scheduled tasks. If a matching native automation already exists, Guardian updates it instead of duplicating it.

Matching dimensions:
- name
- type = `agent`
- target = `default`
- cron/channel/delivery for exact-match preference

### Workflows

Workflow authoring uses `workflow_upsert`, so stable ids already provide idempotent create/update behavior.

## Security Consequences

This compiler materially improves security and reliability:

### Harder to escape native automation boundaries

Requests like:
- "create a workflow"
- "not a script"
- "built-in tools only"

no longer rely on the model obeying style guidance. The compiler enforces the native mutation path before the LLM can drift.

### Lower malformed tool-call risk

Large nested JSON payloads with embedded code are a known failure mode for local models. Compiling open-ended automations into scheduled agent tasks avoids oversized script-generation payloads.

### Better overspend control

Compiled scheduled agent tasks now start with conservative bounded defaults:
- `maxRunsPerWindow`
- `dailySpendCap`
- `providerSpendCap`

This reduces the blast radius of broken planner loops or broken tools.

### Better execution readiness

Saved automations must now pass a pre-save readiness gate. Missing inputs, blocked domains/paths, or predicted runtime approval dependencies are surfaced before the automation object is written.

### Better completion grounding

Success is only reported after the underlying automation object has actually been created or updated by the control plane.

## Operator Experience

The expected conversational UX is now:

```text
user request
  -> native approval boundary if mutation requires approval
  -> grounded success message naming the created workflow/task
```

The assistant should not need an extra:
- "I’m ready, should I proceed?"

turn before the approval UI appears.

## Troubleshooting Map

When a conversational automation request behaves incorrectly, start here first.

Request-shape failures usually belong to the compiler/pre-router layer:
- wrong native object chosen
- script drift (`shell_safe`, `fs_write`, `code_create`) instead of `task_create` / `task_update` / `workflow_upsert`
- unnecessary clarification for a request that should compile directly
- missing dedupe/update behavior on repeated authoring requests
- native automation constraints such as `built-in tools only` or `do not create scripts/code files` not being honored
- save-time readiness blockers such as missing files, blocked allowlists, or predicted runtime approvals for scheduled assistant tasks

Primary files to inspect:
- `src/runtime/automation-authoring.ts`
- `src/runtime/automation-prerouter.ts`
- `src/supervisor/worker-manager.ts`
- `src/index.ts`
- `src/worker/worker-session.ts`

Practical routing guide:
- if the failure is about understanding the request or choosing the wrong automation shape, update `automation-authoring.ts`
- if the failure is that the compiler did not intercept before generic tool use, update `automation-prerouter.ts` and the inbound wiring in `worker-manager.ts` / `index.ts`
- if the failure is model tier selection (`local` vs `external`), look at `src/runtime/message-router.ts`, not the automation compiler
- if the failure is approvals, policy, or execution after the correct automation object was chosen, look at `ToolExecutor`, scheduled tasks, and control-plane code rather than the compiler

Required fix discipline:
- add the failing prompt family to compiler tests
- add or update the end-to-end harness assertion
- prefer encoding the prompt family into compiler logic over relying on prompt wording alone

## Implementation Map

- `src/runtime/automation-authoring.ts`
  - automation intent detection
  - schedule parsing
  - shape selection
  - scheduled agent compilation
  - deterministic workflow compilation
  - duplicate-aware scheduled-task matching

- `src/index.ts`
  - direct compiler invocation before generic LLM tool-calling
  - native mutation execution through `ToolExecutor`
  - grounded approval/success responses

- `src/prompts/guardian-core.ts`
  - fallback LLM guidance aligned to the compiler model

## Architectural Guidance

Use this compiler path when:
- the user is asking Guardian to create or update an automation
- the result should become a native control-plane object

Do not use this compiler path when:
- the user is asking for source code, scripts, or implementation files
- the user is merely asking questions about automations
- the request is too incomplete to safely infer a native automation shape

## Future Work

The current implementation is the correct architectural direction, but it is not the end state.

Next maturity steps:
- richer deterministic workflow IR instead of a narrow workflow compiler
- automation authoring evals and trace grading
- stronger edit/rename/delete conversational compilation
- channel-visible provenance for compiled authoring decisions
- more declarative step contracts between workflow steps
