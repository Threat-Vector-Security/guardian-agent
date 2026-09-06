import type { SecurityNode, SecurityEdge } from './SecurityTypes';
import type { StrideCategory } from './ThreatIntelTypes';
import type { DiagramAttackPath } from './GrcTypes';

export type ManualFindingCategory =
  | 'dfd'
  | 'boundary'
  | 'data'
  | 'identity'
  | 'encryption'
  | 'availability'
  | 'logging'
  | 'configuration'
  | 'threat'
  | 'attackpath';

export type MitigationStatus = 'not_addressed' | 'in_progress' | 'mitigated' | 'accepted' | 'transferred';

export type StrideApplicability = 'applicable' | 'not_applicable' | 'mitigated' | 'accepted';

export interface StrideElementOverride {
  elementId: string;
  overrides: Partial<Record<StrideCategory, StrideApplicability>>;
}

export interface ThreatModelUserState {
  mitigations: Record<string, { status: MitigationStatus; notes?: string }>;
  strideOverrides: StrideElementOverride[];
}

export interface ManualFinding {
  id: string;
  category: ManualFindingCategory;
  title: string;
  description: string;
  related: {
    nodeIds: string[];
    edgeIds: string[];
    zoneIds: string[];
  };
  recommendations: string[];
  ruleId: string;
  createdAt: number;
  updatedAt: number;
  mitigationStatus?: MitigationStatus;
  mitigationNotes?: string;
  attackPathId?: string;
  strideCategories?: StrideCategory[];
}

export interface ManualAnalysisIndex {
  nodeFindings: Record<string, ManualFinding[]>;
  edgeFindings: Record<string, ManualFinding[]>;
  zoneFindings: Record<string, ManualFinding[]>;
}

export interface ManualAnalysisResult {
  findings: ManualFinding[];
  index: ManualAnalysisIndex;
}

export interface ManualAnalysisInputs {
  nodes: SecurityNode[];
  edges: SecurityEdge[];
  zones: SecurityNode[];
  attackPaths?: DiagramAttackPath[];
}
