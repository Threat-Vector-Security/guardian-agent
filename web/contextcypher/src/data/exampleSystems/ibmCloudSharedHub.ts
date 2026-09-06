import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { DiagramAttackPath, AssessmentThreatModelNodeSourceType, AssessmentThreatModelEdgeSourceType, AttackPathRiskLevel, GrcWorkspace } from '../../types/GrcTypes';
import { SecurityEdge, SecurityNode, SecurityZone } from '../../types/SecurityTypes';
import { colors } from '../../styles/Theme';
import { buildGrcWorkspace, score, NOW, OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID, DEFAULT_APPETITE_RULES } from './grcSharedBase';
import { StrideCategory } from '../../types/ThreatIntelTypes';

const tierCatalogue = [
  { id: 'tier1-cyber', tier: 1 as const, label: 'Cyber Risk', description: 'Information security and cyber threats' },
  { id: 'tier1-operational', tier: 1 as const, label: 'Operational Risk', description: 'Business operations and process risks' },
  { id: 'tier2-network', tier: 2 as const, label: 'Network Security', parentId: 'tier1-cyber', description: 'Network-level threats and controls' },
  { id: 'tier2-identity', tier: 2 as const, label: 'Identity & Access', parentId: 'tier1-cyber', description: 'Authentication and authorization controls' },
  { id: 'tier2-data', tier: 2 as const, label: 'Data Protection', parentId: 'tier1-cyber', description: 'Data-at-rest and data-in-transit protection' },
  { id: 'tier2-cloud-config', tier: 2 as const, label: 'Cloud Configuration', parentId: 'tier1-cyber', description: 'Cloud service misconfiguration risks' },
  { id: 'tier2-monitoring', tier: 2 as const, label: 'Security Monitoring', parentId: 'tier1-operational', description: 'Logging, detection, and response' },
  { id: 'tier2-key-mgmt', tier: 2 as const, label: 'Key Management', parentId: 'tier1-cyber', description: 'Encryption key lifecycle and segregation' },
  { id: 'tier3-broad-acls', tier: 3 as const, label: 'Overly Broad ACLs', parentId: 'tier2-network' },
  { id: 'tier3-ssh-exposure', tier: 3 as const, label: 'SSH Exposure', parentId: 'tier2-network' },
  { id: 'tier3-weak-session', tier: 3 as const, label: 'Weak Session Management', parentId: 'tier2-identity' },
  { id: 'tier3-stale-iam', tier: 3 as const, label: 'Stale IAM Policies', parentId: 'tier2-identity' },
  { id: 'tier3-unenc-replica', tier: 3 as const, label: 'Unencrypted Replica', parentId: 'tier2-data' },
  { id: 'tier3-legacy-bucket-acl', tier: 3 as const, label: 'Legacy Bucket ACLs', parentId: 'tier2-data' },
  { id: 'tier3-shared-keyring', tier: 3 as const, label: 'Shared Key Rings', parentId: 'tier2-key-mgmt' },
  { id: 'tier3-wildcard-cert', tier: 3 as const, label: 'Wildcard Certificate Exposure', parentId: 'tier2-cloud-config' },
  { id: 'tier3-log-gaps', tier: 3 as const, label: 'Logging Coverage Gaps', parentId: 'tier2-monitoring' },
  { id: 'tier3-slow-detection', tier: 3 as const, label: 'Slow Anomaly Detection', parentId: 'tier2-monitoring' },
];

const assets = [
  {
    id: 'asset-ibm-vsi', name: 'Virtual Server Instances', type: 'virtual_machine', owner: 'Platform Engineering',
    domain: 'it' as const, category: 'Cloud Compute',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Legacy integration hosts accessible via SSH from partner ranges',
    criticality: { confidentiality: 4, integrity: 5, availability: 5, financial: 4, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'ibm-cloud-shared-hub', nodeId: 'ibm-vsi', nodeLabel: 'Virtual Server Instances', nodeType: 'ibmVirtualServer' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-ibm-database', name: 'IBM Cloud Databases for PostgreSQL', type: 'database', owner: 'Database Administration',
    domain: 'application' as const, category: 'Database',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Primary tenant database with HA replica; replica disk encryption disabled',
    criticality: { confidentiality: 5, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'ibm-cloud-shared-hub', nodeId: 'ibm-database', nodeLabel: 'IBM Cloud Databases for PostgreSQL', nodeType: 'ibmDatabase' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-ibm-object-storage', name: 'Cloud Object Storage', type: 'cloud_storage', owner: 'Cloud Operations',
    domain: 'it' as const, category: 'Cloud Storage',
    businessCriticality: 4, securityCriticality: 4,
    description: 'Stores backups and data exports; legacy service IDs retain Reader access',
    criticality: { confidentiality: 4, integrity: 3, availability: 4, financial: 3, reputation: 3, safety: 1 },
    diagramRefs: [{ diagramId: 'ibm-cloud-shared-hub', nodeId: 'ibm-object-storage', nodeLabel: 'Cloud Object Storage', nodeType: 'ibmObjectStorage' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-ibm-iam', name: 'IBM Cloud IAM', type: 'identity_provider', owner: 'Identity & Access Management',
    domain: 'it' as const, category: 'Identity',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Central IAM with API keys shared via password manager; MFA disabled for service IDs',
    criticality: { confidentiality: 5, integrity: 5, availability: 4, financial: 4, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'ibm-cloud-shared-hub', nodeId: 'ibm-iam', nodeLabel: 'IBM Cloud IAM', nodeType: 'identityProvider' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-ibm-key-protect', name: 'Key Protect', type: 'security_tool', owner: 'Security Operations',
    domain: 'it' as const, category: 'Encryption Services',
    businessCriticality: 5, securityCriticality: 5,
    description: 'HSM-backed key management; key rings shared across dev and production',
    criticality: { confidentiality: 5, integrity: 5, availability: 4, financial: 4, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'ibm-cloud-shared-hub', nodeId: 'ibm-key-protect', nodeLabel: 'Key Protect', nodeType: 'ibmKeyProtect' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-ibm-app-id', name: 'App ID', type: 'identity_provider', owner: 'Platform Engineering',
    domain: 'application' as const, category: 'Authentication',
    businessCriticality: 4, securityCriticality: 4,
    description: 'Customer-facing auth with social login; refresh tokens never expire',
    criticality: { confidentiality: 4, integrity: 4, availability: 4, financial: 3, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'ibm-cloud-shared-hub', nodeId: 'ibm-app-id', nodeLabel: 'App ID', nodeType: 'ibmAppID' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-ibm-security-gateway', name: 'Security Gateway', type: 'network_device', owner: 'Network Security',
    domain: 'it' as const, category: 'Network Appliance',
    businessCriticality: 4, securityCriticality: 4,
    description: 'Virtual appliance in detect mode trusting X-Forwarded-For headers',
    criticality: { confidentiality: 3, integrity: 4, availability: 4, financial: 3, reputation: 3, safety: 1 },
    diagramRefs: [{ diagramId: 'ibm-cloud-shared-hub', nodeId: 'ibm-security-gateway', nodeLabel: 'Security Gateway', nodeType: 'ibmSecurityGateway' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-ibm-activity-tracker', name: 'Activity Tracker', type: 'security_tool', owner: 'Security Operations',
    domain: 'it' as const, category: 'Audit & Logging',
    businessCriticality: 4, securityCriticality: 4,
    description: 'Audit event collection configured only for us-south; multi-region gaps',
    criticality: { confidentiality: 3, integrity: 4, availability: 3, financial: 2, reputation: 3, safety: 1 },
    diagramRefs: [{ diagramId: 'ibm-cloud-shared-hub', nodeId: 'ibm-activity-tracker', nodeLabel: 'Activity Tracker', nodeType: 'ibmActivityTracker' }],
    createdAt: NOW, updatedAt: NOW,
  },
];

const risks = [
  {
    id: 'risk-broad-partner-acls', title: 'Overly Broad Partner Network ACLs',
    description: 'VPC ACL rules allow partner CIDRs to reach the management subnet. Combined with transit gateway route-filter drift, partner networks have deeper access than intended.',
    status: 'assessed' as const, owner: 'Network Security',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Network Security', tier3: 'Overly Broad ACLs' },
    assetIds: ['asset-ibm-vsi', 'asset-ibm-security-gateway'],
    diagramLinks: [{ diagramId: 'ibm-cloud-shared-hub', nodeIds: ['ibm-vpc', 'ibm-security-gateway', 'ibm-vsi'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Restrict ACLs to least-privilege partner access; enable VPC flow logs for audit',
    threatActorIds: ['threat-actor-partner-abuse'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-ssh-shared-sg', title: 'SSH Access via Shared Security Group',
    description: 'Virtual Server Instances expose SSH through a shared security group used by integration hosts. fail2ban is disabled after performance complaints.',
    status: 'draft' as const, owner: 'Platform Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Network Security', tier3: 'SSH Exposure' },
    assetIds: ['asset-ibm-vsi'],
    diagramLinks: [{ diagramId: 'ibm-cloud-shared-hub', nodeIds: ['ibm-vpc', 'ibm-vsi'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Create dedicated security group per workload; re-enable fail2ban with tuned thresholds',
    threatActorIds: ['threat-actor-partner-abuse'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-appid-session', title: 'App ID Refresh Tokens Never Expire',
    description: 'Social identity provider sessions have no timeout enforcement and refresh tokens never expire, allowing persistent unauthorized access after credential compromise.',
    status: 'assessed' as const, owner: 'Platform Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Identity & Access', tier3: 'Weak Session Management' },
    assetIds: ['asset-ibm-app-id'],
    diagramLinks: [{ diagramId: 'ibm-cloud-shared-hub', nodeIds: ['ibm-app-id', 'ibm-vsi'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Enforce session timeout of 30 minutes; set refresh token TTL to 24 hours',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-stale-cos-iam', title: 'Stale IAM Policies on Object Storage',
    description: 'Object Storage bucket retains Reader role for service IDs belonging to decommissioned teams. No lifecycle policy enforced.',
    status: 'draft' as const, owner: 'Cloud Operations',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Identity & Access', tier3: 'Stale IAM Policies' },
    assetIds: ['asset-ibm-object-storage'],
    diagramLinks: [{ diagramId: 'ibm-cloud-shared-hub', nodeIds: ['ibm-object-storage'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Audit and revoke unused service ID bindings; implement quarterly IAM review',
    threatActorIds: ['threat-actor-insider'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-unencrypted-replica', title: 'Database Replica Without Encryption at Rest',
    description: 'PostgreSQL replica runs without disk encryption to reduce failover latency. Service credentials stored in Object Storage with broad access.',
    status: 'assessed' as const, owner: 'Database Administration',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Data Protection', tier3: 'Unencrypted Replica' },
    assetIds: ['asset-ibm-database', 'asset-ibm-object-storage'],
    diagramLinks: [{ diagramId: 'ibm-cloud-shared-hub', nodeIds: ['ibm-database', 'ibm-object-storage'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Enable encryption at rest on replica; move credentials to Secrets Manager',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-shared-keyring', title: 'Key Protect Key Rings Shared Across Environments',
    description: 'Key Protect key rings are shared between development and production. Audit logs not forwarded to Activity Tracker.',
    status: 'assessed' as const, owner: 'Security Operations',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Key Management', tier3: 'Shared Key Rings' },
    assetIds: ['asset-ibm-key-protect', 'asset-ibm-database'],
    diagramLinks: [{ diagramId: 'ibm-cloud-shared-hub', nodeIds: ['ibm-key-protect', 'ibm-database'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Isolate key rings per environment; forward Key Protect audit events to Activity Tracker',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-monitoring-gaps', title: 'Multi-Region Audit and Monitoring Blind Spots',
    description: 'Activity Tracker event routing only covers us-south. Cloud Monitoring uses 5-minute intervals with anomaly detection disabled. Log Analysis throttled to 10 GB/day.',
    status: 'assessed' as const, owner: 'Security Operations',
    tierPath: { tier1: 'Operational Risk', tier2: 'Security Monitoring', tier3: 'Logging Coverage Gaps' },
    assetIds: ['asset-ibm-activity-tracker'],
    diagramLinks: [{ diagramId: 'ibm-cloud-shared-hub', nodeIds: ['ibm-activity-tracker', 'ibm-cloud-monitoring', 'ibm-log-analysis'] }],
    inherentScore: score('likelihood-4', 'impact-3'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Extend Activity Tracker to all regions; enable real-time anomaly detection; increase log quota',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-wildcard-cert', title: 'Wildcard Certificate Without Rotation',
    description: 'Certificate Manager stores wildcard certificates with no rotation policy. Private keys exported for partner integration purposes.',
    status: 'draft' as const, owner: 'Security Operations',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Cloud Configuration', tier3: 'Wildcard Certificate Exposure' },
    assetIds: ['asset-ibm-security-gateway'],
    diagramLinks: [{ diagramId: 'ibm-cloud-shared-hub', nodeIds: ['ibm-certificate-manager', 'ibm-load-balancer'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Implement 90-day certificate rotation; prohibit private key export; use per-service certificates',
    createdAt: NOW, updatedAt: NOW,
  },
];

const assessments = [
  {
    id: 'assessment-ibm-shared-hub', title: 'IBM Cloud Shared Services Hub Security Assessment',
    status: 'in_review' as const,
    owner: 'Security Architecture',
    reviewer: 'CISO',
    startDate: '2025-05-01',
    dueDate: '2025-07-01',
    threatActorIds: ['threat-actor-partner-abuse', 'threat-actor-insider', 'threat-actor-automated'],
    methodologyNote: 'Assessment follows NIST SP 800-53 control framework adapted for IBM Cloud shared services with CIS IBM Cloud Foundations Benchmark overlay.',
    assumptionNote: 'Assessment assumes current production configuration as of June 2025. Development environments share Key Protect key rings and are in scope.',
    scopeItems: [
      { id: 'scope-ibm-system', type: 'system' as const, value: 'system', name: 'IBM Cloud Shared Services Hub' },
      { id: 'scope-ibm-edge', type: 'diagram_segment' as const, value: 'DMZ', name: 'IBM Cloud Edge' },
      { id: 'scope-ibm-cloud', type: 'diagram_segment' as const, value: 'Cloud', name: 'IBM Cloud Shared Services' },
      { id: 'scope-ibm-mgmt', type: 'diagram_segment' as const, value: 'Management', name: 'Operations & Monitoring' },
    ],
    tierFilter: { tier1: 'Cyber Risk' },
    riskManagementPlan: {
      objective: 'Reduce lateral movement risk from partner networks and eliminate shared-credential technical debt.',
      strategy: 'Harden network boundaries first, then remediate IAM and encryption gaps across the shared services tier.',
      residualRiskStatement: 'Residual risk accepted only for monitoring latency items where compensating controls exist.',
      monitoringApproach: 'Bi-weekly review of open actions with monthly Security Steering Committee report.',
      communicationPlan: 'Fortnightly status to Platform Engineering leads and monthly CISO briefing.',
      reviewCadenceDays: 14,
      actions: [
        {
          id: 'rmp-action-restrict-acls',
          title: 'Restrict VPC ACLs to least-privilege partner access',
          owner: 'Network Security',
          dueDate: '2025-06-15',
          status: 'in_progress' as const,
          linkedRiskIds: ['risk-broad-partner-acls'],
          notes: 'ACL review completed; staged rollout to transit gateway in progress',
        },
        {
          id: 'rmp-action-isolate-keyrings',
          title: 'Isolate Key Protect key rings per environment',
          owner: 'Security Operations',
          dueDate: '2025-06-30',
          status: 'planned' as const,
          linkedRiskIds: ['risk-shared-keyring'],
          notes: 'Waiting on new Key Protect instance provisioning in eu-de region',
        },
        {
          id: 'rmp-action-encrypt-replica',
          title: 'Enable encryption at rest on PostgreSQL replica',
          owner: 'Database Administration',
          dueDate: '2025-07-15',
          status: 'planned' as const,
          linkedRiskIds: ['risk-unencrypted-replica'],
          notes: '',
        },
        {
          id: 'rmp-action-session-timeout',
          title: 'Enforce App ID session timeouts and refresh token TTL',
          owner: 'Platform Engineering',
          dueDate: '2025-06-20',
          status: 'in_progress' as const,
          linkedRiskIds: ['risk-appid-session'],
          notes: 'Session timeout configured; refresh token TTL change awaiting regression testing',
        },
      ],
      updatedAt: NOW,
    },
    riskIds: risks.map(r => r.id),
    soaGapIds: ['soa-ibm-a01', 'soa-ibm-a02', 'soa-ibm-a05'],
    taskIds: ['task-ibm-acl-restrict', 'task-ibm-keyring-isolate'],
    linkedImplementedControlIds: [],
    linkedInitiativeIds: [],
    summary: 'Security assessment of the IBM Cloud Shared Services Hub covering network boundary drift, IAM policy staleness, encryption gaps, and monitoring blind spots across 4 security zones.',
    findings: 'Partner ACLs grant broader access than documented. Key Protect key rings shared between dev and prod. PostgreSQL replica lacks encryption at rest. Activity Tracker covers only us-south.',
    recommendations: 'Immediately restrict partner ACLs, isolate key rings, enable replica encryption, and extend Activity Tracker coverage to all regions.',
    evidenceSummary: 'Evidence package includes VPC flow log samples, IAM policy exports, Key Protect audit trail gaps, and Certificate Manager rotation status.',
    threatModel: {
      nodes: [
        { id: 'tm-ibm-partner', label: 'Partner Network', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'ibm-partner', position: { x: 50, y: 150 }, nodeType: 'user' },
        { id: 'tm-ibm-sg', label: 'Security Gateway', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'ibm-security-gateway', position: { x: 200, y: 150 }, nodeType: 'ibmSecurityGateway', commentary: 'Detect mode only; trusts X-Forwarded-For' },
        { id: 'tm-ibm-vpc', label: 'VPC Transit Hub', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'ibm-vpc', position: { x: 350, y: 150 }, nodeType: 'ibmVPC', commentary: 'ACLs allow partner CIDRs to management subnet' },
        { id: 'tm-ibm-vsi', label: 'Virtual Server Instances', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'ibm-vsi', position: { x: 500, y: 100 }, nodeType: 'ibmVirtualServer', commentary: 'SSH exposed via shared security group; fail2ban disabled' },
        { id: 'tm-ibm-db', label: 'PostgreSQL Database', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'ibm-database', position: { x: 650, y: 100 }, nodeType: 'ibmDatabase', commentary: 'Replica unencrypted; credentials in Object Storage' },
        { id: 'tm-ibm-cos', label: 'Object Storage', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'ibm-object-storage', position: { x: 650, y: 250 }, nodeType: 'ibmObjectStorage', commentary: 'Stale service ID ACLs from decommissioned teams' },
        { id: 'tm-ibm-kp', label: 'Key Protect', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'ibm-key-protect', position: { x: 800, y: 100 }, nodeType: 'ibmKeyProtect', commentary: 'Dev and prod share key rings' },
      ],
      edges: [
        { id: 'tm-ibm-edge-partner-sg', source: 'tm-ibm-partner', target: 'tm-ibm-sg', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'ibm-edge-2', label: 'VPN Tunnel (IPSec)', commentary: 'Security gateway trusts partner subnets broadly' },
        { id: 'tm-ibm-edge-vpc-vsi', source: 'tm-ibm-vpc', target: 'tm-ibm-vsi', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'ibm-edge-6', label: 'Inbound SSH', commentary: 'Shared security group; partner credentials reused' },
        { id: 'tm-ibm-edge-vsi-db', source: 'tm-ibm-vsi', target: 'tm-ibm-db', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'ibm-edge-8', label: 'App Queries (PostgreSQL)', commentary: 'Replica disk unencrypted; credentials stored in COS' },
        { id: 'tm-ibm-edge-vsi-cos', source: 'tm-ibm-vsi', target: 'tm-ibm-cos', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'ibm-edge-9', label: 'Backup Exports', commentary: 'Legacy service IDs with Reader role not audited' },
        { id: 'tm-ibm-edge-db-kp', source: 'tm-ibm-db', target: 'tm-ibm-kp', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'ibm-edge-11', label: 'Key Retrieval', commentary: 'Key rings not isolated across environments' },
      ],
      attackPathDescription: 'Three primary attack paths identified: (1) Partner network abuse through broad ACLs to SSH on VSIs then pivot to database; (2) Stale IAM policies on Object Storage enabling credential harvesting for database access; (3) Shared Key Protect key rings enabling cross-environment key exposure.',
      attackPaths: [
        {
          id: 'aap-partner-lateral-db',
          name: 'Partner Network Abuse → Database Compromise',
          strideCategory: 'Elevation of Privilege' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'Attacker on the partner network exploits broad VPC ACLs and the detect-only security gateway to SSH into virtual server instances, then pivots to the PostgreSQL database using credentials stored in Object Storage.',
          diagramAttackPathId: 'ap-ibm-partner-lateral-db',
          steps: [
            { order: 1, edgeId: 'ibm-edge-2', sourceNodeId: 'ibm-partner', targetNodeId: 'ibm-security-gateway', technique: 'T1133: External Remote Services' },
            { order: 2, edgeId: 'ibm-edge-6', sourceNodeId: 'ibm-vpc', targetNodeId: 'ibm-vsi', technique: 'T1021.004: Remote Services - SSH' },
            { order: 3, edgeId: 'ibm-edge-8', sourceNodeId: 'ibm-vsi', targetNodeId: 'ibm-database', technique: 'T1078: Valid Accounts' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
        {
          id: 'aap-cos-cred-harvest',
          name: 'Object Storage Credential Harvest → Data Exfiltration',
          strideCategory: 'Information Disclosure' as StrideCategory,
          riskLevel: 'High' as AttackPathRiskLevel,
          description: 'Stale IAM policies grant legacy service IDs Reader access to Object Storage buckets containing database credentials and backup exports, enabling data exfiltration without direct database access.',
          diagramAttackPathId: 'ap-ibm-cos-cred-harvest',
          steps: [
            { order: 1, edgeId: 'ibm-edge-9', sourceNodeId: 'ibm-vsi', targetNodeId: 'ibm-object-storage', technique: 'T1530: Data from Cloud Storage' },
            { order: 2, edgeId: 'ibm-edge-12', sourceNodeId: 'ibm-object-storage', targetNodeId: 'ibm-log-analysis', technique: 'T1070.001: Indicator Removal - Clear Event Logs' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
      ],
      updatedAt: NOW,
    },
    createdAt: NOW, updatedAt: NOW,
  },
];

const soaEntries = [
  {
    id: 'soa-ibm-a01', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A01', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'VPC ACLs grant partner networks broader access than required. Security gateway in detect mode does not enforce access decisions.',
    mitigatesRiskIds: ['risk-broad-partner-acls', 'risk-ssh-shared-sg'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'soa-ibm-a02', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A02', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'PostgreSQL replica runs without encryption at rest. Key Protect key rings shared across dev and production.',
    mitigatesRiskIds: ['risk-unencrypted-replica', 'risk-shared-keyring'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'soa-ibm-a05', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A05', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Security gateway in detect mode, X-Forwarded-For trusted, wildcard certs without rotation, App ID sessions without timeout.',
    mitigatesRiskIds: ['risk-appid-session', 'risk-wildcard-cert'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'soa-ibm-a07', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A07', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'IAM enforces RBAC but MFA disabled for service IDs. App ID social login sessions lack expiry controls.',
    mitigatesRiskIds: ['risk-appid-session', 'risk-stale-cos-iam'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'soa-ibm-a09', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A09', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'implemented' as const,
    justification: 'Activity Tracker deployed but limited to us-south. Cloud Monitoring uses 5-minute intervals with anomaly detection disabled. Log Analysis throttled.',
    mitigatesRiskIds: ['risk-monitoring-gaps'],
    diagramRefs: [],
    evidence: [
      {
        id: 'evidence-ibm-a09-tracker',
        kind: 'link' as const,
        name: 'Activity Tracker regional configuration export',
        url: 'https://security.ibmcorp.local/reports/activity-tracker-config',
        note: 'Shows us-south only routing',
        createdAt: NOW,
      },
    ],
    updatedAt: NOW,
  },
  {
    id: 'soa-ibm-cis-03', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.03', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Database replica lacks encryption at rest. Object Storage buckets have stale IAM policies and no lifecycle rules.',
    mitigatesRiskIds: ['risk-unencrypted-replica', 'risk-stale-cos-iam'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'soa-ibm-cis-04', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.04', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Security gateway in detect mode, partner ACLs overly broad, wildcard certificates deployed without rotation policy.',
    mitigatesRiskIds: ['risk-broad-partner-acls', 'risk-wildcard-cert'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'soa-ibm-cis-06', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.06', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'IAM RBAC in place but service IDs lack MFA. Stale Object Storage policies grant unnecessary access.',
    mitigatesRiskIds: ['risk-stale-cos-iam'],
    diagramRefs: [],
    evidence: [
      {
        id: 'evidence-ibm-cis06-iam',
        kind: 'link' as const,
        name: 'IAM policy audit report Q2 2025',
        url: 'https://security.ibmcorp.local/reports/iam-audit-q2',
        note: 'Identifies 14 stale service ID bindings',
        createdAt: NOW,
      },
    ],
    updatedAt: NOW,
  },
  {
    id: 'soa-ibm-cis-08', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.08', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Activity Tracker deployed but single-region. Key Protect audit logs not forwarded. Log Analysis quota insufficient.',
    mitigatesRiskIds: ['risk-monitoring-gaps', 'risk-shared-keyring'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
];

const workflowTasks = [
  {
    id: 'task-ibm-acl-restrict',
    title: 'Restrict VPC ACLs to least-privilege partner ranges',
    description: 'Review and tighten transit gateway route filters and VPC ACL rules to limit partner network access to designated service subnets only.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'critical' as const,
    owner: 'Network Security',
    dueDate: '2025-06-15',
    riskId: 'risk-broad-partner-acls',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'task-ibm-keyring-isolate',
    title: 'Isolate Key Protect key rings per environment',
    description: 'Provision separate Key Protect instances for development and production; migrate existing keys and update service bindings.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Security Operations',
    dueDate: '2025-06-30',
    riskId: 'risk-shared-keyring',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'task-ibm-cos-audit',
    title: 'Audit and revoke stale Object Storage IAM bindings',
    description: 'Enumerate all service IDs with access to COS buckets; revoke Reader role for decommissioned teams; implement quarterly review.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Cloud Operations',
    dueDate: '2025-06-20',
    riskId: 'risk-stale-cos-iam',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'task-ibm-appid-session',
    title: 'Enforce App ID session timeout and refresh token TTL',
    description: 'Configure 30-minute idle timeout and 24-hour refresh token expiry on all App ID instances.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'high' as const,
    owner: 'Platform Engineering',
    dueDate: '2025-06-20',
    riskId: 'risk-appid-session',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'task-ibm-evidence-a09',
    title: 'Attach Activity Tracker configuration evidence for A09',
    description: 'Export Activity Tracker routing configuration showing single-region limitation.',
    type: 'evidence' as const,
    status: 'done' as const,
    priority: 'medium' as const,
    owner: 'Security Operations',
    dueDate: '2025-06-01',
    controlSetId: OWASP_CONTROL_SET_ID,
    controlId: 'A09',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'task-ibm-assessment-followup',
    title: 'Complete assessment threat model review and finalize findings',
    type: 'assessment' as const,
    status: 'blocked' as const,
    priority: 'medium' as const,
    owner: 'Security Architecture',
    dueDate: '2025-07-01',
    assessmentId: 'assessment-ibm-shared-hub',
    createdAt: NOW, updatedAt: NOW,
  },
];

const governanceDocuments = [
  {
    id: 'gov-ibm-cloud-security-policy',
    title: 'IBM Cloud Security Baseline Policy',
    type: 'policy' as const,
    description: 'Corporate policy defining minimum security requirements for all IBM Cloud deployments including encryption, access control, and monitoring standards.',
    owner: 'CISO',
    status: 'active' as const,
    version: '2.3',
    url: 'https://sharepoint.ibmcorp.local/policies/cloud-security-baseline-v2.3.pdf',
    reviewDate: '2025-03-01',
    nextReviewDate: '2025-09-01',
    tags: ['cloud', 'security', 'baseline'],
    linkedRiskIds: [],
    linkedControlSetIds: [OWASP_CONTROL_SET_ID],
    linkedAssessmentIds: ['assessment-ibm-shared-hub'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'gov-ibm-key-mgmt-sop',
    title: 'Encryption Key Management SOP',
    type: 'sop' as const,
    description: 'Standard operating procedure for Key Protect key ring provisioning, rotation, and environment segregation.',
    owner: 'Security Operations',
    status: 'under_review' as const,
    version: '1.1',
    url: 'https://sharepoint.ibmcorp.local/sops/key-mgmt-sop-v1.1.docx',
    reviewDate: '2025-01-15',
    nextReviewDate: '2025-07-15',
    tags: ['encryption', 'key-management', 'key-protect'],
    linkedRiskIds: ['risk-shared-keyring'],
    linkedControlSetIds: [OWASP_CONTROL_SET_ID],
    linkedAssessmentIds: [],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'gov-ibm-partner-access-guideline',
    title: 'Partner Network Access Guideline',
    type: 'guideline' as const,
    description: 'Guidelines for provisioning and reviewing partner VPN access, transit gateway route filters, and VPC ACL rules.',
    owner: 'Network Security',
    status: 'active' as const,
    version: '1.0',
    url: 'https://sharepoint.ibmcorp.local/guidelines/partner-access-v1.0.pdf',
    tags: ['partner', 'vpn', 'access-control', 'network'],
    linkedRiskIds: ['risk-broad-partner-acls', 'risk-ssh-shared-sg'],
    linkedControlSetIds: [CIS_CONTROL_SET_ID],
    linkedAssessmentIds: ['assessment-ibm-shared-hub'],
    createdAt: NOW, updatedAt: NOW,
  },
];

const threatActors = [
  {
    id: 'threat-actor-partner-abuse', name: 'Compromised Partner Operator',
    type: 'nation_state' as const, capabilityLevel: 3,
    resourceLevel: 'moderate' as const,
    motivation: 'Leverage trusted partner VPN access to pivot into shared services for espionage or data exfiltration.',
    description: 'Threat actor operating through a compromised partner organization with legitimate VPN access to the shared services hub. Exploits broad ACLs and trusted network paths.',
    targetedAssetIds: ['asset-ibm-vsi', 'asset-ibm-database', 'asset-ibm-object-storage'],
    tags: ['partner-compromise', 'lateral-movement', 'trusted-access'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'threat-actor-insider', name: 'Disgruntled Cloud Administrator',
    type: 'insider' as const, capabilityLevel: 4,
    resourceLevel: 'moderate' as const,
    motivation: 'Personal grievance or financial incentive to exfiltrate tenant data using privileged IAM access and knowledge of shared key rings.',
    description: 'Current or recently departed cloud administrator with IAM privileges, knowledge of shared Key Protect key rings, and access to bastion hosts.',
    targetedAssetIds: ['asset-ibm-iam', 'asset-ibm-key-protect', 'asset-ibm-database'],
    tags: ['insider-threat', 'privileged-access', 'key-management'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'threat-actor-automated', name: 'Automated Cloud Scanners',
    type: 'opportunistic' as const, capabilityLevel: 1,
    resourceLevel: 'very_low' as const,
    motivation: 'Automated discovery and exploitation of misconfigured cloud services, exposed SSH, and stale IAM policies.',
    description: 'Automated scanning infrastructure targeting exposed cloud management interfaces, SSH endpoints, and misconfigured storage buckets.',
    targetedAssetIds: ['asset-ibm-vsi', 'asset-ibm-object-storage'],
    tags: ['automated', 'mass-scanning', 'cloud-misconfig'],
    createdAt: NOW, updatedAt: NOW,
  },
];

const threatScenarios = [
  {
    id: 'scenario-ibm-partner-pivot', title: 'Partner Network Lateral Movement to Database',
    description: 'A compromised partner operator uses the trusted VPN tunnel to traverse the detect-only security gateway, exploit broad VPC ACLs to SSH into virtual server instances, and pivot to the PostgreSQL database using credentials found in Object Storage.',
    threatActorId: 'threat-actor-partner-abuse',
    targetedAssetIds: ['asset-ibm-vsi', 'asset-ibm-database', 'asset-ibm-security-gateway'],
    attackTechniques: ['T1133 - External Remote Services', 'T1021.004 - Remote Services: SSH', 'T1078 - Valid Accounts', 'T1005 - Data from Local System'],
    linkedRiskIds: ['risk-broad-partner-acls', 'risk-ssh-shared-sg', 'risk-unencrypted-replica'],
    likelihood: 'High - partner VPN is always on and ACLs have not been reviewed in 18 months.',
    impact: 'Critical - direct access to primary tenant database with confidential customer data.',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'scenario-ibm-insider-key-abuse', title: 'Insider Key Ring Abuse for Cross-Environment Access',
    description: 'A disgruntled cloud administrator exploits shared Key Protect key rings to decrypt production data using development environment credentials, then exfiltrates via Object Storage buckets with stale IAM policies.',
    threatActorId: 'threat-actor-insider',
    targetedAssetIds: ['asset-ibm-key-protect', 'asset-ibm-database', 'asset-ibm-object-storage'],
    attackTechniques: ['T1552.001 - Unsecured Credentials: Credentials in Files', 'T1530 - Data from Cloud Storage', 'T1567 - Exfiltration Over Web Service'],
    linkedRiskIds: ['risk-shared-keyring', 'risk-stale-cos-iam'],
    likelihood: 'Moderate - requires insider access but shared key rings lower the barrier significantly.',
    impact: 'Critical - production encryption keys compromised; full database decryption possible.',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'scenario-ibm-token-hijack', title: 'App ID Token Hijack for Persistent Access',
    description: 'An attacker steals a social login refresh token through phishing or session fixation. Because refresh tokens never expire, the attacker maintains persistent access to customer-facing services without re-authentication.',
    threatActorId: 'threat-actor-automated',
    targetedAssetIds: ['asset-ibm-app-id', 'asset-ibm-vsi'],
    attackTechniques: ['T1528 - Steal Application Access Token', 'T1550.001 - Use Alternate Authentication Material: Application Access Token'],
    linkedRiskIds: ['risk-appid-session'],
    likelihood: 'High - refresh tokens never expire; any single token theft grants indefinite access.',
    impact: 'Major - persistent unauthorized access to customer accounts and associated data.',
    createdAt: NOW, updatedAt: NOW,
  },
];

export const ibmCloudSharedHubGrcWorkspace: GrcWorkspace = buildGrcWorkspace({
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
      id: 'ibm-si-shared-services-hardening', title: 'Shared Services Security Hardening',
      description: 'Harden shared services hub by remediating partner network ACLs, SSH security group sharing, and implementing per-environment key ring isolation.',
      category: 'uplift' as const, status: 'in_progress' as const, priority: 'critical' as const,
      owner: 'Cloud Operations', executiveSponsor: 'VP Infrastructure',
      currentState: 'Overly broad partner ACLs permit lateral movement; shared SSH security groups across environments; Key Protect key rings shared between dev and prod.',
      targetState: 'Least-privilege partner ACLs per service; dedicated SSH security groups per environment; isolated Key Protect key rings with environment-specific access policies.',
      startDate: '2025-02-01T00:00:00.000Z', targetDate: '2025-10-31T00:00:00.000Z', completedDate: '',
      milestones: [
        { id: 'ibm-ms-acl-remediation', title: 'Partner Network ACL Remediation', description: 'Replace broad CIDR-based partner ACLs with service-specific rules and implement ACL change approval workflow.', status: 'in_progress' as const, dueDate: '2025-06-30T00:00:00.000Z', completedDate: '', owner: 'Network Security' },
        { id: 'ibm-ms-ssh-segmentation', title: 'SSH Security Group Segmentation', description: 'Create per-environment SSH security groups and remove shared security group from all VSIs.', status: 'pending' as const, dueDate: '2025-08-31T00:00:00.000Z', completedDate: '', owner: 'Platform Engineering' },
        { id: 'ibm-ms-keyring-isolation', title: 'Key Protect Key Ring Isolation', description: 'Provision separate Key Protect key rings per environment with dedicated IAM access policies and rotation schedules.', status: 'pending' as const, dueDate: '2025-10-31T00:00:00.000Z', completedDate: '', owner: 'Security Operations' },
      ],
      linkedRiskIds: ['risk-broad-partner-acls', 'risk-ssh-shared-sg', 'risk-shared-keyring'],
      linkedControlSetIds: [],
      linkedAssetIds: ['asset-ibm-vsi', 'asset-ibm-security-gateway', 'asset-ibm-key-protect'],
      linkedImplementedControlIds: ['ibm-ic-secrets-management', 'ibm-ic-network-acl-monitor'],
      linkedAssessmentIds: ['assessment-ibm-shared-hub'],
      notes: 'Penetration test demonstrated lateral movement via shared security groups. Remediation prioritized by risk committee.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'ibm-si-monitoring-coverage', title: 'Multi-Region Audit and Monitoring Coverage',
      description: 'Extend Activity Tracker and monitoring coverage to all IBM Cloud regions and close audit blind spots for object storage and database replicas.',
      category: 'uplift' as const, status: 'approved' as const, priority: 'high' as const,
      owner: 'Security Operations', executiveSponsor: 'CISO',
      currentState: 'Activity Tracker only configured for us-south; database replicas without encryption at rest; stale IAM policies on object storage undetected.',
      targetState: 'Activity Tracker routing events from all regions; encrypted database replicas with automated compliance checks; IAM policy drift detection.',
      startDate: '2025-05-01T00:00:00.000Z', targetDate: '2026-01-31T00:00:00.000Z', completedDate: '',
      milestones: [
        { id: 'ibm-ms-activity-tracker-multiregion', title: 'Multi-Region Activity Tracker Deployment', description: 'Configure Activity Tracker event routing for eu-de, eu-gb, and au-syd regions with centralized SIEM forwarding.', status: 'pending' as const, dueDate: '2025-08-01T00:00:00.000Z', completedDate: '', owner: 'Security Operations' },
        { id: 'ibm-ms-iam-drift-detection', title: 'IAM Policy Drift Detection', description: 'Deploy automated IAM policy scanning to detect stale object storage policies and orphaned service IDs.', status: 'pending' as const, dueDate: '2025-11-01T00:00:00.000Z', completedDate: '', owner: 'Identity & Access Management' },
      ],
      linkedRiskIds: ['risk-monitoring-gaps', 'risk-stale-cos-iam', 'risk-unencrypted-replica'],
      linkedControlSetIds: [],
      linkedAssetIds: ['asset-ibm-activity-tracker', 'asset-ibm-object-storage', 'asset-ibm-database'],
      linkedImplementedControlIds: ['ibm-ic-activity-tracker'],
      linkedAssessmentIds: ['assessment-ibm-shared-hub'],
      notes: 'Compliance audit finding: events from non-primary regions not captured. Multi-region routing essential for regulatory requirements.',
      createdAt: NOW, updatedAt: NOW,
    },
  ],
  implementedControls: [
    {
      id: 'ibm-ic-secrets-management', title: 'IBM Key Protect Secrets Management',
      description: 'Centralized encryption key management using IBM Key Protect with BYOK support, automatic key rotation, and envelope encryption for data services.',
      controlType: 'technical' as const, category: 'encryption' as const,
      status: 'active' as const, automationLevel: 'semi_automated' as const,
      owner: 'Security Operations', vendor: 'IBM', product: 'Key Protect', version: 'GA',
      implementedDate: '2024-04-01T00:00:00.000Z', lastReviewDate: NOW, nextReviewDate: '2025-10-01T00:00:00.000Z',
      linkedSoaEntryIds: ['soa-ibm-a02', 'soa-ibm-cis-03'],
      linkedRiskIds: ['risk-shared-keyring', 'risk-unencrypted-replica'],
      linkedAssetIds: ['asset-ibm-key-protect', 'asset-ibm-database'],
      linkedAssessmentIds: ['assessment-ibm-shared-hub'],
      notes: 'Key rings currently shared across environments. Isolation project in progress. Wildcard cert private keys stored here.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'ibm-ic-network-acl-monitor', title: 'Security Group and ACL Monitoring',
      description: 'Automated monitoring of VPC security groups and network ACL changes with drift detection and alerting for unauthorized rule modifications.',
      controlType: 'technical' as const, category: 'network_security' as const,
      status: 'active' as const, automationLevel: 'fully_automated' as const,
      owner: 'Network Security', vendor: 'Palo Alto', product: 'Prisma Cloud', version: '32.01',
      implementedDate: '2024-09-01T00:00:00.000Z', lastReviewDate: NOW, nextReviewDate: '2025-12-01T00:00:00.000Z',
      linkedSoaEntryIds: ['soa-ibm-a01', 'soa-ibm-cis-06'],
      linkedRiskIds: ['risk-broad-partner-acls', 'risk-ssh-shared-sg'],
      linkedAssetIds: ['asset-ibm-security-gateway', 'asset-ibm-vsi'],
      linkedAssessmentIds: ['assessment-ibm-shared-hub'],
      notes: 'Runtime protection covers Code Engine containers. VSI workload onboarding planned for Q3.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'ibm-ic-activity-tracker', title: 'IBM Cloud Activity Tracker',
      description: 'Cloud-native audit logging service capturing API calls, resource lifecycle events, and IAM authentication events for compliance and forensic analysis.',
      controlType: 'technical' as const, category: 'logging' as const,
      status: 'active' as const, automationLevel: 'fully_automated' as const,
      owner: 'Security Operations', vendor: 'IBM', product: 'Activity Tracker Event Routing', version: 'GA',
      implementedDate: '2024-01-15T00:00:00.000Z', lastReviewDate: NOW, nextReviewDate: '2025-09-01T00:00:00.000Z',
      linkedSoaEntryIds: ['soa-ibm-a09', 'soa-ibm-cis-08'],
      linkedRiskIds: ['risk-monitoring-gaps', 'risk-stale-cos-iam'],
      linkedAssetIds: ['asset-ibm-activity-tracker', 'asset-ibm-iam'],
      linkedAssessmentIds: ['assessment-ibm-shared-hub'],
      notes: 'Only configured for us-south region. Multi-region event routing gaps create audit blind spots.',
      createdAt: NOW, updatedAt: NOW,
    },
  ],
  appetiteRules: DEFAULT_APPETITE_RULES,
  thirdParties: [
    {
      id: 'ibm-tp-ibmcloud', name: 'IBM Cloud', description: 'Primary cloud infrastructure provider hosting VSI, databases, object storage, and all shared services.',
      category: 'cloud_provider' as const, status: 'active' as const, riskRating: 'critical' as const, dataClassification: 'confidential' as const,
      linkedAssetIds: ['asset-ibm-vsi', 'asset-ibm-database', 'asset-ibm-object-storage', 'asset-ibm-iam', 'asset-ibm-key-protect', 'asset-ibm-activity-tracker'],
      linkedRiskIds: ['risk-broad-partner-acls', 'risk-ssh-shared-sg', 'risk-stale-cos-iam', 'risk-unencrypted-replica', 'risk-monitoring-gaps'],
      contactName: 'Richard Nakamura', contactEmail: 'richard.nakamura@ibm.com',
      contractExpiry: '2028-03-31T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-08-01T00:00:00.000Z',
      notes: 'Activity Tracker only configured for us-south. Multi-region event routing gaps identified.',
    },
    {
      id: 'ibm-tp-hashicorp', name: 'HashiCorp', description: 'Infrastructure-as-code platform providing Terraform for IBM Cloud resource provisioning and state management.',
      category: 'saas' as const, status: 'active' as const, riskRating: 'medium' as const, dataClassification: 'internal' as const,
      linkedAssetIds: ['asset-ibm-vsi', 'asset-ibm-security-gateway'], linkedRiskIds: ['risk-ssh-shared-sg'],
      contactName: 'Alex Patel', contactEmail: 'alex.patel@hashicorp.com',
      contractExpiry: '2027-06-30T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-09-15T00:00:00.000Z',
      notes: 'Terraform state contains service credentials. Remote backend encryption and access controls under review.',
    },
    {
      id: 'ibm-tp-venafi', name: 'Venafi', description: 'Machine identity and TLS certificate lifecycle management platform.',
      category: 'saas' as const, status: 'active' as const, riskRating: 'high' as const, dataClassification: 'confidential' as const,
      linkedAssetIds: ['asset-ibm-key-protect'], linkedRiskIds: ['risk-shared-keyring', 'risk-wildcard-cert'],
      contactName: 'Diana Ross', contactEmail: 'diana.ross@venafi.com',
      contractExpiry: '2027-01-31T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-07-01T00:00:00.000Z',
      notes: 'Wildcard certificates deployed without rotation policy. Private keys exported for partner integration flagged as high risk.',
    },
    {
      id: 'ibm-tp-prismacloud', name: 'Palo Alto Prisma Cloud', description: 'Container security and cloud workload protection platform for runtime threat detection.',
      category: 'saas' as const, status: 'active' as const, riskRating: 'medium' as const, dataClassification: 'internal' as const,
      linkedAssetIds: ['asset-ibm-vsi', 'asset-ibm-security-gateway'], linkedRiskIds: ['risk-monitoring-gaps', 'risk-broad-partner-acls'],
      contactName: 'Kevin Wu', contactEmail: 'kevin.wu@paloaltonetworks.com',
      contractExpiry: '2026-12-31T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-08-15T00:00:00.000Z',
      notes: 'Runtime protection configured for Code Engine containers. VSI workloads not yet onboarded.',
    },
  ],
});

export const ibmCloudSharedHub: ExampleSystem = {
  id: 'ibm-cloud-shared-hub',
  name: 'IBM Cloud Shared Services Hub',
  description: 'Regional IBM Cloud deployment hosting shared services where network ACLs, storage policies, and monitoring have drifted.',
  category: 'Cloud Vendor Architectures',
  primaryZone: 'Cloud',
  dataClassification: 'Sensitive',
  grcWorkspace: ibmCloudSharedHubGrcWorkspace,
  customContext: `
## IBM Cloud Shared Services – Hidden Weaknesses

- **IBM Cloud Internet Services** configured only for DNS; no active WAF or DDoS profile.
- **Transit Gateway** route filters allow partner networks deeper access than intended.
- **Virtual Server Instance** exposes SSH via shared security group used by integration hosts.
- **Object Storage** bucket retains legacy IAM policies granting reader role to service IDs no longer monitored.
- **Database for PostgreSQL** replica runs without encryption at rest to lower latency.
- **Security Gateway** appliance runs in detect mode and trusts X-Forwarded-For headers.
- **App ID** uses social identity providers with no session timeout enforcement; refresh tokens never expire.
- **Key Protect** key rings shared across development and production environments; audit logs not forwarded.
- **Security Advisor** findings ignored for 180+ days; custom rule engine disabled to reduce false positives.
- **Certificate Manager** stores wildcard certificates without rotation policy; private keys exported for partner integration.
- **Activity Tracker** event routing configured only for us-south; multi-region deployments lack visibility.
- **Cloud Monitoring** dashboards rely on 5-minute intervals; real-time anomaly detection disabled to save costs.

The scenario demonstrates how shared service hubs accumulate technical debt that adversaries can chain together for privilege escalation and data exfiltration.
`,
  nodes: [
    {
      id: 'ibm-internet-zone',
      type: 'securityZone',
      position: { x: 50, y: 50 },
      data: {
        label: 'Internet',
        zoneType: 'Internet' as SecurityZone,
        description: 'External customers and partner networks'
      },
      style: {
        width: 600,
        height: 900,
        background: colors.zoneBackgrounds.Internet,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'ibm-customers',
      type: 'user',
      position: { x: 225, y: 175 },
      data: {
        label: 'Customer Traffic',
        description: 'Clients consuming managed services hosted in IBM Cloud',
        zone: 'Internet' as SecurityZone,
        dataClassification: 'Public'
      }
    } as SecurityNode,
    {
      id: 'ibm-partner',
      type: 'user',
      position: { x: 275, y: 525 },
      data: {
        label: 'Partner Network',
        description: 'Partner-managed site connected via IPSec tunnel',
        zone: 'Internet' as SecurityZone,
        dataClassification: 'Public'
      }
    } as SecurityNode,

    {
      id: 'ibm-edge-zone',
      type: 'securityZone',
      position: { x: 770, y: 50 },
      data: {
        label: 'IBM Cloud Edge',
        zoneType: 'DMZ' as SecurityZone,
        description: 'Edge services providing ingress control and traffic inspection'
      },
      style: {
        width: 750,
        height: 900,
        background: colors.zoneBackgrounds.DMZ,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'ibm-cis',
      type: 'cloudFirewall',
      position: { x: 925, y: 175 },
      data: {
        label: 'IBM Cloud Internet Services',
        description: 'Provides DNS and optional WAF/DDoS features',
        zone: 'DMZ' as SecurityZone,
        dataClassification: 'Internal',
        additionalContext: 'WAF policy left in monitor-only mode; no rate limiting configured.'
      }
    } as SecurityNode,
    {
      id: 'ibm-security-gateway',
      type: 'ibmSecurityGateway',
      position: { x: 1125, y: 175 },
      data: {
        label: 'Security Gateway',
        description: 'Virtual appliance inspecting inbound/outbound traffic',
        zone: 'DMZ' as SecurityZone,
        dataClassification: 'Internal',
        additionalContext: 'Policy trusts X-Forwarded-For headers and allows partner CIDRs broadly.'
      }
    } as SecurityNode,
    {
      id: 'ibm-load-balancer',
      type: 'loadBalancer',
      position: { x: 1275, y: 175 },
      data: {
        label: 'Application Load Balancer',
        description: 'Distributes traffic to virtual server instances',
        zone: 'DMZ' as SecurityZone,
        dataClassification: 'Internal',
        additionalContext: 'Health checks use HTTP instead of HTTPS; backend pool includes decommissioned instances.'
      }
    } as SecurityNode,

    {
      id: 'ibm-cloud-zone',
      type: 'securityZone',
      position: { x: 1540, y: 50 },
      data: {
        label: 'IBM Cloud Shared Services',
        zoneType: 'Cloud' as SecurityZone,
        description: 'Core workloads and data services supporting customers'
      },
      style: {
        width: 950,
        height: 900,
        background: colors.zoneBackgrounds.Cloud,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'ibm-vsi',
      type: 'ibmVirtualServer',
      position: { x: 1675, y: 175 },
      data: {
        label: 'Virtual Server Instances',
        description: 'Hosts legacy integration services reachable over SSH',
        zone: 'Cloud' as SecurityZone,
        dataClassification: 'Sensitive',
        additionalContext: 'Security group allows SSH from partner ranges; fail2ban disabled after performance issues.'
      }
    } as SecurityNode,
    {
      id: 'ibm-code-engine',
      type: 'ibmCodeEngine',
      position: { x: 2075, y: 275 },
      data: {
        label: 'Code Engine',
        description: 'Serverless container platform running batch jobs',
        zone: 'Cloud' as SecurityZone,
        dataClassification: 'Sensitive',
        additionalContext: 'Jobs run with default service credentials; logs retained only 7 days.'
      }
    } as SecurityNode,
    {
      id: 'ibm-object-storage',
      type: 'ibmObjectStorage',
      position: { x: 1875, y: 425 },
      data: {
        label: 'Cloud Object Storage',
        description: 'Stores backups and data exports for downstream analytics',
        zone: 'Cloud' as SecurityZone,
        dataClassification: 'Sensitive',
        additionalContext: 'Bucket allows Reader access to service IDs belonging to decommissioned teams; no lifecycle policy.'
      }
    } as SecurityNode,
    {
      id: 'ibm-database',
      type: 'ibmDatabase',
      position: { x: 1675, y: 475 },
      data: {
        label: 'IBM Cloud Databases for PostgreSQL',
        description: 'Primary tenant database with HA replica',
        zone: 'Cloud' as SecurityZone,
        dataClassification: 'Confidential',
        additionalContext: 'Replica disk encryption disabled to reduce failover latency; service credentials stored in Object Storage.'
      }
    } as SecurityNode,
    {
      id: 'ibm-vpc',
      type: 'ibmVPC',
      position: { x: 2425, y: 75 },
      data: {
        label: 'IBM VPC Transit Hub',
        description: 'Connects partner VPN and service subnets',
        zone: 'Cloud' as SecurityZone,
        dataClassification: 'Internal',
        additionalContext: 'ACL rules allow partner CIDRs to reach management subnet; flow logs disabled.'
      }
    } as SecurityNode,

    {
      id: 'ibm-ops-zone',
      type: 'securityZone',
      position: { x: 2710, y: 50 },
      data: {
        label: 'Operations & Monitoring',
        zoneType: 'Management' as SecurityZone,
        description: 'Identity, monitoring, and privileged access services'
      },
      style: {
        width: 850,
        height: 900,
        background: colors.zoneBackgrounds.Management,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'ibm-iam',
      type: 'identityProvider',
      position: { x: 3225, y: 725 },
      data: {
        label: 'IBM Cloud IAM',
        description: 'Identity and Access Management with role-based access control',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Confidential',
        additionalContext: 'API keys shared via password manager; MFA enforcement disabled for service IDs.'
      }
    } as SecurityNode,
    {
      id: 'ibm-app-id',
      type: 'ibmAppID',
      position: { x: 2975, y: 125 },
      data: {
        label: 'App ID',
        description: 'Customer-facing authentication and authorization service',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Confidential',
        additionalContext: 'Social identity providers configured without session timeout; refresh tokens never expire.'
      }
    } as SecurityNode,
    {
      id: 'ibm-key-protect',
      type: 'ibmKeyProtect',
      position: { x: 2775, y: 425 },
      data: {
        label: 'Key Protect',
        description: 'Encryption key management service with HSM backing',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Confidential',
        additionalContext: 'Key rings shared across dev and production; audit logs not forwarded to Activity Tracker.'
      }
    } as SecurityNode,
    {
      id: 'ibm-security-advisor',
      type: 'ibmSecurityAdvisor',
      position: { x: 2775, y: 275 },
      data: {
        label: 'Security Advisor',
        description: 'Centralized security insights and compliance dashboard',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Sensitive',
        additionalContext: 'Findings ignored for 180+ days; custom rule engine disabled to reduce false positives.'
      }
    } as SecurityNode,
    {
      id: 'ibm-certificate-manager',
      type: 'ibmCertificateManager',
      position: { x: 2975, y: 825 },
      data: {
        label: 'Certificate Manager',
        description: 'TLS certificate lifecycle management and renewal',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Sensitive',
        additionalContext: 'Wildcard certificates used without rotation policy; private keys exported for partner integration.'
      }
    } as SecurityNode,
    {
      id: 'ibm-activity-tracker',
      type: 'ibmActivityTracker',
      position: { x: 2775, y: 175 },
      data: {
        label: 'Activity Tracker',
        description: 'Audit event collection and analysis',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Sensitive',
        additionalContext: 'Event routing configured only for us-south; multi-region deployments lack visibility.'
      }
    } as SecurityNode,
    {
      id: 'ibm-cloud-monitoring',
      type: 'ibmCloudMonitoring',
      position: { x: 2775, y: 525 },
      data: {
        label: 'Cloud Monitoring',
        description: 'Infrastructure and application performance metrics',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Sensitive',
        additionalContext: 'Dashboards rely on 5-minute intervals; real-time anomaly detection disabled to save costs.'
      }
    } as SecurityNode,
    {
      id: 'ibm-log-analysis',
      type: 'ibmLogAnalysis',
      position: { x: 3175, y: 575 },
      data: {
        label: 'Log Analysis',
        description: 'Centralized logging with search and alerting',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Sensitive',
        additionalContext: 'Forwarding throttled to 10 GB/day; logs from transit gateway dropped during bursts.'
      }
    } as SecurityNode,
    {
      id: 'ibm-bastion',
      type: 'bastionHost',
      position: { x: 2775, y: 725 },
      data: {
        label: 'Operations Bastion',
        description: 'Jump host for SFTP and database administration',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Internal',
        additionalContext: 'Shares subnet with production virtual servers; outbound rules unrestricted.'
      }
    } as SecurityNode
  ],
  edges: [
    {
      id: 'ibm-edge-1',
      source: 'ibm-customers',
      target: 'ibm-cis',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'HTTPS Requests',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Public',
        zone: 'DMZ' as SecurityZone,
        animated: true,
        additionalContext: 'CIS only configured for DNS/WAF monitoring; no blocking rules applied.'
      }
    } as SecurityEdge,
    {
      id: 'ibm-edge-2',
      source: 'ibm-partner',
      target: 'ibm-security-gateway',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'VPN Tunnel',
        protocol: 'IPSec',
        encryption: 'AES-256',
        securityLevel: 'Medium',
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone,
        controlPoints: [{ id: 'cp2', x: 1150, y: 550, active: true }],
        additionalContext: 'Security gateway trusts partner subnets broadly; minimal inspection of east-west traffic.'
      }
    } as SecurityEdge,
    {
      id: 'ibm-edge-3',
      source: 'ibm-cis',
      target: 'ibm-security-gateway',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Inbound Traffic',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'ibm-edge-4',
      source: 'ibm-security-gateway',
      target: 'ibm-load-balancer',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Filtered Traffic',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'ibm-edge-5',
      source: 'ibm-load-balancer',
      target: 'ibm-vpc',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Routed Sessions',
        protocol: 'TCP',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Internal',
        zone: 'Cloud' as SecurityZone,
        additionalContext: 'Gateway allows partner network to reach management subnet due to broad ACLs.'
      }
    } as SecurityEdge,
    {
      id: 'ibm-edge-6',
      source: 'ibm-vpc',
      target: 'ibm-vsi',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Inbound SSH',
        protocol: 'SSH',
        encryption: 'AES-256',
        securityLevel: 'Low',
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone,
        additionalContext: 'Security group shared across workloads; partner credentials reused for debugging.'
      }
    } as SecurityEdge,
    {
      id: 'ibm-edge-7',
      source: 'ibm-vpc',
      target: 'ibm-code-engine',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Job Invocations',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone,
        controlPoints: [{ id: 'cp3', x: 2500, y: 150 }]
      }
    } as SecurityEdge,
    {
      id: 'ibm-edge-8',
      source: 'ibm-vsi',
      target: 'ibm-database',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'App Queries',
        protocol: 'PostgreSQL',
        encryption: 'TLS 1.2',
        securityLevel: 'High',
        dataClassification: 'Confidential',
        zone: 'Cloud' as SecurityZone,
        additionalContext: 'Replica stored unencrypted; credentials managed via Object Storage with broad access.'
      }
    } as SecurityEdge,
    {
      id: 'ibm-edge-9',
      source: 'ibm-vsi',
      target: 'ibm-object-storage',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Backup Exports',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Low',
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone,
        additionalContext: 'Service IDs with Reader role not audited; public buckets remain from legacy testing.'
      }
    } as SecurityEdge,
    {
      id: 'ibm-edge-10',
      source: 'ibm-code-engine',
      target: 'ibm-object-storage',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Batch Outputs',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone,
        controlPoints: [{ id: 'cp4', x: 2000, y: 380 }]
      }
    } as SecurityEdge,
    {
      id: 'ibm-edge-11',
      source: 'ibm-database',
      target: 'ibm-key-protect',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Key Retrieval',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'High',
        dataClassification: 'Confidential',
        zone: 'Management' as SecurityZone,
        controlPoints: [
          { id: 'cp5', x: 1850, y: 500, active: true },
          { id: 'cp-1771638834924', x: 2650, y: 500, active: true }
        ],
        additionalContext: 'Key rings not isolated; production and dev share same encryption keys.'
      }
    } as SecurityEdge,
    {
      id: 'ibm-edge-12',
      source: 'ibm-object-storage',
      target: 'ibm-log-analysis',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Log Exports',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Management' as SecurityZone,
        controlPoints: [{ id: 'cp8', x: 1900, y: 600, active: true }],
        additionalContext: 'Log forwarding fails when daily quota exceeded; alerts suppressed.'
      }
    } as SecurityEdge,
    {
      id: 'ibm-edge-13',
      source: 'ibm-iam',
      target: 'ibm-bastion',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Admin SSH',
        protocol: 'SSH',
        encryption: 'AES-256',
        securityLevel: 'Medium',
        dataClassification: 'Internal',
        zone: 'Management' as SecurityZone,
        controlPoints: [{ id: 'cp9', x: 2870, y: 550 }],
        additionalContext: 'MFA disabled for service IDs; keys rotated manually once a year.'
      }
    } as SecurityEdge,
    {
      id: 'ibm-edge-14',
      source: 'ibm-bastion',
      target: 'ibm-vsi',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Operations Access',
        protocol: 'SSH',
        encryption: 'AES-256',
        securityLevel: 'Low',
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone,
        controlPoints: [{ id: 'cp11', x: 1850, y: 750, active: true }, { id: 'cp12', x: 1850, y: 250, active: true }],
        additionalContext: 'Bastion and workloads share security group; potential lateral movement path.'
      }
    } as SecurityEdge,
    {
      id: 'ibm-edge-15',
      source: 'ibm-vpc',
      target: 'ibm-activity-tracker',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Flow Logs',
        protocol: 'Syslog',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Management' as SecurityZone,
        controlPoints: [{ id: 'cp13', x: 2600, y: 310 }, { id: 'cp14', x: 2700, y: 560 }],
        additionalContext: 'Flow logs disabled to reduce costs; SIEM missing network visibility.'
      }
    } as SecurityEdge,
    {
      id: 'ibm-edge-16',
      source: 'ibm-security-advisor',
      target: 'ibm-vsi',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Vulnerability Scans',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone,
        controlPoints: [{ id: 'cp15', x: 2500, y: 390 }, { id: 'cp16', x: 1800, y: 390 }],
        additionalContext: 'Scans run monthly; high-severity findings remain unpatched for 90+ days.'
      }
    } as SecurityEdge,
    {
      id: 'ibm-edge-17',
      source: 'ibm-certificate-manager',
      target: 'ibm-load-balancer',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'TLS Certificate Deployment',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'High',
        dataClassification: 'Sensitive',
        zone: 'DMZ' as SecurityZone,
        controlPoints: [{ id: 'cp18', x: 1300, y: 850, active: true }],
        additionalContext: 'Wildcard certificates deployed without rotation; private keys exported for debugging.'
      }
    } as SecurityEdge,
    {
      id: 'ibm-edge-18',
      source: 'ibm-app-id',
      target: 'ibm-vsi',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'User Authentication',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'High',
        dataClassification: 'Confidential',
        zone: 'Cloud' as SecurityZone,
        controlPoints: [
          { id: 'cp19', x: 2900, y: 250, active: true },
          { id: 'cp-1771638737591', x: 1950, y: 250, active: true }
        ],
        additionalContext: 'Refresh tokens never expire; social login sessions not tracked.'
      }
    } as SecurityEdge,
    {
      id: 'ibm-edge-19',
      source: 'ibm-cloud-monitoring',
      target: 'ibm-vsi',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Metrics Collection',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone,
        controlPoints: [{ id: 'cp21', x: 2650, y: 550, active: true }, { id: 'cp22', x: 1800, y: 550, active: true }],
        additionalContext: 'Metrics sampled every 5 minutes; anomaly detection disabled.'
      }
    } as SecurityEdge,
    {
      id: 'ibm-edge-20',
      source: 'ibm-log-analysis',
      target: 'ibm-vsi',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Log Ingestion',
        protocol: 'Syslog',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone,
        controlPoints: [{ id: 'cp23', x: 2500, y: 680 }, { id: 'cp24', x: 1800, y: 680 }],
        additionalContext: 'Daily quota throttles log ingestion; critical events dropped during bursts.'
      }
    } as SecurityEdge
  ],
  attackPaths: [
    {
      id: 'ap-ibm-partner-lateral-db',
      name: 'Partner Network Abuse → Database Compromise',
      strideCategory: 'Elevation of Privilege',
      riskLevel: 'Critical',
      description: 'An attacker operating through a compromised partner VPN connection exploits the detect-only security gateway and broad VPC ACLs to SSH into virtual server instances via shared security groups, then pivots to the PostgreSQL database using credentials stored in Object Storage.',
      steps: [
        {
          order: 1,
          edgeId: 'ibm-edge-2',
          sourceNodeId: 'ibm-partner',
          targetNodeId: 'ibm-security-gateway',
          technique: 'T1133: External Remote Services',
        },
        {
          order: 2,
          edgeId: 'ibm-edge-6',
          sourceNodeId: 'ibm-vpc',
          targetNodeId: 'ibm-vsi',
          technique: 'T1021.004: Remote Services - SSH',
        },
        {
          order: 3,
          edgeId: 'ibm-edge-8',
          sourceNodeId: 'ibm-vsi',
          targetNodeId: 'ibm-database',
          technique: 'T1078: Valid Accounts',
        },
      ],
      mitreTechniques: ['T1133', 'T1021.004', 'T1078'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-ibm-cos-cred-harvest',
      name: 'Object Storage Credential Harvest → Data Exfiltration',
      strideCategory: 'Information Disclosure',
      riskLevel: 'High',
      description: 'Stale IAM policies grant decommissioned-team service IDs Reader access to Object Storage buckets containing database credentials and backup exports. An attacker leveraging these stale service IDs can exfiltrate sensitive data and database connection strings without triggering log alerts due to throttled Log Analysis ingestion.',
      steps: [
        {
          order: 1,
          edgeId: 'ibm-edge-9',
          sourceNodeId: 'ibm-vsi',
          targetNodeId: 'ibm-object-storage',
          technique: 'T1530: Data from Cloud Storage',
        },
        {
          order: 2,
          edgeId: 'ibm-edge-12',
          sourceNodeId: 'ibm-object-storage',
          targetNodeId: 'ibm-log-analysis',
          technique: 'T1070.001: Indicator Removal - Clear Event Logs',
        },
      ],
      mitreTechniques: ['T1530', 'T1070.001'],
      createdAt: '2025-06-01T00:05:00.000Z',
      updatedAt: '2025-06-01T00:05:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-ibm-bastion-lateral',
      name: 'Bastion Host Lateral Movement → Production Workloads',
      strideCategory: 'Elevation of Privilege',
      riskLevel: 'High',
      description: 'An attacker who compromises IAM credentials with disabled MFA authenticates to the bastion host, then moves laterally to virtual server instances via the shared security group subnet. The bastion and workloads share the same security group with unrestricted outbound rules.',
      steps: [
        {
          order: 1,
          edgeId: 'ibm-edge-13',
          sourceNodeId: 'ibm-iam',
          targetNodeId: 'ibm-bastion',
          technique: 'T1078.004: Valid Accounts - Cloud Accounts',
        },
        {
          order: 2,
          edgeId: 'ibm-edge-14',
          sourceNodeId: 'ibm-bastion',
          targetNodeId: 'ibm-vsi',
          technique: 'T1021.004: Remote Services - SSH',
        },
        {
          order: 3,
          edgeId: 'ibm-edge-8',
          sourceNodeId: 'ibm-vsi',
          targetNodeId: 'ibm-database',
          technique: 'T1005: Data from Local System',
        },
      ],
      mitreTechniques: ['T1078.004', 'T1021.004', 'T1005'],
      createdAt: '2025-06-01T00:10:00.000Z',
      updatedAt: '2025-06-01T00:10:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-ibm-key-cross-env',
      name: 'Shared Key Ring → Cross-Environment Data Decryption',
      strideCategory: 'Information Disclosure',
      riskLevel: 'Critical',
      description: 'Key Protect key rings are shared between development and production environments. An attacker with access to the development environment can retrieve production encryption keys and decrypt sensitive database contents. Key Protect audit logs are not forwarded to Activity Tracker, leaving the access undetected.',
      steps: [
        {
          order: 1,
          edgeId: 'ibm-edge-11',
          sourceNodeId: 'ibm-database',
          targetNodeId: 'ibm-key-protect',
          technique: 'T1552.001: Unsecured Credentials - Credentials in Files',
        },
        {
          order: 2,
          edgeId: 'ibm-edge-15',
          sourceNodeId: 'ibm-vpc',
          targetNodeId: 'ibm-activity-tracker',
          technique: 'T1562.008: Impair Defenses - Disable Cloud Logs',
        },
      ],
      mitreTechniques: ['T1552.001', 'T1562.008'],
      createdAt: '2025-06-01T00:15:00.000Z',
      updatedAt: '2025-06-01T00:15:00.000Z',
    } as DiagramAttackPath,
  ],
};
