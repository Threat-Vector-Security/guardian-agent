# Security Policy

## Supported versions

| Version | Status |
| --- | --- |
| Current 2.x release | Active development and security fixes, with the limits below |
| 1.x and earlier | Historical archive; no maintenance commitment from the current security conversion |

See `package.json` for the exact current version and the sections below for supported protections and deployment limits.

## Reporting a vulnerability

Report reproducible security issues privately to the repository maintainers. Use GitHub's private vulnerability reporting option if it is enabled for this repository; otherwise ask a maintainer through the repository contact channel for a private reporting route. Include the affected version, platform, reproduction steps and impact. Do not put live credentials, personal host evidence, runtime databases or exploitable details in a public issue. Ordinary non-sensitive bugs can use the public issue tracker.

## Product boundary

Guardian Agent is a local security operations and architecture workspace. It combines observed workstation/network security evidence with editable ContextCypher systems, security analysis and GRC context. It can be used directly in the browser or through scoped CLI/MCP clients.

The current service starts from `src/security-main.ts`; its authority is in `src/security-workspace/`. The [architecture](docs/architecture/SECURITY-CONVERSION.md), [operator guide](docs/guides/SECURITY-WORKSPACE.md) and [API reference](docs/reference/GUARDIAN-API.md) describe the current product. Historical security material is in the [v1 archive](docs/archive/previous/SECURITY.md), not a specification of current protection.

## Service authentication and authorization

- The HTTP listener binds to `127.0.0.1`. The shipped CLI client accepts only `http://127.0.0.1:<port>` service URLs. This release is not a public-facing hosted service or a multi-tenant security boundary.
- Exact Host and Origin checks, a same-origin content security policy, frame denial and browser Fetch Metadata checks protect the browser-to-localhost boundary. These are not protection against a malicious same-account process capable of imitating requests.
- Local browser sign-in is optional and off by default. A same-origin browser bootstrap creates an administrative HttpOnly session. This convenience mode intentionally trusts access to the local workstation. Operators can require sign-in; changing that preference invalidates sessions created without sign-in. Configured Entra disables code-free bootstrap.
- Cookie sessions are HttpOnly and SameSite=Strict, have bounded lifetimes, and recheck the backing credential. The loopback HTTP cookie is not advertised as transport-encrypted. Cookie-authenticated operation writes require the exact service Origin.
- Assistant clients use separately enrolled bearer credentials with operation scopes, expiry, revocation and optional project grants. The root administrator credential is rejected as an operations bearer token; an administrator must explicitly exchange it for a session.
- MCP is a thin authenticated service client. Administrative operations are excluded, including client enrollment, approval/rejection, provider configuration and audit listing. A model cannot authorize itself by asking for a broader tool.
- Input schemas, roles and scopes are checked in the shared operation service. Project-scoped credentials cannot use installation-wide host collection, AWS collection or finding ingestion. Viewer mutation is rejected.

Initialization writes a root credential file and prints its path. Keep that file private and never configure it as an assistant token. Enrolled assistant tokens are returned once; the database stores token hashes. Token files, operating-system accounts and filesystem permissions remain part of the local trust boundary.

## Evidence, projects and responses

Complete project documents are stored with revision checks. Import retains the original document and integrity metadata; editing/export must preserve unknown fields. Stale project updates fail with a conflict rather than overwriting a newer revision. Imported text, findings and diagram content are untrusted evidence, not execution instructions.

Host and AWS collection produce explicit coverage and error information. LAN mapping uses observed local network data; it is not proof that every device or service has been discovered. Native antivirus information depends on the platform and available permissions. Requesting a scan does not establish a clean result.

The current native response path proposes a Windows Defender quick or full scan for separate administrator approval. Pending approvals expire and are bound to the requesting credential and target; revoked/expired requesters cannot have an old request approved. This is not general-purpose endpoint containment or proprietary EDR response coverage. Marking a finding resolved is an operator review decision, not proof of remediation.

Third-party findings can enter through the scoped ingestion operation; the service derives source identity from the credential. The presence of this ingestion contract does not mean every antivirus or commercial security vendor has a tested connector.

## AI and external services

The built-in AI service uses the configured provider for chat, analysis, generation and assessment. It has bounded input/output, request duration and concurrency, supports owner-bound cancellation, and exposes no execution tools. Generated diagrams and recommendations remain proposals for review.

AI provider keys stay in backend process memory until restart. Provider/model preferences may persist, but credentials must be re-entered after restart. Browser fields must not write provider keys into localStorage, project exports or logs. Sanitized errors avoid echoing provider bodies. Selecting a cloud provider sends the submitted prompt and context to that provider; local application hosting does not make cloud inference local.

When project context is selected, AI requires project read authorization and the current revision. It rechecks credential authority and revision after the provider response before releasing the result. This guards against stale context and revoked grants; it does not guarantee that a model's analysis is correct.

Optional Entra sign-in validates the configured tenant and uses explicit group-to-role mapping. Optional AWS collection is read-only within the configured account/region and reports missing permissions. Protocol and mocked SDK tests do not substitute for acceptance testing in the operator's tenant/account.

## Storage and resource limits

The service uses a local SQLite store with transactions, storage budgets and explicit errors; it does not silently switch to an in-memory store when persistence fails. HTTP requests have body, concurrency and rate limits. Imports and AI requests have additional limits, so an input below the transport limit can still be rejected by a narrower operation or storage limit.

Audit records link local entries by hash and record actors/actions without intentionally storing credentials. This is a local integrity aid, not an externally anchored, tamper-proof archive. Project documents, findings and AI job results can contain sensitive system context. The application does not claim encryption of the entire runtime database or exported files; use operating-system access controls, disk encryption and appropriate backup handling.

Same-account processes and local administrators can read or modify local data, inspect process memory or bypass user-space controls. Guardian is not a tamper-resistant EDR, a replacement for antivirus/firewall protection, or an isolation boundary against an already-compromised host.

## Release and verification expectations

Keep the root `package.json` and `package-lock.json` as the dependency source of truth; generated package manifests are not independent inputs. Run dependency, production-install and packaging checks for release changes. Portable archives are not a signed installer, notarized macOS package or managed fleet deployment.

Security changes require focused tests of denied access as well as allowed behavior, shared service and HTTP/MCP consistency, and relevant actual browser/OS checks. Keep Windows and macOS capability claims separate from what has been exercised on the current machine. Signed deployment, fleet management, production tenant acceptance and proprietary EDR response must not be described as verified merely because local tests passed.
