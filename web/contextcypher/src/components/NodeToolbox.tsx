import React, { useState, useMemo } from 'react';
import { 
  Box, 
  Typography, 
  List, 
  ListItem, 
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  Paper,
  Divider
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
// import RemoveIcon from '@mui/icons-material/Remove';
import ViewModuleIcon from '@mui/icons-material/ViewModule';

// Category Icons
import RouterIcon from '@mui/icons-material/Router';
import AppsIcon from '@mui/icons-material/Apps';
import CloudIcon from '@mui/icons-material/Cloud';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import WarningIcon from '@mui/icons-material/Warning';
import LockIcon from '@mui/icons-material/Lock';
import MemoryIcon from '@mui/icons-material/Memory';
import BugReportIcon from '@mui/icons-material/BugReport';
import SecurityIcon from '@mui/icons-material/Security';
import SearchIcon from '@mui/icons-material/Search';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import TableRowsIcon from '@mui/icons-material/TableRows';
import BorderStyleIcon from '@mui/icons-material/BorderStyle';

// Component Icons
import DnsIcon from '@mui/icons-material/Dns';
import ComputerIcon from '@mui/icons-material/Computer';
import DevicesIcon from '@mui/icons-material/Devices';
import PrintIcon from '@mui/icons-material/Print';
import SettingsInputAntennaIcon from '@mui/icons-material/SettingsInputAntenna';
import HubIcon from '@mui/icons-material/Hub';
import ShieldIcon from '@mui/icons-material/Shield';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import PolicyIcon from '@mui/icons-material/Policy';
import WebAssetIcon from '@mui/icons-material/WebAsset';
import StorageIcon from '@mui/icons-material/Storage';
import ApiIcon from '@mui/icons-material/Api';
import HttpIcon from '@mui/icons-material/Http';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import ForumIcon from '@mui/icons-material/Forum';
import DataUsageIcon from '@mui/icons-material/DataUsage';
import FolderIcon from '@mui/icons-material/Folder';
import KeyIcon from '@mui/icons-material/Key';
import GroupIcon from '@mui/icons-material/Group';
import AssessmentIcon from '@mui/icons-material/Assessment';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import AllInboxIcon from '@mui/icons-material/AllInbox';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import LayersIcon from '@mui/icons-material/Layers';
import FunctionsIcon from '@mui/icons-material/Functions';
import BalanceIcon from '@mui/icons-material/Balance';
import CloudCircleIcon from '@mui/icons-material/CloudCircle';
import SensorsIcon from '@mui/icons-material/Sensors';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import HistoryIcon from '@mui/icons-material/History';
import CellTowerIcon from '@mui/icons-material/CellTower';
import TuneIcon from '@mui/icons-material/Tune';
// import PowerIcon from '@mui/icons-material/Power';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import WifiIcon from '@mui/icons-material/Wifi';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import PsychologyIcon from '@mui/icons-material/PsychologyAlt';
import ModelTrainingIcon from '@mui/icons-material/ModelTraining';
import DatasetIcon from '@mui/icons-material/Dataset';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import SchemaIcon from '@mui/icons-material/Schema';
import BiotechIcon from '@mui/icons-material/Biotech';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined';
import PhishingIcon from '@mui/icons-material/Phishing';
import RadarIcon from '@mui/icons-material/Radar';
import ScienceIcon from '@mui/icons-material/Science';
import FindInPageIcon from '@mui/icons-material/FindInPage';
import GavelIcon from '@mui/icons-material/Gavel';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import DataThresholdingIcon from '@mui/icons-material/DataThresholding';
import { Category as CategoryIconMUI } from '@mui/icons-material';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import SchoolIcon from '@mui/icons-material/School';
import BuildIcon from '@mui/icons-material/Build';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import BlurOnIcon from '@mui/icons-material/BlurOn';

// Import vendor icon utilities
import { getVendorIconComponent, VendorKey } from '../utils/vendorIconMappings';
import PrivacyTipIcon from '@mui/icons-material/PrivacyTip';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import PersonIcon from '@mui/icons-material/Person';
import DataArrayIcon from '@mui/icons-material/DataArray';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import BackupIcon from '@mui/icons-material/Backup';
import InputIcon from '@mui/icons-material/Input';
import OutputIcon from '@mui/icons-material/Output';
import SettingsIcon from '@mui/icons-material/Settings';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import TokenIcon from '@mui/icons-material/Token';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import DescriptionIcon from '@mui/icons-material/Description';
import PestControlIcon from '@mui/icons-material/PestControl';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import WifiTetheringIcon from '@mui/icons-material/WifiTethering';
import CatchingPokemonIcon from '@mui/icons-material/CatchingPokemon';
import EmailIcon from '@mui/icons-material/Email';
import LeakAddIcon from '@mui/icons-material/LeakAdd';
import TimelineIcon from '@mui/icons-material/Timeline';
import VpnLockIcon from '@mui/icons-material/VpnLock';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import RestoreIcon from '@mui/icons-material/Restore';
import PublicIcon from '@mui/icons-material/Public';
import BusinessIcon from '@mui/icons-material/Business';
import DomainIcon from '@mui/icons-material/Domain';
import MonitorIcon from '@mui/icons-material/Monitor';
import CorporateFareIcon from '@mui/icons-material/CorporateFare';
import LockPersonIcon from '@mui/icons-material/LockPerson';
import GppBadIcon from '@mui/icons-material/GppBad';
// import GppMaybeIcon from '@mui/icons-material/GppMaybe';
import FactoryIcon from '@mui/icons-material/Factory';
import CodeIcon from '@mui/icons-material/Code';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import PeopleIcon from '@mui/icons-material/People';
import VerifiedIcon from '@mui/icons-material/Verified';
import SettingsEthernetIcon from '@mui/icons-material/SettingsEthernet';
import HandshakeIcon from '@mui/icons-material/Handshake';
import BlockIcon from '@mui/icons-material/Block'; // For Quarantine/Isolation
import RouterOutlinedIcon from '@mui/icons-material/RouterOutlined'; // For Edge
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import CableIcon from '@mui/icons-material/Cable';
import NotificationsIcon from '@mui/icons-material/Notifications';
import QueueIcon from '@mui/icons-material/Queue';
import EventIcon from '@mui/icons-material/Event';
import LoginIcon from '@mui/icons-material/Login';
import FolderSharedIcon from '@mui/icons-material/FolderShared';
import SourceIcon from '@mui/icons-material/Source';
import DeveloperBoardIcon from '@mui/icons-material/DeveloperBoard';
import LinkIcon from '@mui/icons-material/Link';

// Security Component Icons
import SecurityUpdateIcon from '@mui/icons-material/SecurityUpdate';
import VpnLockOutlinedIcon from '@mui/icons-material/VpnLockOutlined';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import ScannerIcon from '@mui/icons-material/Scanner';
import EnhancedEncryptionIcon from '@mui/icons-material/EnhancedEncryption';
import PasswordIcon from '@mui/icons-material/Password';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import ContactlessIcon from '@mui/icons-material/Contactless';
import NetworkPingIcon from '@mui/icons-material/NetworkPing';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import RuleIcon from '@mui/icons-material/Rule';
import GitHubIcon from '@mui/icons-material/GitHub';
import DynamicFormIcon from '@mui/icons-material/DynamicForm';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import ElectricalServicesIcon from '@mui/icons-material/ElectricalServices';
import CurrencyBitcoinIcon from '@mui/icons-material/CurrencyBitcoin';
import CameraOutdoorIcon from '@mui/icons-material/CameraOutdoor';
import HubTwoToneIcon from '@mui/icons-material/HubTwoTone';
import LanguageIcon from '@mui/icons-material/Language';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import TerminalIcon from '@mui/icons-material/Terminal';

// Additional Infrastructure Icons
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import TabletIcon from '@mui/icons-material/Tablet';
import LaptopIcon from '@mui/icons-material/Laptop';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import HeadsetMicIcon from '@mui/icons-material/HeadsetMic';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import DataThresholdingOutlinedIcon from '@mui/icons-material/DataThresholdingOutlined';
import SpeedIcon from '@mui/icons-material/Speed';
import DeviceHubIcon from '@mui/icons-material/DeviceHub';
import SdStorageIcon from '@mui/icons-material/SdStorage';
import BackupTableIcon from '@mui/icons-material/BackupTable';
import DeviceThermostatIcon from '@mui/icons-material/DeviceThermostat';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import WifiProtectedSetupIcon from '@mui/icons-material/WifiProtectedSetup';
import RouterSharpIcon from '@mui/icons-material/RouterSharp';
import ImportExportIcon from '@mui/icons-material/ImportExport';
import CellWifiIcon from '@mui/icons-material/CellWifi';
import NetworkWifiIcon from '@mui/icons-material/NetworkWifi';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';

import { styled } from '@mui/material/styles';
import { 
  SecurityNodeType
} from '../types/SecurityTypes';
import { colors, getTheme, transitions } from '../styles/Theme';
// import { hoverEffects, animationStyles } from '../styles/animations';
import { SecurityZone } from '../types/SecurityTypes';
// import { loadVendorIcons } from '../utils/vendorIconMappings'; // Temporarily disabled to fix blank screen issue
import { useSettings } from '../settings/SettingsContext';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import NodeFinder from './NodeFinder';
import { SecurityNode, SecurityEdge } from '../types/SecurityTypes';

interface NodeToolboxProps {
  onDragStart: (event: React.DragEvent, nodeType: SecurityNodeType, zoneType?: SecurityZone) => void;
  onNodeCreate?: (nodeType: SecurityNodeType, zoneType?: SecurityZone) => void;
  isCompactViewport?: boolean;
  nodes: SecurityNode[];
  edges: SecurityEdge[];
}

interface NodeCategory {
  title: string;
  icon: React.ReactElement;
  nodes: Array<{
    type: SecurityNodeType;
    label: string;
    description: string;
    color: string;
    icon: React.ReactElement;
    zoneType?: SecurityZone;
  }>;
}

// Styled components
const StyledNodeItem = styled(ListItem)(({ theme }) => ({
  cursor: 'grab',
  borderRadius: theme.spacing(0.6),
  marginBottom: theme.spacing(0.6),
  padding: theme.spacing(0.8),
  fontSize: '12px',
  position: 'relative',
  overflow: 'hidden',
  transition: 'transform 0.1s ease',
  minHeight: '36px',
  '&:active': {
    cursor: 'grabbing',
    transform: 'scale(0.98)',
  },
}))

const NodeIcon = styled(Box)(({ theme }) => ({
  marginRight: theme.spacing(0.6),
  display: 'flex',
  alignItems: 'center',
  '& .MuiSvgIcon-root': {
    fontSize: '16px',
  }
}))

const StyledAccordion = styled(Accordion)(({ theme }) => ({
  backgroundColor: 'transparent',
  '&:before': { display: 'none' },
  boxShadow: 'none',
  '& .MuiAccordionSummary-root': {
    transition: transitions.colors,
    borderRadius: theme.spacing(1),
    paddingLeft: theme.spacing(1.2),
    paddingRight: theme.spacing(1.2),
    minHeight: '40px',
    '&:hover': {
      backgroundColor: theme.colors.surfaceHover,
    },
  },
  '& .MuiAccordionSummary-expandIconWrapper': {
    transition: transitions.transform,
  },
  '& .MuiAccordionSummary-expandIconWrapper.Mui-expanded': {
    transform: 'rotate(180deg)',
  },
}))

const StyledPaper = styled(Box)(({ theme }) => ({
  backgroundColor: theme.colors.surface,
  height: '100%',
  minHeight: 0,
  overflowY: 'auto',
  WebkitOverflowScrolling: 'touch',
  touchAction: 'pan-y',
  transition: transitions.colors,
  display: 'flex',
  flexDirection: 'column',
  '&::-webkit-scrollbar': {
    width: '6px',
  },
  '&::-webkit-scrollbar-track': {
    background: theme.colors.background,
  },
  '&::-webkit-scrollbar-thumb': {
    background: theme.colors.border,
    borderRadius: '3px',
    '&:hover': {
      background: theme.colors.surfaceHover,
    },
  },
}))

const ToolboxHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(1.2),
  borderBottom: `1px solid ${theme.colors.border}`,
  flexShrink: 0,
}))

const CategoryIcon = styled(Box)(({ theme }) => ({
  marginRight: theme.spacing(1),
  display: 'flex',
  alignItems: 'center',
  '& .MuiSvgIcon-root': {
    fontSize: '18px',
  }
}))

// Node Selector Styles
const NodeSelectorContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(1.5),
  margin: theme.spacing(0.8),
  backgroundColor: theme.colors.surface,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.spacing(1),
  WebkitOverflowScrolling: 'touch',
  touchAction: 'pan-y',
  '& .MuiFormControl-root': {
    minWidth: '100%',
    marginBottom: theme.spacing(1),
  },
  '& .MuiSelect-select': {
    fontSize: '13px',
    padding: '8px 12px',
  }
}))

const createVendorIconElement = (vendor: VendorKey, subcategory: string, filename: string) =>
  React.createElement(getVendorIconComponent({ vendor, subcategory, filename }), {
    sx: { fontSize: 16 },
    style: { width: 16, height: 16, display: 'block' }
  });

const DraggableNodePreview = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(1),
  padding: theme.spacing(1),
  border: '2px dashed',
  borderRadius: theme.spacing(0.8),
  cursor: 'grab',
  transition: 'all 0.2s ease',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '48px',
  '&:active': {
    cursor: 'grabbing',
    transform: 'scale(0.95)',
  },
  '&:hover': {
    transform: 'scale(1.02)',
  }
}))

const nodeCategories: NodeCategory[] = [
  {
    title: "Threat Modeling (DFD)",
    icon: <AccountTreeIcon />,
    nodes: [
      { 
        type: 'dfdActor', 
        label: 'DFD External Entity', 
        description: 'External entity (user, web app, REST API, Lambda function, mobile app, third-party service)', 
        color: colors.userColor, 
        icon: <RadioButtonUncheckedIcon /> 
      },
      { 
        type: 'dfdProcess', 
        label: 'DFD Process', 
        description: 'Processing element (application, service, function, microservice)', 
        color: colors.applicationColor, 
        icon: <CropSquareIcon /> 
      },
      { 
        type: 'dfdDataStore', 
        label: 'DFD Data Store', 
        description: 'Data storage (database, file system, cache, queue, blob storage)', 
        color: colors.databaseColor, 
        icon: <TableRowsIcon /> 
      },
      { 
        type: 'dfdTrustBoundary', 
        label: 'DFD Trust Boundary', 
        description: 'Trust boundary between different security contexts (network, process, privilege)', 
        color: colors.zoneColors.DMZ, 
        icon: <BorderStyleIcon /> 
      }
    ]
  },
  {
    title: "Security Zones",
    icon: <SecurityIcon />,
    nodes: [
      // Network Perimeter
              { 
                type: 'securityZone',
                label: 'Internet Zone', 
                description: 'Public internet zone, least trusted, exposed to external users',
                color: colors.zoneColors.Internet,
                icon: <PublicIcon />,
                zoneType: 'Internet'
              },
      { 
        type: 'securityZone',
        label: 'External Network', 
        description: 'Third-party services, partner connections, external APIs',
        color: colors.zoneColors.External,
        icon: <BusinessIcon />,
        zoneType: 'External'
      },
      { 
        type: 'securityZone',
        label: 'DMZ', 
        description: 'Buffer zone for internet-accessible services',
        color: colors.zoneColors.DMZ,
        icon: <DomainIcon />,
        zoneType: 'DMZ'
      },
      
      // Internal Networks
      { 
        type: 'securityZone',
        label: 'Internal Network', 
        description: 'Main network for internal users and operations',
        color: colors.zoneColors.Internal,
        icon: <CorporateFareIcon />,
        zoneType: 'Internal'
      },
      { 
        type: 'securityZone',
        label: 'Trusted Zone', 
        description: 'Secure area within internal network',
        color: colors.zoneColors.Trusted,
        icon: <VerifiedIcon />,
        zoneType: 'Trusted'
      },
      { 
        type: 'securityZone',
        label: 'Restricted Zone', 
        description: 'Highly controlled zone with strict access',
        color: colors.zoneColors.Restricted,
        icon: <LockPersonIcon />,
        zoneType: 'Restricted'
      },
      { 
        type: 'securityZone',
        label: 'Critical Zone', 
        description: 'Mission-critical systems requiring highest security',
        color: colors.zoneColors.Critical,
        icon: <GppBadIcon />,
        zoneType: 'Critical'
      },
      
      // Development Lifecycle
      { 
        type: 'securityZone',
        label: 'Development', 
        description: 'Isolated environment for development and testing',
        color: colors.zoneColors.Development,
        icon: <CodeIcon />,
        zoneType: 'Development'
      },
      { 
        type: 'securityZone',
        label: 'Staging', 
        description: 'Pre-production testing environment',
        color: colors.zoneColors.Staging,
        icon: <ScienceOutlinedIcon />,
        zoneType: 'Staging'
      },
      { 
        type: 'securityZone',
        label: 'Production', 
        description: 'Live environment with strict security controls',
        color: colors.zoneColors.Production,
        icon: <RocketLaunchIcon />,
        zoneType: 'Production'
      },
      
      // Cloud & External
      { 
        type: 'securityZone',
        label: 'Cloud Services', 
        description: 'Cloud environments and services',
        color: colors.zoneColors.Cloud,
        icon: <CloudDoneIcon />,
        zoneType: 'Cloud'
      },
      { 
        type: 'securityZone',
        label: 'Hybrid Zone', 
        description: 'Hybrid cloud connectivity zone',
        color: colors.zoneColors.Hybrid,
        icon: <CloudSyncIcon />,
        zoneType: 'Hybrid'
      },
      { 
        type: 'securityZone',
        label: 'Multi-Cloud Zone', 
        description: 'Multi-cloud integration zone',
        color: colors.zoneColors.MultiCloud,
        icon: <CloudQueueIcon />,
        zoneType: 'MultiCloud'
      },
      { 
        type: 'securityZone',
        label: 'Edge Zone', 
        description: 'Edge computing and CDN nodes',
        color: colors.zoneColors.Edge,
        icon: <RouterOutlinedIcon />,
        zoneType: 'Edge'
      },
      
      // Access & Guest
      { 
        type: 'securityZone',
        label: 'Guest Zone', 
        description: 'Limited access for unmanaged devices',
        color: colors.zoneColors.Guest,
        icon: <PeopleIcon />,
        zoneType: 'Guest'
      },
      { 
        type: 'securityZone',
        label: 'Partner Zone', 
        description: 'Partner/vendor access zone',
        color: colors.zoneColors.Partner,
        icon: <HandshakeIcon />,
        zoneType: 'Partner'
      },
      { 
        type: 'securityZone',
        label: 'Third Party Zone', 
        description: 'Third party integrations and services',
        color: colors.zoneColors.ThirdParty,
        icon: <CorporateFareIcon />,
        zoneType: 'ThirdParty'
      },
      
      // Specialized
      { 
        type: 'securityZone',
        label: 'OT Zone', 
        description: 'Industrial Control Systems and SCADA environment',
        color: colors.zoneColors.OT,
        icon: <FactoryIcon />,
        zoneType: 'OT'
      },
      { 
        type: 'securityZone',
        label: 'Management Zone', 
        description: 'Network management and administrative access',
        color: colors.zoneColors.Management,
        icon: <AdminPanelSettingsIcon />,
        zoneType: 'Management'
      },
      { 
        type: 'securityZone',
        label: 'Compliance Zone', 
        description: 'Systems handling regulated data (PCI, HIPAA, GDPR)',
        color: colors.zoneColors.Compliance,
        icon: <FactCheckIcon />,
        zoneType: 'Compliance'
      },
      
      // Infrastructure
      { 
        type: 'securityZone',
        label: 'Control Plane', 
        description: 'Network control plane (routing, switching control)',
        color: colors.zoneColors.ControlPlane,
        icon: <SettingsEthernetIcon />,
        zoneType: 'ControlPlane'
      },
      { 
        type: 'securityZone',
        label: 'Data Plane', 
        description: 'Network data plane (actual data forwarding)',
        color: colors.zoneColors.DataPlane,
        icon: <DataUsageIcon />,
        zoneType: 'DataPlane'
      },
      { 
        type: 'securityZone',
        label: 'Service Mesh', 
        description: 'Service mesh control and data plane',
        color: colors.zoneColors.ServiceMesh,
        icon: <HubIcon />,
        zoneType: 'ServiceMesh'
      },
      
      // Operations
      { 
        type: 'securityZone',
        label: 'Back Office', 
        description: 'Back office operations and support systems',
        color: colors.zoneColors.BackOffice,
        icon: <BusinessIcon />,
        zoneType: 'BackOffice'
      },
      { 
        type: 'securityZone',
        label: 'Quarantine Zone', 
        description: 'Isolated systems for security analysis',
        color: colors.zoneColors.Quarantine,
        icon: <BlockIcon />,
        zoneType: 'Quarantine'
      },
      { 
        type: 'securityZone',
        label: 'Recovery Zone', 
        description: 'Disaster recovery and backup systems',
        color: colors.zoneColors.Recovery,
        icon: <BackupIcon />,
        zoneType: 'Recovery'
      },
      
      // Security Team Zones
      { 
        type: 'securityZone',
        label: 'Red Team Zone', 
        description: 'Red team acts as attackers, simulating real-world cyberattacks to identify vulnerabilities',
        color: colors.zoneColors.RedTeam,
        icon: <BugReportIcon />,
        zoneType: 'RedTeam'
      },
      { 
        type: 'securityZone',
        label: 'Blue Team Zone', 
        description: 'Blue team focuses on defending systems and networks, implementing security controls and monitoring',
        color: colors.zoneColors.BlueTeam,
        icon: <ShieldIcon />,
        zoneType: 'BlueTeam'
      },
      { 
        type: 'securityZone',
        label: 'Purple Team Zone', 
        description: 'Purple team bridges red and blue teams, facilitating communication and collaborative improvement',
        color: colors.zoneColors.PurpleTeam,
        icon: <SecurityIcon />,
        zoneType: 'PurpleTeam'
      },
      { 
        type: 'securityZone',
        label: 'Yellow Team Zone', 
        description: 'Yellow team focuses on building secure applications from the ground up with DevSecOps practices',
        color: colors.zoneColors.YellowTeam,
        icon: <BuildIcon />,
        zoneType: 'YellowTeam'
      },
      { 
        type: 'securityZone',
        label: 'Green Team Zone', 
        description: 'Green team works with developers to implement secure coding practices and security monitoring',
        color: colors.zoneColors.GreenTeam,
        icon: <CodeIcon />,
        zoneType: 'GreenTeam'
      },
      { 
        type: 'securityZone',
        label: 'Orange Team Zone', 
        description: 'Orange team conducts security awareness training for developers, focusing on attack vectors',
        color: colors.zoneColors.OrangeTeam,
        icon: <SchoolIcon />,
        zoneType: 'OrangeTeam'
      },
      { 
        type: 'securityZone',
        label: 'White Team Zone', 
        description: 'White team provides objective assessment of red and blue team activities, ensuring fair execution',
        color: colors.zoneColors.WhiteTeam,
        icon: <BalanceIcon />,
        zoneType: 'WhiteTeam'
      }
    ]
  },
  {
    title: "Security Components",
    icon: <SecurityIcon />,
    nodes: [
      // Network Security
      { type: 'firewall', label: 'Firewall', description: 'Network firewall', color: colors.firewallColor, icon: <ShieldIcon /> },
      { type: 'vpnGateway', label: 'VPN Gateway', description: 'VPN Gateway', color: colors.vpnGatewayColor, icon: <VpnKeyIcon /> },
      { type: 'ids', label: 'IDS', description: 'Intrusion Detection System', color: colors.idsColor, icon: <PolicyIcon /> },
      { type: 'ips', label: 'IPS', description: 'Intrusion Prevention System', color: colors.ipsColor, icon: <SecurityUpdateIcon /> },
      { type: 'waf', label: 'WAF', description: 'Web Application Firewall', color: colors.wafColor, icon: <WebAssetIcon /> },
      { type: 'proxy', label: 'Proxy', description: 'Network proxy server', color: colors.proxyColor, icon: <SettingsInputAntennaIcon /> },
      { type: 'reverseProxy', label: 'Reverse Proxy', description: 'Reverse proxy server', color: colors.reverseProxyColor, icon: <SwapHorizIcon /> },
      { type: 'monitor', label: 'Monitor', description: 'Network monitoring system', color: colors.monitorColor, icon: <RadarIcon /> },
      
      // Security Operations
      { type: 'siem', label: 'SIEM', description: 'Security Information and Event Management', color: colors.siemColor, icon: <AssessmentIcon /> },
      { type: 'soar', label: 'SOAR', description: 'Security Orchestration, Automation and Response', color: colors.soarColor, icon: <HubTwoToneIcon /> },
      { type: 'xdr', label: 'XDR', description: 'Extended Detection and Response', color: colors.xdrColor, icon: <RadarIcon /> },
      { type: 'edr', label: 'EDR', description: 'Endpoint Detection and Response', color: colors.edrColor, icon: <ComputerIcon /> },
      { type: 'ndr', label: 'NDR', description: 'Network Detection and Response', color: colors.ndrColor, icon: <NetworkCheckIcon /> },
      
      // Cloud Security
      { type: 'casb', label: 'CASB', description: 'Cloud Access Security Broker', color: colors.casbColor, icon: <CloudDoneIcon /> },
      { type: 'sase', label: 'SASE', description: 'Secure Access Service Edge', color: colors.saseColor, icon: <CloudCircleIcon /> },
      { type: 'ztna', label: 'ZTNA', description: 'Zero Trust Network Access', color: colors.ztnaColor, icon: <BlockIcon /> },
      
      // Data Protection
      { type: 'dlp', label: 'DLP', description: 'Data Loss Prevention', color: colors.dlpColor, icon: <LockIcon /> },
      { type: 'dam', label: 'DAM', description: 'Database Activity Monitoring', color: colors.damColor, icon: <StorageIcon /> },
      { type: 'pam', label: 'PAM', description: 'Privileged Access Management', color: colors.pamColor, icon: <AdminPanelSettingsIcon /> },
      
      // Cryptography
      { type: 'hsm', label: 'HSM', description: 'Hardware Security Module', color: colors.hsmColor, icon: <EnhancedEncryptionIcon /> },
      { type: 'kms', label: 'KMS', description: 'Key Management Service', color: colors.kmsColor, icon: <KeyIcon /> },
      { type: 'secretsManager', label: 'Secrets Manager', description: 'Secrets and credential storage', color: colors.secretsManagerColor, icon: <PasswordIcon /> },
      { type: 'certificateAuthority', label: 'CA', description: 'Certificate Authority', color: colors.certificateAuthorityColor, icon: <VerifiedUserIcon /> },
      
      // Identity & Access
      { type: 'mfa', label: 'MFA', description: 'Multi-Factor Authentication', color: colors.mfaColor, icon: <FingerprintIcon /> },
      { type: 'sso', label: 'SSO', description: 'Single Sign-On', color: colors.ssoColor, icon: <AccountCircleIcon /> },
      { type: 'ldap', label: 'LDAP', description: 'Lightweight Directory Access Protocol', color: colors.ldapColor, icon: <GroupIcon /> },
      { type: 'radiusServer', label: 'RADIUS', description: 'Remote Authentication Dial-In User Service', color: colors.radiusServerColor, icon: <ContactlessIcon /> },
      
      // Deception
      { type: 'honeypot', label: 'Honeypot', description: 'Decoy system to attract attackers', color: colors.honeypotColor, icon: <CatchingPokemonIcon /> },
      { type: 'honeynet', label: 'Honeynet', description: 'Network of honeypots', color: colors.honeynetColor, icon: <WifiTetheringIcon /> },
      { type: 'deceptionSystem', label: 'Deception', description: 'Advanced deception technology', color: colors.deceptionSystemColor, icon: <BlurOnIcon /> },
      
      // Network Analysis
      { type: 'networkTap', label: 'Network TAP', description: 'Network test access point', color: colors.networkTapColor, icon: <NetworkPingIcon /> },
      { type: 'packetCapture', label: 'Packet Capture', description: 'Network packet capture tool', color: colors.packetCaptureColor, icon: <ScannerIcon /> },
      
      // Vulnerability Management
      { type: 'vulnerabilityScanner', label: 'Vuln Scanner', description: 'Vulnerability assessment tool', color: colors.vulnerabilityScannerColor, icon: <ManageSearchIcon /> },
      { type: 'patchManagement', label: 'Patch Mgmt', description: 'Patch management system', color: colors.patchManagementColor, icon: <BuildCircleIcon /> },
      { type: 'configManagement', label: 'Config Mgmt', description: 'Configuration management', color: colors.configManagementColor, icon: <SettingsSuggestIcon /> },
      { type: 'complianceScanner', label: 'Compliance', description: 'Compliance scanning tool', color: colors.complianceScannerColor, icon: <RuleIcon /> },
      
      // Security Testing
      { type: 'penTestTool', label: 'Pen Test', description: 'Penetration testing tools', color: colors.penTestToolColor, icon: <BugReportIcon /> },
      { type: 'staticAnalysis', label: 'SAST', description: 'Static Application Security Testing', color: colors.staticAnalysisColor, icon: <CodeIcon /> },
      { type: 'dynamicAnalysis', label: 'DAST', description: 'Dynamic Application Security Testing', color: colors.dynamicAnalysisColor, icon: <DynamicFormIcon /> },
      { type: 'containerScanner', label: 'Container Scan', description: 'Container security scanner', color: colors.containerScannerColor, icon: <AllInboxIcon /> },
      
      // More Security Controls
      { type: 'k8sAdmissionController', label: 'K8s Admission', description: 'Kubernetes admission controller', color: colors.k8sAdmissionControllerColor, icon: <VerifiedIcon /> },
      { type: 'meshProxy', label: 'Mesh Proxy', description: 'Service mesh security proxy', color: colors.meshProxyColor, icon: <SettingsInputAntennaIcon /> },
      { type: 'apiSecurity', label: 'API Security', description: 'API security gateway', color: colors.apiSecurityColor, icon: <ApiIcon /> },
      { type: 'botProtection', label: 'Bot Protection', description: 'Bot detection and mitigation', color: colors.botProtectionColor, icon: <SmartToyIcon /> },
      { type: 'ddosProtection', label: 'DDoS Protection', description: 'DDoS mitigation service', color: colors.ddosProtectionColor, icon: <BlockIcon /> },
      { type: 'emailSecurity', label: 'Email Security', description: 'Email security gateway', color: colors.emailSecurityColor, icon: <EmailIcon /> },
      { type: 'webFilter', label: 'Web Filter', description: 'Web content filtering', color: colors.webFilterColor, icon: <WebAssetIcon /> },
      
      // Threat Intelligence
      { type: 'sandboxAnalyzer', label: 'Sandbox', description: 'Malware sandbox analyzer', color: colors.sandboxAnalyzerColor, icon: <ScienceIcon /> },
      { type: 'threatIntelPlatform', label: 'Threat Intel', description: 'Threat intelligence platform', color: colors.threatIntelPlatformColor, icon: <RadarIcon /> },
      { type: 'forensicsStation', label: 'Forensics', description: 'Digital forensics workstation', color: colors.forensicsStationColor, icon: <FindInPageIcon /> },
      { type: 'incidentResponsePlatform', label: 'IR Platform', description: 'Incident response platform', color: colors.incidentResponsePlatformColor, icon: <NotificationsActiveIcon /> },
      
      // Backup & Recovery
      { type: 'backupSystem', label: 'Backup', description: 'Backup system', color: colors.backupSystemColor, icon: <BackupIcon /> },
      { type: 'disasterRecovery', label: 'DR System', description: 'Disaster recovery system', color: colors.disasterRecoveryColor, icon: <RestoreIcon /> },
      
      // Advanced Security
      { type: 'encryptionGateway', label: 'Encryption GW', description: 'Encryption gateway', color: colors.encryptionGatewayColor, icon: <LockOutlinedIcon /> },
      { type: 'tokenizer', label: 'Tokenizer', description: 'Data tokenization service', color: colors.tokenizerColor, icon: <TokenIcon /> },
      { type: 'riskAnalytics', label: 'Risk Analytics', description: 'Risk analysis platform', color: colors.riskAnalyticsColor, icon: <AnalyticsIcon /> },
      { type: 'identityGovernance', label: 'Identity Gov', description: 'Identity governance platform', color: colors.identityGovernanceColor, icon: <ManageAccountsIcon /> },
      
      // Cloud Security Posture
      { type: 'cloudSecurityPosture', label: 'CSPM', description: 'Cloud Security Posture Management', color: colors.cloudSecurityPostureColor, icon: <CloudDoneIcon /> },
      { type: 'workloadProtection', label: 'CWPP', description: 'Cloud Workload Protection Platform', color: colors.workloadProtectionColor, icon: <CloudCircleIcon /> },
      { type: 'runtimeProtection', label: 'Runtime', description: 'Runtime application protection', color: colors.runtimeProtectionColor, icon: <PlayCircleIcon /> },
      
      // DevSecOps
      { type: 'supplychainSecurity', label: 'Supply Chain', description: 'Software supply chain security', color: colors.supplychainSecurityColor, icon: <AccountTreeIcon /> },
      { type: 'codeRepository', label: 'Code Repo', description: 'Secure code repository', color: colors.codeRepositoryColor, icon: <GitHubIcon /> },
      { type: 'cicdSecurity', label: 'CI/CD Security', description: 'CI/CD pipeline security', color: colors.cicdSecurityColor, icon: <IntegrationInstructionsIcon /> },
      { type: 'secretScanner', label: 'Secret Scanner', description: 'Secrets detection in code', color: colors.secretScannerColor, icon: <VpnLockIcon /> },
      { type: 'sbom', label: 'SBOM', description: 'Software Bill of Materials', color: colors.sbomColor, icon: <DescriptionIcon /> },
      { type: 'dependencyScanner', label: 'Dependency Scan', description: 'Dependency vulnerability scanner', color: colors.dependencyScannerColor, icon: <AccountTreeOutlinedIcon /> },
      { type: 'infrastructureAsCode', label: 'IaC Security', description: 'Infrastructure as Code security', color: colors.infrastructureAsCodeColor, icon: <CodeIcon /> },
      { type: 'policyAsCode', label: 'Policy as Code', description: 'Security policy as code', color: colors.policyAsCodeColor, icon: <RuleIcon /> },
      
      // Access Control
      { type: 'cloudAccessBroker', label: 'Cloud Broker', description: 'Cloud access broker', color: colors.cloudAccessBrokerColor, icon: <CloudOffIcon /> },
      { type: 'remoteAccessGateway', label: 'Remote Access', description: 'Remote access gateway', color: colors.remoteAccessGatewayColor, icon: <VpnLockOutlinedIcon /> },
      { type: 'bastionHost', label: 'Bastion Host', description: 'Secure jump server', color: colors.bastionHostColor, icon: <MeetingRoomIcon /> },
      { type: 'jumpServer', label: 'Jump Server', description: 'Administrative access point', color: colors.jumpServerColor, icon: <MeetingRoomIcon /> },
      
      // Emerging Tech
      { type: 'aiSecurityGateway', label: 'AI Security', description: 'AI/ML security gateway', color: colors.aiSecurityGatewayColor, icon: <PsychologyIcon /> },
      { type: 'quantumKeyDistribution', label: 'Quantum KD', description: 'Quantum key distribution', color: colors.quantumKeyDistributionColor, icon: <ElectricalServicesIcon /> },
      { type: 'blockchainSecurity', label: 'Blockchain', description: 'Blockchain security node', color: colors.blockchainSecurityColor, icon: <CurrencyBitcoinIcon /> },
      { type: 'otSecurityGateway', label: 'OT Security', description: 'OT/ICS security gateway', color: colors.otSecurityGatewayColor, icon: <FactoryIcon /> },
      { type: 'iotSecurityGateway', label: 'IoT Security', description: 'IoT security gateway', color: colors.iotSecurityGatewayColor, icon: <SensorsIcon /> },
      
      // Physical Security
      { type: 'physicalAccessControl', label: 'Physical Access', description: 'Physical access control system', color: colors.physicalAccessControlColor, icon: <MeetingRoomIcon /> },
      { type: 'videoSurveillance', label: 'Video Surveillance', description: 'Security camera system', color: colors.videoSurveillanceColor, icon: <CameraOutdoorIcon /> },
      
      // Orchestration
      { type: 'securityOrchestrator', label: 'Orchestrator', description: 'Security orchestration platform', color: colors.securityOrchestratorColor, icon: <HubTwoToneIcon /> },
      // --- New generic security nodes ---
      { type: 'applicationDeliveryController', label: 'ADC / Gateway', description: 'Application Delivery Controller', color: colors.gatewayColor, icon: <SwapHorizIcon /> },
      { type: 'identityProvider', label: 'Identity Provider', description: 'Authentication / IdP service', color: colors.identityColor, icon: <VerifiedUserIcon /> }
    ]
  },
  {
    title: "Infrastructure",
    icon: <RouterIcon />,
    nodes: [
      // Users & Identity
      { type: 'user', label: 'User', description: 'System user or identity', color: colors.userColor, icon: <PersonIcon /> },
      
      // Servers & Compute
      { type: 'server', label: 'Server', description: 'Physical or virtual server', color: colors.serverColor, icon: <DnsIcon /> },
      { type: 'workstation', label: 'Workstation', description: 'End-user computer', color: colors.workstationColor, icon: <ComputerIcon /> },
      { type: 'endpoint', label: 'Endpoint', description: 'Generic endpoint device', color: colors.endpointColor, icon: <DevicesIcon /> },
      { type: 'desktop', label: 'Desktop', description: 'Desktop computer', color: colors.endpointColor, icon: <DesktopWindowsIcon /> },
      { type: 'laptop', label: 'Laptop', description: 'Laptop computer', color: colors.endpointColor, icon: <LaptopIcon /> },
      { type: 'tablet', label: 'Tablet', description: 'Tablet device', color: colors.endpointColor, icon: <TabletIcon /> },
      { type: 'smartphone', label: 'Smartphone', description: 'Mobile phone device', color: colors.endpointColor, icon: <SmartphoneIcon /> },
      { type: 'printer', label: 'Printer', description: 'Network printer', color: colors.printerColor, icon: <PrintIcon /> },
      
      // Network Equipment
      { type: 'router', label: 'Router', description: 'Network router', color: colors.routerColor, icon: <RouterIcon /> },
      { type: 'switch', label: 'Switch', description: 'Network switch', color: colors.switchColor, icon: <HubIcon /> },
      { type: 'coreRouter', label: 'Core Router', description: 'High-capacity backbone router', color: colors.routerColor, icon: <RouterSharpIcon /> },
      { type: 'edgeRouter', label: 'Edge Router', description: 'Network edge router', color: colors.routerColor, icon: <RouterOutlinedIcon /> },
      { type: 'accessPoint', label: 'Access Point', description: 'Wireless access point', color: colors.switchColor, icon: <WifiIcon /> },
      { type: 'wirelessController', label: 'Wireless Controller', description: 'Centralized Wi-Fi management', color: colors.switchColor, icon: <WifiProtectedSetupIcon /> },
      { type: 'gateway', label: 'Gateway', description: 'Network gateway', color: colors.gatewayColor, icon: <HubOutlinedIcon /> },
      { type: 'modem', label: 'Modem', description: 'Internet modem', color: colors.gatewayColor, icon: <ImportExportIcon /> },
      { type: 'networkBridge', label: 'Network Bridge', description: 'Network bridge device', color: colors.switchColor, icon: <DeviceHubIcon /> },
      { type: 'networkHub', label: 'Network Hub', description: 'Legacy network hub', color: colors.switchColor, icon: <DeviceHubIcon /> },
      
      // Network Services
      { type: 'dns', label: 'DNS Server', description: 'Domain Name System server', color: colors.dnsColor, icon: <DnsIcon /> },
      { type: 'dhcp', label: 'DHCP Server', description: 'Dynamic Host Configuration Protocol server', color: colors.serverColor, icon: <SettingsEthernetIcon /> },
      { type: 'ntpServer', label: 'NTP Server', description: 'Network Time Protocol server', color: colors.serverColor, icon: <SpeedIcon /> },
      { type: 'proxyCache', label: 'Proxy Cache', description: 'Caching proxy server', color: colors.proxyColor, icon: <DataThresholdingOutlinedIcon /> },
      
      // Telephony & Communication
      { type: 'voipPhone', label: 'VoIP Phone', description: 'Voice over IP phone', color: colors.endpointColor, icon: <PhoneInTalkIcon /> },
      { type: 'pbx', label: 'PBX', description: 'Private Branch Exchange', color: colors.serverColor, icon: <HeadsetMicIcon /> },
      { type: 'sipServer', label: 'SIP Server', description: 'Session Initiation Protocol server', color: colors.serverColor, icon: <PhoneInTalkIcon /> },
      { type: 'conferenceSystem', label: 'Conference System', description: 'Video/audio conferencing system', color: colors.endpointColor, icon: <HeadsetMicIcon /> },
      
      // Storage Infrastructure
      { type: 'san', label: 'SAN', description: 'Storage Area Network', color: colors.storageColor, icon: <BackupTableIcon /> },
      { type: 'nas', label: 'NAS', description: 'Network Attached Storage', color: colors.storageColor, icon: <SdStorageIcon /> },
      { type: 'storageArray', label: 'Storage Array', description: 'Enterprise storage array', color: colors.storageColor, icon: <StorageIcon /> },
      { type: 'tapeLibrary', label: 'Tape Library', description: 'Backup tape library', color: colors.storageColor, icon: <BackupTableIcon /> },
      
      // Data Center Equipment
      { type: 'ups', label: 'UPS', description: 'Uninterruptible Power Supply', color: colors.serverColor, icon: <PowerSettingsNewIcon /> },
      { type: 'pdu', label: 'PDU', description: 'Power Distribution Unit', color: colors.serverColor, icon: <ElectricBoltIcon /> },
      { type: 'hvac', label: 'HVAC', description: 'Heating, Ventilation, Air Conditioning', color: colors.serverColor, icon: <DeviceThermostatIcon /> },
      { type: 'rackServer', label: 'Rack Server', description: 'Rack-mounted server', color: colors.serverColor, icon: <DeveloperBoardIcon /> },
      { type: 'bladeServer', label: 'Blade Server', description: 'Blade server chassis', color: colors.serverColor, icon: <DeveloperBoardIcon /> },
      
      // Network Infrastructure
      { type: 'loadBalancerHw', label: 'HW Load Balancer', description: 'Hardware load balancer appliance', color: colors.loadBalancerColor, icon: <BalanceIcon /> },
      { type: 'wanOptimizer', label: 'WAN Optimizer', description: 'WAN optimization appliance', color: colors.gatewayColor, icon: <SpeedIcon /> },
      { type: 'networkProbe', label: 'Network Probe', description: 'Network monitoring probe', color: colors.monitorColor, icon: <NetworkPingIcon /> },
      { type: 'packetBroker', label: 'Packet Broker', description: 'Network packet broker', color: colors.switchColor, icon: <CableIcon /> },
      
      // Connectivity
      { type: 'fiberTerminal', label: 'Fiber Terminal', description: 'Fiber optic terminal', color: colors.gatewayColor, icon: <CableIcon /> },
      { type: 'multiplexer', label: 'Multiplexer', description: 'Network multiplexer', color: colors.switchColor, icon: <ImportExportIcon /> },
      { type: 'mediaConverter', label: 'Media Converter', description: 'Network media converter', color: colors.switchColor, icon: <SwapHorizIcon /> },
      { type: 'terminalServer', label: 'Terminal Server', description: 'Remote access terminal server', color: colors.serverColor, icon: <DesktopWindowsIcon /> },
      
      // Wireless Infrastructure
      { type: 'cellTower', label: 'Cell Tower', description: 'Cellular network tower', color: colors.gatewayColor, icon: <CellTowerIcon /> },
      { type: 'wirelessBridge', label: 'Wireless Bridge', description: 'Point-to-point wireless bridge', color: colors.switchColor, icon: <CellWifiIcon /> },
      { type: 'meshNode', label: 'Mesh Node', description: 'Wireless mesh network node', color: colors.switchColor, icon: <NetworkWifiIcon /> },
      { type: 'repeater', label: 'Repeater', description: 'Network signal repeater', color: colors.switchColor, icon: <WifiTetheringIcon /> },
      
      // Edge Computing
      { type: 'edgeServer', label: 'Edge Server', description: 'Edge computing server', color: colors.serverColor, icon: <DirectionsRunIcon /> },
      { type: 'fogNode', label: 'Fog Node', description: 'Fog computing node', color: colors.serverColor, icon: <CloudCircleIcon /> },
      { type: 'microDatacenter', label: 'Micro DC', description: 'Micro datacenter', color: colors.serverColor, icon: <DeveloperBoardIcon /> },
      
      // Specialized
      { type: 'kvm', label: 'KVM Switch', description: 'Keyboard, Video, Mouse switch', color: colors.switchColor, icon: <DesktopWindowsIcon /> },
      { type: 'serialConsole', label: 'Serial Console', description: 'Serial console server', color: colors.serverColor, icon: <SettingsEthernetIcon /> },
      { type: 'timeClock', label: 'Time Clock', description: 'Network time clock', color: colors.endpointColor, icon: <SpeedIcon /> },
      { type: 'environmentSensor', label: 'Env Sensor', description: 'Environmental monitoring sensor', color: colors.sensorColor, icon: <DeviceThermostatIcon /> },
      // --- New generic infrastructure nodes ---
      { type: 'thinClient', label: 'Thin Client', description: 'Zero / thin client terminal', color: colors.endpointColor, icon: <TabletIcon /> },
      { type: 'virtualDesktopHost', label: 'VDI Host', description: 'Virtual desktop infrastructure host', color: colors.serverColor, icon: <DesktopWindowsIcon /> },
      { type: 'sdwanGateway', label: 'SD-WAN Gateway', description: 'SD-WAN edge gateway', color: colors.gatewayColor, icon: <NetworkWifiIcon /> }
    ]
  },
  {
    title: "Applications",
    icon: <AppsIcon />,
    nodes: [
      { type: 'application', label: 'Application', description: 'Generic application', color: colors.applicationColor, icon: <AppsIcon /> },
      { type: 'database', label: 'Database', description: 'Database server', color: colors.databaseColor, icon: <StorageIcon /> },
      { type: 'loadBalancer', label: 'Load Balancer', description: 'Load balancer', color: colors.loadBalancerColor, icon: <AccountTreeIcon /> },
      { type: 'apiGateway', label: 'API Gateway', description: 'API Gateway', color: colors.apiGatewayColor, icon: <ApiIcon /> },
      { type: 'webServer', label: 'Web Server', description: 'Web server', color: colors.webServerColor, icon: <HttpIcon /> },
      { type: 'authServer', label: 'Auth Server', description: 'Authentication server', color: colors.authServerColor, icon: <AccountCircleIcon /> },
      { type: 'messageBroker', label: 'Message Broker', description: 'Message broker', color: colors.messageBrokerColor, icon: <ForumIcon /> },
      { type: 'api', label: 'API Service', description: 'RESTful API service', color: colors.apiColor, icon: <ApiIcon /> },
      { type: 'service', label: 'Service', description: 'Microservice or business service', color: colors.serviceColor, icon: <LayersIcon /> },
      { type: 'containerizedService', label: 'Containerized Service', description: 'Docker/Kubernetes containerized service', color: colors.containerizedServiceColor, icon: <AllInboxIcon /> },
      { type: 'cache', label: 'Cache', description: 'Caching layer', color: colors.cacheColor, icon: <DataUsageIcon /> },
      { type: 'storage', label: 'Storage', description: 'Data storage system', color: colors.storageColor, icon: <FolderIcon /> },
      { type: 'vault', label: 'Vault', description: 'Credential and secret storage', color: colors.vaultColor, icon: <KeyIcon /> },
      { type: 'identity', label: 'Identity Provider', description: 'Identity and access management', color: colors.identityColor, icon: <GroupIcon /> },
      { type: 'logging', label: 'Logging', description: 'Log aggregation and analysis', color: colors.loggingColor, icon: <AssessmentIcon /> }
    ]
  },
  {
    title: "Application Architecture",
    icon: <MemoryIcon />,
    nodes: [
      { type: 'memoryPool', label: 'Memory Pool', description: 'Application memory allocation and management', color: colors.memoryPoolColor, icon: <DataArrayIcon /> },
      { type: 'executionContext', label: 'Execution Context', description: 'Runtime execution context and thread management', color: colors.executionContextColor, icon: <PlayCircleIcon /> },
      { type: 'sessionStore', label: 'Session Store', description: 'User session data storage and management', color: colors.sessionStoreColor, icon: <BackupIcon /> },
      { type: 'inputBuffer', label: 'Input Buffer', description: 'Input data buffering and preprocessing', color: colors.inputBufferColor, icon: <InputIcon /> },
      { type: 'outputBuffer', label: 'Output Buffer', description: 'Output data buffering and postprocessing', color: colors.outputBufferColor, icon: <OutputIcon /> },
      { type: 'configManager', label: 'Config Manager', description: 'Application configuration and settings management', color: colors.configManagerColor, icon: <SettingsIcon /> },
      { type: 'cryptoModule', label: 'Crypto Module', description: 'Cryptographic operations and key management', color: colors.cryptoModuleColor, icon: <LockOutlinedIcon /> },
      { type: 'tokenValidator', label: 'Token Validator', description: 'Authentication token validation and parsing', color: colors.tokenValidatorColor, icon: <TokenIcon /> },
      { type: 'permissionEngine', label: 'Permission Engine', description: 'Authorization and permission checking logic', color: colors.permissionEngineColor, icon: <AdminPanelSettingsIcon /> },
      { type: 'auditLogger', label: 'Audit Logger', description: 'Security event logging and audit trail', color: colors.auditLoggerColor, icon: <DescriptionIcon /> },
      // --- Kernel & Hardware Level Components ---
      { type: 'kernelModule', label: 'Kernel Module', description: 'Operating system kernel module or driver code running in ring 0', color: colors.kernelModuleColor, icon: <MemoryIcon /> },
      { type: 'deviceDriver', label: 'Device Driver', description: 'Hardware device driver interacting with kernel and firmware', color: colors.deviceDriverColor, icon: <SettingsIcon /> },
      { type: 'hypervisor', label: 'Hypervisor', description: 'Virtualization layer controlling guest VMs and hardware isolation', color: colors.hypervisorColor, icon: <AdminPanelSettingsIcon /> },
      { type: 'firmware', label: 'Firmware', description: 'System firmware such as UEFI/BIOS controlling hardware initialization', color: colors.firmwareColor, icon: <CodeIcon /> },
      { type: 'secureEnclave', label: 'Secure Enclave', description: 'Hardware-based isolated execution environment (e.g., SGX, SEV, TEE)', color: colors.secureEnclaveColor, icon: <LockIcon /> },
      { type: 'tpm', label: 'TPM', description: 'Trusted Platform Module for attestation and secure key storage', color: colors.tpmColor, icon: <VerifiedUserIcon /> },
      { type: 'microcode', label: 'Microcode', description: 'CPU microcode layer controlling low-level processor behavior', color: colors.microcodeColor, icon: <BuildCircleIcon /> }
    ]
  },
  {
    title: "Cloud Services",
    icon: <CloudIcon />,
    nodes: [
      { type: 'cloudService', label: 'Cloud Service', description: 'Generic cloud service', color: colors.cloudServiceColor, icon: <CloudQueueIcon /> },
      { type: 'containerRegistry', label: 'Container Registry', description: 'Container image registry', color: colors.containerRegistryColor, icon: <AllInboxIcon /> },
      { type: 'kubernetesPod', label: 'K8s Pod', description: 'Kubernetes pod', color: colors.kubernetesPodColor, icon: <ViewInArIcon /> },
      { type: 'kubernetesService', label: 'K8s Service', description: 'Kubernetes service', color: colors.kubernetesServiceColor, icon: <LayersIcon /> },
      { type: 'storageAccount', label: 'Storage', description: 'Cloud storage', color: colors.storageAccountColor, icon: <CloudCircleIcon /> },
      { type: 'functionApp', label: 'Function', description: 'Serverless function', color: colors.functionAppColor, icon: <FunctionsIcon /> },
      { type: 'apiManagement', label: 'API Management', description: 'API management service', color: colors.apiManagementColor, icon: <ApiIcon /> },
      { type: 'cloudLoadBalancer', label: 'Cloud LB', description: 'Cloud load balancer', color: colors.cloudLoadBalancerColor, icon: <BalanceIcon /> },
      { type: 'cloudFirewall', label: 'Cloud Firewall', description: 'Cloud firewall', color: colors.cloudFirewallColor, icon: <LocalFireDepartmentIcon /> },
      { type: 'cloudDatabase', label: 'Cloud DB', description: 'Cloud database', color: colors.cloudDatabaseColor, icon: <CloudDoneIcon /> },
      { type: 'search', label: 'Search Service', description: 'Cloud search and indexing service', color: colors.searchColor, icon: <SearchIcon /> }
    ]
  },
  {
    title: "AWS Services",
    icon: createVendorIconElement('aws', 'compute', 'Arch_Amazon-EC2_48.svg'),
    nodes: [
      { type: 'awsEC2' as SecurityNodeType, label: 'EC2', description: 'Elastic Compute Cloud - Virtual Servers', color: colors.awsComputeColor, icon: createVendorIconElement('aws', 'compute', 'Arch_Amazon-EC2_48.svg') },
      { type: 'awsLambda' as SecurityNodeType, label: 'Lambda', description: 'Serverless compute service', color: colors.awsComputeColor, icon: createVendorIconElement('aws', 'compute', 'Arch_AWS-Lambda_48.svg') },
      { type: 'awsElasticBeanstalk' as SecurityNodeType, label: 'Elastic Beanstalk', description: 'Easy-to-use service for deploying applications', color: colors.awsComputeColor, icon: createVendorIconElement('aws', 'compute', 'Arch_AWS-Elastic-Beanstalk_48.svg') },
      { type: 'awsECS' as SecurityNodeType, label: 'ECS', description: 'Elastic Container Service', color: colors.awsComputeColor, icon: createVendorIconElement('aws', 'containers', 'Arch_Amazon-Elastic-Container-Service_48.svg') },
      { type: 'awsEKS' as SecurityNodeType, label: 'EKS', description: 'Elastic Kubernetes Service', color: colors.awsComputeColor, icon: createVendorIconElement('aws', 'containers', 'Arch_Amazon-Elastic-Kubernetes-Service_48.svg') },
      { type: 'awsFargate' as SecurityNodeType, label: 'Fargate', description: 'Serverless compute for containers', color: colors.awsComputeColor, icon: createVendorIconElement('aws', 'containers', 'Arch_AWS-Fargate_48.svg') },
      { type: 'awsS3' as SecurityNodeType, label: 'S3', description: 'Simple Storage Service - Object storage', color: colors.awsStorageColor, icon: createVendorIconElement('aws', 'storage', 'Arch_Amazon-Simple-Storage-Service_48.svg') },
      { type: 'awsEBS' as SecurityNodeType, label: 'EBS', description: 'Elastic Block Store', color: colors.awsStorageColor, icon: createVendorIconElement('aws', 'storage', 'Arch_Amazon-Elastic-Block-Store_48.svg') },
      { type: 'awsEFS' as SecurityNodeType, label: 'EFS', description: 'Elastic File System', color: colors.awsStorageColor, icon: createVendorIconElement('aws', 'storage', 'Arch_Amazon-EFS_48.svg') },
      { type: 'awsGlacier' as SecurityNodeType, label: 'Glacier', description: 'Archive storage service', color: colors.awsStorageColor, icon: <StorageIcon /> },
      { type: 'awsRDS' as SecurityNodeType, label: 'RDS', description: 'Relational Database Service', color: colors.awsDatabaseColor, icon: createVendorIconElement('aws', 'database', 'Arch_Amazon-RDS_48.svg') },
      { type: 'awsDynamoDB' as SecurityNodeType, label: 'DynamoDB', description: 'NoSQL database service', color: colors.awsDatabaseColor, icon: createVendorIconElement('aws', 'database', 'Arch_Amazon-DynamoDB_48.svg') },
      { type: 'awsElastiCache' as SecurityNodeType, label: 'ElastiCache', description: 'In-memory caching service', color: colors.awsDatabaseColor, icon: createVendorIconElement('aws', 'database', 'Arch_Amazon-ElastiCache_48.svg') },
      { type: 'awsRedshift' as SecurityNodeType, label: 'Redshift', description: 'Data warehouse service', color: colors.awsDatabaseColor, icon: createVendorIconElement('aws', 'analytics', 'Arch_Amazon-Redshift_48.svg') },
      { type: 'awsAurora' as SecurityNodeType, label: 'Aurora', description: 'MySQL and PostgreSQL compatible database', color: colors.awsDatabaseColor, icon: <StorageIcon /> },
      { type: 'awsVPC' as SecurityNodeType, label: 'VPC', description: 'Virtual Private Cloud', color: colors.awsNetworkingColor, icon: createVendorIconElement('aws', 'network', 'Arch_Amazon-Virtual-Private-Cloud_48.svg') },
      { type: 'awsCloudFront' as SecurityNodeType, label: 'CloudFront', description: 'Content Delivery Network', color: colors.awsNetworkingColor, icon: createVendorIconElement('aws', 'network', 'Arch_Amazon-CloudFront_48.svg') },
      { type: 'awsRoute53' as SecurityNodeType, label: 'Route 53', description: 'DNS web service', color: colors.awsNetworkingColor, icon: createVendorIconElement('aws', 'network', 'Arch_Amazon-Route-53_48.svg') },
      { type: 'awsDirectConnect' as SecurityNodeType, label: 'Direct Connect', description: 'Dedicated network connection', color: colors.awsNetworkingColor, icon: createVendorIconElement('aws', 'network', 'Arch_AWS-Direct-Connect_48.svg') },
      { type: 'awsTransitGateway' as SecurityNodeType, label: 'Transit Gateway', description: 'Network transit hub', color: colors.awsNetworkingColor, icon: createVendorIconElement('aws', 'network', 'Arch_AWS-Transit-Gateway_48.svg') },
      { type: 'awsAPIGateway' as SecurityNodeType, label: 'API Gateway', description: 'Create, publish, and secure APIs', color: colors.awsNetworkingColor, icon: createVendorIconElement('aws', 'network', 'Arch_Amazon-API-Gateway_48.svg') },
      { type: 'awsSNS' as SecurityNodeType, label: 'SNS', description: 'Simple Notification Service', color: colors.awsComputeColor, icon: createVendorIconElement('aws', 'app-integration', 'Arch_Amazon-Simple-Notification-Service_48.svg') },
      { type: 'awsSQS' as SecurityNodeType, label: 'SQS', description: 'Simple Queue Service', color: colors.awsComputeColor, icon: createVendorIconElement('aws', 'app-integration', 'Arch_Amazon-Simple-Queue-Service_48.svg') },
      { type: 'awsEventBridge' as SecurityNodeType, label: 'EventBridge', description: 'Serverless event bus', color: colors.awsComputeColor, icon: createVendorIconElement('aws', 'app-integration', 'Arch_Amazon-EventBridge_48.svg') },
      { type: 'awsIAM' as SecurityNodeType, label: 'IAM', description: 'Identity and Access Management', color: colors.awsSecurityColor, icon: createVendorIconElement('aws', 'security', 'Arch_AWS-Identity-and-Access-Management_48.svg') },
      { type: 'awsCognito' as SecurityNodeType, label: 'Cognito', description: 'User authentication and authorization', color: colors.awsSecurityColor, icon: createVendorIconElement('aws', 'security', 'Arch_Amazon-Cognito_48.svg') },
      { type: 'awsSSO' as SecurityNodeType, label: 'SSO', description: 'Single Sign-On', color: colors.awsSecurityColor, icon: <VpnKeyIcon /> },
      { type: 'awsSecretsManager' as SecurityNodeType, label: 'Secrets Manager', description: 'Secrets management', color: colors.awsSecurityColor, icon: createVendorIconElement('aws', 'security', 'Arch_AWS-Secrets-Manager_48.svg') },
      { type: 'awsKMS' as SecurityNodeType, label: 'KMS', description: 'Key Management Service', color: colors.awsSecurityColor, icon: createVendorIconElement('aws', 'security', 'Arch_AWS-Key-Management-Service_48.svg') },
      { type: 'awsACM' as SecurityNodeType, label: 'ACM', description: 'Certificate Manager', color: colors.awsSecurityColor, icon: <VerifiedIcon /> },
      { type: 'awsDirectory' as SecurityNodeType, label: 'Directory Service', description: 'Managed Active Directory', color: colors.awsSecurityColor, icon: <FolderIcon /> },
      { type: 'awsGuardDuty' as SecurityNodeType, label: 'GuardDuty', description: 'Threat detection service', color: colors.awsSecurityColor, icon: createVendorIconElement('aws', 'security', 'Arch_Amazon-GuardDuty_48.svg') },
      { type: 'awsSecurityHub' as SecurityNodeType, label: 'Security Hub', description: 'Security posture management', color: colors.awsSecurityColor, icon: <DashboardIcon /> },
      { type: 'awsWAF' as SecurityNodeType, label: 'WAF', description: 'Web Application Firewall', color: colors.awsSecurityColor, icon: <ShieldIcon /> },
      { type: 'awsShield' as SecurityNodeType, label: 'Shield', description: 'DDoS protection', color: colors.awsSecurityColor, icon: <ShieldIcon /> },
      { type: 'awsInspector' as SecurityNodeType, label: 'Inspector', description: 'Vulnerability assessment', color: colors.awsSecurityColor, icon: <BugReportIcon /> },
      { type: 'awsDetective' as SecurityNodeType, label: 'Detective', description: 'Security investigation', color: colors.awsSecurityColor, icon: <SearchIcon /> },
      { type: 'awsFirewallManager' as SecurityNodeType, label: 'Firewall Manager', description: 'Centralized firewall management', color: colors.awsSecurityColor, icon: <AdminPanelSettingsIcon /> },
      { type: 'awsNetworkFirewall' as SecurityNodeType, label: 'Network Firewall', description: 'Network traffic filtering', color: colors.awsSecurityColor, icon: <ShieldIcon /> },
      { type: 'awsConfig' as SecurityNodeType, label: 'Config', description: 'Configuration monitoring', color: colors.awsSecurityColor, icon: <SettingsIcon /> },
      { type: 'awsCloudTrail' as SecurityNodeType, label: 'CloudTrail', description: 'Audit logging', color: colors.awsSecurityColor, icon: createVendorIconElement('aws', 'management-governance', 'Arch_AWS-CloudTrail_48.svg') },
      { type: 'awsCloudWatch' as SecurityNodeType, label: 'CloudWatch', description: 'Monitoring and observability', color: colors.awsSecurityColor, icon: createVendorIconElement('aws', 'management-governance', 'Arch_Amazon-CloudWatch_48.svg') },
      { type: 'awsMacie' as SecurityNodeType, label: 'Macie', description: 'Data security and privacy', color: colors.awsSecurityColor, icon: <PrivacyTipIcon /> },
      { type: 'awsSecurityLake' as SecurityNodeType, label: 'Security Lake', description: 'Security data lake', color: colors.awsSecurityColor, icon: <StorageIcon /> },
      { type: 'awsAccessAnalyzer' as SecurityNodeType, label: 'Access Analyzer', description: 'Resource access analysis', color: colors.awsSecurityColor, icon: <AssessmentIcon /> },
      { type: 'awsCodePipeline' as SecurityNodeType, label: 'CodePipeline', description: 'Continuous delivery service', color: colors.awsComputeColor, icon: createVendorIconElement('aws', 'developer-tools', 'Arch_AWS-CodePipeline_48.svg') },
      { type: 'awsCodeBuild' as SecurityNodeType, label: 'CodeBuild', description: 'Build and test service', color: colors.awsComputeColor, icon: <BuildCircleIcon /> },
      { type: 'awsCodeDeploy' as SecurityNodeType, label: 'CodeDeploy', description: 'Automated deployment', color: colors.awsComputeColor, icon: createVendorIconElement('aws', 'developer-tools', 'Arch_AWS-CodeDeploy_48.svg') },
      { type: 'awsCodeCommit' as SecurityNodeType, label: 'CodeCommit', description: 'Source control service', color: colors.awsComputeColor, icon: <GitHubIcon /> },
      { type: 'awsXRay' as SecurityNodeType, label: 'X-Ray', description: 'Distributed tracing', color: colors.awsSecurityColor, icon: <TimelineIcon /> },
      { type: 'awsCloudWatchLogs' as SecurityNodeType, label: 'CloudWatch Logs', description: 'Log management', color: colors.awsSecurityColor, icon: <DescriptionIcon /> }
    ]
  },
  {
    title: "Azure Services",
    icon: createVendorIconElement('azure', 'compute', '10021-icon-service-Virtual-Machine.svg'),
    nodes: [
      { type: 'azureVM' as SecurityNodeType, label: 'Virtual Machines', description: 'Scalable virtual machines', color: colors.azureComputeColor, icon: createVendorIconElement('azure', 'compute', '10021-icon-service-Virtual-Machine.svg') },
      { type: 'azureAppService' as SecurityNodeType, label: 'App Service', description: 'Build and host web applications', color: colors.azureComputeColor, icon: createVendorIconElement('azure', 'compute', '10035-icon-service-App-Services.svg') },
      { type: 'azureFunctions' as SecurityNodeType, label: 'Functions', description: 'Serverless compute service', color: colors.azureComputeColor, icon: createVendorIconElement('azure', 'compute', '10029-icon-service-Function-Apps.svg') },
      { type: 'azureKubernetesService' as SecurityNodeType, label: 'AKS', description: 'Azure Kubernetes Service', color: colors.azureComputeColor, icon: createVendorIconElement('azure', 'compute', '10023-icon-service-Kubernetes-Services.svg') },
      { type: 'azureContainerInstances' as SecurityNodeType, label: 'Container Instances', description: 'Run containers without managing servers', color: colors.azureComputeColor, icon: createVendorIconElement('azure', 'containers', '10104-icon-service-Container-Instances.svg') },
      { type: 'azureContainerApps' as SecurityNodeType, label: 'Container Apps', description: 'Serverless containers', color: colors.azureComputeColor, icon: <AppsIcon /> },
      { type: 'azureBatch' as SecurityNodeType, label: 'Batch', description: 'Cloud-scale job scheduling', color: colors.azureComputeColor, icon: createVendorIconElement('azure', 'compute', '10031-icon-service-Batch-Accounts.svg') },
      { type: 'azureBlobStorage' as SecurityNodeType, label: 'Blob Storage', description: 'Object storage for unstructured data', color: colors.azureStorageColor, icon: createVendorIconElement('azure', 'storage', '10090-icon-service-Data-Lake-Storage-Gen1.svg') },
      { type: 'azureFileStorage' as SecurityNodeType, label: 'File Storage', description: 'Managed file shares', color: colors.azureStorageColor, icon: <FolderIcon /> },
      { type: 'azureManagedDisks' as SecurityNodeType, label: 'Managed Disks', description: 'High-performance block storage', color: colors.azureStorageColor, icon: <StorageIcon /> },
      { type: 'azureStorage' as SecurityNodeType, label: 'Storage Account', description: 'General purpose storage', color: colors.azureStorageColor, icon: createVendorIconElement('azure', 'storage', '10086-icon-service-Storage-Accounts.svg') },
      { type: 'azureDataLakeStorage' as SecurityNodeType, label: 'Data Lake Storage', description: 'Analytics data lake', color: colors.azureStorageColor, icon: <DataUsageIcon /> },
      { type: 'azureSQLDatabase' as SecurityNodeType, label: 'SQL Database', description: 'Managed relational database', color: colors.azureDatabaseColor, icon: createVendorIconElement('azure', 'databases', '10130-icon-service-SQL-Database.svg') },
      { type: 'azureCosmosDB' as SecurityNodeType, label: 'Cosmos DB', description: 'Globally distributed NoSQL database', color: colors.azureDatabaseColor, icon: createVendorIconElement('azure', 'databases', '10121-icon-service-Azure-Cosmos-DB.svg') },
      { type: 'azureRedisCache' as SecurityNodeType, label: 'Redis Cache', description: 'In-memory data store', color: colors.azureDatabaseColor, icon: createVendorIconElement('azure', 'databases', '10137-icon-service-Cache-Redis.svg') },
      { type: 'azureSynapseAnalytics' as SecurityNodeType, label: 'Synapse Analytics', description: 'Analytics service', color: colors.azureDatabaseColor, icon: createVendorIconElement('azure', 'analytics', '00606-icon-service-Azure-Synapse-Analytics.svg') },
      { type: 'azureDatabaseForPostgreSQL' as SecurityNodeType, label: 'PostgreSQL', description: 'Managed PostgreSQL', color: colors.azureDatabaseColor, icon: createVendorIconElement('azure', 'databases', '10131-icon-service-Azure-Database-PostgreSQL-Server.svg') },
      { type: 'azureDatabaseForMySQL' as SecurityNodeType, label: 'MySQL', description: 'Managed MySQL', color: colors.azureDatabaseColor, icon: createVendorIconElement('azure', 'databases', '10122-icon-service-Azure-Database-MySQL-Server.svg') },
      { type: 'azureVirtualNetwork' as SecurityNodeType, label: 'Virtual Network', description: 'Private network in Azure', color: colors.azureNetworkingColor, icon: createVendorIconElement('azure', 'networking', '10061-icon-service-Virtual-Networks.svg') },
      { type: 'azureLoadBalancer' as SecurityNodeType, label: 'Load Balancer', description: 'High availability load balancing', color: colors.azureNetworkingColor, icon: createVendorIconElement('azure', 'networking', '10062-icon-service-Load-Balancers.svg') },
      { type: 'azureApplicationGateway' as SecurityNodeType, label: 'Application Gateway', description: 'Web traffic load balancer', color: colors.azureNetworkingColor, icon: createVendorIconElement('azure', 'networking', '10076-icon-service-Application-Gateways.svg') },
      { type: 'azureFrontDoor' as SecurityNodeType, label: 'Front Door', description: 'Global load balancing and CDN', color: colors.azureNetworkingColor, icon: createVendorIconElement('azure', 'networking', '10073-icon-service-Front-Door-and-CDN-Profiles.svg') },
      { type: 'azureVPNGateway' as SecurityNodeType, label: 'VPN Gateway', description: 'Cross-premises connectivity', color: colors.azureNetworkingColor, icon: createVendorIconElement('azure', 'networking', '10063-icon-service-Virtual-Network-Gateways.svg') },
      { type: 'azureExpressRoute' as SecurityNodeType, label: 'ExpressRoute', description: 'Private connection to Azure', color: colors.azureNetworkingColor, icon: <RouterIcon /> },
      { type: 'azureTrafficManager' as SecurityNodeType, label: 'Traffic Manager', description: 'DNS-based traffic routing', color: colors.azureNetworkingColor, icon: createVendorIconElement('azure', 'networking', '10065-icon-service-Traffic-Manager-Profiles.svg') },
      { type: 'azureDNS' as SecurityNodeType, label: 'DNS', description: 'DNS hosting', color: colors.azureNetworkingColor, icon: createVendorIconElement('azure', 'networking', '10064-icon-service-DNS-Zones.svg') },
      { type: 'azureActiveDirectory' as SecurityNodeType, label: 'Azure AD', description: 'Identity and access management', color: colors.azureIdentityColor, icon: <AccountTreeIcon /> },
      { type: 'azureADB2C' as SecurityNodeType, label: 'Azure AD B2C', description: 'Customer identity management', color: colors.azureIdentityColor, icon: <GroupIcon /> },
      { type: 'azureManagedIdentity' as SecurityNodeType, label: 'Managed Identity', description: 'Managed identities for Azure resources', color: colors.azureIdentityColor, icon: createVendorIconElement('azure', 'identity', '10227-icon-service-Managed-Identities.svg') },
      { type: 'azureKeyVault' as SecurityNodeType, label: 'Key Vault', description: 'Secure key management', color: colors.azureSecurityColor, icon: createVendorIconElement('azure', 'security', '10245-icon-service-Key-Vaults.svg') },
      { type: 'azureInformationProtection' as SecurityNodeType, label: 'Information Protection', description: 'Data classification and protection', color: colors.azureSecurityColor, icon: <PrivacyTipIcon /> },
      { type: 'azurePrivilegedIdentityManagement' as SecurityNodeType, label: 'PIM', description: 'Privileged access management', color: colors.azureSecurityColor, icon: <AdminPanelSettingsIcon /> },
      { type: 'azureSecurityCenter' as SecurityNodeType, label: 'Security Center', description: 'Unified security management', color: colors.azureSecurityColor, icon: <SecurityIcon /> },
      { type: 'azureSentinel' as SecurityNodeType, label: 'Sentinel', description: 'Cloud-native SIEM', color: colors.azureSecurityColor, icon: <RadarIcon /> },
      { type: 'azureDefender' as SecurityNodeType, label: 'Defender', description: 'Threat protection', color: colors.azureSecurityColor, icon: <ShieldIcon /> },
      { type: 'azureFirewall' as SecurityNodeType, label: 'Firewall', description: 'Cloud-native firewall', color: colors.azureSecurityColor, icon: <ShieldIcon /> },
      { type: 'azureDDoSProtection' as SecurityNodeType, label: 'DDoS Protection', description: 'DDoS mitigation', color: colors.azureSecurityColor, icon: <SecurityIcon /> },
      { type: 'azureBastion' as SecurityNodeType, label: 'Bastion', description: 'Secure RDP/SSH connectivity', color: colors.azureSecurityColor, icon: <MeetingRoomIcon /> },
      { type: 'azurePrivateLink' as SecurityNodeType, label: 'Private Link', description: 'Private connectivity', color: colors.azureSecurityColor, icon: <VpnLockIcon /> },
      { type: 'azurePolicy' as SecurityNodeType, label: 'Policy', description: 'Governance and compliance', color: colors.azureSecurityColor, icon: <PolicyIcon /> },
      { type: 'azureBlueprints' as SecurityNodeType, label: 'Blueprints', description: 'Environment orchestration', color: colors.azureSecurityColor, icon: <AccountTreeIcon /> },
      { type: 'azureArc' as SecurityNodeType, label: 'Arc', description: 'Hybrid and multi-cloud management', color: colors.azureSecurityColor, icon: <CloudCircleIcon /> },
      { type: 'azureMonitor' as SecurityNodeType, label: 'Monitor', description: 'Full-stack monitoring', color: colors.azureSecurityColor, icon: createVendorIconElement('azure', 'management-governance', '00001-icon-service-Monitor.svg') },
      { type: 'azureLogAnalytics' as SecurityNodeType, label: 'Log Analytics', description: 'Log aggregation and analysis', color: colors.azureSecurityColor, icon: createVendorIconElement('azure', 'management-governance', '00009-icon-service-Log-Analytics-Workspaces.svg') },
      { type: 'azureApplicationInsights' as SecurityNodeType, label: 'Application Insights', description: 'Application performance monitoring', color: colors.azureSecurityColor, icon: createVendorIconElement('azure', 'devops', '00012-icon-service-Application-Insights.svg') },
      { type: 'azureAutomation' as SecurityNodeType, label: 'Automation', description: 'Process automation', color: colors.azureSecurityColor, icon: createVendorIconElement('azure', 'management-governance', '00022-icon-service-Automation-Accounts.svg') },
      { type: 'azureDevOps' as SecurityNodeType, label: 'DevOps', description: 'Development collaboration', color: colors.azureComputeColor, icon: <CodeIcon /> },
      { type: 'azureArtifacts' as SecurityNodeType, label: 'Artifacts', description: 'Package management', color: colors.azureComputeColor, icon: <AllInboxIcon /> },
      { type: 'azurePipelines' as SecurityNodeType, label: 'Pipelines', description: 'CI/CD pipelines', color: colors.azureComputeColor, icon: <AccountTreeIcon /> }
    ]
  },
  {
    title: "GCP Services",
    icon: createVendorIconElement('gcp', 'core-products', 'ComputeEngine-512-color-rgb.svg'),
    nodes: [
      { type: 'gcpComputeEngine' as SecurityNodeType, label: 'Compute Engine', description: 'Virtual machines in Google\'s data center', color: colors.gcpComputeColor, icon: createVendorIconElement('gcp', 'core-products', 'ComputeEngine-512-color-rgb.svg') },
      { type: 'gcpAppEngine' as SecurityNodeType, label: 'App Engine', description: 'Fully managed serverless platform', color: colors.gcpComputeColor, icon: <CloudIcon /> },
      { type: 'gcpCloudFunctions' as SecurityNodeType, label: 'Cloud Functions', description: 'Event-driven serverless compute', color: colors.gcpComputeColor, icon: <FunctionsIcon /> },
      { type: 'gcpCloudRun' as SecurityNodeType, label: 'Cloud Run', description: 'Fully managed containerized apps', color: colors.gcpComputeColor, icon: createVendorIconElement('gcp', 'core-products', 'CloudRun-512-color-rgb.svg') },
      { type: 'gcpGKE' as SecurityNodeType, label: 'GKE', description: 'Google Kubernetes Engine', color: colors.gcpComputeColor, icon: createVendorIconElement('gcp', 'core-products', 'GKE-512-color.svg') },
      { type: 'gcpBatch' as SecurityNodeType, label: 'Batch', description: 'Batch processing service', color: colors.gcpComputeColor, icon: <QueueIcon /> },
      { type: 'gcpCloudStorage' as SecurityNodeType, label: 'Cloud Storage', description: 'Object storage service', color: colors.gcpStorageColor, icon: createVendorIconElement('gcp', 'core-products', 'Cloud_Storage-512-color.svg') },
      { type: 'gcpPersistentDisk' as SecurityNodeType, label: 'Persistent Disk', description: 'Block storage for VM instances', color: colors.gcpStorageColor, icon: <StorageIcon /> },
      { type: 'gcpFilestore' as SecurityNodeType, label: 'Filestore', description: 'Managed file storage', color: colors.gcpStorageColor, icon: <FolderIcon /> },
      { type: 'gcpContainerRegistry' as SecurityNodeType, label: 'Container Registry', description: 'Store and manage Docker images', color: colors.gcpComputeColor, icon: <AllInboxIcon /> },
      { type: 'gcpArtifactRegistry' as SecurityNodeType, label: 'Artifact Registry', description: 'Universal package manager', color: colors.gcpComputeColor, icon: <AllInboxIcon /> },
      { type: 'gcpCloudSQL' as SecurityNodeType, label: 'Cloud SQL', description: 'Fully managed relational database', color: colors.gcpDatabaseColor, icon: createVendorIconElement('gcp', 'core-products', 'CloudSQL-512-color.svg') },
      { type: 'gcpFirestore' as SecurityNodeType, label: 'Firestore', description: 'NoSQL document database', color: colors.gcpDatabaseColor, icon: <DataUsageIcon /> },
      { type: 'gcpBigQuery' as SecurityNodeType, label: 'BigQuery', description: 'Serverless data warehouse', color: colors.gcpDatabaseColor, icon: createVendorIconElement('gcp', 'core-products', 'BigQuery-512-color.svg') },
      { type: 'gcpBigtable' as SecurityNodeType, label: 'Bigtable', description: 'Scalable NoSQL wide-column database', color: colors.gcpDatabaseColor, icon: <TableRowsIcon /> },
      { type: 'gcpSpanner' as SecurityNodeType, label: 'Spanner', description: 'Globally distributed database', color: colors.gcpDatabaseColor, icon: createVendorIconElement('gcp', 'core-products', 'CloudSpanner-512-color.svg') },
      { type: 'gcpMemorystore' as SecurityNodeType, label: 'Memorystore', description: 'Managed Redis and Memcached', color: colors.gcpDatabaseColor, icon: <StorageIcon /> },
      { type: 'gcpVPC' as SecurityNodeType, label: 'VPC', description: 'Virtual Private Cloud networking', color: colors.gcpNetworkingColor, icon: <CloudCircleIcon /> },
      { type: 'gcpCloudLoadBalancing' as SecurityNodeType, label: 'Load Balancing', description: 'High performance load balancing', color: colors.gcpNetworkingColor, icon: <BalanceIcon /> },
      { type: 'gcpCloudCDN' as SecurityNodeType, label: 'Cloud CDN', description: 'Content delivery network', color: colors.gcpNetworkingColor, icon: <PublicIcon /> },
      { type: 'gcpCloudDNS' as SecurityNodeType, label: 'Cloud DNS', description: 'DNS service', color: colors.gcpNetworkingColor, icon: <DnsIcon /> },
      { type: 'gcpCloudVPN' as SecurityNodeType, label: 'Cloud VPN', description: 'Managed VPN service', color: colors.gcpNetworkingColor, icon: <VpnLockIcon /> },
      { type: 'gcpCloudInterconnect' as SecurityNodeType, label: 'Cloud Interconnect', description: 'Private connection', color: colors.gcpNetworkingColor, icon: <RouterIcon /> },
      { type: 'gcpCloudArmor' as SecurityNodeType, label: 'Cloud Armor', description: 'DDoS protection and WAF', color: colors.gcpSecurityColor, icon: <ShieldIcon /> },
      { type: 'gcpIAM' as SecurityNodeType, label: 'IAM', description: 'Identity and Access Management', color: colors.gcpSecurityColor, icon: <ManageAccountsIcon /> },
      { type: 'gcpIdentityPlatform' as SecurityNodeType, label: 'Identity Platform', description: 'Customer identity management', color: colors.gcpSecurityColor, icon: <GroupIcon /> },
      { type: 'gcpCloudIdentity' as SecurityNodeType, label: 'Cloud Identity', description: 'Identity as a Service', color: colors.gcpSecurityColor, icon: <FingerprintIcon /> },
      { type: 'gcpSecretManager' as SecurityNodeType, label: 'Secret Manager', description: 'Secrets management', color: colors.gcpSecurityColor, icon: <KeyIcon /> },
      { type: 'gcpCloudKMS' as SecurityNodeType, label: 'Cloud KMS', description: 'Key management service', color: colors.gcpSecurityColor, icon: <VpnKeyIcon /> },
      { type: 'gcpCertificateAuthority' as SecurityNodeType, label: 'Certificate Authority', description: 'Private CA service', color: colors.gcpSecurityColor, icon: <VerifiedIcon /> },
      { type: 'gcpSecurityCommandCenter' as SecurityNodeType, label: 'Security Command Center', description: 'Security and risk management', color: colors.gcpSecurityColor, icon: createVendorIconElement('gcp', 'core-products', 'SecurityCommandCenter-512-color.svg') },
      { type: 'gcpWebSecurityScanner' as SecurityNodeType, label: 'Web Security Scanner', description: 'Web vulnerability scanner', color: colors.gcpSecurityColor, icon: <BugReportIcon /> },
      { type: 'gcpCloudIDS' as SecurityNodeType, label: 'Cloud IDS', description: 'Intrusion detection system', color: colors.gcpSecurityColor, icon: <RadarIcon /> },
      { type: 'gcpBinaryAuthorization' as SecurityNodeType, label: 'Binary Authorization', description: 'Deploy-time security', color: colors.gcpSecurityColor, icon: <VerifiedIcon /> },
      { type: 'gcpContainerAnalysis' as SecurityNodeType, label: 'Container Analysis', description: 'Container vulnerability scanning', color: colors.gcpSecurityColor, icon: <BugReportIcon /> },
      { type: 'gcpCloudDLP' as SecurityNodeType, label: 'Cloud DLP', description: 'Data loss prevention', color: colors.gcpSecurityColor, icon: <PrivacyTipIcon /> },
      { type: 'gcpVPCServiceControls' as SecurityNodeType, label: 'VPC Service Controls', description: 'Service perimeter security', color: colors.gcpSecurityColor, icon: <ShieldIcon /> },
      { type: 'gcpAccessContextManager' as SecurityNodeType, label: 'Access Context Manager', description: 'Context-aware access', color: colors.gcpSecurityColor, icon: <PolicyIcon /> },
      { type: 'gcpPolicyIntelligence' as SecurityNodeType, label: 'Policy Intelligence', description: 'IAM policy insights', color: colors.gcpSecurityColor, icon: <AssessmentIcon /> },
      { type: 'gcpVertexAI' as SecurityNodeType, label: 'Vertex AI', description: 'Unified ML platform', color: colors.gcpDatabaseColor, icon: createVendorIconElement('gcp', 'core-products', 'VertexAI-512-color.svg') },
      { type: 'gcpAutoML' as SecurityNodeType, label: 'AutoML', description: 'Automated machine learning', color: colors.gcpDatabaseColor, icon: <SmartToyIcon /> },
      { type: 'gcpAIPlatform' as SecurityNodeType, label: 'AI Platform', description: 'Machine learning platform', color: colors.gcpDatabaseColor, icon: <PsychologyIcon /> },
      { type: 'gcpCloudMonitoring' as SecurityNodeType, label: 'Cloud Monitoring', description: 'Infrastructure monitoring', color: colors.gcpSecurityColor, icon: <MonitorIcon /> },
      { type: 'gcpCloudLogging' as SecurityNodeType, label: 'Cloud Logging', description: 'Log management', color: colors.gcpSecurityColor, icon: <DescriptionIcon /> },
      { type: 'gcpCloudTrace' as SecurityNodeType, label: 'Cloud Trace', description: 'Distributed tracing', color: colors.gcpSecurityColor, icon: <TimelineIcon /> },
      { type: 'gcpCloudProfiler' as SecurityNodeType, label: 'Cloud Profiler', description: 'Application profiling', color: colors.gcpSecurityColor, icon: <AssessmentIcon /> },
      { type: 'gcpCloudBuild' as SecurityNodeType, label: 'Cloud Build', description: 'Continuous integration', color: colors.gcpComputeColor, icon: <BuildCircleIcon /> },
      { type: 'gcpCloudDeploy' as SecurityNodeType, label: 'Cloud Deploy', description: 'Continuous delivery', color: colors.gcpComputeColor, icon: <RocketLaunchIcon /> },
      { type: 'gcpCloudSourceRepositories' as SecurityNodeType, label: 'Source Repositories', description: 'Git repositories', color: colors.gcpComputeColor, icon: <GitHubIcon /> }
    ]
  },
  {
    title: "IBM Cloud",
    icon: createVendorIconElement('ibm', 'Compute', 'Virtual Server.svg'),
    nodes: [
      { type: 'ibmVirtualServer' as SecurityNodeType, label: 'Virtual Server', description: 'Provisioned compute instances', color: colors.ibmComputeColor, icon: createVendorIconElement('ibm', 'Compute', 'Virtual Server.svg') },
      { type: 'ibmBareMetalServer' as SecurityNodeType, label: 'Bare Metal Server', description: 'Dedicated physical servers', color: colors.ibmComputeColor, icon: createVendorIconElement('ibm', 'Compute', 'Bare Metal Server.svg') },
      { type: 'ibmCodeEngine' as SecurityNodeType, label: 'Code Engine', description: 'Serverless platform for containerized workloads', color: colors.ibmComputeColor, icon: <AppsIcon /> },
      { type: 'ibmCloudFunctions' as SecurityNodeType, label: 'Cloud Functions', description: 'Serverless functions as a service', color: colors.ibmComputeColor, icon: <FunctionsIcon /> },
      { type: 'ibmKubernetes' as SecurityNodeType, label: 'Kubernetes Service', description: 'Managed Kubernetes clusters', color: colors.ibmComputeColor, icon: createVendorIconElement('ibm', 'Compute', 'Kubernetes.svg') },
      { type: 'ibmRedHatOpenShift' as SecurityNodeType, label: 'Red Hat OpenShift', description: 'Enterprise Kubernetes platform', color: colors.ibmComputeColor, icon: createVendorIconElement('ibm', 'Compute', 'Open Shift.svg') },
      { type: 'ibmObjectStorage' as SecurityNodeType, label: 'Object Storage', description: 'Durable object storage', color: colors.ibmStorageColor, icon: createVendorIconElement('ibm', 'Data & Storage', 'Object Storage Application.svg') },
      { type: 'ibmBlockStorage' as SecurityNodeType, label: 'Block Storage', description: 'High-performance block storage', color: colors.ibmStorageColor, icon: createVendorIconElement('ibm', 'Data & Storage', 'Block Storage Application.svg') },
      { type: 'ibmFileStorage' as SecurityNodeType, label: 'File Storage', description: 'Network-attached file storage', color: colors.ibmStorageColor, icon: createVendorIconElement('ibm', 'Data & Storage', 'File Storage.svg') },
      { type: 'ibmDatabase' as SecurityNodeType, label: 'Database', description: 'Managed database services', color: colors.ibmDatabaseColor, icon: createVendorIconElement('ibm', 'Data & Storage', 'Database.svg') },
      { type: 'ibmCloudant' as SecurityNodeType, label: 'Cloudant', description: 'NoSQL JSON database', color: colors.ibmDatabaseColor, icon: <StorageIcon /> },
      { type: 'ibmDB2' as SecurityNodeType, label: 'DB2', description: 'Relational database service', color: colors.ibmDatabaseColor, icon: <StorageIcon /> },
      { type: 'ibmDatabases' as SecurityNodeType, label: 'Databases for...', description: 'Managed database services', color: colors.ibmDatabaseColor, icon: <StorageIcon /> },
      { type: 'ibmVPC' as SecurityNodeType, label: 'VPC', description: 'Virtual Private Cloud networking', color: colors.ibmNetworkingColor, icon: createVendorIconElement('ibm', 'Networking', 'VPC.svg') },
      { type: 'ibmLoadBalancer' as SecurityNodeType, label: 'Load Balancer', description: 'Application load balancing', color: colors.ibmNetworkingColor, icon: createVendorIconElement('ibm', 'Networking', 'Load Balancer VPC.svg') },
      { type: 'ibmCloudInternetServices' as SecurityNodeType, label: 'Cloud Internet Services', description: 'DDoS protection and CDN', color: colors.ibmNetworkingColor, icon: <PublicIcon /> },
      { type: 'ibmDirectLink' as SecurityNodeType, label: 'Direct Link', description: 'Dedicated network connection', color: colors.ibmNetworkingColor, icon: createVendorIconElement('ibm', 'Networking', 'Direct Link.svg') },
      { type: 'ibmTransitGateway' as SecurityNodeType, label: 'Transit Gateway', description: 'Connect VPCs and on-premises networks', color: colors.ibmNetworkingColor, icon: <HubIcon /> },
      { type: 'ibmCloudIAM' as SecurityNodeType, label: 'Cloud IAM', description: 'Identity and Access Management', color: colors.ibmSecurityColor, icon: createVendorIconElement('ibm', 'Security', 'Identity and Access Management.svg') },
      { type: 'ibmAppID' as SecurityNodeType, label: 'App ID', description: 'Application user authentication', color: colors.ibmSecurityColor, icon: <AccountCircleIcon /> },
      { type: 'ibmKeyProtect' as SecurityNodeType, label: 'Key Protect', description: 'Key management service', color: colors.ibmSecurityColor, icon: createVendorIconElement('ibm', 'Security', 'Key.svg') },
      { type: 'ibmSecretsManager' as SecurityNodeType, label: 'Secrets Manager', description: 'Centralized secrets management', color: colors.ibmSecurityColor, icon: createVendorIconElement('ibm', 'Security', 'Secrets Manager.svg') },
      { type: 'ibmSecurityGateway' as SecurityNodeType, label: 'Security Gateway', description: 'Perimeter and access control', color: colors.ibmSecurityColor, icon: createVendorIconElement('ibm', 'Security', 'Security Gateway.svg') },
      { type: 'ibmSecurityAdvisor' as SecurityNodeType, label: 'Security and Compliance Center', description: 'Security posture management', color: colors.ibmSecurityColor, icon: <DashboardIcon /> },
      { type: 'ibmCertificateManager' as SecurityNodeType, label: 'Certificate Manager', description: 'SSL/TLS certificate management', color: colors.ibmSecurityColor, icon: createVendorIconElement('ibm', 'Security', 'Certificate.svg') },
      { type: 'ibmHyperProtect' as SecurityNodeType, label: 'Hyper Protect', description: 'Keep Your Own Key encryption', color: colors.ibmSecurityColor, icon: <ShieldIcon /> },
      { type: 'ibmCloudFirewall' as SecurityNodeType, label: 'Cloud Firewall', description: 'Network security firewall', color: colors.ibmSecurityColor, icon: <ShieldIcon /> },
      { type: 'ibmCloudMonitoring' as SecurityNodeType, label: 'Cloud Monitoring', description: 'Infrastructure and application monitoring', color: colors.ibmMonitoringColor, icon: createVendorIconElement('ibm', 'Observability', 'cloud--monitoring.svg') },
      { type: 'ibmLogAnalysis' as SecurityNodeType, label: 'Log Analysis', description: 'Centralized log management', color: colors.ibmMonitoringColor, icon: createVendorIconElement('ibm', 'Observability', 'cloud--logging.svg') },
      { type: 'ibmActivityTracker' as SecurityNodeType, label: 'Activity Tracker', description: 'Audit and compliance tracking', color: colors.ibmMonitoringColor, icon: createVendorIconElement('ibm', 'Observability', 'cloud--auditing.svg') },
      { type: 'ibmWatsonStudio' as SecurityNodeType, label: 'Watson Studio', description: 'AI and machine learning platform', color: colors.ibmAIColor, icon: <PsychologyIcon /> },
      { type: 'ibmWatsonAssistant' as SecurityNodeType, label: 'Watson Assistant', description: 'Conversational AI chatbot', color: colors.ibmAIColor, icon: <SmartToyIcon /> },
      { type: 'ibmWatsonDiscovery' as SecurityNodeType, label: 'Watson Discovery', description: 'AI-powered search and analytics', color: colors.ibmAIColor, icon: <SearchIcon /> },
      { type: 'ibmContinuousDelivery' as SecurityNodeType, label: 'Continuous Delivery', description: 'DevOps toolchain and pipeline', color: colors.ibmDevOpsColor, icon: createVendorIconElement('ibm', 'DevOps', 'Continuous Delivery.svg') },
      { type: 'ibmCloudShell' as SecurityNodeType, label: 'Cloud Shell', description: 'Browser-based shell environment', color: colors.ibmDevOpsColor, icon: <CodeIcon /> }
    ]
  },
  {
    title: "OT/SCADA",
    icon: <PrecisionManufacturingIcon />,
    nodes: [
      { type: 'plc', label: 'PLC', description: 'Programmable Logic Controller', color: colors.plcColor, icon: <MemoryIcon /> },
      { type: 'hmi', label: 'HMI', description: 'Human Machine Interface', color: colors.hmiColor, icon: <TouchAppIcon /> },
      { type: 'historian', label: 'Historian', description: 'Data historian', color: colors.historianColor, icon: <HistoryIcon /> },
      { type: 'rtu', label: 'RTU', description: 'Remote Terminal Unit', color: colors.rtuColor, icon: <CellTowerIcon /> },
      { type: 'sensor', label: 'Sensor', description: 'Industrial sensor', color: colors.sensorColor, icon: <SensorsIcon /> },
      { type: 'actuator', label: 'Actuator', description: 'Industrial actuator', color: colors.actuatorColor, icon: <TuneIcon /> },
      { type: 'scadaServer', label: 'SCADA Server', description: 'SCADA control server', color: colors.scadaServerColor, icon: <DashboardIcon /> },
      { type: 'industrialFirewall', label: 'Industrial FW', description: 'Industrial firewall', color: colors.industrialFirewallColor, icon: <LocalFireDepartmentIcon /> },
      { type: 'safetySystem', label: 'Safety System', description: 'Safety instrumented system', color: colors.safetySystemColor, icon: <HealthAndSafetyIcon /> },
      { type: 'industrialNetwork', label: 'Industrial Net', description: 'Industrial network', color: colors.industrialNetworkColor, icon: <WifiIcon /> }
    ]
  },
  {
    title: "AI/ML",
    icon: <SmartToyIcon />,
    nodes: [
      { type: 'aiGateway', label: 'AI Gateway', description: 'API gateway for AI services with authentication and rate limiting', color: colors.aiGatewayColor, icon: <HubOutlinedIcon /> },
      { type: 'inferenceEngine', label: 'Inference Engine', description: 'AI model inference service for real-time predictions', color: colors.inferenceEngineColor, icon: <PsychologyIcon /> },
      { type: 'modelRegistry', label: 'Model Registry', description: 'Central repository for trained AI models and metadata', color: colors.modelRegistryColor, icon: <ModelTrainingIcon /> },
      { type: 'aiWorkbench', label: 'AI Workbench', description: 'Development environment for data scientists and ML engineers', color: colors.aiWorkbenchColor, icon: <ScienceIcon /> },
      { type: 'mlPipeline', label: 'ML Pipeline', description: 'Automated ML training and deployment pipeline', color: colors.mlPipelineColor, icon: <AccountTreeOutlinedIcon /> },
      { type: 'aiModel', label: 'AI Model Store', description: 'Secure storage for proprietary AI models and weights', color: colors.aiModelColor, icon: <SmartToyIcon /> },
      { type: 'vectorDatabase', label: 'Vector Database', description: 'High-performance vector database for embeddings and similarity search', color: colors.vectorDatabaseColor, icon: <DatasetIcon /> },
      { type: 'dataLake', label: 'Data Lake', description: 'Secure data lake containing training datasets and sensitive information', color: colors.dataLakeColor, icon: <StorageIcon /> },
      { type: 'featureStore', label: 'Feature Store', description: 'Centralized repository for ML features with lineage tracking', color: colors.featureStoreColor, icon: <SchemaIcon /> },
      { type: 'llmService', label: 'LLM Service', description: 'Self-hosted large language model for sensitive operations', color: colors.llmServiceColor, icon: <AutoGraphIcon /> },
      { type: 'ai', label: 'AI System', description: 'Generic AI/ML system or service', color: colors.aiModelColor, icon: <BiotechIcon /> },
      { type: 'mlInference', label: 'ML Inference', description: 'GPU-accelerated model serving and inference engine', color: colors.mlInferenceColor, icon: <PsychologyIcon /> },
      { type: 'notebookServer', label: 'Notebook Server', description: 'Interactive notebook environment for data science and ML development', color: colors.notebookServerColor, icon: <DescriptionIcon /> },
      { type: 'computeCluster', label: 'Compute Cluster', description: 'Distributed computing cluster for model training and batch processing', color: colors.computeClusterColor, icon: <DeveloperBoardIcon /> },
      { type: 'modelVault', label: 'Model Vault', description: 'Secure storage for proprietary models and encryption keys', color: colors.modelVaultColor, icon: <LockIcon /> },
      { type: 'securityScanner', label: 'Security Scanner', description: 'Vulnerability and security scanner for threat analysis', color: colors.securityScannerColor, icon: <SecurityIcon /> }
    ]
  },
  {
    title: "Cybercrime & Fraud",
    icon: <WarningIcon />,
    nodes: [
      { type: 'fraudDetection', label: 'Fraud Detection', description: 'System for detecting fraudulent transactions and activities', color: colors.fraudDetectionColor, icon: <QueryStatsIcon /> },
      { type: 'transactionMonitor', label: 'Transaction Monitor', description: 'Real-time transaction monitoring and alerting', color: colors.transactionMonitorColor, icon: <MonetizationOnIcon /> },
      { type: 'antiMalware', label: 'Anti-Malware', description: 'Malware detection and prevention system', color: colors.antiMalwareColor, icon: <BugReportOutlinedIcon /> },
      { type: 'honeypot', label: 'Honeypot', description: 'Decoy system to attract and analyze attackers', color: colors.honeypotColor, icon: <CatchingPokemonIcon /> },
      { type: 'threatFeed', label: 'Threat Intelligence', description: 'External threat intelligence feed', color: colors.threatFeedColor, icon: <RadarIcon /> },
      { type: 'sandboxEnv', label: 'Sandbox', description: 'Isolated environment for malware analysis', color: colors.sandboxEnvColor, icon: <ScienceOutlinedIcon /> },
      { type: 'forensicsWorkstation', label: 'Forensics Station', description: 'Digital forensics workstation for incident analysis', color: colors.forensicsWorkstationColor, icon: <FindInPageIcon /> },
      { type: 'incidentResponse', label: 'Incident Response', description: 'Incident response management system', color: colors.incidentResponseColor, icon: <NotificationsActiveIcon /> },
      { type: 'cyberInsurance', label: 'Cyber Insurance', description: 'Cyber insurance policy and claims management', color: colors.cyberInsuranceColor, icon: <GavelIcon /> },
      { type: 'fraudAnalytics', label: 'Fraud Analytics', description: 'Advanced analytics for fraud pattern detection', color: colors.fraudAnalyticsColor, icon: <DataThresholdingIcon /> }
    ]
  },
  {
    title: "Privacy & Data Protection",
    icon: <LockIcon />,
    nodes: [
      { type: 'dataClassifier', label: 'Data Classifier', description: 'Automatically classifies data based on sensitivity', color: colors.dataClassifierColor, icon: <CategoryIconMUI /> },
      { type: 'consentManager', label: 'Consent Manager', description: 'Manages user consent and preferences', color: colors.consentManagerColor, icon: <ManageAccountsIcon /> },
      { type: 'dataMapper', label: 'Data Mapper', description: 'Maps data flows and lineage across systems', color: colors.dataMapperColor, icon: <AccountTreeOutlinedIcon /> },
      { type: 'privacyScanner', label: 'Privacy Scanner', description: 'Scans systems for privacy compliance issues', color: colors.privacyScannerColor, icon: <VisibilityIcon /> },
      { type: 'dataRetention', label: 'Data Retention', description: 'Manages data retention policies and deletion', color: colors.dataRetentionColor, icon: <DeleteForeverIcon /> },
      { type: 'dataAnonymizer', label: 'Data Anonymizer', description: 'Anonymizes or pseudonymizes personal data', color: colors.dataAnonymizerColor, icon: <BlurOnIcon /> },
      { type: 'gdprCompliance', label: 'GDPR Compliance', description: 'GDPR compliance monitoring and reporting', color: colors.gdprComplianceColor, icon: <VerifiedUserIcon /> },
      { type: 'dataBreach', label: 'Breach Detection', description: 'Data breach detection and notification system', color: colors.dataBreachColor, icon: <NotificationsActiveIcon /> },
      { type: 'privacyImpact', label: 'Privacy Impact', description: 'Privacy impact assessment tools', color: colors.privacyImpactColor, icon: <PrivacyTipIcon /> },
      { type: 'dataSubjectRights', label: 'Data Subject Rights', description: 'Handles data subject access and deletion requests', color: colors.dataSubjectRightsColor, icon: <PersonOffIcon /> }
    ]
  },
  {
    title: "Red Teaming",
    icon: <BugReportIcon />,
    nodes: [
      { type: 'attackBox', label: 'Attack Box', description: 'Red team operator workstation for attack simulation', color: colors.attackBoxColor, icon: <PestControlIcon /> },
      { type: 'payloadServer', label: 'Payload Server', description: 'Server hosting malicious payloads and exploits', color: colors.payloadServerColor, icon: <CloudUploadIcon /> },
      { type: 'c2Server', label: 'C2 Server', description: 'Command and control server for managing compromised systems', color: colors.c2ServerColor, icon: <WifiTetheringIcon /> },
      { type: 'implant', label: 'Implant', description: 'Malicious code or backdoor installed on target system', color: colors.implantColor, icon: <CatchingPokemonIcon /> },
      { type: 'phishingServer', label: 'Phishing Server', description: 'Server hosting phishing campaigns and credential harvesting', color: colors.phishingServerColor, icon: <PhishingIcon /> },
      { type: 'exfilChannel', label: 'Exfiltration Channel', description: 'Covert channel for data exfiltration and communication', color: colors.exfilChannelColor, icon: <LeakAddIcon /> },
      { type: 'pivotPoint', label: 'Pivot Point', description: 'Compromised system used as stepping stone for lateral movement', color: colors.pivotPointColor, icon: <TimelineIcon /> },
      { type: 'credentialHarvester', label: 'Credential Harvester', description: 'Tool or technique for collecting user credentials', color: colors.credentialHarvesterColor, icon: <VpnLockIcon /> },
      { type: 'lateralMovement', label: 'Lateral Movement', description: 'Technique for moving through network after initial compromise', color: colors.lateralMovementColor, icon: <SwapHorizIcon /> },
      { type: 'persistenceMechanism', label: 'Persistence', description: 'Method for maintaining access to compromised system', color: colors.persistenceMechanismColor, icon: <RestoreIcon /> }
    ]
  },
  {
    title: "Security Operations",
    icon: <ShieldIcon />,
    nodes: [
      { type: 'socWorkstation', label: 'SOC Workstation', description: 'Security analyst workstation for monitoring and investigation', color: colors.socColor, icon: <ComputerIcon /> },
      { type: 'threatHuntingPlatform', label: 'Threat Hunting Platform', description: 'Platform for proactive threat hunting and analysis', color: colors.huntingColor, icon: <RadarIcon /> },
      { type: 'ctiFeed', label: 'CTI Feed', description: 'Cyber threat intelligence feed aggregator', color: colors.ctiColor, icon: <RocketLaunchIcon /> },
      { type: 'attackSurfaceMonitor', label: 'Attack Surface Monitor', description: 'External attack surface monitoring service', color: colors.asmColor, icon: <PublicIcon /> },
      { type: 'deceptionToken', label: 'Deception Token', description: 'Canary token or honey file for detection', color: colors.deceptionColor, icon: <CatchingPokemonIcon /> },
      { type: 'behaviorAnalytics', label: 'Behavior Analytics', description: 'User and entity behavior analytics platform', color: colors.uebaColor, icon: <AnalyticsIcon /> },
      { type: 'networkForensics', label: 'Network Forensics', description: 'Network traffic capture and forensics appliance', color: colors.forensicsColor, icon: <NetworkCheckIcon /> },
      { type: 'malwareRepository', label: 'Malware Repository', description: 'Secure storage for malware samples and analysis', color: colors.malwareColor, icon: <ScienceIcon /> },
      { type: 'indicatorStore', label: 'Indicator Store', description: 'IoC management and correlation platform', color: colors.iocColor, icon: <StorageIcon /> },
      { type: 'playbookEngine', label: 'Playbook Engine', description: 'Security orchestration and automated response', color: colors.playbookColor, icon: <IntegrationInstructionsIcon /> }
    ]
  }
];

const NodeToolbox: React.FC<NodeToolboxProps> = ({
  onDragStart,
  onNodeCreate,
  isCompactViewport = false,
  nodes,
  edges
}) => {
  const [expandedCategory, setExpandedCategory] = useState<string | false>(false);
  const { settings } = useSettings();
  const currentTheme = getTheme(settings.theme, settings.customTheme);
  
  // Node Selector states
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedNodeType, setSelectedNodeType] = useState<string>('');
  
  const allNodes = useMemo(() => nodeCategories.flatMap(cat => cat.nodes || []).filter(Boolean), []);
  
  const availableNodes = useMemo(() => {
    const nodes = !selectedCategory 
      ? allNodes 
      : nodeCategories.find(cat => cat.title === selectedCategory)?.nodes || allNodes;
    
    // Deduplicate nodes by creating a unique key for each node
    const uniqueNodesMap = new Map();
    nodes.forEach(node => {
      const uniqueKey = node.zoneType ? `${node.type}-${node.zoneType}` : node.type;
      if (!uniqueNodesMap.has(uniqueKey)) {
        uniqueNodesMap.set(uniqueKey, node);
      }
    });
    
    return Array.from(uniqueNodesMap.values());
  }, [selectedCategory, allNodes]);
  
  // Get selected node details (search full list)
  const selectedNode = useMemo(() => {
    if (!selectedNodeType) return null;
    return allNodes.find(node => {
      const nodeKey = node.zoneType ? `${node.type}-${node.zoneType}` : node.type;
      return nodeKey === selectedNodeType;
    }) || null;
  }, [selectedNodeType, allNodes]);

  return (
    <StyledPaper>
      {/* Main Header */}
      <ToolboxHeader>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: '6px',
              background: `linear-gradient(135deg, ${currentTheme.colors.primary} 0%, ${currentTheme.colors.secondary} 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            <ViewModuleIcon sx={{ color: '#fff', fontSize: 16 }} />
          </Box>
          <Typography 
            variant="subtitle1" 
            sx={{ 
              background: `linear-gradient(135deg, ${currentTheme.colors.primary} 0%, ${currentTheme.colors.secondary} 100%)`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 600,
              fontSize: '16px',
              letterSpacing: '0.5px',
            }}
          >
            Node Toolbox
          </Typography>
        </Box>
      </ToolboxHeader>

      {/* Node Finder */}
      <Box sx={{ p: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '14px', mb: 0.5 }}>
          Node Finder
        </Typography>
        <NodeFinder nodes={nodes} edges={edges} />
      </Box>
      
      {/* Node Builder Section */}
      <Box sx={{ px: 1, py: 0.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '14px' }}>
          Node Builder
        </Typography>
        <Typography variant="caption" sx={{ fontSize: '11px', color: currentTheme.colors.textSecondary }}>
          Drag or double-click to create nodes
        </Typography>
      </Box>
      
      {/* Node Selector */}
      <NodeSelectorContainer elevation={0}>
        <Typography sx={{ fontSize: '13px', fontWeight: 600, mb: 1, color: currentTheme.colors.textPrimary }}>
          Quick Node Selector
        </Typography>
        
        <FormControl fullWidth size="small">
          <Select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setSelectedNodeType('');
            }}
            displayEmpty
            sx={{
              '& .MuiSelect-select': {
                fontSize: '13px',
                color: currentTheme.colors.textPrimary,
              }
            }}
          >
            <MenuItem value="">
              <em style={{ color: currentTheme.colors.textSecondary }}>Select Category</em>
            </MenuItem>
            {nodeCategories.map(category => (
              <MenuItem key={category.title} value={category.title}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', color: currentTheme.colors.textSecondary }}>
                    {category.icon}
                  </Box>
                  {category.title}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <Autocomplete
          size="small"
          fullWidth
          options={availableNodes}
          getOptionLabel={(option) => option.label}
          onChange={(event, value) => {
            const key = value ? (value.zoneType ? `${value.type}-${value.zoneType}` : value.type) : '';
            setSelectedNodeType(key);
          }}
          renderInput={(params) => (
            <TextField 
              {...params} 
              placeholder="Search Node Type"
              sx={{
                '& .MuiInputBase-input': {
                  fontSize: '13px',
                  padding: '8px 12px',
                  color: currentTheme.colors.textPrimary,
                  '&::placeholder': {
                    fontStyle: 'italic',
                    color: currentTheme.colors.textSecondary,
                    opacity: 1
                  }
                }
              }}
            />
          )}
          renderOption={(props, option) => {
            const nodeColor = settings.themeAwareNodeColors ? currentTheme.colors.primary : option.color;
            return (
              <li {...props} key={option.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <NodeIcon sx={{ color: nodeColor }}>{option.icon || <StorageIcon />}</NodeIcon>
                {option.label}
              </li>
            );
          }}
        />
        
        {selectedNode && (
          <Tooltip
            title={`${selectedNode.description} (${isCompactViewport ? 'tap to add' : 'drag or double-click to create'})`}
            placement="bottom"
            disableTouchListener={isCompactViewport}
            disableHoverListener={isCompactViewport}
          >
            <DraggableNodePreview
              draggable={!isCompactViewport}
              onDragStart={(event) => onDragStart(event, selectedNode.type, selectedNode.zoneType)}
              onDoubleClick={() => onNodeCreate?.(selectedNode.type, selectedNode.zoneType)}
              onClick={() => {
                if (isCompactViewport) {
                  onNodeCreate?.(selectedNode.type, selectedNode.zoneType);
                }
              }}
              sx={{
                borderColor: settings.themeAwareNodeColors ? currentTheme.colors.primary : selectedNode.color,
                color: currentTheme.colors.textPrimary,
                backgroundColor: settings.themeAwareNodeColors ? currentTheme.colors.surface : currentTheme.colors.nodeBg,
                '&:hover': {
                  backgroundColor: settings.themeAwareNodeColors ? currentTheme.colors.surfaceHover : `${selectedNode.color}20`,
                }
              }}
            >
              <NodeIcon sx={{ color: settings.themeAwareNodeColors ? currentTheme.colors.secondary : selectedNode.color }}>
                {selectedNode.icon || <StorageIcon />}
              </NodeIcon>
              <Typography sx={{ fontSize: '13px', fontWeight: 500 }}>
                {selectedNode.label}
              </Typography>
            </DraggableNodePreview>
          </Tooltip>
        )}
      </NodeSelectorContainer>
      
      <Divider sx={{ my: 0.5 }} />
      
      <Box
        sx={{
          p: 0.8,
          flexGrow: isCompactViewport ? 0 : 1,
          flexShrink: isCompactViewport ? 0 : 1,
          minHeight: isCompactViewport ? 'auto' : 0,
          overflowY: isCompactViewport ? 'visible' : 'auto',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y'
        }}
      >
        {nodeCategories.map((category) => (
          <StyledAccordion
            key={category.title}
            expanded={expandedCategory === category.title}
            onChange={() => setExpandedCategory(expandedCategory === category.title ? false : category.title)}
          >
            <AccordionSummary 
              expandIcon={<ExpandMoreIcon sx={{ color: currentTheme.colors.textPrimary, fontSize: 20 }} />}
              sx={{ 
                '& .MuiAccordionSummary-content': { 
                  margin: '6px 0',
                  display: 'flex',
                  alignItems: 'center',
                }
              }}
            >
              <CategoryIcon sx={{ color: currentTheme.colors.textSecondary }}>
                {category.icon}
              </CategoryIcon>
              <Typography sx={{ 
                color: currentTheme.colors.textPrimary,
                fontSize: '14px',
              }}>
                {category.title}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ padding: 0.8 }}>
              <List sx={{ 
                p: 0,
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 0.8,
              }}>
              {category.nodes.map(({ type, label, description, color, icon, zoneType }) => {
                const nodeKey = zoneType ? `${type}-${zoneType}` : type;
                // Use theme colors if the setting is enabled, otherwise use static colors
                // For security zones, always show consistent zone palette in toolbox (no theme override)
                const isZone = type === 'securityZone';
                const nodeColor = isZone ? color : (settings.themeAwareNodeColors ? currentTheme.colors.primary : color);
                const iconColor = isZone ? color : (settings.themeAwareNodeColors ? currentTheme.colors.secondary : color);
                const nodeBgColor = isZone ? `${color}20` : (settings.themeAwareNodeColors ? currentTheme.colors.surface : currentTheme.colors.nodeBg);
                const nodeHoverBgColor = isZone ? `${color}30` : (settings.themeAwareNodeColors ? currentTheme.colors.surfaceHover : `${nodeColor}20`);
                
                return (
                  <Tooltip
                    key={nodeKey}
                    title={description}
                    placement="right"
                    disableTouchListener={isCompactViewport}
                    disableHoverListener={isCompactViewport}
                  >
                    <StyledNodeItem 
                      className={settings.effects?.enabled && settings.effects?.neon ? 'neon-text' : ''}
                      sx={{
                        border: `1px solid ${nodeColor}`,
                        backgroundColor: nodeBgColor,
                        '&:hover': {
                          backgroundColor: nodeHoverBgColor,
                          borderColor: nodeColor,
                        },
                        color: currentTheme.colors.textPrimary,
                        display: 'flex',
                        alignItems: 'center',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      draggable={!isCompactViewport}
                      onDragStart={(event) => onDragStart(event, type, zoneType)}
                      onDoubleClick={() => onNodeCreate?.(type, zoneType)}
                      onClick={() => {
                        if (isCompactViewport) {
                          onNodeCreate?.(type, zoneType);
                        }
                      }}
                    >
                      <NodeIcon sx={{ color: iconColor }}>
                        {icon}
                      </NodeIcon>
                      <span style={{ 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis',
                        fontSize: '12px',
                      }}>
                        {label}
                      </span>
                    </StyledNodeItem>
                  </Tooltip>
                );
              })}
              </List>
            </AccordionDetails>
          </StyledAccordion>
        ))}
      </Box>
    </StyledPaper>
  );
};

// NodeToolbox is mostly static and shouldn't re-render often
// Only re-render if onDragStart callback changes
export default React.memo(NodeToolbox);
