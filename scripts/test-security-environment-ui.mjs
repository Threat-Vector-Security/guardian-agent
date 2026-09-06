import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

// Real local collection, import, route change and editor load. No API responses are mocked.
const url = process.env.GUARDIAN_UI_URL || 'http://127.0.0.1:3007';
const out = 'tmp/security-environment-ui-qa';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
const calls = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => {
  if (!response.url().endsWith('/api/v1/operations') || response.request().method() !== 'POST') return;
  calls.push({ operation: response.request().postDataJSON()?.operation, status: response.status() });
});
const responseFor = name => page.waitForResponse(response => response.url().endsWith('/api/v1/operations') && response.request().method() === 'POST' && response.request().postDataJSON()?.operation === name);
try {
  await page.goto(`${url}/#environments`);
  await page.getByRole('heading', { name: 'Environments', exact: true }).waitFor();
  const collectionResponse = responseFor('host.check.start');
  await page.getByRole('button', { name: 'Collect now', exact: true }).click();
  const collection = await (await collectionResponse).json();
  assert.ok(collection.result.id);
  // Poll the actual job; no antivirus scan is requested by this passive collection.
  await page.waitForFunction(async id => {
    const response = await fetch('/api/v1/operations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation: 'jobs.list', input: {} }) });
    const body = await response.json();
    const job = body.result?.items?.find(item => item.id === id);
    if (job?.state === 'failed') throw new Error('Local collection failed');
    return job && !['pending', 'running', 'queued', 'requested'].includes(job.state);
  }, collection.result.id, { timeout: 60000, polling: 1000 });
  const previewResponse = responseFor('environments.preview');
  await page.getByRole('button', { name: 'Preview latest snapshot', exact: true }).click();
  const preview = (await (await previewResponse).json()).result;
  assert.ok(preview.nodeCount > 0);
  const name = `Environment flow QA ${Date.now()}`;
  await page.getByLabel('System name', { exact: true }).fill(name);
  const importResponse = responseFor('projects.import');
  await page.getByRole('button', { name: 'Create editable system', exact: true }).click();
  const imported = (await (await importResponse).json()).result;
  const id = imported.project?.id;
  assert.ok(id, `Import response keys: ${Object.keys(imported)}`);
  await page.waitForURL(`${url}/#systems?project=${encodeURIComponent(id)}`);
  await page.getByRole('button', { name: 'Save system', exact: true }).waitFor();
  await page.locator('.react-flow__node').first().waitFor();
  assert.equal(await page.getByText('project not found', { exact: true }).count(), 0);
  assert.equal(await page.locator('.react-flow__node').count(), preview.nodeCount);
  const saveResponse = responseFor('projects.update');
  await page.getByRole('button', { name: 'Save system', exact: true }).click();
  const saved = (await (await saveResponse).json()).result.project;
  assert.equal(saved.id, id);
  assert.equal(saved.document.nodes.length, preview.nodeCount);
  assert.equal(saved.document.edges.length, preview.edgeCount);
  await page.reload();
  await page.locator('.react-flow__node').first().waitFor();
  assert.equal(await page.locator('.react-flow__node').count(), preview.nodeCount);
  assert.deepEqual(errors, []);
  assert.ok(calls.every(call => call.status < 400), JSON.stringify(calls));
  await page.screenshot({ path: `${out}/created-system.png` });
  const result = { passed: true, projectId: id, nodes: preview.nodeCount, edges: preview.edgeCount, calls, pageErrors: errors };
  await writeFile(`${out}/result.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} catch (error) {
  await writeFile(`${out}/failure.json`, JSON.stringify({ url: page.url(), calls, errors, failure: String(error) }, null, 2));
  await page.screenshot({ path: `${out}/failure.png` });
  throw error;
} finally { await browser.close(); }
