# Test Tools Results — Round 7 (memory_save always-loaded)

**Date:** 2026-03-08
**Script:** `scripts/test-tools.ps1`
**Changes since Round 6:** Promoted `memory_save` to always-loaded (10 total, was 9)
**Model:** Local (Ollama gpt-oss:latest) with external fallback (OpenAI gpt-4o)

## Summary

**Pending re-run** — expected 85/85 based on diagnostic results.

## Diagnostic Results (`scripts/test-memory-save.ps1`)

| Test | Prompt | Result |
|------|--------|--------|
| test1 | "save this to your memory: ..." (original) | FAIL — LLM said "I can't persist information" (memory_save was deferred, not visible) |
| test2 | "use the memory_save tool to save..." | PASS — explicit tool name triggered find_tools |
| test3 | "call find_tools to locate memory_save, then..." | PASS |
| test4 | "remember this for future conversations..." | PASS — already discovered from test2 |
| test5 | two-step: discover then save | PASS |

## Root Cause

`memory_save` was deferred (not always-loaded). On the first message of a conversation, the LLM saw `memory_search` (always-loaded, read_only) but not `memory_save`. When asked to "save to memory", it concluded it couldn't persist information instead of calling `find_tools` to discover the tool.

## Fix Applied

Removed `deferLoading: true` from `memory_save` in `src/tools/executor.ts`. Added to always-loaded config default in `src/config/types.ts`. Always-loaded tools now: `find_tools`, `web_search`, `fs_read`, `fs_list`, `fs_search`, `shell_safe`, `memory_search`, `memory_save`, `sys_info`, `sys_resources` (10 total).

## Progression

| Round | PASS | FAIL | Key Change |
|-------|------|------|------------|
| Baseline | 46 | 36 | Before any fixes |
| Round 1 | 62 | 21 | Non-blocking approvals, tool guidance, always-loaded tools |
| Round 2 | 76 | 9 | Prompt improvements, sandbox setup |
| Round 3 | 78 | 7 | Widened assertions, prompt tuning |
| Round 4 | 80 | 5 | Local model full descriptions |
| Round 5 | 80 | 5 | Quality-based fallback |
| Round 6 | 82 | 3 | Renamed find_tools, memory_recall |
| Round 7 | 84 | 1 | Fallback passes tools + executes tool calls |
| Round 8 | TBD | TBD | memory_save always-loaded |
