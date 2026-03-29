# BitNet CPU Decision Lane Proposal

**Status:** Proposed  
**Date:** 2026-03-29  
**Informed by:**
- [Agentic Defensive Security Suite - As-Built Spec](../specs/AGENTIC-DEFENSIVE-SECURITY-SUITE-AS-BUILT-SPEC.md)
- [Orchestration Specification](../specs/ORCHESTRATION-SPEC.md)
- [Intent Gateway](../../src/runtime/intent-gateway.ts)
- [Provider Registry](../../src/llm/provider-registry.ts)
- [Ollama Provider](../../src/llm/ollama.ts)
- [Runtime Model Routing UX](../../src/runtime/model-routing-ux.ts)
- `S:\Development\bitnet`
- <https://github.com/microsoft/BitNet>
- <https://huggingface.co/microsoft/bitnet-b1.58-2B-4T>
- <https://docs.ollama.com/api/openai-compatibility>

---

## Executive Summary

GuardianAgent should evaluate BitNet as a **specialized local CPU decision lane**, not as a full replacement for Ollama.

The right first use cases are the parts of Guardian that are:

- short-context
- structured-output
- CPU-friendly
- latency-sensitive
- not dependent on tool calling

That makes BitNet a strong candidate for:

1. the Intent Gateway
2. inline Guardian Agent security evaluations
3. Sentinel retrospective audit analysis
4. other bounded JSON-only classifiers

It is **not** the right first candidate for:

- the main assistant tool-calling loop
- `security-triage`
- coding work
- browser/email/workspace orchestration

The current repo already has most of the architectural seams needed to do this, but a clean rollout requires capability-aware provider routing and a small amount of provider/runtime hardening. The main change in direction from the earlier broader BitNet proposal is this:

- do **not** assume Guardian should bundle BitNet as the universal built-in default model
- do **not** assume BitNet should replace Ollama for general local assistant behavior
- do treat BitNet as an optional local inference lane for structured reasoning and security judgment on CPU-first deployments

---

## Relationship To Existing BitNet Proposal

This proposal narrows and updates the direction in [Built-in BitNet Model Proposal](./BUILTIN-BITNET-MODEL-PROPOSAL.md).

That earlier proposal assumed:

- a broadly bundled built-in BitNet runtime
- BitNet as the default local intelligence layer
- a wider substitution for existing local-provider behavior

This proposal recommends a more conservative path:

- integrate BitNet first as an optional local provider lane
- route only JSON-oriented and classification-oriented workloads to it
- keep Ollama or another stronger local/external provider for general tool-calling paths

If implemented, this proposal should be treated as the preferred near-term BitNet direction.

---

## Problem

GuardianAgent currently has a meaningful gap between:

- tasks that are too important or too frequent to ship to cloud APIs by default
- tasks that do not need a large, creative, tool-calling model

The main examples are already in the repo:

- top-level intent classification through the Intent Gateway
- inline security evaluation in `GuardianAgentService`
- retrospective audit analysis in `SentinelAuditService`
- conservative security routing and decision support

These tasks are not full assistant conversations. They are closer to:

- structured classification
- bounded judgment
- low-token reasoning
- compact JSON output

Guardian already supports local and external provider routing, but the current local story is still centered on Ollama and local models that are expected to participate in broader assistant behavior.

That creates two issues:

1. The local model used for general assistant work is not necessarily the best local model for structured runtime decisions.
2. Guardian does not yet distinguish clearly enough between:
   - providers that are good at tool-calling orchestration
   - providers that are good at fast local classification

BitNet is interesting precisely because it may improve the second category without trying to solve the first.

---

## What We Verified

### 1. The Intent Gateway is an unusually good fit

The Intent Gateway is authoritative for top-level route selection per the current orchestration architecture. It uses a short, structured interaction and caps completion size tightly.

Relevant current properties:

- top-level structured classification is required
- no tool execution happens during classification
- deterministic fallback is already allowed when the gateway is unavailable
- the current implementation already accepts structured JSON parsed from response content, not only tool calls

This is exactly the kind of workload a smaller CPU-oriented model can plausibly handle well if constrained tightly.

### 2. The current security stack already has JSON-oriented decision points

`GuardianAgentService` and `SentinelAuditService` both rely on compact JSON results rather than rich tool-calling orchestration. That is important because BitNet's current local server shape is more compelling for structured outputs than for full tool use.

### 3. BitNet is a real CPU inference option, not a generic model manager

The local `S:\Development\bitnet` checkout is `bitnet.cpp`, a Microsoft-maintained inference runtime built on top of `llama.cpp`, with:

- CPU-focused optimized ternary inference kernels
- official support for the `BitNet-b1.58-2B-4T` family
- an OpenAI-like `llama-server` HTTP surface
- additional recent CPU optimization work in the repo

This matters because Guardian does not need to invent a BitNet runtime from scratch. It can integrate against a local HTTP endpoint.

### 4. BitNet is not yet a clean tool-calling substitute

The current `llama.cpp` server documentation in the BitNet repo states that its OpenAI-compatible chat endpoint supports JSON output and schema-constrained output, but does not fully support OpenAI function calling.

That is the key boundary for this proposal:

- JSON-oriented decision tasks: good candidate
- tool-calling assistant loops: not a good first target

### 5. Guardian currently has locality inconsistencies that matter here

The config/setup path can infer locality from loopback/private endpoints, but several runtime paths still effectively treat `ollama` as synonymous with `local`.

That means a BitNet server exposed through an OpenAI-compatible local endpoint would currently be:

- partly recognized as local
- partly treated as external

That inconsistency would produce bad routing, bad fallback behavior, and misleading response-source metadata unless fixed.

---

## Why BitNet

BitNet is interesting for Guardian because it changes the economics of local CPU inference.

The official repo and model card make the following case:

- the runtime is optimized for CPU inference of native 1-bit / ternary models
- the flagship open model is instruction-tuned and intended for deployment
- the 2B4T model claims strong efficiency relative to similarly sized full-precision open models
- the model card reports low CPU decoding latency and a much smaller non-embedding memory footprint than peers in its class

For Guardian's purposes, the important question is not whether BitNet is the best general-purpose model. It is whether it is:

- fast enough on CPU
- small enough to be practical on common hardware
- reliable enough for compact structured runtime decisions

That is a much narrower bar, and it is a realistic one.

---

## Goals

1. Add an optional BitNet-backed local CPU lane for structured runtime decisions.
2. Improve latency and availability for classification-oriented Guardian subsystems.
3. Preserve stronger providers for tool-calling, orchestration, and general assistant tasks.
4. Make local provider routing capability-aware rather than provider-name-aware.
5. Keep the rollout safe by constraining BitNet use to workloads it can realistically support.

## Non-Goals

1. Do not replace Ollama across the whole product.
2. Do not route the main tool-calling assistant loop to BitNet in the first rollout.
3. Do not route `security-triage` to BitNet initially.
4. Do not assume Guardian must bundle BitNet binaries and model weights by default.
5. Do not claim that every local OpenAI-compatible endpoint is interchangeable for all workloads.

---

## Recommended Product Shape

### Positioning

Guardian should treat BitNet as a **local decision engine**.

Suggested initial positioning in product terms:

- "Fast local CPU reasoning for bounded Guardian runtime decisions"
- "Best for intent routing, policy judgment, and structured security evaluation"
- "Not intended for general assistant chat or complex tool orchestration"

### Supported Use Cases In Phase 1

| Subsystem | Fit | Why |
|----------|-----|-----|
| Intent Gateway | Yes | Short structured classification, no tool execution, authoritative gateway path |
| Guardian Agent inline action evaluation | Yes | Strict JSON, latency-sensitive, bounded context |
| Sentinel audit analysis | Yes | Compact JSON findings, not an interactive tool loop |
| Other JSON-only classifiers | Yes | Same pattern as above |
| Security triage agent | No | Uses read-heavy evidence gathering and tool-driven investigation |
| Main assistant tool loop | No | Tool schemas and orchestration need stronger provider compatibility |
| Coding assistant / code sessions | No | Not the target capability profile |

---

## Architectural Recommendation

### 1. Do not integrate BitNet through the Ollama provider

This is the wrong shape.

Reasons:

- the current Ollama provider depends on Ollama-specific model listing endpoints
- Guardian has local-model complexity heuristics keyed specifically to `ollama`
- overloading `provider: ollama` to reach BitNet would create incorrect behavior and confusing diagnostics

BitNet should either be:

- a dedicated provider family, or
- a first-class local OpenAI-compatible provider profile

### 2. Add capability-aware provider metadata

Guardian currently treats provider choice mostly as a transport choice. For BitNet, it needs to know what a provider can actually do.

Suggested provider capability model:

```ts
interface LLMProviderCapabilities {
  locality: 'local' | 'external';
  supportsTools: boolean;
  supportsJsonSchema: boolean;
  supportsStreaming: boolean;
  intendedUses: Array<
    | 'general_chat'
    | 'tool_calling'
    | 'intent_classification'
    | 'security_judgment'
    | 'audit_analysis'
  >;
}
```

This would let Guardian route:

- tool-calling work to providers that actually support tool calling well
- JSON-only work to providers that support schema-constrained output

### 3. Add JSON-schema response support to the shared chat abstraction

Guardian's `ChatOptions` currently carry `tools`, but not a general response-format or schema contract.

That is fine for Ollama tool-calling paths, but it unnecessarily blocks the cleanest BitNet integration path for the gateway and security evaluators.

Suggested direction:

```ts
interface ChatOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  tools?: ToolDefinition[];
  responseFormat?: {
    type: 'json_object' | 'json_schema';
    schema?: Record<string, unknown>;
  };
  signal?: AbortSignal;
}
```

With that in place:

- Intent Gateway can request strict JSON output
- Guardian Agent inline evaluation can request strict JSON output
- Sentinel audit can request strict JSON output
- a provider that lacks tool calling can still serve these paths well

### 4. Prefer JSON mode over tool calls for BitNet-targeted workloads

The current Intent Gateway uses a tool definition and then parses either:

- tool call arguments, or
- structured JSON from plain content

That fallback is already the opening.

The cleaner version is:

- keep the schema authoritative
- use response-format JSON when the selected provider supports it
- use tool calls only when the provider is actually suited to tool calling

This reduces the amount of provider-specific behavior needed in the gateway path.

### 5. Fix locality handling across runtime paths

BitNet on localhost should be consistently treated as local.

Today, that is not fully true.

The runtime should consistently derive locality from:

- explicit provider capability metadata, or
- config/base URL locality

It should not infer locality from `providerName === 'ollama'`.

This matters to:

- quality fallback behavior
- response-source metadata
- trust and taint handling
- setup and dashboard UX
- local-vs-external policy decisions

---

## Integration Plan

### Phase 0: Manual Pilot, No Product Commitment

Objective:

- validate that BitNet is useful on real Guardian workloads before deeper productization

Work:

1. Build and run BitNet manually on a representative CPU host.
2. Evaluate the `BitNet-b1.58-2B-4T` chat checkpoint against:
   - intent-gateway fixtures
   - Guardian Agent inline evaluation prompts
   - Sentinel audit prompts
3. Record:
   - latency
   - JSON adherence
   - classification quality
   - failure patterns

Success bar:

- useful enough to justify capability-aware integration

### Phase 1: Capability-Aware Local OpenAI-Compatible Provider Support

Objective:

- make local OpenAI-compatible endpoints first-class citizens in Guardian

Work:

1. Add provider capability metadata.
2. Add response-format / JSON-schema support to the provider abstraction.
3. Ensure local loopback OpenAI-compatible providers can be configured without pretending to be Ollama.
4. Remove remaining runtime assumptions that equate `local` with `ollama`.

Success bar:

- Guardian can cleanly host a localhost BitNet server as a local provider
- dashboard/setup/routing treat it as local everywhere

### Phase 2: Route JSON-Only Workloads To BitNet

Objective:

- put BitNet on the right work, not all work

Work:

1. Add routing knobs for:
   - intent gateway provider
   - inline Guardian Agent provider
   - Sentinel audit provider
2. Default these to:
   - BitNet if configured and healthy
   - otherwise existing local/external fallback behavior
3. Keep:
   - main assistant tool loop on the current general-purpose provider path
   - `security-triage` on stronger tool-calling providers

Success bar:

- BitNet is in production use for bounded decision workloads
- no regression in tool-calling paths

### Phase 3: Optional Managed Runtime

Objective:

- reduce operator friction only after the routing architecture is proven

Possible work:

1. Add optional managed BitNet process lifecycle support.
2. Add health checks, startup/shutdown, and operator-friendly configuration.
3. Possibly add a dedicated `bitnet` provider type if that remains clearer than a generic local OpenAI-compatible family.

This phase should remain optional. The critical value is the workload routing model, not necessarily bundling BitNet itself.

---

## Detailed Repo Changes

### Provider Layer

Primary files:

- `src/llm/types.ts`
- `src/llm/openai.ts`
- `src/llm/provider-registry.ts`

Recommended changes:

1. Extend `ChatOptions` with JSON response-format support.
2. Add provider capability metadata to the provider abstraction or registry.
3. Ensure local OpenAI-compatible providers can initialize cleanly without being blocked by "non-Ollama requires API key" assumptions.
4. Optionally add a dedicated `bitnet` or `llama-cpp` provider family for UI clarity.

### Intent Gateway

Primary file:

- `src/runtime/intent-gateway.ts`

Recommended changes:

1. Preserve the current schema and normalization logic.
2. Prefer JSON-schema constrained output when the selected provider supports it.
3. Retain existing content-based structured parsing fallback.
4. Add a dedicated provider selection path for the gateway rather than relying only on the chat agent's general provider.

### Runtime Routing And Locality

Primary files:

- `src/index.ts`
- `src/runtime/model-routing-ux.ts`

Recommended changes:

1. Replace provider-name locality checks with capability/config-derived locality.
2. Keep current response-source metadata, but make it accurate for local OpenAI-compatible providers.
3. Ensure fallback and quality-retry logic work correctly for BitNet-as-local.

### Security Decision Paths

Primary files:

- `src/runtime/sentinel.ts`
- `src/runtime/security-controls.ts`

Recommended changes:

1. Add explicit provider targeting for:
   - inline Guardian Agent evaluation
   - Sentinel audit analysis
2. Keep `security-triage` on a stronger provider path unless and until BitNet demonstrates reliable tool-free triage quality on real data.

---

## Why Not Replace Ollama

Ollama remains more useful as a broad local runtime because:

- Guardian already has a working dedicated provider for it
- its compatibility surface in Guardian is mature
- current Ollama compatibility includes tool support on the OpenAI-like route
- it is better aligned with general assistant use and broader local experimentation

BitNet does not need to beat Ollama everywhere to be valuable.

It only needs to be better in a narrow, high-leverage slice:

- CPU-first
- fast
- bounded
- structured

That is enough to justify a dedicated lane.

---

## Risks

### 1. Model quality may be uneven on security judgment

Even if BitNet is fast, a 2B-class local model may still be too weak for some nuanced security judgments. That is why the initial scope must be narrow and fallback-aware.

### 2. Local OpenAI-compatible does not mean behavior-compatible

A local endpoint can expose an OpenAI-like route while still differing materially in:

- tool behavior
- output reliability
- schema adherence
- error semantics

Guardian must route by capability, not by assumed compatibility.

### 3. Packaging could dominate the effort if started too early

If Guardian jumps immediately to managed BitNet download/build lifecycle, the project could spend more effort on packaging than on the decision-routing value. That is the wrong order.

### 4. Security triage could regress if moved too soon

`security-triage` is explicitly a read-first investigation agent. Moving it to BitNet before tool-free reliability is demonstrated would likely make the security story worse, not better.

---

## Open Questions

1. Is the current BitNet 2B4T model strong enough on Guardian's real intent-routing fixtures to replace the current local baseline?
2. Is its JSON adherence stable enough under prompt variation to trust for inline allow/block decisions?
3. Should Guardian expose BitNet through:
   - a dedicated `bitnet` provider type
   - a generic `llama-cpp` provider family
   - or a generic local OpenAI-compatible provider path with better locality semantics?
4. Should the product eventually manage BitNet runtime lifecycle, or simply integrate with an already-running local endpoint?
5. Does Guardian want one "decision provider" concept distinct from the main assistant provider, beyond the existing security-specific settings?

---

## Recommendation

Proceed with a **BitNet pilot as a local CPU decision lane**.

Do this in the following order:

1. validate BitNet on real Guardian classification and security-evaluation fixtures
2. add capability-aware provider routing plus JSON-schema support
3. route the Intent Gateway and JSON-only security evaluators to BitNet when configured
4. keep Ollama and stronger providers for the main assistant and tool-calling paths
5. defer any built-in BitNet packaging or managed runtime work until the pilot proves clear value

This gives Guardian the upside of BitNet where it is strongest without forcing the product into a false "BitNet replaces Ollama" decision.
