# Execution Surface Supply Chain Security Uplift Plan

**Status:** Draft  
**Date:** 2026-04-19  
**Origins:** implementation review against the current GuardianAgent runtime after agent-era supply-chain threat modeling of hidden runtime installs, dynamic launcher resolution, credential inheritance paths, and generated-artifact dependency drift  
**Companion specs:** [Security Policy](/mnt/s/Development/GuardianAgent/SECURITY.md), [Architecture Overview](/mnt/s/Development/GuardianAgent/docs/architecture/OVERVIEW.md), [Forward Architecture](/mnt/s/Development/GuardianAgent/docs/architecture/FORWARD-ARCHITECTURE.md), [MCP Client Spec](/mnt/s/Development/GuardianAgent/docs/specs/MCP-CLIENT-SPEC.md), [Package Install Trust Spec](/mnt/s/Development/GuardianAgent/docs/specs/PACKAGE-INSTALL-TRUST-SPEC.md), [Tools Control Plane Spec](/mnt/s/Development/GuardianAgent/docs/specs/TOOLS-CONTROL-PLANE-SPEC.md)

## Objective

Close the gap between the surface an operator reviews and the code GuardianAgent actually executes at runtime.

The target state is:

1. every external executable/package resolution path is either pinned, locally materialized, or explicitly fingerprint-reviewed before launch
2. assistant-launched subprocesses inherit a minimal environment by default instead of the parent shell environment
3. approval is tied to the exact execution identity, not only to a server/tool name
4. package-install review captures materially more than the current top-level artifact set
5. shipped dependency and SDK manifests have one clear source of truth, and generated packaging artifacts cannot silently drift from it
6. Assistant Security and packaging validation can detect and explain drift in these areas without doc-only claims

## Planning Principles

- **Fix the boundary that owns the risk.** Use shared subprocess environment policy, MCP admission, package-install trust, and Assistant Security rather than one-off call-site patches.
- **Separate operator-manual terminals from assistant-managed execution.** Guardian should not quietly widen assistant subprocess authority just because both surfaces currently use PTYs.
- **Prefer fail-closed over launcher magic.** If a trusted runtime surface depends on `npx`, `npm exec`, or similar dynamic launchers, either replace it with a pinned local path or force an explicit reviewed setup step.
- **Bind trust to execution identity.** Approval for “the Playwright MCP server” or “this MCP config” is weaker than approval for a resolved executable, arguments, version, and env contract.
- **Keep visibility aligned with enforcement.** Every new control in this plan must emit state that Assistant Security and operator surfaces can actually observe.
- **Keep one source of truth for shipped dependencies.** Root manifests and lockfiles define what Guardian ships; staged packaging manifests are generated artifacts and must either be regenerated from source or removed from version control.
- **Do not regress existing architecture invariants.** Intent routing stays in the `IntentGateway`, tool execution stays in `ToolExecutor`, and new behavior should extend shared runtime/state models instead of forking per channel.

## Current Baseline

| Surface | Current strength | Current gap |
|---|---|---|
| Third-party MCP startup | `startupApproved` required; `inheritEnv: false` by default; degraded backends block MCP by default | approval is a boolean rather than a fingerprinted review record; docs still normalize `npx` launch patterns |
| Managed browser MCP | local `@playwright/mcp` package is preferred; managed browser startup forces `inheritEnv: false` | `npx --no-install` fallback still exists; startup scripts still run `npx playwright install chromium`; Assistant Security does not wire actual dynamic-resolution state |
| Assistant-managed PTY sessions | shell launch is centralized; shell env passes through `buildHardenedEnv` | `buildHardenedEnv` only strips a narrow loader/interpreter list and otherwise preserves ambient secrets from `process.env` |
| Coding backend CLIs | backends are disabled by default; launches are session-bound and audited | delegated CLIs run through PTYs that currently inherit most parent env vars; backend security becomes part of the runtime trust boundary once enabled |
| Managed package installs | install-like commands are redirected to `package_install`; v1 rejects requirements files, editable installs, direct URLs, and local paths | subprocess runner still uses `process.env`; v1 only stages requested top-level artifacts, not the full resolved dependency closure |
| Root dependency manifests and packaged app artifacts | repo root `package.json` and `package-lock.json` are the live dependency source for the main app and current SDK set | tracked staged manifests under `build/windows/app/` can drift from the root source of truth and appear authoritative unless packaging regenerates or removes them |
| Assistant Security | can flag MCP env inheritance and dynamic Playwright package resolution in theory | runtime snapshot hard-codes `usesDynamicPlaywrightPackage: false`, so part of the posture model is currently disconnected |

## Primary Workstreams

## Phase 1: Shared Minimal-Environment Policy

### Goal

Stop assistant-managed subprocesses from inheriting ambient developer credentials by default.

### Deliver

- Add one shared subprocess environment policy module, for example:
  - `src/runtime/subprocess-env.ts`
  - or `src/sandbox/env-policy.ts`
- Define explicit env profiles for:
  - `third_party_mcp`
  - `managed_browser`
  - `assistant_managed_terminal`
  - `coding_backend_cli`
  - `managed_package_install`
- Move from “start with `process.env`, then strip a few keys” to:
  - start from a minimal allowlist
  - add only explicit required keys per surface
  - preserve only pathing/runtime essentials unless a surface opts in to more
- Reuse existing per-surface explicit allowlist patterns where they already exist:
  - MCP: `allowedEnvKeys`
  - new equivalent for coding backends and assistant-managed PTY launches
- Emit audit metadata with inherited env key names, never values

### Likely implementation areas

- `src/sandbox/profiles.ts`
- `src/tools/mcp-client.ts`
- `src/channels/web.ts`
- `src/channels/web-terminal-routes.ts`
- `src/runtime/package-install-trust-service.ts`
- `src/runtime/coding-backend-service.ts`
- `src/config/types.ts`

### Exit criteria

- assistant-managed terminal launches do not inherit AWS/GitHub/npm/cloud credentials unless explicitly configured
- coding backend CLIs run with a minimal env profile by default
- managed package installs run with a minimal env profile by default
- third-party MCP behavior remains on the same minimal-env model it already claims in policy/docs

## Phase 2: Remove Dynamic Launcher Behavior From Trusted Startup Paths

### Goal

Eliminate runtime and startup paths where Guardian appears to launch a reviewed local dependency but actually resolves or downloads code via a dynamic launcher.

### Deliver

- Remove the `npx` fallback from `resolveManagedPlaywrightLaunch`
- Require managed browser startup to use a locally materialized package path only
- Replace automatic browser binary download in startup scripts with one of:
  - an explicit setup script the operator runs knowingly
  - or a startup health check that fails closed and prints the remediation step
- Review other managed startup surfaces for launcher classes such as:
  - `npx`
  - `npm exec`
  - `pnpm dlx`
  - `yarn dlx`
  - `uv run`
- Keep launcher-based examples out of “normal configuration” docs unless they are explicitly labeled as test-only or temporary

### Likely implementation areas

- `src/runtime/playwright-launch.ts`
- `src/index.ts`
- `scripts/start-dev-windows.ps1`
- `scripts/start-dev-unix.sh`
- `docs/architecture/OVERVIEW.md`
- `docs/specs/MCP-CLIENT-SPEC.md`
- `docs/guides/MCP-TESTING-GUIDE.md`
- `docs/guides/DEPLOYMENT.md`

### Exit criteria

- managed browser startup never resolves through `npx`
- local startup scripts no longer perform networked browser downloads implicitly
- operator remediation steps are explicit and reviewable
- docs stop normalizing launcher-based third-party MCP examples as the default secure path

## Phase 3: Fingerprinted MCP Review and Drift Revalidation

### Goal

Replace boolean approval for third-party MCP startup with approval bound to the exact thing being executed.

### Deliver

- Extend MCP admission from `startupApproved: boolean` to a persisted review record that includes:
  - resolved executable path
  - argv
  - working directory
  - source classification
  - env key names
  - version/hash/fingerprint where available
- Block startup when the live fingerprint no longer matches the approved review record
- Add a bounded re-review flow instead of silently accepting drift
- Decide and document the default policy for launcher classes in third-party MCP:
  - preferred: deny them by default
  - fallback: allow only via explicit high-risk review flow with fingerprinted package/version identity
- Preserve existing `startupApproved`, `inheritEnv`, `allowedEnvKeys`, `trustLevel`, and rate-limit semantics where they still make sense, but anchor them under the new review record

### Likely implementation areas

- `src/tools/mcp-client.ts`
- `src/index.ts`
- `src/runtime/control-plane/`
- `src/runtime/ai-security.ts`
- `src/config/types.ts`
- `src/config/loader.ts`

### Exit criteria

- changing a third-party MCP command, args, resolved binary, or env contract invalidates prior approval
- operators can inspect what was reviewed
- Assistant Security can distinguish “approved and unchanged” from “approved but drifted”

## Phase 4: Package Install Trust v2

### Goal

Reduce the gap between Guardian-managed package review and the actual dependency closure installed on the host.

### Deliver

- Run both staging and final install steps under the new minimal-env policy
- Introduce an isolated install home/cache/temp contract for managed installs where feasible
- Capture more of the resolved dependency closure instead of only requested top-level artifacts
- Persist exact installed artifact metadata:
  - package names
  - versions
  - hashes/fingerprints where available
  - closure limitations when full capture is not possible
- Keep v1 parser restrictions for unsupported forms unless deliberately widened through a reviewed architecture change
- Surface the residual gap explicitly when Guardian cannot inspect the full closure rather than implying stronger coverage than exists

### Likely implementation areas

- `src/runtime/package-install-trust.ts`
- `src/runtime/package-install-trust-service.ts`
- `src/tools/executor.ts`
- `docs/specs/PACKAGE-INSTALL-TRUST-SPEC.md`
- `SECURITY.md`

### Exit criteria

- managed install subprocesses no longer inherit ambient credentials by default
- events and alerts record materially more than top-level requested packages
- operator-facing copy clearly distinguishes reviewed closure from unresolved closure

## Phase 5: Dependency, SDK, and Packaging Drift Governance

### Goal

Make dependency truth explicit and prevent release packaging artifacts from silently drifting away from the reviewed repo manifests.

### Deliver

- Codify repo root `package.json` and `package-lock.json` as the source of truth for shipped Node dependencies and SDK versions
- Treat `build/windows/app/package.json` and `build/windows/app/package-lock.json` as generated packaging artifacts rather than independent dependency definitions
- Choose and implement one supported model for staged Windows manifests:
  - remove them from version control entirely and regenerate on demand
  - or keep them tracked only if packaging/build validation regenerates and verifies them before commit or release
- Add a packaging drift validation step that fails when staged Windows manifests differ from the root source of truth outside explicitly documented packaging-only transformations
- Tighten the Windows packaging path so `scripts/build-windows-package.ps1` is the only supported generator for staged app manifests, or replace the current copy flow with a more explicit generation pipeline that preserves the same source-of-truth rule
- Record and document that drift remediation is distinct from upgrade work:
  - this uplift should remove stale or contradictory manifests
  - it should not opportunistically bump third-party SDKs or packages without a repo-owned implementation target or explicit user-approved registry research
- Where release artifacts materially diverge from root manifests by design, persist that delta as an explicit reviewable packaging contract instead of letting it live as stale checked-in files

### Likely implementation areas

- `scripts/build-windows-package.ps1`
- `build/windows/app/package.json`
- `build/windows/app/package-lock.json`
- `docs/guides/DEPLOYMENT.md`
- `SECURITY.md`
- new packaging validation logic under `scripts/` or CI

### Exit criteria

- root manifests are the only authoritative source for shipped Node dependency and SDK versions
- staged Windows app manifests cannot remain stale after a supported packaging/build flow
- package/release validation fails closed on unexpected staged-manifest drift
- this uplift does not blur drift cleanup with opportunistic third-party upgrade churn

## Phase 6: Assistant Security Signal Wiring

### Goal

Make the current security posture observable enough to catch the exact failure modes this plan is intended to remove.

### Deliver

- Wire actual managed browser launch-source state into `AiSecurityRuntimeSnapshot`
- If dynamic Playwright resolution is removed, replace the current finding with checks for:
  - unexpected launcher usage
  - missing local materialization
  - browser startup drift
- Add new runtime findings for:
  - assistant-managed PTY env inheritance beyond the approved minimal profile
  - coding backend env inheritance beyond the approved minimal profile
  - managed install runner env inheritance
  - MCP review fingerprint drift
  - startup scripts/config surfaces that still imply implicit downloads
- Update security posture scoring to reflect these new surfaces without diluting existing sandbox/MCP findings

### Likely implementation areas

- `src/runtime/ai-security.ts`
- `src/index.ts`
- `src/runtime/security-alerts.ts`
- `src/runtime/security-posture.ts`
- `web/public/`

### Exit criteria

- Assistant Security findings match real launch behavior instead of hard-coded placeholders
- posture scans can catch the risky paths identified in this review
- operator-facing security surfaces are usable for drift triage

## Phase 7: External Coding Backend Boundary Hardening

### Goal

Treat external coding backends as an explicit trust boundary once enabled, not as a transparent extension of Guardian policy.

### Deliver

- Apply the shared minimal-env policy to coding backend launches
- Add backend-specific warnings and posture metadata when a backend is enabled
- Add fast disable/containment path for coding backends in control-plane surfaces
- Review backend update metadata and ensure it remains operator-triggered only
- Add explicit distinction between:
  - backend configured
  - backend enabled
  - backend allowed to receive credentials
  - backend allowed networked execution

### Likely implementation areas

- `src/runtime/coding-backend-service.ts`
- `src/runtime/coding-backend-presets.ts`
- `src/runtime/ai-security.ts`
- `src/runtime/control-plane/`
- `web/public/`

### Exit criteria

- coding backend CLIs no longer receive broad ambient env by default
- enabling a coding backend creates explicit operator-visible posture changes
- backend update commands remain metadata, not implicit runtime actions

## Recommended Execution Order

1. **Phase 1: Shared Minimal-Environment Policy**
   This removes the highest-value credential inheritance exposure across multiple surfaces.
2. **Phase 2: Remove Dynamic Launcher Behavior**
   This reduces hidden execution drift and makes later fingerprinting cleaner.
3. **Phase 3: Fingerprinted MCP Review**
   This closes the approval-vs-execution identity gap for third-party servers.
4. **Phase 5: Dependency, SDK, and Packaging Drift Governance**
   This closes the “reviewed repo vs shipped artifact” gap and prevents stale package state from surviving into releases.
5. **Phase 6: Assistant Security Signal Wiring**
   This should land early enough that remaining phases are observable while they are implemented.
6. **Phase 4: Package Install Trust v2**
   This is higher implementation cost and benefits from the new env policy first.
7. **Phase 7: External Coding Backend Boundary Hardening**
   This can partly start in parallel with Phase 1 but should finalize after the env policy is stable.

## Verification Plan

### Unit and focused tests

- `src/tools/mcp-client.test.ts`
- `src/tools/mcp-integration.test.ts`
- `src/runtime/ai-security.test.ts`
- `src/tools/executor.test.ts`
- `src/runtime/package-install-trust.test.ts`
- `src/runtime/package-install-trust-service.test.ts`
- `src/runtime/coding-backend-service.test.ts`
- `src/channels/channels.test.ts`

### New targeted regression cases

1. parent process contains fake `AWS_*`, `GITHUB_TOKEN`, and `NPM_TOKEN`; assistant-managed PTY launch must not expose them by default
2. coding backend launch must not expose parent secrets by default
3. managed package install runner must not expose parent secrets by default
4. changing MCP args or resolved executable path must invalidate prior startup approval
5. managed browser startup must fail closed when the local Playwright MCP package is unavailable
6. startup scripts must no longer download Chromium implicitly
7. staged Windows packaging manifests must either be absent from version control or match the root source-of-truth manifests after a supported packaging run
8. packaging validation must fail on unexpected staged-manifest drift
9. Assistant Security must report the live posture for these surfaces correctly

### Integration harnesses

- `node scripts/test-coding-assistant.mjs`
- `node scripts/test-code-ui-smoke.mjs`
- `node scripts/test-contextual-security-uplifts.mjs`

### Manual validation

- enable a sample third-party MCP server and verify review/fingerprint invalidation behavior
- enable a coding backend with synthetic credentials in the parent shell and verify the backend cannot read them unless explicitly allowed
- run a managed package install with synthetic credentials in the parent shell and verify they do not reach the child install process
- run the supported Windows packaging flow and verify staged app manifests are regenerated from the root source of truth or absent from version control, with validation failing on unexpected drift

## Documentation and Spec Updates Required In The Same Change

- `SECURITY.md`
- `docs/architecture/OVERVIEW.md`
- `docs/architecture/FORWARD-ARCHITECTURE.md` if a new shared subprocess-env module or review-record subsystem changes ownership boundaries
- `docs/specs/MCP-CLIENT-SPEC.md`
- `docs/specs/PACKAGE-INSTALL-TRUST-SPEC.md`
- `docs/specs/TOOLS-CONTROL-PLANE-SPEC.md`
- `docs/specs/WEBUI-DESIGN-SPEC.md` if new posture/review UI surfaces are added
- `docs/guides/DEPLOYMENT.md`
- `src/reference-guide.ts` only for operator-visible behavior changes that affect how the product is used

## Non-Goals

- do not widen package-install support to requirements files, editable installs, direct URLs, or local paths as part of this uplift
- do not weaken MCP startup restrictions in order to preserve old `npx` flows
- do not solve general ecosystem-wide provenance for every possible external binary in one pass if the runtime does not yet own that boundary

## Immediate Implementation Slice

If this work is split into a first PR, the highest-yield slice is:

1. shared minimal-env policy for assistant-managed PTY launches, coding backends, and managed package installs
2. removal of managed browser `npx` fallback
3. removal of automatic `npx playwright install chromium` from startup scripts
4. define root-manifest source-of-truth handling for staged Windows packaging artifacts so `build/windows/app/package*.json` cannot remain stale
5. wiring real `usesDynamicPlaywrightPackage` posture state or removing the stale finding path if it is no longer needed

That slice materially reduces the credential-exposure, hidden-execution, and packaged-artifact drift risk without waiting for full MCP fingerprint review or closure-level package inspection.
