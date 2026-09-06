import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityNode, SecurityEdge, SecurityZone } from '../../types/SecurityTypes';
import { colors } from '../../styles/Theme';
import { DiagramAttackPath } from '../../types/GrcTypes';
import { buildGrcWorkspace, score, NOW, OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID } from './grcSharedBase';

export const microSecureSystem: ExampleSystem = {
  id: 'micro-secure-system',
  name: 'Microservices Service Mesh Architecture',
  description: 'Modern service mesh architecture with sidecar proxies, observability, and zero-trust networking',
  category: 'Secure Systems',
  // securityLevel removed - no longer part of the system model
  primaryZone: 'ServiceMesh',
  dataClassification: 'Sensitive',
  customContext: `# Microservices Service Mesh Architecture

## System Overview
This system represents a modern microservices architecture leveraging service mesh technology for a financial services platform. The platform processes millions of transactions daily with zero-trust security principles throughout.

## Business Context
- **Industry**: Financial Technology
- **Scale**: 10M+ active users, 500K daily transactions
- **Availability**: 99.99% SLA (4.38 minutes downtime per month)
- **Compliance**: PCI DSS Level 1, SOC 2 Type II, ISO 27001

## Architecture Philosophy
- **Zero Trust**: No implicit trust, all communication authenticated and authorized
- **Service Mesh**: Istio-based with Envoy sidecars for all services
- **Observability**: Full distributed tracing, metrics, and logging
- **GitOps**: All configurations managed through version control

## Technology Stack
- **Service Mesh**: Istio 1.19 with Envoy proxies
- **Container Platform**: Kubernetes 1.28 on AWS EKS
- **Languages**: Go (70%), Python (20%), Node.js (10%)
- **Databases**: PostgreSQL, MongoDB, Redis
- **Observability**: Prometheus, Grafana, Jaeger, ELK stack

## Security Architecture
- **mTLS Everywhere**: All service-to-service communication encrypted
- **Policy as Code**: OPA for fine-grained authorization
- **Secret Management**: HashiCorp Vault with dynamic secrets
- **Network Policies**: Calico CNI with micro-segmentation

## Service Categories
1. **Core Services**: User, Account, Transaction processing
2. **Support Services**: Notification, Analytics, Reporting
3. **Infrastructure**: Service discovery, Configuration, Observability
4. **Security**: Authentication, Authorization, Audit

## Operational Practices
- **Deployment**: Blue-green deployments with automatic rollback
- **Scaling**: HPA and VPA for automatic resource management
- **Chaos Engineering**: Regular failure injection testing
- **Incident Response**: PagerDuty integration with runbooks

## Current Challenges
- **Service Proliferation**: 200+ microservices creating management overhead
- **Data Consistency**: Distributed transactions across services
- **Debugging Complexity**: Tracing issues across multiple services
- **Resource Usage**: Sidecar proxies consuming significant resources

## Performance Metrics
- **P99 Latency**: 250ms for API calls
- **Throughput**: 50K requests per second
- **Error Rate**: < 0.01%
- **MTTR**: 15 minutes average

## Security Posture
- **Last Security Audit**: 60 days ago
- **Open Vulnerabilities**: 3 medium, 12 low
- **Compliance Status**: All certifications current
- **Security Training**: Quarterly for all developers`,
  nodes: [
    // Security Zones
    {
      id: 'internet-zone',
      type: 'securityZone',
      position: { x: 50, y: 50 },
      data: {
        label: 'Internet Zone',
        zoneType: 'Internet' as SecurityZone,
        description: 'Public internet access',
        zone: 'External' as SecurityZone
      },
      style: {
        width: 650,
        height: 1000,
        background: colors.zoneBackgrounds.Internet,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'external-zone',
      type: 'securityZone',
      position: { x: 820, y: 50 },
      data: {
        label: 'External Zone',
        zoneType: 'External' as SecurityZone,
        description: 'Edge services and gateways'
      },
      style: {
        width: 650,
        height: 1000,
        background: colors.zoneBackgrounds.External,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'dmz-zone',
      type: 'securityZone',
      position: { x: 1590, y: 50 },
      data: {
        label: 'DMZ Zone',
        zoneType: 'DMZ' as SecurityZone,
        description: 'API gateway and authentication'
      },
      style: {
        width: 650,
        height: 1000,
        background: colors.zoneBackgrounds.DMZ,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'service-mesh-zone',
      type: 'securityZone',
      position: { x: 2260, y: 50 },
      data: {
        label: 'Service Mesh Zone',
        zoneType: 'ServiceMesh' as SecurityZone,
        description: 'Core microservices with sidecars'
      },
      style: {
        width: 650,
        height: 1000,
        background: colors.zoneBackgrounds.ServiceMesh,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'data-plane-zone',
      type: 'securityZone',
      position: { x: 3130, y: 50 },
      data: {
        label: 'Data Plane Zone',
        zoneType: 'DataPlane' as SecurityZone,
        description: 'Databases and state management'
      },
      style: {
        width: 650,
        height: 1000,
        background: colors.zoneBackgrounds.DataPlane,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'control-plane-zone',
      type: 'securityZone',
      position: { x: 2110, y: -1070 },
      data: {
        label: 'Control Plane Zone',
        zoneType: 'ControlPlane' as SecurityZone,
        description: 'Service mesh control and observability'
      },
      style: {
        width: 650,
        height: 1000,
        background: colors.zoneBackgrounds.ControlPlane,
        zIndex: -1
      }
    } as SecurityNode,

    // Internet Zone Components
    {
      id: 'external-clients',
      type: 'endpoint',
      position: { x: 225, y: 325 },
      data: {
        label: 'External Clients',
        description: 'Mobile and web applications',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        protocols: ['HTTPS'],
        technology: 'React, iOS, Android',
        vendor: 'various',
        product: 'client-apps',
        version: 'various'
      }
    } as SecurityNode,

    // External Zone Components
    {
      id: 'edge-proxy',
      type: 'reverseProxy',
      position: { x: 875, y: 325 },
      data: {
        label: 'Edge Proxy',
        description: 'Ingress gateway for service mesh',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'mTLS'],
        vendor: 'envoyproxy',
        product: 'envoy',
        version: '1.27',
        securityControls: ['TLS 1.3', 'mTLS', 'Rate Limiting', 'WAF']
      }
    } as SecurityNode,
    {
      id: 'oauth-server',
      type: 'authServer',
      position: { x: 1125, y: 175 },
      data: {
        label: 'OAuth2 Server',
        description: 'Identity and access management',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'OIDC', 'SAML'],
        vendor: 'keycloak',
        product: 'keycloak',
        version: '22.0',
        securityControls: ['MFA', 'Adaptive Auth', 'Session Management'],
        additionalContext: 'Token expiry set to 24 hours for user convenience, refresh tokens valid for 30 days'
      }
    } as SecurityNode,

    // DMZ Zone Components
    {
      id: 'api-gateway',
      type: 'apiGateway',
      position: { x: 1675, y: 325 },
      data: {
        label: 'API Gateway',
        description: 'Service mesh ingress gateway',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'gRPC', 'WebSocket'],
        vendor: 'istio',
        product: 'gateway',
        version: '1.19',
        securityControls: ['Rate Limiting', 'JWT Validation', 'CORS']
      }
    } as SecurityNode,
    {
      id: 'rate-limiter',
      type: 'apiSecurity',
      position: { x: 1925, y: 175 },
      data: {
        label: 'Rate Limiter',
        description: 'API rate limiting service',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['Redis Protocol'],
        vendor: 'redis',
        product: 'redis',
        version: '7.2',
        additionalContext: 'Rate limits configured per IP, some APIs exempt for partner integrations'
      }
    } as SecurityNode,
    {
      id: 'waf',
      type: 'waf',
      position: { x: 2125, y: 675 },
      data: {
        label: 'Web Application Firewall',
        description: 'ModSecurity-based WAF',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTP', 'HTTPS'],
        vendor: 'modsecurity',
        product: 'modsecurity',
        version: '3.0',
        securityControls: ['OWASP CRS', 'Custom Rules', 'Anomaly Scoring']
      }
    } as SecurityNode,

    // Service Mesh Zone Components
    {
      id: 'user-service',
      type: 'service',
      position: { x: 2425, y: 225 },
      data: {
        label: 'User Service',
        description: 'User management microservice',
        zone: 'ServiceMesh' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['gRPC', 'mTLS'],
        vendor: 'custom',
        product: 'user-service',
        version: '2.3.0',
        technology: 'Go',
        components: [
          { name: 'Envoy Sidecar', version: '1.27' },
          { name: 'Service Container', version: '2.3.0' }
        ]
      }
    } as SecurityNode,
    {
      id: 'account-service',
      type: 'service',
      position: { x: 2675, y: 275 },
      data: {
        label: 'Account Service',
        description: 'Account management microservice',
        zone: 'ServiceMesh' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['gRPC', 'mTLS'],
        vendor: 'custom',
        product: 'account-service',
        version: '1.8.5',
        technology: 'Go',
        additionalContext: 'Handles financial account data, connects to legacy banking systems'
      }
    } as SecurityNode,
    {
      id: 'transaction-service',
      type: 'service',
      position: { x: 2425, y: 425 },
      data: {
        label: 'Transaction Service',
        description: 'Payment processing microservice',
        zone: 'ServiceMesh' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['gRPC', 'mTLS'],
        vendor: 'custom',
        product: 'transaction-service',
        version: '3.1.2',
        technology: 'Go',
        securityControls: ['Idempotency', 'Distributed Locking', 'Audit Logging']
      }
    } as SecurityNode,
    {
      id: 'notification-service',
      type: 'service',
      position: { x: 2775, y: 575 },
      data: {
        label: 'Notification Service',
        description: 'Multi-channel notifications',
        zone: 'ServiceMesh' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['gRPC', 'mTLS'],
        vendor: 'custom',
        product: 'notification-service',
        version: '1.5.0',
        technology: 'Python',
        additionalContext: 'Stores notification templates with user PII, connects to external SMS/email providers'
      }
    } as SecurityNode,
    {
      id: 'analytics-service',
      type: 'service',
      position: { x: 2525, y: 875 },
      data: {
        label: 'Analytics Service',
        description: 'Real-time analytics processing',
        zone: 'ServiceMesh' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['gRPC', 'mTLS'],
        vendor: 'custom',
        product: 'analytics-service',
        version: '2.0.3',
        technology: 'Python',
        components: [
          { name: 'Spark Streaming', version: '3.4' },
          { name: 'Kafka Connect', version: '3.5' }
        ]
      }
    } as SecurityNode,
    {
      id: 'message-broker',
      type: 'messageBroker',
      position: { x: 2975, y: 925 },
      data: {
        label: 'Event Bus',
        description: 'Kafka event streaming platform',
        zone: 'ServiceMesh' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['Kafka Protocol', 'mTLS'],
        vendor: 'apache',
        product: 'kafka',
        version: '3.5',
        securityControls: ['SASL/SCRAM', 'ACLs', 'Encryption at Rest']
      }
    } as SecurityNode,

    // Data Plane Zone Components
    {
      id: 'primary-db',
      type: 'database',
      position: { x: 3425, y: 325 },
      data: {
        label: 'Primary Database',
        description: 'Main PostgreSQL cluster',
        zone: 'DataPlane' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['PostgreSQL', 'SSL'],
        vendor: 'postgres',
        product: 'postgresql',
        version: '15.4',
        securityControls: ['TDE', 'Row Level Security', 'Audit Logging']
      }
    } as SecurityNode,
    {
      id: 'cache-layer',
      type: 'cache',
      position: { x: 3525, y: 125 },
      data: {
        label: 'Distributed Cache',
        description: 'Redis cluster for caching',
        zone: 'DataPlane' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['Redis Protocol', 'TLS'],
        vendor: 'redis',
        product: 'redis-enterprise',
        version: '7.2',
        additionalContext: 'Caches user sessions and frequently accessed data, eviction policy set to allkeys-lru'
      }
    } as SecurityNode,
    {
      id: 'document-store',
      type: 'database',
      position: { x: 3375, y: 475 },
      data: {
        label: 'Document Store',
        description: 'MongoDB for unstructured data',
        zone: 'DataPlane' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['MongoDB Wire', 'TLS'],
        vendor: 'mongodb',
        product: 'mongodb',
        version: '7.0',
        securityControls: ['Field Encryption', 'RBAC', 'Audit Logging']
      }
    } as SecurityNode,
    {
      id: 'object-storage',
      type: 'storageAccount',
      position: { x: 3525, y: 625 },
      data: {
        label: 'Object Storage',
        description: 'S3-compatible object store',
        zone: 'DataPlane' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['S3 API', 'HTTPS'],
        vendor: 'minio',
        product: 'minio',
        version: 'latest',
        securityControls: ['Bucket Policies', 'Encryption', 'Versioning']
      }
    } as SecurityNode,

    // Control Plane Zone Components
    {
      id: 'istio-control',
      type: 'meshProxy',
      position: { x: 2475, y: -725 },
      data: {
        label: 'Istio Control Plane',
        description: 'Service mesh control plane',
        zone: 'ControlPlane' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['gRPC', 'mTLS'],
        vendor: 'istio',
        product: 'istiod',
        version: '1.19',
        securityControls: ['RBAC', 'Policy Enforcement', 'mTLS Management']
      }
    } as SecurityNode,
    {
      id: 'prometheus',
      type: 'monitor',
      position: { x: 2275, y: -775 },
      data: {
        label: 'Prometheus',
        description: 'Metrics collection and storage',
        zone: 'ControlPlane' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTP', 'HTTPS'],
        vendor: 'prometheus',
        product: 'prometheus',
        version: '2.47',
        securityControls: ['TLS', 'Authentication', 'Query Restrictions']
      }
    } as SecurityNode,
    {
      id: 'grafana',
      type: 'monitor',
      position: { x: 2275, y: -975 },
      data: {
        label: 'Grafana',
        description: 'Metrics visualization',
        zone: 'ControlPlane' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS'],
        vendor: 'grafana',
        product: 'grafana',
        version: '10.2',
        securityControls: ['RBAC', 'SSO', 'Audit Logging']
      }
    } as SecurityNode,
    {
      id: 'jaeger',
      type: 'monitor',
      position: { x: 2825, y: -475 },
      data: {
        label: 'Jaeger',
        description: 'Distributed tracing',
        zone: 'ControlPlane' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['gRPC', 'HTTPS'],
        vendor: 'jaegertracing',
        product: 'jaeger',
        version: '1.50',
        additionalContext: 'Traces contain request paths and timing data, retention set to 7 days'
      }
    } as SecurityNode,
    {
      id: 'vault',
      type: 'secretsManager',
      position: { x: 2575, y: -525 },
      data: {
        label: 'HashiCorp Vault',
        description: 'Secrets management',
        zone: 'ControlPlane' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS'],
        vendor: 'hashicorp',
        product: 'vault',
        version: '1.15',
        securityControls: ['HSM Backend', 'Dynamic Secrets', 'Audit Logging']
      }
    } as SecurityNode
  ],
  edges: [
    // External connections
    {
      id: 'e1',
      source: 'external-clients',
      target: 'edge-proxy',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'HTTPS Traffic',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        animated: true
      ,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e2',
      source: 'edge-proxy',
      target: 'oauth-server',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'left',
      data: {
        label: 'Auth Redirect',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      ,
        zone: 'External' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e3',
      source: 'edge-proxy',
      target: 'api-gateway',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Authenticated Requests',
        protocol: 'HTTPS',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: true
      ,
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,

    // DMZ connections
    {
      id: 'e4',
      source: 'api-gateway',
      target: 'rate-limiter',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'left',
      data: {
        label: 'Rate Check',
        protocol: 'Redis',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      ,
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e5',
      source: 'api-gateway',
      target: 'waf',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'WAF Inspection',
        protocol: 'HTTP',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      ,
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,

    // Service mesh connections
    {
      id: 'e6',
      source: 'api-gateway',
      target: 'user-service',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'User APIs',
        protocol: 'gRPC',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: true
      ,
        zone: 'ServiceMesh' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e7',
      source: 'api-gateway',
      target: 'account-service',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Account APIs',
        protocol: 'gRPC',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true
      ,
        zone: 'ServiceMesh' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e8',
      source: 'user-service',
      target: 'transaction-service',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'User Transactions',
        protocol: 'gRPC',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      ,
        zone: 'ServiceMesh' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e9',
      source: 'account-service',
      target: 'transaction-service',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Account Transactions',
        protocol: 'gRPC',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      ,
        zone: 'ServiceMesh' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e10',
      source: 'transaction-service',
      target: 'notification-service',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Transaction Alerts',
        protocol: 'gRPC',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive'
      ,
        zone: 'ServiceMesh' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e11',
      source: 'transaction-service',
      target: 'analytics-service',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Analytics Events',
        protocol: 'gRPC',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive'
      ,
        zone: 'ServiceMesh' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e12',
      source: 'analytics-service',
      target: 'message-broker',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Event Stream',
        protocol: 'Kafka',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: true
      ,
        zone: 'ServiceMesh' as SecurityZone
      }
    } as SecurityEdge,

    // Data plane connections
    {
      id: 'e13',
      source: 'user-service',
      target: 'primary-db',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        controlPoints: [{ id: 'cp-1771655571752', x: 3350, y: 250, active: true }],
        label: 'User Data',
        protocol: 'PostgreSQL',
        encryption: 'SSL',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true
      ,
        zone: 'DataPlane' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e14',
      source: 'account-service',
      target: 'primary-db',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Account Data',
        protocol: 'PostgreSQL',
        encryption: 'SSL',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true
      ,
        zone: 'DataPlane' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e15',
      source: 'transaction-service',
      target: 'primary-db',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        controlPoints: [{ id: 'cp-1771655558190', x: 3350, y: 450, active: true }],
        label: 'Transaction Data',
        protocol: 'PostgreSQL',
        encryption: 'SSL',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true
      ,
        zone: 'DataPlane' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e16',
      source: 'user-service',
      target: 'cache-layer',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        controlPoints: [{ id: 'cp-1771655582087', x: 2550, y: 150, active: true }],
        label: 'Session Cache',
        protocol: 'Redis',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive'
      ,
        zone: 'DataPlane' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e17',
      source: 'notification-service',
      target: 'document-store',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Templates',
        protocol: 'MongoDB',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive'
      ,
        zone: 'DataPlane' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e18',
      source: 'analytics-service',
      target: 'object-storage',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Reports',
        protocol: 'S3',
        encryption: 'HTTPS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive'
      ,
        zone: 'DataPlane' as SecurityZone
      }
    } as SecurityEdge,

    // Control plane connections
    {
      id: 'e19',
      source: 'user-service',
      target: 'istio-control',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        controlPoints: [
          { id: 'cp-1771655714495', x: 2400, y: 0, active: true },
          { id: 'cp-1771655708481', x: 2400, y: -700, active: true }
        ],
        label: 'Service Discovery',
        protocol: 'gRPC',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      ,
        zone: 'ControlPlane' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e20',
      source: 'account-service',
      target: 'istio-control',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        controlPoints: [
          { id: 'cp-1771655669790', x: 2550, y: 100, active: true },
          { id: 'cp-1771655681749', x: 2550, y: -600, active: true }
        ],
        label: 'Config Updates',
        protocol: 'gRPC',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      ,
        zone: 'ControlPlane' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e21',
      source: 'transaction-service',
      target: 'prometheus',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        controlPoints: [{ id: 'cp-1771655593363', x: 2300, y: 450, active: true }],
        label: 'Metrics',
        protocol: 'HTTP',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      ,
        zone: 'ControlPlane' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e22',
      source: 'prometheus',
      target: 'grafana',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Query',
        protocol: 'HTTP',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      ,
        zone: 'ControlPlane' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e23',
      source: 'analytics-service',
      target: 'jaeger',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Traces',
        protocol: 'gRPC',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      ,
        zone: 'ControlPlane' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e24',
      source: 'vault',
      target: 'user-service',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        controlPoints: [
          { id: 'cp-1771655697431', x: 2600, y: 0, active: true },
          { id: 'cp-1771655692152', x: 2500, y: 0, active: true }
        ],
        label: 'Secrets',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      ,
        zone: 'ControlPlane' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e25',
      source: 'vault',
      target: 'account-service',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        controlPoints: [
          { id: 'cp-1771655647297', x: 2750, y: -500, active: true },
          { id: 'cp-1771655639359', x: 2750, y: 100, active: true }
        ],
        label: 'DB Creds',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      ,
        zone: 'ControlPlane' as SecurityZone
      }
    } as SecurityEdge
  ],
  attackPaths: [
    {
      id: 'ap-ms-oauth-token-theft',
      name: 'External Client → Edge Proxy → Stolen OAuth Token → Transaction Service',
      strideCategory: 'Spoofing',
      riskLevel: 'High',
      description: 'Attacker steals OAuth tokens via a compromised client application, replays them through the edge proxy to reach the API gateway, and processes fraudulent transactions through the transaction service.',
      steps: [
        { order: 1, edgeId: 'e1', sourceNodeId: 'external-clients', targetNodeId: 'edge-proxy', technique: 'T1528: Steal Application Access Token' },
        { order: 2, edgeId: 'e3', sourceNodeId: 'edge-proxy', targetNodeId: 'api-gateway', technique: 'T1550: Use Alternate Authentication Material' },
        { order: 3, edgeId: 'e7', sourceNodeId: 'api-gateway', targetNodeId: 'account-service', technique: 'T1078: Valid Accounts' },
        { order: 4, edgeId: 'e9', sourceNodeId: 'account-service', targetNodeId: 'transaction-service', technique: 'T1565: Data Manipulation' },
      ],
      mitreTechniques: ['T1528', 'T1550', 'T1078', 'T1565'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-ms-vault-secret-exfil',
      name: 'Compromised Service → Vault Credential Theft → Database Exfiltration',
      strideCategory: 'Information Disclosure',
      riskLevel: 'Medium',
      description: 'Attacker compromises the user service container, leverages its Vault integration to extract dynamic database credentials, and exfiltrates data from the primary database.',
      steps: [
        { order: 1, edgeId: 'e6', sourceNodeId: 'api-gateway', targetNodeId: 'user-service', technique: 'T1190: Exploit Public-Facing Application' },
        { order: 2, edgeId: 'e24', sourceNodeId: 'vault', targetNodeId: 'user-service', technique: 'T1552: Unsecured Credentials' },
        { order: 3, edgeId: 'e13', sourceNodeId: 'user-service', targetNodeId: 'primary-db', technique: 'T1005: Data from Local System' },
      ],
      mitreTechniques: ['T1190', 'T1552', 'T1005'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-ms-lateral-movement',
      name: 'User Service → Message Broker → Analytics Lateral Movement',
      strideCategory: 'Elevation of Privilege',
      riskLevel: 'Medium',
      description: 'After compromising the user service, attacker moves laterally through the transaction service to the analytics service and message broker, gaining access to historical financial data in object storage.',
      steps: [
        { order: 1, edgeId: 'e8', sourceNodeId: 'user-service', targetNodeId: 'transaction-service', technique: 'T1021: Remote Services' },
        { order: 2, edgeId: 'e11', sourceNodeId: 'transaction-service', targetNodeId: 'analytics-service', technique: 'T1570: Lateral Tool Transfer' },
        { order: 3, edgeId: 'e18', sourceNodeId: 'analytics-service', targetNodeId: 'object-storage', technique: 'T1530: Data from Cloud Storage Object' },
      ],
      mitreTechniques: ['T1021', 'T1570', 'T1530'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
  ],
  grcWorkspace: buildGrcWorkspace({
    tierCatalogue: [
      { id: 'ms-t1-cyber', tier: 1 as const, label: 'Cyber Risk', description: 'Information security threats to fintech platform' },
      { id: 'ms-t1-ops', tier: 1 as const, label: 'Operational Risk', description: 'Service availability and reliability' },
      { id: 'ms-t1-compliance', tier: 1 as const, label: 'Compliance Risk', description: 'PCI DSS and SOC 2 compliance' },
      { id: 'ms-t2-identity', tier: 2 as const, label: 'Identity & Authentication', parentId: 'ms-t1-cyber', description: 'OAuth and service mesh identity' },
      { id: 'ms-t2-data', tier: 2 as const, label: 'Data Protection', parentId: 'ms-t1-cyber', description: 'Transaction and PII data' },
      { id: 'ms-t2-mesh', tier: 2 as const, label: 'Service Mesh Security', parentId: 'ms-t1-cyber', description: 'Istio and sidecar proxy threats' },
      { id: 'ms-t2-pci', tier: 2 as const, label: 'PCI DSS', parentId: 'ms-t1-compliance', description: 'Payment card processing requirements' },
      { id: 'ms-t3-token-theft', tier: 3 as const, label: 'Token Theft & Replay', parentId: 'ms-t2-identity' },
      { id: 'ms-t3-secret-exposure', tier: 3 as const, label: 'Secret Exposure', parentId: 'ms-t2-data' },
      { id: 'ms-t3-lateral-move', tier: 3 as const, label: 'Lateral Movement', parentId: 'ms-t2-mesh' },
    ],
    assets: [
      { id: 'ms-asset-txn', name: 'Transaction Processing Service', type: 'application', owner: 'Platform Team', criticality: 5, linkedNodeIds: ['transaction-service'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'ms-asset-db', name: 'Primary PostgreSQL Database', type: 'database', owner: 'DBA Team', criticality: 5, linkedNodeIds: ['primary-db'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'ms-asset-vault', name: 'HashiCorp Vault', type: 'secret_manager', owner: 'Security Team', criticality: 5, linkedNodeIds: ['vault'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'ms-asset-gateway', name: 'API Gateway', type: 'api_gateway', owner: 'Platform Team', criticality: 4, linkedNodeIds: ['api-gateway'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'ms-asset-oauth', name: 'OAuth Authorization Server', type: 'auth_server', owner: 'Security Team', criticality: 5, linkedNodeIds: ['oauth-server'], status: 'active', createdAt: NOW, updatedAt: NOW },
    ],
    risks: [
      { id: 'ms-risk-token', title: 'OAuth Token Theft and Replay', description: 'Stolen OAuth tokens can be replayed to access transaction services.', tierId: 'ms-t3-token-theft', linkedAssetIds: ['ms-asset-oauth', 'ms-asset-txn'], likelihood: 'likelihood-3', impact: 'impact-5', currentScore: score('likelihood-3', 'impact-5'), status: 'open', owner: 'Security Team', createdAt: NOW, updatedAt: NOW },
      { id: 'ms-risk-vault-leak', title: 'Vault Credential Exfiltration', description: 'Compromised service could abuse its Vault role to extract database credentials.', tierId: 'ms-t3-secret-exposure', linkedAssetIds: ['ms-asset-vault', 'ms-asset-db'], likelihood: 'likelihood-2', impact: 'impact-5', currentScore: score('likelihood-2', 'impact-5'), status: 'open', owner: 'Security Team', createdAt: NOW, updatedAt: NOW },
      { id: 'ms-risk-lateral', title: 'Service Mesh Lateral Movement', description: 'Istio policies may allow unexpected service-to-service communication paths.', tierId: 'ms-t3-lateral-move', linkedAssetIds: ['ms-asset-txn', 'ms-asset-gateway'], likelihood: 'likelihood-2', impact: 'impact-4', currentScore: score('likelihood-2', 'impact-4'), status: 'open', owner: 'Platform Team', createdAt: NOW, updatedAt: NOW },
    ],
    assessments: [
      { id: 'ms-assess-1', title: 'Service Mesh Security Assessment', scope: 'Full microservices architecture', status: 'in_progress', createdBy: 'Security Team', createdAt: NOW, updatedAt: NOW, threatModel: { nodeFindings: [{ nodeId: 'oauth-server', findingIds: ['ms-risk-token'] }, { nodeId: 'vault', findingIds: ['ms-risk-vault-leak'] }, { nodeId: 'transaction-service', findingIds: ['ms-risk-lateral'] }], edgeFindings: [{ edgeId: 'e2', findingIds: ['ms-risk-token'] }, { edgeId: 'e24', findingIds: ['ms-risk-vault-leak'] }] } },
    ],
    soaEntries: [
      { id: 'ms-soa-1', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'ctrl-a07', status: 'implemented', justification: 'OAuth 2.0 with short-lived tokens and refresh rotation.', linkedRiskIds: ['ms-risk-token'], implementationNotes: 'Add token binding to prevent replay attacks.', owner: 'Security Team', createdAt: NOW, updatedAt: NOW },
      { id: 'ms-soa-2', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'ctrl-a02', status: 'implemented', justification: 'mTLS via Istio for all service communication.', linkedRiskIds: ['ms-risk-lateral'], implementationNotes: 'Review Istio authorization policies quarterly.', owner: 'Platform Team', createdAt: NOW, updatedAt: NOW },
      { id: 'ms-soa-3', controlSetId: CIS_CONTROL_SET_ID, controlId: 'cis-ctrl-06', status: 'implemented', justification: 'Vault with dynamic secrets and short TTL.', linkedRiskIds: ['ms-risk-vault-leak'], implementationNotes: 'Ensure least-privilege Vault policies per service.', owner: 'Security Team', createdAt: NOW, updatedAt: NOW },
      { id: 'ms-soa-4', controlSetId: CIS_CONTROL_SET_ID, controlId: 'cis-ctrl-08', status: 'implemented', justification: 'Prometheus metrics, Jaeger tracing, Grafana dashboards.', linkedRiskIds: ['ms-risk-token', 'ms-risk-lateral'], implementationNotes: 'Add anomaly detection alerting.', owner: 'Platform Team', createdAt: NOW, updatedAt: NOW },
    ],
    thirdParties: [
      {
        id: 'ms-tp-hashicorp',
        name: 'HashiCorp',
        description: 'Provider of Vault for secrets management with dynamic secrets, HSM backend, and audit logging. Central to the service mesh security architecture.',
        category: 'saas',
        status: 'active',
        riskRating: 'critical',
        dataClassification: 'confidential',
        linkedAssetIds: ['ms-asset-vault'],
        linkedRiskIds: ['ms-risk-vault-leak'],
        contactName: 'HashiCorp Enterprise Support',
        contactEmail: 'enterprise@hashicorp.example.com',
        contractExpiry: '2027-04-30',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-08-01',
        notes: 'Vault Enterprise with HSM auto-unseal. Dynamic secrets TTL set to 1 hour. Audit logging forwarded to SIEM. Review least-privilege policies per service role.'
      },
      {
        id: 'ms-tp-aws',
        name: 'Amazon Web Services (AWS)',
        description: 'Cloud infrastructure provider hosting EKS clusters, RDS PostgreSQL, and ElastiCache Redis. Runs all production workloads across 3 availability zones.',
        category: 'cloud_provider',
        status: 'active',
        riskRating: 'medium',
        dataClassification: 'confidential',
        linkedAssetIds: ['ms-asset-db', 'ms-asset-gateway'],
        linkedRiskIds: ['ms-risk-lateral'],
        contactName: 'AWS Enterprise Support',
        contactEmail: 'enterprise-support@aws.example.com',
        contractExpiry: '2027-06-30',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-09-15',
        notes: 'SOC 2 Type II and PCI DSS certified. EKS 1.28 with Calico CNI for micro-segmentation. Review VPC security group rules quarterly.'
      },
      {
        id: 'ms-tp-confluent',
        name: 'Confluent',
        description: 'Managed Kafka event streaming platform for inter-service communication. Handles all asynchronous messaging including transaction events and analytics pipelines.',
        category: 'saas',
        status: 'active',
        riskRating: 'medium',
        dataClassification: 'confidential',
        linkedAssetIds: ['ms-asset-txn'],
        linkedRiskIds: ['ms-risk-lateral'],
        contactName: 'Confluent Support',
        contactEmail: 'support@confluent.example.com',
        contractExpiry: '2027-02-28',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-08-15',
        notes: 'Confluent Cloud with SASL/SCRAM authentication and topic-level ACLs. Encryption at rest and in transit enabled. Monitor for topic permission drift.'
      },
    ],
  } as any),
};