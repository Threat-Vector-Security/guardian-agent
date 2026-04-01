import { describe, expect, it } from 'vitest';
import { buildPathBoundaryPattern, escapeRegexLiteral } from './regex.js';

describe('regex utils', () => {
  it('escapes regex metacharacters completely', () => {
    expect(escapeRegexLiteral(String.raw`a+b(c)[d]?^$|\{x\}`)).toBe(String.raw`a\+b\(c\)\[d\]\?\^\$\|\\\{x\\\}`);
  });

  it('builds boundary-aware path patterns from literal paths', () => {
    const pattern = buildPathBoundaryPattern('/tmp/guardian+(prod)[state]?');
    const regex = new RegExp(pattern, 'i');

    expect(regex.test('/tmp/guardian+(prod)[state]?/config.yaml')).toBe(true);
    expect(regex.test('/tmp/guardian+(prod)[state]?')).toBe(true);
    expect(regex.test('/tmp/guardian+(prod)[state]?backup/config.yaml')).toBe(false);
  });
});
