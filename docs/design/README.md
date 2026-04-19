# Design Docs

This directory is the technical design catalog for GuardianAgent.

It replaces the older `docs/specs` umbrella. In practice, most files here are internal engineering design documents, not external normative specifications.

## Recommended Taxonomy

- `docs/design/`
  Current technical design and as-built documents.
- `docs/guides/`
  Operator, developer, and testing runbooks.
- `docs/proposals/`
  Forward-looking proposals, RFC-style ideas, and pre-implementation direction.
- `docs/implemented/`
  Historical proposal-era documents whose core scope has shipped or whose current status now lives in `docs/design/`.
- `docs/plans/`
  Sequencing, rollout, remediation, and implementation plans.
- `docs/architecture/`
  Cross-cutting architecture boundaries, ownership, and system-shape guidance.
- `docs/reference/`
  API and subsystem reference material that is not itself a design or architecture contract.
- `docs/test-results/`
  Stored harness and verification-result artifacts.

## Naming Guidance

Industry-standard usage is usually:

- `proposal` or `RFC` for future changes under discussion
- `design` for internal technical design documents
- `as-built` for documents that describe what is actually shipped now
- `spec` for normative contracts, protocols, schemas, or externally constrained behavior

For this repo, `design` is the right umbrella term.

Use `as-built` as a subtype or status when a document is explicitly describing current shipped behavior.

Reserve `spec` for the smaller set of documents that truly need normative contract language.

## Documentation Rule

If a proposal is implemented and moved to `docs/implemented/`, it should link near the top of the file to its associated current design or as-built document in `docs/design/`.
