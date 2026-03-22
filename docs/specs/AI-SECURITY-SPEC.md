# Assistant Security - As-Built Spec

**Status:** Implemented for the current posture-driven scope  
**Date:** 2026-03-21  
**Related:** [WEBUI-DESIGN-SPEC.md](/mnt/s/Development/GuardianAgent/docs/specs/WEBUI-DESIGN-SPEC.md), [SECURITY-PANEL-CONSOLIDATION-SPEC.md](/mnt/s/Development/GuardianAgent/docs/specs/SECURITY-PANEL-CONSOLIDATION-SPEC.md), [THREAT-INTEL-SPEC.md](/mnt/s/Development/GuardianAgent/docs/specs/THREAT-INTEL-SPEC.md), [CODE-WORKSPACE-TRUST-SPEC.md](/mnt/s/Development/GuardianAgent/docs/specs/CODE-WORKSPACE-TRUST-SPEC.md), [AGENTIC-DEFENSIVE-SECURITY-SUITE-AS-BUILT-SPEC.md](/mnt/s/Development/GuardianAgent/docs/specs/AGENTIC-DEFENSIVE-SECURITY-SUITE-AS-BUILT-SPEC.md)

## Purpose

Define the shipped `Assistant Security` capability in GuardianAgent.

This is an as-built runtime and operator spec, not an implementation plan. It documents what exists now, how it integrates with the broader security stack, and which parts of the broader vision remain deferred.

User-facing surfaces use the name `Assistant Security`. Some internal compatibility paths still use legacy `ai-security` naming, including `src/runtime/ai-security.ts` and `/api/security/ai/*`.

## Current Scope

The shipped capability covers:

- posture-driven scans against the live Guardian runtime and tracked coding workspaces
- manual scans from `Security > Assistant Security`
- assistant-callable scan and summary tools
- a built-in quick action for security review
- managed continuous monitoring through Configuration-owned scheduling
- persisted findings and run history across restart
- promotion of high-signal findings into `Security Log`
- persisted Assistant Security activity history
- projection of latest results into `Code > Checks`
- conservative automatic containment for selected high-confidence findings
- MCP exposure monitoring as part of runtime posture review

The current scope does **not** include:

- live adversarial prompt or jailbreak probe execution against the configured LLM
- garak or external probe-pack worker integration
- browser or web-chat target execution
- ASR scoring or trend charts
- autonomous remediation beyond temporary containment tightening

## Separation Model

GuardianAgent now has two complementary security layers:

### 1. Inline runtime enforcement

This is Guardian’s existing prevention path:

- approvals
- tool policy enforcement
- sandbox and degraded-backend controls
- workspace trust gates
- guarded LLM handling
- containment checks before tool execution

### 2. Assistant Security review and monitoring

This is the detection and validation layer:

- recurring posture review
- runtime and workspace exposure findings
- promoted Assistant Security alerts
- operator-facing findings, runs, and activity history
- conservative temporary containment based on repeated high-confidence findings

Assistant Security does not replace inline enforcement. It reviews whether the current runtime, workspace, and MCP posture are drifting into states that make the inline controls less trustworthy over time.

## Operator Model

The command center lives in `Security > Assistant Security`.

The shipped Security page now uses:

- `Overview`
- `Security Log`
- `Assistant Security`
- `Threat Intel`

The `Assistant Security` tab currently includes:

- `Continuous Monitoring`
- `Run Assistant Security Scan`
- `Assistant Security Summary`
- `Assistant Security Findings`
- `Recent Assistant Security Runs`
- `Assistant Security Activity`

`Configuration > Security` owns the editable settings. The `Continuous Monitoring` panel inside `Assistant Security` is a read-only status view of the managed schedule and explicitly explains that the work is scheduler-driven infrastructure work, not a conversational assistant turn.

## Runtime Model

The runtime implementation is centered on `AiSecurityService`.

Current behavior:

- findings and runs persist to `~/.guardianagent/assistant-security.json`
- scans support three sources:
  - `manual`
  - `scheduled`
  - `system`
- targets are currently:
  - the Guardian runtime
  - deduplicated tracked coding workspaces
- built-in profiles are currently:
  - `quick`
  - `runtime-hardening`
  - `workspace-boundaries`
- posture confidence is currently reported as:
  - `bounded` when sandbox availability is `strong`
  - `reduced` otherwise

The current implementation is deterministic and posture-driven. It evaluates the runtime snapshot and workspace-trust state; it does not yet send adversarial probe prompts through the active LLM.

## Detection Coverage

Current finding categories are:

- `sandbox`
- `policy`
- `browser`
- `mcp`
- `workspace`
- `trust_boundary`

### Runtime posture findings

Assistant Security currently detects and persists findings for:

- sandbox disabled entirely
- degraded permissive fallback active
- degraded fallback with network tools enabled
- degraded fallback with browser tools enabled
- degraded fallback with manual code terminals enabled
- agent-initiated policy widening enabled for paths, domains, or tool policies
- browser tooling enabled without an explicit local domain allowlist

### MCP exposure findings

Assistant Security now treats MCP posture as part of runtime security review and detects:

- connected third-party MCP servers
- connected third-party MCP servers with outbound network access
- connected third-party MCP servers inheriting the Guardian process environment
- connected MCP servers receiving explicit environment variables
- connected third-party MCP servers using trust-level overrides
- dynamic Playwright MCP package resolution if it reappears

This complements the separate Guardian core MCP hardening. Core hardening owns prevention and safer defaults; Assistant Security owns visibility, recurrence tracking, and promotion into operator-facing queues.

### Workspace posture findings

For tracked coding workspaces, Assistant Security currently detects:

- missing trust assessment
- workspace trust in `caution`
- workspace trust in `blocked`
- blocked workspaces that are running under a manual acceptance review
- high-risk workspace-trust findings, including prompt-injection-style content surfaced by the trust review pipeline

Assistant Security does not replace `workspaceTrust`. It consumes that output and presents it as security evidence alongside runtime posture findings.

## Integrations

### Security Log and unified alerts

High and critical Assistant Security findings are promoted into the main security surfaces:

- a unified alert source of `assistant`
- audit-backed anomaly records for evidence and timeline review

This means Assistant Security findings participate in the same operator queue as host, network, gateway, and native-provider alerts without creating a separate incident console.

### Activity history

Assistant Security scan lifecycle and related workflow entries are recorded in the persisted security activity stream shown on the `Assistant Security` tab.

### Code checks

The latest Assistant Security result is projected into `Code > Checks` so the active coding session shows current security posture alongside other verification state.

### Assistant tools, API, and automation

The shipped assistant-callable tools are:

- `assistant_security_summary`
- `assistant_security_scan`
- `assistant_security_findings`

The shipped built-in quick action is `Run Security Review`.

The current web API surface is:

- `GET /api/security/ai/summary`
- `GET /api/security/ai/profiles`
- `GET /api/security/ai/targets`
- `GET /api/security/ai/runs`
- `POST /api/security/ai/scan`
- `GET /api/security/ai/findings`
- `POST /api/security/ai/findings/status`

The built-in automation preset is `assistant-security-scan`.

## Managed Continuous Monitoring

Configuration owns managed monitoring under `assistant.security.continuousMonitoring`.

Current fields:

- `enabled`
- `profileId`
- `cron`

Current defaults:

- `enabled: true`
- `profileId: quick`
- `cron: 15 */12 * * *`

Current behavior:

- Guardian keeps the built-in `assistant-security-scan` scheduled task aligned with Configuration
- the managed task runs `assistant_security_scan` directly through scheduler/runtime infrastructure
- this does **not** create a user chat turn or coding-assistant conversation
- the `Assistant Security` tab renders the managed schedule state read-only so operators can see that it is active

## Automatic Containment

Configuration owns automatic containment under `assistant.security.autoContainment`.

Current fields:

- `enabled`
- `minSeverity`
- `minConfidence`
- `categories`

Current defaults:

- `enabled: true`
- `minSeverity: high`
- `minConfidence: 0.95`
- `categories: ['sandbox', 'trust_boundary', 'mcp']`

Current behavior is intentionally conservative:

- it only considers active unified alerts from the `assistant` source
- it only applies when the operator is still in `monitor` mode and broader posture already recommends leaving `monitor`
- one matching `critical` Assistant Security alert is enough to trigger temporary guarded controls
- otherwise, two or more matching alerts are required

Current guarded effects:

- matching `mcp` findings temporarily block MCP tool calls
- matching `sandbox` or `trust_boundary` findings temporarily block direct command execution
- scheduled risky mutations are paused by normal guarded-mode behavior

This keeps the containment path aligned with Guardian’s existing inline policing rather than inventing a second enforcement system.

## Current Boundaries

The current implementation is deliberately narrower than the original longer-term vision.

Deferred work includes:

- live LLM probe execution for jailbreak, prompt-leak, and approval-bypass testing
- browser-backed target execution
- regression trend views and richer analytics
- external community probe adapters
- broader automated remediation beyond temporary guarded controls

The shipped feature should be understood as a posture-and-boundary review system with automation and containment hooks, not yet as a full adversarial scanner.

## Primary Files

- `src/runtime/ai-security.ts`
- `src/runtime/containment-service.ts`
- `src/runtime/security-alerts.ts`
- `src/runtime/security-activity-log.ts`
- `src/runtime/scheduled-tasks.ts`
- `src/tools/executor.ts`
- `src/index.ts`
- `src/config/types.ts`
- `src/config/loader.ts`
- `web/public/js/pages/security.js`
- `web/public/js/pages/config.js`
- `src/reference-guide.ts`
