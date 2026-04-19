# Test Tools Results — Round 5 (Pre-Rename)

**Date:** 2026-03-08
**Script:** `scripts/test-tools.ps1`
**Changes since Round 4:** Quality-based fallback from local to external LLM, auto-configured fallback chain, `qualityFallback` config setting (enabled by default)
**Model:** Local (Ollama) with external fallback

## Summary

**80 PASS / 5 FAIL** (85 total)

## Known Remaining Failures

1. **fs_mkdir** — LLM doesn't discover deferred `fs_mkdir` tool via `tool_search`
2. **intel_summary** — Intermittent local model failure
3. **sys_processes** — Intermittent local model failure
4. **tool_search/web_search confusion** — LLM confuses `tool_search` with `web_search` (addressed by rename to `find_tools`)
5. **memory_get/memory_search confusion** — LLM confuses `memory_get` with `memory_search` (addressed by rename to `memory_recall`)

## Changes Applied

- Quality-based fallback: detects degraded local LLM responses (empty, refusals) and auto-retries via external provider
- Auto-configured fallback chain when multiple LLM providers exist
- `qualityFallback` config setting added (default: true)

## Next Step

Renamed `tool_search` → `find_tools` and `memory_get` → `memory_recall` to reduce LLM confusion. Re-run needed to verify impact.
