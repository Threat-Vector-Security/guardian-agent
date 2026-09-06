# Security Testing Results

This directory contains security verification artifacts for Guardian Agent. Results are scoped to the version and date they record.

## Guardian 2 security workspace

- [Prepublication review, 6 September 2026](PREPUBLICATION-2026-09-06.md): credential scans, dependency patches, dataset exclusions and final release checks.
- [Functional verification](../test-results/SECURITY-WORKSPACE-2026-09-06.md): actual UI/API workflows and platform acceptance limits.

Run `npm run test:security-workspace` and `npm audit` for the current security service and complete dependency graph. See the [integration test guide](../guides/INTEGRATION-TEST-HARNESS.md) for the supporting harnesses.

## Original application verification archive

- [SECURITY-CLAIM-MATRIX.md](SECURITY-CLAIM-MATRIX.md) — claim-to-implementation-to-proof matrix for the highest-value security guarantees
- [SECURITY-TEST-RESULTS-2026-03-12.md](SECURITY-TEST-RESULTS-2026-03-12.md) — March 2026 run summary and environment notes
- [RELATED-TEST-SCRIPTS.md](RELATED-TEST-SCRIPTS.md) — executable scripts and supporting harnesses used for runtime verification

## Original application verification command

```bash
node scripts/test-security-verification.mjs
```

## Artifact Hygiene

- Keep sanitized summaries, claim matrices, and rerun commands in the repo.
- Keep raw request captures, local config snapshots, host-specific logs, and blind eval sets out of the checked-in proof surface.
- If a security result needs deeper raw evidence, store it in a private artifact location and summarize the conclusion here.
