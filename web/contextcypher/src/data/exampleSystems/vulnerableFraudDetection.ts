import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityNode, SecurityEdge, SecurityZone } from '../../types/SecurityTypes';
import { DiagramAttackPath, AssessmentThreatModelNodeSourceType, AssessmentThreatModelEdgeSourceType, AttackPathRiskLevel } from '../../types/GrcTypes';
import { colors } from '../../styles/Theme';
import { buildGrcWorkspace, score, NOW, OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID } from './grcSharedBase';
import { StrideCategory } from '../../types/ThreatIntelTypes';
const tierCatalogue = [
  { id: 'tier1-cyber', tier: 1 as const, label: 'Cyber Risk', description: 'Information security and cyber threats' },
  { id: 'tier1-operational', tier: 1 as const, label: 'Operational Risk', description: 'Business operations and process risks' },
  { id: 'tier1-regulatory', tier: 1 as const, label: 'Regulatory Risk', description: 'Compliance and regulatory obligations' },
  { id: 'tier2-application', tier: 2 as const, label: 'Application Security', parentId: 'tier1-cyber', description: 'Application-layer vulnerabilities and controls' },
  { id: 'tier2-data', tier: 2 as const, label: 'Data Protection', parentId: 'tier1-cyber', description: 'Data-at-rest and data-in-transit protection' },
  { id: 'tier2-identity', tier: 2 as const, label: 'Identity & Access', parentId: 'tier1-cyber', description: 'Authentication, authorization, and credential management' },
  { id: 'tier2-ml-security', tier: 2 as const, label: 'ML/AI Security', parentId: 'tier1-cyber', description: 'Machine learning model integrity and training data protection' },
  { id: 'tier2-monitoring', tier: 2 as const, label: 'Security Monitoring', parentId: 'tier1-operational', description: 'Logging, detection, and incident response' },
  { id: 'tier2-financial-compliance', tier: 2 as const, label: 'Financial Compliance', parentId: 'tier1-regulatory', description: 'PCI DSS, SOX, and banking regulations' },
  { id: 'tier3-weak-auth', tier: 3 as const, label: 'Weak Authentication Mechanisms', parentId: 'tier2-identity' },
  { id: 'tier3-unencrypted-internal', tier: 3 as const, label: 'Unencrypted Internal Traffic', parentId: 'tier2-data' },
  { id: 'tier3-model-tampering', tier: 3 as const, label: 'ML Model Tampering', parentId: 'tier2-ml-security' },
  { id: 'tier3-training-data-exposure', tier: 3 as const, label: 'Training Data Exposure', parentId: 'tier2-ml-security' },
  { id: 'tier3-log-retention', tier: 3 as const, label: 'Insufficient Log Retention', parentId: 'tier2-monitoring' },
  { id: 'tier3-audit-integrity', tier: 3 as const, label: 'Audit Log Integrity', parentId: 'tier2-monitoring' },
  { id: 'tier3-rate-limit-bypass', tier: 3 as const, label: 'Rate Limiting Bypass', parentId: 'tier2-application' },
  { id: 'tier4-mfa-enforcement', tier: 4 as const, label: 'MFA Enforcement', parentId: 'tier3-weak-auth' },
  { id: 'tier4-tls-internal', tier: 4 as const, label: 'Internal TLS Enforcement', parentId: 'tier3-unencrypted-internal' },
  { id: 'tier4-model-signing', tier: 4 as const, label: 'Model Artifact Signing', parentId: 'tier3-model-tampering' },
  { id: 'tier4-data-masking', tier: 4 as const, label: 'Training Data Masking', parentId: 'tier3-training-data-exposure' },
];

const assets = [
  {
    id: 'asset-fraud-engine', name: 'Real-time Fraud Engine', type: 'application_server', owner: 'Fraud Operations',
    domain: 'application' as const, category: 'Core Platform',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Core fraud scoring engine processing 25M transactions daily with sub-100ms latency requirement',
    criticality: { confidentiality: 5, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-fraud-detection', nodeId: 'fraud-engine', nodeLabel: 'Real-time Fraud Engine', nodeType: 'fraudDetection' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-auth-service', name: 'Authentication Service (RSA SecurID)', type: 'security_tool', owner: 'Identity & Access Management',
    domain: 'it' as const, category: 'Security Tools',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Customer authentication and MFA service; SMS-based 2FA still supported for backwards compatibility',
    criticality: { confidentiality: 5, integrity: 5, availability: 5, financial: 4, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-fraud-detection', nodeId: 'auth-service', nodeLabel: 'Authentication Service', nodeType: 'authServer' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-ml-platform', name: 'ML Training Platform (Databricks)', type: 'application_server', owner: 'Data Science',
    domain: 'application' as const, category: 'ML Infrastructure',
    businessCriticality: 4, securityCriticality: 5,
    description: 'Fraud model training infrastructure with unmasked historical transaction data',
    criticality: { confidentiality: 5, integrity: 5, availability: 3, financial: 4, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-fraud-detection', nodeId: 'ml-platform', nodeLabel: 'ML Training Platform', nodeType: 'mlPipeline' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-transaction-db', name: 'Transaction Database (Oracle 19c)', type: 'database', owner: 'Database Administration',
    domain: 'application' as const, category: 'Database',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Primary transaction store; Transparent Data Encryption not enabled on all tablespaces',
    criticality: { confidentiality: 5, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-fraud-detection', nodeId: 'transaction-db', nodeLabel: 'Transaction Database', nodeType: 'database' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-customer-db', name: 'Customer Database (PostgreSQL)', type: 'database', owner: 'Database Administration',
    domain: 'application' as const, category: 'Database',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Customer profiles and history; backup retention exceeds data privacy requirements',
    criticality: { confidentiality: 5, integrity: 5, availability: 4, financial: 5, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-fraud-detection', nodeId: 'customer-db', nodeLabel: 'Customer Database', nodeType: 'database' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-model-registry', name: 'Model Registry (MLflow)', type: 'application_server', owner: 'Data Science',
    domain: 'application' as const, category: 'ML Infrastructure',
    businessCriticality: 4, securityCriticality: 4,
    description: 'ML model versioning and deployment; model artifacts stored without encryption',
    criticality: { confidentiality: 4, integrity: 5, availability: 3, financial: 3, reputation: 3, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-fraud-detection', nodeId: 'model-registry', nodeLabel: 'Model Registry', nodeType: 'modelRegistry' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-siem', name: 'SIEM Platform (Splunk)', type: 'security_tool', owner: 'Security Operations',
    domain: 'it' as const, category: 'Security Tools',
    businessCriticality: 4, securityCriticality: 4,
    description: 'Security monitoring and correlation; log retention limited to 90 days',
    criticality: { confidentiality: 3, integrity: 4, availability: 4, financial: 2, reputation: 3, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-fraud-detection', nodeId: 'siem-platform', nodeLabel: 'SIEM Platform', nodeType: 'siem' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-audit-system', name: 'Audit Management System', type: 'security_tool', owner: 'Compliance',
    domain: 'it' as const, category: 'Compliance Tools',
    businessCriticality: 4, securityCriticality: 4,
    description: 'Comprehensive audit logging; audit logs can be modified by DBAs',
    criticality: { confidentiality: 3, integrity: 5, availability: 3, financial: 3, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-fraud-detection', nodeId: 'audit-system', nodeLabel: 'Audit Management', nodeType: 'auditLogger' }],
    createdAt: NOW, updatedAt: NOW
  },
];

const risks = [
  {
    id: 'risk-sms-2fa', title: 'SMS-Based 2FA Susceptible to SIM Swapping',
    description: 'Authentication service still supports SMS-based 2FA for backwards compatibility. SMS codes are vulnerable to SIM-swap attacks and SS7 interception, enabling account takeover.',
    status: 'assessed' as const, owner: 'Identity & Access Management',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Identity & Access', tier3: 'Weak Authentication Mechanisms' },
    assetIds: ['asset-auth-service'],
    diagramLinks: [{ diagramId: 'vulnerable-fraud-detection', nodeIds: ['auth-service'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Deprecate SMS-based 2FA and migrate all customers to TOTP or FIDO2 authenticators',
    threatActorIds: ['threat-actor-ato-syndicate'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-unencrypted-kafka', title: 'Unencrypted Kafka Streams in Production Zone',
    description: 'Kafka streams between the fraud engine, rule engine, and transaction monitor carry confidential transaction data without encryption, enabling eavesdropping by anyone with network access.',
    status: 'assessed' as const, owner: 'Platform Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Data Protection', tier3: 'Unencrypted Internal Traffic' },
    assetIds: ['asset-fraud-engine'],
    diagramLinks: [{ diagramId: 'vulnerable-fraud-detection', nodeIds: ['fraud-engine', 'rule-engine', 'transaction-monitor'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Enable Kafka TLS encryption and SASL authentication for all production topics',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-unmasked-training-data', title: 'Unmasked PII in ML Training Data',
    description: 'ML Training Platform uses historical transactions containing unmasked PII (names, account numbers, addresses) for model training, violating data minimization principles and GDPR requirements.',
    status: 'draft' as const, owner: 'Data Science',
    tierPath: { tier1: 'Cyber Risk', tier2: 'ML/AI Security', tier3: 'Training Data Exposure' },
    assetIds: ['asset-ml-platform', 'asset-transaction-db'],
    diagramLinks: [{ diagramId: 'vulnerable-fraud-detection', nodeIds: ['ml-platform', 'transaction-db', 'fraud-warehouse'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Implement data masking pipeline for all PII fields before ingestion into ML training environment',
    threatActorIds: ['threat-actor-insider'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-model-artifacts-unencrypted', title: 'Unencrypted ML Model Artifacts',
    description: 'Model registry stores fraud detection model artifacts without encryption. A compromised model could allow an attacker to reverse-engineer detection logic or deploy a poisoned model.',
    status: 'draft' as const, owner: 'Data Science',
    tierPath: { tier1: 'Cyber Risk', tier2: 'ML/AI Security', tier3: 'ML Model Tampering' },
    assetIds: ['asset-model-registry', 'asset-ml-platform'],
    diagramLinks: [{ diagramId: 'vulnerable-fraud-detection', nodeIds: ['model-registry', 'ml-platform'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Enable encryption at rest for model artifacts and implement model signing for deployment verification',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-audit-log-tampering', title: 'Audit Logs Modifiable by Database Administrators',
    description: 'Audit management system stores logs in a database where DBAs have write access. This allows potential tampering with audit trails, undermining forensic integrity and regulatory compliance.',
    status: 'assessed' as const, owner: 'Compliance',
    tierPath: { tier1: 'Operational Risk', tier2: 'Security Monitoring', tier3: 'Audit Log Integrity' },
    assetIds: ['asset-audit-system'],
    diagramLinks: [{ diagramId: 'vulnerable-fraud-detection', nodeIds: ['audit-system'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Migrate audit logs to append-only storage with cryptographic chaining; separate DBA access from audit data',
    threatActorIds: ['threat-actor-insider'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-rate-limit-bypass', title: 'Rate Limiting Bypassed for Premium Customers',
    description: 'Mobile API Gateway rate limiting is disabled for premium customers, creating an abuse vector for credential stuffing or transaction fraud at scale through compromised premium accounts.',
    status: 'assessed' as const, owner: 'Platform Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Application Security', tier3: 'Rate Limiting Bypass' },
    assetIds: ['asset-fraud-engine'],
    diagramLinks: [{ diagramId: 'vulnerable-fraud-detection', nodeIds: ['mobile-gateway', 'fraud-engine'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Implement adaptive rate limiting for all customer tiers based on behavioral risk scoring',
    threatActorIds: ['threat-actor-ato-syndicate'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-tde-incomplete', title: 'Incomplete Transparent Data Encryption on Transaction Database',
    description: 'Oracle TDE is not enabled on all tablespaces in the transaction database. Unencrypted tablespaces may contain financial data accessible via physical media compromise or backup theft.',
    status: 'draft' as const, owner: 'Database Administration',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Data Protection', tier3: 'Unencrypted Internal Traffic' },
    assetIds: ['asset-transaction-db'],
    diagramLinks: [{ diagramId: 'vulnerable-fraud-detection', nodeIds: ['transaction-db', 'key-management'] }],
    inherentScore: score('likelihood-2', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Enable TDE on all tablespaces and verify key rotation via KMS integration',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-siem-retention', title: 'Insufficient SIEM Log Retention for Regulatory Compliance',
    description: 'SIEM platform retains logs for only 90 days due to storage cost constraints. Banking regulations and PCI DSS require minimum 1-year retention for security event data.',
    status: 'assessed' as const, owner: 'Security Operations',
    tierPath: { tier1: 'Regulatory Risk', tier2: 'Financial Compliance' },
    assetIds: ['asset-siem'],
    diagramLinks: [{ diagramId: 'vulnerable-fraud-detection', nodeIds: ['siem-platform'] }],
    inherentScore: score('likelihood-4', 'impact-3'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Archive logs to cold storage tier for 1-year retention; implement tiered retention policy',
    createdAt: NOW, updatedAt: NOW
  },
];

const assessments = [
  {
    id: 'assessment-fraud-platform', title: 'Fraud Detection Platform Security Assessment',
    status: 'in_review' as const,
    owner: 'Security Architecture',
    reviewer: 'CISO',
    startDate: '2025-05-01',
    dueDate: '2025-07-15',
    threatActorIds: ['threat-actor-ato-syndicate', 'threat-actor-insider', 'threat-actor-ml-adversary'],
    methodologyNote: 'Assessment follows NIST SP 800-30 with OWASP Top 10 and MITRE ATT&CK for Financial Services mapping.',
    assumptionNote: 'Assessment covers production fraud detection platform as of June 2025. Development and staging environments are out of scope.',
    scopeItems: [
      { id: 'scope-system-fraud', type: 'system' as const, value: 'system', name: 'Fraud Detection Platform' },
      { id: 'scope-zone-production', type: 'diagram_segment' as const, value: 'Production', name: 'Production Zone' },
      { id: 'scope-zone-ml', type: 'diagram_segment' as const, value: 'Internal', name: 'ML/Analytics Zone' },
      { id: 'scope-zone-data', type: 'diagram_segment' as const, value: 'Trusted', name: 'Data Zone' },
    ],
    tierFilter: { tier1: 'Cyber Risk' },
    riskManagementPlan: {
      objective: 'Reduce attack surface across the fraud detection pipeline and protect ML model integrity.',
      strategy: 'Prioritize authentication and encryption weaknesses, then address ML supply chain risks.',
      residualRiskStatement: 'Residual risk accepted for legacy SMS 2FA during migration period with enhanced monitoring as compensating control.',
      monitoringApproach: 'Bi-weekly review of remediation actions with monthly CISO reporting.',
      communicationPlan: 'Report to Security Steering Committee and Financial Crime Compliance weekly.',
      reviewCadenceDays: 14,
      actions: [
        {
          id: 'rmp-action-deprecate-sms',
          title: 'Deprecate SMS 2FA and migrate to TOTP/FIDO2',
          owner: 'Identity & Access Management',
          dueDate: '2025-08-31',
          status: 'in_progress' as const,
          linkedRiskIds: ['risk-sms-2fa'],
          notes: 'Migration campaign launched; 60% of premium customers migrated'
        },
        {
          id: 'rmp-action-kafka-tls',
          title: 'Enable Kafka TLS and SASL for production topics',
          owner: 'Platform Engineering',
          dueDate: '2025-07-31',
          status: 'in_progress' as const,
          linkedRiskIds: ['risk-unencrypted-kafka'],
          notes: 'TLS certificates deployed; testing in staging cluster'
        },
        {
          id: 'rmp-action-mask-training-data',
          title: 'Implement PII masking pipeline for ML training data',
          owner: 'Data Science',
          dueDate: '2025-09-15',
          status: 'planned' as const,
          linkedRiskIds: ['risk-unmasked-training-data'],
          notes: 'Vendor evaluation for tokenization solution underway'
        },
        {
          id: 'rmp-action-model-signing',
          title: 'Implement model artifact signing and encryption',
          owner: 'Data Science',
          dueDate: '2025-08-15',
          status: 'planned' as const,
          linkedRiskIds: ['risk-model-artifacts-unencrypted'],
          notes: ''
        },
      ],
      updatedAt: NOW
    },
    riskIds: risks.map(r => r.id),
    soaGapIds: ['soa-a01', 'soa-a02', 'soa-a07'],
    taskIds: ['task-sms-migration', 'task-kafka-encryption', 'task-model-signing'],
    linkedImplementedControlIds: [],
    linkedInitiativeIds: [],
    summary: 'Comprehensive security assessment of the fraud detection platform covering authentication, encryption, ML pipeline integrity, and regulatory compliance gaps.',
    findings: 'Key findings include SMS-based 2FA vulnerability, unencrypted Kafka streams, unmasked PII in training data, and mutable audit logs.',
    recommendations: 'Prioritize authentication hardening and encryption of internal communication channels. Address ML model supply chain integrity before next model release cycle.',
    evidenceSummary: 'Evidence includes network traffic analysis, IAM configuration review, ML pipeline architecture documentation, and SIEM retention policy audit.',
    threatModel: {
      nodes: [
        { id: 'tm-node-mobile-gw', label: 'Mobile API Gateway', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'mobile-gateway', position: { x: 50, y: 150 }, nodeType: 'apiGateway', commentary: 'Rate limiting bypassed for premium customers' },
        { id: 'tm-node-fraud-engine', label: 'Fraud Engine', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'fraud-engine', position: { x: 250, y: 150 }, nodeType: 'fraudDetection' },
        { id: 'tm-node-rule-engine', label: 'Rule Engine', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'rule-engine', position: { x: 450, y: 100 }, nodeType: 'application', commentary: 'Rule changes not version controlled' },
        { id: 'tm-node-ml-platform', label: 'ML Platform', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'ml-platform', position: { x: 450, y: 250 }, nodeType: 'mlPipeline', commentary: 'Training data includes unmasked PII' },
        { id: 'tm-node-model-registry', label: 'Model Registry', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'model-registry', position: { x: 650, y: 250 }, nodeType: 'modelRegistry', commentary: 'Artifacts stored without encryption' },
        { id: 'tm-node-customer-db', label: 'Customer DB', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'customer-db', position: { x: 650, y: 100 }, nodeType: 'database' },
      ],
      edges: [
        { id: 'tm-edge-gw-fraud', source: 'tm-node-mobile-gw', target: 'tm-node-fraud-engine', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e4', label: 'Mobile Scoring (REST)', commentary: 'Rate limit bypass allows high-volume abuse' },
        { id: 'tm-edge-fraud-rule', source: 'tm-node-fraud-engine', target: 'tm-node-rule-engine', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e6', label: 'Rule Evaluation (unencrypted)' },
        { id: 'tm-edge-fraud-ml', source: 'tm-node-fraud-engine', target: 'tm-node-ml-platform', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e11', label: 'Model Request (HTTPS)' },
        { id: 'tm-edge-ml-registry', source: 'tm-node-ml-platform', target: 'tm-node-model-registry', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e14', label: 'Model Deployment (S3 API)', commentary: 'Unsigned model artifacts can be replaced' },
        { id: 'tm-edge-fraud-custdb', source: 'tm-node-fraud-engine', target: 'tm-node-customer-db', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e16', label: 'Customer Lookup (SSL)' },
      ],
      attackPathDescription: 'Three primary attack paths identified: (1) Account takeover via SMS 2FA compromise leading to fraudulent transactions; (2) ML model poisoning through the unencrypted model registry; (3) Lateral movement from compromised mobile gateway through unencrypted Kafka streams to customer data.',
      attackPaths: [
        {
          id: 'aap-ato-sms-bypass',
          name: 'Account Takeover via SMS 2FA → Fraudulent Transactions',
          strideCategory: 'Spoofing' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'Attacker performs SIM-swap attack to intercept SMS 2FA codes, authenticates as the victim, and leverages the rate-limit bypass on premium accounts to execute high-volume fraudulent transactions.',
          diagramAttackPathId: 'ap-ato-sms-fraud',
          steps: [
            { order: 1, edgeId: 'e2', sourceNodeId: 'customer-devices', targetNodeId: 'mobile-gateway', technique: 'T1078: Valid Accounts' },
            { order: 2, edgeId: 'e10', sourceNodeId: 'mobile-gateway', targetNodeId: 'auth-service', technique: 'T1111: Multi-Factor Authentication Interception' },
            { order: 3, edgeId: 'e4', sourceNodeId: 'mobile-gateway', targetNodeId: 'fraud-engine', technique: 'T1565: Data Manipulation' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
        {
          id: 'aap-ml-model-poisoning',
          name: 'ML Model Poisoning via Unencrypted Registry',
          strideCategory: 'Tampering' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'Attacker gains access to the model registry where artifacts are stored without encryption, replaces a fraud detection model with a poisoned version that reduces detection accuracy for specific fraud patterns.',
          diagramAttackPathId: 'ap-ml-model-poisoning',
          steps: [
            { order: 1, edgeId: 'e14', sourceNodeId: 'ml-platform', targetNodeId: 'model-registry', technique: 'T1195: Supply Chain Compromise' },
            { order: 2, edgeId: 'e11', sourceNodeId: 'fraud-engine', targetNodeId: 'ml-platform', technique: 'T1565.001: Stored Data Manipulation' },
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
    id: 'soa-a01', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A01', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Role-based access enforced on most services but rate limiting bypassed for premium customers and DLP policies excluded for executive accounts.',
    mitigatesRiskIds: ['risk-rate-limit-bypass'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-a02', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A02', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Internal Kafka traffic and rule engine communications are unencrypted. Model artifacts stored without encryption. TDE incomplete on transaction database.',
    mitigatesRiskIds: ['risk-unencrypted-kafka', 'risk-model-artifacts-unencrypted', 'risk-tde-incomplete'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-a03', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A03', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'implemented' as const,
    justification: 'Input validation implemented across all APIs. Parameterized queries used for database access. Fraud Reporting API uses Spring Boot with built-in injection protection.',
    mitigatesRiskIds: [],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-a04', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A04', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Architecture review underway. ML pipeline lacks integrity verification for model artifacts. Feedback loop from case management to ML platform uses batch SFTP uploads.',
    mitigatesRiskIds: ['risk-model-artifacts-unencrypted', 'risk-unmasked-training-data'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-a05', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A05', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Multiple misconfigurations: Kerberos optional on analytics cluster, master keys rotated annually instead of quarterly, rule changes not version controlled.',
    mitigatesRiskIds: ['risk-tde-incomplete'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-a07', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A07', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'MFA deployed but SMS-based 2FA still supported for backwards compatibility. TOTP/FIDO2 migration underway for premium accounts.',
    mitigatesRiskIds: ['risk-sms-2fa'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-a08', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A08', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'ML model deployment pipeline lacks artifact signing. Model registry has no integrity verification. Fraud warehouse data shared with third-party vendors without validation.',
    mitigatesRiskIds: ['risk-model-artifacts-unencrypted'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-a09', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A09', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'SIEM deployed with 90-day retention (below 1-year regulatory requirement). Audit logs modifiable by DBAs. Security events forwarded via Syslog with TLS.',
    mitigatesRiskIds: ['risk-siem-retention', 'risk-audit-log-tampering'],
    diagramRefs: [],
    evidence: [
      {
        id: 'evidence-a09-siem-config',
        kind: 'link' as const,
        name: 'Splunk retention policy documentation',
        url: 'https://security.internal/docs/splunk-retention-policy',
        note: 'Current 90-day policy with proposed 1-year extension',
        createdAt: NOW
      }
    ],
    updatedAt: NOW
  },
  {
    id: 'soa-cis-03', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.03', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Unencrypted Kafka streams, unmasked training data, and incomplete TDE represent significant data protection gaps.',
    mitigatesRiskIds: ['risk-unencrypted-kafka', 'risk-unmasked-training-data', 'risk-tde-incomplete'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-cis-08', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.08', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'SIEM with 90-day retention; audit log integrity compromised by DBA write access. Regulatory requirement is 1-year minimum.',
    mitigatesRiskIds: ['risk-siem-retention', 'risk-audit-log-tampering'],
    diagramRefs: [],
    evidence: [
      { id: 'evidence-cis08-audit', kind: 'link' as const, name: 'Audit Log Integrity Review',
        url: 'https://security.internal/reports/audit-log-integrity-2025', note: 'Annual audit log integrity assessment', createdAt: NOW }
    ],
    updatedAt: NOW
  },
];

const workflowTasks = [
  {
    id: 'task-sms-migration',
    title: 'Migrate all customers from SMS 2FA to TOTP/FIDO2',
    description: 'Critical authentication hardening to eliminate SIM-swap attack vector.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'critical' as const,
    owner: 'Identity & Access Management',
    dueDate: '2025-08-31',
    riskId: 'risk-sms-2fa',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'task-kafka-encryption',
    title: 'Enable TLS and SASL on all production Kafka topics',
    description: 'Encrypt internal Kafka streams carrying confidential transaction data.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'critical' as const,
    owner: 'Platform Engineering',
    dueDate: '2025-07-31',
    riskId: 'risk-unencrypted-kafka',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'task-model-signing',
    title: 'Implement ML model artifact signing and encryption',
    description: 'Protect model integrity through cryptographic signing and encrypted storage.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Data Science',
    dueDate: '2025-08-15',
    riskId: 'risk-model-artifacts-unencrypted',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'task-audit-immutability',
    title: 'Migrate audit logs to append-only storage with cryptographic chaining',
    description: 'Ensure audit trail integrity by preventing DBA modification of log records.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Compliance',
    dueDate: '2025-09-30',
    riskId: 'risk-audit-log-tampering',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'task-siem-retention-extend',
    title: 'Extend SIEM log retention to 1 year with cold storage tiering',
    description: 'Meet regulatory retention requirements by archiving logs to cost-effective cold storage.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'medium' as const,
    owner: 'Security Operations',
    dueDate: '2025-10-15',
    riskId: 'risk-siem-retention',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'task-evidence-a09',
    title: 'Collect evidence for A09 logging and monitoring controls',
    description: 'Attach SIEM configuration, retention policy, and audit log pipeline evidence.',
    type: 'evidence' as const,
    status: 'todo' as const,
    priority: 'medium' as const,
    owner: 'Security Operations',
    dueDate: '2025-07-15',
    controlSetId: OWASP_CONTROL_SET_ID,
    controlId: 'A09',
    createdAt: NOW, updatedAt: NOW
  },
];

const threatActors = [
  {
    id: 'threat-actor-ato-syndicate', name: 'Account Takeover Syndicate',
    type: 'organised_crime' as const, capabilityLevel: 4,
    resourceLevel: 'high' as const,
    motivation: 'Financial gain through account takeover, fraudulent transactions, and money mule networks.',
    description: 'Well-organized cybercrime group specializing in banking account takeover using SIM-swap attacks, credential stuffing, and social engineering. Known to exploit weak MFA implementations.',
    targetedAssetIds: ['asset-auth-service', 'asset-fraud-engine', 'asset-customer-db'],
    tags: ['financially-motivated', 'ato', 'sim-swap', 'credential-stuffing'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'threat-actor-insider', name: 'Malicious Insider (Fraud Analyst)',
    type: 'insider' as const, capabilityLevel: 3,
    resourceLevel: 'moderate' as const,
    motivation: 'Financial incentive to manipulate fraud rules, suppress alerts, or exfiltrate customer data for sale on dark web markets.',
    description: 'Current employee with privileged access to fraud investigation tools and case management system. Has knowledge of fraud detection thresholds and rule configurations.',
    targetedAssetIds: ['asset-fraud-engine', 'asset-audit-system', 'asset-customer-db'],
    tags: ['insider-threat', 'privileged-access', 'rule-manipulation'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'threat-actor-ml-adversary', name: 'ML Adversarial Researcher',
    type: 'nation_state' as const, capabilityLevel: 5,
    resourceLevel: 'very_high' as const,
    motivation: 'Strategic disruption of financial fraud detection capabilities through model poisoning or evasion techniques to enable downstream criminal operations.',
    description: 'Advanced threat actor with expertise in adversarial machine learning. Capable of crafting inputs that evade fraud detection models or poisoning training data to degrade model accuracy over time.',
    targetedAssetIds: ['asset-ml-platform', 'asset-model-registry'],
    tags: ['adversarial-ml', 'model-poisoning', 'advanced', 'state-sponsored'],
    createdAt: NOW, updatedAt: NOW
  },
];

const threatScenarios = [
  {
    id: 'scenario-ato-sim-swap', title: 'Mass Account Takeover via SMS 2FA Compromise',
    description: 'Account takeover syndicate performs coordinated SIM-swap attacks against premium banking customers. SMS 2FA codes are intercepted, allowing attackers to authenticate as victims and execute fraudulent wire transfers. Rate limiting bypass on premium accounts enables rapid extraction.',
    threatActorId: 'threat-actor-ato-syndicate',
    targetedAssetIds: ['asset-auth-service', 'asset-fraud-engine', 'asset-customer-db'],
    attackTechniques: ['T1078 - Valid Accounts', 'T1111 - Multi-Factor Authentication Interception', 'T1565 - Data Manipulation'],
    linkedRiskIds: ['risk-sms-2fa', 'risk-rate-limit-bypass'],
    likelihood: 'High - SMS 2FA is widely known to be vulnerable to SIM-swap attacks and the bank still supports it for premium customers.',
    impact: 'Critical - direct financial loss, regulatory penalties under PCI DSS, and severe reputational damage affecting customer trust.',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scenario-model-poisoning', title: 'Fraud Detection Model Poisoning via Unprotected Registry',
    description: 'Adversarial ML researcher gains access to the model registry where artifacts are stored without encryption or signing. A poisoned model is deployed that subtly reduces detection accuracy for specific fraud patterns, allowing a coordinated fraud campaign to go undetected.',
    threatActorId: 'threat-actor-ml-adversary',
    targetedAssetIds: ['asset-ml-platform', 'asset-model-registry'],
    attackTechniques: ['T1195.002 - Compromise Software Supply Chain', 'T1565.001 - Stored Data Manipulation', 'T1027 - Obfuscated Files or Information'],
    linkedRiskIds: ['risk-model-artifacts-unencrypted', 'risk-unmasked-training-data'],
    likelihood: 'Moderate - requires access to internal ML infrastructure but model artifacts lack integrity protections.',
    impact: 'Critical - degraded fraud detection enables large-scale financial crime; difficult to detect until significant losses accrue.',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scenario-insider-audit-tampering', title: 'Insider Fraud with Audit Trail Manipulation',
    description: 'Malicious fraud analyst modifies business rules to suppress alerts for specific transaction patterns, then executes fraudulent transactions through the system. DBA access to audit logs is used to remove evidence of rule changes and suspicious activity.',
    threatActorId: 'threat-actor-insider',
    targetedAssetIds: ['asset-fraud-engine', 'asset-audit-system'],
    attackTechniques: ['T1485 - Data Destruction', 'T1070.001 - Clear Windows Event Logs', 'T1565.001 - Stored Data Manipulation'],
    linkedRiskIds: ['risk-audit-log-tampering'],
    likelihood: 'Moderate - requires insider access but audit log modification capability is confirmed.',
    impact: 'Major - undetected internal fraud combined with tampered audit trail undermines forensic capability and regulatory compliance.',
    createdAt: NOW, updatedAt: NOW
  },
];

export const vulnerableFraudDetectionGrcWorkspace = buildGrcWorkspace({
  tierCatalogue,
  assets,
  risks,
  assessments,
  soaEntries,
  workflowTasks,
  threatActors,
  threatScenarios,
  securityInitiatives: [
    {
      id: 'vfd-si-ml-security', title: 'ML Model & Training Data Security Program',
      description: 'Implement data masking for ML training pipelines, encrypt model artifacts at rest, deploy model signing for deployment verification, and establish ML model integrity monitoring.',
      category: 'uplift' as const, status: 'in_progress' as const, priority: 'critical' as const,
      owner: 'Data Science', executiveSponsor: 'Chief Data Officer',
      currentState: 'ML training platform uses unmasked PII including names, account numbers, and addresses; model artifacts stored without encryption in model registry; no model signing or provenance verification on deployment.',
      targetState: 'Automated data masking pipeline for all PII fields before ML training ingestion; AES-256 encryption at rest for model artifacts; model signing with deployment verification gates; continuous model drift detection.',
      startDate: '2025-05-01', targetDate: '2026-06-30', completedDate: '',
      milestones: [
        { id: 'vfd-ms-ml-01', title: 'Deploy PII masking pipeline for training data', description: 'Implement automated data masking pipeline using tokenization and k-anonymity for all PII fields before ingestion into Databricks training environment.', status: 'in_progress' as const, dueDate: '2026-03-31', completedDate: '', owner: 'Data Science' },
        { id: 'vfd-ms-ml-02', title: 'Enable encryption at rest for model artifacts', description: 'Configure MLflow model registry with AES-256 encryption for all stored model artifacts and implement model signing using Sigstore for deployment verification.', status: 'pending' as const, dueDate: '2026-06-30', completedDate: '', owner: 'Data Science' },
      ],
      linkedRiskIds: ['risk-unmasked-training-data', 'risk-model-artifacts-unencrypted'],
      linkedControlSetIds: [],
      linkedAssetIds: ['asset-ml-platform', 'asset-model-registry', 'asset-transaction-db'],
      linkedImplementedControlIds: ['vfd-ic-kafka-monitoring'],
      linkedAssessmentIds: ['assessment-fraud-platform'],
      notes: 'GDPR data minimization compliance driver. Data masking must not degrade model accuracy below 97% fraud detection rate.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'vfd-si-platform-compliance', title: 'Fraud Platform Regulatory Compliance Remediation',
      description: 'Address PCI DSS and banking regulatory compliance gaps including incomplete TDE, insufficient SIEM log retention, audit log integrity, and SMS-based 2FA deprecation.',
      category: 'compliance' as const, status: 'approved' as const, priority: 'high' as const,
      owner: 'Compliance', executiveSponsor: 'Chief Risk Officer',
      currentState: 'Oracle TDE not enabled on all tablespaces; SIEM retains logs for only 90 days vs 1-year regulatory requirement; audit logs modifiable by DBAs; SMS-based 2FA still active for backwards compatibility.',
      targetState: 'TDE enabled on all tablespaces with KMS key rotation; tiered SIEM retention meeting 1-year requirement; append-only audit logs with cryptographic chaining; SMS 2FA fully deprecated in favor of TOTP/FIDO2.',
      startDate: '2025-07-01', targetDate: '2026-12-31', completedDate: '',
      milestones: [
        { id: 'vfd-ms-comp-01', title: 'Complete Oracle TDE deployment across all tablespaces', description: 'Enable Transparent Data Encryption on remaining unencrypted tablespaces and verify key rotation via KMS integration.', status: 'in_progress' as const, dueDate: '2026-03-31', completedDate: '', owner: 'Database Administration' },
        { id: 'vfd-ms-comp-02', title: 'Implement 1-year SIEM log retention', description: 'Deploy tiered retention policy with hot, warm, and cold storage tiers to achieve 1-year log retention for PCI DSS and banking regulatory compliance.', status: 'pending' as const, dueDate: '2026-09-30', completedDate: '', owner: 'Security Operations' },
        { id: 'vfd-ms-comp-03', title: 'Deprecate SMS-based 2FA', description: 'Migrate all customers from SMS-based 2FA to TOTP or FIDO2 authenticators with 6-month transition period and customer communication plan.', status: 'pending' as const, dueDate: '2026-12-31', completedDate: '', owner: 'Identity & Access Management' },
      ],
      linkedRiskIds: ['risk-tde-incomplete', 'risk-siem-retention', 'risk-audit-log-tampering', 'risk-sms-2fa'],
      linkedControlSetIds: [],
      linkedAssetIds: ['asset-transaction-db', 'asset-siem', 'asset-audit-system', 'asset-auth-service'],
      linkedImplementedControlIds: ['vfd-ic-audit-immutable'],
      linkedAssessmentIds: ['assessment-fraud-platform'],
      notes: 'Regulatory examination findings require remediation within 180 days. Budget approved for FY2025-2027.',
      createdAt: NOW, updatedAt: NOW,
    },
  ],
  implementedControls: [
    {
      id: 'vfd-ic-kafka-monitoring', title: 'Real-time Kafka Stream Monitoring & Alerting',
      description: 'Confluent Control Center with custom Splunk correlation rules providing real-time monitoring of fraud detection Kafka streams, consumer lag alerts, and unauthorized topic access detection.',
      controlType: 'technical' as const, category: 'monitoring' as const,
      status: 'active' as const, automationLevel: 'fully_automated' as const,
      owner: 'Platform Engineering', vendor: 'Confluent', product: 'Control Center', version: '7.5',
      implementedDate: '2024-03-15', lastReviewDate: '2025-05-01', nextReviewDate: '2026-05-01',
      linkedSoaEntryIds: ['soa-a09', 'soa-cis-08'],
      linkedRiskIds: ['risk-unencrypted-kafka', 'risk-rate-limit-bypass'],
      linkedAssetIds: ['asset-fraud-engine', 'asset-siem'],
      linkedAssessmentIds: ['assessment-fraud-platform'],
      notes: 'Monitors 25M daily transactions. Consumer lag alerts trigger at 5-second threshold. SASL/PLAIN auth without TLS remains a gap.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'vfd-ic-audit-immutable', title: 'Immutable Audit Log Storage',
      description: 'AWS S3 Object Lock with WORM compliance providing append-only storage for audit management system logs, preventing modification or deletion of audit trail evidence.',
      controlType: 'technical' as const, category: 'logging' as const,
      status: 'active' as const, automationLevel: 'fully_automated' as const,
      owner: 'Compliance', vendor: 'AWS', product: 'S3 Object Lock', version: '2024',
      implementedDate: '2025-01-15', lastReviewDate: '2025-06-01', nextReviewDate: '2026-06-01',
      linkedSoaEntryIds: ['soa-a08', 'soa-cis-08'],
      linkedRiskIds: ['risk-audit-log-tampering'],
      linkedAssetIds: ['asset-audit-system', 'asset-siem'],
      linkedAssessmentIds: ['assessment-fraud-platform'],
      notes: 'WORM retention set to 7 years for banking regulatory compliance. DBAs no longer have write access to archived audit data.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'vfd-ic-fraud-rules', title: 'Adaptive Rate Limiting & Fraud Rule Engine',
      description: 'NICE Actimize X-Sight rules engine with behavioral risk scoring providing adaptive rate limiting, transaction velocity monitoring, and automated suspicious activity flagging for all customer tiers.',
      controlType: 'technical' as const, category: 'access_control' as const,
      status: 'active' as const, automationLevel: 'semi_automated' as const,
      owner: 'Fraud Operations', vendor: 'NICE Actimize', product: 'X-Sight', version: '2024.1',
      implementedDate: '2024-06-01', lastReviewDate: '2025-04-15', nextReviewDate: '2026-04-15',
      linkedSoaEntryIds: ['soa-a01', 'soa-a07'],
      linkedRiskIds: ['risk-rate-limit-bypass', 'risk-sms-2fa'],
      linkedAssetIds: ['asset-fraud-engine', 'asset-auth-service'],
      linkedAssessmentIds: ['assessment-fraud-platform'],
      notes: 'Premium customer rate limit bypass under review. Behavioral risk scoring reduces false positives to 8% but requires manual SAR filing review.',
      createdAt: NOW, updatedAt: NOW,
    },
  ],
  thirdParties: [
    {
      id: 'vfd-tp-twilio',
      name: 'Twilio',
      description: 'SaaS communications platform providing SMS-based two-factor authentication, voice verification, and OTP delivery for online banking customer authentication flows.',
      category: 'saas' as const,
      status: 'active' as const,
      riskRating: 'high' as const,
      dataClassification: 'confidential' as const,
      linkedAssetIds: ['asset-auth-service', 'asset-customer-db'],
      linkedRiskIds: ['risk-sms-2fa', 'risk-rate-limit-bypass'],
      contactName: 'Marcus Johnson',
      contactEmail: 'marcus.johnson@twilio.example.com',
      contractExpiry: '2027-03-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-09-30',
      notes: 'Twilio Enterprise with dedicated short codes for OTP delivery. SMS-based 2FA is vulnerable to SIM swapping, SS7 interception, and real-time phishing relay attacks. Rate limiting on OTP requests bypassed via API key rotation. Twilio Verify API in use but fallback to raw SMS for legacy customers. SOC 2 Type II certified. Phone number data classified as PII — Twilio processes but does not store message content beyond 7-day TTL.'
    },
    {
      id: 'vfd-tp-confluent',
      name: 'Confluent',
      description: 'SaaS managed Apache Kafka platform providing real-time event streaming for transaction processing, fraud detection event pipelines, and inter-service communication across the banking platform.',
      category: 'saas' as const,
      status: 'active' as const,
      riskRating: 'high' as const,
      dataClassification: 'restricted' as const,
      linkedAssetIds: ['asset-fraud-engine', 'asset-transaction-db'],
      linkedRiskIds: ['risk-unencrypted-kafka', 'risk-tde-incomplete'],
      contactName: 'Anna Petrova',
      contactEmail: 'anna.petrova@confluent.example.com',
      contractExpiry: '2027-06-30',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-10-31',
      notes: 'Confluent Cloud Enterprise with dedicated clusters. Kafka topics carrying transaction data are not encrypted in transit between producers and brokers — SASL/PLAIN authentication without TLS. Topics include customer PII, transaction amounts, and fraud scores. Schema Registry enforces Avro schemas but no field-level encryption. Retention policy is 30 days. PCI DSS scope implications for transaction data in Kafka topics. SOC 2 Type II certified.'
    },
    {
      id: 'vfd-tp-sas',
      name: 'SAS Institute',
      description: 'Statistical analytics and fraud detection supplier providing the core fraud scoring engine, machine learning model training infrastructure, and regulatory reporting capabilities.',
      category: 'supplier' as const,
      status: 'active' as const,
      riskRating: 'high' as const,
      dataClassification: 'restricted' as const,
      linkedAssetIds: ['asset-fraud-engine', 'asset-ml-platform', 'asset-model-registry'],
      linkedRiskIds: ['risk-unmasked-training-data', 'risk-model-artifacts-unencrypted'],
      contactName: 'Dr. Robert Chen',
      contactEmail: 'robert.chen@sas.example.com',
      contractExpiry: '2027-09-30',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-09-30',
      notes: 'SAS Fraud Management suite with on-premises deployment. ML model training uses unmasked customer transaction data including account numbers, amounts, and behavioral patterns. Model artifacts stored unencrypted in the model registry. SAS consultants have VPN access for model tuning — contractor access reviewed quarterly. Data processing agreement covers PII handling under GDPR and PCI DSS requirements. Annual SOC 1 Type II audit reviewed.'
    },
    {
      id: 'vfd-tp-splunk',
      name: 'Splunk',
      description: 'SaaS security information and event management (SIEM) platform providing log aggregation, threat detection, fraud alerting, and compliance reporting for the banking infrastructure.',
      category: 'saas' as const,
      status: 'active' as const,
      riskRating: 'medium' as const,
      dataClassification: 'confidential' as const,
      linkedAssetIds: ['asset-siem', 'asset-audit-system'],
      linkedRiskIds: ['risk-audit-log-tampering', 'risk-siem-retention'],
      contactName: 'Yuki Tanaka',
      contactEmail: 'yuki.tanaka@splunk.example.com',
      contractExpiry: '2026-12-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-08-31',
      notes: 'Splunk Cloud Premium with 90-day hot retention and 1-year warm retention. Current retention falls short of 7-year regulatory requirement for banking audit logs — archived data offloaded to S3 but not indexed. Alert fatigue due to 2,000+ daily events with 15% false positive rate. Correlation rules for fraud detection lag behind real-time Kafka events. PCI DSS log monitoring requirements partially met. SOC 2 Type II certified.'
    },
    {
      id: 'vfd-tp-nice-actimize',
      name: 'NICE Actimize',
      description: 'Fraud detection and anti-money laundering (AML) supplier providing transaction monitoring rules, suspicious activity reporting, and regulatory compliance workflows for the banking platform.',
      category: 'supplier' as const,
      status: 'active' as const,
      riskRating: 'high' as const,
      dataClassification: 'restricted' as const,
      linkedAssetIds: ['asset-fraud-engine', 'asset-transaction-db', 'asset-customer-db'],
      linkedRiskIds: ['risk-rate-limit-bypass', 'risk-tde-incomplete'],
      contactName: 'Daniel Schwartz',
      contactEmail: 'daniel.schwartz@niceactimize.example.com',
      contractExpiry: '2027-05-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-11-30',
      notes: 'NICE Actimize X-Sight platform deployed on-premises with cloud-based model updates. Processes full customer transaction history for AML pattern detection — requires access to unencrypted transaction database columns where TDE is incomplete. SAR filing workflows integrated with FinCEN reporting. Rule tuning performed by NICE consultants with read access to production data. Annual FinTech security assessment reviewed. BSA/AML compliance dependency.'
    },
  ],
});

export const vulnerableFraudDetection: ExampleSystem = {
  id: 'vulnerable-fraud-detection',
  name: 'Online Banking Fraud Detection System',
  description: 'Comprehensive fraud detection and prevention system for financial institutions with real-time monitoring',
  category: 'Cybercrime & Fraud',
  // securityLevel removed - no longer part of the system model
  primaryZone: 'Production',
  dataClassification: 'Confidential',
  customContext: `# Online Banking Fraud Detection System

## System Overview
This represents a modern fraud detection and prevention platform used by a major financial institution. The system processes millions of transactions daily, using machine learning and behavioral analytics to identify and prevent fraudulent activities in real-time.

## Business Context
- **Institution Type**: Global retail bank with investment services
- **Customer Base**: 12 million active accounts
- **Transaction Volume**: 25 million transactions per day
- **Geographic Coverage**: 45 countries across 6 continents
- **Regulatory Requirements**: PCI DSS, SOX, GDPR, local banking regulations

## Architecture Overview
The system employs a multi-layered approach to fraud detection:
1. **Real-time Scoring**: Every transaction scored in under 100ms
2. **Behavioral Analytics**: Customer behavior patterns analyzed continuously
3. **Machine Learning**: Multiple ML models for different fraud types
4. **Case Management**: Automated and manual investigation workflows
5. **Global Intelligence**: Threat data from industry consortiums

## Fraud Detection Capabilities
- **Account Takeover**: Detecting unauthorized account access
- **Payment Fraud**: Identifying fraudulent transactions
- **Identity Theft**: Preventing new account fraud
- **Money Laundering**: AML pattern detection
- **Insider Threats**: Employee fraud monitoring

## Technology Stack
- **Core Platform**: Java-based microservices architecture
- **ML Framework**: TensorFlow and custom models
- **Stream Processing**: Apache Kafka and Flink
- **Databases**: Oracle for transactions, Elasticsearch for analytics
- **Cache Layer**: Redis for real-time scoring

## Integration Points
- **Core Banking**: Real-time transaction feeds
- **Customer Channels**: Web, mobile, ATM, branch
- **External Services**: Credit bureaus, threat intelligence
- **Payment Networks**: Card networks, ACH, wire systems
- **Regulatory Reporting**: Automated suspicious activity reports

## Performance Metrics
- **Detection Rate**: 95% fraud detection with 0.1% false positive rate
- **Response Time**: Average 87ms transaction scoring
- **Availability**: 99.99% uptime SLA
- **Throughput**: 500,000 transactions per minute capacity
- **Investigation Time**: Average 2.5 hours per case

## Security Controls
- **Data Encryption**: AES-256 for data at rest, TLS 1.3 in transit
- **Access Control**: Role-based with privileged access management
- **Audit Logging**: Immutable audit trail for all activities
- **Network Security**: Micro-segmentation and zero trust
- **Compliance**: Regular audits and certifications

## Operational Considerations
- **24/7 Monitoring**: Global SOC with follow-the-sun model
- **Incident Response**: 15-minute response time for critical alerts
- **Model Updates**: Weekly retraining with new fraud patterns
- **Capacity Planning**: Auto-scaling for peak periods
- **Disaster Recovery**: Active-active multi-region deployment

## Recent Enhancements
- Implemented graph analytics for money laundering detection
- Added biometric authentication for high-risk transactions
- Deployed edge computing for ATM fraud prevention
- Integrated cryptocurrency transaction monitoring
- Enhanced mobile app fraud detection capabilities

## Known Challenges
- Legacy system integration requires batch processing
- Real-time model updates limited by regulatory approval
- Cross-border transaction monitoring complexity
- Balancing security with customer experience
- Keeping pace with evolving fraud techniques`,
  nodes: [
    // Security Zones
    // Internet: 3 nodes → 600px, x=50
    // DMZ: 3 nodes → 600px, x=50+600+120=770
    // Production: 5 nodes → 800px, x=770+600+120=1490
    // ML/Analytics: 4 nodes → 750px, x=1490+800+120=2410
    // Data: 4 nodes → 750px, x=2410+750+120=3280
    // Compliance: below Production, same x=1490, width=800
    {
      id: 'internet-zone',
      type: 'securityZone',
      position: { x: 150, y: 50 },
      data: {
        label: 'Internet Zone',
        zoneType: 'Internet' as SecurityZone,
        description: 'External connections and threat intelligence',
        zone: 'DMZ' as SecurityZone
      },
      style: {
        width: 600,
        height: 1000,
        background: colors.zoneBackgrounds.Internet,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'dmz-zone',
      type: 'securityZone',
      position: { x: 770, y: 150 },
      data: {
        label: 'DMZ Zone',
        zoneType: 'DMZ' as SecurityZone,
        description: 'Customer-facing services'
      },
      style: {
        width: 600,
        height: 1000,
        background: colors.zoneBackgrounds.DMZ,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'production-zone',
      type: 'securityZone',
      position: { x: 1490, y: 50 },
      data: {
        label: 'Production Zone',
        zoneType: 'Production' as SecurityZone,
        description: 'Core fraud detection systems'
      },
      style: {
        width: 800,
        height: 1000,
        background: colors.zoneBackgrounds.Production,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'ml-zone',
      type: 'securityZone',
      position: { x: 2410, y: 50 },
      data: {
        label: 'ML/Analytics Zone',
        zoneType: 'Internal' as SecurityZone,
        description: 'Machine learning and analytics'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Internal,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'data-zone',
      type: 'securityZone',
      position: { x: 3280, y: 50 },
      data: {
        label: 'Data Zone',
        zoneType: 'Trusted' as SecurityZone,
        description: 'Sensitive data storage'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Trusted,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'compliance-zone',
      type: 'securityZone',
      position: { x: 1500, y: 1100 },
      data: {
        label: 'Compliance Zone',
        zoneType: 'Compliance' as SecurityZone,
        description: 'Regulatory and monitoring systems'
      },
      style: {
        width: 800,
        height: 1000,
        background: colors.zoneBackgrounds.Compliance,
        zIndex: -1
      }
    } as SecurityNode,

    // Internet Zone Components (zone x=50, shift from old x=50: delta=0)
    {
      id: 'threat-intel-feed',
      type: 'threatIntelPlatform',
      position: { x: 425, y: 125 },
      data: {
        label: 'Threat Intelligence Feed',
        description: 'External fraud intelligence sources',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        protocols: ['HTTPS', 'STIX/TAXII'],
        vendor: 'multiple',
        product: 'threat-feeds',
        version: 'various',
        additionalContext: 'API keys stored in application configuration files'
      }
    } as SecurityNode,
    {
      id: 'customer-devices',
      type: 'endpoint',
      position: { x: 325, y: 325 },
      data: {
        label: 'Customer Devices',
        description: 'Web and mobile banking users',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        protocols: ['HTTPS'],
        vendor: 'various',
        product: 'browsers/apps',
        version: 'multiple'
      }
    } as SecurityNode,
    {
      id: 'partner-banks',
      type: 'cloudService',
      position: { x: 425, y: 625 },
      data: {
        label: 'Partner Bank Networks',
        description: 'Correspondent banking connections',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['SWIFT', 'API'],
        vendor: 'swift',
        product: 'gpi',
        version: '2023',
        additionalContext: 'Some partners still use SWIFT MT format without encryption'
      }
    } as SecurityNode,

    // DMZ Zone Components (zone x=770, shift from old x=820: delta=-50)
    {
      id: 'web-banking',
      type: 'webServer',
      position: { x: 875, y: 225 },
      data: {
        label: 'Online Banking Portal',
        description: 'Customer web banking interface',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'WSS'],
        vendor: 'custom',
        product: 'digital-banking',
        version: '4.2',
        additionalContext: 'Session cookies use httpOnly but not secure flag in dev'
      }
    } as SecurityNode,
    {
      id: 'mobile-gateway',
      type: 'apiGateway',
      position: { x: 1075, y: 325 },
      data: {
        label: 'Mobile API Gateway',
        description: 'Mobile app backend services',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'REST'],
        vendor: 'apigee',
        product: 'edge',
        version: '4.51',
        additionalContext: 'Rate limiting bypassed for premium customers'
      }
    } as SecurityNode,
    {
      id: 'fraud-api',
      type: 'api',
      position: { x: 1275, y: 375 },
      data: {
        label: 'Fraud Reporting API',
        description: 'Customer fraud reporting endpoint',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'REST'],
        vendor: 'custom',
        product: 'fraud-api',
        version: '2.1',
        technology: 'Spring Boot'
      }
    } as SecurityNode,

    // Production Zone Components (zone x=1490, shift from old x=1590: delta=-100)
    {
      id: 'fraud-engine',
      type: 'fraudDetection',
      position: { x: 1575, y: 175 },
      data: {
        label: 'Real-time Fraud Engine',
        description: 'Core fraud scoring engine',
        zone: 'Production' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['Kafka', 'gRPC'],
        vendor: 'featurespace',
        product: 'aric-risk-hub',
        version: '5.2',
        additionalContext: 'ML model updates require manual deployment'
      }
    } as SecurityNode,
    {
      id: 'rule-engine',
      type: 'application',
      position: { x: 1825, y: 325 },
      data: {
        label: 'Business Rules Engine',
        description: 'Configurable fraud rules',
        zone: 'Production' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'JMX'],
        vendor: 'drools',
        product: 'business-rules',
        version: '7.73',
        additionalContext: 'Rule changes logged but not version controlled'
      }
    } as SecurityNode,
    {
      id: 'case-management',
      type: 'application',
      position: { x: 1675, y: 475 },
      data: {
        label: 'Case Management System',
        description: 'Fraud investigation platform',
        zone: 'Production' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'LDAP'],
        vendor: 'nice-actimize',
        product: 'xceed',
        version: '6.3',
        additionalContext: 'Investigators can export case data to Excel'
      }
    } as SecurityNode,
    {
      id: 'transaction-monitor',
      type: 'transactionMonitor',
      position: { x: 1925, y: 625 },
      data: {
        label: 'Transaction Monitor',
        description: 'Real-time transaction analysis',
        zone: 'Production' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['Kafka', 'JDBC'],
        vendor: 'custom',
        product: 'tx-monitor',
        version: '3.4',
        technology: 'Apache Flink'
      }
    } as SecurityNode,
    {
      id: 'auth-service',
      type: 'authServer',
      position: { x: 1525, y: 825 },
      data: {
        label: 'Authentication Service',
        description: 'Customer authentication and MFA',
        zone: 'Production' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'RADIUS'],
        vendor: 'rsa',
        product: 'securid',
        version: '8.7',
        additionalContext: 'SMS-based 2FA still supported for compatibility'
      }
    } as SecurityNode,

    // ML/Analytics Zone Components (zone x=2410, shift from old x=2360: delta=+50)
    {
      id: 'ml-platform',
      type: 'mlPipeline',
      position: { x: 2475, y: 375 },
      data: {
        label: 'ML Training Platform',
        description: 'Fraud model training infrastructure',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'HDFS'],
        vendor: 'databricks',
        product: 'ml-runtime',
        version: '13.3',
        additionalContext: 'Training data includes unmasked historical transactions'
      }
    } as SecurityNode,
    {
      id: 'feature-store',
      type: 'featureStore',
      position: { x: 3025, y: 225 },
      data: {
        label: 'Feature Store',
        description: 'ML feature management',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'Parquet'],
        vendor: 'feast',
        product: 'feature-store',
        version: '0.35',
        technology: 'Python, Redis'
      }
    } as SecurityNode,
    {
      id: 'analytics-cluster',
      type: 'dataLake',
      position: { x: 2575, y: 475 },
      data: {
        label: 'Analytics Cluster',
        description: 'Big data analytics platform',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HDFS', 'Spark'],
        vendor: 'cloudera',
        product: 'cdp',
        version: '7.1.8',
        additionalContext: 'Kerberos authentication optional for internal users'
      }
    } as SecurityNode,
    {
      id: 'model-registry',
      type: 'modelRegistry',
      position: { x: 3025, y: 725 },
      data: {
        label: 'Model Registry',
        description: 'ML model versioning and deployment',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'S3'],
        vendor: 'mlflow',
        product: 'model-registry',
        version: '2.8',
        additionalContext: 'Model artifacts stored without encryption'
      }
    } as SecurityNode,

    // Data Zone Components (zone x=3280, shift from old x=3130: delta=+150)
    {
      id: 'transaction-db',
      type: 'database',
      position: { x: 3375, y: 175 },
      data: {
        label: 'Transaction Database',
        description: 'Primary transaction store',
        zone: 'Trusted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['Oracle RAC', 'TLS'],
        vendor: 'oracle',
        product: 'database',
        version: '19c',
        additionalContext: 'Transparent Data Encryption not enabled on all tablespaces'
      }
    } as SecurityNode,
    {
      id: 'customer-db',
      type: 'database',
      position: { x: 3575, y: 325 },
      data: {
        label: 'Customer Database',
        description: 'Customer profiles and history',
        zone: 'Trusted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['PostgreSQL', 'SSL'],
        vendor: 'postgresql',
        product: 'postgresql',
        version: '15.4',
        additionalContext: 'Backup retention exceeds data privacy requirements'
      }
    } as SecurityNode,
    {
      id: 'fraud-warehouse',
      type: 'database',
      position: { x: 3575, y: 425 },
      data: {
        label: 'Fraud Data Warehouse',
        description: 'Historical fraud data and patterns',
        zone: 'Trusted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['Snowflake', 'HTTPS'],
        vendor: 'snowflake',
        product: 'data-cloud',
        version: 'current',
        additionalContext: 'Data sharing enabled with third-party vendors'
      }
    } as SecurityNode,
    {
      id: 'key-management',
      type: 'kms',
      position: { x: 3825, y: 175 },
      data: {
        label: 'Key Management Service',
        description: 'Cryptographic key management',
        zone: 'Trusted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['PKCS#11', 'HTTPS'],
        vendor: 'thales',
        product: 'ciphertrust',
        version: '2.14',
        additionalContext: 'Master keys rotated annually instead of quarterly'
      }
    } as SecurityNode,

    // Compliance Zone Components (zone x=1490, shift from old x=1590: delta=-100)
    {
      id: 'siem-platform',
      type: 'siem',
      position: { x: 1575, y: 1275 },
      data: {
        label: 'SIEM Platform',
        description: 'Security monitoring and correlation',
        zone: 'Compliance' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['Syslog', 'HTTPS'],
        vendor: 'splunk',
        product: 'enterprise-security',
        version: '9.1.2',
        additionalContext: 'Log retention limited to 90 days due to storage costs'
      }
    } as SecurityNode,
    {
      id: 'regulatory-reporting',
      type: 'complianceScanner',
      position: { x: 1675, y: 1275 },
      data: {
        label: 'Regulatory Reporting',
        description: 'Automated compliance reporting',
        zone: 'Compliance' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'SFTP'],
        vendor: 'oracle',
        product: 'fccm',
        version: '8.0.8',
        technology: 'Java EE'
      }
    } as SecurityNode,
    {
      id: 'audit-system',
      type: 'auditLogger',
      position: { x: 2075, y: 1225 },
      data: {
        label: 'Audit Management',
        description: 'Comprehensive audit logging',
        zone: 'Compliance' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'REST'],
        vendor: 'custom',
        product: 'audit-logger',
        version: '2.3',
        additionalContext: 'Audit logs can be modified by DBAs'
      }
    } as SecurityNode,
    {
      id: 'dlp-system',
      type: 'dlp',
      position: { x: 1875, y: 1225 },
      data: {
        label: 'Data Loss Prevention',
        description: 'Sensitive data monitoring',
        zone: 'Compliance' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'SMTP'],
        vendor: 'forcepoint',
        product: 'dlp',
        version: '8.8',
        additionalContext: 'DLP policies not applied to executive accounts'
      }
    } as SecurityNode
  ],
  edges: [
    // Customer interactions
    {
      id: 'e1',
      source: 'customer-devices',
      target: 'web-banking',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Web Banking',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: true,
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e2',
      source: 'customer-devices',
      target: 'mobile-gateway',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Mobile Banking',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: true,
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,

    // DMZ to Production
    {
      id: 'e3',
      source: 'web-banking',
      target: 'fraud-engine',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Transaction Scoring',
        protocol: 'gRPC',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true,
        zone: 'Production' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e4',
      source: 'mobile-gateway',
      target: 'fraud-engine',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Mobile Scoring',
        protocol: 'REST',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true,
        zone: 'Production' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e5',
      source: 'fraud-api',
      target: 'case-management',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Fraud Reports',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: false,
        zone: 'Production' as SecurityZone
      }
    } as SecurityEdge,

    // Fraud detection flow
    {
      id: 'e6',
      source: 'fraud-engine',
      target: 'rule-engine',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Rule Evaluation',
        protocol: 'Internal API',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true,
        zone: 'Production' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e7',
      source: 'fraud-engine',
      target: 'transaction-monitor',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Transaction Stream',
        protocol: 'Kafka',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true,
        zone: 'Production' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e8',
      source: 'rule-engine',
      target: 'case-management',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Alert Generation',
        protocol: 'JMS',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true,
        zone: 'Production' as SecurityZone
      }
    } as SecurityEdge,

    // Authentication flow
    {
      id: 'e9',
      source: 'web-banking',
      target: 'auth-service',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'left',
      data: {
        label: 'Authentication',
        protocol: 'RADIUS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true,
        zone: 'Production' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e10',
      source: 'mobile-gateway',
      target: 'auth-service',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Mobile Auth',
        protocol: 'OAuth2',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true,
        zone: 'Production' as SecurityZone
      }
    } as SecurityEdge,

    // ML and Analytics flows
    {
      id: 'e11',
      source: 'fraud-engine',
      target: 'ml-platform',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Model Request',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: false,
        zone: 'Production' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e12',
      source: 'ml-platform',
      target: 'feature-store',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Feature Pipeline',
        protocol: 'gRPC',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: false,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e13',
      source: 'feature-store',
      target: 'analytics-cluster',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Feature Computation',
        protocol: 'Spark',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: false,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e14',
      source: 'ml-platform',
      target: 'model-registry',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Model Deployment',
        protocol: 'S3 API',
        encryption: 'HTTPS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: false,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,

    // Data access flows
    {
      id: 'e15',
      source: 'transaction-monitor',
      target: 'transaction-db',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Transaction Query',
        protocol: 'JDBC',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true,
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e16',
      source: 'fraud-engine',
      target: 'customer-db',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Customer Lookup',
        protocol: 'PostgreSQL',
        encryption: 'SSL',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true,
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e17',
      source: 'analytics-cluster',
      target: 'fraud-warehouse',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        controlPoints: [{ id: 'cp-1771652758485', x: 3450, y: 500, active: true }],
        label: 'Data Pipeline',
        protocol: 'Snowflake',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: false,
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e18',
      source: 'transaction-db',
      target: 'key-management',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Key Retrieval',
        protocol: 'PKCS#11',
        encryption: 'Hardware',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: false,
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,

    // External integrations
    {
      id: 'e19',
      source: 'threat-intel-feed',
      target: 'fraud-engine',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        controlPoints: [
          { id: 'cp-1771652636278', x: 750, y: 100, active: true },
          { id: 'cp-1771652630335', x: 1400, y: 100, active: true }
        ],
        label: 'Threat Data',
        protocol: 'STIX/TAXII',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        animated: false,
        zone: 'Production' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e20',
      source: 'partner-banks',
      target: 'transaction-monitor',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Cross-bank Txns',
        protocol: 'SWIFT',
        encryption: 'varies',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: true,
        zone: 'Production' as SecurityZone
      }
    } as SecurityEdge,

    // Compliance and monitoring
    {
      id: 'e21',
      source: 'fraud-engine',
      target: 'siem-platform',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Security Events',
        protocol: 'Syslog',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: false,
        zone: 'Compliance' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e22',
      source: 'case-management',
      target: 'regulatory-reporting',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'SAR Filing',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: false,
        zone: 'Compliance' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e23',
      source: 'transaction-monitor',
      target: 'audit-system',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Audit Trail',
        protocol: 'REST API',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: false,
        zone: 'Compliance' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e24',
      source: 'case-management',
      target: 'dlp-system',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'left',
      data: {
        label: 'Data Monitoring',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: false,
        zone: 'Compliance' as SecurityZone
      }
    } as SecurityEdge,

    // Additional ML feedback loops
    {
      id: 'e25',
      source: 'case-management',
      target: 'ml-platform',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Feedback Loop',
        protocol: 'Batch Upload',
        encryption: 'SFTP',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: false,
        zone: 'Production' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e26',
      source: 'fraud-warehouse',
      target: 'ml-platform',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Training Data',
        protocol: 'Snowflake',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: false,
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge
  ],
  grcWorkspace: vulnerableFraudDetectionGrcWorkspace,
  attackPaths: [
    {
      id: 'ap-ato-sms-fraud',
      name: 'Account Takeover via SMS 2FA → Fraudulent Transactions',
      strideCategory: 'Spoofing',
      riskLevel: 'Critical',
      description: 'An attacker performs a SIM-swap attack to intercept SMS-based 2FA codes, authenticates through the mobile API gateway as a premium customer (bypassing rate limits), and submits high-volume fraudulent transactions to the fraud engine which scores them against a profile the attacker has groomed over time.',
      steps: [
        {
          order: 1,
          edgeId: 'e2',
          sourceNodeId: 'customer-devices',
          targetNodeId: 'mobile-gateway',
          technique: 'T1078: Valid Accounts',
        },
        {
          order: 2,
          edgeId: 'e10',
          sourceNodeId: 'mobile-gateway',
          targetNodeId: 'auth-service',
          technique: 'T1111: Multi-Factor Authentication Interception',
        },
        {
          order: 3,
          edgeId: 'e4',
          sourceNodeId: 'mobile-gateway',
          targetNodeId: 'fraud-engine',
          technique: 'T1565: Data Manipulation',
        },
      ],
      mitreTechniques: ['T1078', 'T1111', 'T1565'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-ml-model-poisoning',
      name: 'ML Model Poisoning via Unencrypted Registry → Fraud Evasion',
      strideCategory: 'Tampering',
      riskLevel: 'Critical',
      description: 'An attacker with access to the ML/Analytics zone replaces an unsigned model artifact in the model registry with a poisoned version. The fraud engine loads the poisoned model via the ML platform, causing specific fraud patterns to go undetected and enabling a coordinated fraud campaign.',
      steps: [
        {
          order: 1,
          edgeId: 'e14',
          sourceNodeId: 'ml-platform',
          targetNodeId: 'model-registry',
          technique: 'T1195: Supply Chain Compromise',
        },
        {
          order: 2,
          edgeId: 'e11',
          sourceNodeId: 'fraud-engine',
          targetNodeId: 'ml-platform',
          technique: 'T1565.001: Stored Data Manipulation',
        },
      ],
      mitreTechniques: ['T1195', 'T1565.001'],
      createdAt: '2025-06-01T00:05:00.000Z',
      updatedAt: '2025-06-01T00:05:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-kafka-eavesdrop-exfil',
      name: 'Kafka Stream Eavesdropping → Customer Data Exfiltration',
      strideCategory: 'Information Disclosure',
      riskLevel: 'High',
      description: 'An attacker who gains access to the production network intercepts unencrypted Kafka streams between the fraud engine and the transaction monitor, collecting confidential transaction data. The attacker then follows the data path to the customer database to exfiltrate full customer profiles.',
      steps: [
        {
          order: 1,
          edgeId: 'e7',
          sourceNodeId: 'fraud-engine',
          targetNodeId: 'transaction-monitor',
          technique: 'T1040: Network Sniffing',
        },
        {
          order: 2,
          edgeId: 'e15',
          sourceNodeId: 'transaction-monitor',
          targetNodeId: 'transaction-db',
          technique: 'T1005: Data from Local System',
        },
        {
          order: 3,
          edgeId: 'e16',
          sourceNodeId: 'fraud-engine',
          targetNodeId: 'customer-db',
          technique: 'T1041: Exfiltration Over C2 Channel',
        },
      ],
      mitreTechniques: ['T1040', 'T1005', 'T1041'],
      createdAt: '2025-06-01T00:10:00.000Z',
      updatedAt: '2025-06-01T00:10:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-partner-lateral-movement',
      name: 'Partner Network Compromise → Lateral Movement to Fraud Warehouse',
      strideCategory: 'Elevation of Privilege',
      riskLevel: 'High',
      description: 'An attacker compromises a partner bank connection using unencrypted SWIFT MT messages, gains a foothold in the transaction monitor, then pivots through the analytics cluster to exfiltrate historical fraud patterns and customer data from the fraud data warehouse.',
      steps: [
        {
          order: 1,
          edgeId: 'e20',
          sourceNodeId: 'partner-banks',
          targetNodeId: 'transaction-monitor',
          technique: 'T1199: Trusted Relationship',
        },
        {
          order: 2,
          edgeId: 'e15',
          sourceNodeId: 'transaction-monitor',
          targetNodeId: 'transaction-db',
          technique: 'T1078: Valid Accounts',
        },
        {
          order: 3,
          edgeId: 'e17',
          sourceNodeId: 'analytics-cluster',
          targetNodeId: 'fraud-warehouse',
          technique: 'T1005: Data from Local System',
        },
      ],
      mitreTechniques: ['T1199', 'T1078', 'T1005'],
      createdAt: '2025-06-01T00:15:00.000Z',
      updatedAt: '2025-06-01T00:15:00.000Z',
    } as DiagramAttackPath,
  ],
};
