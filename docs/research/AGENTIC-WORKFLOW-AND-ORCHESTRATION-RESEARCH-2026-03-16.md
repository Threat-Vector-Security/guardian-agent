# Agentic Workflow And Orchestration Research

**Date:** March 16, 2026  
**Scope:** terminal-first agent systems, workflow authoring, multi-agent orchestration, evals, and automation control planes

## Executive Summary

The current frontier is not "chat that can call tools." It is:
- long-running agent execution
- native workflow and automation objects
- secure execution boundaries
- traceable verification
- orchestration that separates deterministic pipelines from open-ended agent work

Across OpenAI, Anthropic, and Google sources, the pattern is consistent:
- the terminal or a command-center surface becomes the operating environment
- tools, files, search, and shell access close the execution loop
- orchestration quality depends on context management, typed workflow structure, and evals
- background automations need bounded authority, review queues, and explicit supervision

## What The Latest Sources Converge On

### 1. The operating surface is shifting from chat portals to terminal or command-center agents

OpenAI’s May 16, 2025 Codex launch described a cloud software-engineering agent that works in isolated task environments, can read and edit files, run commands and tests, and return terminal and test evidence for verification. OpenAI’s February 2, 2026 Codex app announcement extends that into a command center for multiple long-running agents, worktrees, skills, and scheduled Automations.

Google’s Gemini CLI README presents a similar direction: terminal-first, built-in tools, MCP extensibility, custom commands, context files, checkpointing, and headless automation.

Inference for Guardian:
- Guardian is on the right macro path by being terminal-capable, tool-capable, and multi-channel.
- The next maturity step is not more prompt cleverness. It is stronger native control planes for agent work.

### 2. Deterministic workflows and open-ended agent runs are different products

OpenAI’s Agent Builder guide now frames workflows as multi-step agent systems with typed inputs and outputs, visual debugging, and exportable workflow structure. Anthropic’s Claude Agent SDK guidance describes the runtime loop as `gather context -> take action -> verify -> repeat`, which is a better fit for open-ended recurring tasks than a rigid step graph.

Inference for Guardian:
- fixed built-in tool graphs should remain workflows/playbooks
- dynamic monitoring, research, drafting, and recurring summaries should default to scheduled agent tasks
- one primitive should not be forced to do the other’s job

### 3. Multi-agent orchestration is useful, but only with tight task boundaries

Anthropic’s June 13, 2025 multi-agent research writeup describes an orchestrator-worker design where a lead agent delegates clear subtasks to specialized parallel workers. The important lesson is not “always use multi-agent.” It is that delegation only works when subagents have explicit objectives, output formats, tool/source guidance, and task boundaries.

Inference for Guardian:
- multi-agent composition belongs inside explicit orchestration agents and reusable workflow runtime
- conversational automation authoring should not improvise multi-agent structure on the fly without a constrained plan

### 4. Context engineering has replaced prompt engineering as the main steering problem

Anthropic’s September 29, 2025 context-engineering article argues that effective agents depend on curating the right context, not just writing a better prompt. It explicitly ties agent quality to managing tools, external data, message history, and other context-window inputs over long-running loops.

Inference for Guardian:
- the automation authoring problem is partly a context problem
- if the model is allowed to reason directly from user phrasing to raw tool calls, it will drift
- a compiler/intermediate-representation layer is a context-reduction mechanism as much as an orchestration mechanism

### 5. Evals and trace inspection are first-class requirements

OpenAI’s Trace Grading guide emphasizes structured scoring of complete agent traces, not only final outputs. Anthropic’s January 9, 2026 evals article makes the same point from the product side: use a stable eval harness, read transcripts, and treat evaluation as ongoing engineering infrastructure.

Inference for Guardian:
- automation creation should have its own eval lane
- success means more than “the model called some tool”
- authoring traces should be graded for:
  - right native primitive chosen
  - obeyed hard constraints like “not a script”
  - approval boundary correctness
  - grounded completion language
  - duplicate/update behavior

### 6. Security is moving toward isolation plus configurable authority

OpenAI’s Codex materials emphasize isolated environments, reviewable evidence, and configurable sandbox rules. The Codex app announcement explicitly says elevated permissions should be approved or governed by rules. That lines up with the broader shift toward bounded authority instead of permanent background trust.

Inference for Guardian:
- Guardian’s bounded schedule authority, approval expiry, scope hashes, and runaway caps are aligned with the direction of the market
- the weakest remaining part was authoring drift, not execution isolation

## Where Guardian Was Strong

Before this uplift, Guardian already had the right runtime primitives:
- brokered worker isolation
- approval-gated tool execution
- scheduled tasks with bounded authority
- workflows/playbooks
- multi-agent composition primitives
- contextual trust enforcement for content and memory

This meant the runtime architecture was already broadly correct.

## Where Guardian Needed To Improve

The main architectural gap was between:

```text
natural-language automation request
```

and:

```text
native Guardian automation object
```

Without a dedicated authoring layer, the generic planner could confuse:
- workflow creation
- scheduled task creation
- script generation
- “done” vs “something that might help later”

That is why requests like lead research or inbox review could drift into `fs_write` and shell scripts instead of `task_create` or `workflow_upsert`.

## Architectural Conclusions For Guardian

### Keep

- brokered worker model
- ToolExecutor as the approval/policy boundary
- scheduled `tool` / `playbook` / `agent` task types
- orchestration agents for developer-authored multi-agent workflows
- contextual security model

### Strengthen

- native automation authoring compiler in front of the LLM tool loop
- scheduled `agent` tasks as the default for open-ended recurring work
- deterministic workflow compilation only for explicit fixed graphs
- authoring-specific harnesses and trace grading
- stronger operator-facing grounding around what object was actually created

### Avoid

- relying on prompt instructions alone for automation authoring
- letting “create an automation” fall back to script generation
- overloading workflows to represent dynamic recurring agent behavior

## Concrete Guidance Adopted In This Uplift

Guardian now moves toward this model:

```text
user request
  -> automation intent detection
  -> schedule + constraint extraction
  -> shape selection
  -> compile to task_create / task_update / workflow_upsert
  -> ToolExecutor approval + verification
```

Policy choices:
- open-ended recurring work => scheduled `agent` task
- explicit deterministic built-in graph => workflow
- “built-in tools only” / “not a script” => hard ban on script/code-file authoring
- duplicate scheduled tasks => update instead of duplicate when identity matches

## Remaining Future Work

- richer typed workflow IR beyond the current narrow deterministic compiler
- trace grading over real automation-authoring runs
- broader edit/rename/delete automation compilation
- operator-visible provenance for compiler decisions
- stronger workflow-step contracts and typed outputs

## Sources

- OpenAI, “Introducing Codex,” May 16, 2025  
  https://openai.com/index/introducing-codex/

- OpenAI, “Introducing the Codex app,” February 2, 2026  
  https://openai.com/index/introducing-the-codex-app/

- OpenAI API, “Agent Builder”  
  https://platform.openai.com/docs/guides/agent-builder

- OpenAI API, “Trace grading”  
  https://platform.openai.com/docs/guides/trace-grading

- Anthropic, “Building agents with the Claude Agent SDK,” September 29, 2025  
  https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk/

- Anthropic, “How we built our multi-agent research system,” June 13, 2025  
  https://www.anthropic.com/engineering/built-multi-agent-research-system

- Anthropic, “Demystifying evals for AI agents,” January 9, 2026  
  https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents

- Anthropic, “Effective context engineering for AI agents,” September 29, 2025  
  https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents

- Google, “Gemini CLI” README and docs index, accessed March 16, 2026  
  https://github.com/google-gemini/gemini-cli
