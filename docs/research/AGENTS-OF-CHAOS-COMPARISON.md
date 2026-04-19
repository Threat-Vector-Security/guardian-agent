# Agents of Chaos vs GuardianAgent

**Date:** 2026-03-08  
**Primary source:** [Agents of Chaos: Red Teaming Multi-Agent Systems through Misaligned Communication and Environmental Exploits](https://arxiv.org/abs/2602.20021)  
**Companion report:** [interactive case-study report](https://agentsofchaos.baulab.info/)

## Executive Summary

The short answer is: **GuardianAgent already mitigates a meaningful share of the paper's failures, especially the tool-execution and environment-abuse ones, but it does not fully solve the ownership/authorization and indirect-instruction problems.**

Compared with the paper's evaluated agents, GuardianAgent is materially stronger in these areas:

- mandatory runtime chokepoints instead of prompt-only policy (`src/runtime/runtime.ts`, `src/index.ts`)
- explicit capability checks with default-deny for unknown actions (`src/guardian/guardian.ts`)
- tool allowlists, approval gates, and strict external-post controls (`src/tools/executor.ts`)
- shell command validation and sandbox-aware disabling of risky tools (`src/guardian/shell-validator.ts`, `src/tools/executor.ts`)
- untrusted tool-result scanning before content re-enters the model (`src/guardian/output-guardian.ts`, `src/index.ts`)
- loop/budget/watchdog controls that reduce runaway multi-agent behavior (`src/agent/orchestration.ts`, `src/runtime/budget.ts`, `src/runtime/watchdog.ts`)

The biggest remaining gaps against the paper are:

1. **Owner verification and authorization are still coarse.**
2. **Indirect prompt injection is detected and labeled, but not strongly quarantined.**
3. **There is no general postcondition verification layer before the agent claims success.**

## What The Paper Shows

The paper's abstract and companion report show that modern agents can fail in ways that are not just "prompt injection":

- they overreact to ordinary tasks with disproportionate system actions
- they comply with instructions from non-owners
- they can be manipulated by linked or embedded content
- multi-agent setups can loop, waste resources, or silently diverge
- they may claim tasks are complete even when system state says otherwise

The companion report's case studies are especially relevant for GuardianAgent:

- **CS1:** destructive overreaction to a leaked password
- **CS2 / CS8:** non-owner compliance and owner spoofing
- **CS4 / CS5:** looping and storage/resource exhaustion
- **CS10:** indirect prompt injection from linked content
- **CS11:** harmful external actions such as posting misinformation

## Comparison

### 1. Disproportionate or destructive action

**Paper risk:** agent takes an overly aggressive action, such as destroying or disabling infrastructure to address a small problem.

**GuardianAgent status:** **largely mitigated**

Why:

- destructive and mutating actions pass through `checkAction()` and the tool runtime before execution (`src/runtime/runtime.ts`, `src/tools/executor.ts`)
- unknown action types are denied by default (`src/guardian/guardian.ts`)
- shell access is allowlisted and validated, with subshells, redirects to denied paths, and chained commands blocked (`src/guardian/shell-validator.ts`, `src/guardian/argument-sanitizer.ts`)
- non-read-only tools go through inline LLM risk review via `GuardianAgentService` and fail closed by default (`src/runtime/sentinel.ts`, `src/index.ts`)
- default tool policy mode is `approve_by_policy`, not full autonomy (`src/config/types.ts`, `README.md`)

Residual risk:

- if an operator broadens `allowedCommands`, switches to `autonomous`, or weakens sandbox policy, this protection degrades quickly
- GuardianAgent still relies on policy shape and operator configuration, not a formal effect system

### 2. Non-owner compliance and owner spoofing

**Paper risk:** the agent obeys someone who is not the owner, or mistakes a non-owner for the owner.

**GuardianAgent status:** **partially mitigated**

What exists:

- Telegram can restrict access by `allowedChatIds` (`src/channels/telegram.ts`)
- web access requires bearer/session auth (`src/channels/web.ts`)
- approvals are scoped in chat flows by `userId` and `channel` when pending approvals are surfaced back to the same conversation (`src/tools/executor.ts`, `src/index.ts`)

What is missing:

- `IdentityService` resolves identity; it does **not** authorize actions (`src/runtime/identity.ts`)
- Telegram authorization is by **chat ID**, not per-sender principal; in an allowed group chat, any participant can talk to the bot (`src/channels/telegram.ts`)
- the web channel accepts caller-supplied `userId` fields after authentication, which is fine for single-user mode but weak for multi-user/admin-separated deployments (`src/channels/web.ts`, `src/index.ts`)
- direct approval decisions from the web/CLI control plane are not bound to the original requester; an authenticated dashboard user can approve by raw `approvalId` (`src/channels/web.ts`, `src/index.ts`, `src/channels/cli.ts`)

This is the **highest-priority gap** relative to the paper.

### 3. Indirect prompt injection from linked or fetched content

**Paper risk:** the agent follows instructions hidden in web pages, documents, or other fetched content.

**GuardianAgent status:** **partially mitigated**

What exists:

- message input is sanitized for prompt-injection markers and invisible Unicode (`src/guardian/input-sanitizer.ts`)
- tool results are scanned before reinjection into the model; invisible Unicode is stripped and injection patterns are flagged (`src/guardian/output-guardian.ts`)
- tool outputs are wrapped with explicit `<tool_result ... trust="external">` envelopes and warning lines before being returned to the model (`src/index.ts`)

What is missing:

- suspicious remote content is still usually passed back into the main model after sanitization and warning, rather than being quarantined or summarized in a lower-trust path
- the system detects injection-like content, but it does not yet treat that content as a hard taint that blocks downstream planning or tool use

This means GuardianAgent is better than the paper's agents, but **not yet robust against determined indirect-instruction attacks**.

### 4. Multi-agent loops and runaway execution

**Paper risk:** agents loop, recursively delegate, or keep consuming resources after the original task should have stopped.

**GuardianAgent status:** **mostly mitigated for built-in orchestration, partially mitigated overall**

What exists:

- `LoopAgent` has mandatory `maxIterations` (`src/agent/orchestration.ts`)
- runtime enforces token-rate, concurrency, queue-depth, and wall-clock budgets (`src/runtime/runtime.ts`, `src/runtime/budget.ts`)
- the watchdog marks stalled agents and applies retry backoff (`src/runtime/watchdog.ts`)
- event sources are validated before delivery (`src/runtime/runtime.ts`, `src/queue/event-bus.ts`)

What is still missing:

- there is no general event-hop TTL or cycle detector for arbitrary inter-agent ping-pong patterns
- Sentinel detects anomalies retrospectively, but not as an in-band kill switch for causal loops

### 5. Storage and resource exhaustion

**Paper risk:** agents bloat memory, storage, or mailbox state through repeated or oversized actions.

**GuardianAgent status:** **partially mitigated**

What exists:

- hard size caps for tool args, reads, fetches, and Google/native workspace outputs (`src/tools/executor.ts`, `src/google/google-service.ts`)
- queue depth and per-agent token budgets (`src/runtime/runtime.ts`, `src/runtime/budget.ts`)
- request body limits in the web channel (`src/channels/web.ts`)

What is still missing:

- no unified quota model for persistent storage growth across memory, audit, imported documents, campaigns, or repeated remote fetches
- no per-user or per-session "storage budget" with alerts and hard stops

### 6. Harmful external actions, misinformation, and libel-style posting

**Paper risk:** the agent sends, posts, or publishes harmful content externally.

**GuardianAgent status:** **largely mitigated**

Why:

- `external_post` tools always require manual approval (`src/tools/executor.ts`)
- forum posting is disabled unless `allowExternalPosting` is explicitly enabled, and even then still requires approval (`src/tools/executor.ts`, `src/config/types.ts`)
- Gmail send flows require approval (`src/tools/executor.ts`)

Residual risk:

- the safety boundary assumes the approver is the right person
- if ownership/authentication is weak, approvals can become a rubber stamp for the wrong actor

### 7. False claims of success

**Paper risk:** the agent reports completion even though the underlying system state does not match.

**GuardianAgent status:** **not fully mitigated**

GuardianAgent improves auditability, but it does **not** yet implement a general "verify postcondition before telling the user it worked" layer.

Current state:

- tool outputs are captured, compacted, and passed back to the model (`src/index.ts`)
- audit/job records exist (`src/tools/executor.ts`)

Missing:

- per-tool success predicates
- required follow-up verification for high-impact actions
- response grounding rules like "do not say completed unless a tool result contains a concrete success artifact"

This is the second biggest gap after owner authorization.

## Priority Mitigations

### P0: Bind actions and approvals to a real principal

Recommended changes:

- add a first-class `actorId` / `principalId` separate from conversational `userId`
- in Telegram, add `allowedUserIds` and reject group-chat control unless explicitly enabled
- in web, derive the acting principal from the authenticated session/token; do not trust arbitrary request-body `userId` for authorization
- bind each approval request to the originating principal and require the same principal, or an explicitly privileged admin session, to approve it

### P1: Quarantine untrusted remote content

Recommended changes:

- extend `scanToolResult()` to return a hard `quarantine` decision when injection score crosses a threshold
- do not feed raw external content from `web_*`, `browser_*`, `mcp-*`, or remote workspace results back into the main planner model when quarantined
- instead, run a constrained extraction step that only returns factual fields and strips imperative text
- preserve provenance/taint on external content all the way through memory and downstream tool planning

### P1: Add postcondition verification for high-impact tools

Recommended changes:

- give mutating tools optional `verify()` hooks
- for filesystem mutation, verify path/hash/state after the tool returns
- for outbound messages/posts, require provider-confirmed IDs or URLs before telling the user the action completed
- force final responses for high-impact actions to cite job IDs or concrete success artifacts

### P2: Add loop and quota kill switches

Recommended changes:

- attach causal IDs and hop counts to emitted events
- stop or require approval when event chains exceed a threshold
- add per-user and per-agent persistent storage budgets
- promote Sentinel anomaly findings into optional live circuit breakers, not just retrospective reporting

### P2: Tighten control-plane policy updates

This is adjacent to the paper, but relevant to "silent policy drift."

Current chat-based `update_tool_policy` changes require approval, but direct dashboard/CLI policy updates apply immediately through the control plane (`src/index.ts`, `src/channels/web.ts`, `src/channels/cli.ts`).

Recommended changes:

- require a privileged ticket or second confirmation for allowlist expansion
- record richer approval metadata for policy changes
- optionally force policy relaxations through the same approval queue used by chat

## Bottom Line

GuardianAgent is **already safer than the agents described in the paper** on the most concrete execution-path risks:

- unrestricted shell execution
- destructive actions without approval
- unsafe external posting
- raw secret exfiltration through outputs or tool-result reinjection
- simple loop/runaway failures in built-in orchestration

But it is **not done**. The paper's strongest remaining challenge to GuardianAgent is not "more prompt injection regex." It is:

1. **proving who is allowed to ask for what**
2. **treating remote content as tainted data, not just suspicious text**
3. **verifying world state before claiming success**

If we fix those three areas, GuardianAgent would close most of the meaningful gap exposed by the paper.

## Sources

- [arXiv abstract: 2602.20021](https://arxiv.org/abs/2602.20021)
- [Agents of Chaos interactive report](https://agentsofchaos.baulab.info/)
