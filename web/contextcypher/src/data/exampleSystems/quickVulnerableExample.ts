// Quick vulnerable example system for rapid test cycles
import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityNode, SecurityEdge } from '../../types/SecurityTypes';
import { colors } from '../../styles/Theme';
import { DiagramAttackPath } from '../../types/GrcTypes';
import { buildGrcWorkspace, score, NOW, OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID } from './grcSharedBase';

// Two zones
const nodes: SecurityNode[] = [
  {
    id: 'dmz-zone',
    type: 'securityZone',
    position: { x: 770, y: 50 },
    data: {
      label: 'DMZ',
      zoneType: 'DMZ',
      description: 'Public-facing zone'
    },
    style: {
        width: 700,
        height: 1000,
        background: colors.zoneBackgrounds.DMZ,
        zIndex: -1
      }
  } as any,
  {
    id: 'internal-zone',
    type: 'securityZone',
    position: { x: 1590, y: 50 },
    data: {
      label: 'Internal',
      zoneType: 'Internal',
      description: 'Internal network zone'
    },
    style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Internal,
        zIndex: -1
      }
  } as any,
  {
    id: 'web-server',
    type: 'webServer',
    position: { x: 1075, y: 375 },
    data: {
      label: 'Web Server',
      description: 'Apache 2.2 running on Ubuntu 14.04 (web01.internal) hosted at 192.168.10.5. Admin contact: admin@acme.corp. Default credential password123',
      vendor: 'Acme Technologies',
      ipAddress: '192.168.10.5',
      zone: 'DMZ',
      // securityLevel removed - no longer part of the system model
      dataClassification: 'Public',
      protocols: ['HTTP'],
      // Intentionally weak settings
      securityControls: ['none']
    }
  } as any,
  {
    id: 'app-server',
    type: 'application',
    position: { x: 1875, y: 375 },
    data: {
      label: 'App Server',
      description: 'Legacy Java app with remote debugging enabled',
      zone: 'Internal',
      // securityLevel removed - no longer part of the system model
      dataClassification: 'Internal',
      vendor: 'Tomcat',
      version: '7.0',
      protocols: ['HTTP'],
      securityControls: ['none']
    }
  } as any,
  {
    id: 'database',
    type: 'database',
    position: { x: 1875, y: 675 },
    data: {
      label: 'MySQL DB',
      description: 'MySQL 5.5 with default root password. Host: db.internal.corp. API key api-key-98765',
      zone: 'Internal',
      // securityLevel removed - no longer part of the system model
      dataClassification: 'Confidential',
      vendor: 'Oracle',
      product: 'MySQL',
      version: '5.5',
      securityControls: ['none']
    }
  } as any
];

const edges: SecurityEdge[] = [
  {
    id: 'web-to-app',
    source: 'web-server',
    target: 'app-server',
    type: 'securityEdge',
    data: {
      label: 'HTTP',
      protocol: 'HTTP',
      encryption: 'none',
      description: 'Unencrypted traffic',
      zone: 'DMZ',
      // securityLevel removed - no longer part of the system model
      dataClassification: 'Public'
    }
  } as any,
  {
    id: 'app-to-db',
    source: 'app-server',
    target: 'database',
    type: 'securityEdge',
    data: {
      label: 'DB Connection',
      protocol: 'TCP/3306',
      encryption: 'none',
      description: 'Database credentials stored in code',
      zone: 'Internal',
      // securityLevel removed - no longer part of the system model
      dataClassification: 'Confidential'
    }
  } as any
];

const quickVulnAttackPaths: DiagramAttackPath[] = [
  {
    id: 'ap-qv-http-sqli-chain',
    name: 'Unencrypted HTTP → App Server → SQL Injection to Database',
    strideCategory: 'Tampering',
    riskLevel: 'Critical',
    description: 'Attacker intercepts unencrypted HTTP traffic between the web server and app server, injects malicious SQL via the legacy Java app with no input validation, and compromises the MySQL database using default root credentials.',
    steps: [
      { order: 1, edgeId: 'web-to-app', sourceNodeId: 'web-server', targetNodeId: 'app-server', technique: 'T1557: Adversary-in-the-Middle' },
      { order: 2, edgeId: 'app-to-db', sourceNodeId: 'app-server', targetNodeId: 'database', technique: 'T1190: Exploit Public-Facing Application (SQL Injection)' },
    ],
    mitreTechniques: ['T1557', 'T1190'],
    createdAt: '2025-06-01T00:00:00.000Z',
    updatedAt: '2025-06-01T00:00:00.000Z',
  } as DiagramAttackPath,
  {
    id: 'ap-qv-default-creds',
    name: 'Default Credentials → Direct Database Access',
    strideCategory: 'Elevation of Privilege',
    riskLevel: 'Critical',
    description: 'Attacker exploits the default MySQL root password and the unencrypted database connection to directly access confidential data, bypassing all application-level controls.',
    steps: [
      { order: 1, edgeId: 'web-to-app', sourceNodeId: 'web-server', targetNodeId: 'app-server', technique: 'T1078: Valid Accounts (Default Credentials)' },
      { order: 2, edgeId: 'app-to-db', sourceNodeId: 'app-server', targetNodeId: 'database', technique: 'T1552: Unsecured Credentials' },
    ],
    mitreTechniques: ['T1078', 'T1552'],
    createdAt: '2025-06-01T00:00:00.000Z',
    updatedAt: '2025-06-01T00:00:00.000Z',
  } as DiagramAttackPath,
];

const quickVulnGrcWorkspace = buildGrcWorkspace({
  tierCatalogue: [
    { id: 'qv-t1-cyber', tier: 1 as const, label: 'Cyber Risk', description: 'Information security threats' },
    { id: 'qv-t2-web', tier: 2 as const, label: 'Web Application Security', parentId: 'qv-t1-cyber', description: 'Threats to web tier' },
    { id: 'qv-t2-data', tier: 2 as const, label: 'Data Security', parentId: 'qv-t1-cyber', description: 'Threats to data stores' },
    { id: 'qv-t3-injection', tier: 3 as const, label: 'Injection Attacks', parentId: 'qv-t2-web' },
    { id: 'qv-t3-default-creds', tier: 3 as const, label: 'Default Credentials', parentId: 'qv-t2-data' },
  ],
  assets: [
    { id: 'qv-asset-web', name: 'Web Server (Apache 2.2)', type: 'web_server', owner: 'IT Team', criticality: 3, linkedNodeIds: ['web-server'], status: 'active', createdAt: NOW, updatedAt: NOW },
    { id: 'qv-asset-db', name: 'MySQL Database', type: 'database', owner: 'IT Team', criticality: 5, linkedNodeIds: ['database'], status: 'active', createdAt: NOW, updatedAt: NOW },
  ],
  risks: [
    { id: 'qv-risk-sqli', title: 'SQL Injection via Legacy App', description: 'No input validation on Java app allows SQL injection to MySQL.', tierId: 'qv-t3-injection', linkedAssetIds: ['qv-asset-db'], likelihood: 'likelihood-5', impact: 'impact-5', currentScore: score('likelihood-5', 'impact-5'), status: 'open', owner: 'IT Team', createdAt: NOW, updatedAt: NOW },
    { id: 'qv-risk-creds', title: 'Default Database Credentials', description: 'MySQL root password is factory default; remote root access enabled.', tierId: 'qv-t3-default-creds', linkedAssetIds: ['qv-asset-db'], likelihood: 'likelihood-5', impact: 'impact-5', currentScore: score('likelihood-5', 'impact-5'), status: 'open', owner: 'IT Team', createdAt: NOW, updatedAt: NOW },
  ],
  assessments: [
    { id: 'qv-assess-1', title: 'Quick Vuln Initial Assessment', scope: 'Full system', status: 'in_progress', createdBy: 'Security Team', createdAt: NOW, updatedAt: NOW, threatModel: { nodeFindings: [{ nodeId: 'database', findingIds: ['qv-risk-creds'] }], edgeFindings: [{ edgeId: 'web-to-app', findingIds: ['qv-risk-sqli'] }] } },
  ],
  soaEntries: [
    { id: 'qv-soa-1', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'ctrl-a03', status: 'not_implemented', justification: 'No input validation on legacy app.', linkedRiskIds: ['qv-risk-sqli'], implementationNotes: 'Requires app rewrite.', owner: 'IT Team', createdAt: NOW, updatedAt: NOW },
    { id: 'qv-soa-2', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'ctrl-a07', status: 'not_implemented', justification: 'Default credentials in use.', linkedRiskIds: ['qv-risk-creds'], implementationNotes: 'Change default passwords immediately.', owner: 'IT Team', createdAt: NOW, updatedAt: NOW },
    { id: 'qv-soa-3', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'ctrl-a02', status: 'not_implemented', justification: 'No encryption on HTTP traffic or DB connections.', linkedRiskIds: ['qv-risk-sqli', 'qv-risk-creds'], implementationNotes: 'Enable TLS for all connections.', owner: 'IT Team', createdAt: NOW, updatedAt: NOW },
  ],
  thirdParties: [
    {
      id: 'qv-tp-digitalocean',
      name: 'DigitalOcean',
      description: 'Cloud VPS provider hosting the web server and database on a single Droplet. Basic tier with no managed firewall or backup service enabled.',
      category: 'cloud_provider',
      status: 'active',
      riskRating: 'medium',
      dataClassification: 'confidential',
      linkedAssetIds: ['qv-asset-web', 'qv-asset-db'],
      linkedRiskIds: ['qv-risk-sqli', 'qv-risk-creds'],
      contactName: 'DigitalOcean Support',
      contactEmail: 'support@digitalocean.example.com',
      contractExpiry: '2026-12-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-08-15',
      notes: 'Basic Droplet with no managed database or firewall. All security responsibility falls on the tenant. No automated backups configured.'
    },
    {
      id: 'qv-tp-godaddy',
      name: 'GoDaddy',
      description: 'Domain registrar and DNS provider. Manages the primary domain and DNS records for the web application. SSL certificate also purchased through GoDaddy.',
      category: 'supplier',
      status: 'under_review',
      riskRating: 'medium',
      dataClassification: 'public',
      linkedAssetIds: ['qv-asset-web'],
      linkedRiskIds: [],
      contactName: 'GoDaddy Account Manager',
      contactEmail: 'support@godaddy.example.com',
      contractExpiry: '2026-09-15',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-06-01',
      notes: 'Under review due to past DNS hijacking incidents in the industry. MFA not enabled on the registrar account. Domain auto-renew is off.'
    },
  ],
} as any);

export const quickVulnerableExample: ExampleSystem = {
  id: 'quick-vuln-example',
  name: 'Quick Vulnerable Web App',
  description: 'Tiny 3-tier example intentionally misconfigured for rapid testing.',
  category: 'Web Applications',
  primaryZone: 'DMZ',
  dataClassification: 'Internal',
  nodes,
  edges,
  attackPaths: quickVulnAttackPaths,
  grcWorkspace: quickVulnGrcWorkspace,
  customContext: `### Known Issues (kept implicit)
  - Default root password on database
  - Remote debugging port open on App Server
  - Web server serves HTTP only
  - No WAF or firewall between tiers
  - Out-of-date software versions

  **Confidential contact**: security@technologies.local
  Internal monitoring URL: http://monitor.internal.corp:9000
  api-key-TEST12345 is hard-coded in the legacy backup script.`
}; 