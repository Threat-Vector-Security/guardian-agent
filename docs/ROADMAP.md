# Roadmap

Guardian's direction is a standalone local security workspace that also works naturally with external AI assistants. The current capabilities are described in the [README](../README.md); the items below are planned work, not available features.

## Finish the everyday workflows

- Resolve the [known diagram/GRC identity, import and read-only-view issues](KNOWN-ISSUES.md).
- Add safe project deletion and improve project organisation.
- Simplify assistant enrollment, connection setup and credential renewal.
- Continue checking original ContextCypher workflows for data fidelity, accessibility and complete standalone use.

## Expand environment coverage

- Add authenticated Microsoft/Azure resource and identity/device discovery with explicit tenant permissions.
- Improve reconciliation between new observations and existing diagrams while preserving manual edits and evidence provenance.
- Extend supported security-product connectors beyond antivirus inventory and approved Defender scan requests.

## Prepare for enterprise deployment

- Signed Windows and macOS distributions, verified updates and protected service deployment.
- Customer-environment acceptance for Entra and AWS integrations.
- Scoped fleet management, proprietary EDR response integrations and reliable SIEM/event delivery.

New integrations must share Guardian's authorization, validation, persistence and audit services. Security actions need evidence of execution and their actual outcome. A feature is complete when its user workflow and failure paths are verified, not when a design document exists.
