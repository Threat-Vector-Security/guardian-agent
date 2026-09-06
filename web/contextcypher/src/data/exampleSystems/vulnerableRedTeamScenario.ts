import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityNode, SecurityEdge, SecurityZone } from '../../types/SecurityTypes';
import { DiagramAttackPath, AssessmentThreatModelNodeSourceType, AssessmentThreatModelEdgeSourceType, AttackPathRiskLevel, GrcWorkspace } from '../../types/GrcTypes';
import { colors } from '../../styles/Theme';
import { buildGrcWorkspace, score, NOW, OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID } from './grcSharedBase';
import { StrideCategory } from '../../types/ThreatIntelTypes';

const DIAGRAM_ID = 'vulnerable-red-team-scenario';

const tierCatalogue = [
  { id: 'tier1-cyber', tier: 1 as const, label: 'Cyber Risk', description: 'Information security and cyber threats' },
  { id: 'tier1-operational', tier: 1 as const, label: 'Operational Risk', description: 'Business operations and process risks' },
  { id: 'tier2-network', tier: 2 as const, label: 'Network Security', parentId: 'tier1-cyber', description: 'Network-level threats and controls' },
  { id: 'tier2-application', tier: 2 as const, label: 'Application Security', parentId: 'tier1-cyber', description: 'Application-layer vulnerabilities' },
  { id: 'tier2-identity', tier: 2 as const, label: 'Identity & Access', parentId: 'tier1-cyber', description: 'Authentication and authorization controls' },
  { id: 'tier2-data', tier: 2 as const, label: 'Data Protection', parentId: 'tier1-cyber', description: 'Data-at-rest and data-in-transit protection' },
  { id: 'tier2-monitoring', tier: 2 as const, label: 'Security Monitoring', parentId: 'tier1-operational', description: 'Logging, detection, and response' },
  { id: 'tier2-incident', tier: 2 as const, label: 'Incident Response', parentId: 'tier1-operational', description: 'Incident detection and response capabilities' },
  { id: 'tier3-lateral-movement', tier: 3 as const, label: 'Lateral Movement', parentId: 'tier2-network' },
  { id: 'tier3-phishing', tier: 3 as const, label: 'Phishing & Social Engineering', parentId: 'tier2-application' },
  { id: 'tier3-credential-theft', tier: 3 as const, label: 'Credential Theft', parentId: 'tier2-identity' },
  { id: 'tier3-privilege-escalation', tier: 3 as const, label: 'Privilege Escalation', parentId: 'tier2-identity' },
  { id: 'tier3-data-exfiltration', tier: 3 as const, label: 'Data Exfiltration', parentId: 'tier2-data' },
  { id: 'tier3-c2-comms', tier: 3 as const, label: 'C2 Communications', parentId: 'tier2-network' },
  { id: 'tier3-persistence', tier: 3 as const, label: 'Persistence Mechanisms', parentId: 'tier2-network' },
];

const assets = [
  {
    id: 'asset-trading-system', name: 'Trading Algorithm Server', type: 'application_server', owner: 'Quantitative Trading',
    domain: 'application' as const, category: 'Critical Application',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Proprietary trading algorithm server containing intellectual property worth billions',
    criticality: { confidentiality: 5, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: DIAGRAM_ID, nodeId: 'trading-system', nodeLabel: 'Trading Algorithm Server', nodeType: 'application' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-executive-db', name: 'Executive Database', type: 'database', owner: 'Executive Office',
    domain: 'application' as const, category: 'Database',
    businessCriticality: 5, securityCriticality: 5,
    description: 'SQL Server database containing M&A data, strategic plans, and executive communications',
    criticality: { confidentiality: 5, integrity: 5, availability: 4, financial: 5, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: DIAGRAM_ID, nodeId: 'executive-data', nodeLabel: 'Executive Database', nodeType: 'database' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-domain-controller', name: 'Active Directory Domain Controller', type: 'identity_provider', owner: 'IT Infrastructure',
    domain: 'it' as const, category: 'Identity Infrastructure',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Windows Server 2019 domain controller with service accounts using non-expiring passwords',
    criticality: { confidentiality: 5, integrity: 5, availability: 5, financial: 4, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: DIAGRAM_ID, nodeId: 'domain-controller', nodeLabel: 'Domain Controller', nodeType: 'authServer' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-email-gateway', name: 'Email Security Gateway', type: 'security_control', owner: 'Security Operations',
    domain: 'it' as const, category: 'Security Tools',
    businessCriticality: 4, securityCriticality: 4,
    description: 'Proofpoint email protection gateway that allows .xls files with macros',
    criticality: { confidentiality: 3, integrity: 4, availability: 4, financial: 3, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: DIAGRAM_ID, nodeId: 'email-gateway', nodeLabel: 'Email Security Gateway', nodeType: 'emailSecurity' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-vpn-gateway', name: 'VPN Gateway', type: 'network_device', owner: 'IT Infrastructure',
    domain: 'it' as const, category: 'Network Infrastructure',
    businessCriticality: 4, securityCriticality: 4,
    description: 'FortiGate VPN with permanent exceptions for some users',
    criticality: { confidentiality: 4, integrity: 4, availability: 4, financial: 3, reputation: 3, safety: 1 },
    diagramRefs: [{ diagramId: DIAGRAM_ID, nodeId: 'vpn-gateway', nodeLabel: 'VPN Gateway', nodeType: 'vpnGateway' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-employee-workstations', name: 'Employee Workstations', type: 'endpoint', owner: 'IT Infrastructure',
    domain: 'it' as const, category: 'Endpoints',
    businessCriticality: 3, securityCriticality: 4,
    description: 'Windows 11 corporate desktops with local admin rights granted to developers',
    criticality: { confidentiality: 3, integrity: 3, availability: 3, financial: 2, reputation: 3, safety: 1 },
    diagramRefs: [{ diagramId: DIAGRAM_ID, nodeId: 'employee-workstations', nodeLabel: 'Employee Workstations', nodeType: 'endpoint' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-customer-portal', name: 'Customer Trading Portal', type: 'web_server', owner: 'Product Engineering',
    domain: 'application' as const, category: 'Web Application',
    businessCriticality: 5, securityCriticality: 4,
    description: 'Client-facing trading interface with session tokens that do not expire for 24 hours',
    criticality: { confidentiality: 4, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: DIAGRAM_ID, nodeId: 'customer-portal', nodeLabel: 'Customer Portal', nodeType: 'application' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-file-server', name: 'Corporate File Server', type: 'storage', owner: 'IT Infrastructure',
    domain: 'it' as const, category: 'Servers',
    businessCriticality: 3, securityCriticality: 3,
    description: 'Windows Server 2019 file server where Everyone group has read access to most shares',
    criticality: { confidentiality: 3, integrity: 3, availability: 3, financial: 2, reputation: 2, safety: 1 },
    diagramRefs: [{ diagramId: DIAGRAM_ID, nodeId: 'file-server', nodeLabel: 'Corporate File Server', nodeType: 'storage' }],
    createdAt: NOW, updatedAt: NOW,
  },
];

const risks = [
  {
    id: 'risk-phishing-initial-access', title: 'Spear Phishing Initial Access',
    description: 'Email gateway allows .xls files with macros, enabling spear phishing payloads to reach employee workstations and establish initial foothold.',
    status: 'assessed' as const, owner: 'Security Operations',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Application Security', tier3: 'Phishing & Social Engineering' },
    assetIds: ['asset-email-gateway', 'asset-employee-workstations'],
    diagramLinks: [{ diagramId: DIAGRAM_ID, nodeIds: ['phishing-site', 'email-gateway', 'employee-workstations'] }],
    inherentScore: score('likelihood-5', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Block macro-enabled Office files at email gateway; deploy email sandboxing',
    threatActorIds: ['threat-actor-apt'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-credential-theft-kerberoast', title: 'Kerberoasting & Credential Theft',
    description: 'Service accounts with non-expiring passwords on the domain controller enable Kerberoasting attacks, allowing offline cracking of service account credentials.',
    status: 'assessed' as const, owner: 'IT Infrastructure',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Identity & Access', tier3: 'Credential Theft' },
    assetIds: ['asset-domain-controller'],
    diagramLinks: [{ diagramId: DIAGRAM_ID, nodeIds: ['domain-controller', 'file-server'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Implement managed service accounts with automatic password rotation; enforce AES-only Kerberos tickets',
    threatActorIds: ['threat-actor-apt'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-lateral-movement', title: 'Uncontrolled Lateral Movement',
    description: 'Incomplete network segmentation between zones allows pass-the-hash and RDP-based lateral movement from compromised workstations to internal servers.',
    status: 'draft' as const, owner: 'Network Security',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Network Security', tier3: 'Lateral Movement' },
    assetIds: ['asset-employee-workstations', 'asset-file-server', 'asset-domain-controller'],
    diagramLinks: [{ diagramId: DIAGRAM_ID, nodeIds: ['employee-workstations', 'file-server', 'domain-controller', 'lateral-pivot', 'implant-host'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Implement microsegmentation; restrict RDP and SMB to management VLANs; deploy EDR with lateral movement detection',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-golden-ticket-persistence', title: 'Golden Ticket Persistence',
    description: 'KRBTGT password has not been changed since 2018, enabling golden ticket attacks that grant unlimited persistent access to any service in the domain.',
    status: 'draft' as const, owner: 'IT Infrastructure',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Identity & Access', tier3: 'Privilege Escalation' },
    assetIds: ['asset-domain-controller'],
    diagramLinks: [{ diagramId: DIAGRAM_ID, nodeIds: ['domain-controller', 'persistence-mech'] }],
    inherentScore: score('likelihood-5', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Rotate KRBTGT password twice in succession; implement advanced Kerberos monitoring',
    threatActorIds: ['threat-actor-apt'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-data-exfiltration', title: 'Unmonitored Data Exfiltration Channel',
    description: 'Outbound HTTPS from the trusted zone is not monitored, enabling exfiltration of trading algorithms and executive data to attacker-controlled cloud storage.',
    status: 'assessed' as const, owner: 'Security Operations',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Data Protection', tier3: 'Data Exfiltration' },
    assetIds: ['asset-trading-system', 'asset-executive-db'],
    diagramLinks: [{ diagramId: DIAGRAM_ID, nodeIds: ['exfil-staging', 'cloud-storage', 'trading-system', 'executive-data'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Deploy DLP and SSL inspection on trusted zone egress; implement cloud access security broker (CASB)',
    threatActorIds: ['threat-actor-apt'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-c2-domain-fronting', title: 'C2 via Domain Fronting',
    description: 'Web proxy has SSL inspection disabled for banking sites, allowing C2 beacon traffic to tunnel through legitimate CDN domains without detection.',
    status: 'assessed' as const, owner: 'Network Security',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Network Security', tier3: 'C2 Communications' },
    assetIds: ['asset-employee-workstations'],
    diagramLinks: [{ diagramId: DIAGRAM_ID, nodeIds: ['employee-workstations', 'web-proxy', 'c2-server'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Enable SSL inspection with certificate pinning exceptions; deploy DNS monitoring and JA3 fingerprinting',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-vpn-credential-abuse', title: 'Stolen VPN Credentials',
    description: 'Permanent VPN exceptions and stolen credentials allow direct access from the internet to the domain controller, bypassing perimeter controls.',
    status: 'draft' as const, owner: 'IT Infrastructure',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Identity & Access', tier3: 'Credential Theft' },
    assetIds: ['asset-vpn-gateway', 'asset-domain-controller'],
    diagramLinks: [{ diagramId: DIAGRAM_ID, nodeIds: ['vpn-gateway', 'domain-controller'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Enforce MFA on all VPN connections; revoke permanent exceptions; implement conditional access policies',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-watering-hole', title: 'Watering Hole via Compromised Vendor',
    description: 'Compromised vendor website with outdated WordPress plugins redirects customer portal users to malicious payloads.',
    status: 'draft' as const, owner: 'Security Operations',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Application Security', tier3: 'Phishing & Social Engineering' },
    assetIds: ['asset-customer-portal'],
    diagramLinks: [{ diagramId: DIAGRAM_ID, nodeIds: ['compromised-site', 'customer-portal'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Implement content security policy headers; deploy browser isolation for external sites',
    createdAt: NOW, updatedAt: NOW,
  },
];

const assessments = [
  {
    id: 'assessment-red-team', title: 'Red Team Exercise Assessment - Financial Services APT Simulation',
    status: 'in_review' as const,
    owner: 'Red Team Lead',
    reviewer: 'CISO',
    startDate: '2025-04-01',
    dueDate: '2025-07-15',
    threatActorIds: ['threat-actor-apt', 'threat-actor-insider', 'threat-actor-supply-chain'],
    methodologyNote: 'Red team exercise following MITRE ATT&CK framework with 90-day campaign simulating an APT targeting proprietary trading data.',
    assumptionNote: 'Assessment assumes attacker has no prior internal access. Insider threat scenario tested separately. Physical access vectors excluded.',
    scopeItems: [
      { id: 'scope-full-org', type: 'system' as const, value: 'system', name: 'Multi-Vector Red Team Attack Scenario' },
      { id: 'scope-all-zones', type: 'diagram_segment' as const, value: 'all-zones', name: 'All Security Zones' },
      { id: 'scope-kill-chain', type: 'osi_layer' as const, value: 'Full Kill Chain', name: 'Full Kill Chain' },
    ],
    tierFilter: { tier1: 'Cyber Risk' },
    riskManagementPlan: {
      objective: 'Remediate all critical and high attack paths identified during the red team campaign before the next quarterly assessment.',
      strategy: 'Prioritize credential hygiene and network segmentation to break the most impactful attack chains.',
      residualRiskStatement: 'Residual risk accepted for low-probability social engineering scenarios with active compensating controls.',
      monitoringApproach: 'Bi-weekly remediation progress review with purple team validation of fixes.',
      communicationPlan: 'Weekly briefing to CISO; monthly board-level risk summary.',
      reviewCadenceDays: 14,
      actions: [
        {
          id: 'rmp-action-krbtgt-rotate',
          title: 'Rotate KRBTGT password twice to invalidate golden tickets',
          owner: 'IT Infrastructure',
          dueDate: '2025-05-15',
          status: 'in_progress' as const,
          linkedRiskIds: ['risk-golden-ticket-persistence'],
          notes: 'First rotation completed; waiting 48h before second rotation',
        },
        {
          id: 'rmp-action-email-macro-block',
          title: 'Block macro-enabled Office attachments at email gateway',
          owner: 'Security Operations',
          dueDate: '2025-05-01',
          status: 'done' as const,
          linkedRiskIds: ['risk-phishing-initial-access'],
          notes: 'Proofpoint policy updated and verified; macro attachments now quarantined',
        },
        {
          id: 'rmp-action-segmentation',
          title: 'Implement microsegmentation between Internal and Trusted zones',
          owner: 'Network Security',
          dueDate: '2025-06-30',
          status: 'planned' as const,
          linkedRiskIds: ['risk-lateral-movement'],
          notes: 'Architecture review scheduled for next sprint',
        },
        {
          id: 'rmp-action-ssl-inspection',
          title: 'Enable SSL inspection on web proxy for CDN-fronted domains',
          owner: 'Network Security',
          dueDate: '2025-06-15',
          status: 'in_progress' as const,
          linkedRiskIds: ['risk-c2-domain-fronting'],
          notes: 'Testing SSL inspection with banking site exception list',
        },
      ],
      updatedAt: NOW,
    },
    riskIds: risks.map(r => r.id),
    soaGapIds: ['rt-soa-a01', 'rt-soa-a05', 'rt-soa-a07'],
    taskIds: ['task-krbtgt-rotation', 'task-email-hardening', 'task-dlp-deployment', 'task-purple-team-validation'],
    linkedImplementedControlIds: [],
    linkedInitiativeIds: [],
    summary: 'Full-scope red team assessment simulating an APT campaign against a financial services organization. The exercise identified 8 risks across the kill chain, with 3 Critical and 3 High severity findings.',
    findings: 'Key findings: spear phishing bypassed email controls, domain admin obtained via Kerberoasting within 3 weeks, golden ticket persistence enabled indefinite access, and trading algorithms successfully exfiltrated via unmonitored HTTPS.',
    recommendations: 'Immediate KRBTGT rotation, email gateway hardening, network microsegmentation, and egress monitoring with DLP are the top priorities.',
    evidenceSummary: 'Evidence package includes C2 beacon logs, credential dump artifacts, lateral movement traces, and exfiltration proof-of-concept.',
    threatModel: {
      nodes: [
        { id: 'tm-phishing', label: 'Phishing Infrastructure', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'phishing-site', position: { x: 50, y: 150 }, nodeType: 'phishingServer' },
        { id: 'tm-email-gw', label: 'Email Gateway', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'email-gateway', position: { x: 200, y: 150 }, nodeType: 'emailSecurity', commentary: 'Allows macro-enabled .xls attachments' },
        { id: 'tm-workstations', label: 'Employee Workstations', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'employee-workstations', position: { x: 350, y: 150 }, nodeType: 'endpoint', commentary: 'Initial foothold via phishing payload' },
        { id: 'tm-dc', label: 'Domain Controller', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'domain-controller', position: { x: 500, y: 150 }, nodeType: 'authServer', commentary: 'Kerberoasting target; non-expiring service account passwords' },
        { id: 'tm-trading', label: 'Trading System', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'trading-system', position: { x: 650, y: 100 }, nodeType: 'application', commentary: 'Primary exfiltration target' },
        { id: 'tm-exfil', label: 'Data Staging', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'exfil-staging', position: { x: 650, y: 250 }, nodeType: 'exfilChannel' },
      ],
      edges: [
        { id: 'tm-e-phish', source: 'tm-phishing', target: 'tm-email-gw', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e1', label: 'Phishing Email', commentary: 'Spear phishing with macro-enabled .xls lure' },
        { id: 'tm-e-deliver', source: 'tm-email-gw', target: 'tm-workstations', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e2', label: 'Delivered Payload' },
        { id: 'tm-e-cred', source: 'tm-workstations', target: 'tm-dc', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e6', label: 'Credential Harvest (via file server pivot)', commentary: 'Kerberoasting from compromised workstation' },
        { id: 'tm-e-trading', source: 'tm-dc', target: 'tm-trading', sourceType: 'manual' as AssessmentThreatModelEdgeSourceType, label: 'Service Account Access', commentary: 'Domain admin credentials used to reach trading system' },
        { id: 'tm-e-stage', source: 'tm-trading', target: 'tm-exfil', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e10', label: 'Data Collection' },
      ],
      attackPathDescription: 'Primary kill chain: Spear phishing delivers payload to workstation, lateral movement via credential harvesting leads to domain controller compromise, service account abuse reaches trading system, data staged and exfiltrated via unmonitored HTTPS.',
      attackPaths: [
        {
          id: 'aap-phishing-to-trading',
          name: 'Spear Phishing → Domain Compromise → Trading Algorithm Exfiltration',
          strideCategory: 'Information Disclosure' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'Full kill chain from spear phishing initial access through lateral movement and domain compromise to trading algorithm exfiltration.',
          diagramAttackPathId: 'ap-phishing-to-exfil',
          steps: [
            { order: 1, edgeId: 'e1', sourceNodeId: 'phishing-site', targetNodeId: 'email-gateway', technique: 'T1566: Phishing' },
            { order: 2, edgeId: 'e2', sourceNodeId: 'email-gateway', targetNodeId: 'employee-workstations', technique: 'T1204: User Execution' },
            { order: 3, edgeId: 'e5', sourceNodeId: 'employee-workstations', targetNodeId: 'file-server', technique: 'T1021: Remote Services' },
            { order: 4, edgeId: 'e6', sourceNodeId: 'file-server', targetNodeId: 'domain-controller', technique: 'T1558: Steal or Forge Kerberos Tickets' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
        {
          id: 'aap-golden-ticket',
          name: 'Golden Ticket Persistence → Unlimited Domain Access',
          strideCategory: 'Elevation of Privilege' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'KRBTGT password unchanged since 2018 enables golden ticket attacks for indefinite persistence across the entire domain.',
          diagramAttackPathId: 'ap-golden-ticket-persistence',
          steps: [
            { order: 1, edgeId: 'e7', sourceNodeId: 'domain-controller', targetNodeId: 'lateral-pivot', technique: 'T1550: Use Alternate Authentication Material' },
            { order: 2, edgeId: 'e13', sourceNodeId: 'domain-controller', targetNodeId: 'persistence-mech', technique: 'T1558.001: Golden Ticket' },
            { order: 3, edgeId: 'e14', sourceNodeId: 'persistence-mech', targetNodeId: 'c2-server', technique: 'T1071: Application Layer Protocol' },
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
    id: 'rt-soa-a01', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A01', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'VPN has permanent exceptions for convenience users. File server shares grant read access to Everyone group. Customer portal sessions valid for 24 hours.',
    mitigatesRiskIds: ['risk-vpn-credential-abuse', 'risk-lateral-movement'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'rt-soa-a02', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A02', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'SSL inspection disabled on web proxy for banking sites, creating blind spot for encrypted C2 channels. Outbound HTTPS from trusted zone unmonitored.',
    mitigatesRiskIds: ['risk-c2-domain-fronting', 'risk-data-exfiltration'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'rt-soa-a03', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A03', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'implemented' as const,
    justification: 'Partner API gateway uses parameterized queries. Customer portal has input validation. API keys are transmitted in URL parameters, creating injection risk in logs.',
    mitigatesRiskIds: [],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'rt-soa-a05', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A05', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Debug endpoints enabled on corporate website. Local admin rights granted to developers on workstations. Web proxy SSL inspection disabled for critical traffic categories.',
    mitigatesRiskIds: ['risk-c2-domain-fronting', 'risk-lateral-movement'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'rt-soa-a06', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A06', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Compromised vendor site runs outdated WordPress 5.8 with vulnerable plugins. FortiGate VPN running 7.0.12 requires security update.',
    mitigatesRiskIds: ['risk-watering-hole'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'rt-soa-a07', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A07', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Service accounts have non-expiring passwords. KRBTGT not rotated since 2018. VPN uses permanent session exceptions. Cached domain admin credentials found on compromised workstation.',
    mitigatesRiskIds: ['risk-credential-theft-kerberoast', 'risk-golden-ticket-persistence', 'risk-vpn-credential-abuse'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'rt-soa-a09', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A09', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Network monitoring has blind spots in trusted zone egress. Red team C2 beacons went undetected for 90+ days. Domain fronting through CDN evades current detection rules.',
    mitigatesRiskIds: ['risk-c2-domain-fronting', 'risk-data-exfiltration'],
    diagramRefs: [],
    evidence: [
      { id: 'evidence-rt-a09-c2-logs', kind: 'link' as const, name: 'Red Team C2 Beacon Activity Log', url: 'https://security.example.local/redteam/c2-activity-log', note: 'Full C2 session logs from 90-day campaign', createdAt: NOW },
    ],
    updatedAt: NOW,
  },
  {
    id: 'rt-soa-cis-03', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.03', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Trading algorithm source code and executive M&A data exfiltrated during red team exercise via unmonitored HTTPS. No DLP controls on trusted zone egress.',
    mitigatesRiskIds: ['risk-data-exfiltration'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'rt-soa-cis-05', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.05', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Service account passwords do not expire. Shared admin credentials found cached on pivot workstation. KRBTGT rotation overdue by 7 years.',
    mitigatesRiskIds: ['risk-credential-theft-kerberoast', 'risk-golden-ticket-persistence'],
    diagramRefs: [],
    evidence: [
      { id: 'evidence-rt-cis05-mimikatz', kind: 'link' as const, name: 'Credential Dump Analysis', url: 'https://security.example.local/redteam/credential-analysis', note: 'Mimikatz output showing cached domain admin credentials', createdAt: NOW },
    ],
    updatedAt: NOW,
  },
  {
    id: 'rt-soa-cis-06', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.06', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'File server grants read access to Everyone group. Developers have local admin on workstations. No privilege access management solution deployed.',
    mitigatesRiskIds: ['risk-lateral-movement', 'risk-credential-theft-kerberoast'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
];

const workflowTasks = [
  {
    id: 'task-krbtgt-rotation',
    title: 'Execute KRBTGT double password rotation',
    description: 'Rotate the KRBTGT account password twice (with 48h interval) to invalidate all existing golden tickets.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'critical' as const,
    owner: 'IT Infrastructure',
    dueDate: '2025-05-15',
    riskId: 'risk-golden-ticket-persistence',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'task-email-hardening',
    title: 'Harden email gateway macro policy',
    description: 'Configure Proofpoint to quarantine all macro-enabled Office attachments and implement email sandboxing.',
    type: 'risk_treatment' as const,
    status: 'done' as const,
    priority: 'critical' as const,
    owner: 'Security Operations',
    dueDate: '2025-05-01',
    riskId: 'risk-phishing-initial-access',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'task-dlp-deployment',
    title: 'Deploy DLP on trusted zone egress points',
    description: 'Implement data loss prevention controls on all outbound connections from the trusted zone to detect and block data exfiltration attempts.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Security Operations',
    dueDate: '2025-06-30',
    riskId: 'risk-data-exfiltration',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'task-purple-team-validation',
    title: 'Purple team validation of remediation effectiveness',
    description: 'Conduct purple team exercises to validate that implemented remediations effectively break the identified attack chains.',
    type: 'assessment' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Red Team Lead',
    dueDate: '2025-07-15',
    assessmentId: 'assessment-red-team',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'task-service-account-audit',
    title: 'Audit and rotate all service account credentials',
    description: 'Identify all service accounts with non-expiring passwords, implement managed service accounts where possible, and enforce automatic rotation.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'critical' as const,
    owner: 'IT Infrastructure',
    dueDate: '2025-05-31',
    riskId: 'risk-credential-theft-kerberoast',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'task-evidence-c2-detection',
    title: 'Document C2 detection gap evidence for A09',
    description: 'Compile evidence from red team campaign showing C2 beacons that evaded current monitoring for remediation tracking.',
    type: 'evidence' as const,
    status: 'in_progress' as const,
    priority: 'medium' as const,
    owner: 'Security Operations',
    dueDate: '2025-05-15',
    controlSetId: OWASP_CONTROL_SET_ID,
    controlId: 'A09',
    createdAt: NOW, updatedAt: NOW,
  },
];

const threatActors = [
  {
    id: 'threat-actor-apt', name: 'APT-FinStrike (Simulated)',
    type: 'nation_state' as const, capabilityLevel: 5,
    resourceLevel: 'very_high' as const,
    motivation: 'Exfiltration of proprietary trading algorithms and M&A intelligence for economic espionage.',
    description: 'Simulated advanced persistent threat group targeting financial services organizations. Uses multi-vector campaigns including spear phishing, supply chain compromise, and zero-day exploitation. Known for patient lateral movement and long-dwell-time operations.',
    targetedAssetIds: ['asset-trading-system', 'asset-executive-db', 'asset-domain-controller'],
    tags: ['apt', 'financial-espionage', 'state-sponsored', 'long-dwell'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'threat-actor-insider', name: 'Disgruntled Trader',
    type: 'insider' as const, capabilityLevel: 3,
    resourceLevel: 'moderate' as const,
    motivation: 'Financial gain through selling proprietary trading strategies to competitors or personal revenge after termination.',
    description: 'Current or former employee with legitimate access to trading systems and knowledge of internal processes. May cooperate with external threat actors for recruitment incentives.',
    targetedAssetIds: ['asset-trading-system', 'asset-executive-db', 'asset-employee-workstations'],
    tags: ['insider-threat', 'trading-data', 'privileged-access'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'threat-actor-supply-chain', name: 'Compromised Third-Party Vendor',
    type: 'supply_chain' as const, capabilityLevel: 4,
    resourceLevel: 'high' as const,
    motivation: 'Indirect access to target organization through trusted vendor relationship and compromised vendor infrastructure.',
    description: 'Vendor website running outdated WordPress CMS with vulnerable plugins provides watering hole attack vector. May also deliver compromised software updates.',
    targetedAssetIds: ['asset-customer-portal'],
    tags: ['supply-chain', 'watering-hole', 'vendor-compromise'],
    createdAt: NOW, updatedAt: NOW,
  },
];

const threatScenarios = [
  {
    id: 'scenario-apt-full-chain', title: 'APT Full Kill Chain - Trading Algorithm Exfiltration',
    description: 'APT group executes 90-day campaign starting with spear phishing, establishing C2 via domain fronting, performing lateral movement through credential harvesting, and exfiltrating proprietary trading algorithms through unmonitored HTTPS channels.',
    threatActorId: 'threat-actor-apt',
    targetedAssetIds: ['asset-trading-system', 'asset-executive-db', 'asset-domain-controller', 'asset-employee-workstations'],
    attackTechniques: ['T1566 - Phishing', 'T1204 - User Execution', 'T1558 - Steal or Forge Kerberos Tickets', 'T1550 - Use Alternate Authentication Material', 'T1041 - Exfiltration Over C2 Channel'],
    linkedRiskIds: ['risk-phishing-initial-access', 'risk-credential-theft-kerberoast', 'risk-lateral-movement', 'risk-data-exfiltration'],
    likelihood: 'Very High - Red team exercise confirmed full kill chain execution with 90+ day dwell time.',
    impact: 'Critical - Trading algorithms valued at $2B+ in competitive advantage; M&A data could trigger insider trading violations.',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'scenario-golden-ticket', title: 'Golden Ticket Persistence & Domain Takeover',
    description: 'After obtaining domain admin access, attacker forges golden tickets using the never-rotated KRBTGT hash, enabling indefinite persistence across the entire domain even if individual account passwords are changed.',
    threatActorId: 'threat-actor-apt',
    targetedAssetIds: ['asset-domain-controller', 'asset-trading-system', 'asset-executive-db'],
    attackTechniques: ['T1558.001 - Golden Ticket', 'T1550 - Use Alternate Authentication Material', 'T1078 - Valid Accounts'],
    linkedRiskIds: ['risk-golden-ticket-persistence', 'risk-credential-theft-kerberoast'],
    likelihood: 'High - KRBTGT password unchanged since 2018 makes golden ticket trivial once domain admin is obtained.',
    impact: 'Critical - Persistent, undetectable access to all domain resources including trading systems and executive databases.',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'scenario-insider-data-theft', title: 'Insider Trading Data Theft',
    description: 'Disgruntled trader leverages legitimate access and knowledge of shared credentials to copy trading algorithms and executive M&A data, staging it for exfiltration through the unmonitored trusted zone.',
    threatActorId: 'threat-actor-insider',
    targetedAssetIds: ['asset-trading-system', 'asset-executive-db'],
    attackTechniques: ['T1005 - Data from Local System', 'T1074 - Data Staged', 'T1048 - Exfiltration Over Alternative Protocol'],
    linkedRiskIds: ['risk-data-exfiltration', 'risk-lateral-movement'],
    likelihood: 'Moderate - Requires insider with trading system access and motivation, but file server permissions are overly broad.',
    impact: 'Critical - Proprietary trading algorithms and M&A intelligence exposed to competitors or hostile entities.',
    createdAt: NOW, updatedAt: NOW,
  },
];

export const vulnerableRedTeamScenarioGrcWorkspace: GrcWorkspace = buildGrcWorkspace({
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
      id: 'vrts-tp-proofpoint',
      name: 'Proofpoint',
      description: 'SaaS email security platform providing advanced threat protection, email filtering, phishing simulation, and targeted attack protection for the enterprise email gateway.',
      category: 'saas' as const,
      status: 'active' as const,
      riskRating: 'high' as const,
      dataClassification: 'confidential' as const,
      linkedAssetIds: ['asset-email-gateway', 'asset-employee-workstations'],
      linkedRiskIds: ['risk-phishing-initial-access', 'risk-watering-hole'],
      contactName: 'Jennifer Walsh',
      contactEmail: 'jennifer.walsh@proofpoint.example.com',
      contractExpiry: '2027-03-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-09-30',
      notes: 'Proofpoint P1 bundle with Targeted Attack Protection (TAP), Email Fraud Defense, and Security Awareness Training. Despite TAP, red team successfully delivered phishing payload via HTML smuggling in .eml attachment — Proofpoint sandbox did not detonate the payload due to time-delay execution. URL rewriting active but attackers used legitimate cloud storage links. Phishing simulation click rate is 12% — above 5% target. MX records point to Proofpoint cloud — all inbound/outbound email transits their infrastructure.'
    },
    {
      id: 'vrts-tp-crowdstrike',
      name: 'CrowdStrike',
      description: 'Managed endpoint detection and response (EDR) and managed detection and response (MDR) service providing Falcon sensor deployment, 24/7 threat hunting, and incident response retainer.',
      category: 'managed_service' as const,
      status: 'active' as const,
      riskRating: 'critical' as const,
      dataClassification: 'confidential' as const,
      linkedAssetIds: ['asset-employee-workstations', 'asset-domain-controller', 'asset-file-server'],
      linkedRiskIds: ['risk-credential-theft-kerberoast', 'risk-lateral-movement', 'risk-golden-ticket-persistence'],
      contactName: 'Alex Mercer',
      contactEmail: 'alex.mercer@crowdstrike.example.com',
      contractExpiry: '2027-06-30',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-12-31',
      notes: 'CrowdStrike Falcon Complete (MDR) with Insight XDR. Falcon sensor deployed to 94% of endpoints — domain controllers and trading systems excluded due to performance concerns, creating blind spots for Kerberoasting and golden ticket attacks. Red team achieved lateral movement via unmonitored jump hosts. OverWatch team detected credential dumping on monitored hosts but golden ticket persistence evaded detection for 72 hours. Kernel-level access on all monitored endpoints. SOC 2 Type II and FedRAMP Moderate certified.'
    },
    {
      id: 'vrts-tp-palo-alto',
      name: 'Palo Alto Networks',
      description: 'Network security supplier providing next-generation firewalls, GlobalProtect VPN, and Cortex XSOAR for security orchestration protecting the enterprise perimeter and remote access.',
      category: 'supplier' as const,
      status: 'active' as const,
      riskRating: 'high' as const,
      dataClassification: 'confidential' as const,
      linkedAssetIds: ['asset-vpn-gateway', 'asset-customer-portal'],
      linkedRiskIds: ['risk-vpn-credential-abuse', 'risk-c2-domain-fronting', 'risk-data-exfiltration'],
      contactName: 'David Kim',
      contactEmail: 'david.kim@paloaltonetworks.example.com',
      contractExpiry: '2027-01-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-07-31',
      notes: 'PA-5250 firewalls with GlobalProtect VPN and WildFire sandboxing. Red team exploited VPN credential abuse using stolen certificates — GlobalProtect MFA was SMS-based and bypassed via SIM swap. Domain fronting C2 traffic via legitimate CDN domains evaded SSL decryption policies. Data exfiltration via DNS tunneling detected by Cortex XDR but response playbook took 4 hours to execute. Threat Prevention signatures 48 hours behind for zero-day C2 infrastructure.'
    },
    {
      id: 'vrts-tp-bloomberg',
      name: 'Bloomberg L.P.',
      description: 'SaaS financial data and trading terminal provider delivering real-time market data, trade execution capabilities, and financial analytics to the trading floor.',
      category: 'saas' as const,
      status: 'active' as const,
      riskRating: 'critical' as const,
      dataClassification: 'restricted' as const,
      linkedAssetIds: ['asset-trading-system', 'asset-executive-db'],
      linkedRiskIds: ['risk-data-exfiltration', 'risk-lateral-movement'],
      contactName: 'Robert Sinclair',
      contactEmail: 'robert.sinclair@bloomberg.example.com',
      contractExpiry: '2027-12-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-12-31',
      notes: 'Bloomberg Terminal with B-PIPE data feed and EMSX execution management. Terminals have dedicated network segment but share authentication with corporate AD — lateral movement from compromised workstations can reach trading infrastructure via Kerberos ticket reuse. Bloomberg chat logs contain insider trading-relevant communications stored in executive database. Terminal fingerprinting provides endpoint identity but does not prevent access from golden ticket attacks. SEC/FINRA regulatory data retention requirements apply.'
    },
    {
      id: 'vrts-tp-cobalt-strike',
      name: 'Fortra (Cobalt Strike)',
      description: 'Licensed adversary simulation and red team tooling contractor providing Cobalt Strike licenses, operator training, and custom malleable C2 profile development.',
      category: 'contractor' as const,
      status: 'under_review' as const,
      riskRating: 'high' as const,
      dataClassification: 'confidential' as const,
      linkedAssetIds: ['asset-employee-workstations', 'asset-domain-controller'],
      linkedRiskIds: ['risk-c2-domain-fronting', 'risk-golden-ticket-persistence'],
      contactName: 'Scott Henderson',
      contactEmail: 'scott.henderson@fortra.example.com',
      contractExpiry: '2026-08-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-05-31',
      notes: 'UNDER REVIEW: Cobalt Strike license used by internal red team for adversary simulation. License verification and operator vetting under review after Fortra breach disclosure. Custom malleable C2 profiles developed for domain fronting scenarios — profiles stored on red team file share with restricted ACLs. Cobalt Strike beacons detected by CrowdStrike on monitored hosts but unmonitored systems (DCs, trading) are blind spots. License renewal contingent on security review of Fortra supply chain and operator access controls.'
    },
  ],
  securityInitiatives: [
    {
      id: 'vrts-si-detection-improvement', title: 'Detection Engineering & Purple Team Improvement Program',
      description: 'Remediate detection blind spots identified during the red team exercise by deploying SIEM correlation rules for Kerberoasting, golden ticket usage, and C2 domain fronting, and establish a recurring purple team validation cadence.',
      category: 'uplift' as const, status: 'in_progress' as const, priority: 'critical' as const,
      owner: 'Security Operations', executiveSponsor: 'CISO',
      currentState: 'C2 beacons went undetected for 90+ days; domain fronting through CDN evades current detection rules; SIEM has no correlation rules for Kerberoasting or golden ticket attacks; no structured purple team program.',
      targetState: 'SIEM correlation rules for all MITRE ATT&CK techniques used in the red team campaign; SSL inspection on CDN-fronted domains; bi-weekly purple team validation of detection coverage; mean time to detect (MTTD) under 24 hours.',
      startDate: '2025-05-01', targetDate: '2026-06-30', completedDate: '',
      milestones: [
        { id: 'vrts-ms-det-01', title: 'Deploy SIEM correlation rules for credential theft techniques', description: 'Create and tune Splunk correlation rules for Kerberoasting (AS-REP roasting, RC4 ticket requests), golden ticket usage (TGT anomalies), and pass-the-hash detection.', status: 'completed' as const, dueDate: '2025-09-30', completedDate: '2025-09-22', owner: 'Security Operations' },
        { id: 'vrts-ms-det-02', title: 'Enable SSL inspection for CDN-fronted domains', description: 'Configure web proxy SSL inspection with JA3 fingerprinting for CDN-fronted domains commonly used for C2 domain fronting, while maintaining banking site exceptions.', status: 'in_progress' as const, dueDate: '2026-01-31', completedDate: '', owner: 'Network Security' },
        { id: 'vrts-ms-det-03', title: 'Establish bi-weekly purple team validation cadence', description: 'Implement structured purple team exercises with CrowdStrike MDR team validating detection coverage for each MITRE ATT&CK technique identified in the red team report.', status: 'pending' as const, dueDate: '2026-06-30', completedDate: '', owner: 'Security Operations' },
      ],
      linkedRiskIds: ['risk-c2-domain-fronting', 'risk-credential-theft-kerberoast', 'risk-golden-ticket-persistence', 'risk-data-exfiltration'],
      linkedControlSetIds: [],
      linkedAssetIds: ['asset-employee-workstations', 'asset-domain-controller', 'asset-trading-system'],
      linkedImplementedControlIds: ['vrts-ic-edr'],
      linkedAssessmentIds: ['assessment-red-team'],
      notes: 'Kerberoasting detection rules deployed and validated with purple team. SSL inspection testing in progress with banking site exception list.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'vrts-si-identity-hardening', title: 'Active Directory & Identity Infrastructure Hardening',
      description: 'Eliminate golden ticket persistence by rotating KRBTGT, implement managed service accounts with automatic password rotation, and enforce MFA on all VPN connections to prevent credential-based attacks.',
      category: 'remediation' as const, status: 'in_progress' as const, priority: 'critical' as const,
      owner: 'IT Infrastructure', executiveSponsor: 'CTO',
      currentState: 'KRBTGT password unchanged since 2018; service accounts use non-expiring passwords; VPN has permanent session exceptions; developers have local admin rights on workstations.',
      targetState: 'KRBTGT rotated twice to invalidate golden tickets; all service accounts using gMSA with automatic rotation; MFA enforced on 100% of VPN connections; local admin removed from developer workstations with PAM for elevation.',
      startDate: '2025-05-01', targetDate: '2026-03-31', completedDate: '',
      milestones: [
        { id: 'vrts-ms-id-01', title: 'Complete KRBTGT double rotation', description: 'Rotate KRBTGT password twice in succession with 48-hour interval to invalidate all existing golden tickets without disrupting legitimate Kerberos authentication.', status: 'in_progress' as const, dueDate: '2025-08-31', completedDate: '', owner: 'IT Infrastructure' },
        { id: 'vrts-ms-id-02', title: 'Migrate service accounts to gMSA', description: 'Replace all service accounts with non-expiring passwords with Group Managed Service Accounts (gMSA) providing automatic 30-day password rotation.', status: 'pending' as const, dueDate: '2026-03-31', completedDate: '', owner: 'IT Infrastructure' },
      ],
      linkedRiskIds: ['risk-golden-ticket-persistence', 'risk-credential-theft-kerberoast', 'risk-vpn-credential-abuse', 'risk-lateral-movement'],
      linkedControlSetIds: [],
      linkedAssetIds: ['asset-domain-controller', 'asset-vpn-gateway', 'asset-employee-workstations'],
      linkedImplementedControlIds: ['vrts-ic-edr', 'vrts-ic-dlp'],
      linkedAssessmentIds: ['assessment-red-team'],
      notes: 'First KRBTGT rotation completed. Waiting 48 hours before second rotation. gMSA migration requires application compatibility testing for 23 service accounts.',
      createdAt: NOW, updatedAt: NOW,
    },
  ],
  implementedControls: [
    {
      id: 'vrts-ic-edr', title: 'CrowdStrike Falcon EDR/MDR',
      description: 'CrowdStrike Falcon sensor deployed on endpoints providing real-time endpoint detection and response, managed threat hunting, and behavioral analysis with 24/7 MDR coverage.',
      controlType: 'technical' as const, category: 'endpoint_protection' as const,
      status: 'active' as const, automationLevel: 'fully_automated' as const,
      owner: 'Security Operations', vendor: 'CrowdStrike', product: 'Falcon Insight XDR', version: '2024.Q4',
      implementedDate: '2023-09-01', lastReviewDate: '2025-06-01', nextReviewDate: '2026-06-01',
      linkedSoaEntryIds: ['rt-soa-a09', 'rt-soa-cis-05'],
      linkedRiskIds: ['risk-phishing-initial-access', 'risk-lateral-movement', 'risk-credential-theft-kerberoast'],
      linkedAssetIds: ['asset-employee-workstations', 'asset-file-server', 'asset-customer-portal'],
      linkedAssessmentIds: ['assessment-red-team'],
      notes: 'Falcon deployed on 95% of endpoints. Domain controllers and trading servers lack Falcon coverage — identified as blind spot during red team exercise. MDR team detected lateral movement but 4-hour MTTD was insufficient.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'vrts-ic-dlp', title: 'Forcepoint DLP & CASB',
      description: 'Forcepoint DLP and Cloud Access Security Broker providing data loss prevention on trusted zone egress, cloud storage monitoring, and shadow IT detection for exfiltration channel control.',
      controlType: 'technical' as const, category: 'monitoring' as const,
      status: 'planned' as const, automationLevel: 'semi_automated' as const,
      owner: 'Security Operations', vendor: 'Forcepoint', product: 'DLP + CASB', version: '2025',
      implementedDate: '', lastReviewDate: '', nextReviewDate: '2026-03-01',
      linkedSoaEntryIds: ['rt-soa-a02', 'rt-soa-cis-03'],
      linkedRiskIds: ['risk-data-exfiltration', 'risk-c2-domain-fronting'],
      linkedAssetIds: ['asset-trading-system', 'asset-executive-db'],
      linkedAssessmentIds: ['assessment-red-team'],
      notes: 'Planned deployment to address unmonitored HTTPS egress from trusted zone. Procurement approved. PoC environment configured for Q1 2026 deployment.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'vrts-ic-email-gateway', title: 'Proofpoint Email Protection Gateway',
      description: 'Proofpoint Targeted Attack Protection (TAP) email security gateway with advanced sandboxing, URL rewriting, and phishing simulation for inbound email threat detection.',
      controlType: 'technical' as const, category: 'network_security' as const,
      status: 'active' as const, automationLevel: 'fully_automated' as const,
      owner: 'Security Operations', vendor: 'Proofpoint', product: 'TAP P1', version: '2024',
      implementedDate: '2022-06-01', lastReviewDate: '2025-05-15', nextReviewDate: '2026-05-15',
      linkedSoaEntryIds: ['rt-soa-a05', 'rt-soa-a06'],
      linkedRiskIds: ['risk-phishing-initial-access', 'risk-watering-hole'],
      linkedAssetIds: ['asset-email-gateway', 'asset-employee-workstations'],
      linkedAssessmentIds: ['assessment-red-team'],
      notes: 'Macro-enabled Office file blocking policy added post red-team exercise. HTML smuggling bypass identified — Proofpoint sandbox time-delay detonation improvement requested.',
      createdAt: NOW, updatedAt: NOW,
    },
  ],
});

export const vulnerableRedTeamScenario: ExampleSystem = {
  id: 'vulnerable-red-team-scenario',
  name: 'Multi-Vector Red Team Attack Scenario',
  description: 'Comprehensive red team simulation environment demonstrating advanced persistent threat techniques',
  category: 'Red Teaming',
  // securityLevel removed - no longer part of the system model
  primaryZone: 'RedTeam',
  dataClassification: 'Confidential',
  customContext: `# Multi-Vector Red Team Attack Scenario

## Overview
This represents a sophisticated red team operation targeting a financial services organization. The scenario demonstrates multiple attack vectors, persistence mechanisms, and lateral movement techniques used in modern APT campaigns.

## Target Organization Profile
- **Industry**: Financial Services (Investment Banking)
- **Size**: 15,000 employees across 20 global offices
- **Annual Revenue**: $8.5 billion
- **Critical Assets**: Trading algorithms, M&A data, client portfolios
- **Security Maturity**: Level 3 (Defined processes, some automation)

## Red Team Objectives
1. **Primary**: Exfiltrate proprietary trading algorithms
2. **Secondary**: Establish persistent access to executive communications
3. **Tertiary**: Map internal network for future operations
4. **Constraints**: Remain undetected for 90+ days

## Attack Campaign Timeline
- **Week 1-2**: Initial reconnaissance and target identification
- **Week 3-4**: Phishing campaign and initial foothold
- **Week 5-8**: Lateral movement and privilege escalation
- **Week 9-12**: Data staging and exfiltration
- **Week 13+**: Maintain persistence and cover tracks

## Infrastructure Setup
- **Command & Control**: Multi-tier C2 with domain fronting
- **Payload Delivery**: Compromised legitimate websites
- **Data Exfiltration**: Encrypted channels via cloud services
- **Persistence**: Multiple mechanisms across different systems

## Attack Vectors Demonstrated
- **Social Engineering**: Spear phishing with industry-specific lures
- **Supply Chain**: Compromise of third-party vendor
- **Physical Access**: USB drop in parking garage
- **Insider Threat**: Recruitment of disgruntled employee
- **Zero-Day Exploitation**: Custom exploits for unpatched systems

## Defensive Gaps Exploited
- Email security filters allow certain file types
- Network segmentation incomplete between zones
- Privileged account management inconsistent
- Security monitoring has blind spots
- Incident response procedures not regularly tested

## Tools and Techniques
- **Initial Access**: Cobalt Strike, custom droppers
- **Persistence**: Scheduled tasks, WMI event subscriptions
- **Lateral Movement**: Pass-the-hash, Kerberoasting
- **Collection**: Mimikatz, custom data scrapers
- **Exfiltration**: DNS tunneling, HTTPS to cloud storage

## Operational Security
- All infrastructure uses stolen or fake identities
- Communication via encrypted channels
- Tool signatures regularly modified
- Operations conducted during business hours
- False flag indicators to misdirect attribution`,
  nodes: [
    // Security Zones
    // Internet: 3 nodes → 600px, x=50
    // External: 3 nodes → 600px, x=50+600+120=770
    // DMZ: 3 nodes → 600px, x=770+600+120=1490
    // Internal: 5 nodes → 800px, x=1490+600+120=2210
    // Trusted: 4 nodes → 700px, x=2210+800+120=3130
    // RedTeam: 4 nodes → 700px, below Internet x=50
    {
      id: 'internet-zone',
      type: 'securityZone',
      position: { x: 50, y: 50 },
      data: {
        label: 'Internet Zone',
        zoneType: 'Internet' as SecurityZone,
        description: 'Public internet and attacker infrastructure',
        zone: 'External' as SecurityZone
      },
      style: {
        width: 600,
        height: 1000,
        background: colors.zoneBackgrounds.Internet,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'external-zone',
      type: 'securityZone',
      position: { x: 770, y: 50 },
      data: {
        label: 'External Zone',
        zoneType: 'External' as SecurityZone,
        description: 'Target organization perimeter'
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
      position: { x: 1490, y: 50 },
      data: {
        label: 'DMZ Zone',
        zoneType: 'DMZ' as SecurityZone,
        description: 'Publicly accessible services'
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
      position: { x: 2210, y: 50 },
      data: {
        label: 'Internal Zone',
        zoneType: 'Internal' as SecurityZone,
        description: 'Corporate network'
      },
      style: {
        width: 800,
        height: 1000,
        background: colors.zoneBackgrounds.Internal,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'trusted-zone',
      type: 'securityZone',
      position: { x: 3130, y: 50 },
      data: {
        label: 'Trusted Zone',
        zoneType: 'Trusted' as SecurityZone,
        description: 'Critical systems and data'
      },
      style: {
        width: 700,
        height: 1000,
        background: colors.zoneBackgrounds.Trusted,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'redteam-zone',
      type: 'securityZone',
      position: { x: 50, y: 1170 },
      data: {
        label: 'Red Team Infrastructure',
        zoneType: 'RedTeam' as SecurityZone,
        description: 'Attacker-controlled infrastructure'
      },
      style: {
        width: 700,
        height: 1000,
        background: colors.zoneBackgrounds.RedTeam,
        zIndex: -1
      }
    } as SecurityNode,

    // Internet Zone Components (zone x=50, shift from old x=50: delta=0)
    {
      id: 'phishing-site',
      type: 'phishingServer',
      position: { x: 125, y: 175 },
      data: {
        label: 'Phishing Infrastructure',
        description: 'Cloned banking portal',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        protocols: ['HTTPS'],
        vendor: 'custom',
        product: 'phishing-kit',
        version: '2.0',
        additionalContext: 'Uses legitimate SSL certificate from free CA'
      }
    } as SecurityNode,
    {
      id: 'compromised-site',
      type: 'webServer',
      position: { x: 375, y: 325 },
      data: {
        label: 'Compromised Vendor Site',
        description: 'Legitimate vendor website hosting malware',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        protocols: ['HTTPS'],
        vendor: 'wordpress',
        product: 'cms',
        version: '5.8',
        additionalContext: 'Outdated plugins allow arbitrary file upload'
      }
    } as SecurityNode,
    {
      id: 'cloud-storage',
      type: 'cloudService',
      position: { x: 525, y: 925 },
      data: {
        label: 'Exfiltration Storage',
        description: 'Cloud storage for stolen data',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS'],
        vendor: 'aws',
        product: 's3',
        version: 'current',
        additionalContext: 'Bucket misconfigured with public read permissions'
      }
    } as SecurityNode,

    // Red Team Zone Components (zone x=50, shift from old x=50: delta=0)
    {
      id: 'c2-server',
      type: 'c2Server',
      position: { x: 925, y: 1575 },
      data: {
        label: 'Primary C2 Server',
        description: 'Command and control infrastructure',
        zone: 'RedTeam' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'DNS', 'HTTP/2'],
        vendor: 'cobaltstrike',
        product: 'teamserver',
        version: '4.7',
        additionalContext: 'Domain fronting via CDN to hide true destination'
      }
    } as SecurityNode,
    {
      id: 'payload-server',
      type: 'payloadServer',
      position: { x: 2025, y: 1725 },
      data: {
        label: 'Payload Distribution',
        description: 'Hosts malicious payloads',
        zone: 'RedTeam' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS'],
        vendor: 'custom',
        product: 'payload-server',
        version: '1.0',
        technology: 'nginx, Python'
      }
    } as SecurityNode,
    {
      id: 'recon-infra',
      type: 'attackBox',
      position: { x: 1575, y: 1475 },
      data: {
        label: 'Reconnaissance Infrastructure',
        description: 'OSINT and scanning tools',
        zone: 'RedTeam' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'SSH'],
        vendor: 'kali',
        product: 'linux',
        version: '2023.3'
      }
    } as SecurityNode,
    {
      id: 'credential-server',
      type: 'credentialHarvester',
      position: { x: 425, y: 1225 },
      data: {
        label: 'Credential Harvesting',
        description: 'Stores captured credentials',
        zone: 'RedTeam' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS'],
        vendor: 'custom',
        product: 'cred-collector',
        version: '3.1'
      }
    } as SecurityNode,

    // External Zone Components (zone x=770, shift from old x=820: delta=-50)
    {
      id: 'email-gateway',
      type: 'emailSecurity',
      position: { x: 825, y: 175 },
      data: {
        label: 'Email Security Gateway',
        description: 'Corporate email filtering',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['SMTP', 'TLS'],
        vendor: 'proofpoint',
        product: 'email-protection',
        version: '8.17',
        additionalContext: 'Allows .xls files with macros for business operations'
      }
    } as SecurityNode,
    {
      id: 'vpn-gateway',
      type: 'vpnGateway',
      position: { x: 1225, y: 775 },
      data: {
        label: 'VPN Gateway',
        description: 'Remote access VPN',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['IPSec', 'SSL-VPN'],
        vendor: 'fortinet',
        product: 'fortigate',
        version: '7.0.12',
        additionalContext: 'Some users have permanent VPN exceptions for convenience'
      }
    } as SecurityNode,
    {
      id: 'web-proxy',
      type: 'proxy',
      position: { x: 925, y: 475 },
      data: {
        label: 'Web Proxy',
        description: 'Internet access proxy',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTP', 'HTTPS'],
        vendor: 'squid',
        product: 'proxy',
        version: '5.2',
        additionalContext: 'SSL inspection disabled for banking sites'
      }
    } as SecurityNode,

    // DMZ Zone Components (zone x=1490, shift from old x=1590: delta=-100)
    {
      id: 'public-web',
      type: 'webServer',
      position: { x: 1525, y: 875 },
      data: {
        label: 'Corporate Website',
        description: 'Public-facing web presence',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        protocols: ['HTTPS'],
        vendor: 'apache',
        product: 'httpd',
        version: '2.4.54',
        additionalContext: 'Debug endpoints still enabled at /api/debug'
      }
    } as SecurityNode,
    {
      id: 'customer-portal',
      type: 'application',
      position: { x: 1825, y: 325 },
      data: {
        label: 'Customer Portal',
        description: 'Client trading interface',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'WSS'],
        vendor: 'custom',
        product: 'trading-portal',
        version: '5.2.1',
        additionalContext: 'Session tokens don\'t expire for 24 hours'
      }
    } as SecurityNode,
    {
      id: 'partner-api',
      type: 'api',
      position: { x: 1675, y: 475 },
      data: {
        label: 'Partner API Gateway',
        description: 'B2B integration endpoint',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'REST'],
        vendor: 'mulesoft',
        product: 'anypoint',
        version: '4.4',
        additionalContext: 'API keys transmitted in URL parameters'
      }
    } as SecurityNode,

    // Internal Zone Components (zone x=2210, shift from old x=2360: delta=-150)
    {
      id: 'employee-workstations',
      type: 'endpoint',
      position: { x: 2275, y: 175 },
      data: {
        label: 'Employee Workstations',
        description: 'Corporate desktops',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['RDP', 'SMB'],
        vendor: 'microsoft',
        product: 'windows',
        version: '11',
        additionalContext: 'Local admin rights granted to developers'
      }
    } as SecurityNode,
    {
      id: 'domain-controller',
      type: 'authServer',
      position: { x: 2625, y: 275 },
      data: {
        label: 'Domain Controller',
        description: 'Active Directory services',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['LDAP', 'Kerberos', 'SMB'],
        vendor: 'microsoft',
        product: 'windows-server',
        version: '2019',
        additionalContext: 'Service accounts with non-expiring passwords'
      }
    } as SecurityNode,
    {
      id: 'file-server',
      type: 'storage',
      position: { x: 2375, y: 475 },
      data: {
        label: 'Corporate File Server',
        description: 'Shared drives and documents',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['SMB', 'NFS'],
        vendor: 'microsoft',
        product: 'windows-server',
        version: '2019',
        additionalContext: 'Everyone group has read access to most shares'
      }
    } as SecurityNode,
    {
      id: 'implant-host',
      type: 'implant',
      position: { x: 2675, y: 625 },
      data: {
        label: 'Compromised Server',
        description: 'Server with persistent backdoor',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'RDP'],
        vendor: 'microsoft',
        product: 'windows-server',
        version: '2016',
        additionalContext: 'Scheduled task runs every hour for persistence'
      }
    } as SecurityNode,
    {
      id: 'lateral-pivot',
      type: 'pivotPoint',
      position: { x: 2275, y: 875 },
      data: {
        label: 'Lateral Movement Pivot',
        description: 'Compromised admin workstation',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['RDP', 'PowerShell Remoting'],
        vendor: 'microsoft',
        product: 'windows',
        version: '10',
        additionalContext: 'Cached domain admin credentials in memory'
      }
    } as SecurityNode,

    // Trusted Zone Components (zone x=3130, shift from old x=3130: delta=0)
    {
      id: 'trading-system',
      type: 'application',
      position: { x: 3225, y: 175 },
      data: {
        label: 'Trading Algorithm Server',
        description: 'Proprietary trading algorithms',
        zone: 'Trusted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['FIX', 'Custom TCP'],
        vendor: 'custom',
        product: 'algo-trader',
        version: '8.5',
        additionalContext: 'Debug logs contain algorithm parameters'
      }
    } as SecurityNode,
    {
      id: 'executive-data',
      type: 'database',
      position: { x: 3675, y: 275 },
      data: {
        label: 'Executive Database',
        description: 'M&A and strategic data',
        zone: 'Trusted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['TDS', 'TLS'],
        vendor: 'microsoft',
        product: 'sql-server',
        version: '2019',
        additionalContext: 'Backup files stored on network share'
      }
    } as SecurityNode,
    {
      id: 'exfil-staging',
      type: 'exfilChannel',
      position: { x: 3325, y: 475 },
      data: {
        label: 'Data Staging Server',
        description: 'Compromised server for data collection',
        zone: 'Trusted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'SMB'],
        vendor: 'redhat',
        product: 'rhel',
        version: '8.6',
        additionalContext: 'Outbound HTTPS not monitored from this zone'
      }
    } as SecurityNode,
    {
      id: 'persistence-mech',
      type: 'persistenceMechanism',
      position: { x: 3425, y: 625 },
      data: {
        label: 'Persistence Mechanism',
        description: 'Golden ticket attack infrastructure',
        zone: 'Trusted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['Kerberos'],
        vendor: 'custom',
        product: 'golden-ticket',
        version: 'n/a',
        additionalContext: 'KRBTGT password never changed since 2018'
      }
    } as SecurityNode
  ],
  edges: [
    // Initial Access
    {
      id: 'e1',
      source: 'phishing-site',
      target: 'email-gateway',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Phishing Email',
        protocol: 'SMTP',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        animated: true,
        zone: 'External' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e2',
      source: 'email-gateway',
      target: 'employee-workstations',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Delivered Payload',
        protocol: 'SMTP',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: true,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,

    // C2 Communications
    {
      id: 'e3',
      source: 'employee-workstations',
      target: 'web-proxy',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'C2 Beacon',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: true,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e4',
      source: 'web-proxy',
      target: 'c2-server',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Domain Fronting',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: true,
        zone: 'RedTeam' as SecurityZone
      }
    } as SecurityEdge,

    // Lateral Movement
    {
      id: 'e5',
      source: 'employee-workstations',
      target: 'file-server',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'SMB Access',
        protocol: 'SMB',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: true,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e6',
      source: 'file-server',
      target: 'domain-controller',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Credential Harvest',
        protocol: 'LDAP',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e7',
      source: 'domain-controller',
      target: 'lateral-pivot',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Pass-the-Hash',
        protocol: 'SMB',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,

    // Privilege Escalation
    {
      id: 'e8',
      source: 'lateral-pivot',
      target: 'implant-host',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'RDP Session',
        protocol: 'RDP',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: true,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e9',
      source: 'implant-host',
      target: 'trading-system',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Service Account',
        protocol: 'RPC',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true,
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,

    // Data Collection
    {
      id: 'e10',
      source: 'trading-system',
      target: 'exfil-staging',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Data Collection',
        protocol: 'SMB',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true,
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e11',
      source: 'executive-data',
      target: 'exfil-staging',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'DB Backup Copy',
        protocol: 'SMB',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true,
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,

    // Data Exfiltration - arc over the top to avoid crossing nodes
    {
      id: 'e12',
      source: 'exfil-staging',
      target: 'cloud-storage',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'top',
      data: {
        label: 'HTTPS Upload',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true,
        zone: 'Internet' as SecurityZone,
        controlPoints: [
          { id: 'cp-1771654387379', x: 3100, y: 1100, active: true },
          { id: 'e12-cp1', x: 750, y: 1100, active: true }
        ]
      }
    } as SecurityEdge,

    // Persistence
    {
      id: 'e13',
      source: 'domain-controller',
      target: 'persistence-mech',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Golden Ticket',
        protocol: 'Kerberos',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: false,
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e14',
      source: 'persistence-mech',
      target: 'c2-server',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'right',
      data: {
        label: 'Persistence Check',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: false,
        zone: 'RedTeam' as SecurityZone
      }
    } as SecurityEdge,

    // Additional Attack Paths
    {
      id: 'e15',
      source: 'compromised-site',
      target: 'customer-portal',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Watering Hole',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        animated: true,
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e16',
      source: 'customer-portal',
      target: 'partner-api',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'API Access',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: false,
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e17',
      source: 'vpn-gateway',
      target: 'domain-controller',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Stolen VPN Creds',
        protocol: 'IPSec',
        encryption: 'AES',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: true,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,

    // Reconnaissance - arc above to avoid crossing
    {
      id: 'e18',
      source: 'recon-infra',
      target: 'public-web',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Web Scanning',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        animated: false,
        zone: 'RedTeam' as SecurityZone,
        controlPoints: [
          { id: 'cp-1771654534984', x: 3450, y: 1900, active: true },
          { id: 'cp-1771654525734', x: 950, y: 1900, active: true }
        ]
      }
    } as SecurityEdge,
    {
      id: 'e19',
      source: 'recon-infra',
      target: 'partner-api',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'API Fuzzing',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        animated: false,
        zone: 'RedTeam' as SecurityZone,
        controlPoints: [{ id: 'cp-1771654407183', x: 1700, y: 1400, active: true }]
      }
    } as SecurityEdge,

    // Credential Harvesting
    {
      id: 'e20',
      source: 'phishing-site',
      target: 'credential-server',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Cred Forward',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true,
        zone: 'RedTeam' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e21',
      source: 'credential-server',
      target: 'c2-server',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Cred Sync',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: false,
        zone: 'RedTeam' as SecurityZone
      }
    } as SecurityEdge,

    // Payload Delivery
    {
      id: 'e22',
      source: 'c2-server',
      target: 'payload-server',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Payload Request',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: false,
        zone: 'RedTeam' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e23',
      source: 'payload-server',
      target: 'implant-host',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Stage 2 Payload',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true,
        zone: 'RedTeam' as SecurityZone,
        controlPoints: [{ id: 'e23-cp1', x: 2700, y: 1750, active: true }]
      }
    } as SecurityEdge
  ],
  attackPaths: [
    {
      id: 'ap-phishing-to-exfil',
      name: 'Spear Phishing → Lateral Movement → Trading Algorithm Exfiltration',
      strideCategory: 'Information Disclosure',
      riskLevel: 'Critical',
      description: 'An APT group sends a spear phishing email with a macro-enabled .xls attachment through the email gateway to employee workstations, establishes a foothold, moves laterally via SMB to the file server, harvests credentials from the domain controller, pivots through a compromised server to reach the trading algorithm server, stages the data, and exfiltrates via unmonitored HTTPS to cloud storage.',
      steps: [
        {
          order: 1,
          edgeId: 'e1',
          sourceNodeId: 'phishing-site',
          targetNodeId: 'email-gateway',
          technique: 'T1566: Phishing',
        },
        {
          order: 2,
          edgeId: 'e2',
          sourceNodeId: 'email-gateway',
          targetNodeId: 'employee-workstations',
          technique: 'T1204: User Execution',
        },
        {
          order: 3,
          edgeId: 'e5',
          sourceNodeId: 'employee-workstations',
          targetNodeId: 'file-server',
          technique: 'T1021: Remote Services',
        },
        {
          order: 4,
          edgeId: 'e6',
          sourceNodeId: 'file-server',
          targetNodeId: 'domain-controller',
          technique: 'T1558: Steal or Forge Kerberos Tickets',
        },
        {
          order: 5,
          edgeId: 'e9',
          sourceNodeId: 'implant-host',
          targetNodeId: 'trading-system',
          technique: 'T1078: Valid Accounts',
        },
        {
          order: 6,
          edgeId: 'e10',
          sourceNodeId: 'trading-system',
          targetNodeId: 'exfil-staging',
          technique: 'T1074: Data Staged',
        },
        {
          order: 7,
          edgeId: 'e12',
          sourceNodeId: 'exfil-staging',
          targetNodeId: 'cloud-storage',
          technique: 'T1041: Exfiltration Over C2 Channel',
        },
      ],
      mitreTechniques: ['T1566', 'T1204', 'T1021', 'T1558', 'T1078', 'T1074', 'T1041'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-golden-ticket-persistence',
      name: 'Domain Controller Compromise → Golden Ticket Persistence',
      strideCategory: 'Elevation of Privilege',
      riskLevel: 'Critical',
      description: 'After compromising the domain controller through Kerberoasting, the attacker forges golden tickets using the never-rotated KRBTGT hash (unchanged since 2018), establishing indefinite persistence. The golden ticket mechanism reports back to C2 infrastructure via encrypted channels.',
      steps: [
        {
          order: 1,
          edgeId: 'e7',
          sourceNodeId: 'domain-controller',
          targetNodeId: 'lateral-pivot',
          technique: 'T1550: Use Alternate Authentication Material',
        },
        {
          order: 2,
          edgeId: 'e13',
          sourceNodeId: 'domain-controller',
          targetNodeId: 'persistence-mech',
          technique: 'T1558.001: Golden Ticket',
        },
        {
          order: 3,
          edgeId: 'e14',
          sourceNodeId: 'persistence-mech',
          targetNodeId: 'c2-server',
          technique: 'T1071: Application Layer Protocol',
        },
      ],
      mitreTechniques: ['T1550', 'T1558.001', 'T1071'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-c2-domain-fronting',
      name: 'C2 Beacon via Domain Fronting Through Web Proxy',
      strideCategory: 'Tampering',
      riskLevel: 'High',
      description: 'Compromised employee workstations send C2 beacon traffic through the web proxy to the attacker C2 server using domain fronting via CDN. SSL inspection is disabled for banking sites, allowing the C2 traffic to pass undetected through the proxy.',
      steps: [
        {
          order: 1,
          edgeId: 'e3',
          sourceNodeId: 'employee-workstations',
          targetNodeId: 'web-proxy',
          technique: 'T1071.001: Web Protocols',
        },
        {
          order: 2,
          edgeId: 'e4',
          sourceNodeId: 'web-proxy',
          targetNodeId: 'c2-server',
          technique: 'T1090.004: Domain Fronting',
        },
        {
          order: 3,
          edgeId: 'e22',
          sourceNodeId: 'c2-server',
          targetNodeId: 'payload-server',
          technique: 'T1105: Ingress Tool Transfer',
        },
        {
          order: 4,
          edgeId: 'e23',
          sourceNodeId: 'payload-server',
          targetNodeId: 'implant-host',
          technique: 'T1059: Command and Scripting Interpreter',
        },
      ],
      mitreTechniques: ['T1071.001', 'T1090.004', 'T1105', 'T1059'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-vpn-to-executive-data',
      name: 'Stolen VPN Credentials → Executive Database Exfiltration',
      strideCategory: 'Information Disclosure',
      riskLevel: 'High',
      description: 'An attacker uses stolen VPN credentials (obtained via phishing and credential harvesting) to connect directly to the domain controller through the VPN gateway, bypassing perimeter controls. From there, the attacker accesses the executive database containing M&A data and stages it for exfiltration.',
      steps: [
        {
          order: 1,
          edgeId: 'e17',
          sourceNodeId: 'vpn-gateway',
          targetNodeId: 'domain-controller',
          technique: 'T1078: Valid Accounts',
        },
        {
          order: 2,
          edgeId: 'e7',
          sourceNodeId: 'domain-controller',
          targetNodeId: 'lateral-pivot',
          technique: 'T1550: Use Alternate Authentication Material',
        },
        {
          order: 3,
          edgeId: 'e11',
          sourceNodeId: 'executive-data',
          targetNodeId: 'exfil-staging',
          technique: 'T1005: Data from Local System',
        },
        {
          order: 4,
          edgeId: 'e12',
          sourceNodeId: 'exfil-staging',
          targetNodeId: 'cloud-storage',
          technique: 'T1048: Exfiltration Over Alternative Protocol',
        },
      ],
      mitreTechniques: ['T1078', 'T1550', 'T1005', 'T1048'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
  ],
  grcWorkspace: vulnerableRedTeamScenarioGrcWorkspace,
};
