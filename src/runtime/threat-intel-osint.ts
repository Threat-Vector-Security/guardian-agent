import type { WebSearchConfig } from '../config/types.js';
import type {
  IntelContentType,
  IntelSeverity,
  ThreatIntelFindingEvidence,
  ThreatIntelFindingProvenance,
  ThreatIntelSourceFinding,
  ThreatIntelSourceScanInput,
  ThreatIntelSourceScanResult,
  ThreatIntelSourceScanner,
} from './threat-intel.js';

type SearchProvider = 'duckduckgo' | 'brave' | 'perplexity';

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

type SearchResponse = {
  query: string;
  provider: SearchProvider;
  results: SearchResult[];
  answer?: string;
};

type ScannerSourceType = Extract<ThreatIntelSourceScanner['sourceType'], 'web' | 'news' | 'social'>;

type ThreatSignal = {
  tags: string[];
  severity: IntelSeverity;
  summaryLabel: string;
};

type HtmlTextOptions = {
  skipTagContent?: ReadonlySet<string>;
};

type ParsedHtmlElement = {
  tagName: string;
  attributes: Record<string, string>;
  innerHtml: string;
};

export interface ThreatIntelOsintScannerOptions {
  webSearch?: WebSearchConfig;
  getWebSearchConfig?: () => WebSearchConfig | undefined;
  admitRequest?: (url: string) => { allowed: boolean; reason?: string };
  fetchImpl?: typeof fetch;
  now?: () => number;
  maxResultsPerQuery?: number;
  maxPagesPerQuery?: number;
  userAgent?: string;
}

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

const SOCIAL_HOSTS = [
  'x.com',
  'twitter.com',
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'tiktok.com',
  'youtube.com',
  'reddit.com',
  't.me',
  'telegram.me',
];

const NEWS_HINTS = [
  'news',
  'press',
  'headline',
  'coverage',
  'reported',
  'journalist',
];

const TARGET_CONTEXT_HINTS = [
  'profile',
  'account',
  'identity',
  'person',
  'company',
  'brand',
  'domain',
];

const THREAT_TAGS: Array<{
  label: string;
  severity: IntelSeverity;
  terms: string[];
  summaryLabel: string;
}> = [
  { label: 'sexual', severity: 'critical', terms: ['sexual', 'revenge porn', 'ncII', 'non-consensual intimate', 'blackmail'], summaryLabel: 'sexual abuse' },
  { label: 'identity_theft', severity: 'high', terms: ['identity theft', 'stolen identity', 'ssn', 'social security'], summaryLabel: 'identity theft' },
  { label: 'deepfake', severity: 'high', terms: ['deepfake', 'synthetic media', 'ai face swap'], summaryLabel: 'deepfake' },
  { label: 'impersonation', severity: 'high', terms: ['impersonation', 'imposter', 'fake profile', 'fake account', 'catfish'], summaryLabel: 'impersonation' },
  { label: 'fraud', severity: 'high', terms: ['fraud', 'scam', 'phishing', 'spoofing', 'counterfeit'], summaryLabel: 'fraud' },
  { label: 'dox', severity: 'high', terms: ['dox', 'doxx', 'address leak', 'phone leak'], summaryLabel: 'doxxing' },
  { label: 'leak', severity: 'high', terms: ['leak', 'breach', 'paste', 'dump'], summaryLabel: 'data leak' },
  { label: 'extortion', severity: 'high', terms: ['extortion', 'ransom', 'threaten', 'threatening'], summaryLabel: 'extortion' },
];

export function createThreatIntelSourceScanners(
  options: ThreatIntelOsintScannerOptions = {},
): Partial<Record<ScannerSourceType, ThreatIntelSourceScanner>> {
  return {
    web: new ThreatIntelOsintScanner('web', options),
    news: new ThreatIntelOsintScanner('news', options),
    social: new ThreatIntelOsintScanner('social', options),
  };
}

class ThreatIntelOsintScanner implements ThreatIntelSourceScanner {
  readonly sourceType: ScannerSourceType;
  private readonly webSearch: WebSearchConfig;
  private readonly getWebSearchConfig?: () => WebSearchConfig | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly admitRequest?: (url: string) => { allowed: boolean; reason?: string };
  private readonly maxResultsPerQuery: number;
  private readonly maxPagesPerQuery: number;
  private readonly userAgent: string;

  constructor(sourceType: ScannerSourceType, options: ThreatIntelOsintScannerOptions) {
    this.sourceType = sourceType;
    this.webSearch = options.webSearch ?? {};
    this.getWebSearchConfig = options.getWebSearchConfig;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.admitRequest = options.admitRequest;
    this.maxResultsPerQuery = clampPositiveInteger(options.maxResultsPerQuery, 5);
    this.maxPagesPerQuery = clampPositiveInteger(options.maxPagesPerQuery, 2);
    this.userAgent = options.userAgent?.trim() || 'GuardianAgent-ThreatIntel/1.0';
  }

  async scan(input: ThreatIntelSourceScanInput): Promise<ThreatIntelSourceScanResult> {
    const findings: ThreatIntelSourceFinding[] = [];
    const errors: string[] = [];
    let successfulQueries = 0;

    for (const target of input.targets) {
      const seenUrls = new Set<string>();
      let targetFindings = 0;
      for (const query of buildQueries(this.sourceType, target)) {
        if (targetFindings >= 6) break;
        try {
          const response = await this.search(query, this.maxResultsPerQuery);
          successfulQueries += 1;
          const candidateResults = this.filterResults(response.results);
          for (const [index, result] of candidateResults.entries()) {
            if (targetFindings >= 6) break;
            if (!result.url || seenUrls.has(result.url)) continue;
            seenUrls.add(result.url);

            const pageEvidence = index < this.maxPagesPerQuery
              ? await this.fetchReadablePage(result.url)
              : undefined;
            const finding = buildFinding({
              sourceType: this.sourceType,
              target,
              query,
              provider: response.provider,
              result,
              answer: response.answer,
              pageEvidence,
            });
            if (!finding) continue;
            findings.push(finding);
            targetFindings += 1;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(message);
        }
      }
    }

    return {
      sourceType: this.sourceType,
      scanned: successfulQueries > 0,
      findings: dedupeFindings(findings),
      unavailableReason: successfulQueries > 0 ? undefined : errors[0] ?? 'Search provider unavailable.',
    };
  }

  private filterResults(results: SearchResult[]): SearchResult[] {
    if (this.sourceType !== 'social') return results;
    return results.filter((result) => isSocialHost(result.url));
  }

  private async search(query: string, maxResults: number): Promise<SearchResponse> {
    const webSearch = this.resolveWebSearchConfig();
    const provider = resolveSearchProvider(webSearch.provider ?? 'auto', webSearch);
    if (provider === 'brave') return this.searchBrave(query, maxResults);
    if (provider === 'perplexity') return this.searchPerplexity(query, maxResults);
    return this.searchDuckDuckGo(query, maxResults);
  }

  private async searchDuckDuckGo(query: string, maxResults: number): Promise<SearchResponse> {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    this.assertRequestAllowed(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await this.fetchImpl(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html',
        },
      });
      if (!response.ok) {
        throw new Error(`DuckDuckGo returned ${response.status}`);
      }
      const html = await response.text();
      return {
        query,
        provider: 'duckduckgo',
        results: parseDuckDuckGoResults(html, maxResults),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private async searchBrave(query: string, maxResults: number): Promise<SearchResponse> {
    const apiKey = this.resolveWebSearchConfig().braveApiKey?.trim();
    if (!apiKey) {
      throw new Error('Brave API key not configured.');
    }

    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}&summary=1`;
    this.assertRequestAllowed(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await this.fetchImpl(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': apiKey,
        },
      });
      if (!response.ok) {
        throw new Error(`Brave API returned ${response.status}`);
      }
      const data = await response.json() as {
        web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
        summarizer?: { key?: string };
      };
      let answer: string | undefined;
      if (data.summarizer?.key) {
        answer = await this.fetchBraveSummary(apiKey, data.summarizer.key);
      }
      return {
        query,
        provider: 'brave',
        answer,
        results: (data.web?.results ?? []).slice(0, maxResults).map((result) => ({
          title: result.title ?? '',
          url: result.url ?? '',
          snippet: result.description ?? '',
        })),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private async fetchBraveSummary(apiKey: string, summarizerKey: string): Promise<string> {
    const url = `https://api.search.brave.com/res/v1/summarizer/search?key=${encodeURIComponent(summarizerKey)}&entity_info=1`;
    this.assertRequestAllowed(url);
    const response = await this.fetchImpl(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': apiKey,
      },
    });
    if (!response.ok) {
      throw new Error(`Brave summarizer returned ${response.status}`);
    }
    const data = await response.json() as {
      summary?: Array<{ data?: string; children?: Array<{ data?: string }> }>;
    };
    if (!data.summary?.length) return '';
    const parts: string[] = [];
    for (const node of data.summary) {
      if (node.data) parts.push(node.data);
      for (const child of node.children ?? []) {
        if (child.data) parts.push(child.data);
      }
    }
    return parts.join(' ').trim();
  }

  private async searchPerplexity(query: string, maxResults: number): Promise<SearchResponse> {
    const webSearch = this.resolveWebSearchConfig();
    const directKey = webSearch.perplexityApiKey?.trim();
    const openRouterKey = webSearch.openRouterApiKey?.trim();
    if (!directKey && !openRouterKey) {
      throw new Error('Perplexity API key not configured.');
    }

    const useOpenRouter = !directKey && !!openRouterKey;
    const apiKey = directKey || openRouterKey!;
    const apiUrl = useOpenRouter
      ? 'https://openrouter.ai/api/v1/chat/completions'
      : 'https://api.perplexity.ai/chat/completions';
    this.assertRequestAllowed(apiUrl);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
      if (useOpenRouter) {
        headers['HTTP-Referer'] = 'https://guardianagent.local';
        headers['X-Title'] = 'GuardianAgent';
      }

      const response = await this.fetchImpl(apiUrl, {
        method: 'POST',
        signal: controller.signal,
        headers,
        body: JSON.stringify({
          model: useOpenRouter ? 'perplexity/sonar' : 'sonar',
          messages: [{ role: 'user', content: query }],
        }),
      });
      if (!response.ok) {
        throw new Error(`Perplexity API returned ${response.status}`);
      }
      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        citations?: Array<string | { url: string; title?: string }>;
      };
      return {
        query,
        provider: 'perplexity',
        answer: data.choices?.[0]?.message?.content ?? '',
        results: (data.citations ?? []).slice(0, maxResults).map((citation, index) => {
          if (typeof citation === 'string') {
            return { title: `Source ${index + 1}`, url: citation, snippet: '' };
          }
          return { title: citation.title ?? `Source ${index + 1}`, url: citation.url, snippet: '' };
        }),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private async fetchReadablePage(url: string): Promise<{ excerpt: string; evidence: ThreatIntelFindingEvidence[] } | undefined> {
    this.assertRequestAllowed(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await this.fetchImpl(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml',
        },
      });
      if (!response.ok) return undefined;
      const raw = await response.text();
      const text = extractReadableContent(raw);
      if (!text) return undefined;
      const excerpt = truncateText(text, 500);
      return {
        excerpt,
        evidence: [{
          kind: 'page_excerpt',
          content: excerpt,
          url,
        }],
      };
    } catch {
      return undefined;
    } finally {
      clearTimeout(timer);
    }
  }

  private assertRequestAllowed(url: string): void {
    if (!this.admitRequest) return;
    const decision = this.admitRequest(url);
    if (!decision.allowed) {
      throw new Error(decision.reason?.trim() || `Threat intel request blocked for ${url}`);
    }
  }

  private resolveWebSearchConfig(): WebSearchConfig {
    return this.getWebSearchConfig?.() ?? this.webSearch;
  }
}

function buildQueries(sourceType: ScannerSourceType, target: string): string[] {
  const exactTarget = quoteTarget(target);
  if (sourceType === 'news') {
    return [
      `${exactTarget} news`,
      `${exactTarget} fraud scam reported`,
      `${exactTarget} impersonation deepfake`,
    ];
  }
  if (sourceType === 'social') {
    return [
      `${exactTarget} profile account`,
      `${exactTarget} impersonation fake account scam`,
    ];
  }
  return [
    exactTarget,
    `${exactTarget} fraud scam impersonation`,
    `${exactTarget} identity theft leak dox extortion`,
  ];
}

function buildFinding(input: {
  sourceType: ScannerSourceType;
  target: string;
  query: string;
  provider: SearchProvider;
  result: SearchResult;
  answer?: string;
  pageEvidence?: { excerpt: string; evidence: ThreatIntelFindingEvidence[] };
}): ThreatIntelSourceFinding | null {
  const normalizedTarget = normalizeTarget(input.target);
  const combined = [
    input.result.title,
    input.result.snippet,
    input.pageEvidence?.excerpt ?? '',
    input.answer ?? '',
  ].join(' ');
  if (!isRelevantToTarget(normalizedTarget, combined, input.result.url)) {
    return null;
  }

  const signal = detectThreatSignal(combined, input.sourceType);
  if (input.sourceType === 'social' && !signal.tags.length && !looksLikeSocialProfile(combined, input.result.url)) {
    return null;
  }

  const provenance: ThreatIntelFindingProvenance = {
    provider: input.provider,
    query: input.query,
    title: truncateText(input.result.title, 160),
    snippet: truncateText(input.result.snippet, 240),
  };

  const evidence: ThreatIntelFindingEvidence[] = [{
    kind: 'search_result',
    content: truncateText(input.result.snippet || input.result.title || input.result.url, 280),
    title: truncateText(input.result.title, 160),
    url: input.result.url,
  }];
  if (input.pageEvidence) {
    evidence.push(...input.pageEvidence.evidence);
  }
  if (input.answer?.trim()) {
    evidence.push({
      kind: 'provider_answer',
      content: truncateText(input.answer, 320),
    });
  }

  return {
    target: normalizedTarget,
    sourceType: input.sourceType,
    contentType: inferContentType(combined),
    severity: signal.severity,
    confidence: computeConfidence({
      sourceType: input.sourceType,
      combined,
      hasPageEvidence: !!input.pageEvidence,
      hasProviderAnswer: !!input.answer?.trim(),
    }),
    summary: buildSummary(normalizedTarget, input.result.title, signal.summaryLabel, input.sourceType),
    url: input.result.url,
    labels: uniqueNonEmpty([
      'monitoring',
      input.sourceType,
      ...signal.tags,
      ...detectContextLabels(combined, input.result.url),
    ]),
    provenance,
    evidence,
  };
}

function detectThreatSignal(text: string, sourceType: ScannerSourceType): ThreatSignal {
  const normalized = normalizeTarget(text);
  const matched = THREAT_TAGS.filter((tag) => tag.terms.some((term) => normalized.includes(term)));
  if (matched.length === 0) {
    if (sourceType === 'social') {
      return { tags: [], severity: 'medium', summaryLabel: 'account exposure' };
    }
    if (sourceType === 'news' && NEWS_HINTS.some((term) => normalized.includes(term))) {
      return { tags: ['news_mention'], severity: 'medium', summaryLabel: 'news coverage' };
    }
    return { tags: [], severity: 'low', summaryLabel: 'open-source mention' };
  }

  const severity = matched.reduce<IntelSeverity>((current, item) => {
    return severityRank(item.severity) > severityRank(current) ? item.severity : current;
  }, 'low');
  return {
    tags: matched.map((item) => item.label),
    severity,
    summaryLabel: matched[0]?.summaryLabel ?? 'risk signal',
  };
}

function computeConfidence(input: {
  sourceType: ScannerSourceType;
  combined: string;
  hasPageEvidence: boolean;
  hasProviderAnswer: boolean;
}): number {
  let score = input.sourceType === 'news' ? 0.62 : input.sourceType === 'social' ? 0.58 : 0.55;
  if (input.hasPageEvidence) score += 0.15;
  if (input.hasProviderAnswer) score += 0.05;
  const normalized = normalizeTarget(input.combined);
  const hitCount = THREAT_TAGS.filter((tag) => tag.terms.some((term) => normalized.includes(term))).length;
  if (hitCount >= 2) score += 0.1;
  if (TARGET_CONTEXT_HINTS.some((term) => normalized.includes(term))) score += 0.05;
  return Math.max(0.2, Math.min(0.99, Number(score.toFixed(2))));
}

function detectContextLabels(text: string, url: string): string[] {
  const normalized = normalizeTarget(`${text} ${url}`);
  const labels: string[] = [];
  if (normalized.includes('identity theft')) labels.push('identity_theft');
  if (normalized.includes('fake account') || normalized.includes('profile')) labels.push('profile');
  if (NEWS_HINTS.some((term) => normalized.includes(term))) labels.push('news');
  if (isSocialHost(url)) labels.push('social_profile');
  return labels;
}

function buildSummary(target: string, title: string, summaryLabel: string, sourceType: ScannerSourceType): string {
  const headline = truncateText(title.trim() || 'Untitled result', 120);
  return `Detected ${summaryLabel} for '${target}' from ${sourceType} source: ${headline}.`;
}

function isRelevantToTarget(target: string, combinedText: string, url: string): boolean {
  const normalized = normalizeTarget(`${combinedText} ${url}`);
  if (normalized.includes(target)) return true;
  const targetTokens = tokenize(target);
  if (targetTokens.length === 0) return false;
  const matches = targetTokens.filter((token) => normalized.includes(token));
  return matches.length >= Math.max(1, Math.ceil(targetTokens.length * 0.6));
}

function looksLikeSocialProfile(text: string, url: string): boolean {
  const normalized = normalizeTarget(`${text} ${url}`);
  return isSocialHost(url) && TARGET_CONTEXT_HINTS.some((term) => normalized.includes(term));
}

function dedupeFindings(findings: ThreatIntelSourceFinding[]): ThreatIntelSourceFinding[] {
  const dedupe = new Set<string>();
  const result: ThreatIntelSourceFinding[] = [];
  for (const finding of findings) {
    const key = `${finding.url ?? ''}|${finding.summary}`;
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    result.push(finding);
  }
  return result;
}

function resolveSearchProvider(requested: string, config: WebSearchConfig): SearchProvider {
  if (requested === 'brave') return 'brave';
  if (requested === 'perplexity') return 'perplexity';
  if (requested === 'duckduckgo') return 'duckduckgo';
  if (config.braveApiKey?.trim()) return 'brave';
  if (config.perplexityApiKey?.trim() || config.openRouterApiKey?.trim()) return 'perplexity';
  return 'duckduckgo';
}

function quoteTarget(target: string): string {
  const trimmed = target.trim().replace(/"/g, '');
  return trimmed.includes(' ') ? `"${trimmed}"` : trimmed;
}

function inferContentType(text: string): IntelContentType {
  const normalized = normalizeTarget(text);
  if (normalized.includes('video')) return 'video';
  if (normalized.includes('audio') || normalized.includes('voice')) return 'audio';
  if (normalized.includes('image') || normalized.includes('photo') || normalized.includes('deepfake')) return 'image';
  return 'text';
}

function severityRank(severity: IntelSeverity): number {
  switch (severity) {
    case 'critical': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    default: return 1;
  }
}

function isSocialHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return SOCIAL_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

function normalizeTarget(value: string): string {
  return value.trim().toLowerCase();
}

function tokenize(value: string): string[] {
  return normalizeTarget(value)
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function truncateText(value: string, max: number): string {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 3)}...`;
}

function clampPositiveInteger(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || value === undefined) return fallback;
  return Math.max(1, Math.trunc(value));
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function stripHtml(value: string): string {
  return htmlToText(value, { skipTagContent: new Set(['script', 'style']) });
}

function extractReadableContent(html: string): string {
  const article = findFirstElementInnerHtml(html, 'article');
  const main = findFirstElementInnerHtml(html, 'main');
  const body = article ?? main ?? html;
  const title = stripHtml(findFirstElementInnerHtml(html, 'title') ?? '').trim();
  const bodyText = htmlToText(body, { skipTagContent: new Set(['script', 'style', 'nav', 'footer', 'header', 'aside']) })
    .replace(/\s+/g, ' ')
    .trim();
  return title ? `${title}\n\n${bodyText}` : bodyText;
}

function parseDuckDuckGoResults(html: string, maxResults: number): SearchResult[] {
  const results: SearchResult[] = [];
  const resultBlocks = findHtmlElementsByClass(html, 'result');
  for (const block of resultBlocks) {
    if (results.length >= maxResults) break;
    const link = findHtmlElementsByClass(block.innerHtml, 'result__a', 'a')[0];
    if (!link) continue;
    const snippet = findHtmlElementsByClass(block.innerHtml, 'result__snippet')[0];
    const href = normalizeDuckDuckGoResultUrl(link.attributes.href ?? '');
    if (!href) continue;
    results.push({
      title: stripHtml(link.innerHtml).trim(),
      url: href,
      snippet: snippet ? stripHtml(snippet.innerHtml).replace(/\s+/g, ' ').trim() : '',
    });
  }
  return results;
}

function normalizeDuckDuckGoResultUrl(rawHref: string): string {
  const href = rawHref.trim();
  if (!href) return '';
  try {
    const parsed = new URL(href, 'https://html.duckduckgo.com');
    const redirected = parsed.searchParams.get('uddg');
    return redirected?.trim() || parsed.toString();
  } catch {
    return href;
  }
}

function htmlToText(value: string, options: HtmlTextOptions = {}): string {
  if (!value) return '';
  const skipTagContent = options.skipTagContent ?? new Set<string>();
  let text = '';
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
      text += ' ';
      continue;
    }

    const tag = parseHtmlStartTag(value, index);
    if (!tag) {
      text += ch;
      index += 1;
      continue;
    }

    const tagName = tag.tagName.toLowerCase();
    if (!tag.isClosing && skipTagContent.has(tagName) && !VOID_HTML_TAGS.has(tagName)) {
      const close = findMatchingClosingTag(value, tagName, tag.startTagEnd + 1);
      index = close === -1 ? value.length : close + (`</${tagName}>`).length;
      text += ' ';
      continue;
    }

    index = tag.startTagEnd + 1;
    text += ' ';
  }

  return decodeHtmlEntities(text).replace(/\s+/g, ' ').trim();
}

function findFirstElementInnerHtml(html: string, tagName: string): string | undefined {
  return findHtmlElementsByTagName(html, tagName)[0]?.innerHtml;
}

function findHtmlElementsByClass(html: string, className: string, tagName?: string): ParsedHtmlElement[] {
  const classToken = className.trim();
  if (!classToken) return [];
  const matches: ParsedHtmlElement[] = [];
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

function findHtmlElementsByTagName(html: string, tagName: string): ParsedHtmlElement[] {
  const normalizedTag = tagName.toLowerCase();
  const matches: ParsedHtmlElement[] = [];
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
  return {
    tagName,
    attributes: parseHtmlAttributes(html.slice(cursor, startTagEnd)),
    startTagEnd,
    isClosing: false,
  };
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
