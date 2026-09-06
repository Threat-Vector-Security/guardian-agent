# Guardian Agent

**Understand your environment. Connect the risks. Stay in control.**

Guardian Agent is an open-source security workspace for local workstations, networks and system architecture. It brings Guardian's security operations and ContextCypher's visual threat modelling together in one application—connecting security observations, editable diagrams, AI analysis and governance, risk and compliance (GRC).

Use it directly in your browser, with its own AI analysis, or connect **Codex, Claude Code and other compatible AI assistants** through scoped interfaces. Guardian runs locally on Windows, macOS and Linux.

## Security with context

Security findings are more useful when you can see what they affect. Guardian helps you move from an observation on a workstation or network to the system diagram, assets, risks and controls needed to understand it and decide what to do next.

Its purpose is to help people protect their workstations and local networks, investigate suspicious or automated activity, and avoid risky decisions. Supported security actions use explicit permissions, approvals and recorded decisions so the operator stays in control.

Guardian is built for individuals, security practitioners and teams who want local security visibility alongside practical threat modelling. It works with existing security tools and provides optional identity and cloud integrations for organisations developing their security workflows.

## What you can do

| Capability | How it helps |
| --- | --- |
| **Check your workstation** | Review host posture, Microsoft Defender status and registered antivirus products. Propose and approve supported Defender scans. |
| **Understand your environment** | Review passive local network observations or enrolled AWS EC2/security-group inventory, preview a snapshot, and turn it into an editable system diagram. |
| **Model your systems** | Build diagrams with a drag-and-drop node toolbox, security zones, detailed node and connection data, automatic zone colours and layout tools. Start from a built-in example or import a ContextCypher file. |
| **Analyse threats with AI** | Ask security questions, analyse selected architecture and generate proposed diagrams using your chosen provider. Review the results and decide what to apply. |
| **Connect diagrams to GRC** | Sync diagram nodes and connections into the asset register, link risks to diagram elements, and manage controls, assessments, evidence and statements of applicability. |
| **Review and report** | Investigate findings, record review decisions, inspect activity, and export diagrams, portable project files and GRC reports. |
| **Work with AI assistants** | Give compatible assistants scoped access to inspect findings and read or update projects—including embedded node, edge and GRC data. |

## Two ways to work

### Use Guardian on its own

The browser workspace brings together **Protection, Environments, Findings, Systems, Activity, Integrations and Settings**. Core monitoring, manual diagrams and GRC work require no AI account.

For built-in AI analysis and diagram generation, configure a provider and an available model in the editor's settings. Options include OpenAI, Anthropic, Gemini, xAI and Ollama. Selected context is sent to that provider when you request analysis; local Ollama is available when the model and context need to stay on your workstation. Provider keys remain in backend memory and are re-entered after a backend restart.

### Connect your preferred assistant

Guardian exposes **MCP, CLI and HTTP interfaces** so Codex, Claude Code and other compatible clients can work with the same security workspace. For example, an assistant can read a system, propose architecture changes, and save a diagram with meaningful data attached to its nodes and connections.

Enroll a separate assistant credential in **Settings**, choose its permissions and project access, and configure the client using the [assistant setup guide](docs/guides/SECURITY-WORKSPACE.md#drive-it-through-mcp-or-the-cli). Credentials can expire or be revoked, and supported response actions still follow Guardian's approval process. Each client needs its own setup and connection check.

## Get started

Requires **Node.js 24.14 or later**. Clone the repository or download its source, then run from the project directory:

```sh
npm ci
npm run build
npm run init
npm start
```

Open **http://127.0.0.1:3000**. Guardian runs on your machine and binds to its loopback address. See the [installation and packaging guide](docs/guides/SECURITY-PACKAGING.md) for platform launchers and distribution details.

Try this first:

1. Open **Protection** and run a check to review your workstation's available security observations.
2. Open **Systems**, create a system and choose a built-in example from **Examples** to explore the editor. You can also import an existing ContextCypher JSON file.
3. Switch to **GRC** to explore the example's assets, risks, controls and assessments. Use **Sync from Diagram** when you want to bring diagram elements into the asset register.
4. Use **Save system** to retain the workspace, or **File → Save As** for a portable copy.
5. To model your own environment, use **Environments → Collect now → Preview latest snapshot → Create editable system**.

Local browser access opens without an access code by default. Optional browser sign-in, assistant credentials and Microsoft Entra ID configuration are covered in the [operator guide](docs/guides/SECURITY-WORKSPACE.md).

## Integrations and reference material

- **Microsoft Defender and antivirus inventory:** inspect available local protection and use supported, approved scan requests.
- **AWS:** work with authenticated EC2/security-group inventory and explicitly collect Security Hub or GuardDuty findings.
- **Microsoft Entra ID:** optional SSO with configured group-to-role mappings.
- **Security event intake:** scoped HTTP ingestion for connectors that provide normalised findings.
- **GRC reference material:** seven bundled reference datasets covering NIST SP 800-53, OWASP Top 10, MITRE ATT&CK Enterprise/ICS/Mobile, Australian ISM and Essential Eight, plus local CSV/XLSX control imports.

Integration coverage varies by platform and provider. See the [operator guide](docs/guides/SECURITY-WORKSPACE.md#release-limits) for current coverage and deployment considerations, and the [roadmap](docs/plans/GUARDIAN-SECURITY-UPLIFT-PLAN-2026-09-06.md) for planned capabilities.

## Documentation and development

- [Operator and integration guide](docs/guides/SECURITY-WORKSPACE.md): everyday workflows, AI, assistant setup, AWS, Entra and migration.
- [Installation and packaging](docs/guides/SECURITY-PACKAGING.md): local distributions, launchers and platform requirements.
- [Architecture](docs/architecture/SECURITY-CONVERSION.md): service boundaries and security design.
- [Testing guide](docs/guides/INTEGRATION-TEST-HARNESS.md): test commands and integration harnesses.
- [Functional verification](docs/test-results/SECURITY-WORKSPACE-2026-09-06.md) and [prepublication review](docs/security-testing-results/PREPUBLICATION-2026-09-06.md): recorded checks and their scope.
- [Changelog](CHANGELOG.md): changes between versions.

For development, start with `npm run check`, `npm test` and `npm run build`. Run `npm audit` to check the complete dependency graph.

## License and attribution

Application code is licensed under [Apache-2.0](LICENSE). Third-party datasets and vendor artwork retain their own terms; see the [ContextCypher notice](web/contextcypher/NOTICE.md), [dataset notice](web/contextcypher/src/data/security-knowledge-base/README.md) and [migration attribution](docs/architecture/CONTEXT-MIGRATION.md). IEC 62443 and CSA CCM texts are not bundled; appropriately licensed local imports remain supported.

Report vulnerabilities using the [security policy](SECURITY.md).
