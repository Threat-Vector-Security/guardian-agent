// vulnerableNetwork.ts
import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityZone, SecurityEdge, SecurityNode } from '../../types/SecurityTypes';
import { DiagramAttackPath, AssessmentThreatModelNodeSourceType, AssessmentThreatModelEdgeSourceType, AttackPathRiskLevel } from '../../types/GrcTypes';
import { colors } from '../../styles/Theme';
import { buildGrcWorkspace, score, NOW, OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID } from './grcSharedBase';
import { StrideCategory } from '../../types/ThreatIntelTypes';
const tierCatalogue = [
  { id: 'tier1-cyber', tier: 1 as const, label: 'Cyber Risk', description: 'Information security and cyber threats' },
  { id: 'tier1-operational', tier: 1 as const, label: 'Operational Risk', description: 'Business operations and process risks' },
  { id: 'tier2-network', tier: 2 as const, label: 'Network Security', parentId: 'tier1-cyber', description: 'Network perimeter and segmentation controls' },
  { id: 'tier2-identity', tier: 2 as const, label: 'Identity & Access', parentId: 'tier1-cyber', description: 'Authentication, authorization, and privilege management' },
  { id: 'tier2-data', tier: 2 as const, label: 'Data Protection', parentId: 'tier1-cyber', description: 'Data-at-rest and data-in-transit protection' },
  { id: 'tier2-endpoint', tier: 2 as const, label: 'Endpoint Security', parentId: 'tier1-cyber', description: 'Workstation and server hardening' },
  { id: 'tier2-monitoring', tier: 2 as const, label: 'Security Monitoring', parentId: 'tier1-operational', description: 'Logging, detection, and incident response' },
  { id: 'tier2-change', tier: 2 as const, label: 'Change Management', parentId: 'tier1-operational', description: 'Configuration management and deployment controls' },
  { id: 'tier3-zone-traversal', tier: 3 as const, label: 'Zone Traversal Weaknesses', parentId: 'tier2-network' },
  { id: 'tier3-vpn-bypass', tier: 3 as const, label: 'VPN & Remote Access Bypass', parentId: 'tier2-network' },
  { id: 'tier3-unencrypted-traffic', tier: 3 as const, label: 'Unencrypted Internal Traffic', parentId: 'tier2-network' },
  { id: 'tier3-shared-creds', tier: 3 as const, label: 'Shared Administrative Credentials', parentId: 'tier2-identity' },
  { id: 'tier3-nac-bypass', tier: 3 as const, label: 'NAC Bypass Rules', parentId: 'tier2-identity' },
  { id: 'tier3-backup-exposure', tier: 3 as const, label: 'Backup Data Exposure', parentId: 'tier2-data' },
  { id: 'tier3-pki-compromise', tier: 3 as const, label: 'PKI & Certificate Compromise', parentId: 'tier2-data' },
  { id: 'tier3-alert-fatigue', tier: 3 as const, label: 'Alert Fatigue & Threshold Gaps', parentId: 'tier2-monitoring' },
  { id: 'tier3-legacy-device-bypass', tier: 3 as const, label: 'Legacy Device Exceptions', parentId: 'tier2-endpoint' },
  { id: 'tier4-vlan-segmentation', tier: 4 as const, label: 'VLAN Segmentation Enforcement', parentId: 'tier3-zone-traversal' },
  { id: 'tier4-ssl-inspection', tier: 4 as const, label: 'SSL Inspection Performance', parentId: 'tier3-unencrypted-traffic' },
  { id: 'tier4-cred-rotation', tier: 4 as const, label: 'Credential Rotation Policy', parentId: 'tier3-shared-creds' },
  { id: 'tier4-immutable-backups', tier: 4 as const, label: 'Immutable Backup Verification', parentId: 'tier3-backup-exposure' },
];

const assets = [
  {
    id: 'asset-edge-firewall', name: 'Fortinet FortiGate 600E', type: 'network_device', owner: 'Network Security',
    domain: 'it' as const, category: 'Network Infrastructure',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Next-generation perimeter firewall with IPS, application control, and SSL inspection',
    criticality: { confidentiality: 3, integrity: 5, availability: 5, financial: 5, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-network', nodeId: 'edge-firewall', nodeLabel: 'Next-Gen Firewall', nodeType: 'firewall' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-internal-firewall', name: 'Palo Alto PA-3220', type: 'network_device', owner: 'Network Security',
    domain: 'it' as const, category: 'Network Infrastructure',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Internal segmentation firewall providing micro-segmentation between internal and restricted zones',
    criticality: { confidentiality: 4, integrity: 5, availability: 5, financial: 4, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-network', nodeId: 'internal-firewall', nodeLabel: 'Internal Segmentation Firewall', nodeType: 'firewall' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-database-server', name: 'SQL Server 2022 Always On Cluster', type: 'database', owner: 'Database Administration',
    domain: 'application' as const, category: 'Database',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Enterprise database cluster with Always Encrypted, TDE, and dynamic data masking',
    criticality: { confidentiality: 5, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-network', nodeId: 'database-server', nodeLabel: 'Enterprise Database Cluster', nodeType: 'database' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-domain-controller', name: 'Active Directory Domain Controller', type: 'identity_provider', owner: 'Identity & Access Management',
    domain: 'it' as const, category: 'Identity Infrastructure',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Windows Server 2022 domain controller with LDAP, Kerberos, and certificate services',
    criticality: { confidentiality: 5, integrity: 5, availability: 5, financial: 4, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-network', nodeId: 'domain-controller', nodeLabel: 'Active Directory Domain Controller', nodeType: 'authServer' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-siem-server', name: 'Splunk Enterprise Security', type: 'security_tool', owner: 'Security Operations',
    domain: 'it' as const, category: 'Security Tools',
    businessCriticality: 4, securityCriticality: 4,
    description: 'SIEM platform with log correlation, UEBA, and SOAR integration',
    criticality: { confidentiality: 3, integrity: 4, availability: 4, financial: 3, reputation: 3, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-network', nodeId: 'siem-server', nodeLabel: 'SIEM Platform', nodeType: 'monitor' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-crypto-server', name: 'Microsoft AD Certificate Services', type: 'security_control', owner: 'Security Architecture',
    domain: 'it' as const, category: 'PKI Infrastructure',
    businessCriticality: 4, securityCriticality: 5,
    description: 'Enterprise PKI with HSM-protected root CA, certificate templates, and OCSP responders',
    criticality: { confidentiality: 5, integrity: 5, availability: 3, financial: 4, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-network', nodeId: 'crypto-server', nodeLabel: 'Certificate Authority', nodeType: 'service' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-backup-server', name: 'Veeam Backup & Replication', type: 'backup_system', owner: 'IT Operations',
    domain: 'it' as const, category: 'Data Protection',
    businessCriticality: 4, securityCriticality: 4,
    description: 'Enterprise backup system with immutable storage and air-gap protection',
    criticality: { confidentiality: 4, integrity: 5, availability: 4, financial: 4, reputation: 3, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-network', nodeId: 'backup-server', nodeLabel: 'Enterprise Backup System', nodeType: 'storage' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-web-server', name: 'Nginx Web Server Cluster', type: 'web_server', owner: 'Platform Engineering',
    domain: 'application' as const, category: 'Web Application',
    businessCriticality: 5, securityCriticality: 4,
    description: 'Nginx reverse proxy cluster serving public web traffic in the DMZ',
    criticality: { confidentiality: 3, integrity: 4, availability: 5, financial: 4, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-network', nodeId: 'web-server-1', nodeLabel: 'Web Server Cluster', nodeType: 'webServer' }],
    createdAt: NOW, updatedAt: NOW
  },
];

const risks = [
  {
    id: 'risk-lb-unencrypted-backend', title: 'Unencrypted Load Balancer to Web Server Traffic',
    description: 'The load balancer forwards HTTP traffic to web servers on port 8080 without TLS re-encryption, exposing session tokens and credentials on the internal DMZ network.',
    status: 'assessed' as const, owner: 'Platform Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Network Security', tier3: 'Unencrypted Internal Traffic' },
    assetIds: ['asset-web-server'],
    diagramLinks: [{ diagramId: 'vulnerable-network', nodeIds: ['load-balancer', 'web-server-1'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Enable TLS between load balancer and backend web servers; configure end-to-end encryption',
    threatActorIds: ['threat-actor-organised-crime'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-ddos-shared-creds', title: 'DDoS Appliance Shared Administrator Credentials',
    description: 'The DDoS protection appliance management interface uses shared administrator credentials for emergency access, violating individual accountability.',
    status: 'draft' as const, owner: 'Network Security',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Identity & Access', tier3: 'Shared Administrative Credentials' },
    assetIds: ['asset-edge-firewall'],
    diagramLinks: [{ diagramId: 'vulnerable-network', nodeIds: ['ddos-protection'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Implement individual admin accounts with MFA for DDoS appliance management',
    threatActorIds: ['threat-actor-insider'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-nac-bypass-legacy', title: 'NAC Bypass Rules for Legacy Devices',
    description: 'Network access control (802.1X) has bypass rules configured for printers, IoT devices, and legacy equipment, allowing unauthenticated devices on the corporate network.',
    status: 'assessed' as const, owner: 'Network Security',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Identity & Access', tier3: 'NAC Bypass Rules' },
    assetIds: ['asset-internal-firewall'],
    diagramLinks: [{ diagramId: 'vulnerable-network', nodeIds: ['core-switch', 'workstation-1'] }],
    inherentScore: score('likelihood-4', 'impact-3'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Segment legacy devices onto isolated VLANs; implement MAC-based authentication as compensating control',
    threatActorIds: ['threat-actor-opportunistic'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-ssl-inspection-perf', title: 'SSL Inspection Reducing Firewall Throughput',
    description: 'SSL inspection on the perimeter firewall reduces throughput by 30%, leading to performance exceptions that bypass deep packet inspection for certain traffic categories.',
    status: 'assessed' as const, owner: 'Network Security',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Network Security', tier3: 'Unencrypted Internal Traffic' },
    assetIds: ['asset-edge-firewall'],
    diagramLinks: [{ diagramId: 'vulnerable-network', nodeIds: ['edge-firewall'] }],
    inherentScore: score('likelihood-3', 'impact-3'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Upgrade firewall appliance to handle SSL inspection at line speed; review and minimize bypass exceptions',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-inter-vlan-routing', title: 'Broad Inter-VLAN Routing for Application Compatibility',
    description: 'Network segmentation uses VLANs and firewalls but inter-VLAN routing allows broad access for application compatibility, weakening east-west traffic controls.',
    status: 'draft' as const, owner: 'Network Architecture',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Network Security', tier3: 'Zone Traversal Weaknesses' },
    assetIds: ['asset-internal-firewall', 'asset-database-server'],
    diagramLinks: [{ diagramId: 'vulnerable-network', nodeIds: ['internal-firewall', 'core-switch', 'database-server'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Implement zero-trust micro-segmentation with Palo Alto App-ID policies; audit and restrict inter-VLAN routing rules',
    threatActorIds: ['threat-actor-nation-state'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-siem-alert-fatigue', title: 'SIEM Alert Fatigue and Conservative Thresholds',
    description: 'Security event alerting thresholds are set conservatively to avoid alert fatigue, potentially missing sophisticated attack patterns that fall below detection thresholds.',
    status: 'treated' as const, owner: 'Security Operations',
    tierPath: { tier1: 'Operational Risk', tier2: 'Security Monitoring', tier3: 'Alert Fatigue & Threshold Gaps' },
    assetIds: ['asset-siem-server'],
    diagramLinks: [{ diagramId: 'vulnerable-network', nodeIds: ['siem-server', 'ids-sensor'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Deploy UEBA with machine-learning baselines; implement tiered alerting with SOC escalation procedures',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-vpn-shared-group-creds', title: 'VPN Shared Group Credentials for Contractors',
    description: 'SSL VPN provides contractor access using shared group credentials, preventing individual accountability and increasing risk of credential leakage.',
    status: 'draft' as const, owner: 'Identity & Access Management',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Identity & Access', tier3: 'Shared Administrative Credentials' },
    assetIds: ['asset-edge-firewall', 'asset-domain-controller'],
    diagramLinks: [{ diagramId: 'vulnerable-network', nodeIds: ['edge-firewall', 'domain-controller'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Issue individual contractor certificates; integrate VPN with Azure AD for identity-based access',
    threatActorIds: ['threat-actor-organised-crime'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-guest-iot-vlan-shared', title: 'Guest Network Shares VLAN with Employee IoT Devices',
    description: 'The wireless guest network shares a VLAN with employee IoT devices, creating a lateral movement path from untrusted guest traffic to corporate IoT infrastructure.',
    status: 'assessed' as const, owner: 'Network Architecture',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Network Security', tier3: 'Zone Traversal Weaknesses' },
    assetIds: ['asset-internal-firewall'],
    diagramLinks: [{ diagramId: 'vulnerable-network', nodeIds: ['core-switch'] }],
    inherentScore: score('likelihood-3', 'impact-3'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Separate guest and IoT VLANs; implement micro-segmentation for IoT device classes',
    threatActorIds: ['threat-actor-opportunistic'],
    createdAt: NOW, updatedAt: NOW
  },
];

const assessments = [
  {
    id: 'assessment-network-security-review', title: 'Enterprise Network Security Posture Assessment',
    status: 'in_review' as const,
    owner: 'Network Security',
    reviewer: 'CISO',
    startDate: '2025-05-01',
    dueDate: '2025-06-30',
    threatActorIds: ['threat-actor-nation-state', 'threat-actor-organised-crime', 'threat-actor-insider'],
    methodologyNote: 'Assessment follows NIST SP 800-53 controls framework with CIS Controls v8 benchmarks for network device hardening.',
    assumptionNote: 'Assessment covers production enterprise network as of May 2025. DR/recovery and quarantine zones assessed at reduced scope.',
    scopeItems: [
      { id: 'scope-system-network', type: 'system' as const, value: 'system', name: 'Enterprise Network' },
      { id: 'scope-zone-dmz', type: 'diagram_segment' as const, value: 'DMZ', name: 'DMZ Zone' },
      { id: 'scope-zone-internal', type: 'diagram_segment' as const, value: 'Internal', name: 'Internal Zone' },
      { id: 'scope-zone-restricted', type: 'diagram_segment' as const, value: 'Restricted', name: 'Restricted Zone' },
    ],
    tierFilter: { tier1: 'Cyber Risk' },
    riskManagementPlan: {
      objective: 'Reduce lateral movement risk and strengthen zone boundary enforcement across the enterprise network.',
      strategy: 'Prioritize segmentation hardening and credential hygiene, then address monitoring gaps and performance-driven security exceptions.',
      residualRiskStatement: 'Residual risk accepted only where compensating controls are documented and monitored.',
      monitoringApproach: 'Bi-weekly review of open plan actions; monthly SIEM correlation rule effectiveness assessment.',
      communicationPlan: 'Report progress to Network Security Steering Committee bi-weekly.',
      reviewCadenceDays: 30,
      actions: [
        {
          id: 'rmp-action-tls-backend',
          title: 'Enable TLS re-encryption between load balancer and web servers',
          owner: 'Platform Engineering',
          dueDate: '2025-06-15',
          status: 'in_progress' as const,
          linkedRiskIds: ['risk-lb-unencrypted-backend'],
          notes: 'Certificates generated; testing on staging cluster'
        },
        {
          id: 'rmp-action-nac-isolation',
          title: 'Isolate legacy devices on dedicated VLANs with NAC enforcement',
          owner: 'Network Security',
          dueDate: '2025-06-30',
          status: 'planned' as const,
          linkedRiskIds: ['risk-nac-bypass-legacy', 'risk-guest-iot-vlan-shared'],
          notes: ''
        },
        {
          id: 'rmp-action-vpn-individual',
          title: 'Replace shared VPN group credentials with individual contractor certificates',
          owner: 'Identity & Access Management',
          dueDate: '2025-07-15',
          status: 'planned' as const,
          linkedRiskIds: ['risk-vpn-shared-group-creds'],
          notes: 'Azure AD integration design in progress'
        },
        {
          id: 'rmp-action-segmentation-audit',
          title: 'Audit and restrict inter-VLAN routing rules with App-ID policies',
          owner: 'Network Architecture',
          dueDate: '2025-07-31',
          status: 'planned' as const,
          linkedRiskIds: ['risk-inter-vlan-routing'],
          notes: ''
        },
      ],
      updatedAt: NOW
    },
    riskIds: risks.map(r => r.id),
    soaGapIds: ['soa-net-a01', 'soa-net-a02', 'soa-net-a05'],
    taskIds: ['task-segment-audit', 'task-evidence-cis04', 'task-vpn-remediation'],
    linkedImplementedControlIds: [],
    linkedInitiativeIds: [],
    summary: 'Comprehensive security assessment of the multi-zone enterprise network architecture. Identified 8 risks across network segmentation, credential management, and monitoring domains.',
    findings: 'Key findings include unencrypted backend traffic, shared credentials on critical appliances, NAC bypass exceptions, and inter-VLAN routing weaknesses.',
    recommendations: 'Prioritize TLS re-encryption for all internal traffic, implement individual authentication for all administrative and contractor access, and harden inter-VLAN routing with zero-trust policies.',
    evidenceSummary: 'Evidence includes firewall rule exports, SIEM configuration snapshots, NAC policy documentation, and network topology diagrams.',
    threatModel: {
      nodes: [
        { id: 'tm-node-gateway', label: 'Internet Gateway', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'internet-gateway', position: { x: 50, y: 150 }, nodeType: 'router' },
        { id: 'tm-node-ddos', label: 'DDoS Protection', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'ddos-protection', position: { x: 200, y: 150 }, nodeType: 'firewall', commentary: 'Shared admin credentials for emergency access' },
        { id: 'tm-node-edge-fw', label: 'Edge Firewall', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'edge-firewall', position: { x: 350, y: 150 }, nodeType: 'firewall', commentary: 'SSL inspection reduces throughput by 30%' },
        { id: 'tm-node-waf', label: 'WAF', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'waf', position: { x: 350, y: 300 }, nodeType: 'firewall' },
        { id: 'tm-node-lb', label: 'Load Balancer', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'load-balancer', position: { x: 500, y: 300 }, nodeType: 'loadBalancer' },
        { id: 'tm-node-web', label: 'Web Server Cluster', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'web-server-1', position: { x: 650, y: 300 }, nodeType: 'webServer', commentary: 'Receives unencrypted HTTP on port 8080 from load balancer' },
        { id: 'tm-node-int-fw', label: 'Internal Firewall', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'internal-firewall', position: { x: 800, y: 150 }, nodeType: 'firewall', commentary: 'App-ID in learning mode for new applications' },
        { id: 'tm-node-db', label: 'Database Cluster', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'database-server', position: { x: 950, y: 150 }, nodeType: 'database' },
      ],
      edges: [
        { id: 'tm-edge-gateway-ddos', source: 'tm-node-gateway', target: 'tm-node-ddos', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'internet-to-ddos', label: 'Internet Traffic' },
        { id: 'tm-edge-ddos-fw', source: 'tm-node-ddos', target: 'tm-node-edge-fw', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'ddos-to-firewall', label: 'Filtered Traffic' },
        { id: 'tm-edge-fw-waf', source: 'tm-node-edge-fw', target: 'tm-node-waf', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'firewall-to-waf', label: 'Web Traffic' },
        { id: 'tm-edge-waf-lb', source: 'tm-node-waf', target: 'tm-node-lb', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'waf-to-loadbalancer', label: 'Protected Requests' },
        { id: 'tm-edge-lb-web', source: 'tm-node-lb', target: 'tm-node-web', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'loadbalancer-to-webserver', label: 'HTTP (unencrypted)', commentary: 'SSL terminated at load balancer; no re-encryption to backend' },
        { id: 'tm-edge-web-intfw', source: 'tm-node-web', target: 'tm-node-int-fw', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'webserver-to-internal-fw', label: 'Backend API Calls' },
        { id: 'tm-edge-intfw-db', source: 'tm-node-int-fw', target: 'tm-node-db', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'internal-fw-to-database', label: 'Database Access' },
      ],
      attackPathDescription: 'Primary attack paths traverse the DMZ to Internal zone boundary: (1) perimeter to database via unencrypted backend hops, and (2) lateral movement through broad inter-VLAN routing once an internal foothold is established.',
      attackPaths: [
        {
          id: 'aap-perimeter-to-db',
          name: 'Perimeter Traversal → Database Compromise via Unencrypted Backend',
          strideCategory: 'Information Disclosure' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'An attacker who compromises the DMZ web tier can intercept unencrypted HTTP traffic between load balancer and web servers, then pivot through the internal firewall to reach the database cluster.',
          diagramAttackPathId: 'ap-perimeter-to-database',
          steps: [
            { order: 1, edgeId: 'waf-to-loadbalancer', sourceNodeId: 'waf', targetNodeId: 'load-balancer', technique: 'T1190: Exploit Public-Facing Application' },
            { order: 2, edgeId: 'loadbalancer-to-webserver', sourceNodeId: 'load-balancer', targetNodeId: 'web-server-1', technique: 'T1040: Network Sniffing (unencrypted backend)' },
            { order: 3, edgeId: 'webserver-to-internal-fw', sourceNodeId: 'web-server-1', targetNodeId: 'internal-firewall', technique: 'T1021: Remote Services' },
            { order: 4, edgeId: 'internal-fw-to-database', sourceNodeId: 'internal-firewall', targetNodeId: 'database-server', technique: 'T1005: Data from Local System' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
        {
          id: 'aap-lateral-via-vlan',
          name: 'Internal Lateral Movement via Broad Inter-VLAN Routing',
          strideCategory: 'Elevation of Privilege' as StrideCategory,
          riskLevel: 'High' as AttackPathRiskLevel,
          description: 'An attacker who compromises an employee workstation leverages broad inter-VLAN routing to traverse the core switch and reach the domain controller, escalating to domain admin privileges.',
          diagramAttackPathId: 'ap-lateral-via-vlan',
          steps: [
            { order: 1, edgeId: 'switch-to-workstation', sourceNodeId: 'core-switch', targetNodeId: 'workstation-1', technique: 'T1078: Valid Accounts' },
            { order: 2, edgeId: 'switch-to-dc', sourceNodeId: 'core-switch', targetNodeId: 'domain-controller', technique: 'T1558: Steal or Forge Kerberos Tickets' },
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
    id: 'soa-net-a01', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A01', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Network access control deployed with 802.1X but bypass rules exist for legacy devices and printers. VPN uses shared group credentials for contractors.',
    mitigatesRiskIds: ['risk-nac-bypass-legacy', 'risk-vpn-shared-group-creds'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-net-a02', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A02', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Load balancer to web server traffic is unencrypted HTTP. SSL inspection exceptions reduce visibility into encrypted traffic streams.',
    mitigatesRiskIds: ['risk-lb-unencrypted-backend', 'risk-ssl-inspection-perf'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-net-a04', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A04', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'planned' as const,
    justification: 'Architecture review planned to address inter-VLAN routing weaknesses and guest/IoT VLAN sharing. Zero-trust design in evaluation.',
    mitigatesRiskIds: ['risk-inter-vlan-routing', 'risk-guest-iot-vlan-shared'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-net-a05', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A05', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'DDoS appliance uses shared admin credentials. Firewall remote management on non-standard port but SSL inspection performance exceptions weaken security posture.',
    mitigatesRiskIds: ['risk-ddos-shared-creds', 'risk-ssl-inspection-perf'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-net-a07', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A07', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Azure AD MFA deployed for cloud authentication. On-premises VPN and DDoS appliance still use shared credentials.',
    mitigatesRiskIds: ['risk-ddos-shared-creds', 'risk-vpn-shared-group-creds'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-net-a09', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A09', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'implemented' as const,
    justification: 'Splunk SIEM deployed with 2-year retention. IDS/IPS sensor with signature and anomaly detection. Alert thresholds set conservatively, creating monitoring gaps.',
    mitigatesRiskIds: ['risk-siem-alert-fatigue'],
    diagramRefs: [],
    evidence: [
      {
        id: 'evidence-net-siem-config',
        kind: 'link' as const,
        name: 'SIEM configuration and correlation rules baseline',
        url: 'https://security.example.local/docs/siem-config-baseline',
        note: 'Monthly rule effectiveness review',
        createdAt: NOW
      }
    ],
    updatedAt: NOW
  },
  {
    id: 'soa-net-cis-03', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.03', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Database encryption at rest via TDE. MACsec on switch uplinks. Backend web traffic still unencrypted.',
    mitigatesRiskIds: ['risk-lb-unencrypted-backend'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-net-cis-04', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.04', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Network device hardening incomplete: shared credentials on DDoS appliance, SSL inspection exceptions, and NAC bypass rules for legacy devices.',
    mitigatesRiskIds: ['risk-ddos-shared-creds', 'risk-nac-bypass-legacy', 'risk-ssl-inspection-perf'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-net-cis-06', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.06', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Palo Alto User-ID provides identity-based access control internally. Contractor VPN and DDoS management access lack individual accountability.',
    mitigatesRiskIds: ['risk-vpn-shared-group-creds', 'risk-ddos-shared-creds'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-net-cis-08', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.08', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'implemented' as const,
    justification: 'Centralized log collection from 150+ sources with 2-year retention. Syslog TLS enabled for firewall and IDS feeds. Alert threshold tuning ongoing.',
    mitigatesRiskIds: ['risk-siem-alert-fatigue'],
    diagramRefs: [],
    evidence: [
      { id: 'evidence-cis08-retention', kind: 'link' as const, name: 'Log retention policy and SIEM configuration',
        url: 'https://security.example.local/docs/log-retention-policy', note: 'Annual compliance review', createdAt: NOW }
    ],
    updatedAt: NOW
  },
];

const workflowTasks = [
  {
    id: 'task-segment-audit',
    title: 'Audit inter-VLAN routing rules and implement micro-segmentation',
    description: 'Review all inter-VLAN ACLs and implement zero-trust App-ID policies on internal firewall.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'critical' as const,
    owner: 'Network Architecture',
    dueDate: '2025-07-31',
    riskId: 'risk-inter-vlan-routing',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'task-evidence-cis04',
    title: 'Collect hardening evidence for CIS.04 Secure Configuration',
    description: 'Export firewall configurations, NAC policies, and DDoS appliance settings for compliance evidence.',
    type: 'evidence' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Network Security',
    dueDate: '2025-06-30',
    controlSetId: CIS_CONTROL_SET_ID,
    controlId: 'CIS.04',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'task-vpn-remediation',
    title: 'Replace shared VPN credentials with individual certificates',
    description: 'Integrate SSL VPN with Azure AD for contractor access; issue per-user certificates.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Identity & Access Management',
    dueDate: '2025-07-15',
    riskId: 'risk-vpn-shared-group-creds',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'task-tls-backend-rollout',
    title: 'Enable end-to-end TLS for load balancer to web server traffic',
    description: 'Configure TLS re-encryption on F5 BIG-IP LTM with server-side certificates for Nginx backends.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'critical' as const,
    owner: 'Platform Engineering',
    dueDate: '2025-06-15',
    riskId: 'risk-lb-unencrypted-backend',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'task-siem-threshold-tuning',
    title: 'Review and tune SIEM alert thresholds with UEBA baselines',
    description: 'Implement tiered alerting with machine-learning anomaly detection to reduce false positives while catching sophisticated attacks.',
    type: 'review' as const,
    status: 'done' as const,
    priority: 'medium' as const,
    owner: 'Security Operations',
    dueDate: '2025-05-31',
    riskId: 'risk-siem-alert-fatigue',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'task-nac-legacy-isolation',
    title: 'Segment legacy devices onto isolated VLANs',
    description: 'Create dedicated VLANs for printers and IoT devices; enforce MAC-based authentication as compensating control.',
    type: 'control_implementation' as const,
    status: 'blocked' as const,
    priority: 'medium' as const,
    owner: 'Network Security',
    dueDate: '2025-06-30',
    riskId: 'risk-nac-bypass-legacy',
    createdAt: NOW, updatedAt: NOW
  },
];

const governanceDocuments = [
  {
    id: 'gov-network-security-policy',
    title: 'Network Security Policy',
    type: 'policy' as const,
    description: 'Corporate network security policy defining segmentation requirements, access control standards, and monitoring obligations.',
    owner: 'CISO',
    status: 'active' as const,
    version: '2.3',
    url: 'https://sharepoint.example.com/policies/network-security-policy-v2.3.pdf',
    reviewDate: '2025-01-15',
    nextReviewDate: '2026-01-15',
    tags: ['network', 'security', 'segmentation'],
    linkedRiskIds: ['risk-inter-vlan-routing', 'risk-nac-bypass-legacy'],
    linkedControlSetIds: [CIS_CONTROL_SET_ID],
    linkedAssessmentIds: ['assessment-network-security-review'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'gov-remote-access-procedure',
    title: 'Remote Access and VPN Procedure',
    type: 'procedure' as const,
    description: 'Procedures for granting, managing, and revoking VPN and remote access for employees and contractors.',
    owner: 'Identity & Access Management',
    status: 'under_review' as const,
    version: '1.5',
    url: 'https://sharepoint.example.com/procedures/remote-access-vpn-v1.5.pdf',
    reviewDate: '2024-11-01',
    nextReviewDate: '2025-05-01',
    tags: ['vpn', 'remote-access', 'contractor'],
    linkedRiskIds: ['risk-vpn-shared-group-creds'],
    linkedControlSetIds: [OWASP_CONTROL_SET_ID],
    linkedAssessmentIds: [],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'gov-incident-response-plan',
    title: 'Network Incident Response Plan',
    type: 'procedure' as const,
    description: 'Step-by-step procedures for detecting, containing, and recovering from network security incidents including lateral movement and data exfiltration.',
    owner: 'Security Operations',
    status: 'active' as const,
    version: '3.0',
    url: 'https://sharepoint.example.com/procedures/network-ir-plan-v3.0.pdf',
    reviewDate: '2025-03-01',
    nextReviewDate: '2025-09-01',
    tags: ['incident', 'response', 'network'],
    linkedRiskIds: ['risk-siem-alert-fatigue', 'risk-inter-vlan-routing'],
    linkedControlSetIds: [],
    linkedAssessmentIds: ['assessment-network-security-review'],
    createdAt: NOW, updatedAt: NOW
  },
];

const threatActors = [
  {
    id: 'threat-actor-nation-state', name: 'APT-41 (State-Sponsored)',
    type: 'nation_state' as const, capabilityLevel: 5,
    resourceLevel: 'very_high' as const,
    motivation: 'Espionage-driven access to corporate intellectual property and sensitive business communications via persistent network presence.',
    description: 'Advanced persistent threat group with sophisticated capabilities targeting enterprise networks. Leverages zero-days, lateral movement, and living-off-the-land techniques to maintain long-term access.',
    targetedAssetIds: ['asset-domain-controller', 'asset-database-server', 'asset-crypto-server'],
    tags: ['espionage', 'apt', 'persistent', 'zero-day'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'threat-actor-organised-crime', name: 'Ransomware-as-a-Service Affiliate',
    type: 'organised_crime' as const, capabilityLevel: 4,
    resourceLevel: 'high' as const,
    motivation: 'Financial extortion through ransomware deployment targeting enterprise backup and database infrastructure.',
    description: 'Affiliate of major RaaS operation specialising in enterprise network compromise. Exploits VPN credentials and lateral movement to encrypt critical infrastructure before demanding ransom.',
    targetedAssetIds: ['asset-database-server', 'asset-backup-server', 'asset-edge-firewall'],
    tags: ['ransomware', 'financially-motivated', 'encryption'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'threat-actor-insider', name: 'Malicious Network Administrator',
    type: 'insider' as const, capabilityLevel: 4,
    resourceLevel: 'moderate' as const,
    motivation: 'Financial incentive or grievance-driven abuse of privileged network access to exfiltrate data or disrupt operations.',
    description: 'Current or former IT staff member with deep knowledge of network architecture, firewall rules, and shared administrative credentials. Can bypass monitoring through knowledge of SIEM alert thresholds.',
    targetedAssetIds: ['asset-siem-server', 'asset-domain-controller', 'asset-database-server', 'asset-edge-firewall'],
    tags: ['insider-threat', 'privileged-access', 'network-knowledge'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'threat-actor-opportunistic', name: 'Automated Scanners & Botnet Operators',
    type: 'opportunistic' as const, capabilityLevel: 1,
    resourceLevel: 'very_low' as const,
    motivation: 'Low-effort exploitation of misconfigured network services for botnet recruitment or cryptocurrency mining.',
    description: 'Automated internet scanners targeting misconfigured firewalls, open management interfaces, and weak VPN credentials.',
    targetedAssetIds: ['asset-edge-firewall', 'asset-web-server'],
    tags: ['automated', 'mass-scanning', 'low-skill'],
    createdAt: NOW, updatedAt: NOW
  },
];

const threatScenarios = [
  {
    id: 'scenario-ransomware-lateral', title: 'Ransomware Deployment via VPN Credential Theft and Lateral Movement',
    description: 'Organised crime affiliate obtains shared VPN group credentials through credential stuffing or social engineering, gains initial access to the internal network, pivots through broad inter-VLAN routing to reach the domain controller, escalates to domain admin, then deploys ransomware across database and backup infrastructure.',
    threatActorId: 'threat-actor-organised-crime',
    targetedAssetIds: ['asset-edge-firewall', 'asset-domain-controller', 'asset-database-server', 'asset-backup-server'],
    attackTechniques: ['T1133 - External Remote Services', 'T1078 - Valid Accounts', 'T1021 - Remote Services', 'T1558 - Steal or Forge Kerberos Tickets', 'T1486 - Data Encrypted for Impact'],
    linkedRiskIds: ['risk-vpn-shared-group-creds', 'risk-inter-vlan-routing'],
    likelihood: 'High — shared VPN credentials are easily phished or brute-forced; broad VLAN routing enables rapid lateral movement.',
    impact: 'Critical — ransomware encryption of database and backup systems causes extended business outage and potential data loss.',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scenario-apt-pki-compromise', title: 'APT Network Persistence via Certificate Authority Compromise',
    description: 'Nation-state actor establishes persistent access by compromising the internal PKI. After gaining initial foothold through NAC bypass on a rogue device, attacker pivots to the domain controller and then to the certificate authority to forge authentication certificates for long-term stealth access.',
    threatActorId: 'threat-actor-nation-state',
    targetedAssetIds: ['asset-domain-controller', 'asset-crypto-server', 'asset-internal-firewall'],
    attackTechniques: ['T1556 - Modify Authentication Process', 'T1649 - Steal or Forge Authentication Certificates', 'T1558 - Steal or Forge Kerberos Tickets', 'T1550 - Use Alternate Authentication Material'],
    linkedRiskIds: ['risk-nac-bypass-legacy', 'risk-inter-vlan-routing'],
    likelihood: 'Moderate — requires sophisticated attacker but NAC bypass and broad routing significantly reduce barriers.',
    impact: 'Critical — PKI compromise grants long-term stealth access to all certificate-protected systems and services.',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scenario-insider-data-exfil', title: 'Insider Data Exfiltration via SIEM Threshold Evasion',
    description: 'A malicious network administrator with knowledge of SIEM alert thresholds exfiltrates sensitive database records by staying below detection thresholds, using legitimate administrative access and encrypted channels to avoid triggering alerts.',
    threatActorId: 'threat-actor-insider',
    targetedAssetIds: ['asset-siem-server', 'asset-database-server'],
    attackTechniques: ['T1078 - Valid Accounts', 'T1005 - Data from Local System', 'T1048 - Exfiltration Over Alternative Protocol', 'T1070 - Indicator Removal'],
    linkedRiskIds: ['risk-siem-alert-fatigue', 'risk-ddos-shared-creds'],
    likelihood: 'Moderate — requires insider knowledge but shared credentials and high alert thresholds reduce detection probability.',
    impact: 'Major — gradual exfiltration of sensitive data may go undetected for extended periods.',
    createdAt: NOW, updatedAt: NOW
  },
];

export const vulnerableNetworkGrcWorkspace = buildGrcWorkspace({
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
      id: 'vn-tp-fortinet',
      name: 'Fortinet',
      description: 'Network security supplier providing FortiGate next-generation firewalls for edge and internal segmentation, FortiAnalyzer for log management, and FortiGuard threat intelligence feeds.',
      category: 'supplier' as const,
      status: 'active' as const,
      riskRating: 'critical' as const,
      dataClassification: 'confidential' as const,
      linkedAssetIds: ['asset-edge-firewall', 'asset-internal-firewall'],
      linkedRiskIds: ['risk-lb-unencrypted-backend', 'risk-inter-vlan-routing'],
      contactName: 'Michael Torres',
      contactEmail: 'michael.torres@fortinet.example.com',
      contractExpiry: '2027-04-30',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-10-31',
      notes: 'FortiGate 600E at edge, FortiGate 200F for internal segmentation. FortiOS firmware patching delayed by 90 days from release for stability testing — known CVEs remain unpatched in this window. Edge firewall rules allow inter-VLAN routing between guest and IoT VLANs due to legacy exception. Internal firewall passes unencrypted backend traffic between load balancer and application servers. FortiGuard subscription active for IPS signatures, URL filtering, and application control. Annual pen test identified 12 firewall rule violations.'
    },
    {
      id: 'vn-tp-cisco',
      name: 'Cisco Systems',
      description: 'Network infrastructure supplier providing core/distribution/access switches, wireless access points, ISE for network access control, and AnyConnect VPN for remote access.',
      category: 'supplier' as const,
      status: 'active' as const,
      riskRating: 'high' as const,
      dataClassification: 'confidential' as const,
      linkedAssetIds: ['asset-domain-controller', 'asset-web-server', 'asset-database-server'],
      linkedRiskIds: ['risk-nac-bypass-legacy', 'risk-vpn-shared-group-creds', 'risk-guest-iot-vlan-shared'],
      contactName: 'Sandra Lee',
      contactEmail: 'sandra.lee@cisco.example.com',
      contractExpiry: '2027-07-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-07-31',
      notes: 'Cisco Catalyst 9000 series switches, ISE 3.2 for 802.1X NAC, AnyConnect 5.0 VPN. NAC bypass possible via legacy devices using MAB authentication without profiling. VPN uses shared group credentials across 500+ remote users — individual certificate-based auth not yet deployed. Guest and IoT devices share VLAN due to switch port exhaustion. ISE posture assessment disabled for BYOD segment. SmartNet support contract active with 4-hour RMA SLA.'
    },
    {
      id: 'vn-tp-splunk',
      name: 'Splunk',
      description: 'SaaS security information and event management (SIEM) platform aggregating logs from firewalls, switches, servers, and domain controllers for threat detection and compliance reporting.',
      category: 'saas' as const,
      status: 'active' as const,
      riskRating: 'medium' as const,
      dataClassification: 'confidential' as const,
      linkedAssetIds: ['asset-siem-server'],
      linkedRiskIds: ['risk-siem-alert-fatigue', 'risk-ddos-shared-creds'],
      contactName: 'Raj Patel',
      contactEmail: 'raj.patel@splunk.example.com',
      contractExpiry: '2026-12-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-08-31',
      notes: 'Splunk Enterprise Security (on-prem) with 500 GB/day ingest license. Alert fatigue is critical — 3,500+ daily alerts with 22% false positive rate, SOC analysts acknowledge fewer than 40% of high-severity alerts. Correlation rules not tuned for the network topology changes in the last 12 months. DDoS shared credential alerts lost in noise. Retention meets 1-year compliance requirement but search performance degrades beyond 90 days. SOC 2 Type II certified.'
    },
    {
      id: 'vn-tp-zscaler',
      name: 'Zscaler',
      description: 'Managed SASE and SSL inspection service providing cloud-based web security gateway, SSL/TLS interception, and zero trust network access for remote and branch office users.',
      category: 'managed_service' as const,
      status: 'active' as const,
      riskRating: 'high' as const,
      dataClassification: 'restricted' as const,
      linkedAssetIds: ['asset-edge-firewall', 'asset-crypto-server'],
      linkedRiskIds: ['risk-ssl-inspection-perf', 'risk-ddos-shared-creds'],
      contactName: 'Karen Whitfield',
      contactEmail: 'karen.whitfield@zscaler.example.com',
      contractExpiry: '2027-02-28',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-08-31',
      notes: 'Zscaler Internet Access (ZIA) and Zscaler Private Access (ZPA). SSL inspection introduces 35% latency increase causing performance complaints — 15% of traffic bypasses inspection via PAC file exceptions including financial and healthcare domains. Zscaler processes all outbound web traffic including potential PII in URLs and POST bodies. Root CA certificate for SSL inspection deployed to all endpoints via GPO. DDoS protection shared service credential exposure risk. FedRAMP High authorized.'
    },
    {
      id: 'vn-tp-commscope',
      name: 'CommScope',
      description: 'Physical network infrastructure supplier providing structured cabling, fiber optic backbone, patch panels, and cable management systems for all data center and campus locations.',
      category: 'supplier' as const,
      status: 'active' as const,
      riskRating: 'low' as const,
      dataClassification: 'public' as const,
      linkedAssetIds: ['asset-edge-firewall', 'asset-backup-server'],
      linkedRiskIds: [],
      contactName: 'Thomas Grant',
      contactEmail: 'thomas.grant@commscope.example.com',
      contractExpiry: '2027-09-30',
      lastAssessmentDate: NOW,
      nextReviewDate: '2027-03-31',
      notes: 'CommScope SYSTIMAX structured cabling with Category 6A copper and OM4 multimode fiber backbone. 25-year warranty on permanent link performance. Physical layer — no direct cyber risk but cable plant documentation is public knowledge. Last physical audit confirmed 98% of patch panel ports labeled correctly. Cable runs between buildings traverse shared conduit with power — EMI shielding verified. No software or data processing components.'
    },
  ],
  securityInitiatives: [
    {
      id: 'vn-si-zero-trust', title: 'Zero Trust Network Segmentation Program',
      description: 'Implement zero-trust micro-segmentation across all network zones, replacing broad inter-VLAN routing with identity-aware App-ID policies and enforcing least-privilege network access.',
      category: 'transformation' as const, status: 'in_progress' as const, priority: 'critical' as const,
      owner: 'Network Architecture', executiveSponsor: 'CISO',
      currentState: 'Broad inter-VLAN routing allows east-west traffic for application compatibility; guest and IoT devices share a VLAN; NAC has bypass rules for legacy devices.',
      targetState: 'All inter-VLAN traffic controlled by Palo Alto App-ID policies; guest and IoT devices on separate micro-segmented VLANs; NAC bypass rules eliminated with MAC-based compensating controls.',
      startDate: '2025-05-01', targetDate: '2026-09-30', completedDate: '',
      milestones: [
        { id: 'vn-ms-zt-01', title: 'Audit and document all inter-VLAN routing rules', description: 'Complete inventory of all inter-VLAN routing rules on core switch and internal firewall, identifying rules required for application functionality versus legacy exceptions.', status: 'completed' as const, dueDate: '2025-08-31', completedDate: '2025-08-20', owner: 'Network Architecture' },
        { id: 'vn-ms-zt-02', title: 'Deploy App-ID policies on internal segmentation firewall', description: 'Replace broad inter-VLAN routing with Palo Alto App-ID policies on the PA-3220 internal firewall for all Internal-to-Restricted zone traffic.', status: 'in_progress' as const, dueDate: '2026-03-31', completedDate: '', owner: 'Network Security' },
        { id: 'vn-ms-zt-03', title: 'Separate guest and IoT VLANs with micro-segmentation', description: 'Create dedicated VLANs for guest wireless and IoT devices, eliminating shared VLAN configuration and implementing per-device-class access policies.', status: 'pending' as const, dueDate: '2026-09-30', completedDate: '', owner: 'Network Architecture' },
      ],
      linkedRiskIds: ['risk-inter-vlan-routing', 'risk-guest-iot-vlan-shared', 'risk-nac-bypass-legacy'],
      linkedControlSetIds: [],
      linkedAssetIds: ['asset-internal-firewall', 'asset-edge-firewall', 'asset-database-server'],
      linkedImplementedControlIds: ['vn-ic-ids-ips'],
      linkedAssessmentIds: ['assessment-network-security-review'],
      notes: 'Phase 1 audit complete. App-ID learning mode active on PA-3220 for 60-day baseline before enforcement.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'vn-si-credential-hygiene', title: 'Network Infrastructure Credential Hygiene Remediation',
      description: 'Eliminate shared administrative credentials across network appliances and implement individual MFA-backed authentication for all infrastructure management access including VPN and DDoS appliances.',
      category: 'remediation' as const, status: 'approved' as const, priority: 'high' as const,
      owner: 'Identity & Access Management', executiveSponsor: 'VP Infrastructure',
      currentState: 'DDoS appliance uses shared administrator credentials; VPN uses shared group credentials for contractors; no individual accountability for emergency network access.',
      targetState: 'All network appliance access via individual accounts with MFA; contractor VPN access via individual certificates integrated with Azure AD; shared credentials eliminated with break-glass procedures for emergency access.',
      startDate: '2025-07-01', targetDate: '2026-06-30', completedDate: '',
      milestones: [
        { id: 'vn-ms-cred-01', title: 'Implement individual admin accounts on DDoS appliance', description: 'Replace shared administrator credentials on DDoS protection appliance with individual accounts backed by RADIUS/TACACS+ authentication.', status: 'in_progress' as const, dueDate: '2026-01-31', completedDate: '', owner: 'Network Security' },
        { id: 'vn-ms-cred-02', title: 'Issue individual contractor VPN certificates via Azure AD', description: 'Replace shared VPN group credentials with individual contractor certificates issued via Azure AD integration with conditional access policies.', status: 'pending' as const, dueDate: '2026-06-30', completedDate: '', owner: 'Identity & Access Management' },
      ],
      linkedRiskIds: ['risk-ddos-shared-creds', 'risk-vpn-shared-group-creds'],
      linkedControlSetIds: [],
      linkedAssetIds: ['asset-edge-firewall', 'asset-domain-controller'],
      linkedImplementedControlIds: ['vn-ic-siem'],
      linkedAssessmentIds: ['assessment-network-security-review'],
      notes: 'Azure AD integration design approved. DDoS appliance vendor confirmed RADIUS support in firmware 6.2+.',
      createdAt: NOW, updatedAt: NOW,
    },
  ],
  implementedControls: [
    {
      id: 'vn-ic-ids-ips', title: 'Suricata IDS/IPS Network Sensor',
      description: 'Suricata open-source IDS/IPS deployed on a SPAN port from the core switch providing signature-based and anomaly-based detection of malicious network traffic across internal and DMZ zones.',
      controlType: 'technical' as const, category: 'monitoring' as const,
      status: 'active' as const, automationLevel: 'semi_automated' as const,
      owner: 'Security Operations', vendor: 'OISF', product: 'Suricata', version: '7.0.3',
      implementedDate: '2024-02-01', lastReviewDate: '2025-05-15', nextReviewDate: '2026-05-15',
      linkedSoaEntryIds: ['soa-net-a09', 'soa-net-cis-04'],
      linkedRiskIds: ['risk-inter-vlan-routing', 'risk-lb-unencrypted-backend', 'risk-siem-alert-fatigue'],
      linkedAssetIds: ['asset-edge-firewall', 'asset-internal-firewall', 'asset-siem-server'],
      linkedAssessmentIds: ['assessment-network-security-review'],
      notes: 'Signature updates daily via ET Pro ruleset. Anomaly detection baselines refreshed quarterly. Alert volume averaging 1,200/day — contributes to SIEM alert fatigue.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'vn-ic-siem', title: 'Splunk Enterprise Security SIEM',
      description: 'Splunk Enterprise Security providing centralized log correlation, UEBA, and SOAR integration for detection and response across all network zones with 2-year log retention.',
      controlType: 'technical' as const, category: 'monitoring' as const,
      status: 'active' as const, automationLevel: 'semi_automated' as const,
      owner: 'Security Operations', vendor: 'Splunk', product: 'Enterprise Security', version: '7.3',
      implementedDate: '2023-06-01', lastReviewDate: '2025-04-01', nextReviewDate: '2026-04-01',
      linkedSoaEntryIds: ['soa-net-a09', 'soa-net-a07'],
      linkedRiskIds: ['risk-siem-alert-fatigue', 'risk-ddos-shared-creds'],
      linkedAssetIds: ['asset-siem-server', 'asset-edge-firewall', 'asset-domain-controller'],
      linkedAssessmentIds: ['assessment-network-security-review'],
      notes: 'UEBA module deployed but alert thresholds set conservatively to manage fatigue. Correlation rules reviewed monthly. SOAR playbooks cover top 10 alert types.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'vn-ic-nac', title: 'Cisco ISE Network Access Control',
      description: 'Cisco Identity Services Engine (ISE) providing 802.1X network access control, device profiling, and posture assessment for wired and wireless network connections.',
      controlType: 'technical' as const, category: 'access_control' as const,
      status: 'active' as const, automationLevel: 'fully_automated' as const,
      owner: 'Network Security', vendor: 'Cisco', product: 'ISE', version: '3.3',
      implementedDate: '2023-09-01', lastReviewDate: '2025-06-01', nextReviewDate: '2026-06-01',
      linkedSoaEntryIds: ['soa-net-a01', 'soa-net-a05'],
      linkedRiskIds: ['risk-nac-bypass-legacy', 'risk-guest-iot-vlan-shared'],
      linkedAssetIds: ['asset-internal-firewall', 'asset-edge-firewall'],
      linkedAssessmentIds: ['assessment-network-security-review'],
      notes: '802.1X enforcement on 92% of ports. Bypass rules remain for 47 legacy devices — MAC-based authentication as compensating control. Guest and IoT VLAN separation planned.',
      createdAt: NOW, updatedAt: NOW,
    },
  ],
});

export const vulnerableNetwork: ExampleSystem = {
  id: 'vulnerable-network',
  name: 'Enterprise Network Architecture',
  description: 'Modern enterprise network with multi-tier security, cloud integration, and operational zones',
  category: 'Network Infrastructure',
  // securityLevel removed - no longer part of the system model
  primaryZone: 'Internal',
  dataClassification: 'Confidential',
  grcWorkspace: vulnerableNetworkGrcWorkspace,

  nodes: [
    // Main Network Flow - Horizontal Layout
    {
      id: 'internet-zone',
      type: 'securityZone',
      position: { x: 50, y: 200 },
      data: {
        label: 'Internet Zone',
        zoneType: 'Internet' as SecurityZone,
        description: 'External network and ISP connections',
        zone: 'Internet' as SecurityZone
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
      position: { x: 750, y: 200 },
      data: {
        label: 'DMZ Zone',
        zoneType: 'DMZ' as SecurityZone,
        description: 'Demilitarized zone with public-facing services'
      },
      style: {
        width: 800,
        height: 800,
        background: colors.zoneBackgrounds.DMZ,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'internal-zone',
      type: 'securityZone',
      position: { x: 1690, y: 200 },
      data: {
        label: 'Internal Zone',
        zoneType: 'Internal' as SecurityZone,
        description: 'Corporate internal network and workstations'
      },
      style: {
        width: 900,
        height: 800,
        background: colors.zoneBackgrounds.Internal,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'restricted-zone',
      type: 'securityZone',
      position: { x: 2710, y: 200 },
      data: {
        label: 'Restricted Zone',
        zoneType: 'Restricted' as SecurityZone,
        description: 'High-security servers and sensitive data storage'
      },
      style: {
        width: 650,
        height: 800,
        background: colors.zoneBackgrounds.Restricted,
        zIndex: -1
      }
    } as SecurityNode,

    // Cloud Services - Top Tier
    {
      id: 'cloud-zone',
      type: 'securityZone',
      position: { x: 750, y: -50 },
      data: {
        label: 'Cloud Services',
        zoneType: 'Cloud' as SecurityZone,
        description: 'Public cloud services and SaaS applications'
      },
      style: {
        width: 800,
        height: 120,
        background: colors.zoneBackgrounds.Cloud,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'hybrid-zone',
      type: 'securityZone',
      position: { x: 1700, y: -50 },
      data: {
        label: 'Hybrid Cloud',
        zoneType: 'Hybrid' as SecurityZone,
        description: 'Hybrid cloud connectivity and integration'
      },
      style: {
        width: 900,
        height: 120,
        background: colors.zoneBackgrounds.Hybrid,
        zIndex: -1
      }
    } as SecurityNode,

    // Management and Operations - Bottom Tier
    {
      id: 'management-zone',
      type: 'securityZone',
      position: { x: 750, y: 1050 },
      data: {
        label: 'Management Zone',
        zoneType: 'Management' as SecurityZone,
        description: 'Network management and administrative access'
      },
      style: {
        width: 800,
        height: 150,
        background: colors.zoneBackgrounds.Management,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'recovery-zone',
      type: 'securityZone',
      position: { x: 1700, y: 1050 },
      data: {
        label: 'Recovery Zone',
        zoneType: 'Recovery' as SecurityZone,
        description: 'Disaster recovery and backup systems'
      },
      style: {
        width: 900,
        height: 150,
        background: colors.zoneBackgrounds.Recovery,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'quarantine-zone',
      type: 'securityZone',
      position: { x: 2700, y: 1050 },
      data: {
        label: 'Quarantine Zone',
        zoneType: 'Quarantine' as SecurityZone,
        description: 'Isolated systems for security analysis'
      },
      style: {
        width: 650,
        height: 150,
        background: colors.zoneBackgrounds.Quarantine,
        zIndex: -1
      }
    } as SecurityNode,

    // Infrastructure Components - Network Perimeter (Internet zone x=50, delta=0)
    {
      id: 'internet-gateway',
      type: 'router',
      position: { x: 125, y: 325 },
      data: {
        label: 'Internet Gateway Router',
        description: 'ISP border gateway with DDoS protection',
        vendor: 'cisco',
        product: 'ASR 1001-X',
        version: '16.12.07',
        zone: 'Internet' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        protocols: ['BGP', 'OSPF', 'SNMP'],
        securityControls: ['uRPF', 'Rate Limiting', 'BGP Filtering'],
        technology: 'Border Gateway Protocol'
      }
    } as SecurityNode,

    {
      id: 'cloud-gateway',
      type: 'router',
      position: { x: 1225, y: 25 },
      data: {
        label: 'Cloud Gateway',
        description: 'Azure ExpressRoute gateway for hybrid connectivity',
        vendor: 'microsoft',
        product: 'ExpressRoute Gateway',
        version: '2023.11',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['BGP', 'IPSec', 'HTTPS'],
        securityControls: ['Encryption', 'Authentication', 'Traffic Monitoring'],
        technology: 'Cloud Gateway'
      }
    } as SecurityNode,

    {
      id: 'ddos-protection',
      type: 'firewall',
      position: { x: 525, y: 325 },
      data: {
        label: 'DDoS Protection Appliance',
        description: 'Arbor Networks DDoS mitigation system',
        vendor: 'netscout',
        product: 'Arbor TMS',
        version: '8.7.1',
        zone: 'Internet' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['GRE', 'BGP', 'SNMP'],
        securityControls: ['Traffic Analysis', 'Behavioral Detection', 'Mitigation'],
        technology: 'DDoS Mitigation'
      }
    } as SecurityNode,

    // DMZ Components (zone x=770, delta=-50)
    {
      id: 'edge-firewall',
      type: 'firewall',
      position: { x: 1025, y: 325 },
      data: {
        label: 'Next-Gen Firewall',
        description: 'Fortinet FortiGate perimeter security appliance',
        vendor: 'fortinet',
        product: 'FortiGate 600E',
        version: '7.4.1',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['TCP', 'UDP', 'ICMP', 'SSL'],
        securityControls: ['IPS', 'Application Control', 'SSL Inspection', 'Sandboxing'],
        technology: 'Next-Generation Firewall'
      }
    } as SecurityNode,

    {
      id: 'waf',
      type: 'firewall',
      position: { x: 825, y: 475 },
      data: {
        label: 'Web Application Firewall',
        description: 'F5 BIG-IP Application Security Manager',
        vendor: 'f5',
        product: 'BIG-IP ASM',
        version: '16.1.3',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTP', 'HTTPS', 'WebSocket'],
        securityControls: ['OWASP Protection', 'Bot Defense', 'Rate Limiting'],
        technology: 'Web Application Firewall'
      }
    } as SecurityNode,

    {
      id: 'dmz-switch',
      type: 'switch',
      position: { x: 1025, y: 625 },
      data: {
        label: 'DMZ Core Switch',
        description: 'Cisco Catalyst high-performance DMZ switch',
        vendor: 'cisco',
        product: 'Catalyst 9300',
        version: '16.12.08',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['Ethernet', 'STP', 'LACP'],
        securityControls: ['Port Security', 'DHCP Snooping', '802.1X', 'Private VLANs'],
        technology: 'Layer 2/3 Switch'
      }
    } as SecurityNode,

    {
      id: 'ids-sensor',
      type: 'monitor',
      position: { x: 1225, y: 475 },
      data: {
        label: 'IDS/IPS Sensor',
        description: 'Cisco Firepower network intrusion detection sensor',
        vendor: 'cisco',
        product: 'Firepower 2130',
        version: '7.0.5',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['Mirror Port', 'SPAN', 'ERSPAN'],
        securityControls: ['Signature Detection', 'Anomaly Detection', 'File Analysis'],
        technology: 'Network IDS/IPS'
      }
    } as SecurityNode,

    // Cloud Components (zone x=770, delta=-50)
    {
      id: 'azure-ad',
      type: 'authServer',
      position: { x: 1025, y: 25 },
      data: {
        label: 'Azure Active Directory',
        description: 'Cloud identity and access management service',
        vendor: 'microsoft',
        product: 'Azure AD Premium P2',
        version: '2023.11',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'SAML', 'OAuth2', 'OpenID Connect'],
        securityControls: ['MFA', 'Conditional Access', 'Identity Protection'],
        technology: 'Cloud Identity Provider'
      }
    } as SecurityNode,

    {
      id: 'hybrid-connector',
      type: 'router',
      position: { x: 2125, y: 25 },
      data: {
        label: 'Hybrid Cloud Connector',
        description: 'Site-to-site VPN for hybrid cloud connectivity',
        vendor: 'cisco',
        product: 'ISR 4331',
        version: '16.12.07',
        zone: 'Hybrid' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['IPSec', 'GRE', 'BGP'],
        securityControls: ['Encryption', 'Authentication', 'Tunnel Monitoring'],
        technology: 'VPN Gateway'
      }
    } as SecurityNode,

    // Application Components (DMZ zone x=770, delta=-50)
    {
      id: 'load-balancer',
      type: 'loadBalancer',
      position: { x: 925, y: 725 },
      data: {
        label: 'Application Load Balancer',
        description: 'F5 BIG-IP Local Traffic Manager',
        vendor: 'f5',
        product: 'BIG-IP LTM',
        version: '16.1.3',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTP', 'HTTPS', 'TCP', 'UDP'],
        securityControls: ['SSL Offload', 'Health Monitoring', 'Session Persistence'],
        technology: 'Application Delivery Controller'
      }
    } as SecurityNode,

    {
      id: 'web-server-1',
      type: 'webServer',
      position: { x: 925, y: 875 },
      data: {
        label: 'Web Server Cluster',
        description: 'Nginx web servers with reverse proxy configuration',
        vendor: 'nginx',
        product: 'nginx plus',
        version: '1.22.1',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTP', 'HTTPS', 'FastCGI'],
        securityControls: ['SSL/TLS', 'Rate Limiting', 'Access Logging'],
        technology: 'Web Server'
      }
    } as SecurityNode,

    // Internal Network Components (zone x=1690, delta=+100)
    {
      id: 'internal-firewall',
      type: 'firewall',
      position: { x: 1975, y: 325 },
      data: {
        label: 'Internal Segmentation Firewall',
        description: 'Palo Alto PA-3220 micro-segmentation firewall',
        vendor: 'paloalto',
        product: 'PA-3220',
        version: '10.2.4',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['TCP', 'UDP', 'ICMP'],
        securityControls: ['User-ID', 'App-ID', 'Content-ID', 'Threat Prevention'],
        technology: 'Next-Generation Firewall'
      }
    } as SecurityNode,

    {
      id: 'core-switch',
      type: 'switch',
      position: { x: 2075, y: 575 },
      data: {
        label: 'Core Distribution Switch',
        description: 'Cisco Catalyst 9500 modular core switch',
        vendor: 'cisco',
        product: 'Catalyst 9500',
        version: '17.06.05',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['Ethernet', 'OSPF', 'BGP', 'MPLS'],
        securityControls: ['MACsec', 'TrustSec', 'NetFlow', 'DNA Center Integration'],
        technology: 'Layer 3 Switch'
      }
    } as SecurityNode,

    {
      id: 'siem-server',
      type: 'monitor',
      position: { x: 1775, y: 475 },
      data: {
        label: 'SIEM Platform',
        description: 'Splunk Enterprise Security information and event management',
        vendor: 'splunk',
        product: 'Enterprise Security',
        version: '7.3.0',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'Syslog', 'SNMP', 'API'],
        securityControls: ['Log Correlation', 'Threat Intelligence', 'UEBA', 'SOAR Integration'],
        technology: 'Security Information Management'
      }
    } as SecurityNode,

    {
      id: 'network-monitor',
      type: 'monitor',
      position: { x: 1725, y: 675 },
      data: {
        label: 'Network Performance Monitor',
        description: 'SolarWinds Network Performance Monitor with flow analysis',
        vendor: 'solarwinds',
        product: 'NPM',
        version: '2023.2',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['SNMP', 'NetFlow', 'sFlow', 'WMI'],
        securityControls: ['Bandwidth Monitoring', 'Anomaly Detection', 'Alerting'],
        technology: 'Network Monitoring'
      }
    } as SecurityNode,

    // Application Components in Internal zone - Enhanced with domain services
    {
      id: 'domain-controller',
      type: 'authServer',
      position: { x: 2075, y: 775 },
      data: {
        label: 'Active Directory Domain Controller',
        description: 'Windows Server 2022 domain controller with LDAP services',
        vendor: 'microsoft',
        product: 'Windows Server 2022',
        version: '21H2',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['LDAP', 'Kerberos', 'DNS', 'SMB'],
        securityControls: ['Group Policy', 'Certificate Services', 'ADFS'],
        technology: 'Directory Services'
      }
    } as SecurityNode,

    {
      id: 'file-server',
      type: 'server',
      position: { x: 1775, y: 875 },
      data: {
        label: 'Enterprise File Server',
        description: 'Windows Server 2022 with DFS and file classification',
        vendor: 'microsoft',
        product: 'Windows Server 2022',
        version: '21H2',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['SMB3', 'NFS', 'WebDAV'],
        securityControls: ['DFS Replication', 'File Classification', 'Access-based Enumeration'],
        technology: 'File Services'
      }
    } as SecurityNode,

    // User Workstations
    {
      id: 'workstation-1',
      type: 'workstation',
      position: { x: 2425, y: 575 },
      data: {
        label: 'Employee Workstation',
        description: 'Standard corporate desktop with endpoint protection',
        vendor: 'dell',
        product: 'OptiPlex 7090',
        version: 'Windows 11 Pro',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTP', 'HTTPS', 'SMB3', 'RDP'],
        securityControls: ['Microsoft Defender', 'BitLocker', 'Windows Hello'],
        technology: 'Desktop Workstation'
      }
    } as SecurityNode,

    {
      id: 'admin-workstation',
      type: 'workstation',
      position: { x: 2375, y: 375 },
      data: {
        label: 'Privileged Access Workstation',
        description: 'Hardened workstation for IT administration',
        vendor: 'dell',
        product: 'Precision 5570',
        version: 'Windows 11 Enterprise',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['RDP', 'SSH', 'HTTPS', 'PowerShell'],
        securityControls: ['Credential Guard', 'Application Guard', 'Just-in-Time Access'],
        technology: 'Privileged Access Workstation'
      }
    } as SecurityNode,

    // Restricted Zone Components (zone x=2710, delta=+350)
    {
      id: 'database-server',
      type: 'database',
      position: { x: 2775, y: 325 },
      data: {
        label: 'Enterprise Database Cluster',
        description: 'Microsoft SQL Server Always On availability group',
        vendor: 'microsoft',
        product: 'SQL Server 2022',
        version: '16.0',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['TDS', 'TCP/1433', 'TCP/5022'],
        securityControls: ['Always Encrypted', 'Dynamic Data Masking', 'Row Level Security', 'TDE'],
        technology: 'Database Management System'
      }
    } as SecurityNode,

    {
      id: 'backup-server',
      type: 'storage',
      position: { x: 2775, y: 625 },
      data: {
        label: 'Enterprise Backup System',
        description: 'Veeam Backup & Replication with immutable storage',
        vendor: 'veeam',
        product: 'Backup & Replication',
        version: '12.0',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'SSH', 'iSCSI'],
        securityControls: ['Immutable Backups', 'Encryption', 'Air Gap Protection'],
        technology: 'Backup and Recovery'
      }
    } as SecurityNode,

    {
      id: 'crypto-server',
      type: 'service',
      position: { x: 2775, y: 775 },
      data: {
        label: 'Certificate Authority',
        description: 'Microsoft AD Certificate Services with HSM integration',
        vendor: 'microsoft',
        product: 'AD Certificate Services',
        version: '2022',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'LDAP', 'CRL', 'OCSP'],
        securityControls: ['Hardware Security Module', 'Key Archival', 'Certificate Templates'],
        technology: 'Public Key Infrastructure'
      }
    } as SecurityNode,

    // Management Zone Components (zone x=770, delta=-50)
    {
      id: 'network-mgmt',
      type: 'monitor',
      position: { x: 1225, y: 1175 },
      data: {
        label: 'Network Management System',
        description: 'Cisco DNA Center for network automation and assurance',
        vendor: 'cisco',
        product: 'DNA Center',
        version: '2.3.5',
        zone: 'Management' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'SSH', 'SNMP', 'NetConf'],
        securityControls: ['RBAC', 'API Security', 'Audit Logging'],
        technology: 'Network Management'
      }
    } as SecurityNode,

    {
      id: 'jump-server',
      type: 'server',
      position: { x: 825, y: 1175 },
      data: {
        label: 'Bastion Host',
        description: 'Hardened jump server for administrative access',
        vendor: 'redhat',
        product: 'RHEL 9',
        version: '9.2',
        zone: 'Management' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['SSH', 'RDP', 'HTTPS'],
        securityControls: ['MFA', 'Session Recording', 'Privileged Access Management'],
        technology: 'Bastion Host'
      }
    } as SecurityNode,

    // Recovery Zone Components (zone x=1690, delta=+100)
    {
      id: 'dr-controller',
      type: 'server',
      position: { x: 2275, y: 1175 },
      data: {
        label: 'Disaster Recovery Controller',
        description: 'VMware Site Recovery Manager for automated DR',
        vendor: 'vmware',
        product: 'Site Recovery Manager',
        version: '8.7',
        zone: 'Recovery' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'vSphere API', 'SSH'],
        securityControls: ['Automated Failover', 'Recovery Testing', 'Replication Monitoring'],
        technology: 'Disaster Recovery'
      }
    } as SecurityNode,

    {
      id: 'backup-storage',
      type: 'storage',
      position: { x: 1775, y: 1175 },
      data: {
        label: 'Immutable Backup Storage',
        description: 'Dell PowerProtect DD with air-gap protection',
        vendor: 'dell',
        product: 'PowerProtect DD',
        version: '7.7',
        zone: 'Recovery' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['NFS', 'CIFS', 'DD Boost'],
        securityControls: ['Immutable Storage', 'Encryption', 'Retention Lock'],
        technology: 'Backup Storage'
      }
    } as SecurityNode,

    // Quarantine Zone Components (zone x=2710, delta=+350)
    {
      id: 'malware-sandbox',
      type: 'server',
      position: { x: 2875, y: 1175 },
      data: {
        label: 'Malware Analysis Sandbox',
        description: 'Cuckoo Sandbox for automated malware analysis',
        vendor: 'cuckoo',
        product: 'Cuckoo Sandbox',
        version: '2.0.7',
        zone: 'Quarantine' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'SSH'],
        securityControls: ['Isolated Environment', 'Behavioral Analysis', 'IOC Extraction'],
        technology: 'Malware Analysis'
      }
    } as SecurityNode,

    {
      id: 'forensic-workstation',
      type: 'workstation',
      position: { x: 3225, y: 1175 },
      data: {
        label: 'Digital Forensics Workstation',
        description: 'Specialized workstation for incident response and forensics',
        vendor: 'dell',
        product: 'Precision 7670',
        version: 'Ubuntu 22.04 LTS',
        zone: 'Quarantine' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['SSH', 'HTTPS'],
        securityControls: ['Write Blockers', 'Chain of Custody', 'Encrypted Storage'],
        technology: 'Digital Forensics'
      }
    } as SecurityNode
  ],

  edges: [
    // Internet Zone Connections
    {
      id: 'internet-to-ddos',
      source: 'internet-gateway',
      target: 'ddos-protection',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Internet Traffic',
        protocol: 'BGP/TCP/UDP',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        zone: 'Internet' as SecurityZone,
        portRange: 'All'
      }
    } as SecurityEdge,

    // Cloud Zone Connections
    {
      id: 'cloud-to-hybrid',
      source: 'cloud-gateway',
      target: 'hybrid-connector',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Cloud Connectivity',
        protocol: 'BGP/IPSec',
        encryption: 'IPSec',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Hybrid' as SecurityZone,
        portRange: '500,4500'
      }
    } as SecurityEdge,

    {
      id: 'azure-ad-to-domain',
      source: 'azure-ad',
      target: 'domain-controller',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        controlPoints: [
          { id: 'cp-1771639914891', x: 1250, y: 300, active: true },
          { id: 'cp-1771639921871', x: 1600, y: 300, active: true }
        ],
        label: 'Identity Sync',
        protocol: 'HTTPS/LDAP',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Internal' as SecurityZone,
        portRange: '443,636'
      }
    } as SecurityEdge,

    // Internet to DMZ flow
    {
      id: 'ddos-to-firewall',
      source: 'ddos-protection',
      target: 'edge-firewall',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Filtered Traffic',
        protocol: 'HTTP/HTTPS/SMTP',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        zone: 'DMZ' as SecurityZone,
        portRange: '80,443,25'
      }
    } as SecurityEdge,

    // DMZ security layer connections
    {
      id: 'firewall-to-waf',
      source: 'edge-firewall',
      target: 'waf',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Web Traffic',
        protocol: 'HTTP/HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone,
        portRange: '80,443'
      }
    } as SecurityEdge,

    {
      id: 'firewall-to-switch',
      source: 'edge-firewall',
      target: 'dmz-switch',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'DMZ Network Access',
        protocol: 'Ethernet',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone,
        portRange: 'Switched'
      }
    } as SecurityEdge,

    {
      id: 'switch-to-ids',
      source: 'dmz-switch',
      target: 'ids-sensor',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Mirror Traffic',
        protocol: 'SPAN/ERSPAN',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone,
        portRange: 'Monitor'
      }
    } as SecurityEdge,

    // Application layer connections
    {
      id: 'waf-to-loadbalancer',
      source: 'waf',
      target: 'load-balancer',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Protected Web Requests',
        protocol: 'HTTP/HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone,
        portRange: '80,443'
      }
    } as SecurityEdge,

    {
      id: 'loadbalancer-to-webserver',
      source: 'load-balancer',
      target: 'web-server-1',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Load Balanced Requests',
        protocol: 'HTTP',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone,
        portRange: '8080'
      }
    } as SecurityEdge,

    // DMZ to Internal zone traversal
    {
      id: 'webserver-to-internal-fw',
      source: 'web-server-1',
      target: 'internal-firewall',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Backend API Calls',
        protocol: 'HTTPS/REST',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone,
        portRange: '443,8443'
      }
    } as SecurityEdge,

    // Internal network infrastructure
    {
      id: 'internal-fw-to-switch',
      source: 'internal-firewall',
      target: 'core-switch',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Internal Network Access',
        protocol: 'Ethernet/MPLS',
        encryption: 'MACsec',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone,
        portRange: 'Switched'
      }
    } as SecurityEdge,

    // Security monitoring connections
    {
      id: 'switch-to-siem',
      source: 'core-switch',
      target: 'siem-server',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'NetFlow Data',
        protocol: 'NetFlow v9',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone,
        portRange: '2055'
      }
    } as SecurityEdge,

    {
      id: 'switch-to-monitor',
      source: 'core-switch',
      target: 'network-monitor',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'SNMP Monitoring',
        protocol: 'SNMPv3',
        encryption: 'SNMPv3 Auth/Priv',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone,
        portRange: '161'
      }
    } as SecurityEdge,

    // Domain services connections
    {
      id: 'switch-to-dc',
      source: 'core-switch',
      target: 'domain-controller',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Directory Services',
        protocol: 'LDAP/Kerberos',
        encryption: 'LDAPS/Kerberos',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Internal' as SecurityZone,
        portRange: '389,636,88'
      }
    } as SecurityEdge,

    {
      id: 'switch-to-fileserver',
      source: 'core-switch',
      target: 'file-server',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'File Share Access',
        protocol: 'SMB3',
        encryption: 'SMB3 Encryption',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone,
        portRange: '445'
      }
    } as SecurityEdge,

    // Workstation connections
    {
      id: 'switch-to-workstation',
      source: 'core-switch',
      target: 'workstation-1',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'User Network Access',
        protocol: 'Ethernet/802.1X',
        encryption: 'WPA3-Enterprise',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone,
        portRange: 'Dynamic'
      }
    } as SecurityEdge,

    {
      id: 'switch-to-admin',
      source: 'core-switch',
      target: 'admin-workstation',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'top',
      data: {
        label: 'Administrative Access',
        protocol: 'Ethernet/802.1X',
        encryption: 'Certificate-based',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Internal' as SecurityZone,
        portRange: 'Restricted'
      }
    } as SecurityEdge,

    // Internal to Restricted zone access
    {
      id: 'internal-fw-to-database',
      source: 'internal-firewall',
      target: 'database-server',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Database Access',
        protocol: 'TDS/SQL',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone,
        portRange: '1433'
      }
    } as SecurityEdge,

    {
      id: 'database-to-backup',
      source: 'database-server',
      target: 'backup-server',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Backup Operations',
        protocol: 'iSCSI/NFS',
        encryption: 'AES-256',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone,
        portRange: '3260,2049'
      }
    } as SecurityEdge,

    {
      id: 'dc-to-crypto',
      source: 'domain-controller',
      target: 'crypto-server',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Certificate Services',
        protocol: 'RPC/DCOM',
        encryption: 'Kerberos',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone,
        portRange: '135,1024-5000'
      }
    } as SecurityEdge,

    // SIEM data collection from security devices
    {
      id: 'firewall-to-siem',
      source: 'edge-firewall',
      target: 'siem-server',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Security Logs',
        protocol: 'Syslog/TLS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone,
        portRange: '6514'
      }
    } as SecurityEdge,

    {
      id: 'ids-to-siem',
      source: 'ids-sensor',
      target: 'siem-server',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'IDS Alerts',
        protocol: 'HTTPS/API',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone,
        portRange: '443'
      }
    } as SecurityEdge,

    // Management Zone Connections
    {
      id: 'jump-to-network-mgmt',
      source: 'jump-server',
      target: 'network-mgmt',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Management Access',
        protocol: 'SSH/HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Management' as SecurityZone,
        portRange: '22,443'
      }
    } as SecurityEdge,

    {
      id: 'network-mgmt-to-switch',
      source: 'network-mgmt',
      target: 'core-switch',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Network Control',
        protocol: 'SNMP/NetConf',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Management' as SecurityZone,
        portRange: '161,830'
      }
    } as SecurityEdge,

    // Recovery Zone Connections
    {
      id: 'backup-to-dr',
      source: 'backup-server',
      target: 'dr-controller',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'DR Replication',
        protocol: 'vSphere Replication',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Recovery' as SecurityZone,
        portRange: '8043,31031'
      }
    } as SecurityEdge,

    {
      id: 'dr-to-backup-storage',
      source: 'dr-controller',
      target: 'backup-storage',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Backup Storage',
        protocol: 'NFS/DD Boost',
        encryption: 'AES-256',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Recovery' as SecurityZone,
        portRange: '2049,2051'
      }
    } as SecurityEdge,

    // Quarantine Zone Connections
    {
      id: 'siem-to-sandbox',
      source: 'siem-server',
      target: 'malware-sandbox',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Suspicious Files',
        protocol: 'HTTPS/API',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Quarantine' as SecurityZone,
        portRange: '443'
      }
    } as SecurityEdge,

    {
      id: 'sandbox-to-forensic',
      source: 'malware-sandbox',
      target: 'forensic-workstation',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Analysis Results',
        protocol: 'HTTPS/SSH',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Quarantine' as SecurityZone,
        portRange: '443,22'
      }
    } as SecurityEdge
  ],

  customContext: `# Enterprise Network Architecture - Modern Multi-Zone Security Design

## System Overview
Comprehensive enterprise network infrastructure supporting 1,200 employees across headquarters and five regional offices. This modernized architecture demonstrates advanced security zone segmentation, cloud integration, and operational resilience. The design implements defense-in-depth principles with eight distinct security zones: Internet, Cloud, Hybrid Cloud, DMZ, Internal, Restricted, Management, Recovery, and Quarantine zones.

## Enhanced Security Zone Architecture

### Cloud Integration Layer
- **Azure Cloud Gateway**: Secure ExpressRoute connectivity to Microsoft Azure cloud services
- **Azure Active Directory**: Cloud-based identity and access management with hybrid synchronization
- **Hybrid Cloud Connector**: Site-to-site VPN gateway enabling secure hybrid cloud connectivity

### Internet and External Zone
- **Internet Gateway Router (Cisco ASR 1001-X)**: Primary border gateway providing 1Gbps fiber connectivity with redundant ISP connections for high availability
  - BGP routing with automatic failover configured but primary path preference hardcoded for performance optimization
  - uRPF strict mode enabled with occasional legitimate traffic drops requiring manual whitelist updates
  - SNMP v3 monitoring enabled with community strings configured for backward compatibility with legacy tools

- **DDoS Protection (Netscout Arbor TMS)**: Advanced threat mitigation system with behavioral analysis
  - Traffic baseline learning period set to 30 days with manual threshold adjustments for peak business periods
  - Automatic mitigation triggers configured with 15-second detection window for rapid response
  - Management interface accessible via dedicated VLAN with shared administrator credentials for emergency access

### DMZ Security Layer
- **Next-Generation Firewall (Fortinet FortiGate 600E)**: Comprehensive perimeter security appliance
  - Application control signatures updated weekly during maintenance windows
  - SSL inspection enabled for all traffic except banking and healthcare applications for compliance
  - Sandbox analysis configured with 60-second timeout for performance optimization
  - Remote management enabled on non-standard port 8443 with certificate-based authentication

- **Web Application Firewall (F5 BIG-IP ASM)**: Layer 7 security for web applications
  - OWASP Top 10 protection enabled with learning mode disabled for production stability
  - Rate limiting configured per client IP with generous thresholds for customer experience
  - Bot detection enabled with captcha challenges for suspicious requests
  - Security policy updates applied manually after testing in staging environment

- **IDS/IPS Sensor (Cisco Firepower 2130)**: Network intrusion detection and prevention
  - Signature database updated nightly with automatic rule deployment
  - Anomaly detection baseline recalculated monthly with manual tuning for false positive reduction
  - File analysis integrated with threat intelligence feeds for malware detection
  - Sensor placement on mirror ports with full packet capture for forensic analysis

### Internal Network Infrastructure
- **Segmentation Firewall (Palo Alto PA-3220)**: Advanced micro-segmentation capabilities
  - User-ID integration with Active Directory providing granular access control based on user identity
  - Application identification running in learning mode for new business applications
  - Threat prevention with real-time signature updates and custom rule exceptions for business applications
  - Logs retention configured for 90 days with automatic archival to SIEM platform

- **Core Distribution Switch (Cisco Catalyst 9500)**: High-performance Layer 3 switching
  - DNA Center integration providing automated network assurance and policy enforcement
  - MACsec encryption enabled on uplinks with pre-shared keys rotated quarterly
  - NetFlow v9 enabled on all interfaces with 1:1000 sampling ratio for performance monitoring
  - Redundant power supplies with UPS backup providing 30 minutes runtime during outages

- **SIEM Platform (Splunk Enterprise Security)**: Centralized security monitoring and correlation
  - Log ingestion from 150+ sources with real-time indexing and 2-year retention policy
  - Threat intelligence feeds integrated from commercial and open source providers
  - User and Entity Behavior Analytics (UEBA) with 30-day baseline for anomaly detection
  - SOAR integration for automated incident response and ticket creation

### Restricted Zone - Critical Infrastructure
- **Database Cluster (SQL Server 2022 Always On)**: High-availability database services
  - Always Encrypted feature protecting sensitive data with client-side encryption
  - Transparent Data Encryption (TDE) with customer-managed keys stored in Azure Key Vault
  - Dynamic Data Masking configured for non-production environments
  - Automated backup to immutable storage with 7-year retention for compliance

- **Enterprise Backup System (Veeam B&R 12.0)**: Comprehensive data protection platform
  - Immutable backup repositories preventing ransomware encryption
  - Air-gapped backup copies maintained on tape library with 3-month rotation cycle
  - Backup encryption using AES-256 with keys managed through integrated key management
  - Recovery testing performed monthly with documented procedures for various disaster scenarios

- **Certificate Authority (Microsoft AD CS)**: Enterprise public key infrastructure
  - Hardware Security Module (HSM) integration for root CA private key protection
  - Certificate templates configured for user authentication, server authentication, and code signing
  - Online Certificate Status Protocol (OCSP) responders for real-time certificate validation
  - Certificate lifecycle management with automated renewal for internal certificates

## Current Configuration Details

### Network Security Controls
- Network segmentation implemented with VLANs and firewalls but inter-VLAN routing allows broad access for application compatibility
- Wireless network using WPA3-Enterprise with certificate-based authentication but guest network shares VLAN with employee IoT devices
- VPN access provided through SSL VPN with two-factor authentication but shared group credentials for contractor access
- Network access control (NAC) deployed with 802.1X but bypass rules configured for printers and legacy devices

### Monitoring and Logging
- Comprehensive logging enabled across all network devices with centralized collection
- Log retention configured for compliance requirements but storage costs require periodic archive to cheaper storage tiers
- Security event correlation rules tuned to reduce false positives but may miss sophisticated attack patterns
- Network monitoring dashboards provide real-time visibility but alerting thresholds set conservatively to avoid alert fatigue

### Operational Procedures
- Change management process requires approval for production modifications but emergency change procedures allow immediate implementation
- Vulnerability scanning performed weekly with remediation prioritized by CVSS score and business impact
- Penetration testing conducted annually by third-party vendor with findings addressed within 90 days
- Incident response procedures documented with 24/7 on-call rotation but response times average 4 hours for non-critical events

## Performance and Availability

### Current Metrics
- Network availability: 99.95% uptime with planned maintenance windows monthly
- Internet bandwidth utilization: 60% average with peaks at 85% during business hours
- Firewall throughput: 2.5 Gbps average with SSL inspection reducing performance by 30%
- Database response times: sub-100ms for 95% of queries with occasional timeouts during backup operations

### Capacity Planning
- Network infrastructure designed for 150% of current utilization with expansion plans documented
- Firewall licenses support 2,000 concurrent sessions with monitoring for approaching limits
- Storage capacity planning includes 20% growth annually with procurement lead times of 8-12 weeks
- Backup window optimization ongoing with deduplication improving efficiency by 40%

## Operational Security Zones

### Management Zone
- **Network Management System (Cisco DNA Center)**: Centralized network automation and assurance platform
  - Intent-based networking with policy automation across campus and branch locations
  - AI-powered network analytics with predictive insights for proactive issue resolution
  - Software-defined access implementation with dynamic policy enforcement
  - Integration with ITSM platforms for automated ticket creation and resolution tracking

- **Bastion Host (Red Hat Enterprise Linux 9)**: Hardened jump server for administrative access
  - Multi-factor authentication required for all administrative sessions
  - Session recording and keystroke logging for compliance and audit requirements
  - Privileged access management integration with time-limited access tokens
  - Network segmentation ensuring no direct internet access from management systems

### Recovery Zone
- **Disaster Recovery Controller (VMware Site Recovery Manager)**: Automated disaster recovery orchestration
  - Recovery point objectives (RPO) of 15 minutes with recovery time objectives (RTO) of 4 hours
  - Automated failover testing performed quarterly with documented runbooks
  - Cross-site replication to geographically separated data center 200 miles away
  - Integration with backup systems for granular recovery options and point-in-time restoration

- **Immutable Backup Storage (Dell PowerProtect DD)**: Air-gapped backup repository
  - Immutable storage with retention policies preventing ransomware encryption
  - Deduplication ratios averaging 15:1 for efficient storage utilization
  - Offline backup copies stored in secure offsite facility with monthly rotation
  - Backup verification and integrity checking performed automatically with alerting

### Quarantine Zone
- **Malware Analysis Sandbox (Cuckoo Sandbox)**: Isolated environment for threat analysis
  - Automated malware analysis with behavioral monitoring and IOC extraction
  - Integration with threat intelligence feeds for signature generation and sharing
  - Air-gapped network isolation preventing lateral movement during analysis
  - Forensic artifacts preserved for incident response and legal proceedings

- **Digital Forensics Workstation**: Specialized system for incident response activities
  - Write-blocking hardware preventing evidence contamination during analysis
  - Chain of custody documentation with cryptographic integrity verification
  - Forensic imaging capabilities supporting multiple file systems and encryption methods
  - Integration with SIEM platform for correlation with security events and timeline analysis`,

  attackPaths: [
    {
      id: 'ap-perimeter-to-database',
      name: 'Perimeter Traversal → Database Compromise via Unencrypted Backend',
      strideCategory: 'Information Disclosure',
      riskLevel: 'Critical',
      description: 'An attacker exploits a vulnerability in the public-facing web tier, intercepts unencrypted HTTP traffic between the load balancer and web servers (port 8080), then pivots through the internal segmentation firewall to the enterprise database cluster in the restricted zone.',
      steps: [
        {
          order: 1,
          edgeId: 'waf-to-loadbalancer',
          sourceNodeId: 'waf',
          targetNodeId: 'load-balancer',
          technique: 'T1190: Exploit Public-Facing Application',
        },
        {
          order: 2,
          edgeId: 'loadbalancer-to-webserver',
          sourceNodeId: 'load-balancer',
          targetNodeId: 'web-server-1',
          technique: 'T1040: Network Sniffing (unencrypted HTTP on port 8080)',
        },
        {
          order: 3,
          edgeId: 'webserver-to-internal-fw',
          sourceNodeId: 'web-server-1',
          targetNodeId: 'internal-firewall',
          technique: 'T1021: Remote Services',
        },
        {
          order: 4,
          edgeId: 'internal-fw-to-database',
          sourceNodeId: 'internal-firewall',
          targetNodeId: 'database-server',
          technique: 'T1005: Data from Local System',
        },
      ],
      mitreTechniques: ['T1190', 'T1040', 'T1021', 'T1005'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-lateral-via-vlan',
      name: 'Internal Lateral Movement → Domain Controller Compromise via Inter-VLAN Routing',
      strideCategory: 'Elevation of Privilege',
      riskLevel: 'High',
      description: 'An attacker who has compromised an employee workstation leverages broad inter-VLAN routing policies on the core switch to reach the domain controller. Kerberos ticket theft escalates access to domain administrator, enabling full control of the Active Directory environment.',
      steps: [
        {
          order: 1,
          edgeId: 'switch-to-workstation',
          sourceNodeId: 'core-switch',
          targetNodeId: 'workstation-1',
          technique: 'T1078: Valid Accounts (compromised endpoint)',
        },
        {
          order: 2,
          edgeId: 'switch-to-dc',
          sourceNodeId: 'core-switch',
          targetNodeId: 'domain-controller',
          technique: 'T1558: Steal or Forge Kerberos Tickets',
        },
      ],
      mitreTechniques: ['T1078', 'T1558'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-vpn-ransomware',
      name: 'VPN Credential Theft → Ransomware via Domain Controller and Backup Destruction',
      strideCategory: 'Denial of Service',
      riskLevel: 'Critical',
      description: 'A ransomware affiliate uses stolen shared VPN group credentials to enter the internal network through the edge firewall, pivots via the internal firewall and core switch to the domain controller for privilege escalation, then traverses to the database and backup servers to encrypt data and destroy recovery options.',
      steps: [
        {
          order: 1,
          edgeId: 'ddos-to-firewall',
          sourceNodeId: 'ddos-protection',
          targetNodeId: 'edge-firewall',
          technique: 'T1133: External Remote Services (VPN)',
        },
        {
          order: 2,
          edgeId: 'internal-fw-to-switch',
          sourceNodeId: 'internal-firewall',
          targetNodeId: 'core-switch',
          technique: 'T1021: Remote Services',
        },
        {
          order: 3,
          edgeId: 'switch-to-dc',
          sourceNodeId: 'core-switch',
          targetNodeId: 'domain-controller',
          technique: 'T1558: Steal or Forge Kerberos Tickets',
        },
        {
          order: 4,
          edgeId: 'internal-fw-to-database',
          sourceNodeId: 'internal-firewall',
          targetNodeId: 'database-server',
          technique: 'T1486: Data Encrypted for Impact',
        },
      ],
      mitreTechniques: ['T1133', 'T1021', 'T1558', 'T1486'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-pki-persistence',
      name: 'NAC Bypass → Domain Controller → Certificate Authority Persistence',
      strideCategory: 'Spoofing',
      riskLevel: 'High',
      description: 'An advanced attacker introduces a rogue device that bypasses NAC controls through legacy device exceptions, gains access to the internal network via the core switch, compromises the domain controller, then pivots to the certificate authority to forge authentication certificates for long-term persistent access.',
      steps: [
        {
          order: 1,
          edgeId: 'internal-fw-to-switch',
          sourceNodeId: 'internal-firewall',
          targetNodeId: 'core-switch',
          technique: 'T1200: Hardware Additions (rogue device via NAC bypass)',
        },
        {
          order: 2,
          edgeId: 'switch-to-dc',
          sourceNodeId: 'core-switch',
          targetNodeId: 'domain-controller',
          technique: 'T1556: Modify Authentication Process',
        },
        {
          order: 3,
          edgeId: 'dc-to-crypto',
          sourceNodeId: 'domain-controller',
          targetNodeId: 'crypto-server',
          technique: 'T1649: Steal or Forge Authentication Certificates',
        },
      ],
      mitreTechniques: ['T1200', 'T1556', 'T1649'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
  ],
};