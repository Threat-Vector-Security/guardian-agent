---
name: coding-workspace
description: Workflow guidance for backend-owned Guardian coding sessions, including attach/resume across web, CLI, and Telegram.
---

# Coding Workspace

Use this workflow for backend-owned coding sessions inside a project workspace.

The coding session is the authoritative project context:
- use the backend session’s workspace root, workspace profile, focus summary, selected file, and recent work as your default context
- keep repo-local actions inside that workspace
- you may still use broader Guardian capabilities when they directly support the work in this session, such as research, automations, or external service tasks

Preferred loop:
1. If the user wants to continue existing coding work, inspect the current attachment with `code_session_current` or list sessions with `code_session_list`.
2. If no suitable session exists, create one with `code_session_create`, then treat that backend session as the shared source of truth across web, CLI, and Telegram.
3. Understand the request and inspect the relevant files or symbols first.
4. Create or update a concise plan before broad or multi-file edits.
5. Make the smallest safe change with `code_edit`, `code_patch`, or `code_create`.
6. Verify with `code_git_diff` and targeted `code_test`, `code_lint`, or `code_build` runs.

Guardrails:
- Prefer attaching to the right backend coding session over guessing the active workspace from the current chat alone.
- Treat the workspace profile and current focus summary as the default project context, but re-read files before making concrete claims or edits.
- If the user asks what the repo/workspace/app is, inspect the attached workspace first. Start with the workspace root plus `README` and primary manifest/config files, then cite the files you checked.
- Re-read the file before retrying an edit that failed to match.
- Prefer patches for multi-hunk changes and targeted edits for isolated replacements.
- Keep changes within the attached coding session workspace root.
- It is valid to create automations or use non-coding Guardian tools from within the coding session when they are in service of the workspace task, but do not lose the session’s repo context while doing so.
- If the session is getting noisy, summarize progress so it can be compacted without losing the plan.
