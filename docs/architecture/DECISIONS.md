# Architecture Decision Records

## ADR-031: Local security application with a standalone ContextCypher workbench

**Status:** Accepted for the current security product; documented 6 September 2026. Implementation coverage and open gaps are recorded in the [architecture overview](OVERVIEW.md#current-scope-and-acceptance-gaps).

**Context:** Guardian combines local workstation/network security with ContextCypher modelling, AI analysis and GRC. External assistant control is optional; removing standalone functionality is not an acceptable simplification.

**Decision:** Use `src/security-main.ts` and the shared `src/security-workspace/` operation/service boundary. Browser, CLI and MCP clients use explicit schemas, current credentials, roles, audiences and scopes. The restored browser editor manages drafts; revision-checked backend project operations own persistence. AI requests propose analysis or diagrams without arbitrary tool execution or automatic project mutation. Native response actions retain their explicit administrative approval path.

SQLite owns durable projects, observations, findings, jobs, grants, preferences and audit. Live browser sessions and configured provider API keys remain in process memory. Local browser access can bootstrap a session by default; token sign-in is opt-in and configured Entra requires sign-in. This local convenience mode does not replace machine credentials or claim to withstand a hostile process running as the user.

**Consequences:**

- The standalone user can use security workflows without Codex or another external assistant; external clients reuse the same service contract.
- Each product capability requires implementation and acceptance evidence before being advertised. Autonomous triage and event-triggered response automation remain outside the currently registered operation set.
- Current LAN/AWS maps are bounded observation snapshots. Entra SSO does not grant cloud/Graph inventory authority.
- Packaging includes backend and frontend closures. All-dependency auditing is required because browser runtime libraries may be classified as development dependencies.
- Original raw-content imports preserve bytes at the backend, but the current browser upload seam still serializes JSON before import. The reduced read-only renderer also remains unfinished. This ADR records those gaps without claiming to fix them.
- No public hosted service or signed/managed enterprise fleet is implied by this conversion. Customer environment and native-platform acceptance remain separate gates.
