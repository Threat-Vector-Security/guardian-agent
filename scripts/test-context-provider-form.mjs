import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

// Use an available jsdom installation; the application itself has no DOM-test dependency.
const require = createRequire(process.env.GUARDIAN_TEST_DOM_PACKAGE || import.meta.url);
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost:3007' });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'localStorage']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: name === 'localStorage' ? dom.window.localStorage : dom.window[name] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { act } = React;
const { default: GuardianProviderSettings } = await import('../web/contextcypher/src/components/GuardianProviderSettings.tsx');
const ref = React.createRef();
const calls = [];
let rejectSave = true;
globalThis.fetch = async (_url, init) => {
  const body = JSON.parse(init.body);
  calls.push(body);
  if (body.operation === 'ai.configure' && rejectSave) return new Response(JSON.stringify({ error: { message: 'Provider rejected this configuration' } }), { status: 400 });
  if (body.operation === 'ai.configure') return new Response(JSON.stringify({ result: { configuration: {
    provider: body.input.provider, model: body.input.model, hasCredential: true, ready: true, temperature: 0.2, maxTokens: 16000,
  } } }));
  return new Response(JSON.stringify({ result: { providers: [{ name: 'openai', displayName: 'OpenAI', requiresCredential: true }], configuration: { provider: 'openai', model: 'saved-model', hasCredential: false, ready: false, temperature: 0.2, maxTokens: 16000 } } }));
};
const root = createRoot(document.getElementById('root'));
try {
  await act(async () => { root.render(React.createElement(GuardianProviderSettings, { ref })); });
  assert.equal(ref.current.isDirty(), false);
  const password = document.querySelector('input[type="password"]');
  const setValue = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    setValue.call(password, 'synthetic-session-key');
    password.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  assert.equal(ref.current.isDirty(), true);
  let saved;
  await act(async () => { saved = await ref.current.saveIfDirty(); });
  assert.equal(saved, false);
  assert.equal(password.value, 'synthetic-session-key');
  assert.equal(ref.current.isDirty(), true);
  assert.match(document.body.textContent, /Provider rejected this configuration/);
  rejectSave = false;
  await act(async () => { saved = await ref.current.saveIfDirty(); });
  assert.equal(saved, true);
  assert.equal(password.value, '');
  assert.equal(ref.current.isDirty(), false);
  assert.equal(calls.filter(call => call.operation === 'ai.configure').length, 2);
  assert.equal(calls.at(-1).input.model, 'saved-model');
  for (let i = 0; i < localStorage.length; i++) assert.ok(!localStorage.getItem(localStorage.key(i)).includes('synthetic-session-key'));
  await act(async () => { saved = await ref.current.saveIfDirty(); });
  assert.equal(saved, true);
  assert.equal(calls.filter(call => call.operation === 'ai.configure').length, 2, 'unchanged outer save must not reconfigure');
  await act(async () => {
    setValue.call(password, 'discard-this-key');
    password.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  await act(async () => { ref.current.discard(); });
  assert.equal(password.value, '');
  assert.equal(ref.current.isDirty(), false);
  const drawer = await readFile(new URL('../web/contextcypher/src/components/SettingsDrawer.tsx', import.meta.url), 'utf8');
  assert.match(drawer, /if \(await providerSettingsRef\.current\?\.saveIfDirty\(\)\) onClose\(\)/);
  assert.match(drawer, /display: activeTab === 0 \? 'flex' : 'none'/);
  assert.match(drawer, /onClose=\{requestClose\}/);
  console.log('Provider form check passed: shared save, failure retention, successful credential clearing, clean save, explicit discard, drawer wiring.');
} finally {
  await act(async () => { root.unmount(); });
  dom.window.close();
}
