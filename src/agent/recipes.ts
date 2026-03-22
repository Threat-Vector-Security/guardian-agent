import { ParallelAgent, SequentialAgent, type OrchestrationStep, type OrchestrationStepContract, type ValidationMode } from './orchestration.js';

export interface OrchestrationRecipe {
  id: string;
  name: string;
  description: string;
  entryAgent: SequentialAgent;
  supportingAgents: Array<SequentialAgent | ParallelAgent>;
}

interface RecipeStepOptions {
  handoffCapabilities?: string[];
  inputContract?: OrchestrationStepContract;
  outputContract?: OrchestrationStepContract;
}

export interface PlannerExecutorValidatorRecipeOptions extends RecipeStepOptions {
  plannerAgentId: string;
  executorAgentId: string;
  validatorAgentId: string;
  validationMode?: ValidationMode;
  planKey?: string;
  draftKey?: string;
  reviewKey?: string;
}

export interface ResearcherWriterReviewerRecipeOptions extends RecipeStepOptions {
  researcherAgentIds: string[];
  writerAgentId: string;
  reviewerAgentId: string;
  validationMode?: ValidationMode;
  maxResearchConcurrency?: number;
  researchBundleAgentId?: string;
  researchKey?: string;
  draftKey?: string;
  reviewKey?: string;
}

export interface ResearchDraftVerifyRecipeOptions extends RecipeStepOptions {
  researcherAgentIds: string[];
  drafterAgentId: string;
  verifierAgentId: string;
  validationMode?: ValidationMode;
  maxResearchConcurrency?: number;
  evidenceBundleAgentId?: string;
  evidenceKey?: string;
  draftKey?: string;
  verifiedKey?: string;
}

function buildHandoff(capabilities: string[] | undefined) {
  if (!capabilities?.length) return undefined;
  return {
    allowedCapabilities: [...capabilities],
    contextMode: 'summary_only' as const,
    preserveTaint: true,
    requireApproval: false,
  };
}

function buildStep(
  agentId: string,
  inputKey: string | undefined,
  outputKey: string,
  options: RecipeStepOptions,
): OrchestrationStep {
  return {
    agentId,
    inputKey,
    outputKey,
    inputContract: options.inputContract,
    outputContract: options.outputContract,
    handoff: buildHandoff(options.handoffCapabilities),
  };
}

export function createPlannerExecutorValidatorRecipe(
  id: string,
  name: string,
  options: PlannerExecutorValidatorRecipeOptions,
): OrchestrationRecipe {
  const planKey = options.planKey ?? 'plan';
  const draftKey = options.draftKey ?? 'draft';
  const reviewKey = options.reviewKey ?? 'validated_output';

  const entryAgent = new SequentialAgent(id, name, {
    validationMode: options.validationMode ?? 'warn',
    steps: [
      buildStep(options.plannerAgentId, undefined, planKey, options),
      buildStep(options.executorAgentId, planKey, draftKey, options),
      buildStep(options.validatorAgentId, draftKey, reviewKey, options),
    ],
  });

  return {
    id,
    name,
    description: 'Planner -> executor -> validator orchestration with explicit state handoff between phases.',
    entryAgent,
    supportingAgents: [],
  };
}

export function createResearcherWriterReviewerRecipe(
  id: string,
  name: string,
  options: ResearcherWriterReviewerRecipeOptions,
): OrchestrationRecipe {
  const researchBundleAgentId = options.researchBundleAgentId ?? `${id}-research-bundle`;
  const researchKey = options.researchKey ?? 'research_bundle';
  const draftKey = options.draftKey ?? 'draft';
  const reviewKey = options.reviewKey ?? 'reviewed_output';

  const researchBundleAgent = new ParallelAgent(researchBundleAgentId, `${name} Research Bundle`, {
    maxConcurrency: options.maxResearchConcurrency ?? 0,
    validationMode: options.validationMode ?? 'warn',
    steps: options.researcherAgentIds.map((agentId) => buildStep(agentId, undefined, `${researchKey}:${agentId}`, options)),
  });

  const entryAgent = new SequentialAgent(id, name, {
    validationMode: options.validationMode ?? 'warn',
    steps: [
      buildStep(researchBundleAgentId, undefined, researchKey, options),
      buildStep(options.writerAgentId, researchKey, draftKey, options),
      buildStep(options.reviewerAgentId, draftKey, reviewKey, options),
    ],
  });

  return {
    id,
    name,
    description: 'Parallel research fan-out followed by writer and reviewer phases for grounded drafting workflows.',
    entryAgent,
    supportingAgents: [researchBundleAgent],
  };
}

export function createResearchDraftVerifyRecipe(
  id: string,
  name: string,
  options: ResearchDraftVerifyRecipeOptions,
): OrchestrationRecipe {
  const evidenceBundleAgentId = options.evidenceBundleAgentId ?? `${id}-evidence-bundle`;
  const evidenceKey = options.evidenceKey ?? 'evidence_bundle';
  const draftKey = options.draftKey ?? 'evidence_draft';
  const verifiedKey = options.verifiedKey ?? 'verified_output';

  const evidenceBundleAgent = new ParallelAgent(evidenceBundleAgentId, `${name} Evidence Bundle`, {
    maxConcurrency: options.maxResearchConcurrency ?? 0,
    validationMode: options.validationMode ?? 'warn',
    steps: options.researcherAgentIds.map((agentId) => buildStep(agentId, undefined, `${evidenceKey}:${agentId}`, options)),
  });

  const entryAgent = new SequentialAgent(id, name, {
    validationMode: options.validationMode ?? 'warn',
    steps: [
      buildStep(evidenceBundleAgentId, undefined, evidenceKey, options),
      buildStep(options.drafterAgentId, evidenceKey, draftKey, options),
      buildStep(options.verifierAgentId, draftKey, verifiedKey, options),
    ],
  });

  return {
    id,
    name,
    description: 'Evidence collection -> drafting -> verification recipe for report and research workflows.',
    entryAgent,
    supportingAgents: [evidenceBundleAgent],
  };
}
