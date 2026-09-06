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
      description: 'Public internet and remote users'
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
      description: 'Identity and access management'
    },
    style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.DMZ,
        zIndex: -1
      }
  } as any,
  {
    id: 'internal-zone',
    type: 'securityZone',
    position: { x: 1640, y: 50 },
    data: {
      label: 'Internal',
      zoneType: 'Internal',
      description: 'Corporate applications'
    },
    style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Internal,
        zIndex: -1
      }
  } as any,
  {
    id: 'restricted-zone',
    type: 'securityZone',
    position: { x: 2510, y: 50 },
    data: {
      label: 'Restricted',
      zoneType: 'Restricted',
      description: 'Financial systems and data'
    },
    style: {
        width: 600,
        height: 1000,
        background: colors.zoneBackgrounds.Restricted,
        zIndex: -1
      }
  } as any,
  {
    id: 'cloud-zone',
    type: 'securityZone',
    position: { x: 790, y: -920 },
    data: {
      label: 'Cloud',
      zoneType: 'Cloud',
      description: 'Azure cloud services'
    },
    style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Cloud,
        zIndex: -1
      }
  } as any,

  // External Zone Components
  {
    id: 'remote-users',
    type: 'endpoint',
    position: { x: 175, y: 175 },
    data: {
      label: 'Remote Employees',
      description: 'Work from home users with personal devices. BYOD policy allows personal phones for MFA',
      zone: 'External',
      dataClassification: 'Internal',
      vendor: 'Various',
      osType: 'Mixed',
      securityControls: ['vpn', 'device-cert']
    }
  } as any,
  {
    id: 'customer-portal',
    type: 'webServer',
    position: { x: 325, y: 375 },
    data: {
      label: 'Customer Portal',
      description: 'Online banking and financial services. SMS-based 2FA for legacy customers',
      zone: 'External',
      dataClassification: 'Sensitive',
      vendor: 'Custom',
      protocols: ['HTTPS'],
      securityControls: ['waf', 'sms-2fa']
    }
  } as any,
  {
    id: 'help-desk',
    type: 'application',
    position: { x: 175, y: 575 },
    data: {
      label: 'IT Help Desk',
      description: 'ServiceNow instance for IT support. Can reset MFA and passwords via phone verification',
      vendor: 'ServiceNow',
      zone: 'External',
      dataClassification: 'Internal',
      protocols: ['HTTPS'],
      securityControls: ['sso']
    }
  } as any,

  // DMZ Zone - Identity Components
  {
    id: 'okta-tenant',
    type: 'identityProvider',
    position: { x: 875, y: 175 },
    data: {
      label: 'Okta SSO',
      description: 'Primary identity provider. FastPass enabled, SMS/voice MFA allowed as backup',
      vendor: 'Okta',
      product: 'Identity Cloud',
      zone: 'DMZ',
      dataClassification: 'Confidential',
      protocols: ['HTTPS', 'SAML'],
      securityControls: ['mfa', 'conditional-access']
    }
  } as any,
  {
    id: 'azure-ad',
    type: 'identityProvider',
    position: { x: 875, y: 375 },
    data: {
      label: 'Azure AD',
      description: 'Hybrid identity with on-prem sync. Global admin accounts use phone-based MFA',
      vendor: 'Microsoft',
      product: 'Azure AD',
      zone: 'DMZ',
      dataClassification: 'Confidential',
      protocols: ['HTTPS', 'OAuth'],
      securityControls: ['mfa', 'pim']
    }
  } as any,
  {
    id: 'privileged-access',
    type: 'application',
    position: { x: 875, y: 575 },
    data: {
      label: 'CyberArk PAM',
      description: 'Privileged account management. Master account has 90-day rotation policy',
      vendor: 'CyberArk',
      product: 'PAM',
      zone: 'DMZ',
      dataClassification: 'Confidential',
      protocols: ['HTTPS', 'RDP'],
      securityControls: ['vault', 'session-recording']
    }
  } as any,
  {
    id: 'mfa-service',
    type: 'application',
    position: { x: 1175, y: 75 },
    data: {
      label: 'Duo Security',
      description: 'Multi-factor authentication service. Push notifications and SMS backup codes',
      vendor: 'Cisco',
      product: 'Duo',
      zone: 'DMZ',
      dataClassification: 'Internal',
      protocols: ['HTTPS'],
      securityControls: ['push-auth', 'biometrics']
    }
  } as any,

  // Internal Zone Components
  {
    id: 'ad-domain',
    type: 'identityProvider',
    position: { x: 2025, y: 475 },
    data: {
      label: 'Active Directory',
      description: 'On-premise domain controllers. Azure AD Connect syncs every 30 minutes',
      vendor: 'Microsoft',
      product: 'Active Directory',
      zone: 'Internal',
      dataClassification: 'Confidential',
      securityControls: ['kerberos', 'group-policy']
    }
  } as any,
  {
    id: 'sharepoint',
    type: 'application',
    position: { x: 1875, y: 75 },
    data: {
      label: 'SharePoint Online',
      description: 'Document management and collaboration. External sharing enabled for vendors',
      vendor: 'Microsoft',
      product: 'SharePoint',
      zone: 'Internal',
      dataClassification: 'Sensitive',
      protocols: ['HTTPS'],
      securityControls: ['sso', 'dlp']
    }
  } as any,
  {
    id: 'email-gateway',
    type: 'application',
    position: { x: 1825, y: 325 },
    data: {
      label: 'Exchange Online',
      description: 'Corporate email. Legacy mail flow rules grant auto-forwarding permissions',
      vendor: 'Microsoft',
      product: 'Exchange Online',
      zone: 'Internal',
      dataClassification: 'Sensitive',
      protocols: ['HTTPS', 'SMTP'],
      securityControls: ['oauth', 'atp']
    }
  } as any,
  {
    id: 'finance-apps',
    type: 'application',
    position: { x: 1775, y: 775 },
    data: {
      label: 'Finance Applications',
      description: 'SAP and Oracle finance systems. Service accounts with broad permissions',
      vendor: 'SAP/Oracle',
      zone: 'Internal',
      dataClassification: 'Confidential',
      protocols: ['HTTPS'],
      securityControls: ['sso', 'rbac']
    }
  } as any,

  // Restricted Zone - Critical Finance
  {
    id: 'core-banking',
    type: 'application',
    position: { x: 2625, y: 175 },
    data: {
      label: 'Core Banking System',
      description: 'Transaction processing system. Mainframe with modern API layer',
      vendor: 'FIS',
      product: 'Core Banking',
      zone: 'Restricted',
      dataClassification: 'Confidential',
      protocols: ['HTTPS', 'MQ'],
      securityControls: ['hsm', 'transaction-signing']
    }
  } as any,
  {
    id: 'swift-gateway',
    type: 'application',
    position: { x: 2625, y: 875 },
    data: {
      label: 'SWIFT Gateway',
      description: 'International payment processing. Operator accounts shared among team',
      vendor: 'SWIFT',
      product: 'Alliance',
      zone: 'Restricted',
      dataClassification: 'Confidential',
      protocols: ['SWIFT', 'HTTPS'],
      securityControls: ['hsm', 'dual-control']
    }
  } as any,
  {
    id: 'payment-db',
    type: 'database',
    position: { x: 2975, y: 175 },
    data: {
      label: 'Payment Database',
      description: 'Transaction history and customer data. Service accounts for API access',
      vendor: 'Oracle',
      product: 'Database',
      version: '19c',
      zone: 'Restricted',
      dataClassification: 'Confidential',
      securityControls: ['encryption', 'audit-logs']
    }
  } as any,

  // Cloud Zone Components  
  {
    id: 'azure-portal',
    type: 'application',
    position: { x: 1075, y: -775 },
    data: {
      label: 'Azure Portal',
      description: 'Cloud management portal. Global admins use conditional access from corporate IPs only',
      vendor: 'Microsoft',
      product: 'Azure',
      zone: 'Cloud',
      dataClassification: 'Confidential',
      protocols: ['HTTPS'],
      securityControls: ['mfa', 'conditional-access']
    }
  } as any,
  {
    id: 'vdi-avd',
    type: 'application',
    position: { x: 1275, y: -775 },
    data: {
      label: 'Azure Virtual Desktop',
      description: 'Virtual desktop infrastructure for secure access. MFA at Windows login optional',
      vendor: 'Microsoft',
      product: 'AVD',
      zone: 'Cloud',
      dataClassification: 'Sensitive',
      protocols: ['RDP', 'HTTPS'],
      securityControls: ['conditional-access', 'session-hosts']
    }
  } as any,
  {
    id: 'azure-keyvault',
    type: 'database',
    position: { x: 1925, y: -375 },
    data: {
      label: 'Azure Key Vault',
      description: 'Certificate and secret storage. Service principals have contributor access',
      vendor: 'Microsoft',
      product: 'Key Vault',
      zone: 'Cloud',
      dataClassification: 'Confidential',
      securityControls: ['hsm', 'rbac']
    }
  } as any,
  {
    id: 'sentinel-siem',
    type: 'application',
    position: { x: 875, y: -475 },
    data: {
      label: 'Microsoft Sentinel',
      description: 'Cloud SIEM and SOAR. Alert fatigue led to many rules being disabled',
      vendor: 'Microsoft',
      product: 'Sentinel',
      zone: 'Cloud',
      dataClassification: 'Internal',
      protocols: ['HTTPS'],
      securityControls: ['log-analytics', 'playbooks']
    }
  } as any
];

const edges: SecurityEdge[] = [
  // Remote access flows
  {
    id: 'users-to-okta',
    source: 'remote-users',
    target: 'okta-tenant',
    type: 'securityEdge',
    data: {
      label: 'SSO Login',
      protocol: 'HTTPS',
      encryption: 'TLS 1.3',
      zone: 'DMZ',
      dataClassification: 'Confidential'
    }
  } as any,
  {
    id: 'users-to-helpdesk',
    source: 'remote-users',
    target: 'help-desk',
    type: 'securityEdge',
    data: {
      label: 'Support Tickets',
      protocol: 'HTTPS',
      encryption: 'TLS 1.2',
      zone: 'External',
      dataClassification: 'Internal',
      description: 'Password reset requests'
    }
  } as any,
  {
    id: 'portal-to-okta',
    source: 'customer-portal',
    target: 'okta-tenant',
    type: 'securityEdge',
    data: {
      label: 'Customer Auth',
      protocol: 'SAML',
      encryption: 'TLS 1.3',
      zone: 'DMZ',
      dataClassification: 'Sensitive'
    }
  } as any,
  
  // Identity federation
  {
    id: 'okta-to-azure',
    source: 'okta-tenant',
    target: 'azure-ad',
    type: 'securityEdge',
    data: {
      label: 'Identity Federation',
      protocol: 'SAML',
      encryption: 'TLS 1.3',
      zone: 'DMZ',
      dataClassification: 'Confidential'
    }
  } as any,
  {
    id: 'okta-to-duo',
    source: 'okta-tenant',
    target: 'mfa-service',
    type: 'securityEdge',
    data: {
      label: 'MFA Integration',
      protocol: 'HTTPS',
      encryption: 'TLS 1.3',
      zone: 'DMZ',
      dataClassification: 'Internal'
    }
  } as any,
  {
    id: 'azure-to-ad',
    source: 'azure-ad',
    target: 'ad-domain',
    type: 'securityEdge',
    data: {
      label: 'AD Connect Sync',
      protocol: 'HTTPS',
      encryption: 'TLS 1.2',
      zone: 'Internal',
      dataClassification: 'Confidential',
      description: 'Password hash sync'
    }
  } as any,
  
  // Privileged access
  {
    id: 'helpdesk-to-pam',
    source: 'help-desk',
    target: 'privileged-access',
    type: 'securityEdge',
    data: {
      label: 'Admin Access',
      protocol: 'HTTPS',
      encryption: 'TLS 1.3',
      zone: 'DMZ',
      dataClassification: 'Confidential',
      description: 'Break-glass accounts'
    }
  } as any,
  {
    id: 'pam-to-ad',
    source: 'privileged-access',
    target: 'ad-domain',
    type: 'securityEdge',
    data: {
      label: 'Privileged Sessions',
      protocol: 'RDP',
      encryption: 'TLS 1.2',
      zone: 'Internal',
      dataClassification: 'Confidential'
    }
  } as any,
  {
    id: 'pam-to-azure',
    source: 'privileged-access',
    target: 'azure-portal',
    type: 'securityEdge',
    data: {
        controlPoints: [{ id: 'cp-1771657728071', x: 1100, y: 500, active: true }],
      label: 'Cloud Admin',
      protocol: 'HTTPS',
      encryption: 'TLS 1.3',
      zone: 'Cloud',
      dataClassification: 'Confidential'
    }
  } as any,
  
  // Application access
  {
    id: 'okta-to-sharepoint',
    source: 'okta-tenant',
    target: 'sharepoint',
    type: 'securityEdge',
    data: {
      label: 'SSO Access',
      protocol: 'SAML',
      encryption: 'TLS 1.3',
      zone: 'Internal',
      dataClassification: 'Sensitive'
    }
  } as any,
  {
    id: 'okta-to-email',
    source: 'okta-tenant',
    target: 'email-gateway',
    type: 'securityEdge',
    data: {
      label: 'Email SSO',
      protocol: 'OAuth',
      encryption: 'TLS 1.3',
      zone: 'Internal',
      dataClassification: 'Sensitive'
    }
  } as any,
  {
    id: 'okta-to-finance',
    source: 'okta-tenant',
    target: 'finance-apps',
    type: 'securityEdge',
    data: {
      label: 'Finance SSO',
      protocol: 'SAML',
      encryption: 'TLS 1.3',
      zone: 'Internal',
      dataClassification: 'Confidential'
    }
  } as any,
  
  // Finance system access
  {
    id: 'finance-to-core',
    source: 'finance-apps',
    target: 'core-banking',
    type: 'securityEdge',
    data: {
      label: 'Banking API',
      protocol: 'HTTPS',
      encryption: 'TLS 1.3',
      zone: 'Restricted',
      dataClassification: 'Confidential'
    }
  } as any,
  {
    id: 'finance-to-swift',
    source: 'finance-apps',
    target: 'swift-gateway',
    type: 'securityEdge',
    data: {
      label: 'Payment Orders',
      protocol: 'HTTPS',
      encryption: 'TLS 1.3',
      zone: 'Restricted',
      dataClassification: 'Confidential'
    }
  } as any,
  {
    id: 'core-to-db',
    source: 'core-banking',
    target: 'payment-db',
    type: 'securityEdge',
    data: {
      label: 'Transaction Data',
      protocol: 'TCP/1521',
      encryption: 'Oracle Native',
      zone: 'Restricted',
      dataClassification: 'Confidential'
    }
  } as any,
  
  // Cloud access paths
  {
    id: 'azure-to-avd',
    source: 'azure-ad',
    target: 'vdi-avd',
    type: 'securityEdge',
    data: {
        controlPoints: [
          { id: 'cp-1771657739595', x: 1150, y: 300, active: true },
          { id: 'cp-1771657745904', x: 1150, y: -600, active: true }
        ],
      label: 'VDI Auth',
      protocol: 'HTTPS',
      encryption: 'TLS 1.3',
      zone: 'Cloud',
      dataClassification: 'Sensitive'
    }
  } as any,
  {
    id: 'avd-to-finance',
    source: 'vdi-avd',
    target: 'finance-apps',
    type: 'securityEdge',
    data: {
        controlPoints: [
          { id: 'cp-1771657797559', x: 1600, y: -750, active: true },
          { id: 'cp-1771657791914', x: 1600, y: 700, active: true }
        ],
      label: 'Virtual Desktop',
      protocol: 'RDP',
      encryption: 'TLS 1.2',
      zone: 'Internal',
      dataClassification: 'Confidential'
    }
  } as any,
  {
    id: 'apps-to-keyvault',
    source: 'finance-apps',
    target: 'azure-keyvault',
    type: 'securityEdge',
    data: {
        controlPoints: [{ id: 'cp-1771657767559', x: 1950, y: 700, active: true }],
      label: 'Secret Retrieval',
      protocol: 'HTTPS',
      encryption: 'TLS 1.3',
      zone: 'Cloud',
      dataClassification: 'Confidential'
    }
  } as any,
  {
    id: 'azure-to-sentinel',
    source: 'azure-ad',
    target: 'sentinel-siem',
    type: 'securityEdge',
    data: {
        controlPoints: [
          { id: 'cp-1771657806981', x: 700, y: 250, active: true },
          { id: 'cp-1771657812594', x: 700, y: -450, active: true }
        ],
      label: 'Security Logs',
      protocol: 'HTTPS',
      encryption: 'TLS 1.3',
      zone: 'Cloud',
      dataClassification: 'Internal'
    }
  } as any,
  
  // Critical bypass paths
  {
    id: 'helpdesk-to-azure',
    source: 'help-desk',
    target: 'azure-ad',
    type: 'securityEdge',
    data: {
      label: 'MFA Reset',
      protocol: 'HTTPS',
      encryption: 'TLS 1.3',
      zone: 'DMZ',
      dataClassification: 'Confidential',
      description: 'Phone-based verification'
    }
  } as any,
  {
    id: 'customer-to-core',
    source: 'customer-portal',
    target: 'core-banking',
    type: 'securityEdge',
    data: {
        controlPoints: [
          { id: 'cp-1771657886436', x: 500, y: 0, active: true },
          { id: 'cp-1771657890236', x: 2400, y: 0, active: true }
        ],
      label: 'Direct API',
      protocol: 'HTTPS',
      encryption: 'TLS 1.2',
      zone: 'Restricted',
      dataClassification: 'Confidential',
      description: 'Legacy integration'
    }
  } as any
];

const tierCatalogue: RiskTierNode[] = [
  { id: 'fis-tier1-cyber', tier: 1 as const, label: 'Cyber Risk', description: 'Information security and cyber threats targeting financial identity infrastructure' },
  { id: 'fis-tier1-operational', tier: 1 as const, label: 'Operational Risk', description: 'Business operations and process risks in financial services' },
  { id: 'fis-tier1-compliance', tier: 1 as const, label: 'Compliance Risk', description: 'Regulatory and compliance obligations for financial institutions' },
  { id: 'fis-tier2-identity', tier: 2 as const, label: 'Identity & Access', parentId: 'fis-tier1-cyber', description: 'SSO, MFA, PAM and federated identity controls' },
  { id: 'fis-tier2-privileged', tier: 2 as const, label: 'Privileged Access', parentId: 'fis-tier1-cyber', description: 'CyberArk PAM, break-glass, and admin access controls' },
  { id: 'fis-tier2-data', tier: 2 as const, label: 'Data Protection', parentId: 'fis-tier1-cyber', description: 'Encryption, key management, and data classification' },
  { id: 'fis-tier2-social-eng', tier: 2 as const, label: 'Social Engineering', parentId: 'fis-tier1-cyber', description: 'Phishing, vishing, and help desk manipulation' },
  { id: 'fis-tier2-monitoring', tier: 2 as const, label: 'Security Monitoring', parentId: 'fis-tier1-operational', description: 'SIEM, logging, and detection capabilities' },
  { id: 'fis-tier2-change', tier: 2 as const, label: 'Change Management', parentId: 'fis-tier1-operational', description: 'Configuration drift, password rotation, and account lifecycle' },
  { id: 'fis-tier2-regulatory', tier: 2 as const, label: 'Financial Regulation', parentId: 'fis-tier1-compliance', description: 'PCI-DSS, SOX, and banking regulatory compliance' },
  { id: 'fis-tier3-mfa-bypass', tier: 3 as const, label: 'MFA Bypass Vectors', parentId: 'fis-tier2-identity' },
  { id: 'fis-tier3-credential-stuffing', tier: 3 as const, label: 'Credential Stuffing', parentId: 'fis-tier2-identity' },
  { id: 'fis-tier3-helpdesk-se', tier: 3 as const, label: 'Help Desk Social Engineering', parentId: 'fis-tier2-social-eng' },
  { id: 'fis-tier3-pam-weakness', tier: 3 as const, label: 'PAM Configuration Gaps', parentId: 'fis-tier2-privileged' },
  { id: 'fis-tier3-ad-sync', tier: 3 as const, label: 'AD Sync Exploitation', parentId: 'fis-tier2-identity' },
  { id: 'fis-tier3-siem-gaps', tier: 3 as const, label: 'Disabled SIEM Rules', parentId: 'fis-tier2-monitoring' },
  { id: 'fis-tier3-shared-accounts', tier: 3 as const, label: 'Shared Operator Accounts', parentId: 'fis-tier2-change' },
  { id: 'fis-tier3-keyvault-overpriv', tier: 3 as const, label: 'Key Vault Over-Privilege', parentId: 'fis-tier2-data' },
];

const assets: GrcAsset[] = [
  {
    id: 'fis-asset-okta', name: 'Okta SSO', type: 'identity_provider', owner: 'Identity & Access Management',
    domain: 'it' as const, category: 'Identity',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Primary identity provider for workforce and customer SSO with FastPass and SMS/voice MFA backup',
    criticality: { confidentiality: 5, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'finance-identity', nodeId: 'okta-tenant', nodeLabel: 'Okta SSO', nodeType: 'identityProvider' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'fis-asset-mfa', name: 'Duo Security MFA', type: 'authentication_service', owner: 'Identity & Access Management',
    domain: 'it' as const, category: 'Security Tools',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Multi-factor authentication service with push notifications and SMS backup codes',
    criticality: { confidentiality: 4, integrity: 5, availability: 5, financial: 4, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'finance-identity', nodeId: 'mfa-service', nodeLabel: 'Duo Security', nodeType: 'application' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'fis-asset-azure-ad', name: 'Azure AD', type: 'identity_provider', owner: 'Identity & Access Management',
    domain: 'it' as const, category: 'Identity',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Hybrid identity with on-prem AD sync; global admin accounts use phone-based MFA',
    criticality: { confidentiality: 5, integrity: 5, availability: 4, financial: 4, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'finance-identity', nodeId: 'azure-ad', nodeLabel: 'Azure AD', nodeType: 'identityProvider' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'fis-asset-pam', name: 'CyberArk PAM', type: 'privileged_access_management', owner: 'Security Operations',
    domain: 'it' as const, category: 'Security Tools',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Privileged account management with master account on 90-day rotation, shared among team',
    criticality: { confidentiality: 5, integrity: 5, availability: 4, financial: 5, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'finance-identity', nodeId: 'privileged-access', nodeLabel: 'CyberArk PAM', nodeType: 'application' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'fis-asset-core-banking', name: 'Core Banking System', type: 'application_server', owner: 'Finance Operations',
    domain: 'application' as const, category: 'Business Application',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Transaction processing system with mainframe and modern API layer',
    criticality: { confidentiality: 5, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 2 },
    diagramRefs: [{ diagramId: 'finance-identity', nodeId: 'core-banking', nodeLabel: 'Core Banking System', nodeType: 'application' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'fis-asset-swift', name: 'SWIFT Gateway', type: 'payment_gateway', owner: 'Treasury Operations',
    domain: 'application' as const, category: 'Business Application',
    businessCriticality: 5, securityCriticality: 5,
    description: 'International payment processing with shared operator accounts',
    criticality: { confidentiality: 5, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 2 },
    diagramRefs: [{ diagramId: 'finance-identity', nodeId: 'swift-gateway', nodeLabel: 'SWIFT Gateway', nodeType: 'application' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'fis-asset-keyvault', name: 'Azure Key Vault', type: 'secret_store', owner: 'Cloud Operations',
    domain: 'it' as const, category: 'Security Tools',
    businessCriticality: 4, securityCriticality: 5,
    description: 'Certificate and secret storage; service principals have contributor access',
    criticality: { confidentiality: 5, integrity: 4, availability: 3, financial: 3, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'finance-identity', nodeId: 'azure-keyvault', nodeLabel: 'Azure Key Vault', nodeType: 'database' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'fis-asset-sentinel', name: 'Microsoft Sentinel', type: 'siem', owner: 'Security Operations',
    domain: 'it' as const, category: 'Security Tools',
    businessCriticality: 4, securityCriticality: 4,
    description: 'Cloud SIEM and SOAR with many rules disabled due to alert fatigue',
    criticality: { confidentiality: 3, integrity: 4, availability: 3, financial: 3, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'finance-identity', nodeId: 'sentinel-siem', nodeLabel: 'Microsoft Sentinel', nodeType: 'application' }],
    createdAt: NOW, updatedAt: NOW,
  },
];

const risks: GrcRisk[] = [
  {
    id: 'fis-risk-credential-stuffing', title: 'Credential Stuffing Against Customer Portal',
    description: 'Customer portal with SMS-based 2FA for 30% of legacy customers is vulnerable to automated credential stuffing attacks using leaked password databases, enabling mass account takeover.',
    status: 'assessed' as const, owner: 'Identity & Access Management',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Identity & Access', tier3: 'Credential Stuffing' },
    assetIds: ['fis-asset-okta'],
    diagramLinks: [{ diagramId: 'finance-identity', nodeIds: ['customer-portal', 'okta-tenant'] }],
    inherentScore: score('likelihood-5', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Migrate all customers from SMS 2FA to FIDO2/WebAuthn; deploy bot detection and rate limiting on customer portal',
    threatActorIds: ['fis-actor-organised-crime'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'fis-risk-mfa-bypass', title: 'MFA Bypass via Help Desk Social Engineering',
    description: 'Help desk can reset MFA with only phone number verification, allowing social engineering attacks (vishing) to bypass multi-factor authentication for any employee or VIP executive.',
    status: 'assessed' as const, owner: 'Security Operations',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Social Engineering', tier3: 'Help Desk Social Engineering' },
    assetIds: ['fis-asset-mfa', 'fis-asset-azure-ad'],
    diagramLinks: [{ diagramId: 'finance-identity', nodeIds: ['help-desk', 'azure-ad', 'mfa-service'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Implement identity proofing for MFA resets requiring video verification; add callback procedures for VIP accounts',
    threatActorIds: ['fis-actor-scattered-spider'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'fis-risk-account-takeover', title: 'Account Takeover via Phishing and Token Replay',
    description: 'Global admin accounts in Azure use phone-based MFA without phishing-resistant methods, enabling adversary-in-the-middle phishing to capture session tokens and bypass MFA entirely.',
    status: 'assessed' as const, owner: 'Identity & Access Management',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Identity & Access', tier3: 'MFA Bypass Vectors' },
    assetIds: ['fis-asset-azure-ad', 'fis-asset-okta'],
    diagramLinks: [{ diagramId: 'finance-identity', nodeIds: ['azure-ad', 'okta-tenant', 'azure-portal'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Mandate FIDO2 security keys for all global admin accounts; enforce phishing-resistant MFA via conditional access',
    threatActorIds: ['fis-actor-scattered-spider'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'fis-risk-privilege-escalation', title: 'Privilege Escalation via PAM Break-Glass Abuse',
    description: 'CyberArk break-glass accounts with 90-day rotation are shared among the team, and help desk has admin access to PAM. A compromised help desk operator could check out privileged credentials for lateral movement.',
    status: 'assessed' as const, owner: 'Security Operations',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Privileged Access', tier3: 'PAM Configuration Gaps' },
    assetIds: ['fis-asset-pam'],
    diagramLinks: [{ diagramId: 'finance-identity', nodeIds: ['privileged-access', 'help-desk', 'ad-domain'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Reduce break-glass rotation to 24 hours; remove help desk admin access to PAM; implement dual-control for privileged checkouts',
    threatActorIds: ['fis-actor-insider'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'fis-risk-insider-fraud', title: 'Insider Fraud via Shared SWIFT Operator Accounts',
    description: 'SWIFT gateway operator accounts are shared among team members, eliminating individual accountability and enabling unauthorized wire transfers without proper dual-control enforcement.',
    status: 'assessed' as const, owner: 'Treasury Operations',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Change Management', tier3: 'Shared Operator Accounts' },
    assetIds: ['fis-asset-swift', 'fis-asset-core-banking'],
    diagramLinks: [{ diagramId: 'finance-identity', nodeIds: ['swift-gateway', 'finance-apps'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Assign individual SWIFT operator credentials; enforce dual-authorization for all transfers above threshold; integrate with CyberArk for session recording',
    threatActorIds: ['fis-actor-insider'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'fis-risk-ad-sync-abuse', title: 'AD Connect Password Hash Sync Exploitation',
    description: 'Azure AD Connect syncs password hashes every 30 minutes from on-premise AD. Compromise of the sync server or its service account would expose all corporate identity hashes for offline cracking.',
    status: 'draft' as const, owner: 'Identity & Access Management',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Identity & Access', tier3: 'AD Sync Exploitation' },
    assetIds: ['fis-asset-azure-ad'],
    diagramLinks: [{ diagramId: 'finance-identity', nodeIds: ['azure-ad', 'ad-domain'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Migrate to cloud-only authentication with Azure AD cloud sync; restrict AD Connect service account to minimal permissions',
    threatActorIds: ['fis-actor-nation-state'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'fis-risk-sentinel-gaps', title: 'Degraded Detection Due to Disabled Sentinel Rules',
    description: 'Alert fatigue led to many Sentinel detection rules being disabled, creating blind spots for identity-based attacks including impossible travel, suspicious sign-ins, and privilege escalation alerts.',
    status: 'assessed' as const, owner: 'Security Operations',
    tierPath: { tier1: 'Operational Risk', tier2: 'Security Monitoring', tier3: 'Disabled SIEM Rules' },
    assetIds: ['fis-asset-sentinel'],
    diagramLinks: [{ diagramId: 'finance-identity', nodeIds: ['sentinel-siem'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Audit and re-enable critical identity detection rules; implement alert tuning instead of disabling; deploy SOAR playbooks for automated triage',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'fis-risk-keyvault-overpriv', title: 'Azure Key Vault Over-Privileged Service Principals',
    description: 'Service principals have Contributor role on entire subscription including Key Vault, allowing any compromised application to read certificates, secrets, and keys used for transaction signing.',
    status: 'draft' as const, owner: 'Cloud Operations',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Data Protection', tier3: 'Key Vault Over-Privilege' },
    assetIds: ['fis-asset-keyvault'],
    diagramLinks: [{ diagramId: 'finance-identity', nodeIds: ['azure-keyvault', 'finance-apps'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Scope service principal access to specific Key Vault secrets; implement RBAC with Key Vault access policies; enable soft-delete and purge protection',
    createdAt: NOW, updatedAt: NOW,
  },
];

const assessments: GrcAssessment[] = [
  {
    id: 'fis-assessment-identity-review', title: 'Financial Identity Infrastructure Security Assessment',
    status: 'in_review' as const,
    owner: 'Identity Security Architecture',
    reviewer: 'CISO',
    startDate: '2025-05-01',
    dueDate: '2025-07-01',
    threatActorIds: ['fis-actor-scattered-spider', 'fis-actor-organised-crime', 'fis-actor-nation-state', 'fis-actor-insider'],
    methodologyNote: 'Assessment follows NIST SP 800-63 Digital Identity Guidelines with MITRE ATT&CK Enterprise and Scattered Spider TTP mapping.',
    assumptionNote: 'Assessment covers production identity infrastructure only. Development and staging environments excluded. Assumes current Okta and Azure AD configuration.',
    scopeItems: [
      { id: 'fis-scope-system', type: 'system' as const, value: 'system', name: 'Financial Identity Infrastructure' },
      { id: 'fis-scope-dmz', type: 'diagram_segment' as const, value: 'DMZ', name: 'Identity DMZ Zone' },
      { id: 'fis-scope-cloud', type: 'diagram_segment' as const, value: 'Cloud', name: 'Azure Cloud Services' },
      { id: 'fis-scope-restricted', type: 'diagram_segment' as const, value: 'Restricted', name: 'Restricted Finance Zone' },
    ],
    tierFilter: { tier1: 'Cyber Risk' },
    riskManagementPlan: {
      objective: 'Remediate identity-based attack vectors exploitable by Scattered Spider TTPs, close social engineering gaps, and enforce phishing-resistant MFA across all privileged accounts.',
      strategy: 'Prioritize MFA hardening and help desk procedures first, then address PAM configuration and SWIFT account separation, followed by monitoring restoration.',
      residualRiskStatement: 'Residual risk accepted for SMS-based MFA on legacy customer accounts during 6-month migration period with compensating bot detection controls.',
      monitoringApproach: 'Daily review of identity-related Sentinel alerts; weekly privileged access audit; monthly help desk social engineering drill results.',
      communicationPlan: 'Report to Information Security Steering Committee biweekly; escalation to Board Risk Committee for Critical-rated findings.',
      reviewCadenceDays: 14,
      actions: [
        {
          id: 'fis-rmp-fido2-admins',
          title: 'Mandate FIDO2 security keys for all global admin accounts',
          owner: 'Identity & Access Management',
          dueDate: '2025-06-01',
          status: 'in_progress' as const,
          linkedRiskIds: ['fis-risk-account-takeover'],
          notes: 'FIDO2 keys procured; pilot deployment to 20 global admins underway',
        },
        {
          id: 'fis-rmp-helpdesk-proofing',
          title: 'Implement identity proofing for MFA resets',
          owner: 'IT Service Management',
          dueDate: '2025-06-15',
          status: 'planned' as const,
          linkedRiskIds: ['fis-risk-mfa-bypass'],
          notes: 'Evaluating video verification vendors; interim callback procedure drafted',
        },
        {
          id: 'fis-rmp-swift-accounts',
          title: 'Assign individual SWIFT operator credentials',
          owner: 'Treasury Operations',
          dueDate: '2025-07-01',
          status: 'planned' as const,
          linkedRiskIds: ['fis-risk-insider-fraud'],
          notes: 'Requires SWIFT Alliance reconfiguration; change request submitted',
        },
        {
          id: 'fis-rmp-sentinel-rules',
          title: 'Audit and re-enable critical Sentinel detection rules',
          owner: 'Security Operations',
          dueDate: '2025-06-10',
          status: 'in_progress' as const,
          linkedRiskIds: ['fis-risk-sentinel-gaps'],
          notes: 'Reviewing 85 disabled rules; 30 identity-related rules identified for re-enablement',
        },
        {
          id: 'fis-rmp-pam-hardening',
          title: 'Reduce break-glass rotation to 24 hours and remove help desk PAM admin',
          owner: 'Security Operations',
          dueDate: '2025-06-20',
          status: 'planned' as const,
          linkedRiskIds: ['fis-risk-privilege-escalation'],
          notes: 'Requires CyberArk policy update and help desk role restructuring',
        },
      ],
      updatedAt: NOW,
    },
    riskIds: risks.map(r => r.id),
    soaGapIds: ['fis-soa-a01', 'fis-soa-a07', 'fis-soa-cis05', 'fis-soa-cis06'],
    taskIds: ['fis-task-fido2-migration', 'fis-task-helpdesk-proofing', 'fis-task-swift-accounts', 'fis-task-sentinel-tuning', 'fis-task-pam-hardening', 'fis-task-customer-mfa-migration'],
    linkedImplementedControlIds: [],
    linkedInitiativeIds: [],
    summary: 'Security assessment of financial identity infrastructure identifying 8 risks across identity, privileged access, social engineering, and monitoring gaps. 3 rated Critical, 3 High, 2 Medium.',
    findings: 'Key findings include phone-based MFA on global admin accounts, help desk MFA reset via phone verification only, shared SWIFT operator accounts, disabled Sentinel detection rules, and over-privileged Key Vault service principals.',
    recommendations: 'Mandate FIDO2 for all privileged accounts, implement identity proofing for help desk MFA resets, separate SWIFT operator credentials, and restore Sentinel detection coverage.',
    evidenceSummary: 'Evidence includes Azure AD conditional access policy exports, Okta MFA enrollment reports, CyberArk session recordings audit, Sentinel rule configuration dump, and SWIFT operator access logs.',
    threatModel: {
      nodes: [
        { id: 'fis-tm-attacker', label: 'Scattered Spider Operator', sourceType: 'dfd_custom' as AssessmentThreatModelNodeSourceType, position: { x: 50, y: 200 }, nodeType: 'user', commentary: 'Threat group specializing in social engineering and identity attacks' },
        { id: 'fis-tm-helpdesk', label: 'IT Help Desk', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'help-desk', position: { x: 250, y: 100 }, nodeType: 'application', commentary: 'MFA reset with phone verification only' },
        { id: 'fis-tm-okta', label: 'Okta SSO', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'okta-tenant', position: { x: 450, y: 200 }, nodeType: 'identityProvider', commentary: 'SSO with SMS fallback MFA' },
        { id: 'fis-tm-azure-ad', label: 'Azure AD', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'azure-ad', position: { x: 450, y: 350 }, nodeType: 'identityProvider', commentary: 'Phone-based MFA for global admins' },
        { id: 'fis-tm-pam', label: 'CyberArk PAM', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'privileged-access', position: { x: 650, y: 200 }, nodeType: 'application', commentary: 'Shared break-glass accounts' },
        { id: 'fis-tm-finance', label: 'Finance Applications', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'finance-apps', position: { x: 850, y: 200 }, nodeType: 'application' },
        { id: 'fis-tm-swift', label: 'SWIFT Gateway', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'swift-gateway', position: { x: 1050, y: 200 }, nodeType: 'application', commentary: 'Shared operator accounts' },
      ],
      edges: [
        { id: 'fis-tm-edge-attacker-helpdesk', source: 'fis-tm-attacker', target: 'fis-tm-helpdesk', sourceType: 'manual' as AssessmentThreatModelEdgeSourceType, label: 'Vishing (phone social engineering)', commentary: 'Scattered Spider operators call help desk impersonating VIP executives' },
        { id: 'fis-tm-edge-helpdesk-azure', source: 'fis-tm-helpdesk', target: 'fis-tm-azure-ad', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'helpdesk-to-azure', label: 'MFA Reset', commentary: 'Phone-based verification only for MFA reset' },
        { id: 'fis-tm-edge-helpdesk-pam', source: 'fis-tm-helpdesk', target: 'fis-tm-pam', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'helpdesk-to-pam', label: 'Break-glass checkout', commentary: 'Help desk has admin access to PAM' },
        { id: 'fis-tm-edge-okta-finance', source: 'fis-tm-okta', target: 'fis-tm-finance', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'okta-to-finance', label: 'Finance SSO' },
        { id: 'fis-tm-edge-finance-swift', source: 'fis-tm-finance', target: 'fis-tm-swift', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'finance-to-swift', label: 'Payment Orders' },
      ],
      attackPathDescription: 'Four primary attack chains: (1) Help desk social engineering to MFA reset to privileged account takeover; (2) Phishing global admins to Azure AD compromise to cloud resource access; (3) Customer portal credential stuffing to account takeover to fraudulent transactions; (4) Insider abuse of shared SWIFT operator accounts for unauthorized wire transfers.',
      attackPaths: [
        {
          id: 'fis-aap-helpdesk-mfa-pam',
          name: 'Help Desk Social Engineering → MFA Reset → PAM Abuse',
          strideCategory: 'Spoofing' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'Scattered Spider operator calls help desk impersonating VIP, resets MFA via phone verification, gains Azure AD access, then leverages help desk PAM admin rights to check out privileged credentials for domain-wide access.',
          diagramAttackPathId: 'fis-ap-helpdesk-mfa-pam',
          steps: [
            { order: 1, edgeId: 'helpdesk-to-azure', sourceNodeId: 'help-desk', targetNodeId: 'azure-ad', technique: 'T1566: Phishing' },
            { order: 2, edgeId: 'helpdesk-to-pam', sourceNodeId: 'help-desk', targetNodeId: 'privileged-access', technique: 'T1078: Valid Accounts' },
            { order: 3, edgeId: 'pam-to-ad', sourceNodeId: 'privileged-access', targetNodeId: 'ad-domain', technique: 'T1078.002: Valid Accounts: Domain Accounts' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
        {
          id: 'fis-aap-credential-stuffing-fraud',
          name: 'Credential Stuffing → Account Takeover → Fraudulent Transactions',
          strideCategory: 'Spoofing' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'Automated credential stuffing against customer portal exploits SMS-based 2FA for legacy customers, achieves account takeover via Okta SSO, then initiates fraudulent transactions through core banking system.',
          diagramAttackPathId: 'fis-ap-credential-stuffing-fraud',
          steps: [
            { order: 1, edgeId: 'portal-to-okta', sourceNodeId: 'customer-portal', targetNodeId: 'okta-tenant', technique: 'T1110: Brute Force' },
            { order: 2, edgeId: 'okta-to-finance', sourceNodeId: 'okta-tenant', targetNodeId: 'finance-apps', technique: 'T1078: Valid Accounts' },
            { order: 3, edgeId: 'finance-to-core', sourceNodeId: 'finance-apps', targetNodeId: 'core-banking', technique: 'T1565: Data Manipulation' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
        {
          id: 'fis-aap-insider-swift',
          name: 'Insider Abuse → Shared SWIFT Account → Unauthorized Transfer',
          strideCategory: 'Repudiation' as StrideCategory,
          riskLevel: 'High' as AttackPathRiskLevel,
          description: 'Insider with knowledge of shared SWIFT operator credentials initiates unauthorized wire transfer via finance applications, with no individual accountability due to shared accounts.',
          diagramAttackPathId: 'fis-ap-insider-swift',
          steps: [
            { order: 1, edgeId: 'okta-to-finance', sourceNodeId: 'okta-tenant', targetNodeId: 'finance-apps', technique: 'T1078: Valid Accounts' },
            { order: 2, edgeId: 'finance-to-swift', sourceNodeId: 'finance-apps', targetNodeId: 'swift-gateway', technique: 'T1565: Data Manipulation' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
      ],
      updatedAt: NOW,
    },
    createdAt: NOW, updatedAt: NOW,
  },
];

const soaEntries: GrcSoaEntry[] = [
  {
    id: 'fis-soa-a01', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A01', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Help desk has admin access to CyberArk PAM. Service principals have Contributor on entire Azure subscription. Conditional access policies have excessive exceptions.',
    mitigatesRiskIds: ['fis-risk-privilege-escalation', 'fis-risk-keyvault-overpriv'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'fis-soa-a02', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A02', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Azure AD Connect uses TLS 1.2 for password hash sync but hashes are extractable if sync server is compromised. Key Vault access not scoped per application.',
    mitigatesRiskIds: ['fis-risk-ad-sync-abuse', 'fis-risk-keyvault-overpriv'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'fis-soa-a04', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A04', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Help desk MFA reset flow lacks identity proofing. SWIFT dual-control not enforced for shared operator accounts. No separation of duties between help desk and PAM administration.',
    mitigatesRiskIds: ['fis-risk-mfa-bypass', 'fis-risk-insider-fraud'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'fis-soa-a07', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A07', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Global admin accounts use phone-based MFA without phishing resistance. SMS 2FA still active for 30% of customers. Break-glass accounts shared with 90-day rotation.',
    mitigatesRiskIds: ['fis-risk-account-takeover', 'fis-risk-credential-stuffing', 'fis-risk-mfa-bypass'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'fis-soa-a09', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A09', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Sentinel deployed but many identity detection rules disabled due to alert fatigue. Insufficient logging of help desk MFA reset operations.',
    mitigatesRiskIds: ['fis-risk-sentinel-gaps'],
    diagramRefs: [],
    evidence: [
      { id: 'fis-evidence-sentinel-config', kind: 'link' as const, name: 'Sentinel analytics rules audit export', url: 'https://security.example.internal/reports/sentinel-rules', note: 'Monthly review', createdAt: NOW },
    ],
    updatedAt: NOW,
  },
  {
    id: 'fis-soa-cis05', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.05', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'SWIFT operator accounts shared among team. Break-glass PAM accounts shared with extended rotation. Vendor guest accounts have 365-day expiration. 150+ service accounts with non-expiring passwords.',
    mitigatesRiskIds: ['fis-risk-insider-fraud', 'fis-risk-privilege-escalation'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'fis-soa-cis06', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.06', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Conditional access policies have many exceptions. Azure service principals over-privileged. Help desk has PAM admin access. External sharing enabled on SharePoint for vendors.',
    mitigatesRiskIds: ['fis-risk-privilege-escalation', 'fis-risk-keyvault-overpriv', 'fis-risk-mfa-bypass'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'fis-soa-cis08', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.08', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Sentinel ingests Azure AD and Okta logs but many detection rules disabled. Help desk MFA reset operations not fully audited. CyberArk session recordings enabled but not reviewed.',
    mitigatesRiskIds: ['fis-risk-sentinel-gaps'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
];

const workflowTasks: GrcTask[] = [
  {
    id: 'fis-task-fido2-migration',
    title: 'Deploy FIDO2 security keys to all global admin accounts',
    description: 'Procure and deploy hardware security keys for phishing-resistant MFA on all Azure AD global admin and privileged role accounts.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'critical' as const,
    owner: 'Identity & Access Management',
    dueDate: '2025-06-01',
    riskId: 'fis-risk-account-takeover',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'fis-task-helpdesk-proofing',
    title: 'Implement identity proofing for help desk MFA resets',
    description: 'Deploy video verification or in-person identity proofing for all MFA reset requests. Add mandatory callback procedure for VIP accounts.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'critical' as const,
    owner: 'IT Service Management',
    dueDate: '2025-06-15',
    riskId: 'fis-risk-mfa-bypass',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'fis-task-swift-accounts',
    title: 'Assign individual SWIFT operator credentials',
    description: 'Reconfigure SWIFT Alliance to use individual operator accounts with dual-authorization for transfers above threshold.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Treasury Operations',
    dueDate: '2025-07-01',
    riskId: 'fis-risk-insider-fraud',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'fis-task-sentinel-tuning',
    title: 'Audit and re-enable critical Sentinel identity detection rules',
    description: 'Review all disabled Sentinel analytics rules; re-enable identity-related detections and implement SOAR playbooks for automated triage.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'high' as const,
    owner: 'Security Operations',
    dueDate: '2025-06-10',
    riskId: 'fis-risk-sentinel-gaps',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'fis-task-pam-hardening',
    title: 'Harden CyberArk PAM break-glass procedures',
    description: 'Reduce break-glass account rotation to 24 hours; remove help desk admin access to PAM; implement dual-control for privileged checkouts.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Security Operations',
    dueDate: '2025-06-20',
    riskId: 'fis-risk-privilege-escalation',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'fis-task-customer-mfa-migration',
    title: 'Migrate legacy customers from SMS 2FA to FIDO2/WebAuthn',
    description: 'Execute phased migration of 30% customer base from SMS-based 2FA to phishing-resistant authentication methods.',
    type: 'control_implementation' as const,
    status: 'todo' as const,
    priority: 'medium' as const,
    owner: 'Digital Banking',
    dueDate: '2025-12-31',
    riskId: 'fis-risk-credential-stuffing',
    createdAt: NOW, updatedAt: NOW,
  },
];

const governanceDocuments: GrcGovernanceDocument[] = [
  {
    id: 'fis-gov-iam-policy', title: 'Identity & Access Management Policy',
    type: 'policy' as const,
    description: 'Enterprise IAM policy covering authentication standards, MFA requirements, account lifecycle, and privileged access management.',
    owner: 'CISO',
    reviewDate: '2025-03-01',
    nextReviewDate: '2025-09-01',
    status: 'active' as const,
    version: '3.2',
    tags: ['iam', 'mfa', 'privileged-access'],
    linkedRiskIds: ['fis-risk-account-takeover', 'fis-risk-mfa-bypass', 'fis-risk-privilege-escalation'],
    linkedControlSetIds: [OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID],
    linkedAssessmentIds: ['fis-assessment-identity-review'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'fis-gov-pci-dss', title: 'PCI-DSS Compliance Framework',
    type: 'framework' as const,
    description: 'PCI-DSS v4.0 compliance requirements for payment card data handling, including authentication and access control requirements.',
    owner: 'Compliance Officer',
    reviewDate: '2025-01-15',
    nextReviewDate: '2025-07-15',
    status: 'active' as const,
    version: '4.0',
    tags: ['pci-dss', 'compliance', 'payments'],
    linkedRiskIds: ['fis-risk-insider-fraud', 'fis-risk-credential-stuffing'],
    linkedControlSetIds: [OWASP_CONTROL_SET_ID],
    linkedAssessmentIds: ['fis-assessment-identity-review'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'fis-gov-sox-it-controls', title: 'SOX IT General Controls',
    type: 'standard' as const,
    description: 'SOX ITGC requirements for financial system access controls, change management, and audit trail integrity.',
    owner: 'Internal Audit',
    reviewDate: '2025-02-01',
    nextReviewDate: '2025-08-01',
    status: 'active' as const,
    version: '2.1',
    tags: ['sox', 'itgc', 'financial-controls'],
    linkedRiskIds: ['fis-risk-insider-fraud', 'fis-risk-sentinel-gaps'],
    linkedControlSetIds: [CIS_CONTROL_SET_ID],
    linkedAssessmentIds: ['fis-assessment-identity-review'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'fis-gov-helpdesk-sop', title: 'Help Desk Identity Verification SOP',
    type: 'sop' as const,
    description: 'Standard operating procedure for help desk identity verification during password and MFA reset requests. Currently under review due to social engineering incidents.',
    owner: 'IT Service Management',
    reviewDate: '2025-04-01',
    nextReviewDate: '2025-06-01',
    status: 'under_review' as const,
    version: '1.4',
    tags: ['help-desk', 'identity-proofing', 'social-engineering'],
    linkedRiskIds: ['fis-risk-mfa-bypass'],
    linkedControlSetIds: [],
    linkedAssessmentIds: ['fis-assessment-identity-review'],
    createdAt: NOW, updatedAt: NOW,
  },
];

const threatActors: GrcThreatActor[] = [
  {
    id: 'fis-actor-scattered-spider', name: 'Scattered Spider (UNC3944)',
    type: 'organised_crime' as const, capabilityLevel: 5,
    resourceLevel: 'high' as const,
    motivation: 'Financial gain through social engineering-based account takeover, SIM swapping, and help desk manipulation to bypass MFA and access corporate financial systems.',
    description: 'Sophisticated threat group known for targeting enterprise identity infrastructure through social engineering. Specializes in help desk vishing, MFA fatigue attacks, and cloud identity compromise. Known to target financial services, telecom, and technology sectors.',
    targetedAssetIds: ['fis-asset-okta', 'fis-asset-mfa', 'fis-asset-azure-ad', 'fis-asset-pam'],
    tags: ['social-engineering', 'identity-attack', 'mfa-bypass', 'help-desk-vishing'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'fis-actor-organised-crime', name: 'Financial Fraud Syndicate',
    type: 'organised_crime' as const, capabilityLevel: 4,
    resourceLevel: 'high' as const,
    motivation: 'Direct financial theft through credential stuffing, account takeover, and fraudulent wire transfers targeting retail and corporate banking customers.',
    description: 'Organized crime group operating automated credential stuffing infrastructure with access to large stolen credential databases. Targets customer-facing banking portals and payment systems.',
    targetedAssetIds: ['fis-asset-okta', 'fis-asset-core-banking', 'fis-asset-swift'],
    tags: ['credential-stuffing', 'fraud', 'account-takeover', 'wire-fraud'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'fis-actor-nation-state', name: 'APT Group (Financial Sector)',
    type: 'nation_state' as const, capabilityLevel: 5,
    resourceLevel: 'very_high' as const,
    motivation: 'Strategic intelligence collection on financial transactions, SWIFT messaging patterns, and sanctions-related activity. Secondary goal of disruption capability for geopolitical leverage.',
    description: 'State-sponsored threat group with advanced capabilities targeting SWIFT infrastructure and core banking systems. Employs sophisticated supply chain attacks, zero-day exploits, and long-term persistent access campaigns.',
    targetedAssetIds: ['fis-asset-swift', 'fis-asset-core-banking', 'fis-asset-azure-ad', 'fis-asset-keyvault'],
    tags: ['apt', 'swift-targeting', 'espionage', 'financial-sector'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'fis-actor-insider', name: 'Disgruntled Finance Employee',
    type: 'insider' as const, capabilityLevel: 3,
    resourceLevel: 'moderate' as const,
    motivation: 'Financial gain through unauthorized wire transfers using shared SWIFT operator accounts, or retaliation through data destruction or exfiltration of sensitive customer financial data.',
    description: 'Current or departing employee with legitimate access to finance applications and knowledge of shared SWIFT operator credentials. May exploit weak separation of duties and long account expiration periods.',
    targetedAssetIds: ['fis-asset-swift', 'fis-asset-core-banking', 'fis-asset-pam'],
    tags: ['insider-threat', 'fraud', 'privileged-access', 'shared-accounts'],
    createdAt: NOW, updatedAt: NOW,
  },
];

const threatScenarios: GrcThreatScenario[] = [
  {
    id: 'fis-scenario-scattered-spider', title: 'Scattered Spider Help Desk Social Engineering Campaign',
    description: 'Scattered Spider operators conduct targeted vishing campaign against help desk, impersonating VIP executives to reset MFA. After gaining Azure AD access, they leverage help desk PAM admin rights to check out privileged domain credentials, achieving domain-wide compromise and accessing core banking systems.',
    threatActorId: 'fis-actor-scattered-spider',
    targetedAssetIds: ['fis-asset-mfa', 'fis-asset-azure-ad', 'fis-asset-pam', 'fis-asset-core-banking'],
    attackTechniques: ['T1566 - Phishing', 'T1078 - Valid Accounts', 'T1078.002 - Domain Accounts', 'T1021 - Remote Services'],
    linkedRiskIds: ['fis-risk-mfa-bypass', 'fis-risk-account-takeover', 'fis-risk-privilege-escalation'],
    likelihood: 'High - Help desk MFA reset with phone verification only provides direct entry; Scattered Spider actively targets this vector.',
    impact: 'Critical - Domain-wide compromise enables access to core banking and SWIFT systems.',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'fis-scenario-credential-stuffing', title: 'Mass Customer Account Takeover via Credential Stuffing',
    description: 'Organized crime group deploys automated credential stuffing against customer portal using leaked password databases. SMS-based 2FA for 30% of legacy customers is intercepted via SIM swapping, enabling mass account takeover and fraudulent transactions through core banking.',
    threatActorId: 'fis-actor-organised-crime',
    targetedAssetIds: ['fis-asset-okta', 'fis-asset-core-banking'],
    attackTechniques: ['T1110 - Brute Force', 'T1078 - Valid Accounts', 'T1565 - Data Manipulation'],
    linkedRiskIds: ['fis-risk-credential-stuffing', 'fis-risk-account-takeover'],
    likelihood: 'Very High - SMS-based 2FA is known-vulnerable; credential databases readily available on dark web.',
    impact: 'Major - Mass customer account takeover triggers regulatory notification obligations, financial losses, and reputational damage.',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'fis-scenario-swift-fraud', title: 'Insider SWIFT Wire Fraud via Shared Operator Accounts',
    description: 'Disgruntled employee exploits shared SWIFT operator credentials to initiate unauthorized international wire transfers. Shared accounts prevent attribution, and disabled Sentinel rules delay detection allowing multiple transactions before discovery.',
    threatActorId: 'fis-actor-insider',
    targetedAssetIds: ['fis-asset-swift', 'fis-asset-sentinel'],
    attackTechniques: ['T1078 - Valid Accounts', 'T1565 - Data Manipulation', 'T1070 - Indicator Removal'],
    linkedRiskIds: ['fis-risk-insider-fraud', 'fis-risk-sentinel-gaps'],
    likelihood: 'Moderate - Requires existing access but shared accounts and weak monitoring reduce barriers significantly.',
    impact: 'Critical - Direct financial loss from unauthorized wire transfers; SOX compliance violation; potential criminal liability.',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'fis-scenario-apt-swift', title: 'APT Campaign Targeting SWIFT Infrastructure',
    description: 'Nation-state APT group conducts long-term campaign to compromise Azure AD via password hash sync exploitation, pivots through Azure Key Vault to obtain transaction signing keys, and establishes persistent access to SWIFT gateway for intelligence collection and potential disruptive operations.',
    threatActorId: 'fis-actor-nation-state',
    targetedAssetIds: ['fis-asset-azure-ad', 'fis-asset-keyvault', 'fis-asset-swift', 'fis-asset-core-banking'],
    attackTechniques: ['T1003 - OS Credential Dumping', 'T1552 - Unsecured Credentials', 'T1098 - Account Manipulation', 'T1071 - Application Layer Protocol'],
    linkedRiskIds: ['fis-risk-ad-sync-abuse', 'fis-risk-keyvault-overpriv', 'fis-risk-insider-fraud'],
    likelihood: 'Low to Moderate - Requires significant resources but nation-state actors have demonstrated this capability against SWIFT targets.',
    impact: 'Critical - Compromise of SWIFT infrastructure could enable large-scale financial theft or geopolitical disruption.',
    createdAt: NOW, updatedAt: NOW,
  },
];

export const financeIdentitySystemGrcWorkspace = buildGrcWorkspace({
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
      id: 'fis-si-iam-hardening', title: 'IAM Hardening and FIDO2 Migration',
      description: 'Enterprise-wide migration from legacy MFA to FIDO2 phishing-resistant authentication across all workforce and privileged access systems.',
      category: 'uplift' as const, status: 'in_progress' as const, priority: 'critical' as const,
      owner: 'Identity & Access Management', executiveSponsor: 'CISO',
      currentState: 'Legacy MFA (SMS/TOTP) across 80% of workforce; PAM break-glass accounts lack hardware token enforcement.',
      targetState: 'FIDO2 hardware tokens for all privileged accounts; phishing-resistant MFA for 100% of workforce within 12 months.',
      startDate: '2025-01-15T00:00:00.000Z', targetDate: '2026-01-15T00:00:00.000Z', completedDate: '',
      milestones: [
        { id: 'fis-ms-fido2-pilot', title: 'FIDO2 Pilot for IT Admins', description: 'Deploy YubiKey 5 tokens to all IT administrators and PAM break-glass operators.', status: 'completed' as const, dueDate: '2025-04-01T00:00:00.000Z', completedDate: '2025-03-28T00:00:00.000Z', owner: 'Identity & Access Management' },
        { id: 'fis-ms-fido2-privileged', title: 'FIDO2 Rollout to Privileged Users', description: 'Extend hardware token enrollment to SWIFT operators, Azure AD admins, and help desk staff.', status: 'in_progress' as const, dueDate: '2025-08-01T00:00:00.000Z', completedDate: '', owner: 'Identity & Access Management' },
        { id: 'fis-ms-fido2-workforce', title: 'Workforce-Wide FIDO2 Enforcement', description: 'Complete enrollment for all 50,000 employees and disable legacy MFA fallback in Okta.', status: 'pending' as const, dueDate: '2026-01-15T00:00:00.000Z', completedDate: '', owner: 'Identity & Access Management' },
      ],
      linkedRiskIds: ['fis-risk-mfa-bypass', 'fis-risk-account-takeover', 'fis-risk-credential-stuffing'],
      linkedControlSetIds: [],
      linkedAssetIds: ['fis-asset-okta', 'fis-asset-mfa', 'fis-asset-pam'],
      linkedImplementedControlIds: ['fis-ic-fido2-tokens', 'fis-ic-pam-session-recording'],
      linkedAssessmentIds: ['fis-assessment-identity-review'],
      notes: 'Driven by Scattered Spider threat intelligence. Executive board approved budget for 55,000 YubiKey tokens.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'fis-si-fraud-detection-uplift', title: 'Transaction Fraud Detection Uplift',
      description: 'Enhance SWIFT transaction monitoring and fraud detection capabilities to address insider fraud risks and nation-state targeting of financial messaging.',
      category: 'remediation' as const, status: 'approved' as const, priority: 'high' as const,
      owner: 'Treasury Operations', executiveSponsor: 'CFO',
      currentState: 'Shared SWIFT operator accounts with limited transaction anomaly detection; Sentinel rules partially disabled.',
      targetState: 'Individual SWIFT operator accounts with dual-authorization, real-time transaction anomaly detection, and full Sentinel coverage.',
      startDate: '2025-06-01T00:00:00.000Z', targetDate: '2025-12-31T00:00:00.000Z', completedDate: '',
      milestones: [
        { id: 'fis-ms-swift-individual', title: 'SWIFT Individual Operator Accounts', description: 'Eliminate shared operator accounts and provision individual SWIFT Alliance Lite2 credentials with unique certificates.', status: 'in_progress' as const, dueDate: '2025-09-01T00:00:00.000Z', completedDate: '', owner: 'Treasury Operations' },
        { id: 'fis-ms-sentinel-tuning', title: 'Sentinel Rule Re-enablement and Tuning', description: 'Re-enable all disabled Sentinel analytics rules and tune alert thresholds to reduce false positives.', status: 'pending' as const, dueDate: '2025-11-01T00:00:00.000Z', completedDate: '', owner: 'Security Operations' },
      ],
      linkedRiskIds: ['fis-risk-insider-fraud', 'fis-risk-sentinel-gaps'],
      linkedControlSetIds: [],
      linkedAssetIds: ['fis-asset-swift', 'fis-asset-sentinel', 'fis-asset-core-banking'],
      linkedImplementedControlIds: ['fis-ic-transaction-monitoring'],
      linkedAssessmentIds: ['fis-assessment-identity-review'],
      notes: 'Regulatory finding from PCI-DSS assessment highlighted shared SWIFT accounts as critical non-compliance.',
      createdAt: NOW, updatedAt: NOW,
    },
  ],
  implementedControls: [
    {
      id: 'fis-ic-fido2-tokens', title: 'FIDO2 Hardware Token Authentication',
      description: 'YubiKey 5 NFC hardware tokens deployed for phishing-resistant authentication to Okta SSO and Azure AD for privileged accounts.',
      controlType: 'technical' as const, category: 'identity_management' as const,
      status: 'active' as const, automationLevel: 'semi_automated' as const,
      owner: 'Identity & Access Management', vendor: 'Yubico', product: 'YubiKey 5 NFC', version: '5.4.3',
      implementedDate: '2025-03-28T00:00:00.000Z', lastReviewDate: NOW, nextReviewDate: '2025-12-01T00:00:00.000Z',
      linkedSoaEntryIds: ['fis-soa-a02', 'fis-soa-a07'],
      linkedRiskIds: ['fis-risk-mfa-bypass', 'fis-risk-account-takeover'],
      linkedAssetIds: ['fis-asset-okta', 'fis-asset-mfa', 'fis-asset-azure-ad'],
      linkedAssessmentIds: ['fis-assessment-identity-review'],
      notes: 'Pilot deployment to 500 IT administrators complete. Full workforce rollout pending.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'fis-ic-pam-session-recording', title: 'CyberArk Privileged Session Recording',
      description: 'All privileged access sessions routed through CyberArk PSM with full keystroke and video recording for audit and forensic review.',
      controlType: 'technical' as const, category: 'access_control' as const,
      status: 'active' as const, automationLevel: 'fully_automated' as const,
      owner: 'Security Operations', vendor: 'CyberArk', product: 'Privileged Session Manager', version: '13.2',
      implementedDate: '2024-11-01T00:00:00.000Z', lastReviewDate: NOW, nextReviewDate: '2025-11-01T00:00:00.000Z',
      linkedSoaEntryIds: ['fis-soa-a01', 'fis-soa-cis05'],
      linkedRiskIds: ['fis-risk-privilege-escalation', 'fis-risk-insider-fraud'],
      linkedAssetIds: ['fis-asset-pam', 'fis-asset-core-banking'],
      linkedAssessmentIds: ['fis-assessment-identity-review'],
      notes: 'Session recordings retained for 12 months. Break-glass account usage triggers immediate SOC alert.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'fis-ic-transaction-monitoring', title: 'SWIFT Transaction Anomaly Detection',
      description: 'Real-time monitoring of SWIFT MT103/MT202 messages with velocity checks, geolocation analysis, and dual-authorization enforcement for high-value transfers.',
      controlType: 'technical' as const, category: 'monitoring' as const,
      status: 'active' as const, automationLevel: 'semi_automated' as const,
      owner: 'Treasury Operations', vendor: 'Bottomline Technologies', product: 'Secure Payments', version: '8.1',
      implementedDate: '2024-06-15T00:00:00.000Z', lastReviewDate: NOW, nextReviewDate: '2025-09-01T00:00:00.000Z',
      linkedSoaEntryIds: ['fis-soa-a09', 'fis-soa-cis08'],
      linkedRiskIds: ['fis-risk-insider-fraud', 'fis-risk-sentinel-gaps'],
      linkedAssetIds: ['fis-asset-swift', 'fis-asset-sentinel'],
      linkedAssessmentIds: ['fis-assessment-identity-review'],
      notes: 'Shared operator accounts undermine dual-authorization controls. Individual accounts required for full effectiveness.',
      createdAt: NOW, updatedAt: NOW,
    },
  ],
  thirdParties: [
    {
      id: 'fis-tp-okta', name: 'Okta', description: 'Workforce and customer single sign-on identity provider for all enterprise applications.',
      category: 'saas' as const, status: 'active' as const, riskRating: 'critical' as const, dataClassification: 'confidential' as const,
      linkedAssetIds: ['fis-asset-okta', 'fis-asset-mfa'], linkedRiskIds: ['fis-risk-credential-stuffing', 'fis-risk-mfa-bypass', 'fis-risk-account-takeover'],
      contactName: 'Sarah Mitchell', contactEmail: 'sarah.mitchell@okta.com',
      contractExpiry: '2027-06-30T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-09-01T00:00:00.000Z',
      notes: 'Tier 1 critical vendor. Annual SOC 2 Type II review required. Phishing-resistant MFA rollout in progress.',
    },
    {
      id: 'fis-tp-microsoft', name: 'Microsoft Azure', description: 'Cloud platform hosting Azure AD, Key Vault, Sentinel SIEM, and Azure Virtual Desktop.',
      category: 'cloud_provider' as const, status: 'active' as const, riskRating: 'critical' as const, dataClassification: 'confidential' as const,
      linkedAssetIds: ['fis-asset-azure-ad', 'fis-asset-keyvault', 'fis-asset-sentinel'], linkedRiskIds: ['fis-risk-ad-sync-abuse', 'fis-risk-keyvault-overpriv', 'fis-risk-sentinel-gaps'],
      contactName: 'James Rodriguez', contactEmail: 'james.rodriguez@microsoft.com',
      contractExpiry: '2028-01-31T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-08-15T00:00:00.000Z',
      notes: 'Enterprise Agreement with dedicated CSA. Conditional Access policy exceptions under review.',
    },
    {
      id: 'fis-tp-swift', name: 'SWIFT', description: 'Society for Worldwide Interbank Financial Telecommunication providing secure financial messaging.',
      category: 'partner' as const, status: 'active' as const, riskRating: 'critical' as const, dataClassification: 'restricted' as const,
      linkedAssetIds: ['fis-asset-swift', 'fis-asset-core-banking'], linkedRiskIds: ['fis-risk-insider-fraud'],
      contactName: 'Philippe Dubois', contactEmail: 'philippe.dubois@swift.com',
      contractExpiry: '2027-12-31T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-06-15T00:00:00.000Z',
      notes: 'SWIFT Customer Security Programme compliance mandatory. Shared operator accounts flagged for remediation.',
    },
    {
      id: 'fis-tp-cyberark', name: 'CyberArk', description: 'Privileged access management platform for securing administrative and service accounts.',
      category: 'saas' as const, status: 'active' as const, riskRating: 'high' as const, dataClassification: 'confidential' as const,
      linkedAssetIds: ['fis-asset-pam'], linkedRiskIds: ['fis-risk-privilege-escalation', 'fis-risk-insider-fraud'],
      contactName: 'David Chen', contactEmail: 'david.chen@cyberark.com',
      contractExpiry: '2027-03-31T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-07-01T00:00:00.000Z',
      notes: 'Break-glass account rotation extended to 90 days. Dual-control enforcement pending implementation.',
    },
    {
      id: 'fis-tp-mandiant', name: 'Mandiant', description: 'Incident response and threat intelligence services for advanced threat actor investigations.',
      category: 'contractor' as const, status: 'active' as const, riskRating: 'medium' as const, dataClassification: 'confidential' as const,
      linkedAssetIds: ['fis-asset-sentinel'], linkedRiskIds: ['fis-risk-sentinel-gaps', 'fis-risk-account-takeover'],
      contactName: 'Rachel Torres', contactEmail: 'rachel.torres@mandiant.com',
      contractExpiry: '2026-12-31T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-10-01T00:00:00.000Z',
      notes: 'On retainer for Scattered Spider incident response. Access scoped to forensic investigation environment only.',
    },
  ],
});

export const financeIdentitySystem: ExampleSystem = {
  id: 'finance-identity',
  name: 'Financial Services Identity Infrastructure - Scattered Spider',
  description: 'Enterprise financial services with cloud identity and privileged access management',
  category: 'Enterprise Systems',
  primaryZone: 'Internal',
  dataClassification: 'Confidential',
  nodes,
  edges,
  customContext: `### System Overview
  Large financial institution with 50,000 employees and 2 million retail customers. Heavy investment in cloud transformation and identity modernization.
  
  ### Identity Architecture
  - **Primary IdP**: Okta for workforce and customer SSO
  - **Cloud Identity**: Azure AD with hybrid sync to on-premise Active Directory
  - **MFA**: Duo Security with push notifications, SMS fallback for legacy users
  - **PAM**: CyberArk for privileged account management
  - **Help Desk**: ServiceNow can reset MFA via phone verification
  
  ### Key Security Details
  - Help desk can reset MFA with only phone number verification for user convenience
  - SMS-based MFA still enabled for 30% of customers who haven't migrated
  - Azure AD Connect syncs password hashes every 30 minutes
  - Global admin accounts in Azure use phone-based MFA (no phishing-resistant methods)
  - Break-glass accounts in CyberArk have 90-day rotation but shared among team
  - Service principals in Azure have Contributor role on entire subscription
  
  ### Operational Challenges
  - BYOD policy allows personal phones for MFA enrollment
  - VIP executives often call help desk directly to bypass security procedures  
  - External vendors have guest accounts with extended expiration (365 days)
  - Legacy finance applications require service accounts with broad permissions
  - Conditional access policies have many exceptions for "business requirements"
  
  ### Cloud Integration
  - Azure Virtual Desktop for secure remote access (MFA at Windows optional)
  - SharePoint Online with external sharing enabled for vendor collaboration
  - Exchange Online with legacy mail flow rules allowing auto-forwarding
  - Key Vault service principals have broad access for "automation flexibility"
  - Sentinel SIEM has many disabled rules due to alert fatigue
  
  ### Recent Incidents
  - Several successful phishing attacks targeting SMS-based MFA codes
  - Help desk social engineering attempts increasing 300% YoY
  - Found 150+ service accounts with non-expiring passwords during audit
  - Azure guest accounts discovered with global admin after vendor contract ended`,
  grcWorkspace: financeIdentitySystemGrcWorkspace,
  attackPaths: [
    {
      id: 'fis-ap-helpdesk-mfa-pam',
      name: 'Help Desk Social Engineering → MFA Reset → PAM Abuse',
      strideCategory: 'Spoofing' as StrideCategory,
      riskLevel: 'Critical' as AttackPathRiskLevel,
      description: 'Scattered Spider operator calls help desk impersonating VIP executive, resets MFA via phone verification, gains Azure AD access, then leverages help desk PAM admin rights to check out privileged domain credentials for full domain compromise.',
      steps: [
        { order: 1, edgeId: 'users-to-helpdesk', sourceNodeId: 'remote-users', targetNodeId: 'help-desk', technique: 'T1566: Phishing' },
        { order: 2, edgeId: 'helpdesk-to-azure', sourceNodeId: 'help-desk', targetNodeId: 'azure-ad', technique: 'T1078: Valid Accounts' },
        { order: 3, edgeId: 'helpdesk-to-pam', sourceNodeId: 'help-desk', targetNodeId: 'privileged-access', technique: 'T1078.002: Valid Accounts: Domain Accounts' },
        { order: 4, edgeId: 'pam-to-ad', sourceNodeId: 'privileged-access', targetNodeId: 'ad-domain', technique: 'T1021: Remote Services' },
      ],
      mitreTechniques: ['T1566', 'T1078', 'T1078.002', 'T1021'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'fis-ap-credential-stuffing-fraud',
      name: 'Credential Stuffing → Account Takeover → Fraudulent Transactions',
      strideCategory: 'Spoofing' as StrideCategory,
      riskLevel: 'Critical' as AttackPathRiskLevel,
      description: 'Automated credential stuffing against customer portal exploits SMS-based 2FA for legacy customers, achieves account takeover via Okta SSO, then initiates fraudulent transactions through finance applications to core banking system.',
      steps: [
        { order: 1, edgeId: 'portal-to-okta', sourceNodeId: 'customer-portal', targetNodeId: 'okta-tenant', technique: 'T1110: Brute Force' },
        { order: 2, edgeId: 'okta-to-finance', sourceNodeId: 'okta-tenant', targetNodeId: 'finance-apps', technique: 'T1078: Valid Accounts' },
        { order: 3, edgeId: 'finance-to-core', sourceNodeId: 'finance-apps', targetNodeId: 'core-banking', technique: 'T1565: Data Manipulation' },
        { order: 4, edgeId: 'core-to-db', sourceNodeId: 'core-banking', targetNodeId: 'payment-db', technique: 'T1005: Data from Local System' },
      ],
      mitreTechniques: ['T1110', 'T1078', 'T1565', 'T1005'],
      createdAt: '2025-06-01T00:05:00.000Z',
      updatedAt: '2025-06-01T00:05:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'fis-ap-phishing-cloud-exfil',
      name: 'Phishing → Azure AD Compromise → Cloud Key Vault Exfiltration',
      strideCategory: 'Information Disclosure' as StrideCategory,
      riskLevel: 'High' as AttackPathRiskLevel,
      description: 'Adversary-in-the-middle phishing captures Azure AD session token from global admin using phone-based MFA, accesses Azure portal via compromised privileged session, then retrieves transaction signing keys from Key Vault via over-privileged service principals.',
      steps: [
        { order: 1, edgeId: 'users-to-okta', sourceNodeId: 'remote-users', targetNodeId: 'okta-tenant', technique: 'T1557: Adversary-in-the-Middle' },
        { order: 2, edgeId: 'okta-to-azure', sourceNodeId: 'okta-tenant', targetNodeId: 'azure-ad', technique: 'T1550: Use Alternate Authentication Material' },
        { order: 3, edgeId: 'pam-to-azure', sourceNodeId: 'privileged-access', targetNodeId: 'azure-portal', technique: 'T1078.004: Valid Accounts: Cloud Accounts' },
        { order: 4, edgeId: 'apps-to-keyvault', sourceNodeId: 'finance-apps', targetNodeId: 'azure-keyvault', technique: 'T1552: Unsecured Credentials' },
      ],
      mitreTechniques: ['T1557', 'T1550', 'T1078.004', 'T1552'],
      createdAt: '2025-06-01T00:10:00.000Z',
      updatedAt: '2025-06-01T00:10:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'fis-ap-insider-swift',
      name: 'Insider Abuse → Shared SWIFT Account → Unauthorized Wire Transfer',
      strideCategory: 'Repudiation' as StrideCategory,
      riskLevel: 'Medium' as AttackPathRiskLevel,
      description: 'Insider with knowledge of shared SWIFT operator credentials authenticates through Okta SSO, accesses finance applications, and initiates unauthorized international wire transfers via SWIFT gateway with no individual accountability due to shared accounts.',
      steps: [
        { order: 1, edgeId: 'okta-to-finance', sourceNodeId: 'okta-tenant', targetNodeId: 'finance-apps', technique: 'T1078: Valid Accounts' },
        { order: 2, edgeId: 'finance-to-swift', sourceNodeId: 'finance-apps', targetNodeId: 'swift-gateway', technique: 'T1565: Data Manipulation' },
      ],
      mitreTechniques: ['T1078', 'T1565'],
      createdAt: '2025-06-01T00:15:00.000Z',
      updatedAt: '2025-06-01T00:15:00.000Z',
    } as DiagramAttackPath,
  ],
};