import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityNode, SecurityEdge, SecurityZone, DataClassification } from '../../types/SecurityTypes';
import { DiagramAttackPath, AttackPathRiskLevel, AssessmentThreatModelNodeSourceType, AssessmentThreatModelEdgeSourceType, GrcWorkspace } from '../../types/GrcTypes';
import { StrideCategory } from '../../types/ThreatIntelTypes';
import { colors } from '../../styles/Theme';
import { buildGrcWorkspace, score, NOW, OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID } from './grcSharedBase';
const tierCatalogue = [
  { id: 'hbs-tier1-cyber', tier: 1 as const, label: 'Cyber Risk', description: 'Information security and cyber threats to banking operations' },
  { id: 'hbs-tier1-operational', tier: 1 as const, label: 'Operational Risk', description: 'Business continuity, process, and compliance risks' },
  { id: 'hbs-tier1-financial', tier: 1 as const, label: 'Financial Crime Risk', description: 'Fraud, money laundering, and sanctions evasion' },
  { id: 'hbs-tier2-transaction', tier: 2 as const, label: 'Transaction Security', parentId: 'hbs-tier1-cyber', description: 'Payment processing, SWIFT messaging, and transaction integrity' },
  { id: 'hbs-tier2-identity', tier: 2 as const, label: 'Identity & Authentication', parentId: 'hbs-tier1-cyber', description: 'Customer and staff authentication controls' },
  { id: 'hbs-tier2-data', tier: 2 as const, label: 'Data Protection', parentId: 'hbs-tier1-cyber', description: 'Encryption, key management, and data-at-rest/in-transit controls' },
  { id: 'hbs-tier2-network', tier: 2 as const, label: 'Network Perimeter', parentId: 'hbs-tier1-cyber', description: 'WAF, IDS, and zone segregation controls' },
  { id: 'hbs-tier2-compliance', tier: 2 as const, label: 'Regulatory Compliance', parentId: 'hbs-tier1-operational', description: 'PCI-DSS, GDPR, and banking regulation adherence' },
  { id: 'hbs-tier2-legacy', tier: 2 as const, label: 'Legacy Integration', parentId: 'hbs-tier1-operational', description: 'Mainframe-to-microservice bridging and migration risks' },
  { id: 'hbs-tier2-fraud', tier: 2 as const, label: 'Fraud & AML', parentId: 'hbs-tier1-financial', description: 'Transaction fraud detection and anti-money laundering' },
  { id: 'hbs-tier3-api-injection', tier: 3 as const, label: 'API Injection Attacks', parentId: 'hbs-tier2-transaction' },
  { id: 'hbs-tier3-mfa-bypass', tier: 3 as const, label: 'MFA Bypass', parentId: 'hbs-tier2-identity' },
  { id: 'hbs-tier3-key-compromise', tier: 3 as const, label: 'Key Material Compromise', parentId: 'hbs-tier2-data' },
  { id: 'hbs-tier3-waf-evasion', tier: 3 as const, label: 'WAF Evasion', parentId: 'hbs-tier2-network' },
  { id: 'hbs-tier3-atm-physical', tier: 3 as const, label: 'ATM Physical Attacks', parentId: 'hbs-tier2-fraud' },
  { id: 'hbs-tier3-swift-abuse', tier: 3 as const, label: 'SWIFT Message Manipulation', parentId: 'hbs-tier2-transaction' },
  { id: 'hbs-tier3-mainframe-gap', tier: 3 as const, label: 'Mainframe Security Gaps', parentId: 'hbs-tier2-legacy' },
  { id: 'hbs-tier3-pci-drift', tier: 3 as const, label: 'PCI-DSS Control Drift', parentId: 'hbs-tier2-compliance' },
];

const assets = [
  {
    id: 'hbs-asset-core-banking', name: 'Core Banking Engine', type: 'application_server', owner: 'Core Banking Team',
    domain: 'application' as const, category: 'Transaction Processing',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Legacy IBM z/OS mainframe with Kubernetes microservice overlay processing over 1M daily transactions',
    criticality: { confidentiality: 5, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'hybrid-banking-system', nodeId: 'core-banking-process', nodeLabel: 'Core Banking Engine', nodeType: 'dfdProcess' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hbs-asset-payment-gw', name: 'API Management Platform', type: 'api_gateway', owner: 'Platform Engineering',
    domain: 'application' as const, category: 'API Gateway',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Central API gateway still being implemented; handles rate limiting, OAuth 2.0 auth, and GraphQL federation',
    criticality: { confidentiality: 4, integrity: 5, availability: 5, financial: 5, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'hybrid-banking-system', nodeId: 'api-gateway-process', nodeLabel: 'API Management Platform', nodeType: 'dfdProcess' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hbs-asset-mobile-mfa', name: 'Multi-Factor Authentication Service', type: 'identity_provider', owner: 'Identity & Access Management',
    domain: 'it' as const, category: 'Identity',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Okta-based MFA service supporting biometric, push notification, and hardware token factors for all channels',
    criticality: { confidentiality: 5, integrity: 5, availability: 4, financial: 4, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'hybrid-banking-system', nodeId: 'mfa-service', nodeLabel: 'Multi-Factor Auth', nodeType: 'mfa' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hbs-asset-fraud-engine', name: 'Fraud Detection Engine', type: 'application_server', owner: 'Fraud Operations',
    domain: 'application' as const, category: 'Security Analytics',
    businessCriticality: 5, securityCriticality: 4,
    description: 'Real-time ML-based fraud detection using TensorFlow models with behavioral analysis and rule engine',
    criticality: { confidentiality: 4, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'hybrid-banking-system', nodeId: 'fraud-detection', nodeLabel: 'Fraud Detection Engine', nodeType: 'fraudDetection' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hbs-asset-customer-db', name: 'Customer Master Data', type: 'database', owner: 'Database Administration',
    domain: 'application' as const, category: 'Database',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Oracle RAC cluster holding all customer PII, account details, and KYC documentation with real-time DR replication',
    criticality: { confidentiality: 5, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'hybrid-banking-system', nodeId: 'customer-data-store', nodeLabel: 'Customer Master Data', nodeType: 'dfdDataStore' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hbs-asset-hsm', name: 'Hardware Security Module', type: 'crypto_device', owner: 'Cryptographic Operations',
    domain: 'it' as const, category: 'Security Infrastructure',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Thales Luna 7 HSM managing all encryption keys, PIN verification, and transaction signing (FIPS 140-2 Level 3)',
    criticality: { confidentiality: 5, integrity: 5, availability: 4, financial: 5, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'hybrid-banking-system', nodeId: 'hsm', nodeLabel: 'Hardware Security Module', nodeType: 'hsm' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hbs-asset-waf', name: 'Web Application Firewall', type: 'security_appliance', owner: 'Security Operations',
    domain: 'it' as const, category: 'Network Security',
    businessCriticality: 4, securityCriticality: 5,
    description: 'Cloudflare Enterprise WAF with OWASP Core Rule Set, DDoS protection, and bot management for all web traffic',
    criticality: { confidentiality: 3, integrity: 4, availability: 5, financial: 4, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'hybrid-banking-system', nodeId: 'waf', nodeLabel: 'Web Application Firewall', nodeType: 'waf' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hbs-asset-aml-monitor', name: 'AML Transaction Monitor', type: 'application_server', owner: 'Compliance',
    domain: 'application' as const, category: 'Compliance Systems',
    businessCriticality: 5, securityCriticality: 4,
    description: 'NICE Actimize AML monitoring system with pattern detection, risk scoring, and case management for regulatory reporting',
    criticality: { confidentiality: 4, integrity: 5, availability: 4, financial: 5, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'hybrid-banking-system', nodeId: 'transaction-monitor', nodeLabel: 'AML Transaction Monitor', nodeType: 'transactionMonitor' }],
    createdAt: NOW, updatedAt: NOW
  },
];

const risks = [
  {
    id: 'hbs-risk-api-gateway-vuln', title: 'API Gateway Design-Phase Vulnerabilities',
    description: 'API Management Platform is still in design phase with incomplete security controls. Rate limiting and OAuth 2.0 configurations are not hardened, allowing potential authentication bypass and resource exhaustion attacks against core banking APIs.',
    status: 'assessed' as const, owner: 'Platform Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Transaction Security', tier3: 'API Injection Attacks' },
    assetIds: ['hbs-asset-payment-gw', 'hbs-asset-core-banking'],
    diagramLinks: [{ diagramId: 'hybrid-banking-system', nodeIds: ['api-gateway-process', 'core-banking-process'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Complete API gateway security hardening including input validation, rate limiting per-client, and OAuth 2.0 PKCE enforcement before production launch',
    threatActorIds: ['hbs-threat-actor-organised-crime'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hbs-risk-payment-fraud', title: 'Real-Time Payment Fraud via Transaction Manipulation',
    description: 'Sophisticated attackers can exploit timing gaps between fraud detection engine analysis and transaction commitment in the core banking system, enabling high-value fraudulent transfers before ML models trigger alerts.',
    status: 'assessed' as const, owner: 'Fraud Operations',
    tierPath: { tier1: 'Financial Crime Risk', tier2: 'Fraud & AML', tier3: 'SWIFT Message Manipulation' },
    assetIds: ['hbs-asset-core-banking', 'hbs-asset-fraud-engine'],
    diagramLinks: [{ diagramId: 'hybrid-banking-system', nodeIds: ['core-banking-process', 'fraud-detection'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Implement synchronous fraud scoring in transaction pipeline; add velocity checks and transaction hold mechanism for high-value transfers',
    threatActorIds: ['hbs-threat-actor-organised-crime'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hbs-risk-customer-data-breach', title: 'Customer Master Data Breach via SQL Injection',
    description: 'Legacy Oracle RAC database accessed by core banking engine using dynamic queries is vulnerable to second-order SQL injection. Successful exploitation exposes millions of customer PII records, KYC documents, and account details.',
    status: 'assessed' as const, owner: 'Database Administration',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Data Protection', tier3: 'Key Material Compromise' },
    assetIds: ['hbs-asset-customer-db', 'hbs-asset-core-banking'],
    diagramLinks: [{ diagramId: 'hybrid-banking-system', nodeIds: ['customer-data-store', 'core-banking-process'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Migrate all database access to parameterized stored procedures; deploy database activity monitoring; implement field-level encryption for PII columns',
    threatActorIds: ['hbs-threat-actor-nation-state'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hbs-risk-atm-jackpotting', title: 'ATM Skimming and Jackpotting via Partner Network',
    description: 'Partner bank network connections to the API gateway lack sufficient mutual authentication. Compromised partner endpoints could inject malicious SWIFT messages or manipulate ATM authorization responses to dispense cash without valid transactions.',
    status: 'draft' as const, owner: 'Physical Security',
    tierPath: { tier1: 'Financial Crime Risk', tier2: 'Fraud & AML', tier3: 'ATM Physical Attacks' },
    assetIds: ['hbs-asset-payment-gw', 'hbs-asset-core-banking'],
    diagramLinks: [{ diagramId: 'hybrid-banking-system', nodeIds: ['partner-banks', 'api-gateway-process', 'core-banking-process'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Enforce mTLS on all partner bank connections; implement SWIFT CSP mandatory controls; add real-time ATM transaction velocity monitoring',
    threatActorIds: ['hbs-threat-actor-organised-crime'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hbs-risk-insider-fraud', title: 'Insider Access to Transaction Vault and Key Store',
    description: 'Operations staff with access to both the HSM administration interface and the transaction vault can potentially bypass dual-control requirements to forge transaction signatures or manipulate the immutable ledger.',
    status: 'assessed' as const, owner: 'Internal Audit',
    tierPath: { tier1: 'Financial Crime Risk', tier2: 'Fraud & AML' },
    assetIds: ['hbs-asset-hsm', 'hbs-asset-core-banking'],
    diagramLinks: [{ diagramId: 'hybrid-banking-system', nodeIds: ['hsm', 'transaction-vault', 'core-banking-process'] }],
    inherentScore: score('likelihood-2', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Enforce M-of-N key ceremony for HSM operations; implement separation of duties between vault administration and transaction processing; add real-time alerting on HSM admin actions',
    threatActorIds: ['hbs-threat-actor-insider'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hbs-risk-cloud-migration-gaps', title: 'Security Gaps During Mainframe-to-Cloud Migration',
    description: 'Core banking modernization from IBM z/OS to Kubernetes introduces temporary dual-stack architecture where legacy mainframe security controls do not extend to containerized microservices, creating blind spots in transaction monitoring and audit trails.',
    status: 'assessed' as const, owner: 'Core Banking Team',
    tierPath: { tier1: 'Operational Risk', tier2: 'Legacy Integration', tier3: 'Mainframe Security Gaps' },
    assetIds: ['hbs-asset-core-banking', 'hbs-asset-aml-monitor'],
    diagramLinks: [{ diagramId: 'hybrid-banking-system', nodeIds: ['core-banking-process', 'transaction-monitor'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Implement unified logging across mainframe and Kubernetes; extend AML monitoring to containerized transaction flows; perform parallel-run testing before cutover',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hbs-risk-legacy-integration', title: 'Legacy System Integration Exposes Internal APIs',
    description: 'The bridge between legacy mainframe and modern microservices uses unencrypted internal APIs for backward compatibility. IDS monitoring does not inspect internal-zone traffic, allowing lateral movement from compromised DMZ components to core banking systems.',
    status: 'assessed' as const, owner: 'Platform Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Network Perimeter', tier3: 'WAF Evasion' },
    assetIds: ['hbs-asset-core-banking', 'hbs-asset-payment-gw'],
    diagramLinks: [{ diagramId: 'hybrid-banking-system', nodeIds: ['api-gateway-process', 'core-banking-process', 'ids'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Encrypt all internal API traffic with mTLS; extend IDS monitoring to internal zone; implement microsegmentation between mainframe and microservices',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hbs-risk-regulatory-noncompliance', title: 'PCI-DSS Compliance Drift in Card Processing',
    description: 'Ongoing modernization has introduced Kubernetes workloads that are not yet covered by PCI-DSS scope assessments. HSM key rotation schedules have drifted past quarterly requirements, and AML reporting latency exceeds regulatory thresholds.',
    status: 'assessed' as const, owner: 'Compliance',
    tierPath: { tier1: 'Operational Risk', tier2: 'Regulatory Compliance', tier3: 'PCI-DSS Control Drift' },
    assetIds: ['hbs-asset-hsm', 'hbs-asset-aml-monitor', 'hbs-asset-core-banking'],
    diagramLinks: [{ diagramId: 'hybrid-banking-system', nodeIds: ['hsm', 'transaction-monitor', 'core-banking-process'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Extend PCI-DSS scope to Kubernetes workloads; restore quarterly HSM key rotation; optimize AML pipeline to meet 24-hour reporting SLA',
    createdAt: NOW, updatedAt: NOW
  },
];

const assessments = [
  {
    id: 'hbs-assessment-banking-review', title: 'Hybrid Banking Platform Security Assessment',
    status: 'in_review' as const,
    owner: 'Chief Information Security Officer',
    reviewer: 'External Auditor (PwC)',
    startDate: '2025-05-01',
    dueDate: '2025-07-15',
    threatActorIds: ['hbs-threat-actor-organised-crime', 'hbs-threat-actor-nation-state', 'hbs-threat-actor-insider'],
    methodologyNote: 'Assessment follows PCI-DSS v4.0 requirements mapped to OWASP Top 10 and MITRE ATT&CK for Financial Services. SWIFT CSP controls evaluated for inter-bank messaging.',
    assumptionNote: 'Assessment covers production banking environment. Development and disaster recovery sites excluded from scope. Partner bank controls assessed only at integration boundary.',
    scopeItems: [
      { id: 'hbs-scope-system', type: 'system' as const, value: 'system', name: 'Hybrid Banking Platform' },
      { id: 'hbs-scope-dmz', type: 'diagram_segment' as const, value: 'DMZ', name: 'DMZ Security Zone' },
      { id: 'hbs-scope-internal', type: 'diagram_segment' as const, value: 'Internal', name: 'Internal Banking Zone' },
      { id: 'hbs-scope-restricted', type: 'diagram_segment' as const, value: 'Restricted', name: 'Restricted Cryptographic Zone' },
    ],
    tierFilter: { tier1: 'Cyber Risk' },
    riskManagementPlan: {
      objective: 'Remediate API gateway design weaknesses, close legacy integration gaps, and ensure PCI-DSS compliance across hybrid mainframe-cloud architecture.',
      strategy: 'Prioritize API gateway hardening and customer data protection, then address legacy integration risks and compliance drift.',
      residualRiskStatement: 'Residual risk accepted for mainframe legacy APIs during migration period with compensating IDS monitoring controls.',
      monitoringApproach: 'Daily fraud detection review, weekly risk treatment progress, monthly PCI-DSS compliance checkpoint.',
      communicationPlan: 'Report to Banking Security Steering Committee bi-weekly; regulatory updates to compliance officer weekly.',
      reviewCadenceDays: 14,
      actions: [
        {
          id: 'hbs-rmp-action-api-hardening',
          title: 'Complete API gateway security hardening with OAuth 2.0 PKCE and rate limiting',
          owner: 'Platform Engineering',
          dueDate: '2025-06-15',
          status: 'in_progress' as const,
          linkedRiskIds: ['hbs-risk-api-gateway-vuln'],
          notes: 'OAuth 2.0 PKCE implemented; rate limiting per-client being tested in staging'
        },
        {
          id: 'hbs-rmp-action-db-parameterize',
          title: 'Migrate all database access to parameterized stored procedures',
          owner: 'Database Administration',
          dueDate: '2025-06-30',
          status: 'planned' as const,
          linkedRiskIds: ['hbs-risk-customer-data-breach'],
          notes: 'Inventory of dynamic queries completed; migration plan drafted'
        },
        {
          id: 'hbs-rmp-action-internal-mtls',
          title: 'Encrypt all internal API traffic with mTLS between mainframe bridge and microservices',
          owner: 'Platform Engineering',
          dueDate: '2025-07-01',
          status: 'planned' as const,
          linkedRiskIds: ['hbs-risk-legacy-integration'],
          notes: 'Certificate authority provisioned; waiting on mainframe team compatibility testing'
        },
        {
          id: 'hbs-rmp-action-pci-scope',
          title: 'Extend PCI-DSS scope assessment to Kubernetes workloads',
          owner: 'Compliance',
          dueDate: '2025-06-20',
          status: 'in_progress' as const,
          linkedRiskIds: ['hbs-risk-regulatory-noncompliance'],
          notes: 'QSA engaged; network segmentation documentation in progress'
        },
      ],
      updatedAt: NOW
    },
    riskIds: risks.map(r => r.id),
    soaGapIds: ['hbs-soa-a01', 'hbs-soa-a04', 'hbs-soa-a07'],
    taskIds: ['hbs-task-api-hardening', 'hbs-task-db-migration', 'hbs-task-mtls-rollout', 'hbs-task-pci-scope', 'hbs-task-hsm-rotation', 'hbs-task-aml-pipeline'],
    linkedImplementedControlIds: [],
    linkedInitiativeIds: [],
    summary: 'Security assessment of hybrid banking platform identifying 8 risks across API security, data protection, legacy integration, and regulatory compliance. 2 rated Critical, 4 High, 2 Medium.',
    findings: 'Key findings include design-phase API gateway with incomplete security controls, legacy mainframe integration gaps enabling lateral movement, HSM key rotation drift beyond PCI-DSS requirements, and timing vulnerabilities in fraud detection pipeline.',
    recommendations: 'Prioritize API gateway hardening before production launch, migrate database access to parameterized queries, enforce mTLS on all internal APIs, and restore PCI-DSS compliance for Kubernetes workloads.',
    evidenceSummary: 'Evidence includes API gateway configuration exports, Oracle RAC audit logs, HSM key rotation schedules, IDS rule coverage reports, and PCI-DSS scope documentation.',
    threatModel: {
      nodes: [
        { id: 'hbs-tm-retail', label: 'Retail Customers', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'retail-customers', position: { x: 50, y: 150 }, nodeType: 'dfdActor' },
        { id: 'hbs-tm-waf', label: 'WAF', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'waf', position: { x: 200, y: 100 }, nodeType: 'waf', commentary: 'First line of defence for web traffic' },
        { id: 'hbs-tm-api', label: 'API Gateway', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'api-gateway-process', position: { x: 350, y: 150 }, nodeType: 'dfdProcess', commentary: 'Still in design phase with incomplete security controls' },
        { id: 'hbs-tm-mfa', label: 'MFA Service', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'mfa-service', position: { x: 350, y: 300 }, nodeType: 'mfa' },
        { id: 'hbs-tm-core', label: 'Core Banking', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'core-banking-process', position: { x: 550, y: 150 }, nodeType: 'dfdProcess', commentary: 'Dual-stack mainframe + Kubernetes with migration gaps' },
        { id: 'hbs-tm-fraud', label: 'Fraud Detection', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'fraud-detection', position: { x: 550, y: 300 }, nodeType: 'fraudDetection', commentary: 'Timing gap between analysis and transaction commitment' },
        { id: 'hbs-tm-customer-db', label: 'Customer Data', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'customer-data-store', position: { x: 750, y: 150 }, nodeType: 'dfdDataStore', commentary: 'Oracle RAC with dynamic query patterns vulnerable to injection' },
        { id: 'hbs-tm-hsm', label: 'HSM', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'hsm', position: { x: 750, y: 300 }, nodeType: 'hsm', commentary: 'Key rotation drifted past PCI-DSS quarterly requirement' },
      ],
      edges: [
        { id: 'hbs-tm-edge-retail-waf', source: 'hbs-tm-retail', target: 'hbs-tm-waf', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e1', label: 'Web/Mobile Traffic (TLS 1.3)' },
        { id: 'hbs-tm-edge-waf-api', source: 'hbs-tm-waf', target: 'hbs-tm-api', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e2', label: 'Filtered Requests' },
        { id: 'hbs-tm-edge-api-mfa', source: 'hbs-tm-api', target: 'hbs-tm-mfa', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e3', label: 'Auth Requests (OIDC)' },
        { id: 'hbs-tm-edge-api-core', source: 'hbs-tm-api', target: 'hbs-tm-core', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e4', label: 'Authenticated API Calls (mTLS)', commentary: 'mTLS not yet enforced during migration' },
        { id: 'hbs-tm-edge-core-fraud', source: 'hbs-tm-core', target: 'hbs-tm-fraud', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e7', label: 'Transaction Feed (gRPC)', commentary: 'Asynchronous feed creates timing gap for fraud bypass' },
        { id: 'hbs-tm-edge-core-db', source: 'hbs-tm-core', target: 'hbs-tm-customer-db', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e9', label: 'Customer Data Access', commentary: 'Dynamic queries without parameterization' },
        { id: 'hbs-tm-edge-core-hsm', source: 'hbs-tm-core', target: 'hbs-tm-hsm', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e11', label: 'Crypto Operations (PKCS#11)' },
      ],
      attackPathDescription: 'Three primary attack chains identified: (1) External attacker bypasses design-phase API gateway to reach core banking and exfiltrate customer data via SQL injection; (2) Partner bank compromise enables fraudulent SWIFT transactions that bypass timing-gapped fraud detection; (3) Insider with HSM access manipulates transaction vault integrity.',
      attackPaths: [
        {
          id: 'hbs-aap-api-sqli-exfil',
          name: 'API Gateway Bypass → Core Banking → Customer Data Exfiltration',
          strideCategory: 'Information Disclosure' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'Attacker exploits incomplete API gateway controls to bypass rate limiting and authentication, reaches core banking engine, and executes second-order SQL injection against Customer Master Data to exfiltrate millions of PII records.',
          diagramAttackPathId: 'hbs-ap-api-sqli-exfil',
          steps: [
            { order: 1, edgeId: 'e1', sourceNodeId: 'retail-customers', targetNodeId: 'waf', technique: 'T1190: Exploit Public-Facing Application' },
            { order: 2, edgeId: 'e2', sourceNodeId: 'waf', targetNodeId: 'api-gateway-process', technique: 'T1071: Application Layer Protocol' },
            { order: 3, edgeId: 'e4', sourceNodeId: 'api-gateway-process', targetNodeId: 'core-banking-process', technique: 'T1078: Valid Accounts' },
            { order: 4, edgeId: 'e9', sourceNodeId: 'core-banking-process', targetNodeId: 'customer-data-store', technique: 'T1005: Data from Local System' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
        {
          id: 'hbs-aap-partner-swift-fraud',
          name: 'Partner Compromise → SWIFT Transaction Fraud',
          strideCategory: 'Tampering' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'Compromised partner bank injects malicious SWIFT messages through API gateway without mTLS enforcement, manipulates core banking transaction processing during the fraud detection timing gap to commit high-value fraudulent transfers.',
          diagramAttackPathId: 'hbs-ap-partner-swift-fraud',
          steps: [
            { order: 1, edgeId: 'e6', sourceNodeId: 'partner-banks', targetNodeId: 'api-gateway-process', technique: 'T1199: Trusted Relationship' },
            { order: 2, edgeId: 'e4', sourceNodeId: 'api-gateway-process', targetNodeId: 'core-banking-process', technique: 'T1071: Application Layer Protocol' },
            { order: 3, edgeId: 'e7', sourceNodeId: 'core-banking-process', targetNodeId: 'fraud-detection', technique: 'T1562: Impair Defenses' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
        {
          id: 'hbs-aap-insider-vault',
          name: 'Insider HSM Access → Transaction Vault Manipulation',
          strideCategory: 'Elevation of Privilege' as StrideCategory,
          riskLevel: 'High' as AttackPathRiskLevel,
          description: 'Malicious insider with HSM administrative access bypasses dual-control requirements, generates unauthorized signing keys, and uses them to forge transaction signatures in the immutable transaction vault.',
          diagramAttackPathId: 'hbs-ap-insider-vault',
          steps: [
            { order: 1, edgeId: 'e11', sourceNodeId: 'core-banking-process', targetNodeId: 'hsm', technique: 'T1078: Valid Accounts' },
            { order: 2, edgeId: 'e12', sourceNodeId: 'hsm', targetNodeId: 'key-store', technique: 'T1552: Unsecured Credentials' },
            { order: 3, edgeId: 'e10', sourceNodeId: 'core-banking-process', targetNodeId: 'transaction-vault', technique: 'T1565: Data Manipulation' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
      ],
      updatedAt: NOW,
    },
    createdAt: NOW, updatedAt: NOW
  },
];

const soaEntries = [
  {
    id: 'hbs-soa-a01', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A01', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'API gateway OAuth 2.0 enforcement incomplete during design phase. Core banking engine uses legacy session-based auth for mainframe components. MFA integration solid for customer-facing channels.',
    mitigatesRiskIds: ['hbs-risk-api-gateway-vuln'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'hbs-soa-a02', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A02', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'implemented' as const,
    justification: 'HSM manages all cryptographic keys with FIPS 140-2 Level 3 certification. TLS 1.3 enforced on external connections. Internal API encryption pending mTLS rollout.',
    mitigatesRiskIds: ['hbs-risk-insider-fraud'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'hbs-soa-a03', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A03', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Core banking engine uses dynamic SQL queries for legacy Oracle RAC access. Parameterized stored procedure migration planned but not started for mainframe bridge components.',
    mitigatesRiskIds: ['hbs-risk-customer-data-breach'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'hbs-soa-a04', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A04', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'API gateway is in design phase without formal threat model. Fraud detection timing gap not addressed in architecture. Legacy integration bridge lacks security design review.',
    mitigatesRiskIds: ['hbs-risk-api-gateway-vuln', 'hbs-risk-legacy-integration'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'hbs-soa-a05', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A05', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'WAF OWASP Core Rule Set deployed. Kubernetes security policies partially configured. IDS covers DMZ but not internal zone traffic between mainframe and microservices.',
    mitigatesRiskIds: ['hbs-risk-legacy-integration'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'hbs-soa-a07', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A07', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'MFA service deployed via Okta but partner bank connections lack mutual authentication. SWIFT interface uses shared API keys without per-transaction signing.',
    mitigatesRiskIds: ['hbs-risk-atm-jackpotting'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'hbs-soa-a09', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A09', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'IDS deployed in DMZ with Suricata. Fraud detection engine provides transaction-level monitoring. However, internal zone traffic between mainframe and Kubernetes is not inspected. AML reporting latency exceeds regulatory thresholds.',
    mitigatesRiskIds: ['hbs-risk-cloud-migration-gaps', 'hbs-risk-regulatory-noncompliance'],
    diagramRefs: [],
    evidence: [
      { id: 'hbs-evidence-ids-config', kind: 'link' as const, name: 'IDS rule coverage report', url: 'https://security.bank.internal/reports/ids-coverage', note: 'Quarterly review', createdAt: NOW }
    ],
    updatedAt: NOW
  },
  {
    id: 'hbs-soa-cis03', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.03', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Customer data encrypted at rest in Oracle RAC via TDE. Transaction vault uses cryptographic proofs. HSM key rotation drifted past quarterly schedule. Internal API traffic lacks encryption.',
    mitigatesRiskIds: ['hbs-risk-customer-data-breach', 'hbs-risk-regulatory-noncompliance'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'hbs-soa-cis05', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.05', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'implemented' as const,
    justification: 'Okta MFA manages all customer and staff accounts with SAML/OIDC federation. Hardware tokens required for HSM administration. Service accounts audited quarterly.',
    mitigatesRiskIds: [],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'hbs-soa-cis06', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.06', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'RBAC configured for Kubernetes workloads. Mainframe RACF profiles maintained but not integrated with modern IAM. Separation of duties not enforced for HSM and vault administration.',
    mitigatesRiskIds: ['hbs-risk-insider-fraud'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
];

const workflowTasks = [
  {
    id: 'hbs-task-api-hardening',
    title: 'Complete API gateway OAuth 2.0 PKCE and rate limiting hardening',
    description: 'Finalize security configuration for API Management Platform including per-client rate limits, input validation, and OAuth 2.0 PKCE flow enforcement.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'critical' as const,
    owner: 'Platform Engineering',
    dueDate: '2025-06-15',
    riskId: 'hbs-risk-api-gateway-vuln',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hbs-task-db-migration',
    title: 'Migrate Oracle RAC access to parameterized stored procedures',
    description: 'Replace all dynamic SQL queries in core banking engine with parameterized stored procedures to eliminate SQL injection risk.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'critical' as const,
    owner: 'Database Administration',
    dueDate: '2025-06-30',
    riskId: 'hbs-risk-customer-data-breach',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hbs-task-mtls-rollout',
    title: 'Deploy mTLS for all internal API traffic between mainframe and microservices',
    description: 'Provision certificates and enforce mutual TLS on all internal zone API communications.',
    type: 'control_implementation' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Platform Engineering',
    dueDate: '2025-07-01',
    riskId: 'hbs-risk-legacy-integration',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hbs-task-pci-scope',
    title: 'Extend PCI-DSS scope assessment to Kubernetes workloads',
    description: 'Engage QSA to evaluate Kubernetes container infrastructure for PCI-DSS compliance; document network segmentation and cardholder data flows.',
    type: 'assessment' as const,
    status: 'in_progress' as const,
    priority: 'high' as const,
    owner: 'Compliance',
    dueDate: '2025-06-20',
    riskId: 'hbs-risk-regulatory-noncompliance',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hbs-task-hsm-rotation',
    title: 'Restore quarterly HSM key rotation schedule',
    description: 'Re-establish automated key rotation for all HSM-managed keys to comply with PCI-DSS quarterly rotation requirement.',
    type: 'control_implementation' as const,
    status: 'blocked' as const,
    priority: 'high' as const,
    owner: 'Cryptographic Operations',
    dueDate: '2025-07-01',
    riskId: 'hbs-risk-regulatory-noncompliance',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hbs-task-aml-pipeline',
    title: 'Optimize AML transaction monitoring pipeline for regulatory SLA',
    description: 'Reduce AML reporting latency from 48 hours to under 24 hours to meet regulatory thresholds; extend monitoring to Kubernetes transaction flows.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'medium' as const,
    owner: 'Compliance',
    dueDate: '2025-07-15',
    riskId: 'hbs-risk-cloud-migration-gaps',
    createdAt: NOW, updatedAt: NOW
  },
];

const governanceDocuments = [
  {
    id: 'hbs-gov-pci-dss',
    title: 'PCI-DSS v4.0 Compliance Policy',
    type: 'policy' as const,
    description: 'Defines PCI-DSS requirements for all card processing systems including HSM key management, network segmentation, and cardholder data protection across mainframe and cloud environments.',
    owner: 'Compliance',
    status: 'active' as const,
    version: '4.0',
    url: 'https://compliance.bank.internal/policies/pci-dss-v4.pdf',
    reviewDate: '2025-03-01',
    nextReviewDate: '2025-09-01',
    tags: ['pci-dss', 'card-processing', 'compliance'],
    linkedRiskIds: ['hbs-risk-regulatory-noncompliance'],
    linkedControlSetIds: [OWASP_CONTROL_SET_ID],
    linkedAssessmentIds: ['hbs-assessment-banking-review'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hbs-gov-banking-security',
    title: 'Digital Banking Security Policy',
    type: 'policy' as const,
    description: 'Corporate security policy for digital banking operations covering authentication requirements, transaction security, fraud prevention, and incident response for all customer-facing channels.',
    owner: 'CISO',
    status: 'active' as const,
    version: '2.3',
    url: 'https://compliance.bank.internal/policies/digital-banking-security.pdf',
    reviewDate: '2025-01-15',
    nextReviewDate: '2025-07-15',
    tags: ['security', 'banking', 'digital-channels'],
    linkedRiskIds: ['hbs-risk-api-gateway-vuln', 'hbs-risk-payment-fraud'],
    linkedControlSetIds: [OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID],
    linkedAssessmentIds: ['hbs-assessment-banking-review'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hbs-gov-swift-csp',
    title: 'SWIFT Customer Security Programme Controls',
    type: 'standard' as const,
    description: 'Implementation of SWIFT CSP mandatory and advisory controls for inter-bank messaging security, operator authentication, and message integrity verification.',
    owner: 'Treasury Operations',
    status: 'under_review' as const,
    version: '2024',
    url: 'https://compliance.bank.internal/standards/swift-csp-2024.pdf',
    reviewDate: '2024-12-01',
    nextReviewDate: '2025-06-01',
    tags: ['swift', 'inter-bank', 'messaging'],
    linkedRiskIds: ['hbs-risk-atm-jackpotting', 'hbs-risk-payment-fraud'],
    linkedControlSetIds: [],
    linkedAssessmentIds: ['hbs-assessment-banking-review'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hbs-gov-crypto-sop',
    title: 'Cryptographic Key Management SOP',
    type: 'sop' as const,
    description: 'Standard operating procedure for HSM key generation, rotation, distribution, and destruction including M-of-N ceremony requirements and emergency key recovery processes.',
    owner: 'Cryptographic Operations',
    status: 'active' as const,
    version: '1.5',
    url: 'https://compliance.bank.internal/sops/crypto-key-management.pdf',
    reviewDate: '2025-02-01',
    nextReviewDate: '2025-08-01',
    tags: ['hsm', 'cryptography', 'key-management'],
    linkedRiskIds: ['hbs-risk-insider-fraud', 'hbs-risk-regulatory-noncompliance'],
    linkedControlSetIds: [CIS_CONTROL_SET_ID],
    linkedAssessmentIds: [],
    createdAt: NOW, updatedAt: NOW
  },
];

const threatActors = [
  {
    id: 'hbs-threat-actor-organised-crime', name: 'Financial Cybercrime Syndicate',
    type: 'organised_crime' as const, capabilityLevel: 4,
    resourceLevel: 'high' as const,
    motivation: 'Financial gain through payment fraud, account takeover, ATM jackpotting, and ransom demands targeting banking infrastructure.',
    description: 'Sophisticated organised crime group specialising in financial sector attacks. Employs custom malware for ATM networks, exploits API vulnerabilities for fraudulent transactions, and leverages social engineering for initial access.',
    targetedAssetIds: ['hbs-asset-payment-gw', 'hbs-asset-core-banking', 'hbs-asset-fraud-engine'],
    tags: ['financial-crime', 'payment-fraud', 'atm-attacks'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hbs-threat-actor-nation-state', name: 'State-Sponsored Financial Espionage',
    type: 'nation_state' as const, capabilityLevel: 5,
    resourceLevel: 'very_high' as const,
    motivation: 'Strategic intelligence gathering on financial transactions, sanctions evasion infrastructure, and disruption of banking operations for geopolitical leverage.',
    description: 'Nation-state threat actor targeting SWIFT messaging infrastructure and customer databases for intelligence collection. Capable of long-term persistent access and sophisticated supply-chain compromise through partner bank networks.',
    targetedAssetIds: ['hbs-asset-customer-db', 'hbs-asset-hsm', 'hbs-asset-core-banking'],
    tags: ['nation-state', 'espionage', 'swift-targeting'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hbs-threat-actor-insider', name: 'Malicious Operations Insider',
    type: 'insider' as const, capabilityLevel: 3,
    resourceLevel: 'moderate' as const,
    motivation: 'Financial gain through unauthorised transaction manipulation, selling customer data on dark markets, or sabotage of banking operations for personal grievance.',
    description: 'Current or former operations engineer with legitimate access to HSM administration, transaction vault, and internal banking APIs. Understands dual-control bypass opportunities and has knowledge of legacy system weaknesses.',
    targetedAssetIds: ['hbs-asset-hsm', 'hbs-asset-core-banking', 'hbs-asset-customer-db'],
    tags: ['insider-threat', 'privileged-access', 'hsm-access'],
    createdAt: NOW, updatedAt: NOW
  },
];

const threatScenarios = [
  {
    id: 'hbs-scenario-api-data-breach', title: 'API Gateway Exploitation Leading to Customer Data Breach',
    description: 'Organised crime group exploits incomplete API gateway security controls during design phase to bypass rate limiting and authentication, chains SQL injection through core banking engine to exfiltrate millions of customer PII records from Oracle RAC database.',
    threatActorId: 'hbs-threat-actor-organised-crime',
    targetedAssetIds: ['hbs-asset-payment-gw', 'hbs-asset-core-banking', 'hbs-asset-customer-db'],
    attackTechniques: ['T1190 - Exploit Public-Facing Application', 'T1078 - Valid Accounts', 'T1005 - Data from Local System'],
    linkedRiskIds: ['hbs-risk-api-gateway-vuln', 'hbs-risk-customer-data-breach'],
    likelihood: 'High - API gateway design phase leaves controls incomplete and testable.',
    impact: 'Critical - breach of millions of customer records triggers mandatory notification and regulatory fines.',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hbs-scenario-swift-fraud', title: 'Partner Network Compromise for SWIFT Transaction Fraud',
    description: 'State-sponsored actor compromises partner bank credentials, injects fraudulent SWIFT messages through API gateway lacking mTLS enforcement, and exploits fraud detection timing gap to commit high-value cross-border transfers before alerts trigger.',
    threatActorId: 'hbs-threat-actor-nation-state',
    targetedAssetIds: ['hbs-asset-payment-gw', 'hbs-asset-core-banking', 'hbs-asset-fraud-engine'],
    attackTechniques: ['T1199 - Trusted Relationship', 'T1071 - Application Layer Protocol', 'T1562 - Impair Defenses'],
    linkedRiskIds: ['hbs-risk-payment-fraud', 'hbs-risk-atm-jackpotting'],
    likelihood: 'Moderate - requires partner compromise but weak mTLS enforcement lowers barrier.',
    impact: 'Critical - fraudulent SWIFT transfers can result in multi-million dollar losses.',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'hbs-scenario-insider-vault', title: 'Insider HSM Abuse and Transaction Vault Tampering',
    description: 'Disgruntled operations engineer with HSM administrative access exploits weak dual-control enforcement to generate unauthorized signing keys, then uses them to forge transaction signatures in the immutable vault, manipulating account balances.',
    threatActorId: 'hbs-threat-actor-insider',
    targetedAssetIds: ['hbs-asset-hsm', 'hbs-asset-core-banking'],
    attackTechniques: ['T1078 - Valid Accounts', 'T1552 - Unsecured Credentials', 'T1565 - Data Manipulation'],
    linkedRiskIds: ['hbs-risk-insider-fraud', 'hbs-risk-regulatory-noncompliance'],
    likelihood: 'Low - requires HSM admin access and knowledge of dual-control weaknesses.',
    impact: 'Critical - transaction vault manipulation undermines financial integrity and regulatory trust.',
    createdAt: NOW, updatedAt: NOW
  },
];

export const hybridBankingSystemGrcWorkspace: GrcWorkspace = buildGrcWorkspace({
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
      id: 'hbs-si-api-zero-trust', title: 'API Gateway Zero Trust Architecture',
      description: 'Implement zero trust security model across all API gateway endpoints with mTLS, OAuth2 token binding, and runtime API threat detection.',
      category: 'transformation' as const, status: 'in_progress' as const, priority: 'critical' as const,
      owner: 'Platform Engineering', executiveSponsor: 'CTO',
      currentState: 'API gateway with design-phase vulnerabilities; legacy internal APIs exposed during mainframe migration; WAF rules not tuned for banking API patterns.',
      targetState: 'All APIs protected with mTLS and OAuth2 token binding; runtime API threat detection active; legacy APIs behind API management with rate limiting.',
      startDate: '2025-02-01T00:00:00.000Z', targetDate: '2025-12-31T00:00:00.000Z', completedDate: '',
      milestones: [
        { id: 'hbs-ms-mtls-rollout', title: 'Internal API mTLS Enforcement', description: 'Deploy mutual TLS for all internal service-to-service API communication with automated certificate rotation.', status: 'in_progress' as const, dueDate: '2025-07-01T00:00:00.000Z', completedDate: '', owner: 'Platform Engineering' },
        { id: 'hbs-ms-api-threat-detection', title: 'Runtime API Threat Detection', description: 'Deploy runtime API security monitoring to detect injection, parameter tampering, and anomalous transaction patterns.', status: 'pending' as const, dueDate: '2025-10-01T00:00:00.000Z', completedDate: '', owner: 'Security Operations' },
        { id: 'hbs-ms-legacy-api-gating', title: 'Legacy API Gateway Migration', description: 'Route all legacy mainframe APIs through API management platform with authentication, rate limiting, and schema validation.', status: 'pending' as const, dueDate: '2025-12-31T00:00:00.000Z', completedDate: '', owner: 'Platform Engineering' },
      ],
      linkedRiskIds: ['hbs-risk-api-gateway-vuln', 'hbs-risk-legacy-integration', 'hbs-risk-customer-data-breach'],
      linkedControlSetIds: [],
      linkedAssetIds: ['hbs-asset-payment-gw', 'hbs-asset-waf', 'hbs-asset-core-banking'],
      linkedImplementedControlIds: ['hbs-ic-waf-rules', 'hbs-ic-hsm-encryption'],
      linkedAssessmentIds: ['hbs-assessment-banking-review'],
      notes: 'Regulatory examination highlighted API security gaps. Board risk committee tracking monthly progress.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'hbs-si-pci-compliance-recovery', title: 'PCI-DSS Compliance Recovery Program',
      description: 'Remediate PCI-DSS compliance drift in card processing environment including scope reduction, HSM key rotation, and transaction monitoring enhancements.',
      category: 'compliance' as const, status: 'approved' as const, priority: 'high' as const,
      owner: 'Compliance', executiveSponsor: 'Chief Risk Officer',
      currentState: 'PCI-DSS scope creep from mainframe migration; HSM firmware update pending; AML monitoring gap for real-time payments.',
      targetState: 'Reduced PCI scope with network segmentation; HSM firmware current with automated key rotation; real-time AML monitoring for all payment channels.',
      startDate: '2025-05-01T00:00:00.000Z', targetDate: '2026-02-28T00:00:00.000Z', completedDate: '',
      milestones: [
        { id: 'hbs-ms-pci-scope-reduction', title: 'PCI Scope Reduction Assessment', description: 'Complete cardholder data flow mapping and implement network segmentation to reduce PCI assessment scope.', status: 'in_progress' as const, dueDate: '2025-08-01T00:00:00.000Z', completedDate: '', owner: 'Compliance' },
        { id: 'hbs-ms-hsm-firmware', title: 'HSM Firmware Update and Key Rotation', description: 'Apply pending Thales HSM firmware update and execute key rotation ceremony with dual-control enforcement.', status: 'pending' as const, dueDate: '2025-11-01T00:00:00.000Z', completedDate: '', owner: 'Cryptographic Operations' },
      ],
      linkedRiskIds: ['hbs-risk-regulatory-noncompliance', 'hbs-risk-insider-fraud', 'hbs-risk-cloud-migration-gaps'],
      linkedControlSetIds: [],
      linkedAssetIds: ['hbs-asset-hsm', 'hbs-asset-aml-monitor', 'hbs-asset-customer-db'],
      linkedImplementedControlIds: ['hbs-ic-hsm-encryption', 'hbs-ic-fraud-detection'],
      linkedAssessmentIds: ['hbs-assessment-banking-review'],
      notes: 'Annual PCI-DSS assessment by Deloitte scheduled for Q4. Compliance drift findings from last assessment require remediation.',
      createdAt: NOW, updatedAt: NOW,
    },
  ],
  implementedControls: [
    {
      id: 'hbs-ic-waf-rules', title: 'Banking-Tuned WAF Rule Set',
      description: 'Akamai WAF with custom rule set tuned for banking API traffic patterns including SQL injection, parameter tampering, and credential stuffing protection.',
      controlType: 'technical' as const, category: 'network_security' as const,
      status: 'active' as const, automationLevel: 'semi_automated' as const,
      owner: 'Security Operations', vendor: 'Akamai', product: 'Kona Site Defender', version: '2024.10',
      implementedDate: '2024-03-01T00:00:00.000Z', lastReviewDate: NOW, nextReviewDate: '2025-09-01T00:00:00.000Z',
      linkedSoaEntryIds: ['hbs-soa-a01', 'hbs-soa-a03'],
      linkedRiskIds: ['hbs-risk-api-gateway-vuln', 'hbs-risk-customer-data-breach'],
      linkedAssetIds: ['hbs-asset-waf', 'hbs-asset-payment-gw'],
      linkedAssessmentIds: ['hbs-assessment-banking-review'],
      notes: 'WAF rules require quarterly tuning cycle. False positive rate under 0.1% for legitimate banking transactions.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'hbs-ic-hsm-encryption', title: 'Thales HSM Transaction Signing',
      description: 'FIPS 140-2 Level 3 hardware security modules providing cryptographic key management for SWIFT message signing, card PIN encryption, and transaction vault integrity.',
      controlType: 'technical' as const, category: 'encryption' as const,
      status: 'active' as const, automationLevel: 'fully_automated' as const,
      owner: 'Cryptographic Operations', vendor: 'Thales', product: 'Luna Network HSM', version: '7.8',
      implementedDate: '2023-06-01T00:00:00.000Z', lastReviewDate: NOW, nextReviewDate: '2025-12-01T00:00:00.000Z',
      linkedSoaEntryIds: ['hbs-soa-a02', 'hbs-soa-cis06'],
      linkedRiskIds: ['hbs-risk-insider-fraud', 'hbs-risk-payment-fraud'],
      linkedAssetIds: ['hbs-asset-hsm', 'hbs-asset-core-banking'],
      linkedAssessmentIds: ['hbs-assessment-banking-review'],
      notes: 'Firmware update pending from Thales. Dual-control bypass identified during last audit requires remediation.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'hbs-ic-fraud-detection', title: 'Real-Time Fraud Detection Engine',
      description: 'ML-based fraud detection engine analyzing transaction velocity, geolocation, device fingerprinting, and behavioral patterns for real-time payment authorization decisions.',
      controlType: 'technical' as const, category: 'monitoring' as const,
      status: 'active' as const, automationLevel: 'fully_automated' as const,
      owner: 'Fraud Operations', vendor: 'FICO', product: 'Falcon Fraud Manager', version: '6.5',
      implementedDate: '2024-01-15T00:00:00.000Z', lastReviewDate: NOW, nextReviewDate: '2025-10-01T00:00:00.000Z',
      linkedSoaEntryIds: ['hbs-soa-a09', 'hbs-soa-cis05'],
      linkedRiskIds: ['hbs-risk-payment-fraud', 'hbs-risk-atm-jackpotting'],
      linkedAssetIds: ['hbs-asset-fraud-engine', 'hbs-asset-aml-monitor'],
      linkedAssessmentIds: ['hbs-assessment-banking-review'],
      notes: 'Model retraining scheduled quarterly. Real-time payment channel coverage gap identified - batch processing only for AML.',
      createdAt: NOW, updatedAt: NOW,
    },
  ],
  thirdParties: [
    {
      id: 'hbs-tp-fis', name: 'FIS Global', description: 'Core banking software platform powering transaction processing and account management.',
      category: 'supplier' as const, status: 'active' as const, riskRating: 'critical' as const, dataClassification: 'restricted' as const,
      linkedAssetIds: ['hbs-asset-core-banking', 'hbs-asset-customer-db'], linkedRiskIds: ['hbs-risk-legacy-integration', 'hbs-risk-regulatory-noncompliance'],
      contactName: 'William Foster', contactEmail: 'william.foster@fisglobal.com',
      contractExpiry: '2029-06-30T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-06-01T00:00:00.000Z',
      notes: 'Legacy mainframe integration requires modernization. Annual PCI DSS assessment and SOC 1 Type II on file.',
    },
    {
      id: 'hbs-tp-visa', name: 'Visa / Mastercard', description: 'Payment card network processors handling all debit and credit card transaction routing.',
      category: 'partner' as const, status: 'active' as const, riskRating: 'critical' as const, dataClassification: 'restricted' as const,
      linkedAssetIds: ['hbs-asset-payment-gw', 'hbs-asset-fraud-engine'], linkedRiskIds: ['hbs-risk-payment-fraud', 'hbs-risk-api-gateway-vuln'],
      contactName: 'Catherine Lee', contactEmail: 'catherine.lee@visa.com',
      contractExpiry: '2028-12-31T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-07-01T00:00:00.000Z',
      notes: 'PCI DSS Level 1 compliance mandatory. Transaction fraud monitoring timing gap identified during last assessment.',
    },
    {
      id: 'hbs-tp-thales', name: 'Thales', description: 'Hardware security module vendor providing FIPS 140-2 Level 3 certified cryptographic key management.',
      category: 'supplier' as const, status: 'active' as const, riskRating: 'high' as const, dataClassification: 'restricted' as const,
      linkedAssetIds: ['hbs-asset-hsm'], linkedRiskIds: ['hbs-risk-insider-fraud'],
      contactName: 'Laurent Moreau', contactEmail: 'laurent.moreau@thalesgroup.com',
      contractExpiry: '2027-09-30T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-08-15T00:00:00.000Z',
      notes: 'HSM firmware update pending. Dual-control enforcement bypass identified during audit requires remediation.',
    },
    {
      id: 'hbs-tp-akamai', name: 'Akamai', description: 'Web application firewall and content delivery network protecting all customer-facing banking services.',
      category: 'managed_service' as const, status: 'active' as const, riskRating: 'high' as const, dataClassification: 'internal' as const,
      linkedAssetIds: ['hbs-asset-waf'], linkedRiskIds: ['hbs-risk-api-gateway-vuln', 'hbs-risk-customer-data-breach'],
      contactName: 'Jennifer Kim', contactEmail: 'jennifer.kim@akamai.com',
      contractExpiry: '2027-03-31T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-09-01T00:00:00.000Z',
      notes: 'WAF rules tuned for banking traffic patterns. DDoS protection SLA requires 99.99% availability.',
    },
    {
      id: 'hbs-tp-deloitte', name: 'Deloitte', description: 'External regulatory audit firm conducting annual PCI DSS, SOX, and banking regulation compliance assessments.',
      category: 'contractor' as const, status: 'active' as const, riskRating: 'medium' as const, dataClassification: 'confidential' as const,
      linkedAssetIds: ['hbs-asset-aml-monitor'], linkedRiskIds: ['hbs-risk-regulatory-noncompliance'],
      contactName: 'Richard Hayes', contactEmail: 'richard.hayes@deloitte.com',
      contractExpiry: '2026-12-31T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-11-01T00:00:00.000Z',
      notes: 'Annual engagement for regulatory audit cycle. AML monitoring gap findings from last assessment pending remediation.',
    },
  ],
});

export const hybridBankingSystem: ExampleSystem = {
  id: 'hybrid-banking-system',
  name: 'Hybrid DFD: Digital Banking Platform',
  description: 'Banking system mixing DFD notation for high-level architecture with detailed security components',
  category: 'DFD Threat Models',
  primaryZone: 'Internal',
  dataClassification: 'Confidential',
  customContext: `
## Hybrid Banking System Threat Model

This model demonstrates a hybrid approach using DFD nodes for conceptual components and specific security nodes for implemented controls.

### Architecture Overview
- External actors (customers, partners) represented as DFD actors
- Core banking processes shown as DFD processes
- Specific security implementations shown as detailed nodes
- Mix of abstraction levels to show both design and implementation

### System Components
1. **Customer Channels**: Mobile app, web portal, ATM network
2. **API Layer**: Still in design phase (DFD process)
3. **Core Banking**: Legacy mainframe with modern microservices
4. **Security Layer**: Implemented WAF, IDS, HSM components
5. **Data Stores**: Mix of traditional databases and data lakes

### Security Architecture
- Customer authentication through MFA and biometric systems
- API Gateway handles rate limiting and threat detection
- HSM manages encryption keys for all sensitive operations
- Real-time fraud detection on all transactions
- PCI DSS compliant card processing
- Segregated networks for different trust levels

### Integration Points
- SWIFT network for international transfers
- Credit bureaus for risk assessment
- Third-party payment processors
- Regulatory reporting systems
- Partner bank networks

The system processes over 1 million transactions daily with 99.95% uptime requirement.
  `,
  nodes: [
    // Security Zones
    // External: 3 nodes → 600px, x=50
    {
      id: 'external-zone',
      type: 'securityZone',
      position: { x: 50, y: 50 },
      data: {
        label: 'External Zone',
        zoneType: 'External',
        description: 'Public internet and external entities'
      },
      style: {
        width: 600,
        height: 1000,
        background: colors.zoneBackgrounds.External,
        zIndex: -1
      }
    } as SecurityNode,
    // DMZ: 4 nodes → 750px, x=770
    {
      id: 'dmz-zone',
      type: 'securityZone',
      position: { x: 770, y: 50 },
      data: {
        label: 'DMZ Zone',
        zoneType: 'DMZ',
        description: 'Public-facing services and security controls'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.DMZ,
        zIndex: -1
      }
    } as SecurityNode,
    // Internal: 3 nodes → 600px, x=1640
    {
      id: 'internal-zone',
      type: 'securityZone',
      position: { x: 1640, y: 50 },
      data: {
        label: 'Internal Zone',
        zoneType: 'Internal',
        description: 'Core banking systems'
      },
      style: {
        width: 600,
        height: 1000,
        background: colors.zoneBackgrounds.Internal,
        zIndex: -1
      }
    } as SecurityNode,
    // Restricted: 4 nodes → 750px, x=2360
    {
      id: 'restricted-zone',
      type: 'securityZone',
      position: { x: 2360, y: 50 },
      data: {
        label: 'Restricted Zone',
        zoneType: 'Restricted',
        description: 'High-security data and cryptographic operations'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Restricted,
        zIndex: -1
      }
    } as SecurityNode,

    // External Actors (DFD) — zone x=50, nodes fit within 600px
    {
      id: 'retail-customers',
      type: 'dfdActor',
      position: { x: 150, y: 250 },
      data: {
        label: 'Retail Customers',
        actorType: 'Banking Customers',
        zone: 'External',
        description: 'Individual banking customers using digital channels',
        protocols: ['HTTPS'],
        dataClassification: 'Public'
      }
    } as SecurityNode,
    {
      id: 'corporate-clients',
      type: 'dfdActor',
      position: { x: 150, y: 450 },
      data: {
        label: 'Corporate Clients',
        actorType: 'Business Banking Customers',
        zone: 'External',
        description: 'Corporate clients accessing business banking services',
        protocols: ['HTTPS', 'SFTP'],
        dataClassification: 'Sensitive'
      }
    } as SecurityNode,
    {
      id: 'partner-banks',
      type: 'dfdActor',
      position: { x: 150, y: 650 },
      data: {
        label: 'Partner Banks',
        actorType: 'Financial Institution Partners',
        zone: 'External',
        description: 'Partner banks and financial networks (SWIFT, ACH)',
        protocols: ['SWIFT', 'API'],
        dataClassification: 'Confidential'
      }
    } as SecurityNode,

    // DMZ Security Components (zone x shifted from 820→770, delta=-50)
    {
      id: 'waf',
      type: 'waf',
      position: { x: 870, y: 200 },
      data: {
        label: 'Web Application Firewall',
        zone: 'DMZ',
        description: 'Cloudflare WAF protecting all web applications',
        vendor: 'Cloudflare',
        version: 'Enterprise',
        technology: 'Cloud WAF',
        protocols: ['HTTPS'],
        securityControls: ['OWASP Core Rule Set', 'DDoS Protection', 'Bot Management'],
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'api-gateway-process',
      type: 'dfdProcess',
      position: { x: 1020, y: 350 },
      data: {
        label: 'API Management Platform',
        processType: 'API Gateway and Management',
        zone: 'DMZ',
        description: 'Central API gateway still being implemented',
        technology: 'Design Phase',
        protocols: ['REST', 'GraphQL'],
        securityControls: ['Rate Limiting', 'API Key Management', 'OAuth 2.0'],
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'ids',
      type: 'ids',
      position: { x: 1170, y: 200 },
      data: {
        label: 'Intrusion Detection',
        zone: 'DMZ',
        description: 'Network-based intrusion detection system',
        vendor: 'Suricata',
        version: '7.0',
        technology: 'Open Source IDS',
        protocols: ['All'],
        securityControls: ['Signature Detection', 'Anomaly Detection', 'SSL Inspection'],
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'mfa-service',
      type: 'mfa',
      position: { x: 1020, y: 550 },
      data: {
        label: 'Multi-Factor Auth',
        zone: 'DMZ',
        description: 'Centralized MFA service for all channels',
        vendor: 'Okta',
        version: 'Enterprise',
        technology: 'Cloud MFA',
        protocols: ['SAML', 'OIDC'],
        securityControls: ['Biometric', 'Push Notifications', 'Hardware Tokens'],
        dataClassification: 'Sensitive'
      }
    } as SecurityNode,

    // Internal Zone (zone x shifted from 1590→1640, delta=+50)
    {
      id: 'core-banking-process',
      type: 'dfdProcess',
      position: { x: 1790, y: 300 },
      data: {
        label: 'Core Banking Engine',
        processType: 'Transaction Processing System',
        zone: 'Internal',
        description: 'Legacy mainframe being modernized with microservices',
        technology: 'IBM z/OS + Kubernetes',
        protocols: ['Internal APIs'],
        securityControls: ['Transaction Signing', 'Audit Logging'],
        dataClassification: 'Confidential'
      }
    } as SecurityNode,
    {
      id: 'fraud-detection',
      type: 'fraudDetection',
      position: { x: 1940, y: 450 },
      data: {
        label: 'Fraud Detection Engine',
        zone: 'Internal',
        description: 'Real-time fraud detection using ML models',
        vendor: 'In-House',
        version: '3.2',
        technology: 'Python/TensorFlow',
        protocols: ['gRPC'],
        securityControls: ['ML Models', 'Rule Engine', 'Behavioral Analysis'],
        dataClassification: 'Confidential'
      }
    } as SecurityNode,
    {
      id: 'transaction-monitor',
      type: 'transactionMonitor',
      position: { x: 1790, y: 600 },
      data: {
        label: 'AML Transaction Monitor',
        zone: 'Internal',
        description: 'Anti-money laundering transaction monitoring',
        vendor: 'NICE Actimize',
        version: '7.0',
        technology: 'Java',
        protocols: ['SQL', 'REST'],
        securityControls: ['Pattern Detection', 'Risk Scoring', 'Case Management'],
        dataClassification: 'Confidential'
      }
    } as SecurityNode,

    // Restricted Zone (4 nodes → 750px, x=2360 unchanged)
    {
      id: 'hsm',
      type: 'hsm',
      position: { x: 2460, y: 250 },
      data: {
        label: 'Hardware Security Module',
        zone: 'Restricted',
        description: 'Thales HSM for key management and crypto operations',
        vendor: 'Thales',
        version: 'Luna 7',
        technology: 'Hardware',
        protocols: ['PKCS#11'],
        securityControls: ['FIPS 140-2 Level 3', 'Key Generation', 'Crypto Operations'],
        dataClassification: 'Confidential'
      }
    } as SecurityNode,
    {
      id: 'customer-data-store',
      type: 'dfdDataStore',
      position: { x: 2660, y: 400 },
      data: {
        label: 'Customer Master Data',
        storeType: 'Core Customer Database',
        zone: 'Restricted',
        description: 'Central repository of all customer information',
        technology: 'Oracle RAC',
        protocols: ['TLS'],
        encryption: 'atRest',
        backupStrategy: 'Real-time replication to DR site',
        dataClassification: 'Confidential'
      }
    } as SecurityNode,
    {
      id: 'transaction-vault',
      type: 'vault',
      position: { x: 2660, y: 600 },
      data: {
        label: 'Transaction Vault',
        zone: 'Restricted',
        description: 'Immutable transaction ledger with cryptographic proofs',
        vendor: 'HashiCorp',
        version: 'Enterprise',
        technology: 'Vault + Custom Blockchain',
        protocols: ['TLS', 'mTLS'],
        securityControls: ['Immutable Ledger', 'Cryptographic Proofs', 'Access Policies'],
        dataClassification: 'Confidential'
      }
    } as SecurityNode,
    {
      id: 'key-store',
      type: 'dfdDataStore',
      position: { x: 2460, y: 800 },
      data: {
        label: 'Cryptographic Key Store',
        storeType: 'Master Key Database',
        zone: 'Restricted',
        description: 'Encrypted storage for all cryptographic keys',
        technology: 'Custom Key DB',
        protocols: ['Local Access Only'],
        encryption: 'both',
        backupStrategy: 'Offline backup in secure vault',
        dataClassification: 'Confidential'
      }
    } as SecurityNode
  ],
  edges: [
    // Customer flows
    {
      id: 'e1',
      source: 'retail-customers',
      target: 'waf',
      type: 'securityEdge',
      data: {
        label: 'Web/Mobile Traffic',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        dataClassification: 'Public',
        zone: 'DMZ',
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e2',
      source: 'waf',
      target: 'api-gateway-process',
      type: 'securityEdge',
      data: {
        label: 'Filtered Requests',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        dataClassification: 'Internal',
        zone: 'DMZ',
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e3',
      source: 'api-gateway-process',
      target: 'mfa-service',
      type: 'securityEdge',
      data: {
        label: 'Auth Requests',
        protocol: 'OIDC',
        encryption: 'TLS',
        dataClassification: 'Sensitive',
        zone: 'DMZ',
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e4',
      source: 'api-gateway-process',
      target: 'core-banking-process',
      type: 'securityEdge',
      data: {
        label: 'Authenticated API Calls',
        protocol: 'Internal API',
        encryption: 'mTLS',
        dataClassification: 'Confidential',
        zone: 'Internal',
        animated: true
      }
    } as SecurityEdge,
    // Corporate flows
    {
      id: 'e5',
      source: 'corporate-clients',
      target: 'api-gateway-process',
      type: 'securityEdge',
      data: {
        label: 'Bulk Transactions',
        protocol: 'SFTP/API',
        encryption: 'TLS 1.3',
        dataClassification: 'Sensitive',
        zone: 'DMZ',
        animated: true
      }
    } as SecurityEdge,
    // Partner integrations
    {
      id: 'e6',
      source: 'partner-banks',
      target: 'api-gateway-process',
      type: 'securityEdge',
      data: {
        label: 'Inter-bank Transfers',
        protocol: 'SWIFT/API',
        encryption: 'Bank-grade',
        dataClassification: 'Confidential',
        zone: 'DMZ',
        animated: true
      }
    } as SecurityEdge,
    // Internal processing
    {
      id: 'e7',
      source: 'core-banking-process',
      target: 'fraud-detection',
      type: 'securityEdge',
      data: {
        label: 'Transaction Feed',
        protocol: 'gRPC',
        encryption: 'TLS',
        dataClassification: 'Confidential',
        zone: 'Internal',
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e8',
      source: 'core-banking-process',
      target: 'transaction-monitor',
      type: 'securityEdge',
      data: {
        label: 'AML Checks',
        protocol: 'REST',
        encryption: 'TLS',
        dataClassification: 'Confidential',
        zone: 'Internal',
        animated: true
      }
    } as SecurityEdge,
    // Data access
    {
      id: 'e9',
      source: 'core-banking-process',
      target: 'customer-data-store',
      type: 'securityEdge',
      data: {
        label: 'Customer Data Access',
        protocol: 'Oracle Net',
        encryption: 'TLS',
        dataClassification: 'Confidential',
        zone: 'Restricted',
        animated: false
      }
    } as SecurityEdge,
    {
      id: 'e10',
      source: 'core-banking-process',
      target: 'transaction-vault',
      type: 'securityEdge',
      data: {
        label: 'Transaction Storage',
        protocol: 'Vault API',
        encryption: 'mTLS',
        dataClassification: 'Confidential',
        zone: 'Restricted',
        animated: true
      }
    } as SecurityEdge,
    // HSM operations
    {
      id: 'e11',
      source: 'core-banking-process',
      target: 'hsm',
      type: 'securityEdge',
      data: {
        label: 'Crypto Operations',
        protocol: 'PKCS#11',
        encryption: 'Hardware',
        dataClassification: 'Confidential',
        zone: 'Restricted',
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e12',
      source: 'hsm',
      target: 'key-store',
      type: 'securityEdge',
      data: {
        label: 'Key Management',
        protocol: 'Local',
        encryption: 'Hardware',
        dataClassification: 'Confidential',
        zone: 'Restricted',
        animated: false
      }
    } as SecurityEdge,
    // Monitoring — IDS is in DMZ, fraud-detection in Internal, route via bottom channel
    {
      id: 'e13',
      source: 'ids',
      target: 'fraud-detection',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'bottom',
      data: {
        label: 'Security Events',
        protocol: 'Syslog',
        encryption: 'TLS',
        dataClassification: 'Internal',
        zone: 'Internal',
        animated: true
      }
    } as SecurityEdge
  ],
  grcWorkspace: hybridBankingSystemGrcWorkspace,
  attackPaths: [
    {
      id: 'hbs-ap-api-sqli-exfil',
      name: 'API Gateway Bypass → Core Banking → Customer Data Exfiltration',
      strideCategory: 'Information Disclosure' as StrideCategory,
      riskLevel: 'Critical' as AttackPathRiskLevel,
      description: 'Attacker exploits incomplete API gateway controls to bypass rate limiting and authentication, reaches core banking engine via authenticated API calls, and executes second-order SQL injection against Customer Master Data to exfiltrate millions of PII records.',
      steps: [
        { order: 1, edgeId: 'e1', sourceNodeId: 'retail-customers', targetNodeId: 'waf', technique: 'T1190: Exploit Public-Facing Application' },
        { order: 2, edgeId: 'e2', sourceNodeId: 'waf', targetNodeId: 'api-gateway-process', technique: 'T1071: Application Layer Protocol' },
        { order: 3, edgeId: 'e4', sourceNodeId: 'api-gateway-process', targetNodeId: 'core-banking-process', technique: 'T1078: Valid Accounts' },
        { order: 4, edgeId: 'e9', sourceNodeId: 'core-banking-process', targetNodeId: 'customer-data-store', technique: 'T1005: Data from Local System' },
      ],
      mitreTechniques: ['T1190', 'T1071', 'T1078', 'T1005'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'hbs-ap-partner-swift-fraud',
      name: 'Partner Compromise → SWIFT Transaction Fraud',
      strideCategory: 'Tampering' as StrideCategory,
      riskLevel: 'Critical' as AttackPathRiskLevel,
      description: 'Compromised partner bank injects malicious SWIFT messages through API gateway without mTLS enforcement, manipulates core banking transaction processing during the fraud detection timing gap to commit high-value fraudulent transfers before ML models trigger alerts.',
      steps: [
        { order: 1, edgeId: 'e6', sourceNodeId: 'partner-banks', targetNodeId: 'api-gateway-process', technique: 'T1199: Trusted Relationship' },
        { order: 2, edgeId: 'e4', sourceNodeId: 'api-gateway-process', targetNodeId: 'core-banking-process', technique: 'T1071: Application Layer Protocol' },
        { order: 3, edgeId: 'e7', sourceNodeId: 'core-banking-process', targetNodeId: 'fraud-detection', technique: 'T1562: Impair Defenses' },
      ],
      mitreTechniques: ['T1199', 'T1071', 'T1562'],
      createdAt: '2025-06-01T00:05:00.000Z',
      updatedAt: '2025-06-01T00:05:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'hbs-ap-insider-vault',
      name: 'Insider HSM Access → Transaction Vault Manipulation',
      strideCategory: 'Elevation of Privilege' as StrideCategory,
      riskLevel: 'High' as AttackPathRiskLevel,
      description: 'Malicious insider with HSM administrative access bypasses dual-control requirements to generate unauthorized signing keys via the key store, then uses them to forge transaction signatures and manipulate the immutable transaction vault.',
      steps: [
        { order: 1, edgeId: 'e11', sourceNodeId: 'core-banking-process', targetNodeId: 'hsm', technique: 'T1078: Valid Accounts' },
        { order: 2, edgeId: 'e12', sourceNodeId: 'hsm', targetNodeId: 'key-store', technique: 'T1552: Unsecured Credentials' },
        { order: 3, edgeId: 'e10', sourceNodeId: 'core-banking-process', targetNodeId: 'transaction-vault', technique: 'T1565: Data Manipulation' },
      ],
      mitreTechniques: ['T1078', 'T1552', 'T1565'],
      createdAt: '2025-06-01T00:10:00.000Z',
      updatedAt: '2025-06-01T00:10:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'hbs-ap-corporate-lateral',
      name: 'Corporate Client → MFA Bypass → AML Monitor Evasion',
      strideCategory: 'Spoofing' as StrideCategory,
      riskLevel: 'High' as AttackPathRiskLevel,
      description: 'Attacker impersonates corporate client using compromised SFTP credentials, exploits API gateway to bypass MFA verification for bulk transaction uploads, then structures transactions to evade AML monitoring thresholds while exploiting the mainframe-to-Kubernetes monitoring blind spot.',
      steps: [
        { order: 1, edgeId: 'e5', sourceNodeId: 'corporate-clients', targetNodeId: 'api-gateway-process', technique: 'T1078: Valid Accounts' },
        { order: 2, edgeId: 'e3', sourceNodeId: 'api-gateway-process', targetNodeId: 'mfa-service', technique: 'T1556: Modify Authentication Process' },
        { order: 3, edgeId: 'e4', sourceNodeId: 'api-gateway-process', targetNodeId: 'core-banking-process', technique: 'T1071: Application Layer Protocol' },
        { order: 4, edgeId: 'e8', sourceNodeId: 'core-banking-process', targetNodeId: 'transaction-monitor', technique: 'T1562: Impair Defenses' },
      ],
      mitreTechniques: ['T1078', 'T1556', 'T1071', 'T1562'],
      createdAt: '2025-06-01T00:15:00.000Z',
      updatedAt: '2025-06-01T00:15:00.000Z',
    } as DiagramAttackPath,
  ],
};