# GuardianAgent vs. Hermes Agent

**Date:** 2026-04-13  
**Type:** Research / Architecture, Capability, Tool, and Skill Comparison  
**External codebase reviewed:** `/mnt/s/development/hermes-agent`  
**Cloned from:** `https://github.com/nousresearch/hermes-agent`  
**Guardian references:** `README.md`, `SECURITY.md`, `docs/architecture/OVERVIEW.md`, `docs/design/ORCHESTRATION-DESIGN.md`, `docs/design/SKILLS-DESIGN.md`, `docs/design/MEMORY-SYSTEM-DESIGN.md`, `docs/design/MCP-CLIENT-DESIGN.md`, `docs/design/INTELLIGENCE-IN-DEPTH-DESIGN.md`

## Executive Summary

Hermes Agent and GuardianAgent are both serious multi-surface agent systems, but they are optimized for different end states.

Hermes is optimized for:

- broad agent reach across many messaging surfaces
- a very flexible generic tool loop
- agent-managed learning through memory and skill creation
- portability, profiles, install/update UX, and experimentation
- cloud and remote execution backends
- research and RL-adjacent workflows

GuardianAgent is optimized for:

- security-first runtime enforcement
- explicit route classification and bounded orchestration
- trusted control-plane ownership of approvals, policy, and tool execution
- structured product surfaces such as Second Brain, Code Workspace, Security, Network, Cloud, and Automations
- trust-classified outputs and trust-aware durable memory
- shared pending-action and cross-surface continuity semantics

Bottom line:

- **Do not copy Hermes wholesale.** Its runtime philosophy is materially looser than Guardian's, and a straight port would degrade Guardian's architecture discipline.
- **Do borrow selected product and autonomy ideas.** Hermes has several real advantages in agent ergonomics, self-improvement loops, gateway breadth, profile isolation, and editor/runtime integrations.
- **The highest-value uplift path for Guardian is not “more tools.”** Guardian already has a larger built-in tool surface. The higher-value uplift path is:
  - governed self-improvement
  - better agent ergonomics around skills and recall
  - broader surface reach
  - richer programmatic orchestration primitives
  - cleaner operator portability and packaging

## Scope And Sources

I reviewed Hermes at the repository, implementation, and documentation level:

- `README.md`
- `pyproject.toml`
- `run_agent.py`
- `model_tools.py`
- `toolsets.py`
- `tools/registry.py`
- `tools/delegate_tool.py`
- `tools/code_execution_tool.py`
- `gateway/platforms/*`
- `plugins/memory/*`
- `website/docs/developer-guide/architecture.md`
- `website/docs/developer-guide/agent-loop.md`
- `website/docs/developer-guide/tools-runtime.md`
- `website/docs/developer-guide/provider-runtime.md`
- `website/docs/developer-guide/gateway-internals.md`
- `website/docs/user-guide/features/skills.md`
- `website/docs/user-guide/features/memory.md`
- `website/docs/user-guide/features/memory-providers.md`
- `website/docs/user-guide/security.md`
- `website/docs/reference/tools-reference.md`

I compared those against Guardian's current architecture and shipped capability model:

- `README.md`
- `SECURITY.md`
- `docs/architecture/OVERVIEW.md`
- `docs/design/ORCHESTRATION-DESIGN.md`
- `docs/design/SKILLS-DESIGN.md`
- `docs/design/MEMORY-SYSTEM-DESIGN.md`
- `docs/design/MCP-CLIENT-DESIGN.md`
- `docs/design/INTELLIGENCE-IN-DEPTH-DESIGN.md`
- `src/runtime/intent-gateway.ts`
- `src/tools/executor.ts`
- `src/tools/registry.ts`
- `src/tools/types.ts`
- `src/llm/provider-registry.ts`
- `src/runtime/control-plane/dashboard-runtime-callbacks.ts`
- `src/tools/builtin/*.ts`

## Repo Snapshot

| Dimension | GuardianAgent | Hermes Agent | Assessment |
|---|---:|---:|---|
| Primary language | TypeScript / Node 20 | Python 3.11 | Different ecosystem tradeoffs |
| Core runtime entrypoint size | `src/index.ts` 6,531 LOC | `run_agent.py` 10,627 LOC | Hermes is more centralized in one agent loop |
| CLI surface | `src/channels/cli.ts` 5,249 LOC | `cli.py` 9,956 LOC | Hermes has a more feature-heavy TUI/CLI |
| Gateway / channel runner | web + CLI + Telegram adapters | `gateway/run.py` 8,982 LOC | Hermes has much broader messaging scope |
| Built-in tool count | ~201 registered built-in tool names across built-in modules | 47 documented built-in tools | Guardian has a much larger verticalized tool surface |
| Bundled skills | 53 | 26 core + 45 optional = 71 | Hermes has broader skill catalog breadth |
| Test files | 240 `*.test.ts` | 532 `test_*.py` | Hermes has larger test surface, mostly reflecting breadth |
| First-party channels | Web, CLI, Telegram | CLI + 17 adapters including Telegram, Discord, Slack, WhatsApp, Signal, Email, Matrix, Home Assistant, API server | Hermes is much broader on channels |
| Provider breadth | 10 provider types in `src/llm/provider-metadata.ts` | 18+ provider families documented | Hermes broader; Guardian more explicitly tiered |

Important nuance:

- Guardian's raw tool count is higher because it exposes many **verticalized, domain-specific tools**.
- Hermes's lower tool count reflects a **smaller set of generic primitives** plus MCP, plugins, and agent-created skills.
- These are different philosophies, not a simple “more vs less” quality ranking.

## Strategic Positioning

### Guardian's center of gravity

Guardian is a **security-first operator platform** with a growing personal operating system layer:

- structured Intent Gateway routing
- shared pending-action orchestration
- trust-aware memory and output classification
- productized web control plane
- Second Brain
- code workspace
- security, network, and cloud operations
- deterministic automation runtime

### Hermes' center of gravity

Hermes is a **generalist personal agent platform** with strong mobility and self-improvement patterns:

- one large agent loop
- generic tools and toolsets
- broad messaging gateway
- profiles and portability
- agent-managed memory and skills
- subagent delegation
- execute-code pipelines
- optional external memory/context engines
- RL and trajectory-generation hooks

## Head-To-Head Comparison

| Area | GuardianAgent | Hermes Agent | Assessment |
|---|---|---|---|
| Top-level request routing | Intent Gateway with structured route classification and execution metadata in `src/runtime/intent-gateway.ts` | No equivalent route contract; generic tool-calling loop centered in `run_agent.py` | Guardian is materially stronger |
| Pending-action / blocked-work semantics | Shared pending-action model across surfaces in `docs/design/ORCHESTRATION-DESIGN.md` | Approval and interruption logic exists, but not an equivalent shared blocker model | Guardian stronger |
| Cross-surface continuity | Explicit continuity threads and shared context assembly per `docs/design/ORCHESTRATION-DESIGN.md` | Session continuity exists, but broader continuity semantics are lighter | Guardian stronger |
| Core agent loop | Brokered worker path plus supervisor-owned orchestration | Very capable monolithic `AIAgent` loop in `run_agent.py` | Hermes is more flexible; Guardian is safer |
| Security model | Four-layer defense plus brokered worker, output trust, taint-aware memory, strict MCP posture | Seven-layer security model centered on approvals, isolation, authorization, and context scanning | Guardian stronger overall, especially on reinjection trust and runtime chokepoints |
| Tool architecture | Large curated built-in catalog plus MCP, approvals, policy, control plane | Smaller generic tool catalog plus toolsets, MCP, plugin tools | Different strengths; Guardian stronger on governance, Hermes on flexibility |
| Skills system | Reviewed local bundles, runtime-owned progressive disclosure, no direct execution plane | Agent-readable and agent-writeable skills, slash commands, external dirs, skills hub, fallback activation | Hermes stronger on skill UX and agent learning loops |
| Memory baseline | Structured global memory, code-session memory, FTS search, Memory/Wiki direction | MEMORY.md + USER.md, session search, memory nudges, provider plugins | Guardian stronger on structure; Hermes stronger on extensibility |
| External memory providers | Not a comparable plugin surface yet | 8 provider plugins including Honcho, Mem0, OpenViking, Holographic | Hermes stronger |
| Coding workspace | Dedicated repo-scoped workspace, code sessions, diffs, backend execution, workspace trust | Generic file/terminal/patch tools + ACP + subagents | Guardian stronger as a product; Hermes stronger on IDE integration and delegation |
| Automation / scheduling | Intent-routed automation authoring, deterministic workflow runtime, saved automations | Natural-language cron jobs and skill-backed jobs | Guardian stronger architecturally; Hermes simpler for “set a recurring task” UX |
| Messaging channels | Web, CLI, Telegram | Broad gateway surface | Hermes much stronger |
| Web product surface | Rich web app and control plane | Web/API server exists, but Hermes is primarily CLI/gateway-centric | Guardian much stronger |
| Profiles / multi-instance | No comparable first-class multi-profile UX found | Strong profile model with clone/export/import and isolated `HERMES_HOME` | Hermes stronger |
| Voice / audio | No comparable first-class voice surface found in reviewed scope | TTS, transcription, voice memo flow | Hermes stronger |
| Research / RL | Eval framework and security test harnesses | RL environments, batch trajectory generation, training tools | Hermes stronger |
| Architecture discipline | Spec-heavy, control-plane-owned, explicit boundaries | Broad, productive, but more monolithic and plugin-heavy | Guardian stronger for long-term governability |

## Deep Dive

## 1. Runtime Architecture

### Guardian

Guardian's architecture is explicitly layered:

- `IntentGateway` handles top-level request interpretation
- `PendingActionStore` style orchestration owns blockers and approvals
- supervisor-owned tooling and approvals remain authoritative
- built-in chat/planner execution can be isolated into a brokered worker
- deterministic runtime, control plane, and shared metadata are first-class

The important point is not just modularization. It is **ownership of risk**. Guardian assigns responsibility for routing, approvals, tool execution, trust classification, and persistence to runtime-owned components rather than leaving those decisions inside one generic agent loop.

### Hermes

Hermes is centered on a very large, capable `AIAgent`:

- prompt assembly
- provider selection
- tool execution
- callbacks
- compression
- fallback
- memory nudges
- background review
- delegation
- persistence

This is productive, but it makes the main agent loop the center of gravity for many concerns that Guardian deliberately separates.

### Assessment

Hermes is easier to extend quickly as a hacker/runtime lab. Guardian is better positioned for:

- shared semantics across multiple surfaces
- bounded authority
- safer long-term evolution
- strong operator expectations around consistency

**Recommendation:** do not import Hermes' monolithic runtime pattern. Borrow specific features, but route them through Guardian's existing shared orchestration and control-plane layers.

## 2. Intelligence Functions

### Guardian's intelligence model

Guardian's “intelligence” is not one thing. It already distinguishes:

- deterministic enforcement and orchestration
- route classification
- tier-aware provider routing
- inline risk evaluation
- retrospective audit analysis
- structured workflows and automation authoring

This is reinforced in `docs/design/INTELLIGENCE-IN-DEPTH-DESIGN.md`, which explicitly models multiple intelligence rings rather than one undifferentiated “assistant provider.”

### Hermes' intelligence model

Hermes' intelligence emphasis is different:

- strong general-purpose tool loop
- auxiliary model routing
- context compression
- session search summarization
- memory/provider-driven recall
- subagents and mixture-of-agents
- background memory/skill review

The standout feature is Hermes' **closed learning loop**:

- review completed work
- update memory if something matters
- create or patch a skill if a reusable workflow emerged

This is visible directly in `run_agent.py` where background review threads inspect prior turns and may write memory or skills.

### What Guardian can borrow

Guardian should borrow Hermes' **reflective learning loop**, but not Hermes' implementation shape.

Best-fit Guardian adaptation:

1. Add a **runtime-owned reflective maintenance job** that proposes:
   - memory updates
   - skill patch proposals
   - playbook/automation recommendations
2. Route those proposals into:
   - reviewed queues
   - control-plane approval surfaces
   - provenance-aware durable storage
3. Keep the actual mutation out of the conversational agent path.

This fits Guardian's architecture far better than direct agent-authored file mutation.

## 3. Tool Systems

### Guardian tool model

Guardian has a much larger built-in tool surface, including:

- automations
- browser
- cloud
- coding
- contacts/email
- filesystem
- memory
- network/system
- performance
- policy
- providers
- second brain
- security intel
- search
- web
- workspace

The shape of the surface is strongly verticalized. Instead of a small number of open-ended primitives, Guardian often wraps a domain in a purpose-built tool family. This reduces ambiguity and makes policy application easier.

### Hermes tool model

Hermes exposes a smaller, more composable set of primitives:

- terminal + process
- file read/write/patch/search
- web search/extract
- browser automation
- execute_code
- delegate_task
- memory
- session_search
- cronjob
- send_message
- clarify
- TTS
- image generation
- Home Assistant
- RL tools
- MCP

This makes Hermes more agentically flexible. It also pushes more responsibility into the agent loop.

### Assessment

Guardian does **not** need more raw tool count. It needs a few missing primitives Hermes has:

- `delegate_task` equivalent
- `execute_code` equivalent
- `send_message` equivalent if Guardian expands channels
- optional TTS / transcription surfaces
- richer skill discovery/edit UX

### High-value tool uplifts

#### A. Governed `delegate_task`

Hermes' subagent model is genuinely useful. Guardian should add its own version only through:

- shared orchestration
- explicit lineage
- bounded handoff contracts
- approval and trust propagation
- operator-visible delegated status

Guardian already has the right foundations in `docs/design/ORCHESTRATION-DESIGN.md`. This is a strong fit.

#### B. Governed `execute_code`

Hermes' `execute_code` is one of the most practical features in the repo. It allows a sandboxed Python program to orchestrate tool calls, transform outputs, and reduce context churn.

Guardian should strongly consider a similar primitive, but adapted to Guardian's architecture:

- sandboxed micro-orchestrator execution
- explicit tool budget
- typed RPC to managed tools
- audit and approval visibility
- taint-aware result ingestion
- default availability only in trusted coding/workspace contexts

This is especially aligned with Guardian's emerging planner/DAG direction.

#### C. Better browser introspection helpers

Hermes has some browser affordances Guardian could selectively borrow:

- console inspection
- image listing for vision handoff
- clearer step-by-step browser state surfaces

These are small uplifts, not architectural shifts.

## 4. Skills Systems

### Guardian skills

Guardian's skill system is disciplined and runtime-owned:

- local reviewed bundles
- `skill.json` or reviewed frontmatter
- bounded progressive disclosure
- first-party preference
- runtime-owned L2/L3 loading
- active-skill metadata
- strong separation between skill guidance and execution

This is the safer design.

### Hermes skills

Hermes' skill system is more ambitious and more agentic:

- `~/.hermes/skills/` as the live source of truth
- skills available as slash commands
- agent-managed creation and editing via `skill_manage`
- external skill directories
- toolset/platform conditional activation
- Skills Hub ecosystem
- env passthrough and skill config integration

This is one of Hermes' strongest product areas.

### Assessment

Hermes is clearly ahead on:

- skill discoverability
- skill usability from chat
- skill installation/import UX
- procedural memory creation
- conditional activation

Guardian is clearly ahead on:

- trust model
- boundary discipline
- runtime-owned loading
- not confusing skills with authority

### What Guardian should borrow

#### Borrow now

- external read-only skill directories
- platform/channel-aware skill enablement
- tool-category or route-aware skill gating
- better skill browse/toggle UX in product surfaces
- explicit skill improvement proposals

#### Borrow carefully

- agent-generated skill drafts
- patch suggestions against existing skills
- skill packaging/import UX

#### Do not borrow as-is

- unrestricted agent write access to the live skill store
- plugin-like skill import without review and provenance

## 5. Memory And Recall

### Guardian

Guardian's memory model is structurally richer:

- global memory
- code-session memory
- FTS conversation history
- automation output references
- explicit cross-memory bridge
- trust/provenance/quarantine semantics
- unified Memory/Wiki direction

This is a strong foundation for a product that wants both operator utility and governed long-term context.

### Hermes

Hermes' baseline memory is lighter but very usable:

- `MEMORY.md`
- `USER.md`
- session search
- automatic nudges
- external provider plugins
- Honcho-driven user modeling

The big Hermes differentiator is **memory extensibility**. Its external provider plugin system is ahead of Guardian here.

### What Guardian can borrow

#### A. External memory-provider abstraction

Guardian does not need to replace its native memory model. But it could benefit from a **narrow adapter layer** for optional external memory providers:

- semantic memory providers
- user-modeling providers
- domain-specific knowledge stores

This should only happen if it is mediated by Guardian's existing trust/provenance model.

#### B. Proactive recall UX

Hermes pushes session search harder as a first-class recall tool. Guardian can improve:

- operator-visible memory/recall suggestions
- proactive “search prior runs / sessions / memory” hints
- clearer recall surfaces in web and chat

#### C. Reflective memory maintenance

Hermes' background review loop suggests a useful Guardian uplift:

- runtime-owned post-task memory review jobs
- durable proposal queues rather than silent writes

## 6. Coding And Development Workflows

### Guardian strengths

Guardian is stronger in coding as a productized workspace:

- repo-scoped code sessions
- attached workspaces
- diff and edit tools
- coding backends
- remote execution
- package review path
- workspace trust review
- web-based workbench

### Hermes strengths

Hermes is stronger in coding as a general-purpose agent runtime:

- ACP editor integration
- subagents
- `execute_code`
- generic terminal backends
- profile portability

### Best uplift opportunities

1. **ACP or similar editor integration**
   Guardian would benefit from a first-class IDE/editor transport for repo-grounded sessions.

2. **Delegation for coding slices**
   Guardian should support explicit worker subflows within code sessions, with shared job visibility and bounded lineage.

3. **Programmatic tool pipelines**
   `execute_code`-style processing is especially useful for large repo, diff, or search-heavy work.

## 7. Automations And Scheduling

Guardian is stronger architecturally:

- automation authoring goes through an intent-routed compiler path
- deterministic workflow runtime exists
- approval-safe resume and run state are explicitly modeled

Hermes is simpler and more conversational:

- cron jobs
- skill-backed scheduled jobs
- delivery to platforms

The uplift here is mostly UX:

- Guardian can borrow Hermes' ease of “tell the agent to schedule this recurring thing”
- but it should keep Guardian's canonical IR, control plane, and deterministic runtime

## 8. Channels, Gateway, And Surfaces

### Hermes advantage

Hermes is far ahead on communication reach:

- Telegram
- Discord
- Slack
- WhatsApp
- Signal
- Matrix
- Mattermost
- Email
- SMS
- DingTalk
- Feishu
- WeCom
- Weixin
- BlueBubbles
- Home Assistant
- webhook
- API server

It also has:

- pairing
- per-platform authorization
- profile-aware gateway management
- richer mobile-first patterns

### Guardian advantage

Guardian is much stronger on first-party web product surfaces:

- Second Brain
- Code
- Automations
- Security
- Network
- Cloud
- Configuration
- Reference Guide

### What Guardian should borrow

If Guardian wants broader reach, the best Hermes ideas are:

- channel breadth
- consistent slash/command semantics
- operator pairing/authorization UX
- send-to-other-surface messaging abstraction

But these should be implemented through Guardian's shared pending-action, continuity, and approval model, not as channel-specific one-offs.

## 9. Security And Trust

### Guardian strengths

Guardian is materially ahead in several areas:

- brokered worker isolation
- trust-classified tool output
- quarantined reinjection suppression
- trust-aware durable memory
- managed MCP posture
- package-install review path
- workspace trust review
- threat-intel and defensive overlay
- explicit policy update controls

### Hermes strengths

Hermes is quite good on:

- dangerous command approval UX
- gateway authorization
- context-file scanning
- container isolation patterns
- env filtering for MCP subprocesses

### Areas Guardian should not borrow as-is

- `approvals.mode: off` / YOLO-style operational posture as a normal pattern
- container-backend approval bypass logic as a general assumption
- direct user/project/pip plugin discovery without stronger provenance controls
- unrestricted agent write access to skills or plugin surfaces

Guardian's security model is one of the main reasons not to port Hermes architecture wholesale.

## 10. Extensibility, Packaging, And Operator UX

### Hermes is better at:

- install/update/doctor style operational UX
- profiles
- export/import
- packaging and distribution ergonomics
- skill hub style ecosystem story
- editor integration surfaces

### Guardian is better at:

- explicit specs
- control-plane ownership
- boundary clarity
- productized operator surfaces

### High-value non-runtime uplifts for Guardian

1. profile-style isolation for multiple Guardian instances
2. export/import for memory, automations, and config
3. richer install/update/doctor workflow
4. optional editor/server integration surfaces
5. better channel setup and status diagnostics

## Where Hermes Is Better And Worth Borrowing

## 1. Governed Reflective Learning

Hermes' background review loop is one of the most important ideas in the repo.

Guardian should add:

- post-task reflection jobs
- memory suggestion queue
- skill patch proposal queue
- playbook/automation recommendation queue

These should be runtime-owned and reviewable, not silent direct writes.

## 2. `execute_code`-Style Programmatic Tool Orchestration

This is probably the single most useful direct capability uplift.

Why it matters:

- reduces LLM round trips
- reduces context bloat
- lets the system process large tool outputs without flooding the chat loop
- supports conditional logic and data shaping

Guardian should implement this as a governed micro-orchestrator, not a raw free-form script lane.

## 3. First-Class Delegation

Hermes makes subagents practical. Guardian's architecture is actually better positioned to do this safely.

Recommended Guardian version:

- explicit delegated worker contracts
- tool and trust scoping
- audit lineage
- held-result review
- operator-visible progress

## 4. Profiles And Portability

Hermes' profile model is genuinely good product engineering.

Guardian would benefit from:

- multiple isolated operator profiles
- export/import
- clone-from-profile
- profile-scoped connectors and channels

This is especially valuable if Guardian becomes both a personal system and a multi-workspace operator system.

## 5. Broader Messaging And Delivery Reach

Hermes' gateway is far ahead of Guardian here.

If channel expansion is on the roadmap, Hermes provides a strong evidence base for:

- Discord
- Slack
- WhatsApp
- Signal
- Email
- webhook/API delivery

## 6. Skill UX And Ecosystem Surfaces

Guardian should not copy Hermes' trust posture, but it should copy the product insight:

- skills need to be discoverable
- users need to understand what is available
- the agent should be able to improve reusable knowledge over time

## 7. Editor Integration

Hermes' ACP surface is valuable. Guardian should strongly consider:

- editor-native coding sessions
- repo-aware transport outside the web UI
- controlled coding assistant embedding into IDE workflows

## Where Guardian Is Better And Should Not Regress

Guardian should preserve and deepen its advantages in:

- Intent Gateway routing
- pending-action orchestration
- continuity semantics
- trust-aware memory
- output taint/quarantine
- workspace trust
- package-install review
- security/network/cloud verticals
- web control plane
- deterministic automation runtime
- provider tiering and intelligence-in-depth model

In several of these areas, Hermes is not merely different. It is weaker relative to Guardian's goals.

## Recommended Guardian Uplift Roadmap

## Priority 0: Borrow Soon

1. **Reflective learning queue**
   Add runtime-owned memory and skill proposal jobs after meaningful tasks.

2. **Programmatic tool runner**
   Add a sandboxed micro-orchestration primitive for coding and research workflows.

3. **Delegated worker flows**
   Add governed subagent delegation tied to shared orchestration and audit.

4. **Skill UX uplift**
   Add better browse/inspect/toggle/edit-review surfaces for skills.

5. **Profiles/export/import**
   Add isolated multi-profile operation and portable export/import.

## Priority 1: Strong Candidates

1. **Editor integration**
   ACP-like or equivalent IDE transport.

2. **Broader channels**
   Slack, Discord, webhook/API server first.

3. **Memory-provider adapters**
   Only through Guardian trust and provenance controls.

4. **Voice and audio surfaces**
   TTS first, transcription second if mobile/Telegram workflows matter.

5. **Browser introspection improvements**
   Console, image-listing, richer state helpers.

## Priority 2: Optional / Strategic

1. **Research and trajectory generation surfaces**
   Useful if Guardian wants training-data generation or eval-heavy workflows.

2. **Public skill ecosystem**
   Only after signed manifests and import review exist.

3. **Additional execution backends**
   Docker or managed container backends fit better than raw SSH first.

## Do Not Borrow As-Is

1. monolithic “everything in the agent loop” architecture
2. direct agent mutation of live skills without review
3. broad unsandboxed plugin discovery from user/project/pip sources
4. YOLO / approvals-off as a normalized operating mode
5. treating container isolation as a reason to skip broader policy logic
6. channel-specific logic that bypasses shared orchestration

## Skill Comparison

## Shared Or Closely Overlapping Skill Domains

These areas exist in both repos, though implementation quality and trust posture differ:

- blogwatcher
- Google Workspace
- Himalaya / email workflows
- Nano PDF / document workflows
- Notion
- Obsidian
- code review
- debugging
- planning / writing plans
- test-driven development
- source-driven or spec-driven engineering

## Guardian-Only Or Guardian-Strong Skill Domains

Guardian is much stronger or more deliberate in:

- security triage
- security response automation
- security alert hygiene
- threat intel
- host firewall defense
- native AV management
- network recon
- cloud operations
- Microsoft 365
- coding workspace discipline
- verification-before-completion
- webapp testing
- skill authoring discipline

## Hermes-Only Or Hermes-Strong Skill Domains

Hermes is broader in:

- Apple ecosystem workflows
- GitHub specialist workflows
- creative/media workflows
- gaming/leisure/social workflows
- data science / Jupyter
- smart home
- Linear / PowerPoint
- autonomous-ai-agent interoperability
- RL / MLOps
- public optional-skill ecosystem

## Tool Comparison Summary

### Areas where Guardian is ahead

- cloud operations
- security and threat-intel tooling
- second brain and structured memory surfaces
- provider and policy control-plane tools
- bounded coding workspace tools
- network and host introspection

### Areas where Hermes is ahead

- generic terminal/process tooling
- execute-code orchestration
- delegation
- send-message abstraction
- TTS and voice
- Home Assistant
- RL training tools
- built-in skill management tools

### Important philosophical difference

Guardian prefers **verticalized tools with explicit domain semantics**. Hermes prefers **generic building blocks and agent flexibility**.

Guardian should copy only the generic primitives that materially improve leverage and keep the rest of its verticalized tool philosophy.

## Documentation And Product Maturity Observations

Hermes has strong end-user docs and operational UX, but there are also signs of documentation drift:

- `website/docs/developer-guide/architecture.md` describes “48 tools” and “40 toolsets”
- `website/docs/reference/tools-reference.md` documents 47 built-in tools and is framed around 20 toolsets

That is not a critical flaw, but it indicates some breadth-induced drift.

Guardian's documentation is much more spec-driven and architecture-disciplined. Guardian should keep that advantage.

## Conclusion

Hermes Agent is not a better Guardian. It is a broader, more flexible, more agentic personal runtime with weaker governance boundaries and a much stronger ecosystem/operator ergonomics story.

The right read is:

- Guardian already has the stronger core architecture for a security-first operator platform.
- Hermes has several excellent ideas Guardian should adopt in a Guardian-native way.

If Guardian copies the right things from Hermes, the biggest gains will come from:

1. governed reflective learning
2. programmatic tool orchestration
3. first-class delegation
4. profiles and portability
5. broader channel/editor reach
6. better skill UX

If Guardian copies the wrong things from Hermes, the likely regressions are:

1. architecture sprawl
2. weaker trust boundaries
3. supply-chain exposure
4. harder-to-govern behavior across surfaces

The correct move is therefore **selective architectural borrowing, not runtime convergence**.

## Appendix A: Guardian Built-In Tool Inventory

### Automation

`automation_list`, `automation_output_search`, `automation_output_read`, `automation_save`, `automation_set_enabled`, `automation_run`, `automation_delete`

### Browser

`browser_capabilities`, `browser_navigate`, `browser_read`, `browser_links`, `browser_extract`, `browser_state`, `browser_act`, `browser_interact`

### Cloud

`cpanel_account`, `cpanel_domains`, `cpanel_dns`, `cpanel_backups`, `cpanel_ssl`, `vercel_status`, `vercel_projects`, `vercel_deployments`, `vercel_domains`, `vercel_env`, `vercel_logs`, `cf_status`, `cf_dns`, `cf_ssl`, `cf_cache`, `aws_status`, `aws_ec2_instances`, `aws_ec2_security_groups`, `aws_s3_buckets`, `aws_route53`, `aws_lambda`, `aws_cloudwatch`, `aws_rds`, `aws_iam`, `aws_costs`, `gcp_status`, `gcp_compute`, `gcp_cloud_run`, `gcp_storage`, `gcp_dns`, `gcp_logs`, `azure_status`, `azure_vms`, `azure_app_service`, `azure_storage`, `azure_dns`, `azure_monitor`, `whm_status`, `whm_accounts`, `whm_dns`, `whm_ssl`, `whm_backup`, `whm_services`

### Coding

`package_install`, `shell_safe`, `code_session_list`, `code_session_current`, `code_session_create`, `code_session_attach`, `code_session_detach`, `code_symbol_search`, `code_edit`, `code_patch`, `code_create`, `code_plan`, `code_remote_exec`, `code_git_diff`, `code_git_commit`, `coding_backend_list`, `coding_backend_run`, `coding_backend_status`

### Contacts / Email / Campaigns

`contacts_discover_browser`, `contacts_import_csv`, `contacts_list`, `campaign_create`, `campaign_list`, `campaign_add_contacts`, `campaign_dry_run`, `gmail_draft`, `gmail_send`, `campaign_run`

### Filesystem

`fs_list`, `fs_search`, `fs_read`, `fs_write`, `fs_mkdir`, `fs_delete`, `fs_move`, `fs_copy`, `doc_create`

### Memory

`memory_search`, `memory_recall`, `memory_save`, `memory_bridge_search`

### Network / System

`net_ping`, `net_arp_scan`, `net_port_check`, `net_interfaces`, `net_connections`, `net_dns_lookup`, `net_traceroute`, `net_oui_lookup`, `net_classify`, `net_banner_grab`, `net_fingerprint`, `net_wifi_scan`, `net_wifi_clients`, `net_connection_profiles`, `net_traffic_baseline`, `net_threat_check`, `net_baseline`, `net_anomaly_check`, `net_threat_summary`, `sys_info`, `sys_resources`, `sys_processes`, `sys_services`

### Performance

`performance_status_get`, `performance_profile_apply`, `performance_action_preview`, `performance_action_run`

### Policy

`update_tool_policy`

### Providers

`llm_provider_list`, `llm_provider_models`, `llm_provider_update`

### Search

`doc_search`, `doc_search_status`, `doc_search_reindex`

### Second Brain

`second_brain_overview`, `second_brain_brief_list`, `second_brain_brief_upsert`, `second_brain_generate_brief`, `second_brain_brief_update`, `second_brain_brief_delete`, `second_brain_horizon_scan`, `second_brain_note_list`, `second_brain_note_upsert`, `second_brain_note_delete`, `second_brain_task_list`, `second_brain_task_upsert`, `second_brain_task_delete`, `second_brain_calendar_list`, `second_brain_calendar_upsert`, `second_brain_calendar_delete`, `second_brain_routine_list`, `second_brain_routine_catalog`, `second_brain_routine_create`, `second_brain_people_list`, `second_brain_person_upsert`, `second_brain_person_delete`, `second_brain_library_list`, `second_brain_library_upsert`, `second_brain_library_delete`, `second_brain_routine_update`, `second_brain_routine_delete`, `second_brain_usage`

### Security Intel

`intel_summary`, `intel_watch_add`, `intel_watch_remove`, `intel_scan`, `intel_findings`, `intel_draft_action`, `assistant_security_summary`, `assistant_security_scan`, `assistant_security_findings`, `forum_post`, `host_monitor_status`, `host_monitor_check`, `gateway_firewall_status`, `gateway_firewall_check`, `windows_defender_status`, `windows_defender_refresh`, `windows_defender_scan`, `windows_defender_update_signatures`, `security_alert_search`, `security_posture_status`, `security_containment_status`, `security_alert_ack`, `security_alert_resolve`, `security_alert_suppress`

### Web

`chrome_job`, `web_search`, `web_fetch`

### Workspace

`gws`, `gws_schema`, `outlook_draft`, `outlook_send`, `m365`, `m365_schema`

## Appendix B: Hermes Built-In Tool Inventory

### Browser

`browser_back`, `browser_click`, `browser_console`, `browser_get_images`, `browser_navigate`, `browser_press`, `browser_scroll`, `browser_snapshot`, `browser_type`, `browser_vision`

### Clarify

`clarify`

### Code Execution

`execute_code`

### Cronjob

`cronjob`

### Delegation

`delegate_task`

### File

`patch`, `read_file`, `search_files`, `write_file`

### Home Assistant

`ha_call_service`, `ha_get_state`, `ha_list_entities`, `ha_list_services`

### Image Generation

`image_generate`

### Memory

`memory`

### Messaging

`send_message`

### Mixture Of Agents

`mixture_of_agents`

### RL

`rl_check_status`, `rl_edit_config`, `rl_get_current_config`, `rl_get_results`, `rl_list_environments`, `rl_list_runs`, `rl_select_environment`, `rl_start_training`, `rl_stop_training`, `rl_test_inference`

### Session Search

`session_search`

### Skills

`skill_manage`, `skill_view`, `skills_list`

### Terminal

`process`, `terminal`

### Todo

`todo`

### Vision

`vision_analyze`

### Web

`web_extract`, `web_search`

### TTS

`text_to_speech`

## Appendix C: Guardian Bundled Skills

`automation-builder`, `blogwatcher`, `browser-session-defense`, `cc-skill-security-review`, `cloud-operations`, `code-review`, `code-simplification`, `coding-backend-orchestration`, `coding-workspace`, `context-engineering`, `deep-research`, `deprecation-and-migration`, `file-workflows`, `gha-security-review`, `github`, `google-workspace`, `himalaya`, `host-firewall-defense`, `incremental-implementation`, `k8s-security-policies`, `knowledge-search`, `mcp-builder`, `microsoft-365`, `monitoring-expert`, `multi-search-engine`, `nano-pdf`, `native-av-management`, `network-recon`, `notion`, `obsidian`, `oracle`, `outreach-campaigns`, `planning-and-task-breakdown`, `preferences-memory`, `receiving-code-review`, `security-alert-hygiene`, `security-mode-escalation`, `security-response-automation`, `security-triage`, `skill-creator`, `slack`, `source-driven-development`, `spec-driven-development`, `system-operations`, `systematic-debugging`, `test-driven-development`, `threat-intel`, `using-skills`, `verification-before-completion`, `weather`, `web-research`, `webapp-testing`, `writing-plans`

## Appendix D: Hermes Core Skills

`apple/apple-notes`, `apple/apple-reminders`, `apple/findmy`, `apple/imessage`, `autonomous-ai-agents/claude-code`, `autonomous-ai-agents/codex`, `autonomous-ai-agents/hermes-agent`, `autonomous-ai-agents/opencode`, `creative/ascii-art`, `creative/ascii-video`, `creative/creative-ideation`, `creative/excalidraw`, `creative/manim-video`, `creative/p5js`, `creative/popular-web-designs`, `creative/songwriting-and-ai-music`, `data-science/jupyter-live-kernel`, `devops/webhook-subscriptions`, `email/himalaya`, `gaming/minecraft-modpack-server`, `gaming/pokemon-player`, `github/codebase-inspection`, `github/github-auth`, `github/github-code-review`, `github/github-issues`, `github/github-pr-workflow`, `github/github-repo-management`, `leisure/find-nearby`, `mcp/mcporter`, `mcp/native-mcp`, `media/gif-search`, `media/heartmula`, `media/songsee`, `media/youtube-content`, `mlops/cloud`, `mlops/evaluation`, `mlops/huggingface-hub`, `mlops/inference`, `mlops/models`, `mlops/research`, `mlops/training`, `mlops/vector-databases`, `note-taking/obsidian`, `productivity/google-workspace`, `productivity/linear`, `productivity/nano-pdf`, `productivity/notion`, `productivity/ocr-and-documents`, `productivity/powerpoint`, `red-teaming/godmode`, `research/arxiv`, `research/blogwatcher`, `research/llm-wiki`, `research/polymarket`, `research/research-paper-writing`, `smart-home/openhue`, `social-media/xitter`, `software-development/plan`, `software-development/requesting-code-review`, `software-development/subagent-driven-development`, `software-development/systematic-debugging`, `software-development/test-driven-development`, `software-development/writing-plans`

## Appendix E: Hermes Optional Skills

`autonomous-ai-agents/blackbox`, `autonomous-ai-agents/honcho`, `blockchain/base`, `blockchain/solana`, `communication/one-three-one-rule`, `creative/blender-mcp`, `creative/meme-generation`, `devops/cli`, `devops/docker-management`, `email/agentmail`, `health/neuroskill-bci`, `mcp/fastmcp`, `migration/openclaw-migration`, `mlops/accelerate`, `mlops/chroma`, `mlops/faiss`, `mlops/flash-attention`, `mlops/hermes-atropos-environments`, `mlops/huggingface-tokenizers`, `mlops/instructor`, `mlops/lambda-labs`, `mlops/llava`, `mlops/nemo-curator`, `mlops/pinecone`, `mlops/pytorch-lightning`, `mlops/qdrant`, `mlops/saelens`, `mlops/simpo`, `mlops/slime`, `mlops/tensorrt-llm`, `mlops/torchtitan`, `productivity/canvas`, `productivity/memento-flashcards`, `productivity/siyuan`, `productivity/telephony`, `research/bioinformatics`, `research/domain-intel`, `research/duckduckgo-search`, `research/gitnexus-explorer`, `research/parallel-cli`, `research/qmd`, `research/scrapling`, `security/1password`, `security/oss-forensics`, `security/sherlock`
