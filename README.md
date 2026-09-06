# Guardian Agent

A local security agent for workstations and networks, combining Guardian's security operations with ContextCypher's diagram editor, threat analysis and governance, risk and compliance (GRC) workflows.

Use it as a standalone application or drive it through a scoped AI assistant connection. Review suspicious activity, connect observations to your system architecture, and approve supported security actions from one workspace.

## Run

Requires **Node.js 24.14 or later**. Windows, macOS and Linux build/runtime checks run in CI; native security capabilities vary by operating system. The security workspace is an **alpha**, with no signed native installers. Clone this repository or download and extract its source, then run these commands from its directory:

```sh
npm ci
npm run build
npm run init
npm start
```

Open **http://127.0.0.1:3000**. Guardian runs locally and binds to the workstation's loopback address. Core security monitoring and manual diagram/GRC work require no LLM account.

Local browser access opens without an access code by default. Enable **Settings → Require an access token to open Guardian** to require sign-in; initialization reports the administrator token file location for recovery. Configured Entra SSO always requires sign-in. External assistants always need their own scoped credentials.

## What you can do

| Area | Included capability |
| --- | --- |
| Workstation and network | Host posture checks, passive network observations, Microsoft Defender status and approved scan requests, plus inventory of registered third-party antivirus products |
| System modelling | Drag-and-drop node toolbox, built-in examples, editable node/edge data, automatic zone colours, layout tools and portable diagram/report exports |
| Threat analysis and GRC | Standalone security AI, attack paths, risks, assessments, controls, evidence, statements of applicability and reporting |
| Environment maps | Editable diagrams from recorded local host/neighbor observations or enrolled AWS EC2/security-group inventory; explicit read-only AWS Security Hub and GuardDuty collection |
| Assistant integration | Standard MCP over stdio, JSON CLI and HTTP operations, with scoped, expiring, revocable credentials and recorded approval decisions |
| Identity and workspace | Optional Microsoft Entra ID sign-in, a collapsible Codex-inspired sidebar, revision-checked save/autosave and draft retention on conflicts |

The workspace has seven pages: **Protection, Environments, Findings, Systems, Activity, Integrations and Settings**. Existing ContextCypher imports preserve original bytes and embedded records, including unknown extension fields.

### Standalone AI or your own assistant

Configure a provider and an available model in the editor's settings for built-in analysis and diagram generation. Supported providers include OpenAI, Anthropic, Gemini, xAI and Ollama. Provider keys remain in backend memory and must be entered again after restart. Selected context is sent to the configured provider when you request an AI run; use local Ollama when that context must stay on the workstation.

For Codex or another MCP-compatible assistant, enroll a client in **Settings** and grant only the operations and projects it needs. Follow the [MCP and CLI setup](docs/guides/SECURITY-WORKSPACE.md#drive-it-through-mcp-or-the-cli). An external assistant is optional; the editor and security workflows are usable directly.

### Reference datasets

Seven historical reference datasets are bundled: NIST SP 800-53, OWASP Top 10, MITRE ATT&CK Enterprise/ICS/Mobile, Australian ISM and Essential Eight. **IEC 62443 and CSA CCM texts are excluded** because redistribution permission has not been established. You can import appropriately licensed controls through CSV/XLSX; existing imported controls and workspace records remain supported.

## Documentation

- [Operator and integration guide](docs/guides/SECURITY-WORKSPACE.md): daily use, AI settings, MCP/CLI, Entra, AWS and migration.
- [Local packaging](docs/guides/SECURITY-PACKAGING.md): unsigned Windows/macOS launchers and Node requirements.
- [Conversion architecture](docs/architecture/SECURITY-CONVERSION.md): service boundaries and security ownership.
- [Functional verification](docs/test-results/SECURITY-WORKSPACE-2026-09-06.md) and [prepublication review](docs/security-testing-results/PREPUBLICATION-2026-09-06.md): tested workflows, dependency/credential checks and remaining gaps.
- [Roadmap and uplift plan](docs/plans/GUARDIAN-SECURITY-UPLIFT-PLAN-2026-09-06.md): planned work, separate from shipped capabilities.

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

## Alpha boundaries and migration

`npm run package:security` builds a production-only local distribution and tarball. See [packaging](docs/guides/SECURITY-PACKAGING.md) for Windows/macOS launchers and Node prerequisites. Native signed installers remain a release gate. Root `npm pack` is blocked so it cannot accidentally ship the retained legacy runtime.

Guardian coordinates security observations and supported actions. Passive neighbor data is not a complete LAN census, and the app is not a kernel EDR, packet-inspection engine or universal interceptor of actions taken outside its interfaces. A requested antivirus scan does not establish completion or a clean result; third-party antivirus inventory does not imply control over those products.

Microsoft/Azure resource discovery and project deletion are not implemented. Optional Entra and authenticated AWS integrations need acceptance testing in the customer's environment. Signed service deployment, remote fleets, proprietary EDR response connectors and managed SIEM delivery remain future release work. The current listener is local-only; this release is not a public-facing hosted service.

Existing application profiles are not silently rewritten. The new service uses `~/.guardianagent/security-v2`; import ContextCypher exports through Systems. The former general assistant has no supported launch, package, container, or deployment path. Its remaining source is retained temporarily only for migration history and test-backed extraction of security modules; it is not part of the Guardian 2 build.

## License and attribution

[Apache-2.0](LICENSE) applies to application code. Third-party datasets and vendor artwork retain their own terms; see the [ContextCypher and artwork notice](web/contextcypher/NOTICE.md), [dataset notice](web/contextcypher/src/data/security-knowledge-base/README.md) and [migration attribution](docs/architecture/CONTEXT-MIGRATION.md). Local credentials, provider configuration and generated user state are excluded from the repository. Report vulnerabilities using the [security policy](SECURITY.md).
