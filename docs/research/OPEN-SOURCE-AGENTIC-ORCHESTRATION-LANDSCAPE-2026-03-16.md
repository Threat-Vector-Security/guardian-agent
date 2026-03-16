# Open-Source Agentic Orchestration Landscape

Date: 2026-03-16

## Goal

Identify open-source repos Guardian Agent can study or selectively borrow from so we do not reinvent core agentic workflow and orchestration patterns.

This document focuses on:
- workflow orchestration
- durable execution
- human-in-the-loop approvals
- agent handoffs and delegation
- typed task/workflow structures
- TypeScript/JS fit where possible

It does not recommend replacing Guardian's existing security/control plane. The point is to borrow orchestration/runtime ideas, not to throw away Guardian's policy, approval, taint, and brokered-execution architecture.

## Bottom Line

Guardian should not build everything from scratch.

The best strategy is selective adoption:
- borrow workflow/runtime ideas from `langgraphjs` or `mastra`
- borrow handoff/trace/guardrail ideas from `openai-agents-js`
- borrow durability concepts from `temporal`
- borrow router/team orchestration ideas from `agent-squad` or `autogen`
- keep Guardian's own security model authoritative

If we only study three first, the best three are:
1. `langgraphjs`
2. `openai-agents-js`
3. `mastra`

## Recommendation Tiers

### Tier 1: Best Fit For Guardian

#### LangGraphJS
Repo: `https://github.com/langchain-ai/langgraphjs`

Why it matters:
- low-level graph orchestration primitives
- pause/resume and human-in-the-loop patterns
- good fit for explicit workflow state transitions
- useful for subgraphs, node-level routing, and durable-ish execution semantics

What to borrow:
- state graph structure
- interrupt/resume checkpoints
- explicit node transitions
- graph visualization/testing patterns

What not to copy blindly:
- framework-specific assumptions around LangChain ecosystem usage
- abstractions that pull Guardian too far toward generic chain composition

Verdict:
- strongest fit for Guardian's workflow/runtime layer

#### OpenAI Agents SDK JS
Repo: `https://github.com/openai/openai-agents-js`

Why it matters:
- clean concepts for agents, handoffs, guardrails, and tracing
- good reference for typed orchestration surfaces
- useful model for structured multi-agent delegation

What to borrow:
- handoff semantics
- trace/span structure
- guardrail boundaries around agent execution
- agent-to-agent contract design

What not to copy blindly:
- provider-specific assumptions
- abstractions that overlap with Guardian's stronger security-specific runtime controls

Verdict:
- best reference for agent orchestration semantics, not the whole runtime foundation

#### Mastra
Repo: `https://github.com/mastra-ai/mastra`

Why it matters:
- TypeScript-first
- explicit workflows plus agents
- human-in-the-loop and suspend/resume ideas
- good product reference for agent/workflow split

What to borrow:
- workflow authoring patterns
- suspension/resumption patterns
- separation of deterministic flows from open-ended agent actions

What not to copy blindly:
- generic platform layers Guardian does not need
- broad framework conventions that could dilute Guardian's runtime model

Verdict:
- best TypeScript-native product/runtime reference after LangGraphJS

### Tier 2: Strong Reference, More Selective Borrowing

#### Temporal
Repo: `https://github.com/temporalio/temporal`

Why it matters:
- best-in-class durable execution model
- retries, resumability, long-running tasks, idempotency
- strong conceptual reference for reliable background automations

What to borrow:
- durability mindset
- replay-safe workflow design ideas
- activity/workflow separation
- retry and compensation thinking

What not to copy blindly:
- full operational footprint
- workflow-engine complexity if Guardian is not ready for that level of infrastructure

Verdict:
- best durability reference; probably too heavy as a direct foundation right now

#### Agent Squad
Repo: `https://github.com/awslabs/agent-squad`

Why it matters:
- routing/team orchestration
- intent classification and delegation
- useful supervisor/team-of-agents patterns

What to borrow:
- request classification ideas
- router/supervisor coordination
- team handoff structure

What not to copy blindly:
- framework assumptions that are more support-desk/orchestrator oriented than Guardian's tool/runtime model

Verdict:
- good source for router/supervisor uplift ideas

#### AutoGen
Repo: `https://github.com/microsoft/autogen`

Why it matters:
- event-driven multi-agent architecture
- local/distributed runtime patterns
- Studio/Bench concepts

What to borrow:
- event-driven agent runtime ideas
- team composition patterns
- testing/eval/productization concepts

What not to copy blindly:
- broad framework surface area
- more complexity than Guardian currently needs

Verdict:
- valuable reference repo, but likely too heavyweight as a primary foundation

### Tier 3: Useful For Specific Ideas

#### PydanticAI
Repo: `https://github.com/pydantic/pydantic-ai`

Why it matters:
- typed outputs
- validation discipline
- observability/evals mindset

What to borrow:
- contract-first generation patterns
- validation and retry discipline
- testing style

Verdict:
- not a workflow engine, but very relevant to Guardian's model-authored IR direction

#### CrewAI
Repo: `https://github.com/crewAIInc/crewAI`

Why it matters:
- conceptual distinction between autonomous teams and explicit flows

What to borrow:
- high-level split between "crew" and "flow" style work

Verdict:
- useful conceptually, less compelling as the main architectural base

#### Coagent
Repo: `https://github.com/OpenCSGs/coagent`

Why it matters:
- evented orchestration
- static and dynamic orchestration concepts
- structured output and MCP-adjacent thinking

Verdict:
- worth local study, probably not the primary base

### Tier 4: Product/UX Reference More Than Core Runtime

#### n8n
Repo: `https://github.com/n8n-io/n8n`

Why it matters:
- workflow studio UX
- templates
- operator-facing automation ergonomics

What to borrow:
- UX concepts only

What not to copy:
- broad platform runtime
- business model / licensing assumptions

Verdict:
- good UX inspiration, not the right architectural foundation for Guardian

## What This Means For Guardian

Guardian already has strong differentiators:
- contextual security and taint handling
- policy-aware approvals
- brokered worker isolation
- bounded schedule authority
- auditability

Those should remain Guardian-native.

The main gap is not raw security primitives. The gap is orchestration maturity:
- richer workflow runtime semantics
- better agent/task handoff structure
- stronger durability and resumption patterns
- model-authored but validator-enforced workflow/task IR

## Concrete Borrow/Build Plan

### Borrow First

1. From `langgraphjs`
- graph runtime/state machine structure
- interrupts and resumes
- explicit node transition model

2. From `openai-agents-js`
- handoff contracts
- trace model
- guardrail layering

3. From `mastra`
- TypeScript workflow + agent ergonomics
- operator-facing workflow composition ideas

4. From `temporal`
- durable execution concepts
- retry/replay/idempotency mental model

### Keep Guardian-Native

- approvals
- policy engine
- contextual trust/taint model
- brokered tool execution
- schedule authority and budget enforcement
- security audit and sentinel logic

### Next Architecture Direction

The likely best next step is:

`model-authored automation IR -> deterministic validator -> repair loop -> persisted native automation`

That is better than:
- prompt-only authoring
- giant heuristic-only compiler
- importing a foreign orchestration framework wholesale

## Shortlist For Immediate Local Analysis

Clone and inspect first:
- `langgraphjs`
- `openai-agents-js`
- `mastra`
- `temporal`
- `awslabs/agent-squad`
- `microsoft/autogen`
- `pydantic-ai`
- `crewAI`
- `coagent`

Suggested reading order:
1. `langgraphjs`
2. `openai-agents-js`
3. `mastra`
4. `temporal`
5. `agent-squad`

## Sources

- LangGraphJS: `https://github.com/langchain-ai/langgraphjs`
- OpenAI Agents SDK JS: `https://github.com/openai/openai-agents-js`
- Mastra: `https://github.com/mastra-ai/mastra`
- Temporal: `https://github.com/temporalio/temporal`
- Agent Squad: `https://github.com/awslabs/agent-squad`
- AutoGen: `https://github.com/microsoft/autogen`
- PydanticAI: `https://github.com/pydantic/pydantic-ai`
- CrewAI: `https://github.com/crewAIInc/crewAI`
- Coagent: `https://github.com/OpenCSGs/coagent`
- n8n: `https://github.com/n8n-io/n8n`
