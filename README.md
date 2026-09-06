# Guardian Agent

A local security workspace that connects workstation and network observations to architecture, threats, and controls. Operate it yourself or through a scoped AI assistant connection.

**2.0 alpha — the security conversion is under active verification. Apache-2.0 application code.** This uses the existing Guardian Agent repository and restores the ContextCypher diagram editor, examples, standalone security AI and GRC workflows inside the local security workspace.

For the original general-purpose Guardian Agent, use the [archived 1.0.0 release](https://github.com/Threat-Vector-Security/guardian-agent/releases/tag/v1.0.0). It preserves the code immediately before the security conversion.

## Run

Requires Node.js 24.14 or later with built-in SQLite.

```sh
npm ci
npm run build
npm run init
npm start
```

Open **http://127.0.0.1:3000**. The local browser workspace opens without an access code by default. To require one, enable **Settings → Require an access token to open Guardian**; initialization reports the administrator token file for sign-in and recovery. Configured Entra SSO always requires sign-in. External assistants still need scoped credentials. The service requires no LLM account. Native monitoring runs every minute, with explicit coverage and error reporting.

## Included

- Codex-inspired React workbench with a collapsible sidebar: Protection, Findings, Systems, Environments, Activity, Integrations, Settings.
- Local host posture checks, passive network neighbors/connections, Microsoft Defender status and approved scan requests, and third-party AV inventory.
- ContextCypher JSON import/export with exact original preservation, stable IDs, graph validation, revision conflicts, diagrams, threats and controls, and retained GRC records.
- One authenticated operations service behind HTTP, a JSON CLI, and standard MCP over stdio.
- Scoped, expiring, revocable assistant credentials; separate administrator sessions; durable action proposals and audit records.
- Optional Microsoft Entra ID sign-in with PKCE, signature/tenant validation and explicit group roles.
- Native macOS posture and passive network observations; explicit read-only AWS account collection for EC2, Security Hub and GuardDuty.

Read the [operator and integration guide](docs/guides/SECURITY-WORKSPACE.md) for MCP setup, CLI examples, Entra configuration, data migration, and current limits. The [conversion architecture](docs/architecture/SECURITY-CONVERSION.md) explains implementation ownership; the [decision report](docs/research/GUARDIAN-SECURITY-REPURPOSING-REPORT-2026-09-06.md) records the rationale and longer-term roadmap.

## Verify

```sh
npm run check
npm run test:security-workspace
npm test
node --import tsx web/security/document.check.ts
npm run build
npm run validate:dependency-contract
npm audit
npm run test:package
npm run test:production
```

Tests exercise real SQLite, HTTP and MCP transports with isolated state. Antivirus side effects are injected only in tests, so the test suite never starts a real malware scan. Browser checks run against the real local service; see the [test guide](docs/guides/INTEGRATION-TEST-HARNESS.md).

## Coverage and migration

`npm run package:security` builds a production-only local distribution and tarball. See [packaging](docs/guides/SECURITY-PACKAGING.md) for Windows/macOS launchers and Node prerequisites. Native signed installers remain a release gate. Root `npm pack` is blocked so it cannot accidentally ship the retained legacy runtime.

Guardian coordinates security observations and supported actions. It is not a kernel EDR, packet-inspection engine, or universal interceptor of actions taken outside its interfaces. A requested antivirus scan does not establish completion or a clean result. Optional Entra requires acceptance testing in the customer's tenant. Signed Windows service deployment, remote fleets, proprietary EDR response connectors and managed SIEM delivery remain separate release gates.

Existing application profiles are not silently rewritten. The new service uses `~/.guardianagent/security-v2`; import ContextCypher exports through Systems. The former general assistant has no supported launch, package, container, or deployment path. Its remaining source is retained temporarily only for migration history and test-backed extraction of security modules; it is not part of the Guardian 2 build.

## License and attribution

[Apache-2.0](LICENSE). ContextCypher domain attribution and preserved-format details are in [CONTEXT-MIGRATION.md](docs/architecture/CONTEXT-MIGRATION.md). No ContextCypher credentials, local provider configuration, generated user state or commercial-stream files are included.
