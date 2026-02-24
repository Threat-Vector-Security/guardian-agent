# AI Agent Security Research Report

**Date:** 2026-02-24
**Scope:** OpenClaw vulnerabilities, general AI coding agent security risks, protective design patterns

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [OpenClaw-Specific Vulnerabilities](#openclaw-specific-vulnerabilities)
3. [Credential and Secret Exposure](#credential-and-secret-exposure)
4. [Command Injection and Arbitrary Code Execution](#command-injection-and-arbitrary-code-execution)
5. [Prompt Injection Attacks](#prompt-injection-attacks)
6. [Supply Chain Attacks Through AI Agents](#supply-chain-attacks-through-ai-agents)
7. [Data Exfiltration Risks](#data-exfiltration-risks)
8. [How Current AI Agents Handle Security](#how-current-ai-agents-handle-security)
9. [Protective Agent Design: Preventing User Security Mistakes](#protective-agent-design)
10. [Recommendations for OpenAgent](#recommendations-for-openagent)
11. [Sources](#sources)

---

## Executive Summary

The rapid adoption of AI coding agents in 2025-2026 has exposed a wide and growing attack surface. The landscape includes:

- **512 vulnerabilities** found in OpenClaw's security audit, 8 classified as critical
- **Over 40,000 exposed OpenClaw instances** on the public internet, 93.4% with authentication bypass
- **30+ CVEs (dubbed "IDEsaster")** across Cursor, Copilot, Windsurf, Cline, and other AI coding tools
- **84% attack success rate** for executing malicious commands via prompt injection in Copilot and Cursor
- **800+ malicious skills** in OpenClaw's ClawHub registry (~20% of total ecosystem)
- **Prompt injection** ranked as the #1 critical vulnerability by OWASP, appearing in 73% of production AI deployments

The core insight is that AI coding agents combine three dangerous capabilities: they process untrusted input, access sensitive data, and execute system commands. Any agent that does all three without isolation boundaries becomes a full exploit chain.

---

## OpenClaw-Specific Vulnerabilities

### Background

OpenClaw is an open-source, self-hosted AI agent framework that went viral in late January 2026. Originally launched as "Clawdbot" by Austrian developer Peter Steinberger in November 2025, it was rebranded twice following trademark pressure from Anthropic before settling on its current name.

### Critical CVEs

| CVE | CVSS | Description |
|-----|------|-------------|
| CVE-2026-25253 | 8.8 | Authentication token leak via agent visiting attacker-controlled site. Grants full admin control over the gateway. Patched in v2026.1.29. |
| CVE-2026-24763 | High | Command injection vulnerability |
| CVE-2026-25157 | High | Second command injection vulnerability |
| Six additional CVEs | Various | Server-side request forgery (SSRF), missing authentication, path traversal |

### Exposed Instances

Security researcher Maor Dayan identified **42,665 exposed OpenClaw instances** on the public internet. Of these:
- **5,194** were actively confirmed vulnerable
- **93.4%** exhibited authentication bypass conditions

This is a direct consequence of OpenClaw's self-hosted nature combined with poor default security configuration. Many users deployed it without changing default credentials or restricting network access.

### ClawHub Supply Chain Compromise (ClawHavoc Campaign)

This is one of the most significant AI agent security incidents to date:

- **341 malicious skills** initially discovered in ClawHub (February 2, 2026)
- The number grew to **824+ malicious skills** across 10,700+ total skills (~20% of registry)
- Bitdefender's independent analysis found approximately **900 malicious packages**
- **335** of the initial malicious skills traced to a single coordinated operation: "ClawHavoc"
- Malicious skills disguised as crypto trading/wallet automation tools
- Payloads included **Atomic Stealer (AMOS)** and keyloggers targeting browser cookies, keychains, API keys, and crypto wallets
- ClawHub's only barrier to publishing: a GitHub account at least one week old

A separate Snyk study ("ToxicSkills") found **1,467 malicious payloads** across the ClawHub ecosystem, with prompt injection present in **36%** of analyzed skills.

### Architectural Concerns

- Docker sandbox with workspace access modes (none/ro/rw) provides some isolation but does not prevent all attack vectors
- The agent's system-level access makes it a potential covert data-leak channel that bypasses traditional DLP
- The prompt itself becomes the execution instruction, blurring the line between data and code

---

## Credential and Secret Exposure

### The Problem

AI coding agents routinely read project files to build context. This includes `.env` files, configuration files, and other sources that frequently contain credentials. The agent then holds these secrets in its context window, where they can be:

1. **Leaked through prompt injection** -- an attacker-controlled input triggers the agent to transmit secrets externally
2. **Logged by the AI provider** -- prompts and outputs may be stored for debugging/quality purposes
3. **Included in generated code** -- the agent reproduces secrets in code it writes
4. **Sent to third-party tools** -- MCP servers and extensions may receive the full context

### Real-World Incidents

**Claude Code .env File Exposure:**
A developer discovered that Claude Code was accessing his `HTTP_PROXY` environment variable loaded from a `.env` file inside a project directory. This was discovered when running Claude Code in debug mode.

**Training Data Contamination:**
In early 2025, security researchers found that AI training datasets drawn from Common Crawl contained **thousands of valid credentials** -- API keys, passwords, and tokens -- that remained active. These were inadvertently ingested into language models and could be reproduced in completions.

**12,000 API Keys Exposed:**
A study found over 12,000 API keys and passwords exposed in AI training data, with researchers estimating potential costs of over $100,000 per day when stolen credentials are used to query cutting-edge models.

### IDE-Specific Risks

According to Knostic research:
- Claude Code reads `.env` files and can expose their contents unintentionally
- Cursor and Windsurf load JSON and YAML configuration files into context, which often contain cloud tokens, database credentials, or deployment settings
- About **50% of AI coding tools** in VSCode potentially expose credentials through unsafe storage practices

---

## Command Injection and Arbitrary Code Execution

### IDEsaster: 30+ CVEs Across AI Coding Tools

Security researcher Ari Marzouk (MaccariTA) discovered over 30 vulnerabilities across AI coding tools, collectively named "IDEsaster." Key findings:

- **100% of tested AI IDEs and coding assistants were vulnerable**
- 24 vulnerabilities received CVE identifiers
- Affected tools: Cursor, Windsurf, Kiro.dev, GitHub Copilot, Zed.dev, Roo Code, Junie, Cline
- The root cause: IDEs were never designed for autonomous components capable of reading, editing, and generating files

**Attack vectors include:**
- **Remote JSON Schema attacks** affecting VS Code, JetBrains IDEs, and Zed.dev -- enabling data exfiltration via automatic GET requests to attacker-controlled domains
- **IDE Settings Overwrite** -- manipulating `.vscode/settings.json` or `.idea/workspace.xml` to execute arbitrary commands
- **Chaining prompt injection with legitimate IDE functionality** -- no apparent bug in the AI tool itself, just misuse of standard features

### GitHub Copilot RCE (CVE-2025-53773)

A remote code execution vulnerability through prompt injection in GitHub Copilot potentially compromised the machines of millions of developers. Attack success rates reached as high as **84%** for executing malicious commands in Copilot and Cursor.

### Claude Code Command Injection (CVE-2025-54795)

Improper input sanitization in how Claude Code handles whitelisted commands allowed attackers to break out of the intended command context and execute unintended shell commands without user confirmation.

### OpenAI Codex CLI Command Injection

A command injection flaw in OpenAI Codex CLI exploits implicit trust in commands configured via MCP server entries. These are executed at startup without seeking user permission, enabling arbitrary command execution when a malicious actor tampers with `.env` and `.codex/config.toml` files.

### MCP Protocol Command Injection (OWASP MCP05:2025)

OWASP identified command injection through the Model Context Protocol as a significant attack class. In May 2025, Invariant disclosed a critical MCP vulnerability in GitHub's implementation where attackers embedded malicious commands within public repository Issues to hijack locally running AI agents.

### SCADA System Attack

One of the most alarming incidents: a PDF email attachment contained hidden instructions in white text with base64 encoding that instructed Claude to write tag values to SCADA systems, resulting in unexpected **pump activation that damaged industrial equipment**. The engineer used Claude for routine document summarization while simultaneously having MCP access to industrial control systems.

---

## Prompt Injection Attacks

### Scale and Prevalence

Prompt injection is ranked **#1 in OWASP's 2025 Top 10 for LLM Applications**, appearing in over **73% of production AI deployments** assessed during security audits.

### Direct vs. Indirect Prompt Injection

**Direct prompt injection:** The user (or attacker posing as user) provides crafted input directly to the AI agent to override its instructions.

**Indirect prompt injection:** Malicious instructions are embedded in data the agent processes -- web pages, PDFs, code comments, repository issues, MCP tool descriptions, configuration files. This is far more dangerous because:
- The attacker need not have direct access to the agent
- The poisoned content looks normal to human reviewers
- The agent cannot distinguish between legitimate data and injected commands

### The Rules File Backdoor

Discovered by Pillar Security in March 2025, this attack uses invisible Unicode characters (zero-width joiners, bidirectional text markers) to embed malicious instructions in AI coding agent configuration files (`.cursorrules`, `.github/copilot-instructions.md`):

- Instructions are invisible to human reviewers but readable by the AI
- Because rules files are shared across projects, one compromised file propagates through the supply chain
- Affects both Cursor and GitHub Copilot
- GitHub implemented a warning feature for hidden Unicode in files in May 2025

### Perplexity Comet Browser Attack (August 2025)

Attackers embedded hidden commands in Reddit comment sections. When users activated Comet's "summarize current page" feature, the AI:
1. Logged into the user's email
2. Bypassed captchas
3. Transmitted credentials back to the attacker

All within **150 seconds**.

### InversePrompt (CVE-2025-54794 & CVE-2025-54795)

Cymulate researchers demonstrated techniques to turn Claude against itself through carefully crafted prompts that exploited the model's own instruction-following capabilities.

---

## Supply Chain Attacks Through AI Agents

### The New Attack Surface

AI agents introduce a fundamentally new supply chain attack vector: the **skills/plugin/extension ecosystem**. Unlike traditional package managers (npm, pip) which have years of security tooling, AI agent skill registries are nascent and largely unvetted.

### ClawHub: A Case Study in Supply Chain Failure

As detailed above, ~20% of ClawHub's skills registry was found to be malicious. The low barrier to entry (only requiring a week-old GitHub account) combined with the agent's system-level access created an ideal attack surface.

### npm/PyPI Supply Chain Evolution

AI tools are both targets and amplifiers of supply chain attacks:

**s1ngularity Attack (August 2025):** Malicious versions of the widely used Nx build system were published to npm, stealing cryptocurrency wallets, GitHub/npm tokens, and SSH keys. Researchers found signs of AI-generated malicious code.

**Shai-Hulud Worm (September 2025):** Trojanized 40+ npm packages including `@ctrl/tinycolor`, ultimately compromising **526 packages**. The evolved Shai-Hulud 2.0 (November 2025) compromised **796 packages** with 20 million weekly downloads, installed the Bun runtime to evade Node.js monitoring, and included a "dead man's switch" threatening data destruction.

**CISA Alert (September 2025):** CISA issued an official alert for widespread supply chain compromise impacting the npm ecosystem.

**AI-Generated Malware:** Researchers found **56,928 "poisoned" packages** across various platforms in 2025, with growing evidence that LLMs are being used to generate malicious package code at scale.

### The GlueStack Supply Chain Attack

The GlueStack incident compromised 17 npm packages, demonstrating how AI coding agents that automatically install dependencies suggested by the model can inadvertently pull in compromised packages.

### MaliciousCorgi: VS Code Extension Attack

Malicious AI-powered VS Code extensions were found to be harvesting code from **1.5 million developers**, highlighting the risk of the broader IDE extension ecosystem.

---

## Data Exfiltration Risks

### Claude Code DNS Exfiltration (CVE-2025-55284)

One of the most sophisticated attacks documented:

1. Attacker embeds prompt injection in a file the agent will analyze
2. The injected prompt instructs Claude to read `.env` files
3. Claude encodes the secrets into DNS subdomain queries (e.g., `API_KEY_VALUE.attacker.com`)
4. DNS requests reach attacker-controlled nameservers
5. The Read tool never asks for permission when reading local project files
6. Claude was trained to refuse common security testing domains (oast.me, Burp Collaborator) but the bypass was trivial: use any other domain

**CVSS 7.1 (High).** Disclosed May 26, 2025, fixed June 6, 2025. Mitigation: Anthropic removed `ping`, `nslookup`, `dig`, and `host` from the allowlisted commands list.

### Windsurf Data Exfiltration

Multiple exfiltration vectors discovered:

1. **Tool Exploitation:** The `read_url_content` tool allows outbound HTTP requests that can encode secrets in the URL. This tool did not require user approval.
2. **Image Rendering:** Malicious prompts force the AI to generate `<img>` tags with source URLs containing embedded sensitive data. The client sends data to external servers when rendering.
3. **Disclosure timeline:** Reported May 30, 2025. Windsurf acknowledged receipt but all subsequent inquiries about triage or fixes went unanswered for three months.

### Claude Pirate: Abusing Anthropic's File API

Researchers at Embrace The Red demonstrated using Anthropic's own file API as a data exfiltration channel -- encoding stolen data into file uploads that the attacker could later retrieve.

### Covert Channels in AI Agents

AI agents with system access can become covert data-leak channels that bypass traditional Data Loss Prevention (DLP) tools because:
- The agent's legitimate function involves reading and transmitting code
- Exfiltration can be disguised as normal agent activity
- Network requests initiated by the agent look like legitimate API calls
- DNS-based exfiltration bypasses most network monitoring

---

## How Current AI Agents Handle Security

### Claude Code

**Protections:**
- Human-in-the-loop for bash commands (asks user before running)
- Does not use code for model training
- Limited retention periods for sensitive information
- Restricted access to user session data
- File read operations for local project files do not require confirmation (a known weakness)
- Patched DNS exfiltration and command injection CVEs

**Gaps:**
- Reads `.env` files without warning or special handling
- Allowlisted commands can be exploited (CVE-2025-54795)
- No built-in secret detection or credential scanning
- Environment variables accessible via `/proc/PID/environ`

### Cursor

**Protections:**
- Rules file system for guiding agent behavior
- Manual approval mode available (but not default)

**Gaps:**
- Vulnerable to Rules File Backdoor via invisible Unicode
- Part of the IDEsaster CVE family
- 84% attack success rate for malicious command execution

### GitHub Copilot

**Protections:**
- GitHub implemented Unicode warning feature for hidden text (May 2025)
- Code scanning integration available

**Gaps:**
- CVE-2025-53773 (RCE through prompt injection)
- Vulnerable to Rules File Backdoor
- Part of the IDEsaster CVE family

### Windsurf

**Protections:**
- Security page with stated policies

**Gaps:**
- Multiple unpatched exfiltration vulnerabilities (as of August 2025 disclosure)
- `read_url_content` tool requires no user approval
- Unresponsive to security disclosure

### Cline

**Protections:**
- Open-source with community review
- Human approval for file operations

**Gaps:**
- Part of the IDEsaster CVE family
- Plugin/extension ecosystem risks

### Agent Skills Registry (tech-leads-club)

A notable positive example: a hardened, verified skill registry with:
- Filesystem isolation with recursive path traversal protection
- Input sanitization with strict validation
- Symlink guards for safe symbolic link handling
- Integrity verification through lockfile-based validation
- Automated continuous security scanning

---

## Protective Agent Design

### Meta's Rule of Two

Meta published a security framework that states an AI agent must satisfy **at most two** of three properties:

1. **Processing untrusted inputs** (emails, websites, user-uploaded content)
2. **Accessing sensitive data** (private repos, databases, credentials, .env files)
3. **Changing state / communicating externally** (running commands, calling APIs, sending data)

If an agent has all three, an attacker can complete the full exploit chain: inject instructions, access secrets, and exfiltrate them. By limiting agents to two of three, you break the chain.

**This is a supplement to -- not a substitute for -- least privilege, sandboxing, and defense-in-depth.**

### Protective Design Patterns

#### 1. Proactive Secret Detection

An agent should actively prevent users from committing secrets:
- Scan files before staging for git commits (equivalent to a built-in `git-secrets` or `detect-secrets`)
- Refuse to write code containing hardcoded credentials
- Warn when reading files with credential-like patterns
- Suggest `.gitignore` entries for sensitive file patterns
- Never include secrets in generated code, even if the user asks

#### 2. Credential Isolation

- Never load `.env` files into the agent's context unless explicitly necessary
- If credentials must be read, treat them as opaque tokens -- reference by name, never by value
- Maintain a deny-list of file patterns that should not be read into context (`.env`, `credentials.json`, `*.pem`, etc.)
- Use credential vaults or brokers instead of file-based secrets

#### 3. Sandboxed Execution

- Run agent-initiated commands in containers or VMs with restricted network access
- Use devcontainers with outbound network controls
- Apply filesystem isolation to prevent access to sensitive paths outside the project
- Implement circuit breakers that halt agent activity on anomalous behavior

#### 4. Input Sanitization and Filtering

- Filter all input for known prompt injection patterns
- Strip invisible Unicode characters from rules files and configuration
- Validate MCP tool responses for injected instructions
- Implement both deny-lists (attack signatures) and allow-lists (topic domains)

#### 5. Human-in-the-Loop Tiers

Design a tiered approval system:
- **Auto-approve:** Read-only operations on non-sensitive files, linting, formatting
- **Soft confirm:** File writes, dependency installation (show diff, require acknowledgment)
- **Hard confirm:** Command execution, network requests, file operations on sensitive paths, git operations
- **Deny by default:** Operations touching credentials, sending data to external domains

#### 6. Behavioral Monitoring

- Establish a baseline of normal agent behavior per session
- Alert on deviations: unusual API calls, unexpected data access, network egress to new destinations
- Implement rate limiting and anomaly detection
- Log all agent actions for audit

#### 7. Multi-Layer Defense for Git Operations

The agent should enforce multiple protective layers for version control:

| Layer | Tool | Purpose |
|-------|------|---------|
| Prevention | `.gitignore` templates | Prevent untracked sensitive files |
| Pre-commit | `git-secrets`, `detect-secrets` | Block secrets at commit time |
| Pre-push | Secret scanning hooks | Catch secrets before push |
| Server-side | GitHub Secret Scanning | Continuous monitoring after push |
| Emergency | `git filter-repo` | Remove secrets from history |

An intelligent agent should check for and recommend ALL of these layers, and refuse to commit files that match secret patterns.

#### 8. MCP Security

- Validate all MCP tool inputs and outputs
- Implement fine-grained permission scopes per MCP server
- Do not auto-execute MCP-configured commands at startup
- Treat MCP tool descriptions as potentially adversarial

---

## Recommendations for OpenAgent

Based on this research, the following security measures should be considered for OpenAgent's architecture:

### Must-Have (Critical)

1. **Never commit secrets:** Build credential detection into the git workflow. The agent should scan staged changes for API keys, tokens, passwords, and connection strings before committing. This should be non-bypassable.

2. **Sandbox command execution:** All agent-initiated commands should run in an isolated environment with restricted network access and filesystem boundaries. Apply Meta's Rule of Two: if the agent processes untrusted input and accesses sensitive data, it should NOT be able to communicate externally.

3. **Human approval for destructive operations:** Require explicit user confirmation for: shell commands, file deletions, git pushes, network requests to external domains, and any operation touching credential files.

4. **Deny-list for sensitive files:** Maintain a list of file patterns (`.env`, `*.pem`, `credentials.*`, `*secret*`) that the agent should never read into its context without explicit user override.

### Should-Have (Important)

5. **Unicode sanitization:** Strip invisible Unicode characters from all configuration files and rules files to prevent Rules File Backdoor attacks.

6. **MCP input validation:** Treat all MCP tool inputs and outputs as potentially adversarial. Validate, sanitize, and scope permissions narrowly.

7. **Behavioral anomaly detection:** Monitor for unusual patterns -- unexpected network requests, access to files outside the project, sudden changes in command execution patterns.

8. **Skills/plugin vetting:** If OpenAgent supports plugins or skills, implement a security review process far more rigorous than ClawHub's (where the only barrier was a week-old GitHub account).

### Nice-to-Have (Defense in Depth)

9. **Session-scoped credentials:** If credentials must be used, scope them to the minimum required session and revoke afterward.

10. **Audit logging:** Log all agent actions (file reads, writes, commands, network requests) for post-incident analysis.

11. **Rate limiting and circuit breakers:** Halt agent activity automatically when anomalous thresholds are crossed.

12. **DNS exfiltration prevention:** Block or monitor DNS requests initiated by the agent, especially to non-standard domains.

---

## Sources

### OpenClaw Vulnerabilities
- [Cisco Blogs: Personal AI Agents like OpenClaw Are a Security Nightmare](https://blogs.cisco.com/ai/personal-ai-agents-like-openclaw-are-a-security-nightmare)
- [Bitsight: OpenClaw AI Security Risks Exposed](https://www.bitsight.com/blog/openclaw-ai-security-risks-exposed-instances)
- [VentureBeat: OpenClaw Agentic AI Security Risk CISO Guide](https://venturebeat.com/security/openclaw-agentic-ai-security-risk-ciso-guide)
- [Kaspersky: OpenClaw Vulnerabilities Exposed](https://www.kaspersky.com/blog/openclaw-vulnerabilities-exposed/55263/)
- [Trend Micro: What OpenClaw Reveals About Agentic Assistants](https://www.trendmicro.com/en_us/research/26/b/what-openclaw-reveals-about-agentic-assistants.html)
- [Infosecurity Magazine: Researchers Reveal Six New OpenClaw Vulnerabilities](https://www.infosecurity-magazine.com/news/researchers-six-new-openclaw/)
- [Conscia: The OpenClaw Security Crisis](https://conscia.com/blog/the-openclaw-security-crisis/)

### ClawHub Supply Chain Attack
- [The Hacker News: 341 Malicious ClawHub Skills](https://thehackernews.com/2026/02/researchers-find-341-malicious-clawhub.html)
- [eSecurity Planet: Hundreds of Malicious Skills Found](https://www.esecurityplanet.com/threats/hundreds-of-malicious-skills-found-in-openclaws-clawhub/)
- [Snyk: ToxicSkills Study](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/)
- [Microsoft Security Blog: Running OpenClaw Safely](https://www.microsoft.com/en-us/security/blog/2026/02/19/running-openclaw-safely-identity-isolation-runtime-risk/)
- [Security Boulevard: Securing OpenClaw Against ClawHavoc](https://securityboulevard.com/2026/02/securing-openclaw-againstclawhavoc/)
- [Bitdefender: OpenClaw Exploitation in Enterprise Networks](https://businessinsights.bitdefender.com/technical-advisory-openclaw-exploitation-enterprise-networks)

### Credential and Secret Exposure
- [Bright Security: Is Your AI Assistant Leaking Secrets?](https://brightsec.com/blog/is-your-ai-assistant-leaking-secrets-a-look-at-data-exfiltration-in-code-generation/)
- [Knostic: How AI Assistants Leak Secrets in Your IDE](https://www.knostic.ai/blog/ai-coding-assistants-leaking-secrets)
- [Knostic: From .env to Leakage](https://www.knostic.ai/blog/claude-cursor-env-file-secret-leakage)
- [PointGuard AI: 12,000 API Keys Exposed](https://www.pointguardai.com/ai-security-incidents/12-000-api-keys-and-passwords-exposed-in-ai-training-data)

### Command Injection and Code Execution
- [The Hacker News: 30+ Flaws in AI Coding Tools (IDEsaster)](https://thehackernews.com/2025/12/researchers-uncover-30-flaws-in-ai.html)
- [MaccariTA: IDEsaster Original Research](https://maccarita.com/posts/idesaster/)
- [OWASP: MCP05:2025 Command Injection](https://owasp.org/www-project-mcp-top-10/2025/MCP05-2025%E2%80%93Command-Injection&Execution)
- [Fortune: AI Coding Tools Security Exploits](https://fortune.com/2025/12/15/ai-coding-tools-security-exploit-software/)
- [Security Boulevard: 2025 Hot Security Incidents](https://securityboulevard.com/2026/02/protecting-ai-security-2025-hot-security-incident/)
- [NIST: Strengthening AI Agent Hijacking Evaluations](https://www.nist.gov/news-events/news/2025/01/technical-blog-strengthening-ai-agent-hijacking-evaluations)

### Prompt Injection
- [OWASP: LLM01:2025 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- [Pillar Security: Rules File Backdoor](https://www.pillar.security/blog/new-vulnerability-in-github-copilot-and-cursor-how-hackers-can-weaponize-code-agents)
- [The Hacker News: Rules File Backdoor Attack](https://thehackernews.com/2025/03/new-rules-file-backdoor-attack-lets.html)
- [arxiv: Your AI, My Shell](https://arxiv.org/html/2509.22040v1)
- [arxiv: Prompt Injection on Agentic Coding Assistants](https://arxiv.org/html/2601.17548v1)
- [Cybernews: AI Agents Highly Vulnerable](https://cybernews.com/security/ai-agents-highly-vulnerable-to-prompt-injection-attacks/)

### Data Exfiltration
- [Embrace The Red: Claude Code DNS Exfiltration (CVE-2025-55284)](https://embracethered.com/blog/posts/2025/claude-code-exfiltration-via-dns-requests/)
- [Embrace The Red: Windsurf Data Exfiltration](https://embracethered.com/blog/posts/2025/windsurf-data-exfiltration-vulnerabilities/)
- [Embrace The Red: Claude Pirate File API Exfiltration](https://embracethered.com/blog/posts/2025/claude-abusing-network-access-and-anthropic-api-for-data-exfiltration/)
- [Cymulate: InversePrompt CVE-2025-54794 & CVE-2025-54795](https://cymulate.com/blog/cve-2025-547954-54795-claude-inverseprompt/)
- [Straiker: Clawdbot/Moltbot as a Backdoor](https://www.straiker.ai/blog/how-the-clawdbot-moltbot-ai-assistant-becomes-a-backdoor-for-system-takeover)

### Supply Chain Attacks
- [Oligo Security: NPM Supply Chain Hidden Risks for AI Agents](https://www.oligo.security/blog/the-hidden-risks-of-the-npm-supply-chain-attacks-ai-agents)
- [CISA: Widespread Supply Chain Compromise Impacting npm](https://www.cisa.gov/news-events/alerts/2025/09/23/widespread-supply-chain-compromise-impacting-npm-ecosystem)
- [InfoQ: npm AI-Enabled Credential Stealing Supply Chain Attacks](https://www.infoq.com/news/2025/10/npm-s1ngularity-shai-hulud/)
- [Dark Reading: Supply Chain Worms 2026](https://www.darkreading.com/cyberattacks-data-breaches/supply-chain-worms-in-2026-what-shai-hulud-taught-attackers-and-how-to-prepare)
- [Oreate AI: Agentic AI as New Frontier for Supply Chain Attacks](https://www.oreateai.com/blog/the-shadow-in-the-code-how-agentic-ai-is-becoming-a-new-frontier-for-supply-chain-attacks/59c1eeacc6f65d0b206b50df53390d8e)

### Security Best Practices and Frameworks
- [Meta AI: Agents Rule of Two](https://ai.meta.com/blog/practical-ai-agent-security/)
- [Wiz: AI Agent Security Best Practices](https://www.wiz.io/academy/ai-security/ai-agent-security)
- [Render: Security Best Practices When Building AI Agents](https://render.com/articles/security-best-practices-when-building-ai-agents)
- [OWASP: AI Agent Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html)
- [IBM: Agentic AI Security Guide](https://www.ibm.com/think/insights/agentic-ai-security)
- [Anthropic: Mitigating Prompt Injection in Browser Use](https://www.anthropic.com/research/prompt-injection-defenses)
- [Medium: Hardening Claude Code Security Framework](https://medium.com/@emergentcap/hardening-claude-code-a-security-review-framework-and-the-prompt-that-does-it-for-you-c546831f2cec)
- [GitHub: Agent Skills Secure Registry](https://github.com/tech-leads-club/agent-skills)
