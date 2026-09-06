// vulnerableScada.ts
import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityZone, SecurityEdge, SecurityNode } from '../../types/SecurityTypes';
import { DiagramAttackPath, AssessmentThreatModelNodeSourceType, AssessmentThreatModelEdgeSourceType, AttackPathRiskLevel } from '../../types/GrcTypes';
import { colors } from '../../styles/Theme';
import { buildGrcWorkspace, score, NOW, OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID } from './grcSharedBase';
import { StrideCategory } from '../../types/ThreatIntelTypes';
const tierCatalogue = [
  { id: 'tier1-cyber', tier: 1 as const, label: 'Cyber Risk', description: 'Information security and cyber threats to industrial systems' },
  { id: 'tier1-operational', tier: 1 as const, label: 'Operational Risk', description: 'Process safety, availability, and reliability risks' },
  { id: 'tier2-ot-network', tier: 2 as const, label: 'OT Network Security', parentId: 'tier1-cyber', description: 'Industrial network segmentation and protocol security' },
  { id: 'tier2-identity', tier: 2 as const, label: 'Identity & Access', parentId: 'tier1-cyber', description: 'Authentication and authorization for ICS components' },
  { id: 'tier2-data', tier: 2 as const, label: 'Data Protection', parentId: 'tier1-cyber', description: 'Process data, historian data, and configuration protection' },
  { id: 'tier2-remote-access', tier: 2 as const, label: 'Remote Access', parentId: 'tier1-cyber', description: 'VPN, vendor access, and cloud connectivity controls' },
  { id: 'tier2-safety', tier: 2 as const, label: 'Safety System Integrity', parentId: 'tier1-operational', description: 'Protection of safety instrumented systems' },
  { id: 'tier2-monitoring', tier: 2 as const, label: 'Security Monitoring', parentId: 'tier1-operational', description: 'OT threat detection, logging, and incident response' },
  { id: 'tier3-unenc-protocols', tier: 3 as const, label: 'Unencrypted Industrial Protocols', parentId: 'tier2-ot-network' },
  { id: 'tier3-flat-ot-network', tier: 3 as const, label: 'Insufficient OT Segmentation', parentId: 'tier2-ot-network' },
  { id: 'tier3-weak-plc-auth', tier: 3 as const, label: 'Weak PLC Authentication', parentId: 'tier2-identity' },
  { id: 'tier3-vendor-access', tier: 3 as const, label: 'Uncontrolled Vendor Access', parentId: 'tier2-remote-access' },
  { id: 'tier3-cloud-exposure', tier: 3 as const, label: 'Cloud Gateway Exposure', parentId: 'tier2-remote-access' },
  { id: 'tier3-sis-bypass', tier: 3 as const, label: 'Safety System Bypass', parentId: 'tier2-safety' },
  { id: 'tier3-historian-leak', tier: 3 as const, label: 'Historian Data Leakage', parentId: 'tier2-data' },
  { id: 'tier3-log-gaps', tier: 3 as const, label: 'OT Logging Gaps', parentId: 'tier2-monitoring' },
  { id: 'tier4-modbus-hardening', tier: 4 as const, label: 'Modbus/S7 Protocol Hardening', parentId: 'tier3-unenc-protocols' },
  { id: 'tier4-vlan-enforcement', tier: 4 as const, label: 'VLAN Enforcement', parentId: 'tier3-flat-ot-network' },
  { id: 'tier4-plc-credential-mgmt', tier: 4 as const, label: 'PLC Credential Management', parentId: 'tier3-weak-plc-auth' },
  { id: 'tier4-vendor-session-control', tier: 4 as const, label: 'Vendor Session Controls', parentId: 'tier3-vendor-access' },
];

const assets = [
  {
    id: 'asset-scada-server', name: 'AVEVA SCADA Server', type: 'scada_server', owner: 'OT Engineering',
    domain: 'ot' as const, category: 'Control System',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Central SCADA server controlling production and utilities via OPC UA/DA',
    criticality: { confidentiality: 4, integrity: 5, availability: 5, financial: 5, reputation: 4, safety: 5 },
    diagramRefs: [{ diagramId: 'industrial-scada', nodeId: 'scada-server', nodeLabel: 'SCADA Server', nodeType: 'scadaServer' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-plc-production', name: 'Siemens S7-1500 Production PLC', type: 'plc', owner: 'OT Engineering',
    domain: 'ot' as const, category: 'Field Device',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Production line controller using S7 Communication and Modbus TCP',
    criticality: { confidentiality: 3, integrity: 5, availability: 5, financial: 5, reputation: 4, safety: 5 },
    diagramRefs: [{ diagramId: 'industrial-scada', nodeId: 'plc-production', nodeLabel: 'Production PLC', nodeType: 'plc' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-historian', name: 'OSIsoft PI Historian', type: 'historian', owner: 'OT Engineering',
    domain: 'ot' as const, category: 'Data System',
    businessCriticality: 4, securityCriticality: 4,
    description: 'Process data historian storing operational data for trending and compliance',
    criticality: { confidentiality: 4, integrity: 4, availability: 3, financial: 3, reputation: 3, safety: 2 },
    diagramRefs: [{ diagramId: 'industrial-scada', nodeId: 'historian-server', nodeLabel: 'Process Historian', nodeType: 'historian' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-emergency-shutdown', name: 'Triconex Emergency Shutdown System', type: 'safety_system', owner: 'Process Safety',
    domain: 'ot' as const, category: 'Safety System',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Safety instrumented system for emergency plant shutdown with hardware-based safety',
    criticality: { confidentiality: 3, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 5 },
    diagramRefs: [{ diagramId: 'industrial-scada', nodeId: 'emergency-shutdown', nodeLabel: 'Emergency Shutdown System', nodeType: 'safetySystem' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-industrial-firewall', name: 'FortiGate Industrial Firewall', type: 'network_device', owner: 'OT Network Security',
    domain: 'ot' as const, category: 'Network Infrastructure',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Industrial firewall with deep packet inspection for OT protocol validation',
    criticality: { confidentiality: 3, integrity: 5, availability: 5, financial: 4, reputation: 4, safety: 3 },
    diagramRefs: [{ diagramId: 'industrial-scada', nodeId: 'industrial-firewall', nodeLabel: 'Industrial Firewall', nodeType: 'industrialFirewall' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-vpn-gateway', name: 'Cisco ASA VPN Gateway', type: 'network_device', owner: 'IT Security',
    domain: 'it' as const, category: 'Network Infrastructure',
    businessCriticality: 4, securityCriticality: 5,
    description: 'VPN concentrator for vendor remote access and cloud connectivity',
    criticality: { confidentiality: 4, integrity: 4, availability: 4, financial: 3, reputation: 3, safety: 2 },
    diagramRefs: [{ diagramId: 'industrial-scada', nodeId: 'vpn-gateway', nodeLabel: 'VPN Gateway', nodeType: 'vpnGateway' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-engineering-workstation', name: 'Engineering Workstation', type: 'workstation', owner: 'OT Engineering',
    domain: 'it' as const, category: 'Workstation',
    businessCriticality: 4, securityCriticality: 4,
    description: 'Dell Precision workstation used for PLC programming and SCADA configuration',
    criticality: { confidentiality: 4, integrity: 5, availability: 3, financial: 3, reputation: 3, safety: 3 },
    diagramRefs: [{ diagramId: 'industrial-scada', nodeId: 'engineering-workstation', nodeLabel: 'Engineering Workstation', nodeType: 'workstation' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-iiot-gateway', name: 'Cisco IR1101 IIoT Gateway', type: 'gateway', owner: 'OT Engineering',
    domain: 'ot' as const, category: 'IoT Infrastructure',
    businessCriticality: 3, securityCriticality: 4,
    description: 'Industrial IoT gateway aggregating sensor data via MQTT and OPC UA',
    criticality: { confidentiality: 3, integrity: 4, availability: 3, financial: 3, reputation: 2, safety: 2 },
    diagramRefs: [{ diagramId: 'industrial-scada', nodeId: 'iiot-gateway', nodeLabel: 'IIoT Gateway', nodeType: 'gateway' }],
    createdAt: NOW, updatedAt: NOW
  },
];

const risks = [
  {
    id: 'risk-unenc-scada-traffic', title: 'Unencrypted SCADA Control Traffic',
    description: 'S7 Communication, Modbus TCP, and OPC DA protocols between PLCs and SCADA server transmit process control data without encryption, enabling eavesdropping and command injection by an attacker with OT network access.',
    status: 'assessed' as const, owner: 'OT Network Security',
    tierPath: { tier1: 'Cyber Risk', tier2: 'OT Network Security', tier3: 'Unencrypted Industrial Protocols' },
    assetIds: ['asset-scada-server', 'asset-plc-production'],
    diagramLinks: [{ diagramId: 'industrial-scada', nodeIds: ['scada-server', 'plc-production', 'plc-utilities', 'industrial-switch'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Migrate to OPC UA with TLS where supported; deploy network-level encryption wrappers for legacy Modbus/S7 traffic',
    threatActorIds: ['threat-actor-nation-state'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-weak-plc-auth', title: 'Weak PLC Authentication Controls',
    description: 'Production PLC relies on password-based authentication with basic ACLs. Password complexity is not enforced and credential rotation is manual, increasing risk of unauthorized programming changes.',
    status: 'draft' as const, owner: 'OT Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Identity & Access', tier3: 'Weak PLC Authentication' },
    assetIds: ['asset-plc-production'],
    diagramLinks: [{ diagramId: 'industrial-scada', nodeIds: ['plc-production'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Implement certificate-based authentication for PLC access; enforce quarterly credential rotation',
    threatActorIds: ['threat-actor-nation-state'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-vendor-remote-access', title: 'Uncontrolled Vendor Remote Access Path',
    description: 'Vendor workstation connects via SSL VPN to the VPN gateway, which tunnels through the industrial firewall into the OT network. Session monitoring is limited to recording without real-time alerting, and vendor scope is not restricted to specific target systems.',
    status: 'assessed' as const, owner: 'IT Security',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Remote Access', tier3: 'Uncontrolled Vendor Access' },
    assetIds: ['asset-vpn-gateway', 'asset-industrial-firewall'],
    diagramLinks: [{ diagramId: 'industrial-scada', nodeIds: ['vendor-workstation', 'vpn-gateway', 'industrial-firewall'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Implement just-in-time access provisioning for vendors; add real-time session monitoring with automated termination',
    threatActorIds: ['threat-actor-vendor-compromise'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-safety-plc-network-exposure', title: 'Safety PLC Connected to OT Network',
    description: 'Safety PLC 2 in the Critical Zone has a network path to the SCADA server in the OT Zone via PROFIsafe. While the safety protocol provides functional safety, a compromised SCADA server could attempt to manipulate safety system status monitoring.',
    status: 'assessed' as const, owner: 'Process Safety',
    tierPath: { tier1: 'Operational Risk', tier2: 'Safety System Integrity', tier3: 'Safety System Bypass' },
    assetIds: ['asset-emergency-shutdown', 'asset-scada-server'],
    diagramLinks: [{ diagramId: 'industrial-scada', nodeIds: ['safety-plc', 'scada-server', 'emergency-shutdown'] }],
    inherentScore: score('likelihood-2', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Deploy dedicated safety network with hardware-enforced data diode for safety status export; eliminate bidirectional connectivity',
    threatActorIds: ['threat-actor-nation-state'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-historian-data-diode-bypass', title: 'Historian Data Exposed via Unencrypted Diode Transfer',
    description: 'Historical process data flows from the OT historian through the data diode to the backup server using unencrypted one-way TCP. While the diode prevents reverse flow, confidential process data is transmitted in cleartext across the DMZ.',
    status: 'draft' as const, owner: 'OT Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Data Protection', tier3: 'Historian Data Leakage' },
    assetIds: ['asset-historian'],
    diagramLinks: [{ diagramId: 'industrial-scada', nodeIds: ['historian-server', 'data-diode', 'backup-server'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Enable application-layer encryption on data diode transfer channel; classify and filter historian exports',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-cloud-gateway-ot-path', title: 'Cloud Gateway to OT Network via Industrial Firewall',
    description: 'Azure IoT Edge cloud gateway connects directly to the industrial firewall, creating an internet-reachable path into the DMZ. A compromised cloud tenant or misconfigured firewall rule could allow lateral movement toward OT systems.',
    status: 'assessed' as const, owner: 'IT Security',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Remote Access', tier3: 'Cloud Gateway Exposure' },
    assetIds: ['asset-industrial-firewall'],
    diagramLinks: [{ diagramId: 'industrial-scada', nodeIds: ['cloud-gateway', 'industrial-firewall'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Route cloud gateway through a dedicated cloud DMZ segment with unidirectional data flow; add application-layer allowlisting',
    threatActorIds: ['threat-actor-nation-state'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-engineering-ws-pivot', title: 'Engineering Workstation as Lateral Movement Pivot',
    description: 'Engineering workstation has RDP access through the industrial firewall to OT systems and domain authentication to the corporate network. Compromise of this dual-homed workstation enables lateral movement between IT and OT zones.',
    status: 'draft' as const, owner: 'OT Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'OT Network Security', tier3: 'Insufficient OT Segmentation' },
    assetIds: ['asset-engineering-workstation', 'asset-industrial-firewall'],
    diagramLinks: [{ diagramId: 'industrial-scada', nodeIds: ['engineering-workstation', 'industrial-firewall', 'domain-controller'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Implement privileged access workstation with jump server; enforce network-level segmentation between engineering and domain controller',
    threatActorIds: ['threat-actor-insider'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-ot-monitoring-gaps', title: 'Incomplete OT Security Monitoring Coverage',
    description: 'OT security monitor receives traffic from the industrial firewall SPAN port but does not have visibility into intra-OT-zone traffic between PLCs, HMI, and the industrial switch. Attackers who pivot past the firewall operate undetected within the OT zone.',
    status: 'assessed' as const, owner: 'OT Network Security',
    tierPath: { tier1: 'Operational Risk', tier2: 'Security Monitoring', tier3: 'OT Logging Gaps' },
    assetIds: ['asset-scada-server', 'asset-plc-production'],
    diagramLinks: [{ diagramId: 'industrial-scada', nodeIds: ['ot-security-monitor', 'industrial-firewall', 'industrial-switch'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Deploy additional SPAN/TAP sensors on the industrial switch to provide full OT-zone traffic visibility to the Dragos platform',
    createdAt: NOW, updatedAt: NOW
  },
];

const assessments = [
  {
    id: 'assessment-ics-security-review', title: 'ICS/SCADA Security Posture Assessment',
    status: 'in_review' as const,
    owner: 'OT Security Architecture',
    reviewer: 'CISO',
    startDate: '2025-05-01',
    dueDate: '2025-07-15',
    threatActorIds: ['threat-actor-nation-state', 'threat-actor-vendor-compromise', 'threat-actor-insider'],
    methodologyNote: 'Assessment follows IEC 62443 risk assessment methodology with NIST SP 800-82 control mapping for industrial control systems.',
    assumptionNote: 'Assessment covers production OT and DMZ zones. Critical zone safety systems assessed for cyber-physical attack vectors only.',
    scopeItems: [
      { id: 'scope-system-scada', type: 'system' as const, value: 'system', name: 'SCADA Control System' },
      { id: 'scope-zone-ot', type: 'diagram_segment' as const, value: 'OT', name: 'OT Zone' },
      { id: 'scope-zone-dmz', type: 'diagram_segment' as const, value: 'DMZ', name: 'DMZ Zone' },
      { id: 'scope-zone-critical', type: 'diagram_segment' as const, value: 'Critical', name: 'Critical Zone' },
    ],
    tierFilter: { tier1: 'Cyber Risk' },
    riskManagementPlan: {
      objective: 'Reduce cyber-physical attack surface and enforce defense-in-depth between IT and OT networks.',
      strategy: 'Prioritize safety system isolation, eliminate unencrypted control traffic, and harden vendor remote access paths.',
      residualRiskStatement: 'Residual risk accepted only for legacy protocol traffic with compensating network monitoring controls.',
      monitoringApproach: 'Bi-weekly review of open plan actions with monthly OT security posture report to safety committee.',
      communicationPlan: 'Report progress to OT Security Steering Committee and Process Safety Board monthly.',
      reviewCadenceDays: 14,
      actions: [
        {
          id: 'rmp-action-encrypt-ot-traffic',
          title: 'Deploy OPC UA TLS and Modbus TCP wrappers for SCADA-PLC traffic',
          owner: 'OT Engineering',
          dueDate: '2025-08-30',
          status: 'in_progress' as const,
          linkedRiskIds: ['risk-unenc-scada-traffic'],
          notes: 'OPC UA TLS certificates generated; testing on non-production PLC'
        },
        {
          id: 'rmp-action-vendor-jit-access',
          title: 'Implement just-in-time vendor access provisioning with session monitoring',
          owner: 'IT Security',
          dueDate: '2025-07-31',
          status: 'planned' as const,
          linkedRiskIds: ['risk-vendor-remote-access'],
          notes: 'Evaluating CyberArk Privileged Access for OT vendor sessions'
        },
        {
          id: 'rmp-action-safety-isolation',
          title: 'Deploy hardware data diode for safety system status export',
          owner: 'Process Safety',
          dueDate: '2025-09-15',
          status: 'planned' as const,
          linkedRiskIds: ['risk-safety-plc-network-exposure'],
          notes: 'Owl Cyber Defense DualDiode procurement approved'
        },
        {
          id: 'rmp-action-plc-cert-auth',
          title: 'Upgrade PLC authentication to certificate-based with quarterly rotation',
          owner: 'OT Engineering',
          dueDate: '2025-08-15',
          status: 'in_progress' as const,
          linkedRiskIds: ['risk-weak-plc-auth'],
          notes: 'Siemens SINEMA Remote Connect evaluation in progress'
        },
      ],
      updatedAt: NOW
    },
    riskIds: risks.map(r => r.id),
    soaGapIds: ['soa-a02', 'soa-a05', 'soa-a07'],
    taskIds: ['task-ot-protocol-encryption', 'task-vendor-access-hardening', 'task-ot-span-expansion'],
    linkedImplementedControlIds: [],
    linkedInitiativeIds: [],
    summary: 'Comprehensive ICS/SCADA security assessment covering 8 identified risks across OT, DMZ, and Critical zones. Two risks rated Critical, four rated High.',
    findings: 'Key findings include unencrypted industrial protocol traffic, weak PLC authentication, dual-homed engineering workstation, and insufficient intra-OT-zone monitoring.',
    recommendations: 'Prioritize encryption of SCADA-PLC traffic, isolate safety systems with hardware data diodes, and deploy OT-zone-level network monitoring.',
    evidenceSummary: 'Evidence includes Dragos platform scan output, firewall rule exports, and OT network topology documentation.',
    threatModel: {
      nodes: [
        { id: 'tm-node-vendor', label: 'Vendor Workstation', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'vendor-workstation', position: { x: 50, y: 150 }, nodeType: 'workstation' },
        { id: 'tm-node-vpn', label: 'VPN Gateway', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'vpn-gateway', position: { x: 200, y: 150 }, nodeType: 'vpnGateway' },
        { id: 'tm-node-ind-fw', label: 'Industrial Firewall', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'industrial-firewall', position: { x: 350, y: 150 }, nodeType: 'industrialFirewall', commentary: 'Central gateway between IT/External and OT zones' },
        { id: 'tm-node-scada', label: 'SCADA Server', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'scada-server', position: { x: 500, y: 150 }, nodeType: 'scadaServer', commentary: 'Receives unencrypted S7/Modbus from PLCs' },
        { id: 'tm-node-plc-prod', label: 'Production PLC', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'plc-production', position: { x: 650, y: 100 }, nodeType: 'plc', commentary: 'Password-based authentication only' },
        { id: 'tm-node-safety-plc', label: 'Safety PLC', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'safety-plc', position: { x: 650, y: 250 }, nodeType: 'plc', commentary: 'Connected to SCADA via PROFIsafe' },
        { id: 'tm-node-eis', label: 'Emergency Shutdown', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'emergency-shutdown', position: { x: 800, y: 250 }, nodeType: 'safetySystem' },
      ],
      edges: [
        { id: 'tm-edge-vendor-vpn', source: 'tm-node-vendor', target: 'tm-node-vpn', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'edge-vendor-vpn', label: 'SSL VPN', commentary: 'Vendor access path with limited session monitoring' },
        { id: 'tm-edge-vpn-fw', source: 'tm-node-vpn', target: 'tm-node-ind-fw', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'edge-vpn-firewall', label: 'IPSec Tunnel' },
        { id: 'tm-edge-fw-scada', source: 'tm-node-ind-fw', target: 'tm-node-scada', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'edge-scada-firewall', label: 'HTTPS (reverse)', commentary: 'Bidirectional data export path' },
        { id: 'tm-edge-scada-plc', source: 'tm-node-scada', target: 'tm-node-plc-prod', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'edge-plc-production-scada', label: 'S7 (unencrypted)', commentary: 'Cleartext process control commands' },
        { id: 'tm-edge-safety-scada', source: 'tm-node-safety-plc', target: 'tm-node-scada', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'edge-safety-plc-scada', label: 'PROFIsafe Status' },
      ],
      attackPathDescription: 'Two critical attack paths identified: (1) Vendor remote access through VPN to SCADA to PLC enables unauthorized process manipulation; (2) Compromised SCADA server can attempt safety system status manipulation through the PROFIsafe monitoring connection.',
      attackPaths: [
        {
          id: 'aap-vendor-to-plc',
          name: 'Vendor Remote Access → PLC Process Manipulation',
          strideCategory: 'Tampering' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'An attacker compromises vendor credentials or the vendor workstation, traverses the VPN tunnel through the industrial firewall, reaches the SCADA server, and exploits weak PLC authentication to inject unauthorized process commands.',
          diagramAttackPathId: 'ap-vendor-to-plc',
          steps: [
            { order: 1, edgeId: 'edge-vendor-vpn', sourceNodeId: 'vendor-workstation', targetNodeId: 'vpn-gateway', technique: 'T1133: External Remote Services' },
            { order: 2, edgeId: 'edge-vpn-firewall', sourceNodeId: 'vpn-gateway', targetNodeId: 'industrial-firewall', technique: 'T1021: Remote Services' },
            { order: 3, edgeId: 'edge-scada-firewall', sourceNodeId: 'industrial-firewall', targetNodeId: 'scada-server', technique: 'T1071: Application Layer Protocol' },
            { order: 4, edgeId: 'edge-plc-production-scada', sourceNodeId: 'scada-server', targetNodeId: 'plc-production', technique: 'T0843: Program Download (ICS)' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
        {
          id: 'aap-scada-to-safety',
          name: 'SCADA Compromise → Safety System Status Manipulation',
          strideCategory: 'Elevation of Privilege' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'An attacker who has compromised the SCADA server attempts to manipulate safety system status monitoring via the PROFIsafe connection to the Safety PLC, potentially masking dangerous conditions from the emergency shutdown system.',
          diagramAttackPathId: 'ap-scada-to-safety',
          steps: [
            { order: 1, edgeId: 'edge-safety-plc-scada', sourceNodeId: 'scada-server', targetNodeId: 'safety-plc', technique: 'T0855: Unauthorized Command Message (ICS)' },
            { order: 2, edgeId: 'edge-emergency-safety-plc', sourceNodeId: 'safety-plc', targetNodeId: 'emergency-shutdown', technique: 'T0816: Device Restart/Shutdown (ICS)' },
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
    justification: 'SCADA server uses Active Directory integration; however, PLC access relies on weak password-based controls and HMI has basic multi-user authentication without role granularity.',
    mitigatesRiskIds: ['risk-weak-plc-auth'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-a02', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A02', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'S7 Communication, Modbus TCP, and OPC DA traffic between PLCs and SCADA server is unencrypted. Historian data diode transfer also lacks application-layer encryption.',
    mitigatesRiskIds: ['risk-unenc-scada-traffic', 'risk-historian-data-diode-bypass'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-a04', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A04', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'planned' as const,
    justification: 'Architecture review planned to address dual-homed engineering workstation, cloud gateway direct connection, and safety system network exposure.',
    mitigatesRiskIds: ['risk-engineering-ws-pivot', 'risk-cloud-gateway-ot-path', 'risk-safety-plc-network-exposure'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-a05', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A05', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Multiple misconfigurations: PLC password-based auth without complexity enforcement, vendor access without system-level scope restrictions, cloud gateway with direct firewall connection.',
    mitigatesRiskIds: ['risk-weak-plc-auth', 'risk-vendor-remote-access', 'risk-cloud-gateway-ot-path'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-a07', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A07', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'VPN gateway uses MFA with RSA SecurID. However, vendor workstation relies on pre-shared key auth. PLC and HMI authentication needs hardening.',
    mitigatesRiskIds: ['risk-vendor-remote-access', 'risk-weak-plc-auth'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-a09', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A09', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'implemented' as const,
    justification: 'Dragos OT Security Monitor and Claroty xDome provide network-level monitoring. However, coverage is limited to DMZ/firewall traffic; intra-OT-zone traffic from the industrial switch is not monitored.',
    mitigatesRiskIds: ['risk-ot-monitoring-gaps'],
    diagramRefs: [],
    evidence: [
      {
        id: 'evidence-a09-dragos',
        kind: 'link' as const,
        name: 'Dragos Platform deployment report',
        url: 'https://security.example.local/reports/dragos-deployment',
        note: 'Initial deployment coverage assessment',
        createdAt: NOW
      }
    ],
    updatedAt: NOW
  },
  {
    id: 'soa-cis-01', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.01', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'implemented' as const,
    justification: 'OT asset inventory maintained via Claroty xDome and Dragos platform auto-discovery. IT assets tracked in corporate CMDB.',
    mitigatesRiskIds: [], diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-cis-03', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.03', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Process control data transmitted in cleartext. Historian data diode transfer unencrypted. Backup server uses SMB3 encryption but source data arrives unprotected.',
    mitigatesRiskIds: ['risk-unenc-scada-traffic', 'risk-historian-data-diode-bypass'], diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-cis-04', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.04', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'FortiGate firewall uses hardened configuration with DPI. PLC and HMI configurations follow vendor defaults with limited hardening.',
    mitigatesRiskIds: ['risk-weak-plc-auth', 'risk-cloud-gateway-ot-path'],
    diagramRefs: [],
    evidence: [
      { id: 'evidence-cis04-fortigate', kind: 'link' as const, name: 'FortiGate hardening baseline',
        url: 'https://security.example.local/docs/fortigate-baseline', note: 'CIS FortiGate benchmark results', createdAt: NOW }
    ],
    updatedAt: NOW
  },
  {
    id: 'soa-cis-06', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.06', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'planned' as const,
    justification: 'RBAC implemented for SCADA and AD-integrated systems. Vendor remote access lacks granular system-level scope. PLC access control needs certificate migration.',
    mitigatesRiskIds: ['risk-vendor-remote-access', 'risk-weak-plc-auth'], diagramRefs: [], evidence: [], updatedAt: NOW
  },
];

const workflowTasks = [
  {
    id: 'task-ot-protocol-encryption',
    title: 'Deploy OPC UA TLS and Modbus TCP encryption wrappers',
    description: 'Encrypt SCADA-to-PLC control traffic using OPC UA Security Mode Sign&Encrypt where supported, and deploy Modbus TCP encryption wrappers for legacy devices.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'critical' as const,
    owner: 'OT Engineering',
    dueDate: '2025-08-30',
    riskId: 'risk-unenc-scada-traffic',
    createdAt: NOW,
    updatedAt: NOW
  },
  {
    id: 'task-vendor-access-hardening',
    title: 'Implement just-in-time vendor access with real-time session monitoring',
    description: 'Deploy CyberArk Privileged Access for OT vendor sessions with automatic scope restriction and session termination.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'IT Security',
    dueDate: '2025-07-31',
    riskId: 'risk-vendor-remote-access',
    createdAt: NOW,
    updatedAt: NOW
  },
  {
    id: 'task-ot-span-expansion',
    title: 'Deploy SPAN/TAP sensors on industrial switch for full OT visibility',
    description: 'Extend Dragos monitoring to cover intra-OT-zone traffic by adding SPAN port mirrors on the Cisco IE-3400 industrial switch.',
    type: 'control_implementation' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'OT Network Security',
    dueDate: '2025-08-15',
    riskId: 'risk-ot-monitoring-gaps',
    createdAt: NOW,
    updatedAt: NOW
  },
  {
    id: 'task-safety-diode-procurement',
    title: 'Procure and deploy hardware data diode for safety system isolation',
    description: 'Replace bidirectional PROFIsafe monitoring path with hardware-enforced unidirectional data flow for safety status export.',
    type: 'risk_treatment' as const,
    status: 'blocked' as const,
    priority: 'critical' as const,
    owner: 'Process Safety',
    dueDate: '2025-09-15',
    riskId: 'risk-safety-plc-network-exposure',
    createdAt: NOW,
    updatedAt: NOW
  },
  {
    id: 'task-plc-cert-migration',
    title: 'Migrate PLC authentication from password to certificate-based',
    description: 'Deploy Siemens SINEMA Remote Connect for certificate-based PLC access with automated quarterly rotation.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'high' as const,
    owner: 'OT Engineering',
    dueDate: '2025-08-15',
    riskId: 'risk-weak-plc-auth',
    createdAt: NOW,
    updatedAt: NOW
  },
  {
    id: 'task-evidence-ot-monitoring',
    title: 'Attach Dragos and Claroty deployment evidence for A09 control',
    description: 'Upload Dragos Platform deployment report and Claroty xDome coverage assessment as evidence for the security monitoring control.',
    type: 'evidence' as const,
    status: 'todo' as const,
    priority: 'medium' as const,
    owner: 'OT Network Security',
    dueDate: '2025-07-15',
    controlSetId: OWASP_CONTROL_SET_ID,
    controlId: 'A09',
    createdAt: NOW,
    updatedAt: NOW
  },
];

const threatActors = [
  {
    id: 'threat-actor-nation-state', name: 'XENOTIME / CHERNOVITE (ICS-Focused APT)',
    type: 'nation_state' as const, capabilityLevel: 5,
    resourceLevel: 'very_high' as const,
    motivation: 'Strategic disruption of critical infrastructure, pre-positioning for future kinetic conflict, intelligence collection on industrial processes.',
    description: 'State-sponsored advanced persistent threat group with demonstrated capability to target safety instrumented systems (TRITON/TRISIS). Known to exploit unencrypted industrial protocols and weak PLC authentication for process manipulation.',
    targetedAssetIds: ['asset-emergency-shutdown', 'asset-scada-server', 'asset-plc-production'],
    tags: ['apt', 'ics-targeted', 'safety-system', 'critical-infrastructure', 'triton'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'threat-actor-vendor-compromise', name: 'Compromised ICS Vendor',
    type: 'supply_chain' as const, capabilityLevel: 4,
    resourceLevel: 'high' as const,
    motivation: 'Gain persistent access to downstream ICS environments through trusted vendor remote access channels and compromised firmware/software updates.',
    description: 'Threat actor operating through compromised vendor remote access sessions or supply chain tampering of ICS firmware updates. Exploits trusted vendor relationships to bypass perimeter defenses.',
    targetedAssetIds: ['asset-vpn-gateway', 'asset-plc-production', 'asset-iiot-gateway'],
    tags: ['supply-chain', 'vendor-access', 'firmware-tampering', 'persistent'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'threat-actor-insider', name: 'Disgruntled Plant Operator',
    type: 'insider' as const, capabilityLevel: 3,
    resourceLevel: 'moderate' as const,
    motivation: 'Sabotage of production operations due to personal grievance, labor dispute, or financial incentive from external actor.',
    description: 'Current or recently departed plant operator with legitimate knowledge of OT systems, HMI workflows, and safety procedures. Has physical access to control rooms and knowledge of PLC programming interfaces.',
    targetedAssetIds: ['asset-scada-server', 'asset-plc-production', 'asset-engineering-workstation'],
    tags: ['insider-threat', 'physical-access', 'process-knowledge', 'sabotage'],
    createdAt: NOW, updatedAt: NOW
  },
];

const threatScenarios = [
  {
    id: 'scenario-triton-style-attack', title: 'TRITON-Style Safety System Compromise',
    description: 'Nation-state APT gains access through vendor VPN, pivots to the SCADA server via the industrial firewall, and leverages the PROFIsafe monitoring connection to attempt manipulation of the Safety PLC, potentially disabling the emergency shutdown system during a hazardous process condition.',
    threatActorId: 'threat-actor-nation-state',
    targetedAssetIds: ['asset-emergency-shutdown', 'asset-scada-server'],
    attackTechniques: ['T1133 - External Remote Services', 'T1071 - Application Layer Protocol', 'T0855 - Unauthorized Command Message (ICS)', 'T0816 - Device Restart/Shutdown (ICS)'],
    linkedRiskIds: ['risk-safety-plc-network-exposure', 'risk-unenc-scada-traffic', 'risk-vendor-remote-access'],
    likelihood: 'Low — requires advanced capabilities but APT groups have demonstrated this exact attack vector (TRITON/TRISIS).',
    impact: 'Critical — safety system compromise during hazardous conditions could result in loss of life, environmental damage, and facility destruction.',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scenario-vendor-supply-chain', title: 'Vendor Remote Access Exploitation for Process Disruption',
    description: 'Compromised vendor credentials or workstation are used to establish a VPN session, traverse the industrial firewall, and inject malicious PLC programs via the SCADA server, causing production disruption or product quality issues.',
    threatActorId: 'threat-actor-vendor-compromise',
    targetedAssetIds: ['asset-vpn-gateway', 'asset-plc-production'],
    attackTechniques: ['T1133 - External Remote Services', 'T1078 - Valid Accounts', 'T0843 - Program Download (ICS)', 'T0831 - Manipulation of Control (ICS)'],
    linkedRiskIds: ['risk-vendor-remote-access', 'risk-weak-plc-auth'],
    likelihood: 'Moderate — vendor remote access with pre-shared key auth and limited session monitoring provides a viable attack vector.',
    impact: 'Major — unauthorized PLC program changes can halt production, damage equipment, or compromise product quality.',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scenario-insider-sabotage', title: 'Insider Sabotage via Engineering Workstation Pivot',
    description: 'Disgruntled plant operator uses the dual-homed engineering workstation to pivot from the corporate network into the OT zone, bypassing normal access controls to directly program PLCs with malicious logic.',
    threatActorId: 'threat-actor-insider',
    targetedAssetIds: ['asset-engineering-workstation', 'asset-plc-production'],
    attackTechniques: ['T1078 - Valid Accounts', 'T1021 - Remote Services', 'T0843 - Program Download (ICS)', 'T0836 - Modify Parameter (ICS)'],
    linkedRiskIds: ['risk-engineering-ws-pivot', 'risk-weak-plc-auth'],
    likelihood: 'Moderate — insider has legitimate access and process knowledge; engineering workstation dual-homing enables the pivot.',
    impact: 'Major — production disruption, equipment damage, and potential safety incidents from malicious PLC logic.',
    createdAt: NOW, updatedAt: NOW
  },
];

const appetiteRules = [
  {
    id: 'appetite-safety-critical', name: 'Safety-Critical Assets',
    description: 'Extremely low appetite for risks affecting safety instrumented systems due to potential for loss of life.',
    scopeAssetCriticalityMin: 5,
    thresholdScore: 6,
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'appetite-cyber-tier', name: 'Cyber Risk Tier',
    description: 'Reduced appetite for all risks classified under the Cyber Risk tier.',
    scopeTier1: 'Cyber Risk',
    thresholdScore: 10,
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'appetite-ot-domain', name: 'OT Domain',
    description: 'Strict appetite threshold for operational technology assets due to safety and availability implications.',
    scopeAssetDomain: 'ot' as const,
    thresholdScore: 8,
    createdAt: NOW, updatedAt: NOW
  },
];

export const vulnerableScadaGrcWorkspace = buildGrcWorkspace({
  tierCatalogue,
  assets,
  risks,
  assessments,
  soaEntries,
  workflowTasks,
  threatActors,
  threatScenarios,
  appetiteRules,
  thirdParties: [
    {
      id: 'vs-tp-rockwell',
      name: 'Rockwell Automation',
      description: 'Industrial automation supplier providing Allen-Bradley PLCs, ControlLogix controllers, FactoryTalk SCADA software, and Studio 5000 engineering environment for production line control.',
      category: 'supplier' as const,
      status: 'active' as const,
      riskRating: 'critical' as const,
      dataClassification: 'confidential' as const,
      linkedAssetIds: ['asset-scada-server', 'asset-plc-production', 'asset-engineering-workstation'],
      linkedRiskIds: ['risk-unenc-scada-traffic', 'risk-weak-plc-auth', 'risk-engineering-ws-pivot'],
      contactName: 'William Hartley',
      contactEmail: 'william.hartley@rockwell.example.com',
      contractExpiry: '2027-09-30',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-09-30',
      notes: 'Rockwell ControlLogix 5580 PLCs with FactoryTalk View SE SCADA. EtherNet/IP communication between SCADA server and PLCs is unencrypted — CIP protocol lacks native encryption. PLC authentication uses default project passwords unchanged since commissioning. Engineering workstation runs Studio 5000 with unrestricted download capability to production PLCs — compromised workstation enables direct manipulation of safety-critical logic. Firmware versions 2 major releases behind due to production downtime requirements for updates. ICS-CERT advisories tracked quarterly.'
    },
    {
      id: 'vs-tp-hima',
      name: 'HIMA Paul Hildebrandt',
      description: 'Safety instrumented system (SIS) supplier providing HIMax safety controllers, safety logic solvers, and emergency shutdown system (ESD) engineering for process safety protection.',
      category: 'supplier' as const,
      status: 'active' as const,
      riskRating: 'critical' as const,
      dataClassification: 'confidential' as const,
      linkedAssetIds: ['asset-emergency-shutdown', 'asset-plc-production'],
      linkedRiskIds: ['risk-safety-plc-network-exposure', 'risk-weak-plc-auth'],
      contactName: 'Dr. Heinrich Weber',
      contactEmail: 'heinrich.weber@hima.example.com',
      contractExpiry: '2027-06-30',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-06-30',
      notes: 'HIMA HIMax safety controllers rated SIL 3 per IEC 61511. Safety PLCs share network segment with production PLCs — TRITON/TRISIS-style attack vector exists if attacker pivots from engineering workstation. Safety logic modification requires physical key switch AND software authentication but network exposure allows reconnaissance and potential denial-of-service. Annual SIL verification by TUV-certified assessor. HIMA firmware updates require planned shutdown — 18-month update cycle. Process safety management (PSM) audit dependency.'
    },
    {
      id: 'vs-tp-claroty',
      name: 'Claroty',
      description: 'SaaS OT security monitoring platform providing continuous threat detection, asset discovery, vulnerability management, and network segmentation validation for the manufacturing control system.',
      category: 'saas' as const,
      status: 'active' as const,
      riskRating: 'medium' as const,
      dataClassification: 'internal' as const,
      linkedAssetIds: ['asset-industrial-firewall', 'asset-iiot-gateway', 'asset-scada-server'],
      linkedRiskIds: ['risk-ot-monitoring-gaps', 'risk-cloud-gateway-ot-path'],
      contactName: 'Amir Cohen',
      contactEmail: 'amir.cohen@claroty.example.com',
      contractExpiry: '2027-01-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-07-31',
      notes: 'Claroty CTD (Continuous Threat Detection) with passive network monitoring on SPAN port from industrial firewall. Discovered 340 OT assets including 47 previously unknown IIoT devices. Monitors EtherNet/IP, Modbus, and BACnet protocols for anomalous commands. Cloud gateway path from IIoT gateway to Claroty cloud identified as potential IT-to-OT bridge but mitigated by unidirectional data flow. OT monitoring coverage at 78% — Purdue Level 0/1 devices not fully visible. SOC 2 Type II certified. IEC 62443 assessment partner.'
    },
    {
      id: 'vs-tp-cisco-industrial',
      name: 'Cisco (Industrial)',
      description: 'Industrial networking supplier providing Cisco IE switches, industrial DMZ firewalls, and Cyber Vision OT visibility for network segmentation between IT and OT environments.',
      category: 'supplier' as const,
      status: 'active' as const,
      riskRating: 'high' as const,
      dataClassification: 'internal' as const,
      linkedAssetIds: ['asset-industrial-firewall', 'asset-vpn-gateway'],
      linkedRiskIds: ['risk-vendor-remote-access', 'risk-historian-data-diode-bypass'],
      contactName: 'Patricia Nunez',
      contactEmail: 'patricia.nunez@cisco.example.com',
      contractExpiry: '2027-04-30',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-10-31',
      notes: 'Cisco IE-4010 industrial switches and ASA 5516-X for industrial DMZ. Industrial firewall rules allow historian data to flow bidirectionally — intended data diode enforcement bypassed by configuration exception for remote queries. VPN gateway for vendor remote access uses shared credentials across 5 maintenance vendors. Cisco Cyber Vision passive monitoring deployed on 60% of OT switch SPAN ports. IOS-XE firmware updates require maintenance window coordination with production scheduling. SmartNet with 4-hour RMA for industrial components.'
    },
    {
      id: 'vs-tp-abb',
      name: 'ABB',
      description: 'Managed industrial maintenance service providing remote diagnostic access, predictive maintenance analytics, and on-call engineering support for ABB drives, motors, and robotics systems.',
      category: 'managed_service' as const,
      status: 'active' as const,
      riskRating: 'high' as const,
      dataClassification: 'confidential' as const,
      linkedAssetIds: ['asset-vpn-gateway', 'asset-plc-production', 'asset-iiot-gateway'],
      linkedRiskIds: ['risk-vendor-remote-access', 'risk-cloud-gateway-ot-path', 'risk-ot-monitoring-gaps'],
      contactName: 'Lars Eriksson',
      contactEmail: 'lars.eriksson@abb.example.com',
      contractExpiry: '2027-03-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-09-30',
      notes: 'ABB Ability remote monitoring with VPN-based access for predictive maintenance on ABB drives and robotics. Remote access sessions use shared VPN credentials — ABB engineers connect from multiple countries without individual authentication. Remote diagnostic tools have read/write access to drive parameters — could be exploited to modify motor speeds or torque limits. IIoT gateway forwards telemetry to ABB cloud for analytics — creates persistent OT-to-cloud data path. Access logging inconsistent — sessions not correlated with change management tickets. SLA requires 2-hour remote response for critical production stops.'
    },
  ],
  securityInitiatives: [
    {
      id: 'vs-si-ot-protocol-security', title: 'OT Protocol Encryption & PLC Authentication Hardening',
      description: 'Migrate unencrypted industrial protocols to encrypted alternatives and upgrade PLC authentication from password-based to certificate-based controls across all production and utility controllers.',
      category: 'uplift' as const, status: 'in_progress' as const, priority: 'critical' as const,
      owner: 'OT Engineering', executiveSponsor: 'VP Operations',
      currentState: 'S7 Communication, Modbus TCP, and OPC DA protocols transmit process control data without encryption; PLC authentication relies on basic passwords without complexity enforcement or rotation.',
      targetState: 'OPC UA with TLS for SCADA-PLC communication; Modbus TCP wrapped in TLS tunnels; certificate-based PLC authentication with quarterly credential rotation via SINEMA Remote Connect.',
      startDate: '2025-06-01', targetDate: '2026-09-30', completedDate: '',
      milestones: [
        { id: 'vs-ms-proto-01', title: 'Deploy OPC UA with TLS on production PLC', description: 'Migrate SCADA-to-PLC communication from unencrypted S7/OPC DA to OPC UA with TLS 1.2 mutual authentication on Siemens S7-1500 production controllers.', status: 'in_progress' as const, dueDate: '2026-03-31', completedDate: '', owner: 'OT Engineering' },
        { id: 'vs-ms-proto-02', title: 'Implement Modbus TCP TLS wrappers for utility systems', description: 'Deploy stunnel-based TLS wrappers on Modbus TCP connections between SCADA server and utility PLCs where native protocol encryption is unavailable.', status: 'pending' as const, dueDate: '2026-06-30', completedDate: '', owner: 'OT Engineering' },
        { id: 'vs-ms-proto-03', title: 'Upgrade PLC authentication to certificate-based', description: 'Replace password-based PLC authentication with X.509 certificate-based access using Siemens SINEMA Remote Connect for centralized credential management and quarterly rotation.', status: 'pending' as const, dueDate: '2026-09-30', completedDate: '', owner: 'OT Engineering' },
      ],
      linkedRiskIds: ['risk-unenc-scada-traffic', 'risk-weak-plc-auth', 'risk-historian-data-diode-bypass'],
      linkedControlSetIds: [],
      linkedAssetIds: ['asset-scada-server', 'asset-plc-production', 'asset-historian'],
      linkedImplementedControlIds: ['vs-ic-ot-ids'],
      linkedAssessmentIds: ['assessment-ics-security-review'],
      notes: 'OPC UA TLS certificates generated for production PLC. Testing on non-production controller validated zero-impact on scan cycle time. Full migration requires 8-hour production stop.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'vs-si-safety-isolation', title: 'Safety System Air-Gapping & Physical Access Hardening',
      description: 'Isolate safety instrumented systems from the OT network using hardware data diodes, harden physical access to safety controllers, and eliminate bidirectional connectivity between SCADA and safety PLCs.',
      category: 'remediation' as const, status: 'approved' as const, priority: 'critical' as const,
      owner: 'Process Safety', executiveSponsor: 'VP Operations',
      currentState: 'Safety PLC has bidirectional PROFIsafe connection to SCADA server; engineering workstation is dual-homed between IT and OT zones; cloud gateway connects directly to industrial firewall.',
      targetState: 'Hardware data diode enforcing unidirectional safety status export; engineering workstation accessed only via jump server with privileged access management; cloud gateway routed through dedicated cloud DMZ segment.',
      startDate: '2025-07-01', targetDate: '2026-12-31', completedDate: '',
      milestones: [
        { id: 'vs-ms-safety-01', title: 'Deploy hardware data diode for safety status export', description: 'Install Owl Cyber Defense DualDiode between safety PLC and SCADA server to enforce unidirectional data flow for safety system status monitoring.', status: 'in_progress' as const, dueDate: '2026-06-30', completedDate: '', owner: 'Process Safety' },
        { id: 'vs-ms-safety-02', title: 'Implement jump server for engineering workstation access', description: 'Replace dual-homed engineering workstation connectivity with a dedicated jump server using CyberArk Privileged Access Management for controlled OT access.', status: 'pending' as const, dueDate: '2026-12-31', completedDate: '', owner: 'OT Engineering' },
      ],
      linkedRiskIds: ['risk-safety-plc-network-exposure', 'risk-engineering-ws-pivot', 'risk-cloud-gateway-ot-path'],
      linkedControlSetIds: [],
      linkedAssetIds: ['asset-emergency-shutdown', 'asset-engineering-workstation', 'asset-industrial-firewall'],
      linkedImplementedControlIds: ['vs-ic-industrial-fw'],
      linkedAssessmentIds: ['assessment-ics-security-review'],
      notes: 'Owl Cyber Defense DualDiode procurement approved. Factory acceptance test scheduled for Q1 2026. Jump server architecture design under review.',
      createdAt: NOW, updatedAt: NOW,
    },
  ],
  implementedControls: [
    {
      id: 'vs-ic-ot-ids', title: 'Dragos OT Security Monitoring Platform',
      description: 'Dragos Platform deployed on industrial firewall SPAN port providing OT protocol-aware threat detection, asset discovery, and vulnerability management for SCADA, PLC, and HMI systems.',
      controlType: 'technical' as const, category: 'monitoring' as const,
      status: 'active' as const, automationLevel: 'semi_automated' as const,
      owner: 'OT Network Security', vendor: 'Dragos', product: 'Dragos Platform', version: '2.3',
      implementedDate: '2024-01-15', lastReviewDate: '2025-05-01', nextReviewDate: '2026-05-01',
      linkedSoaEntryIds: ['soa-a09', 'soa-cis-01'],
      linkedRiskIds: ['risk-ot-monitoring-gaps', 'risk-unenc-scada-traffic', 'risk-vendor-remote-access'],
      linkedAssetIds: ['asset-scada-server', 'asset-plc-production', 'asset-industrial-firewall'],
      linkedAssessmentIds: ['assessment-ics-security-review'],
      notes: 'Monitoring coverage limited to DMZ/firewall SPAN port. Intra-OT-zone traffic between PLCs, HMI, and industrial switch is not monitored. SPAN sensor expansion planned.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'vs-ic-industrial-fw', title: 'FortiGate Industrial Firewall with OT DPI',
      description: 'FortiGate rugged industrial firewall providing deep packet inspection for OT protocols (S7, Modbus, OPC UA/DA, EtherNet/IP) between IT DMZ and OT zones with protocol validation and command whitelisting.',
      controlType: 'technical' as const, category: 'network_security' as const,
      status: 'active' as const, automationLevel: 'semi_automated' as const,
      owner: 'OT Network Security', vendor: 'Fortinet', product: 'FortiGate Rugged 60F', version: '7.4.2',
      implementedDate: '2023-06-01', lastReviewDate: '2025-06-01', nextReviewDate: '2026-06-01',
      linkedSoaEntryIds: ['soa-a04', 'soa-a05'],
      linkedRiskIds: ['risk-vendor-remote-access', 'risk-cloud-gateway-ot-path', 'risk-engineering-ws-pivot'],
      linkedAssetIds: ['asset-industrial-firewall', 'asset-vpn-gateway', 'asset-engineering-workstation'],
      linkedAssessmentIds: ['assessment-ics-security-review'],
      notes: 'OT protocol DPI enabled for S7 and Modbus. Command whitelisting configured for known-good PLC programming operations. Cloud gateway rules under review.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'vs-ic-vendor-session', title: 'CyberArk Vendor Privileged Access for OT',
      description: 'CyberArk Privileged Access Security solution managing vendor remote access sessions with session recording, just-in-time provisioning, and automated session termination for OT maintenance windows.',
      controlType: 'administrative' as const, category: 'access_control' as const,
      status: 'planned' as const, automationLevel: 'semi_automated' as const,
      owner: 'IT Security', vendor: 'CyberArk', product: 'Privileged Access Security', version: '13.2',
      implementedDate: '', lastReviewDate: '', nextReviewDate: '2026-03-01',
      linkedSoaEntryIds: ['soa-a01', 'soa-a07'],
      linkedRiskIds: ['risk-vendor-remote-access', 'risk-weak-plc-auth'],
      linkedAssetIds: ['asset-vpn-gateway', 'asset-plc-production', 'asset-scada-server'],
      linkedAssessmentIds: ['assessment-ics-security-review'],
      notes: 'Planned deployment to replace uncontrolled vendor VPN access. PoC evaluation in progress with CyberArk Privileged Access for OT environments.',
      createdAt: NOW, updatedAt: NOW,
    },
  ],
});

export const vulnerableScada: ExampleSystem = {
  id: 'industrial-scada',
  name: 'Advanced Manufacturing Control System',
  description: 'Multi-tier industrial SCADA system with safety-critical controls and modern IIoT integration',
  category: 'Industrial Control Systems',
  // securityLevel removed - no longer part of the system model
  primaryZone: 'OT',
  dataClassification: 'Confidential',
  grcWorkspace: vulnerableScadaGrcWorkspace,
  nodes: [
    // Multi-tier Security Zones: Critical zone above, main flow below
    // Critical Zone - Safety-Critical Systems (positioned above main zones)
    {
      id: 'critical-zone',
      type: 'securityZone',
      position: { x: 50, y: -470 },
      data: {
        label: 'Critical Zone',
        description: 'Safety-Critical Systems - Emergency Controls and Life Safety',
        zoneType: 'Critical' as SecurityZone,
        zone: 'Critical' as SecurityZone
      },
      style: {
        width: 1420,
        height: 400,
        background: colors.zoneBackgrounds.Critical,
        zIndex: -1
      }
    } as SecurityNode,
    
    // Main Zone Flow: OT → DMZ → Internal → External
    {
      id: 'ot-zone',
      type: 'securityZone',
      position: { x: -200, y: 50 },
      data: {
        label: 'OT Zone',
        description: 'Operational Technology Zone - Field Devices and Control Systems',
        zoneType: 'OT' as SecurityZone
      },
      style: {
        width: 650,
        height: 800,
        background: colors.zoneBackgrounds.OT,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'dmz-zone',
      type: 'securityZone',
      position: { x: 820, y: 50 }, // 50 + 650 + 120
      data: {
        label: 'DMZ Zone',
        description: 'Demilitarized Zone - Network Security Boundary',
        zoneType: 'DMZ' as SecurityZone
      },
      style: {
        width: 650,
        height: 800,
        background: colors.zoneBackgrounds.DMZ,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'internal-zone',
      type: 'securityZone',
      position: { x: 1590, y: 50 }, // 820 + 650 + 120
      data: {
        label: 'Internal Zone',
        description: 'Corporate Internal Network - Engineering and Management',
        zoneType: 'Internal' as SecurityZone
      },
      style: {
        width: 650,
        height: 800,
        background: colors.zoneBackgrounds.Internal,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'external-zone',
      type: 'securityZone',
      position: { x: 2360, y: 50 }, // 1590 + 650 + 120
      data: {
        label: 'External Zone',
        description: 'External Network Access - Vendor and Remote Connections',
        zoneType: 'External' as SecurityZone
      },
      style: {
        width: 650,
        height: 800,
        background: colors.zoneBackgrounds.External,
        zIndex: -1
      }
    } as SecurityNode,

    // Critical Zone - Safety-Critical Systems
    {
      id: 'emergency-shutdown',
      type: 'safetySystem',
      position: { x: 175, y: -375 },
      data: {
        label: 'Emergency Shutdown System',
        description: 'Triconex Safety Instrumented System for emergency plant shutdown',
        vendor: 'Schneider Electric',
        product: 'Triconex Tricon CX',
        version: '11.4.1',
        protocols: ['TriStation', 'Modbus'],
        securityControls: ['Hardware-based Safety', 'Redundant Architecture', 'Fail-Safe Design'],
        accessControl: 'Physical Key Switch + PIN',
        zone: 'Critical' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      }
    } as SecurityNode,
    {
      id: 'safety-plc',
      type: 'plc',
      position: { x: 625, y: -175 },
      data: {
        label: 'Safety PLC 2',
        description: 'Siemens SIMATIC S7-1500F Safety Controller',
        vendor: 'Siemens',
        product: 'S7-1500F CPU 1516F-3',
        version: '2.9.2',
        protocols: ['PROFINET', 'PROFIsafe'],
        securityControls: ['Safety Integrity Level 3', 'Certified Safety Functions'],
        accessControl: 'Safety Password + Certificate',
        zone: 'Critical' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      }
    } as SecurityNode,
    {
      id: 'fire-suppression',
      type: 'safetySystem',
      position: { x: 775, y: -375 },
      data: {
        label: 'Fire Suppression Controller',
        description: 'Honeywell Notifier Fire Alarm Control Panel',
        vendor: 'Honeywell',
        product: 'NOTIFIER NFS2-3030',
        version: '6.02.00',
        protocols: ['BACnet', 'Modbus'],
        securityControls: ['UL Listed', 'Supervised Circuits', 'Tamper Detection'],
        accessControl: 'Keypad + Access Code',
        zone: 'Critical' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'gas-detection',
      type: 'sensor',
      position: { x: 1275, y: -325 },
      data: {
        label: 'Gas Detection System',
        description: 'Honeywell Analytics Gas Detection Controller',
        vendor: 'Honeywell',
        product: 'Searchpoint Optima Plus',
        version: '2.1.4',
        protocols: ['4-20mA', 'HART', 'Modbus'],
        securityControls: ['Intrinsically Safe', 'SIL 2 Certified'],
        accessControl: 'Magnetic Tool + Configuration Software',
        zone: 'Critical' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    
    // OT Zone - Field Devices and Control Systems (Improved Spacing)
    {
      id: 'plc-production',
      type: 'plc',
      position: { x: -25, y: 125 }, // Grid aligned: left side of OT zone
      data: {
        label: 'Production PLC',
        description: 'Siemens S7-1500 Production Line Controller',
        vendor: 'Siemens',
        product: 'SIMATIC S7-1500',
        version: '2.8.3',
        supportedProtocols: ['Profinet', 'Modbus TCP', 'S7 Communication'],
        securityControls: ['Basic Authentication', 'Access Control Lists'],
        accessControlMethod: 'Password-based',
        zone: 'OT' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      }
    } as SecurityNode,
    {
      id: 'plc-utilities',
      type: 'plc',
      position: { x: -175, y: 275 }, // Grid aligned: center-right of OT zone
      data: {
        label: 'Utilities PLC',
        description: 'Allen-Bradley ControlLogix Utilities Controller',
        vendor: 'Rockwell Automation',
        product: 'ControlLogix 5580',
        version: '32.014',
        supportedProtocols: ['EtherNet/IP', 'Modbus TCP', 'CIP'],
        securityControls: ['User Authentication', 'Role-based Access'],
        accessControlMethod: 'Certificate-based',
        zone: 'OT' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      }
    } as SecurityNode,
    {
      id: 'hmi-operator',
      type: 'hmi',
      position: { x: 225, y: 825 }, // Moved right for better spacing
      data: {
        label: 'Operator HMI',
        description: 'Siemens SIMATIC HMI Comfort Panel',
        vendor: 'Siemens',
        product: 'SIMATIC HMI TP1500',
        version: '15.1.6',
        supportedProtocols: ['S7 Communication', 'OPC UA', 'Modbus TCP'],
        securityControls: ['User Management', 'Screen Lock'],
        accessControlMethod: 'Multi-user Authentication',
        zone: 'OT' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'scada-server',
      type: 'scadaServer',
      position: { x: 25, y: 625 }, // Moved down for better vertical spacing
      data: {
        label: 'SCADA Server',
        description: 'Wonderware System Platform SCADA Server',
        vendor: 'AVEVA',
        product: 'System Platform',
        version: '2020 R2',
        supportedProtocols: ['OPC DA/AE', 'OPC UA', 'Modbus', 'DNP3'],
        securityControls: ['Windows Authentication', 'Application Security'],
        accessControlMethod: 'Active Directory Integration',
        zone: 'OT' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      }
    } as SecurityNode,
    {
      id: 'historian-server',
      type: 'historian',
      position: { x: 675, y: 725 }, // Moved right and down for better spacing
      data: {
        label: 'Process Historian',
        description: 'OSIsoft PI System Process Data Historian',
        vendor: 'OSIsoft',
        product: 'PI System',
        version: '2018 SP3',
        supportedProtocols: ['PI SDK', 'PI Web API', 'OPC UA'],
        securityControls: ['PI Trust', 'Windows Authentication', 'SSL/TLS'],
        accessControlMethod: 'PI Security Database',
        zone: 'OT' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      }
    } as SecurityNode,
    {
      id: 'industrial-switch',
      type: 'switch',
      position: { x: 375, y: 225 }, // Positioned centrally for network connectivity
      data: {
        label: 'Industrial Switch',
        description: 'Cisco IE-3400 Industrial Ethernet Switch',
        vendor: 'Cisco',
        product: 'IE-3400 Series',
        version: '16.12.05',
        supportedProtocols: ['Ethernet', 'VLAN', 'RSTP', 'SNMP'],
        securityControls: ['Port Security', 'VLAN Segmentation', 'Access Control Lists'],
        accessControlMethod: 'SSH Key-based',
        zone: 'OT' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'safety-system',
      type: 'safetySystem',
      position: { x: -125, y: 925 }, // Moved right for better spacing
      data: {
        label: 'Safety PLC',
        description: 'Siemens SIMATIC S7-1500F Safety Controller',
        vendor: 'Siemens',
        product: 'S7-1500F',
        version: '2.8.3',
        supportedProtocols: ['PROFIsafe', 'Profinet', 'Safety over EtherNet/IP'],
        securityControls: ['Safety Integrity Level 3', 'Fail-safe Design'],
        accessControlMethod: 'Hardware Key Switch',
        zone: 'OT' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      }
    } as SecurityNode,
    
    // Modern IIoT Components in OT Zone (Better Spacing)
    {
      id: 'iiot-gateway',
      type: 'gateway',
      position: { x: 625, y: 375 }, // Maintained position
      data: {
        label: 'IIoT Gateway',
        description: 'Cisco IR1101 Industrial IoT Gateway',
        vendor: 'Cisco',
        product: 'IR1101 Integrated Services Router',
        version: '17.06.05',
        protocols: ['MQTT', 'OPC UA', 'Modbus', 'DNP3'],
        securityControls: ['VPN Termination', 'Firewall', 'Device Authentication'],
        accessControl: 'Certificate-based Authentication',
        zone: 'OT' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'edge-compute',
      type: 'server',
      position: { x: 75, y: 925 }, // Moved left for better distribution
      data: {
        label: 'Edge Computing Node',
        description: 'Dell Edge Gateway 3000 for local data processing',
        vendor: 'Dell',
        product: 'Edge Gateway 3000',
        version: 'Ubuntu 18.04 LTS',
        protocols: ['HTTPS', 'MQTT', 'OPC UA'],
        securityControls: ['Container Security', 'TPM 2.0', 'Secure Boot'],
        accessControl: 'SSH Key Authentication',
        zone: 'OT' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'wireless-sensors',
      type: 'sensor',
      position: { x: 325, y: 825 }, // Moved right for better spacing
      data: {
        label: 'Wireless Sensor Network',
        description: 'Emerson Wireless HART Temperature and Vibration Sensors',
        vendor: 'Emerson',
        product: 'Rosemount 648 Wireless Gateway',
        version: '3.1.2',
        protocols: ['WirelessHART', 'HART-IP'],
        securityControls: ['AES-128 Encryption', 'Network Authentication'],
        accessControl: 'Device Certificates',
        zone: 'OT' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'predictive-maintenance',
      type: 'application',
      position: { x: 525, y: 925 }, // Moved up for better vertical distribution
      data: {
        label: 'Predictive Maintenance System',
        description: 'GE Predix Asset Performance Management',
        vendor: 'General Electric',
        product: 'Predix APM',
        version: '4.2.1',
        protocols: ['HTTPS', 'OPC UA', 'MQTT'],
        securityControls: ['OAuth 2.0', 'Data Encryption', 'Audit Logging'],
        accessControl: 'Role-based Access Control',
        zone: 'OT' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,

    // DMZ Zone - Network Security Boundary
    {
      id: 'industrial-firewall',
      type: 'industrialFirewall',
      position: { x: 875, y: 175 },
      data: {
        label: 'Industrial Firewall',
        description: 'Fortinet FortiGate Industrial Security Appliance',
        vendor: 'Fortinet',
        product: 'FortiGate Rugged 60F',
        version: '7.0.8',
        supportedProtocols: ['Deep Packet Inspection', 'VPN', 'IPS/IDS'],
        securityControls: ['Stateful Inspection', 'Application Control', 'Intrusion Prevention'],
        accessControlMethod: 'Multi-factor Authentication',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'data-diode',
      type: 'server',
      position: { x: 1175, y: 625 },
      data: {
        label: 'Data Diode',
        description: 'Owl Cyber Defense Data Diode One-Way Gateway',
        vendor: 'Owl Cyber Defense',
        product: 'DualDiode',
        version: '4.2.1',
        supportedProtocols: ['One-way TCP', 'File Transfer', 'Database Replication'],
        securityControls: ['Hardware-enforced Unidirectional', 'Air Gap Security'],
        accessControlMethod: 'Physical Access Control',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'ot-security-monitor',
      type: 'monitor',
      position: { x: 875, y: 375 },
      data: {
        label: 'OT Security Monitor',
        description: 'Dragos Platform OT/ICS Security Monitoring',
        vendor: 'Dragos',
        product: 'Dragos Platform',
        version: '6.2.1',
        protocols: ['Passive Network Monitoring', 'SNMP', 'Syslog'],
        securityControls: ['Threat Detection', 'Asset Discovery', 'Behavioral Analysis'],
        accessControl: 'RBAC with LDAP Integration',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'protocol-analyzer',
      type: 'monitor',
      position: { x: 1275, y: 375 },
      data: {
        label: 'Protocol Analyzer',
        description: 'Wireshark Industrial Protocol Analysis System',
        vendor: 'Wireshark Foundation',
        product: 'Wireshark Enterprise',
        version: '4.0.8',
        protocols: ['Deep Packet Inspection', 'Industrial Protocol Decoding'],
        securityControls: ['Traffic Analysis', 'Protocol Validation', 'Anomaly Detection'],
        accessControl: 'Certificate-based Authentication',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'threat-detection',
      type: 'server',
      position: { x: 925, y: 575 },
      data: {
        label: 'OT Threat Detection',
        description: 'Claroty xDome OT Security Platform',
        vendor: 'Claroty',
        product: 'xDome',
        version: '4.8.2',
        protocols: ['HTTPS', 'SNMP', 'Syslog'],
        securityControls: ['ML-based Threat Detection', 'Asset Inventory', 'Risk Assessment'],
        accessControl: 'Multi-factor Authentication',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,

    // Internal Zone - Engineering and Management
    {
      id: 'engineering-workstation',
      type: 'workstation',
      position: { x: 2025, y: 475 }, // Grid aligned: centered in Internal zone
      data: {
        label: 'Engineering Workstation',
        description: 'Dell Precision 5560 Engineering Workstation',
        vendor: 'Dell',
        product: 'Precision 5560',
        version: 'Windows 11 Pro',
        supportedProtocols: ['RDP', 'SSH', 'HTTPS', 'S7 Communication'],
        securityControls: ['BitLocker Encryption', 'Windows Defender', 'UAC'],
        accessControlMethod: 'Smart Card Authentication',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'domain-controller',
      type: 'server',
      position: { x: 1725, y: 325 }, // Grid aligned: left side of Internal zone
      data: {
        label: 'Domain Controller',
        description: 'Windows Server 2022 Active Directory Domain Controller',
        vendor: 'Microsoft',
        product: 'Windows Server 2022',
        version: '21H2',
        supportedProtocols: ['LDAP', 'Kerberos', 'DNS', 'DHCP'],
        securityControls: ['Group Policy', 'Certificate Services', 'Audit Logging'],
        accessControlMethod: 'Kerberos Authentication',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      }
    } as SecurityNode,
    {
      id: 'backup-server',
      type: 'server',
      position: { x: 1875, y: 625 }, // Grid aligned: right side of Internal zone
      data: {
        label: 'Backup Server',
        description: 'Veeam Backup & Replication Server',
        vendor: 'Veeam',
        product: 'Backup & Replication',
        version: '12.0',
        supportedProtocols: ['SMB', 'NFS', 'iSCSI', 'HTTPS'],
        securityControls: ['Encryption at Rest', 'Immutable Backups', 'Access Control'],
        accessControlMethod: 'Service Account Authentication',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      }
    } as SecurityNode,

    // External Zone - Vendor and Remote Connections
    {
      id: 'vpn-gateway',
      type: 'vpnGateway',
      position: { x: 2525, y: 175 }, // Grid aligned: centered in External zone
      data: {
        label: 'VPN Gateway',
        description: 'Cisco ASA 5516-X VPN Concentrator',
        vendor: 'Cisco',
        product: 'ASA 5516-X',
        version: '9.16.4',
        supportedProtocols: ['IPSec', 'SSL VPN', 'L2TP', 'PPTP'],
        securityControls: ['Multi-factor Authentication', 'Certificate-based VPN'],
        accessControlMethod: 'RSA SecurID Integration',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'vendor-workstation',
      type: 'workstation',
      position: { x: 2875, y: 175 }, // Grid aligned: left side of External zone
      data: {
        label: 'Vendor Remote Access',
        description: 'Authorized Vendor Remote Support Connection',
        vendor: 'TeamViewer',
        product: 'TeamViewer Business',
        version: '15.34.4',
        supportedProtocols: ['TeamViewer Protocol', 'RDP', 'VNC'],
        securityControls: ['Session Recording', 'Access Approval Workflow'],
        accessControlMethod: 'Pre-shared Key Authentication',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'cloud-gateway',
      type: 'server',
      position: { x: 2825, y: 325 }, // Grid aligned: right side of External zone
      data: {
        label: 'Cloud Gateway',
        description: 'Azure IoT Edge Gateway for Cloud Connectivity',
        vendor: 'Microsoft',
        product: 'Azure IoT Edge',
        version: '1.4.8',
        supportedProtocols: ['MQTT', 'AMQP', 'HTTPS', 'OPC UA'],
        securityControls: ['Device Certificates', 'Secure Boot', 'Hardware Security Module'],
        accessControlMethod: 'Certificate-based Authentication',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,

    {
      id: 'ics-firewall',
      type: 'firewall',
      position: { x: 1375, y: 525 }, // Grid aligned: right side of DMZ zone
      data: {
        label: 'ICS Firewall',
        description: 'Specialized industrial control system firewall',
        vendor: 'Fortinet',
        product: 'FortiGate Rugged',
        version: '7.2.5',
        supportedProtocols: ['Modbus', 'DNP3', 'IEC 61850', 'OPC UA'],
        securityControls: ['Deep Packet Inspection', 'Protocol Validation', 'Allowlist Rules'],
        accessControlMethod: 'Certificate-based Management',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      }
    } as SecurityNode
  ],
  edges: [
    // Critical Zone Safety System Connections
    {
      id: 'edge-emergency-safety-plc',
      source: 'emergency-shutdown',
      target: 'safety-plc',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Safety Interlock Signals',
        protocol: 'TriStation to PROFIsafe',
        encryption: 'Hardware-based Safety Protocol',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Critical' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-fire-gas-detection',
      source: 'fire-suppression',
      target: 'gas-detection',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Fire/Gas Alarm Integration',
        protocol: 'BACnet',
        encryption: 'None',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Critical' as SecurityZone
      }
    } as SecurityEdge,
    
    // OT Zone Internal Communications
    {
      id: 'edge-plc-production-scada',
      source: 'plc-production',
      target: 'scada-server',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Production Control Data',
        protocol: 'S7 Communication',
        encryption: 'None',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'OT' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-plc-utilities-scada',
      source: 'plc-utilities',
      target: 'scada-server',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Utilities Control Data',
        protocol: 'EtherNet/IP',
        encryption: 'None',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'OT' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-hmi-scada',
      source: 'hmi-operator',
      target: 'scada-server',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Operator Commands',
        protocol: 'OPC UA',
        encryption: 'None',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'OT' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-scada-historian',
      source: 'scada-server',
      target: 'historian-server',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Process Data Logging',
        protocol: 'PI SDK',
        encryption: 'None',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'OT' as SecurityZone
      }
    } as SecurityEdge,
    
    // IIoT and Modern OT Connections
    {
      id: 'edge-iiot-gateway-scada',
      source: 'iiot-gateway',
      target: 'scada-server',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'IIoT Data Aggregation',
        protocol: 'OPC UA',
        encryption: 'TLS 1.2',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'OT' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-wireless-sensors-iiot',
      source: 'wireless-sensors',
      target: 'iiot-gateway',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'bottom',
      data: {
        label: 'Wireless Sensor Data',
        protocol: 'WirelessHART',
        encryption: 'AES-128',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'OT' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-edge-compute-predictive',
      source: 'edge-compute',
      target: 'predictive-maintenance',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Edge Analytics Data',
        protocol: 'MQTT',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'OT' as SecurityZone
      }
    } as SecurityEdge,
    // Critical to OT Zone Safety Connections
    {
      id: 'edge-safety-plc-scada',
      source: 'safety-plc',
      target: 'scada-server',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        controlPoints: [
          { id: 'cp-1771642174413', x: 550, y: 350, active: true },
          { id: 'cp-1771642182335', x: 150, y: 350, active: true }
        ],
        label: 'Safety Status Monitoring',
        protocol: 'PROFIsafe over PROFINET',
        encryption: 'Safety Protocol Encryption',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'OT' as SecurityZone
      }
    } as SecurityEdge,

    // OT to DMZ Communications
    {
      id: 'edge-scada-firewall',
      source: 'scada-server',
      target: 'industrial-firewall',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Data Export',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'OT' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-historian-diode',
      source: 'historian-server',
      target: 'data-diode',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Historical Data Transfer',
        protocol: 'One-way TCP',
        encryption: 'None',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'OT' as SecurityZone
      }
    } as SecurityEdge,
    
    // DMZ Security Monitoring Connections
    {
      id: 'edge-firewall-ot-monitor',
      source: 'industrial-firewall',
      target: 'ot-security-monitor',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Network Traffic Analysis',
        protocol: 'SPAN/TAP',
        encryption: 'None',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-ot-monitor-protocol-analyzer',
      source: 'ot-security-monitor',
      target: 'protocol-analyzer',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Protocol Analysis Data',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-protocol-analyzer-threat-detection',
      source: 'protocol-analyzer',
      target: 'threat-detection',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Threat Intelligence Feed',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,

    // DMZ to Internal Communications
    {
      id: 'edge-firewall-domain',
      source: 'industrial-firewall',
      target: 'domain-controller',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Authentication Services',
        protocol: 'LDAP',
        encryption: 'TLS 1.2',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-diode-backup',
      source: 'data-diode',
      target: 'backup-server',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Data Archival',
        protocol: 'SMB',
        encryption: 'SMB3 Encryption',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,

    // Internal Zone Communications
    {
      id: 'edge-engineering-domain',
      source: 'engineering-workstation',
      target: 'domain-controller',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Domain Authentication',
        protocol: 'Kerberos',
        encryption: 'Kerberos Encryption',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-engineering-firewall',
      source: 'engineering-workstation',
      target: 'industrial-firewall',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Engineering Access',
        protocol: 'RDP',
        encryption: 'TLS 1.2',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,

    // Internal to External Communications
    {
      id: 'edge-vpn-firewall',
      source: 'vpn-gateway',
      target: 'industrial-firewall',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        controlPoints: [
          { id: 'cp-1771642203404', x: 2400, y: 150, active: true },
          { id: 'cp-1771642207936', x: 1050, y: 150, active: true }
        ],
        label: 'VPN Tunnel',
        protocol: 'IPSec',
        encryption: 'AES-256',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-vendor-vpn',
      source: 'vendor-workstation',
      target: 'vpn-gateway',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Vendor Remote Access',
        protocol: 'SSL VPN',
        encryption: 'TLS 1.2',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'External' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-cloud-firewall',
      source: 'cloud-gateway',
      target: 'industrial-firewall',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Cloud Connectivity',
        protocol: 'MQTT over TLS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,

    // Industrial Switch Connections (Previously Disconnected)
    {
      id: 'edge-plc-production-switch',
      source: 'plc-production',
      target: 'industrial-switch',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Production Network',
        protocol: 'Ethernet/IP',
        encryption: 'None',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'OT' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-plc-utilities-switch',
      source: 'plc-utilities',
      target: 'industrial-switch',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Utilities Network',
        protocol: 'EtherNet/IP',
        encryption: 'None',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'OT' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-switch-scada',
      source: 'industrial-switch',
      target: 'scada-server',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'SCADA Network',
        protocol: 'OPC UA',
        encryption: 'None',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'OT' as SecurityZone
      }
    } as SecurityEdge,

    // ICS Firewall Connections (Previously Disconnected)
    {
      id: 'edge-ics-firewall-threat-detection',
      source: 'ics-firewall',
      target: 'threat-detection',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Security Event Monitoring',
        protocol: 'Syslog',
        encryption: 'TLS 1.2',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-ics-firewall-protocol-analyzer',
      source: 'ics-firewall',
      target: 'protocol-analyzer',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Traffic Mirroring',
        protocol: 'SPAN Port',
        encryption: 'None',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-industrial-firewall-ics-firewall',
      source: 'industrial-firewall',
      target: 'ics-firewall',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Firewall Coordination',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,

    // Critical Zone Safety System Connections (Previously Isolated)
    {
      id: 'edge-fire-suppression-safety-plc',
      source: 'fire-suppression',
      target: 'safety-plc',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Fire Safety Interlock',
        protocol: 'BACnet to PROFIsafe',
        encryption: 'Safety Protocol Encryption',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Critical' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-gas-detection-safety-plc',
      source: 'gas-detection',
      target: 'safety-plc',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Gas Detection Safety',
        protocol: 'HART to PROFIsafe',
        encryption: 'Safety Protocol Encryption',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Critical' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'edge-fire-suppression-emergency-shutdown',
      source: 'fire-suppression',
      target: 'emergency-shutdown',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Emergency Fire Shutdown',
        protocol: 'Hardwired Safety Circuit',
        encryption: 'None',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Critical' as SecurityZone
      }
    } as SecurityEdge
  ],
  customContext: `## System Overview
Advanced Manufacturing Control System implementing multi-tier industrial cybersecurity architecture. The system integrates safety-critical controls, modern IIoT technologies, and comprehensive security monitoring across Critical, OT, DMZ, Internal, and External zones. Designed for 24/7 operations with enhanced safety systems and predictive maintenance capabilities.

## Multi-Tier Architecture

### Critical Zone (Safety-Critical Systems)
- Emergency Shutdown System (Triconex Tricon CX)
  - Hardware-based safety instrumented system
  - Redundant architecture with fail-safe design
  - Physical key switch and PIN authentication
  - TriStation protocol for safety communications
- Safety PLC (Siemens S7-1500F CPU 1516F-3)
  - Safety Integrity Level 3 certified functions
  - PROFIsafe protocol for safety communications
  - Safety password and certificate authentication
  - Integrated with emergency shutdown systems
- Fire Suppression Controller (Honeywell NOTIFIER NFS2-3030)
  - UL listed fire alarm control panel
  - Supervised circuits with tamper detection
  - BACnet integration for building automation
  - Keypad and access code authentication
- Gas Detection System (Honeywell Searchpoint Optima Plus)
  - SIL 2 certified intrinsically safe sensors
  - HART and Modbus protocol support
  - Magnetic tool configuration access
  - Integration with fire suppression systems

### OT Zone (Operational Technology)
- Production PLC (Siemens SIMATIC S7-1500)
  - PROFINET and Modbus TCP protocols
  - Basic authentication and access control lists
  - Password-based access control method
  - Controls critical manufacturing processes
- Utilities PLC (Allen-Bradley ControlLogix 5580)
  - EtherNet/IP and CIP protocol support
  - Certificate-based authentication
  - Role-based access control implementation
  - Manages facility utilities and support systems
- SCADA Server (AVEVA System Platform 2020 R2)
  - OPC DA/AE and OPC UA protocol support
  - Active Directory integration for authentication
  - Windows authentication and application security
  - Central monitoring and control platform
- Historian Server (OSIsoft PI System)
  - Long-term data storage and trending
  - PI SDK for data access and integration
  - Regulatory compliance data retention
  - Integration with corporate reporting systems
- IIoT Gateway (Cisco IR1101)
  - MQTT, OPC UA, and Modbus protocol support
  - VPN termination and firewall capabilities
  - Certificate-based device authentication
  - Edge connectivity for modern IoT devices
- Edge Computing Node (Dell Edge Gateway 3000)
  - Local data processing and analytics
  - Container security with TPM 2.0
  - SSH key authentication for secure access
  - Ubuntu 18.04 LTS operating system
- Wireless Sensor Network (Emerson Rosemount 648)
  - WirelessHART encrypted communications
  - AES-128 encryption for data security
  - Device certificate authentication
  - Temperature and vibration monitoring
- Predictive Maintenance System (GE Predix APM)
  - OAuth 2.0 authentication and authorization
  - Data encryption and comprehensive audit logging
  - Role-based access control implementation
  - Machine learning analytics for maintenance

### DMZ Zone (Security Boundary)
- Industrial Firewall (Fortinet FortiGate Rugged 60F)
  - Deep packet inspection and intrusion prevention
  - Stateful inspection with application control
  - Multi-factor authentication for management
  - Industrial protocol support and validation
- Data Diode (Owl Cyber Defense DualDiode)
  - Hardware-enforced unidirectional data flow
  - Air gap security for sensitive data transfer
  - Physical access control for configuration
  - One-way TCP and file transfer protocols
- OT Security Monitor (Dragos Platform)
  - Passive network monitoring and asset discovery
  - Behavioral analysis and threat detection
  - RBAC with LDAP integration
  - Industrial protocol analysis capabilities
- Protocol Analyzer (Wireshark Enterprise)
  - Deep packet inspection for industrial protocols
  - Protocol validation and anomaly detection
  - Certificate-based authentication
  - Traffic analysis and forensic capabilities
- OT Threat Detection (Claroty xDome)
  - ML-based threat detection and analysis
  - Comprehensive asset inventory management
  - Risk assessment and vulnerability analysis
  - Multi-factor authentication for access

### Internal Zone (Engineering and Management)
- Engineering Workstation (Dell Precision 5560)
  - Windows 11 Pro with BitLocker encryption
  - Smart card authentication for secure access
  - PLC programming and configuration tools
  - Windows Defender and UAC security controls
- Domain Controller (Windows Server 2022)
  - Active Directory domain services
  - Group Policy and certificate services
  - Kerberos authentication protocol
  - Comprehensive audit logging capabilities
- Backup Server (Windows Server 2022)
  - SMB3 encryption for secure file transfers
  - Certificate-based authentication
  - Automated backup and recovery systems
  - Data archival and retention management

### External Zone (Remote Access)
- VPN Gateway (Cisco ASA 5516-X)
  - IPSec VPN with AES-256 encryption
  - Multi-factor authentication enforcement
  - Certificate-based device authentication
  - Secure remote access for authorized users
- Vendor Workstation (Remote Access)
  - SSL VPN connectivity for vendor support
  - TLS 1.2 encryption for secure communications
  - Controlled access to specific systems
  - Session monitoring and logging
- Cloud Gateway (Microsoft Azure IoT Edge)
  - MQTT over TLS for secure cloud connectivity
  - Device certificates and secure boot
  - Hardware Security Module integration
  - Certificate-based authentication
  - Accessible by management team
  - Connected to corporate Active Directory

## Operational Considerations

### Availability and Reliability
- System designed for 99.95% uptime with redundant safety systems
- Comprehensive change management process balances security and operational continuity
- Regular testing of failover systems and emergency shutdown procedures
- Predictive maintenance reduces unplanned downtime

### Security Operations
- Dedicated OT cybersecurity team monitors industrial networks 24/7
- Comprehensive security monitoring across all zones with centralized SIEM
- Regular security assessments and penetration testing
- Incident response procedures specific to industrial control systems

### Maintenance and Support
- Controlled vendor access through secure VPN with multi-factor authentication
- Role-based access control limits vendor permissions to specific systems
- All maintenance activities logged and monitored in real-time
- Regular security training for operations and maintenance personnel

### Technology Management
- Asset inventory management tracks all connected devices and their security status
- Regular firmware updates applied during scheduled maintenance windows
- New devices undergo security assessment before network integration
- Legacy systems isolated with additional monitoring and access controls

## Multi-Tier Security Architecture

### Zone Segmentation Strategy
- **Critical Zone**: Isolated safety-critical systems with hardware-based security
- **OT Zone**: Segmented operational technology with modern IIoT integration
- **DMZ Zone**: Security boundary with advanced monitoring and data diodes
- **Internal Zone**: Engineering and management systems with enterprise security
- **External Zone**: Controlled remote access with comprehensive authentication

### Security Controls Implementation
- Defense-in-depth strategy with multiple security layers
- Network segmentation with industrial firewalls and data diodes
- Comprehensive monitoring and threat detection across all zones
- Strong authentication and access control for all system components
- Encrypted communications for sensitive data transfers

### Protocol Security
- Modern industrial protocols with built-in security features
- Legacy protocol support with additional security monitoring
- Network traffic analysis and anomaly detection
- Protocol validation and deep packet inspection

This advanced manufacturing control system demonstrates modern industrial cybersecurity best practices while maintaining operational reliability and safety requirements.`,
  attackPaths: [
    {
      id: 'ap-vendor-to-plc',
      name: 'Vendor Remote Access → PLC Process Manipulation',
      strideCategory: 'Tampering',
      riskLevel: 'Critical',
      description: 'An attacker compromises vendor credentials or the vendor workstation, traverses the SSL VPN tunnel to the VPN gateway, passes through the industrial firewall into the OT zone, reaches the SCADA server, and exploits weak password-based PLC authentication to inject unauthorized process control commands on the Production PLC.',
      steps: [
        {
          order: 1,
          edgeId: 'edge-vendor-vpn',
          sourceNodeId: 'vendor-workstation',
          targetNodeId: 'vpn-gateway',
          technique: 'T1133: External Remote Services',
        },
        {
          order: 2,
          edgeId: 'edge-vpn-firewall',
          sourceNodeId: 'vpn-gateway',
          targetNodeId: 'industrial-firewall',
          technique: 'T1021: Remote Services',
        },
        {
          order: 3,
          edgeId: 'edge-scada-firewall',
          sourceNodeId: 'industrial-firewall',
          targetNodeId: 'scada-server',
          technique: 'T1071: Application Layer Protocol',
        },
        {
          order: 4,
          edgeId: 'edge-plc-production-scada',
          sourceNodeId: 'scada-server',
          targetNodeId: 'plc-production',
          technique: 'T0843: Program Download (ICS)',
        },
      ],
      mitreTechniques: ['T1133', 'T1021', 'T1071', 'T0843'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-scada-to-safety',
      name: 'SCADA Compromise → Safety System Status Manipulation',
      strideCategory: 'Elevation of Privilege',
      riskLevel: 'Critical',
      description: 'An attacker who has compromised the SCADA server exploits the PROFIsafe monitoring connection to the Safety PLC in the Critical Zone, then leverages the safety interlock signals to the Emergency Shutdown System, potentially masking dangerous conditions or triggering unauthorized shutdowns.',
      steps: [
        {
          order: 1,
          edgeId: 'edge-safety-plc-scada',
          sourceNodeId: 'scada-server',
          targetNodeId: 'safety-plc',
          technique: 'T0855: Unauthorized Command Message (ICS)',
        },
        {
          order: 2,
          edgeId: 'edge-emergency-safety-plc',
          sourceNodeId: 'safety-plc',
          targetNodeId: 'emergency-shutdown',
          technique: 'T0816: Device Restart/Shutdown (ICS)',
        },
      ],
      mitreTechniques: ['T0855', 'T0816'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-cloud-to-ot',
      name: 'Cloud Gateway → OT Zone Lateral Movement',
      strideCategory: 'Tampering',
      riskLevel: 'High',
      description: 'An attacker compromises the Azure IoT Edge cloud gateway tenant, exploits the direct MQTT/TLS connection through the industrial firewall into the DMZ, then pivots from the firewall to the SCADA server to reach OT zone assets.',
      steps: [
        {
          order: 1,
          edgeId: 'edge-cloud-firewall',
          sourceNodeId: 'cloud-gateway',
          targetNodeId: 'industrial-firewall',
          technique: 'T1199: Trusted Relationship',
        },
        {
          order: 2,
          edgeId: 'edge-scada-firewall',
          sourceNodeId: 'industrial-firewall',
          targetNodeId: 'scada-server',
          technique: 'T1071: Application Layer Protocol',
        },
        {
          order: 3,
          edgeId: 'edge-plc-production-scada',
          sourceNodeId: 'scada-server',
          targetNodeId: 'plc-production',
          technique: 'T0843: Program Download (ICS)',
        },
      ],
      mitreTechniques: ['T1199', 'T1071', 'T0843'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-engineering-pivot',
      name: 'Engineering Workstation IT/OT Pivot → Process Historian Exfiltration',
      strideCategory: 'Information Disclosure',
      riskLevel: 'High',
      description: 'An attacker compromises the dual-homed engineering workstation via the corporate network (domain controller path), then uses its RDP access through the industrial firewall to reach the SCADA server, and exfiltrates confidential process data from the historian through the data diode transfer path.',
      steps: [
        {
          order: 1,
          edgeId: 'edge-engineering-firewall',
          sourceNodeId: 'engineering-workstation',
          targetNodeId: 'industrial-firewall',
          technique: 'T1021: Remote Services',
        },
        {
          order: 2,
          edgeId: 'edge-scada-firewall',
          sourceNodeId: 'industrial-firewall',
          targetNodeId: 'scada-server',
          technique: 'T1071: Application Layer Protocol',
        },
        {
          order: 3,
          edgeId: 'edge-scada-historian',
          sourceNodeId: 'scada-server',
          targetNodeId: 'historian-server',
          technique: 'T1005: Data from Local System',
        },
        {
          order: 4,
          edgeId: 'edge-historian-diode',
          sourceNodeId: 'historian-server',
          targetNodeId: 'data-diode',
          technique: 'T1041: Exfiltration Over C2 Channel',
        },
      ],
      mitreTechniques: ['T1021', 'T1071', 'T1005', 'T1041'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
  ],
};