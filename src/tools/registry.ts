/**
 * In-process tool registry.
 */

import type { ToolDefinition, ToolHandler } from './types.js';

interface RegisteredTool {
  definition: ToolDefinition;
  handler: ToolHandler;
}

export class ToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();

  register(definition: ToolDefinition, handler: ToolHandler): void {
    this.tools.set(definition.name, { definition, handler });
  }

  listDefinitions(): ToolDefinition[] {
    return [...this.tools.values()]
      .map((entry) => entry.definition)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }
}
