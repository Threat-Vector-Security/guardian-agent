import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { saveFile } from '../web/shared/file-dialogs.ts';

const text = await readFile(new URL('../web/contextcypher/src/components/DiagramEditor.tsx', import.meta.url), 'utf8');
const source = ts.createSourceFile('DiagramEditor.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
// Exercise the actual editor callback bodies without mounting its unrelated rendering subsystems.
function callback(name, environment) {
  let arrow;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name && ts.isCallExpression(node.initializer)) arrow = node.initializer.arguments[0];
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(arrow, `Callback ${name} exists`);
  const javascript = ts.transpileModule(`const callback = ${arrow.getText(source)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  return Function(...Object.keys(environment), javascript + '; return callback;')(...Object.values(environment));
}
const events = [];
const toasts = [];
let written;
let mode = 'save';
globalThis.window = { showSaveFilePicker: async () => {
  events.push('picker');
  if (mode === 'cancel') throw new DOMException('Cancelled', 'AbortError');
  if (mode === 'denied') throw new DOMException('Denied', 'NotAllowedError');
  return { createWritable: async () => ({ write: async content => { events.push('write'); written = content; }, close: async () => { events.push('close'); } }) };
} };
const environment = {
  saveFile, systemName: 'File action check', reactFlowInstance: {}, nodes: [{ id: 'one' }],
  currentTheme: { colors: { background: '#000' } },
  showToast: (message, kind) => toasts.push({ message, kind }),
  captureReactFlowAsCanvas: async () => {
    events.push('capture');
    return { toBlob: (resolve, type) => resolve(new Blob(['image'], { type })) };
  },
};
for (const name of ['handleExportPNG', 'handleExportJPEG']) {
  const exportImage = callback(name, environment);
  events.length = 0; toasts.length = 0; mode = 'cancel';
  assert.equal(await exportImage(), false);
  assert.deepEqual(events, ['picker'], 'cancelled destination must not capture the canvas');
  assert.ok(!toasts.some(toast => toast.kind === 'success'));
  events.length = 0; toasts.length = 0; mode = 'save';
  assert.equal(await exportImage(), true);
  assert.deepEqual(events, ['picker', 'capture', 'write', 'close']);
  assert.ok(toasts.some(toast => toast.kind === 'success'));
  assert.equal(written.type, name === 'handleExportPNG' ? 'image/png' : 'image/jpeg');
}
const diagram = { systemName: 'File action check', nodes: [{ id: 'kept', data: { custom: 'preserved' } }], edges: [] };
const exportSystem = callback('saveAs', { ...environment, guardianRef: { current: {} }, guardianDocument: diagram });
mode = 'save'; toasts.length = 0;
assert.equal(await exportSystem(), true);
assert.deepEqual(JSON.parse(await written.text()), diagram);
mode = 'cancel'; toasts.length = 0;
assert.equal(await exportSystem(), false);
assert.ok(!toasts.some(toast => toast.kind === 'success'));
mode = 'denied'; toasts.length = 0;
assert.equal(await exportSystem(), false);
assert.ok(toasts.some(toast => toast.kind === 'error'));
let revisionSaves = 0;
const autosave = callback('handleAutosaveConfirm', {
  setIsAutosaveDialogOpen() {}, guardianRef: { current: {} },
  save: async () => { revisionSaves++; return true; },
  saveAs: async () => { throw new Error('Embedded autosave must not export a portable file'); },
});
await autosave();
assert.equal(revisionSaves, 1);
assert.doesNotMatch(text, /\.download\s*=/, 'editor file exports must not bypass the picker helper');
assert.match(text, /disabled: !guardianRef\.current && !currentFile\.handle/);
console.log('Editor file action checks passed: save-copy preservation, cancellation, denied picker, PNG/JPEG ordering, success feedback, Guardian autosave routing.');
