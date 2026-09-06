/**
 * Railway Transport System - Multi-Modal Critical Infrastructure
 * 
 * This system demonstrates a complex railway transport system with multiple zones
 * including stations, ticketing, physical security, IT/OT systems, on-premises
 * data centers, and cloud services. Contains realistic operational vulnerabilities.
 */

import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityNode, SecurityEdge, SecurityZone } from '../../types/SecurityTypes';
import { DiagramAttackPath, AttackPathRiskLevel, AssessmentThreatModelNodeSourceType, AssessmentThreatModelEdgeSourceType } from '../../types/GrcTypes';
import { StrideCategory } from '../../types/ThreatIntelTypes';
import { colors } from '../../styles/Theme';
import { buildGrcWorkspace, score, NOW, OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID } from './grcSharedBase';
const tierCatalogue = [
  { id: 'rts-tier1-cyber', tier: 1 as const, label: 'Cyber Risk', description: 'Information security and cyber threats to railway transport systems' },
  { id: 'rts-tier1-operational', tier: 1 as const, label: 'Operational Risk', description: 'Operational safety, availability, and reliability risks to train services' },
  { id: 'rts-tier1-compliance', tier: 1 as const, label: 'Compliance Risk', description: 'Regulatory and standards compliance risks for railway operations' },

  { id: 'rts-tier2-ot-network', tier: 2 as const, label: 'OT Network Security', parentId: 'rts-tier1-cyber', description: 'Railway control network segmentation and protocol security' },
  { id: 'rts-tier2-identity', tier: 2 as const, label: 'Identity & Access', parentId: 'rts-tier1-cyber', description: 'Authentication and authorization for control and business systems' },
  { id: 'rts-tier2-data', tier: 2 as const, label: 'Data Protection', parentId: 'rts-tier1-cyber', description: 'Passenger data, operational data, and configuration protection' },
  { id: 'rts-tier2-remote-access', tier: 2 as const, label: 'Remote & Cloud Access', parentId: 'rts-tier1-cyber', description: 'Cloud services, mobile backend, and remote access controls' },
  { id: 'rts-tier2-safety', tier: 2 as const, label: 'Safety System Integrity', parentId: 'rts-tier1-operational', description: 'Protection of train control and signaling safety systems' },
  { id: 'rts-tier2-availability', tier: 2 as const, label: 'Service Availability', parentId: 'rts-tier1-operational', description: 'Continuity of passenger and operations services' },
  { id: 'rts-tier2-monitoring', tier: 2 as const, label: 'Security Monitoring', parentId: 'rts-tier1-operational', description: 'Threat detection, logging, and incident response for railway systems' },
  { id: 'rts-tier2-regulatory', tier: 2 as const, label: 'Railway Safety Standards', parentId: 'rts-tier1-compliance', description: 'EN 50129, IEC 62278, and federal safety mandates' },

  { id: 'rts-tier3-legacy-station', tier: 3 as const, label: 'Legacy Station Equipment', parentId: 'rts-tier2-ot-network', description: 'Outdated OS and unencrypted protocols on station equipment' },
  { id: 'rts-tier3-signal-manipulation', tier: 3 as const, label: 'Signal System Compromise', parentId: 'rts-tier2-safety', description: 'Unauthorized manipulation of signaling and interlocking systems' },
  { id: 'rts-tier3-cloud-mobile', tier: 3 as const, label: 'Cloud/Mobile Attack Surface', parentId: 'rts-tier2-remote-access', description: 'Internet-facing ticketing and analytics services' },
  { id: 'rts-tier3-passenger-data', tier: 3 as const, label: 'Passenger Data Exposure', parentId: 'rts-tier2-data', description: 'Payment information and travel history leakage' },
  { id: 'rts-tier3-it-ot-boundary', tier: 3 as const, label: 'IT/OT Boundary Weakness', parentId: 'rts-tier2-ot-network', description: 'Insufficient segmentation between corporate IT and operations control' },
  { id: 'rts-tier3-backup-exposure', tier: 3 as const, label: 'Unencrypted Backup Traffic', parentId: 'rts-tier2-data', description: 'Backup operations transmitted without encryption' },

  { id: 'rts-tier4-tvm-hardening', tier: 4 as const, label: 'TVM OS Hardening', parentId: 'rts-tier3-legacy-station' },
  { id: 'rts-tier4-display-patching', tier: 4 as const, label: 'Display System Patching', parentId: 'rts-tier3-legacy-station' },
  { id: 'rts-tier4-cbtc-protection', tier: 4 as const, label: 'CBTC Protocol Protection', parentId: 'rts-tier3-signal-manipulation' },
];

const assets = [
  {
    id: 'rts-asset-train-control', name: 'Siemens Trainguard MT CBTC', type: 'scada_server', owner: 'Operations Control',
    domain: 'ot' as const, category: 'Control System',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Automatic train control system managing train movement, collision avoidance, and CBTC communications',
    criticality: { confidentiality: 4, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 5 },
    diagramRefs: [{ diagramId: 'railway-transport-system', nodeId: 'train-control', nodeLabel: 'Automatic Train Control', nodeType: 'scadaServer' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'rts-asset-signal-control', name: 'GE I-ETMS Signal Control System', type: 'plc', owner: 'Operations Control',
    domain: 'ot' as const, category: 'Control System',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Railway signal and interlocking control with PTC implementation for federal safety mandates',
    criticality: { confidentiality: 3, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 5 },
    diagramRefs: [{ diagramId: 'railway-transport-system', nodeId: 'signal-control', nodeLabel: 'Signal Control System', nodeType: 'plc' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'rts-asset-operations-historian', name: 'OSIsoft PI Operations Historian', type: 'historian', owner: 'Operations Control',
    domain: 'ot' as const, category: 'Data System',
    businessCriticality: 4, securityCriticality: 4,
    description: 'Railway operations data historian storing performance metrics, fleet telemetry, and compliance data',
    criticality: { confidentiality: 4, integrity: 4, availability: 3, financial: 3, reputation: 3, safety: 2 },
    diagramRefs: [{ diagramId: 'railway-transport-system', nodeId: 'operations-historian', nodeLabel: 'Operations Historian', nodeType: 'historian' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'rts-asset-ticket-vending', name: 'Cubic S3 Ticket Vending Machines', type: 'terminal', owner: 'Station Infrastructure',
    domain: 'ot' as const, category: 'Field Device',
    businessCriticality: 3, securityCriticality: 4,
    description: 'Self-service ticket purchasing terminals running Windows 7 Embedded with EMV payment processing',
    criticality: { confidentiality: 4, integrity: 4, availability: 3, financial: 4, reputation: 3, safety: 1 },
    diagramRefs: [{ diagramId: 'railway-transport-system', nodeId: 'ticket-vending', nodeLabel: 'Ticket Vending Machines', nodeType: 'application' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'rts-asset-platform-displays', name: 'Platform Information Displays', type: 'terminal', owner: 'Station Infrastructure',
    domain: 'ot' as const, category: 'Field Device',
    businessCriticality: 3, securityCriticality: 3,
    description: 'Real-time passenger information screens running Android 6.0.1 with emergency messaging capability',
    criticality: { confidentiality: 2, integrity: 4, availability: 4, financial: 2, reputation: 4, safety: 3 },
    diagramRefs: [{ diagramId: 'railway-transport-system', nodeId: 'platform-displays', nodeLabel: 'Platform Information Displays', nodeType: 'application' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'rts-asset-ot-firewall', name: 'Hirschmann EAGLE Tofino OT Firewall', type: 'network_device', owner: 'OT Network Security',
    domain: 'ot' as const, category: 'Network Infrastructure',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Industrial firewall with deep packet inspection for Modbus, DNP3, and IEC61850 protocols',
    criticality: { confidentiality: 3, integrity: 5, availability: 5, financial: 4, reputation: 4, safety: 4 },
    diagramRefs: [{ diagramId: 'railway-transport-system', nodeId: 'ot-firewall', nodeLabel: 'OT Network Firewall', nodeType: 'industrialFirewall' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'rts-asset-operations-center', name: 'Operations Control Center', type: 'facility', owner: 'Railway Operations',
    domain: 'it' as const, category: 'Facility',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Centralized operations center housing SCADA workstations, dispatch systems, and OT network equipment',
    criticality: { confidentiality: 4, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 5 },
    diagramRefs: [
      { diagramId: 'railway-transport-system', nodeId: 'datacenter-firewall', nodeLabel: 'Data Center Firewall', nodeType: 'firewall' },
      { diagramId: 'railway-transport-system', nodeId: 'virtualization', nodeLabel: 'Virtualization Platform', nodeType: 'server' },
    ],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'rts-asset-comms-network', name: 'Railway Communications Network', type: 'network', owner: 'OT Network Security',
    domain: 'ot' as const, category: 'Network Infrastructure',
    businessCriticality: 5, securityCriticality: 4,
    description: 'GSM-R and TETRA communications backbone connecting stations, rolling stock, and operations control',
    criticality: { confidentiality: 3, integrity: 5, availability: 5, financial: 4, reputation: 4, safety: 4 },
    diagramRefs: [
      { diagramId: 'railway-transport-system', nodeId: 'fleet-management', nodeLabel: 'Fleet Management System', nodeType: 'application' },
    ],
    createdAt: NOW, updatedAt: NOW
  },
];

const risks = [
  {
    id: 'rts-risk-signal-manipulation', title: 'Signal System Manipulation via OT Network',
    description: 'An attacker who gains access to the OT zone through the data center firewall and OT firewall could manipulate the signal control system, potentially causing conflicting signal states or disabling PTC safety interlocks, leading to collision risk.',
    status: 'assessed' as const, owner: 'Operations Control',
    tierPath: { tier1: 'Operational Risk', tier2: 'Safety System Integrity', tier3: 'Signal System Compromise' },
    assetIds: ['rts-asset-signal-control', 'rts-asset-ot-firewall'],
    diagramLinks: [{ diagramId: 'railway-transport-system', nodeIds: ['signal-control', 'ot-firewall', 'train-control'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Deploy hardware-enforced safety interlocks independent of software-based CBTC; implement anomaly detection on signaling protocols',
    threatActorIds: ['rts-threat-actor-nation-state'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'rts-risk-train-control-override', title: 'Unauthorized Train Control System Override',
    description: 'The CBTC train control system receives commands through the OT firewall. A compromised OT firewall or exploited protocol vulnerability could allow unauthorized train movement commands, braking override, or collision avoidance system suppression.',
    status: 'assessed' as const, owner: 'Operations Control',
    tierPath: { tier1: 'Operational Risk', tier2: 'Safety System Integrity', tier3: 'Signal System Compromise' },
    assetIds: ['rts-asset-train-control', 'rts-asset-ot-firewall'],
    diagramLinks: [{ diagramId: 'railway-transport-system', nodeIds: ['train-control', 'ot-firewall'] }],
    inherentScore: score('likelihood-2', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Enforce SIL-4 hardware safety limits independent of software control; implement out-of-band safety verification for critical commands',
    threatActorIds: ['rts-threat-actor-nation-state'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'rts-risk-legacy-tvm', title: 'Legacy TVM Operating System Exploitation',
    description: 'Ticket vending machines run Windows 7 Embedded with unencrypted network communications to the station firewall. Outdated OS lacks current security patches, enabling payment data interception and potential lateral movement into station infrastructure.',
    status: 'assessed' as const, owner: 'Station Infrastructure',
    tierPath: { tier1: 'Cyber Risk', tier2: 'OT Network Security', tier3: 'Legacy Station Equipment' },
    assetIds: ['rts-asset-ticket-vending'],
    diagramLinks: [{ diagramId: 'railway-transport-system', nodeIds: ['ticket-vending', 'station-firewall'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Upgrade TVM operating systems to Windows 10 IoT Enterprise LTSC; enable TLS for all station network communications',
    threatActorIds: ['rts-threat-actor-hacktivist'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'rts-risk-passenger-data-breach', title: 'Passenger Data Breach via Cloud Backend',
    description: 'Mobile ticketing backend stores passenger payment data, travel history, and account credentials in cloud database. Compromise of the API gateway or Lambda functions could expose sensitive passenger data subject to GDPR and PCI DSS obligations.',
    status: 'assessed' as const, owner: 'IT Security',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Data Protection', tier3: 'Passenger Data Exposure' },
    assetIds: ['rts-asset-ticket-vending'],
    diagramLinks: [{ diagramId: 'railway-transport-system', nodeIds: ['mobile-backend', 'cloud-database', 'cloud-gateway'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Implement field-level encryption for PII; enforce WAF rules on API gateway; conduct quarterly cloud security assessments',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'rts-risk-it-ot-lateral', title: 'IT-to-OT Lateral Movement via Data Center',
    description: 'The data center firewall bridges corporate IT and operations control networks. A compromised corporate system could pivot through the data center and OT firewalls to reach train control and signaling systems.',
    status: 'assessed' as const, owner: 'OT Network Security',
    tierPath: { tier1: 'Cyber Risk', tier2: 'OT Network Security', tier3: 'IT/OT Boundary Weakness' },
    assetIds: ['rts-asset-ot-firewall', 'rts-asset-operations-center'],
    diagramLinks: [{ diagramId: 'railway-transport-system', nodeIds: ['corporate-firewall', 'datacenter-firewall', 'ot-firewall'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Deploy unidirectional security gateway between IT and OT; enforce strict application-layer whitelisting on OT firewall',
    threatActorIds: ['rts-threat-actor-nation-state'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'rts-risk-display-tampering', title: 'Passenger Display Content Manipulation',
    description: 'Platform information displays run outdated Android 6.0.1 and receive content via unencrypted HTTP from the station firewall. An attacker could inject false schedule information, cause panic with fake emergency messages, or disrupt passenger flow.',
    status: 'draft' as const, owner: 'Station Infrastructure',
    tierPath: { tier1: 'Cyber Risk', tier2: 'OT Network Security', tier3: 'Legacy Station Equipment' },
    assetIds: ['rts-asset-platform-displays'],
    diagramLinks: [{ diagramId: 'railway-transport-system', nodeIds: ['platform-displays', 'station-firewall'] }],
    inherentScore: score('likelihood-4', 'impact-3'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Upgrade display firmware to current Android version; enforce HTTPS for all content delivery; implement display content signing',
    threatActorIds: ['rts-threat-actor-hacktivist'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'rts-risk-backup-interception', title: 'Unencrypted Backup Traffic Interception',
    description: 'Virtualization platform backup operations to NetApp storage use unencrypted NFS, exposing operational data, system configurations, and potentially stored credentials to network eavesdropping within the production zone.',
    status: 'draft' as const, owner: 'IT Security',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Data Protection', tier3: 'Unencrypted Backup Traffic' },
    assetIds: ['rts-asset-operations-center'],
    diagramLinks: [{ diagramId: 'railway-transport-system', nodeIds: ['virtualization', 'backup-system'] }],
    inherentScore: score('likelihood-3', 'impact-3'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Migrate backup traffic to NFS v4.1 with Kerberos encryption; implement network segmentation for backup VLAN',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'rts-risk-emergency-notification-abuse', title: 'Emergency Notification System Abuse',
    description: 'Compromise of the Everbridge emergency notification platform or its integration with platform displays could enable false emergency alerts, triggering mass evacuation procedures and causing stampede risk at crowded stations.',
    status: 'assessed' as const, owner: 'Station Infrastructure',
    tierPath: { tier1: 'Operational Risk', tier2: 'Service Availability' },
    assetIds: ['rts-asset-platform-displays', 'rts-asset-comms-network'],
    diagramLinks: [{ diagramId: 'railway-transport-system', nodeIds: ['emergency-notification', 'platform-displays', 'mobile-backend'] }],
    inherentScore: score('likelihood-2', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Implement multi-person authorization for emergency broadcasts; add content verification before display propagation',
    threatActorIds: ['rts-threat-actor-hacktivist'],
    createdAt: NOW, updatedAt: NOW
  },
];

const assessments = [
  {
    id: 'rts-assessment-railway-security', title: 'Railway Transport Cybersecurity Posture Assessment',
    status: 'in_review' as const,
    owner: 'OT Security Architecture',
    reviewer: 'CISO',
    startDate: '2025-05-01',
    dueDate: '2025-07-31',
    threatActorIds: ['rts-threat-actor-nation-state', 'rts-threat-actor-hacktivist', 'rts-threat-actor-insider'],
    methodologyNote: 'Assessment follows IEC 62443 and EN 50129 methodologies with NIST SP 800-82 control mapping adapted for railway transport CBTC and PTC systems.',
    assumptionNote: 'Assessment covers all zones from passenger services through operations control. Safety systems assessed for cyber-physical attack vectors only.',
    scopeItems: [
      { id: 'rts-scope-system', type: 'system' as const, value: 'system', name: 'Metropolitan Railway Network' },
      { id: 'rts-scope-ot', type: 'diagram_segment' as const, value: 'OT', name: 'Operations Control Zone' },
      { id: 'rts-scope-dmz', type: 'diagram_segment' as const, value: 'DMZ', name: 'Station Infrastructure Zone' },
      { id: 'rts-scope-cloud', type: 'diagram_segment' as const, value: 'Cloud', name: 'Cloud Services Zone' },
    ],
    tierFilter: { tier1: 'Cyber Risk' },
    riskManagementPlan: {
      objective: 'Reduce cyber-physical attack surface across railway operations and enforce defense-in-depth between IT, cloud, and OT networks.',
      strategy: 'Prioritize safety system isolation, upgrade legacy station equipment, and harden cloud-facing services.',
      residualRiskStatement: 'Residual risk accepted for legacy station equipment during phased upgrade program with compensating monitoring controls.',
      monitoringApproach: 'Weekly review of open plan actions with monthly OT security posture report to railway safety committee.',
      communicationPlan: 'Report progress to Railway Security Steering Committee and Transport Safety Board monthly.',
      reviewCadenceDays: 14,
      actions: [
        {
          id: 'rts-rmp-action-tvm-upgrade',
          title: 'Upgrade ticket vending machine OS from Windows 7 to Windows 10 IoT LTSC',
          owner: 'Station Infrastructure',
          dueDate: '2025-09-30',
          status: 'in_progress' as const,
          linkedRiskIds: ['rts-risk-legacy-tvm'],
          notes: 'Pilot upgrade completed at 12 stations; rolling deployment in progress'
        },
        {
          id: 'rts-rmp-action-ot-gateway',
          title: 'Deploy unidirectional security gateway between IT data center and OT zone',
          owner: 'OT Network Security',
          dueDate: '2025-08-31',
          status: 'planned' as const,
          linkedRiskIds: ['rts-risk-it-ot-lateral', 'rts-risk-signal-manipulation'],
          notes: 'Waterfall Security Solutions unidirectional gateway procurement approved'
        },
        {
          id: 'rts-rmp-action-display-upgrade',
          title: 'Upgrade platform display firmware and enforce HTTPS content delivery',
          owner: 'Station Infrastructure',
          dueDate: '2025-10-15',
          status: 'planned' as const,
          linkedRiskIds: ['rts-risk-display-tampering'],
          notes: 'New display firmware tested in lab environment'
        },
        {
          id: 'rts-rmp-action-cloud-hardening',
          title: 'Implement field-level encryption and WAF rules for mobile backend',
          owner: 'IT Security',
          dueDate: '2025-08-15',
          status: 'in_progress' as const,
          linkedRiskIds: ['rts-risk-passenger-data-breach'],
          notes: 'AWS WAF rules deployed; field-level encryption implementation underway'
        },
      ],
      updatedAt: NOW
    },
    riskIds: risks.map(r => r.id),
    soaGapIds: ['rts-soa-a02', 'rts-soa-a05', 'rts-soa-a06'],
    taskIds: ['rts-task-tvm-upgrade', 'rts-task-ot-gateway', 'rts-task-display-upgrade'],
    linkedImplementedControlIds: [],
    linkedInitiativeIds: [],
    summary: 'Comprehensive railway transport cybersecurity assessment covering 8 identified risks across all operational zones. Two risks rated Critical due to safety implications, three rated High.',
    findings: 'Key findings include legacy station equipment with outdated operating systems, insufficient IT/OT segmentation at the data center boundary, unencrypted backup and display traffic, and cloud backend exposure for passenger data.',
    recommendations: 'Prioritize safety system isolation with unidirectional gateways, upgrade legacy station equipment OS and firmware, and harden cloud-facing mobile backend services.',
    evidenceSummary: 'Evidence includes OT network architecture diagrams, station equipment inventory, cloud security assessment reports, and penetration test results.',
    threatModel: {
      nodes: [
        { id: 'rts-tm-node-corp-fw', label: 'Corporate Firewall', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'corporate-firewall', position: { x: 50, y: 150 }, nodeType: 'firewall' },
        { id: 'rts-tm-node-dc-fw', label: 'Data Center Firewall', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'datacenter-firewall', position: { x: 200, y: 150 }, nodeType: 'firewall', commentary: 'Bridge between IT and OT networks' },
        { id: 'rts-tm-node-ot-fw', label: 'OT Firewall', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'ot-firewall', position: { x: 350, y: 150 }, nodeType: 'industrialFirewall', commentary: 'Industrial protocol DPI for Modbus/DNP3/IEC61850' },
        { id: 'rts-tm-node-train', label: 'Train Control', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'train-control', position: { x: 500, y: 100 }, nodeType: 'scadaServer', commentary: 'CBTC system - SIL-4 safety critical' },
        { id: 'rts-tm-node-signal', label: 'Signal Control', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'signal-control', position: { x: 650, y: 100 }, nodeType: 'plc', commentary: 'I-ETMS with PTC enforcement' },
        { id: 'rts-tm-node-tvm', label: 'Ticket Vending Machines', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'ticket-vending', position: { x: 200, y: 300 }, nodeType: 'application', commentary: 'Windows 7 Embedded - legacy OS' },
        { id: 'rts-tm-node-displays', label: 'Platform Displays', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'platform-displays', position: { x: 350, y: 300 }, nodeType: 'application', commentary: 'Android 6.0.1 - unencrypted HTTP content' },
      ],
      edges: [
        { id: 'rts-tm-edge-corp-dc', source: 'rts-tm-node-corp-fw', target: 'rts-tm-node-dc-fw', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'corporate-to-datacenter-fw', label: 'IPSec', commentary: 'IT to production boundary' },
        { id: 'rts-tm-edge-dc-ot', source: 'rts-tm-node-dc-fw', target: 'rts-tm-node-ot-fw', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'datacenter-to-ot-fw', label: 'IT/OT Interface', commentary: 'Critical segmentation point' },
        { id: 'rts-tm-edge-ot-train', source: 'rts-tm-node-ot-fw', target: 'rts-tm-node-train', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'ot-fw-to-train-control', label: 'CBTC' },
        { id: 'rts-tm-edge-train-signal', source: 'rts-tm-node-train', target: 'rts-tm-node-signal', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'train-to-signal', label: 'PTC Signal Coordination' },
      ],
      attackPathDescription: 'Two critical attack paths identified: (1) IT-to-OT lateral movement through data center to train control/signaling systems; (2) Station infrastructure compromise via legacy equipment leading to passenger panic through display manipulation.',
      attackPaths: [
        {
          id: 'rts-aap-it-to-signal',
          name: 'IT Network → OT Lateral Movement → Signal Manipulation',
          strideCategory: 'Tampering' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'An attacker compromises a corporate IT system, pivots through the data center firewall and OT firewall to reach the train control system, then manipulates signal coordination to create hazardous conditions.',
          diagramAttackPathId: 'rts-ap-it-to-signal',
          steps: [
            { order: 1, edgeId: 'corporate-to-datacenter-fw', sourceNodeId: 'corporate-firewall', targetNodeId: 'datacenter-firewall', technique: 'T1021: Remote Services' },
            { order: 2, edgeId: 'datacenter-to-ot-fw', sourceNodeId: 'datacenter-firewall', targetNodeId: 'ot-firewall', technique: 'T1071: Application Layer Protocol' },
            { order: 3, edgeId: 'ot-fw-to-train-control', sourceNodeId: 'ot-firewall', targetNodeId: 'train-control', technique: 'T0855: Unauthorized Command Message (ICS)' },
            { order: 4, edgeId: 'train-to-signal', sourceNodeId: 'train-control', targetNodeId: 'signal-control', technique: 'T0831: Manipulation of Control (ICS)' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
        {
          id: 'rts-aap-cloud-to-data',
          name: 'Cloud Backend Compromise → Passenger Data Exfiltration',
          strideCategory: 'Information Disclosure' as StrideCategory,
          riskLevel: 'High' as AttackPathRiskLevel,
          description: 'An attacker exploits the cloud API gateway or mobile backend to access passenger payment data and travel history stored in the cloud data warehouse.',
          diagramAttackPathId: 'rts-ap-cloud-to-data',
          steps: [
            { order: 1, edgeId: 'datacenter-to-cloud-gw', sourceNodeId: 'datacenter-firewall', targetNodeId: 'cloud-gateway', technique: 'T1190: Exploit Public-Facing Application' },
            { order: 2, edgeId: 'emergency-to-mobile', sourceNodeId: 'cloud-gateway', targetNodeId: 'mobile-backend', technique: 'T1078: Valid Accounts' },
            { order: 3, edgeId: 'mobile-backend-to-db', sourceNodeId: 'mobile-backend', targetNodeId: 'cloud-database', technique: 'T1530: Data from Cloud Storage' },
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
    id: 'rts-soa-a01', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A01', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'implemented' as const,
    justification: 'Role-based access control enforced on operations control systems via Active Directory integration. OT firewall enforces protocol-level access restrictions with Modbus/DNP3 whitelisting.',
    mitigatesRiskIds: ['rts-risk-train-control-override', 'rts-risk-signal-manipulation'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'rts-soa-a02', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A02', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'TVM network communications and platform display content delivery use unencrypted protocols. Backup traffic between virtualization and storage is unencrypted NFS.',
    mitigatesRiskIds: ['rts-risk-legacy-tvm', 'rts-risk-display-tampering', 'rts-risk-backup-interception'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'rts-soa-a04', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A04', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'planned' as const,
    justification: 'Architecture review planned to address IT/OT boundary segmentation at data center, legacy station equipment OS lifecycle, and cloud backend security hardening.',
    mitigatesRiskIds: ['rts-risk-it-ot-lateral', 'rts-risk-legacy-tvm', 'rts-risk-passenger-data-breach'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'rts-soa-a05', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A05', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Legacy ticket vending machines run unsupported Windows 7 Embedded. Platform displays use Android 6.0.1 without vendor security patches. OT firewall rules allow bidirectional traffic.',
    mitigatesRiskIds: ['rts-risk-legacy-tvm', 'rts-risk-display-tampering', 'rts-risk-it-ot-lateral'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'rts-soa-a06', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A06', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Windows 7 Embedded on TVMs and Android 6.0.1 on displays are end-of-life platforms. Known CVEs remain unpatched on station infrastructure equipment.',
    mitigatesRiskIds: ['rts-risk-legacy-tvm', 'rts-risk-display-tampering'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'rts-soa-a09', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A09', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'implemented' as const,
    justification: 'Centralized SIEM monitoring covers corporate IT and cloud zones. OT firewall provides industrial protocol logging. Station infrastructure monitoring coverage is limited.',
    mitigatesRiskIds: ['rts-risk-it-ot-lateral'],
    diagramRefs: [],
    evidence: [
      {
        id: 'rts-evidence-siem',
        kind: 'link' as const,
        name: 'SIEM deployment coverage report',
        url: 'https://security.railway.local/reports/siem-coverage',
        note: 'Annual SIEM coverage assessment for all operational zones',
        createdAt: NOW
      }
    ],
    updatedAt: NOW
  },
  {
    id: 'rts-soa-cis-01', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.01', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'implemented' as const,
    justification: 'Railway asset inventory maintained via centralized CMDB for IT assets and dedicated OT asset management for station and operations equipment.',
    mitigatesRiskIds: [], diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'rts-soa-cis-03', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.03', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Cloud data at rest encrypted via AWS KMS. Passenger payment data encrypted in transit. Station infrastructure and backup traffic encryption pending upgrade programs.',
    mitigatesRiskIds: ['rts-risk-passenger-data-breach', 'rts-risk-backup-interception'], diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'rts-soa-cis-04', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.04', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'OT firewall uses hardened configuration with DPI for industrial protocols. Station equipment configurations follow vendor defaults with limited hardening.',
    mitigatesRiskIds: ['rts-risk-signal-manipulation', 'rts-risk-it-ot-lateral'],
    diagramRefs: [],
    evidence: [
      { id: 'rts-evidence-ot-fw-config', kind: 'link' as const, name: 'OT firewall hardening baseline',
        url: 'https://security.railway.local/docs/ot-firewall-baseline', note: 'Hirschmann EAGLE configuration audit results', createdAt: NOW }
    ],
    updatedAt: NOW
  },
  {
    id: 'rts-soa-cis-06', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.06', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'implemented' as const,
    justification: 'RBAC enforced for operations control access via Active Directory. Cloud services use IAM with least-privilege policies. Station equipment uses shared credentials pending upgrade.',
    mitigatesRiskIds: ['rts-risk-train-control-override', 'rts-risk-passenger-data-breach'], diagramRefs: [], evidence: [], updatedAt: NOW
  },
];

const workflowTasks = [
  {
    id: 'rts-task-tvm-upgrade',
    title: 'Upgrade TVM operating systems from Windows 7 to Windows 10 IoT LTSC',
    description: 'Phase 1 of station equipment modernization: upgrade all 380 ticket vending machines to Windows 10 IoT Enterprise LTSC with encrypted network communications.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'high' as const,
    owner: 'Station Infrastructure',
    dueDate: '2025-09-30',
    riskId: 'rts-risk-legacy-tvm',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'rts-task-ot-gateway',
    title: 'Deploy unidirectional security gateway at IT/OT boundary',
    description: 'Replace bidirectional data center to OT firewall connection with hardware-enforced unidirectional gateway for operations data export.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'critical' as const,
    owner: 'OT Network Security',
    dueDate: '2025-08-31',
    riskId: 'rts-risk-it-ot-lateral',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'rts-task-display-upgrade',
    title: 'Upgrade platform display firmware and enable HTTPS content delivery',
    description: 'Update all platform information displays to current Android firmware with enforced HTTPS and content signing verification.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Station Infrastructure',
    dueDate: '2025-10-15',
    riskId: 'rts-risk-display-tampering',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'rts-task-cloud-waf',
    title: 'Implement WAF rules and field-level encryption for mobile backend',
    description: 'Deploy AWS WAF with OWASP rule set on API Gateway and implement field-level encryption for passenger PII in RDS PostgreSQL.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'high' as const,
    owner: 'IT Security',
    dueDate: '2025-08-15',
    riskId: 'rts-risk-passenger-data-breach',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'rts-task-backup-encryption',
    title: 'Migrate backup traffic to encrypted NFS v4.1 with Kerberos',
    description: 'Upgrade VMware to NetApp backup channel from NFS v3 to NFS v4.1 with Kerberos authentication and encryption.',
    type: 'control_implementation' as const,
    status: 'todo' as const,
    priority: 'medium' as const,
    owner: 'IT Security',
    dueDate: '2025-09-15',
    riskId: 'rts-risk-backup-interception',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'rts-task-evidence-siem',
    title: 'Attach SIEM coverage report as evidence for A09 control',
    description: 'Upload annual SIEM deployment coverage assessment and OT monitoring gap analysis as evidence for security logging and monitoring control.',
    type: 'evidence' as const,
    status: 'todo' as const,
    priority: 'medium' as const,
    owner: 'OT Network Security',
    dueDate: '2025-07-31',
    controlSetId: OWASP_CONTROL_SET_ID,
    controlId: 'A09',
    createdAt: NOW, updatedAt: NOW
  },
];

const governanceDocuments = [
  {
    id: 'rts-gov-safety-policy',
    title: 'Railway Cybersecurity and Safety Policy',
    type: 'policy' as const,
    description: 'Organization-wide policy governing cybersecurity controls for safety-critical railway systems, aligned with EN 50129 and IEC 62443.',
    owner: 'CISO',
    reviewDate: '2025-03-15',
    nextReviewDate: '2026-03-15',
    status: 'active' as const,
    version: '3.1',
    tags: ['safety', 'cybersecurity', 'railway', 'EN50129', 'IEC62443'],
    linkedRiskIds: ['rts-risk-signal-manipulation', 'rts-risk-train-control-override'],
    linkedControlSetIds: [CIS_CONTROL_SET_ID],
    linkedAssessmentIds: ['rts-assessment-railway-security'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'rts-gov-ot-access-procedure',
    title: 'Operations Control Zone Access Procedure',
    type: 'procedure' as const,
    description: 'Detailed procedure for authorized access to OT zone systems including train control, signaling, and fleet management. Covers both physical and logical access requirements.',
    owner: 'Operations Control',
    reviewDate: '2025-04-01',
    nextReviewDate: '2025-10-01',
    status: 'active' as const,
    version: '2.4',
    tags: ['ot-access', 'operations', 'train-control', 'signaling'],
    linkedRiskIds: ['rts-risk-it-ot-lateral', 'rts-risk-train-control-override'],
    linkedControlSetIds: [OWASP_CONTROL_SET_ID],
    linkedAssessmentIds: ['rts-assessment-railway-security'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'rts-gov-station-equipment-standard',
    title: 'Station Equipment Security Hardening Standard',
    type: 'standard' as const,
    description: 'Technical standard for security hardening of station infrastructure equipment including TVMs, platform displays, and physical security systems.',
    owner: 'Station Infrastructure',
    reviewDate: '2025-02-15',
    nextReviewDate: '2025-08-15',
    status: 'under_review' as const,
    version: '1.2',
    tags: ['station-equipment', 'hardening', 'tvm', 'displays'],
    linkedRiskIds: ['rts-risk-legacy-tvm', 'rts-risk-display-tampering'],
    linkedControlSetIds: [OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID],
    linkedAssessmentIds: ['rts-assessment-railway-security'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'rts-gov-incident-response',
    title: 'Railway Cyber Incident Response Plan',
    type: 'procedure' as const,
    description: 'Incident response procedures for cybersecurity events affecting railway operations, including escalation paths for safety-critical system compromise and coordination with transport safety authorities.',
    owner: 'CISO',
    reviewDate: '2025-05-01',
    nextReviewDate: '2025-11-01',
    status: 'active' as const,
    version: '2.0',
    tags: ['incident-response', 'safety', 'operations', 'escalation'],
    linkedRiskIds: ['rts-risk-signal-manipulation', 'rts-risk-emergency-notification-abuse'],
    linkedControlSetIds: [CIS_CONTROL_SET_ID],
    linkedAssessmentIds: ['rts-assessment-railway-security'],
    createdAt: NOW, updatedAt: NOW
  },
];

const threatActors = [
  {
    id: 'rts-threat-actor-nation-state', name: 'VOODOO BEAR / SANDWORM (Critical Infrastructure APT)',
    type: 'nation_state' as const, capabilityLevel: 5,
    resourceLevel: 'very_high' as const,
    motivation: 'Strategic disruption of critical transport infrastructure, pre-positioning for conflict escalation, intelligence collection on railway operations and passenger movement patterns.',
    description: 'State-sponsored advanced persistent threat group with demonstrated capability to target critical infrastructure including power grids and transport systems. Known to exploit IT/OT boundary weaknesses and industrial protocol vulnerabilities for operational disruption.',
    targetedAssetIds: ['rts-asset-train-control', 'rts-asset-signal-control', 'rts-asset-ot-firewall'],
    tags: ['apt', 'critical-infrastructure', 'transport', 'ot-targeted', 'sandworm'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'rts-threat-actor-hacktivist', name: 'Transport Disruption Hacktivist Collective',
    type: 'hacktivist' as const, capabilityLevel: 3,
    resourceLevel: 'moderate' as const,
    motivation: 'Public disruption and media attention through defacement of passenger-facing systems, false emergency alerts, and service disruption to protest transport policies or fare increases.',
    description: 'Loosely organized hacktivist group targeting public-facing transport systems for maximum visibility. Exploits legacy station equipment and unencrypted protocols to deface passenger information displays and disrupt ticketing services.',
    targetedAssetIds: ['rts-asset-platform-displays', 'rts-asset-ticket-vending', 'rts-asset-comms-network'],
    tags: ['hacktivist', 'defacement', 'disruption', 'public-facing', 'transport'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'rts-threat-actor-insider', name: 'Disgruntled Railway Operations Staff',
    type: 'insider' as const, capabilityLevel: 3,
    resourceLevel: 'moderate' as const,
    motivation: 'Sabotage of railway operations due to labor dispute, personal grievance, or financial incentive from external actors seeking operational intelligence.',
    description: 'Current or recently departed railway operations staff with legitimate knowledge of train control systems, signaling procedures, and emergency protocols. Has physical access to operations control centers and familiarity with OT system interfaces.',
    targetedAssetIds: ['rts-asset-train-control', 'rts-asset-operations-center', 'rts-asset-signal-control'],
    tags: ['insider-threat', 'physical-access', 'operations-knowledge', 'sabotage'],
    createdAt: NOW, updatedAt: NOW
  },
];

const threatScenarios = [
  {
    id: 'rts-scenario-signal-attack', title: 'Nation-State Attack on Railway Signaling Systems',
    description: 'State-sponsored APT gains initial access through a compromised corporate IT system, pivots through the data center firewall into the production zone, then traverses the OT firewall to reach the train control system. From there, the attacker manipulates signal coordination commands to the signal control system, potentially causing conflicting signal states and disabling PTC safety interlocks.',
    threatActorId: 'rts-threat-actor-nation-state',
    targetedAssetIds: ['rts-asset-signal-control', 'rts-asset-train-control'],
    attackTechniques: ['T1021 - Remote Services', 'T1071 - Application Layer Protocol', 'T0855 - Unauthorized Command Message (ICS)', 'T0831 - Manipulation of Control (ICS)'],
    linkedRiskIds: ['rts-risk-signal-manipulation', 'rts-risk-it-ot-lateral', 'rts-risk-train-control-override'],
    likelihood: 'Low — requires advanced capabilities and multi-stage attack through segmented networks, but nation-state actors have demonstrated this capability against transport infrastructure.',
    impact: 'Critical — signal system manipulation could cause train collisions, derailments, or widespread service disruption affecting millions of passengers.',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'rts-scenario-station-disruption', title: 'Hacktivist Station Infrastructure Attack',
    description: 'Hacktivist collective exploits legacy Windows 7 on ticket vending machines to gain foothold in station infrastructure, then pivots to unencrypted platform displays to inject false emergency evacuation messages, causing mass panic at crowded stations during peak hours.',
    threatActorId: 'rts-threat-actor-hacktivist',
    targetedAssetIds: ['rts-asset-ticket-vending', 'rts-asset-platform-displays'],
    attackTechniques: ['T1190 - Exploit Public-Facing Application', 'T1210 - Exploitation of Remote Services', 'T1491 - Defacement', 'T0882 - Theft of Operational Information (ICS)'],
    linkedRiskIds: ['rts-risk-legacy-tvm', 'rts-risk-display-tampering', 'rts-risk-emergency-notification-abuse'],
    likelihood: 'Moderate — legacy station equipment with known vulnerabilities provides a viable attack vector for moderately skilled attackers.',
    impact: 'Major — false emergency messages at crowded stations could trigger stampede conditions and cause injuries; ticketing disruption causes revenue loss and reputational damage.',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'rts-scenario-insider-sabotage', title: 'Insider Sabotage of Train Control Operations',
    description: 'Disgruntled operations staff with legitimate access to the operations control center uses their authorized credentials to modify train control parameters or disable safety monitoring, causing service disruption or unsafe operating conditions.',
    threatActorId: 'rts-threat-actor-insider',
    targetedAssetIds: ['rts-asset-train-control', 'rts-asset-operations-center'],
    attackTechniques: ['T1078 - Valid Accounts', 'T0836 - Modify Parameter (ICS)', 'T0831 - Manipulation of Control (ICS)', 'T0881 - Service Stop (ICS)'],
    linkedRiskIds: ['rts-risk-train-control-override', 'rts-risk-signal-manipulation'],
    likelihood: 'Moderate — insider has legitimate access and operational knowledge; dual authorization controls reduce but do not eliminate risk.',
    impact: 'Major — unauthorized train control modifications could cause service disruption, equipment damage, and potential safety incidents.',
    createdAt: NOW, updatedAt: NOW
  },
];

const appetiteRules = [
  {
    id: 'rts-appetite-safety-critical', name: 'Safety-Critical Railway Systems',
    description: 'Extremely low appetite for risks affecting train control and signaling systems due to potential for passenger casualties.',
    scopeAssetCriticalityMin: 5,
    thresholdScore: 6,
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'rts-appetite-cyber-tier', name: 'Cyber Risk Tier',
    description: 'Reduced appetite for all risks classified under the Cyber Risk tier.',
    scopeTier1: 'Cyber Risk',
    thresholdScore: 10,
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'rts-appetite-ot-domain', name: 'OT Domain',
    description: 'Strict appetite threshold for operational technology assets due to safety and service availability implications.',
    scopeAssetDomain: 'ot' as const,
    thresholdScore: 8,
    createdAt: NOW, updatedAt: NOW
  },
];

export const railwayTransportSystemGrcWorkspace = buildGrcWorkspace({
  tierCatalogue,
  assets,
  risks,
  assessments,
  soaEntries,
  workflowTasks,
  governanceDocuments,
  threatActors,
  threatScenarios,
  appetiteRules,
  securityInitiatives: [
    {
      id: 'rts-si-ot-hardening', title: 'OT Network & Signaling Security Uplift',
      description: 'Comprehensive hardening of railway operational technology networks including SCADA, signaling, and train control systems to mitigate nation-state cyber threats against safety-critical infrastructure.',
      category: 'uplift' as const, status: 'in_progress' as const, priority: 'critical' as const,
      owner: 'OT Network Security', executiveSponsor: 'VP Railway Operations',
      currentState: 'OT firewall provides basic segmentation but deep packet inspection rules are incomplete; CBTC protocol traffic is not cryptographically authenticated; IT/OT boundary allows lateral movement via data center firewall.',
      targetState: 'Unidirectional security gateway replaces bidirectional OT firewall for critical paths; CBTC protocol authentication enforced; hardware safety interlocks independent of software control; network anomaly detection operational.',
      startDate: '2025-03-01', targetDate: '2026-09-30', completedDate: '',
      milestones: [
        { id: 'rts-ms-ot-01', title: 'Deploy unidirectional security gateway at IT/OT boundary', description: 'Replace bidirectional firewall path with data diode for safety-critical traffic from operations historian to corporate IT.', status: 'completed' as const, dueDate: '2025-09-30', completedDate: '2025-08-15', owner: 'OT Network Security' },
        { id: 'rts-ms-ot-02', title: 'Implement CBTC protocol authentication', description: 'Deploy cryptographic message authentication on CBTC train control commands between operations center and wayside equipment.', status: 'in_progress' as const, dueDate: '2026-03-31', completedDate: '', owner: 'Operations Control' },
        { id: 'rts-ms-ot-03', title: 'OT network anomaly detection deployment', description: 'Deploy Claroty or Nozomi passive monitoring on OT network segments to detect protocol anomalies and unauthorized device connections.', status: 'pending' as const, dueDate: '2026-09-30', completedDate: '', owner: 'OT Network Security' },
      ],
      linkedRiskIds: ['rts-risk-signal-manipulation', 'rts-risk-train-control-override', 'rts-risk-it-ot-lateral'],
      linkedControlSetIds: [],
      linkedAssetIds: ['rts-asset-train-control', 'rts-asset-signal-control', 'rts-asset-ot-firewall'],
      linkedImplementedControlIds: ['rts-ic-ot-firewall-dpi'],
      linkedAssessmentIds: ['rts-assessment-railway-security'],
      notes: 'Aligned with IEC 62443 and EN 50129 SIL 4 requirements. Safety authority approval required for changes to signaling infrastructure.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'rts-si-station-modernization', title: 'Station Equipment Modernization & PCI Compliance',
      description: 'Upgrade legacy station equipment including ticket vending machines and passenger information displays to current operating systems and encrypted communications, achieving PCI DSS compliance for payment processing.',
      category: 'remediation' as const, status: 'approved' as const, priority: 'high' as const,
      owner: 'Station Infrastructure', executiveSponsor: 'CIO',
      currentState: 'TVMs run Windows 7 Embedded with unencrypted network communications; platform displays run Android 6.0.1 receiving content via HTTP; PCI DSS compliance gap on contactless payment terminals.',
      targetState: 'All TVMs upgraded to Windows 10 IoT Enterprise LTSC with TLS-encrypted communications; displays upgraded to current Android with HTTPS content delivery and content signing; full PCI DSS compliance achieved.',
      startDate: '2025-06-01', targetDate: '2027-03-31', completedDate: '',
      milestones: [
        { id: 'rts-ms-station-01', title: 'TVM operating system upgrade pilot', description: 'Upgrade 50 ticket vending machines at 5 pilot stations to Windows 10 IoT Enterprise LTSC with encrypted payment processing.', status: 'in_progress' as const, dueDate: '2026-06-30', completedDate: '', owner: 'Station Infrastructure' },
        { id: 'rts-ms-station-02', title: 'Platform display firmware upgrade', description: 'Deploy updated Android firmware and HTTPS content delivery to all 320 platform information displays across the network.', status: 'pending' as const, dueDate: '2027-01-31', completedDate: '', owner: 'Station Infrastructure' },
      ],
      linkedRiskIds: ['rts-risk-legacy-tvm', 'rts-risk-display-tampering', 'rts-risk-passenger-data-breach'],
      linkedControlSetIds: [],
      linkedAssetIds: ['rts-asset-ticket-vending', 'rts-asset-platform-displays'],
      linkedImplementedControlIds: ['rts-ic-physical-access'],
      linkedAssessmentIds: ['rts-assessment-railway-security'],
      notes: 'Phased rollout coordinated with maintenance windows to avoid service disruption. Budget approved for FY2025-2027.',
      createdAt: NOW, updatedAt: NOW,
    },
  ],
  implementedControls: [
    {
      id: 'rts-ic-ot-firewall-dpi', title: 'OT Network Deep Packet Inspection Firewall',
      description: 'Hirschmann EAGLE Tofino industrial firewall with deep packet inspection for Modbus, DNP3, and IEC 61850 protocols, enforcing application-layer whitelisting between IT and OT zones.',
      controlType: 'technical' as const, category: 'network_security' as const,
      status: 'active' as const, automationLevel: 'fully_automated' as const,
      owner: 'OT Network Security', vendor: 'Hirschmann (Belden)', product: 'EAGLE Tofino', version: '5.2',
      implementedDate: '2023-04-15', lastReviewDate: '2025-03-01', nextReviewDate: '2026-03-01',
      linkedSoaEntryIds: ['rts-soa-a05', 'rts-soa-cis-04'],
      linkedRiskIds: ['rts-risk-signal-manipulation', 'rts-risk-it-ot-lateral'],
      linkedAssetIds: ['rts-asset-ot-firewall', 'rts-asset-train-control', 'rts-asset-signal-control'],
      linkedAssessmentIds: ['rts-assessment-railway-security'],
      notes: 'Firmware update cycle aligned with quarterly maintenance windows. DPI rules reviewed after each protocol change.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'rts-ic-physical-access', title: 'Station Equipment Physical Access Controls',
      description: 'Kaba electronic lock system with proximity card access and audit logging for TVM service panels, signaling equipment rooms, and communications cabinets at all stations.',
      controlType: 'physical' as const, category: 'physical_security' as const,
      status: 'active' as const, automationLevel: 'semi_automated' as const,
      owner: 'Station Infrastructure', vendor: 'dormakaba', product: 'Kaba exos 9300', version: '9.3',
      implementedDate: '2022-01-10', lastReviewDate: '2025-06-01', nextReviewDate: '2026-06-01',
      linkedSoaEntryIds: ['rts-soa-a01', 'rts-soa-cis-06'],
      linkedRiskIds: ['rts-risk-legacy-tvm', 'rts-risk-display-tampering'],
      linkedAssetIds: ['rts-asset-ticket-vending', 'rts-asset-platform-displays', 'rts-asset-operations-center'],
      linkedAssessmentIds: ['rts-assessment-railway-security'],
      notes: 'Proximity cards revoked within 4 hours of personnel termination. Quarterly access review with station managers.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'rts-ic-backup-encryption', title: 'Operations Data Backup Encryption',
      description: 'Veeam Backup & Replication with AES-256 encryption for all virtualization platform backups to NetApp storage, replacing legacy unencrypted NFS backup traffic.',
      controlType: 'technical' as const, category: 'encryption' as const,
      status: 'active' as const, automationLevel: 'fully_automated' as const,
      owner: 'IT Security', vendor: 'Veeam', product: 'Backup & Replication', version: '12.1',
      implementedDate: '2025-02-01', lastReviewDate: '2025-06-01', nextReviewDate: '2026-02-01',
      linkedSoaEntryIds: ['rts-soa-a02', 'rts-soa-cis-03'],
      linkedRiskIds: ['rts-risk-backup-interception'],
      linkedAssetIds: ['rts-asset-operations-center', 'rts-asset-operations-historian'],
      linkedAssessmentIds: ['rts-assessment-railway-security'],
      notes: 'Encryption keys stored in HSM. Daily backup verification with quarterly restore testing.',
      createdAt: NOW, updatedAt: NOW,
    },
  ],
  thirdParties: [
    {
      id: 'rts-tp-siemens', name: 'Siemens Mobility', description: 'Primary signalling and train control systems vendor providing CBTC and interlocking equipment.',
      category: 'supplier' as const, status: 'active' as const, riskRating: 'critical' as const, dataClassification: 'restricted' as const,
      linkedAssetIds: ['rts-asset-train-control', 'rts-asset-signal-control'], linkedRiskIds: ['rts-risk-signal-manipulation', 'rts-risk-train-control-override'],
      contactName: 'Klaus Hoffmann', contactEmail: 'klaus.hoffmann@siemens.com',
      contractExpiry: '2031-12-31T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-06-01T00:00:00.000Z',
      notes: 'Safety-critical supplier under IEC 62278 SIL 4 certification. Firmware updates require safety authority approval. 25-year lifecycle contract.',
    },
    {
      id: 'rts-tp-thales', name: 'Thales Ground Transportation', description: 'Communications and network infrastructure vendor providing secure railway telecommunications.',
      category: 'supplier' as const, status: 'active' as const, riskRating: 'high' as const, dataClassification: 'confidential' as const,
      linkedAssetIds: ['rts-asset-comms-network', 'rts-asset-operations-center'], linkedRiskIds: ['rts-risk-it-ot-lateral', 'rts-risk-backup-interception'],
      contactName: 'Marie Dupont', contactEmail: 'marie.dupont@thalesgroup.com',
      contractExpiry: '2029-06-30T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-07-15T00:00:00.000Z',
      notes: 'GSM-R and TETRA radio systems. IT/OT convergence at operations center is primary risk area. Network segmentation audit pending.',
    },
    {
      id: 'rts-tp-scheidt', name: 'Scheidt & Bachmann', description: 'Ticketing and fare collection systems vendor providing ticket vending machines and gate systems.',
      category: 'supplier' as const, status: 'active' as const, riskRating: 'high' as const, dataClassification: 'confidential' as const,
      linkedAssetIds: ['rts-asset-ticket-vending'], linkedRiskIds: ['rts-risk-legacy-tvm', 'rts-risk-passenger-data-breach'],
      contactName: 'Thomas Weber', contactEmail: 'thomas.weber@scheidt-bachmann.com',
      contractExpiry: '2028-03-31T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-08-01T00:00:00.000Z',
      notes: 'Legacy TVMs running Windows Embedded POSReady 7. PCI DSS compliance gap on contactless payment terminals.',
    },
    {
      id: 'rts-tp-fortinet', name: 'Fortinet', description: 'OT firewall vendor providing industrial-grade network segmentation between IT and OT zones.',
      category: 'supplier' as const, status: 'active' as const, riskRating: 'medium' as const, dataClassification: 'internal' as const,
      linkedAssetIds: ['rts-asset-ot-firewall'], linkedRiskIds: ['rts-risk-it-ot-lateral'],
      contactName: 'Carlos Martinez', contactEmail: 'carlos.martinez@fortinet.com',
      contractExpiry: '2027-09-30T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-09-15T00:00:00.000Z',
      notes: 'FortiGate rugged series deployed at substations. Firmware patch cycle aligned with maintenance windows.',
    },
    {
      id: 'rts-tp-indra', name: 'Indra', description: 'Managed operations center services provider supporting 24/7 railway operations monitoring and dispatch.',
      category: 'managed_service' as const, status: 'active' as const, riskRating: 'high' as const, dataClassification: 'confidential' as const,
      linkedAssetIds: ['rts-asset-operations-center', 'rts-asset-operations-historian'], linkedRiskIds: ['rts-risk-emergency-notification-abuse', 'rts-risk-display-tampering'],
      contactName: 'Elena Garcia', contactEmail: 'elena.garcia@indracompany.com',
      contractExpiry: '2028-12-31T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-07-01T00:00:00.000Z',
      notes: 'Staffed operations center with SCADA access. Background checks and security clearances required for all operators.',
    },
  ],
});

export const railwayTransportSystem: ExampleSystem = {
  id: 'railway-transport-system',
  name: 'Metropolitan Railway Network',
  description: 'Integrated railway system with stations, ticketing, operations control, and passenger services',
  category: 'Industrial Control Systems',
  // securityLevel removed - no longer part of the system model
  primaryZone: 'OT',
  dataClassification: 'Sensitive',
  customContext: `# Metropolitan Railway Network System

## System Overview
Our metropolitan railway network serves 2.8 million passengers daily across 247 stations and 420 miles of track. The system operates 1,200 train services daily with integrated ticketing, real-time passenger information, and automated train control systems ensuring safe and efficient transportation services.

## Infrastructure Architecture

### Passenger Services Layer (Guest Zone)
- **Mobile Ticketing Platform**: Smartphone applications for ticket purchasing and journey planning
  - React Native mobile app v3.2.1 with offline capability for poor connectivity areas
  - Payment gateway integration with Stripe API v2022-11-15 for credit card processing
  - Real-time journey planning using GTFS-RT data feeds from operations control
  - Customer account management with stored payment methods and travel history
- **Station Wi-Fi Network**: Free internet access for passengers at major stations
  - Cisco Meraki MR84 access points providing guest network isolation
  - Captive portal requiring phone number verification for access authentication
  - Content filtering through OpenDNS with limited bandwidth allocation per user
  - Session timeout after 4 hours with automatic disconnection for fairness

### Station Infrastructure Layer (DMZ Zone)
- **Ticket Vending Machines**: Self-service ticket purchasing and validation systems
  - Cubic Transportation Systems S3 ticket vending machines running Windows 7 Embedded
  - EMV chip card readers for contactless payment processing
  - Real-time inventory management for ticket stock monitoring
  - Remote diagnostic capabilities for predictive maintenance scheduling
- **Platform Information Displays**: Real-time passenger information systems
  - Nexus player-based information displays running Android 6.0.1
  - CityInformation content management system for schedule and delay announcements
  - Integration with operations control for automatic delay notifications
  - Emergency messaging capability for incident communication and evacuation procedures
- **Physical Security Systems**: CCTV monitoring and access control throughout stations
  - Hikvision IP cameras with 1080p resolution and night vision capabilities
  - Axis Communications video management software v4.2 for centralized monitoring
  - HID ProxCard access control systems for staff areas with audit trail logging
  - Silent alarm systems connected to local police and security response teams

### Operations Control Layer (OT Zone)
- **Automatic Train Control**: Centralized train movement and safety control systems
  - Siemens Trainguard MT CBTC system for automated train operation and collision avoidance
  - Positive Train Control (PTC) implementation meeting federal safety mandates
  - Real-time track circuit monitoring for train location and signal system status
  - Automatic train protection systems with emergency braking capability
- **Signal Control Systems**: Traffic management and safety control for rail operations
  - GE Transportation I-ETMS (Interoperable Electronic Train Management System)
  - Wabtec Railway Electronics LOCOTROL distributed power control systems
  - Legacy relay-based interlocking systems at older stations requiring manual maintenance
  - Centralized Traffic Control (CTC) for dispatcher oversight and manual intervention capability
- **Rolling Stock Management**: Fleet monitoring and maintenance coordination systems
  - Alstom ORBITA fleet management system for real-time vehicle tracking
  - Predictive maintenance algorithms using vibration and temperature sensor data
  - Fuel management systems for diesel locomotives with automated reporting
  - Crew scheduling and dispatch systems integrated with labor management software

### IT Infrastructure Layer (Internal Zone)
- **Corporate Network**: Administrative and business operation systems
  - Microsoft Active Directory 2019 for user authentication and policy management
  - SAP ERP system for financial management, procurement, and asset tracking
  - Citrix VDI infrastructure for remote access during pandemic work arrangements
  - Microsoft Exchange Online for email and collaboration services
- **Data Center Infrastructure**: On-premises hosting for critical business applications
  - VMware vSphere 7.0 virtualization platform for server consolidation
  - NetApp FAS storage arrays with automated backup and disaster recovery
  - Cisco UCS blade servers providing compute resources for application hosting
  - F5 BIG-IP load balancers for application delivery and SSL termination
- **Customer Service Systems**: Call center and passenger assistance operations
  - Avaya Contact Center software for customer service and complaint handling
  - Salesforce CRM integration for customer interaction tracking and analytics
  - Real-time translation services for multi-language passenger support
  - Social media monitoring tools for customer feedback and service issue identification

### Cloud Services Layer (Cloud Zone)
- **Passenger Analytics Platform**: Data analytics for service optimization and passenger experience
  - Microsoft Azure Machine Learning for ridership pattern analysis and demand forecasting
  - Power BI dashboards for real-time performance monitoring and executive reporting
  - Azure Data Lake for storing historical passenger data and operational metrics
  - Predictive analytics for equipment maintenance and service disruption prevention
- **Mobile Application Backend**: Cloud-hosted services supporting mobile ticketing platform
  - AWS Lambda functions for serverless ticket validation and payment processing
  - Amazon RDS PostgreSQL for user account and transaction data storage
  - CloudFront CDN for mobile app content delivery and performance optimization
  - API Gateway for secure communication between mobile apps and backend services
- **Emergency Communication System**: Multi-channel emergency notification and coordination
  - Everbridge mass notification platform for passenger and staff emergency alerts
  - Integration with local emergency services and public safety agencies
  - Automated social media posting for service disruptions and emergency information
  - SMS and email notification systems for registered passengers and staff members

## Security and Compliance Framework

### Physical Security Measures
- **Perimeter Security**: Fencing, lighting, and intrusion detection at critical facilities
- **Access Control**: Biometric scanners and smart card systems for sensitive areas
- **Video Surveillance**: Comprehensive CCTV coverage with facial recognition capability
- **Security Personnel**: 24/7 security staff at major stations and control facilities

### Cybersecurity Controls
- **Network Segmentation**: Air-gapped separation between safety-critical and business systems
- **Endpoint Protection**: Advanced malware detection on all workstations and servers
- **Security Monitoring**: SIEM platform for threat detection and incident response
- **Regular Assessments**: Quarterly penetration testing and annual security audits

### Operational Procedures
- **Incident Response**: Established procedures for both cyber and physical security incidents
- **Business Continuity**: Backup control centers and disaster recovery capabilities
- **Staff Training**: Regular security awareness training and emergency response drills
- **Vendor Management**: Security requirements for all third-party service providers

## Recent Technology Upgrades
- **5G Network Implementation**: Enhanced mobile connectivity for real-time passenger services
- **IoT Sensor Deployment**: Predictive maintenance sensors on rolling stock and infrastructure
- **Cloud Migration**: Gradual transition of non-critical systems to cloud-hosted solutions
- **Digital Ticketing Expansion**: Contactless payment integration and mobile wallet support

## Operational Considerations
- **Peak Hour Management**: Dynamic service adjustments based on real-time passenger demand
- **Weather Response**: Automated adjustments for severe weather conditions and service delays
- **Maintenance Coordination**: Scheduled maintenance windows coordinated across all systems
- **Emergency Procedures**: Established protocols for various emergency scenarios including cybersecurity incidents`,

  nodes: [
    // Security Zones - Multi-dimensional layout to minimize edge crossings
    // Primary horizontal flow: Guest → DMZ → Internal → Production → OT
    {
      id: 'guest-zone',
      type: 'securityZone',
      position: { x: 50, y: 50 },
      data: {
        label: 'Passenger Zone',
        zoneType: 'Guest' as SecurityZone,
        description: 'Public passenger services and mobile applications',
        zone: 'Internal' as SecurityZone
      },
      style: {
        width: 600,
        height: 1000,
        background: colors.zoneBackgrounds.Guest,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'dmz-zone',
      type: 'securityZone',
      position: { x: 770, y: 50 },
      data: {
        label: 'Station Infrastructure',
        zoneType: 'DMZ' as SecurityZone,
        description: 'Station equipment and passenger interface systems'
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
        label: 'Corporate IT',
        zoneType: 'Internal' as SecurityZone,
        description: 'Business operations and administrative systems'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Internal,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'production-zone',
      type: 'securityZone',
      position: { x: 2510, y: 50 },
      data: {
        label: 'Data Center',
        zoneType: 'Production' as SecurityZone,
        description: 'On-premises production infrastructure and critical applications'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Production,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'ot-zone',
      type: 'securityZone',
      position: { x: 3380, y: 50 },
      data: {
        label: 'Operations Control',
        zoneType: 'OT' as SecurityZone,
        description: 'Railway operations and safety control systems'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.OT,
        zIndex: -1
      }
    } as SecurityNode,
    // Cloud zone positioned above Production zone to minimize edge crossings
    {
      id: 'cloud-zone',
      type: 'securityZone',
      position: { x: 2510, y: -1070 }, // Above Production zone (50 - 1000 - 120)
      data: {
        label: 'Cloud Services',
        zoneType: 'Cloud' as SecurityZone,
        description: 'Cloud-hosted analytics and passenger services'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Cloud,
        zIndex: -1
      }
    } as SecurityNode,

    // Guest Zone - Passenger Services (150-300)
    {
      id: 'mobile-app',
      type: 'application',
      position: { x: 175, y: 175 },
      data: {
        label: 'Mobile Ticketing App',
        description: 'Passenger mobile application for tickets and journey planning',
        zone: 'Guest' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        vendor: 'Custom',
        version: '3.2.1',
        technology: 'React Native',
        protocols: ['HTTPS', 'WebSocket']
      }
    } as SecurityNode,
    {
      id: 'passenger-wifi',
      type: 'gateway',
      position: { x: 125, y: 575 },
      data: {
        label: 'Station Wi-Fi',
        description: 'Public Wi-Fi access points in stations',
        zone: 'Guest' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        vendor: 'Cisco',
        product: 'Meraki MR84',
        version: '28.7',
        protocols: ['802.11ac', 'WPA2'],
        securityControls: ['Captive portal', 'Guest isolation']
      }
    } as SecurityNode,

    // Guest Zone Applications (350-600)
    {
      id: 'journey-planner',
      type: 'api',
      position: { x: 225, y: 725 },
      data: {
        label: 'Journey Planning API',
        description: 'Real-time journey planning and schedule information',
        zone: 'Guest' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        vendor: 'Google',
        product: 'Transit API',
        version: '1.0',
        protocols: ['REST API', 'GTFS-RT']
      }
    } as SecurityNode,

    // DMZ Zone - Station Infrastructure (150-300)
    {
      id: 'station-firewall',
      type: 'firewall',
      position: { x: 1025, y: 225 },
      data: {
        label: 'Station Network Firewall',
        description: 'Network security for station infrastructure',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        vendor: 'Fortinet',
        product: 'FortiGate',
        version: '7.0.5',
        protocols: ['any'],
        securityControls: ['IPS', 'Application control']
      }
    } as SecurityNode,

    // DMZ Zone Applications (350-600)
    {
      id: 'ticket-vending',
      type: 'application',
      position: { x: 825, y: 425 },
      data: {
        label: 'Ticket Vending Machines',
        description: 'Self-service ticket purchasing terminals',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        vendor: 'Cubic Transportation',
        product: 'S3 TVM',
        version: '4.1.2',
        technology: 'Windows 7 Embedded',  // Legacy OS vulnerability
        protocols: ['EMV', 'TCP/IP'],
        securityControls: ['PCI DSS compliance']
      }
    } as SecurityNode,
    {
      id: 'platform-displays',
      type: 'application',
      position: { x: 1125, y: 425 },
      data: {
        label: 'Platform Information Displays',
        description: 'Real-time passenger information screens',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        vendor: 'Nexus',
        version: '2.8.1',
        technology: 'Android 6.0.1',  // Outdated Android version
        protocols: ['HTTP', 'RTSP']
      }
    } as SecurityNode,
    {
      id: 'physical-security',
      type: 'monitor',
      position: { x: 975, y: 525 },
      data: {
        label: 'Physical Security System',
        description: 'CCTV monitoring and access control',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'Hikvision',
        product: 'iVMS-4200',
        version: '3.6.1',
        protocols: ['ONVIF', 'RTSP'],
        securityControls: ['Access control', 'Video analytics']
      }
    } as SecurityNode,

    // DMZ Zone Data (650-850)
    {
      id: 'station-database',
      type: 'database',
      position: { x: 975, y: 725 },
      data: {
        label: 'Station Operations Database',
        description: 'Local station data and passenger information',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        vendor: 'SQLite',
        version: '3.36.0',
        protocols: ['SQLite'],
        technology: 'Embedded database'
      }
    } as SecurityNode,

    // Internal Zone Infrastructure (150-300)
    {
      id: 'corporate-firewall',
      type: 'firewall',
      position: { x: 1875, y: 175 },
      data: {
        label: 'Corporate Firewall',
        description: 'Enterprise network perimeter security',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        vendor: 'Palo Alto',
        product: 'PA-5220',
        version: '10.1.6',
        protocols: ['any'],
        securityControls: ['Threat prevention', 'URL filtering']
      }
    } as SecurityNode,
    {
      id: 'domain-controller',
      type: 'server',
      position: { x: 2225, y: 325 },
      data: {
        label: 'Domain Controller',
        description: 'Active Directory authentication services',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'Microsoft',
        product: 'Windows Server',
        version: '2019',
        protocols: ['Kerberos', 'LDAP'],
        securityControls: ['Group Policy', 'Certificate Services']
      }
    } as SecurityNode,

    // Internal Zone Applications (350-600)
    {
      id: 'erp-system',
      type: 'application',
      position: { x: 1675, y: 475 },
      data: {
        label: 'ERP System',
        description: 'Enterprise resource planning and financial management',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'SAP',
        product: 'S/4HANA',
        version: '2021',
        protocols: ['RFC', 'HTTPS'],
        securityControls: ['Role-based access']
      }
    } as SecurityNode,
    {
      id: 'customer-service',
      type: 'application',
      position: { x: 2175, y: 475 },
      data: {
        label: 'Customer Service System',
        description: 'Call center and customer relationship management',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        vendor: 'Salesforce',
        version: 'Lightning',
        protocols: ['HTTPS', 'REST API'],
        securityControls: ['OAuth 2.0']
      }
    } as SecurityNode,

    // Internal Zone Data (650-850)
    {
      id: 'corporate-database',
      type: 'database',
      position: { x: 1875, y: 725 },
      data: {
        label: 'Corporate Database',
        description: 'Business operations and employee data',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'Microsoft',
        product: 'SQL Server',
        version: '2019',
        protocols: ['TDS'],
        securityControls: ['TDE', 'Always Encrypted']
      }
    } as SecurityNode,

    // Production Zone Infrastructure (150-300)
    {
      id: 'datacenter-firewall',
      type: 'firewall',
      position: { x: 2725, y: 175 },
      data: {
        label: 'Data Center Firewall',
        description: 'Production infrastructure protection',
        zone: 'Production' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'Cisco',
        product: 'Firepower',
        version: '7.2.1',
        protocols: ['any'],
        securityControls: ['Advanced malware protection', 'IPS']
      }
    } as SecurityNode,
    {
      id: 'load-balancer',
      type: 'loadBalancer',
      position: { x: 2875, y: 275 },
      data: {
        label: 'Application Load Balancer',
        description: 'High availability application delivery',
        zone: 'Production' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        vendor: 'F5',
        product: 'BIG-IP',
        version: '16.1.2',
        protocols: ['HTTP/HTTPS', 'TCP'],
        securityControls: ['SSL termination', 'WAF']
      }
    } as SecurityNode,

    // Production Zone Applications (350-600)
    {
      id: 'virtualization',
      type: 'server',
      position: { x: 2575, y: 425 },
      data: {
        label: 'Virtualization Platform',
        description: 'VMware infrastructure hosting critical applications',
        zone: 'Production' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        vendor: 'VMware',
        product: 'vSphere',
        version: '7.0.3',
        protocols: ['HTTPS', 'SSH'],
        securityControls: ['VM encryption', 'Network microsegmentation']
      }
    } as SecurityNode,
    {
      id: 'backup-system',
      type: 'storage',
      position: { x: 2875, y: 525 },
      data: {
        label: 'Backup Storage',
        description: 'Enterprise backup and disaster recovery',
        zone: 'Production' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'NetApp',
        product: 'FAS',
        version: '9.11.1',
        protocols: ['NFS', 'iSCSI'],
        securityControls: ['Encryption at rest', 'Snapshots']
      }
    } as SecurityNode,

    // Production Zone Data (650-850)
    {
      id: 'production-database',
      type: 'database',
      position: { x: 2725, y: 725 },
      data: {
        label: 'Production Database Cluster',
        description: 'High-availability operational data storage',
        zone: 'Production' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'Oracle',
        product: 'RAC',
        version: '19c',
        protocols: ['Oracle Net'],
        securityControls: ['TDE', 'Data Guard', 'Audit Vault']
      }
    } as SecurityNode,

    // OT Zone Infrastructure (150-300)
    {
      id: 'ot-firewall',
      type: 'industrialFirewall',
      position: { x: 3625, y: 175 },
      data: {
        label: 'OT Network Firewall',
        description: 'Industrial control system protection',
        zone: 'OT' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'Hirschmann',
        product: 'EAGLE Tofino',
        version: '5.2.1',
        protocols: ['Modbus', 'DNP3', 'IEC61850'],
        securityControls: ['Protocol deep packet inspection', 'Whitelisting']
      }
    } as SecurityNode,

    // OT Zone Applications (350-600)
    {
      id: 'train-control',
      type: 'scadaServer',
      position: { x: 3475, y: 375 },
      data: {
        label: 'Automatic Train Control',
        description: 'Centralized train movement and safety control',
        zone: 'OT' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'Siemens',
        product: 'Trainguard MT',
        version: '2.1.3',
        protocols: ['CBTC', 'Eurobalise'],
        securityControls: ['Safety integrity level 4']
      }
    } as SecurityNode,
    {
      id: 'signal-control',
      type: 'plc',
      position: { x: 3775, y: 425 },
      data: {
        label: 'Signal Control System',
        description: 'Railway signal and interlocking control',
        zone: 'OT' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'GE Transportation',
        product: 'I-ETMS',
        version: '6.2.1',
        protocols: ['PTC', 'ACSES'],
        technology: 'Positive Train Control'
      }
    } as SecurityNode,
    {
      id: 'fleet-management',
      type: 'application',
      position: { x: 3475, y: 875 },
      data: {
        label: 'Fleet Management System',
        description: 'Rolling stock monitoring and maintenance',
        zone: 'OT' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        vendor: 'Alstom',
        product: 'ORBITA',
        version: '4.3.2',
        protocols: ['TETRA', 'GSM-R'],
        securityControls: ['Predictive maintenance']
      }
    } as SecurityNode,

    // OT Zone Data (650-850)
    {
      id: 'operations-historian',
      type: 'historian',
      position: { x: 3975, y: 675 },
      data: {
        label: 'Operations Historian',
        description: 'Railway operations data and performance metrics',
        zone: 'OT' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        vendor: 'OSIsoft',
        product: 'PI System',
        version: '2018 SP3',
        protocols: ['OPC-UA', 'PI-API'],
        securityControls: ['Data compression', 'Archive']
      }
    } as SecurityNode,

    // Cloud Zone Infrastructure (positioned above Production zone)
    {
      id: 'cloud-gateway',
      type: 'apiGateway',
      position: { x: 2675, y: -875 }, // Infrastructure tier in cloud zone
      data: {
        label: 'Cloud API Gateway',
        description: 'Secure API access to cloud services',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        vendor: 'AWS',
        product: 'API Gateway',
        version: '2.0',
        protocols: ['HTTPS', 'REST'],
        securityControls: ['OAuth 2.0', 'Rate limiting']
      }
    } as SecurityNode,

    // Cloud Zone Applications
    {
      id: 'analytics-platform',
      type: 'ai',
      position: { x: 2575, y: -625 }, // Application tier in cloud zone
      data: {
        label: 'Passenger Analytics',
        description: 'AI-powered ridership analysis and forecasting',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        vendor: 'Microsoft',
        product: 'Azure ML',
        version: '2.0',
        protocols: ['HTTPS', 'gRPC'],
        technology: 'Machine learning pipeline'
      }
    } as SecurityNode,
    {
      id: 'mobile-backend',
      type: 'apiGateway',
      position: { x: 3075, y: -975 }, // Application tier in cloud zone
      data: {
        label: 'Mobile App Backend',
        description: 'Cloud services for mobile ticketing application',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        vendor: 'AWS',
        product: 'Lambda',
        version: '1.0',
        protocols: ['HTTPS', 'WebSocket'],
        securityControls: ['JWT tokens', 'API throttling']
      }
    } as SecurityNode,
    {
      id: 'emergency-notification',
      type: 'service',
      position: { x: 2725, y: -525 }, // Application tier in cloud zone
      data: {
        label: 'Emergency Notification',
        description: 'Mass notification system for emergencies',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        vendor: 'Everbridge',
        version: '2023.1',
        protocols: ['HTTPS', 'SMS', 'Email'],
        securityControls: ['Multi-channel delivery']
      }
    } as SecurityNode,

    // Cloud Zone Data
    {
      id: 'cloud-database',
      type: 'cloudDatabase',
      position: { x: 3025, y: -275 }, // Data tier in cloud zone
      data: {
        label: 'Cloud Data Warehouse',
        description: 'Analytics data storage and processing',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        vendor: 'AWS',
        product: 'Redshift',
        version: '1.0.45',
        protocols: ['PostgreSQL'],
        securityControls: ['Encryption at rest', 'VPC isolation']
      }
    } as SecurityNode
  ],

  edges: [
    // Guest to DMZ connections
    {
      id: 'mobile-to-firewall',
      source: 'mobile-app',
      target: 'station-firewall',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Mobile App Traffic',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'wifi-to-firewall',
      source: 'passenger-wifi',
      target: 'station-firewall',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Guest Network Traffic',
        protocol: 'TCP/IP',
        encryption: 'WPA2',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'journey-to-firewall',
      source: 'journey-planner',
      target: 'station-firewall',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Journey Planning API',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,

    // DMZ internal connections
    {
      id: 'firewall-to-tvm',
      source: 'station-firewall',
      target: 'ticket-vending',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'TVM Network Access',
        protocol: 'TCP/IP',
        encryption: 'none',  // Vulnerability: legacy TVM communications
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'firewall-to-displays',
      source: 'station-firewall',
      target: 'platform-displays',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Display Content',
        protocol: 'HTTP',
        encryption: 'none',  // Vulnerability: unencrypted display updates
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'security-to-db',
      source: 'physical-security',
      target: 'station-database',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Security Event Logging',
        protocol: 'SQLite',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,

    // DMZ to Internal connections
    {
      id: 'station-to-corporate-fw',
      source: 'station-firewall',
      target: 'corporate-firewall',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Corporate Network Access',
        protocol: 'TCP/IP',
        encryption: 'IPSec',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,

    // Internal zone connections
    {
      id: 'corporate-fw-to-dc',
      source: 'corporate-firewall',
      target: 'domain-controller',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Authentication Services',
        protocol: 'Kerberos/LDAP',
        encryption: 'Kerberos',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'erp-to-db',
      source: 'erp-system',
      target: 'corporate-database',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Business Data',
        protocol: 'TDS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'customer-to-db',
      source: 'customer-service',
      target: 'corporate-database',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Customer Data',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,

    // Internal to Production connections
    {
      id: 'corporate-to-datacenter-fw',
      source: 'corporate-firewall',
      target: 'datacenter-firewall',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Data Center Access',
        protocol: 'TCP/IP',
        encryption: 'IPSec',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Production' as SecurityZone
      }
    } as SecurityEdge,

    // Production zone connections
    {
      id: 'datacenter-fw-to-lb',
      source: 'datacenter-firewall',
      target: 'load-balancer',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Application Traffic',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Production' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'lb-to-vm',
      source: 'load-balancer',
      target: 'virtualization',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Application Hosting',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Production' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'vm-to-backup',
      source: 'virtualization',
      target: 'backup-system',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Backup Operations',
        protocol: 'NFS',
        encryption: 'none',  // Vulnerability: unencrypted backup traffic
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Production' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'vm-to-prod-db',
      source: 'virtualization',
      target: 'production-database',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Application Database',
        protocol: 'Oracle Net',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Production' as SecurityZone
      }
    } as SecurityEdge,

    // Production to OT connections
    {
      id: 'datacenter-to-ot-fw',
      source: 'datacenter-firewall',
      target: 'ot-firewall',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'IT/OT Interface',
        protocol: 'TCP/IP',
        encryption: 'IPSec',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'OT' as SecurityZone
      }
    } as SecurityEdge,

    // OT zone connections
    {
      id: 'ot-fw-to-train-control',
      source: 'ot-firewall',
      target: 'train-control',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Train Control Access',
        protocol: 'CBTC',
        encryption: 'AES',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'OT' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'train-to-signal',
      source: 'train-control',
      target: 'signal-control',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Signal Coordination',
        protocol: 'PTC',
        encryption: 'AES',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'OT' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'fleet-to-historian',
      source: 'fleet-management',
      target: 'operations-historian',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Fleet Data',
        protocol: 'OPC-UA',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'OT' as SecurityZone
      }
    } as SecurityEdge,

    // Production to Cloud connections (vertical connection to zone above)
    {
      id: 'datacenter-to-cloud-gw',
      source: 'datacenter-firewall',
      target: 'cloud-gateway',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Cloud Service Access',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,

    // Cloud zone connections
    {
      id: 'cloud-gw-to-analytics',
      source: 'cloud-gateway',
      target: 'analytics-platform',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Analytics API',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'mobile-backend-to-db',
      source: 'mobile-backend',
      target: 'cloud-database',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Mobile App Data',
        protocol: 'PostgreSQL',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'emergency-to-mobile',
      source: 'emergency-notification',
      target: 'mobile-backend',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Emergency Alerts',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,

    // Cross-zone data flows (long-distance connections)
    {
      id: 'mobile-app-to-backend',
      source: 'mobile-app',
      target: 'mobile-backend',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        controlPoints: [{ id: 'cp-1771643785844', x: 200, y: -950, active: true }],
        label: 'App Backend API',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'historian-to-analytics',
      source: 'operations-historian',
      target: 'analytics-platform',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Operations Data Feed',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'displays-to-emergency',
      source: 'platform-displays',
      target: 'emergency-notification',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Emergency Display Control',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge
  ],

  grcWorkspace: railwayTransportSystemGrcWorkspace,

  attackPaths: [
    {
      id: 'rts-ap-it-to-signal',
      name: 'IT Network → OT Lateral Movement → Signal Manipulation',
      strideCategory: 'Tampering' as StrideCategory,
      riskLevel: 'Critical' as AttackPathRiskLevel,
      description: 'An attacker compromises a corporate IT system, pivots through the data center firewall and OT firewall into the operations control zone, reaches the automatic train control system, and manipulates signal coordination to create hazardous signaling states or disable PTC safety interlocks.',
      steps: [
        { order: 1, edgeId: 'corporate-to-datacenter-fw', sourceNodeId: 'corporate-firewall', targetNodeId: 'datacenter-firewall', technique: 'T1021: Remote Services' },
        { order: 2, edgeId: 'datacenter-to-ot-fw', sourceNodeId: 'datacenter-firewall', targetNodeId: 'ot-firewall', technique: 'T1071: Application Layer Protocol' },
        { order: 3, edgeId: 'ot-fw-to-train-control', sourceNodeId: 'ot-firewall', targetNodeId: 'train-control', technique: 'T0855: Unauthorized Command Message (ICS)' },
        { order: 4, edgeId: 'train-to-signal', sourceNodeId: 'train-control', targetNodeId: 'signal-control', technique: 'T0831: Manipulation of Control (ICS)' },
      ],
      mitreTechniques: ['T1021', 'T1071', 'T0855', 'T0831'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'rts-ap-cloud-to-data',
      name: 'Cloud Backend Compromise → Passenger Data Exfiltration',
      strideCategory: 'Information Disclosure' as StrideCategory,
      riskLevel: 'High' as AttackPathRiskLevel,
      description: 'An attacker exploits the cloud API gateway to access the mobile app backend, then exfiltrates passenger payment data and travel history from the cloud data warehouse, resulting in mass PII exposure subject to GDPR and PCI DSS regulatory action.',
      steps: [
        { order: 1, edgeId: 'datacenter-to-cloud-gw', sourceNodeId: 'datacenter-firewall', targetNodeId: 'cloud-gateway', technique: 'T1190: Exploit Public-Facing Application' },
        { order: 2, edgeId: 'emergency-to-mobile', sourceNodeId: 'cloud-gateway', targetNodeId: 'mobile-backend', technique: 'T1078: Valid Accounts' },
        { order: 3, edgeId: 'mobile-backend-to-db', sourceNodeId: 'mobile-backend', targetNodeId: 'cloud-database', technique: 'T1530: Data from Cloud Storage' },
      ],
      mitreTechniques: ['T1190', 'T1078', 'T1530'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'rts-ap-station-disruption',
      name: 'Station Equipment Exploit → Display Manipulation → False Emergency',
      strideCategory: 'Denial of Service' as StrideCategory,
      riskLevel: 'High' as AttackPathRiskLevel,
      description: 'An attacker exploits unencrypted TVM network communications through the station firewall, pivots to platform information displays receiving unencrypted HTTP content, and injects false emergency evacuation messages via the emergency notification integration, causing mass panic at crowded stations.',
      steps: [
        { order: 1, edgeId: 'firewall-to-tvm', sourceNodeId: 'station-firewall', targetNodeId: 'ticket-vending', technique: 'T1210: Exploitation of Remote Services' },
        { order: 2, edgeId: 'firewall-to-displays', sourceNodeId: 'station-firewall', targetNodeId: 'platform-displays', technique: 'T1491: Defacement' },
        { order: 3, edgeId: 'displays-to-emergency', sourceNodeId: 'platform-displays', targetNodeId: 'emergency-notification', technique: 'T0882: Theft of Operational Information (ICS)' },
      ],
      mitreTechniques: ['T1210', 'T1491', 'T0882'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'rts-ap-historian-exfil',
      name: 'Operations Data Exfiltration via Historian to Cloud Analytics',
      strideCategory: 'Information Disclosure' as StrideCategory,
      riskLevel: 'Medium' as AttackPathRiskLevel,
      description: 'An attacker who has compromised the operations historian exploits the data feed to the cloud analytics platform to exfiltrate sensitive railway operations data including train schedules, fleet telemetry, and performance metrics that could be used to plan physical attacks or competitive intelligence.',
      steps: [
        { order: 1, edgeId: 'fleet-to-historian', sourceNodeId: 'fleet-management', targetNodeId: 'operations-historian', technique: 'T0802: Automated Collection (ICS)' },
        { order: 2, edgeId: 'historian-to-analytics', sourceNodeId: 'operations-historian', targetNodeId: 'analytics-platform', technique: 'T1041: Exfiltration Over C2 Channel' },
        { order: 3, edgeId: 'cloud-gw-to-analytics', sourceNodeId: 'cloud-gateway', targetNodeId: 'analytics-platform', technique: 'T1537: Transfer Data to Cloud Account' },
      ],
      mitreTechniques: ['T0802', 'T1041', 'T1537'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
  ]
};