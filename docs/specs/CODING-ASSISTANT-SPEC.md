# Coding Assistant Spec

**Status:** As Built  
**Date:** 2026-03-17  
**Primary UI:** [code.js](/mnt/s/Development/GuardianAgent/web/public/js/pages/code.js)  
**Primary Runtime:** [index.ts](/mnt/s/Development/GuardianAgent/src/index.ts)  
**Code Session Store:** [code-sessions.ts](/mnt/s/Development/GuardianAgent/src/runtime/code-sessions.ts)  
**Primary Web API:** [web.ts](/mnt/s/Development/GuardianAgent/src/channels/web.ts)  
**Primary Tools:** [executor.ts](/mnt/s/Development/GuardianAgent/src/tools/executor.ts)

## Purpose

The Coding Assistant is Guardian’s repo-scoped coding workflow surface.

It provides:

- backend-owned coding sessions
- repo-aware assistant chat with backend workspace profiling
- explorer and source/diff inspection
- approval-aware coding execution
- PTY terminals for manual operator shell work
- session resume across web, main chat, CLI, and Telegram
- broader Guardian actions performed from the active workspace context

It is not a separate runtime. It is a coding mode built on the main Guardian runtime, tool executor, conversation service, and policy system.

## Architecture Summary

The important architectural change is that coding sessions are now backend-owned.

The browser no longer owns the authoritative coding session. The browser is now a client of a backend `CodeSession`.

Core layers:

- backend `CodeSessionStore` persists coding sessions and surface attachments
- backend workspace profiling builds durable repo identity for each session
- `ConversationService` stores the coding transcript for each session conversation identity
- `ChatAgent` resolves attached or explicit coding sessions before prompt assembly and tool execution
- `ToolExecutor` exposes coding-session tools and enforces repo-scoped coding sandbox rules
- the Code page renders and edits a server-owned session, but still keeps transient UI cache locally

## Backend-Owned Code Sessions

Code sessions are persisted in the backend by [code-sessions.ts](/mnt/s/Development/GuardianAgent/src/runtime/code-sessions.ts).

Primary persisted shape:

- `CodeSessionRecord`
  - `id`
  - `ownerUserId`
  - `ownerPrincipalId`
  - `title`
  - `workspaceRoot`
  - `resolvedRoot`
  - `agentId`
  - `status`
  - `attachmentPolicy`
  - `createdAt`
  - `updatedAt`
  - `lastActivityAt`
  - `conversationUserId`
  - `conversationChannel`
  - `uiState`
  - `workState`
- `CodeSessionUiState`
  - `currentDirectory`
  - `selectedFilePath`
  - `showDiff`
  - `expandedDirs`
  - `activeAssistantTab`
  - `terminalCollapsed`
  - `terminalTabs`
- `CodeSessionWorkState`
  - `focusSummary`
  - `planSummary`
  - `compactedSummary`
  - `workspaceProfile`
  - `activeSkills`
  - `pendingApprovals`
  - `recentJobs`
  - `changedFiles`
  - `verification`
- `CodeSessionAttachmentRecord`
  - `codeSessionId`
  - `userId`
  - `principalId`
  - `channel`
  - `surfaceId`
  - `mode`
  - `attachedAt`
  - `lastSeenAt`
  - `active`

Persistence uses SQLite when available and falls back to in-memory storage otherwise.

## Workspace Awareness Model

The Coding Assistant no longer relies only on a workspace path and ad hoc prompt wording.

Each backend `CodeSession` carries durable workspace awareness state:

- `workspaceProfile`
  - repo name
  - repo kind
  - stack/framework hints
  - key manifests inspected
  - top-level entries
  - likely entry/focus points
  - summary of what the repo appears to be
- `focusSummary`
  - short durable summary of the current coding objective for that session

Workspace profiling is built from lightweight backend inspection of the session root, `README`, and primary manifest/config files. That profile is then injected into the coding-session prompt on later turns.

This is the mechanism that makes the Coding Assistant feel project-aware in the same way a dedicated coding agent should, rather than behaving like a general chat that merely has file tools.

## Conversation Model

Each coding session gets its own backend conversation identity:

- `conversationUserId = code-session:<sessionId>`
- `conversationChannel = code-session`

That means:

- a coding session has one durable coding transcript
- the transcript is separate from the normal main-chat transcript
- web Code, main chat, CLI, and Telegram can all attach to the same coding session and continue that same coding transcript

The Code page is still a separate coding conversation surface in UX terms, but it is no longer a browser-only conversation.

## Attach And Resume Model

Guardian supports two ways to enter a coding session:

1. Explicit session targeting  
   The client sends `metadata.codeContext.sessionId`.

2. Surface attachment  
   A chat surface is attached to a `CodeSession`, and later messages on that surface inherit it automatically.

Surface attachment is tracked in `CodeSessionStore`.

Current behavior:

- the Code page sends explicit `sessionId` metadata on chat requests
- main chat, CLI, and Telegram can use `code_session_attach`
- once attached, later messages on that surface resolve to the same coding session

## Routing Behavior

Routing is code-session-aware.

When an incoming message is tied to a coding session:

- Guardian first checks for an explicit or attached backend coding session
- if one exists, routing prefers that session’s bound `agentId`
- if the session is not yet bound, routing prefers the local/coding-capable agent tier
- only non-coding messages fall back to normal tier routing

This prevents “continue that coding session” style follow-ups from being routed as unrelated general chat.

## Capability Model

The Coding Assistant is workspace-centered, not coding-only.

That means:

- repo-local actions such as file edits, shell commands, git operations, tests, builds, and lint runs stay scoped to the active `workspaceRoot`
- the assistant may still use broader Guardian capabilities when they directly support the coding session, such as research, web/docs lookup, or creating automations
- unrelated general-assistant tasks should remain in the main chat instead of diluting the coding session

In practice, the coding session is the anchor. Broader tools are allowed when they serve that anchored workspace task.

## Code Page UI Model

The Code page keeps the existing layout:

- session rail
- explorer
- editor/diff viewer
- terminal panes
- assistant sidebar

The assistant sidebar remains tabbed:

- `Chat`
- `Tasks`
- `Approvals`
- `Checks`

Behavior:

- `Chat` is the main back-and-forth coding conversation
- `Tasks` shows plan and recent coding activity
- `Approvals` shows queued coding approvals
- `Checks` shows recent verification outcomes
- the UI does not auto-switch tabs when approvals appear
- chat shows only a small approval notice instead of dumping approval cards inline

## Code Page State Ownership

Authoritative server state:

- session list
- session metadata
- workspace root and resolved root
- workspace profile
- focus summary
- coding transcript
- conversation identity
- pending approvals
- recent jobs
- active skills
- plan/compaction summaries

Browser-side cache only:

- cached session copies for faster reload
- unsent chat draft
- live terminal output buffer
- temporary runtime terminal ids
- dir-picker state

If the browser cache disagrees with the backend, the backend wins.

## Web API Methods

Primary backend-owned session methods:

- `GET /api/code/sessions`
  - returns the user’s backend coding sessions and the currently attached session for that surface
- `POST /api/code/sessions`
  - creates a backend coding session
- `GET /api/code/sessions/:id`
  - returns session metadata plus coding transcript history
- `PATCH /api/code/sessions/:id`
  - updates session metadata or persisted UI/work state
- `DELETE /api/code/sessions/:id`
  - deletes the backend coding session
- `POST /api/code/sessions/:id/attach`
  - attaches the current surface to that coding session
- `POST /api/code/sessions/detach`
  - detaches the current surface
- `POST /api/code/sessions/:id/reset`
  - resets the coding transcript for that session

Session-backed direct Code UI methods:

- `POST /api/code/fs/list`
- `POST /api/code/fs/read`
- `POST /api/code/git/diff`
- `POST /api/code/terminals`
- `POST /api/code/terminals/:id/input`
- `POST /api/code/terminals/:id/resize`
- `DELETE /api/code/terminals/:id`

For `fs`, `diff`, and terminal open requests, the client can supply `sessionId`. The backend resolves the session and enforces the workspace root from the session record instead of trusting a browser-supplied root path.

## Chat Request Metadata

The authoritative coding-session request hook is:

- `metadata.codeContext.sessionId`

`workspaceRoot` may still appear for compatibility, but backend session resolution is the real authority.

Chat flow:

- the Code page sends a normal `/api/message` request
- it includes `metadata.codeContext.sessionId`
- `ChatAgent` resolves the backend session
- prompt assembly includes structured coding-session context plus the durable workspace profile and focus summary
- tool execution gets a repo-scoped `codeContext`

## Main Chat And Remote Channels

The main Guardian agent can see coding sessions through coding-session tools:

- `code_session_list`
- `code_session_current`
- `code_session_create`
- `code_session_attach`
- `code_session_detach`

That means:

- main chat can inspect available coding sessions
- main chat can attach to one and continue it
- CLI and Telegram can do the same
- all of them can continue the same backend coding transcript

The web Code page is still the richest coding client, but it is no longer the only client.

## Coding Tooling

Built-in coding session tools:

- `code_session_list`
- `code_session_current`
- `code_session_create`
- `code_session_attach`
- `code_session_detach`

Built-in coding implementation tools:

- `code_symbol_search`
- `code_edit`
- `code_patch`
- `code_create`
- `code_plan`
- `code_git_diff`
- `code_git_commit`
- `code_test`
- `code_build`
- `code_lint`

These remain global tools in the main executor. The Code page uses them through session-aware context, not through a separate coding runtime.

## Sandbox And Security Model

Assistant-driven coding requests remain repo-scoped.

As built:

- the active coding workspace root comes from the backend `CodeSession`
- effective file access for coding requests is pinned to that single workspace root
- coding requests use the Coding Assistant shell allowlist instead of widening the global assistant shell policy
- path-like shell arguments are validated against the active workspace root
- repo-escape patterns like `git -C`, `--git-dir`, `--work-tree`, `--prefix`, `--cwd`, `--cache*`, `--global`, `-g`, and similar global-install or external-path patterns are blocked
- common command caches are redirected into `<workspaceRoot>/.guardianagent/cache`

This wider coding shell surface applies only when a request is running with coding-session context.

## Terminal Model

The Code page terminal area is still a manual PTY surface.

As built:

- terminals are opened from the current coding session workspace
- terminals are session-associated in the UI
- output is streamed over SSE
- terminals use `xterm.js`
- multiple panes are supported

Important boundary:

- PTY terminals are still operator-controlled
- the assistant does not remote-control those PTYs in v1
- assistant-driven coding shell execution still goes through the guarded tool path, not through PTY takeover

## Persistence Split

Guardian now uses two different persistence layers for coding:

General memory system:

- durable cross-channel memory facts
- searchable chat history
- normal conversation sessions
- memory flush/compaction support

Backend `CodeSessionStore`:

- active coding session records
- surface attachments
- coding UI state
- coding work state
- shared coding conversation identity

The memory system is not the live coding session state machine. The backend `CodeSessionStore` is.

## Current Limitations

As built, the Coding Assistant still does not provide:

- assistant-driven remote control of live PTY terminals
- repo-jailed PTYs matching the assistant shell validator exactly
- dedicated subagent `task` orchestration in the coding runtime yet
- automatic smart-routing escalation when the model gets stuck yet
- fully event-driven cross-client live sync; the Code page currently relies on refresh/polling and normal session reload paths

## Verification

Relevant checks:

- typecheck: `npm run check`
- executor unit tests: `npm test -- src/tools/executor.test.ts`
- code UI smoke: [test-code-ui-smoke.mjs](/mnt/s/Development/GuardianAgent/scripts/test-code-ui-smoke.mjs)
- coding assistant harness: [test-coding-assistant.mjs](/mnt/s/Development/GuardianAgent/scripts/test-coding-assistant.mjs)

Validated during this implementation:

- `node scripts/test-code-ui-smoke.mjs`
- `node scripts/test-coding-assistant.mjs`
- `HARNESS_USE_REAL_OLLAMA=1 node scripts/test-coding-assistant.mjs --use-ollama`
