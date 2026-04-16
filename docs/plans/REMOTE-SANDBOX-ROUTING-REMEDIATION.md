# Remote Sandbox Routing Remediation Plan

## Goal
Enforce automatic routing of risky operations (e.g., dependency installs, builds, tests, and non-read-only shell commands) to configured remote sandboxes (Daytona or Vercel). If both are configured, dynamically select the most suitable backend based on the task's characteristics. If neither is configured or ready, fall back to local execution which requires standard user approval, forcing explicit acceptance of risk.

## Phase 1: Define and Classify Risky Operations
1. **Identify Target Tools:** Determine the set of tools considered "risky" or "remote-eligible" (e.g., `package_install`, `code_build`, `code_test`, `code_lint`, `code_remote_exec`, and mutating `shell_safe` commands).
2. **Add Execution Routing Metadata:** Extend tool definitions or the execution context to include routing preferences (e.g., `prefers_stateful`, `prefers_fast_startup`, `requires_network`).

## Phase 2: Smart Routing Logic (Vercel vs. Daytona)
1. **Develop Selection Heuristics:**
   - **Vercel Sandbox:** Prioritize for short-lived, stateless, or burst tasks (`code_lint`, single `code_test`, `package_install`) that benefit from fast startup.
   - **Daytona Sandbox:** Prioritize for longer-running, stateful, iterative tasks, or complex builds (`code_build`, iterative debugging, heavy dependencies) that benefit from persistent workspace state.
2. **Update `prioritizeReadyRemoteExecutionTargets`:** Enhance the existing target prioritization logic in `src/runtime/remote-execution/policy.ts` (or create a wrapper) to accept task characteristics and return the optimal backend.

## Phase 3: Execution Interception and Promotion
1. **Modify `ToolExecutor`:** Update `src/tools/executor.ts` to intercept execution of risky tools.
2. **Dynamic Target Resolution:** Before executing a risky tool locally, query the smart routing logic for an available remote target.
3. **Execute Remotely:** If a target is found, transparently promote the execution to the remote sandbox using the existing remote execution infrastructure.

## Phase 4: Local Fallback and Approvals Enforcement
1. **Fallback Path:** Ensure that if no remote targets are ready, the execution falls back to the `local_process_sandbox`.
2. **Approval Enforcement:** Verify that local fallback correctly triggers the Guardian approval pipeline (e.g., `approve_each`), ensuring the operator explicitly accepts the risk of running the operation locally.
3. **Audit Logging:** Ensure that the routing decision (Remote Vercel, Remote Daytona, or Local Fallback) is clearly logged in the audit trail.

## Phase 5: Testing and Validation
1. **Unit Tests:** Add tests for the new routing logic, ensuring Vercel is chosen for burst tasks and Daytona for stateful tasks.
2. **Integration Tests:** Verify the full flow from tool request -> routing decision -> remote execution or local approval.
3. **End-to-End Validation:** Run the coding assistant test harnesses to confirm no regressions in standard workflows.
