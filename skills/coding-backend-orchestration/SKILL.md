---
name: coding-backend-orchestration
description: Use when the user explicitly asks Guardian to launch or check an external coding assistant such as Codex, Claude Code, Gemini CLI, or Aider.
---

# Coding Backend Orchestration

## Overview / When to Use

Use this workflow only when the user explicitly wants Guardian to launch or inspect an external coding assistant.

This is distinct from normal repo-grounded coding work:
- if the user asks Guardian to inspect, edit, patch, search, or test code directly, stay on the built-in coding tools
- if the user explicitly says to use Codex, Claude Code, Gemini CLI, or Aider, launch that backend with `coding_backend_run`
- mentioning a backend as the subject of a question is not enough to relaunch it

## Process

1. Confirm the active coding session or list available sessions with `code_session_current` or `code_session_list` if the target workspace is unclear.
2. If needed, inspect available backends with `coding_backend_list`.
3. Launch the requested backend with `coding_backend_run` from the active coding session workspace.
4. If the user is asking whether a delegated run finished or what happened, use `coding_backend_status`.
5. After a backend run completes, verify the result with `code_git_diff` and the strongest relevant checks such as `code_test`, `code_build`, or `code_lint`.
6. Report backend output as delegated work, not as if Guardian performed the edits directly.

## Red Flags

- Treating "Why did Codex do that?" as permission to start a new Codex run.
- Launching an external backend when the user only asked for direct repo inspection.
- Reporting delegated backend work as successful without verification.
- Running a backend outside the active coding session workspace.

## Verification

- [ ] The user explicitly requested an external coding backend.
- [ ] The delegated run stayed anchored to the active coding session workspace.
- [ ] You checked completion or recent runs with `coding_backend_status` when needed.
- [ ] You verified the delegated result with `code_git_diff`, `code_test`, `code_build`, or `code_lint` before reporting success.
