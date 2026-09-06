# Guardian conversion — pause checkpoint

Historical pause snapshot. See [the review handoff](SECURITY-CONVERSION-REVIEW-HANDOFF-2026-09-06.md) for resumption results and current remaining work.

Paused at the user's request for a Codex update. Resume this task from the existing working tree; do not create a new repository or branch. Nothing has been committed or pushed.

## Accepted direction

- Convert the existing public Threat-Vector-Security/guardian-agent repository; Apache-2.0.
- Guardian is a local security application combining workstation/network observations with ContextCypher architecture, threats, risks and controls.
- Windows and macOS are explicit targets. Private infrastructure/VM deployment is appropriate; no public hosted/SaaS product is requested.
- External assistants drive the same scoped HTTP/CLI/MCP service. Separate administrative audience; no assistant self-approval or root enrollment.
- Codex-inspired UI. Enterprise Entra ID SSO is required. AWS security integration was additionally requested.
- User selected medium reasoning to conserve usage. Flag real design difficulty if high reasoning is needed. A Daybreak Blue review is planned after the implementation is ready.

## Implemented and integrated

- `src/security-main.ts`: local bootstrap/rotation, service, structured CLI, import/export and MCP entrypoint. Package defaults now point to this security product; legacy assistant has explicit legacy commands.
- `src/security-workspace/`: SQLite state, original imports, revision conflict handling, scoped clients, immediate revocation, bound approvals/jobs, recovery, audit, HTTP/session/CSRF boundaries and MCP.
- ContextCypher original-file preservation and full opaque document retention, graph validation, graph/domain helpers and risk scoring.
- Six-page React/React Flow UI under `web/security/`, with asset/threat/control editing, original/current exports, approval review and credential management.
- Existing broker authority repaired (including supervisor-owned identity/workspace/trust, grant checks, prohibited worker approval decisions and scoped reads).
- Defender days-to-hours reporting corrected; unavailable values remain unknown.
- Local Windows telemetry verified outside the sandbox: native Defender and passive network sources available; host polling correctly degraded/partial.
- Entra code+PKCE adapter and HTTP session integration, signed JWT/issuer/audience/tenant/nonce validation, explicit group roles, fail-closed overage. No real tenant login has been tested.
- macOS collector code and fixture tests have just been integrated: Gatekeeper, FileVault, Application Firewall, passive ARP/lsof; no live Mac testing yet. XProtect scanning is not claimed.
- New startup scripts, operator guide, architecture supersession notes and README; historical assistant README/start scripts retained explicitly.

## Verification completed before the final Mac/AWS additions

- Full repository suite: **4,149 tests passed, 0 failed**, in `tmp/full-suite-final.json`.
- Security workspace suite: **115 passed**, in `tmp/security-tests.json`.
- Windows/Mac collector buddy suite after Mac work: **39 focused tests passed** (16 collector, 9 host, 14 Defender); TypeScript passed in its isolated worktree.
- Browser: all six pages at 1440×1000 and 390×844; create/edit asset+threat, save/reload, current/original exports, propose/reject antivirus scan; no native scan executed. Screenshots in `tmp/security-ui-qa/`.
- Clean production-only installation outside the repository: SQLite bootstrap, service, administrator session, project creation and packaged UI passed (`scripts/test-security-production.mjs`).
- Production dependency audit had **zero vulnerabilities** after fast-uri 3.1.7 override. This must be repeated after AWS dependency promotion. Retained development/legacy dependencies still have advisory debt; do not describe the entire development tree as audit-clean.
- Dependency contract, backend/frontend TypeScript and Vite build passed before final Mac/AWS additions. The final backend TypeScript check and `git diff --check` also passed after copying the Mac and incomplete AWS source at this pause.
- Cloud buddy attempts did not return a verdict. User explicitly authorized seven core files to GLM-5.2 through Ollama Cloud, but wrapper startup stalled and the bounded direct review timed out. Do not count it as review approval. Independent Codex buddy reviews and regressions were completed.

## AWS is incomplete and must remain disabled

Saved and copied `src/security-workspace/aws-security.ts` and `policies/aws-security-readonly.json`. Strict isolated TypeScript compilation passed; **no AWS tests or live calls ran**.

Current contract: `new AwsSecurityIntegration({region,accountId,profile?}, options?)`, `.target`, `.check()`, `.close()`. It uses fixed official AWS SDK endpoints, STS identity before further reads, EC2 inventory/posture, Security Hub and GuardDuty, with bounded calls and explicit failures.

The root shared service/catalog already has optional `aws.status.get`/`aws.check.start` wiring, but the composition root does **not** instantiate AWS and the UI does not yet expose its controls. It is intentionally not active.

Required before enabling:

1. Add adversarial `aws-security.test.ts`; none exists yet.
2. Detect repeated pagination tokens instead of allowing a truncated result to look complete.
3. Bound generated exposure findings globally; a thousand groups can generate more than a thousand findings.
4. Filter/validate EC2 reservation OwnerId against configured account.
5. Correct timeout classification where abort races currently appear as generic Aborted.
6. Wire explicit account/region/profile environment configuration in the composition root, update UI scope/collection controls, and document least-privilege configuration. Never auto-use ambient AWS credentials without explicit Guardian configuration.
7. Regenerate `package-lock.json` after promoting existing EC2/STS packages from devDependencies to dependencies. SecurityHub/GuardDuty 3.1006.0 installation completed, but the subsequent EC2/STS promotion has not yet been reflected in the lockfile.
8. Re-run production install/audit and relevant/full tests after integration.

## Other remaining integration and review work

- Hide/disable native antivirus scan UI on macOS/Linux using `collectors.supportsScan` / reported platform capability; backend rejection is implemented but UI alignment remains.
- Update platform/private deployment/AWS guidance consistently. Entra is implemented, but requires live customer-tenant acceptance; Mac requires a real machine run.
- Ensure Entra integration status reflects actual configured state instead of the static configuration-required row.
- Finish packaging alignment: existing installer/portable scripts still target the legacy product and should not be used as a security release. New source launchers and npm build work; signed native service/install/update deployment remains a separate unverified enterprise gate.
- Consider exposing retained linked-context and risk-scoring helpers as explicit operations. Entire document mutation already drives the current UI, but full former GRC workflows are preserved data rather than a completed workflow migration.
- Complete retirement/dependency inventory before deleting remaining legacy source. It is excluded from the new server's routes, but retained for migration/regression use.
- Recheck broker changes under Daybreak Blue, especially upstream identity, tool guard coverage, memory authorization, taint lifetime and metadata forwarding.
- Review the entire new security boundary with Daybreak Blue before claiming production/enterprise readiness. This is currently a working alpha conversion, not an approved security release.

## Runtime and buddy state

The original Guardian backend was not restarted. The task's isolated preview on port 3007 and `tmp/security-preview` (PID 38380) was stopped for this pause after verifying its command line. Do not stop the user's original Guardian process.

Detached worktrees remain under ignored `tmp/buddy-context`, `tmp/buddy-ui`, `tmp/buddy-broker`, and `tmp/buddy-collectors`; all buddy work is paused/completed. They contain review snapshots: do not bulk-copy them over the integrated root. No new branches were created. Original ContextCypher provider configuration was not touched.

Resume by reading this checkpoint, `git status --short`, the new architecture note and the exact AWS source. Preserve all user changes. Build before starting the new product; the current `dist/` is a pre-final-Mac/AWS build.
