---
name: coding-workspace
description: Use when the request is about a repo, codebase, implementation, bugfix, or backend-owned coding session that should stay anchored to the active workspace.
---

# Coding Workspace

## Overview / When to Use

Use this workflow for backend-owned coding sessions inside a project workspace when Guardian should do the coding work directly with built-in tools.

Explicit delegation to terminal-backed coding assistants such as Codex, Claude Code, Gemini CLI, or Aider belongs to the separate `coding-backend-orchestration` workflow.

The coding session is the authoritative project context:
- use the backend session’s workspace root, workspace profile, indexed repo map, working-set files, focus summary, selected file, and recent work as your default context
- keep repo-local actions inside that workspace
- do not preload host-application context when reasoning inside the coding session
- use the coding session’s own long-term memory as the default memory scope; do not assume global memory is available unless explicitly bridged
- you may still use broader tools and capabilities, including non-coding tasks, but do not let that replace the session’s repo anchor unless the user explicitly changes sessions or retargets the work

## Process

1. If the user wants to continue existing coding work, inspect the current attachment with `code_session_current` or list sessions with `code_session_list`.
2. If no suitable session exists, create one with `code_session_create`, then treat that backend session as the shared source of truth across web, CLI, and Telegram. Shared session state does not mean those surfaces have the same UI or transport.
3. Understand the request and inspect the relevant files or symbols first. Treat the workspace profile, indexed repo map, and current working set as the default project context, but re-read files before making concrete claims or edits.
4. Create or update a concise plan with explicit acceptance gates before broad or multi-file edits.
5. Make the smallest safe change with `code_edit`, `code_patch`, or `code_create`. Prefer patches for multi-hunk changes and targeted edits for isolated replacements.
6. Verify with `code_git_diff` and the strongest existing relevant checks before falling back to narrower ad hoc tests.
7. If the session is getting noisy, summarize progress so it can be compacted without losing the plan.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll guess the active workspace from chat context." | Prefer attaching to the right backend coding session over guessing. If explicitly targeted session is missing, reattach rather than downgrading into generic chat. |
| "I'll assume the codebase works the way it did earlier." | Re-read the file before retrying an edit that failed or making a concrete claim about its contents. |
| "This file needs cleaning up while I'm here." | Keep changes within the attached coding session workspace root and focused only on the current task. |
| "I can use global memory context for this local code decision." | Coding session long-term memory is local. Global memory must be explicitly bridged and read-only. |

## Red Flags

- Treating a plain web or CLI turn as a coding-session turn unless the backend session is attached.
- Relying on workspace summaries alone when making code claims.
- Expanding beyond the active repo/session anchor during broader research or automation work.
- Making a coding claim without citing the files you checked.

## Verification

- [ ] The attached backend coding session matches the user's intended target workspace.
- [ ] All code edits remain within the attached coding session workspace root.
- [ ] You have re-read the relevant files before claiming behavior or writing code.
- [ ] You have verified the change with `code_git_diff` and the strongest existing checks (e.g., `npm test`, build steps).
- [ ] The real proof surface is fully green, not just the smallest local check.
