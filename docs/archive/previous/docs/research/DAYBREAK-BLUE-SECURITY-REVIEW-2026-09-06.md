# Daybreak Blue security review — merged Guardian Agent

> Scope correction, 6 September 2026: this review describes the reduced security runtime, not the complete merged product. Follow the [comprehensive uplift plan](../plans/GUARDIAN-SECURITY-UPLIFT-PLAN-2026-09-06.md) before further cleanup. Blanket legacy deletion is superseded by reuse assessment and feature-parity gates; isolated findings must be re-evaluated when affected modules are restored.

Date: 6 September 2026\
Target: complete `S:/Development/GuardianAgent` working tree at base revision `5ac3a501fb878ea154836680fd398c195230e9ec`, including uncommitted conversion changes\
Model: `gpt-daybreak-blue-latest`, xhigh\
Status: partial deep review followed by independent remediation review and local verification

## Review execution

The Codex Security Deep Scan coordinator completed five independent Daybreak Blue reviews and validated 42 finding instances (41 distinct report entries): seven high, 28 medium and seven low. It then continued toward a configured maximum of 40 independent passes without exposing progress. The run was cancelled at the operator's direction rather than spending further time on redundant passes. Its generated report therefore correctly records **canceled / partial coverage**; it must not be represented as a completed exhaustive scan or proof that no other vulnerabilities exist.

The preserved canonical evidence is currently under `C:/Users/kenle/AppData/Local/Temp/codex-security-scans-mXcw1h/GuardianAgent/5ac3a501fb878ea154836680fd398c195230e9ec_20260906T015452Z_6k22h6h9/`. That temporary location contains `report.md`, `findings.json`, `coverage.json`, `scan-manifest.json`, and SARIF output. This document records the durable engineering disposition without publishing exploit detail as a product claim.

## Product-boundary result

Ten instances were reachable from the Guardian 2 security runtime. Four of those were duplicates of the same persistence-quota weakness. The remaining 32 were in the retained assistant product: web/code sessions, arbitrary execution, browser/fetch, OAuth, Gmail, package inspection, broker, AppContainer, and legacy deployment paths.

The high-severity findings were legacy execution issues. They were not imported by `dist/security-main.js`, but they could not initially be dismissed because the repository still provided `legacy:dev`, `legacy:start`, Windows legacy launchers, Docker, and a public Fly deployment that ran `dist/index.js`. Those supported paths have now been removed. The clean build deterministically retains exactly 20 runtime JavaScript modules rooted at `security-main.js`; the package builder separately revalidates the same static dependency closure.

Legacy source still exists outside the build so retained modules can be extracted and historical tests can run. Its 32 findings are therefore **isolated from the supported product, not source-remediated**. The obsolete source, tests and development dependencies should be deleted before a broad public security-release claim. Reintroducing `src/index.ts`, `dist/index.js`, old web assets, Docker/Fly, native helper, or an alternate launcher reintroduces the reported attack surface.

## Guardian 2 findings and disposition

| Finding | Severity | Disposition |
|---|---:|---|
| Connector evidence and repeated imports can exhaust SQLite/disk | Medium (four overlapping instances) | Fixed centrally: 64 KiB finding records; recursive evidence depth/value/string/container bounds; 32 MiB per connector; per-record, per-kind and 512 MiB aggregate record quotas; 64 MiB filesystem reserve; transactional rollback |
| Project metadata listing materializes complete large envelopes | Medium | Fixed: SQL projects metadata projection returns only ID/name/revision/timestamps and filters scoped project IDs before materialization |
| Oversized unknown operation names persist in denial audit | Medium | Fixed: 128-byte HTTP operation-name limit before dispatch; audit actor/operation/target and details are independently bounded with digest/byte metadata |
| Newest-only findings and audit windows hide older evidence | Medium | Fixed: stable row/sequence cursors, totals and `hasMore`; project filtering occurs in SQL before page limits; UI exposes “Load older” controls |
| One scoped credential can fill all browser sessions | Medium | Fixed: one reusable session identifier per principal, 90-session non-admin ceiling and administrator recovery eviction/capacity |
| Anonymous API rate bucket can block sign-in | Low / boundary-dependent | Hardened: generic API, local login, Entra start/callback and authenticated-principal buckets are separate; failed logins remain limited |
| Project-scoped finding update reveals cross-project existence | Low | Fixed: missing and out-of-scope findings return identical 404 responses |
| Completed and expired security jobs grow indefinitely | Low / operational | Fixed: newest 1,000 resolved terminal jobs retained; pending, running, requested, unknown and interrupted outcomes preserved; expired approvals are durably transitioned and audited before pruning |

The independent bypass review found and corrected five issues in the first remediation candidate:

1. A browser session was inserted before its audit event. Audit now succeeds before the cookie or in-memory session exists.
2. `findings:write` could link to projects without `projects:read`. Link resolution now requires explicit read authority before looking up a project.
3. The database constructor created tables before rejecting an unsupported schema. Existing databases are now version/layout validated before journal or table changes; incomplete/future/unversioned layouts fail closed.
4. Awaiting approvals were displayed as expired without persisting that state, so retention missed them. Expiration is now a durable audited transition and is included in terminal retention.
5. CLI help advertised the removed legacy launcher. The stale claim was removed.

## Legacy-only validated findings

The 32 isolated findings covered:

- legacy bearer rotation failing to revoke sessions; caller-controlled execution context; cross-principal CodeSession ownership and raw thread-resume failures;
- Windows shell grammar, read-only redirection, broad Git prefixes, managed npm command composition and unsandboxed Codex terminal execution;
- workspace symlink/junction and absolute-root escapes across files, Git, terminal, remote sessions and new-file writes;
- initial-hop-only SSRF/domain validation, redirect/DNS pivots, browser subresource navigation and response/decompression memory exhaustion;
- Microsoft/Google OAuth callback state and HTML handling, same-site legacy web CSRF, stored configuration XSS and spoofable proxy throttling;
- Gmail CRLF header injection, inherited supervisor credentials, broad AppContainer ACLs, worker-selected LLM providers, unbounded broker frames and forged execution-graph events;
- authentication-disabled legacy owner access.

Supported launch and deployment routes for these components were deleted: legacy npm scripts, legacy Windows/Unix start scripts, broad deployment script, Dockerfile, Fly configuration, historical deployment guide, native Windows helper and legacy Windows installer/portable builders. The root package is private, normal root packing is blocked, production dependencies exclude legacy-only `pino`, and every normal build deletes stale output before compiling/pruning.

## Verification after remediation

- Focused persistence/service/server security suite: 70 passed, zero failed.
- Final full repository suite: 4,206 passed, zero failed or skipped; this includes 172 security-workspace tests across seven files. A first concurrent run had one legacy timing failure that passed alone; the clean serial rerun passed completely.
- Backend and frontend TypeScript: passed.
- Clean build: passed and produced exactly 20 runtime JavaScript modules.
- Production dependency audit: zero advisories. The retained development/legacy dependency tree still has 46 advisories and is another reason to delete obsolete source/dependencies.
- Production-only clean install: passed SQLite bootstrap, service startup, administrator session, project mutation and packaged UI.
- Packaging policy and real Windows launcher under Node 24: passed. The regenerated tarball contains exactly 20 runtime JavaScript modules, its shrinkwrap and read-only AWS policy, and no legacy entrypoint, source or old web UI.
- Real browser regression: passed six pages, paged findings, ContextCypher create/edit/save/reload and original/current export, plus scan proposal/rejection without executing a scan at desktop and mobile viewports.
- `git diff --check` and dependency contract: passed.

## Remaining security gates

1. Perform a bounded follow-up security scan of the 20-module Guardian 2 closure. Do not repeat the 40-pass deep-scan configuration.
2. Delete remaining legacy source, tests and dev dependencies, then update repository instructions. Until deletion, scanners will correctly continue finding vulnerabilities in unused source.
3. Validate macOS commands/package behavior on a Mac, Entra flows in a real tenant, and AWS collection against the intended account/IAM policy.
4. Add signed installers/notarization, protected service identity/update delivery and customer/vendor acceptance before an enterprise-ready claim.

The review supports continuing the Guardian 2 design, with the remediations above. It does not support describing this alpha as tamper-resistant EDR, a complete LAN sensor, a remotely managed fleet, or an enterprise-approved release.
