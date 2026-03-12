# Proposal: ZeroTrustAgent-Inspired Uplifts for GuardianAgent

**Date:** 2026-03-12
**Status:** Draft
**Author:** Analysis of `kenhuangus/ZeroTrustAgent` public repository

---

## Executive Summary

ZeroTrustAgent is narrower than GuardianAgent, but it highlights a few practical uplift areas:

- reusable framework adapter packaging
- pluggable identity-provider abstractions
- stronger developer-side repo guardrails
- optional threat-intel enrichment for operator workflows

GuardianAgent is already materially stronger in runtime security architecture. It has mandatory runtime chokepoints, brokered worker isolation, capability tokens, OS sandboxing, tamper-evident audit persistence, localhost hardening, approval workflows, and an explicit security verification harness.

The recommendation is not to copy ZeroTrustAgent's core enforcement model. The recommendation is to borrow the parts that improve GuardianAgent's integration surface, operator ergonomics, and repo hygiene.

---

## Comparison Summary

| Area | GuardianAgent Today | ZeroTrustAgent Positioning | Recommendation |
|------|----------------------|----------------------------|----------------|
| Runtime enforcement | Strong mandatory runtime enforcement | Adapter-level validation wrappers | Keep GA lead |
| Policy engine | Richer typed engine with approvals and family defaults | Simple first-match boolean engine | Keep GA lead |
| Sandbox / isolation | Brokered worker + OS sandbox support | No comparable host sandbox model | Keep GA lead |
| Audit integrity | Hash-chained tamper-evident audit trail | Basic monitoring and logging | Keep GA lead |
| Framework integrations | Internal orchestration, MCP, channels | Many external framework adapters | Borrow product shape |
| Authentication surface | Bearer-centric web auth, connector auth modes | Password/OAuth/social/certificate provider model | Borrow selectively |
| Repo guardrails | Basic CI present | Pre-commit plus broader lint/type/security workflow | Borrow selectively |
| Threat enrichment | Existing anomaly and threat workflows | MITRE/IOC enrichment direction | Borrow selectively |

---

## Recommended Uplifts

### 1. Guardian Adapter SDK for External Frameworks

ZeroTrustAgent's clearest reusable idea is its adapter packaging for external agent frameworks.

GuardianAgent should expose a small adapter SDK that lets developers wrap:

- OpenAI Agents SDK
- LangGraph
- CrewAI
- AutoGen

The adapter layer should force all external framework actions through GuardianAgent controls rather than reimplementing policy logic inside each adapter.

Recommended scope:

- lightweight npm package or subpackage such as `@guardianagent/adapters`
- shared adapter contract for agent creation, tool execution, handoffs, and session operations
- audit event mapping into Guardian's existing event types
- approval and policy hooks routed back into the runtime
- examples for at least OpenAI Agents SDK and LangGraph first

Why this is worth doing:

- it turns GuardianAgent into a reusable security control plane, not just a standalone app
- it broadens adoption without weakening the runtime model
- it gives Guardian a stronger answer to the "secure other frameworks" use case

Suggested starting points:

- [src/runtime/runtime.ts](/mnt/s/Development/GuardianAgent/src/runtime/runtime.ts)
- [src/policy/engine.ts](/mnt/s/Development/GuardianAgent/src/policy/engine.ts)
- [src/broker/capability-token.ts](/mnt/s/Development/GuardianAgent/src/broker/capability-token.ts)
- new package under `packages/` or `src/adapters/`

### 2. Pluggable Identity Providers for Web/API Auth

ZeroTrustAgent has a cleaner conceptual split between authentication providers and authorization policy than GuardianAgent currently exposes at the web/API layer.

GuardianAgent should keep bearer-token auth as the default local-first mode, but add optional provider abstractions for:

- generic OAuth 2.0 / OIDC
- Google
- GitHub
- Microsoft Entra ID
- certificate-based auth for high-trust deployments

Recommended scope:

- keep current bearer mode as the default and simplest path
- add a provider abstraction layer for interactive and multi-user installs
- map identities to Guardian roles, approval powers, and audit principals
- preserve existing browser-to-localhost hardening

Why this is worth doing:

- it improves enterprise readiness
- it reduces pressure to overload bearer tokens as the only auth story
- it fits existing connector auth concepts already present in config

Suggested starting points:

- [src/config/types.ts#L174](/mnt/s/Development/GuardianAgent/src/config/types.ts#L174)
- [src/config/types.ts#L653](/mnt/s/Development/GuardianAgent/src/config/types.ts#L653)
- [SECURITY.md#L724](/mnt/s/Development/GuardianAgent/SECURITY.md#L724)

### 3. Stronger Repo Guardrails and Developer Workflow

ZeroTrustAgent includes repo-side guardrails that are worth adopting in TypeScript-native form even though its CI implementation itself should not be copied directly.

GuardianAgent should add:

- pre-commit hooks for formatting, file hygiene, and fast tests
- dedicated CI jobs for typecheck, unit tests, coverage, and security checks
- secret scanning in CI and optionally pre-commit
- dependency audit and lockfile review gates
- artifact hygiene checks to prevent committing logs, databases, or runtime outputs

Recommended implementation:

- add a root `.pre-commit-config.yaml` or equivalent local hook tooling
- expand [.github/workflows/ci.yml](/mnt/s/Development/GuardianAgent/.github/workflows/ci.yml) into separate `build`, `test`, and `security` jobs
- include `npm audit` or a better-scoped dependency audit step
- add a secret scanner such as `gitleaks` in CI
- add a check that tracked files do not include `tmp/`, logs, generated DBs, or packaged runtime outputs unless explicitly allowed

Why this is worth doing:

- it catches mistakes before they become security claims
- it complements Guardian's runtime protections with repo hygiene
- it lowers maintenance cost for future hardening work

### 4. MITRE and IOC Enrichment for Sentinel and Threat Workflows

ZeroTrustAgent's security-analysis layer is too heavy to adopt wholesale, but its MITRE ATT&CK and IOC-enrichment direction is useful for operator-facing workflows.

GuardianAgent should selectively borrow:

- MITRE ATT&CK tagging for high-signal Sentinel findings
- optional IOC feed enrichment for threat-intel workflows
- structured finding metadata suitable for later SIEM export

Recommended scope:

- enrichment only, not a mandatory runtime dependency
- use it in Sentinel, threat-intel review, and alert summaries
- keep the default install lightweight

Non-goal:

- do not add TensorFlow, large ML dependencies, or heavy threat platforms to the default runtime

Suggested starting points:

- [src/runtime/sentinel.ts](/mnt/s/Development/GuardianAgent/src/runtime/sentinel.ts)
- [src/runtime/threat-intel.ts](/mnt/s/Development/GuardianAgent/src/runtime/threat-intel.ts)
- [docs/specs/THREAT-INTEL-SPEC.md](/mnt/s/Development/GuardianAgent/docs/specs/THREAT-INTEL-SPEC.md)

### 5. Artifact Hygiene and Test Output Discipline

The comparison also surfaced a simple repo-quality issue that is worth handling directly: both repos currently track runtime or harness artifacts that should generally stay out of version control.

GuardianAgent should tighten rules around:

- tracked files under `tmp/`
- generated logs
- generated databases
- generated packaging output

This is not a headline feature, but it directly improves trust in the repo and reduces accidental leakage.

---

## What GuardianAgent Should Not Copy

- ZeroTrustAgent's boolean policy engine and adapter-local enforcement model
- heavy optional security-analysis dependencies as default install requirements
- permissive CI patterns that ignore failures for core checks
- committing runtime data such as logs or databases as normal tracked files
- any framing that implies framework wrappers are a substitute for runtime enforcement

GuardianAgent's differentiator remains:

- mandatory runtime chokepoints
- brokered worker isolation
- OS sandbox integration
- approval-aware policy enforcement
- tamper-evident audit trail

---

## Proposed Phases

### Phase 1: Repo and Packaging Foundation

- add pre-commit and secret-scanning guardrails
- split CI into clearer jobs with a dedicated security lane
- add artifact hygiene checks
- define an adapter package boundary and public API shape

### Phase 2: Adapter SDK v1

- implement shared adapter primitives
- ship first-party adapters for OpenAI Agents SDK and LangGraph
- add examples and integration tests

### Phase 3: Identity Provider Expansion

- add pluggable auth providers for web/API deployments
- preserve bearer token mode as default
- map external identities to Guardian approval and audit roles

### Phase 4: Threat Enrichment

- add optional MITRE mapping for Sentinel findings
- add IOC enrichment hooks for threat-intel workflows
- expose enriched metadata in UI, notifications, and exports

---

## Priority Order

1. Repo guardrails and artifact hygiene
2. Adapter SDK for external frameworks
3. Pluggable identity providers
4. MITRE/IOC enrichment

This order keeps the first step low-risk and immediately useful, then focuses on the highest-leverage product expansion.

---

## Success Criteria

- GuardianAgent can secure at least two external agent frameworks through first-party adapters without bypassing runtime enforcement
- web/API auth supports bearer-only local installs and optional provider-backed multi-user installs
- CI and local hooks catch secret leaks, generated artifact commits, and basic security regressions earlier
- Sentinel and threat-intel workflows can attach optional MITRE/IOC context without increasing default runtime complexity

---

## Deferred / Non-Goals

- replacing Guardian's existing runtime architecture with adapter-local controls
- adding heavy ML-based anomaly systems to the default install
- adopting ZeroTrustAgent's policy engine or token model directly
- broad framework support before the first two adapters prove the shape

---

## References

- ZeroTrustAgent repository: <https://github.com/kenhuangus/ZeroTrustAgent>
- Guardian runtime enforcement: [src/runtime/runtime.ts](/mnt/s/Development/GuardianAgent/src/runtime/runtime.ts)
- Guardian policy engine: [src/policy/engine.ts](/mnt/s/Development/GuardianAgent/src/policy/engine.ts)
- Guardian sandboxing: [src/sandbox/index.ts](/mnt/s/Development/GuardianAgent/src/sandbox/index.ts)
- Guardian capability tokens: [src/broker/capability-token.ts](/mnt/s/Development/GuardianAgent/src/broker/capability-token.ts)
- Guardian security verification artifacts: [docs/security-testing-results/README.md](/mnt/s/Development/GuardianAgent/docs/security-testing-results/README.md)
