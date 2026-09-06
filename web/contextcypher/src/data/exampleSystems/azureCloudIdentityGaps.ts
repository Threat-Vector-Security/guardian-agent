import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityEdge, SecurityNode, SecurityZone } from '../../types/SecurityTypes';
import { DiagramAttackPath, AssessmentThreatModelNodeSourceType, AssessmentThreatModelEdgeSourceType, AttackPathRiskLevel, GrcWorkspace } from '../../types/GrcTypes';
import { colors } from '../../styles/Theme';
import { buildGrcWorkspace, score, NOW, OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID } from './grcSharedBase';
import { StrideCategory } from '../../types/ThreatIntelTypes';

const tierCatalogue = [
  { id: 'tier1-cyber', tier: 1 as const, label: 'Cyber Risk', description: 'Information security and cyber threats' },
  { id: 'tier1-operational', tier: 1 as const, label: 'Operational Risk', description: 'Business operations and process risks' },
  { id: 'tier2-identity', tier: 2 as const, label: 'Identity & Access', parentId: 'tier1-cyber', description: 'Authentication, authorization, and identity lifecycle controls' },
  { id: 'tier2-cloud-config', tier: 2 as const, label: 'Cloud Configuration', parentId: 'tier1-cyber', description: 'Cloud resource misconfiguration and drift' },
  { id: 'tier2-data', tier: 2 as const, label: 'Data Protection', parentId: 'tier1-cyber', description: 'Data-at-rest and data-in-transit protection' },
  { id: 'tier2-network', tier: 2 as const, label: 'Network Security', parentId: 'tier1-cyber', description: 'Network segmentation and perimeter controls' },
  { id: 'tier2-monitoring', tier: 2 as const, label: 'Security Monitoring', parentId: 'tier1-operational', description: 'Logging, detection, and incident response' },
  { id: 'tier2-governance', tier: 2 as const, label: 'Policy & Governance', parentId: 'tier1-operational', description: 'Policy enforcement and compliance controls' },
  { id: 'tier3-conditional-access', tier: 3 as const, label: 'Conditional Access Gaps', parentId: 'tier2-identity' },
  { id: 'tier3-overprivileged-identity', tier: 3 as const, label: 'Over-Privileged Managed Identity', parentId: 'tier2-identity' },
  { id: 'tier3-keyvault-exposure', tier: 3 as const, label: 'Key Vault Public Exposure', parentId: 'tier2-cloud-config' },
  { id: 'tier3-storage-shared-key', tier: 3 as const, label: 'Storage Shared Key Access', parentId: 'tier2-data' },
  { id: 'tier3-waf-detection', tier: 3 as const, label: 'WAF Detection-Only Mode', parentId: 'tier2-network' },
  { id: 'tier3-log-throttle', tier: 3 as const, label: 'Log Ingestion Throttling', parentId: 'tier2-monitoring' },
  { id: 'tier3-policy-exclusion', tier: 3 as const, label: 'Policy Assignment Exclusions', parentId: 'tier2-governance' },
];

const assets = [
  {
    id: 'asset-azure-ad-b2c', name: 'Azure AD B2C', type: 'identity_provider', owner: 'Identity & Access Management',
    domain: 'it' as const, category: 'Identity',
    businessCriticality: 5, securityCriticality: 5,
    description: 'External identity provider managing customer and field engineer authentication with conditional access policies',
    criticality: { confidentiality: 5, integrity: 5, availability: 4, financial: 4, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'azure-cloud-identity-gaps', nodeId: 'azure-b2c', nodeLabel: 'Azure AD B2C', nodeType: 'azureADB2C' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-managed-identity', name: 'Azure Managed Identities', type: 'service_account', owner: 'Platform Engineering',
    domain: 'it' as const, category: 'Identity',
    businessCriticality: 5, securityCriticality: 5,
    description: 'System and user-assigned managed identities with Contributor role on the subscription',
    criticality: { confidentiality: 5, integrity: 5, availability: 5, financial: 5, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'azure-cloud-identity-gaps', nodeId: 'managed-identity', nodeLabel: 'Managed Identities', nodeType: 'azureManagedIdentity' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-keyvault', name: 'Azure Key Vault', type: 'secrets_manager', owner: 'Security Operations',
    domain: 'it' as const, category: 'Cloud Infrastructure',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Stores connection strings and Cosmos DB master keys; firewall allows public network access',
    criticality: { confidentiality: 5, integrity: 5, availability: 4, financial: 5, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'azure-cloud-identity-gaps', nodeId: 'azure-keyvault', nodeLabel: 'Key Vault', nodeType: 'azureKeyVault' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-app-service', name: 'Azure App Service', type: 'application_server', owner: 'Development',
    domain: 'application' as const, category: 'Cloud Compute',
    businessCriticality: 5, securityCriticality: 4,
    description: 'Customer portal container with managed identity holding Contributor role; deployment slots share production secrets',
    criticality: { confidentiality: 4, integrity: 5, availability: 5, financial: 5, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'azure-cloud-identity-gaps', nodeId: 'azure-app-service', nodeLabel: 'App Service', nodeType: 'azureAppService' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-blob-storage', name: 'Azure Blob Storage', type: 'cloud_storage', owner: 'Data Engineering',
    domain: 'it' as const, category: 'Cloud Storage',
    businessCriticality: 4, securityCriticality: 4,
    description: 'Landing zone for CSV extracts; shared key access enabled with public container listing',
    criticality: { confidentiality: 4, integrity: 3, availability: 3, financial: 3, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'azure-cloud-identity-gaps', nodeId: 'azure-storage', nodeLabel: 'Blob Storage', nodeType: 'azureBlobStorage' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-sentinel', name: 'Microsoft Sentinel', type: 'security_tool', owner: 'Security Operations',
    domain: 'it' as const, category: 'Security Tools',
    businessCriticality: 4, securityCriticality: 4,
    description: 'Cloud-native SIEM dependent on throttled Log Analytics workspace; playbooks not configured',
    criticality: { confidentiality: 3, integrity: 4, availability: 4, financial: 2, reputation: 3, safety: 1 },
    diagramRefs: [{ diagramId: 'azure-cloud-identity-gaps', nodeId: 'sentinel', nodeLabel: 'Sentinel', nodeType: 'azureSentinel' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-azure-waf', name: 'Azure WAF', type: 'security_control', owner: 'Network Security',
    domain: 'it' as const, category: 'Network Security',
    businessCriticality: 4, securityCriticality: 4,
    description: 'Web application firewall in detection-only mode with no bot protection',
    criticality: { confidentiality: 2, integrity: 4, availability: 4, financial: 3, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'azure-cloud-identity-gaps', nodeId: 'azure-waf', nodeLabel: 'Azure WAF', nodeType: 'waf' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-sql-database', name: 'Azure SQL Database', type: 'database', owner: 'Database Administration',
    domain: 'application' as const, category: 'Database',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Primary transactional store with geo-replication; firewall allows any Azure service',
    criticality: { confidentiality: 5, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'azure-cloud-identity-gaps', nodeId: 'azure-sql', nodeLabel: 'SQL Database', nodeType: 'azureSQLDatabase' }],
    createdAt: NOW, updatedAt: NOW
  },
];

const risks = [
  {
    id: 'risk-conditional-access-gap', title: 'Conditional Access Exclusion for Field Engineers',
    description: 'Azure AD B2C conditional access policies exclude the Field Engineering group, allowing legacy BYOD devices to authenticate without compliant device posture or enforced MFA.',
    status: 'assessed' as const, owner: 'Identity & Access Management',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Identity & Access', tier3: 'Conditional Access Gaps' },
    assetIds: ['asset-azure-ad-b2c'],
    diagramLinks: [{ diagramId: 'azure-cloud-identity-gaps', nodeIds: ['azure-b2c', 'field-engineers'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Remove field engineer group exclusion; enforce device compliance and MFA for all external identities',
    threatActorIds: ['threat-actor-initial-access-broker'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-overprivileged-managed-identity', title: 'Managed Identity with Subscription Contributor Role',
    description: 'User-assigned managed identity has Contributor role at subscription scope, granting excessive permissions to create, modify, or delete any resource in the subscription.',
    status: 'assessed' as const, owner: 'Platform Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Identity & Access', tier3: 'Over-Privileged Managed Identity' },
    assetIds: ['asset-managed-identity', 'asset-app-service'],
    diagramLinks: [{ diagramId: 'azure-cloud-identity-gaps', nodeIds: ['managed-identity', 'azure-app-service'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Scope managed identity to resource-group level with least-privilege custom roles',
    threatActorIds: ['threat-actor-cloud-adversary'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-keyvault-public-access', title: 'Key Vault Firewall Open to Public Internet',
    description: 'Key Vault network firewall allows 0.0.0.0/0 for automation scripts and was never reverted. Soft-delete is disabled, meaning deleted secrets cannot be recovered.',
    status: 'draft' as const, owner: 'Security Operations',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Cloud Configuration', tier3: 'Key Vault Public Exposure' },
    assetIds: ['asset-keyvault'],
    diagramLinks: [{ diagramId: 'azure-cloud-identity-gaps', nodeIds: ['azure-keyvault'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Restrict Key Vault firewall to VNet service endpoints and private endpoints; enable soft-delete and purge protection',
    threatActorIds: ['threat-actor-cloud-adversary'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-storage-shared-key', title: 'Blob Storage with Shared Key and Public Listing',
    description: 'Storage account allows shared key authentication for data science exports. Containers are configured with public listing for debugging, exposing sensitive CSV extracts.',
    status: 'assessed' as const, owner: 'Data Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Data Protection', tier3: 'Storage Shared Key Access' },
    assetIds: ['asset-blob-storage'],
    diagramLinks: [{ diagramId: 'azure-cloud-identity-gaps', nodeIds: ['azure-storage'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Disable shared key access; enforce Azure AD RBAC authentication; remove public container listing',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-waf-detection-mode', title: 'Azure WAF in Detection-Only Mode',
    description: 'Azure WAF is configured in detection mode with no bot protection to reduce costs. Malicious requests are logged but not blocked.',
    status: 'assessed' as const, owner: 'Network Security',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Network Security', tier3: 'WAF Detection-Only Mode' },
    assetIds: ['asset-azure-waf'],
    diagramLinks: [{ diagramId: 'azure-cloud-identity-gaps', nodeIds: ['azure-waf', 'azure-frontdoor'] }],
    inherentScore: score('likelihood-4', 'impact-3'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Switch WAF to prevention mode; tune managed rulesets to reduce false positives; enable bot protection',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-log-throttling', title: 'Log Analytics Ingestion Throttled During Incidents',
    description: 'Log Analytics workspace has a 50 GB/day data cap. During incident spikes, ingestion stops, causing Sentinel to lose visibility at the worst possible time.',
    status: 'draft' as const, owner: 'Security Operations',
    tierPath: { tier1: 'Operational Risk', tier2: 'Security Monitoring', tier3: 'Log Ingestion Throttling' },
    assetIds: ['asset-sentinel'],
    diagramLinks: [{ diagramId: 'azure-cloud-identity-gaps', nodeIds: ['log-analytics', 'sentinel'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Remove or raise daily data cap; implement tiered data collection with priority-based ingestion',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-policy-exclusions', title: 'Azure Policy Assignments Exclude Management Groups',
    description: 'Policy assignments exclude management groups to avoid breaking legacy deployments. Audit-only mode means non-compliant resources are logged but not denied.',
    status: 'assessed' as const, owner: 'Cloud Governance',
    tierPath: { tier1: 'Operational Risk', tier2: 'Policy & Governance', tier3: 'Policy Assignment Exclusions' },
    assetIds: ['asset-app-service', 'asset-blob-storage'],
    diagramLinks: [{ diagramId: 'azure-cloud-identity-gaps', nodeIds: ['azure-policy', 'defender'] }],
    inherentScore: score('likelihood-3', 'impact-3'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Migrate legacy resources to compliant configurations; remove policy exclusions incrementally; switch to deny effect',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-unencrypted-east-west', title: 'Unencrypted East-West Traffic Between App Service and AKS',
    description: 'Traffic between App Service and AKS cluster uses plain HTTP without mTLS. Network policy is disabled on the AKS cluster, allowing unrestricted pod-to-pod communication.',
    status: 'draft' as const, owner: 'Platform Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Network Security', tier3: 'WAF Detection-Only Mode' },
    assetIds: ['asset-app-service'],
    diagramLinks: [{ diagramId: 'azure-cloud-identity-gaps', nodeIds: ['azure-app-service', 'azure-aks'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Enable mTLS service mesh; enforce Kubernetes network policies to restrict pod communication',
    createdAt: NOW, updatedAt: NOW
  },
];

const assessments = [
  {
    id: 'assessment-azure-identity-drift', title: 'Azure Identity & Configuration Drift Assessment',
    status: 'in_review' as const,
    owner: 'Cloud Security Architecture',
    reviewer: 'CISO',
    startDate: '2025-05-15',
    dueDate: '2025-07-15',
    threatActorIds: ['threat-actor-initial-access-broker', 'threat-actor-cloud-adversary', 'threat-actor-insider-engineer'],
    methodologyNote: 'Assessment follows CIS Azure Foundations Benchmark with STRIDE threat modelling and OWASP Top 10 control mapping.',
    assumptionNote: 'Assessment assumes current production configuration as of June 2025. Non-production subscriptions excluded from scope.',
    scopeItems: [
      { id: 'scope-system-azure', type: 'system' as const, value: 'system', name: 'Azure Customer Hub' },
      { id: 'scope-zone-cloud', type: 'diagram_segment' as const, value: 'Cloud', name: 'Azure Production' },
      { id: 'scope-zone-mgmt', type: 'diagram_segment' as const, value: 'Management', name: 'Operations & Security' },
    ],
    tierFilter: { tier1: 'Cyber Risk' },
    riskManagementPlan: {
      objective: 'Eliminate over-privileged identities and close configuration drift gaps across identity, storage, and monitoring controls.',
      strategy: 'Prioritize identity least-privilege enforcement, then harden exposed secrets management and improve monitoring resilience.',
      residualRiskStatement: 'Residual risk accepted only for policy audit-mode items where legacy migration is tracked.',
      monitoringApproach: 'Bi-weekly review of open actions; Defender for Cloud secure score tracking.',
      communicationPlan: 'Report progress to Cloud Security Steering Committee every two weeks.',
      reviewCadenceDays: 14,
      actions: [
        {
          id: 'rmp-action-scope-identity',
          title: 'Scope managed identity to resource-group with custom RBAC roles',
          owner: 'Platform Engineering',
          dueDate: '2025-06-30',
          status: 'in_progress' as const,
          linkedRiskIds: ['risk-overprivileged-managed-identity'],
          notes: 'Custom role definition drafted; testing on staging subscription'
        },
        {
          id: 'rmp-action-keyvault-firewall',
          title: 'Restrict Key Vault firewall and enable soft-delete',
          owner: 'Security Operations',
          dueDate: '2025-06-15',
          status: 'planned' as const,
          linkedRiskIds: ['risk-keyvault-public-access'],
          notes: 'Private endpoint deployment planned for sprint 12'
        },
        {
          id: 'rmp-action-conditional-access',
          title: 'Enforce conditional access for field engineer group',
          owner: 'Identity & Access Management',
          dueDate: '2025-06-20',
          status: 'in_progress' as const,
          linkedRiskIds: ['risk-conditional-access-gap'],
          notes: 'Device compliance policy being rolled out to field devices'
        },
        {
          id: 'rmp-action-log-cap',
          title: 'Remove Log Analytics daily cap and implement tiered ingestion',
          owner: 'Security Operations',
          dueDate: '2025-07-01',
          status: 'planned' as const,
          linkedRiskIds: ['risk-log-throttling'],
          notes: ''
        },
      ],
      updatedAt: NOW
    },
    riskIds: risks.map(r => r.id),
    soaGapIds: ['soa-az-a01', 'soa-az-a05', 'soa-az-a07'],
    taskIds: ['task-identity-scoping', 'task-keyvault-hardening', 'task-waf-mode-switch'],
    linkedImplementedControlIds: [],
    linkedInitiativeIds: [],
    summary: 'Assessment of Azure identity and configuration drift across the multi-tenant SaaS environment. Identified 8 risks spanning identity over-privilege, secrets exposure, and monitoring blind spots.',
    findings: 'Key findings include a subscription-scoped Contributor managed identity, publicly accessible Key Vault, conditional access exclusions for field engineers, and throttled SIEM ingestion.',
    recommendations: 'Enforce least-privilege RBAC, restrict Key Vault to private endpoints, remove conditional access exclusions, and remove Log Analytics daily cap.',
    evidenceSummary: 'Evidence includes Defender for Cloud secure score exports, Azure Policy compliance snapshots, and Key Vault diagnostic logs.',
    threatModel: {
      nodes: [
        { id: 'tm-node-field', label: 'Field Engineers', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'field-engineers', position: { x: 50, y: 150 }, nodeType: 'user', commentary: 'Excluded from conditional access; MFA optional' },
        { id: 'tm-node-b2c', label: 'Azure AD B2C', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'azure-b2c', position: { x: 250, y: 150 }, nodeType: 'azureADB2C' },
        { id: 'tm-node-waf', label: 'Azure WAF', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'azure-waf', position: { x: 450, y: 150 }, nodeType: 'waf', commentary: 'Detection mode only; no bot protection' },
        { id: 'tm-node-app', label: 'App Service', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'azure-app-service', position: { x: 650, y: 150 }, nodeType: 'azureAppService', commentary: 'Managed identity with Contributor scope' },
        { id: 'tm-node-mi', label: 'Managed Identity', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'managed-identity', position: { x: 850, y: 100 }, nodeType: 'azureManagedIdentity' },
        { id: 'tm-node-kv', label: 'Key Vault', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'azure-keyvault', position: { x: 850, y: 250 }, nodeType: 'azureKeyVault', commentary: 'Firewall open to 0.0.0.0/0' },
        { id: 'tm-node-sql', label: 'SQL Database', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'azure-sql', position: { x: 650, y: 300 }, nodeType: 'azureSQLDatabase' },
      ],
      edges: [
        { id: 'tm-edge-field-b2c', source: 'tm-node-field', target: 'tm-node-b2c', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e2', label: 'Federation (no MFA enforced)', commentary: 'Conditional access exclusion allows unauthenticated device posture' },
        { id: 'tm-edge-waf-app', source: 'tm-node-waf', target: 'tm-node-app', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e6', label: 'Web Traffic (WAF detection only)' },
        { id: 'tm-edge-app-mi', source: 'tm-node-app', target: 'tm-node-mi', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e12', label: 'Identity (Contributor scope)', commentary: 'Over-privileged; can modify any subscription resource' },
        { id: 'tm-edge-app-sql', source: 'tm-node-app', target: 'tm-node-sql', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e9', label: 'Database Queries' },
      ],
      attackPathDescription: 'Primary attack chains exploit weak external authentication (field engineer conditional access gap) combined with over-privileged managed identities and publicly exposed Key Vault to pivot from initial access to full subscription compromise.',
      attackPaths: [
        {
          id: 'aap-field-engineer-pivot',
          name: 'Field Engineer Authentication Bypass → Managed Identity Abuse',
          strideCategory: 'Spoofing' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'Attacker compromises a field engineer device (no compliance check), authenticates to Azure AD B2C without MFA, reaches App Service through the detection-only WAF, then exploits the over-privileged managed identity to escalate across the subscription.',
          diagramAttackPathId: 'ap-field-identity-pivot',
          steps: [
            { order: 1, edgeId: 'e2', sourceNodeId: 'field-engineers', targetNodeId: 'azure-b2c', technique: 'T1078.004: Valid Accounts - Cloud Accounts' },
            { order: 2, edgeId: 'e5', sourceNodeId: 'azure-b2c', targetNodeId: 'azure-waf', technique: 'T1550.001: Use Alternate Authentication Material - Application Access Token' },
            { order: 3, edgeId: 'e6', sourceNodeId: 'azure-waf', targetNodeId: 'azure-app-service', technique: 'T1190: Exploit Public-Facing Application' },
            { order: 4, edgeId: 'e12', sourceNodeId: 'azure-app-service', targetNodeId: 'managed-identity', technique: 'T1098: Account Manipulation' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
        {
          id: 'aap-keyvault-secret-theft',
          name: 'Public Key Vault → Secret Exfiltration → Database Compromise',
          strideCategory: 'Information Disclosure' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'Attacker with valid Azure AD tokens leverages the publicly accessible Key Vault firewall to retrieve Cosmos DB master keys and SQL connection strings, then accesses databases directly.',
          diagramAttackPathId: 'ap-keyvault-secrets',
          steps: [
            { order: 1, edgeId: 'e13', sourceNodeId: 'azure-functions', targetNodeId: 'azure-keyvault', technique: 'T1552.005: Unsecured Credentials - Cloud Instance Metadata API' },
            { order: 2, edgeId: 'e9', sourceNodeId: 'azure-app-service', targetNodeId: 'azure-sql', technique: 'T1078: Valid Accounts' },
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
    id: 'soa-az-a01', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A01', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Managed identity has Contributor role at subscription scope. Conditional access excludes field engineering group. Access control boundaries are not enforced at resource-group granularity.',
    mitigatesRiskIds: ['risk-overprivileged-managed-identity', 'risk-conditional-access-gap'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-az-a02', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A02', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Key Vault stores secrets but firewall is open to public internet. East-west traffic between App Service and AKS is unencrypted HTTP.',
    mitigatesRiskIds: ['risk-keyvault-public-access', 'risk-unencrypted-east-west'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-az-a04', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A04', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'planned' as const,
    justification: 'Architecture lacks zero-trust boundaries between compute tiers. Managed identity reused across environments with excessive scope. No service mesh for east-west traffic.',
    mitigatesRiskIds: ['risk-overprivileged-managed-identity', 'risk-unencrypted-east-west'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-az-a05', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A05', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Multiple misconfigurations: Key Vault firewall open, WAF in detection mode, storage shared key access, Azure Policy in audit-only mode, Defender recommendations suppressed.',
    mitigatesRiskIds: ['risk-keyvault-public-access', 'risk-waf-detection-mode', 'risk-storage-shared-key', 'risk-policy-exclusions'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-az-a07', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A07', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Conditional access excludes field engineers. Legacy authentication enabled in Azure AD. MFA optional when device is marked compliant.',
    mitigatesRiskIds: ['risk-conditional-access-gap'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-az-a08', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A08', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'App Service deployment slots share production secrets. Function app allows anonymous triggers for admin routes. No deployment verification gates.',
    mitigatesRiskIds: ['risk-overprivileged-managed-identity'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-az-a09', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A09', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Sentinel deployed but Log Analytics workspace throttled at 50 GB/day. Application Insights sampling at 10%. Defender recommendations suppressed for legacy resources.',
    mitigatesRiskIds: ['risk-log-throttling'],
    diagramRefs: [],
    evidence: [
      {
        id: 'evidence-az-a09-sentinel',
        kind: 'link' as const,
        name: 'Sentinel analytics rule coverage report',
        url: 'https://security.example.local/reports/sentinel-coverage',
        note: 'Monthly coverage export',
        createdAt: NOW
      }
    ],
    updatedAt: NOW
  },
  {
    id: 'soa-az-a10', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A10', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'planned' as const,
    justification: 'Functions can make outbound calls without egress filtering. Managed identity token endpoint accessible from any workload in the subscription.',
    mitigatesRiskIds: ['risk-overprivileged-managed-identity'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-az-a03', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A03', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'implemented' as const,
    justification: 'WAF managed rulesets cover injection vectors, though detection-only mode limits effectiveness. Parameterized queries used in App Service code.',
    mitigatesRiskIds: ['risk-waf-detection-mode'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-az-a06', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A06', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Container images scanned via Defender for Containers. AKS network policy disabled for legacy services. Function app host keys shared via DevOps variables.',
    mitigatesRiskIds: [],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
];

const workflowTasks = [
  {
    id: 'task-identity-scoping',
    title: 'Scope managed identity to resource-group with custom RBAC roles',
    description: 'Replace subscription-level Contributor with least-privilege custom roles scoped to required resource groups.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'critical' as const,
    owner: 'Platform Engineering',
    dueDate: '2025-06-30',
    riskId: 'risk-overprivileged-managed-identity',
    createdAt: NOW,
    updatedAt: NOW
  },
  {
    id: 'task-keyvault-hardening',
    title: 'Restrict Key Vault to private endpoints and enable soft-delete',
    description: 'Deploy private endpoint for Key Vault; close public firewall; enable soft-delete and purge protection.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'critical' as const,
    owner: 'Security Operations',
    dueDate: '2025-06-15',
    riskId: 'risk-keyvault-public-access',
    createdAt: NOW,
    updatedAt: NOW
  },
  {
    id: 'task-waf-mode-switch',
    title: 'Switch Azure WAF from detection to prevention mode',
    description: 'Tune managed rulesets against production traffic; switch to prevention mode; enable bot protection.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Network Security',
    dueDate: '2025-07-01',
    riskId: 'risk-waf-detection-mode',
    createdAt: NOW,
    updatedAt: NOW
  },
  {
    id: 'task-conditional-access-remediation',
    title: 'Enforce conditional access for all external identity groups',
    description: 'Remove field engineer group exclusion; require device compliance and MFA for B2C federation.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'critical' as const,
    owner: 'Identity & Access Management',
    dueDate: '2025-06-20',
    riskId: 'risk-conditional-access-gap',
    createdAt: NOW,
    updatedAt: NOW
  },
  {
    id: 'task-evidence-az-a09',
    title: 'Attach Sentinel log pipeline evidence for A09',
    description: 'Collect Log Analytics ingestion metrics and Sentinel rule coverage for evidence package.',
    type: 'evidence' as const,
    status: 'todo' as const,
    priority: 'medium' as const,
    owner: 'Security Operations',
    dueDate: '2025-07-05',
    controlSetId: OWASP_CONTROL_SET_ID,
    controlId: 'A09',
    createdAt: NOW,
    updatedAt: NOW
  },
  {
    id: 'task-storage-rbac-migration',
    title: 'Migrate Blob Storage from shared key to Azure AD RBAC',
    description: 'Disable shared key access on storage account; assign data reader/writer roles via Azure AD.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Data Engineering',
    dueDate: '2025-07-15',
    riskId: 'risk-storage-shared-key',
    createdAt: NOW,
    updatedAt: NOW
  },
];

const threatActors = [
  {
    id: 'threat-actor-initial-access-broker', name: 'Initial Access Broker (Cloud Credentials)',
    type: 'organised_crime' as const, capabilityLevel: 3,
    resourceLevel: 'moderate' as const,
    motivation: 'Financial gain through selling stolen Azure AD credentials and session tokens to ransomware operators.',
    description: 'Specialises in harvesting cloud identity credentials via phishing, token theft, and exploiting weak conditional access policies. Sells access to downstream operators.',
    targetedAssetIds: ['asset-azure-ad-b2c', 'asset-managed-identity'],
    tags: ['credential-theft', 'access-broker', 'cloud-identity'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'threat-actor-cloud-adversary', name: 'Cloud-Native APT Group',
    type: 'nation_state' as const, capabilityLevel: 5,
    resourceLevel: 'very_high' as const,
    motivation: 'Espionage and persistent access to multi-tenant SaaS environments for intelligence collection and data exfiltration.',
    description: 'Advanced persistent threat group with deep knowledge of Azure control plane, managed identity abuse, and Key Vault exploitation. Leverages over-privileged identities for lateral movement.',
    targetedAssetIds: ['asset-managed-identity', 'asset-keyvault', 'asset-sql-database', 'asset-app-service'],
    tags: ['apt', 'cloud-native', 'identity-abuse', 'persistent'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'threat-actor-insider-engineer', name: 'Disgruntled Field Engineer',
    type: 'insider' as const, capabilityLevel: 2,
    resourceLevel: 'low' as const,
    motivation: 'Personal grievance or financial incentive to exfiltrate customer data or sabotage SaaS operations.',
    description: 'Field engineer with legitimate Azure AD B2C credentials and exemption from conditional access policies. Has knowledge of internal architecture and deployment processes.',
    targetedAssetIds: ['asset-azure-ad-b2c', 'asset-blob-storage', 'asset-sql-database'],
    tags: ['insider-threat', 'privileged-knowledge', 'data-exfiltration'],
    createdAt: NOW, updatedAt: NOW
  },
];

const threatScenarios = [
  {
    id: 'scenario-credential-broker-pivot', title: 'Credential Broker Pivots via Weak Conditional Access to Subscription Takeover',
    description: 'An initial access broker phishes a field engineer whose device is exempt from conditional access. The attacker authenticates to Azure AD B2C without MFA, obtains tokens to reach the App Service, then exploits the over-privileged managed identity (Contributor at subscription scope) to create backdoor service principals and exfiltrate Key Vault secrets.',
    threatActorId: 'threat-actor-initial-access-broker',
    targetedAssetIds: ['asset-azure-ad-b2c', 'asset-app-service', 'asset-managed-identity', 'asset-keyvault'],
    attackTechniques: ['T1078.004 - Valid Accounts: Cloud Accounts', 'T1098 - Account Manipulation', 'T1552.005 - Unsecured Credentials: Cloud Instance Metadata'],
    linkedRiskIds: ['risk-conditional-access-gap', 'risk-overprivileged-managed-identity', 'risk-keyvault-public-access'],
    likelihood: 'High — conditional access exclusion and over-privileged identity create a low-friction attack chain.',
    impact: 'Critical — subscription-level Contributor access enables full tenant compromise.',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scenario-data-exfil-storage', title: 'Data Exfiltration via Publicly Listed Blob Storage',
    description: 'Attacker discovers publicly listed blob containers through internet reconnaissance, downloads sensitive CSV exports using shared key authentication, and sells the data.',
    threatActorId: 'threat-actor-cloud-adversary',
    targetedAssetIds: ['asset-blob-storage'],
    attackTechniques: ['T1530 - Data from Cloud Storage', 'T1567 - Exfiltration Over Web Service'],
    linkedRiskIds: ['risk-storage-shared-key'],
    likelihood: 'Moderate — public container listing is discoverable but shared key adds a barrier.',
    impact: 'Major — sensitive customer CSV extracts exposed; regulatory and reputational impact.',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scenario-insider-blind-spot', title: 'Insider Exploits Monitoring Blind Spot During Log Throttling',
    description: 'A disgruntled field engineer initiates data exfiltration during a period of high log volume when the 50 GB/day Log Analytics cap has been reached, ensuring Sentinel cannot detect the anomalous activity.',
    threatActorId: 'threat-actor-insider-engineer',
    targetedAssetIds: ['asset-sentinel', 'asset-sql-database', 'asset-azure-ad-b2c'],
    attackTechniques: ['T1562.008 - Impair Defenses: Disable Cloud Logs', 'T1078.004 - Valid Accounts: Cloud Accounts', 'T1005 - Data from Local System'],
    linkedRiskIds: ['risk-log-throttling', 'risk-conditional-access-gap'],
    likelihood: 'Moderate — requires timing with ingestion throttle, but insider has knowledge of monitoring gaps.',
    impact: 'Major — undetected data exfiltration from SQL Database during monitoring blackout.',
    createdAt: NOW, updatedAt: NOW
  },
];

export const azureCloudIdentityGapsGrcWorkspace: GrcWorkspace = buildGrcWorkspace({
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
      id: 'azid-tp-azure',
      name: 'Microsoft Azure',
      description: 'Primary cloud infrastructure provider hosting the entire customer hub including Azure AD B2C, App Service, Blob Storage, Key Vault, Sentinel, and SQL Database. Operates under shared responsibility model with PaaS and identity services.',
      category: 'cloud_provider',
      status: 'active',
      riskRating: 'critical',
      dataClassification: 'restricted',
      linkedAssetIds: ['asset-azure-ad-b2c', 'asset-managed-identity', 'asset-keyvault', 'asset-app-service', 'asset-blob-storage', 'asset-sentinel', 'asset-azure-waf', 'asset-sql-database'],
      linkedRiskIds: ['risk-conditional-access-gap', 'risk-overprivileged-managed-identity', 'risk-keyvault-public-access', 'risk-storage-shared-key', 'risk-policy-exclusions'],
      contactName: 'Azure Enterprise Support',
      contactEmail: 'azure-tam@microsoft.example.com',
      contractExpiry: '2027-03-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-12-31',
      notes: 'Enterprise Agreement with Premier Support. SOC 2 Type II, ISO 27001, FedRAMP High certified. Multiple identity drift issues identified — conditional access exclusions, overprivileged managed identity, Key Vault firewall open to 0.0.0.0/0. Defender for Cloud recommendations suppressed. Azure Policy assignments exclude management groups for legacy compatibility. Shared responsibility gaps require remediation.'
    },
    {
      id: 'azid-tp-okta',
      name: 'Okta Inc.',
      description: 'SaaS identity provider federated with Azure AD B2C for workforce SSO and MFA. Provides adaptive authentication, lifecycle management, and directory integration for 15,000 enterprise users.',
      category: 'saas',
      status: 'active',
      riskRating: 'high',
      dataClassification: 'confidential',
      linkedAssetIds: ['asset-azure-ad-b2c', 'asset-app-service'],
      linkedRiskIds: ['risk-conditional-access-gap', 'risk-unencrypted-east-west'],
      contactName: 'Lisa Chang',
      contactEmail: 'lisa.chang@okta.example.com',
      contractExpiry: '2026-12-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-09-30',
      notes: 'Enterprise plan with Advanced Server Access. Federated trust with Azure AD B2C conditional access policies — but field engineering group exclusion means Okta-authenticated users in that group bypass device compliance checks. MFA enrollment rate is 94% — remaining 6% are legacy service accounts. Breach notification SLA is 48 hours. Annual pen test report reviewed.'
    },
    {
      id: 'azid-tp-wiz',
      name: 'Wiz Inc.',
      description: 'SaaS cloud security posture management (CSPM) platform providing agentless vulnerability scanning, identity analysis, and attack path visualization across the Azure tenant.',
      category: 'saas',
      status: 'active',
      riskRating: 'medium',
      dataClassification: 'internal',
      linkedAssetIds: ['asset-managed-identity', 'asset-keyvault', 'asset-blob-storage'],
      linkedRiskIds: ['risk-overprivileged-managed-identity', 'risk-keyvault-public-access', 'risk-storage-shared-key', 'risk-policy-exclusions'],
      contactName: 'Amit Goldstein',
      contactEmail: 'amit.goldstein@wiz.example.com',
      contractExpiry: '2026-11-30',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-08-31',
      notes: 'Enterprise plan with read-only access to Azure subscription via service principal. Identifies identity drift, misconfigured storage accounts, and attack paths. Findings correlated with Sentinel alerts. Has flagged the Key Vault public access and managed identity overprivilege issues but remediation tickets remain open. No production data access — metadata and configuration only.'
    },
    {
      id: 'azid-tp-rapid7',
      name: 'Rapid7 LLC',
      description: 'Managed service provider delivering quarterly penetration testing, vulnerability management, and incident response retainer for the Azure customer hub environment.',
      category: 'managed_service',
      status: 'active',
      riskRating: 'medium',
      dataClassification: 'confidential',
      linkedAssetIds: ['asset-app-service', 'asset-sql-database', 'asset-azure-waf'],
      linkedRiskIds: ['risk-waf-detection-mode', 'risk-log-throttling', 'risk-unencrypted-east-west'],
      contactName: 'Robert Nakamura',
      contactEmail: 'robert.nakamura@rapid7.example.com',
      contractExpiry: '2026-12-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-10-31',
      notes: 'Annual engagement with quarterly pen tests and monthly vulnerability scans. Last assessment identified WAF in detection-only mode and east-west traffic without encryption. Incident response retainer provides 4-hour SLA for critical incidents. InsightVM agents deployed on App Service for continuous vulnerability assessment. Findings feed into Sentinel via API integration.'
    },
  ],
  securityInitiatives: [
    {
      id: 'azid-si-zero-trust-identity',
      title: 'Azure Zero Trust Identity and Access Transformation',
      description: 'Implement zero trust identity controls across the Azure tenant by eliminating conditional access exclusions, enforcing least-privilege RBAC, and deploying private endpoints for all sensitive services.',
      category: 'transformation' as const,
      status: 'in_progress' as const,
      priority: 'critical' as const,
      owner: 'Identity & Access Management',
      executiveSponsor: 'CISO',
      currentState: 'Conditional access excludes field engineers. Managed identity has Contributor role at subscription scope. Key Vault firewall allows 0.0.0.0/0. Legacy authentication enabled in Azure AD.',
      targetState: 'All identities subject to conditional access with device compliance and MFA. Managed identities scoped to resource-group level with custom roles. All sensitive services behind private endpoints.',
      startDate: '2025-04-15',
      targetDate: '2025-09-30',
      completedDate: '',
      milestones: [
        { id: 'azid-ms-conditional-access', title: 'Enforce conditional access for all identity groups', description: 'Remove field engineer group exclusion and enforce device compliance and MFA for all B2C federation paths.', status: 'in_progress' as const, dueDate: '2025-06-20', completedDate: '', owner: 'Identity & Access Management' },
        { id: 'azid-ms-managed-identity-scoping', title: 'Scope managed identity to resource-group RBAC', description: 'Replace subscription-level Contributor with custom RBAC roles scoped to required resource groups.', status: 'in_progress' as const, dueDate: '2025-06-30', completedDate: '', owner: 'Platform Engineering' },
        { id: 'azid-ms-keyvault-private', title: 'Deploy private endpoints for Key Vault', description: 'Close public firewall on Key Vault and deploy private endpoints with soft-delete and purge protection enabled.', status: 'pending' as const, dueDate: '2025-07-15', completedDate: '', owner: 'Security Operations' },
      ],
      linkedRiskIds: ['risk-conditional-access-gap', 'risk-overprivileged-managed-identity', 'risk-keyvault-public-access'],
      linkedControlSetIds: [],
      linkedAssetIds: ['asset-azure-ad-b2c', 'asset-managed-identity', 'asset-keyvault'],
      linkedImplementedControlIds: ['azid-ic-conditional-access', 'azid-ic-defender-cloud'],
      linkedAssessmentIds: ['assessment-azure-identity-drift'],
      notes: 'Device compliance policy rollout to field devices is 65% complete. Custom RBAC role definition drafted and under testing in staging subscription.',
      createdAt: NOW,
      updatedAt: NOW
    },
    {
      id: 'azid-si-monitoring-resilience',
      title: 'Azure Security Monitoring Resilience Uplift',
      description: 'Improve Sentinel detection resilience by removing Log Analytics ingestion caps, enabling automated playbooks, and extending monitoring coverage to all Azure services.',
      category: 'uplift' as const,
      status: 'approved' as const,
      priority: 'high' as const,
      owner: 'Security Operations',
      executiveSponsor: 'VP of Security',
      currentState: 'Log Analytics workspace throttled at 50 GB/day. Sentinel playbooks not configured. Application Insights sampling at 10%. Defender for Cloud recommendations suppressed for legacy resources.',
      targetState: 'No daily data cap on Log Analytics. Automated Sentinel playbooks for top 10 detection rules. Full-fidelity Application Insights. All Defender recommendations triaged within 7 days.',
      startDate: '2025-06-01',
      targetDate: '2025-10-31',
      completedDate: '',
      milestones: [
        { id: 'azid-ms-remove-cap', title: 'Remove Log Analytics daily data cap', description: 'Remove or raise the 50 GB/day cap and implement tiered data collection with priority-based ingestion.', status: 'pending' as const, dueDate: '2025-07-01', completedDate: '', owner: 'Security Operations' },
        { id: 'azid-ms-playbooks', title: 'Deploy automated Sentinel playbooks', description: 'Configure Logic App playbooks for automated response to top 10 high-fidelity detection rules.', status: 'pending' as const, dueDate: '2025-08-31', completedDate: '', owner: 'Security Operations' },
        { id: 'azid-ms-defender-triage', title: 'Establish Defender recommendation triage process', description: 'Remove blanket suppressions and implement weekly triage cadence for all Defender for Cloud recommendations.', status: 'pending' as const, dueDate: '2025-09-15', completedDate: '', owner: 'Cloud Governance' },
      ],
      linkedRiskIds: ['risk-log-throttling', 'risk-policy-exclusions'],
      linkedControlSetIds: [],
      linkedAssetIds: ['asset-sentinel'],
      linkedImplementedControlIds: ['azid-ic-sentinel'],
      linkedAssessmentIds: ['assessment-azure-identity-drift'],
      notes: 'Budget approval received for Log Analytics capacity reservation tier. Playbook templates identified from Microsoft Sentinel content hub.',
      createdAt: NOW,
      updatedAt: NOW
    },
  ],
  implementedControls: [
    {
      id: 'azid-ic-conditional-access',
      title: 'Azure AD Conditional Access Policies',
      description: 'Conditional access policies enforcing device compliance, MFA, and risk-based authentication for all Azure AD B2C and workforce identities.',
      controlType: 'technical' as const,
      category: 'identity_management' as const,
      status: 'active' as const,
      automationLevel: 'fully_automated' as const,
      owner: 'Identity & Access Management',
      vendor: 'Microsoft',
      product: 'Microsoft Entra ID',
      version: '',
      implementedDate: '2024-06-15',
      lastReviewDate: '2025-05-15',
      nextReviewDate: '2025-11-15',
      linkedSoaEntryIds: ['soa-az-a01', 'soa-az-a07'],
      linkedRiskIds: ['risk-conditional-access-gap'],
      linkedAssetIds: ['asset-azure-ad-b2c', 'asset-app-service'],
      linkedAssessmentIds: ['assessment-azure-identity-drift'],
      notes: 'Policies active but field engineering group currently excluded. Remediation in progress to enforce device compliance for all groups. Named locations configured for office networks.',
      createdAt: NOW,
      updatedAt: NOW
    },
    {
      id: 'azid-ic-defender-cloud',
      title: 'Microsoft Defender for Cloud CSPM',
      description: 'Cloud security posture management providing continuous assessment of Azure resource configurations against CIS benchmarks with secure score tracking and attack path analysis.',
      controlType: 'technical' as const,
      category: 'monitoring' as const,
      status: 'active' as const,
      automationLevel: 'fully_automated' as const,
      owner: 'Security Operations',
      vendor: 'Microsoft',
      product: 'Defender for Cloud',
      version: '',
      implementedDate: '2024-01-10',
      lastReviewDate: '2025-04-20',
      nextReviewDate: '2025-10-20',
      linkedSoaEntryIds: ['soa-az-a05', 'soa-az-a08'],
      linkedRiskIds: ['risk-keyvault-public-access', 'risk-overprivileged-managed-identity', 'risk-policy-exclusions'],
      linkedAssetIds: ['asset-keyvault', 'asset-managed-identity', 'asset-app-service'],
      linkedAssessmentIds: ['assessment-azure-identity-drift'],
      notes: 'Defender CSPM plan enabled with agentless scanning. Secure score currently at 62%. Key Vault public access and managed identity overprivilege flagged as critical findings. Some recommendations suppressed for legacy resources — suppression review planned.',
      createdAt: NOW,
      updatedAt: NOW
    },
    {
      id: 'azid-ic-sentinel',
      title: 'Microsoft Sentinel SIEM and SOAR',
      description: 'Cloud-native SIEM providing security analytics, threat detection, and automated incident response across Azure and hybrid environments.',
      controlType: 'technical' as const,
      category: 'monitoring' as const,
      status: 'active' as const,
      automationLevel: 'semi_automated' as const,
      owner: 'Security Operations',
      vendor: 'Microsoft',
      product: 'Microsoft Sentinel',
      version: '',
      implementedDate: '2024-04-01',
      lastReviewDate: '2025-05-10',
      nextReviewDate: '2025-11-10',
      linkedSoaEntryIds: ['soa-az-a09'],
      linkedRiskIds: ['risk-log-throttling'],
      linkedAssetIds: ['asset-sentinel'],
      linkedAssessmentIds: ['assessment-azure-identity-drift'],
      notes: 'Analytics rules cover identity, network, and application layers. Log Analytics workspace throttled at 50 GB/day causing data loss during incident spikes. Playbooks not yet configured. Content hub solutions deployed for Azure AD and Key Vault.',
      createdAt: NOW,
      updatedAt: NOW
    },
  ],
});

export const azureCloudIdentityGaps: ExampleSystem = {
  id: 'azure-cloud-identity-gaps',
  name: 'Azure Customer Hub with Identity Drift',
  description: 'Multi-tenant Azure environment where identity, storage, and monitoring controls have quietly drifted from best practice.',
  category: 'Cloud Vendor Architectures',
  primaryZone: 'Cloud',
  dataClassification: 'Sensitive',
  customContext: `
## Azure SaaS Tenant – Subtle Control Failures

This architecture represents a typical Azure SaaS deployment where security controls have quietly drifted:

- **Azure Front Door** still accepts HTTP fallback paths for legacy clients, bypassing WAF custom rules.
- **Application Gateway** trusts X-Forwarded-For headers, enabling source IP spoofing around conditional access.
- **Azure AD B2C** conditional access policies exclude the field engineering group, letting legacy devices authenticate without compliant posture.
- **Managed Identity** assigned Contributor role on subscription instead of least-privilege resource access.
- **App Service** uses Linux containers with deployment slots sharing production secrets.
- **Storage Account** allows shared key access for data science exports, leaving offline copies untracked.
- **Key Vault** firewall opens to '0.0.0.0/0' for automation and was never closed.
- **Sentinel** analytics rules rely on Log Analytics workspace with throttled ingestion.
- **Defender for Cloud** recommendations suppressed after generating alerts for legacy resources.
- **Policy** assignments exclude management groups to avoid breaking legacy deployments.

Use this system to explore how seemingly small configuration gaps accumulate into exploitable attack chains.
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
        description: 'External customers and roaming workforce'
      },
      style: {
        width: 600,
        height: 900,
        background: colors.zoneBackgrounds.Internet,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'azure-customers',
      type: 'user',
      position: { x: 125, y: 175 },
      data: {
        label: 'Customer Clients',
        description: 'Public SaaS consumers hitting the global entry point',
        zone: 'Internet' as SecurityZone,
        dataClassification: 'Public'
      }
    } as SecurityNode,
    {
      id: 'field-engineers',
      type: 'user',
      position: { x: 125, y: 375 },
      data: {
        label: 'Field Engineers',
        description: 'BYOD devices using Azure AD B2C federation',
        zone: 'Internet' as SecurityZone,
        dataClassification: 'Public'
      }
    } as SecurityNode,

    // DMZ Zone
    {
      id: 'azure-dmz-zone',
      type: 'securityZone',
      position: { x: 670, y: 50 },
      data: {
        label: 'Azure Edge DMZ',
        zoneType: 'DMZ' as SecurityZone,
        description: 'Front Door and Application Gateway terminating inbound sessions'
      },
      style: {
        width: 750,
        height: 900,
        background: colors.zoneBackgrounds.DMZ,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'azure-frontdoor',
      type: 'azureFrontDoor',
      position: { x: 675, y: 175 },
      data: {
        label: 'Front Door',
        description: 'Global entry with WAF in detection mode for legacy traffic',
        zone: 'DMZ' as SecurityZone,
        dataClassification: 'Internal',
        additionalContext: 'HTTP fallback enabled; WAF custom rules disabled after false positives.'
      }
    } as SecurityNode,
    {
      id: 'app-gateway',
      type: 'azureApplicationGateway',
      position: { x: 1025, y: 175 },
      data: {
        label: 'Application Gateway',
        description: 'Layer-7 routing with path-based rules',
        zone: 'DMZ' as SecurityZone,
        dataClassification: 'Internal',
        additionalContext: 'Trusts X-Forwarded-For header; backend health probes use insecure HTTP.'
      }
    } as SecurityNode,
    {
      id: 'azure-waf',
      type: 'waf',
      position: { x: 1375, y: 275 },
      data: {
        label: 'Azure WAF',
        description: 'Web application firewall with managed rulesets',
        zone: 'DMZ' as SecurityZone,
        dataClassification: 'Internal',
        additionalContext: 'Detection mode only; no bot protection enabled to reduce costs.'
      }
    } as SecurityNode,
    {
      id: 'azure-b2c',
      type: 'azureADB2C',
      position: { x: 925, y: 375 },
      data: {
        label: 'Azure AD B2C',
        description: 'Manages external identities with legacy policies for field staff',
        zone: 'DMZ' as SecurityZone,
        dataClassification: 'Internal',
        additionalContext: 'Conditional access excludes Field Engineers group; MFA optional when device marked compliant.'
      }
    } as SecurityNode,

    // Cloud Zone
    {
      id: 'azure-prod-zone',
      type: 'securityZone',
      position: { x: 1540, y: 50 },
      data: {
        label: 'Azure Production',
        zoneType: 'Cloud' as SecurityZone,
        description: 'App Services, Functions, and data platforms'
      },
      style: {
        width: 950,
        height: 900,
        background: colors.zoneBackgrounds.Cloud,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'azure-app-service',
      type: 'azureAppService',
      position: { x: 1675, y: 175 },
      data: {
        label: 'App Service',
        description: 'Hosts customer portal container with managed identity',
        zone: 'Cloud' as SecurityZone,
        dataClassification: 'Sensitive',
        additionalContext: 'Managed identity has Contributor on subscription; deployment slots share production secrets.'
      }
    } as SecurityNode,
    {
      id: 'azure-functions',
      type: 'azureFunctions',
      position: { x: 2025, y: 75 },
      data: {
        label: 'Functions',
        description: 'Processes bulk ingestion with default host keys',
        zone: 'Cloud' as SecurityZone,
        dataClassification: 'Sensitive',
        additionalContext: 'Function app allows anonymous triggers for /admin route; keys shared via DevOps variables.'
      }
    } as SecurityNode,
    {
      id: 'azure-aks',
      type: 'azureKubernetesService',
      position: { x: 2425, y: 275 },
      data: {
        label: 'AKS Cluster',
        description: 'Kubernetes cluster for microservices workloads',
        zone: 'Cloud' as SecurityZone,
        dataClassification: 'Sensitive',
        additionalContext: 'Network policy disabled; pod identity not enforced for legacy services.'
      }
    } as SecurityNode,
    {
      id: 'azure-sql',
      type: 'azureSQLDatabase',
      position: { x: 1675, y: 425 },
      data: {
        label: 'SQL Database',
        description: 'Primary transactional store with geo-replication',
        zone: 'Cloud' as SecurityZone,
        dataClassification: 'Confidential',
        additionalContext: 'Firewall allows connection from any Azure service; auditing writes to throttled workspace.'
      }
    } as SecurityNode,
    {
      id: 'azure-cosmos',
      type: 'azureCosmosDB',
      position: { x: 1875, y: 425 },
      data: {
        label: 'Cosmos DB',
        description: 'Stores session metadata for personalization',
        zone: 'Cloud' as SecurityZone,
        dataClassification: 'Sensitive',
        additionalContext: 'Master key stored in Key Vault accessible via Contributor role; no RBAC configured.'
      }
    } as SecurityNode,
    {
      id: 'azure-storage',
      type: 'azureBlobStorage',
      position: { x: 2025, y: 475 },
      data: {
        label: 'Blob Storage',
        description: 'Landing zone for CSV extracts consumed by data science',
        zone: 'Cloud' as SecurityZone,
        dataClassification: 'Sensitive',
        additionalContext: 'Shared key access enabled; containers allow public listing for debugging.'
      }
    } as SecurityNode,

    // Management Zone
    {
      id: 'azure-ops-zone',
      type: 'securityZone',
      position: { x: 2610, y: 50 },
      data: {
        label: 'Operations & Security',
        zoneType: 'Management' as SecurityZone,
        description: 'Identity, security monitoring, and privileged access'
      },
      style: {
        width: 850,
        height: 900,
        background: colors.zoneBackgrounds.Management,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'azure-ad',
      type: 'azureActiveDirectory',
      position: { x: 2775, y: 125 },
      data: {
        label: 'Azure AD',
        description: 'Enterprise identity with conditional access',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Confidential',
        additionalContext: 'Legacy authentication enabled for compatibility; guest users not restricted.'
      }
    } as SecurityNode,
    {
      id: 'managed-identity',
      type: 'azureManagedIdentity',
      position: { x: 3075, y: 175 },
      data: {
        label: 'Managed Identities',
        description: 'System and user-assigned identities for Azure resources',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Confidential',
        additionalContext: 'User-assigned identities reused across environments; over-privileged with Contributor role.'
      }
    } as SecurityNode,
    {
      id: 'azure-keyvault',
      type: 'azureKeyVault',
      position: { x: 3175, y: 125 },
      data: {
        label: 'Key Vault',
        description: 'Stores connection strings and Cosmos master keys',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Confidential',
        additionalContext: 'Firewall allows public network access; soft-delete disabled to simplify testing.'
      }
    } as SecurityNode,
    {
      id: 'sentinel',
      type: 'azureSentinel',
      position: { x: 2775, y: 275 },
      data: {
        label: 'Sentinel',
        description: 'Cloud-native SIEM for threat detection',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Sensitive',
        additionalContext: 'Analytics rules rely on Log Analytics with throttled ingestion; playbooks not configured.'
      }
    } as SecurityNode,
    {
      id: 'defender',
      type: 'azureDefender',
      position: { x: 3075, y: 275 },
      data: {
        label: 'Defender for Cloud',
        description: 'Cloud security posture management and workload protection',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Sensitive',
        additionalContext: 'Recommendations suppressed for legacy resources; auto-provisioning disabled to reduce costs.'
      }
    } as SecurityNode,
    {
      id: 'azure-policy',
      type: 'azurePolicy',
      position: { x: 3425, y: 275 },
      data: {
        label: 'Azure Policy',
        description: 'Governance and compliance enforcement',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Sensitive',
        additionalContext: 'Policy assignments exclude management groups; audit-only mode to avoid breaking deployments.'
      }
    } as SecurityNode,
    {
      id: 'log-analytics',
      type: 'azureLogAnalytics',
      position: { x: 2775, y: 425 },
      data: {
        label: 'Log Analytics',
        description: 'Collects diagnostics for Sentinel detection',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Sensitive',
        additionalContext: 'Data cap throttled at 50 GB/day; ingestion stops during incident spikes.'
      }
    } as SecurityNode,
    {
      id: 'azure-monitor',
      type: 'azureMonitor',
      position: { x: 3325, y: 425 },
      data: {
        label: 'Azure Monitor',
        description: 'Unified monitoring and alerting platform',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Sensitive',
        additionalContext: 'Action groups configured but alerts suppressed for non-production resources.'
      }
    } as SecurityNode,
    {
      id: 'app-insights',
      type: 'azureApplicationInsights',
      position: { x: 3075, y: 525 },
      data: {
        label: 'Application Insights',
        description: 'Application performance monitoring and telemetry',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Sensitive',
        additionalContext: 'Sampling rate set to 10% to reduce costs; missing critical error patterns.'
      }
    } as SecurityNode,
    {
      id: 'azure-bastion',
      type: 'bastionHost',
      position: { x: 2775, y: 825 },
      data: {
        label: 'Bastion Host',
        description: 'Secure RDP/SSH gateway for VM access',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Internal',
        additionalContext: 'NSG allows RDP from corporate ranges and legacy vendor IP blocks.'
      }
    } as SecurityNode
  ],
  edges: [
    // Internet to DMZ
    {
      id: 'e1',
      source: 'azure-customers',
      target: 'azure-frontdoor',
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
        additionalContext: 'HTTP fallback enabled for legacy clients'
      }
    } as SecurityEdge,
    {
      id: 'e2',
      source: 'field-engineers',
      target: 'azure-b2c',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Federation',
        protocol: 'SAML/OIDC',
        encryption: 'TLS 1.2',
        securityLevel: 'Low',
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone,
        additionalContext: 'Group excluded from conditional access',
        controlPoints: [{ id: 'cp1', x: 550, y: 450 }, { id: 'cp2', x: 970, y: 500 }]
      }
    } as SecurityEdge,

    // DMZ internal
    {
      id: 'e3',
      source: 'azure-frontdoor',
      target: 'app-gateway',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Backend',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e4',
      source: 'app-gateway',
      target: 'azure-waf',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Inspection',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e5',
      source: 'azure-b2c',
      target: 'azure-waf',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Tokens',
        protocol: 'OIDC',
        encryption: 'JWT',
        securityLevel: 'Low',
        dataClassification: 'Sensitive',
        zone: 'DMZ' as SecurityZone,
        additionalContext: 'No device ID in tokens'
      }
    } as SecurityEdge,

    // DMZ to Cloud
    {
      id: 'e6',
      source: 'azure-waf',
      target: 'azure-app-service',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Web Traffic',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e7',
      source: 'azure-waf',
      target: 'azure-functions',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'API Calls',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone,
        controlPoints: [
          { id: 'cp3', x: 1400, y: 150, active: true },
          { id: 'cp-1771637064008', x: 1800, y: 150, active: true }
        ]
      }
    } as SecurityEdge,

    // Cloud internal
    {
      id: 'e8',
      source: 'azure-app-service',
      target: 'azure-aks',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Microservices',
        protocol: 'HTTP',
        encryption: 'None',
        securityLevel: 'Low',
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone,
        additionalContext: 'East-west traffic unencrypted'
      }
    } as SecurityEdge,
    {
      id: 'e9',
      source: 'azure-app-service',
      target: 'azure-sql',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Queries',
        protocol: 'TDS',
        encryption: 'TLS 1.2',
        securityLevel: 'High',
        dataClassification: 'Confidential',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e10',
      source: 'azure-app-service',
      target: 'azure-cosmos',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Sessions',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e11',
      source: 'azure-functions',
      target: 'azure-storage',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Exports',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Low',
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone,
        additionalContext: 'Shared key access'
      }
    } as SecurityEdge,

    // Cloud to Management
    {
      id: 'e12',
      source: 'azure-app-service',
      target: 'managed-identity',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Identity',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'High',
        dataClassification: 'Confidential',
        zone: 'Management' as SecurityZone,
        controlPoints: [{ id: 'cp4', x: 2600, y: 200 }]
      }
    } as SecurityEdge,
    {
      id: 'e13',
      source: 'azure-functions',
      target: 'azure-keyvault',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Secrets',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'High',
        dataClassification: 'Confidential',
        zone: 'Management' as SecurityZone,
        controlPoints: [{ id: 'cp5', x: 2600, y: 180 }]
      }
    } as SecurityEdge,
    {
      id: 'e14',
      source: 'azure-app-service',
      target: 'app-insights',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Telemetry',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Management' as SecurityZone,
        controlPoints: [{ id: 'cp6', x: 2450, y: 550, active: true }]
      }
    } as SecurityEdge,

    // Management internal
    {
      id: 'e15',
      source: 'azure-ad',
      target: 'managed-identity',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Auth',
        protocol: 'OAuth 2.0',
        encryption: 'TLS 1.2',
        securityLevel: 'High',
        dataClassification: 'Confidential',
        zone: 'Management' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e16',
      source: 'log-analytics',
      target: 'sentinel',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Log Data',
        protocol: 'KQL',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Management' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e17',
      source: 'defender',
      target: 'sentinel',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Alerts',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Management' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e18',
      source: 'azure-monitor',
      target: 'log-analytics',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Metrics',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Management' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e19',
      source: 'azure-policy',
      target: 'defender',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Compliance',
        protocol: 'ARM',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Management' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e20',
      source: 'azure-ad',
      target: 'azure-bastion',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'SSO',
        protocol: 'RDP/SSH',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Internal',
        zone: 'Management' as SecurityZone,
        controlPoints: [
          { id: 'cp-1771637202187', x: 2700, y: 250, active: true },
          { id: 'cp7', x: 2700, y: 650, active: true }
        ]
      }
    } as SecurityEdge,
    {
      id: 'e21',
      source: 'azure-bastion',
      target: 'azure-app-service',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Admin Access',
        protocol: 'SSH',
        encryption: 'TLS 1.2',
        securityLevel: 'Low',
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone,
        additionalContext: 'Debug console enabled',
        controlPoints: [
          { id: 'cp9', x: 1750, y: 850, active: true },
          { id: 'cp-1771637077202', x: 1750, y: 400, active: true }
        ]
      }
    } as SecurityEdge
  ],
  grcWorkspace: azureCloudIdentityGapsGrcWorkspace,
  attackPaths: [
    {
      id: 'ap-field-identity-pivot',
      name: 'Field Engineer Auth Bypass → Managed Identity Subscription Takeover',
      strideCategory: 'Spoofing',
      riskLevel: 'Critical',
      description: 'Attacker compromises a field engineer device exempt from conditional access, authenticates to Azure AD B2C without MFA, passes through the detection-only WAF to the App Service, then abuses the over-privileged managed identity (Contributor at subscription scope) to escalate privileges and create persistent backdoor access.',
      steps: [
        {
          order: 1,
          edgeId: 'e2',
          sourceNodeId: 'field-engineers',
          targetNodeId: 'azure-b2c',
          technique: 'T1078.004: Valid Accounts - Cloud Accounts',
        },
        {
          order: 2,
          edgeId: 'e5',
          sourceNodeId: 'azure-b2c',
          targetNodeId: 'azure-waf',
          technique: 'T1550.001: Use Alternate Authentication Material - Application Access Token',
        },
        {
          order: 3,
          edgeId: 'e6',
          sourceNodeId: 'azure-waf',
          targetNodeId: 'azure-app-service',
          technique: 'T1190: Exploit Public-Facing Application',
        },
        {
          order: 4,
          edgeId: 'e12',
          sourceNodeId: 'azure-app-service',
          targetNodeId: 'managed-identity',
          technique: 'T1098: Account Manipulation',
        },
      ],
      mitreTechniques: ['T1078.004', 'T1550.001', 'T1190', 'T1098'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-keyvault-secrets',
      name: 'Public Key Vault → Secret Exfiltration → Database Compromise',
      strideCategory: 'Information Disclosure',
      riskLevel: 'Critical',
      description: 'Attacker with valid Azure AD tokens leverages the publicly accessible Key Vault (firewall open to 0.0.0.0/0) to retrieve Cosmos DB master keys and SQL connection strings. Uses stolen credentials to directly query databases and exfiltrate sensitive customer data.',
      steps: [
        {
          order: 1,
          edgeId: 'e13',
          sourceNodeId: 'azure-functions',
          targetNodeId: 'azure-keyvault',
          technique: 'T1552.005: Unsecured Credentials - Cloud Instance Metadata API',
        },
        {
          order: 2,
          edgeId: 'e9',
          sourceNodeId: 'azure-app-service',
          targetNodeId: 'azure-sql',
          technique: 'T1078: Valid Accounts',
        },
      ],
      mitreTechniques: ['T1552.005', 'T1078', 'T1005'],
      createdAt: '2025-06-01T00:05:00.000Z',
      updatedAt: '2025-06-01T00:05:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-waf-bypass-functions',
      name: 'WAF Detection Mode → Anonymous Function Trigger → Storage Exfiltration',
      strideCategory: 'Tampering',
      riskLevel: 'High',
      description: 'Attacker exploits the detection-only WAF to reach Azure Functions, which exposes anonymous triggers on the /admin route. The attacker invokes bulk export functions that write sensitive data to Blob Storage with shared key access and public container listing.',
      steps: [
        {
          order: 1,
          edgeId: 'e7',
          sourceNodeId: 'azure-waf',
          targetNodeId: 'azure-functions',
          technique: 'T1190: Exploit Public-Facing Application',
        },
        {
          order: 2,
          edgeId: 'e11',
          sourceNodeId: 'azure-functions',
          targetNodeId: 'azure-storage',
          technique: 'T1530: Data from Cloud Storage Object',
        },
      ],
      mitreTechniques: ['T1190', 'T1530'],
      createdAt: '2025-06-01T00:10:00.000Z',
      updatedAt: '2025-06-01T00:10:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-bastion-lateral-movement',
      name: 'Bastion Host → App Service Debug Console → SQL Database',
      strideCategory: 'Elevation of Privilege',
      riskLevel: 'High',
      description: 'Attacker with compromised Azure AD credentials authenticates via Bastion Host (NSG allows legacy vendor IP blocks), accesses the App Service debug console via SSH, then pivots to the SQL Database using the application connection string available in environment variables.',
      steps: [
        {
          order: 1,
          edgeId: 'e20',
          sourceNodeId: 'azure-ad',
          targetNodeId: 'azure-bastion',
          technique: 'T1078.004: Valid Accounts - Cloud Accounts',
        },
        {
          order: 2,
          edgeId: 'e21',
          sourceNodeId: 'azure-bastion',
          targetNodeId: 'azure-app-service',
          technique: 'T1059: Command and Scripting Interpreter',
        },
        {
          order: 3,
          edgeId: 'e9',
          sourceNodeId: 'azure-app-service',
          targetNodeId: 'azure-sql',
          technique: 'T1005: Data from Local System',
        },
      ],
      mitreTechniques: ['T1078.004', 'T1059', 'T1005'],
      createdAt: '2025-06-01T00:15:00.000Z',
      updatedAt: '2025-06-01T00:15:00.000Z',
    } as DiagramAttackPath,
  ],
};
