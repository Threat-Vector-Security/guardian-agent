# Prepublication review — 6 September 2026

## Credential scan scope

Used Gitleaks 8.30.1, downloaded from its official GitHub release and verified
against the published SHA-256 checksum. Scans used default detection rules,
100% output redaction and ignored in-source `gitleaks:allow` comments.

- Staged conversion: approximately 17 MB scanned; no detections.
- Complete proposed tracked tree: 2,532 files, approximately 39 MB scanned.
  Seventy initial detections were reviewed: 69 intentional test fixtures or
  documentation placeholders, plus one copied vendor preview-token example.
  The latter was replaced with `YOUR_PREVIEW_TOKEN`; its validity was not tested.
- Existing Git history: 734 commits, approximately 34 MB of historical changes,
  92 detections. Twenty-two are duplicated historical local test-run tokens in
  eleven March test reports. Those reports no longer occur in the current tree.
  They are not provider API keys. The scanner did not establish whether any old
  local test process still accepts them; no credential was exercised or sent to
  a provider for validation.

The index contains no runtime databases, admin-token files, environment files,
HAR captures, runtime logs, generated build output or local Guardian state.
The user's preview token, database and compiled assets remain ignored. Raw
credentials were not included in the review output. Redacted scanner output and
triage evidence remain in ignored `tmp/publish-scan/`.

This is a focused credential/publication review, not a new exhaustive security
audit or a guarantee that every possible secret format is detectable. No public
history rewrite or force push was performed.

## Other corrections

- Corrected environment-map navigation to read the actual project from the
  `projects.import` response envelope. Two focused real-service tests cover
  callback and hash navigation; frontend build and typecheck passed.
- Added IBM artwork attribution and kept ContextCypher/dataset notices in the
  production package.
- Preserved the original public application as annotated tag and GitHub release
  `v1.0.0`, resolving to `5ac3a501fb878ea154836680fd398c195230e9ec`.

## Restricted dataset exclusion

Bundled IEC publication text requires redistribution permission under the
[IEC copyright terms](https://webstore.iec.ch/copyright). The copied CSA CCM
dataset also lacks a recorded redistribution grant; see
[CSA's CCM licensing information](https://cloudsecurityalliance.org/research/cloud-controls-matrix).
Application Apache-2.0 licensing does not relicense third-party framework text.
The owner explicitly requested exclusion of these two datasets from the public
repository and release. Local CSV/XLSX imports and existing workspace records
remain supported. The excluded files are retained only in ignored local scratch
storage, not staged or committed.

All 92 historical detections were triaged without exercising credentials:
11 intentional test fixtures, 58 vendor documentation placeholders, one vendor
preview-token example, and 22 occurrences of historical per-run harness tokens.
No provider credential belonging to this workspace was identified. Existing
public history is retained, including the original archive release.

## Final publication checks

The final index contains 2,532 files. Rescanning the 16.85 MB staged conversion
found no detections. Scanning the full proposed tree left only the 69 confirmed
fixtures/placeholders; scanning the rebuilt 10.72 MB frontend found no detections.
Both excluded dataset paths are absent from the index, and neither dataset has a
chunk in the clean frontend build. Build and frontend typecheck passed.
The final full test suite passed: 4,269 tests across 355 files.

## Expanded dependency audit before the initial release

The production-only audit was insufficient for this repository because browser
libraries and build tooling are installed as development dependencies. A full
audit identified 48 dependency advisories, including three critical build/tool
dependency findings; this is not a claim that all advisories were reachable in
the running application.

Updated exact dependency pins and compatible transitive dependencies, including
Axios, DOMPurify, Lodash, js-yaml, Vite, Vitest, tsx and the retained Daytona SDK.
Both the full dependency audit and production-only audit now report zero
advisories. The dependency contract passes. CI now audits the complete dependency
graph, including browser libraries and build tools.

Daytona's lazy listing API now consumes one result during connection testing so
authentication errors are observed and enumeration closes promptly. A focused
test covers authentication success/failure and iterator disposal. The production
smoke harness also uses bounded native filesystem retries for transient Windows
cleanup locks; application assertions are unchanged. CI branch filtering avoids
duplicate runs for a branch and tag pointing to the same commit.

The already-pushed `v2.0.0-alpha.1` tag remains an unpublished preflight snapshot.
The first published security-workspace release is `v2.0.0-alpha.2` with these
dependency corrections; no published tag or public history was rewritten.

Verification after dependency updates: 4,270 tests across 355 files passed, both
typechecks and the frontend build passed, and clean-install/packaging checks
passed. Actual Edge export checks produced all eight supported diagram formats.
