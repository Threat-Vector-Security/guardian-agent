# Known issues

These are current behavior gaps. A documentation update does not fix them.

## Renaming can duplicate GRC assets on the next sync

After syncing a diagram into GRC, renaming the system, saving and reopening it can cause the next asset/connection sync to create duplicates. Diagram references currently depend on the loaded name.

Keep the system name unchanged between syncs until stable diagram identity is implemented. Existing saved records remain available. Fixing this requires stable identity and careful handling of older references; unrelated diagrams must not be merged by label.

## Browser imports do not preserve original JSON formatting

The browser importer parses and reserializes JSON before sending it to Guardian. Nodes, edges, GRC records and extension fields are preserved semantically, but an original export from that path does not reproduce the uploaded file's exact formatting or bytes.

Keep the original file when byte-for-byte provenance matters. The direct API and CLI can send raw source text to the import service; the browser needs the same raw-text path and an end-to-end fidelity check.

## Read-only users have a simpler diagram view

Users without project-write permission receive the simpler Systems viewer rather than the full ContextCypher renderer. Read-only viewing therefore does not yet have equivalent diagram fidelity or the full editor/GRC presentation.

The intended fix is a read-only mode of the mature renderer. Do not grant editing permission merely to work around a viewing limitation.

See the [roadmap](ROADMAP.md) for other planned capabilities and the [operator guide](guides/SECURITY-WORKSPACE.md#release-limits) for deployment coverage.
