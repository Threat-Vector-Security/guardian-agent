# Install Guardian Agent

Guardian runs locally on Windows, macOS and Linux. It requires Node.js **24.14 or later**, npm and a writable private data directory. Core diagrams, GRC and security observations do not require an AI account. SQLite must be available; the security service does not fall back to temporary in-memory storage.

## From source

Run from the repository root:

```sh
npm ci
npm run build
npm run init
npm start
```

Open **http://127.0.0.1:3000** using the exact address printed by the service. The listener accepts loopback access on that IP; do not substitute a different hostname or expose it through a public reverse proxy.

Initialization creates a private administrator credential and prints its file path, not its contents. The local browser opens without a code by default. Enable **Settings → Require an access token to open Guardian** if you want browser sign-in. Configured Entra SSO always requires sign-in. External assistants always use separately enrolled scoped credentials.

The default data directory is `~/.guardianagent/security-v2`. Set `GUARDIAN_SECURITY_HOME` before initialization and startup to use another directory. Keep that directory and credentials outside source repositories.

For an alternate port:

```sh
node dist/security-main.js serve --port 3007
```

Ctrl+C stops the foreground service.

## Development launchers

Install dependencies first with `npm ci`. The launchers run security tests, type checks and a build, initialize credentials when needed, then start Guardian.

Windows PowerShell:

```powershell
.\scripts\start-security-windows.ps1
```

macOS, Linux or WSL:

```sh
bash scripts/start-security-unix.sh
```

After an existing build, Windows accepts `-StartOnly`; Unix accepts `--start-only`. Windows accepts `-Port 3007`; on Unix set `GUARDIAN_PORT=3007`. These scripts do not stop another Guardian process.

Changes to backend code require a build and restart. Stop the process you intend to replace before starting its new build; active jobs may be interrupted. Browser-only changes require rebuilding the UI and reloading the page.

When updating an existing installation, keep its `--port` and `--data-dir` options and check `node --version` in the launch terminal (24.14 or later). Rebuilding files does not replace the running backend. A new UI can otherwise appear alongside an older backend and still report that AWS account/region configuration is required. Restarting ends browser sessions and clears memory-only AI provider keys; sign in again and re-enter those keys as needed.

## AWS CLI and SSO setup

Guardian uses credentials available to its host process; it does not sign you into AWS. For an existing AWS CLI SSO profile, authenticate and verify the intended account before starting Guardian:

```sh
aws sso login --profile YOUR_PROFILE
aws sts get-caller-identity --profile YOUR_PROFILE
```

Complete the browser sign-in opened by the first command. In the same terminal used to launch Guardian, select that profile with `$env:AWS_PROFILE = "YOUR_PROFILE"` in PowerShell or `export AWS_PROFILE="YOUR_PROFILE"` on macOS/Linux. Configure the inventory region in the profile or `AWS_REGION`; the SSO login region is separate. `GUARDIAN_AWS_PROFILE`, if set, overrides `AWS_PROFILE`. Workload roles and environment credentials use their own authentication setup instead of SSO.

Start or restart Guardian with the selected profile and existing port/data directory. In **Integrations**, check the reported account, region and verified identity, then use **Check AWS** or **Environments → Collect now**. A verified identity does not guarantee GuardDuty or Security Hub availability; service setup and permission gaps remain visible in coverage. See the [AWS operator guide](docs/guides/SECURITY-WORKSPACE.md#optional-aws-security) for explicit account pins, session renewal and recovery.

## Packaged distributions

`npm run package:security` builds a local distribution with platform launchers. See the [packaging guide](docs/guides/SECURITY-PACKAGING.md) for the archive layout, target-platform dependency installation and verification.

The distribution requires Node and is currently unsigned. It does not install an elevated service or provide an additional subprocess sandbox. Native installers, signing and protected service deployment remain release work.

## Next steps

- [Use the workspace](USAGE.md)
- [Security, AI, AWS, Entra and assistant setup](docs/guides/SECURITY-WORKSPACE.md)
- [Diagram and GRC workflow](docs/guides/GRC-WORKFLOWS.md)
- [Known issues](docs/KNOWN-ISSUES.md)
- [Verification commands](docs/guides/INTEGRATION-TEST-HARNESS.md)
