# Guardian Agent security conversion

> Planning correction, 6 September 2026: the reduced UI and external-assistant-first scope below are not the complete product target. The [comprehensive uplift plan](../plans/GUARDIAN-SECURITY-UPLIFT-PLAN-2026-09-06.md) specifies full standalone AI, ContextCypher workflow parity and environment mapping. Retain reusable legacy code until replacements pass acceptance; this notice does not claim the uplift is implemented.

Status: implementation in progress, 6 September 2026. The existing public repository and Apache-2.0 license are retained. No branch or Git history replacement is required.

Windows Defender and macOS native posture adapters feed the same observation service. An optional AWS adapter enrolls one explicit account/region, verifies STS identity first and performs bounded read-only collection. Entra OIDC provides optional local browser identity with explicit group mappings. Neither integration makes the loopback service a public cloud application or remotely managed fleet. Production packaging follows only the compiled security entrypoint dependency closure; retained legacy source and dependencies are excluded.

## Decision

The previous composition root starts a general assistant, and its authenticated web callers inherit broad owner authority. The ContextCypher editor owns state in the browser. Combining these directly would preserve two competing authorities and expose excessive privileges to external assistants.

The security product uses a dedicated composition root and a shared application service in `src/security-workspace/`. HTTP, the CLI, and MCP call the same versioned, schema-checked operations. Structured operation names are dispatch contracts; they do not invoke or replace natural-language Intent Gateway classification. Any retained legacy natural-language path continues to use the Intent Gateway.

SQLite owns projects, original imports, revisions, findings, jobs, client grants, sessions, and audit events. A project mutation and its audit event commit together. ContextCypher imports retain exact original bytes and all unknown document fields. The frontend is a projection and editor of backend revisions, not an independent authoritative store.

The persistence boundary meters serialized bytes before each record write, checks transaction-visible aggregate and per-kind quotas, and preserves free filesystem capacity for administration. Evidence has recursive complexity limits. Metadata listing uses SQL projection rather than loading project envelopes; findings and audit rows use immutable row/sequence cursors. Browser session admission reuses one identifier per principal and preserves administrator recovery capacity.

Administrative browser sessions have an administrative audience. Assistant bearer credentials have explicit scopes, expiry, revocation, and no administrative audience. An assistant cannot approve its own request, enroll a client, or change root protection policy. A durable job binds its target and arguments before approval. Interrupted side effects become interrupted/unknown on recovery and are not blindly replayed.

Local browser access is code-free by default, with an opt-in `browser-auth.update` preference owned by the shared service. It does not grant authority to unauthenticated operation requests: the frontend explicitly bootstraps an HttpOnly session using a same-origin JSON POST with exact Host/Origin and Fetch Metadata checks. The preference revision invalidates convenience sessions after a change. Entra enrollment always requires sign-in. External assistant bearer authorization is unchanged. Local processes able to imitate the browser bootstrap are trusted by this optional convenience mode.

The local host and Defender adapters are retained. Coverage describes periodic posture observations and requested scans honestly. This first conversion does not add a kernel sensor or claim universal containment of software running outside Guardian. No arbitrary shell, general assistant, coding IDE, productivity account, or outgoing communications operation is registered by the security service.

## Migration and verification

Build the application-service contract, import/export integrity, and negative authorization tests first. Wire the six-page React security shell and authenticated machine transports to it. The legacy entrypoint, public container and Fly deployment are removed from supported paths; remaining source is excluded from the clean security-only TypeScript build and will be deleted after retained dependencies and prior user data are accounted for.

Gates: TypeScript/backend and frontend builds; ContextCypher original/document roundtrips and conflict handling; role/audience/expiry/replay/CSRF/body-limit checks; restart recovery; real host read-only collection; end-to-end HTTP/CLI/MCP contracts; browser interaction and accessible layout. Independent buddy review must identify concrete failure scenarios, and every accepted defect must be verified after repair.

Do not use elapsed-time estimates as release gates. Track implemented behavior, tested coverage, and remaining work explicitly. Enterprise identity, fleet, signed Windows service deployment, and proprietary response integrations each need their own verified installation before being described as supported.
