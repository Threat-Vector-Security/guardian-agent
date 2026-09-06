# Guardian Agent security application contract

**Scope:** Current security application, inspected 6 September 2026. This documentation revision records implemented boundaries and unresolved acceptance gaps; it does not add or repair application behavior.

Guardian combines local security observations with a standalone ContextCypher editor, built-in security AI and GRC workflows. HTTP, CLI and MCP clients share one application service. External assistant applications are optional. The [architecture overview](OVERVIEW.md) contains the current system diagram; the [current scope and acceptance gaps](OVERVIEW.md#current-scope-and-acceptance-gaps) records the implemented scope and unresolved work.

## Application and transport boundary

`src/security-main.ts` composes `SecurityStore`, `SecurityWorkspace`, the configured collectors and the loopback HTTP server. `operations.ts` declares operation schemas and scopes; `service.ts` validates the current principal, audience and resource authority before dispatch. CLI and MCP adapters translate the same contracts. Explicit UI buttons invoke structured operations; they are not natural-language intent classifiers.

Administrative browser sessions carry the administrator audience. Assistant bearer credentials have scopes, expiry and revocation; they cannot approve their own response requests, enroll clients or change administrative policy. A durable native-scan proposal binds its target and arguments before a separate administrative decision. Interrupted operations are recorded without blindly replaying side effects.

Local browser access is code-free by default. The frontend obtains an HttpOnly session through a same-origin JSON bootstrap with exact Host/Origin and Fetch Metadata checks. Administrators may require access-token sign-in; configured Entra enforces sign-in. Changes to the preference invalidate convenience sessions through a revision check. Machine bearer authorization remains required. This convenience mode trusts local processes capable of imitating the browser bootstrap; it is not an OS privilege boundary.

## State ownership

SQLite owns project envelopes, findings, jobs, client grants, collector records, preferences and audit events. Project mutations and their audit events commit together. **Live browser sessions are in a process-local Map**, not SQLite, and are lost on restart. AI provider API keys configured in the UI also remain in process memory; non-secret provider/model preferences may persist.

Persistence checks serialized byte limits, transaction-visible aggregate/per-kind quotas and free filesystem reserve before writes. Evidence has recursive complexity limits. Project listings use SQL metadata projection; finding/audit pagination uses stable cursors. Audit hash linkage provides local consistency evidence, not an external trust anchor.

The frontend edits a draft of a backend revision. Saving uses the expected revision and retains the draft if a conflict occurs. Backend raw-content imports preserve original bytes in an immutable envelope. **The workbench JSON-upload path currently parses and serializes the file before submitting it**, so that path does not preserve its original whitespace/BOM. See [ContextCypher migration](CONTEXT-MIGRATION.md) for this unresolved fidelity gap.

## Standalone security and modelling

The seven-page browser shell is **Protection, Environments, Findings, Systems, Activity, Integrations, Settings**. Systems hosts the restored ContextCypher examples, typed editor, security analysis and GRC modules. GRC domain edits live in the current project draft and persist through the shared revision boundary. Credentials without project-write permission currently receive a reduced read-only renderer; equivalent rendering of mature diagrams remains unfinished.

`ai.ts` uses the configured provider boundary for bounded chat, analysis, generation and assessment requests. Provider discovery/configuration is administrative; invocation and cancellation use their declared scopes and request ownership. AI output is untrusted, checked and presented as a response or proposal. `ai.run` does not execute arbitrary tools or automatically commit project changes.

Host/native collectors report available, degraded, unavailable or unsupported coverage. Windows Defender scan requests are distinct from scan completion. AWS enrolls one explicit account/region and verifies STS identity before bounded read-only collection. Environment previews map passive neighbor-cache entries or EC2/security-group associations into editable snapshots. They do not establish complete inventory, physical topology or reachability.

Entra sign-in does not provide Azure/Microsoft 365 discovery. Active LAN probing, wider cloud/identity inventory, automatic discovery reconciliation, autonomous defensive workflows, proprietary response adapters and managed fleets require additional implementation and acceptance. There is no kernel EDR or universal enforcement over software outside Guardian.

## Distribution and verification

Distribution has two executable-code surfaces: the compiled backend dependency closure and the built browser workbench/assets. Frontend libraries can be listed in `devDependencies` and still ship inside browser bundles. Audit **all dependencies** as well as the production installation; backend pruning alone cannot establish distribution safety.

The package preserves application/framework notices. CSA CCM and IEC 62443 datasets are excluded from the bundled catalogue/build; users' permitted imported control sets remain supported. Dataset and vendor-artwork notices describe their own terms and do not inherit the application's license automatically.

Verification includes backend/frontend type checks and build, security/operation tests, import/export and conflict handling, isolated production smoke tests and actual browser workflows. Cross-platform CI establishes only the checks it executes. Native Mac behavior and actual AWS/Entra/customer integrations need explicit environment acceptance. Signed installers/services, updates and enterprise management have their own gates.

Use capability evidence rather than elapsed-time estimates as release gates. Retire or replace code only after the corresponding user workflows pass acceptance; a documentation update is not proof of feature parity.
