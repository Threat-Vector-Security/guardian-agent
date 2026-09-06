# Current design documents

This index describes the current Guardian Agent security application. Documents here guide the locally operated security service and standalone ContextCypher workbench.

| Current reference | Purpose |
|---|---|
| [WebUI design](WEBUI-DESIGN.md) | Seven-page navigation, diagram/GRC workbench, interaction and accessibility rules. |
| [Architecture overview](../architecture/OVERVIEW.md) | Current browser, service, storage, AI, collector, CLI and MCP boundaries. |
| [Security application contract](../architecture/SECURITY-CONVERSION.md) | Authentication, authorization, state lifetime, packaging and verification. |
| [Forward architecture](../architecture/FORWARD-ARCHITECTURE.md) | Module ownership and rules for adding security capabilities. |
| [ContextCypher migration](../architecture/CONTEXT-MIGRATION.md) | Document format, data preservation, GRC integration and current fidelity gaps. |
| [Architecture decisions](../architecture/DECISIONS.md) | Accepted decisions for the current security product. |
| [Operator guide](../guides/SECURITY-WORKSPACE.md) | How to use the application, integrations and machine interfaces. |
| [Current scope and acceptance gaps](../architecture/OVERVIEW.md#current-scope-and-acceptance-gaps) | Implemented scope and unresolved acceptance work. |

A current design describes implemented behavior or explicitly labels a requirement that is not yet fulfilled. Source inspection, automated tests and actual environment/browser acceptance are different kinds of evidence. Do not present a planned feature, available source file or passing build as an operational capability.

Keep design changes synchronized with their owning implementation and operator guidance. Documentation-only releases must identify unresolved application gaps rather than imply they were fixed. Earlier product designs are retained in the [documentation archive](../archive/) outside this current index.
