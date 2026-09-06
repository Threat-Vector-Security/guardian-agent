import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const url = process.env.GUARDIAN_UI_URL || 'http://127.0.0.1:3007';
const out = resolve('tmp/security-keyboard-ui-qa');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1800, height: 1100 } });
const errors = [];
const updates = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => {
  if (response.url().endsWith('/api/v1/operations') && response.request().method() === 'POST' && response.request().postDataJSON()?.operation === 'projects.update') updates.push(response.status());
});
await page.addInitScript(() => {
  window.keyboardQA = { calls: 0, files: [], cancel: false };
  window.showSaveFilePicker = async options => {
    if (!navigator.userActivation.isActive) throw new Error('Keyboard shortcut lost user activation');
    window.keyboardQA.calls++;
    if (window.keyboardQA.cancel) { window.keyboardQA.cancel = false; throw new DOMException('Cancelled', 'AbortError'); }
    let blob;
    return { name: options.suggestedName, createWritable: async () => ({
      write: async value => { blob = value; },
      close: async () => { window.keyboardQA.files.push({ name: options.suggestedName, text: await blob.text() }); },
      abort: async () => {},
    }) };
  };
});
const responseFor = name => page.waitForResponse(response => response.url().endsWith('/api/v1/operations') && response.request().method() === 'POST' && response.request().postDataJSON()?.operation === name);
try {
  await page.goto(url);
  await Promise.race([page.getByLabel('Access token').waitFor(), page.getByRole('heading', { name: 'Protection', exact: true }).waitFor()]);
  if (await page.getByLabel('Access token').isVisible()) {
    if (!process.env.GUARDIAN_UI_TOKEN_FILE) throw new Error('Set GUARDIAN_UI_TOKEN_FILE when preview sign-in is required');
    await page.getByLabel('Access token').fill((await readFile(process.env.GUARDIAN_UI_TOKEN_FILE, 'utf8')).trim());
    await page.getByRole('button', { name: 'Open workspace' }).click();
  }
  await page.getByRole('navigation', { name: 'Workspace', exact: true }).getByRole('link', { name: 'Systems', exact: true }).click();
  await page.getByLabel('New system name', { exact: true }).fill(`Keyboard browser QA ${Date.now()}`);
  const createdResponse = responseFor('projects.create');
  await page.getByRole('button', { name: 'Create system', exact: true }).click();
  const created = (await (await createdResponse).json()).result.project;
  const canvas = page.getByRole('region', { name: 'System diagram canvas', exact: true });
  await canvas.waitFor();
  await page.locator('.react-flow__pane').click({ position: { x: 400, y: 320 } });
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'System diagram canvas');
  await page.keyboard.press('Control+Shift+s');
  await page.waitForFunction(() => window.keyboardQA.files.length === 1);
  assert.equal(await page.evaluate(() => window.keyboardQA.calls), 1, 'shortcut must invoke a single save picker');
  await page.evaluate(() => { window.keyboardQA.cancel = true; });
  await page.keyboard.press('Control+Shift+s');
  await page.waitForFunction(() => window.keyboardQA.calls === 2);
  assert.equal(await page.evaluate(() => window.keyboardQA.files.length), 1);
  const savedResponse = responseFor('projects.update');
  await page.keyboard.press('Control+s');
  const saved = await savedResponse;
  assert.equal(saved.status(), 200);
  assert.equal((await saved.json()).result.project.revision, created.revision + 1);
  assert.equal(updates.length, 1, 'Ctrl+S must not save twice through bubbling');
  const input = page.getByPlaceholder('System name...', { exact: true });
  await input.fill('Typing remains local to the input');
  await page.keyboard.press('Control+a');
  assert.equal(await input.evaluate(element => element.selectionEnd - element.selectionStart), 'Typing remains local to the input'.length);
  const prevented = await input.evaluate(element => {
    const event = new KeyboardEvent('keydown', { key: 'S', code: 'KeyS', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  });
  assert.equal(prevented, false, 'application shortcut handlers must leave input keystrokes alone');
  assert.equal(await page.evaluate(() => window.keyboardQA.calls), 2);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: resolve(out, 'keyboard-input-preserved.png'), fullPage: true });
  const result = { passed: true, url, browser: 'Edge', projectId: created.id, nativePickerCalls: 2, filesWritten: 1,
    projectSaves: 1, pageErrors: errors, evidence: 'Real pane click and keyboard shortcuts; picker API stubbed to inspect activation/cancellation. Real backend Ctrl+S revision write.' };
  await writeFile(resolve(out, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
