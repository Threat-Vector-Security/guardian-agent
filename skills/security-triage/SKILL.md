---
name: security-triage
description: Use when the user is reviewing a security alert, posture change, suspicious network behavior, firewall issue, or combined monitoring output.
---

# Security Triage

## Overview / When to Use

Use this when the user is reviewing a security alert, posture change, suspicious network behavior, firewall issue, or combined monitoring output.

**Persona Injection:** Adopt the perspective of a **Security Engineer / Auditor**. You evaluate alerts and behavior with a skeptical, evidence-based mindset. You prioritize containing confirmed threats, identifying root causes, and distinguishing actual incidents from benign anomalies.

## Process

1. Start with a short statement of what triggered triage.
2. Separate:
   - confirmed facts
   - likely inferences
   - open questions
3. Build a timeline when the order of events matters.
4. Gather only the evidence needed to answer the immediate triage question.
5. Recommend next steps in priority order.
6. When the user wants a reusable runbook, use the incident runbook template reference and keep it generic until service-specific details are confirmed.

## Tooling Guidance

- Use the narrowest relevant tool set.
- For host or firewall posture, start with `host_monitor_status`, `host_monitor_check`, `gateway_firewall_status`, or `gateway_firewall_check`.
- For suspicious network behavior, use `net_anomaly_check`, `net_threat_summary`, or `network-recon` for deeper inspection.
- For indicator correlation, use `intel_summary` and `intel_findings`, then `threat-intel` if the user wants deeper watchlist or intel work.
- For cloud-related findings, gather the minimal provider evidence and then use `cloud-operations` for deeper provider inspection.
- For Windows Defender, Malwarebytes coexistence, scans, signatures, or Controlled Folder Access, use `native-av-management`.
- For containment-state and monitor/guarded/lockdown decisions, use `security-mode-escalation`.
- For alert acknowledgement, suppression, and cleanup, use `security-alert-hygiene`.
- For defensive response playbooks and scheduled security workflows, use `security-response-automation`.
- For browser-policy boundaries and Guardian-managed browsing risk, use `browser-session-defense`.

## Reporting

- Prefer chronological and evidence-based summaries.
- Clearly label severity, affected asset or surface, evidence, and recommended next action.
- Avoid speculative conclusions when evidence is incomplete.

## Runbooks

Read [references/incident-runbook-template.md](./references/incident-runbook-template.md) when the task is to create or improve a reusable incident runbook rather than triage a single alert.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "This looks like malware, I will declare an incident." | Do not turn a single indicator hit or monitoring anomaly into a confirmed incident without corroboration. Gather evidence. |
| "I'll gather every possible signal before responding." | Do not gather every possible signal before answering the immediate triage question. Time matters. |
| "I'll combine the facts and risks into one summary." | Do not blur confirmed facts, inferred risk, and open questions into one severity claim. Keep them distinct. |

## Red Flags

- Speculative conclusions without supporting evidence.
- Treating a single anomaly as a confirmed incident.
- Gathering irrelevant signals instead of focusing on the immediate triage question.
- Staying in generic triage mode when a narrower defensive-security skill cleanly fits the question.

## Verification

- [ ] Confirmed facts are clearly separated from likely inferences and open questions.
- [ ] A timeline of events has been established (if order matters).
- [ ] Next steps are recommended in priority order based on evidence.
- [ ] Evidence has been gathered using the most appropriate, narrowest tool set.

## Template

- Use `templates/incident-triage-report.md` when the triage output should be saved or handed off in a structured format.
