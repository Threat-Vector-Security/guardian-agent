# Proposal: Pipelock-Inspired Security Uplift for GuardianAgent

**Date:** 2026-03-11
**Status:** Draft
**Author:** Analysis of `luckyPipewrench/pipelock` public repository materials

---

## Executive Summary

Pipelock is narrower than GuardianAgent, but it is opinionated in a few areas that are worth copying. Its strongest public themes are:

- inline egress inspection through local proxy modes
- bidirectional MCP scanning and tool-poisoning detection
- DLP-style outbound inspection before requests leave the machine
- bypass-resistance testing around obfuscation and exfil patterns
- SIEM- and operator-friendly packaging

GuardianAgent is already stronger in broader runtime governance:

- Guardian admission controls on tool calls
- inline secret, PII, and SSRF controls
- retrospective Sentinel audit
- host monitoring, host firewall monitoring, and gateway firewall monitoring
- approval workflows, policy controls, and self-policing

The recommendation is not to copy Pipelock's product shape. The recommendation is to adopt the parts that strengthen GuardianAgent's existing architecture:

1. add an optional local egress firewall/proxy mode
2. harden MCP with tool-inventory drift and bidirectional scanning
3. add a bypass/evasion regression corpus
4. add repo and automation audit tooling
5. package findings better for suppressions, SIEM, and operators

---

## Public Claims Observed

Based on public README and docs, Pipelock appears to position itself as an "AI agent firewall" that sits in-line with network and MCP traffic rather than as a full host sandbox.

Publicly described capabilities include:

- HTTP and HTTPS proxying for agent egress
- fetch-style interception
- WebSocket scanning
- bidirectional MCP request and response scanning
- tool poisoning and mid-session tool drift detection
- DLP and entropy checks before DNS resolution
- project and PR audit workflows
- SIEM output and metrics packaging
- deployment presets for monitor, block, and CI-style use cases

It also explicitly frames itself as complementary to sandboxing rather than a replacement for it. That is aligned with GuardianAgent's current direction.

---

## Comparison Summary

| Area | GuardianAgent Today | Pipelock Public Positioning | Recommendation |
|------|----------------------|-----------------------------|----------------|
| Tool admission | Strong Guardian pipeline with policy and approvals | Not its main focus | Keep GA lead |
| Host self-monitoring | Strong and growing | Not the main product shape | Keep GA lead |
| Egress firewalling | Partial, mostly tool-specific | Core strength | Borrow |
| MCP hardening | Good baseline, but coarse | Strong public emphasis | Borrow |
| Bypass/evasion tests | Present, but not specialized enough | Strong public emphasis | Borrow |
| Repo/CI audit | Partial | Strong public emphasis | Borrow |
| SIEM packaging | Basic notification/audit surfaces | Strong public emphasis | Borrow |

---

## What GuardianAgent Should Borrow

### 1. Optional Local Egress Firewall Mode

GuardianAgent should add a first-class local egress mode for non-container installs.

Why it matters:

- host-installed agents need a control that sees outbound traffic regardless of which tool initiated it
- it complements existing Guardian admission rather than replacing it
- it reduces the gap between "tool policy" and "actual network exit"

Recommended scope:

- explicit `HTTP_PROXY` and `HTTPS_PROXY` support
- allow, monitor, and block modes
- request metadata logging
- destination policy by domain, category, or explicit allowlist
- body and header scanning before forwarding
- rate limits and per-destination budgets
- alerting on direct-bypass attempts when a protected mode is enabled

Recommended integration points:

- `src/index.ts`
- `src/guardian/guardian.ts`
- `src/runtime/notifications.ts`
- `src/channels/web.ts`
- new runtime service under `src/runtime/`

Deliberate non-goal for v1:

- do not make TLS MITM the default posture

### 2. MCP Firewall Hardening

GuardianAgent already treats MCP as untrusted external tooling, but there is a practical gap between "tool call allowed" and "MCP channel is continuously monitored."

Recommended additions:

- baseline `tools/list` results for each MCP server
- alert on tool name, description, and schema drift
- scan MCP tool responses before reinjection into the model
- detect tool poisoning patterns in descriptions and examples
- support a proxy or broker mode for remote MCP connections later
- expose explicit MCP posture in Security and audit views

Recommended integration points:

- `src/tools/mcp-client.ts`
- `src/tools/executor.ts`
- `src/guardian/output-guardian.ts`
- `src/runtime/notifications.ts`
- `docs/specs/MCP-CLIENT-SPEC.md`

### 3. Bypass-Resistance Regression Suite

Pipelock's most reusable idea is not just scanning logic. It is the assumption that attackers will split, encode, and obfuscate payloads to evade controls.

GuardianAgent should add dedicated regression coverage for:

- secrets split across path, query, body, and headers
- multi-layer encoding
- homoglyph and zero-width character abuse
- DNS-label entropy and pre-resolution checks
- MCP-specific prompt/tool poisoning patterns
- outbound exfil via partial fragments across multiple requests

Recommended integration points:

- `src/guardian/*.test.ts`
- `src/tools/*.test.ts`
- new fixtures under `test/fixtures/` or `src/test/`

### 4. Project Audit and CI Guardrails

GuardianAgent should have a repo-facing audit mode that scans its own configurations, packs, and workflows for risky patterns.

Recommended checks:

- unsafe automation definitions
- overly broad tool permissions
- risky MCP configurations
- suspicious connector commands
- secrets in workflow definitions or examples
- dangerous sandbox or policy settings

Recommended outputs:

- CLI report
- machine-readable JSON
- CI exit codes
- audit events that feed existing notifications

Recommended integration points:

- `src/runtime/builtin-packs.ts`
- `src/runtime/scheduled-tasks.ts`
- `src/config/loader.ts`
- `src/guardian/audit-log.ts`
- new CLI entrypoint or audit command

### 5. Better Suppressions and Explainability

GuardianAgent already has notification suppression controls, but operator ergonomics can go further.

Recommended additions:

- stable rule IDs on block and alert events
- suppression rules with expiry
- per-rule mute scopes
- explanation text for why something was blocked or downgraded
- linked remediation guidance in CLI, web, and Telegram

This matters because stronger monitoring without better suppression quickly becomes noise.

### 6. SIEM and Metrics Packaging

GuardianAgent already has audit and notification streams. It should package them better for external security tooling.

Recommended additions:

- documented event schema for security events
- canned Splunk, Elastic, and KQL examples
- Prometheus counters for host, gateway, MCP, and egress findings
- scheduled export jobs for high-signal audit summaries

---

## What GuardianAgent Should Not Copy

- a single-product "agent firewall" framing that understates runtime controls
- TLS interception as a default requirement
- reliance on network inspection as the primary control surface
- vendor-specific assumptions that weaken local-first operation

GuardianAgent's differentiation is stronger if it combines:

- runtime admission
- local host and firewall posture
- audit and notification
- optional inline egress control

rather than collapsing into a proxy-only security story.

---

## Proposed Phases

### Phase 1: MCP Hardening and Evasion Tests

**Effort:** Small to medium

Ship first:

- MCP tool inventory baseline
- MCP description/schema drift alerts
- MCP response reinjection scanning improvements
- targeted bypass/evasion fixtures and regression tests

Why first:

- lowest implementation risk
- directly improves an existing high-risk surface
- immediately strengthens GuardianAgent's self-policing story

### Phase 2: Repo Audit and CI Mode

**Effort:** Medium

Ship next:

- local repo audit command
- automation and config lints
- machine-readable findings for CI
- built-in automation starter for scheduled self-audit

Why second:

- leverages the existing audit and notification pipeline
- helps GuardianAgent police its own configuration, packs, and workflows

### Phase 3: Optional Egress Firewall Mode

**Effort:** Medium to high

Ship after the audit foundations:

- local proxy service
- outbound request policy and alerting
- block mode for protected deployments
- web visibility for egress findings

Why third:

- highest value borrowed idea
- more invasive than the earlier phases
- easier to ship well after MCP and audit rule IDs exist

### Phase 4: SIEM, Suppression, and Operator Packaging

**Effort:** Medium

Ship alongside or immediately after egress mode:

- stable rule IDs
- richer suppression model
- exported metrics and SIEM templates
- operator-facing explanation and remediation guidance

---

## Proposed Success Criteria

- GuardianAgent detects MCP tool drift before affected tools are used in later runs.
- GuardianAgent blocks or alerts on representative exfil bypass fixtures that currently slip through.
- Repo audit mode finds unsafe automation or MCP config before deployment.
- Optional egress mode catches outbound destinations even when a tool path is not yet individually instrumented.
- Operators can suppress noisy findings without disabling entire categories of protection.

---

## Risks and Tradeoffs

- Egress proxying can become brittle if it tries to transparently catch every network path on day one.
- MCP hardening can create noisy alerts if tool-description drift is not normalized carefully.
- Repo audit can become low-value if it only restates existing policy decisions instead of finding new risk.
- Better suppressions are mandatory if more detections are added.

---

## Recommended Immediate Next Step

If GuardianAgent adopts any of this, the best first implementation slice is:

1. MCP tool inventory baseline and drift alerts
2. MCP response reinjection scanning
3. a dedicated bypass/evasion test corpus

That sequence is the best ratio of security value to implementation cost, and it uplifts a surface GuardianAgent already exposes today.

---

## Sources

- Pipelock repository: https://github.com/luckyPipewrench/pipelock
- Pipelock README: https://github.com/luckyPipewrench/pipelock/blob/main/README.md
- Pipelock bypass-resistance notes: https://github.com/luckyPipewrench/pipelock/blob/main/docs/bypass-resistance.md

