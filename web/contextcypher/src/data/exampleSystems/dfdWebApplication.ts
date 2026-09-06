import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityNode, SecurityEdge, SecurityZone, DataClassification } from '../../types/SecurityTypes';
import { colors } from '../../styles/Theme';
import { DiagramAttackPath } from '../../types/GrcTypes';
import { buildGrcWorkspace, score, NOW, OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID } from './grcSharedBase';

export const dfdWebApplication: ExampleSystem = {
  id: 'dfd-web-application',
  name: 'DFD: E-Commerce Web Application',
  description: 'Basic DFD threat model for a typical web application with external users, API, and database',
  category: 'DFD Threat Models',
  primaryZone: 'DMZ',
  dataClassification: 'Sensitive',
  customContext: `
## DFD Web Application Threat Model

This represents a typical e-commerce web application using DFD notation for STRIDE threat modeling.

### System Overview
- External users access the system through a web browser
- API Gateway handles all incoming requests
- Web application processes business logic
- Database stores customer and order data
- Payment service is an external third-party integration

### Key Data Flows
1. User authentication and session management
2. Product browsing and search
3. Order processing and payment
4. User profile and order history

### Security Considerations
- All external communications use HTTPS
- API Gateway implements rate limiting
- Database connections use connection pooling
- Payment data follows PCI DSS requirements
- Session tokens expire after 30 minutes of inactivity
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
        description: 'Public internet and external users'
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
        description: 'Demilitarized zone for public-facing services'
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
      position: { x: 1490, y: 50 },
      data: {
        label: 'Internal Zone',
        zoneType: 'Internal',
        description: 'Protected internal network'
      },
      style: {
        width: 800,
        height: 1000,
        background: colors.zoneBackgrounds.Internal,
        zIndex: -1
      }
    } as SecurityNode,

    // DFD Nodes
    {
      id: 'web-users',
      type: 'dfdActor',
      position: { x: 250, y: 300 },
      data: {
        label: 'Web Users',
        actorType: 'End Users',
        zone: 'External',
        description: 'External customers accessing the e-commerce platform',
        protocols: ['HTTPS'],
        dataClassification: 'Public'
      }
    } as SecurityNode,
    {
      id: 'mobile-users',
      type: 'dfdActor',
      position: { x: 250, y: 500 },
      data: {
        label: 'Mobile App Users',
        actorType: 'Mobile Application Users',
        zone: 'External',
        description: 'Customers using the mobile application',
        protocols: ['HTTPS'],
        dataClassification: 'Public'
      }
    } as SecurityNode,
    {
      id: 'payment-provider',
      type: 'dfdActor',
      position: { x: 250, y: 700 },
      data: {
        label: 'Payment Provider',
        actorType: 'Payment Processing Service',
        zone: 'External',
        description: 'Third-party payment processing service (Stripe/PayPal)',
        protocols: ['HTTPS'],
        dataClassification: 'Sensitive'
      }
    } as SecurityNode,
    {
      id: 'trust-boundary-1',
      type: 'dfdTrustBoundary',
      position: { x: 670, y: 200 },
      data: {
        label: 'Internet Boundary',
        boundaryType: 'Public Internet Firewall',
        description: 'Trust boundary between external internet and DMZ',
        zone: 'DMZ'
      }
    } as SecurityNode,
    {
      id: 'api-gateway',
      type: 'dfdProcess',
      position: { x: 970, y: 400 },
      data: {
        label: 'API Gateway',
        processType: 'API Gateway Service',
        zone: 'DMZ',
        description: 'Central entry point for all API requests with rate limiting and authentication',
        technology: 'Kong Gateway',
        protocols: ['HTTPS', 'REST'],
        securityControls: ['Rate Limiting', 'API Key Validation', 'OAuth 2.0'],
        dataClassification: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'web-app',
      type: 'dfdProcess',
      position: { x: 1690, y: 300 },
      data: {
        label: 'Web Application',
        processType: 'E-Commerce Application Server',
        zone: 'Internal',
        description: 'Main e-commerce application handling business logic',
        technology: 'Node.js Express',
        protocols: ['HTTPS'],
        securityControls: ['Input Validation', 'Session Management', 'CSRF Protection'],
        dataClassification: 'Sensitive'
      }
    } as SecurityNode,
    {
      id: 'order-service',
      type: 'dfdProcess',
      position: { x: 1690, y: 500 },
      data: {
        label: 'Order Processing Service',
        processType: 'Order Management Service',
        zone: 'Internal',
        description: 'Handles order creation, validation, and fulfillment',
        technology: 'Python FastAPI',
        protocols: ['gRPC'],
        securityControls: ['Transaction Logging', 'Idempotency'],
        dataClassification: 'Sensitive'
      }
    } as SecurityNode,
    {
      id: 'trust-boundary-2',
      type: 'dfdTrustBoundary',
      position: { x: 1390, y: 200 },
      data: {
        label: 'DMZ-Internal Boundary',
        boundaryType: 'DMZ to Internal Network Boundary',
        description: 'Trust boundary between DMZ and internal network',
        zone: 'Internal'
      }
    } as SecurityNode,
    {
      id: 'customer-db',
      type: 'dfdDataStore',
      position: { x: 1890, y: 350 },
      data: {
        label: 'Customer Database',
        storeType: 'Customer Profile Database',
        zone: 'Internal',
        description: 'PostgreSQL database storing customer profiles and authentication data',
        technology: 'PostgreSQL 14',
        protocols: ['TLS'],
        securityControls: ['Encryption at Rest', 'Row Level Security', 'Audit Logging'],
        dataClassification: 'Sensitive'
      }
    } as SecurityNode,
    {
      id: 'order-db',
      type: 'dfdDataStore',
      position: { x: 1890, y: 550 },
      data: {
        label: 'Order Database',
        storeType: 'Order Transaction Database',
        zone: 'Internal',
        description: 'Database storing order history and transaction data',
        technology: 'PostgreSQL 14',
        protocols: ['TLS'],
        securityControls: ['Encryption at Rest', 'Backup Encryption', 'Point-in-Time Recovery'],
        dataClassification: 'Sensitive'
      }
    } as SecurityNode,
    {
      id: 'session-cache',
      type: 'dfdDataStore',
      position: { x: 1890, y: 750 },
      data: {
        label: 'Session Cache',
        storeType: 'Session Management Cache',
        zone: 'Internal',
        description: 'Redis cache for session management',
        technology: 'Redis 7',
        protocols: ['TLS'],
        securityControls: ['TTL Expiration', 'Access Control Lists'],
        dataClassification: 'Internal'
      }
    } as SecurityNode
  ],
  edges: [
    // User flows
    {
      id: 'e1',
      source: 'web-users',
      target: 'api-gateway',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Web Requests',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        dataClassification: 'Public',
        zone: 'DMZ',
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e2',
      source: 'mobile-users',
      target: 'api-gateway',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Mobile API Calls',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        dataClassification: 'Public',
        zone: 'DMZ',
        animated: true
      }
    } as SecurityEdge,
    // API to internal services
    {
      id: 'e3',
      source: 'api-gateway',
      target: 'web-app',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Authenticated Requests',
        protocol: 'HTTPS',
        encryption: 'mTLS',
        dataClassification: 'Internal',
        zone: 'Internal',
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e4',
      source: 'api-gateway',
      target: 'order-service',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Order API Calls',
        protocol: 'gRPC',
        encryption: 'mTLS',
        dataClassification: 'Sensitive',
        zone: 'Internal',
        animated: true
      }
    } as SecurityEdge,
    // Database connections
    {
      id: 'e5',
      source: 'web-app',
      target: 'customer-db',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Customer Queries',
        protocol: 'PostgreSQL',
        encryption: 'TLS',
        dataClassification: 'Sensitive',
        zone: 'Internal',
        animated: false
      }
    } as SecurityEdge,
    {
      id: 'e6',
      source: 'order-service',
      target: 'order-db',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Order Data',
        protocol: 'PostgreSQL',
        encryption: 'TLS',
        dataClassification: 'Sensitive',
        zone: 'Internal',
        animated: false
      }
    } as SecurityEdge,
    {
      id: 'e7',
      source: 'web-app',
      target: 'session-cache',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Session Management',
        protocol: 'Redis Protocol',
        encryption: 'TLS',
        dataClassification: 'Internal',
        zone: 'Internal',
        animated: true
      }
    } as SecurityEdge,
    // Payment flow
    {
      id: 'e8',
      source: 'order-service',
      target: 'payment-provider',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Payment Processing',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        dataClassification: 'Sensitive',
        zone: 'DMZ',
        animated: true
      }
    } as SecurityEdge
  ],
  attackPaths: [
    {
      id: 'ap-dfd-web-sqli',
      name: 'Web User → API Gateway → Web App → Customer DB (SQL Injection)',
      strideCategory: 'Tampering',
      riskLevel: 'High',
      description: 'Attacker crafts malicious input through the API gateway that bypasses input validation in the web application, achieving SQL injection against the customer database to extract PII.',
      steps: [
        { order: 1, edgeId: 'e1', sourceNodeId: 'web-users', targetNodeId: 'api-gateway', technique: 'T1190: Exploit Public-Facing Application' },
        { order: 2, edgeId: 'e3', sourceNodeId: 'api-gateway', targetNodeId: 'web-app', technique: 'T1059: Command and Scripting Interpreter' },
        { order: 3, edgeId: 'e5', sourceNodeId: 'web-app', targetNodeId: 'customer-db', technique: 'T1505: SQL Injection' },
      ],
      mitreTechniques: ['T1190', 'T1059', 'T1505'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-dfd-web-payment-intercept',
      name: 'Mobile User → API Gateway → Order Service → Payment Provider Fraud',
      strideCategory: 'Information Disclosure',
      riskLevel: 'High',
      description: 'Attacker exploits the mobile API to manipulate order data flowing through the order service, intercepting or modifying payment details sent to the external payment provider.',
      steps: [
        { order: 1, edgeId: 'e2', sourceNodeId: 'mobile-users', targetNodeId: 'api-gateway', technique: 'T1557: Adversary-in-the-Middle' },
        { order: 2, edgeId: 'e4', sourceNodeId: 'api-gateway', targetNodeId: 'order-service', technique: 'T1565: Data Manipulation' },
        { order: 3, edgeId: 'e8', sourceNodeId: 'order-service', targetNodeId: 'payment-provider', technique: 'T1530: Data from Cloud Storage Object' },
      ],
      mitreTechniques: ['T1557', 'T1565', 'T1530'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-dfd-web-session-hijack',
      name: 'Credential Stuffing → Session Cache Poisoning → Account Takeover',
      strideCategory: 'Spoofing',
      riskLevel: 'Medium',
      description: 'Attacker performs credential stuffing through the API gateway, then leverages the session cache to maintain persistence and escalate access across the web application.',
      steps: [
        { order: 1, edgeId: 'e1', sourceNodeId: 'web-users', targetNodeId: 'api-gateway', technique: 'T1110: Brute Force (Credential Stuffing)' },
        { order: 2, edgeId: 'e3', sourceNodeId: 'api-gateway', targetNodeId: 'web-app', technique: 'T1078: Valid Accounts' },
        { order: 3, edgeId: 'e7', sourceNodeId: 'web-app', targetNodeId: 'session-cache', technique: 'T1550: Use Alternate Authentication Material' },
      ],
      mitreTechniques: ['T1110', 'T1078', 'T1550'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
  ],
  grcWorkspace: buildGrcWorkspace({
    tierCatalogue: [
      { id: 'dfd-t1-cyber', tier: 1 as const, label: 'Cyber Risk', description: 'Information security threats' },
      { id: 'dfd-t1-compliance', tier: 1 as const, label: 'Compliance Risk', description: 'Regulatory and PCI DSS compliance' },
      { id: 'dfd-t2-app', tier: 2 as const, label: 'Application Security', parentId: 'dfd-t1-cyber', description: 'Web application threats' },
      { id: 'dfd-t2-data', tier: 2 as const, label: 'Data Protection', parentId: 'dfd-t1-cyber', description: 'Data at rest and in transit' },
      { id: 'dfd-t2-identity', tier: 2 as const, label: 'Identity & Access', parentId: 'dfd-t1-cyber', description: 'Authentication and session threats' },
      { id: 'dfd-t2-pci', tier: 2 as const, label: 'PCI DSS', parentId: 'dfd-t1-compliance', description: 'Payment card industry compliance' },
      { id: 'dfd-t3-injection', tier: 3 as const, label: 'Injection Attacks', parentId: 'dfd-t2-app' },
      { id: 'dfd-t3-session', tier: 3 as const, label: 'Session Management', parentId: 'dfd-t2-identity' },
      { id: 'dfd-t3-payment-fraud', tier: 3 as const, label: 'Payment Fraud', parentId: 'dfd-t2-pci' },
    ],
    assets: [
      { id: 'dfd-asset-api', name: 'API Gateway (Kong)', type: 'api_gateway', owner: 'Platform Team', criticality: 4, linkedNodeIds: ['api-gateway'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'dfd-asset-webapp', name: 'E-Commerce Web Application', type: 'application', owner: 'Dev Team', criticality: 4, linkedNodeIds: ['web-app'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'dfd-asset-orderdb', name: 'Order Transaction Database', type: 'database', owner: 'DBA Team', criticality: 5, linkedNodeIds: ['order-db'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'dfd-asset-custdb', name: 'Customer Profile Database', type: 'database', owner: 'DBA Team', criticality: 5, linkedNodeIds: ['customer-db'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'dfd-asset-sessions', name: 'Redis Session Cache', type: 'cache', owner: 'Platform Team', criticality: 3, linkedNodeIds: ['session-cache'], status: 'active', createdAt: NOW, updatedAt: NOW },
    ],
    risks: [
      { id: 'dfd-risk-sqli', title: 'SQL Injection Against Customer Database', description: 'Insufficient input validation could allow SQL injection extracting PII from customer database.', tierId: 'dfd-t3-injection', linkedAssetIds: ['dfd-asset-custdb', 'dfd-asset-webapp'], likelihood: 'likelihood-3', impact: 'impact-5', currentScore: score('likelihood-3', 'impact-5'), status: 'open', owner: 'Dev Team', createdAt: NOW, updatedAt: NOW },
      { id: 'dfd-risk-payment', title: 'Payment Data Interception', description: 'Order manipulation could redirect or intercept payment processing requests.', tierId: 'dfd-t3-payment-fraud', linkedAssetIds: ['dfd-asset-orderdb'], likelihood: 'likelihood-2', impact: 'impact-5', currentScore: score('likelihood-2', 'impact-5'), status: 'open', owner: 'Dev Team', createdAt: NOW, updatedAt: NOW },
      { id: 'dfd-risk-session', title: 'Session Hijacking via Cache Poisoning', description: 'Weak session management allows credential stuffing and session reuse.', tierId: 'dfd-t3-session', linkedAssetIds: ['dfd-asset-sessions', 'dfd-asset-webapp'], likelihood: 'likelihood-3', impact: 'impact-4', currentScore: score('likelihood-3', 'impact-4'), status: 'open', owner: 'Platform Team', createdAt: NOW, updatedAt: NOW },
      { id: 'dfd-risk-api-abuse', title: 'API Gateway Rate Limit Bypass', description: 'Distributed attacks could bypass rate limiting to overwhelm backend services.', tierId: 'dfd-t3-injection', linkedAssetIds: ['dfd-asset-api'], likelihood: 'likelihood-3', impact: 'impact-3', currentScore: score('likelihood-3', 'impact-3'), status: 'open', owner: 'Platform Team', createdAt: NOW, updatedAt: NOW },
    ],
    assessments: [
      { id: 'dfd-assess-1', title: 'E-Commerce DFD Threat Assessment', scope: 'Full application data flow', status: 'in_progress', createdBy: 'Security Team', createdAt: NOW, updatedAt: NOW, threatModel: { nodeFindings: [{ nodeId: 'web-app', findingIds: ['dfd-risk-sqli'] }, { nodeId: 'order-service', findingIds: ['dfd-risk-payment'] }, { nodeId: 'session-cache', findingIds: ['dfd-risk-session'] }], edgeFindings: [{ edgeId: 'e5', findingIds: ['dfd-risk-sqli'] }, { edgeId: 'e8', findingIds: ['dfd-risk-payment'] }] } },
    ],
    soaEntries: [
      { id: 'dfd-soa-1', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'ctrl-a03', status: 'partially_implemented', justification: 'Input validation present but needs hardening.', linkedRiskIds: ['dfd-risk-sqli'], implementationNotes: 'Upgrade to parameterized queries in all data access layers.', owner: 'Dev Team', createdAt: NOW, updatedAt: NOW },
      { id: 'dfd-soa-2', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'ctrl-a07', status: 'implemented', justification: 'OAuth 2.0 with session expiration.', linkedRiskIds: ['dfd-risk-session'], implementationNotes: 'Add anomaly detection for session reuse patterns.', owner: 'Platform Team', createdAt: NOW, updatedAt: NOW },
      { id: 'dfd-soa-3', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'ctrl-a02', status: 'implemented', justification: 'TLS 1.3 for all external traffic, mTLS for internal.', linkedRiskIds: ['dfd-risk-payment'], implementationNotes: 'Maintain certificate rotation schedule.', owner: 'Platform Team', createdAt: NOW, updatedAt: NOW },
      { id: 'dfd-soa-4', controlSetId: CIS_CONTROL_SET_ID, controlId: 'cis-ctrl-08', status: 'partially_implemented', justification: 'Audit logging on databases but not on API gateway.', linkedRiskIds: ['dfd-risk-api-abuse'], implementationNotes: 'Enable comprehensive API gateway logging.', owner: 'Platform Team', createdAt: NOW, updatedAt: NOW },
    ],
    thirdParties: [
      {
        id: 'dfd-tp-stripe',
        name: 'Stripe Inc.',
        description: 'SaaS payment processing platform handling all customer credit card transactions, refunds, and subscription billing. PCI DSS Level 1 certified. Processes approximately 30,000 monthly transactions through the order service.',
        category: 'saas',
        status: 'active',
        riskRating: 'high',
        dataClassification: 'restricted',
        linkedAssetIds: ['dfd-asset-orderdb', 'dfd-asset-api'],
        linkedRiskIds: ['dfd-risk-payment', 'dfd-risk-sqli'],
        contactName: 'Maria Chen',
        contactEmail: 'maria.chen@stripe.example.com',
        contractExpiry: '2026-12-31',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-09-30',
        notes: 'PCI DSS Level 1 compliant. Payment intents API used — raw card data never touches our servers. Webhook signatures verified with HMAC-SHA256. API keys stored in environment variables and rotated quarterly. Stripe Radar enabled for fraud detection. Order manipulation risk exists upstream of Stripe integration — compromised order data could alter transaction amounts before reaching Stripe API.'
      },
      {
        id: 'dfd-tp-cloudflare',
        name: 'Cloudflare Inc.',
        description: 'Managed CDN and DDoS protection service providing edge caching, SSL/TLS termination, bot management, and rate limiting for the e-commerce web application frontend.',
        category: 'managed_service',
        status: 'active',
        riskRating: 'low',
        dataClassification: 'internal',
        linkedAssetIds: ['dfd-asset-webapp', 'dfd-asset-api'],
        linkedRiskIds: ['dfd-risk-api-abuse'],
        contactName: 'James Okafor',
        contactEmail: 'james.okafor@cloudflare.example.com',
        contractExpiry: '2026-11-30',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-08-31',
        notes: 'Business plan with WAF, DDoS protection, and bot management. SSL/TLS termination at edge with full strict mode to origin. Rate limiting rules configured but API gateway rate limit bypass risk means Cloudflare is the primary defense layer. Static assets cached at edge — no sensitive data in CDN cache. Orange-cloud proxy hides origin IP. Dedicated account manager for incident escalation.'
      },
      {
        id: 'dfd-tp-redis',
        name: 'Redis Ltd.',
        description: 'SaaS provider of managed Redis Enterprise Cloud used for session storage, cart caching, and API response caching. Handles all user session state with sub-millisecond latency.',
        category: 'saas',
        status: 'active',
        riskRating: 'medium',
        dataClassification: 'confidential',
        linkedAssetIds: ['dfd-asset-sessions', 'dfd-asset-webapp'],
        linkedRiskIds: ['dfd-risk-session'],
        contactName: 'Alex Petrov',
        contactEmail: 'alex.petrov@redis.example.com',
        contractExpiry: '2026-10-31',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-07-31',
        notes: 'Redis Enterprise Cloud with TLS in-transit encryption and encryption at rest. VPC peering configured for private connectivity. Session data includes user tokens and cart contents — classified as confidential. ACL-based access control per application service. Session TTL set to 30 minutes but credential stuffing and session reuse risk identified in last assessment. Persistence configured with AOF for session durability.'
      },
    ],
  } as any),
};