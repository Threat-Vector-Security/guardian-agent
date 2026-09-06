import { readFile, readdir, rm, rmdir } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist');
const entry = resolve(output, 'security-main.js');
const keep = new Set();
const pending = [entry];
const within = path => {
  const rel = relative(output, path);
  if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) throw new Error(`Compiled dependency escapes dist: ${path}`);
};

while (pending.length) {
  const path = pending.pop();
  if (keep.has(path)) continue;
  within(path); keep.add(path);
  const ast = ts.createSourceFile(path, await readFile(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const visit = node => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier?.text?.startsWith('.')) pending.push(resolve(dirname(path), node.moduleSpecifier.text));
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      if (node.arguments.length !== 1 || !ts.isStringLiteral(node.arguments[0])) throw new Error(`Unresolved dynamic import in ${relative(output, path)}`);
      if (node.arguments[0].text.startsWith('.')) pending.push(resolve(dirname(path), node.arguments[0].text));
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
}

async function prune(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, item.name); within(path);
    if (item.isDirectory()) { await prune(path); if (!(await readdir(path)).length) await rmdir(path); }
    else if (!keep.has(path)) await rm(path);
  }
}
await prune(output);
