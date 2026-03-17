# Coding Assistant Spec

**Status:** As Built
**Date:** 2026-03-17
**Primary UI:** [code.js](/mnt/s/Development/GuardianAgent/web/public/js/pages/code.js)
**Primary Web API:** [web.ts](/mnt/s/Development/GuardianAgent/src/channels/web.ts)
**Primary Tools:** [executor.ts](/mnt/s/Development/GuardianAgent/src/tools/executor.ts)

## Purpose

The Coding Assistant is the `Code` page in the web UI. It provides a project-scoped workspace for:

- repository browsing
- file inspection
- diff inspection
- coding-focused assistant chat
- persistent PTY-backed terminals
- session-scoped approval handling
- session-scoped work/status visibility

It runs on top of the existing Guardian web API and tool system. It is not a separate runtime.

## Current Architecture

The current Code page is implemented as a browser-side workspace shell with server-backed tool and chat calls.

Core pieces:

- Code page UI: [code.js](/mnt/s/Development/GuardianAgent/web/public/js/pages/code.js)
- Styles: [style.css](/mnt/s/Development/GuardianAgent/web/public/css/style.css)
- Generic web API client: [api.js](/mnt/s/Development/GuardianAgent/web/public/js/api.js)
- Web API server: [web.ts](/mnt/s/Development/GuardianAgent/src/channels/web.ts)
- Coding tool registrations: [executor.ts](/mnt/s/Development/GuardianAgent/src/tools/executor.ts)

## Session Model

Code sessions are stored in browser `localStorage`.

Each session contains:

- session id
- title
- workspace root
- resolved root
- selected file
- diff toggle state
- expanded explorer directories
- terminal tabs and terminal output
- assistant chat history
- draft assistant message
- active assistant sidebar tab
- pending approvals for that Code session
- recent coding job/check state for that Code session
- selected agent id

If no sessions exist, the page creates a default session automatically.

## Workspace UI

The Code page has five visible areas:

- session rail
- explorer
- editor/diff viewer
- terminal panes
- assistant sidebar

The session rail lets the user:

- create a session
- edit the session title and workspace root
- delete a session
- switch between sessions

The explorer uses `fs_list` to load directory contents.

The editor uses:

- `fs_read` for source content
- `code_git_diff` for diff output

The assistant sidebar is tabbed so the coding conversation stays readable.

Current tabs:

- `Chat`
- `Tasks`
- `Approvals`
- `Checks`

Behavior as built:

- `Chat` is the only normal conversation surface
- `Tasks` shows active plan/status summaries plus recent coding jobs
- `Approvals` shows pending approval cards and actions for the active Code session
- `Checks` shows recent verification-oriented job results
- approval state does not auto-switch the active tab
- chat shows a small non-blocking approval notice instead of full inline approval cards
- session cards in the rail surface approval/task/check badges

The chat tab sends a normal web message with extra coding context injected into the prompt, including:

- workspace root
- current directory
- selected file
- active skills
- active plan summary
- compacted summary
- pending approval count

The chat tab also sends structured request metadata:

- `metadata.codeContext.sessionId`
- `metadata.codeContext.workspaceRoot`

That metadata is the enforcement hook for assistant-driven Code sandboxing. The prompt text gives the model context; the structured metadata is what scopes tool execution.

Code chat is separate from the rest of the app’s general chat. Each Code session uses its own session-scoped web user id, so Code history is not mixed into the global chat panel.

## Coding Tools Available

The Code page relies on the existing coding tool set registered in the main tool executor.

Built-in coding tools:

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

These tools are part of the global tool catalog and are not Code-page-only APIs.

## Code-Scoped Tool Sandbox

Assistant-driven tool calls from the Code page run with a request-scoped workspace context.

As built:

- file and coding tools resolve paths against the active Code session `workspaceRoot`
- the effective `allowedPaths` set becomes that single workspace root for the request
- `shell_safe` uses a Code-specific command allowlist instead of widening the global web-chat shell allowlist
- common coding commands such as `git`, build/test runners, and repo-local package-manager commands are available in Code without adding them to the global shell policy
- shell validation still blocks chain operators, redirections to denied paths, and subshell execution
- Code-specific shell validation also blocks repo-escape and global-install patterns such as `git -C`, `--git-dir`, `--work-tree`, `--prefix`, `--cwd`, `--cache*`, `--userconfig`, `--globalconfig`, `-g`, `--global`, `global`, and `--user`
- path-like shell args and redirect targets that resolve outside the active workspace root are denied
- common tool caches are redirected into `<workspaceRoot>/.guardianagent/cache`

This gives the Code page a broader repo-work shell surface without widening the global assistant shell policy.

## Terminal Behavior

The terminal area is a PTY-backed shell surface in the Code page.

Behavior as built:

- terminals are per-session UI panes
- each pane maps to a server-side PTY process
- output is streamed to the browser over SSE
- shell state persists within the pane while the session is alive
- pane output is also cached in browser state for reload continuity
- the browser surface uses `xterm.js`
- sessions can have multiple terminal panes
- pane state survives route changes within the same browser session

## Shell Execution Path

Manual shell terminals in the Code page use dedicated Code terminal endpoints:

- `POST /api/code/terminals`
- `POST /api/code/terminals/:id/input`
- `POST /api/code/terminals/:id/resize`
- `DELETE /api/code/terminals/:id`

Terminal output and exit events are streamed over SSE:

- `terminal.output`
- `terminal.exit`

The backend uses `node-pty` to spawn the selected shell as a PTY process.

Important boundary:

- these PTY terminals are manual operator surfaces
- they are not driven by assistant tool calls
- they do not currently inherit the assistant’s Code-scoped shell allowlist or repo-bound argument checks

## Shell Selection

Shell options are platform-dependent.

Windows options in the current implementation:

- PowerShell
- CMD
- Git Bash
- WSL
- Bash

macOS options:

- Zsh
- Bash
- sh

Linux options:

- Bash
- Zsh
- sh

Shell selection affects which executable is used when the PTY terminal session is created.

## Current Limitations

As built, the Code page does not provide:

- server-side Code session persistence
- durable server-side work-state/todo storage separate from browser session state
- dedicated task/subagent orchestration in the Code runtime yet
- automatic stuck-state smart routing/escalation yet
- repo-jailed PTY terminals matching the assistant-driven Code tool sandbox yet

## Verification

Relevant implementation checks in the repo:

- coding assistant harness: [test-coding-assistant.mjs](/mnt/s/Development/GuardianAgent/scripts/test-coding-assistant.mjs)
- code UI smoke: [test-code-ui-smoke.mjs](/mnt/s/Development/GuardianAgent/scripts/test-code-ui-smoke.mjs)
