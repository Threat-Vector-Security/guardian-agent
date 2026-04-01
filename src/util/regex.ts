export function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildPathBoundaryPattern(path: string): string {
  const normalizedPath = path.replace(/\\/g, '/');
  return `(^|/)${escapeRegexLiteral(normalizedPath)}(/|$)`;
}
