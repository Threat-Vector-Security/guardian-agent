# Microsoft CI/CD Repo Security Uplift Plan For GuardianAgent

**Date:** 2026-04-09  
**Type:** Implementation uplift plan  
**Based on:** `docs/research/AGENT-GOVERNANCE-TOOLKIT-COMPARISON-2026-04-09.md`  
**Primary Guardian references:** `SECURITY.md`, `docs/specs/AGENTIC-DEFENSIVE-SECURITY-SUITE-AS-BUILT-SPEC.md`, `docs/specs/TOOLS-CONTROL-PLANE-SPEC.md`

## Executive Direction

GuardianAgent should **keep its current runtime-security architecture** and uplift the governance layer around it.

The comparison against Microsoft's Agent Governance Toolkit supports this implementation direction:

- keep Guardian's brokered planner isolation, guarded LLM access, taint-aware output handling, shared pending-action orchestration, workspace/package trust, and defensive host overlay
- borrow governance packaging that Guardian currently lacks: CI attestation, release provenance, signed third-party manifests, static MCP review, and portable governance evidence
- treat cryptographic multi-agent identity as a future architecture track, not an immediate retrofit

## What This Plan Covers

This plan turns the earlier recommendations into a phased implementation sequence with concrete repository touchpoints.

The workstreams are:

1. CI governance attestation and PR gates
2. SBOM, release signing, and integrity verification
3. static MCP config scanning and fingerprint drift detection
4. signed extension manifests and install-time policy gating
5. portable governance telemetry and evidence packaging
6. design-only cryptographic identity/trust architecture for future federation

## What This Plan Explicitly Does Not Do

- It does not replace Guardian's runtime architecture with a framework-agnostic governance toolkit.
- It does not weaken deferred tool loading or bypass `find_tools` for convenience.
- It does not introduce bespoke per-tool approval or continuation flows when shared orchestration can represent the state.
- It does not add a marketplace or federated trust mesh before Guardian actually needs those surfaces.
- It does not treat signing or SBOM generation as a substitute for runtime enforcement.

## Architecture Guardrails

These guardrails should be treated as implementation constraints:

- **Runtime enforcement stays structural.** Guarded LLM access, brokered worker isolation, `InputSanitizer`, `OutputGuardian`, sandbox controls, and approval chokepoints remain mandatory in the execution path.
- **Blocked-work and approval changes extend shared orchestration first.** If MCP review introduces approvals, clarifications, or drift acknowledgement, use `PendingActionStore`, shared response metadata, and shared surface rendering instead of one-off MCP-only continuations.
- **Tool-discovery changes follow the tool-control-plane design.** If new MCP governance metadata affects discoverability, update the discovery and control-plane path, not the always-loaded tool set.
- **Extension governance must be control-plane managed.** Signed manifest validation belongs in the config/install/control-plane path, not as ad hoc checks in random execution sites.
- **Documentation moves with architecture.** If the implementation changes control-plane, MCP approval, or extension behavior, update the relevant specs in the same change.

## Current Baseline

Relevant starting points in this repository:

- `.github/workflows/ci.yml` exists, but today it is minimal and only runs on `workflow_dispatch`
- `SECURITY.md` documents strong runtime controls and default-safe posture
- `docs/specs/TOOLS-CONTROL-PLANE-SPEC.md` already defines the guardrails around always-loaded vs deferred tools
- `src/tools/mcp-client.ts` already sanitizes untrusted MCP metadata and enforces `startupApproved`
- `src/config/types.ts` and `src/config/loader.ts` already validate MCP server config
- `src/runtime/pending-actions.ts` already provides the right orchestration substrate for review/approval continuations
- `src/guardian/audit-persistence.ts` already provides a useful internal audit base

That means the right uplift path is additive governance around existing enforcement, not a security rewrite.

## Recommended Delivery Order

| Workstream | Priority | Why now | Estimated shape |
|---|---|---|---|
| W1. CI governance attestation | P0 | Highest leverage, low architectural risk, current CI is minimal | 1 PR |
| W2. SBOM, signing, integrity | P0 | High-value supply-chain uplift with limited runtime risk | 1-2 PRs |
| W3. MCP static review and fingerprinting | P1 | Best direct runtime-governance uplift from the AGT comparison | 2 PRs |
| W4. Signed extension manifests | P1/P2 | Important before broad third-party extension distribution | 2 PRs |
| W5. Governance event envelope | P2 | Useful for operator tooling and future integrations | 1 PR |
| W6. Future identity/trust design | P3 | Important only if Guardian expands to federated multi-host delegation | design doc only |

## Workstream 1: CI Governance Attestation And PR Gates

### Objective

Turn security governance into required, machine-verifiable CI behavior rather than relying on discipline and review memory.

### Primary repository touchpoints

- `.github/workflows/ci.yml`
- new `.github/workflows/security-governance.yml`
- new `.github/pull_request_template.md`
- new `scripts/validate-security-governance.mjs`
- new `scripts/generate-governance-report.mjs`
- new `policies/security-governance-paths.json`
- `package.json`

### Implementation slices

#### Slice 1A: baseline governance validation

- Add a machine-readable list of security-sensitive paths in `policies/security-governance-paths.json`.
- Validate changed files against that path set in `scripts/validate-security-governance.mjs`.
- Fail CI when sensitive areas change without matching governance evidence in the PR body.
- Emit `tmp/governance-report.json` as a build artifact.

Suggested initial sensitive paths:

- `SECURITY.md`
- `docs/specs/**/*.md`
- `src/guardian/**`
- `src/llm/guarded-provider.ts`
- `src/worker/worker-session.ts`
- `src/runtime/pending-actions.ts`
- `src/runtime/package-install-trust*.ts`
- `src/runtime/code-workspace-trust.ts`
- `src/runtime/security-*.ts`
- `src/sandbox/**`
- `src/tools/mcp-client.ts`

#### Slice 1B: PR template and required attestations

- Add a PR template with mandatory sections.
Required sections:
- threat or abuse-case impact
- default-posture impact
- approval/orchestration impact
- MCP/tool-control-plane impact
- verification commands and harnesses run

The validator should require those sections only when the changed-file set touches governance-sensitive paths.

#### Slice 1C: CI workflow expansion

- Expand CI to run on `pull_request`, `push`, and `workflow_dispatch`.
- Keep build/test in the main CI workflow.
- Add a separate governance workflow so failures are attributable and reviewable.
- Publish the governance report artifact for every PR.

### Acceptance criteria

- Security-sensitive PRs fail when governance sections are absent or empty.
- Security-sensitive PRs produce a machine-readable governance report artifact.
- Non-sensitive PRs do not get blocked by irrelevant security paperwork.
- CI runs automatically on PRs instead of requiring manual dispatch.

### Verification

- `npm run build`
- `npm test`
- local dry-run for governance script against synthetic changed-file sets

## Workstream 2: SBOM, Signing, And Integrity Verification

### Objective

Add formal release provenance so Guardian can prove what shipped and whether critical security modules match the reviewed build.

### Primary repository touchpoints

- `package.json`
- new `scripts/generate-sbom.mjs`
- new `scripts/generate-integrity-manifest.mjs`
- new `scripts/verify-integrity.mjs`
- Windows release scripts under `scripts/build-windows-*.ps1`
- new `.github/workflows/release-provenance.yml`
- new `docs/specs/RELEASE-PROVENANCE-SPEC.md`

### Implementation direction

#### Slice 2A: SBOM generation

- Generate SPDX JSON and CycloneDX JSON for release builds.
- Attach SBOM artifacts to CI and release outputs.
- Prefer a repeatable command path that works in CI and local release prep.

#### Slice 2B: integrity manifest

- Generate a signed or otherwise attestable manifest over critical security modules and release artifacts.
Start with hashes for:
- `dist/**`
- `SECURITY.md`
- security-relevant specs
- critical runtime security modules

Suggested initial critical module set:

- `src/guardian/input-sanitizer.ts`
- `src/guardian/output-guardian.ts`
- `src/guardian/ssrf-protection.ts`
- `src/llm/guarded-provider.ts`
- `src/worker/worker-session.ts`
- `src/runtime/pending-actions.ts`
- `src/runtime/package-install-trust-service.ts`
- `src/runtime/code-workspace-trust.ts`
- `src/sandbox/security-controls.ts`

#### Slice 2C: signing strategy

- For release artifacts and attestations, prefer Sigstore/cosign-style CI signing over long-lived private keys in-repo.
- For offline-verifiable future extension bundles, reserve the option to add an embedded Ed25519 public key verifier later.
- Keep signing secrets out of the repository and out of `~/.guardianagent/`.

#### Slice 2D: verifier command

- Add a repo-local verification command that checks SBOM presence, integrity manifest validity, and artifact hash consistency.
- Expose it through `package.json` as something like `npm run verify:integrity`.

### Acceptance criteria

- Release builds produce SBOM artifacts in at least one standard format, ideally both SPDX and CycloneDX.
- Critical artifacts ship with a verifiable integrity manifest.
- CI can detect tampered or drifted release artifacts.
- The verifier command can be run by maintainers and in CI.

### Verification

- `npm run build`
- `npm test`
- `npm run verify:integrity`
- release dry-run in CI or a local non-publishing path

## Workstream 3: Static MCP Review And Fingerprint Drift Detection

### Objective

Add a design-time review layer for third-party MCP servers before `startupApproved` is granted, and detect suspicious drift on later launches.

This is the most important direct runtime-governance uplift from the AGT comparison.

### Primary repository touchpoints

- `src/tools/mcp-client.ts`
- `src/config/types.ts`
- `src/config/loader.ts`
- `src/runtime/pending-actions.ts`
- `src/runtime/control-plane/tools-dashboard-callbacks.ts`
- `src/runtime/ai-security.ts`
- `docs/specs/MCP-CLIENT-SPEC.md`
- `docs/specs/TOOLS-CONTROL-PLANE-SPEC.md`
- new `src/runtime/mcp-governance.ts`
- new `src/runtime/mcp-governance.test.ts`

### Architecture note

Do **not** solve this by sprinkling one-off checks around startup and tool execution.

The right model is:

- static review state is stored as governance metadata
- review/approval continuations use shared pending-action machinery
- runtime startup consults reviewed state and fingerprint matches
- UI and channel surfaces render the same blocked/review-needed state using shared metadata

### Implementation slices

#### Slice 3A: fingerprint model

- Normalize third-party MCP server definitions and exposed tool metadata into a canonical review document.
- Hash the canonical document with SHA-256.
Persist the following governance metadata:
- approved fingerprint
- approval timestamp
- optional reviewer principal
- server source and risk metadata

Fields to fingerprint should include:

- server identity and launch command
- explicit env keys, not secret values
- declared network access and inheritance settings
- tool names
- tool descriptions after normalization
- input schema structure

#### Slice 3B: static scanner

- Add a deterministic scanner that flags the following:
- prompt-injection style instructions in descriptions
- suspicious schema expansion
- impersonation or misleading naming
- high-risk tool verbs
- hidden-control wording in metadata

This should be rules-based and local. It is not a replacement for runtime taint handling.

#### Slice 3C: approval-time review

- When a third-party MCP server is first introduced or materially changes, create a shared pending review action instead of relying on a raw boolean flag alone.
- Allow `startupApproved: true` only when the current fingerprint matches an approved review record.
- If the fingerprint drifts, block startup and surface the diff summary.

#### Slice 3D: diff and operator visibility

- Show the following changes between the last approved fingerprint and the current fingerprint:
- new tools
- renamed tools
- description changes
- schema widening
- network/access setting changes

This diff should be available through shared channel/control-plane surfaces, not just logs.

### Acceptance criteria

- New third-party MCP servers cannot silently start without a reviewed fingerprint.
- Description or schema drift invalidates prior approval.
- Review and continuation state uses shared pending-action plumbing.
- Runtime still preserves current defensive defaults on degraded hosts.

### Verification

- targeted Vitest coverage for fingerprint creation, scanner findings, and drift invalidation
- `npx vitest run src/tools/mcp-integration.test.ts`
- `node scripts/test-coding-assistant.mjs`
- `node scripts/test-contextual-security-uplifts.mjs`
- if web/control-plane review UI changes, `node scripts/test-code-ui-smoke.mjs`

## Workstream 4: Signed Extension Manifests And Policy Gating

### Objective

Define a formal trust model for third-party Guardian extensions before the ecosystem becomes broader and harder to retrofit.

### Scope assumptions

This workstream is only worth implementing for surfaces that can load third-party authored content with execution or instruction impact, such as:

- plugins
- skills
- MCP server bundles
- automation packages

If Guardian keeps some surfaces first-party only, document that and do not overbuild generic marketplace machinery.

### Primary repository touchpoints

- new `docs/specs/EXTENSION-MANIFEST-TRUST-SPEC.md`
- new `src/runtime/extension-manifests.ts`
- new `src/runtime/extension-policy.ts`
- install/control-plane paths for future third-party assets
- `SECURITY.md`

### Implementation slices

#### Slice 4A: manifest schema

- Define a versioned manifest schema with these fields:
- artifact identity
- publisher identity
- hash list
- permissions/capabilities requested
- supported Guardian versions
- signature block
- trust tier

#### Slice 4B: verification and policy evaluation

- Verify signature and hash integrity before install or enablement.
- Evaluate requested permissions against local policy.
- Distinguish first-party, local-untrusted, and signed-third-party trust tiers.

#### Slice 4C: operator experience

- Require explicit acknowledgement when enabling unsigned local extensions.
- Block unsigned third-party remote bundles by default.
- Surface trust tier and requested permissions clearly in install/enable flows.

### Acceptance criteria

- Guardian can distinguish trusted, local-untrusted, and untrusted-third-party extension states.
- Policy evaluation happens before enablement, not only at runtime.
- Unsigned remote third-party artifacts are blocked by default.

### Verification

- manifest verification unit tests
- policy evaluation unit tests
- install/enable integration tests once the extension surfaces exist

## Workstream 5: Portable Governance Event Envelope

### Objective

Make Guardian's security and governance evidence easier to consume by external tooling without changing its runtime security model.

### Primary repository touchpoints

- `src/guardian/audit-persistence.ts`
- `src/runtime/security-alerts.ts`
- `src/runtime/security-triage-agent.ts`
- new `src/runtime/governance-events.ts`
- new `docs/specs/GOVERNANCE-EVENT-SCHEMA.md`

### Implementation slices

#### Slice 5A: event schema

Define a stable envelope for:

- approvals
- denials
- quarantines
- package-install findings
- workspace-trust findings
- MCP review decisions
- security-triage outputs

#### Slice 5B: export path

- Add an exporter for JSONL or another simple machine-readable stream.
- Keep it append-only and versioned.
- Avoid tight coupling to a specific external vendor.

#### Slice 5C: correlation fields

- Include enough metadata to stitch events together:
- timestamp
- surface/channel
- principal
- workspace or target scope
- related run or pending-action id
- risk or severity

### Acceptance criteria

- Governance-relevant events share one stable schema.
- Audit consumers can reconstruct approval and quarantine flows.
- Export does not weaken existing privacy or security boundaries.

### Verification

- unit tests for schema generation
- replay test from audit persistence into exported event format

## Workstream 6: Future Cryptographic Identity And Trust Design

### Objective

Capture the architecture now, but defer implementation until Guardian actually needs federated or cross-host delegation.

### Why this is deferred

Guardian's current value is a security-first local runtime. It does not yet need AGT-style identity mesh complexity for the mainline product.

Implementing this early would add complexity in the wrong place.

### Deliverable

Produce a design document, not runtime code, covering:

- node identity issuance and rotation
- operator sponsorship or enrollment
- delegated worker identity
- revocation
- trust scoring and policy use
- audit linkage

### Primary repository touchpoints

- new `docs/architecture/FEDERATED-IDENTITY-AND-DELEGATION-SPEC.md`
- `docs/architecture/FORWARD-ARCHITECTURE.md`

### Exit criteria for leaving design-only status

Only implement this if Guardian commits to one or more of:

- cross-host job delegation
- federated Guardian nodes
- shared operator trust domains
- durable remote worker execution

## Recommended PR Slicing

To keep risk controlled and reviewable, implement this plan as a sequence of focused PRs:

1. PR 1: CI governance validator, sensitive-path policy file, PR template, governance artifact
2. PR 2: SBOM generation, integrity manifest, verifier command
3. PR 3: MCP fingerprinting model and scanner
4. PR 4: MCP review-state integration with shared pending actions and control-plane surfaces
5. PR 5: extension manifest spec and verifier
6. PR 6: governance event envelope export
7. PR 7: federated identity design spec

## Verification Strategy

The minimum verification bar per workstream should be:

- all changes: `npm run build`, `npm test`
- approval/orchestration/control-plane changes: targeted Vitest coverage plus `node scripts/test-coding-assistant.mjs`
- web/control-plane UI changes: `node scripts/test-code-ui-smoke.mjs`
- security/runtime behavior changes: `node scripts/test-contextual-security-uplifts.mjs`
- adversarial prompt-path changes where relevant: `npm run test:llmmap`

## Recommended First Three Moves

If the goal is maximum value with minimum disruption, do these first:

1. implement CI governance attestation and PR gates
2. implement SBOM plus integrity verification for release artifacts
3. implement MCP fingerprint review before `startupApproved`

Those three deliver the largest governance uplift without destabilizing Guardian's stronger existing runtime-security model.

## Final Recommendation

Guardian should not chase parity with AGT package-for-package. It should selectively adopt the parts that complement Guardian's current strengths.

The implementation strategy is:

- preserve Guardian's mandatory runtime enforcement model
- add governance controls at CI, release, and install/enable boundaries
- use shared orchestration for any new review or approval states
- defer identity mesh work until federation is a real product requirement

That path improves supply-chain trust, operator assurance, and MCP governance without sacrificing the runtime-security advantages Guardian already has.
