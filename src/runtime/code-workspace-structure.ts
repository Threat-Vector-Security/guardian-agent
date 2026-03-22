import { existsSync, readFileSync } from 'node:fs';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import ts from 'typescript';

const MAX_FILE_BYTES = 400_000;
const MAX_EXCERPT_LINES = 4;
const LARGE_FILE_SECTION_MAX_LINES = 220;
const LARGE_FILE_SECTION_MIN_ANCHOR_GAP = 36;
const LARGE_FILE_SECTION_BOUNDARY_SEARCH = 18;
const SUPPORTED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
]);

export type CodeWorkspaceStructureSymbolKind =
  | 'function'
  | 'component'
  | 'class'
  | 'method'
  | 'interface'
  | 'type'
  | 'variable';

export interface CodeWorkspaceStructureRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface CodeWorkspaceStructureSymbol {
  id: string;
  name: string;
  qualifiedName: string;
  kind: CodeWorkspaceStructureSymbolKind;
  parentId: string | null;
  exported: boolean;
  async: boolean;
  range: CodeWorkspaceStructureRange;
  lineCount: number;
  signature: string;
  summary: string;
  excerpt: string;
  params: string[];
  returnHint: string;
  sideEffects: string[];
  trustBoundaryTags: string[];
  qualityNotes: string[];
  securityNotes: string[];
  callees: string[];
  callers: string[];
}

export interface CodeWorkspaceStructureSection {
  id: string;
  title: string;
  summary: string;
  kind: 'anchor' | 'window';
  range: CodeWorkspaceStructureRange;
  lineCount: number;
}

export interface CodeWorkspaceStructureFile {
  path: string;
  language: string;
  supported: boolean;
  summary: string;
  provenance: 'deterministic_ast';
  analyzedAt: number;
  importSources: string[];
  exports: string[];
  symbols: CodeWorkspaceStructureSymbol[];
  analysisMode?: 'full' | 'sectioned';
  fileBytes?: number;
  totalLines?: number;
  sections?: CodeWorkspaceStructureSection[];
  selectedSectionId?: string | null;
  selectedLine?: number | null;
  unsupportedReason?: string;
}

export interface CodeWorkspaceStructureInspectOptions {
  lineNumber?: number;
  sectionId?: string | null;
}

interface SymbolDraft {
  id: string;
  name: string;
  qualifiedName: string;
  kind: CodeWorkspaceStructureSymbolKind;
  node: ts.Node;
  parentId: string | null;
  exported: boolean;
  async: boolean;
  range: CodeWorkspaceStructureRange;
  lineCount: number;
  signature: string;
  summary: string;
  excerpt: string;
  params: string[];
  returnHint: string;
  sideEffects: Set<string>;
  trustBoundaryTags: Set<string>;
  qualityNotes: Set<string>;
  securityNotes: Set<string>;
  callNames: Set<string>;
  callerIds: Set<string>;
  calleeIds: Set<string>;
}

function normalizeWorkspaceRelativePath(workspaceRoot: string, filePath: string): string {
  const absolutePath = isAbsolute(filePath) ? resolve(filePath) : resolve(workspaceRoot, filePath);
  const relativePath = relative(resolve(workspaceRoot), absolutePath);
  if (!relativePath || relativePath === '') return '.';
  return relativePath.replace(/\\/g, '/');
}

function isSupportedStructureExtension(filePath: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extname(filePath).toLowerCase());
}

function detectScriptKind(filePath: string): ts.ScriptKind {
  switch (extname(filePath).toLowerCase()) {
    case '.tsx':
      return ts.ScriptKind.TSX;
    case '.ts':
    case '.mts':
    case '.cts':
      return ts.ScriptKind.TS;
    case '.jsx':
      return ts.ScriptKind.JSX;
    case '.js':
    case '.mjs':
    case '.cjs':
      return ts.ScriptKind.JS;
    default:
      return ts.ScriptKind.Unknown;
  }
}

function buildRange(sourceFile: ts.SourceFile, node: ts.Node): CodeWorkspaceStructureRange {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
  return {
    startLine: start.line + 1,
    startColumn: start.character + 1,
    endLine: end.line + 1,
    endColumn: end.character + 1,
  };
}

function buildLineRange(startLine: number, endLine: number): CodeWorkspaceStructureRange {
  return {
    startLine,
    startColumn: 1,
    endLine: Math.max(startLine, endLine),
    endColumn: 1,
  };
}

function offsetRange(range: CodeWorkspaceStructureRange, lineOffset: number): CodeWorkspaceStructureRange {
  return {
    startLine: range.startLine + lineOffset,
    startColumn: range.startColumn,
    endLine: range.endLine + lineOffset,
    endColumn: range.endColumn,
  };
}

function getNodeName(node: ts.Node): string {
  if ('name' in node) {
    const namedNode = node as ts.Node & { name?: ts.Node };
    if (namedNode.name && ts.isIdentifier(namedNode.name)) return namedNode.name.text;
    if (namedNode.name && ts.isStringLiteral(namedNode.name)) return namedNode.name.text;
    if (namedNode.name && ts.isNumericLiteral(namedNode.name)) return namedNode.name.text;
    if (namedNode.name && ts.isComputedPropertyName(namedNode.name)) {
      return namedNode.name.expression.getText();
    }
  }
  return '';
}

function isAsyncNode(node: ts.Node): boolean {
  if (!('modifiers' in node)) return false;
  const declaration = node as ts.Node & { modifiers?: ts.NodeArray<ts.ModifierLike> };
  return declaration.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
}

function hasExportModifier(node: ts.Node): boolean {
  const declaration = node as ts.Node & { modifiers?: ts.NodeArray<ts.ModifierLike> };
  return declaration.modifiers?.some((modifier) => (
    modifier.kind === ts.SyntaxKind.ExportKeyword
    || modifier.kind === ts.SyntaxKind.DefaultKeyword
  )) ?? false;
}

function isNodeExported(node: ts.Node): boolean {
  if (hasExportModifier(node)) return true;
  if (ts.isVariableDeclaration(node) && ts.isVariableDeclarationList(node.parent) && ts.isVariableStatement(node.parent.parent)) {
    return hasExportModifier(node.parent.parent);
  }
  return false;
}

function isJsxNode(node: ts.Node): boolean {
  let found = false;
  const visit = (current: ts.Node) => {
    if (found) return;
    if (
      ts.isJsxElement(current)
      || ts.isJsxSelfClosingElement(current)
      || ts.isJsxFragment(current)
    ) {
      found = true;
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
}

function getFunctionNodeFromVariableDeclaration(node: ts.VariableDeclaration): ts.FunctionLikeDeclarationBase | null {
  if (!node.initializer) return null;
  if (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) {
    return node.initializer;
  }
  return null;
}

function isExtractableSymbolNode(node: ts.Node): boolean {
  if (ts.isFunctionDeclaration(node) && !!node.name) return true;
  if (ts.isClassDeclaration(node) && !!node.name) return true;
  if (ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
    return !!getNodeName(node);
  }
  if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
    return !!node.name?.text;
  }
  if (ts.isVariableDeclaration(node)) {
    return !!getNodeName(node) && !!getFunctionNodeFromVariableDeclaration(node);
  }
  return false;
}

function kindLabel(kind: CodeWorkspaceStructureSymbolKind): string {
  switch (kind) {
    case 'component':
      return 'UI component';
    case 'function':
      return 'function';
    case 'class':
      return 'class';
    case 'method':
      return 'method';
    case 'interface':
      return 'interface';
    case 'type':
      return 'type alias';
    case 'variable':
      return 'callable variable';
    default:
      return 'symbol';
  }
}

function buildExcerpt(sourceFile: ts.SourceFile, node: ts.Node): string {
  return node.getText(sourceFile)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_EXCERPT_LINES)
    .join('\n');
}

function toLanguageLabel(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case '.ts':
    case '.mts':
    case '.cts':
      return 'TypeScript';
    case '.tsx':
      return 'TypeScript React';
    case '.jsx':
      return 'JavaScript React';
    case '.js':
    case '.mjs':
    case '.cjs':
      return 'JavaScript';
    default:
      return 'Code';
  }
}

function getReturnHint(node: ts.Node, name: string): string {
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
    if (node.type) return node.type.getText();
    if (isJsxNode(node) || /^[A-Z]/.test(name)) return 'JSX';
    if (isAsyncNode(node)) return 'Promise';
  }
  if (ts.isVariableDeclaration(node)) {
    const fn = getFunctionNodeFromVariableDeclaration(node);
    if (!fn) return '';
    if (fn.type) return fn.type.getText();
    if (isJsxNode(fn) || /^[A-Z]/.test(name)) return 'JSX';
    if (isAsyncNode(fn)) return 'Promise';
  }
  return '';
}

function summarizeFunctionLike(
  name: string,
  kind: CodeWorkspaceStructureSymbolKind,
  exported: boolean,
  asyncFlag: boolean,
  params: string[],
  returnHint: string,
): string {
  const subject = `${exported ? 'Exported ' : ''}${asyncFlag ? 'async ' : ''}${kindLabel(kind)} \`${name}\``;
  const input = params.length > 0
    ? `accepts ${params.length === 1 ? `1 parameter (${params[0]})` : `${params.length} parameters (${params.slice(0, 4).join(', ')})`}`
    : 'takes no parameters';
  const output = returnHint ? ` and returns ${returnHint}` : '';
  return `${subject} ${input}${output}.`;
}

function buildSignature(node: ts.Node, name: string, params: string[], returnHint: string, asyncFlag: boolean): string {
  if (ts.isClassDeclaration(node)) {
    return `class ${name}`;
  }
  if (ts.isInterfaceDeclaration(node)) {
    return `interface ${name}`;
  }
  if (ts.isTypeAliasDeclaration(node)) {
    return `type ${name}`;
  }
  if (ts.isVariableDeclaration(node)) {
    const prefix = asyncFlag ? 'async ' : '';
    return `${prefix}${name}(${params.join(', ')})${returnHint ? `: ${returnHint}` : ''}`;
  }
  if (
    ts.isFunctionDeclaration(node)
    || ts.isMethodDeclaration(node)
    || ts.isGetAccessorDeclaration(node)
    || ts.isSetAccessorDeclaration(node)
  ) {
    const prefix = asyncFlag ? 'async ' : '';
    return `${prefix}${name}(${params.join(', ')})${returnHint ? `: ${returnHint}` : ''}`;
  }
  return name;
}

function collectParams(node: ts.Node): string[] {
  const fromParameterList = (parameters: readonly ts.ParameterDeclaration[]): string[] => (
    parameters
      .map((param) => param.name.getText())
      .filter(Boolean)
  );
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
    return fromParameterList(node.parameters);
  }
  if (ts.isVariableDeclaration(node)) {
    const fn = getFunctionNodeFromVariableDeclaration(node);
    return fn ? fromParameterList(fn.parameters) : [];
  }
  return [];
}

function getBodyNode(node: ts.Node): ts.Node | null {
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
    return node.body ?? null;
  }
  if (ts.isVariableDeclaration(node)) {
    return getFunctionNodeFromVariableDeclaration(node)?.body ?? null;
  }
  return node;
}

function collectBranchingSignals(node: ts.Node): number {
  let count = 0;
  const visit = (current: ts.Node) => {
    if (current !== node && isExtractableSymbolNode(current)) return;
    if (
      ts.isIfStatement(current)
      || ts.isConditionalExpression(current)
      || ts.isForStatement(current)
      || ts.isForInStatement(current)
      || ts.isForOfStatement(current)
      || ts.isWhileStatement(current)
      || ts.isDoStatement(current)
      || ts.isCaseClause(current)
      || ts.isCatchClause(current)
      || ts.isSwitchStatement(current)
    ) {
      count += 1;
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return count;
}

function collectAnalysisSignals(node: ts.Node, sourceFile: ts.SourceFile, params: string[]) {
  const sideEffects = new Set<string>();
  const trustBoundaryTags = new Set<string>();
  const qualityNotes = new Set<string>();
  const securityNotes = new Set<string>();
  const callNames = new Set<string>();
  const bodyNode = getBodyNode(node) ?? node;
  const lineCount = buildRange(sourceFile, node).endLine - buildRange(sourceFile, node).startLine + 1;
  const branchCount = collectBranchingSignals(bodyNode);

  if (params.length >= 5) {
    qualityNotes.add('This symbol accepts many parameters. Consider grouping related inputs.');
  }
  if (lineCount >= 80) {
    qualityNotes.add('This symbol spans more than 80 lines. Consider splitting responsibilities.');
  } else if (lineCount >= 45) {
    qualityNotes.add('This symbol is moderately large. Review whether some logic can move into helpers.');
  }
  if (branchCount >= 6) {
    qualityNotes.add('This symbol contains dense branching logic. Edge cases may be harder to reason about.');
  }

  const inspectCallExpression = (call: ts.CallExpression | ts.NewExpression) => {
    const callee = call.expression.getText(sourceFile);
    const simpleName = ts.isPropertyAccessExpression(call.expression)
      ? call.expression.name.text
      : ts.isIdentifier(call.expression)
        ? call.expression.text
        : callee;
    callNames.add(simpleName);

    if (/^(fetch|axios|request|got)$/.test(simpleName) || /\b(fetch|axios|http|https)\b/.test(callee)) {
      sideEffects.add('network');
      trustBoundaryTags.add('outbound-network');
      if (params.some((param) => /\b(url|uri|endpoint|host|domain|path)\b/i.test(param))) {
        securityNotes.add('Outbound request target appears to depend on parameters. Review allowlists and validation.');
      }
    }

    if (/^(readFile|readFileSync|writeFile|writeFileSync|appendFile|appendFileSync|mkdir|mkdirSync|rm|rmSync|readdir|readdirSync|stat|statSync)$/.test(simpleName) || /\bfs\./.test(callee)) {
      sideEffects.add('filesystem');
      trustBoundaryTags.add('filesystem');
      if (params.some((param) => /(path|file|dir|dest|src|target)/i.test(param))) {
        securityNotes.add('Filesystem access appears to depend on parameters. Constrain paths carefully.');
      }
    }

    if (/^(exec|execFile|spawn|fork)$/.test(simpleName) || /\b(child_process|execa)\b/.test(callee)) {
      sideEffects.add('process execution');
      trustBoundaryTags.add('process-execution');
      securityNotes.add('This symbol can execute processes or shell commands.');
    }

    if (/\b(prisma|sequelize|mongoose|knex)\b/.test(callee) || /^(query|execute|findMany|findFirst|insert|update|delete)$/.test(simpleName)) {
      sideEffects.add('database');
      trustBoundaryTags.add('data-store');
      const callArgs = call.arguments ?? [];
      if (callArgs.some((arg) => ts.isTemplateExpression(arg) || ts.isBinaryExpression(arg))) {
        securityNotes.add('Database or query-like calls use dynamic expression building. Review injection boundaries.');
      }
    }

    if (/^(setTimeout|setInterval|addEventListener|removeEventListener)$/.test(simpleName)) {
      sideEffects.add('timers/events');
    }

    if (/^console\./.test(callee) || simpleName.startsWith('console')) {
      sideEffects.add('logging');
    }
  };

  const visit = (current: ts.Node) => {
    if (current !== bodyNode && isExtractableSymbolNode(current)) return;

    if (ts.isCallExpression(current) || ts.isNewExpression(current)) {
      inspectCallExpression(current);
    }

    if (ts.isPropertyAccessExpression(current)) {
      const text = current.getText(sourceFile);
      if (text.startsWith('process.env')) {
        sideEffects.add('environment access');
        trustBoundaryTags.add('environment');
        securityNotes.add('This symbol reads environment-backed configuration or secrets.');
      }
      if (
        text.startsWith('localStorage')
        || text.startsWith('sessionStorage')
        || text === 'document.cookie'
        || text.startsWith('window.location')
      ) {
        sideEffects.add('browser state');
        trustBoundaryTags.add('browser-state');
        securityNotes.add('This symbol reads or writes browser-stored state. Review sensitive data handling.');
      }
      if (current.name.text === 'innerHTML' || current.name.text === 'outerHTML') {
        sideEffects.add('html injection surface');
        trustBoundaryTags.add('html-rendering');
        securityNotes.add('This symbol writes HTML directly. Review XSS handling and sanitization.');
      }
    }

    if (ts.isIdentifier(current) && current.text === 'eval') {
      securityNotes.add('This symbol uses eval. Avoid dynamic code execution where possible.');
    }

    if (ts.isJsxAttribute(current) && current.name.getText() === 'dangerouslySetInnerHTML') {
      sideEffects.add('html injection surface');
      trustBoundaryTags.add('html-rendering');
      securityNotes.add('This symbol uses dangerouslySetInnerHTML. Review content sanitization.');
    }

    if (ts.isNewExpression(current) && ts.isIdentifier(current.expression) && current.expression.text === 'Function') {
      securityNotes.add('This symbol constructs functions dynamically. Avoid dynamic code execution where possible.');
    }

    ts.forEachChild(current, visit);
  };
  visit(bodyNode);

  return {
    sideEffects,
    trustBoundaryTags,
    qualityNotes,
    securityNotes,
    callNames,
  };
}

function summarizeNonFunctionSymbol(
  name: string,
  kind: CodeWorkspaceStructureSymbolKind,
  exported: boolean,
  childCount: number,
): string {
  if (kind === 'class') {
    return `${exported ? 'Exported ' : ''}class \`${name}\` with ${childCount} ${childCount === 1 ? 'method' : 'methods'}.`;
  }
  if (kind === 'interface') {
    return `${exported ? 'Exported ' : ''}interface \`${name}\` describes a shared shape or contract.`;
  }
  if (kind === 'type') {
    return `${exported ? 'Exported ' : ''}type alias \`${name}\` defines a reusable type shape.`;
  }
  return `${exported ? 'Exported ' : ''}${kindLabel(kind)} \`${name}\`.`;
}

function getChildMethodCount(node: ts.Node): number {
  if (!ts.isClassDeclaration(node)) return 0;
  return node.members.filter((member) => ts.isMethodDeclaration(member) && !!getNodeName(member)).length;
}

function buildFileSummary(
  relativePath: string,
  language: string,
  importSources: string[],
  exports: string[],
  symbols: CodeWorkspaceStructureSymbol[],
): string {
  if (symbols.length === 0) {
    return `${language} file \`${relativePath}\` has no extractable symbols yet.`;
  }
  const kinds = Array.from(new Set(symbols.slice(0, 6).map((symbol) => kindLabel(symbol.kind))));
  const exportCopy = exports.length > 0 ? ` Exports: ${exports.slice(0, 5).join(', ')}.` : '';
  const importCopy = importSources.length > 0 ? ` Imports ${importSources.length} module${importSources.length === 1 ? '' : 's'}.` : '';
  return `${language} file \`${relativePath}\` exposes ${symbols.length} symbol${symbols.length === 1 ? '' : 's'} (${kinds.join(', ')}).${importCopy}${exportCopy}`;
}

function buildDraftFromNode(
  sourceFile: ts.SourceFile,
  node: ts.Node,
  parentQualifiedName: string | null,
  parentId: string | null,
): SymbolDraft | null {
  const name = getNodeName(node);
  if (!name) return null;

  let kind: CodeWorkspaceStructureSymbolKind = 'function';
  if (ts.isClassDeclaration(node)) kind = 'class';
  else if (ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) kind = 'method';
  else if (ts.isInterfaceDeclaration(node)) kind = 'interface';
  else if (ts.isTypeAliasDeclaration(node)) kind = 'type';
  else if (ts.isVariableDeclaration(node)) kind = 'variable';

  const params = collectParams(node);
  const asyncFlag = isAsyncNode(node) || (ts.isVariableDeclaration(node) && !!getFunctionNodeFromVariableDeclaration(node) && isAsyncNode(getFunctionNodeFromVariableDeclaration(node)!));
  const returnHint = getReturnHint(node, name);
  if (
    (kind === 'function' || kind === 'variable')
    && /^[A-Z]/.test(name)
    && (returnHint === 'JSX' || isJsxNode(ts.isVariableDeclaration(node) ? (getFunctionNodeFromVariableDeclaration(node) ?? node) : node))
  ) {
    kind = 'component';
  }

  const qualifiedName = parentQualifiedName ? `${parentQualifiedName}.${name}` : name;
  const range = buildRange(sourceFile, node);
  const analysis = collectAnalysisSignals(node, sourceFile, params);
  const childMethodCount = getChildMethodCount(node);
  const summary = kind === 'class' || kind === 'interface' || kind === 'type'
    ? summarizeNonFunctionSymbol(name, kind, isNodeExported(node), childMethodCount)
    : summarizeFunctionLike(name, kind, isNodeExported(node), asyncFlag, params, returnHint);
  const signature = buildSignature(node, name, params, returnHint, asyncFlag);
  const id = `${qualifiedName}:${range.startLine}:${range.startColumn}`;

  return {
    id,
    name,
    qualifiedName,
    kind,
    node,
    parentId,
    exported: isNodeExported(node),
    async: asyncFlag,
    range,
    lineCount: range.endLine - range.startLine + 1,
    signature,
    summary,
    excerpt: buildExcerpt(sourceFile, node),
    params,
    returnHint,
    sideEffects: analysis.sideEffects,
    trustBoundaryTags: analysis.trustBoundaryTags,
    qualityNotes: analysis.qualityNotes,
    securityNotes: analysis.securityNotes,
    callNames: analysis.callNames,
    callerIds: new Set<string>(),
    calleeIds: new Set<string>(),
  };
}

function collectImportSources(sourceFile: ts.SourceFile): string[] {
  return sourceFile.statements
    .filter((statement): statement is ts.ImportDeclaration => ts.isImportDeclaration(statement))
    .map((statement) => statement.moduleSpecifier)
    .filter(ts.isStringLiteral)
    .map((specifier) => specifier.text)
    .filter(Boolean);
}

function collectExportNames(sourceFile: ts.SourceFile, symbols: SymbolDraft[]): string[] {
  const exports = new Set<string>();
  for (const symbol of symbols) {
    if (symbol.exported && !symbol.parentId) exports.add(symbol.name);
  }
  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      statement.exportClause.elements.forEach((element) => exports.add(element.name.text));
    }
  }
  return [...exports];
}

function countLeadingWhitespace(line: string): number {
  let count = 0;
  for (const char of line) {
    if (char === ' ') {
      count += 1;
      continue;
    }
    if (char === '\t') {
      count += 2;
      continue;
    }
    break;
  }
  return count;
}

function humanizeSectionTitle(name: string): string {
  return name
    .replace(/\s+/g, ' ')
    .trim();
}

function matchLargeFileSectionAnchor(line: string): { title: string; kind: 'anchor' | 'window' } | null {
  const indent = countLeadingWhitespace(line);
  const trimmed = line.trim();
  if (!trimmed) return null;

  const sectionComment = trimmed.match(/^\/\/\s*[─-]{2,}\s*(.+?)\s*[─-]*$/);
  if (sectionComment?.[1]) {
    return { title: humanizeSectionTitle(sectionComment[1]), kind: 'anchor' };
  }

  if (indent > 2) return null;

  const patterns: Array<[RegExp, string]> = [
    [/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/, 'Function'],
    [/^(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/, 'Class'],
    [/^(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/, 'Interface'],
    [/^(?:export\s+)?type\s+([A-Za-z_$][\w$]*)/, 'Type'],
    [/^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/, 'Callable'],
    [/^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*function\b/, 'Callable'],
    [/^([A-Za-z_$][\w$.]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/, 'Callback'],
    [/^([A-Za-z_$][\w$.]*)\s*=\s*function\b/, 'Callback'],
  ];

  for (const [pattern, label] of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      return { title: `${label} ${humanizeSectionTitle(match[1])}`, kind: 'anchor' };
    }
  }

  return null;
}

function findSoftSectionEnd(lines: string[], startLine: number, endLine: number): number {
  if (endLine <= startLine) return endLine;
  const backwardLimit = Math.max(startLine + 24, endLine - LARGE_FILE_SECTION_BOUNDARY_SEARCH);
  for (let lineNumber = endLine; lineNumber >= backwardLimit; lineNumber -= 1) {
    const trimmed = (lines[lineNumber - 1] || '').trim();
    if (!trimmed || /^\/\//.test(trimmed)) {
      return lineNumber;
    }
  }
  const forwardLimit = Math.min(lines.length, endLine + LARGE_FILE_SECTION_BOUNDARY_SEARCH);
  for (let lineNumber = endLine + 1; lineNumber <= forwardLimit; lineNumber += 1) {
    const trimmed = (lines[lineNumber - 1] || '').trim();
    if (!trimmed || /^\/\//.test(trimmed)) {
      return lineNumber;
    }
  }
  return endLine;
}

function buildLargeFileSectionSummary(title: string, startLine: number, endLine: number): string {
  return `${title} covers lines ${startLine}-${endLine}. Inspect this slice instead of parsing the full file at once.`;
}

function appendLargeFileSection(
  lines: string[],
  sections: CodeWorkspaceStructureSection[],
  title: string,
  kind: 'anchor' | 'window',
  startLine: number,
  endLine: number,
): void {
  let cursor = startLine;
  let part = 1;
  while (cursor <= endLine) {
    let segmentEnd = Math.min(endLine, cursor + LARGE_FILE_SECTION_MAX_LINES - 1);
    if (segmentEnd < endLine) {
      segmentEnd = findSoftSectionEnd(lines, cursor, segmentEnd);
    }
    const sectionTitle = part === 1 ? title : `${title} (cont. ${part})`;
    sections.push({
      id: `section-${sections.length + 1}`,
      title: sectionTitle,
      summary: buildLargeFileSectionSummary(sectionTitle, cursor, segmentEnd),
      kind: part === 1 ? kind : 'window',
      range: buildLineRange(cursor, segmentEnd),
      lineCount: segmentEnd - cursor + 1,
    });
    cursor = segmentEnd + 1;
    part += 1;
  }
}

function buildLargeFileSections(sourceText: string): CodeWorkspaceStructureSection[] {
  const lines = sourceText.split(/\r?\n/);
  const totalLines = lines.length;
  const anchors: Array<{ lineNumber: number; title: string; kind: 'anchor' | 'window' }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const anchor = matchLargeFileSectionAnchor(lines[index] || '');
    if (!anchor) continue;
    const lineNumber = index + 1;
    const previous = anchors[anchors.length - 1];
    if (previous && lineNumber - previous.lineNumber < LARGE_FILE_SECTION_MIN_ANCHOR_GAP) continue;
    anchors.push({ lineNumber, title: anchor.title, kind: anchor.kind });
  }

  if (anchors.length === 0) {
    const sections: CodeWorkspaceStructureSection[] = [];
    let cursor = 1;
    let index = 1;
    while (cursor <= totalLines) {
      const suggestedEnd = Math.min(totalLines, cursor + LARGE_FILE_SECTION_MAX_LINES - 1);
      const endLine = suggestedEnd < totalLines
        ? findSoftSectionEnd(lines, cursor, suggestedEnd)
        : suggestedEnd;
      const title = index === 1 ? 'File start and setup' : `Window ${index}`;
      sections.push({
        id: `section-${sections.length + 1}`,
        title,
        summary: buildLargeFileSectionSummary(title, cursor, endLine),
        kind: 'window',
        range: buildLineRange(cursor, endLine),
        lineCount: endLine - cursor + 1,
      });
      cursor = endLine + 1;
      index += 1;
    }
    return sections;
  }

  if (anchors[0]!.lineNumber > 1) {
    anchors.unshift({
      lineNumber: 1,
      title: 'Imports and file setup',
      kind: 'window',
    });
  }

  const sections: CodeWorkspaceStructureSection[] = [];
  for (let index = 0; index < anchors.length; index += 1) {
    const anchor = anchors[index]!;
    const nextStartLine = anchors[index + 1]?.lineNumber ?? (totalLines + 1);
    const startLine = anchor.lineNumber;
    const endLine = Math.max(startLine, nextStartLine - 1);
    appendLargeFileSection(lines, sections, anchor.title, anchor.kind, startLine, endLine);
  }
  return sections;
}

function resolveSelectedLargeFileSection(
  sections: CodeWorkspaceStructureSection[],
  options: CodeWorkspaceStructureInspectOptions,
): CodeWorkspaceStructureSection {
  const requestedSectionId = typeof options.sectionId === 'string' ? options.sectionId.trim() : '';
  if (requestedSectionId) {
    const requestedSection = sections.find((section) => section.id === requestedSectionId);
    if (requestedSection) return requestedSection;
  }
  const preferredLine = Number(options.lineNumber) || 0;
  if (preferredLine > 0) {
    const lineMatch = sections.find((section) => (
      section.range.startLine <= preferredLine && section.range.endLine >= preferredLine
    ));
    if (lineMatch) return lineMatch;
  }
  return sections[0]!;
}

function offsetStructureSymbols(symbols: CodeWorkspaceStructureSymbol[], lineOffset: number): CodeWorkspaceStructureSymbol[] {
  return symbols.map((symbol) => ({
    ...symbol,
    range: offsetRange(symbol.range, lineOffset),
  }));
}

function buildSectionedFileSummary(
  relativePath: string,
  selectedSection: CodeWorkspaceStructureSection,
  sectionResult: CodeWorkspaceStructureFile,
): string {
  const sectionScope = `${selectedSection.title} (lines ${selectedSection.range.startLine}-${selectedSection.range.endLine})`;
  if (!Array.isArray(sectionResult.symbols) || sectionResult.symbols.length === 0) {
    return `Large file \`${relativePath}\` is inspected one section at a time. Current scope: ${sectionScope}. No extractable symbols were found in this slice yet.`;
  }
  const topNames = sectionResult.symbols
    .filter((symbol) => !symbol.parentId)
    .slice(0, 4)
    .map((symbol) => symbol.name);
  const nameCopy = topNames.length > 0 ? ` Key entries here: ${topNames.join(', ')}.` : '';
  return `Large file \`${relativePath}\` is inspected one section at a time. Current scope: ${sectionScope}. This slice exposes ${sectionResult.symbols.length} symbol${sectionResult.symbols.length === 1 ? '' : 's'}.${nameCopy}`;
}

function buildStructureInspectionResult(
  workspaceRoot: string,
  absolutePath: string,
  sourceText: string,
  now: number,
  options: CodeWorkspaceStructureInspectOptions = {},
): CodeWorkspaceStructureFile {
  const relativePath = normalizeWorkspaceRelativePath(workspaceRoot, absolutePath);
  const language = toLanguageLabel(absolutePath);
  const fileBytes = Buffer.byteLength(sourceText, 'utf-8');
  const sourceLines = sourceText.split(/\r?\n/);
  const totalLines = sourceLines.length;
  const selectedLine = Number(options.lineNumber) > 0 ? Number(options.lineNumber) : null;

  if (fileBytes > MAX_FILE_BYTES) {
    const sections = buildLargeFileSections(sourceText);
    if (sections.length === 1 && sections[0]!.range.startLine === 1 && sections[0]!.range.endLine === totalLines) {
      return {
        path: relativePath,
        language,
        supported: false,
        summary: `\`${relativePath}\` is too large and too dense for fast sectioned inspection. Move the cursor into a smaller extracted helper or save a narrower working file first.`,
        provenance: 'deterministic_ast',
        analyzedAt: now,
        importSources: [],
        exports: [],
        symbols: [],
        analysisMode: 'sectioned',
        fileBytes,
        totalLines,
        sections,
        selectedSectionId: sections[0]!.id,
        selectedLine,
        unsupportedReason: 'file_too_large',
      };
    }
    const selectedSection = resolveSelectedLargeFileSection(sections, options);
    const sectionLines = sourceLines
      .slice(selectedSection.range.startLine - 1, selectedSection.range.endLine)
      .join('\n');
    const sectionResult = buildStructureInspectionResult(
      workspaceRoot,
      absolutePath,
      sectionLines,
      now,
      {},
    );
    return {
      path: relativePath,
      language,
      supported: true,
      summary: buildSectionedFileSummary(relativePath, selectedSection, sectionResult),
      provenance: 'deterministic_ast',
      analyzedAt: now,
      importSources: sectionResult.importSources,
      exports: sectionResult.exports,
      symbols: offsetStructureSymbols(
        Array.isArray(sectionResult.symbols) ? sectionResult.symbols : [],
        selectedSection.range.startLine - 1,
      ),
      analysisMode: 'sectioned',
      fileBytes,
      totalLines,
      sections,
      selectedSectionId: selectedSection.id,
      selectedLine,
    };
  }

  const sourceFile = ts.createSourceFile(
    absolutePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    detectScriptKind(absolutePath),
  );

  const drafts: SymbolDraft[] = [];
  const visit = (node: ts.Node, parentQualifiedName: string | null, parentId: string | null) => {
    const draft = isExtractableSymbolNode(node)
      ? buildDraftFromNode(sourceFile, node, parentQualifiedName, parentId)
      : null;

    if (draft) {
      drafts.push(draft);
      ts.forEachChild(node, (child) => visit(child, draft.qualifiedName, draft.id));
      return;
    }
    ts.forEachChild(node, (child) => visit(child, parentQualifiedName, parentId));
  };
  visit(sourceFile, null, null);

  const nameIndex = new Map<string, SymbolDraft[]>();
  for (const draft of drafts) {
    const list = nameIndex.get(draft.name) ?? [];
    list.push(draft);
    nameIndex.set(draft.name, list);
  }

  for (const draft of drafts) {
    for (const callName of draft.callNames) {
      const matches = nameIndex.get(callName) ?? [];
      matches.forEach((match) => {
        if (match.id === draft.id) return;
        draft.calleeIds.add(match.qualifiedName);
        match.callerIds.add(draft.qualifiedName);
      });
    }
  }

  const exports = collectExportNames(sourceFile, drafts);
  const symbols = drafts
    .sort((left, right) => (
      left.range.startLine - right.range.startLine
      || left.range.startColumn - right.range.startColumn
    ))
    .map((draft) => ({
      id: draft.id,
      name: draft.name,
      qualifiedName: draft.qualifiedName,
      kind: draft.kind,
      parentId: draft.parentId,
      exported: draft.exported,
      async: draft.async,
      range: draft.range,
      lineCount: draft.lineCount,
      signature: draft.signature,
      summary: draft.summary,
      excerpt: draft.excerpt,
      params: draft.params,
      returnHint: draft.returnHint,
      sideEffects: [...draft.sideEffects],
      trustBoundaryTags: [...draft.trustBoundaryTags],
      qualityNotes: [...draft.qualityNotes],
      securityNotes: [...draft.securityNotes],
      callees: [...draft.calleeIds].sort((left, right) => left.localeCompare(right)),
      callers: [...draft.callerIds].sort((left, right) => left.localeCompare(right)),
    }));

  const importSources = collectImportSources(sourceFile);
  return {
    path: relativePath,
    language,
    supported: true,
    summary: buildFileSummary(relativePath, language, importSources, exports, symbols),
    provenance: 'deterministic_ast',
    analyzedAt: now,
    importSources,
    exports,
    symbols,
    analysisMode: 'full',
    fileBytes,
    totalLines,
    sections: [],
    selectedSectionId: null,
    selectedLine,
  };
}

export function inspectCodeWorkspaceFileStructureTextSync(
  workspaceRoot: string,
  filePath: string,
  sourceText: string,
  now = Date.now(),
  options: CodeWorkspaceStructureInspectOptions = {},
): CodeWorkspaceStructureFile {
  const absolutePath = isAbsolute(filePath) ? resolve(filePath) : resolve(workspaceRoot, filePath);
  const relativePath = normalizeWorkspaceRelativePath(workspaceRoot, absolutePath);
  const language = toLanguageLabel(absolutePath);

  if (!isSupportedStructureExtension(absolutePath)) {
    return {
      path: relativePath,
      language,
      supported: false,
      summary: `Structure inspection currently supports TypeScript and JavaScript files. \`${relativePath}\` is outside that set.`,
      provenance: 'deterministic_ast',
      analyzedAt: now,
      importSources: [],
      exports: [],
      symbols: [],
      unsupportedReason: 'unsupported_extension',
    };
  }

  return buildStructureInspectionResult(workspaceRoot, absolutePath, sourceText, now, options);
}

export function inspectCodeWorkspaceFileStructureSync(
  workspaceRoot: string,
  filePath: string,
  now = Date.now(),
  options: CodeWorkspaceStructureInspectOptions = {},
): CodeWorkspaceStructureFile {
  const absolutePath = isAbsolute(filePath) ? resolve(filePath) : resolve(workspaceRoot, filePath);
  const relativePath = normalizeWorkspaceRelativePath(workspaceRoot, absolutePath);
  const language = toLanguageLabel(absolutePath);

  if (!existsSync(absolutePath)) {
    return {
      path: relativePath,
      language,
      supported: false,
      summary: `File \`${relativePath}\` was not found.`,
      provenance: 'deterministic_ast',
      analyzedAt: now,
      importSources: [],
      exports: [],
      symbols: [],
      unsupportedReason: 'file_not_found',
    };
  }

  if (!isSupportedStructureExtension(absolutePath)) {
    return {
      path: relativePath,
      language,
      supported: false,
      summary: `Structure inspection currently supports TypeScript and JavaScript files. \`${relativePath}\` is outside that set.`,
      provenance: 'deterministic_ast',
      analyzedAt: now,
      importSources: [],
      exports: [],
      symbols: [],
      unsupportedReason: 'unsupported_extension',
    };
  }

  let sourceText = '';
  try {
    sourceText = readFileSync(absolutePath, 'utf-8');
  } catch {
    return {
      path: relativePath,
      language,
      supported: false,
      summary: `Unable to read \`${relativePath}\` for structure inspection.`,
      provenance: 'deterministic_ast',
      analyzedAt: now,
      importSources: [],
      exports: [],
      symbols: [],
      unsupportedReason: 'read_failed',
    };
  }

  return buildStructureInspectionResult(workspaceRoot, absolutePath, sourceText, now, options);
}
