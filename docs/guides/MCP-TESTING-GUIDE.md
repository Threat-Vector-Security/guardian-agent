# Test Guardian's MCP interface

Guardian exposes its security workspace to MCP clients over stdio. The MCP process is a client of the running local HTTP service; it does not open the database or grant additional authority.

## Prerequisites

- Node.js 24.14 or later, dependencies installed and `npm run build` completed.
- A running Guardian security service.
- A dedicated assistant credential enrolled in **Settings**, initially with `security:read` and `projects:read`.
- The credential stored in a private file outside repositories.

Set `GUARDIAN_URL` to the exact service address, normally `http://127.0.0.1:3000`, and `GUARDIAN_TOKEN_FILE` to that credential file. Never use the bootstrap administrator token for MCP.

## Client registration

Adapt this configuration to the chosen MCP client:

```json
{
  "mcpServers": {
    "guardian": {
      "command": "node",
      "args": ["/absolute/path/GuardianAgent/dist/security-main.js", "mcp"],
      "env": {
        "GUARDIAN_URL": "http://127.0.0.1:3000",
        "GUARDIAN_TOKEN_FILE": "/private/path/guardian-client-token.txt"
      }
    }
  }
}
```

On Windows, use an absolute executable path if the client does not inherit Node's PATH. JSON paths must use forward slashes or escaped backslashes. Start the Guardian service separately before the assistant connects.

## Connection checks

With the same environment, run:

```sh
node dist/security-main.js operations
node dist/security-main.js call status.get
```

Then connect the assistant and check:

1. Tool discovery lists only this credential's authorized operations. Names use the `guardian_` prefix, such as `guardian_status_get`.
2. Calling `guardian_status_get` returns recorded coverage/status rather than a chat answer.
3. A credential with project read access can list/read permitted projects. Project restrictions exclude unrelated projects.
4. Write and scan-proposal tools appear only when their corresponding scopes are granted. Administrative tools never appear.
5. Expired or revoked credentials fail on subsequent authorized requests.
6. With `security:read`, the `guardian://status` resource returns the same status information.

Test writes only in an isolated QA project. A reviewed project update must include its current revision. Reject a stale revision without losing the local draft. Do not approve a real antivirus scan merely to test tool connectivity.

MCP cannot request an administrative session or bypass a scan approval. It also cannot constrain actions the external assistant performs outside Guardian.

## Automated verification

```sh
npm run test:security-workspace
```

This covers the shared service, scoped HTTP/CLI/MCP contracts and security boundaries with isolated state. Use the [integration testing guide](INTEGRATION-TEST-HARNESS.md) for browser and packaged-runtime checks. Passing protocol tests does not establish compatibility with every individual assistant installation; run the connection checks in each configured client.
