# Managed Execution Hardening Spec

**Status:** Implemented incremental uplift  
**Primary Files:** `src/channels/web.ts`, `src/channels/web-types.ts`, `src/index.ts`, `src/sandbox/profiles.ts`

## Goal

Reduce the blast radius of manual code terminals and improve visibility into that surface without destabilizing normal coding workflows.

## Implemented Slice

### Policy Gating

Manual code terminals already respected degraded-backend and strict-sandbox controls. This uplift keeps that model and adds clearer audit coverage.

Current behavior:
- strict sandbox lockdown blocks manual code terminals
- degraded backends keep them disabled by default unless the operator explicitly enables the override

### Hardened Terminal Environment

PTY-backed code terminals now inherit a hardened environment rather than raw `process.env`.

The terminal launch path strips dangerous loader/interpreter variables such as:
- `LD_PRELOAD`
- `NODE_OPTIONS`
- `PYTHONPATH`
- `GIT_ASKPASS`

This is intentionally lighter than a full clean-environment model so normal operator shells are less likely to break.

### Audit Visibility

Guardian now records audit events for:
- terminal access denied by sandbox posture
- terminal session opened
- terminal session exited

This gives operators and later security review a durable record of manual terminal use without pretending the PTY is equivalent to the guarded tool path.

## Why This Scope

Broader changes were deliberately avoided in this uplift:
- no blanket env allowlist for all managed subprocesses
- no descendant executable identity tracking yet
- no attempt to make PTY execution equivalent to `ToolExecutor`

Those deeper changes are warranted long term, but they carry a higher compatibility and implementation risk.

## Benefits

- Lower exposure to injected loader/interpreter environment tricks in manual terminals
- Better auditability for operator-controlled PTY usage
- Security improvement without rewriting cross-platform subprocess execution

## Current Boundaries

- PTYs remain operator surfaces outside the repo-bound command validator
- Terminal subprocess descendants are not identity-tracked yet
- Network mediation for manual terminals is still host-level, not proxy-enforced

## Verification

- `npm run check`
- terminal gating remains covered through existing security posture tests and UI smoke validation
