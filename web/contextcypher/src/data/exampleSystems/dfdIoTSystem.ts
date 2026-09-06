import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityNode, SecurityEdge, SecurityZone, DataClassification } from '../../types/SecurityTypes';
import { colors } from '../../styles/Theme';
import { DiagramAttackPath } from '../../types/GrcTypes';
import { buildGrcWorkspace, score, NOW, OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID } from './grcSharedBase';

export const dfdIoTSystem: ExampleSystem = {
  id: 'dfd-iot-system',
  name: 'DFD: Smart Home IoT System',
  description: 'DFD model for IoT ecosystem showing device communication, cloud services, and mobile control',
  category: 'DFD Threat Models',
  primaryZone: 'Internal',
  dataClassification: 'Sensitive',
  customContext: `
## DFD IoT Smart Home Threat Model

This represents a typical IoT smart home system using DFD notation for STRIDE threat modeling.

### System Overview
- Smart home devices communicate through a central hub
- Mobile apps control devices remotely via cloud services
- Local and cloud-based automation rules
- Third-party integrations for voice assistants

### Key Components
1. IoT Devices - Smart lights, thermostats, cameras, locks
2. IoT Hub - Local gateway for device communication
3. Cloud Services - Device management and remote access
4. Mobile Apps - User control interfaces
5. Third-party Services - Alexa, Google Home integration

### Data Flows
1. Device telemetry to cloud analytics
2. Remote control commands from mobile apps
3. Automation rules execution
4. Video streaming from cameras
5. Voice command processing

### Security Considerations
- Devices use WiFi with WPA2/WPA3
- Hub implements local firewall rules
- Cloud API uses OAuth 2.0
- End-to-end encryption for camera streams
- Regular firmware updates via secure channels
  `,
  nodes: [
    // Security Zones
    {
      id: 'external-zone',
      type: 'securityZone',
      position: { x: 50, y: 50 },
      data: {
        label: 'External Zone',
        zoneType: 'External',
        description: 'Internet and third-party services'
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
        zoneType: 'DMZ',
        description: 'Cloud services and APIs'
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
        label: 'Home Network',
        zoneType: 'Internal',
        description: 'Local home network with IoT devices'
      },
      style: {
        width: 900,
        height: 1000,
        background: colors.zoneBackgrounds.Internal,
        zIndex: -1
      }
    } as SecurityNode,

    // DFD Nodes - External Actors
    {
      id: 'homeowner',
      type: 'dfdActor',
      position: { x: 250, y: 250 },
      data: {
        label: 'Homeowner',
        actorType: 'Primary Home Owner',
        zone: 'External',
        description: 'Primary user with full control',
        protocols: ['HTTPS'],
        dataClassification: 'Public'
      }
    } as SecurityNode,
    {
      id: 'family-members',
      type: 'dfdActor',
      position: { x: 250, y: 400 },
      data: {
        label: 'Family Members',
        actorType: 'Family Members',
        zone: 'External',
        description: 'Secondary users with limited access',
        protocols: ['HTTPS'],
        dataClassification: 'Public'
      }
    } as SecurityNode,
    {
      id: 'voice-assistants',
      type: 'dfdActor',
      position: { x: 250, y: 550 },
      data: {
        label: 'Voice Assistants',
        actorType: 'Voice Assistant Integration',
        zone: 'External',
        description: 'Alexa, Google Assistant integration',
        protocols: ['HTTPS'],
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'maintenance',
      type: 'dfdActor',
      position: { x: 250, y: 700 },
      data: {
        label: 'Maintenance Service',
        actorType: 'Vendor Support Team',
        zone: 'External',
        description: 'IoT vendor support and updates',
        protocols: ['HTTPS'],
        dataClassification: 'Internal'
      }
    } as SecurityNode,

    // Trust Boundaries
    {
      id: 'internet-boundary',
      type: 'dfdTrustBoundary',
      position: { x: 670, y: 150 },
      data: {
        label: 'Internet Boundary',
        boundaryType: 'Cloud Service Edge',
        zone: 'DMZ',
        description: 'Boundary between internet and cloud services'
      }
    } as SecurityNode,
    {
      id: 'home-boundary',
      type: 'dfdTrustBoundary',
      position: { x: 1540, y: 150 },
      data: {
        label: 'Home Network Boundary',
        boundaryType: 'Home Network Firewall',
        zone: 'Internal',
        description: 'Router/firewall protecting home network'
      }
    } as SecurityNode,

    // DMZ Processes
    {
      id: 'cloud-api',
      type: 'dfdProcess',
      position: { x: 970, y: 350 },
      data: {
        label: 'IoT Cloud API',
        processType: 'IoT Cloud Management API',
        zone: 'DMZ',
        description: 'Cloud API for remote device management',
        technology: 'AWS IoT Core',
        protocols: ['HTTPS', 'MQTT'],
        securityControls: ['OAuth 2.0', 'Rate Limiting', 'API Keys'],
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'analytics-service',
      type: 'dfdProcess',
      position: { x: 970, y: 550 },
      data: {
        label: 'Analytics Service',
        processType: 'Device Analytics Engine',
        zone: 'DMZ',
        description: 'Process device telemetry and usage patterns',
        technology: 'Time Series Database',
        protocols: ['HTTPS'],
        securityControls: ['Data Aggregation', 'Anonymization'],
        dataClassification: 'Internal'
      }
    } as SecurityNode,

    // Internal Processes
    {
      id: 'iot-hub',
      type: 'dfdProcess',
      position: { x: 1840, y: 450 },
      data: {
        label: 'IoT Hub',
        processType: 'Smart Home Hub Controller',
        zone: 'Internal',
        description: 'Local gateway managing all IoT devices',
        technology: 'Home Assistant',
        protocols: ['MQTT', 'Zigbee', 'Z-Wave'],
        securityControls: ['Device Authentication', 'Local Firewall', 'Encryption'],
        dataClassification: 'Sensitive'
      }
    } as SecurityNode,
    {
      id: 'automation-engine',
      type: 'dfdProcess',
      position: { x: 2040, y: 350 },
      data: {
        label: 'Automation Engine',
        processType: 'Automation Rules Engine',
        zone: 'Internal',
        description: 'Local automation rules processing',
        technology: 'Node-RED',
        protocols: ['MQTT'],
        securityControls: ['Rule Validation', 'Sandboxing'],
        dataClassification: 'Internal'
      }
    } as SecurityNode,

    // IoT Devices as Actors (they're external to the hub)
    {
      id: 'smart-cameras',
      type: 'dfdActor',
      position: { x: 1840, y: 250 },
      data: {
        label: 'Smart Cameras',
        actorType: 'Security Camera System',
        zone: 'Internal',
        description: 'Security cameras with motion detection',
        protocols: ['RTSP', 'HTTPS'],
        dataClassification: 'Sensitive'
      }
    } as SecurityNode,
    {
      id: 'smart-locks',
      type: 'dfdActor',
      position: { x: 2040, y: 550 },
      data: {
        label: 'Smart Locks',
        actorType: 'Smart Door Locks',
        zone: 'Internal',
        description: 'Electronic door locks',
        protocols: ['Zigbee', 'Bluetooth'],
        dataClassification: 'Sensitive'
      }
    } as SecurityNode,
    {
      id: 'sensors',
      type: 'dfdActor',
      position: { x: 1840, y: 650 },
      data: {
        label: 'Sensors & Actuators',
        actorType: 'Environmental Sensors',
        zone: 'Internal',
        description: 'Temperature, motion, light sensors',
        protocols: ['Zigbee', 'Z-Wave'],
        dataClassification: 'Internal'
      }
    } as SecurityNode,

    // Data Stores
    {
      id: 'cloud-storage',
      type: 'dfdDataStore',
      position: { x: 1170, y: 750 },
      data: {
        label: 'Cloud Storage',
        storeType: 'Cloud Video Storage',
        zone: 'DMZ',
        description: 'Camera recordings and backups',
        technology: 'AWS S3',
        protocols: ['HTTPS'],
        securityControls: ['Encryption at Rest', 'Access Policies'],
        dataClassification: 'Sensitive'
      }
    } as SecurityNode,
    {
      id: 'device-config',
      type: 'dfdDataStore',
      position: { x: 2040, y: 750 },
      data: {
        label: 'Device Configuration',
        storeType: 'Local Configuration Database',
        zone: 'Internal',
        description: 'Local device settings and automation rules',
        technology: 'SQLite',
        protocols: ['Local Access'],
        securityControls: ['File Encryption', 'Access Control'],
        dataClassification: 'Sensitive'
      }
    } as SecurityNode,
    {
      id: 'telemetry-db',
      type: 'dfdDataStore',
      position: { x: 970, y: 750 },
      data: {
        label: 'Telemetry Database',
        storeType: 'Time-Series Telemetry Store',
        zone: 'DMZ',
        description: 'Time-series device metrics',
        technology: 'InfluxDB',
        protocols: ['HTTPS'],
        securityControls: ['Data Retention Policies', 'Aggregation'],
        dataClassification: 'Internal'
      }
    } as SecurityNode
  ],
  edges: [
    // User interactions
    {
      id: 'e1',
      source: 'homeowner',
      target: 'cloud-api',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Mobile App Control',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        securityLevel: 'High',
        dataClassification: 'Internal',
        zone: 'DMZ',
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e2',
      source: 'family-members',
      target: 'cloud-api',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Limited Access',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        securityLevel: 'Medium',
        dataClassification: 'Internal',
        zone: 'DMZ',
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e3',
      source: 'voice-assistants',
      target: 'cloud-api',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Voice Commands',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        securityLevel: 'Medium',
        dataClassification: 'Internal',
        zone: 'DMZ',
        animated: true
      }
    } as SecurityEdge,

    // Cloud to hub
    {
      id: 'e4',
      source: 'cloud-api',
      target: 'iot-hub',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Remote Commands',
        protocol: 'MQTT/TLS',
        encryption: 'TLS 1.2',
        securityLevel: 'High',
        dataClassification: 'Sensitive',
        zone: 'Internal',
        animated: true
      }
    } as SecurityEdge,

    // Hub to devices
    {
      id: 'e5',
      source: 'iot-hub',
      target: 'smart-cameras',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Camera Control',
        protocol: 'RTSP',
        encryption: 'Local Network',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Internal',
        animated: false
      }
    } as SecurityEdge,
    {
      id: 'e6',
      source: 'iot-hub',
      target: 'smart-locks',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Lock Control',
        protocol: 'Zigbee',
        encryption: 'AES-128',
        securityLevel: 'High',
        dataClassification: 'Sensitive',
        zone: 'Internal',
        animated: false
      }
    } as SecurityEdge,
    {
      id: 'e7',
      source: 'iot-hub',
      target: 'sensors',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Sensor Data',
        protocol: 'Z-Wave',
        encryption: 'AES-128',
        securityLevel: 'Medium',
        dataClassification: 'Internal',
        zone: 'Internal',
        animated: true
      }
    } as SecurityEdge,

    // Automation flows
    {
      id: 'e8',
      source: 'iot-hub',
      target: 'automation-engine',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Event Triggers',
        protocol: 'MQTT',
        encryption: 'Local',
        securityLevel: 'Medium',
        dataClassification: 'Internal',
        zone: 'Internal',
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e9',
      source: 'automation-engine',
      target: 'iot-hub',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Automation Commands',
        protocol: 'MQTT',
        encryption: 'Local',
        securityLevel: 'Medium',
        dataClassification: 'Internal',
        zone: 'Internal',
        animated: true
      }
    } as SecurityEdge,

    // Data flows
    {
      id: 'e10',
      source: 'iot-hub',
      target: 'analytics-service',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Telemetry Data',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Internal',
        zone: 'DMZ',
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e11',
      source: 'analytics-service',
      target: 'telemetry-db',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Store Metrics',
        protocol: 'HTTPS',
        encryption: 'TLS',
        securityLevel: 'Medium',
        dataClassification: 'Internal',
        zone: 'DMZ',
        animated: false
      }
    } as SecurityEdge,
    {
      id: 'e12',
      source: 'cloud-api',
      target: 'cloud-storage',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Camera Uploads',
        protocol: 'HTTPS',
        encryption: 'TLS',
        securityLevel: 'High',
        dataClassification: 'Sensitive',
        zone: 'DMZ',
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e13',
      source: 'iot-hub',
      target: 'device-config',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Config Storage',
        protocol: 'Local File',
        encryption: 'AES-256',
        securityLevel: 'High',
        dataClassification: 'Sensitive',
        zone: 'Internal',
        animated: false
      }
    } as SecurityEdge,

    // Maintenance
    {
      id: 'e14',
      source: 'maintenance',
      target: 'cloud-api',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Firmware Updates',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        securityLevel: 'Critical',
        dataClassification: 'Internal',
        zone: 'DMZ',
        animated: false
      }
    } as SecurityEdge
  ],
  attackPaths: [
    {
      id: 'ap-iot-cloud-to-lock',
      name: 'Voice Assistant → Cloud API → IoT Hub → Smart Lock Unlock',
      strideCategory: 'Spoofing',
      riskLevel: 'Critical',
      description: 'Attacker spoofs voice assistant commands through the cloud API to the IoT hub, sending unauthorized unlock commands to smart door locks via the Zigbee protocol.',
      steps: [
        { order: 1, edgeId: 'e3', sourceNodeId: 'voice-assistants', targetNodeId: 'cloud-api', technique: 'T1078: Valid Accounts (Hijacked Voice Profile)' },
        { order: 2, edgeId: 'e4', sourceNodeId: 'cloud-api', targetNodeId: 'iot-hub', technique: 'T1021: Remote Services' },
        { order: 3, edgeId: 'e6', sourceNodeId: 'iot-hub', targetNodeId: 'smart-locks', technique: 'T1565: Data Manipulation' },
      ],
      mitreTechniques: ['T1078', 'T1021', 'T1565'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-iot-firmware-poison',
      name: 'Malicious Firmware Update → Cloud API → IoT Hub → Device Compromise',
      strideCategory: 'Tampering',
      riskLevel: 'High',
      description: 'Attacker compromises the maintenance channel to push malicious firmware through the cloud API, which is distributed to all devices via the IoT hub.',
      steps: [
        { order: 1, edgeId: 'e14', sourceNodeId: 'maintenance', targetNodeId: 'cloud-api', technique: 'T1195: Supply Chain Compromise' },
        { order: 2, edgeId: 'e4', sourceNodeId: 'cloud-api', targetNodeId: 'iot-hub', technique: 'T1072: Software Deployment Tools' },
        { order: 3, edgeId: 'e5', sourceNodeId: 'iot-hub', targetNodeId: 'smart-cameras', technique: 'T1542: Pre-OS Boot (Firmware Corruption)' },
      ],
      mitreTechniques: ['T1195', 'T1072', 'T1542'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-iot-camera-exfil',
      name: 'Cloud API Compromise → Camera Streams → Cloud Storage Exfiltration',
      strideCategory: 'Information Disclosure',
      riskLevel: 'High',
      description: 'Attacker gains access to the cloud API and retrieves camera recordings from cloud storage, exposing private home surveillance footage.',
      steps: [
        { order: 1, edgeId: 'e1', sourceNodeId: 'homeowner', targetNodeId: 'cloud-api', technique: 'T1078: Valid Accounts' },
        { order: 2, edgeId: 'e12', sourceNodeId: 'cloud-api', targetNodeId: 'cloud-storage', technique: 'T1530: Data from Cloud Storage Object' },
      ],
      mitreTechniques: ['T1078', 'T1530'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
  ],
  grcWorkspace: buildGrcWorkspace({
    tierCatalogue: [
      { id: 'iot-t1-cyber', tier: 1 as const, label: 'Cyber Risk', description: 'IoT security threats' },
      { id: 'iot-t1-safety', tier: 1 as const, label: 'Physical Safety', description: 'Physical security implications' },
      { id: 'iot-t1-privacy', tier: 1 as const, label: 'Privacy Risk', description: 'Surveillance and data privacy' },
      { id: 'iot-t2-device', tier: 2 as const, label: 'Device Security', parentId: 'iot-t1-cyber', description: 'IoT device firmware and protocol threats' },
      { id: 'iot-t2-cloud', tier: 2 as const, label: 'Cloud API Security', parentId: 'iot-t1-cyber', description: 'Cloud management platform threats' },
      { id: 'iot-t2-physical', tier: 2 as const, label: 'Physical Access Control', parentId: 'iot-t1-safety', description: 'Smart lock and alarm threats' },
      { id: 'iot-t3-lock-bypass', tier: 3 as const, label: 'Smart Lock Bypass', parentId: 'iot-t2-physical' },
      { id: 'iot-t3-firmware', tier: 3 as const, label: 'Firmware Tampering', parentId: 'iot-t2-device' },
      { id: 'iot-t3-camera-leak', tier: 3 as const, label: 'Camera Data Leak', parentId: 'iot-t1-privacy' },
    ],
    assets: [
      { id: 'iot-asset-hub', name: 'IoT Hub (Home Assistant)', type: 'iot_gateway', owner: 'Homeowner', criticality: 5, linkedNodeIds: ['iot-hub'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'iot-asset-locks', name: 'Smart Door Locks', type: 'iot_device', owner: 'Homeowner', criticality: 5, linkedNodeIds: ['smart-locks'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'iot-asset-cameras', name: 'Security Camera System', type: 'iot_device', owner: 'Homeowner', criticality: 4, linkedNodeIds: ['smart-cameras'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'iot-asset-cloud', name: 'IoT Cloud API (AWS IoT Core)', type: 'cloud_service', owner: 'Vendor', criticality: 4, linkedNodeIds: ['cloud-api'], status: 'active', createdAt: NOW, updatedAt: NOW },
    ],
    risks: [
      { id: 'iot-risk-lock', title: 'Unauthorized Smart Lock Control', description: 'Spoofed voice commands or compromised cloud API could unlock doors remotely.', tierId: 'iot-t3-lock-bypass', linkedAssetIds: ['iot-asset-locks', 'iot-asset-hub'], likelihood: 'likelihood-3', impact: 'impact-5', currentScore: score('likelihood-3', 'impact-5'), status: 'open', owner: 'Homeowner', createdAt: NOW, updatedAt: NOW },
      { id: 'iot-risk-firmware', title: 'Malicious Firmware Distribution', description: 'Compromised update channel could push malicious firmware to all devices.', tierId: 'iot-t3-firmware', linkedAssetIds: ['iot-asset-hub', 'iot-asset-cameras'], likelihood: 'likelihood-2', impact: 'impact-5', currentScore: score('likelihood-2', 'impact-5'), status: 'open', owner: 'Vendor', createdAt: NOW, updatedAt: NOW },
      { id: 'iot-risk-camera', title: 'Camera Recording Data Leak', description: 'Unauthorized access to cloud storage exposes private surveillance footage.', tierId: 'iot-t3-camera-leak', linkedAssetIds: ['iot-asset-cameras', 'iot-asset-cloud'], likelihood: 'likelihood-3', impact: 'impact-4', currentScore: score('likelihood-3', 'impact-4'), status: 'open', owner: 'Homeowner', createdAt: NOW, updatedAt: NOW },
    ],
    assessments: [
      { id: 'iot-assess-1', title: 'Smart Home IoT Threat Assessment', scope: 'Full IoT ecosystem including cloud', status: 'in_progress', createdBy: 'Security Consultant', createdAt: NOW, updatedAt: NOW, threatModel: { nodeFindings: [{ nodeId: 'smart-locks', findingIds: ['iot-risk-lock'] }, { nodeId: 'cloud-api', findingIds: ['iot-risk-camera'] }], edgeFindings: [{ edgeId: 'e6', findingIds: ['iot-risk-lock'] }, { edgeId: 'e14', findingIds: ['iot-risk-firmware'] }] } },
    ],
    soaEntries: [
      { id: 'iot-soa-1', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'ctrl-a07', status: 'partially_implemented', justification: 'OAuth 2.0 on cloud API but voice assistants use basic auth.', linkedRiskIds: ['iot-risk-lock'], implementationNotes: 'Add MFA for critical lock operations.', owner: 'Vendor', createdAt: NOW, updatedAt: NOW },
      { id: 'iot-soa-2', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'ctrl-a08', status: 'partially_implemented', justification: 'Firmware signed but signature verification is optional.', linkedRiskIds: ['iot-risk-firmware'], implementationNotes: 'Enforce mandatory signature verification.', owner: 'Vendor', createdAt: NOW, updatedAt: NOW },
      { id: 'iot-soa-3', controlSetId: CIS_CONTROL_SET_ID, controlId: 'cis-ctrl-03', status: 'implemented', justification: 'Encryption at rest on cloud storage with access policies.', linkedRiskIds: ['iot-risk-camera'], implementationNotes: 'Add anomalous access pattern detection.', owner: 'Vendor', createdAt: NOW, updatedAt: NOW },
    ],
    thirdParties: [
      {
        id: 'iot-tp-aws',
        name: 'Amazon Web Services (AWS)',
        description: 'Cloud infrastructure provider hosting IoT Core message broker, device shadow service, and S3 storage for camera recordings. Provides MQTT endpoint for device telemetry and command-and-control messaging.',
        category: 'cloud_provider',
        status: 'active',
        riskRating: 'high',
        dataClassification: 'confidential',
        linkedAssetIds: ['iot-asset-cloud', 'iot-asset-cameras'],
        linkedRiskIds: ['iot-risk-camera', 'iot-risk-firmware'],
        contactName: 'AWS IoT Support',
        contactEmail: 'iot-support@aws.example.com',
        contractExpiry: '2026-12-31',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-09-30',
        notes: 'IoT Core with X.509 certificate-based device authentication. S3 bucket stores camera recordings with server-side encryption (SSE-S3). Device shadow service maintains last-known-good state for all connected devices. OTA firmware update channel hosted on S3 — update package integrity verified via code signing. CloudWatch alarms configured for anomalous MQTT connection patterns.'
      },
      {
        id: 'iot-tp-ring',
        name: 'Ring LLC (Amazon)',
        description: 'Security camera hardware supplier providing indoor and outdoor camera units with built-in motion detection, night vision, and local edge processing capabilities. Firmware updates distributed via vendor cloud.',
        category: 'supplier',
        status: 'active',
        riskRating: 'high',
        dataClassification: 'confidential',
        linkedAssetIds: ['iot-asset-cameras'],
        linkedRiskIds: ['iot-risk-camera', 'iot-risk-firmware'],
        contactName: 'Ring Partner Support',
        contactEmail: 'partner-support@ring.example.com',
        contractExpiry: '2026-11-30',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-08-31',
        notes: 'Camera hardware with edge ML processing for person detection. Firmware updates are signed but signature verification is optional on older models — identified as a risk. Video streams use TLS 1.2 to cloud storage. End-to-end encryption available but not enabled by default. Privacy review conducted annually due to surveillance data sensitivity. Hardware warranty includes security patch commitment for 5 years.'
      },
      {
        id: 'iot-tp-zigbee',
        name: 'Connectivity Standards Alliance (Zigbee)',
        description: 'Industry standards body and technology partner providing the Zigbee 3.0 protocol specification used for smart lock and sensor communication. Manages protocol certification and interoperability testing.',
        category: 'partner',
        status: 'active',
        riskRating: 'medium',
        dataClassification: 'internal',
        linkedAssetIds: ['iot-asset-hub', 'iot-asset-locks'],
        linkedRiskIds: ['iot-risk-lock'],
        contactName: 'CSA Technical Liaison',
        contactEmail: 'technical-liaison@csa-iot.example.com',
        contractExpiry: '',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-12-31',
        notes: 'Zigbee 3.0 protocol used for hub-to-lock communication with AES-128 encryption. Protocol specification includes Install Code-based key exchange but some legacy devices use default trust center link key. Matter protocol migration planned for next hardware revision. Interoperability certification ensures devices from multiple vendors can securely communicate. Protocol vulnerability disclosures monitored via CSA security advisory channel.'
      },
    ],
  } as any),
};