import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityNode, SecurityEdge } from '../../types/SecurityTypes';
import { colors } from '../../styles/Theme';
import { DiagramAttackPath, AttackPathRiskLevel, GrcAsset, GrcRisk, GrcAssessment, GrcSoaEntry, GrcTask, GrcGovernanceDocument, GrcThreatActor, GrcThreatScenario, RiskTierNode, AssessmentThreatModelNodeSourceType, AssessmentThreatModelEdgeSourceType } from '../../types/GrcTypes';
import { StrideCategory } from '../../types/ThreatIntelTypes';
import { buildGrcWorkspace, score, NOW, OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID } from './grcSharedBase';
const nodes: SecurityNode[] = [
  // Zone definitions
  {
    id: 'external-zone',
    type: 'securityZone',
    position: { x: 50, y: 50 },
    data: {
      label: 'External',
      zoneType: 'External',
      description: 'Internet-facing services'
    },
    style: {
        width: 600,
        height: 1000,
        background: colors.zoneBackgrounds.External,
        zIndex: -1
      }
  } as any,
  {
    id: 'dmz-zone',
    type: 'securityZone',
    position: { x: 770, y: 50 },
    data: {
      label: 'DMZ',
      zoneType: 'DMZ',
      description: 'Public-facing healthcare services'
    },
    style: {
        width: 600,
        height: 1000,
        background: colors.zoneBackgrounds.DMZ,
        zIndex: -1
      }
  } as any,
  {
    id: 'internal-zone',
    type: 'securityZone',
    position: { x: 1490, y: 50 },
    data: {
      label: 'Internal',
      zoneType: 'Internal',
      description: 'Hospital internal network'
    },
    style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Internal,
        zIndex: -1
      }
  } as any,
  {
    id: 'critical-zone',
    type: 'securityZone',
    position: { x: 2360, y: 50 },
    data: {
      label: 'Critical',
      zoneType: 'Critical',
      description: 'Medical systems and patient data'
    },
    style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Critical,
        zIndex: -1
      }
  } as any,
  {
    id: 'backup-zone',
    type: 'securityZone',
    position: { x: 1190, y: 1170 },
    data: {
      label: 'Backup Infrastructure',
      zoneType: 'Restricted',
      description: 'Backup and disaster recovery'
    },
    style: {
        width: 600,
        height: 700,
        background: colors.zoneBackgrounds.Restricted,
        zIndex: -1
      }
  } as any,

  // External Zone Components
  {
    id: 'patient-portal',
    type: 'webServer',
    position: { x: 175, y: 325 },
    data: {
      label: 'Patient Portal',
      description: 'Public patient access portal. Running IIS 10.0 with exposed RDP on 3389',
      vendor: 'Microsoft',
      version: 'IIS 10.0',
      zone: 'External',
      dataClassification: 'Sensitive',
      protocols: ['HTTPS', 'RDP'],
      securityControls: ['ssl-cert']
    }
  } as any,
  {
    id: 'vpn-gateway',
    type: 'vpnGateway',
    position: { x: 175, y: 525 },
    data: {
      label: 'Fortinet VPN',
      description: 'FortiGate 60E firmware 6.0.9. Remote access for medical staff',
      vendor: 'Fortinet',
      product: 'FortiGate',
      version: '6.0.9',
      zone: 'External',
      dataClassification: 'Internal',
      securityControls: ['vpn', 'firewall']
    }
  } as any,
  {
    id: 'citrix-gateway',
    type: 'application',
    position: { x: 175, y: 425 },
    data: {
      label: 'Citrix Gateway',
      description: 'Virtual desktop access. NetScaler ADC 13.0 build 84.11',
      vendor: 'Citrix',
      product: 'NetScaler ADC',
      version: '13.0-84.11',
      zone: 'External',
      dataClassification: 'Internal',
      protocols: ['HTTPS'],
      securityControls: ['mfa']
    }
  } as any,

  // DMZ Zone Components
  {
    id: 'exchange-server',
    type: 'application',
    position: { x: 1175, y: 275 },
    data: {
      label: 'Exchange Server',
      description: 'Exchange 2019 CU11. OWA enabled, ECP exposed for remote admin',
      vendor: 'Microsoft',
      product: 'Exchange',
      version: '2019 CU11',
      zone: 'DMZ',
      dataClassification: 'Sensitive',
      protocols: ['HTTPS', 'SMTP'],
      securityControls: ['basic-auth']
    }
  } as any,
  {
    id: 'moveit-server',
    type: 'application',
    position: { x: 1175, y: 125 },
    data: {
      label: 'MOVEit Transfer',
      description: 'File transfer for lab results and imaging. Version 2020.1.8, SQL backend',
      vendor: 'Progress',
      product: 'MOVEit',
      version: '2020.1.8',
      zone: 'DMZ',
      dataClassification: 'Sensitive',
      protocols: ['HTTPS', 'SFTP'],
      securityControls: ['user-auth']
    }
  } as any,
  {
    id: 'telehealth-app',
    type: 'webServer',
    position: { x: 1175, y: 625 },
    data: {
      label: 'Telehealth Platform',
      description: 'Video consultation platform. Log4j 2.14.1 in backend services',
      zone: 'DMZ',
      dataClassification: 'Sensitive',
      vendor: 'Custom',
      protocols: ['HTTPS', 'WebRTC'],
      securityControls: ['oauth']
    }
  } as any,

  // Internal Zone Components
  {
    id: 'domain-controller',
    type: 'identityProvider',
    position: { x: 1625, y: 175 },
    data: {
      label: 'Domain Controller',
      description: 'Windows Server 2016 DC. SYSVOL share accessible, PrintNightmare patches pending',
      vendor: 'Microsoft',
      product: 'Windows Server',
      version: '2016',
      zone: 'Internal',
      dataClassification: 'Confidential',
      securityControls: ['kerberos', 'group-policy']
    }
  } as any,
  {
    id: 'ehr-app-server',
    type: 'application',
    position: { x: 1625, y: 375 },
    data: {
      label: 'EHR Application',
      description: 'Electronic Health Records system. Service account with Domain Admin privileges',
      vendor: 'Epic',
      product: 'EHR',
      zone: 'Internal',
      dataClassification: 'Confidential',
      protocols: ['HTTPS'],
      securityControls: ['sso']
    }
  } as any,
  {
    id: 'pacs-server',
    type: 'database',
    position: { x: 1625, y: 575 },
    data: {
      label: 'PACS Imaging',
      description: 'Medical imaging storage. DICOM protocol, minimal authentication',
      vendor: 'GE Healthcare',
      product: 'PACS',
      zone: 'Internal',
      dataClassification: 'Sensitive',
      protocols: ['DICOM', 'HTTPS'],
      securityControls: ['basic-auth']
    }
  } as any,
  {
    id: 'nurse-stations',
    type: 'workstation',
    position: { x: 1625, y: 775 },
    data: {
      label: 'Nurse Workstations',
      description: 'Shared workstations with generic logins. Windows 10 1909, auto-login enabled',
      zone: 'Internal',
      dataClassification: 'Sensitive',
      vendor: 'Dell',
      osType: 'Windows 10',
      securityControls: ['antivirus']
    }
  } as any,

  // Critical Zone Components
  {
    id: 'patient-db',
    type: 'database',
    position: { x: 2475, y: 125 },
    data: {
      label: 'Patient Database',
      description: 'Primary patient data repository. SQL Server 2017, SA account enabled',
      vendor: 'Microsoft',
      product: 'SQL Server',
      version: '2017',
      zone: 'Critical',
      dataClassification: 'Confidential',
      securityControls: ['db-encryption']
    }
  } as any,
  {
    id: 'medical-devices',
    type: 'sensor',
    position: { x: 2425, y: 475 },
    data: {
      label: 'Medical IoT Devices',
      description: 'Connected medical equipment. Various vendors, minimal security updates',
      zone: 'Critical',
      dataClassification: 'Sensitive',
      vendor: 'Various',
      protocols: ['HL7', 'DICOM'],
      securityControls: ['network-isolation']
    }
  } as any,
  {
    id: 'pharmacy-system',
    type: 'application',
    position: { x: 2475, y: 575 },
    data: {
      label: 'Pharmacy System',
      description: 'Medication management. Direct database access, legacy authentication',
      zone: 'Critical',
      dataClassification: 'Confidential',
      vendor: 'McKesson',
      protocols: ['TCP/1433'],
      securityControls: ['user-auth']
    }
  } as any,
  {
    id: 'lab-systems',
    type: 'application',
    position: { x: 2925, y: 225 },
    data: {
      label: 'Laboratory Systems',
      description: 'Lab information system. HL7 interfaces, limited access controls',
      zone: 'Critical',
      dataClassification: 'Sensitive',
      vendor: 'Cerner',
      protocols: ['HL7', 'TCP'],
      securityControls: ['basic-auth']
    }
  } as any,

  // Backup Zone Components
  {
    id: 'esxi-host',
    type: 'server',
    position: { x: 1525, y: 1375 },
    data: {
      label: 'VMware ESXi Host',
      description: 'ESXi 6.7 Update 3. vCenter with default credentials, SSH enabled',
      vendor: 'VMware',
      product: 'ESXi',
      version: '6.7 U3',
      zone: 'Restricted',
      dataClassification: 'Confidential',
      securityControls: ['hypervisor']
    }
  } as any,
  {
    id: 'backup-server',
    type: 'server',
    position: { x: 1925, y: 1375 },
    data: {
      label: 'Veeam Backup',
      description: 'Veeam B&R 11. Service account with full vSphere access',
      vendor: 'Veeam',
      product: 'Backup & Replication',
      version: '11',
      zone: 'Restricted',
      dataClassification: 'Confidential',
      securityControls: ['encryption']
    }
  } as any,
  {
    id: 'nas-storage',
    type: 'database',
    position: { x: 1725, y: 1225 },
    data: {
      label: 'NAS Storage',
      description: 'QNAP NAS for file shares. SMBv1 enabled, admin/admin credentials',
      vendor: 'QNAP',
      product: 'TS-453',
      zone: 'Restricted',
      dataClassification: 'Confidential',
      protocols: ['SMB', 'NFS'],
      securityControls: ['none']
    }
  } as any
];

const edges: SecurityEdge[] = [
  // External access paths
  {
    id: 'internet-to-portal',
    source: 'patient-portal',
    target: 'ehr-app-server',
    type: 'securityEdge',
    data: {
      label: 'Patient Access',
      protocol: 'HTTPS',
      encryption: 'TLS 1.2',
      zone: 'Internal',
      dataClassification: 'Sensitive'
    }
  } as any,
  {
    id: 'vpn-to-internal',
    source: 'vpn-gateway',
    target: 'nurse-stations',
    type: 'securityEdge',
    data: {
      label: 'Staff Remote Access',
      protocol: 'IPSec',
      encryption: 'AES-128',
      zone: 'Internal',
      dataClassification: 'Internal'
    }
  } as any,
  {
    id: 'citrix-to-internal',
    source: 'citrix-gateway',
    target: 'ehr-app-server',
    type: 'securityEdge',
    data: {
        controlPoints: [{ id: 'cp-1771657669201', x: 1500, y: 450, active: true }],
      label: 'Virtual Desktop',
      protocol: 'ICA',
      encryption: 'TLS 1.2',
      zone: 'Internal',
      dataClassification: 'Sensitive'
    }
  } as any,
  
  // DMZ services
  {
    id: 'exchange-to-dc',
    source: 'exchange-server',
    target: 'domain-controller',
    type: 'securityEdge',
    data: {
      label: 'LDAP Auth',
      protocol: 'LDAP',
      encryption: 'none',
      zone: 'Internal',
      dataClassification: 'Confidential'
    }
  } as any,
  {
    id: 'moveit-to-db',
    source: 'moveit-server',
    target: 'patient-db',
    type: 'securityEdge',
    data: {
      label: 'Direct DB Access',
      protocol: 'TCP/1433',
      encryption: 'none',
      zone: 'Critical',
      dataClassification: 'Confidential',
      description: 'SQL injection vulnerable'
    }
  } as any,
  {
    id: 'telehealth-to-ehr',
    source: 'telehealth-app',
    target: 'ehr-app-server',
    type: 'securityEdge',
    data: {
      label: 'API Integration',
      protocol: 'HTTPS',
      encryption: 'TLS 1.2',
      zone: 'Internal',
      dataClassification: 'Sensitive'
    }
  } as any,
  
  // Internal connections
  {
    id: 'ehr-to-db',
    source: 'ehr-app-server',
    target: 'patient-db',
    type: 'securityEdge',
    data: {
      label: 'Database Access',
      protocol: 'TCP/1433',
      encryption: 'none',
      zone: 'Critical',
      dataClassification: 'Confidential'
    }
  } as any,
  {
    id: 'ehr-to-pacs',
    source: 'ehr-app-server',
    target: 'pacs-server',
    type: 'securityEdge',
    data: {
      label: 'Image Retrieval',
      protocol: 'DICOM',
      encryption: 'none',
      zone: 'Internal',
      dataClassification: 'Sensitive'
    }
  } as any,
  {
    id: 'nurse-to-ehr',
    source: 'nurse-stations',
    target: 'ehr-app-server',
    type: 'securityEdge',
    data: {
      label: 'Clinical Access',
      protocol: 'HTTPS',
      encryption: 'TLS 1.2',
      zone: 'Internal',
      dataClassification: 'Sensitive'
    }
  } as any,
  {
    id: 'nurse-to-pharmacy',
    source: 'nurse-stations',
    target: 'pharmacy-system',
    type: 'securityEdge',
    data: {
      label: 'Medication Orders',
      protocol: 'HTTPS',
      encryption: 'TLS 1.0',
      zone: 'Critical',
      dataClassification: 'Confidential'
    }
  } as any,
  
  // Critical zone connections
  {
    id: 'pharmacy-to-db',
    source: 'pharmacy-system',
    target: 'patient-db',
    type: 'securityEdge',
    data: {
      label: 'Direct SQL',
      protocol: 'TCP/1433',
      encryption: 'none',
      zone: 'Critical',
      dataClassification: 'Confidential'
    }
  } as any,
  {
    id: 'lab-to-db',
    source: 'lab-systems',
    target: 'patient-db',
    type: 'securityEdge',
    data: {
      label: 'Lab Results',
      protocol: 'HL7',
      encryption: 'none',
      zone: 'Critical',
      dataClassification: 'Sensitive'
    }
  } as any,
  {
    id: 'devices-to-ehr',
    source: 'medical-devices',
    target: 'ehr-app-server',
    type: 'securityEdge',
    data: {
      label: 'Device Data',
      protocol: 'HL7',
      encryption: 'none',
      zone: 'Internal',
      dataClassification: 'Sensitive'
    }
  } as any,
  
  // Backup infrastructure
  {
    id: 'backup-to-esxi',
    source: 'backup-server',
    target: 'esxi-host',
    type: 'securityEdge',
    data: {
      label: 'VM Backup',
      protocol: 'HTTPS',
      encryption: 'TLS 1.2',
      zone: 'Restricted',
      dataClassification: 'Confidential'
    }
  } as any,
  {
    id: 'backup-to-nas',
    source: 'backup-server',
    target: 'nas-storage',
    type: 'securityEdge',
    data: {
      label: 'Backup Storage',
      protocol: 'SMB',
      encryption: 'none',
      zone: 'Restricted',
      dataClassification: 'Confidential'
    }
  } as any,
  {
    id: 'ehr-to-nas',
    source: 'ehr-app-server',
    target: 'nas-storage',
    type: 'securityEdge',
    data: {
        controlPoints: [
          { id: 'cp-1771657593773', x: 1850, y: 550, active: true },
          { id: 'cp-1771657585011', x: 1850, y: 1100, active: true }
        ],
      label: 'File Shares',
      protocol: 'SMB',
      encryption: 'none',
      zone: 'Restricted',
      dataClassification: 'Sensitive'
    }
  } as any,
  
  // Critical lateral movement paths
  {
    id: 'dc-to-esxi',
    source: 'domain-controller',
    target: 'esxi-host',
    type: 'securityEdge',
    data: {
        controlPoints: [{ id: 'cp-1771657559717', x: 1550, y: 300, active: true }],
      label: 'Admin Access',
      protocol: 'SSH',
      encryption: 'SSH',
      zone: 'Restricted',
      dataClassification: 'Confidential',
      description: 'Domain admin to ESXi'
    }
  } as any,
  {
    id: 'portal-rdp-lateral',
    source: 'patient-portal',
    target: 'domain-controller',
    type: 'securityEdge',
    data: {
      label: 'RDP Lateral',
      protocol: 'RDP',
      encryption: 'none',
      zone: 'Internal',
      dataClassification: 'Confidential',
      description: 'Exposed RDP access'
    }
  } as any
];

const tierCatalogue: RiskTierNode[] = [
  { id: 'hcr-tier1-cyber', tier: 1 as const, label: 'Cyber Risk', description: 'Information security and cyber threats to healthcare systems' },
  { id: 'hcr-tier1-operational', tier: 1 as const, label: 'Operational Risk', description: 'Clinical and business operations continuity risks' },
  { id: 'hcr-tier1-compliance', tier: 1 as const, label: 'Compliance Risk', description: 'Regulatory and legal compliance risks' },
  { id: 'hcr-tier2-ransomware', tier: 2 as const, label: 'Ransomware & Extortion', parentId: 'hcr-tier1-cyber', description: 'Ransomware deployment, double extortion, and data encryption threats' },
  { id: 'hcr-tier2-identity', tier: 2 as const, label: 'Identity & Access', parentId: 'hcr-tier1-cyber', description: 'Authentication, credential theft, and privilege escalation' },
  { id: 'hcr-tier2-medical-device', tier: 2 as const, label: 'Medical Device Security', parentId: 'hcr-tier1-cyber', description: 'Connected medical equipment vulnerabilities and IoT threats' },
  { id: 'hcr-tier2-data-breach', tier: 2 as const, label: 'Data Breach', parentId: 'hcr-tier1-cyber', description: 'Protected health information exposure and exfiltration' },
  { id: 'hcr-tier2-clinical-ops', tier: 2 as const, label: 'Clinical Operations', parentId: 'hcr-tier1-operational', description: 'Impact on patient care delivery and clinical workflows' },
  { id: 'hcr-tier2-supply-chain', tier: 2 as const, label: 'Supply Chain', parentId: 'hcr-tier1-operational', description: 'Third-party vendor and software supply chain risks' },
  { id: 'hcr-tier2-hipaa', tier: 2 as const, label: 'HIPAA Compliance', parentId: 'hcr-tier1-compliance', description: 'HIPAA Privacy and Security Rule violations' },
  { id: 'hcr-tier3-credential-theft', tier: 3 as const, label: 'Credential Harvesting', parentId: 'hcr-tier2-identity' },
  { id: 'hcr-tier3-lateral-movement', tier: 3 as const, label: 'Lateral Movement', parentId: 'hcr-tier2-ransomware' },
  { id: 'hcr-tier3-phi-exfiltration', tier: 3 as const, label: 'PHI Exfiltration', parentId: 'hcr-tier2-data-breach' },
  { id: 'hcr-tier3-unpatched-devices', tier: 3 as const, label: 'Unpatched Medical Devices', parentId: 'hcr-tier2-medical-device' },
  { id: 'hcr-tier3-backup-destruction', tier: 3 as const, label: 'Backup Destruction', parentId: 'hcr-tier2-ransomware' },
  { id: 'hcr-tier3-legacy-protocols', tier: 3 as const, label: 'Legacy Protocol Exploitation', parentId: 'hcr-tier2-medical-device' },
];

const assets: GrcAsset[] = [
  {
    id: 'hcr-asset-ehr', name: 'EHR Application', type: 'application_server', owner: 'Clinical IT',
    domain: 'application' as const, category: 'Clinical Systems',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Epic Electronic Health Records system with Domain Admin service account. Central hub for all clinical data access.',
    criticality: { confidentiality: 5, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 5 },
    diagramRefs: [{ diagramId: 'healthcare-ransomware', nodeId: 'ehr-app-server', nodeLabel: 'EHR Application', nodeType: 'application' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hcr-asset-patient-db', name: 'Patient Database', type: 'database', owner: 'Database Administration',
    domain: 'application' as const, category: 'Data Stores',
    businessCriticality: 5, securityCriticality: 5,
    description: 'SQL Server 2017 primary patient data repository with SA account enabled. Contains all PHI records.',
    criticality: { confidentiality: 5, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 4 },
    diagramRefs: [{ diagramId: 'healthcare-ransomware', nodeId: 'patient-db', nodeLabel: 'Patient Database', nodeType: 'database' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hcr-asset-medical-devices', name: 'Medical IoT Devices', type: 'iot_device', owner: 'Biomedical Engineering',
    domain: 'ot' as const, category: 'Medical Equipment',
    businessCriticality: 5, securityCriticality: 4,
    description: 'Connected medical equipment from various vendors with minimal security updates due to FDA regulations.',
    criticality: { confidentiality: 3, integrity: 5, availability: 5, financial: 4, reputation: 5, safety: 5 },
    diagramRefs: [{ diagramId: 'healthcare-ransomware', nodeId: 'medical-devices', nodeLabel: 'Medical IoT Devices', nodeType: 'sensor' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hcr-asset-pharmacy', name: 'Pharmacy System', type: 'application_server', owner: 'Pharmacy IT',
    domain: 'application' as const, category: 'Clinical Systems',
    businessCriticality: 5, securityCriticality: 4,
    description: 'McKesson medication management system with direct database access and legacy authentication.',
    criticality: { confidentiality: 4, integrity: 5, availability: 5, financial: 4, reputation: 4, safety: 5 },
    diagramRefs: [{ diagramId: 'healthcare-ransomware', nodeId: 'pharmacy-system', nodeLabel: 'Pharmacy System', nodeType: 'application' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hcr-asset-domain-controller', name: 'Domain Controller', type: 'identity_provider', owner: 'IT Infrastructure',
    domain: 'it' as const, category: 'Identity & Access',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Windows Server 2016 domain controller with accessible SYSVOL share and pending PrintNightmare patches.',
    criticality: { confidentiality: 5, integrity: 5, availability: 5, financial: 4, reputation: 4, safety: 3 },
    diagramRefs: [{ diagramId: 'healthcare-ransomware', nodeId: 'domain-controller', nodeLabel: 'Domain Controller', nodeType: 'identityProvider' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hcr-asset-exchange', name: 'Exchange Server', type: 'application_server', owner: 'IT Infrastructure',
    domain: 'application' as const, category: 'Communication',
    businessCriticality: 4, securityCriticality: 4,
    description: 'Exchange 2019 CU11 with OWA and ECP exposed for remote admin. Located in DMZ.',
    criticality: { confidentiality: 4, integrity: 4, availability: 4, financial: 3, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'healthcare-ransomware', nodeId: 'exchange-server', nodeLabel: 'Exchange Server', nodeType: 'application' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hcr-asset-backup', name: 'Backup Infrastructure', type: 'server', owner: 'IT Infrastructure',
    domain: 'it' as const, category: 'Disaster Recovery',
    businessCriticality: 5, securityCriticality: 4,
    description: 'Veeam Backup & Replication 11, ESXi 6.7 host, and QNAP NAS with default credentials and SMBv1.',
    criticality: { confidentiality: 4, integrity: 5, availability: 5, financial: 5, reputation: 3, safety: 2 },
    diagramRefs: [
      { diagramId: 'healthcare-ransomware', nodeId: 'backup-server', nodeLabel: 'Veeam Backup', nodeType: 'server' },
      { diagramId: 'healthcare-ransomware', nodeId: 'esxi-host', nodeLabel: 'VMware ESXi Host', nodeType: 'server' },
      { diagramId: 'healthcare-ransomware', nodeId: 'nas-storage', nodeLabel: 'NAS Storage', nodeType: 'database' },
    ],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hcr-asset-lab-systems', name: 'Laboratory Systems', type: 'application_server', owner: 'Lab IT',
    domain: 'application' as const, category: 'Clinical Systems',
    businessCriticality: 4, securityCriticality: 3,
    description: 'Cerner lab information system with HL7 interfaces and limited access controls.',
    criticality: { confidentiality: 4, integrity: 5, availability: 4, financial: 3, reputation: 3, safety: 4 },
    diagramRefs: [{ diagramId: 'healthcare-ransomware', nodeId: 'lab-systems', nodeLabel: 'Laboratory Systems', nodeType: 'application' }],
    createdAt: NOW, updatedAt: NOW
  },
];

const risks: GrcRisk[] = [
  {
    id: 'hcr-risk-ransomware-encryption', title: 'Enterprise-Wide Ransomware Encryption',
    description: 'Ransomware group deploys encryptors across hospital network via compromised domain controller, encrypting EHR, pharmacy, lab systems, and backup infrastructure simultaneously. Patient care operations halt across all facilities.',
    status: 'assessed' as const, owner: 'CISO',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Ransomware & Extortion', tier3: 'Lateral Movement' },
    assetIds: ['hcr-asset-ehr', 'hcr-asset-patient-db', 'hcr-asset-pharmacy', 'hcr-asset-backup'],
    diagramLinks: [{ diagramId: 'healthcare-ransomware', nodeIds: ['ehr-app-server', 'patient-db', 'domain-controller', 'backup-server'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Deploy EDR on all endpoints, implement network segmentation, air-gap backup infrastructure, and conduct regular ransomware tabletop exercises.',
    threatActorIds: ['hcr-actor-ransomware-gang'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hcr-risk-phi-breach', title: 'Protected Health Information Breach via SQL Injection',
    description: 'MOVEit Transfer SQL injection vulnerability allows direct access to patient database containing PHI for 500,000+ patients. Breach triggers HIPAA notification requirements and OCR investigation.',
    status: 'assessed' as const, owner: 'IT Security Manager',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Data Breach', tier3: 'PHI Exfiltration' },
    assetIds: ['hcr-asset-patient-db'],
    diagramLinks: [{ diagramId: 'healthcare-ransomware', nodeIds: ['moveit-server', 'patient-db'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Patch MOVEit Transfer to latest version, implement WAF rules for SQL injection, and restrict direct database access from DMZ.',
    threatActorIds: ['hcr-actor-ransomware-gang'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hcr-risk-medical-device-compromise', title: 'Medical Device Network Pivot',
    description: 'Connected medical devices with unpatched firmware exploited as pivot points into hospital network. Compromised devices provide persistent access bypassing traditional security controls.',
    status: 'assessed' as const, owner: 'Biomedical Engineering Manager',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Medical Device Security', tier3: 'Unpatched Medical Devices' },
    assetIds: ['hcr-asset-medical-devices', 'hcr-asset-ehr'],
    diagramLinks: [{ diagramId: 'healthcare-ransomware', nodeIds: ['medical-devices', 'ehr-app-server'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Implement micro-segmentation for medical device VLANs, deploy passive network monitoring, and establish vendor patch coordination process.',
    threatActorIds: ['hcr-actor-nation-state'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hcr-risk-rdp-initial-access', title: 'Exposed RDP Initial Access Vector',
    description: 'Patient portal RDP service exposed on port 3389 provides direct initial access for attackers. Brute-force or credential stuffing attacks lead to domain controller compromise via lateral movement.',
    status: 'assessed' as const, owner: 'IT Infrastructure Manager',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Identity & Access', tier3: 'Credential Harvesting' },
    assetIds: ['hcr-asset-domain-controller'],
    diagramLinks: [{ diagramId: 'healthcare-ransomware', nodeIds: ['patient-portal', 'domain-controller'] }],
    inherentScore: score('likelihood-5', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Disable public RDP immediately, implement VPN-only remote access, deploy MFA on all remote access points.',
    threatActorIds: ['hcr-actor-ransomware-gang'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hcr-risk-backup-destruction', title: 'Backup Infrastructure Destruction',
    description: 'Ransomware operators target ESXi hosts with default credentials and NAS storage with SMBv1 to destroy all backups before deploying encryptors, eliminating recovery options.',
    status: 'assessed' as const, owner: 'IT Infrastructure Manager',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Ransomware & Extortion', tier3: 'Backup Destruction' },
    assetIds: ['hcr-asset-backup'],
    diagramLinks: [{ diagramId: 'healthcare-ransomware', nodeIds: ['esxi-host', 'backup-server', 'nas-storage'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Implement immutable backup copies, change ESXi default credentials, disable SMBv1 on NAS, and air-gap critical backup repositories.',
    threatActorIds: ['hcr-actor-ransomware-gang'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hcr-risk-exchange-exploitation', title: 'Exchange Server ProxyShell Exploitation',
    description: 'Publicly exposed Exchange OWA and ECP on outdated CU11 vulnerable to ProxyShell chain. Successful exploitation provides SYSTEM-level access in DMZ with LDAP connectivity to domain controller.',
    status: 'assessed' as const, owner: 'IT Security Manager',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Ransomware & Extortion', tier3: 'Lateral Movement' },
    assetIds: ['hcr-asset-exchange', 'hcr-asset-domain-controller'],
    diagramLinks: [{ diagramId: 'healthcare-ransomware', nodeIds: ['exchange-server', 'domain-controller'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Apply latest Exchange CU and security updates, restrict ECP access to internal network, implement mail gateway filtering.',
    threatActorIds: ['hcr-actor-ransomware-gang'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hcr-risk-supply-chain-pharmacy', title: 'Pharmacy Supply Chain Compromise',
    description: 'Compromised pharmacy vendor software update mechanism delivers malicious payload to medication management system. Legacy authentication allows lateral movement to patient database.',
    status: 'draft' as const, owner: 'Pharmacy IT Lead',
    tierPath: { tier1: 'Operational Risk', tier2: 'Supply Chain' },
    assetIds: ['hcr-asset-pharmacy', 'hcr-asset-patient-db'],
    diagramLinks: [{ diagramId: 'healthcare-ransomware', nodeIds: ['pharmacy-system', 'patient-db'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Implement application allowlisting on pharmacy system, validate vendor update signatures, and segment pharmacy network from patient database.',
    threatActorIds: ['hcr-actor-nation-state'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hcr-risk-insider-phi-theft', title: 'Insider PHI Data Theft via Shared Workstations',
    description: 'Shared nurse station workstations with generic logins and auto-login enabled allow unauthorized access to EHR and pharmacy systems. Minimal audit trail due to shared accounts prevents attribution.',
    status: 'assessed' as const, owner: 'Compliance Officer',
    tierPath: { tier1: 'Compliance Risk', tier2: 'HIPAA Compliance' },
    assetIds: ['hcr-asset-ehr', 'hcr-asset-pharmacy'],
    diagramLinks: [{ diagramId: 'healthcare-ransomware', nodeIds: ['nurse-stations', 'ehr-app-server', 'pharmacy-system'] }],
    inherentScore: score('likelihood-4', 'impact-3'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Implement individual badge-tap authentication at workstations, deploy DLP on clinical endpoints, and enable comprehensive access logging.',
    threatActorIds: ['hcr-actor-insider'],
    createdAt: NOW, updatedAt: NOW
  },
];

const assessments: GrcAssessment[] = [
  {
    id: 'hcr-assessment-ransomware-readiness', title: 'Healthcare Ransomware Readiness Assessment',
    status: 'in_review' as const,
    owner: 'Chief Information Security Officer',
    reviewer: 'Board Risk Committee',
    startDate: '2025-05-01',
    dueDate: '2025-07-15',
    threatActorIds: ['hcr-actor-ransomware-gang', 'hcr-actor-nation-state', 'hcr-actor-insider'],
    methodologyNote: 'Assessment follows NIST CSF Healthcare Profile with HIPAA Security Rule mapping and MITRE ATT&CK for Healthcare.',
    assumptionNote: 'Assessment covers all three hospital facilities with centralized IT infrastructure. Medical device firmware patching excluded from immediate scope due to FDA regulatory constraints.',
    scopeItems: [
      { id: 'hcr-scope-system', type: 'system' as const, value: 'system', name: 'Hospital IT Infrastructure' },
      { id: 'hcr-scope-critical', type: 'diagram_segment' as const, value: 'Critical', name: 'Critical Medical Systems Zone' },
      { id: 'hcr-scope-internal', type: 'diagram_segment' as const, value: 'Internal', name: 'Internal Hospital Network' },
      { id: 'hcr-scope-dmz', type: 'diagram_segment' as const, value: 'DMZ', name: 'DMZ Public Services' },
    ],
    tierFilter: { tier1: 'Cyber Risk' },
    riskManagementPlan: {
      objective: 'Reduce hospital ransomware exposure from Critical to Moderate risk level within 90 days while maintaining 24/7 clinical operations.',
      strategy: 'Prioritize initial access vector closure (RDP, Exchange), then backup hardening, followed by network segmentation and detection improvements.',
      residualRiskStatement: 'Residual risk accepted for medical device patching delays pending FDA vendor coordination. Compensating controls via network micro-segmentation.',
      monitoringApproach: 'Daily EDR alert review, weekly vulnerability scan review, monthly tabletop exercises.',
      communicationPlan: 'Weekly status to CISO, bi-weekly board risk committee briefing, immediate escalation for active incidents.',
      reviewCadenceDays: 7,
      actions: [
        {
          id: 'hcr-rmp-disable-rdp',
          title: 'Disable public RDP on patient portal and implement VPN-only remote access',
          owner: 'IT Infrastructure',
          dueDate: '2025-05-15',
          status: 'done' as const,
          linkedRiskIds: ['hcr-risk-rdp-initial-access'],
          notes: 'RDP port closed on firewall; VPN migration completed for vendor access'
        },
        {
          id: 'hcr-rmp-patch-exchange',
          title: 'Apply Exchange Server security updates and restrict ECP access',
          owner: 'IT Infrastructure',
          dueDate: '2025-06-01',
          status: 'in_progress' as const,
          linkedRiskIds: ['hcr-risk-exchange-exploitation'],
          notes: 'CU12 staged in test; ECP IP restriction pending change window'
        },
        {
          id: 'hcr-rmp-backup-airgap',
          title: 'Implement immutable backup copies and change default credentials on ESXi and NAS',
          owner: 'IT Infrastructure',
          dueDate: '2025-06-15',
          status: 'in_progress' as const,
          linkedRiskIds: ['hcr-risk-backup-destruction'],
          notes: 'ESXi credentials rotated; immutable repository configuration in progress'
        },
        {
          id: 'hcr-rmp-network-segmentation',
          title: 'Implement micro-segmentation for medical device and critical system VLANs',
          owner: 'Network Engineering',
          dueDate: '2025-07-01',
          status: 'planned' as const,
          linkedRiskIds: ['hcr-risk-medical-device-compromise', 'hcr-risk-ransomware-encryption'],
          notes: 'VLAN design completed; awaiting maintenance window for implementation'
        },
      ],
      updatedAt: NOW
    },
    riskIds: risks.map(r => r.id),
    soaGapIds: ['hcr-soa-a01', 'hcr-soa-a05', 'hcr-soa-a06', 'hcr-soa-a07'],
    taskIds: ['hcr-task-rdp-closure', 'hcr-task-exchange-patching', 'hcr-task-backup-hardening', 'hcr-task-edr-deployment', 'hcr-task-network-segmentation'],
    linkedImplementedControlIds: [],
    linkedInitiativeIds: [],
    summary: 'Ransomware readiness assessment of hospital IT infrastructure identifying 8 risks across initial access vectors, lateral movement paths, backup destruction, and compliance gaps. 3 rated Critical, 3 High, 2 Medium.',
    findings: 'Key findings include exposed RDP on patient portal, unpatched Exchange with public ECP, ESXi and NAS with default credentials, medical devices on flat network, shared nurse workstation accounts, and MOVEit SQL injection exposure.',
    recommendations: 'Immediately close RDP and ECP public access, patch Exchange and MOVEit, implement air-gapped backups, deploy EDR across all endpoints, and segment medical device networks.',
    evidenceSummary: 'Evidence includes Nessus vulnerability scan reports, firewall rule exports, Active Directory privilege audit, backup configuration review, and medical device inventory assessment.',
    threatModel: {
      nodes: [
        { id: 'hcr-tm-portal', label: 'Patient Portal', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'patient-portal', position: { x: 50, y: 150 }, nodeType: 'webServer', commentary: 'RDP exposed on port 3389 for vendor support' },
        { id: 'hcr-tm-exchange', label: 'Exchange Server', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'exchange-server', position: { x: 50, y: 300 }, nodeType: 'application', commentary: 'Exchange 2019 CU11 with public OWA and ECP' },
        { id: 'hcr-tm-dc', label: 'Domain Controller', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'domain-controller', position: { x: 300, y: 150 }, nodeType: 'identityProvider', commentary: 'Windows Server 2016 with PrintNightmare pending' },
        { id: 'hcr-tm-ehr', label: 'EHR Application', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'ehr-app-server', position: { x: 300, y: 300 }, nodeType: 'application', commentary: 'Service account with Domain Admin privileges' },
        { id: 'hcr-tm-patient-db', label: 'Patient Database', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'patient-db', position: { x: 550, y: 150 }, nodeType: 'database', commentary: 'SQL Server 2017 with SA account enabled' },
        { id: 'hcr-tm-esxi', label: 'VMware ESXi', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'esxi-host', position: { x: 550, y: 300 }, nodeType: 'server', commentary: 'Default credentials, SSH enabled' },
        { id: 'hcr-tm-devices', label: 'Medical Devices', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'medical-devices', position: { x: 300, y: 450 }, nodeType: 'sensor', commentary: 'Unpatched firmware, minimal auth on HL7/DICOM' },
      ],
      edges: [
        { id: 'hcr-tm-edge-portal-dc', source: 'hcr-tm-portal', target: 'hcr-tm-dc', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'portal-rdp-lateral', label: 'RDP Lateral Movement', commentary: 'Exposed RDP provides direct path to domain controller' },
        { id: 'hcr-tm-edge-exchange-dc', source: 'hcr-tm-exchange', target: 'hcr-tm-dc', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'exchange-to-dc', label: 'LDAP Auth (unencrypted)', commentary: 'ProxyShell to SYSTEM then LDAP credential extraction' },
        { id: 'hcr-tm-edge-dc-esxi', source: 'hcr-tm-dc', target: 'hcr-tm-esxi', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'dc-to-esxi', label: 'Admin SSH Access', commentary: 'Domain admin to ESXi for VM encryption' },
        { id: 'hcr-tm-edge-ehr-db', source: 'hcr-tm-ehr', target: 'hcr-tm-patient-db', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'ehr-to-db', label: 'Database Access (unencrypted)', commentary: 'Domain Admin service account provides unrestricted DB access' },
        { id: 'hcr-tm-edge-devices-ehr', source: 'hcr-tm-devices', target: 'hcr-tm-ehr', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'devices-to-ehr', label: 'HL7 Device Data', commentary: 'Unencrypted HL7 from flat medical device network' },
      ],
      attackPathDescription: 'Four primary attack chains: (1) RDP brute-force to domain controller to enterprise-wide ransomware deployment; (2) Medical device exploitation to EHR pivot to patient data exfiltration; (3) Exchange ProxyShell to LDAP credential theft to backup destruction; (4) Insider access via shared workstations to PHI theft.',
      attackPaths: [
        {
          id: 'hcr-aap-rdp-ransomware',
          name: 'RDP Initial Access → Domain Compromise → Ransomware Deployment',
          strideCategory: 'Denial of Service' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'Attacker brute-forces exposed RDP on patient portal, laterally moves to domain controller, escalates to Domain Admin, then deploys ransomware encryptors across all hospital systems via Group Policy.',
          diagramAttackPathId: 'hcr-ap-phishing-ransomware',
          steps: [
            { order: 1, edgeId: 'portal-rdp-lateral', sourceNodeId: 'patient-portal', targetNodeId: 'domain-controller', technique: 'T1021.001: Remote Desktop Protocol' },
            { order: 2, edgeId: 'dc-to-esxi', sourceNodeId: 'domain-controller', targetNodeId: 'esxi-host', technique: 'T1486: Data Encrypted for Impact' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
        {
          id: 'hcr-aap-device-exfil',
          name: 'Medical Device Exploitation → EHR Pivot → Data Exfiltration',
          strideCategory: 'Information Disclosure' as StrideCategory,
          riskLevel: 'High' as AttackPathRiskLevel,
          description: 'Attacker compromises unpatched medical device, pivots to EHR application via HL7 protocol, then accesses patient database using the Domain Admin service account.',
          diagramAttackPathId: 'hcr-ap-device-exfil',
          steps: [
            { order: 1, edgeId: 'devices-to-ehr', sourceNodeId: 'medical-devices', targetNodeId: 'ehr-app-server', technique: 'T1210: Exploitation of Remote Services' },
            { order: 2, edgeId: 'ehr-to-db', sourceNodeId: 'ehr-app-server', targetNodeId: 'patient-db', technique: 'T1078: Valid Accounts' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
        {
          id: 'hcr-aap-exchange-backup',
          name: 'Exchange ProxyShell → Domain Compromise → Backup Destruction',
          strideCategory: 'Tampering' as StrideCategory,
          riskLevel: 'High' as AttackPathRiskLevel,
          description: 'Attacker exploits Exchange ProxyShell chain to gain SYSTEM access in DMZ, extracts LDAP credentials to compromise domain controller, then destroys backup infrastructure via ESXi SSH access.',
          diagramAttackPathId: 'hcr-ap-supply-chain-pharmacy',
          steps: [
            { order: 1, edgeId: 'exchange-to-dc', sourceNodeId: 'exchange-server', targetNodeId: 'domain-controller', technique: 'T1190: Exploit Public-Facing Application' },
            { order: 2, edgeId: 'dc-to-esxi', sourceNodeId: 'domain-controller', targetNodeId: 'esxi-host', technique: 'T1490: Inhibit System Recovery' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
      ],
      updatedAt: NOW,
    },
    createdAt: NOW, updatedAt: NOW
  },
];

const soaEntries: GrcSoaEntry[] = [
  {
    id: 'hcr-soa-a01', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A01', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'EHR service account runs with Domain Admin privileges. Nurse workstations use generic shared accounts. ESXi and NAS retain default admin credentials.',
    mitigatesRiskIds: ['hcr-risk-ransomware-encryption', 'hcr-risk-insider-phi-theft', 'hcr-risk-backup-destruction'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'hcr-soa-a02', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A02', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'SQL Server SA account enabled on patient database. LDAP authentication between Exchange and DC is unencrypted. HL7 and DICOM protocols lack encryption.',
    mitigatesRiskIds: ['hcr-risk-phi-breach', 'hcr-risk-exchange-exploitation'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'hcr-soa-a03', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A03', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'MOVEit Transfer version 2020.1.8 has known SQL injection vulnerability. Direct SQL access from pharmacy system to patient database without parameterized queries.',
    mitigatesRiskIds: ['hcr-risk-phi-breach'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'hcr-soa-a05', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A05', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'RDP exposed on patient portal for vendor support. Exchange ECP publicly accessible. ESXi SSH enabled with default credentials. SMBv1 on NAS for legacy compatibility.',
    mitigatesRiskIds: ['hcr-risk-rdp-initial-access', 'hcr-risk-exchange-exploitation', 'hcr-risk-backup-destruction'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'hcr-soa-a06', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A06', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'FortiGate firmware 6.0.9 multiple versions behind. Citrix NetScaler unpatched since deployment. Exchange 2019 CU11 missing critical security updates. Log4j 2.14.1 in telehealth backend.',
    mitigatesRiskIds: ['hcr-risk-exchange-exploitation', 'hcr-risk-medical-device-compromise'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'hcr-soa-a07', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A07', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Shared generic accounts on nurse workstations with auto-login. Basic auth on PACS imaging. No MFA on VPN or Exchange OWA. DICOM minimal authentication.',
    mitigatesRiskIds: ['hcr-risk-insider-phi-theft', 'hcr-risk-rdp-initial-access'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'hcr-soa-a09', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A09', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'planned' as const,
    justification: 'Limited centralized logging. No SIEM deployment. Antivirus on nurse stations only security monitoring. No EDR across clinical systems.',
    mitigatesRiskIds: ['hcr-risk-ransomware-encryption'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'hcr-soa-cis01', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.01', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Medical device inventory incomplete. Various vendors and firmware versions tracked manually. No automated asset discovery for IoT devices.',
    mitigatesRiskIds: ['hcr-risk-medical-device-compromise'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'hcr-soa-cis03', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.03', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Patient database encryption at rest only (TDE). No encryption in transit for HL7, DICOM, or internal SQL connections. NAS backup data unencrypted.',
    mitigatesRiskIds: ['hcr-risk-phi-breach', 'hcr-risk-backup-destruction'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'hcr-soa-cis04', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.04', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Windows Server 2016 DC with pending patches. ESXi 6.7 default configuration. QNAP NAS default admin credentials. No hardening baselines applied to clinical systems.',
    mitigatesRiskIds: ['hcr-risk-rdp-initial-access', 'hcr-risk-backup-destruction'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
];

const workflowTasks: GrcTask[] = [
  {
    id: 'hcr-task-rdp-closure',
    title: 'Close public RDP access on patient portal',
    description: 'Disable RDP on port 3389, migrate vendor access to VPN with MFA, and implement network-level authentication.',
    type: 'risk_treatment' as const,
    status: 'done' as const,
    priority: 'critical' as const,
    owner: 'IT Infrastructure',
    dueDate: '2025-05-15',
    riskId: 'hcr-risk-rdp-initial-access',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hcr-task-exchange-patching',
    title: 'Apply Exchange CU12 and restrict ECP to internal access',
    description: 'Stage and deploy Exchange Server 2019 CU12 with latest security updates. Restrict ECP to internal IP ranges only.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'critical' as const,
    owner: 'IT Infrastructure',
    dueDate: '2025-06-01',
    riskId: 'hcr-risk-exchange-exploitation',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hcr-task-backup-hardening',
    title: 'Harden backup infrastructure and implement immutable copies',
    description: 'Change ESXi and NAS default credentials, disable SMBv1, configure immutable backup repository, and test restore procedures.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'critical' as const,
    owner: 'IT Infrastructure',
    dueDate: '2025-06-15',
    riskId: 'hcr-risk-backup-destruction',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hcr-task-edr-deployment',
    title: 'Deploy EDR solution across all endpoints and servers',
    description: 'Procure and deploy endpoint detection and response solution on all Windows endpoints, servers, and clinical workstations.',
    type: 'control_implementation' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'IT Security',
    dueDate: '2025-07-01',
    riskId: 'hcr-risk-ransomware-encryption',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hcr-task-network-segmentation',
    title: 'Implement micro-segmentation for medical devices and critical systems',
    description: 'Design and deploy VLAN segmentation for medical device network, restrict HL7/DICOM traffic to authorized endpoints.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Network Engineering',
    dueDate: '2025-07-15',
    riskId: 'hcr-risk-medical-device-compromise',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hcr-task-moveit-patching',
    title: 'Patch MOVEit Transfer and restrict database access',
    description: 'Update MOVEit Transfer to latest version, implement parameterized database queries, and add WAF SQL injection rules.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'IT Infrastructure',
    dueDate: '2025-06-30',
    riskId: 'hcr-risk-phi-breach',
    createdAt: NOW, updatedAt: NOW
  },
];

const governanceDocuments: GrcGovernanceDocument[] = [
  {
    id: 'hcr-gov-hipaa-policy', title: 'HIPAA Security Policy',
    type: 'policy' as const,
    description: 'Organizational policy for HIPAA Security Rule compliance covering administrative, physical, and technical safeguards for electronic PHI.',
    owner: 'Compliance Officer',
    reviewDate: '2025-01-15',
    nextReviewDate: '2026-01-15',
    status: 'active' as const,
    version: '3.2',
    tags: ['hipaa', 'compliance', 'phi'],
    linkedRiskIds: ['hcr-risk-phi-breach', 'hcr-risk-insider-phi-theft'],
    linkedControlSetIds: [OWASP_CONTROL_SET_ID],
    linkedAssessmentIds: ['hcr-assessment-ransomware-readiness'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hcr-gov-incident-response', title: 'Ransomware Incident Response Plan',
    type: 'procedure' as const,
    description: 'Detailed procedure for responding to ransomware incidents including containment, eradication, recovery, and HIPAA breach notification requirements.',
    owner: 'CISO',
    reviewDate: '2025-03-01',
    nextReviewDate: '2025-09-01',
    status: 'under_review' as const,
    version: '2.1',
    tags: ['ransomware', 'incident-response', 'breach-notification'],
    linkedRiskIds: ['hcr-risk-ransomware-encryption', 'hcr-risk-backup-destruction'],
    linkedControlSetIds: [],
    linkedAssessmentIds: ['hcr-assessment-ransomware-readiness'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hcr-gov-medical-device-security', title: 'Medical Device Security Standard',
    type: 'standard' as const,
    description: 'Security requirements for connected medical devices including network segmentation, patch management coordination with vendors, and FDA regulatory compliance.',
    owner: 'Biomedical Engineering Manager',
    reviewDate: '2025-02-01',
    nextReviewDate: '2025-08-01',
    status: 'active' as const,
    version: '1.3',
    tags: ['medical-devices', 'iot', 'fda', 'segmentation'],
    linkedRiskIds: ['hcr-risk-medical-device-compromise'],
    linkedControlSetIds: [CIS_CONTROL_SET_ID],
    linkedAssessmentIds: ['hcr-assessment-ransomware-readiness'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hcr-gov-backup-recovery', title: 'Backup and Disaster Recovery Procedure',
    type: 'procedure' as const,
    description: 'Procedures for backup operations, integrity verification, restore testing, and disaster recovery activation for hospital IT systems.',
    owner: 'IT Infrastructure Manager',
    reviewDate: '2024-11-01',
    nextReviewDate: '2025-05-01',
    status: 'active' as const,
    version: '2.0',
    tags: ['backup', 'disaster-recovery', 'business-continuity'],
    linkedRiskIds: ['hcr-risk-backup-destruction', 'hcr-risk-ransomware-encryption'],
    linkedControlSetIds: [],
    linkedAssessmentIds: ['hcr-assessment-ransomware-readiness'],
    createdAt: NOW, updatedAt: NOW
  },
];

const threatActors: GrcThreatActor[] = [
  {
    id: 'hcr-actor-ransomware-gang', name: 'Healthcare-Targeting Ransomware Group',
    type: 'organised_crime' as const, capabilityLevel: 4,
    resourceLevel: 'high' as const,
    motivation: 'Financial gain through double extortion: encrypting hospital systems to disrupt patient care while threatening to leak PHI data. Healthcare targets chosen for urgency to pay.',
    description: 'Sophisticated ransomware-as-a-service affiliate specifically targeting healthcare organizations. Uses initial access brokers for RDP and Exchange exploitation, deploys custom ransomware targeting ESXi hypervisors and backup systems.',
    targetedAssetIds: ['hcr-asset-ehr', 'hcr-asset-patient-db', 'hcr-asset-backup', 'hcr-asset-domain-controller'],
    tags: ['ransomware', 'double-extortion', 'healthcare-targeted', 'raas'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hcr-actor-nation-state', name: 'Nation-State Healthcare APT',
    type: 'nation_state' as const, capabilityLevel: 5,
    resourceLevel: 'very_high' as const,
    motivation: 'Espionage and intellectual property theft targeting pharmaceutical research, clinical trial data, and patient population health data for strategic intelligence.',
    description: 'Advanced persistent threat group with demonstrated interest in healthcare sector. Exploits medical device vulnerabilities and supply chain relationships for long-term persistent access.',
    targetedAssetIds: ['hcr-asset-medical-devices', 'hcr-asset-pharmacy', 'hcr-asset-lab-systems', 'hcr-asset-patient-db'],
    tags: ['apt', 'espionage', 'healthcare', 'supply-chain'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hcr-actor-insider', name: 'Disgruntled Healthcare Worker',
    type: 'insider' as const, capabilityLevel: 2,
    resourceLevel: 'low' as const,
    motivation: 'Financial gain through selling patient records on dark web, or personal grievance leading to unauthorized access to celebrity or acquaintance medical records.',
    description: 'Healthcare employee with legitimate access to clinical workstations exploiting shared accounts and weak access controls to access and exfiltrate patient health information.',
    targetedAssetIds: ['hcr-asset-ehr', 'hcr-asset-pharmacy'],
    tags: ['insider-threat', 'phi-theft', 'hipaa-violation'],
    createdAt: NOW, updatedAt: NOW
  },
];

const threatScenarios: GrcThreatScenario[] = [
  {
    id: 'hcr-scenario-ransomware-deployment', title: 'Enterprise Ransomware via Exposed RDP and Domain Compromise',
    description: 'Ransomware affiliate purchases RDP access from initial access broker, brute-forces patient portal RDP, laterally moves to domain controller via exposed RDP path, escalates to Domain Admin, destroys backups via ESXi SSH, then deploys ransomware across all hospital systems via Group Policy.',
    threatActorId: 'hcr-actor-ransomware-gang',
    targetedAssetIds: ['hcr-asset-domain-controller', 'hcr-asset-ehr', 'hcr-asset-patient-db', 'hcr-asset-backup'],
    attackTechniques: ['T1021.001 - Remote Desktop Protocol', 'T1078 - Valid Accounts', 'T1486 - Data Encrypted for Impact', 'T1490 - Inhibit System Recovery'],
    linkedRiskIds: ['hcr-risk-rdp-initial-access', 'hcr-risk-ransomware-encryption', 'hcr-risk-backup-destruction'],
    likelihood: 'Very High - exposed RDP is actively scanned by initial access brokers and ransomware affiliates.',
    impact: 'Critical - complete hospital operational shutdown affecting patient care across all 3 facilities.',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hcr-scenario-moveit-phi-breach', title: 'MOVEit SQL Injection to Mass PHI Exfiltration',
    description: 'Attacker exploits known MOVEit Transfer SQL injection vulnerability to gain direct SQL access to patient database. Extracts PHI for 500,000+ patients including SSNs, medical records, and insurance information. Data posted to leak site with extortion demand.',
    threatActorId: 'hcr-actor-ransomware-gang',
    targetedAssetIds: ['hcr-asset-patient-db'],
    attackTechniques: ['T1190 - Exploit Public-Facing Application', 'T1505.003 - Web Shell', 'T1041 - Exfiltration Over C2 Channel'],
    linkedRiskIds: ['hcr-risk-phi-breach'],
    likelihood: 'High - MOVEit CVE-2023-34362 actively exploited in the wild with public PoC available.',
    impact: 'Critical - HIPAA breach notification for 500k+ patients, OCR investigation, potential $1.5M+ fine.',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hcr-scenario-medical-device-pivot', title: 'Medical Device Compromise to Clinical Data Theft',
    description: 'Nation-state APT exploits unpatched medical device firmware, establishes persistent backdoor on flat hospital network, pivots to EHR application via HL7 protocol, then exfiltrates clinical trial and patient population data over extended period.',
    threatActorId: 'hcr-actor-nation-state',
    targetedAssetIds: ['hcr-asset-medical-devices', 'hcr-asset-ehr', 'hcr-asset-patient-db'],
    attackTechniques: ['T1210 - Exploitation of Remote Services', 'T1071 - Application Layer Protocol', 'T1005 - Data from Local System'],
    linkedRiskIds: ['hcr-risk-medical-device-compromise'],
    likelihood: 'Moderate - requires specialized medical device exploitation capability but flat network simplifies lateral movement.',
    impact: 'Major - long-term persistent access to clinical data with national security implications.',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hcr-scenario-insider-phi-access', title: 'Insider PHI Theft via Shared Workstation Accounts',
    description: 'Disgruntled nurse uses shared generic workstation account to access EHR and pharmacy systems, exfiltrates targeted patient records for celebrity patients and former acquaintances. Shared accounts prevent accurate attribution of access.',
    threatActorId: 'hcr-actor-insider',
    targetedAssetIds: ['hcr-asset-ehr', 'hcr-asset-pharmacy'],
    attackTechniques: ['T1078.001 - Default Accounts', 'T1530 - Data from Cloud Storage', 'T1567 - Exfiltration Over Web Service'],
    linkedRiskIds: ['hcr-risk-insider-phi-theft'],
    likelihood: 'High - shared accounts actively in use with auto-login enabled, minimal detective controls.',
    impact: 'Moderate - targeted PHI breach with HIPAA violation but limited in scope to individual records.',
    createdAt: NOW, updatedAt: NOW
  },
];

export const healthcareRansomwareGrcWorkspace = buildGrcWorkspace({
  tierCatalogue,
  assets,
  risks,
  assessments,
  soaEntries,
  workflowTasks,
  governanceDocuments,
  threatActors,
  threatScenarios,
  securityInitiatives: [
    {
      id: 'hcr-si-ransomware-resilience', title: 'Ransomware Resilience and Recovery Program',
      description: 'Comprehensive program to harden infrastructure against ransomware through RDP closure, network segmentation, air-gapped backups, and EDR deployment.',
      category: 'remediation' as const, status: 'in_progress' as const, priority: 'critical' as const,
      owner: 'IT Infrastructure', executiveSponsor: 'CIO',
      currentState: 'Exposed RDP on patient portal; flat network between clinical and IoT segments; backup server accessible from domain; no EDR on clinical workstations.',
      targetState: 'All RDP access removed or behind VPN; network microsegmentation isolating medical devices; air-gapped immutable backups; EDR on 100% of endpoints.',
      startDate: '2025-01-01T00:00:00.000Z', targetDate: '2025-12-31T00:00:00.000Z', completedDate: '',
      milestones: [
        { id: 'hcr-ms-rdp-closure', title: 'External RDP Service Closure', description: 'Disable all externally exposed RDP services and migrate remote access to Citrix Gateway with MFA.', status: 'completed' as const, dueDate: '2025-03-01T00:00:00.000Z', completedDate: '2025-02-25T00:00:00.000Z', owner: 'IT Infrastructure' },
        { id: 'hcr-ms-backup-airgap', title: 'Air-Gapped Backup Implementation', description: 'Deploy immutable backup copies to off-network storage with separate authentication credentials.', status: 'in_progress' as const, dueDate: '2025-07-01T00:00:00.000Z', completedDate: '', owner: 'IT Infrastructure' },
        { id: 'hcr-ms-network-segmentation', title: 'Clinical Network Microsegmentation', description: 'Deploy VLAN segmentation isolating medical devices, nurse stations, and clinical servers into separate security zones.', status: 'pending' as const, dueDate: '2025-11-01T00:00:00.000Z', completedDate: '', owner: 'IT Infrastructure' },
      ],
      linkedRiskIds: ['hcr-risk-ransomware-encryption', 'hcr-risk-rdp-initial-access', 'hcr-risk-backup-destruction'],
      linkedControlSetIds: [],
      linkedAssetIds: ['hcr-asset-backup', 'hcr-asset-domain-controller', 'hcr-asset-ehr'],
      linkedImplementedControlIds: ['hcr-ic-edr-deployment', 'hcr-ic-immutable-backups'],
      linkedAssessmentIds: ['hcr-assessment-ransomware-readiness'],
      notes: 'Board-mandated after peer hospital ransomware incident. Insurance carrier requiring completion by renewal date.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'hcr-si-hipaa-compliance', title: 'HIPAA Security Rule Compliance Remediation',
      description: 'Address HIPAA Security Rule deficiencies identified in ransomware readiness assessment, focusing on access controls, audit logging, and PHI encryption.',
      category: 'compliance' as const, status: 'approved' as const, priority: 'high' as const,
      owner: 'Clinical IT', executiveSponsor: 'Chief Compliance Officer',
      currentState: 'Shared workstation accounts on nurse stations; MOVEit file transfer without encryption validation; Exchange server unpatched with ProxyShell exposure.',
      targetState: 'Individual badge-tap authentication on all workstations; encrypted file transfers with DLP inspection; Exchange fully patched or migrated to cloud.',
      startDate: '2025-04-01T00:00:00.000Z', targetDate: '2026-03-31T00:00:00.000Z', completedDate: '',
      milestones: [
        { id: 'hcr-ms-workstation-auth', title: 'Workstation Individual Authentication', description: 'Deploy proximity badge authentication on all nurse station and shared clinical workstations.', status: 'pending' as const, dueDate: '2025-10-01T00:00:00.000Z', completedDate: '', owner: 'Clinical IT' },
        { id: 'hcr-ms-exchange-remediation', title: 'Exchange Server Patching or Migration', description: 'Apply all critical patches to Exchange server or migrate to Exchange Online with Defender for Office 365.', status: 'in_progress' as const, dueDate: '2025-08-01T00:00:00.000Z', completedDate: '', owner: 'IT Infrastructure' },
      ],
      linkedRiskIds: ['hcr-risk-insider-phi-theft', 'hcr-risk-exchange-exploitation', 'hcr-risk-phi-breach'],
      linkedControlSetIds: [],
      linkedAssetIds: ['hcr-asset-exchange', 'hcr-asset-patient-db', 'hcr-asset-pharmacy'],
      linkedImplementedControlIds: ['hcr-ic-phi-encryption'],
      linkedAssessmentIds: ['hcr-assessment-ransomware-readiness'],
      notes: 'OCR audit anticipated in Q4. Compliance team coordinating with legal for breach notification readiness.',
      createdAt: NOW, updatedAt: NOW,
    },
  ],
  implementedControls: [
    {
      id: 'hcr-ic-edr-deployment', title: 'CrowdStrike Falcon EDR',
      description: 'CrowdStrike Falcon endpoint detection and response agent deployed on clinical servers, workstations, and domain controllers with ransomware prevention policies.',
      controlType: 'technical' as const, category: 'endpoint_protection' as const,
      status: 'active' as const, automationLevel: 'fully_automated' as const,
      owner: 'Security Operations', vendor: 'CrowdStrike', product: 'Falcon Prevent', version: '7.10',
      implementedDate: '2025-02-15T00:00:00.000Z', lastReviewDate: NOW, nextReviewDate: '2025-12-01T00:00:00.000Z',
      linkedSoaEntryIds: ['hcr-soa-a05', 'hcr-soa-a06'],
      linkedRiskIds: ['hcr-risk-ransomware-encryption', 'hcr-risk-rdp-initial-access'],
      linkedAssetIds: ['hcr-asset-ehr', 'hcr-asset-domain-controller', 'hcr-asset-backup'],
      linkedAssessmentIds: ['hcr-assessment-ransomware-readiness'],
      notes: 'Medical IoT devices excluded due to FDA-approved software restrictions. Compensating network controls required.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'hcr-ic-immutable-backups', title: 'Immutable Backup Storage',
      description: 'Veeam immutable backup repository with air-gapped copies and separate authentication domain to prevent ransomware-driven backup destruction.',
      controlType: 'technical' as const, category: 'backup_recovery' as const,
      status: 'planned' as const, automationLevel: 'semi_automated' as const,
      owner: 'IT Infrastructure', vendor: 'Veeam', product: 'Backup & Replication', version: '12.1',
      implementedDate: '', lastReviewDate: NOW, nextReviewDate: '2025-09-01T00:00:00.000Z',
      linkedSoaEntryIds: ['hcr-soa-cis03', 'hcr-soa-a09'],
      linkedRiskIds: ['hcr-risk-backup-destruction', 'hcr-risk-ransomware-encryption'],
      linkedAssetIds: ['hcr-asset-backup'],
      linkedAssessmentIds: ['hcr-assessment-ransomware-readiness'],
      notes: 'Current backup server uses domain-joined credentials accessible to ransomware. Air-gap implementation in progress.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'hcr-ic-phi-encryption', title: 'PHI Data-at-Rest Encryption',
      description: 'Transparent Data Encryption (TDE) enabled on patient database and PACS storage with centralized key management via domain-separated key vault.',
      controlType: 'technical' as const, category: 'encryption' as const,
      status: 'active' as const, automationLevel: 'fully_automated' as const,
      owner: 'Database Administration', vendor: 'Microsoft', product: 'SQL Server TDE', version: '2022',
      implementedDate: '2024-08-01T00:00:00.000Z', lastReviewDate: NOW, nextReviewDate: '2025-08-01T00:00:00.000Z',
      linkedSoaEntryIds: ['hcr-soa-a02', 'hcr-soa-cis04'],
      linkedRiskIds: ['hcr-risk-phi-breach', 'hcr-risk-insider-phi-theft'],
      linkedAssetIds: ['hcr-asset-patient-db', 'hcr-asset-ehr'],
      linkedAssessmentIds: ['hcr-assessment-ransomware-readiness'],
      notes: 'HIPAA Security Rule technical safeguard. Key rotation schedule set to annual. Lab systems pending TDE enablement.',
      createdAt: NOW, updatedAt: NOW,
    },
  ],
  thirdParties: [
    {
      id: 'hcr-tp-epic', name: 'Epic Systems', description: 'Electronic health record software vendor providing the core clinical application suite.',
      category: 'supplier' as const, status: 'active' as const, riskRating: 'critical' as const, dataClassification: 'restricted' as const,
      linkedAssetIds: ['hcr-asset-ehr', 'hcr-asset-patient-db'], linkedRiskIds: ['hcr-risk-phi-breach', 'hcr-risk-ransomware-encryption'],
      contactName: 'Dr. Karen Walsh', contactEmail: 'karen.walsh@epic.com',
      contractExpiry: '2029-12-31T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-06-01T00:00:00.000Z',
      notes: 'EHR service account running with Domain Admin requires remediation. Annual HITRUST assessment on file.',
    },
    {
      id: 'hcr-tp-philips', name: 'Philips Healthcare', description: 'Medical device manufacturer providing imaging systems and connected diagnostic equipment.',
      category: 'supplier' as const, status: 'active' as const, riskRating: 'high' as const, dataClassification: 'confidential' as const,
      linkedAssetIds: ['hcr-asset-medical-devices'], linkedRiskIds: ['hcr-risk-medical-device-compromise'],
      contactName: 'Robert Janssen', contactEmail: 'robert.janssen@philips.com',
      contractExpiry: '2027-09-30T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-07-15T00:00:00.000Z',
      notes: 'FDA-regulated devices cannot be patched without vendor approval. DICOM protocol lacks authentication. Patch cycle is 6-12 months.',
    },
    {
      id: 'hcr-tp-mckesson', name: 'McKesson', description: 'Pharmacy supply chain and medication management system provider.',
      category: 'partner' as const, status: 'active' as const, riskRating: 'high' as const, dataClassification: 'confidential' as const,
      linkedAssetIds: ['hcr-asset-pharmacy'], linkedRiskIds: ['hcr-risk-supply-chain-pharmacy'],
      contactName: 'Angela Thompson', contactEmail: 'angela.thompson@mckesson.com',
      contractExpiry: '2027-06-30T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-08-01T00:00:00.000Z',
      notes: 'Supply chain integration uses legacy protocols. Investigating encrypted channel upgrade for medication ordering.',
    },
    {
      id: 'hcr-tp-crowdstrike', name: 'CrowdStrike', description: 'Managed endpoint detection and response service protecting servers and workstations.',
      category: 'managed_service' as const, status: 'active' as const, riskRating: 'medium' as const, dataClassification: 'internal' as const,
      linkedAssetIds: ['hcr-asset-domain-controller', 'hcr-asset-exchange'], linkedRiskIds: ['hcr-risk-rdp-initial-access', 'hcr-risk-exchange-exploitation'],
      contactName: 'Mike Patterson', contactEmail: 'mike.patterson@crowdstrike.com',
      contractExpiry: '2027-03-31T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-09-15T00:00:00.000Z',
      notes: 'EDR agent not deployed on medical devices or legacy SCADA systems. Coverage gap on nurse station shared workstations.',
    },
    {
      id: 'hcr-tp-ironmountain', name: 'Iron Mountain', description: 'Backup and disaster recovery service managing offsite data protection and tape storage.',
      category: 'managed_service' as const, status: 'active' as const, riskRating: 'high' as const, dataClassification: 'confidential' as const,
      linkedAssetIds: ['hcr-asset-backup'], linkedRiskIds: ['hcr-risk-backup-destruction', 'hcr-risk-ransomware-encryption'],
      contactName: 'Patricia Lewis', contactEmail: 'patricia.lewis@ironmountain.com',
      contractExpiry: '2026-12-31T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-06-15T00:00:00.000Z',
      notes: 'Backup service account has full vSphere access. Air-gapped backup copy not yet implemented. NAS uses default credentials.',
    },
  ],
});

export const healthcareRansomware: ExampleSystem = {
  id: 'healthcare-ransomware',
  name: 'Healthcare System - Ransomware Groups',
  description: 'Hospital IT infrastructure with multiple internet-facing services and virtualization',
  category: 'Enterprise Systems',
  primaryZone: 'Internal',
  dataClassification: 'Confidential',
  nodes,
  edges,
  customContext: `### System Overview
  Regional hospital network supporting 500 beds across 3 facilities with centralized IT infrastructure.
  
  ### Technical Architecture
  - **Patient Access**: Public portal and telehealth platform for remote consultations
  - **Clinical Systems**: Epic EHR integrated with PACS imaging and pharmacy systems
  - **Remote Access**: Fortinet VPN and Citrix for staff working from home
  - **Virtualization**: VMware vSphere cluster hosting critical applications
  - **Backup**: Veeam backing up to local NAS storage
  
  ### Key Details
  - Patient portal has RDP exposed on standard port 3389 for vendor support
  - Exchange server in DMZ for email, OWA and ECP publicly accessible
  - MOVEit Transfer handles lab results with direct SQL database access
  - Telehealth platform uses older Log4j version in authentication service
  - FortiGate firmware is several versions behind current release
  - Citrix NetScaler ADC hasn't been patched since initial deployment
  
  ### Operational Challenges
  - Medical devices cannot be patched without vendor approval (FDA regulations)
  - 24/7 operations make patching windows extremely limited
  - Shared nurse station workstations use generic accounts for quick access
  - Legacy clinical applications require older protocols (SMBv1, TLS 1.0)
  - DICOM medical imaging protocol has minimal authentication
  
  ### Infrastructure Details
  - ESXi hosts managed through vCenter with default credentials
  - Backup service account has full access to vSphere infrastructure
  - QNAP NAS uses default admin credentials and SMBv1 for compatibility
  - Domain controller still on Windows Server 2016 with pending patches
  - EHR service account runs with Domain Admin for "integration requirements"
  
  ### Recent Issues
  - Increased remote access usage since COVID-19 pandemic
  - Budget constraints delayed security tool renewals
  - IT staff reduced by 30% in recent cost-cutting measures
  - Ransomware tabletop exercise scheduled but postponed twice`,
  grcWorkspace: healthcareRansomwareGrcWorkspace,
  attackPaths: [
    {
      id: 'hcr-ap-phishing-ransomware',
      name: 'RDP Brute-Force → Domain Compromise → Ransomware Deployment',
      strideCategory: 'Denial of Service' as StrideCategory,
      riskLevel: 'Critical' as AttackPathRiskLevel,
      description: 'Attacker brute-forces the exposed RDP service on the patient portal, laterally moves to the domain controller via the RDP lateral path, escalates to Domain Admin, then uses SSH admin access to destroy ESXi-hosted backups before deploying enterprise-wide ransomware via Group Policy.',
      steps: [
        { order: 1, edgeId: 'portal-rdp-lateral', sourceNodeId: 'patient-portal', targetNodeId: 'domain-controller', technique: 'T1021.001: Remote Desktop Protocol' },
        { order: 2, edgeId: 'dc-to-esxi', sourceNodeId: 'domain-controller', targetNodeId: 'esxi-host', technique: 'T1490: Inhibit System Recovery' },
        { order: 3, edgeId: 'backup-to-nas', sourceNodeId: 'backup-server', targetNodeId: 'nas-storage', technique: 'T1486: Data Encrypted for Impact' },
      ],
      mitreTechniques: ['T1021.001', 'T1490', 'T1486'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'hcr-ap-device-exfil',
      name: 'Medical Device Exploitation → EHR Pivot → Data Exfiltration',
      strideCategory: 'Information Disclosure' as StrideCategory,
      riskLevel: 'High' as AttackPathRiskLevel,
      description: 'Attacker compromises unpatched medical IoT device, pivots to the EHR application server via unencrypted HL7 protocol, then leverages the Domain Admin service account to access the patient database and exfiltrate protected health information.',
      steps: [
        { order: 1, edgeId: 'devices-to-ehr', sourceNodeId: 'medical-devices', targetNodeId: 'ehr-app-server', technique: 'T1210: Exploitation of Remote Services' },
        { order: 2, edgeId: 'ehr-to-db', sourceNodeId: 'ehr-app-server', targetNodeId: 'patient-db', technique: 'T1078: Valid Accounts' },
      ],
      mitreTechniques: ['T1210', 'T1078', 'T1005'],
      createdAt: '2025-06-01T00:05:00.000Z',
      updatedAt: '2025-06-01T00:05:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'hcr-ap-supply-chain-pharmacy',
      name: 'Exchange ProxyShell → Domain Credential Theft → Pharmacy Compromise',
      strideCategory: 'Tampering' as StrideCategory,
      riskLevel: 'High' as AttackPathRiskLevel,
      description: 'Attacker exploits ProxyShell vulnerability chain on the exposed Exchange server to gain SYSTEM-level access, extracts domain credentials via LDAP to the domain controller, then pivots through nurse workstations to compromise the pharmacy medication management system.',
      steps: [
        { order: 1, edgeId: 'exchange-to-dc', sourceNodeId: 'exchange-server', targetNodeId: 'domain-controller', technique: 'T1190: Exploit Public-Facing Application' },
        { order: 2, edgeId: 'vpn-to-internal', sourceNodeId: 'vpn-gateway', targetNodeId: 'nurse-stations', technique: 'T1078: Valid Accounts' },
        { order: 3, edgeId: 'nurse-to-pharmacy', sourceNodeId: 'nurse-stations', targetNodeId: 'pharmacy-system', technique: 'T1570: Lateral Tool Transfer' },
        { order: 4, edgeId: 'pharmacy-to-db', sourceNodeId: 'pharmacy-system', targetNodeId: 'patient-db', technique: 'T1565: Data Manipulation' },
      ],
      mitreTechniques: ['T1190', 'T1078', 'T1570', 'T1565'],
      createdAt: '2025-06-01T00:10:00.000Z',
      updatedAt: '2025-06-01T00:10:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'hcr-ap-insider-phi-theft',
      name: 'Insider Shared Account Abuse → Patient Data Theft',
      strideCategory: 'Information Disclosure' as StrideCategory,
      riskLevel: 'Medium' as AttackPathRiskLevel,
      description: 'Malicious insider uses shared generic login on nurse workstations with auto-login enabled to access the EHR application, then queries the patient database for targeted PHI records. Shared accounts prevent attribution of unauthorized access.',
      steps: [
        { order: 1, edgeId: 'nurse-to-ehr', sourceNodeId: 'nurse-stations', targetNodeId: 'ehr-app-server', technique: 'T1078.001: Default Accounts' },
        { order: 2, edgeId: 'ehr-to-db', sourceNodeId: 'ehr-app-server', targetNodeId: 'patient-db', technique: 'T1530: Data from Cloud Storage' },
        { order: 3, edgeId: 'ehr-to-pacs', sourceNodeId: 'ehr-app-server', targetNodeId: 'pacs-server', technique: 'T1005: Data from Local System' },
      ],
      mitreTechniques: ['T1078.001', 'T1530', 'T1005'],
      createdAt: '2025-06-01T00:15:00.000Z',
      updatedAt: '2025-06-01T00:15:00.000Z',
    } as DiagramAttackPath,
  ],
};