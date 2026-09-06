import { NodeShape } from '../types/ShapeTypes';
import { SecurityNodeType } from '../types/SecurityTypes';

// Default shape mappings for different node types
export const defaultNodeShapes: Record<string, NodeShape> = {
  // DFD nodes with specific shapes
  dfdActor: 'rounded-rectangle',  // External entities use rounded-rectangle shape
  dfdProcess: 'circle',           // Processes use circle shape
  dfdDataStore: 'cylinder',       // Data stores use cylinder shape
  dfdTrustBoundary: 'rectangle',  // Trust boundaries use simple rectangles
  
  // Nodes that fit DFD Actor pattern (external entities) - use rounded-rectangle
  user: 'rounded-rectangle',
  endpoint: 'rounded-rectangle',
  desktop: 'rounded-rectangle',
  laptop: 'rounded-rectangle',
  tablet: 'rounded-rectangle',
  smartphone: 'rounded-rectangle',
  workstation: 'rounded-rectangle',
  thinClient: 'rounded-rectangle',
  voipPhone: 'rounded-rectangle',
  cloudService: 'rounded-rectangle',
  apiManagement: 'rounded-rectangle',
  cellTower: 'rounded-rectangle',
  threatFeed: 'rounded-rectangle',
  cyberInsurance: 'rounded-rectangle',
  c2Server: 'rounded-rectangle',
  payloadServer: 'rounded-rectangle',
  phishingServer: 'rounded-rectangle',
  modem: 'rounded-rectangle',
  
  // Nodes that fit DFD Process pattern (data transformation) - use circle
  application: 'circle',
  webServer: 'circle',
  api: 'circle',
  service: 'circle',
  containerizedService: 'circle',
  functionApp: 'circle',
  authServer: 'circle',
  messageBroker: 'circle',
  loadBalancer: 'circle',
  reverseProxy: 'circle',
  firewall: 'circle',
  waf: 'circle',
  ips: 'circle',
  ids: 'circle',
  proxy: 'circle',
  apiGateway: 'circle',
  encryptionGateway: 'circle',
  tokenizer: 'circle',
  fraudDetection: 'circle',
  transactionMonitor: 'circle',
  antiMalware: 'circle',
  sandboxAnalyzer: 'circle',
  sso: 'circle',
  mfa: 'circle',
  mlPipeline: 'circle',
  inferenceEngine: 'circle',
  plc: 'circle',
  rtu: 'circle',
  dataAnonymizer: 'circle',
  cicdSecurity: 'circle',
  
  // Nodes that fit DFD Data Store pattern (storage) - use cylinder
  database: 'cylinder',
  cloudDatabase: 'cylinder',
  storage: 'cylinder',
  storageAccount: 'cylinder',
  cache: 'cylinder',
  sessionStore: 'cylinder',
  vault: 'cylinder',
  secretsManager: 'cylinder',
  nas: 'cylinder',
  san: 'cylinder',
  storageArray: 'cylinder',
  tapeLibrary: 'cylinder',
  vectorDatabase: 'cylinder',
  dataLake: 'cylinder',
  featureStore: 'cylinder',
  modelRegistry: 'cylinder',
  modelVault: 'cylinder',
  containerRegistry: 'cylinder',
  codeRepository: 'cylinder',
  historian: 'cylinder',
  logging: 'cylinder',
  auditLogger: 'cylinder',
  malwareRepository: 'cylinder',
  indicatorStore: 'cylinder',
  configManager: 'cylinder',
  ldap: 'cylinder',
  kms: 'cylinder',
  hsm: 'cylinder',
  
  // Nodes that represent trust boundaries - use rectangle
  router: 'rectangle',
  edgeRouter: 'rectangle',
  coreRouter: 'rectangle',
  gateway: 'rectangle',
  vpnGateway: 'rectangle',
  bastionHost: 'rectangle',
  jumpServer: 'rectangle',
  industrialFirewall: 'rectangle',
  ztna: 'rectangle',
  sase: 'rectangle',
  remoteAccessGateway: 'rectangle',
  otSecurityGateway: 'rectangle',
  iotSecurityGateway: 'rectangle',
  casb: 'rectangle',
  cloudAccessBroker: 'rectangle',
  sdwanGateway: 'rectangle',
  
  // Add more as needed - other nodes will use default rounded-rectangle
};

// Function to get default shape for a node type
export const getDefaultShapeForType = (nodeType: SecurityNodeType): NodeShape => {
  return defaultNodeShapes[nodeType] || 'rounded-rectangle'; // Default fallback
};