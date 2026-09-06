// Add type definitions
export type ZoneColors = typeof colors.zoneColors;
export type ThemeColors = typeof colors;

// Theme definitions
export interface Theme {
  name: string;
  displayName: string;
  colors: Partial<typeof colors> & {
    background: string;
    surface: string;
    surfaceHover: string;
    border: string;
    primary: string;
    primaryLight: string;
    secondary: string;
    error: string;
    success: string;
    warning: string;
    info: string;
    nodeBg: string;
    textPrimary: string;
    textSecondary: string;
    text: string;
  };
  effects?: {
    particles?: boolean;
    glitch?: boolean;
    neon?: boolean;
    matrix?: boolean;
  };
  /**
   * When true, the diagram renders in "document" style: printable DFD notation
   * (ink-on-paper shapes, reference codes, dashed trust boundaries, environment
   * tints) instead of the icon/neon presentation. See docs/V2-Uplift-Plan.md 1B.
   */
  documentStyle?: boolean;
}

// Add explicit type for nodeDefaults
export const nodeDefaults = {
  borderWidth: 2,
  padding: '12px',
  handleSize: 4,
  borderRadius: 4,
  nodeWidth: 170,
} as const;

export type NodeDefaults = typeof nodeDefaults;

export const colors = {
  // Base theme colors
  background: '#1e1e1e' as string,
  surface: '#252526' as string,
  surfaceHover: '#2d2d2d' as string,
  border: 'rgba(255, 255, 255, 0.12)' as string,
  primary: '#1976D2' as string,
  primaryLight: '#1976D220' as string,
  primaryHover: '#1565C0' as string,
  secondary: '#64B5F6' as string,
  error: '#f14c4c' as string,
  success: '#89d185' as string,
  warning: '#cca700' as string,
  info: '#17a2b8' as string,
  nodeBg: '#252526' as string,
  textPrimary: '#d4d4d4' as string,
  textSecondary: '#8a8a8a' as string,
  textDisabled: '#5a5a5a' as string,
  text: '#d4d4d4' as string, // Added for consistency with textPrimary

  // Document/DFD design tokens (used by the printable "document" theme; other
  // themes inherit these defaults so components can rely on them existing)
  ink: '#d4d4d4' as string,                 // primary stroke/text for DFD shapes
  inkSecondary: '#8a8a8a' as string,        // secondary labels, ref codes
  paper: '#1e1e1e' as string,               // diagram page background
  dfdBoundaryStroke: '#5B8DD9' as string,   // trust boundary dashed border
  dfdBoundaryFill: 'rgba(207, 228, 255, 0.12)' as string, // trust boundary fill
  envControlled: 'rgba(109, 177, 255, 0.10)' as string,   // controlled environment tint
  envUncontrolled: 'rgba(254, 112, 112, 0.10)' as string, // uncontrolled environment tint
  envNeutral: 'rgba(179, 179, 179, 0.12)' as string,      // neutral grouping band
  scopeHighlight: '#990099' as string,      // assessment scope outline
  flowCrossing: '#E81313' as string,        // boundary-crossing data flow
  severityCritical: '#DC2626' as string,
  severityHigh: '#EA580C' as string,
  severityMedium: '#CA8A04' as string,
  severityLow: '#16A34A' as string,

  // Infrastructure Node Colors (Teals and Blues - neutral/system colors)
  serverColor: '#4ec9b0',       // Teal
  workstationColor: '#5ec9c0',  // Light Teal
  endpointColor: '#6ec9d0',     // Cyan Teal
  printerColor: '#7ec9e0',      // Light Cyan
  routerColor: '#569cd6',       // Blue
  switchColor: '#66acf6',       // Light Blue
  dnsColor: '#76bcff',          // Sky Blue
  gatewayColor: '#86ccff',      // Pale Blue
  userColor: '#42a5f5',         // Material Blue

  // Security Control Colors (Reds and Oranges - protective/defensive)
  // Network Security
  firewallColor: '#ff6b6b',     // Red
  vpnGatewayColor: '#ff8787',   // Light Red
  idsColor: '#ff9999',          // Pale Red
  ipsColor: '#ffaaaa',          // Very Pale Red
  wafColor: '#ff7979',          // Bright Red
  proxyColor: '#ff9f40',        // Orange
  reverseProxyColor: '#ffb347',  // Light Orange
  monitorColor: '#ffc947',      // Gold
  
  // Security Operations & Analytics
  siemColor: '#e74c3c',         // Dark Red
  soarColor: '#c0392b',         // Very Dark Red
  xdrColor: '#d35400',          // Dark Orange
  edrColor: '#e67e22',          // Orange
  ndrColor: '#f39c12',          // Yellow Orange
  
  // Cloud Security
  casbColor: '#9b59b6',         // Purple
  saseColor: '#8e44ad',         // Dark Purple
  ztnaColor: '#7d3c98',         // Deep Purple
  
  // Data Protection
  dlpColor: '#3498db',          // Bright Blue
  damColor: '#2980b9',          // Dark Blue
  pamColor: '#21618c',          // Navy Blue
  
  // Cryptography & Secrets
  hsmColor: '#16a085',          // Teal
  kmsColor: '#1abc9c',          // Light Teal
  secretsManagerColor: '#48c9b0', // Pale Teal
  certificateAuthorityColor: '#17a589', // Medium Teal
  
  // Identity & Access
  mfaColor: '#f39c12',          // Yellow Orange
  ssoColor: '#f1c40f',          // Yellow
  ldapColor: '#d4ac0d',         // Dark Yellow
  radiusServerColor: '#b7950b',  // Brown Yellow
  
  // Deception & Detection
  honeypotColor: '#e67e22',     // Orange
  honeynetColor: '#d35400',     // Dark Orange
  deceptionSystemColor: '#ca6f1e', // Brown Orange
  
  // Network Analysis
  networkTapColor: '#5dade2',   // Light Blue
  packetCaptureColor: '#3498db', // Blue
  
  // Vulnerability Management
  vulnerabilityScannerColor: '#e74c3c', // Red
  patchManagementColor: '#c0392b',      // Dark Red
  configManagementColor: '#a93226',     // Very Dark Red
  complianceScannerColor: '#922b21',   // Brown Red
  
  // Security Testing
  penTestToolColor: '#8b0000',         // Dark Red
  staticAnalysisColor: '#b22222',      // Fire Brick
  dynamicAnalysisColor: '#dc143c',     // Crimson
  containerScannerColor: '#cd5c5c',    // Indian Red
  
  // Kubernetes Security
  k8sAdmissionControllerColor: '#4b0082', // Indigo
  meshProxyColor: '#483d8b',             // Dark Slate Blue
  
  // API & Web Security
  apiSecurityColor: '#ff6347',          // Tomato
  botProtectionColor: '#ff4500',        // Orange Red
  ddosProtectionColor: '#ff0000',       // Pure Red
  emailSecurityColor: '#dc143c',        // Crimson
  webFilterColor: '#b22222',            // Fire Brick
  
  // Threat Intelligence & Response
  sandboxAnalyzerColor: '#2c3e50',     // Dark Blue Grey
  threatIntelPlatformColor: '#34495e',  // Blue Grey
  forensicsStationColor: '#7f8c8d',    // Grey
  incidentResponsePlatformColor: '#95a5a6', // Light Grey
  
  // Backup & Recovery
  backupSystemColor: '#27ae60',         // Green
  disasterRecoveryColor: '#229954',     // Dark Green
  
  // Advanced Security
  encryptionGatewayColor: '#8e44ad',    // Purple
  tokenizerColor: '#9b59b6',            // Light Purple
  riskAnalyticsColor: '#e74c3c',       // Red
  identityGovernanceColor: '#3498db',   // Blue
  
  // Cloud Security Posture
  cloudSecurityPostureColor: '#3498db', // Blue
  workloadProtectionColor: '#2980b9',   // Dark Blue
  runtimeProtectionColor: '#21618c',    // Navy

  // Cloud Vendor Palettes
  awsComputeColor: '#FF9900',
  awsStorageColor: '#569A31',
  awsDatabaseColor: '#C925D1',
  awsNetworkingColor: '#9D5025',
  awsSecurityColor: '#D13212',
  awsMlColor: '#01A88D',

  azureComputeColor: '#0078D4',
  azureStorageColor: '#5C2D91',
  azureDatabaseColor: '#00BCF2',
  azureNetworkingColor: '#0078D4',
  azureSecurityColor: '#00B294',
  azureAiColor: '#F25022',
  azureIdentityColor: '#FF8C00',

  gcpComputeColor: '#4285F4',
  gcpStorageColor: '#DB4437',
  gcpDatabaseColor: '#0F9D58',
  gcpNetworkingColor: '#F4B400',
  gcpSecurityColor: '#EA4335',
  gcpNeutralColor: '#1A73E8',

  ibmComputeColor: '#1F70C1',
  ibmStorageColor: '#759C6C',
  ibmDatabaseColor: '#5596E6',
  ibmNetworkingColor: '#3D70B2',
  ibmSecurityColor: '#0F62FE',
  ibmMonitoringColor: '#8A3FFC',
  ibmAIColor: '#D12771',
  ibmDevOpsColor: '#24A148',

  // Application Architecture (Kernel / Hardware sublayer) gradient (teal spectrum)
  kernelModuleColor: '#38b99f',  // Darker teal
  deviceDriverColor: '#45c3aa',  // Teal
  hypervisorColor: '#52cdb5',    // Light teal
  firmwareColor: '#5fd7c0',      // Lighter teal
  secureEnclaveColor: '#6ce0cb', // Pale teal
  tpmColor: '#79ead6',           // Very pale teal
  microcodeColor: '#86f4e1',     // Almost mint

  // DevSecOps
  supplychainSecurityColor: '#e67e22',  // Orange
  codeRepositoryColor: '#f39c12',       // Yellow Orange
  cicdSecurityColor: '#d68910',         // Dark Yellow Orange
  secretScannerColor: '#ca6f1e',        // Brown Orange
  sbomColor: '#af601a',                 // Dark Brown Orange
  dependencyScannerColor: '#935116',    // Very Dark Brown
  infrastructureAsCodeColor: '#7e5109', // Brown
  policyAsCodeColor: '#6e2c00',         // Dark Brown
  
  // Access Control
  cloudAccessBrokerColor: '#5b2c6f',    // Dark Purple
  remoteAccessGatewayColor: '#4a235a',  // Very Dark Purple
  bastionHostColor: '#633974',          // Purple
  jumpServerColor: '#512e5f',           // Dark Purple
  
  // Emerging Tech Security
  aiSecurityGatewayColor: '#00bcd4',    // Cyan
  quantumKeyDistributionColor: '#009688', // Teal
  blockchainSecurityColor: '#607d8b',    // Blue Grey
  otSecurityGatewayColor: '#ff9800',     // Orange
  iotSecurityGatewayColor: '#ff5722',    // Deep Orange
  
  // Physical Security
  physicalAccessControlColor: '#795548',  // Brown
  videoSurveillanceColor: '#5d4037',     // Dark Brown
  
  // Orchestration
  securityOrchestratorColor: '#e91e63',  // Pink
  
  // Generic node color (white)
  genericColor: '#FFFFFF',        // White for generic nodes
  
  // Application Colors (Greens - productive/operational)
  applicationColor: '#4ec9b0',    // Teal
  databaseColor: '#16a085',       // Dark Teal
  loadBalancerColor: '#27ae60',   // Green
  apiGatewayColor: '#2ecc71',     // Light Green
  webServerColor: '#52be80',      // Medium Green
  authServerColor: '#229954',     // Dark Green
  messageBrokerColor: '#28b463',  // Bright Green
  apiColor: '#58d68d',            // Pale Green
  serviceColor: '#82e0aa',        // Very Pale Green
  containerizedServiceColor: '#5eb5ff',  // Container Blue
  cacheColor: '#abebc6',          // Mint Green
  storageColor: '#1e8449',        // Deep Green
  vaultColor: '#145a32',          // Very Dark Green
  identityColor: '#0e6251',       // Deep Teal
  loggingColor: '#0b5345',        // Dark Teal

  // Cloud Colors (Purples and Blues - modern cloud theme)
  cloudServiceColor: '#9b59b6',      // Purple
  containerRegistryColor: '#8e44ad',  // Dark Purple
  kubernetesPodColor: '#bb8fce',     // Light Purple
  kubernetesServiceColor: '#a569bd',  // Medium Purple
  storageAccountColor: '#7d3c98',     // Deep Purple
  functionAppColor: '#5b2c6f',        // Very Dark Purple
  apiManagementColor: '#6c3483',      // Dark Purple
  cloudLoadBalancerColor: '#3498db',  // Blue
  cloudFirewallColor: '#2980b9',      // Dark Blue
  cloudDatabaseColor: '#5499c7',      // Medium Blue
  searchColor: '#7986cb',             // Indigo

  // OT/SCADA Colors (Yellows and Oranges - industrial/warning theme)
  plcColor: '#f39c12',          // Yellow Orange
  hmiColor: '#f1c40f',          // Yellow
  historianColor: '#e67e22',    // Orange
  rtuColor: '#d68910',          // Dark Yellow Orange
  sensorColor: '#fad7a0',       // Light Orange
  actuatorColor: '#f8c471',     // Pale Orange
  scadaServerColor: '#d35400',  // Dark Orange
  industrialFirewallColor: '#e74c3c', // Red
  safetySystemColor: '#c0392b', // Dark Red
  industrialNetworkColor: '#a04000', // Brown Orange

  // AI/ML Colors (Cyans and Teals - futuristic/tech theme)
  aiGatewayColor: '#00bcd4',        // Cyan
  inferenceEngineColor: '#00acc1',  // Dark Cyan
  modelRegistryColor: '#0097a7',    // Deep Cyan
  aiWorkbenchColor: '#00838f',      // Very Dark Cyan
  mlPipelineColor: '#006064',       // Deep Teal
  aiModelColor: '#26c6da',          // Light Cyan
  vectorDatabaseColor: '#4dd0e1',   // Pale Cyan
  dataLakeColor: '#80deea',         // Very Pale Cyan
  featureStoreColor: '#b2ebf2',     // Ice Blue
  llmServiceColor: '#00b8d4',       // Bright Cyan
  aiColor: '#0097a7',               // Deep Cyan
  mlInferenceColor: '#00acc1',      // Cyan
  notebookServerColor: '#00bfa5',   // Teal Accent
  computeClusterColor: '#00897b',   // Teal
  modelVaultColor: '#004d40',       // Dark Teal
  securityScannerColor: '#00695c',  // Dark Green

  // Cybercrime & Fraud Colors
  fraudDetectionColor: '#ff6b6b',        // Red
  transactionMonitorColor: '#ff8787',    // Light Red
  antiMalwareColor: '#ffa8a8',           // Pale Red
  // honeypotColor is already defined in Security Control Colors section
  threatFeedColor: '#ffd43b',            // Light Yellow
  sandboxEnvColor: '#74c0fc',            // Light Blue
  forensicsWorkstationColor: '#868e96',  // Gray
  incidentResponseColor: '#f783ac',      // Pink
  cyberInsuranceColor: '#d0bfff',        // Light Purple
  fraudAnalyticsColor: '#ff922b',        // Orange

  // Privacy & Data Protection Colors
  dataClassifierColor: '#51cf66',        // Green
  consentManagerColor: '#69db7c',        // Light Green
  dataMapperColor: '#8ce99a',            // Pale Green
  privacyScannerColor: '#96f2d7',        // Mint
  dataRetentionColor: '#74c0fc',         // Light Blue
  dataAnonymizerColor: '#91a7ff',        // Light Purple
  gdprComplianceColor: '#b197fc',        // Purple
  dataBreachColor: '#ffa8a8',            // Pale Red
  privacyImpactColor: '#d0bfff',         // Light Purple
  dataSubjectRightsColor: '#ffe066',     // Light Yellow

  // Application Architecture Colors
  memoryPoolColor: '#4c6ef5',            // Blue
  executionContextColor: '#5c7cfa',      // Light Blue
  sessionStoreColor: '#748ffc',          // Pale Blue
  inputBufferColor: '#91a7ff',           // Light Purple
  outputBufferColor: '#a5b4fc',          // Pale Purple
  configManagerColor: '#c7d2fe',         // Very Light Purple
  cryptoModuleColor: '#ff6b6b',          // Red
  tokenValidatorColor: '#ffa8a8',        // Pale Red
  permissionEngineColor: '#d0bfff',      // Light Purple
  auditLoggerColor: '#ffe066',           // Light Yellow

  // Red Teaming Colors
  attackBoxColor: '#dc2626',             // Dark Red
  payloadServerColor: '#e11d48',         // Red
  c2ServerColor: '#be123c',              // Dark Red
  implantColor: '#991b1b',               // Very Dark Red
  phishingServerColor: '#f97316',        // Orange
  exfilChannelColor: '#ea580c',          // Dark Orange
  pivotPointColor: '#d97706',            // Orange
  credentialHarvesterColor: '#eab308',   // Yellow
  lateralMovementColor: '#ca8a04',       // Dark Yellow
  persistenceMechanismColor: '#a16207',   // Brown

  // SecOps Colors
  socColor: '#1e40af',                   // Deep Blue
  huntingColor: '#7c3aed',               // Purple
  ctiColor: '#2563eb',                   // Blue
  asmColor: '#0ea5e9',                   // Sky Blue
  deceptionColor: '#f59e0b',             // Amber
  uebaColor: '#8b5cf6',                  // Violet
  forensicsColor: '#3b82f6',             // Blue
  malwareColor: '#ef4444',               // Red
  iocColor: '#10b981',                   // Emerald
  playbookColor: '#06b6d4',              // Cyan

  // Solid zone colors for borders and labels
  zoneColors: {
    Internet: '#00E676',    // Bright Green
    DMZ: '#FF9800',         // Orange
    Internal: '#2196F3',    // Blue
    Restricted: '#F44336',  // Red
    Management: '#9C27B0',  // Purple
    Development: '#FFEB3B', // Yellow
    Production: '#4CAF50',  // Green
    Testing: '#FF5722',     // Deep Orange
    Staging: '#03A9F4',     // Light Blue
    Database: '#673AB7',    // Deep Purple
    Legacy: '#795548',      // Brown
    Cloud: '#00BCD4',       // Cyan
    ThirdParty: '#E91E63',  // Pink
    IoT: '#8BC34A',         // Light Green
    OT: '#FFC107',          // Amber
    SCADA: '#607D8B',       // Blue Grey
    External: '#FF9800',    // Orange (same as DMZ for backward compatibility)
    Trusted: '#00B8D4',     // Cyan
    Critical: '#880E4F',    // Very Dark Pink
    Guest: '#81C784',       // Light Green
    Compliance: '#78909C',  // Blue Grey
    ControlPlane: '#6A1B9A', // Deep Purple
    DataPlane: '#1565C0',    // Dark Blue
    ServiceMesh: '#00695C',  // Dark Teal
    BackOffice: '#5D4037',   // Brown
    Partner: '#AD1457',      // Dark Pink
    Quarantine: '#BF360C',   // Deep Orange Red
    Recovery: '#1B5E20',     // Dark Green
    Edge: '#37474F',         // Dark Blue Grey
    Hybrid: '#4527A0',       // Deep Purple
    MultiCloud: '#00838F',   // Dark Cyan
    RedTeam: '#D50000',      // Red team offensive security (bright red)
    BlueTeam: '#1565C0',     // Blue team defensive security (dark blue)
    PurpleTeam: '#6A1B9A',   // Purple team red/blue collaboration (deep purple)
    YellowTeam: '#F57F17',   // Yellow team secure development (dark yellow)
    GreenTeam: '#2E7D32',    // Green team secure coding practices (dark green)
    OrangeTeam: '#FF6F00',   // Orange team security awareness training (dark orange)
    WhiteTeam: '#FFFFFF',    // White team objective assessment (white)
    Generic: '#FFFFFF'       // Generic zone for custom/specialized environments (white)
  },

  // Transparent zone background colors
  zoneBackgrounds: {
    Internet: '#00E67620',
    DMZ: '#FF980020',
    Internal: '#2196F320',
    Restricted: '#F4433620',
    Management: '#9C27B020',
    Development: '#FFEB3B20',
    Production: '#4CAF5020',
    Testing: '#FF572220',
    Staging: '#03A9F420',
    Database: '#673AB720',
    Legacy: '#79554820',
    Cloud: '#00BCD420',
    ThirdParty: '#E91E6320',
    IoT: '#8BC34A20',
    OT: '#FFC10720',
    SCADA: '#607D8B20',
    External: '#FF980020',  // Orange (same as DMZ for backward compatibility)
    Trusted: '#00B8D420',   // Cyan
    Critical: '#880E4F20',  // Very Dark Pink
    Guest: '#81C78420',     // Light Green
    Compliance: '#78909C20', // Blue Grey
    ControlPlane: '#6A1B9A20', // Deep Purple
    DataPlane: '#1565C020',    // Dark Blue
    ServiceMesh: '#00695C20',  // Dark Teal
    BackOffice: '#5D403720',   // Brown
    Partner: '#AD145720',      // Dark Pink
    Quarantine: '#BF360C20',   // Deep Orange Red
    Recovery: '#1B5E2020',     // Dark Green
    Edge: '#37474F20',         // Dark Blue Grey
    Hybrid: '#4527A020',       // Deep Purple
    MultiCloud: '#00838F20',   // Dark Cyan
    RedTeam: '#D5000020',      // Red team offensive security (dark red)
    BlueTeam: '#1565C020',     // Blue team defensive security (dark blue) 
    PurpleTeam: '#6A1B9A20',   // Purple team red/blue collaboration (deep purple)
    YellowTeam: '#F57F1720',   // Yellow team secure development (dark yellow)
    GreenTeam: '#2E7D3220',    // Green team secure coding practices (dark green)
    OrangeTeam: '#FF6F0020',   // Orange team security awareness training (dark orange)
    WhiteTeam: '#FFFFFF20',    // White team objective assessment (white with transparency)
    Generic: '#FFFFFF20'       // Generic zone for custom/specialized environments (white with transparency)
  }
} as const;

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px'
} as const;

export const transitions = {
  default: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  fast: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
  slow: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
  standard: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', // Added for backward compatibility
  colors: 'color 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  transform: 'transform 0.3s cubic-bezier(0.0, 0, 0.2, 1)',
  opacity: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  shadow: 'box-shadow 0.3s cubic-bezier(0.0, 0, 0.2, 1)',
} as const;

export const effects = {
  hover: `brightness(1.2)`,
  selected: (color: string) => `0 0 8px 2px ${color}40`,
  focusRing: `0 0 0 2px ${colors.primary}40`,
  shadow: '0 4px 8px rgba(0, 0, 0, 0.2)' // Added for component shadows
} as const;

export const nodeStyles = {
  fontSize: '13px',
  selectedBrightness: 'brightness(110%)',
  glowOpacity: '40',  // Used as ${color}40
  handleColor: '#555',
  handleColorHover: '#999',
  iconSize: 0.8,
  zoneBadgeSize: '12px',
  zoneBadgeOffset: '4px'
} as const;

export type NodeStyles = typeof nodeStyles;

export const edgeStyles = {
  strokeWidth: 2,
  selectedStrokeWidth: 3,
  animationDuration: '1s',
  dashArray: '5,5',
  labelBackground: '#1e1e1e80',
  fontSize: '12px'
} as const;

export type EdgeStyles = typeof edgeStyles;

export const componentStyles = {
  toolbox: {
    width: '280px',
    headerHeight: '32px',
    categorySpacing: '4px'
  },

  // Remove duplicate and merge properties
  analysisPanel: {
    width: '320px',
    header: {
      padding: '8px 16px',
      minHeight: '48px',
    },
    messages: {
      padding: '16px',
      gap: '8px',
      scrollbar: {
        width: '8px',
        borderRadius: '4px',
      }
    },
    message: {
      maxWidth: '85%',
      padding: '12px 16px',
      borderRadius: '6px',
    },
    input: {
      padding: '16px',
      gap: '8px',
    }
  },

  nodeEditor: {
    width: '280px',
    inputHeight: '32px',
    spacing: '16px',
    padding: '16px',
    gap: '16px',
    field: {
      marginBottom: '12px',
    },
    actions: {
      padding: '8px 16px',
    }
  },

  securityNode: {
    padding: nodeDefaults.padding,
    fontSize: '13px',
    transition: transitions.default,
    iconContainer: {
      position: 'absolute',
      top: '4px',
      right: '4px',
      width: '12px',
      height: '12px',
    },
    content: {
      gap: '4px',
      paddingRight: '16px',
    },
    label: {
      fontWeight: 500,
      transition: transitions.default,
    },
    zoneBadge: {
      fontSize: '11px',
      padding: '2px 6px',
      borderRadius: '4px',
      marginTop: '2px',
    }
  },

  securityEdge: {
    strokeWidth: 2,
    selectedStrokeWidth: 3,
    animation: {
      duration: '1s',
      dashArray: '5,5',
    },
    label: {
      fontSize: '12px',
      background: `${colors.background}80`,
      padding: '2px 4px',
      borderRadius: '2px',
      height: 28
    }
  },

  nodeToolbox: {
    width: '250px',
    padding: '8px',
    maxHeight: '90vh',
    category: {
      minHeight: '48px',
      padding: '8px',
    },
    item: {
      padding: '8px',
      fontSize: '13px',
      borderRadius: '4px',
      marginBottom: '4px',
    }
  }
} as const;

export type ComponentStyles = typeof componentStyles;

// Theme presets
export const themes: Record<string, Theme> = {
  dark: {
    name: 'dark',
    displayName: '🌙 Dark Mode',
    colors: colors
  },
  
  light: {
    name: 'light',
    displayName: '☀️ Light Mode',
    colors: {
      ...colors,
      background: '#e2e2e5',
      surface: '#d6d6d9',
      surfaceHover: '#ccccce',
      border: 'rgba(0, 0, 0, 0.08)',
      primary: '#2563eb',
      primaryLight: '#2563eb20',
      secondary: '#7c3aed',
      textPrimary: '#1a1a1a',
      textSecondary: '#4a4a4a',
      text: '#1a1a1a',
      nodeBg: '#ffffff',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6'
    }
  },
  
  threatVector: {
    name: 'threatVector',
    displayName: '🛡️ Threat Vector Security',
    colors: {
      ...colors,
      // Primary cyber-punk colors from website
      background: '#0a0a0b', // hsl(240, 10%, 3.9%)
      surface: '#141416', // hsl(240, 10%, 8%)
      surfaceHover: '#26262a', // hsl(240, 10%, 15%)
      border: 'rgba(0, 255, 255, 0.3)', // Cyan border with 30% opacity
      primary: '#00ffff', // hsl(180, 100%, 50%) - Neon cyan
      primaryLight: '#00ffff20', // Neon cyan with transparency
      secondary: '#ff00ff', // hsl(300, 100%, 50%) - Neon pink/magenta
      
      // Text colors
      textPrimary: '#ccffff', // hsl(180, 100%, 90%) - Bright cyan
      textSecondary: '#8cd9d9', // hsl(180, 50%, 70%) - Softer cyan
      text: '#ccffff',
      
      // Status colors
      error: '#f04747', // hsl(0, 84.2%, 60.2%)
      success: '#00ff9f', // Bright green-cyan
      warning: '#ffeb0b', // Bright yellow
      info: '#00ffff', // Cyan
      
      // Node colors with cyber theme
      nodeBg: '#141416' // Use surface color for nodes
    },
    effects: {
      neon: true,
      glitch: true
    }
  },
  
  cyberpunk: {
    name: 'cyberpunk',
    displayName: '🤖 Cyberpunk',
    colors: {
      ...colors,
      background: '#091833',
      surface: '#133e7c',
      surfaceHover: '#1e4d8b',
      primary: '#ea00d9',
      primaryLight: '#ea00d940',
      secondary: '#0abdc6',
      border: 'rgba(234, 0, 217, 0.3)',
      textPrimary: '#0abdc6',
      textSecondary: '#ff71ce',
      text: '#0abdc6',
      nodeBg: '#133e7c',
      success: '#00ff9f',
      warning: '#ffeb0b',
      error: '#ff003c',
      info: '#711c91'
    },
    effects: {
      neon: true,
      glitch: true
    }
  },
  
  matrix: {
    name: 'matrix',
    displayName: '💊 Matrix',
    colors: {
      ...colors,
      background: '#000000',
      surface: '#001100',
      surfaceHover: '#002200',
      primary: '#00ff00',
      secondary: '#00cc00',
      border: 'rgba(0, 255, 0, 0.3)',
      textPrimary: '#00ff00',
      textSecondary: '#008800',
      text: '#00ff00',
      nodeBg: '#001100'
    },
    effects: {
      matrix: false,
      particles: true
    }
  },
  
  hacker: {
    name: 'hacker',
    displayName: '💀 Hacker Terminal',
    colors: {
      ...colors,
      background: '#020202',
      surface: '#0d0d0d',
      surfaceHover: '#1a1a1a',
      primary: '#20c20e',
      primaryLight: '#20c20e30',
      secondary: '#ffd23f',
      border: 'rgba(32, 194, 14, 0.3)',
      textPrimary: '#20c20e',
      textSecondary: '#ffd23f',
      text: '#20c20e',
      nodeBg: '#0d0d0d',
      success: '#20c20e',
      warning: '#ffd23f',
      error: '#ff1744',
      info: '#00d4ff'
    },
    effects: {
      glitch: true
    }
  },
  
  nord: {
    name: 'nord',
    displayName: '❄️ Nord',
    colors: {
      ...colors,
      background: '#2e3440',
      surface: '#3b4252',
      surfaceHover: '#434c5e',
      primary: '#5e81ac',
      secondary: '#81a1c1',
      border: 'rgba(76, 86, 106, 0.3)',
      textPrimary: '#d8dee9',
      textSecondary: '#81a1c1',
      text: '#d8dee9',
      nodeBg: '#3b4252'
    }
  },
  
  synthwave: {
    name: 'synthwave',
    displayName: '🌃 Synthwave',
    colors: {
      ...colors,
      background: '#241b2f',
      surface: '#2d1b69',
      surfaceHover: '#3e2b7a',
      primary: '#ff006e',
      secondary: '#8338ec',
      border: 'rgba(255, 0, 110, 0.3)',
      textPrimary: '#ff006e',
      textSecondary: '#8338ec',
      text: '#ff006e',
      nodeBg: '#2d1b69'
    },
    effects: {
      neon: true,
      particles: true
    }
  },

  ocean: {
    name: 'ocean',
    displayName: '🌊 Deep Ocean',
    colors: {
      ...colors,
      background: '#001e3c',
      surface: '#003366',
      surfaceHover: '#004080',
      primary: '#00e5ff',
      primaryLight: '#00e5ff30',
      secondary: '#76ff03',
      border: 'rgba(0, 229, 255, 0.2)',
      textPrimary: '#b3e5fc',
      textSecondary: '#4fc3f7',
      text: '#b3e5fc',
      nodeBg: '#003366',
      success: '#76ff03',
      warning: '#ffea00',
      error: '#ff5252',
      info: '#00e5ff'
    }
  },

  dracula: {
    name: 'dracula',
    displayName: '🧛 Dracula',
    colors: {
      ...colors,
      background: '#282a36',
      surface: '#44475a',
      surfaceHover: '#6272a4',
      primary: '#bd93f9',
      secondary: '#ff79c6',
      border: 'rgba(98, 114, 164, 0.3)',
      textPrimary: '#f8f8f2',
      textSecondary: '#6272a4',
      text: '#f8f8f2',
      nodeBg: '#44475a',
      success: '#50fa7b',
      warning: '#f1fa8c',
      error: '#ff5555',
      info: '#8be9fd'
    }
  },

  solarized: {
    name: 'solarized',
    displayName: '☀️ Solarized Dark',
    colors: {
      ...colors,
      background: '#002b36',
      surface: '#073642',
      surfaceHover: '#586e75',
      primary: '#268bd2',
      secondary: '#2aa198',
      border: 'rgba(88, 110, 117, 0.3)',
      textPrimary: '#839496',
      textSecondary: '#586e75',
      text: '#839496',
      nodeBg: '#073642',
      success: '#859900',
      warning: '#b58900',
      error: '#dc322f',
      info: '#268bd2'
    }
  },

  monokai: {
    name: 'monokai',
    displayName: '🎨 Monokai',
    colors: {
      ...colors,
      background: '#272822',
      surface: '#3e3d32',
      surfaceHover: '#524f3f',
      primary: '#66d9ef',
      secondary: '#a6e22e',
      border: 'rgba(117, 113, 94, 0.3)',
      textPrimary: '#f8f8f2',
      textSecondary: '#75715e',
      text: '#f8f8f2',
      nodeBg: '#3e3d32',
      success: '#a6e22e',
      warning: '#e6db74',
      error: '#f92672',
      info: '#66d9ef'
    }
  },

  forest: {
    name: 'forest',
    displayName: '🌲 Forest Night',
    colors: {
      ...colors,
      background: '#1a1f1a',
      surface: '#2d3a2d',
      surfaceHover: '#3f4f3f',
      primary: '#7ec16e',
      secondary: '#f7ca88',
      border: 'rgba(126, 193, 110, 0.2)',
      textPrimary: '#d3c6aa',
      textSecondary: '#859289',
      text: '#d3c6aa',
      nodeBg: '#2d3a2d',
      success: '#a7c080',
      warning: '#dbbc7f',
      error: '#e67e80',
      info: '#7fbbb3'
    }
  },

  midnight: {
    name: 'midnight',
    displayName: '🌙 Midnight Purple',
    colors: {
      ...colors,
      background: '#1a1a2e',
      surface: '#16213e',
      surfaceHover: '#0f3460',
      primary: '#e94560',
      secondary: '#f47068',
      border: 'rgba(233, 69, 96, 0.2)',
      textPrimary: '#eaeaea',
      textSecondary: '#a8a8a8',
      text: '#eaeaea',
      nodeBg: '#16213e',
      success: '#00d9ff',
      warning: '#ffc947',
      error: '#e94560',
      info: '#7b68ee'
    },
    effects: {
      particles: true
    }
  },

  redteam: {
    name: 'redteam',
    displayName: '🔴 Red Team',
    colors: {
      ...colors,
      background: '#1a0000',
      surface: '#330000',
      surfaceHover: '#4d0000',
      primary: '#dc143c',
      primaryLight: '#dc143c30',
      secondary: '#ff1744',
      border: 'rgba(220, 20, 60, 0.3)',
      textPrimary: '#ff6b6b',
      textSecondary: '#ff8787',
      text: '#ff6b6b',
      nodeBg: '#330000',
      success: '#00ff00',
      warning: '#ffd700',
      error: '#ff0033',
      info: '#ff4500'
    },
    effects: {
      glitch: true
    }
  },

  blueteam: {
    name: 'blueteam',
    displayName: '🔵 Blue Team',
    colors: {
      ...colors,
      background: '#000033',
      surface: '#000066',
      surfaceHover: '#0000aa',
      primary: '#0080ff',
      secondary: '#00ccff',
      border: 'rgba(0, 128, 255, 0.3)',
      textPrimary: '#ccddff',
      textSecondary: '#8899ff',
      text: '#ccddff',
      nodeBg: '#000066',
      success: '#00ff88',
      warning: '#ffaa00',
      error: '#ff4444',
      info: '#00aaff'
    }
  },

  tokyo: {
    name: 'tokyo',
    displayName: '🗼 Tokyo Night',
    colors: {
      ...colors,
      background: '#16161e',
      surface: '#1a1b26',
      surfaceHover: '#24283b',
      primary: '#f7768e',
      primaryLight: '#f7768e30',
      secondary: '#9ece6a',
      border: 'rgba(247, 118, 142, 0.2)',
      textPrimary: '#c0caf5',
      textSecondary: '#9aa5ce',
      text: '#c0caf5',
      nodeBg: '#1a1b26',
      success: '#9ece6a',
      warning: '#ff9e64',
      error: '#f7768e',
      info: '#7aa2f7'
    }
  },

  gruvbox: {
    name: 'gruvbox',
    displayName: '🏜️ Gruvbox',
    colors: {
      ...colors,
      background: '#282828',
      surface: '#3c3836',
      surfaceHover: '#504945',
      primary: '#fe8019',
      secondary: '#fabd2f',
      border: 'rgba(254, 128, 25, 0.3)',
      textPrimary: '#ebdbb2',
      textSecondary: '#a89984',
      text: '#ebdbb2',
      nodeBg: '#3c3836',
      success: '#b8bb26',
      warning: '#fabd2f',
      error: '#fb4934',
      info: '#83a598'
    }
  },

  github: {
    name: 'github',
    displayName: '🐙 GitHub Dark',
    colors: {
      ...colors,
      background: '#010409',
      surface: '#0d1117',
      surfaceHover: '#161b22',
      primary: '#2ea043',
      primaryLight: '#2ea04330',
      secondary: '#1f6feb',
      border: 'rgba(48, 54, 61, 0.5)',
      textPrimary: '#f0f6fc',
      textSecondary: '#8b949e',
      text: '#f0f6fc',
      nodeBg: '#0d1117',
      success: '#2ea043',
      warning: '#fb8500',
      error: '#da3633',
      info: '#58a6ff'
    }
  },

  vscode: {
    name: 'vscode',
    displayName: '💻 VS Code',
    colors: {
      ...colors,
      background: '#1e1e1e',
      surface: '#252526',
      surfaceHover: '#2a2d2e',
      primary: '#007acc',
      secondary: '#16825d',
      border: 'rgba(255, 255, 255, 0.12)',
      textPrimary: '#d4d4d4',
      textSecondary: '#808080',
      text: '#d4d4d4',
      nodeBg: '#252526',
      success: '#4ec9b0',
      warning: '#dcdcaa',
      error: '#f48771',
      info: '#569cd6'
    }
  },

  terminal: {
    name: 'terminal',
    displayName: '💾 Terminal Amber',
    colors: {
      ...colors,
      background: '#000000',
      surface: '#1a0f00',
      surfaceHover: '#2a1f00',
      primary: '#ffb000',
      primaryLight: '#ffb00030',
      secondary: '#ff6000',
      border: 'rgba(255, 176, 0, 0.2)',
      textPrimary: '#ffb000',
      textSecondary: '#ff8c00',
      text: '#ffb000',
      nodeBg: '#1a0f00',
      success: '#00ff00',
      warning: '#ffff00',
      error: '#ff0000',
      info: '#00ffff'
    },
    effects: {
      glitch: true
    }
  },

  onedark: {
    name: 'onedark',
    displayName: '🎯 One Dark Pro',
    colors: {
      ...colors,
      background: '#282c34',
      surface: '#2c323c',
      surfaceHover: '#3e4451',
      primary: '#61afef',
      secondary: '#c678dd',
      border: 'rgba(171, 178, 191, 0.2)',
      textPrimary: '#abb2bf',
      textSecondary: '#5c6370',
      text: '#abb2bf',
      nodeBg: '#2c323c',
      success: '#98c379',
      warning: '#e5c07b',
      error: '#e06c75',
      info: '#61afef'
    }
  },

  catppuccin: {
    name: 'catppuccin',
    displayName: '🐱 Catppuccin',
    colors: {
      ...colors,
      background: '#1e1e2e',
      surface: '#313244',
      surfaceHover: '#45475a',
      primary: '#f5c2e7',
      primaryLight: '#f5c2e740',
      secondary: '#89dceb',
      border: 'rgba(245, 194, 231, 0.2)',
      textPrimary: '#cdd6f4',
      textSecondary: '#bac2de',
      text: '#cdd6f4',
      nodeBg: '#313244',
      success: '#a6e3a1',
      warning: '#fab387',
      error: '#f38ba8',
      info: '#94e2d5'
    }
  },

  ayu: {
    name: 'ayu',
    displayName: '🍃 Ayu Mirage',
    colors: {
      ...colors,
      background: '#1f2430',
      surface: '#232834',
      surfaceHover: '#33415e',
      primary: '#ffcc66',
      secondary: '#5ccfe6',
      border: 'rgba(255, 204, 102, 0.2)',
      textPrimary: '#cccac2',
      textSecondary: '#707a8c',
      text: '#cccac2',
      nodeBg: '#232834',
      success: '#bae67e',
      warning: '#ffcc66',
      error: '#f28779',
      info: '#5ccfe6'
    }
  },

  palenight: {
    name: 'palenight',
    displayName: '🌌 Palenight',
    colors: {
      ...colors,
      background: '#1e1c3f',
      surface: '#292d3e',
      surfaceHover: '#34324a',
      primary: '#c792ea',
      primaryLight: '#c792ea30',
      secondary: '#ffcb6b',
      border: 'rgba(199, 146, 234, 0.2)',
      textPrimary: '#bfc7d5',
      textSecondary: '#959dcb',
      text: '#bfc7d5',
      nodeBg: '#292d3e',
      success: '#c3e88d',
      warning: '#ffcb6b',
      error: '#ff5370',
      info: '#82b1ff'
    }
  },

  custom: {
    name: 'custom',
    displayName: '🎨 Custom Theme',
    colors: {
      ...colors,
      // Default custom theme uses dark theme colors
      background: '#1e1e1e',
      surface: '#252526',
      surfaceHover: '#2d2d2d',
      border: 'rgba(255, 255, 255, 0.12)',
      primary: '#1976D2',
      primaryLight: '#1976D220',
      secondary: '#64B5F6',
      error: '#f14c4c',
      success: '#89d185',
      warning: '#cca700',
      info: '#17a2b8',
      nodeBg: '#252526',
      textPrimary: '#d4d4d4',
      textSecondary: '#8a8a8a',
      text: '#d4d4d4'
    }
  }
};

export const getTheme = (themeName: string, customColors?: Partial<typeof colors>): Theme => {
  if (themeName === 'custom' && customColors) {
    // Merge custom colors with the default custom theme
    return {
      ...themes.custom,
      colors: {
        ...themes.custom.colors,
        ...customColors,
        nodeBg: customColors.surface || themes.custom.colors.nodeBg,
        text: customColors.textPrimary || themes.custom.colors.text
      }
    };
  }
  return themes[themeName] || themes.dark;
};
