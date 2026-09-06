import Ajv from 'ajv';
import { WorkspaceError, type Principal } from './store.js';

const text = { type: 'string', minLength: 1, maxLength: 200 };
const id = { type: 'string', minLength: 1, maxLength: 150 };
const reason = { type: 'string', minLength: 1, maxLength: 2000 };
const object = (properties: Record<string, unknown> = {}, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false });
const page = object({ cursor: { type: 'integer', minimum: 1 }, limit: { type: 'integer', minimum: 1, maximum: 100 } });
export interface Operation {
  name: string;
  description: string;
  scope: string;
  admin?: boolean;
  readOnly?: boolean;
  schema: Record<string, unknown>;
}
export const OPERATIONS: Operation[] = [
  { name: 'browser-auth.get', description: 'Read the local browser sign-in preference and enterprise enforcement.', scope: 'admin', admin: true, readOnly: true, schema: object() },
  { name: 'browser-auth.update', description: 'Opt in to local browser access-token sign-in. Assistant authentication remains required.', scope: 'admin', admin: true, schema: object({ requireSignIn: { type: 'boolean' } }, ['requireSignIn']) },
  { name: 'ai.providers.list', description: 'List curated AI providers and sanitized active configuration.', scope: 'ai:invoke', readOnly: true, schema: object() },
  { name: 'ai.models.list', description: 'List models offered by the configured provider.', scope: 'ai:invoke', readOnly: true, schema: object() },
  { name: 'ai.models.discover', description: 'Discover models using a draft provider credential without saving it.', scope: 'admin', admin: true, readOnly: true, schema: object({ provider: text, apiKey: { type: 'string', minLength: 1, maxLength: 4096 } }, ['provider']) },
  { name: 'environments.preview', description: 'Preview an architecture map from the latest observed local network or enrolled AWS inventory.', scope: 'security:read', readOnly: true, schema: object({ source: { enum: ['local', 'aws'] } }, ['source']) },
  { name: 'ai.configure', description: 'Configure the standalone security AI provider; credentials stay in process memory until restart.', scope: 'admin', admin: true, schema: object({ provider: text, model: text, apiKey: { type: 'string', minLength: 1, maxLength: 4096 }, temperature: { type: 'number', minimum: 0, maximum: 2 }, maxTokens: { type: 'integer', minimum: 256, maximum: 16000 } }, ['provider', 'model']) },
  { name: 'ai.test', description: 'Test the configured security AI provider with a bounded request.', scope: 'admin', admin: true, schema: object() },
  { name: 'ai.run', description: 'Run bounded security analysis or propose a diagram; never applies changes or executes tools.', scope: 'ai:invoke', schema: object({ requestId: id, kind: { enum: ['chat', 'analysis', 'generate', 'assessment'] }, prompt: { type: 'string', minLength: 1, maxLength: 64000 }, context: { type: 'object' }, projectId: id, revision: { type: 'integer', minimum: 1 } }, ['kind', 'prompt']) },
  { name: 'ai.cancel', description: 'Cancel one AI request owned by this credential.', scope: 'ai:invoke', schema: object({ requestId: id }, ['requestId']) },
  { name: 'status.get', description: 'Read observed local host, native antivirus and telemetry coverage status.', scope: 'security:read', readOnly: true, schema: object() },
  { name: 'findings.list', description: 'List observed findings with evidence and model links.', scope: 'security:read', readOnly: true, schema: page },
  { name: 'findings.update', description: 'Review a finding and optionally link it to an architecture asset. Resolution is a review decision, not proof of remediation.', scope: 'findings:write', schema: object({ id, status: { enum: ['open', 'acknowledged', 'resolved'] }, reason, projectId: id, assetId: id }, ['id', 'status', 'reason']) },
  { name: 'findings.ingest', description: 'Import evidence from a security connector. Source identity comes from this credential; imported text is untrusted.', scope: 'findings:ingest', schema: object({ items: { type: 'array', minItems: 1, maxItems: 500, items: object({ externalId: id, title: text, description: { type: 'string', maxLength: 10000 }, severity: { enum: ['info', 'low', 'medium', 'high', 'critical'] }, evidence: { type: 'object', maxProperties: 100 }, observedAt: { type: 'integer', minimum: 0 } }, ['externalId', 'title', 'severity', 'observedAt']) } }, ['items']) },
  { name: 'projects.list', description: 'List authorized architecture and risk workspaces.', scope: 'projects:read', readOnly: true, schema: object() },
  { name: 'projects.create', description: 'Create an empty architecture workspace.', scope: 'projects:write', schema: object({ name: text }, ['name']) },
  { name: 'projects.import', description: 'Import a complete ContextCypher or Guardian JSON workspace, preserving the original.', scope: 'projects:write', schema: object({ name: text, content: { type: 'string', minLength: 2, maxLength: 67108864 } }, ['name', 'content']) },
  { name: 'projects.get', description: 'Read an authorized workspace at its current revision.', scope: 'projects:read', readOnly: true, schema: object({ id }, ['id']) },
  { name: 'projects.update', description: 'Commit a complete workspace document using its expected revision. Preserve unknown fields.', scope: 'projects:write', schema: object({ id, revision: { type: 'integer', minimum: 1 }, document: { type: 'object' } }, ['id', 'revision', 'document']) },
  { name: 'projects.export', description: 'Export editable document and exact original import.', scope: 'projects:read', readOnly: true, schema: object({ id }, ['id']) },
  { name: 'host.check.start', description: 'Start bounded read-only local host/network/native security collection.', scope: 'security:collect', schema: object() },
  { name: 'aws.status.get', description: 'Read the configured private AWS security collection status and coverage.', scope: 'cloud:read', readOnly: true, schema: object() },
  { name: 'aws.check.start', description: 'Start read-only security collection in the explicitly configured AWS account and region.', scope: 'cloud:collect', schema: object() },
  { name: 'native.scan.propose', description: 'Propose a Windows Defender quick or full scan for separate administrator approval.', scope: 'response:propose', schema: object({ scanType: { enum: ['quick', 'full'] } }, ['scanType']) },
  { name: 'jobs.list', description: 'List security jobs and approvals visible to this actor.', scope: 'security:read', readOnly: true, schema: object() },
  { name: 'jobs.approve', description: 'Approve exactly one pending security action.', scope: 'admin', admin: true, schema: object({ id, reason }, ['id', 'reason']) },
  { name: 'jobs.reject', description: 'Reject a pending security action.', scope: 'admin', admin: true, schema: object({ id, reason }, ['id', 'reason']) },
  { name: 'clients.list', description: 'List enrolled assistant credentials and grants, without secrets.', scope: 'admin', admin: true, readOnly: true, schema: object() },
  { name: 'clients.create', description: 'Enroll a scoped assistant credential; token is returned once.', scope: 'admin', admin: true, schema: object({ name: text, scopes: { type: 'array', minItems: 1, maxItems: 20, uniqueItems: true, items: text }, projectIds: { type: 'array', maxItems: 100, uniqueItems: true, items: id }, expiresInDays: { type: 'integer', minimum: 1, maximum: 90 } }, ['name', 'scopes']) },
  { name: 'clients.revoke', description: 'Immediately revoke a non-administrator credential.', scope: 'admin', admin: true, schema: object({ id }, ['id']) },
  { name: 'audit.list', description: 'Read the local administrator audit trail. Local hash linkage is not an externally trusted archive.', scope: 'admin', admin: true, readOnly: true, schema: page },
  { name: 'integrations.list', description: 'Read installed and available security integration capability status.', scope: 'security:read', readOnly: true, schema: object() },
];
export const ASSISTANT_SCOPES = [...new Set(OPERATIONS.filter(op => !op.admin).map(op => op.scope))];
const ajv = new Ajv.default({ allErrors: true, strict: true });
const validators = new Map(OPERATIONS.map(op => [op.name, ajv.compile(op.schema)]));
export function authorize(principal: Principal, audience: 'admin' | 'assistant', name: string, input: unknown): Operation {
  const operation = OPERATIONS.find(op => op.name === name);
  if (!operation) throw new WorkspaceError(404, 'Unknown operation');
  if (principal.revoked || principal.expiresAt <= Date.now()) throw new WorkspaceError(401, 'Credential expired or revoked');
  if (operation.admin && (audience !== 'admin' || principal.role !== 'admin')) throw new WorkspaceError(403, 'This operation requires an administrator session.');
  if (principal.role !== 'admin' && !principal.scopes.includes(operation.scope)) throw new WorkspaceError(403, `Missing scope: ${operation.scope}`);
  if (principal.role === 'viewer' && !operation.readOnly) throw new WorkspaceError(403, 'Viewer cannot mutate state');
  const validate = validators.get(name)!;
  if (!validate(input)) throw new WorkspaceError(400, `Invalid ${name} input: ${ajv.errorsText(validate.errors)}`);
  return operation;
}
export function visibleOperations(principal: Principal, audience: 'admin' | 'assistant' = 'assistant'): Operation[] {
  return OPERATIONS.filter(op => (!op.admin || (audience === 'admin' && principal.role === 'admin'))
    && (principal.role === 'admin' || principal.scopes.includes(op.scope))
    && (principal.role !== 'viewer' || op.readOnly));
}
