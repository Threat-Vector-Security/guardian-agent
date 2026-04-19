# Risk Assessments Capability Implementation Plan

**Status:** Revised draft  
**Date:** 2026-04-09

## Primary References

Internal:

- `docs/guides/CAPABILITY-AUTHORING-GUIDE.md`
- `docs/design/WEBUI-DESIGN.md`
- `docs/design/TOOLS-CONTROL-PLANE-DESIGN.md`
- `docs/design/SKILLS-DESIGN.md`
- `docs/architecture/OVERVIEW.md`
- `src/search/document-parser.ts`
- `src/tools/executor.ts`
- `src/channels/web-runtime-routes.ts`
- `src/channels/web-types.ts`
- `web/public/index.html`
- `web/public/js/app.js`

External methodology and adjacent-tool references:

- NIST SP 800-30 Rev. 1, Guide for Conducting Risk Assessments: https://csrc.nist.gov/News/2012/NIST-Special-Publication-800-30-Revision-1
- CISA Cyber Assessments overview: https://www.cisa.gov/resources-tools/resources/cyber-assessments
- OWASP Threat Dragon: https://owasp.org/www-project-threat-dragon/
- OWASP `pytm`: https://github.com/OWASP/pytm
- Threagile: https://github.com/Threagile/threagile
- OpenRMF OSS: https://www.openrmf.io/

## Goal

Build a Guardian-native `Risk Assessments` capability as a standalone WebUI surface and assistant capability so operators can:

- create and manage isolated assessment workspaces
- ingest local documents, pasted notes, and structured assessment inputs
- choose a shipped reference pack and scoring model, then customize it within bounded schemas
- generate structured risk registers, summaries, treatment plans, and exportable reports
- use the capability from the WebUI first, with assistant tools and skill support as an additive path

This capability is **not** part of Assistant Security, threat intel, security alerts, or any defensive-security workflow. It is a separate productivity capability that happens to live inside Guardian.

## Product Boundary

- The feature owns its own page and route in the WebUI, for example `#/risk-assessments`, rather than living under `Security`.
- The feature must not depend on `security_task`, threat-intel routing, Assistant Security, security findings, or security dashboard callbacks.
- Normal Guardian architecture still applies: tool policy, approvals, shared blocked-work orchestration, audit, and dashboard callback patterns remain the control plane.
- The primary operator experience is the WebUI page. The chat panel can drive the same underlying tools and runtime services, but chat is not the only usable workflow.
- The shipped experience must be organization-neutral. No organization branding, no organization-specific scales, and no runtime dependency on any external workspace.
- The runtime must treat each assessment as isolated durable state. No implicit writeback into global memory and no cross-assessment evidence bleed.

## Capability Shape

Per `docs/guides/CAPABILITY-AUTHORING-GUIDE.md`, this should be implemented as:

- a dedicated runtime module family under `src/runtime/risk-assessment/`
- a built-in tool family under `src/tools/builtin/`
- one dedicated skill bundle under `skills/risk-assessment-workbench/`
- a dashboard/control-plane surface via `src/channels/web-runtime-routes.ts`, `src/channels/web-types.ts`, and a dedicated callback module
- optional assistant jobs only for bounded long-running ingestion or export work

Decisions for v1:

- **No dedicated direct intent route by default.** Keep this capability in the normal tool loop with deferred discovery and a dedicated skill. Only add a direct route later if routing traces show repeated failure and the normal tool loop is not sufficient.
- **No bespoke resume model.** Use shared pending-action and shared response metadata for approvals, missing inputs, export prerequisites, or clarification.
- **No durable memory writer by default.** Persist assessments in the owning runtime store, not in global memory.
- **Deferred tool loading is the default.** Do not put the risk-assessment tool family into the always-loaded set unless there is a proven architectural reason.

## Default Inputs, Models, And Outputs

### Required assessment inputs

Each assessment record should support:

- assessment title and short objective
- assessment type: `generic`, `technology`, `privacy`, `vendor`, `project`, or `custom`
- scope statement and exclusions
- assets, processes, systems, vendors, or projects in scope
- stakeholders and owners
- source artifacts: uploaded files, pasted notes, URLs copied in as notes, and manual evidence entries
- chosen methodology pack and scoring model
- optional custom categories, labels, and treatment statuses
- assumptions, constraints, and open questions

### Shipped reference packs

Ship neutral packs that can be customized per assessment:

- `generic-business`
  - broad operational, financial, compliance, people, reputation, and delivery risk prompts
- `technology-system`
  - system, integration, identity, resilience, data, and dependency prompts
- `privacy-data`
  - data collection, minimization, access, retention, disclosure, and rights-handling prompts
- `vendor-third-party`
  - dependency, concentration, continuity, contractual, and assurance prompts
- `project-change`
  - schedule, resourcing, quality, rollout, dependency, and operational change prompts

These packs should live in the skill bundle as reviewed references and templates, not in hard-coded prompt strings.

### Default scoring models

Ship two neutral built-in matrices and keep the schema open for bounded customization.

#### Fast 3x3 Matrix

Likelihood scale:

- `Low`
- `Medium`
- `High`

Impact scale:

- `Low`
- `Medium`
- `High`

Default matrix:

| Likelihood \ Impact | Low | Medium | High |
|---|---|---|---|
| Low | Low | Low | Moderate |
| Medium | Low | Moderate | High |
| High | Moderate | High | Critical |

#### Standard 5x5 Matrix

Likelihood scale:

| Score | Label |
|---|---|
| 1 | Rare |
| 2 | Unlikely |
| 3 | Possible |
| 4 | Likely |
| 5 | Almost Certain |

Impact scale:

| Score | Label |
|---|---|
| 1 | Insignificant |
| 2 | Minor |
| 3 | Moderate |
| 4 | Major |
| 5 | Severe |

Scoring rule:

- `score = likelihood * impact`

Default rating bands:

| Score band | Rating |
|---|---|
| 1-4 | Low |
| 5-9 | Moderate |
| 10-15 | High |
| 16-25 | Critical |

#### Supporting assessment fields

Each risk item should also support:

- inherent risk
- existing controls
- residual risk
- confidence rating: `Low`, `Medium`, `High`
- treatment decision: `accept`, `monitor`, `mitigate`, `transfer`, `avoid`
- owner and due date

### Default risk register template

The runtime should produce a structured register with these columns:

| Field | Purpose |
|---|---|
| `id` | stable risk identifier |
| `title` | short risk name |
| `category` | neutral or pack-specific grouping |
| `assetOrProcess` | what is affected |
| `scenario` | concise risk statement |
| `causes` | drivers or contributing factors |
| `existingControls` | current mitigations |
| `likelihood` | selected scale value |
| `impact` | selected scale value |
| `inherentRating` | calculated rating before added treatment |
| `residualRating` | calculated rating after control assumptions |
| `confidence` | evidence confidence |
| `treatmentPlan` | recommended or selected action |
| `owner` | accountable person/team |
| `targetDate` | action date |
| `evidenceRefs` | citations to uploaded or manual evidence |
| `notes` | operator comments |

### Default report output package

Every completed run should be able to emit:

- `assessment.json`
  - canonical structured record for re-open/edit/export
- `risk-register.csv`
  - flat register for spreadsheet workflows
- `report.md`
  - canonical narrative draft
- `report.docx`
  - primary formatted export
- optional `report.pdf`
  - Windows-only or library-backed export path when available
- `evidence-index.json`
  - citation map and source metadata

Default report sections:

1. Executive summary
2. Purpose, scope, and methodology
3. Assumptions and constraints
4. In-scope assets, systems, processes, or vendors
5. Key findings
6. Risk matrix and scoring model used
7. Detailed risk register
8. Recommended treatments and priorities
9. Residual risk summary
10. Evidence and references appendix

## Adjacent Open-Source Landscape

These projects are relevant inspiration, but none is a clean drop-in fit for Guardian’s WebUI-first, tool-governed capability:

| Project | Relevant idea | Why not adopt directly |
|---|---|---|
| OWASP Threat Dragon | visual threat modeling, reusable templates, report output | centered on threat-model diagrams, not a general customizable risk-assessment workbench |
| OWASP `pytm` | model-as-code plus report generation | Python-centric and developer-authored, not a general WebUI operator workflow |
| Threagile | YAML-based model, automated rule execution, JSON/Excel/PDF outputs | strong for threat-model-as-code, but too security-model specific for a generic assessment tool |
| OpenRMF OSS | multi-user risk/compliance workflow, exports, audit patterns | opinionated compliance product with its own domain model and deployment surface |

Assessment of open-source “skills”:

- I found adjacent community-published risk-assessor skills in agent-skill marketplaces, but they are mostly thin instruction bundles.
- They do not provide Guardian-native storage, scoring, approvals, WebUI control-plane contracts, or policy integration.
- Recommendation: build the Guardian skill bundle ourselves and only borrow template ideas, not runtime behavior.

## Acceptance Gates

- A dedicated `Risk Assessments` page exists in the WebUI with its own ownership defined in `docs/design/WEBUI-DESIGN.md`.
- Operators can create an assessment, add evidence, generate a register, review scoring, and export results without leaving Guardian.
- The feature remains decoupled from Assistant Security, threat intel, alert queues, and security dashboard flows.
- Assessments are isolated durable records with feature-local evidence stores and no implicit global memory writeback.
- Guardian exposes built-in risk-assessment tools plus at least one dedicated skill bundle for agentic use.
- The scoring engine is deterministic and schema-driven. The LLM may draft and summarize, but it must not be the source of truth for arithmetic or required-field validation.
- The report/export path emits neutral output artifacts and does not depend on branded external templates.
- New page, API, tool, and harness coverage prove the create -> ingest -> draft -> validate -> export path.

## Existing Checks To Reuse

- `npm run check`
  - validates shared contracts across runtime, tools, and web routes
- `npm test`
  - catches shared regressions before narrower harnesses
- `src/search/document-parser.test.ts`
  - closest existing proof surface for file ingestion and parsing
- `src/tools/executor.test.ts`
  - approval, policy, and tool-execution coverage
- `src/skills/*.test.ts`
  - skill resolution and prompt-material coverage if the new bundle changes skill selection behavior
- `scripts/test-coding-assistant.mjs`
  - relevant if assistant tool discovery or workflow execution changes
- `scripts/test-code-ui-smoke.mjs`
  - nearest existing WebUI smoke pattern for a multi-step workspace flow

New checks to add:

- `src/runtime/risk-assessment/*.test.ts`
- `src/runtime/control-plane/risk-assessment-dashboard-callbacks.test.ts`
- `scripts/test-risk-assessment-ui-smoke.mjs`
- `scripts/test-risk-assessment-assistant.mjs`

## Files / Areas Affected

- `docs/design/WEBUI-DESIGN.md`
- new `docs/design/RISK-ASSESSMENTS-DESIGN.md`
- `web/public/index.html`
- `web/public/js/app.js`
- new `web/public/js/pages/risk-assessments.js`
- `web/public/js/api.js`
- `web/public/css/style.css`
- `src/channels/web-types.ts`
- `src/channels/web-runtime-routes.ts`
- new `src/runtime/control-plane/risk-assessment-dashboard-callbacks.ts`
- new `src/runtime/risk-assessment/`
- new `src/tools/builtin/risk-assessment-tools.ts`
- `src/tools/types.ts`
- `src/tools/executor.ts`
- `src/index.ts`
- new `skills/risk-assessment-workbench/`
- `src/reference-guide.ts`
- new harnesses under `scripts/`

## Tasks

### Task 1: Define The Standalone Capability Boundary

- files:
  - `docs/design/WEBUI-DESIGN.md`
  - new `docs/design/RISK-ASSESSMENTS-DESIGN.md`
- change:
  - define `Risk Assessments` as its own WebUI domain and route
  - define page ownership, intro/help patterns, and left-nav placement
  - explicitly forbid coupling to `Security`, `security_task`, threat intel, and defensive-security flows
  - define which workflows are page-first and which are assistant-additive
- acceptance gates:
  - the product boundary is explicit enough that the implementation does not drift back into Security or ad hoc chat-only behavior
- verification:
  - spec review against `docs/guides/CAPABILITY-AUTHORING-GUIDE.md` and `docs/design/WEBUI-DESIGN.md`

### Task 2: Build The Core Domain Model And Isolated Storage

- files:
  - new `src/runtime/risk-assessment/types.ts`
  - new `src/runtime/risk-assessment/store.ts`
  - new `src/runtime/risk-assessment/service.ts`
  - tests under `src/runtime/risk-assessment/*.test.ts`
- change:
  - define typed records for assessments, sources, risks, matrices, outputs, and run history
  - store each assessment under a feature-local path such as `~/.guardianagent/risk-assessments/<assessment-id>/`
  - separate `inputs/`, `working/`, `outputs/`, and `audit/`
  - keep the feature out of global memory writeback unless a future explicit design says otherwise
- acceptance gates:
  - assessments can be created, resumed, exported, and deleted independently
  - cross-assessment evidence bleed is structurally difficult
- verification:
  - CRUD tests
  - storage-layout and isolation tests

### Task 3: Add Guardian-Owned Reference Packs, Templates, And Output Schemas

- files:
  - new `skills/risk-assessment-workbench/SKILL.md`
  - new `skills/risk-assessment-workbench/skill.json`
  - new `skills/risk-assessment-workbench/references/*`
  - new `skills/risk-assessment-workbench/templates/*`
  - optional `skills/risk-assessment-workbench/examples/*`
- change:
  - add neutral reference packs, scoring definitions, report templates, and example outputs
  - ship versioned JSON or YAML definitions for the 3x3 and 5x5 scoring models
  - add a canonical report template and risk-register schema
  - keep all content Guardian-owned and organization-neutral
- acceptance gates:
  - the capability can run with no dependency on external workspace paths or organization-specific assets
  - prompt-time guidance can drill into reviewed packs instead of bloating the top-level skill
- verification:
  - skill bundle load tests
  - template schema validation tests

### Task 4: Reuse Guardian Parsing For Evidence Ingestion

- files:
  - `src/search/document-parser.ts`
  - new `src/runtime/risk-assessment/ingestion.ts`
  - new `src/runtime/risk-assessment/evidence-index.ts`
  - optional `package.json` updates
- change:
  - reuse Guardian’s document parsing for `.txt`, `.md`, `.html`, `.pdf`, and `.docx`
  - build a feature-local evidence index with citations and snippet references
  - support manual notes and pasted text as first-class evidence
  - avoid the global search corpus unless access is explicitly namespaced by assessment id
- acceptance gates:
  - evidence is searchable and citable only within the owning assessment
- verification:
  - ingestion tests covering text, PDF, DOCX, truncation, and citation extraction

### Task 5: Implement The Deterministic Scoring And Validation Engine

- files:
  - new `src/runtime/risk-assessment/matrix.ts`
  - new `src/runtime/risk-assessment/scoring.ts`
  - new `src/runtime/risk-assessment/validation.ts`
  - new `src/runtime/risk-assessment/templates.ts`
- change:
  - encode the default matrices as data, not prose
  - validate required fields before report generation
  - calculate inherent and residual ratings deterministically
  - allow bounded per-assessment customization through schema-validated matrix definitions
- acceptance gates:
  - the same inputs always produce the same rating
  - invalid combinations are rejected before export
- verification:
  - pure unit tests for scoring and validation
  - fixture tests for both shipped matrix models

### Task 6: Add Built-In Tools And A Dedicated Skill Bundle

- files:
  - new `src/tools/builtin/risk-assessment-tools.ts`
  - `src/tools/types.ts`
  - `src/tools/executor.ts`
  - `src/index.ts`
  - `skills/risk-assessment-workbench/*`
- change:
  - add built-in tools for create/list/get/update, evidence ingestion, draft generation, scoring, validation, and export
  - keep the tool family deferred by default and discoverable via `find_tools`
  - add a skill that teaches the assistant how to run a bounded `collect -> extract -> draft -> validate -> export` workflow
  - do not add a dedicated direct intent route in v1
- suggested tool set:
  - `risk_assessment_create`
  - `risk_assessment_list`
  - `risk_assessment_get`
  - `risk_assessment_update`
  - `risk_assessment_add_source`
  - `risk_assessment_extract_evidence`
  - `risk_assessment_generate_register`
  - `risk_assessment_score`
  - `risk_assessment_validate`
  - `risk_assessment_export`
- acceptance gates:
  - the assistant can execute the capability via tools plus skill guidance
  - all side effects stay inside the normal ToolExecutor and audit path
- verification:
  - tool registrar tests
  - executor approval/policy tests
  - skill resolver and prompt-material tests

### Task 7: Add The WebUI Page And Runtime Callback Surface

- files:
  - `web/public/index.html`
  - `web/public/js/app.js`
  - new `web/public/js/pages/risk-assessments.js`
  - `web/public/js/api.js`
  - `web/public/css/style.css`
  - `src/channels/web-types.ts`
  - `src/channels/web-runtime-routes.ts`
  - new `src/runtime/control-plane/risk-assessment-dashboard-callbacks.ts`
  - `src/index.ts`
- change:
  - add a dedicated page, nav item, and route
  - expose list/detail/create/update/export endpoints through `web-runtime-routes`
  - follow the WebUI guidance standard: page intro, section help, clear ownership, bounded tables/forms
  - make the page the primary operator workflow rather than a thin shell over chat
- acceptance gates:
  - users can complete the end-to-end workflow entirely in the WebUI
  - the page does not create a duplicate control plane under `Security`
- verification:
  - route and callback tests
  - WebUI smoke harness

### Task 8: Implement Neutral Report Rendering And Export

- files:
  - new `src/runtime/risk-assessment/report-renderer.ts`
  - new `src/runtime/risk-assessment/exporter.ts`
  - optional Windows-specific adapter if needed
  - optional tests under `src/runtime/risk-assessment/*.test.ts`
- change:
  - render structured assessment data into Markdown, CSV, JSON, and DOCX outputs
  - keep the template neutral and operator-editable
  - add optional PDF export behind a bounded adapter when available
  - record export failures explicitly and preserve the structured assessment even if one export format fails
- acceptance gates:
  - `.docx` generation is reliable
  - `.pdf` is additive, not a blocker for the feature
- verification:
  - export fixture tests
  - Windows-only smoke test when PDF support exists

### Task 9: Test, Document, And Roll Out

- files:
  - `src/reference-guide.ts`
  - new harnesses under `scripts/`
  - docs/spec updates as needed
- change:
  - document the page, workflow, inputs, templates, and export behavior
  - add harnesses for page flow and assistant flow
  - stage rollout behind a feature flag if the nav/spec change needs a softer launch
  - document customization boundaries for packs, matrices, and templates
- acceptance gates:
  - operators can discover and use the feature without source-diving
- verification:
  - docs review plus green tests and smoke harnesses

## Risks / Open Questions

- Adding a new first-class WebUI page requires an explicit update to `docs/design/WEBUI-DESIGN.md`. Do that intentionally rather than sneaking in a new nav item.
- Decide whether PDF export is worth v1 complexity or should remain a later additive adapter.
- Decide how much matrix customization to expose in v1. A bounded schema editor is safer than arbitrary logic.
- Uploaded source artifacts may contain secrets or sensitive personal data. The design should explicitly define storage, redaction expectations, and export behavior.
- Long-running extraction or export should only use assistant jobs when needed. Do not create a second hidden assistant.
- Diagramming may still be valuable later, but it should be a phase-2 enhancement, not a prerequisite for shipping the core capability.

## Recommendation

Build this as a Guardian-native capability from first principles:

- own runtime service
- own WebUI page
- own built-in tools
- one dedicated skill bundle
- neutral shipped reference packs and templates

Borrow ideas from adjacent open-source projects, but do not adopt an external product or thin marketplace skill as the core implementation.
