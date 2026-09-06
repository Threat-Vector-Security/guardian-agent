import assert from 'node:assert/strict';
import { discoverAIModels, guardianOperation, runAI, setGuardianProjectContext } from '../web/contextcypher/src/services/guardianApi.ts';
import { analyzeThreats } from '../web/contextcypher/src/services/guardianThreatAnalysis.ts';

const originalFetch = globalThis.fetch;
const calls = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url, init, body: JSON.parse(init.body) });
  return new Response(JSON.stringify({ result: { content: 'Model output', provider: 'test', model: 'test', jobId: 'job' } }));
};
try {
  await assert.rejects(runAI('analysis', 'No project'), /Open or save a Guardian project/);
  setGuardianProjectContext({ projectId: 'project-one', revision: 7 });
  await runAI('analysis', 'Review this system', { diagram: { nodes: [], edges: [] } });
  assert.equal(calls[0].url, '/api/v1/operations');
  assert.equal(calls[0].init.credentials, 'same-origin');
  assert.equal(calls[0].body.operation, 'ai.run');
  assert.equal(calls[0].body.input.kind, 'analysis');
  assert.equal(calls[0].body.input.projectId, 'project-one');
  assert.equal(calls[0].body.input.revision, 7);
  assert.match(calls[0].body.input.requestId, /^[0-9a-f-]{36}$/);
  assert.deepEqual(Object.keys(calls[0].init.headers), ['Content-Type']);
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'Permission denied' } }), { status: 403 });
  await assert.rejects(guardianOperation('ai.configure'), /Permission denied/);

  const controller = new AbortController();
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body); calls.push({ url, init, body });
    if (body.operation === 'ai.cancel') return new Response(JSON.stringify({ result: { cancelled: true } }));
    return new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
      started();
    });
  };
  const pending = runAI('chat', 'Test cancellation', {}, controller.signal);
  await ready;
  setGuardianProjectContext({ projectId: 'project-two', revision: 9 });
  assert.equal(calls.at(-1).body.input.projectId, 'project-one');
  assert.equal(calls.at(-1).body.input.revision, 7);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(calls.at(-1).body.operation, 'ai.cancel');
  assert.equal(calls.at(-1).body.input.requestId, calls.at(-2).body.input.requestId);

  const malformed = { content: 'Invalid response', systemAnalysis: { componentThreats: { invented: [] } } };
  globalThis.fetch = async () => new Response(JSON.stringify({ result: { content: JSON.stringify(malformed) } }));
  await assert.rejects(analyzeThreats([], [], ['actual'], 'node', {}), /omitted a selected component/);
  const analysis = { content: 'Evidence limitations identified', systemAnalysis: {
    componentThreats: { actual: [{ type: 'threat', title: 'Unauthorised access', description: 'Review authentication.', severity: 'HIGH', mitigation: 'Require authentication.' }] },
    attackPaths: [], vulnerabilities: [], recommendations: [], analyzedComponents: [],
  } };
  globalThis.fetch = async () => new Response(JSON.stringify({ result: { content: JSON.stringify(analysis) } }));
  const result = await analyzeThreats([], [], ['actual'], 'node', {});
  assert.equal(result.threats[0].source, 'auto-analysis');
  assert.equal(result.threats[0].severity, 'HIGH');
  assert.equal(result.detailedAnalysis, analysis.content);
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ result: { models: [
      { id: 'model-b', name: 'Model B', provider: 'openai' },
      { id: 'model-a', name: 'Model A', provider: 'openai' },
      { id: 'model-b', name: 'Model B', provider: 'openai' },
    ] } }));
  };
  assert.deepEqual((await discoverAIModels('openai', 'synthetic-test-key')).map(model => model.id), ['model-a', 'model-b']);
  assert.deepEqual(calls.at(-1).body, { operation: 'ai.models.discover', input: { provider: 'openai', apiKey: 'synthetic-test-key' } });
  assert.equal(calls.at(-1).init.credentials, 'same-origin');
  await discoverAIModels('openai');
  assert.deepEqual(calls.at(-1).body.input, { provider: 'openai' });
  globalThis.fetch = async () => new Response(JSON.stringify({ result: { models: [] } }));
  assert.deepEqual(await discoverAIModels('openai'), []);
  globalThis.fetch = async () => new Response(JSON.stringify({ result: { models: [{ id: 'bad', name: 'Bad', provider: 'other-provider' }] } }));
  await assert.rejects(discoverAIModels('openai'), /invalid model list/);
  console.log('Context AI bridge checks passed: same-origin session, errors, cancellation, structured result validation.');
} finally { globalThis.fetch = originalFetch; setGuardianProjectContext(null); }
