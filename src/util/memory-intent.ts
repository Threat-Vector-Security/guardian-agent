type MemoryMutationToolClass = 'direct_write' | 'elevated';

const MODEL_MEMORY_MUTATION_TOOL_CLASSES = new Map<string, MemoryMutationToolClass>([
  ['memory_save', 'direct_write'],
  ['memory_import', 'elevated'],
]);

/**
 * Detect whether a tool mutates durable memory state.
 *
 * The current runtime only exposes memory_save, but future memory mutation tools
 * should register here so the outer planner intent gate and executor checks stay aligned.
 */
export function isMemoryMutationToolName(toolName: string): boolean {
  return MODEL_MEMORY_MUTATION_TOOL_CLASSES.has(toolName.trim());
}

export function getMemoryMutationToolClass(toolName: string): MemoryMutationToolClass | null {
  return MODEL_MEMORY_MUTATION_TOOL_CLASSES.get(toolName.trim()) ?? null;
}

export function isDirectMemoryMutationToolName(toolName: string): boolean {
  return getMemoryMutationToolClass(toolName) === 'direct_write';
}

export function isElevatedMemoryMutationToolName(toolName: string): boolean {
  return getMemoryMutationToolClass(toolName) === 'elevated';
}

/**
 * Detect whether the user's message explicitly asks to save/remember something,
 * which is the only case where model-authored memory mutations are allowed today.
 */
export function shouldAllowModelMemoryMutation(content: string): boolean {
  const lower = content.trim().toLowerCase();
  if (!lower) return false;
  return /\b(remember|memory_save|save (?:this|that|it|these|those|fact|preference|note)|store (?:this|that|it|these|those|fact|preference|note)|keep (?:this|that|it) (?:for later|in mind)|note (?:this|that|it)|commit (?:this|that|it) to memory)\b/.test(lower);
}

/**
 * Backward-compatible alias for older call sites.
 */
export function shouldAllowImplicitMemorySave(content: string): boolean {
  return shouldAllowModelMemoryMutation(content);
}

export function getMemoryMutationIntentDeniedMessage(toolName: string): string {
  if (isDirectMemoryMutationToolName(toolName)) {
    return 'memory_save is reserved for explicit remember/save requests from the user.';
  }
  return `${toolName} is reserved for explicit user-directed memory changes.`;
}
