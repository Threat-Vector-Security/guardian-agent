# Dify-Inspired Improvements Design

> Based on analysis of [Dify](https://github.com/langgenius/dify) against GuardianAgent (2026-03-11)

## Overview

Four phases of improvements inspired by Dify's architecture, covering orchestration, security, provider management, and search.

| Phase | Feature | Status | Effort |
|-------|---------|--------|--------|
| A | Orchestration: retry, fail-branch, ConditionalAgent, array iteration | **Implemented** | Small |
| B | SSRF protection for outbound HTTP | **Implemented** | Small |
| C | Provider registry (internal, curated) | **Implemented** | Medium |
| D | Native TypeScript search pipeline | **Implemented** | Medium |

---

## Phase A: Orchestration Improvements (Implemented)

**Status:** Implemented

Orchestration improvements spanning per-step retry, fail-branch error handling, a new ConditionalAgent, and array iteration for LoopAgent.

### A.0: Extracted Shared Utilities

Shared orchestration utilities were extracted as module-level functions in `src/agent/orchestration.ts`:

- `runStepsSequentially()` — sequential step execution loop (extracted from SequentialAgent.onMessage)
- `executeWithRetry()` — wraps `ctx.dispatch()` with configurable retry logic
- `prepareStepInput()` — input resolution from SharedState with contract validation
- `recordStepOutput()` — output contract validation and state.set()
- `runWithConcurrencyLimit()` — moved from ParallelAgent private method to module-level (reused by LoopAgent array mode)

### A.1: Per-Step Retry with StepRetryPolicy

Added to the `OrchestrationStep` interface:

```typescript
export interface StepRetryPolicy {
  maxRetries: number;              // 0 = no retries
  initialDelayMs?: number;         // default: 1000
  backoffMultiplier?: number;      // default: 2.0 (exponential)
  maxDelayMs?: number;             // default: 30000
  retryableError?: (error: Error) => boolean;  // default: all errors retryable
}
```

`executeWithRetry()` implements exponential backoff capped at `maxDelayMs`. If no `retry` policy is set on a step, no retries occur (backward-compatible).

### A.2: Fail-Branch with StepFailBranch

Added to the `OrchestrationStep` interface:

```typescript
export interface StepFailBranch {
  agentId: string;
  inputKey?: string;
  outputKey?: string;
  inputContract?: OrchestrationStepContract;
  outputContract?: OrchestrationStepContract;
}
```

When a step exhausts all retries, the fail-branch agent is invoked if `step.onError` is defined. The original error is stored in SharedState at `{outputKey}:error`. If the fail-branch succeeds, the pipeline continues. If it also fails, the error falls through to the existing `stopOnError` logic.

### A.3: ConditionalAgent

Implemented in `src/agent/conditional.ts`.

A new orchestration agent that evaluates ordered branch conditions against SharedState and dispatches to the first matching branch's steps. Uses `runStepsSequentially()` for branch execution.

```typescript
export interface ConditionalBranch {
  name: string;
  condition: (state: SharedStateView, message: UserMessage) => boolean;
  steps: OrchestrationStep[];
}

export interface ConditionalAgentOptions {
  branches: ConditionalBranch[];
  defaultSteps?: OrchestrationStep[];
  validationMode?: ValidationMode;
  inheritStateKeys?: string[];
}
```

Supports multi-way routing via multiple branches (first match wins), with an optional default path when no branch matches.

### A.4: LoopAgent Array Iteration

Added `LoopArrayConfig` to LoopAgent for array iteration mode:

```typescript
export interface LoopArrayConfig {
  key: string;           // SharedState key containing the array
  concurrency?: number;  // default: 1 (sequential), max: 10
  collectKey?: string;   // SharedState key to write results array (default: 'results')
  itemKey?: string;      // SharedState key for current item (default: 'item')
  indexKey?: string;     // SharedState key for current index (default: 'index')
}
```

When `items` is set, LoopAgent maps over the array with configurable concurrency. Uses `runWithConcurrencyLimit()` for parallel execution. The existing condition-based loop mode is unchanged.

### Backward Compatibility

- All new fields are optional; existing orchestration configs work without modification
- `stopOnError` remains the pipeline-level fallback; `step.onError` takes precedence per-step
- Response metadata includes `retriedSteps` for observability
- No changes to existing automation/playbook JSON format unless new fields are used

### Files

- `src/agent/orchestration.ts` — extracted utilities, new types, modified SequentialAgent/ParallelAgent/LoopAgent
- `src/agent/conditional.ts` — ConditionalAgent class
- `src/agent/conditional.test.ts` — test cases
- `src/agent/orchestration.test.ts` — additional test cases for retry, fail-branch, array iteration

---

## Phase B: SSRF Protection (Implemented)

**Status:** Implemented

Centralized SSRF protection replacing duplicated inline checks across the codebase, with a Guardian admission controller for systematic enforcement.

### Implementation

Implemented in `src/guardian/ssrf-protection.ts`:

- Centralized `isPrivateAddress()` function replacing the duplicate tool-side SSRF helpers that previously lived in `src/tools/executor.ts` and the older browser wrapper path
- `SsrfController` added to the Guardian admission pipeline as the 7th controller (after DeniedPathController)
- `validateUrlForSsrf()` for full URL validation including metadata, obfuscation, and optional DNS resolution

### Coverage

IP ranges blocked:
- RFC1918: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
- Loopback: 127.0.0.0/8, ::1, localhost, *.localhost
- Link-local: 169.254.0.0/16, fe80::/10
- Cloud metadata: 169.254.169.254, fd00:ec2::254, metadata.google.internal
- Unique local IPv6: fc00::/7
- Current-network: 0.0.0.0/8
- IPv4-mapped IPv6: ::ffff:0:0/96 mapped to private ranges
- Decimal/octal/hex IP obfuscation detection
- DNS pre-resolution (optional)

### Config

Added to `GuardianConfig`:

```typescript
export interface SsrfConfig {
  enabled: boolean;                      // default: true
  allowPrivateNetworks?: boolean;        // default: false (for home lab use cases)
  blockCloudMetadata?: boolean;          // default: true
  allowlist?: string[];                  // explicit hostnames/IPs always allowed
  resolveBeforeFetch?: boolean;          // default: false (DNS pre-resolution)
}
```

Config path: `guardian.ssrf`

### Files

- `src/guardian/ssrf-protection.ts` — centralized SSRF validation + SsrfController
- `src/guardian/ssrf-protection.test.ts` — test cases
- `src/config/types.ts` — SsrfConfig added to GuardianConfig

---

## Phase C: Provider Registry (Implemented)

**Status:** Implemented (redesigned from original proposal)

### Design Change from Proposal

The original proposal specified a plugin/dynamic-import architecture for external provider loading (filesystem scanning, npm package discovery, `~/.guardianagent/plugins/` directory). This was **rejected** as a supply chain risk.

Instead, an internal-only `ProviderRegistry` class was implemented with curated built-in providers. No external plugin loading, no dynamic imports, no filesystem scanning.

### Implementation

Implemented in `src/llm/provider-registry.ts`:

- `ProviderRegistry` class with 9 built-in providers:
  - **Core:** ollama, anthropic, openai
  - **OpenAI-compatible:** groq, mistral, deepseek, together, xai, google
- OpenAI-compatible providers reuse `OpenAIProvider` with configurable `providerName` and default `baseUrl`
- `LLMConfig.provider` widened from union type (`'ollama' | 'anthropic' | 'openai'`) to `string`

### Adding New Providers

New providers are added by modifying the `ProviderRegistry` source code to register additional built-in entries. This is intentional — it keeps the supply chain within the project's control.

### Backward Compatibility

- Existing `config.llm.providers` format unchanged
- Existing provider names (ollama, anthropic, openai) work exactly as before
- `GuardedLLMProvider`, `FailoverProvider`, `ModelFallbackChain` all work transparently with registry-created providers

### Files

- `src/llm/provider-registry.ts` — ProviderRegistry class with built-in providers
- `src/llm/provider-registry.test.ts` — test cases
- `src/config/types.ts` — `provider` field widened to `string`

---

## Phase D: Native TypeScript Search Pipeline (Implemented)

**Status:** Implemented

### Problem

The search system needed a native in-process search pipeline to eliminate external binary dependencies, improve reliability across platforms, and enable hybrid search (BM25 + vector similarity).

### Solution

Native TypeScript search pipeline in `src/search/` using SQLite FTS5 for BM25 keyword search and in-JS cosine similarity over embeddings stored as BLOBs for vector search. Results merged via Reciprocal Rank Fusion (RRF). No native extensions or external binaries required.

### Implementation

**Module:** `src/search/` — 11 source files + 6 test files (73 tests)

Key components:
- `types.ts` — SearchResult, SearchOptions, ChunkRecord, CollectionInfo, SearchConfig
- `document-store.ts` — SQLite schema, document/chunk CRUD, source persistence
- `document-parser.ts` — Parse text, markdown, HTML, PDF (optional), DOCX (optional) to plain text
- `chunker.ts` — Parent-child chunking (parents ~768 tokens, children ~192 tokens)
- `embedding-provider.ts` — Ollama + OpenAI embedding providers with batch support
- `vector-store.ts` — In-JS cosine similarity KNN search (embeddings as BLOBs in SQLite)
- `fts-store.ts` — FTS5 BM25 keyword search with content-sync triggers
- `hybrid-search.ts` — RRF fusion of BM25 + vector results
- `search-service.ts` — Top-level service orchestrating indexing and search
- `reranker.ts` — Optional Cohere API re-ranking

**Tools:** `doc_search`, `doc_search_status`, `doc_search_reindex` in `search` category
**Config:** `assistant.tools.search` — enabled, sqlitePath, defaultMode, maxResults, sources, embedding, chunking, reranker
**Web API:** `/api/search/*` endpoints (status, sources CRUD, reindex)
**Graceful degradation:** Vector search optional — falls back to keyword-only if no embedding provider configured
- D.6-D.7 depend on D.5
- D.8 is the final cleanup step

---

## Implementation Status

| Phase | Scope | Status | Test Count |
|-------|-------|--------|------------|
| A: Orchestration improvements | Retry, fail-branch, ConditionalAgent, array iteration | **Implemented** | ~37 tests |
| B: SSRF protection | Centralized SSRF + admission controller | **Implemented** | ~12 tests |
| C: Provider registry | Internal curated registry (9 providers) | **Implemented** | ~8 tests |
| D: Search replacement | Native TypeScript search pipeline | Planned | ~30 tests |

### Phase Dependencies

- A.0 must complete before A.1-A.4 (shared utilities)
- A.1 before A.2 (retry before fail-branch)
- A.3 depends on A.0 (uses runStepsSequentially)
- B is fully independent
- C is fully independent of A and B
- D.3 benefits from C (EmbeddingProvider from ProviderRegistry) but can be done standalone
- D.1-D.2 can start in parallel with any other phase

---

## Testing Strategy

All changes follow existing conventions:
- Co-located test files (`*.test.ts` alongside `*.ts`)
- Vitest with forks pool, 30s timeout
- `vi.useFakeTimers()` for time-dependent tests (retry backoff)
- Mock `ctx.dispatch()` for orchestration tests
- Mock HTTP/SDK for embedding provider tests
- Tmpdir + cleanup for SQLite tests
- Coverage thresholds: 70% lines/functions/statements, 55% branches

### Integration/Composition Tests
- SequentialAgent with ConditionalAgent as a step -- pipeline branches mid-sequence
- ConditionalAgent inside a ParallelAgent -- conditional evaluation per parallel branch
- SequentialAgent producing array, followed by LoopAgent in array mode consuming it
- LoopAgent (array mode) nested inside SequentialAgent with retry on the LoopAgent step

---

## Appendix: Future Possibilities

### External Model Provider Plugin Interface

The original proposal (Section 6) specified a full plugin/dynamic-import architecture for external provider loading:

- `LLMProviderPlugin` interface with `createProvider()`, `createEmbeddingProvider()`, `validateConfig()`, `listModels()`
- Plugin discovery from `~/.guardianagent/plugins/`, config-specified paths, and npm packages
- Dynamic `import()` of ES modules at runtime
- Config via `plugins.pluginDirs` and `plugins.modules`

**Decision:** This approach was rejected as a supply chain risk. Dynamic loading of arbitrary code from the filesystem or npm introduces an attack surface inconsistent with GuardianAgent's security-first design.

**What was implemented instead:** An internal-only `ProviderRegistry` (`src/llm/provider-registry.ts`) with 9 curated built-in providers. New providers are added by modifying the registry source code directly. This keeps the supply chain within the project's control while still providing the ergonomic benefit of a registry pattern over a hardcoded switch statement.

If external plugin loading is reconsidered in the future, it should include:
- Code signing or hash verification for loaded modules
- Sandboxed execution environment for plugin code
- Explicit user consent per plugin (not automatic filesystem scanning)
- Audit logging of all plugin loads and provider creations

### LLM-Based Conditional Routing

The ConditionalAgent supports predicate-based conditions today. A future enhancement could add an `llmDescription` field to `ConditionalBranch` enabling LLM-based intent classification for routing. The extension point is documented in the ConditionalAgent implementation but left unimplemented.

### Declarative Automation Conditions

For automations created via tools/UI, conditions could be expressed as declarative specs rather than code predicates:
- `stateEquals: { key: 'status', value: 'approved' }` -- simple state comparison
- `inputContains: 'urgent'` -- input text check
- `llmClassify: { prompt: '...', routes: ['billing', 'technical', 'general'] }` -- LLM-based classification
