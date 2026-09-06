/**
 * Electric Grid System - Critical Infrastructure
 *
 * This system demonstrates the complex architecture of an electrical grid control system
 * with multiple substations, SCADA infrastructure, and IT/OT trust boundaries.
 * Contains realistic vulnerabilities in industrial control systems.
 */

import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityNode, SecurityEdge, SecurityZone } from '../../types/SecurityTypes';
import { DiagramAttackPath, AssessmentThreatModelNodeSourceType, AssessmentThreatModelEdgeSourceType, AttackPathRiskLevel } from '../../types/GrcTypes';
import { colors } from '../../styles/Theme';
import { buildGrcWorkspace, score, NOW, OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID } from './grcSharedBase';
import { StrideCategory } from '../../types/ThreatIntelTypes';
const tierCatalogue = [
  { id: 'egs-tier1-cyber', tier: 1 as const, label: 'Cyber Risk', description: 'Cyber threats targeting electric grid SCADA, EMS, and IT infrastructure' },
  { id: 'egs-tier1-operational', tier: 1 as const, label: 'Operational Risk', description: 'Grid reliability, safety, and power delivery continuity risks' },
  { id: 'egs-tier1-regulatory', tier: 1 as const, label: 'Regulatory Risk', description: 'NERC CIP compliance and regulatory enforcement risks' },
  { id: 'egs-tier2-scada-security', tier: 2 as const, label: 'SCADA/EMS Security', parentId: 'egs-tier1-cyber', description: 'Control system security for SCADA master, EMS, and HMI' },
  { id: 'egs-tier2-field-device', tier: 2 as const, label: 'Field Device Security', parentId: 'egs-tier1-cyber', description: 'RTU, relay, and PMU firmware and protocol security' },
  { id: 'egs-tier2-network-segmentation', tier: 2 as const, label: 'Network Segmentation', parentId: 'egs-tier1-cyber', description: 'IT/OT boundary and zone segmentation controls' },
  { id: 'egs-tier2-identity', tier: 2 as const, label: 'Identity & Access', parentId: 'egs-tier1-cyber', description: 'Authentication and authorization for grid control systems' },
  { id: 'egs-tier2-grid-stability', tier: 2 as const, label: 'Grid Stability', parentId: 'egs-tier1-operational', description: 'Power generation, transmission, and distribution reliability' },
  { id: 'egs-tier2-protection-systems', tier: 2 as const, label: 'Protection Systems', parentId: 'egs-tier1-operational', description: 'Relay protection and automatic load shedding integrity' },
  { id: 'egs-tier2-nerc-cip', tier: 2 as const, label: 'NERC CIP Compliance', parentId: 'egs-tier1-regulatory', description: 'NERC CIP standards compliance for bulk electric system' },
  { id: 'egs-tier3-dnp3-protocol', tier: 3 as const, label: 'DNP3 Protocol Vulnerabilities', parentId: 'egs-tier2-scada-security' },
  { id: 'egs-tier3-hmi-exposure', tier: 3 as const, label: 'HMI/OPC Exposure', parentId: 'egs-tier2-scada-security' },
  { id: 'egs-tier3-relay-firmware', tier: 3 as const, label: 'Relay Firmware Exploits', parentId: 'egs-tier2-field-device' },
  { id: 'egs-tier3-legacy-os', tier: 3 as const, label: 'Legacy OS in Field Devices', parentId: 'egs-tier2-field-device' },
  { id: 'egs-tier3-it-ot-boundary', tier: 3 as const, label: 'IT/OT Convergence Gaps', parentId: 'egs-tier2-network-segmentation' },
  { id: 'egs-tier3-shared-maintenance', tier: 3 as const, label: 'Shared Maintenance Credentials', parentId: 'egs-tier2-identity' },
  { id: 'egs-tier4-dnp3-auth-hardening', tier: 4 as const, label: 'DNP3 Secure Authentication Enforcement', parentId: 'egs-tier3-dnp3-protocol' },
  { id: 'egs-tier4-opc-encryption', tier: 4 as const, label: 'OPC UA Migration from OPC DA', parentId: 'egs-tier3-hmi-exposure' },
  { id: 'egs-tier4-relay-patching', tier: 4 as const, label: 'Relay Firmware Patch Management', parentId: 'egs-tier3-relay-firmware' },
  { id: 'egs-tier4-xp-migration', tier: 4 as const, label: 'Windows XP Embedded Decommission', parentId: 'egs-tier3-legacy-os' },
];

const assets = [
  {
    id: 'egs-asset-scada-master', name: 'ABB Network Manager SCADA Master', type: 'scada_server', owner: 'Grid Operations',
    domain: 'ot' as const, category: 'Control System',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Primary SCADA master station controlling 47 substations via DNP3 and IEC 61850',
    criticality: { confidentiality: 4, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 5 },
    diagramRefs: [{ diagramId: 'electric-grid-system', nodeId: 'scada-master', nodeLabel: 'SCADA Master Station', nodeType: 'scadaServer' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'egs-asset-rtu', name: 'ABB RTU560 Remote Terminal Units', type: 'rtu', owner: 'Field Engineering',
    domain: 'ot' as const, category: 'Field Device',
    businessCriticality: 5, securityCriticality: 4,
    description: 'Remote terminal units deployed at primary substations for real-time monitoring and control via DNP3',
    criticality: { confidentiality: 3, integrity: 5, availability: 5, financial: 4, reputation: 4, safety: 5 },
    diagramRefs: [{ diagramId: 'electric-grid-system', nodeId: 'primary-substation', nodeLabel: 'Primary Substation RTU', nodeType: 'rtu' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'egs-asset-distribution-sub', name: 'Siemens SICAM PAS Distribution Substations', type: 'rtu', owner: 'Distribution Engineering',
    domain: 'ot' as const, category: 'Field Device',
    businessCriticality: 4, securityCriticality: 4,
    description: 'Distribution substation automation running on Windows XP Embedded with IEC 61850 and Modbus',
    criticality: { confidentiality: 3, integrity: 5, availability: 5, financial: 4, reputation: 3, safety: 4 },
    diagramRefs: [{ diagramId: 'electric-grid-system', nodeId: 'distribution-substation', nodeLabel: 'Distribution Substation', nodeType: 'rtu' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'egs-asset-ems', name: 'GE ADMS Energy Management System', type: 'application', owner: 'Grid Operations',
    domain: 'ot' as const, category: 'Control System',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Advanced distribution management system for grid analysis, load flow, and contingency planning',
    criticality: { confidentiality: 4, integrity: 5, availability: 5, financial: 5, reputation: 4, safety: 4 },
    diagramRefs: [{ diagramId: 'electric-grid-system', nodeId: 'ems-server', nodeLabel: 'Energy Management System', nodeType: 'application' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'egs-asset-historian', name: 'OSIsoft PI Server Historian', type: 'historian', owner: 'Grid Operations',
    domain: 'ot' as const, category: 'Data System',
    businessCriticality: 4, securityCriticality: 4,
    description: 'Control system historian storing 5 years of operational data with OPC-UA and PI-API interfaces',
    criticality: { confidentiality: 4, integrity: 4, availability: 3, financial: 3, reputation: 3, safety: 2 },
    diagramRefs: [{ diagramId: 'electric-grid-system', nodeId: 'control-historian', nodeLabel: 'Control System Historian', nodeType: 'historian' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'egs-asset-protection-relay', name: 'SEL-451 Protection Relays', type: 'plc', owner: 'Protection Engineering',
    domain: 'ot' as const, category: 'Safety System',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Transmission line protection relays using DNP3 Secure Authentication and GOOSE messaging',
    criticality: { confidentiality: 3, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 5 },
    diagramRefs: [{ diagramId: 'electric-grid-system', nodeId: 'protection-relay', nodeLabel: 'Protection Relay', nodeType: 'plc' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'egs-asset-ami', name: 'Advanced Metering Infrastructure', type: 'sensor', owner: 'Metering Operations',
    domain: 'ot' as const, category: 'IoT Infrastructure',
    businessCriticality: 3, securityCriticality: 3,
    description: 'Smart meter network with PMUs for synchrophasor measurement and demand response',
    criticality: { confidentiality: 3, integrity: 4, availability: 3, financial: 3, reputation: 3, safety: 2 },
    diagramRefs: [{ diagramId: 'electric-grid-system', nodeId: 'pmu-sensor', nodeLabel: 'Phasor Measurement Unit', nodeType: 'sensor' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'egs-asset-corporate-it', name: 'Corporate IT Infrastructure', type: 'network_device', owner: 'IT Operations',
    domain: 'it' as const, category: 'Network Infrastructure',
    businessCriticality: 3, securityCriticality: 4,
    description: 'Corporate network including Active Directory, Oracle 11g database, and engineering workstations',
    criticality: { confidentiality: 4, integrity: 3, availability: 3, financial: 3, reputation: 3, safety: 1 },
    diagramRefs: [
      { diagramId: 'electric-grid-system', nodeId: 'domain-controller', nodeLabel: 'Domain Controller', nodeType: 'server' },
      { diagramId: 'electric-grid-system', nodeId: 'corporate-database', nodeLabel: 'Corporate Database', nodeType: 'database' },
    ],
    createdAt: NOW, updatedAt: NOW
  },
];

const risks = [
  {
    id: 'egs-risk-scada-protocol', title: 'Unencrypted SCADA Protocol Communications',
    description: 'OPC DA traffic between SCADA master and operator HMI is transmitted without encryption. GOOSE messaging on the field network lacks authentication. An attacker with OT network access can eavesdrop on control commands and inject false measurements.',
    status: 'assessed' as const, owner: 'Grid Operations',
    tierPath: { tier1: 'Cyber Risk', tier2: 'SCADA/EMS Security', tier3: 'HMI/OPC Exposure' },
    assetIds: ['egs-asset-scada-master', 'egs-asset-protection-relay'],
    diagramLinks: [{ diagramId: 'electric-grid-system', nodeIds: ['scada-master', 'operator-hmi', 'protection-relay', 'field-switch'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Migrate HMI communications from OPC DA to OPC UA with TLS; deploy IEC 62351 for GOOSE authentication',
    threatActorIds: ['egs-threat-actor-nation-state'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'egs-risk-relay-firmware', title: 'Protection Relay Firmware Exploitation',
    description: 'SEL-451 relays and ABB REL670 relays run firmware versions with known vulnerabilities. Exploitation could disable transmission line protection, enabling cascading failures during fault conditions.',
    status: 'assessed' as const, owner: 'Protection Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Field Device Security', tier3: 'Relay Firmware Exploits' },
    assetIds: ['egs-asset-protection-relay'],
    diagramLinks: [{ diagramId: 'electric-grid-system', nodeIds: ['protection-relay', 'field-switch'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Schedule firmware updates during maintenance windows; deploy virtual patching via industrial IDS',
    threatActorIds: ['egs-threat-actor-nation-state'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'egs-risk-it-ot-convergence', title: 'IT/OT Convergence Boundary Weaknesses',
    description: 'The IT network firewall connects to the OT network firewall via IPSec, but the engineering workstation has dual-homed access to both domains. A compromised engineering workstation enables lateral movement from corporate IT into the critical control zone.',
    status: 'assessed' as const, owner: 'IT Security',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Network Segmentation', tier3: 'IT/OT Convergence Gaps' },
    assetIds: ['egs-asset-corporate-it', 'egs-asset-scada-master'],
    diagramLinks: [{ diagramId: 'electric-grid-system', nodeIds: ['it-firewall', 'ot-firewall', 'engineering-workstation', 'scada-master'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Implement jump server architecture; enforce strict one-way data flows between IT and OT zones',
    threatActorIds: ['egs-threat-actor-insider'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'egs-risk-ami-manipulation', title: 'AMI Smart Meter Data Manipulation',
    description: 'Phasor measurement units transmit synchrophasor data using IEEE C37.118 without encryption. Spoofed or manipulated PMU data could mislead state estimation algorithms, causing operators to make incorrect grid control decisions.',
    status: 'draft' as const, owner: 'Metering Operations',
    tierPath: { tier1: 'Operational Risk', tier2: 'Grid Stability' },
    assetIds: ['egs-asset-ami', 'egs-asset-rtu'],
    diagramLinks: [{ diagramId: 'electric-grid-system', nodeIds: ['pmu-sensor', 'primary-substation'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Deploy IEEE C37.118.2 with authentication; implement PMU data validation at the EMS level',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'egs-risk-legacy-os', title: 'Windows XP Embedded in Distribution Substations',
    description: 'Distribution substations running Siemens SICAM PAS on Windows XP Embedded are unpatched and vulnerable to known exploits. Default maintenance passwords remain on several units.',
    status: 'assessed' as const, owner: 'Distribution Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Field Device Security', tier3: 'Legacy OS in Field Devices' },
    assetIds: ['egs-asset-distribution-sub'],
    diagramLinks: [{ diagramId: 'electric-grid-system', nodeIds: ['distribution-substation', 'field-maintenance'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Accelerate migration to Windows 10 LTSC; deploy application whitelisting as interim control',
    threatActorIds: ['egs-threat-actor-hacktivist'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'egs-risk-shared-maintenance', title: 'Shared Maintenance Account on Field Laptops',
    description: 'Field maintenance laptops use a shared local account for substation access without individual accountability. Lost or compromised laptops provide direct access to distribution substation configuration.',
    status: 'draft' as const, owner: 'Field Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Identity & Access', tier3: 'Shared Maintenance Credentials' },
    assetIds: ['egs-asset-distribution-sub'],
    diagramLinks: [{ diagramId: 'electric-grid-system', nodeIds: ['field-maintenance', 'distribution-substation'] }],
    inherentScore: score('likelihood-4', 'impact-3'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Deploy individual authentication tokens for field laptops; enable audit logging on all substation access',
    threatActorIds: ['egs-threat-actor-insider'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'egs-risk-historian-proxy', title: 'Historian Proxy Data Exposure in DMZ',
    description: 'The OSIsoft PI historian proxy in the DMZ aggregates confidential operational data. The proxy runs an older PI System version (2018 SP3) with known vulnerabilities, and the unencrypted SQL connection to the compliance database exposes data in transit.',
    status: 'assessed' as const, owner: 'Grid Operations',
    tierPath: { tier1: 'Cyber Risk', tier2: 'SCADA/EMS Security', tier3: 'DNP3 Protocol Vulnerabilities' },
    assetIds: ['egs-asset-historian'],
    diagramLinks: [{ diagramId: 'electric-grid-system', nodeIds: ['historian-proxy', 'compliance-db', 'control-historian'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Upgrade PI System to current version; enable TLS on compliance database connection',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'egs-risk-rto-market-compromise', title: 'RTO Market Gateway Compromise',
    description: 'The ICCP link to the Regional Transmission Organization carries market bidding data and real-time grid telemetry. A compromised RTO interface could inject false market signals or manipulate grid interchange schedules, destabilizing regional power flow.',
    status: 'assessed' as const, owner: 'Market Operations',
    tierPath: { tier1: 'Operational Risk', tier2: 'Grid Stability' },
    assetIds: ['egs-asset-scada-master', 'egs-asset-ems'],
    diagramLinks: [{ diagramId: 'electric-grid-system', nodeIds: ['rto-market', 'external-firewall', 'scada-master'] }],
    inherentScore: score('likelihood-2', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Implement ICCP/TASE.2 authentication; deploy out-of-band verification for critical market transactions',
    threatActorIds: ['egs-threat-actor-nation-state'],
    createdAt: NOW, updatedAt: NOW
  },
];

const assessments = [
  {
    id: 'egs-assessment-grid-security', title: 'Electric Grid SCADA/EMS Security Assessment',
    status: 'in_review' as const,
    owner: 'OT Security Architecture',
    reviewer: 'CISO',
    startDate: '2025-05-01',
    dueDate: '2025-08-01',
    threatActorIds: ['egs-threat-actor-nation-state', 'egs-threat-actor-insider', 'egs-threat-actor-hacktivist'],
    methodologyNote: 'Assessment follows NERC CIP-010-4 vulnerability assessment requirements with NIST SP 800-82 Rev3 control mapping for electric grid ICS.',
    assumptionNote: 'Covers Critical and OT zones, including SCADA master, EMS, substations, and field devices. Corporate IT assessed for lateral movement risk only.',
    scopeItems: [
      { id: 'egs-scope-scada', type: 'system' as const, value: 'system', name: 'SCADA/EMS Control System' },
      { id: 'egs-scope-critical', type: 'diagram_segment' as const, value: 'Critical', name: 'Control Center Zone' },
      { id: 'egs-scope-ot', type: 'diagram_segment' as const, value: 'OT', name: 'Field Equipment Zone' },
      { id: 'egs-scope-dmz', type: 'diagram_segment' as const, value: 'DMZ', name: 'DMZ Zone' },
    ],
    tierFilter: { tier1: 'Cyber Risk' },
    riskManagementPlan: {
      objective: 'Reduce cyber-physical attack surface across the electric grid control system to meet NERC CIP compliance and protect 2.5 million customers from service disruption.',
      strategy: 'Prioritize protection relay firmware hardening, eliminate unencrypted OT protocols, and enforce strict IT/OT segmentation with jump server architecture.',
      residualRiskStatement: 'Residual risk accepted for legacy Windows XP substations during phased migration with compensating application whitelisting.',
      monitoringApproach: 'Weekly OT security posture review with Dragos-based anomaly detection; monthly NERC CIP compliance dashboard review.',
      communicationPlan: 'Monthly report to Grid Security Steering Committee; quarterly briefing to utility commission on cyber posture.',
      reviewCadenceDays: 14,
      actions: [
        {
          id: 'egs-rmp-opc-migration',
          title: 'Migrate HMI from OPC DA to OPC UA with TLS encryption',
          owner: 'Grid Operations',
          dueDate: '2025-09-30',
          status: 'in_progress' as const,
          linkedRiskIds: ['egs-risk-scada-protocol'],
          notes: 'OPC UA server configured on SCADA master; HMI client testing in progress'
        },
        {
          id: 'egs-rmp-relay-firmware',
          title: 'Schedule protection relay firmware updates during maintenance windows',
          owner: 'Protection Engineering',
          dueDate: '2025-10-15',
          status: 'planned' as const,
          linkedRiskIds: ['egs-risk-relay-firmware'],
          notes: 'Coordinating with SEL and ABB for validated firmware packages'
        },
        {
          id: 'egs-rmp-jump-server',
          title: 'Deploy jump server for IT/OT boundary access control',
          owner: 'IT Security',
          dueDate: '2025-08-15',
          status: 'in_progress' as const,
          linkedRiskIds: ['egs-risk-it-ot-convergence'],
          notes: 'CyberArk PSM deployment in DMZ; testing OT access workflows'
        },
        {
          id: 'egs-rmp-xp-migration',
          title: 'Migrate distribution substations from Windows XP to Windows 10 LTSC',
          owner: 'Distribution Engineering',
          dueDate: '2025-12-31',
          status: 'planned' as const,
          linkedRiskIds: ['egs-risk-legacy-os'],
          notes: 'Phased rollout across 35 distribution substations; 8 completed'
        },
      ],
      updatedAt: NOW
    },
    riskIds: risks.map(r => r.id),
    soaGapIds: ['egs-soa-a02', 'egs-soa-a05', 'egs-soa-a07'],
    taskIds: ['egs-task-opc-migration', 'egs-task-relay-firmware', 'egs-task-jump-server', 'egs-task-xp-migration'],
    linkedImplementedControlIds: [],
    linkedInitiativeIds: [],
    summary: 'Comprehensive electric grid security assessment covering 8 risks across Critical, OT, and DMZ zones. Two risks rated Critical (SCADA protocol exposure, relay firmware), three rated High.',
    findings: 'Key findings: unencrypted OPC DA on HMI path, protection relay firmware vulnerabilities, dual-homed engineering workstation enabling IT/OT lateral movement, Windows XP Embedded in 27 distribution substations.',
    recommendations: 'Prioritize OPC UA migration for SCADA-HMI communications, enforce protection relay firmware lifecycle management, deploy jump server architecture for IT/OT boundary.',
    evidenceSummary: 'Evidence includes NERC CIP audit logs, Dragos OT scan results, firewall rule exports, and substation OS inventory.',
    threatModel: {
      nodes: [
        { id: 'egs-tm-rto', label: 'RTO Market Gateway', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'rto-market', position: { x: 50, y: 150 }, nodeType: 'gateway' },
        { id: 'egs-tm-ext-fw', label: 'External Firewall', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'external-firewall', position: { x: 200, y: 150 }, nodeType: 'firewall' },
        { id: 'egs-tm-ot-fw', label: 'OT Network Firewall', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'ot-firewall', position: { x: 350, y: 150 }, nodeType: 'industrialFirewall', commentary: 'Central gateway protecting control systems' },
        { id: 'egs-tm-scada', label: 'SCADA Master', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'scada-master', position: { x: 500, y: 100 }, nodeType: 'scadaServer', commentary: 'Primary target for grid control manipulation' },
        { id: 'egs-tm-switch', label: 'Substation Network Switch', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'field-switch', position: { x: 650, y: 100 }, nodeType: 'industrialNetwork' },
        { id: 'egs-tm-relay', label: 'Protection Relay', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'protection-relay', position: { x: 800, y: 100 }, nodeType: 'plc', commentary: 'Vulnerable firmware; GOOSE unencrypted' },
        { id: 'egs-tm-dist-sub', label: 'Distribution Substation', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'distribution-substation', position: { x: 650, y: 250 }, nodeType: 'rtu', commentary: 'Windows XP Embedded; default passwords' },
        { id: 'egs-tm-eng-ws', label: 'Engineering Workstation', sourceType: 'asset' as AssessmentThreatModelNodeSourceType, assetId: 'egs-asset-corporate-it', position: { x: 350, y: 300 }, nodeType: 'workstation', commentary: 'Dual-homed IT/OT access' },
      ],
      edges: [
        { id: 'egs-tm-edge-rto-fw', source: 'egs-tm-rto', target: 'egs-tm-ext-fw', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'rto-to-firewall', label: 'ICCP/TLS' },
        { id: 'egs-tm-edge-ext-ot', source: 'egs-tm-ext-fw', target: 'egs-tm-ot-fw', sourceType: 'manual' as AssessmentThreatModelEdgeSourceType, label: 'Filtered traffic via IT FW', commentary: 'Traverses IT firewall and IT/OT boundary' },
        { id: 'egs-tm-edge-ot-scada', source: 'egs-tm-ot-fw', target: 'egs-tm-scada', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'ot-firewall-to-scada', label: 'DNP3' },
        { id: 'egs-tm-edge-scada-switch', source: 'egs-tm-scada', target: 'egs-tm-switch', sourceType: 'manual' as AssessmentThreatModelEdgeSourceType, label: 'Control commands via OT FW', commentary: 'SCADA to field devices through OT network' },
        { id: 'egs-tm-edge-switch-relay', source: 'egs-tm-switch', target: 'egs-tm-relay', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'switch-to-relay', label: 'GOOSE (unencrypted)' },
        { id: 'egs-tm-edge-switch-dist', source: 'egs-tm-switch', target: 'egs-tm-dist-sub', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'switch-to-dist-sub', label: 'IEC 61850 (unencrypted)' },
      ],
      attackPathDescription: 'Three critical attack paths identified: (1) RTO market gateway to SCADA master to protection relays enables relay disabling during grid faults; (2) IT/OT boundary traversal via engineering workstation pivot to SCADA; (3) Field maintenance laptop exploitation of legacy Windows XP substations.',
      attackPaths: [
        {
          id: 'egs-aap-rto-to-relay',
          name: 'RTO Gateway → SCADA Master → Protection Relay Disabling',
          strideCategory: 'Tampering' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'An attacker compromises the ICCP link from the RTO market gateway, traverses firewalls to reach the SCADA master, and injects malicious commands through the field switch to disable protection relays during grid fault conditions.',
          diagramAttackPathId: 'egs-ap-rto-to-relay',
          steps: [
            { order: 1, edgeId: 'rto-to-firewall', sourceNodeId: 'rto-market', targetNodeId: 'external-firewall', technique: 'T1190: Exploit Public-Facing Application' },
            { order: 2, edgeId: 'ot-firewall-to-scada', sourceNodeId: 'ot-firewall', targetNodeId: 'scada-master', technique: 'T1071: Application Layer Protocol (DNP3)' },
            { order: 3, edgeId: 'switch-to-relay', sourceNodeId: 'field-switch', targetNodeId: 'protection-relay', technique: 'T0855: Unauthorized Command Message (ICS)' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
        {
          id: 'egs-aap-it-ot-pivot',
          name: 'Engineering Workstation Pivot → SCADA Compromise',
          strideCategory: 'Elevation of Privilege' as StrideCategory,
          riskLevel: 'High' as AttackPathRiskLevel,
          description: 'An insider or attacker who compromises the dual-homed engineering workstation pivots through the OT network firewall to reach the SCADA master station, gaining control of grid operations.',
          diagramAttackPathId: 'egs-ap-it-ot-pivot',
          steps: [
            { order: 1, edgeId: 'it-firewall-to-ot-firewall', sourceNodeId: 'it-firewall', targetNodeId: 'ot-firewall', technique: 'T1021: Remote Services (RDP)' },
            { order: 2, edgeId: 'ot-firewall-to-scada', sourceNodeId: 'ot-firewall', targetNodeId: 'scada-master', technique: 'T0886: Remote Services (ICS)' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
        {
          id: 'egs-aap-dist-sub-exploit',
          name: 'Field Laptop → Legacy Substation Exploitation',
          strideCategory: 'Tampering' as StrideCategory,
          riskLevel: 'High' as AttackPathRiskLevel,
          description: 'A compromised or lost field maintenance laptop with shared credentials is used to connect to a Windows XP-based distribution substation, enabling unauthorized configuration changes to the SICAM PAS automation platform.',
          diagramAttackPathId: 'egs-ap-dist-sub-exploit',
          steps: [
            { order: 1, edgeId: 'dist-to-maintenance', sourceNodeId: 'distribution-substation', targetNodeId: 'field-maintenance', technique: 'T1078: Valid Accounts (shared maintenance)' },
            { order: 2, edgeId: 'switch-to-dist-sub', sourceNodeId: 'field-switch', targetNodeId: 'distribution-substation', technique: 'T0836: Modify Parameter (ICS)' },
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
    id: 'egs-soa-a01', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A01', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'SCADA master uses role-based access control integrated with Active Directory. However, field maintenance laptops rely on shared accounts, and distribution substations retain default maintenance passwords.',
    mitigatesRiskIds: ['egs-risk-shared-maintenance'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'egs-soa-a02', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A02', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'OPC DA traffic between SCADA master and HMI is unencrypted. GOOSE messaging lacks authentication. Historian proxy to compliance database uses unencrypted SQL connection.',
    mitigatesRiskIds: ['egs-risk-scada-protocol', 'egs-risk-historian-proxy'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'egs-soa-a04', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A04', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'planned' as const,
    justification: 'Architecture review planned to address dual-homed engineering workstation and strengthen IT/OT boundary segmentation with jump server deployment.',
    mitigatesRiskIds: ['egs-risk-it-ot-convergence'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'egs-soa-a05', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A05', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Multiple misconfigurations: distribution substations with default passwords, historian proxy running outdated PI System version, field network switch with known firmware vulnerabilities.',
    mitigatesRiskIds: ['egs-risk-legacy-os', 'egs-risk-historian-proxy'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'egs-soa-a06', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A06', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'OSIsoft PI System 2018 SP3 has known vulnerabilities. Field switch runs firmware with known CVEs. Oracle 11g corporate database is end-of-life.',
    mitigatesRiskIds: ['egs-risk-historian-proxy', 'egs-risk-relay-firmware'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'egs-soa-a07', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A07', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Domain controller provides Kerberos authentication for corporate and SCADA systems. Field maintenance uses shared local accounts without individual accountability.',
    mitigatesRiskIds: ['egs-risk-shared-maintenance', 'egs-risk-it-ot-convergence'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'egs-soa-cis-01', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.01', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'implemented' as const,
    justification: 'OT asset inventory maintained via ABB Network Manager auto-discovery and NERC CIP BES Cyber Asset identification. IT assets tracked in IBM Maximo.',
    mitigatesRiskIds: [], diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'egs-soa-cis-04', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.04', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Tofino industrial firewall uses protocol whitelisting with DPI. FortiGate perimeter firewall has IPS enabled. Distribution substations and field switches need configuration hardening.',
    mitigatesRiskIds: ['egs-risk-legacy-os', 'egs-risk-relay-firmware'],
    diagramRefs: [],
    evidence: [
      { id: 'egs-evidence-cis04-tofino', kind: 'link' as const, name: 'Tofino Xenon firewall configuration baseline',
        url: 'https://security.example.local/docs/tofino-baseline', note: 'Protocol whitelist and DPI rules for DNP3/IEC61850', createdAt: NOW }
    ],
    updatedAt: NOW
  },
  {
    id: 'egs-soa-cis-06', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.06', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'planned' as const,
    justification: 'RBAC implemented for SCADA and AD-integrated systems. Field device access requires individual authentication tokens (planned). Distribution substations need password rotation.',
    mitigatesRiskIds: ['egs-risk-shared-maintenance'], diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'egs-soa-cis-08', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.08', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'implemented' as const,
    justification: 'SCADA master and EMS generate audit logs forwarded to centralized SIEM. Control historian provides operational event logging. NERC CIP-007-7 audit log requirements met for BES Cyber Assets.',
    mitigatesRiskIds: ['egs-risk-scada-protocol'],
    diagramRefs: [],
    evidence: [
      { id: 'egs-evidence-cis08-siem', kind: 'link' as const, name: 'NERC CIP-007-7 audit log compliance report',
        url: 'https://compliance.example.local/reports/cip007-audit', note: 'Annual audit log compliance review', createdAt: NOW }
    ],
    updatedAt: NOW
  },
];

const workflowTasks = [
  {
    id: 'egs-task-opc-migration',
    title: 'Migrate SCADA-HMI communications from OPC DA to OPC UA with TLS',
    description: 'Configure OPC UA server on SCADA master with X.509 certificates; update HMI client to OPC UA with Security Mode Sign&Encrypt.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'critical' as const,
    owner: 'Grid Operations',
    dueDate: '2025-09-30',
    riskId: 'egs-risk-scada-protocol',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'egs-task-relay-firmware',
    title: 'Schedule and apply protection relay firmware updates',
    description: 'Coordinate with SEL and ABB for validated firmware; schedule updates during maintenance windows with protection coordination verification.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'critical' as const,
    owner: 'Protection Engineering',
    dueDate: '2025-10-15',
    riskId: 'egs-risk-relay-firmware',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'egs-task-jump-server',
    title: 'Deploy CyberArk jump server for IT/OT boundary access',
    description: 'Deploy privileged access management in DMZ for all IT/OT boundary crossings; enforce session recording and scope restrictions.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'high' as const,
    owner: 'IT Security',
    dueDate: '2025-08-15',
    riskId: 'egs-risk-it-ot-convergence',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'egs-task-xp-migration',
    title: 'Migrate distribution substations to Windows 10 LTSC',
    description: 'Phased migration of 35 distribution substations from Windows XP Embedded to Windows 10 LTSC with SICAM PAS compatibility testing.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Distribution Engineering',
    dueDate: '2025-12-31',
    riskId: 'egs-risk-legacy-os',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'egs-task-field-auth',
    title: 'Deploy individual authentication for field maintenance laptops',
    description: 'Replace shared maintenance account with individual hardware tokens and enable per-user audit logging on substation access.',
    type: 'control_implementation' as const,
    status: 'todo' as const,
    priority: 'medium' as const,
    owner: 'Field Engineering',
    dueDate: '2025-09-15',
    riskId: 'egs-risk-shared-maintenance',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'egs-task-nerc-evidence',
    title: 'Attach NERC CIP audit evidence for CIS.08 control',
    description: 'Upload NERC CIP-007-7 audit log compliance report and SIEM configuration documentation as evidence for audit log management control.',
    type: 'evidence' as const,
    status: 'todo' as const,
    priority: 'medium' as const,
    owner: 'Compliance Officer',
    dueDate: '2025-08-01',
    controlSetId: CIS_CONTROL_SET_ID,
    controlId: 'CIS.08',
    createdAt: NOW, updatedAt: NOW
  },
];

const governanceDocuments = [
  {
    id: 'egs-gov-nerc-cip-policy',
    title: 'NERC CIP Cybersecurity Policy',
    type: 'policy' as const,
    description: 'Enterprise policy defining compliance requirements for NERC CIP standards (CIP-002 through CIP-014) covering BES Cyber Systems identification, access control, security management, and incident response.',
    owner: 'CISO',
    status: 'active' as const,
    version: '4.2',
    url: 'https://compliance.example.local/policies/nerc-cip-policy-v4.2.pdf',
    reviewDate: '2025-01-15',
    nextReviewDate: '2025-07-15',
    tags: ['nerc-cip', 'compliance', 'bes-cyber-system'],
    linkedRiskIds: ['egs-risk-scada-protocol', 'egs-risk-relay-firmware', 'egs-risk-it-ot-convergence'],
    linkedControlSetIds: [CIS_CONTROL_SET_ID],
    linkedAssessmentIds: ['egs-assessment-grid-security'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'egs-gov-ot-incident-response',
    title: 'OT Incident Response Procedure',
    type: 'procedure' as const,
    description: 'Step-by-step procedures for detecting, containing, and recovering from cybersecurity incidents affecting grid control systems, including coordination with NERC E-ISAC and RC.',
    owner: 'Grid Security Operations',
    status: 'active' as const,
    version: '2.1',
    url: 'https://compliance.example.local/procedures/ot-incident-response-v2.1.pdf',
    reviewDate: '2025-03-01',
    nextReviewDate: '2025-09-01',
    tags: ['incident-response', 'ot', 'nerc-cip-008'],
    linkedRiskIds: ['egs-risk-scada-protocol', 'egs-risk-rto-market-compromise'],
    linkedControlSetIds: [],
    linkedAssessmentIds: ['egs-assessment-grid-security'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'egs-gov-physical-security-plan',
    title: 'Substation Physical Security Plan',
    type: 'standard' as const,
    description: 'Physical security standards for transmission substations per NERC CIP-006 and CIP-014, including perimeter protection, electronic access controls, and visitor management.',
    owner: 'Physical Security Manager',
    status: 'active' as const,
    version: '3.0',
    url: 'https://compliance.example.local/standards/physical-security-v3.0.pdf',
    reviewDate: '2024-12-01',
    nextReviewDate: '2025-12-01',
    tags: ['physical-security', 'nerc-cip-006', 'nerc-cip-014', 'substation'],
    linkedRiskIds: ['egs-risk-legacy-os', 'egs-risk-shared-maintenance'],
    linkedControlSetIds: [CIS_CONTROL_SET_ID],
    linkedAssessmentIds: [],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'egs-gov-change-management',
    title: 'BES Cyber System Change Management Guideline',
    type: 'guideline' as const,
    description: 'Guidelines for managing changes to BES Cyber Systems including SCADA software updates, relay firmware upgrades, and network configuration changes per NERC CIP-010.',
    owner: 'OT Change Advisory Board',
    status: 'under_review' as const,
    version: '1.4',
    url: 'https://compliance.example.local/guidelines/change-management-v1.4.pdf',
    reviewDate: '2025-05-01',
    nextReviewDate: '2025-08-01',
    tags: ['change-management', 'nerc-cip-010', 'firmware', 'scada'],
    linkedRiskIds: ['egs-risk-relay-firmware', 'egs-risk-legacy-os'],
    linkedControlSetIds: [OWASP_CONTROL_SET_ID],
    linkedAssessmentIds: ['egs-assessment-grid-security'],
    createdAt: NOW, updatedAt: NOW
  },
];

const threatActors = [
  {
    id: 'egs-threat-actor-nation-state', name: 'VOLTZITE / SANDWORM (Grid-Focused APT)',
    type: 'nation_state' as const, capabilityLevel: 5,
    resourceLevel: 'very_high' as const,
    motivation: 'Pre-positioning for wartime disruption of electric grid infrastructure; intelligence collection on grid topology and protection schemes; demonstrated capability to cause blackouts (Ukraine 2015/2016).',
    description: 'State-sponsored advanced persistent threat group with proven ability to target electric grid SCADA systems. Known to exploit DNP3 protocol weaknesses, protection relay vulnerabilities, and IT/OT convergence paths for grid disruption.',
    targetedAssetIds: ['egs-asset-scada-master', 'egs-asset-protection-relay', 'egs-asset-ems'],
    tags: ['apt', 'grid-targeted', 'sandworm', 'industroyer', 'blackenergy', 'critical-infrastructure'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'egs-threat-actor-insider', name: 'Disgruntled Grid Operator',
    type: 'insider' as const, capabilityLevel: 3,
    resourceLevel: 'moderate' as const,
    motivation: 'Sabotage of grid operations due to labor dispute or personal grievance; financial incentive from external actors seeking grid intelligence.',
    description: 'Current or recently departed grid operator with legitimate access to SCADA HMI, knowledge of protection schemes, and familiarity with substation access procedures. Has physical access to control rooms and field equipment.',
    targetedAssetIds: ['egs-asset-scada-master', 'egs-asset-distribution-sub', 'egs-asset-corporate-it'],
    tags: ['insider-threat', 'physical-access', 'grid-knowledge', 'sabotage'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'egs-threat-actor-hacktivist', name: 'Environmental Hacktivist Group',
    type: 'hacktivist' as const, capabilityLevel: 2,
    resourceLevel: 'low' as const,
    motivation: 'Disrupt fossil fuel-based power generation to advance environmental agenda; public embarrassment of utility through data exposure or service disruption.',
    description: 'Loosely organized hacktivist collective targeting energy utilities. Limited ICS expertise but capable of exploiting known vulnerabilities in exposed systems, particularly legacy Windows XP substations and default-password devices.',
    targetedAssetIds: ['egs-asset-distribution-sub', 'egs-asset-corporate-it'],
    tags: ['hacktivist', 'environmental', 'opportunistic', 'legacy-exploit'],
    createdAt: NOW, updatedAt: NOW
  },
];

const threatScenarios = [
  {
    id: 'egs-scenario-industroyer-style', title: 'INDUSTROYER-Style Grid Blackout Attack',
    description: 'Nation-state APT compromises the RTO market gateway ICCP link, pivots through firewalls to the SCADA master, and sends unauthorized commands to disable protection relays across multiple substations simultaneously, causing cascading failures and a regional blackout.',
    threatActorId: 'egs-threat-actor-nation-state',
    targetedAssetIds: ['egs-asset-scada-master', 'egs-asset-protection-relay'],
    attackTechniques: ['T1190 - Exploit Public-Facing Application', 'T1071 - Application Layer Protocol (DNP3)', 'T0855 - Unauthorized Command Message (ICS)', 'T0816 - Device Restart/Shutdown (ICS)'],
    linkedRiskIds: ['egs-risk-scada-protocol', 'egs-risk-relay-firmware', 'egs-risk-rto-market-compromise'],
    likelihood: 'Low - requires advanced capabilities but SANDWORM/VOLTZITE has demonstrated this exact capability (INDUSTROYER/CrashOverride).',
    impact: 'Critical - regional blackout affecting 2.5 million customers, potential equipment damage from unprotected faults, public safety impact.',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'egs-scenario-insider-pivot', title: 'Insider Engineering Workstation Pivot to SCADA',
    description: 'Disgruntled grid operator uses the dual-homed engineering workstation to traverse the IT/OT boundary, accessing the SCADA master to manipulate grid control settings or disable automatic load shedding schemes.',
    threatActorId: 'egs-threat-actor-insider',
    targetedAssetIds: ['egs-asset-scada-master', 'egs-asset-corporate-it'],
    attackTechniques: ['T1078 - Valid Accounts', 'T1021 - Remote Services (RDP)', 'T0886 - Remote Services (ICS)', 'T0831 - Manipulation of Control (ICS)'],
    linkedRiskIds: ['egs-risk-it-ot-convergence', 'egs-risk-shared-maintenance'],
    likelihood: 'Moderate - insider has legitimate access and grid knowledge; engineering workstation dual-homing enables the pivot.',
    impact: 'Major - grid instability, potential equipment damage, and service disruption from unauthorized control changes.',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'egs-scenario-legacy-substation-exploit', title: 'Hacktivist Exploitation of Legacy Substations',
    description: 'Environmental hacktivist group targets distribution substations running Windows XP Embedded with known exploits, leveraging default maintenance passwords on field laptops to gain access and disrupt power distribution to specific areas.',
    threatActorId: 'egs-threat-actor-hacktivist',
    targetedAssetIds: ['egs-asset-distribution-sub'],
    attackTechniques: ['T1078 - Valid Accounts (default passwords)', 'T1210 - Exploitation of Remote Services', 'T0836 - Modify Parameter (ICS)', 'T0813 - Denial of Control (ICS)'],
    linkedRiskIds: ['egs-risk-legacy-os', 'egs-risk-shared-maintenance'],
    likelihood: 'Moderate - Windows XP vulnerabilities are well-known and easily exploitable; shared maintenance accounts reduce attack complexity.',
    impact: 'Moderate - localized distribution outages affecting specific service areas; limited cascading impact due to protection schemes.',
    createdAt: NOW, updatedAt: NOW
  },
];

const appetiteRules = [
  {
    id: 'egs-appetite-safety-critical', name: 'Grid Protection Systems',
    description: 'Extremely low appetite for risks affecting protection relays and grid stability systems due to potential for cascading failures and public safety impact.',
    scopeAssetCriticalityMin: 5,
    thresholdScore: 6,
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'egs-appetite-cyber-tier', name: 'Cyber Risk Tier',
    description: 'Reduced appetite for all risks classified under the Cyber Risk tier affecting grid control systems.',
    scopeTier1: 'Cyber Risk',
    thresholdScore: 10,
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'egs-appetite-ot-domain', name: 'OT Domain',
    description: 'Strict appetite threshold for operational technology assets due to NERC CIP compliance requirements and grid reliability obligations.',
    scopeAssetDomain: 'ot' as const,
    thresholdScore: 8,
    createdAt: NOW, updatedAt: NOW
  },
];

export const electricGridSystemGrcWorkspace = buildGrcWorkspace({
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
  thirdParties: [
    {
      id: 'egs-tp-ge-vernova',
      name: 'GE Vernova',
      description: 'Primary SCADA and Energy Management System (EMS) supplier providing the XA/21 SCADA platform, real-time generation dispatch, and state estimation software. Delivers firmware updates, configuration changes, and on-site engineering support.',
      category: 'supplier',
      status: 'active',
      riskRating: 'critical',
      dataClassification: 'restricted',
      linkedAssetIds: ['egs-asset-scada-master', 'egs-asset-ems', 'egs-asset-historian'],
      linkedRiskIds: ['egs-risk-scada-protocol', 'egs-risk-legacy-os', 'egs-risk-historian-proxy'],
      contactName: 'Robert McAllister',
      contactEmail: 'robert.mcallister@gevernova.example.com',
      contractExpiry: '2028-06-30',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-12-31',
      notes: 'Long-term service agreement with 24/7 on-call engineering support. SCADA master station runs on legacy Windows Server 2012 R2 — vendor has not yet certified upgrade path. EMS software receives quarterly security patches but deployment requires planned outage window. Remote access for vendor support uses dedicated VPN with MFA but shared maintenance account identified as a risk. NERC CIP compliance documentation provided annually.'
    },
    {
      id: 'egs-tp-sel',
      name: 'Schweitzer Engineering Laboratories (SEL)',
      description: 'Protection relay and substation automation supplier providing SEL-400 series relays, RTAC controllers, and relay configuration management tools for distribution substations and transmission protection.',
      category: 'supplier',
      status: 'active',
      riskRating: 'critical',
      dataClassification: 'restricted',
      linkedAssetIds: ['egs-asset-protection-relay', 'egs-asset-distribution-sub', 'egs-asset-rtu'],
      linkedRiskIds: ['egs-risk-relay-firmware', 'egs-risk-shared-maintenance'],
      contactName: 'Jennifer Walsh',
      contactEmail: 'jennifer.walsh@selinc.example.com',
      contractExpiry: '2027-12-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-09-30',
      notes: 'Protection relays are safety-critical — firmware updates require coordination with grid operations and protection engineering. SEL firmware signing verified before deployment. RTAC controllers provide protocol translation between DNP3 and IEC 61850. Vendor remote access requires pre-authorized maintenance windows. Shared maintenance credentials on older relays (pre-2018) identified as a risk — credential rotation project underway. SEL maintains NERC CIP vulnerability disclosure program.'
    },
    {
      id: 'egs-tp-itron',
      name: 'Itron Inc.',
      description: 'Advanced Metering Infrastructure (AMI) supplier providing smart meters, head-end system, and meter data management platform. Deployed across 2.5 million residential and commercial endpoints.',
      category: 'supplier',
      status: 'active',
      riskRating: 'high',
      dataClassification: 'confidential',
      linkedAssetIds: ['egs-asset-ami'],
      linkedRiskIds: ['egs-risk-ami-manipulation', 'egs-risk-rto-market-compromise'],
      contactName: 'Steven Park',
      contactEmail: 'steven.park@itron.example.com',
      contractExpiry: '2027-06-30',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-10-31',
      notes: 'OpenWay Riva AMI platform with mesh networking across 2.5M meters. Meter firmware updates distributed OTA with code signing. Head-end system receives interval data used for billing and demand response. AMI data manipulation risk identified — compromised meter readings could affect market settlements and demand forecasting. Network segmentation between AMI head-end and SCADA enforced. Meter disconnect capability requires two-person authorization.'
    },
    {
      id: 'egs-tp-dragos',
      name: 'Dragos Inc.',
      description: 'Managed OT security service providing industrial threat detection, vulnerability management, and incident response for the grid control environment. Dragos Platform monitors network traffic across SCADA, RTU, and substation networks.',
      category: 'managed_service',
      status: 'active',
      riskRating: 'medium',
      dataClassification: 'confidential',
      linkedAssetIds: ['egs-asset-scada-master', 'egs-asset-rtu', 'egs-asset-distribution-sub', 'egs-asset-historian'],
      linkedRiskIds: ['egs-risk-it-ot-convergence', 'egs-risk-scada-protocol', 'egs-risk-legacy-os'],
      contactName: 'Amanda Richardson',
      contactEmail: 'amanda.richardson@dragos.example.com',
      contractExpiry: '2026-12-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-10-31',
      notes: 'Dragos Platform deployed with passive network sensors at SCADA master station and three critical substations. Monitors DNP3, IEC 61850, and Modbus traffic for anomalous commands and reconnaissance activity. Threat intelligence feeds include CHERNOVITE, ELECTRUM, and other grid-targeting activity groups. OT-Watch managed detection service provides 24/7 monitoring with 1-hour escalation SLA. Annual OT architecture review included in engagement.'
    },
    {
      id: 'egs-tp-claroty',
      name: 'Claroty Ltd.',
      description: 'SaaS OT asset discovery and vulnerability management platform providing continuous monitoring of ICS network assets, firmware versions, and CVE correlation across all substations and control centers.',
      category: 'saas',
      status: 'active',
      riskRating: 'medium',
      dataClassification: 'internal',
      linkedAssetIds: ['egs-asset-protection-relay', 'egs-asset-rtu', 'egs-asset-corporate-it'],
      linkedRiskIds: ['egs-risk-relay-firmware', 'egs-risk-it-ot-convergence', 'egs-risk-shared-maintenance'],
      contactName: 'Daniel Levy',
      contactEmail: 'daniel.levy@claroty.example.com',
      contractExpiry: '2026-11-30',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-08-31',
      notes: 'Claroty xDome deployed for OT asset visibility across 47 substations. Automatically discovers and inventories PLCs, RTUs, relays, and network equipment. Correlates firmware versions against known CVEs and provides risk scoring. Integration with Dragos for threat detection and Claroty for asset management provides defense-in-depth. Safe query mode used to avoid disrupting real-time control operations. Reports feed into NERC CIP compliance documentation.'
    },
  ],
  securityInitiatives: [
    {
      id: 'egs-si-ot-protocol-hardening',
      title: 'OT Protocol Encryption and Authentication Uplift',
      description: 'Migrate all control system communications from unencrypted legacy protocols to authenticated and encrypted alternatives, including OPC DA to OPC UA migration and IEC 62351 deployment for GOOSE messaging.',
      category: 'uplift' as const,
      status: 'in_progress' as const,
      priority: 'critical' as const,
      owner: 'Grid Operations',
      executiveSponsor: 'VP of Grid Operations',
      currentState: 'OPC DA traffic between SCADA master and HMI is unencrypted. GOOSE messaging lacks authentication. Historian proxy to compliance database uses unencrypted SQL. DNP3 Secure Authentication not enforced on all RTUs.',
      targetState: 'All SCADA-HMI communications on OPC UA with TLS. IEC 62351 authentication deployed for GOOSE messaging. All database connections encrypted with TLS. DNP3 Secure Authentication enforced across all field devices.',
      startDate: '2025-05-01',
      targetDate: '2026-03-31',
      completedDate: '',
      milestones: [
        { id: 'egs-ms-opc-ua-scada', title: 'Migrate SCADA-HMI to OPC UA with TLS', description: 'Configure OPC UA server on SCADA master with X.509 certificates and update HMI client to OPC UA Security Mode Sign&Encrypt.', status: 'in_progress' as const, dueDate: '2025-09-30', completedDate: '', owner: 'Grid Operations' },
        { id: 'egs-ms-goose-auth', title: 'Deploy IEC 62351 for GOOSE authentication', description: 'Enable IEC 62351 authentication on protection relay GOOSE messaging across all primary substations.', status: 'pending' as const, dueDate: '2025-12-31', completedDate: '', owner: 'Protection Engineering' },
        { id: 'egs-ms-historian-tls', title: 'Enable TLS on historian database connections', description: 'Upgrade PI System and enable TLS encryption on historian proxy to compliance database SQL connection.', status: 'pending' as const, dueDate: '2026-02-28', completedDate: '', owner: 'Grid Operations' },
      ],
      linkedRiskIds: ['egs-risk-scada-protocol', 'egs-risk-historian-proxy', 'egs-risk-relay-firmware'],
      linkedControlSetIds: [],
      linkedAssetIds: ['egs-asset-scada-master', 'egs-asset-protection-relay', 'egs-asset-historian'],
      linkedImplementedControlIds: ['egs-ic-industrial-ids'],
      linkedAssessmentIds: ['egs-assessment-grid-security'],
      notes: 'OPC UA server configured on SCADA master and under testing. GOOSE authentication requires coordinated firmware update with SEL and ABB relay vendors.',
      createdAt: NOW,
      updatedAt: NOW
    },
    {
      id: 'egs-si-it-ot-segmentation',
      title: 'IT/OT Network Segmentation and Access Control Modernization',
      description: 'Eliminate dual-homed engineering workstation access, deploy jump server architecture for IT/OT boundary, and replace shared maintenance accounts with individual authentication on all field devices.',
      category: 'remediation' as const,
      status: 'in_progress' as const,
      priority: 'high' as const,
      owner: 'IT Security',
      executiveSponsor: 'CISO',
      currentState: 'Engineering workstation has dual-homed IT/OT access. Field maintenance laptops use shared local accounts. Distribution substations running Windows XP Embedded with default passwords.',
      targetState: 'All IT/OT access via CyberArk jump server with session recording. Individual hardware token authentication for field maintenance. Windows XP Embedded migrated to Windows 10 LTSC.',
      startDate: '2025-05-15',
      targetDate: '2026-01-31',
      completedDate: '',
      milestones: [
        { id: 'egs-ms-jump-server', title: 'Deploy CyberArk jump server in DMZ', description: 'Deploy CyberArk Privileged Session Manager in the DMZ for all IT/OT boundary crossings with session recording.', status: 'in_progress' as const, dueDate: '2025-08-15', completedDate: '', owner: 'IT Security' },
        { id: 'egs-ms-field-auth', title: 'Deploy individual field authentication tokens', description: 'Replace shared maintenance accounts with individual YubiKey hardware tokens for all field engineering laptops.', status: 'pending' as const, dueDate: '2025-09-15', completedDate: '', owner: 'Field Engineering' },
        { id: 'egs-ms-xp-migration', title: 'Complete Windows XP Embedded migration', description: 'Migrate remaining 27 distribution substations from Windows XP Embedded to Windows 10 LTSC.', status: 'pending' as const, dueDate: '2025-12-31', completedDate: '', owner: 'Distribution Engineering' },
      ],
      linkedRiskIds: ['egs-risk-it-ot-convergence', 'egs-risk-shared-maintenance', 'egs-risk-legacy-os'],
      linkedControlSetIds: [],
      linkedAssetIds: ['egs-asset-corporate-it', 'egs-asset-distribution-sub'],
      linkedImplementedControlIds: ['egs-ic-ot-firewall', 'egs-ic-industrial-ids'],
      linkedAssessmentIds: ['egs-assessment-grid-security'],
      notes: 'CyberArk PSM deployment in DMZ underway. 8 of 35 distribution substations migrated to Windows 10 LTSC. Application whitelisting deployed as interim control on remaining XP systems.',
      createdAt: NOW,
      updatedAt: NOW
    },
  ],
  implementedControls: [
    {
      id: 'egs-ic-ot-firewall',
      title: 'Tofino Xenon Industrial Firewall with DPI',
      description: 'Industrial-grade firewall providing deep packet inspection for OT protocols (DNP3, IEC 61850, Modbus) with protocol whitelisting and anomaly detection at the IT/OT boundary.',
      controlType: 'technical' as const,
      category: 'network_security' as const,
      status: 'active' as const,
      automationLevel: 'fully_automated' as const,
      owner: 'OT Security',
      vendor: 'Belden',
      product: 'Tofino Xenon Security Appliance',
      version: '4.2',
      implementedDate: '2023-09-15',
      lastReviewDate: '2025-04-20',
      nextReviewDate: '2025-10-20',
      linkedSoaEntryIds: ['egs-soa-cis-04'],
      linkedRiskIds: ['egs-risk-it-ot-convergence', 'egs-risk-scada-protocol'],
      linkedAssetIds: ['egs-asset-scada-master', 'egs-asset-corporate-it'],
      linkedAssessmentIds: ['egs-assessment-grid-security'],
      notes: 'Protocol whitelist enforces DNP3 and IEC 61850 only on OT-facing interfaces. DPI rules block unauthorized function codes. Firmware updated quarterly during maintenance windows.',
      createdAt: NOW,
      updatedAt: NOW
    },
    {
      id: 'egs-ic-industrial-ids',
      title: 'Dragos OT Network Monitoring and Threat Detection',
      description: 'Passive OT network monitoring providing continuous threat detection, asset identification, and vulnerability correlation for SCADA, EMS, and substation networks without impacting real-time operations.',
      controlType: 'technical' as const,
      category: 'monitoring' as const,
      status: 'active' as const,
      automationLevel: 'semi_automated' as const,
      owner: 'OT Security',
      vendor: 'Dragos',
      product: 'Dragos Platform',
      version: '2.4',
      implementedDate: '2024-03-01',
      lastReviewDate: '2025-05-10',
      nextReviewDate: '2025-11-10',
      linkedSoaEntryIds: ['egs-soa-cis-08', 'egs-soa-a02'],
      linkedRiskIds: ['egs-risk-scada-protocol', 'egs-risk-relay-firmware', 'egs-risk-rto-market-compromise'],
      linkedAssetIds: ['egs-asset-scada-master', 'egs-asset-protection-relay', 'egs-asset-rtu'],
      linkedAssessmentIds: ['egs-assessment-grid-security'],
      notes: 'Passive sensors deployed at SCADA master, primary substations, and RTO interconnect. ICS-specific threat detections for CRASHOVERRIDE, TRITON, and PIPEDREAM indicators. Weekly threat briefings from Dragos WorldView intelligence team.',
      createdAt: NOW,
      updatedAt: NOW
    },
    {
      id: 'egs-ic-nerc-cip-audit-logging',
      title: 'NERC CIP-007 Centralized Audit Log Management',
      description: 'Centralized audit logging for all BES Cyber Assets with SIEM integration, log integrity verification, and retention policies meeting NERC CIP-007-7 requirements.',
      controlType: 'technical' as const,
      category: 'logging' as const,
      status: 'active' as const,
      automationLevel: 'fully_automated' as const,
      owner: 'Grid Operations',
      vendor: 'Splunk',
      product: 'Splunk Enterprise Security',
      version: '7.3',
      implementedDate: '2023-01-15',
      lastReviewDate: '2025-03-20',
      nextReviewDate: '2025-09-20',
      linkedSoaEntryIds: ['egs-soa-cis-08'],
      linkedRiskIds: ['egs-risk-scada-protocol', 'egs-risk-shared-maintenance'],
      linkedAssetIds: ['egs-asset-scada-master', 'egs-asset-ems', 'egs-asset-historian'],
      linkedAssessmentIds: ['egs-assessment-grid-security'],
      notes: 'SCADA master, EMS, domain controller, and firewall logs forwarded to Splunk. NERC CIP-007-7 audit compliance verified annually. Log retention set to 3 years. Alert correlation rules for unauthorized access and configuration changes.',
      createdAt: NOW,
      updatedAt: NOW
    },
  ],
});

export const electricGridSystem: ExampleSystem = {
  id: 'electric-grid-system',
  name: 'Regional Electric Grid Control System',
  description: 'Multi-substation electrical grid with SCADA control and monitoring systems',
  category: 'Industrial Control Systems',
  // securityLevel removed - no longer part of the system model
  primaryZone: 'OT',
  dataClassification: 'Confidential',
  grcWorkspace: electricGridSystemGrcWorkspace,
  customContext: `# Regional Electric Grid Control System

## System Overview
Our regional electrical grid serves 2.5 million customers across a 15,000 square mile area with 47 substations and 8,500 miles of transmission lines. The system operates at voltages from 69kV to 500kV with real-time monitoring and control capabilities for maintaining grid stability and reliability.

## Infrastructure Architecture

### Field Equipment Layer (OT Zone)
- **Primary Substations**: 12 major transmission substations with 230kV-500kV equipment
  - Schneider Electric SCADA nodes running ClearSCADA v2019.2
  - ABB REL670 protection relays with firmware v2.2.3
  - Schweitzer Engineering SEL-451 relay protection systems
  - General Electric UR series protective relays with legacy firmware
- **Distribution Substations**: 35 distribution substations operating at 69kV-138kV
  - Older ABB MicroSCADA Pro systems still running Windows XP embedded
  - Siemens SICAM PAS automation platform with default passwords for maintenance access
  - Cooper Power Systems automated switches with web-based management interfaces
- **Remote Terminal Units**: RTUs deployed at unmanned switching stations
  - ABB RTU560 units with serial communication links
  - GE D20MX RTUs with Modbus TCP/IP connectivity enabled
  - Schweitzer Engineering RTAC real-time automation controllers

### Control Center Layer (Critical Zone)
- **Energy Management System**: Primary control center running ABB Network Manager v600
  - Oracle 11g database backend with automated historian data collection
  - PowerWorld Simulator for load flow analysis and contingency planning
  - Custom load forecasting applications using historical demand patterns
  - State estimation algorithms running every 15 seconds for system visibility
- **SCADA Master Station**: Redundant SCADA servers for real-time control operations
  - Primary and backup servers with automatic failover mechanisms
  - DNP3 protocol communication with field devices over dedicated networks
  - Historian database storing 5 years of operational data for trending and analysis
  - Operator workstations with multiple monitor configurations for system overview
- **Protection and Control Systems**: Critical infrastructure protection mechanisms
  - Special Protection Schemes (SPS) for automatic load shedding during emergencies
  - Wide Area Measurement System (WAMS) with phasor measurement units (PMUs)
  - Automatic Generation Control (AGC) for frequency regulation and economic dispatch

### IT Infrastructure Layer (Internal Zone)
- **Corporate Network**: Business operations and administrative functions
  - Active Directory domain controllers for user authentication and authorization
  - Microsoft Exchange Server 2016 for internal communications
  - Enterprise resource planning system for asset management and maintenance scheduling
  - Customer information system with billing and outage management capabilities
- **Engineering Workstations**: System planning and analysis tools
  - PowerFactory DIgSILENT for power system analysis and planning studies
  - AutoCAD electrical for substation design and engineering drawings
  - ETAP power system analysis software for protection coordination studies
  - PSS/E transmission planning software for long-term system expansion analysis

### External Connectivity (DMZ Zone)
- **Market Operations**: Connection to regional transmission organization (RTO)
  - ICCP (Inter-Control Center Communications Protocol) links for data exchange
  - Market bidding systems for energy and ancillary services trading
  - Outage coordination systems for planned maintenance scheduling
- **Regulatory Reporting**: Automated compliance and reporting systems
  - NERC CIP compliance monitoring and documentation systems
  - EPA emissions reporting for environmental compliance tracking
  - State utility commission reporting for reliability metrics and performance

## Operational Considerations

### Security Architecture
- Air-gapped networks between corporate IT and operational technology systems
- DMZ deployment of firewalls and intrusion detection systems for external connectivity
- Data diodes for one-way communication from OT to IT networks where required
- Regular security assessments and penetration testing of critical control systems

### Communication Protocols
- DNP3 Secure Authentication for critical control communications
- IEC 61850 GOOSE messaging for high-speed protection schemes
- Modbus TCP for integration with legacy field devices and equipment
- OPC-UA for secure data exchange between engineering and operational systems

### Maintenance Practices
- Scheduled maintenance windows coordinated with system operators and field crews
- Remote access capabilities for vendor support during equipment troubleshooting
- Spare equipment inventory maintained at regional service centers
- Emergency response procedures for cyber security incidents and system anomalies

### Business Continuity
- Backup control center facility with complete SCADA and EMS capabilities
- Generator black start procedures for system restoration following major outages
- Emergency load shedding schemes to prevent cascading failures during system stress
- Coordination agreements with neighboring utilities for mutual assistance during emergencies

## Recent Infrastructure Updates
- Migration from serial communication to IP-based networks for improved reliability
- Implementation of Advanced Metering Infrastructure (AMI) for enhanced customer data
- Deployment of synchrophasor technology for improved situational awareness
- Upgrade of legacy Windows XP systems to Windows 10 LTSC in most critical locations`,

  nodes: [
    // Security Zones - Strategic multi-dimensional layout
    // Top row (business/external layer):
    //   External: 2 nodes → 600px, x=50
    //   DMZ: 4 nodes → 750px, x=50+600+120=770
    //   Internal: 5 nodes → 800px, x=770+750+120=1640
    //
    // Bottom row (control/field layer):
    //   Critical: 4 nodes → 750px, x=770 (aligned under DMZ)
    //   OT: 6 nodes → 900px, x=770+750+120=1640 (aligned under Internal)

    {
      id: 'external-zone',
      type: 'securityZone',
      position: { x: 50, y: 50 },
      data: {
        label: 'External Zone',
        zoneType: 'External' as SecurityZone,
        description: 'External market and regulatory connections',
        zone: 'External' as SecurityZone
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
        description: 'Demilitarized zone for external communications'
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
        label: 'IT Network Zone',
        zoneType: 'Internal' as SecurityZone,
        description: 'Corporate IT infrastructure and business systems'
      },
      style: {
        width: 800,
        height: 1000,
        background: colors.zoneBackgrounds.Internal,
        zIndex: -1
      }
    } as SecurityNode,

    // Control systems layer (bottom row)
    {
      id: 'critical-zone',
      type: 'securityZone',
      position: { x: 770, y: 1170 },
      data: {
        label: 'Control Center Zone',
        zoneType: 'Critical' as SecurityZone,
        description: 'Mission-critical control systems and SCADA infrastructure'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Critical,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'ot-zone',
      type: 'securityZone',
      position: { x: 1640, y: 1170 },
      data: {
        label: 'Field Equipment Zone',
        zoneType: 'OT' as SecurityZone,
        description: 'Operational technology and field devices'
      },
      style: {
        width: 900,
        height: 1000,
        background: colors.zoneBackgrounds.OT,
        zIndex: -1
      }
    } as SecurityNode,

    // External Zone nodes (zone x=50, shift from old x=50: delta=0)
    {
      id: 'rto-market',
      type: 'gateway',
      position: { x: 225, y: 175 },
      data: {
        label: 'RTO Market Gateway',
        description: 'Regional Transmission Organization market operations',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        vendor: 'PJM',
        protocols: ['ICCP', 'HTTPS'],
        version: '12.1'
      }
    } as SecurityNode,
    {
      id: 'regulatory-portal',
      type: 'webServer',
      position: { x: 375, y: 725 },
      data: {
        label: 'Regulatory Portal',
        description: 'NERC CIP and EPA compliance reporting system',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        vendor: 'NERC',
        protocols: ['HTTPS', 'SFTP'],
        version: '3.2.1'
      }
    } as SecurityNode,

    // DMZ Zone nodes (zone x=770, shift from old x=820: delta=-50)
    {
      id: 'external-firewall',
      type: 'firewall',
      position: { x: 975, y: 175 },
      data: {
        label: 'External Firewall',
        description: 'Perimeter security for external connections',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        vendor: 'Fortinet',
        product: 'FortiGate',
        version: '6.4.2',
        protocols: ['any'],
        securityControls: ['IPS', 'DPI', 'VPN']
      }
    } as SecurityNode,
    {
      id: 'data-diode',
      type: 'gateway',
      position: { x: 875, y: 475 },
      data: {
        label: 'Data Diode',
        description: 'One-way data transfer device for OT data export',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'Waterfall Security',
        version: '8.1',
        protocols: ['UDP'],
        securityControls: ['One-way transfer']
      }
    } as SecurityNode,
    {
      id: 'historian-proxy',
      type: 'proxy',
      position: { x: 1225, y: 475 },
      data: {
        label: 'Historian Proxy',
        description: 'Data aggregation for corporate reporting',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        vendor: 'OSIsoft',
        product: 'PI System',
        version: '2018 SP3',  // Older version with known issues
        protocols: ['OPC-UA', 'DNP3']
      }
    } as SecurityNode,
    {
      id: 'compliance-db',
      type: 'database',
      position: { x: 975, y: 725 },
      data: {
        label: 'Compliance Database',
        description: 'NERC CIP compliance data storage',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'Microsoft',
        product: 'SQL Server',
        version: '2016',  // Older version
        protocols: ['TDS']
      }
    } as SecurityNode,

    // Internal Zone nodes (zone x=1640, shift from old x=1590: delta=+50)
    {
      id: 'it-firewall',
      type: 'firewall',
      position: { x: 1775, y: 275 },
      data: {
        label: 'IT Network Firewall',
        description: 'Corporate network perimeter security',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        vendor: 'Cisco',
        product: 'ASA',
        version: '9.12.4',
        protocols: ['any'],
        securityControls: ['Stateful inspection', 'VPN']
      }
    } as SecurityNode,
    {
      id: 'domain-controller',
      type: 'server',
      position: { x: 2075, y: 275 },
      data: {
        label: 'Domain Controller',
        description: 'Active Directory authentication server',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'Microsoft',
        product: 'Windows Server',
        version: '2016',
        protocols: ['Kerberos', 'LDAP'],
        securityControls: ['AD authentication']
      }
    } as SecurityNode,
    {
      id: 'engineering-workstation',
      type: 'workstation',
      position: { x: 2375, y: 275 },
      data: {
        label: 'Engineering Workstation',
        description: 'Power system analysis and planning tools',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        vendor: 'Dell',
        version: 'Windows 10',
        protocols: ['RDP', 'SSH'],
        technology: 'PowerFactory, ETAP, PSS/E'
      }
    } as SecurityNode,
    {
      id: 'asset-management',
      type: 'application',
      position: { x: 2075, y: 475 },
      data: {
        label: 'Asset Management System',
        description: 'Equipment lifecycle and maintenance management',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        vendor: 'IBM',
        product: 'Maximo',
        version: '7.6.1',
        protocols: ['HTTPS', 'SOAP']
      }
    } as SecurityNode,
    {
      id: 'corporate-database',
      type: 'database',
      position: { x: 2075, y: 725 },
      data: {
        label: 'Corporate Database',
        description: 'Business operations and customer data',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'Oracle',
        product: 'Database',
        version: '11g',  // Older version with known vulnerabilities
        protocols: ['Oracle Net']
      }
    } as SecurityNode,

    // Critical Zone nodes (zone x=770, shift from old x=820: delta=-50)
    {
      id: 'ot-firewall',
      type: 'industrialFirewall',
      position: { x: 975, y: 1275 },
      data: {
        label: 'OT Network Firewall',
        description: 'Industrial firewall protecting control systems',
        zone: 'Critical' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'Tofino Security',
        product: 'Xenon',
        version: '2.8.1',
        protocols: ['DNP3', 'Modbus', 'IEC61850'],
        securityControls: ['Protocol whitelisting', 'Deep packet inspection']
      }
    } as SecurityNode,
    {
      id: 'scada-master',
      type: 'scadaServer',
      position: { x: 825, y: 1475 },
      data: {
        label: 'SCADA Master Station',
        description: 'Primary control system for grid operations',
        zone: 'Critical' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'ABB',
        product: 'Network Manager',
        version: '600.3',
        protocols: ['DNP3', 'IEC61850', 'ICCP'],
        securityControls: ['Role-based access', 'Audit logging']
      }
    } as SecurityNode,
    {
      id: 'ems-server',
      type: 'application',
      position: { x: 1225, y: 1375 },
      data: {
        label: 'Energy Management System',
        description: 'Advanced grid analysis and optimization',
        zone: 'Critical' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'GE',
        product: 'ADMS',
        version: '4.1.2',
        protocols: ['CIM/XML', 'IEC61968'],
        securityControls: ['Encrypted communications']
      }
    } as SecurityNode,
    {
      id: 'operator-hmi',
      type: 'hmi',
      position: { x: 825, y: 1625 },
      data: {
        label: 'Operator HMI',
        description: 'Human machine interface for system operators',
        zone: 'Critical' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'Schneider Electric',
        product: 'ClearSCADA',
        version: '2019.2',
        protocols: ['DNP3', 'OPC'],
        technology: 'Windows 10 LTSC'
      }
    } as SecurityNode,
    {
      id: 'control-historian',
      type: 'historian',
      position: { x: 1375, y: 1875 },
      data: {
        label: 'Control System Historian',
        description: 'Real-time and historical operational data storage',
        zone: 'Critical' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'OSIsoft',
        product: 'PI Server',
        version: '2018 SP3',
        protocols: ['OPC-UA', 'PI-API'],
        securityControls: ['Data encryption', 'Access logging']
      }
    } as SecurityNode,

    // OT Zone nodes (zone x=1640, shift from old x=1590: delta=+50)
    {
      id: 'field-switch',
      type: 'industrialNetwork',
      position: { x: 1925, y: 1275 },
      data: {
        label: 'Substation Network Switch',
        description: 'Industrial Ethernet switch for field devices',
        zone: 'OT' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'Cisco',
        product: 'IE-3000',
        version: '15.2(7)E3',  // Firmware with known vulnerabilities
        protocols: ['Ethernet/IP', 'Modbus TCP'],
        securityControls: ['Port security', 'VLAN segmentation']
      }
    } as SecurityNode,
    {
      id: 'primary-substation',
      type: 'rtu',
      position: { x: 1725, y: 1475 },
      data: {
        label: 'Primary Substation RTU',
        description: '500kV transmission substation control system',
        zone: 'OT' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'ABB',
        product: 'RTU560',
        version: '3.2.1',
        protocols: ['DNP3', 'IEC61850'],
        securityControls: ['Secure authentication']
      }
    } as SecurityNode,
    {
      id: 'distribution-substation',
      type: 'rtu',
      position: { x: 2175, y: 1525 },
      data: {
        label: 'Distribution Substation',
        description: '138kV distribution substation automation',
        zone: 'OT' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'Siemens',
        product: 'SICAM PAS',
        version: '8.11',
        protocols: ['IEC61850', 'Modbus'],
        technology: 'Windows XP Embedded'  // Legacy OS vulnerability
      }
    } as SecurityNode,
    {
      id: 'protection-relay',
      type: 'plc',
      position: { x: 1925, y: 1625 },
      data: {
        label: 'Protection Relay',
        description: 'Transmission line protection and control',
        zone: 'OT' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'Schweitzer Engineering',
        product: 'SEL-451',
        version: '5.32',
        protocols: ['DNP3', 'GOOSE'],
        securityControls: ['DNP3 Secure Authentication']
      }
    } as SecurityNode,
    {
      id: 'pmu-sensor',
      type: 'sensor',
      position: { x: 1725, y: 1825 },
      data: {
        label: 'Phasor Measurement Unit',
        description: 'Synchrophasor measurement for grid monitoring',
        zone: 'OT' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'SEL',
        product: 'SEL-T401L',
        version: '1.2.15',
        protocols: ['IEEE C37.118', 'DNP3'],
        securityControls: ['GPS time synchronization']
      }
    } as SecurityNode,
    {
      id: 'field-maintenance',
      type: 'workstation',
      position: { x: 2175, y: 1875 },
      data: {
        label: 'Field Maintenance Laptop',
        description: 'Portable maintenance and configuration tool',
        zone: 'OT' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        vendor: 'Panasonic',
        product: 'Toughbook',
        version: 'Windows 10',
        protocols: ['Serial', 'Ethernet'],
        technology: 'Shared maintenance account'  // Security weakness
      }
    } as SecurityNode
  ],

  edges: [
    // External to DMZ connections
    {
      id: 'rto-to-firewall',
      source: 'rto-market',
      target: 'external-firewall',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Market Data Exchange',
        protocol: 'ICCP/TLS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'regulatory-to-firewall',
      source: 'regulatory-portal',
      target: 'external-firewall',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Compliance Reporting',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,

    // DMZ internal connections
    {
      id: 'firewall-to-diode',
      source: 'external-firewall',
      target: 'data-diode',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Filtered External Data',
        protocol: 'TCP',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'diode-to-proxy',
      source: 'data-diode',
      target: 'historian-proxy',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'One-way Data Transfer',
        protocol: 'UDP',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'proxy-to-compliance',
      source: 'historian-proxy',
      target: 'compliance-db',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Compliance Data Storage',
        protocol: 'SQL/TDS',
        encryption: 'none',  // Vulnerability: unencrypted database connection
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,

    // DMZ to Internal connections
    {
      id: 'firewall-to-it-firewall',
      source: 'external-firewall',
      target: 'it-firewall',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Corporate Network Access',
        protocol: 'TCP/IP',
        encryption: 'VPN',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,

    // Internal zone connections
    {
      id: 'it-firewall-to-dc',
      source: 'it-firewall',
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
      id: 'dc-to-engineering',
      source: 'domain-controller',
      target: 'engineering-workstation',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'User Authentication',
        protocol: 'Kerberos',
        encryption: 'Kerberos',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'asset-mgmt-to-db',
      source: 'asset-management',
      target: 'corporate-database',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Asset Data',
        protocol: 'Oracle Net',
        encryption: 'none',  // Vulnerability: unencrypted database connection
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,

    // Internal to Critical connections (vertical connection to zone below)
    {
      id: 'it-firewall-to-ot-firewall',
      source: 'it-firewall',
      target: 'ot-firewall',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'IT/OT Interface',
        protocol: 'TCP/IP',
        encryption: 'IPSec',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Critical' as SecurityZone
      }
    } as SecurityEdge,

    // Critical zone connections
    {
      id: 'ot-firewall-to-scada',
      source: 'ot-firewall',
      target: 'scada-master',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Control System Access',
        protocol: 'DNP3',
        encryption: 'DNP3 SAv5',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Critical' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'scada-to-ems',
      source: 'scada-master',
      target: 'ems-server',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'System State Data',
        protocol: 'CIM/XML',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Critical' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'scada-to-hmi',
      source: 'scada-master',
      target: 'operator-hmi',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Operator Interface',
        protocol: 'OPC',
        encryption: 'none',  // Vulnerability: unencrypted OPC
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Critical' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'scada-to-historian',
      source: 'scada-master',
      target: 'control-historian',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Historical Data',
        protocol: 'PI-API',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Critical' as SecurityZone
      }
    } as SecurityEdge,

    // Critical to OT connections (horizontal connection within same row)
    {
      id: 'ot-firewall-to-switch',
      source: 'ot-firewall',
      target: 'field-switch',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Field Network Access',
        protocol: 'Ethernet/IP',
        encryption: 'none',  // Vulnerability: unencrypted field communications
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'OT' as SecurityZone
      }
    } as SecurityEdge,

    // OT zone connections
    {
      id: 'switch-to-primary-rtu',
      source: 'field-switch',
      target: 'primary-substation',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Primary Substation Control',
        protocol: 'DNP3',
        encryption: 'DNP3 SAv5',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'OT' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'switch-to-dist-sub',
      source: 'field-switch',
      target: 'distribution-substation',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Distribution Control',
        protocol: 'IEC61850',
        encryption: 'none',  // Vulnerability: legacy system unencrypted
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'OT' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'switch-to-relay',
      source: 'field-switch',
      target: 'protection-relay',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Protection System',
        protocol: 'GOOSE',
        encryption: 'none',  // GOOSE protocol limitation
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'OT' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'primary-to-pmu',
      source: 'primary-substation',
      target: 'pmu-sensor',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Synchrophasor Data',
        protocol: 'IEEE C37.118',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'OT' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'dist-to-maintenance',
      source: 'distribution-substation',
      target: 'field-maintenance',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Maintenance Access',
        protocol: 'Serial/Ethernet',
        encryption: 'none',  // Vulnerability: shared maintenance account
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'OT' as SecurityZone
      }
    } as SecurityEdge,

    // Cross-zone data flows (historian to DMZ)
    {
      id: 'historian-to-proxy',
      source: 'control-historian',
      target: 'historian-proxy',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Data Export',
        protocol: 'OPC-UA',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge
  ],

  attackPaths: [
    {
      id: 'egs-ap-rto-to-relay',
      name: 'RTO Market Gateway → SCADA Master → Protection Relay Disabling',
      strideCategory: 'Tampering',
      riskLevel: 'Critical',
      description: 'An attacker compromises the ICCP link from the RTO market gateway, traverses the external and OT firewalls to reach the SCADA master, and sends unauthorized DNP3 commands through the field network switch to disable protection relays, potentially causing cascading failures during grid fault conditions.',
      steps: [
        { order: 1, edgeId: 'rto-to-firewall', sourceNodeId: 'rto-market', targetNodeId: 'external-firewall', technique: 'T1190: Exploit Public-Facing Application' },
        { order: 2, edgeId: 'firewall-to-it-firewall', sourceNodeId: 'external-firewall', targetNodeId: 'it-firewall', technique: 'T1071: Application Layer Protocol' },
        { order: 3, edgeId: 'it-firewall-to-ot-firewall', sourceNodeId: 'it-firewall', targetNodeId: 'ot-firewall', technique: 'T1021: Remote Services' },
        { order: 4, edgeId: 'ot-firewall-to-scada', sourceNodeId: 'ot-firewall', targetNodeId: 'scada-master', technique: 'T0886: Remote Services (ICS)' },
        { order: 5, edgeId: 'switch-to-relay', sourceNodeId: 'field-switch', targetNodeId: 'protection-relay', technique: 'T0855: Unauthorized Command Message (ICS)' },
      ],
      mitreTechniques: ['T1190', 'T1071', 'T1021', 'T0886', 'T0855'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'egs-ap-it-ot-pivot',
      name: 'Engineering Workstation IT/OT Pivot → SCADA Compromise',
      strideCategory: 'Elevation of Privilege',
      riskLevel: 'High',
      description: 'An insider or attacker who compromises the dual-homed engineering workstation leverages its IT domain credentials and OT network access to traverse the IT/OT firewall boundary, reaching the SCADA master station to manipulate grid control operations.',
      steps: [
        { order: 1, edgeId: 'dc-to-engineering', sourceNodeId: 'domain-controller', targetNodeId: 'engineering-workstation', technique: 'T1078: Valid Accounts (domain credentials)' },
        { order: 2, edgeId: 'it-firewall-to-ot-firewall', sourceNodeId: 'it-firewall', targetNodeId: 'ot-firewall', technique: 'T1021: Remote Services (RDP)' },
        { order: 3, edgeId: 'ot-firewall-to-scada', sourceNodeId: 'ot-firewall', targetNodeId: 'scada-master', technique: 'T0886: Remote Services (ICS)' },
      ],
      mitreTechniques: ['T1078', 'T1021', 'T0886'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'egs-ap-dist-sub-exploit',
      name: 'Field Maintenance Laptop → Legacy Distribution Substation Exploitation',
      strideCategory: 'Tampering',
      riskLevel: 'High',
      description: 'A compromised or stolen field maintenance laptop with shared credentials connects to a Windows XP-based distribution substation via the unencrypted serial/Ethernet link, enabling unauthorized modification of SICAM PAS automation parameters and distribution switching.',
      steps: [
        { order: 1, edgeId: 'dist-to-maintenance', sourceNodeId: 'distribution-substation', targetNodeId: 'field-maintenance', technique: 'T1078: Valid Accounts (shared maintenance)' },
        { order: 2, edgeId: 'switch-to-dist-sub', sourceNodeId: 'field-switch', targetNodeId: 'distribution-substation', technique: 'T1210: Exploitation of Remote Services' },
        { order: 3, edgeId: 'switch-to-primary-rtu', sourceNodeId: 'field-switch', targetNodeId: 'primary-substation', technique: 'T0836: Modify Parameter (ICS)' },
      ],
      mitreTechniques: ['T1078', 'T1210', 'T0836'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'egs-ap-historian-exfil',
      name: 'Historian Proxy → Compliance Database → Operational Data Exfiltration',
      strideCategory: 'Information Disclosure',
      riskLevel: 'Medium',
      description: 'An attacker exploits vulnerabilities in the outdated OSIsoft PI System historian proxy in the DMZ and leverages the unencrypted SQL connection to the compliance database to exfiltrate confidential grid operational data including load patterns, protection settings, and substation configurations.',
      steps: [
        { order: 1, edgeId: 'historian-to-proxy', sourceNodeId: 'control-historian', targetNodeId: 'historian-proxy', technique: 'T1557: Adversary-in-the-Middle (OPC-UA intercept)' },
        { order: 2, edgeId: 'proxy-to-compliance', sourceNodeId: 'historian-proxy', targetNodeId: 'compliance-db', technique: 'T1565: Data Manipulation (unencrypted SQL)' },
        { order: 3, edgeId: 'diode-to-proxy', sourceNodeId: 'data-diode', targetNodeId: 'historian-proxy', technique: 'T1530: Data from Information Repositories' },
      ],
      mitreTechniques: ['T1557', 'T1565', 'T1530'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
  ],
};
