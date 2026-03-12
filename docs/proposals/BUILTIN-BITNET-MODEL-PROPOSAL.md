# Built-in BitNet Model Proposal

**Status:** Proposed
**Date:** 2026-03-12
**Informed by:** `https://github.com/microsoft/BitNet`

## Objective

Embed a small, built-in 1-bit LLM inside GuardianAgent to serve as the default engine for security evaluations, intent classification, and emergency fallback — eliminating the hard dependency on external LLM providers for core runtime functions.

## Motivation

GuardianAgent currently depends entirely on external LLM providers (Ollama, Anthropic, OpenAI, etc.) for every function that involves language understanding:

- **Guardian Agent evaluations** — approve/deny decisions on tool actions (Layer 2)
- **Intent classification** — routing inbound messages to the correct agent
- **Sentinel audit analysis** — anomaly triage
- **Emergency fallback** — when all configured providers are down, the system is deaf

This creates three problems:

1. **Availability** — if the network is down or all providers fail, GuardianAgent loses its intelligence entirely. The circuit breaker and failover chain help, but they all assume at least one provider is reachable.
2. **Latency for security decisions** — Guardian Agent inline evaluations add round-trip latency to every mutating tool call. A local 1-bit model running on CPU would complete binary classification in milliseconds.
3. **Cost** — security evaluations, intent routing, and PII classification are high-volume, low-complexity tasks. Sending them to cloud APIs is wasteful.

## Why BitNet

Microsoft's [BitNet.cpp](https://github.com/microsoft/BitNet) is an inference framework for 1.58-bit quantized LLMs. Models use ternary weights (-1, 0, +1), which enables:

| Property | Value |
|----------|-------|
| Model size (2.4B params) | ~400MB on disk |
| CPU inference speed | 5-7 tok/s even at 100B scale; much faster at 2.4B |
| Energy consumption | 55-82% lower than standard quantization |
| Hardware requirement | CPU only (no GPU needed) |
| Memory footprint | Minimal — ternary weights pack ~5x denser than FP16 |
| Format | GGUF (same ecosystem as llama.cpp / Ollama) |
| Server API | OpenAI-compatible `/v1/chat/completions` (inherited from llama.cpp) |

The flagship model, **BitNet-b1.58-2B-4T**, is 2.4B parameters — small enough to be unobtrusive on any modern machine, but large enough for structured classification tasks.

### Why not a standard small GGUF model via Ollama?

- Ollama is an optional dependency; not all deployments have it
- Even the smallest standard quants (Q4_K_M of a 1B model) are 600MB+ and slower on CPU
- BitNet's ternary kernels are purpose-built for CPU efficiency — no GPU fallback needed
- A built-in model is always available, zero configuration

## Scope of Use

The built-in model would handle **structured, constrained tasks only**. It is explicitly not intended as a primary assistant model.

### In scope

| Function | Input | Output | Why it fits |
|----------|-------|--------|-------------|
| Guardian Agent evals | Tool name + args + policy context | `{ allow: bool, reason: string }` | Binary decision, structured prompt, no creativity needed |
| Intent classification | User message + agent list | `{ route: agentId }` | Small fixed label set, pattern matching |
| Secret/PII classification | Text snippet | `{ isSecret: bool, type: string }` | Simple pattern-informed classification |
| Policy rule evaluation | Normalized policy input | `{ decision: allow\|deny, rule: id }` | Constrained structured output |
| Emergency fallback | User message | Free-text response | Degraded but functional when all cloud providers are unreachable |

### Out of scope

- Primary conversational assistant (too small for nuanced reasoning)
- Multi-step tool orchestration (needs stronger planning capability)
- Code generation or analysis
- Long-context tasks (BitNet server defaults to 2048 context window)

## Architecture

### Approach: Managed Subprocess

The built-in model runs as a managed child process using BitNet's llama.cpp-based HTTP server. GuardianAgent manages its full lifecycle.

```
┌─────────────────────────────────────────────────┐
│  GuardianAgent (Node.js)                        │
│                                                 │
│  ┌──────────────────┐  ┌─────────────────────┐  │
│  │  BitNetProvider   │  │  BuiltinModelMgr    │  │
│  │  (LLMProvider)    │──│  (lifecycle)         │  │
│  │                   │  │                      │  │
│  │  chat() ─────────────── HTTP localhost:N ───│──│──┐
│  │  stream()         │  │  spawn / kill        │  │  │
│  └──────────────────┘  │  health check        │  │  │
│           ▲             │  auto-restart        │  │  │
│           │             └─────────────────────┘  │  │
│    Used by:                                      │  │
│    - GuardianAgentService                        │  │
│    - MessageRouter                               │  │
│    - OutputGuardian                              │  │
│    - FallbackChain (last resort)                 │  │
└─────────────────────────────────────────────────┘  │
                                                     │
  ┌──────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────┐
│  BitNet.cpp server (child proc) │
│  - ggml-model-i2_s.gguf        │
│  - localhost:{random_port}      │
│  - /v1/chat/completions         │
│  - 2 threads (configurable)     │
└─────────────────────────────────┘
```

### New Files

```
src/llm/bitnet-provider.ts        — LLMProvider implementation (OpenAI-compatible HTTP)
src/runtime/builtin-model.ts       — Download manager, process lifecycle, health monitoring
bin/                                — Platform-specific pre-compiled BitNet binaries (or build script)
```

### BuiltinModelManager (`src/runtime/builtin-model.ts`)

Responsibilities:

1. **First-run setup** — download the BitNet binary and model file for the current platform to `~/.guardianagent/models/`
2. **Process lifecycle** — spawn the BitNet server on a random available port, manage stdin/stdout/stderr, handle signals
3. **Health monitoring** — periodic `/health` pings, auto-restart on crash with exponential backoff
4. **Graceful shutdown** — SIGTERM on Runtime stop, force-kill after timeout
5. **Resource governance** — configurable thread count and memory ceiling

```typescript
interface BuiltinModelManager {
  start(): Promise<{ port: number }>;
  stop(): Promise<void>;
  isHealthy(): boolean;
  getPort(): number;
}
```

### BitNetProvider (`src/llm/bitnet-provider.ts`)

A thin `LLMProvider` that talks to the local BitNet server. Since BitNet's server is OpenAI-compatible, this could extend or wrap the existing `OpenAIProvider` with:

- Auto-discovery of port from `BuiltinModelManager`
- No API key required
- Hardcoded model name
- Timeout tuned for local inference (shorter than cloud)
- Marked as `type: 'local'` for provider routing

```typescript
class BitNetProvider implements LLMProvider {
  readonly name = 'bitnet-builtin';
  readonly type = 'local';
  // Delegates to OpenAIProvider with baseUrl = http://localhost:{port}/v1
}
```

### Integration Points

#### 1. Provider Registry

Register automatically at bootstrap, no user configuration needed:

```typescript
// src/index.ts bootstrap
if (builtinModelConfig.enabled) {
  const mgr = new BuiltinModelManager(builtinModelConfig);
  await mgr.start();
  const provider = new BitNetProvider(mgr);
  providerRegistry.register('bitnet-builtin', provider);
}
```

#### 2. Guardian Agent Service

Default to the built-in model for inline security evaluations:

```typescript
// src/runtime/sentinel.ts
const provider = config.guardian.guardianAgent.llmProvider === 'auto'
  ? providerRegistry.get('bitnet-builtin') ?? providerRegistry.getDefault()
  : providerRegistry.get(config.guardian.guardianAgent.llmProvider);
```

#### 3. Fallback Chain

Always append as the last-resort provider:

```typescript
// Auto-configured fallback chain
const chain = [...userConfiguredProviders, builtinProvider];
```

#### 4. Smart Routing

The built-in model becomes the implicit `local` provider for smart category defaults when no Ollama or other local provider is configured.

## Distribution

This is the hardest part of the proposal. BitNet.cpp requires platform-specific compiled binaries and a model file.

### Option A: Download on First Run (recommended)

```
~/.guardianagent/
  models/
    bitnet/
      bin/
        bitnet-server-linux-x64       # ~5MB compiled binary
      models/
        bitnet-b1.58-2B-4T.gguf       # ~400MB model
      version.json                     # tracks installed version
```

- On first `Runtime.start()`, `BuiltinModelManager` checks for the binary and model
- If missing, downloads from a release URL (GitHub Releases or a CDN)
- Verifies SHA-256 checksums
- Supports offline installs by pre-placing files

**Platform matrix:**

| Platform | Architecture | Binary |
|----------|-------------|--------|
| Linux | x64 | `bitnet-server-linux-x64` |
| Linux | arm64 | `bitnet-server-linux-arm64` |
| macOS | x64 | `bitnet-server-darwin-x64` |
| macOS | arm64 | `bitnet-server-darwin-arm64` |
| Windows | x64 | `bitnet-server-win-x64.exe` |

### Option B: Build from Source at Install Time

- `postinstall` script clones BitNet repo and compiles
- Requires Clang 18, CMake, Conda — too heavy for most users
- Only viable as a fallback for unsupported platforms

### Option C: Docker Sidecar

- Ship a Docker image with BitNet pre-compiled
- Start container alongside GuardianAgent
- Good for server deployments, poor for desktop/CLI use

**Recommendation:** Option A as primary, Option B as documented manual fallback for exotic platforms.

## Configuration

```yaml
builtinModel:
  enabled: true                    # default: true
  autoDownload: true               # download binary + model on first run
  threads: 2                       # CPU threads for inference
  contextSize: 2048                # context window
  port: auto                       # random available port (or fixed)
  model: BitNet-b1.58-2B-4T       # model identifier
  uses:                            # which subsystems use it
    - guardianAgent                # inline security evaluations
    - intentClassification         # message routing
    - emergencyFallback            # last-resort provider
  downloadUrl: null                # override for air-gapped / custom mirror
  checksum: null                   # override SHA-256 for custom builds
```

The `enabled: true` default means GuardianAgent ships with local intelligence out of the box. Users who don't want the download can set `enabled: false`.

## Resource Budget

Estimated resource consumption on a typical machine:

| Resource | Idle | Active inference |
|----------|------|-----------------|
| RAM | ~500MB (model loaded) | ~600MB |
| CPU | Near zero | 2 threads (configurable) |
| Disk | ~405MB (binary + model) | Same |
| Startup time | ~2-3 seconds (model load) | — |
| Inference latency | — | ~50-200ms for short classifications |

This is lightweight enough to run alongside the main application on any modern machine (8GB+ RAM).

## Rollout Plan

### Phase 1: Foundation

- Implement `BuiltinModelManager` with download, spawn, health check, shutdown
- Implement `BitNetProvider` wrapping the OpenAI-compatible API
- Register in `ProviderRegistry` at bootstrap
- Config types and defaults
- Unit tests with mocked subprocess

### Phase 2: Security Integration

- Wire `GuardianAgentService` to prefer built-in model when available
- Add structured prompts optimized for the 2.4B model's capabilities (shorter, more constrained)
- Benchmark classification accuracy vs cloud models on the existing eval suite
- Add `MessageRouter` intent classification path

### Phase 3: Fallback Chain

- Append built-in model as last-resort in `ModelFallbackChain`
- Add degraded-mode indicator in web UI and CLI when operating on built-in model only
- Test offline scenarios end-to-end

### Phase 4: Distribution

- Set up CI pipeline to compile BitNet binaries for the 5 platform targets
- Host binaries and model on GitHub Releases (or CDN)
- Implement download manager with progress reporting, checksum verification, retry
- Document air-gapped installation

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| 2.4B model accuracy insufficient for security evals | False approvals/denials | Benchmark extensively in Phase 2; fall back to cloud if confidence is low; use structured constrained prompts |
| BitNet.cpp upstream breaking changes | Binary incompatibility | Pin to a specific release tag; vendor the build if needed |
| 400MB download deters users | Adoption friction | Make download optional (`autoDownload: false`); show progress; cache permanently |
| Platform binary maintenance burden | CI complexity | Start with Linux x64 + macOS arm64 (covers 80%+ of users); add others on demand |
| Model loaded but rarely used wastes RAM | Resource waste | Lazy loading — only start the subprocess when first needed; idle timeout to shut down after inactivity |
| BitNet kernels not upstreamed to llama.cpp | Locked to Microsoft's fork | Monitor upstream progress; the managed subprocess approach isolates this dependency |

## Future Possibilities

- **Fine-tuned security model**: Train a BitNet-architecture model specifically on security evaluation data (approve/deny with tool context). Would dramatically improve accuracy for the primary use case.
- **NPU acceleration**: BitNet has announced NPU support. Modern laptops with NPUs (Apple Neural Engine, Intel NPU, Qualcomm Hexagon) could run the built-in model with near-zero CPU impact.
- **GPU offload**: BitNet's GPU support (announced May 2025) could be used when a discrete GPU is available.
- **Larger built-in models**: As BitNet community models grow (Falcon3-10B-1.58 already exists), users could swap in a larger model for better accuracy while keeping the efficiency benefits.
- **WASM compilation**: If BitNet's kernels can compile to WebAssembly with SIMD, the model could run in-process without a subprocess — eliminating the IPC overhead entirely.

## References

- [BitNet.cpp repository](https://github.com/microsoft/BitNet)
- [BitNet b1.58 paper — "The Era of 1-bit LLMs"](https://arxiv.org/abs/2402.17764)
- [T-MAC: lookup table methodology](https://github.com/microsoft/T-MAC)
- GuardianAgent Guardian Agent Service: `src/runtime/sentinel.ts`
- GuardianAgent LLM Provider Registry: `src/llm/provider-registry.ts`
- GuardianAgent Failover Chain: `src/llm/failover.ts`
