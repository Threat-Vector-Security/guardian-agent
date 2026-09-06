// vulnerableCloud.ts
import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityZone, SecurityEdge, SecurityNode } from '../../types/SecurityTypes';
import { DiagramAttackPath, AssessmentThreatModelNodeSourceType, AssessmentThreatModelEdgeSourceType, AttackPathRiskLevel } from '../../types/GrcTypes';
import { colors } from '../../styles/Theme';
import { buildGrcWorkspace, score, NOW, OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID } from './grcSharedBase';
import { StrideCategory } from '../../types/ThreatIntelTypes';
const tierCatalogue = [
  { id: 'tier1-cyber', tier: 1 as const, label: 'Cyber Risk', description: 'Information security and cyber threats' },
  { id: 'tier1-operational', tier: 1 as const, label: 'Operational Risk', description: 'Business operations and process risks' },
  { id: 'tier2-cloud-infra', tier: 2 as const, label: 'Cloud Infrastructure', parentId: 'tier1-cyber', description: 'AWS service-level misconfigurations and exposure' },
  { id: 'tier2-identity', tier: 2 as const, label: 'Identity & Access', parentId: 'tier1-cyber', description: 'IAM, Cognito, and federated identity controls' },
  { id: 'tier2-data', tier: 2 as const, label: 'Data Protection', parentId: 'tier1-cyber', description: 'Data-at-rest and data-in-transit protection' },
  { id: 'tier2-network', tier: 2 as const, label: 'Network Security', parentId: 'tier1-cyber', description: 'VPC, security group, and edge network controls' },
  { id: 'tier2-monitoring', tier: 2 as const, label: 'Security Monitoring', parentId: 'tier1-operational', description: 'Logging, detection, and incident response' },
  { id: 'tier2-multicloud', tier: 2 as const, label: 'Multi-Cloud Governance', parentId: 'tier1-operational', description: 'Cross-cloud policy consistency and orchestration' },
  { id: 'tier3-weak-tls', tier: 3 as const, label: 'Weak TLS Configuration', parentId: 'tier2-network' },
  { id: 'tier3-iam-overprivilege', tier: 3 as const, label: 'Overprivileged IAM Roles', parentId: 'tier2-identity' },
  { id: 'tier3-kms-crossaccess', tier: 3 as const, label: 'Cross-Service Key Access', parentId: 'tier2-data' },
  { id: 'tier3-privileged-containers', tier: 3 as const, label: 'Privileged Container Access', parentId: 'tier2-cloud-infra' },
  { id: 'tier3-config-drift', tier: 3 as const, label: 'Infrastructure Config Drift', parentId: 'tier2-multicloud' },
  { id: 'tier3-identity-federation', tier: 3 as const, label: 'Cross-Cloud Identity Federation', parentId: 'tier2-identity' },
  { id: 'tier3-finding-suppression', tier: 3 as const, label: 'Suppressed Security Findings', parentId: 'tier2-monitoring' },
  { id: 'tier3-hardcoded-secrets', tier: 3 as const, label: 'Hardcoded Connection Strings', parentId: 'tier2-data' },
  { id: 'tier4-tls-version-enforcement', tier: 4 as const, label: 'TLS 1.2+ Minimum Enforcement', parentId: 'tier3-weak-tls' },
  { id: 'tier4-least-privilege-roles', tier: 4 as const, label: 'Least Privilege Role Design', parentId: 'tier3-iam-overprivilege' },
  { id: 'tier4-key-scope-restriction', tier: 4 as const, label: 'Key Policy Scope Restriction', parentId: 'tier3-kms-crossaccess' },
  { id: 'tier4-container-sec-context', tier: 4 as const, label: 'Non-Privileged Security Context', parentId: 'tier3-privileged-containers' },
];

const assets = [
  {
    id: 'asset-alb', name: 'Application Load Balancer', type: 'network_device', owner: 'Platform Engineering',
    domain: 'it' as const, category: 'Network Infrastructure',
    businessCriticality: 5, securityCriticality: 5,
    description: 'AWS ALB distributing web traffic with TLS 1.0/1.1 still enabled for legacy compatibility',
    criticality: { confidentiality: 3, integrity: 4, availability: 5, financial: 5, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-cloud', nodeId: 'load-balancer', nodeLabel: 'Application Load Balancer', nodeType: 'loadBalancer' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-web-cluster', name: 'ECS Fargate Web Cluster', type: 'application_server', owner: 'Development',
    domain: 'application' as const, category: 'Compute',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Containerized Node.js application cluster with privileged container access enabled for debugging',
    criticality: { confidentiality: 4, integrity: 5, availability: 5, financial: 5, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-cloud', nodeId: 'web-app-cluster', nodeLabel: 'Web Application Cluster', nodeType: 'server' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-lambda', name: 'Lambda Functions', type: 'serverless_function', owner: 'Development',
    domain: 'application' as const, category: 'Compute',
    businessCriticality: 4, securityCriticality: 5,
    description: 'Serverless Python workers processing API requests with broad execution roles',
    criticality: { confidentiality: 4, integrity: 5, availability: 3, financial: 4, reputation: 3, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-cloud', nodeId: 'lambda-functions', nodeLabel: 'Lambda Functions', nodeType: 'functionApp' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-rds', name: 'RDS PostgreSQL Primary', type: 'database', owner: 'Database Administration',
    domain: 'application' as const, category: 'Database',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Primary relational database storing customer PII, transactions, and healthcare records',
    criticality: { confidentiality: 5, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 2 },
    diagramRefs: [{ diagramId: 'vulnerable-cloud', nodeId: 'primary-database', nodeLabel: 'RDS PostgreSQL', nodeType: 'cloudDatabase' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-s3-datalake', name: 'S3 Data Lake', type: 'cloud_storage', owner: 'Data Engineering',
    domain: 'it' as const, category: 'Cloud Infrastructure',
    businessCriticality: 4, securityCriticality: 5,
    description: 'S3 buckets for data lake and backups with KMS encryption',
    criticality: { confidentiality: 5, integrity: 4, availability: 4, financial: 4, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-cloud', nodeId: 'object-storage', nodeLabel: 'S3 Data Lake', nodeType: 'storageAccount' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-kms', name: 'Key Management Service', type: 'security_control', owner: 'Security Operations',
    domain: 'it' as const, category: 'Security Tools',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Centralized encryption key management with cross-service key access enabled',
    criticality: { confidentiality: 5, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-cloud', nodeId: 'kms', nodeLabel: 'Key Management Service', nodeType: 'server' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-cognito', name: 'Cognito User Pool', type: 'identity_provider', owner: 'Identity & Access Management',
    domain: 'it' as const, category: 'Identity',
    businessCriticality: 5, securityCriticality: 5,
    description: 'User authentication service federating with Azure AD and supporting OAuth/SAML',
    criticality: { confidentiality: 5, integrity: 5, availability: 5, financial: 4, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-cloud', nodeId: 'auth-service', nodeLabel: 'Cognito User Pool', nodeType: 'authServer' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-terraform', name: 'Terraform Cloud', type: 'devops_tool', owner: 'DevOps Engineering',
    domain: 'it' as const, category: 'Infrastructure Management',
    businessCriticality: 4, securityCriticality: 4,
    description: 'IaC orchestration controlling multi-cloud resource provisioning with state encryption',
    criticality: { confidentiality: 4, integrity: 5, availability: 3, financial: 3, reputation: 3, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-cloud', nodeId: 'terraform-cloud', nodeLabel: 'Terraform Cloud', nodeType: 'server' }],
    createdAt: NOW, updatedAt: NOW
  },
];

const risks = [
  {
    id: 'risk-weak-tls', title: 'Weak TLS Configuration on ALB',
    description: 'Application Load Balancer allows TLS 1.0 and TLS 1.1 for legacy client compatibility, exposing user traffic to known protocol downgrade attacks (BEAST, POODLE).',
    status: 'assessed' as const, owner: 'Platform Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Network Security', tier3: 'Weak TLS Configuration' },
    assetIds: ['asset-alb'],
    diagramLinks: [{ diagramId: 'vulnerable-cloud', nodeIds: ['load-balancer', 'external-users'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Enforce TLS 1.2 minimum on ALB listener policies and deprecate legacy cipher suites',
    threatActorIds: ['threat-actor-apt'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-privileged-containers', title: 'Privileged Container Access in ECS Cluster',
    description: 'ECS Fargate tasks configured with privileged security context for debugging, allowing container escape to underlying host and lateral movement.',
    status: 'draft' as const, owner: 'Development',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Cloud Infrastructure', tier3: 'Privileged Container Access' },
    assetIds: ['asset-web-cluster'],
    diagramLinks: [{ diagramId: 'vulnerable-cloud', nodeIds: ['web-app-cluster'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Remove privileged flag and configure read-only root filesystem with minimal capabilities',
    threatActorIds: ['threat-actor-apt'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-kms-crossaccess', title: 'Cross-Service KMS Key Access',
    description: 'KMS key policies grant broad cross-service access for operational flexibility, allowing any service with the key alias to decrypt data across RDS, S3, and Redshift without granular resource constraints.',
    status: 'assessed' as const, owner: 'Security Operations',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Data Protection', tier3: 'Cross-Service Key Access' },
    assetIds: ['asset-kms', 'asset-rds', 'asset-s3-datalake'],
    diagramLinks: [{ diagramId: 'vulnerable-cloud', nodeIds: ['kms', 'primary-database', 'object-storage'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Implement per-service KMS key policies with resource-level conditions',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-hardcoded-connstrings', title: 'Database Connection Strings in Application Config',
    description: 'RDS connection strings including credentials are stored in application configuration files rather than AWS Secrets Manager, creating exposure risk during code review or container image inspection.',
    status: 'draft' as const, owner: 'Development',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Data Protection', tier3: 'Hardcoded Connection Strings' },
    assetIds: ['asset-rds', 'asset-web-cluster', 'asset-lambda'],
    diagramLinks: [{ diagramId: 'vulnerable-cloud', nodeIds: ['primary-database', 'web-app-cluster', 'lambda-functions'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Migrate credentials to Secrets Manager with automatic rotation and IAM-based access',
    threatActorIds: ['threat-actor-insider'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-identity-federation', title: 'Cross-Cloud Identity Federation Misconfiguration',
    description: 'Cognito-to-Azure AD federation trusts all Azure AD tenants without audience restriction, allowing token replay from compromised Azure environments to gain access to AWS resources.',
    status: 'assessed' as const, owner: 'Identity & Access Management',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Identity & Access', tier3: 'Cross-Cloud Identity Federation' },
    assetIds: ['asset-cognito'],
    diagramLinks: [{ diagramId: 'vulnerable-cloud', nodeIds: ['auth-service', 'azure-ad-connector'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Restrict federation trust to specific Azure AD tenant IDs and enforce audience claim validation',
    threatActorIds: ['threat-actor-apt'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-terraform-state', title: 'Terraform State Contains Sensitive Outputs',
    description: 'Terraform Cloud state files contain database connection strings, API keys, and KMS ARNs in plaintext outputs, accessible to all workspace members.',
    status: 'draft' as const, owner: 'DevOps Engineering',
    tierPath: { tier1: 'Operational Risk', tier2: 'Multi-Cloud Governance', tier3: 'Infrastructure Config Drift' },
    assetIds: ['asset-terraform', 'asset-rds', 'asset-kms'],
    diagramLinks: [{ diagramId: 'vulnerable-cloud', nodeIds: ['terraform-cloud', 'web-app-cluster'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Mark sensitive outputs, restrict workspace access, and enable state encryption at rest',
    threatActorIds: ['threat-actor-insider'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-suppressed-findings', title: 'Suppressed Security Hub Findings',
    description: 'Security Hub findings for critical resources are suppressed to reduce dashboard noise, masking active vulnerabilities and configuration drift from SOC analysts.',
    status: 'assessed' as const, owner: 'Security Operations',
    tierPath: { tier1: 'Operational Risk', tier2: 'Security Monitoring', tier3: 'Suppressed Security Findings' },
    assetIds: ['asset-web-cluster', 'asset-lambda'],
    diagramLinks: [{ diagramId: 'vulnerable-cloud', nodeIds: ['security-hub', 'security-center'] }],
    inherentScore: score('likelihood-4', 'impact-3'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Replace blanket suppression with targeted exceptions and implement weekly finding review cadence',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-lambda-overprivilege', title: 'Lambda Execution Role with Broad Permissions',
    description: 'Lambda function execution roles include s3:*, dynamodb:*, and secretsmanager:* wildcard permissions instead of resource-scoped policies.',
    status: 'draft' as const, owner: 'Development',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Identity & Access', tier3: 'Overprivileged IAM Roles' },
    assetIds: ['asset-lambda', 'asset-s3-datalake'],
    diagramLinks: [{ diagramId: 'vulnerable-cloud', nodeIds: ['lambda-functions', 'object-storage'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Scope Lambda execution role to specific resource ARNs and apply condition keys',
    threatActorIds: ['threat-actor-apt'],
    createdAt: NOW, updatedAt: NOW
  },
];

const assessments = [
  {
    id: 'assessment-cloud-security', title: 'Enterprise Multi-Cloud Platform Security Assessment',
    status: 'in_review' as const,
    owner: 'Security Architecture',
    reviewer: 'CISO',
    startDate: '2025-05-15',
    dueDate: '2025-07-01',
    threatActorIds: ['threat-actor-apt', 'threat-actor-insider', 'threat-actor-cloud-criminal'],
    methodologyNote: 'Assessment follows CSA CCM v4 and NIST CSF 2.0 methodology for multi-cloud environments.',
    assumptionNote: 'Assessment assumes current production configuration as of June 2025. Development and staging environments excluded.',
    scopeItems: [
      { id: 'scope-system-cloud', type: 'system' as const, value: 'system', name: 'Enterprise Multi-Cloud Platform' },
      { id: 'scope-zone-cloud', type: 'diagram_segment' as const, value: 'Cloud', name: 'Cloud Zone' },
      { id: 'scope-zone-restricted', type: 'diagram_segment' as const, value: 'Restricted', name: 'Restricted Zone' },
      { id: 'scope-osi-l7', type: 'osi_layer' as const, value: 'L7 Application', name: 'L7 Application' },
    ],
    tierFilter: { tier1: 'Cyber Risk' },
    riskManagementPlan: {
      objective: 'Reduce cloud-native attack surface and enforce least privilege across all compute and identity services.',
      strategy: 'Prioritize IAM and container security hardening, then address data protection and monitoring gaps.',
      residualRiskStatement: 'Residual risk accepted only for legacy TLS with documented compensating controls.',
      monitoringApproach: 'Bi-weekly review of open plan actions with monthly Security Hub compliance scoring.',
      communicationPlan: 'Report to Cloud Security Steering Committee every two weeks.',
      reviewCadenceDays: 14,
      actions: [
        {
          id: 'rmp-action-tls-enforce',
          title: 'Enforce TLS 1.2 minimum on all ALB listeners',
          owner: 'Platform Engineering',
          dueDate: '2025-06-15',
          status: 'in_progress' as const,
          linkedRiskIds: ['risk-weak-tls'],
          notes: 'Security policy updated; rollout scheduled for next maintenance window'
        },
        {
          id: 'rmp-action-container-harden',
          title: 'Remove privileged container flag from ECS task definitions',
          owner: 'Development',
          dueDate: '2025-06-20',
          status: 'planned' as const,
          linkedRiskIds: ['risk-privileged-containers'],
          notes: 'Requires coordination with debugging tool replacement'
        },
        {
          id: 'rmp-action-secrets-migration',
          title: 'Migrate database credentials to Secrets Manager',
          owner: 'Development',
          dueDate: '2025-06-30',
          status: 'in_progress' as const,
          linkedRiskIds: ['risk-hardcoded-connstrings'],
          notes: 'Lambda migration complete; ECS migration in progress'
        },
        {
          id: 'rmp-action-kms-scope',
          title: 'Implement per-service KMS key policies',
          owner: 'Security Operations',
          dueDate: '2025-07-15',
          status: 'planned' as const,
          linkedRiskIds: ['risk-kms-crossaccess'],
          notes: ''
        },
      ],
      updatedAt: NOW
    },
    riskIds: risks.map(r => r.id),
    soaGapIds: ['soa-a01', 'soa-a02', 'soa-a05'],
    taskIds: ['task-tls-enforcement', 'task-secrets-migration'],
    linkedImplementedControlIds: [],
    linkedInitiativeIds: [],
    summary: 'Comprehensive assessment of the multi-cloud platform covering 8 identified risks across cloud infrastructure, identity, data protection, and monitoring domains.',
    findings: 'Key findings include weak TLS on ALB, privileged containers, overly broad KMS access, hardcoded credentials, and suppressed security findings.',
    recommendations: 'Prioritize credential rotation and secrets management migration, enforce least privilege on Lambda and container roles, and restore Security Hub finding visibility.',
    evidenceSummary: 'Evidence includes Security Hub compliance reports, IAM policy extracts, ECS task definitions, and Terraform state audit.',
    threatModel: {
      nodes: [
        { id: 'tm-node-users', label: 'External Users', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'external-users', position: { x: 50, y: 200 }, nodeType: 'workstation' },
        { id: 'tm-node-alb', label: 'ALB', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'load-balancer', position: { x: 200, y: 200 }, nodeType: 'loadBalancer', commentary: 'TLS 1.0/1.1 enabled for legacy clients' },
        { id: 'tm-node-web', label: 'Web App Cluster', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'web-app-cluster', position: { x: 350, y: 200 }, nodeType: 'server', commentary: 'Privileged containers with debug access' },
        { id: 'tm-node-lambda', label: 'Lambda Functions', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'lambda-functions', position: { x: 500, y: 200 }, nodeType: 'functionApp', commentary: 'Broad execution role with wildcard permissions' },
        { id: 'tm-node-rds', label: 'RDS PostgreSQL', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'primary-database', position: { x: 650, y: 200 }, nodeType: 'cloudDatabase', commentary: 'Connection strings hardcoded in application config' },
        { id: 'tm-node-s3', label: 'S3 Data Lake', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'object-storage', position: { x: 650, y: 350 }, nodeType: 'storageAccount' },
        { id: 'tm-node-kms', label: 'KMS', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'kms', position: { x: 800, y: 275 }, nodeType: 'server', commentary: 'Cross-service key access enabled' },
      ],
      edges: [
        { id: 'tm-edge-users-alb', source: 'tm-node-users', target: 'tm-node-alb', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'edge-1', label: 'HTTPS (TLS 1.0/1.1 allowed)', commentary: 'Weak TLS allows protocol downgrade attacks' },
        { id: 'tm-edge-alb-web', source: 'tm-node-alb', target: 'tm-node-web', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'edge-2', label: 'Load Balanced Traffic' },
        { id: 'tm-edge-web-lambda', source: 'tm-node-web', target: 'tm-node-lambda', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'edge-6', label: 'Service Integration' },
        { id: 'tm-edge-lambda-rds', source: 'tm-node-lambda', target: 'tm-node-rds', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'edge-10', label: 'Database Queries', commentary: 'Connection string with credentials embedded in config' },
        { id: 'tm-edge-web-s3', source: 'tm-node-web', target: 'tm-node-s3', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'edge-11', label: 'Data Storage' },
        { id: 'tm-edge-kms-rds', source: 'tm-node-kms', target: 'tm-node-rds', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'edge-13', label: 'Encryption Key Access', commentary: 'Broad key policy allows any service to decrypt' },
      ],
      attackPathDescription: 'Two primary attack paths: (1) External attacker exploits weak TLS to intercept credentials, pivots through privileged containers to reach database; (2) Compromised Lambda function leverages wildcard IAM role to exfiltrate S3 data lake contents.',
      attackPaths: [
        {
          id: 'aap-tls-container-db',
          name: 'Weak TLS → Privileged Container → Database Compromise',
          strideCategory: 'Information Disclosure' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'Attacker downgrades TLS on ALB connection, intercepts session tokens, escalates through privileged ECS container, and reaches RDS database using hardcoded connection strings.',
          diagramAttackPathId: 'ap-tls-container-escape',
          steps: [
            { order: 1, edgeId: 'edge-1', sourceNodeId: 'external-users', targetNodeId: 'load-balancer', technique: 'T1557: Adversary-in-the-Middle' },
            { order: 2, edgeId: 'edge-2', sourceNodeId: 'load-balancer', targetNodeId: 'web-app-cluster', technique: 'T1078: Valid Accounts' },
            { order: 3, edgeId: 'edge-6', sourceNodeId: 'web-app-cluster', targetNodeId: 'lambda-functions', technique: 'T1611: Escape to Host' },
            { order: 4, edgeId: 'edge-10', sourceNodeId: 'lambda-functions', targetNodeId: 'primary-database', technique: 'T1005: Data from Local System' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
        {
          id: 'aap-lambda-s3-exfil',
          name: 'Lambda Wildcard Role → S3 Data Lake Exfiltration',
          strideCategory: 'Information Disclosure' as StrideCategory,
          riskLevel: 'High' as AttackPathRiskLevel,
          description: 'Attacker exploits overprivileged Lambda execution role to access S3 data lake buckets containing sensitive backup and analytics data.',
          diagramAttackPathId: 'ap-lambda-s3-exfil',
          steps: [
            { order: 1, edgeId: 'edge-3', sourceNodeId: 'api-gateway', targetNodeId: 'lambda-functions', technique: 'T1190: Exploit Public-Facing Application' },
            { order: 2, edgeId: 'edge-8', sourceNodeId: 'lambda-functions', targetNodeId: 'message-queue', technique: 'T1078: Valid Accounts (Lambda role)' },
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
    justification: 'IAM roles for Lambda and ECS use wildcard permissions. Cognito federation trusts all Azure AD tenants without audience restriction.',
    mitigatesRiskIds: ['risk-lambda-overprivilege', 'risk-identity-federation'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-a02', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A02', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'ALB permits TLS 1.0/1.1. KMS key policies allow broad cross-service decryption. Database connection strings hardcoded in app config.',
    mitigatesRiskIds: ['risk-weak-tls', 'risk-kms-crossaccess', 'risk-hardcoded-connstrings'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-a04', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A04', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'planned' as const,
    justification: 'Architecture review pending for privileged container access and cross-cloud identity trust boundaries.',
    mitigatesRiskIds: ['risk-privileged-containers', 'risk-identity-federation'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-a05', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A05', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Multiple misconfigurations: privileged containers in production, broad KMS key policies, Terraform state exposing secrets, and suppressed Security Hub findings.',
    mitigatesRiskIds: ['risk-privileged-containers', 'risk-kms-crossaccess', 'risk-terraform-state', 'risk-suppressed-findings'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-a07', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A07', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Cognito MFA enabled. However, federation audience restriction missing and service account credential rotation not enforced.',
    mitigatesRiskIds: ['risk-identity-federation', 'risk-hardcoded-connstrings'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-a09', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A09', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'implemented' as const,
    justification: 'CloudWatch and CloudTrail deployed with cross-region replication. However, Security Hub findings are suppressed reducing SOC visibility.',
    mitigatesRiskIds: ['risk-suppressed-findings'],
    diagramRefs: [],
    evidence: [
      { id: 'evidence-a09-cloudtrail', kind: 'link' as const, name: 'CloudTrail Configuration Export', url: 'https://security.example.internal/reports/cloudtrail-config', note: 'Multi-region trail configuration', createdAt: NOW }
    ],
    updatedAt: NOW
  },
  {
    id: 'soa-cis-03', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.03', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'S3 encryption enabled via KMS. RDS encryption at rest active. However, cross-service key access and hardcoded connection strings create data protection gaps.',
    mitigatesRiskIds: ['risk-kms-crossaccess', 'risk-hardcoded-connstrings'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-cis-04', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.04', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'TLS 1.0/1.1 allowed on ALB, privileged containers in ECS, and broad IAM wildcard policies indicate insufficient secure configuration.',
    mitigatesRiskIds: ['risk-weak-tls', 'risk-privileged-containers', 'risk-lambda-overprivilege'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-cis-06', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.06', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'IAM roles defined per service but Lambda and ECS use wildcarded resource permissions. Federation trust scope is overly broad.',
    mitigatesRiskIds: ['risk-lambda-overprivilege', 'risk-identity-federation'],
    diagramRefs: [],
    evidence: [
      { id: 'evidence-cis06-iam', kind: 'link' as const, name: 'IAM Policy Audit Report', url: 'https://security.example.internal/reports/iam-audit-2025-q2', note: 'Quarterly IAM access review', createdAt: NOW }
    ],
    updatedAt: NOW
  },
  {
    id: 'soa-cis-08', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.08', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'implemented' as const,
    justification: 'CloudTrail with log file integrity validation and cross-region replication. CloudWatch log groups with 90-day retention.',
    mitigatesRiskIds: ['risk-suppressed-findings'],
    diagramRefs: [],
    evidence: [
      { id: 'evidence-cis08-logs', kind: 'link' as const, name: 'Log Retention Policy', url: 'https://security.example.internal/docs/log-retention', note: 'CloudWatch and CloudTrail retention settings', createdAt: NOW }
    ],
    updatedAt: NOW
  },
];

const workflowTasks = [
  {
    id: 'task-tls-enforcement',
    title: 'Enforce TLS 1.2 minimum on ALB listeners',
    description: 'Update ALB security policy to TLS 1.2 minimum and remove legacy cipher suites.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'critical' as const,
    owner: 'Platform Engineering',
    dueDate: '2025-06-15',
    riskId: 'risk-weak-tls',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'task-secrets-migration',
    title: 'Migrate hardcoded credentials to AWS Secrets Manager',
    description: 'Replace all hardcoded database connection strings with Secrets Manager references and enable automatic rotation.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'critical' as const,
    owner: 'Development',
    dueDate: '2025-06-30',
    riskId: 'risk-hardcoded-connstrings',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'task-container-hardening',
    title: 'Remove privileged flag from ECS Fargate task definitions',
    description: 'Update all ECS task definitions to run with non-privileged security context and read-only root filesystem.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Development',
    dueDate: '2025-06-20',
    riskId: 'risk-privileged-containers',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'task-lambda-iam-scoping',
    title: 'Scope Lambda execution roles to specific resource ARNs',
    description: 'Replace wildcard IAM permissions on Lambda roles with resource-specific ARNs and condition keys.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Development',
    dueDate: '2025-07-01',
    riskId: 'risk-lambda-overprivilege',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'task-federation-audit',
    title: 'Restrict Cognito federation to specific Azure AD tenant',
    description: 'Configure audience claim restriction on Cognito SAML identity provider to prevent cross-tenant token replay.',
    type: 'control_implementation' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Identity & Access Management',
    dueDate: '2025-06-25',
    riskId: 'risk-identity-federation',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'task-sechub-review',
    title: 'Review and restore suppressed Security Hub findings',
    description: 'Audit all suppressed findings, remove blanket suppressions, and implement targeted exception rules with documented justification.',
    type: 'review' as const,
    status: 'todo' as const,
    priority: 'medium' as const,
    owner: 'Security Operations',
    dueDate: '2025-07-15',
    riskId: 'risk-suppressed-findings',
    createdAt: NOW, updatedAt: NOW
  },
];

const threatActors = [
  {
    id: 'threat-actor-apt', name: 'Cloud-Focused APT Group',
    type: 'nation_state' as const, capabilityLevel: 5,
    resourceLevel: 'very_high' as const,
    motivation: 'Espionage and intellectual property theft targeting cloud infrastructure weaknesses including identity federation and overprivileged service roles.',
    description: 'Sophisticated threat actor specializing in cloud environment exploitation. Known to abuse misconfigured IAM roles, weak TLS, and cross-cloud trust relationships to establish persistent access.',
    targetedAssetIds: ['asset-cognito', 'asset-lambda', 'asset-rds', 'asset-web-cluster'],
    tags: ['apt', 'cloud-native', 'identity-abuse', 'persistent'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'threat-actor-insider', name: 'Malicious DevOps Insider',
    type: 'insider' as const, capabilityLevel: 4,
    resourceLevel: 'moderate' as const,
    motivation: 'Financial gain or competitive advantage through exfiltration of customer data and infrastructure secrets from Terraform state and application configs.',
    description: 'Current or departing DevOps engineer with access to Terraform Cloud workspace, container registries, and deployment pipelines. Familiar with infrastructure secrets and access patterns.',
    targetedAssetIds: ['asset-terraform', 'asset-rds', 'asset-kms', 'asset-s3-datalake'],
    tags: ['insider-threat', 'devops-access', 'secrets-exposure'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'threat-actor-cloud-criminal', name: 'Cloud Crypto-Mining Syndicate',
    type: 'organised_crime' as const, capabilityLevel: 3,
    resourceLevel: 'moderate' as const,
    motivation: 'Unauthorized compute resource consumption for cryptocurrency mining by exploiting overprivileged Lambda and ECS roles.',
    description: 'Financially motivated group that exploits misconfigured cloud environments to deploy crypto miners. Targets overprivileged IAM roles and public-facing serverless functions.',
    targetedAssetIds: ['asset-lambda', 'asset-web-cluster'],
    tags: ['financially-motivated', 'resource-abuse', 'crypto-mining'],
    createdAt: NOW, updatedAt: NOW
  },
];

const threatScenarios = [
  {
    id: 'scenario-tls-downgrade', title: 'TLS Downgrade Attack on ALB Traffic',
    description: 'APT group exploits legacy TLS 1.0/1.1 support on the Application Load Balancer to perform a protocol downgrade attack, intercepting session tokens and API credentials from user traffic.',
    threatActorId: 'threat-actor-apt',
    targetedAssetIds: ['asset-alb', 'asset-cognito'],
    attackTechniques: ['T1557 - Adversary-in-the-Middle', 'T1040 - Network Sniffing', 'T1550 - Use Alternate Authentication Material'],
    linkedRiskIds: ['risk-weak-tls'],
    likelihood: 'Moderate - requires network positioning but TLS 1.0/1.1 vulnerabilities are well-documented.',
    impact: 'Major - session hijacking enables access to authenticated user sessions and API endpoints.',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scenario-container-escape', title: 'Container Escape via Privileged ECS Task',
    description: 'Attacker exploits web application vulnerability to gain shell access within a privileged ECS container, escapes to the underlying host, and pivots to other containers or AWS services using the task IAM role.',
    threatActorId: 'threat-actor-apt',
    targetedAssetIds: ['asset-web-cluster', 'asset-rds'],
    attackTechniques: ['T1190 - Exploit Public-Facing Application', 'T1611 - Escape to Host', 'T1552 - Unsecured Credentials'],
    linkedRiskIds: ['risk-privileged-containers', 'risk-hardcoded-connstrings'],
    likelihood: 'High - privileged containers combined with hardcoded credentials create a direct exploitation path.',
    impact: 'Critical - full host compromise with access to database credentials and lateral movement capability.',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scenario-insider-terraform', title: 'Insider Exfiltration via Terraform State Secrets',
    description: 'Malicious DevOps insider accesses Terraform Cloud state files containing database credentials, KMS ARNs, and API keys, using them to directly access production data stores.',
    threatActorId: 'threat-actor-insider',
    targetedAssetIds: ['asset-terraform', 'asset-rds', 'asset-kms'],
    attackTechniques: ['T1552.001 - Credentials In Files', 'T1078 - Valid Accounts', 'T1530 - Data from Cloud Storage Object'],
    linkedRiskIds: ['risk-terraform-state', 'risk-hardcoded-connstrings'],
    likelihood: 'High - all workspace members can view state; no additional authorization required.',
    impact: 'Critical - direct access to production database and encryption keys bypassing all application-layer controls.',
    createdAt: NOW, updatedAt: NOW
  },
];

export const vulnerableCloudGrcWorkspace = buildGrcWorkspace({
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
      id: 'vc-si-iam-hardening', title: 'IAM & Identity Federation Hardening',
      description: 'Remediate overprivileged IAM roles, restrict cross-cloud identity federation trust boundaries, and migrate hardcoded credentials to Secrets Manager with automated rotation.',
      category: 'remediation' as const, status: 'in_progress' as const, priority: 'critical' as const,
      owner: 'Identity & Access Management', executiveSponsor: 'CISO',
      currentState: 'Lambda execution roles use wildcard permissions; Cognito federation trusts all Azure AD tenants without audience restriction; database connection strings hardcoded in application config.',
      targetState: 'All IAM roles scoped to specific resource ARNs with condition keys; Cognito federation restricted to specific Azure AD tenant IDs with audience claim validation; credentials in Secrets Manager with automatic rotation.',
      startDate: '2025-03-01', targetDate: '2026-06-30', completedDate: '',
      milestones: [
        { id: 'vc-ms-iam-01', title: 'Scope Lambda execution roles to specific resource ARNs', description: 'Replace wildcard IAM policies on Lambda functions with resource-scoped permissions and condition keys for S3, DynamoDB, and Secrets Manager.', status: 'completed' as const, dueDate: '2025-09-30', completedDate: '2025-09-20', owner: 'Development' },
        { id: 'vc-ms-iam-02', title: 'Restrict Cognito federation to specific Azure AD tenants', description: 'Configure Cognito identity pool to accept tokens only from authorized Azure AD tenant IDs and enforce audience claim validation.', status: 'in_progress' as const, dueDate: '2026-03-31', completedDate: '', owner: 'Identity & Access Management' },
        { id: 'vc-ms-iam-03', title: 'Migrate hardcoded credentials to Secrets Manager', description: 'Replace hardcoded RDS connection strings in application config with AWS Secrets Manager references and enable automatic rotation.', status: 'pending' as const, dueDate: '2026-06-30', completedDate: '', owner: 'Development' },
      ],
      linkedRiskIds: ['risk-lambda-overprivilege', 'risk-identity-federation', 'risk-hardcoded-connstrings'],
      linkedControlSetIds: [],
      linkedAssetIds: ['asset-lambda', 'asset-cognito', 'asset-rds'],
      linkedImplementedControlIds: ['vc-ic-cspm'],
      linkedAssessmentIds: ['assessment-cloud-security'],
      notes: 'Lambda role scoping complete for 85% of functions. Remaining 15% require application code changes for narrower permissions.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'vc-si-cloud-network', title: 'Cloud Network Security & Encryption Uplift',
      description: 'Enforce TLS 1.2+ across all load balancers, implement per-service KMS key policies, remove privileged container configurations, and address suppressed Security Hub findings.',
      category: 'compliance' as const, status: 'approved' as const, priority: 'high' as const,
      owner: 'Platform Engineering', executiveSponsor: 'VP Infrastructure',
      currentState: 'ALB allows TLS 1.0/1.1; KMS key policies grant broad cross-service access; ECS containers run privileged; Security Hub findings suppressed for 47 resources.',
      targetState: 'TLS 1.2+ enforced on all listeners; per-service KMS keys with resource-level conditions; ECS tasks run with read-only root filesystem and minimal capabilities; all Security Hub findings triaged within 48 hours.',
      startDate: '2025-06-01', targetDate: '2026-09-30', completedDate: '',
      milestones: [
        { id: 'vc-ms-net-01', title: 'Enforce TLS 1.2 minimum on ALB listener policies', description: 'Update ALB security policies to TLS 1.2+ minimum, deprecate legacy cipher suites, and verify client compatibility.', status: 'in_progress' as const, dueDate: '2026-03-31', completedDate: '', owner: 'Platform Engineering' },
        { id: 'vc-ms-net-02', title: 'Implement per-service KMS key policies', description: 'Create dedicated KMS keys for RDS, S3, and Redshift with resource-level condition keys restricting cross-service access.', status: 'pending' as const, dueDate: '2026-09-30', completedDate: '', owner: 'Security Operations' },
      ],
      linkedRiskIds: ['risk-weak-tls', 'risk-kms-crossaccess', 'risk-privileged-containers', 'risk-suppressed-findings'],
      linkedControlSetIds: [],
      linkedAssetIds: ['asset-alb', 'asset-kms', 'asset-web-cluster'],
      linkedImplementedControlIds: ['vc-ic-guardduty'],
      linkedAssessmentIds: ['assessment-cloud-security'],
      notes: 'TLS 1.0/1.1 deprecation requires 90-day notice to legacy API consumers. KMS key migration requires coordinated data re-encryption.',
      createdAt: NOW, updatedAt: NOW,
    },
  ],
  implementedControls: [
    {
      id: 'vc-ic-cspm', title: 'Cloud Security Posture Management (Lacework)',
      description: 'Lacework CSPM platform providing continuous configuration compliance monitoring, IAM anomaly detection, and workload protection across AWS accounts with Polygraph behavioral analytics.',
      controlType: 'technical' as const, category: 'monitoring' as const,
      status: 'active' as const, automationLevel: 'fully_automated' as const,
      owner: 'Security Operations', vendor: 'Lacework', product: 'Enterprise', version: '2024',
      implementedDate: '2024-01-15', lastReviewDate: '2025-05-01', nextReviewDate: '2026-05-01',
      linkedSoaEntryIds: ['soa-a05', 'soa-cis-04'],
      linkedRiskIds: ['risk-privileged-containers', 'risk-lambda-overprivilege', 'risk-suppressed-findings'],
      linkedAssetIds: ['asset-web-cluster', 'asset-lambda', 'asset-s3-datalake'],
      linkedAssessmentIds: ['assessment-cloud-security'],
      notes: 'Cross-account IAM role with ReadOnlyAccess. Alert fatigue has delayed remediation of identified issues.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'vc-ic-guardduty', title: 'AWS GuardDuty Threat Detection',
      description: 'AWS GuardDuty enabled across all accounts with EKS, S3, and Lambda protection providing automated threat detection, anomaly identification, and integration with Security Hub for centralized findings.',
      controlType: 'technical' as const, category: 'monitoring' as const,
      status: 'active' as const, automationLevel: 'fully_automated' as const,
      owner: 'Security Operations', vendor: 'AWS', product: 'GuardDuty', version: '2024',
      implementedDate: '2023-06-01', lastReviewDate: '2025-04-15', nextReviewDate: '2026-04-15',
      linkedSoaEntryIds: ['soa-a09', 'soa-cis-08'],
      linkedRiskIds: ['risk-suppressed-findings', 'risk-privileged-containers'],
      linkedAssetIds: ['asset-web-cluster', 'asset-lambda', 'asset-s3-datalake'],
      linkedAssessmentIds: ['assessment-cloud-security'],
      notes: 'Multi-account deployment via AWS Organizations. Findings auto-forwarded to Security Hub and Lacework.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'vc-ic-iac-policy', title: 'Terraform Sentinel Policy Enforcement',
      description: 'HashiCorp Sentinel policy-as-code framework enforcing security guardrails on all Terraform Cloud workspaces including resource tagging, encryption requirements, and network access restrictions.',
      controlType: 'technical' as const, category: 'policy' as const,
      status: 'active' as const, automationLevel: 'fully_automated' as const,
      owner: 'DevOps Engineering', vendor: 'HashiCorp', product: 'Terraform Cloud Sentinel', version: '0.24',
      implementedDate: '2024-03-01', lastReviewDate: '2025-06-01', nextReviewDate: '2026-06-01',
      linkedSoaEntryIds: ['soa-a04', 'soa-cis-06'],
      linkedRiskIds: ['risk-terraform-state', 'risk-kms-crossaccess'],
      linkedAssetIds: ['asset-terraform', 'asset-kms'],
      linkedAssessmentIds: ['assessment-cloud-security'],
      notes: 'Sentinel policies do not yet block hardcoded secrets in HCL. Service account tokens are long-lived — rotation policy pending.',
      createdAt: NOW, updatedAt: NOW,
    },
  ],
  thirdParties: [
    {
      id: 'vc-tp-aws',
      name: 'Amazon Web Services (AWS)',
      description: 'Primary cloud infrastructure provider hosting ALB, ECS clusters, Lambda functions, RDS databases, S3 data lake, KMS, and Cognito identity services. Operates under shared responsibility model across IaaS and PaaS services.',
      category: 'cloud_provider' as const,
      status: 'active' as const,
      riskRating: 'critical' as const,
      dataClassification: 'restricted' as const,
      linkedAssetIds: ['asset-alb', 'asset-web-cluster', 'asset-lambda', 'asset-rds', 'asset-s3-datalake', 'asset-kms', 'asset-cognito'],
      linkedRiskIds: ['risk-weak-tls', 'risk-privileged-containers', 'risk-kms-crossaccess', 'risk-lambda-overprivilege'],
      contactName: 'AWS Enterprise Support',
      contactEmail: 'enterprise-tam@aws.example.com',
      contractExpiry: '2027-12-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-12-31',
      notes: 'Enterprise Support with designated TAM. SOC 2 Type II, ISO 27001, FedRAMP High certified. Shared responsibility gaps identified: ALB configured with TLS 1.0/1.1, ECS containers running as root, Lambda functions with overprivileged IAM roles, KMS key policies allowing cross-account access. Security Hub findings suppressed for 47 resources. Consolidated billing across 12 accounts.'
    },
    {
      id: 'vc-tp-hashicorp',
      name: 'HashiCorp',
      description: 'SaaS infrastructure-as-code platform (Terraform Cloud) managing all AWS resource provisioning, state management, and drift detection for the multi-cloud environment.',
      category: 'saas' as const,
      status: 'active' as const,
      riskRating: 'high' as const,
      dataClassification: 'confidential' as const,
      linkedAssetIds: ['asset-terraform'],
      linkedRiskIds: ['risk-terraform-state', 'risk-hardcoded-connstrings'],
      contactName: 'Kevin Park',
      contactEmail: 'kevin.park@hashicorp.example.com',
      contractExpiry: '2027-01-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-07-31',
      notes: 'Terraform Cloud Business tier with Sentinel policy enforcement. State files contain sensitive outputs including RDS connection strings and KMS key ARNs. Remote state stored unencrypted in Terraform Cloud backend. Sentinel policies do not yet block hardcoded secrets in HCL. Workspace-level RBAC configured but service account tokens are long-lived. SOC 2 Type II certified.'
    },
    {
      id: 'vc-tp-lacework',
      name: 'Lacework',
      description: 'SaaS cloud security platform providing cloud workload protection, configuration compliance, and anomaly detection across the AWS environment using agentless and agent-based monitoring.',
      category: 'saas' as const,
      status: 'active' as const,
      riskRating: 'medium' as const,
      dataClassification: 'internal' as const,
      linkedAssetIds: ['asset-web-cluster', 'asset-lambda', 'asset-s3-datalake'],
      linkedRiskIds: ['risk-privileged-containers', 'risk-suppressed-findings', 'risk-lambda-overprivilege'],
      contactName: 'Priya Sharma',
      contactEmail: 'priya.sharma@lacework.example.com',
      contractExpiry: '2026-10-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-07-15',
      notes: 'Lacework Enterprise with Polygraph behavioral analytics. Cross-account IAM role with ReadOnlyAccess plus CloudTrail and VPC Flow Log ingestion. Has identified privileged container configurations and overprivileged Lambda roles but alert fatigue has delayed remediation. Suppressed findings in Security Hub not correlated with Lacework alerts. No production data access — metadata and configuration only.'
    },
    {
      id: 'vc-tp-letsencrypt',
      name: "Let's Encrypt (ISRG)",
      description: 'Non-profit certificate authority providing automated TLS certificates for ALB and web services via ACME protocol. Free, automated certificate issuance and renewal.',
      category: 'supplier' as const,
      status: 'active' as const,
      riskRating: 'medium' as const,
      dataClassification: 'public' as const,
      linkedAssetIds: ['asset-alb'],
      linkedRiskIds: ['risk-weak-tls', 'risk-identity-federation'],
      contactName: 'ISRG Operations',
      contactEmail: 'certificates@letsencrypt.example.com',
      contractExpiry: '2027-06-30',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-06-30',
      notes: 'Free DV certificates with 90-day validity and automated ACME renewal via certbot. ALB currently configured to accept TLS 1.0/1.1 despite certificates supporting modern cipher suites — weak TLS configuration is an application-side issue, not a CA issue. No EV or OV validation available. Certificate transparency logs publicly indexed. ISRG operates under WebTrust audit. Revocation via OCSP stapling configured on ALB.'
    },
  ],
});

export const vulnerableCloud: ExampleSystem = {
  id: 'vulnerable-cloud',
  name: 'Enterprise Multi-Cloud Platform',
  description: 'Modern multi-cloud architecture with edge computing, hybrid connectivity, and comprehensive security zones',
  category: 'Cloud Infrastructure',
  // securityLevel removed - no longer part of the system model
  primaryZone: 'Cloud',
  dataClassification: 'Sensitive',
  grcWorkspace: vulnerableCloudGrcWorkspace,
  nodes: [
    // Multi-Tier Zone Architecture
    // Top Tier: Edge=600px x=50, Management=750px x=770, Hybrid=600px x=1640 (y=50, h=300)
    // Main Tier: Internet=600px x=50, DMZ=600px x=770, Cloud=800px x=1490, Restricted=900px x=2410 (y=400, h=800)
    // Bottom Tier: MultiCloud=750px x=770 (y=1250, h=300)
    {
      id: 'edge-zone',
      type: 'securityZone',
      position: { x: 50, y: 50 },
      data: {
        label: 'Edge Zone',
        zoneType: 'Edge' as SecurityZone,
        description: 'Edge computing and CDN services',
        zone: 'DMZ' as SecurityZone
      },
      style: {
        width: 600,
        height: 300,
        background: colors.zoneBackgrounds.Edge,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'management-zone',
      type: 'securityZone',
      position: { x: 770, y: 50 },
      data: {
        label: 'Management Zone',
        zoneType: 'Management' as SecurityZone,
        description: 'Cloud management and monitoring services'
      },
      style: {
        width: 750,
        height: 300,
        background: colors.zoneBackgrounds.Management,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'hybrid-zone',
      type: 'securityZone',
      position: { x: 1640, y: 50 },
      data: {
        label: 'Hybrid Zone',
        zoneType: 'Hybrid' as SecurityZone,
        description: 'Hybrid cloud connectivity and integration'
      },
      style: {
        width: 600,
        height: 300,
        background: colors.zoneBackgrounds.Hybrid,
        zIndex: -1
      }
    } as SecurityNode,

    // Main Tier: Core Cloud Services (y=400, h=800)
    {
      id: 'internet-zone',
      type: 'securityZone',
      position: { x: 50, y: 400 },
      data: {
        label: 'Internet Zone',
        zoneType: 'Internet' as SecurityZone,
        description: 'External user access and public services'
      },
      style: {
        width: 600,
        height: 800,
        background: colors.zoneBackgrounds.Internet,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'dmz-zone',
      type: 'securityZone',
      position: { x: 770, y: 400 },
      data: {
        label: 'DMZ Zone',
        zoneType: 'DMZ' as SecurityZone,
        description: 'Public-facing cloud services and load balancers'
      },
      style: {
        width: 600,
        height: 800,
        background: colors.zoneBackgrounds.DMZ,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'cloud-zone',
      type: 'securityZone',
      position: { x: 1490, y: 400 },
      data: {
        label: 'Cloud Zone',
        zoneType: 'Cloud' as SecurityZone,
        description: 'Primary cloud application services'
      },
      style: {
        width: 800,
        height: 800,
        background: colors.zoneBackgrounds.Cloud,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'restricted-zone',
      type: 'securityZone',
      position: { x: 2410, y: 400 },
      data: {
        label: 'Restricted Zone',
        zoneType: 'Restricted' as SecurityZone,
        description: 'Sensitive data storage and security services'
      },
      style: {
        width: 900,
        height: 800,
        background: colors.zoneBackgrounds.Restricted,
        zIndex: -1
      }
    } as SecurityNode,

    // Bottom Tier: Multi-Cloud Integration (y=1250, h=300)
    {
      id: 'multicloud-zone',
      type: 'securityZone',
      position: { x: 770, y: 1250 },
      data: {
        label: 'Multi-Cloud Zone',
        zoneType: 'MultiCloud' as SecurityZone,
        description: 'Multi-cloud integration and orchestration'
      },
      style: {
        width: 750,
        height: 300,
        background: colors.zoneBackgrounds.MultiCloud,
        zIndex: -1
      }
    } as SecurityNode,

    // Edge Zone Components (zone old x=50, new x=50, delta=0)
    {
      id: 'edge-cdn',
      type: 'server',
      position: { x: 125, y: 125 },
      data: {
        label: 'CloudFlare CDN',
        description: 'Global content delivery network with edge caching',
        vendor: 'cloudflare',
        product: 'cdn',
        version: '2024.1',
        protocols: ['HTTP', 'HTTPS', 'HTTP/3'],
        securityControls: ['DDoS Protection', 'WAF', 'Bot Management'],
        accessControl: 'API Keys',
        zone: 'Edge' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public'
      }
    } as SecurityNode,
    {
      id: 'edge-compute',
      type: 'server',
      position: { x: 325, y: 225 },
      data: {
        label: 'AWS Lambda@Edge',
        description: 'Serverless edge computing for request processing',
        vendor: 'amazon',
        product: 'lambda edge',
        version: '2024.2',
        protocols: ['HTTPS', 'HTTP/2'],
        securityControls: ['IAM Execution Roles', 'VPC Endpoints'],
        accessControl: 'IAM Policies',
        zone: 'Edge' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'edge-waf',
      type: 'firewall',
      position: { x: 475, y: 125 },
      data: {
        label: 'Edge WAF',
        description: 'Web Application Firewall at edge locations',
        vendor: 'cloudflare',
        product: 'waf',
        version: '3.0',
        protocols: ['HTTP', 'HTTPS'],
        securityControls: ['OWASP Rules', 'Rate Limiting', 'Geo-blocking'],
        accessControl: 'Dashboard Access',
        zone: 'Edge' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,

    // Management Zone Components (zone old x=850, new x=770, delta=-80)
    {
      id: 'cloud-console',
      type: 'workstation',
      position: { x: 1425, y: 175 },
      data: {
        label: 'AWS Management Console',
        description: 'Web-based cloud management interface',
        vendor: 'amazon',
        product: 'aws console',
        version: '2024.1',
        protocols: ['HTTPS'],
        securityControls: ['MFA', 'SSO', 'Session Timeout'],
        accessControl: 'IAM Users and Roles',
        zone: 'Management' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'monitoring-dashboard',
      type: 'server',
      position: { x: 825, y: 175 },
      data: {
        label: 'CloudWatch Dashboard',
        description: 'Centralized monitoring and alerting platform',
        vendor: 'amazon',
        product: 'cloudwatch',
        version: '2024.1',
        protocols: ['HTTPS', 'SNS'],
        securityControls: ['IAM Policies', 'VPC Endpoints'],
        accessControl: 'IAM Roles',
        zone: 'Management' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'security-center',
      type: 'server',
      position: { x: 1175, y: 275 },
      data: {
        label: 'AWS Security Hub 2',
        description: 'Centralized security findings and compliance dashboard',
        vendor: 'amazon',
        product: 'security hub',
        version: '2024.1',
        protocols: ['HTTPS', 'API'],
        securityControls: ['Config Rules', 'GuardDuty', 'Inspector'],
        accessControl: 'IAM Policies',
        zone: 'Management' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      }
    } as SecurityNode,
    {
      id: 'cost-management',
      type: 'server',
      position: { x: 1325, y: 75 },
      data: {
        label: 'AWS Cost Explorer',
        description: 'Cloud cost analysis and optimization platform',
        vendor: 'amazon',
        product: 'cost explorer',
        version: '2024.1',
        protocols: ['HTTPS'],
        securityControls: ['IAM Policies', 'Budget Alerts'],
        accessControl: 'Billing Permissions',
        zone: 'Management' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,

    // Hybrid Zone Components (zone old x=2420, new x=1640, delta=-780)
    {
      id: 'vpn-gateway',
      type: 'server',
      position: { x: 2075, y: 75 },
      data: {
        label: 'AWS VPN Gateway',
        description: 'Site-to-site VPN for hybrid connectivity',
        vendor: 'amazon',
        product: 'vpn gateway',
        version: '2024.1',
        protocols: ['IPSec', 'BGP'],
        securityControls: ['Pre-shared Keys', 'Certificate Auth'],
        accessControl: 'VPC Route Tables',
        zone: 'Hybrid' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive'
      }
    } as SecurityNode,
    {
      id: 'direct-connect',
      type: 'server',
      position: { x: 1925, y: 225 },
      data: {
        label: 'AWS Direct Connect',
        description: 'Dedicated network connection to on-premises',
        vendor: 'amazon',
        product: 'direct connect',
        version: '2024.1',
        protocols: ['BGP', 'VLAN'],
        securityControls: ['Dedicated Circuits', 'MACsec Encryption'],
        accessControl: 'Virtual Interfaces',
        zone: 'Hybrid' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      }
    } as SecurityNode,
    {
      id: 'hybrid-dns',
      type: 'server',
      position: { x: 1675, y: 125 },
      data: {
        label: 'Route 53 Resolver',
        description: 'Hybrid DNS resolution between cloud and on-premises',
        vendor: 'amazon',
        product: 'route53 resolver',
        version: '2024.1',
        protocols: ['DNS', 'DNS over HTTPS'],
        securityControls: ['Query Logging', 'DNS Filtering'],
        accessControl: 'IAM Policies',
        zone: 'Hybrid' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,

    // Internet Zone - User Access (zone old x=50, new x=50, delta=0)
    {
      id: 'external-users',
      type: 'workstation',
      position: { x: 425, y: 625 },
      data: {
        label: 'External Users',
        description: 'End users accessing the cloud application',
        vendor: 'various',
        product: 'web browsers',
        protocols: ['HTTPS'],
        securityControls: ['Client Certificates', 'Browser Security'],
        accessControl: 'User Authentication',
        zone: 'Internet' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public'
      }
    } as SecurityNode,

    // DMZ Zone Components (zone old x=850, new x=770, delta=-80)
    {
      id: 'load-balancer',
      type: 'loadBalancer',
      position: { x: 1025, y: 525 },
      data: {
        label: 'Application Load Balancer',
        description: 'AWS Application Load Balancer for web traffic distribution',
        vendor: 'amazon',
        product: 'application load balancer',
        version: '2.0',
        protocols: ['HTTP', 'HTTPS'],
        securityControls: ['SSL Termination', 'WAF'],
        accessControl: 'Security Groups',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public'
      }
    } as SecurityNode,
    {
      id: 'api-gateway',
      type: 'apiGateway',
      position: { x: 825, y: 675 },
      data: {
        label: 'API Gateway',
        description: 'AWS API Gateway for REST API management',
        vendor: 'amazon',
        product: 'api gateway',
        version: '2.0',
        protocols: ['HTTPS', 'WebSocket'],
        securityControls: ['API Keys', 'Throttling', 'CORS'],
        accessControl: 'IAM Policies',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'waf',
      type: 'firewall',
      position: { x: 1125, y: 775 },
      data: {
        label: 'Web Application Firewall',
        description: 'AWS WAF for application layer protection',
        vendor: 'amazon',
        product: 'waf',
        version: '2.0',
        protocols: ['HTTP', 'HTTPS'],
        securityControls: ['SQL Injection Protection', 'XSS Protection', 'Rate Limiting'],
        accessControl: 'Rule Groups',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,

    // Cloud Zone - Application Services (zone old x=1650, new x=1490, delta=-160)
    {
      id: 'web-app-cluster',
      type: 'server',
      position: { x: 1575, y: 525 },
      data: {
        label: 'Web Application Cluster',
        description: 'AWS ECS Fargate containers running Node.js application',
        vendor: 'amazon',
        product: 'ecs fargate',
        version: '1.4.0',
        protocols: ['HTTP', 'HTTPS'],
        securityControls: ['Container Security', 'Task Roles'],
        accessControl: 'IAM Task Roles',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'lambda-functions',
      type: 'functionApp',
      position: { x: 1875, y: 675 },
      data: {
        label: 'Lambda Functions',
        description: 'AWS Lambda serverless functions for API processing',
        vendor: 'amazon',
        product: 'lambda',
        version: 'Python 3.11',
        protocols: ['HTTPS'],
        securityControls: ['Execution Roles', 'VPC Configuration'],
        accessControl: 'IAM Execution Roles',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'auth-service',
      type: 'authServer',
      position: { x: 1775, y: 875 },
      data: {
        label: 'Cognito User Pool',
        description: 'AWS Cognito for user authentication and authorization',
        vendor: 'amazon',
        product: 'cognito',
        version: '2024.1',
        protocols: ['HTTPS', 'OAuth 2.0', 'SAML'],
        securityControls: ['MFA', 'Password Policies', 'JWT Tokens'],
        accessControl: 'User Pool Policies',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      }
    } as SecurityNode,
    {
      id: 'cache-cluster',
      type: 'server',
      position: { x: 1575, y: 975 },
      data: {
        label: 'ElastiCache Redis',
        description: 'AWS ElastiCache Redis cluster for session storage',
        vendor: 'amazon',
        product: 'elasticache redis',
        version: '7.0',
        protocols: ['Redis Protocol'],
        securityControls: ['Encryption in Transit', 'Auth Tokens'],
        accessControl: 'Security Groups',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'message-queue',
      type: 'server',
      position: { x: 1875, y: 975 },
      data: {
        label: 'SQS Message Queue',
        description: 'AWS SQS for asynchronous message processing',
        vendor: 'amazon',
        product: 'sqs',
        version: '2024.1',
        protocols: ['HTTPS'],
        securityControls: ['Server-Side Encryption', 'Access Policies'],
        accessControl: 'IAM Policies',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'cloudwatch',
      type: 'monitor',
      position: { x: 1675, y: 1125 },
      data: {
        label: 'CloudWatch Monitoring',
        description: 'AWS CloudWatch for metrics, logs, and alerting',
        vendor: 'amazon',
        product: 'cloudwatch',
        version: '2024.1',
        protocols: ['HTTPS', 'CloudWatch API'],
        securityControls: ['Custom Metrics', 'Log Retention', 'Alarm Actions'],
        accessControl: 'IAM Policies',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,

    // Restricted Zone Components (zone old x=2450, new x=2410, delta=-40)
    {
      id: 'primary-database',
      type: 'cloudDatabase',
      position: { x: 2875, y: 575 },
      data: {
        label: 'RDS PostgreSQL',
        description: 'AWS RDS PostgreSQL primary database',
        vendor: 'amazon',
        product: 'rds postgresql',
        version: '15.4',
        protocols: ['PostgreSQL'],
        securityControls: ['Encryption at Rest', 'Encryption in Transit', 'Automated Backups'],
        accessControl: 'Database Authentication',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      }
    } as SecurityNode,
    {
      id: 'cloudtrail',
      type: 'monitor',
      position: { x: 2475, y: 675 },
      data: {
        label: 'CloudTrail Audit Logging',
        description: 'AWS CloudTrail for API call auditing and compliance',
        vendor: 'amazon',
        product: 'cloudtrail',
        version: '2024.1',
        protocols: ['HTTPS', 'S3 API'],
        securityControls: ['Log File Integrity', 'Cross-Region Replication', 'Event History'],
        accessControl: 'IAM Policies',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'data-warehouse',
      type: 'cloudDatabase',
      position: { x: 3175, y: 1075 },
      data: {
        label: 'Redshift Data Warehouse',
        description: 'AWS Redshift for analytics and reporting',
        vendor: 'amazon',
        product: 'redshift',
        version: '1.0.48410',
        protocols: ['PostgreSQL'],
        securityControls: ['Column-Level Security', 'Audit Logging'],
        accessControl: 'Database Users and Roles',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      }
    } as SecurityNode,
    {
      id: 'kms',
      type: 'server',
      position: { x: 2875, y: 875 },
      data: {
        label: 'Key Management Service',
        description: 'AWS KMS for encryption key management',
        vendor: 'amazon',
        product: 'kms',
        version: '2024.1',
        protocols: ['HTTPS'],
        securityControls: ['Hardware Security Modules', 'Key Rotation'],
        accessControl: 'Key Policies and IAM',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      }
    } as SecurityNode,
    {
      id: 'object-storage',
      type: 'storageAccount',
      position: { x: 2525, y: 875 },
      data: {
        label: 'S3 Data Lake',
        description: 'AWS S3 buckets for data lake and backups',
        vendor: 'amazon',
        product: 's3',
        version: '2024.1',
        protocols: ['HTTPS', 'S3 API'],
        securityControls: ['Server-Side Encryption', 'Bucket Policies', 'Versioning'],
        accessControl: 'IAM Policies and Bucket ACLs',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      }
    } as SecurityNode,
    {
      id: 'security-hub',
      type: 'monitor',
      position: { x: 2575, y: 475 },
      data: {
        label: 'AWS Security Hub',
        description: 'Centralized security findings and compliance dashboard',
        vendor: 'amazon',
        product: 'security hub',
        version: '2024.1',
        protocols: ['HTTPS'],
        securityControls: ['Security Standards', 'Finding Aggregation', 'Compliance Scoring'],
        accessControl: 'IAM Policies',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'admin-workstation',
      type: 'workstation',
      position: { x: 2925, y: 975 },
      data: {
        label: 'DevOps Workstation',
        description: 'Windows 11 workstation for cloud administration',
        vendor: 'microsoft',
        product: 'windows 11 pro',
        version: '22H2',
        protocols: ['HTTPS', 'SSH', 'RDP'],
        securityControls: ['BitLocker', 'Windows Defender', 'VPN Client'],
        accessControl: 'Domain Authentication',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,

    // Multi-Cloud Zone Components (zone old x=850, new x=770, delta=-80)
    {
      id: 'azure-ad-connector',
      type: 'authServer',
      position: { x: 825, y: 1425 },
      data: {
        label: 'Azure AD Connector',
        description: 'Microsoft Azure Active Directory integration for hybrid identity',
        vendor: 'microsoft',
        product: 'azure active directory',
        version: '2024.1',
        protocols: ['HTTPS', 'SAML', 'OAuth 2.0'],
        securityControls: ['Conditional Access', 'MFA', 'Identity Protection'],
        accessControl: 'Azure AD Policies',
        zone: 'MultiCloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      }
    } as SecurityNode,
    {
      id: 'gcp-bigquery',
      type: 'cloudDatabase',
      position: { x: 1125, y: 1575 },
      data: {
        label: 'Google BigQuery',
        description: 'Google Cloud BigQuery for multi-cloud analytics',
        vendor: 'google',
        product: 'bigquery',
        version: '2024.1',
        protocols: ['HTTPS', 'BigQuery API'],
        securityControls: ['Column-Level Security', 'Data Loss Prevention', 'Audit Logs'],
        accessControl: 'IAM and Dataset Permissions',
        zone: 'MultiCloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      }
    } as SecurityNode,
    {
      id: 'terraform-cloud',
      type: 'server',
      position: { x: 1125, y: 1325 },
      data: {
        label: 'Terraform Cloud',
        description: 'HashiCorp Terraform Cloud for infrastructure as code',
        vendor: 'hashicorp',
        product: 'terraform cloud',
        version: '2024.1',
        protocols: ['HTTPS', 'Terraform API'],
        securityControls: ['State Encryption', 'Policy as Code', 'Workspace Isolation'],
        accessControl: 'Team-based Access Control',
        zone: 'MultiCloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'datadog-monitoring',
      type: 'monitor',
      position: { x: 1425, y: 1475 },
      data: {
        label: 'Datadog APM',
        description: 'Datadog Application Performance Monitoring across clouds',
        vendor: 'datadog',
        product: 'datadog apm',
        version: '2024.1',
        protocols: ['HTTPS', 'StatsD'],
        securityControls: ['Data Encryption', 'RBAC', 'Audit Trails'],
        accessControl: 'Role-based Access Control',
        zone: 'MultiCloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode
  ],
  edges: [
    // Internet → DMZ
    {
      id: 'edge-1',
      source: 'external-users',
      target: 'load-balancer',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'User Requests',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        zone: 'Internet' as SecurityZone,
        vulnerabilities: ['Weak TLS configuration allows TLS 1.0/1.1']
      }
    } as SecurityEdge,

    // DMZ → Cloud flows
    {
      id: 'edge-2',
      source: 'load-balancer',
      target: 'web-app-cluster',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Load Balanced Traffic',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-3',
      source: 'api-gateway',
      target: 'lambda-functions',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'API Function Invocation',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-5',
      source: 'waf',
      target: 'auth-service',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Authentication Requests',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,

    // Cloud zone internal flows
    {
      id: 'edge-6',
      source: 'web-app-cluster',
      target: 'lambda-functions',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Service Integration',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-7',
      source: 'lambda-functions',
      target: 'cache-cluster',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Session Storage',
        protocol: 'Redis',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-8',
      source: 'lambda-functions',
      target: 'message-queue',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Async Processing',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-9',
      source: 'auth-service',
      target: 'cloudwatch',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Authentication Logs',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,

    // Cloud → Restricted flows
    {
      id: 'edge-10',
      source: 'lambda-functions',
      target: 'primary-database',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Database Queries',
        protocol: 'PostgreSQL',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-11',
      source: 'web-app-cluster',
      target: 'object-storage',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Data Storage',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-12',
      source: 'primary-database',
      target: 'data-warehouse',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'ETL Pipeline',
        protocol: 'PostgreSQL',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone
      }
    } as SecurityEdge,

    // Restricted zone internal flows
    {
      id: 'edge-13',
      source: 'kms',
      target: 'primary-database',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Encryption Key Management',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-14',
      source: 'kms',
      target: 'object-storage',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Storage Encryption',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone
      }
    } as SecurityEdge,

    // Multi-Cloud zone connections
    {
      id: 'edge-15',
      source: 'auth-service',
      target: 'azure-ad-connector',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Hybrid Identity Federation',
        protocol: 'SAML/OIDC',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'MultiCloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-16',
      source: 'data-warehouse',
      target: 'gcp-bigquery',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Cross-Cloud Analytics',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'MultiCloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-17',
      source: 'terraform-cloud',
      target: 'web-app-cluster',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Infrastructure Provisioning',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-18',
      source: 'datadog-monitoring',
      target: 'cloudwatch',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Unified Monitoring',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,

    // Edge Zone connections
    {
      id: 'edge-19',
      source: 'external-users',
      target: 'edge-cdn',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'top',
      data: {
        label: 'Content Requests',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        zone: 'Internet' as SecurityZone,
        controlPoints: [{ id: 'cp1', x: 150, y: 650, active: true }]
      }
    } as SecurityEdge,
    {
      id: 'edge-20',
      source: 'edge-cdn',
      target: 'edge-waf',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Filtered Traffic',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        zone: 'Edge' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-21',
      source: 'edge-waf',
      target: 'load-balancer',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Clean Traffic',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-22',
      source: 'edge-compute',
      target: 'api-gateway',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Edge Processing',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Edge' as SecurityZone
      }
    } as SecurityEdge,

    // Management Zone connections
    {
      id: 'edge-23',
      source: 'cloud-console',
      target: 'monitoring-dashboard',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Management Interface',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Management' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-24',
      source: 'monitoring-dashboard',
      target: 'security-center',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Security Metrics',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Management' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-25',
      source: 'security-center',
      target: 'security-hub',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Security Findings',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-25a',
      source: 'monitoring-dashboard',
      target: 'cost-management',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Cost Metrics',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Management' as SecurityZone
      }
    } as SecurityEdge,

    // Hybrid Zone connections
    {
      id: 'edge-26',
      source: 'vpn-gateway',
      target: 'direct-connect',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Hybrid Connectivity',
        protocol: 'IPSec/BGP',
        encryption: 'IPSec',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Hybrid' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-27',
      source: 'direct-connect',
      target: 'hybrid-dns',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'DNS Resolution',
        protocol: 'DNS',
        encryption: 'DNS over HTTPS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Hybrid' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-28',
      source: 'hybrid-dns',
      target: 'auth-service',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Service Discovery',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,

    // Additional Multi-Cloud connections
    {
      id: 'edge-29',
      source: 'azure-ad-connector',
      target: 'gcp-bigquery',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Identity-based Analytics',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'MultiCloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-30',
      source: 'gcp-bigquery',
      target: 'terraform-cloud',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Analytics-driven IaC',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'MultiCloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-31',
      source: 'admin-workstation',
      target: 'cloud-console',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Administrative Access',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone
      }
    } as SecurityEdge
  ],
  customContext: `# Enterprise Multi-Cloud Platform

## System Overview
Modern enterprise SaaS platform demonstrating a comprehensive multi-tier, multi-cloud architecture with advanced security zones. The system serves over 250,000 daily active users across global markets and processes highly sensitive data including financial transactions, healthcare records, and business-critical applications. The infrastructure showcases cloud-native best practices with containerized microservices, serverless computing, hybrid identity management, and cross-cloud orchestration.

## Multi-Tier Zone Architecture

### Tier 1: Edge & Management (Top)
- **Edge Zone**: CDN, edge computing, and global traffic distribution
- **Management Zone**: Administrative access, bastion hosts, and operational tools
- **Hybrid Zone**: On-premises connectivity and hybrid cloud integration

### Tier 2: Core Application Zones (Middle)
- **Internet Zone**: External user access and public-facing services
- **DMZ Zone**: Web application firewalls, load balancers, and security gateways
- **Cloud Zone**: Core application services, microservices, and serverless functions
- **Restricted Zone**: Sensitive data storage, encryption services, and high-security components

### Tier 3: Multi-Cloud Integration (Bottom)
- **Multi-Cloud Zone**: Cross-cloud services, hybrid identity, and unified monitoring

## Zone-Specific Components

### Internet Zone (External Access)
**Public-Facing Services:**
- External Users: Global user base accessing the platform
  - Multi-region access patterns with geolocation routing
  - Mobile and web application clients
  - API consumers and third-party integrations

### DMZ Zone (Security Gateway)
**Traffic Management and Security:**
- AWS Application Load Balancer (ALB)
  - Layer 7 load balancing with SSL/TLS termination
  - Health checks and auto-scaling integration
  - Security groups restricting access to ports 80/443
  - TLS 1.0 and 1.1 protocols enabled for legacy client compatibility
- AWS WAF (Web Application Firewall)
  - OWASP Top 10 protection with custom rules
  - Rate limiting and DDoS protection
  - Geographic blocking and IP reputation filtering
- AWS API Gateway
  - RESTful API management with throttling
  - API key management and usage analytics
  - Request/response transformation and validation

### Cloud Zone (Core Services)
**Application Infrastructure:**
- EKS Web Application Cluster
  - Kubernetes-orchestrated containerized applications
  - Auto-scaling based on CPU/memory metrics
  - Service mesh integration with Istio
  - Container security context configured with privileged access for debugging
- AWS Lambda Functions
  - Serverless microservices for business logic
  - Event-driven architecture with SQS/SNS integration
  - Custom runtime environments and layers
- Amazon ElastiCache Cluster
  - Redis-based session storage and application caching
  - Multi-AZ deployment with automatic failover
  - Encryption in transit and at rest
- Amazon SQS Message Queue
  - Asynchronous message processing
  - Dead letter queues for error handling
  - FIFO queues for ordered processing
- AWS Cognito Authentication Service
  - User authentication and authorization
  - Multi-factor authentication support
  - Social identity provider integration
- Amazon CloudWatch
  - Comprehensive monitoring and alerting
  - Custom metrics and dashboards
  - Log aggregation and analysis

### Restricted Zone (High Security)
**Data and Security Services:**
- Amazon RDS PostgreSQL (Primary Database)
  - Multi-AZ deployment with read replicas
  - Automated backups and point-in-time recovery
  - Database encryption with customer-managed keys
  - Database connection strings stored in application configuration files
- Amazon S3 Object Storage
  - Versioned storage with lifecycle policies
  - Cross-region replication for disaster recovery
  - Server-side encryption with KMS integration
- Amazon Redshift Data Warehouse
  - Petabyte-scale data analytics platform
  - Columnar storage with compression
  - Advanced security features and audit logging
- AWS KMS (Key Management Service)
  - Centralized encryption key management
  - Hardware security modules (HSMs)
  - Key rotation and access policies
  - Cross-service key access enabled for operational flexibility

### Multi-Cloud Zone (Cross-Cloud Integration)
**Hybrid and Multi-Cloud Services:**
- Azure AD Connector
  - Hybrid identity federation with on-premises Active Directory
  - Single sign-on (SSO) across cloud platforms
  - Conditional access policies and risk-based authentication
- Google BigQuery
  - Cross-cloud data analytics and machine learning
  - Real-time streaming data ingestion
  - Advanced SQL analytics and visualization
- Terraform Cloud
  - Infrastructure as Code (IaC) orchestration
  - Multi-cloud resource provisioning
  - Policy as Code with Sentinel
  - State management and collaboration
- Datadog APM
  - Unified monitoring across multiple cloud providers
  - Application performance monitoring
  - Distributed tracing and error tracking
  - Custom dashboards and alerting

## Security Architecture

### Defense in Depth Strategy
The platform implements a comprehensive defense-in-depth security model with multiple layers of protection:

1. **Perimeter Security**: WAF, DDoS protection, and geographic filtering
2. **Network Security**: VPC isolation, security groups, and NACLs
3. **Application Security**: Container security, serverless isolation, and API gateways
4. **Data Security**: Encryption at rest and in transit, key management, and access controls
5. **Identity Security**: Multi-factor authentication, role-based access, and federation
6. **Monitoring Security**: Comprehensive logging, threat detection, and incident response

### Cross-Cloud Security Considerations
- **Identity Federation**: Centralized identity management across AWS, Azure, and Google Cloud
- **Data Sovereignty**: Compliance with regional data protection regulations
- **Network Connectivity**: Secure VPN and private connectivity between cloud providers
- **Unified Monitoring**: Consolidated security monitoring and incident response
- **Policy Consistency**: Standardized security policies across all cloud platforms

## Operational Context

### Team Structure
- **Cloud Architecture Team**: 12 engineers across AWS, Azure, and Google Cloud
- **Security Operations**: 6 specialists focusing on multi-cloud security
- **DevOps Engineering**: 15 engineers managing CI/CD and infrastructure
- **Data Engineering**: 8 specialists handling cross-cloud data pipelines

### Multi-Cloud Strategy
- **Primary Cloud**: AWS (70% of workloads)
- **Secondary Clouds**: Azure (20%), Google Cloud (10%)
- **Hybrid Connectivity**: Direct Connect, ExpressRoute, and Cloud Interconnect
- **Data Residency**: Regional compliance with GDPR, CCPA, and local regulations

### Infrastructure Management
- **Infrastructure as Code**: Terraform Cloud for multi-cloud provisioning
- **Configuration Management**: Ansible and AWS Systems Manager
- **Container Orchestration**: Kubernetes across all cloud platforms
- **Service Mesh**: Istio for cross-cloud service communication

### Security Operations
- **SIEM Platform**: Splunk with multi-cloud log aggregation
- **Threat Detection**: AWS GuardDuty, Azure Sentinel, Google Chronicle
- **Vulnerability Management**: Qualys VMDR across all environments
- **Incident Response**: 24/7 SOC with automated playbooks

### Compliance and Governance
- **Frameworks**: SOC 2 Type II, ISO 27001, PCI DSS Level 1
- **Data Protection**: GDPR, CCPA, HIPAA compliance
- **Cloud Security**: CSA CCM and NIST Cybersecurity Framework
- **Audit Schedule**: Quarterly internal audits, annual external assessments

### Business Continuity
- **Disaster Recovery**: Multi-region, multi-cloud failover strategy
- **RTO/RPO**: 2 hours RTO, 15 minutes RPO for critical systems
- **Backup Strategy**: Cross-cloud replication with immutable backups
- **Business Impact**: Supports $500M annual revenue with 99.99% uptime SLA`,
  attackPaths: [
    {
      id: 'ap-tls-container-escape',
      name: 'Weak TLS → Privileged Container Escape → Database Compromise',
      strideCategory: 'Information Disclosure',
      riskLevel: 'Critical',
      description: 'An attacker exploits weak TLS 1.0/1.1 on the Application Load Balancer to intercept session tokens via a protocol downgrade attack, then leverages a privileged ECS Fargate container to escape to the host, pivot through Lambda functions, and reach the RDS PostgreSQL database using hardcoded connection strings stored in application configuration.',
      steps: [
        {
          order: 1,
          edgeId: 'edge-1',
          sourceNodeId: 'external-users',
          targetNodeId: 'load-balancer',
          technique: 'T1557: Adversary-in-the-Middle (TLS downgrade)',
        },
        {
          order: 2,
          edgeId: 'edge-2',
          sourceNodeId: 'load-balancer',
          targetNodeId: 'web-app-cluster',
          technique: 'T1078: Valid Accounts (hijacked session)',
        },
        {
          order: 3,
          edgeId: 'edge-6',
          sourceNodeId: 'web-app-cluster',
          targetNodeId: 'lambda-functions',
          technique: 'T1611: Escape to Host',
        },
        {
          order: 4,
          edgeId: 'edge-10',
          sourceNodeId: 'lambda-functions',
          targetNodeId: 'primary-database',
          technique: 'T1552: Unsecured Credentials (hardcoded connection string)',
        },
      ],
      mitreTechniques: ['T1557', 'T1078', 'T1611', 'T1552'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-lambda-s3-exfil',
      name: 'API Gateway → Overprivileged Lambda → S3 Data Lake Exfiltration',
      strideCategory: 'Information Disclosure',
      riskLevel: 'High',
      description: 'An attacker sends crafted API requests through the API Gateway to trigger Lambda functions with overprivileged execution roles (s3:* wildcard). The compromised Lambda uses its broad IAM permissions to list and download sensitive objects from the S3 Data Lake, bypassing application-layer access controls.',
      steps: [
        {
          order: 1,
          edgeId: 'edge-3',
          sourceNodeId: 'api-gateway',
          targetNodeId: 'lambda-functions',
          technique: 'T1190: Exploit Public-Facing Application',
        },
        {
          order: 2,
          edgeId: 'edge-10',
          sourceNodeId: 'lambda-functions',
          targetNodeId: 'primary-database',
          technique: 'T1078: Valid Accounts (Lambda execution role)',
        },
      ],
      mitreTechniques: ['T1190', 'T1078'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-federation-lateral',
      name: 'Cross-Cloud Identity Federation → AWS Resource Access',
      strideCategory: 'Elevation of Privilege',
      riskLevel: 'High',
      description: 'An attacker compromises an Azure AD tenant and replays federated tokens through the Cognito-Azure AD trust relationship (which lacks audience restriction) to obtain valid AWS session credentials. The attacker then accesses cloud-zone services including the web application cluster and cache cluster.',
      steps: [
        {
          order: 1,
          edgeId: 'edge-15',
          sourceNodeId: 'auth-service',
          targetNodeId: 'azure-ad-connector',
          technique: 'T1550: Use Alternate Authentication Material (SAML token)',
        },
        {
          order: 2,
          edgeId: 'edge-28',
          sourceNodeId: 'hybrid-dns',
          targetNodeId: 'auth-service',
          technique: 'T1484: Domain Policy Modification',
        },
      ],
      mitreTechniques: ['T1550', 'T1484'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-terraform-secrets',
      name: 'Terraform Cloud State → Production Database via Hardcoded Credentials',
      strideCategory: 'Information Disclosure',
      riskLevel: 'Critical',
      description: 'A malicious insider or attacker who compromises a Terraform Cloud workspace reads plaintext sensitive outputs from state files containing database connection strings and KMS ARNs. Using the extracted credentials, the attacker provisions infrastructure or directly connects to the RDS database and decrypts S3 data using the exposed KMS key.',
      steps: [
        {
          order: 1,
          edgeId: 'edge-17',
          sourceNodeId: 'terraform-cloud',
          targetNodeId: 'web-app-cluster',
          technique: 'T1552.001: Credentials In Files',
        },
        {
          order: 2,
          edgeId: 'edge-11',
          sourceNodeId: 'web-app-cluster',
          targetNodeId: 'object-storage',
          technique: 'T1530: Data from Cloud Storage Object',
        },
      ],
      mitreTechniques: ['T1552', 'T1530'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
  ],
};
