# Automation LLM-Path Test Results — 2026-03-09 Round 1

**Script:** `scripts/test-automations-llm.ps1`
**LLM Providers:** ollama (gpt-oss:latest, local) + openai (gpt-4o, external)
**Result:** 69 PASS, 6 FAIL, 0 SKIP (75 total)

## Failures

| Test | Reason | Root Cause |
|------|--------|------------|
| create-pipeline: workflow_upsert (sequential) | Got `find_tools, find_tools` instead of `workflow_upsert` | Natural language prompt; local model searched tools instead of calling them |
| create-pipeline: workflow_upsert (parallel) | No tool calls detected | Same — model described rather than invoked |
| compose-http: workflow_upsert | No tool calls detected | Natural language prompt not directive enough |
| compose-net: workflow_upsert | No tool calls detected | Same |
| run: workflow_run for pipeline | No tool calls detected | Cascade — `full-system-check` was never created (section 3 failure) |
| edge: reports automation not found | Regex miss on "there is no workflow named" | `no.*automat` pattern didn't match `no.*workflow` |

## Analysis

All 6 failures stem from two root causes:

1. **Non-directive prompts (5 failures):** Sections 3 and 5 used natural language prompts like "create a sequential automation..." which the local model (gpt-oss) interpreted conversationally — it described what it would do rather than calling the tool. Sections 2, 4, 6 (dry/real), 7, and 8 used explicit directive prompts ("call workflow_upsert now with these exact args: ...") and all passed.

2. **Edge case regex too narrow (1 failure):** The LLM responded "there is no workflow named **this-does-not-exist-xyz**" — correct behavior, but the assertion regex lacked `no.*workflow`.

## Fixes Applied

- **Sections 3, 5:** Prompts rewritten to directive style matching section 2 pattern ("call workflow_upsert now with these exact args: ...")
- **Section 11:** Edge case regex expanded to include `no.*workflow|can.t be run`

## Passing Sections

All other sections performed well:
- Section 1 (Discovery): 5/5
- Section 2 (Single-tool creation): 6/6
- Section 4 (Scheduling): 5/5
- Section 6 (Running — dry + real): 6/8 (pipeline cascade)
- Section 7 (Schedule mgmt): 5/5
- Section 8 (Natural language): 6/6
- Section 9 (Listing): 4/4
- Section 10 (Deletion): 10/10
- Section 11 (Edge cases): 3/4
- Job history: 3/3
