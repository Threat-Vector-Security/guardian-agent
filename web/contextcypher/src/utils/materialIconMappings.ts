// Material UI Icon mappings for consistent use across components
import React from 'react';
import { IconMapping } from '../types/IconTypes';
import { getVendorIcon } from './vendorIconMappings';

// Infrastructure Icons
import DnsIcon from '@mui/icons-material/Dns';
import ComputerIcon from '@mui/icons-material/Computer';
import DevicesIcon from '@mui/icons-material/Devices';
import PrintIcon from '@mui/icons-material/Print';
import RouterIcon from '@mui/icons-material/Router';
import HubIcon from '@mui/icons-material/Hub';
import PublicIcon from '@mui/icons-material/Public';

// Security Icons
import ShieldIcon from '@mui/icons-material/Shield';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import PolicyIcon from '@mui/icons-material/Policy';
import SecurityUpdateIcon from '@mui/icons-material/SecurityUpdate';
import SecurityIcon from '@mui/icons-material/Security';
import WebAssetIcon from '@mui/icons-material/WebAsset';
import SettingsInputAntennaIcon from '@mui/icons-material/SettingsInputAntenna';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import RadarIcon from '@mui/icons-material/Radar';
import AssessmentIcon from '@mui/icons-material/Assessment';
import HubTwoToneIcon from '@mui/icons-material/HubTwoTone';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudCircleIcon from '@mui/icons-material/CloudCircle';
import BlockIcon from '@mui/icons-material/Block';
import LockIcon from '@mui/icons-material/Lock';
import StorageIcon from '@mui/icons-material/Storage';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import EnhancedEncryptionIcon from '@mui/icons-material/EnhancedEncryption';
import KeyIcon from '@mui/icons-material/Key';
import PasswordIcon from '@mui/icons-material/Password';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import GroupIcon from '@mui/icons-material/Group';
import ContactlessIcon from '@mui/icons-material/Contactless';
import CatchingPokemonIcon from '@mui/icons-material/CatchingPokemon';
import WifiTetheringIcon from '@mui/icons-material/WifiTethering';
import BlurOnIcon from '@mui/icons-material/BlurOn';
import NetworkPingIcon from '@mui/icons-material/NetworkPing';
import ScannerIcon from '@mui/icons-material/Scanner';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import PersonIcon from '@mui/icons-material/Person';
import SearchIcon from '@mui/icons-material/Search';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import RuleIcon from '@mui/icons-material/Rule';
import BugReportIcon from '@mui/icons-material/BugReport';
import CodeIcon from '@mui/icons-material/Code';
import DynamicFormIcon from '@mui/icons-material/DynamicForm';
import AllInboxIcon from '@mui/icons-material/AllInbox';
import VerifiedIcon from '@mui/icons-material/Verified';
import ApiIcon from '@mui/icons-material/Api';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import EmailIcon from '@mui/icons-material/Email';
import ScienceIcon from '@mui/icons-material/Science';
import FindInPageIcon from '@mui/icons-material/FindInPage';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import BackupIcon from '@mui/icons-material/Backup';
import RestoreIcon from '@mui/icons-material/Restore';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import TokenIcon from '@mui/icons-material/Token';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import GitHubIcon from '@mui/icons-material/GitHub';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import VpnLockIcon from '@mui/icons-material/VpnLock';
import DescriptionIcon from '@mui/icons-material/Description';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import VpnLockOutlinedIcon from '@mui/icons-material/VpnLockOutlined';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import PsychologyIcon from '@mui/icons-material/PsychologyAlt';
import ElectricalServicesIcon from '@mui/icons-material/ElectricalServices';
import CurrencyBitcoinIcon from '@mui/icons-material/CurrencyBitcoin';
import FactoryIcon from '@mui/icons-material/Factory';
import SensorsIcon from '@mui/icons-material/Sensors';
import CameraOutdoorIcon from '@mui/icons-material/CameraOutdoor';

// Application Icons
import AppsIcon from '@mui/icons-material/Apps';
import HttpIcon from '@mui/icons-material/Http';
import ForumIcon from '@mui/icons-material/Forum';
import LayersIcon from '@mui/icons-material/Layers';
import DataUsageIcon from '@mui/icons-material/DataUsage';
import FolderIcon from '@mui/icons-material/Folder';

// Cloud Icons
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import FunctionsIcon from '@mui/icons-material/Functions';
import BalanceIcon from '@mui/icons-material/Balance';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';

// OT/SCADA Icons
import MemoryIcon from '@mui/icons-material/Memory';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import HistoryIcon from '@mui/icons-material/History';
import CellTowerIcon from '@mui/icons-material/CellTower';
import TuneIcon from '@mui/icons-material/Tune';
import DashboardIcon from '@mui/icons-material/Dashboard';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import WifiIcon from '@mui/icons-material/Wifi';

// AI/ML Icons
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import ModelTrainingIcon from '@mui/icons-material/ModelTraining';
import DatasetIcon from '@mui/icons-material/Dataset';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import SchemaIcon from '@mui/icons-material/Schema';
import BiotechIcon from '@mui/icons-material/Biotech';

// Privacy & Data Protection Icons
import { Category as CategoryIconMUI } from '@mui/icons-material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import PrivacyTipIcon from '@mui/icons-material/PrivacyTip';
import PersonOffIcon from '@mui/icons-material/PersonOff';

// Red Teaming Icons
import PestControlIcon from '@mui/icons-material/PestControl';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PhishingIcon from '@mui/icons-material/Phishing';
import LeakAddIcon from '@mui/icons-material/LeakAdd';
import TimelineIcon from '@mui/icons-material/Timeline';

// Cybercrime & Fraud Icons
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import GavelIcon from '@mui/icons-material/Gavel';
import DataThresholdingIcon from '@mui/icons-material/DataThresholding';

// Application Architecture Icons
import DataArrayIcon from '@mui/icons-material/DataArray';
import InputIcon from '@mui/icons-material/Input';
import OutputIcon from '@mui/icons-material/Output';
import SettingsIcon from '@mui/icons-material/Settings';
import MonitorIcon from '@mui/icons-material/Monitor';

// Security Zone Icons

// Additional Infrastructure Icons
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import LaptopIcon from '@mui/icons-material/Laptop';
import TabletIcon from '@mui/icons-material/Tablet';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import RouterSharpIcon from '@mui/icons-material/RouterSharp';
import RouterOutlinedIcon from '@mui/icons-material/RouterOutlined';
import SettingsEthernetIcon from '@mui/icons-material/SettingsEthernet';
import HeadsetMicIcon from '@mui/icons-material/HeadsetMic';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import BackupTableIcon from '@mui/icons-material/BackupTable';
import SdStorageIcon from '@mui/icons-material/SdStorage';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import DeviceThermostatIcon from '@mui/icons-material/DeviceThermostat';
import DeveloperBoardIcon from '@mui/icons-material/DeveloperBoard';
import SpeedIcon from '@mui/icons-material/Speed';
import CableIcon from '@mui/icons-material/Cable';
import ImportExportIcon from '@mui/icons-material/ImportExport';
import DeviceHubIcon from '@mui/icons-material/DeviceHub';
import WifiProtectedSetupIcon from '@mui/icons-material/WifiProtectedSetup';
import CellWifiIcon from '@mui/icons-material/CellWifi';
import NetworkWifiIcon from '@mui/icons-material/NetworkWifi';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import DataThresholdingOutlinedIcon from '@mui/icons-material/DataThresholdingOutlined';

// Complete icon mappings organized by category
export const materialIconMappings: Record<string, IconMapping> = {
  // Infrastructure
  server: { icon: DnsIcon, name: 'Server', category: 'infrastructure' },
  workstation: { icon: ComputerIcon, name: 'Workstation', category: 'infrastructure' },
  endpoint: { icon: DevicesIcon, name: 'Endpoint', category: 'infrastructure' },
  user: { icon: PersonIcon, name: 'User', category: 'infrastructure' },
  desktop: { icon: DesktopWindowsIcon, name: 'Desktop', category: 'infrastructure' },
  thinClient: { icon: TabletIcon, name: 'Thin Client', category: 'infrastructure' },
  virtualDesktopHost: { icon: DesktopWindowsIcon, name: 'Virtual Desktop Host', category: 'infrastructure' },
  laptop: { icon: LaptopIcon, name: 'Laptop', category: 'infrastructure' },
  tablet: { icon: TabletIcon, name: 'Tablet', category: 'infrastructure' },
  smartphone: { icon: SmartphoneIcon, name: 'Smartphone', category: 'infrastructure' },
  printer: { icon: PrintIcon, name: 'Printer', category: 'infrastructure' },
  router: { icon: RouterIcon, name: 'Router', category: 'infrastructure' },
  switch: { icon: HubIcon, name: 'Switch', category: 'infrastructure' },
  coreRouter: { icon: RouterSharpIcon, name: 'Core Router', category: 'infrastructure' },
  edgeRouter: { icon: RouterOutlinedIcon, name: 'Edge Router', category: 'infrastructure' },
  accessPoint: { icon: WifiIcon, name: 'Access Point', category: 'infrastructure' },
  sdwanGateway: { icon: NetworkWifiIcon, name: 'SD-WAN Gateway', category: 'infrastructure' },
  wirelessController: { icon: WifiProtectedSetupIcon, name: 'Wireless Controller', category: 'infrastructure' },
  gateway: { icon: HubOutlinedIcon, name: 'Gateway', category: 'infrastructure' },
  modem: { icon: ImportExportIcon, name: 'Modem', category: 'infrastructure' },
  networkBridge: { icon: DeviceHubIcon, name: 'Network Bridge', category: 'infrastructure' },
  networkHub: { icon: DeviceHubIcon, name: 'Network Hub', category: 'infrastructure' },
  dns: { icon: DnsIcon, name: 'DNS Server', category: 'infrastructure' },
  dhcp: { icon: SettingsEthernetIcon, name: 'DHCP Server', category: 'infrastructure' },
  ntpServer: { icon: SpeedIcon, name: 'NTP Server', category: 'infrastructure' },
  proxyCache: { icon: DataThresholdingOutlinedIcon, name: 'Proxy Cache', category: 'infrastructure' },
  voipPhone: { icon: PhoneInTalkIcon, name: 'VoIP Phone', category: 'infrastructure' },
  pbx: { icon: HeadsetMicIcon, name: 'PBX', category: 'infrastructure' },
  sipServer: { icon: PhoneInTalkIcon, name: 'SIP Server', category: 'infrastructure' },
  conferenceSystem: { icon: HeadsetMicIcon, name: 'Conference System', category: 'infrastructure' },
  san: { icon: BackupTableIcon, name: 'SAN', category: 'infrastructure' },
  nas: { icon: SdStorageIcon, name: 'NAS', category: 'infrastructure' },
  storageArray: { icon: StorageIcon, name: 'Storage Array', category: 'infrastructure' },
  tapeLibrary: { icon: BackupTableIcon, name: 'Tape Library', category: 'infrastructure' },
  ups: { icon: PowerSettingsNewIcon, name: 'UPS', category: 'infrastructure' },
  pdu: { icon: ElectricBoltIcon, name: 'PDU', category: 'infrastructure' },
  hvac: { icon: DeviceThermostatIcon, name: 'HVAC', category: 'infrastructure' },
  rackServer: { icon: DeveloperBoardIcon, name: 'Rack Server', category: 'infrastructure' },
  bladeServer: { icon: DeveloperBoardIcon, name: 'Blade Server', category: 'infrastructure' },
  loadBalancerHw: { icon: BalanceIcon, name: 'HW Load Balancer', category: 'infrastructure' },
  wanOptimizer: { icon: SpeedIcon, name: 'WAN Optimizer', category: 'infrastructure' },
  networkProbe: { icon: NetworkPingIcon, name: 'Network Probe', category: 'infrastructure' },
  packetBroker: { icon: CableIcon, name: 'Packet Broker', category: 'infrastructure' },
  fiberTerminal: { icon: CableIcon, name: 'Fiber Terminal', category: 'infrastructure' },
  multiplexer: { icon: ImportExportIcon, name: 'Multiplexer', category: 'infrastructure' },
  mediaConverter: { icon: SwapHorizIcon, name: 'Media Converter', category: 'infrastructure' },
  terminalServer: { icon: DesktopWindowsIcon, name: 'Terminal Server', category: 'infrastructure' },
  cellTower: { icon: CellTowerIcon, name: 'Cell Tower', category: 'infrastructure' },
  wirelessBridge: { icon: CellWifiIcon, name: 'Wireless Bridge', category: 'infrastructure' },
  meshNode: { icon: NetworkWifiIcon, name: 'Mesh Node', category: 'infrastructure' },
  repeater: { icon: WifiTetheringIcon, name: 'Repeater', category: 'infrastructure' },
  edgeServer: { icon: DirectionsRunIcon, name: 'Edge Server', category: 'infrastructure' },
  fogNode: { icon: CloudCircleIcon, name: 'Fog Node', category: 'infrastructure' },
  microDatacenter: { icon: DeveloperBoardIcon, name: 'Micro DC', category: 'infrastructure' },
  kvm: { icon: DesktopWindowsIcon, name: 'KVM Switch', category: 'infrastructure' },
  serialConsole: { icon: SettingsEthernetIcon, name: 'Serial Console', category: 'infrastructure' },
  timeClock: { icon: SpeedIcon, name: 'Time Clock', category: 'infrastructure' },
  environmentSensor: { icon: DeviceThermostatIcon, name: 'Env Sensor', category: 'infrastructure' },

  // Security Components
  firewall: { icon: ShieldIcon, name: 'Firewall', category: 'security' },
  vpnGateway: { icon: VpnKeyIcon, name: 'VPN Gateway', category: 'security' },
  ids: { icon: PolicyIcon, name: 'IDS', category: 'security' },
  ips: { icon: SecurityUpdateIcon, name: 'IPS', category: 'security' },
  waf: { icon: WebAssetIcon, name: 'WAF', category: 'security' },
  proxy: { icon: SettingsInputAntennaIcon, name: 'Proxy', category: 'security' },
  reverseProxy: { icon: SwapHorizIcon, name: 'Reverse Proxy', category: 'security' },
  monitor: { icon: RadarIcon, name: 'Monitor', category: 'security' },
  siem: { icon: AssessmentIcon, name: 'SIEM', category: 'security' },
  soar: { icon: HubTwoToneIcon, name: 'SOAR', category: 'security' },
  xdr: { icon: RadarIcon, name: 'XDR', category: 'security' },
  edr: { icon: ComputerIcon, name: 'EDR', category: 'security' },
  ndr: { icon: NetworkCheckIcon, name: 'NDR', category: 'security' },
  casb: { icon: CloudDoneIcon, name: 'CASB', category: 'security' },
  sase: { icon: CloudCircleIcon, name: 'SASE', category: 'security' },
  ztna: { icon: BlockIcon, name: 'ZTNA', category: 'security' },
  dlp: { icon: LockIcon, name: 'DLP', category: 'security' },
  dam: { icon: StorageIcon, name: 'DAM', category: 'security' },
  pam: { icon: AdminPanelSettingsIcon, name: 'PAM', category: 'security' },
  hsm: { icon: EnhancedEncryptionIcon, name: 'HSM', category: 'security' },
  kms: { icon: KeyIcon, name: 'KMS', category: 'security' },
  secretsManager: { icon: PasswordIcon, name: 'Secrets Manager', category: 'security' },
  certificateAuthority: { icon: VerifiedUserIcon, name: 'CA', category: 'security' },
  mfa: { icon: FingerprintIcon, name: 'MFA', category: 'security' },
  sso: { icon: AccountCircleIcon, name: 'SSO', category: 'security' },
  ldap: { icon: GroupIcon, name: 'LDAP', category: 'security' },
  radiusServer: { icon: ContactlessIcon, name: 'RADIUS', category: 'security' },
  honeypot: { icon: CatchingPokemonIcon, name: 'Honeypot', category: 'security' },
  honeynet: { icon: WifiTetheringIcon, name: 'Honeynet', category: 'security' },
  deceptionSystem: { icon: BlurOnIcon, name: 'Deception', category: 'security' },
  networkTap: { icon: NetworkPingIcon, name: 'Network TAP', category: 'security' },
  packetCapture: { icon: ScannerIcon, name: 'Packet Capture', category: 'security' },
  vulnerabilityScanner: { icon: ManageSearchIcon, name: 'Vuln Scanner', category: 'security' },
  patchManagement: { icon: BuildCircleIcon, name: 'Patch Mgmt', category: 'security' },
  configManagement: { icon: SettingsSuggestIcon, name: 'Config Mgmt', category: 'security' },
  complianceScanner: { icon: RuleIcon, name: 'Compliance', category: 'security' },
  penTestTool: { icon: BugReportIcon, name: 'Pen Test', category: 'security' },
  staticAnalysis: { icon: CodeIcon, name: 'SAST', category: 'security' },
  dynamicAnalysis: { icon: DynamicFormIcon, name: 'DAST', category: 'security' },
  containerScanner: { icon: AllInboxIcon, name: 'Container Scan', category: 'security' },
  k8sAdmissionController: { icon: VerifiedIcon, name: 'K8s Admission', category: 'security' },
  meshProxy: { icon: SettingsInputAntennaIcon, name: 'Mesh Proxy', category: 'security' },
  applicationDeliveryController: { icon: SwapHorizIcon, name: 'App Delivery Controller', category: 'security' },
  identityProvider: { icon: VerifiedUserIcon, name: 'Identity Provider', category: 'security' },
  apiSecurity: { icon: ApiIcon, name: 'API Security', category: 'security' },
  botProtection: { icon: SmartToyIcon, name: 'Bot Protection', category: 'security' },
  ddosProtection: { icon: BlockIcon, name: 'DDoS Protection', category: 'security' },
  emailSecurity: { icon: EmailIcon, name: 'Email Security', category: 'security' },
  webFilter: { icon: WebAssetIcon, name: 'Web Filter', category: 'security' },
  sandboxAnalyzer: { icon: ScienceIcon, name: 'Sandbox', category: 'security' },
  threatIntelPlatform: { icon: RadarIcon, name: 'Threat Intel', category: 'security' },
  forensicsStation: { icon: FindInPageIcon, name: 'Forensics', category: 'security' },
  incidentResponsePlatform: { icon: NotificationsActiveIcon, name: 'IR Platform', category: 'security' },
  backupSystem: { icon: BackupIcon, name: 'Backup', category: 'security' },
  disasterRecovery: { icon: RestoreIcon, name: 'DR System', category: 'security' },
  encryptionGateway: { icon: LockOutlinedIcon, name: 'Encryption GW', category: 'security' },
  tokenizer: { icon: TokenIcon, name: 'Tokenizer', category: 'security' },
  riskAnalytics: { icon: AnalyticsIcon, name: 'Risk Analytics', category: 'security' },
  identityGovernance: { icon: ManageAccountsIcon, name: 'Identity Gov', category: 'security' },
  cloudSecurityPosture: { icon: CloudDoneIcon, name: 'CSPM', category: 'security' },
  workloadProtection: { icon: CloudCircleIcon, name: 'CWPP', category: 'security' },
  runtimeProtection: { icon: PlayCircleIcon, name: 'Runtime', category: 'security' },
  supplychainSecurity: { icon: AccountTreeIcon, name: 'Supply Chain', category: 'security' },
  codeRepository: { icon: GitHubIcon, name: 'Code Repo', category: 'security' },
  cicdSecurity: { icon: IntegrationInstructionsIcon, name: 'CI/CD Security', category: 'security' },
  secretScanner: { icon: VpnLockIcon, name: 'Secret Scanner', category: 'security' },
  sbom: { icon: DescriptionIcon, name: 'SBOM', category: 'security' },
  dependencyScanner: { icon: AccountTreeOutlinedIcon, name: 'Dependency Scan', category: 'security' },
  infrastructureAsCode: { icon: CodeIcon, name: 'IaC Security', category: 'security' },
  policyAsCode: { icon: RuleIcon, name: 'Policy as Code', category: 'security' },
  cloudAccessBroker: { icon: CloudOffIcon, name: 'Cloud Broker', category: 'security' },
  remoteAccessGateway: { icon: VpnLockOutlinedIcon, name: 'Remote Access', category: 'security' },
  bastionHost: { icon: MeetingRoomIcon, name: 'Bastion Host', category: 'security' },
  jumpServer: { icon: MeetingRoomIcon, name: 'Jump Server', category: 'security' },
  aiSecurityGateway: { icon: PsychologyIcon, name: 'AI Security', category: 'security' },
  quantumKeyDistribution: { icon: ElectricalServicesIcon, name: 'Quantum KD', category: 'security' },
  blockchainSecurity: { icon: CurrencyBitcoinIcon, name: 'Blockchain', category: 'security' },
  otSecurityGateway: { icon: FactoryIcon, name: 'OT Security', category: 'security' },
  iotSecurityGateway: { icon: SensorsIcon, name: 'IoT Security', category: 'security' },
  physicalAccessControl: { icon: MeetingRoomIcon, name: 'Physical Access', category: 'security' },
  videoSurveillance: { icon: CameraOutdoorIcon, name: 'Video Surveillance', category: 'security' },
  securityOrchestrator: { icon: HubTwoToneIcon, name: 'Orchestrator', category: 'security' },

  // Applications
  application: { icon: AppsIcon, name: 'Application', category: 'application' },
  webApplication: { icon: WebAssetIcon, name: 'Web Application', category: 'application' },
  database: { icon: StorageIcon, name: 'Database', category: 'application' },
  loadBalancer: { icon: AccountTreeIcon, name: 'Load Balancer', category: 'application' },
  apiGateway: { icon: ApiIcon, name: 'API Gateway', category: 'application' },
  webServer: { icon: HttpIcon, name: 'Web Server', category: 'application' },
  authServer: { icon: AccountCircleIcon, name: 'Auth Server', category: 'application' },
  messageBroker: { icon: ForumIcon, name: 'Message Broker', category: 'application' },
  api: { icon: ApiIcon, name: 'API Service', category: 'application' },
  service: { icon: LayersIcon, name: 'Service', category: 'application' },
  containerizedService: { icon: AllInboxIcon, name: 'Containerized Service', category: 'application' },
  cache: { icon: DataUsageIcon, name: 'Cache', category: 'application' },
  storage: { icon: FolderIcon, name: 'Storage', category: 'application' },
  vault: { icon: KeyIcon, name: 'Vault', category: 'application' },
  identity: { icon: GroupIcon, name: 'Identity Provider', category: 'application' },
  logging: { icon: AssessmentIcon, name: 'Logging', category: 'application' },
  microcode: { icon: BuildCircleIcon, name: 'Microcode', category: 'application' },
  kernelModule: { icon: MemoryIcon, name: 'Kernel Module', category: 'application' },
  deviceDriver: { icon: SettingsIcon, name: 'Device Driver', category: 'application' },
  hypervisor: { icon: AdminPanelSettingsIcon, name: 'Hypervisor', category: 'application' },
  firmware: { icon: CodeIcon, name: 'Firmware', category: 'application' },
  secureEnclave: { icon: LockIcon, name: 'Secure Enclave', category: 'application' },
  tpm: { icon: VerifiedUserIcon, name: 'TPM', category: 'application' },

  // Cloud Services
  cloudService: { icon: CloudQueueIcon, name: 'Cloud Service', category: 'cloud' },
  containerRegistry: { icon: AllInboxIcon, name: 'Container Registry', category: 'cloud' },
  kubernetesPod: { icon: ViewInArIcon, name: 'K8s Pod', category: 'cloud' },
  kubernetesService: { icon: LayersIcon, name: 'K8s Service', category: 'cloud' },
  storageAccount: { icon: CloudCircleIcon, name: 'Storage', category: 'cloud' },
  fileShare: { icon: FolderIcon, name: 'File Share', category: 'cloud' },
  functionApp: { icon: FunctionsIcon, name: 'Function', category: 'cloud' },
  apiManagement: { icon: ApiIcon, name: 'API Management', category: 'cloud' },
  cdn: { icon: PublicIcon, name: 'CDN', category: 'cloud' },
  cloudFront: { icon: PublicIcon, name: 'Cloud Front Door', category: 'cloud' },
  cloudLoadBalancer: { icon: BalanceIcon, name: 'Cloud LB', category: 'cloud' },
  cloudFirewall: { icon: LocalFireDepartmentIcon, name: 'Cloud Firewall', category: 'cloud' },
  cloudDatabase: { icon: CloudDoneIcon, name: 'Cloud DB', category: 'cloud' },
  search: { icon: SearchIcon, name: 'Search Service', category: 'cloud' },

  // Vendor Cloud Services - AWS
  awsEC2: getVendorIcon({
    vendor: 'aws',
    subcategory: 'compute',
    filename: 'Arch_Amazon-EC2_48.svg',
    name: 'AWS EC2',
    category: 'aws',
    keywords: ['aws', 'ec2', 'compute']
  }),
  awsLambda: getVendorIcon({
    vendor: 'aws',
    subcategory: 'compute',
    filename: 'Arch_AWS-Lambda_48.svg',
    name: 'AWS Lambda',
    category: 'aws',
    keywords: ['aws', 'lambda', 'serverless']
  }),
  awsElasticBeanstalk: getVendorIcon({
    vendor: 'aws',
    subcategory: 'compute',
    filename: 'Arch_AWS-Elastic-Beanstalk_48.svg',
    name: 'Elastic Beanstalk',
    category: 'aws',
    keywords: ['aws', 'elastic beanstalk', 'platform']
  }),
  awsECS: getVendorIcon({
    vendor: 'aws',
    subcategory: 'containers',
    filename: 'Arch_Amazon-Elastic-Container-Service_48.svg',
    name: 'Amazon ECS',
    category: 'aws',
    keywords: ['aws', 'ecs', 'containers']
  }),
  awsEKS: getVendorIcon({
    vendor: 'aws',
    subcategory: 'containers',
    filename: 'Arch_Amazon-EKS-Cloud_48.svg',
    name: 'Amazon EKS',
    category: 'aws',
    keywords: ['aws', 'eks', 'kubernetes']
  }),
  awsFargate: getVendorIcon({
    vendor: 'aws',
    subcategory: 'containers',
    filename: 'Arch_AWS-Fargate_48.svg',
    name: 'AWS Fargate',
    category: 'aws',
    keywords: ['aws', 'fargate', 'serverless containers']
  }),
  awsS3: getVendorIcon({
    vendor: 'aws',
    subcategory: 'storage',
    filename: 'Arch_Amazon-Simple-Storage-Service_48.svg',
    name: 'Amazon S3',
    category: 'aws',
    keywords: ['aws', 's3', 'storage']
  }),
  awsEBS: getVendorIcon({
    vendor: 'aws',
    subcategory: 'storage',
    filename: 'Arch_Amazon-Elastic-Block-Store_48.svg',
    name: 'Amazon EBS',
    category: 'aws',
    keywords: ['aws', 'ebs', 'block storage']
  }),
  awsEFS: getVendorIcon({
    vendor: 'aws',
    subcategory: 'resources',
    filename: 'Res_Amazon-Elastic-File-System_File-System_48.svg',
    name: 'Amazon EFS',
    category: 'aws',
    keywords: ['aws', 'efs', 'file storage']
  }),
  awsRDS: getVendorIcon({
    vendor: 'aws',
    subcategory: 'database',
    filename: 'Arch_Amazon-RDS_48.svg',
    name: 'Amazon RDS',
    category: 'aws',
    keywords: ['aws', 'rds', 'database']
  }),
  awsDynamoDB: getVendorIcon({
    vendor: 'aws',
    subcategory: 'database',
    filename: 'Arch_Amazon-DynamoDB_48.svg',
    name: 'Amazon DynamoDB',
    category: 'aws',
    keywords: ['aws', 'dynamodb', 'nosql']
  }),
  awsElastiCache: getVendorIcon({
    vendor: 'aws',
    subcategory: 'database',
    filename: 'Arch_Amazon-ElastiCache_48.svg',
    name: 'Amazon ElastiCache',
    category: 'aws',
    keywords: ['aws', 'elasticache', 'cache']
  }),
  awsVPC: getVendorIcon({
    vendor: 'aws',
    subcategory: 'network',
    filename: 'Arch_Amazon-Virtual-Private-Cloud_48.svg',
    name: 'Amazon VPC',
    category: 'aws',
    keywords: ['aws', 'vpc', 'network']
  }),
  awsCloudFront: getVendorIcon({
    vendor: 'aws',
    subcategory: 'network',
    filename: 'Arch_Amazon-CloudFront_48.svg',
    name: 'Amazon CloudFront',
    category: 'aws',
    keywords: ['aws', 'cloudfront', 'cdn']
  }),
  awsAPIGateway: getVendorIcon({
    vendor: 'aws',
    subcategory: 'network',
    filename: 'Arch_Amazon-API-Gateway_48.svg',
    name: 'Amazon API Gateway',
    category: 'aws',
    keywords: ['aws', 'api gateway', 'api']
  }),

  // Vendor Cloud Services - Azure
  azureVM: getVendorIcon({
    vendor: 'azure',
    subcategory: 'compute',
    filename: '10021-icon-service-Virtual-Machine.svg',
    name: 'Azure Virtual Machine',
    category: 'azure',
    keywords: ['azure', 'virtual machine', 'compute']
  }),
  azureAppService: getVendorIcon({
    vendor: 'azure',
    subcategory: 'app-services',
    filename: '10035-icon-service-App-Services.svg',
    name: 'Azure App Service',
    category: 'azure',
    keywords: ['azure', 'app service', 'web']
  }),
  azureFunctions: getVendorIcon({
    vendor: 'azure',
    subcategory: 'compute',
    filename: '10029-icon-service-Function-Apps.svg',
    name: 'Azure Functions',
    category: 'azure',
    keywords: ['azure', 'functions', 'serverless']
  }),
  azureContainerInstances: getVendorIcon({
    vendor: 'azure',
    subcategory: 'compute',
    filename: '10104-icon-service-Container-Instances.svg',
    name: 'Azure Container Instances',
    category: 'azure',
    keywords: ['azure', 'container instances', 'containers']
  }),
  azureBlobStorage: getVendorIcon({
    vendor: 'azure',
    subcategory: 'storage',
    filename: '10086-icon-service-Storage-Accounts.svg',
    name: 'Azure Storage Account',
    category: 'azure',
    keywords: ['azure', 'storage account', 'blob']
  }),
  azureFileStorage: getVendorIcon({
    vendor: 'azure',
    subcategory: 'storage',
    filename: '10400-icon-service-Azure-Fileshares.svg',
    name: 'Azure Files',
    category: 'azure',
    keywords: ['azure', 'files', 'file storage']
  }),
  azureManagedDisks: getVendorIcon({
    vendor: 'azure',
    subcategory: 'compute',
    filename: '10032-icon-service-Disks.svg',
    name: 'Azure Managed Disks',
    category: 'azure',
    keywords: ['azure', 'managed disks', 'storage']
  }),
  azureSQLDatabase: getVendorIcon({
    vendor: 'azure',
    subcategory: 'databases',
    filename: '10130-icon-service-SQL-Database.svg',
    name: 'Azure SQL Database',
    category: 'azure',
    keywords: ['azure', 'sql database', 'database']
  }),
  azureCosmosDB: getVendorIcon({
    vendor: 'azure',
    subcategory: 'databases',
    filename: '10121-icon-service-Azure-Cosmos-DB.svg',
    name: 'Azure Cosmos DB',
    category: 'azure',
    keywords: ['azure', 'cosmos db', 'nosql']
  }),
  azureVirtualNetwork: getVendorIcon({
    vendor: 'azure',
    subcategory: 'networking',
    filename: '10061-icon-service-Virtual-Networks.svg',
    name: 'Azure Virtual Network',
    category: 'azure',
    keywords: ['azure', 'vnet', 'network']
  }),
  azureLoadBalancer: getVendorIcon({
    vendor: 'azure',
    subcategory: 'networking',
    filename: '10062-icon-service-Load-Balancers.svg',
    name: 'Azure Load Balancer',
    category: 'azure',
    keywords: ['azure', 'load balancer', 'network']
  }),
  azureApplicationGateway: getVendorIcon({
    vendor: 'azure',
    subcategory: 'networking',
    filename: '10076-icon-service-Application-Gateways.svg',
    name: 'Azure Application Gateway',
    category: 'azure',
    keywords: ['azure', 'application gateway', 'network']
  }),
  azureKubernetesService: getVendorIcon({
    vendor: 'azure',
    subcategory: 'containers',
    filename: '10023-icon-service-Kubernetes-Services.svg',
    name: 'Azure Kubernetes Service',
    category: 'azure',
    keywords: ['azure', 'aks', 'kubernetes']
  }),
  azureRedisCache: getVendorIcon({
    vendor: 'azure',
    subcategory: 'databases',
    filename: '10137-icon-service-Cache-Redis.svg',
    name: 'Azure Cache for Redis',
    category: 'azure',
    keywords: ['azure', 'redis', 'cache']
  }),
  azureFrontDoor: getVendorIcon({
    vendor: 'azure',
    subcategory: 'networking',
    filename: '10073-icon-service-Front-Door-and-CDN-Profiles.svg',
    name: 'Azure Front Door',
    category: 'azure',
    keywords: ['azure', 'front door', 'cdn']
  }),
  azureStorage: getVendorIcon({
    vendor: 'azure',
    subcategory: 'storage',
    filename: '10086-icon-service-Storage-Accounts.svg',
    name: 'Azure Storage',
    category: 'azure',
    keywords: ['azure', 'storage']
  }),
  azureMonitor: getVendorIcon({
    vendor: 'azure',
    subcategory: 'monitor',
    filename: '00001-icon-service-Monitor.svg',
    name: 'Azure Monitor',
    category: 'azure',
    keywords: ['azure', 'monitor', 'observability']
  }),
  azureActiveDirectory: getVendorIcon({
    vendor: 'azure',
    subcategory: 'identity',
    filename: '10222-icon-service-Entra-Domain-Services.svg',
    name: 'Azure Active Directory',
    category: 'azure',
    keywords: ['azure', 'active directory', 'entra']
  }),
  azureKeyVault: getVendorIcon({
    vendor: 'azure',
    subcategory: 'security',
    filename: '10245-icon-service-Key-Vaults.svg',
    name: 'Azure Key Vault',
    category: 'azure',
    keywords: ['azure', 'key vault', 'security']
  }),

  // Vendor Cloud Services - GCP
  gcpComputeEngine: getVendorIcon({
    vendor: 'gcp',
    subcategory: 'core-products',
    filename: 'ComputeEngine-512-color-rgb.svg',
    name: 'Compute Engine',
    category: 'gcp',
    keywords: ['gcp', 'compute engine', 'compute']
  }),
  gcpAppEngine: getVendorIcon({
    vendor: 'gcp',
    subcategory: 'serverless-computing',
    filename: 'ServerlessComputing-512-color.svg',
    name: 'App Engine',
    category: 'gcp',
    keywords: ['gcp', 'app engine', 'serverless']
  }),
  gcpCloudFunctions: getVendorIcon({
    vendor: 'gcp',
    subcategory: 'serverless-computing',
    filename: 'ServerlessComputing-512-color.svg',
    name: 'Cloud Functions',
    category: 'gcp',
    keywords: ['gcp', 'cloud functions', 'serverless']
  }),
  gcpCloudRun: getVendorIcon({
    vendor: 'gcp',
    subcategory: 'core-products',
    filename: 'CloudRun-512-color-rgb.svg',
    name: 'Cloud Run',
    category: 'gcp',
    keywords: ['gcp', 'cloud run', 'containers']
  }),
  gcpGKE: getVendorIcon({
    vendor: 'gcp',
    subcategory: 'core-products',
    filename: 'GKE-512-color.svg',
    name: 'Google Kubernetes Engine',
    category: 'gcp',
    keywords: ['gcp', 'gke', 'kubernetes']
  }),
  gcpContainerRegistry: getVendorIcon({
    vendor: 'gcp',
    subcategory: 'containers',
    filename: 'Containers-512-color.svg',
    name: 'Artifact Registry',
    category: 'gcp',
    keywords: ['gcp', 'artifact registry', 'containers']
  }),
  gcpCloudStorage: getVendorIcon({
    vendor: 'gcp',
    subcategory: 'core-products',
    filename: 'Cloud_Storage-512-color.svg',
    name: 'Cloud Storage',
    category: 'gcp',
    keywords: ['gcp', 'cloud storage', 'storage']
  }),
  gcpPersistentDisk: getVendorIcon({
    vendor: 'gcp',
    subcategory: 'storage',
    filename: 'Storage-512-color.svg',
    name: 'Persistent Disk',
    category: 'gcp',
    keywords: ['gcp', 'persistent disk', 'storage']
  }),
  gcpCloudSQL: getVendorIcon({
    vendor: 'gcp',
    subcategory: 'core-products',
    filename: 'CloudSQL-512-color.svg',
    name: 'Cloud SQL',
    category: 'gcp',
    keywords: ['gcp', 'cloud sql', 'database']
  }),
  gcpFirestore: getVendorIcon({
    vendor: 'gcp',
    subcategory: 'databases',
    filename: 'Databases-512-color.svg',
    name: 'Cloud Firestore',
    category: 'gcp',
    keywords: ['gcp', 'firestore', 'nosql']
  }),
  gcpBigQuery: getVendorIcon({
    vendor: 'gcp',
    subcategory: 'core-products',
    filename: 'BigQuery-512-color.svg',
    name: 'BigQuery',
    category: 'gcp',
    keywords: ['gcp', 'bigquery', 'analytics']
  }),
  gcpBigtable: getVendorIcon({
    vendor: 'gcp',
    subcategory: 'core-products',
    filename: 'CloudSpanner-512-color.svg',
    name: 'Cloud Bigtable',
    category: 'gcp',
    keywords: ['gcp', 'bigtable', 'database']
  }),
  gcpVertexAI: getVendorIcon({
    vendor: 'gcp',
    subcategory: 'core-products',
    filename: 'VertexAI-512-color.svg',
    name: 'Vertex AI',
    category: 'gcp',
    keywords: ['gcp', 'vertex ai', 'ml']
  }),
  gcpVPC: getVendorIcon({
    vendor: 'gcp',
    subcategory: 'networking',
    filename: 'Networking-512-color-rgb.svg',
    name: 'Virtual Private Cloud',
    category: 'gcp',
    keywords: ['gcp', 'vpc', 'network']
  }),
  gcpCloudLoadBalancing: getVendorIcon({
    vendor: 'gcp',
    subcategory: 'networking',
    filename: 'Networking-512-color-rgb.svg',
    name: 'Cloud Load Balancing',
    category: 'gcp',
    keywords: ['gcp', 'load balancing', 'network']
  }),

  // IBM Cloud Services
  ibmVirtualServer: getVendorIcon({
    vendor: 'ibm',
    subcategory: 'Compute',
    filename: 'Virtual Server.svg',
    name: 'IBM Virtual Server',
    category: 'ibm',
    keywords: ['ibm', 'virtual server', 'compute']
  }),
  ibmObjectStorage: getVendorIcon({
    vendor: 'ibm',
    subcategory: 'Data & Storage',
    filename: 'Object Storage Application.svg',
    name: 'IBM Object Storage',
    category: 'ibm',
    keywords: ['ibm', 'object storage', 'storage']
  }),
  ibmDatabase: getVendorIcon({
    vendor: 'ibm',
    subcategory: 'Data & Storage',
    filename: 'Database.svg',
    name: 'IBM Database',
    category: 'ibm',
    keywords: ['ibm', 'database']
  }),
  ibmVPC: getVendorIcon({
    vendor: 'ibm',
    subcategory: 'Networking',
    filename: 'VPC.svg',
    name: 'IBM VPC',
    category: 'ibm',
    keywords: ['ibm', 'vpc', 'network']
  }),
  ibmSecurityGateway: getVendorIcon({
    vendor: 'ibm',
    subcategory: 'Security',
    filename: 'Security Gateway.svg',
    name: 'IBM Security Gateway',
    category: 'ibm',
    keywords: ['ibm', 'security', 'gateway']
  }),

  // OT/SCADA
  plc: { icon: MemoryIcon, name: 'PLC', category: 'industrial' },
  hmi: { icon: TouchAppIcon, name: 'HMI', category: 'industrial' },
  historian: { icon: HistoryIcon, name: 'Historian', category: 'industrial' },
  rtu: { icon: CellTowerIcon, name: 'RTU', category: 'industrial' },
  sensor: { icon: SensorsIcon, name: 'Sensor', category: 'industrial' },
  actuator: { icon: TuneIcon, name: 'Actuator', category: 'industrial' },
  scadaServer: { icon: DashboardIcon, name: 'SCADA Server', category: 'industrial' },
  industrialFirewall: { icon: LocalFireDepartmentIcon, name: 'Industrial FW', category: 'industrial' },
  safetySystem: { icon: HealthAndSafetyIcon, name: 'Safety System', category: 'industrial' },
  industrialNetwork: { icon: WifiIcon, name: 'Industrial Net', category: 'industrial' },

  // AI/ML
  aiGateway: { icon: HubOutlinedIcon, name: 'AI Gateway', category: 'ai' },
  inferenceEngine: { icon: PsychologyIcon, name: 'Inference Engine', category: 'ai' },
  modelRegistry: { icon: ModelTrainingIcon, name: 'Model Registry', category: 'ai' },
  aiModelTraining: { icon: ModelTrainingIcon, name: 'Model Training', category: 'ai' },
  aiWorkbench: { icon: ScienceIcon, name: 'AI Workbench', category: 'ai' },
  mlPipeline: { icon: AccountTreeOutlinedIcon, name: 'ML Pipeline', category: 'ai' },
  aiModel: { icon: SmartToyIcon, name: 'AI Model Store', category: 'ai' },
  vectorDatabase: { icon: DatasetIcon, name: 'Vector Database', category: 'ai' },
  dataLake: { icon: StorageIcon, name: 'Data Lake', category: 'ai' },
  featureStore: { icon: SchemaIcon, name: 'Feature Store', category: 'ai' },
  llmService: { icon: AutoGraphIcon, name: 'LLM Service', category: 'ai' },
  ai: { icon: BiotechIcon, name: 'AI System', category: 'ai' },
  mlInference: { icon: PsychologyIcon, name: 'ML Inference', category: 'ai' },
  notebookServer: { icon: DescriptionIcon, name: 'Notebook Server', category: 'ai' },
  computeCluster: { icon: DeveloperBoardIcon, name: 'Compute Cluster', category: 'ai' },
  modelVault: { icon: LockIcon, name: 'Model Vault', category: 'ai' },
  securityScanner: { icon: SecurityIcon, name: 'Security Scanner', category: 'ai' },

  // Privacy & Data Protection
  dataClassifier: { icon: CategoryIconMUI, name: 'Data Classifier', category: 'privacy' },
  consentManager: { icon: ManageAccountsIcon, name: 'Consent Manager', category: 'privacy' },
  dataMapper: { icon: AccountTreeOutlinedIcon, name: 'Data Mapper', category: 'privacy' },
  privacyScanner: { icon: VisibilityIcon, name: 'Privacy Scanner', category: 'privacy' },
  dataRetention: { icon: DeleteForeverIcon, name: 'Data Retention', category: 'privacy' },
  dataAnonymizer: { icon: BlurOnIcon, name: 'Data Anonymizer', category: 'privacy' },
  gdprCompliance: { icon: VerifiedUserIcon, name: 'GDPR Compliance', category: 'privacy' },
  dataBreach: { icon: NotificationsActiveIcon, name: 'Breach Detection', category: 'privacy' },
  privacyImpact: { icon: PrivacyTipIcon, name: 'Privacy Impact', category: 'privacy' },
  dataSubjectRights: { icon: PersonOffIcon, name: 'Data Subject Rights', category: 'privacy' },

  // Cybercrime & Fraud
  fraudDetection: { icon: QueryStatsIcon, name: 'Fraud Detection', category: 'fraud' },
  transactionMonitor: { icon: MonetizationOnIcon, name: 'Transaction Monitor', category: 'fraud' },
  antiMalware: { icon: BugReportOutlinedIcon, name: 'Anti-Malware', category: 'fraud' },
  threatFeed: { icon: RadarIcon, name: 'Threat Intelligence', category: 'fraud' },
  sandboxEnv: { icon: ScienceOutlinedIcon, name: 'Sandbox', category: 'fraud' },
  forensicsWorkstation: { icon: FindInPageIcon, name: 'Forensics Station', category: 'fraud' },
  incidentResponse: { icon: NotificationsActiveIcon, name: 'Incident Response', category: 'fraud' },
  cyberInsurance: { icon: GavelIcon, name: 'Cyber Insurance', category: 'fraud' },
  fraudAnalytics: { icon: DataThresholdingIcon, name: 'Fraud Analytics', category: 'fraud' },

  // Application Architecture
  memoryPool: { icon: DataArrayIcon, name: 'Memory Pool', category: 'architecture' },
  executionContext: { icon: PlayCircleIcon, name: 'Execution Context', category: 'architecture' },
  sessionStore: { icon: BackupIcon, name: 'Session Store', category: 'architecture' },
  inputBuffer: { icon: InputIcon, name: 'Input Buffer', category: 'architecture' },
  outputBuffer: { icon: OutputIcon, name: 'Output Buffer', category: 'architecture' },
  configManager: { icon: SettingsIcon, name: 'Config Manager', category: 'architecture' },
  cryptoModule: { icon: LockOutlinedIcon, name: 'Crypto Module', category: 'architecture' },
  tokenValidator: { icon: TokenIcon, name: 'Token Validator', category: 'architecture' },
  permissionEngine: { icon: AdminPanelSettingsIcon, name: 'Permission Engine', category: 'architecture' },
  auditLogger: { icon: DescriptionIcon, name: 'Audit Logger', category: 'architecture' },

  // Red Teaming
  attackBox: { icon: PestControlIcon, name: 'Attack Box', category: 'redteam' },
  payloadServer: { icon: CloudUploadIcon, name: 'Payload Server', category: 'redteam' },
  c2Server: { icon: WifiTetheringIcon, name: 'C2 Server', category: 'redteam' },
  implant: { icon: CatchingPokemonIcon, name: 'Implant', category: 'redteam' },
  phishingServer: { icon: PhishingIcon, name: 'Phishing Server', category: 'redteam' },
  exfilChannel: { icon: LeakAddIcon, name: 'Exfiltration Channel', category: 'redteam' },
  pivotPoint: { icon: TimelineIcon, name: 'Pivot Point', category: 'redteam' },
  credentialHarvester: { icon: VpnLockIcon, name: 'Credential Harvester', category: 'redteam' },
  lateralMovement: { icon: SwapHorizIcon, name: 'Lateral Movement', category: 'redteam' },
  persistenceMechanism: { icon: RestoreIcon, name: 'Persistence', category: 'redteam' },

  // Security Operations
  socWorkstation: { icon: ComputerIcon, name: 'SOC Workstation', category: 'secops' },
  threatHuntingPlatform: { icon: RadarIcon, name: 'Threat Hunting Platform', category: 'secops' },
  ctiFeed: { icon: RocketLaunchIcon, name: 'CTI Feed', category: 'secops' },
  attackSurfaceMonitor: { icon: PublicIcon, name: 'Attack Surface Monitor', category: 'secops' },
  deceptionToken: { icon: CatchingPokemonIcon, name: 'Deception Token', category: 'secops' },
  behaviorAnalytics: { icon: AnalyticsIcon, name: 'Behavior Analytics', category: 'secops' },
  networkForensics: { icon: NetworkCheckIcon, name: 'Network Forensics', category: 'secops' },
  malwareRepository: { icon: ScienceIcon, name: 'Malware Repository', category: 'secops' },
  indicatorStore: { icon: StorageIcon, name: 'Indicator Store', category: 'secops' },
  playbookEngine: { icon: IntegrationInstructionsIcon, name: 'Playbook Engine', category: 'secops' },

  // Security Zones
  securityZone: { icon: ShieldIcon, name: 'Security Zone', category: 'zone' },

  // DFD (Data Flow Diagram) nodes
  dfdActor: { icon: PersonIcon, name: 'DFD Actor', category: 'dfd' },
  dfdProcess: { icon: SettingsIcon, name: 'DFD Process', category: 'dfd' },
  dfdDataStore: { icon: StorageIcon, name: 'DFD Data Store', category: 'dfd' },
  dfdTrustBoundary: { icon: ShieldIcon, name: 'DFD Trust Boundary', category: 'dfd' },

  // Additional AWS Services
  awsGlacier: { icon: StorageIcon, name: 'Glacier', category: 'aws', keywords: ['aws', 'storage', 'archive'] },
  awsRedshift: getVendorIcon({ vendor: 'aws', subcategory: 'analytics', filename: 'Arch_Amazon-Redshift_48.svg', name: 'Redshift', category: 'aws', keywords: ['aws', 'database', 'warehouse'] }),
  awsAurora: { icon: StorageIcon, name: 'Aurora', category: 'aws', keywords: ['aws', 'database'] },
  awsRoute53: getVendorIcon({ vendor: 'aws', subcategory: 'network', filename: 'Arch_Amazon-Route-53_48.svg', name: 'Route 53', category: 'aws', keywords: ['aws', 'dns'] }),
  awsDirectConnect: getVendorIcon({ vendor: 'aws', subcategory: 'network', filename: 'Arch_AWS-Direct-Connect_48.svg', name: 'Direct Connect', category: 'aws', keywords: ['aws', 'network'] }),
  awsTransitGateway: getVendorIcon({ vendor: 'aws', subcategory: 'network', filename: 'Arch_AWS-Transit-Gateway_48.svg', name: 'Transit Gateway', category: 'aws', keywords: ['aws', 'network'] }),
  awsSNS: getVendorIcon({ vendor: 'aws', subcategory: 'app-integration', filename: 'Arch_Amazon-Simple-Notification-Service_48.svg', name: 'SNS', category: 'aws', keywords: ['aws', 'messaging'] }),
  awsSQS: getVendorIcon({ vendor: 'aws', subcategory: 'app-integration', filename: 'Arch_Amazon-Simple-Queue-Service_48.svg', name: 'SQS', category: 'aws', keywords: ['aws', 'queue'] }),
  awsEventBridge: getVendorIcon({ vendor: 'aws', subcategory: 'app-integration', filename: 'Arch_Amazon-EventBridge_48.svg', name: 'EventBridge', category: 'aws', keywords: ['aws', 'events'] }),
  awsIAM: getVendorIcon({ vendor: 'aws', subcategory: 'security', filename: 'Arch_AWS-Identity-and-Access-Management_48.svg', name: 'IAM', category: 'aws', keywords: ['aws', 'identity'] }),
  awsCognito: getVendorIcon({ vendor: 'aws', subcategory: 'security', filename: 'Arch_Amazon-Cognito_48.svg', name: 'Cognito', category: 'aws', keywords: ['aws', 'auth'] }),
  awsSSO: { icon: VpnKeyIcon, name: 'SSO', category: 'aws', keywords: ['aws', 'sso'] },
  awsSecretsManager: getVendorIcon({ vendor: 'aws', subcategory: 'security', filename: 'Arch_AWS-Secrets-Manager_48.svg', name: 'Secrets Manager', category: 'aws', keywords: ['aws', 'secrets'] }),
  awsKMS: getVendorIcon({ vendor: 'aws', subcategory: 'security', filename: 'Arch_AWS-Key-Management-Service_48.svg', name: 'KMS', category: 'aws', keywords: ['aws', 'encryption'] }),
  awsACM: { icon: VerifiedIcon, name: 'ACM', category: 'aws', keywords: ['aws', 'certificates'] },
  awsDirectory: { icon: FolderIcon, name: 'Directory Service', category: 'aws', keywords: ['aws', 'directory'] },
  awsGuardDuty: getVendorIcon({ vendor: 'aws', subcategory: 'security', filename: 'Arch_Amazon-GuardDuty_48.svg', name: 'GuardDuty', category: 'aws', keywords: ['aws', 'security'] }),
  awsSecurityHub: { icon: DashboardIcon, name: 'Security Hub', category: 'aws', keywords: ['aws', 'security'] },
  awsWAF: { icon: ShieldIcon, name: 'WAF', category: 'aws', keywords: ['aws', 'firewall'] },
  awsShield: { icon: ShieldIcon, name: 'Shield', category: 'aws', keywords: ['aws', 'ddos'] },
  awsInspector: { icon: BugReportIcon, name: 'Inspector', category: 'aws', keywords: ['aws', 'security'] },
  awsDetective: { icon: SearchIcon, name: 'Detective', category: 'aws', keywords: ['aws', 'security'] },
  awsFirewallManager: { icon: AdminPanelSettingsIcon, name: 'Firewall Manager', category: 'aws', keywords: ['aws', 'firewall'] },
  awsNetworkFirewall: { icon: ShieldIcon, name: 'Network Firewall', category: 'aws', keywords: ['aws', 'firewall'] },
  awsConfig: { icon: SettingsIcon, name: 'Config', category: 'aws', keywords: ['aws', 'configuration'] },
  awsCloudTrail: getVendorIcon({ vendor: 'aws', subcategory: 'management-governance', filename: 'Arch_AWS-CloudTrail_48.svg', name: 'CloudTrail', category: 'aws', keywords: ['aws', 'audit'] }),
  awsCloudWatch: getVendorIcon({ vendor: 'aws', subcategory: 'management-governance', filename: 'Arch_Amazon-CloudWatch_48.svg', name: 'CloudWatch', category: 'aws', keywords: ['aws', 'monitoring'] }),
  awsMacie: { icon: PrivacyTipIcon, name: 'Macie', category: 'aws', keywords: ['aws', 'dlp'] },
  awsSecurityLake: { icon: StorageIcon, name: 'Security Lake', category: 'aws', keywords: ['aws', 'security'] },
  awsAccessAnalyzer: { icon: AssessmentIcon, name: 'Access Analyzer', category: 'aws', keywords: ['aws', 'iam'] },
  awsCodePipeline: getVendorIcon({ vendor: 'aws', subcategory: 'developer-tools', filename: 'Arch_AWS-CodePipeline_48.svg', name: 'CodePipeline', category: 'aws', keywords: ['aws', 'cicd'] }),
  awsCodeBuild: { icon: BuildCircleIcon, name: 'CodeBuild', category: 'aws', keywords: ['aws', 'build'] },
  awsCodeDeploy: getVendorIcon({ vendor: 'aws', subcategory: 'developer-tools', filename: 'Arch_AWS-CodeDeploy_48.svg', name: 'CodeDeploy', category: 'aws', keywords: ['aws', 'deploy'] }),
  awsCodeCommit: { icon: GitHubIcon, name: 'CodeCommit', category: 'aws', keywords: ['aws', 'git'] },
  awsXRay: { icon: TimelineIcon, name: 'X-Ray', category: 'aws', keywords: ['aws', 'tracing'] },
  awsCloudWatchLogs: { icon: DescriptionIcon, name: 'CloudWatch Logs', category: 'aws', keywords: ['aws', 'logs'] },

  // Additional Azure Services
  azureContainerApps: { icon: AppsIcon, name: 'Container Apps', category: 'azure', keywords: ['azure', 'containers'] },
  azureBatch: getVendorIcon({ vendor: 'azure', subcategory: 'compute', filename: '10031-icon-service-Batch-Accounts.svg', name: 'Batch', category: 'azure', keywords: ['azure', 'compute'] }),
  azureDataLakeStorage: { icon: StorageIcon, name: 'Data Lake Storage', category: 'azure', keywords: ['azure', 'storage'] },
  azureSynapseAnalytics: getVendorIcon({ vendor: 'azure', subcategory: 'analytics', filename: '00606-icon-service-Azure-Synapse-Analytics.svg', name: 'Synapse Analytics', category: 'azure', keywords: ['azure', 'analytics'] }),
  azureDatabaseForPostgreSQL: getVendorIcon({ vendor: 'azure', subcategory: 'databases', filename: '10131-icon-service-Azure-Database-PostgreSQL-Server.svg', name: 'PostgreSQL', category: 'azure', keywords: ['azure', 'database'] }),
  azureDatabaseForMySQL: getVendorIcon({ vendor: 'azure', subcategory: 'databases', filename: '10122-icon-service-Azure-Database-MySQL-Server.svg', name: 'MySQL', category: 'azure', keywords: ['azure', 'database'] }),
  azureVPNGateway: getVendorIcon({ vendor: 'azure', subcategory: 'networking', filename: '10063-icon-service-Virtual-Network-Gateways.svg', name: 'VPN Gateway', category: 'azure', keywords: ['azure', 'network'] }),
  azureExpressRoute: { icon: RouterIcon, name: 'ExpressRoute', category: 'azure', keywords: ['azure', 'network'] },
  azureTrafficManager: getVendorIcon({ vendor: 'azure', subcategory: 'networking', filename: '10065-icon-service-Traffic-Manager-Profiles.svg', name: 'Traffic Manager', category: 'azure', keywords: ['azure', 'loadbalancer'] }),
  azureDNS: getVendorIcon({ vendor: 'azure', subcategory: 'networking', filename: '10064-icon-service-DNS-Zones.svg', name: 'DNS', category: 'azure', keywords: ['azure', 'dns'] }),
  azureADB2C: { icon: GroupIcon, name: 'Azure AD B2C', category: 'azure', keywords: ['azure', 'identity'] },
  azureManagedIdentity: getVendorIcon({ vendor: 'azure', subcategory: 'identity', filename: '10227-icon-service-Managed-Identities.svg', name: 'Managed Identity', category: 'azure', keywords: ['azure', 'identity'] }),
  azureInformationProtection: { icon: PrivacyTipIcon, name: 'Information Protection', category: 'azure', keywords: ['azure', 'dlp'] },
  azurePrivilegedIdentityManagement: { icon: AdminPanelSettingsIcon, name: 'PIM', category: 'azure', keywords: ['azure', 'pam'] },
  azureSecurityCenter: { icon: SecurityIcon, name: 'Security Center', category: 'azure', keywords: ['azure', 'security'] },
  azureSentinel: { icon: RadarIcon, name: 'Sentinel', category: 'azure', keywords: ['azure', 'siem'] },
  azureDefender: { icon: ShieldIcon, name: 'Defender', category: 'azure', keywords: ['azure', 'security'] },
  azureFirewall: { icon: ShieldIcon, name: 'Firewall', category: 'azure', keywords: ['azure', 'firewall'] },
  azureDDoSProtection: { icon: SecurityIcon, name: 'DDoS Protection', category: 'azure', keywords: ['azure', 'ddos'] },
  azureBastion: { icon: MeetingRoomIcon, name: 'Bastion', category: 'azure', keywords: ['azure', 'bastion'] },
  azurePrivateLink: { icon: VpnLockIcon, name: 'Private Link', category: 'azure', keywords: ['azure', 'network'] },
  azurePolicy: { icon: PolicyIcon, name: 'Policy', category: 'azure', keywords: ['azure', 'governance'] },
  azureBlueprints: { icon: AccountTreeIcon, name: 'Blueprints', category: 'azure', keywords: ['azure', 'governance'] },
  azureArc: { icon: CloudCircleIcon, name: 'Arc', category: 'azure', keywords: ['azure', 'hybrid'] },
  azureLogAnalytics: getVendorIcon({ vendor: 'azure', subcategory: 'management-governance', filename: '00009-icon-service-Log-Analytics-Workspaces.svg', name: 'Log Analytics', category: 'azure', keywords: ['azure', 'logging'] }),
  azureApplicationInsights: getVendorIcon({ vendor: 'azure', subcategory: 'devops', filename: '00012-icon-service-Application-Insights.svg', name: 'Application Insights', category: 'azure', keywords: ['azure', 'monitoring'] }),
  azureAutomation: getVendorIcon({ vendor: 'azure', subcategory: 'management-governance', filename: '00022-icon-service-Automation-Accounts.svg', name: 'Automation', category: 'azure', keywords: ['azure', 'automation'] }),
  azureDevOps: { icon: CodeIcon, name: 'DevOps', category: 'azure', keywords: ['azure', 'devops'] },
  azureArtifacts: { icon: AllInboxIcon, name: 'Artifacts', category: 'azure', keywords: ['azure', 'artifacts'] },
  azurePipelines: { icon: AccountTreeIcon, name: 'Pipelines', category: 'azure', keywords: ['azure', 'cicd'] },

  // Additional GCP Services
  gcpBatch: { icon: ForumIcon, name: 'Batch', category: 'gcp', keywords: ['gcp', 'compute'] },
  gcpFilestore: { icon: FolderIcon, name: 'Filestore', category: 'gcp', keywords: ['gcp', 'storage'] },
  gcpArtifactRegistry: { icon: AllInboxIcon, name: 'Artifact Registry', category: 'gcp', keywords: ['gcp', 'artifacts'] },
  gcpSpanner: getVendorIcon({ vendor: 'gcp', subcategory: 'core-products', filename: 'CloudSpanner-512-color.svg', name: 'Spanner', category: 'gcp', keywords: ['gcp', 'database'] }),
  gcpMemorystore: { icon: StorageIcon, name: 'Memorystore', category: 'gcp', keywords: ['gcp', 'cache'] },
  gcpCloudCDN: { icon: PublicIcon, name: 'Cloud CDN', category: 'gcp', keywords: ['gcp', 'cdn'] },
  gcpCloudDNS: { icon: DnsIcon, name: 'Cloud DNS', category: 'gcp', keywords: ['gcp', 'dns'] },
  gcpCloudVPN: { icon: VpnLockIcon, name: 'Cloud VPN', category: 'gcp', keywords: ['gcp', 'vpn'] },
  gcpCloudInterconnect: { icon: RouterIcon, name: 'Cloud Interconnect', category: 'gcp', keywords: ['gcp', 'network'] },
  gcpCloudArmor: { icon: ShieldIcon, name: 'Cloud Armor', category: 'gcp', keywords: ['gcp', 'waf'] },
  gcpIAM: { icon: ManageAccountsIcon, name: 'IAM', category: 'gcp', keywords: ['gcp', 'identity'] },
  gcpIdentityPlatform: { icon: GroupIcon, name: 'Identity Platform', category: 'gcp', keywords: ['gcp', 'identity'] },
  gcpCloudIdentity: { icon: FingerprintIcon, name: 'Cloud Identity', category: 'gcp', keywords: ['gcp', 'identity'] },
  gcpSecretManager: { icon: KeyIcon, name: 'Secret Manager', category: 'gcp', keywords: ['gcp', 'secrets'] },
  gcpCloudKMS: { icon: VpnKeyIcon, name: 'Cloud KMS', category: 'gcp', keywords: ['gcp', 'encryption'] },
  gcpCertificateAuthority: { icon: VerifiedIcon, name: 'Certificate Authority', category: 'gcp', keywords: ['gcp', 'certificates'] },
  gcpSecurityCommandCenter: getVendorIcon({ vendor: 'gcp', subcategory: 'core-products', filename: 'SecurityCommandCenter-512-color.svg', name: 'Security Command Center', category: 'gcp', keywords: ['gcp', 'security'] }),
  gcpWebSecurityScanner: { icon: BugReportIcon, name: 'Web Security Scanner', category: 'gcp', keywords: ['gcp', 'security'] },
  gcpCloudIDS: { icon: RadarIcon, name: 'Cloud IDS', category: 'gcp', keywords: ['gcp', 'ids'] },
  gcpBinaryAuthorization: { icon: VerifiedIcon, name: 'Binary Authorization', category: 'gcp', keywords: ['gcp', 'security'] },
  gcpContainerAnalysis: { icon: BugReportIcon, name: 'Container Analysis', category: 'gcp', keywords: ['gcp', 'security'] },
  gcpCloudDLP: { icon: PrivacyTipIcon, name: 'Cloud DLP', category: 'gcp', keywords: ['gcp', 'dlp'] },
  gcpVPCServiceControls: { icon: ShieldIcon, name: 'VPC Service Controls', category: 'gcp', keywords: ['gcp', 'security'] },
  gcpAccessContextManager: { icon: PolicyIcon, name: 'Access Context Manager', category: 'gcp', keywords: ['gcp', 'access'] },
  gcpPolicyIntelligence: { icon: AssessmentIcon, name: 'Policy Intelligence', category: 'gcp', keywords: ['gcp', 'policy'] },
  gcpAutoML: { icon: SmartToyIcon, name: 'AutoML', category: 'gcp', keywords: ['gcp', 'ml'] },
  gcpAIPlatform: { icon: PsychologyIcon, name: 'AI Platform', category: 'gcp', keywords: ['gcp', 'ml'] },
  gcpCloudMonitoring: { icon: MonitorIcon, name: 'Cloud Monitoring', category: 'gcp', keywords: ['gcp', 'monitoring'] },
  gcpCloudLogging: { icon: DescriptionIcon, name: 'Cloud Logging', category: 'gcp', keywords: ['gcp', 'logging'] },
  gcpCloudTrace: { icon: TimelineIcon, name: 'Cloud Trace', category: 'gcp', keywords: ['gcp', 'tracing'] },
  gcpCloudProfiler: { icon: AssessmentIcon, name: 'Cloud Profiler', category: 'gcp', keywords: ['gcp', 'profiling'] },
  gcpCloudBuild: { icon: BuildCircleIcon, name: 'Cloud Build', category: 'gcp', keywords: ['gcp', 'cicd'] },
  gcpCloudDeploy: { icon: RocketLaunchIcon, name: 'Cloud Deploy', category: 'gcp', keywords: ['gcp', 'deploy'] },
  gcpCloudSourceRepositories: { icon: GitHubIcon, name: 'Source Repositories', category: 'gcp', keywords: ['gcp', 'git'] },

  // Additional IBM Services
  ibmBareMetalServer: getVendorIcon({ vendor: 'ibm', subcategory: 'Compute', filename: 'Bare Metal Server.svg', name: 'Bare Metal Server', category: 'ibm', keywords: ['ibm', 'compute'] }),
  ibmCodeEngine: { icon: AppsIcon, name: 'Code Engine', category: 'ibm', keywords: ['ibm', 'serverless'] },
  ibmCloudFunctions: { icon: FunctionsIcon, name: 'Cloud Functions', category: 'ibm', keywords: ['ibm', 'serverless'] },
  ibmKubernetes: getVendorIcon({ vendor: 'ibm', subcategory: 'Compute', filename: 'Kubernetes.svg', name: 'Kubernetes Service', category: 'ibm', keywords: ['ibm', 'kubernetes'] }),
  ibmRedHatOpenShift: getVendorIcon({ vendor: 'ibm', subcategory: 'Compute', filename: 'Open Shift.svg', name: 'Red Hat OpenShift', category: 'ibm', keywords: ['ibm', 'kubernetes'] }),
  ibmBlockStorage: getVendorIcon({ vendor: 'ibm', subcategory: 'Data & Storage', filename: 'Block Storage Application.svg', name: 'Block Storage', category: 'ibm', keywords: ['ibm', 'storage'] }),
  ibmFileStorage: getVendorIcon({ vendor: 'ibm', subcategory: 'Data & Storage', filename: 'File Storage.svg', name: 'File Storage', category: 'ibm', keywords: ['ibm', 'storage'] }),
  ibmCloudant: { icon: StorageIcon, name: 'Cloudant', category: 'ibm', keywords: ['ibm', 'database'] },
  ibmDB2: { icon: StorageIcon, name: 'DB2', category: 'ibm', keywords: ['ibm', 'database'] },
  ibmDatabases: { icon: StorageIcon, name: 'Databases', category: 'ibm', keywords: ['ibm', 'database'] },
  ibmLoadBalancer: getVendorIcon({ vendor: 'ibm', subcategory: 'Networking', filename: 'Load Balancer VPC.svg', name: 'Load Balancer', category: 'ibm', keywords: ['ibm', 'network'] }),
  ibmCloudInternetServices: { icon: PublicIcon, name: 'Cloud Internet Services', category: 'ibm', keywords: ['ibm', 'cdn'] },
  ibmDirectLink: getVendorIcon({ vendor: 'ibm', subcategory: 'Networking', filename: 'Direct Link.svg', name: 'Direct Link', category: 'ibm', keywords: ['ibm', 'network'] }),
  ibmTransitGateway: { icon: HubIcon, name: 'Transit Gateway', category: 'ibm', keywords: ['ibm', 'network'] },
  ibmCloudIAM: getVendorIcon({ vendor: 'ibm', subcategory: 'Security', filename: 'Identity and Access Management.svg', name: 'Cloud IAM', category: 'ibm', keywords: ['ibm', 'identity'] }),
  ibmAppID: { icon: AccountCircleIcon, name: 'App ID', category: 'ibm', keywords: ['ibm', 'auth'] },
  ibmKeyProtect: getVendorIcon({ vendor: 'ibm', subcategory: 'Security', filename: 'Key.svg', name: 'Key Protect', category: 'ibm', keywords: ['ibm', 'encryption'] }),
  ibmSecretsManager: getVendorIcon({ vendor: 'ibm', subcategory: 'Security', filename: 'Secrets Manager.svg', name: 'Secrets Manager', category: 'ibm', keywords: ['ibm', 'secrets'] }),
  ibmSecurityAdvisor: { icon: SecurityIcon, name: 'Security Advisor', category: 'ibm', keywords: ['ibm', 'security'] },
  ibmCertificateManager: getVendorIcon({ vendor: 'ibm', subcategory: 'Security', filename: 'Certificate.svg', name: 'Certificate Manager', category: 'ibm', keywords: ['ibm', 'certificates'] }),
  ibmHyperProtect: { icon: ShieldIcon, name: 'Hyper Protect', category: 'ibm', keywords: ['ibm', 'encryption'] },
  ibmCloudFirewall: { icon: ShieldIcon, name: 'Cloud Firewall', category: 'ibm', keywords: ['ibm', 'firewall'] },
  ibmCloudMonitoring: getVendorIcon({ vendor: 'ibm', subcategory: 'Observability', filename: 'cloud--monitoring.svg', name: 'Cloud Monitoring', category: 'ibm', keywords: ['ibm', 'monitoring'] }),
  ibmLogAnalysis: getVendorIcon({ vendor: 'ibm', subcategory: 'Observability', filename: 'cloud--logging.svg', name: 'Log Analysis', category: 'ibm', keywords: ['ibm', 'logging'] }),
  ibmActivityTracker: getVendorIcon({ vendor: 'ibm', subcategory: 'Observability', filename: 'cloud--auditing.svg', name: 'Activity Tracker', category: 'ibm', keywords: ['ibm', 'audit'] }),
  ibmWatsonStudio: { icon: PsychologyIcon, name: 'Watson Studio', category: 'ibm', keywords: ['ibm', 'ai'] },
  ibmWatsonAssistant: { icon: SmartToyIcon, name: 'Watson Assistant', category: 'ibm', keywords: ['ibm', 'ai'] },
  ibmWatsonDiscovery: { icon: SearchIcon, name: 'Watson Discovery', category: 'ibm', keywords: ['ibm', 'ai'] },
  ibmContinuousDelivery: getVendorIcon({ vendor: 'ibm', subcategory: 'DevOps', filename: 'Continuous Delivery.svg', name: 'Continuous Delivery', category: 'ibm', keywords: ['ibm', 'cicd'] }),
  ibmCloudShell: { icon: CodeIcon, name: 'Cloud Shell', category: 'ibm', keywords: ['ibm', 'terminal'] },

  // Generic fallback
  generic: { icon: DevicesIcon, name: 'Generic', category: 'infrastructure' }
};

// Helper function to get icon by node type
export const getIconForNodeType = (nodeType: string): React.ElementType => {
  return materialIconMappings[nodeType]?.icon || DevicesIcon;
};

// Helper function to get all icons in a category
export const getIconsByCategory = (category: string): IconMapping[] => {
  return Object.values(materialIconMappings).filter(mapping => mapping.category === category);
};

// Get all categories
export const getIconCategories = (): string[] => {
  const categories = Object.values(materialIconMappings).map(mapping => mapping.category);
  const uniqueCategories = Array.from(new Set(categories));
  return uniqueCategories;
};

// Get all icons for search
export const getAllIcons = (): IconMapping[] => {
  return Object.values(materialIconMappings);
};
