# MCP Apps And Multimodal Integration Proposal

**Date:** 2026-04-21  
**Status:** Proposed  
**Origin:** Investigation of FastMCP 3.2 MCP Apps capabilities and GuardianAgent's current gaps for native multimodal model support across chat, tooling, and provider adapters.

## Executive Summary

Guardian should pursue **two complementary uplifts** that share one architectural foundation:

1. **MCP Apps host support** in Guardian web chat for interactive tool UIs such as uploaders, forms, dashboards, and evidence viewers.
2. **Shared multimodal message and attachment support** so Guardian can pass images and other media directly to vision-capable models instead of flattening everything to text.

These are related but not interchangeable:

- **MCP Apps** solves richer **tool UX**.
- **Multimodal message support** solves richer **model input/output**.

The right move is:

**Add a shared attachment/content-part layer, preserve rich tool results end-to-end, implement MCP Apps hosting in the web chat, and extend provider adapters to support native multimodal chat payloads.**

Guardian should not:

- replace its runtime, routing, approvals, or control plane with FastMCP
- introduce Kimi-specific or provider-specific special cases in the orchestration layer
- treat app-side UI controls as enforcement-grade approval boundaries

## What This Proposal Covers

This proposal combines two tracks that should be designed together.

### Track A: MCP Apps host support

Use the official MCP Apps extension so Guardian can:

- render interactive tool UIs inline in web chat
- host tool-local dashboards, forms, and uploaders
- support app-only backend tools while keeping Guardian in the enforcement path

### Track B: Native multimodal chat support

Extend Guardian's shared message contracts so it can:

- accept file/image attachments from channels
- preserve attachment metadata through orchestration
- serialize image/text content to vision-capable providers such as Ollama Cloud profiles and future OpenAI/Anthropic-compatible multimodal profiles
- keep large payloads out of the model context unless explicitly needed

### Shared foundation

Both tracks should depend on the same Guardian-owned substrate:

- a **content-part model** instead of plain `content: string`
- a **durable attachment/reference model**
- a **response metadata model** that separates model-facing compact summaries from user-facing rich payloads

That shared foundation is the real architectural uplift. The FastMCP host work and multimodal provider work should build on it, not each invent their own side channel.

## Why This Matters For Guardian

Guardian's current architecture has two related limitations:

### 1. MCP results are intentionally flattened

Guardian's current MCP path is useful but narrow:

- `src/tools/mcp-client.ts` only handles `initialize`, `tools/list`, and `tools/call`
- MCP transport is currently **stdio only**
- MCP tool results are flattened back to text for Guardian's tool pipeline
- non-text MCP content is explicitly reduced to placeholders like `[MCP image output omitted]` and `[MCP resource output omitted]`
- the web chat renders structured pending actions, but it does **not** have an embedded MCP app host, iframe sandbox, or UI bridge

That means Guardian can already call FastMCP servers as plain MCP servers, but it cannot use the capability that makes FastMCP 3.2 strategically interesting: **interactive app rendering with rich result preservation**.

### 2. Chat and provider contracts are text-only

Guardian's shared chat contracts are also intentionally text-first:

- `src/agent/types.ts` uses `UserMessage.content: string`
- `src/llm/types.ts` uses `ChatMessage.content: string` and `ChatResponse.content: string`
- `web/public/js/chat-panel.js` exposes a textarea/send flow, not a first-class attachment flow
- provider adapters currently serialize plain text prompts rather than multipart content

That means Guardian cannot use the full value of multimodal models even when a provider supports image input. An attached screenshot or document image cannot flow through the shared system as a first-class chat input.

## Current Fit Assessment

| Area | Target capability | Guardian today | Assessment |
|---|---|---|---|
| MCP tool consumption | Good | Implemented | **Strong** |
| MCP Apps host rendering | iframe host + app bridge + UI resources | Not implemented | **Missing** |
| Rich MCP result preservation | retain `structuredContent`, resources, links, UI metadata | Current pipeline compacts to text/JSON | **Missing** |
| Shared multimodal request contract | content parts and attachment references | `content: string` in shared message types | **Missing** |
| Channel attachment intake | file picker / drag-drop / paste / metadata | No first-class chat attachment flow | **Missing** |
| Provider multipart serialization | image/text/file parts to capable models | Text-first provider payloads | **Missing** |
| Capability-aware model selection | prefer vision-capable profiles when attachments exist | Partial profile selection, no shared modality contract | **Partial base** |
| Security enforcement for tool/app actions | shared policy and approvals | Strong existing Guardian enforcement path | **Strong base** |
| Web host surface | inline apps and inline attachment rendering | Structured metadata rendering only | **Partial base** |
| Python authoring ergonomics | FastMCP strength | Guardian is TypeScript-first | **Good for sidecars, poor for core rewrite** |

Bottom line:

**Guardian is well positioned to become both an MCP Apps host and a multimodal chat client, but it is neither today.**

## Architectural Position

Guardian should treat FastMCP as:

- a **good provider-side authoring substrate** for external or managed MCP app providers
- a **useful source of interaction patterns** for tooling UX
- **not** the ownership layer for Guardian's routing, approvals, policy, or control plane

Guardian should treat multimodal support as:

- a **shared runtime contract change**
- **not** a model-specific feature toggle bolted onto one provider

That keeps Guardian aligned with its architecture guidance:

- Intent stays gateway-first
- approvals stay shared and enforcement-grade
- tool execution stays inside `ToolExecutor`
- control-plane behavior stays in Guardian-owned services
- external MCP servers remain bounded integrations
- multimodal inputs flow through shared message/orchestration contracts rather than bespoke per-model shortcuts

## Key Design Principle

The same uploaded image or document should be able to flow through Guardian in several different ways without duplicate plumbing:

- rendered in chat for the user
- passed to a tool or MCP app through a policy-aware attachment reference
- indexed or ingested by a managed workflow
- serialized directly to a vision-capable model when the active profile supports it

That means Guardian needs **one attachment/reference substrate**, not separate upload mechanisms for web chat, MCP Apps, and provider adapters.

## Best-Fit Use Cases

These are the strongest early uses for the combined proposal.

### 1. Interactive ingestion and collection tooling

Best fit:

- drag-and-drop evidence/doc uploads
- indexed corpus intake for search / Second Brain / research flows
- structured incident intake or triage forms

Why this fits:

- it improves operator workflow materially
- it avoids stuffing raw uploaded content into the model context by default
- it complements Guardian's existing search, memory, and evidence workflows

### 2. Tool-local dashboards and data tables

Best fit:

- search result exploration
- system / security / threat-intel status boards
- evidence viewers
- workflow execution summaries

Why this fits:

- many Guardian tools already produce structured data that is awkward as plain text
- dashboards are local to the tool result and do not require new top-level routes

### 3. Native screenshot and image reasoning

Best fit:

- "what is in this screenshot?" flows
- UI/debugging requests where the model should inspect an uploaded image directly
- evidence triage where the model should reason over a screenshot before deciding what tools to call

Why this fits:

- this is the direct value path for vision-capable models
- it cannot be solved by MCP Apps alone
- it benefits from the same attachment intake and metadata flow used by upload-oriented tool UIs

### 4. Mixed human-in-the-loop workflows

Best fit:

- user uploads evidence through an app UI, then asks the model to analyze a selected image
- model inspects an uploaded screenshot and then launches a tool-local dashboard for deeper exploration
- structured intake forms produce both tool calls and model-visible compact summaries

Why this fits:

- the app-host and multimodal tracks compound each other's value
- a shared attachment/reference layer prevents duplicated logic

## Poor-Fit Or High-Risk Areas

### 1. Replacing Guardian approvals with FastMCP `Approval`

Do **not** use FastMCP's `Approval` provider as Guardian's approval model.

Reason:

- FastMCP documents it as **advisory**, not enforcement-grade
- Guardian approvals are server-enforced, shared across channels, durable, auditable, and resume-aware
- replacing that with app-side buttons would be an architectural regression

Use case:

- acceptable as a non-authoritative UX pattern for low-risk third-party app flows
- not acceptable as Guardian's actual approval boundary

### 2. Starting with `GenerativeUI`

Do **not** make this the first phase.

Reason:

- runtime-generated UI code is a much larger security and review surface
- it introduces Pyodide/Deno/browser sandbox concerns
- it increases testing difficulty sharply
- Guardian should not begin with the least deterministic option

Recommendation:

- revisit only after fixed app hosting is stable

### 3. Adding model-specific multimodal shortcuts

Do **not** bolt image support onto one provider adapter or one route with special-case plumbing.

Reason:

- Guardian's bottleneck is the shared message contract, not one model
- special-casing Kimi, GLM, OpenAI, or Anthropic at the orchestration layer would create drift immediately
- the right fix belongs in shared message types, attachment transport, and provider capability metadata

### 4. Rewriting first-party Guardian tools around FastMCP

Do **not** move core built-in tools to Python/FastMCP just because the app model is attractive.

Reason:

- Guardian's control plane, routing, audit, approvals, and tool policy model are TypeScript-native
- a rewrite would duplicate runtime authority and create split ownership
- it would violate the repo's architectural direction unless made as an explicit platform redesign

## Recommended Integration Strategy

### Recommendation A: Add a shared attachment and content-part layer first

This is the architectural prerequisite for both tracks.

Guardian should introduce:

- content parts such as `text`, `image`, and optionally `file`
- durable attachment references with metadata
- a shared response metadata structure that can carry UI payloads and attachment descriptors separately from compact assistant text

This becomes the common substrate for:

- native multimodal model input
- MCP Apps upload and rendering flows
- structured evidence handling
- future channel-specific attachment UX

### Recommendation B: Make Guardian an MCP Apps host

Guardian should implement the official MCP Apps host model in the web chat using the official host-side SDK:

- `@modelcontextprotocol/ext-apps/app-bridge`

What this enables:

- Guardian can connect to FastMCP 3.2 servers and other MCP Apps servers
- tool calls can render inline app cards/iframes in the web chat
- app UIs can call backend tools through Guardian while Guardian still enforces policy

### Recommendation C: Extend provider adapters for native multimodal chat

Guardian should then add provider-side support for multipart chat payloads so attachment-bearing messages can reach capable models directly.

This should include:

- capability-aware serialization in `src/llm/ollama.ts`, `src/llm/openai.ts`, and `src/llm/anthropic.ts`
- graceful downgrade when the selected model is text-only
- routing/profile metadata that can prefer a vision-capable profile when attachments are present

### Recommendation D: Keep FastMCP provider-side, not runtime-core

Use FastMCP mainly for:

- managed sidecar providers
- internal admin / ops / evidence tooling
- specialized UI-heavy integrations

Do not use it to own:

- Intent Gateway
- PendingActionStore semantics
- policy evaluation
- core tool execution authority

### Recommendation E: Pilot only narrow, high-value workflows first

Best first pilots:

1. **Evidence upload + review**
2. **Structured intake / triage forms**
3. **Native screenshot analysis with a vision-capable model**

Avoid broad rollout before the shared substrate is proven.

## What Guardian Needs To Implement

### 1. Extend MCP support beyond tools-only

Primary files:

- `src/tools/mcp-client.ts`
- `docs/design/MCP-CLIENT-DESIGN.md`

Needed changes:

- negotiate the MCP Apps extension capability
- support `resources/list` and `resources/read`
- preserve UI resource metadata, not just tool schemas
- support visibility-aware tool registration for model-visible vs app-only tools
- retain complete `tools/call` results, including `structuredContent`, `resource`, and `resource_link` style content instead of flattening everything to text

Important note:

- **stdio is enough for the first pilot**
- Guardian does **not** need SSE/HTTP on day one to benefit from MCP Apps
- remote HTTP transport can be a later phase if hosted app-capable MCP providers become a priority

### 2. Add an MCP Apps session and bridge layer in the web chat

Primary surfaces:

- `web/public/js/chat-panel.js`
- `src/channels/web-types.ts`
- likely new web components/modules for app hosting

Needed behavior:

- create an app container per rendered app tool result
- host a sandboxed iframe for the `ui://` resource
- connect the iframe to the MCP server through an app bridge
- send `ui/notifications/tool-input`, `tool-input-partial`, `tool-result`, and teardown events
- keep app state scoped to the current MCP server connection and chat surface

Strong recommendation:

- implement this as a dedicated host component, not as ad hoc logic in `chat-panel.js`
- likely new module such as `web/public/js/components/mcp-app-host.js`

### 3. Preserve app-capable tool result metadata through the runtime

Primary surfaces:

- `src/tools/types.ts`
- `src/tools/job-results.ts`
- `src/runtime/chat-agent/tool-loop-runtime.ts`
- `src/chat-agent-helpers.ts`

Needed changes:

- introduce a richer internal tool-result shape for MCP results
- keep model-facing summaries compact, but retain UI-facing payloads separately in response metadata
- avoid reinjecting heavy app payloads into the model context window
- allow the user-facing response to render the app while the model sees only the compact structured result

This matches the intended split:

- model sees compact reasoning payload
- user sees interactive UI

### 4. Add a shared multimodal message and content-part contract

Primary surfaces:

- `src/agent/types.ts`
- `src/llm/types.ts`
- shared response metadata and orchestration types

Needed changes:

- replace plain `content: string` assumptions with a shared content-part model
- support at minimum `text` and `image` parts
- leave room for `file` and later `audio`/`video` without forcing first-phase support
- preserve plain-string convenience where possible, but normalize internally to structured parts
- keep assistant text separate from attachment/resource metadata so large payloads do not automatically inflate transcript context

Recommended shape:

- `text` parts for normal chat content
- `image` parts for uploaded screenshots or image references
- `file` references for non-image uploads that should be routed to tools or ingestion flows rather than blindly injected into model context

### 5. Add a shared attachment intake and reference model

Primary surfaces:

- `web/public/js/chat-panel.js`
- channel request payloads and metadata
- attachment persistence / temporary storage surfaces

Needed behavior:

- file picker, drag-and-drop, and paste support in web chat
- attachment references with metadata such as MIME type, size, filename, hash, and storage location
- explicit separation between uploaded bytes and model-visible content parts
- policy-aware lifetime and cleanup rules
- reusable attachment references so the same upload can be inspected by the user, passed to a tool, or sent to a multimodal provider without duplicate upload logic

Important rule:

**attachments are transport objects, not implicit model context**

Uploads should become model-visible only when a route, tool, or provider serializer explicitly chooses that behavior.

### 6. Add provider multipart serializers and response handling

Primary surfaces:

- `src/llm/ollama.ts`
- `src/llm/openai.ts`
- `src/llm/anthropic.ts`
- model/profile capability metadata surfaces

Needed changes:

- serialize mixed text/image content for providers that support multimodal chat
- preserve text-only behavior for providers that do not
- add capability metadata such as `inputModalities` or `supportsVision`
- prefer capable profiles when attachments are present, while still allowing explicit user override
- preserve auxiliary provider metadata when useful, rather than collapsing everything prematurely to plain text

The first goal is not "all modalities everywhere". The first goal is:

- text + image in shared chat contracts
- safe fallback for text-only profiles
- no provider-specific orchestration hacks

### 7. Preserve Guardian's security and approval model for app-originated and attachment-bearing actions

Primary surfaces:

- `src/tools/executor.ts`
- Guardian admission / policy layers
- shared pending-action metadata flow

Needed behavior:

- app-triggered tool calls must still go through `ToolExecutor`
- policy, approvals, taint handling, audit, and rate limits must still apply
- attachment-bearing tool calls must preserve provenance and policy labels
- app-only tools must be isolated to the same server connection and validated against visibility metadata
- hard approvals must remain Guardian-owned, not app-owned

This is the core rule:

**the app bridge and attachment layer are transport features, not bypasses around Guardian's enforcement path**

### 8. Implement the required sandbox and CSP model

The MCP Apps spec requires a real host sandbox model, including:

- host and sandbox on different origins
- iframe sandboxing
- CSP enforcement derived from resource metadata
- controlled forwarding between host and view

Minimum requirements for Guardian:

- sandboxed iframe with only the minimum permissions needed
- strict origin separation
- CSP/domain allowlisting driven by resource metadata
- teardown semantics and lifecycle cleanup
- explicit limits around nested iframes and external fetch domains

This work likely deserves its own design doc before implementation:

- `docs/design/MCP-APPS-HOST-DESIGN.md`

### 9. Add config, diagnostics, and operator visibility

Primary surfaces:

- MCP config validation
- model/profile capability metadata
- Tools dashboard / status surfaces
- MCP diagnostics

Needed additions:

- whether MCP Apps hosting is enabled
- whether a given server exposes app-capable tools/resources
- whether a profile supports multimodal input
- why an attachment was or was not passed to the model
- basic app-host diagnostics and failures
- per-server policy around app rendering if needed

## Implementation Phases

### Phase 1: Shared foundation

- add content-part and attachment-reference types
- add richer internal response metadata for MCP app payloads
- define compact model-facing summary rules versus user-facing rich payloads
- document the architecture

Exit criteria:

- Guardian can preserve rich tool metadata and attachment descriptors end-to-end without flattening them into plain text

### Phase 2: Web attachment intake MVP

- add file picker, drag-and-drop, and paste support in the web chat
- surface attachment chips/previews and metadata
- keep uploads as references, not transcript blobs

Exit criteria:

- a user can attach an image or file in web chat and Guardian retains it as a first-class attachment reference

### Phase 3: Provider multimodal MVP

- add text + image serialization for supported providers
- add capability-aware fallback for text-only models
- preserve compact transcript behavior

Exit criteria:

- an uploaded screenshot can be sent end-to-end to a vision-capable model through the shared chat path

### Phase 4: MCP Apps host MVP

- add sandboxed iframe host component in the web chat
- integrate `@modelcontextprotocol/ext-apps/app-bridge`
- render fixed app results from trusted local test servers

Exit criteria:

- an `app=True` MCP tool can render inside Guardian web chat

### Phase 5: App tool callbacks and policy integration

- support app-only backend tool calls
- ensure Guardian approvals/policy still gate actions
- audit app-originated tool calls and failures

Exit criteria:

- a multi-step MCP app with model-visible entrypoint and app-only backend tools works safely

### Phase 6: Managed workflow pilots

Pilot:

- evidence upload + review
- structured intake / triage form
- native screenshot analysis

Exit criteria:

- at least one tool-driven workflow and one model-driven multimodal workflow benefit measurably from the shared substrate

### Phase 7: Optional advanced work

- streamable HTTP / SSE transports for remote app-capable MCP servers
- richer dashboard surfaces
- carefully scoped evaluation of `Choice`
- later, limited evaluation of `GenerativeUI`
- later modality expansion beyond text + image where justified

## Testing And Harness Impact

This work needs more than unit tests.

Required coverage areas:

- `src/tools/mcp-integration.test.ts`
- shared message/content-part serialization tests
- attachment metadata and lifecycle tests
- provider adapter tests for multimodal payloads
- MCP Apps host/bridge tests
- web chat rendering tests for attachments and inline apps
- approval/policy tests for app-originated and attachment-bearing tool calls
- teardown/lifecycle tests

Likely harness additions:

- a fake app-capable MCP server fixture
- a fake or recorded multimodal payload fixture
- web smoke harness for inline app rendering
- web smoke harness for attachment upload and preview
- end-to-end screenshot-analysis smoke test against a multimodal-capable provider profile
- approval continuation tests where an app callback triggers a policy-gated action

Do not ship this without:

- integration harness coverage for the web chat path
- security review of iframe/CSP/origin handling
- regression coverage for text-only providers so the baseline chat path stays stable

## Recommendation Summary

Recommended:

1. **Adopt a shared attachment/content-part substrate first**
2. **Add MCP Apps host support in Guardian web chat**
3. **Extend provider adapters for native multimodal chat payloads**
4. **Use FastMCP as a provider-side authoring framework, not a runtime rewrite**
5. **Keep Guardian approvals and enforcement fully server-side**
6. **Pilot evidence upload and screenshot-analysis workflows first**

Not recommended:

1. replacing Guardian's approval system with FastMCP `Approval`
2. starting with `GenerativeUI`
3. adding provider-specific orchestration hacks for multimodality
4. migrating first-party Guardian runtime/tooling ownership to FastMCP/Python

## Final Judgment

**Yes, GuardianAgent should pursue this combined capability.**

But the thing to pursue is:

- **MCP Apps support inside Guardian's existing architecture**
- **multimodal chat support inside Guardian's shared message and provider architecture**

If Guardian only adds MCP Apps hosting, it still cannot use vision-capable models directly.  
If Guardian only adds multimodal prompt transport, it still misses the richer upload, form, and dashboard UX that MCP Apps enables.

The right proposal is therefore a combined one:

- shared attachment/content-part foundation
- rich tool result preservation
- MCP Apps hosting
- provider-native multimodal serialization

## Sources

- [FastMCP 3.2 announcement](https://jlowin.dev/blog/fastmcp-3-2)
- [FastMCP Apps overview](https://gofastmcp.com/apps/overview)
- [FastMCP Generative UI docs](https://gofastmcp.com/apps/generative)
- [FastMCP File Upload provider](https://gofastmcp.com/apps/providers/file-upload)
- [FastMCP Form Input provider](https://gofastmcp.com/apps/providers/form)
- [FastMCP Approval provider](https://gofastmcp.com/apps/providers/approval)
- [FastMCP Choice provider](https://gofastmcp.com/apps/providers/choice)
- [PyPI: fastmcp 3.2.4](https://pypi.org/project/fastmcp/)
- [Official MCP Apps docs](https://apps.extensions.modelcontextprotocol.io/api/)
- [MCP Apps spec (SEP-1865, 2026-01-26)](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx)
- [Kimi K2.6 on Ollama](https://ollama.com/library/kimi-k2.6)
- [Kimi K2.6 quickstart](https://platform.kimi.com/docs/guide/kimi-k2-6-quickstart)
