# Web Auth Configuration Spec

## Goal
Provide explicit, operator-friendly control of dashboard/API authentication without requiring manual YAML edits.

## Scope
- Config model: `channels.web.auth`
- Runtime auth state on WebChannel
- Dashboard API endpoints:
  - `GET /api/auth/status`
  - `POST /api/auth/config`
  - `POST /api/auth/token/rotate`
  - `POST /api/auth/token/reveal`
  - `POST /api/auth/token/revoke`
- Web Config Center panel and CLI `/auth` commands

## Auth Modes
- `bearer_required`:
  - Non-health endpoints require `Authorization: Bearer <token>` (or SSE token query).
- `localhost_no_auth`:
  - Localhost callers can access without token.
  - Non-local callers still require bearer auth.
- `disabled`:
  - Auth checks are bypassed (development only).

## Token Lifecycle
- Token sources:
  - Explicit config token
  - Environment token
  - Ephemeral runtime-generated token
- Operators can:
  - Set/update token
  - Rotate token
  - Reveal token for copy/paste
  - Revoke token (switches to open mode as configured)

## Validation + Safety
- `sessionTtlMinutes` must be positive when set.
- Invalid modes are rejected.
- Status payload always includes:
  - `mode`
  - `tokenConfigured`
  - `tokenSource`
  - masked `tokenPreview`
- Health endpoint remains unauthenticated for readiness probes.

## UX Requirements
- Config Center shows auth mode, token source, TTL, and token controls.
- CLI supports:
  - `/auth status`
  - `/auth mode <bearer_required|localhost_no_auth|disabled>`
  - `/auth rotate`
  - `/auth reveal`
  - `/auth revoke`
