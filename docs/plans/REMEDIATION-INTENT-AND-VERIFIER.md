# Remediation Plan: Intent Context and Delegated Verifier

## Executive Summary
This document outlines the root causes of the context loss and insufficient evidence validation in GuardianAgent's multi-agent orchestration, and the completed remediation steps taken to resolve them.

## Identified Issues

### 1. Orchestrator Falsely Satisfied by Discovery Tools
**Symptom:** Ollama cloud models and other weak models fail at complex repo-grounded tasks (e.g. code review or security analysis), giving up after a single tool call but hallucinating a final answer. The orchestrator falsely accepted this as a valid completed task.
**Root Cause:** The `verifyDelegatedResult` logic for `repo_inspection` and `security_analysis` task contracts checked for `successfulReceipts.length <= 0`. Because `find_tools` and other non-execution discovery tools generate a successful receipt, a single `find_tools` call bypassed the evidence requirement. This led the orchestrator to classify the task as `satisfied` instead of `insufficient`, preventing retries or escalation to the frontier models.
**Remediation:** 
- Updated `verifyDelegatedResult` in `src/runtime/execution/verifier.ts` to use `successfulExecutionReceipts` (which filters out discovery tools like `find_tools`) for `repo_inspection` and `security_analysis` cases.
- Also updated `hasFilesystemMutationEvidence` to rely on the execution-only receipt count.

### 2. Intent Gateway Context Loss (Amnesia)
**Symptom:** The chat flow felt unnatural. The agent behaved as though every message was the first turn in a new conversation, completely losing the active chat context.
**Root Cause:** In `src/runtime/incoming-dispatch.ts`, the Intent Gateway requested recent conversation history using a structured query populated with the *current* user message's raw text. The underlying `ConversationService`'s `selectContiguousHistoryWindow` algorithm heavily penalizes older messages based on length (subtracting `Math.round(chars / 64)`) unless they match the query text. Since past messages never contain the exact text of the *current* new message, they received massive length penalties without matching bonuses, shrinking the returned context window to zero or one turn.
**Remediation:**
- Removed the `query` argument from `args.conversations.getHistoryForContext()` in `src/runtime/incoming-dispatch.ts` when retrieving `recentHistory` for the gateway.
- This ensures `ConversationService` falls back to `selectRecentHistoryWindow`, which faithfully returns the last `N` messages without dropping context due to search penalization, perfectly aligning with the documented intent gateway design (last 6 conversation entries).

### 3. Code Session Targeting Ambiguity (Fuzzy Path Collisions)
**Symptom:** When a user asked to "switch back to the main GuardianAgent repo", the `code_session_attach` tool failed with `No coding session matched "main GuardianAgent repo".` 
**Root Cause:** The `resolveCodeSessionTarget` algorithm applies multiple matching passes (exact, fuzzy, normalized exact, normalized fuzzy, semantic exact, semantic fuzzy). The user's query "main GuardianAgent repo" normalized to `guardianagent` after stripping generic words like "main", "repo", and "the". This semantic string (`guardianagent`) matched *two* sessions via the semantic fuzzy pass:
1. The real `Guardian Agent` session (title: "Guardian Agent" -> `guardianagent`).
2. The `TempInstallTest` session (workspaceRoot: `S:\Development\GuardianAgent\tmp\guardian-ui-package-test` -> includes `guardianagent`).
Because it found two fuzzy matches and no single exact match (since "main GuardianAgent repo" didn't exactly equal "Guardian Agent"), the algorithm defensively aborted and returned an ambiguity error.
**Remediation:**
- Updated `resolveMatchSet` in `src/runtime/code-session-targets.ts` to include tie-breaking heuristics when multiple semantic fuzzy matches occur.
- If multiple sessions fuzzy match the semantic needle, the resolver now checks if exactly *one* of them perfectly matches the needle against its `title` or the suffix of its `workspaceRoot`. If so, it confidently selects that session instead of throwing an ambiguity error.

### 4. `filesystem_mutation` Verification Bypass via Discovery Tools
**Symptom:** When a user requested a file creation task (e.g., "Create a new file..."), the task contract resolved to `filesystem_mutation`. However, the delegated worker only ran `fs_list` and `fs_search` (which are discovery/read tools) and completed successfully without writing a file. The verifier wrongly accepted it as a successful mutation.
**Root Cause:** In `buildClaimsFromReceipts` inside `src/worker/worker-session.ts`, the code blindly added a `filesystem_mutation` claim for *any* successful receipt whenever the task contract expected a `filesystem_mutation`. Since `fs_list` succeeded, it generated a mutation claim, completely subverting the verification check.
**Remediation:** 
- Modified `buildClaimsFromReceipts` to only push a `filesystem_mutation` claim if the tool is *not* a known read-only discovery tool. 
- Created an `isReadOnlyEvidenceTool` helper whitelist (`fs_list`, `fs_read`, `fs_search`, etc.) to prevent read-only tools from faking mutation claims.

### 5. `requireExactFileReferences` Contract Derivation Ignored
**Symptom:** When a user explicitly asked to "find the exact file and line number," the intent gateway correctly classified the request, and the heuristic `requestNeedsExactFileReferences` resolved to `true`. However, the verifier didn't enforce exact file citations, allowing a weak model to hallucinate a path without executing a valid file read.
**Root Cause:** The structured recovery path for the Intent Gateway (`src/runtime/intent/structured-recovery.ts`) prioritized the model's parsed JSON output for `requireExactFileReferences` (which was `false` due to model hallucination/laziness) over the robust deterministic heuristic. 
**Remediation:**
- Updated the recovery resolution logic so that if the model returns `false` but the deterministic `requestNeedsExactFileReferences` heuristic is `true`, the heuristic forcefully overrides the model's value. The `provenance` metadata was also updated to reflect this override.

### 6. Second Brain Natural Language Note Content Extraction
**Symptom:** When a user asked to "Add a note to my Second Brain reminding me to XYZ", the direct intent handler failed to extract "XYZ" and prompted the user "To save a local note, I need the note content."
**Root Cause:** `extractSecondBrainTextBody` in `src/chat-agent.ts` strictly looked for quoted text (e.g., `"..."`) or the exact phrase `saying: "..."`. Natural language bodies without quotes were entirely missed.
**Remediation:**
- Extended `extractSecondBrainTextBody` with a regex fallback (`/\b(?:reminding\s+me(?:\s+to|\s+that)?|saying(?:\s+that)?|about|that)\s+([\s\S]+?)(?:$|\n)/i`) to gracefully extract unquoted sentence payloads and strip trailing punctuation.

### 7. Exact File Citation False-Positives via Generic Search Roots
**Symptom:** Even with exact file requirements enforced, a model hallucinated an answer containing `src/types/records.ts` (which doesn't exist) and the verifier accepted it as a valid file citation.
**Root Cause:** The `extractRefsFromUnknown` function naively pulls every `path:` value out of a tool call's arguments to generate `file_reference` claims. Because the model ran `fs_list` on `.` and `src`, the verifier tracked `.` and `src` as valid file claims. The `finalAnswerCitesFileReference` function checked if the model's final answer included any of these claim substrings. Since the hallucinated path `src/types/records.ts` contains the string `src`, the verifier incorrectly concluded that the model successfully cited a valid file claim.
**Remediation:**
- Hardened `finalAnswerCitesFileReference` in `src/runtime/execution/verifier.ts` to ignore generic directory paths (e.g., `.`, `src`, `docs`, `test`, `lib`) when cross-referencing citations against the model's final answer. This forces the verifier to only accept matches against specific file paths retrieved by the tools, shutting down hallucinated path bypasses.

### 8. Delegated Worker Identity Sandboxing in Code Session Tools
**Symptom:** Even when workspace ambiguity was resolved, asking to "Switch to Guardian Agent repo" failed inside the delegated worker with `No coding session matched "Guardian Agent"`.
**Root Cause:** Under `BROKERED-AGENT-ISOLATION-DESIGN.md`, the worker process runs with an isolated, temporary identity (e.g., `userId: code-session:<id>`). However, the `code_session_attach`, `code_session_detach`, `code_session_list`, and `code_session_create` tools strictly queried the session database using the immediate `request.userId`. Since the worker's sandboxed identity didn't own the human's real workspaces, the database returned an empty list, causing the tool to fail.
**Remediation:**
- Updated the tools in `src/tools/builtin/coding-tools.ts` and the `ToolExecutor` helper `getRealOwnerUserId` (`src/tools/executor.ts`) to detect when a request is initiated by a delegated identity (e.g., `code-session:`, `delegated-task:`, `sched-task:`).
- In those cases, the tools now securely fall back to `request.principalId`, properly resolving to the original human owner's identity and granting the worker permission to attach to the target session.

## Post-Remediation Verification
- Verified `test-coding-assistant.mjs` harness passed, confirming no regressions in tool validation or classification.
- Verified `test-code-ui-smoke.mjs` harness passed, confirming web interactions and approvals remain intact.
- Validated that the orchestrator now properly escalates unevidenced delegated results to configured frontier/escalation execution profiles instead of accepting hallucinated answers.
- Validated that `resolveCodeSessionTarget` safely disambiguates temporary child workspaces from parent workspaces when searching by fuzzy semantic names.
- Validated that `hasFilesystemMutationEvidence` safely rejects false-positive read-only tool calls pretending to be mutating receipts.
- Validated that `requestNeedsExactFileReferences` heuristic correctly overrides model omissions.
- Validated that `extractSecondBrainTextBody` successfully captures unquoted conversational intent payloads.
- Validated that `finalAnswerCitesFileReference` enforces strict path matching and rejects overly generic directory substring collisions.
- Validated that `code_session_*` tools properly penetrate the worker sandbox identity boundary by safely resolving the human owner via `principalId`.

### 9. Worker Sandbox Identity Boundary (`principalId` drop)
- **Symptom:** When the Intent Gateway delegated a task to a worker (e.g. `Find out what coding sessions I have available`), the worker could not list or attach to the user's code sessions. The worker operated with an isolated `code-session:<id>` principal that owned no workspaces, preventing session switching.
- **Root Cause:** The `principalId` and `principalRole` fields were missing from the `LlmLoopOptions` interface bridging the worker's LLM loop to the `ToolCaller`. The executor received `undefined` and fell back to the worker's sandboxed `userId`.
- **Remediation:** Threaded `principalId` and `principalRole` through `WorkerSession.handleMessage` into `LlmLoopOptions` and passed them down to the `toolCallerWithDiscovery` wrapper. The worker now safely proxies the user's true identity for tool execution authorization.
