import { SecurityNodeType, DFDCategory } from '../types/SecurityTypes';

// Mapping of node types to their default DFD categories
export const nodeToDFDCategory: Record<SecurityNodeType, DFDCategory | null> = {
  // Infrastructure nodes
  server: 'process',
  workstation: 'actor',
  endpoint: 'actor',
  desktop: 'actor',
  laptop: 'actor',
  tablet: 'actor',
  smartphone: 'actor',
  printer: 'process',
  router: 'process',
  user: 'actor',
  switch: 'process',
  coreRouter: 'process',
  edgeRouter: 'process',
  accessPoint: 'process',
  wirelessController: 'process',
  gateway: 'process',
  modem: 'process',
  networkBridge: 'process',
  networkHub: 'process',
  dns: 'process',
  dhcp: 'process',
  ntpServer: 'process',
  proxyCache: 'process',
  voipPhone: 'actor',
  pbx: 'process',
  sipServer: 'process',
  conferenceSystem: 'process',
  san: 'dataStore',
  nas: 'dataStore',
  storageArray: 'dataStore',
  tapeLibrary: 'dataStore',
  ups: null, // Physical infrastructure, no DFD category
  pdu: null, // Physical infrastructure, no DFD category
  hvac: null, // Physical infrastructure, no DFD category
  rackServer: 'process',
  bladeServer: 'process',
  loadBalancerHw: 'process',
  wanOptimizer: 'process',
  networkProbe: 'process',
  packetBroker: 'process',
  fiberTerminal: null, // Physical infrastructure
  multiplexer: 'process',
  mediaConverter: 'process',
  terminalServer: 'process',
  cellTower: 'process',
  wirelessBridge: 'process',
  meshNode: 'process',
  repeater: 'process',
  edgeServer: 'process',
  fogNode: 'process',
  microDatacenter: 'process',
  kvm: 'actor', // Admin interface
  serialConsole: 'actor', // Admin interface
  timeClock: 'process',
  environmentSensor: 'actor', // Sensor as external entity
  thinClient: 'actor',
  virtualDesktopHost: 'process',
  sdwanGateway: 'process',

  // Security Control nodes
  firewall: 'process',
  vpnGateway: 'process',
  ids: 'process',
  ips: 'process',
  waf: 'process',
  proxy: 'process',
  reverseProxy: 'process',
  monitor: 'process',
  siem: 'process',
  soar: 'process',
  xdr: 'process',
  edr: 'process',
  ndr: 'process',
  casb: 'process',
  sase: 'process',
  ztna: 'process',
  dlp: 'process',
  dam: 'process',
  pam: 'process',
  hsm: 'process',
  kms: 'dataStore', // Key storage
  secretsManager: 'dataStore', // Secret storage
  certificateAuthority: 'process',
  mfa: 'process',
  sso: 'process',
  ldap: 'dataStore', // Directory storage
  radiusServer: 'process',
  honeypot: 'process',
  honeynet: 'process',
  deceptionSystem: 'process',
  networkTap: 'process',
  packetCapture: 'process',
  vulnerabilityScanner: 'process',
  patchManagement: 'process',
  configManagement: 'process',
  complianceScanner: 'process',
  penTestTool: 'process',
  staticAnalysis: 'process',
  dynamicAnalysis: 'process',
  containerScanner: 'process',
  k8sAdmissionController: 'process',
  meshProxy: 'process',
  apiSecurity: 'process',
  botProtection: 'process',
  ddosProtection: 'process',
  emailSecurity: 'process',
  webFilter: 'process',
  sandboxAnalyzer: 'process',
  threatIntelPlatform: 'process',
  forensicsStation: 'process',
  incidentResponsePlatform: 'process',
  backupSystem: 'dataStore',
  disasterRecovery: 'dataStore',
  encryptionGateway: 'process',
  tokenizer: 'process',
  riskAnalytics: 'process',
  identityGovernance: 'process',
  cloudSecurityPosture: 'process',
  workloadProtection: 'process',
  runtimeProtection: 'process',
  supplychainSecurity: 'process',
  codeRepository: 'dataStore',
  cicdSecurity: 'process',
  secretScanner: 'process',
  sbom: 'dataStore',
  dependencyScanner: 'process',
  infrastructureAsCode: 'dataStore',
  policyAsCode: 'dataStore',
  cloudAccessBroker: 'process',
  remoteAccessGateway: 'process',
  bastionHost: 'process',
  jumpServer: 'process',
  aiSecurityGateway: 'process',
  quantumKeyDistribution: 'process',
  blockchainSecurity: 'process',
  otSecurityGateway: 'process',
  iotSecurityGateway: 'process',
  physicalAccessControl: 'process',
  videoSurveillance: 'process',
  securityOrchestrator: 'process',
  applicationDeliveryController: 'process',
  identityProvider: 'process',

  // Application nodes
  application: 'process',
  database: 'dataStore',
  loadBalancer: 'process',
  apiGateway: 'process',
  webServer: 'process',
  authServer: 'process',
  messageBroker: 'process',
  api: 'process',
  service: 'process',
  containerizedService: 'process',
  cache: 'dataStore',
  storage: 'dataStore',
  vault: 'dataStore',
  identity: 'dataStore',
  logging: 'dataStore',
  kernelModule: 'process',
  deviceDriver: 'process',
  hypervisor: 'process',
  firmware: 'process',
  secureEnclave: 'process',
  tpm: 'dataStore', // Secure storage
  microcode: 'process',

  // Cloud nodes
  cloudService: 'process',
  containerRegistry: 'dataStore',
  kubernetesPod: 'process',
  kubernetesService: 'process',
  storageAccount: 'dataStore',
  functionApp: 'process',
  apiManagement: 'process',
  cloudLoadBalancer: 'process',
  cloudFirewall: 'process',
  cloudDatabase: 'dataStore',
  search: 'process',

  // OT nodes
  plc: 'process',
  hmi: 'actor', // Human-Machine Interface
  historian: 'dataStore',
  rtu: 'process',
  sensor: 'actor', // External sensor
  actuator: 'process',
  scadaServer: 'process',
  industrialFirewall: 'process',
  safetySystem: 'process',
  industrialNetwork: 'process',

  // AWS Services
  awsEC2: 'process',
  awsLambda: 'process',
  awsElasticBeanstalk: 'process',
  awsECS: 'process',
  awsEKS: 'process',
  awsFargate: 'process',
  awsS3: 'dataStore',
  awsEBS: 'dataStore',
  awsEFS: 'dataStore',
  awsRDS: 'dataStore',
  awsDynamoDB: 'dataStore',
  awsElastiCache: 'dataStore',
  awsVPC: 'trustBoundary',
  awsCloudFront: 'process',
  awsAPIGateway: 'process',

  // Azure Services
  azureVM: 'process',
  azureAppService: 'process',
  azureFunctions: 'process',
  azureKubernetesService: 'process',
  azureContainerInstances: 'process',
  azureBlobStorage: 'dataStore',
  azureFileStorage: 'dataStore',
  azureManagedDisks: 'dataStore',
  azureSQLDatabase: 'dataStore',
  azureCosmosDB: 'dataStore',
  azureRedisCache: 'dataStore',
  azureVirtualNetwork: 'trustBoundary',
  azureLoadBalancer: 'process',
  azureApplicationGateway: 'process',
  azureFrontDoor: 'process',
  azureStorage: 'dataStore',
  azureMonitor: 'process',
  azureActiveDirectory: 'process',
  azureKeyVault: 'dataStore',

  // GCP Services
  gcpComputeEngine: 'process',
  gcpAppEngine: 'process',
  gcpCloudFunctions: 'process',
  gcpCloudRun: 'process',
  gcpGKE: 'process',
  gcpContainerRegistry: 'dataStore',
  gcpCloudStorage: 'dataStore',
  gcpPersistentDisk: 'dataStore',
  gcpCloudSQL: 'dataStore',
  gcpFirestore: 'dataStore',
  gcpBigQuery: 'dataStore',
  gcpBigtable: 'dataStore',
  gcpVertexAI: 'process',
  gcpVPC: 'trustBoundary',
  gcpCloudLoadBalancing: 'process',

  // IBM Cloud Services
  ibmVirtualServer: 'process',
  ibmObjectStorage: 'dataStore',
  ibmDatabase: 'dataStore',
  ibmVPC: 'trustBoundary',
  ibmSecurityGateway: 'process',

  // AI/ML nodes
  aiModel: 'process',
  llmService: 'process',
  mlPipeline: 'process',
  aiGateway: 'process',
  vectorDatabase: 'dataStore',
  modelRegistry: 'dataStore',
  inferenceEngine: 'process',
  aiWorkbench: 'process',
  dataLake: 'dataStore',
  featureStore: 'dataStore',
  ai: 'process',
  mlInference: 'process',
  notebookServer: 'actor', // Jupyter notebook as user interface
  computeCluster: 'process',
  modelVault: 'dataStore',
  securityScanner: 'process',

  // Red Team nodes
  attackBox: 'process',
  payloadServer: 'process',
  c2Server: 'actor',
  implant: 'process',
  phishingServer: 'actor',
  exfilChannel: 'process',
  pivotPoint: 'process',
  credentialHarvester: 'process',
  lateralMovement: 'process',
  persistenceMechanism: 'process',
  
  // SecOps nodes
  socWorkstation: 'actor',
  threatHuntingPlatform: 'process',
  ctiFeed: 'dataStore',
  attackSurfaceMonitor: 'process',
  deceptionToken: 'process',
  behaviorAnalytics: 'process',
  networkForensics: 'process',
  malwareRepository: 'dataStore',
  indicatorStore: 'dataStore',
  playbookEngine: 'process',

  
  // Cybercrime nodes
  fraudDetection: 'process',
  transactionMonitor: 'process',
  antiMalware: 'process',
  threatFeed: 'dataStore',
  sandboxEnv: 'process',
  forensicsWorkstation: 'actor',
  incidentResponse: 'process',
  cyberInsurance: 'process',
  fraudAnalytics: 'process',
  
  // Privacy nodes
  dataClassifier: 'process',
  consentManager: 'process',
  dataMapper: 'process',
  privacyScanner: 'process',
  dataRetention: 'process',
  dataAnonymizer: 'process',
  gdprCompliance: 'process',
  dataBreach: 'process',
  privacyImpact: 'process',
  dataSubjectRights: 'process',
  
  // AppSec nodes
  memoryPool: 'dataStore',
  executionContext: 'process',
  sessionStore: 'dataStore',
  inputBuffer: 'dataStore',
  outputBuffer: 'dataStore',
  configManager: 'process',
  cryptoModule: 'process',
  tokenValidator: 'process',
  permissionEngine: 'process',
  auditLogger: 'dataStore',
  


  // Security Zone node (special case)
  securityZone: 'trustBoundary',

  // DFD nodes already have their categories
  dfdActor: null, // Already categorized
  dfdProcess: null, // Already categorized
  dfdDataStore: null, // Already categorized
  dfdTrustBoundary: null, // Already categorized

  // Additional AWS Services
  awsGlacier: 'dataStore',
  awsRedshift: 'dataStore',
  awsAurora: 'dataStore',
  awsRoute53: 'process',
  awsDirectConnect: 'process',
  awsTransitGateway: 'process',
  awsSNS: 'process',
  awsSQS: 'dataStore',
  awsEventBridge: 'process',
  awsIAM: 'process',
  awsCognito: 'process',
  awsSSO: 'process',
  awsSecretsManager: 'dataStore',
  awsKMS: 'process',
  awsACM: 'dataStore',
  awsDirectory: 'dataStore',
  awsGuardDuty: 'process',
  awsSecurityHub: 'process',
  awsWAF: 'process',
  awsShield: 'process',
  awsInspector: 'process',
  awsDetective: 'process',
  awsFirewallManager: 'process',
  awsNetworkFirewall: 'process',
  awsConfig: 'process',
  awsCloudTrail: 'dataStore',
  awsCloudWatch: 'process',
  awsMacie: 'process',
  awsSecurityLake: 'dataStore',
  awsAccessAnalyzer: 'process',
  awsCodePipeline: 'process',
  awsCodeBuild: 'process',
  awsCodeDeploy: 'process',
  awsCodeCommit: 'dataStore',
  awsXRay: 'process',
  awsCloudWatchLogs: 'dataStore',

  // Additional Azure Services
  azureContainerApps: 'process',
  azureBatch: 'process',
  azureDataLakeStorage: 'dataStore',
  azureSynapseAnalytics: 'process',
  azureDatabaseForPostgreSQL: 'dataStore',
  azureDatabaseForMySQL: 'dataStore',
  azureVPNGateway: 'process',
  azureExpressRoute: 'process',
  azureTrafficManager: 'process',
  azureDNS: 'process',
  azureADB2C: 'process',
  azureManagedIdentity: 'process',
  azureInformationProtection: 'process',
  azurePrivilegedIdentityManagement: 'process',
  azureSecurityCenter: 'process',
  azureSentinel: 'process',
  azureDefender: 'process',
  azureFirewall: 'process',
  azureDDoSProtection: 'process',
  azureBastion: 'process',
  azurePrivateLink: 'process',
  azurePolicy: 'process',
  azureBlueprints: 'process',
  azureArc: 'process',
  azureLogAnalytics: 'dataStore',
  azureApplicationInsights: 'process',
  azureAutomation: 'process',
  azureDevOps: 'process',
  azureArtifacts: 'dataStore',
  azurePipelines: 'process',

  // Additional GCP Services
  gcpBatch: 'process',
  gcpFilestore: 'dataStore',
  gcpArtifactRegistry: 'dataStore',
  gcpSpanner: 'dataStore',
  gcpMemorystore: 'dataStore',
  gcpCloudCDN: 'process',
  gcpCloudDNS: 'process',
  gcpCloudVPN: 'process',
  gcpCloudInterconnect: 'process',
  gcpCloudArmor: 'process',
  gcpIAM: 'process',
  gcpIdentityPlatform: 'process',
  gcpCloudIdentity: 'process',
  gcpSecretManager: 'dataStore',
  gcpCloudKMS: 'process',
  gcpCertificateAuthority: 'dataStore',
  gcpSecurityCommandCenter: 'process',
  gcpWebSecurityScanner: 'process',
  gcpCloudIDS: 'process',
  gcpBinaryAuthorization: 'process',
  gcpContainerAnalysis: 'process',
  gcpCloudDLP: 'process',
  gcpVPCServiceControls: 'process',
  gcpAccessContextManager: 'process',
  gcpPolicyIntelligence: 'process',
  gcpAutoML: 'process',
  gcpAIPlatform: 'process',
  gcpCloudMonitoring: 'process',
  gcpCloudLogging: 'dataStore',
  gcpCloudTrace: 'process',
  gcpCloudProfiler: 'process',
  gcpCloudBuild: 'process',
  gcpCloudDeploy: 'process',
  gcpCloudSourceRepositories: 'dataStore',

  // Additional IBM Services
  ibmBareMetalServer: 'process',
  ibmCodeEngine: 'process',
  ibmCloudFunctions: 'process',
  ibmKubernetes: 'process',
  ibmRedHatOpenShift: 'process',
  ibmBlockStorage: 'dataStore',
  ibmFileStorage: 'dataStore',
  ibmCloudant: 'dataStore',
  ibmDB2: 'dataStore',
  ibmDatabases: 'dataStore',
  ibmLoadBalancer: 'process',
  ibmCloudInternetServices: 'process',
  ibmDirectLink: 'process',
  ibmTransitGateway: 'process',
  ibmCloudIAM: 'process',
  ibmAppID: 'process',
  ibmKeyProtect: 'process',
  ibmSecretsManager: 'dataStore',
  ibmSecurityAdvisor: 'process',
  ibmCertificateManager: 'dataStore',
  ibmHyperProtect: 'process',
  ibmCloudFirewall: 'process',
  ibmCloudMonitoring: 'process',
  ibmLogAnalysis: 'dataStore',
  ibmActivityTracker: 'dataStore',
  ibmWatsonStudio: 'process',
  ibmWatsonAssistant: 'process',
  ibmWatsonDiscovery: 'process',
  ibmContinuousDelivery: 'process',
  ibmCloudShell: 'process',

  // Generic node
  generic: null // No default category
};

// Suggested DFD types for common node types
export const suggestedDFDTypes: Partial<Record<SecurityNodeType, string[]>> = {
  // Actor suggestions
  user: ['End User', 'Administrator', 'Developer', 'Analyst', 'Operator'],
  smartphone: ['Mobile User', 'Field Worker', 'IoT Device', 'BYOD User'],
  tablet: ['Mobile User', 'Field Worker', 'Kiosk User'],
  laptop: ['Remote Worker', 'Developer', 'Administrator'],
  desktop: ['Office Worker', 'Developer', 'Analyst'],
  workstation: ['Power User', 'Designer', 'Engineer'],
  voipPhone: ['Call Center Agent', 'Office Worker'],
  hmi: ['Operator', 'Supervisor', 'Technician'],
  sensor: ['Environmental Sensor', 'Motion Detector', 'Temperature Sensor'],
  kvm: ['System Administrator', 'Data Center Operator'],
  
  // Process suggestions
  application: ['Business Logic', 'Web Application', 'API Service', 'Batch Job'],
  apiGateway: ['API Management', 'Rate Limiter', 'Request Router', 'Authentication Gateway'],
  webServer: ['Web Frontend', 'Static Content Server', 'Application Server'],
  loadBalancer: ['Traffic Distributor', 'Health Checker', 'SSL Terminator'],
  firewall: ['Packet Filter', 'Stateful Inspector', 'Application Firewall'],
  authServer: ['Identity Provider', 'Token Issuer', 'Session Manager'],
  service: ['Microservice', 'Background Worker', 'Integration Service'],
  
  // Data Store suggestions
  database: ['User Database', 'Transaction Store', 'Configuration DB', 'Analytics DB'],
  cache: ['Session Cache', 'API Cache', 'Content Cache', 'Query Cache'],
  storage: ['File Storage', 'Blob Storage', 'Archive Storage', 'Media Storage'],
  vault: ['Secret Store', 'Key Vault', 'Certificate Store', 'Credential Vault'],
  ldap: ['User Directory', 'Group Store', 'Policy Store'],
  logging: ['Audit Logs', 'Application Logs', 'Security Logs', 'System Logs'],
  
  // Trust Boundary suggestions
  securityZone: ['Network Boundary', 'Security Perimeter', 'Trust Zone', 'Isolation Boundary']
};

// Helper function to get DFD category for a node type
export function getDFDCategoryForNodeType(nodeType: SecurityNodeType): DFDCategory | null {
  return nodeToDFDCategory[nodeType];
}

// Helper function to get suggested DFD types for a node
export function getSuggestedDFDTypes(nodeType: SecurityNodeType, category?: DFDCategory): string[] {
  // If node has specific suggestions, return those
  if (suggestedDFDTypes[nodeType]) {
    return suggestedDFDTypes[nodeType]!;
  }
  
  // Otherwise, provide generic suggestions based on category
  if (category || nodeToDFDCategory[nodeType]) {
    const effectiveCategory = category || nodeToDFDCategory[nodeType];
    switch (effectiveCategory) {
      case 'actor':
        return ['External User', 'Internal User', 'System', 'Service Account'];
      case 'process':
        return ['Service', 'Application', 'Function', 'Task'];
      case 'dataStore':
        return ['Database', 'File Store', 'Cache', 'Queue'];
      case 'trustBoundary':
        return ['Network Zone', 'Security Boundary', 'Access Control'];
    }
  }
  
  return [];
}
