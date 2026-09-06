# Diagram and GRC workflows

Open a system in **Systems**, then switch between **Diagram** and **GRC** using the workbench toolbar. They share the same project. Use **Save system** to persist changes, or a portable export to create a file.

Core GRC work does not require an AI provider. AI assistance is optional and uses the provider configured for the security workspace.

## GRC sections

| Section | Purpose |
| --- | --- |
| Dashboard | Review asset, risk, assessment, control, task and incident metrics. |
| Assets | Register and classify assets; sync diagram nodes and connections; return to linked diagram elements. |
| Findings | Review/create findings and bring manual rule-analysis findings into the register. |
| Risks | Classify, score and assign risks; record treatment and links to assets, findings and diagram nodes. |
| Compliance | Load a bundled framework or import CSV/XLSX controls; manage Statements of Applicability, evidence and framework mappings. |
| Controls | Record implemented security mechanisms and link them to risks, assets and compliance controls. |
| Assessments | Define scoped reviews, link risks/gaps/tasks and write assessment findings, evidence and reports. |
| Risk Management | Maintain assessment risk-management plans and their treatment actions. |
| Governance | Register policies and other governance documents, owners and review dates. |
| Threat Profiles | Record threat actors and scenarios with targets, techniques and related risks. |
| Third Parties | Track external suppliers, their relationships and risk information. |
| Initiatives | Organize security improvement work and related records. |
| Incidents | Record incidents and remediation information. |
| Reporting | Inspect charts, customize report sections and export HTML or register CSV files. |
| Workflow & Config | Configure risk scales, appetite, defaults and workflow settings; inspect gaps and suggested work. |

## Diagram → assets → risk

1. Create a diagram or open an example. Use the node toolbox, security zones and connections to describe the system.
2. Select the nodes relevant to a risk before switching to GRC.
3. Open **Assets → Sync from Diagram**. Nodes become asset records with diagram references. Run **Sync Connections from Diagram** for connection assets.
4. Open **Risks**, enter a title, choose the appropriate tier and select **Add Risk**. The new risk receives links to the selected diagram nodes.
5. Expand the risk's tier group and row to edit its details. **Diagram Links** chips return to the corresponding diagram nodes. Asset records also provide a view-in-diagram action.

Synchronization adds and deduplicates records for the current diagram reference. It does not automatically rename existing GRC assets or delete them when diagram elements disappear.

**Known identity limitation:** renaming a system, saving/reopening it and syncing again can create duplicate assets or connections because references currently depend on the loaded name. Avoid renaming between syncs until that issue is fixed. See [known issues](../KNOWN-ISSUES.md).

## Controls and evidence

In **Compliance**, use **Add Built-in Framework**, **Import Control Set (CSV/XLSX)** or **New Blank Control Set**. Seven reference datasets are bundled: NIST SP 800-53, OWASP Top 10, MITRE ATT&CK Enterprise/ICS/Mobile, Australian ISM and Essential Eight. These are versioned snapshots, not an assertion that each is the latest release.

IEC 62443 and CSA CCM datasets are not bundled. Users can import their own permitted CSV/XLSX control sets; existing imported workspace records remain available.

Each loaded control set creates scoped Statement of Applicability entries. Set applicability and implementation status, expand a control for justification, risk links and evidence, and use **Add Link** or **Add File Ref** as appropriate. File references do not upload or embed the referenced file's contents.

Use **Controls** for actual implemented mechanisms and their relationships. Marking a control implemented records an assessment decision; it does not independently verify the technical control.

## Assess and report

1. In **Assessments**, enter a title/summary, define scope, optionally filter taxonomy tiers and link risks.
2. Create the assessment, then edit ownership, findings, recommendations and evidence.
3. Link compliance gaps, workflow tasks, implemented controls and initiatives as needed.
4. Maintain its treatment actions in **Risk Management**.
5. Export assessment text, HTML or PDF. Use **Reporting** for the report catalogue and CSV register exports.

Report previews are isolated from the main application. Exports use the shared destination picker where supported; cancelling leaves no saved file. Review the exported content and layout before sharing it.

## Persistence and access

**Save system** records the combined diagram/GRC document as a revision. Reopen it and inspect important relationships after migration. Autosave is configured in the Systems editor's settings; conflicts keep the draft available for export and reconciliation.

A current JSON document export preserves structured data, not the original file's byte formatting. Browser import paths parse and reserialize JSON, so whitespace and byte-order-mark details are not guaranteed to survive. Keep source files separately when byte-exact retention matters.

The full workbench currently requires project-write permission. A project viewer receives a simplified Systems view; complete read-only editor/GRC parity is still a known limitation. See [known issues](../KNOWN-ISSUES.md) and the [operator guide](SECURITY-WORKSPACE.md) for current boundaries.
