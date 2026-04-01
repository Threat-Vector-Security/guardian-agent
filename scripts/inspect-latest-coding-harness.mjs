import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HARNESS_PREFIX = 'guardian-coding-harness-';
const DEFAULT_LINES = 120;
const VALID_FILE_OPTIONS = new Set(['both', 'guardian.log', 'guardian.log.err']);

function printHelp() {
  console.log([
    'Inspect latest coding harness temp artifacts',
    '',
    'Usage:',
    '  node scripts/inspect-latest-coding-harness.mjs [options]',
    '',
    'Options:',
    '  --list <count>             List the most recent harness directories and exit.',
    '  --lines <count>            Number of trailing lines to print per log file. Default: 120.',
    '  --file <name>              one of: both, guardian.log, guardian.log.err. Default: both.',
    '  --path-only                Print only the latest harness directory path.',
    '  --help                     Show this help text.',
    '',
    'Examples:',
    '  node scripts/inspect-latest-coding-harness.mjs --list 3',
    '  node scripts/inspect-latest-coding-harness.mjs --file guardian.log.err --lines 120',
    '  node scripts/inspect-latest-coding-harness.mjs --path-only',
  ].join('\n'));
}

function parseInteger(value, fallback, label) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer. Received: ${value}`);
  }
  return parsed;
}

function parseOptions(argv) {
  const valueFor = (flag) => {
    const index = argv.indexOf(flag);
    if (index === -1) return '';
    return argv[index + 1] ?? '';
  };
  const hasFlag = (flag) => argv.includes(flag);

  if (hasFlag('--help')) {
    printHelp();
    process.exit(0);
  }

  const file = valueFor('--file') || 'both';
  if (!VALID_FILE_OPTIONS.has(file)) {
    throw new Error(`--file must be one of ${Array.from(VALID_FILE_OPTIONS).join(', ')}. Received: ${file}`);
  }

  return {
    list: parseInteger(valueFor('--list'), 0, '--list'),
    lines: parseInteger(valueFor('--lines'), DEFAULT_LINES, '--lines'),
    file,
    pathOnly: hasFlag('--path-only'),
  };
}

function findHarnessDirectories() {
  return fs.readdirSync(os.tmpdir(), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(HARNESS_PREFIX))
    .map((entry) => {
      const dirPath = path.join(os.tmpdir(), entry.name);
      const stats = fs.statSync(dirPath);
      return {
        path: dirPath,
        mtimeMs: stats.mtimeMs,
      };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs);
}

function tailLines(filePath, lineCount) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const normalizedLines = lines.length > 0 && lines[lines.length - 1] === ''
    ? lines.slice(0, -1)
    : lines;
  return normalizedLines.slice(-lineCount).join('\n');
}

function printLogSection(filePath, lineCount) {
  if (!fs.existsSync(filePath)) {
    console.log(`\n=== ${path.basename(filePath)} (missing) ===`);
    return;
  }

  console.log(`\n=== ${path.basename(filePath)} (${filePath}) ===`);
  const tailed = tailLines(filePath, lineCount);
  if (tailed) {
    console.log(tailed);
  }
}

function main() {
  const options = parseOptions(process.argv.slice(2));
  const harnessDirs = findHarnessDirectories();

  if (harnessDirs.length === 0) {
    throw new Error(`No ${HARNESS_PREFIX} directories found under ${os.tmpdir()}.`);
  }

  if (options.list > 0) {
    harnessDirs.slice(0, options.list).forEach((entry) => {
      console.log(entry.path);
    });
    return;
  }

  const latest = harnessDirs[0];
  if (options.pathOnly) {
    console.log(latest.path);
    return;
  }

  console.log(`Latest harness directory: ${latest.path}`);

  const files = options.file === 'both'
    ? ['guardian.log', 'guardian.log.err']
    : [options.file];

  files.forEach((fileName) => {
    printLogSection(path.join(latest.path, fileName), options.lines);
  });
}

try {
  main();
} catch (error) {
  console.error(`FAIL inspect latest coding harness: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
