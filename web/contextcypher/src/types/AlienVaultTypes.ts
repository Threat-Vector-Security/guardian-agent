//alienvaulttypes.ts
// src/types/AlienVaultTypes.ts
import { SecuritySeverity } from './ThreatIntelTypes';

export interface AlienVaultIndicator {
  id: number;
  type: 'IPv4' | 'domain' | 'hostname' | 'URL' | 'FileHash' | 'YARA' | 'CVE';
  indicator: string;
  description: string;
  name: string;
  title: string;
  created: string;
  modified: string;
  severity: SecuritySeverity;
  confidence: number;
  references?: Array<{ url: string }>;
  relatedPulses?: AlienVaultPulse[];
}
  
  export interface AlienVaultPulse {
    id: string;
    name: string;
    description: string;
    author_name: string;
    modified: string;
    created: string;
    tags: string[];
    targeted_countries: string[];
    industries: string[];
    attack_ids: string[]; // MITRE ATT&CK IDs
    indicators: AlienVaultIndicator[];
    references: string[];
    TLP: 'white' | 'green' | 'amber' | 'red';
  }