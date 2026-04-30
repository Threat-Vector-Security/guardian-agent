import { describe, expect, it } from 'vitest';

import {
  lacksUsableAssistantContent,
  looksLikeRawToolMarkup,
} from './assistant-response-shape.js';

describe('assistant-response-shape', () => {
  it('treats provider tokenized tool calls as raw tool markup', () => {
    const content = [
      'I will search memory now.',
      '<|tool_calls_section_begin|>',
      '<|tool_call_begin|>functions.memory_search:0<|tool_call_argument_begin|>{"query":"*"}',
      '<|tool_call_end|>',
      '<|tool_calls_section_end|>',
    ].join('');

    expect(looksLikeRawToolMarkup(content)).toBe(true);
    expect(lacksUsableAssistantContent(content)).toBe(true);
  });
});
