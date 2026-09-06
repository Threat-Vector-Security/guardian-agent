# Guardian security conversion — review handoff

6 September 2026. This supersedes the pause checkpoint. The existing public repository and branch are retained. Changes remain local and uncommitted; no release was published.

## Implemented

The default application is the local security workspace: a Codex-inspired six-page UI, real SQLite persistence, Windows/macOS posture adapters, ContextCypher editing/preservation, and scoped HTTP/CLI/MCP operations. Administrator sessions are separate from assistant credentials. Native scan proposals bind identity, device, arguments and expiry before approval. Interrupted jobs are not replayed. No general shell, coding assistant or productivity-account operation is exposed by the security service.

Optional Entra OIDC validates signed tenant-bound tokens with PKCE, state, nonce and explicit group roles. Optional AWS collection requires an enrolled account/region, verifies STS identity, then reads EC2, Security Hub and GuardDuty. Bounded results expose missing permissions, disabled services and partial coverage. Neither integration introduces public hosting or remote fleet management.

ContextCypher original bytes and unknown/GRC fields survive import, edit, export and reimport. The UI edits diagrams, assets, threats and controls; findings link to assets. Revision conflicts and removal of linked assets fail atomically. Provider credentials and the commercial stream were excluded. Full former assessment/GRC workflows remain preserved data rather than fully migrated specialized screens. Linked-context/risk helpers exist but are not separate service operations.

Legacy assistant source remains an explicit migration escape hatch and regression baseline. Production packaging follows the security entrypoint's dependency closure, excluding legacy entrypoints/UI, development dependencies, state, credentials and source maps. Root packing is blocked; use the dedicated security packager. Unsigned Windows/macOS launchers require Node 24.14.0+. This is a reviewable alpha, not an enterprise-approved release.

## Verification

| Gate | Result |
|---|---|
| Full Vitest | 4,206 passed, zero failed/skipped; `tmp/full-suite-daybreak-final.json` |
| Security workspace | 172 tests across seven files included above |
| Backend/frontend TypeScript, document preservation, dependency contract | Passed |
| Production npm audit | Zero advisories after AWS XML dependency updates |
| Whole development audit | 46 advisories remain, including three critical; the development environment is not audit-clean |
| Clean production install | SQLite bootstrap, service, administrator session, project mutation and UI passed |
| Packaging | Windows launcher with spaced paths, refusal cases, production install/help/tarball passed; archive includes shrinkwrap and IAM policy |
| Real Windows browser | Six pages; sign-in, create/edit/save/reload, original/current exports, propose/reject scan; desktop/mobile passed without browser errors |
| Real Windows collectors | Defender/passive network available; host coverage explicitly partial; no antivirus scan executed |
| AWS | 26 adversarial SDK tests plus service regressions; live CLI session expired, region ap-southeast-2; no resource collection yet |

Build output: `build/security/guardianagent-2.0.0-alpha.1-win32-x64` and `build/security/guardianagent-2.0.0-alpha.1.tgz`. Screenshots: ignored `tmp/security-ui-qa`. Do not commit preview state or artifacts.

## Review

Buddy findings led to tested fixes for revocation during streamed requests, project/installation authority, immutable imports, conflicting revisions, broker identity/grants, cyclic pagination, account ownership, finding limits, timeout cancellation and shutdown. AWS status is keyed by enrolled target. Host identity changes invalidate old device approvals. Finding links cannot silently become dangling references.

Authorized GLM Cloud attempts returned no verdict and are not counted as approval. Five independent Daybreak Blue review passes subsequently produced 42 validated finding instances before the overlong deep coordinator was cancelled. See [the Daybreak review](DAYBREAK-BLUE-SECURITY-REVIEW-2026-09-06.md). Guardian 2 findings were remediated and legacy launch/deployment paths removed; the canceled scan remains partial rather than a completed approval.

Review `src/security-main.ts`, `src/security-workspace/`, broker/supervisor authority changes, secure filesystem reuse, native provider commands and packaging. Trace root-token exchange, Entra identity mapping, revocation, schema/audience authorization, project restrictions, async jobs, audit transactions, import integrity and untrusted evidence rendering. Verify no assistant can approve itself, enroll administrators, select targets outside enrollment or execute arbitrary commands. Accepted findings need runnable regressions and regenerated artifacts.

## Remaining acceptance

1. Renew the expired AWS CLI session, identify the account and run the authorized read-only adapter in Sydney with isolated output. Verify SDK credential compatibility and real IAM/service coverage. Do not modify IAM or enable services automatically.
2. Run the package and native collectors on a real Mac. Fixtures do not establish OS permissions, command variants or installation behavior.
3. Validate real Entra registration/sign-in, negative group mapping, logout and expiry. SCIM, continuous access evaluation and fleet identity are not implemented.
4. Smoke-test real Codex/Claude/Grok Bot enrollment. MCP protocol tests do not prove cloud-bot reachability to a loopback host; remote access is not opened.
5. Complete Daybreak review, specialized ContextCypher workflow decisions, legacy retirement, signed distribution/service/update hardening and vendor-specific EDR/SIEM response integrations before broader release claims.

Guardian currently provides observations and governed operations, not kernel EDR or universal interception of independent applications. Native endpoint tools retain prevention duties. Same-user/admin tampering, remote fleets and full LAN sensing need additional boundaries, not stronger models. Acceptance evidence supersedes the report's original engineer-week estimates.

## Runtime

Only the task preview was restarted: Node 24 running `dist/security-main.js serve --port 3007 --data-dir S:/Development/GuardianAgent/tmp/security-preview` (PID 35160), at http://127.0.0.1:3007. The original Guardian backend was not restarted. To switch the normal instance, stop it deliberately, then run `npm run init` and `npm start` with Node 24.14.0+ on PATH. Legacy data remains separate.
