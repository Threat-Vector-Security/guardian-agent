import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityNode, SecurityEdge, SecurityZone, DataClassification } from '../../types/SecurityTypes';
import { colors } from '../../styles/Theme';
import { DiagramAttackPath } from '../../types/GrcTypes';
import { buildGrcWorkspace, score, NOW, OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID } from './grcSharedBase';

export const hybridCloudMigration: ExampleSystem = {
  id: 'hybrid-cloud-migration',
  name: 'Hybrid DFD: Cloud Migration in Progress',
  description: 'Enterprise system mid-migration showing both legacy on-premise components and modern cloud architecture',
  category: 'DFD Threat Models',
  primaryZone: 'Hybrid',
  dataClassification: 'Sensitive',
  customContext: `
## Hybrid Cloud Migration Model

This demonstrates a realistic scenario where an organization is migrating from on-premise to cloud, with some components fully migrated, others in transition, and some remaining on-premise.

### Migration Status
- **Completed**: User authentication, web frontend, mobile apps
- **In Progress**: Core application services (shown as DFD processes)
- **Planned**: Data warehouse, legacy systems
- **Remaining On-Premise**: Mainframe, compliance-required data

### Architecture Decisions
1. **Hybrid Identity**: Azure AD synced with on-premise Active Directory
2. **Data Replication**: Real-time sync between on-premise and cloud databases
3. **Network**: Site-to-site VPN with ExpressRoute for critical workloads
4. **Security**: Cloud-native controls for new services, traditional for legacy

### Current Challenges
- Data consistency during migration windows
- Network latency between cloud and on-premise
- Skill gap in cloud technologies
- Regulatory compliance for data residency
- Cost optimization during dual-running period

### Security Considerations
- Temporary elevated privileges for migration activities
- Multiple authentication domains during transition
- Increased attack surface with hybrid connectivity
- Shadow IT risk as teams adopt cloud services independently
- Legacy systems exposed to internet for first time via cloud proxy

The migration follows a strangler fig pattern, gradually replacing legacy components while maintaining business continuity.
  `,
  nodes: [
    // Security Zones - Hybrid layout
    // Main row (y=50): Internet(3 nodes)=600px x=50, DMZ(2 nodes)=600px x=770, Internal(3 nodes)=600px x=1490, Restricted(3 nodes)=600px x=2210
    // Above row (y=-1070): Cloud(4 nodes)=750px x=770, Hybrid(3 nodes)=600px x=1640
    {
      id: 'internet-zone',
      type: 'securityZone',
      position: { x: 50, y: 50 },
      data: {
        label: 'Internet Zone',
        zoneType: 'Internet',
        description: 'Public internet'
      },
      style: {
        width: 600,
        height: 1000,
        background: colors.zoneBackgrounds.Internet,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'cloud-zone',
      type: 'securityZone',
      position: { x: 770, y: -1070 },
      data: {
        label: 'Cloud Zone (Azure)',
        zoneType: 'Cloud',
        description: 'Azure cloud environment'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Cloud,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'hybrid-zone',
      type: 'securityZone',
      position: { x: 1640, y: -1070 },
      data: {
        label: 'Hybrid Zone',
        zoneType: 'Hybrid',
        description: 'Hybrid connectivity layer'
      },
      style: {
        width: 600,
        height: 1000,
        background: colors.zoneBackgrounds.Hybrid,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'dmz-zone',
      type: 'securityZone',
      position: { x: 770, y: 50 },
      data: {
        label: 'On-Premise DMZ',
        zoneType: 'DMZ',
        description: 'Traditional DMZ'
      },
      style: {
        width: 600,
        height: 1000,
        background: colors.zoneBackgrounds.DMZ,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'internal-zone',
      type: 'securityZone',
      position: { x: 1490, y: 50 },
      data: {
        label: 'Internal Network',
        zoneType: 'Internal',
        description: 'Corporate internal network'
      },
      style: {
        width: 600,
        height: 1000,
        background: colors.zoneBackgrounds.Internal,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'restricted-zone',
      type: 'securityZone',
      position: { x: 2210, y: 50 },
      data: {
        label: 'Restricted Zone',
        zoneType: 'Restricted',
        description: 'Legacy systems and sensitive data'
      },
      style: {
        width: 600,
        height: 1000,
        background: colors.zoneBackgrounds.Restricted,
        zIndex: -1
      }
    } as SecurityNode,

    // External entities (DFD Actors) — Internet zone (x=50, delta=0)
    {
      id: 'employees',
      type: 'dfdActor',
      position: { x: 250, y: 300 },
      data: {
        label: 'Employees',
        actorType: 'Remote and Office Workers',
        zone: 'Internet',
        description: 'Employees accessing from various locations',
        protocols: ['HTTPS', 'VPN'],
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'customers',
      type: 'dfdActor',
      position: { x: 250, y: 500 },
      data: {
        label: 'Customers',
        actorType: 'External Customers',
        zone: 'Internet',
        description: 'Customers accessing public services',
        protocols: ['HTTPS'],
        dataClassification: 'Public'
      }
    } as SecurityNode,
    {
      id: 'saas-vendors',
      type: 'dfdActor',
      position: { x: 250, y: 700 },
      data: {
        label: 'SaaS Vendors',
        actorType: 'Third-party Cloud Services',
        zone: 'Internet',
        description: 'Integrated SaaS applications (Salesforce, Office 365)',
        protocols: ['HTTPS', 'OAuth'],
        dataClassification: 'Sensitive'
      }
    } as SecurityNode,

    // Cloud Components — Cloud zone (old x=820, new x=770, delta=-50)
    {
      id: 'azure-ad',
      type: 'identityProvider',
      position: { x: 870, y: -820 },
      data: {
        label: 'Azure Active Directory',
        zone: 'Cloud',
        description: 'Cloud identity provider synced with on-premise AD',
        vendor: 'Microsoft',
        version: 'P2',
        technology: 'Azure AD',
        protocols: ['SAML', 'OAuth', 'OIDC'],
        securityControls: ['MFA', 'Conditional Access', 'Identity Protection'],
        dataClassification: 'Sensitive'
      }
    } as SecurityNode,
    {
      id: 'web-app',
      type: 'cloudService',
      position: { x: 1020, y: -670 },
      data: {
        label: 'Modern Web App',
        zone: 'Cloud',
        description: 'Fully migrated web application on Azure App Service',
        vendor: 'Microsoft',
        technology: 'Azure App Service',
        protocols: ['HTTPS'],
        securityControls: ['Managed Identity', 'Key Vault Integration'],
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'api-layer',
      type: 'dfdProcess',
      position: { x: 1170, y: -820 },
      data: {
        label: 'API Services',
        processType: 'Microservices API Layer',
        zone: 'Cloud',
        description: 'New microservices being built in cloud',
        technology: 'Azure Kubernetes Service',
        protocols: ['REST', 'gRPC'],
        securityControls: ['API Management', 'Service Mesh'],
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'cloud-database',
      type: 'cloudDatabase',
      position: { x: 1020, y: -470 },
      data: {
        label: 'Azure SQL Database',
        zone: 'Cloud',
        description: 'Migrated customer database',
        vendor: 'Microsoft',
        technology: 'Azure SQL',
        protocols: ['TDS'],
        securityControls: ['Transparent Data Encryption', 'Row Level Security'],
        dataClassification: 'Sensitive'
      }
    } as SecurityNode,

    // Hybrid Components — Hybrid zone (old x=1590, new x=1640, delta=+50)
    {
      id: 'express-route',
      type: 'gateway',
      position: { x: 1740, y: -820 },
      data: {
        label: 'ExpressRoute Gateway',
        zone: 'Hybrid',
        description: 'Dedicated connection between Azure and on-premise',
        vendor: 'Microsoft',
        technology: 'ExpressRoute',
        protocols: ['BGP'],
        securityControls: ['Private Peering', 'Route Filters'],
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'data-sync',
      type: 'dfdProcess',
      position: { x: 1890, y: -670 },
      data: {
        label: 'Data Sync Service',
        processType: 'Hybrid Data Replication',
        zone: 'Hybrid',
        description: 'Bi-directional data sync during migration',
        technology: 'Azure Data Sync',
        protocols: ['TLS'],
        securityControls: ['Change Data Capture', 'Conflict Resolution'],
        dataClassification: 'Sensitive'
      }
    } as SecurityNode,
    {
      id: 'ad-connect',
      type: 'dfdProcess',
      position: { x: 2040, y: -820 },
      data: {
        label: 'AD Connect',
        processType: 'Identity Synchronization',
        zone: 'Hybrid',
        description: 'Syncs on-premise AD with Azure AD',
        technology: 'Azure AD Connect',
        protocols: ['LDAPS'],
        securityControls: ['Password Hash Sync', 'Pass-through Auth'],
        dataClassification: 'Sensitive'
      }
    } as SecurityNode,

    // On-Premise DMZ — DMZ zone (old x=820, new x=770, delta=-50)
    {
      id: 'vpn-gateway',
      type: 'vpnGateway',
      position: { x: 870, y: 250 },
      data: {
        label: 'VPN Gateway',
        zone: 'DMZ',
        description: 'Site-to-site VPN for backup connectivity',
        vendor: 'Cisco',
        version: 'ASA 5516-X',
        technology: 'IPSec',
        protocols: ['IPSec', 'IKEv2'],
        securityControls: ['Certificate Auth', 'DPD'],
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'legacy-web',
      type: 'webServer',
      position: { x: 1020, y: 400 },
      data: {
        label: 'Legacy Web Server',
        zone: 'DMZ',
        description: 'Old web application pending migration',
        vendor: 'Apache',
        version: '2.4',
        technology: 'LAMP Stack',
        protocols: ['HTTPS'],
        securityControls: ['ModSecurity', 'SSL Termination'],
        dataClassification: 'Internal'
      }
    } as SecurityNode,

    // Internal Network — Internal zone (old x=1590, new x=1490, delta=-100)
    {
      id: 'domain-controller',
      type: 'ldap',
      position: { x: 1590, y: 250 },
      data: {
        label: 'Domain Controller',
        zone: 'Internal',
        description: 'On-premise Active Directory',
        vendor: 'Microsoft',
        version: 'Server 2019',
        technology: 'Active Directory',
        protocols: ['LDAP', 'Kerberos'],
        securityControls: ['Group Policy', 'LAPS'],
        dataClassification: 'Sensitive'
      }
    } as SecurityNode,
    {
      id: 'business-logic',
      type: 'dfdProcess',
      position: { x: 1740, y: 400 },
      data: {
        label: 'Core Business Logic',
        processType: 'Legacy Application Server',
        zone: 'Internal',
        description: 'Monolithic application being decomposed',
        technology: 'Java EE',
        protocols: ['RMI', 'JMS'],
        securityControls: ['RBAC', 'Audit Logging'],
        dataClassification: 'Sensitive'
      }
    } as SecurityNode,
    {
      id: 'file-server',
      type: 'nas',
      position: { x: 1890, y: 250 },
      data: {
        label: 'File Server',
        zone: 'Internal',
        description: 'Network attached storage for departments',
        vendor: 'NetApp',
        technology: 'ONTAP',
        protocols: ['SMB', 'NFS'],
        securityControls: ['Access ACLs', 'Snapshots'],
        dataClassification: 'Internal'
      }
    } as SecurityNode,

    // Restricted Zone — Restricted zone (old x=2360, new x=2210, delta=-150)
    {
      id: 'mainframe',
      type: 'dfdProcess',
      position: { x: 2310, y: 300 },
      data: {
        label: 'Legacy Mainframe',
        processType: 'Core Banking Mainframe',
        zone: 'Restricted',
        description: 'IBM mainframe - not planned for migration',
        technology: 'IBM z/OS',
        protocols: ['3270', 'MQ'],
        securityControls: ['RACF', 'SMF Auditing'],
        dataClassification: 'Confidential'
      }
    } as SecurityNode,
    {
      id: 'compliance-db',
      type: 'dfdDataStore',
      position: { x: 2460, y: 450 },
      data: {
        label: 'Compliance Database',
        storeType: 'Regulatory Data Store',
        zone: 'Restricted',
        description: 'Data that must remain on-premise for compliance',
        technology: 'Oracle 19c',
        protocols: ['SQL*Net'],
        encryption: 'atRest',
        dataClassification: 'Confidential'
      }
    } as SecurityNode,
    {
      id: 'data-warehouse',
      type: 'database',
      position: { x: 2610, y: 300 },
      data: {
        label: 'Data Warehouse',
        zone: 'Restricted',
        description: 'Legacy data warehouse pending cloud migration',
        vendor: 'Teradata',
        technology: 'Teradata Vantage',
        protocols: ['ODBC'],
        securityControls: ['Column Encryption', 'Row Level Security'],
        dataClassification: 'Sensitive'
      }
    } as SecurityNode
  ],
  edges: [
    // Employee access flows
    {
      id: 'e1',
      source: 'employees',
      target: 'azure-ad',
      type: 'securityEdge',
      data: {
        label: 'Cloud Authentication',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        dataClassification: 'Sensitive',
        zone: 'Cloud',
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e2',
      source: 'employees',
      target: 'vpn-gateway',
      type: 'securityEdge',
      data: {
        label: 'Legacy VPN Access',
        protocol: 'IPSec',
        encryption: 'AES-256',
        dataClassification: 'Internal',
        zone: 'DMZ',
        animated: true
      }
    } as SecurityEdge,
    // Customer flows
    {
      id: 'e3',
      source: 'customers',
      target: 'web-app',
      type: 'securityEdge',
      data: {
        label: 'Web Traffic',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        dataClassification: 'Public',
        zone: 'Cloud',
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e4',
      source: 'customers',
      target: 'legacy-web',
      type: 'securityEdge',
      data: {
        label: 'Legacy Web Access',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        dataClassification: 'Public',
        zone: 'DMZ',
        animated: true
      }
    } as SecurityEdge,
    // Cloud internal flows
    {
      id: 'e5',
      source: 'web-app',
      target: 'api-layer',
      type: 'securityEdge',
      data: {
        label: 'API Calls',
        protocol: 'REST',
        encryption: 'TLS',
        dataClassification: 'Internal',
        zone: 'Cloud',
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e6',
      source: 'api-layer',
      target: 'cloud-database',
      type: 'securityEdge',
      data: {
        label: 'Database Queries',
        protocol: 'TDS',
        encryption: 'TLS',
        dataClassification: 'Sensitive',
        zone: 'Cloud',
        animated: true
      }
    } as SecurityEdge,
    // Hybrid connectivity
    {
      id: 'e7',
      source: 'express-route',
      target: 'business-logic',
      type: 'securityEdge',
      data: {
        label: 'Private Circuit',
        protocol: 'BGP',
        encryption: 'None',
        dataClassification: 'Internal',
        zone: 'Internal',
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e8',
      source: 'data-sync',
      target: 'cloud-database',
      type: 'securityEdge',
      data: {
        label: 'Data Replication',
        protocol: 'TLS',
        encryption: 'TLS 1.3',
        dataClassification: 'Sensitive',
        zone: 'Cloud',
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e9',
      source: 'data-sync',
      target: 'compliance-db',
      type: 'securityEdge',
      data: {
        label: 'Sync to On-Prem',
        protocol: 'TLS',
        encryption: 'TLS 1.2',
        dataClassification: 'Confidential',
        zone: 'Restricted',
        animated: true
      }
    } as SecurityEdge,
    // Identity sync
    {
      id: 'e10',
      source: 'domain-controller',
      target: 'ad-connect',
      type: 'securityEdge',
      data: {
        label: 'Directory Sync',
        protocol: 'LDAPS',
        encryption: 'TLS',
        dataClassification: 'Sensitive',
        zone: 'Hybrid',
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e11',
      source: 'ad-connect',
      target: 'azure-ad',
      type: 'securityEdge',
      data: {
        label: 'Identity Sync',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        dataClassification: 'Sensitive',
        zone: 'Cloud',
        animated: true
      }
    } as SecurityEdge,
    // On-premise flows
    {
      id: 'e12',
      source: 'business-logic',
      target: 'mainframe',
      type: 'securityEdge',
      data: {
        label: 'Legacy Integration',
        protocol: 'MQ',
        encryption: 'None',
        dataClassification: 'Confidential',
        zone: 'Restricted',
        animated: false
      }
    } as SecurityEdge,
    {
      id: 'e13',
      source: 'business-logic',
      target: 'compliance-db',
      type: 'securityEdge',
      data: {
        label: 'Compliance Data',
        protocol: 'JDBC',
        encryption: 'TLS',
        dataClassification: 'Confidential',
        zone: 'Restricted',
        animated: true
      }
    } as SecurityEdge,
    // SaaS integration
    {
      id: 'e14',
      source: 'saas-vendors',
      target: 'api-layer',
      type: 'securityEdge',
      data: {
        label: 'SaaS Integration',
        protocol: 'OAuth/REST',
        encryption: 'TLS 1.3',
        dataClassification: 'Sensitive',
        zone: 'Cloud',
        animated: true
      }
    } as SecurityEdge,
    // Legacy web to internal
    {
      id: 'e15',
      source: 'legacy-web',
      target: 'business-logic',
      type: 'securityEdge',
      data: {
        label: 'Application Calls',
        protocol: 'HTTP',
        encryption: 'None',
        dataClassification: 'Internal',
        zone: 'Internal',
        animated: true
      }
    } as SecurityEdge
  ],
  attackPaths: [
    {
      id: 'ap-hc-ad-sync-poison',
      name: 'On-Prem AD → AD Connect Sync → Azure AD → Cloud App Takeover',
      strideCategory: 'Elevation of Privilege',
      riskLevel: 'Critical',
      description: 'Attacker compromises the on-premises domain controller, manipulates AD Connect synchronization to create privileged Azure AD accounts, then gains full access to cloud applications.',
      steps: [
        { order: 1, edgeId: 'e10', sourceNodeId: 'domain-controller', targetNodeId: 'ad-connect', technique: 'T1484: Domain Policy Modification' },
        { order: 2, edgeId: 'e11', sourceNodeId: 'ad-connect', targetNodeId: 'azure-ad', technique: 'T1098: Account Manipulation' },
        { order: 3, edgeId: 'e1', sourceNodeId: 'employees', targetNodeId: 'azure-ad', technique: 'T1078.004: Valid Accounts: Cloud Accounts' },
      ],
      mitreTechniques: ['T1484', 'T1098', 'T1078.004'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-hc-data-sync-intercept',
      name: 'Data Sync Service → Cloud DB / Compliance DB Data Manipulation',
      strideCategory: 'Tampering',
      riskLevel: 'High',
      description: 'Attacker compromises the data synchronization service to manipulate data flowing between the cloud database and the on-premises compliance database, potentially corrupting financial or regulatory records.',
      steps: [
        { order: 1, edgeId: 'e8', sourceNodeId: 'data-sync', targetNodeId: 'cloud-database', technique: 'T1565: Data Manipulation' },
        { order: 2, edgeId: 'e9', sourceNodeId: 'data-sync', targetNodeId: 'compliance-db', technique: 'T1565.001: Stored Data Manipulation' },
      ],
      mitreTechniques: ['T1565', 'T1565.001'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-hc-legacy-pivot',
      name: 'Legacy Web App → Business Logic → Mainframe Data Exfiltration',
      strideCategory: 'Information Disclosure',
      riskLevel: 'High',
      description: 'Attacker exploits vulnerabilities in the legacy web application to reach the business logic tier, then pivots to the mainframe to exfiltrate historical financial data.',
      steps: [
        { order: 1, edgeId: 'e4', sourceNodeId: 'customers', targetNodeId: 'legacy-web', technique: 'T1190: Exploit Public-Facing Application' },
        { order: 2, edgeId: 'e15', sourceNodeId: 'legacy-web', targetNodeId: 'business-logic', technique: 'T1021: Remote Services' },
        { order: 3, edgeId: 'e12', sourceNodeId: 'business-logic', targetNodeId: 'mainframe', technique: 'T1005: Data from Local System' },
      ],
      mitreTechniques: ['T1190', 'T1021', 'T1005'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
  ],
  grcWorkspace: buildGrcWorkspace({
    tierCatalogue: [
      { id: 'hc-t1-cyber', tier: 1 as const, label: 'Cyber Risk', description: 'Hybrid cloud security threats' },
      { id: 'hc-t1-migration', tier: 1 as const, label: 'Migration Risk', description: 'Cloud migration-specific risks' },
      { id: 'hc-t1-compliance', tier: 1 as const, label: 'Compliance Risk', description: 'Regulatory compliance during migration' },
      { id: 'hc-t2-identity', tier: 2 as const, label: 'Identity Synchronization', parentId: 'hc-t1-cyber', description: 'AD sync and hybrid identity threats' },
      { id: 'hc-t2-data-sync', tier: 2 as const, label: 'Data Synchronization', parentId: 'hc-t1-migration', description: 'Data integrity during sync' },
      { id: 'hc-t2-legacy', tier: 2 as const, label: 'Legacy System Security', parentId: 'hc-t1-cyber', description: 'Legacy application vulnerabilities' },
      { id: 'hc-t3-ad-sync', tier: 3 as const, label: 'AD Connect Compromise', parentId: 'hc-t2-identity' },
      { id: 'hc-t3-data-corrupt', tier: 3 as const, label: 'Sync Data Corruption', parentId: 'hc-t2-data-sync' },
      { id: 'hc-t3-mainframe', tier: 3 as const, label: 'Mainframe Data Leak', parentId: 'hc-t2-legacy' },
    ],
    assets: [
      { id: 'hc-asset-ad', name: 'Azure AD + AD Connect', type: 'identity_provider', owner: 'Identity Team', criticality: 5, linkedNodeIds: ['azure-ad', 'ad-connect', 'domain-controller'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'hc-asset-sync', name: 'Data Synchronization Service', type: 'integration', owner: 'Migration Team', criticality: 5, linkedNodeIds: ['data-sync'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'hc-asset-mainframe', name: 'Legacy Mainframe', type: 'mainframe', owner: 'Legacy Team', criticality: 5, linkedNodeIds: ['mainframe'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'hc-asset-compdb', name: 'Compliance Database', type: 'database', owner: 'Compliance Team', criticality: 5, linkedNodeIds: ['compliance-db'], status: 'active', createdAt: NOW, updatedAt: NOW },
    ],
    risks: [
      { id: 'hc-risk-ad', title: 'AD Connect Identity Sync Poisoning', description: 'Compromised on-prem AD could propagate malicious identities to Azure AD.', tierId: 'hc-t3-ad-sync', linkedAssetIds: ['hc-asset-ad'], likelihood: 'likelihood-2', impact: 'impact-5', currentScore: score('likelihood-2', 'impact-5'), status: 'open', owner: 'Identity Team', createdAt: NOW, updatedAt: NOW },
      { id: 'hc-risk-sync', title: 'Data Sync Integrity Compromise', description: 'Manipulation of the data sync service could corrupt cloud and compliance databases.', tierId: 'hc-t3-data-corrupt', linkedAssetIds: ['hc-asset-sync', 'hc-asset-compdb'], likelihood: 'likelihood-2', impact: 'impact-5', currentScore: score('likelihood-2', 'impact-5'), status: 'open', owner: 'Migration Team', createdAt: NOW, updatedAt: NOW },
      { id: 'hc-risk-legacy', title: 'Legacy Web App to Mainframe Pivot', description: 'Unpatched legacy web app provides a pivot point to mainframe data.', tierId: 'hc-t3-mainframe', linkedAssetIds: ['hc-asset-mainframe'], likelihood: 'likelihood-3', impact: 'impact-5', currentScore: score('likelihood-3', 'impact-5'), status: 'open', owner: 'Legacy Team', createdAt: NOW, updatedAt: NOW },
    ],
    assessments: [
      { id: 'hc-assess-1', title: 'Hybrid Cloud Migration Security Assessment', scope: 'Identity sync, data migration, and legacy systems', status: 'in_progress', createdBy: 'Security Team', createdAt: NOW, updatedAt: NOW, threatModel: { nodeFindings: [{ nodeId: 'ad-connect', findingIds: ['hc-risk-ad'] }, { nodeId: 'data-sync', findingIds: ['hc-risk-sync'] }, { nodeId: 'legacy-web', findingIds: ['hc-risk-legacy'] }], edgeFindings: [{ edgeId: 'e11', findingIds: ['hc-risk-ad'] }, { edgeId: 'e8', findingIds: ['hc-risk-sync'] }, { edgeId: 'e15', findingIds: ['hc-risk-legacy'] }] } },
    ],
    soaEntries: [
      { id: 'hc-soa-1', controlSetId: CIS_CONTROL_SET_ID, controlId: 'cis-ctrl-05', status: 'partially_implemented', justification: 'AD Connect configured but monitoring for sync anomalies not in place.', linkedRiskIds: ['hc-risk-ad'], implementationNotes: 'Add Azure AD Connect Health monitoring and alerting.', owner: 'Identity Team', createdAt: NOW, updatedAt: NOW },
      { id: 'hc-soa-2', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'ctrl-a08', status: 'not_implemented', justification: 'Data sync has no integrity verification checksums.', linkedRiskIds: ['hc-risk-sync'], implementationNotes: 'Implement cryptographic integrity checks on sync operations.', owner: 'Migration Team', createdAt: NOW, updatedAt: NOW },
      { id: 'hc-soa-3', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'ctrl-a06', status: 'not_implemented', justification: 'Legacy web app uses outdated frameworks with known vulnerabilities.', linkedRiskIds: ['hc-risk-legacy'], implementationNotes: 'Prioritize legacy web app modernization or WAF protection.', owner: 'Legacy Team', createdAt: NOW, updatedAt: NOW },
      { id: 'hc-soa-4', controlSetId: CIS_CONTROL_SET_ID, controlId: 'cis-ctrl-08', status: 'partially_implemented', justification: 'Cloud logging active but mainframe audit logs not centralized.', linkedRiskIds: ['hc-risk-legacy', 'hc-risk-ad'], implementationNotes: 'Integrate mainframe logs with cloud SIEM.', owner: 'Security Team', createdAt: NOW, updatedAt: NOW },
    ],
    thirdParties: [
      {
        id: 'hc-tp-microsoft', name: 'Microsoft Azure', description: 'Cloud platform hosting Azure AD, Azure SQL, App Service, and hybrid connectivity via ExpressRoute and AD Connect.',
        category: 'cloud_provider' as const, status: 'active' as const, riskRating: 'critical' as const, dataClassification: 'confidential' as const,
        linkedAssetIds: ['hc-asset-ad', 'hc-asset-sync', 'hc-asset-compdb'], linkedRiskIds: ['hc-risk-ad', 'hc-risk-sync'],
        contactName: 'Brian Cooper', contactEmail: 'brian.cooper@microsoft.com',
        contractExpiry: '2028-06-30T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-08-01T00:00:00.000Z',
        notes: 'Enterprise Agreement with ExpressRoute. AD Connect sync anomaly monitoring not yet configured.',
      },
      {
        id: 'hc-tp-ibm', name: 'IBM', description: 'Mainframe hardware and z/OS operating system vendor for legacy core banking workloads.',
        category: 'supplier' as const, status: 'active' as const, riskRating: 'high' as const, dataClassification: 'confidential' as const,
        linkedAssetIds: ['hc-asset-mainframe'], linkedRiskIds: ['hc-risk-legacy'],
        contactName: 'Howard Zhang', contactEmail: 'howard.zhang@ibm.com',
        contractExpiry: '2028-12-31T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-07-15T00:00:00.000Z',
        notes: 'Mainframe not planned for migration. MQ messaging uses unencrypted channels to business logic tier.',
      },
      {
        id: 'hc-tp-rackspace', name: 'Rackspace', description: 'Managed migration support services assisting with cloud migration planning and execution.',
        category: 'managed_service' as const, status: 'active' as const, riskRating: 'medium' as const, dataClassification: 'internal' as const,
        linkedAssetIds: ['hc-asset-sync'], linkedRiskIds: ['hc-risk-sync', 'hc-risk-legacy'],
        contactName: 'Sandra Phillips', contactEmail: 'sandra.phillips@rackspace.com',
        contractExpiry: '2026-12-31T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-09-01T00:00:00.000Z',
        notes: 'Temporary elevated privileges granted for migration activities. Access review scheduled quarterly.',
      },
    ],
  } as any),
};
