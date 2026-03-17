#!/usr/bin/env node
/**
 * ClawHub / OpenClaw Skill Importer for GuardianAgent
 *
 * Fetches a skill from ClawHub, converts it to GuardianAgent native format,
 * runs a basic security scan, and writes to skills/.
 *
 * Usage:
 *   node scripts/import-clawhub-skill.mjs <author/slug>          # Import single skill
 *   node scripts/import-clawhub-skill.mjs --list                 # List top skills
 *   node scripts/import-clawhub-skill.mjs --batch recommended    # Import all recommended
 *   node scripts/import-clawhub-skill.mjs --scan <dir>           # Scan an existing skill dir
 *
 * Examples:
 *   node scripts/import-clawhub-skill.mjs steipete/github
 *   node scripts/import-clawhub-skill.mjs steipete/weather --role domain
 *   node scripts/import-clawhub-skill.mjs --list --limit 30
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const IMPORT_DIR = path.join(PROJECT_ROOT, 'skills');

// ── Recommended skills for batch import ──────────────────────────────────────

const RECOMMENDED_SKILLS = [
  {
    slug: 'steipete/github',
    role: 'domain',
    tags: ['github', 'pull-request', 'issues', 'workflow-runs', 'gh-cli', 'repository'],
    capabilities: ['shell_access', 'network_access'],
    risk: 'operational',
  },
  {
    slug: 'steipete/blogwatcher',
    role: 'domain',
    tags: ['blogwatcher', 'rss', 'atom', 'feed-monitoring', 'blog-updates', 'news-tracking'],
    capabilities: ['shell_access', 'network_access'],
    risk: 'operational',
  },
  {
    slug: 'steipete/weather',
    role: 'domain',
    tags: ['weather', 'forecast', 'current-weather', 'wttr', 'open-meteo', 'weather-cli'],
    capabilities: ['shell_access', 'network_access'],
    risk: 'operational',
  },
  {
    slug: 'steipete/nano-pdf',
    role: 'domain',
    tags: ['pdf', 'nano-pdf', 'pdf-editing', 'document-edit', 'page-edit', 'pdf-cli'],
    capabilities: ['shell_access', 'filesystem_write'],
    risk: 'operational',
  },
  {
    slug: 'gpyangyoujun/multi-search-engine',
    role: 'domain',
    tags: ['search', 'research', 'osint', 'web-search', 'privacy-search', 'international-search'],
    capabilities: ['network_access'],
    risk: 'operational',
  },
  {
    slug: 'steipete/obsidian',
    role: 'domain',
    tags: ['obsidian', 'vault', 'markdown-notes', 'note-management', 'wikilinks', 'knowledge-base'],
    capabilities: ['shell_access', 'filesystem_write'],
    risk: 'operational',
  },
  {
    slug: 'steipete/slack',
    role: 'domain',
    tags: ['slack', 'messaging', 'channel', 'reactions', 'pins', 'workspace'],
    capabilities: ['network_access'],
    provider: 'slack',
    risk: 'operational',
  },
  {
    slug: 'steipete/notion',
    role: 'domain',
    tags: ['notion', 'pages', 'data-sources', 'blocks', 'workspace', 'wiki'],
    capabilities: ['network_access'],
    provider: 'notion',
    risk: 'operational',
  },
  {
    slug: 'lamelas/himalaya',
    role: 'domain',
    tags: ['email', 'imap', 'smtp', 'himalaya', 'inbox', 'message-compose'],
    capabilities: ['shell_access', 'network_access'],
    provider: 'email',
    risk: 'operational',
  },
  {
    slug: 'steipete/oracle',
    role: 'process',
    tags: ['oracle', 'second-opinion', 'model-review', 'cross-check', 'prompt-bundle', 'external-review'],
    capabilities: ['shell_access', 'network_access'],
    risk: 'operational',
  },
];

// ── Security scanner patterns ────────────────────────────────────────────────

const SECURITY_PATTERNS = [
  { name: 'shell_execution', pattern: /(?:exec\s*\(|spawn\s*\(|execSync|child_process|subprocess|system\(|os\.system)/gi, severity: 'high' },
  { name: 'credential_reference', pattern: /(?:API_KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL|PRIVATE_KEY|client_secret)/gi, severity: 'medium' },
  { name: 'network_url', pattern: /https?:\/\/[^\s)>"']+/gi, severity: 'low' },
  { name: 'file_mutation', pattern: /(?:write|append|truncate|unlink|rm\s+-rf|rmdir|fs\.write|> \/|>> \/)/gi, severity: 'medium' },
  { name: 'prompt_injection', pattern: /(?:ignore\s+(?:all\s+)?(?:previous|above)|you\s+are\s+now|new\s+instructions|disregard|override\s+(?:your|all))/gi, severity: 'critical' },
  { name: 'eval_execution', pattern: /(?:eval\(|Function\(|new\s+Function|setTimeout\s*\(\s*['"`])/gi, severity: 'high' },
  { name: 'base64_encoded', pattern: /(?:atob|btoa|Buffer\.from\s*\([^)]+,\s*['"]base64)/gi, severity: 'medium' },
  { name: 'env_access', pattern: /(?:process\.env|os\.environ|getenv|ENV\[)/gi, severity: 'low' },
  { name: 'daemon_mode', pattern: /(?:daemon|background|cron|setInterval|while\s*\(\s*true\s*\)|forever)/gi, severity: 'medium' },
  { name: 'self_modify', pattern: /(?:self[_-]?modif|auto[_-]?updat|self[_-]?evolv|overwrite.*(?:self|own))/gi, severity: 'high' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const body = match[2];
  try {
    const parsed = yaml.load(match[1]);
    return {
      meta: parsed && typeof parsed === 'object' ? parsed : {},
      body,
    };
  } catch {
    return { meta: {}, body };
  }
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

const KEYWORD_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
  'it', 'its', 'not', 'no', 'so', 'if', 'then', 'than', 'when', 'use',
  'using', 'used', 'your', 'you', 'we', 'our', 'all', 'any', 'each',
  'how', 'what', 'which', 'who', 'where', 'why', 'more', 'most',
  'also', 'just', 'about', 'into', 'over', 'such', 'only', 'other',
  'new', 'one', 'two', 'first', 'last', 'long', 'great', 'little',
  'own', 'old', 'right', 'big', 'high', 'different', 'small', 'large',
  'next', 'early', 'young', 'important', 'few', 'public', 'bad', 'same',
  'able', 'via', 'run', 'running', 'get', 'set', 'let', 'skill', 'skills',
  'tool', 'tools', 'bash', 'repo', 'owner', 'view', 'need', 'needs',
  'format', 'output', 'outputs', 'file', 'files', 'page', 'pages',
  'api', 'apis', 'key', 'keys', 'latest', 'version', 'best', 'read',
  'create', 'creates', 'created', 'manage', 'manages', 'work', 'working',
]);

const NETWORK_REQUIRED_BINARIES = new Set(['blogwatcher', 'curl', 'gh', 'himalaya', 'summarize', 'wget']);
const WRITE_REQUIRED_BINARIES = new Set(['nano-pdf', 'obsidian-cli']);

function getRequiredBinaries(meta) {
  const metadata = meta?.metadata;
  if (!metadata || typeof metadata !== 'object') return [];
  const bins = metadata?.openclaw?.requires?.bins
    ?? metadata?.clawdbot?.requires?.bins
    ?? [];
  return Array.isArray(bins) ? bins.filter((value) => typeof value === 'string' && value.trim()) : [];
}

function inferCapabilities(requiredBinaries, body, options = {}) {
  if (Array.isArray(options.capabilities) && options.capabilities.length > 0) {
    return unique(options.capabilities);
  }
  const normalizedBinaries = requiredBinaries.map((value) => value.trim().toLowerCase());
  const capabilities = [];
  if (normalizedBinaries.length > 0) capabilities.push('shell_access');
  if (
    normalizedBinaries.some((value) => NETWORK_REQUIRED_BINARIES.has(value))
    || /\b(?:curl|wget|gh\s+api|web_fetch|fetch\s*\()/i.test(body)
  ) {
    capabilities.push('network_access');
  }
  if (
    normalizedBinaries.some((value) => WRITE_REQUIRED_BINARIES.has(value))
    || /\b(?:nano-pdf\s+edit|obsidian-cli\s+(?:create|move|delete)|mkdir\s+-p|cp\s+\S|mv\s+\S|touch\s+\S|>>?|writeFile|appendFile)\b/i.test(body)
  ) {
    capabilities.push('filesystem_write');
  }
  return unique(capabilities);
}

function copyBundleDirs(sourceDir, targetDir) {
  if (!sourceDir || !fs.existsSync(sourceDir)) return;
  for (const dirname of ['references', 'templates', 'examples', 'assets', 'scripts']) {
    const sourcePath = path.join(sourceDir, dirname);
    const targetPath = path.join(targetDir, dirname);
    if (fs.existsSync(sourcePath)) {
      fs.cpSync(sourcePath, targetPath, { recursive: true });
    }
  }
}

function extractKeywords(name, description, body) {
  const prose = `${description}\n${body}`
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ');
  const text = `${name} ${prose}`.toLowerCase();
  const seeds = unique(
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 3 && !KEYWORD_STOPWORDS.has(word))
  );
  const compoundName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  const words = text.match(/[a-z][a-z-]{2,}/g) || [];
  const freq = {};
  for (const w of words) {
    if (!KEYWORD_STOPWORDS.has(w) && w.length > 2) {
      freq[w] = (freq[w] || 0) + 1;
    }
  }

  const ranked = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);

  return unique([
    compoundName,
    ...seeds,
    ...ranked,
  ]).slice(0, 8);
}

function inferRole(body) {
  const processSignals = [
    /workflow/i, /methodology/i, /step[s-]by[- ]step/i, /process/i,
    /review/i, /debug/i, /investigate/i, /before.*(?:act|code|fix)/i,
    /checklist/i, /protocol/i, /systematic/i, /framework/i,
  ];
  const domainSignals = [
    /api/i, /cli/i, /command/i, /endpoint/i, /service/i,
    /tool/i, /integration/i, /platform/i, /sdk/i,
  ];

  let processScore = 0;
  let domainScore = 0;
  for (const p of processSignals) if (p.test(body)) processScore++;
  for (const p of domainSignals) if (p.test(body)) domainScore++;

  return processScore > domainScore ? 'process' : 'domain';
}

function runSecurityScan(content, filePath) {
  const findings = [];

  for (const { name, pattern, severity } of SECURITY_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      findings.push({
        pattern: name,
        severity,
        count: matches.length,
        samples: [...new Set(matches)].slice(0, 3),
        file: filePath,
      });
    }
  }

  return findings;
}

function assessRisk(findings) {
  const critical = findings.filter(f => f.severity === 'critical');
  const high = findings.filter(f => f.severity === 'high');

  if (critical.length > 0) return { verdict: 'REJECT', reason: 'Prompt injection or critical pattern detected' };
  if (high.length >= 3) return { verdict: 'REJECT', reason: 'Multiple high-severity patterns detected' };
  if (high.length > 0) return { verdict: 'REVIEW', reason: 'High-severity patterns require manual review' };
  if (findings.length > 5) return { verdict: 'REVIEW', reason: 'Numerous findings require manual review' };
  return { verdict: 'PASS', reason: 'No significant security concerns' };
}

// ── Fetcher ──────────────────────────────────────────────────────────────────

async function fetchSkillPage(slug) {
  const url = `https://clawhub.ai/${slug}`;
  console.log(`  Fetching ${url} ...`);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const html = await res.text();

  // ClawHub is a SPA, so we can't get rendered content.
  // Instead, look for embedded JSON data or pre-rendered content.
  // The actual SKILL.md content may be in a script tag or API response.

  // Try to extract any embedded skill data from the HTML
  const scriptDataMatch = html.match(/__NEXT_DATA__.*?({[\s\S]*?})\s*<\/script>/);
  if (scriptDataMatch) {
    try {
      const data = JSON.parse(scriptDataMatch[1]);
      return data;
    } catch { /* fall through */ }
  }

  return null;
}

async function fetchSkillFromGitHub(author, skillId) {
  // All ClawHub skills are in the openclaw/skills monorepo
  // Path pattern: skills/{author}/{skill-id}/SKILL.md
  const candidates = [
    `https://raw.githubusercontent.com/openclaw/skills/main/skills/${author}/${skillId}/SKILL.md`,
    `https://raw.githubusercontent.com/${author}/${skillId}/main/SKILL.md`,
    `https://raw.githubusercontent.com/${author}/${skillId}/master/SKILL.md`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (res.ok) {
        const content = await res.text();
        console.log(`  Found SKILL.md at ${url}`);
        return { content, sourceUrl: url };
      }
    } catch { /* try next */ }
  }

  return null;
}

// ── Converter ────────────────────────────────────────────────────────────────

function convertToGuardianFormat(skillContent, options = {}) {
  const { meta, body } = parseFrontmatter(skillContent);

  const id = options.id || meta.name || 'unknown-skill';
  const normalizedId = id.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');

  // Extract title from first heading or meta
  const headingMatch = body.match(/^#\s+(.+)$/m);
  const name = headingMatch?.[1] || meta.name || normalizedId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const description = meta.description || options.description || `Reviewed third-party skill: ${name}`;
  const role = options.role || inferRole(body);
  const tags = options.tags || extractKeywords(name, description, body);
  const requiredBinaries = getRequiredBinaries(meta);
  const requiredCapabilities = inferCapabilities(requiredBinaries, body, options);
  const risk = options.risk || (requiredCapabilities.length > 0 ? 'operational' : 'informational');

  // Clean up body: strip {baseDir} references, normalize paths
  let cleanBody = body.trim();
  cleanBody = cleanBody.replace(/\{baseDir\}/g, `./skills/${normalizedId}`);

  // Build skill.json
  const manifest = {
    id: normalizedId,
    name,
    version: meta.version || '0.1.0',
    description,
    role,
    tags,
    enabled: options.enabled ?? false,
    appliesTo: {
      channels: ['cli', 'web', 'telegram'],
      requestTypes: ['chat'],
    },
    triggers: {
      keywords: tags.slice(0, 6),
    },
    tools: [],
    requiredCapabilities,
    risk,
    _upstream: {
      source: options.source || 'clawhub',
      repo: options.repo || '',
      path: options.upstreamPath || '',
      slug: options.slug || '',
      originalName: meta.name || id,
      version: meta.version || 'unknown',
      license: options.license || meta.license || 'UNKNOWN',
      commit: options.commit || '',
      fetchedAt: new Date().toISOString(),
      sourceUrl: options.sourceUrl || '',
      securityAssessment: 'pending',
    },
  };

  if (requiredBinaries.length > 0) {
    manifest._upstream.requiredBinaries = requiredBinaries;
  }
  if (options.provider) {
    manifest.requiredManagedProvider = options.provider;
  }

  // Generate THIRD_PARTY_NOTICES
  const notices = [
    `# Third-Party Notice`,
    ``,
    `## ${name}`,
    ``,
    `- **Source:** ${options.sourceLabel || 'ClawHub'}`,
    options.repo ? `- **Upstream Repo:** ${options.repo}` : null,
    options.upstreamPath ? `- **Upstream Path:** ${options.upstreamPath}` : null,
    options.commit ? `- **Upstream Commit:** ${options.commit}` : null,
    `- **Original Author:** ${options.author || 'Unknown'}`,
    `- **License:** ${options.license || meta.license || 'UNKNOWN'}`,
    `- **Imported:** ${new Date().toISOString().split('T')[0]}`,
    ``,
    `This skill was imported from the OpenClaw / ClawHub skill registry and adapted`,
    `for use with GuardianAgent. The original content is used under the terms of the`,
    `license specified above.`,
    ``,
    `Modifications:`,
    `- Converted from OpenClaw SKILL.md frontmatter format to GuardianAgent native format`,
    `- Added skill.json manifest with trigger keywords, capability metadata, and risk classification`,
    options.copyBundle ? `- Copied reviewed bundle siblings (references/templates/examples/assets/scripts) when present` : null,
  ].filter(Boolean).join('\n');

  return { manifest, instruction: cleanBody, notices };
}

// ── Commands ─────────────────────────────────────────────────────────────────

async function listTopSkills(limit = 20) {
  console.log('\n📋 Top ClawHub Skills by Installs\n');
  console.log('Note: ClawHub is a SPA — this list is based on cached known data.\n');

  const skills = [
    { name: 'summarize', author: 'steipete', installs: 3752, security: 'Benign' },
    { name: 'self-improving-agent', author: 'pskoett', installs: 3665, security: 'Benign' },
    { name: 'find-skills', author: 'JimLiuxinghai', installs: 3409, security: 'Benign' },
    { name: 'github', author: 'steipete', installs: 2854, security: 'Benign' },
    { name: 'agent-browser', author: 'TheSethRose', installs: 2526, security: 'Suspicious' },
    { name: 'gog', author: 'steipete', installs: 2487, security: 'Suspicious' },
    { name: 'weather', author: 'unknown', installs: 2456, security: 'Benign' },
    { name: 'skill-vetter', author: 'spclaudehome', installs: 1983, security: 'Benign' },
    { name: 'sonoscli', author: 'steipete', installs: 1916, security: 'Benign' },
    { name: 'proactive-agent', author: 'unknown', installs: 1645, security: 'Benign' },
    { name: 'obsidian', author: 'unknown', installs: 1625, security: 'Benign' },
    { name: 'nano-pdf', author: 'unknown', installs: 1613, security: 'Benign' },
    { name: 'notion', author: 'unknown', installs: 1612, security: 'Benign' },
    { name: 'skill-creator', author: 'chindden', installs: 1444, security: 'Benign' },
    { name: 'openai-whisper', author: 'unknown', installs: 1364, security: 'Benign' },
    { name: 'mcporter', author: 'unknown', installs: 1337, security: 'Benign' },
    { name: 'nano-banana-pro', author: 'unknown', installs: 1298, security: 'Benign' },
    { name: 'model-usage', author: 'unknown', installs: 1154, security: 'Benign' },
    { name: 'himalaya', author: 'unknown', installs: 1079, security: 'Benign' },
    { name: 'video-frames', author: 'unknown', installs: 1068, security: 'Benign' },
    { name: 'blogwatcher', author: 'unknown', installs: 1045, security: 'Benign' },
    { name: 'gemini', author: 'unknown', installs: 1033, security: 'Benign' },
    { name: 'tmux', author: 'unknown', installs: 1000, security: 'Benign' },
    { name: 'slack', author: 'unknown', installs: 986, security: 'Benign' },
    { name: 'trello', author: 'unknown', installs: 957, security: 'Benign' },
    { name: 'apple-notes', author: 'unknown', installs: 957, security: 'Benign' },
    { name: 'peekaboo', author: 'unknown', installs: 950, security: 'Benign' },
    { name: 'session-logs', author: 'unknown', installs: 944, security: 'Benign' },
    { name: 'self-improving', author: 'unknown', installs: 919, security: 'Benign' },
    { name: 'oracle', author: 'unknown', installs: 834, security: 'Benign' },
  ];

  const display = skills.slice(0, limit);
  console.log('  #  Installs  Security     Skill');
  console.log('  ─  ────────  ──────────   ─────');
  for (let i = 0; i < display.length; i++) {
    const s = display[i];
    const sec = s.security === 'Benign' ? '✅ Benign   ' : '⚠️  Suspicious';
    console.log(`  ${String(i + 1).padStart(2)}  ${String(s.installs).padStart(6)}    ${sec}  ${s.name} (${s.author})`);
  }
  console.log(`\n  Total: ${display.length} skills shown\n`);
}

async function importSkill(slug, options = {}) {
  console.log(`\n🔄 Importing skill: ${slug}\n`);

  const parts = slug.split('/');
  const author = parts[0];
  const skillId = parts[1];

  if (!author || !skillId) {
    console.error('❌ Invalid slug. Use format: author/skill-name');
    process.exit(1);
  }

  // Step 1: Try to fetch SKILL.md content
  let skillContent = null;
  let sourceUrl = '';
  let localBundleRoot = '';

  // Try GitHub first (more reliable for raw content)
  const ghResult = await fetchSkillFromGitHub(author, skillId);
  if (ghResult) {
    skillContent = ghResult.content;
    sourceUrl = ghResult.sourceUrl;
  }

  // If no content yet, check for local file (for testing)
  if (!skillContent && options.localFile) {
    if (fs.existsSync(options.localFile)) {
      skillContent = fs.readFileSync(options.localFile, 'utf-8');
      sourceUrl = `file://${options.localFile}`;
      localBundleRoot = path.dirname(options.localFile);
      console.log(`  Loaded from local file: ${options.localFile}`);
    }
  }

  if (!skillContent) {
    console.log(`  ⚠️  Could not fetch SKILL.md from GitHub.`);
    console.log(`  ClawHub is a SPA and requires browser rendering.`);
    console.log(`\n  Manual import steps:`);
    console.log(`  1. Visit https://clawhub.ai/${slug}`);
    console.log(`  2. Copy the SKILL.md content`);
    console.log(`  3. Save to: skills/${skillId}/SKILL.md`);
    console.log(`  4. Run: node scripts/import-clawhub-skill.mjs --scan skills/${skillId}`);
    return null;
  }

  // Step 2: Security scan
  console.log('  Running security scan...');
  const findings = runSecurityScan(skillContent, 'SKILL.md');
  const risk = assessRisk(findings);

  if (findings.length > 0) {
    console.log(`\n  Security Findings (${findings.length}):`);
    for (const f of findings) {
      const icon = f.severity === 'critical' ? '🔴' : f.severity === 'high' ? '🟠' : f.severity === 'medium' ? '🟡' : '🔵';
      console.log(`    ${icon} [${f.severity}] ${f.pattern}: ${f.count} match(es) — ${f.samples.join(', ')}`);
    }
  }

  console.log(`\n  Risk Assessment: ${risk.verdict} — ${risk.reason}`);

  if (risk.verdict === 'REJECT') {
    console.log(`\n  ❌ Skill rejected due to security concerns. Not imported.`);
    return null;
  }

  // Step 3: Convert format
  console.log('  Converting to Guardian format...');
  const { manifest, instruction, notices } = convertToGuardianFormat(skillContent, {
    id: skillId,
    slug,
    author,
    role: options.role,
    tags: options.tags,
    sourceUrl,
    enabled: options.enable === true,
    risk: options.risk,
    provider: options.provider,
    capabilities: options.capabilities,
    license: options.license,
    source: options.source,
    sourceLabel: options.sourceLabel,
    repo: options.repo,
    upstreamPath: options.upstreamPath,
    commit: options.commit,
    copyBundle: options.copyBundle !== false,
  });

  manifest._upstream.securityAssessment = risk.verdict === 'PASS' ? 'benign' : 'requires-review';

  // Step 4: Write files
  const skillDir = path.join(IMPORT_DIR, manifest.id);
  fs.mkdirSync(skillDir, { recursive: true });

  const manifestPath = path.join(skillDir, 'skill.json');
  const instructionPath = path.join(skillDir, 'SKILL.md');
  const noticesPath = path.join(skillDir, 'THIRD_PARTY_NOTICES.md');

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(instructionPath, instruction + '\n');
  fs.writeFileSync(noticesPath, notices + '\n');
  if (options.copyBundle !== false && localBundleRoot) {
    copyBundleDirs(localBundleRoot, skillDir);
  }

  console.log(`\n  ✅ Skill imported to: ${skillDir}`);
  console.log(`     skill.json:              ${manifestPath}`);
  console.log(`     SKILL.md:                ${instructionPath}`);
  console.log(`     THIRD_PARTY_NOTICES.md:  ${noticesPath}`);

  if (risk.verdict === 'REVIEW' && manifest.enabled !== false) {
    console.log(`\n  ⚠️  This skill requires manual security review before enabling.`);
    console.log(`     Set "enabled": true in skill.json after review.`);
    manifest.enabled = false;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  }

  return manifest;
}

async function scanSkillDir(dir) {
  const absDir = path.resolve(dir);
  console.log(`\n🔍 Scanning skill directory: ${absDir}\n`);

  const skillMdPath = path.join(absDir, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    console.error(`❌ No SKILL.md found in ${absDir}`);
    process.exit(1);
  }

  const content = fs.readFileSync(skillMdPath, 'utf-8');
  const findings = runSecurityScan(content, skillMdPath);
  const risk = assessRisk(findings);

  // Also scan any references/ files
  const refsDir = path.join(absDir, 'references');
  if (fs.existsSync(refsDir)) {
    const refFiles = fs.readdirSync(refsDir).filter(f => f.endsWith('.md'));
    for (const rf of refFiles) {
      const refPath = path.join(refsDir, rf);
      const refContent = fs.readFileSync(refPath, 'utf-8');
      const refFindings = runSecurityScan(refContent, refPath);
      findings.push(...refFindings);
    }
  }

  // Also scan scripts/ if present
  const scriptsDir = path.join(absDir, 'scripts');
  if (fs.existsSync(scriptsDir)) {
    const scriptFiles = fs.readdirSync(scriptsDir);
    for (const sf of scriptFiles) {
      const sfPath = path.join(scriptsDir, sf);
      const sfContent = fs.readFileSync(sfPath, 'utf-8');
      const sfFindings = runSecurityScan(sfContent, sfPath);
      findings.push(...sfFindings);
    }
  }

  if (findings.length === 0) {
    console.log('  ✅ No security concerns found.');
  } else {
    console.log(`  Security Findings (${findings.length}):\n`);
    for (const f of findings) {
      const icon = f.severity === 'critical' ? '🔴' : f.severity === 'high' ? '🟠' : f.severity === 'medium' ? '🟡' : '🔵';
      console.log(`    ${icon} [${f.severity}] ${f.pattern} in ${path.basename(f.file)}: ${f.count} match(es)`);
      console.log(`       Samples: ${f.samples.join(', ')}`);
    }
  }

  const finalRisk = assessRisk(findings);
  console.log(`\n  Overall Risk: ${finalRisk.verdict} — ${finalRisk.reason}\n`);
}

async function batchImport(preset) {
  if (preset !== 'recommended') {
    console.error(`Unknown preset: ${preset}. Available: recommended`);
    process.exit(1);
  }

  console.log(`\n📦 Batch importing ${RECOMMENDED_SKILLS.length} recommended skills\n`);
  console.log('  Note: batch mode is a convenience fetch. For reviewed, reproducible imports, prefer a local clone plus --local, --repo, --upstream-path, and --commit.\n');

  const results = { imported: [], skipped: [], failed: [] };

  for (const skill of RECOMMENDED_SKILLS) {
    try {
      const result = await importSkill(skill.slug, {
        role: skill.role,
        tags: skill.tags,
        capabilities: skill.capabilities,
        provider: skill.provider,
        risk: skill.risk,
      });
      if (result) {
        results.imported.push(skill.slug);
      } else {
        results.skipped.push(skill.slug);
      }
    } catch (err) {
      console.error(`  ❌ Failed to import ${skill.slug}: ${err.message}`);
      results.failed.push(skill.slug);
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('  Batch Import Summary');
  console.log('═'.repeat(60));
  console.log(`  ✅ Imported: ${results.imported.length}`);
  console.log(`  ⏭️  Skipped:  ${results.skipped.length}`);
  console.log(`  ❌ Failed:   ${results.failed.length}`);
  if (results.skipped.length > 0) {
    console.log(`\n  Skipped skills (fetch manually from ClawHub):`);
    for (const s of results.skipped) console.log(`    - ${s}`);
  }
  console.log();
}

// ── Main ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help')) {
  console.log(`
ClawHub Skill Importer for GuardianAgent

Usage:
  node scripts/import-clawhub-skill.mjs <author/slug>          Import a skill
  node scripts/import-clawhub-skill.mjs --list [--limit N]     List top skills
  node scripts/import-clawhub-skill.mjs --batch recommended    Import recommended set
  node scripts/import-clawhub-skill.mjs --scan <dir>           Scan a skill directory

Options:
  --role <process|domain>    Override role classification
  --tags <t1,t2,t3>         Override trigger tags
  --local <path>            Use a local SKILL.md file instead of fetching
  --copy-bundle             Copy references/templates/examples/assets/scripts beside SKILL.md
  --enable                  Import the skill as enabled (default: disabled)
  --risk <informational|operational>
  --provider <name>         Set requiredManagedProvider
  --capabilities <a,b,c>    Override requiredCapabilities
  --license <spdx-or-text>  Record verified upstream license
  --source <name>           Record upstream source key
  --source-label <label>    Record human-readable upstream source label
  --repo <url>              Record upstream repo URL
  --upstream-path <path>    Record upstream file/bundle path
  --commit <sha>            Record upstream commit SHA

Examples:
  node scripts/import-clawhub-skill.mjs steipete/github
  node scripts/import-clawhub-skill.mjs --list --limit 30
  node scripts/import-clawhub-skill.mjs --batch recommended
  node scripts/import-clawhub-skill.mjs --scan skills/github
  `);
  process.exit(0);
}

if (args.includes('--list')) {
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 20;
  await listTopSkills(limit);
} else if (args.includes('--batch')) {
  const preset = args[args.indexOf('--batch') + 1];
  await batchImport(preset);
} else if (args.includes('--scan')) {
  const dir = args[args.indexOf('--scan') + 1];
  await scanSkillDir(dir);
} else {
  const slug = args[0];
  const options = {};

  const roleIdx = args.indexOf('--role');
  if (roleIdx >= 0) options.role = args[roleIdx + 1];

  const tagsIdx = args.indexOf('--tags');
  if (tagsIdx >= 0) options.tags = args[tagsIdx + 1].split(',');

  const localIdx = args.indexOf('--local');
  if (localIdx >= 0) options.localFile = args[localIdx + 1];

  if (args.includes('--copy-bundle')) options.copyBundle = true;
  if (args.includes('--enable')) options.enable = true;

  const riskIdx = args.indexOf('--risk');
  if (riskIdx >= 0) options.risk = args[riskIdx + 1];

  const providerIdx = args.indexOf('--provider');
  if (providerIdx >= 0) options.provider = args[providerIdx + 1];

  const capabilitiesIdx = args.indexOf('--capabilities');
  if (capabilitiesIdx >= 0) options.capabilities = args[capabilitiesIdx + 1].split(',').map((value) => value.trim()).filter(Boolean);

  const licenseIdx = args.indexOf('--license');
  if (licenseIdx >= 0) options.license = args[licenseIdx + 1];

  const sourceIdx = args.indexOf('--source');
  if (sourceIdx >= 0) options.source = args[sourceIdx + 1];

  const sourceLabelIdx = args.indexOf('--source-label');
  if (sourceLabelIdx >= 0) options.sourceLabel = args[sourceLabelIdx + 1];

  const repoIdx = args.indexOf('--repo');
  if (repoIdx >= 0) options.repo = args[repoIdx + 1];

  const upstreamPathIdx = args.indexOf('--upstream-path');
  if (upstreamPathIdx >= 0) options.upstreamPath = args[upstreamPathIdx + 1];

  const commitIdx = args.indexOf('--commit');
  if (commitIdx >= 0) options.commit = args[commitIdx + 1];

  await importSkill(slug, options);
}
