# GuardianAgent vs. Microsoft Agent Governance Toolkit

**Date:** 2026-04-09  
**Type:** Research / Security Governance Comparison  
**External codebase reviewed:** `/mnt/s/Development/agent-governance-toolkit`  
**Guardian references:** `SECURITY.md`, `docs/specs/AGENTIC-DEFENSIVE-SECURITY-SUITE-AS-BUILT-SPEC.md`

## Executive Summary

Microsoft's Agent Governance Toolkit (AGT) is a serious governance library suite. Its strongest differentiators are:

- cryptographic agent identity and trust infrastructure
- plugin and MCP ecosystem governance
- formal compliance, attestation, SBOM, and signing workflows
- strong CI-facing governance packaging

GuardianAgent is already stronger where runtime security has to be mandatory rather than optional:

- brokered planner isolation with no direct worker network egress
- trust-classified tool output and quarantined planner reinjection suppression
- trust-aware memory and workspace trust
- shared pending-action / approval orchestration across surfaces
- default-safe degraded sandbox posture
- managed package-install review with native AV enrichment
- host, network, gateway, and native Defender defensive overlay

Bottom line: **do not replace Guardian's architecture with AGT's.** Guardian is already the stronger integrated runtime and local defensive platform. The right move is to **borrow AGT's best governance packaging ideas**:

1. CI governance attestation and PR checklist validation
2. SBOM and signing pipeline for releases and extension artifacts
3. signed manifest and policy gating for third-party extensions
4. static MCP config scanning and fingerprinting before enablement
5. a future cryptographic identity/trust layer only if Guardian expands to federated multi-agent deployments

## Scope And Sources

I reviewed AGT at the repository, docs, and representative implementation level:

- `README.md`
- `docs/THREAT_MODEL.md`
- `docs/tutorials/04-audit-and-compliance.md`
- `docs/tutorials/06-execution-sandboxing.md`
- `docs/tutorials/07-mcp-security-gateway.md`
- `docs/tutorials/10-plugin-marketplace.md`
- `docs/tutorials/26-sbom-and-signing.md`
- `docs/tutorials/27-mcp-scan-cli.md`
- `packages/agent-mesh/src/agentmesh/core/identity/ca.py`
- `packages/agent-mesh/src/agentmesh/governance/audit.py`
- `packages/agent-os/src/agent_os/mcp_security.py`
- `packages/agent-os/src/agent_os/prompt_injection.py`
- `packages/agent-os/src/agent_os/memory_guard.py`
- `packages/agent-hypervisor/src/hypervisor/security/kill_switch.py`
- `packages/agent-hypervisor/src/hypervisor/rings/enforcer.py`
- `packages/agent-hypervisor/src/hypervisor/session/isolation.py`
- `packages/agent-hypervisor/src/hypervisor/saga/orchestrator.py`
- `packages/agent-marketplace/src/agent_marketplace/signing.py`
- `packages/agent-marketplace/src/agent_marketplace/marketplace_policy.py`
- `packages/agent-compliance/src/agent_compliance/verify.py`
- `packages/agent-compliance/src/agent_compliance/integrity.py`
- `packages/agent-os/extensions/mcp-server/src/services/approval-workflow.ts`
- `packages/agentmesh-integrations/mcp-trust-proxy/mcp_trust_proxy/proxy.py`
- `packages/agent-mesh/packages/mcp-proxy/src/audit.ts`
- `action/README.md`
- `action/security-scan/README.md`
- `action/governance-attestation/README.md`

I compared those against Guardian's current shipped security and defensive suite:

- `SECURITY.md`
- `docs/specs/AGENTIC-DEFENSIVE-SECURITY-SUITE-AS-BUILT-SPEC.md`
- `src/guardian/input-sanitizer.ts`
- `src/guardian/output-guardian.ts`
- `src/guardian/ssrf-protection.ts`
- `src/llm/guarded-provider.ts`
- `src/worker/worker-session.ts`
- `src/runtime/pending-actions.ts`
- `src/runtime/package-install-trust.ts`
- `src/runtime/package-install-trust-service.ts`
- `src/runtime/code-workspace-trust.ts`
- `src/runtime/security-triage-agent.ts`
- `src/runtime/windows-defender-provider.ts`
- `src/sandbox/security-controls.ts`
- `src/guardian/audit-persistence.ts`

## AGT Security Governance Snapshot

AGT is not one runtime. It is a family of governance packages:

- **Agent OS**: policy enforcement, prompt and MCP scanning, governance adapters
- **AgentMesh**: identity, trust scores, delegation, audit
- **Agent Hypervisor / Runtime**: rings, kill switch, saga, isolation APIs
- **Agent Compliance**: verification, integrity, attestation, supply-chain and policy tooling
- **Agent Marketplace**: plugin manifests, signing, trust tiers, marketplace policy
- **Agent SRE**: error budgets, circuit breakers, anomaly and rogue-behavior tooling

The design center is broad governance coverage across frameworks and languages. Guardian's design center is different: a security-first assistant runtime where enforcement sits directly in the execution path.

## Head-To-Head Comparison

| Area | AGT | GuardianAgent | Assessment |
|---|---|---|---|
| Action governance | Strong policy engine and framework adapters; emphasis on pre-action enforcement | Mandatory runtime chokepoints in supervisor, tool executor, approvals, and wrapped LLM access | Roughly comparable in intent; Guardian is stronger in mandatory integration |
| Direct prompt-injection defense | AGT has detectors in `agent_os/prompt_injection.py` and pre-deployment prompt defense in `agent_compliance/prompt_defense.py` | `InputSanitizer` blocks or mutates before the agent sees input | Guardian stronger as a shipped runtime control |
| Indirect prompt injection / tool-result taint | AGT has MCP security, memory guard, and some conversation-guardian surfaces | `OutputGuardian` classifies tool results as `trusted`, `low_trust`, or `quarantined`, suppresses raw reinjection, and blocks unsafe downstream use | Guardian materially stronger |
| Memory poisoning | AGT `MemoryGuard` validates writes and hashes entries | Guardian has trust-aware memory states, provenance, quarantined writes by default, and prompt-time trust handling | Guardian stronger and more operationally integrated |
| Approvals | AGT has approval workflow support, including quorum logic, but the representative service is file-backed and heuristic-driven in `approval-workflow.ts` | Guardian has shared `PendingActionStore`, principal-bound approvals, cross-turn continuation, and multi-surface orchestration | Guardian clearly stronger |
| Runtime isolation | AGT documents rings, kill switch, saga, and isolation | Guardian already isolates the chat/planner in a brokered worker with no direct tool/runtime handle and no direct network egress | Guardian stronger today |
| Multi-agent identity and trust | AGT is clearly ahead: Ed25519, sponsor signatures, DID, SVID, trust scores, revocation, trust-gated proxies | Guardian has contract-mediated handoffs but no equivalent shipped cryptographic identity mesh | AGT stronger |
| MCP governance | AGT is very strong: runtime gateway, static scanner, trust proxy, mcp proxy, drift/rug-pull detection | Guardian is strong operationally: startup approval, namespacing, risk floor, policy checks, degraded-backend default block | AGT ahead on static analysis and ecosystem tooling; Guardian ahead on local runtime defaults |
| Supply chain / plugin governance | AGT is ahead: Ed25519 plugin signing, marketplace policy, SBOM, signing, integrity verifier, CI security scan action | Guardian has managed package-install staging and review, but less formal release/extension provenance | AGT stronger |
| Audit / compliance evidence | AGT has Merkle audit, CloudEvents, verification, integrity, badges, PR attestation and governance actions | Guardian has hash-chained audit persistence and good internal evidence, but less formal external attestation packaging | AGT stronger on packaging; Guardian already solid internally |
| SRE / anomaly / kill switch | Both have circuit breaker / kill switch style controls | Guardian mainly focuses on assistant runtime and provider resilience; AGT has more explicit governance-branded SRE coverage | AGT somewhat ahead in breadth |
| Host and network defensive overlay | AGT focuses on agent/runtime governance, not workstation defense | Guardian has host, network, gateway, Defender, posture, containment, and security triage | Guardian decisively stronger |
| Package and repo trust for coding | AGT has SBOM and marketplace verification, but no equivalent integrated coding-session trust loop surfaced in this review | Guardian has workspace trust review, native AV enrichment, and managed package-install review | Guardian stronger |

## Where AGT Is Better And Worth Borrowing

## 1. Cryptographic Agent Identity And Trust

AGT has a real identity/trust story, not just process boundaries. The CA in `packages/agent-mesh/src/agentmesh/core/identity/ca.py` issues short-lived certificates, validates human sponsor signatures, generates DIDs, and supports token rotation. The wider AgentMesh layer also carries trust scores, delegation, revocation, and trust-gated proxies.

Guardian does not have a shipped equivalent. If Guardian grows beyond one local supervisor into:

- federated Guardian nodes
- cross-host agent handoffs
- durable delegated worker identities
- organization-scale operator networks

then AGT's identity model is the single most important thing to borrow conceptually.

**Recommendation:** adopt this only as an explicit future architecture track, not a tactical patch. It belongs in Guardian's handoff / delegation / operator-network architecture, not in ad hoc per-tool auth logic.

## 2. CI Governance Attestation And PR Gate Packaging

AGT packages governance as something you can enforce in GitHub Actions today:

- `action/README.md`
- `action/action.yml`
- `action/security-scan/README.md`
- `action/governance-attestation/README.md`

This is a real strength. It turns governance from "docs say we care" into:

- required CI checks
- attestation validation
- policy evaluation gates
- plugin-manifest validation
- automated security scans

Guardian has strong runtime controls, but less polished governance packaging for CI and release workflows.

**Borrow now:** create a Guardian CI governance suite that can:

1. verify required security checklist sections in PR descriptions
2. run policy/config validation against changed security-sensitive files
3. fail if sandbox or approval defaults are weakened without explicit signoff
4. emit a machine-readable governance report artifact

This is high-value and low-risk.

## 3. SBOM, Signing, And Formal Integrity / Provenance

AGT's `agent_compliance/verify.py` and `agent_compliance/integrity.py` package governance verification and integrity checking cleanly. The SBOM and signing tutorial plus marketplace signing layer show a mature supply-chain mindset:

- SBOM generation
- Ed25519 signing
- integrity manifests
- release attestation
- signed plugin manifests

Guardian has some of the right instincts, but mostly as runtime/package-review behavior rather than formal release provenance.

**Borrow now:**

1. generate SPDX and CycloneDX SBOMs for Guardian releases
2. sign release artifacts and, later, extension bundles
3. add an integrity manifest for critical security modules
4. optionally expose a `guardian verify-security-posture` style command for CI and operator diagnostics

## 4. Signed Extension / Plugin Manifests With Policy Gating

AGT's marketplace layer is well thought through for extension ecosystems:

- Ed25519 manifest signing in `agent_marketplace/signing.py`
- allowlist/blocklist MCP server policy in `agent_marketplace/marketplace_policy.py`
- organization-scoped policy overrides
- trust-tiered plugin evaluation

Guardian already has runtime controls for MCP servers, but those are mainly about startup approval, risk floor, and local execution defaults. Guardian does **not** yet have the same formal signed-manifest story for third-party skills, plugins, or MCP packages.

**Borrow now:** define signed manifests for any future third-party Guardian extension surfaces:

- skills
- plugins
- MCP server bundles
- automation packages

That gives Guardian a stronger import/install trust story without changing runtime architecture.

## 5. Static MCP Config Scanning And Fingerprinting

AGT's MCP work is especially strong because it covers both:

- runtime interception via gateway/proxy/trust-gated proxies
- design-time scanning and fingerprinting via `agent_os/mcp_security.py` and the MCP scan CLI

Guardian already blocks risky MCP operation by default on degraded backends and requires explicit startup approval, but it does not appear to have an equally explicit static scanner for:

- hidden instructions in tool descriptions
- cross-server impersonation
- silent definition drift / rug pulls

**Borrow now:** add a Guardian-side MCP review step before `startupApproved` is granted:

1. fingerprint tool schemas and descriptions at approval time
2. re-check on subsequent launches
3. warn or block on description drift, hidden instructions, or suspicious schema expansion

This is one of the best direct uplifts available.

## 6. Governance Telemetry Packaging

AGT's audit and MCP proxy stack pushes toward CloudEvents and broader observability integration. Guardian already has useful audit persistence, but AGT is more mature in making governance evidence portable for external systems.

**Borrow selectively:** export Guardian security and audit events in a stable machine-readable envelope. That does not need to be full OpenTelemetry on day one. Even a consistent event schema for:

- approvals
- denials
- quarantines
- package-install findings
- security triage outputs

would improve downstream security operations.

## Where GuardianAgent Is Already Better

## 1. Runtime Security Is Structural, Not Merely Available

Guardian's core security controls are in the main execution path:

- `InputSanitizer` runs before message dispatch
- `GuardedLLMProvider` wraps `ctx.llm`
- `OutputGuardian` scans both LLM responses and tool results
- `SsrfController` is centralized
- approvals run through shared runtime state

Representative evidence:

- `src/runtime/runtime.ts`
- `src/guardian/input-sanitizer.ts`
- `src/guardian/output-guardian.ts`
- `src/llm/guarded-provider.ts`
- `src/guardian/ssrf-protection.ts`

AGT often provides strong controls, but frequently as libraries, middleware, adapters, or preview modules that adopters must wire together correctly.

## 2. Brokered Planner Isolation Is Stronger Than AGT's Reviewed Runtime Isolation Story

Guardian's built-in planner/chat path runs in a brokered worker with no direct runtime handle and no direct worker network access. `src/worker/worker-session.ts` explicitly routes tool and LLM access through the broker.

By contrast, parts of AGT's runtime isolation story are still clearly preview-grade:

- `packages/agent-hypervisor/src/hypervisor/rings/enforcer.py` calls itself a basic public-preview implementation
- `packages/agent-hypervisor/src/hypervisor/session/isolation.py` is a stub and says isolation levels are retained for API compatibility but not enforced
- `packages/agent-hypervisor/src/hypervisor/saga/orchestrator.py` is explicitly a basic public-preview implementation

That does not make AGT weak. It means Guardian's current planner isolation is the more production-grounded story for this specific problem.

## 3. Guardian's Taint Model Is More Advanced

Guardian's `OutputGuardian` does more than detect bad content. It feeds policy:

- trust classification: `trusted`, `low_trust`, `quarantined`
- planner raw-content suppression
- memory write gating
- downstream dispatch restrictions

See:

- `src/guardian/output-guardian.ts`
- `src/tools/types.ts`

AGT has prompt injection detection, memory guard, and quarantine concepts, but Guardian's taint model is more cohesive and directly integrated into planning, memory, and delegation.

## 4. Shared Pending-Action Orchestration Is Better Than AGT's Approval Surface

Guardian's `PendingActionStore` is a shared orchestration substrate for:

- approvals
- clarifications
- workspace switching
- auth blockers
- policy blockers
- cross-surface continuation

See `src/runtime/pending-actions.ts`.

AGT's reviewed approval workflow is useful but simpler and narrower. It persists approval requests to disk and uses action-description heuristics to infer risk in `packages/agent-os/extensions/mcp-server/src/services/approval-workflow.ts`.

Guardian's approach is better aligned with real conversational agent continuation.

## 5. Guardian Has A Real Local Defensive Security Suite

AGT is mostly about governance around agents. Guardian extends into host defense and local operator security:

- Windows Defender integration in `src/runtime/windows-defender-provider.ts`
- host/network/gateway monitoring per `docs/specs/AGENTIC-DEFENSIVE-SECURITY-SUITE-AS-BUILT-SPEC.md`
- event-driven `security-triage` agent in `src/runtime/security-triage-agent.ts`

AGT's reviewed scope does not offer an equivalent workstation-defense and operator-security layer.

## 6. Guardian's Default-Safe Degraded-Backend Posture Is Excellent

Guardian explicitly closes risky surfaces on weak sandbox backends unless the operator opts in:

- network tools
- browser tools
- MCP servers
- package managers
- manual code terminals

See:

- `SECURITY.md`
- `src/sandbox/security-controls.ts`

This is a strong operational control that many agent stacks miss entirely.

## 7. Guardian Already Has Better Managed Package And Workspace Trust

Guardian stages packages, inspects artifacts, enriches with native AV, raises unified alerts, and only then installs from staged artifacts:

- `src/runtime/package-install-trust.ts`
- `src/runtime/package-install-trust-service.ts`

It also evaluates workspace trust for coding sessions and carries native protection results into the prompt/runtime path:

- `src/runtime/code-workspace-trust.ts`
- `src/chat-agent.ts`

AGT is stronger in release/extension supply chain governance, but Guardian is stronger in assistant-mediated coding-session trust.

## Important Caveat: AGT's Docs Are Broader Than Some Current Runtime Maturity

AGT is impressive, but several reviewed components are explicitly preview-grade:

- ring enforcement: `packages/agent-hypervisor/src/hypervisor/rings/enforcer.py`
- session isolation: `packages/agent-hypervisor/src/hypervisor/session/isolation.py`
- saga orchestrator: `packages/agent-hypervisor/src/hypervisor/saga/orchestrator.py`

Its scanners also repeatedly warn that rules are sample baselines requiring customization:

- `packages/agent-os/src/agent_os/mcp_security.py`
- `packages/agent-os/src/agent_os/prompt_injection.py`

So the right interpretation is:

- **AGT is strategically excellent**
- **some pieces are production-ready**
- **some pieces are still public-preview scaffolding**

That makes AGT a strong source of uplift ideas, but not something to copy blindly.

## Recommended Uplifts For Guardian

## Immediate

1. Add a Guardian governance-attestation CI workflow for PR templates and security-signoff sections.
2. Add SBOM generation and signed release artifacts.
3. Add static MCP config scanning and fingerprinting before `startupApproved` is granted.

## Near-Term

1. Define signed manifests for third-party skills/plugins/MCP bundles.
2. Add extension policy evaluation in CI and at install time.
3. Export audit/security events in a stable envelope for downstream tooling.

## Longer-Term

1. Design a cryptographic identity/trust layer for cross-host agent delegation.
2. Reuse Guardian's shared orchestration model for any future trust or delegation workflows rather than bolting identity checks onto individual tools.

## Final Verdict

AGT is better than Guardian in **identity mesh, formal supply-chain governance, and CI-grade compliance packaging**.

Guardian is better than AGT in **mandatory runtime security integration, planner isolation, taint-aware memory and reinjection control, shared blocked-work orchestration, coding-session trust, and host-level defensive coverage**.

The right strategy is:

- **keep Guardian's runtime architecture**
- **borrow AGT's governance packaging**
- **treat AGT's identity model as a future architecture input, not an immediate retrofit**

If we do that, Guardian gets the best of both worlds without regressing the security properties it already has.
