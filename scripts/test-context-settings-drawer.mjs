import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(process.env.GUARDIAN_TEST_DOM_PACKAGE || import.meta.url);
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost:3007', pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'DocumentFragment', 'Event', 'CustomEvent', 'localStorage']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: name === 'localStorage' ? dom.window.localStorage : dom.window[name] });
}
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let configuration = null;
let rejectSave = true;
const calls = [];
globalThis.fetch = async (url, init) => {
  if (url === '/health') return new Response(JSON.stringify({ status: 'ok' }));
  const body = JSON.parse(init.body); calls.push(body);
  if (body.operation === 'ai.configure') {
    if (rejectSave) return new Response(JSON.stringify({ error: { message: 'Test save rejection' } }), { status: 400 });
    configuration = { ...body.input, apiKey: undefined, configured: true, hasCredential: true, ready: true };
  }
  if (body.operation === 'ai.models.discover') return new Response(JSON.stringify({ result: { models: [{ id: 'available-model', name: 'Available model', provider: 'openai' }] } }));
  return new Response(JSON.stringify({ result: { providers: [{ name: 'openai', displayName: 'OpenAI', requiresCredential: true }], configuration } }));
};
const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { ThemeProvider, createTheme } = await import('@mui/material/styles/index.js');
const { SettingsProvider } = await import('../web/contextcypher/src/settings/SettingsContext.tsx');
const { SettingsDrawer } = await import('../web/contextcypher/src/components/SettingsDrawer.tsx');
const { defaultSettings } = await import('../web/contextcypher/src/settings/settings.ts');
const { getTheme } = await import('../web/contextcypher/src/styles/Theme.ts');
const { connectionManager } = await import('../web/contextcypher/src/services/ConnectionManager.ts');
localStorage.setItem('settings', JSON.stringify({ ...defaultSettings, chatHistoryLogging: { ...defaultSettings.chatHistoryLogging, enabled: false, userHasSetPreference: true } }));
const theme = createTheme({ palette: { mode: 'dark' }, colors: getTheme('dark').colors });
const { act } = React;
let closed = 0;
const root = createRoot(document.getElementById('root'));
function Harness() {
  const [open, setOpen] = React.useState(true);
  const [revision, setRevision] = React.useState(0);
  return React.createElement(ThemeProvider, { theme }, React.createElement(SettingsProvider, null,
    React.createElement('button', { onClick: () => setRevision(value => value + 1) }, 'Rerender parent'),
    React.createElement('span', null, revision),
    React.createElement(SettingsDrawer, { open, onClose: () => { closed++; setOpen(false); }, edges: [] })));
}
const button = text => [...document.querySelectorAll('button')].find(item => item.textContent === text);
const click = async element => { assert.ok(element, 'Expected UI element'); await act(async () => { element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); }); };
const password = () => document.querySelector('input[type="password"]');
const fill = async (input, value) => { await act(async () => {
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
}); };
try {
  await act(async () => { root.render(React.createElement(Harness)); });
  await fill(password(), 'synthetic-drawer-key');
  await click(button('Load available models'));
  const combo = [...document.querySelectorAll('input[role="combobox"]')][0];
  assert.ok(combo, 'Searchable model input exists');
  await act(async () => {
    combo.focus();
    combo.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true }));
  });
  const option = document.querySelector('[role="option"]');
  assert.ok(option, 'Live model option exists');
  await click(option);
  assert.match(combo.value, /Available model/);
  await click(button('Rerender parent'));
  assert.equal(password().value, 'synthetic-drawer-key', 'parent rerender preserves key');
  await click([...document.querySelectorAll('[role="tab"]')].find(item => item.textContent === 'Appearance'));
  await click([...document.querySelectorAll('[role="tab"]')].find(item => item.textContent === 'General'));
  assert.equal(password().value, 'synthetic-drawer-key', 'tab switch preserves key');
  await click(button('Save Settings and Close'));
  assert.equal(closed, 0, 'failed save keeps actual drawer open');
  assert.equal(password().value, 'synthetic-drawer-key', 'failed save retains key');
  assert.equal(calls.filter(call => call.operation === 'ai.configure').length, 1, 'outer UI invoked configure');
  assert.match(document.body.textContent, /Test save rejection/);
  rejectSave = false;
  await click(button('Save Settings and Close'));
  assert.equal(closed, 1, 'successful save closes actual drawer');
  assert.equal(configuration.model, 'available-model');
  assert.equal(configuration.provider, 'openai');
  assert.equal(password().value, '');
  assert.equal(calls.filter(call => call.operation === 'ai.configure').length, 2);
  console.log('Full SettingsDrawer check passed: initial configuration null, live model selection, parent rerender, tab retention, rejected outer save, successful outer save and close.');
} finally {
  await act(async () => { root.unmount(); });
  connectionManager.destroy();
  dom.window.close();
}
// The imported browser modules own background timers; all assertions and unmounts are complete.
process.exit(0);
