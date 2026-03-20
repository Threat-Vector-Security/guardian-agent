import { describe, expect, it } from 'vitest';
import {
  getMemoryMutationToolClass,
  getMemoryMutationIntentDeniedMessage,
  isDirectMemoryMutationToolName,
  isElevatedMemoryMutationToolName,
  isMemoryMutationToolName,
  shouldAllowModelMemoryMutation,
} from './memory-intent.js';

describe('memory intent helpers', () => {
  it('detects explicit remember/save requests', () => {
    expect(shouldAllowModelMemoryMutation('Please remember that I prefer concise updates.')).toBe(true);
    expect(shouldAllowModelMemoryMutation('Save this preference for later.')).toBe(true);
    expect(shouldAllowModelMemoryMutation('Search my memory for prior notes.')).toBe(false);
  });

  it('classifies mutating memory tools separately from read-only memory tools', () => {
    expect(isMemoryMutationToolName('memory_save')).toBe(true);
    expect(isMemoryMutationToolName('memory_import')).toBe(true);
    expect(isMemoryMutationToolName('memory_recall')).toBe(false);
    expect(isMemoryMutationToolName('memory_search')).toBe(false);
    expect(isDirectMemoryMutationToolName('memory_save')).toBe(true);
    expect(isElevatedMemoryMutationToolName('memory_import')).toBe(true);
    expect(getMemoryMutationToolClass('memory_save')).toBe('direct_write');
    expect(getMemoryMutationToolClass('memory_import')).toBe('elevated');
  });

  it('returns a stable denial message for model-authored memory saves', () => {
    expect(getMemoryMutationIntentDeniedMessage('memory_save')).toContain('explicit remember/save');
  });
});
