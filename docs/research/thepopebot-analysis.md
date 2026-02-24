# thepopebot - Comprehensive Architecture Analysis

**Repository**: [stephengpope/thepopebot](https://github.com/stephengpope/thepopebot)
**Version**: 1.2.71-beta.5
**Language**: JavaScript (Node.js 18+, ESM)
**Framework**: Next.js + LangChain/LangGraph
**License**: MIT
**Stats**: 602 stars, 358 forks, 499 commits (as of Feb 2026)

---

## 1. High-Level Architecture

thepopebot is a **two-layer autonomous AI agent framework** that uses GitHub as its execution backbone. Its central thesis: **"The repository IS the agent"** -- every action becomes a git commit, making the agent's work fully auditable and reversible.

### Layer 1: Event Handler (Next.js)
- Receives inputs from web chat, Telegram, webhooks, and cron schedules
- Runs a LangGraph ReAct agent for conversational interaction
- Creates `job/*` branches on GitHub to dispatch autonomous work
- Manages state via SQLite (Drizzle ORM) and LangGraph checkpointing

### Layer 2: Docker Agent (Pi Coding Agent)
- Triggered by GitHub Actions when a `job/*` branch is created
- Runs in a containerized environment with full filesystem, bash, and browser access
- Reads a `job.md` prompt, executes autonomously, commits results, opens a PR
- Auto-merge workflow squash-merges approved PRs with path restrictions

```
User Input --> Event Handler --> GitHub (job/* branch) --> GitHub Actions --> Docker Agent
                                                                               |
                                                                          Commits + PR
                                                                               |
                                                          Auto-merge <-- Path validation
```

---

## 2. Ollama / Local LLM Integration

### How It Works

The Ollama integration lives in **`lib/ai/model.js`** and is implemented through the OpenAI-compatible API pattern. This is the key code:

```javascript
// lib/ai/model.js
export async function createModel(options = {}) {
  const provider = process.env.LLM_PROVIDER || 'anthropic';
  const modelName = process.env.LLM_MODEL || DEFAULT_MODELS[provider] || DEFAULT_MODELS.anthropic;
  const maxTokens = options.maxTokens || Number(process.env.LLM_MAX_TOKENS) || 4096;

  switch (provider) {
    case 'custom':
    case 'openai': {
      const { ChatOpenAI } = await import('@langchain/openai');
      const apiKey = provider === 'custom'
        ? (process.env.CUSTOM_API_KEY || 'not-needed')
        : process.env.OPENAI_API_KEY;
      const baseURL = process.env.OPENAI_BASE_URL;
      if (!apiKey && !baseURL) {
        throw new Error('OPENAI_API_KEY environment variable is required (or set OPENAI_BASE_URL for local models)');
      }
      const config = { modelName, maxTokens };
      config.apiKey = apiKey || 'not-needed';
      if (baseURL) {
        config.configuration = { baseURL };
      }
      return new ChatOpenAI(config);
    }
    // ... anthropic and google cases
  }
}
```

### Key Design Decisions for Ollama

1. **Uses `LLM_PROVIDER=custom` or `LLM_PROVIDER=openai` with `OPENAI_BASE_URL`**: Ollama exposes an OpenAI-compatible API at `http://localhost:11434/v1`, so it plugs in via the `ChatOpenAI` LangChain wrapper.

2. **API key set to `'not-needed'`**: When using custom providers, the API key defaults to the string `'not-needed'` since Ollama doesn't require authentication. This avoids validation errors in the OpenAI client.

3. **Dynamic imports**: `ChatOpenAI` and `ChatGoogleGenerativeAI` are loaded via `await import()` rather than static imports, so the Anthropic SDK is the only required dependency. This keeps the install footprint small when users only need Anthropic.

4. **No Ollama-specific handling**: There is no streaming optimization, context window management, or model-specific tuning for Ollama. The same `maxTokens` (default 4096) and configuration applies regardless of whether the backend is GPT-4o or a local Llama model.

### Environment Variables for Ollama Setup

```bash
LLM_PROVIDER=custom
LLM_MODEL=llama3.2
OPENAI_BASE_URL=http://localhost:11434/v1
CUSTOM_API_KEY=not-needed
```

### What's Missing from the Ollama Integration

- **No context window awareness**: Different models have different context limits (4K, 8K, 128K). The system doesn't query Ollama's `/api/show` endpoint to discover model capabilities.
- **No streaming optimization**: Local models often have different latency profiles. No adaptive batching or timeout adjustment.
- **No model listing/selection**: No UI or API to discover which models are available on the Ollama instance.
- **No health checking**: No verification that Ollama is running before attempting to use it.
- **No GPU/performance monitoring**: No awareness of whether the model is running on CPU vs GPU.

---

## 3. Agent Architecture (LangGraph ReAct Agent)

### Agent Setup (`lib/ai/agent.js`)

The core agent is a **LangGraph ReAct agent** -- a simple but effective pattern:

```javascript
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';

export async function getAgent() {
  if (!_agent) {
    const model = await createModel();
    const tools = [createJobTool, getJobStatusTool, getSystemTechnicalSpecsTool, getPiSkillCreationGuideTool];
    const checkpointer = SqliteSaver.fromConnString(thepopebotDb);

    _agent = createReactAgent({
      llm: model,
      tools,
      checkpointSaver: checkpointer,
      prompt: (state) => [new SystemMessage(render_md(eventHandlerMd)), ...state.messages],
    });
  }
  return _agent;
}
```

**Key details:**
- **Singleton pattern**: The agent is created once and reused (`_agent` module-level variable)
- **`resetAgent()`**: Allows re-creation when config changes
- **System prompt as function**: The prompt callback receives state and prepends a rendered markdown system prompt. The `{{datetime}}` variable resolves fresh each invocation.
- **SQLite checkpointing**: Full conversation state is persisted to SQLite, enabling resumable conversations across server restarts.
- **4 tools only**: The event handler agent is deliberately constrained -- it can create jobs, check job status, read system docs, and read skill guides. It cannot modify the filesystem directly.

### Tool Definitions (`lib/ai/tools.js`)

Tools use LangChain's `tool()` wrapper with Zod schemas:

```javascript
const createJobTool = tool(
  async ({ job_description }) => {
    const result = await createJob(job_description);
    return JSON.stringify({ success: true, job_id: result.job_id, branch: result.branch });
  },
  {
    name: 'create_job',
    description: 'Create an autonomous job that runs a Docker agent in a container...',
    schema: z.object({
      job_description: z.string().describe('Detailed job description including context and requirements...'),
    }),
  }
);
```

**Tool design pattern:**
- Tools return JSON strings (not objects) -- this is a LangChain convention
- Descriptions are carefully crafted to guide the LLM on WHEN to use each tool
- Two "documentation reader" tools (`get_system_technical_specs`, `get_pi_skill_creation_guide`) load markdown files as context on demand, rather than stuffing everything into the system prompt

### Borrowable Pattern: Lazy Documentation Loading

Instead of bloating the system prompt with all possible documentation, thepopebot provides tools that load docs on demand:

```javascript
const getSystemTechnicalSpecsTool = tool(
  async () => {
    try { return fs.readFileSync(claudeMd, 'utf8'); }
    catch { return 'No technical documentation found.'; }
  },
  {
    name: 'get_system_technical_specs',
    description: 'Read the system architecture and technical documentation (CLAUDE.md). Use this when you need to understand how the system itself works...',
    schema: z.object({}),
  }
);
```

This keeps the base context window small while allowing the agent to pull in detailed documentation when needed. The descriptions serve as a "table of contents" the LLM uses to decide when to read the full docs.

---

## 4. Conversation & Context Management

### Message Flow (`lib/ai/index.js`)

The `chat()` function is the primary entry point:

```javascript
async function chat(threadId, message, attachments = [], options = {}) {
  const agent = await getAgent();
  persistMessage(threadId, 'user', message || '[attachment]', options);

  // Build content blocks: text + image attachments as base64 vision
  const content = [];
  if (message) content.push({ type: 'text', text: message });
  for (const att of attachments) {
    if (att.category === 'image') {
      content.push({ type: 'image_url', image_url: { url: `data:${att.mimeType};base64,${att.data.toString('base64')}` } });
    }
  }

  const result = await agent.invoke(
    { messages: [new HumanMessage({ content: messageContent })] },
    { configurable: { thread_id: threadId } }
  );
  // ... extract response, persist, auto-title
}
```

**Key patterns:**
1. **Thread-based context**: Each conversation has a `threadId`. LangGraph's `SqliteSaver` checkpointer automatically manages the full conversation history per thread.
2. **Best-effort persistence**: DB writes are wrapped in try/catch -- if the DB fails, chat continues. This prevents infrastructure issues from breaking the core experience.
3. **Multimodal support**: Images are sent as base64 data URLs. Documents are noted for "future handling."
4. **Auto-titling**: First message triggers an async LLM call to generate a 3-6 word title for the conversation.

### Streaming (`chatStream()`)

The streaming implementation is a well-structured async generator:

```javascript
async function* chatStream(threadId, message, attachments = [], options = {}) {
  const stream = await agent.stream(
    { messages: [new HumanMessage({ content: messageContent })] },
    { configurable: { thread_id: threadId }, streamMode: 'messages' }
  );

  for await (const event of stream) {
    const msg = Array.isArray(event) ? event[0] : event;
    const msgType = msg._getType?.();

    if (msgType === 'ai') {
      // Emit tool calls and text chunks
      if (msg.tool_calls?.length > 0) {
        for (const tc of msg.tool_calls) {
          yield { type: 'tool-call', toolCallId: tc.id, toolName: tc.name, args: tc.args };
        }
      }
      // ... text extraction and yielding
    } else if (msgType === 'tool') {
      yield { type: 'tool-result', toolCallId: msg.tool_call_id, result: msg.content };
    }
  }
}
```

**Borrowable pattern:** The stream yields structured event objects (`{ type: 'text' | 'tool-call' | 'tool-result', ... }`) rather than raw text, giving the UI full visibility into the agent's reasoning process (tool invocations, intermediate results).

### Context Injection (`addToThread()`)

```javascript
async function addToThread(threadId, text) {
  const agent = await getAgent();
  await agent.updateState(
    { configurable: { thread_id: threadId } },
    { messages: [new AIMessage(text)] }
  );
}
```

This injects messages into a thread's memory without user interaction -- used after job completions to give the agent context about what happened. A clever way to build long-running awareness.

---

## 5. Channel Adapter Pattern

### Base Class (`lib/channels/base.js`)

A clean adapter interface for normalizing inputs across platforms:

```javascript
class ChannelAdapter {
  async receive(request) { throw new Error('Not implemented'); }
  async acknowledge(metadata) {}
  startProcessingIndicator(metadata) { return () => {}; }
  async sendResponse(threadId, text, metadata) { throw new Error('Not implemented'); }
  get supportsStreaming() { return false; }
}
```

**Contract:**
- `receive()` returns a normalized `{ threadId, text, attachments[], metadata }` or `null`
- Attachments are categorized: `image` (sent to LLM as vision), `document` (future)
- Voice/audio are transcribed by the adapter (via OpenAI Whisper) and arrive as text
- `acknowledge()` shows receipt (Telegram: thumbs-up reaction)
- `startProcessingIndicator()` returns a stop function (Telegram: typing indicator with random 5.5-8s intervals)

### Telegram Implementation (`lib/channels/telegram.js`)

The Telegram adapter handles:
- Webhook secret validation (fail-closed if not configured)
- Chat ID restriction (only responds to configured chat)
- Verification code flow for initial setup
- Voice transcription via OpenAI Whisper
- Photo download (largest resolution) as image attachments
- Document download as document attachments

**Borrowable pattern:** The adapter fully resolves all media before passing to the AI layer. Voice messages become text, images become buffers -- the AI layer never needs to know about Telegram-specific file APIs.

---

## 6. Security Architecture

### What's Done Well

1. **API key hashing**: Keys are SHA-256 hashed in the database, verified with timing-safe comparison
2. **Webhook secret validation**: Telegram and GitHub webhooks validate shared secrets
3. **Session encryption**: JWT with `AUTH_SECRET`, httpOnly cookies
4. **Secret filtering in Docker**: `env-sanitizer` prevents the LLM subprocess from accessing `AGENT_*` secrets
5. **Auto-merge path restrictions**: Only PRs changing files in `ALLOWED_PATHS` (default: `/logs`) are auto-merged
6. **Two-tier secret system**: `AGENT_*` secrets are filtered from LLM; `AGENT_LLM_*` secrets are accessible

### Known Vulnerabilities (from SECURITY_TODOS.md)

**CRITICAL:**
1. **Command injection via templates**: `{{body}}` tokens from HTTP payloads pass directly to `child_process.exec()` without sanitization
2. **Shell evaluation of secrets**: Docker entrypoint uses `eval` with `jq` output, allowing shell metacharacter injection
3. **Optional webhook authentication**: Missing secrets = no auth (should be fail-closed)
4. **Path traversal in markdown includes**: `{{ ../../../etc/passwd }}` could read arbitrary files

**HIGH:**
- Containers run as root with Docker socket access
- Secrets visible in command-line arguments (`/proc`)
- No rate limiting on any endpoint

---

## 7. Configuration System

### Markdown-Based Prompts with Include System (`lib/utils/render-md.js`)

Configuration files live in `config/` as markdown with template processing:

- `config/SOUL.md` -- Agent personality and values
- `config/EVENT_HANDLER.md` -- Event handler system prompt
- `config/JOB_SUMMARY.md` -- Job summary prompt
- `config/AGENT.md` -- Docker agent runtime prompt
- `config/CRONS.json` -- Scheduled jobs
- `config/TRIGGERS.json` -- Webhook triggers

**Include syntax**: `{{ filepath.md }}` resolves relative to project root, supports recursion with circular detection.

**Built-in variables**:
- `{{datetime}}` -- Current ISO timestamp
- `{{skills}}` -- Bullet list of active skill descriptions from `.pi/skills/*/SKILL.md` frontmatter

**Borrowable pattern:** The markdown include system is simple but effective. It allows composable prompt construction from reusable fragments, preventing prompt duplication across different contexts.

### Action System (`lib/actions.js`)

A unified dispatch system shared by cron jobs and webhook triggers:

```javascript
async function executeAction(action, opts = {}) {
  const type = action.type || 'agent';

  if (type === 'command') {
    const { stdout, stderr } = await execAsync(action.command, { cwd: opts.cwd });
    return (stdout || stderr || '').trim();
  }
  if (type === 'webhook') {
    // HTTP request to external URL
  }
  // Default: agent -- creates a Docker job
  const result = await createJob(action.job, options);
  return `job ${result.job_id}`;
}
```

Three action types:
| Type | Uses LLM | Runtime | Cost |
|------|----------|---------|------|
| `agent` | Yes (Docker container) | Minutes to hours | LLM API + GH Actions |
| `command` | No (shell command) | Milliseconds to seconds | Free |
| `webhook` | No (HTTP request) | Milliseconds to seconds | Free |

**Borrowable pattern:** The clear separation of "thinking" (agent) vs "doing" (command/webhook) actions is pragmatic. Not every automated task needs an LLM.

### Trigger System (`lib/triggers.js`)

Webhook triggers watch specific API paths and fire action chains:

```json
[{
  "name": "Deploy on push",
  "watch_path": "/github/webhook",
  "actions": [{
    "type": "agent",
    "job": "Review the changes in {{body.pull_request.title}} and deploy"
  }]
}]
```

Template tokens (`{{body.field}}`, `{{query.field}}`, `{{headers.field}}`) are resolved from the incoming request.

---

## 8. Job Execution Pipeline

### How a Job Runs

1. **Event Handler creates a branch**: `createJob()` in `lib/tools/create-job.js` creates a `job/{uuid}` branch on GitHub with a `logs/{uuid}/job.md` file containing the task description.

2. **GitHub Actions triggers**: `run-job.yml` fires on `job/*` branch creation. It pulls the Docker image and runs the container.

3. **Docker entrypoint**:
   - Exports secrets as env vars
   - Clones the repo branch
   - Installs skill dependencies
   - Optionally starts headless Chrome
   - Builds system prompt from SOUL.md + AGENT.md
   - Runs Pi coding agent with job.md as the task
   - Commits all changes and creates a PR

4. **Auto-merge**: If `AUTO_MERGE` is enabled and all changed files are within `ALLOWED_PATHS`, the PR is squash-merged.

5. **Notification**: `notify-pr-complete.yml` sends results back to the event handler, which summarizes the job via LLM and creates a notification.

### Per-Job LLM Override

Jobs can specify different LLM providers/models via `job.config.json`:

```javascript
if (options.llmProvider) config.llm_provider = options.llmProvider;
if (options.llmModel) config.llm_model = options.llmModel;
```

This allows cron jobs or triggers to use different models for different tasks.

---

## 9. Database Design

SQLite via Drizzle ORM with WAL mode. Six tables:

| Table | Purpose |
|-------|---------|
| `users` | Admin accounts (email, bcrypt hash, role) |
| `chats` | Chat sessions (user_id, title, starred, timestamps) |
| `messages` | Chat messages (chat_id, role, content, timestamp) |
| `notifications` | Job completion notifications (payload, read status) |
| `subscriptions` | Channel subscriptions (platform, channel_id) |
| `settings` | Key-value config store (also stores API keys) |

**Migration discipline**: Schema changes must go through `lib/db/schema.js` -> `npm run db:generate` -> Drizzle migration files. Migrations auto-apply on server startup.

---

## 10. What's Novel / Well-Designed

### 1. Git as the Agent's Execution Log
Every job creates a branch, every action is a commit, results arrive as a PR. This gives you free auditability, rollback, and review -- leveraging existing GitHub infrastructure rather than building custom logging.

### 2. Two-Tier Agent Architecture
The event handler agent is deliberately **weak** (4 tools, no filesystem access). It acts as a dispatcher/conversationalist. The Docker agent is **powerful** (full filesystem, bash, browser). This separation of concerns prevents the chatbot from accidentally destroying things while keeping the autonomous worker capable.

### 3. Lazy Documentation Loading via Tools
Rather than stuffing the system prompt with all documentation, the agent has tools to read docs on demand. This keeps the context window small during simple conversations and allows the agent to self-educate when facing complex tasks.

### 4. Channel Adapter Normalization
The adapter pattern means the AI layer is completely platform-agnostic. Adding a new channel (Slack, Discord, email) requires only implementing the adapter interface. Voice is transcribed by the adapter, images are downloaded by the adapter -- the AI layer sees a uniform message format.

### 5. Markdown Include System for Prompt Composition
Prompts are composed from markdown fragments with `{{ file.md }}` includes and variable substitution. This makes prompts modular, testable, and user-customizable without touching code.

### 6. Free Compute via GitHub Actions
Using GitHub Actions as the execution layer for autonomous jobs is clever -- you get free compute, containerization, secrets management, and audit logs without running your own infrastructure.

### 7. Structured Streaming Events
The `chatStream()` async generator yields typed events (`text`, `tool-call`, `tool-result`) rather than raw text, giving the UI full visibility into agent reasoning.

---

## 11. What Could Be Improved

### Architecture Gaps

1. **No multi-agent orchestration**: The system has exactly two agents (event handler + Docker) with no ability to spawn sub-agents, delegate between agents, or create agent hierarchies.

2. **No memory beyond thread context**: There's no long-term memory, knowledge base, or RAG system. The agent forgets everything between threads (except what's in the SQLite checkpointer for that specific thread).

3. **No retry/error recovery for jobs**: If a Docker job fails, there's a notification but no automatic retry, error analysis, or self-healing.

4. **Single-user design**: One admin account, one Telegram chat ID. No multi-tenant support, no user permissions beyond "admin."

5. **No observability/tracing**: No integration with LangSmith, OpenTelemetry, or any tracing system. Debugging requires reading raw logs.

### Ollama/Local LLM Gaps

6. **No model capability awareness**: The system doesn't adapt behavior based on model capabilities (context window, vision support, tool use support). A local 7B model gets the same prompts and expectations as Claude Sonnet.

7. **No fallback/routing**: No ability to route simple tasks to cheaper/faster models and complex tasks to more capable ones.

8. **No health checking**: No verification that the LLM provider is reachable before processing messages.

### Security Gaps

9. **Command injection in triggers**: The template system passes unsanitized HTTP body content to `exec()`.

10. **No rate limiting**: Any endpoint can be spammed without restriction.

11. **Root containers**: Docker jobs run as root with full filesystem access.

### Code Quality

12. **No tests**: `"test": "echo \"No tests yet\" && exit 0"` in package.json.

13. **Synchronous file reads**: `render_md.js` and some tools use synchronous `fs.readFileSync()` which can block the event loop.

14. **No TypeScript**: The codebase is pure JavaScript with JSDoc comments. No compile-time type safety.

---

## 12. Patterns Worth Borrowing for OpenAgent

### Pattern 1: Provider Abstraction with Dynamic Imports

```javascript
// Only load the SDK you actually need
case 'openai': {
  const { ChatOpenAI } = await import('@langchain/openai');
  // ...
}
```

Avoids requiring all provider SDKs as dependencies. Users only install what they use.

### Pattern 2: Thread-Based Checkpointing

```javascript
const checkpointer = SqliteSaver.fromConnString(thepopebotDb);
_agent = createReactAgent({ llm: model, tools, checkpointSaver: checkpointer });
// Conversations persist across restarts
agent.invoke(input, { configurable: { thread_id: threadId } });
```

Full conversation state persisted to SQLite with zero application code.

### Pattern 3: Structured Stream Events

```javascript
yield { type: 'tool-call', toolCallId: tc.id, toolName: tc.name, args: tc.args };
yield { type: 'text', text };
yield { type: 'tool-result', toolCallId: msg.tool_call_id, result: msg.content };
```

Gives consumers full control over how to render agent activity.

### Pattern 4: Action Type Taxonomy

```javascript
// Not everything needs an LLM
if (type === 'command') return execAsync(action.command);
if (type === 'webhook') return fetch(action.url);
// Default: spin up a full agent
return createJob(action.job);
```

Clear separation between tasks that need thinking vs. tasks that just need doing.

### Pattern 5: Best-Effort Persistence

```javascript
function persistMessage(threadId, role, text, options = {}) {
  try {
    saveMessage(threadId, role, text);
  } catch (err) {
    console.error('Failed to persist message:', err);
    // Don't break chat if DB fails
  }
}
```

Infrastructure failures shouldn't break the core experience.

### Pattern 6: System Prompt as Function

```javascript
prompt: (state) => [new SystemMessage(render_md(eventHandlerMd)), ...state.messages],
```

The system prompt is re-evaluated each invocation, allowing dynamic variables (`{{datetime}}`, `{{skills}}`) to resolve fresh.

---

## 13. Key File Reference

| File | Purpose |
|------|---------|
| `lib/ai/model.js` | LLM provider factory (Anthropic, OpenAI, Google, Ollama/custom) |
| `lib/ai/agent.js` | LangGraph ReAct agent singleton with SQLite checkpointing |
| `lib/ai/tools.js` | 4 tool definitions (create_job, get_job_status, get_system_specs, get_skill_guide) |
| `lib/ai/index.js` | Chat, streaming, job summarization, thread injection |
| `lib/channels/base.js` | Channel adapter interface |
| `lib/channels/telegram.js` | Telegram adapter (webhooks, media, voice transcription) |
| `lib/actions.js` | Unified action dispatcher (agent/command/webhook) |
| `lib/triggers.js` | Webhook trigger system with template resolution |
| `lib/cron.js` | Cron scheduler with version checking |
| `lib/paths.js` | Central path resolver |
| `lib/utils/render-md.js` | Markdown include/variable processor |
| `lib/tools/create-job.js` | Job creation (GitHub branch + job.md) |
| `lib/tools/github.js` | GitHub API wrapper (workflows, jobs, logs) |
| `lib/db/schema.js` | Drizzle ORM schema (6 tables) |
| `config/instrumentation.js` | Server startup hook (.env, DB init, cron start) |
| `api/index.js` | API route handler (all /api/* endpoints) |
| `lib/chat/api.js` | Chat streaming route (AI SDK v5) |
| `lib/chat/actions.js` | Server actions (chat CRUD, notifications, swarm) |
| `templates/docker/job/entrypoint.sh` | Docker agent entrypoint (clone, execute, PR) |
| `templates/.github/workflows/run-job.yml` | Job execution workflow |

---

## 14. Technology Stack Summary

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 18+ |
| Framework | Next.js 15+ |
| LLM Orchestration | LangChain/LangGraph (ReAct agent) |
| LLM Providers | Anthropic (default), OpenAI, Google, Ollama (via OpenAI compat) |
| Database | SQLite via better-sqlite3 + Drizzle ORM |
| Agent Checkpointing | @langchain/langgraph-checkpoint-sqlite |
| Chat UI | AI SDK v5 (@ai-sdk/react) |
| Telegram | grammY framework |
| Auth | NextAuth v5 (Credentials provider, JWT sessions) |
| Container | Docker (Node.js 22, Puppeteer, Pi coding agent) |
| CI/CD | GitHub Actions (7 workflows) |
| Voice | OpenAI Whisper API |
| Validation | Zod v4 |
