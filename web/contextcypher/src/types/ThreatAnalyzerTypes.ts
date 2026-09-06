// src/types/ThreatAnalyzerTypes.ts

import { 
  SecurityNode, 
  SecurityEdge
} from './SecurityTypes';

import {
  MatchedVulnerabilities,
  NodeAnalysis,
  ConnectionAnalysis,
  StrideAnalysis,
  StrideThreat,
  NVDVulnerability
} from './ThreatIntelTypes';


// Service interface
export interface ThreatAnalyzerService {
  analyzeNode(
    node: SecurityNode,
    context?: {
      neighbors?: SecurityNode[];
      connections?: SecurityEdge[];
    }
  ): Promise<NodeAnalysis>;

  analyzeConnection(
    source: SecurityNode,
    target: SecurityNode,
    edge: SecurityEdge
  ): Promise<ConnectionAnalysis>;
}

// Cache management
export interface CacheEntry<T> {
  data: T;
  expires: number;
  confidence: number;
}

// Re-export types we're using directly
export type {
  NodeAnalysis,
  ConnectionAnalysis,
  StrideAnalysis,
  StrideThreat,
  MatchedVulnerabilities,
  NVDVulnerability
};