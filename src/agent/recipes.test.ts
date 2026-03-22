import { describe, expect, it, vi } from 'vitest';
import type { AgentContext, AgentResponse, UserMessage } from './types.js';
import {
  createPlannerExecutorValidatorRecipe,
  createResearchDraftVerifyRecipe,
  createResearcherWriterReviewerRecipe,
} from './recipes.js';

function makeMessage(content: string): UserMessage {
  return {
    id: 'msg-1',
    userId: 'user-1',
    channel: 'test',
    content,
    timestamp: Date.now(),
  };
}

function makeContext(dispatch: AgentContext['dispatch']): AgentContext {
  return {
    agentId: 'recipe-test',
    capabilities: Object.freeze([]),
    emit: vi.fn().mockResolvedValue(undefined),
    checkAction: vi.fn(),
    dispatch,
  };
}

describe('orchestration recipes', () => {
  it('builds planner -> executor -> validator pipelines on SequentialAgent', async () => {
    const recipe = createPlannerExecutorValidatorRecipe('pev', 'PEV', {
      plannerAgentId: 'planner',
      executorAgentId: 'executor',
      validatorAgentId: 'validator',
      handoffCapabilities: ['agent.dispatch'],
    });

    const dispatch = vi.fn<[string, UserMessage, unknown?], Promise<AgentResponse>>()
      .mockResolvedValueOnce({ content: '{"tasks":["inspect"]}' })
      .mockResolvedValueOnce({ content: 'draft output' })
      .mockResolvedValueOnce({ content: 'validated output' });

    const result = await recipe.entryAgent.onMessage(makeMessage('investigate this repo'), makeContext(dispatch));

    expect(recipe.supportingAgents).toHaveLength(0);
    expect(dispatch).toHaveBeenCalledTimes(3);
    expect(dispatch.mock.calls[1]?.[1].content).toBe('{"tasks":["inspect"]}');
    expect(dispatch.mock.calls[2]?.[1].content).toBe('draft output');
    expect(result.content).toBe('validated output');
  });

  it('builds researcher -> writer -> reviewer recipes with a supporting ParallelAgent', () => {
    const recipe = createResearcherWriterReviewerRecipe('rwr', 'RWR', {
      researcherAgentIds: ['web', 'docs'],
      writerAgentId: 'writer',
      reviewerAgentId: 'reviewer',
    });

    expect(recipe.supportingAgents).toHaveLength(1);
    expect(recipe.supportingAgents[0]?.id).toBe('rwr-research-bundle');
    expect(recipe.entryAgent.id).toBe('rwr');
  });

  it('builds evidence collection -> draft -> verify recipes with a dedicated bundle agent', () => {
    const recipe = createResearchDraftVerifyRecipe('report', 'Report', {
      researcherAgentIds: ['search-a', 'search-b'],
      drafterAgentId: 'drafter',
      verifierAgentId: 'verifier',
    });

    expect(recipe.supportingAgents).toHaveLength(1);
    expect(recipe.supportingAgents[0]?.id).toBe('report-evidence-bundle');
    expect(recipe.description).toContain('Evidence collection');
  });
});
