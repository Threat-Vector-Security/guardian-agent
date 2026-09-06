import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// User-authorized Edge fallback: real local service, isolated browser preferences and QA project.
// Browser time is accelerated; no service responses or revision conflicts are mocked.
const url = process.env.GUARDIAN_UI_URL || 'http://127.0.0.1:3007';
const out = resolve('tmp/security-autosave-ui-qa');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
const updates = [];
let downloads = 0;
page.on('pageerror', error => pageErrors.push(error.message));
page.on('download', () => { downloads++; });
page.on('response', response => {
  if (!response.url().endsWith('/api/v1/operations') || response.request().method() !== 'POST') return;
  if (response.request().postDataJSON()?.operation === 'projects.update') updates.push(response.status());
});
await page.addInitScript(() => {
  localStorage.setItem('settings', JSON.stringify({
    autosave: { enabled: true, intervalMinutes: 1 },
    chatHistoryLogging: { enabled: false, userHasSetPreference: true },
  }));
  window.__autosavePickerCalls = 0;
  window.showSaveFilePicker = async () => {
    window.__autosavePickerCalls++;
    throw new Error('Autosave must not request a file destination');
  };
});
await page.clock.install({ time: new Date() });
const operation = (name, input) => page.evaluate(async ({ name, input }) => {
  const response = await fetch('/api/v1/operations', { method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation: name, input }) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || `HTTP ${response.status}`);
  return body.result;
}, { name, input });
const responseFor = name => page.waitForResponse(response =>
  response.url().endsWith('/api/v1/operations') && response.request().method() === 'POST' && response.request().postDataJSON()?.operation === name);
try {
  await page.goto(url);
  await Promise.race([page.getByLabel('Access token').waitFor(), page.getByRole('heading', { name: 'Protection', exact: true }).waitFor()]);
  if (await page.getByLabel('Access token').isVisible()) {
    if (!process.env.GUARDIAN_UI_TOKEN_FILE) throw new Error('Set GUARDIAN_UI_TOKEN_FILE when preview sign-in is required');
    await page.getByLabel('Access token').fill((await readFile(process.env.GUARDIAN_UI_TOKEN_FILE, 'utf8')).trim());
    await page.getByRole('button', { name: 'Open workspace' }).click();
  }
  await page.getByRole('heading', { name: 'Protection', exact: true }).waitFor();
  assert.equal(await page.title(), 'Guardian Agent');
  await page.getByRole('navigation', { name: 'Workspace', exact: true }).getByRole('link', { name: 'Systems', exact: true }).click();
  const name = `Autosave browser QA ${Date.now()}`;
  await page.getByLabel('New system name', { exact: true }).fill(name);
  const createdResponse = responseFor('projects.create');
  await page.getByRole('button', { name: 'Create system', exact: true }).click();
  const created = (await (await createdResponse).json()).result.project;
  const search = page.getByPlaceholder('Search Node Type', { exact: true });
  await search.fill('Workstation');
  await page.getByRole('option', { name: 'Workstation', exact: true }).click();
  await page.locator('[draggable="true"]').filter({ hasText: /^Workstation$/ }).first().dblclick();
  await page.locator('.react-flow__node-workstation').waitFor();
  await page.getByText('Unsaved changes', { exact: false }).waitFor();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  const autosaveResponse = responseFor('projects.update');
  await page.clock.fastForward(61_000);
  const firstResponse = await autosaveResponse;
  assert.equal(firstResponse.status(), 200);
  const first = (await firstResponse.json()).result.project;
  await page.getByText(`Autosaved revision ${first.revision}.`, { exact: true }).waitFor();
  assert.ok(first.revision > created.revision);
  assert.ok(first.document.nodes.some(node => node.type === 'workstation'));
  const persisted = (await operation('projects.get', { id: created.id })).project;
  assert.equal(persisted.revision, first.revision);
  assert.deepEqual(persisted.document.nodes, first.document.nodes);
  assert.equal(await page.evaluate(() => window.__autosavePickerCalls), 0);
  assert.equal(downloads, 0);
  const unchangedUpdates = updates.length;
  await page.clock.fastForward(61_000);
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.equal(updates.length, unchangedUpdates, 'unchanged project generated an autosave write');
  await page.screenshot({ path: resolve(out, 'autosave-persisted.png'), fullPage: true });

  // A second real writer changes only this QA project while the editor keeps its previous revision.
  const external = (await operation('projects.update', { id: created.id, revision: persisted.revision,
    document: { ...persisted.document, qaConcurrentWriter: true } })).project;
  const draftName = `${name} unsaved conflicting edit`;
  await page.getByPlaceholder('System name...', { exact: true }).fill(draftName);
  await page.getByText('Unsaved changes', { exact: false }).waitFor();
  const conflictResponse = responseFor('projects.update');
  await page.clock.fastForward(61_000);
  assert.equal((await conflictResponse).status(), 409, 'expected a real stale-revision conflict');
  await page.getByText('Autosave is paused after a save failed.', { exact: false }).waitFor();
  assert.equal(await page.getByPlaceholder('System name...', { exact: true }).inputValue(), draftName);
  assert.equal(await page.getByRole('button', { name: 'Export draft', exact: true }).isEnabled(), true);
  const pausedUpdates = updates.length;
  await page.clock.fastForward(180_000);
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.equal(updates.length, pausedUpdates, 'paused autosave retried in the background');
  const afterConflict = (await operation('projects.get', { id: created.id })).project;
  assert.equal(afterConflict.revision, external.revision);
  assert.equal(afterConflict.document.qaConcurrentWriter, true);
  assert.notEqual(afterConflict.document.systemName, draftName);
  assert.equal(await page.evaluate(() => window.__autosavePickerCalls), 0);
  assert.equal(downloads, 0);
  assert.deepEqual(pageErrors, []);
  await page.screenshot({ path: resolve(out, 'autosave-conflict-preserved.png'), fullPage: true });
  const report = { passed: true, url, browser: 'Edge (isolated headless session)', projectId: created.id,
    persistedRevision: first.revision, concurrentRevision: external.revision, conflictStatus: 409,
    nativePickerInvocations: 0, downloads: 0, pageErrors,
    evidence: 'Actual service writes and actual revision conflict; accelerated browser clock only. No provider configuration changed.' };
  await writeFile(resolve(out, 'result.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
