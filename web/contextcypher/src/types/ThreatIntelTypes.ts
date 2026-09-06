// src/types/ThreatIntelTypes.ts
import { AlienVaultIndicator, AlienVaultPulse } from './AlienVaultTypes';
import { SecurityNode, SecurityEdge, SecurityZone, DataClassification, SecurityNodeData } from './SecurityTypes';
// Shared immutable vocabulary migrated from ContextCypher's server/types/threatIntelTypes.js.
const SECURITY_SEVERITIES = { CRITICAL: 'CRITICAL', HIGH: 'HIGH', MODERATE: 'MODERATE', LOW: 'LOW', UNKNOWN: 'UNKNOWN' } as const;
const MITRE_TACTICS = {
  INITIAL_ACCESS: 'initial-access', EXECUTION: 'execution', PERSISTENCE: 'persistence',
  PRIVILEGE_ESCALATION: 'privilege-escalation', DEFENSE_EVASION: 'defense-evasion',
  CREDENTIAL_ACCESS: 'credential-access', DISCOVERY: 'discovery', LATERAL_MOVEMENT: 'lateral-movement',
  COLLECTION: 'collection', COMMAND_AND_CONTROL: 'command-and-control', EXFILTRATION: 'exfiltration', IMPACT: 'impact',
} as const;

// Base types for MITRE ATT&CK
export interface MitreTechnique {
  id: string;                    // e.g., "T1190"
  name: string;                  // e.g., "Exploit Public-Facing Application"
  description: string;
  tactics: MitreTactic[];        // e.g., ["initial-access", "persistence"]
  platforms?: string[];          // e.g., ["Windows", "Linux", "Cloud"]
  severity: SecuritySeverity;
}

// Base types for GitHub Security Advisories
export interface GitHubAdvisory {
  id: string;
  title: string;
  description: string;
  summary: string;
  package: {
    name: string;
    ecosystem: string;
    version: string;
  };
  severity: SecuritySeverity;
  affected_packages: Array<{
    name: string;
    ecosystem: string;
  }>;
  affected_versions: string[];
  published_at: string;
  updated_at: string;
  withdrawn_at?: string;
  references: string[];
}

// Add after GitHubAdvisory interface
export interface NVDVulnerability {
  id: string;                    // CVE ID
  description: string;
  severity: SecuritySeverity;    
  published: string;
  references: string[];
  cvss: {
    baseScore: number;
    vector: string;
  };
  affectedVersions: VersionInfo[];
}

// Combined threat intel data structure
export interface ThreatIntelData {
  mitreAttack: {
    techniques: MitreTechnique[];
    lastUpdated: string;
  };
  githubAdvisories: {
    vulnerabilities: GitHubAdvisory[];
    lastUpdated: string;
  };
  alienVault: {
    indicators: AlienVaultIndicator[];
    pulses: AlienVaultPulse[];
    lastUpdated: string;
  };
  nvdVulnerabilities: {         // Add this
    vulnerabilities: NVDVulnerability[];
    lastUpdated: string;
  };
  nodeAnalysis: Record<string, NodeAnalysis>;
  connectionAnalysis: Record<string, ConnectionAnalysis>;
  metadata: {
    sources: {
      mitre: number;
      github: number;
      alienVault: number;
      nvd: number;
    };
    timestamp: string;
  };
}

// Matched results structure
export interface MatchedVulnerabilities {
  mitre: MitreTechnique[];
  github: GitHubAdvisory[];
  alienVault: AlienVaultIndicator[];
  nvd: NVDVulnerability[];
  versions: VersionInfo[];
}

// Analysis Results
export interface BaseAnalysis {
  findings: MatchedVulnerabilities;
  riskLevel: SecuritySeverity;
  confidence: number;
  timestamp: Date;
}

export interface NodeAnalysis extends BaseAnalysis {
  nodeId: string;
}

export interface ConnectionAnalysis extends BaseAnalysis {
  connectionId: string;
  sourceId: string;
  targetId: string;
}

export interface ThreatAnalysis extends NodeAnalysis {
  context?: {
    neighbors: SecurityNode[];
    connections: SecurityEdge[];
  };
  metadata?: {
    analysisDate: Date;
    analysisVersion: string;
    analyst: string;
  };
}

export interface ThreatIntelMatch {
  nodeId: string;
  findings: MatchedVulnerabilities;
  relevanceScore: number;
  contextReasons: string[];
}

export interface ThreatIntelFindings {
  mitre: string[];
  github: string[];
  alienVault: string[];
  matchedNodes: Record<string, MatchedVulnerabilities>;
}

// State Management
export interface ThreatIntelState {
  data: ThreatIntelData | null;
  lastUpdated: Date | null;
  isLoading: boolean;
  error: Error | null;
  nodeAnalysis: Record<string, NodeAnalysis>;
  connectionAnalysis: Record<string, ConnectionAnalysis>;
}

// Action types
export type ThreatIntelAction = 
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: ThreatIntelData }
  | { type: 'FETCH_ERROR'; payload: Error }
  | { type: 'CLEAR_DATA' }
  | { type: 'UPDATE_NODE_ANALYSIS'; payload: { nodeId: string; analysis: NodeAnalysis } }
  | { type: 'UPDATE_CONNECTION_ANALYSIS'; payload: { connectionId: string; analysis: ConnectionAnalysis } };

// Constants and Enums
export type SecuritySeverity = typeof SECURITY_SEVERITIES[keyof typeof SECURITY_SEVERITIES];
export type MitreTactic = typeof MITRE_TACTICS[keyof typeof MITRE_TACTICS];

export type PackageEcosystem = 
  | 'npm'
  | 'pip'
  | 'maven'
  | 'nuget'
  | 'rubygems'
  | 'composer'
  | 'go'
  | 'rust'
  | 'other';

export type MatchConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

// STRIDE Analysis Types
export type StrideCategory = 
  | 'Spoofing'
  | 'Tampering'
  | 'Repudiation'
  | 'Information Disclosure'
  | 'Denial of Service'
  | 'Elevation of Privilege';

export interface StrideThreat {
  category: StrideCategory;
  description: string;
  applicableComponents: string[];
  mitigations: string[];
  relatedMitreTechniques?: string[];
}

export interface StrideAnalysis {
  nodeId: string;
  threats: StrideThreat[];
  confidence: MatchConfidence;
  timestamp: Date;
}

export interface ContextAnalysis {
    drawings: DrawingAnalysis[];
    customContext: CustomContextAnalysis | null;
    messageHistory: MessageAnalysis[];
}

export interface DrawingAnalysis {
    id: string;
    findings: MatchedVulnerabilities;
    riskLevel: SecuritySeverity;
    matchConfidence: MatchConfidence;
}

export interface CustomContextAnalysis {
    findings: MatchedVulnerabilities;
    riskLevel: SecuritySeverity;
    matchConfidence: MatchConfidence;
}

export interface MessageAnalysis {
    id: string;
    findings: MatchedVulnerabilities;
    riskLevel: SecuritySeverity;
    matchConfidence: MatchConfidence;
}

// SecurityNodeData is now imported from SecurityTypes

// CPE (Common Platform Enumeration) types
export interface CPEMatch {
  criteria?: string;
  versionStartIncluding?: string;
  versionStartExcluding?: string;
  versionEndIncluding?: string;
  versionEndExcluding?: string;
}

export interface ConfigNode {
  cpeMatch?: CPEMatch[];
}

export interface Configuration {
  nodes?: ConfigNode[];
}

export interface VersionInfo {
  vendor: string;
  product: string;
  versionRange: string;
}

// Update MatchSources interface to match actual data structure
export interface MatchSources {
  mitre: MitreTechnique[];
  github: GitHubAdvisory[];
  alienVault: AlienVaultIndicator[];
  nvd: NVDVulnerability[];
}

// Update ComponentMatches to match
export interface ComponentMatches {
  componentId: string;
  mitre: MitreTechnique[];
  github: GitHubAdvisory[];
  alienVault: AlienVaultIndicator[];
  nvd: NVDVulnerability[];
}

// ThreatIntelResponse can extend ThreatIntelData if needed
export interface ThreatIntelResponse extends Omit<ThreatIntelData, 'metadata'> {
  metadata: {
    timestamp: Date;
    sources: {
      mitre: number;
      github: number;
      alienVault: number;
      nvd: number;
    };
  };
}
