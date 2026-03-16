import type { AssistantConnectorPlaybookStepDefinition } from '../config/types.js';
import type { OrchestrationRunEvent } from './run-events.js';

export type GraphRunStatus = 'running' | 'succeeded' | 'failed' | 'awaiting_approval';

export interface PlaybookGraphStartNode {
  id: string;
  type: 'start';
  next: string;
}

export interface PlaybookGraphEndNode {
  id: string;
  type: 'end';
}

export interface PlaybookGraphStepNode {
  id: string;
  type: 'step';
  step: AssistantConnectorPlaybookStepDefinition;
  next?: string;
}

export interface PlaybookGraphParallelNode {
  id: string;
  type: 'parallel';
  steps: AssistantConnectorPlaybookStepDefinition[];
  next?: string;
}

export type PlaybookGraphNode =
  | PlaybookGraphStartNode
  | PlaybookGraphEndNode
  | PlaybookGraphStepNode
  | PlaybookGraphParallelNode;

export interface PlaybookGraphDefinition {
  id: string;
  name: string;
  playbookId: string;
  entryNodeId: string;
  nodes: PlaybookGraphNode[];
}

export interface GraphNodeExecutionResult<TStepResult> {
  status: 'succeeded' | 'failed' | 'pending_approval';
  results: TStepResult[];
  message: string;
}

export interface GraphRunCheckpoint<TStepResult> {
  runId: string;
  graphId: string;
  graphName: string;
  status: GraphRunStatus;
  createdAt: number;
  updatedAt: number;
  currentNodeId?: string;
  completedNodeIds: string[];
  results: TStepResult[];
  events: OrchestrationRunEvent[];
}

export interface GraphRunResult<TStepResult> {
  runId: string;
  graphId: string;
  graphName: string;
  status: GraphRunStatus;
  message: string;
  results: TStepResult[];
  events: OrchestrationRunEvent[];
  checkpoint: GraphRunCheckpoint<TStepResult>;
}
