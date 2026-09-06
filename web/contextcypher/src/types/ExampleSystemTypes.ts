// ExampleSystemTypes.ts
import { SecurityNode, SecurityEdge, SecurityZone, DataClassification } from './SecurityTypes';
import { GrcWorkspace, DiagramAttackPath } from './GrcTypes';

export type SystemCategory = 'Cloud Vendor Architectures' | 'Web Applications' | 'Network Infrastructure' | 'IoT Systems' | 'Cloud Infrastructure' | 'Industrial Control Systems' | 'Enterprise Systems' | 'AI Systems' | 'Cybercrime & Fraud' | 'Privacy & Data Protection' | 'Application Architecture' | 'Red Teaming' | 'Secure Systems' | 'Targeted Threat Scenarios' | 'DFD Threat Models';

export interface ExampleSystem {
  id: string;
  name: string;
  description: string;
  category: SystemCategory;
  primaryZone: SecurityZone;
  dataClassification: DataClassification;
  nodes: SecurityNode[];
  edges: SecurityEdge[];
  customContext?: string;
  grcWorkspace?: GrcWorkspace;
  attackPaths?: DiagramAttackPath[];
}

export interface ExampleSystemCollection {
  [category: string]: ExampleSystem[];
} 