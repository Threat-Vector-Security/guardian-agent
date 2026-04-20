const GENERIC_CODE_SESSION_TOKENS = new Set([
  'a',
  'an',
  'the',
  'my',
  'this',
  'that',
  'workspace',
  'workspaces',
  'session',
  'sessions',
  'coding',
  'code',
  'project',
  'repo',
  'repository',
  'main',
]);

function normalizeCodeSessionTarget(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function normalizeSemanticCodeSessionTarget(value) {
  return value
    .trim()
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean)
    .filter((token) => !GENERIC_CODE_SESSION_TOKENS.has(token))
    .join('');
}

function resolveMatchSet(matches, query, semanticNeedle) {
  if (matches.length === 1) return { session: matches[0] };
  if (matches.length > 1) {
    if (semanticNeedle) {
      // Tie-breaker: If multiple fuzzy matches, check if exactly one matches the title perfectly
      const exactTitleMatches = matches.filter((session) => normalizeSemanticCodeSessionTarget(session.title) === semanticNeedle);
      if (exactTitleMatches.length === 1) return { session: exactTitleMatches[0] };

      // Tie-breaker: If multiple fuzzy matches, check if exactly one matches the path suffix perfectly
      const exactRootMatches = matches.filter((session) => normalizeSemanticCodeSessionTarget(session.workspaceRoot).endsWith(semanticNeedle));
      if (exactRootMatches.length === 1) return { session: exactRootMatches[0] };
    }
    return { error: `More than one coding session matches "${query}". Use a more specific id or path.` };
  }
  return null;
}

function resolveCodeSessionTarget(query, sessions) {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return { error: 'Code session target is empty.' };
  }

  const exactMatches = sessions.filter((session) => (
    session.id === needle
    || session.title.toLowerCase() === needle
    || session.workspaceRoot.toLowerCase() === needle
    || (session.resolvedRoot && session.resolvedRoot.toLowerCase() === needle)
  ));
  const exactResult = resolveMatchSet(exactMatches, query);
  if (exactResult) return exactResult;

  const fuzzyMatches = sessions.filter((session) => (
    session.id.includes(needle)
    || session.title.toLowerCase().includes(needle)
    || session.workspaceRoot.toLowerCase().includes(needle)
    || (session.resolvedRoot && session.resolvedRoot.toLowerCase().includes(needle))
  ));
  const fuzzyResult = resolveMatchSet(fuzzyMatches, query);
  if (fuzzyResult) return fuzzyResult;

  const normalizedNeedle = normalizeCodeSessionTarget(query);
  if (normalizedNeedle) {
    const normalizedExactMatches = sessions.filter((session) => (
      normalizeCodeSessionTarget(session.id) === normalizedNeedle
      || normalizeCodeSessionTarget(session.title) === normalizedNeedle
      || normalizeCodeSessionTarget(session.workspaceRoot) === normalizedNeedle
      || normalizeCodeSessionTarget(session.resolvedRoot ?? '') === normalizedNeedle
    ));
    const normalizedExactResult = resolveMatchSet(normalizedExactMatches, query);
    if (normalizedExactResult) return normalizedExactResult;

    const normalizedFuzzyMatches = sessions.filter((session) => (
      normalizeCodeSessionTarget(session.id).includes(normalizedNeedle)
      || normalizeCodeSessionTarget(session.title).includes(normalizedNeedle)
      || normalizeCodeSessionTarget(session.workspaceRoot).includes(normalizedNeedle)
      || normalizeCodeSessionTarget(session.resolvedRoot ?? '').includes(normalizedNeedle)
    ));
    const normalizedFuzzyResult = resolveMatchSet(normalizedFuzzyMatches, query);
    if (normalizedFuzzyResult) return normalizedFuzzyResult;
  }

  const semanticNeedle = normalizeSemanticCodeSessionTarget(query);
  console.log('semanticNeedle:', semanticNeedle);
  if (semanticNeedle) {
    const semanticExactMatches = sessions.filter((session) => (
      normalizeSemanticCodeSessionTarget(session.id) === semanticNeedle
      || normalizeSemanticCodeSessionTarget(session.title) === semanticNeedle
      || normalizeSemanticCodeSessionTarget(session.workspaceRoot) === semanticNeedle
      || normalizeSemanticCodeSessionTarget(session.resolvedRoot ?? '') === semanticNeedle
    ));
    console.log('semanticExactMatches:', semanticExactMatches.length);
    const semanticExactResult = resolveMatchSet(semanticExactMatches, query, semanticNeedle);
    if (semanticExactResult) return semanticExactResult;

    const semanticFuzzyMatches = sessions.filter((session) => (
      normalizeSemanticCodeSessionTarget(session.id).includes(semanticNeedle)
      || normalizeSemanticCodeSessionTarget(session.title).includes(semanticNeedle)
      || normalizeSemanticCodeSessionTarget(session.workspaceRoot).includes(semanticNeedle)
      || normalizeSemanticCodeSessionTarget(session.resolvedRoot ?? '').includes(semanticNeedle)
    ));
    console.log('semanticFuzzyMatches:', semanticFuzzyMatches.length);
    const semanticFuzzyResult = resolveMatchSet(semanticFuzzyMatches, query, semanticNeedle);
    if (semanticFuzzyResult) return semanticFuzzyResult;
  }

  return { error: `No coding session matched "${query}".` };
}

const sessions = [
  { id: '24745176-9267-47ae-97e9-3c05bc874f52', title: 'Test Tactical Game App', workspaceRoot: 'S:\\Development\\TestApp' },
  { id: 'da47084e-7fde-4638-b77c-3f0bbb5c3684', title: 'Guardian Agent', workspaceRoot: 'S:\\Development\\GuardianAgent' }
];

console.log(resolveCodeSessionTarget('main GuardianAgent repo', sessions));
