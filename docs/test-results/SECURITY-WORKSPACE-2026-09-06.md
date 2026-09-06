# Local workspace verification — 6 September 2026

Tested the Windows local security preview at `http://127.0.0.1:3007` with isolated Edge sessions. Vivaldi automation failed to launch reliably; the user authorized Edge automation and separately confirmed the native file picker works. No public deployment or GitHub push was performed.

## Completed checks

| Surface | Evidence |
| --- | --- |
| Repository tests | 4,263 tests passed across 353 files; includes retained legacy tests, not 4,263 new-product acceptance scenarios. |
| Build and types | Backend and restored frontend typechecks passed; production frontend compiled. |
| Production installation | Clean production-only dependency install, SQLite initialization, service startup, administrator session, project mutation and packaged UI passed. |
| Packaging | Windows launcher and package tests passed, including paths containing spaces and retained ContextCypher/dataset notices. |
| Dependencies | Production npm audit returned zero reported vulnerabilities after pinning and installing ws 8.21.0. This is dependency-database coverage, not a security certification. |
| Guardian navigation | All seven pages loaded; desktop and mobile overflow checks passed. Sidebar collapse/expand retained accessible links, increased canvas width and survived reload. |
| Diagram workflow | Created a blank system, inserted a typed Workstation through the palette, saved, reloaded and exported its data. Imported and round-tripped a complete built-in example with graph, zones and GRC data. |
| Diagram exports | Actual UI actions produced JSON, PNG, JPEG, SVG, HTML report, threat-model JSON, draw.io and TypeScript files. Automated tests substituted the OS picker to check user activation, payload and cancellation. User confirmed the real picker manually. |
| Autosave | Actual backend revision persisted an edited graph; unchanged intervals made no writes. A separate real write caused HTTP 409, paused autosave and retained the local draft without repeat writes. Only the browser clock was accelerated. |
| GRC | All 15 sections rendered without JavaScript errors. Real CSV/XLSX file inputs, OWASP catalogue loading, risk edits, assessment/risk linking, SoA implementation and evidence worked. Save/reload preserved tested changes. |
| GRC exports | TXT, HTML, PDF and CSV produced valid files; sandboxed report preview rendered. |
| Security service | Thirteen live API/CLI/MCP flows passed: project provenance, revision conflicts, scope denials, finding lifecycle/links, protected linked-node deletion, immediate client revocation and approval rejection. Scan proposals were rejected; no scan was executed by the harness. |
| Standalone AI | Real OpenAI analysis returned six threats for two selected nodes. Real diagram generation preserved all embedded node/edge data for a five-node, two-edge example. Credentials remained in backend memory. |

Runnable harnesses include `scripts/test-security-ui.mjs`, `scripts/test-security-autosave-ui.mjs`, `scripts/test-security-production.mjs`, `scripts/test-security-package.mjs`, `scripts/test-context-editor-file-actions.mjs` and `scripts/test-context-project-autosave.mjs`. Local screenshots and detailed outputs are under ignored `tmp/`.

## Limits and remaining release work

- This pass covers the workflows above; it does not exhaust every action in every restored ContextCypher panel.
- Real macOS, authenticated AWS collection and live Entra SSO acceptance still need their respective environments. The CI platform matrix has been configured but was not run on GitHub during this pass.
- Project deletion is not currently exposed through the security operations API. Test systems remain visibly named as QA fixtures; no direct database deletion was used.
- Microsoft/Azure inventory, advanced threat-intelligence/provider-management paths, signed installers and enterprise fleet operation must not be represented as verified by this pass.
- Before public distribution, review redistribution terms for preserved reference datasets and vendor icons. Packaging now retains notices; including notices alone does not establish redistribution permission.
- The user's live backend was not restarted, preserving its in-memory OpenAI key. Frontend changes activate on browser reload. The previously compiled OpenAI sampling-compatibility retry activates after the next backend restart; the live temperature-1 configuration already works.

## Final interaction corrections

The canvas now takes keyboard focus when clicked. Actual Edge checks verified one native-picker invocation for Ctrl+Shift+S, quiet cancellation, exactly one backend revision write for Ctrl+S, and unchanged input text-selection behaviour. The picker was substituted in automation; keyboard events and backend saves were real.

Zone colours now distinguish automatic inheritance from an explicit edge override. A loaded legacy zone matching the source is interpreted as automatic; legacy files cannot distinguish a copied value from an intentional identical override. Operators can choose an explicit zone to lock it. Focused tests cover legacy migration, unknown-field preservation, source/container changes, explicit overrides and palette changes. Fourteen focused edge/preservation/file tests and the final frontend typecheck passed after these corrections.

Final GRC browser checks passed: accessible section names/selected state, assessment dropdown pointer selection with its tooltip visible, report iframe rendering, and all five checkbox rows with their input hit areas aligned to the visible labels. Shell label and checkbox defaults are scoped away from the embedded MUI controls.

Actual Edge colour checks passed on the final build: a loaded automatic edge was blue and its explicit override peer cyan; selecting External changed the first edge to orange, returning to Automatic restored blue, and changing the containing zone from Internal to External immediately changed the automatic edge to orange while leaving the cyan override intact. The Security Zone selector was accessible by its label, and no page errors occurred. Local evidence: `tmp/edge-zone-browser-qa/result.json` and `zone-change.png`.

A clipped toolbar in the first automated edge screenshot was traced to Playwright scrolling a hidden ancestor to reach a zone button covered by the floating DFD palette. A real coordinate-pointer replay with that palette hidden kept every ancestor horizontal scroll offset at zero, maintained canvas bounds and reproduced the correct live edge colours. No production workaround was added for this automation artifact. Evidence: `tmp/layout-scroll-qa/measurements.json` and `zone-change.png`.
