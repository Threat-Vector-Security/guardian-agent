# Guardian 2 alpha.3 project navigation verification

## Reported failure and fix

An older loaded frontend navigated from Environments to `#systems?project=Not%20reported`: a display fallback had been used instead of the imported project ID. The current alpha.2 source already unwraps the import response correctly. Repeating the reported collection-to-editor flow against the running backend confirmed that the project was persisted and opened correctly from a fresh page.

The investigation also found that selecting, creating or importing a system did not update its URL, same-page project links were not handled, and Reload page only remounted the current page. Alpha.3 synchronizes accepted project IDs with the URL, handles same-page navigation, rejects superseded responses, preserves drafts and the full URL on cancelled navigation, and performs a real browser reload. The top bar reports the frontend build version.

## Actual browser checks

Both harnesses use isolated Microsoft Edge sessions against the running local Guardian backend. No fabricated project or collection responses are used.

- `node scripts/test-security-environment-ui.mjs`: passive local collection, snapshot preview, create editable system, valid project URL, editor node/edge rendering, save and browser reload. The local run opened nine nodes and eight edges without JavaScript errors.
- `node scripts/test-security-project-routing-ui.mjs`: create, import, select, reload, same-page project links, browser Back, dirty cancellation within and across pages, real missing-project errors, recovery from the exact reported malformed URL, and protection from a delayed real project response. Native browser reload prompts once for an unsaved draft; the existing Reload page button reloads the document.

Raw screenshots, local inventory and project identifiers remain in ignored `tmp/` artifacts. These checks do not certify every editor feature or every platform; macOS and Linux CI cover build/runtime behavior, while these browser checks ran on Windows with Edge. No provider key or hosted AI request is needed for either harness.

## Local deployment

The frontend was rebuilt and deployed to the existing local preview server. No Guardian backend restart was needed for these frontend changes; the running provider credentials remain in memory. Existing browser tabs must refresh once to load alpha.3, then select the saved system if their old URL is malformed.

## Release checks

- Full Vitest suite: 4,270 tests across 355 files passed.
- Frontend production build and frontend/backend TypeScript checks passed.
- Dependency contract validation passed; the complete dependency audit reported zero vulnerabilities.
- GitHub-rendered README release table and local documentation links checked.
- A fresh Edge page displayed `Local security · v2.0.0-alpha.3` from the deployed frontend.
