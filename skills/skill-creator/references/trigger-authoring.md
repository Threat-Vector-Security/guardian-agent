# Trigger Authoring

Use this reference when writing or revising skill descriptions and trigger metadata.

## Good Description Pattern

State:

1. when the skill should activate
2. what kind of request it helps with
3. what nearby cases should use a different skill

Example:

```text
Use when the user wants a reusable incident runbook, on-call procedure, or escalation playbook for a service or failure mode. Do not use for one-off alert triage; use security-triage instead.
```

## Weak Description Pattern

Avoid descriptions like:

```text
Helps with incidents and operations workflows.
```

That tells the model almost nothing about when to choose the skill.

## Trigger Eval Set

For every skill change, write at least:

- 2 prompts that should trigger the skill
- 2 prompts that should not trigger the skill
- 1 prompt that is intentionally ambiguous

## Keyword Rules

- Prefer phrases over single high-frequency words.
- Avoid keywords like `help`, `fix`, `review`, or `workflow` unless paired with domain context.
- Keep process-skill keywords narrower than domain-skill keywords.
- Remove keywords that collide with existing higher-value skills.
