# Incident Runbook Template

Use this template when the user wants a reusable runbook, playbook, or on-call procedure.

## Structure

1. Overview
2. Severity and impact
3. Detection signals
4. First-response checks
5. Containment or mitigation options
6. Investigation steps
7. Recovery and verification
8. Rollback criteria
9. Escalation path
10. Communication notes
11. Follow-up actions

## Template

```markdown
# [Service or Incident Type] Runbook

## Overview
- Scope:
- Owner:
- Primary systems:

## Severity Guide
- SEV1:
- SEV2:
- SEV3:
- SEV4:

## Detection
- Alerts:
- Dashboards:
- Logs / telemetry:
- User-visible symptoms:

## First 5-15 Minutes
1. Confirm current impact and affected surface.
2. Check for recent changes, deploys, config flips, or dependency incidents.
3. Gather only the minimum evidence needed to classify severity.
4. Decide whether containment is safer than continued operation.

## Mitigation Options
- Option A:
- Option B:
- Option C:

## Investigation
- Primary hypotheses:
- Evidence to confirm:
- Evidence to falsify:

## Recovery
- Recovery action:
- Success signals:
- Verification steps:

## Rollback
- Trigger for rollback:
- Rollback owner:
- Validation after rollback:

## Escalation
- Engineering:
- Security:
- Operations:
- Customer / business stakeholders:

## Communication
- Internal update cadence:
- Customer-facing status threshold:
- Mandatory details for handoff:

## Follow-up
- Post-incident review owner:
- Required data to preserve:
- Preventive actions:
```

## Rules

- Keep commands and endpoints environment-specific only when the user supplies them.
- Prefer placeholders over hardcoded hostnames, secrets, or internal URLs.
- Separate confirmed procedures from hypothesis-driven troubleshooting.
- Include rollback and verification every time.
