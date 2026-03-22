# Agent Orchestration Recipes Spec

**Status:** Implemented baseline  
**Primary Files:** `src/agent/recipes.ts`, `src/agent/recipes.test.ts`, `src/agent/orchestration.ts`, `src/agent/conditional.ts`

## Goal

Ship first-class multi-agent workflow templates without introducing a second orchestration runtime.

Guardian already had the core primitives:
- `SequentialAgent`
- `ParallelAgent`
- `LoopAgent`
- `ConditionalAgent`

This uplift adds reusable role-separated compositions on top of those primitives so common enterprise patterns do not have to be rebuilt ad hoc.

## Implemented Recipes

- `planner -> executor -> validator`
- `researcher -> writer -> reviewer`
- `research -> draft -> verify`

Each recipe returns an `OrchestrationRecipe` with:
- `entryAgent`
- `supportingAgents`
- descriptive metadata for docs and future tooling

## Design Rules

- Recipes are thin wrappers over existing orchestration agents.
- Sub-agent execution still flows through `ctx.dispatch()` and the normal runtime path.
- Handoff controls remain the same: capability filtering, contract validation, taint preservation rules, and approval checks are still supervisor-owned.
- Recipes do not create new execution authority.

## Benefits

- Consistent separation of duties for planning, execution, review, and evidence collection
- Lower developer overhead for common multi-agent patterns
- Better testability because recipes expose stable, named compositions instead of one-off control flow
- Easier future eval coverage because expected workflow shape is explicit

## Non-Goals

- Peer-to-peer swarm coordination
- Persistent cross-run shared memory
- A second agent framework outside the existing Guardian runtime

## Current Boundaries

- Recipes are developer/runtime building blocks, not a standalone end-user authoring surface yet
- Validator/reviewer safety still depends on the selected target agents and handoff contracts
- Recipes do not yet add automatic role capability narrowing beyond what the caller configures

## Verification

- `src/agent/recipes.test.ts`
