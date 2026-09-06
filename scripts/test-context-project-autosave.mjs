import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { documentContentFingerprint } from '../web/contextcypher/document-preservation.ts';

const text = await readFile(new URL('../web/contextcypher/GuardianWorkbench.tsx', import.meta.url), 'utf8');
const source = ts.createSourceFile('GuardianWorkbench.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let saveArrow;
let timerArrow;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'save' && ts.isCallExpression(node.initializer)) saveArrow = node.initializer.arguments[0];
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect' && node.arguments[0]?.getText(source).includes('const intervalMs = settings.autosave.intervalMinutes')) timerArrow = node.arguments[0];
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(saveArrow && timerArrow, 'Exercise the actual workspace save callback and scheduling effect');
function compile(arrow, environment) {
  const javascript = ts.transpileModule(`const callback = ${arrow.getText(source)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  return Function(...Object.keys(environment), javascript + '; return callback;')(...Object.values(environment));
}
const initial = { nodes: [{ id: 'one', data: { label: 'Original' } }], edges: [] };
const draft = { current: structuredClone(initial) };
const saved = { current: documentContentFingerprint(initial) };
const projectRef = { current: { id: 'project-one', revision: 1, document: initial } };
const saving = { current: false };
const state = { dirty: false, paused: false, busy: false, notice: '', error: '', next: null };
const calls = [];
let complete;
let fail;
const save = compile(saveArrow, {
  projectRef, saving, saved, draft, documentContentFingerprint,
  setBusy: value => { state.busy = value; }, setError: value => { state.error = value; },
  setProject() {}, setDirty: value => { state.dirty = value; },
  setAutosavePaused: value => { state.paused = value; }, setNotice: value => { state.notice = value; },
  projects: { refresh: async () => {} },
  operation: (name, input) => {
    calls.push({ name, input });
    return new Promise((resolve, reject) => { complete = resolve; fail = reject; });
  },
});
const timers = new Map();
let timerSequence = 0;
const environment = {
  settings: { autosave: { enabled: true, intervalMinutes: 2 } },
  project: projectRef.current, autosavePaused: false, busy: false, draft, saved, saving,
  baselinePending: { current: false }, documentContentFingerprint, save,
  setNextAutosaveAt: value => { state.next = value; },
  setInterval: (callback, delay) => { const id = ++timerSequence; timers.set(id, { callback, delay }); return id; },
  clearInterval: id => timers.delete(id),
};
const schedule = override => compile(timerArrow, { ...environment, ...override })();
let cleanup = schedule();
assert.equal(timers.size, 1);
const timer = [...timers.values()][0];
assert.equal(timer.delay, 120_000);
await timer.callback();
assert.equal(calls.length, 0, 'unchanged projects are not written');
draft.current = { ...initial, systemName: 'Changed' };
const first = timer.callback();
assert.equal(calls.length, 1);
assert.equal(calls[0].name, 'projects.update');
assert.equal(calls[0].input.id, 'project-one');
assert.equal(calls[0].input.revision, 1);
assert.equal(saving.current, true);
await timer.callback();
assert.equal(calls.length, 1, 'another tick cannot overlap an in-flight save');
draft.current = { ...initial, systemName: 'Edited during save' };
complete({ project: { id: 'project-one', revision: 2, document: calls[0].input.document } });
await first;
assert.equal(projectRef.current.revision, 2);
assert.equal(state.dirty, true, 'new edits made during a save remain dirty');
assert.match(state.notice, /Autosaved revision 2/);
const second = timer.callback();
assert.equal(calls[1].input.revision, 2);
fail(new Error('Revision conflict'));
await second;
assert.equal(state.paused, true);
assert.equal(timers.size, 0, 'a failure stops further interval retries immediately');
assert.equal(draft.current.systemName, 'Edited during save');
assert.match(state.error, /Revision conflict.*draft remains open/);
cleanup();
assert.equal(schedule({ autosavePaused: true }), undefined);
assert.equal(schedule({ settings: { autosave: { enabled: false, intervalMinutes: 2 } } }), undefined);
assert.equal(schedule({ busy: true }), undefined);
assert.equal(schedule({ settings: { autosave: { enabled: true, intervalMinutes: 0 } } }), undefined);
const manual = save(draft.current);
complete({ project: { id: 'project-one', revision: 3, document: draft.current } });
assert.equal(await manual, true);
assert.equal(state.paused, false, 'a successful explicit save permits autosave to resume');
assert.equal(state.dirty, false);
assert.match(state.notice, /^Saved revision 3/);
cleanup = schedule();
const afterResume = [...timers.values()][0].callback;
cleanup();
assert.equal(timers.size, 0, 'unmount clears the timer');
const before = calls.length;
await afterResume();
assert.equal(calls.length, before, 'a disposed callback cannot save');
console.log('Project autosave checks passed: preference interval, unchanged skip, in-flight guard, revision updates, concurrent edits, conflict pause, explicit recovery and cleanup.');
