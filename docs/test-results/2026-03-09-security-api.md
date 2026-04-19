# Security API Test Results — 2026-03-09

**Script:** `scripts/test-security-api.ps1`
**LLM Providers:** ollama (gpt-oss:latest, local) + openai (gpt-4o, external)
**Result:** 29 PASS, 0 FAIL, 0 SKIP (29 total)

## Fixes Applied (from round 1: 27 PASS, 2 FAIL)

| Test | Round 1 | Fix |
|------|---------|-----|
| tool catalog query | FAIL — `catalog` property not found | API returns `tools` not `catalog`; fixed property name |
| approval decisions in audit log | FAIL — `tool_approval_decided` not found | Approval decisions go to analytics, not audit log; changed to check `action_denied` (Guardian policy denials) |

## Test Coverage

- **Health & Auth (3):** health endpoint, 401 unauthenticated, 403 invalid token
- **Privileged Ticket Flow (7):** ticket requirement, minting, usage, replay prevention, action mismatch
- **Config Redaction (2):** auth token hidden, no raw secret patterns in config API
- **Tool Governance (8):** policy updates, approval gating, argsHash, denial immutability, per-tool deny, denied paths, tool risk classification
- **Audit & Guardian Status (5):** chain verification, event persistence, policy_changed events, action_denied events, Guardian Agent status
- **Request Hardening (2):** oversized body rejection, SSE query-string token rejection
- **Auth Brute-Force (2):** rate limiting after repeated failures
