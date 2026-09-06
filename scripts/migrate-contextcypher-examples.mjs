// One-time migration of ContextCypher's Apache-2.0 example library, not a runtime dependency.
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/migrate-contextcypher-examples.mjs <ContextCypher repository>');
const bundle = await build({ entryPoints: [resolve(source, 'src/data/exampleSystems.ts')], bundle: true, platform: 'node', format: 'esm', write: false });
const { exampleSystems } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const directory = resolve('web/security/examples');
await mkdir(directory, { recursive: true });
const entries = new Map();
for (const [category, examples] of Object.entries(exampleSystems)) {
  for (const example of examples) {
    if (!/^[a-zA-Z0-9_-]+$/.test(example.id)) throw new Error(`Unsafe example ID: ${example.id}`);
    const content = JSON.stringify({ ...example, systemName: example.name });
    const hash = createHash('sha256').update(content).digest('hex');
    const existing = entries.get(example.id);
    if (existing) {
      if (existing.sha256 !== hash) throw new Error(`Conflicting example ID: ${example.id}`);
      existing.categories.push(category);
      continue;
    }
    await writeFile(resolve(directory, `${example.id}.json`), `${content}\n`);
    entries.set(example.id, { id: example.id, name: example.name, description: example.description, categories: [category], nodes: example.nodes.length, edges: example.edges.length, sha256: hash });
  }
}
await writeFile(resolve(directory, 'catalog.json'), `${JSON.stringify([...entries.values()], null, 2)}\n`);
console.log(`Migrated ${entries.size} examples across ${Object.keys(exampleSystems).length} categories.`);
