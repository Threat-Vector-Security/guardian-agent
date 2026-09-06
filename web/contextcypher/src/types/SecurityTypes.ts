//securitytypes.ts
import { Node } from '@xyflow/react';
import React from 'react';
import { NodeShape } from './ShapeTypes';

export interface BaseMetadata {
  lastModified?: Date;
  version?: string;
  drawings?: Drawing[];
  zoneConfiguration?: Record<string, any>;
  isChangeAnalysis?: boolean;
  previousVersion?: string;
  isSanitized?: boolean;
}
// Base security types
export type SecuritySeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

// Security Zones for network segmentation
export type SecurityZone = 
  | 'Internet'
  | 'External'
  | 'DMZ'
  | 'Internal'
  | 'Trusted'
  | 'Restricted'
  | 'Critical'
  | 'OT'
  | 'Development'
  | 'Staging'
  | 'Production'
  | 'Cloud'
  | 'Guest'
  | 'Compliance'
  | 'Management'      // Network management and administrative access
  | 'ControlPlane'   // Network control plane (routing, switching control)
  | 'DataPlane'      // Network data plane (actual data forwarding)
  | 'ServiceMesh'    // Service mesh control and data plane
  | 'BackOffice'     // Back office operations and support systems
  | 'Partner'        // Partner/vendor access zone
  | 'ThirdParty'     // Third party integrations and services
  | 'Quarantine'     // Isolated systems for security analysis
  | 'Recovery'       // Disaster recovery and backup systems
  | 'Edge'           // Edge computing and CDN nodes
  | 'Hybrid'         // Hybrid cloud connectivity zone
  | 'MultiCloud'     // Multi-cloud integration zone
  | 'RedTeam'        // Red team offensive security and attack simulation
  | 'BlueTeam'       // Blue team defensive security and incident response
  | 'PurpleTeam'     // Purple team collaboration bridge between red/blue
  | 'YellowTeam'     // Yellow team secure development and DevSecOps
  | 'GreenTeam'      // Green team secure coding practices and monitoring integration
  | 'OrangeTeam'     // Orange team security awareness training for developers
  | 'WhiteTeam'      // White team objective assessment and oversight
  | 'Generic';       // Generic zone for custom/specialized environments

export const securityZones: SecurityZone[] = [
  'Internet',
  'External',
  'DMZ', 
  'Internal',
  'Trusted',
  'Restricted',
  'Critical',
  'OT',
  'Development',
  'Staging',
  'Production',
  'Cloud',
  'Guest',
  'Compliance',
  'Management',
  'ControlPlane',
  'DataPlane',
  'ServiceMesh',
  'BackOffice',
  'Partner',
  'ThirdParty',
  'Quarantine',
  'Recovery',
  'Edge',
  'Hybrid',
  'MultiCloud',
  'RedTeam',
  'BlueTeam',
  'PurpleTeam',
  'YellowTeam',
  'GreenTeam',
  'OrangeTeam',
  'WhiteTeam',
  'Generic'
];

// Data Classification levels
export type DataClassification =
  | 'Public'        // Anyone can access this data
  | 'Internal'      // For internal use within organization
  | 'Sensitive'     // Requires special handling and protection
  | 'Confidential'; // Highest level of protection required


// Node type definitions
export type InfrastructureNodeType =
  | 'server'
  | 'workstation'
  | 'endpoint'
  | 'desktop'
  | 'laptop'
  | 'tablet'
  | 'smartphone'
  | 'printer'
  | 'router'
  | 'user'
  | 'switch'
  | 'coreRouter'
  | 'edgeRouter'
  | 'accessPoint'
  | 'wirelessController'
  | 'gateway'
  | 'modem'
  | 'networkBridge'
  | 'networkHub'
  | 'dns'
  | 'dhcp'
  | 'ntpServer'
  | 'proxyCache'
  | 'voipPhone'
  | 'pbx'
  | 'sipServer'
  | 'conferenceSystem'
  | 'san'
  | 'nas'
  | 'storageArray'
  | 'tapeLibrary'
  | 'ups'
  | 'pdu'
  | 'hvac'
  | 'rackServer'
  | 'bladeServer'
  | 'loadBalancerHw'
  | 'wanOptimizer'
  | 'networkProbe'
  | 'packetBroker'
  | 'fiberTerminal'
  | 'multiplexer'
  | 'mediaConverter'
  | 'terminalServer'
  | 'cellTower'
  | 'wirelessBridge'
  | 'meshNode'
  | 'repeater'
  | 'edgeServer'
  | 'fogNode'
  | 'microDatacenter'
  | 'kvm'
  | 'serialConsole'
  | 'timeClock'
  | 'environmentSensor'
  | 'thinClient'          // Thin/zero client terminals
  | 'virtualDesktopHost'  // VDI or desktop-virtualization host
  | 'sdwanGateway';       // SD-WAN / edge gateway

// Security Controls node type (comprehensive security components)
export type SecurityControlNodeType =
  | 'firewall'
  | 'vpnGateway'
  | 'ids'
  | 'ips'
  | 'waf'
  | 'proxy'
  | 'reverseProxy'
  | 'monitor'
  | 'siem'
  | 'soar'
  | 'xdr'
  | 'edr'
  | 'ndr'
  | 'casb'
  | 'sase'
  | 'ztna'
  | 'dlp'
  | 'dam'
  | 'pam'
  | 'hsm'
  | 'kms'
  | 'secretsManager'
  | 'certificateAuthority'
  | 'mfa'
  | 'sso'
  | 'ldap'
  | 'radiusServer'
  | 'honeypot'
  | 'honeynet'
  | 'deceptionSystem'
  | 'networkTap'
  | 'packetCapture'
  | 'vulnerabilityScanner'
  | 'patchManagement'
  | 'configManagement'
  | 'complianceScanner'
  | 'penTestTool'
  | 'staticAnalysis'
  | 'dynamicAnalysis'
  | 'containerScanner'
  | 'k8sAdmissionController'
  | 'meshProxy'
  | 'apiSecurity'
  | 'botProtection'
  | 'ddosProtection'
  | 'emailSecurity'
  | 'webFilter'
  | 'sandboxAnalyzer'
  | 'threatIntelPlatform'
  | 'forensicsStation'
  | 'incidentResponsePlatform'
  | 'backupSystem'
  | 'disasterRecovery'
  | 'encryptionGateway'
  | 'tokenizer'
  | 'riskAnalytics'
  | 'identityGovernance'
  | 'cloudSecurityPosture'
  | 'workloadProtection'
  | 'runtimeProtection'
  | 'supplychainSecurity'
  | 'codeRepository'
  | 'cicdSecurity'
  | 'secretScanner'
  | 'sbom'
  | 'dependencyScanner'
  | 'infrastructureAsCode'
  | 'policyAsCode'
  | 'cloudAccessBroker'
  | 'remoteAccessGateway'
  | 'bastionHost'
  | 'jumpServer'
  | 'aiSecurityGateway'
  | 'quantumKeyDistribution'
  | 'blockchainSecurity'
  | 'otSecurityGateway'
  | 'iotSecurityGateway'
  | 'physicalAccessControl'
  | 'videoSurveillance'
  | 'securityOrchestrator'
  | 'applicationDeliveryController' // ADC / gateway
  | 'identityProvider';             // Identity Provider component

export type ApplicationNodeType =
  | 'application'
  | 'database'
  | 'loadBalancer'
  | 'apiGateway'
  | 'webServer'
  | 'authServer'
  | 'messageBroker'
  | 'api'
  | 'service'
  | 'containerizedService'
  | 'cache'
  | 'storage'
  | 'vault'
  | 'identity'
  | 'logging'
  | 'kernelModule'
  | 'deviceDriver'
  | 'hypervisor'
  | 'firmware'
  | 'secureEnclave'
  | 'tpm'
  | 'microcode';

export type CloudNodeType =
  | 'cloudService'
  | 'containerRegistry'
  | 'kubernetesPod'
  | 'kubernetesService'
  | 'storageAccount'
  | 'functionApp'
  | 'apiManagement'
  | 'cloudLoadBalancer'
  | 'cloudFirewall'
  | 'cloudDatabase'
  | 'search';

export type OTNodeType =
  | 'plc'
  | 'hmi'
  | 'historian'
  | 'rtu'
  | 'sensor'
  | 'actuator'
  | 'scadaServer'
  | 'industrialFirewall'
  | 'safetySystem'
  | 'industrialNetwork';

export type AINodeType =
  | 'aiModel'
  | 'llmService'
  | 'mlPipeline'
  | 'aiGateway'
  | 'vectorDatabase'
  | 'modelRegistry'
  | 'inferenceEngine'
  | 'aiWorkbench'
  | 'dataLake'
  | 'featureStore'
  | 'ai'
  | 'mlInference'
  | 'notebookServer'
  | 'computeCluster'
  | 'modelVault'
  | 'securityScanner';

// Cybercrime node types for fraud and attack modeling
export type CybercrimeNodeType =
  | 'fraudDetection'
  | 'transactionMonitor'
  | 'antiMalware'
  | 'honeypot'
  | 'threatFeed'
  | 'sandboxEnv'
  | 'forensicsWorkstation'
  | 'incidentResponse'
  | 'cyberInsurance'
  | 'fraudAnalytics';

// Privacy node types for data protection modeling
export type PrivacyNodeType =
  | 'dataClassifier'
  | 'consentManager'
  | 'dataMapper'
  | 'privacyScanner'
  | 'dataRetention'
  | 'dataAnonymizer'
  | 'gdprCompliance'
  | 'dataBreach'
  | 'privacyImpact'
  | 'dataSubjectRights';

// Application Security node types for internal application architecture
export type AppSecNodeType =
  | 'memoryPool'
  | 'executionContext'
  | 'sessionStore'
  | 'inputBuffer'
  | 'outputBuffer'
  | 'configManager'
  | 'cryptoModule'
  | 'tokenValidator'
  | 'permissionEngine'
  | 'auditLogger';

// Red Teaming node types for attack simulation and penetration testing
export type RedTeamNodeType =
  | 'attackBox'
  | 'payloadServer'
  | 'c2Server'
  | 'implant'
  | 'phishingServer'
  | 'exfilChannel'
  | 'pivotPoint'
  | 'credentialHarvester'
  | 'lateralMovement'
  | 'persistenceMechanism';

// SecOps node types for security operations and threat analysis
export type SecOpsNodeType =
  | 'socWorkstation'
  | 'threatHuntingPlatform'
  | 'ctiFeed'
  | 'attackSurfaceMonitor'
  | 'deceptionToken'
  | 'behaviorAnalytics'
  | 'networkForensics'
  | 'malwareRepository'
  | 'indicatorStore'
  | 'playbookEngine';

export type SecurityZoneNodeType = 'securityZone';

// AWS Services node types
export type AWSNodeType =
  // Compute
  | 'awsEC2'
  | 'awsLambda'
  | 'awsElasticBeanstalk'
  | 'awsECS'
  | 'awsEKS'
  | 'awsFargate'
  // Storage
  | 'awsS3'
  | 'awsEBS'
  | 'awsEFS'
  | 'awsGlacier'
  // Database
  | 'awsRDS'
  | 'awsDynamoDB'
  | 'awsElastiCache'
  | 'awsRedshift'
  | 'awsAurora'
  // Networking & Content Delivery
  | 'awsVPC'
  | 'awsCloudFront'
  | 'awsRoute53'
  | 'awsDirectConnect'
  | 'awsTransitGateway'
  // Application Services
  | 'awsAPIGateway'
  | 'awsSNS'
  | 'awsSQS'
  | 'awsEventBridge'
  // Identity & Access Management
  | 'awsIAM'
  | 'awsCognito'
  | 'awsSSO'
  | 'awsSecretsManager'
  | 'awsKMS'
  | 'awsACM'
  | 'awsDirectory'
  // Security Services
  | 'awsGuardDuty'
  | 'awsSecurityHub'
  | 'awsWAF'
  | 'awsShield'
  | 'awsInspector'
  | 'awsDetective'
  | 'awsFirewallManager'
  | 'awsNetworkFirewall'
  | 'awsConfig'
  | 'awsCloudTrail'
  | 'awsCloudWatch'
  | 'awsMacie'
  | 'awsSecurityLake'
  | 'awsAccessAnalyzer'
  // DevOps & Developer Tools
  | 'awsCodePipeline'
  | 'awsCodeBuild'
  | 'awsCodeDeploy'
  | 'awsCodeCommit'
  // Monitoring & Logging
  | 'awsXRay'
  | 'awsCloudWatchLogs';

// Azure Services node types
export type AzureNodeType =
  // Compute
  | 'azureVM'
  | 'azureAppService'
  | 'azureFunctions'
  | 'azureKubernetesService'
  | 'azureContainerInstances'
  | 'azureContainerApps'
  | 'azureBatch'
  // Storage
  | 'azureBlobStorage'
  | 'azureFileStorage'
  | 'azureManagedDisks'
  | 'azureStorage'
  | 'azureDataLakeStorage'
  // Database
  | 'azureSQLDatabase'
  | 'azureCosmosDB'
  | 'azureRedisCache'
  | 'azureSynapseAnalytics'
  | 'azureDatabaseForPostgreSQL'
  | 'azureDatabaseForMySQL'
  // Networking
  | 'azureVirtualNetwork'
  | 'azureLoadBalancer'
  | 'azureApplicationGateway'
  | 'azureFrontDoor'
  | 'azureVPNGateway'
  | 'azureExpressRoute'
  | 'azureTrafficManager'
  | 'azureDNS'
  // Identity & Access Management
  | 'azureActiveDirectory'
  | 'azureADB2C'
  | 'azureManagedIdentity'
  | 'azureKeyVault'
  | 'azureInformationProtection'
  | 'azurePrivilegedIdentityManagement'
  // Security Services
  | 'azureSecurityCenter'
  | 'azureSentinel'
  | 'azureDefender'
  | 'azureFirewall'
  | 'azureDDoSProtection'
  | 'azureBastion'
  | 'azurePrivateLink'
  | 'azurePolicy'
  | 'azureBlueprints'
  | 'azureArc'
  // Monitoring & Management
  | 'azureMonitor'
  | 'azureLogAnalytics'
  | 'azureApplicationInsights'
  | 'azureAutomation'
  // DevOps
  | 'azureDevOps'
  | 'azureArtifacts'
  | 'azurePipelines';

// GCP Services node types
export type GCPNodeType =
  // Compute
  | 'gcpComputeEngine'
  | 'gcpAppEngine'
  | 'gcpCloudFunctions'
  | 'gcpCloudRun'
  | 'gcpGKE'
  | 'gcpBatch'
  // Storage
  | 'gcpCloudStorage'
  | 'gcpPersistentDisk'
  | 'gcpFilestore'
  | 'gcpContainerRegistry'
  | 'gcpArtifactRegistry'
  // Database
  | 'gcpCloudSQL'
  | 'gcpFirestore'
  | 'gcpBigQuery'
  | 'gcpBigtable'
  | 'gcpSpanner'
  | 'gcpMemorystore'
  // Networking
  | 'gcpVPC'
  | 'gcpCloudLoadBalancing'
  | 'gcpCloudCDN'
  | 'gcpCloudDNS'
  | 'gcpCloudVPN'
  | 'gcpCloudInterconnect'
  | 'gcpCloudArmor'
  // Identity & Access Management
  | 'gcpIAM'
  | 'gcpIdentityPlatform'
  | 'gcpCloudIdentity'
  | 'gcpSecretManager'
  | 'gcpCloudKMS'
  | 'gcpCertificateAuthority'
  // Security Services
  | 'gcpSecurityCommandCenter'
  | 'gcpWebSecurityScanner'
  | 'gcpCloudIDS'
  | 'gcpBinaryAuthorization'
  | 'gcpContainerAnalysis'
  | 'gcpCloudDLP'
  | 'gcpVPCServiceControls'
  | 'gcpAccessContextManager'
  | 'gcpPolicyIntelligence'
  // AI & Machine Learning
  | 'gcpVertexAI'
  | 'gcpAutoML'
  | 'gcpAIPlatform'
  // Monitoring & Logging
  | 'gcpCloudMonitoring'
  | 'gcpCloudLogging'
  | 'gcpCloudTrace'
  | 'gcpCloudProfiler'
  // DevOps
  | 'gcpCloudBuild'
  | 'gcpCloudDeploy'
  | 'gcpCloudSourceRepositories';

// IBM Cloud Services node types
export type IBMNodeType =
  // Compute
  | 'ibmVirtualServer'
  | 'ibmBareMetalServer'
  | 'ibmCodeEngine'
  | 'ibmCloudFunctions'
  | 'ibmKubernetes'
  | 'ibmRedHatOpenShift'
  // Storage
  | 'ibmObjectStorage'
  | 'ibmBlockStorage'
  | 'ibmFileStorage'
  // Database
  | 'ibmDatabase'
  | 'ibmCloudant'
  | 'ibmDB2'
  | 'ibmDatabases'
  // Networking
  | 'ibmVPC'
  | 'ibmLoadBalancer'
  | 'ibmCloudInternetServices'
  | 'ibmDirectLink'
  | 'ibmTransitGateway'
  // Identity & Access
  | 'ibmCloudIAM'
  | 'ibmAppID'
  | 'ibmKeyProtect'
  | 'ibmSecretsManager'
  // Security Services
  | 'ibmSecurityGateway'
  | 'ibmSecurityAdvisor'
  | 'ibmCertificateManager'
  | 'ibmHyperProtect'
  | 'ibmCloudFirewall'
  // Monitoring & Management
  | 'ibmCloudMonitoring'
  | 'ibmLogAnalysis'
  | 'ibmActivityTracker'
  // AI & Data
  | 'ibmWatsonStudio'
  | 'ibmWatsonAssistant'
  | 'ibmWatsonDiscovery'
  // DevOps
  | 'ibmContinuousDelivery'
  | 'ibmCloudShell';

// Generic node type for unknown/fallback components
export type GenericNodeType = 'generic';

// DFD (Data Flow Diagram) node types for STRIDE threat modeling
export type DFDNodeType =
  | 'dfdActor'          // External entities (users, web apps, REST APIs, Lambda, etc.)
  | 'dfdProcess'        // Processing elements (rectangles)
  | 'dfdDataStore'      // Data storage (parallel lines)
  | 'dfdTrustBoundary'; // Trust boundaries (dotted boxes)

// Combined node type
export type SecurityNodeType =
  | InfrastructureNodeType
  | SecurityControlNodeType
  | ApplicationNodeType
  | CloudNodeType
  | OTNodeType
  | AINodeType
  | CybercrimeNodeType
  | PrivacyNodeType
  | AppSecNodeType
  | RedTeamNodeType
  | SecOpsNodeType
  | SecurityZoneNodeType
  | DFDNodeType
  | AWSNodeType
  | AzureNodeType
  | GCPNodeType
  | IBMNodeType
  | GenericNodeType;

// Extract and export the security zone node type variant
export type SecurityZoneNode = {
  id: string;
  type: 'securityZone';
  position: { x: number; y: number };
  data: SecurityZoneNodeData;
  selected?: boolean;
  style?: {
    width: number;
    height: number;
    background?: string;
    opacity?: number;
    zIndex?: number;
  };
};

// DFD categorization for enhanced threat modeling
export type DFDCategory = 'actor' | 'process' | 'dataStore' | 'trustBoundary';

// Base node data interface
interface BaseNodeData {
  label: string;
  description?: string;
  additionalContext?: string; // User-provided context for AI analysis
  dataClassification?: DataClassification;
  protocols?: string[];
  securityControls?: string[];
  accessControl?: {
    authentication?: string[];
    authorization?: string[];
  };
  vendor?: string;
  version?: string;
  technology?: string;
  patchLevel?: string;
  lastUpdated?: string;
  indexCode?: string; // Alphanumeric code generated by DiagramIndexer (e.g., WEB-DMZ-001)
  category?: 'infrastructure' | 'network' | 'application' | 'cloud' | 'ot';
  isDrawingEditMode?: boolean; // Flag for drawing edit mode state
  
  // Optional DFD categorization fields for enhanced threat modeling
  dfdCategory?: DFDCategory; // Which DFD category this node belongs to
  dfdType?: string; // Specific type within the category (replaces actorType/processType/storeType)
}

// Add sanitization-related types
export interface SanitizationMetadata {
  clientValidation: {
    timestamp: Date;
    status: 'validated' | 'pending' | 'failed';
  };
  transitValidation: {
    timestamp: Date;
    status: 'validated' | 'pending' | 'failed';
  };
  isSanitized: boolean;
  replacementPatterns: Array<{
    original: RegExp;
    replacement: string;
  }>;
  preservedProperties: string[];
}

// Add this interface before SanitizedDiagramData
export interface DiagramData {
  nodes: SecurityNode[];
  edges: SecurityEdge[];
  metadata?: DiagramMetadata;
}

// Add DiagramMetadata interface
export interface DiagramMetadata extends BaseMetadata {
  lastModified?: Date;
  version?: string;
  drawings?: Drawing[];
  zoneConfiguration?: Record<string, any>;
  isChangeAnalysis?: boolean;
  previousVersion?: string;
  isSanitized?: boolean;
}

export interface SanitizedDiagramData extends Omit<DiagramData, 'metadata'> {
  metadata: DiagramMetadata & SanitizationMetadata;
}

// Add visual properties interface within SecurityTypes.ts
export interface NodeVisualProps {
  icon?: any;
  // Add other visual-only properties here if needed
}

// Threat/Risk data structures
export interface ThreatData {
  id: string;
  type: 'threat' | 'vulnerability' | 'risk';
  title: string;
  description: string;
  severity: SecuritySeverity;
  likelihood?: 'Very Low' | 'Low' | 'Medium' | 'High' | 'Very High';
  impact?: 'Negligible' | 'Minor' | 'Moderate' | 'Major' | 'Severe';
  risk?: 'Extreme' | 'High' | 'Medium' | 'Minor' | 'Sustainable'; // Added risk property
  riskScore?: number; // 1-10
  category?: string; // STRIDE category, CWE category, etc.
  mitigation?: string;
  status?: 'identified' | 'mitigated' | 'accepted' | 'transferred';
  source: 'manual' | 'auto-analysis' | 'threat-intel';
  createdAt: Date;
  updatedAt: Date;
  // References
  cweId?: string;
  cveId?: string;
  mitreAttackId?: string;
  // One or more MITRE ATT&CK technique IDs (e.g., ["T1078", "T1190"])
  mitreTechniques?: string[];
  nistControl?: string;
}

export interface AttackPath {
  id: string;
  name: string;
  description: string;
  steps: string[];
  likelihood: 'Very Low' | 'Low' | 'Medium' | 'High' | 'Very High';
  impact: 'Negligible' | 'Minor' | 'Moderate' | 'Major' | 'Severe';
  riskScore: number; // 1-10
  mitreAttackChain?: string[]; // MITRE ATT&CK technique IDs
}

export interface SecurityContext {
  summary?: string;
  details?: string;
  threats?: ThreatData[];
  attackPaths?: AttackPath[];
  securityPosture?: {
    score: number; // 0-100
    level: 'Critical' | 'Poor' | 'Fair' | 'Good' | 'Excellent';
    lastAssessed: Date;
  };
  complianceStatus?: {
    frameworks: string[]; // e.g., ['PCI-DSS', 'HIPAA', 'SOC2']
    gaps: string[];
  };
}

// Update SecurityNodeData to extend BaseNodeData
export interface SecurityNodeData extends BaseNodeData {
  label: string;
  description?: string;
  vendor?: string;
  product?: string;
  version?: string;
  technology?: string;
  zone: SecurityZone;
  dataClassification: DataClassification;
  protocols?: string[];
  securityControls?: string[];
  components?: Array<{
    name: string;
    version: string;
  }>;
  icon?: any;
  shape?: NodeShape; // User-selected shape for the node
  // Auto-generated threat/risk data
  securityContext?: SecurityContext;
  [key: string]: unknown;  // Index signature for React Flow v12 compatibility
}

// Security zone node data interface
export interface SecurityZoneNodeData extends BaseNodeData {
  zoneType: SecurityZone;
  // Add optional zone so helper functions can access without type narrowing
  zone?: SecurityZone;
  /**
   * Document-theme presentation override: controlled (blue tint),
   * uncontrolled (red tint) or neutral (gray band). When absent, derived from
   * zoneType. Presentation-only — no analysis semantics.
   */
  containment?: 'controlled' | 'uncontrolled' | 'neutral';
  containedNodes?: string[];
  onDoubleClick?: (event: React.MouseEvent, node: any) => void;
  metadata?: Record<string, any>;
  [key: string]: unknown;  // Index signature for React Flow v12 compatibility
}

// DFD-specific node data interfaces
export interface DFDActorNodeData extends BaseNodeData {
  label: string;
  actorType: string; // User-defined, e.g., "Mobile User", "Payment Gateway", "IoT Sensor", "Admin Console"
  description?: string;
  trustLevel?: 'trusted' | 'untrusted' | 'partial';
  zone?: SecurityZone;
  protocols?: string[];
  authentication?: string;
  [key: string]: unknown;
}

export interface DFDProcessNodeData extends BaseNodeData {
  label: string;
  processType?: string; // User-defined, e.g., "Auth Service", "Order Processing", "Data Transformer", "API Handler"
  description?: string;
  technology?: string;
  zone?: SecurityZone;
  dataClassification?: DataClassification;
  securityControls?: string[];
  [key: string]: unknown;
}

export interface DFDDataStoreNodeData extends BaseNodeData {
  label: string;
  storeType: string; // User-defined, e.g., "User Database", "Session Cache", "Log Files", "Message Queue"
  description?: string;
  technology?: string;
  zone?: SecurityZone;
  dataClassification?: DataClassification;
  encryption?: 'atRest' | 'inTransit' | 'both' | 'none';
  backupStrategy?: string;
  [key: string]: unknown;
}

export interface DFDTrustBoundaryNodeData extends BaseNodeData {
  label: string;
  boundaryType: string; // User-defined, e.g., "Internet Boundary", "Corporate Network", "DMZ Perimeter", "Container Boundary"
  description?: string;
  fromZone?: SecurityZone;
  toZone?: SecurityZone;
  controlsAtBoundary?: string[];
  [key: string]: unknown;
}

// Node interfaces
export type SecurityNode = 
  | (Omit<Node, 'data' | 'type'> & {
      type: Exclude<SecurityNodeType, 'securityZone' | DFDNodeType>;
      data: SecurityNodeData;  // This type includes icon
      selected?: boolean;
      style?: {
        width?: number;
        height?: number;
      };
      edges?: SecurityEdge[];
    })
  | (Omit<Node, 'data' | 'type'> & {
      type: 'securityZone';
      data: SecurityZoneNodeData;  // This type does not include icon
      selected?: boolean;
      style?: {
        width: number;
        height: number;
        background?: string;
        opacity?: number;
        zIndex?: number;
      };
      edges?: SecurityEdge[];
    })
  | (Omit<Node, 'data' | 'type'> & {
      type: 'dfdActor';
      data: DFDActorNodeData;
      selected?: boolean;
      style?: {
        width?: number;
        height?: number;
      };
      edges?: SecurityEdge[];
    })
  | (Omit<Node, 'data' | 'type'> & {
      type: 'dfdProcess';
      data: DFDProcessNodeData;
      selected?: boolean;
      style?: {
        width?: number;
        height?: number;
      };
      edges?: SecurityEdge[];
    })
  | (Omit<Node, 'data' | 'type'> & {
      type: 'dfdDataStore';
      data: DFDDataStoreNodeData;
      selected?: boolean;
      style?: {
        width?: number;
        height?: number;
      };
      edges?: SecurityEdge[];
    })
  | (Omit<Node, 'data' | 'type'> & {
      type: 'dfdTrustBoundary';
      data: DFDTrustBoundaryNodeData;
      selected?: boolean;
      style?: {
        width: number;
        height: number;
        background?: string;
        opacity?: number;
        borderStyle?: string;
        zIndex?: number;
      };
      edges?: SecurityEdge[];
    });

// Control point for edge rerouting
export interface ControlPointData {
  id: string;
  x: number;
  y: number;
  active?: boolean;
}

// Edge interfaces
export interface SecurityEdgeData {
  zoneMode?: 'inherit' | 'override';
  label?: string;
  protocol?: string;
  encryption?: string;
  description?: string;
  additionalContext?: string; // Detailed threat analysis text
  zone?: SecurityZone;
  dataClassification?: DataClassification;
  portRange?: string;
  bandwidth?: string;
  latency?: string;
  redundancy?: boolean;
  securityControls?: string[];
  controlPoints?: ControlPointData[]; // Control points for edge rerouting
  sourceNodeSelected?: boolean; // Whether the source node is selected
  targetNodeSelected?: boolean; // Whether the target node is selected
  // Auto-generated threat/risk data
  securityContext?: SecurityContext;
  // Additional metadata
  metadata?: Record<string, any>;
  // Auto-generated stable reference code (added by edge indexing)
  indexCode?: string;
  [key: string]: unknown;  // Index signature for React Flow v12 compatibility
}

export interface SecurityEdge {
  id: string;
  source: string;
  target: string;
  type: 'securityEdge';
  data: SecurityEdgeData;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  animated?: boolean;
  selected?: boolean;
  style?: {
    stroke?: string;
    strokeWidth?: number;
    strokeDasharray?: string;
    strokeLinecap?: 'round' | 'square' | 'butt';
    zIndex?: number;
  };
}

// Security zone defaults
export const securityZoneDefaults: Record<SecurityZone, {
  
  dataClassification: DataClassification;
  defaultZone: SecurityZone;
}> = {
  Internet: {
    dataClassification: 'Public',
    defaultZone: 'Internet'
  },
  External: {
    dataClassification: 'Public',
    defaultZone: 'External'
  },
  DMZ: {
    dataClassification: 'Internal',
    defaultZone: 'DMZ'
  },
  Internal: {
    dataClassification: 'Internal',
    defaultZone: 'Internal'
  },
  Trusted: {
    dataClassification: 'Sensitive',
    defaultZone: 'Trusted'
  },
  Restricted: {
    dataClassification: 'Confidential',
    defaultZone: 'Restricted'
  },
  Critical: {
    dataClassification: 'Confidential',
    defaultZone: 'Critical'
  },
  OT: {
    dataClassification: 'Confidential',
    defaultZone: 'OT'
  },
  Development: {
    dataClassification: 'Internal',
    defaultZone: 'Development'
  },
  Staging: {
    dataClassification: 'Sensitive',
    defaultZone: 'Staging'
  },
  Production: {
    dataClassification: 'Confidential',
    defaultZone: 'Production'
  },
  Cloud: {
    dataClassification: 'Sensitive',
    defaultZone: 'Cloud'
  },
  Guest: {
    dataClassification: 'Public',
    defaultZone: 'Guest'
  },
  Compliance: {
    dataClassification: 'Confidential',
    defaultZone: 'Compliance'
  },
  Management: {
    dataClassification: 'Internal',
    defaultZone: 'Management'
  },
  ControlPlane: {
    dataClassification: 'Confidential',
    defaultZone: 'ControlPlane'
  },
  DataPlane: {
    dataClassification: 'Sensitive',
    defaultZone: 'DataPlane'
  },
  ServiceMesh: {
    dataClassification: 'Internal',
    defaultZone: 'ServiceMesh'
  },
  BackOffice: {
    dataClassification: 'Internal',
    defaultZone: 'BackOffice'
  },
  Partner: {
    dataClassification: 'Internal',
    defaultZone: 'Partner'
  },
  ThirdParty: {
    dataClassification: 'Internal',
    defaultZone: 'ThirdParty'
  },
  Quarantine: {
    dataClassification: 'Confidential',
    defaultZone: 'Quarantine'
  },
  Recovery: {
    dataClassification: 'Confidential',
    defaultZone: 'Recovery'
  },
  Edge: {
    dataClassification: 'Internal',
    defaultZone: 'Edge'
  },
  Hybrid: {
    dataClassification: 'Sensitive',
    defaultZone: 'Hybrid'
  },
  MultiCloud: {
    dataClassification: 'Sensitive',
    defaultZone: 'MultiCloud'
  },
  RedTeam: {
    dataClassification: 'Confidential',
    defaultZone: 'RedTeam'
  },
  BlueTeam: {
    dataClassification: 'Confidential',
    defaultZone: 'BlueTeam'
  },
  PurpleTeam: {
    dataClassification: 'Confidential',
    defaultZone: 'PurpleTeam'
  },
  YellowTeam: {
    dataClassification: 'Sensitive',
    defaultZone: 'YellowTeam'
  },
  GreenTeam: {
    dataClassification: 'Sensitive',
    defaultZone: 'GreenTeam'
  },
  OrangeTeam: {
    dataClassification: 'Internal',
    defaultZone: 'OrangeTeam'
  },
  WhiteTeam: {
    dataClassification: 'Confidential',
    defaultZone: 'WhiteTeam'
  },
  Generic: {
    dataClassification: 'Internal',
    defaultZone: 'Generic'
  }
};

// Helper functions
export const getZoneDefaults = (zoneType: SecurityZone) => {
  const defaults = securityZoneDefaults[zoneType] || {
    dataClassification: 'Internal',
    defaultZone: 'Internal'
  };

  return {
    dataClassification: defaults.dataClassification,
    zoneType: defaults.defaultZone,
  };
};

// Type guard to check if a node is a security zone node
export const isSecurityZoneNode = (node: SecurityNode): node is SecurityNode & { type: 'securityZone'; data: SecurityZoneNodeData } => {
  return node.type === 'securityZone';
};

export const isSecurityZoneData = (data: any): data is SecurityZoneNodeData => {
  return 'zoneType' in data;
};

// Default security settings for node types
export const defaultSecuritySettings: Record<Exclude<SecurityNodeType, SecurityZoneNodeType>, {
  zone: SecurityZone;
  dataClassification: DataClassification;
}> = {
  // Infrastructure nodes
  server: { zone: 'Internal', dataClassification: 'Internal' },
  workstation: { zone: 'Internal', dataClassification: 'Internal' },
  endpoint: { zone: 'Internal', dataClassification: 'Internal' },
  desktop: { zone: 'Internal', dataClassification: 'Internal' },
  laptop: { zone: 'Guest', dataClassification: 'Internal' },
  tablet: { zone: 'Guest', dataClassification: 'Public' },
  smartphone: { zone: 'Guest', dataClassification: 'Public' },
  printer: { zone: 'Internal', dataClassification: 'Internal' },
  router: { zone: 'DMZ', dataClassification: 'Internal' },
  user: { zone: 'External', dataClassification: 'Public' },
  switch: { zone: 'Internal', dataClassification: 'Internal' },
  coreRouter: { zone: 'Internal', dataClassification: 'Sensitive' },
  edgeRouter: { zone: 'External', dataClassification: 'Internal' },
  accessPoint: { zone: 'Internal', dataClassification: 'Internal' },
  wirelessController: { zone: 'Management', dataClassification: 'Sensitive' },
  gateway: { zone: 'DMZ', dataClassification: 'Internal' },
  modem: { zone: 'External', dataClassification: 'Public' },
  networkBridge: { zone: 'Internal', dataClassification: 'Internal' },
  networkHub: { zone: 'Internal', dataClassification: 'Internal' },
  dns: { zone: 'DMZ', dataClassification: 'Internal' },
  dhcp: { zone: 'Management', dataClassification: 'Sensitive' },
  ntpServer: { zone: 'Management', dataClassification: 'Internal' },
  proxyCache: { zone: 'DMZ', dataClassification: 'Internal' },
  voipPhone: { zone: 'Internal', dataClassification: 'Internal' },
  pbx: { zone: 'Internal', dataClassification: 'Sensitive' },
  sipServer: { zone: 'Internal', dataClassification: 'Sensitive' },
  conferenceSystem: { zone: 'Internal', dataClassification: 'Internal' },
  san: { zone: 'Restricted', dataClassification: 'Confidential' },
  nas: { zone: 'Internal', dataClassification: 'Sensitive' },
  storageArray: { zone: 'Restricted', dataClassification: 'Confidential' },
  tapeLibrary: { zone: 'Recovery', dataClassification: 'Confidential' },
  ups: { zone: 'Internal', dataClassification: 'Internal' },
  pdu: { zone: 'Internal', dataClassification: 'Internal' },
  hvac: { zone: 'Internal', dataClassification: 'Public' },
  rackServer: { zone: 'Internal', dataClassification: 'Internal' },
  bladeServer: { zone: 'Internal', dataClassification: 'Sensitive' },
  loadBalancerHw: { zone: 'DMZ', dataClassification: 'Internal' },
  wanOptimizer: { zone: 'DMZ', dataClassification: 'Internal' },
  networkProbe: { zone: 'Management', dataClassification: 'Confidential' },
  packetBroker: { zone: 'Management', dataClassification: 'Confidential' },
  fiberTerminal: { zone: 'External', dataClassification: 'Internal' },
  multiplexer: { zone: 'DMZ', dataClassification: 'Internal' },
  mediaConverter: { zone: 'Internal', dataClassification: 'Internal' },
  terminalServer: { zone: 'Management', dataClassification: 'Confidential' },
  cellTower: { zone: 'External', dataClassification: 'Public' },
  wirelessBridge: { zone: 'Partner', dataClassification: 'Internal' },
  meshNode: { zone: 'Edge', dataClassification: 'Internal' },
  repeater: { zone: 'Internal', dataClassification: 'Public' },
  edgeServer: { zone: 'Edge', dataClassification: 'Sensitive' },
  fogNode: { zone: 'Edge', dataClassification: 'Internal' },
  microDatacenter: { zone: 'Edge', dataClassification: 'Sensitive' },
  kvm: { zone: 'Management', dataClassification: 'Confidential' },
  serialConsole: { zone: 'Management', dataClassification: 'Confidential' },
  timeClock: { zone: 'Internal', dataClassification: 'Public' },
  environmentSensor: { zone: 'Internal', dataClassification: 'Public' },
  thinClient: { zone: 'Guest', dataClassification: 'Internal' },
  virtualDesktopHost: { zone: 'Internal', dataClassification: 'Sensitive' },
  sdwanGateway: { zone: 'Edge', dataClassification: 'Sensitive' },
  applicationDeliveryController: { zone: 'DMZ', dataClassification: 'Sensitive' },
  identityProvider: { zone: 'DMZ', dataClassification: 'Sensitive' },
  // duplicate entries removed from infrastructure block – see Security Control nodes section below for definitions
  
  // Security Control nodes (restored)
  firewall: { zone: 'DMZ', dataClassification: 'Confidential' },
  vpnGateway: { zone: 'External', dataClassification: 'Confidential' },
  ids: { zone: 'Internal', dataClassification: 'Sensitive' },
  ips: { zone: 'DMZ', dataClassification: 'Confidential' },
  waf: { zone: 'DMZ', dataClassification: 'Sensitive' },
  proxy: { zone: 'DMZ', dataClassification: 'Internal' },
  reverseProxy: { zone: 'DMZ', dataClassification: 'Internal' },
  monitor: { zone: 'Management', dataClassification: 'Sensitive' },
  siem: { zone: 'Management', dataClassification: 'Confidential' },
  soar: { zone: 'Management', dataClassification: 'Confidential' },
  xdr: { zone: 'Management', dataClassification: 'Confidential' },
  edr: { zone: 'Internal', dataClassification: 'Sensitive' },
  ndr: { zone: 'Management', dataClassification: 'Sensitive' },
  casb: { zone: 'Cloud', dataClassification: 'Sensitive' },
  sase: { zone: 'Cloud', dataClassification: 'Sensitive' },
  ztna: { zone: 'External', dataClassification: 'Confidential' },
  dlp: { zone: 'Internal', dataClassification: 'Confidential' },
  dam: { zone: 'Restricted', dataClassification: 'Confidential' },
  pam: { zone: 'Restricted', dataClassification: 'Confidential' },
  hsm: { zone: 'Restricted', dataClassification: 'Confidential' },
  kms: { zone: 'Restricted', dataClassification: 'Confidential' },
  secretsManager: { zone: 'Restricted', dataClassification: 'Confidential' },
  certificateAuthority: { zone: 'Restricted', dataClassification: 'Confidential' },
  mfa: { zone: 'External', dataClassification: 'Sensitive' },
  sso: { zone: 'DMZ', dataClassification: 'Sensitive' },
  ldap: { zone: 'Internal', dataClassification: 'Sensitive' },
  radiusServer: { zone: 'Management', dataClassification: 'Sensitive' },
  honeypot: { zone: 'DMZ', dataClassification: 'Public' },
  honeynet: { zone: 'DMZ', dataClassification: 'Public' },
  deceptionSystem: { zone: 'Internal', dataClassification: 'Internal' },
  networkTap: { zone: 'Management', dataClassification: 'Confidential' },
  packetCapture: { zone: 'Management', dataClassification: 'Confidential' },
  vulnerabilityScanner: { zone: 'Management', dataClassification: 'Sensitive' },
  patchManagement: { zone: 'Management', dataClassification: 'Sensitive' },
  configManagement: { zone: 'Management', dataClassification: 'Sensitive' },
  complianceScanner: { zone: 'Compliance', dataClassification: 'Sensitive' },
  penTestTool: { zone: 'Management', dataClassification: 'Confidential' },
  staticAnalysis: { zone: 'Development', dataClassification: 'Sensitive' },
  dynamicAnalysis: { zone: 'Staging', dataClassification: 'Sensitive' },
  containerScanner: { zone: 'Development', dataClassification: 'Sensitive' },
  k8sAdmissionController: { zone: 'Cloud', dataClassification: 'Confidential' },
  meshProxy: { zone: 'ServiceMesh', dataClassification: 'Internal' },
  apiSecurity: { zone: 'DMZ', dataClassification: 'Sensitive' },
  botProtection: { zone: 'External', dataClassification: 'Public' },
  ddosProtection: { zone: 'Internet', dataClassification: 'Public' },
  emailSecurity: { zone: 'DMZ', dataClassification: 'Sensitive' },
  webFilter: { zone: 'DMZ', dataClassification: 'Internal' },
  sandboxAnalyzer: { zone: 'Quarantine', dataClassification: 'Confidential' },
  threatIntelPlatform: { zone: 'Management', dataClassification: 'Sensitive' },
  forensicsStation: { zone: 'Restricted', dataClassification: 'Confidential' },
  incidentResponsePlatform: { zone: 'Management', dataClassification: 'Confidential' },
  backupSystem: { zone: 'Recovery', dataClassification: 'Confidential' },
  disasterRecovery: { zone: 'Recovery', dataClassification: 'Confidential' },
  encryptionGateway: { zone: 'DMZ', dataClassification: 'Confidential' },
  tokenizer: { zone: 'Restricted', dataClassification: 'Confidential' },
  riskAnalytics: { zone: 'Management', dataClassification: 'Sensitive' },
  identityGovernance: { zone: 'Restricted', dataClassification: 'Confidential' },
  cloudSecurityPosture: { zone: 'Cloud', dataClassification: 'Sensitive' },
  workloadProtection: { zone: 'Cloud', dataClassification: 'Sensitive' },
  runtimeProtection: { zone: 'Production', dataClassification: 'Confidential' },
  supplychainSecurity: { zone: 'Development', dataClassification: 'Sensitive' },
  codeRepository: { zone: 'Development', dataClassification: 'Sensitive' },
  cicdSecurity: { zone: 'Development', dataClassification: 'Sensitive' },
  secretScanner: { zone: 'Development', dataClassification: 'Confidential' },
  sbom: { zone: 'Development', dataClassification: 'Internal' },
  dependencyScanner: { zone: 'Development', dataClassification: 'Sensitive' },
  infrastructureAsCode: { zone: 'Development', dataClassification: 'Sensitive' },
  policyAsCode: { zone: 'Management', dataClassification: 'Sensitive' },
  cloudAccessBroker: { zone: 'Cloud', dataClassification: 'Sensitive' },
  remoteAccessGateway: { zone: 'External', dataClassification: 'Confidential' },
  bastionHost: { zone: 'DMZ', dataClassification: 'Confidential' },
  jumpServer: { zone: 'Management', dataClassification: 'Confidential' },
  aiSecurityGateway: { zone: 'DMZ', dataClassification: 'Sensitive' },
  quantumKeyDistribution: { zone: 'Restricted', dataClassification: 'Confidential' },
  blockchainSecurity: { zone: 'Hybrid', dataClassification: 'Sensitive' },
  otSecurityGateway: { zone: 'OT', dataClassification: 'Confidential' },
  iotSecurityGateway: { zone: 'Edge', dataClassification: 'Sensitive' },
  physicalAccessControl: { zone: 'Internal', dataClassification: 'Sensitive' },
  videoSurveillance: { zone: 'Internal', dataClassification: 'Internal' },
  securityOrchestrator: { zone: 'Management', dataClassification: 'Confidential' },

  // Application nodes 
  application: { zone: 'Internal', dataClassification: 'Internal' },
  database: { zone: 'Restricted', dataClassification: 'Confidential' },
  loadBalancer: { zone: 'DMZ', dataClassification: 'Internal' },
  apiGateway: { zone: 'DMZ', dataClassification: 'Sensitive' },
  webServer: { zone: 'DMZ', dataClassification: 'Public' },
  authServer: { zone: 'Restricted', dataClassification: 'Confidential' },
  messageBroker: { zone: 'Internal', dataClassification: 'Sensitive' },
  api: { zone: 'DMZ', dataClassification: 'Sensitive' },
  service: { zone: 'Internal', dataClassification: 'Internal' },
  containerizedService: { zone: 'Internal', dataClassification: 'Internal' },
  cache: { zone: 'Internal', dataClassification: 'Internal' },
  storage: { zone: 'Restricted', dataClassification: 'Confidential' },
  vault: { zone: 'Restricted', dataClassification: 'Confidential' },
  identity: { zone: 'Restricted', dataClassification: 'Confidential' },
  logging: { zone: 'Management', dataClassification: 'Sensitive' },
  kernelModule: { zone: 'Internal', dataClassification: 'Internal' },
  deviceDriver: { zone: 'Internal', dataClassification: 'Internal' },
  hypervisor: { zone: 'Internal', dataClassification: 'Sensitive' },
  firmware: { zone: 'Internal', dataClassification: 'Sensitive' },
  secureEnclave: { zone: 'Internal', dataClassification: 'Sensitive' },
  tpm: { zone: 'Internal', dataClassification: 'Sensitive' },
  microcode: { zone: 'Internal', dataClassification: 'Sensitive' },

  // Cloud nodes
  cloudService: { zone: 'Cloud', dataClassification: 'Internal' },
  containerRegistry: { zone: 'Cloud', dataClassification: 'Sensitive' },
  kubernetesPod: { zone: 'Cloud', dataClassification: 'Internal' },
  kubernetesService: { zone: 'Cloud', dataClassification: 'Internal' },
  storageAccount: { zone: 'Cloud', dataClassification: 'Confidential' },
  functionApp: { zone: 'Cloud', dataClassification: 'Internal' },
  apiManagement: { zone: 'Cloud', dataClassification: 'Sensitive' },
  cloudLoadBalancer: { zone: 'Cloud', dataClassification: 'Internal' },
  cloudFirewall: { zone: 'Cloud', dataClassification: 'Sensitive' },
  cloudDatabase: { zone: 'Cloud', dataClassification: 'Confidential' },
  search: { zone: 'Cloud', dataClassification: 'Sensitive' },

  // OT nodes
  plc: { zone: 'OT', dataClassification: 'Confidential' },
  hmi: { zone: 'OT', dataClassification: 'Sensitive' },
  historian: { zone: 'DMZ', dataClassification: 'Sensitive' },
  rtu: { zone: 'OT', dataClassification: 'Confidential' },
  sensor: { zone: 'OT', dataClassification: 'Sensitive' },
  actuator: { zone: 'OT', dataClassification: 'Confidential' },
  scadaServer: { zone: 'OT', dataClassification: 'Confidential' },
  industrialFirewall: { zone: 'OT', dataClassification: 'Confidential' },
  safetySystem: { zone: 'OT', dataClassification: 'Confidential' },
  industrialNetwork: { zone: 'OT', dataClassification: 'Sensitive' },

  // AI nodes
  aiModel: { zone: 'Restricted', dataClassification: 'Confidential' },
  llmService: { zone: 'Cloud', dataClassification: 'Sensitive' },
  mlPipeline: { zone: 'Development', dataClassification: 'Sensitive' },
  aiGateway: { zone: 'DMZ', dataClassification: 'Sensitive' },
  vectorDatabase: { zone: 'Restricted', dataClassification: 'Confidential' },
  modelRegistry: { zone: 'Internal', dataClassification: 'Sensitive' },
  inferenceEngine: { zone: 'Production', dataClassification: 'Sensitive' },
  aiWorkbench: { zone: 'Development', dataClassification: 'Internal' },
  dataLake: { zone: 'Restricted', dataClassification: 'Confidential' },
  featureStore: { zone: 'Internal', dataClassification: 'Sensitive' },
  ai: { zone: 'Internal', dataClassification: 'Sensitive' },
  mlInference: { zone: 'Production', dataClassification: 'Sensitive' },
  notebookServer: { zone: 'Development', dataClassification: 'Internal' },
  computeCluster: { zone: 'Internal', dataClassification: 'Sensitive' },
  modelVault: { zone: 'Restricted', dataClassification: 'Confidential' },
  securityScanner: { zone: 'Management', dataClassification: 'Internal' },

  // Cybercrime nodes
  fraudDetection: { zone: 'Production', dataClassification: 'Sensitive' },
  transactionMonitor: { zone: 'Production', dataClassification: 'Confidential' },
  antiMalware: { zone: 'Internal', dataClassification: 'Internal' },
  // honeypot is already defined in Security Control section
  threatFeed: { zone: 'Internet', dataClassification: 'Public' },
  sandboxEnv: { zone: 'Quarantine', dataClassification: 'Confidential' },
  forensicsWorkstation: { zone: 'Restricted', dataClassification: 'Confidential' },
  incidentResponse: { zone: 'Management', dataClassification: 'Confidential' },
  cyberInsurance: { zone: 'External', dataClassification: 'Internal' },
  fraudAnalytics: { zone: 'Management', dataClassification: 'Sensitive' },

  // Privacy nodes
  dataClassifier: { zone: 'Management', dataClassification: 'Sensitive' },
  consentManager: { zone: 'DMZ', dataClassification: 'Sensitive' },
  dataMapper: { zone: 'Compliance', dataClassification: 'Sensitive' },
  privacyScanner: { zone: 'Compliance', dataClassification: 'Sensitive' },
  dataRetention: { zone: 'Management', dataClassification: 'Confidential' },
  dataAnonymizer: { zone: 'Restricted', dataClassification: 'Confidential' },
  gdprCompliance: { zone: 'Compliance', dataClassification: 'Sensitive' },
  dataBreach: { zone: 'Management', dataClassification: 'Confidential' },
  privacyImpact: { zone: 'Compliance', dataClassification: 'Sensitive' },
  dataSubjectRights: { zone: 'Compliance', dataClassification: 'Sensitive' },

  // Application Architecture nodes
  memoryPool: { zone: 'Internal', dataClassification: 'Internal' },
  executionContext: { zone: 'Internal', dataClassification: 'Internal' },
  sessionStore: { zone: 'Internal', dataClassification: 'Sensitive' },
  inputBuffer: { zone: 'DMZ', dataClassification: 'Internal' },
  outputBuffer: { zone: 'DMZ', dataClassification: 'Internal' },
  configManager: { zone: 'Internal', dataClassification: 'Sensitive' },
  cryptoModule: { zone: 'Restricted', dataClassification: 'Confidential' },
  tokenValidator: { zone: 'Internal', dataClassification: 'Sensitive' },
  permissionEngine: { zone: 'Restricted', dataClassification: 'Confidential' },
  auditLogger: { zone: 'Management', dataClassification: 'Sensitive' },

  // Red Teaming nodes
  attackBox: { zone: 'Internet', dataClassification: 'Public' },
  payloadServer: { zone: 'Internet', dataClassification: 'Public' },
  c2Server: { zone: 'Internet', dataClassification: 'Public' },
  implant: { zone: 'Internal', dataClassification: 'Internal' },
  phishingServer: { zone: 'Internet', dataClassification: 'Public' },
  exfilChannel: { zone: 'Internet', dataClassification: 'Public' },
  pivotPoint: { zone: 'DMZ', dataClassification: 'Internal' },
  credentialHarvester: { zone: 'DMZ', dataClassification: 'Internal' },
  lateralMovement: { zone: 'Internal', dataClassification: 'Internal' },
  persistenceMechanism: { zone: 'Internal', dataClassification: 'Internal' },
  
  // SecOps nodes
  socWorkstation: { zone: 'Management', dataClassification: 'Confidential' },
  threatHuntingPlatform: { zone: 'Management', dataClassification: 'Confidential' },
  ctiFeed: { zone: 'DMZ', dataClassification: 'Sensitive' },
  attackSurfaceMonitor: { zone: 'DMZ', dataClassification: 'Sensitive' },
  deceptionToken: { zone: 'Internal', dataClassification: 'Internal' },
  behaviorAnalytics: { zone: 'Management', dataClassification: 'Sensitive' },
  networkForensics: { zone: 'Management', dataClassification: 'Confidential' },
  malwareRepository: { zone: 'Quarantine', dataClassification: 'Confidential' },
  indicatorStore: { zone: 'Management', dataClassification: 'Sensitive' },
  playbookEngine: { zone: 'Management', dataClassification: 'Sensitive' },
  
  // Generic fallback node
  generic: { zone: 'Internal', dataClassification: 'Public' },
  
  // DFD nodes
  dfdActor: { zone: 'External', dataClassification: 'Public' },
  dfdProcess: { zone: 'Internal', dataClassification: 'Internal' },
  dfdDataStore: { zone: 'Internal', dataClassification: 'Sensitive' },
  dfdTrustBoundary: { zone: 'DMZ', dataClassification: 'Internal' },

  // AWS Services
  // Compute
  awsEC2: { zone: 'Cloud', dataClassification: 'Internal' },
  awsLambda: { zone: 'Cloud', dataClassification: 'Internal' },
  awsElasticBeanstalk: { zone: 'Cloud', dataClassification: 'Internal' },
  awsECS: { zone: 'Cloud', dataClassification: 'Internal' },
  awsEKS: { zone: 'Cloud', dataClassification: 'Internal' },
  awsFargate: { zone: 'Cloud', dataClassification: 'Internal' },
  // Storage
  awsS3: { zone: 'Cloud', dataClassification: 'Sensitive' },
  awsEBS: { zone: 'Cloud', dataClassification: 'Sensitive' },
  awsEFS: { zone: 'Cloud', dataClassification: 'Sensitive' },
  awsGlacier: { zone: 'Cloud', dataClassification: 'Confidential' },
  // Database
  awsRDS: { zone: 'Cloud', dataClassification: 'Confidential' },
  awsDynamoDB: { zone: 'Cloud', dataClassification: 'Confidential' },
  awsElastiCache: { zone: 'Cloud', dataClassification: 'Sensitive' },
  awsRedshift: { zone: 'Cloud', dataClassification: 'Confidential' },
  awsAurora: { zone: 'Cloud', dataClassification: 'Confidential' },
  // Networking & Content Delivery
  awsVPC: { zone: 'Cloud', dataClassification: 'Internal' },
  awsCloudFront: { zone: 'Cloud', dataClassification: 'Public' },
  awsRoute53: { zone: 'Cloud', dataClassification: 'Public' },
  awsDirectConnect: { zone: 'Cloud', dataClassification: 'Internal' },
  awsTransitGateway: { zone: 'Cloud', dataClassification: 'Internal' },
  // Application Services
  awsAPIGateway: { zone: 'Cloud', dataClassification: 'Internal' },
  awsSNS: { zone: 'Cloud', dataClassification: 'Internal' },
  awsSQS: { zone: 'Cloud', dataClassification: 'Internal' },
  awsEventBridge: { zone: 'Cloud', dataClassification: 'Internal' },
  // Identity & Access Management
  awsIAM: { zone: 'Restricted', dataClassification: 'Confidential' },
  awsCognito: { zone: 'Cloud', dataClassification: 'Sensitive' },
  awsSSO: { zone: 'Restricted', dataClassification: 'Confidential' },
  awsSecretsManager: { zone: 'Restricted', dataClassification: 'Confidential' },
  awsKMS: { zone: 'Restricted', dataClassification: 'Confidential' },
  awsACM: { zone: 'Cloud', dataClassification: 'Sensitive' },
  awsDirectory: { zone: 'Restricted', dataClassification: 'Confidential' },
  // Security Services
  awsGuardDuty: { zone: 'Management', dataClassification: 'Sensitive' },
  awsSecurityHub: { zone: 'Management', dataClassification: 'Sensitive' },
  awsWAF: { zone: 'Cloud', dataClassification: 'Sensitive' },
  awsShield: { zone: 'Cloud', dataClassification: 'Sensitive' },
  awsInspector: { zone: 'Management', dataClassification: 'Sensitive' },
  awsDetective: { zone: 'Management', dataClassification: 'Confidential' },
  awsFirewallManager: { zone: 'Management', dataClassification: 'Sensitive' },
  awsNetworkFirewall: { zone: 'Cloud', dataClassification: 'Sensitive' },
  awsConfig: { zone: 'Management', dataClassification: 'Sensitive' },
  awsCloudTrail: { zone: 'Management', dataClassification: 'Confidential' },
  awsCloudWatch: { zone: 'Management', dataClassification: 'Sensitive' },
  awsMacie: { zone: 'Management', dataClassification: 'Sensitive' },
  awsSecurityLake: { zone: 'Management', dataClassification: 'Confidential' },
  awsAccessAnalyzer: { zone: 'Management', dataClassification: 'Sensitive' },
  // DevOps & Developer Tools
  awsCodePipeline: { zone: 'Development', dataClassification: 'Sensitive' },
  awsCodeBuild: { zone: 'Development', dataClassification: 'Sensitive' },
  awsCodeDeploy: { zone: 'Development', dataClassification: 'Sensitive' },
  awsCodeCommit: { zone: 'Development', dataClassification: 'Sensitive' },
  // Monitoring & Logging
  awsXRay: { zone: 'Management', dataClassification: 'Sensitive' },
  awsCloudWatchLogs: { zone: 'Management', dataClassification: 'Sensitive' },

  // Azure Services
  // Compute
  azureVM: { zone: 'Cloud', dataClassification: 'Internal' },
  azureAppService: { zone: 'Cloud', dataClassification: 'Internal' },
  azureFunctions: { zone: 'Cloud', dataClassification: 'Internal' },
  azureKubernetesService: { zone: 'Cloud', dataClassification: 'Internal' },
  azureContainerInstances: { zone: 'Cloud', dataClassification: 'Internal' },
  azureContainerApps: { zone: 'Cloud', dataClassification: 'Internal' },
  azureBatch: { zone: 'Cloud', dataClassification: 'Internal' },
  // Storage
  azureBlobStorage: { zone: 'Cloud', dataClassification: 'Sensitive' },
  azureFileStorage: { zone: 'Cloud', dataClassification: 'Sensitive' },
  azureManagedDisks: { zone: 'Cloud', dataClassification: 'Sensitive' },
  azureStorage: { zone: 'Cloud', dataClassification: 'Sensitive' },
  azureDataLakeStorage: { zone: 'Cloud', dataClassification: 'Confidential' },
  // Database
  azureSQLDatabase: { zone: 'Cloud', dataClassification: 'Confidential' },
  azureCosmosDB: { zone: 'Cloud', dataClassification: 'Confidential' },
  azureRedisCache: { zone: 'Cloud', dataClassification: 'Sensitive' },
  azureSynapseAnalytics: { zone: 'Cloud', dataClassification: 'Confidential' },
  azureDatabaseForPostgreSQL: { zone: 'Cloud', dataClassification: 'Confidential' },
  azureDatabaseForMySQL: { zone: 'Cloud', dataClassification: 'Confidential' },
  // Networking
  azureVirtualNetwork: { zone: 'Cloud', dataClassification: 'Internal' },
  azureLoadBalancer: { zone: 'Cloud', dataClassification: 'Internal' },
  azureApplicationGateway: { zone: 'Cloud', dataClassification: 'Internal' },
  azureFrontDoor: { zone: 'Cloud', dataClassification: 'Internal' },
  azureVPNGateway: { zone: 'Cloud', dataClassification: 'Sensitive' },
  azureExpressRoute: { zone: 'Cloud', dataClassification: 'Sensitive' },
  azureTrafficManager: { zone: 'Cloud', dataClassification: 'Internal' },
  azureDNS: { zone: 'Cloud', dataClassification: 'Public' },
  // Identity & Access Management
  azureActiveDirectory: { zone: 'Restricted', dataClassification: 'Confidential' },
  azureADB2C: { zone: 'Cloud', dataClassification: 'Sensitive' },
  azureManagedIdentity: { zone: 'Restricted', dataClassification: 'Confidential' },
  azureKeyVault: { zone: 'Restricted', dataClassification: 'Confidential' },
  azureInformationProtection: { zone: 'Management', dataClassification: 'Sensitive' },
  azurePrivilegedIdentityManagement: { zone: 'Restricted', dataClassification: 'Confidential' },
  // Security Services
  azureSecurityCenter: { zone: 'Management', dataClassification: 'Sensitive' },
  azureSentinel: { zone: 'Management', dataClassification: 'Confidential' },
  azureDefender: { zone: 'Management', dataClassification: 'Sensitive' },
  azureFirewall: { zone: 'Cloud', dataClassification: 'Sensitive' },
  azureDDoSProtection: { zone: 'Cloud', dataClassification: 'Sensitive' },
  azureBastion: { zone: 'Cloud', dataClassification: 'Sensitive' },
  azurePrivateLink: { zone: 'Cloud', dataClassification: 'Sensitive' },
  azurePolicy: { zone: 'Management', dataClassification: 'Sensitive' },
  azureBlueprints: { zone: 'Management', dataClassification: 'Sensitive' },
  azureArc: { zone: 'Management', dataClassification: 'Sensitive' },
  // Monitoring & Management
  azureMonitor: { zone: 'Management', dataClassification: 'Sensitive' },
  azureLogAnalytics: { zone: 'Management', dataClassification: 'Sensitive' },
  azureApplicationInsights: { zone: 'Management', dataClassification: 'Sensitive' },
  azureAutomation: { zone: 'Management', dataClassification: 'Sensitive' },
  // DevOps
  azureDevOps: { zone: 'Development', dataClassification: 'Sensitive' },
  azureArtifacts: { zone: 'Development', dataClassification: 'Sensitive' },
  azurePipelines: { zone: 'Development', dataClassification: 'Sensitive' },

  // GCP Services
  // Compute
  gcpComputeEngine: { zone: 'Cloud', dataClassification: 'Internal' },
  gcpAppEngine: { zone: 'Cloud', dataClassification: 'Internal' },
  gcpCloudFunctions: { zone: 'Cloud', dataClassification: 'Internal' },
  gcpCloudRun: { zone: 'Cloud', dataClassification: 'Internal' },
  gcpGKE: { zone: 'Cloud', dataClassification: 'Internal' },
  gcpBatch: { zone: 'Cloud', dataClassification: 'Internal' },
  // Storage
  gcpCloudStorage: { zone: 'Cloud', dataClassification: 'Sensitive' },
  gcpPersistentDisk: { zone: 'Cloud', dataClassification: 'Sensitive' },
  gcpFilestore: { zone: 'Cloud', dataClassification: 'Sensitive' },
  gcpContainerRegistry: { zone: 'Cloud', dataClassification: 'Sensitive' },
  gcpArtifactRegistry: { zone: 'Cloud', dataClassification: 'Sensitive' },
  // Database
  gcpCloudSQL: { zone: 'Cloud', dataClassification: 'Confidential' },
  gcpFirestore: { zone: 'Cloud', dataClassification: 'Confidential' },
  gcpBigQuery: { zone: 'Cloud', dataClassification: 'Confidential' },
  gcpBigtable: { zone: 'Cloud', dataClassification: 'Confidential' },
  gcpSpanner: { zone: 'Cloud', dataClassification: 'Confidential' },
  gcpMemorystore: { zone: 'Cloud', dataClassification: 'Sensitive' },
  // Networking
  gcpVPC: { zone: 'Cloud', dataClassification: 'Internal' },
  gcpCloudLoadBalancing: { zone: 'Cloud', dataClassification: 'Internal' },
  gcpCloudCDN: { zone: 'Cloud', dataClassification: 'Public' },
  gcpCloudDNS: { zone: 'Cloud', dataClassification: 'Public' },
  gcpCloudVPN: { zone: 'Cloud', dataClassification: 'Sensitive' },
  gcpCloudInterconnect: { zone: 'Cloud', dataClassification: 'Sensitive' },
  gcpCloudArmor: { zone: 'Cloud', dataClassification: 'Sensitive' },
  // Identity & Access Management
  gcpIAM: { zone: 'Restricted', dataClassification: 'Confidential' },
  gcpIdentityPlatform: { zone: 'Cloud', dataClassification: 'Sensitive' },
  gcpCloudIdentity: { zone: 'Restricted', dataClassification: 'Confidential' },
  gcpSecretManager: { zone: 'Restricted', dataClassification: 'Confidential' },
  gcpCloudKMS: { zone: 'Restricted', dataClassification: 'Confidential' },
  gcpCertificateAuthority: { zone: 'Restricted', dataClassification: 'Confidential' },
  // Security Services
  gcpSecurityCommandCenter: { zone: 'Management', dataClassification: 'Sensitive' },
  gcpWebSecurityScanner: { zone: 'Management', dataClassification: 'Sensitive' },
  gcpCloudIDS: { zone: 'Management', dataClassification: 'Sensitive' },
  gcpBinaryAuthorization: { zone: 'Management', dataClassification: 'Sensitive' },
  gcpContainerAnalysis: { zone: 'Management', dataClassification: 'Sensitive' },
  gcpCloudDLP: { zone: 'Management', dataClassification: 'Sensitive' },
  gcpVPCServiceControls: { zone: 'Management', dataClassification: 'Sensitive' },
  gcpAccessContextManager: { zone: 'Management', dataClassification: 'Sensitive' },
  gcpPolicyIntelligence: { zone: 'Management', dataClassification: 'Sensitive' },
  // AI & Machine Learning
  gcpVertexAI: { zone: 'Cloud', dataClassification: 'Sensitive' },
  gcpAutoML: { zone: 'Cloud', dataClassification: 'Sensitive' },
  gcpAIPlatform: { zone: 'Cloud', dataClassification: 'Sensitive' },
  // Monitoring & Logging
  gcpCloudMonitoring: { zone: 'Management', dataClassification: 'Sensitive' },
  gcpCloudLogging: { zone: 'Management', dataClassification: 'Sensitive' },
  gcpCloudTrace: { zone: 'Management', dataClassification: 'Sensitive' },
  gcpCloudProfiler: { zone: 'Management', dataClassification: 'Sensitive' },
  // DevOps
  gcpCloudBuild: { zone: 'Development', dataClassification: 'Sensitive' },
  gcpCloudDeploy: { zone: 'Development', dataClassification: 'Sensitive' },
  gcpCloudSourceRepositories: { zone: 'Development', dataClassification: 'Sensitive' },

  // IBM Cloud Services
  // Compute
  ibmVirtualServer: { zone: 'Cloud', dataClassification: 'Internal' },
  ibmBareMetalServer: { zone: 'Cloud', dataClassification: 'Internal' },
  ibmCodeEngine: { zone: 'Cloud', dataClassification: 'Internal' },
  ibmCloudFunctions: { zone: 'Cloud', dataClassification: 'Internal' },
  ibmKubernetes: { zone: 'Cloud', dataClassification: 'Internal' },
  ibmRedHatOpenShift: { zone: 'Cloud', dataClassification: 'Internal' },
  // Storage
  ibmObjectStorage: { zone: 'Cloud', dataClassification: 'Sensitive' },
  ibmBlockStorage: { zone: 'Cloud', dataClassification: 'Sensitive' },
  ibmFileStorage: { zone: 'Cloud', dataClassification: 'Sensitive' },
  // Database
  ibmDatabase: { zone: 'Cloud', dataClassification: 'Confidential' },
  ibmCloudant: { zone: 'Cloud', dataClassification: 'Confidential' },
  ibmDB2: { zone: 'Cloud', dataClassification: 'Confidential' },
  ibmDatabases: { zone: 'Cloud', dataClassification: 'Confidential' },
  // Networking
  ibmVPC: { zone: 'Cloud', dataClassification: 'Internal' },
  ibmLoadBalancer: { zone: 'Cloud', dataClassification: 'Internal' },
  ibmCloudInternetServices: { zone: 'Cloud', dataClassification: 'Public' },
  ibmDirectLink: { zone: 'Cloud', dataClassification: 'Sensitive' },
  ibmTransitGateway: { zone: 'Cloud', dataClassification: 'Internal' },
  // Identity & Access
  ibmCloudIAM: { zone: 'Restricted', dataClassification: 'Confidential' },
  ibmAppID: { zone: 'Cloud', dataClassification: 'Sensitive' },
  ibmKeyProtect: { zone: 'Restricted', dataClassification: 'Confidential' },
  ibmSecretsManager: { zone: 'Restricted', dataClassification: 'Confidential' },
  // Security Services
  ibmSecurityGateway: { zone: 'Cloud', dataClassification: 'Sensitive' },
  ibmSecurityAdvisor: { zone: 'Management', dataClassification: 'Sensitive' },
  ibmCertificateManager: { zone: 'Cloud', dataClassification: 'Sensitive' },
  ibmHyperProtect: { zone: 'Restricted', dataClassification: 'Confidential' },
  ibmCloudFirewall: { zone: 'Cloud', dataClassification: 'Sensitive' },
  // Monitoring & Management
  ibmCloudMonitoring: { zone: 'Management', dataClassification: 'Sensitive' },
  ibmLogAnalysis: { zone: 'Management', dataClassification: 'Sensitive' },
  ibmActivityTracker: { zone: 'Management', dataClassification: 'Confidential' },
  // AI & Data
  ibmWatsonStudio: { zone: 'Cloud', dataClassification: 'Sensitive' },
  ibmWatsonAssistant: { zone: 'Cloud', dataClassification: 'Sensitive' },
  ibmWatsonDiscovery: { zone: 'Cloud', dataClassification: 'Sensitive' },
  // DevOps
  ibmContinuousDelivery: { zone: 'Development', dataClassification: 'Sensitive' },
  ibmCloudShell: { zone: 'Management', dataClassification: 'Sensitive' }
};

export const getDefaultSecuritySettings = (nodeType: SecurityNodeType) => {
  if (nodeType === 'securityZone') {
    return {
      zone: 'Internal' as SecurityZone,
      dataClassification: 'Internal' as DataClassification
    };
  }
  return defaultSecuritySettings[nodeType] || {
    zone: 'Internal',
    dataClassification: 'Internal'
  };
};

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

// Version matching types
export interface VersionInfo {
  vendor: string;
  product: string;
  versionRange: string;
}

// Update ThreatIntelService.ts to use these types

// Add Drawing types
export type DrawingTool = 'select' | 'pencil' | 'rectangle' | 'circle' | 'arrow' | 'text' | 'eraser';

export interface DrawingStyle {
  stroke: string;
  strokeWidth: number;
  opacity: number;
  strokeDasharray?: string;
  fill?: string;
  fillOpacity?: number;
  fontSize?: number;
}

export interface Drawing {
  id: string;
  type: DrawingTool;
  path?: string;
  text?: string;
  position?: { x: number; y: number };
  style: DrawingStyle;
  associatedNodeId?: string;
  relativePosition?: { x: number; y: number };
}

// Targeted Threat Analysis types
export interface TargetedThreatAnalysis {
  threatActors: string;
  ttps: string;
  vulnerabilities: string;
  focusAreas: string;
  scenarioDescription?: string;
  threatIntelligence?: {
    rawIntelligence?: string;
    recentCVEs?: string;
    knownIOCs?: string;
    campaignInfo?: string;
    intelligenceDate?: string;
  };
}

export interface ThreatScenarioFile {
  version: '1.0';
  name: string;
  description?: string;
  targetedAnalysis: TargetedThreatAnalysis;
  timestamp: string;
}
