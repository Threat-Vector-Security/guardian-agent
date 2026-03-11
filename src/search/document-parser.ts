/**
 * Document parser — extracts plain text from various file formats.
 *
 * Supports: plain text, markdown, HTML, PDF (optional), DOCX (optional).
 * PDF and DOCX parsing require optional peer dependencies (pdf-parse, mammoth).
 */

import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

export interface ParsedDocument {
  text: string;
  title: string | null;
  mimeType: string;
}

const MIME_MAP: Record<string, string> = {
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.json': 'application/json',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.xml': 'text/xml',
  '.csv': 'text/csv',
  '.tsv': 'text/tab-separated-values',
  '.log': 'text/plain',
  '.rst': 'text/x-rst',
  '.tex': 'text/x-tex',
  '.ts': 'text/typescript',
  '.js': 'text/javascript',
  '.py': 'text/x-python',
  '.rb': 'text/x-ruby',
  '.go': 'text/x-go',
  '.rs': 'text/x-rust',
  '.java': 'text/x-java',
  '.c': 'text/x-c',
  '.cpp': 'text/x-c++',
  '.h': 'text/x-c',
  '.sh': 'text/x-shellscript',
};

/** Infer MIME type from file extension. */
export function inferMimeType(filepath: string): string {
  return MIME_MAP[extname(filepath).toLowerCase()] ?? 'text/plain';
}

/** Extract a title from the first heading or first line of text. */
function extractTitle(text: string, mimeType: string): string | null {
  if (mimeType === 'text/markdown' || mimeType === 'text/x-rst') {
    const match = text.match(/^#{1,3}\s+(.+)/m);
    if (match) return match[1].trim();
  }
  if (mimeType === 'text/html') {
    const match = text.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (match) return match[1].trim();
  }
  // Fall back to first non-empty line
  const firstLine = text.split('\n').find(l => l.trim().length > 0);
  return firstLine ? firstLine.trim().slice(0, 200) : null;
}

/** Strip HTML tags, decode common entities, collapse whitespace. */
function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Try to dynamically import an optional dependency. */
async function tryImport<T>(pkg: string): Promise<T | null> {
  try {
    return (await import(pkg)) as T;
  } catch {
    return null;
  }
}

/** Parse a document file into plain text. */
export async function parseDocument(filepath: string): Promise<ParsedDocument> {
  const mimeType = inferMimeType(filepath);

  if (mimeType === 'application/pdf') {
    return parsePdf(filepath, mimeType);
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return parseDocx(filepath, mimeType);
  }

  // All text-based formats: read as UTF-8
  const raw = await readFile(filepath, 'utf-8');
  let text = raw;

  // Extract title before stripping (HTML title tag is lost after strip)
  const title = extractTitle(raw, mimeType);

  if (mimeType === 'text/html') {
    text = stripHtml(raw);
  }

  return {
    text,
    title: title ?? extractTitle(text, mimeType),
    mimeType,
  };
}

/** Parse PDF using optional pdf-parse dependency. */
async function parsePdf(filepath: string, mimeType: string): Promise<ParsedDocument> {
  const pdfParse = await tryImport<{ default: (buf: Buffer) => Promise<{ text: string; info?: { Title?: string } }> }>('pdf-parse');
  if (!pdfParse) {
    throw new Error('PDF parsing requires the "pdf-parse" package. Install it with: npm install pdf-parse');
  }
  const buf = await readFile(filepath);
  const result = await pdfParse.default(buf);
  return {
    text: result.text,
    title: result.info?.Title ?? extractTitle(result.text, mimeType),
    mimeType,
  };
}

/** Parse DOCX using optional mammoth dependency. */
async function parseDocx(filepath: string, mimeType: string): Promise<ParsedDocument> {
  const mammoth = await tryImport<{ extractRawText: (opts: { path: string }) => Promise<{ value: string }> }>('mammoth');
  if (!mammoth) {
    throw new Error('DOCX parsing requires the "mammoth" package. Install it with: npm install mammoth');
  }
  const result = await mammoth.extractRawText({ path: filepath });
  return {
    text: result.value,
    title: extractTitle(result.value, mimeType),
    mimeType,
  };
}
