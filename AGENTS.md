# Repository Guidelines

## Current product and module ownership

Guardian Agent 2 is the local security and ContextCypher architecture workspace. The package version in `package.json` is the release source of truth. The default entry point is `src/security-main.ts`, compiled to `dist/security-main.js`; it does not start the retained assistant runtime in `src/index.ts`.

- `src/security-workspace/`: operation schemas and authorization (`operations.ts`), shared business rules (`service.ts`), loopback HTTP/session transport (`server.ts`), SQLite persistence (`store.ts`), CLI client/MCP transport, collectors, AWS, Entra and bounded AI.
- `web/security/`: Guardian shell and security pages. `web/contextcypher/`: the standalone-capable diagram, analysis and GRC workbench. `web/shared/`: shared browser file dialogs.
- `scripts/`: verification and packaging harnesses; `docs/`: current architecture, guides and explicitly marked historical material.
- `src/runtime/`, `src/guardian/`, `src/tools/`, `src/channels/`, `src/index.ts` and `web/public/` retain legacy implementation and selected shared components. Their existence does not mean their assistant features ship in the default security application.

Read [SECURITY.md](SECURITY.md), [the conversion architecture](docs/architecture/SECURITY-CONVERSION.md), [the operator guide](docs/guides/SECURITY-WORKSPACE.md), and [the operation API reference](docs/reference/GUARDIAN-API.md) before changing current trust boundaries or capabilities.

## No hardcoded deliverables or test-passing fallbacks (CRITICAL)

Never add canned domain output, fabricated findings, sample applications, scripted answers, or fallback implementations to make a requested workflow appear successful. Model generation must come from the configured provider; collection must report observed evidence and unavailable coverage honestly. Explicitly selected, bundled ContextCypher examples are legitimate product content, not fallback evidence or generated results.

For retained orchestration code, Guardian may route, retry, verify generic evidence and report failure; the delegated worker owns the actual implementation in the target workspace. If a test passes because Guardian recognizes a prompt, filename, selector set or expected answer and fills it in, remove the workaround and fix the owning contract.

## Branching (CRITICAL)

Do not create or switch branches unless the user explicitly asks. Stay on the current branch, including `main`.

## Build, test and development commands

Use Node.js at least the version required by `package.json` (currently 24.14.0).

- `npm ci`: install the reviewed root lockfile.
- `npm run init`: initialize the local administrator credential; prints its file path, not the token.
- `npm run dev`: run `tsx src/security-main.ts serve`; build the frontend when needed.
- `npm run build`: clean/prune the security backend output and build the frontend.
- `npm run build:backend` / `npm run build:web`: targeted builds.
- `npm start`: run the built local service.
- `.\scripts\start-security-windows.ps1` / `bash scripts/start-security-unix.sh`: current platform launch helpers; inspect their parameters before use.
- `npm run check`: type-check the current backend and frontend.
- `npm run test:security-workspace`: focused current service tests.
- `npm test`: full retained and current regression suite; `npm run test:coverage` adds coverage.
- `npm run test:production`: verify the production dependency/build boundary.
- `npm run test:ui`: current browser harness against an explicitly selected local service.
- `npm run validate:dependency-contract`, `npm run test:package`: dependency/packaging checks.
- `npm run package:windows` / `npm run package:macos`: portable packaging, not proof of native-platform acceptance or a signed installer.

Never put credentials in commands, tracked fixtures or test output. Prefer `GUARDIAN_TOKEN_FILE` for assistant clients; never give an assistant the administrator bootstrap file. Use isolated QA projects for browser tests. Do not change a user's provider configuration just to make tests pass.

## Runtime restart handoff (CRITICAL)

After backend/startup changes, backend builds, or configuration changes read only at startup, explicitly report whether the live backend was restarted and which command/process was used. If it was not restarted, state the exact restart action needed for those changes to become active. Current built entry: `node dist/security-main.js serve`, retaining the operator's existing port and data-directory options.

Do not restart a live process that could interrupt sessions, approvals, scans, AI requests or other active work without the user's authorization. Provider API keys are memory-only and are lost on restart. A frontend build and browser refresh do not require restarting the backend. Do not imply that built backend changes are active merely because compilation passed.

## Current security architecture discipline (CRITICAL)

All UI, CLI and MCP business actions go through the shared operation service. Add operation schemas and scopes in `operations.ts`, authorization and behavior in the owning service, and thin transport/UI callers. Do not add unauthenticated routes, browser-only authorization, direct database access from MCP, ad hoc provider config writes, or a second ContextCypher backend.

- Preserve separate administrative sessions and scoped assistant credentials. Administrative approval, enrollment, provider configuration and audit access must not become MCP tools.
- Preserve project grants, credential expiry/revocation, expected revisions and actor/target-bound approvals. Revalidate authority and project revisions before releasing long-running AI results.
- Imported findings, diagrams and model text are untrusted data. AI responses are proposals, never authority to execute actions.
- Preserve complete ContextCypher documents and unknown fields through import, edit, save and export. Report failed conversions; do not fabricate a replacement diagram.
- Report native scan requests separately from scan results; never claim an absence of findings proves the workstation clean.
- Keep provider secrets out of browser persistence, project documents, audit details and logs. Current provider keys live only in backend process memory.
- Preserve Windows/macOS capability reporting. Unsupported platform features and permission failures must remain visible.

Fix behavior in its owning layer. When multiple adapters, duplicated state, per-channel exceptions or compensating patches accumulate, pause and write a concise architecture note: current shape, root flaw, target ownership, migration, verification and obsolete layers to remove. Update relevant design documentation alongside an intentional architectural change.

## Retained source

When explicitly modifying retained v1 assistant source, also read its [archived contributor contract](docs/archive/previous/AGENTS.md). Its Intent Gateway, pending-action, tool-discovery and channel restrictions apply to that source, not to the current explicit operation API. Do not reactivate historical capabilities through current startup or packaging without an intentional, documented architecture change.

## Verification and coding style

Use strict TypeScript and ESM, 2-space indentation, semicolons, single quotes, and explicit `.js` extensions in backend relative imports. Match the imported frontend's existing conventions. Prefer pure helpers and isolated side effects.

Add or update meaningful tests for changed behavior. Run focused tests first, current type checks, and applicable integration/browser harnesses automatically. Use the full regression suite before release handoff; the retained suite does not by itself prove that a legacy capability ships in v2. Verify the actual browser-to-service-to-persistence flow for navigation, approvals, provider configuration, file dialogs and project changes; distinguish mocked boundaries from real provider/OS evidence.

Current focused browser harnesses include `scripts/test-security-environment-ui.mjs`, `scripts/test-security-project-routing-ui.mjs`, `scripts/test-security-autosave-ui.mjs` and `scripts/test-security-keyboard-ui.mjs`. Read each harness's configuration before running. Update startup scripts, packaging checks and brittle expectations when their owned behavior changes. Windows browser checks do not establish macOS acceptance.

## Documentation, commits and local data

Keep current operator guides in sync with user-visible behavior. Operator documentation explains UI/CLI workflows, not internal implementation or test traces. `src/reference-guide.ts` belongs to the retained assistant; update it when changing that source's user workflows. Keep historical documentation in the archive, not mixed into current product guidance.

Use Conventional Commit subjects when committing is authorized. PR descriptions explain the problem, final behavior, verification and relevant security/configuration impact; include screenshots for UI changes.

Root `package.json` and `package-lock.json` are the dependency source of truth. Generated staging manifests are not independent manifests. Never commit secrets, bearer tokens, provider keys, local configuration, runtime databases or personal collected evidence from `~/.guardianagent/`. Treat `tmp/` as scratch output unless deliberately adding a sanitized fixture.
