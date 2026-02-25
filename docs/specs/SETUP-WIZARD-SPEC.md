# Setup Wizard Spec (Deprecated)

## Status
Deprecated. The interactive CLI `/setup` wizard is no longer part of the primary UX.

## Replacement
- Use `docs/specs/CONFIG-CENTER-SPEC.md` for current behavior.
- Configure providers/channels via:
  - Web: `#/config`
  - CLI: `/config ...`
- Runtime/orchestration visibility via:
  - Web: `#/assistant`
  - CLI: `/assistant`

## Legacy Endpoint Note
The backend still exposes:
- `GET /api/setup/status`
- `POST /api/setup/apply`

These endpoints are retained for Config Center readiness/apply flows, not for an interactive wizard.

