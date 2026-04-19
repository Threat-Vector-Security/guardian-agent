# OpenRouter Managed Cloud Provider — Implementation Plan

**Status:** Draft  
**Date:** 2026-04-09

## Objective

Add OpenRouter as a first-class GuardianAgent `managed_cloud` provider in a way that:

1. fits the existing provider-tier and execution-profile model
2. exposes OpenRouter as a real built-in provider rather than only a custom `openai + baseUrl` workaround
3. supports first-class OpenRouter request controls and model discovery
4. keeps the current `managed_cloud` vs `frontier` distinction intact
5. allows operators to mix and match multiple managed-cloud profiles, including both Ollama Cloud and OpenRouter, inside the Model Auto Selection Policy

## Current State

The current architecture already contains the right high-level tier split for this work:

- `local`
- `managed_cloud`
- `frontier`

That tier model is already used by:

- provider metadata
- execution-profile selection
- preferred-provider buckets
- config-center provider grouping
- model-routing UX

The main limitations are lower in the stack:

- only `ollama_cloud` currently exists as a first-class `managed_cloud` provider type
- `managedCloudRouting` already exists, but its UI copy and operator guidance are still Ollama Cloud specific
- the generic `openai` provider can already target a custom `baseUrl`, but it does not expose OpenRouter-specific request controls cleanly
- frontier profiles are still treated as one pooled default and do not have their own role-binding object

Relevant implementation seams today:

- `src/llm/provider-metadata.ts`
- `src/llm/provider-registry.ts`
- `src/llm/openai.ts`
- `src/config/types.ts`
- `src/runtime/execution-profiles.ts`
- `src/runtime/control-plane/direct-config-update.ts`
- `src/runtime/control-plane/provider-config-helpers.ts`
- `src/channels/web-types.ts`
- `web/public/js/pages/config.js`

## Research Summary

OpenRouter is a good fit for Guardian's `managed_cloud` tier because it is a brokered model gateway rather than a direct frontier vendor:

- it exposes an official JavaScript SDK
- it exposes an OpenAI-compatible HTTP API
- it supports centralized model discovery
- it supports model fallback chains
- it supports provider routing and preference controls
- it supports request transforms and app-attribution headers

That means OpenRouter is not just "another frontier provider". It is structurally closer to Ollama Cloud: a managed service layer that can broker multiple upstream models and providers behind one Guardian provider profile.

## Architectural Decisions

### 1. Add OpenRouter as `managed_cloud`, not `frontier`

OpenRouter should be represented as:

- provider type: `openrouter`
- locality: `external`
- tier: `managed_cloud`

This preserves the meaning of the current tier model:

- `managed_cloud` means brokered or managed gateway-style access
- `frontier` means direct first-party model vendors

### 2. Do not invent a second profile system for OpenRouter

Guardian already has the correct profile abstraction: each named `llm.<profile>` entry is a provider profile.

Examples:

- `openrouter-general`
- `openrouter-fast`
- `openrouter-coding`
- `ollama-cloud-budget`

OpenRouter should reuse that existing profile model. The work is to make those profiles first-class and selectable in policy, not to add a second OpenRouter-only profile layer.

### 3. Keep one shared `managedCloudRouting` pool across managed-cloud families

This is the key design decision for model auto-selection.

`managedCloudRouting.roleBindings` should remain the canonical policy object for managed-cloud profile selection, but it must become provider-family neutral.

That means:

- any enabled `managed_cloud` profile can be bound to `general`
- any enabled `managed_cloud` profile can be bound to `direct`
- any enabled `managed_cloud` profile can be bound to `toolLoop`
- any enabled `managed_cloud` profile can be bound to `coding`

If an operator configures both Ollama Cloud and OpenRouter, they should be able to mix them freely inside that same routing object.

Example:

```yaml
assistant:
  tools:
    preferredProviders:
      managedCloud: openrouter-general
    modelSelection:
      managedCloudRouting:
        enabled: true
        roleBindings:
          general: openrouter-general
          direct: openrouter-fast
          toolLoop: ollama-cloud-tools
          coding: openrouter-coding
```

This is the recommended v1 and should be part of the OpenRouter rollout itself.

### 4. Do not collapse `managed_cloud` and `frontier` into one external pool

Guardian's routing model is currently easier to reason about because tier choice happens first, then provider selection happens inside that tier.

Do not replace that with a single "external profiles" pool. That would:

- blur cost and quality policy
- make tier-specific heuristics harder to explain
- weaken execution-profile semantics
- create confusing UI copy and fallback behavior

### 5. Frontier profile mixing should be a separate follow-up, not part of managed-cloud routing

If Guardian later needs profile-level frontier selection such as:

- `claude-fast`
- `claude-deep`
- `gpt-5-high-context`
- `gemini-research`

then the correct design is a parallel `frontierRouting` object, not allowing `managedCloudRouting` to target frontier profiles.

That keeps the tier model intact:

- first choose `managed_cloud` vs `frontier`
- then choose a specific profile inside the chosen tier

## Model Auto-Selection Policy Options

These are the realistic options for the policy layer.

### Option A: Keep one default managed-cloud profile only

This is the smallest change, but it wastes most of the value of OpenRouter. Operators would still need to choose one global managed-cloud default and could not split roles across OpenRouter and Ollama Cloud.

Do not choose this.

### Option B: Shared managed-cloud routing pool across Ollama Cloud and OpenRouter

This keeps the existing architecture, uses the existing `managedCloudRouting` object, and generalizes it so every `managed_cloud` profile is eligible for role binding.

This is the recommended implementation.

### Option C: Add frontier role routing too

This is reasonable, but it should be a separate phase after OpenRouter lands. It is not required to make OpenRouter useful, and it should not block the managed-cloud rollout.

### Option D: One unified external routing object for every cloud profile

This is the wrong direction. It collapses two intentionally different tiers and makes routing harder to understand and validate.

Do not choose this.

## Desired End State

After this work:

- Guardian has a built-in `openrouter` provider type
- OpenRouter profiles appear in Config Center as managed-cloud providers
- OpenRouter profiles support live model discovery and OpenRouter-specific advanced settings
- the preferred managed-cloud provider can be an OpenRouter profile or an Ollama Cloud profile
- `managedCloudRouting.roleBindings` can target any enabled managed-cloud profile, regardless of family
- existing Ollama Cloud-only configurations keep working unchanged
- the managed-cloud policy copy in the UI is no longer Ollama-specific
- the tier model remains `local` vs `managed_cloud` vs `frontier`

## Config Model Direction

### Provider type

Add a new provider type:

```ts
provider: 'openrouter'
```

Recommended metadata:

- `displayName: 'OpenRouter'`
- `locality: 'external'`
- `tier: 'managed_cloud'`
- `requiresCredential: true`
- `defaultBaseUrl: 'https://openrouter.ai/api/v1'`

### `LLMConfig` extension

Add an OpenRouter-specific config block rather than overloading generic `baseUrl` and `model` fields with every advanced behavior.

Recommended shape:

```ts
interface LLMConfig {
  provider: string;
  credentialRef?: string;
  baseUrl?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  openrouterOptions?: {
    fallbackModels?: string[];
    provider?: {
      order?: string[];
      allowFallbacks?: boolean;
      requireParameters?: boolean;
    };
    transforms?: string[];
    attribution?: {
      httpReferer?: string;
      title?: string;
    };
    extraBody?: Record<string, unknown>;
  };
}
```

Notes:

- keep the operator-facing config small and stable
- expose the high-value OpenRouter controls directly
- keep an `extraBody` escape hatch for lesser-used request fields so Guardian does not need a schema change every time OpenRouter adds a new request knob
- keep generic `baseUrl` support so self-hosted proxies or testing stubs still work

Example target shape:

```yaml
llm:
  openrouter-general:
    provider: openrouter
    model: anthropic/claude-sonnet-4.6
    credentialRef: llm.openrouter.primary
    openrouterOptions:
      fallbackModels:
        - openai/gpt-5.2
      provider:
        order:
          - anthropic
          - openai
        allowFallbacks: true
      transforms:
        - middle-out
      attribution:
        httpReferer: https://guardian.local
        title: GuardianAgent
```

## Runtime Provider Design

### Use a first-class `OpenRouterProvider`

Add a dedicated provider implementation rather than routing everything through `OpenAIProvider`.

Recommended file:

- `src/llm/openrouter.ts`

Reasons:

- OpenRouter is a real product surface with its own SDK and request features
- Guardian needs first-class control of OpenRouter-specific request options
- error handling, model listing, and request-shape mapping should be provider-aware
- it avoids turning `OpenAIProvider` into a growing provider-specific options switchboard

### Provider responsibilities

The `OpenRouterProvider` should:

- initialize with the official OpenRouter SDK
- map Guardian `ChatMessage[]` and `ChatOptions` into OpenRouter request payloads
- support tool calling and streaming
- support cancellation via `AbortSignal`
- support `listModels()` against OpenRouter's model catalog
- merge `model`, `maxTokens`, and `temperature` overrides with profile defaults
- apply `openrouterOptions` consistently for chat and stream requests
- normalize OpenRouter errors into Guardian-friendly operator messages

### Non-goal

Do not replace the existing `openai` provider path with OpenRouter logic. OpenRouter should be additive, not a hidden alias.

## Implementation Phases

## Phase 1: Provider Metadata And Registry

### Goal

Make OpenRouter a real built-in provider type with managed-cloud classification.

### Deliver

- add `openrouter` to provider metadata
- add `openrouter` to provider registry
- add a curated default model for new OpenRouter profiles
- expose OpenRouter through dashboard provider-type APIs
- update fallback provider-type lists in the web UI

### Likely implementation areas

- `src/llm/provider-metadata.ts`
- `src/llm/provider-registry.ts`
- `src/llm/provider-registry.test.ts`
- `src/runtime/control-plane/provider-config-helpers.ts`
- `src/channels/web-types.ts`
- `web/public/js/pages/config.js`

## Phase 2: Config Schema, Validation, And Secret Plumbing

### Goal

Extend config types and control-plane update paths to understand OpenRouter-specific settings.

### Deliver

- add `openrouterOptions` to `LLMConfig`
- add matching support to `ConfigUpdate`
- update config loader validation and normalization
- preserve secret handling through the existing `credentialRef` flow
- ensure provider deletion pruning keeps managed-cloud policy references clean

### Likely implementation areas

- `src/config/types.ts`
- `src/channels/web-types.ts`
- `src/runtime/control-plane/direct-config-update.ts`
- `src/runtime/control-plane/direct-config-update.test.ts`
- config loader and validation paths

## Phase 3: First-Class OpenRouter Runtime Provider

### Goal

Implement full OpenRouter request and model-listing behavior behind a dedicated provider.

### Deliver

- add `src/llm/openrouter.ts`
- wire the provider into the registry
- implement chat, stream, tool-call, and usage mapping
- implement friendly OpenRouter-specific error messages
- implement live model discovery for the Config Center

### Likely implementation areas

- `src/llm/openrouter.ts`
- `src/llm/provider-registry.ts`
- `src/llm/types.ts`
- provider tests covering chat params, streaming, and model listing

## Phase 4: Config Center And Setup UX

### Goal

Expose OpenRouter as a first-class managed-cloud provider in the configuration surface.

### Deliver

- add OpenRouter to the provider-type picker
- provide OpenRouter-specific advanced fields in the provider editor
- support live model loading from OpenRouter
- generalize "Ollama Cloud" copy to "Managed Cloud" where the UI is really talking about tier behavior
- keep provider-family-specific wording only inside the actual profile editor

### UX rule

The model-selection policy must talk about managed-cloud behavior, not Ollama Cloud specifically. Provider-family-specific configuration belongs in the profile editor, not in the shared routing-policy panel.

### Likely implementation areas

- `web/public/js/pages/config.js`
- web API payload types in `src/channels/web-types.ts`
- any setup dashboard callbacks that assume Ollama Cloud is the only managed-cloud provider
- `docs/design/WEBUI-DESIGN.md` if the implementation requires spec wording updates
- `src/reference-guide.ts`

## Phase 5: Managed-Cloud Auto-Selection Policy Generalization

### Goal

Make the existing Model Auto Selection Policy work across both Ollama Cloud and OpenRouter profiles.

### Deliver

- keep `assistant.tools.modelSelection.managedCloudRouting` as the canonical object
- make every enabled `managed_cloud` profile eligible for role binding
- rename policy copy from "Ollama Cloud" to "managed cloud"
- keep `preferredProviders.managedCloud` as the default managed-cloud slot
- preserve existing role-binding semantics:
  - `general`
  - `direct`
  - `toolLoop`
  - `coding`
- update fallback ordering and tests so mixed-family managed-cloud sets remain deterministic

### Example supported configuration

```yaml
assistant:
  tools:
    preferredProviders:
      managedCloud: openrouter-general
    modelSelection:
      autoPolicy: balanced
      managedCloudRouting:
        enabled: true
        roleBindings:
          general: openrouter-general
          direct: openrouter-fast
          toolLoop: ollama-cloud-tools
          coding: openrouter-coding
```

### Important rule

Do not add a separate `openrouterRouting` object. OpenRouter should join the existing managed-cloud routing pool rather than creating a second policy path.

### Likely implementation areas

- `src/runtime/execution-profiles.ts`
- `src/runtime/execution-profiles.test.ts`
- `src/runtime/control-plane/direct-config-update.ts`
- `src/runtime/control-plane/direct-config-update.test.ts`
- `web/public/js/pages/config.js`

## Phase 6: Migration, Compatibility, And Verification

### Compatibility goals

- existing Ollama Cloud configs continue to work unchanged
- existing `managedCloudRouting` configs remain valid
- operators who never configure OpenRouter see no behavior change
- OpenRouter can be introduced incrementally via new named profiles

### Verification plan

- unit tests for provider metadata and registry
- unit tests for OpenRouter request mapping and model listing
- execution-profile tests that mix OpenRouter and Ollama Cloud bindings
- direct-config update tests covering create, update, delete, and pruning flows
- config-center smoke checks for provider editing and model-policy saving
- integration harness runs for any touched provider/config web flows

Recommended verification commands after implementation:

- `npm run check`
- `npm test`
- `npx vitest run src/runtime/execution-profiles.test.ts`
- `npx vitest run src/runtime/control-plane/direct-config-update.test.ts`
- focused provider tests for the new OpenRouter runtime
- relevant web/config harnesses if the config UI changes materially

## Deferred Follow-Up: Frontier Profile Routing

This should not block OpenRouter, but it is the correct next step if operators later want profile-level frontier routing.

Recommended future shape:

```ts
interface AssistantModelSelectionConfig {
  managedCloudRouting?: ManagedCloudRoutingConfig;
  frontierRouting?: FrontierRoutingConfig;
}
```

That future phase would allow profile-level frontier bindings such as different Claude, GPT, or Gemini profiles while preserving the same tier-first decision model.

### Recommendation

For this OpenRouter project:

- implement shared managed-cloud routing now
- do not add a dedicated OpenRouter-only policy object
- do not collapse managed-cloud and frontier into one pool
- defer `frontierRouting` unless there is a separate product decision to expose profile-level frontier role binding

## Summary

The right implementation is:

1. add OpenRouter as a first-class `managed_cloud` provider
2. give it first-class provider config and runtime support
3. generalize the existing managed-cloud policy so both Ollama Cloud and OpenRouter profiles can be mixed and matched
4. keep frontier routing separate unless and until Guardian intentionally adds a parallel `frontierRouting` feature

That preserves the current architecture while making the managed-cloud tier materially more useful.
