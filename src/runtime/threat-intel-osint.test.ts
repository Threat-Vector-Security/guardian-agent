import { describe, it, expect, vi } from 'vitest';
import { createThreatIntelSourceScanners } from './threat-intel-osint.js';

describe('ThreatIntel OSINT scanners', () => {
  it('searches DuckDuckGo and emits evidence-bearing findings', async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      const href = String(url);
      if (href.startsWith('https://html.duckduckgo.com/html/?q=')) {
        return new Response(`
          <div class="result">
            <a class="result__a" href="/l/?uddg=https%3A%2F%2Fexample.com%2Ffraud-alert">Jane Example fraud alert</a>
            <a class="result__snippet">Jane Example identity theft scam reported by investigators.</a>
          </div>
        `, { status: 200, headers: { 'content-type': 'text/html' } });
      }
      if (href === 'https://example.com/fraud-alert') {
        return new Response(`
          <html>
            <head><title>Fraud Alert</title></head>
            <body>
              <main>Jane Example was named in an identity theft and impersonation fraud report.</main>
            </body>
          </html>
        `, { status: 200, headers: { 'content-type': 'text/html' } });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    });

    const scanners = createThreatIntelSourceScanners({
      webSearch: { provider: 'duckduckgo' },
      fetchImpl: fetchMock as typeof fetch,
    });

    const result = await scanners.web!.scan({
      targets: ['Jane Example'],
      includeDarkWeb: false,
      now: Date.now(),
    });

    expect(result.scanned).toBe(true);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0]?.severity).toBe('high');
    expect(result.findings[0]?.provenance?.provider).toBe('duckduckgo');
    expect(result.findings[0]?.evidence?.some((item) => item.kind === 'page_excerpt')).toBe(true);
  });

  it('filters social scans to social-host results', async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      const href = String(url);
      if (href.startsWith('https://html.duckduckgo.com/html/?q=')) {
        return new Response(`
          <div class="result">
            <a class="result__a" href="/l/?uddg=https%3A%2F%2Fexample.com%2Fblog-post">General blog</a>
            <a class="result__snippet">Mention of Alex Target.</a>
          </div>
          <div class="result">
            <a class="result__a" href="/l/?uddg=https%3A%2F%2Fx.com%2Falex-target">Alex Target profile</a>
            <a class="result__snippet">Possible fake account impersonation of Alex Target.</a>
          </div>
        `, { status: 200, headers: { 'content-type': 'text/html' } });
      }
      if (href === 'https://x.com/alex-target') {
        return new Response(`
          <html>
            <head><title>Alex Target</title></head>
            <body><main>Fake account impersonation targeting Alex Target.</main></body>
          </html>
        `, { status: 200, headers: { 'content-type': 'text/html' } });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    });

    const scanners = createThreatIntelSourceScanners({
      webSearch: { provider: 'duckduckgo' },
      fetchImpl: fetchMock as typeof fetch,
    });

    const result = await scanners.social!.scan({
      targets: ['Alex Target'],
      includeDarkWeb: false,
      now: Date.now(),
    });

    expect(result.scanned).toBe(true);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.url).toBe('https://x.com/alex-target');
    expect(result.findings[0]?.labels).toContain('social_profile');
  });
});
