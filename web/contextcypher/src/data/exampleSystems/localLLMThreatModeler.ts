import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityNode, SecurityEdge, SecurityZone } from '../../types/SecurityTypes';
import { colors } from '../../styles/Theme';
import { DiagramAttackPath } from '../../types/GrcTypes';
import { buildGrcWorkspace, score, NOW, OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID } from './grcSharedBase';

export const localLLMThreatModeler: ExampleSystem = {
  id: 'local-llm-threat-modeler',
  name: 'AI Threat Modeler - Local LLM Mode',
  description: 'Secure offline-first threat modeling with local AI processing demonstrating best practices',
  category: 'Secure Systems',
  primaryZone: 'Restricted',
  dataClassification: 'Confidential',
  customContext: `# AI Threat Modeler - Local LLM Mode

## System Overview
This represents a highly secure, offline-capable threat modeling application designed for air-gapped environments and organizations with strict data residency requirements. The system runs entirely on-premises with no external dependencies, using locally hosted large language models for AI-assisted threat analysis.

## Business Context
- **Target Users**: Government agencies, defense contractors, financial institutions
- **Deployment Model**: Standalone desktop application with local AI inference
- **Compliance**: FIPS 140-2, Common Criteria EAL4+, NIST 800-53
- **Data Sensitivity**: Classified and proprietary system architectures

## Security Architecture
- **Zero Trust Design**: Every component interaction requires authentication
- **Air-Gap Capable**: Fully functional without internet connectivity
- **End-to-End Encryption**: All data encrypted at rest and in transit
- **Hardware Security**: TPM 2.0 integration for key storage
- **Secure Boot**: Application integrity verification on startup

## Technical Implementation
- **Frontend**: Tauri framework with Content Security Policy
- **AI Engine**: Llama.cpp with quantized models (13B parameters)
- **Backend**: Rust-based services with memory-safe operations
- **Storage**: SQLCipher encrypted database with key rotation
- **Model Format**: GGUF format with signature verification

## Operational Security
- **Model Updates**: Offline update packages with cryptographic signatures
- **Audit Logging**: Tamper-evident logs with hash chaining
- **Access Control**: Multi-factor authentication with hardware tokens
- **Session Management**: Automatic timeout and secure session storage
- **Data Sanitization**: Secure deletion of temporary files

## Key Features
- Local inference with no data leaving the device
- Support for multiple LLM architectures (Llama, Mistral, Falcon)
- GPU acceleration with CUDA/ROCm support
- Model quantization for reduced memory footprint
- Incremental learning from local threat intelligence

## Performance Specifications
- **Inference Speed**: 50-100 tokens/second on consumer GPU
- **Model Size**: 4-bit quantized models under 10GB
- **Memory Usage**: 16GB RAM minimum, 32GB recommended
- **Storage**: 50GB for models and threat intelligence database
- **Response Time**: <2 seconds for threat analysis queries`,
  nodes: [
    // Security Zones
    {
      id: 'external-zone',
      type: 'securityZone',
      position: { x: -150, y: 50 },
      data: {
        label: 'External Zone',
        zoneType: 'External' as SecurityZone,
        description: 'User workstation environment',
        zone: 'Internal' as SecurityZone
      },
      style: {
        width: 650,
        height: 1000,
        background: colors.zoneBackgrounds.External,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'trusted-zone',
      type: 'securityZone',
      position: { x: 820, y: 50 },
      data: {
        label: 'Trusted Zone',
        zoneType: 'Trusted' as SecurityZone,
        description: 'Application runtime environment'
      },
      style: {
        width: 900,
        height: 1000,
        background: colors.zoneBackgrounds.Trusted,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'restricted-zone',
      type: 'securityZone',
      position: { x: 1840, y: 50 },
      data: {
        label: 'Restricted Zone',
        zoneType: 'Restricted' as SecurityZone,
        description: 'AI model and sensitive data storage'
      },
      style: {
        width: 900,
        height: 1000,
        background: colors.zoneBackgrounds.Restricted,
        zIndex: -1
      }
    } as SecurityNode,

    // External Zone Components
    {
      id: 'user-workstation',
      type: 'workstation',
      position: { x: 375, y: 725 },
      data: {
        label: 'Security Analyst Workstation',
        description: 'Hardened workstation with security tools',
        zone: 'External' as SecurityZone,
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'IPC'],
        vendor: 'dell',
        product: 'precision-7760',
        version: 'Win11-Enterprise',
        securityControls: ['BitLocker', 'TPM 2.0', 'Secure Boot']
      }
    } as SecurityNode,
    {
      id: 'hardware-token',
      type: 'mfa',
      position: { x: -25, y: 275 },
      data: {
        label: 'Hardware Security Key',
        description: 'FIDO2/WebAuthn hardware token',
        zone: 'External' as SecurityZone,
        dataClassification: 'Confidential',
        protocols: ['USB', 'NFC'],
        vendor: 'yubico',
        product: 'yubikey-5c',
        version: '5.4.3'
      }
    } as SecurityNode,
    {
      id: 'browser-runtime',
      type: 'application',
      position: { x: 575, y: 325 },
      data: {
        label: 'Chromium Sandbox',
        description: 'Hardened browser runtime for UI',
        zone: 'External' as SecurityZone,
        dataClassification: 'Internal',
        protocols: ['IPC', 'WebRTC'],
        vendor: 'chromium',
        product: 'embedded-runtime',
        version: '120.0.6099',
        securityControls: ['CSP', 'Sandbox', 'Site Isolation']
      }
    } as SecurityNode,

    // Trusted Zone Components
    {
      id: 'tauri-backend',
      type: 'application',
      position: { x: 1225, y: 125 },
      data: {
        label: 'Tauri Backend',
        description: 'Rust-based application backend',
        zone: 'Trusted' as SecurityZone,
        dataClassification: 'Confidential',
        protocols: ['IPC', 'gRPC'],
        vendor: 'tauri',
        product: 'tauri-runtime',
        version: '1.5.6',
        technology: 'Rust',
        securityControls: ['Memory Safety', 'Type Safety', 'ASLR']
      }
    } as SecurityNode,
    {
      id: 'auth-service',
      type: 'authServer',
      position: { x: 875, y: 325 },
      data: {
        label: 'Authentication Service',
        description: 'Local authentication with MFA',
        zone: 'Trusted' as SecurityZone,
        dataClassification: 'Confidential',
        protocols: ['OAuth2', 'WebAuthn'],
        vendor: 'custom',
        product: 'auth-service',
        version: '2.0',
        securityControls: ['PBKDF2', 'Hardware Token Support', 'Session Management']
      }
    } as SecurityNode,
    {
      id: 'api-gateway',
      type: 'apiGateway',
      position: { x: 1425, y: 275 },
      data: {
        label: 'Local API Gateway',
        description: 'Request routing and validation',
        zone: 'Trusted' as SecurityZone,
        dataClassification: 'Internal',
        protocols: ['REST', 'GraphQL'],
        vendor: 'custom',
        product: 'api-gateway',
        version: '1.0',
        securityControls: ['Rate Limiting', 'Input Validation', 'CORS']
      }
    } as SecurityNode,
    {
      id: 'threat-engine',
      type: 'service',
      position: { x: 1625, y: 675 },
      data: {
        label: 'Threat Analysis Engine',
        description: 'Core threat modeling logic',
        zone: 'Trusted' as SecurityZone,
        dataClassification: 'Sensitive',
        protocols: ['gRPC', 'REST'],
        vendor: 'custom',
        product: 'threat-engine',
        version: '3.0',
        technology: 'Rust',
        securityControls: ['Input Sanitization', 'Output Encoding', 'Sandboxing']
      }
    } as SecurityNode,
    {
      id: 'diagram-service',
      type: 'service',
      position: { x: 925, y: 725 },
      data: {
        label: 'Diagram Service',
        description: 'Architecture diagram processing',
        zone: 'Trusted' as SecurityZone,
        dataClassification: 'Sensitive',
        protocols: ['gRPC'],
        vendor: 'custom',
        product: 'diagram-service',
        version: '2.5',
        securityControls: ['SVG Sanitization', 'Path Traversal Protection']
      }
    } as SecurityNode,
    {
      id: 'audit-logger',
      type: 'logging',
      position: { x: 1175, y: 475 },
      data: {
        label: 'Audit Logger',
        description: 'Tamper-evident audit logs',
        zone: 'Trusted' as SecurityZone,
        dataClassification: 'Confidential',
        protocols: ['syslog', 'local'],
        vendor: 'custom',
        product: 'audit-logger',
        version: '1.0',
        securityControls: ['Hash Chaining', 'Encryption', 'Time Stamping']
      }
    } as SecurityNode,
    {
      id: 'cache-service',
      type: 'cache',
      position: { x: 1225, y: 925 },
      data: {
        label: 'Encrypted Cache',
        description: 'In-memory encrypted cache',
        zone: 'Trusted' as SecurityZone,
        dataClassification: 'Sensitive',
        protocols: ['Redis Protocol'],
        vendor: 'redis',
        product: 'redis',
        version: '7.2',
        securityControls: ['Memory Encryption', 'TTL', 'Access Control']
      }
    } as SecurityNode,

    // Restricted Zone Components (shifted +250 from old x positions)
    {
      id: 'llm-inference',
      type: 'mlInference',
      position: { x: 2225, y: 225 },
      data: {
        label: 'LLM Inference Engine',
        description: 'Local AI model inference',
        zone: 'Restricted' as SecurityZone,
        dataClassification: 'Confidential',
        protocols: ['gRPC', 'CUDA'],
        vendor: 'llama.cpp',
        product: 'inference-engine',
        version: '0.1.20',
        technology: 'C++/CUDA',
        securityControls: ['Model Signing', 'Secure Loading', 'Memory Protection']
      }
    } as SecurityNode,
    {
      id: 'model-store',
      type: 'modelVault',
      position: { x: 2175, y: 525 },
      data: {
        label: 'Model Vault',
        description: 'Encrypted AI model storage',
        zone: 'Restricted' as SecurityZone,
        dataClassification: 'Confidential',
        protocols: ['File', 'HTTPS'],
        vendor: 'custom',
        product: 'model-vault',
        version: '1.0',
        securityControls: ['AES-256-GCM', 'Signature Verification', 'Access Logging']
      }
    } as SecurityNode,
    {
      id: 'vector-db',
      type: 'vectorDatabase',
      position: { x: 2575, y: 325 },
      data: {
        label: 'Vector Database',
        description: 'Threat intelligence embeddings',
        zone: 'Restricted' as SecurityZone,
        dataClassification: 'Sensitive',
        protocols: ['gRPC', 'HTTP/2'],
        vendor: 'weaviate',
        product: 'weaviate',
        version: '1.23',
        securityControls: ['Encryption at Rest', 'RBAC', 'API Keys']
      }
    } as SecurityNode,
    {
      id: 'threat-db',
      type: 'database',
      position: { x: 2525, y: 75 },
      data: {
        label: 'Threat Intelligence DB',
        description: 'Local threat intelligence storage',
        zone: 'Restricted' as SecurityZone,
        dataClassification: 'Confidential',
        protocols: ['SQLite', 'File'],
        vendor: 'sqlcipher',
        product: 'sqlcipher',
        version: '4.5.5',
        securityControls: ['Full Database Encryption', 'Key Rotation', 'WAL Mode']
      }
    } as SecurityNode,
    {
      id: 'model-updater',
      type: 'service',
      position: { x: 1975, y: 825 },
      data: {
        label: 'Model Update Service',
        description: 'Offline model update handler',
        zone: 'Restricted' as SecurityZone,
        dataClassification: 'Confidential',
        protocols: ['File', 'USB'],
        vendor: 'custom',
        product: 'model-updater',
        version: '1.0',
        securityControls: ['Signature Verification', 'Rollback Protection', 'Audit Trail']
      }
    } as SecurityNode,
    {
      id: 'hsm',
      type: 'hsm',
      position: { x: 2475, y: 725 },
      data: {
        label: 'Hardware Security Module',
        description: 'Cryptographic key storage',
        zone: 'Restricted' as SecurityZone,
        dataClassification: 'Confidential',
        protocols: ['PKCS#11', 'USB'],
        vendor: 'thales',
        product: 'luna-7',
        version: '7.8.1',
        technology: 'FIPS 140-2 Level 3',
        securityControls: ['Hardware Key Storage', 'Tamper Evidence', 'Zeroization']
      }
    } as SecurityNode,
    {
      id: 'gpu-compute',
      type: 'computeCluster',
      position: { x: 2475, y: 575 },
      data: {
        label: 'GPU Compute Node',
        description: 'Local GPU for AI inference',
        zone: 'Restricted' as SecurityZone,
        dataClassification: 'Sensitive',
        protocols: ['PCIe', 'CUDA'],
        vendor: 'nvidia',
        product: 'rtx-4090',
        version: '545.29.06',
        securityControls: ['Secure Boot', 'Memory Isolation', 'ECC Memory']
      }
    } as SecurityNode
  ],

  edges: [
    // User Authentication Flow
    {
      id: 'e1',
      source: 'user-workstation',
      target: 'browser-runtime',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'UI Rendering',
        protocol: 'IPC',
        encryption: 'none',
        dataClassification: 'Internal',
        zone: 'External' as SecurityZone,
        animated: false
      }
    } as SecurityEdge,
    {
      id: 'e2',
      source: 'hardware-token',
      target: 'user-workstation',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'MFA',
        protocol: 'USB/NFC',
        encryption: 'Hardware',
        dataClassification: 'Confidential',
        zone: 'External' as SecurityZone,
        animated: false
      }
    } as SecurityEdge,
    {
      id: 'e3',
      source: 'browser-runtime',
      target: 'tauri-backend',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        controlPoints: [{ id: 'cp-1771656042687', x: 750, y: 150, active: true }],
        label: 'IPC Bridge',
        protocol: 'IPC',
        encryption: 'none',
        dataClassification: 'Internal',
        zone: 'Trusted' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,

    // Authentication Flow
    {
      id: 'e4',
      source: 'tauri-backend',
      target: 'auth-service',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Auth Request',
        protocol: 'OAuth2',
        encryption: 'TLS 1.3',
        dataClassification: 'Confidential',
        zone: 'Trusted' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e5',
      source: 'auth-service',
      target: 'api-gateway',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Token Validation',
        protocol: 'JWT',
        encryption: 'RS256',
        dataClassification: 'Confidential',
        zone: 'Trusted' as SecurityZone,
        animated: false
      }
    } as SecurityEdge,

    // API Flow
    {
      id: 'e6',
      source: 'api-gateway',
      target: 'threat-engine',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Threat Analysis',
        protocol: 'gRPC',
        encryption: 'mTLS',
        dataClassification: 'Sensitive',
        zone: 'Trusted' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e7',
      source: 'api-gateway',
      target: 'diagram-service',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        controlPoints: [{ id: 'cp-1771656058942', x: 1250, y: 750, active: true }],
        label: 'Diagram Ops',
        protocol: 'gRPC',
        encryption: 'mTLS',
        dataClassification: 'Sensitive',
        zone: 'Trusted' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,

    // Service Interactions
    {
      id: 'e8',
      source: 'threat-engine',
      target: 'llm-inference',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'AI Analysis',
        protocol: 'gRPC',
        encryption: 'mTLS',
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e9',
      source: 'threat-engine',
      target: 'cache-service',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Cache Lookup',
        protocol: 'Redis',
        encryption: 'TLS',
        dataClassification: 'Sensitive',
        zone: 'Trusted' as SecurityZone,
        animated: false
      }
    } as SecurityEdge,
    {
      id: 'e10',
      source: 'diagram-service',
      target: 'audit-logger',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Audit Events',
        protocol: 'syslog',
        encryption: 'TLS',
        dataClassification: 'Confidential',
        zone: 'Trusted' as SecurityZone,
        animated: false
      }
    } as SecurityEdge,

    // Restricted Zone Interactions
    {
      id: 'e11',
      source: 'llm-inference',
      target: 'model-store',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Model Load',
        protocol: 'File',
        encryption: 'AES-256',
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone,
        animated: false
      }
    } as SecurityEdge,
    {
      id: 'e12',
      source: 'llm-inference',
      target: 'vector-db',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Embeddings',
        protocol: 'gRPC',
        encryption: 'mTLS',
        dataClassification: 'Sensitive',
        zone: 'Restricted' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e13',
      source: 'llm-inference',
      target: 'threat-db',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Threat Intel',
        protocol: 'SQLite',
        encryption: 'SQLCipher',
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone,
        animated: false
      }
    } as SecurityEdge,
    {
      id: 'e14',
      source: 'model-updater',
      target: 'model-store',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Model Update',
        protocol: 'File',
        encryption: 'AES-256',
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone,
        animated: false
      }
    } as SecurityEdge,
    {
      id: 'e15',
      source: 'hsm',
      target: 'model-store',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Key Management',
        protocol: 'PKCS#11',
        encryption: 'Hardware',
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone,
        animated: false
      }
    } as SecurityEdge,
    {
      id: 'e16',
      source: 'llm-inference',
      target: 'gpu-compute',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'GPU Compute',
        protocol: 'CUDA',
        encryption: 'none',
        dataClassification: 'Sensitive',
        zone: 'Restricted' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,

    // Monitoring/Audit Flows
    {
      id: 'e17',
      source: 'threat-engine',
      target: 'audit-logger',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Threat Events',
        protocol: 'syslog',
        encryption: 'TLS',
        dataClassification: 'Confidential',
        zone: 'Trusted' as SecurityZone,
        animated: false
      }
    } as SecurityEdge,
    {
      id: 'e18',
      source: 'auth-service',
      target: 'audit-logger',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'left',
      data: {
        label: 'Auth Events',
        protocol: 'syslog',
        encryption: 'TLS',
        dataClassification: 'Confidential',
        zone: 'Trusted' as SecurityZone,
        animated: false
      }
    } as SecurityEdge,
    {
      id: 'e19',
      source: 'model-store',
      target: 'hsm',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Crypto Ops',
        protocol: 'PKCS#11',
        encryption: 'Hardware',
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone,
        animated: false
      }
    } as SecurityEdge
  ],
  attackPaths: [
    {
      id: 'ap-llm-model-poisoning',
      name: 'Compromised Model Update → Poisoned Inference → Misleading Threat Analysis',
      strideCategory: 'Tampering',
      riskLevel: 'High',
      description: 'Attacker compromises the offline model update package, bypassing signature verification, to inject a poisoned model into the model store. The LLM inference engine then generates incorrect or misleading threat assessments.',
      steps: [
        { order: 1, edgeId: 'e14', sourceNodeId: 'model-updater', targetNodeId: 'model-store', technique: 'T1195: Supply Chain Compromise' },
        { order: 2, edgeId: 'e11', sourceNodeId: 'llm-inference', targetNodeId: 'model-store', technique: 'T1588: Obtain Capabilities (Poisoned Model)' },
        { order: 3, edgeId: 'e8', sourceNodeId: 'threat-engine', targetNodeId: 'llm-inference', technique: 'T1565: Data Manipulation' },
      ],
      mitreTechniques: ['T1195', 'T1588', 'T1565'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-llm-token-bypass',
      name: 'Stolen Hardware Token → Auth Bypass → Threat Database Exfiltration',
      strideCategory: 'Spoofing',
      riskLevel: 'Medium',
      description: 'Attacker gains physical access to a hardware token, authenticates through the Tauri backend and auth service, then accesses the threat database containing sensitive system architecture details.',
      steps: [
        { order: 1, edgeId: 'e2', sourceNodeId: 'hardware-token', targetNodeId: 'user-workstation', technique: 'T1078: Valid Accounts' },
        { order: 2, edgeId: 'e1', sourceNodeId: 'user-workstation', targetNodeId: 'browser-runtime', technique: 'T1189: Drive-by Compromise' },
        { order: 3, edgeId: 'e3', sourceNodeId: 'browser-runtime', targetNodeId: 'tauri-backend', technique: 'T1059: Command and Scripting Interpreter' },
        { order: 4, edgeId: 'e4', sourceNodeId: 'tauri-backend', targetNodeId: 'auth-service', technique: 'T1556: Modify Authentication Process' },
      ],
      mitreTechniques: ['T1078', 'T1189', 'T1059', 'T1556'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-llm-gpu-side-channel',
      name: 'GPU Side-Channel → Model Weight Extraction → Intellectual Property Theft',
      strideCategory: 'Information Disclosure',
      riskLevel: 'Low',
      description: 'Sophisticated attacker exploits GPU side-channel vulnerabilities during inference to extract model weights or training data from the GPU compute resources.',
      steps: [
        { order: 1, edgeId: 'e16', sourceNodeId: 'llm-inference', targetNodeId: 'gpu-compute', technique: 'T1212: Exploitation for Credential Access' },
      ],
      mitreTechniques: ['T1212'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
  ],
  grcWorkspace: buildGrcWorkspace({
    tierCatalogue: [
      { id: 'llm-t1-cyber', tier: 1 as const, label: 'Cyber Risk', description: 'Security threats to the threat modeler platform' },
      { id: 'llm-t1-ops', tier: 1 as const, label: 'Operational Risk', description: 'Availability and integrity of AI analysis' },
      { id: 'llm-t1-compliance', tier: 1 as const, label: 'Compliance Risk', description: 'FIPS and Common Criteria compliance' },
      { id: 'llm-t2-model', tier: 2 as const, label: 'Model Security', parentId: 'llm-t1-cyber', description: 'LLM model integrity and confidentiality' },
      { id: 'llm-t2-data', tier: 2 as const, label: 'Data Protection', parentId: 'llm-t1-cyber', description: 'Classified architecture data' },
      { id: 'llm-t2-auth', tier: 2 as const, label: 'Authentication', parentId: 'llm-t1-cyber', description: 'Hardware token and MFA' },
      { id: 'llm-t2-fips', tier: 2 as const, label: 'FIPS Compliance', parentId: 'llm-t1-compliance', description: 'Cryptographic module requirements' },
      { id: 'llm-t3-supply-chain', tier: 3 as const, label: 'Model Supply Chain', parentId: 'llm-t2-model' },
      { id: 'llm-t3-token-theft', tier: 3 as const, label: 'Token Physical Security', parentId: 'llm-t2-auth' },
      { id: 'llm-t3-side-channel', tier: 3 as const, label: 'GPU Side-Channel', parentId: 'llm-t2-model' },
    ],
    assets: [
      { id: 'llm-asset-model', name: 'Local LLM Model Store', type: 'model_store', owner: 'AI Team', criticality: 5, linkedNodeIds: ['model-store', 'llm-inference'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'llm-asset-threatdb', name: 'Threat Intelligence Database', type: 'database', owner: 'Security Team', criticality: 5, linkedNodeIds: ['threat-db'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'llm-asset-hsm', name: 'Hardware Security Module', type: 'hsm', owner: 'Security Team', criticality: 5, linkedNodeIds: ['hsm'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'llm-asset-gpu', name: 'GPU Compute Resources', type: 'compute', owner: 'Infrastructure Team', criticality: 4, linkedNodeIds: ['gpu-compute'], status: 'active', createdAt: NOW, updatedAt: NOW },
    ],
    risks: [
      { id: 'llm-risk-poison', title: 'Model Supply Chain Poisoning', description: 'Compromised offline update could inject a poisoned model generating incorrect threat analysis.', tierId: 'llm-t3-supply-chain', linkedAssetIds: ['llm-asset-model'], likelihood: 'likelihood-2', impact: 'impact-5', currentScore: score('likelihood-2', 'impact-5'), status: 'open', owner: 'AI Team', createdAt: NOW, updatedAt: NOW },
      { id: 'llm-risk-token', title: 'Hardware Token Theft', description: 'Physical theft of hardware authentication token could allow unauthorized access.', tierId: 'llm-t3-token-theft', linkedAssetIds: ['llm-asset-hsm'], likelihood: 'likelihood-2', impact: 'impact-4', currentScore: score('likelihood-2', 'impact-4'), status: 'open', owner: 'Security Team', createdAt: NOW, updatedAt: NOW },
      { id: 'llm-risk-side-channel', title: 'GPU Side-Channel Information Leak', description: 'Theoretical side-channel attack on GPU during inference could leak model weights.', tierId: 'llm-t3-side-channel', linkedAssetIds: ['llm-asset-gpu', 'llm-asset-model'], likelihood: 'likelihood-1', impact: 'impact-4', currentScore: score('likelihood-1', 'impact-4'), status: 'mitigated', owner: 'Infrastructure Team', createdAt: NOW, updatedAt: NOW },
    ],
    assessments: [
      { id: 'llm-assess-1', title: 'Offline AI Platform Security Assessment', scope: 'Full local LLM threat modeler stack', status: 'in_progress', createdBy: 'Security Team', createdAt: NOW, updatedAt: NOW, threatModel: { nodeFindings: [{ nodeId: 'model-store', findingIds: ['llm-risk-poison'] }, { nodeId: 'gpu-compute', findingIds: ['llm-risk-side-channel'] }], edgeFindings: [{ edgeId: 'e14', findingIds: ['llm-risk-poison'] }, { edgeId: 'e2', findingIds: ['llm-risk-token'] }] } },
    ],
    soaEntries: [
      { id: 'llm-soa-1', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'ctrl-a08', status: 'implemented', justification: 'Cryptographic signature verification on all model updates.', linkedRiskIds: ['llm-risk-poison'], implementationNotes: 'Maintain offline CRL for revocation.', owner: 'AI Team', createdAt: NOW, updatedAt: NOW },
      { id: 'llm-soa-2', controlSetId: CIS_CONTROL_SET_ID, controlId: 'cis-ctrl-06', status: 'implemented', justification: 'Hardware token MFA with TPM-backed storage.', linkedRiskIds: ['llm-risk-token'], implementationNotes: 'Implement token revocation process.', owner: 'Security Team', createdAt: NOW, updatedAt: NOW },
      { id: 'llm-soa-3', controlSetId: CIS_CONTROL_SET_ID, controlId: 'cis-ctrl-03', status: 'implemented', justification: 'SQLCipher encryption with key rotation via HSM.', linkedRiskIds: ['llm-risk-poison', 'llm-risk-token'], implementationNotes: 'Verify key rotation schedule.', owner: 'Security Team', createdAt: NOW, updatedAt: NOW },
      { id: 'llm-soa-4', controlSetId: CIS_CONTROL_SET_ID, controlId: 'cis-ctrl-08', status: 'implemented', justification: 'Tamper-evident audit logging with hash chaining.', linkedRiskIds: ['llm-risk-token', 'llm-risk-poison'], implementationNotes: 'Ensure log integrity verification on startup.', owner: 'Security Team', createdAt: NOW, updatedAt: NOW },
    ],
    thirdParties: [
      {
        id: 'llm-tp-ollama', name: 'Ollama', description: 'Local LLM runtime providing model serving, quantization, and inference engine for offline AI analysis.',
        category: 'supplier' as const, status: 'active' as const, riskRating: 'high' as const, dataClassification: 'confidential' as const,
        linkedAssetIds: ['llm-asset-model'], linkedRiskIds: ['llm-risk-poison'],
        contactName: 'Jeffrey Ma', contactEmail: 'jeffrey.ma@ollama.com',
        contractExpiry: '2027-06-30T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-08-01T00:00:00.000Z',
        notes: 'Open source runtime. Model update packages require offline signature verification before deployment. Supply chain integrity critical.',
      },
      {
        id: 'llm-tp-nvidia', name: 'NVIDIA', description: 'GPU hardware and CUDA runtime vendor providing compute acceleration for local LLM inference.',
        category: 'supplier' as const, status: 'active' as const, riskRating: 'medium' as const, dataClassification: 'internal' as const,
        linkedAssetIds: ['llm-asset-gpu'], linkedRiskIds: ['llm-risk-side-channel'],
        contactName: 'Wei Lin', contactEmail: 'wei.lin@nvidia.com',
        contractExpiry: '2027-12-31T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-09-15T00:00:00.000Z',
        notes: 'RTX 4090 with ECC memory. GPU side-channel vulnerability mitigated via memory isolation and secure boot. Firmware updates tracked.',
      },
      {
        id: 'llm-tp-mitre', name: 'MITRE', description: 'ATT&CK framework data provider supplying threat intelligence taxonomy and technique mappings.',
        category: 'partner' as const, status: 'active' as const, riskRating: 'low' as const, dataClassification: 'internal' as const,
        linkedAssetIds: ['llm-asset-threatdb'], linkedRiskIds: ['llm-risk-poison'],
        contactName: 'Dr. Amanda Fischer', contactEmail: 'amanda.fischer@mitre.org',
        contractExpiry: '2028-12-31T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-12-01T00:00:00.000Z',
        notes: 'Publicly available ATT&CK data imported via offline update packages with integrity verification. No direct network connection.',
      },
    ],
  } as any),
};
