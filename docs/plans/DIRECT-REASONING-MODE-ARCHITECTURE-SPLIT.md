# Direct Reasoning Mode Architecture Split

**Status:** In progress — Phase 2 implementation complete, not yet committed
**Date:** 2026-04-23
**Supersedes:** Workstream 3 Phase 3A in INTENT-GATEWAY-AND-DELEGATED-EXECUTION-REALIGNMENT-PLAN.md

## Problem

Repo-inspection and coding tasks (e.g., "Inspect this repo and tell me which files implement X") were routed through the Delegated Orchestration pipeline: Intent Gateway → PlannedTask → Worker Session → Verifier. This pipeline works well for structured multi-step orchestration tasks, but it produces poor answers for repo-inspection/coding tasks because:

1. The model gets a single shot at the answer after a fixed search→read→answer sequence
2. The verifier can check structural correctness (file references exist, symbols are named) but cannot verify *semantic* correctness (the cited files are actually the implementation, not just search hits)
3. "Do not edit anything" was misclassified as a required step rather than an answer constraint

The right architecture for repo-inspection is an **iterative tool loop** (like OpenClaude), not a delegated worker contract.

## Architecture Split

### Direct Reasoning Mode (new)
- Routes `repo_grounded`/`inspect` operations through an iterative tool-call loop
- Model has access to `fs_search`, `fs_read`, `fs_list` and can call them multiple times
- Answer constraints (`requiresImplementationFiles`, `requiresSymbolNames`, `readonly`) are injected into the system prompt as behavioral guidance
- Progressive output: model produces final text answer after iterative exploration
- Automatic retry escalation: if a stronger provider profile is configured, retry with it automatically

### Delegated Orchestration Mode (existing)
- Continues to handle write/search/write, multi-step tasks, approval-gated operations
- No changes to existing pipeline

### Routing decision
- `shouldHandleDirectReasoningMode` checks the gateway decision:
  - `executionClass === 'repo_grounded'` or `operation === 'inspect'`
  - Tier is not `'local'` (local models use delegated pipeline)
  - Not already handled by direct-assistant inline path
- Falls through to delegated orchestration if direct reasoning fails

## Implementation Phases

### Phase 1: Routing ✅
- Added `shouldHandleDirectReasoningMode` method in `chat-agent.ts`
- Exported `isReadLikeOperation` from `orchestration-role-contracts.ts`
- Added routing check in main dispatch before delegated worker
- **Files:** `src/chat-agent.ts`, `src/runtime/orchestration-role-contracts.ts`

### Phase 2: Direct Reasoning Loop ✅
- Added `handleDirectReasoningMode` — orchestrates system prompt, tool set, loop execution, quality check
- Added `buildDirectReasoningSystemPrompt` — builds a repo-inspection system prompt with answer-constraint guidance (implementation files, symbol names, readonly) and knowledge-base context
- Added `buildDirectReasoningToolSet` — provides `fs_search`, `fs_read`, `fs_list` as `ToolDefinition[]`
- Added `executeDirectReasoningLoop` — iterative tool-call loop (up to 20 turns) with provider fallback
- Added `executeDirectReasoningToolCall` — executes a single tool call via `ToolExecutor.executeModelTool`
- Added `runDirectReasoningQualityCheck` — lightweight structural verification using `deriveAnswerConstraints`
- Added `resolveExecutionProfileProviderOrder` — resolves fallback provider order from `SelectedExecutionProfile`
- Added trace stages: `direct_reasoning_started`, `direct_reasoning_tool_call`, `direct_reasoning_completed` in `IntentRoutingTraceStage`
- **Files:** `src/chat-agent.ts`, `src/runtime/intent-routing-trace.ts`

### Phase 2 Type Fixes ✅
All type errors from initial scaffolding resolved:
- `ChatTool` → `ToolDefinition` (inline import removed, proper import added)
- `ToolCall.function.name/arguments` → `ToolCall.name/arguments` (flat fields, not nested)
- `ChatMessage.tool_calls` → `ChatMessage.toolCalls` / `tool_call_id` → `toolCallId`
- `CodeSessionInfo` → `ResolvedCodeSessionContext`
- `ScopedMessage` → `UserMessage`
- `AgentResult` → `AgentResponse`
- `this.tools.executeTool()` → `this.tools!.executeModelTool()`
- `FallbackResult` → `.response` extraction from `chatWithFallback`/`chatWithProviderOrder`
- `this.emitRoutingTrace?.()` → `this.intentRoutingTrace?.record()`
- `this.logError?.()` → `log.error()`
- `SelectedExecutionProfile.providerFallbackOrder` → `.fallbackProviderOrder`, `.tier` → `.providerTier`
- `promptKnowledge: string[]` → structured knowledge-base object
- `message` (UserMessage) → `message.content` for string parameter
- `isReadLikeOperation` null guard for `undefined` argument
- Tool definitions: OpenAI nested format → flat `ToolDefinition` format
- `buildDirectReasoningToolSet` unused `input` parameter prefixed with `_`

### Phase 3: Progressive Output (not started)
- Stream tool-call progress to web UI during direct reasoning loop
- Add `direct_reasoning_tool_call` events to `run-timeline.ts`
- Render progressive tool results in `chat-panel.js`
- Make output look like OpenClaude's progressive display

### Phase 4: Documentation (not started)
- Update `INTENT-GATEWAY-ROUTING-DESIGN.md` with direct reasoning mode routing
- Update `TOOLS-CONTROL-PLANE-DESIGN.md` with tool visibility for direct reasoning
- Update `INTENT-GATEWAY-AND-DELEGATED-EXECUTION-REALIGNMENT-PLAN.md` status snapshot

## Key Design Decisions

1. **Answer constraints as prompt guidance, not verification gates.** The direct reasoning mode injects `requiresImplementationFiles`, `requiresSymbolNames`, and `readonly` as behavioral instructions in the system prompt. The lightweight quality check after the loop appends warnings but does not block the response.

2. **Automatic provider escalation.** When frontier models are configured, the system automatically retries with the stronger provider if the first attempt fails or produces a low-quality answer. No user prompting required.

3. **Fallback to delegated orchestration.** If the direct reasoning loop crashes or cannot produce a response, the system falls back to the existing delegated worker pipeline. This preserves existing behavior as a safety net.

4. **Read-only tool set.** The direct reasoning tool set (`fs_search`, `fs_read`, `fs_list`) is intentionally read-only. This matches the `readonly` answer constraint for repo-inspection tasks and prevents the model from making changes during an inspection request.

5. **Knowledge base injection.** The system prompt includes `globalContent`, `codingMemoryContent`, and knowledge-base material from `loadPromptKnowledgeBases`, giving the model the same context that the delegated pipeline uses.

## Uncommitted Changes (Phase 2)

```
 docs/design/GOOGLE-WORKSPACE-INTEGRATION-DESIGN.md |   2 +
 src/chat-agent.ts                                  | 481 +++++++++++++++++++-
 src/runtime/intent-routing-trace.ts                |   5 +-
 src/runtime/orchestration-role-contracts.ts        |   4 +-
```

- `src/chat-agent.ts`: All direct reasoning mode methods (routing, system prompt, tool set, loop, quality check, provider order)
- `src/runtime/intent-routing-trace.ts`: Added `direct_reasoning_started`, `direct_reasoning_tool_call`, `direct_reasoning_completed` trace stages
- `src/runtime/orchestration-role-contracts.ts`: Exported `isReadLikeOperation` with null guard
- `docs/design/GOOGLE-WORKSPACE-INTEGRATION-DESIGN.md`: Unrelated doc change (2 lines)

## Manual Web Baseline

After committing Phase 2, test these prompts in the web UI:

1. **Repo inspection (primary target):** "Inspect this repo and tell me which files and functions define the delegated worker completion contract. Cite exact file names and symbol names."
   - Expected: Iterative search/read, then grounded answer citing implementation files with symbol names

2. **Repo inspection with readonly constraint:** "Inspect this repo and tell me which files implement delegated worker progress and run-timeline rendering. Do not edit anything."
   - Expected: Read-only exploration, no file modifications, answer with implementation file citations

3. **Simple chat (regression check):** "Just reply hello back"
   - Expected: Simple reply, no tool calls, no quality warnings

4. **Multi-step orchestration (regression check):** "Write the current date and time to tmp/manual-web/current-time.txt. Search src/runtime for planned_steps. Write a short summary to tmp/manual-web/planned-steps-summary.txt."
   - Expected: Delegated worker pipeline, writes two files, remains stable