# Guardian LLM Knowledge Base Proposal

**Date:** 2026-04-13  
**Status:** Proposed  
**Origin:** Comparison of an LLM-maintained research wiki workflow against Guardian's current runtime, memory, search, and `Second Brain` surfaces.

## Executive Summary

Guardian is already much closer to this idea on runtime substrate than it is on finished product shape.

Rough gauge:

- **Infrastructure readiness:** high partial, roughly `60-70%`
- **End-user knowledge-base workflow:** early, roughly `20-30%`

What already exists is real:

- trust-aware durable memory with inspectable markdown plus sidecar metadata
- a web `Memory` surface with wiki pages, derived indexes, lint findings, and audit-visible maintenance
- a hybrid document-search engine with chunking, embeddings, reranking, and reindex tooling
- a `Second Brain` product surface with notes, contacts, library items, briefs, routines, and saved artifacts

What does **not** exist yet is the product loop described in the note:

- ingest a research corpus
- compile it into a maintained wiki
- ask complex questions against that corpus
- save outputs back as durable knowledge artifacts
- run integrity and discovery passes over the whole knowledge base

The main conclusion is:

**Guardian should not copy the loose-Obsidian-vault model as its authority layer.**  
It should build a **collection-backed knowledge plane** on top of the existing memory, artifact, search, and maintenance architecture.

That keeps the strengths Guardian already has:

- provenance
- trust/quarantine semantics
- bounded maintenance jobs
- audit visibility
- shared orchestration

## Current Comparison

| Workflow area | Target shape from the note | Guardian today | Assessment |
|---|---|---|---|
| Raw ingest | `raw/` corpus of articles, papers, repos, datasets, images | `doc_search` can index configured document sources; parser handles text, markdown, HTML, JSON, CSV, PDF, and DOCX; `directory` and `file` source types work today | **Partial** |
| Web/repo ingest | clipped articles, repos, external corpora as first-class sources | search source types include `git` and `url` in config types, but current indexing explicitly leaves those as future extension | **Weak partial** |
| Compiled wiki | LLM-maintained summaries, concept pages, backlinks, categories | Guardian has memory wiki pages and derived indexes, but those are built over durable memory, not over imported document collections | **Weak partial** |
| Q&A over corpus | ask complex questions against the wiki and have the agent research answers | Guardian has `doc_search`, `memory_search`, `memory_bridge_search`, and `Second Brain` retrieval, but no collection-aware research answer loop with explicit save-back behavior | **Partial** |
| Output artifacts | markdown reports, slide decks, plots, filed back into the wiki | Guardian can create markdown/plain documents and store briefs, but does not yet have first-class Marp, chart, or research-artifact families | **Weak partial** |
| Linting / health checks | inconsistency scans, missing-data checks, connection discovery, article suggestions | Guardian has bounded memory hygiene, memory lint findings, and audit-visible maintenance, but not corpus-wide knowledge integrity jobs | **Partial, but pointed at memory not research corpora** |
| Frontend / operator UX | Obsidian-like review of raw, compiled, and derived artifacts | Guardian has web `Memory`, `Second Brain`, and `Configuration > Search Providers`, but no vault-oriented research workflow or Obsidian interop | **Weak partial** |
| Extensibility | small search tools and CLIs that the LLM can use | Guardian is strong here: built-in tools, skills, automations, and shared approval/control-plane infrastructure already exist | **Strong** |

## What Guardian Already Has That Matters

These are the strongest existing building blocks:

1. **Memory artifact layer**
   - `src/runtime/agent-memory-store.ts`
   - `web/public/js/pages/memory.js`
   - Guardian already supports operator-curated wiki pages, derived topic and decision indexes, linked outputs, lint findings, and audit-visible maintenance around durable memory.

2. **Hybrid document retrieval**
   - `src/search/search-service.ts`
   - `src/tools/builtin/search-tools.ts`
   - `web/public/js/pages/config.js`
   - Guardian already has a real retrieval stack, not just prompt stuffing.

3. **Second Brain product shell**
   - `src/runtime/second-brain/*`
   - `web/public/js/pages/second-brain.js`
   - `Second Brain` already has a user-facing place where a knowledge product can live, especially through `Library`, `Briefs`, `Routines`, and settings under `Configuration > Second Brain`.

4. **Bounded maintenance architecture**
   - `src/runtime/automated-maintenance-service.ts`
   - `src/runtime/memory-mutation-service.ts`
   - Guardian already treats hygiene as runtime-owned maintenance work rather than hidden prompt magic. That is exactly the right architectural instinct for a knowledge compiler and knowledge linting system.

## The Core Gap

Guardian currently has **pieces** of this idea, but not the **loop**.

Today the loop is fragmented:

- imported documents live in search collections
- durable wiki-like material lives in Memory
- saved references live in `Second Brain > Library`
- generated artifacts live in briefs or generic filesystem output

The note describes one coherent product loop where those all feel like one system.

Guardian needs that loop, but it should implement it as:

- **collection-backed corpora**
- **derived knowledge artifacts**
- **bounded compile/lint jobs**
- **citation-backed answer/output workflows**

It should **not** implement it as:

- arbitrary loose markdown files becoming the canonical memory authority
- model-self-editing durable state without provenance or review boundaries
- ad hoc route hacks outside the Intent Gateway and shared orchestration model

## Recommended Product Position

The best fit is:

**Build this as a Guardian-native knowledge plane spanning `Second Brain > Library` and `Memory`, not as a separate Obsidian clone and not as a second free-form memory system.**

Recommended ownership split:

- **Collections / corpus ingest:** `Second Brain > Library`
- **Compiled pages / derived artifacts / lint reports:** `Memory` artifact layer plus linked `Second Brain` artifacts
- **Search and retrieval:** existing `src/search/`
- **Compile, refresh, and lint work:** shared maintenance jobs and assistant tasks
- **Saved outputs:** first-class knowledge artifacts with provenance, not generic loose files only

## Recommended Blips

### 1. Collection-Backed Library

Turn `Library` from a saved-link list into a real corpus surface.

Deliver:

- collection records, not just individual link records
- collection types for local folders, local files, clipped article folders, and imported corpora
- index status, last indexed time, parse failures, document counts, and embedded chunk counts
- an explicit convention for `raw/`, `assets/`, and `outputs/` within a collection
- visible linkage between `Configuration > Search Providers` and `Second Brain > Library`

Why this is first:

- it unifies search collections with the user-facing product
- it creates the missing "this is my corpus" concept
- it does not require a new architecture stack

### 2. Knowledge Compiler Jobs

Add runtime-owned jobs that compile a corpus into inspectable derived artifacts.

Deliver:

- per-document summary artifacts
- concept/entity/topic pages
- backlink or related-document indexes
- open-questions and unresolved-claims pages
- collection overview pages
- promotion flow from derived page to operator-curated page where appropriate

Guardrails:

- compiled pages are **derived artifacts**, not new source-of-truth memory files
- every artifact carries provenance, source references, refresh metadata, and trust state
- refreshes run as bounded jobs, not invisible self-rewrites

### 3. Research Q&A With Save-Back

Give Guardian a first-class workflow for answering against a collection and filing the result back in.

Deliver:

- a collection-aware answer flow using `doc_search` plus derived knowledge artifacts
- required citation blocks in research answers
- "save as knowledge artifact" actions for:
  - markdown note
  - research report
  - source digest
  - meeting packet / brief where relevant
- explicit "file this into the collection" behavior instead of silent memory promotion

Optional route choice:

- keep simple retrieval on the current search and `Second Brain` paths
- if this grows into a real product lane, add a proper Intent Gateway route for knowledge work rather than bolting logic in before the gateway

### 4. Knowledge Lint And Integrity Jobs

Extend current memory hygiene into corpus-aware knowledge integrity checks.

Deliver:

- duplicate concept page detection
- stale summary detection
- uncited derived page detection
- orphan raw document detection
- weakly connected source detection
- missing-image-caption or missing-asset metadata checks
- "good next article candidates" and "interesting unanswered questions" reports

Stretch behavior:

- optional approval-gated enrichment jobs that use web search to fill missing metadata or confirm stale facts

### 5. Output Artifact Families

Make outputs feel like part of the knowledge base, not just side effects.

Deliver:

- first-class markdown report artifacts
- Marp slide deck artifacts
- chart/figure artifact support for generated images
- artifact metadata with source refs, generation reason, and collection linkage
- easy review in the web UI and export to disk

Important point:

- Guardian already knows how to create documents
- the missing piece is a **knowledge-artifact model**, not raw file writes alone

### 6. Vault And Obsidian Interop

Support file-native workflows without making the filesystem the authority.

Deliver:

- import from clipped markdown folders and article/image bundles
- export or mirror selected derived artifacts into markdown files
- frontmatter and link conventions that Obsidian can render well
- optional daily-note style output generation

Non-goal:

- do not move Guardian's canonical memory or artifact state to loose vault files

### 7. Finish Search Source Coverage

Close the obvious ingest gaps in `src/search/`.

Deliver:

- implement `git` sources
- implement `url` sources
- add repo-aware summarization and structure extraction
- add image-sidecar support, OCR/caption metadata, and asset linkage

This is not the first product step, but it becomes important quickly once the collection model exists.

## Suggested Sequence

### Phase 1: Unify The Existing Pieces

- collection-backed `Library`
- visible collection status and reindex controls
- citation-backed Q&A over configured collections

### Phase 2: Build The Compiler Loop

- derived collection overview pages
- topic/concept pages
- save-back of answers as knowledge artifacts

### Phase 3: Add Knowledge Hygiene

- integrity jobs
- open-questions reports
- operator review flows for promoted pages

### Phase 4: Add Better Output And Interop

- Marp output
- chart artifacts
- Obsidian-friendly export/mirror

### Phase 5: Expand Ingest

- `git` and `url` sources
- richer asset/image handling

## Things I Would Explicitly Defer

These are interesting, but they should not be first-wave product work:

- synthetic data generation for fine-tuning
- training or fine-tuning models to internalize corpus knowledge
- turning Guardian into a fully autonomous self-maintaining wiki without explicit review and maintenance boundaries

Those are downstream optimizations. The immediate product gap is much simpler:

**make Guardian's existing memory, search, artifact, and `Second Brain` systems feel like one coherent knowledge-base product.**

## Likely Implementation Areas

- `src/runtime/second-brain/*`
- `src/search/*`
- `src/runtime/agent-memory-store.ts`
- `src/runtime/automated-maintenance-service.ts`
- `src/runtime/memory-mutation-service.ts`
- `src/tools/builtin/search-tools.ts`
- `web/public/js/pages/second-brain.js`
- `web/public/js/pages/memory.js`
- `web/public/js/pages/config.js`
- `src/runtime/intent-gateway.ts`
- `src/runtime/direct-intent-routing.ts`
- `src/index.ts`

## Bottom Line

The repo is not starting from zero here.

Guardian already has:

- the safer memory model
- the right maintenance model
- a real retrieval layer
- a web knowledge surface

What it lacks is the **knowledge-base product loop** that ties them together.

If we implement only a few blips, the best ones are:

1. collection-backed `Library`
2. knowledge compiler artifacts
3. citation-backed Q&A with save-back
4. corpus-aware lint and integrity jobs

That would move Guardian from "has some knowledge-system primitives" to "is recognizably this kind of product."
