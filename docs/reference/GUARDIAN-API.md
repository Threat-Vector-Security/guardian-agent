# Guardian Agent operation API

This reference describes the current local security service. The CLI, browser and MCP transport share this API and its authorization rules. See [the operator guide](../guides/SECURITY-WORKSPACE.md) for setup and [SECURITY.md](../../SECURITY.md) for trust boundaries.

The implementation sources are `src/security-workspace/server.ts`, `operations.ts`, `service.ts`, `client.ts` and `mcp.ts`. The live operation catalog is authoritative for the running build and credential. Package release versions come from `package.json`; health/MCP protocol version labels are not a substitute for the exact installed build version.

## Service and HTTP envelope

The default URL is `http://127.0.0.1:3000`. A different port can be supplied to `serve --port`. Both the listener and shipped client are restricted to IPv4 loopback; do not replace the hostname with a public address or assume remote HTTPS deployment support.

| Method and path | Purpose |
| --- | --- |
| `GET /health` | Basic service identity/health; does not establish collector or antivirus coverage |
| `GET /api/v1/auth/providers` | Whether Entra and local browser bootstrap are available |
| `POST /api/v1/session/local` | Same-origin browser-only bootstrap when local sign-in is optional |
| `GET /api/v1/session` | Current authentication state and principal, if authenticated |
| `POST /api/v1/session` | Exchange JSON `{ "token": "..." }` for an HttpOnly session |
| `DELETE /api/v1/session` | End the current cookie session; requires the service Origin |
| `GET /api/v1/auth/entra/start` | Start configured Entra sign-in |
| `GET /api/v1/auth/entra/callback` | Entra redirect callback; not a general client operation |
| `GET /api/v1/operations` | Return `{ "items": [...] }` containing permitted operation names, descriptions, scopes and JSON schemas |
| `POST /api/v1/operations` | Execute a permitted structured operation |

POST operation bodies use `Content-Type: application/json`:

```json
{
  "operation": "projects.get",
  "input": { "id": "<project-id>" }
}
```

Success is `{ "result": ... }`. An error has an HTTP error status and `{ "error": { "message": "..." } }`. Do not treat an HTTP 200 operation response as proof that an asynchronous job completed successfully; inspect the returned job and its later state.

Common errors include 400 invalid input, 401 unauthenticated/expired credential, 403 denied authority/origin/scope, 404 missing resource or operation, 409 revision or workflow conflict, 413 oversized body, 415 unsupported content type and 429 bounded capacity/rate exhaustion. Provider failures may also return 408, 502 or 504. There are no per-project REST mutation routes or AI streaming endpoints in this transport.

## Authentication and authority

Assistant clients send an enrolled non-administrator credential as `Authorization: Bearer <token>`. Credentials carry scopes, expiry and optionally `projectIds`. Revocation takes effect on subsequent authorization checks. Do not place credentials in URLs.

Administrative operations require a session whose principal has role `admin`. A root token is deliberately rejected as a bearer credential for the operations endpoint. The CLI's explicit `--admin` option exchanges the configured administrator credential for a session. Do not supply that credential or option to an AI assistant.

Browser cookie-authenticated operation POSTs require an exact same-origin header. Local browser bootstrap is constrained by Host, Origin and Fetch Metadata and is disabled when sign-in is required or Entra is configured. It is a local convenience flow, not an assistant authentication alternative. Viewer principals may call only operations marked read-only.

Scopes grant operation families; project restrictions further narrow access. Omitted `projectIds` means installation scope. Credentials restricted to existing projects cannot create/import projects or perform installation-wide status, collection, environment mapping or finding ingestion. Additional checks apply when linking findings and using AI project context. Do not infer access from a displayed UI button; the service authorizes every operation.

## Operation catalog

The catalog below summarizes current families. Query `GET /api/v1/operations` or `guardianagent operations` for exact schemas and credential visibility.

| Operations | Required scope | Behavior |
| --- | --- | --- |
| `status.get`, `integrations.list` | `security:read` | Observed posture/coverage and actual integration capability status |
| `environments.preview` | `security:read` | `source: "local"\|"aws"`; preview observed inventory as architecture context |
| `findings.list`, `jobs.list` | `security:read` | Authorized evidence and job records |
| `findings.update` | `findings:write` | `id`, review `status`, `reason`; optional project/asset link |
| `findings.ingest` | `findings:ingest` | Bounded connector finding batch; source identity comes from credential |
| `projects.list`, `projects.get`, `projects.export` | `projects:read` | Authorized workspace summaries, complete documents and export representations |
| `projects.create`, `projects.import`, `projects.update` | `projects:write` | Create/import or commit a complete document with expected revision |
| `host.check.start` | `security:collect` | Start bounded local posture/network/native collection |
| `aws.status.get` | `cloud:read` | Configured account/region collection status |
| `aws.check.start` | `cloud:collect` | Start read-only collection for that configured AWS target |
| `native.scan.propose` | `response:propose` | Propose `scanType: "quick"\|"full"` for separate approval |
| `ai.providers.list`, `ai.models.list`, `ai.run`, `ai.cancel` | `ai:invoke` | Sanitized provider metadata, live models and bounded AI workflows |
| `browser-auth.get`, `browser-auth.update` | Administrator session | Inspect/update local browser sign-in requirement |
| `ai.models.discover`, `ai.configure`, `ai.test` | Administrator session | Discover draft-provider models, configure provider and test inference |
| `jobs.approve`, `jobs.reject` | Administrator session | Decide a pending response job with `id` and `reason` |
| `clients.list`, `clients.create`, `clients.revoke` | Administrator session | Enroll, inspect and revoke assistant credentials |
| `audit.list` | Administrator session | Read local audit records |

Finding/audit pagination accepts optional numeric `cursor` and `limit` (1–100). Use returned pagination metadata; do not assume list order or that one page contains every record.

`clients.create` takes `name`, `scopes`, optional `projectIds` and `expiresInDays` (1–90, default 30). It returns `{ client, token }`; the secret is returned once. Store it in a private file outside the repository and pass only that file path to the intended assistant. Unknown/administrative scopes are rejected.

## Projects, preservation and revisions

`projects.create` takes `{ name }`. `projects.import` takes `{ name, content }`, where `content` is a JSON string containing a complete ContextCypher or Guardian document. Creation, import, get and update return `{ project }`; a project includes its `id`, `name`, `revision`, timestamps and editable `document`. Do not mistake the response wrapper for the project itself.

To update, first read the authorized project, preserve all fields, then submit:

```json
{
  "operation": "projects.update",
  "input": {
    "id": "<project-id>",
    "revision": 7,
    "document": { "nodes": [], "edges": [], "systemName": "<name>" }
  }
}
```

The document above illustrates the shape only. A real update must send the complete document obtained and edited by the caller, including unknown extensions, GRC context, hierarchy and metadata. Updates are replacement documents, not patches. A successful commit increments the revision. On 409, retain the local draft, read the current project and reconcile explicitly; never blindly retry with a newer revision.

Deleting an asset linked to a finding is rejected until the link is removed in the finding workflow.

`projects.export` returns `{ document, original, guardian, originalSha256 }`. `document` is the editable object; `original` is the preserved original import string; `guardian` is the current Guardian envelope string. Choose the correct representation rather than serializing the whole operation wrapper as a diagram.

The browser's canonical route is `#systems?project=<id>`. Selecting, creating or importing a project updates that URL. Server project saves and autosave commit revisions; portable file exports use the browser's save dialog/download workflow.

## AI requests and durable jobs

`ai.run` takes `kind` (`chat`, `analysis`, `generate` or `assessment`), `prompt`, optional `context`, optional unique `requestId`, and project context as `projectId` plus its expected `revision`. A credential with project restrictions must provide project context. Project-context requests also require `projects:read`.

The response is completed JSON containing `content`, `provider`, `model`, `jobId`, `requestId`, optional `usage`, and a validated `document` for generation. It is synchronous at the HTTP boundary and records a durable job; there is no SSE stream. Current limits include 120 seconds, two concurrent AI requests, 1 MiB serialized context and 96 KiB provider output. Operation schemas also bound prompts and other inputs. Authority and project revisions are checked again before releasing a result.

Cancel using `ai.cancel` with the same `requestId`; ownership is tied to the credential. Cancellation and timeouts must remain visible. AI never executes tools or automatically commits the proposed diagram.

`ai.configure` accepts `provider`, `model`, optional `apiKey`, `temperature` (0–2) and `maxTokens` (256–16000). `ai.models.discover` accepts a provider and optional draft key without saving configuration. Keys remain in backend memory until restart; returned configuration indicates whether a credential is available and inference is ready. Provider support for optional parameters can vary.

Host/AWS collection returns a job immediately; use `jobs.list` to inspect its actual state/result. Native scan proposals wait for an administrator's approval, expire after a bounded window, and remain bound to requester and target. A scan request is not a clean scan result. Jobs visible to a credential are filtered by actor/project authority.

## File-based CLI credentials

Initialize and serve separately from assistant client setup. `guardianagent init` prints the administrator credential file path. Enroll a scoped assistant through the administrator UI/session, then save its returned token privately.

PowerShell client example (the file already contains a scoped assistant token):

```powershell
$env:GUARDIAN_URL = 'http://127.0.0.1:3000'
$env:GUARDIAN_TOKEN_FILE = 'C:\Private\guardian-assistant-token.txt'
node dist/security-main.js operations
node dist/security-main.js call status.get
node dist/security-main.js call projects.get --input-file project-request.json
```

Bash client example:

```bash
export GUARDIAN_URL='http://127.0.0.1:3000'
export GUARDIAN_TOKEN_FILE='/private/path/guardian-assistant-token.txt'
node dist/security-main.js operations
node dist/security-main.js call projects.get --input-file project-request.json
```

`project-request.json` contains `{ "id": "<project-id>" }`, not a token. Use private input files for sensitive operation inputs and do not commit them. The CLI prints operation results, which may themselves contain sensitive architecture/evidence. `GUARDIAN_TOKEN` is supported for environments that require it, but a token file avoids embedding the credential in shell commands or MCP configuration.

## MCP over stdio

Run `node dist/security-main.js mcp` with the same `GUARDIAN_URL` and scoped `GUARDIAN_TOKEN_FILE`. The service must already be running. An assistant client configuration uses its normal stdio-server format, for example:

```json
{
  "mcpServers": {
    "guardian": {
      "command": "node",
      "args": ["/absolute/path/GuardianAgent/dist/security-main.js", "mcp"],
      "env": {
        "GUARDIAN_URL": "http://127.0.0.1:3000",
        "GUARDIAN_TOKEN_FILE": "/private/path/guardian-assistant-token.txt"
      }
    }
  }
}
```

Use actual absolute platform paths; JSON Windows backslashes must be escaped. Keep the token value out of the configuration. The exact client setup UI varies, but the Guardian server contract is standard MCP stdio.

Each visible non-administrative operation maps to `guardian_` plus its name with periods replaced by underscores: `projects.get` becomes `guardian_projects_get`, `ai.run` becomes `guardian_ai_run`, and `native.scan.propose` becomes `guardian_native_scan_propose`. Tools expose the operation JSON schema. MCP returns JSON result text or `isError: true`; clients must inspect errors.

The `guardian://status` resource is listed when `status.get` is visible. Tool discovery does not override the service's deeper project/installation checks. Administrative operations are excluded from discovery and invocation; `mcp --admin` is rejected. The MCP process never opens the runtime database directly.
