// vulnerableWebApp.ts
import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityNode, SecurityEdge, SecurityZone } from '../../types/SecurityTypes';
import { DiagramAttackPath, AssessmentThreatModelNodeSourceType, AssessmentThreatModelEdgeSourceType, AttackPathRiskLevel, GrcFinding, GrcWorkspace } from '../../types/GrcTypes';
import { colors } from '../../styles/Theme';
import { buildRiskMatrix, calculateRiskScore, createDefaultConfig } from '../../services/GrcWorkspaceService';
import { StrideCategory } from '../../types/ThreatIntelTypes';
const now = '2025-01-15T10:00:00.000Z';

const likelihoodScale = [
  { id: 'likelihood-1', label: 'Rare', value: 1, description: 'Unlikely to occur' },
  { id: 'likelihood-2', label: 'Unlikely', value: 2, description: 'Could occur but not expected' },
  { id: 'likelihood-3', label: 'Possible', value: 3, description: 'Might occur at some time' },
  { id: 'likelihood-4', label: 'Likely', value: 4, description: 'Will probably occur' },
  { id: 'likelihood-5', label: 'Almost Certain', value: 5, description: 'Expected to occur' }
];

const impactScale = [
  { id: 'impact-1', label: 'Negligible', value: 1, description: 'Minor impact' },
  { id: 'impact-2', label: 'Minor', value: 2, description: 'Noticeable but contained' },
  { id: 'impact-3', label: 'Moderate', value: 3, description: 'Significant operational impact' },
  { id: 'impact-4', label: 'Major', value: 4, description: 'Serious business impact' },
  { id: 'impact-5', label: 'Critical', value: 5, description: 'Existential threat to business' }
];

const appetiteThreshold = 12;
const matrix = buildRiskMatrix(likelihoodScale, impactScale, appetiteThreshold);

const riskModel = {
  version: 'v-ecommerce-example',
  likelihoodScale,
  impactScale,
  matrix,
  appetiteThresholdScore: appetiteThreshold,
  updatedAt: now
};

function score(likelihoodId: string, impactId: string) {
  return calculateRiskScore(riskModel, likelihoodId, impactId);
}

const tierCatalogue = [
  { id: 'tier1-cyber', tier: 1 as const, label: 'Cyber Risk', description: 'Information security and cyber threats' },
  { id: 'tier2-critical-disruption', tier: 2 as const, label: 'Critical System Disruption Risk', parentId: 'tier1-cyber', description: 'Critical systems become unavailable, caused by cyber attacks or technical failures, resulting in disruption to essential services and operations.' },
  { id: 'tier2-unauthorized-access', tier: 2 as const, label: 'Unauthorized Access Risk', parentId: 'tier1-cyber', description: 'Unauthorized access to systems and data, caused by credential compromise, exploitation, or access control failures, resulting in breach of security controls.' },
  { id: 'tier2-data-breach', tier: 2 as const, label: 'Data Breach Risk', parentId: 'tier1-cyber', description: 'Sensitive or personal data is exposed, caused by technical attacks, insider threats, or process failures, resulting in regulatory, financial, and reputational harm.' },
  { id: 'tier2-system-integrity', tier: 2 as const, label: 'System Integrity Risk', parentId: 'tier1-cyber', description: 'Systems or data are maliciously modified, caused by malware, supply chain compromise, or insider actions, resulting in loss of trust in system reliability.' },
  { id: 'tier2-cyber-detection', tier: 2 as const, label: 'Cyber Detection Risk', parentId: 'tier1-cyber', description: 'Cyber incidents are not detected or contained in a timely manner, caused by insufficient monitoring, expertise, or response capability, resulting in extended impact and recovery delays.' },
  { id: 'tier2-third-party', tier: 2 as const, label: 'Third Party Security Risk', parentId: 'tier1-cyber', description: 'Security incidents originate from or are enabled by third parties, caused by supply chain compromise, vendor access, or telecommunications dependencies, resulting in cascading business impact.' },
  { id: 'tier3-unenc-traffic', tier: 3 as const, label: 'Unencrypted Internal Traffic', parentId: 'tier2-critical-disruption' },
  { id: 'tier3-fw-bypass', tier: 3 as const, label: 'Firewall Bypass Paths', parentId: 'tier2-critical-disruption' },
  { id: 'tier3-sqli', tier: 3 as const, label: 'SQL Injection', parentId: 'tier2-system-integrity' },
  { id: 'tier3-xxe', tier: 3 as const, label: 'XML External Entity', parentId: 'tier2-system-integrity' },
  { id: 'tier3-rce', tier: 3 as const, label: 'Remote Code Execution', parentId: 'tier2-system-integrity' },
  { id: 'tier3-default-creds', tier: 3 as const, label: 'Default Credentials', parentId: 'tier2-unauthorized-access' },
  { id: 'tier3-shared-accounts', tier: 3 as const, label: 'Shared Service Accounts', parentId: 'tier2-unauthorized-access' },
  { id: 'tier3-debug-exposure', tier: 3 as const, label: 'Debug Port Exposure', parentId: 'tier2-critical-disruption' },
  { id: 'tier3-log-gaps', tier: 3 as const, label: 'Logging Coverage Gaps', parentId: 'tier2-cyber-detection' },
  { id: 'tier3-public-storage', tier: 3 as const, label: 'Public Cloud Storage', parentId: 'tier2-data-breach' }
];

const assets = [
  {
    id: 'asset-web-server', name: 'Apache Web Server', type: 'web_server', owner: 'Platform Engineering',
    domain: 'application' as const, category: 'Web Application',
    businessUnit: 'Engineering',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Customer-facing Apache HTTP server with PHP',
    criticality: { confidentiality: 3, integrity: 4, availability: 5, financial: 4, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-web-app', nodeId: 'web-server', nodeLabel: 'Web Server', nodeType: 'webServer' }],
    createdAt: now, updatedAt: now
  },
  {
    id: 'asset-load-balancer', name: 'HAProxy Load Balancer', type: 'network_device', owner: 'Platform Engineering',
    domain: 'it' as const, category: 'Network Infrastructure',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Load balancer distributing traffic across application servers',
    criticality: { confidentiality: 2, integrity: 3, availability: 5, financial: 4, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-web-app', nodeId: 'load-balancer', nodeLabel: 'Load Balancer', nodeType: 'loadBalancer' }],
    createdAt: now, updatedAt: now
  },
  {
    id: 'asset-app-server-1', name: 'Application Server 1 (Tomcat)', type: 'application_server', owner: 'Development',
    domain: 'application' as const, category: 'API Service',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Primary Tomcat application server with Spring Boot',
    criticality: { confidentiality: 4, integrity: 5, availability: 5, financial: 5, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-web-app', nodeId: 'app-server-1', nodeLabel: 'App Server 1', nodeType: 'application' }],
    createdAt: now, updatedAt: now
  },
  {
    id: 'asset-app-server-2', name: 'Application Server 2 (Tomcat)', type: 'application_server', owner: 'Development',
    domain: 'application' as const, category: 'API Service',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Secondary Tomcat application server with Struts',
    criticality: { confidentiality: 4, integrity: 5, availability: 4, financial: 5, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-web-app', nodeId: 'app-server-2', nodeLabel: 'App Server 2', nodeType: 'application' }],
    createdAt: now, updatedAt: now
  },
  {
    id: 'asset-primary-db', name: 'MySQL Primary Database', type: 'database', owner: 'Database Administration',
    domain: 'application' as const, category: 'Database',
    businessUnit: 'Data Services',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Primary MySQL database storing customer data, orders, and payment information',
    criticality: { confidentiality: 5, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-web-app', nodeId: 'primary-db', nodeLabel: 'Primary Database', nodeType: 'database' }],
    createdAt: now, updatedAt: now
  },
  {
    id: 'asset-replica-db', name: 'MySQL Replica Database', type: 'database', owner: 'Database Administration',
    domain: 'application' as const, category: 'Database',
    businessCriticality: 4, securityCriticality: 5,
    description: 'Read replica for MySQL database',
    criticality: { confidentiality: 5, integrity: 4, availability: 3, financial: 3, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-web-app', nodeId: 'replica-db', nodeLabel: 'Replica Database', nodeType: 'database' }],
    createdAt: now, updatedAt: now
  },
  {
    id: 'asset-s3-storage', name: 'AWS S3 Storage', type: 'cloud_storage', owner: 'Cloud Operations',
    domain: 'it' as const, category: 'Cloud Infrastructure',
    businessUnit: 'Cloud Operations',
    businessCriticality: 3, securityCriticality: 4,
    description: 'S3 bucket for static assets and backup retention',
    criticality: { confidentiality: 4, integrity: 3, availability: 3, financial: 3, reputation: 3, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-web-app', nodeId: 'cloud-storage', nodeLabel: 'S3 Storage', nodeType: 'storage' }],
    createdAt: now, updatedAt: now
  },
  {
    id: 'asset-siem', name: 'Splunk SIEM', type: 'security_tool', owner: 'Security Operations',
    domain: 'it' as const, category: 'Security Tools',
    businessUnit: 'Security',
    businessCriticality: 4, securityCriticality: 4,
    description: 'Security Information and Event Management platform',
    criticality: { confidentiality: 3, integrity: 4, availability: 4, financial: 2, reputation: 3, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-web-app', nodeId: 'siem-server', nodeLabel: 'SIEM Server', nodeType: 'monitor' }],
    createdAt: now, updatedAt: now
  },
  {
    id: 'asset-waf', name: 'ModSecurity WAF', type: 'security_control', owner: 'Security Operations',
    domain: 'it' as const, category: 'Security Tools',
    businessCriticality: 3, securityCriticality: 3,
    description: 'Web Application Firewall in detection-only mode',
    criticality: { confidentiality: 2, integrity: 3, availability: 3, financial: 2, reputation: 3, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-web-app', nodeId: 'waf', nodeLabel: 'Web Application Firewall', nodeType: 'firewall' }],
    createdAt: now, updatedAt: now
  },
  {
    id: 'asset-ci-server', name: 'Jenkins CI/CD Server', type: 'devops_tool', owner: 'Development',
    domain: 'it' as const, category: 'Servers',
    businessCriticality: 3, securityCriticality: 4,
    description: 'Jenkins build server for CI/CD pipeline',
    criticality: { confidentiality: 3, integrity: 4, availability: 3, financial: 2, reputation: 2, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-web-app', nodeId: 'ci-server', nodeLabel: 'CI/CD Server', nodeType: 'server' }],
    createdAt: now, updatedAt: now
  }
];

const risks = [
  // --- Tier 2 strategic risks (rolled-up, no tier3/tier4) ---
  {
    id: 'risk-data-breach-strategic', title: 'Data Breach Risk',
    description: 'Sensitive or personal data is exposed, caused by technical attacks, insider threats, or process failures, resulting in regulatory, financial, and reputational harm.',
    status: 'assessed' as const, owner: 'CISO', businessUnit: 'Security',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Data Breach Risk' },
    assetIds: ['asset-primary-db', 'asset-replica-db', 'asset-s3-storage'],
    diagramLinks: [{ diagramId: 'vulnerable-web-app', nodeIds: ['primary-db', 'replica-db', 'cloud-storage'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Implement encryption at rest and in transit for all data stores; deploy DLP controls; review access policies quarterly.',
    threatActorIds: ['threat-actor-organised-crime'],
    createdAt: now, updatedAt: now
  },
  {
    id: 'risk-unauthorized-access-strategic', title: 'Unauthorized Access Risk',
    description: 'Unauthorized access to systems and data, caused by credential compromise, exploitation, or access control failures, resulting in breach of security controls.',
    status: 'assessed' as const, owner: 'CISO', businessUnit: 'Security',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Unauthorized Access Risk' },
    assetIds: ['asset-primary-db', 'asset-load-balancer', 'asset-app-server-1', 'asset-app-server-2'],
    diagramLinks: [{ diagramId: 'vulnerable-web-app', nodeIds: ['primary-db', 'load-balancer', 'app-server-1', 'app-server-2'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Enforce MFA for all administrative access; implement PAM; rotate credentials on a defined schedule.',
    createdAt: now, updatedAt: now
  },
  {
    id: 'risk-system-integrity-strategic', title: 'System Integrity Risk',
    description: 'Systems or data are maliciously modified, caused by malware, supply chain compromise, or insider actions, resulting in loss of trust in system reliability.',
    status: 'draft' as const, owner: 'CISO',
    tierPath: { tier1: 'Cyber Risk', tier2: 'System Integrity Risk' },
    assetIds: ['asset-app-server-1', 'asset-app-server-2', 'asset-waf'],
    diagramLinks: [{ diagramId: 'vulnerable-web-app', nodeIds: ['app-server-1', 'app-server-2', 'waf'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Establish SCA pipeline; sign and verify all deployments; implement file integrity monitoring.',
    threatActorIds: ['threat-actor-supply-chain'],
    createdAt: now, updatedAt: now
  },
  // --- Tier 3 scenario risks (no tier4) ---
  {
    id: 'risk-firewall-bypass', title: 'Direct Database Access Bypassing Firewall',
    description: 'Application servers have direct connections to replica database that bypass the database firewall, eliminating SQL filtering and audit controls.',
    status: 'assessed' as const, owner: 'Network Security',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Critical System Disruption Risk', tier3: 'Firewall Bypass Paths' },
    assetIds: ['asset-app-server-1', 'asset-app-server-2', 'asset-replica-db'],
    diagramLinks: [{ diagramId: 'vulnerable-web-app', nodeIds: ['app-server-1', 'app-server-2', 'replica-db'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Route all database traffic through the database firewall; remove direct replica access',
    createdAt: now, updatedAt: now
  },
  {
    id: 'risk-shared-service-account', title: 'Shared Service Account Across Application Servers',
    description: 'Both application servers use the same shared service account, preventing individual accountability and increasing blast radius of credential compromise.',
    status: 'assessed' as const, owner: 'Platform Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Unauthorized Access Risk', tier3: 'Shared Service Accounts' },
    assetIds: ['asset-app-server-1', 'asset-app-server-2'],
    diagramLinks: [{ diagramId: 'vulnerable-web-app', nodeIds: ['app-server-1', 'app-server-2'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Assign unique service accounts per application server instance',
    createdAt: now, updatedAt: now
  },
  {
    id: 'risk-unencrypted-logs', title: 'Unencrypted Log Transmission',
    description: 'Application and firewall logs are transmitted via unencrypted Syslog, allowing potential log tampering or information leakage.',
    status: 'treated' as const, owner: 'Security Operations',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Cyber Detection Risk', tier3: 'Logging Coverage Gaps' },
    assetIds: ['asset-siem', 'asset-app-server-1', 'asset-app-server-2'],
    diagramLinks: [{ diagramId: 'vulnerable-web-app', nodeIds: ['siem-server', 'app-server-1', 'app-server-2'] }],
    inherentScore: score('likelihood-3', 'impact-3'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Migrate from plain Syslog to Syslog-TLS for all log transport',
    createdAt: now, updatedAt: now
  },
  {
    id: 'risk-s3-public-read', title: 'S3 Bucket with Public Read Access',
    description: 'AWS S3 bucket has public read access enabled for product image serving, but backup data is also stored in the same bucket.',
    status: 'closed' as const, owner: 'Cloud Operations',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Data Breach Risk', tier3: 'Public Cloud Storage' },
    assetIds: ['asset-s3-storage'],
    diagramLinks: [{ diagramId: 'vulnerable-web-app', nodeIds: ['cloud-storage'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Separate backup bucket from public assets bucket; remove public-read from backup bucket',
    createdAt: now, updatedAt: now
  },
  // --- Tier 4 operational risks (from findings) ---
  {
    id: 'risk-unencrypted-db-traffic', title: 'Unencrypted Database Traffic',
    description: 'MySQL traffic between application servers and database is transmitted without encryption, enabling potential eavesdropping on sensitive customer and payment data.',
    status: 'assessed' as const, owner: 'Database Administration', businessUnit: 'Data Services',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Data Breach Risk', tier3: 'Unencrypted Internal Traffic', tier4: 'Unencrypted Database Traffic Between App and DB Tiers' },
    sourceFindingId: 'FIND-MPD-001',
    assetIds: ['asset-app-server-1', 'asset-app-server-2', 'asset-primary-db', 'asset-replica-db'],
    diagramLinks: [{ diagramId: 'vulnerable-web-app', nodeIds: ['app-server-1', 'app-server-2', 'primary-db', 'replica-db'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Enable MySQL TLS connections between application tier and database tier',
    threatActorIds: ['threat-actor-organised-crime'],
    createdAt: now, updatedAt: now
  },
  {
    id: 'risk-default-db-creds', title: 'Default Database Root Credentials',
    description: 'MySQL root account retains factory-default password for emergency access, creating a critical credential exposure risk.',
    status: 'draft' as const, owner: 'Database Administration',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Unauthorized Access Risk', tier3: 'Default Credentials', tier4: 'Default Root Credentials on MySQL Primary' },
    sourceFindingId: 'FIND-MPD-002',
    assetIds: ['asset-primary-db'],
    diagramLinks: [{ diagramId: 'vulnerable-web-app', nodeIds: ['primary-db'] }],
    inherentScore: score('likelihood-5', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Rotate root credentials and implement privileged access management',
    createdAt: now, updatedAt: now
  },
  {
    id: 'risk-waf-detection-only', title: 'WAF in Detection-Only Mode',
    description: 'ModSecurity WAF is configured in detection-only mode and does not actively block malicious requests, providing only alerting rather than prevention.',
    status: 'assessed' as const, owner: 'Security Operations',
    tierPath: { tier1: 'Cyber Risk', tier2: 'System Integrity Risk', tier3: 'SQL Injection', tier4: 'WAF Operating in Detection-Only Mode' },
    sourceFindingId: 'FIND-MWAF-001',
    assetIds: ['asset-waf', 'asset-web-server'],
    diagramLinks: [{ diagramId: 'vulnerable-web-app', nodeIds: ['waf', 'web-server'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Switch WAF to blocking mode after tuning rules to reduce false positives',
    threatActorIds: ['threat-actor-hacktivist'],
    createdAt: now, updatedAt: now
  },
  {
    id: 'risk-debug-port-exposed', title: 'Debug Port Exposed to Internet',
    description: 'Application Server 1 has development debugging port 8000 accessible from the internet via the edge router, allowing potential remote code execution.',
    status: 'draft' as const, owner: 'Development',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Critical System Disruption Risk', tier3: 'Debug Port Exposure', tier4: 'Debug Port 8000 Exposed to Internet' },
    sourceFindingId: 'FIND-AS1T-001',
    assetIds: ['asset-app-server-1'],
    diagramLinks: [{ diagramId: 'vulnerable-web-app', nodeIds: ['edge-router', 'app-server-1'] }],
    inherentScore: score('likelihood-5', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Disable debug port in production; add firewall rule to block port 8000',
    threatActorIds: ['threat-actor-opportunistic'],
    createdAt: now, updatedAt: now
  },
  {
    id: 'risk-jmx-exposed', title: 'JMX Monitoring Port Exposed',
    description: 'JMX monitoring endpoints on port 9999 are accessible from the internet without authentication, enabling remote management of the JVM.',
    status: 'draft' as const, owner: 'Platform Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Critical System Disruption Risk', tier3: 'Debug Port Exposure', tier4: 'JMX Port 9999 Exposed Without Authentication' },
    sourceFindingId: 'FIND-AS1T-002',
    assetIds: ['asset-app-server-1'],
    diagramLinks: [{ diagramId: 'vulnerable-web-app', nodeIds: ['edge-router', 'app-server-1'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Restrict JMX to management network; enable JMX authentication',
    createdAt: now, updatedAt: now
  },
  {
    id: 'risk-lb-mgmt-unauth', title: 'Load Balancer Management Interface Unauthenticated',
    description: 'HAProxy management statistics available on port 8080 without authentication, accessible from the internet.',
    status: 'assessed' as const, owner: 'Platform Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Unauthorized Access Risk', tier3: 'Default Credentials', tier4: 'HAProxy Stats Page Unauthenticated' },
    sourceFindingId: 'FIND-HLB-001',
    assetIds: ['asset-load-balancer'],
    diagramLinks: [{ diagramId: 'vulnerable-web-app', nodeIds: ['edge-router', 'load-balancer'] }],
    inherentScore: score('likelihood-4', 'impact-3'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Add authentication to stats page and restrict to management network',
    createdAt: now, updatedAt: now
  },
  {
    id: 'risk-vulnerable-components', title: 'Known Vulnerable Software Components',
    description: 'Application servers run outdated components including Log4j 2.14.0, Struts 2.5.10, and Commons Collections 3.2.1 with known critical CVEs.',
    status: 'draft' as const, owner: 'Development',
    tierPath: { tier1: 'Cyber Risk', tier2: 'System Integrity Risk', tier3: 'Remote Code Execution', tier4: 'Log4j / Struts / Commons Collections CVEs' },
    sourceFindingId: 'FIND-AS1T-003',
    assetIds: ['asset-app-server-1', 'asset-app-server-2'],
    diagramLinks: [{ diagramId: 'vulnerable-web-app', nodeIds: ['app-server-1', 'app-server-2'] }],
    inherentScore: score('likelihood-5', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Urgent patching: upgrade Log4j, Struts, and Commons Collections to latest versions',
    threatActorIds: ['threat-actor-supply-chain'],
    createdAt: now, updatedAt: now
  },
  {
    id: 'risk-s3-backup-exposure', title: 'S3 Backup Data Exposed via Public Bucket',
    description: 'Backup data co-located in the public-read S3 bucket is accessible to the internet alongside product images.',
    status: 'closed' as const, owner: 'Cloud Operations',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Data Breach Risk', tier3: 'Public Cloud Storage', tier4: 'S3 Public-Read ACL Exposes Backup Data' },
    sourceFindingId: 'FIND-S3-001',
    assetIds: ['asset-s3-storage'],
    diagramLinks: [{ diagramId: 'vulnerable-web-app', nodeIds: ['cloud-storage'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Separate backup and public asset buckets; remove public-read ACL from backup data',
    createdAt: now, updatedAt: now
  },
  {
    id: 'risk-shared-svc-acct-ops', title: 'Shared Service Account Prevents Accountability',
    description: 'Both application servers authenticate using the same shared service account, preventing individual accountability and increasing blast radius.',
    status: 'accepted' as const, owner: 'Platform Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Unauthorized Access Risk', tier3: 'Shared Service Accounts', tier4: 'Single Service Account Across App Server 1 & 2' },
    sourceFindingId: 'FIND-AS1T-004',
    assetIds: ['asset-app-server-1', 'asset-app-server-2'],
    diagramLinks: [{ diagramId: 'vulnerable-web-app', nodeIds: ['app-server-1', 'app-server-2'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Assign unique service accounts per application server instance',
    createdAt: now, updatedAt: now
  },
  {
    id: 'risk-syslog-unencrypted', title: 'Unencrypted Syslog Transit to SIEM',
    description: 'Logs transmitted via unencrypted Syslog UDP 514, allowing potential log tampering or information leakage in transit.',
    status: 'treated' as const, owner: 'Security Operations',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Cyber Detection Risk', tier3: 'Logging Coverage Gaps', tier4: 'Unencrypted Syslog UDP 514 to SIEM' },
    sourceFindingId: 'FIND-SIEM-001',
    assetIds: ['asset-siem', 'asset-app-server-1', 'asset-app-server-2'],
    diagramLinks: [{ diagramId: 'vulnerable-web-app', nodeIds: ['siem-server', 'app-server-1', 'app-server-2'] }],
    inherentScore: score('likelihood-3', 'impact-3'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Migrate from plain Syslog to Syslog-TLS for all log transport',
    createdAt: now, updatedAt: now
  },
  {
    id: 'risk-replica-direct-access', title: 'Direct Replica DB Access Bypasses Firewall',
    description: 'Application servers connect directly to replica database bypassing the database firewall, eliminating SQL filtering and audit controls.',
    status: 'assessed' as const, owner: 'Network Security',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Critical System Disruption Risk', tier3: 'Firewall Bypass Paths', tier4: 'App Servers Direct-Connect to Replica Bypassing DB Firewall' },
    sourceFindingId: 'FIND-MRD-001',
    assetIds: ['asset-app-server-1', 'asset-app-server-2', 'asset-replica-db'],
    diagramLinks: [{ diagramId: 'vulnerable-web-app', nodeIds: ['app-server-1', 'app-server-2', 'replica-db'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Route all database traffic through the database firewall; remove direct replica access paths',
    createdAt: now, updatedAt: now
  }
];

const assessments = [
  {
    id: 'assessment-initial-review', title: 'E-Commerce Platform Initial Security Assessment',
    status: 'in_review' as const,
    owner: 'Security Architecture',
    reviewer: 'CISO',
    startDate: '2025-01-05',
    dueDate: '2025-02-15',
    threatActorIds: ['threat-actor-organised-crime', 'threat-actor-hacktivist', 'threat-actor-insider', 'threat-actor-opportunistic', 'threat-actor-supply-chain'],
    methodologyNote: 'Assessment follows NIST SP 800-30 risk assessment methodology with OWASP Top 10 control mapping.',
    assumptionNote: 'Assessment assumes current production configuration as of January 2025. Staging and development environments excluded from scope.',
    scopeItems: [
      { id: 'scope-system-ecommerce', type: 'system' as const, value: 'system', name: 'E-Commerce Platform' },
      { id: 'scope-zone-dmz', type: 'diagram_segment' as const, value: 'DMZ', name: 'DMZ' },
      { id: 'scope-osi-l7', type: 'osi_layer' as const, value: 'L7 Application', name: 'L7 Application' }
    ],
    tierFilter: { tier1: 'Cyber Risk' },
    riskManagementPlan: {
      objective: 'Reduce externally exposed attack paths and improve privileged access controls.',
      strategy: 'Prioritize DMZ and application-layer risks, then implement compensating controls for residual exposure.',
      residualRiskStatement: 'Residual risk accepted only for low-priority items with active compensating controls.',
      monitoringApproach: 'Weekly review of open plan actions and monthly reassessment.',
      communicationPlan: 'Report progress to Security Steering Committee every two weeks.',
      reviewCadenceDays: 30,
      actions: [
        {
          id: 'rmp-action-close-jmx',
          title: 'Disable public JMX access and enforce authN/authZ',
          owner: 'Platform Engineering',
          dueDate: '2025-01-31',
          status: 'in_progress' as const,
          linkedRiskIds: ['risk-jmx-exposed'],
          notes: 'Network ACL update in progress'
        },
        {
          id: 'rmp-action-disable-debug',
          title: 'Disable debug port 8000 in production and add firewall block',
          owner: 'Development',
          dueDate: '2025-01-25',
          status: 'done' as const,
          linkedRiskIds: ['risk-debug-port-exposed'],
          notes: 'Firewall rule deployed and verified; port scan confirms 8000 is closed'
        },
        {
          id: 'rmp-action-rotate-db-creds',
          title: 'Rotate default MySQL root credentials and implement PAM',
          owner: 'Database Administration',
          dueDate: '2025-02-10',
          status: 'planned' as const,
          linkedRiskIds: ['risk-default-db-creds'],
          notes: 'Waiting on PAM solution procurement approval'
        },
        {
          id: 'rmp-action-enable-db-tls',
          title: 'Enable TLS for MySQL connections between app and database tiers',
          owner: 'Database Administration',
          dueDate: '2025-02-28',
          status: 'planned' as const,
          linkedRiskIds: ['risk-unencrypted-db-traffic'],
          notes: ''
        }
      ],
      updatedAt: now
    },
    riskIds: risks.map(r => r.id),
    soaGapIds: ['soa-a01', 'soa-a02', 'soa-a03'],
    taskIds: ['task-assessment-followup', 'task-evidence-a09'],
    linkedImplementedControlIds: ['ic-waf-alb', 'ic-okta-mfa', 'ic-quarterly-access-reviews', 'ic-tls-all-services', 'ic-security-awareness-training'],
    linkedInitiativeIds: ['si-auth-uplift', 'si-encryption-remediation'],
    summary: 'Initial security assessment covering all identified risks across the multi-tier e-commerce architecture. Assessment identified 11 risks, with 3 rated Critical and 4 rated High.',
    findings: 'Key findings include exposed management interfaces, unencrypted internal traffic, and weak authentication controls.',
    recommendations: 'Prioritize remediation of externally exposed management services and implement encrypted service-to-service communications.',
    evidenceSummary: 'Evidence package includes scanner output references, configuration screenshots, and remediation tracking tasks.',
    threatModel: {
      nodes: [
        { id: 'tm-node-router', label: 'Edge Router', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'edge-router', position: { x: 50, y: 150 }, nodeType: 'router' },
        { id: 'tm-node-firewall', label: 'Edge Firewall', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'edge-firewall', position: { x: 200, y: 150 }, nodeType: 'firewall' },
        { id: 'tm-node-waf', label: 'WAF', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'waf', position: { x: 350, y: 150 }, nodeType: 'firewall', commentary: 'Running in detection-only mode — does not block malicious traffic' },
        { id: 'tm-node-web', label: 'Web Server', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'web-server', position: { x: 500, y: 150 }, nodeType: 'webServer' },
        { id: 'tm-node-app1', label: 'App Server 1', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'app-server-1', position: { x: 650, y: 100 }, nodeType: 'application', commentary: 'Debug port 8000 exposed to internet' },
        { id: 'tm-node-db-fw', label: 'DB Firewall', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'db-firewall', position: { x: 800, y: 100 }, nodeType: 'firewall' },
        { id: 'tm-node-primary-db', label: 'Primary DB', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'primary-db', position: { x: 950, y: 100 }, nodeType: 'database' },
      ],
      edges: [
        { id: 'tm-edge-debug', source: 'tm-node-router', target: 'tm-node-app1', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'app1-debug-port', label: 'Debug Port (8000)', commentary: 'Unfiltered path from internet — bypasses firewall and WAF' },
        { id: 'tm-edge-app1-dbfw', source: 'tm-node-app1', target: 'tm-node-db-fw', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'app1-to-db-fw', label: 'MySQL (unencrypted)' },
        { id: 'tm-edge-dbfw-primary', source: 'tm-node-db-fw', target: 'tm-node-primary-db', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'db-fw-to-primary', label: 'Database Access' },
        { id: 'tm-edge-waf-web', source: 'tm-node-waf', target: 'tm-node-web', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'waf-to-web', label: 'Filtered Web Traffic', commentary: 'WAF detection-only; injection bypasses reach web server unblocked' },
      ],
      attackPathDescription: 'Two critical attack paths identified: (1) Internet-facing debug port grants direct RCE on App Server 1 leading to database exfiltration; (2) WAF detection-only mode allows injection attacks through to the web tier.',
      attackPaths: [
        {
          id: 'aap-debug-port-db',
          name: 'Internet-Facing Debug Port → Database Compromise',
          strideCategory: 'Elevation of Privilege' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'Attacker exploits unauthenticated Java debug port (8000) exposed to the internet, gains RCE on App Server 1, then pivots through the database firewall to exfiltrate primary database contents.',
          diagramAttackPathId: 'ap-debug-port-db',
          steps: [
            { order: 1, edgeId: 'app1-debug-port', sourceNodeId: 'edge-router', targetNodeId: 'app-server-1', technique: 'T1190: Exploit Public-Facing Application' },
            { order: 2, edgeId: 'app1-to-db-fw', sourceNodeId: 'app-server-1', targetNodeId: 'db-firewall', technique: 'T1078: Valid Accounts' },
            { order: 3, edgeId: 'db-fw-to-primary', sourceNodeId: 'db-firewall', targetNodeId: 'primary-db', technique: 'T1005: Data from Local System' },
          ],
          createdAt: now, updatedAt: now,
        },
        {
          id: 'aap-waf-bypass-web',
          name: 'WAF Detection-Only Mode → Web Application Exploitation',
          strideCategory: 'Tampering' as StrideCategory,
          riskLevel: 'High' as AttackPathRiskLevel,
          description: 'WAF operates in detection-only mode, allowing injection payloads (SQL injection, XSS, file upload) to reach the web server unblocked. PHP 7.1.2 and Tomcat 8.5.13 are unpatched.',
          diagramAttackPathId: 'ap-waf-bypass-web',
          steps: [
            { order: 1, edgeId: 'internet-to-router', sourceNodeId: 'edge-router', targetNodeId: 'edge-firewall', technique: 'T1595: Active Scanning' },
            { order: 2, edgeId: 'firewall-to-waf', sourceNodeId: 'edge-firewall', targetNodeId: 'waf', technique: 'T1190: Exploit Public-Facing Application' },
            { order: 3, edgeId: 'waf-to-web', sourceNodeId: 'waf', targetNodeId: 'web-server', technique: 'T1059: Command and Scripting Interpreter' },
          ],
          createdAt: now, updatedAt: now,
        },
      ],
      updatedAt: now,
    },
    createdAt: now, updatedAt: now
  },
  {
    id: 'assessment-db-security', title: 'Database Tier Security Review',
    status: 'draft' as const,
    owner: 'Database Administration',
    reviewer: 'Security Architecture',
    startDate: '2025-02-01',
    dueDate: '2025-03-15',
    methodologyNote: 'Focused review of database tier controls using CIS MySQL benchmarks and internal hardening standards.',
    scopeItems: [
      { id: 'scope-zone-restricted', type: 'diagram_segment' as const, value: 'Restricted', name: 'Restricted Zone' },
      { id: 'scope-asset-db', type: 'asset_group' as const, value: 'databases', name: 'Database Assets' }
    ],
    tierFilter: { tier1: 'Cyber Risk', tier2: 'Data Breach Risk' },
    riskManagementPlan: {
      objective: 'Harden database infrastructure and eliminate unencrypted data paths.',
      strategy: 'Implement encryption-in-transit, enforce credential hygiene, and eliminate firewall bypass routes.',
      reviewCadenceDays: 14,
      actions: [
        {
          id: 'rmp-action-db-encrypt',
          title: 'Configure MySQL TLS for all application connections',
          owner: 'Database Administration',
          dueDate: '2025-02-28',
          status: 'in_progress' as const,
          linkedRiskIds: ['risk-unencrypted-db-traffic'],
          notes: 'TLS certificates generated; testing on staging cluster'
        },
        {
          id: 'rmp-action-remove-bypass',
          title: 'Remove direct replica access paths and route through database firewall',
          owner: 'Network Security',
          dueDate: '2025-03-05',
          status: 'planned' as const,
          linkedRiskIds: ['risk-firewall-bypass'],
          notes: ''
        }
      ],
      updatedAt: now
    },
    riskIds: ['risk-unencrypted-db-traffic', 'risk-default-db-creds', 'risk-firewall-bypass'],
    soaGapIds: ['soa-a02'],
    taskIds: ['task-db-hardening'],
    linkedImplementedControlIds: ['ic-tls-all-services'],
    linkedInitiativeIds: ['si-encryption-remediation'],
    summary: 'Focused assessment of database tier security posture in the Restricted zone.',
    findings: '',
    recommendations: '',
    threatModel: {
      nodes: [
        { id: 'db-tm-node-lb', label: 'Load Balancer', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'load-balancer', position: { x: 50, y: 150 }, nodeType: 'loadBalancer' },
        { id: 'db-tm-node-app2', label: 'App Server 2', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'app-server-2', position: { x: 250, y: 150 }, nodeType: 'application', commentary: 'Direct connection to replica bypasses DB firewall' },
        { id: 'db-tm-node-replica', label: 'Replica DB', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'replica-db', position: { x: 450, y: 150 }, nodeType: 'database', commentary: 'Accessible directly from app tier — firewall bypass route active' },
        { id: 'db-tm-node-primary', label: 'Primary DB', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'primary-db', position: { x: 450, y: 300 }, nodeType: 'database' },
      ],
      edges: [
        { id: 'db-tm-edge-lb-app2', source: 'db-tm-node-lb', target: 'db-tm-node-app2', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'lb-to-app2-direct', label: 'Direct (bypasses internal firewall)', commentary: 'Unencrypted; bypasses internal network firewall' },
        { id: 'db-tm-edge-app2-replica', source: 'db-tm-node-app2', target: 'db-tm-node-replica', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'app2-to-replica-direct', label: 'Direct replica access', commentary: 'Bypasses DB firewall; no encryption in transit' },
      ],
      attackPathDescription: 'The database firewall can be bypassed by exploiting the direct load-balancer-to-app-server-2 connection followed by the uncontrolled app-server-2-to-replica path. Default MySQL credentials further reduce the effort required.',
      attackPaths: [
        {
          id: 'aap-firewall-bypass-replica',
          name: 'Internal Firewall Bypass → Replica Database Exfiltration',
          strideCategory: 'Information Disclosure' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'An attacker with access to the DMZ (e.g., via a compromised load balancer management interface) can reach the replica database by traversing two unencrypted, firewall-bypassing connections. MySQL credentials are default and easily brute-forced.',
          diagramAttackPathId: 'ap-firewall-bypass-replica',
          steps: [
            { order: 1, edgeId: 'lb-to-app2-direct', sourceNodeId: 'load-balancer', targetNodeId: 'app-server-2', technique: 'T1071: Application Layer Protocol' },
            { order: 2, edgeId: 'app2-to-replica-direct', sourceNodeId: 'app-server-2', targetNodeId: 'replica-db', technique: 'T1041: Exfiltration Over Command and Control Channel' },
          ],
          createdAt: now, updatedAt: now,
        },
      ],
      updatedAt: now,
    },
    createdAt: now, updatedAt: now
  }
];

const controlSetId = 'cs-owasp-top10-mapped';
const controls = [
  { id: 'ctrl-a01', controlId: 'A01', title: 'Broken Access Control', family: 'OWASP Top 10 2021' },
  { id: 'ctrl-a02', controlId: 'A02', title: 'Cryptographic Failures', family: 'OWASP Top 10 2021' },
  { id: 'ctrl-a03', controlId: 'A03', title: 'Injection', family: 'OWASP Top 10 2021' },
  { id: 'ctrl-a04', controlId: 'A04', title: 'Insecure Design', family: 'OWASP Top 10 2021' },
  { id: 'ctrl-a05', controlId: 'A05', title: 'Security Misconfiguration', family: 'OWASP Top 10 2021' },
  { id: 'ctrl-a06', controlId: 'A06', title: 'Vulnerable and Outdated Components', family: 'OWASP Top 10 2021' },
  { id: 'ctrl-a07', controlId: 'A07', title: 'Identification and Authentication Failures', family: 'OWASP Top 10 2021' },
  { id: 'ctrl-a08', controlId: 'A08', title: 'Software and Data Integrity Failures', family: 'OWASP Top 10 2021' },
  { id: 'ctrl-a09', controlId: 'A09', title: 'Security Logging and Monitoring Failures', family: 'OWASP Top 10 2021' },
  { id: 'ctrl-a10', controlId: 'A10', title: 'Server-Side Request Forgery', family: 'OWASP Top 10 2021' }
];

const cisControlSetId = 'cs-cis-controls-v8';
const cisControls = [
  { id: 'cis-ctrl-01', controlId: 'CIS.01', title: 'Inventory and Control of Enterprise Assets', family: 'CIS Controls v8' },
  { id: 'cis-ctrl-02', controlId: 'CIS.02', title: 'Inventory and Control of Software Assets', family: 'CIS Controls v8' },
  { id: 'cis-ctrl-03', controlId: 'CIS.03', title: 'Data Protection', family: 'CIS Controls v8' },
  { id: 'cis-ctrl-04', controlId: 'CIS.04', title: 'Secure Configuration of Enterprise Assets and Software', family: 'CIS Controls v8' },
  { id: 'cis-ctrl-05', controlId: 'CIS.05', title: 'Account Management', family: 'CIS Controls v8' },
  { id: 'cis-ctrl-06', controlId: 'CIS.06', title: 'Access Control Management', family: 'CIS Controls v8' },
  { id: 'cis-ctrl-07', controlId: 'CIS.07', title: 'Continuous Vulnerability Management', family: 'CIS Controls v8' },
  { id: 'cis-ctrl-08', controlId: 'CIS.08', title: 'Audit Log Management', family: 'CIS Controls v8' }
];

const controlSets = [
  {
    id: controlSetId, name: 'OWASP Top 10 (2021)', version: '2021',
    sourceType: 'built_in' as const, importedAt: now, controls
  },
  {
    id: cisControlSetId, name: 'CIS Controls v8 (Subset)', version: '8.0',
    sourceType: 'imported' as const, importedAt: now, controls: cisControls
  }
];

const soaEntries = [
  {
    id: 'soa-a01', controlSetId, controlId: 'A01', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    weight: 8, importance: 'mandatory' as const,
    justification: 'Access control enforced at application layer but management interfaces lack authentication (HAProxy stats, JMX).',
    mitigatesRiskIds: ['risk-lb-mgmt-unauth', 'risk-jmx-exposed'],
    diagramRefs: [], evidence: [], updatedAt: now
  },
  {
    id: 'soa-a02', controlSetId, controlId: 'A02', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    weight: 9, importance: 'mandatory' as const,
    justification: 'Internal traffic between application and database tiers is unencrypted. SSL termination at load balancer but no re-encryption.',
    mitigatesRiskIds: ['risk-unencrypted-db-traffic'],
    diagramRefs: [], evidence: [], updatedAt: now
  },
  {
    id: 'soa-a03', controlSetId, controlId: 'A03', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'implemented' as const,
    weight: 7, importance: 'mandatory' as const,
    justification: 'WAF deployed but in detection-only mode. XML entity processing enabled on supplier feeds creates XXE risk.',
    mitigatesRiskIds: ['risk-waf-detection-only'],
    diagramRefs: [],
    evidence: [
      {
        id: 'evidence-a03-waf-policy',
        kind: 'link' as const,
        name: 'WAF rule coverage report',
        url: 'https://security.example.local/reports/waf-coverage',
        note: 'Quarterly review export',
        createdAt: now
      }
    ],
    updatedAt: now
  },
  {
    id: 'soa-a04', controlSetId, controlId: 'A04', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'planned' as const,
    justification: 'Architecture review planned. Direct database bypass paths and shared service accounts indicate design-level security gaps.',
    mitigatesRiskIds: ['risk-firewall-bypass', 'risk-shared-service-account'],
    diagramRefs: [], evidence: [], updatedAt: now
  },
  {
    id: 'soa-a05', controlSetId, controlId: 'A05', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    weight: 10, importance: 'mandatory' as const,
    justification: 'Multiple misconfiguration issues: debug ports exposed, JMX unauthenticated, CORS allow-all, default database credentials.',
    mitigatesRiskIds: ['risk-debug-port-exposed', 'risk-jmx-exposed', 'risk-default-db-creds'],
    diagramRefs: [], evidence: [], updatedAt: now
  },
  {
    id: 'soa-a06', controlSetId, controlId: 'A06', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    weight: 10, importance: 'mandatory' as const,
    justification: 'Critical: Log4j 2.14.0, Struts 2.5.10, Commons Collections 3.2.1, Java 7u80 all have known CVEs. Monthly patching cadence is insufficient.',
    mitigatesRiskIds: ['risk-vulnerable-components'],
    diagramRefs: [], evidence: [], updatedAt: now
  },
  {
    id: 'soa-a07', controlSetId, controlId: 'A07', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'VPN gateway has 2FA. However, database root uses default password, and service accounts are shared across servers.',
    mitigatesRiskIds: ['risk-default-db-creds', 'risk-shared-service-account'],
    diagramRefs: [], evidence: [], updatedAt: now
  },
  {
    id: 'soa-a08', controlSetId, controlId: 'A08', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'planned' as const,
    weight: 5, importance: 'recommended' as const,
    justification: 'CI/CD pipeline lacks artifact signing. Code scanner deployed but no SBOM generation or supply chain verification.',
    mitigatesRiskIds: [],
    diagramRefs: [], evidence: [], updatedAt: now
  },
  {
    id: 'soa-a09', controlSetId, controlId: 'A09', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'implemented' as const,
    justification: 'SIEM deployed with 30-day retention. However, logs are transmitted unencrypted via Syslog, and IDS thresholds are set high to reduce noise.',
    mitigatesRiskIds: ['risk-unencrypted-logs'],
    diagramRefs: [], evidence: [], updatedAt: now
  },
  {
    id: 'soa-a10', controlSetId, controlId: 'A10', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    weight: 4, importance: 'optional' as const,
    justification: 'No SSRF controls in place. XML external entity processing enabled on application servers.',
    mitigatesRiskIds: [],
    diagramRefs: [], evidence: [], updatedAt: now
  },
  {
    id: 'soa-cis-01', controlSetId: cisControlSetId, controlId: 'CIS.01', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'implemented' as const,
    justification: 'Asset inventory maintained via GRC module synced from architecture diagrams.',
    mitigatesRiskIds: [], diagramRefs: [], evidence: [], updatedAt: now
  },
  {
    id: 'soa-cis-02', controlSetId: cisControlSetId, controlId: 'CIS.02', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Software components tracked in application server nodes but no automated SBOM generation.',
    mitigatesRiskIds: ['risk-vulnerable-components'], diagramRefs: [], evidence: [], updatedAt: now
  },
  {
    id: 'soa-cis-03', controlSetId: cisControlSetId, controlId: 'CIS.03', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    weight: 9, importance: 'mandatory' as const,
    justification: 'Unencrypted database traffic and public S3 access represent gaps.',
    mitigatesRiskIds: ['risk-unencrypted-db-traffic', 'risk-s3-public-read'], diagramRefs: [], evidence: [], updatedAt: now
  },
  {
    id: 'soa-cis-04', controlSetId: cisControlSetId, controlId: 'CIS.04', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Debug ports exposed, WAF in detection-only mode, and default credentials indicate weak hardening.',
    mitigatesRiskIds: ['risk-debug-port-exposed', 'risk-jmx-exposed', 'risk-default-db-creds'], diagramRefs: [], evidence: [], updatedAt: now
  },
  {
    id: 'soa-cis-05', controlSetId: cisControlSetId, controlId: 'CIS.05', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'VPN gateway enforces 2FA; database and service accounts need rotation and separation.',
    mitigatesRiskIds: ['risk-default-db-creds', 'risk-shared-service-account'], diagramRefs: [], evidence: [], updatedAt: now
  },
  {
    id: 'soa-cis-06', controlSetId: cisControlSetId, controlId: 'CIS.06', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'planned' as const,
    justification: 'RBAC planned for management interfaces. HAProxy stats page and JMX currently unauthenticated.',
    mitigatesRiskIds: ['risk-lb-mgmt-unauth', 'risk-jmx-exposed'], diagramRefs: [], evidence: [], updatedAt: now
  },
  {
    id: 'soa-cis-07', controlSetId: cisControlSetId, controlId: 'CIS.07', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Monthly vulnerability scanning in place but patching cadence is insufficient for critical CVEs.',
    mitigatesRiskIds: ['risk-vulnerable-components'],
    diagramRefs: [],
    evidence: [
      { id: 'evidence-cis07-scan', kind: 'link' as const, name: 'January 2025 Vulnerability Scan Report',
        url: 'https://security.example.local/reports/vuln-scan-2025-01', note: 'Monthly Nessus scan output', createdAt: now }
    ],
    updatedAt: now
  },
  {
    id: 'soa-cis-08', controlSetId: cisControlSetId, controlId: 'CIS.08', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'implemented' as const,
    justification: 'SIEM with 30-day retention. Log encryption in transit being addressed.',
    mitigatesRiskIds: ['risk-unencrypted-logs'], diagramRefs: [],
    evidence: [
      { id: 'evidence-cis08-siem', kind: 'link' as const, name: 'SIEM Configuration Baseline',
        url: 'https://security.example.local/docs/siem-baseline', note: 'Splunk config and retention policy', createdAt: now }
    ],
    updatedAt: now
  },
  {
    id: 'soa-diagram-a05', controlSetId, controlId: 'A05', scopeType: 'diagram' as const, scopeId: 'active-diagram',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Diagram-scoped hardening in progress for exposed debug paths.',
    mitigatesRiskIds: ['risk-debug-port-exposed', 'risk-jmx-exposed'],
    diagramRefs: [
      { diagramId: 'active-diagram', nodeId: 'app-server-1', nodeLabel: 'App Server 1', nodeType: 'application' }
    ],
    evidence: [],
    updatedAt: now
  }
];

const workflowTasks = [
  {
    id: 'task-risk-default-creds',
    title: 'Rotate default DB credentials and enforce PAM',
    description: 'Critical risk treatment for root credential exposure.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'critical' as const,
    owner: 'Database Administration',
    dueDate: '2025-01-31',
    riskId: 'risk-default-db-creds',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'task-evidence-a09',
    title: 'Attach SIEM log pipeline evidence for A09',
    description: 'Control marked implemented but missing evidence references.',
    type: 'evidence' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Security Operations',
    dueDate: '2025-02-05',
    controlSetId,
    controlId: 'A09',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'task-assessment-followup',
    title: 'Finalize remediation assessment for exposed ports',
    type: 'assessment' as const,
    status: 'blocked' as const,
    priority: 'medium' as const,
    owner: 'Security Architecture',
    dueDate: '2025-02-10',
    assessmentId: 'assessment-initial-review',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'task-review-s3',
    title: 'Review S3 bucket segregation control effectiveness',
    type: 'review' as const,
    status: 'done' as const,
    priority: 'medium' as const,
    owner: 'Cloud Operations',
    dueDate: '2025-01-20',
    riskId: 'risk-s3-public-read',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'task-patch-log4j',
    title: 'Upgrade Log4j to 2.21+ on both application servers',
    description: 'Critical CVE remediation for Log4Shell and related vulnerabilities.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'critical' as const,
    owner: 'Development',
    dueDate: '2025-01-22',
    riskId: 'risk-vulnerable-components',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'task-db-hardening',
    title: 'Apply CIS MySQL benchmark hardening to primary and replica',
    description: 'Harden database configuration per CIS Controls v8 benchmarks.',
    type: 'control_implementation' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Database Administration',
    dueDate: '2025-02-28',
    assessmentId: 'assessment-db-security',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'task-waf-tuning',
    title: 'Tune WAF rules and switch from detection to blocking mode',
    description: 'Analyse current false positive rate and enable blocking for validated rules.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Security Operations',
    dueDate: '2025-02-15',
    riskId: 'risk-waf-detection-only',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'task-evidence-cis04',
    title: 'Collect hardening evidence for CIS.04 Secure Configuration',
    description: 'Screenshot or export current server configurations to demonstrate hardening status.',
    type: 'evidence' as const,
    status: 'blocked' as const,
    priority: 'medium' as const,
    owner: 'Platform Engineering',
    dueDate: '2025-02-20',
    controlSetId: cisControlSetId,
    controlId: 'CIS.04',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'task-quarterly-access-review',
    title: 'Quarterly access review for production service accounts',
    description: 'Review all production service accounts, remove unnecessary access, and verify unique credentials per server.',
    type: 'review' as const,
    status: 'todo' as const,
    priority: 'low' as const,
    owner: 'Identity & Access Management',
    dueDate: '2025-03-31',
    riskId: 'risk-shared-service-account',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'task-siem-tls-migration',
    title: 'Migrate syslog transport to TLS-encrypted channels',
    description: 'Replace plain syslog with syslog-TLS on all log sources feeding into Splunk SIEM.',
    type: 'risk_treatment' as const,
    status: 'done' as const,
    priority: 'medium' as const,
    owner: 'Security Operations',
    dueDate: '2025-01-15',
    riskId: 'risk-unencrypted-logs',
    createdAt: now,
    updatedAt: now
  }
];

const governanceDocuments = [
  {
    id: 'gov-info-security-policy',
    title: 'Information Security Policy',
    type: 'policy' as const,
    description: 'Corporate information security policy defining roles, responsibilities, and high-level requirements for safeguarding company data and systems.',
    owner: 'CISO',
    status: 'active' as const,
    reviewedBy: 'VP Engineering',
    approvedBy: 'CTO',
    approvalDate: '2024-10-15',
    version: '3.1',
    url: 'https://sharepoint.example.com/policies/infosec-policy-v3.1.pdf',
    reviewDate: '2024-11-01',
    nextReviewDate: '2025-11-01',
    tags: ['security', 'corporate'],
    linkedRiskIds: [],
    linkedControlSetIds: [controlSetId],
    linkedAssessmentIds: ['assessment-initial-review'],
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'gov-incident-response-proc',
    title: 'Incident Response Procedure',
    type: 'procedure' as const,
    description: 'Step-by-step procedures for identifying, containing, eradicating, and recovering from security incidents.',
    owner: 'Security Operations',
    status: 'active' as const,
    reviewedBy: 'SOC Lead',
    approvedBy: 'CISO',
    approvalDate: '2025-01-05',
    version: '2.0',
    url: 'https://sharepoint.example.com/procedures/incident-response-v2.pdf',
    reviewDate: '2025-01-10',
    nextReviewDate: '2025-07-10',
    tags: ['incident', 'response', 'soc'],
    linkedRiskIds: ['risk-vulnerable-components', 'risk-debug-port-exposed'],
    linkedControlSetIds: [],
    linkedAssessmentIds: [],
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'gov-patching-sop',
    title: 'Vulnerability & Patch Management SOP',
    type: 'sop' as const,
    description: 'Standard operating procedure for identifying, prioritising, testing, and deploying security patches across the application and infrastructure stack.',
    owner: 'Platform Engineering',
    status: 'under_review' as const,
    version: '1.4',
    url: 'https://sharepoint.example.com/sops/patch-management-sop-v1.4.docx',
    reviewDate: '2024-12-15',
    nextReviewDate: '2025-06-15',
    tags: ['patching', 'vulnerability'],
    linkedRiskIds: ['risk-vulnerable-components'],
    linkedControlSetIds: [controlSetId],
    linkedAssessmentIds: [],
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'gov-access-control-guideline',
    title: 'Access Control & Privileged Account Guideline',
    type: 'guideline' as const,
    description: 'Guidelines for managing user access, service accounts, and privileged credentials across all environments.',
    owner: 'Identity & Access Management',
    status: 'active' as const,
    version: '1.2',
    url: 'https://sharepoint.example.com/guidelines/access-control-v1.2.pdf',
    tags: ['access', 'identity', 'pam'],
    linkedRiskIds: ['risk-default-db-creds', 'risk-shared-service-account', 'risk-lb-mgmt-unauth'],
    linkedControlSetIds: [controlSetId],
    linkedAssessmentIds: ['assessment-initial-review'],
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'gov-data-classification-standard',
    title: 'Data Classification Standard',
    type: 'standard' as const,
    description: 'Defines data classification levels (Public, Internal, Sensitive, Confidential) and handling requirements for each tier.',
    owner: 'Information Governance',
    status: 'active' as const,
    version: '2.0',
    url: 'https://sharepoint.example.com/standards/data-classification-v2.0.pdf',
    reviewDate: '2024-09-01',
    nextReviewDate: '2025-09-01',
    tags: ['data', 'classification', 'handling'],
    linkedRiskIds: ['risk-s3-public-read', 'risk-unencrypted-db-traffic'],
    linkedControlSetIds: [controlSetId, cisControlSetId],
    linkedAssessmentIds: [],
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'gov-risk-management-framework',
    title: 'Enterprise Risk Management Framework',
    type: 'framework' as const,
    description: 'Overarching risk management framework defining risk appetite, assessment methodology, treatment strategies, and reporting cadence.',
    owner: 'CISO',
    status: 'active' as const,
    reviewedBy: 'Board Risk Committee',
    approvedBy: 'CEO',
    approvalDate: '2024-06-10',
    version: '1.0',
    url: 'https://sharepoint.example.com/frameworks/erm-framework-v1.0.pdf',
    reviewDate: '2024-06-15',
    nextReviewDate: '2025-06-15',
    tags: ['risk', 'framework', 'governance'],
    linkedRiskIds: [],
    linkedControlSetIds: [],
    linkedAssessmentIds: ['assessment-initial-review', 'assessment-db-security'],
    createdAt: now,
    updatedAt: now
  }
];

const threatActors = [
  {
    id: 'threat-actor-organised-crime', name: 'Eastern European Cybercrime Syndicate',
    type: 'organised_crime' as const, capabilityLevel: 4,
    resourceLevel: 'high' as const,
    motivation: 'Financial gain through payment card data theft, credential harvesting, and ransomware deployment.',
    description: 'Well-funded organised crime group specialising in e-commerce platform attacks. Known to exploit unencrypted database traffic and weak credentials.',
    targetedAssetIds: ['asset-primary-db', 'asset-replica-db', 'asset-app-server-1', 'asset-app-server-2'],
    tags: ['financially-motivated', 'persistent', 'card-data'],
    createdAt: now, updatedAt: now
  },
  {
    id: 'threat-actor-hacktivist', name: 'DataFreedom Collective',
    type: 'hacktivist' as const, capabilityLevel: 2,
    resourceLevel: 'low' as const,
    motivation: 'Ideological opposition to corporate data collection practices; seeks public embarrassment through defacement and data leaks.',
    description: 'Loosely organised hacktivist group that targets customer-facing web applications. Relies on known exploits and publicly available tools.',
    targetedAssetIds: ['asset-web-server', 'asset-waf'],
    tags: ['ideological', 'defacement', 'public-disclosure'],
    createdAt: now, updatedAt: now
  },
  {
    id: 'threat-actor-insider', name: 'Disgruntled Employee',
    type: 'insider' as const, capabilityLevel: 3,
    resourceLevel: 'moderate' as const,
    motivation: 'Personal grievance or financial incentive to exfiltrate proprietary data or sabotage operations.',
    description: 'Current or recently departed employee with legitimate access to internal systems and knowledge of shared service accounts.',
    targetedAssetIds: ['asset-app-server-1', 'asset-app-server-2', 'asset-primary-db', 'asset-siem'],
    tags: ['insider-threat', 'privileged-access', 'data-exfiltration'],
    createdAt: now, updatedAt: now
  },
  {
    id: 'threat-actor-opportunistic', name: 'Automated Scanners & Script Kiddies',
    type: 'opportunistic' as const, capabilityLevel: 1,
    resourceLevel: 'very_low' as const,
    motivation: 'Low-effort exploitation of misconfigured services and exposed management ports for bragging rights or botnet recruitment.',
    description: 'Automated internet scanners and low-skill attackers looking for easy targets such as exposed debug ports, management consoles, and default credentials.',
    targetedAssetIds: ['asset-app-server-1', 'asset-load-balancer', 'asset-edge-router'],
    tags: ['automated', 'mass-scanning', 'low-skill'],
    createdAt: now, updatedAt: now
  },
  {
    id: 'threat-actor-supply-chain', name: 'Compromised Software Vendor',
    type: 'supply_chain' as const, capabilityLevel: 5,
    resourceLevel: 'very_high' as const,
    motivation: 'State-sponsored or criminal compromise of upstream software supply chain to gain persistent access to downstream consumers.',
    description: 'Threat actor operating through compromised third-party libraries such as Log4j, Struts, or Commons Collections. Exploits trust in software updates and dependencies.',
    targetedAssetIds: ['asset-app-server-1', 'asset-app-server-2'],
    tags: ['supply-chain', 'advanced', 'persistent'],
    createdAt: now, updatedAt: now
  }
];

const threatScenarios = [
  {
    id: 'scenario-payment-exfil', title: 'Payment Data Exfiltration via Unencrypted DB Traffic',
    description: 'Organised crime group intercepts unencrypted MySQL traffic between the application tier and database tier to harvest payment card data in transit.',
    threatActorId: 'threat-actor-organised-crime',
    targetedAssetIds: ['asset-primary-db', 'asset-replica-db', 'asset-app-server-1'],
    attackTechniques: ['T1040 - Network Sniffing', 'T1557 - Adversary-in-the-Middle', 'T1005 - Data from Local System'],
    linkedRiskIds: ['risk-unencrypted-db-traffic', 'risk-default-db-creds'],
    likelihood: 'High — unencrypted traffic provides direct interception opportunity for actors with network access.',
    impact: 'Critical — payment card data breach triggers PCI-DSS notification, regulatory fines, and reputational harm.',
    createdAt: now, updatedAt: now
  },
  {
    id: 'scenario-web-defacement', title: 'Web Application Defacement via WAF Bypass',
    description: 'Hacktivist group exploits the detection-only WAF configuration to inject content into the public-facing web server, defacing the storefront.',
    threatActorId: 'threat-actor-hacktivist',
    targetedAssetIds: ['asset-web-server', 'asset-waf'],
    attackTechniques: ['T1190 - Exploit Public-Facing Application', 'T1059.007 - JavaScript', 'T1491.002 - External Defacement'],
    linkedRiskIds: ['risk-waf-detection-only'],
    likelihood: 'Moderate — WAF in detection-only mode reduces barrier but attacker capability is limited.',
    impact: 'Major — public defacement causes immediate brand damage and customer trust erosion.',
    createdAt: now, updatedAt: now
  },
  {
    id: 'scenario-debug-rce', title: 'Remote Code Execution via Exposed Debug Port',
    description: 'Opportunistic scanner discovers the exposed debug port on Application Server 1 and achieves remote code execution through the debugging interface.',
    threatActorId: 'threat-actor-opportunistic',
    targetedAssetIds: ['asset-app-server-1'],
    attackTechniques: ['T1046 - Network Service Discovery', 'T1203 - Exploitation for Client Execution', 'T1059 - Command and Scripting Interpreter'],
    linkedRiskIds: ['risk-debug-port-exposed', 'risk-jmx-exposed'],
    likelihood: 'High — exposed port is trivially discoverable by internet-wide scans.',
    impact: 'Critical — RCE on the application server grants access to application data and pivot to database tier.',
    createdAt: now, updatedAt: now
  },
  {
    id: 'scenario-supply-chain-exploit', title: 'Supply Chain Component Exploitation (Log4Shell / Struts RCE)',
    description: 'Threat actor leverages known critical vulnerabilities in outdated third-party components (Log4j 2.14.0, Struts 2.5.10) to achieve remote code execution across application servers.',
    threatActorId: 'threat-actor-supply-chain',
    targetedAssetIds: ['asset-app-server-1', 'asset-app-server-2'],
    attackTechniques: ['T1195.002 - Compromise Software Supply Chain', 'T1190 - Exploit Public-Facing Application', 'T1059 - Command and Scripting Interpreter'],
    linkedRiskIds: ['risk-vulnerable-components'],
    likelihood: 'Very High — public exploits are widely available and actively exploited in the wild.',
    impact: 'Critical — full server compromise with potential lateral movement to database and monitoring infrastructure.',
    createdAt: now, updatedAt: now
  }
];

const appetiteRules = [
  {
    id: 'appetite-mission-critical', name: 'Mission-Critical Assets',
    description: 'Lower appetite threshold for risks affecting assets with maximum business criticality.',
    scopeAssetCriticalityMin: 5,
    thresholdScore: 8,
    createdAt: now, updatedAt: now
  },
  {
    id: 'appetite-cyber-tier', name: 'Cyber Risk Tier',
    description: 'Reduced appetite for all risks classified under the Cyber Risk tier.',
    scopeTier1: 'Cyber Risk',
    thresholdScore: 10,
    createdAt: now, updatedAt: now
  },
  {
    id: 'appetite-ot-domain', name: 'OT Domain',
    description: 'Strict appetite threshold for operational technology assets due to safety implications.',
    scopeAssetDomain: 'ot' as const,
    thresholdScore: 6,
    createdAt: now, updatedAt: now
  },
  {
    id: 'appetite-app-data-protection', name: 'Application Data Protection',
    description: 'Tighter appetite for application-domain risks in the Cyber Risk tier, covering data-in-transit and data-at-rest scenarios.',
    scopeAssetDomain: 'application' as const,
    scopeTier1: 'Cyber Risk',
    thresholdScore: 9,
    createdAt: now, updatedAt: now
  }
];

const findings: GrcFinding[] = [
  {
    id: 'FIND-MPD-001',
    title: 'Unencrypted Database Traffic Between App and DB Tiers',
    description: 'MySQL replication and client traffic between application servers and database servers is transmitted in plaintext, allowing potential eavesdropping on sensitive customer and payment data.',
    type: 'vulnerability',
    severity: 'critical',
    source: 'manual',
    status: 'open',
    remediationStatus: 'remediation_planned' as const,
    cvssScore: 8.1,
    strideCategories: ['Information Disclosure'] as StrideCategory[],
    relatedNodeIds: ['app-server-1', 'app-server-2', 'primary-db', 'replica-db'],
    relatedEdgeIds: [],
    linkedRiskIds: ['risk-unencrypted-db-traffic'],
    linkedTaskIds: [],
    linkedAssetIds: ['asset-primary-db', 'asset-app-server-1', 'asset-app-server-2', 'asset-replica-db'],
    recommendations: ['Enable MySQL TLS for all client connections', 'Configure TLS for replication traffic', 'Implement certificate rotation'],
    owner: 'Database Administration',
    createdAt: now, updatedAt: now
  },
  {
    id: 'FIND-MPD-002',
    title: 'Default Root Credentials on MySQL Primary',
    description: 'MySQL root account retains factory-default password. Emergency access procedures rely on this default credential, creating a critical exposure.',
    type: 'vulnerability',
    severity: 'critical',
    source: 'manual',
    status: 'open',
    remediationStatus: 'confirmed' as const,
    cvssScore: 9.8,
    strideCategories: ['Spoofing', 'Elevation of Privilege'] as StrideCategory[],
    relatedNodeIds: ['primary-db'],
    relatedEdgeIds: [],
    linkedRiskIds: ['risk-default-db-creds'],
    linkedTaskIds: [],
    linkedAssetIds: ['asset-primary-db'],
    recommendations: ['Rotate root credentials immediately', 'Implement privileged access management', 'Create dedicated break-glass accounts'],
    owner: 'Database Administration',
    createdAt: now, updatedAt: now
  },
  {
    id: 'FIND-MWAF-001',
    title: 'WAF Operating in Detection-Only Mode',
    description: 'ModSecurity WAF is configured in detection-only mode (SecRuleEngine DetectionOnly) and does not actively block malicious requests, providing alerting only.',
    type: 'weakness',
    severity: 'high',
    source: 'manual',
    status: 'in_review',
    strideCategories: ['Tampering', 'Denial of Service'] as StrideCategory[],
    relatedNodeIds: ['waf', 'web-server'],
    relatedEdgeIds: [],
    linkedRiskIds: ['risk-waf-detection-only'],
    linkedTaskIds: [],
    linkedAssetIds: ['asset-waf', 'asset-web-server'],
    recommendations: ['Switch WAF to blocking mode', 'Tune rules to reduce false positives before enabling blocking', 'Implement staged rollout of blocking rules'],
    owner: 'Security Operations',
    createdAt: now, updatedAt: now
  },
  {
    id: 'FIND-AS1T-001',
    title: 'Debug Port 8000 Exposed to Internet',
    description: 'Application Server 1 has development debugging port 8000 accessible from the internet via the edge router, allowing potential remote code execution.',
    type: 'vulnerability',
    severity: 'critical',
    source: 'manual',
    status: 'open',
    remediationStatus: 'remediation_in_progress' as const,
    cvssScore: 9.1,
    strideCategories: ['Elevation of Privilege', 'Information Disclosure'] as StrideCategory[],
    relatedNodeIds: ['app-server-1', 'edge-router'],
    relatedEdgeIds: [],
    linkedRiskIds: ['risk-debug-port-exposed'],
    linkedTaskIds: [],
    linkedAssetIds: ['asset-app-server-1'],
    recommendations: ['Disable debug port in production', 'Add firewall rule to block port 8000 from external networks'],
    owner: 'Development',
    createdAt: now, updatedAt: now
  },
  {
    id: 'FIND-AS1T-002',
    title: 'JMX Management Port Accessible Without Authentication',
    description: 'JMX monitoring endpoints on port 9999 are accessible from the internet without authentication, enabling remote JVM management.',
    type: 'vulnerability',
    severity: 'high',
    source: 'manual',
    status: 'open',
    remediationStatus: 'identified' as const,
    cvssScore: 7.5,
    strideCategories: ['Elevation of Privilege', 'Information Disclosure'] as StrideCategory[],
    relatedNodeIds: ['app-server-1', 'edge-router'],
    relatedEdgeIds: [],
    linkedRiskIds: ['risk-jmx-exposed'],
    linkedTaskIds: [],
    linkedAssetIds: ['asset-app-server-1'],
    recommendations: ['Restrict JMX to management network only', 'Enable JMX authentication and SSL', 'Consider using a JMX proxy'],
    owner: 'Platform Engineering',
    createdAt: now, updatedAt: now
  },
  {
    id: 'FIND-HLB-001',
    title: 'Unauthenticated HAProxy Statistics Interface',
    description: 'HAProxy management statistics are accessible on port 8080 without authentication from the public internet, leaking backend server health and traffic data.',
    type: 'vulnerability',
    severity: 'medium',
    source: 'manual',
    status: 'in_review',
    remediationStatus: 'remediation_planned' as const,
    cvssScore: 5.3,
    strideCategories: ['Information Disclosure'] as StrideCategory[],
    relatedNodeIds: ['load-balancer', 'edge-router'],
    relatedEdgeIds: [],
    linkedRiskIds: ['risk-lb-mgmt-unauth'],
    linkedTaskIds: [],
    linkedAssetIds: ['asset-load-balancer'],
    recommendations: ['Add HTTP basic authentication to stats page', 'Restrict stats endpoint to management network', 'Consider disabling stats in production'],
    owner: 'Platform Engineering',
    createdAt: now, updatedAt: now
  },
  {
    id: 'FIND-S3-001',
    title: 'S3 Bucket with Public Read Access Containing Backups',
    description: 'AWS S3 bucket has public-read ACL for product image serving, but backup data is co-located in the same bucket, exposing sensitive data.',
    type: 'weakness',
    severity: 'high',
    source: 'manual',
    status: 'mitigated',
    strideCategories: ['Information Disclosure'] as StrideCategory[],
    relatedNodeIds: ['cloud-storage'],
    relatedEdgeIds: [],
    linkedRiskIds: ['risk-s3-backup-exposure'],
    linkedTaskIds: [],
    linkedAssetIds: ['asset-s3-storage'],
    recommendations: ['Separate backup and public asset buckets', 'Remove public-read ACL from backup data', 'Enable S3 bucket versioning and logging'],
    owner: 'Cloud Operations',
    createdAt: now, updatedAt: now
  },
  {
    id: 'FIND-AS1T-003',
    title: 'Known Vulnerable Software Components (Log4j, Struts)',
    description: 'Application servers run outdated components including Log4j 2.14.0, Struts 2.5.10, and Commons Collections 3.2.1 with known critical CVEs.',
    type: 'vulnerability',
    severity: 'critical',
    source: 'manual',
    status: 'open',
    remediationStatus: 'identified' as const,
    cvssScore: 10.0,
    strideCategories: ['Tampering', 'Elevation of Privilege'] as StrideCategory[],
    relatedNodeIds: ['app-server-1', 'app-server-2'],
    relatedEdgeIds: [],
    linkedRiskIds: ['risk-vulnerable-components'],
    linkedTaskIds: [],
    linkedAssetIds: ['asset-app-server-1', 'asset-app-server-2'],
    recommendations: ['Urgently patch Log4j to 2.17+', 'Upgrade Struts to latest stable', 'Replace Commons Collections 3.x with 4.x', 'Implement automated dependency scanning'],
    owner: 'Development',
    createdAt: now, updatedAt: now
  },
  {
    id: 'FIND-AS1T-004',
    title: 'Shared Service Account Across Application Servers',
    description: 'Both application servers authenticate to backend services using the same shared service account, preventing individual accountability and increasing blast radius.',
    type: 'weakness',
    severity: 'medium',
    source: 'manual',
    status: 'accepted',
    strideCategories: ['Spoofing', 'Repudiation'] as StrideCategory[],
    relatedNodeIds: ['app-server-1', 'app-server-2'],
    relatedEdgeIds: [],
    linkedRiskIds: ['risk-shared-svc-acct-ops'],
    linkedTaskIds: [],
    linkedAssetIds: ['asset-app-server-1', 'asset-app-server-2'],
    recommendations: ['Assign unique service accounts per instance', 'Implement service account rotation', 'Enable service account activity logging'],
    owner: 'Platform Engineering',
    createdAt: now, updatedAt: now
  },
  {
    id: 'FIND-SIEM-001',
    title: 'Unencrypted Syslog Transmission to SIEM',
    description: 'Application and firewall logs are transmitted via unencrypted Syslog (UDP 514), allowing potential log tampering or information leakage in transit.',
    type: 'weakness',
    severity: 'medium',
    source: 'manual',
    status: 'mitigated',
    strideCategories: ['Tampering', 'Repudiation'] as StrideCategory[],
    relatedNodeIds: ['siem-server', 'app-server-1', 'app-server-2'],
    relatedEdgeIds: [],
    linkedRiskIds: ['risk-syslog-unencrypted'],
    linkedTaskIds: [],
    linkedAssetIds: ['asset-siem', 'asset-app-server-1', 'asset-app-server-2'],
    recommendations: ['Migrate to Syslog-TLS for all log transport', 'Implement log integrity verification', 'Enable encrypted forwarding on Splunk UF'],
    owner: 'Security Operations',
    createdAt: now, updatedAt: now
  },
  {
    id: 'FIND-MRD-001',
    title: 'Direct Replica Database Access Bypassing Firewall',
    description: 'Application servers have direct connections to the replica database that bypass the database firewall, eliminating SQL filtering and audit controls.',
    type: 'vulnerability',
    severity: 'high',
    source: 'manual',
    status: 'open',
    remediationStatus: 'remediation_planned' as const,
    cvssScore: 6.5,
    strideCategories: ['Tampering', 'Information Disclosure'] as StrideCategory[],
    relatedNodeIds: ['app-server-1', 'app-server-2', 'replica-db'],
    relatedEdgeIds: [],
    linkedRiskIds: ['risk-replica-direct-access'],
    linkedTaskIds: [],
    linkedAssetIds: ['asset-replica-db', 'asset-app-server-1', 'asset-app-server-2'],
    recommendations: ['Route all database traffic through the database firewall', 'Remove direct replica access paths', 'Implement network segmentation controls'],
    owner: 'Network Security',
    createdAt: now, updatedAt: now
  }
];

export const vulnerableWebAppGrcWorkspace: GrcWorkspace = {
  schemaVersion: '1.0',
  createdAt: now,
  updatedAt: now,
  riskModel,
  tierCatalogue,
  assets,
  findings,
  risks,
  assessments,
  controlSets,
  soaEntries,
  workflowTasks,
  governanceDocuments,
  threatActors,
  threatScenarios,
  appetiteRules,
  thirdParties: [
    {
      id: 'tp-aws',
      name: 'Amazon Web Services (AWS)',
      description: 'Cloud infrastructure provider hosting S3 storage for static assets and database backups. Provides IaaS services under shared responsibility model.',
      category: 'cloud_provider',
      status: 'active',
      riskRating: 'medium',
      dataClassification: 'confidential',
      linkedAssetIds: ['asset-s3-storage'],
      linkedRiskIds: ['risk-s3-public-read'],
      contactName: 'AWS Enterprise Support',
      contactEmail: 'enterprise-support@aws.example.com',
      contractExpiry: '2026-03-31',
      lastAssessmentDate: '2024-11-10',
      nextReviewDate: '2025-05-10',
      notes: 'SOC 2 Type II and ISO 27001 certified. S3 bucket misconfiguration identified during last review — public read enabled on backup bucket.'
    },
    {
      id: 'tp-stripe',
      name: 'Stripe Inc.',
      description: 'Payment processing gateway handling all customer credit card transactions. PCI DSS Level 1 certified. Processes approximately 45,000 transactions per month.',
      category: 'saas',
      status: 'active',
      riskRating: 'high',
      dataClassification: 'restricted',
      linkedAssetIds: ['asset-web-server', 'asset-app-server-1', 'asset-app-server-2'],
      linkedRiskIds: ['risk-unencrypted-db-traffic'],
      contactName: 'Maria Chen',
      contactEmail: 'maria.chen@stripe.example.com',
      contractExpiry: '2025-12-31',
      lastAssessmentDate: '2024-09-15',
      nextReviewDate: '2025-03-15',
      notes: 'PCI DSS Level 1 compliant. API keys rotated quarterly. Webhook signatures verified. Risk elevated due to transaction volume and data sensitivity.'
    },
    {
      id: 'tp-cloudflare',
      name: 'Cloudflare Inc.',
      description: 'CDN and DDoS protection provider for the e-commerce storefront. Provides DNS, edge caching, and bot management services.',
      category: 'managed_service',
      status: 'active',
      riskRating: 'low',
      dataClassification: 'internal',
      linkedAssetIds: ['asset-load-balancer', 'asset-web-server'],
      linkedRiskIds: [],
      contactName: 'James Okafor',
      contactEmail: 'james.okafor@cloudflare.example.com',
      contractExpiry: '2025-09-30',
      lastAssessmentDate: '2024-12-01',
      nextReviewDate: '2025-06-01',
      notes: 'Enterprise plan with dedicated account manager. SSL/TLS termination at edge. No sensitive data cached — dynamic content bypasses CDN.'
    },
    {
      id: 'tp-splunk-cloud',
      name: 'Splunk Cloud (Cisco)',
      description: 'Cloud-hosted SIEM platform receiving application logs, firewall events, and security alerts. Retains 12 months of indexed data.',
      category: 'saas',
      status: 'active',
      riskRating: 'medium',
      dataClassification: 'confidential',
      linkedAssetIds: ['asset-siem'],
      linkedRiskIds: ['risk-unencrypted-logs'],
      contactName: 'Priya Sharma',
      contactEmail: 'priya.sharma@splunk.example.com',
      contractExpiry: '2025-08-15',
      lastAssessmentDate: '2024-10-20',
      nextReviewDate: '2025-04-20',
      notes: 'Log data transmitted via unencrypted syslog — TLS migration in progress. FedRAMP Moderate authorized. 99.9% SLA with 4-hour RTO.'
    },
    {
      id: 'tp-acme-pentest',
      name: 'Acme Security Consulting',
      description: 'Third-party penetration testing firm contracted for annual application security assessments and ad-hoc red team engagements.',
      category: 'contractor',
      status: 'active',
      riskRating: 'medium',
      dataClassification: 'confidential',
      linkedAssetIds: ['asset-web-server', 'asset-app-server-1', 'asset-app-server-2', 'asset-primary-db'],
      linkedRiskIds: ['risk-debug-port-exposed', 'risk-vulnerable-components'],
      contactName: 'David Kim',
      contactEmail: 'david.kim@acmesec.example.com',
      contractExpiry: '2025-06-30',
      lastAssessmentDate: '2025-01-05',
      nextReviewDate: '2025-07-05',
      notes: 'Last pentest identified debug port exposure and outdated Log4j. VPN access scoped to staging environment only. NDA and data handling agreement in place.'
    },
    {
      id: 'tp-sendgrid',
      name: 'Twilio SendGrid',
      description: 'Transactional email service for order confirmations, password resets, and marketing campaigns. Processes customer PII including names and email addresses.',
      category: 'saas',
      status: 'active',
      riskRating: 'medium',
      dataClassification: 'confidential',
      linkedAssetIds: ['asset-app-server-1'],
      linkedRiskIds: [],
      contactName: 'Lisa Nguyen',
      contactEmail: 'lisa.nguyen@sendgrid.example.com',
      contractExpiry: '2025-11-30',
      lastAssessmentDate: '2024-08-12',
      nextReviewDate: '2025-02-12',
      notes: 'Handles customer PII for email delivery. API key stored in application server environment variables. SPF/DKIM/DMARC configured. Review overdue.'
    },
    {
      id: 'tp-jenkins-plugins',
      name: 'Jenkins Open Source Community',
      description: 'Open-source CI/CD platform and plugin ecosystem. 23 third-party plugins installed, several with known vulnerabilities and infrequent maintenance.',
      category: 'supplier',
      status: 'under_review',
      riskRating: 'high',
      dataClassification: 'internal',
      linkedAssetIds: ['asset-ci-server'],
      linkedRiskIds: ['risk-vulnerable-components'],
      contactName: 'N/A — Open Source',
      contactEmail: 'security@jenkins.example.com',
      contractExpiry: '',
      lastAssessmentDate: '2024-06-15',
      nextReviewDate: '2025-01-15',
      notes: 'Several plugins unmaintained with known CVEs. No commercial support agreement. Build server has network access to production deployment targets. Review overdue — supply chain risk.'
    },
    {
      id: 'tp-former-msp',
      name: 'GlobalTech Managed Services',
      description: 'Former managed hosting provider. Contract terminated but credential deprovisioning not yet verified. Previously had root access to all production servers.',
      category: 'managed_service',
      status: 'offboarding',
      riskRating: 'critical',
      dataClassification: 'restricted',
      linkedAssetIds: ['asset-app-server-1', 'asset-app-server-2', 'asset-primary-db', 'asset-replica-db'],
      linkedRiskIds: ['risk-default-db-creds', 'risk-shared-service-account'],
      contactName: 'Robert Tanaka',
      contactEmail: 'robert.tanaka@globaltech.example.com',
      contractExpiry: '2024-12-31',
      lastAssessmentDate: '2024-12-20',
      nextReviewDate: '2025-01-31',
      notes: 'URGENT: Contract terminated Dec 2024 but credential revocation incomplete. Former staff had root/admin access to database and application servers. Shared service account credentials may still be valid. Immediate access audit required.'
    }
  ],
  securityInitiatives: [
    {
      id: 'si-auth-uplift',
      title: 'Authentication & Access Control Uplift',
      description: 'Comprehensive upgrade of authentication mechanisms across the e-commerce platform, replacing hardcoded credentials with centralized identity management and enforcing least-privilege access.',
      category: 'uplift',
      status: 'in_progress',
      priority: 'critical',
      owner: 'Sarah Chen',
      executiveSponsor: 'VP Engineering',
      currentState: 'Authentication relies on hardcoded credentials in configuration files. Admin panel uses HTTP basic auth without MFA. Shared service accounts are used across multiple services with no rotation policy.',
      targetState: 'Centralized IAM with SSO integration, MFA enforced for all admin and privileged access, individual service accounts with automated credential rotation every 90 days, and session management aligned with OWASP best practices.',
      startDate: '2025-01-15',
      targetDate: '2025-06-30',
      completedDate: '',
      milestones: [
        { id: 'ms-iam-design', title: 'IAM architecture design', description: 'Design centralized identity architecture', status: 'completed', dueDate: '2025-02-15', completedDate: '2025-02-10', owner: 'Sarah Chen' },
        { id: 'ms-mfa-rollout', title: 'MFA rollout for admin accounts', description: 'Deploy MFA for all admin and privileged accounts', status: 'in_progress', dueDate: '2025-03-31', completedDate: '', owner: 'DevOps Team' },
        { id: 'ms-cred-rotation', title: 'Automated credential rotation', description: 'Implement automated service account credential rotation', status: 'pending', dueDate: '2025-05-15', completedDate: '', owner: 'Platform Team' },
        { id: 'ms-session-mgmt', title: 'Session management hardening', description: 'Implement secure session handling per OWASP guidelines', status: 'pending', dueDate: '2025-06-30', completedDate: '', owner: 'Backend Team' }
      ],
      linkedRiskIds: ['risk-default-db-creds', 'risk-shared-service-account', 'risk-lb-mgmt-unauth'],
      linkedControlSetIds: [],
      linkedAssetIds: ['asset-app-server-1', 'asset-app-server-2', 'asset-primary-db'],
      linkedImplementedControlIds: ['ic-okta-mfa', 'ic-quarterly-access-reviews'],
      linkedAssessmentIds: ['assessment-initial-review'],
      notes: 'Board-mandated initiative following penetration test findings. Budget approved Q1 2025.',
      createdAt: '2025-01-10T00:00:00.000Z',
      updatedAt: '2025-02-15T00:00:00.000Z'
    },
    {
      id: 'si-encryption-remediation',
      title: 'Data Encryption Remediation Program',
      description: 'Address critical gaps in data-at-rest and data-in-transit encryption across the platform, focusing on PII protection and PCI DSS compliance requirements.',
      category: 'remediation',
      status: 'approved',
      priority: 'high',
      owner: 'Mike Torres',
      executiveSponsor: 'CISO',
      currentState: 'Database stores sensitive customer data (PII, payment details) without field-level encryption. Internal API communications between microservices use unencrypted HTTP. S3 buckets containing backups lack server-side encryption.',
      targetState: 'AES-256 encryption for all PII and payment data at rest, TLS 1.3 for all internal and external communications, encrypted backups with customer-managed keys, and automated key rotation.',
      startDate: '2025-03-01',
      targetDate: '2025-08-31',
      completedDate: '',
      milestones: [
        { id: 'ms-crypto-audit', title: 'Cryptographic inventory audit', description: 'Complete audit of all encryption usage and gaps', status: 'completed', dueDate: '2025-03-15', completedDate: '2025-03-12', owner: 'Security Team' },
        { id: 'ms-tls-internal', title: 'Internal TLS deployment', description: 'Deploy mTLS for all internal service-to-service communications', status: 'pending', dueDate: '2025-05-31', completedDate: '', owner: 'Platform Team' },
        { id: 'ms-db-encryption', title: 'Database field-level encryption', description: 'Implement field-level encryption for PII columns', status: 'pending', dueDate: '2025-07-31', completedDate: '', owner: 'Backend Team' }
      ],
      linkedRiskIds: ['risk-unencrypted-db-traffic', 'risk-s3-public-read'],
      linkedControlSetIds: [],
      linkedAssetIds: ['asset-primary-db', 'asset-replica-db', 'asset-s3-storage'],
      linkedImplementedControlIds: ['ic-tls-all-services'],
      linkedAssessmentIds: ['assessment-initial-review', 'assessment-db-security'],
      notes: 'Driven by PCI DSS compliance gap analysis. Aligns with upcoming audit cycle.',
      createdAt: '2025-02-20T00:00:00.000Z',
      updatedAt: '2025-03-12T00:00:00.000Z'
    }
  ],
  implementedControls: [
    {
      id: 'ic-waf-alb',
      title: 'AWS WAF on ALB',
      description: 'AWS Web Application Firewall deployed on the Application Load Balancer, providing managed rule sets for OWASP Top 10 protection including SQL injection, XSS, and request rate limiting.',
      controlType: 'technical',
      category: 'network_security',
      status: 'active',
      automationLevel: 'semi_automated',
      owner: 'Security Operations',
      vendor: 'AWS',
      product: 'WAF',
      version: 'v2',
      implementedDate: '2024-09-15',
      lastReviewDate: '2025-01-10',
      nextReviewDate: '2025-07-10',
      linkedSoaEntryIds: ['soa-a03', 'soa-a05', 'soa-a10'],
      linkedRiskIds: ['risk-waf-detection-only', 'risk-firewall-bypass'],
      linkedAssetIds: ['asset-waf', 'asset-web-server', 'asset-load-balancer'],
      linkedAssessmentIds: ['assessment-initial-review'],
      notes: 'Deployed alongside existing ModSecurity WAF. Managed rules updated automatically by AWS. Custom rules added for application-specific patterns.',
      auditHistory: [
        { id: 'audit-waf-01', plannedDate: '2025-01-15', actualDate: '2025-01-18', auditor: 'External Auditor', result: 'pass', evidenceRefs: ['WAF Config Export', 'Rule Coverage Report'], notes: 'All OWASP Top 10 rules verified active.', createdAt: now },
        { id: 'audit-waf-02', plannedDate: '2025-07-15', actualDate: '', auditor: '', result: 'pending', evidenceRefs: [], notes: '', createdAt: now }
      ],
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'ic-okta-mfa',
      title: 'Okta MFA Enforcement',
      description: 'Multi-factor authentication enforced for all administrative and privileged access via Okta Identity Cloud, covering VPN, application admin panels, and database management interfaces.',
      controlType: 'technical',
      category: 'identity_management',
      status: 'active',
      automationLevel: 'fully_automated',
      owner: 'Security Operations',
      vendor: 'Okta',
      product: 'Identity Cloud',
      version: '2024.09',
      implementedDate: '2024-11-01',
      lastReviewDate: '2025-01-05',
      nextReviewDate: '2025-04-05',
      linkedSoaEntryIds: ['soa-a07', 'soa-cis-05', 'soa-cis-06'],
      linkedRiskIds: ['risk-default-db-creds', 'risk-lb-mgmt-unauth', 'risk-shared-service-account'],
      linkedAssetIds: ['asset-app-server-1', 'asset-app-server-2', 'asset-primary-db'],
      linkedAssessmentIds: ['assessment-initial-review'],
      notes: 'Phishing-resistant FIDO2 tokens issued to all administrators. Push notification MFA for standard privileged users. Enrollment at 94% — remaining 6% are service accounts pending migration.',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'ic-quarterly-access-reviews',
      title: 'Quarterly Access Reviews',
      description: 'Formal quarterly review of all user access rights, service account permissions, and third-party credentials. Reviews are conducted by asset owners with sign-off from the CISO.',
      controlType: 'administrative',
      category: 'access_control',
      status: 'active',
      automationLevel: 'manual',
      owner: 'GRC Team',
      vendor: '',
      product: '',
      version: '',
      implementedDate: '2024-06-01',
      lastReviewDate: '2025-01-15',
      nextReviewDate: '2025-04-15',
      linkedSoaEntryIds: ['soa-a01', 'soa-cis-05', 'soa-cis-06'],
      linkedRiskIds: ['risk-shared-service-account', 'risk-lb-mgmt-unauth'],
      linkedAssetIds: ['asset-app-server-1', 'asset-app-server-2', 'asset-primary-db', 'asset-ci-server'],
      linkedAssessmentIds: ['assessment-initial-review'],
      notes: 'Last review identified 12 stale service accounts and 3 over-provisioned user roles. Remediation tracked via workflow tasks.',
      auditHistory: [
        { id: 'audit-access-01', plannedDate: '2025-01-15', actualDate: '2025-01-20', auditor: 'GRC Team Lead', result: 'partial', evidenceRefs: ['Access Review Spreadsheet'], notes: '12 stale accounts found. Follow-up remediation task created.', createdAt: now }
      ],
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'ic-tls-all-services',
      title: 'TLS 1.3 on All Services',
      description: 'Enforced TLS 1.3 for all external-facing services and TLS 1.2+ for internal service-to-service communications. Weak cipher suites disabled across all endpoints.',
      controlType: 'technical',
      category: 'encryption',
      status: 'active',
      automationLevel: 'fully_automated',
      owner: 'Platform Engineering',
      vendor: '',
      product: '',
      version: '',
      implementedDate: '2024-08-20',
      lastReviewDate: '2025-01-10',
      nextReviewDate: '2025-07-10',
      linkedSoaEntryIds: ['soa-a02', 'soa-cis-03'],
      linkedRiskIds: ['risk-unencrypted-db-traffic', 'risk-unencrypted-logs'],
      linkedAssetIds: ['asset-web-server', 'asset-load-balancer', 'asset-app-server-1', 'asset-app-server-2'],
      linkedAssessmentIds: ['assessment-initial-review', 'assessment-db-security'],
      notes: 'External TLS 1.3 fully deployed. Internal mTLS rollout 70% complete — database tier pending certificate provisioning.',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'ic-security-awareness-training',
      title: 'Annual Security Awareness Training',
      description: 'Mandatory annual security awareness training for all staff covering phishing recognition, data handling, password hygiene, incident reporting, and social engineering defense.',
      controlType: 'administrative',
      category: 'training',
      status: 'active',
      automationLevel: 'manual',
      owner: 'HR / Security Operations',
      vendor: '',
      product: '',
      version: '',
      implementedDate: '2024-01-15',
      lastReviewDate: '2025-01-20',
      nextReviewDate: '2026-01-20',
      linkedSoaEntryIds: ['soa-a04', 'soa-a07'],
      linkedRiskIds: ['risk-default-db-creds', 'risk-shared-service-account'],
      linkedAssetIds: ['asset-app-server-1', 'asset-primary-db', 'asset-ci-server'],
      linkedAssessmentIds: ['assessment-initial-review'],
      notes: 'Completion rate 97% for 2024 cycle. Supplemented with quarterly phishing simulations — click rate reduced from 18% to 4% over 12 months.',
      createdAt: now,
      updatedAt: now
    }
  ],
  riskAcceptances: [
    {
      id: 'ra-legacy-ssl',
      riskId: 'risk-unencrypted-db-traffic',
      title: 'Legacy DB SSL Exception',
      scopeType: 'risk',
      requestedBy: 'Platform Engineering',
      approvedBy: 'CISO',
      status: 'approved',
      justification: 'Legacy database driver does not support TLS 1.2+. Migration to new driver scheduled for Q3.',
      conditions: 'Database must remain in isolated VLAN. Network-level encryption (IPsec) applied as compensating control.',
      emailLink: '',
      effectiveDate: '2025-01-15',
      expirationDate: '2025-09-30',
      reviewDate: '2025-06-15',
      notes: 'Compensating control verified by security team.',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'ra-debug-port',
      riskId: 'risk-debug-port-open',
      title: 'Debug Port Temporary Acceptance',
      scopeType: 'risk',
      requestedBy: 'Dev Team Lead',
      approvedBy: '',
      status: 'pending_review',
      justification: 'Debug port needed for performance profiling during Q2 optimization sprint.',
      conditions: 'Port restricted to internal VPN only. Firewall rule audit weekly.',
      emailLink: '',
      effectiveDate: '2025-02-01',
      expirationDate: '2025-04-30',
      reviewDate: '2025-03-15',
      notes: '',
      createdAt: now,
      updatedAt: now
    }
  ],
  frameworkMappings: [
    {
      id: 'fmap-a03-cis03',
      sourceControlSetId: 'aescsf-controls',
      sourceControlId: 'A.03',
      targetControlSetId: 'cis-controls-v8',
      targetControlId: 'CIS-03',
      relationship: 'equivalent',
      notes: 'Both address data protection and encryption requirements',
      createdAt: now
    },
    {
      id: 'fmap-a07-cis05',
      sourceControlSetId: 'aescsf-controls',
      sourceControlId: 'A.07',
      targetControlSetId: 'cis-controls-v8',
      targetControlId: 'CIS-05',
      relationship: 'partial',
      notes: 'A.07 covers broader access management; CIS-05 focuses on account management',
      createdAt: now
    },
    {
      id: 'fmap-a05-cis07',
      sourceControlSetId: 'aescsf-controls',
      sourceControlId: 'A.05',
      targetControlSetId: 'cis-controls-v8',
      targetControlId: 'CIS-07',
      relationship: 'related',
      notes: 'Both address vulnerability management but from different perspectives',
      createdAt: now
    }
  ],
  incidents: [
    {
      id: 'inc-phishing-campaign',
      title: 'Targeted Phishing Campaign Against Admin Staff',
      description: 'Sophisticated phishing emails targeting administrative staff with fake password reset links. Two users clicked the link before detection.',
      severity: 'high',
      status: 'resolved',
      detectedDate: '2025-01-10',
      resolvedDate: '2025-01-12',
      closedDate: '2025-01-20',
      owner: 'Security Operations',
      linkedRiskIds: ['risk-default-db-creds'],
      linkedAssetIds: ['asset-app-server-1'],
      linkedFindingIds: [],
      timelineEntries: [
        { id: 'tle-phish-01', date: '2025-01-10T08:30:00Z', description: 'First phishing email reported by user', actor: 'Help Desk' },
        { id: 'tle-phish-02', date: '2025-01-10T09:15:00Z', description: 'SOC confirmed phishing campaign targeting 15 users', actor: 'SOC Analyst' },
        { id: 'tle-phish-03', date: '2025-01-10T10:00:00Z', description: 'Blocked sender domain and quarantined all related emails', actor: 'Email Admin' },
        { id: 'tle-phish-04', date: '2025-01-12T14:00:00Z', description: 'Password resets completed for affected users. MFA verified active.', actor: 'Security Operations' }
      ],
      lessonsLearned: 'Need to improve phishing simulation frequency. Two users who clicked had not completed latest training module.',
      notes: 'No evidence of credential compromise. MFA prevented unauthorized access.',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'inc-s3-exposure',
      title: 'S3 Bucket Public Access Misconfiguration',
      description: 'Automated scanning detected that the backup S3 bucket had public read access enabled, potentially exposing customer data backups.',
      severity: 'critical',
      status: 'contained',
      detectedDate: '2025-02-05',
      resolvedDate: '',
      closedDate: '',
      owner: 'Cloud Infrastructure',
      linkedRiskIds: ['risk-public-s3-bucket'],
      linkedAssetIds: ['asset-s3-backup', 'asset-s3-assets'],
      linkedFindingIds: [],
      timelineEntries: [
        { id: 'tle-s3-01', date: '2025-02-05T06:00:00Z', description: 'AWS Config rule triggered alert for public bucket', actor: 'Automated Monitoring' },
        { id: 'tle-s3-02', date: '2025-02-05T06:30:00Z', description: 'On-call engineer blocked public access within 30 minutes', actor: 'Cloud Engineer' },
        { id: 'tle-s3-03', date: '2025-02-05T10:00:00Z', description: 'Access log review initiated to assess data exposure window', actor: 'Security Operations' }
      ],
      lessonsLearned: '',
      notes: 'Access log review in progress. Preliminary analysis shows no external downloads during the exposure window.',
      createdAt: now,
      updatedAt: now
    }
  ],
  aiAssist: {
    enabled: true,
    contextScope: 'workspace',
    contextDetail: 'detailed',
    includeAssets: true,
    includeRisks: true,
    includeSoaEntries: true,
    includeTasks: true,
    includeAssessments: true,
    includeThreatProfiles: true,
    includeGovernanceDocuments: true,
    includeAppetiteRules: true,
    includeFindings: true,
    includeThirdParties: true,
    includeSecurityInitiatives: true,
    includeImplementedControls: true,
    includeRiskAcceptances: true,
    includeFrameworkMappings: true,
    includeIncidents: true,
    maxItemsPerSection: 20
  },
  config: { ...createDefaultConfig(), businessUnits: ['Engineering', 'Data Services', 'Cloud Operations', 'Security', 'Platform Engineering'] }
};

export const vulnerableWebApp: ExampleSystem = {
  id: 'vulnerable-web-app',
  name: 'E-Commerce Platform',
  description: 'Multi-tier web application for online retail with cloud integration and an end-to-end GRC workflow baseline',
  category: 'Web Applications',
  primaryZone: 'DMZ',
  dataClassification: 'Internal',
  grcWorkspace: vulnerableWebAppGrcWorkspace,
  customContext: `# E-Commerce Platform Technical Design

## System Overview
Enterprise-scale e-commerce platform handling customer transactions, inventory management, and order fulfillment. Processes approximately 10,000 transactions daily with peaks of 50,000 during sales events. Platform supports multiple payment methods and integrates with third-party logistics providers and cloud analytics services.

## Architecture Components

### Frontend Layer (DMZ)
- Apache Web Servers (v2.4.29) serving customer-facing website
  - PHP 7.1.2 for dynamic content generation
  - Static assets (images, CSS, JS) served directly from Apache
  - Session management handled via standard PHP sessions
  - Administrative dashboard accessible via /admin path
  - Product image uploads supported for catalog management
  - Standard Apache error pages with detailed stack traces enabled
  - ModSecurity WAF installed but running in detection-only mode

- HAProxy Load Balancer (v1.8.12) for high availability
  - Distributes incoming traffic across application servers
  - Health monitoring configured on standard HTTP endpoints
  - Round-robin distribution with equal server weights
  - Management statistics available on port 8080 without authentication
  - Session affinity disabled for better load distribution
  - SSL termination with weak cipher suites enabled for compatibility

### Application Layer (Internal)
- Dual Tomcat Application Servers (v8.5.13) for redundancy
  - Spring Boot 1.5.8 framework for business logic
  - Payment processing integration with multiple gateways
  - Inventory management and order processing workflows
  - JMX monitoring endpoints enabled on port 9999 for operational visibility
  - Development debugging port (8000) enabled for troubleshooting
  - In-memory session storage for performance
  - XML-based inventory feed processing from suppliers with external entity processing enabled
  - CORS headers configured to allow all origins for API access
  - Shared service account used across both application servers

### Database Layer (Restricted)
- MySQL Database Cluster (v5.6.35) for data persistence
  - Primary-replica configuration for read scaling
  - Contains customer data, orders, and payment information
  - Automated backup processes configured to shared network location
  - Standard MySQL port configuration (3306)
  - Query logging enabled for performance monitoring with full query capture
  - Database firewall deployed with permissive rule set
  - Replication configured between primary and replica instances
  - Default MySQL root account with factory password for emergency access

### Cloud Integration Layer (Cloud)
- AWS S3 buckets for static asset storage and backup retention
  - Public read access enabled for product image serving
  - Backup data stored with server-side encryption using AWS managed keys
  - Cross-region replication configured for disaster recovery
  - Lifecycle policies set for cost optimization

- Analytics and monitoring services
  - CloudWatch logs aggregation for application and system metrics
  - Third-party analytics service integration for customer behavior tracking
  - External SIEM service for security event correlation

### Management Zone (Guest)
- Administrative access systems and development tools
  - VPN gateway for remote administrator access
  - Development workstations for emergency production access
  - Legacy backup systems and file shares
  - Third-party vendor access portal for maintenance

## Security Controls Deployment
- Perimeter firewalls deployed at zone boundaries with rule review quarterly
- IDS/IPS sensors deployed but configured with high alert thresholds to reduce noise
- Endpoint protection deployed on servers with automatic updates disabled during business hours
- Network segmentation implemented with VLAN isolation
- Log aggregation system collecting logs from all systems with 30-day retention
- Vulnerability scanning performed monthly during maintenance windows
- Penetration testing conducted annually by approved vendors

## Operational Considerations
- System designed for 99.9% uptime with redundant components
- Monitoring and alerting configured across all tiers with escalation procedures
- Regular security updates applied during monthly maintenance windows
- Disaster recovery procedures documented and tested quarterly
- Performance optimization ongoing with caching strategies and CDN integration
- Change management process requires approval for production modifications
- Incident response procedures documented with external forensics contractor on retainer`,
  nodes: [
    {
      id: 'internet-zone',
      type: 'securityZone',
      position: { x: 350, y: 50 },
      data: {
        label: 'Internet Zone',
        zoneType: 'Internet' as SecurityZone,
        description: 'External network access zone',
        zone: 'DMZ' as SecurityZone
      },
      style: {
        width: 350,
        height: 450,
        background: colors.zoneBackgrounds.Internet,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'dmz-zone',
      type: 'securityZone',
      position: { x: 820, y: 50 },
      data: {
        label: 'DMZ Zone',
        zoneType: 'DMZ' as SecurityZone,
        description: 'Public-facing services zone'
      },
      style: {
        width: 900,
        height: 1050,
        background: colors.zoneBackgrounds.DMZ,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'internal-zone',
      type: 'securityZone',
      position: { x: 1840, y: 50 },
      data: {
        label: 'Internal Zone',
        zoneType: 'Internal' as SecurityZone,
        description: 'Protected application processing zone'
      },
      style: {
        width: 800,
        height: 1050,
        background: colors.zoneBackgrounds.Internal,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'restricted-zone',
      type: 'securityZone',
      position: { x: 2760, y: 50 },
      data: {
        label: 'Restricted Zone',
        zoneType: 'Restricted' as SecurityZone,
        description: 'High-security data storage zone'
      },
      style: {
        width: 450,
        height: 1050,
        background: colors.zoneBackgrounds.Restricted,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'cloud-zone',
      type: 'securityZone',
      position: { x: 1900, y: -950 },
      data: {
        label: 'Cloud Zone',
        zoneType: 'Cloud' as SecurityZone,
        description: 'External cloud services and analytics'
      },
      style: {
        width: 650,
        height: 800,
        background: colors.zoneBackgrounds.Cloud,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'development-zone',
      type: 'securityZone',
      position: { x: 50, y: 1220 },
      data: {
        label: 'Development Zone',
        zoneType: 'Development' as SecurityZone,
        description: 'Development and testing environment'
      },
      style: {
        width: 700,
        height: 650,
        background: colors.zoneBackgrounds.Development,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'management-zone',
      type: 'securityZone',
      position: { x: 820, y: 1220 },
      data: {
        label: 'Management Zone',
        zoneType: 'Management' as SecurityZone,
        description: 'Network management and administrative access zone'
      },
      style: {
        width: 700,
        height: 650,
        background: colors.zoneBackgrounds.Management,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'staging-zone',
      type: 'securityZone',
      position: { x: 1840, y: 1220 },
      data: {
        label: 'Staging Zone',
        zoneType: 'Staging' as SecurityZone,
        description: 'Pre-production staging and UAT environment'
      },
      style: {
        width: 700,
        height: 650,
        background: colors.zoneBackgrounds.Staging,
        zIndex: -1
      }
    } as SecurityNode,

    {
      id: 'edge-router',
      type: 'router',
      position: { x: 575, y: 225 },
      data: {
        label: 'Edge Router',
        description: 'Internet Gateway Router',
        zone: 'DMZ' as SecurityZone,
        dataClassification: 'Internal',
        protocols: ['BGP', 'OSPF'],
        version: '15.1',
        securityControls: ['ACLs']
      }
    } as SecurityNode,
    {
      id: 'edge-firewall',
      type: 'firewall',
      position: { x: 875, y: 175 },
      data: {
        label: 'Edge Firewall',
        description: 'Fortinet FortiGate Perimeter Security',
        vendor: 'fortinet',
        product: 'fortigate',
        zone: 'DMZ' as SecurityZone,
        dataClassification: 'Internal',
        protocols: ['any'],
        version: '7.0.1',
        securityControls: ['IDS', 'IPS']
      }
    } as SecurityNode,
    {
      id: 'waf',
      type: 'firewall',
      position: { x: 1125, y: 325 },
      data: {
        label: 'Web Application Firewall',
        description: 'ModSecurity WAF (Detection Mode)',
        vendor: 'trustwave',
        product: 'modsecurity',
        zone: 'DMZ' as SecurityZone,
        dataClassification: 'Internal',
        protocols: ['HTTP', 'HTTPS'],
        version: '3.0.4',
        securityControls: ['OWASP Rules', 'Detection Only']
      }
    } as SecurityNode,
    {
      id: 'web-server',
      type: 'webServer',
      position: { x: 1325, y: 325 },
      data: {
        label: 'Web Server',
        description: 'Apache HTTP Server',
        vendor: 'apache',
        product: 'httpd',
        zone: 'DMZ' as SecurityZone,
        dataClassification: 'Internal',
        protocols: ['HTTP', 'HTTPS'],
        version: '2.4.29',
        securityControls: ['SSL Termination', 'ModSecurity WAF']
      }
    } as SecurityNode,
    {
      id: 'load-balancer',
      type: 'loadBalancer',
      position: { x: 1575, y: 175 },
      data: {
        label: 'Load Balancer',
        description: 'HAProxy Load Balancer',
        vendor: 'haproxy',
        product: 'haproxy',
        zone: 'DMZ' as SecurityZone,
        dataClassification: 'Internal',
        version: '2.3',
        protocols: ['HTTP', 'HTTPS'],
        securityControls: ['SSL Termination']
      }
    } as SecurityNode,
    {
      id: 'ids-sensor-1',
      type: 'monitor',
      position: { x: 1475, y: 825 },
      data: {
        label: 'IDS Sensor 2',
        description: 'Network Intrusion Detection (High Threshold)',
        vendor: 'suricata',
        product: 'ids',
        zone: 'DMZ' as SecurityZone,
        dataClassification: 'Internal',
        protocols: ['Network Mirror'],
        version: '6.0.1',
        securityControls: ['Signature Detection', 'High Alert Threshold']
      }
    } as SecurityNode,
    {
      id: 'internal-firewall',
      type: 'firewall',
      position: { x: 1925, y: 175 },
      data: {
        label: 'Internal Firewall',
        description: 'Fortinet FortiGate Internal Network Security',
        vendor: 'fortinet',
        product: 'fortigate',
        zone: 'Internal' as SecurityZone,
        dataClassification: 'Internal',
        protocols: ['any'],
        version: '7.0.1',
        securityControls: ['IDS', 'IPS']
      }
    } as SecurityNode,
    {
      id: 'app-server-1',
      type: 'application',
      position: { x: 2025, y: 375 },
      data: {
        label: 'App Server 1',
        description: 'Apache Tomcat Application Server',
        vendor: 'apache',
        product: 'tomcat',
        zone: 'Internal' as SecurityZone,
        dataClassification: 'Sensitive',
        protocols: ['HTTP', 'JMX', 'RMI', 'AJP'],
        version: '8.5.13',
        technology: 'Java 8u181',
        patchLevel: 'None',
        components: [
          { name: 'Log4j', version: '2.14.0' },
          { name: 'Spring Framework', version: '4.3.16' },
          { name: 'Commons FileUpload', version: '1.3.1' },
          { name: 'Jackson Databind', version: '2.9.8' }
        ],
        securityControls: ['JVM Security Manager'],
        portRange: '8080, 8000, 9999, 8009'
      }
    } as SecurityNode,
    {
      id: 'app-server-2',
      type: 'application',
      position: { x: 2375, y: 425 },
      data: {
        label: 'App Server 2',
        description: 'Apache Tomcat Application Server',
        vendor: 'apache',
        product: 'tomcat',
        zone: 'Internal' as SecurityZone,
        dataClassification: 'Sensitive',
        protocols: ['HTTP', 'JMX', 'RMI', 'JNDI'],
        version: '8.5.13',
        technology: 'Java 7u80',
        patchLevel: 'Partial',
        components: [
          { name: 'Struts', version: '2.5.10' },
          { name: 'Commons Collections', version: '3.2.1' },
          { name: 'Apache Solr', version: '8.2.0' },
          { name: 'Hibernate ORM', version: '5.2.17' },
          { name: 'OWASP Java Encoder', version: '1.2.0' }
        ],
        securityControls: ['Application Firewall', 'Session Management'],
        portRange: '8080, 8005, 9999, 1099'
      }
    } as SecurityNode,
    {
      id: 'ids-sensor-2',
      type: 'monitor',
      position: { x: 2425, y: 775 },
      data: {
        label: 'IDS Sensor',
        description: 'Network Intrusion Detection (High Threshold)',
        vendor: 'suricata',
        product: 'ids',
        zone: 'Internal' as SecurityZone,
        dataClassification: 'Internal',
        protocols: ['Network Mirror'],
        version: '6.0.1',
        securityControls: ['Signature Detection', 'High Alert Threshold']
      }
    } as SecurityNode,
    {
      id: 'siem-server',
      type: 'monitor',
      position: { x: 2025, y: 825 },
      data: {
        label: 'SIEM Server',
        description: 'Security Information and Event Management',
        vendor: 'splunk',
        product: 'enterprise',
        zone: 'Internal' as SecurityZone,
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'Syslog'],
        version: '8.2.1',
        securityControls: ['Log Aggregation', 'Alerting', 'Correlation Rules']
      }
    } as SecurityNode,
    {
      id: 'log-server',
      type: 'storage',
      position: { x: 2425, y: 875 },
      data: {
        label: 'Log Server',
        description: 'Centralized Log Storage',
        vendor: 'elastic',
        product: 'elasticsearch',
        zone: 'Internal' as SecurityZone,
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'Elasticsearch'],
        version: '7.9.2',
        securityControls: ['30-day Retention', 'Index Management']
      }
    } as SecurityNode,
    {
      id: 'db-firewall',
      type: 'firewall',
      position: { x: 2825, y: 175 },
      data: {
        label: 'Database Firewall',
        description: 'Oracle Database Firewall',
        vendor: 'oracle',
        product: 'database-firewall',
        zone: 'Restricted' as SecurityZone,
        dataClassification: 'Confidential',
        protocols: ['MySQL'],
        version: '7.0.1',
        securityControls: ['IDS', 'IPS', 'DAM']
      }
    } as SecurityNode,
    {
      id: 'primary-db',
      type: 'database',
      position: { x: 2825, y: 425 },
      data: {
        label: 'Primary Database',
        description: 'MySQL Community Server',
        vendor: 'Oracle',
        product: 'mysql',
        zone: 'Restricted' as SecurityZone,
        dataClassification: 'Confidential',
        version: '5.6.35',
        protocols: ['MySQL'],
        securityControls: ['Encryption at Rest', 'Query Logging']
      }
    } as SecurityNode,
    {
      id: 'replica-db',
      type: 'database',
      position: { x: 3125, y: 425 },
      data: {
        label: 'Replica Database',
        description: 'MySQL Community Server Replica',
        vendor: 'Oracle',
        product: 'mysql',
        zone: 'Restricted' as SecurityZone,
        dataClassification: 'Confidential',
        version: '5.6.35',
        protocols: ['MySQL'],
        securityControls: ['Encryption at Rest', 'Read-Only Access']
      }
    } as SecurityNode,
    {
      id: 'cloud-storage',
      type: 'storage',
      position: { x: 2075, y: -825 },
      data: {
        label: 'S3 Storage',
        description: 'AWS S3 Bucket (Public Read)',
        vendor: 'aws',
        product: 's3',
        zone: 'Cloud' as SecurityZone,
        dataClassification: 'Public',
        protocols: ['HTTPS', 'S3'],
        version: 'current',
        securityControls: ['Server-Side Encryption', 'Public Read Access']
      }
    } as SecurityNode,
    {
      id: 'cloud-monitoring',
      type: 'monitor',
      position: { x: 2375, y: -825 },
      data: {
        label: 'CloudWatch',
        description: 'AWS CloudWatch Monitoring',
        vendor: 'aws',
        product: 'cloudwatch',
        zone: 'Cloud' as SecurityZone,
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'AWS API'],
        version: 'current',
        securityControls: ['Metrics Collection', 'Alerting']
      }
    } as SecurityNode,
    {
      id: 'vpn-gateway',
      type: 'firewall',
      position: { x: 875, y: 1425 },
      data: {
        label: 'VPN Gateway',
        description: 'OpenVPN Access Server',
        vendor: 'openvpn',
        product: 'access-server',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Internal',
        protocols: ['OpenVPN', 'HTTPS'],
        version: '2.8.7',
        securityControls: ['2FA', 'Certificate Authentication']
      }
    } as SecurityNode,
    {
      id: 'admin-workstation',
      type: 'workstation',
      position: { x: 1125, y: 1425 },
      data: {
        label: 'Admin Workstation',
        description: 'Network Management Workstation',
        vendor: 'microsoft',
        product: 'windows',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Internal',
        protocols: ['RDP', 'SSH', 'HTTPS'],
        version: '10',
        securityControls: ['Endpoint Protection', 'Privileged Access']
      }
    } as SecurityNode,
    {
      id: 'git-server',
      type: 'server',
      position: { x: 125, y: 1425 },
      data: {
        label: 'Git Repository',
        description: 'GitLab Community Edition',
        vendor: 'gitlab',
        product: 'ce',
        zone: 'Development' as SecurityZone,
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'SSH', 'Git'],
        version: '13.12.2',
        securityControls: ['Basic Authentication', 'SSH Keys']
      }
    } as SecurityNode,
    {
      id: 'ci-server',
      type: 'server',
      position: { x: 325, y: 1425 },
      data: {
        label: 'CI/CD Server',
        description: 'Jenkins Build Server',
        vendor: 'jenkins',
        product: 'jenkins',
        zone: 'Development' as SecurityZone,
        dataClassification: 'Internal',
        protocols: ['HTTP', 'HTTPS', 'SSH'],
        version: '2.289.1',
        securityControls: ['Basic Authentication', 'Plugin Security']
      }
    } as SecurityNode,
    {
      id: 'build-agent-1',
      type: 'workstation',
      position: { x: 625, y: 1475 },
      data: {
        label: 'Build Agent',
        description: 'Docker Build Environment',
        vendor: 'docker',
        product: 'engine',
        zone: 'Development' as SecurityZone,
        dataClassification: 'Internal',
        protocols: ['Docker API', 'SSH'],
        version: '20.10.7',
        securityControls: ['Container Isolation']
      }
    } as SecurityNode,
    {
      id: 'dev-database',
      type: 'database',
      position: { x: 125, y: 1725 },
      data: {
        label: 'Development DB',
        description: 'MySQL Development Instance',
        vendor: 'mysql',
        product: 'community',
        zone: 'Development' as SecurityZone,
        dataClassification: 'Internal',
        protocols: ['MySQL'],
        version: '8.0.25',
        securityControls: ['Basic Authentication']
      }
    } as SecurityNode,
    {
      id: 'code-scanner',
      type: 'monitor',
      position: { x: 125, y: 1625 },
      data: {
        label: 'Code Scanner',
        description: 'SonarQube Code Analysis',
        vendor: 'sonarqube',
        product: 'community',
        zone: 'Development' as SecurityZone,
        dataClassification: 'Internal',
        protocols: ['HTTP', 'HTTPS'],
        version: '8.9.1',
        securityControls: ['Static Code Analysis']
      }
    } as SecurityNode,
    {
      id: 'staging-lb',
      type: 'server',
      position: { x: 1925, y: 1425 },
      data: {
        label: 'Staging Load Balancer',
        description: 'HAProxy Staging Environment',
        vendor: 'haproxy',
        product: 'haproxy',
        zone: 'Staging' as SecurityZone,
        dataClassification: 'Internal',
        protocols: ['HTTP', 'HTTPS'],
        version: '2.4.0',
        securityControls: ['SSL Termination', 'Health Checks']
      }
    } as SecurityNode,
    {
      id: 'staging-app-1',
      type: 'server',
      position: { x: 2125, y: 1425 },
      data: {
        label: 'Staging App Server',
        description: 'Tomcat Staging Instance',
        vendor: 'apache',
        product: 'tomcat',
        zone: 'Staging' as SecurityZone,
        dataClassification: 'Internal',
        protocols: ['HTTP', 'HTTPS', 'JMX'],
        version: '9.0.46',
        securityControls: ['Application Firewall', 'Session Management']
      }
    } as SecurityNode,
    {
      id: 'staging-database',
      type: 'database',
      position: { x: 2375, y: 1425 },
      data: {
        label: 'Staging Database',
        description: 'MySQL Staging Instance',
        vendor: 'mysql',
        product: 'enterprise',
        zone: 'Staging' as SecurityZone,
        dataClassification: 'Internal',
        protocols: ['MySQL', 'SSL'],
        version: '8.0.25',
        securityControls: ['Encryption at Rest', 'Access Controls']
      }
    } as SecurityNode,
    {
      id: 'test-automation',
      type: 'workstation',
      position: { x: 1925, y: 1675 },
      data: {
        label: 'Test Automation',
        description: 'Selenium Test Runner',
        vendor: 'selenium',
        product: 'grid',
        zone: 'Staging' as SecurityZone,
        dataClassification: 'Internal',
        protocols: ['HTTP', 'WebDriver'],
        version: '4.1.0',
        securityControls: ['Test Isolation']
      }
    } as SecurityNode,
    {
      id: 'staging-monitor',
      type: 'monitor',
      position: { x: 2175, y: 1725 },
      data: {
        label: 'Staging Monitor',
        description: 'Application Performance Monitoring',
        vendor: 'newrelic',
        product: 'apm',
        zone: 'Staging' as SecurityZone,
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'Agent Protocol'],
        version: '7.4.0',
        securityControls: ['Encrypted Telemetry']
      }
    } as SecurityNode
  ],
  edges: [
    {
      id: 'internet-to-router',
      source: 'edge-router',
      target: 'edge-firewall',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Internet Traffic',
        protocol: 'any',
        encryption: 'none',
        dataClassification: 'Public',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'firewall-to-waf',
      source: 'edge-firewall',
      target: 'waf',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Web Traffic 2',
        protocol: 'HTTP/HTTPS',
        encryption: 'TLS',
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'waf-to-web',
      source: 'waf',
      target: 'web-server',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Filtered Web Traffic',
        protocol: 'HTTP/HTTPS',
        encryption: 'TLS',
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'web-to-lb',
      source: 'web-server',
      target: 'load-balancer',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Web Traffic',
        protocol: 'HTTP/HTTPS',
        encryption: 'TLS',
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'lb-to-internal-fw',
      source: 'load-balancer',
      target: 'internal-firewall',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Load Balanced Traffic 2',
        protocol: 'HTTP/HTTPS',
        encryption: 'TLS',
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'fw-to-app1',
      source: 'internal-firewall',
      target: 'app-server-1',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Application Traffic 2',
        protocol: 'HTTP',
        encryption: 'none',
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'fw-to-app2',
      source: 'internal-firewall',
      target: 'app-server-2',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Application Traffic',
        protocol: 'HTTP',
        encryption: 'none',
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'app1-to-db-fw',
      source: 'app-server-1',
      target: 'db-firewall',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Database Traffic 2',
        protocol: 'MySQL',
        encryption: 'none',
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'app2-to-db-fw',
      source: 'app-server-2',
      target: 'db-firewall',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Database Traffic',
        protocol: 'MySQL',
        encryption: 'none',
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'db-fw-to-primary',
      source: 'db-firewall',
      target: 'primary-db',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Database Access',
        protocol: 'MySQL',
        encryption: 'none',
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'primary-to-replica',
      source: 'primary-db',
      target: 'replica-db',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Replication',
        protocol: 'MySQL',
        encryption: 'none',
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'app1-debug-port',
      source: 'edge-router',
      target: 'app-server-1',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'top',
      data: {
        label: 'Debug Port (8000)',
        protocol: 'HTTP',
        encryption: 'none',
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone,
        controlPoints: [{id:'cp-dbg-1',x:750,y:-100,active:true},{id:'cp-dbg-2',x:2000,y:-100,active:true}]
      }
    } as SecurityEdge,
    {
      id: 'app1-jmx-monitoring',
      source: 'edge-router',
      target: 'app-server-1',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'top',
      data: {
        label: 'JMX Monitoring (9999)',
        protocol: 'JMX',
        encryption: 'none',
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone,
        controlPoints: [{id:'cp-jmx-1',x:620,y:-175,active:true},{id:'cp-jmx-2',x:2050,y:-175,active:true}]
      }
    } as SecurityEdge,
    {
      id: 'lb-management',
      source: 'edge-router',
      target: 'load-balancer',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'top',
      data: {
        label: 'LB Management (Port 8080)',
        protocol: 'HTTP',
        encryption: 'none',
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone,
        controlPoints: [{id:'cp-lbm-1',x:820,y:-30,active:true},{id:'cp-lbm-2',x:1580,y:-30,active:true}]
      }
    } as SecurityEdge,
    {
      id: 'lb-to-app1-direct',
      source: 'load-balancer',
      target: 'app-server-1',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Direct Health Check 2',
        protocol: 'HTTP',
        encryption: 'none',
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone,
        controlPoints: [{id:'cp-la1-1',x:1700,y:300,active:true}]
      }
    } as SecurityEdge,
    {
      id: 'lb-to-app2-direct',
      source: 'load-balancer',
      target: 'app-server-2',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Direct Health Check',
        protocol: 'HTTP',
        encryption: 'none',
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone,
        controlPoints: [{id:'cp-la2-1',x:1900,y:550,active:true},{id:'cp-la2-2',x:2250,y:550,active:true}]
      }
    } as SecurityEdge,
    {
      id: 'web-to-app1-direct',
      source: 'web-server',
      target: 'app-server-1',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'left',
      data: {
        label: 'Direct API Access',
        protocol: 'HTTP',
        encryption: 'none',
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone,
        controlPoints: [{id:'cp-wa1-1',x:1550,y:500,active:true},{id:'cp-wa1-2',x:1900,y:500,active:true}]
      }
    } as SecurityEdge,
    {
      id: 'app1-to-replica-direct',
      source: 'app-server-1',
      target: 'replica-db',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'bottom',
      data: {
        label: 'Direct Read Queries 2',
        protocol: 'MySQL',
        encryption: 'none',
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone,
        controlPoints: [{id:'cp-a1r-1',x:2200,y:620,active:true},{id:'cp-a1r-2',x:3060,y:620,active:true}]
      }
    } as SecurityEdge,
    {
      id: 'app2-to-replica-direct',
      source: 'app-server-2',
      target: 'replica-db',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'bottom',
      data: {
        label: 'Direct Read Queries',
        protocol: 'MySQL',
        encryption: 'none',
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone,
        controlPoints: [{id:'cp-a2r-1',x:2400,y:660,active:true},{id:'cp-a2r-2',x:3150,y:650,active:true}]
      }
    } as SecurityEdge,
    {
      id: 'app1-to-siem',
      source: 'app-server-1',
      target: 'siem-server',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Application Logs 2',
        protocol: 'Syslog',
        encryption: 'none',
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'app2-to-siem',
      source: 'app-server-2',
      target: 'siem-server',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Application Logs',
        protocol: 'Syslog',
        encryption: 'none',
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone,
        controlPoints: [{id:'cp-a2s-1',x:2150,y:790,active:true}]
      }
    } as SecurityEdge,
    {
      id: 'siem-to-log-server',
      source: 'siem-server',
      target: 'log-server',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Log Storage',
        protocol: 'HTTPS',
        encryption: 'TLS',
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'ids2-to-siem',
      source: 'ids-sensor-2',
      target: 'siem-server',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'IDS Alerts',
        protocol: 'HTTPS',
        encryption: 'TLS',
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-fw-to-siem',
      source: 'edge-firewall',
      target: 'siem-server',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'left',
      data: {
        label: 'Firewall Logs',
        protocol: 'Syslog',
        encryption: 'none',
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone,
        controlPoints: [{id:'cp-efs-1',x:1100,y:1000,active:true},{id:'cp-efs-2',x:1900,y:1000,active:true}]
      }
    } as SecurityEdge,
    {
      id: 'db-fw-to-siem',
      source: 'db-firewall',
      target: 'siem-server',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'right',
      data: {
        label: 'Database Firewall Logs',
        protocol: 'Syslog',
        encryption: 'none',
        dataClassification: 'Sensitive',
        zone: 'Internal' as SecurityZone,
        controlPoints: [{id:'cp-dfs-0',x:2700,y:400,active:true},{id:'cp-dfs-1',x:2700,y:1000,active:true},{id:'cp-dfs-2',x:2250,y:1000,active:true}]
      }
    } as SecurityEdge,
    {
      id: 'ids1-to-siem',
      source: 'ids-sensor-1',
      target: 'siem-server',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'IDS Alerts 2',
        protocol: 'HTTPS',
        encryption: 'TLS',
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'ewaf-ids-sensor-1-bottom-top',
      source: 'waf',
      target: 'ids-sensor-1',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'WAF to IDS',
        protocol: 'Network Mirror',
        encryption: 'none',
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'eids-sensor-1-waf-top-bottom',
      source: 'ids-sensor-1',
      target: 'waf',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'IDS to WAF',
        protocol: 'Network Mirror',
        encryption: 'none',
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone,
        controlPoints: [{id:'cp-idswaf-1',x:1150,y:700,active:true}]
      }
    } as SecurityEdge,
    {
      id: 'app1-to-cloud-storage',
      source: 'app-server-1',
      target: 'cloud-storage',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Static Asset Upload',
        protocol: 'HTTPS',
        encryption: 'TLS',
        dataClassification: 'Public',
        zone: 'Cloud' as SecurityZone,
        controlPoints: [{id:'cp-a1cs-1',x:2100,y:-250,active:true}]
      }
    } as SecurityEdge,
    {
      id: 'app2-to-cloud-storage',
      source: 'app-server-2',
      target: 'cloud-storage',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Backup Upload',
        protocol: 'HTTPS',
        encryption: 'TLS',
        dataClassification: 'Confidential',
        zone: 'Cloud' as SecurityZone,
        controlPoints: [{id:'cp-a2cs-1',x:2150,y:-400,active:true}]
      }
    } as SecurityEdge,
    {
      id: 'siem-to-cloud-monitoring',
      source: 'siem-server',
      target: 'cloud-monitoring',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Metrics Export',
        protocol: 'HTTPS',
        encryption: 'TLS',
        dataClassification: 'Internal',
        zone: 'Cloud' as SecurityZone,
        controlPoints: [{id:'cp-scm-1',x:2400,y:-200,active:true}]
      }
    } as SecurityEdge,
    {
      id: 'vpn-to-edge-fw',
      source: 'vpn-gateway',
      target: 'edge-firewall',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'VPN Admin Access',
        protocol: 'OpenVPN',
        encryption: 'TLS',
        dataClassification: 'Internal',
        zone: 'Management' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'admin-workstation-to-vpn',
      source: 'admin-workstation',
      target: 'vpn-gateway',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Admin Connection',
        protocol: 'OpenVPN',
        encryption: 'TLS',
        dataClassification: 'Internal',
        zone: 'Management' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'admin-workstation-to-app1',
      source: 'admin-workstation',
      target: 'app-server-1',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Emergency Access',
        protocol: 'SSH',
        encryption: 'SSH',
        dataClassification: 'Internal',
        zone: 'Management' as SecurityZone,
        controlPoints: [{id:'cp-awa1-1',x:1150,y:1200,active:true},{id:'cp-awa1-2',x:1850,y:1200,active:true},{id:'cp-awa1-3',x:2000,y:750,active:true}]
      }
    } as SecurityEdge,
    {
      id: 'git-to-ci',
      source: 'git-server',
      target: 'ci-server',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Git Webhook',
        protocol: 'HTTPS',
        encryption: 'TLS',
        dataClassification: 'Internal',
        zone: 'Development' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'ci-to-build-agent',
      source: 'ci-server',
      target: 'build-agent-1',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Build Jobs',
        protocol: 'SSH',
        encryption: 'SSH',
        dataClassification: 'Internal',
        zone: 'Development' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'ci-to-code-scanner',
      source: 'ci-server',
      target: 'code-scanner',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Code Analysis',
        protocol: 'HTTPS',
        encryption: 'TLS',
        dataClassification: 'Internal',
        zone: 'Development' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'build-agent-to-dev-db',
      source: 'build-agent-1',
      target: 'dev-database',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Test Data Setup',
        protocol: 'MySQL',
        encryption: 'none',
        dataClassification: 'Internal',
        zone: 'Development' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'staging-lb-to-app',
      source: 'staging-lb',
      target: 'staging-app-1',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Load Balanced Traffic',
        protocol: 'HTTP',
        encryption: 'TLS',
        dataClassification: 'Internal',
        zone: 'Staging' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'staging-app-to-db',
      source: 'staging-app-1',
      target: 'staging-database',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Database Queries',
        protocol: 'MySQL',
        encryption: 'SSL',
        dataClassification: 'Internal',
        zone: 'Staging' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'test-automation-to-staging-lb',
      source: 'test-automation',
      target: 'staging-lb',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Automated Tests',
        protocol: 'HTTP',
        encryption: 'TLS',
        dataClassification: 'Internal',
        zone: 'Staging' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'staging-monitor-to-app',
      source: 'staging-monitor',
      target: 'staging-app-1',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'left',
      data: {
        label: 'Performance Metrics',
        protocol: 'Agent Protocol',
        encryption: 'TLS',
        dataClassification: 'Internal',
        zone: 'Staging' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'ci-to-staging-deploy',
      source: 'ci-server',
      target: 'staging-lb',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'top',
      data: {
        label: 'Automated Deployment',
        protocol: 'SSH',
        encryption: 'SSH',
        dataClassification: 'Internal',
        zone: 'Staging' as SecurityZone,
        controlPoints: [{id:'cp-csd-1',x:700,y:1270,active:true},{id:'cp-csd-2',x:1950,y:1270,active:true}]
      }
    } as SecurityEdge,
    {
      id: 'staging-to-production-deploy',
      source: 'staging-app-1',
      target: 'app-server-1',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Production Deployment',
        protocol: 'SSH',
        encryption: 'SSH',
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone,
        controlPoints: [{id:'cp-spd-1',x:2200,y:1150,active:true}]
      }
    } as SecurityEdge,
    {
      id: 'staging-to-production-db-sync',
      source: 'staging-database',
      target: 'primary-db',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Database Migration',
        protocol: 'MySQL',
        encryption: 'SSL',
        dataClassification: 'Sensitive',
        zone: 'Staging' as SecurityZone,
        controlPoints: [{id:'cp-spdbs-1',x:2860,y:1150,active:true}]
      }
    } as SecurityEdge,
    {
      id: 'dev-to-siem',
      source: 'ci-server',
      target: 'siem-server',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'CI/CD Audit Logs',
        protocol: 'Syslog',
        encryption: 'none',
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone,
        controlPoints: [{id:'cp-ds-1',x:350,y:1150,active:true},{id:'cp-ds-2',x:2050,y:1150,active:true}]
      }
    } as SecurityEdge,
    {
      id: 'staging-monitor-to-siem',
      source: 'staging-monitor',
      target: 'siem-server',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Staging Performance Logs',
        protocol: 'HTTPS',
        encryption: 'TLS',
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone,
        controlPoints: [{id:'cp-sms-0',x:2100,y:1750,active:true},{id:'cp-sms-1',x:2100,y:1150,active:true}]
      }
    } as SecurityEdge,
    {
      id: 'vpn-gateway-to-siem',
      source: 'vpn-gateway',
      target: 'siem-server',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'VPN Access Logs',
        protocol: 'Syslog',
        encryption: 'TLS',
        dataClassification: 'Internal',
        zone: 'Management' as SecurityZone,
        controlPoints: [{id:'cp-vgs-1',x:1000,y:1050,active:true},{id:'cp-vgs-2',x:1950,y:1050,active:true}]
      }
    } as SecurityEdge,
    {
      id: 'admin-workstation-to-siem',
      source: 'admin-workstation',
      target: 'siem-server',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Admin Activity Logs',
        protocol: 'HTTPS',
        encryption: 'TLS',
        dataClassification: 'Internal',
        zone: 'Management' as SecurityZone,
        controlPoints: [{id:'cp-aws-1',x:1250,y:1100,active:true},{id:'cp-aws-2',x:2000,y:1100,active:true}]
      }
    } as SecurityEdge
  ],
  attackPaths: [
    {
      id: 'ap-debug-port-db',
      name: 'Internet-Facing Debug Port → Database Compromise',
      strideCategory: 'Elevation of Privilege',
      riskLevel: 'Critical',
      description: 'An attacker exploits the Java debug port (8000) exposed directly to the internet on App Server 1, gains remote code execution on the application server, then pivots through the database firewall to the primary database to exfiltrate or tamper with customer and payment data.',
      steps: [
        {
          order: 1,
          edgeId: 'app1-debug-port',
          sourceNodeId: 'edge-router',
          targetNodeId: 'app-server-1',
          technique: 'T1190: Exploit Public-Facing Application',
        },
        {
          order: 2,
          edgeId: 'app1-to-db-fw',
          sourceNodeId: 'app-server-1',
          targetNodeId: 'db-firewall',
          technique: 'T1078: Valid Accounts (application service account)',
        },
        {
          order: 3,
          edgeId: 'db-fw-to-primary',
          sourceNodeId: 'db-firewall',
          targetNodeId: 'primary-db',
          technique: 'T1005: Data from Local System',
        },
      ],
      mitreTechniques: ['T1190', 'T1078', 'T1005'],
      createdAt: '2025-01-15T09:00:00.000Z',
      updatedAt: '2025-01-15T09:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-waf-bypass-web',
      name: 'WAF Detection-Only Mode → Web Application Exploitation',
      strideCategory: 'Tampering',
      riskLevel: 'High',
      description: 'The WAF is configured in detection-only mode, meaning malicious HTTP requests are logged but not blocked. An attacker bypasses the WAF inspection and reaches the web server with injection payloads (SQLi, XSS, file upload abuse) that would otherwise be blocked in prevention mode.',
      steps: [
        {
          order: 1,
          edgeId: 'internet-to-router',
          sourceNodeId: 'edge-router',
          targetNodeId: 'edge-firewall',
          technique: 'T1595: Active Scanning',
        },
        {
          order: 2,
          edgeId: 'firewall-to-waf',
          sourceNodeId: 'edge-firewall',
          targetNodeId: 'waf',
          technique: 'T1190: Exploit Public-Facing Application',
        },
        {
          order: 3,
          edgeId: 'waf-to-web',
          sourceNodeId: 'waf',
          targetNodeId: 'web-server',
          technique: 'T1059: Command and Scripting Interpreter',
        },
      ],
      mitreTechniques: ['T1595', 'T1190', 'T1059'],
      createdAt: '2025-01-15T09:05:00.000Z',
      updatedAt: '2025-01-15T09:05:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-firewall-bypass-replica',
      name: 'Internal Firewall Bypass → Replica Database Exfiltration',
      strideCategory: 'Information Disclosure',
      riskLevel: 'Critical',
      description: 'The load balancer has a direct unencrypted connection to App Server 2 that bypasses the internal firewall. App Server 2 also has a direct connection to the replica database that bypasses the database firewall. An attacker who compromises the load balancer management interface can reach the replica database without traversing any firewall controls.',
      steps: [
        {
          order: 1,
          edgeId: 'lb-to-app2-direct',
          sourceNodeId: 'load-balancer',
          targetNodeId: 'app-server-2',
          technique: 'T1071: Application Layer Protocol',
        },
        {
          order: 2,
          edgeId: 'app2-to-replica-direct',
          sourceNodeId: 'app-server-2',
          targetNodeId: 'replica-db',
          technique: 'T1041: Exfiltration Over Command and Control Channel',
        },
      ],
      mitreTechniques: ['T1071', 'T1041'],
      createdAt: '2025-01-15T09:10:00.000Z',
      updatedAt: '2025-01-15T09:10:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-cicd-production',
      name: 'CI/CD Pipeline Compromise → Production Lateral Movement',
      strideCategory: 'Elevation of Privilege',
      riskLevel: 'High',
      description: 'An attacker compromises the source code repository (e.g., via stolen developer credentials or a malicious commit), injects malicious code or build steps into the CI pipeline, and rides the automated staging-to-production deployment to execute arbitrary code on production application servers with no additional authentication.',
      steps: [
        {
          order: 1,
          edgeId: 'git-to-ci',
          sourceNodeId: 'git-server',
          targetNodeId: 'ci-server',
          technique: 'T1195: Supply Chain Compromise',
        },
        {
          order: 2,
          edgeId: 'ci-to-build-agent',
          sourceNodeId: 'ci-server',
          targetNodeId: 'build-agent-1',
          technique: 'T1053: Scheduled Task/Job',
        },
        {
          order: 3,
          edgeId: 'staging-to-production-deploy',
          sourceNodeId: 'staging-app-1',
          targetNodeId: 'app-server-1',
          technique: 'T1072: Software Deployment Tools',
        },
      ],
      mitreTechniques: ['T1195', 'T1053', 'T1072'],
      createdAt: '2025-01-15T09:15:00.000Z',
      updatedAt: '2025-01-15T09:15:00.000Z',
    } as DiagramAttackPath,
  ],
};
