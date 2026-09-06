# Integration testing

Guardian's current test surface is the security runtime in `src/security-workspace/`, the CLI in `src/security-main.ts`, and the browser workspace in `web/security/` with the ContextCypher editor in `web/contextcypher/`.

## Baseline commands

Run from the repository root with Node.js 24.14 or later:

| Command | Purpose |
| --- | --- |
| `npm run check` | Security runtime and browser TypeScript checks. |
| `npm run test:security-workspace` | Focused service, storage, imports, authorization, collectors, AI, HTTP, CLI, MCP and Entra tests. |
| `npm test` | Full configured Vitest suite. |
| `npm run test:coverage` | Full suite with the configured coverage thresholds. |
| `npm run build` | Compile the security backend and build the browser assets. |
| `npm run test:ui` | Real Edge browser harness against an already-running isolated preview. |
| `npm run test:package` | Distribution allowlist and launcher regression checks. |
| `npm run test:production` | Clean packaged installation and authenticated API/UI smoke checks. |

For a focused code change, run the relevant colocated test, for example:

```sh
npx vitest run src/security-workspace/grc-support.test.ts
node --import tsx web/security/document.check.ts
```

After focused checks pass, run the checks appropriate to the changed product surface and the full suite before a release handoff. Run `npm run validate:dependency-contract` after dependency/lockfile changes.

## Isolated browser preview

Build first, then initialize and run a separate instance:

```sh
node dist/security-main.js init --data-dir tmp/qa-security
node dist/security-main.js serve --port 3007 --data-dir tmp/qa-security
```

Keep that terminal open. In another terminal, set `GUARDIAN_UI_URL=http://127.0.0.1:3007` and `GUARDIAN_UI_TOKEN_FILE` to the absolute `tmp/qa-security/admin-token.txt` path, then:

```sh
npm run test:ui
```

The harness expects Microsoft Edge to be installed. It creates synthetic findings and QA systems, visits the main pages, verifies project editing/save/reopen/export and tests scan proposal/rejection when supported. Screenshots are written to ignored `tmp/security-ui-qa`. The token remains inside the test process.

Use an isolated administrator credential only for this trusted verification process. External assistant integrations must use separately enrolled scoped credentials.

The save-picker test replacement checks user activation, cancellation and file content; it cannot validate an operating-system window. Manually verify native dialogs when their behavior changes. Review [known issues](../KNOWN-ISSUES.md) when interpreting results.

## Check the entire workflow

- **Projects/editor:** import a real-format fixture, edit nodes/edges, preserve nested context, save a revision, reopen and compare exports. Include conflicting revisions and cancelled navigation.
- **GRC:** sync assets/connections, link selected diagram nodes to a risk, import controls, record applicability/evidence, create an assessment and export reports. Follow [GRC workflows](GRC-WORKFLOWS.md).
- **Authorization:** verify allowed and denied operations, project restrictions, credential expiration/revocation and administrative audience separation.
- **Collectors:** verify recorded evidence, job results and explicit incomplete coverage. A scan request is not a completed scan.
- **AI:** use a configured real provider for authorized model acceptance, including cancellation and provider errors. Keep model tests separate from deterministic fixture tests.
- **Federation/cloud:** use a real Entra tenant or enrolled AWS account for customer acceptance. Do not infer account access from passing mocks.

Current operations use `POST /api/v1/operations`; `GET /api/v1/operations` exposes the credential's allowed schemas. Activity and Findings show the service's recorded outcomes. See [MCP testing](MCP-TESTING-GUIDE.md) for assistant transport checks.

## Platform and package verification

The developer launchers are `scripts/start-security-windows.ps1` and `scripts/start-security-unix.sh`. They never terminate another Guardian instance. Windows accepts `-StartOnly`; Unix accepts `--start-only` after a build. Use a separate port/data directory during regression work.

`npm run test:production` must run through npm so it can locate the npm CLI. Packaging tests are not a substitute for launching the produced package on actual Windows and macOS hosts. See [SECURITY-PACKAGING.md](SECURITY-PACKAGING.md).

Before handoff, state which checks passed, what remains untested, and whether the running backend includes the changes. Do not restart a live operator process implicitly.
