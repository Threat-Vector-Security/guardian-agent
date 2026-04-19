# Automation LLM-Path Test Results — 2026-03-09 Round 2 (Retest)

**Script:** `scripts/test-automations-llm-retest.ps1`
**LLM Providers:** ollama (gpt-oss:latest, local) + openai (gpt-4o, external)
**Result:** 21 PASS, 0 FAIL, 0 SKIP (21 total)

## Key Change

Changed `automation` category routing from `local` to `external` in `CATEGORY_NATURAL_LOCALITY` (`src/index.ts`).

The local model (gpt-oss) handles simple automation tool calls (list, delete, single-step create) but consistently fails to invoke `workflow_upsert` with complex multi-step structured arguments — it describes actions instead of calling tools. Routing automation through the external model (gpt-4o) resolves this completely.

## All Previously-Failed Tests Now Pass

| Test | Round 1 | Round 2 | Fix |
|------|---------|---------|-----|
| create-pipeline: sequential workflow_upsert | FAIL (find_tools only) | PASS | external routing |
| create-pipeline: parallel workflow_upsert | FAIL (no tool calls) | PASS | external routing |
| compose-http: workflow_upsert | FAIL (no tool calls) | PASS | external routing |
| compose-net: workflow_upsert | FAIL (no tool calls) | PASS | external routing |
| run: pipeline execution | FAIL (cascade) | PASS | section 3 fix |
| edge: reports automation not found | FAIL (regex miss) | PASS | added `no.*workflow\|can.t be run` |

## Files Changed

- `src/index.ts` — `CATEGORY_NATURAL_LOCALITY.automation: 'external'`
- `CLAUDE.md`, `README.md` — routing table updated
- `docs/design/TOOLS-CONTROL-PLANE-DESIGN.md` — category lists updated
- `docs/architecture/DECISIONS.md` — ADR updated with rationale
- `docs/design/CONFIG-CENTER-DESIGN.md` — smart defaults updated
- `scripts/test-automations-llm.ps1` — directive prompts + follow-up nudge
- `scripts/test-automations-llm.ps1` — edge case regex expanded
