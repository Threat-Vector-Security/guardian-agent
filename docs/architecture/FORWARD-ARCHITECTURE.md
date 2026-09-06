# Guardian Agent forward architecture

**Current contract — 6 September 2026:** Use [OVERVIEW.md](OVERVIEW.md) for the current service diagram and [SECURITY-CONVERSION.md](SECURITY-CONVERSION.md) for the conversion decisions. This document governs new security-product work.

## Current security-product ownership

| Layer | Owner and rule |
|---|---|
| Composition | `src/security-main.ts` constructs the local service and transports. Keep business decisions out of startup. |
| Transport | `src/security-workspace/server.ts`, `client.ts`, `mcp.ts` translate HTTP/CLI/MCP requests. Authentication and audience assignment remain transport-owned; domain authorization remains service-owned. |
| Application contract | `operations.ts` declares schemas/scopes; `service.ts` checks the current principal, project/environment authority and operation lifecycle. Extend this common contract rather than add browser-only write paths. Split by an actual domain boundary when necessary, not by transport. |
| Persistence/domain | `store.ts` owns transactions, quotas, durable records and audit. `contextcypher.ts` owns JSON/graph validation and preservation. Live browser sessions and provider keys remain process-local, not SQLite records. |
| AI | `ai.ts` owns configured provider access and bounded security requests. UI analysis/generation and external assistants use the same authorized operations. Proposals do not automatically write projects or execute arbitrary tools. |
| Discovery/defense | Narrow native/cloud adapters collect explicit scope; `environment-mapping.ts` converts recorded evidence to previews. New collectors must declare visibility, permission requirements, truncation and unsupported coverage. |
| Presentation | `web/security/` owns the shell and operational pages; `web/contextcypher/` owns restored diagrams, security AI and GRC drafts. `GuardianWorkbench.tsx` binds drafts to backend project revisions. No competing authoritative browser database. |

The seven navigation owners and interaction contract are in [WEBUI-DESIGN.md](../design/WEBUI-DESIGN.md). Forms and explicit buttons invoke named operations directly. Natural-language routing is a separate capability from explicit form submission. When adding intent-routing workflows, use the shared gateway/orchestration contract; do not substitute keyword routing or build a separate per-channel approval/resume system.

## Uplift rules

Preserve ContextCypher user outcomes and document semantics while improving the implementation. A raw JSON viewer, external assistant or future promise is not a replacement for a working editor/GRC/analysis workflow. Track parity and verification in [current scope and acceptance gaps](OVERVIEW.md#current-scope-and-acceptance-gaps). The reduced read-only renderer and raw-upload byte-preservation seam remain acceptance gaps, not deliberate capability retirements.

Discovery should evolve toward explicitly scoped inventory, source-linked relationships and revision-checked reconciliation that preserves manual work. Do not fabricate topology, infer complete coverage from empty results, or acquire tenant authority from Guardian SSO. Restore autonomous defensive workflows through the existing job/approval boundary when their migration is authorized and verified.

Before integrating a capability, review its security findings, dependencies, credential handling and trust boundaries. Backend pruning does not remove code bundled into the frontend. Audit all dependencies and verify both closures. Retire obsolete code only after replacements pass the corresponding workflows; track missing product capabilities explicitly until their replacements are verified.
