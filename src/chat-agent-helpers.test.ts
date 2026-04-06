import { describe, expect, it } from 'vitest';
import { formatToolResultForLLM } from './chat-agent-helpers.js';

describe('formatToolResultForLLM', () => {
  it('keeps filesystem search results path-oriented instead of collapsing matches into opaque objects', () => {
    const rendered = formatToolResultForLLM('fs_search', {
      success: true,
      status: 'succeeded',
      output: {
        root: 'S:\\Development\\GuardianAgent',
        query: 'ollama_cloud',
        mode: 'auto',
        scannedDirs: 12,
        scannedFiles: 87,
        truncated: false,
        matches: [
          {
            path: 'S:\\Development\\GuardianAgent\\src\\llm\\provider-registry.ts',
            relativePath: 'src/llm/provider-registry.ts',
            matchType: 'content',
            snippet: 'this.register(\'ollama_cloud\', (config) => new OllamaProvider(config, \'ollama_cloud\'));',
          },
        ],
      },
    });

    expect(rendered).toContain('src/llm/provider-registry.ts');
    expect(rendered).toContain('ollama_cloud');
    expect(rendered).not.toContain('[Object omitted]');
  });

  it('keeps code symbol search results path-oriented instead of collapsing matches into opaque objects', () => {
    const rendered = formatToolResultForLLM('code_symbol_search', {
      success: true,
      status: 'succeeded',
      output: {
        root: 'S:\\Development\\GuardianAgent',
        query: 'ollama_cloud',
        mode: 'auto',
        scannedDirs: 12,
        scannedFiles: 87,
        truncated: false,
        matches: [
          {
            path: 'S:\\Development\\GuardianAgent\\src\\runtime\\message-router.ts',
            relativePath: 'src/runtime/message-router.ts',
            matchType: 'name',
          },
        ],
      },
    });

    expect(rendered).toContain('src/runtime/message-router.ts');
    expect(rendered).not.toContain('[Object omitted]');
  });
});
