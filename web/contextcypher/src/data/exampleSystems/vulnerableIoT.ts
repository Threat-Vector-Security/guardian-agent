// vulnerableIoT.ts
import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityZone, SecurityEdge, SecurityNode } from '../../types/SecurityTypes';
import { DiagramAttackPath, AssessmentThreatModelNodeSourceType, AssessmentThreatModelEdgeSourceType, AttackPathRiskLevel } from '../../types/GrcTypes';
import { colors } from '../../styles/Theme';
import { buildGrcWorkspace, score, NOW, OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID } from './grcSharedBase';
import { StrideCategory } from '../../types/ThreatIntelTypes';

const tierCatalogue = [
  { id: 'tier1-cyber', tier: 1 as const, label: 'Cyber Risk', description: 'Information security and cyber threats' },
  { id: 'tier1-operational', tier: 1 as const, label: 'Operational Risk', description: 'Business operations and process risks' },
  { id: 'tier2-ot-security', tier: 2 as const, label: 'OT Security', parentId: 'tier1-cyber', description: 'Operational technology and IoT device security' },
  { id: 'tier2-network', tier: 2 as const, label: 'Network Security', parentId: 'tier1-cyber', description: 'Network-level threats and controls' },
  { id: 'tier2-identity', tier: 2 as const, label: 'Identity & Access', parentId: 'tier1-cyber', description: 'Authentication and authorization controls' },
  { id: 'tier2-data', tier: 2 as const, label: 'Data Protection', parentId: 'tier1-cyber', description: 'Data-at-rest and data-in-transit protection' },
  { id: 'tier2-physical', tier: 2 as const, label: 'Physical Safety', parentId: 'tier1-operational', description: 'Life safety and building systems integrity' },
  { id: 'tier2-supply-chain', tier: 2 as const, label: 'Supply Chain', parentId: 'tier1-operational', description: 'Third-party and vendor risk management' },
  { id: 'tier3-default-creds', tier: 3 as const, label: 'Default Credentials', parentId: 'tier2-identity' },
  { id: 'tier3-unenc-protocols', tier: 3 as const, label: 'Unencrypted OT Protocols', parentId: 'tier2-ot-security' },
  { id: 'tier3-firmware-vuln', tier: 3 as const, label: 'Firmware Vulnerabilities', parentId: 'tier2-ot-security' },
  { id: 'tier3-weak-segmentation', tier: 3 as const, label: 'Weak Network Segmentation', parentId: 'tier2-network' },
  { id: 'tier3-safety-system-tampering', tier: 3 as const, label: 'Safety System Tampering', parentId: 'tier2-physical' },
  { id: 'tier3-vendor-remote-access', tier: 3 as const, label: 'Vendor Remote Access', parentId: 'tier2-supply-chain' },
  { id: 'tier3-guest-network-exposure', tier: 3 as const, label: 'Guest Network Exposure', parentId: 'tier2-network' },
  { id: 'tier4-bacnet-hardening', tier: 4 as const, label: 'BACnet Protocol Hardening', parentId: 'tier3-unenc-protocols' },
  { id: 'tier4-credential-rotation', tier: 4 as const, label: 'Credential Rotation Policy', parentId: 'tier3-default-creds' },
  { id: 'tier4-ota-signing', tier: 4 as const, label: 'OTA Firmware Signing', parentId: 'tier3-firmware-vuln' },
  { id: 'tier4-microsegmentation', tier: 4 as const, label: 'IoT Micro-segmentation', parentId: 'tier3-weak-segmentation' },
];

const assets = [
  {
    id: 'asset-hvac-controller', name: 'Johnson Controls Metasys HVAC', type: 'plc', owner: 'Facilities Engineering',
    domain: 'ot' as const, category: 'Building Automation',
    businessCriticality: 4, securityCriticality: 4,
    description: 'BACnet/IP HVAC controller with default vendor credentials and unencrypted control protocol',
    criticality: { confidentiality: 2, integrity: 4, availability: 5, financial: 3, reputation: 3, safety: 4 },
    diagramRefs: [{ diagramId: 'vulnerable-iot', nodeId: 'hvac-controller', nodeLabel: 'HVAC Controller', nodeType: 'plc' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-fire-alarm', name: 'Honeywell NOTIFIER Fire Alarm Panel', type: 'plc', owner: 'Safety & Compliance',
    domain: 'ot' as const, category: 'Life Safety',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Fire alarm control panel using unencrypted RS-485 for emergency lighting integration',
    criticality: { confidentiality: 3, integrity: 5, availability: 5, financial: 4, reputation: 5, safety: 5 },
    diagramRefs: [{ diagramId: 'vulnerable-iot', nodeId: 'fire-alarm-panel', nodeLabel: 'Fire Alarm Control Panel', nodeType: 'plc' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-iot-gateway', name: 'Cisco IR1101 IoT Gateway', type: 'gateway', owner: 'Network Operations',
    domain: 'ot' as const, category: 'Network Infrastructure',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Central aggregation point for all OT-zone IoT device traffic',
    criticality: { confidentiality: 3, integrity: 5, availability: 5, financial: 4, reputation: 4, safety: 3 },
    diagramRefs: [{ diagramId: 'vulnerable-iot', nodeId: 'iot-gateway', nodeLabel: 'IoT Gateway', nodeType: 'gateway' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-building-hub', name: 'Siemens Desigo CC BMS', type: 'server', owner: 'Facilities Engineering',
    domain: 'ot' as const, category: 'Building Management',
    businessCriticality: 5, securityCriticality: 4,
    description: 'Central building management server aggregating all IoT subsystem data',
    criticality: { confidentiality: 3, integrity: 4, availability: 5, financial: 4, reputation: 4, safety: 3 },
    diagramRefs: [{ diagramId: 'vulnerable-iot', nodeId: 'building-hub', nodeLabel: 'Building Management Server', nodeType: 'server' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-vendor-portal', name: 'TeamViewer Vendor Support Portal', type: 'application', owner: 'IT Operations',
    domain: 'it' as const, category: 'Remote Access',
    businessCriticality: 2, securityCriticality: 4,
    description: 'Third-party remote access portal for vendor maintenance with potential backdoor risk',
    criticality: { confidentiality: 4, integrity: 3, availability: 2, financial: 2, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-iot', nodeId: 'vendor-portal', nodeLabel: 'Vendor Support Portal', nodeType: 'application' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-access-controller', name: 'HID VertX V1000 Access Control', type: 'plc', owner: 'Physical Security',
    domain: 'ot' as const, category: 'Physical Security',
    businessCriticality: 4, securityCriticality: 5,
    description: 'Physical access control panel managing door locks and card readers via Wiegand protocol',
    criticality: { confidentiality: 4, integrity: 5, availability: 4, financial: 3, reputation: 4, safety: 4 },
    diagramRefs: [{ diagramId: 'vulnerable-iot', nodeId: 'access-controller', nodeLabel: 'Access Control Panel', nodeType: 'plc' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-smart-lock', name: 'August Smart Lock Pro', type: 'sensor', owner: 'Physical Security',
    domain: 'ot' as const, category: 'Physical Security',
    businessCriticality: 3, securityCriticality: 4,
    description: 'WiFi-connected smart door lock with mobile app PIN authentication',
    criticality: { confidentiality: 3, integrity: 4, availability: 3, financial: 2, reputation: 3, safety: 3 },
    diagramRefs: [{ diagramId: 'vulnerable-iot', nodeId: 'smart-lock-1', nodeLabel: 'Smart Door Lock', nodeType: 'sensor' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-energy-monitor', name: 'Schneider PowerLogic ION Energy Monitor', type: 'server', owner: 'Facilities Engineering',
    domain: 'ot' as const, category: 'Energy Management',
    businessCriticality: 3, securityCriticality: 3,
    description: 'Energy monitoring system using unencrypted Modbus TCP protocol',
    criticality: { confidentiality: 2, integrity: 3, availability: 3, financial: 3, reputation: 2, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-iot', nodeId: 'energy-monitor', nodeLabel: 'Energy Monitoring System', nodeType: 'server' }],
    createdAt: NOW, updatedAt: NOW,
  },
];

const risks = [
  {
    id: 'risk-hvac-default-creds', title: 'HVAC Controller Default Credentials',
    description: 'Johnson Controls Metasys HVAC controller retains factory-default credentials, enabling unauthorized access to building climate control systems via BACnet/IP.',
    status: 'assessed' as const, owner: 'Facilities Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Identity & Access', tier3: 'Default Credentials' },
    assetIds: ['asset-hvac-controller'],
    diagramLinks: [{ diagramId: 'vulnerable-iot', nodeIds: ['hvac-controller'] }],
    inherentScore: score('likelihood-5', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Rotate HVAC controller credentials and implement certificate-based authentication for BACnet access',
    threatActorIds: ['threat-actor-iot-botnet'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-unenc-bacnet', title: 'Unencrypted BACnet/IP HVAC Traffic',
    description: 'BACnet/IP traffic between HVAC controller and IoT gateway is transmitted in plaintext, enabling eavesdropping and injection of malicious control commands.',
    status: 'assessed' as const, owner: 'Network Operations',
    tierPath: { tier1: 'Cyber Risk', tier2: 'OT Security', tier3: 'Unencrypted OT Protocols' },
    assetIds: ['asset-hvac-controller', 'asset-iot-gateway'],
    diagramLinks: [{ diagramId: 'vulnerable-iot', nodeIds: ['hvac-controller', 'iot-gateway'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Deploy BACnet Secure Connect (BACnet/SC) or wrap BACnet traffic in TLS tunnels',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-fire-alarm-unenc', title: 'Unencrypted Fire Alarm RS-485 Communication',
    description: 'Fire alarm panel communicates with emergency lighting via unencrypted RS-485, creating risk of false alarm injection or suppression of genuine alerts.',
    status: 'draft' as const, owner: 'Safety & Compliance',
    tierPath: { tier1: 'Operational Risk', tier2: 'Physical Safety', tier3: 'Safety System Tampering' },
    assetIds: ['asset-fire-alarm'],
    diagramLinks: [{ diagramId: 'vulnerable-iot', nodeIds: ['fire-alarm-panel', 'emergency-lighting'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Implement physical isolation and tamper detection on RS-485 bus; schedule upgrade to encrypted serial communication',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-vendor-backdoor', title: 'Vendor Remote Access Backdoor',
    description: 'TeamViewer vendor support portal provides persistent remote access through the internal firewall, creating a potential backdoor for supply chain compromise.',
    status: 'assessed' as const, owner: 'IT Operations',
    tierPath: { tier1: 'Operational Risk', tier2: 'Supply Chain', tier3: 'Vendor Remote Access' },
    assetIds: ['asset-vendor-portal'],
    diagramLinks: [{ diagramId: 'vulnerable-iot', nodeIds: ['vendor-portal', 'internal-firewall'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Replace always-on remote access with just-in-time VPN access; implement session recording and approval workflows',
    threatActorIds: ['threat-actor-supply-chain-vendor'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-iot-gateway-pivot', title: 'IoT Gateway as Lateral Movement Pivot',
    description: 'The IoT gateway aggregates traffic from all OT devices and connects to multiple DMZ systems, making it a high-value pivot point for lateral movement across security zones.',
    status: 'draft' as const, owner: 'Network Operations',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Network Security', tier3: 'Weak Network Segmentation' },
    assetIds: ['asset-iot-gateway', 'asset-building-hub', 'asset-energy-monitor'],
    diagramLinks: [{ diagramId: 'vulnerable-iot', nodeIds: ['iot-gateway', 'building-hub', 'energy-monitor'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Implement micro-segmentation per device class; deploy east-west traffic inspection on IoT gateway',
    threatActorIds: ['threat-actor-iot-botnet'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-smart-lock-replay', title: 'Smart Lock Credential Replay Attack',
    description: 'August Smart Lock Pro communicates over WiFi with WPA2. Weak encryption and unencrypted local traffic allow credential replay attacks to unlock doors.',
    status: 'assessed' as const, owner: 'Physical Security',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Identity & Access', tier3: 'Default Credentials' },
    assetIds: ['asset-smart-lock', 'asset-access-controller'],
    diagramLinks: [{ diagramId: 'vulnerable-iot', nodeIds: ['smart-lock-1', 'access-controller'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Upgrade to locks with BLE 5.0 mutual authentication; enable per-session token rotation',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-modbus-injection', title: 'Modbus TCP Command Injection',
    description: 'Energy monitoring system uses unencrypted Modbus TCP from the IoT gateway, allowing an attacker with network access to inject false readings or manipulate meter data.',
    status: 'draft' as const, owner: 'Facilities Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'OT Security', tier3: 'Unencrypted OT Protocols' },
    assetIds: ['asset-energy-monitor', 'asset-iot-gateway'],
    diagramLinks: [{ diagramId: 'vulnerable-iot', nodeIds: ['energy-monitor', 'iot-gateway'] }],
    inherentScore: score('likelihood-3', 'impact-3'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Wrap Modbus TCP in TLS tunnel; deploy Modbus-aware deep packet inspection on DMZ firewall',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-mobile-bms-compromise', title: 'Mobile App Compromise Affecting Building Systems',
    description: 'The building management mobile app can issue remote control commands to the BMS. A compromised mobile device could manipulate HVAC, lighting, and access controls.',
    status: 'assessed' as const, owner: 'IT Operations',
    tierPath: { tier1: 'Cyber Risk', tier2: 'OT Security', tier3: 'Firmware Vulnerabilities' },
    assetIds: ['asset-building-hub'],
    diagramLinks: [{ diagramId: 'vulnerable-iot', nodeIds: ['mobile-app', 'building-hub'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Enforce device posture checks; implement command whitelisting on BMS API; require MFA for control actions',
    createdAt: NOW, updatedAt: NOW,
  },
];

const assessments = [
  {
    id: 'assessment-iot-security-review', title: 'Smart Building IoT Security Assessment',
    status: 'in_review' as const,
    owner: 'IoT Security Specialist',
    reviewer: 'CISO',
    startDate: '2025-05-01',
    dueDate: '2025-07-15',
    threatActorIds: ['threat-actor-iot-botnet', 'threat-actor-supply-chain-vendor', 'threat-actor-insider-fm'],
    methodologyNote: 'Assessment follows IEC 62443 industrial automation security methodology with OWASP IoT Top 10 mapping.',
    assumptionNote: 'Assessment covers production building automation systems. Test/staging environments excluded. Assumes physical perimeter is intact.',
    scopeItems: [
      { id: 'scope-system-iot', type: 'system' as const, value: 'system', name: 'Smart Building IoT Ecosystem' },
      { id: 'scope-zone-ot', type: 'diagram_segment' as const, value: 'OT', name: 'OT Zone' },
      { id: 'scope-zone-critical', type: 'diagram_segment' as const, value: 'Critical', name: 'Critical Zone' },
      { id: 'scope-zone-dmz', type: 'diagram_segment' as const, value: 'DMZ', name: 'DMZ Zone' },
    ],
    tierFilter: { tier1: 'Cyber Risk' },
    riskManagementPlan: {
      objective: 'Reduce exposure of OT and safety-critical systems to cyber threats while maintaining building operations uptime.',
      strategy: 'Prioritize credential hygiene and protocol encryption on safety-critical paths, then harden lateral movement vectors.',
      residualRiskStatement: 'Residual risk accepted for legacy RS-485 safety bus pending hardware upgrade cycle in Q4 2025.',
      monitoringApproach: 'Bi-weekly review of open plan actions with monthly Armis anomaly report analysis.',
      communicationPlan: 'Report progress to Building Security Committee every two weeks.',
      reviewCadenceDays: 14,
      actions: [
        {
          id: 'rmp-action-hvac-creds',
          title: 'Rotate HVAC controller default credentials and enforce unique passwords',
          owner: 'Facilities Engineering',
          dueDate: '2025-06-15',
          status: 'in_progress' as const,
          linkedRiskIds: ['risk-hvac-default-creds'],
          notes: 'Credential rotation script developed; testing on floor 3 HVAC units',
        },
        {
          id: 'rmp-action-bacnet-tls',
          title: 'Deploy BACnet/SC or TLS tunnel for HVAC-to-gateway traffic',
          owner: 'Network Operations',
          dueDate: '2025-07-31',
          status: 'planned' as const,
          linkedRiskIds: ['risk-unenc-bacnet'],
          notes: 'Vendor confirming BACnet/SC support on Metasys 12.x firmware',
        },
        {
          id: 'rmp-action-vendor-jit',
          title: 'Replace always-on TeamViewer with just-in-time VPN portal',
          owner: 'IT Operations',
          dueDate: '2025-06-30',
          status: 'planned' as const,
          linkedRiskIds: ['risk-vendor-backdoor'],
          notes: '',
        },
        {
          id: 'rmp-action-microseg',
          title: 'Implement per-device-class micro-segmentation on IoT gateway',
          owner: 'Network Operations',
          dueDate: '2025-08-15',
          status: 'planned' as const,
          linkedRiskIds: ['risk-iot-gateway-pivot'],
          notes: '',
        },
      ],
      updatedAt: NOW,
    },
    riskIds: risks.map(r => r.id),
    soaGapIds: ['soa-iot-a05', 'soa-iot-a07', 'soa-iot-a02'],
    taskIds: ['task-hvac-cred-rotation', 'task-vendor-access-review'],
    linkedImplementedControlIds: [],
    linkedInitiativeIds: [],
    summary: 'Comprehensive security assessment of the smart building IoT ecosystem covering OT, DMZ, and Critical zones. Assessment identified 8 risks with 2 Critical, 4 High, and 2 Medium ratings.',
    findings: 'Key findings include default credentials on HVAC controllers, unencrypted OT protocols (BACnet/IP, Modbus TCP, RS-485), vendor remote access backdoor, and IoT gateway as a lateral movement pivot.',
    recommendations: 'Prioritize credential rotation on all OT controllers, encrypt control protocols, replace always-on vendor remote access with just-in-time sessions, and implement micro-segmentation.',
    evidenceSummary: 'Evidence includes Armis device discovery scan, Nessus OT vulnerability assessment, BACnet traffic captures, and HVAC credential audit results.',
    threatModel: {
      nodes: [
        { id: 'tm-node-hvac', label: 'HVAC Controller', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'hvac-controller', position: { x: 50, y: 150 }, nodeType: 'plc', commentary: 'Default vendor credentials; BACnet/IP unencrypted' },
        { id: 'tm-node-gateway', label: 'IoT Gateway', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'iot-gateway', position: { x: 250, y: 150 }, nodeType: 'gateway', commentary: 'Aggregation point for all OT traffic; pivot risk' },
        { id: 'tm-node-building-hub', label: 'Building Management Server', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'building-hub', position: { x: 450, y: 150 }, nodeType: 'server' },
        { id: 'tm-node-energy', label: 'Energy Monitor', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'energy-monitor', position: { x: 450, y: 300 }, nodeType: 'server', commentary: 'Unencrypted Modbus TCP protocol' },
        { id: 'tm-node-fire', label: 'Fire Alarm Panel', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'fire-alarm-panel', position: { x: 50, y: 300 }, nodeType: 'plc', commentary: 'RS-485 unencrypted safety bus' },
        { id: 'tm-node-emergency', label: 'Emergency Lighting', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'emergency-lighting', position: { x: 250, y: 300 }, nodeType: 'sensor' },
      ],
      edges: [
        { id: 'tm-edge-hvac-gw', source: 'tm-node-hvac', target: 'tm-node-gateway', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e-hvac-gateway', label: 'BACnet/IP (unencrypted)', commentary: 'Plaintext control commands; no authentication' },
        { id: 'tm-edge-gw-hub', source: 'tm-node-gateway', target: 'tm-node-building-hub', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e-gateway-building-hub', label: 'Aggregated IoT Data (TLS 1.2)', commentary: 'Weak TLS configuration' },
        { id: 'tm-edge-gw-energy', source: 'tm-node-gateway', target: 'tm-node-energy', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e-gateway-energy-monitor', label: 'Modbus TCP (unencrypted)', commentary: 'No encryption or authentication on Modbus' },
        { id: 'tm-edge-fire-emerg', source: 'tm-node-fire', target: 'tm-node-emergency', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e-fire-alarm-emergency-lighting', label: 'RS-485 (unencrypted)', commentary: 'Safety-critical path with no integrity protection' },
      ],
      attackPathDescription: 'Two primary attack vectors identified: (1) HVAC controller compromise via default credentials pivoting through the IoT gateway to the building management server; (2) Fire alarm RS-485 bus tampering enabling false alarm injection or suppression.',
      attackPaths: [
        {
          id: 'aap-hvac-gateway-bms',
          name: 'HVAC Default Credentials → IoT Gateway → BMS Compromise',
          strideCategory: 'Elevation of Privilege' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'Attacker authenticates to HVAC controller using default vendor credentials, pivots through the IoT gateway via the unencrypted BACnet/IP channel, and gains access to the central building management server.',
          diagramAttackPathId: 'ap-hvac-to-bms',
          steps: [
            { order: 1, edgeId: 'e-hvac-gateway', sourceNodeId: 'hvac-controller', targetNodeId: 'iot-gateway', technique: 'T1078: Valid Accounts (default credentials)' },
            { order: 2, edgeId: 'e-gateway-building-hub', sourceNodeId: 'iot-gateway', targetNodeId: 'building-hub', technique: 'T1021: Remote Services' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
        {
          id: 'aap-fire-alarm-tamper',
          name: 'Fire Alarm RS-485 Bus Tampering',
          strideCategory: 'Tampering' as StrideCategory,
          riskLevel: 'High' as AttackPathRiskLevel,
          description: 'An attacker with physical proximity injects crafted RS-485 frames to suppress genuine fire alarms or trigger false emergency lighting activation.',
          diagramAttackPathId: 'ap-fire-alarm-tamper',
          steps: [
            { order: 1, edgeId: 'e-fire-alarm-emergency-lighting', sourceNodeId: 'fire-alarm-panel', targetNodeId: 'emergency-lighting', technique: 'T1557: Adversary-in-the-Middle' },
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
    id: 'soa-iot-a01', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A01', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Physical access controls enforced at building perimeter. IoT device access relies on device-level PINs and pairing. HVAC and lighting controllers use basic web authentication.',
    mitigatesRiskIds: ['risk-hvac-default-creds', 'risk-smart-lock-replay'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'soa-iot-a02', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A02', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'BACnet/IP, Modbus TCP, and RS-485 communications are all unencrypted. TLS 1.2 used for IoT gateway uplinks but with weak configuration.',
    mitigatesRiskIds: ['risk-unenc-bacnet', 'risk-fire-alarm-unenc', 'risk-modbus-injection'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'soa-iot-a04', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A04', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'planned' as const,
    justification: 'Architecture review planned to address IoT gateway as single pivot point, lack of micro-segmentation, and vendor remote access design.',
    mitigatesRiskIds: ['risk-iot-gateway-pivot', 'risk-vendor-backdoor'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'soa-iot-a05', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A05', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'HVAC controllers retain default credentials. Energy monitor uses basic web authentication. Vendor portal has always-on remote access.',
    mitigatesRiskIds: ['risk-hvac-default-creds', 'risk-vendor-backdoor'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'soa-iot-a06', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A06', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'IoT patch management service deployed. However, firmware update cycle for OT devices averages 6 months, leaving known vulnerabilities exposed.',
    mitigatesRiskIds: ['risk-mobile-bms-compromise'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'soa-iot-a07', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A07', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Domain authentication enforced for management workstations. IoT devices use device-specific PINs and pairing. Smart lock uses mobile app PIN with AES-128.',
    mitigatesRiskIds: ['risk-hvac-default-creds', 'risk-smart-lock-replay'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'soa-iot-a09', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A09', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'implemented' as const,
    justification: 'Armis IoT security monitor deployed for device discovery and behavioral anomaly detection. Network firewall sends syslog/TLS to security monitor.',
    mitigatesRiskIds: ['risk-iot-gateway-pivot'],
    diagramRefs: [], evidence: [
      { id: 'evidence-armis-config', kind: 'link' as const, name: 'Armis IoT Monitor Configuration', url: 'https://security.smartbuilding.local/armis-config', note: 'Device discovery and anomaly detection baseline', createdAt: NOW },
    ], updatedAt: NOW,
  },
  {
    id: 'soa-iot-cis01', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.01', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'implemented' as const,
    justification: 'Armis platform maintains real-time inventory of all IoT devices. Over 1,200 devices tracked across all zones.',
    mitigatesRiskIds: [], diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'soa-iot-cis04', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.04', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'OT device hardening incomplete. Default credentials on HVAC controllers, unencrypted protocols, and legacy RS-485 safety bus remain unhardened.',
    mitigatesRiskIds: ['risk-hvac-default-creds', 'risk-unenc-bacnet', 'risk-fire-alarm-unenc'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'soa-iot-cis06', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.06', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'planned' as const,
    justification: 'Micro-segmentation planned for IoT gateway. Currently all OT devices share a flat network segment behind the gateway.',
    mitigatesRiskIds: ['risk-iot-gateway-pivot'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
];

const workflowTasks = [
  {
    id: 'task-hvac-cred-rotation',
    title: 'Rotate default credentials on all HVAC controllers',
    description: 'Replace factory-default passwords on Johnson Controls Metasys units across all 20 floors.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'critical' as const,
    owner: 'Facilities Engineering',
    dueDate: '2025-06-15',
    riskId: 'risk-hvac-default-creds',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'task-vendor-access-review',
    title: 'Review and restrict vendor remote access sessions',
    description: 'Audit TeamViewer sessions; implement just-in-time access approval workflow.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'IT Operations',
    dueDate: '2025-06-30',
    riskId: 'risk-vendor-backdoor',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'task-bacnet-encryption',
    title: 'Deploy BACnet/SC or TLS wrapper for OT protocols',
    description: 'Encrypt BACnet/IP and Modbus TCP traffic between OT devices and IoT gateway.',
    type: 'control_implementation' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Network Operations',
    dueDate: '2025-07-31',
    assessmentId: 'assessment-iot-security-review',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'task-evidence-armis',
    title: 'Attach Armis device inventory evidence for CIS.01',
    description: 'Export device discovery report from Armis platform as evidence for asset inventory control.',
    type: 'evidence' as const,
    status: 'todo' as const,
    priority: 'medium' as const,
    owner: 'IoT Security Specialist',
    dueDate: '2025-06-15',
    controlSetId: CIS_CONTROL_SET_ID,
    controlId: 'CIS.01',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'task-microseg-design',
    title: 'Design micro-segmentation architecture for IoT gateway',
    description: 'Create per-device-class VLANs and ACLs on the Cisco IR1101 IoT gateway.',
    type: 'control_implementation' as const,
    status: 'blocked' as const,
    priority: 'high' as const,
    owner: 'Network Operations',
    dueDate: '2025-08-15',
    riskId: 'risk-iot-gateway-pivot',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'task-quarterly-ot-audit',
    title: 'Quarterly OT device security audit',
    description: 'Review credential hygiene, firmware versions, and protocol security across all OT zone devices.',
    type: 'review' as const,
    status: 'todo' as const,
    priority: 'medium' as const,
    owner: 'IoT Security Specialist',
    dueDate: '2025-09-01',
    createdAt: NOW, updatedAt: NOW,
  },
];

const threatActors = [
  {
    id: 'threat-actor-iot-botnet', name: 'Mirai-Variant IoT Botnet Operators',
    type: 'opportunistic' as const, capabilityLevel: 2,
    resourceLevel: 'low' as const,
    motivation: 'Mass exploitation of IoT devices with default credentials for botnet recruitment, DDoS-for-hire, and cryptocurrency mining.',
    description: 'Automated scanning networks targeting IoT devices with factory-default credentials and known firmware vulnerabilities. Primarily uses Mirai-variant malware.',
    targetedAssetIds: ['asset-hvac-controller', 'asset-smart-lock', 'asset-energy-monitor'],
    tags: ['automated', 'botnet', 'iot-targeting', 'credential-stuffing'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'threat-actor-supply-chain-vendor', name: 'Compromised BAS Vendor',
    type: 'supply_chain' as const, capabilityLevel: 4,
    resourceLevel: 'high' as const,
    motivation: 'Persistent access to building automation networks through compromised vendor update channels or remote access tooling.',
    description: 'Threat actor operating through compromised building automation system vendor, leveraging legitimate remote support channels to maintain persistent access to customer environments.',
    targetedAssetIds: ['asset-vendor-portal', 'asset-building-hub', 'asset-hvac-controller'],
    tags: ['supply-chain', 'vendor-compromise', 'persistent-access', 'building-automation'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'threat-actor-insider-fm', name: 'Disgruntled Facility Management Staff',
    type: 'insider' as const, capabilityLevel: 3,
    resourceLevel: 'moderate' as const,
    motivation: 'Sabotage of building systems or theft of building access credentials for personal gain or grievance.',
    description: 'Current or former facility management employee with knowledge of HVAC credentials, access control systems, and building management interfaces.',
    targetedAssetIds: ['asset-hvac-controller', 'asset-access-controller', 'asset-building-hub'],
    tags: ['insider-threat', 'physical-access', 'building-systems-knowledge'],
    createdAt: NOW, updatedAt: NOW,
  },
];

const threatScenarios = [
  {
    id: 'scenario-hvac-botnet', title: 'HVAC Controller Recruitment into IoT Botnet',
    description: 'Automated Mirai-variant scanner discovers HVAC controllers with default credentials via exposed BACnet/IP ports, enrolls them into a botnet for DDoS attacks or cryptocurrency mining, degrading building climate control performance.',
    threatActorId: 'threat-actor-iot-botnet',
    targetedAssetIds: ['asset-hvac-controller', 'asset-iot-gateway'],
    attackTechniques: ['T1078 - Valid Accounts (Default Credentials)', 'T1583.005 - Botnet', 'T1496 - Resource Hijacking'],
    linkedRiskIds: ['risk-hvac-default-creds', 'risk-unenc-bacnet'],
    likelihood: 'High — default credentials are trivially exploitable by automated scanners.',
    impact: 'Major — botnet enrollment degrades HVAC performance; building comfort and energy costs impacted; potential lateral movement to other OT systems.',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'scenario-vendor-bms-compromise', title: 'Vendor Portal Exploitation Leading to BMS Takeover',
    description: 'Attacker compromises the TeamViewer vendor portal through credential theft or session hijacking, traverses the internal firewall, and gains access to the building management server to manipulate HVAC, lighting, and access controls.',
    threatActorId: 'threat-actor-supply-chain-vendor',
    targetedAssetIds: ['asset-vendor-portal', 'asset-building-hub'],
    attackTechniques: ['T1133 - External Remote Services', 'T1021 - Remote Services', 'T1565 - Data Manipulation'],
    linkedRiskIds: ['risk-vendor-backdoor', 'risk-iot-gateway-pivot'],
    likelihood: 'Moderate — requires compromising vendor credentials but always-on access reduces detection window.',
    impact: 'Critical — full BMS compromise enables manipulation of building safety systems, physical access controls, and environmental conditions.',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'scenario-fire-alarm-sabotage', title: 'Fire Alarm System Sabotage via RS-485 Tampering',
    description: 'Insider with physical access to the RS-485 bus injects crafted frames to suppress genuine fire alarms or trigger false evacuations, endangering building occupants.',
    threatActorId: 'threat-actor-insider-fm',
    targetedAssetIds: ['asset-fire-alarm'],
    attackTechniques: ['T1557 - Adversary-in-the-Middle', 'T1485 - Data Destruction', 'T1498 - Network Denial of Service'],
    linkedRiskIds: ['risk-fire-alarm-unenc'],
    likelihood: 'Low — requires physical proximity to RS-485 bus and specialized knowledge.',
    impact: 'Critical — suppressed fire alarms directly endanger life safety; false evacuations cause operational disruption and potential panic injuries.',
    createdAt: NOW, updatedAt: NOW,
  },
];

const appetiteRules = [
  {
    id: 'appetite-mission-critical', name: 'Mission-Critical Assets',
    description: 'Lower appetite threshold for risks affecting assets with maximum business criticality.',
    scopeAssetCriticalityMin: 5,
    thresholdScore: 8,
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'appetite-cyber-tier', name: 'Cyber Risk Tier',
    description: 'Reduced appetite for all risks classified under the Cyber Risk tier.',
    scopeTier1: 'Cyber Risk',
    thresholdScore: 10,
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'appetite-ot-domain', name: 'OT Domain Assets',
    description: 'Strict appetite threshold for operational technology assets due to safety implications in building automation.',
    scopeAssetDomain: 'ot' as const,
    thresholdScore: 6,
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'appetite-safety-systems', name: 'Life Safety Systems',
    description: 'Zero tolerance for risks affecting life safety systems including fire alarm, emergency lighting, and mass notification.',
    scopeTier1: 'Operational Risk',
    scopeTier2: 'Physical Safety',
    thresholdScore: 4,
    createdAt: NOW, updatedAt: NOW,
  },
];

export const vulnerableIoTGrcWorkspace = buildGrcWorkspace({
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
      id: 'viot-tp-johnson-controls',
      name: 'Johnson Controls',
      description: 'Building management system (BMS) and HVAC equipment supplier providing Metasys controllers, sensor networks, and cloud-based analytics for heating, ventilation, and air conditioning systems.',
      category: 'supplier' as const,
      status: 'active' as const,
      riskRating: 'high' as const,
      dataClassification: 'internal' as const,
      linkedAssetIds: ['asset-hvac-controller', 'asset-building-hub'],
      linkedRiskIds: ['risk-hvac-default-creds', 'risk-unenc-bacnet'],
      contactName: 'Brian Walsh',
      contactEmail: 'brian.walsh@johnsoncontrols.example.com',
      contractExpiry: '2027-08-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-08-31',
      notes: 'Johnson Controls Metasys system with BACnet/IP communication. HVAC controllers shipped with default credentials that were never changed during commissioning. BACnet traffic unencrypted on the OT network — any device on the BMS VLAN can read/write setpoints. Firmware updates delivered via USB by field technicians without code signing verification. Maintenance contract includes quarterly on-site visits. Cyber incident at Johnson Controls in 2023 noted in risk register.'
    },
    {
      id: 'viot-tp-honeywell',
      name: 'Honeywell',
      description: 'Fire alarm and life safety system supplier providing fire detection panels, smoke sensors, notification appliances, and integration with the building management hub.',
      category: 'supplier' as const,
      status: 'active' as const,
      riskRating: 'critical' as const,
      dataClassification: 'internal' as const,
      linkedAssetIds: ['asset-fire-alarm', 'asset-building-hub'],
      linkedRiskIds: ['risk-fire-alarm-unenc', 'risk-iot-gateway-pivot'],
      contactName: 'Patricia Reynolds',
      contactEmail: 'patricia.reynolds@honeywell.example.com',
      contractExpiry: '2027-06-30',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-06-30',
      notes: 'Honeywell Notifier fire alarm system — life safety rated. Fire alarm panel communication unencrypted, enabling potential spoofing of alarm states. Integration with building hub creates pivot path from IT network to safety-critical systems. Firmware updates require vendor on-site presence. System must maintain NFPA 72 compliance — any network changes require fire marshal re-certification. Annual inspection by licensed fire protection engineer.'
    },
    {
      id: 'viot-tp-schneider',
      name: 'Schneider Electric',
      description: 'Energy monitoring and power management supplier providing smart meters, power distribution units, and EcoStruxure cloud analytics for building energy optimization.',
      category: 'supplier' as const,
      status: 'active' as const,
      riskRating: 'medium' as const,
      dataClassification: 'internal' as const,
      linkedAssetIds: ['asset-energy-monitor', 'asset-iot-gateway'],
      linkedRiskIds: ['risk-modbus-injection', 'risk-iot-gateway-pivot'],
      contactName: 'Jean-Pierre Dubois',
      contactEmail: 'jean-pierre.dubois@schneider.example.com',
      contractExpiry: '2027-03-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-09-30',
      notes: 'Schneider Electric EcoStruxure Power Monitoring Expert with Modbus/TCP energy meters. Modbus protocol lacks authentication — injection of malicious commands can manipulate power readings or trip breakers. Energy data streams through IoT gateway to cloud analytics. EcoStruxure cloud platform processes building energy data for optimization recommendations. IEC 62443 compliance assessment pending. Known Schneider CVEs tracked in vulnerability management program.'
    },
    {
      id: 'viot-tp-hid-global',
      name: 'HID Global',
      description: 'Physical access control supplier providing card readers, mobile credentials, smart lock controllers, and identity management integration for building entry points.',
      category: 'supplier' as const,
      status: 'active' as const,
      riskRating: 'high' as const,
      dataClassification: 'confidential' as const,
      linkedAssetIds: ['asset-access-controller', 'asset-smart-lock'],
      linkedRiskIds: ['risk-smart-lock-replay', 'risk-vendor-backdoor'],
      contactName: 'Lisa Andersen',
      contactEmail: 'lisa.andersen@hidglobal.example.com',
      contractExpiry: '2027-01-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-07-31',
      notes: 'HID iCLASS SE smart card readers and mobile access via HID Mobile Access app. Smart lock communication vulnerable to replay attacks due to static challenge-response tokens. Vendor portal access for HID technicians uses shared credentials — backdoor risk identified. Card credential database contains employee PII and access zone assignments. Migration from legacy 125kHz prox cards to SEOS mobile credentials in progress. SOC 2 Type II under review.'
    },
    {
      id: 'viot-tp-siemens',
      name: 'Siemens',
      description: 'Managed building automation service providing Desigo CC integration platform, remote monitoring, and predictive maintenance for HVAC, lighting, and energy systems.',
      category: 'managed_service' as const,
      status: 'active' as const,
      riskRating: 'high' as const,
      dataClassification: 'internal' as const,
      linkedAssetIds: ['asset-building-hub', 'asset-iot-gateway', 'asset-vendor-portal'],
      linkedRiskIds: ['risk-vendor-backdoor', 'risk-mobile-bms-compromise'],
      contactName: 'Klaus Müller',
      contactEmail: 'klaus.mueller@siemens.example.com',
      contractExpiry: '2027-05-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-11-30',
      notes: 'Siemens Desigo CC building automation platform with SiPass integrated security. Remote monitoring via Siemens cloud requires persistent VPN tunnel from building hub — creates potential IT-to-OT bridge. Vendor portal provides Siemens engineers remote access for diagnostics and firmware updates. Mobile BMS app communicates with Desigo CC over cellular — man-in-the-middle risk on mobile connections. SLA requires 4-hour response for critical alarms. IEC 62443 SL2 certification in progress.'
    },
  ],
  securityInitiatives: [
    {
      id: 'viot-si-firmware-auth', title: 'IoT Firmware Security & Device Authentication Uplift',
      description: 'Harden IoT device firmware update processes with cryptographic signing and replace default credentials with certificate-based authentication across all building automation controllers.',
      category: 'uplift' as const, status: 'in_progress' as const, priority: 'critical' as const,
      owner: 'Facilities Engineering', executiveSponsor: 'CISO',
      currentState: 'HVAC controllers retain factory-default credentials; firmware updates delivered via USB without code signing; BACnet/IP authentication is password-only with no rotation policy.',
      targetState: 'All OT controllers use certificate-based authentication with quarterly rotation; OTA firmware updates verified via cryptographic signature; BACnet Secure Connect deployed for encrypted control traffic.',
      startDate: '2025-06-01', targetDate: '2026-06-30', completedDate: '',
      milestones: [
        { id: 'viot-ms-fw-01', title: 'Rotate all HVAC controller default credentials', description: 'Replace factory-default passwords on all Johnson Controls Metasys HVAC controllers with unique, strong credentials managed via PAM solution.', status: 'completed' as const, dueDate: '2025-09-30', completedDate: '2025-09-15', owner: 'Facilities Engineering' },
        { id: 'viot-ms-fw-02', title: 'Deploy OTA firmware signing for building automation devices', description: 'Implement code-signing infrastructure for OTA firmware updates across HVAC, energy monitoring, and access control devices.', status: 'in_progress' as const, dueDate: '2026-03-31', completedDate: '', owner: 'IoT Security Specialist' },
        { id: 'viot-ms-fw-03', title: 'Migrate BACnet/IP to BACnet Secure Connect', description: 'Upgrade BACnet/IP communication to BACnet/SC with TLS encryption on all HVAC-to-gateway traffic paths.', status: 'pending' as const, dueDate: '2026-06-30', completedDate: '', owner: 'Network Operations' },
      ],
      linkedRiskIds: ['risk-hvac-default-creds', 'risk-unenc-bacnet', 'risk-mobile-bms-compromise'],
      linkedControlSetIds: [],
      linkedAssetIds: ['asset-hvac-controller', 'asset-iot-gateway', 'asset-building-hub'],
      linkedImplementedControlIds: ['viot-ic-armis-monitor'],
      linkedAssessmentIds: ['assessment-iot-security-review'],
      notes: 'Credential rotation completed for 85% of HVAC controllers. BACnet/SC requires Metasys 12.x firmware upgrade on all controllers.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'viot-si-network-segmentation', title: 'IoT Network Micro-segmentation & Monitoring',
      description: 'Implement per-device-class micro-segmentation on the IoT gateway and deploy east-west traffic inspection to prevent lateral movement between OT device groups.',
      category: 'remediation' as const, status: 'approved' as const, priority: 'high' as const,
      owner: 'Network Operations', executiveSponsor: 'VP Infrastructure',
      currentState: 'All OT devices share a flat network segment behind the IoT gateway; no east-west traffic inspection between device classes; vendor remote access portal has always-on connectivity.',
      targetState: 'Micro-segmented VLANs per device class (HVAC, fire safety, access control, energy); east-west traffic inspection on IoT gateway; just-in-time vendor access replacing always-on TeamViewer.',
      startDate: '2025-07-01', targetDate: '2026-09-30', completedDate: '',
      milestones: [
        { id: 'viot-ms-seg-01', title: 'Design per-device-class VLAN segmentation architecture', description: 'Create network architecture for micro-segmented VLANs separating HVAC, fire safety, access control, and energy monitoring device classes.', status: 'completed' as const, dueDate: '2025-10-31', completedDate: '2025-10-25', owner: 'Network Operations' },
        { id: 'viot-ms-seg-02', title: 'Deploy micro-segmentation on IoT gateway', description: 'Implement VLAN segmentation and east-west traffic inspection rules on the Cisco IR1101 IoT gateway.', status: 'in_progress' as const, dueDate: '2026-06-30', completedDate: '', owner: 'Network Operations' },
      ],
      linkedRiskIds: ['risk-iot-gateway-pivot', 'risk-vendor-backdoor', 'risk-modbus-injection'],
      linkedControlSetIds: [],
      linkedAssetIds: ['asset-iot-gateway', 'asset-vendor-portal', 'asset-energy-monitor'],
      linkedImplementedControlIds: ['viot-ic-armis-monitor'],
      linkedAssessmentIds: ['assessment-iot-security-review'],
      notes: 'Architecture design approved by Building Security Committee. Implementation requires maintenance window coordination with Facilities Engineering.',
      createdAt: NOW, updatedAt: NOW,
    },
  ],
  implementedControls: [
    {
      id: 'viot-ic-armis-monitor', title: 'Armis IoT Security Monitoring Platform',
      description: 'Armis agentless IoT security platform providing continuous device discovery, behavioral anomaly detection, and risk scoring across all building automation devices in the OT, DMZ, and Critical zones.',
      controlType: 'technical' as const, category: 'monitoring' as const,
      status: 'active' as const, automationLevel: 'fully_automated' as const,
      owner: 'IoT Security Specialist', vendor: 'Armis', product: 'Armis Platform', version: '2024.3',
      implementedDate: '2024-06-15', lastReviewDate: '2025-05-01', nextReviewDate: '2026-05-01',
      linkedSoaEntryIds: ['soa-iot-a09', 'soa-iot-cis01'],
      linkedRiskIds: ['risk-iot-gateway-pivot', 'risk-hvac-default-creds', 'risk-smart-lock-replay'],
      linkedAssetIds: ['asset-iot-gateway', 'asset-hvac-controller', 'asset-smart-lock'],
      linkedAssessmentIds: ['assessment-iot-security-review'],
      notes: 'Agentless deployment monitoring 1,200+ IoT devices. Behavioral baselines established for HVAC, access control, and energy monitoring device classes.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'viot-ic-ot-firewall', title: 'Fortinet OT Zone Firewall with DPI',
      description: 'Fortinet FortiGate rugged series firewall providing deep packet inspection for BACnet, Modbus TCP, and other OT protocols between IoT zones and the DMZ.',
      controlType: 'technical' as const, category: 'network_security' as const,
      status: 'active' as const, automationLevel: 'semi_automated' as const,
      owner: 'Network Operations', vendor: 'Fortinet', product: 'FortiGate Rugged 60F', version: '7.4.2',
      implementedDate: '2024-01-10', lastReviewDate: '2025-04-15', nextReviewDate: '2026-04-15',
      linkedSoaEntryIds: ['soa-iot-a02', 'soa-iot-a04'],
      linkedRiskIds: ['risk-unenc-bacnet', 'risk-modbus-injection', 'risk-iot-gateway-pivot'],
      linkedAssetIds: ['asset-iot-gateway', 'asset-hvac-controller', 'asset-energy-monitor'],
      linkedAssessmentIds: ['assessment-iot-security-review'],
      notes: 'OT protocol DPI enabled for BACnet/IP and Modbus TCP. IPS signatures updated weekly. SSL inspection not enabled for OT protocols due to performance constraints.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'viot-ic-physical-access', title: 'HID VertX Physical Access Control System',
      description: 'HID Global VertX V1000 physical access control managing door locks, card readers, and visitor management across the building with Wiegand protocol integration.',
      controlType: 'physical' as const, category: 'physical_security' as const,
      status: 'active' as const, automationLevel: 'semi_automated' as const,
      owner: 'Physical Security', vendor: 'HID Global', product: 'VertX V1000', version: '4.2',
      implementedDate: '2023-03-01', lastReviewDate: '2025-06-01', nextReviewDate: '2026-06-01',
      linkedSoaEntryIds: ['soa-iot-a01', 'soa-iot-a07'],
      linkedRiskIds: ['risk-smart-lock-replay', 'risk-hvac-default-creds'],
      linkedAssetIds: ['asset-access-controller', 'asset-smart-lock'],
      linkedAssessmentIds: ['assessment-iot-security-review'],
      notes: 'Wiegand protocol lacks encryption. Upgrade to OSDP v2 with AES-128 planned for Q3 2026. Smart lock integration adds WiFi-based attack surface.',
      createdAt: NOW, updatedAt: NOW,
    },
  ],
});

export const vulnerableIoT: ExampleSystem = {
  id: 'vulnerable-iot',
  name: 'Smart Building IoT Ecosystem',
  description: 'Comprehensive smart building with IoT devices, safety systems, guest access, and cloud integration',
  category: 'IoT Systems',
  // securityLevel removed - no longer part of the system model
  primaryZone: 'OT',
  dataClassification: 'Internal',
  grcWorkspace: vulnerableIoTGrcWorkspace,
  nodes: [
    // Multi-tier IoT Architecture with Critical Safety Systems and Guest Access
    // Main Flow: OT → DMZ → Internal → Cloud (horizontal)
    // Critical Zone: Above main flow for safety-critical systems (spans OT+DMZ width)
    // Guest Zone: Below main flow for visitor access (spans Internal+Cloud width)
    //
    // Zone widths by node density:
    //   OT: 7 nodes → 900px,  x=50
    //   DMZ: 5 nodes → 750px, x=50+900+120=1070
    //   Internal: 4 nodes → 700px, x=1070+750+120=1940
    //   Cloud: 3 nodes → 600px, x=1940+700+120=2760
    //   Critical: 4 nodes, spans OT+DMZ = 900+120+750 = 1770px, x=50
    //   Guest: 4 nodes, spans Internal+Cloud = 700+120+600 = 1420px, x=1940

    // Critical Zone - Safety-Critical Systems (Top Layer)
    {
      id: 'critical-zone',
      type: 'securityZone',
      position: { x: 50, y: 50 },
      data: {
        label: 'Critical Zone',
        zoneType: 'Critical' as SecurityZone,
        description: 'Safety-critical systems - fire, security, emergency',
        zone: 'Critical' as SecurityZone
      },
      style: {
        width: 1770,
        height: 300,
        background: colors.zoneBackgrounds.Critical,
        zIndex: -1
      }
    } as SecurityNode,

    // Main Operational Flow (Middle Layer)
    {
      id: 'ot-zone',
      type: 'securityZone',
      position: { x: 50, y: 400 },
      data: {
        label: 'OT Zone',
        zoneType: 'OT' as SecurityZone,
        description: 'Operational Technology - IoT devices and sensors'
      },
      style: {
        width: 900,
        height: 800,
        background: colors.zoneBackgrounds.OT,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'dmz-zone',
      type: 'securityZone',
      position: { x: 1070, y: 400 },
      data: {
        label: 'DMZ Zone',
        zoneType: 'DMZ' as SecurityZone,
        description: 'Building management and gateway systems'
      },
      style: {
        width: 750,
        height: 800,
        background: colors.zoneBackgrounds.DMZ,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'internal-zone',
      type: 'securityZone',
      position: { x: 1840, y: 400 },
      data: {
        label: 'Internal Zone',
        zoneType: 'Internal' as SecurityZone,
        description: 'Corporate network and management systems'
      },
      style: {
        width: 700,
        height: 800,
        background: colors.zoneBackgrounds.Internal,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'cloud-zone',
      type: 'securityZone',
      position: { x: 2660, y: 400 },
      data: {
        label: 'Cloud Zone',
        zoneType: 'Cloud' as SecurityZone,
        description: 'External cloud services and mobile access'
      },
      style: {
        width: 600,
        height: 800,
        background: colors.zoneBackgrounds.Cloud,
        zIndex: -1
      }
    } as SecurityNode,

    // Guest Zone - Visitor Access (Bottom Layer)
    {
      id: 'guest-zone',
      type: 'securityZone',
      position: { x: 850, y: 1250 },
      data: {
        label: 'Guest Zone',
        zoneType: 'Guest' as SecurityZone,
        description: 'Visitor access and public services'
      },
      style: {
        width: 1420,
        height: 300,
        background: colors.zoneBackgrounds.Guest,
        zIndex: -1
      }
    } as SecurityNode,

    // Critical Zone - Safety-Critical Systems
    // Nodes distributed across the 1770px span (x=50 to x=1820)
    {
      id: 'fire-alarm-panel',
      type: 'plc',
      position: { x: 125, y: 125 },
      data: {
        label: 'Fire Alarm Control Panel',
        description: 'Honeywell NOTIFIER NFS2-3030 Fire Alarm System',
        vendor: 'honeywell',
        product: 'notifier nfs2-3030',
        version: '6.2.1',
        protocols: ['RS-485', 'Ethernet'],
        securityControls: ['Physical Key Lock', 'Event Logging'],
        accessControl: 'Technician Key Card',
        zone: 'Critical' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      }
    } as SecurityNode,
    {
      id: 'emergency-lighting',
      type: 'sensor',
      position: { x: 525, y: 125 },
      data: {
        label: 'Emergency Lighting Controller',
        description: 'Philips Bodine Emergency Lighting Control System',
        vendor: 'philips',
        product: 'bodine emergency controller',
        version: '4.1.0',
        protocols: ['DMX512', 'Ethernet'],
        securityControls: ['Basic Authentication'],
        accessControl: 'Web Interface Login',
        zone: 'Critical' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'security-camera-nvr',
      type: 'server',
      position: { x: 925, y: 125 },
      data: {
        label: 'Security Camera NVR',
        description: 'Hikvision DS-7732NI-I4 Network Video Recorder',
        vendor: 'hikvision',
        product: 'ds-7732ni-i4',
        version: '4.61.025',
        protocols: ['RTSP', 'HTTP', 'ONVIF'],
        securityControls: ['User Authentication', 'HTTPS'],
        accessControl: 'Admin Password',
        zone: 'Critical' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      }
    } as SecurityNode,
    {
      id: 'mass-notification',
      type: 'application',
      position: { x: 1425, y: 125 },
      data: {
        label: 'Mass Notification System',
        description: 'AtlasIED IPX Series IP-Based Mass Notification',
        vendor: 'atlasied',
        product: 'ipx mass notification',
        version: '2.8.3',
        protocols: ['SIP', 'HTTP', 'SNMP'],
        securityControls: ['TLS Encryption', 'User Authentication'],
        accessControl: 'Emergency Coordinator Access',
        zone: 'Critical' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      }
    } as SecurityNode,

    // OT Zone - IoT Devices and Sensors (zone x=50)
    {
      id: 'temp-sensor-1',
      type: 'sensor',
      position: { x: 125, y: 575 },
      data: {
        label: 'Temperature Sensor',
        description: 'Honeywell T6 Pro Smart Thermostat with temperature monitoring',
        vendor: 'honeywell',
        product: 't6 pro thermostat',
        version: '2.1.4',
        protocols: ['WiFi', 'Zigbee'],
        securityControls: ['WPA2'],
        accessControl: 'Device PIN',
        zone: 'OT' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public'
      }
    } as SecurityNode,
    {
      id: 'motion-sensor-1',
      type: 'sensor',
      position: { x: 375, y: 475 },
      data: {
        label: 'Motion Sensor',
        description: 'Philips Hue Motion Sensor for occupancy detection',
        vendor: 'philips',
        product: 'hue motion sensor',
        version: '1.8.2',
        protocols: ['Zigbee 3.0'],
        securityControls: ['Device Pairing'],
        accessControl: 'Hub Authentication',
        zone: 'OT' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public'
      }
    } as SecurityNode,
    {
      id: 'smart-lock-1',
      type: 'sensor',
      position: { x: 675, y: 475 },
      data: {
        label: 'Smart Door Lock',
        description: 'August Smart Lock Pro with WiFi connectivity',
        vendor: 'august',
        product: 'smart lock pro',
        version: '3.2.1',
        protocols: ['WiFi', 'Bluetooth'],
        securityControls: ['AES-128'],
        accessControl: 'Mobile App PIN',
        zone: 'OT' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'hvac-controller',
      type: 'plc',
      position: { x: 75, y: 825 },
      data: {
        label: 'HVAC Controller',
        description: 'Johnson Controls Metasys Building Automation System',
        vendor: 'johnson controls',
        product: 'metasys',
        version: '12.0.2',
        protocols: ['BACnet/IP', 'Modbus TCP'],
        securityControls: ['Basic Authentication'],
        accessControl: 'Default Credentials',
        zone: 'OT' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'lighting-controller',
      type: 'plc',
      position: { x: 125, y: 1075 },
      data: {
        label: 'Lighting Controller',
        description: 'Lutron Quantum Total Light Management System',
        vendor: 'lutron',
        product: 'quantum system',
        version: '4.5.1',
        protocols: ['Ethernet/IP', 'DMX512'],
        securityControls: ['Basic Authentication'],
        accessControl: 'Web Interface',
        zone: 'OT' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'access-controller',
      type: 'plc',
      position: { x: 625, y: 775 },
      data: {
        label: 'Access Control Panel',
        description: 'HID VertX V1000 Access Control System',
        vendor: 'hid global',
        product: 'vertx v1000',
        version: '2.8.3',
        protocols: ['TCP/IP', 'Wiegand'],
        securityControls: ['SSL/TLS'],
        accessControl: 'Card Reader Authentication',
        zone: 'OT' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      }
    } as SecurityNode,
    {
      id: 'iot-gateway',
      type: 'gateway',
      position: { x: 425, y: 925 },
      data: {
        label: 'IoT Gateway',
        description: 'Cisco IR1101 Industrial IoT Gateway',
        vendor: 'cisco',
        product: 'ir1101',
        version: '17.06.04',
        protocols: ['Ethernet', 'WiFi', 'Cellular', 'VPN'],
        securityControls: ['Firewall', 'VPN', 'SSH'],
        accessControl: 'SSH Key Authentication',
        zone: 'OT' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,

    // DMZ Zone - Building Management Systems (zone x=1070)
    {
      id: 'building-hub',
      type: 'server',
      position: { x: 1225, y: 525 },
      data: {
        label: 'Building Management Server',
        description: 'Siemens Desigo CC Building Management System',
        vendor: 'siemens',
        product: 'desigo cc',
        version: '5.1.2',
        protocols: ['HTTP/HTTPS', 'BACnet/IP'],
        securityControls: ['Basic Authentication', 'SSL/TLS'],
        accessControl: 'Username/Password',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'dmz-firewall',
      type: 'firewall',
      position: { x: 1175, y: 725 },
      data: {
        label: 'DMZ Firewall',
        description: 'Fortinet FortiGate 60F Next-Generation Firewall',
        vendor: 'fortinet',
        product: 'fortigate 60f',
        version: '7.2.4',
        protocols: ['TCP/IP', 'UDP'],
        securityControls: ['Stateful Inspection', 'IPS', 'Application Control'],
        accessControl: 'Admin Console',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'energy-monitor',
      type: 'server',
      position: { x: 1475, y: 575 },
      data: {
        label: 'Energy Monitoring System',
        description: 'Schneider Electric PowerLogic ION Enterprise',
        vendor: 'schneider electric',
        product: 'powerlogic ion',
        version: '7.8.1',
        protocols: ['Modbus TCP', 'SNMP'],
        securityControls: ['Basic Authentication'],
        accessControl: 'Web Interface Login',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'iot-security-monitor',
      type: 'monitor',
      position: { x: 1175, y: 1125 },
      data: {
        label: 'IoT Security Monitor',
        description: 'Specialized IoT device monitoring and anomaly detection',
        vendor: 'armis',
        product: 'armis platform',
        version: '4.1.2',
        protocols: ['SPAN', 'NetFlow', 'SNMP'],
        securityControls: ['Device Discovery', 'Behavioral Analysis', 'Threat Detection'],
        accessControl: 'RBAC',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'network-firewall',
      type: 'firewall',
      position: { x: 1625, y: 1025 },
      data: {
        label: 'IoT Network Firewall',
        description: 'Dedicated firewall for IoT device traffic filtering',
        vendor: 'fortinet',
        product: 'fortigate 200f',
        version: '7.2.4',
        protocols: ['TCP', 'UDP', 'ICMP'],
        securityControls: ['Deep Packet Inspection', 'Application Control', 'IPS'],
        accessControl: 'Administrative Access',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,

    // Internal Zone - Corporate Network (zone x=1940)
    {
      id: 'management-workstation',
      type: 'workstation',
      position: { x: 2175, y: 525 },
      data: {
        label: 'Facility Management PC',
        description: 'Dell OptiPlex 7090 for facility management staff',
        vendor: 'dell',
        product: 'optiplex 7090',
        version: 'Windows 11 Pro',
        protocols: ['Ethernet', 'WiFi'],
        securityControls: ['Windows Defender', 'BitLocker'],
        accessControl: 'Domain Authentication',
        zone: 'Critical' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'domain-controller',
      type: 'server',
      position: { x: 1975, y: 675 },
      data: {
        label: 'Domain Controller',
        description: 'Windows Server 2022 Active Directory Domain Controller',
        vendor: 'microsoft',
        product: 'windows server 2022',
        version: '21H2',
        protocols: ['LDAP', 'Kerberos', 'DNS'],
        securityControls: ['Group Policy', 'Certificate Services'],
        accessControl: 'Administrator Account',
        zone: 'Critical' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      }
    } as SecurityNode,
    {
      id: 'internal-firewall',
      type: 'firewall',
      position: { x: 2525, y: 725 },
      data: {
        label: 'Internal Firewall',
        description: 'Palo Alto Networks PA-220 Next-Generation Firewall',
        vendor: 'palo alto networks',
        product: 'pa-220',
        version: '10.2.4',
        protocols: ['TCP/IP', 'UDP'],
        securityControls: ['Deep Packet Inspection', 'Threat Prevention'],
        accessControl: 'Admin Console',
        zone: 'Critical' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'file-server',
      type: 'server',
      position: { x: 1975, y: 825 },
      data: {
        label: 'File Server',
        description: 'Synology DS920+ NAS for building documentation',
        vendor: 'synology',
        product: 'diskstation ds920+',
        version: 'DSM 7.2',
        protocols: ['SMB/CIFS', 'FTP', 'HTTP/HTTPS'],
        securityControls: ['User Authentication', 'SSL/TLS'],
        accessControl: 'Local User Accounts',
        zone: 'Critical' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'patch-management',
      type: 'service',
      position: { x: 2325, y: 925 },
      data: {
        label: 'IoT Patch Management',
        description: 'Centralized firmware and software update management',
        vendor: 'microsoft',
        product: 'wsus',
        version: '2022',
        protocols: ['HTTPS', 'WMI'],
        securityControls: ['Automated Updates', 'Testing Pipeline', 'Rollback Capability'],
        accessControl: 'Domain Authentication',
        zone: 'Critical' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,

    // Cloud Zone - External Services (zone x=2760)
    {
      id: 'iot-cloud-platform',
      type: 'server',
      position: { x: 3225, y: 525 },
      data: {
        label: 'IoT Cloud Platform',
        description: 'AWS IoT Core for device management and analytics',
        vendor: 'amazon',
        product: 'aws iot core',
        version: '2024.1',
        protocols: ['MQTT', 'HTTPS', 'WebSocket'],
        securityControls: ['X.509 Certificates', 'IAM Policies'],
        accessControl: 'API Keys',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'mobile-app',
      type: 'application',
      position: { x: 2775, y: 475 },
      data: {
        label: 'Building Management App',
        description: 'iOS/Android mobile application for remote monitoring',
        vendor: 'custom development',
        product: 'building manager app',
        version: '2.4.1',
        protocols: ['HTTPS', 'WebSocket'],
        securityControls: ['OAuth 2.0', 'SSL Pinning'],
        accessControl: 'Username/Password + MFA',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'vendor-portal',
      type: 'application',
      position: { x: 3025, y: 1025 },
      data: {
        label: 'Vendor Support Portal',
        description: 'Third-party vendor remote access portal',
        vendor: 'teamviewer',
        product: 'teamviewer business',
        version: '15.42.8',
        protocols: ['HTTPS', 'TCP'],
        securityControls: ['Two-Factor Authentication'],
        accessControl: 'Vendor Credentials',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      }
    } as SecurityNode,

    // Guest Zone - Visitor Access and Public Services (zone x=1940)
    {
      id: 'guest-wifi-portal',
      type: 'application',
      position: { x: 1125, y: 1325 },
      data: {
        label: 'Guest WiFi Portal',
        description: 'Captive portal for visitor internet access',
        vendor: 'cisco',
        product: 'identity services engine',
        version: '3.2.1',
        protocols: ['HTTPS', 'RADIUS'],
        securityControls: ['Captive Portal', 'Time-based Access'],
        accessControl: 'Guest Registration',
        zone: 'Guest' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public'
      }
    } as SecurityNode,
    {
      id: 'visitor-kiosk',
      type: 'workstation',
      position: { x: 1475, y: 1325 },
      data: {
        label: 'Visitor Information Kiosk',
        description: 'Public kiosk for building directory and information',
        vendor: 'dell',
        product: 'optiplex 3090',
        version: 'Windows 11 IoT Enterprise',
        protocols: ['Ethernet', 'USB'],
        securityControls: ['Kiosk Mode', 'Application Whitelisting'],
        accessControl: 'Public Access',
        zone: 'Guest' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public'
      }
    } as SecurityNode,
    {
      id: 'digital-signage',
      type: 'application',
      position: { x: 1875, y: 1325 },
      data: {
        label: 'Digital Signage System',
        description: 'Building wayfinding and announcement displays',
        vendor: 'samsung',
        product: 'magicinfo premium',
        version: '8.0.3',
        protocols: ['HTTP/HTTPS', 'HDMI'],
        securityControls: ['Content Filtering', 'Remote Management'],
        accessControl: 'Content Manager Access',
        zone: 'Guest' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public'
      }
    } as SecurityNode,
    {
      id: 'mobile-device-charging',
      type: 'sensor',
      position: { x: 2375, y: 1325 },
      data: {
        label: 'Smart Charging Stations',
        description: 'Public mobile device charging with usage monitoring',
        vendor: 'chargepoint',
        product: 'ct4000 series',
        version: '2.8.1',
        protocols: ['Ethernet', 'WiFi', 'USB'],
        securityControls: ['Usage Monitoring', 'Data Isolation'],
        accessControl: 'Public Access',
        zone: 'Guest' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public'
      }
    } as SecurityNode
  ],
  edges: [
    // Critical Zone Connections
    {
      id: 'e-fire-alarm-emergency-lighting',
      source: 'fire-alarm-panel',
      target: 'emergency-lighting',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Emergency Control',
        protocol: 'RS-485',
        encryption: 'None',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Critical' as SecurityZone,
        vulnerabilities: ['Unencrypted control signals']
      }
    } as SecurityEdge,
    {
      id: 'e-security-nvr-mass-notification',
      source: 'security-camera-nvr',
      target: 'mass-notification',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Security Alert',
        protocol: 'HTTP/HTTPS',
        encryption: 'TLS 1.2',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Critical' as SecurityZone,
        vulnerabilities: ['Potential certificate validation bypass']
      }
    } as SecurityEdge,

    // OT Zone Internal Connections
    {
      id: 'e-temp-sensor-gateway',
      source: 'temp-sensor-1',
      target: 'iot-gateway',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Temperature Data',
        protocol: 'WiFi/Zigbee',
        encryption: 'WPA2',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        zone: 'OT' as SecurityZone,
        vulnerabilities: ['Weak encryption', 'Default device credentials']
      }
    } as SecurityEdge,
    {
      id: 'e-motion-sensor-gateway',
      source: 'motion-sensor-1',
      target: 'iot-gateway',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Occupancy Data',
        protocol: 'Zigbee 3.0',
        encryption: 'AES-128',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        zone: 'OT' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e-smart-lock-gateway',
      source: 'smart-lock-1',
      target: 'iot-gateway',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Access Events',
        protocol: 'WiFi',
        encryption: 'WPA2',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'OT' as SecurityZone,
        vulnerabilities: ['Unencrypted local traffic']
      }
    } as SecurityEdge,
    {
      id: 'e-hvac-gateway',
      source: 'hvac-controller',
      target: 'iot-gateway',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'HVAC Control Data',
        protocol: 'BACnet/IP',
        encryption: 'None',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'OT' as SecurityZone,
        vulnerabilities: ['Unencrypted BACnet traffic', 'Default credentials']
      }
    } as SecurityEdge,
    {
      id: 'e-lighting-gateway',
      source: 'lighting-controller',
      target: 'iot-gateway',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Lighting Control',
        protocol: 'Ethernet/IP',
        encryption: 'None',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'OT' as SecurityZone,
        vulnerabilities: ['Plain text communication']
      }
    } as SecurityEdge,
    {
      id: 'e-access-gateway',
      source: 'access-controller',
      target: 'iot-gateway',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Access Control Data',
        protocol: 'TCP/IP',
        encryption: 'SSL/TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'OT' as SecurityZone
      }
    } as SecurityEdge,

    // OT to DMZ Zone Connections
    {
      id: 'e-gateway-building-hub',
      source: 'iot-gateway',
      target: 'building-hub',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Aggregated IoT Data',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'OT' as SecurityZone,
        vulnerabilities: ['Weak TLS configuration']
      }
    } as SecurityEdge,
    {
      id: 'e-gateway-energy-monitor',
      source: 'iot-gateway',
      target: 'energy-monitor',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Energy Usage Data',
        protocol: 'Modbus TCP',
        encryption: 'None',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'OT' as SecurityZone,
        vulnerabilities: ['Unencrypted Modbus traffic']
      }
    } as SecurityEdge,

    // DMZ Zone Internal Connections
    {
      id: 'e-building-hub-dmz-firewall',
      source: 'building-hub',
      target: 'dmz-firewall',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Management Traffic',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e-energy-monitor-dmz-firewall',
      source: 'energy-monitor',
      target: 'dmz-firewall',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Energy Reports',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,

    // DMZ to Internal Zone Connections
    {
      id: 'e-dmz-firewall-management-workstation',
      source: 'dmz-firewall',
      target: 'management-workstation',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Building Management Access',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e-dmz-firewall-file-server',
      source: 'dmz-firewall',
      target: 'file-server',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Data Backup',
        protocol: 'SMB/CIFS',
        encryption: 'SMB3 Encryption',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,

    // Internal Zone Connections
    {
      id: 'e-management-workstation-domain-controller',
      source: 'management-workstation',
      target: 'domain-controller',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Domain Authentication',
        protocol: 'Kerberos/LDAP',
        encryption: 'Kerberos Encryption',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e-management-workstation-file-server',
      source: 'management-workstation',
      target: 'file-server',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'File Access',
        protocol: 'SMB/CIFS',
        encryption: 'SMB3 Encryption',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,

    // Guest Zone Connections
    {
      id: 'e-guest-wifi-visitor-kiosk',
      source: 'guest-wifi-portal',
      target: 'visitor-kiosk',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Network Access',
        protocol: 'Ethernet',
        encryption: 'None',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        zone: 'Guest' as SecurityZone,
        vulnerabilities: ['Unencrypted local traffic']
      }
    } as SecurityEdge,
    {
      id: 'e-visitor-kiosk-digital-signage',
      source: 'visitor-kiosk',
      target: 'digital-signage',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Content Updates',
        protocol: 'HTTP/HTTPS',
        encryption: 'TLS 1.2',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        zone: 'Guest' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e-digital-signage-charging-stations',
      source: 'digital-signage',
      target: 'mobile-device-charging',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Usage Monitoring',
        protocol: 'WiFi',
        encryption: 'WPA2',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        zone: 'Guest' as SecurityZone
      }
    } as SecurityEdge,

    // Internal to Cloud Zone Connections
    {
      id: 'e-internal-firewall-iot-cloud',
      source: 'internal-firewall',
      target: 'iot-cloud-platform',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Cloud Data Sync',
        protocol: 'HTTPS/MQTT',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e-internal-firewall-vendor-portal',
      source: 'internal-firewall',
      target: 'vendor-portal',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Remote Support Access',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Cloud' as SecurityZone,
        vulnerabilities: ['Third-party access', 'Potential backdoor']
      }
    } as SecurityEdge,

    // Cloud Zone Connections
    {
      id: 'e-iot-cloud-mobile-app',
      source: 'iot-cloud-platform',
      target: 'mobile-app',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Mobile API Access',
        protocol: 'HTTPS/WebSocket',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e-mobile-app-building-hub',
      source: 'mobile-app',
      target: 'building-hub',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'top',
      data: {
        label: 'Remote Control Commands',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone,
        vulnerabilities: ['Mobile device compromise risk']
      }
    } as SecurityEdge,

    // Enhanced security monitoring connections
    {
      id: 'e-iot-gateway-security-monitor',
      source: 'iot-gateway',
      target: 'iot-security-monitor',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'bottom',
      data: {
        label: 'Device Traffic Analysis',
        protocol: 'SPAN/Mirror Port',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'OT' as SecurityZone,
        controlPoints: [{ id: 'iot-mon-cp1', x: 650, y: 1150, active: true }]
      }
    } as SecurityEdge,
    {
      id: 'e-network-firewall-security-monitor',
      source: 'network-firewall',
      target: 'iot-security-monitor',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Security Logs',
        protocol: 'Syslog/TLS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e-patch-mgmt-iot-gateway',
      source: 'patch-management',
      target: 'iot-gateway',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Firmware Updates',
        protocol: 'HTTPS/SFTP',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'OT' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e-network-firewall-dmz-firewall',
      source: 'network-firewall',
      target: 'dmz-firewall',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        controlPoints: [
          { id: 'cp-1771640688341', x: 1750, y: 1000, active: true },
          { id: 'cp-1771640847129', x: 1300, y: 1000, active: true }
        ],
        label: 'Filtered IoT Traffic',
        protocol: 'TCP/UDP',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge
  ],
  customContext: `# Smart Building IoT Ecosystem

## System Overview
Comprehensive smart building IoT ecosystem managing HVAC, lighting, access control, energy monitoring, safety systems, and guest services across a 20-story commercial office building. The system integrates over 1,200 IoT devices serving 1,500 occupants with 24/7 operations, featuring multi-tier security architecture with proper zone segmentation including safety-critical systems and guest access areas.

## Multi-Tier Security Architecture

### Critical Zone (Safety-Critical Systems)
**Life Safety and Security Infrastructure:**
- Honeywell NOTIFIER Fire Alarm Control Panel
  - RS-485 communication (unencrypted vulnerability)
  - Emergency response automation
  - Integration with building evacuation systems
- Philips Bodine Emergency Lighting Controller
  - Automated emergency lighting activation
  - Battery backup monitoring
  - Fire alarm integration
- Hikvision Security Camera NVR
  - 64-channel network video recording
  - Motion detection and analytics
  - HTTPS/TLS 1.2 encryption
- AtlasIED Mass Notification System
  - Emergency announcement capabilities
  - Integration with fire alarm and security systems
  - Audio/visual alert coordination

### OT Zone (Operational Technology)
**IoT Sensors and Devices:**
- Honeywell T6 Pro Smart Thermostats
  - WiFi and Zigbee connectivity
  - WPA2 encryption (vulnerable to weak passwords)
  - Default device PIN authentication
  - Temperature and humidity monitoring
- Philips Hue Motion Sensors
  - Zigbee 3.0 protocol with AES-128 encryption
  - Hub-based authentication
  - Occupancy detection and lighting automation
- August Smart Lock Pro
  - WiFi and Bluetooth connectivity
  - AES-128 encryption for access events
  - Mobile app PIN authentication
  - Integration with building access control

**Building Control Systems:**
- Johnson Controls Metasys HVAC Controller
  - BACnet/IP protocol (unencrypted)
  - Default vendor credentials (vulnerability)
  - Controls heating, ventilation, and air conditioning
  - Firmware version 12.0.2 from 2021
- Lutron Quantum Lighting Controller
  - Ethernet/IP protocol (plain text communication)
  - Web interface authentication
  - DMX512 for lighting control
  - Centralized lighting management
- HID VertX V1000 Access Control Panel
  - TCP/IP with SSL/TLS encryption
  - Card reader authentication (Wiegand protocol)
  - Confidential access credential database
  - Integration with corporate security systems

**Network Infrastructure:**
- Cisco IR1101 Industrial IoT Gateway
  - Multi-protocol support (Ethernet, WiFi, Cellular)
  - VPN and firewall capabilities
  - SSH key authentication
  - Aggregates all OT zone traffic

### DMZ Zone (Building Management)
**Management Systems:**
- Siemens Desigo CC Building Management Server
  - HTTP/HTTPS and BACnet/IP protocols
  - Basic authentication with SSL/TLS
  - Central building automation control
  - Web-based management interface
- Schneider Electric PowerLogic ION Energy Monitor
  - Modbus TCP protocol (unencrypted vulnerability)
  - Web interface login authentication
  - Real-time energy usage monitoring
  - Integration with utility billing systems

**Security Infrastructure:**
- Fortinet FortiGate 60F Next-Generation Firewall
  - Stateful inspection and IPS capabilities
  - Application control and threat prevention
  - Admin console access control
  - Traffic filtering between zones

### Internal Zone (Corporate Network)
**Management Infrastructure:**
- Dell OptiPlex 7090 Facility Management Workstation
  - Windows 11 Pro with domain authentication
  - Windows Defender and BitLocker security
  - Ethernet and WiFi connectivity
  - Used by facility management staff
- Windows Server 2022 Active Directory Domain Controller
  - LDAP, Kerberos, and DNS protocols
  - Group Policy and Certificate Services
  - Administrator account management
  - Centralized authentication for all systems
- Synology DS920+ NAS File Server
  - SMB/CIFS, FTP, and HTTP/HTTPS protocols
  - SSL/TLS encryption and user authentication
  - Building documentation and backup storage
  - Local user account management

**Network Security:**
- Palo Alto Networks PA-220 Next-Generation Firewall
  - Deep packet inspection and threat prevention
  - Admin console access control
  - Traffic filtering to cloud services
  - Advanced security monitoring

### Cloud Zone (External Services)
**Cloud Platform:**
- AWS IoT Core Platform
  - MQTT, HTTPS, and WebSocket protocols
  - X.509 certificates and IAM policies
  - API key authentication
  - Device management and analytics
- Custom Building Management Mobile App
  - iOS/Android with HTTPS and WebSocket
  - OAuth 2.0 and SSL pinning security
  - Username/password with MFA
  - Remote monitoring and control capabilities
- TeamViewer Business Vendor Support Portal
  - HTTPS and TCP protocols
  - Two-factor authentication
  - Third-party vendor remote access
  - Potential security backdoor risk

### Guest Zone (Visitor Access and Public Services)
**Public Access Infrastructure:**
- Cisco Identity Services Engine Guest WiFi Portal
  - HTTPS and RADIUS protocols
  - Captive portal authentication
  - Time-based access controls
  - Guest registration and monitoring
- Dell OptiPlex 3090 Visitor Information Kiosk
  - Windows 11 IoT Enterprise in kiosk mode
  - Application whitelisting security
  - Public access for building directory
  - USB and Ethernet connectivity
- Samsung MagicInfo Digital Signage System
  - HTTP/HTTPS and HDMI protocols
  - Content filtering and remote management
  - Building wayfinding and announcements
  - Content manager access controls
- ChargePoint CT4000 Smart Charging Stations
  - Ethernet, WiFi, and USB connectivity
  - Usage monitoring and data isolation
  - Public mobile device charging
  - Network segmentation from corporate systems

## Security Vulnerabilities

### Critical Vulnerabilities
1. **Safety-Critical System Risks**
   - Fire alarm control panel using unencrypted RS-485 communication
   - Potential for false alarm generation or suppression
   - Emergency lighting controller vulnerable to tampering
   - Mass notification system integration points exposed

2. **Unencrypted OT Protocols**
   - BACnet/IP traffic in plain text
   - Modbus TCP without encryption
   - Ethernet/IP lighting control unencrypted

3. **Default Credentials**
   - HVAC controller using vendor defaults
   - IoT devices with weak PIN authentication
   - Potential for credential stuffing attacks

4. **Third-Party Access**
   - Vendor support portal with remote access
   - Potential backdoor through TeamViewer
   - Limited monitoring of vendor activities

5. **Guest Zone Security Gaps**
   - Unencrypted local traffic between guest systems
   - Public kiosk potential for malware introduction
   - Guest WiFi portal vulnerable to credential harvesting
   - Charging stations could be used for data exfiltration

6. **Mobile Device Risks**
   - Mobile app compromise could affect building systems
   - Stored credentials on mobile devices
   - Potential for man-in-the-middle attacks

### Network Segmentation Issues
- Weak TLS configuration between OT and DMZ zones
- Limited monitoring of cross-zone traffic
- Insufficient network access controls

## Operational Considerations
- Building operates 24/7 with critical life safety systems requiring maximum uptime
- Facility management team of 8 staff members managing expanded IoT ecosystem
- Monthly vendor maintenance with controlled remote access through DMZ
- System deployed in 2023 with modern IoT infrastructure and some legacy components
- Segregated network infrastructure with proper zone isolation
- Emergency support requires secure remote vendor access with monitoring
- Balance between operational efficiency, cost reduction, and security requirements
- Enhanced cybersecurity budget with dedicated IoT security specialist
- Strict compliance requirements for building safety codes and fire regulations
- Integration with corporate IT security policies and guest access management
- Public access areas require additional security monitoring and controls
- Safety-critical systems subject to regular security audits and penetration testing
- Guest services must maintain availability while ensuring network isolation
- IoT device lifecycle management including security patching and replacement`,
  attackPaths: [
    {
      id: 'ap-hvac-to-bms',
      name: 'HVAC Default Credentials → IoT Gateway → BMS Compromise',
      strideCategory: 'Elevation of Privilege',
      riskLevel: 'Critical',
      description: 'An attacker exploits default vendor credentials on the HVAC controller to gain BACnet/IP access, pivots through the IoT gateway via unencrypted traffic, and reaches the building management server to manipulate all building subsystems.',
      steps: [
        {
          order: 1,
          edgeId: 'e-hvac-gateway',
          sourceNodeId: 'hvac-controller',
          targetNodeId: 'iot-gateway',
          technique: 'T1078: Valid Accounts (Default Credentials)',
        },
        {
          order: 2,
          edgeId: 'e-gateway-building-hub',
          sourceNodeId: 'iot-gateway',
          targetNodeId: 'building-hub',
          technique: 'T1021: Remote Services',
        },
      ],
      mitreTechniques: ['T1078', 'T1021'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-fire-alarm-tamper',
      name: 'Fire Alarm RS-485 Bus Tampering → Emergency System Sabotage',
      strideCategory: 'Tampering',
      riskLevel: 'High',
      description: 'The fire alarm panel communicates with emergency lighting via unencrypted RS-485. An attacker with physical proximity to the bus can inject crafted frames to suppress genuine fire alarms or trigger false emergency lighting activation, endangering building occupants.',
      steps: [
        {
          order: 1,
          edgeId: 'e-fire-alarm-emergency-lighting',
          sourceNodeId: 'fire-alarm-panel',
          targetNodeId: 'emergency-lighting',
          technique: 'T1557: Adversary-in-the-Middle',
        },
      ],
      mitreTechniques: ['T1557'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-vendor-portal-to-bms',
      name: 'Vendor Portal Compromise → Internal Firewall → Cloud Pivot → BMS Takeover',
      strideCategory: 'Spoofing',
      riskLevel: 'Critical',
      description: 'An attacker compromises the TeamViewer vendor support portal through credential theft, traverses the internal firewall which allows vendor access, reaches the IoT cloud platform, then exploits the mobile app remote control channel to issue commands to the building management server.',
      steps: [
        {
          order: 1,
          edgeId: 'e-internal-firewall-vendor-portal',
          sourceNodeId: 'internal-firewall',
          targetNodeId: 'vendor-portal',
          technique: 'T1133: External Remote Services',
        },
        {
          order: 2,
          edgeId: 'e-internal-firewall-iot-cloud',
          sourceNodeId: 'internal-firewall',
          targetNodeId: 'iot-cloud-platform',
          technique: 'T1078: Valid Accounts',
        },
        {
          order: 3,
          edgeId: 'e-mobile-app-building-hub',
          sourceNodeId: 'mobile-app',
          targetNodeId: 'building-hub',
          technique: 'T1565: Data Manipulation',
        },
      ],
      mitreTechniques: ['T1133', 'T1078', 'T1565'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-iot-gateway-lateral',
      name: 'IoT Gateway Lateral Movement → Energy Monitor Data Manipulation',
      strideCategory: 'Information Disclosure',
      riskLevel: 'High',
      description: 'An attacker who compromises the IoT gateway (via a compromised OT sensor) exploits the unencrypted Modbus TCP link to the energy monitoring system to inject false readings or exfiltrate energy usage data, then pivots through the DMZ firewall toward internal network assets.',
      steps: [
        {
          order: 1,
          edgeId: 'e-gateway-energy-monitor',
          sourceNodeId: 'iot-gateway',
          targetNodeId: 'energy-monitor',
          technique: 'T1565: Data Manipulation',
        },
        {
          order: 2,
          edgeId: 'e-energy-monitor-dmz-firewall',
          sourceNodeId: 'energy-monitor',
          targetNodeId: 'dmz-firewall',
          technique: 'T1071: Application Layer Protocol',
        },
        {
          order: 3,
          edgeId: 'e-dmz-firewall-management-workstation',
          sourceNodeId: 'dmz-firewall',
          targetNodeId: 'management-workstation',
          technique: 'T1021: Remote Services',
        },
      ],
      mitreTechniques: ['T1565', 'T1071', 'T1021'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
  ],
};
