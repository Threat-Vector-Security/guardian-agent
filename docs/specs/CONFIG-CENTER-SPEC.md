# Configuration Center Spec

## Goal
Provide one intuitive configuration surface (web + CLI) without an interactive setup wizard.

## Scope
- Web Config Center (`#/config`)
- CLI config commands (`/config ...`)
- Web auth controls in Config Center + CLI (`/auth ...`)
- Readiness diagnostics (`GET /api/setup/status`)
- Unified apply endpoint (`POST /api/setup/apply`) used by Config Center

## Requirements
- Users do not hand-edit YAML for normal onboarding
- Local vs external provider switching is explicit and simple
- Provider testing and model visibility are built-in
- Telegram enable/token/chat-id configuration is part of the same panel
- Web auth mode/token controls are part of the same panel
- Default provider can be changed live

## UX Model
- Web:
  - Provider mode toggle: Local (Ollama) / External API
  - Profile selector (existing + create new)
  - Inline save + connectivity test
  - Readiness checklist and status cards
- CLI:
  - No `/setup` wizard command
  - Use `/config` and `/auth` commands for all configuration actions
  - Use `/assistant` and `/providers` for runtime/health visibility

## Runtime Behavior
- Config writes persist to config YAML via backend callbacks
- LLM/default provider updates apply live through `runtime.applyLLMConfiguration()`
- Telegram channel structural updates still require restart
- Web auth mode is configurable (`bearer_required|localhost_no_auth|disabled`)
- If no token is configured, runtime may generate an ephemeral token for the current process

## Validation Rules
- `model` required
- External providers require API key unless one already exists
- Updated config must pass `validateConfig()`
