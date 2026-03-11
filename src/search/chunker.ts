/**
 * Parent-child chunker — splits text into hierarchical chunks for search.
 *
 * Parent chunks provide context (paragraphs/sections), child chunks
 * provide precision (sentences). On search hit, the child's parent
 * context is returned alongside the matched snippet.
 */

export interface ChunkingConfig {
  parentTokens: number;
  childTokens: number;
  overlapTokens: number;
}

export interface RawChunk {
  content: string;
  startOffset: number;
  endOffset: number;
  tokenCount: number;
  chunkType: 'parent' | 'child';
  children?: RawChunk[];
}

const DEFAULT_CONFIG: ChunkingConfig = {
  parentTokens: 768,
  childTokens: 192,
  overlapTokens: 48,
};

/** Approximate token count (words / 0.75). Good enough without a real tokenizer. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).filter(Boolean).length / 0.75);
}

/** Split text on paragraph/section boundaries (double newline, headings). */
function splitIntoSections(text: string): string[] {
  // Split on double newline or markdown headings
  const sections = text.split(/\n{2,}|(?=^#{1,6}\s)/m);
  return sections.map(s => s.trim()).filter(s => s.length > 0);
}

/** Split text into sentences. */
function splitIntoSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by whitespace or end of string
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences.map(s => s.trim()).filter(s => s.length > 0);
}

/** Merge small segments until they reach the target token count. */
function mergeToTarget(
  segments: string[],
  targetTokens: number,
  overlapTokens: number,
  baseOffset: number,
): RawChunk[] {
  const chunks: RawChunk[] = [];
  let current = '';
  let currentStart = baseOffset;
  let prevTail = '';

  for (const segment of segments) {
    const combined = current ? current + '\n' + segment : segment;
    if (estimateTokens(combined) > targetTokens && current.length > 0) {
      // Emit current chunk
      chunks.push({
        content: current,
        startOffset: currentStart,
        endOffset: currentStart + current.length,
        tokenCount: estimateTokens(current),
        chunkType: 'parent',
      });
      // Overlap: carry the tail of the previous chunk
      prevTail = overlapTokens > 0 ? extractTail(current, overlapTokens) : '';
      currentStart = currentStart + current.length - prevTail.length;
      current = prevTail ? prevTail + '\n' + segment : segment;
    } else {
      current = combined;
    }
  }

  // Emit remaining
  if (current.length > 0) {
    chunks.push({
      content: current,
      startOffset: currentStart,
      endOffset: currentStart + current.length,
      tokenCount: estimateTokens(current),
      chunkType: 'parent',
    });
  }

  return chunks;
}

/** Extract the last N tokens worth of text from a string. */
function extractTail(text: string, tokens: number): string {
  const words = text.split(/\s+/);
  const wordCount = Math.ceil(tokens * 0.75);
  return words.slice(-wordCount).join(' ');
}

/** Create child chunks from a parent chunk's content. */
function createChildren(
  parent: RawChunk,
  childTokens: number,
  _overlapTokens: number,
): RawChunk[] {
  const sentences = splitIntoSentences(parent.content);
  if (sentences.length <= 1) {
    // Single sentence parent — child is the whole parent
    return [{
      content: parent.content,
      startOffset: parent.startOffset,
      endOffset: parent.endOffset,
      tokenCount: parent.tokenCount,
      chunkType: 'child',
    }];
  }

  const children: RawChunk[] = [];
  let current = '';
  let currentStart = parent.startOffset;

  for (const sentence of sentences) {
    const combined = current ? current + ' ' + sentence : sentence;
    if (estimateTokens(combined) > childTokens && current.length > 0) {
      children.push({
        content: current,
        startOffset: currentStart,
        endOffset: currentStart + current.length,
        tokenCount: estimateTokens(current),
        chunkType: 'child',
      });
      // Simple overlap for children: just start fresh (no overlap to keep them precise)
      currentStart = currentStart + current.length + 1;
      current = sentence;
    } else {
      current = combined;
    }
  }

  if (current.length > 0) {
    children.push({
      content: current,
      startOffset: currentStart,
      endOffset: currentStart + current.length,
      tokenCount: estimateTokens(current),
      chunkType: 'child',
    });
  }

  return children;
}

/**
 * Chunk text into parent-child hierarchy.
 *
 * Parents provide surrounding context, children provide search precision.
 * Each parent contains one or more children.
 */
export function chunkText(text: string, config?: Partial<ChunkingConfig>): RawChunk[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (text.trim().length === 0) return [];

  // Split into sections, then merge sections into parent-sized chunks
  const sections = splitIntoSections(text);
  const parents = mergeToTarget(sections, cfg.parentTokens, cfg.overlapTokens, 0);

  // Create child chunks within each parent
  for (const parent of parents) {
    parent.children = createChildren(parent, cfg.childTokens, cfg.overlapTokens);
  }

  return parents;
}

/** Flatten parent-child hierarchy into a flat list with parent references intact. */
export function flattenChunks(parents: RawChunk[]): Array<RawChunk & { parentIndex: number | null }> {
  const flat: Array<RawChunk & { parentIndex: number | null }> = [];
  for (let i = 0; i < parents.length; i++) {
    flat.push({ ...parents[i], children: undefined, parentIndex: null });
    if (parents[i].children) {
      for (const child of parents[i].children!) {
        flat.push({ ...child, parentIndex: i });
      }
    }
  }
  return flat;
}
