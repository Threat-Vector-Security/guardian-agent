import { describe, it, expect } from 'vitest';
import { chunkText, flattenChunks, estimateTokens } from './chunker.js';

describe('estimateTokens', () => {
  it('estimates tokens from word count', () => {
    const tokens = estimateTokens('hello world this is a test');
    expect(tokens).toBeGreaterThan(0);
    // 6 words / 0.75 = 8
    expect(tokens).toBe(8);
  });

  it('handles empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });
});

describe('chunkText', () => {
  it('returns empty array for empty text', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   ')).toEqual([]);
  });

  it('creates a single parent for short text', () => {
    const text = 'Hello world. This is a short paragraph.';
    const chunks = chunkText(text);
    expect(chunks.length).toBe(1);
    expect(chunks[0].chunkType).toBe('parent');
    expect(chunks[0].content).toBe(text);
  });

  it('creates children within parents', () => {
    const text = 'Hello world. This is a short paragraph.';
    const chunks = chunkText(text);
    expect(chunks[0].children).toBeDefined();
    expect(chunks[0].children!.length).toBeGreaterThan(0);
    expect(chunks[0].children![0].chunkType).toBe('child');
  });

  it('splits long text into multiple parents', () => {
    // Create text with multiple paragraphs that exceeds parentTokens
    const paragraphs = Array.from({ length: 20 }, (_, i) =>
      `This is paragraph number ${i + 1}. It contains several sentences of text. ` +
      `The purpose is to test chunking behavior with longer content. ` +
      `Each paragraph should contribute enough tokens to eventually exceed the limit.`
    );
    const text = paragraphs.join('\n\n');
    const chunks = chunkText(text, { parentTokens: 100, childTokens: 30, overlapTokens: 10 });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.chunkType).toBe('parent');
      expect(chunk.children).toBeDefined();
    }
  });

  it('preserves offsets', () => {
    const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
    const chunks = chunkText(text, { parentTokens: 5, childTokens: 3, overlapTokens: 0 });

    for (const chunk of chunks) {
      expect(chunk.startOffset).toBeGreaterThanOrEqual(0);
      expect(chunk.endOffset).toBeGreaterThan(chunk.startOffset);
    }
  });

  it('respects custom config', () => {
    // Use paragraphs separated by double newlines so they split into sections
    const text = Array.from({ length: 30 }, (_, i) =>
      `Paragraph ${i + 1} has several words of content for testing chunking behavior.`
    ).join('\n\n');
    const small = chunkText(text, { parentTokens: 20, childTokens: 5, overlapTokens: 0 });
    const large = chunkText(text, { parentTokens: 2000, childTokens: 500, overlapTokens: 0 });

    expect(small.length).toBeGreaterThan(large.length);
  });
});

describe('flattenChunks', () => {
  it('flattens parent-child hierarchy', () => {
    const text = 'First sentence here. Second sentence here. Third sentence here.';
    const parents = chunkText(text, { parentTokens: 100, childTokens: 5, overlapTokens: 0 });
    const flat = flattenChunks(parents);

    expect(flat.length).toBeGreaterThan(parents.length);
    const parentItems = flat.filter(f => f.parentIndex === null);
    const childItems = flat.filter(f => f.parentIndex !== null);
    expect(parentItems.length).toBe(parents.length);
    expect(childItems.length).toBeGreaterThan(0);
  });
});
