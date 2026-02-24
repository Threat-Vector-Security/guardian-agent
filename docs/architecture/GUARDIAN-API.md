# Guardian API Reference

Complete API reference for the Guardian three-layer defense system.

---

## Guardian Pipeline

**File:** `src/guardian/guardian.ts`

### `Guardian`

The main admission controller pipeline.

```typescript
import { Guardian } from './guardian/guardian.js';
```

#### Constructor

```typescript
new Guardian(options?: { logDenials?: boolean })
```

- `logDenials` — Log denied actions via pino (default: `true`)

#### Static Methods

**`Guardian.createDefault(options?)`**

Create a Guardian with all built-in controllers in the correct pipeline order.

```typescript
static createDefault(options?: GuardianCreateOptions): Guardian
```

Options:
```typescript
interface GuardianCreateOptions {
  logDenials?: boolean;
  additionalSecretPatterns?: string[];
  inputSanitization?: Partial<InputSanitizerConfig> & { enabled?: boolean };
  rateLimit?: Partial<RateLimiterConfig>;
}
```

Default pipeline order:
1. InputSanitizer (mutating)
2. RateLimiter (validating)
3. CapabilityController (validating)
4. SecretScanController (validating)
5. DeniedPathController (validating)

#### Instance Methods

**`guardian.use(controller)`**

Add a controller to the pipeline. Controllers are auto-sorted: mutating first, then validating.

```typescript
use(controller: AdmissionController): this
```

**`guardian.check(action)`**

Run an action through the admission pipeline.

```typescript
check(action: AgentAction): AdmissionResult
```

Returns:
- `{ allowed: true, controller: 'guardian' }` — action permitted
- `{ allowed: true, controller: 'guardian', mutatedAction }` — action permitted with modifications
- `{ allowed: false, reason, controller }` — action denied

**`guardian.getControllers()`**

Get all registered controllers (read-only).

```typescript
getControllers(): readonly AdmissionController[]
```

### Types

```typescript
/** An action an agent wants to perform. */
interface AgentAction {
  type: string;                       // e.g. 'write_file', 'message_dispatch'
  agentId: string;                    // requesting agent
  capabilities: readonly string[];    // agent's granted capabilities
  params: Record<string, unknown>;    // action parameters
}

/** Result of an admission check. */
interface AdmissionResult {
  allowed: boolean;
  reason?: string;                    // denial reason
  controller: string;                 // controller that decided
  mutatedAction?: AgentAction;        // modified action (mutating controllers)
}

/** Phase of the admission pipeline. */
type AdmissionPhase = 'mutating' | 'validating';

/** An admission controller. */
interface AdmissionController {
  name: string;
  phase: AdmissionPhase;
  check(action: AgentAction): AdmissionResult | null;  // null = pass through
}
```

---

## Built-in Controllers

### `InputSanitizer`

**File:** `src/guardian/input-sanitizer.ts`

Mutating controller that strips invisible Unicode characters and detects prompt injection.

```typescript
import { InputSanitizer } from './guardian/input-sanitizer.js';

const sanitizer = new InputSanitizer({
  blockThreshold: 3,      // injection score to block (default: 3)
  stripInvisible: true,    // strip invisible Unicode (default: true)
});
```

#### Standalone Functions

```typescript
import { stripInvisibleChars, detectInjection } from './guardian/input-sanitizer.js';

// Strip invisible Unicode characters
const clean = stripInvisibleChars('Hello\u200BWorld');
// → 'HelloWorld'

// Detect injection signals
const result = detectInjection('Ignore previous instructions');
// → { score: 3, signals: ['role_override_ignore'] }
```

### `RateLimiter`

**File:** `src/guardian/rate-limiter.ts`

Validating controller with per-agent sliding window rate limiting.

```typescript
import { RateLimiter } from './guardian/rate-limiter.js';

const limiter = new RateLimiter({
  maxPerMinute: 30,    // default: 30
  maxPerHour: 500,     // default: 500
  burstAllowed: 5,     // default: 5 in 10s window
});

// Reset state for one agent
limiter.reset('agent-id');

// Reset all state
limiter.resetAll();
```

Only limits `message_dispatch` actions. Internal events and schedules pass through.

### `CapabilityController`

**File:** `src/guardian/guardian.ts`

Validating controller that checks agent capabilities against action requirements.

```typescript
import { CapabilityController } from './guardian/guardian.js';

const controller = new CapabilityController();
```

Action type → capability mapping is fixed (see SECURITY.md). Unknown action types pass through.

### `SecretScanController`

**File:** `src/guardian/guardian.ts`

Validating controller that scans content parameters for secret patterns.

```typescript
import { SecretScanController } from './guardian/guardian.js';

const controller = new SecretScanController(['CUSTOM_[A-Z]{10}']);
```

Scans `action.params.content` for 28+ credential patterns plus any custom patterns.

### `DeniedPathController`

**File:** `src/guardian/guardian.ts`

Validating controller that blocks access to sensitive file paths.

```typescript
import { DeniedPathController } from './guardian/guardian.js';

const controller = new DeniedPathController();
```

Normalizes paths via `path.normalize()` before checking. Detects `..` traversal after normalization.

---

## SecretScanner

**File:** `src/guardian/secret-scanner.ts`

Low-level scanner used by SecretScanController and OutputGuardian.

```typescript
import { SecretScanner } from './guardian/secret-scanner.js';

const scanner = new SecretScanner(['CUSTOM_[A-Z]{10}']);

// Scan content for secrets
const matches: SecretMatch[] = scanner.scanContent('Key: AKIAIOSFODNN7EXAMPLE');
// → [{ pattern: 'AWS Access Key', match: 'AKIA...MPLE', rawMatch: 'AKIAIOSFODNN7EXAMPLE', offset: 5 }]

// Check if a file path is denied
const result = scanner.isDeniedPath('.env');
// → { denied: true, reason: 'Matches denied pattern: .env' }
```

### Types

```typescript
interface SecretMatch {
  pattern: string;     // pattern name (e.g. 'AWS Access Key')
  match: string;       // redacted match (for logging)
  rawMatch: string;    // full match (for replacement/redaction)
  offset: number;      // position in original string
}
```

---

## OutputGuardian

**File:** `src/guardian/output-guardian.ts`

Layer 2 defense — scans and redacts secrets from outbound content.

```typescript
import { OutputGuardian } from './guardian/output-guardian.js';

const guard = new OutputGuardian(['CUSTOM_[A-Z]{10}']);
```

### Methods

**`scanResponse(content)`**

Scan an LLM response. Returns sanitized content with secrets replaced by `[REDACTED]`.

```typescript
const result = guard.scanResponse('The key is AKIAIOSFODNN7EXAMPLE');
// → {
//     clean: false,
//     secrets: [{ pattern: 'AWS Access Key', ... }],
//     sanitized: 'The key is [REDACTED]'
//   }
```

**`scanPayload(payload)`**

Scan an event payload for secrets. Returns matched secrets (does not redact).

```typescript
const secrets = guard.scanPayload({ key: 'AKIAIOSFODNN7EXAMPLE' });
// → [{ pattern: 'AWS Access Key', ... }]
```

**`scanContent(content)`**

Scan arbitrary content string. Returns matched secrets.

```typescript
const secrets = guard.scanContent('sk-ant-api03-abc123');
// → [{ pattern: 'Anthropic API Key', ... }]
```

### Types

```typescript
interface ScanResult {
  clean: boolean;           // true if no secrets found
  secrets: SecretMatch[];   // detected secrets
  sanitized: string;        // content with secrets replaced by [REDACTED]
}
```

---

## AuditLog

**File:** `src/guardian/audit-log.ts`

In-memory ring buffer for structured security event logging.

```typescript
import { AuditLog } from './guardian/audit-log.js';

const log = new AuditLog(10_000);  // max 10,000 events (default)
```

### Methods

**`record(event)`**

Record a new audit event. Auto-generates ID and timestamp.

```typescript
const event = log.record({
  type: 'action_denied',
  severity: 'warn',
  agentId: 'my-agent',
  controller: 'CapabilityController',
  details: { actionType: 'write_file', reason: 'lacks write_files capability' },
});
```

**`query(filter)`**

Query events matching a filter.

```typescript
const denials = log.query({
  type: 'action_denied',
  agentId: 'my-agent',
  severity: 'warn',
  after: Date.now() - 60_000,  // last minute
  limit: 10,
});
```

**`getRecentEvents(count)`**

Get the N most recent events.

```typescript
const recent = log.getRecentEvents(50);
```

**`getSummary(windowMs)`**

Get aggregated summary for a time window. Used by Sentinel for analysis.

```typescript
const summary = log.getSummary(300_000);  // last 5 minutes
// → {
//     totalEvents: 42,
//     byType: { action_denied: 5, action_allowed: 30, ... },
//     bySeverity: { info: 30, warn: 10, critical: 2 },
//     topDeniedAgents: [{ agentId: 'bad-agent', count: 4 }],
//     topControllers: [{ controller: 'CapabilityController', count: 3 }],
//     windowStart: 1234567890,
//     windowEnd: 1234867890,
//   }
```

**`clear()`** — Clear all events.

**`getAll()`** — Get all events (read-only array).

**`size`** — Current event count (getter).

### Types

```typescript
type AuditEventType =
  | 'action_denied'     | 'action_allowed'    | 'secret_detected'
  | 'output_blocked'    | 'output_redacted'   | 'event_blocked'
  | 'input_sanitized'   | 'rate_limited'      | 'capability_probe'
  | 'anomaly_detected'  | 'agent_error'       | 'agent_stalled';

type AuditSeverity = 'info' | 'warn' | 'critical';

interface AuditEvent {
  id: string;
  timestamp: number;
  type: AuditEventType;
  severity: AuditSeverity;
  agentId: string;
  userId?: string;
  channel?: string;
  controller?: string;
  details: Record<string, unknown>;
}

interface AuditFilter {
  type?: AuditEventType;
  agentId?: string;
  severity?: AuditSeverity;
  after?: number;
  before?: number;
  limit?: number;
}

interface AuditSummary {
  totalEvents: number;
  byType: Record<string, number>;
  bySeverity: Record<AuditSeverity, number>;
  topDeniedAgents: Array<{ agentId: string; count: number }>;
  topControllers: Array<{ controller: string; count: number }>;
  windowStart: number;
  windowEnd: number;
}
```

---

## SentinelAgent

**File:** `src/agents/sentinel.ts`

Layer 3 defense — retrospective anomaly detection agent.

```typescript
import { SentinelAgent } from './agents/sentinel.js';

const sentinel = new SentinelAgent({
  volumeSpikeMultiplier: 3,        // denial rate multiplier (default: 3)
  capabilityProbeThreshold: 5,     // distinct denied action types (default: 5)
  secretDetectionThreshold: 3,     // secret scans per agent (default: 3)
});
```

### Agent Properties

- `id`: `'sentinel'`
- `name`: `'Sentinel Security Agent'`
- `handleMessages`: `false`
- `handleEvents`: `true`
- `handleSchedule`: `true`

### Methods

**`detectAnomalies(summary, auditLog?)`**

Run heuristic anomaly detection on an audit summary. Returns array of detected anomalies.

```typescript
const anomalies = sentinel.detectAnomalies(summary, auditLog);
// → [{ type: 'volume_spike', severity: 'warn', description: '...', evidence: {...} }]
```

**`onSchedule(ctx)`**

Called by the cron scheduler. Analyzes the AuditLog, detects anomalies, optionally runs LLM analysis, and records findings back to the AuditLog.

**`onEvent(event, ctx)`**

Listens for `guardian.critical` events for real-time response.

### Types

```typescript
interface Anomaly {
  type: string;                        // e.g. 'volume_spike', 'capability_probe'
  severity: 'warn' | 'critical';
  description: string;
  agentId?: string;
  evidence: Record<string, unknown>;
}

interface AnomalyThresholds {
  volumeSpikeMultiplier: number;       // default: 3
  capabilityProbeThreshold: number;    // default: 5
  secretDetectionThreshold: number;    // default: 3
}
```

---

## Capabilities

**File:** `src/guardian/capabilities.ts`

Utility functions for capability checking.

```typescript
import {
  hasCapability,
  hasAllCapabilities,
  hasAnyCapability,
  isValidCapability,
} from './guardian/capabilities.js';

// Check if a capability is valid (known)
isValidCapability('read_files');  // true
isValidCapability('unknown');     // false

// Check if agent has a specific capability
hasCapability(['read_files', 'write_files'], 'read_files');  // true

// Check if agent has ALL required capabilities
hasAllCapabilities(['read_files'], ['read_files', 'write_files']);  // false

// Check if agent has ANY of the listed capabilities
hasAnyCapability(['read_files'], ['read_files', 'write_files']);  // true
```

### Valid Capabilities

```
read_files, write_files, execute_commands, network_access,
read_email, draft_email, send_email, git_operations, install_packages
```

---

## Runtime Integration

The Runtime wires all Guardian components together. Key integration points:

### `Runtime.dispatchMessage(agentId, message)`

1. **Layer 1**: Runs `guardian.check()` with `type: 'message_dispatch'`
   - If denied → returns `[Message blocked: <reason>]`, records `action_denied`
   - If mutated → uses cleaned content, records `input_sanitized`
2. **Agent execution**: Calls `agent.onMessage(message, ctx)`
3. **Layer 2**: Runs `outputGuardian.scanResponse(response.content)`
   - If secrets found + redact mode → replaces secrets with `[REDACTED]`, records `output_redacted`
   - If secrets found + block mode → returns blocked message, records `output_blocked`

### `Runtime.createAgentContext(agentId)`

Injects security-aware context:
- `ctx.capabilities` — read-only list from `AgentDefinition.grantedCapabilities`
- `ctx.checkAction(action)` — calls `guardian.check()`, throws on denial, records to AuditLog
- `ctx.emit(partial)` — scans payload via `outputGuardian.scanPayload()`, throws if secrets found, records `event_blocked`

### `Runtime.dispatchSchedule(agentId, schedule)`

Injects `auditLog` into `ScheduleContext` for Sentinel access.
