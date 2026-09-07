import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Use an isolated local service: this check creates one explicitly named QA system.
const url = process.env.GUARDIAN_UI_URL;
if (!url) throw new Error('Set GUARDIAN_UI_URL to an isolated local QA service with browser access enabled.');
const out = process.env.GUARDIAN_UI_OUT || join(tmpdir(), 'guardian-layout-ui-qa');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });
const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const fitsPage = async name => {
  await settle();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: page overflows horizontally`);
  assert.equal(await page.locator('vite-error-overlay').count(), 0);
};
const fitsWorkspace = async (locator, name) => {
  await settle();
  const bounds = await locator.boundingBox();
  const parent = await page.locator('.guardian-workbench').boundingBox();
  assert.ok(bounds && parent && bounds.width > 0 && bounds.height > 0, `${name}: empty bounds`);
  assert.ok(bounds.x >= parent.x - 1 && bounds.x + bounds.width <= parent.x + parent.width + 1, `${name}: exceeds workspace width`);
  assert.ok(bounds.y + bounds.height <= parent.y + parent.height + 1, `${name}: bottom is clipped`);
};

try {
  await page.goto(url);
  await page.getByRole('heading', { name: 'Protection', exact: true }).waitFor();
  assert.match(await page.title(), /Guardian/i);
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of ['Protection', 'Environments', 'Findings', 'Activity', 'Integrations', 'Settings', 'Systems']) {
      await page.getByRole('navigation', { name: 'Workspace', exact: true }).getByRole('link', { name, exact: true }).click();
      if (name === 'Systems') await page.getByLabel('New system name', { exact: true }).waitFor();
      else await page.getByRole('heading', { name, exact: true }).waitFor();
      await fitsPage(`${name} ${width}`);
      if (name === 'Environments') {
        const panel = page.locator('.panel').first();
        const next = page.locator('.page > .empty');
        const panelBox = await panel.boundingBox();
        const nextBox = await next.boundingBox();
        assert.ok(nextBox.y - panelBox.y - panelBox.height >= 20, 'Environment cards need separation');
        if (width === 1440) {
          const field = await panel.getByRole('combobox').boundingBox();
          const action = await page.getByRole('button', { name: 'Collect now', exact: true }).boundingBox();
          assert.ok(Math.abs(field.y + field.height - action.y - action.height) <= 1, 'Form actions must align with the field bottom');
        }
      }
      if (width === 1440 || width === 390) await page.screenshot({ path: join(out, `${name.toLowerCase()}-${width}.png`), fullPage: true });
    }
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  const projectName = `Layout QA ${Date.now()} ${'LongSystemName'.repeat(11)}`;
  await page.getByLabel('New system name', { exact: true }).fill(projectName);
  await page.getByRole('button', { name: 'Create system', exact: true }).click();
  const canvas = page.getByRole('region', { name: 'System diagram canvas', exact: true });
  await canvas.waitFor();
  const systemUrl = page.url();
  const field = await page.getByLabel('New system name', { exact: true }).locator('..').boundingBox();
  const select = await page.locator('[aria-label="Saved system"]').boundingBox();
  assert.ok(Math.abs(field.height - select.height) <= 2, 'Native input styles must not inflate MUI fields');
  await page.reload();
  await canvas.waitFor();
  assert.equal(await page.getByPlaceholder('System name...', { exact: true }).inputValue(), projectName);

  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await fitsPage(`Diagram ${width}`);
    await fitsWorkspace(canvas, `Diagram ${width}`);
    const nameField = await page.getByPlaceholder('System name...', { exact: true }).boundingBox();
    assert.ok(nameField.width >= 150, `Diagram ${width}: system name is squeezed`);
    await page.screenshot({ path: join(out, `diagram-${width}.png`) });
    await page.getByRole('button', { name: 'Switch to GRC Module', exact: true }).click();
    const grcNavigation = page.locator('.guardian-workbench nav');
    await grcNavigation.waitFor();
    await fitsWorkspace(grcNavigation, `GRC navigation ${width}`);
    for (const button of await grcNavigation.getByRole('button').all()) {
      await button.click();
      await fitsPage(`GRC ${await button.getAttribute('aria-label')} ${width}`);
      assert.equal(await button.getAttribute('aria-pressed'), 'true');
      const content = page.getByRole('region', { name: 'GRC workspace', exact: true });
      assert.ok(await content.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `GRC ${await button.getAttribute('aria-label')} ${width}: content overflows outside its tables`);
      if (await button.getAttribute('aria-label') === 'Workflow & Config') {
        for (const tab of await content.getByRole('tab').all()) {
          await tab.click();
          await settle();
          await fitsWorkspace(grcNavigation, `GRC config navigation ${width}`);
          assert.ok(await content.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `GRC config ${await tab.innerText()} ${width}: content overflows`);
          const clippedFields = await content.evaluate(element => {
            const bounds = element.getBoundingClientRect();
            return [...element.querySelectorAll('.MuiFormControl-root')].filter(field => {
              if (field.closest('table')) return false;
              const rect = field.getBoundingClientRect();
              return rect.width > 0 && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1);
            }).map(field => field.textContent.slice(0, 60));
          });
          assert.deepEqual(clippedFields, [], `GRC config ${await tab.innerText()} ${width}: clipped fields`);
        }
        await content.getByRole('tab', { name: 'Workflow & Health', exact: true }).click();
      }
    }
    await page.screenshot({ path: join(out, `grc-${width}.png`) });
    const toggle = page.getByRole('button', { name: width >= 1024 ? 'Show GRC analysis panel' : 'Toggle Analysis Panel', exact: true });
    if (await toggle.isVisible()) {
      await toggle.click();
      const panel = page.getByTestId('grc-analysis-panel-container');
      await panel.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
      await fitsWorkspace(panel, `GRC analysis ${width}`);
    }
    // Reload resets transient panel state, preserving the actual saved project.
    await page.goto(systemUrl);
    await page.reload();
    await canvas.waitFor();
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const drawer = page.locator('.MuiDrawer-paper:visible');
    await drawer.waitFor();
    await drawer.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
    for (const tab of await drawer.getByRole('tab').all()) {
      await tab.click();
      await settle();
      const bounds = await drawer.boundingBox();
      assert.ok(bounds.x >= -1 && bounds.x + bounds.width <= width + 1, 'Settings drawer exceeds the viewport');
      assert.ok(await drawer.evaluate(element => element.scrollWidth <= element.clientWidth + 1), 'Settings drawer overflows');
    }
    await drawer.getByRole('tab', { name: 'General', exact: true }).click();
    await page.screenshot({ path: join(out, `settings-drawer-${width}.png`) });
    await page.reload();
    await canvas.waitFor();
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, viewports: [1440, 1024, 768, 390, 320], screenshots: out }));
} finally {
  await browser.close();
}
