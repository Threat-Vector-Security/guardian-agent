import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityNode, SecurityEdge, SecurityZone } from '../../types/SecurityTypes';
import { DiagramAttackPath, GrcAsset, GrcRisk, GrcAssessment, GrcSoaEntry, GrcTask, GrcGovernanceDocument, GrcThreatActor, GrcThreatScenario, AssessmentThreatModelNodeSourceType, AssessmentThreatModelEdgeSourceType, AttackPathRiskLevel, RiskTierNode } from '../../types/GrcTypes';
import { colors } from '../../styles/Theme';
import { buildGrcWorkspace, score, NOW, OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID } from './grcSharedBase';
import { StrideCategory } from '../../types/ThreatIntelTypes';

const tierCatalogue: RiskTierNode[] = [
  { id: 'edc-tier1-cyber', tier: 1 as const, label: 'Cyber Risk', description: 'Information security and cyber threats to data center infrastructure' },
  { id: 'edc-tier1-operational', tier: 1 as const, label: 'Operational Risk', description: 'Physical operations, availability, and business continuity risks' },
  { id: 'edc-tier1-compliance', tier: 1 as const, label: 'Compliance Risk', description: 'Regulatory and policy compliance obligations' },
  { id: 'edc-tier2-perimeter', tier: 2 as const, label: 'Perimeter Security', parentId: 'edc-tier1-cyber', description: 'Firewall, DMZ, and edge network controls' },
  { id: 'edc-tier2-identity', tier: 2 as const, label: 'Identity & Privileged Access', parentId: 'edc-tier1-cyber', description: 'PAM, PKI, and credential management' },
  { id: 'edc-tier2-data', tier: 2 as const, label: 'Data Protection', parentId: 'edc-tier1-cyber', description: 'Encryption, DLP, and data-at-rest controls' },
  { id: 'edc-tier2-network', tier: 2 as const, label: 'Internal Network Segmentation', parentId: 'edc-tier1-cyber', description: 'Zone segmentation, VLAN, and micro-segmentation' },
  { id: 'edc-tier2-availability', tier: 2 as const, label: 'Availability & Resilience', parentId: 'edc-tier1-operational', description: 'Backup, disaster recovery, and redundancy' },
  { id: 'edc-tier2-monitoring', tier: 2 as const, label: 'Security Monitoring', parentId: 'edc-tier1-operational', description: 'SIEM, logging, and incident detection' },
  { id: 'edc-tier2-cloud-hybrid', tier: 2 as const, label: 'Hybrid Cloud Integration', parentId: 'edc-tier1-operational', description: 'Cloud gateway, workload migration, and multi-cloud security' },
  { id: 'edc-tier2-regulatory', tier: 2 as const, label: 'Regulatory Compliance', parentId: 'edc-tier1-compliance', description: 'PCI DSS, SOX, HIPAA, and GDPR obligations' },
  { id: 'edc-tier3-legacy-tls', tier: 3 as const, label: 'Legacy TLS Endpoints', parentId: 'edc-tier2-perimeter' },
  { id: 'edc-tier3-vpn-weakness', tier: 3 as const, label: 'VPN Authentication Gaps', parentId: 'edc-tier2-perimeter' },
  { id: 'edc-tier3-pam-bypass', tier: 3 as const, label: 'PAM Bypass via Service Accounts', parentId: 'edc-tier2-identity' },
  { id: 'edc-tier3-unencrypted-cache', tier: 3 as const, label: 'Unencrypted Cache Traffic', parentId: 'edc-tier2-data' },
  { id: 'edc-tier3-flat-internal', tier: 3 as const, label: 'Flat Internal Routing', parentId: 'edc-tier2-network' },
  { id: 'edc-tier3-backup-exposure', tier: 3 as const, label: 'Backup Data Exposure', parentId: 'edc-tier2-availability' },
  { id: 'edc-tier3-log-gaps', tier: 3 as const, label: 'Audit Log Coverage Gaps', parentId: 'edc-tier2-monitoring' },
  { id: 'edc-tier3-cloud-drift', tier: 3 as const, label: 'Cloud Configuration Drift', parentId: 'edc-tier2-cloud-hybrid' },
];

const assets: GrcAsset[] = [
  {
    id: 'edc-asset-perimeter-fw', name: 'Perimeter Firewall', type: 'firewall', owner: 'Network Security',
    domain: 'it' as const, category: 'Network Infrastructure',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Palo Alto PA-5220 next-gen firewall with IPS, SSL inspection, and threat prevention at the network edge',
    criticality: { confidentiality: 4, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'enterprise-data-center', nodeId: 'perimeter-fw', nodeLabel: 'Perimeter Firewall', nodeType: 'firewall' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'edc-asset-app-server', name: 'Application Server Farm', type: 'application_server', owner: 'Application Operations',
    domain: 'application' as const, category: 'Compute',
    businessCriticality: 5, securityCriticality: 4,
    description: 'VMware vSphere 7.0 cluster running legacy .NET Framework and modern .NET Core business applications',
    criticality: { confidentiality: 4, integrity: 5, availability: 5, financial: 5, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'enterprise-data-center', nodeId: 'app-server-1', nodeLabel: 'Application Server Farm', nodeType: 'application' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'edc-asset-primary-db', name: 'Primary Database Cluster', type: 'database', owner: 'Database Administration',
    domain: 'application' as const, category: 'Database',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Oracle RAC 19c cluster with TDE, Database Vault, and Audit Vault for core business data including ERP and CRM',
    criticality: { confidentiality: 5, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'enterprise-data-center', nodeId: 'primary-db', nodeLabel: 'Primary Database Cluster', nodeType: 'database' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'edc-asset-vpn', name: 'VPN Concentrator', type: 'vpn_gateway', owner: 'Network Security',
    domain: 'it' as const, category: 'Network Infrastructure',
    businessCriticality: 4, securityCriticality: 5,
    description: 'Cisco ASA 9.16 VPN concentrator providing IPSec and SSL VPN remote access with MFA and certificate authentication',
    criticality: { confidentiality: 5, integrity: 4, availability: 4, financial: 3, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'enterprise-data-center', nodeId: 'vpn-concentrator', nodeLabel: 'VPN Concentrator', nodeType: 'vpnGateway' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'edc-asset-pam', name: 'PAM System', type: 'pam', owner: 'Identity & Access Management',
    domain: 'it' as const, category: 'Security Tools',
    businessCriticality: 5, securityCriticality: 5,
    description: 'CyberArk PAS 12.6 privileged access management vault with session recording, MFA, and approval workflows',
    criticality: { confidentiality: 5, integrity: 5, availability: 4, financial: 4, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'enterprise-data-center', nodeId: 'privileged-access', nodeLabel: 'PAM System', nodeType: 'pam' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'edc-asset-backup', name: 'Backup Infrastructure', type: 'backup_system', owner: 'Infrastructure Operations',
    domain: 'it' as const, category: 'Storage',
    businessCriticality: 4, securityCriticality: 4,
    description: 'Veeam Backup & Replication 11.0 with encryption and immutable storage, running at 90% capacity',
    criticality: { confidentiality: 4, integrity: 5, availability: 5, financial: 4, reputation: 3, safety: 1 },
    diagramRefs: [{ diagramId: 'enterprise-data-center', nodeId: 'backup-system', nodeLabel: 'Backup Infrastructure', nodeType: 'backupSystem' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'edc-asset-db-cache', name: 'Database Cache Layer', type: 'cache', owner: 'Application Operations',
    domain: 'application' as const, category: 'Compute',
    businessCriticality: 3, securityCriticality: 3,
    description: 'Redis Enterprise 6.2.6 in-memory cache on default ports with persistence enabled but no AUTH or TLS configured',
    criticality: { confidentiality: 3, integrity: 3, availability: 3, financial: 2, reputation: 2, safety: 1 },
    diagramRefs: [{ diagramId: 'enterprise-data-center', nodeId: 'db-cache', nodeLabel: 'Database Cache Layer', nodeType: 'cache' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'edc-asset-cloud-workloads', name: 'Cloud Workloads', type: 'cloud_service', owner: 'Cloud Operations',
    domain: 'application' as const, category: 'Cloud Service',
    businessCriticality: 4, securityCriticality: 4,
    description: 'Multi-cloud IaaS and PaaS services with varying security baselines; some development instances have public IPs',
    criticality: { confidentiality: 4, integrity: 4, availability: 3, financial: 4, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'enterprise-data-center', nodeId: 'cloud-workloads', nodeLabel: 'Cloud Workloads', nodeType: 'cloudService' }],
    createdAt: NOW, updatedAt: NOW,
  },
];

const risks: GrcRisk[] = [
  {
    id: 'edc-risk-legacy-tls', title: 'Legacy TLS 1.0 Endpoints Persist in Production',
    description: 'Several critical applications still use TLS 1.0 for backward compatibility, exposing encrypted traffic to known downgrade attacks (BEAST, POODLE) and failing PCI DSS requirements.',
    status: 'assessed' as const, owner: 'Application Operations',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Perimeter Security', tier3: 'Legacy TLS Endpoints' },
    assetIds: ['edc-asset-app-server', 'edc-asset-perimeter-fw'],
    diagramLinks: [{ diagramId: 'enterprise-data-center', nodeIds: ['app-server-1', 'perimeter-fw'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const,
    treatmentPlan: 'Enforce TLS 1.2 minimum across all endpoints; decommission legacy applications or deploy protocol translation proxies',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'edc-risk-redis-unencrypted', title: 'Redis Cache Traffic Unencrypted with No Authentication',
    description: 'Redis Enterprise instances operate on default ports without AUTH tokens or TLS. Any host on the internal VLAN can connect and read cached database query results containing business-critical data.',
    status: 'assessed' as const, owner: 'Application Operations',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Data Protection', tier3: 'Unencrypted Cache Traffic' },
    assetIds: ['edc-asset-db-cache'],
    diagramLinks: [{ diagramId: 'enterprise-data-center', nodeIds: ['db-cache', 'app-server-1'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const,
    treatmentPlan: 'Enable Redis AUTH and TLS; restrict network access to application server subnets only',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'edc-risk-pam-service-accounts', title: 'Service Accounts Bypass PAM Controls',
    description: 'Oracle database links and legacy batch jobs use service accounts with DBA privileges that bypass CyberArk session recording and approval workflows, creating unmonitored administrative access paths.',
    status: 'assessed' as const, owner: 'Identity & Access Management',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Identity & Privileged Access', tier3: 'PAM Bypass via Service Accounts' },
    assetIds: ['edc-asset-pam', 'edc-asset-primary-db'],
    diagramLinks: [{ diagramId: 'enterprise-data-center', nodeIds: ['privileged-access', 'primary-db'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const,
    treatmentPlan: 'Onboard all service accounts to CyberArk with automated rotation; replace database links with API-based integrations',
    threatActorIds: ['edc-actor-insider'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'edc-risk-vpn-mfa-gaps', title: 'VPN MFA Enforcement Gaps for Legacy Clients',
    description: 'Older VPN clients that do not support modern MFA protocols are whitelisted for certificate-only authentication, creating a weaker entry point into the corporate network.',
    status: 'draft' as const, owner: 'Network Security',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Perimeter Security', tier3: 'VPN Authentication Gaps' },
    assetIds: ['edc-asset-vpn'],
    diagramLinks: [{ diagramId: 'enterprise-data-center', nodeIds: ['vpn-concentrator'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const,
    treatmentPlan: 'Sunset legacy VPN clients; enforce modern MFA for all remote access connections within 90 days',
    threatActorIds: ['edc-actor-external'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'edc-risk-backup-capacity', title: 'Backup System at 90% Capacity Risks Data Loss',
    description: 'Backup infrastructure running at 90% capacity with expansion planned for Q3. Capacity exhaustion could cause missed backup windows and violate the 3-2-1 backup policy, undermining disaster recovery.',
    status: 'assessed' as const, owner: 'Infrastructure Operations',
    tierPath: { tier1: 'Operational Risk', tier2: 'Availability & Resilience', tier3: 'Backup Data Exposure' },
    assetIds: ['edc-asset-backup', 'edc-asset-primary-db'],
    diagramLinks: [{ diagramId: 'enterprise-data-center', nodeIds: ['backup-system', 'primary-db'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const,
    treatmentPlan: 'Accelerate storage expansion to Q2; implement tiered retention policies to free capacity; add monitoring alerts at 85% threshold',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'edc-risk-cloud-drift', title: 'Cloud Workloads with Unmanaged Public Exposure',
    description: 'Development cloud instances have public IPs and varying security baselines. No centralized policy enforcement exists across multi-cloud accounts, creating shadow IT exposure.',
    status: 'assessed' as const, owner: 'Cloud Operations',
    tierPath: { tier1: 'Operational Risk', tier2: 'Hybrid Cloud Integration', tier3: 'Cloud Configuration Drift' },
    assetIds: ['edc-asset-cloud-workloads'],
    diagramLinks: [{ diagramId: 'enterprise-data-center', nodeIds: ['cloud-workloads', 'cloud-gateway'] }],
    inherentScore: score('likelihood-4', 'impact-3'),
    treatmentStrategy: 'mitigate' as const,
    treatmentPlan: 'Deploy cloud security posture management (CSPM); enforce tagging and auto-remediation policies for public-facing resources',
    threatActorIds: ['edc-actor-external'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'edc-risk-flat-network', title: 'Insufficient Internal Network Micro-Segmentation',
    description: 'Application servers can reach database cache, file services, and data zone firewall without granular access controls. Lateral movement from any compromised internal host is trivially achievable.',
    status: 'assessed' as const, owner: 'Network Security',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Internal Network Segmentation', tier3: 'Flat Internal Routing' },
    assetIds: ['edc-asset-app-server', 'edc-asset-db-cache'],
    diagramLinks: [{ diagramId: 'enterprise-data-center', nodeIds: ['app-server-1', 'db-cache', 'file-server', 'data-fw'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const,
    treatmentPlan: 'Implement zero-trust micro-segmentation between application, cache, and data tiers; deploy east-west traffic inspection',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'edc-risk-audit-log-gaps', title: 'Inconsistent Audit Log Coverage Across Zones',
    description: 'Not all systems forward logs to the SIEM. Compliance scanner results and cloud workload logs are not centrally aggregated, leaving blind spots in security monitoring and incident investigation.',
    status: 'draft' as const, owner: 'Security Operations',
    tierPath: { tier1: 'Operational Risk', tier2: 'Security Monitoring', tier3: 'Audit Log Coverage Gaps' },
    assetIds: ['edc-asset-cloud-workloads', 'edc-asset-app-server'],
    diagramLinks: [{ diagramId: 'enterprise-data-center', nodeIds: ['siem', 'audit-log', 'cloud-workloads'] }],
    inherentScore: score('likelihood-3', 'impact-3'),
    treatmentStrategy: 'mitigate' as const,
    treatmentPlan: 'Extend SIEM log collection to all cloud workloads and compliance scanners; establish minimum log retention of 1 year',
    createdAt: NOW, updatedAt: NOW,
  },
];

const assessments: GrcAssessment[] = [
  {
    id: 'edc-assessment-infra-review', title: 'Enterprise Data Center Infrastructure Security Assessment',
    status: 'in_review' as const,
    owner: 'Chief Information Security Officer',
    reviewer: 'VP Infrastructure',
    startDate: '2025-05-01',
    dueDate: '2025-07-15',
    threatActorIds: ['edc-actor-external', 'edc-actor-insider', 'edc-actor-nation-state'],
    methodologyNote: 'Assessment follows NIST CSF with CIS Controls v8 mapping and MITRE ATT&CK for Enterprise. Scope covers on-premises data center and hybrid cloud integration points.',
    assumptionNote: 'Assessment assumes current production configuration. DR site excluded from this assessment cycle. Cloud workloads assessed at integration boundary only.',
    scopeItems: [
      { id: 'edc-scope-system', type: 'system' as const, value: 'system', name: 'Enterprise Data Center' },
      { id: 'edc-scope-internal', type: 'diagram_segment' as const, value: 'Internal', name: 'Internal Network Zone' },
      { id: 'edc-scope-restricted', type: 'diagram_segment' as const, value: 'Restricted', name: 'Restricted Data Zone' },
      { id: 'edc-scope-critical', type: 'diagram_segment' as const, value: 'Critical', name: 'Critical Infrastructure Zone' },
    ],
    tierFilter: { tier1: 'Cyber Risk' },
    riskManagementPlan: {
      objective: 'Remediate legacy protocol weaknesses, enforce privileged access controls, and establish micro-segmentation before zero-trust rollout.',
      strategy: 'Prioritize authentication and encryption gaps first, then address network segmentation and monitoring coverage.',
      residualRiskStatement: 'Residual risk accepted for legacy TLS endpoints pending application modernization with compensating WAF rules in place.',
      monitoringApproach: 'Bi-weekly review of open treatment actions; monthly SIEM detection efficacy assessment.',
      communicationPlan: 'Report to IT Security Steering Committee monthly. Escalate Critical risks within 24 hours.',
      reviewCadenceDays: 14,
      actions: [
        {
          id: 'edc-rmp-tls-upgrade',
          title: 'Enforce TLS 1.2 minimum across all production endpoints',
          owner: 'Application Operations',
          dueDate: '2025-06-30',
          status: 'in_progress' as const,
          linkedRiskIds: ['edc-risk-legacy-tls'],
          notes: 'TLS 1.0 disabled on 60% of endpoints; remaining legacy apps require code changes',
        },
        {
          id: 'edc-rmp-redis-auth',
          title: 'Enable Redis AUTH and TLS for all cache instances',
          owner: 'Application Operations',
          dueDate: '2025-06-15',
          status: 'planned' as const,
          linkedRiskIds: ['edc-risk-redis-unencrypted'],
          notes: 'Redis Enterprise supports TLS natively; connection string update required across all application configs',
        },
        {
          id: 'edc-rmp-pam-onboard',
          title: 'Onboard all Oracle service accounts to CyberArk with automated rotation',
          owner: 'Identity & Access Management',
          dueDate: '2025-07-01',
          status: 'in_progress' as const,
          linkedRiskIds: ['edc-risk-pam-service-accounts'],
          notes: '12 of 28 service accounts onboarded; remaining require database link refactoring',
        },
        {
          id: 'edc-rmp-microseg',
          title: 'Deploy micro-segmentation between application, cache, and data tiers',
          owner: 'Network Security',
          dueDate: '2025-08-01',
          status: 'planned' as const,
          linkedRiskIds: ['edc-risk-flat-network'],
          notes: 'Evaluating VMware NSX-T and Illumio for east-west traffic controls',
        },
      ],
      updatedAt: NOW,
    },
    riskIds: risks.map(r => r.id),
    soaGapIds: ['edc-soa-a01', 'edc-soa-a02', 'edc-soa-a05', 'edc-soa-cis04'],
    taskIds: ['edc-task-tls-upgrade', 'edc-task-redis-hardening', 'edc-task-pam-onboard', 'edc-task-microseg'],
    linkedImplementedControlIds: [],
    linkedInitiativeIds: [],
    summary: 'Security assessment of enterprise data center infrastructure identifying 8 risks across legacy protocols, privileged access gaps, network segmentation, and hybrid cloud exposure. 1 rated Critical, 4 High.',
    findings: 'Key findings include TLS 1.0 persistence on production endpoints, unencrypted Redis cache traffic, Oracle service accounts bypassing PAM controls, and insufficient micro-segmentation enabling lateral movement.',
    recommendations: 'Prioritize TLS upgrade and Redis authentication hardening, then enforce PAM coverage for all privileged accounts, and deploy micro-segmentation before zero-trust architecture rollout.',
    evidenceSummary: 'Evidence includes firewall rule exports, Redis configuration audits, CyberArk onboarding status reports, network topology diagrams, and vulnerability scan results.',
    threatModel: {
      nodes: [
        { id: 'edc-tm-external', label: 'External Attacker', sourceType: 'dfd_custom' as AssessmentThreatModelNodeSourceType, position: { x: 50, y: 200 }, nodeType: 'user', commentary: 'Targets perimeter via VPN or web application exploits' },
        { id: 'edc-tm-perimeter-fw', label: 'Perimeter Firewall', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'perimeter-fw', position: { x: 250, y: 200 }, nodeType: 'firewall' },
        { id: 'edc-tm-vpn', label: 'VPN Concentrator', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'vpn-concentrator', position: { x: 250, y: 350 }, nodeType: 'vpnGateway', commentary: 'Legacy clients bypass MFA' },
        { id: 'edc-tm-internal-fw', label: 'Internal Firewall', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'internal-fw', position: { x: 450, y: 200 }, nodeType: 'firewall' },
        { id: 'edc-tm-app-server', label: 'Application Server', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'app-server-1', position: { x: 650, y: 200 }, nodeType: 'application', commentary: 'Legacy .NET apps with TLS 1.0' },
        { id: 'edc-tm-cache', label: 'Redis Cache', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'db-cache', position: { x: 650, y: 350 }, nodeType: 'cache', commentary: 'No AUTH, no TLS, default ports' },
        { id: 'edc-tm-primary-db', label: 'Primary Database', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'primary-db', position: { x: 850, y: 200 }, nodeType: 'database' },
        { id: 'edc-tm-pam', label: 'PAM System', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'privileged-access', position: { x: 850, y: 350 }, nodeType: 'pam', commentary: 'Service accounts bypass session recording' },
      ],
      edges: [
        { id: 'edc-tm-edge-ext-fw', source: 'edc-tm-external', target: 'edc-tm-perimeter-fw', sourceType: 'manual' as AssessmentThreatModelEdgeSourceType, label: 'Perimeter Attack', commentary: 'Initial access via exploited web application or phishing' },
        { id: 'edc-tm-edge-ext-vpn', source: 'edc-tm-external', target: 'edc-tm-vpn', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e-fw-vpn', label: 'VPN Access (cert-only)', commentary: 'Legacy clients bypass MFA requirement' },
        { id: 'edc-tm-edge-fw-internal', source: 'edc-tm-perimeter-fw', target: 'edc-tm-internal-fw', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e-proxy-internal', label: 'Proxied Traffic' },
        { id: 'edc-tm-edge-internal-app', source: 'edc-tm-internal-fw', target: 'edc-tm-app-server', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e-internal-app', label: 'App Traffic' },
        { id: 'edc-tm-edge-app-cache', source: 'edc-tm-app-server', target: 'edc-tm-cache', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e-app-cache', label: 'Unencrypted Redis', commentary: 'No AUTH; data readable by any internal host' },
        { id: 'edc-tm-edge-app-db', source: 'edc-tm-app-server', target: 'edc-tm-primary-db', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e-app-datafw', label: 'Direct DB Access' },
        { id: 'edc-tm-edge-pam-db', source: 'edc-tm-pam', target: 'edc-tm-primary-db', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e-pam-db', label: 'Admin Access', commentary: 'Service accounts bypass PAM session recording' },
      ],
      attackPathDescription: 'Four primary attack chains: (1) VPN credential compromise to internal lateral movement via flat network to database exfiltration; (2) Web application exploit through DMZ to unencrypted cache data theft; (3) Service account abuse bypassing PAM to direct database manipulation; (4) Cloud workload compromise via misconfigured public instances to hybrid network pivot.',
      attackPaths: [
        {
          id: 'edc-aap-vpn-lateral',
          name: 'VPN Credential Compromise → Lateral Movement → DB Exfiltration',
          strideCategory: 'Elevation of Privilege' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'Attacker compromises VPN credentials via legacy certificate-only authentication, traverses internal firewall, exploits flat network to reach application servers, then pivots to primary database for data exfiltration.',
          diagramAttackPathId: 'edc-ap-vpn-lateral',
          steps: [
            { order: 1, edgeId: 'e-fw-vpn', sourceNodeId: 'perimeter-fw', targetNodeId: 'vpn-concentrator', technique: 'T1133: External Remote Services' },
            { order: 2, edgeId: 'e-vpn-internal', sourceNodeId: 'vpn-concentrator', targetNodeId: 'internal-fw', technique: 'T1021: Remote Services' },
            { order: 3, edgeId: 'e-internal-app', sourceNodeId: 'internal-fw', targetNodeId: 'app-server-1', technique: 'T1570: Lateral Tool Transfer' },
            { order: 4, edgeId: 'e-app-datafw', sourceNodeId: 'app-server-1', targetNodeId: 'data-fw', technique: 'T1005: Data from Local System' },
            { order: 5, edgeId: 'e-datafw-db', sourceNodeId: 'data-fw', targetNodeId: 'primary-db', technique: 'T1213: Data from Information Repositories' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
        {
          id: 'edc-aap-cache-exfil',
          name: 'Web Exploit → Unencrypted Cache Data Theft',
          strideCategory: 'Information Disclosure' as StrideCategory,
          riskLevel: 'High' as AttackPathRiskLevel,
          description: 'Attacker exploits web application vulnerability through DMZ, reaches internal application servers, and connects to unencrypted Redis cache on default ports to extract cached business-critical data.',
          diagramAttackPathId: 'edc-ap-cache-exfil',
          steps: [
            { order: 1, edgeId: 'e-fw-proxy', sourceNodeId: 'perimeter-fw', targetNodeId: 'web-proxy', technique: 'T1190: Exploit Public-Facing Application' },
            { order: 2, edgeId: 'e-proxy-internal', sourceNodeId: 'web-proxy', targetNodeId: 'internal-fw', technique: 'T1071: Application Layer Protocol' },
            { order: 3, edgeId: 'e-internal-app', sourceNodeId: 'internal-fw', targetNodeId: 'app-server-1', technique: 'T1059: Command and Scripting Interpreter' },
            { order: 4, edgeId: 'e-app-cache', sourceNodeId: 'app-server-1', targetNodeId: 'db-cache', technique: 'T1557: Adversary-in-the-Middle' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
        {
          id: 'edc-aap-pam-bypass',
          name: 'Service Account Abuse → PAM Bypass → Database Manipulation',
          strideCategory: 'Tampering' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'Insider or attacker with compromised service account credentials bypasses CyberArk PAM controls, accesses Oracle database directly with DBA privileges, and manipulates financial records without session recording.',
          diagramAttackPathId: 'edc-ap-pam-bypass',
          steps: [
            { order: 1, edgeId: 'e-pam-db', sourceNodeId: 'privileged-access', targetNodeId: 'primary-db', technique: 'T1078: Valid Accounts' },
            { order: 2, edgeId: 'e-db-warehouse', sourceNodeId: 'primary-db', targetNodeId: 'data-warehouse', technique: 'T1565: Data Manipulation' },
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
    id: 'edc-soa-a01', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A01', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Service accounts with DBA privileges bypass PAM session recording. Internal firewall rules allow broad application-to-database access without fine-grained authorization.',
    mitigatesRiskIds: ['edc-risk-pam-service-accounts', 'edc-risk-flat-network'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'edc-soa-a02', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A02', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Redis cache operates without TLS or AUTH. TLS 1.0 still enabled on legacy application endpoints. Database connections use Oracle Native encryption without TLS wrapper.',
    mitigatesRiskIds: ['edc-risk-redis-unencrypted', 'edc-risk-legacy-tls'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'edc-soa-a05', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A05', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Firewall rulesets reviewed quarterly but internal segmentation rules are overly permissive. Cloud workloads lack centralized configuration management. VPN whitelists stale legacy clients.',
    mitigatesRiskIds: ['edc-risk-vpn-mfa-gaps', 'edc-risk-cloud-drift', 'edc-risk-flat-network'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'edc-soa-a06', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A06', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Oracle Database 12c instances pending upgrade to 19c. Windows Server 2012 R2 systems still in production. Network equipment end-of-life switches in distribution layer.',
    mitigatesRiskIds: ['edc-risk-legacy-tls'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'edc-soa-a07', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A07', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'VPN MFA enforced for modern clients but legacy clients exempted. PAM approval workflows active but service accounts bypass them. Cloud workload IAM policies inconsistent.',
    mitigatesRiskIds: ['edc-risk-vpn-mfa-gaps', 'edc-risk-pam-service-accounts'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'edc-soa-a09', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A09', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'SIEM deployed with Splunk Enterprise Security but log coverage incomplete. Cloud workloads and some internal systems do not forward logs. Audit log retention varies by system.',
    mitigatesRiskIds: ['edc-risk-audit-log-gaps'],
    diagramRefs: [],
    evidence: [
      { id: 'edc-evidence-siem-config', kind: 'link' as const, name: 'SIEM log source inventory and gap analysis', url: 'https://security.example.internal/reports/siem-coverage', note: 'Updated monthly', createdAt: NOW },
    ],
    updatedAt: NOW,
  },
  {
    id: 'edc-soa-cis03', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.03', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Database TDE enabled but Redis cache unencrypted. Backup encryption active via Veeam but capacity constraints threaten retention compliance. File server encryption at rest configured.',
    mitigatesRiskIds: ['edc-risk-redis-unencrypted', 'edc-risk-backup-capacity'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'edc-soa-cis04', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.04', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'CIS benchmarks applied to new deployments but legacy Windows Server 2012 R2 and Oracle 12c systems not hardened to current baselines. Cloud workload configurations unmanaged.',
    mitigatesRiskIds: ['edc-risk-legacy-tls', 'edc-risk-cloud-drift'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'edc-soa-cis06', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.06', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'PAM deployed for interactive access but service accounts bypass controls. VPN access management gaps for legacy clients. Internal firewall rules overly permissive.',
    mitigatesRiskIds: ['edc-risk-pam-service-accounts', 'edc-risk-vpn-mfa-gaps', 'edc-risk-flat-network'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'edc-soa-cis08', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.08', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Centralized audit logging via Splunk SIEM with WORM storage for compliance. However, cloud workload logs and compliance scanner results not fully aggregated.',
    mitigatesRiskIds: ['edc-risk-audit-log-gaps'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
];

const workflowTasks: GrcTask[] = [
  {
    id: 'edc-task-tls-upgrade',
    title: 'Enforce TLS 1.2 minimum on all production endpoints',
    description: 'Disable TLS 1.0 and 1.1 on all web servers, application servers, and API endpoints. Deploy protocol translation proxies for legacy applications that cannot be updated.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'high' as const,
    owner: 'Application Operations',
    dueDate: '2025-06-30',
    riskId: 'edc-risk-legacy-tls',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'edc-task-redis-hardening',
    title: 'Enable Redis AUTH and TLS across all cache instances',
    description: 'Configure Redis Enterprise with AUTH tokens and TLS encryption. Update all application connection strings and restrict network ACLs to application server subnets.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Application Operations',
    dueDate: '2025-06-15',
    riskId: 'edc-risk-redis-unencrypted',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'edc-task-pam-onboard',
    title: 'Onboard all Oracle service accounts to CyberArk',
    description: 'Migrate 28 Oracle database service accounts to CyberArk PAS with automated credential rotation. Refactor database links to use API-based integrations.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'critical' as const,
    owner: 'Identity & Access Management',
    dueDate: '2025-07-01',
    riskId: 'edc-risk-pam-service-accounts',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'edc-task-microseg',
    title: 'Deploy micro-segmentation between internal tiers',
    description: 'Implement east-west traffic controls between application, cache, file, and data tiers using NSX-T or Illumio. Define zero-trust policies for each communication pair.',
    type: 'control_implementation' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Network Security',
    dueDate: '2025-08-01',
    riskId: 'edc-risk-flat-network',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'edc-task-vpn-legacy-sunset',
    title: 'Sunset legacy VPN clients and enforce universal MFA',
    description: 'Remove certificate-only VPN authentication whitelists within 90 days. Migrate remaining legacy users to modern MFA-capable clients.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'medium' as const,
    owner: 'Network Security',
    dueDate: '2025-07-15',
    riskId: 'edc-risk-vpn-mfa-gaps',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'edc-task-backup-expansion',
    title: 'Accelerate backup storage expansion and implement tiered retention',
    description: 'Expand backup storage capacity before Q3 to avoid missed backup windows. Implement tiered retention policies to optimize existing capacity.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'high' as const,
    owner: 'Infrastructure Operations',
    dueDate: '2025-06-30',
    riskId: 'edc-risk-backup-capacity',
    createdAt: NOW, updatedAt: NOW,
  },
];

const governanceDocuments: GrcGovernanceDocument[] = [
  {
    id: 'edc-gov-infosec-policy', title: 'Information Security Policy',
    type: 'policy' as const, status: 'active' as const,
    description: 'Enterprise information security policy covering data classification, access control, encryption standards, and incident response procedures.',
    owner: 'CISO',
    reviewDate: '2025-01-15',
    nextReviewDate: '2026-01-15',
    version: '4.2',
    linkedRiskIds: ['edc-risk-legacy-tls', 'edc-risk-redis-unencrypted', 'edc-risk-pam-service-accounts'],
    linkedControlSetIds: [OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID],
    linkedAssessmentIds: ['edc-assessment-infra-review'],
    tags: ['policy', 'mandatory'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'edc-gov-access-control', title: 'Privileged Access Management Standard',
    type: 'standard' as const, status: 'active' as const,
    description: 'Standard defining PAM requirements for all privileged and service accounts, including session recording, approval workflows, and credential rotation schedules.',
    owner: 'Identity & Access Management',
    reviewDate: '2025-03-01',
    nextReviewDate: '2025-09-01',
    version: '2.1',
    linkedRiskIds: ['edc-risk-pam-service-accounts', 'edc-risk-vpn-mfa-gaps'],
    linkedControlSetIds: [CIS_CONTROL_SET_ID],
    linkedAssessmentIds: ['edc-assessment-infra-review'],
    tags: ['pam', 'access-control'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'edc-gov-dr-procedure', title: 'Disaster Recovery Procedure',
    type: 'procedure' as const, status: 'active' as const,
    description: 'Step-by-step disaster recovery procedures including 4-hour RTO targets, backup restoration processes, and DR site failover protocols.',
    owner: 'Infrastructure Operations',
    reviewDate: '2025-04-01',
    nextReviewDate: '2025-10-01',
    version: '3.0',
    linkedRiskIds: ['edc-risk-backup-capacity'],
    linkedControlSetIds: [],
    linkedAssessmentIds: [],
    tags: ['disaster-recovery', 'business-continuity'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'edc-gov-network-seg', title: 'Network Segmentation Guideline',
    type: 'guideline' as const, status: 'under_review' as const,
    description: 'Guideline for network zone architecture, micro-segmentation policies, and east-west traffic controls in the enterprise data center.',
    owner: 'Network Security',
    reviewDate: '2025-02-15',
    nextReviewDate: '2025-08-15',
    version: '1.3',
    linkedRiskIds: ['edc-risk-flat-network', 'edc-risk-cloud-drift'],
    linkedControlSetIds: [CIS_CONTROL_SET_ID],
    linkedAssessmentIds: ['edc-assessment-infra-review'],
    tags: ['network', 'zero-trust', 'segmentation'],
    createdAt: NOW, updatedAt: NOW,
  },
];

const threatActors: GrcThreatActor[] = [
  {
    id: 'edc-actor-external', name: 'Sophisticated External Threat Group',
    type: 'organised_crime' as const, capabilityLevel: 4,
    resourceLevel: 'high' as const,
    motivation: 'Financial gain through ransomware deployment, credential harvesting from unencrypted cache traffic, and data exfiltration from legacy protocol weaknesses.',
    description: 'Advanced persistent threat group targeting enterprise data centers. Specializes in VPN credential compromise, lateral movement through flat networks, and exploitation of legacy protocols.',
    targetedAssetIds: ['edc-asset-vpn', 'edc-asset-app-server', 'edc-asset-primary-db', 'edc-asset-db-cache'],
    tags: ['apt', 'ransomware', 'credential-theft'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'edc-actor-insider', name: 'Privileged Insider with DBA Access',
    type: 'insider' as const, capabilityLevel: 3,
    resourceLevel: 'moderate' as const,
    motivation: 'Data theft for competitive advantage or personal gain, leveraging service accounts that bypass PAM session recording and approval workflows.',
    description: 'Current database administrator or operations engineer with knowledge of service account credentials and database link configurations that bypass CyberArk controls.',
    targetedAssetIds: ['edc-asset-pam', 'edc-asset-primary-db'],
    tags: ['insider-threat', 'privileged-access', 'service-account-abuse'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'edc-actor-nation-state', name: 'State-Sponsored Espionage Group',
    type: 'nation_state' as const, capabilityLevel: 5,
    resourceLevel: 'very_high' as const,
    motivation: 'Long-term persistent access for intellectual property theft, targeting ERP financials, data warehouse analytics, and cloud workload migration data.',
    description: 'Nation-state actor with advanced capabilities targeting enterprise infrastructure. Uses supply chain compromise and zero-day exploits against legacy systems and hybrid cloud integration points.',
    targetedAssetIds: ['edc-asset-primary-db', 'edc-asset-cloud-workloads', 'edc-asset-backup'],
    tags: ['nation-state', 'espionage', 'supply-chain'],
    createdAt: NOW, updatedAt: NOW,
  },
];

const threatScenarios: GrcThreatScenario[] = [
  {
    id: 'edc-scenario-vpn-ransomware', title: 'VPN Credential Compromise Leading to Ransomware Deployment',
    description: 'External attacker exploits legacy VPN client exemption from MFA to gain network access, performs lateral movement through flat internal network, and deploys ransomware across application servers and database systems.',
    threatActorId: 'edc-actor-external',
    targetedAssetIds: ['edc-asset-vpn', 'edc-asset-app-server', 'edc-asset-primary-db', 'edc-asset-backup'],
    attackTechniques: ['T1133 - External Remote Services', 'T1021 - Remote Services', 'T1570 - Lateral Tool Transfer', 'T1486 - Data Encrypted for Impact'],
    linkedRiskIds: ['edc-risk-vpn-mfa-gaps', 'edc-risk-flat-network', 'edc-risk-backup-capacity'],
    likelihood: 'High - legacy VPN exemptions provide direct entry without MFA enforcement.',
    impact: 'Critical - ransomware affecting core business databases and insufficient backup capacity threatens complete data loss.',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'edc-scenario-cache-exfil', title: 'Unencrypted Cache Data Harvesting',
    description: 'Attacker with internal network access (via compromised workstation or VPN) connects to Redis cache on default ports without authentication, harvests cached database query results containing business-critical financial and customer data.',
    threatActorId: 'edc-actor-external',
    targetedAssetIds: ['edc-asset-db-cache', 'edc-asset-app-server'],
    attackTechniques: ['T1557 - Adversary-in-the-Middle', 'T1040 - Network Sniffing', 'T1005 - Data from Local System'],
    linkedRiskIds: ['edc-risk-redis-unencrypted', 'edc-risk-flat-network'],
    likelihood: 'Moderate - requires internal network access but Redis has no authentication barrier.',
    impact: 'Major - cached data includes recent database query results with PII, financial records, and business intelligence data.',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'edc-scenario-service-account-abuse', title: 'Service Account Abuse for Unmonitored Database Manipulation',
    description: 'Privileged insider uses Oracle service account credentials that bypass CyberArk session recording to directly access and manipulate financial records in the primary database, then propagates changes to the data warehouse via ETL replication.',
    threatActorId: 'edc-actor-insider',
    targetedAssetIds: ['edc-asset-pam', 'edc-asset-primary-db'],
    attackTechniques: ['T1078 - Valid Accounts', 'T1565 - Data Manipulation', 'T1070 - Indicator Removal'],
    linkedRiskIds: ['edc-risk-pam-service-accounts'],
    likelihood: 'Moderate - requires knowledge of service account credentials but they are static and broadly shared.',
    impact: 'Critical - undetected financial data manipulation could affect SOX compliance and financial reporting integrity.',
    createdAt: NOW, updatedAt: NOW,
  },
];

export const enterpriseDataCenterGrcWorkspace = buildGrcWorkspace({
  tierCatalogue,
  assets,
  risks,
  assessments,
  soaEntries,
  workflowTasks,
  governanceDocuments,
  threatActors,
  threatScenarios,
  thirdParties: [
    {
      id: 'edc-tp-paloalto',
      name: 'Palo Alto Networks',
      description: 'Perimeter and internal firewall supplier providing PA-5400 series next-generation firewalls for north-south and east-west traffic inspection. Includes Threat Prevention, URL Filtering, and WildFire sandboxing subscriptions.',
      category: 'supplier',
      status: 'active',
      riskRating: 'high',
      dataClassification: 'confidential',
      linkedAssetIds: ['edc-asset-perimeter-fw', 'edc-asset-app-server'],
      linkedRiskIds: ['edc-risk-legacy-tls', 'edc-risk-flat-network'],
      contactName: 'Karen Mitchell',
      contactEmail: 'karen.mitchell@paloaltonetworks.example.com',
      contractExpiry: '2027-03-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-12-31',
      notes: 'PA-5450 perimeter firewalls with Panorama centralized management. Threat Prevention signatures updated daily. SSL/TLS decryption enabled on outbound traffic but legacy TLS 1.0/1.1 connections bypass inspection — identified as a risk. Microsegmentation project planned to address flat network topology. WildFire cloud sandboxing analyzes unknown files. Annual firewall rule review completed — 15% of rules identified as stale.'
    },
    {
      id: 'edc-tp-cyberark',
      name: 'CyberArk Software',
      description: 'SaaS Privileged Access Management (PAM) platform managing vault credentials, session recording, and just-in-time access for administrators and service accounts across data center infrastructure.',
      category: 'saas',
      status: 'active',
      riskRating: 'critical',
      dataClassification: 'restricted',
      linkedAssetIds: ['edc-asset-pam', 'edc-asset-primary-db', 'edc-asset-vpn'],
      linkedRiskIds: ['edc-risk-pam-service-accounts', 'edc-risk-vpn-mfa-gaps'],
      contactName: 'David Rosenberg',
      contactEmail: 'david.rosenberg@cyberark.example.com',
      contractExpiry: '2026-12-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-09-30',
      notes: 'CyberArk Privilege Cloud with Conjur for application credential injection. 340 privileged accounts managed but 47 legacy service accounts still use static credentials outside the vault — identified as critical risk. Session recording enabled for all interactive admin sessions. PSM for SSH and RDP access. MFA enforcement gap exists for VPN-authenticated sessions that bypass CyberArk. Quarterly access certification process in place.'
    },
    {
      id: 'edc-tp-veeam',
      name: 'Veeam Software',
      description: 'Backup and disaster recovery supplier providing Veeam Backup & Replication for VM-level, application-aware backups of all data center workloads. Manages 5PB backup repository with on-site and cloud copy targets.',
      category: 'supplier',
      status: 'active',
      riskRating: 'high',
      dataClassification: 'confidential',
      linkedAssetIds: ['edc-asset-backup', 'edc-asset-primary-db', 'edc-asset-cloud-workloads'],
      linkedRiskIds: ['edc-risk-backup-capacity'],
      contactName: 'Anna Kowalski',
      contactEmail: 'anna.kowalski@veeam.example.com',
      contractExpiry: '2027-01-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-10-31',
      notes: 'Veeam Backup & Replication v12 with immutable backup repository (hardened Linux). Backup capacity at 87% — growth rate may exceed capacity within 6 months. Application-aware processing for Oracle ERP and SQL Server databases. Cloud tier configured for long-term retention to AWS S3 with Object Lock. Backup encryption enabled with customer-managed keys. SureBackup verification runs weekly to validate recoverability. Ransomware recovery SLA is 4 hours for critical systems.'
    },
    {
      id: 'edc-tp-cisco',
      name: 'Cisco Systems',
      description: 'Network infrastructure supplier providing Nexus 9000 series data center switches, Catalyst campus switches, and ACI fabric for microsegmentation. Includes DNA Center for network automation and assurance.',
      category: 'supplier',
      status: 'active',
      riskRating: 'medium',
      dataClassification: 'internal',
      linkedAssetIds: ['edc-asset-perimeter-fw', 'edc-asset-app-server', 'edc-asset-vpn'],
      linkedRiskIds: ['edc-risk-flat-network', 'edc-risk-audit-log-gaps'],
      contactName: 'Brian Thompson',
      contactEmail: 'brian.thompson@cisco.example.com',
      contractExpiry: '2027-06-30',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-12-31',
      notes: 'Nexus 9000 with ACI fabric for data center switching. Flat network topology identified as a risk — ACI microsegmentation project approved but deployment pending. DNA Center provides network assurance and automated config compliance. NetFlow data exported to SIEM but audit log gaps exist for some legacy Catalyst switches. SmartNet support with 4-hour hardware replacement SLA. IOS XE vulnerability patching follows 30-day window after advisory publication.'
    },
    {
      id: 'edc-tp-equinix',
      name: 'Equinix Inc.',
      description: 'Managed colocation service provider hosting primary data center racks with power, cooling, physical security, and cross-connect services. Provides carrier-neutral meet-me room for ISP and cloud provider connectivity.',
      category: 'managed_service',
      status: 'active',
      riskRating: 'medium',
      dataClassification: 'confidential',
      linkedAssetIds: ['edc-asset-perimeter-fw', 'edc-asset-app-server', 'edc-asset-primary-db'],
      linkedRiskIds: ['edc-risk-cloud-drift'],
      contactName: 'Patricia Huang',
      contactEmail: 'patricia.huang@equinix.example.com',
      contractExpiry: '2027-12-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-12-31',
      notes: 'Primary colocation in Equinix DC6 facility with N+1 power and cooling redundancy. Physical security includes biometric access, mantrap entry, and 24/7 security operations center. SOC 2 Type II and ISO 27001 certified. Cross-connects to AWS Direct Connect and Azure ExpressRoute for hybrid cloud connectivity. Equinix Fabric provides software-defined interconnection. Smart Hands service used for remote hardware support. Facility uptime SLA is 99.9999%.'
    },
  ],
  securityInitiatives: [
    {
      id: 'edc-si-zero-trust-microseg',
      title: 'Zero Trust Micro-Segmentation and Network Modernization',
      description: 'Deploy micro-segmentation between all internal tiers, enforce zero-trust policies for east-west traffic, and eliminate flat network routing that enables lateral movement from any compromised host.',
      category: 'transformation' as const,
      status: 'in_progress' as const,
      priority: 'critical' as const,
      owner: 'Network Security',
      executiveSponsor: 'CTO',
      currentState: 'Application servers can reach database cache, file services, and data zone without granular controls. Redis cache operates without authentication on default ports. Internal firewall rules are overly permissive.',
      targetState: 'Zero-trust micro-segmentation between application, cache, file, and data tiers. All east-west traffic inspected. Redis cache encrypted with TLS and AUTH. Legacy TLS 1.0 endpoints decommissioned.',
      startDate: '2025-04-01',
      targetDate: '2025-10-31',
      completedDate: '',
      milestones: [
        { id: 'edc-ms-redis-hardening', title: 'Enable Redis AUTH and TLS', description: 'Configure Redis Enterprise with AUTH tokens and TLS encryption across all cache instances and update application connection strings.', status: 'pending' as const, dueDate: '2025-06-15', completedDate: '', owner: 'Application Operations' },
        { id: 'edc-ms-tls-upgrade', title: 'Enforce TLS 1.2 minimum on all endpoints', description: 'Disable TLS 1.0 and 1.1 on remaining legacy application endpoints and deploy protocol translation proxies where needed.', status: 'in_progress' as const, dueDate: '2025-06-30', completedDate: '', owner: 'Application Operations' },
        { id: 'edc-ms-microseg-deploy', title: 'Deploy micro-segmentation policies', description: 'Implement NSX-T or Illumio east-west traffic controls between application, cache, and data tiers with deny-by-default policies.', status: 'pending' as const, dueDate: '2025-09-30', completedDate: '', owner: 'Network Security' },
      ],
      linkedRiskIds: ['edc-risk-flat-network', 'edc-risk-redis-unencrypted', 'edc-risk-legacy-tls'],
      linkedControlSetIds: [],
      linkedAssetIds: ['edc-asset-app-server', 'edc-asset-db-cache', 'edc-asset-perimeter-fw'],
      linkedImplementedControlIds: ['edc-ic-perimeter-firewall', 'edc-ic-siem'],
      linkedAssessmentIds: ['edc-assessment-infra-review'],
      notes: 'TLS 1.0 disabled on 60% of endpoints. NSX-T and Illumio evaluation underway — POC results expected by end of June. Redis hardening blocked on application connection string update coordination.',
      createdAt: NOW,
      updatedAt: NOW
    },
    {
      id: 'edc-si-pam-coverage',
      title: 'Privileged Access Management Full Coverage Initiative',
      description: 'Extend CyberArk PAM coverage to all service accounts and legacy batch jobs, enforce VPN MFA for all clients, and establish complete privileged access audit trail.',
      category: 'compliance' as const,
      status: 'in_progress' as const,
      priority: 'high' as const,
      owner: 'Identity & Access Management',
      executiveSponsor: 'CISO',
      currentState: 'Oracle database links and legacy batch jobs use 47 service accounts with DBA privileges that bypass CyberArk session recording. Older VPN clients whitelisted for certificate-only authentication.',
      targetState: 'All 47 service accounts onboarded to CyberArk with automated rotation. Database links replaced with API-based integrations. All VPN clients require MFA. Complete session recording for all admin access.',
      startDate: '2025-05-01',
      targetDate: '2025-09-30',
      completedDate: '',
      milestones: [
        { id: 'edc-ms-pam-onboard', title: 'Onboard all Oracle service accounts to CyberArk', description: 'Migrate remaining 16 Oracle database service accounts to CyberArk PAS with automated 30-day credential rotation.', status: 'in_progress' as const, dueDate: '2025-07-01', completedDate: '', owner: 'Identity & Access Management' },
        { id: 'edc-ms-vpn-mfa', title: 'Sunset legacy VPN clients and enforce MFA', description: 'Remove certificate-only VPN authentication whitelists and migrate remaining legacy users to modern MFA-capable clients.', status: 'pending' as const, dueDate: '2025-07-15', completedDate: '', owner: 'Network Security' },
        { id: 'edc-ms-db-link-migration', title: 'Replace database links with API integrations', description: 'Refactor Oracle database links to use application-level API integrations that authenticate through CyberArk Conjur.', status: 'pending' as const, dueDate: '2025-09-15', completedDate: '', owner: 'Database Administration' },
      ],
      linkedRiskIds: ['edc-risk-pam-service-accounts', 'edc-risk-vpn-mfa-gaps'],
      linkedControlSetIds: [],
      linkedAssetIds: ['edc-asset-pam', 'edc-asset-primary-db', 'edc-asset-vpn'],
      linkedImplementedControlIds: ['edc-ic-pam'],
      linkedAssessmentIds: ['edc-assessment-infra-review'],
      notes: '12 of 28 service accounts onboarded to CyberArk. Remaining 16 require database link refactoring before rotation can be enabled. VPN client audit complete — 23 legacy clients identified.',
      createdAt: NOW,
      updatedAt: NOW
    },
  ],
  implementedControls: [
    {
      id: 'edc-ic-perimeter-firewall',
      title: 'Palo Alto Next-Gen Perimeter Firewall',
      description: 'Palo Alto PA-5220 next-generation firewall providing north-south traffic inspection with IPS, SSL decryption, URL filtering, WildFire sandboxing, and threat prevention at the network edge.',
      controlType: 'technical' as const,
      category: 'network_security' as const,
      status: 'active' as const,
      automationLevel: 'fully_automated' as const,
      owner: 'Network Security',
      vendor: 'Palo Alto Networks',
      product: 'PA-5220',
      version: 'PAN-OS 11.1',
      implementedDate: '2023-03-15',
      lastReviewDate: '2025-04-30',
      nextReviewDate: '2025-10-30',
      linkedSoaEntryIds: ['edc-soa-a05', 'edc-soa-a02'],
      linkedRiskIds: ['edc-risk-legacy-tls', 'edc-risk-flat-network'],
      linkedAssetIds: ['edc-asset-perimeter-fw', 'edc-asset-app-server'],
      linkedAssessmentIds: ['edc-assessment-infra-review'],
      notes: 'Threat Prevention signatures updated daily. SSL decryption enabled on outbound traffic but legacy TLS 1.0/1.1 connections bypass inspection. Annual firewall rule review identified 15% stale rules. Panorama centralized management active.',
      createdAt: NOW,
      updatedAt: NOW
    },
    {
      id: 'edc-ic-pam',
      title: 'CyberArk Privileged Access Management',
      description: 'CyberArk PAS vault providing credential management, session recording, just-in-time access approval, and automated password rotation for privileged accounts across data center infrastructure.',
      controlType: 'technical' as const,
      category: 'access_control' as const,
      status: 'active' as const,
      automationLevel: 'semi_automated' as const,
      owner: 'Identity & Access Management',
      vendor: 'CyberArk',
      product: 'CyberArk Privilege Cloud',
      version: '12.6',
      implementedDate: '2024-01-15',
      lastReviewDate: '2025-05-10',
      nextReviewDate: '2025-11-10',
      linkedSoaEntryIds: ['edc-soa-a01', 'edc-soa-a07', 'edc-soa-cis06'],
      linkedRiskIds: ['edc-risk-pam-service-accounts', 'edc-risk-vpn-mfa-gaps'],
      linkedAssetIds: ['edc-asset-pam', 'edc-asset-primary-db'],
      linkedAssessmentIds: ['edc-assessment-infra-review'],
      notes: '340 privileged accounts managed. 12 of 28 Oracle service accounts onboarded. PSM for SSH and RDP with session recording enabled. MFA enforcement gap exists for VPN-authenticated sessions. Quarterly access certification active.',
      createdAt: NOW,
      updatedAt: NOW
    },
    {
      id: 'edc-ic-siem',
      title: 'Splunk Enterprise Security SIEM',
      description: 'Centralized security information and event management platform providing log aggregation, correlation, threat detection, and incident investigation across all data center zones and hybrid cloud boundaries.',
      controlType: 'technical' as const,
      category: 'monitoring' as const,
      status: 'active' as const,
      automationLevel: 'semi_automated' as const,
      owner: 'Security Operations',
      vendor: 'Splunk',
      product: 'Splunk Enterprise Security',
      version: '7.3',
      implementedDate: '2022-11-01',
      lastReviewDate: '2025-05-01',
      nextReviewDate: '2025-11-01',
      linkedSoaEntryIds: ['edc-soa-a09', 'edc-soa-cis08'],
      linkedRiskIds: ['edc-risk-audit-log-gaps'],
      linkedAssetIds: ['edc-asset-app-server', 'edc-asset-cloud-workloads'],
      linkedAssessmentIds: ['edc-assessment-infra-review'],
      notes: 'WORM storage for compliance retention. Core infrastructure log sources onboarded. Cloud workload and compliance scanner logs not fully aggregated — identified as a gap. Notable events correlated with CyberArk session data. Monthly detection efficacy review.',
      createdAt: NOW,
      updatedAt: NOW
    },
  ],
});

export const enterpriseDataCenter: ExampleSystem = {
  id: 'enterprise-data-center',
  name: 'Enterprise Data Center Infrastructure',
  description: 'Traditional enterprise data center with multiple security zones and cloud integration',
  category: 'Enterprise Systems',
  // securityLevel removed - no longer part of the system model
  primaryZone: 'Internal',
  dataClassification: 'Confidential',
  customContext: `# Enterprise Data Center Infrastructure

## Executive Summary
This represents our organization's primary data center infrastructure supporting 50,000+ employees globally. The data center hosts critical business applications, databases, and serves as the hub for our hybrid cloud strategy.

## Architecture Details
- **Network Architecture**: Traditional three-tier architecture with core, distribution, and access layers
- **Virtualization**: 85% virtualized on VMware vSphere 7.0, with some physical servers for specialized workloads
- **Storage**: Mix of SAN (fiber channel) and NAS storage, approximately 5PB total capacity
- **Backup Strategy**: 3-2-1 backup rule implemented with on-site, off-site, and cloud copies

## Key Business Systems
- ERP system (Oracle-based) handling financials and supply chain
- Customer relationship management (CRM) platform
- Data warehouse supporting business intelligence and analytics
- Email and collaboration platforms
- Development and testing environments

## Operational Considerations
- 24/7 operations with follow-the-sun support model
- Change windows: Tuesdays and Thursdays 2-6 AM for production changes
- Disaster recovery site located 200 miles away with 4-hour RTO
- Monthly DR tests conducted, last successful test was 45 days ago

## Compliance Requirements
- PCI DSS for payment card processing
- SOX compliance for financial reporting
- HIPAA for healthcare data (specific applications)
- GDPR for European customer data

## Recent Initiatives
- Cloud migration project underway, targeting 30% workload migration by year-end
- Zero trust network architecture being evaluated for future implementation
- Legacy application modernization program in planning phase
- Automation initiatives using Ansible and Terraform for infrastructure as code

## Technical Debt
- Several critical applications still running on Windows Server 2012 R2
- Oracle databases require upgrading from 12c to 19c
- Network equipment refresh needed for end-of-life switches in distribution layer
- Some applications still using TLS 1.0 for backwards compatibility
- Backup system running at 90% capacity, expansion planned for Q3`,
  nodes: [
    // Security Zones
    {
      id: 'external-zone',
      type: 'securityZone',
      position: { x: 50, y: 50 },
      data: {
        label: 'External Zone',
        zoneType: 'External' as SecurityZone,
        description: 'Public-facing external network zone',
        zone: 'DMZ' as SecurityZone
      },
      style: {
        width: 600,
        height: 1000,
        background: colors.zoneBackgrounds.External,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'dmz-zone',
      type: 'securityZone',
      position: { x: 770, y: 50 },
      data: {
        label: 'DMZ Zone',
        zoneType: 'DMZ' as SecurityZone,
        description: 'Demilitarized zone for public services'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.DMZ,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'internal-zone',
      type: 'securityZone',
      position: { x: 1640, y: 50 },
      data: {
        label: 'Internal Zone',
        zoneType: 'Internal' as SecurityZone,
        description: 'Internal corporate network'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Internal,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'restricted-zone',
      type: 'securityZone',
      position: { x: 2510, y: 50 },
      data: {
        label: 'Restricted Zone',
        zoneType: 'Restricted' as SecurityZone,
        description: 'High-security data zone'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Restricted,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'critical-zone',
      type: 'securityZone',
      position: { x: 3380, y: 50 },
      data: {
        label: 'Critical Zone',
        zoneType: 'Critical' as SecurityZone,
        description: 'Critical infrastructure and key management'
      },
      style: {
        width: 650,
        height: 1000,
        background: colors.zoneBackgrounds.Critical,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'cloud-zone',
      type: 'securityZone',
      position: { x: 1640, y: -1070 },
      data: {
        label: 'Cloud Zone',
        zoneType: 'Cloud' as SecurityZone,
        description: 'Cloud services integration'
      },
      style: {
        width: 650,
        height: 1000,
        background: colors.zoneBackgrounds.Cloud,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'compliance-zone',
      type: 'securityZone',
      position: { x: 2510, y: 1170 },
      data: {
        label: 'Compliance Zone',
        zoneType: 'Compliance' as SecurityZone,
        description: 'Compliance and monitoring systems'
      },
      style: {
        width: 650,
        height: 1000,
        background: colors.zoneBackgrounds.Compliance,
        zIndex: -1
      }
    } as SecurityNode,

    // External Zone Components (zone x=50, delta=0)
    {
      id: 'internet-router',
      type: 'router',
      position: { x: 150, y: 350 },
      data: {
        label: 'Internet Router',
        description: 'BGP edge router handling external traffic',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        protocols: ['BGP', 'OSPF'],
        vendor: 'cisco',
        product: 'asr-9000',
        version: '7.0.2',
        securityControls: ['ACLs', 'BGP Security']
      }
    } as SecurityNode,
    {
      id: 'cdn',
      type: 'server',
      position: { x: 370, y: 200 },
      data: {
        label: 'CDN Edge',
        description: 'Content delivery network edge servers',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        protocols: ['HTTPS', 'HTTP/2'],
        vendor: 'cloudflare',
        product: 'edge',
        version: 'latest'
      }
    } as SecurityNode,

    // DMZ Zone Components (zone x=770, delta=-50)
    {
      id: 'perimeter-fw',
      type: 'firewall',
      position: { x: 870, y: 350 },
      data: {
        label: 'Perimeter Firewall',
        description: 'Next-gen firewall with IPS capabilities',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['any'],
        vendor: 'paloalto',
        product: 'pa-5220',
        version: '10.2.3',
        securityControls: ['IPS', 'SSL Inspection', 'Threat Prevention']
      }
    } as SecurityNode,
    {
      id: 'web-proxy',
      type: 'proxy',
      position: { x: 1120, y: 500 },
      data: {
        label: 'Web Application Proxy',
        description: 'Reverse proxy for web applications',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'HTTP'],
        vendor: 'f5',
        product: 'big-ip',
        version: '15.1.0',
        securityControls: ['SSL Termination', 'Load Balancing']
      }
    } as SecurityNode,
    {
      id: 'email-gateway',
      type: 'emailSecurity',
      position: { x: 1270, y: 200 },
      data: {
        label: 'Email Security Gateway',
        description: 'Email filtering and anti-malware scanning',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['SMTP', 'TLS'],
        vendor: 'proofpoint',
        product: 'email-protection',
        version: '8.17.0',
        securityControls: ['Anti-spam', 'Anti-malware', 'DLP']
      }
    } as SecurityNode,
    {
      id: 'vpn-concentrator',
      type: 'vpnGateway',
      position: { x: 1020, y: 650 },
      data: {
        label: 'VPN Concentrator',
        description: 'Remote access VPN endpoints',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['IPSec', 'SSL VPN'],
        vendor: 'cisco',
        product: 'asa',
        version: '9.16',
        securityControls: ['MFA', 'Certificate Auth']
      }
    } as SecurityNode,

    // Internal Zone Components (zone x=1640, delta=+50)
    {
      id: 'internal-fw',
      type: 'firewall',
      position: { x: 1740, y: 350 },
      data: {
        label: 'Internal Firewall',
        description: 'Segmentation firewall for internal zones',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['any'],
        vendor: 'fortinet',
        product: 'fortigate',
        version: '7.2.4',
        securityControls: ['VDOM', 'IPS', 'Application Control']
      }
    } as SecurityNode,
    {
      id: 'app-server-1',
      type: 'application',
      position: { x: 1990, y: 500 },
      data: {
        label: 'Application Server Farm',
        description: 'Business application servers',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'RDP'],
        vendor: 'vmware',
        product: 'vsphere',
        version: '7.0',
        technology: 'Windows Server 2019',
        patchLevel: 'Current',
        components: [
          { name: '.NET Framework', version: '4.8' },
          { name: '.NET Core', version: '3.1' }
        ],
        additionalContext: 'Running legacy .NET Framework 4.5 applications alongside newer .NET Core services'
      }
    } as SecurityNode,
    {
      id: 'db-cache',
      type: 'cache',
      position: { x: 2140, y: 650 },
      data: {
        label: 'Database Cache Layer',
        description: 'In-memory caching for database queries',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['Redis Protocol'],
        vendor: 'redis',
        product: 'enterprise',
        version: '6.2.6',
        additionalContext: 'Redis instances configured with default ports, persistence enabled'
      }
    } as SecurityNode,
    {
      id: 'file-server',
      type: 'storage',
      position: { x: 1890, y: 800 },
      data: {
        label: 'File Services',
        description: 'Network attached storage and file shares',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['SMB', 'NFS'],
        vendor: 'netapp',
        product: 'fas',
        version: '9.11.1',
        securityControls: ['Encryption at Rest', 'Access Controls']
      }
    } as SecurityNode,

    // Restricted Zone Components (zone x=2510, delta=+150)
    {
      id: 'data-fw',
      type: 'firewall',
      position: { x: 2610, y: 350 },
      data: {
        label: 'Data Zone Firewall',
        description: 'Database segmentation firewall',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['SQL'],
        vendor: 'checkpoint',
        product: 'quantum',
        version: 'R81.10',
        securityControls: ['Application Control', 'DLP', 'IPS']
      }
    } as SecurityNode,
    {
      id: 'primary-db',
      type: 'database',
      position: { x: 2860, y: 500 },
      data: {
        label: 'Primary Database Cluster',
        description: 'Oracle RAC cluster for core business data',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['Oracle Net', 'SQL*Net'],
        vendor: 'oracle',
        product: 'database',
        version: '19c',
        securityControls: ['TDE', 'Database Vault', 'Audit Vault'],
        additionalContext: 'Database links established to legacy systems, service accounts with DBA privileges'
      }
    } as SecurityNode,
    {
      id: 'data-warehouse',
      type: 'database',
      position: { x: 2710, y: 650 },
      data: {
        label: 'Data Warehouse',
        description: 'Enterprise data warehouse for analytics',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['SQL', 'JDBC'],
        vendor: 'teradata',
        product: 'vantage',
        version: '17.20',
        securityControls: ['Row Level Security', 'Encryption']
      }
    } as SecurityNode,
    {
      id: 'backup-system',
      type: 'backupSystem',
      position: { x: 3010, y: 800 },
      data: {
        label: 'Backup Infrastructure',
        description: 'Enterprise backup and recovery systems',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['NDMP', 'SMB'],
        vendor: 'veeam',
        product: 'backup-replication',
        version: '11.0',
        securityControls: ['Encryption', 'Immutable Storage']
      }
    } as SecurityNode,

    // Critical Zone Components (zone x=3380, delta=+250)
    {
      id: 'hsm',
      type: 'hsm',
      position: { x: 3530, y: 350 },
      data: {
        label: 'Hardware Security Module',
        description: 'Cryptographic key management',
        zone: 'Critical' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['PKCS#11'],
        vendor: 'thales',
        product: 'nshield',
        version: '12.80',
        securityControls: ['FIPS 140-2 Level 3', 'Key Escrow']
      }
    } as SecurityNode,
    {
      id: 'pki-ca',
      type: 'certificateAuthority',
      position: { x: 3780, y: 500 },
      data: {
        label: 'Certificate Authority',
        description: 'Internal PKI root and issuing CAs',
        zone: 'Critical' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'OCSP'],
        vendor: 'microsoft',
        product: 'ca',
        version: '2019',
        securityControls: ['HSM Integration', 'Offline Root CA']
      }
    } as SecurityNode,
    {
      id: 'privileged-access',
      type: 'pam',
      position: { x: 3630, y: 650 },
      data: {
        label: 'PAM System',
        description: 'Privileged access management vault',
        zone: 'Critical' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'SSH'],
        vendor: 'cyberark',
        product: 'pas',
        version: '12.6',
        securityControls: ['Session Recording', 'MFA', 'Approval Workflow']
      }
    } as SecurityNode,

    // Cloud Zone Components
    {
      id: 'cloud-gateway',
      type: 'gateway',
      position: { x: 1740, y: -920 },
      data: {
        label: 'Cloud Gateway',
        description: 'Hybrid cloud connectivity',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['IPSec', 'HTTPS'],
        vendor: 'aws',
        product: 'direct-connect',
        version: 'current',
        securityControls: ['VPN Backup', 'Traffic Encryption']
      }
    } as SecurityNode,
    {
      id: 'cloud-workloads',
      type: 'cloudService',
      position: { x: 1990, y: -770 },
      data: {
        label: 'Cloud Workloads',
        description: 'IaaS and PaaS services',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'SSH'],
        vendor: 'multi-cloud',
        product: 'iaas',
        version: 'various',
        additionalContext: 'Multiple cloud accounts with varying security baselines, some development instances with public IPs'
      }
    } as SecurityNode,
    {
      id: 'cloud-storage',
      type: 'storageAccount',
      position: { x: 2190, y: -620 },
      data: {
        label: 'Cloud Object Storage',
        description: 'Cloud-based storage services',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'S3'],
        vendor: 'aws',
        product: 's3',
        version: 'current',
        securityControls: ['Bucket Policies', 'Lifecycle Rules']
      }
    } as SecurityNode,

    // Compliance Zone Components
    {
      id: 'siem',
      type: 'siem',
      position: { x: 2610, y: 1470 },
      data: {
        label: 'SIEM Platform',
        description: 'Security information and event management',
        zone: 'Compliance' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['Syslog', 'HTTPS'],
        vendor: 'splunk',
        product: 'enterprise-security',
        version: '8.2.0',
        securityControls: ['ML Analytics', 'SOAR Integration']
      }
    } as SecurityNode,
    {
      id: 'compliance-scanner',
      type: 'complianceScanner',
      position: { x: 2860, y: 1620 },
      data: {
        label: 'Compliance Scanner',
        description: 'Automated compliance validation',
        zone: 'Compliance' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'SSH'],
        vendor: 'qualys',
        product: 'vmdr',
        version: '2.0',
        securityControls: ['Policy Compliance', 'CIS Benchmarks']
      }
    } as SecurityNode,
    {
      id: 'audit-log',
      type: 'logging',
      position: { x: 3010, y: 1470 },
      data: {
        label: 'Audit Log Repository',
        description: 'Immutable audit log storage',
        zone: 'Compliance' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['Syslog', 'HTTPS'],
        vendor: 'custom',
        product: 'audit-vault',
        version: '3.0',
        securityControls: ['WORM Storage', 'Blockchain', 'Tamper Detection'],
        additionalContext: 'Audit logs replicated to multiple locations, retention policies vary by system'
      }
    } as SecurityNode
  ],
  edges: [
    // External to DMZ connections
    {
      id: 'e-internet-fw',
      source: 'internet-router',
      target: 'perimeter-fw',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Filtered Traffic',
        protocol: 'any',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e-cdn-internet',
      source: 'cdn',
      target: 'internet-router',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'CDN Origin',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        zone: 'External' as SecurityZone
      }
    } as SecurityEdge,

    // DMZ internal connections
    {
      id: 'e-fw-proxy',
      source: 'perimeter-fw',
      target: 'web-proxy',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Web Traffic',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e-fw-email',
      source: 'perimeter-fw',
      target: 'email-gateway',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'left',
      data: {
        label: 'SMTP/TLS',
        protocol: 'SMTP',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e-fw-vpn',
      source: 'perimeter-fw',
      target: 'vpn-concentrator',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'left',
      data: {
        label: 'VPN Traffic',
        protocol: 'IPSec',
        encryption: 'AES-256',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,

    // DMZ to Internal
    {
      id: 'e-proxy-internal',
      source: 'web-proxy',
      target: 'internal-fw',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'App Requests',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e-email-internal',
      source: 'email-gateway',
      target: 'internal-fw',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Email Delivery',
        protocol: 'SMTP',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e-vpn-internal',
      source: 'vpn-concentrator',
      target: 'internal-fw',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Remote Access',
        protocol: 'SSL VPN',
        encryption: 'AES-256',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,

    // Internal connections
    {
      id: 'e-internal-app',
      source: 'internal-fw',
      target: 'app-server-1',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'App Traffic',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e-app-cache',
      source: 'app-server-1',
      target: 'db-cache',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Cache Queries',
        protocol: 'Redis',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e-app-file',
      source: 'app-server-1',
      target: 'file-server',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'File Access',
        protocol: 'SMB',
        encryption: 'SMB3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,

    // Internal to Restricted
    {
      id: 'e-cache-datafw',
      source: 'db-cache',
      target: 'data-fw',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'DB Queries',
        protocol: 'SQL',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e-app-datafw',
      source: 'app-server-1',
      target: 'data-fw',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Direct DB Access',
        protocol: 'SQL',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone
      }
    } as SecurityEdge,

    // Restricted connections
    {
      id: 'e-datafw-db',
      source: 'data-fw',
      target: 'primary-db',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'SQL Traffic',
        protocol: 'Oracle Net',
        encryption: 'Oracle Native',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e-db-warehouse',
      source: 'primary-db',
      target: 'data-warehouse',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'ETL Replication',
        protocol: 'SQL',
        encryption: 'SSL',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e-db-backup',
      source: 'primary-db',
      target: 'backup-system',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Backup Jobs',
        protocol: 'NDMP',
        encryption: 'AES-256',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone
      }
    } as SecurityEdge,

    // Critical zone connections
    {
      id: 'e-db-hsm',
      source: 'primary-db',
      target: 'hsm',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Key Operations',
        protocol: 'PKCS#11',
        encryption: 'Hardware',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Critical' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e-hsm-pki',
      source: 'hsm',
      target: 'pki-ca',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Key Storage',
        protocol: 'PKCS#11',
        encryption: 'Hardware',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Critical' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e-pam-db',
      source: 'privileged-access',
      target: 'primary-db',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Admin Access',
        protocol: 'SSH',
        encryption: 'SSH',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Critical' as SecurityZone
      }
    } as SecurityEdge,

    // Cloud connections
    {
      id: 'e-internal-cloud',
      source: 'app-server-1',
      target: 'cloud-gateway',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Hybrid Cloud',
        protocol: 'IPSec',
        encryption: 'AES-256',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e-cloud-workloads',
      source: 'cloud-gateway',
      target: 'cloud-workloads',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Cloud Deploy',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e-cloud-storage',
      source: 'cloud-workloads',
      target: 'cloud-storage',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Object Storage',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,

    // Compliance monitoring
    {
      id: 'e-all-siem',
      source: 'internal-fw',
      target: 'siem',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Security Events',
        protocol: 'Syslog',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Compliance' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e-db-audit',
      source: 'primary-db',
      target: 'audit-log',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Audit Trail',
        protocol: 'Syslog',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Compliance' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e-scanner-internal',
      source: 'compliance-scanner',
      target: 'app-server-1',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Vuln Scans',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Compliance' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e-siem-audit',
      source: 'siem',
      target: 'audit-log',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Event Archive',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Compliance' as SecurityZone
      }
    } as SecurityEdge
  ],
  grcWorkspace: enterpriseDataCenterGrcWorkspace,
  attackPaths: [
    {
      id: 'edc-ap-vpn-lateral',
      name: 'VPN Credential Compromise → Lateral Movement → DB Exfiltration',
      strideCategory: 'Elevation of Privilege',
      riskLevel: 'Critical',
      description: 'Attacker compromises VPN credentials via legacy certificate-only authentication that bypasses MFA, traverses internal firewall, exploits flat network segmentation to reach application servers, then pivots through data zone firewall to primary database for data exfiltration.',
      steps: [
        { order: 1, edgeId: 'e-fw-vpn', sourceNodeId: 'perimeter-fw', targetNodeId: 'vpn-concentrator', technique: 'T1133: External Remote Services' },
        { order: 2, edgeId: 'e-vpn-internal', sourceNodeId: 'vpn-concentrator', targetNodeId: 'internal-fw', technique: 'T1021: Remote Services' },
        { order: 3, edgeId: 'e-internal-app', sourceNodeId: 'internal-fw', targetNodeId: 'app-server-1', technique: 'T1570: Lateral Tool Transfer' },
        { order: 4, edgeId: 'e-app-datafw', sourceNodeId: 'app-server-1', targetNodeId: 'data-fw', technique: 'T1005: Data from Local System' },
        { order: 5, edgeId: 'e-datafw-db', sourceNodeId: 'data-fw', targetNodeId: 'primary-db', technique: 'T1213: Data from Information Repositories' },
      ],
      mitreTechniques: ['T1133', 'T1021', 'T1570', 'T1005', 'T1213'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'edc-ap-cache-exfil',
      name: 'Web Exploit → Unencrypted Cache Data Theft',
      strideCategory: 'Information Disclosure',
      riskLevel: 'High',
      description: 'Attacker exploits web application vulnerability through the DMZ, passes through the web proxy and internal firewall to reach application servers, then connects to unencrypted Redis cache on default ports to extract cached business-critical data without authentication.',
      steps: [
        { order: 1, edgeId: 'e-fw-proxy', sourceNodeId: 'perimeter-fw', targetNodeId: 'web-proxy', technique: 'T1190: Exploit Public-Facing Application' },
        { order: 2, edgeId: 'e-proxy-internal', sourceNodeId: 'web-proxy', targetNodeId: 'internal-fw', technique: 'T1071: Application Layer Protocol' },
        { order: 3, edgeId: 'e-internal-app', sourceNodeId: 'internal-fw', targetNodeId: 'app-server-1', technique: 'T1059: Command and Scripting Interpreter' },
        { order: 4, edgeId: 'e-app-cache', sourceNodeId: 'app-server-1', targetNodeId: 'db-cache', technique: 'T1557: Adversary-in-the-Middle' },
      ],
      mitreTechniques: ['T1190', 'T1071', 'T1059', 'T1557'],
      createdAt: '2025-06-01T00:05:00.000Z',
      updatedAt: '2025-06-01T00:05:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'edc-ap-pam-bypass',
      name: 'Service Account Abuse → PAM Bypass → Database Manipulation',
      strideCategory: 'Tampering',
      riskLevel: 'Critical',
      description: 'Insider or attacker with compromised Oracle service account credentials bypasses CyberArk PAM session recording and approval workflows, accesses primary database directly with DBA privileges, then propagates manipulated records to the data warehouse via ETL replication.',
      steps: [
        { order: 1, edgeId: 'e-pam-db', sourceNodeId: 'privileged-access', targetNodeId: 'primary-db', technique: 'T1078: Valid Accounts' },
        { order: 2, edgeId: 'e-db-warehouse', sourceNodeId: 'primary-db', targetNodeId: 'data-warehouse', technique: 'T1565: Data Manipulation' },
      ],
      mitreTechniques: ['T1078', 'T1565'],
      createdAt: '2025-06-01T00:10:00.000Z',
      updatedAt: '2025-06-01T00:10:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'edc-ap-cloud-pivot',
      name: 'Cloud Workload Compromise → Hybrid Network Pivot → Internal Data Access',
      strideCategory: 'Spoofing',
      riskLevel: 'High',
      description: 'Attacker compromises a cloud workload with a public IP and weak security baseline, traverses the cloud gateway IPSec tunnel back into the internal network via the application server hybrid cloud connection, then accesses the primary database through the data zone firewall.',
      steps: [
        { order: 1, edgeId: 'e-cloud-workloads', sourceNodeId: 'cloud-gateway', targetNodeId: 'cloud-workloads', technique: 'T1190: Exploit Public-Facing Application' },
        { order: 2, edgeId: 'e-internal-cloud', sourceNodeId: 'app-server-1', targetNodeId: 'cloud-gateway', technique: 'T1199: Trusted Relationship' },
        { order: 3, edgeId: 'e-app-datafw', sourceNodeId: 'app-server-1', targetNodeId: 'data-fw', technique: 'T1021: Remote Services' },
        { order: 4, edgeId: 'e-datafw-db', sourceNodeId: 'data-fw', targetNodeId: 'primary-db', technique: 'T1005: Data from Local System' },
      ],
      mitreTechniques: ['T1190', 'T1199', 'T1021', 'T1005'],
      createdAt: '2025-06-01T00:15:00.000Z',
      updatedAt: '2025-06-01T00:15:00.000Z',
    } as DiagramAttackPath,
  ],
};