# Coding Assistant Verification Design

## Ownership Boundary

Guardian's coding-assistant supervisor owns orchestration, retry policy, evidence checks, progress events, and honest failure reporting. It must not own application implementation.

Delegated workers own all repo deliverables: source files, stylesheets, sample data, application-specific verification scripts, and final app behavior. A supervisor recovery path may provide extra context or retry directives, but it must not synthesize domain-specific code to make a run appear complete.

## Static App Proof

For dependency-free static apps, Guardian may create a temporary `.guardian-runtime-check-*.mjs` probe inside the target workspace. That probe is generic and must be removed after execution. Its scope is limited to:

- finding `index.html` or `public/index.html`
- validating local linked assets stay inside the workspace
- confirming linked assets load through a temporary localhost server
- checking linked JavaScript syntax with Node

The generic probe is not a substitute for app-specific UX proof. When the user asks for behavior such as search, navigation, playback controls, detail views, or visual state changes, the delegated worker must produce worker-owned evidence for those behaviors, either through browser tooling or a small project verification script that exercises the actual implemented selectors/state.

The task contract represents that stronger requirement with a `worker_owned_ux_evidence` planned-step category. Generic supervisor static load/syntax proof may satisfy `runtime_evidence`, but it must not satisfy `worker_owned_ux_evidence`.

## Missing Assets

If runtime proof fails because a static entrypoint links missing local assets, Guardian may add a retry section that names those missing assets and tells the worker to create them. Guardian must not fill in missing JavaScript, CSS, sample data, UI shells, or domain behavior itself.

## Regression Guard

The verifier and worker manager should fail loudly rather than hide incomplete work behind generated fallback code. Tests for this surface should assert that:

- supervisor recovery never writes app source files
- missing linked assets are corrected by delegated worker tool actions
- generic static proof reports only generic load/syntax evidence
- worker prompts require app-specific proof when the user requested app-specific behavior

## Related Contracts

- `docs/design/CODING-WORKSPACE-DESIGN.md` defines code-session ownership, external coding backend delegation, and repo-scoped execution.
- `docs/design/ORCHESTRATION-DESIGN.md` defines delegated-worker retry, recovery, verification, and graph-owned execution boundaries.
- `docs/guides/INTEGRATION-TEST-HARNESS.md` defines the focused Vitest and harness loops required for coding-assistant regression work.
