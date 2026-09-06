import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.GUARDIAN_UI_URL || 'http://127.0.0.1:3007';
const out = 'tmp/security-project-routing-ui-qa';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1800, height: 1100 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const responseFor = operation => page.waitForResponse(response => response.url().endsWith('/api/v1/operations') && response.request().method() === 'POST' && response.request().postDataJSON()?.operation === operation);
const hash = id => `#systems?project=${encodeURIComponent(id)}`;
const opened = async project => {
  await page.waitForURL(`${base}/${hash(project.id)}`);
  await page.waitForFunction(name => document.querySelector('input[placeholder="System name..."]')?.value === name, project.name);
};
const routeTo = id => page.evaluate(value => { window.location.hash = value; }, hash(id));
const choose = async project => {
  await page.locator('[aria-label="Saved system"]').getByRole('combobox').click();
  await page.getByRole('option', { name: project.name, exact: true }).click();
  await opened(project);
};
try {
  await page.goto(`${base}/#systems`);
  const create = async suffix => {
    await page.getByLabel('New system name', { exact: true }).fill(`Route QA ${Date.now()} ${suffix}`);
    const response = responseFor('projects.create');
    await page.getByRole('button', { name: 'Create system', exact: true }).click();
    const project = (await (await response).json()).result.project;
    await opened(project);
    return project;
  };
  const first = await create('first');
  const second = await create('second');
  const importedResponse = responseFor('projects.import');
  await page.locator('input[type="file"]').first().setInputFiles({ name: 'route-qa.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ systemName: `Imported routing QA ${Date.now()}`, nodes: [], edges: [] })) });
  const imported = (await (await importedResponse).json()).result.project;
  await opened(imported);
  await choose(second);
  await page.reload();
  await opened(second);
  await routeTo(first.id);
  await opened(first);
  const draftName = `${first.name} retained draft`;
  await page.getByPlaceholder('System name...', { exact: true }).fill(draftName);
  await page.getByText('Unsaved changes', { exact: false }).waitFor();
  let rejected = 0;
  const cancel = async dialog => { rejected++; await dialog.dismiss(); };
  page.on('dialog', cancel);
  await routeTo(second.id);
  await page.waitForURL(`${base}/${hash(first.id)}`);
  assert.equal(await page.getByPlaceholder('System name...', { exact: true }).inputValue(), draftName);
  await page.goBack();
  await page.waitForURL(`${base}/${hash(first.id)}`);
  // The cancelled hash entry now points to the same open project; the next
  // history entry is the genuinely different project and must be guarded.
  await page.goBack();
  await page.waitForURL(`${base}/${hash(first.id)}`);
  assert.equal(await page.getByPlaceholder('System name...', { exact: true }).inputValue(), draftName);
  assert.equal(rejected, 2);
  await page.getByRole('navigation', { name: 'Workspace', exact: true }).getByRole('link', { name: 'Environments', exact: true }).click();
  await page.waitForURL(`${base}/${hash(first.id)}`);
  assert.equal(await page.getByPlaceholder('System name...', { exact: true }).inputValue(), draftName);
  assert.equal(rejected, 3, 'cross-page navigation must preserve the complete project URL when cancelled');
  page.off('dialog', cancel);
  page.once('dialog', dialog => dialog.accept());
  await routeTo('Not reported');
  await page.getByRole('alert').filter({ hasText: /project not found/i }).waitFor();
  await page.waitForURL(`${base}/${hash(first.id)}`);
  assert.equal(await page.getByPlaceholder('System name...', { exact: true }).inputValue(), draftName);
  page.once('dialog', dialog => dialog.accept());
  await choose(imported);

  // Delay one real response to verify an older load cannot replace a newer route.
  let release;
  let delayed;
  const intercepted = new Promise(resolve => { delayed = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/v1/operations', async route => {
    const request = route.request().postDataJSON();
    if (request?.operation !== 'projects.get' || request.input?.id !== second.id) return route.continue();
    const response = await route.fetch();
    delayed();
    await gate;
    await route.fulfill({ response });
  });
  await routeTo(second.id);
  await intercepted;
  await routeTo(first.id);
  await opened(first);
  const staleResponse = responseFor('projects.get');
  release();
  await staleResponse;
  await page.unrouteAll({ behavior: 'wait' });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await opened(first);

  // Recover the user's actual invalid URL by choosing a saved project.
  await page.goto(`${base}/#systems?project=Not%20reported`);
  await page.getByRole('alert').filter({ hasText: /project not found/i }).waitFor();
  await choose(imported);
  await page.reload();
  await opened(imported);
  const marker = await page.evaluate(() => { window.routingReloadMarker = crypto.randomUUID(); return window.routingReloadMarker; });
  await page.getByPlaceholder('System name...', { exact: true }).fill(`${imported.name} reload draft`);
  await page.getByText('Unsaved changes', { exact: false }).waitFor();
  const reloadDialogs = [];
  const rejectReload = async dialog => { reloadDialogs.push(dialog.type()); await dialog.dismiss(); };
  page.on('dialog', rejectReload);
  await page.evaluate(() => window.location.reload());
  assert.deepEqual(reloadDialogs, ['beforeunload']);
  assert.equal(await page.evaluate(() => window.routingReloadMarker), marker);
  page.off('dialog', rejectReload);
  page.once('dialog', dialog => dialog.accept());
  await page.evaluate(() => window.location.reload());
  await opened(imported);
  assert.equal(await page.evaluate(() => window.routingReloadMarker), undefined);
  await page.getByRole('navigation', { name: 'Workspace', exact: true }).getByRole('link', { name: 'Protection', exact: true }).click();
  await page.evaluate(() => { window.routingReloadMarker = 'footer'; });
  await page.getByRole('button', { name: 'Reload page', exact: true }).click();
  await page.getByRole('heading', { name: 'Protection', exact: true }).waitFor();
  await page.waitForFunction(() => window.routingReloadMarker === undefined);
  await routeTo(imported.id);
  await opened(imported);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: `${out}/recovered-project.png` });
  const result = { passed: true, projectIds: [first.id, second.id, imported.id], dirtyCancellations: rejected, pageErrors: errors,
    evidence: 'Real backend create/import/select/reload, same-page navigation, dirty cancel and back, actual 404 preserves draft, invalid URL recovery. One real project response delayed to verify stale-load handling; no fabricated responses. Native reload has one beforeunload guard; Protection footer reloads the document.' };
  await writeFile(`${out}/result.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} catch (error) {
  await page.screenshot({ path: `${out}/failure.png` });
  throw error;
} finally { await browser.close(); }
