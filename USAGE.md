# Use Guardian Agent

Guardian is a local security and architecture workspace. Use it directly in a browser, configure its built-in security AI, or connect an external assistant with scoped credentials. Core monitoring, manual diagrams and GRC work without an AI provider.

[Install and start Guardian](INSTALLATION.md), then open the exact loopback address printed by the service.

## Workspace pages

| Page | Use it to |
| --- | --- |
| Protection | Check workstation posture, native antivirus status and available passive network observations. Review coverage and request supported scans. |
| Environments | Collect local or enrolled AWS observations, preview the recorded inventory, and create an editable system diagram. |
| Findings | Review evidence, record decisions and link findings to architecture assets. |
| Systems | Open examples or import a workspace; edit diagrams, node/connection details, threats, controls and GRC data. |
| Activity | Inspect jobs and review pending supported scan proposals. |
| Integrations | Inspect integration capabilities and explicitly collect supported AWS observations. |
| Settings | Manage browser access and enroll, scope, expire or revoke assistant credentials. |

A finding marked resolved records an operator decision; it does not prove remediation. A requested antivirus scan is not a completed or clean scan. Guardian's observations do not constitute a full LAN census, kernel EDR or universal control of other assistants.

## First diagram and GRC workflow

1. Open **Systems**, create a system, then use **Examples** to explore a complete model. Loading an example creates another saved system.
2. Add nodes from the toolbox and connect them on the canvas. Edit their properties and security context.
3. Select relevant diagram nodes before switching to **GRC**.
4. In **Assets**, choose **Sync from Diagram**; use **Sync Connections from Diagram** for connection assets.
5. Create a risk linked to the selected nodes, import a control set, update its Statement of Applicability, and create an assessment.
6. Use **Reporting** or an assessment's export actions for reports.

The [GRC workflow guide](docs/guides/GRC-WORKFLOWS.md) covers all fifteen sections, relationships and current limits.

## Save and export

**Save system** writes a Guardian project revision. **File → Save As**, **Export draft**, and report/image exports create portable files. Supported browsers ask for a destination; cancelling leaves the file unsaved. Other browsers offer an explicit download choice controlled by browser settings.

Enable **Autosave** in the Systems editor's **Settings → General**. Failed or conflicting saves keep the draft available and pause autosave. Export a conflicted draft before opening the latest project revision and reconciling changes.

## Built-in security AI

Configure a provider and model in the Systems editor settings. Ask security questions in its analysis panel or request diagram/assessment analysis. Review generated proposals before applying changes. Provider credentials remain in backend memory for the current service session and must be re-entered after restart.

Using a remote provider sends the selected context to that provider. Use local Ollama when the content must stay on the workstation. Built-in AI does not receive shell or remediation authority.

## External assistants and integrations

Enroll a separate assistant in **Settings** with only the scopes and projects it needs. Connect its MCP client or use Guardian's CLI/HTTP operations. Never configure an assistant with the bootstrap administrator credential.

See the [operator and integration guide](docs/guides/SECURITY-WORKSPACE.md) for setup, AWS account/region enrollment, optional Entra SSO, permissions and deployment boundaries. See [known issues](docs/KNOWN-ISSUES.md) before treating a workflow as operationally accepted.
