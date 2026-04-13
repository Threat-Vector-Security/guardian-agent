# Guardian Agent - Agentic System Uplift Plan

## 1. Overview
This document outlines the strategic uplifts required to elevate Guardian Agent from a highly capable, reactive orchestrator to a fully autonomous, self-correcting agentic system. While the system currently excels at secure tool execution, memory persistence, and technical error recovery, these uplifts will close the loop on proactive planning, logical observation, and semantic recovery. It incorporates priority uplifts identified from the Hermes Agent architectural review.

## 2. Intent Gateway Complex Planning Model (Proactive Planning DAG)

**Current State:** The `IntentGateway` routes requests directly to skills or prerouters, acting reactively to individual user prompts.

**The Uplift:** Introduce a "Planning Phase" for complex intents using a Directed Acyclic Graph (DAG) of sub-tasks. When the `IntentGateway` classifies an objective as "complex", it routes to a `TaskPlanner` before execution. The `AssistantOrchestrator` consumes this DAG, autonomously transitioning from step $N$ to step $N+1$.

### Deep Dive: Programmatic Tool Orchestration (`execute_code`)
To reduce LLM round trips and context bloat during DAG execution, the planner can utilize a sandboxed micro-orchestrator (`execute_code`). Instead of the LLM issuing dozens of sequential tool calls to process files or API results, a DAG node can execute a sandboxed script that calls managed tools, transforms data, and returns the refined result.

### Deep Dive: First-Class Delegation (`delegate_task`)
Instead of simple skill handoffs, the DAG utilizes explicit governed subagent delegation. The orchestrator spawns brokered worker threads with specific tool and trust scoping, audit lineage, and operator-visible progress, ensuring sub-tasks are solved without polluting the main planner's context.

### Deep Dive: Integration with Second Brain & Automations
The DAG planner will act as an orchestrator of existing primitives, not a replacement for them.
*   **Second-Brain Routines:** If a step in the DAG requires executing a known Second-Brain routine, that routine becomes a single node in the DAG.
*   **Creating Automations:** The planner can identify when a sub-task is repetitive and propose creating a new automation as part of its plan.

## 3. Self-Reflection Loop (Observation)

**Current State:** The system observes tool output primarily for technical success.

**The Uplift:** Implement autonomous semantic validation. Introduce a `ReflectionCheck` after critical tool executions to evaluate the *quality* of the payload ("Does this output satisfy the intended sub-goal?").

### Deep Dive: Governed Reflective Learning Queue
After a meaningful DAG execution, a runtime-owned background job evaluates the trajectory. It proposes memory updates, skill patch proposals, and playbook recommendations to the control-plane approval surfaces, creating a closed but governed learning loop.

## 4. Memory Compaction & Context Budgeting

**Current State:** Sophisticated memory architecture with background hygiene.

**The Uplift:** Focus on **in-session context compaction** during long-running DAG execution to prevent prompt bloat. Aggressively compress older logs and raw tool outputs into dense "insight nodes" within the active session. When the task finishes, this compressed trace is handed off to the existing Memory Flush mechanism.

## 5. Logical Fallback Strategies & Dynamic Tooling (Recovery)

**Current State:** Exceptional technical recovery.

**The Uplift:** Implement logical pivot mechanisms for semantic failures caught by the Self-Reflection Loop. If a step is flagged as failing semantically, the `AssistantOrchestrator` triggers a `RecoveryPlanner` to generate an alternative approach.

### Deep Dive: Dynamic Skill Creation via Sandbox
*   **The Problem:** The DAG execution might block because no existing tool can parse a proprietary file format.
*   **The Sandbox Pivot:** The Recovery Planner can pivot to **Dynamic Skill Creation**, drafting the skill code, executing and testing it within the isolated sandbox boundary.
*   **Approval Gate:** Promotion out of the sandbox to a permanent, trusted skill must pass through standard Guardian review/approval layers.

## 6. Ecosystem & Operator Ergonomics (Future Phases)
Drawing from Hermes, future uplifts will introduce:
*   **Profiles & Portability:** Multiple isolated operator profiles with export/import capabilities.
*   **Skill UX Uplift:** Better browse, inspect, toggle, and edit-review surfaces for skills.

## 7. Implementation Roadmap
*   **Phase 1: The Meta-Planner DAG & Delegation.** Modify `IntentGateway` to route complex tasks to a DAG generator. Introduce `delegate_task` and `execute_code` primitives to nodes. Ensure nodes correctly delegate to existing Second-Brain routines and Coding Skills without interference.
*   **Phase 2: Semantic Reflection & Learning Queue.** Implement the evaluation step post-tool-execution, followed by the background reflective learning queue.
*   **Phase 3: Sandbox Dynamic Tooling.** Hook the recovery loop into the sandbox environment.
*   **Phase 4: In-Session Compaction.** Enhance trace tracking to compress intermediate results in-memory.
*   **Phase 5: Profiles & Skill UX.** Implement isolated profiles and enhance the operator control plane for skills.