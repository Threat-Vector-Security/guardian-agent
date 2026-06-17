import { describe, expect, it } from 'vitest';
import { findFirstElementInnerHtml, findHtmlElementsByClass, htmlToText } from './html.js';

describe('html helpers', () => {
  it('extracts readable text and skips hidden/script content', () => {
    const html = '<h1>Hello&nbsp;there</h1><script>nope()</script><p hidden>skip</p><p>World</p>';

    expect(htmlToText(html, { skipTagContent: new Set(['script']) })).toBe('Hello there World');
  });

  it('finds elements by tag and class', () => {
    const html = '<main><a class="result result__a" href="/x">Title</a></main>';

    expect(findFirstElementInnerHtml(html, 'main')).toContain('Title');
    expect(findHtmlElementsByClass(html, 'result__a', 'a')).toEqual([
      { tagName: 'a', attributes: { class: 'result result__a', href: '/x' }, innerHtml: 'Title' },
    ]);
  });
});
