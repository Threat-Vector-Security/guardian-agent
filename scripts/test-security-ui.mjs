import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Real browser + real local service; the credential stays inside this process and is never logged.
const url = process.env.GUARDIAN_UI_URL ?? 'http://127.0.0.1:3007';
const tokenFile = process.env.GUARDIAN_UI_TOKEN_FILE;
if (!tokenFile) throw new Error('Set GUARDIAN_UI_TOKEN_FILE to an isolated preview administrator token.');
const out = resolve('tmp/security-ui-qa');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
// Unattended tests verify the native-picker API contract and written payload.
// The OS-owned Save As window itself requires interactive browser acceptance.
await page.addInitScript(() => {
  window.__guardianFileTest = { saved: [], cancelNext: false };
  window.showSaveFilePicker = async options => {
    if (!navigator.userActivation.isActive) throw new DOMException('Picker lost the user gesture', 'SecurityError');
    if (window.__guardianFileTest.cancelNext) { window.__guardianFileTest.cancelNext = false; throw new DOMException('Cancelled', 'AbortError'); }
    let blob;
    return { name: options.suggestedName, createWritable: async () => ({
      write: async data => { blob = data instanceof Blob ? data : new Blob([data]); },
      close: async () => { window.__guardianFileTest.saved.push({ name: options.suggestedName, text: await blob.text(), size: blob.size }); },
      abort: async () => {},
    }) };
  };
});
const errors = [];
const workflows = ['sign-in', 'paged findings', 'create system', 'palette node', 'save/reload', 'draft export', 'built-in example import'];
const skipped = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`); });
page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });
const operationResult = async (name, action) => {
  const pending = page.waitForResponse(response => {
    if (!response.url().endsWith('/api/v1/operations') || response.request().method() !== 'POST') return false;
    try { return response.request().postDataJSON().operation === name; } catch { return false; }
  });
  await action();
  const response = await pending;
  const body = await response.json();
  if (!response.ok() || body.error) throw new Error(`${name} failed: ${body.error?.message ?? response.status()}`);
  return body.result;
};
const exportDraft = async () => {
  const before = await page.evaluate(() => window.__guardianFileTest.saved.length);
  await page.getByRole('button', { name: 'Export draft', exact: true }).click();
  await page.waitForFunction(count => window.__guardianFileTest.saved.length > count, before);
  return JSON.parse(await page.evaluate(() => window.__guardianFileTest.saved.at(-1).text));
};
try {
await page.goto(url);
await Promise.race([
  page.getByLabel('Access token').waitFor(),
  page.getByRole('heading', { name: 'Protection', exact: true }).waitFor(),
]);
if (await page.getByLabel('Access token').isVisible()) {
  await page.getByLabel('Access token').fill((await readFile(tokenFile, 'utf8')).trim());
  await page.getByRole('button', { name: 'Open workspace' }).click();
}
await page.getByRole('heading', { name: 'Protection', exact: true }).waitFor();
const seeded = await page.evaluate(async () => {
  const items = Array.from({ length: 101 }, (_, index) => ({ externalId: `browser-page-${index}`, title: `Browser paging ${index}`, severity: 'info', observedAt: Date.now() + index }));
  const response = await fetch('/api/v1/operations', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation: 'findings.ingest', input: { items } }) });
  return response.ok;
});
if (!seeded) throw new Error('Unable to seed isolated finding pagination fixture');
await page.screenshot({ path: resolve(out, 'protection-desktop.png'), fullPage: true });
for (const name of ['Environments', 'Findings', 'Systems', 'Activity', 'Integrations', 'Settings']) {
  await page.getByRole('navigation', { name: 'Workspace', exact: true }).getByRole('link', { name, exact: true }).click();
  // The restored workbench title is MUI Typography; its create field is the stable entry point.
  if (name === 'Systems') await page.getByLabel('New system name', { exact: true }).waitFor();
  else await page.getByRole('heading', { name, exact: true }).waitFor();
  if (name === 'Findings') {
    await page.getByRole('button', { name: 'Load older findings', exact: true }).click();
    await page.getByText(/of \d+ findings/).waitFor();
  }
}
await page.getByRole('navigation', { name: 'Workspace', exact: true }).getByRole('link', { name: 'Systems', exact: true }).click();
const systemName = `Browser QA ${Date.now()}`;
await page.getByLabel('New system name', { exact: true }).fill(systemName);
const created = await operationResult('projects.create', () => page.getByRole('button', { name: 'Create system', exact: true }).click());
const projectId = created.project.id;
if (created.project.document.nodes.length) throw new Error('A newly created system was not empty');
const paletteSearch = page.getByPlaceholder('Search Node Type', { exact: true });
await paletteSearch.waitFor();
await paletteSearch.fill('Workstation');
await page.getByRole('option', { name: 'Workstation', exact: true }).click();
// Palette items expose the original native draggable affordance and double-click creation.
await page.locator('[draggable="true"]').filter({ hasText: /^Workstation$/ }).first().dblclick();
await page.locator('.react-flow__node-workstation').waitFor();
const saved = await operationResult('projects.update', () => page.getByRole('button', { name: 'Save system', exact: true }).click());
const workstation = saved.project.document.nodes.find(node => node.type === 'workstation');
if (!workstation || !workstation.data?.label || saved.project.revision <= created.project.revision) throw new Error('Palette node was not saved as a typed asset');
await page.goto(`${url.replace(/\/$/, '')}/#systems?project=${encodeURIComponent(projectId)}`);
await page.reload();
await page.locator('.react-flow__node-workstation').waitFor();
const exported = await exportDraft();
if (!exported.nodes?.some(node => node.id === workstation.id && node.type === 'workstation' && node.data?.label === workstation.data.label)) throw new Error('Typed asset did not survive reload and export');
const sidebar = page.locator('#guardian-sidebar');
const expandedWidth = (await sidebar.boundingBox()).width;
await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
await page.getByRole('button', { name: 'Expand sidebar', exact: true }).waitFor();
if ((await sidebar.boundingBox()).width >= expandedWidth) throw new Error('Collapsing the sidebar did not release workspace width');
if (await page.getByRole('navigation', { name: 'Workspace', exact: true }).getByRole('link').count() !== 7) throw new Error('Collapsed navigation lost accessible links');
await page.locator('.react-flow__node-workstation').waitFor();
await page.screenshot({ path: resolve(out, 'sidebar-collapsed.png'), fullPage: true });
await page.reload();
await page.getByRole('button', { name: 'Expand sidebar', exact: true }).waitFor();
await page.locator('.react-flow__node-workstation').waitFor();
if ((await sidebar.boundingBox()).width >= expandedWidth) throw new Error('Sidebar preference did not survive reload');
await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
if ((await sidebar.boundingBox()).width !== expandedWidth) throw new Error('Expanding the sidebar did not restore its width');
workflows.push('sidebar collapse/expand, accessible navigation and reload persistence');

const examplesButton = page.getByRole('button', { name: 'Examples', exact: true });
let imported;
if (await examplesButton.isVisible()) {
  await examplesButton.click();
  await page.getByRole('menuitem').filter({ hasText: 'Microservices Service Mesh Architecture' }).first().click();
  imported = await operationResult('projects.import', () => page.getByRole('button', { name: 'Load Example', exact: true }).click());
} else {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Examples', exact: true }).click();
  // Compact-menu examples directly invoke the same import bridge without the preview dialog.
  imported = await operationResult('projects.import', () => page.getByRole('menuitem').filter({ hasText: 'Microservices Service Mesh Architecture' }).first().click());
}
if (imported.project.id === projectId || !imported.project.document.nodes.length || !imported.project.document.edges.length || !imported.project.document.grcWorkspace) throw new Error('Built-in example was not imported as a complete new system with GRC');
await page.getByText('Imported as a new system.', { exact: true }).waitFor();
await page.getByRole('button', { name: 'Save system', exact: true }).waitFor();
const exampleSaved = await operationResult('projects.update', () => page.getByRole('button', { name: 'Save system', exact: true }).click());
const exampleExport = await exportDraft();
if (exampleExport.nodes?.length !== exampleSaved.project.document.nodes.length || exampleExport.edges?.length !== exampleSaved.project.document.edges.length || !exampleExport.grcWorkspace) throw new Error('Example save/export lost graph or GRC content');
if (!exampleExport.nodes.some(node => node.type === 'securityZone')) throw new Error('Example security-zone nodes were flattened');
await writeFile(resolve(out, 'systems-dom.txt'), await page.locator('body').innerText());
await page.screenshot({ path: resolve(out, 'systems-desktop.png'), fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)) errors.push('Horizontal overflow on mobile Systems');
await page.screenshot({ path: resolve(out, 'systems-mobile.png'), fullPage: true });
await page.setViewportSize({ width: 1440, height: 1000 });
await page.getByRole('navigation', { name: 'Workspace', exact: true }).getByRole('link', { name: 'Protection', exact: true }).click();
await page.getByRole('heading', { name: 'Protection', exact: true }).waitFor();
await page.setViewportSize({ width: 390, height: 844 });
if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)) errors.push('Horizontal overflow on mobile Protection');
await page.screenshot({ path: resolve(out, 'protection-mobile.png'), fullPage: true });
await page.setViewportSize({ width: 1440, height: 1000 });
if (await page.getByRole('button', { name: 'Request antivirus scan', exact: true }).isEnabled()) {
await page.getByRole('button', { name: 'Request antivirus scan', exact: true }).click();
await page.getByRole('button', { name: 'Open activity', exact: true }).first().click();
await page.getByRole('button').filter({ hasText: 'native.scan' }).first().click();
await page.getByLabel('Decision reason', { exact: true }).fill('Browser verification rejects this proposal; no antivirus scan will execute.');
await page.getByRole('button', { name: 'Reject', exact: true }).click();
await page.locator('.inspector').getByText('rejected', { exact: true }).waitFor();
await page.screenshot({ path: resolve(out, 'approval-rejected.png'), fullPage: true });
workflows.push('propose/reject supported scan');
} else skipped.push('Native scan proposal: provider or grants do not support scans in this environment');
if (errors.length) throw new Error(errors.join('\n'));
console.log(JSON.stringify({ passed: true, pages: 7, workflows, skipped, viewport: ['1440x1000', '390x844'], screenshots: out }));
} finally { await browser.close(); }
