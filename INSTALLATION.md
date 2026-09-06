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

## Packaged distributions

`npm run package:security` builds a local distribution with platform launchers. See the [packaging guide](docs/guides/SECURITY-PACKAGING.md) for the archive layout, target-platform dependency installation and verification.

The distribution requires Node and is currently unsigned. It does not install an elevated service or provide an additional subprocess sandbox. Native installers, signing and protected service deployment remain release work.

## Next steps

- [Use the workspace](USAGE.md)
- [Security, AI, AWS, Entra and assistant setup](docs/guides/SECURITY-WORKSPACE.md)
- [Diagram and GRC workflow](docs/guides/GRC-WORKFLOWS.md)
- [Known issues](docs/KNOWN-ISSUES.md)
- [Verification commands](docs/guides/INTEGRATION-TEST-HARNESS.md)
