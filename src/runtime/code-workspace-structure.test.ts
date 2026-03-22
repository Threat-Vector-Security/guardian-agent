import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  inspectCodeWorkspaceFileStructureSync,
  inspectCodeWorkspaceFileStructureTextSync,
} from './code-workspace-structure.js';

const testDirs: string[] = [];

function createWorkspace(name: string, files: Record<string, string>): string {
  const root = join(tmpdir(), `guardianagent-workspace-structure-${name}-${randomUUID()}`);
  mkdirSync(root, { recursive: true });
  testDirs.push(root);
  for (const [relativePath, content] of Object.entries(files)) {
    const targetPath = join(root, relativePath);
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, content, 'utf-8');
  }
  return root;
}

function buildLargeSectionedSource(sectionCount = 10, linesPerSection = 260): { source: string; targetLine: number; targetName: string } {
  const lines: string[] = [];
  const pad = 'x'.repeat(170);
  let targetLine = 0;
  let targetName = '';

  for (let sectionIndex = 1; sectionIndex <= sectionCount; sectionIndex += 1) {
    lines.push(`// ---- Section ${sectionIndex} ----`);
    const functionName = `section${sectionIndex}Handler`;
    if (sectionIndex === Math.ceil(sectionCount / 2)) {
      targetLine = lines.length + 1;
      targetName = functionName;
    }
    lines.push(`export function ${functionName}(seed: number) {`);
    lines.push('  let total = seed;');
    for (let lineIndex = 0; lineIndex < linesPerSection; lineIndex += 1) {
      lines.push(`  total += ${lineIndex}; // ${pad}`);
    }
    lines.push('  return total;');
    lines.push('}');
    lines.push('');
  }

  return {
    source: lines.join('\n'),
    targetLine,
    targetName,
  };
}

afterEach(() => {
  for (const dir of testDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('code-workspace-structure', () => {
  it('extracts symbols, relationships, and summaries for TypeScript/React files', () => {
    const workspaceRoot = createWorkspace('tsx-symbols', {
      'src/App.tsx': [
        'import { fetchUser } from "./api";',
        '',
        'export function App() {',
        '  return <main>{renderBody()}</main>;',
        '}',
        '',
        'function renderBody() {',
        '  return <section>Ready</section>;',
        '}',
        '',
        'export class Controller {',
        '  loadUser(id: string) {',
        '    return fetchUser(id);',
        '  }',
        '}',
      ].join('\n'),
    });

    const result = inspectCodeWorkspaceFileStructureSync(workspaceRoot, join(workspaceRoot, 'src', 'App.tsx'), 123);
    expect(result.supported).toBe(true);
    expect(result.path).toBe('src/App.tsx');
    expect(result.summary).toContain('TypeScript React file');
    expect(result.importSources).toEqual(['./api']);

    const app = result.symbols.find((symbol) => symbol.name === 'App');
    const renderBody = result.symbols.find((symbol) => symbol.name === 'renderBody');
    const controller = result.symbols.find((symbol) => symbol.name === 'Controller');
    const loadUser = result.symbols.find((symbol) => symbol.qualifiedName === 'Controller.loadUser');

    expect(app?.kind).toBe('component');
    expect(app?.exported).toBe(true);
    expect(app?.returnHint).toBe('JSX');
    expect(app?.callees).toContain('renderBody');
    expect(renderBody?.callers).toContain('App');
    expect(controller?.kind).toBe('class');
    expect(loadUser?.kind).toBe('method');
    expect(loadUser?.callees).toEqual([]);
    expect(result.exports).toContain('App');
    expect(result.exports).toContain('Controller');
  });

  it('detects trust boundaries, quality signals, and security notes', () => {
    const workspaceRoot = createWorkspace('security-signals', {
      'src/run-task.ts': [
        'import { exec } from "node:child_process";',
        'import { writeFileSync } from "node:fs";',
        '',
        'export async function runTask(command: string, outputPath: string, url: string, retry: number, timeoutMs: number) {',
        '  process.env.API_KEY;',
        '  await fetch(url);',
        '  writeFileSync(outputPath, "done");',
        '  exec(command);',
        '  if (retry > 0) {',
        '    if (timeoutMs > 1000) {',
        '      console.log("retrying");',
        '    }',
        '  }',
        '}',
      ].join('\n'),
    });

    const result = inspectCodeWorkspaceFileStructureSync(workspaceRoot, 'src/run-task.ts', 456);
    const runTask = result.symbols.find((symbol) => symbol.name === 'runTask');

    expect(runTask).toBeTruthy();
    expect(runTask?.sideEffects).toContain('network');
    expect(runTask?.sideEffects).toContain('filesystem');
    expect(runTask?.sideEffects).toContain('process execution');
    expect(runTask?.trustBoundaryTags).toContain('outbound-network');
    expect(runTask?.trustBoundaryTags).toContain('filesystem');
    expect(runTask?.trustBoundaryTags).toContain('process-execution');
    expect(runTask?.qualityNotes.some((note) => /many parameters/i.test(note))).toBe(true);
    expect(runTask?.securityNotes.some((note) => /environment-backed configuration or secrets/i.test(note))).toBe(true);
    expect(runTask?.securityNotes.some((note) => /shell commands|execute processes/i.test(note))).toBe(true);
    expect(runTask?.securityNotes.some((note) => /Outbound request target/i.test(note))).toBe(true);
    expect(runTask?.securityNotes.some((note) => /Filesystem access appears to depend on parameters/i.test(note))).toBe(true);
  });

  it('returns an unsupported response for non-code files', () => {
    const workspaceRoot = createWorkspace('unsupported', {
      'README.md': '# Notes\n\nHello\n',
    });

    const result = inspectCodeWorkspaceFileStructureSync(workspaceRoot, 'README.md', 789);
    expect(result.supported).toBe(false);
    expect(result.symbols).toEqual([]);
    expect(result.unsupportedReason).toBe('unsupported_extension');
  });

  it('analyzes unsaved source text previews without requiring a disk write', () => {
    const workspaceRoot = createWorkspace('preview-source', {});

    const result = inspectCodeWorkspaceFileStructureTextSync(
      workspaceRoot,
      'src/live-preview.ts',
      [
        'export function getAnswer(seed: number) {',
        '  return seed + 1;',
        '}',
      ].join('\n'),
      999,
    );

    expect(result.supported).toBe(true);
    expect(result.path).toBe('src/live-preview.ts');
    expect(result.analyzedAt).toBe(999);
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0]).toMatchObject({
      name: 'getAnswer',
      params: ['seed'],
      summary: expect.stringContaining('accepts 1 parameter (seed)'),
    });
  });

  it('sections oversized files and anchors inspection to the requested line', () => {
    const { source, targetLine, targetName } = buildLargeSectionedSource();
    const workspaceRoot = createWorkspace('large-sections', {
      'src/huge.ts': source,
    });

    const result = inspectCodeWorkspaceFileStructureSync(
      workspaceRoot,
      join(workspaceRoot, 'src', 'huge.ts'),
      111,
      { lineNumber: targetLine },
    );

    expect(result.supported).toBe(true);
    expect(result.analysisMode).toBe('sectioned');
    expect(result.fileBytes).toBeGreaterThan(400_000);
    expect(result.sections.length).toBeGreaterThan(1);
    expect(result.selectedLine).toBe(targetLine);

    const selectedSection = result.sections.find((section) => section.id === result.selectedSectionId);
    expect(selectedSection).toBeTruthy();
    expect(selectedSection?.range.startLine).toBeLessThanOrEqual(targetLine);
    expect(selectedSection?.range.endLine).toBeGreaterThanOrEqual(targetLine);

    const targetSymbol = result.symbols.find((symbol) => symbol.name === targetName);
    expect(targetSymbol).toBeTruthy();
    expect(targetSymbol?.range.startLine).toBe(targetLine);
    expect(result.summary).toContain('one section at a time');
  });
});
