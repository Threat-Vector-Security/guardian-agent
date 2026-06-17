export type HtmlElement = {
  tagName: string;
  attributes: Record<string, string>;
  innerHtml: string;
};

export type HtmlTextOptions = {
  skipTagContent?: ReadonlySet<string>;
};

const BLOCK_HTML_TAGS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'body',
  'br',
  'dd',
  'details',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
]);

const VOID_HTML_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

export function htmlToText(value: string, options: HtmlTextOptions = {}): string {
  if (!value) return '';
  const skipTagContent = options.skipTagContent ?? new Set<string>();
  let text = '';
  const appendSeparator = () => {
    if (text && !/\s$/.test(text)) {
      text += ' ';
    }
  };
  let index = 0;
  while (index < value.length) {
    const ch = value[index];
    if (ch !== '<') {
      text += ch;
      index += 1;
      continue;
    }

    if (value.startsWith('<!--', index)) {
      const commentEnd = value.indexOf('-->', index + 4);
      index = commentEnd === -1 ? value.length : commentEnd + 3;
      appendSeparator();
      continue;
    }

    const tag = parseHtmlStartTag(value, index);
    if (!tag) {
      text += ch;
      index += 1;
      continue;
    }

    const tagName = tag.tagName.toLowerCase();
    if (!tag.isClosing && shouldSkipHtmlTag(tagName, tag.attributes, skipTagContent) && !VOID_HTML_TAGS.has(tagName)) {
      const close = findMatchingClosingTag(value, tagName, tag.startTagEnd + 1);
      index = close === -1 ? value.length : close + (`</${tagName}>`).length;
      appendSeparator();
      continue;
    }

    index = tag.startTagEnd + 1;
    if (BLOCK_HTML_TAGS.has(tagName)) {
      appendSeparator();
    }
  }

  return decodeHtmlEntities(text)
    .replace(/\s+/g, ' ')
    .trim();
}

export function findFirstElementInnerHtml(html: string, tagName: string): string | undefined {
  return findHtmlElementsByTagName(html, tagName)[0]?.innerHtml;
}

export function findHtmlElementsByClass(html: string, className: string, tagName?: string): HtmlElement[] {
  const classToken = className.trim();
  if (!classToken) return [];
  const matches: HtmlElement[] = [];
  let index = 0;
  while (index < html.length) {
    const open = html.indexOf('<', index);
    if (open === -1) break;
    const tag = parseHtmlStartTag(html, open);
    if (!tag) {
      index = open + 1;
      continue;
    }
    index = tag.startTagEnd + 1;
    if (tag.isClosing) continue;
    if (tagName && tag.tagName !== tagName) continue;
    const classAttr = tag.attributes.class;
    if (!classAttr || !classAttr.split(/\s+/).includes(classToken)) continue;
    if (VOID_HTML_TAGS.has(tag.tagName)) continue;
    const close = findMatchingClosingTag(html, tag.tagName, tag.startTagEnd + 1);
    if (close === -1) continue;
    matches.push({
      tagName: tag.tagName,
      attributes: tag.attributes,
      innerHtml: html.slice(tag.startTagEnd + 1, close),
    });
  }
  return matches;
}

function findHtmlElementsByTagName(html: string, tagName: string): HtmlElement[] {
  const normalizedTag = tagName.toLowerCase();
  const matches: HtmlElement[] = [];
  let index = 0;
  while (index < html.length) {
    const open = html.indexOf('<', index);
    if (open === -1) break;
    const tag = parseHtmlStartTag(html, open);
    if (!tag) {
      index = open + 1;
      continue;
    }
    index = tag.startTagEnd + 1;
    if (tag.isClosing || tag.tagName !== normalizedTag || VOID_HTML_TAGS.has(tag.tagName)) continue;
    const close = findMatchingClosingTag(html, tag.tagName, tag.startTagEnd + 1);
    if (close === -1) continue;
    matches.push({
      tagName: tag.tagName,
      attributes: tag.attributes,
      innerHtml: html.slice(tag.startTagEnd + 1, close),
    });
  }
  return matches;
}

function shouldSkipHtmlTag(
  tagName: string,
  attributes: Record<string, string>,
  skipTagContent: ReadonlySet<string>,
): boolean {
  if (skipTagContent.has(tagName)) {
    return true;
  }
  if (tagName === 'template') {
    return true;
  }
  if (attributes.hidden !== undefined || attributes.inert !== undefined) {
    return true;
  }
  if ((attributes['aria-hidden'] ?? '').trim().toLowerCase() === 'true') {
    return true;
  }
  if (tagName === 'input' && (attributes.type ?? '').trim().toLowerCase() === 'hidden') {
    return true;
  }
  const style = (attributes.style ?? '').replace(/\s+/g, '').toLowerCase();
  return style.includes('display:none')
    || style.includes('visibility:hidden')
    || style.includes('content-visibility:hidden');
}

function parseHtmlStartTag(
  html: string,
  start: number,
): { tagName: string; attributes: Record<string, string>; startTagEnd: number; isClosing: boolean } | null {
  if (html[start] !== '<') return null;
  const next = html[start + 1];
  if (!next || next === '!' || next === '?') return null;
  const isClosing = next === '/';
  let cursor = start + (isClosing ? 2 : 1);
  while (cursor < html.length && /\s/.test(html[cursor])) cursor += 1;
  const nameStart = cursor;
  while (cursor < html.length && /[A-Za-z0-9:-]/.test(html[cursor])) cursor += 1;
  if (cursor === nameStart) return null;
  const tagName = html.slice(nameStart, cursor).toLowerCase();
  const startTagEnd = findTagEnd(html, cursor);
  if (startTagEnd === -1) return null;
  if (isClosing) {
    return { tagName, attributes: {}, startTagEnd, isClosing: true };
  }
  const attributes = parseHtmlAttributes(html.slice(cursor, startTagEnd));
  return { tagName, attributes, startTagEnd, isClosing: false };
}

function findTagEnd(html: string, start: number): number {
  let quote: '"' | "'" | null = null;
  for (let index = start; index < html.length; index += 1) {
    const ch = html[index];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === '\'') {
      quote = ch;
      continue;
    }
    if (ch === '>') return index;
  }
  return -1;
}

function parseHtmlAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  let index = 0;
  while (index < source.length) {
    while (index < source.length && /[\s/]/.test(source[index])) index += 1;
    if (index >= source.length) break;
    const nameStart = index;
    while (index < source.length && /[^\s=/>]/.test(source[index])) index += 1;
    const rawName = source.slice(nameStart, index).trim().toLowerCase();
    if (!rawName) {
      index += 1;
      continue;
    }
    while (index < source.length && /\s/.test(source[index])) index += 1;
    if (source[index] !== '=') {
      attributes[rawName] = '';
      continue;
    }
    index += 1;
    while (index < source.length && /\s/.test(source[index])) index += 1;
    if (index >= source.length) {
      attributes[rawName] = '';
      break;
    }
    const quote = source[index];
    if (quote === '"' || quote === '\'') {
      index += 1;
      const valueStart = index;
      while (index < source.length && source[index] !== quote) index += 1;
      attributes[rawName] = decodeHtmlEntities(source.slice(valueStart, index));
      if (index < source.length) index += 1;
      continue;
    }
    const valueStart = index;
    while (index < source.length && /[^\s>]/.test(source[index])) index += 1;
    attributes[rawName] = decodeHtmlEntities(source.slice(valueStart, index));
  }
  return attributes;
}

function findMatchingClosingTag(html: string, tagName: string, fromIndex: number): number {
  const openNeedle = `<${tagName}`;
  const closeNeedle = `</${tagName}`;
  let depth = 0;
  let index = fromIndex;
  while (index < html.length) {
    const nextOpen = html.indexOf(openNeedle, index);
    const nextClose = html.indexOf(closeNeedle, index);
    if (nextClose === -1) return -1;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      const nested = parseHtmlStartTag(html, nextOpen);
      if (nested && !nested.isClosing && nested.tagName === tagName && !VOID_HTML_TAGS.has(tagName)) {
        depth += 1;
        index = nested.startTagEnd + 1;
        continue;
      }
      index = nextOpen + openNeedle.length;
      continue;
    }
    const closing = parseHtmlStartTag(html, nextClose);
    if (!closing || !closing.isClosing || closing.tagName !== tagName) {
      index = nextClose + closeNeedle.length;
      continue;
    }
    if (depth === 0) return nextClose;
    depth -= 1;
    index = closing.startTagEnd + 1;
  }
  return -1;
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#(?:x[0-9a-fA-F]+|\d+)|[a-zA-Z]+);/g, (match, entity: string) => {
    const normalized = entity.toLowerCase();
    if (normalized === 'nbsp') return ' ';
    if (normalized === 'amp') return '&';
    if (normalized === 'lt') return '<';
    if (normalized === 'gt') return '>';
    if (normalized === 'quot') return '"';
    if (normalized === '#39' || normalized === 'apos') return '\'';
    if (normalized.startsWith('#x')) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(codePoint) && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
    }
    if (normalized.startsWith('#')) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(codePoint) && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
    }
    return match;
  });
}
