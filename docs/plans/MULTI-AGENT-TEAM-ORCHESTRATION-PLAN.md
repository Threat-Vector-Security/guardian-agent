# Multi-Agent Team Orchestration Plan

**Status:** Draft
**Date:** 2026-04-16
**Source Research:** [multica-research/](/mnt/s/Development/GuardianAgent/multica-research)
**Security Compliance:** Derived from [SECURITY.md](SECURITY.md) and [BROKERED-AGENT-ISOLATION-SPEC.md](docs/specs/BROKERED-AGENT-ISOLATION-SPEC.md)

## Executive Summary

This plan outlines the implementation of a multi-agent "Team" capability. We will transition from a single assistant to a **Team of Specialist Workers**, each isolated via our brokered worker model, orchestrated by a central "Manager" (the Main Agent).

## 1. The Interaction Model: Manager & Specialists

### 1.1 Main Agent as "Team Lead"
- The primary Guardian Agent chat remains the entry point.
- **The Manager Call:** Uplift `IntentGateway` to support a `delegate_task` operation.
- If a request is complex, the Manager enqueues tasks for specialists rather than attempting a multi-step loop itself.

### 1.2 Agent Task Queue (`AgentTaskStore`) & Concurrency
- Implement a persistent queue in `src/runtime/agent-tasks.ts`.
- Specialists "claim" tasks from this store, allowing concurrent background work.
- **Concurrency Limits:** The store must respect the global `workerMaxConcurrent` limit (default 4). If the limit is reached, tasks remain in a `queued` state and the UI displays "Waiting for compute resources".

### 1.3 Asynchronous Handoffs & Event Wakeup
- When a specialist finishes a task, it emits a `task:completed` event to the `EventBus`.
- This event re-injects a system prompt into the Lead Agent's active chat context (e.g., `[System: The Reviewer has completed their task. Here are the results...]`).
- The Lead can then summarize the results for the user asynchronously.

### 1.4 Communication & Mentions
- **@Mentions:** Both users and agents can use @mentions to trigger routing.
- **Context Handoffs:** Uses the existing `AgentHandoffContract` to filter what a specialist can see.

## 2. Security & Isolation

### 2.1 Multi-Lane Brokered Isolation
- **Strict Process Separation:** Every concurrent specialist runs in its own `brokered-worker` process.
- **Narrowed Capabilities:** Each specialist profile is bound to a frozen capability set (e.g., `Reviewer` has `read_files` but is denied `write_files`).
- **Unified Output Scanning:** All responses pass through the supervisor's `OutputGuardian`.

### 2.2 Supervisor-Mediated Approvals
- **all mutating tools** require approval via the central `PendingActionStore`.
- Approvals in the UI will indicate which agent is requesting the action.

## 3. Specialist Team "Starter Pack"

| Agent Role | Primary Focus | Key Capabilities |
| :--- | :--- | :--- |
| **Lead Engineer** | Orchestration, Planning | Full (Balanced) |
| **Reviewer** | Code Quality, Diffs | `read_files` only |
| **Security Sentinel** | Vulnerabilities, Secrets | `read_files` + Security Tools |
| **Researcher** | Documentation, APIs | `network_access` + `read_files` |
| **Frontend Expert** | UI/UX, React, CSS | `read_files` + `write_files` |

## 4. UI/UX: The "Team Panel" & "Mini-Chats"

### 4.1 "Team" Panel (Left Side)
- Shows all team members, their current status (Idle, Queued, Working, Waiting for compute resources), and active tasks.

### 4.2 Conversation Isolation & Composite Keys
- Clicking a team member opens their **Private Lane**.
- To prevent collisions with Coding Workspaces, the conversation identity uses a composite key: `agent:<id>:session:<sessionId>`.
- Users can give individual instructions to specialists without cluttering the main chat.

### 4.3 Activity HUD
- A real-time widget in the main chat showing "Background Progress".

## 5. Implementation Phasing

1.  **Phase 1:** `AgentTeammate` storage, Team side panel (UI), and composite conversation keys.
2.  **Phase 2:** Asynchronous `AgentTaskStore` respecting concurrency limits, and `EventBus` wakeups.
3.  **Phase 3:** `IntentGateway` uplift for delegation and @mentions.
4.  **Phase 4:** Specialist SOUL profile library.