# Guardian Agent purpose and principles

Guardian Agent helps people understand and protect their local workstations, networks and system architecture. It combines security observations, ContextCypher diagrams, threat analysis and GRC in a workspace people can use directly or through an AI assistant.

## Product principles

- Keep the standalone application complete. An external assistant is optional.
- Preserve the meaning and relationships of diagrams, risks, controls and evidence.
- Make security observations useful by connecting them to the assets and systems they affect.
- Keep supported actions scoped, reviewable and attributable to an actor.
- Make the safe workflow understandable; explain the actual outcome and any missing evidence.
- Work alongside native protection and security products. Do not claim control over actions outside Guardian's interfaces.

## Engineering principles

- Enforce permissions and input validation in the shared service, regardless of transport.
- Treat model output, imported files and collected evidence as data, not authority.
- Protect credentials and keep provider data transfers explicit.
- Preserve drafts on errors and reject conflicting saves rather than silently overwriting work.
- Test complete user workflows and their failure paths. Never invent results to make a check pass.
- Keep documentation about current behavior separate from planned work and history.

See the [security policy](SECURITY.md), [architecture](docs/architecture/OVERVIEW.md) and [contributor instructions](AGENTS.md) for the implementation contracts.
