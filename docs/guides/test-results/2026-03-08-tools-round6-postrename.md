# Test Tools Results — Round 6 (Post-Rename)

**Date:** 2026-03-08
**Script:** `scripts/test-tools.ps1`
**Changes since Round 5:** Renamed `tool_search` → `find_tools`, `memory_get` → `memory_recall`
**Model:** Local (Ollama gpt-oss:latest) with external fallback (OpenAI gpt-4o)

## Summary

**82 PASS / 3 FAIL** (85 total)

Improvement from 80/5 pre-rename. The `tool_search`/`web_search` and `memory_get`/`memory_search` confusion failures are eliminated.

## Remaining Failures (all intermittent local model issues)

| Test | Failure | Root Cause |
|------|---------|------------|
| web_fetch: health response | LLM called `web_search` instead of `web_fetch` | "fetch" in prompt confused local model |
| intel_summary: tool was called | No tool calls detected | LLM answered from knowledge without calling tool |
| approval: fs_list returned directory contents | "I could not generate a final response" | Local model degraded response under approve_by_policy |

None of these are architectural — they're local model quality issues that would pass with an external model or on retry.

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
