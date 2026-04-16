# Agent Memory Taxonomy Comparison And Guardian Fit

**Date:** 2026-04-16  
**Type:** Research / Architecture comparison  
**Source model reviewed:** user-provided five-part agent memory taxonomy

The source taxonomy describes:

1. episodic memory
2. semantic memory
3. procedural memory
4. long-term retrieval into local memory when needed
5. short-term or working memory assembled for the active task

This document compares that model against Guardian's shipped memory architecture as implemented today.

## Executive Summary

Guardian does not implement that taxonomy as three neat memory buckets plus a single working-memory layer.

Instead, Guardian has:

- two durable memory scopes: global and code-session
- separate SQLite conversation history
- prompt-time retrieval and packing logic
- operator-curated wiki pages inside the durable memory layer
- separate document search and embedding infrastructure
- a separate `Second Brain` personal knowledge/product surface
- a strong procedural layer distributed across prompts, skills, tool policy, and shared orchestration

The result is:

- **strong on procedural memory**
- **strong on short-term / working memory assembly**
- **strong on trust-aware long-term retrieval into prompts**
- **partial on episodic memory**
- **partial on semantic memory**

Guardian is ahead of the simple taxonomy in one important way: it treats trust, provenance, scope isolation, approvals, and prompt-injection resistance as first-class memory concerns. Many memory taxonomies ignore those entirely.

Guardian is behind the taxonomy's idealized version in a different way: durable memory itself is not yet a unified semantic retrieval system. The repo has strong hybrid/vector search infrastructure, but that capability lives in the document-search subsystem rather than in the core durable memory store.

## Bottom-Line Scorecard

| Memory Type | Guardian Fit | Assessment |
|---|---|---|
| Episodic | Partial | Guardian stores conversations and flushes dropped context durably, but core durable-memory retrieval is still mostly lexical and metadata-ranked rather than embedding-native episodic recall |
| Semantic | Partial | Guardian has strong semantic ingredients, but they are split across operator-curated memory, `Second Brain`, and document search rather than one unified semantic memory plane |
| Procedural | Strong | Guardian is highly procedural, but most of that knowledge is encoded in prompts, skills, specs, and control-plane rules rather than a dedicated procedural-memory service |
| Long-term retrieval into local context | Strong | Prompt-time retrieval is explicit, bounded, query-aware, and diagnostics-backed |
| Short-term / working memory | Strong | Guardian has one of the stronger working-memory/context-assembly designs in the repo, especially for safety-critical state and coding sessions |

## Current Guardian Memory Surfaces

Guardian's current memory system is spread across several runtime surfaces.

### 1. Durable memory store

The core durable memory store is `AgentMemoryStore`:

- typed entries with `sourceType`, `trustLevel`, `status`, `provenance`, tags, and artifact metadata in `src/runtime/agent-memory-store.ts`
- distinct artifact classes: `canonical`, `operator_curated`, `derived`, and `linked_output`
- distinct artifact kinds such as `memory_entry`, `wiki_page`, and `linked_output`
- readable markdown plus canonical sidecar index rather than raw append-only text

Relevant references:

- `src/runtime/agent-memory-store.ts:17`
- `src/runtime/agent-memory-store.ts:33`
- `docs/specs/IDENTITY-MEMORY-SPEC.md:27`

### 2. Conversation history

Conversation history is separate from durable memory:

- SQLite-backed
- FTS5-enabled when available
- trimmed for prompt context
- older dropped context can be flushed into durable memory

Relevant references:

- `src/runtime/conversation.ts:930`
- `src/runtime/conversation.ts:1120`
- `docs/specs/IDENTITY-MEMORY-SPEC.md:15`

### 3. Prompt-time retrieval and packing

Guardian does not load all memory blindly. It builds a structured query from the active turn and then loads bounded winning entries into prompt context.

Relevant references:

- `src/runtime/chat-agent/prompt-context.ts:238`
- `src/runtime/chat-agent/prompt-context.ts:305`
- `src/runtime/agent-memory-store.ts:1010`
- `docs/specs/CONTEXT-ASSEMBLY-SPEC.md:102`

### 4. Operator-curated wiki pages

Guardian supports curated memory pages inside the durable memory system:

- operator-authored
- upserted by stable title/slug/canonical key
- treated as `operator_curated`
- ranked ahead of derived artifacts when equally relevant

Relevant references:

- `src/index.ts:2219`
- `src/runtime/memory-mutation-service.ts:209`
- `src/runtime/agent-memory-context.test.ts:224`

### 5. Linked automation-output references

Saved automation runs can persist full run output privately and write only a compact searchable reference into durable memory.

Relevant references:

- `src/runtime/automation-output-persistence.ts:62`
- `docs/specs/TOOLS-CONTROL-PLANE-SPEC.md:43`

### 6. Separate semantic stores outside core memory

Guardian also has two adjacent knowledge systems:

- `doc_search`: hybrid BM25 + vector search over indexed document collections
- `Second Brain`: a structured personal-assistant store for notes, tasks, contacts, events, briefs, routines, and related synced context

Relevant references:

- `src/search/search-service.ts:74`
- `src/tools/builtin/search-tools.ts:15`
- `docs/specs/SECOND-BRAIN-AS-BUILT-SPEC.md:109`

## Comparison Against The Taxonomy

## 1. Episodic Memory

### Taxonomy expectation

In the source model, episodic memory means stored past interactions and actions performed by the agent, ideally retrievable later, with vector semantics suggested as the canonical example.

### Guardian implementation

Guardian has several real episodic-memory mechanisms:

- conversation history persisted in SQLite with FTS5 search
- automatic context flush that turns dropped transcript history into durable `context_flush` entries
- automation result references that preserve links to prior runs
- provenance fields on durable memory entries

Relevant references:

- `src/runtime/conversation.ts:930`
- `src/runtime/memory-flush.ts:186`
- `src/index.ts:3132`
- `src/runtime/automation-output-persistence.ts:150`

### Where Guardian matches

- Guardian absolutely stores past interactions and prior system activity.
- Guardian does not rely only on raw transcript replay; it converts older context into structured durable artifacts.
- Guardian preserves useful episodic state like objective, blocker, route, code-session identity, and transcript excerpts inside flush entries.

### Where Guardian falls short

- Guardian's core durable memory retrieval is not embedding-native episodic recall.
- Persistent memory search is described and implemented as deterministic field-aware ranking, not vector retrieval.
- Vector search exists elsewhere in the repo, but not as the main retrieval path for the durable memory store itself.

Relevant references:

- `src/tools/builtin/memory-tools.ts:118`
- `src/runtime/agent-memory-store.ts:1231`
- `src/search/search-service.ts:74`

### Verdict

**Partial match.**

Guardian has real episodic storage, and its transcript-to-durable-memory flush is better than a naive chat-history-only system. But if the benchmark is "vectorized episodic memory as a first-class part of the memory layer," Guardian does not fully match that model yet.

## 2. Semantic Memory

### Taxonomy expectation

In the source model, semantic memory is external knowledge plus the agent's knowledge about itself. It behaves like grounded retrieval context for accurate answers.

### Guardian implementation

Guardian has semantic knowledge spread across multiple systems:

- operator-curated wiki pages in durable memory
- canonical durable memory entries such as preferences, facts, and decisions
- `Second Brain` structured records
- document collections indexed for hybrid/vector search
- skills and tool inventories that describe capabilities

Relevant references:

- `src/index.ts:2219`
- `src/runtime/memory-mutation-service.ts:320`
- `docs/specs/SECOND-BRAIN-AS-BUILT-SPEC.md:142`
- `src/tools/builtin/search-tools.ts:15`

### Where Guardian matches

- Guardian clearly supports persistent facts, preferences, decisions, and curated reference material.
- Operator-curated pages function as a high-trust semantic layer.
- `doc_search` provides a true hybrid semantic retrieval pipeline over indexed document corpora.
- `Second Brain` acts as structured personal semantic context for many user-facing tasks.

### Where Guardian falls short

- The semantic layer is fragmented.
- Core durable memory, document search, and `Second Brain` are related but not unified into one retrieval authority.
- The main prompt-time durable memory loader does metadata-aware and lexical-style ranking over durable memory entries, but it does not directly use the repo's embedding search stack.
- The system has multiple knowledge surfaces instead of one coherent semantic-memory substrate.

### Verdict

**Partial match with strong ingredients.**

Guardian has enough pieces to support a strong semantic-memory story, but today they are split across multiple subsystems rather than presented as one unified semantic memory architecture.

## 3. Procedural Memory

### Taxonomy expectation

In the source model, procedural memory is the agent's systemic operating knowledge: system prompt structure, tools, rules, and guardrails.

### Guardian implementation

This is Guardian's strongest category.

Guardian's procedural knowledge lives in:

- the core system prompt
- the Intent Gateway contract
- the tools control plane
- skills and progressive disclosure
- approval and policy systems
- context-assembly rules
- shared orchestration and pending-action flow

Relevant references:

- `src/prompts/guardian-core.ts:8`
- `docs/specs/TOOLS-CONTROL-PLANE-SPEC.md:1`
- `docs/specs/CONTEXT-ASSEMBLY-SPEC.md:1`

### Where Guardian matches

- Guardian has extensive procedural knowledge about how it should behave.
- Tools, approvals, policies, and routing are explicit architecture, not incidental prompt text.
- The system is unusually strong at separating "what the agent knows how to do" from "what facts it remembers."

### Important nuance

Guardian's procedural memory is mostly static and control-plane-owned, not dynamically learned procedural memory.

That means:

- **very strong** as an operating system for the agent
- **weaker** if the benchmark is self-evolving procedural learning

The repo already distinguishes skills from memory and explicitly warns against collapsing those systems together.

### Verdict

**Strong match.**

If the question is whether Guardian has a strong procedural-memory layer, the answer is yes. It is one of the system's clearest strengths.

## 4. Long-Term Retrieval Into Local Context

### Taxonomy expectation

The source model says the application sometimes pulls long-term memory locally for the task at hand.

### Guardian implementation

Guardian does this directly and deliberately:

- `buildKnowledgeBaseContextQuery(...)` creates a structured query from the active message, continuity state, blocker state, execution refs, and code-session context
- `loadPromptKnowledgeBases(...)` loads bounded winning memory for global and code-session scopes
- selected memory entries are surfaced in diagnostics with previews, render modes, scores, and compact match reasons

Relevant references:

- `src/runtime/chat-agent/prompt-context.ts:238`
- `src/runtime/chat-agent/prompt-context.ts:305`
- `src/runtime/agent-memory-store.ts:1010`

### Where Guardian matches

- Retrieval is explicit rather than accidental.
- Retrieval is bounded by context budgets.
- Retrieval is scope-aware.
- Retrieval is diagnostics-backed, which makes it explainable.
- In code sessions, Guardian loads global memory first and code-session memory second as a bounded local augment.

### Verdict

**Strong match.**

This part of the taxonomy is already materially implemented.

## 5. Short-Term Or Working Memory

### Taxonomy expectation

The source model defines working memory as everything pulled together locally for the current task before sending the final prompt to the LLM.

### Guardian implementation

Guardian has a mature working-memory model:

- explicit bounded state such as pending actions, continuity, approvals, execution profile, code-session identity, workspace trust, and focus
- compact inventories for tools, skills, providers, and other large capability surfaces
- retrieval-backed evidence loaded only when relevant
- omission by default for bulky or stale material
- conversation trimming and context flush when prompt budgets are exceeded

Relevant references:

- `docs/specs/CONTEXT-ASSEMBLY-SPEC.md:60`
- `docs/specs/CONTEXT-ASSEMBLY-SPEC.md:132`
- `src/runtime/chat-agent/prompt-context.ts:238`
- `src/runtime/conversation.ts:930`

### Where Guardian matches

- Guardian's context assembly is already a formal working-memory system.
- The repo treats prompt assembly as a correctness boundary, not just string concatenation.
- Working memory is especially strong for coding sessions because it includes repo-local evidence, workspace trust, working set, and compacted summaries.

### Verdict

**Strong match.**

This is another area where Guardian is already stronger than the simple taxonomy.

## Where Guardian Is Better Than The Simple Taxonomy

The five-part taxonomy is useful, but it misses several things Guardian treats as essential.

### 1. Trust and provenance

Guardian tracks:

- trust level
- status
- provenance
- principal identity
- quarantine state

The taxonomy does not discuss any of that, but in a real agent system this matters as much as storage type.

Relevant references:

- `src/runtime/agent-memory-store.ts:17`
- `docs/specs/IDENTITY-MEMORY-SPEC.md:27`
- `src/tools/builtin/memory-tools.ts:421`

### 2. Scope isolation

Guardian distinguishes:

- global memory
- code-session memory
- conversation history
- foreign-scope bridge lookup

That is more operationally useful than one flat long-term memory bucket.

Relevant references:

- `docs/specs/TOOLS-CONTROL-PLANE-SPEC.md:45`
- `src/tools/builtin/memory-tools.ts:384`
- `src/tools/builtin/memory-tools.ts:556`

### 3. Prompt-injection resistance at memory load time

Guardian does not just retrieve memory. It sanitizes prompt-bound memory entries before injecting them back into model context.

Relevant references:

- `src/runtime/agent-memory-store.ts:1181`
- `src/runtime/agent-memory-store.ts:1209`

### 4. Memory hygiene

Guardian has explicit dedupe, canonicalization, stale-artifact handling, and bounded maintenance for durable memory.

Relevant references:

- `src/runtime/memory-mutation-service.ts:189`
- `src/runtime/memory-mutation-service.ts:320`

## Main Gaps Relative To A Stronger Memory Architecture

## 1. No unified semantic retrieval plane

Guardian has:

- durable memory
- `Second Brain`
- document search

But those do not yet form one coherent semantic-memory system.

## 2. Durable memory retrieval is not embedding-native

The repo has vector search, but the durable memory store itself still relies on deterministic content/summary/category/tag/provenance matching rather than embeddings.

## 3. Procedural memory is strong but mostly static

Guardian's procedural layer is powerful, but it is mostly encoded in prompts, skills, specs, and policy rather than a first-class learned procedural-memory mechanism.

## 4. Cross-scope promotion is intentionally conservative

Guardian allows read-only bridge lookup across memory scopes, but it does not have a rich automatic promotion model between code-session memory and global memory. That is safer, but it also means memory scope convergence is intentionally limited.

## 5. Semantic products are fragmented by product boundary

`Second Brain` is powerful, but it is still a separate structured product surface rather than the canonical semantic layer for all retrieval across the main assistant.

## Overall Assessment

Guardian stacks up well against the five-part taxonomy, but not in the simplistic "three memory types plus one working buffer" sense.

The more accurate summary is:

- Guardian is a **scope-aware, trust-aware, control-plane-owned memory system**
- it is **especially strong at procedural memory and working-memory assembly**
- it has **real episodic and semantic capabilities**, but those are still split across several subsystems
- it is **architecturally safer** than many memory-heavy agent systems because it treats provenance, quarantine, and injection resistance as part of memory design

If forced into the source taxonomy:

- episodic: **partial**
- semantic: **partial**
- procedural: **strong**
- long-term retrieval into local context: **strong**
- working memory: **strong**

If assessed as a production agent-memory architecture rather than a classroom taxonomy:

- Guardian is already above average on safety, scope discipline, and working-memory design
- Guardian's biggest next opportunity is **unifying its semantic surfaces**, not adding more raw memory storage

## Recommended Uplift Order

1. Add embedding-backed retrieval to the durable memory layer or to an artifact index sitting directly above it.
2. Unify core durable memory, `Second Brain`, and `doc_search` under a clearer semantic-memory contract.
3. Add explicit memory-class-aware retrieval policy so episodic, semantic, procedural, and derived artifacts compete differently at ranking time.
4. Keep global/code-session isolation, but add a reviewed promotion path for moving useful facts between scopes.
5. Treat procedural memory as a reviewed retrievable layer, not only prompt text and skills, if future work wants stronger dynamic procedure recall.

## References Reviewed

- `src/runtime/agent-memory-store.ts`
- `src/runtime/memory-mutation-service.ts`
- `src/runtime/memory-flush.ts`
- `src/runtime/conversation.ts`
- `src/runtime/chat-agent/prompt-context.ts`
- `src/runtime/automation-output-persistence.ts`
- `src/tools/builtin/memory-tools.ts`
- `src/search/search-service.ts`
- `src/tools/builtin/search-tools.ts`
- `src/prompts/guardian-core.ts`
- `src/index.ts`
- `docs/specs/IDENTITY-MEMORY-SPEC.md`
- `docs/specs/CONTEXT-ASSEMBLY-SPEC.md`
- `docs/specs/TOOLS-CONTROL-PLANE-SPEC.md`
- `docs/specs/SECOND-BRAIN-AS-BUILT-SPEC.md`
