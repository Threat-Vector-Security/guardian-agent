# Guardian Agent WebUI design

**Scope:** Current security application and standalone ContextCypher workbench, inspected 6 September 2026. This is the current interaction contract. Explicitly identified gaps remain application work; this documentation revision does not fix them.

## Product and navigation

The default browser shell is `web/security/`: a graphite workspace with a collapsible left sidebar, central working area and contextual inspectors. Systems embeds the restored ContextCypher workbench in `web/contextcypher/`. Users can work directly in Guardian; external assistant applications are optional.

The canonical navigation order is:

| Page | Owns |
|---|---|
| Protection | Workstation/native observation status, coverage and collection controls; supported scan proposals. |
| Environments | Local/AWS collection status, recorded inventory-map previews, evidence and creation of editable Systems snapshots. |
| Findings | Observation review, decisions and explicit system/asset links. Resolving a finding is not proof of remediation. |
| Systems | Saved projects, mature diagram editor, examples, security analysis/generation, GRC and document import/export. |
| Activity | Durable jobs, native-action approval decisions and administrative audit history. |
| Integrations | Adapter capability, enrollment scope and supported/unsupported coverage. |
| Settings | Browser sign-in preference and machine-client enrollment, scope and revocation. |

A summary can link to another page, but must not create a competing control plane. Explain the purpose and scope of each major surface. Imported text is content, not trusted HTML, styling, policy or execution instructions.

## Shell and responsive layout

Systems fills the available workspace without an outer padded frame. The sidebar collapses to an accessible icon rail and remembers that browser preference. The shell displays the loaded application version. Route content owns its dimensions; global element defaults remain in a low-priority CSS layer so embedded component layouts stay authoritative.

The workbench toolbar uses the compact Menu when space is constrained. Component and analysis panels resize within available bounds, keep their close controls reachable and do not force the entire page wider than the viewport. Tabs scroll within their own panel; guide text wraps. Dense canvases can pan and zoom internally without producing document-level overflow.

Desktop and narrow layouts need actual interaction checks. A successful build or screenshot alone is not proof that node insertion, dialogs, menus or panel controls remain usable. Provide visible focus, accessible names, semantic status/error feedback, keyboard navigation and sensible focus restoration when dialogs close.

## Project ownership and navigation

`GuardianWorkbench.tsx` binds the selected project to a backend revision and canonical URL. Successful create/import/select actions update the selected-project URL. Same-page project navigation must load the requested project, respect unsaved drafts and prevent an older asynchronous load from replacing a newer selection. Cancelled navigation restores the previous complete URL.

The editor maintains a local unsaved draft. A revision-checked save commits through the shared project operation; it is not a second authoritative browser workspace. Preserve drafts on errors and conflicts. When enabled, autosave uses the same revision/save boundary, saves actual edits, shows its status and pauses after failures rather than repeatedly overwriting or discarding work.

**Reload page** performs a browser reload with native unsaved-draft protection so deployed frontend changes become active. Opening a created environment map must use the actual project ID returned inside the import result, not a display label or inferred identifier. Invalid/missing projects need a recoverable error with access to saved-system selection.

## Diagram and GRC workbench

Preserve ContextCypher's built-in examples, typed nodes and vendor icons, security zones, palette drag/drop and click-based insertion, node/edge editing, diagram views, drawing/annotation capabilities, analysis context and export workflows. Examples are deliberate product content, not a substitute for real discovery evidence.

GRC is an operable workspace: assets, risks, assessments, scoring/configuration, control sets, Statements of Applicability and reports use the project's preserved domain data. The restored frontend performs its domain editing on a draft; backend project validation, authorization and revision checks remain authoritative for persistence. Keep unknown document fields and cross-workspace references intact rather than flattening them to a few display fields.

Bundled framework snapshots retain source/version attribution and are not claimed to be the latest standards. CSA CCM and IEC 62443 datasets are excluded from the distributed catalogue/build; users may import their own permitted control sets without losing existing workspace references.

**Known read-only gap:** credentials without project-write permission currently receive the reduced `web/security/systems.tsx` renderer. Equivalent mature diagram rendering in read-only mode is not complete. The required outcome is full visual fidelity with mutation controls disabled; the current reduced rendering is not the intended replacement for ContextCypher.

## Standalone security AI

Systems exposes built-in security chat, analysis, diagram generation and assessment through Guardian's backend AI operations. Provider/model configuration belongs to the administrative provider settings surface inside the workbench. Model discovery reflects live provider results and errors; do not silently replace unavailable models with fabricated options.

Provider API keys remain in backend process memory and must be entered again after restart. Non-secret provider/model preferences may persist. **Save Settings and Close** must save pending provider changes before closing and retain the form on failure.

AI output is untrusted. The user reviews a generated diagram/proposal before applying it through the existing project boundary. The current AI operation does not execute arbitrary tools or automatically commit a changed project. Show accurate provider, cancellation, limit and failure states; do not report analysis success on an error or user cancellation.

## Environment discovery and evidence

Local preview uses passive OS neighbor-cache observations. Its edges describe recorded associations, not inferred cables, gateways, roles or verified traffic. AWS preview uses the explicitly enrolled account/region and collected EC2/security-group records. Display collection time, source scope, partial coverage and failures before creating a system.

**Collect now** starts the existing authorized job. **Preview latest snapshot** reads recorded results without implicitly starting collection. **Create editable system** creates a new project and opens it. Existing authored systems are preserved; automatic discovery reconciliation is not currently implemented.

Microsoft Entra sign-in authenticates Guardian users. It does not authorize Azure or Microsoft 365 inventory. Unconnected discovery adapters must state their prerequisites and actual availability. Do not render sample cloud/identity topology as discovered data.

## File dialogs, imports and exports

Explicit save/export actions use the shared Save As boundary. Reserve the destination from the initiating user action before asynchronous PDF generation or AI work. Cancellation must not start content generation, trigger a fallback download or show success. Show success only after writing completes, and expose write failures.

Browsers without a native Save As API may use an explicitly confirmed download fallback. Never silently convert a cancelled or failed native picker into a download. Keep filenames/formats appropriate to the selected export and preserve the original workflow's supported content.

**Known raw-import gap:** the workbench currently parses uploaded JSON and reserializes it before calling the backend. Original upload whitespace/BOM fidelity is therefore not preserved through that UI path, although the raw-content backend import preserves exact bytes. Carrying original file text through this seam and proving it with user-path tests remains unfinished. Do not advertise browser byte-perfect archival fidelity until corrected.

## Authentication and permitted actions

Local browser access opens without an access code by default. Settings offers **Require an access token to open Guardian**; configured Entra SSO requires sign-in. The browser still uses an HttpOnly session. Machine interfaces require separately issued scoped credentials.

Show controls according to the user's grants, while retaining backend checks as the authority. Hide administrative actions from assistant sessions. Native response approval is a separate administrative decision; requesting a scan is not equivalent to executing or completing it. Unknown, degraded and unsupported telemetry must remain distinct from healthy protection.

## Verification and ownership references

Verify navigation, saved-project recovery, examples, palette insertion, edits, save/reload, GRC changes, imports/exports, cancellation, role restrictions and representative large diagrams in the actual browser. Include desktop and narrow-view overflow checks. Cross-platform builds do not replace native Mac or real cloud/tenant acceptance.

See [architecture overview](../architecture/OVERVIEW.md), [security application contract](../architecture/SECURITY-CONVERSION.md), [ContextCypher migration](../architecture/CONTEXT-MIGRATION.md), [operator guide](../guides/SECURITY-WORKSPACE.md) and [current scope and acceptance gaps](../architecture/OVERVIEW.md#current-scope-and-acceptance-gaps). Document unresolved behavior as an acceptance gap; do not remove product scope to make the current implementation appear complete.
