# Changelog

## [2.0.0-alpha.4](https://github.com/Threat-Vector-Security/guardian-agent/releases/tag/v2.0.0-alpha.4) — 6 September 2026

- Rewrote installation, usage, security policy, contributor instructions, architecture and API guidance for the current Guardian security application.
- Added a documentation home, full diagram/GRC walkthrough, current roadmap and known-issues page.
- Documented both assistant-to-Guardian MCP and direct HTTP/CLI workflows with scoped credentials.
- Moved previous application designs, guides, plans, research and test history into a separate archive, preserving links and source history.
- Kept the main README focused on current capabilities and everyday use, with fuller coverage of GRC.

This is a documentation update. The [known GRC identity, browser import and read-only viewer issues](docs/KNOWN-ISSUES.md) remain open. Published as the latest GitHub release; the existing version naming is retained.

## [2.0.0-alpha.3](https://github.com/Threat-Vector-Security/guardian-agent/releases/tag/v2.0.0-alpha.3) — 6 September 2026

- Keep the Systems URL in sync when creating, importing or selecting a project, so refreshing opens the selected system.
- Handle project links within the open Systems page, preserve drafts and the full project URL when navigation is cancelled, and ignore superseded project responses.
- Make Reload page fetch the current application and display the actual frontend build version.
- Add real Edge/backend regression checks for environment collection through editable-system creation, save and reload, plus project navigation, failed links and unsaved-draft protection.
- Refresh the README, release links, operator guide and repository About information.

If an older browser tab opens `#systems?project=Not%20reported`, refresh the browser and choose the created system from the saved-system list. The malformed link does not identify a project; the saved system is retained. See the [patch verification](docs/test-results/SECURITY-WORKSPACE-ALPHA3-2026-09-06.md).

## [2.0.0-alpha.2](https://github.com/Threat-Vector-Security/guardian-agent/releases/tag/v2.0.0-alpha.2) — 6 September 2026

First published source prerelease of the local security workspace.

- Combined Guardian security operations with the ContextCypher diagram editor, examples, standalone security AI and GRC workflows.
- Added local environment/AWS inventory-to-diagram workflows, scoped MCP/CLI/HTTP interfaces and optional Microsoft Entra ID sign-in.
- Restored the node toolbox, embedded node/edge data, portable exports and reports; added automatic edge-zone colours, collapsible navigation and revision-checked autosave with conflict protection.
- Excluded bundled IEC 62443 and CSA CCM texts while preserving local CSV/XLSX imports and existing workspace records.
- Patched browser, build and retained provider dependencies; both complete and production-only dependency audits reported zero advisories at release.
- Verified 4,270 tests plus Windows, macOS and Linux CI build/runtime checks. See the [verification report](docs/security-testing-results/PREPUBLICATION-2026-09-06.md) for scope and limitations.

The `2.0.0-alpha.1` tag was an unpublished preflight snapshot. No signed native installers are included in this alpha.

## [1.0.0](https://github.com/Threat-Vector-Security/guardian-agent/releases/tag/v1.0.0) — original application archive

Published on 6 September 2026 to preserve the general-purpose Guardian Agent immediately before the security conversion, at commit `5ac3a501fb878ea154836680fd398c195230e9ec`.

Download this release for the original assistant and orchestration codebase. Use its own README and dependency requirements. It is a historical source archive, not a newly certified security release.
