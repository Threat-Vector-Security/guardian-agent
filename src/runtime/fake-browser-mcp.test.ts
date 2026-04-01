import { describe, expect, it } from 'vitest';
import { pageProfile } from '../../scripts/fake-browser-mcp.mjs';

describe('fake-browser-mcp page profiles', () => {
  it('matches supported hosts by exact hostname instead of substring', () => {
    expect(pageProfile('https://github.com/login').title).toContain('GitHub');
    expect(pageProfile('https://github.com.evil.test/login').title).toBe('https://github.com.evil.test/login');
    expect(pageProfile('https://example.com.evil.test').title).toBe('https://example.com.evil.test');
  });

  it('keeps the httpbin form profile scoped to the expected path', () => {
    expect(pageProfile('https://httpbin.org/forms/post?order=1').title).toBe('HTTPBin Forms');
    expect(pageProfile('https://httpbin.org/forms/post/extra').title).toBe('https://httpbin.org/forms/post/extra');
  });
});
