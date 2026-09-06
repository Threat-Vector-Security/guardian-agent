import React, { useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useTheme } from '@mui/material/styles';
import { Cable } from '@mui/icons-material';
import { colors, nodeDefaults, getTheme } from '../styles/Theme';
import { DataClassification, SecurityNodeData, SecurityNodeType, SecurityZone } from '../types/SecurityTypes';
import { useSettings } from '../settings/SettingsContext';
import { useManualAnalysis } from '../contexts/ManualAnalysisContext';
import { materialIconMappings } from '../utils/materialIconMappings';
import { deserializeIcon } from '../utils/iconSerialization';
import '../styles/ModernStyles.css';
import Shape from './shapes';
import DfdDocumentNode from './nodes/DfdDocumentNode';
import { useDiagramLens } from '../contexts/DiagramLensContext';
import { DEFAULT_NODE_SHAPE, shapeMetadata, NodeShape } from '../types/ShapeTypes';
import { getShapeBoundingBox } from '../utils/shapeBoundingBox';

// Toggle for verbose icon rendering logs
const DEBUG_ICON_RENDER = false;

interface SecurityNodeProps {
  id: string; // React Flow node id
  data: SecurityNodeData;
  selected: boolean;
}

// Define nodeTypeConfig first
const nodeTypeConfig: Record<string, { icon: React.ElementType, color: keyof typeof colors }> = {
  // Infrastructure
  server: { icon: materialIconMappings.server.icon, color: 'serverColor' },
  user: { icon: materialIconMappings.user.icon, color: 'userColor' },
  workstation: { icon: materialIconMappings.workstation.icon, color: 'workstationColor' },
  endpoint: { icon: materialIconMappings.endpoint.icon, color: 'endpointColor' },
  desktop: { icon: materialIconMappings.desktop.icon, color: 'endpointColor' },
  laptop: { icon: materialIconMappings.laptop.icon, color: 'endpointColor' },
  tablet: { icon: materialIconMappings.tablet.icon, color: 'endpointColor' },
  smartphone: { icon: materialIconMappings.smartphone.icon, color: 'endpointColor' },
  printer: { icon: materialIconMappings.printer.icon, color: 'printerColor' },
  router: { icon: materialIconMappings.router.icon, color: 'routerColor' },
  switch: { icon: materialIconMappings.switch.icon, color: 'switchColor' },
  coreRouter: { icon: materialIconMappings.coreRouter.icon, color: 'routerColor' },
  edgeRouter: { icon: materialIconMappings.edgeRouter.icon, color: 'routerColor' },
  accessPoint: { icon: materialIconMappings.accessPoint.icon, color: 'switchColor' },
  wirelessController: { icon: materialIconMappings.wirelessController.icon, color: 'switchColor' },
  // New Infrastructure
  thinClient: { icon: materialIconMappings.thinClient.icon, color: 'endpointColor' },
  virtualDesktopHost: { icon: materialIconMappings.virtualDesktopHost.icon, color: 'serverColor' },
  sdwanGateway: { icon: materialIconMappings.sdwanGateway.icon, color: 'gatewayColor' },
  firewall: { icon: materialIconMappings.firewall.icon, color: 'firewallColor' },
  vpnGateway: { icon: materialIconMappings.vpnGateway.icon, color: 'vpnGatewayColor' },
  ids: { icon: materialIconMappings.ids.icon, color: 'idsColor' },
  ips: { icon: materialIconMappings.ips.icon, color: 'ipsColor' },
  waf: { icon: materialIconMappings.waf.icon, color: 'wafColor' },
  proxy: { icon: materialIconMappings.proxy.icon, color: 'proxyColor' },
  reverseProxy: { icon: materialIconMappings.reverseProxy.icon, color: 'reverseProxyColor' },
  monitor: { icon: materialIconMappings.monitor.icon, color: 'monitorColor' },
  
  // Security Operations & Analytics
  siem: { icon: materialIconMappings.siem.icon, color: 'siemColor' },
  soar: { icon: materialIconMappings.soar.icon, color: 'soarColor' },
  xdr: { icon: materialIconMappings.xdr.icon, color: 'xdrColor' },
  edr: { icon: materialIconMappings.edr.icon, color: 'edrColor' },
  ndr: { icon: materialIconMappings.ndr.icon, color: 'ndrColor' },
  
  // Cloud Security
  casb: { icon: materialIconMappings.casb.icon, color: 'casbColor' },
  sase: { icon: materialIconMappings.sase.icon, color: 'saseColor' },
  ztna: { icon: materialIconMappings.ztna.icon, color: 'ztnaColor' },
  
  // Data Protection
  dlp: { icon: materialIconMappings.dlp.icon, color: 'dlpColor' },
  dam: { icon: materialIconMappings.dam.icon, color: 'damColor' },
  pam: { icon: materialIconMappings.pam.icon, color: 'pamColor' },
  hsm: { icon: materialIconMappings.hsm.icon, color: 'hsmColor' },
  kms: { icon: materialIconMappings.kms.icon, color: 'kmsColor' },
  secretsManager: { icon: materialIconMappings.secretsManager.icon, color: 'secretsManagerColor' },
  certificateAuthority: { icon: materialIconMappings.certificateAuthority.icon, color: 'certificateAuthorityColor' },
  
  // Identity & Access
  mfa: { icon: materialIconMappings.mfa.icon, color: 'mfaColor' },
  sso: { icon: materialIconMappings.sso.icon, color: 'ssoColor' },
  ldap: { icon: materialIconMappings.ldap.icon, color: 'ldapColor' },
  radiusServer: { icon: materialIconMappings.radiusServer.icon, color: 'radiusServerColor' },
  
  // Threat Detection
  honeypot: { icon: materialIconMappings.honeypot.icon, color: 'honeypotColor' },
  honeynet: { icon: materialIconMappings.honeynet.icon, color: 'honeynetColor' },
  deceptionSystem: { icon: materialIconMappings.deceptionSystem.icon, color: 'deceptionSystemColor' },
  networkTap: { icon: materialIconMappings.networkTap.icon, color: 'networkTapColor' },
  packetCapture: { icon: materialIconMappings.packetCapture.icon, color: 'packetCaptureColor' },
  
  // Vulnerability Management
  vulnerabilityScanner: { icon: materialIconMappings.vulnerabilityScanner.icon, color: 'vulnerabilityScannerColor' },
  patchManagement: { icon: materialIconMappings.patchManagement.icon, color: 'patchManagementColor' },
  configManagement: { icon: materialIconMappings.configManagement.icon, color: 'configManagementColor' },
  complianceScanner: { icon: materialIconMappings.complianceScanner.icon, color: 'complianceScannerColor' },
  penTestTool: { icon: materialIconMappings.penTestTool.icon, color: 'penTestToolColor' },
  staticAnalysis: { icon: materialIconMappings.staticAnalysis.icon, color: 'staticAnalysisColor' },
  dynamicAnalysis: { icon: materialIconMappings.dynamicAnalysis.icon, color: 'dynamicAnalysisColor' },
  containerScanner: { icon: materialIconMappings.containerScanner.icon, color: 'containerScannerColor' },
  k8sAdmissionController: { icon: materialIconMappings.k8sAdmissionController.icon, color: 'k8sAdmissionControllerColor' },
  meshProxy: { icon: materialIconMappings.meshProxy.icon, color: 'meshProxyColor' },
  // New Security Controls
  applicationDeliveryController: { icon: materialIconMappings.applicationDeliveryController.icon, color: 'gatewayColor' },
  identityProvider: { icon: materialIconMappings.identityProvider.icon, color: 'identityColor' },
  
  // API & Application Security
  apiSecurity: { icon: materialIconMappings.apiSecurity.icon, color: 'apiSecurityColor' },
  botProtection: { icon: materialIconMappings.botProtection.icon, color: 'botProtectionColor' },
  ddosProtection: { icon: materialIconMappings.ddosProtection.icon, color: 'ddosProtectionColor' },
  emailSecurity: { icon: materialIconMappings.emailSecurity.icon, color: 'emailSecurityColor' },
  webFilter: { icon: materialIconMappings.webFilter.icon, color: 'webFilterColor' },
  
  // Threat Intelligence
  sandboxAnalyzer: { icon: materialIconMappings.sandboxAnalyzer.icon, color: 'sandboxAnalyzerColor' },
  threatIntelPlatform: { icon: materialIconMappings.threatIntelPlatform.icon, color: 'threatIntelPlatformColor' },
  forensicsStation: { icon: materialIconMappings.forensicsStation.icon, color: 'forensicsStationColor' },
  incidentResponsePlatform: { icon: materialIconMappings.incidentResponsePlatform.icon, color: 'incidentResponsePlatformColor' },
  
  // Backup & Recovery
  backupSystem: { icon: materialIconMappings.backupSystem.icon, color: 'backupSystemColor' },
  disasterRecovery: { icon: materialIconMappings.disasterRecovery.icon, color: 'disasterRecoveryColor' },
  
  // Advanced Security
  encryptionGateway: { icon: materialIconMappings.encryptionGateway.icon, color: 'encryptionGatewayColor' },
  tokenizer: { icon: materialIconMappings.tokenizer.icon, color: 'tokenizerColor' },
  riskAnalytics: { icon: materialIconMappings.riskAnalytics.icon, color: 'riskAnalyticsColor' },
  identityGovernance: { icon: materialIconMappings.identityGovernance.icon, color: 'identityGovernanceColor' },
  
  // Cloud Security Posture
  cloudSecurityPosture: { icon: materialIconMappings.cloudSecurityPosture.icon, color: 'cloudSecurityPostureColor' },
  workloadProtection: { icon: materialIconMappings.workloadProtection.icon, color: 'workloadProtectionColor' },
  runtimeProtection: { icon: materialIconMappings.runtimeProtection.icon, color: 'runtimeProtectionColor' },
  // Kernel & Hardware Application Components
  kernelModule: { icon: materialIconMappings.kernelModule.icon, color: 'kernelModuleColor' },
  deviceDriver: { icon: materialIconMappings.deviceDriver.icon, color: 'deviceDriverColor' },
  hypervisor: { icon: materialIconMappings.hypervisor.icon, color: 'hypervisorColor' },
  firmware: { icon: materialIconMappings.firmware.icon, color: 'firmwareColor' },
  secureEnclave: { icon: materialIconMappings.secureEnclave.icon, color: 'secureEnclaveColor' },
  tpm: { icon: materialIconMappings.tpm.icon, color: 'tpmColor' },
  microcode: { icon: materialIconMappings.microcode.icon, color: 'microcodeColor' },
  
  // DevSecOps
  supplychainSecurity: { icon: materialIconMappings.supplychainSecurity.icon, color: 'supplychainSecurityColor' },
  codeRepository: { icon: materialIconMappings.codeRepository.icon, color: 'codeRepositoryColor' },
  cicdSecurity: { icon: materialIconMappings.cicdSecurity.icon, color: 'cicdSecurityColor' },
  secretScanner: { icon: materialIconMappings.secretScanner.icon, color: 'secretScannerColor' },
  sbom: { icon: materialIconMappings.sbom.icon, color: 'sbomColor' },
  dependencyScanner: { icon: materialIconMappings.dependencyScanner.icon, color: 'dependencyScannerColor' },
  infrastructureAsCode: { icon: materialIconMappings.infrastructureAsCode.icon, color: 'infrastructureAsCodeColor' },
  policyAsCode: { icon: materialIconMappings.policyAsCode.icon, color: 'policyAsCodeColor' },
  
  // Access Control
  cloudAccessBroker: { icon: materialIconMappings.cloudAccessBroker.icon, color: 'cloudAccessBrokerColor' },
  remoteAccessGateway: { icon: materialIconMappings.remoteAccessGateway.icon, color: 'remoteAccessGatewayColor' },
  bastionHost: { icon: materialIconMappings.bastionHost.icon, color: 'bastionHostColor' },
  jumpServer: { icon: materialIconMappings.jumpServer.icon, color: 'jumpServerColor' },
  
  // Emerging Tech
  aiSecurityGateway: { icon: materialIconMappings.aiSecurityGateway.icon, color: 'aiSecurityGatewayColor' },
  quantumKeyDistribution: { icon: materialIconMappings.quantumKeyDistribution.icon, color: 'quantumKeyDistributionColor' },
  blockchainSecurity: { icon: materialIconMappings.blockchainSecurity.icon, color: 'blockchainSecurityColor' },
  otSecurityGateway: { icon: materialIconMappings.otSecurityGateway.icon, color: 'otSecurityGatewayColor' },
  iotSecurityGateway: { icon: materialIconMappings.iotSecurityGateway.icon, color: 'iotSecurityGatewayColor' },
  
  // Physical Security
  physicalAccessControl: { icon: materialIconMappings.physicalAccessControl.icon, color: 'physicalAccessControlColor' },
  videoSurveillance: { icon: materialIconMappings.videoSurveillance.icon, color: 'videoSurveillanceColor' },
  
  // Orchestration
  securityOrchestrator: { icon: materialIconMappings.securityOrchestrator.icon, color: 'securityOrchestratorColor' },
  
  // Network Zones (these are infrastructure nodes, not actual zones)
  dmz: { icon: materialIconMappings.server.icon, color: 'serverColor' },
  internalNetwork: { icon: materialIconMappings.workstation.icon, color: 'workstationColor' },
  externalNetwork: { icon: materialIconMappings.webServer.icon, color: 'endpointColor' },
  trustedNetwork: { icon: materialIconMappings.waf.icon, color: 'dnsColor' },
  restrictedNetwork: { icon: materialIconMappings.firewall.icon, color: 'gatewayColor' },
  
  // Applications
  application: { icon: materialIconMappings.application.icon, color: 'applicationColor' },
  containerizedService: { icon: materialIconMappings.containerizedService.icon, color: 'containerizedServiceColor' },
  database: { icon: materialIconMappings.database.icon, color: 'databaseColor' },
  loadBalancer: { icon: materialIconMappings.loadBalancer.icon, color: 'loadBalancerColor' },
  apiGateway: { icon: materialIconMappings.apiGateway.icon, color: 'apiGatewayColor' },
  webServer: { icon: materialIconMappings.webServer.icon, color: 'webServerColor' },
  authServer: { icon: materialIconMappings.authServer.icon, color: 'authServerColor' },
  messageBroker: { icon: materialIconMappings.messageBroker.icon, color: 'messageBrokerColor' },
  
  // Cloud
  cloudService: { icon: materialIconMappings.cloudService.icon, color: 'cloudServiceColor' },
  search: { icon: materialIconMappings.search.icon, color: 'searchColor' },
  containerRegistry: { icon: materialIconMappings.containerRegistry.icon, color: 'containerRegistryColor' },
  kubernetesPod: { icon: materialIconMappings.kubernetesPod.icon, color: 'kubernetesPodColor' },
  kubernetesService: { icon: materialIconMappings.kubernetesService.icon, color: 'kubernetesServiceColor' },
  storageAccount: { icon: materialIconMappings.storageAccount.icon, color: 'storageAccountColor' },
  functionApp: { icon: materialIconMappings.functionApp.icon, color: 'functionAppColor' },
  apiManagement: { icon: materialIconMappings.apiManagement.icon, color: 'apiManagementColor' },
  cloudLoadBalancer: { icon: materialIconMappings.cloudLoadBalancer.icon, color: 'cloudLoadBalancerColor' },
  cloudFirewall: { icon: materialIconMappings.cloudFirewall.icon, color: 'cloudFirewallColor' },
  cloudDatabase: { icon: materialIconMappings.cloudDatabase.icon, color: 'cloudDatabaseColor' },
  
  // OT/SCADA
  plc: { icon: materialIconMappings.plc.icon, color: 'plcColor' },
  hmi: { icon: materialIconMappings.hmi.icon, color: 'hmiColor' },
  historian: { icon: materialIconMappings.historian.icon, color: 'historianColor' },
  rtu: { icon: materialIconMappings.rtu.icon, color: 'rtuColor' },
  sensor: { icon: materialIconMappings.sensor.icon, color: 'sensorColor' },
  actuator: { icon: materialIconMappings.actuator.icon, color: 'actuatorColor' },
  scadaServer: { icon: materialIconMappings.scadaServer.icon, color: 'scadaServerColor' },
  industrialFirewall: { icon: materialIconMappings.industrialFirewall.icon, color: 'industrialFirewallColor' },
  safetySystem: { icon: materialIconMappings.safetySystem.icon, color: 'safetySystemColor' },
  industrialNetwork: { icon: materialIconMappings.industrialNetwork.icon, color: 'industrialNetworkColor' },
  
  // AI/ML
  aiGateway: { icon: materialIconMappings.aiGateway.icon, color: 'aiGatewayColor' },
  inferenceEngine: { icon: materialIconMappings.inferenceEngine.icon, color: 'inferenceEngineColor' },
  modelRegistry: { icon: materialIconMappings.modelRegistry.icon, color: 'modelRegistryColor' },
  aiWorkbench: { icon: materialIconMappings.aiWorkbench.icon, color: 'aiWorkbenchColor' },
  mlPipeline: { icon: materialIconMappings.mlPipeline.icon, color: 'mlPipelineColor' },
  aiModel: { icon: materialIconMappings.aiModel.icon, color: 'aiModelColor' },
  vectorDatabase: { icon: materialIconMappings.vectorDatabase.icon, color: 'vectorDatabaseColor' },
  dataLake: { icon: materialIconMappings.dataLake.icon, color: 'dataLakeColor' },
  featureStore: { icon: materialIconMappings.featureStore.icon, color: 'featureStoreColor' },
  llmService: { icon: materialIconMappings.llmService.icon, color: 'llmServiceColor' },
  ai: { icon: materialIconMappings.ai.icon, color: 'aiColor' },
  mlInference: { icon: materialIconMappings.mlInference.icon, color: 'mlInferenceColor' },
  notebookServer: { icon: materialIconMappings.notebookServer.icon, color: 'notebookServerColor' },
  computeCluster: { icon: materialIconMappings.computeCluster.icon, color: 'computeClusterColor' },
  modelVault: { icon: materialIconMappings.modelVault.icon, color: 'modelVaultColor' },
  securityScanner: { icon: materialIconMappings.securityScanner.icon, color: 'securityScannerColor' },
  
  // Cybercrime & Fraud
  fraudDetection: { icon: materialIconMappings.fraudDetection.icon, color: 'fraudDetectionColor' },
  transactionMonitor: { icon: materialIconMappings.transactionMonitor.icon, color: 'transactionMonitorColor' },
  antiMalware: { icon: materialIconMappings.antiMalware.icon, color: 'antiMalwareColor' },
  threatFeed: { icon: materialIconMappings.threatFeed.icon, color: 'threatFeedColor' },
  sandboxEnv: { icon: materialIconMappings.sandboxEnv.icon, color: 'sandboxEnvColor' },
  forensicsWorkstation: { icon: materialIconMappings.forensicsWorkstation.icon, color: 'forensicsWorkstationColor' },
  incidentResponse: { icon: materialIconMappings.incidentResponse.icon, color: 'incidentResponseColor' },
  cyberInsurance: { icon: materialIconMappings.cyberInsurance.icon, color: 'cyberInsuranceColor' },
  fraudAnalytics: { icon: materialIconMappings.fraudAnalytics.icon, color: 'fraudAnalyticsColor' },
  
  // Privacy & Data Protection  
  dataClassifier: { icon: materialIconMappings.dataClassifier.icon, color: 'dataClassifierColor' },
  consentManager: { icon: materialIconMappings.consentManager.icon, color: 'consentManagerColor' },
  dataMapper: { icon: materialIconMappings.dataMapper.icon, color: 'dataMapperColor' },
  privacyScanner: { icon: materialIconMappings.privacyScanner.icon, color: 'privacyScannerColor' },
  dataRetention: { icon: materialIconMappings.dataRetention.icon, color: 'dataRetentionColor' },
  dataAnonymizer: { icon: materialIconMappings.dataAnonymizer.icon, color: 'dataAnonymizerColor' },
  gdprCompliance: { icon: materialIconMappings.gdprCompliance.icon, color: 'gdprComplianceColor' },
  dataBreach: { icon: materialIconMappings.dataBreach.icon, color: 'dataBreachColor' },
  privacyImpact: { icon: materialIconMappings.privacyImpact.icon, color: 'privacyImpactColor' },
  dataSubjectRights: { icon: materialIconMappings.dataSubjectRights.icon, color: 'dataSubjectRightsColor' },
  
  // Application Architecture
  memoryPool: { icon: materialIconMappings.memoryPool.icon, color: 'memoryPoolColor' },
  executionContext: { icon: materialIconMappings.executionContext.icon, color: 'executionContextColor' },
  sessionStore: { icon: materialIconMappings.sessionStore.icon, color: 'sessionStoreColor' },
  inputBuffer: { icon: materialIconMappings.inputBuffer.icon, color: 'inputBufferColor' },
  outputBuffer: { icon: materialIconMappings.outputBuffer.icon, color: 'outputBufferColor' },
  configManager: { icon: materialIconMappings.configManager.icon, color: 'configManagerColor' },
  cryptoModule: { icon: materialIconMappings.cryptoModule.icon, color: 'cryptoModuleColor' },
  tokenValidator: { icon: materialIconMappings.tokenValidator.icon, color: 'tokenValidatorColor' },
  permissionEngine: { icon: materialIconMappings.permissionEngine.icon, color: 'permissionEngineColor' },
  auditLogger: { icon: materialIconMappings.auditLogger.icon, color: 'auditLoggerColor' },
  
  // Red Teaming
  attackBox: { icon: materialIconMappings.attackBox.icon, color: 'attackBoxColor' },
  payloadServer: { icon: materialIconMappings.payloadServer.icon, color: 'payloadServerColor' },
  c2Server: { icon: materialIconMappings.c2Server.icon, color: 'c2ServerColor' },
  implant: { icon: materialIconMappings.implant.icon, color: 'implantColor' },
  phishingServer: { icon: materialIconMappings.phishingServer.icon, color: 'phishingServerColor' },
  exfilChannel: { icon: materialIconMappings.exfilChannel.icon, color: 'exfilChannelColor' },
  pivotPoint: { icon: materialIconMappings.pivotPoint.icon, color: 'pivotPointColor' },
  credentialHarvester: { icon: materialIconMappings.credentialHarvester.icon, color: 'credentialHarvesterColor' },
  lateralMovement: { icon: materialIconMappings.lateralMovement.icon, color: 'lateralMovementColor' },
  persistenceMechanism: { icon: materialIconMappings.persistenceMechanism.icon, color: 'persistenceMechanismColor' },
  
  // Security Operations
  socWorkstation: { icon: materialIconMappings.socWorkstation.icon, color: 'socColor' },
  threatHuntingPlatform: { icon: materialIconMappings.threatHuntingPlatform.icon, color: 'huntingColor' },
  ctiFeed: { icon: materialIconMappings.ctiFeed.icon, color: 'ctiColor' },
  attackSurfaceMonitor: { icon: materialIconMappings.attackSurfaceMonitor.icon, color: 'asmColor' },
  deceptionToken: { icon: materialIconMappings.deceptionToken.icon, color: 'deceptionColor' },
  behaviorAnalytics: { icon: materialIconMappings.behaviorAnalytics.icon, color: 'uebaColor' },
  networkForensics: { icon: materialIconMappings.networkForensics.icon, color: 'forensicsColor' },
  malwareRepository: { icon: materialIconMappings.malwareRepository.icon, color: 'malwareColor' },
  indicatorStore: { icon: materialIconMappings.indicatorStore.icon, color: 'iocColor' },
  playbookEngine: { icon: materialIconMappings.playbookEngine.icon, color: 'playbookColor' },
  
  // Additional node types
  api: { icon: materialIconMappings.api.icon, color: 'apiColor' },
  service: { icon: materialIconMappings.service.icon, color: 'serviceColor' },
  cache: { icon: materialIconMappings.cache.icon, color: 'cacheColor' },
  storage: { icon: materialIconMappings.storage.icon, color: 'storageColor' },
  vault: { icon: materialIconMappings.vault.icon, color: 'vaultColor' },
  identity: { icon: materialIconMappings.identity.icon, color: 'identityColor' },
  logging: { icon: materialIconMappings.logging.icon, color: 'loggingColor' },
  dns: { icon: materialIconMappings.dns.icon, color: 'dnsColor' },
  dhcp: { icon: materialIconMappings.dhcp.icon, color: 'serverColor' },
  ntpServer: { icon: materialIconMappings.ntpServer.icon, color: 'serverColor' },
  proxyCache: { icon: materialIconMappings.proxyCache.icon, color: 'proxyColor' },
  gateway: { icon: materialIconMappings.gateway.icon, color: 'gatewayColor' },
  modem: { icon: materialIconMappings.modem.icon, color: 'gatewayColor' },
  networkBridge: { icon: materialIconMappings.networkBridge.icon, color: 'switchColor' },
  networkHub: { icon: materialIconMappings.networkHub.icon, color: 'switchColor' },
  voipPhone: { icon: materialIconMappings.voipPhone.icon, color: 'endpointColor' },
  pbx: { icon: materialIconMappings.pbx.icon, color: 'serverColor' },
  sipServer: { icon: materialIconMappings.sipServer.icon, color: 'serverColor' },
  conferenceSystem: { icon: materialIconMappings.conferenceSystem.icon, color: 'endpointColor' },
  san: { icon: materialIconMappings.san.icon, color: 'storageColor' },
  nas: { icon: materialIconMappings.nas.icon, color: 'storageColor' },
  storageArray: { icon: materialIconMappings.storageArray.icon, color: 'storageColor' },
  tapeLibrary: { icon: materialIconMappings.tapeLibrary.icon, color: 'storageColor' },
  ups: { icon: materialIconMappings.ups.icon, color: 'serverColor' },
  pdu: { icon: materialIconMappings.pdu.icon, color: 'serverColor' },
  hvac: { icon: materialIconMappings.hvac.icon, color: 'serverColor' },
  rackServer: { icon: materialIconMappings.rackServer.icon, color: 'serverColor' },
  bladeServer: { icon: materialIconMappings.bladeServer.icon, color: 'serverColor' },
  loadBalancerHw: { icon: materialIconMappings.loadBalancerHw.icon, color: 'loadBalancerColor' },
  wanOptimizer: { icon: materialIconMappings.wanOptimizer.icon, color: 'gatewayColor' },
  networkProbe: { icon: materialIconMappings.networkProbe.icon, color: 'monitorColor' },
  packetBroker: { icon: materialIconMappings.packetBroker.icon, color: 'switchColor' },
  fiberTerminal: { icon: materialIconMappings.fiberTerminal.icon, color: 'gatewayColor' },
  multiplexer: { icon: materialIconMappings.multiplexer.icon, color: 'switchColor' },
  mediaConverter: { icon: materialIconMappings.mediaConverter.icon, color: 'switchColor' },
  terminalServer: { icon: materialIconMappings.terminalServer.icon, color: 'serverColor' },
  cellTower: { icon: materialIconMappings.cellTower.icon, color: 'gatewayColor' },
  wirelessBridge: { icon: materialIconMappings.wirelessBridge.icon, color: 'switchColor' },
  meshNode: { icon: materialIconMappings.meshNode.icon, color: 'switchColor' },
  repeater: { icon: materialIconMappings.repeater.icon, color: 'switchColor' },
  edgeServer: { icon: materialIconMappings.edgeServer.icon, color: 'serverColor' },
  fogNode: { icon: materialIconMappings.fogNode.icon, color: 'serverColor' },
  microDatacenter: { icon: materialIconMappings.microDatacenter.icon, color: 'serverColor' },
  kvm: { icon: materialIconMappings.kvm.icon, color: 'switchColor' },
  serialConsole: { icon: materialIconMappings.serialConsole.icon, color: 'serverColor' },
  timeClock: { icon: materialIconMappings.timeClock.icon, color: 'endpointColor' },
  environmentSensor: { icon: materialIconMappings.environmentSensor.icon, color: 'sensorColor' },
  // Generic fallback node for unknown types
  generic: { icon: materialIconMappings.generic.icon, color: 'genericColor' },
  
  // DFD (Data Flow Diagram) nodes for STRIDE threat modeling
  dfdActor: { icon: materialIconMappings.user.icon, color: 'userColor' },
  dfdProcess: { icon: materialIconMappings.application.icon, color: 'applicationColor' },
  dfdDataStore: { icon: materialIconMappings.database.icon, color: 'databaseColor' },
  dfdTrustBoundary: { icon: materialIconMappings.securityZone?.icon || materialIconMappings.firewall.icon, color: 'firewallColor' },

  // AWS Services
  awsEC2: { icon: materialIconMappings.awsEC2.icon, color: 'awsComputeColor' },
  awsLambda: { icon: materialIconMappings.awsLambda.icon, color: 'awsComputeColor' },
  awsElasticBeanstalk: { icon: materialIconMappings.awsElasticBeanstalk.icon, color: 'awsComputeColor' },
  awsECS: { icon: materialIconMappings.awsECS.icon, color: 'awsComputeColor' },
  awsEKS: { icon: materialIconMappings.awsEKS.icon, color: 'awsComputeColor' },
  awsFargate: { icon: materialIconMappings.awsFargate.icon, color: 'awsComputeColor' },
  awsS3: { icon: materialIconMappings.awsS3.icon, color: 'awsStorageColor' },
  awsEBS: { icon: materialIconMappings.awsEBS.icon, color: 'awsStorageColor' },
  awsEFS: { icon: materialIconMappings.awsEFS.icon, color: 'awsStorageColor' },
  awsGlacier: { icon: materialIconMappings.storage.icon, color: 'awsStorageColor' },
  awsRDS: { icon: materialIconMappings.awsRDS.icon, color: 'awsDatabaseColor' },
  awsDynamoDB: { icon: materialIconMappings.awsDynamoDB.icon, color: 'awsDatabaseColor' },
  awsElastiCache: { icon: materialIconMappings.awsElastiCache.icon, color: 'awsDatabaseColor' },
  awsRedshift: { icon: materialIconMappings.database.icon, color: 'awsDatabaseColor' },
  awsAurora: { icon: materialIconMappings.database.icon, color: 'awsDatabaseColor' },
  awsVPC: { icon: materialIconMappings.awsVPC.icon, color: 'awsNetworkingColor' },
  awsCloudFront: { icon: materialIconMappings.awsCloudFront.icon, color: 'awsNetworkingColor' },
  awsRoute53: { icon: materialIconMappings.dns.icon, color: 'awsNetworkingColor' },
  awsDirectConnect: { icon: materialIconMappings.vpnGateway.icon, color: 'awsNetworkingColor' },
  awsTransitGateway: { icon: materialIconMappings.gateway.icon, color: 'awsNetworkingColor' },
  awsAPIGateway: { icon: materialIconMappings.awsAPIGateway.icon, color: 'awsNetworkingColor' },
  awsSNS: { icon: materialIconMappings.messageBroker.icon, color: 'awsComputeColor' },
  awsSQS: { icon: materialIconMappings.messageBroker.icon, color: 'awsComputeColor' },
  awsEventBridge: { icon: materialIconMappings.messageBroker.icon, color: 'awsComputeColor' },
  awsIAM: { icon: materialIconMappings.identityProvider.icon, color: 'awsSecurityColor' },
  awsCognito: { icon: materialIconMappings.user.icon, color: 'awsSecurityColor' },
  awsSSO: { icon: materialIconMappings.sso.icon, color: 'awsSecurityColor' },
  awsSecretsManager: { icon: materialIconMappings.secretsManager.icon, color: 'awsSecurityColor' },
  awsKMS: { icon: materialIconMappings.kms.icon, color: 'awsSecurityColor' },
  awsACM: { icon: materialIconMappings.certificateAuthority.icon, color: 'awsSecurityColor' },
  awsDirectory: { icon: materialIconMappings.ldap.icon, color: 'awsSecurityColor' },
  awsGuardDuty: { icon: materialIconMappings.xdr.icon, color: 'awsSecurityColor' },
  awsSecurityHub: { icon: materialIconMappings.siem.icon, color: 'awsSecurityColor' },
  awsWAF: { icon: materialIconMappings.waf.icon, color: 'awsSecurityColor' },
  awsShield: { icon: materialIconMappings.ddosProtection.icon, color: 'awsSecurityColor' },
  awsInspector: { icon: materialIconMappings.vulnerabilityScanner.icon, color: 'awsSecurityColor' },
  awsDetective: { icon: materialIconMappings.forensicsStation.icon, color: 'awsSecurityColor' },
  awsFirewallManager: { icon: materialIconMappings.firewall.icon, color: 'awsSecurityColor' },
  awsNetworkFirewall: { icon: materialIconMappings.firewall.icon, color: 'awsSecurityColor' },
  awsConfig: { icon: materialIconMappings.configManagement.icon, color: 'awsSecurityColor' },
  awsCloudTrail: { icon: materialIconMappings.logging.icon, color: 'awsSecurityColor' },
  awsCloudWatch: { icon: materialIconMappings.monitor.icon, color: 'awsSecurityColor' },
  awsMacie: { icon: materialIconMappings.dlp.icon, color: 'awsSecurityColor' },
  awsSecurityLake: { icon: materialIconMappings.dataLake.icon, color: 'awsSecurityColor' },
  awsAccessAnalyzer: { icon: materialIconMappings.identityGovernance.icon, color: 'awsSecurityColor' },
  awsCodePipeline: { icon: materialIconMappings.cicdSecurity.icon, color: 'awsComputeColor' },
  awsCodeBuild: { icon: materialIconMappings.cicdSecurity.icon, color: 'awsComputeColor' },
  awsCodeDeploy: { icon: materialIconMappings.cicdSecurity.icon, color: 'awsComputeColor' },
  awsCodeCommit: { icon: materialIconMappings.codeRepository.icon, color: 'awsComputeColor' },
  awsXRay: { icon: materialIconMappings.monitor.icon, color: 'awsSecurityColor' },
  awsCloudWatchLogs: { icon: materialIconMappings.logging.icon, color: 'awsSecurityColor' },

  // Azure Services
  azureVM: { icon: materialIconMappings.azureVM.icon, color: 'azureComputeColor' },
  azureAppService: { icon: materialIconMappings.azureAppService.icon, color: 'azureComputeColor' },
  azureFunctions: { icon: materialIconMappings.azureFunctions.icon, color: 'azureComputeColor' },
  azureKubernetesService: { icon: materialIconMappings.azureKubernetesService.icon, color: 'azureComputeColor' },
  azureContainerInstances: { icon: materialIconMappings.azureContainerInstances.icon, color: 'azureComputeColor' },
  azureContainerApps: { icon: materialIconMappings.application.icon, color: 'azureComputeColor' },
  azureBatch: { icon: materialIconMappings.application.icon, color: 'azureComputeColor' },
  azureBlobStorage: { icon: materialIconMappings.azureBlobStorage.icon, color: 'azureStorageColor' },
  azureFileStorage: { icon: materialIconMappings.azureFileStorage.icon, color: 'azureStorageColor' },
  azureManagedDisks: { icon: materialIconMappings.azureManagedDisks.icon, color: 'azureStorageColor' },
  azureStorage: { icon: materialIconMappings.azureStorage.icon, color: 'azureStorageColor' },
  azureDataLakeStorage: { icon: materialIconMappings.dataLake.icon, color: 'azureStorageColor' },
  azureSQLDatabase: { icon: materialIconMappings.azureSQLDatabase.icon, color: 'azureDatabaseColor' },
  azureCosmosDB: { icon: materialIconMappings.azureCosmosDB.icon, color: 'azureDatabaseColor' },
  azureRedisCache: { icon: materialIconMappings.azureRedisCache.icon, color: 'azureDatabaseColor' },
  azureSynapseAnalytics: { icon: materialIconMappings.database.icon, color: 'azureDatabaseColor' },
  azureDatabaseForPostgreSQL: { icon: materialIconMappings.database.icon, color: 'azureDatabaseColor' },
  azureDatabaseForMySQL: { icon: materialIconMappings.database.icon, color: 'azureDatabaseColor' },
  azureVirtualNetwork: { icon: materialIconMappings.azureVirtualNetwork.icon, color: 'azureNetworkingColor' },
  azureLoadBalancer: { icon: materialIconMappings.azureLoadBalancer.icon, color: 'azureNetworkingColor' },
  azureApplicationGateway: { icon: materialIconMappings.azureApplicationGateway.icon, color: 'azureNetworkingColor' },
  azureFrontDoor: { icon: materialIconMappings.azureFrontDoor.icon, color: 'azureNetworkingColor' },
  azureVPNGateway: { icon: materialIconMappings.vpnGateway.icon, color: 'azureNetworkingColor' },
  azureExpressRoute: { icon: materialIconMappings.router.icon, color: 'azureNetworkingColor' },
  azureTrafficManager: { icon: materialIconMappings.loadBalancer.icon, color: 'azureNetworkingColor' },
  azureDNS: { icon: materialIconMappings.dns.icon, color: 'azureNetworkingColor' },
  azureActiveDirectory: { icon: materialIconMappings.azureActiveDirectory.icon, color: 'azureIdentityColor' },
  azureADB2C: { icon: materialIconMappings.user.icon, color: 'azureIdentityColor' },
  azureManagedIdentity: { icon: materialIconMappings.identityProvider.icon, color: 'azureIdentityColor' },
  azureKeyVault: { icon: materialIconMappings.azureKeyVault.icon, color: 'azureSecurityColor' },
  azureInformationProtection: { icon: materialIconMappings.dlp.icon, color: 'azureSecurityColor' },
  azurePrivilegedIdentityManagement: { icon: materialIconMappings.pam.icon, color: 'azureSecurityColor' },
  azureSecurityCenter: { icon: materialIconMappings.siem.icon, color: 'azureSecurityColor' },
  azureSentinel: { icon: materialIconMappings.siem.icon, color: 'azureSecurityColor' },
  azureDefender: { icon: materialIconMappings.xdr.icon, color: 'azureSecurityColor' },
  azureFirewall: { icon: materialIconMappings.firewall.icon, color: 'azureSecurityColor' },
  azureDDoSProtection: { icon: materialIconMappings.ddosProtection.icon, color: 'azureSecurityColor' },
  azureBastion: { icon: materialIconMappings.bastionHost.icon, color: 'azureSecurityColor' },
  azurePrivateLink: { icon: materialIconMappings.vpnGateway.icon, color: 'azureSecurityColor' },
  azurePolicy: { icon: materialIconMappings.policyAsCode.icon, color: 'azureSecurityColor' },
  azureBlueprints: { icon: materialIconMappings.infrastructureAsCode.icon, color: 'azureSecurityColor' },
  azureArc: { icon: materialIconMappings.cloudService.icon, color: 'azureSecurityColor' },
  azureMonitor: { icon: materialIconMappings.azureMonitor.icon, color: 'azureSecurityColor' },
  azureLogAnalytics: { icon: materialIconMappings.logging.icon, color: 'azureSecurityColor' },
  azureApplicationInsights: { icon: materialIconMappings.monitor.icon, color: 'azureSecurityColor' },
  azureAutomation: { icon: materialIconMappings.cicdSecurity.icon, color: 'azureSecurityColor' },
  azureDevOps: { icon: materialIconMappings.cicdSecurity.icon, color: 'azureComputeColor' },
  azureArtifacts: { icon: materialIconMappings.containerRegistry.icon, color: 'azureComputeColor' },
  azurePipelines: { icon: materialIconMappings.cicdSecurity.icon, color: 'azureComputeColor' },

  // GCP Services
  gcpComputeEngine: { icon: materialIconMappings.gcpComputeEngine.icon, color: 'gcpComputeColor' },
  gcpAppEngine: { icon: materialIconMappings.gcpAppEngine.icon, color: 'gcpComputeColor' },
  gcpCloudFunctions: { icon: materialIconMappings.gcpCloudFunctions.icon, color: 'gcpComputeColor' },
  gcpCloudRun: { icon: materialIconMappings.gcpCloudRun.icon, color: 'gcpComputeColor' },
  gcpGKE: { icon: materialIconMappings.gcpGKE.icon, color: 'gcpComputeColor' },
  gcpBatch: { icon: materialIconMappings.application.icon, color: 'gcpComputeColor' },
  gcpCloudStorage: { icon: materialIconMappings.gcpCloudStorage.icon, color: 'gcpStorageColor' },
  gcpPersistentDisk: { icon: materialIconMappings.gcpPersistentDisk.icon, color: 'gcpStorageColor' },
  gcpFilestore: { icon: materialIconMappings.storage.icon, color: 'gcpStorageColor' },
  gcpContainerRegistry: { icon: materialIconMappings.gcpContainerRegistry.icon, color: 'gcpComputeColor' },
  gcpArtifactRegistry: { icon: materialIconMappings.containerRegistry.icon, color: 'gcpComputeColor' },
  gcpCloudSQL: { icon: materialIconMappings.gcpCloudSQL.icon, color: 'gcpDatabaseColor' },
  gcpFirestore: { icon: materialIconMappings.gcpFirestore.icon, color: 'gcpDatabaseColor' },
  gcpBigQuery: { icon: materialIconMappings.gcpBigQuery.icon, color: 'gcpDatabaseColor' },
  gcpBigtable: { icon: materialIconMappings.gcpBigtable.icon, color: 'gcpDatabaseColor' },
  gcpSpanner: { icon: materialIconMappings.database.icon, color: 'gcpDatabaseColor' },
  gcpMemorystore: { icon: materialIconMappings.cache.icon, color: 'gcpDatabaseColor' },
  gcpVPC: { icon: materialIconMappings.gcpVPC.icon, color: 'gcpNetworkingColor' },
  gcpCloudLoadBalancing: { icon: materialIconMappings.gcpCloudLoadBalancing.icon, color: 'gcpNetworkingColor' },
  gcpCloudCDN: { icon: materialIconMappings.cloudService.icon, color: 'gcpNetworkingColor' },
  gcpCloudDNS: { icon: materialIconMappings.dns.icon, color: 'gcpNetworkingColor' },
  gcpCloudVPN: { icon: materialIconMappings.vpnGateway.icon, color: 'gcpNetworkingColor' },
  gcpCloudInterconnect: { icon: materialIconMappings.router.icon, color: 'gcpNetworkingColor' },
  gcpCloudArmor: { icon: materialIconMappings.waf.icon, color: 'gcpSecurityColor' },
  gcpIAM: { icon: materialIconMappings.identityProvider.icon, color: 'gcpSecurityColor' },
  gcpIdentityPlatform: { icon: materialIconMappings.user.icon, color: 'gcpSecurityColor' },
  gcpCloudIdentity: { icon: materialIconMappings.identityProvider.icon, color: 'gcpSecurityColor' },
  gcpSecretManager: { icon: materialIconMappings.secretsManager.icon, color: 'gcpSecurityColor' },
  gcpCloudKMS: { icon: materialIconMappings.kms.icon, color: 'gcpSecurityColor' },
  gcpCertificateAuthority: { icon: materialIconMappings.certificateAuthority.icon, color: 'gcpSecurityColor' },
  gcpSecurityCommandCenter: { icon: materialIconMappings.siem.icon, color: 'gcpSecurityColor' },
  gcpWebSecurityScanner: { icon: materialIconMappings.vulnerabilityScanner.icon, color: 'gcpSecurityColor' },
  gcpCloudIDS: { icon: materialIconMappings.ids.icon, color: 'gcpSecurityColor' },
  gcpBinaryAuthorization: { icon: materialIconMappings.containerScanner.icon, color: 'gcpSecurityColor' },
  gcpContainerAnalysis: { icon: materialIconMappings.containerScanner.icon, color: 'gcpSecurityColor' },
  gcpCloudDLP: { icon: materialIconMappings.dlp.icon, color: 'gcpSecurityColor' },
  gcpVPCServiceControls: { icon: materialIconMappings.firewall.icon, color: 'gcpSecurityColor' },
  gcpAccessContextManager: { icon: materialIconMappings.identityGovernance.icon, color: 'gcpSecurityColor' },
  gcpPolicyIntelligence: { icon: materialIconMappings.policyAsCode.icon, color: 'gcpSecurityColor' },
  gcpVertexAI: { icon: materialIconMappings.gcpVertexAI.icon, color: 'gcpDatabaseColor' },
  gcpAutoML: { icon: materialIconMappings.aiModel.icon, color: 'gcpDatabaseColor' },
  gcpAIPlatform: { icon: materialIconMappings.aiModel.icon, color: 'gcpDatabaseColor' },
  gcpCloudMonitoring: { icon: materialIconMappings.monitor.icon, color: 'gcpSecurityColor' },
  gcpCloudLogging: { icon: materialIconMappings.logging.icon, color: 'gcpSecurityColor' },
  gcpCloudTrace: { icon: materialIconMappings.monitor.icon, color: 'gcpSecurityColor' },
  gcpCloudProfiler: { icon: materialIconMappings.monitor.icon, color: 'gcpSecurityColor' },
  gcpCloudBuild: { icon: materialIconMappings.cicdSecurity.icon, color: 'gcpComputeColor' },
  gcpCloudDeploy: { icon: materialIconMappings.cicdSecurity.icon, color: 'gcpComputeColor' },
  gcpCloudSourceRepositories: { icon: materialIconMappings.codeRepository.icon, color: 'gcpComputeColor' },

  // IBM Cloud Services
  ibmVirtualServer: { icon: materialIconMappings.ibmVirtualServer.icon, color: 'ibmComputeColor' },
  ibmBareMetalServer: { icon: materialIconMappings.server.icon, color: 'ibmComputeColor' },
  ibmCodeEngine: { icon: materialIconMappings.application.icon, color: 'ibmComputeColor' },
  ibmCloudFunctions: { icon: materialIconMappings.functionApp.icon, color: 'ibmComputeColor' },
  ibmKubernetes: { icon: materialIconMappings.kubernetesPod.icon, color: 'ibmComputeColor' },
  ibmRedHatOpenShift: { icon: materialIconMappings.kubernetesPod.icon, color: 'ibmComputeColor' },
  ibmObjectStorage: { icon: materialIconMappings.ibmObjectStorage.icon, color: 'ibmStorageColor' },
  ibmBlockStorage: { icon: materialIconMappings.storage.icon, color: 'ibmStorageColor' },
  ibmFileStorage: { icon: materialIconMappings.storage.icon, color: 'ibmStorageColor' },
  ibmDatabase: { icon: materialIconMappings.ibmDatabase.icon, color: 'ibmDatabaseColor' },
  ibmCloudant: { icon: materialIconMappings.database.icon, color: 'ibmDatabaseColor' },
  ibmDB2: { icon: materialIconMappings.database.icon, color: 'ibmDatabaseColor' },
  ibmDatabases: { icon: materialIconMappings.database.icon, color: 'ibmDatabaseColor' },
  ibmVPC: { icon: materialIconMappings.ibmVPC.icon, color: 'ibmNetworkingColor' },
  ibmLoadBalancer: { icon: materialIconMappings.loadBalancer.icon, color: 'ibmNetworkingColor' },
  ibmCloudInternetServices: { icon: materialIconMappings.cloudService.icon, color: 'ibmNetworkingColor' },
  ibmDirectLink: { icon: materialIconMappings.router.icon, color: 'ibmNetworkingColor' },
  ibmTransitGateway: { icon: materialIconMappings.gateway.icon, color: 'ibmNetworkingColor' },
  ibmCloudIAM: { icon: materialIconMappings.identityProvider.icon, color: 'ibmSecurityColor' },
  ibmAppID: { icon: materialIconMappings.user.icon, color: 'ibmSecurityColor' },
  ibmKeyProtect: { icon: materialIconMappings.kms.icon, color: 'ibmSecurityColor' },
  ibmSecretsManager: { icon: materialIconMappings.secretsManager.icon, color: 'ibmSecurityColor' },
  ibmSecurityGateway: { icon: materialIconMappings.ibmSecurityGateway.icon, color: 'ibmSecurityColor' },
  ibmSecurityAdvisor: { icon: materialIconMappings.siem.icon, color: 'ibmSecurityColor' },
  ibmCertificateManager: { icon: materialIconMappings.certificateAuthority.icon, color: 'ibmSecurityColor' },
  ibmHyperProtect: { icon: materialIconMappings.hsm.icon, color: 'ibmSecurityColor' },
  ibmCloudFirewall: { icon: materialIconMappings.firewall.icon, color: 'ibmSecurityColor' },
  ibmCloudMonitoring: { icon: materialIconMappings.monitor.icon, color: 'ibmMonitoringColor' },
  ibmLogAnalysis: { icon: materialIconMappings.logging.icon, color: 'ibmMonitoringColor' },
  ibmActivityTracker: { icon: materialIconMappings.logging.icon, color: 'ibmMonitoringColor' },
  ibmWatsonStudio: { icon: materialIconMappings.aiModel.icon, color: 'ibmAIColor' },
  ibmWatsonAssistant: { icon: materialIconMappings.aiModel.icon, color: 'ibmAIColor' },
  ibmWatsonDiscovery: { icon: materialIconMappings.aiModel.icon, color: 'ibmAIColor' },
  ibmContinuousDelivery: { icon: materialIconMappings.cicdSecurity.icon, color: 'ibmDevOpsColor' },
  ibmCloudShell: { icon: materialIconMappings.server.icon, color: 'ibmDevOpsColor' }
};

// Default security zones mapping (for future use)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _defaultSecurityZones: Record<string, SecurityZone> = {
  // Infrastructure
  server: 'Internal',
  workstation: 'Internal',
  printer: 'Internal',
  router: 'DMZ',
  switch: 'Internal',
  firewall: 'DMZ',
  vpnGateway: 'DMZ',
  ids: 'DMZ',
  waf: 'DMZ',
  
  // Applications
  application: 'Internal',
  database: 'Restricted',
  loadBalancer: 'DMZ',
  reverseProxy: 'DMZ',
  apiGateway: 'DMZ',
  webServer: 'DMZ',
  authServer: 'Internal',
  messageBroker: 'Internal',
  
  // Cloud
  cloudService: 'Cloud',
  containerRegistry: 'Cloud',
  kubernetesPod: 'Cloud',
  kubernetesService: 'Cloud',
  storageAccount: 'Cloud',
  functionApp: 'Cloud',
  apiManagement: 'Cloud',
  cloudLoadBalancer: 'Cloud',
  cloudFirewall: 'Cloud',
  cloudDatabase: 'Cloud',
  
  // OT/SCADA
  plc: 'OT',
  hmi: 'OT',
  historian: 'DMZ',
  rtu: 'OT',
  sensor: 'OT',
  actuator: 'OT',
  scadaServer: 'OT',
  industrialFirewall: 'OT',
  safetySystem: 'OT',
  industrialNetwork: 'OT',
  
  // AI/ML
  aiGateway: 'DMZ',
  inferenceEngine: 'Internal',
  modelRegistry: 'Internal',
  aiWorkbench: 'Internal',
  mlPipeline: 'Internal',
  aiModel: 'Restricted',
  vectorDatabase: 'Restricted',
  dataLake: 'Restricted',
  featureStore: 'Restricted',
  llmService: 'Restricted',
  
  // Generic node
  generic: 'Internal'
};

// Add this after nodeTypeConfig declaration
interface NodeSecurityDefaults {
  zone: SecurityZone;
  dataClassification: DataClassification;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _nodeSecurityDefaults: Record<string, NodeSecurityDefaults> = {
  // Infrastructure
  server: {
    zone: 'Internal',

    dataClassification: 'Internal'
  },
  workstation: {
    zone: 'Internal',

    dataClassification: 'Internal'
  },
  printer: {
    zone: 'Internal',

    dataClassification: 'Internal'
  },
  router: {
    zone: 'DMZ',

    dataClassification: 'Internal'
  },
  switch: {
    zone: 'Internal',

    dataClassification: 'Internal'
  },
  firewall: {
    zone: 'DMZ',

    dataClassification: 'Internal'
  },
  vpnGateway: {
    zone: 'DMZ',

    dataClassification: 'Internal'
  },
  ids: {
    zone: 'DMZ',

    dataClassification: 'Internal'
  },
  waf: {
    zone: 'DMZ',

    dataClassification: 'Internal'
  },

  // Applications
  application: {
    zone: 'Internal',

    dataClassification: 'Internal'
  },
  database: {
    zone: 'Restricted',

    dataClassification: 'Confidential'
  },
  loadBalancer: {
    zone: 'DMZ',

    dataClassification: 'Internal'
  },
  reverseProxy: {
    zone: 'DMZ',

    dataClassification: 'Internal'
  },
  apiGateway: {
    zone: 'DMZ',

    dataClassification: 'Internal'
  },
  webServer: {
    zone: 'DMZ',

    dataClassification: 'Internal'
  },
  authServer: {
    zone: 'Internal',

    dataClassification: 'Confidential'
  },
  messageBroker: {
    zone: 'Internal',

    dataClassification: 'Internal'
  },

  // Cloud
  cloudService: {
    zone: 'Cloud',

    dataClassification: 'Internal'
  },
  containerRegistry: {
    zone: 'Cloud',

    dataClassification: 'Internal'
  },
  kubernetesPod: {
    zone: 'Cloud',

    dataClassification: 'Internal'
  },
  kubernetesService: {
    zone: 'Cloud',

    dataClassification: 'Internal'
  },
  storageAccount: {
    zone: 'Cloud',

    dataClassification: 'Confidential'
  },
  functionApp: {
    zone: 'Cloud',

    dataClassification: 'Internal'
  },
  apiManagement: {
    zone: 'Cloud',

    dataClassification: 'Internal'
  },
  cloudLoadBalancer: {
    zone: 'Cloud',

    dataClassification: 'Internal'
  },
  cloudFirewall: {
    zone: 'Cloud',

    dataClassification: 'Internal'
  },
  cloudDatabase: {
    zone: 'Cloud',

    dataClassification: 'Confidential'
  },

  // OT/SCADA
  plc: {
    zone: 'OT',

    dataClassification: 'Confidential'
  },
  hmi: {
    zone: 'OT',

    dataClassification: 'Internal'
  },
  historian: {
    zone: 'DMZ',

    dataClassification: 'Internal'
  },
  rtu: {
    zone: 'OT',

    dataClassification: 'Confidential'
  },
  sensor: {
    zone: 'OT',

    dataClassification: 'Internal'
  },
  actuator: {
    zone: 'OT',

    dataClassification: 'Confidential'
  },
  scadaServer: {
    zone: 'OT',

    dataClassification: 'Confidential'
  },
  industrialFirewall: {
    zone: 'OT',

    dataClassification: 'Internal'
  },
  safetySystem: {
    zone: 'OT',

    dataClassification: 'Confidential'
  },
  industrialNetwork: {
    zone: 'OT',

    dataClassification: 'Confidential'
  },

  // AI/ML
  aiGateway: {
    zone: 'DMZ',

    dataClassification: 'Internal'
  },
  inferenceEngine: {
    zone: 'Internal',

    dataClassification: 'Sensitive'
  },
  modelRegistry: {
    zone: 'Internal',

    dataClassification: 'Sensitive'
  },
  aiWorkbench: {
    zone: 'Internal',

    dataClassification: 'Internal'
  },
  mlPipeline: {
    zone: 'Internal',

    dataClassification: 'Sensitive'
  },
  aiModel: {
    zone: 'Restricted',

    dataClassification: 'Confidential'
  },
  vectorDatabase: {
    zone: 'Restricted',

    dataClassification: 'Confidential'
  },
  dataLake: {
    zone: 'Restricted',

    dataClassification: 'Confidential'
  },
  featureStore: {
    zone: 'Restricted',

    dataClassification: 'Sensitive'
  },
  llmService: {
    zone: 'Restricted',

    dataClassification: 'Confidential'
  },
  
  // Generic fallback node
  generic: {
    zone: 'Internal',

    dataClassification: 'Internal'
  }
};

const getNodeStyle = (selected: boolean, bgColor: string = colors.nodeBg, textColor: string = colors.textPrimary, useCustomShape: boolean = false, nodeShape: NodeShape = 'rounded-rectangle', scale: number = 1.0, borderColor: string = colors.textPrimary) => {
  const baseWidth = nodeDefaults.nodeWidth * scale;
  const baseHeight = nodeDefaults.nodeWidth * 0.6 * scale;
  
  // Get the proper bounding box for the shape
  const boundingBox = getShapeBoundingBox(nodeShape, baseWidth, baseHeight);
  
  return {
    padding: nodeDefaults.padding,
    background: useCustomShape ? 'transparent' : bgColor, // Use original background for default shape
    borderColor: useCustomShape ? 'transparent' : borderColor, // Set border color for default shape
    width: boundingBox.width,
    height: boundingBox.height,
    color: textColor,
    fontSize: '13px',
    transform: selected ? 'scale(1.05) translateY(-2px)' : 'scale(1)',
    willChange: selected ? 'transform' : 'auto',
    cursor: 'move',
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
  };
};

const getHandleStyle = (color: string, selected: boolean, theme: any) => {
  return {
    width: '14px',
    height: '14px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '50%', // keep circle hit-area
    cursor: 'crosshair',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 10,
    // Opacity handled via CSS hover/selected rules
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'auto' as const,
  };
};

const NodeComponent = React.memo(({ id: nodeId, data, selected, color, type }: SecurityNodeProps & { 
  color: string;
  type: SecurityNodeType;
}) => {
  const theme = useTheme();
  const { settings } = useSettings();
  const { hasFindingsForNode } = useManualAnalysis();
  const currentTheme = getTheme(settings.theme, settings.customTheme);
  const hasManualFinding = hasFindingsForNode(nodeId);
  const { pathNodeSteps, pathActive } = useDiagramLens();
  const lensPathStep = pathNodeSteps.get(nodeId);
  const dimmedByPath = pathActive && lensPathStep === undefined;
  
  // Memoize color calculations
  const { nodeColor, nodeBgColor, zoneColor } = useMemo(() => {
    const typeColor = settings.themeAwareNodeColors ? currentTheme.colors.primary : color;
    const nbg = settings.themeAwareNodeColors ? currentTheme.colors.surface : currentTheme.colors.nodeBg;
    // Get zone color for selected state
    const zc = data.zone ? colors.zoneColors[data.zone] : typeColor;
    // Node color: use zone color when selected, otherwise use type color
    const nc = selected ? zc : typeColor;
    return { nodeColor: nc, nodeBgColor: nbg, zoneColor: zc };
  }, [settings.themeAwareNodeColors, currentTheme.colors.primary, currentTheme.colors.surface,
      currentTheme.colors.nodeBg, color, data.zone, selected]);

  // Just use the index code from data - it's already correct!
  const code = data.indexCode || 'NO-CODE';

  // Get the node shape
  const nodeShape = data.shape || DEFAULT_NODE_SHAPE;
  const useCustomShape = nodeShape !== 'rounded-rectangle'; // Only use shape component for non-default shapes
  // Ensure minimum scale of 1.0 so shapes are at least as big as default
  const shapeScale = Math.max(shapeMetadata[nodeShape]?.defaultScale || 1.0, 1.0);

  // Memoize node style
  const nodeStyle = useMemo(() => 
    getNodeStyle(selected, nodeBgColor, currentTheme.colors.textPrimary, useCustomShape, nodeShape, shapeScale, nodeColor),
    [selected, nodeBgColor, currentTheme.colors.textPrimary, useCustomShape, nodeShape, shapeScale, nodeColor]
  );

  // Memoize handle style
  const handleStyle = useMemo(() => 
    getHandleStyle(zoneColor, selected, theme),
    [zoneColor, selected, theme]
  );

  // Check if we're in drawing edit mode
  const isDrawingEditMode = (data as any).isDrawingEditMode || false;

  // Document theme: render printable DFD notation instead of icon nodes.
  // (Placed after all hooks to keep hook order stable across theme switches.)
  if (currentTheme.documentStyle) {
    return (
      <DfdDocumentNode
        nodeId={nodeId}
        data={data}
        selected={selected}
        type={type}
        theme={currentTheme}
        isDrawingEditMode={isDrawingEditMode}
      />
    );
  }

  return (
    <div 
      className={`modern-node ${selected ? 'selected' : ''} ${hasManualFinding ? 'manual-analysis-flag' : ''}`}
      style={{
        ...nodeStyle,
        position: 'relative',
        zIndex: 10, // Above drawing nodes (1) and zones (-1)
        ...(dimmedByPath ? { opacity: 0.35, transition: 'opacity 0.2s ease' } : {}),
        // Override CSS when using custom shapes
        ...(useCustomShape ? {
          borderRadius: 0,
          border: 'none',
          boxShadow: 'none'
        } : {}),
        // Disable interaction in drawing edit mode
        ...(isDrawingEditMode ? {
          pointerEvents: 'none',
          opacity: 0.7,
          cursor: 'not-allowed'
        } : {})
      }}>
      {/* Attack path lens: numbered step marker */}
      {pathActive && lensPathStep !== undefined && (
        <div
          style={{
            position: 'absolute',
            top: -11,
            left: -11,
            width: 22,
            height: 22,
            borderRadius: '50%',
            backgroundColor: (currentTheme.colors as any).scopeHighlight || '#990099',
            color: '#ffffff',
            fontSize: 12,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            zIndex: 20
          }}
        >
          {lensPathStep}
        </div>
      )}
      {/* Shape background - only render for custom shapes */}
      {useCustomShape && (
        <div style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          // Scale up certain shapes to compensate for reduced bounding box
          ...((nodeShape === 'star' || nodeShape === 'pentagon' || nodeShape === 'octagon') ? {
            transform: 
              nodeShape === 'star' ? 'scale(1.18)' : // 1/0.85 uniform scale for star
              'scale(1.18)', // 1/0.85 for pentagon/octagon
            transformOrigin: 'center'
          } : {})
        }}>
          <Shape
            type={nodeShape}
            width={nodeStyle.width}
            height={nodeStyle.height}
            fill={nodeBgColor}
            stroke={nodeColor}
            strokeWidth={2}
            fillOpacity={0.95}
            style={{
              filter: selected ? `drop-shadow(0 0 8px ${nodeColor}40)` : 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
            }}
          />
        </div>
      )}
      
      {/* Simplified Handles - Both source and target on each side */}
      <Handle 
        type="target" 
        position={Position.Top}
        id="top"
        className="modern-handle"
        style={{...handleStyle, left: '50%', top: -6}}
      />
      <Handle 
        type="source" 
        position={Position.Top}
        id="top"
        className="modern-handle"
        style={{...handleStyle, left: '50%', top: -6}}
      >
        {/* Cable icon overlay */}
        <Cable
          sx={{
            fontSize: '10px',
            color: '#ffffff',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none'
          }}
        />
      </Handle>
  
      <Handle 
        type="target" 
        position={Position.Right}
        id="right"
        className="modern-handle"
        style={{...handleStyle, top: '50%', right: -6}}
      />
      <Handle 
        type="source" 
        position={Position.Right}
        id="right"
        className="modern-handle"
        style={{...handleStyle, top: '50%', right: -6}}
      >
        {/* Cable icon overlay */}
        <Cable
          sx={{
            fontSize: '10px',
            color: '#ffffff',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(90deg)',
            pointerEvents: 'none'
          }}
        />
      </Handle>
  
      <Handle 
        type="target" 
        position={Position.Bottom}
        id="bottom"
        className="modern-handle"
        style={{...handleStyle, left: '50%', bottom: -6}}
      />
      <Handle 
        type="source" 
        position={Position.Bottom}
        id="bottom"
        className="modern-handle"
        style={{...handleStyle, left: '50%', bottom: -6}}
      >
        {/* Cable icon overlay */}
        <Cable
          sx={{
            fontSize: '10px',
            color: '#ffffff',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none'
          }}
        />
      </Handle>
  
      <Handle 
        type="target" 
        position={Position.Left}
        id="left"
        className="modern-handle"
        style={{...handleStyle, top: '50%', left: -6}}
      />
      <Handle 
        type="source" 
        position={Position.Left}
        id="left"
        className="modern-handle"
        style={{...handleStyle, top: '50%', left: -6}}
      >
        {/* Cable icon overlay */}
        <Cable
          sx={{
            fontSize: '10px',
            color: '#ffffff',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(90deg)',
            pointerEvents: 'none'
          }}
        />
      </Handle>
  
      <div className="modern-node-icon" style={{ 
        position: 'absolute', 
        top: '4px', // Move icon up (was 0.5rem = 8px)
        right: '8px',
        zIndex: 1 
      }}>
        {(() => {
          if (DEBUG_ICON_RENDER) console.log('SecurityNodes: Rendering icon for node:', {
            nodeId: nodeId,
            nodeType: type,
            dataIcon: data.icon,
            dataIconType: typeof data.icon,
            hasDataIcon: !!data.icon,
            defaultIcon: nodeTypeConfig[type]?.icon
          });
          
          // Determine which icon to use: custom icon from data, or default from nodeTypeConfig
          let iconToRender = data.icon;
          
          // If no custom icon, use the default from nodeTypeConfig
          if (!iconToRender) {
            if (DEBUG_ICON_RENDER) console.log('SecurityNodes: No custom icon, using default');
            iconToRender = nodeTypeConfig[type]?.icon;
          }
          
          // If iconToRender is a React component (function or memoized component), use it directly
          if (typeof iconToRender === 'function' || 
              (typeof iconToRender === 'object' && iconToRender !== null && iconToRender.$$typeof)) {
            if (DEBUG_ICON_RENDER) console.log('SecurityNodes: Icon is React component, rendering directly');
            return React.createElement(iconToRender, {
              sx: {
                fontSize: 20,
                color: 'currentColor'
              }
            });
          }
          
          // If iconToRender is something else (serialized), deserialize it
          if (DEBUG_ICON_RENDER) console.log('SecurityNodes: Icon needs deserialization');
          const deserializedIcon = deserializeIcon(iconToRender, type);
          return React.createElement(deserializedIcon, {
            sx: {
              fontSize: 20,
              color: 'currentColor'
            }
          });
        })()}
      </div>
      <div className="modern-node-content" style={{ 
        position: 'relative', 
        zIndex: 1,
        transform: `translate(${shapeMetadata[nodeShape]?.contentOffset?.x || 0}px, ${shapeMetadata[nodeShape]?.contentOffset?.y || 0}px)`
      }}>
        {/* DFD Node Type Badge - Visual indicator for DFD nodes */}
        {type.startsWith('dfd') && (
          <div
            style={{
              position: 'absolute',
              top: -20,
              left: 0,
              background: currentTheme.colors.info,
              color: 'white',
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '10px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              zIndex: 11
            }}
          >
            {type === 'dfdActor' && 'Actor'}
            {type === 'dfdProcess' && 'Process'}
            {type === 'dfdDataStore' && 'Store'}
            {type === 'dfdTrustBoundary' && 'Boundary'}
          </div>
        )}
        <div className="modern-node-label">
          {(() => {
            const label = data.label || type;
            const maxCharsPerLine = 18;
            
            // If label is short enough, return as-is with padding
            if (label.length <= maxCharsPerLine) {
              return <div style={{ paddingRight: '24px' }}>{label}</div>;
            }
            
            // Split into words
            const words = label.split(' ');
            const lines: string[] = [];
            let currentLine = '';
            
            words.forEach((word) => {
              // If adding this word would exceed the limit
              if (currentLine && (currentLine + ' ' + word).length > maxCharsPerLine) {
                // Push current line and start new one
                lines.push(currentLine);
                currentLine = word;
              } else {
                // Add word to current line
                currentLine = currentLine ? currentLine + ' ' + word : word;
              }
            });
            
            // Don't forget the last line
            if (currentLine) {
              lines.push(currentLine);
            }
            
            // Return lines as separate divs
            return lines.map((line, index) => (
              <div key={index} style={index === 0 ? { paddingRight: '24px' } : {}}>{line}</div>
            ));
          })()}
        </div>
        <div className="modern-node-code">
          {code}
        </div>
        {/* Threat Indicator Badge - Check both securityContext and additionalContext for persistence */}
        {(() => {
          const structuredThreats = data.securityContext?.threats ?? [];
          const hasStructuredThreats = structuredThreats.length > 0;
          
          // Helper function to extract threat count from additionalContext
          const getThreatCountFromContext = (additionalContext?: string): number => {
            if (!additionalContext) return 0;
            const threatMatch = additionalContext.match(/IDENTIFIED THREATS \((\d+)\)/);
            return threatMatch ? parseInt(threatMatch[1], 10) : 0;
          };
          
          // Helper function to get highest severity from additionalContext
          
          const contextThreatCount = getThreatCountFromContext(data.additionalContext);
          const shouldShowBadge = hasStructuredThreats || contextThreatCount > 0;
          
          if (!shouldShowBadge) return null;
          
          return (
            <div 
              className="modern-node-threat-badge"
              style={{
                position: 'absolute',
                top: -8,
                right: -8,
                // Use a single colour for all threat badges – keeps UI simple
                backgroundColor: currentTheme.colors.info,
                color: 'white',
                borderRadius: '50%',
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 'bold',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                zIndex: 10
              }}
              title={hasStructuredThreats 
                ? `${structuredThreats.length} threat${structuredThreats.length > 1 ? 's' : ''} identified`
                : `${contextThreatCount} threat${contextThreatCount > 1 ? 's' : ''} identified - view in editor for details`}
            >
              {hasStructuredThreats ? structuredThreats.length : contextThreatCount}
            </div>
          );
        })()}
        {data.zone && (
          <div 
            className="modern-node-badge"
            style={{
              backgroundColor: `${zoneColor}20`,
              color: zoneColor,
              borderColor: `${zoneColor}40`
            }}
          >
            {data.zone}
          </div>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Fast comparison - avoid expensive JSON.stringify
  if (
    prevProps.id !== nextProps.id ||
    prevProps.selected !== nextProps.selected ||
    prevProps.color !== nextProps.color ||
    prevProps.type !== nextProps.type
  ) {
    return false;
  }

  // Check icon reference
  if ((prevProps.data as any).icon !== (nextProps.data as any).icon) {
    return false;
  }

  // Compare data properties efficiently without JSON.stringify
  const prevData = prevProps.data;
  const nextData = nextProps.data;
  
  // Compare essential properties only
  return (
    prevData.label === nextData.label &&
    prevData.zone === nextData.zone &&
    prevData.indexCode === nextData.indexCode &&
    prevData.dataClassification === nextData.dataClassification &&
    prevData.vendor === nextData.vendor &&
    prevData.version === nextData.version &&
    prevData.technology === nextData.technology &&
    prevData.shape === nextData.shape && // Check shape changes
    // Compare array lengths for performance-critical arrays
    (prevData.protocols?.length || 0) === (nextData.protocols?.length || 0) &&
    (prevData.securityControls?.length || 0) === (nextData.securityControls?.length || 0) &&
    // Compare threat counts instead of full comparison
    (prevData.securityContext?.threats?.length || 0) === (nextData.securityContext?.threats?.length || 0) &&
    prevData.additionalContext === nextData.additionalContext
  );
});

// Create an object to hold all node components
const NodeComponents: Record<string, React.FC<SecurityNodeProps>> = {};

// Generate all node components
Object.entries(nodeTypeConfig).forEach(([nodeType, config]) => {
  const componentName = nodeType.charAt(0).toUpperCase() + nodeType.slice(1) + 'Node';
  NodeComponents[componentName] = React.memo((props: SecurityNodeProps) => (
    <NodeComponent 
      {...props}
      type={nodeType as SecurityNodeType}
      color={colors[config.color] as string} // Cast the color to string
      data={props.data}  // Pass data as-is, let NodeComponent handle icon logic
    />
  ));
});

// Automatically export all generated components
// This ensures any new nodes added to nodeTypeConfig are automatically available
export const SecurityNodes = NodeComponents;

// Export all components
export const {
  // Infrastructure
  ServerNode,
  UserNode,
  WorkstationNode,
  PrinterNode,
  RouterNode,
  SwitchNode,
  FirewallNode,
  VpnGatewayNode,
  IdsNode,
  IpsNode,
  WafNode,
  
  // Security Operations & Analytics
  SiemNode,
  SoarNode,
  XdrNode,
  EdrNode,
  NdrNode,
  
  // Cloud Security
  CasbNode,
  SaseNode,
  ZtnaNode,
  
  // Data Protection
  DlpNode,
  DamNode,
  PamNode,
  HsmNode,
  KmsNode,
  SecretsManagerNode,
  CertificateAuthorityNode,
  
  // Identity & Access
  MfaNode,
  SsoNode,
  LdapNode,
  RadiusServerNode,
  
  // Threat Detection
  HoneypotNode,
  HoneynetNode,
  DeceptionSystemNode,
  NetworkTapNode,
  PacketCaptureNode,
  
  // Vulnerability Management
  VulnerabilityScannerNode,
  PatchManagementNode,
  ConfigManagementNode,
  ComplianceScannerNode,
  PenTestToolNode,
  StaticAnalysisNode,
  DynamicAnalysisNode,
  ContainerScannerNode,
  K8sAdmissionControllerNode,
  MeshProxyNode,
  
  // API & Application Security
  ApiSecurityNode,
  BotProtectionNode,
  DdosProtectionNode,
  EmailSecurityNode,
  WebFilterNode,
  
  // Threat Intelligence
  SandboxAnalyzerNode,
  ThreatIntelPlatformNode,
  ForensicsStationNode,
  IncidentResponsePlatformNode,
  
  // Backup & Recovery
  BackupSystemNode,
  DisasterRecoveryNode,
  
  // Advanced Security
  EncryptionGatewayNode,
  TokenizerNode,
  RiskAnalyticsNode,
  IdentityGovernanceNode,
  
  // Cloud Security Posture
  CloudSecurityPostureNode,
  WorkloadProtectionNode,
  RuntimeProtectionNode,
  
  // DevSecOps
  SupplychainSecurityNode,
  CodeRepositoryNode,
  CicdSecurityNode,
  SecretScannerNode,
  SbomNode,
  DependencyScannerNode,
  InfrastructureAsCodeNode,
  PolicyAsCodeNode,
  
  // Access Control
  CloudAccessBrokerNode,
  RemoteAccessGatewayNode,
  BastionHostNode,
  JumpServerNode,
  
  // Emerging Tech
  AiSecurityGatewayNode,
  QuantumKeyDistributionNode,
  BlockchainSecurityNode,
  OtSecurityGatewayNode,
  IotSecurityGatewayNode,
  
  // Physical Security
  PhysicalAccessControlNode,
  VideoSurveillanceNode,
  
  // Orchestration
  SecurityOrchestratorNode,

  // Network Zone Nodes 
  DmzNode,
  InternalNetworkNode,
  ExternalNetworkNode,
  TrustedNetworkNode,
  RestrictedNetworkNode,

  // Application Nodes
  ApplicationNode,
  DatabaseNode,
  LoadBalancerNode,
  ReverseProxyNode,
  ApiGatewayNode,
  WebServerNode,
  AuthServerNode,
  MessageBrokerNode,

  // Cloud Nodes
  CloudServiceNode,
  SearchNode,
  ContainerRegistryNode,
  KubernetesPodNode,
  KubernetesServiceNode,
  StorageAccountNode,
  FunctionAppNode,
  ApiManagementNode,
  CloudLoadBalancerNode,
  CloudFirewallNode,
  CloudDatabaseNode,

  // OT/SCADA Nodes
  PlcNode,
  HmiNode,
  HistorianNode,
  RtuNode,
  SensorNode,
  ActuatorNode,
  ScadaServerNode,
  IndustrialFirewallNode,
  SafetySystemNode,
  IndustrialNetworkNode,

  // AI/ML Nodes
  AiGatewayNode,
  InferenceEngineNode,
  ModelRegistryNode,
  AiWorkbenchNode,
  MlPipelineNode,
  AiModelNode,
  VectorDatabaseNode,
  DataLakeNode,
  FeatureStoreNode,
  LlmServiceNode,

  // Cybercrime & Fraud Nodes
  FraudDetectionNode,
  TransactionMonitorNode,
  AntiMalwareNode,
  ThreatFeedNode,
  SandboxEnvNode,
  ForensicsWorkstationNode,
  IncidentResponseNode,
  CyberInsuranceNode,
  FraudAnalyticsNode,

  // Privacy & Data Protection Nodes
  DataClassifierNode,
  ConsentManagerNode,
  DataMapperNode,
  PrivacyScannerNode,
  DataRetentionNode,
  DataAnonymizerNode,
  GdprComplianceNode,
  DataBreachNode,
  PrivacyImpactNode,
  DataSubjectRightsNode,

  // Application Architecture Nodes
  MemoryPoolNode,
  ExecutionContextNode,
  SessionStoreNode,
  InputBufferNode,
  OutputBufferNode,
  ConfigManagerNode,
  CryptoModuleNode,
  TokenValidatorNode,
  PermissionEngineNode,
  AuditLoggerNode,

  // Red Teaming Nodes
  AttackBoxNode,
  PayloadServerNode,
  C2ServerNode,
  ImplantNode,
  PhishingServerNode,
  ExfilChannelNode,
  PivotPointNode,
  CredentialHarvesterNode,
  LateralMovementNode,
  PersistenceMechanismNode,

  // Additional Application Nodes
  ApiNode,
  ServiceNode,
  CacheNode,
  StorageNode,
  VaultNode,
  IdentityNode,
  LoggingNode,
  DnsNode,
  ProxyNode,
  GatewayNode,
  MonitorNode,
  EndpointNode,
  AiNode,
  
  // Generic fallback node
  GenericNode,

  // AWS Services
  AwsEC2Node,
  AwsLambdaNode,
  AwsElasticBeanstalkNode,
  AwsECSNode,
  AwsEKSNode,
  AwsFargateNode,
  AwsS3Node,
  AwsEBSNode,
  AwsEFSNode,
  AwsRDSNode,
  AwsDynamoDBNode,
  AwsElastiCacheNode,
  AwsVPCNode,
  AwsCloudFrontNode,
  AwsAPIGatewayNode,

  // Azure Services
  AzureVMNode,
  AzureAppServiceNode,
  AzureFunctionsNode,
  AzureContainerInstancesNode,
  AzureBlobStorageNode,
  AzureFileStorageNode,
  AzureManagedDisksNode,
  AzureSQLDatabaseNode,
  AzureCosmosDBNode,
  AzureVirtualNetworkNode,
  AzureLoadBalancerNode,
  AzureApplicationGatewayNode,

  // GCP Services
  GcpComputeEngineNode,
  GcpAppEngineNode,
  GcpCloudFunctionsNode,
  GcpCloudRunNode,
  GcpGKENode,
  GcpContainerRegistryNode,
  GcpCloudStorageNode,
  GcpPersistentDiskNode,
  GcpCloudSQLNode,
  GcpFirestoreNode,
  GcpBigQueryNode,
  GcpBigtableNode,
  GcpVertexAINode,
  GcpVPCNode,
  GcpCloudLoadBalancingNode
} = NodeComponents;

// Export the node types config for use in other components
export { nodeTypeConfig };

// Export NodeComponents for use in DiagramEditor
export { NodeComponents };
