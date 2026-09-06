/**
 * Diagram Generation Service for AI-powered diagram creation
 * 
 * Token Requirements:
 * - Simple systems (5-10 components): ~4096-8192 tokens
 * - Medium systems (10-20 components): ~8192-16384 tokens  
 * - Complex systems (20-50 components): ~16384-32768 tokens
 * - Enterprise systems (50+ components): 32768-65536 tokens
 * 
 * The service now uses single AI calls for all contexts with intelligent grouping,
 * providing better coherence and more accurate component relationships.
 * 
 * MAINTENANCE NOTES:
 * - Security zones are automatically pulled from SecurityTypes.securityZones
 * - Node type arrays in getAvailableNodeTypes() must be kept in sync with SecurityTypes.ts type unions
 * - When adding new node types: Update both the type union in SecurityTypes.ts AND the corresponding array here
 * - When adding new security zones: Only update SecurityTypes.ts (this service pulls dynamically)
 */

import { ExampleSystem, SystemCategory } from '../types/ExampleSystemTypes';
import {
  SecurityNode,
  SecurityEdge,
  SecurityZone,
  DataClassification,
  InfrastructureNodeType,
  ApplicationNodeType,
  SecurityControlNodeType,
  CloudNodeType,
  OTNodeType,
  AINodeType,
  CybercrimeNodeType,
  PrivacyNodeType,
  AppSecNodeType,
  RedTeamNodeType,
  AWSNodeType,
  AzureNodeType,
  GCPNodeType,
  IBMNodeType,
  securityZones
} from '../types/SecurityTypes';
import { colors } from '../styles/Theme';
import { generateDiagram, cancelDiagramGeneration } from '../api';
import { generateSecuritySystem } from '../utils/systemGenerator';
import { isVercelDeployment } from '../utils/vercelDetection';

export type DiagramGenerationType = 'technical' | 'process' | 'hybrid' | 'dfd' | 'auto';

export interface DiagramGenerationRequest {
  userContext: string;
  systemName?: string;
  aiProvider?: string;
  generationType?: DiagramGenerationType; // Optional to maintain backward compatibility
  signal?: AbortSignal;
  enableMultiPass?: boolean; // Force enable/disable multi-pass generation
}

export interface DiagramGenerationResult {
  success: boolean;
  diagram?: ExampleSystem;
  error?: string;
  warnings?: string[];
  passesCompleted?: number; // Number of AI passes executed
}

// Simplified format that AI can reliably generate in Cypher format
interface SimplifiedComponent {
  id: string;
  name: string;
  type: string; // One of our valid node types
  zone: SecurityZone;
  description?: string;
  vendor?: string;
  version?: string;
  product?: string;
  technology?: string;
  protocols?: string[];
  securityControls?: string[];
  patchLevel?: string;
  lastUpdated?: string;
  category?: string;
  dataClassification?: string;
  accessControl?: {
    authentication?: string[];
    authorization?: string[];
  };
  instanceCount?: number; // For grouped components (e.g., "Web Servers (5)")
  vulnerabilities?: string[]; // Security issues extracted from description
  misconfigurations?: string[]; // Config issues
  securityGaps?: string[]; // Missing security controls
}

interface SimplifiedConnection {
  from: string; // Component ID
  to: string;   // Component ID
  label: string;
  protocol?: string;
  encryption?: string;
  description?: string;
  portRange?: string;
  dataClassification?: string;
  securityControls?: string[];
  bandwidth?: string;
  latency?: string;
  redundancy?: boolean;
}

interface AIGeneratedDiagram {
  systemName: string;
  description: string;
  components: SimplifiedComponent[];
  connections: SimplifiedConnection[];
  primaryZone: SecurityZone;
  dataClassification: 'Public' | 'Internal' | 'Sensitive' | 'Confidential';
  customContext: string;
}

// Multi-pass validation results
interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  metrics: {
    totalComponents: number;
    genericComponents: number;
    genericPercentage: number;
    orphanedNodes: number;
    orphanedPercentage: number;
    missingComponents?: string[];
    zoneIssues?: string[];
  };
}

interface ValidationIssue {
  type: 'generic_type' | 'orphaned_node' | 'missing_component' | 'invalid_zone' | 'missing_connection';
  severity: 'error' | 'warning';
  description: string;
  affectedComponents?: string[];
}

// Pattern for detecting architectural types from context
interface ArchitecturalPattern {
  name: string;
  keywords: string[];
  zoneLayout: 'horizontal' | 'vertical' | 'l-shape' | 'hub-spoke' | 'hybrid';
  preferredZones: SecurityZone[];
}

// Zone layout result type
interface ZoneLayoutItem {
  id: string;
  zoneType: SecurityZone;
  x: number;
  y: number;
  width: number;
  height: number;
  description: string;
}

type ZoneLayout = ZoneLayoutItem[];

class DiagramGenerationService {
  // Grid and layout constants
  private static readonly NODE_GRID_WIDTH = 3; // Nodes are 3 units wide (150px)
  private static readonly NODE_GRID_HEIGHT = 2; // Nodes are 2 units tall (100px)
  private static readonly ZONE_START_X = 50;
  private static readonly ZONE_WIDTH = 650;
  private static readonly ZONE_HEIGHT = 1000;
  private static readonly ZONE_SPACING = 170; // Increased from 120 for better visual separation
  private static readonly ZONE_START_Y = 50;
  
  // Parser state
  private nodeVariableMap?: Map<string, string>;
  
  // Active generation tracking
  private activeGenerations: Map<AbortSignal, { startTime: Date; context: string; requestId?: string }> = new Map();
  
  // Track current provider for error handling
  private currentProvider?: string;
  
  private lastUserPrompt?: string;

  /**
   * Check if the current provider is a local LLM
   */
  public isLocalLLMProvider(provider?: string): boolean {
    const providerLower = provider?.toLowerCase() || '';
    return providerLower === 'local' || providerLower === 'ollama' || 
           providerLower === 'localhost' || providerLower.includes('localhost') ||
           providerLower.includes('11434'); // Common Ollama port
  }
  
  /**
   * Architectural patterns for intelligent zone layout
   */
  private getArchitecturalPatterns(): ArchitecturalPattern[] {
    return [
      {
        name: 'Enterprise Data Center',
        keywords: ['enterprise', 'data center', 'datacenter', 'corporate', 'traditional', 'legacy'],
        zoneLayout: 'horizontal',
        preferredZones: ['Internet', 'External', 'DMZ', 'Internal', 'Trusted', 'Critical']
      },
      {
        name: 'DevOps Pipeline',
        keywords: ['devops', 'ci/cd', 'pipeline', 'development', 'staging', 'deployment'],
        zoneLayout: 'l-shape',
        preferredZones: ['Development', 'Staging', 'Production', 'Cloud']
      },
      {
        name: 'Industrial Control',
        keywords: ['industrial', 'scada', 'ot', 'operational technology', 'control system', 'manufacturing'],
        zoneLayout: 'vertical',
        preferredZones: ['External', 'DMZ', 'OT', 'Critical']
      },
      {
        name: 'Cloud Hybrid',
        keywords: ['cloud', 'hybrid', 'aws', 'azure', 'gcp', 'multi-cloud', 'saas'],
        zoneLayout: 'hybrid',
        preferredZones: ['Internal', 'Cloud', 'External', 'DMZ']
      },
      {
        name: 'Zero Trust',
        keywords: ['zero trust', 'micro-segmentation', 'security mesh', 'service mesh'],
        zoneLayout: 'hub-spoke',
        preferredZones: ['Internet', 'DMZ', 'Internal', 'Restricted', 'Critical']
      },
      {
        name: 'Security Operations',
        keywords: ['security', 'soc', 'red team', 'blue team', 'purple team', 'penetration'],
        zoneLayout: 'hub-spoke',
        preferredZones: ['RedTeam', 'BlueTeam', 'PurpleTeam', 'Internal', 'Critical']
      }
    ];
  }

  /**
   * Detect architectural pattern from user context
   */
  private detectArchitecturalPattern(userContext: string): ArchitecturalPattern {
    const patterns = this.getArchitecturalPatterns();
    const lowerContext = userContext.toLowerCase();
    
    for (const pattern of patterns) {
      const matchScore = pattern.keywords.reduce((score, keyword) => {
        return score + (lowerContext.includes(keyword) ? 1 : 0);
      }, 0);
      
      if (matchScore > 0) {
        console.log(`[Architecture] Detected pattern: ${pattern.name} (score: ${matchScore})`);
        return pattern;
      }
    }
    
    // Default to enterprise pattern
    console.log('[Architecture] Using default Enterprise Data Center pattern');
    return patterns[0];
  }

  /**
   * Get all available security zones dynamically from SecurityTypes
   */
  private getAvailableZones(): SecurityZone[] {
    return [...securityZones];
  }

  /**
   * Get all available node types dynamically from SecurityTypes
   * Note: These arrays are maintained to match the type unions in SecurityTypes.ts
   * When adding new node types, update both the type unions and these arrays
   * NOTE: DFD node types (dfdActor, dfdProcess, dfdDataStore, dfdTrustBoundary) are excluded by default
   * unless specifically generating a DFD diagram
   */
  private getAvailableNodeTypes(generationType?: DiagramGenerationType): {
    infrastructure: string[];
    application: string[];
    security: string[];
    cloud: string[];
    ot: string[];
    ai: string[];
    cybercrime: string[];
    privacy: string[];
    appSec: string[];
    redTeam: string[];
    aws: string[];
    azure: string[];
    gcp: string[];
    ibm: string[];
    all: string[];
  } {
    // Infrastructure node types - keep in sync with InfrastructureNodeType
    const infrastructure: InfrastructureNodeType[] = [
      'server', 'workstation', 'endpoint', 'printer', 'router', 'switch', 
      'dns', 'gateway'
    ];
    
    // Application node types - keep in sync with ApplicationNodeType
    const application: ApplicationNodeType[] = [
      'application', 'database', 'loadBalancer', 'apiGateway',
      'webServer', 'authServer', 'messageBroker', 'api', 'service', 'cache',
      'storage', 'vault', 'identity', 'logging'
    ];
    
    // Security control node types - keep in sync with SecurityControlNodeType
    const security: SecurityControlNodeType[] = [
      'firewall', 'vpnGateway', 'ids', 'ips', 'waf', 'proxy', 'reverseProxy', 
      'monitor', 'siem', 'soar', 'xdr', 'edr', 'ndr', 'casb', 'sase', 'ztna', 
      'dlp', 'dam', 'pam', 'hsm', 'kms', 'secretsManager', 'certificateAuthority', 
      'mfa', 'sso', 'ldap', 'radiusServer', 'honeypot', 'honeynet', 'deceptionSystem', 
      'networkTap', 'packetCapture', 'vulnerabilityScanner', 'patchManagement', 
      'configManagement', 'complianceScanner', 'penTestTool', 'staticAnalysis', 
      'dynamicAnalysis', 'containerScanner', 'k8sAdmissionController', 'meshProxy', 
      'apiSecurity', 'botProtection', 'ddosProtection', 'emailSecurity', 'webFilter', 
      'sandboxAnalyzer', 'threatIntelPlatform', 'forensicsStation', 
      'incidentResponsePlatform', 'backupSystem', 'disasterRecovery', 
      'encryptionGateway', 'tokenizer', 'riskAnalytics', 'identityGovernance', 
      'cloudSecurityPosture', 'workloadProtection', 'runtimeProtection', 
      'supplychainSecurity', 'codeRepository', 'cicdSecurity', 'secretScanner', 
      'sbom', 'dependencyScanner', 'infrastructureAsCode', 'policyAsCode', 
      'cloudAccessBroker', 'remoteAccessGateway', 'bastionHost', 'jumpServer', 
      'aiSecurityGateway', 'quantumKeyDistribution', 'blockchainSecurity', 
      'otSecurityGateway', 'iotSecurityGateway', 'physicalAccessControl', 
      'videoSurveillance', 'securityOrchestrator'
    ];
    
    // Cloud node types - keep in sync with CloudNodeType
    const cloud: CloudNodeType[] = [
      'cloudService', 'containerRegistry', 'kubernetesPod', 'kubernetesService',
      'storageAccount', 'functionApp', 'apiManagement', 'cloudLoadBalancer',
      'cloudFirewall', 'cloudDatabase'
    ];
    
    // OT node types - keep in sync with OTNodeType
    const ot: OTNodeType[] = [
      'plc', 'hmi', 'historian', 'rtu', 'sensor', 'actuator', 'scadaServer',
      'industrialFirewall', 'safetySystem', 'industrialNetwork'
    ];
    
    // AI node types - keep in sync with AINodeType
    const ai: AINodeType[] = [
      'aiModel', 'llmService', 'mlPipeline', 'aiGateway', 'vectorDatabase',
      'modelRegistry', 'inferenceEngine', 'aiWorkbench', 'dataLake', 'featureStore', 
      'mlInference', 'notebookServer', 'computeCluster', 'modelVault', 'ai'
    ];
    
    // Cybercrime node types - keep in sync with CybercrimeNodeType
    const cybercrime: CybercrimeNodeType[] = [
      'fraudDetection', 'transactionMonitor', 'antiMalware', 'honeypot', 'threatFeed',
      'sandboxEnv', 'forensicsWorkstation', 'incidentResponse', 'cyberInsurance', 'fraudAnalytics'
    ];
    
    // Privacy node types - keep in sync with PrivacyNodeType
    const privacy: PrivacyNodeType[] = [
      'dataClassifier', 'consentManager', 'dataMapper', 'privacyScanner', 'dataRetention',
      'dataAnonymizer', 'gdprCompliance', 'dataBreach', 'privacyImpact', 'dataSubjectRights'
    ];
    
    // AppSec node types - keep in sync with AppSecNodeType
    const appSec: AppSecNodeType[] = [
      'memoryPool', 'executionContext', 'sessionStore', 'inputBuffer', 'outputBuffer',
      'configManager', 'cryptoModule', 'tokenValidator', 'permissionEngine', 'auditLogger'
    ];
    
    // Red Team node types - keep in sync with RedTeamNodeType
    const redTeam: RedTeamNodeType[] = [
      'attackBox', 'payloadServer', 'c2Server', 'implant', 'phishingServer',
      'exfilChannel', 'pivotPoint', 'credentialHarvester', 'lateralMovement', 'persistenceMechanism'
    ];

    // AWS node types - keep in sync with AWSNodeType
    const aws: AWSNodeType[] = [
      'awsEC2', 'awsLambda', 'awsECS', 'awsEKS', 'awsS3', 'awsRDS', 'awsDynamoDB',
      'awsVPC', 'awsCloudFront', 'awsAPIGateway', 'awsIAM', 'awsCognito', 'awsKMS',
      'awsSecretsManager', 'awsGuardDuty', 'awsSecurityHub', 'awsWAF', 'awsShield',
      'awsCloudTrail', 'awsConfig', 'awsMacie'
    ];

    // Azure node types - keep in sync with AzureNodeType
    const azure: AzureNodeType[] = [
      'azureVM', 'azureAppService', 'azureFunctions', 'azureKubernetesService',
      'azureBlobStorage', 'azureSQLDatabase', 'azureCosmosDB', 'azureVirtualNetwork',
      'azureActiveDirectory', 'azureKeyVault', 'azureSecurityCenter', 'azureSentinel',
      'azureDefender', 'azureFirewall', 'azureMonitor'
    ];

    // GCP node types - keep in sync with GCPNodeType
    const gcp: GCPNodeType[] = [
      'gcpComputeEngine', 'gcpCloudFunctions', 'gcpGKE', 'gcpCloudStorage',
      'gcpCloudSQL', 'gcpBigQuery', 'gcpVPC', 'gcpIAM', 'gcpSecretManager',
      'gcpCloudKMS', 'gcpSecurityCommandCenter', 'gcpCloudArmor', 'gcpCloudLogging'
    ];

    // IBM node types - keep in sync with IBMNodeType
    const ibm: IBMNodeType[] = [
      'ibmVirtualServer', 'ibmKubernetes', 'ibmObjectStorage', 'ibmDatabase',
      'ibmVPC', 'ibmCloudIAM', 'ibmKeyProtect', 'ibmSecurityAdvisor'
    ];

    // If generating DFD diagram, return only DFD node types
    if (generationType === 'dfd') {
      return {
        infrastructure: [],
        application: [],
        security: [],
        cloud: [],
        ot: [],
        ai: [],
        cybercrime: [],
        privacy: [],
        appSec: [],
        redTeam: [],
        aws: [],
        azure: [],
        gcp: [],
        ibm: [],
        all: ['dfdActor', 'dfdProcess', 'dfdDataStore', 'dfdTrustBoundary']
      };
    }

    return {
      infrastructure: infrastructure as string[],
      application: application as string[],
      security: security as string[],
      cloud: cloud as string[],
      ot: ot as string[],
      ai: ai as string[],
      cybercrime: cybercrime as string[],
      privacy: privacy as string[],
      appSec: appSec as string[],
      redTeam: redTeam as string[],
      aws: aws as string[],
      azure: azure as string[],
      gcp: gcp as string[],
      ibm: ibm as string[],
      all: [
        ...infrastructure, ...application, ...security, ...cloud, ...ot, ...ai,
        ...cybercrime, ...privacy, ...appSec, ...redTeam,
        ...aws, ...azure, ...gcp, ...ibm,
        'generic' // Add generic as a valid type
      ] as string[]
    };
  }

  /**
   * Generate a threat model diagram from user context using AI
   */
  async generateDiagram(request: DiagramGenerationRequest & { onProgress?: (stage: string, progress: number) => void }): Promise<DiagramGenerationResult> {
    const reportProgress = (stage: string, progress: number) => {
      console.log(`[DiagramGeneration] ${stage} - ${progress}%`);
      request.onProgress?.(stage, progress);
    };

    // Track this generation if signal provided
    if (request.signal) {
      this.activeGenerations.set(request.signal, {
        startTime: new Date(),
        context: request.userContext.substring(0, 100) + '...'
      });

      // Clean up when cancelled
      request.signal.addEventListener('abort', () => {
        this.handleCancellation(request.signal!);
      });
    }

    try {
      reportProgress('Validating', 10);
      
      // Validate context size to prevent timeouts
      const MAX_CONTEXT_LENGTH = 15000; // ~100 components max
      const RECOMMENDED_CONTEXT_LENGTH = 5000; // ~30-40 components recommended
      
      if (request.userContext.length > MAX_CONTEXT_LENGTH) {
        return {
          success: false,
          error: `System description is too large (${request.userContext.length} characters). Maximum allowed is ${MAX_CONTEXT_LENGTH} characters. Please break down your system into smaller subsystems or focus on specific areas.`
        };
      }
      
      if (request.userContext.length > RECOMMENDED_CONTEXT_LENGTH) {
        console.warn(`Large context detected (${request.userContext.length} characters). This may take longer to process.`);
      }
      
      reportProgress('Preparing', 20);
      
      // Store the current provider for error handling
      this.currentProvider = request.aiProvider;
      
      // Store user prompt for LangExtract context
      this.lastUserPrompt = request.userContext;
      
      // Always use single prompt approach with efficient Cypher format
      console.log('Generating diagram with single AI call for context:', request.userContext.length, 'characters');
      const generationType = request.generationType || 'hybrid'; // Default to hybrid for backward compatibility
      console.log('Using generation type:', generationType);
      // Prompt generation is now handled by the server endpoint
      
      // Request AI generation
      const context = {
        allowedNodeTypes: ['securityZone', ...this.getAvailableNodeTypes(generationType).all],
        allowedSecurityZones: this.getAvailableZones(),
        diagram: { nodes: [], edges: [], metadata: {} },
        customContext: { content: request.userContext, sanitizedContent: request.userContext, timestamp: new Date() },
        drawings: [],
        messageHistory: [],
        threatIntel: null,
        metadata: {
          lastModified: new Date(),
          version: '1.0.0',
          systemType: 'default',
          isInitialSystem: true,
          customContext: { content: request.userContext, sanitizedContent: request.userContext, timestamp: new Date() },
        }
      };
      
      reportProgress('Requesting AI', 30);
      
      let aiResponseContent: string;
      try {
        console.log(`[DiagramGeneration] Sending request to AI at ${new Date().toISOString()}`);
        const startTime = Date.now();
        
        // Set up a progress interval to show the request is still active
        let progressValue = 30;
        const progressInterval = setInterval(() => {
          // Check if the request was cancelled
          if (request.signal?.aborted) {
            clearInterval(progressInterval);
            return;
          }
          
          // Gradually increase progress from 30% to 55% over time
          // This gives visual feedback during long AI requests
          if (progressValue < 55) {
            progressValue += 1;
            reportProgress('Requesting AI (processing large system...)', progressValue);
          }
        }, 5000); // Update every 5 seconds
        
        try {
          // Add flag to ensure chat mode is used, not threat analysis mode
          const aiResponse = await generateDiagram(
            request.userContext + '\n\nLayout requirements: Return a complete ContextCypher graph with finite x/y positions. Arrange sibling components without overlap and leave room for labels. Use context.allowedNodeTypes and context.allowedSecurityZones for type and zoneType values; custom zone names belong in labels. Keep security zones as securityZone containers, with sufficient width/height to contain their children. For parentId relationships use parent-relative positions. Preserve meaningful security properties and edge data in the graph.',
            generationType, context, request.signal,
          );
          
          // Clear the progress interval once we get a response
          clearInterval(progressInterval);
          
          const responseTime = Date.now() - startTime;
          console.log(`[DiagramGeneration] AI response received after ${responseTime}ms (${(responseTime / 1000).toFixed(1)}s)`);
          
          // Store the requestId if available for cancellation tracking
          if (request.signal && 'requestId' in aiResponse && aiResponse.requestId && this.activeGenerations.has(request.signal)) {
            const generation = this.activeGenerations.get(request.signal)!;
            generation.requestId = aiResponse.requestId as string;
          }
          
          // Update progress now that we have the response
          reportProgress('Processing Response', 60);
          
          if (!aiResponse.success) {
            return {
              success: false,
              error: aiResponse.error || 'AI request failed'
            };
          }
          
          if (!aiResponse.content) {
            return {
              success: false,
              error: 'AI response was empty'
            };
          }
          
          aiResponseContent = aiResponse.content;
          console.log(`[DiagramGeneration] Received AI response: ${aiResponseContent.length} characters`);
          
          // Store the response for debugging if needed
          if (aiResponseContent.length > 50000) {
            console.warn(`[DiagramGeneration] Very large AI response: ${aiResponseContent.length} characters`);
          }
        } finally {
          // Ensure interval is cleared even if there's an error
          clearInterval(progressInterval);
        }
      } catch (error) {
        console.error('[DiagramGeneration] AI request failed:', error);
        
        // Check if it's a timeout error
        if (error instanceof Error && (error.message.includes('timeout') || error.message.includes('ECONNABORTED'))) {
          return {
            success: false,
            error: 'Request timed out after 10 minutes. This can happen with very large systems during peak usage. Please try again - the AI provider may complete the request faster on retry.'
          };
        }
        
        return {
          success: false,
          error: error instanceof Error ? error.message : 'AI request failed'
        };
      }
      
      // Now parse the response without network timeout constraints
      reportProgress('Parsing', 70);
      
      // Complete Guardian graphs own their layout and security data. Keep that payload intact.
      const fullGraph = this.readGuardianGraph(aiResponseContent, request);
      if (fullGraph) {
        request.signal?.throwIfAborted();
        reportProgress('Complete', 100);
        return { success: true, diagram: fullGraph, passesCompleted: 1 };
      }

      // Legacy Cypher/simple-component responses retain their original layout workflow.
      let parsedDiagram = await this.parseAIResponseAsync(aiResponseContent, (stage: string) => {
        reportProgress(stage, 70);
      });
      
      if (!parsedDiagram) {
        return {
          success: false,
          error: 'Failed to parse AI response into valid diagram structure'
        };
      }
      
      reportProgress('Validating', 75);
      
      // Log component count for monitoring
      if (parsedDiagram.components) {
        console.log(`[DiagramGeneration] AI generated ${parsedDiagram.components.length} components`);
      }

      // Override system name if provided
      if (request.systemName) {
        parsedDiagram.systemName = request.systemName;
      }

      // Validate the simplified diagram
      const validation = this.validateSimplifiedDiagram(parsedDiagram, generationType);
      
      if (!validation.isValid) {
        return {
          success: false,
          error: `Generated diagram validation failed: ${validation.errors.join(', ')}`
        };
      }
      
      // Multi-pass generation - now enabled for ALL providers including local LLMs
      const providerLower = request.aiProvider?.toLowerCase() || '';
      const isLocalLLM = providerLower === 'local' || providerLower === 'ollama' || 
                        providerLower === 'localhost' || providerLower.includes('localhost') ||
                        providerLower.includes('11434'); // Common Ollama port
      
      console.log('[DiagramGeneration] Multi-pass check:', {
        aiProvider: request.aiProvider,
        providerLower,
        isLocalLLM,
        componentCount: parsedDiagram.components.length,
        enableMultiPass: request.enableMultiPass
      });
      
      // Enable multi-pass for local LLMs to ensure connection validation
      // Local LLMs benefit from validation passes to catch missing connections
      const shouldUseMultiPass = request.enableMultiPass !== undefined ? 
        request.enableMultiPass : 
        true; // Default to true for all providers
      
      console.log('[DiagramGeneration] Multi-pass decision:', shouldUseMultiPass, isLocalLLM ? '(enabled for local LLMs)' : '');
      
      let passesCompleted = 1;
      let improvedDiagram = parsedDiagram;
      
      if (shouldUseMultiPass) {
        console.log('[DiagramGeneration] Multi-pass mode ENABLED for improved quality');
        
        // Perform detailed validation
        let detailedValidation = this.validateDiagram(improvedDiagram, request.userContext, generationType);
        console.log('[DiagramGeneration] Initial validation results:', {
          genericPercentage: detailedValidation.metrics.genericPercentage.toFixed(1) + '%',
          orphanedNodes: detailedValidation.metrics.orphanedNodes,
          orphanedPercentage: detailedValidation.metrics.orphanedPercentage.toFixed(1) + '%',
          issues: detailedValidation.issues.length,
          errorCount: detailedValidation.issues.filter(i => i.severity === 'error').length
        });
        
        // Perform up to 2 additional passes if there are significant issues
        const maxPasses = 3;
        const thresholds = {
          genericPercentage: 20, // More than 20% generic is problematic
          orphanedPercentage: 15, // More than 15% orphaned is problematic
          minIssuesForPass: 3 // Need at least 3 issues to warrant another pass
        };
        
        while (passesCompleted < maxPasses && 
               (detailedValidation.metrics.genericPercentage > thresholds.genericPercentage ||
                detailedValidation.metrics.orphanedPercentage > thresholds.orphanedPercentage ||
                detailedValidation.issues.filter(i => i.severity === 'error').length > 0) &&
               detailedValidation.issues.length >= thresholds.minIssuesForPass) {
          
          passesCompleted++;
          console.log(`[DiagramGeneration] Starting pass ${passesCompleted} to improve diagram quality`);
          reportProgress(`Improving (Pass ${passesCompleted})`, 65 + (passesCompleted * 5));
          
          try {
            // Generate improvement prompt
            const improvementPrompt = this.generateValidationPrompt(detailedValidation, improvedDiagram, request.userContext, generationType);
            
            // Make another AI call for improvements
            const improvementResponse = await generateDiagram(
              improvementPrompt, 
              generationType, 
              {
                ...context,
                isImprovementPass: true,
                passNumber: passesCompleted
              },
              request.signal
            );
            
            if (improvementResponse.success && improvementResponse.content) {
              const improvedParsed = await this.parseAIResponseAsync(improvementResponse.content, (stage: string) => {
                reportProgress(`${stage} (Pass ${passesCompleted})`, 70 + (passesCompleted * 5));
              });
              
              if (improvedParsed && improvedParsed.components.length > 0) {
                // Validate the improvement
                const improvedValidation = this.validateDiagram(improvedParsed, request.userContext, generationType);
                
                // Only use the improvement if it's actually better
                const oldScore = detailedValidation.metrics.genericPercentage + 
                               (detailedValidation.metrics.orphanedPercentage * 2); // Weight orphans more heavily
                const newScore = improvedValidation.metrics.genericPercentage + 
                               (improvedValidation.metrics.orphanedPercentage * 2);
                
                if (newScore < oldScore || improvedValidation.issues.length < detailedValidation.issues.length) {
                  console.log(`[DiagramGeneration] Pass ${passesCompleted} improved the diagram:`);
                  console.log(`  - Generic: ${detailedValidation.metrics.genericPercentage.toFixed(1)}% -> ${improvedValidation.metrics.genericPercentage.toFixed(1)}%`);
                  console.log(`  - Orphaned: ${detailedValidation.metrics.orphanedNodes} -> ${improvedValidation.metrics.orphanedNodes}`);
                  console.log(`  - Issues: ${detailedValidation.issues.length} -> ${improvedValidation.issues.length}`);
                  
                  improvedDiagram = improvedParsed;
                  detailedValidation = improvedValidation; // Update validation for next pass
                } else {
                  console.log(`[DiagramGeneration] Pass ${passesCompleted} did not improve the diagram, keeping previous version`);
                  break; // No improvement, stop trying
                }
              }
            }
          } catch (error) {
            console.error(`[DiagramGeneration] Error in improvement pass ${passesCompleted}:`, error);
            // Continue with what we have
            break;
          }
        }
        
        console.log(`[DiagramGeneration] Multi-pass complete. Total passes: ${passesCompleted}`);
        if (passesCompleted > 1) {
          console.log('[DiagramGeneration] Final validation after multi-pass:', {
            genericPercentage: detailedValidation.metrics.genericPercentage.toFixed(1) + '%',
            orphanedNodes: detailedValidation.metrics.orphanedNodes,
            issues: detailedValidation.issues.length
          });
        }
        parsedDiagram = improvedDiagram;
      } else {
        console.log('[DiagramGeneration] Multi-pass NOT enabled. Check provider detection.');
      }

      reportProgress('Building', 85);

      // Trust the AI to generate all necessary connections
      // No fallback connections - the AI should create exactly what's described
      if (!parsedDiagram.connections || parsedDiagram.connections.length === 0) {
        console.warn('No connections generated by AI - this may indicate an issue with the prompt or AI response');
      }

      // Generate layout using intelligent positioning
      const layoutStartTime = Date.now();
      let layoutData;
      try {
        layoutData = this.generateLayout(parsedDiagram, generationType);
        console.log(`[DiagramGeneration] Layout generation took ${Date.now() - layoutStartTime}ms`);
      } catch (layoutError) {
        console.error('[DiagramGeneration] Layout generation failed:', layoutError);
        return { success: false, error: 'The generated components could not be laid out. No diagram was created.' };
      }

      reportProgress('Finalizing', 95);

      // Convert to ExampleSystem format using the layout
      const convertStartTime = Date.now();
      const diagram = this.convertToExampleSystem(parsedDiagram, layoutData);
      console.log(`[DiagramGeneration] Conversion took ${Date.now() - convertStartTime}ms`);

      // Final validation - ensure we have a valid diagram
      if (!diagram || !diagram.nodes || diagram.nodes.length === 0) {
        return { success: false, error: 'The model did not produce a usable diagram. No diagram was created.' };
      }
      
      reportProgress('Complete', 100);
      
      return {
        success: true,
        diagram,
        warnings: validation.warnings,
        passesCompleted: passesCompleted || 1
      };

    } catch (error) {
      console.error('Diagram generation failed:', error);
      
      // Check if it was cancelled
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: 'Generation cancelled by user'
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    } finally {
      // Clean up tracking
      if (request.signal) {
        this.activeGenerations.delete(request.signal);
      }
    }
  }


  private readGuardianGraph(content: string, request: DiagramGenerationRequest): ExampleSystem | null {
    let graph: any;
    try { graph = JSON.parse(content); } catch { return null; }
    if (!graph || typeof graph !== 'object' || Array.isArray(graph) || (!('nodes' in graph) && !('edges' in graph))) return null;
    if (!Array.isArray(graph.nodes) || !graph.nodes.length || !Array.isArray(graph.edges)) {
      throw new Error('The model returned an empty or invalid graph. No diagram was created.');
    }
    const nodes = new Map<string, any>();
    for (const node of graph.nodes) {
      if (!node || typeof node.id !== 'string' || !node.id || nodes.has(node.id) ||
          typeof node.type !== 'string' || !node.type || !node.data || typeof node.data !== 'object' || Array.isArray(node.data) ||
          !Number.isFinite(node.position?.x) || !Number.isFinite(node.position?.y)) {
        throw new Error('The model returned an invalid node. No diagram was created.');
      }
      nodes.set(node.id, node);
    }
    for (const node of graph.nodes) {
      const visited = new Set<string>([node.id]);
      let parent = node.parentId ?? node.parentNode;
      while (parent !== undefined) {
        if (typeof parent !== 'string' || !nodes.has(parent) || visited.has(parent)) throw new Error('The model returned an invalid node hierarchy. No diagram was created.');
        visited.add(parent);
        const ancestor = nodes.get(parent);
        parent = ancestor.parentId ?? ancestor.parentNode;
      }
    }
    const edgeIds = new Set<string>();
    for (const edge of graph.edges) {
      if (!edge || typeof edge.id !== 'string' || !edge.id || edgeIds.has(edge.id) || !nodes.has(edge.source) || !nodes.has(edge.target)) {
        throw new Error('The model returned an invalid connection. No diagram was created.');
      }
      edgeIds.add(edge.id);
    }
    return {
      ...graph,
      id: typeof graph.id === 'string' && graph.id ? graph.id : crypto.randomUUID(),
      name: request.systemName || graph.name || graph.systemName || 'Generated system',
      description: graph.description ?? '',
      category: graph.category ?? 'Enterprise Systems',
      primaryZone: graph.primaryZone ?? 'Internal',
      dataClassification: graph.dataClassification ?? 'Internal',
      customContext: graph.customContext ?? request.userContext,
    } as ExampleSystem;
  }

  private async parseAIResponseAsync(aiResponse: string, onProgress?: (stage: string) => void): Promise<AIGeneratedDiagram | null> {
    onProgress?.('Reading generated architecture');
    return this.parseAIResponse(aiResponse);
  }

  /**
   * Parse AI response from Cypher format into structured diagram data
   */
  private parseAIResponse(aiResponse: string): AIGeneratedDiagram | null {
    const startTime = Date.now();
    
    try {
      // First check if it's plain JSON from local LLM
      try {
        const jsonData = JSON.parse(aiResponse);
        if (jsonData.components && Array.isArray(jsonData.components)) {
          console.log('[Parsing] Found plain JSON format response from local LLM');
          // Convert the simple JSON format to AIGeneratedDiagram format
          return this.convertSimpleJsonToDiagram(jsonData);
        }
      } catch (e) {
        // Not plain JSON, continue with other formats
      }

      // Try to extract Cypher format
      const cypherMatch = aiResponse.match(/```cypher\s*([\s\S]*?)```/);
      if (cypherMatch) {
        console.log('[Parsing] Found Cypher format response');
        return this.parseCypherResponse(cypherMatch[1]);
      }

      // Fallback to JSON format in code blocks
      let jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)```/);
      if (jsonMatch) {
        console.log('[Parsing] Found JSON format response in code block');
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.components && Array.isArray(parsed.components)) {
          return this.convertSimpleJsonToDiagram(parsed);
        }
        return parsed as AIGeneratedDiagram;
      }
      
      // Try to find raw JSON object
      jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        console.log('[Parsing] Found raw JSON response (fallback)');
        const parsed = JSON.parse(jsonMatch[0]);
        
        if (parsed.components && Array.isArray(parsed.components)) {
          return this.convertSimpleJsonToDiagram(parsed);
        }
        
        // Legacy format validation
        const diagram = parsed as AIGeneratedDiagram;
        if (!diagram.components) diagram.components = [];
        if (!diagram.connections) diagram.connections = [];
        if (!diagram.systemName) diagram.systemName = 'System Architecture';
        if (!diagram.description) diagram.description = 'Generated system diagram';
        if (!diagram.primaryZone) diagram.primaryZone = 'Internal';
        if (!diagram.dataClassification) diagram.dataClassification = 'Internal';
        
        return diagram;
      }

      console.error('No Cypher or JSON found in AI response');
      return null;
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      console.log('[DiagramGeneration] Raw AI response (first 1000 chars):', aiResponse.substring(0, 1000));
      
      // For local LLMs, try to be more forgiving with parsing
      if (this.isLocalLLMProvider(this.currentProvider)) {
        console.log('[DiagramGeneration] Attempting lenient parsing for local LLM response');
        
        // Try to extract CREATE statements even if format is broken
        const createStatements = aiResponse.match(/CREATE\s*\([^)]+\)[^)]*\)/g);
        if (createStatements && createStatements.length > 0) {
          console.log(`[DiagramGeneration] Found ${createStatements.length} CREATE statements, attempting to parse`);
          
          const components: SimplifiedComponent[] = [];
          const connections: SimplifiedConnection[] = [];
          
          for (const statement of createStatements) {
            // Try to parse node creation
            const nodeMatch = statement.match(/CREATE\s*\(([^:]+):([^{]+)\{([^}]+)\}\)/);
            if (nodeMatch) {
              const varName = nodeMatch[1].trim();
              const nodeType = nodeMatch[2].trim();
              const propsString = nodeMatch[3];
              
              // Parse properties
              const props: any = {};
              const propMatches = Array.from(propsString.matchAll(/(\w+)\s*:\s*'([^']+)'/g));
              for (const match of propMatches) {
                props[match[1]] = match[2];
              }
              
              if (props.id && props.label) {
                components.push({
                  id: props.id,
                  name: props.label,
                  type: props.type || 'generic',
                  zone: props.zone || 'Internal',
                  description: props.description,
                  vendor: props.vendor,
                  version: props.version,
                  technology: props.technology,
                  protocols: props.protocols?.split(','),
                  securityControls: props.securityControls?.split(','),
                  instanceCount: props.instanceCount ? parseInt(props.instanceCount) : undefined,
                  vulnerabilities: props.vulnerabilities?.split(','),
                  misconfigurations: props.misconfigurations?.split(','),
                  securityGaps: props.securityGaps?.split(',')
                });
              }
            }
            
            // Try to parse connection creation
            const connMatch = statement.match(/CREATE\s*\(([^)]+)\)-\[([^]]+)\]->\(([^)]+)\)/);
            if (connMatch) {
              const from = connMatch[1].trim();
              const edgeInfo = connMatch[2];
              const to = connMatch[3].trim();
              
              // Extract edge properties
              const labelMatch = edgeInfo.match(/label\s*:\s*'([^']+)'/);
              const protocolMatch = edgeInfo.match(/protocol\s*:\s*'([^']+)'/);
              const encryptionMatch = edgeInfo.match(/encryption\s*:\s*'([^']+)'/);
              
              connections.push({
                from,
                to,
                label: labelMatch ? labelMatch[1] : 'connects to',
                protocol: protocolMatch ? protocolMatch[1] : undefined,
                encryption: encryptionMatch ? encryptionMatch[1] : undefined
              });
            }
          }
          
          if (components.length > 0) {
            console.log(`[DiagramGeneration] Successfully extracted ${components.length} components from malformed response`);
            return {
              systemName: 'Generated System',
              description: 'System generated from AI response',
              components,
              connections,
              primaryZone: 'Internal',
              dataClassification: 'Internal',
              customContext: ''
            };
          }
        }
      }
      
      return null;
    }
  }

  /**
   * Normalize zone names from local LLMs to match SecurityZone types
   */
  private normalizeZoneName(zoneInput: string): SecurityZone {
    if (!zoneInput) return 'Internal';
    
    const zoneLower = zoneInput.toLowerCase();
    
    // Direct mapping for common patterns - only valid SecurityZone types
    if (zoneLower.includes('internet') || zoneLower.includes('customer facing')) return 'Internet';
    if (zoneLower.includes('dmz') || zoneLower.includes('public service')) return 'DMZ';
    if (zoneLower.includes('internal') && !zoneLower.includes('restricted')) return 'Internal';
    if (zoneLower.includes('production') || zoneLower.includes('critical service')) return 'Production';
    if (zoneLower.includes('restricted') || zoneLower.includes('sensitive')) return 'Restricted';
    if (zoneLower.includes('cloud')) return 'Cloud';
    if (zoneLower.includes('external') && !zoneLower.includes('internet')) return 'External';
    if (zoneLower.includes('trusted')) return 'Trusted';
    if (zoneLower.includes('management')) return 'Management';
    if (zoneLower.includes('development') || zoneLower.includes('dev')) return 'Development';
    if (zoneLower.includes('staging')) return 'Staging';
    if (zoneLower.includes('ot') || zoneLower.includes('operational technology')) return 'OT';
    if (zoneLower.includes('critical')) return 'Critical';
    if (zoneLower.includes('guest')) return 'Guest';
    if (zoneLower.includes('compliance')) return 'Compliance';
    if (zoneLower.includes('control') && zoneLower.includes('plane')) return 'ControlPlane';
    if (zoneLower.includes('data') && zoneLower.includes('plane')) return 'DataPlane';
    if (zoneLower.includes('service') && zoneLower.includes('mesh')) return 'ServiceMesh';
    if (zoneLower.includes('back') && zoneLower.includes('office')) return 'BackOffice';
    if (zoneLower.includes('partner')) return 'Partner';
    if (zoneLower.includes('third') && zoneLower.includes('party')) return 'ThirdParty';
    if (zoneLower.includes('quarantine') || zoneLower.includes('isolation')) return 'Quarantine';
    if (zoneLower.includes('recovery') || zoneLower.includes('dr')) return 'Recovery';
    if (zoneLower.includes('edge')) return 'Edge';
    if (zoneLower.includes('hybrid')) return 'Hybrid';
    if (zoneLower.includes('multi') && zoneLower.includes('cloud')) return 'MultiCloud';
    if (zoneLower.includes('red') && zoneLower.includes('team')) return 'RedTeam';
    if (zoneLower.includes('blue') && zoneLower.includes('team')) return 'BlueTeam';
    if (zoneLower.includes('purple') && zoneLower.includes('team')) return 'PurpleTeam';
    if (zoneLower.includes('yellow') && zoneLower.includes('team')) return 'YellowTeam';
    if (zoneLower.includes('green') && zoneLower.includes('team')) return 'GreenTeam';
    if (zoneLower.includes('orange') && zoneLower.includes('team')) return 'OrangeTeam';
    if (zoneLower.includes('white') && zoneLower.includes('team')) return 'WhiteTeam';
    if (zoneLower.includes('generic')) return 'Generic';
    
    // Default to Internal if no match
    return 'Internal';
  }

  /**
   * Convert simple JSON format from local LLMs to AIGeneratedDiagram format
   */
  private convertSimpleJsonToDiagram(jsonData: any): AIGeneratedDiagram {
    const components: SimplifiedComponent[] = [];
    const connections: SimplifiedConnection[] = [];
    
    // Create name-to-ID mapping for connections
    const nameToIdMap = new Map<string, string>();
    
    // Process components
    if (jsonData.components && Array.isArray(jsonData.components)) {
      jsonData.components.forEach((comp: any, index: number) => {
        const id = comp.id || `comp-${index}`;
        const name = comp.name || `Component ${index + 1}`;
        
        // Store name-to-ID mapping for connection resolution
        nameToIdMap.set(name, id);
        
        // Normalize zone name from local LLM
        let zone = this.normalizeZoneName(comp.zone);
        
        // Double-check it's a valid zone
        if (!securityZones.includes(zone)) {
          console.warn(`Invalid zone "${comp.zone}" normalized to "${zone}" for component "${comp.name}", defaulting to Internal`);
          zone = 'Internal';
        } else if (comp.zone !== zone) {
          console.log(`[Local LLM] Normalized zone "${comp.zone}" to "${zone}" for component "${comp.name}"`);
        }
        
        components.push({
          id,
          name,
          type: comp.type || 'generic',
          zone,
          description: comp.description || '',
          vendor: comp.vendor,
          version: comp.version,
          product: comp.product,
          technology: comp.technology,
          protocols: comp.protocols,
          securityControls: comp.securityControls,
          patchLevel: comp.patchLevel,
          lastUpdated: comp.lastUpdated,
          category: comp.category,
          dataClassification: comp.dataClassification,
          accessControl: comp.accessControl,
          vulnerabilities: comp.vulnerabilities,
          misconfigurations: comp.misconfigurations,
          securityGaps: comp.securityGaps,
        });
      });
    }
    
    // Process connections - map names to IDs
    if (jsonData.connections && Array.isArray(jsonData.connections)) {
      jsonData.connections.forEach((conn: any, index: number) => {
        // Map component names to IDs
        const fromId = nameToIdMap.get(conn.from) || conn.from;
        const toId = nameToIdMap.get(conn.to) || conn.to;
        
        // Only add connection if both components exist
        if (nameToIdMap.has(conn.from) && nameToIdMap.has(conn.to)) {
          connections.push({
            from: fromId,
            to: toId,
            label: conn.label || 'Connection',
            protocol: conn.protocol,
            encryption: conn.encryption,
            description: conn.description,
            portRange: conn.portRange,
            dataClassification: conn.dataClassification,
            securityControls: conn.securityControls,
            bandwidth: conn.bandwidth,
            latency: conn.latency,
            redundancy: conn.redundancy,
          });
        } else {
          console.warn(`[Local LLM] Skipping connection from "${conn.from}" to "${conn.to}" - component(s) not found`);
        }
      });
    }
    
    return {
      systemName: jsonData.systemName || 'System Architecture',
      description: jsonData.description || 'Generated system diagram',
      primaryZone: jsonData.primaryZone || 'Internal' as SecurityZone,
      dataClassification: jsonData.dataClassification || 'Internal' as DataClassification,
      components,
      connections,
      customContext: jsonData.customContext || ''
    };
  }

  /**
   * Parse Cypher response into AIGeneratedDiagram format
   */
  private parseCypherResponse(cypherText: string): AIGeneratedDiagram | null {
    const parseStartTime = Date.now();
    
    try {
      console.log('[Cypher] Starting to parse Cypher response, length:', cypherText.length);
      const components: SimplifiedComponent[] = [];
      const connections: SimplifiedConnection[] = [];
      let systemMetadata = {
        name: 'System Architecture',
        description: 'Generated system diagram',
        primaryZone: 'Internal' as SecurityZone,
        dataClassification: 'Internal' as const
      };
      
      // Clear any previous node variable mappings
      this.nodeVariableMap = undefined;

      // Split into lines and process each
      const lines = cypherText.split('\n')
        .map(line => line.trim())
        .map(line => {
          // Remove common bullet point patterns
          if (line.startsWith('• ')) return line.substring(2);
          if (line.startsWith('- ')) return line.substring(2);
          if (line.startsWith('* ')) return line.substring(2);
          return line;
        })
        .filter(line => line.length > 0 && !line.startsWith('//'));
      console.log('[Cypher] Processing', lines.length, 'lines');
      
      let nodesProcessed = 0;
      let connectionsProcessed = 0;
      let connectionLines = 0;
      
      // Process in chunks to avoid blocking
      const CHUNK_SIZE = 50; // Process 50 lines at a time

      for (const line of lines) {
        // Parse system metadata
        if (line.includes(':SystemMetadata')) {
          const metadataMatch = line.match(/\{([^}]+)\}/);
          if (metadataMatch) {
            const props = this.parsePropertiesString(metadataMatch[1]);
            systemMetadata = {
              name: props.name || systemMetadata.name,
              description: props.description || systemMetadata.description,
              primaryZone: (props.primaryZone as SecurityZone) || systemMetadata.primaryZone,
              dataClassification: (props.dataClassification as any) || systemMetadata.dataClassification
            };
          }
        }
        // Parse node creation - Updated to handle both :SecurityNode and specific types
        else if (line.startsWith('CREATE (') && !line.includes(':SystemMetadata')) {
          // Match format: CREATE (varName:nodeType {properties}) or CREATE (:nodeType {properties})
          const nodeMatch = line.match(/CREATE \((\w*):(\w+)\s*\{([^}]+)\}\)/);
          if (nodeMatch) {
            const [, varName, nodeType, propsStr] = nodeMatch;
            const props = this.parsePropertiesString(propsStr);
            
            if (props.id && props.zone) {
              const parseStringArray = (val: any): string[] | undefined => {
                if (Array.isArray(val)) return val;
                if (typeof val === 'string' && val.trim()) return val.split(',').map((s: string) => s.trim());
                return undefined;
              };

              const accessControl: any = {};
              if (props.accessControl_authentication || props['accessControl.authentication']) {
                accessControl.authentication = parseStringArray(props.accessControl_authentication || props['accessControl.authentication']);
              }
              if (props.accessControl_authorization || props['accessControl.authorization']) {
                accessControl.authorization = parseStringArray(props.accessControl_authorization || props['accessControl.authorization']);
              }

              components.push({
                id: props.id,
                name: props.label || props.id,
                type: props.type || nodeType.toLowerCase(),
                zone: props.zone as SecurityZone,
                description: props.description,
                vendor: props.vendor,
                version: props.version,
                product: props.product,
                technology: props.technology,
                protocols: parseStringArray(props.protocols),
                securityControls: parseStringArray(props.securityControls),
                patchLevel: props.patchLevel,
                lastUpdated: props.lastUpdated,
                category: props.category,
                dataClassification: props.dataClassification,
                accessControl: (accessControl.authentication || accessControl.authorization) ? accessControl : undefined,
                instanceCount: typeof props.instanceCount === 'number' ? props.instanceCount : (props.instanceCount ? parseInt(props.instanceCount) : undefined),
                vulnerabilities: parseStringArray(props.vulnerabilities),
                misconfigurations: parseStringArray(props.misconfigurations),
                securityGaps: parseStringArray(props.securityGaps)
              });
              
              // Store variable mapping if variable name exists
              if (varName) {
                if (!this.nodeVariableMap) {
                  this.nodeVariableMap = new Map<string, string>();
                }
                this.nodeVariableMap.set(varName, props.id);
              }
              
              nodesProcessed++;
              if (nodesProcessed % 20 === 0) {
                console.log(`[Cypher] Processed ${nodesProcessed} nodes...`);
              }
            } else {
              console.warn('[Cypher] Missing required props for node:', props);
            }
          } else {
            console.warn('[Cypher] Failed to match node line:', line.substring(0, 100) + '...');
          }
        }
        // Parse relationships - Handle variable name format
        else if (line.includes('MATCH') && line.includes('CREATE') && line.includes('->')) {
          connectionLines++;
          console.log('[Cypher] Processing connection line:', line);
          // First, create a map of variable names to IDs from previous CREATE statements
          if (!this.nodeVariableMap) {
            this.nodeVariableMap = new Map<string, string>();
            // Re-scan for variable mappings
            for (const prevLine of lines) {
              if (prevLine.startsWith('CREATE (') && !prevLine.includes(':SystemMetadata')) {
                // Match both single and double quotes for id values
                const varMatch = prevLine.match(/CREATE \((\w+):\w+\s*\{[^}]*id:['"]([^'"]+)['"][^}]*\}\)/);
                if (varMatch) {
                  this.nodeVariableMap.set(varMatch[1], varMatch[2]);
                  console.log('[Cypher] Mapped variable:', varMatch[1], 'to ID:', varMatch[2]);
                }
              }
            }
          }
          
          // Try multiple patterns for connection matching
          let relationMatch = null;
          let fromVar = '', toVar = '', propsStr = '';
          
          // Pattern 1: MATCH (varA), (varB) CREATE (varA)-[:CONNECTS {props}]->(varB)
          relationMatch = line.match(/MATCH\s*\((\w+)\),\s*\((\w+)\)\s*CREATE\s*\(\w+\)-\[:\w+\s*\{([^}]*)\}\]->\(\w+\)/);
          if (relationMatch) {
            [, fromVar, toVar, propsStr] = relationMatch;
          } else {
            // Pattern 2: CREATE (varA)-[:CONNECTS {props}]->(varB) without MATCH
            relationMatch = line.match(/CREATE\s*\((\w+)\)-\[:\w+\s*\{([^}]*)\}\]->\((\w+)\)/);
            if (relationMatch) {
              [, fromVar, propsStr, toVar] = relationMatch;
            } else {
              // Pattern 3: MATCH (varA), (varB) CREATE (varA)-[:CONNECTS]->(varB) (no props)
              relationMatch = line.match(/MATCH\s*\((\w+)\),\s*\((\w+)\)\s*CREATE\s*\(\w+\)-\[:\w+\]->\(\w+\)/);
              if (relationMatch) {
                [, fromVar, toVar] = relationMatch;
                propsStr = '';
              }
            }
          }
          
          if (relationMatch) {
            const fromId = this.nodeVariableMap.get(fromVar);
            const toId = this.nodeVariableMap.get(toVar);
            const props = propsStr ? this.parsePropertiesString(propsStr) : {};
            
            if (fromId && toId) {
              const parseConnStringArray = (val: any): string[] | undefined => {
                if (Array.isArray(val)) return val;
                if (typeof val === 'string' && val.trim()) return val.split(',').map((s: string) => s.trim());
                return undefined;
              };
              connections.push({
                from: fromId,
                to: toId,
                label: props.label || 'Connection',
                protocol: props.protocol || 'TCP',
                encryption: props.encryption || 'none',
                description: props.description,
                portRange: props.portRange,
                dataClassification: props.dataClassification,
                securityControls: parseConnStringArray(props.securityControls),
                bandwidth: props.bandwidth,
                latency: props.latency,
                redundancy: props.redundancy === 'true' || props.redundancy === true ? true : (props.redundancy === 'false' ? false : undefined)
              });
              console.log('[Cypher] Added connection:', fromId, '->', toId, 'label:', props.label);
              connectionsProcessed++;
            } else {
              console.warn('[Cypher] Could not resolve variables:', fromVar, '->', toVar);
              console.warn('[Cypher] Variable map contents:', Array.from(this.nodeVariableMap.entries()));
            }
          } else {
            console.warn('[Cypher] Failed to match relationship line:', line.substring(0, 100) + '...');
            // Try a direct ID pattern as fallback
            const directMatch = line.match(/CREATE.*['"]([^'"]+)['"].*->.*['"]([^'"]+)['"]/);
            if (directMatch) {
              const [, fromId, toId] = directMatch;
              connections.push({
                from: fromId,
                to: toId,
                label: 'Connection',
                protocol: 'TCP',
                encryption: 'none'
              });
              console.log('[Cypher] Added direct connection:', fromId, '->', toId);
              connectionsProcessed++;
            }
          }
        }
      }

      const parseEndTime = Date.now();
      console.log(`[Cypher] Parsing completed in ${parseEndTime - parseStartTime}ms`);
      console.log(`[Cypher] Summary: ${nodesProcessed} nodes, ${connectionsProcessed} connections from ${connectionLines} connection lines`);
      console.log(`[Cypher] Parsed ${components.length} components and ${connections.length} connections`);
      if (this.nodeVariableMap) {
        console.log('[Cypher] Node variable mappings:', Array.from(this.nodeVariableMap.entries()));
      }

      return {
        systemName: systemMetadata.name,
        description: systemMetadata.description,
        components,
        connections,
        primaryZone: systemMetadata.primaryZone,
        dataClassification: systemMetadata.dataClassification,
        customContext: 'Generated from Cypher response'
      };

    } catch (error) {
      console.error('Failed to parse Cypher response:', error);
      console.error(`[Cypher] Parsing failed after ${Date.now() - parseStartTime}ms`);
      return null;
    }
  }

  /**
   * Parse property string from Cypher format
   */
  private parsePropertiesString(propsStr: string): Record<string, any> {
    const props: Record<string, any> = {};
    
    // Clean up malformed foundation-sec patterns
    // Remove any ") CREATE (" patterns within property values
    let cleanedStr = propsStr.replace(/(['"]\s*[^'"]*)\)\s*CREATE\s*\([^'"]*(['"]\s*[,}])/g, '$1$2');
    
    // First, match array properties like vulnerabilities:["item1", "item2"]
    const arrayMatches = cleanedStr.match(/(\w+):\s*\[([^\]]*)\]/g);
    if (arrayMatches) {
      arrayMatches.forEach(match => {
        const arrayMatch = match.match(/(\w+):\s*\[([^\]]*)\]/);
        if (arrayMatch) {
          const [, key, arrayContent] = arrayMatch;
          // Parse array items
          const items = arrayContent.match(/['"]([^'"]*)['"]/g);
          if (items) {
            props[key] = items.map(item => item.replace(/['"]/g, ''));
          } else {
            props[key] = [];
          }
        }
      });
    }
    
    // Then match key:'value' or key:"value" patterns
    const stringMatches = cleanedStr.match(/(\w+):\s*['"]([^'"]*)['"]/g);
    if (stringMatches) {
      stringMatches.forEach(match => {
        const matchResult = match.match(/(\w+):\s*['"]([^'"]*)['"]/);
        if (matchResult) {
          const [, key, value] = matchResult;
          // Only add if not already parsed as array
          if (!props[key]) {
            // Clean up any remaining malformed patterns in the value
            const cleanedValue = value.replace(/\)\s*CREATE\s*\(/g, '');
            props[key] = cleanedValue;
          }
        }
      });
    }
    
    // Also match numeric values without quotes
    const numericMatches = cleanedStr.match(/(\w+):\s*(\d+)/g);
    if (numericMatches) {
      numericMatches.forEach(match => {
        const matchResult = match.match(/(\w+):\s*(\d+)/);
        if (matchResult) {
          const [, key, value] = matchResult;
          // Only add if not already parsed
          if (!props[key]) {
            props[key] = parseInt(value, 10);
          }
        }
      });
    }
    
    return props;
  }

  /**
   * Get active zones based on architectural pattern and create intelligent layouts
   */
  private getActiveZonesByPattern(componentsByZone: Map<SecurityZone, SimplifiedComponent[]>, pattern: ArchitecturalPattern): SecurityZone[] {
    // Get zones that actually have components
    const zonesWithComponents = Array.from(componentsByZone.keys());
    
    // Order zones according to pattern preferences
    const orderedZones = pattern.preferredZones.filter(zone => zonesWithComponents.includes(zone));
    const remainingZones = zonesWithComponents.filter(zone => !pattern.preferredZones.includes(zone));
    
    return [...orderedZones, ...remainingZones];
  }

  /**
   * Create zone layouts based on architectural pattern with dynamic sizing
   */
  private createZoneLayouts(activeZones: SecurityZone[], pattern: ArchitecturalPattern, componentsByZone?: Map<SecurityZone, SimplifiedComponent[]>): Array<{
    id: string;
    zoneType: SecurityZone;
    x: number;
    y: number;
    width: number;
    height: number;
    description: string;
  }> {
    const BASE_ZONE_WIDTH = 650;
    const BASE_ZONE_HEIGHT = 1000;
    const ZONE_SPACING = 120;
    const ZONE_START_Y = 50;
    const NODE_WIDTH = 150;
    const NODE_HEIGHT = 100;
    const GRID_SIZE = 50;
    const MIN_NODE_SPACING = 50; // 1 grid unit between nodes

    // Calculate dynamic zone dimensions based on component count
    const calculateZoneDimensions = (zone: SecurityZone): { width: number; height: number } => {
      if (!componentsByZone) return { width: BASE_ZONE_WIDTH, height: BASE_ZONE_HEIGHT };
      
      const components = componentsByZone.get(zone) || [];
      const componentCount = components.length;
      
      if (componentCount === 0) {
        return { width: BASE_ZONE_WIDTH, height: BASE_ZONE_HEIGHT };
      }

      // Calculate optimal grid layout with increased spacing
      // Start with fewer columns to accommodate larger spacing
      let cols = 2;
      let rows = Math.ceil(componentCount / cols);
      
      // If too many rows, increase columns
      if (rows > 5) {
        cols = 3;
        rows = Math.ceil(componentCount / cols);
      }
      if (rows > 6) {
        cols = 4;
        rows = Math.ceil(componentCount / cols);
      }
      if (rows > 8) {
        cols = 5;
        rows = Math.ceil(componentCount / cols);
      }
      
      // Increased spacing for better node separation
      const NODE_SPACING = 150; // Increased from 50 to 150 for better separation
      
      // Calculate dimensions based on grid
      // Width: (cols * node_width) + ((cols - 1) * spacing) + margins
      const contentWidth = (cols * NODE_WIDTH) + ((cols - 1) * NODE_SPACING);
      const marginX = 150; // Increased margins
      const calculatedWidth = contentWidth + marginX;
      
      // Height: (rows * node_height) + ((rows - 1) * spacing) + margins + tier buffer
      const contentHeight = (rows * NODE_HEIGHT) + ((rows - 1) * NODE_SPACING);
      const marginY = 300; // Increased margins
      const tierBuffer = 300; // Extra space for tier organization
      const calculatedHeight = contentHeight + marginY + tierBuffer;
      
      // Round to nearest 50px for grid alignment
      // Enforce minimum dimensions to ensure zones are always resizable and edit button is accessible
      const MIN_ZONE_WIDTH = 300; // Matches NodeResizer minWidth
      const MIN_ZONE_HEIGHT = 200; // Matches NodeResizer minHeight
      const finalWidth = Math.max(MIN_ZONE_WIDTH, BASE_ZONE_WIDTH, Math.ceil(calculatedWidth / GRID_SIZE) * GRID_SIZE);
      const finalHeight = Math.max(MIN_ZONE_HEIGHT, 800, Math.ceil(calculatedHeight / GRID_SIZE) * GRID_SIZE);
      
      return { width: finalWidth, height: finalHeight };
    };

    console.log(`[Layout] Creating ${pattern.zoneLayout} layout for zones: ${activeZones.join(', ')}`);

    // Calculate dimensions for all zones
    const zoneDimensions = new Map<SecurityZone, { width: number; height: number }>();
    activeZones.forEach(zone => {
      const dims = calculateZoneDimensions(zone);
      zoneDimensions.set(zone, dims);
      console.log(`[Layout] Zone ${zone}: ${dims.width}x${dims.height} (${componentsByZone?.get(zone)?.length || 0} components)`);
    });

    switch (pattern.zoneLayout) {
      case 'horizontal':
        return this.createHorizontalLayoutDynamic(activeZones, zoneDimensions, ZONE_SPACING, DiagramGenerationService.ZONE_START_X, ZONE_START_Y, pattern);
      
      case 'vertical':
        return this.createVerticalLayoutDynamic(activeZones, zoneDimensions, ZONE_SPACING, DiagramGenerationService.ZONE_START_X, ZONE_START_Y);
      
      case 'l-shape':
        return this.createLShapeLayoutDynamic(activeZones, zoneDimensions, ZONE_SPACING, DiagramGenerationService.ZONE_START_X, ZONE_START_Y);
      
      case 'hub-spoke':
        return this.createHubSpokeLayoutDynamic(activeZones, zoneDimensions, ZONE_SPACING, DiagramGenerationService.ZONE_START_X, ZONE_START_Y);
      
      case 'hybrid':
        return this.createHybridLayoutDynamic(activeZones, zoneDimensions, ZONE_SPACING, DiagramGenerationService.ZONE_START_X, ZONE_START_Y);
      
      default:
        return this.createHorizontalLayoutDynamic(activeZones, zoneDimensions, ZONE_SPACING, DiagramGenerationService.ZONE_START_X, ZONE_START_Y, pattern);
    }
  }

  /**
   * Create horizontal zone layout with dynamic dimensions and intelligent vertical positioning
   */
  private createHorizontalLayoutDynamic(
    activeZones: SecurityZone[], 
    zoneDimensions: Map<SecurityZone, { width: number; height: number }>, 
    spacing: number, 
    startX: number, 
    startY: number,
    architecturalPattern?: ArchitecturalPattern
  ): ZoneLayout {
    // Define vertical positions for different zone levels
    const VERTICAL_POSITIONS = {
      above: -1070,  // Above primary level
      primary: 0,    // Primary security flow (baseline)
      below: 1170    // Below primary level
    };
    
    // Group zones by their vertical classification
    const zonesByLevel = {
      above: [] as SecurityZone[],
      primary: [] as SecurityZone[],
      below: [] as SecurityZone[]
    };
    
    // Classify each zone
    activeZones.forEach(zone => {
      const level = this.classifyZoneByFunction(zone, architecturalPattern);
      zonesByLevel[level].push(zone);
      console.log(`[Layout] Zone ${zone} classified as: ${level}`);
    });
    
    const layouts: ZoneLayout = [];
    
    console.log(`[Layout] Zone distribution - Primary: ${zonesByLevel.primary.length}, Above: ${zonesByLevel.above.length}, Below: ${zonesByLevel.below.length}`);
    
    // Position primary zones horizontally with vertical staggering
    let currentX = startX;
    zonesByLevel.primary.forEach((zone, index) => {
      const dims = zoneDimensions.get(zone) || { width: 650, height: 1000 };
      // Create a staggered pattern: even indices normal, odd indices offset by 50% height
      const staggerOffset = index % 2 === 0 ? 0 : dims.height * 0.5;
      const finalY = startY + VERTICAL_POSITIONS.primary + staggerOffset;
      
      console.log(`[Layout] Zone ${zone} positioned at (${currentX}, ${finalY}) with ${dims.width}x${dims.height} (stagger: ${staggerOffset})`);
      
      layouts.push({
        id: `${zone.toLowerCase()}-zone`,
        zoneType: zone,
        x: currentX,
        y: finalY,
        width: dims.width,
        height: dims.height,
        description: `${zone} network zone`
      });
      currentX += dims.width + spacing;
    });
    
    // Position above zones - horizontally distributed above primary zones
    if (zonesByLevel.above.length > 0) {
      // Calculate total width of primary zones
      let primaryWidth = 0;
      zonesByLevel.primary.forEach(zone => {
        const dims = zoneDimensions.get(zone) || { width: 650, height: 1000 };
        primaryWidth += dims.width;
      });
      primaryWidth += (zonesByLevel.primary.length - 1) * spacing;
      
      // Position above zones
      let aboveX = startX;
      zonesByLevel.above.forEach((zone) => {
        const dims = zoneDimensions.get(zone) || { width: 650, height: 1000 };
        
        // Center above zones over primary zones if there's only one
        if (zonesByLevel.above.length === 1) {
          aboveX = startX + (primaryWidth - dims.width) / 2;
        }
        
        layouts.push({
          id: `${zone.toLowerCase()}-zone`,
          zoneType: zone,
          x: Math.max(startX, aboveX),
          y: startY + VERTICAL_POSITIONS.above,
          width: dims.width,
          height: dims.height,
          description: `${zone} network zone`
        });
        
        aboveX += dims.width + spacing;
      });
    }
    
    // Position below zones - horizontally distributed below primary zones
    if (zonesByLevel.below.length > 0) {
      // Calculate total width of primary zones
      let primaryWidth = 0;
      zonesByLevel.primary.forEach(zone => {
        const dims = zoneDimensions.get(zone) || { width: 650, height: 1000 };
        primaryWidth += dims.width;
      });
      primaryWidth += (zonesByLevel.primary.length - 1) * spacing;
      
      // Position below zones
      let belowX = startX;
      zonesByLevel.below.forEach((zone) => {
        const dims = zoneDimensions.get(zone) || { width: 650, height: 1000 };
        
        // Center below zones under primary zones if there's only one
        if (zonesByLevel.below.length === 1) {
          belowX = startX + (primaryWidth - dims.width) / 2;
        }
        
        layouts.push({
          id: `${zone.toLowerCase()}-zone`,
          zoneType: zone,
          x: Math.max(startX, belowX),
          y: startY + VERTICAL_POSITIONS.below,
          width: dims.width,
          height: dims.height,
          description: `${zone} network zone`
        });
        
        belowX += dims.width + spacing;
      });
    }
    
    return layouts;
  }

  /**
   * Create horizontal zone layout (traditional enterprise) - legacy method
   */
  private createHorizontalLayout(activeZones: SecurityZone[], width: number, height: number, spacing: number, startX: number, startY: number): ZoneLayout {
    return activeZones.map((zone, index) => ({
      id: `${zone.toLowerCase()}-zone`,
      zoneType: zone,
      x: startX + (index * (width + spacing)),
      y: startY,
      width,
      height,
      description: `${zone} network zone`
    }));
  }

  /**
   * Create vertical zone layout with dynamic dimensions
   */
  private createVerticalLayoutDynamic(activeZones: SecurityZone[], zoneDimensions: Map<SecurityZone, { width: number; height: number }>, spacing: number, startX: number, startY: number): ZoneLayout {
    const layouts: ZoneLayout = [];
    let currentY = startY;
    
    activeZones.forEach((zone) => {
      const dims = zoneDimensions.get(zone) || { width: 650, height: 1000 };
      layouts.push({
        id: `${zone.toLowerCase()}-zone`,
        zoneType: zone,
        x: startX,
        y: currentY,
        width: dims.width,
        height: dims.height,
        description: `${zone} network zone`
      });
      currentY += dims.height + spacing;
    });
    
    return layouts;
  }

  /**
   * Create vertical zone layout (industrial/OT systems) - legacy method
   */
  private createVerticalLayout(activeZones: SecurityZone[], width: number, height: number, spacing: number, startX: number, startY: number): ZoneLayout {
    return activeZones.map((zone, index) => ({
      id: `${zone.toLowerCase()}-zone`,
      zoneType: zone,
      x: startX,
      y: startY + (index * (height + spacing)),
      width,
      height,
      description: `${zone} network zone`
    }));
  }

  /**
   * Create L-shaped layout with dynamic dimensions
   */
  private createLShapeLayoutDynamic(activeZones: SecurityZone[], zoneDimensions: Map<SecurityZone, { width: number; height: number }>, spacing: number, startX: number, startY: number): ZoneLayout {
    const layouts: ZoneLayout = [];
    
    // Horizontal arm (main flow)
    const horizontalZones = activeZones.slice(0, Math.ceil(activeZones.length * 0.7));
    let currentX = startX;
    horizontalZones.forEach((zone) => {
      const dims = zoneDimensions.get(zone) || { width: 650, height: 1000 };
      layouts.push({
        id: `${zone.toLowerCase()}-zone`,
        zoneType: zone,
        x: currentX,
        y: startY,
        width: dims.width,
        height: dims.height,
        description: `${zone} network zone`
      });
      currentX += dims.width + spacing;
    });
    
    // Vertical arm (cloud/support)
    const verticalZones = activeZones.slice(horizontalZones.length);
    if (verticalZones.length > 0) {
      // Position vertical arm at the end of horizontal arm
      const lastHorizontalX = currentX - spacing - (zoneDimensions.get(horizontalZones[horizontalZones.length - 1]) || { width: 650 }).width;
      let currentY = startY;
      
      verticalZones.forEach((zone) => {
        const dims = zoneDimensions.get(zone) || { width: 650, height: 1000 };
        currentY -= (dims.height + spacing);
        layouts.push({
          id: `${zone.toLowerCase()}-zone`,
          zoneType: zone,
          x: lastHorizontalX,
          y: currentY,
          width: dims.width,
          height: dims.height,
          description: `${zone} network zone`
        });
      });
    }
    
    return layouts;
  }

  /**
   * Create L-shaped layout (DevOps pipeline) - legacy method
   */
  private createLShapeLayout(activeZones: SecurityZone[], width: number, height: number, spacing: number, startX: number, startY: number): ZoneLayout {
    const layouts: ZoneLayout = [];
    
    // Horizontal arm (main flow)
    const horizontalZones = activeZones.slice(0, Math.ceil(activeZones.length * 0.7));
    horizontalZones.forEach((zone, index) => {
      layouts.push({
        id: `${zone.toLowerCase()}-zone`,
        zoneType: zone,
        x: startX + (index * (width + spacing)),
        y: startY,
        width,
        height,
        description: `${zone} network zone`
      });
    });
    
    // Vertical arm (cloud/support)
    const verticalZones = activeZones.slice(horizontalZones.length);
    verticalZones.forEach((zone, index) => {
      layouts.push({
        id: `${zone.toLowerCase()}-zone`,
        zoneType: zone,
        x: startX + ((horizontalZones.length - 1) * (width + spacing)),
        y: startY - ((index + 1) * (height + spacing)),
        width,
        height,
        description: `${zone} network zone`
      });
    });
    
    return layouts;
  }

  /**
   * Create hub-spoke layout with dynamic dimensions
   */
  private createHubSpokeLayoutDynamic(activeZones: SecurityZone[], zoneDimensions: Map<SecurityZone, { width: number; height: number }>, spacing: number, startX: number, startY: number): ZoneLayout {
    const layouts: ZoneLayout = [];
    
    if (activeZones.length === 0) return layouts;
    
    // Central hub (most important zone)
    const hubZone = activeZones[0];
    const hubDims = zoneDimensions.get(hubZone) || { width: 650, height: 1000 };
    const centerX = startX + hubDims.width + spacing;
    const centerY = startY;
    
    layouts.push({
      id: `${hubZone.toLowerCase()}-zone`,
      zoneType: hubZone,
      x: centerX,
      y: centerY,
      width: hubDims.width,
      height: hubDims.height,
      description: `${hubZone} network zone (hub)`
    });
    
    // Spokes around the hub
    const spokeZones = activeZones.slice(1);
    const positions = [
      { x: centerX - (hubDims.width + spacing), y: centerY }, // Left
      { x: centerX + (hubDims.width + spacing), y: centerY }, // Right
      { x: centerX, y: centerY - (hubDims.height + spacing) }, // Top
      { x: centerX, y: centerY + (hubDims.height + spacing) }, // Bottom
      { x: centerX - (hubDims.width + spacing), y: centerY - (hubDims.height + spacing) }, // Top-left
      { x: centerX + (hubDims.width + spacing), y: centerY - (hubDims.height + spacing) }, // Top-right
    ];
    
    spokeZones.forEach((zone, index) => {
      const dims = zoneDimensions.get(zone) || { width: 650, height: 1000 };
      const pos = positions[index % positions.length];
      layouts.push({
        id: `${zone.toLowerCase()}-zone`,
        zoneType: zone,
        x: pos.x,
        y: pos.y,
        width: dims.width,
        height: dims.height,
        description: `${zone} network zone`
      });
    });
    
    return layouts;
  }

  /**
   * Create hub-spoke layout (zero trust/security operations) - legacy method
   */
  private createHubSpokeLayout(activeZones: SecurityZone[], width: number, height: number, spacing: number, startX: number, startY: number): ZoneLayout {
    const layouts: ZoneLayout = [];
    
    if (activeZones.length === 0) return layouts;
    
    // Central hub (most important zone)
    const hubZone = activeZones[0];
    const centerX = startX + width + spacing;
    const centerY = startY;
    
    layouts.push({
      id: `${hubZone.toLowerCase()}-zone`,
      zoneType: hubZone,
      x: centerX,
      y: centerY,
      width,
      height,
      description: `${hubZone} network zone (hub)`
    });
    
    // Spokes around the hub
    const spokeZones = activeZones.slice(1);
    const positions = [
      { x: centerX - (width + spacing), y: centerY }, // Left
      { x: centerX + (width + spacing), y: centerY }, // Right
      { x: centerX, y: centerY - (height + spacing) }, // Top
      { x: centerX, y: centerY + (height + spacing) }, // Bottom
      { x: centerX - (width + spacing), y: centerY - (height + spacing) }, // Top-left
      { x: centerX + (width + spacing), y: centerY - (height + spacing) }, // Top-right
    ];
    
    spokeZones.forEach((zone, index) => {
      const pos = positions[index % positions.length];
      layouts.push({
        id: `${zone.toLowerCase()}-zone`,
        zoneType: zone,
        x: pos.x,
        y: pos.y,
        width,
        height,
        description: `${zone} network zone`
      });
    });
    
    return layouts;
  }

  /**
   * Create hybrid layout with dynamic dimensions
   */
  private createHybridLayoutDynamic(activeZones: SecurityZone[], zoneDimensions: Map<SecurityZone, { width: number; height: number }>, spacing: number, startX: number, startY: number): ZoneLayout {
    const layouts: ZoneLayout = [];
    
    // Separate cloud and on-premises zones
    const cloudZones = activeZones.filter(zone => zone === 'Cloud' || zone.includes('Cloud'));
    const onPremZones = activeZones.filter(zone => !cloudZones.includes(zone));
    
    // On-premises zones (horizontal, bottom)
    let currentX = startX;
    onPremZones.forEach((zone) => {
      const dims = zoneDimensions.get(zone) || { width: 650, height: 1000 };
      layouts.push({
        id: `${zone.toLowerCase()}-zone`,
        zoneType: zone,
        x: currentX,
        y: startY,
        width: dims.width,
        height: dims.height,
        description: `${zone} network zone`
      });
      currentX += dims.width + spacing;
    });
    
    // Cloud zones (horizontal, top) - positioned above on-prem zones
    let cloudY = startY;
    if (onPremZones.length > 0) {
      // Find max height of on-prem zones
      const maxOnPremHeight = Math.max(...onPremZones.map(z => zoneDimensions.get(z)?.height || 1000));
      cloudY = startY - maxOnPremHeight - spacing;
    }
    
    let cloudX = startX;
    cloudZones.forEach((zone) => {
      const dims = zoneDimensions.get(zone) || { width: 650, height: 1000 };
      layouts.push({
        id: `${zone.toLowerCase()}-zone`,
        zoneType: zone,
        x: cloudX,
        y: cloudY,
        width: dims.width,
        height: dims.height,
        description: `${zone} network zone (cloud)`
      });
      cloudX += dims.width + spacing;
    });
    
    return layouts;
  }

  /**
   * Create hybrid layout (cloud + on-premises) - legacy method
   */
  private createHybridLayout(activeZones: SecurityZone[], width: number, height: number, spacing: number, startX: number, startY: number): ZoneLayout {
    const layouts: ZoneLayout = [];
    
    // Separate cloud and on-premises zones
    const cloudZones = activeZones.filter(zone => zone === 'Cloud' || zone.includes('Cloud'));
    const onPremZones = activeZones.filter(zone => !cloudZones.includes(zone));
    
    // On-premises zones (horizontal, bottom)
    onPremZones.forEach((zone, index) => {
      layouts.push({
        id: `${zone.toLowerCase()}-zone`,
        zoneType: zone,
        x: startX + (index * (width + spacing)),
        y: startY,
        width,
        height,
        description: `${zone} network zone`
      });
    });
    
    // Cloud zones (horizontal, top)
    cloudZones.forEach((zone, index) => {
      layouts.push({
        id: `${zone.toLowerCase()}-zone`,
        zoneType: zone,
        x: startX + (index * (width + spacing)),
        y: startY - (height + spacing),
        width,
        height,
        description: `${zone} network zone (cloud)`
      });
    });
    
    return layouts;
  }

  /**
   * Validate that a position has adequate spacing around it
   */
  private validateSpacing(
    occupiedCells: Set<string>, 
    col: number, 
    row: number, 
    horizontalSpacing: number, 
    verticalSpacing: number
  ): boolean {
    // Check horizontal spacing
    for (let c = Math.max(0, col - horizontalSpacing); c <= col + DiagramGenerationService.NODE_GRID_WIDTH + horizontalSpacing; c++) {
      for (let r = Math.max(0, row - verticalSpacing); r <= row + DiagramGenerationService.NODE_GRID_HEIGHT + verticalSpacing; r++) {
        if (occupiedCells.has(`${c},${r}`)) {
          return false;
        }
      }
    }
    return true;
  }
  
  /**
   * Guess component type from name with intelligent mapping
   */
  private guessComponentType(name: string): string {
    const lowerName = name.toLowerCase();
    
    // Database types
    if (lowerName.includes('database') || lowerName.includes('db') || 
        lowerName.includes('mysql') || lowerName.includes('postgres') || 
        lowerName.includes('oracle') || lowerName.includes('sql')) {
      return 'database';
    }
    
    // Web server types
    if (lowerName.includes('web server') || lowerName.includes('apache') || 
        lowerName.includes('nginx') || lowerName.includes('iis') || 
        lowerName.includes('httpd')) {
      return 'webServer';
    }
    
    // Application server types
    if (lowerName.includes('application') || lowerName.includes('app server') ||
        lowerName.includes('tomcat') || lowerName.includes('jboss') ||
        lowerName.includes('spring')) {
      return 'application';
    }
    
    // Network infrastructure
    if (lowerName.includes('firewall')) return 'firewall';
    if (lowerName.includes('router')) return 'router';
    if (lowerName.includes('switch')) return 'switch';
    if (lowerName.includes('load balancer') || lowerName.includes('haproxy') || 
        lowerName.includes('f5')) return 'loadBalancer';
    if (lowerName.includes('waf')) return 'waf';
    if (lowerName.includes('ids') || lowerName.includes('intrusion')) return 'ids';
    if (lowerName.includes('vpn')) return 'vpnGateway';
    if (lowerName.includes('proxy')) return 'proxy';
    if (lowerName.includes('dns')) return 'dns';
    
    // API and services
    if (lowerName.includes('api gateway') || lowerName.includes('kong')) return 'apiGateway';
    if (lowerName.includes('api')) return 'api';
    if (lowerName.includes('gateway')) return 'gateway';
    if (lowerName.includes('service')) return 'service';
    
    // Storage and backup - map to appropriate types
    if (lowerName.includes('backup') || lowerName.includes('veeam') || 
        lowerName.includes('storage') || lowerName.includes('nas') || 
        lowerName.includes('san')) {
      return 'storage';
    }
    
    // Monitoring and logging
    if (lowerName.includes('monitor') || lowerName.includes('prometheus') || 
        lowerName.includes('grafana') || lowerName.includes('nagios')) {
      return 'monitor';
    }
    if (lowerName.includes('log') || lowerName.includes('elastic') || 
        lowerName.includes('splunk') || lowerName.includes('elk')) {
      return 'logging';
    }
    
    // Auth and identity
    if (lowerName.includes('auth') || lowerName.includes('keycloak') || 
        lowerName.includes('okta') || lowerName.includes('ldap')) {
      return 'authServer';
    }
    if (lowerName.includes('identity') || lowerName.includes('iam')) return 'identity';
    
    // Messaging
    if (lowerName.includes('kafka') || lowerName.includes('rabbitmq') || 
        lowerName.includes('message') || lowerName.includes('queue')) {
      return 'messageBroker';
    }
    
    // Cache
    if (lowerName.includes('redis') || lowerName.includes('memcache') || 
        lowerName.includes('cache')) {
      return 'cache';
    }
    
    // Server types - generic server mapping
    if (lowerName.includes('server')) return 'server';
    
    // Workstation/endpoint
    if (lowerName.includes('workstation') || lowerName.includes('desktop') || 
        lowerName.includes('laptop') || lowerName.includes('endpoint')) {
      return 'workstation';
    }
    
    // Default fallback
    return 'generic';
  }
  
  /**
   * Guess component zone from name/type - but this is just a fallback
   * The AI should determine zones based on the user's description
   */
  private guessComponentZone(name: string): SecurityZone {
    // This is only used as a last resort fallback when AI fails completely
    // The AI should place components based on what the user described,
    // not based on security best practices
    return 'Internal'; // Default fallback
  }

  // determineSecurityLevel method removed - SecurityLevel no longer part of the data model

  /**
   * Determine primary zone based on components
   */
  private determinePrimaryZone(zones: Set<string>, components: SimplifiedComponent[]): SecurityZone {
    // Count components per zone
    const zoneCounts = new Map<string, number>();
    
    for (const comp of components) {
      const count = zoneCounts.get(comp.zone) || 0;
      zoneCounts.set(comp.zone, count + 1);
    }
    
    // Find zone with most components
    let maxCount = 0;
    let primaryZone: SecurityZone = 'Internal';
    
    zoneCounts.forEach((count, zone) => {
      if (count > maxCount) {
        maxCount = count;
        primaryZone = zone as SecurityZone;
      }
    });
    
    return primaryZone;
  }

  /**
   * Determine data classification based on zones
   */
  private determineDataClassification(zones: Set<string>): DataClassification {
    if (zones.has('Compliance') || zones.has('Restricted') || zones.has('Critical')) {
      return 'Confidential';
    }
    if (zones.has('Production') || zones.has('Internal')) {
      return 'Sensitive';
    }
    if (zones.has('DMZ')) {
      return 'Internal';
    }
    return 'Public';
  }

  /**
   * Map invalid component type to a valid one intelligently
   */
  private mapToValidType(invalidType: string): string {
    const type = invalidType.toLowerCase();
    
    // Skip DFD node types - they're for manual threat modeling only
    if (type.startsWith('dfd')) {
      console.warn(`DFD node type "${invalidType}" detected in AI generation - converting to appropriate non-DFD type`);
      // Map DFD types to their closest non-DFD equivalents
      if (type === 'dfdactor') return 'user';
      if (type === 'dfdprocess') return 'application';
      if (type === 'dfddatastore') return 'database';
      if (type === 'dfdtrustboundary') return 'firewall';
      return 'generic';
    }
    
    // Direct mapping for common variations
    const typeMapping: Record<string, string> = {
      // Category names that AI might use - map intelligently
      'infrastructure': 'server',
      'cloud': 'cloudService',
      'ot': 'plc',
      'ai': 'aiModel',
      'network': 'switch',
      'networking': 'switch',
      
      // Server variations
      'backupserver': 'server',
      'backup-server': 'server',
      'backup_server': 'server',
      'fileserver': 'server',
      'file-server': 'server',
      'mailserver': 'server',
      'printserver': 'server',
      'proxyserver': 'proxy',
      'dnsserver': 'dns',
      'dhcpserver': 'server',
      'ftpserver': 'server',
      'sftpserver': 'server',
      'ntpserver': 'server',
      'radiusserver': 'authServer',
      'ldapserver': 'authServer',
      'adserver': 'authServer',
      'domaincontroller': 'authServer',
      
      // Database variations  
      'databaseserver': 'database',
      'database-server': 'database',
      'dbserver': 'database',
      'db-server': 'database',
      'datawarehouse': 'database',
      'datalake': 'dataLake',
      
      // Monitoring variations
      'monitoringsystem': 'monitor',
      'monitoring-system': 'monitor',
      'monitoringserver': 'monitor',
      'loggingsystem': 'logging',
      'logging-system': 'logging',
      'loggingserver': 'logging',
      'logserver': 'logging',
      'syslogserver': 'logging',
      'siemserver': 'logging',
      'siem': 'logging',
      
      // Security variations
      'securityappliance': 'firewall',
      'ips': 'ids',
      'intrusiondetection': 'ids',
      'intrusionprevention': 'ids',
      'utm': 'firewall',
      'ngfw': 'firewall',
      'webapplicationfirewall': 'waf',
      
      // Load balancer variations
      'lb': 'loadBalancer',
      'loadbalancer': 'loadBalancer',
      'load-balancer': 'loadBalancer',
      'applicationdeliverycontroller': 'loadBalancer',
      'adc': 'loadBalancer',
      
      // API variations
      'apiserver': 'api',
      'api-server': 'api',
      'restapi': 'api',
      'graphqlserver': 'api',
      
      // Application variations
      'appserver': 'application',
      'app-server': 'application',
      'applicationserver': 'application',
      'microservice': 'service',
      'webservice': 'service',
      'restservice': 'service',
      
      // Storage variations
      'storageserver': 'storage',
      'storage-server': 'storage',
      'backupstorage': 'storage',
      'nas': 'storage',
      'san': 'storage',
      'objectstorage': 'storage',
      
      // Messaging variations
      'messagequeue': 'messageBroker',
      'message-queue': 'messageBroker',
      'eventbus': 'messageBroker',
      'event-bus': 'messageBroker',
      'pubsub': 'messageBroker',
      
      // Cache variations
      'cacheserver': 'cache',
      'cache-server': 'cache',
      'memorycache': 'cache',
      'distributedcache': 'cache',
      
      // Vault variations
      'secretsmanager': 'vault',
      'secrets-manager': 'vault',
      'keymanagement': 'vault',
      'hsm': 'vault',
      
      // Generic mappings
      'component': 'generic',
      'system': 'generic',
      'node': 'generic',
      'unknown': 'generic'
    };
    
    // Check direct mapping first
    if (typeMapping[type]) {
      return typeMapping[type];
    }
    
    // If no direct mapping, use intelligent guessing
    return this.guessComponentType(invalidType);
  }

  /**
   * Validate simplified diagram structure
   */
  private validateSimplifiedDiagram(diagram: AIGeneratedDiagram, generationType?: DiagramGenerationType): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields
    if (!diagram.systemName) errors.push('System name is required');
    if (!diagram.description) errors.push('System description is required');
    if (!diagram.components || diagram.components.length === 0) errors.push('At least one component is required');

    // Validate components
    const nodeTypes = this.getAvailableNodeTypes(generationType);
    const allValidTypes = nodeTypes.all;
    
    diagram.components?.forEach((comp, index) => {
      if (!comp.id) errors.push(`Component ${index} missing ID`);
      if (!comp.type) errors.push(`Component ${index} missing type`);
      if (!comp.name) errors.push(`Component ${index} missing name`);
      if (!comp.zone) errors.push(`Component ${index} missing zone assignment`);

      // Validate and fix component type
      if (comp.type && !allValidTypes.includes(comp.type)) {
        const mappedType = this.mapToValidType(comp.type);
        warnings.push(`Component ${comp.id} has invalid type "${comp.type}". Mapped to "${mappedType}".`);
        comp.type = mappedType; // Fix the type in place
      }
    });

    // Validate connections
    if (!diagram.connections || diagram.connections.length === 0) {
      warnings.push('No connections generated - will create default connections');
      // Don't treat as error, we can generate fallback connections
    } else if (diagram.connections.length < 2) {
      warnings.push(`Only ${diagram.connections.length} connection(s) generated - will add more`);
    }
    
    // Filter out invalid connections and validate remaining ones
    const validConnections: SimplifiedConnection[] = [];
    diagram.connections?.forEach((conn, index) => {
      if (!conn.from || !conn.to) {
        warnings.push(`Connection ${index} missing source or target - skipping`);
        return;
      }

      // Check if source and target components exist
      const sourceExists = diagram.components?.some(c => c.id === conn.from);
      const targetExists = diagram.components?.some(c => c.id === conn.to);
      
      if (!sourceExists) {
        warnings.push(`Connection ${index} references non-existent source component: ${conn.from} - skipping`);
        return;
      }
      if (!targetExists) {
        warnings.push(`Connection ${index} references non-existent target component: ${conn.to} - skipping`);
        return;
      }
      
      // Connection is valid, add it
      validConnections.push(conn);
    });
    
    // Replace connections with only valid ones
    diagram.connections = validConnections;

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Merge a newly generated diagram with an existing one
   * Positions new nodes to the right of existing content
   */
  public mergeWithExistingDiagram(existingDiagram: ExampleSystem, newDiagram: ExampleSystem): ExampleSystem {
    // Calculate the rightmost position of existing nodes
    let maxX = 0;
    if (existingDiagram.nodes.length > 0) {
      maxX = Math.max(...existingDiagram.nodes.map((node: SecurityNode) => {
        const width = node.style?.width || 200;
        return node.position.x + (typeof width === 'number' ? width : parseInt(String(width)) || 200);
      }));
    }
    
    // Add spacing between existing and new content
    const spacingBetweenDiagrams = 200;
    const offsetX = maxX + spacingBetweenDiagrams;
    
    // Create ID mappings to avoid conflicts
    const nodeIdMap = new Map<string, string>();
    const existingNodeIds = new Set(existingDiagram.nodes.map((n: SecurityNode) => n.id));
    
    // Process new nodes with offset and new IDs
    const mergedNodes = [...existingDiagram.nodes];
    const newNodes = newDiagram.nodes.map((node: SecurityNode, index: number) => {
      let newId = node.id;
      let counter = 1;
      
      // Ensure unique ID
      while (existingNodeIds.has(newId)) {
        newId = `${node.id}-${counter}`;
        counter++;
      }
      
      nodeIdMap.set(node.id, newId);
      existingNodeIds.add(newId);
      
      return {
        ...node,
        id: newId,
        position: {
          x: node.position.x + offsetX,
          y: node.position.y
        }
      };
    });
    
    mergedNodes.push(...newNodes);
    
    // Process edges with updated node IDs
    const mergedEdges = [...existingDiagram.edges];
    const newEdges = newDiagram.edges.map((edge: SecurityEdge) => ({
      ...edge,
      id: `${nodeIdMap.get(edge.source) || edge.source}-${nodeIdMap.get(edge.target) || edge.target}`,
      source: nodeIdMap.get(edge.source) || edge.source,
      target: nodeIdMap.get(edge.target) || edge.target
    }));
    
    mergedEdges.push(...newEdges);
    
    // Merge custom context
    const mergedCustomContext = existingDiagram.customContext || '';
    const newCustomContext = newDiagram.customContext || '';
    const combinedContext = mergedCustomContext + 
      (mergedCustomContext && newCustomContext ? '\n\n' : '') + 
      newCustomContext;
    
    return {
      ...existingDiagram,
      nodes: mergedNodes,
      edges: mergedEdges,
      customContext: combinedContext
    };
  }

  /**
   * Generate intelligent layout for components using enhanced grid system and architectural patterns
   */
  private generateLayout(diagram: AIGeneratedDiagram, generationType?: DiagramGenerationType) {
    // Enhanced grid system configuration following SystemGeneratorGuidelines.md
    const GRID_SIZE = 50; // Base grid unit (50px)
    const GRID_COLUMNS_PER_ZONE = 12; // 650px zone / 50px = 13 units (12 usable)
    // Grid constants are now defined at class level
    
    // Improved spacing following guidelines
    const MIN_HORIZONTAL_SPACING = 4; // 200px minimum (4 grid units)
    const MIN_VERTICAL_SPACING = 3; // 150px minimum (3 grid units)
    const HIGH_CONNECTION_SPACING = 5; // 250px for nodes with 3+ connections
    
    // Dynamic tier calculation based on zone height
    const calculateTierRows = (zoneHeight: number) => {
      const totalRows = Math.floor((zoneHeight - 100) / GRID_SIZE); // Leave margins
      const rowsPerTier = Math.floor(totalRows / 4); // 4 tiers
      
      return {
        infrastructure: { start: 2, end: 2 + rowsPerTier - 1 },
        application: { start: 2 + rowsPerTier, end: 2 + (2 * rowsPerTier) - 1 },
        data: { start: 2 + (2 * rowsPerTier), end: 2 + (3 * rowsPerTier) - 1 },
        support: { start: 2 + (3 * rowsPerTier), end: totalRows - 2 }
      };
    };
    
    // Helper function to convert grid coordinates to pixel positions
    const gridToPixel = (gridCol: number, gridRow: number, zoneX: number, zoneY: number) => {
      return {
        x: zoneX + (gridCol * GRID_SIZE) + 10,
        y: zoneY + (gridRow * GRID_SIZE) - 5
      };
    };
    
    // Helper function to check if grid cells are occupied
    const isGridCellOccupied = (
      occupiedCells: Set<string>, 
      col: number, 
      row: number, 
      width: number = DiagramGenerationService.NODE_GRID_WIDTH, 
      height: number = DiagramGenerationService.NODE_GRID_HEIGHT,
      maxCols: number = GRID_COLUMNS_PER_ZONE,
      maxRows: number = 18 // Default based on 1000px height
    ): boolean => {
      for (let c = col; c < col + width; c++) {
        for (let r = row; r < row + height; r++) {
          // If any part of the node would be out of bounds, consider it occupied
          if (c < 0 || c >= maxCols || r < 0 || r >= maxRows) {
            return true;
          }
          if (occupiedCells.has(`${c},${r}`)) {
            return true;
          }
        }
      }
      return false;
    };
    
    // Helper function to mark grid cells as occupied
    const markGridCellsOccupied = (
      occupiedCells: Set<string>, 
      col: number, 
      row: number, 
      width: number = DiagramGenerationService.NODE_GRID_WIDTH, 
      height: number = DiagramGenerationService.NODE_GRID_HEIGHT,
      maxCols: number = GRID_COLUMNS_PER_ZONE,
      maxRows: number = 18 // Default based on 1000px height
    ) => {
      for (let c = col; c < col + width; c++) {
        for (let r = row; r < row + height; r++) {
          // Only mark cells that are within the valid grid bounds
          if (c >= 0 && c < maxCols && r >= 0 && r < maxRows) {
            occupiedCells.add(`${c},${r}`);
          }
        }
      }
    };
    
    if (!diagram.components?.length) throw new Error('The model returned no components to lay out.');

    console.log(`[DiagramGeneration] Generating grid-based layout for ${diagram.components.length} components`);
    diagram.components.forEach((comp, idx) => {
      console.log(`  Component ${idx}: ${comp.id} (type: ${comp.type}, zone: ${comp.zone})`);
    });
    
    // Group components by zone
    const componentsByZone = new Map<SecurityZone, SimplifiedComponent[]>();
    diagram.components.forEach(comp => {
      // Fix zone names that have " Zone" suffix
      let zone = comp.zone || 'Internal' as SecurityZone;
      
      // Remove " Zone" suffix if present
      if (typeof zone === 'string' && zone.endsWith(' Zone')) {
        zone = zone.replace(' Zone', '') as SecurityZone;
        console.log(`[DiagramGeneration] Fixed zone name: "${comp.zone}" -> "${zone}"`);
      }
      
      // Ensure zone is valid
      const validZones = this.getAvailableZones();
      if (!validZones.includes(zone as SecurityZone)) {
        console.warn(`[DiagramGeneration] Invalid zone "${zone}" for component ${comp.id}, defaulting to Internal`);
        zone = 'Internal' as SecurityZone;
      }
      
      // Update component zone
      comp.zone = zone;
      
      if (!componentsByZone.has(zone)) {
        componentsByZone.set(zone, []);
      }
      componentsByZone.get(zone)!.push(comp);
    });
    
    console.log(`[DiagramGeneration] Components by zone:`);
    componentsByZone.forEach((comps, zone) => {
      console.log(`  ${zone}: ${comps.length} components`);
    });

    // Detect architectural pattern for intelligent zone layout
    const architecturalPattern = this.detectArchitecturalPattern(diagram.customContext || '');
    console.log(`[Layout] Using ${architecturalPattern.name} pattern with ${architecturalPattern.zoneLayout} layout`);
    
    // Get active zones based on architectural pattern
    const activeZones = this.getActiveZonesByPattern(componentsByZone, architecturalPattern);
    
    // If no zones found, use a default
    if (activeZones.length === 0) {
      console.warn('[DiagramGeneration] No valid zones found, using Internal as default');
      activeZones.push('Internal');
    }
    
    console.log(`[DiagramGeneration] Active zones: ${activeZones.join(', ')}`);

    // Create intelligent zone layouts based on architectural pattern with dynamic sizing
    const zoneLayouts = this.createZoneLayouts(activeZones, architecturalPattern, componentsByZone);

    // Position components within zones using grid system
    const nodePlacements: any[] = [];
    const componentPositions = new Map<string, { x: number, y: number }>();
    const globalUnplacedComponents: SimplifiedComponent[] = [];

    // Validate and fix node type helper
    const nodeTypes = this.getAvailableNodeTypes(generationType);
    
    // Helper to create node data with all properties including instanceCount
    const createNodeData = (comp: SimplifiedComponent, overrides: any = {}) => ({
      label: comp.name || comp.id || 'Component',
      description: comp.description || '',
      zone: comp.zone || 'Internal' as SecurityZone,
      dataClassification: comp.dataClassification || diagram.dataClassification || 'Internal',
      vendor: comp.vendor,
      product: comp.product,
      version: comp.version,
      technology: comp.technology,
      protocols: comp.protocols,
      securityControls: comp.securityControls,
      patchLevel: comp.patchLevel,
      lastUpdated: comp.lastUpdated,
      category: comp.category,
      accessControl: comp.accessControl,
      instanceCount: comp.instanceCount,
      vulnerabilities: comp.vulnerabilities,
      misconfigurations: comp.misconfigurations,
      securityGaps: comp.securityGaps,
      ...overrides
    });

    activeZones.forEach((zone) => {
      const zoneComponents = componentsByZone.get(zone) || [];
      
      // Find the zone layout info
      const zoneLayout = zoneLayouts.find(zl => zl.zoneType === zone);
      if (!zoneLayout) {
        console.error(`[Grid] No zone layout found for zone ${zone}`);
        return;
      }
      
      const zoneX = zoneLayout.x;
      const zoneY = zoneLayout.y;
      const zoneHeight = zoneLayout.height;
      const zoneWidth = zoneLayout.width;
      
      // Calculate actual grid dimensions for this zone
      const maxRows = Math.floor((zoneHeight - 100) / GRID_SIZE);
      const maxCols = Math.floor(zoneWidth / GRID_SIZE);
      
      // Calculate tier rows based on actual zone height
      const TIER_ROWS = calculateTierRows(zoneHeight);
      
      // Track occupied grid cells for this zone
      const occupiedCells = new Set<string>();
      
      console.log(`[Grid] Zone ${zone} dimensions: ${maxCols}x${maxRows} cells (${maxCols * maxRows} total), can fit ~${Math.floor(maxCols / DiagramGenerationService.NODE_GRID_WIDTH) * Math.floor(maxRows / DiagramGenerationService.NODE_GRID_HEIGHT)} nodes`);
      
      // Group components by type for tier-based placement
      const groups = {
        infrastructure: zoneComponents.filter(c => 
          ['router', 'switch', 'firewall', 'gateway', 'proxy', 'vpnGateway', 'ids', 'waf', 'dns', 'monitor'].includes(c.type)
        ),
        application: zoneComponents.filter(c => 
          ['application', 'webServer', 'api', 'service', 'authServer', 'messageBroker', 'apiGateway', 'reverseProxy', 'loadBalancer'].includes(c.type)
        ),
        data: zoneComponents.filter(c => 
          ['database', 'cache', 'storage', 'vault', 'logging'].includes(c.type)
        ),
        other: zoneComponents.filter(c => 
          !['router', 'switch', 'firewall', 'gateway', 'proxy', 'vpnGateway', 'ids', 'waf', 'dns', 'monitor',
            'application', 'webServer', 'api', 'service', 'authServer', 'messageBroker', 'apiGateway', 'reverseProxy', 'loadBalancer',
            'database', 'cache', 'storage', 'vault', 'logging'].includes(c.type)
        )
      };

      // Analyze component connections for better positioning
      const getComponentConnectionCount = (compId: string): number => {
        return diagram.connections.filter(conn => 
          conn.from === compId || conn.to === compId
        ).length;
      };

      const getConnectedComponents = (compId: string): string[] => {
        return diagram.connections
          .filter(conn => conn.from === compId || conn.to === compId)
          .map(conn => conn.from === compId ? conn.to : conn.from);
      };

      // Calculate center-to-center distance between two positions
      const calculateDistance = (pos1: { x: number, y: number }, pos2: { x: number, y: number }): number => {
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        return Math.sqrt(dx * dx + dy * dy);
      };

      // Check if a position maintains minimum distance from all placed nodes
      const checkMinimumDistance = (gridCol: number, gridRow: number, minDistance: number): boolean => {
        const testPos = gridToPixel(gridCol, gridRow, zoneX, zoneY);
        // Add half node dimensions to get center point
        const testCenter = {
          x: testPos.x + 75, // NODE_WIDTH / 2
          y: testPos.y + 50  // NODE_HEIGHT / 2
        };
        
        // Check against all placed components in the same zone
        const entries = Array.from(componentPositions.entries());
        for (const [compId, pos] of entries) {
          const compCenter = {
            x: pos.x + 75,
            y: pos.y + 50
          };
          
          const distance = calculateDistance(testCenter, compCenter);
          if (distance < minDistance) {
            return false;
          }
        }
        
        return true;
      };

      // Helper function to find optimal grid position with improved spacing
      const findOptimalGridPosition = (
        component: SimplifiedComponent,
        tierRows: { start: number, end: number }
      ): { col: number, row: number } | null => {
        const connectionCount = getComponentConnectionCount(component.id);
        const connectedComps = getConnectedComponents(component.id);
        
        // Determine minimum center-to-center distance based on connection density
        // For nodes with many connections, we need more space
        const MIN_CENTER_DISTANCE = connectionCount >= 3 ? 450 : 400; // In pixels - increased for much better spacing
        
        // More flexible column ordering with better utilization
        let columnOrder: number[];
        if (connectionCount >= 3) {
          // Center-outward for high-connection nodes
          columnOrder = [5, 6, 4, 7, 3, 8, 2, 9, 1, 10, 0, 11];
        } else {
          // Distributed positioning for better space usage
          columnOrder = [1, 6, 3, 8, 0, 5, 7, 2, 9, 4, 10, 11];
        }
        
        // Try to position near connected components if they're already placed
        const placedConnectedComps = connectedComps.filter(compId => 
          componentPositions.has(compId)
        );
        
        if (placedConnectedComps.length > 0) {
          // Calculate average position of connected components
          const positions = placedConnectedComps.map(compId => componentPositions.get(compId)!);
          const avgX = positions.reduce((sum, pos) => sum + pos.x, 0) / positions.length;
          const avgY = positions.reduce((sum, pos) => sum + pos.y, 0) / positions.length;
          
          // Convert back to zone-relative position and find nearest grid point
          const zoneRelativeX = avgX - zoneX;
          const zoneRelativeY = avgY - zoneY;
          const preferredCol = Math.round(zoneRelativeX / GRID_SIZE);
          const preferredRow = Math.round(zoneRelativeY / GRID_SIZE);
          
          // Try positions in expanding radius around preferred position
          for (let radius = 0; radius <= 5; radius++) {
            for (let dx = -radius; dx <= radius; dx++) {
              for (let dy = -radius; dy <= radius; dy++) {
                // Only check positions on the radius perimeter
                if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
                  const col = preferredCol + dx;
                  const row = preferredRow + dy;
                  
                  // Check bounds
                  if (col >= 0 && col + DiagramGenerationService.NODE_GRID_WIDTH <= maxCols &&
                      row >= tierRows.start && row <= tierRows.end) {
                    
                    // Check if position is free and maintains minimum distance
                    if (!isGridCellOccupied(occupiedCells, col, row, DiagramGenerationService.NODE_GRID_WIDTH, DiagramGenerationService.NODE_GRID_HEIGHT, maxCols, maxRows) &&
                        checkMinimumDistance(col, row, MIN_CENTER_DISTANCE)) {
                      return { col, row };
                    }
                  }
                }
              }
            }
          }
        }
        
        // Fallback to standard column ordering with distance checking
        for (let row = tierRows.start; row <= tierRows.end; row++) {
          for (const col of columnOrder) {
            if (col + DiagramGenerationService.NODE_GRID_WIDTH <= maxCols) {
              if (!isGridCellOccupied(occupiedCells, col, row, DiagramGenerationService.NODE_GRID_WIDTH, DiagramGenerationService.NODE_GRID_HEIGHT, maxCols, maxRows) &&
                  checkMinimumDistance(col, row, MIN_CENTER_DISTANCE)) {
                return { col, row };
              }
            }
          }
        }
        
        // Second pass: try with reduced spacing if needed
        const REDUCED_CENTER_DISTANCE = 300; // Minimum viable distance - increased for better spacing
        for (let row = tierRows.start; row <= tierRows.end; row++) {
          for (let col = 0; col + DiagramGenerationService.NODE_GRID_WIDTH <= maxCols; col++) {
            if (!isGridCellOccupied(occupiedCells, col, row, DiagramGenerationService.NODE_GRID_WIDTH, DiagramGenerationService.NODE_GRID_HEIGHT, maxCols, maxRows) &&
                checkMinimumDistance(col, row, REDUCED_CENTER_DISTANCE)) {
              return { col, row };
            }
          }
        }
        
        return null;
      };

      // Collect components that couldn't be placed in their tiers
      const unplacedComponents: SimplifiedComponent[] = [];
      
      // Position infrastructure components with connection-aware logic
      groups.infrastructure.forEach((comp, index) => {
        const gridPos = findOptimalGridPosition(comp, TIER_ROWS.infrastructure);
        if (!gridPos) {
          console.warn(`[Grid] No space for infrastructure component ${comp.id}`);
          unplacedComponents.push(comp);
          return;
        }
        
        const pixelPos = gridToPixel(gridPos.col, gridPos.row, zoneX, zoneY);
        markGridCellsOccupied(occupiedCells, gridPos.col, gridPos.row, DiagramGenerationService.NODE_GRID_WIDTH, DiagramGenerationService.NODE_GRID_HEIGHT, maxCols, maxRows);
        
        const validType = nodeTypes.all.includes(comp.type) ? comp.type : 'generic';
        
        componentPositions.set(comp.id, pixelPos);
        nodePlacements.push({
          id: comp.id || `infra-${index}`,
          type: validType,
          x: pixelPos.x,
          y: pixelPos.y,
          data: createNodeData(comp)
        });
      });

      // Position application components with connection-aware logic
      groups.application.forEach((comp, index) => {
        const gridPos = findOptimalGridPosition(comp, TIER_ROWS.application);
        if (!gridPos) {
          console.warn(`[Grid] No space for application component ${comp.id}`);
          unplacedComponents.push(comp);
          return;
        }
        
        const pixelPos = gridToPixel(gridPos.col, gridPos.row, zoneX, zoneY);
        markGridCellsOccupied(occupiedCells, gridPos.col, gridPos.row, DiagramGenerationService.NODE_GRID_WIDTH, DiagramGenerationService.NODE_GRID_HEIGHT, maxCols, maxRows);
        
        const validType = nodeTypes.all.includes(comp.type) ? comp.type : 'generic';
        
        componentPositions.set(comp.id, pixelPos);
        nodePlacements.push({
          id: comp.id || `app-${index}`,
          type: validType,
          x: pixelPos.x,
          y: pixelPos.y,
          data: createNodeData(comp)
        });
      });

      // Position data components with connection-aware logic
      groups.data.forEach((comp, index) => {
        const gridPos = findOptimalGridPosition(comp, TIER_ROWS.data);
        if (!gridPos) {
          console.warn(`[Grid] No space for data component ${comp.id}`);
          unplacedComponents.push(comp);
          return;
        }
        
        const pixelPos = gridToPixel(gridPos.col, gridPos.row, zoneX, zoneY);
        markGridCellsOccupied(occupiedCells, gridPos.col, gridPos.row, DiagramGenerationService.NODE_GRID_WIDTH, DiagramGenerationService.NODE_GRID_HEIGHT, maxCols, maxRows);
        
        const validType = nodeTypes.all.includes(comp.type) ? comp.type : 'generic';
        
        componentPositions.set(comp.id, pixelPos);
        nodePlacements.push({
          id: comp.id || `data-${index}`,
          type: validType,
          x: pixelPos.x,
          y: pixelPos.y,
          data: createNodeData(comp, {
            // securityLevel removed - no longer part of the data model
            dataClassification: 'Confidential' as DataClassification
          })
        });
      });

      // Position other components in support tier
      groups.other.forEach((comp, index) => {
        const gridPos = findOptimalGridPosition(comp, TIER_ROWS.support);
        if (!gridPos) {
          unplacedComponents.push(comp);
          return;
        }
        
        const pixelPos = gridToPixel(gridPos.col, gridPos.row, zoneX, zoneY);
        markGridCellsOccupied(occupiedCells, gridPos.col, gridPos.row, DiagramGenerationService.NODE_GRID_WIDTH, DiagramGenerationService.NODE_GRID_HEIGHT, maxCols, maxRows);
        
        const validType = nodeTypes.all.includes(comp.type) ? comp.type : 'generic';
        
        componentPositions.set(comp.id, pixelPos);
        nodePlacements.push({
          id: comp.id || `component-${index}`,
          type: validType,
          x: pixelPos.x,
          y: pixelPos.y,
          data: createNodeData(comp)
        });
      });
      
      // Handle any unplaced components - enhanced overflow handling
      if (unplacedComponents.length > 0) {
        console.warn(`[Grid] Attempting to place ${unplacedComponents.length} overflow components in zone ${zone}`);
        
        unplacedComponents.forEach((comp, index) => {
          let placed = false;
          
          // Strategy 1: Try to find any available position in the entire zone (relaxed spacing)
          const RELAXED_CENTER_DISTANCE = 200; // Minimum for overflow - increased
          for (let row = 2; row < Math.floor((zoneHeight - 100) / GRID_SIZE); row++) {
            for (let col = 0; col + DiagramGenerationService.NODE_GRID_WIDTH <= maxCols; col++) {
              if (!isGridCellOccupied(occupiedCells, col, row, DiagramGenerationService.NODE_GRID_WIDTH, DiagramGenerationService.NODE_GRID_HEIGHT, maxCols, maxRows) &&
                  checkMinimumDistance(col, row, RELAXED_CENTER_DISTANCE)) {
                const pixelPos = gridToPixel(col, row, zoneX, zoneY);
                markGridCellsOccupied(occupiedCells, col, row, DiagramGenerationService.NODE_GRID_WIDTH, DiagramGenerationService.NODE_GRID_HEIGHT, maxCols, maxRows);
                
                const validType = nodeTypes.all.includes(comp.type) ? comp.type : 'generic';
                
                componentPositions.set(comp.id, pixelPos);
                nodePlacements.push({
                  id: comp.id || `overflow-${index}`,
                  type: validType,
                  x: pixelPos.x,
                  y: pixelPos.y,
                  data: createNodeData(comp)
                });
                
                placed = true;
                console.log(`[Grid] Placed overflow component ${comp.id} at position (${col}, ${row}) with relaxed spacing`);
                break;
              }
            }
            if (placed) break;
          }
          
          // Strategy 2: Try to place just outside the zone (bottom edge)
          if (!placed) {
            const bottomRow = Math.ceil((zoneHeight - 50) / GRID_SIZE);
            for (let col = 0; col + DiagramGenerationService.NODE_GRID_WIDTH <= maxCols; col++) {
              const testKey = `${col},${bottomRow}`;
              if (!occupiedCells.has(testKey)) {
                const pixelPos = gridToPixel(col, bottomRow, zoneX, zoneY);
                occupiedCells.add(testKey); // Mark as occupied to prevent overlap
                
                const validType = nodeTypes.all.includes(comp.type) ? comp.type : 'generic';
                
                componentPositions.set(comp.id, pixelPos);
                nodePlacements.push({
                  id: comp.id || `overflow-edge-${index}`,
                  type: validType,
                  x: pixelPos.x,
                  y: pixelPos.y,
                  data: createNodeData(comp, {
                    overflowPlacement: 'zone-edge'
                  })
                });
                
                placed = true;
                console.log(`[Grid] Placed overflow component ${comp.id} at zone edge (${col}, ${bottomRow})`);
                break;
              }
            }
          }
          
          if (!placed) {
            console.error(`[Grid] Failed to place component ${comp.id} in zone ${zone} - will try cross-zone placement`);
            globalUnplacedComponents.push(comp);
          }
        });
      }
      
      console.log(`[Grid] Zone ${zone} - Placed ${zoneComponents.length} components, occupied ${occupiedCells.size}/${maxCols * maxRows} cells (${Math.round(occupiedCells.size / (maxCols * maxRows) * 100)}%)`);
    });

    // Handle global overflow - enhanced multi-strategy placement
    if (globalUnplacedComponents.length > 0) {
      console.warn(`[Grid] ${globalUnplacedComponents.length} components could not be placed in their assigned zones. Attempting cross-zone placement.`);
      
      // Create an overflow zone if we have many unplaced components
      const needsOverflowZone = globalUnplacedComponents.length > 5;
      if (needsOverflowZone) {
        // Find the rightmost zone
        let maxX = 0;
        let rightmostZone: typeof zoneLayouts[0] | undefined;
        zoneLayouts.forEach(zone => {
          if (zone.x + zone.width > maxX) {
            maxX = zone.x + zone.width;
            rightmostZone = zone;
          }
        });
        
        if (rightmostZone) {
          // Create overflow zone to the right
          const overflowZone = {
            id: 'overflow-zone',
            zoneType: 'Generic' as SecurityZone,
            x: maxX + DiagramGenerationService.ZONE_SPACING,
            y: rightmostZone.y,
            width: DiagramGenerationService.ZONE_WIDTH,
            height: Math.max(1000, Math.ceil(globalUnplacedComponents.length / 3) * 200),
            description: 'Overflow zone for unplaced components'
          };
          
          zoneLayouts.push(overflowZone);
          console.log(`[Grid] Created overflow zone at (${overflowZone.x}, ${overflowZone.y})`);
          
          // Place components in the overflow zone
          let overflowRow = 2;
          let overflowCol = 1;
          globalUnplacedComponents.forEach((comp, index) => {
            const pixelPos = gridToPixel(overflowCol, overflowRow, overflowZone.x, overflowZone.y);
            
            const validType = nodeTypes.all.includes(comp.type) ? comp.type : 'generic';
            
            componentPositions.set(comp.id, pixelPos);
            nodePlacements.push({
              id: comp.id || `overflow-zone-${index}`,
              type: validType,
              x: pixelPos.x,
              y: pixelPos.y,
              data: createNodeData(comp, {
                zone: 'Generic' as SecurityZone,
                originalZone: comp.zone,
                overflowPlacement: 'overflow-zone'
              })
            });
            
            console.log(`[Grid] Placed component ${comp.id} in overflow zone at (${overflowCol}, ${overflowRow})`);
            
            // Move to next position
            overflowCol += 4; // 200px spacing
            if (overflowCol + DiagramGenerationService.NODE_GRID_WIDTH > 12) {
              overflowCol = 1;
              overflowRow += 3; // 150px vertical spacing
            }
          });
          
          return; // All components placed in overflow zone
        }
      }
      
      // Track zone occupancy for smart placement
      const zoneOccupancy = new Map<SecurityZone, Set<string>>();
      
      // Helper function to convert grid to pixel (same as above)
      const gridToPixelGlobal = (gridCol: number, gridRow: number, zoneX: number, zoneY: number) => {
        return {
          x: zoneX + (gridCol * GRID_SIZE) + 10,
          y: zoneY + (gridRow * GRID_SIZE) - 5
        };
      };
      
      // Try each unplaced component
      globalUnplacedComponents.forEach((comp, index) => {
        let placed = false;
        
        // Determine preferred overflow zones based on the component's original zone
        const preferredZones = this.getPreferredOverflowZones(comp.zone, activeZones);
        
        // Try preferred zones first
        for (const targetZone of preferredZones) {
          const targetZoneLayout = zoneLayouts.find(zl => zl.zoneType === targetZone);
          if (!targetZoneLayout) continue;
          
          // Get or create occupancy tracker for this zone
          if (!zoneOccupancy.has(targetZone)) {
            zoneOccupancy.set(targetZone, new Set<string>());
          }
          const occupiedCells = zoneOccupancy.get(targetZone)!;
          
          // Try to find space in this zone
          const zoneHeight = targetZoneLayout.height;
          const zoneWidth = targetZoneLayout.width;
          const targetMaxCols = Math.floor(zoneWidth / GRID_SIZE);
          const targetMaxRows = Math.floor((zoneHeight - 100) / GRID_SIZE);
          
          for (let row = 2; row < targetMaxRows; row++) {
            for (let col = 0; col + DiagramGenerationService.NODE_GRID_WIDTH <= targetMaxCols; col++) {
              if (!occupiedCells.has(`${col},${row}`)) {
                // Found space - place the component
                const pixelPos = gridToPixelGlobal(col, row, targetZoneLayout.x, targetZoneLayout.y);
                
                // Mark cells as occupied
                for (let c = col; c < col + DiagramGenerationService.NODE_GRID_WIDTH; c++) {
                  for (let r = row; r < row + DiagramGenerationService.NODE_GRID_HEIGHT; r++) {
                    occupiedCells.add(`${c},${r}`);
                  }
                }
                
                const nodeTypes = this.getAvailableNodeTypes(generationType);
                const validType = nodeTypes.all.includes(comp.type) ? comp.type : 'generic';
                
                componentPositions.set(comp.id, pixelPos);
                nodePlacements.push({
                  id: comp.id || `overflow-cross-${index}`,
                  type: validType,
                  x: pixelPos.x,
                  y: pixelPos.y,
                  data: createNodeData(comp, {
                    zone: targetZone, // Update zone to reflect actual placement
                    originalZone: comp.zone // Keep track of original zone
                  })
                });
                
                placed = true;
                console.log(`[Grid] Placed overflow component ${comp.id} in alternate zone ${targetZone} at position (${col}, ${row})`);
                break;
              }
            }
            if (placed) break;
          }
          if (placed) break;
        }
        
        if (!placed) {
          console.error(`[Grid] CRITICAL: Could not place component ${comp.id} in any zone. Component will be missing from diagram.`);
        }
      });
    }

    // Create connections with proper handles
    const connections = diagram.connections.map((conn, index) => ({
      source: conn.from,
      target: conn.to,
      label: conn.label,
      protocol: conn.protocol || 'TCP',
      encryption: conn.encryption || 'none',
      description: conn.description,
      portRange: conn.portRange,
      dataClassification: conn.dataClassification,
      securityControls: conn.securityControls,
      bandwidth: conn.bandwidth,
      latency: conn.latency,
      redundancy: conn.redundancy
    }));

    console.log(`[DiagramGeneration] Generated grid-based layout with ${zoneLayouts.length} zones and ${nodePlacements.length} node placements`);
    console.log(`[DiagramGeneration] Zone layouts:`, zoneLayouts.map(z => `${z.id} (${z.zoneType})`));
    console.log(`[DiagramGeneration] Node placements:`, nodePlacements.map(n => `${n.id} (${n.type}) at grid position in zone ${n.data.zone}`));
    
    return {
      zoneLayouts,
      nodePlacements,
      connections,
      componentPositions
    };
  }

  /**
   * Get preferred overflow zones based on logical relationships
   */
  private getPreferredOverflowZones(originalZone: SecurityZone, activeZones: SecurityZone[]): SecurityZone[] {
    // Define logical zone relationships for overflow
    const zoneRelationships: Record<SecurityZone, SecurityZone[]> = {
      'Internet': ['External', 'DMZ', 'Guest'],
      'External': ['DMZ', 'Internet', 'Guest'],
      'DMZ': ['External', 'Internal', 'Internet'],
      'Internal': ['DMZ', 'Trusted', 'Development'],
      'Trusted': ['Internal', 'Production', 'Critical'],
      'Restricted': ['Critical', 'Trusted', 'Production'],
      'Critical': ['Restricted', 'Trusted', 'Production'],
      'OT': ['Internal', 'Critical', 'Production'],
      'Development': ['Staging', 'Internal', 'Cloud'],
      'Staging': ['Development', 'Production', 'Cloud'],
      'Production': ['Staging', 'Internal', 'Cloud'],
      'Cloud': ['Hybrid', 'Production', 'Internal'],
      'Guest': ['External', 'Internet', 'DMZ'],
      'Compliance': ['Restricted', 'Critical', 'Management'],
      'Management': ['Internal', 'Compliance', 'Critical'],
      'ControlPlane': ['DataPlane', 'Management', 'Internal'],
      'DataPlane': ['ControlPlane', 'Internal', 'Production'],
      'ServiceMesh': ['Internal', 'Cloud', 'Production'],
      'BackOffice': ['Internal', 'Management', 'Production'],
      'Partner': ['External', 'DMZ', 'ThirdParty'],
      'ThirdParty': ['Partner', 'External', 'DMZ'],
      'Quarantine': ['Management', 'Restricted', 'Critical'],
      'Recovery': ['Critical', 'Restricted', 'Production'],
      'Edge': ['Cloud', 'External', 'DMZ'],
      'Hybrid': ['Cloud', 'Internal', 'Production'],
      'MultiCloud': ['Cloud', 'Hybrid', 'Production'],
      'RedTeam': ['BlueTeam', 'PurpleTeam', 'Management'],
      'BlueTeam': ['PurpleTeam', 'Management', 'Internal'],
      'PurpleTeam': ['RedTeam', 'BlueTeam', 'Management'],
      'YellowTeam': ['Development', 'GreenTeam', 'Internal'],
      'GreenTeam': ['YellowTeam', 'Development', 'Internal'],
      'OrangeTeam': ['YellowTeam', 'Development', 'Internal'],
      'WhiteTeam': ['Management', 'Compliance', 'Critical'],
      'Generic': ['Internal', 'External', 'DMZ']  // Generic zones can connect to common zones
    };
    
    // Get preferred zones for this original zone
    const preferred = zoneRelationships[originalZone] || [];
    
    // Filter to only include active zones
    const availablePreferred = preferred.filter(z => activeZones.includes(z));
    
    // Add remaining active zones not in preferred list
    const remaining = activeZones.filter(z => z !== originalZone && !availablePreferred.includes(z));
    
    return [...availablePreferred, ...remaining];
  }


  /**
   * Select the most appropriate component from a zone for connections
   */
  private selectRepresentativeComponent(components: SimplifiedComponent[], role: 'source' | 'target'): SimplifiedComponent | null {
    if (components.length === 0) return null;
    if (components.length === 1) return components[0];

    // Prefer different types based on role
    const sourcePreferences = ['gateway', 'proxy', 'loadBalancer', 'firewall', 'webServer', 'api'];
    const targetPreferences = ['database', 'api', 'application', 'webServer', 'service'];
    
    const preferences = role === 'source' ? sourcePreferences : targetPreferences;
    
    for (const prefType of preferences) {
      const found = components.find(comp => comp.type === prefType);
      if (found) return found;
    }
    
    // Fallback to first component
    return components[0];
  }

  /**
   * Generate connections within a zone
   */
  private generateIntraZoneConnections(components: SimplifiedComponent[]): SimplifiedConnection[] {
    const connections: SimplifiedConnection[] = [];
    
    // Group by component type tiers
    const tiers = {
      infrastructure: components.filter((c: SimplifiedComponent) => ['router', 'switch', 'firewall', 'gateway', 'proxy', 'loadBalancer', 'vpnGateway', 'dns'].includes(c.type)),
      application: components.filter((c: SimplifiedComponent) => ['application', 'webServer', 'api', 'service', 'apiGateway'].includes(c.type)),
      data: components.filter((c: SimplifiedComponent) => ['database', 'cache', 'storage', 'vault', 'cloudService'].includes(c.type)),
      security: components.filter((c: SimplifiedComponent) => ['ids', 'waf', 'monitor', 'siem', 'authServer'].includes(c.type)),
      messaging: components.filter((c: SimplifiedComponent) => ['messageBroker', 'queue'].includes(c.type))
    };

    // Connect infrastructure -> application
    if (tiers.infrastructure.length > 0 && tiers.application.length > 0) {
      // Connect primary infrastructure to all applications
      const primaryInfra = tiers.infrastructure[0];
      tiers.application.forEach(app => {
        connections.push({
          from: primaryInfra.id,
          to: app.id,
          label: 'Traffic Flow',
          protocol: 'HTTPS',
          encryption: 'TLS'
        });
      });
    }

    // Connect application -> data
    if (tiers.application.length > 0 && tiers.data.length > 0) {
      // Connect each application to primary data store
      const primaryData = tiers.data[0];
      tiers.application.forEach(app => {
        connections.push({
          from: app.id,
          to: primaryData.id,
          label: 'Data Access',
          protocol: this.getDefaultProtocol(app.type, primaryData.type),
          encryption: 'TLS'
        });
      });
      
      // Connect replica databases to primary
      if (tiers.data.length > 1) {
        for (let i = 1; i < tiers.data.length; i++) {
          const replica = tiers.data[i];
          // Check if it's a replica by name
          if (replica.name && (replica.name.toLowerCase().includes('replica') || 
                               replica.name.toLowerCase().includes('secondary') ||
                               replica.name.match(/-0[2-9]$/))) {
            connections.push({
              from: primaryData.id,
              to: replica.id,
              label: 'Replication',
              protocol: 'TCP',
              encryption: 'TLS'
            });
          }
        }
      }
    }

    // Connect applications to message brokers
    if (tiers.application.length > 0 && tiers.messaging.length > 0) {
      const primaryMessaging = tiers.messaging[0];
      tiers.application.forEach(app => {
        connections.push({
          from: app.id,
          to: primaryMessaging.id,
          label: 'Message Queue',
          protocol: 'AMQP',
          encryption: 'TLS'
        });
      });
      
      // Connect secondary message brokers to primary
      if (tiers.messaging.length > 1) {
        for (let i = 1; i < tiers.messaging.length; i++) {
          connections.push({
            from: primaryMessaging.id,
            to: tiers.messaging[i].id,
            label: 'Cluster Sync',
            protocol: 'TCP',
            encryption: 'TLS'
          });
        }
      }
    }

    // Connect security components to monitored components
    if (tiers.security.length > 0) {
      const monitoringComponents = tiers.security.filter(s => ['monitor', 'ids', 'siem'].includes(s.type));
      const authComponents = tiers.security.filter(s => ['authServer', 'vault'].includes(s.type));
      
      // Connect monitoring to applications
      if (monitoringComponents.length > 0 && tiers.application.length > 0) {
        monitoringComponents.forEach(monitor => {
          connections.push({
            from: monitor.id,
            to: tiers.application[0].id,
            label: 'Monitoring',
            protocol: 'HTTPS',
            encryption: 'TLS'
          });
        });
      }
      
      // Connect auth components to applications
      if (authComponents.length > 0 && tiers.application.length > 0) {
        authComponents.forEach(auth => {
          connections.push({
            from: tiers.application[0].id,
            to: auth.id,
            label: 'Authentication',
            protocol: 'HTTPS',
            encryption: 'TLS'
          });
        });
      }
    }

    // If no connections were created and we have components, create a basic topology
    if (connections.length === 0 && components.length > 1) {
      console.log('[Connections] No tier-based connections possible, creating basic topology');
      
      // Sort components by type priority for a logical flow
      const sortedComponents = [...components].sort((a, b) => {
        const typePriority: Record<string, number> = {
          'firewall': 1, 'loadBalancer': 2, 'gateway': 3, 'proxy': 4,
          'webServer': 5, 'application': 6, 'api': 7, 'service': 8,
          'database': 9, 'storage': 10, 'cache': 11
        };
        
        const aPriority = typePriority[a.type] || 99;
        const bPriority = typePriority[b.type] || 99;
        return aPriority - bPriority;
      });
      
      // Create a chain of connections
      for (let i = 0; i < sortedComponents.length - 1; i++) {
        const from = sortedComponents[i];
        const to = sortedComponents[i + 1];
        
        connections.push({
          from: from.id,
          to: to.id,
          label: this.getConnectionLabel(from.type, to.type),
          protocol: this.getDefaultProtocol(from.type, to.type),
          encryption: 'TLS'
        });
      }
    }

    return connections;
  }

  /**
   * Connect isolated components to the main topology
   */
  private rescueIsolatedComponents(isolatedComponents: SimplifiedComponent[], allComponents: SimplifiedComponent[]): SimplifiedConnection[] {
    const connections: SimplifiedConnection[] = [];
    const connectedComponents = allComponents.filter((comp: SimplifiedComponent) => !isolatedComponents.includes(comp));
    
    // If all components are isolated, create a basic topology first
    if (connectedComponents.length === 0 && isolatedComponents.length > 1) {
      console.log('[Connections] All components are isolated, creating initial topology');
      
      // Sort isolated components by type for logical flow
      const sortedIsolated = [...isolatedComponents].sort((a, b) => {
        const typePriority: Record<string, number> = {
          'firewall': 1, 'loadBalancer': 2, 'gateway': 3, 'proxy': 4,
          'webServer': 5, 'application': 6, 'api': 7, 'service': 8,
          'database': 9, 'storage': 10, 'cache': 11
        };
        
        const aPriority = typePriority[a.type] || 99;
        const bPriority = typePriority[b.type] || 99;
        return aPriority - bPriority;
      });
      
      // Create connections between sorted components
      for (let i = 0; i < sortedIsolated.length - 1; i++) {
        const from = sortedIsolated[i];
        const to = sortedIsolated[i + 1];
        
        connections.push({
          from: from.id,
          to: to.id,
          label: this.getConnectionLabel(from.type, to.type),
          protocol: this.getDefaultProtocol(from.type, to.type),
          encryption: 'TLS'
        });
      }
      
      return connections;
    }
    
    for (const isolated of isolatedComponents) {
      // Find the best component to connect to (same zone preferred, then similar type)
      let bestTarget = connectedComponents.find((comp: SimplifiedComponent) => comp.zone === isolated.zone);
      
      if (!bestTarget) {
        // Find component with similar type
        bestTarget = connectedComponents.find((comp: SimplifiedComponent) => 
          this.getComponentTier(comp.type) === this.getComponentTier(isolated.type)
        );
      }
      
      if (!bestTarget && connectedComponents.length > 0) {
        // Fallback to any connected component
        bestTarget = connectedComponents[0];
      }
      
      if (bestTarget) {
        const protocol = this.getDefaultProtocol(isolated.type, bestTarget.type);
        connections.push({
          from: isolated.id,
          to: bestTarget.id,
          label: 'Integration Link',
          protocol: protocol,
          encryption: protocol.includes('443') || protocol.includes('TLS') ? 'TLS' : 'none'
        });
      }
    }
    
    return connections;
  }

  /**
   * Get component tier for better connection logic
   */
  private getComponentTier(type: string): string {
    const tiers: Record<string, string[]> = {
      infrastructure: ['router', 'switch', 'firewall', 'gateway', 'proxy', 'loadBalancer', 'vpnGateway', 'dns'],
      application: ['application', 'webServer', 'api', 'service', 'apiGateway', 'authServer'],
      data: ['database', 'cache', 'storage', 'vault', 'cloudService'],
      security: ['ids', 'waf', 'monitor', 'siem', 'logging'],
      messaging: ['messageBroker', 'queue']
    };
    
    for (const [tier, types] of Object.entries(tiers)) {
      if (types.includes(type)) return tier;
    }
    return 'other';
  }

  /**
   * Classify zones by their logical function for intelligent vertical positioning
   */
  private classifyZoneByFunction(zone: SecurityZone, architecturalPattern?: ArchitecturalPattern): 'primary' | 'above' | 'below' {
    // Zones that provide oversight, control, or cloud services - position above
    const aboveZones: SecurityZone[] = [
      'Cloud', 'Management', 'ControlPlane', 'ServiceMesh', 'Compliance',
      'BlueTeam', 'RedTeam', 'PurpleTeam', 'WhiteTeam'
    ];
    
    // Zones that provide support services or isolation - position below
    const belowZones: SecurityZone[] = [
      'Guest', 'Recovery', 'Quarantine', 'DataPlane', 'Partner', 'Edge'
    ];
    
    // Context-dependent zones
    const contextualZones: SecurityZone[] = ['Development', 'Staging', 'Production', 'Hybrid'];
    
    // Check if zone is in fixed categories
    if (aboveZones.includes(zone)) {
      return 'above';
    }
    
    if (belowZones.includes(zone)) {
      return 'below';
    }
    
    // Handle context-dependent zones based on architectural pattern
    if (contextualZones.includes(zone)) {
      if (architecturalPattern) {
        // For DevOps pattern, Dev/Staging/Prod are primary flow
        if (architecturalPattern.name === 'DevOps Pipeline' && 
            ['Development', 'Staging', 'Production'].includes(zone)) {
          return 'primary';
        }
        
        // For hybrid cloud architectures, Hybrid zone goes above
        if (architecturalPattern.name === 'Cloud Hybrid' && zone === 'Hybrid') {
          return 'above';
        }
      }
      
      // Default context-dependent zones to below for enterprise patterns
      if (['Development', 'Staging'].includes(zone)) {
        return 'below';
      }
    }
    
    // All other zones are part of the primary security flow
    return 'primary';
  }

  /**
   * Analyze connections between zones to optimize positioning
   */
  private analyzeZoneConnections(components: SimplifiedComponent[], connections: SimplifiedConnection[]): Map<string, Map<string, number>> {
    // Create a matrix of connections between zones
    const zoneConnectionMatrix = new Map<string, Map<string, number>>();
    
    // Build component ID to zone mapping
    const componentToZone = new Map<string, SecurityZone>();
    components.forEach(comp => {
      componentToZone.set(comp.id, comp.zone);
    });
    
    // Count connections between zones
    connections.forEach(conn => {
      const sourceZone = componentToZone.get(conn.from);
      const targetZone = componentToZone.get(conn.to);
      
      if (sourceZone && targetZone && sourceZone !== targetZone) {
        // Initialize if needed
        if (!zoneConnectionMatrix.has(sourceZone)) {
          zoneConnectionMatrix.set(sourceZone, new Map());
        }
        
        const targetMap = zoneConnectionMatrix.get(sourceZone)!;
        targetMap.set(targetZone, (targetMap.get(targetZone) || 0) + 1);
      }
    });
    
    return zoneConnectionMatrix;
  }

  /**
   * Get default protocol for connection between node types
   */
  private getDefaultProtocol(sourceType: string, targetType: string): string {
    if (targetType.includes('database') || targetType === 'database') {
      return 'TCP/5432';
    }
    if (sourceType.includes('web') || targetType.includes('web') || sourceType === 'webServer' || targetType === 'webServer') {
      return 'HTTPS/443';
    }
    if (sourceType.includes('app') || targetType.includes('app') || sourceType === 'application' || targetType === 'application') {
      return 'HTTP/8080';
    }
    if (sourceType.includes('api') || targetType.includes('api')) {
      return 'HTTPS/443';
    }
    return 'TCP/80';
  }

  /**
   * Get connection label based on node types
   */
  private getConnectionLabel(sourceType: string, targetType: string): string {
    if (targetType.includes('database') || targetType === 'database') {
      return 'Database Query';
    }
    if (sourceType.includes('web') || sourceType === 'webServer') {
      return 'HTTP Request';
    }
    if (sourceType.includes('app') || sourceType === 'application') {
      return 'Application Data';
    }
    if (sourceType.includes('api') || targetType.includes('api')) {
      return 'API Call';
    }
    return 'Data Flow';
  }

  /**
   * Validate the generated diagram and identify issues for multi-pass improvement
   */
  private validateDiagram(diagram: AIGeneratedDiagram, originalDescription: string, generationType?: DiagramGenerationType): ValidationResult {
    const issues: ValidationIssue[] = [];
    const nodeTypes = this.getAvailableNodeTypes(generationType);
    const allValidTypes = nodeTypes.all;
    const validZones = this.getAvailableZones();
    
    // Count generic components
    const genericComponents = diagram.components.filter(c => c.type === 'generic');
    const genericPercentage = (genericComponents.length / diagram.components.length) * 100;
    
    // Check for excessive generic types
    if (genericPercentage > 20) {
      issues.push({
        type: 'generic_type',
        severity: 'warning',
        description: `${genericPercentage.toFixed(1)}% of components are typed as 'generic'. Many could be more specific.`,
        affectedComponents: genericComponents.map(c => c.id)
      });
    }
    
    // Validate individual generic components that could be more specific
    genericComponents.forEach(comp => {
      const nameLower = comp.name.toLowerCase();
      let suggestedType: string | null = null;
      
      // Common patterns to detect proper types
      if (nameLower.includes('server') || nameLower.includes('nginx') || nameLower.includes('apache')) {
        suggestedType = 'server';
      } else if (nameLower.includes('database') || nameLower.includes('postgres') || nameLower.includes('mysql') || nameLower.includes('redis')) {
        suggestedType = 'database';
      } else if (nameLower.includes('firewall') || nameLower.includes('waf')) {
        suggestedType = 'firewall';
      } else if (nameLower.includes('load balancer') || nameLower.includes('alb') || nameLower.includes('elb')) {
        suggestedType = 'loadBalancer';
      } else if (nameLower.includes('api') || nameLower.includes('gateway')) {
        suggestedType = 'api';
      } else if (nameLower.includes('dns') || nameLower.includes('route 53')) {
        suggestedType = 'dns';
      } else if (nameLower.includes('cache') || nameLower.includes('redis') || nameLower.includes('memcached')) {
        suggestedType = 'cache';
      } else if (nameLower.includes('queue') || nameLower.includes('rabbitmq') || nameLower.includes('kafka')) {
        suggestedType = 'messageBroker';
      } else if (nameLower.includes('elasticsearch') || nameLower.includes('elastic')) {
        suggestedType = 'database'; // or could be 'monitor' depending on usage
      }
      
      if (suggestedType && allValidTypes.includes(suggestedType)) {
        issues.push({
          type: 'generic_type',
          severity: 'warning',
          description: `Component '${comp.name}' is typed as 'generic' but appears to be a '${suggestedType}'`,
          affectedComponents: [comp.id]
        });
      }
    });
    
    // Check for orphaned nodes (no connections)
    const connectedNodes = new Set<string>();
    diagram.connections.forEach(conn => {
      connectedNodes.add(conn.from);
      connectedNodes.add(conn.to);
    });
    
    const orphanedNodes = diagram.components.filter(c => !connectedNodes.has(c.id));
    const orphanedPercentage = (orphanedNodes.length / diagram.components.length) * 100;
    
    if (orphanedNodes.length > 0) {
      issues.push({
        type: 'orphaned_node',
        severity: 'error',
        description: `${orphanedNodes.length} components have no connections (${orphanedPercentage.toFixed(1)}%)`,
        affectedComponents: orphanedNodes.map(c => c.id)
      });
    }
    
    // Check for invalid zones
    const invalidZoneComponents = diagram.components.filter(c => 
      c.zone && !validZones.includes(c.zone)
    );
    
    if (invalidZoneComponents.length > 0) {
      issues.push({
        type: 'invalid_zone',
        severity: 'error',
        description: `${invalidZoneComponents.length} components have invalid zone assignments`,
        affectedComponents: invalidZoneComponents.map(c => c.id)
      });
    }
    
    // Check for potentially missing components from description
    const missingComponents = this.detectMissingComponents(originalDescription, diagram);
    if (missingComponents.length > 0) {
      issues.push({
        type: 'missing_component',
        severity: 'warning',
        description: `Potentially missing ${missingComponents.length} components mentioned in the description`,
        affectedComponents: missingComponents
      });
    }
    
    return {
      isValid: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      metrics: {
        totalComponents: diagram.components.length,
        genericComponents: genericComponents.length,
        genericPercentage,
        orphanedNodes: orphanedNodes.length,
        orphanedPercentage,
        missingComponents: missingComponents.length > 0 ? missingComponents : undefined,
        zoneIssues: invalidZoneComponents.map(c => `${c.id}: ${c.zone}`)
      }
    };
  }
  
  /**
   * Detect potentially missing components by analyzing the description
   */
  private detectMissingComponents(description: string, diagram: AIGeneratedDiagram): string[] {
    const missing: string[] = [];
    const descLower = description.toLowerCase();
    const existingNames = new Set(diagram.components.map(c => c.name.toLowerCase()));
    
    // Common component patterns to look for
    const patterns = [
      { regex: /(\d+)\s+(\w+\s+)?servers?/gi, type: 'server' },
      { regex: /(\d+)\s+databases?/gi, type: 'database' },
      { regex: /(\d+)\s+firewalls?/gi, type: 'firewall' },
      { regex: /(\d+)\s+(\w+\s+)?nodes?/gi, type: 'node' },
      { regex: /(\w+)\s+server/gi, type: 'server' },
      { regex: /(\w+)\s+database/gi, type: 'database' },
      { regex: /(\w+)\s+firewall/gi, type: 'firewall' },
      { regex: /(\w+)\s+gateway/gi, type: 'gateway' },
      { regex: /(\w+)\s+balancer/gi, type: 'loadBalancer' }
    ];
    
    // Look for specific named components
    const namedComponentRegex = /([A-Z][\w-]+(?:\s+[A-Z][\w-]+)*)/g;
    const matches = description.match(namedComponentRegex) || [];
    
    matches.forEach(match => {
      if (!existingNames.has(match.toLowerCase()) && 
          !match.includes('Zone') && 
          match.length > 3 &&
          !['The', 'This', 'That', 'These', 'Those'].includes(match)) {
        // Check if it's likely a component name
        const followingText = description.substring(description.indexOf(match));
        if (followingText.match(/^[\s\-:]*(server|database|service|system|cluster|node|gateway|firewall|balancer)/i)) {
          missing.push(match);
        }
      }
    });
    
    return Array.from(new Set(missing)); // Remove duplicates
  }
  
  /**
   * Generate a re-prompt for the AI to fix specific issues
   */
  private generateValidationPrompt(validation: ValidationResult, originalDiagram: AIGeneratedDiagram, originalDescription: string, generationType?: DiagramGenerationType): string {
    // Check if this is a local LLM based on the current provider
    const isLocalLLM = this.isLocalLLMProvider(this.currentProvider);
    
    let prompt = `I need you to improve the diagram you just generated. Here are the specific issues found:\n\n`;
    
    // Add specific issues
    if (validation.metrics.genericPercentage > 20) {
      prompt += `## Component Type Issues\n`;
      prompt += `- ${validation.metrics.genericComponents} out of ${validation.metrics.totalComponents} components are typed as 'generic' (${validation.metrics.genericPercentage.toFixed(1)}%)\n`;
      prompt += `- Please assign more specific types based on the component names and purposes\n`;
      
      // List specific components that need better types
      const genericIssues = validation.issues.filter(i => i.type === 'generic_type' && i.description.includes('appears to be'));
      if (genericIssues.length > 0) {
        prompt += `\nSpecific components that need proper types:\n`;
        genericIssues.forEach(issue => {
          prompt += `- ${issue.description}\n`;
        });
      }
      prompt += `\n`;
    }
    
    if (validation.metrics.orphanedNodes > 0) {
      prompt += `## Connection Issues\n`;
      prompt += `- ${validation.metrics.orphanedNodes} components have no connections\n`;
      prompt += `- Every component must be connected to at least one other component\n`;
      prompt += `- Orphaned components: ${validation.issues.find(i => i.type === 'orphaned_node')?.affectedComponents?.join(', ')}\n\n`;
    }
    
    if (validation.metrics.missingComponents && validation.metrics.missingComponents.length > 0) {
      prompt += `## Missing Components\n`;
      prompt += `- The following components were mentioned in the description but not included: ${validation.metrics.missingComponents.join(', ')}\n`;
      prompt += `- Please add these components if they are relevant to the system\n\n`;
    }
    
    if (validation.metrics.zoneIssues && validation.metrics.zoneIssues.length > 0) {
      prompt += `## Zone Assignment Issues\n`;
      prompt += `- Some components have invalid zone assignments\n`;
      prompt += `- Invalid assignments: ${validation.metrics.zoneIssues.join(', ')}\n`;
      prompt += `- Valid zones are: ${this.getAvailableZones().join(', ')}\n\n`;
    }
    
    // Different instructions for local LLMs vs cloud providers
    if (isLocalLLM) {
      prompt += `## Instructions\n`;
      prompt += `1. Output the complete improved diagram in JSON format\n`;
      prompt += `2. Fix ALL the issues mentioned above\n`;
      prompt += `3. Maintain all existing valid components and connections\n`;
      prompt += `4. Use proper node types from the valid list\n`;
      prompt += `5. CRITICAL: Ensure EVERY component has at least one connection\n`;
      prompt += `6. For orphaned components, add logical connections based on the system architecture\n`;
      prompt += `7. Use EXACT zone names from the valid list (e.g., 'Internet', 'DMZ', 'Internal', 'Production', 'Restricted')\n\n`;
      
      prompt += `## Valid Node Types\n${this.getAvailableNodeTypes(generationType).all.join(', ')}\n\n`;
      
      prompt += `## Valid Zones\n${this.getAvailableZones().join(', ')}\n\n`;
      
      prompt += `Output ONLY the JSON with this structure:\n`;
      prompt += `{\n`;
      prompt += `  "systemName": "System Name",\n`;
      prompt += `  "components": [\n`;
      prompt += `    {\n`;
      prompt += `      "name": "Component Name",\n`;
      prompt += `      "type": "componentType",\n`;
      prompt += `      "zone": "EXACT zone name from valid list",\n`;
      prompt += `      "description": "optional description",\n`;
      prompt += `      "vendor": "if known",\n`;
      prompt += `      "version": "if known"\n`;
      prompt += `    }\n`;
      prompt += `  ],\n`;
      prompt += `  "connections": [\n`;
      prompt += `    {\n`;
      prompt += `      "from": "Component Name 1",\n`;
      prompt += `      "to": "Component Name 2",\n`;
      prompt += `      "label": "Connection purpose",\n`;
      prompt += `      "protocol": "if known",\n`;
      prompt += `      "encryption": "if known"\n`;
      prompt += `    }\n`;
      prompt += `  ]\n`;
      prompt += `}\n\n`;
      
      prompt += `CRITICAL VALIDATION:\n`;
      prompt += `- connections array MUST have AT LEAST as many entries as components\n`;
      prompt += `- Every component name in components array MUST appear in at least one connection\n`;
      prompt += `- Add logical connections for ALL orphaned components based on typical system architectures\n\n`;
    } else {
      prompt += `## Instructions\n`;
      prompt += `1. Output the complete improved diagram in Cypher format\n`;
      prompt += `2. Fix ALL the issues mentioned above\n`;
      prompt += `3. Maintain all existing valid components and connections\n`;
      prompt += `4. Use proper node types from the valid list\n`;
      prompt += `5. Ensure every component has at least one connection\n`;
      prompt += `6. Use exact zone names without descriptions (e.g., 'Internet' not 'Internet Zone (Customer Facing)')\n\n`;
      
      prompt += `## Valid Node Types\n${this.getAvailableNodeTypes(generationType).all.join(', ')}\n\n`;
      
      prompt += `Please generate the improved Cypher diagram now.\n\n`;
    }
    
    prompt += `## Current Diagram Summary\n`;
    prompt += `- Components: ${originalDiagram.components.length}\n`;
    prompt += `- Connections: ${originalDiagram.connections.length}\n`;
    prompt += `- System: ${originalDiagram.systemName}\n\n`;
    
    prompt += `## Original System Description\n`;
    prompt += `The original system being modeled is:\n${originalDescription}\n\n`;
    
    if (isLocalLLM) {
      prompt += `Generate the complete improved diagram in JSON format with ALL components properly connected.`;
    } else {
      prompt += `Generate the complete improved diagram in Cypher format.`;
    }
    
    return prompt;
  }
  
  /**
   * Convert simplified diagram to ExampleSystem format using layout
   */
  private convertToExampleSystem(diagram: AIGeneratedDiagram, layoutData: any): ExampleSystem {
    // Use generateSecuritySystem to create nodes and edges with proper layout
    const { nodes, edges } = generateSecuritySystem(
      diagram.systemName,
      diagram.description,
      layoutData.zoneLayouts,
      layoutData.nodePlacements,
      layoutData.connections
    );

    return {
      id: (diagram.systemName || 'untitled-system').toLowerCase().replace(/\s+/g, '-'),
      name: diagram.systemName || 'Untitled System',
      description: diagram.description || 'Generated system diagram',
      category: 'Enterprise Systems' as SystemCategory,
      // securityLevel removed - no longer part of the system model
      primaryZone: diagram.primaryZone,
      dataClassification: diagram.dataClassification,
      nodes,
      edges,
      customContext: diagram.customContext
    };
  }

  /**
   * Handle cancellation of a diagram generation
   */
  private async handleCancellation(signal: AbortSignal): Promise<void> {
    const generation = this.activeGenerations.get(signal);
    if (generation) {
      const duration = Date.now() - generation.startTime.getTime();
      console.log(`[DiagramGeneration] Generation cancelled after ${duration}ms for context: ${generation.context}`);
      
      // Call the cancel API if we have a requestId
      if (generation.requestId) {
        console.log(`[DiagramGeneration] Calling cancel API for request ${generation.requestId}`);
        try {
          const result = await cancelDiagramGeneration(generation.requestId);
          if (result.success) {
            console.log(`[DiagramGeneration] Server acknowledged cancellation for ${generation.requestId}`);
          } else {
            console.warn(`[DiagramGeneration] Server cancellation failed: ${result.error}`);
          }
        } catch (error) {
          console.error(`[DiagramGeneration] Error calling cancel API:`, error);
        }
      }
      
      this.activeGenerations.delete(signal);
    }
  }

  /**
   * Cancel all active diagram generations
   */
  public cancelAllGenerations(): void {
    console.log(`[DiagramGeneration] Cancelling all ${this.activeGenerations.size} active generations`);
    
    const entries = Array.from(this.activeGenerations.entries());
    for (const [signal, generation] of entries) {
      const duration = Date.now() - generation.startTime.getTime();
      console.log(`[DiagramGeneration] Cancelling generation after ${duration}ms for context: ${generation.context}`);
      
      // The abort controller that owns this signal should handle the abort
      // We just clean up our tracking
    }
    
    this.activeGenerations.clear();
  }

  /**
   * Cancel a specific generation by its signal
   */
  public cancelGeneration(signal: AbortSignal): boolean {
    const generation = this.activeGenerations.get(signal);
    if (generation) {
      const duration = Date.now() - generation.startTime.getTime();
      console.log(`[DiagramGeneration] Cancelling specific generation after ${duration}ms for context: ${generation.context}`);
      this.activeGenerations.delete(signal);
      return true;
    }
    return false;
  }

  /**
   * Get the number of active generations
   */
  public getActiveGenerationCount(): number {
    return this.activeGenerations.size;
  }

  /**
   * Check if there are any active generations
   */
  public hasActiveGenerations(): boolean {
    return this.activeGenerations.size > 0;
  }

  /**
   * Get details about active generations (for debugging/monitoring)
   */
  public getActiveGenerationDetails(): Array<{ startTime: Date; context: string; duration: number }> {
    const details: Array<{ startTime: Date; context: string; duration: number }> = [];
    
    const values = Array.from(this.activeGenerations.values());
    for (const generation of values) {
      details.push({
        startTime: generation.startTime,
        context: generation.context,
        duration: Date.now() - generation.startTime.getTime()
      });
    }
    
    return details;
  }

}

export const diagramGenerationService = new DiagramGenerationService();
