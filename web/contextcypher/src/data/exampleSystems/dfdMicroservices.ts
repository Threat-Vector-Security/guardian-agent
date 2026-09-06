import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityNode, SecurityEdge, SecurityZone, DataClassification } from '../../types/SecurityTypes';
import { colors } from '../../styles/Theme';
import { DiagramAttackPath } from '../../types/GrcTypes';
import { buildGrcWorkspace, score, NOW, OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID } from './grcSharedBase';

export const dfdMicroservices: ExampleSystem = {
  id: 'dfd-microservices',
  name: 'DFD: Microservices Architecture',
  description: 'DFD model showing microservices with API gateway, service mesh, and multiple data stores',
  category: 'DFD Threat Models',
  primaryZone: 'Production',
  dataClassification: 'Sensitive',
  customContext: `
## DFD Microservices Architecture Threat Model

This represents a modern microservices architecture using DFD notation for STRIDE analysis.

### Architecture Overview
- External API consumers access services through an API Gateway
- Services communicate via service mesh with sidecar proxies
- Each microservice has its own data store (database per service pattern)
- Event streaming enables asynchronous communication
- Container orchestration manages service deployment

### Key Components
1. API Gateway - Central entry point with authentication
2. Service Mesh - Inter-service communication with mTLS
3. User Service - Handles user authentication and profiles
4. Order Service - Manages order lifecycle
5. Inventory Service - Tracks product availability
6. Notification Service - Sends emails and push notifications

### Security Architecture
- Zero-trust networking between services
- Each service runs with least privilege
- Secrets managed by external secret manager
- All inter-service communication encrypted with mTLS
- API Gateway handles external authentication (OAuth 2.0)
- Rate limiting applied at gateway and service level
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
        description: 'External API consumers and third-party services'
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
        description: 'API Gateway and edge services'
      },
      style: {
        width: 600,
        height: 1000,
        background: colors.zoneBackgrounds.DMZ,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'production-zone',
      type: 'securityZone',
      position: { x: 1490, y: 50 },
      data: {
        label: 'Production Zone',
        zoneType: 'Production',
        description: 'Production microservices and data stores'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Production,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'restricted-zone',
      type: 'securityZone',
      position: { x: 2360, y: 50 },
      data: {
        label: 'Restricted Zone',
        zoneType: 'Restricted',
        description: 'Sensitive data stores and secret management'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Restricted,
        zIndex: -1
      }
    } as SecurityNode,

    // DFD Nodes - External Actors
    {
      id: 'mobile-apps',
      type: 'dfdActor',
      position: { x: 250, y: 250 },
      data: {
        label: 'Mobile Applications',
        actorType: 'Native Mobile Apps',
        zone: 'External',
        description: 'Native iOS and Android applications',
        protocols: ['HTTPS'],
        dataClassification: 'Public'
      }
    } as SecurityNode,
    {
      id: 'web-spa',
      type: 'dfdActor',
      position: { x: 250, y: 450 },
      data: {
        label: 'Web SPA',
        actorType: 'React SPA Frontend',
        zone: 'External',
        description: 'React single-page application',
        protocols: ['HTTPS'],
        dataClassification: 'Public'
      }
    } as SecurityNode,
    {
      id: 'partner-api',
      type: 'dfdActor',
      position: { x: 250, y: 650 },
      data: {
        label: 'Partner APIs',
        actorType: 'B2B Partner Integration APIs',
        zone: 'External',
        description: 'B2B partner integrations',
        protocols: ['HTTPS'],
        dataClassification: 'Internal'
      }
    } as SecurityNode,

    // Trust Boundaries
    {
      id: 'external-boundary',
      type: 'dfdTrustBoundary',
      position: { x: 670, y: 150 },
      data: {
        label: 'External Trust Boundary',
        boundaryType: 'External API Perimeter',
        zone: 'DMZ',
        description: 'Boundary between internet and DMZ'
      }
    } as SecurityNode,
    {
      id: 'service-boundary',
      type: 'dfdTrustBoundary',
      position: { x: 1390, y: 150 },
      data: {
        label: 'Service Mesh Boundary',
        boundaryType: 'Service Mesh Security Perimeter',
        zone: 'Production',
        description: 'Service mesh security boundary with mTLS'
      }
    } as SecurityNode,

    // DMZ Processes
    {
      id: 'api-gateway',
      type: 'dfdProcess',
      position: { x: 970, y: 450 },
      data: {
        label: 'API Gateway',
        processType: 'Kong API Gateway',
        zone: 'DMZ',
        description: 'Kong Gateway with OAuth 2.0 and rate limiting',
        technology: 'Kong',
        protocols: ['HTTPS', 'REST', 'GraphQL'],
        securityControls: ['OAuth 2.0', 'Rate Limiting', 'API Versioning', 'Request Validation'],
        dataClassification: 'Internal'
      }
    } as SecurityNode,

    // Production Microservices
    {
      id: 'user-service',
      type: 'dfdProcess',
      position: { x: 1690, y: 250 },
      data: {
        label: 'User Service',
        processType: 'User Identity Service',
        zone: 'Production',
        description: 'User authentication and profile management',
        technology: 'Go',
        protocols: ['gRPC', 'mTLS'],
        securityControls: ['JWT Validation', 'RBAC', 'Password Hashing'],
        dataClassification: 'Sensitive'
      }
    } as SecurityNode,
    {
      id: 'order-service',
      type: 'dfdProcess',
      position: { x: 1690, y: 450 },
      data: {
        label: 'Order Service',
        processType: 'Order Workflow Engine',
        zone: 'Production',
        description: 'Order processing and workflow management',
        technology: 'Java Spring Boot',
        protocols: ['gRPC', 'mTLS'],
        securityControls: ['Transaction Integrity', 'Saga Pattern'],
        dataClassification: 'Sensitive'
      }
    } as SecurityNode,
    {
      id: 'inventory-service',
      type: 'dfdProcess',
      position: { x: 1690, y: 650 },
      data: {
        label: 'Inventory Service',
        processType: 'Inventory Management Service',
        zone: 'Production',
        description: 'Product inventory tracking',
        technology: 'Node.js',
        protocols: ['gRPC', 'mTLS'],
        securityControls: ['Optimistic Locking', 'Event Sourcing'],
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'notification-service',
      type: 'dfdProcess',
      position: { x: 1690, y: 850 },
      data: {
        label: 'Notification Service',
        processType: 'Notification Dispatch Service',
        zone: 'Production',
        description: 'Email and push notification delivery',
        technology: 'Python',
        protocols: ['AMQP', 'mTLS'],
        securityControls: ['Template Sanitization', 'Rate Limiting'],
        dataClassification: 'Internal'
      }
    } as SecurityNode,

    // Data Stores
    {
      id: 'user-db',
      type: 'dfdDataStore',
      position: { x: 2560, y: 250 },
      data: {
        label: 'User Database',
        storeType: 'PostgreSQL User Database',
        zone: 'Restricted',
        description: 'PostgreSQL with encrypted PII data',
        technology: 'PostgreSQL',
        protocols: ['TLS'],
        securityControls: ['Column Encryption', 'Audit Logging', 'Access Control'],
        dataClassification: 'Sensitive'
      }
    } as SecurityNode,
    {
      id: 'order-db',
      type: 'dfdDataStore',
      position: { x: 2560, y: 450 },
      data: {
        label: 'Order Database',
        storeType: 'MongoDB Order Documents',
        zone: 'Restricted',
        description: 'MongoDB for order documents',
        technology: 'MongoDB',
        protocols: ['TLS'],
        securityControls: ['Field Level Encryption', 'RBAC'],
        dataClassification: 'Sensitive'
      }
    } as SecurityNode,
    {
      id: 'event-stream',
      type: 'dfdDataStore',
      position: { x: 2560, y: 650 },
      data: {
        label: 'Event Stream',
        storeType: 'Kafka Event Streaming Platform',
        zone: 'Restricted',
        description: 'Kafka event streaming platform',
        technology: 'Apache Kafka',
        protocols: ['TLS', 'SASL'],
        securityControls: ['Topic ACLs', 'Message Encryption'],
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'secret-store',
      type: 'dfdDataStore',
      position: { x: 2560, y: 850 },
      data: {
        label: 'Secret Manager',
        storeType: 'HashiCorp Vault Secrets',
        zone: 'Restricted',
        description: 'HashiCorp Vault for secrets management',
        technology: 'HashiCorp Vault',
        protocols: ['HTTPS'],
        securityControls: ['Dynamic Secrets', 'Audit Logging', 'MFA'],
        dataClassification: 'Confidential'
      }
    } as SecurityNode
  ],
  edges: [
    // External to Gateway
    {
      id: 'e1',
      source: 'mobile-apps',
      target: 'api-gateway',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Mobile API Calls',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        securityLevel: 'High',
        dataClassification: 'Public',
        zone: 'DMZ',
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e2',
      source: 'web-spa',
      target: 'api-gateway',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Web API Calls',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        securityLevel: 'High',
        dataClassification: 'Public',
        zone: 'DMZ',
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e3',
      source: 'partner-api',
      target: 'api-gateway',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Partner Integration',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3 + API Key',
        securityLevel: 'High',
        dataClassification: 'Internal',
        zone: 'DMZ',
        animated: true
      }
    } as SecurityEdge,

    // Gateway to Services
    {
      id: 'e4',
      source: 'api-gateway',
      target: 'user-service',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'User Requests',
        protocol: 'gRPC',
        encryption: 'mTLS',
        securityLevel: 'High',
        dataClassification: 'Internal',
        zone: 'Production',
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e5',
      source: 'api-gateway',
      target: 'order-service',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Order Requests',
        protocol: 'gRPC',
        encryption: 'mTLS',
        securityLevel: 'High',
        dataClassification: 'Sensitive',
        zone: 'Production',
        animated: true
      }
    } as SecurityEdge,

    // Service to Service
    {
      id: 'e6',
      source: 'order-service',
      target: 'inventory-service',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Inventory Check',
        protocol: 'gRPC',
        encryption: 'mTLS',
        securityLevel: 'Medium',
        dataClassification: 'Internal',
        zone: 'Production',
        animated: false
      }
    } as SecurityEdge,
    {
      id: 'e7',
      source: 'order-service',
      target: 'notification-service',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Order Events',
        protocol: 'AMQP',
        encryption: 'TLS',
        securityLevel: 'Medium',
        dataClassification: 'Internal',
        zone: 'Production',
        animated: true
      }
    } as SecurityEdge,

    // Service to Data Store
    {
      id: 'e8',
      source: 'user-service',
      target: 'user-db',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'User Data Access',
        protocol: 'PostgreSQL',
        encryption: 'TLS',
        securityLevel: 'High',
        dataClassification: 'Sensitive',
        zone: 'Restricted',
        animated: false
      }
    } as SecurityEdge,
    {
      id: 'e9',
      source: 'order-service',
      target: 'order-db',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Order Data Access',
        protocol: 'MongoDB Wire',
        encryption: 'TLS',
        securityLevel: 'High',
        dataClassification: 'Sensitive',
        zone: 'Restricted',
        animated: false
      }
    } as SecurityEdge,
    {
      id: 'e10',
      source: 'inventory-service',
      target: 'event-stream',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Inventory Events',
        protocol: 'Kafka',
        encryption: 'TLS + SASL',
        securityLevel: 'Medium',
        dataClassification: 'Internal',
        zone: 'Restricted',
        animated: true
      }
    } as SecurityEdge,

    // Secret Access
    {
      id: 'e11',
      source: 'user-service',
      target: 'secret-store',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'left',
      data: {
        label: 'Secret Retrieval',
        protocol: 'HTTPS',
        encryption: 'TLS + Token',
        securityLevel: 'Critical',
        dataClassification: 'Confidential',
        zone: 'Restricted',
        animated: false
      }
    } as SecurityEdge
  ],
  attackPaths: [
    {
      id: 'ap-dfd-ms-partner-injection',
      name: 'Partner API → API Gateway → Order Service → Order DB (SQL Injection)',
      strideCategory: 'Tampering',
      riskLevel: 'High',
      description: 'Malicious partner sends crafted API requests through the gateway to the order service, exploiting insufficient input validation to perform SQL injection against the order database.',
      steps: [
        { order: 1, edgeId: 'e3', sourceNodeId: 'partner-api', targetNodeId: 'api-gateway', technique: 'T1190: Exploit Public-Facing Application' },
        { order: 2, edgeId: 'e5', sourceNodeId: 'api-gateway', targetNodeId: 'order-service', technique: 'T1059: Command and Scripting Interpreter' },
        { order: 3, edgeId: 'e9', sourceNodeId: 'order-service', targetNodeId: 'order-db', technique: 'T1505: SQL Injection' },
      ],
      mitreTechniques: ['T1190', 'T1059', 'T1505'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-dfd-ms-secret-exfil',
      name: 'User Service → Secret Store → Credential Theft → User DB Exfiltration',
      strideCategory: 'Information Disclosure',
      riskLevel: 'High',
      description: 'Compromised user service abuses its access to the secret store to extract database credentials, then exfiltrates user PII from the user database.',
      steps: [
        { order: 1, edgeId: 'e4', sourceNodeId: 'api-gateway', targetNodeId: 'user-service', technique: 'T1190: Exploit Public-Facing Application' },
        { order: 2, edgeId: 'e11', sourceNodeId: 'user-service', targetNodeId: 'secret-store', technique: 'T1552: Unsecured Credentials' },
        { order: 3, edgeId: 'e8', sourceNodeId: 'user-service', targetNodeId: 'user-db', technique: 'T1005: Data from Local System' },
      ],
      mitreTechniques: ['T1190', 'T1552', 'T1005'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-dfd-ms-event-poison',
      name: 'Inventory Service → Event Stream Poisoning → Downstream Impact',
      strideCategory: 'Tampering',
      riskLevel: 'Medium',
      description: 'Attacker compromises the inventory service and publishes malicious events to the event stream, affecting all downstream consumers.',
      steps: [
        { order: 1, edgeId: 'e6', sourceNodeId: 'order-service', targetNodeId: 'inventory-service', technique: 'T1021: Remote Services' },
        { order: 2, edgeId: 'e10', sourceNodeId: 'inventory-service', targetNodeId: 'event-stream', technique: 'T1565: Data Manipulation' },
      ],
      mitreTechniques: ['T1021', 'T1565'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
  ],
  grcWorkspace: buildGrcWorkspace({
    tierCatalogue: [
      { id: 'dfdms-t1-cyber', tier: 1 as const, label: 'Cyber Risk', description: 'Microservices security threats' },
      { id: 'dfdms-t1-ops', tier: 1 as const, label: 'Operational Risk', description: 'Service reliability and data integrity' },
      { id: 'dfdms-t2-api', tier: 2 as const, label: 'API Security', parentId: 'dfdms-t1-cyber', description: 'API gateway and partner access threats' },
      { id: 'dfdms-t2-data', tier: 2 as const, label: 'Data Protection', parentId: 'dfdms-t1-cyber', description: 'Database and event stream security' },
      { id: 'dfdms-t2-secrets', tier: 2 as const, label: 'Secret Management', parentId: 'dfdms-t1-cyber', description: 'Credential and secret store threats' },
      { id: 'dfdms-t3-injection', tier: 3 as const, label: 'Injection Attacks', parentId: 'dfdms-t2-api' },
      { id: 'dfdms-t3-secret-leak', tier: 3 as const, label: 'Secret Leakage', parentId: 'dfdms-t2-secrets' },
      { id: 'dfdms-t3-event-poison', tier: 3 as const, label: 'Event Stream Poisoning', parentId: 'dfdms-t2-data' },
    ],
    assets: [
      { id: 'dfdms-asset-gw', name: 'API Gateway', type: 'api_gateway', owner: 'Platform Team', criticality: 5, linkedNodeIds: ['api-gateway'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'dfdms-asset-userdb', name: 'User Database', type: 'database', owner: 'DBA Team', criticality: 5, linkedNodeIds: ['user-db'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'dfdms-asset-orderdb', name: 'Order Database', type: 'database', owner: 'DBA Team', criticality: 5, linkedNodeIds: ['order-db'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'dfdms-asset-secrets', name: 'Secret Store', type: 'secret_manager', owner: 'Security Team', criticality: 5, linkedNodeIds: ['secret-store'], status: 'active', createdAt: NOW, updatedAt: NOW },
    ],
    risks: [
      { id: 'dfdms-risk-sqli', title: 'SQL Injection via Partner API', description: 'Insufficient input validation on partner-facing endpoints allows SQL injection.', tierId: 'dfdms-t3-injection', linkedAssetIds: ['dfdms-asset-orderdb', 'dfdms-asset-gw'], likelihood: 'likelihood-3', impact: 'impact-5', currentScore: score('likelihood-3', 'impact-5'), status: 'open', owner: 'Dev Team', createdAt: NOW, updatedAt: NOW },
      { id: 'dfdms-risk-secrets', title: 'Secret Store Credential Theft', description: 'Compromised service could extract credentials from secret store.', tierId: 'dfdms-t3-secret-leak', linkedAssetIds: ['dfdms-asset-secrets', 'dfdms-asset-userdb'], likelihood: 'likelihood-2', impact: 'impact-5', currentScore: score('likelihood-2', 'impact-5'), status: 'open', owner: 'Security Team', createdAt: NOW, updatedAt: NOW },
      { id: 'dfdms-risk-events', title: 'Event Stream Poisoning', description: 'Malicious events injected into the stream could corrupt downstream data.', tierId: 'dfdms-t3-event-poison', linkedAssetIds: ['dfdms-asset-orderdb'], likelihood: 'likelihood-2', impact: 'impact-4', currentScore: score('likelihood-2', 'impact-4'), status: 'open', owner: 'Platform Team', createdAt: NOW, updatedAt: NOW },
    ],
    assessments: [
      { id: 'dfdms-assess-1', title: 'Microservices DFD Threat Assessment', scope: 'Full microservices data flow', status: 'in_progress', createdBy: 'Security Team', createdAt: NOW, updatedAt: NOW, threatModel: { nodeFindings: [{ nodeId: 'order-service', findingIds: ['dfdms-risk-sqli'] }, { nodeId: 'secret-store', findingIds: ['dfdms-risk-secrets'] }, { nodeId: 'event-stream', findingIds: ['dfdms-risk-events'] }], edgeFindings: [{ edgeId: 'e9', findingIds: ['dfdms-risk-sqli'] }, { edgeId: 'e11', findingIds: ['dfdms-risk-secrets'] }] } },
    ],
    soaEntries: [
      { id: 'dfdms-soa-1', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'ctrl-a03', status: 'partially_implemented', justification: 'Input validation on internal services but partner API needs hardening.', linkedRiskIds: ['dfdms-risk-sqli'], implementationNotes: 'Add parameterized queries and API schema validation.', owner: 'Dev Team', createdAt: NOW, updatedAt: NOW },
      { id: 'dfdms-soa-2', controlSetId: CIS_CONTROL_SET_ID, controlId: 'cis-ctrl-06', status: 'implemented', justification: 'Secret store with role-based access per service.', linkedRiskIds: ['dfdms-risk-secrets'], implementationNotes: 'Audit secret access patterns and add anomaly detection.', owner: 'Security Team', createdAt: NOW, updatedAt: NOW },
      { id: 'dfdms-soa-3', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'ctrl-a08', status: 'partially_implemented', justification: 'Event schema validation but no integrity checks.', linkedRiskIds: ['dfdms-risk-events'], implementationNotes: 'Add cryptographic event signing.', owner: 'Platform Team', createdAt: NOW, updatedAt: NOW },
    ],
    thirdParties: [
      {
        id: 'dfdms-tp-hashicorp',
        name: 'HashiCorp Inc.',
        description: 'SaaS provider of HashiCorp Vault for centralized secrets management, dynamic credential generation, and encryption-as-a-service. Vault manages database credentials, API keys, and TLS certificates for all microservices.',
        category: 'saas',
        status: 'active',
        riskRating: 'critical',
        dataClassification: 'restricted',
        linkedAssetIds: ['dfdms-asset-secrets', 'dfdms-asset-userdb', 'dfdms-asset-orderdb'],
        linkedRiskIds: ['dfdms-risk-secrets'],
        contactName: 'Nathan Brooks',
        contactEmail: 'nathan.brooks@hashicorp.example.com',
        contractExpiry: '2026-12-31',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-09-30',
        notes: 'HCP Vault Enterprise with auto-unseal and HSM-backed encryption. Dynamic database credentials rotate every 1 hour for user and order databases. AppRole authentication for each microservice with unique role IDs. Audit logging enabled and exported to internal SIEM. Critical vendor — compromise of Vault would expose credentials for all backend services. DR replication configured across two regions.'
      },
      {
        id: 'dfdms-tp-confluent',
        name: 'Confluent Inc.',
        description: 'SaaS provider of managed Apache Kafka event streaming platform. Handles inter-service event routing, order processing events, and asynchronous communication between microservices with guaranteed delivery.',
        category: 'saas',
        status: 'active',
        riskRating: 'high',
        dataClassification: 'confidential',
        linkedAssetIds: ['dfdms-asset-orderdb', 'dfdms-asset-gw'],
        linkedRiskIds: ['dfdms-risk-events'],
        contactName: 'Diana Fernandez',
        contactEmail: 'diana.fernandez@confluent.example.com',
        contractExpiry: '2027-01-31',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-10-31',
        notes: 'Confluent Cloud Enterprise with dedicated clusters and PrivateLink connectivity. Schema Registry enforces Avro schema validation on all topics but does not yet include cryptographic message signing — event stream poisoning risk remains. ACLs restrict topic access per service identity. Kafka Connect integrations audited quarterly. Consumer lag monitoring alerts configured for anomaly detection.'
      },
      {
        id: 'dfdms-tp-aws',
        name: 'Amazon Web Services (AWS)',
        description: 'Cloud infrastructure provider hosting the microservices platform on EKS (Kubernetes), RDS for PostgreSQL databases, and VPC networking with private subnets. Provides compute, storage, and network foundation.',
        category: 'cloud_provider',
        status: 'active',
        riskRating: 'high',
        dataClassification: 'confidential',
        linkedAssetIds: ['dfdms-asset-gw', 'dfdms-asset-userdb', 'dfdms-asset-orderdb'],
        linkedRiskIds: ['dfdms-risk-sqli'],
        contactName: 'AWS Enterprise Support',
        contactEmail: 'enterprise-support@aws.example.com',
        contractExpiry: '2027-03-31',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-12-31',
        notes: 'EKS cluster with Calico network policies for pod-to-pod isolation. RDS PostgreSQL with encryption at rest and automated backups. API Gateway via AWS ALB with WAF rules. VPC flow logs enabled and forwarded to SIEM. Security groups follow least-privilege model. GuardDuty enabled for runtime threat detection on EKS workloads.'
      },
    ],
  } as any),
};