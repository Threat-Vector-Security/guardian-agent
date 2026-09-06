# Guardian Agent security workspace

The security conversion uses the existing public Guardian Agent repository and Apache-2.0 license. It starts without an LLM account. It combines local security observations, governed scan requests, ContextCypher architecture/risk context, and machine interfaces.

## Run locally

Use Node.js 24.14 or later with built-in SQLite, then:

```sh
npm ci
npm run build
npm run init
npm start
```

Open `http://127.0.0.1:3000`. The local browser workspace opens without an access code by default. Enable **Settings → Require an access token to open Guardian** to opt into browser sign-in. Configured Entra SSO always requires sign-in. Initialization prints the administrator token file location, not its contents; use that token in the sign-in form when required. External assistants always need their own scoped credentials. Never give the root token to an assistant. Root recovery/rotation is an explicit local command: `node dist/security-main.js init --rotate-admin`. Rotation retains a previous token file for failure recovery and revokes prior administrators in the local database.

The browser access setting persists across restarts. Turning sign-in on ends sessions opened without a code. To recover the setting locally, use your administrator token file with `guardianagent call browser-auth.update '{"requireSignIn":false}' --admin` (set `GUARDIAN_TOKEN_FILE` and `GUARDIAN_URL` for this installation). This does not bypass configured Entra sign-in.

`GUARDIAN_SECURITY_HOME` selects the data directory; the default is `~/.guardianagent/security-v2`. Original Guardian and ContextCypher profiles are not silently rewritten. The new service binds only to `127.0.0.1`; it does not accept arbitrary Host headers, CORS origins, or remote access. Use the exact displayed IP address rather than substituting localhost. `GUARDIAN_PORT` selects another port if the legacy application is still running.

The Windows launcher is `scripts/start-security-windows.ps1`; Unix/WSL uses `scripts/start-security-unix.sh`. These start scripts never stop another running Guardian process. The previous assistant has no supported launch or deployment path and is not part of the security build.

## Operate

On desktop, use **Collapse sidebar** to make more room for the workspace. The icon rail keeps all navigation links; hover an icon for its label. **Expand sidebar** restores the labels, and the browser remembers this preference. Smaller screens retain their compact navigation.

The desktop header shows the loaded app version. **Reload page** loads the current app build; the browser warns before discarding an unsaved draft. Creating, importing or choosing a saved system updates its address, and browser navigation between system links loads the corresponding project. Cancelling a system change keeps the open draft and restores its address. If an older tab opens `project=Not%20reported`, refresh the browser and choose the created system from **Choose a saved system**, or repeat **Environments → Preview latest snapshot → Create editable system**.

- **Protection:** periodic host posture, native AV status and passive LAN/connection observations; run a check and inspect coverage/errors. An observed baseline is not a trusted clean baseline.
- **Findings:** review evidence, record an acknowledgment or resolution reason, and link a finding to an architecture asset. Resolution records a review decision; it does not prove technical remediation.
- **Systems:** import a ContextCypher JSON workspace, edit assets/flows/threats/controls, and save a revision. Unknown fields and existing GRC data are preserved. Conflicting revisions are rejected. Export the exact original, current ContextCypher document, or a Guardian envelope containing both.
- **Activity:** inspect jobs and pending scan proposals. Administrator approval is bound to the exact device and scan type for fifteen minutes. A native scan request remains requested/already-running/unknown; it never becomes a fabricated clean result. Jobs interrupted by service restart are not automatically replayed.
- **Integrations:** inspect capability boundaries for native providers, ContextCypher, normalized security events, and external assistants.
- **Settings:** enroll named assistants with minimum scopes, optional project restrictions, expiration (maximum ninety days), and immediate revocation. Tokens are displayed once. Administrative operations never appear in the MCP tool catalogue.

### Save projects and portable files

**Save system** records a Guardian project revision; it does not open a file dialog. **File → Save As**, **Export draft**, and report/image exports make portable copies and ask for a destination when the browser supports a native save picker. Cancelling does not save or export anything. Browsers without that picker offer an explicit browser-download choice; the browser's download settings then control the destination.

Enable **Autosave** and choose an interval in the Systems editor's **Settings → General**. Guardian saves changed projects at that interval without opening a file picker. Unchanged projects are skipped, and edits made while a save is pending remain unsaved until a later save. If a save fails or conflicts with a newer revision, autosave pauses and the draft stays editable and exportable. A successful manual **Save system** resumes autosave. For a revision conflict, export the draft before loading the latest revision and reconciling the changes.

## Drive it through MCP or the CLI

Enroll an assistant in Settings with `security:read` and `projects:read` initially. Add `projects:write`, `findings:write`, `security:collect`, or `response:propose` only where needed. Use a separate `findings:ingest` credential for trusted connector transport; ingested evidence itself remains untrusted.

Store the issued token in a private file outside repositories. An MCP client configuration is:

```json
{
  "mcpServers": {
    "guardian": {
      "command": "node",
      "args": ["/absolute/path/to/GuardianAgent/dist/security-main.js", "mcp"],
      "env": {
        "GUARDIAN_URL": "http://127.0.0.1:3000",
        "GUARDIAN_TOKEN_FILE": "/private/path/guardian-client-token.txt"
      }
    }
  }
}
```

Use the equivalent MCP registration supported by Codex, Claude Code, or the chosen assistant. Real MCP protocol tests verify the shared interface; individual Grok Bot and Claude installations still require their own client smoke test. An assistant that runs outside Guardian can still perform work outside its control.

With the same environment:

```sh
node dist/security-main.js operations
node dist/security-main.js call status.get
node dist/security-main.js call host.check.start
node dist/security-main.js import workspace.json --name "Office network"
node dist/security-main.js call projects.update --input-file reviewed-change.json
node dist/security-main.js export PROJECT_ID --format original
```

HTTP uses `POST /api/v1/operations` with `{ "operation": "status.get", "input": {} }` and the scoped bearer credential. `GET /api/v1/operations` returns the authorized schema catalogue. For deliberate human administrative CLI work, use a root credential and `--admin`, which creates an explicit administrative session. MCP cannot request that audience.

## Standalone security AI

Guardian's built-in AI uses its curated provider registry: local Ollama, Ollama Cloud, OpenAI, Anthropic, Gemini, xAI and the supported compatible providers. Configure a provider and model through the administrator-only `ai.configure` operation; `ai.providers.list` returns configuration without its secret, and `ai.models.list` lists models available to the configured account. `ai.test` performs a small connectivity conversation. Model access depends on the chosen provider and account. Local Ollama uses `127.0.0.1:11434`; custom provider endpoints are not accepted.

`ai.run` supports security chat, analysis, assessment and diagram generation. It requires `ai:invoke`; reading a saved project additionally requires `projects:read`, its project ID and current revision. The service rechecks authorization and revision before delivering the answer. Generated diagrams are proposals: apply reviewed changes through the normal revision-checked project save. AI has no shell, discovery or remediation tools, and does not change security policy. `ai.cancel` cancels a request owned by the same credential.

Requests use only the submitted context and any explicitly selected project. Selected content is sent to the configured provider when a run is requested; choose local Ollama when it must remain on the workstation. Secret scanning occurs before submission and before the complete answer is released. This is a filtering measure, not a guarantee that arbitrary sensitive prose will be recognized. Each request is limited to 120 seconds, 1 MiB of context and 96 KiB of output; two requests can run concurrently. Truncated or structurally invalid generation fails without changing the diagram.

Provider keys remain only in Guardian's backend process memory until restart. Re-enter the key after restarting Guardian; provider/model and generation preferences remain saved. Keys are not written to a credential file, configuration response, project export or audit record. The administrator-only `ai.models.discover` operation lists live models with a draft key before configuration is saved; it does not retain that draft key. Discovery without a draft key can reuse the current session key only for the same provider.

AI errors distinguish billing/quota exhaustion, temporary rate limits, authentication, model access, rejected request settings and connection failures when the provider supplies that information. A provider failure does not sign you out of Guardian. Raw provider response bodies and credentials are not displayed.

## Optional Microsoft Entra ID

Set `GUARDIAN_ENTRA_TENANT_ID`, `GUARDIAN_ENTRA_CLIENT_ID`, and comma-separated Entra group GUIDs in `GUARDIAN_ENTRA_ADMIN_GROUPS`, `GUARDIAN_ENTRA_OPERATOR_GROUPS`, and/or `GUARDIAN_ENTRA_VIEWER_GROUPS`. At least one mapped group is required. Set `GUARDIAN_ENTRA_CLIENT_SECRET` only for a confidential client registration. Register the exact callback `http://127.0.0.1:PORT/api/v1/auth/entra/callback` and configure the ID token to include group claims. Restart the security service after changing these environment values.

Login uses authorization code, PKCE, one-time browser-bound state, nonce, signature/issuer/audience/tenant/expiry checks and explicit group roles. Unmapped users and group-overage tokens are rejected. Guardian does not silently query Graph with wider permissions. Federated sessions expire within one hour and are refreshed by a new sign-in; this release does not implement continuous access evaluation, SCIM, managed fleet enrollment or SAML. The adapter has cryptographic and HTTP tests; a real tenant registration still requires acceptance testing.

## Connection security zone colors

Connections default to **Automatic (source security zone)**. Their line, arrow and label colors follow the source's current zone and active zone palette. For grouped nodes, the containing security zone defines the zone; changing that container updates its automatic connections. In an edge editor, choose a named Security Zone to hold an explicit override, or choose Automatic to resume inheritance. Document-style themes retain their separate ink and trust-boundary crossing presentation.

Older diagrams recorded only a zone value, without identifying whether it was automatically copied or manually selected. On load, a missing zone or one matching the source is migrated to Automatic; a different zone remains an explicit override. A manually chosen legacy value that happens to match the source is indistinguishable from an automatic copy. Select that named zone again to lock it as an override. Original imports remain available; unrelated extension fields are retained.

## Security and deployment boundaries

Windows supports Defender posture and separately approved scan requests, plus installed antivirus inventory. macOS collects Gatekeeper, FileVault, Application Firewall, neighbors and connections using native read-only commands; unavailable commands or insufficient permissions are shown as incomplete coverage. There is no supported XProtect scan operation. Native macOS acceptance must run on a Mac before a release is advertised as verified there.

## Optional AWS security

Set `GUARDIAN_AWS_ACCOUNT_ID` to the enrolled twelve-digit account and `GUARDIAN_AWS_REGION` to its region. Optionally set `GUARDIAN_AWS_PROFILE` to a dedicated local AWS profile. Use short-lived credentials from that profile or an instance/workload role; Guardian does not accept access keys or arbitrary endpoints through its UI. The service must be restarted after changing enrollment. No AWS collection occurs until **Integrations → Collect AWS observations** or `aws.check.start` is requested.

The read-only policy is `policies/aws-security-readonly.json`. Collection verifies STS identity against the enrolled account before requesting EC2 instances/security groups, Security Hub findings and GuardDuty findings. Disabled services, missing permissions, timeouts and bounded/truncated results remain visible as incomplete coverage. It does not enable services, change firewall rules, quarantine resources or remediate findings. One account and region are enrolled per local instance. Use `cloud:read` and `cloud:collect` scopes for assistants; project-restricted credentials cannot inspect account-wide cloud state. Verify IAM and collection in the intended customer account before operational acceptance.

Private cloud infrastructure can run the local service natively on a VM with its workload identity, but the listener still binds to loopback. This release deliberately provides no Docker/Fly or public hosted deployment. Entra sign-in requires the browser to reach the registered loopback callback on that host.

## Map recorded environments

Open **Environments**, select **Local network** or **AWS**, and select **Collect now** to start the existing read-only collection job. Refresh its status or inspect it in Activity. **Preview latest snapshot** reads the recorded inventory without starting another collection. Review the timestamp, source evidence and coverage, then select **Create editable system** to open a new model in Systems.

Local maps contain the workstation and usable OS neighbor-cache observations. They are not a complete LAN census or physical topology. AWS maps contain enrolled account/region EC2 instances and security groups; their edges are explicit security-group attachments, not traffic flows. Existing systems and their manual changes are not overwritten. Azure resource and Microsoft identity/device discovery are not connected yet; Entra sign-in to Guardian does not grant tenant inventory access.

Environment previews require installation-wide `security:read`; AWS previews additionally require `cloud:read`. Collection and saving separately require their existing collection/project-write grants. Provider/cloud credentials are never embedded in the generated diagrams.

## Release limits

This is a local security-workspace alpha, not a kernel EDR, full LAN sensor, or universally enforced assistant sandbox. Windows Defender is the native managed scan provider; Security Center registration of other AV products is inventory, not a claim that their health or response APIs are supported. ClamAV on Linux is currently executable inventory only. No actual antivirus scan is started by the test suite.

The service uses OS file permissions and local credentials. It is not yet installed as a separately protected Windows service. A process with the same account or local administrator authority may bypass it or read its state; do not expose the listener through a reverse proxy and call it enterprise-ready. Signed installers/updates, service ACL hardening, EDR response adapters, SIEM delivery guarantees, remote fleets and vendor/customer acceptance are separate release gates.

SQLite is durable and single-service owned. Record storage is bounded to 512 MiB by default with per-record and per-kind limits, a 64 MiB filesystem reserve, and a 32 MiB allowance for each connector's ingested findings. Project imports retain both editable and base64 original forms; an individual stored project is limited to 48 MiB. Finding evidence is limited to 64 KiB per record, 16 levels, 5,000 values and bounded strings/containers. Quota failures reject the complete transaction. Findings and audit history use stable cursor pagination, while terminal job history retains the newest 1,000 resolved jobs and preserves pending, running, requested, unknown and interrupted work.

Audit hashes provide local consistency, not an independently trusted archive. Back up after stopping the service, copying the complete data directory including the database and original imports. Do not copy only a live SQLite main file. Administrators should still monitor disk consumption because audit events are append-only and the local filesystem may also be used by other applications.

Browser sessions are limited to one live session identifier per principal. Repeated sign-in refreshes that session, non-administrator sessions cannot consume the administrator reserve, and generic unauthenticated traffic has a separate rate bucket from local and Entra sign-in.

Workspace JSON imports are bounded (16 MiB editable documents; 64 MiB Guardian envelope input), reject unsafe object keys and malformed graph references, and retain original byte hashes. Provider credential stores and encrypted/binary imports are rejected. Never import secrets as architecture evidence. No model provider receives workspace data automatically.
