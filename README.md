# GuardianAgent

Security-first AI agent orchestration system. Built-in agents with predefined capabilities, strict guardrails on what they can and cannot do, and a three-layer defense system that enforces security at every stage of the message lifecycle.

## What This Is

GuardianAgent is a self-contained orchestrator for personal assistant AI. Agents are built into the system with predefined capabilities. The Runtime manages their lifecycle. The LLM output is the untrusted component, not the agent code, and all enforcement targets the data path where risk lives.

All security enforcement is **mandatory at the Runtime level**. Agents cannot bypass it.

## Three-Layer Defense

**Layer 1 — Proactive (before the agent sees input):**
- Prompt injection detection with invisible Unicode stripping (18 signal patterns)
- Per-agent rate limiting (burst, per-minute, per-hour sliding windows)
- Capability enforcement (per-agent permission grants)
- Secret scanning (28+ credential patterns: AWS, GCP, GitHub, OpenAI, Stripe, Slack, and more)
- Sensitive path blocking with traversal normalization

**Layer 2 — Output (after the agent responds, before output reaches anyone):**
- GuardedLLMProvider scans every LLM response for secrets automatically
- Response redaction replaces detected credentials with `[REDACTED]`
- Inter-agent event payloads are scanned before dispatch
- All detections logged to the audit trail

**Layer 3 — Sentinel (retrospective, scheduled):**
- Sentinel agent analyzes the audit log on a cron schedule
- Detects anomaly patterns: capability probing, repeated secret detections, volume spikes, error storms
- Optional LLM-enhanced analysis for deeper pattern recognition

## Mandatory Enforcement

The Runtime controls every chokepoint where data flows in or out of an agent:

| Path | Enforcement |
|------|-------------|
| Message input | Guardian pipeline runs before agent sees it |
| LLM access | Agents get GuardedLLMProvider, not the raw provider |
| Response output | Scanned and redacted before reaching user |
| Event emission | Payloads scanned for secrets before dispatch |
| Resource limits | Concurrent, queue depth, token rate, wall-clock budgets |
| Agent context | Frozen with Object.freeze — capabilities immutable |

There is no `ctx.fs`, `ctx.http`, or `ctx.exec`. The agent's only interaction points are `ctx.llm` (guarded), `ctx.emit()` (scanned), and returning a response (scanned).

## Quick Start

```bash
npm install guardianagent
```

Create `~/.openagent/config.yaml`:

```yaml
llm:
  ollama:
    provider: ollama
    model: llama3.2

defaultProvider: ollama

channels:
  cli:
    enabled: true

guardian:
  enabled: true
  logDenials: true
```

Run:

```bash
npx guardianagent
# or
guardianagent              # if installed globally
```

## Configuration

```yaml
llm:
  ollama:
    provider: ollama
    model: llama3.2
  claude:
    provider: anthropic
    apiKey: ${ANTHROPIC_API_KEY}
    model: claude-sonnet-4-20250514

defaultProvider: ollama

channels:
  cli:
    enabled: true
  telegram:
    enabled: true
    botToken: ${TELEGRAM_BOT_TOKEN}
    allowedChatIds: [12345678]
  web:
    enabled: true
    port: 3000
    authToken: ${WEB_AUTH_TOKEN}

guardian:
  enabled: true
  logDenials: true
  inputSanitization:
    enabled: true
    blockThreshold: 3
  rateLimit:
    maxPerMinute: 30
    maxPerHour: 500
    burstAllowed: 5
  outputScanning:
    enabled: true
    redactSecrets: true
  sentinel:
    enabled: true
    schedule: '*/5 * * * *'
  auditLog:
    maxEvents: 10000
```

## LLM Providers

- **Ollama** — local models via OpenAI-compatible API
- **Anthropic** — Claude models via `@anthropic-ai/sdk`
- **OpenAI** — GPT models via `openai` SDK

## Channel Adapters

- **CLI** — interactive readline prompt
- **Telegram** — grammy bot framework with chat ID filtering
- **Web** — HTTP REST API with bearer token auth

## Development

```bash
npm test              # Run tests (vitest)
npm run build         # TypeScript compilation
npm run dev           # Run with tsx (development)
npm start             # Run compiled (production)
```

## Architecture

Full documentation in `docs/architecture/`:
- [Overview](docs/architecture/OVERVIEW.md) — system architecture and component map
- [Security](docs/architecture/SECURITY.md) — three-layer defense system details
- [Guardian API](docs/architecture/GUARDIAN-API.md) — complete API reference
- [Decisions](docs/architecture/DECISIONS.md) — architecture decision records

## Disclaimer

This software is provided as-is, without warranty of any kind. GuardianAgent implements security controls designed to reduce risk in AI agent systems, but **no software can guarantee complete security**. The developers and contributors accept no liability for any damages, data loss, credential exposure, financial loss, or other harm arising from the use of this software.

By using GuardianAgent, you acknowledge that:
- AI systems are inherently unpredictable and may produce unexpected outputs
- Security patterns (secret scanning, prompt injection detection) rely on known signatures and heuristics, and may not catch novel or obfuscated attack vectors
- You are solely responsible for the configuration, deployment, and operation of this software in your environment
- You should independently evaluate whether the security controls are sufficient for your use case
- This software should not be used as a sole security control for systems handling sensitive data without additional safeguards

This project is not affiliated with any security certification body and makes no compliance claims.

## License

[MIT](LICENSE)
