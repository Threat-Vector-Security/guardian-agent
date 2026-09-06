# Assistant verification runbook

Use this runbook to verify the current Guardian security workspace. Keep test data separate from the operator's normal installation, and report exactly which paths were exercised.

## Build and deterministic checks

Run from the repository root with Node.js 24.14 or later:

```sh
npm ci
npm run check
npm run test:security-workspace
npm run build
```

Run focused tests while fixing a specific behavior, then the full `npm test` suite before a release handoff. Compilation and a listening port alone do not prove functionality.

## Start an isolated preview

Choose an unused loopback port and a scratch directory:

```sh
node dist/security-main.js init --data-dir tmp/qa-security
node dist/security-main.js serve --port 3007 --data-dir tmp/qa-security
```

Run the service in a separate terminal. Do not stop or replace the operator's existing process. Open `http://127.0.0.1:3007`. Initialization prints the private credential file location; do not print its contents in logs or reports.

Core startup does not require an AI key. Enable provider tests only when a configured provider and the intended data transfer are authorized.

## Browser acceptance

Use `GUARDIAN_UI_URL` and `GUARDIAN_UI_TOKEN_FILE` for the isolated preview, then run `npm run test:ui`. The current harness uses installed Microsoft Edge through Playwright. It does not install a browser or restart the backend.

The harness creates QA projects/findings, visits the main workspace pages, exercises editor saves/exports and rejects a scan proposal when supported. Inspect its result and screenshots under `tmp/security-ui-qa`.

Supplement it with a few real interactions:

- Open an example; add/edit nodes and connections; save, reopen and compare the exported project.
- Run the [diagram/GRC workflow](GRC-WORKFLOWS.md), including assets, a linked risk, controls, an assessment and report export.
- Check a failed or cancelled save and unsaved-change navigation.
- Inspect collection jobs and their coverage/errors; do not equate partial observations with complete protection.

The unattended save-picker stub validates activation and generated content. An actual operating-system save dialog needs manual acceptance; do not report the stub as testing that dialog.

## API and MCP acceptance

Use the [MCP testing guide](MCP-TESTING-GUIDE.md) with a separate scoped credential. Guardian's current API is `/api/v1/operations`; retrieve its authorized schemas instead of guessing operation arguments.

For collection tests, request a supported observation job, inspect it in Activity and verify its terminal or reported scan state. Keep scan proposal/rejection testing separate from authorization to execute a real scan.

Test Entra sign-in and AWS collection only in the intended tenant/account with appropriate authorization. Fixtures do not replace those acceptance tests.

## Packaging and handoff

Run `npm run test:package` and `npm run test:production` after packaging/startup changes. Run the produced package on each target operating system before claiming platform acceptance.

Record commands, pass/fail results, browser/platform, data directory, screenshots and untested capabilities. Identify whether the backend was restarted and which process remains active. Keep credentials and real environment contents out of committed evidence. Consult [known issues](../KNOWN-ISSUES.md) and leave unresolved limitations explicit.
