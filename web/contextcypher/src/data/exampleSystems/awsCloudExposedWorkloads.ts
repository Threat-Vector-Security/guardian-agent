import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityEdge, SecurityNode, SecurityZone } from '../../types/SecurityTypes';
import { DiagramAttackPath, AssessmentThreatModelNodeSourceType, AssessmentThreatModelEdgeSourceType, AttackPathRiskLevel, GrcWorkspace } from '../../types/GrcTypes';
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
  { id: 'tier2-change', tier: 2 as const, label: 'Change Management', parentId: 'tier1-operational', description: 'Deployment, rotation, and configuration management' },
  { id: 'tier3-iam-wildcard', tier: 3 as const, label: 'Wildcarded IAM Policies', parentId: 'tier2-identity' },
  { id: 'tier3-waf-bypass', tier: 3 as const, label: 'WAF Bypass Paths', parentId: 'tier2-network' },
  { id: 'tier3-public-storage', tier: 3 as const, label: 'Public Cloud Storage', parentId: 'tier2-data' },
  { id: 'tier3-admin-access', tier: 3 as const, label: 'Overprivileged Execution Roles', parentId: 'tier2-identity' },
  { id: 'tier3-secret-drift', tier: 3 as const, label: 'Secret Rotation Failures', parentId: 'tier2-change' },
  { id: 'tier3-suppressed-alerts', tier: 3 as const, label: 'Suppressed Security Findings', parentId: 'tier2-monitoring' },
  { id: 'tier3-shared-sg', tier: 3 as const, label: 'Shared Security Groups', parentId: 'tier2-network' },
  { id: 'tier3-log-exposure', tier: 3 as const, label: 'Audit Log Exposure', parentId: 'tier2-monitoring' },
];

const assets = [
  {
    id: 'asset-api-gateway', name: 'API Gateway', type: 'api_gateway', owner: 'Platform Engineering',
    domain: 'application' as const, category: 'Cloud Service',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Primary REST API entry point for all SaaS traffic with optional mTLS',
    criticality: { confidentiality: 3, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'aws-cloud-exposed-workloads', nodeId: 'api-gateway', nodeLabel: 'API Gateway', nodeType: 'awsAPIGateway' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-ecs-service', name: 'ECS Fargate Workers', type: 'application_server', owner: 'Development',
    domain: 'application' as const, category: 'Compute',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Multi-tenant REST workers with permissive task role (s3:* wildcard)',
    criticality: { confidentiality: 4, integrity: 5, availability: 5, financial: 5, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'aws-cloud-exposed-workloads', nodeId: 'ecs-service', nodeLabel: 'ECS Fargate', nodeType: 'awsECS' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-lambda-worker', name: 'Lambda Workers', type: 'serverless_function', owner: 'Development',
    domain: 'application' as const, category: 'Compute',
    businessCriticality: 4, securityCriticality: 5,
    description: 'Partner ingestion jobs with AdministratorAccess execution role',
    criticality: { confidentiality: 4, integrity: 5, availability: 3, financial: 4, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'aws-cloud-exposed-workloads', nodeId: 'lambda-worker', nodeLabel: 'Lambda Workers', nodeType: 'awsLambda' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-s3-audit', name: 'S3 Audit Exports Bucket', type: 'cloud_storage', owner: 'Cloud Operations',
    domain: 'application' as const, category: 'Storage',
    businessCriticality: 4, securityCriticality: 5,
    description: 'Nightly CSV exports with public-read ACL enabled for troubleshooting',
    criticality: { confidentiality: 5, integrity: 3, availability: 2, financial: 4, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'aws-cloud-exposed-workloads', nodeId: 's3-audit-bucket', nodeLabel: 'S3 Audit Exports', nodeType: 'awsS3' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-rds-cluster', name: 'Aurora PostgreSQL Cluster', type: 'database', owner: 'Database Administration',
    domain: 'application' as const, category: 'Database',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Primary multi-tenant data store with cross-region replica using shared IAM auth tokens',
    criticality: { confidentiality: 5, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'aws-cloud-exposed-workloads', nodeId: 'rds-cluster', nodeLabel: 'Aurora PostgreSQL', nodeType: 'awsRDS' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-cognito', name: 'Cognito User Pool', type: 'identity_provider', owner: 'Identity & Access Management',
    domain: 'it' as const, category: 'Identity',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Federated identity with partner IdP; device trust disabled, 30-day refresh tokens',
    criticality: { confidentiality: 4, integrity: 5, availability: 4, financial: 4, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'aws-cloud-exposed-workloads', nodeId: 'cognito-idp', nodeLabel: 'Cognito User Pool', nodeType: 'awsCognito' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-secrets-mgr', name: 'AWS Secrets Manager', type: 'secret_store', owner: 'Security Operations',
    domain: 'it' as const, category: 'Security Tools',
    businessCriticality: 4, securityCriticality: 5,
    description: 'Stores DB credentials and API keys with rotation disabled',
    criticality: { confidentiality: 5, integrity: 4, availability: 3, financial: 3, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'aws-cloud-exposed-workloads', nodeId: 'secrets-manager', nodeLabel: 'Secrets Manager', nodeType: 'awsSecretsManager' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-bastion', name: 'Bastion Host', type: 'server', owner: 'Cloud Operations',
    domain: 'it' as const, category: 'Network Infrastructure',
    businessCriticality: 3, securityCriticality: 4,
    description: 'SSM-managed EC2 sharing security group with production ECS tasks',
    criticality: { confidentiality: 3, integrity: 4, availability: 2, financial: 2, reputation: 3, safety: 1 },
    diagramRefs: [{ diagramId: 'aws-cloud-exposed-workloads', nodeId: 'jump-bastion', nodeLabel: 'Bastion Host', nodeType: 'bastionHost' }],
    createdAt: NOW, updatedAt: NOW
  },
];

const risks = [
  {
    id: 'risk-waf-bypass-cdn', title: 'Legacy CDN Paths Bypass WAF',
    description: 'CloudFront legacy signed-cookie origins route traffic directly to API Gateway without WAF inspection, allowing unfiltered malicious payloads to reach backend services.',
    status: 'assessed' as const, owner: 'Platform Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Network Security', tier3: 'WAF Bypass Paths' },
    assetIds: ['asset-api-gateway'],
    diagramLinks: [{ diagramId: 'aws-cloud-exposed-workloads', nodeIds: ['cloudfront-edge', 'api-gateway'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Remove legacy signed-cookie origins from CloudFront; enforce all traffic through WAF-attached distributions',
    threatActorIds: ['threat-actor-external-attacker'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-cognito-idp-trust', title: 'Cognito Accepts Unvalidated Partner IdP Assertions',
    description: 'Cognito user pool federates with partner IdP without audience restriction checks or device fingerprinting, enabling forged SAML assertions and partner account takeover.',
    status: 'assessed' as const, owner: 'Identity & Access Management',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Identity & Access', tier3: 'Wildcarded IAM Policies' },
    assetIds: ['asset-cognito', 'asset-api-gateway'],
    diagramLinks: [{ diagramId: 'aws-cloud-exposed-workloads', nodeIds: ['cognito-idp', 'api-gateway'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Enforce audience restriction and issuer validation on Cognito SAML federation; enable device fingerprinting',
    threatActorIds: ['threat-actor-partner-compromise'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-ecs-wildcard-s3', title: 'ECS Task Role Wildcard S3 Access',
    description: 'ECS Fargate task role grants s3:* on all buckets. Combined with the public-read ACL on the audit bucket, any compromised container can read and exfiltrate all S3 data.',
    status: 'assessed' as const, owner: 'Cloud Operations',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Identity & Access', tier3: 'Overprivileged Execution Roles' },
    assetIds: ['asset-ecs-service', 'asset-s3-audit'],
    diagramLinks: [{ diagramId: 'aws-cloud-exposed-workloads', nodeIds: ['ecs-service', 's3-audit-bucket'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Scope ECS task role to specific bucket ARNs with least-privilege actions; remove public-read ACL from audit bucket',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-lambda-admin-role', title: 'Lambda Workers with AdministratorAccess',
    description: 'Lambda execution role retains AdministratorAccess from initial deployment, granting full AWS account control. Environment variables also contain plaintext Slack webhook.',
    status: 'draft' as const, owner: 'Development',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Identity & Access', tier3: 'Overprivileged Execution Roles' },
    assetIds: ['asset-lambda-worker', 'asset-secrets-mgr'],
    diagramLinks: [{ diagramId: 'aws-cloud-exposed-workloads', nodeIds: ['lambda-worker', 'secrets-manager'] }],
    inherentScore: score('likelihood-5', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Replace AdministratorAccess with scoped policy; move Slack webhook to Secrets Manager with rotation',
    threatActorIds: ['threat-actor-external-attacker'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-s3-audit-public', title: 'S3 Audit Bucket with Public-Read ACL',
    description: 'Audit export bucket grants s3:GetObject to * for troubleshooting. Nightly CSV exports containing tenant data are publicly downloadable.',
    status: 'assessed' as const, owner: 'Cloud Operations',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Data Protection', tier3: 'Public Cloud Storage' },
    assetIds: ['asset-s3-audit'],
    diagramLinks: [{ diagramId: 'aws-cloud-exposed-workloads', nodeIds: ['s3-audit-bucket'] }],
    inherentScore: score('likelihood-5', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Remove public-read ACL; enforce bucket policy requiring authenticated principals; enable S3 Block Public Access',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-guardduty-suppressed', title: 'GuardDuty Findings Suppressed and Unactioned',
    description: 'GuardDuty S3 protection disabled, and Security Hub suppression rules silence repetitive findings. Combined with 3-day CloudWatch log retention, detection coverage is critically degraded.',
    status: 'assessed' as const, owner: 'Security Operations',
    tierPath: { tier1: 'Operational Risk', tier2: 'Security Monitoring', tier3: 'Suppressed Security Findings' },
    assetIds: ['asset-ecs-service', 'asset-lambda-worker'],
    diagramLinks: [{ diagramId: 'aws-cloud-exposed-workloads', nodeIds: ['guardduty', 'security-hub', 'cloudwatch'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Enable GuardDuty S3 protection; review and remove overbroad suppression rules; increase CloudWatch retention to 90 days',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-secrets-no-rotation', title: 'Secrets Manager Rotation Disabled',
    description: 'Automatic rotation disabled to avoid breaking legacy applications. Resource policies allow broad GetSecretValue access, increasing window of exposure for stale credentials.',
    status: 'draft' as const, owner: 'Security Operations',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Change Management', tier3: 'Secret Rotation Failures' },
    assetIds: ['asset-secrets-mgr', 'asset-rds-cluster'],
    diagramLinks: [{ diagramId: 'aws-cloud-exposed-workloads', nodeIds: ['secrets-manager', 'rds-cluster'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Enable automatic rotation with Lambda rotator; scope resource policy to specific role ARNs',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-bastion-shared-sg', title: 'Bastion Shares Security Group with Production',
    description: 'Operations bastion host shares the same security group as production ECS tasks, eroding network segmentation and blast-radius assumptions. Stale contractor accounts persist.',
    status: 'assessed' as const, owner: 'Cloud Operations',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Network Security', tier3: 'Shared Security Groups' },
    assetIds: ['asset-bastion', 'asset-ecs-service'],
    diagramLinks: [{ diagramId: 'aws-cloud-exposed-workloads', nodeIds: ['jump-bastion', 'ecs-service'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Create dedicated security group for bastion; remove stale contractor accounts; restrict SSH to SSM Session Manager',
    createdAt: NOW, updatedAt: NOW
  },
];

const assessments = [
  {
    id: 'assessment-aws-saas-review', title: 'AWS SaaS Drifted Controls Security Assessment',
    status: 'in_review' as const,
    owner: 'Cloud Security Architecture',
    reviewer: 'CISO',
    startDate: '2025-05-15',
    dueDate: '2025-07-01',
    threatActorIds: ['threat-actor-external-attacker', 'threat-actor-partner-compromise', 'threat-actor-insider'],
    methodologyNote: 'Assessment follows AWS Well-Architected Security Pillar with OWASP Top 10 control mapping and MITRE ATT&CK for Cloud.',
    assumptionNote: 'Assessment assumes current production configuration. Staging and development accounts excluded from scope.',
    scopeItems: [
      { id: 'scope-aws-saas', type: 'system' as const, value: 'system', name: 'AWS Production SaaS' },
      { id: 'scope-zone-cloud', type: 'diagram_segment' as const, value: 'Cloud', name: 'AWS Production VPC' },
      { id: 'scope-zone-dmz', type: 'diagram_segment' as const, value: 'DMZ', name: 'AWS Edge DMZ' },
    ],
    tierFilter: { tier1: 'Cyber Risk' },
    riskManagementPlan: {
      objective: 'Remediate drifted IAM policies, close public storage exposure, and restore monitoring effectiveness.',
      strategy: 'Prioritize IAM and data exposure risks first, then restore detection coverage before addressing network segmentation.',
      residualRiskStatement: 'Residual risk accepted only for legacy CDN paths pending deprecation with active compensating WAF rules.',
      monitoringApproach: 'Weekly review of open actions and bi-weekly GuardDuty finding triage.',
      communicationPlan: 'Report to Cloud Security Steering Committee every two weeks.',
      reviewCadenceDays: 14,
      actions: [
        {
          id: 'rmp-action-scope-ecs-role',
          title: 'Replace ECS wildcard S3 policy with scoped bucket-level permissions',
          owner: 'Cloud Operations',
          dueDate: '2025-06-15',
          status: 'in_progress' as const,
          linkedRiskIds: ['risk-ecs-wildcard-s3'],
          notes: 'Policy draft reviewed; testing in staging account'
        },
        {
          id: 'rmp-action-lambda-role',
          title: 'Remove AdministratorAccess from Lambda execution role',
          owner: 'Development',
          dueDate: '2025-06-10',
          status: 'planned' as const,
          linkedRiskIds: ['risk-lambda-admin-role'],
          notes: 'Need to enumerate required API calls from CloudTrail logs first'
        },
        {
          id: 'rmp-action-s3-public',
          title: 'Remove public-read ACL and enable S3 Block Public Access on audit bucket',
          owner: 'Cloud Operations',
          dueDate: '2025-06-01',
          status: 'done' as const,
          linkedRiskIds: ['risk-s3-audit-public'],
          notes: 'Block Public Access enabled; verified no external dependencies'
        },
        {
          id: 'rmp-action-guardduty',
          title: 'Re-enable GuardDuty S3 protection and review suppression rules',
          owner: 'Security Operations',
          dueDate: '2025-06-20',
          status: 'in_progress' as const,
          linkedRiskIds: ['risk-guardduty-suppressed'],
          notes: 'S3 protection re-enabled; reviewing 47 suppression rules'
        },
      ],
      updatedAt: NOW
    },
    riskIds: risks.map(r => r.id),
    soaGapIds: ['soa-aws-a01', 'soa-aws-a05', 'soa-aws-a07'],
    taskIds: ['task-ecs-role-scoping', 'task-lambda-role-review', 'task-guardduty-review'],
    linkedImplementedControlIds: [],
    linkedInitiativeIds: [],
    summary: 'Security assessment of AWS SaaS production environment identifying 8 risks across IAM drift, data exposure, and degraded monitoring. 2 rated Critical, 3 High.',
    findings: 'Key findings include wildcarded IAM roles on compute services, publicly readable S3 audit data, suppressed GuardDuty findings, and shared security groups between bastion and production.',
    recommendations: 'Prioritize IAM least-privilege remediation for ECS and Lambda roles, close public S3 access, and restore full GuardDuty detection coverage.',
    evidenceSummary: 'Evidence includes IAM policy exports, S3 bucket policy snapshots, GuardDuty finding suppression rule lists, and security group configuration dumps.',
    threatModel: {
      nodes: [
        { id: 'tm-node-partner', label: 'Partner Automation', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'integration-partner', position: { x: 50, y: 150 }, nodeType: 'user' },
        { id: 'tm-node-apigw', label: 'API Gateway', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'api-gateway', position: { x: 250, y: 150 }, nodeType: 'awsAPIGateway', commentary: 'Accepts partner traffic without WAF inspection via legacy path' },
        { id: 'tm-node-lambda', label: 'Lambda Workers', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'lambda-worker', position: { x: 450, y: 100 }, nodeType: 'awsLambda', commentary: 'AdministratorAccess execution role' },
        { id: 'tm-node-ecs', label: 'ECS Fargate', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'ecs-service', position: { x: 450, y: 250 }, nodeType: 'awsECS', commentary: 'Wildcard S3 task role' },
        { id: 'tm-node-secrets', label: 'Secrets Manager', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'secrets-manager', position: { x: 650, y: 100 }, nodeType: 'awsSecretsManager', commentary: 'Rotation disabled; broad GetSecretValue policy' },
        { id: 'tm-node-s3', label: 'S3 Audit Exports', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 's3-audit-bucket', position: { x: 650, y: 250 }, nodeType: 'awsS3', commentary: 'Public-read ACL on sensitive exports' },
        { id: 'tm-node-rds', label: 'Aurora PostgreSQL', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'rds-cluster', position: { x: 650, y: 400 }, nodeType: 'awsRDS' },
      ],
      edges: [
        { id: 'tm-edge-partner-apigw', source: 'tm-node-partner', target: 'tm-node-apigw', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e2', label: 'API Keys (bypass WAF)', commentary: 'Direct path bypasses WAF; API keys allow 24h replay' },
        { id: 'tm-edge-apigw-lambda', source: 'tm-node-apigw', target: 'tm-node-lambda', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e7', label: 'Async invocation' },
        { id: 'tm-edge-apigw-ecs', source: 'tm-node-apigw', target: 'tm-node-ecs', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e6', label: 'REST (mTLS optional)' },
        { id: 'tm-edge-lambda-secrets', source: 'tm-node-lambda', target: 'tm-node-secrets', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e13', label: 'GetSecretValue', commentary: 'AdministratorAccess allows unrestricted secret retrieval' },
        { id: 'tm-edge-ecs-s3', source: 'tm-node-ecs', target: 'tm-node-s3', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e10', label: 'S3 Exports (public-read)' },
        { id: 'tm-edge-ecs-rds', source: 'tm-node-ecs', target: 'tm-node-rds', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e9', label: 'PostgreSQL queries' },
      ],
      attackPathDescription: 'Three critical attack chains: (1) Partner WAF bypass to Lambda privilege escalation to full account takeover; (2) ECS compromise to S3 data exfiltration via wildcard role; (3) Bastion lateral movement via shared security group to production workloads.',
      attackPaths: [
        {
          id: 'aap-partner-waf-bypass-lambda',
          name: 'Partner WAF Bypass → Lambda Privilege Escalation',
          strideCategory: 'Elevation of Privilege' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'Partner automation bypasses WAF via direct API Gateway path, invokes Lambda workers that have AdministratorAccess, then retrieves all secrets from Secrets Manager for full account takeover.',
          diagramAttackPathId: 'ap-partner-waf-bypass-lambda',
          steps: [
            { order: 1, edgeId: 'e2', sourceNodeId: 'integration-partner', targetNodeId: 'api-gateway', technique: 'T1190: Exploit Public-Facing Application' },
            { order: 2, edgeId: 'e7', sourceNodeId: 'api-gateway', targetNodeId: 'lambda-worker', technique: 'T1078: Valid Accounts' },
            { order: 3, edgeId: 'e13', sourceNodeId: 'lambda-worker', targetNodeId: 'secrets-manager', technique: 'T1552: Unsecured Credentials' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
        {
          id: 'aap-ecs-s3-exfil',
          name: 'ECS Task Role Abuse → S3 Data Exfiltration',
          strideCategory: 'Information Disclosure' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'Attacker exploits application vulnerability in ECS Fargate, leverages wildcard S3 task role to list and download all objects from the public-read audit bucket containing sensitive tenant exports.',
          diagramAttackPathId: 'ap-ecs-s3-exfil',
          steps: [
            { order: 1, edgeId: 'e6', sourceNodeId: 'api-gateway', targetNodeId: 'ecs-service', technique: 'T1190: Exploit Public-Facing Application' },
            { order: 2, edgeId: 'e10', sourceNodeId: 'ecs-service', targetNodeId: 's3-audit-bucket', technique: 'T1530: Data from Cloud Storage' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
        {
          id: 'aap-bastion-lateral',
          name: 'Bastion Shared SG → Production Lateral Movement',
          strideCategory: 'Tampering' as StrideCategory,
          riskLevel: 'High' as AttackPathRiskLevel,
          description: 'Attacker compromises bastion host via stale contractor account, leverages shared security group to SSH into production ECS tasks, then pivots to Aurora PostgreSQL for data tampering.',
          diagramAttackPathId: 'ap-bastion-lateral',
          steps: [
            { order: 1, edgeId: 'e19', sourceNodeId: 'jump-bastion', targetNodeId: 'ecs-service', technique: 'T1021: Remote Services' },
            { order: 2, edgeId: 'e9', sourceNodeId: 'ecs-service', targetNodeId: 'rds-cluster', technique: 'T1078: Valid Accounts' },
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
    id: 'soa-aws-a01', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A01', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'ECS task role grants wildcard S3 access; Lambda has AdministratorAccess. IAM trust policies use wildcards for cross-account partner access.',
    mitigatesRiskIds: ['risk-ecs-wildcard-s3', 'risk-lambda-admin-role'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-aws-a02', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A02', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'ElastiCache AUTH disabled; Redis traffic unencrypted within VPC. Secrets Manager rotation disabled leaving stale credentials.',
    mitigatesRiskIds: ['risk-secrets-no-rotation'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-aws-a03', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A03', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'implemented' as const,
    justification: 'API Gateway uses parameterized query integration with Aurora. WAF managed rules deployed but SSRF signatures outdated.',
    mitigatesRiskIds: [],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-aws-a05', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A05', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'S3 audit bucket has public-read ACL. CloudTrail log bucket has public list. AWS Config rules disabled. Lambda env vars contain plaintext secrets.',
    mitigatesRiskIds: ['risk-s3-audit-public', 'risk-lambda-admin-role'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-aws-a07', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A07', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Cognito accepts SAML assertions without audience restrictions. 30-day refresh tokens. Break-glass SSO role bypasses MFA.',
    mitigatesRiskIds: ['risk-cognito-idp-trust'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-aws-a08', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A08', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'planned' as const,
    justification: 'ECS container images built from mutable :latest tags with no signature verification. No SBOM generation for Lambda layers.',
    mitigatesRiskIds: [],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-aws-a09', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A09', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'GuardDuty deployed but S3 protection disabled. Security Hub suppression rules overbroad. CloudWatch retention reduced to 3 days.',
    mitigatesRiskIds: ['risk-guardduty-suppressed'],
    diagramRefs: [],
    evidence: [
      { id: 'evidence-guardduty-config', kind: 'link' as const, name: 'GuardDuty detector configuration export', url: 'https://security.example.internal/reports/guardduty-config', note: 'Quarterly review', createdAt: NOW }
    ],
    updatedAt: NOW
  },
  {
    id: 'soa-aws-a10', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A10', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'WAF SSRF signatures outdated and not updated. Lambda workers with AdministratorAccess can make arbitrary API calls acting as SSRF pivot.',
    mitigatesRiskIds: ['risk-waf-bypass-cdn'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-aws-cis03', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.03', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'S3 audit bucket publicly readable. ElastiCache unencrypted. CloudTrail log bucket has public list permissions.',
    mitigatesRiskIds: ['risk-s3-audit-public'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-aws-cis06', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.06', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'IAM wildcarded trust policies. Lambda AdministratorAccess. ECS wildcard S3 role. Bastion shares production security group.',
    mitigatesRiskIds: ['risk-ecs-wildcard-s3', 'risk-lambda-admin-role', 'risk-bastion-shared-sg'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
];

const workflowTasks = [
  {
    id: 'task-ecs-role-scoping',
    title: 'Scope ECS task role to specific S3 bucket ARNs',
    description: 'Replace wildcard s3:* policy with least-privilege actions on named bucket ARNs.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'critical' as const,
    owner: 'Cloud Operations',
    dueDate: '2025-06-15',
    riskId: 'risk-ecs-wildcard-s3',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'task-lambda-role-review',
    title: 'Replace Lambda AdministratorAccess with scoped policy',
    description: 'Enumerate required API calls from CloudTrail and build least-privilege policy.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'critical' as const,
    owner: 'Development',
    dueDate: '2025-06-10',
    riskId: 'risk-lambda-admin-role',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'task-guardduty-review',
    title: 'Review and prune GuardDuty suppression rules',
    description: 'Audit 47 existing suppression rules; remove overbroad suppressions and re-enable S3 protection.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'high' as const,
    owner: 'Security Operations',
    dueDate: '2025-06-20',
    riskId: 'risk-guardduty-suppressed',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'task-cognito-saml-hardening',
    title: 'Enforce SAML audience restriction and device fingerprinting on Cognito',
    description: 'Configure Cognito attribute mapping to validate audience and issuer claims from partner IdP.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Identity & Access Management',
    dueDate: '2025-06-30',
    riskId: 'risk-cognito-idp-trust',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'task-secrets-rotation',
    title: 'Enable Secrets Manager automatic rotation for database credentials',
    description: 'Deploy Lambda rotator function and configure 30-day rotation schedule.',
    type: 'control_implementation' as const,
    status: 'blocked' as const,
    priority: 'medium' as const,
    owner: 'Security Operations',
    dueDate: '2025-07-15',
    riskId: 'risk-secrets-no-rotation',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'task-bastion-sg-isolation',
    title: 'Create dedicated security group for bastion host',
    description: 'Separate bastion from production SG; restrict ingress to SSM Session Manager only.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'medium' as const,
    owner: 'Cloud Operations',
    dueDate: '2025-07-01',
    riskId: 'risk-bastion-shared-sg',
    createdAt: NOW, updatedAt: NOW
  },
];

const threatActors = [
  {
    id: 'threat-actor-external-attacker', name: 'Cloud-Savvy External Attacker',
    type: 'organised_crime' as const, capabilityLevel: 4,
    resourceLevel: 'high' as const,
    motivation: 'Financial gain through credential harvesting, data exfiltration from misconfigured cloud services, and ransomware deployment via overprivileged execution roles.',
    description: 'Sophisticated threat group targeting AWS misconfigurations. Specializes in IAM privilege escalation, S3 bucket enumeration, and Lambda function abuse.',
    targetedAssetIds: ['asset-lambda-worker', 'asset-ecs-service', 'asset-s3-audit', 'asset-secrets-mgr'],
    tags: ['cloud-native', 'iam-abuse', 'data-exfiltration'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'threat-actor-partner-compromise', name: 'Compromised Partner Integration',
    type: 'supply_chain' as const, capabilityLevel: 3,
    resourceLevel: 'moderate' as const,
    motivation: 'Leverage trusted partner relationship to bypass perimeter controls and access internal APIs and data stores.',
    description: 'Threat actor operating through compromised B2B partner credentials or forged SAML assertions. Exploits trust in federated identity and API key-based authentication.',
    targetedAssetIds: ['asset-cognito', 'asset-api-gateway'],
    tags: ['supply-chain', 'identity-abuse', 'trusted-partner'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'threat-actor-insider', name: 'Disgruntled Ops Engineer',
    type: 'insider' as const, capabilityLevel: 3,
    resourceLevel: 'moderate' as const,
    motivation: 'Leverage bastion access and knowledge of shared security groups to exfiltrate data or sabotage production services.',
    description: 'Current or former operations engineer with SSM access to bastion host and knowledge of shared security group configurations and stale contractor accounts.',
    targetedAssetIds: ['asset-bastion', 'asset-ecs-service', 'asset-rds-cluster'],
    tags: ['insider-threat', 'privileged-access', 'lateral-movement'],
    createdAt: NOW, updatedAt: NOW
  },
];

const threatScenarios = [
  {
    id: 'scenario-partner-waf-bypass', title: 'Partner Account Takeover via Cognito Federation Abuse',
    description: 'Compromised partner forges SAML assertion without audience validation, obtains valid Cognito tokens, invokes Lambda workers with AdministratorAccess to retrieve all secrets and escalate to full account control.',
    threatActorId: 'threat-actor-partner-compromise',
    targetedAssetIds: ['asset-cognito', 'asset-api-gateway', 'asset-lambda-worker', 'asset-secrets-mgr'],
    attackTechniques: ['T1078 - Valid Accounts', 'T1190 - Exploit Public-Facing Application', 'T1552 - Unsecured Credentials'],
    linkedRiskIds: ['risk-cognito-idp-trust', 'risk-lambda-admin-role', 'risk-waf-bypass-cdn'],
    likelihood: 'High - partner IdP trust without audience validation provides direct entry with valid tokens.',
    impact: 'Critical - AdministratorAccess Lambda role enables full AWS account takeover.',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scenario-s3-data-breach', title: 'Public S3 Audit Data Exfiltration',
    description: 'External attacker discovers publicly readable S3 audit bucket via bucket enumeration, downloads nightly CSV exports containing sensitive tenant data including PII and financial records.',
    threatActorId: 'threat-actor-external-attacker',
    targetedAssetIds: ['asset-s3-audit', 'asset-ecs-service'],
    attackTechniques: ['T1530 - Data from Cloud Storage', 'T1580 - Cloud Infrastructure Discovery'],
    linkedRiskIds: ['risk-s3-audit-public', 'risk-ecs-wildcard-s3'],
    likelihood: 'Very High - public-read ACL makes discovery and download trivial.',
    impact: 'Major - tenant data breach triggers notification obligations and regulatory fines.',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scenario-bastion-pivot', title: 'Bastion Host Lateral Movement to Production Database',
    description: 'Insider or attacker using stale contractor account on bastion host exploits shared security group to SSH into production ECS tasks, then accesses Aurora PostgreSQL with credentials retrieved from environment or Secrets Manager.',
    threatActorId: 'threat-actor-insider',
    targetedAssetIds: ['asset-bastion', 'asset-ecs-service', 'asset-rds-cluster'],
    attackTechniques: ['T1021 - Remote Services', 'T1078 - Valid Accounts', 'T1005 - Data from Local System'],
    linkedRiskIds: ['risk-bastion-shared-sg', 'risk-secrets-no-rotation'],
    likelihood: 'Moderate - requires bastion access but shared SG eliminates network barriers.',
    impact: 'Critical - direct access to multi-tenant production database.',
    createdAt: NOW, updatedAt: NOW
  },
];

export const awsCloudExposedWorkloadsGrcWorkspace: GrcWorkspace = buildGrcWorkspace({
  tierCatalogue,
  assets,
  risks,
  assessments,
  soaEntries,
  workflowTasks,
  threatActors,
  threatScenarios,
  thirdParties: [
    {
      id: 'aws-tp-aws',
      name: 'Amazon Web Services (AWS)',
      description: 'Primary cloud infrastructure provider hosting the entire SaaS production environment including ECS, Lambda, RDS, S3, Cognito, and Secrets Manager. Operates under shared responsibility model with IaaS and managed services.',
      category: 'cloud_provider',
      status: 'active',
      riskRating: 'critical',
      dataClassification: 'restricted',
      linkedAssetIds: ['asset-api-gateway', 'asset-ecs-service', 'asset-lambda-worker', 'asset-s3-audit', 'asset-rds-cluster', 'asset-cognito', 'asset-secrets-mgr'],
      linkedRiskIds: ['risk-ecs-wildcard-s3', 'risk-lambda-admin-role', 'risk-s3-audit-public', 'risk-guardduty-suppressed', 'risk-secrets-no-rotation'],
      contactName: 'AWS Enterprise Support',
      contactEmail: 'enterprise-tam@aws.example.com',
      contractExpiry: '2027-01-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-12-31',
      notes: 'Enterprise Support with designated TAM. SOC 2 Type II, ISO 27001, FedRAMP High certified. Multiple configuration drift issues identified — IAM role wildcards, suppressed GuardDuty findings, and disabled Config rules. AWS Trusted Advisor and Security Hub findings require triage. Shared responsibility gaps documented in last assessment.'
    },
    {
      id: 'aws-tp-datadog',
      name: 'Datadog Inc.',
      description: 'SaaS observability and monitoring platform ingesting application metrics, traces, and logs from ECS services, Lambda functions, and API Gateway. Provides dashboards, alerting, and APM for production SaaS workloads.',
      category: 'saas',
      status: 'active',
      riskRating: 'medium',
      dataClassification: 'internal',
      linkedAssetIds: ['asset-ecs-service', 'asset-lambda-worker', 'asset-api-gateway'],
      linkedRiskIds: ['risk-guardduty-suppressed'],
      contactName: 'Rachel Kim',
      contactEmail: 'rachel.kim@datadog.example.com',
      contractExpiry: '2026-12-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-09-30',
      notes: 'Enterprise plan with SSO integration. Datadog agent deployed on all ECS tasks. Application logs may contain request metadata but PII scrubbing rules are configured. API keys stored in Secrets Manager (rotation currently disabled). Custom monitors configured for security-relevant events but alert fatigue is a concern.'
    },
    {
      id: 'aws-tp-auth0',
      name: 'Auth0 (Okta)',
      description: 'SaaS identity federation partner providing social login and enterprise SSO integration alongside AWS Cognito. Handles third-party IdP trust assertions for partner tenant authentication flows.',
      category: 'saas',
      status: 'active',
      riskRating: 'high',
      dataClassification: 'confidential',
      linkedAssetIds: ['asset-cognito', 'asset-api-gateway'],
      linkedRiskIds: ['risk-cognito-idp-trust', 'risk-waf-bypass-cdn'],
      contactName: 'James Whitfield',
      contactEmail: 'james.whitfield@auth0.example.com',
      contractExpiry: '2026-11-30',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-08-31',
      notes: 'Enterprise plan with custom domain and private cloud option. Federated trust with Cognito user pool accepts Auth0 assertions without device context validation — identified as a risk in last review. SAML assertion signing verified but token lifetime is set to 24 hours, creating session reuse risk. Breach notification SLA is 72 hours.'
    },
    {
      id: 'aws-tp-snyk',
      name: 'Snyk Ltd.',
      description: 'SaaS developer security platform providing container image scanning for ECS tasks, Lambda dependency analysis, and infrastructure-as-code scanning for CloudFormation templates.',
      category: 'saas',
      status: 'active',
      riskRating: 'low',
      dataClassification: 'internal',
      linkedAssetIds: ['asset-ecs-service', 'asset-lambda-worker'],
      linkedRiskIds: ['risk-lambda-admin-role'],
      contactName: 'Elena Voss',
      contactEmail: 'elena.voss@snyk.example.com',
      contractExpiry: '2026-10-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-07-31',
      notes: 'Business plan with CI/CD integration. Scans container images and Lambda deployment packages for known CVEs. IaC scanning flags overly permissive IAM policies but findings are not yet enforced as deployment gates. Read-only access to source repositories via GitHub App integration. No production data exposure.'
    },
  ],
  securityInitiatives: [
    {
      id: 'aws-si-iam-least-privilege',
      title: 'AWS IAM Least-Privilege Remediation Program',
      description: 'Systematically remediate overprivileged IAM roles across ECS, Lambda, and cross-account trust policies to enforce least-privilege access across the entire AWS SaaS production environment.',
      category: 'remediation' as const,
      status: 'in_progress' as const,
      priority: 'critical' as const,
      owner: 'Cloud Operations',
      executiveSponsor: 'VP of Engineering',
      currentState: 'ECS task role grants wildcard s3:* on all buckets. Lambda execution role retains AdministratorAccess from initial deployment. IAM trust policies use wildcards for cross-account partner access.',
      targetState: 'All compute roles scoped to specific resource ARNs with enumerated actions. No wildcard policies in production. Cross-account trust policies restricted to named principal ARNs.',
      startDate: '2025-05-01',
      targetDate: '2025-08-31',
      completedDate: '',
      milestones: [
        { id: 'aws-ms-ecs-role', title: 'Scope ECS task role to specific S3 buckets', description: 'Replace wildcard s3:* policy with least-privilege actions on named bucket ARNs for the ECS Fargate workers.', status: 'in_progress' as const, dueDate: '2025-06-15', completedDate: '', owner: 'Cloud Operations' },
        { id: 'aws-ms-lambda-role', title: 'Remove Lambda AdministratorAccess', description: 'Enumerate required API calls from CloudTrail logs and build scoped policy for Lambda execution role.', status: 'pending' as const, dueDate: '2025-07-01', completedDate: '', owner: 'Development' },
        { id: 'aws-ms-trust-policies', title: 'Harden cross-account IAM trust policies', description: 'Replace wildcard principal ARNs in trust policies with specific partner account roles.', status: 'pending' as const, dueDate: '2025-08-15', completedDate: '', owner: 'Cloud Operations' },
      ],
      linkedRiskIds: ['risk-ecs-wildcard-s3', 'risk-lambda-admin-role'],
      linkedControlSetIds: [],
      linkedAssetIds: ['asset-ecs-service', 'asset-lambda-worker', 'asset-secrets-mgr'],
      linkedImplementedControlIds: ['aws-ic-access-analyzer'],
      linkedAssessmentIds: ['assessment-aws-saas-review'],
      notes: 'CloudTrail analysis complete for ECS role; 14 required S3 actions identified across 3 buckets. Lambda role analysis in progress.',
      createdAt: NOW,
      updatedAt: NOW
    },
    {
      id: 'aws-si-detection-restoration',
      title: 'AWS Security Detection and Monitoring Restoration',
      description: 'Restore full detection coverage by re-enabling suppressed GuardDuty protections, extending CloudWatch log retention, and establishing automated security finding triage workflows.',
      category: 'uplift' as const,
      status: 'in_progress' as const,
      priority: 'high' as const,
      owner: 'Security Operations',
      executiveSponsor: 'CISO',
      currentState: 'GuardDuty S3 protection disabled. Security Hub suppression rules silence 47 finding types. CloudWatch log retention set to 3 days. No automated triage workflow for security findings.',
      targetState: 'All GuardDuty protections enabled. Suppression rules reviewed and reduced to 5 validated exceptions. CloudWatch retention extended to 90 days. Automated triage via EventBridge and Step Functions.',
      startDate: '2025-05-15',
      targetDate: '2025-08-15',
      completedDate: '',
      milestones: [
        { id: 'aws-ms-guardduty-s3', title: 'Re-enable GuardDuty S3 protection', description: 'Enable GuardDuty S3 protection across all regions and configure finding export to Security Hub.', status: 'completed' as const, dueDate: '2025-06-01', completedDate: '2025-05-28', owner: 'Security Operations' },
        { id: 'aws-ms-suppression-review', title: 'Review and prune Security Hub suppression rules', description: 'Audit all 47 suppression rules and remove overbroad suppressions while documenting valid exceptions.', status: 'in_progress' as const, dueDate: '2025-07-01', completedDate: '', owner: 'Security Operations' },
        { id: 'aws-ms-log-retention', title: 'Extend CloudWatch log retention to 90 days', description: 'Update log group retention policies and configure log archival to S3 for long-term storage.', status: 'pending' as const, dueDate: '2025-07-15', completedDate: '', owner: 'Cloud Operations' },
      ],
      linkedRiskIds: ['risk-guardduty-suppressed'],
      linkedControlSetIds: [],
      linkedAssetIds: ['asset-ecs-service', 'asset-lambda-worker'],
      linkedImplementedControlIds: ['aws-ic-guardduty', 'aws-ic-cloudtrail'],
      linkedAssessmentIds: ['assessment-aws-saas-review'],
      notes: 'GuardDuty S3 protection re-enabled ahead of schedule. Initial triage of suppression rules identified 12 overbroad rules for removal.',
      createdAt: NOW,
      updatedAt: NOW
    },
  ],
  implementedControls: [
    {
      id: 'aws-ic-guardduty',
      title: 'AWS GuardDuty Threat Detection',
      description: 'AWS-native threat detection service providing continuous monitoring for malicious activity and unauthorized behavior across EC2, S3, IAM, and network traffic.',
      controlType: 'technical' as const,
      category: 'monitoring' as const,
      status: 'active' as const,
      automationLevel: 'fully_automated' as const,
      owner: 'Security Operations',
      vendor: 'Amazon Web Services',
      product: 'AWS GuardDuty',
      version: '',
      implementedDate: '2024-03-15',
      lastReviewDate: '2025-05-28',
      nextReviewDate: '2025-11-28',
      linkedSoaEntryIds: ['soa-aws-a09'],
      linkedRiskIds: ['risk-guardduty-suppressed', 'risk-lambda-admin-role'],
      linkedAssetIds: ['asset-ecs-service', 'asset-lambda-worker', 'asset-s3-audit'],
      linkedAssessmentIds: ['assessment-aws-saas-review'],
      notes: 'S3 protection re-enabled May 2025. EKS and RDS protections active. Malware protection for S3 scans enabled. Findings exported to Security Hub with EventBridge automation.',
      createdAt: NOW,
      updatedAt: NOW
    },
    {
      id: 'aws-ic-cloudtrail',
      title: 'AWS CloudTrail Audit Logging',
      description: 'Centralized API activity logging across all AWS accounts and regions with log file integrity validation and S3 delivery with SSE-KMS encryption.',
      controlType: 'technical' as const,
      category: 'logging' as const,
      status: 'active' as const,
      automationLevel: 'fully_automated' as const,
      owner: 'Cloud Operations',
      vendor: 'Amazon Web Services',
      product: 'AWS CloudTrail',
      version: '',
      implementedDate: '2023-06-01',
      lastReviewDate: '2025-04-10',
      nextReviewDate: '2025-10-10',
      linkedSoaEntryIds: ['soa-aws-a09'],
      linkedRiskIds: ['risk-guardduty-suppressed'],
      linkedAssetIds: ['asset-ecs-service', 'asset-lambda-worker', 'asset-secrets-mgr'],
      linkedAssessmentIds: ['assessment-aws-saas-review'],
      notes: 'Organization trail enabled across all member accounts. Data events enabled for S3 and Lambda. Management events in all regions. Log file validation active.',
      createdAt: NOW,
      updatedAt: NOW
    },
    {
      id: 'aws-ic-access-analyzer',
      title: 'AWS IAM Access Analyzer',
      description: 'Continuous analysis of IAM policies and resource-based policies to identify unintended public or cross-account access and overly permissive permissions.',
      controlType: 'technical' as const,
      category: 'access_control' as const,
      status: 'active' as const,
      automationLevel: 'semi_automated' as const,
      owner: 'Cloud Operations',
      vendor: 'Amazon Web Services',
      product: 'AWS IAM Access Analyzer',
      version: '',
      implementedDate: '2024-09-01',
      lastReviewDate: '2025-05-15',
      nextReviewDate: '2025-11-15',
      linkedSoaEntryIds: ['soa-aws-a01', 'soa-aws-a05'],
      linkedRiskIds: ['risk-ecs-wildcard-s3', 'risk-lambda-admin-role', 'risk-s3-audit-public'],
      linkedAssetIds: ['asset-ecs-service', 'asset-lambda-worker', 'asset-s3-audit'],
      linkedAssessmentIds: ['assessment-aws-saas-review'],
      notes: 'External access analyzer active. Unused access analyzer enabled to identify permissions not used in 90 days. Findings for ECS wildcard S3 and Lambda AdminAccess flagged but remediation pending.',
      createdAt: NOW,
      updatedAt: NOW
    },
  ],
});

export const awsCloudExposedWorkloads: ExampleSystem = {
  id: 'aws-cloud-exposed-workloads',
  name: 'AWS Production SaaS with Drifted Controls',
  description: 'Customer-facing AWS SaaS footprint with misaligned identity controls, exposed storage, and noisy operations perimeter.',
  category: 'Cloud Vendor Architectures',
  primaryZone: 'Cloud',
  dataClassification: 'Sensitive',
  customContext: `
## AWS Production SaaS Posture – Hidden Vulnerabilities

This architecture represents a typical AWS SaaS deployment where security controls have quietly drifted:

- **Legacy CDN paths** still bypass the WAF allowing direct API Gateway access when signed cookies are reused.
- **Cognito tenant** trusts third-party IdP assertions without device context, enabling partner account takeover.
- **EC2/ECS task role** has wildcards for S3 access which leaks nightly exports stored in \`s3://app-audit-artifacts\` set to \`public-read\` for troubleshooting.
- **Lambda workers** reuse the default service execution role with AdministratorAccess to simplify deployments.
- **GuardDuty** findings forwarded to Security Hub but suppression rules silence repetitive alerts.
- **CloudTrail** logs stored in S3 bucket with public list permissions enabled during debugging.
- **Config** rules disabled after generating too many compliance alerts for legacy resources.
- **IAM roles** use wildcarded trust policies allowing cross-account access from partner accounts.
- **Secrets Manager** rotation disabled to avoid breaking legacy applications.
- **Operations bastion** shares the same security group as production workloads, eroding blast-radius assumptions.

Use this model to explore chained misconfigurations, IAM privilege escalation paths, and data exfiltration risks that often hide in "almost compliant" environments.
`,
  nodes: [
    // Internet Zone
    {
      id: 'internet-zone',
      type: 'securityZone',
      position: { x: 50, y: 50 },
      data: {
        label: 'Internet',
        zoneType: 'Internet' as SecurityZone,
        description: 'External customers, partners, and automated scanners'
      },
      style: {
        width: 600,
        height: 900,
        background: colors.zoneBackgrounds.Internet,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'external-users',
      type: 'user',
      position: { x: 225, y: 325 },
      data: {
        label: 'Customer Users',
        description: 'Browser and mobile clients consuming the SaaS portal',
        zone: 'Internet' as SecurityZone,
        dataClassification: 'Public'
      }
    } as SecurityNode,
    {
      id: 'integration-partner',
      type: 'user',
      position: { x: 475, y: 525 },
      data: {
        label: 'Partner Automation',
        description: 'B2B integrator using persistent API keys with limited monitoring',
        zone: 'Internet' as SecurityZone,
        dataClassification: 'Public'
      }
    } as SecurityNode,

    // DMZ Zone
    {
      id: 'dmz-zone',
      type: 'securityZone',
      position: { x: 700, y: 50 },
      data: {
        label: 'AWS Edge DMZ',
        zoneType: 'DMZ' as SecurityZone,
        description: 'Ingress services terminating TLS and routing traffic into the VPC'
      },
      style: {
        width: 900,
        height: 900,
        background: colors.zoneBackgrounds.DMZ,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'cloudfront-edge',
      type: 'awsCloudFront',
      position: { x: 775, y: 325 },
      data: {
        label: 'CloudFront Edge',
        description: 'Caches static content; legacy signed-cookie path bypasses WAF for some tenants',
        zone: 'DMZ' as SecurityZone,
        dataClassification: 'Public',
        securityContext: {
          summary: 'Legacy origins allow direct access to API Gateway without WAF inspection when signed cookies are reused.'
        }
      }
    } as SecurityNode,
    {
      id: 'edge-waf',
      type: 'awsWAF',
      position: { x: 925, y: 175 },
      data: {
        label: 'AWS WAF',
        description: 'Managed rule sets; custom rules disabled after false positives',
        zone: 'DMZ' as SecurityZone,
        dataClassification: 'Internal',
        securityContext: {
          summary: 'Outdated managed rule set—recent SSRF signatures not deployed; threat intelligence feed disabled for cost savings.'
        }
      }
    } as SecurityNode,
    {
      id: 'api-gateway',
      type: 'awsAPIGateway',
      position: { x: 1225, y: 175 },
      data: {
        label: 'API Gateway',
        description: 'Primary entry for REST APIs; mutual TLS optional for partner traffic',
        zone: 'DMZ' as SecurityZone,
        dataClassification: 'Internal',
        securityContext: {
          summary: 'Permits legacy usage plans without throttling; partner API keys allow 24h replay.'
        }
      }
    } as SecurityNode,
    {
      id: 'cognito-idp',
      type: 'awsCognito',
      position: { x: 975, y: 425 },
      data: {
        label: 'Cognito User Pool',
        description: 'Federates with partner IdP; device trust disabled for rapid onboarding',
        zone: 'DMZ' as SecurityZone,
        dataClassification: 'Internal',
        securityContext: {
          summary: 'Accepts SAML assertions without checking audience restrictions; refresh tokens valid for 30 days.'
        }
      }
    } as SecurityNode,

    // Cloud Zone
    {
      id: 'cloud-zone',
      type: 'securityZone',
      position: { x: 1640, y: 50 },
      data: {
        label: 'AWS Production VPC',
        zoneType: 'Cloud' as SecurityZone,
        description: 'Application tier, stateless workers, and multi-tenant data stores'
      },
      style: {
        width: 950,
        height: 900,
        background: colors.zoneBackgrounds.Cloud,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'ecs-service',
      type: 'awsECS',
      position: { x: 1725, y: 425 },
      data: {
        label: 'ECS Fargate',
        description: 'Multi-tenant REST workers with permissive task role to simplify deployments',
        zone: 'Cloud' as SecurityZone,
        dataClassification: 'Sensitive',
        securityContext: {
          summary: 'Task role wildcard `s3:*` on all buckets; container image built from mutable :latest tag.'
        }
      }
    } as SecurityNode,
    {
      id: 'lambda-worker',
      type: 'awsLambda',
      position: { x: 1875, y: 175 },
      data: {
        label: 'Lambda Workers',
        description: 'Processes partner ingestion jobs; uses default service execution role',
        zone: 'Cloud' as SecurityZone,
        dataClassification: 'Sensitive',
        securityContext: {
          summary: 'Execution role retains AdministratorAccess from initial deployment; environment variables contain plaintext Slack webhook.'
        }
      }
    } as SecurityNode,
    {
      id: 'elasticache',
      type: 'awsElastiCache',
      position: { x: 2075, y: 175 },
      data: {
        label: 'ElastiCache Redis',
        description: 'Session cache shared across tenants without key prefix isolation',
        zone: 'Cloud' as SecurityZone,
        dataClassification: 'Sensitive',
        securityContext: {
          summary: 'AUTH disabled; relies on VPC security group alone.'
        }
      }
    } as SecurityNode,
    {
      id: 'rds-cluster',
      type: 'awsRDS',
      position: { x: 1725, y: 675 },
      data: {
        label: 'Aurora PostgreSQL',
        description: 'Primary tenant data store with read replica in another region',
        zone: 'Cloud' as SecurityZone,
        dataClassification: 'Confidential',
        securityContext: {
          summary: 'Database encryption enabled but cross-region replica uses IAM auth tokens shared via SSM Parameter with broad access.'
        }
      }
    } as SecurityNode,
    {
      id: 's3-audit-bucket',
      type: 'awsS3',
      position: { x: 1925, y: 675 },
      data: {
        label: 'S3 Audit Exports',
        description: 'Stores nightly CSV exports for customer success team',
        zone: 'Cloud' as SecurityZone,
        dataClassification: 'Sensitive',
        securityContext: {
          summary: 'Bucket policy grants `s3:GetObject` to `*` for troubleshooting; objects tagged as "temporary" but never lifecycle archived.'
        }
      }
    } as SecurityNode,
    {
      id: 'dynamo-session',
      type: 'awsDynamoDB',
      position: { x: 2225, y: 75 },
      data: {
        label: 'DynamoDB Sessions',
        description: 'Tracks login state and MFA bypass tokens',
        zone: 'Cloud' as SecurityZone,
        dataClassification: 'Sensitive',
        securityContext: {
          summary: 'Point-in-time recovery disabled to save costs; stale bypass tokens remain for weeks.'
        }
      }
    } as SecurityNode,

    // Management Zone
    {
      id: 'ops-zone',
      type: 'securityZone',
      position: { x: 2600, y: 50 },
      data: {
        label: 'Operations & Security',
        zoneType: 'Management' as SecurityZone,
        description: 'Identity, security monitoring, and privileged access management'
      },
      style: {
        width: 950,
        height: 900,
        background: colors.zoneBackgrounds.Management,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'aws-iam',
      type: 'awsIAM',
      position: { x: 2775, y: 125 },
      data: {
        label: 'IAM Identity Center',
        description: 'Centralized identity with cross-account access from partner accounts',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Confidential',
        securityContext: {
          summary: 'Trust policies use wildcards allowing partner account access; session duration 12h without re-authentication.'
        }
      }
    } as SecurityNode,
    {
      id: 'aws-sso',
      type: 'awsSSO',
      position: { x: 3225, y: 125 },
      data: {
        label: 'AWS SSO',
        description: 'Single sign-on for admin console access',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Confidential',
        securityContext: {
          summary: 'Break-glass role bypasses MFA; emergency credentials shared via password manager.'
        }
      }
    } as SecurityNode,
    {
      id: 'secrets-manager',
      type: 'awsSecretsManager',
      position: { x: 3375, y: 125 },
      data: {
        label: 'Secrets Manager',
        description: 'Stores database credentials and API keys',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Confidential',
        securityContext: {
          summary: 'Automatic rotation disabled to avoid breaking legacy apps; resource policies allow broad GetSecretValue.'
        }
      }
    } as SecurityNode,
    {
      id: 'guardduty',
      type: 'awsGuardDuty',
      position: { x: 2875, y: 425 },
      data: {
        label: 'GuardDuty',
        description: 'Threat detection analyzing VPC flow logs and CloudTrail',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Sensitive',
        securityContext: {
          summary: 'S3 protection disabled; findings forwarded to Security Hub but many suppressed.'
        }
      }
    } as SecurityNode,
    {
      id: 'security-hub',
      type: 'awsSecurityHub',
      position: { x: 3025, y: 275 },
      data: {
        label: 'Security Hub',
        description: 'Central findings dashboard with auto-remediation disabled',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Sensitive',
        securityContext: {
          summary: 'Findings suppressed via custom insight rules; no ticketing integration after staff turnover.'
        }
      }
    } as SecurityNode,
    {
      id: 'config',
      type: 'awsConfig',
      position: { x: 3375, y: 275 },
      data: {
        label: 'AWS Config',
        description: 'Compliance monitoring and resource configuration tracking',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Sensitive',
        securityContext: {
          summary: 'Rules disabled after generating excessive alerts; conformance packs not applied to legacy resources.'
        }
      }
    } as SecurityNode,
    {
      id: 'cloudtrail',
      type: 'awsCloudTrail',
      position: { x: 2775, y: 425 },
      data: {
        label: 'CloudTrail',
        description: 'API audit logging to S3 with CloudWatch integration',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Sensitive',
        securityContext: {
          summary: 'Log bucket allows public list access enabled during debugging; log file validation disabled.'
        }
      }
    } as SecurityNode,
    {
      id: 'cloudwatch',
      type: 'awsCloudWatch',
      position: { x: 3175, y: 425 },
      data: {
        label: 'CloudWatch',
        description: 'Metrics and log aggregation with retention limits',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Sensitive',
        securityContext: {
          summary: 'Log retention reduced to 3 days; subscription filters throttled leaving gaps for GuardDuty.'
        }
      }
    } as SecurityNode,
    {
      id: 'macie',
      type: 'awsMacie',
      position: { x: 3375, y: 425 },
      data: {
        label: 'Macie',
        description: 'Data security and privacy monitoring for S3',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Sensitive',
        securityContext: {
          summary: 'Automated discovery jobs paused to reduce costs; sensitive data findings unreviewed.'
        }
      }
    } as SecurityNode,
    {
      id: 'jump-bastion',
      type: 'bastionHost',
      position: { x: 2775, y: 575 },
      data: {
        label: 'Bastion Host',
        description: 'SSM-managed EC2 instance reachable via corporate VPN',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Internal',
        securityContext: {
          summary: 'Shares security group with production ECS tasks; stale local admin accounts remain for contractors.'
        }
      }
    } as SecurityNode
  ],
  edges: [
    // Internet to DMZ
    {
      id: 'e1',
      source: 'external-users',
      target: 'cloudfront-edge',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'HTTPS',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Public',
        zone: 'DMZ' as SecurityZone,
        animated: true,
        notes: 'Legacy signed-cookie paths allow WAF bypass'
      }
    } as SecurityEdge,
    {
      id: 'e2',
      source: 'integration-partner',
      target: 'api-gateway',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'API Keys',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Low',
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone,
        notes: 'API keys shared via email; no IP restrictions',
        controlPoints: [{ id: 'cp2', x: 1250, y: 550 }]
      }
    } as SecurityEdge,

    // DMZ internal flow
    {
      id: 'e3',
      source: 'cloudfront-edge',
      target: 'edge-waf',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Origin Traffic',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e4',
      source: 'edge-waf',
      target: 'api-gateway',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Filtered',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e5',
      source: 'cognito-idp',
      target: 'api-gateway',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Auth Tokens',
        protocol: 'OIDC',
        encryption: 'JWT',
        securityLevel: 'Low',
        dataClassification: 'Sensitive',
        zone: 'DMZ' as SecurityZone,
        notes: 'No device fingerprint validation'
      }
    } as SecurityEdge,

    // DMZ to Cloud
    {
      id: 'e6',
      source: 'api-gateway',
      target: 'ecs-service',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'REST',
        protocol: 'HTTPS',
        encryption: 'mTLS optional',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e7',
      source: 'api-gateway',
      target: 'lambda-worker',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Async',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,

    // Cloud internal
    {
      id: 'e8',
      source: 'ecs-service',
      target: 'elasticache',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Cache',
        protocol: 'Redis',
        encryption: 'None',
        securityLevel: 'Low',
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone,
        notes: 'AUTH disabled',
        controlPoints: [{ id: 'cp-e8', x: 2050, y: 300 }]
      }
    } as SecurityEdge,
    {
      id: 'e9',
      source: 'ecs-service',
      target: 'rds-cluster',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Queries',
        protocol: 'PostgreSQL',
        encryption: 'TLS 1.2',
        securityLevel: 'High',
        dataClassification: 'Confidential',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e10',
      source: 'ecs-service',
      target: 's3-audit-bucket',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Exports',
        protocol: 'S3 API',
        encryption: 'SSE-S3',
        securityLevel: 'Low',
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone,
        notes: 'Public-read ACL'
      }
    } as SecurityEdge,
    {
      id: 'e11',
      source: 'lambda-worker',
      target: 'dynamo-session',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Sessions',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,

    // Cloud to Management
    {
      id: 'e12',
      source: 'ecs-service',
      target: 'cloudwatch',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Logs',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Management' as SecurityZone,
        controlPoints: [{ id: 'cp-e12a', x: 2300, y: 450 }, { id: 'cp4', x: 2700, y: 550 }, { id: 'cp-e12b', x: 3100, y: 550 }]
      }
    } as SecurityEdge,
    {
      id: 'e13',
      source: 'lambda-worker',
      target: 'secrets-manager',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Get Secret',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'High',
        dataClassification: 'Confidential',
        zone: 'Management' as SecurityZone,
        controlPoints: [{ id: 'cp5', x: 2000, y: 250 }, { id: 'cp-e13a', x: 3250, y: 250 }]
      }
    } as SecurityEdge,

    // Management internal
    {
      id: 'e14',
      source: 'guardduty',
      target: 'security-hub',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Findings',
        protocol: 'EventBridge',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Management' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e15',
      source: 'config',
      target: 'security-hub',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Compliance',
        protocol: 'EventBridge',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Management' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e16',
      source: 'cloudwatch',
      target: 'guardduty',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Log Events',
        protocol: 'Kinesis',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Management' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e17',
      source: 's3-audit-bucket',
      target: 'macie',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Discovery',
        protocol: 'S3 API',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Management' as SecurityZone,
        controlPoints: [{ id: 'cp6', x: 3400, y: 700 }]
      }
    } as SecurityEdge,
    {
      id: 'e18',
      source: 'aws-iam',
      target: 'jump-bastion',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'SSO',
        protocol: 'SSH via SSM',
        encryption: 'AES-256',
        securityLevel: 'Medium',
        dataClassification: 'Internal',
        zone: 'Management' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e19',
      source: 'jump-bastion',
      target: 'ecs-service',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Admin SSH',
        protocol: 'SSH',
        encryption: 'AES-256',
        securityLevel: 'Low',
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone,
        notes: 'Shared security group',
        controlPoints: [{ id: 'cp7', x: 2600, y: 600 }, { id: 'cp8', x: 2100, y: 550 }]
      }
    } as SecurityEdge,

    // CloudTrail monitoring
    {
      id: 'e20',
      source: 'aws-iam',
      target: 'cloudtrail',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'API Audit',
        protocol: 'CloudTrail',
        encryption: 'TLS 1.2',
        securityLevel: 'High',
        dataClassification: 'Sensitive',
        zone: 'Management' as SecurityZone,
        controlPoints: [{ id: 'cp-e20a', x: 2650, y: 300 }, { id: 'cp9', x: 2650, y: 400 }]
      }
    } as SecurityEdge,
    {
      id: 'eaws-sso-aws-iam-left-right',
      source: 'aws-sso',
      target: 'aws-iam',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'SSO Federation',
        protocol: 'SAML/OIDC',
        encryption: 'TLS 1.2',
        securityLevel: 'High',
        dataClassification: 'Confidential',
        zone: 'Management' as SecurityZone
      }
    } as SecurityEdge
  ],
  grcWorkspace: awsCloudExposedWorkloadsGrcWorkspace,
  attackPaths: [
    {
      id: 'ap-partner-waf-bypass-lambda',
      name: 'Partner WAF Bypass → Lambda Privilege Escalation',
      strideCategory: 'Elevation of Privilege',
      riskLevel: 'Critical',
      description: 'Partner automation bypasses WAF via direct API Gateway path using replayable API keys, invokes Lambda workers that retain AdministratorAccess, then retrieves all secrets from Secrets Manager for full AWS account takeover.',
      steps: [
        { order: 1, edgeId: 'e2', sourceNodeId: 'integration-partner', targetNodeId: 'api-gateway', technique: 'T1190: Exploit Public-Facing Application' },
        { order: 2, edgeId: 'e7', sourceNodeId: 'api-gateway', targetNodeId: 'lambda-worker', technique: 'T1078: Valid Accounts' },
        { order: 3, edgeId: 'e13', sourceNodeId: 'lambda-worker', targetNodeId: 'secrets-manager', technique: 'T1552: Unsecured Credentials' },
      ],
      mitreTechniques: ['T1190', 'T1078', 'T1552'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-ecs-s3-exfil',
      name: 'ECS Task Role Abuse → S3 Data Exfiltration',
      strideCategory: 'Information Disclosure',
      riskLevel: 'Critical',
      description: 'Attacker exploits application vulnerability in ECS Fargate via API Gateway, leverages the wildcard S3 task role to enumerate and download all objects from the public-read audit bucket containing sensitive tenant export data.',
      steps: [
        { order: 1, edgeId: 'e6', sourceNodeId: 'api-gateway', targetNodeId: 'ecs-service', technique: 'T1190: Exploit Public-Facing Application' },
        { order: 2, edgeId: 'e10', sourceNodeId: 'ecs-service', targetNodeId: 's3-audit-bucket', technique: 'T1530: Data from Cloud Storage' },
      ],
      mitreTechniques: ['T1190', 'T1530'],
      createdAt: '2025-06-01T00:05:00.000Z',
      updatedAt: '2025-06-01T00:05:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-bastion-lateral',
      name: 'Bastion Shared SG → Production Lateral Movement',
      strideCategory: 'Tampering',
      riskLevel: 'High',
      description: 'Attacker compromises bastion host via stale contractor account, leverages the shared security group to SSH directly into production ECS tasks, then pivots to Aurora PostgreSQL for tenant data tampering or exfiltration.',
      steps: [
        { order: 1, edgeId: 'e19', sourceNodeId: 'jump-bastion', targetNodeId: 'ecs-service', technique: 'T1021: Remote Services' },
        { order: 2, edgeId: 'e9', sourceNodeId: 'ecs-service', targetNodeId: 'rds-cluster', technique: 'T1078: Valid Accounts' },
      ],
      mitreTechniques: ['T1021', 'T1078'],
      createdAt: '2025-06-01T00:10:00.000Z',
      updatedAt: '2025-06-01T00:10:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-cdn-waf-bypass-db',
      name: 'Legacy CDN Path → WAF Bypass → Database Access',
      strideCategory: 'Information Disclosure',
      riskLevel: 'High',
      description: 'Customer with reused signed cookies hits CloudFront legacy origin that bypasses WAF, reaches API Gateway directly, then exploits ECS application to access Aurora PostgreSQL and exfiltrate multi-tenant data.',
      steps: [
        { order: 1, edgeId: 'e1', sourceNodeId: 'external-users', targetNodeId: 'cloudfront-edge', technique: 'T1595: Active Scanning' },
        { order: 2, edgeId: 'e3', sourceNodeId: 'cloudfront-edge', targetNodeId: 'edge-waf', technique: 'T1190: Exploit Public-Facing Application' },
        { order: 3, edgeId: 'e4', sourceNodeId: 'edge-waf', targetNodeId: 'api-gateway', technique: 'T1071: Application Layer Protocol' },
        { order: 4, edgeId: 'e6', sourceNodeId: 'api-gateway', targetNodeId: 'ecs-service', technique: 'T1059: Command and Scripting Interpreter' },
        { order: 5, edgeId: 'e9', sourceNodeId: 'ecs-service', targetNodeId: 'rds-cluster', technique: 'T1005: Data from Local System' },
      ],
      mitreTechniques: ['T1595', 'T1190', 'T1071', 'T1059', 'T1005'],
      createdAt: '2025-06-01T00:15:00.000Z',
      updatedAt: '2025-06-01T00:15:00.000Z',
    } as DiagramAttackPath,
  ],
};
