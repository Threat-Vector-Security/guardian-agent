#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
let raw = false;
let exitStatusMode = false;
let nullInput = false;
const vars = new Map();
let filter = '';

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '-r') {
    raw = true;
    continue;
  }
  if (arg === '-e') {
    exitStatusMode = true;
    continue;
  }
  if (arg === '-n') {
    nullInput = true;
    continue;
  }
  if (arg === '--arg') {
    const name = args[i + 1];
    const value = args[i + 2];
    vars.set(name, value);
    i += 2;
    continue;
  }
  filter = arg;
}

const input = nullInput ? null : readStdin();
const data = nullInput ? null : parseJson(input);
const result = evaluate(filter, data, vars);

if (exitStatusMode) {
  if (isTruthyForExit(result)) {
    if (result !== undefined && result !== null && result !== '') {
      printResult(result, raw);
    }
    process.exit(0);
  }
  process.exit(1);
}

printResult(result, raw);

function readStdin() {
  return readFileSync(0, 'utf8');
}

function parseJson(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return JSON.parse(trimmed);
}

function evaluate(filterText, dataValue, variables) {
  switch (filterText) {
    case '{content: $c, agentId: $a, userId: "harness"}':
      return { content: variables.get('c'), agentId: variables.get('a'), userId: 'harness' };
    case '{content: $c, userId: "harness"}':
      return { content: variables.get('c'), userId: 'harness' };
    case '.content':
    case '.status':
    case '.valid':
    case '.totalEntries':
    case '.enabled':
    case '.success':
      return getPath(dataValue, filterText.slice(1));
    case '.error // empty':
      return getPath(dataValue, 'error') ?? '';
    case '.result // empty':
      return getPath(dataValue, 'result') ?? '';
    case '.[0]':
      return Array.isArray(dataValue) ? dataValue[0] : undefined;
    case '.catalog | length':
      return Array.isArray(dataValue?.catalog) ? dataValue.catalog.length : 0;
    case '.tools | length':
      return Array.isArray(dataValue?.tools) ? dataValue.tools.length : 0;
    case 'length':
      return Array.isArray(dataValue)
        ? dataValue.length
        : (dataValue && typeof dataValue === 'object')
          ? Object.keys(dataValue).length
          : 0;
    case '.catalog[] | select(.name=="shell_safe") | .risk': {
      const catalog = Array.isArray(dataValue?.catalog) ? dataValue.catalog : [];
      const match = catalog.find((item) => item && typeof item === 'object' && item.name === 'shell_safe');
      return match?.risk;
    }
    case '.tools[] | select(.name=="shell_safe") | .risk': {
      const tools = Array.isArray(dataValue?.tools) ? dataValue.tools : [];
      const match = tools.find((item) => item && typeof item === 'object' && item.name === 'shell_safe');
      return match?.risk;
    }
    case '.[] | "  LLM Provider: \\(.name) (\\(.type)) — model: \\(.model), locality: \\(.locality // "unknown")"': {
      if (!Array.isArray(dataValue)) return [];
      return dataValue.map((item) => {
        const record = (item && typeof item === 'object') ? item : {};
        const locality = record.locality ?? 'unknown';
        return `  LLM Provider: ${record.name} (${record.type}) — model: ${record.model}, locality: ${locality}`;
      });
    }
    default:
      throw new Error(`jq-lite does not support filter: ${filterText}`);
  }
}

function getPath(value, path) {
  if (!path) return value;
  const parts = path.split('.').filter(Boolean);
  let current = value;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

function isTruthyForExit(value) {
  if (Array.isArray(value)) return value.length > 0;
  return !(value === undefined || value === null || value === false || value === '');
}

function printResult(value, useRaw) {
  if (Array.isArray(value)) {
    for (const item of value) {
      printScalarOrJson(item, useRaw);
    }
    return;
  }
  printScalarOrJson(value, useRaw);
}

function printScalarOrJson(value, useRaw) {
  if (useRaw && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) {
    process.stdout.write(String(value));
    if (!String(value).endsWith('\n')) process.stdout.write('\n');
    return;
  }
  process.stdout.write(`${JSON.stringify(value ?? null)}\n`);
}
