# Add a Guardian capability

Guardian's UI, CLI and MCP clients share the same security service contract. New capabilities belong in that contract so authentication, authorization, validation, audit and error handling remain consistent.

## Choose the owner

| Change | Primary owner |
| --- | --- |
| Named operation and input schema | `src/security-workspace/operations.ts` |
| Authorization and application behavior | `src/security-workspace/service.ts` |
| Durable records and transaction constraints | `src/security-workspace/store.ts` |
| Native workstation observations | `src/security-workspace/collectors.ts` and its adapters |
| AWS collection | `src/security-workspace/aws-security.ts` |
| Environment diagram previews | `src/security-workspace/environment-mapping.ts` |
| Built-in security AI | `src/security-workspace/ai.ts` and the provider integration modules |
| HTTP/session boundary | `src/security-workspace/server.ts` |
| CLI and MCP transport | `src/security-main.ts`, `src/security-workspace/client.ts`, `src/security-workspace/mcp.ts` |
| Browser/editor interaction | `web/security/`, `web/contextcypher/` |

Check existing files before choosing a new module. The [security architecture](../architecture/SECURITY-CONVERSION.md) describes the shared boundaries.

## Operation contract

1. Define a bounded schema, scope and accurate read-only/administrative metadata.
2. Implement the operation in the shared service. Validate authority and target scope before side effects.
3. Reuse durable jobs and approval records for long-running or sensitive actions. Bind approval to the exact reviewed action and enforce expiry.
4. Keep provider credentials on the backend. Accept only supported provider/account configuration; do not introduce arbitrary endpoints or command execution.
5. Treat imported findings, documents and AI content as data. None can change permissions or authorize another action.
6. Preserve project revision checks and imported document extensions. Failed writes must leave the prior saved record intact and the browser draft recoverable.
7. Expose the behavior through existing transports. Do not create a separate permissive UI, CLI or MCP path.

A named operation is already classified; it does not need an LLM to determine its operation name. Built-in AI produces security responses and proposals. It does not acquire shell, discovery or remediation authority through a prompt.

## External integrations

Declare supported collection/response capabilities precisely. Validate external responses, bound pagination and resource use, and report missing permissions, unavailable providers and truncated inventory. Do not turn incomplete evidence into a healthy or clean result.

Use explicit account/region enrollment for AWS and configured tenant/group mappings for Entra. Adding another vendor requires its actual API and permission contract; installed-software inventory alone is not a management integration.

## UI and documentation

Keep standalone users fully supported alongside assistant clients. Use the common save-dialog helper for portable exports; reserve a picker before asynchronous generation. Distinguish saved revisions from exported files, cancelled actions and failed writes.

Follow the current [WebUI design](../design/WEBUI-DESIGN.md). Update the operator guide and relevant workflow guide when behavior changes. Record unresolved release limitations in [known issues](../KNOWN-ISSUES.md), rather than implying completion.

## Verification

Add focused colocated tests for changed behavior, including one denied/error path and an ordinary successful path. Exercise affected transports against the shared contract. For import/save changes, include round-trip preservation and revision conflicts; for response actions, include approval binding and expiry.

Run `npm run check`, focused Vitest tests, then relevant browser/package checks and the full `npm test` suite before handoff. Run `npm run validate:dependency-contract` for dependency changes. Follow [integration testing](INTEGRATION-TEST-HARNESS.md), and state restart ownership when backend/startup behavior changes.
