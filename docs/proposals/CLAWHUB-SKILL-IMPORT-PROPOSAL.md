# ClawHub / OpenClaw Skill Import Proposal

**Date:** 2026-03-17
**Status:** Draft

---

## Executive Summary

ClawHub is a useful upstream source of workflow guidance, but it is not safe to treat as a drop-in skill marketplace for GuardianAgent.

Guardian already supports:

- native skill bundles via `skill.json` + `SKILL.md`
- reviewed frontmatter-compatible imports when `skill.json` is absent
- local skill roots and runtime enable/disable controls

That compatibility is necessary but not sufficient. Many upstream skills are not truly single-file `SKILL.md` imports. They may depend on `references/`, `templates/`, `assets/`, `scripts/`, hook setup, external CLIs, or platform-specific prompt surfaces. Raw imports also carry supply-chain and prompt-injection risk.

**Proposal:** adopt a hardened, curated import pipeline with four lanes:

1. **Import after hardening** for self-contained, reviewable skills.
2. **Adapt into first-party Guardian skills** when the content is useful but the raw skill is not safe or not architecture-compatible.
3. **Defer until provider/tool support exists** for skills that rely on external CLIs, APIs, or MCP servers we do not yet manage cleanly.
4. **Do not import** for autonomy-heavy, persistence-heavy, credential-heavy, or bypass-oriented skills.

**Important security context:** external research and our own internal analysis both treat the ClawHub ecosystem as a high-risk supply chain. Every import must be provenance-pinned, bundle-aware, sanitized, and disabled by default until reviewed.

---

## Current Implementation Reality

Guardian already has the foundations this proposal should build on:

- Frontmatter-compatible import support exists in the `SkillRegistry`.
- Guardian-native manifests remain the preferred reviewed format.
- Reviewed third-party skills can live under `skills/` alongside first-party skills, preserving `THIRD_PARTY_NOTICES.md` and disabled-by-default manifests.

However, there are current constraints this proposal must acknowledge:

- `./skills` is the default root today. Reviewed third-party skills should land there unless we intentionally create a separate review-only root.
- The registry scans one directory level under each configured root. Nested imports are not recursively discovered from `./skills`.
- The current importer script is useful as a prototype, but it assumes a single `SKILL.md` import path and does not yet support full bundle import, commit-pinned provenance, or source-specific repo layouts.

**Implication:** this proposal is not greenfield. It should start with hardening the existing import path and re-reviewing the current pilot imports before any broader rollout.

---

## Source Repositories

### Primary upstream

All ClawHub skills are archived in the `openclaw/skills` monorepo:

```text
https://raw.githubusercontent.com/openclaw/skills/main/skills/{author}/{skill-name}/SKILL.md
```

### Additional curated repositories

- `vercel-labs/agent-skills` — frontend/web guidance
- `jeffallan/claude-skills` — DevOps/SRE/monitoring
- `wshobson/agents` — Kubernetes security, incident response, cost optimization
- `sickn33/antigravity-awesome-skills` — security review and GitHub Actions audit

### Important constraint

These repositories do **not** share a uniform directory layout. The current importer only supports:

- the OpenClaw monorepo path
- simple repo-root `SKILL.md` fallbacks

It does **not** currently support arbitrary nested layouts such as:

- `skills/{skill}/SKILL.md`
- `plugins/{category}/skills/{skill}/SKILL.md`
- skill bundles that require sibling `references/`, `assets/`, or `scripts/`

**Implication:** broader author-repo imports require source-specific adapters, not one generic raw-URL pattern.

---

## Import Lanes

### Lane 1 — Import After Hardening

These are good first-wave candidates once the hardened importer and sanitizer exist.

| Skill | Source | Why it is valuable | Conditions |
|------|--------|--------------------|------------|
| **github** | OpenClaw | Useful operational guidance for `gh` workflows | Mark operational; declare CLI/tool assumptions; disable by default until reviewed |
| **cc-skill-security-review** | sickn33 | Strong OWASP-style review checklist that complements `security-triage` | Sanitize and keep advisory-only |
| **gha-security-review** | sickn33 | Good defensive review content for GitHub Actions supply-chain risk | Sanitize and keep advisory-only |
| **k8s-security-policies** | wshobson | Strong policy/RBAC/network guidance aligned with Guardian security posture | Manual fetch or source adapter required |
| **monitoring-expert** | jeffallan | Useful observability guidance for cloud operations | Reject raw subprocess/setup instructions; sanitize first |
| **blogwatcher** | OpenClaw | Good fit for threat-intel and OSINT monitoring workflows | Prefer advisory guidance over background automation |
| **weather** | OpenClaw | Low-risk utility capability; simple, self-contained | Low priority but safer than many higher-install registry skills |
| **nano-pdf** or equivalent PDF helper | OpenClaw | Portable PDF guidance is useful and lower risk than provider-heavy skills | Review for CLI assumptions and external binary requirements |

### Lane 2 — Adapt Into First-Party Guardian Skills

These contain useful ideas, but Guardian should not import them raw.

| Skill / Source | Action | Reason |
|---------------|--------|--------|
| **self-improving-agent** | Adapt into `preferences-memory` and memory workflow docs | Raw skill mutates `.learnings/`, `CLAUDE.md`, `AGENTS.md`, hook configs, and other persistent prompt surfaces |
| **incident-runbook-templates** | Adapt into `security-triage` references/templates | Useful structure, but raw content may contain operational commands and environment-specific assumptions |
| **using-superpowers** (Superpowers, non-ClawHub) | Create a Guardian-native bootstrap/meta-skill | The discipline is valuable, but it should be written directly for Guardian runtime behavior |
| **writing-skills** (Superpowers, non-ClawHub) | Fold into `skill-creator` and `SKILLS-SPEC` | Valuable trigger/eval methodology, but should become first-party authoring guidance |
| **summarize** | Prefer native Guardian/web/doc/media summarization guidance or a first-party tool path | Raw skill is CLI- and API-key-heavy and should not be treated as informational-only |

### Lane 3 — Defer Until Managed Provider, MCP, or Tool Support Exists

These are not immediate import targets.

| Skill | Reason for deferral |
|------|----------------------|
| **slack** | Better as native managed-provider or MCP-backed integration |
| **notion** | Better as native managed-provider or MCP-backed integration |
| **himalaya** | Requires email CLI and credential handling; not a safe raw import |
| **obsidian** | Low strategic value unless local knowledge-vault workflows become a product goal |
| **oracle** | Implies second-model delegation; should only exist with explicit provider governance |
| **multi-search-engine** | Low value while Guardian already has built-in web search |
| **WHMCS workflows** | Should be first-party guidance over an MCP connector, not a raw imported skill |

### Lane 4 — Do Not Import

These should be explicitly excluded.

| Skill | Reason |
|------|--------|
| **capability-evolver** | Self-modifying, autonomy-heavy, strong execution/exfiltration profile |
| **auto-updater** | Background modification of packages or environment |
| **task-supervisor** | Autonomous external communications and credential concerns |
| **agent-browser** | Arbitrary browser execution and interception risk; we already prefer Playwright/MCP paths |
| **gog** | Overlaps native `google-workspace`; OAuth and metadata risks |
| **find-skills** | Registry meta-skill; not useful inside Guardian |
| **skill-vetter** | OpenClaw-specific marketplace meta-skill |
| **skill-creator** (raw import) | We already have a first-party `skill-creator` |
| **self-improving-agent** (raw import) | Persistent prompt-surface mutation and hook installation guidance |
| **proactive-agent** | Pushes autonomy/anticipation patterns that are misaligned with Guardian approval and security posture |

---

## Overlap and Replacement Analysis

| External Skill | Existing Guardian Skill / Capability | Recommended Action |
|---------------|--------------------------------------|-------------------|
| `gog` | `google-workspace` | Skip |
| `agent-browser` | `webapp-testing` plus Playwright/MCP strategy | Skip |
| `self-improving-agent` | `preferences-memory` | Adapt, do not raw import |
| `cc-skill-security-review` | `security-triage` | Import after sanitization |
| `incident-runbook-templates` | `security-triage`, `threat-intel` | Convert into references/templates |
| `monitoring-expert` | `cloud-operations` | Import after sanitization |
| `github` | none | Import after gating and review |
| `summarize` | `web-research`, document/media roadmap | Prefer native adaptation over raw import |
| `blogwatcher` | `threat-intel` | Import after sanitization |
| `weather` | none | Optional low-risk utility import |

---

## Required Uplifts Before Broad Import

### 1. Bundle-aware import, not `SKILL.md`-only import

The import unit must be the **skill directory**, not just a single markdown file.

Importer must:

- fetch the full bundle when available
- preserve and scan `references/`, `templates/`, `examples/`, `assets/`, and `scripts/`
- reject skills whose instructions reference files that were not imported
- reject skills that depend on upstream host-only folders such as `~/.openclaw/`, `.claude/`, or non-existent hook paths unless the content is explicitly rewritten

### 2. Provenance-pinned imports

Each imported skill must capture:

- upstream repo URL
- upstream repo path
- commit SHA or immutable tree/blob reference
- fetched timestamp
- source file hash (for `SKILL.md` and any imported siblings)
- verified license
- reviewer and review timestamp

Never rely on mutable `main` branch URLs as the only provenance record.

### 3. Sanitizer / rewriter pass

Before an imported skill can be enabled, Guardian must strip or rewrite instructions that:

- modify `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `SOUL.md`, or `TOOLS.md`
- install hooks or background jobs
- create cron jobs, daemons, or infinite loops
- require autonomous self-improvement or self-rewriting
- request raw credentials or tokens from the user
- reference unsupported session-to-session tools from upstream platforms
- write to home-directory or workspace paths that do not belong to the imported bundle

### 4. Curated trigger metadata, not broad auto-generation

Do **not** rely on auto-generated trigger keywords for reviewed imports.

For reviewed imports:

- keywords should be human-curated
- generic high-frequency terms should be avoided
- process skills should be especially conservative to avoid over-selection
- imported skills should default to `enabled: false`

### 5. Align imported manifests with Guardian gating

Upstream requirements should map into Guardian metadata where possible:

- `requiredCapabilities`
- `requiredManagedProvider`
- `tools`
- `risk`

Skills that require CLIs, credentials, network access, or file writes should not be labeled purely informational by default.

### 6. Explicit imported-skill root

If reviewed third-party skills remain under a separate root, Guardian config must add that root explicitly:

```json
{
  "assistant": {
    "skills": {
      "roots": ["./skills", "./skills-reviewed"]
    }
  }
}
```

Because the registry only scans one level under each configured root, `./skills` alone is not enough.

---

## Revised Conversion Rules

### Source format

Supported upstream source should be treated as:

- frontmatter `SKILL.md`
- optional sibling bundle files (`references/`, `templates/`, `examples/`, `assets/`, `scripts/`)

### Guardian target

Reviewed imports should still be converted into Guardian-native bundles:

- `skill.json`
- `SKILL.md`
- imported reviewed siblings where retained
- `THIRD_PARTY_NOTICES.md`

### Proposed manifest pattern

```json
{
  "id": "github",
  "name": "GitHub",
  "version": "0.1.0",
  "description": "Operational guidance for GitHub workflows through approved tools and CLIs.",
  "role": "domain",
  "tags": ["github", "pull-request", "ci"],
  "enabled": false,
  "appliesTo": {
    "channels": ["cli", "web", "telegram"],
    "requestTypes": ["chat"]
  },
  "triggers": {
    "keywords": ["github", "pull request", "gh cli"]
  },
  "tools": [],
  "requiredCapabilities": ["network_access"],
  "risk": "operational",
  "_upstream": {
    "source": "clawhub",
    "repo": "https://github.com/openclaw/skills",
    "path": "skills/steipete/github/SKILL.md",
    "slug": "steipete/github",
    "commit": "<pinned-commit-sha>",
    "sha256": "<content-hash>",
    "fetchedAt": "2026-03-17T00:00:00Z",
    "license": "<verified-license>",
    "review": {
      "status": "pending",
      "reviewedBy": "",
      "reviewedAt": ""
    }
  }
}
```

### Revised conversion rules

1. Import the full skill bundle, not only `SKILL.md`.
2. Parse frontmatter with a real YAML parser.
3. Strip frontmatter from the final `SKILL.md`.
4. Preserve only sibling files that survive review.
5. Rewrite or remove upstream platform-specific setup sections.
6. Do not auto-enable imported skills.
7. Do not auto-generate broad trigger lists without human review.
8. Map upstream requirements into Guardian gating metadata when possible.
9. Reject any skill whose retained content still references missing files, unsupported tools, or unsafe persistence/autonomy flows.
10. Preserve license and provenance in `THIRD_PARTY_NOTICES.md` and `_upstream`.

---

## Security Review Process

Every imported skill MUST go through all of the following:

1. **Provenance check** — verify upstream repo, author, path, commit SHA, license, and content hash
2. **Bundle completeness check** — import and inspect referenced siblings; reject dangling references
3. **Automated content scan** — detect shell execution, credential handling, network calls, file mutation, persistence, hook setup, and prompt-injection patterns
4. **Sanitizer pass** — remove upstream-only install/setup/autonomy instructions
5. **Manual content review** — read the retained bundle end-to-end for hidden escalation or Guardian bypass instructions
6. **Scope assessment** — confirm the skill remains advisory or is correctly marked operational
7. **Dependency audit** — record required CLIs, env vars, providers, binaries, and external services
8. **Trigger review** — ensure keywords are narrow and intentional
9. **Runtime review** — ensure the skill cannot become active without explicit enablement
10. **Verification tests** — test loading, disabling, root configuration, and rejection behavior for unsafe bundles

### Automatic rejection criteria

Reject the raw import if the bundle:

- installs hooks, daemons, or cron jobs
- instructs the agent to self-modify or rewrite prompt surfaces
- requests raw credentials or tokens directly
- requires unsupported upstream session tools or workspace semantics
- references missing bundle files after import
- still contains unresolved prompt-injection or bypass content after sanitization

---

## Current Pilot Imports

The repository already contains pilot imports for:

- `github`
- `summarize`
- `self-improving-agent`

These should be treated as **experimental conversion examples**, not as approved broad-rollout precedents.

Recommended disposition:

- `github` — keep, but review and classify as operational
- `summarize` — re-evaluate; likely replace with native guidance or keep only as a gated optional skill
- `self-improving-agent` — do not approve as a raw import; replace with first-party adaptations

---

## Acquisition Methods

### Method 1: OpenClaw monorepo adapter

Primary source for ClawHub-hosted skills:

```text
openclaw/skills -> skills/{author}/{skill}/...
```

### Method 2: Source-specific repo adapters

Needed for repositories with custom layouts:

- `vercel-labs/agent-skills`
- `jeffallan/claude-skills`
- `wshobson/agents`
- `sickn33/antigravity-awesome-skills`

### Method 3: Local review/import workflow

If a skill cannot be fetched automatically:

1. review the upstream repo manually
2. pin the exact commit
3. copy the full reviewed bundle locally
4. run bundle-aware scan and sanitizer
5. convert to Guardian-native reviewed import

### Non-goal

Do **not** automatically trust marketplace ranking, install count, or cached “top skills” lists as a reason to import.

---

## Adjacent Non-ClawHub Uplifts Worth Bundling With This Work

These are not ClawHub imports, but they should move alongside this proposal because they solve the same product problem more cleanly:

| Item | Action |
|------|--------|
| `using-superpowers` discipline | Create a Guardian-native bootstrap/meta-skill that reinforces reading relevant skills before acting |
| `writing-skills` methodology | Upgrade `skill-creator` and `SKILLS-SPEC` with stronger trigger wording and eval-driven authoring guidance |
| skill-trigger evals | Add tests for imported-skill triggering, conservative selection, provider gating, and read-before-action behavior |

This gives Guardian the reliable parts of the broader ecosystem without inheriting raw marketplace mechanics everywhere.

---

## Implementation Plan

### Phase 0: Harden the Existing Import Path

- Keep reviewed third-party skills under `./skills` by default, or add any alternative review root explicitly
- Change reviewed imported manifests to `enabled: false` by default
- Extend importer from `SKILL.md` fetcher to bundle-aware importer
- Add source-specific adapters for curated external repos
- Capture commit-pinned provenance and verified license metadata
- Add sanitizer rules for persistence, hooks, autonomy, prompt-surface mutation, and unsupported upstream setup
- Re-review the current pilot imports under the hardened policy

### Phase 1: Curated First Wave

- Import and review `github`
- Import and review `cc-skill-security-review`
- Import and review `gha-security-review`
- Import and review `k8s-security-policies`
- Import and review `blogwatcher`
- Optionally import `weather` and PDF helper guidance as low-risk utility skills

### Phase 2: Adaptation Wave

- Convert `incident-runbook-templates` into `security-triage` references/templates
- Fold useful parts of `self-improving-agent` into first-party memory/documentation flows
- Upgrade `skill-creator` and `SKILLS-SPEC` with `writing-skills` learnings
- Add a first-party Guardian bootstrap/meta-skill inspired by `using-superpowers`

### Phase 3: Provider-Gated / Tool-Gated Skills

- Re-evaluate `monitoring-expert`
- Re-evaluate `summarize` only if native Guardian summarization remains insufficient
- Consider `slack`, `notion`, and other provider-centric skills only when native provider or MCP support exists

### Phase 4: Maintenance

- Maintain an allowlist of approved upstream repos and paths
- Track upstream changes by commit SHA, not by auto-applying latest
- Require manual review for all updates
- Keep audit history for import, review, enable, disable, and update actions

---

## Decisions

### Imported skill location

Use `skills/` as the default reviewed-skill location, keeping third-party notices and disabled-by-default manifests in each bundle.

### Default enablement

Imported skills must default to disabled until review is complete.

### Path rewriting

Strip or rewrite `{baseDir}`, home-directory references, and upstream platform paths only when the referenced local bundle content actually exists after import. Otherwise reject the raw import.

### Contribution upstream

Do not contribute Guardian-specific reviewed imports back upstream until the sanitizer, provenance, and review model are mature.

### WHMCS

Use an MCP connector plus a thin first-party Guardian skill for WHMCS procedures. Do not treat WHMCS as a raw ClawHub import target.

### Capability taxonomy

Add a small canonical capability vocabulary for reviewed imports, such as:

- `network_access`
- `filesystem_write`
- `shell_access`
- `managed_provider:<name>`

This will make imported skill gating clearer and more consistent.
