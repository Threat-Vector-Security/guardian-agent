import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityNode, SecurityEdge, SecurityZone } from '../../types/SecurityTypes';
import { colors } from '../../styles/Theme';
import { DiagramAttackPath } from '../../types/GrcTypes';
import { buildGrcWorkspace, score, NOW, OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID } from './grcSharedBase';

export const stressTestSystem: ExampleSystem = {
  id: 'stress-test-system',
  name: 'High-Density Stress Test System',
  description: 'Ultra-high scale e-commerce platform with maximum architectural complexity',
  category: 'Web Applications',
  // securityLevel removed - no longer part of the system model
  primaryZone: 'Internal',
  dataClassification: 'Confidential',
  customContext: `# High-Density Stress Test System

## System Overview
This represents an ultra-high scale e-commerce platform designed to handle Black Friday-level traffic continuously. The system demonstrates maximum architectural complexity with multiple layers of redundancy, caching, and distribution.

## Scale Metrics
- **Peak Traffic**: 10 million concurrent users
- **Transactions**: 500,000 orders per minute at peak
- **API Calls**: 50 billion per day across all services
- **Data Volume**: 100TB daily data ingestion
- **Service Count**: 200+ microservices in production

## Architecture Complexity
- **Multi-Region**: Active-active across 6 global regions
- **Multi-Cloud**: Distributed across AWS, Azure, and GCP
- **Service Mesh**: Full mesh with 100% sidecar coverage
- **Languages**: 12 different programming languages in use
- **Databases**: 15 different database technologies

## Performance Requirements
- **Response Time**: p50 < 20ms, p99 < 100ms globally
- **Availability**: 99.999% uptime (5 minutes downtime/year)
- **RTO**: 30 seconds for regional failover
- **RPO**: Zero data loss with synchronous replication
- **Throughput**: 1 million requests per second sustained

## Security Measures
- **Zero Trust**: Every request authenticated and authorized
- **Encryption**: TLS 1.3 everywhere, including internal traffic
- **WAF**: Machine learning-based WAF with custom rules
- **DDoS**: Multi-layer DDoS protection up to 10Tbps
- **Compliance**: PCI DSS Level 1, SOC 2, ISO 27001, GDPR

## Operational Complexity
- **Deployments**: 1000+ deployments per day
- **Monitoring**: 50 million metrics per second
- **Logs**: 500TB of logs per day
- **Alerts**: 100,000 alerts per day (99% auto-resolved)
- **Engineers**: 500 platform engineers, 100 SREs

## Technology Diversity
- **Container Orchestration**: Kubernetes, Nomad, ECS
- **Service Mesh**: Istio, Linkerd, Consul Connect
- **Databases**: PostgreSQL, MySQL, MongoDB, Cassandra, Redis, DynamoDB, Neo4j, InfluxDB
- **Message Queues**: Kafka, RabbitMQ, SQS, Pub/Sub, EventHub
- **Analytics**: Spark, Flink, Databricks, BigQuery, Snowflake

## Cost Optimization
- **Spot Instances**: 60% of compute on spot/preemptible
- **Reserved Capacity**: 30% reserved instances
- **Auto-scaling**: Aggressive scale-down during off-peak
- **Multi-Cloud Arbitrage**: Workload placement based on cost
- **Data Lifecycle**: Automated archival and deletion policies

## Incident History
- **Last Year**: 15 customer-impacting incidents (5 minutes average)
- **MTTR**: 8 minutes average resolution time
- **Root Causes**: 40% configuration, 30% capacity, 20% code, 10% external
- **Post-Mortems**: Blameless culture with public RCAs

## Technical Debt
- **Legacy Services**: 20 services still on deprecated frameworks
- **Database Versions**: Mix of database versions across environments
- **Monitoring Gaps**: Some services lack proper instrumentation
- **Documentation**: Only 60% of services have up-to-date docs
- **Test Coverage**: Average 75% coverage, some services at 40%

## Innovation Initiatives
- **AI Operations**: ML-driven capacity planning and anomaly detection
- **Quantum-Ready**: Preparing cryptography for quantum computing
- **Edge Computing**: Moving compute closer to users
- **Blockchain**: Exploring blockchain for supply chain
- **5G Integration**: Optimizing for 5G network characteristics

## Challenges at Scale
- **Thundering Herd**: Cache stampedes during flash sales
- **Data Consistency**: Eventual consistency across regions
- **Service Discovery**: Managing 10,000+ service endpoints
- **Certificate Management**: 100,000+ certificates to rotate
- **Dependency Hell**: Average service has 50 dependencies`,
  nodes: [
    // Security Zones
    {
      id: 'internet-zone',
      type: 'securityZone',
      position: { x: 50, y: 50 },
      data: {
        label: 'Internet Zone',
        zoneType: 'Internet' as SecurityZone,
        description: 'Global traffic sources',
        zone: 'External' as SecurityZone
      },
      style: {
        width: 800,
        height: 1000,
        background: colors.zoneBackgrounds.Internet,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'external-zone',
      type: 'securityZone',
      position: { x: 970, y: 50 },
      data: {
        label: 'External Zone',
        zoneType: 'External' as SecurityZone,
        description: 'Edge services and ingress'
      },
      style: {
        width: 800,
        height: 1000,
        background: colors.zoneBackgrounds.External,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'dmz-zone',
      type: 'securityZone',
      position: { x: 1890, y: 50 },
      data: {
        label: 'DMZ Zone',
        zoneType: 'DMZ' as SecurityZone,
        description: 'Service mesh and orchestration'
      },
      style: {
        width: 950,
        height: 1000,
        background: colors.zoneBackgrounds.DMZ,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'internal-zone',
      type: 'securityZone',
      position: { x: 2960, y: 50 },
      data: {
        label: 'Internal Zone',
        zoneType: 'Internal' as SecurityZone,
        description: 'Microservices layer'
      },
      style: {
        width: 950,
        height: 1000,
        background: colors.zoneBackgrounds.Internal,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'trusted-zone',
      type: 'securityZone',
      position: { x: 4030, y: 50 },
      data: {
        label: 'Trusted Zone',
        zoneType: 'Trusted' as SecurityZone,
        description: 'Data persistence layer'
      },
      style: {
        width: 950,
        height: 1000,
        background: colors.zoneBackgrounds.Trusted,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'cloud-zone',
      type: 'securityZone',
      position: { x: 2960, y: -1070 },
      data: {
        label: 'Cloud Zone',
        zoneType: 'Cloud' as SecurityZone,
        description: 'Multi-cloud services'
      },
      style: {
        width: 900,
        height: 1000,
        background: colors.zoneBackgrounds.Cloud,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'compliance-zone',
      type: 'securityZone',
      position: { x: 5100, y: 50 },
      data: {
        label: 'Compliance Zone',
        zoneType: 'Compliance' as SecurityZone,
        description: 'Monitoring and compliance'
      },
      style: {
        width: 900,
        height: 1000,
        background: colors.zoneBackgrounds.Compliance,
        zIndex: -1
      }
    } as SecurityNode,

    // Internet Zone Components
    {
      id: 'global-users',
      type: 'endpoint',
      position: { x: 150, y: 200 },
      data: {
        label: 'Global User Base',
        description: 'Millions of concurrent users',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        protocols: ['HTTPS', 'HTTP/2', 'WebSocket'],
        technology: 'Web, Mobile, IoT',
        vendor: 'various',
        product: 'mixed-clients',
        version: 'various'
      }
    } as SecurityNode,
    {
      id: 'bot-traffic',
      type: 'endpoint',
      position: { x: 400, y: 350 },
      data: {
        label: 'Bot Traffic',
        description: 'Automated systems and crawlers',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        protocols: ['HTTP', 'HTTPS'],
        technology: 'Search Bots, Scrapers, APIs',
        additionalContext: 'Mix of legitimate crawlers and potential scrapers, some bypassing robots.txt'
      }
    } as SecurityNode,
    {
      id: 'ddos-sources',
      type: 'endpoint',
      position: { x: 250, y: 500 },
      data: {
        label: 'DDoS Sources',
        description: 'Potential attack sources',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        protocols: ['Various'],
        technology: 'Botnets, Amplification, L7 Attacks'
      }
    } as SecurityNode,
    {
      id: 'cdn-pops',
      type: 'cloudService',
      position: { x: 150, y: 650 },
      data: {
        label: 'CDN PoPs',
        description: 'Global CDN presence',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        protocols: ['HTTPS', 'HTTP/3'],
        vendor: 'multiple',
        product: 'cdn',
        version: 'latest',
        technology: 'Anycast, Edge Computing, Cache'
      }
    } as SecurityNode,
    {
      id: 'partners',
      type: 'endpoint',
      position: { x: 400, y: 800 },
      data: {
        label: 'Partner Networks',
        description: 'B2B connections',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['VPN', 'HTTPS', 'EDI'],
        technology: 'VPN, API Gateway, EDI'
      }
    } as SecurityNode,

    // External Zone Components (zone x=970, delta=+150)
    {
      id: 'edge-lb-1',
      type: 'loadBalancer',
      position: { x: 1020, y: 200 },
      data: {
        label: 'Edge LB Cluster 1',
        description: 'Primary load balancer array',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'TCP'],
        vendor: 'f5',
        product: 'big-ip',
        version: '16.1',
        technology: '100Gbps, SSL Offload',
        compliance: ['PCI DSS']
      }
    } as SecurityNode,
    {
      id: 'edge-lb-2',
      type: 'loadBalancer',
      position: { x: 1270, y: 350 },
      data: {
        label: 'Edge LB Cluster 2',
        description: 'Secondary load balancer array',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'HTTP/3'],
        vendor: 'nginx',
        product: 'nginx-plus',
        version: '1.25',
        technology: 'HA Proxy, Geo-routing',
        compliance: ['PCI DSS']
      }
    } as SecurityNode,
    {
      id: 'waf-cluster',
      type: 'waf',
      position: { x: 1120, y: 500 },
      data: {
        label: 'WAF Cluster',
        description: 'Web application firewall array',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS'],
        vendor: 'imperva',
        product: 'securesphere',
        version: '14.5',
        technology: 'ModSecurity, ML-based',
        compliance: ['PCI DSS'],
        additionalContext: 'High false positive rate under load, some rules disabled during peak traffic'
      }
    } as SecurityNode,
    {
      id: 'api-gw-array',
      type: 'apiGateway',
      position: { x: 1370, y: 650 },
      data: {
        label: 'API Gateway Array',
        description: 'Distributed API management',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'GraphQL'],
        vendor: 'kong',
        product: 'enterprise',
        version: '3.4',
        technology: 'Apigee, Rate Limiting',
        compliance: ['SOC 2']
      }
    } as SecurityNode,
    {
      id: 'ddos-scrubbing',
      type: 'ddosProtection',
      position: { x: 1020, y: 800 },
      data: {
        label: 'DDoS Scrubbing Center',
        description: 'Attack mitigation',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['BGP', 'GRE'],
        vendor: 'arbor',
        product: 'arbor-cloud',
        version: 'latest',
        technology: 'Radware, BGP Flowspec'
      }
    } as SecurityNode,

    // DMZ Zone Components (zone x=1890, delta=+300)
    {
      id: 'ingress-1',
      type: 'kubernetesService',
      position: { x: 1940, y: 150 },
      data: {
        label: 'Ingress Controller 1',
        description: 'K8s ingress',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'gRPC'],
        vendor: 'istio',
        product: 'ingress',
        version: '1.19',
        technology: 'Envoy, mTLS'
      }
    } as SecurityNode,
    {
      id: 'ingress-2',
      type: 'kubernetesService',
      position: { x: 2190, y: 150 },
      data: {
        label: 'Ingress Controller 2',
        description: 'K8s ingress backup',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'HTTP/3'],
        vendor: 'traefik',
        product: 'traefik',
        version: '3.0',
        technology: "Let's Encrypt, HTTP/3"
      }
    } as SecurityNode,
    {
      id: 'service-mesh-1',
      type: 'meshProxy',
      position: { x: 2040, y: 300 },
      data: {
        label: 'Service Mesh East',
        description: 'East region mesh',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['gRPC', 'mTLS'],
        vendor: 'linkerd',
        product: 'linkerd',
        version: '2.14',
        technology: 'gRPC, Circuit Breaker'
      }
    } as SecurityNode,
    {
      id: 'service-mesh-2',
      type: 'meshProxy',
      position: { x: 2290, y: 300 },
      data: {
        label: 'Service Mesh West',
        description: 'West region mesh',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['mTLS'],
        vendor: 'hashicorp',
        product: 'consul-connect',
        version: '1.17',
        technology: 'Nomad, Vault'
      }
    } as SecurityNode,
    {
      id: 'cache-layer-1',
      type: 'cache',
      position: { x: 1940, y: 450 },
      data: {
        label: 'Cache Layer 1',
        description: 'Distributed cache',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['Redis Protocol'],
        vendor: 'redis',
        product: 'redis-cluster',
        version: '7.2',
        technology: 'Memcached, Hazelcast',
        additionalContext: 'Cache poisoning protection disabled for performance, some keys stored in plaintext'
      }
    } as SecurityNode,
    {
      id: 'cache-layer-2',
      type: 'cache',
      position: { x: 2190, y: 450 },
      data: {
        label: 'Cache Layer 2',
        description: 'Secondary cache',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTP', 'HTTPS'],
        vendor: 'varnish',
        product: 'varnish-cache',
        version: '7.4',
        technology: 'CDN Integration, ESI'
      }
    } as SecurityNode,
    {
      id: 'queue-cluster',
      type: 'messageBroker',
      position: { x: 2040, y: 600 },
      data: {
        label: 'Message Queue Cluster',
        description: 'Event streaming',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['Kafka', 'AMQP'],
        vendor: 'apache',
        product: 'kafka',
        version: '3.5',
        technology: 'RabbitMQ, Redis Streams'
      }
    } as SecurityNode,
    {
      id: 'service-registry',
      type: 'service',
      position: { x: 2290, y: 600 },
      data: {
        label: 'Service Registry',
        description: 'Service discovery',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTP', 'DNS'],
        vendor: 'hashicorp',
        product: 'consul',
        version: '1.17',
        technology: 'etcd, Zookeeper'
      }
    } as SecurityNode,
    {
      id: 'api-orchestrator',
      type: 'apiGateway',
      position: { x: 1940, y: 750 },
      data: {
        label: 'API Orchestrator',
        description: 'API composition',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['GraphQL', 'REST'],
        vendor: 'apollo',
        product: 'apollo-server',
        version: '4.9',
        technology: 'DataLoader'
      }
    } as SecurityNode,
    {
      id: 'event-bus',
      type: 'messageBroker',
      position: { x: 2190, y: 750 },
      data: {
        label: 'Event Bus',
        description: 'Event distribution',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['NATS', 'gRPC'],
        vendor: 'nats',
        product: 'nats-server',
        version: '2.10',
        technology: 'EventStore, Pulsar'
      }
    } as SecurityNode,
    {
      id: 'sidecar-injector',
      type: 'proxy',
      position: { x: 2390, y: 450 },
      data: {
        label: 'Sidecar Injector',
        description: 'Proxy injection',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['gRPC', 'mTLS'],
        vendor: 'envoyproxy',
        product: 'envoy',
        version: '1.27',
        technology: 'OPA, Jaeger'
      }
    } as SecurityNode,

    // Internal Zone (zone x=2960, delta=+600)
    {
      id: 'auth-svc',
      type: 'authServer',
      position: { x: 3010, y: 150 },
      data: {
        label: 'Auth Service',
        description: 'Authentication',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['OAuth2', 'OIDC'],
        vendor: 'custom',
        product: 'auth-service',
        version: '2.5',
        technology: 'WebAuthn',
        compliance: ['SOC 2']
      }
    } as SecurityNode,
    {
      id: 'user-svc',
      type: 'service',
      position: { x: 3160, y: 150 },
      data: {
        label: 'User Service',
        description: 'User management',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['REST', 'gRPC'],
        vendor: 'custom',
        product: 'user-service',
        version: '3.2',
        technology: 'Node.js, JWT',
        compliance: ['GDPR']
      }
    } as SecurityNode,
    {
      id: 'payment-svc',
      type: 'service',
      position: { x: 3310, y: 150 },
      data: {
        label: 'Payment Service',
        description: 'Payment processing',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'TLS'],
        vendor: 'custom',
        product: 'payment-service',
        version: '4.0',
        technology: 'Tokenization, 3DS',
        compliance: ['PCI DSS']
      }
    } as SecurityNode,
    {
      id: 'order-svc',
      type: 'service',
      position: { x: 3460, y: 150 },
      data: {
        label: 'Order Service',
        description: 'Order management',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['gRPC', 'REST'],
        vendor: 'custom',
        product: 'order-service',
        version: '5.1',
        technology: 'Java, Spring, Saga'
      }
    } as SecurityNode,
    {
      id: 'inventory-svc',
      type: 'service',
      position: { x: 3010, y: 300 },
      data: {
        label: 'Inventory Service',
        description: 'Stock management',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['gRPC'],
        vendor: 'custom',
        product: 'inventory-service',
        version: '2.8',
        technology: 'Python, FastAPI, CQRS'
      }
    } as SecurityNode,
    {
      id: 'shipping-svc',
      type: 'service',
      position: { x: 3160, y: 300 },
      data: {
        label: 'Shipping Service',
        description: 'Logistics',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['REST', 'gRPC'],
        vendor: 'custom',
        product: 'shipping-service',
        version: '1.9',
        technology: 'Go, gRPC, Tracking'
      }
    } as SecurityNode,
    {
      id: 'notification-svc',
      type: 'service',
      position: { x: 3310, y: 300 },
      data: {
        label: 'Notification Service',
        description: 'Communications',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['SMTP', 'HTTPS'],
        vendor: 'custom',
        product: 'notification-service',
        version: '3.3',
        technology: 'Email, SMS, Push'
      }
    } as SecurityNode,
    {
      id: 'analytics-svc',
      type: 'service',
      position: { x: 3460, y: 300 },
      data: {
        label: 'Analytics Service',
        description: 'Data analytics',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['REST', 'gRPC'],
        vendor: 'custom',
        product: 'analytics-service',
        version: '2.1',
        technology: 'Spark, ML, Reports'
      }
    } as SecurityNode,
    {
      id: 'search-svc',
      type: 'service',
      position: { x: 3010, y: 450 },
      data: {
        label: 'Search Service',
        description: 'Full-text search',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['REST', 'HTTP'],
        vendor: 'elasticsearch',
        product: 'elasticsearch',
        version: '8.11',
        technology: 'Solr, Algolia',
        additionalContext: 'Search indices contain PII, access controls not fully implemented'
      }
    } as SecurityNode,
    {
      id: 'recommendation-svc',
      type: 'aiModel',
      position: { x: 3160, y: 450 },
      data: {
        label: 'Recommendation Service',
        description: 'ML recommendations',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['gRPC', 'REST'],
        vendor: 'custom',
        product: 'recommendation-service',
        version: '1.5',
        technology: 'TensorFlow, Redis ML, A/B Test'
      }
    } as SecurityNode,
    {
      id: 'media-svc',
      type: 'service',
      position: { x: 3310, y: 450 },
      data: {
        label: 'Media Service',
        description: 'Image/video processing',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        protocols: ['HTTP', 'S3'],
        vendor: 'custom',
        product: 'media-service',
        version: '2.2',
        technology: 'FFmpeg, ImageMagick, S3'
      }
    } as SecurityNode,
    {
      id: 'batch-processor',
      type: 'service',
      position: { x: 3460, y: 450 },
      data: {
        label: 'Batch Processor',
        description: 'Batch jobs',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTP', 'gRPC'],
        vendor: 'apache',
        product: 'airflow',
        version: '2.7',
        technology: 'Celery, Cron'
      }
    } as SecurityNode,
    {
      id: 'api-aggregator',
      type: 'apiGateway',
      position: { x: 3010, y: 600 },
      data: {
        label: 'API Aggregator',
        description: 'BFF pattern',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['GraphQL', 'REST', 'WebSocket'],
        vendor: 'custom',
        product: 'bff-service',
        version: '3.0',
        technology: 'GraphQL, REST, WebSocket'
      }
    } as SecurityNode,
    {
      id: 'workflow-engine',
      type: 'service',
      position: { x: 3160, y: 600 },
      data: {
        label: 'Workflow Engine',
        description: 'Process orchestration',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['gRPC', 'REST'],
        vendor: 'temporal',
        product: 'temporal',
        version: '1.22',
        technology: 'Camunda, Step Functions'
      }
    } as SecurityNode,
    {
      id: 'feature-flags',
      type: 'service',
      position: { x: 3310, y: 600 },
      data: {
        label: 'Feature Flag Service',
        description: 'Feature toggles',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['REST', 'gRPC'],
        vendor: 'launchdarkly',
        product: 'launchdarkly',
        version: 'latest',
        technology: 'Unleash, Split'
      }
    } as SecurityNode,
    {
      id: 'config-service',
      type: 'service',
      position: { x: 3460, y: 600 },
      data: {
        label: 'Config Service',
        description: 'Centralized config',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTP', 'gRPC'],
        vendor: 'hashicorp',
        product: 'consul',
        version: '1.17',
        technology: 'Spring Config, etcd'
      }
    } as SecurityNode,
    {
      id: 'audit-logger',
      type: 'logging',
      position: { x: 3010, y: 750 },
      data: {
        label: 'Audit Logger',
        description: 'Audit trails',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'gRPC'],
        vendor: 'custom',
        product: 'audit-service',
        version: '1.0',
        technology: 'Immutable, Blockchain, WORM',
        compliance: ['SOX']
      }
    } as SecurityNode,
    {
      id: 'rate-limiter',
      type: 'cache',
      position: { x: 3160, y: 750 },
      data: {
        label: 'Rate Limiter',
        description: 'API throttling',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['Redis Protocol'],
        vendor: 'redis',
        product: 'redis',
        version: '7.2',
        technology: 'Token Bucket, Sliding Window'
      }
    } as SecurityNode,
    {
      id: 'health-checker',
      type: 'monitor',
      position: { x: 3310, y: 750 },
      data: {
        label: 'Health Checker',
        description: 'Service health',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTP', 'gRPC'],
        vendor: 'prometheus',
        product: 'blackbox-exporter',
        version: '0.24',
        technology: 'Health Endpoints, SLO'
      }
    } as SecurityNode,
    {
      id: 'job-scheduler',
      type: 'service',
      position: { x: 3460, y: 750 },
      data: {
        label: 'Job Scheduler',
        description: 'Task scheduling',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTP', 'gRPC'],
        vendor: 'quartz',
        product: 'quartz',
        version: '2.3',
        technology: 'Bull, Agenda'
      }
    } as SecurityNode,

    // Trusted Zone (zone x=4030, delta=+900)
    {
      id: 'primary-db-master',
      type: 'database',
      position: { x: 4080, y: 200 },
      data: {
        label: 'Primary DB Master',
        description: 'Write master',
        zone: 'Trusted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['PostgreSQL', 'SSL'],
        vendor: 'postgres',
        product: 'postgresql',
        version: '15.4',
        technology: 'Multi-Master, Encryption',
        compliance: ['SOC 2']
      }
    } as SecurityNode,
    {
      id: 'primary-db-replica-1',
      type: 'database',
      position: { x: 4230, y: 200 },
      data: {
        label: 'DB Replica 1',
        description: 'Read replica',
        zone: 'Trusted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['PostgreSQL', 'SSL'],
        vendor: 'postgres',
        product: 'postgresql',
        version: '15.4',
        technology: 'Streaming, Hot Standby'
      }
    } as SecurityNode,
    {
      id: 'primary-db-replica-2',
      type: 'database',
      position: { x: 4380, y: 200 },
      data: {
        label: 'DB Replica 2',
        description: 'Analytics replica',
        zone: 'Trusted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['PostgreSQL', 'SSL'],
        vendor: 'postgres',
        product: 'postgresql',
        version: '15.4',
        technology: 'Logical, CDC'
      }
    } as SecurityNode,
    {
      id: 'nosql-cluster',
      type: 'database',
      position: { x: 4530, y: 200 },
      data: {
        label: 'NoSQL Cluster',
        description: 'Document store',
        zone: 'Trusted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['MongoDB Wire', 'TLS'],
        vendor: 'mongodb',
        product: 'mongodb',
        version: '7.0',
        technology: 'Sharding, Replica Sets'
      }
    } as SecurityNode,
    {
      id: 'graph-db',
      type: 'database',
      position: { x: 4080, y: 350 },
      data: {
        label: 'Graph Database',
        description: 'Relationship data',
        zone: 'Trusted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['Bolt', 'HTTPS'],
        vendor: 'neo4j',
        product: 'neo4j',
        version: '5.13',
        technology: 'Cypher, Graph Analytics'
      }
    } as SecurityNode,
    {
      id: 'timeseries-db',
      type: 'database',
      position: { x: 4230, y: 350 },
      data: {
        label: 'TimeSeries DB',
        description: 'Metrics storage',
        zone: 'Trusted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['InfluxDB Line', 'HTTPS'],
        vendor: 'influxdata',
        product: 'influxdb',
        version: '2.7',
        technology: 'Prometheus, Compression'
      }
    } as SecurityNode,
    {
      id: 'data-warehouse',
      type: 'dataLake',
      position: { x: 4380, y: 350 },
      data: {
        label: 'Data Warehouse',
        description: 'Analytics warehouse',
        zone: 'Trusted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['SQL', 'HTTPS'],
        vendor: 'snowflake',
        product: 'snowflake',
        version: 'latest',
        technology: 'BigQuery, Redshift',
        compliance: ['SOX']
      }
    } as SecurityNode,
    {
      id: 'data-lake',
      type: 'dataLake',
      position: { x: 4530, y: 350 },
      data: {
        label: 'Data Lake',
        description: 'Raw data storage',
        zone: 'Trusted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['S3', 'HTTPS'],
        vendor: 'aws',
        product: 's3',
        version: 'latest',
        technology: 'Parquet, Delta Lake'
      }
    } as SecurityNode,
    {
      id: 'secret-vault',
      type: 'secretsManager',
      position: { x: 4180, y: 500 },
      data: {
        label: 'Secret Vault',
        description: 'Secrets management',
        zone: 'Trusted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS'],
        vendor: 'hashicorp',
        product: 'vault',
        version: '1.15',
        technology: 'HSM, Auto-rotation',
        compliance: ['SOC 2']
      }
    } as SecurityNode,
    {
      id: 'backup-storage',
      type: 'backupSystem',
      position: { x: 4430, y: 500 },
      data: {
        label: 'Backup Storage',
        description: 'Backup repository',
        zone: 'Trusted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['S3', 'HTTPS'],
        vendor: 'aws',
        product: 'glacier',
        version: 'latest',
        technology: 'Tape, Air-gap',
        compliance: ['SOX']
      }
    } as SecurityNode,

    // Cloud Zone Components (zone x=2960, delta=+600)
    {
      id: 'aws-vpc',
      type: 'cloudService',
      position: { x: 3010, y: -970 },
      data: {
        label: 'AWS VPC',
        description: 'AWS infrastructure',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'VPN'],
        vendor: 'aws',
        product: 'vpc',
        version: 'latest',
        technology: 'Transit Gateway, Direct Connect',
        compliance: ['SOC 2']
      }
    } as SecurityNode,
    {
      id: 'azure-vnet',
      type: 'cloudService',
      position: { x: 3260, y: -970 },
      data: {
        label: 'Azure VNet',
        description: 'Azure infrastructure',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'VPN'],
        vendor: 'azure',
        product: 'vnet',
        version: 'latest',
        technology: 'ExpressRoute, Private Link',
        compliance: ['SOC 2']
      }
    } as SecurityNode,
    {
      id: 'gcp-vpc',
      type: 'cloudService',
      position: { x: 3510, y: -970 },
      data: {
        label: 'GCP VPC',
        description: 'Google Cloud infrastructure',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'VPN'],
        vendor: 'gcp',
        product: 'vpc',
        version: 'latest',
        technology: 'Interconnect, Private Access',
        compliance: ['SOC 2']
      }
    } as SecurityNode,
    {
      id: 'multi-cloud-lb',
      type: 'cloudLoadBalancer',
      position: { x: 3260, y: -820 },
      data: {
        label: 'Multi-Cloud LB',
        description: 'Cross-cloud balancer',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'BGP'],
        vendor: 'custom',
        product: 'gslb',
        version: '1.0',
        technology: 'Global Server LB, Anycast, BGP'
      }
    } as SecurityNode,
    {
      id: 'cloud-storage-sync',
      type: 'storageAccount',
      position: { x: 3010, y: -670 },
      data: {
        label: 'Storage Sync',
        description: 'Multi-cloud storage',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['S3', 'HTTPS'],
        vendor: 'multiple',
        product: 'object-storage',
        version: 'latest',
        technology: 'S3, Blob, GCS, Replication'
      }
    } as SecurityNode,
    {
      id: 'serverless-compute',
      type: 'functionApp',
      position: { x: 3260, y: -670 },
      data: {
        label: 'Serverless Compute',
        description: 'FaaS layer',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'Events'],
        vendor: 'multiple',
        product: 'serverless',
        version: 'latest',
        technology: 'Lambda, Functions, Cloud Run'
      }
    } as SecurityNode,
    {
      id: 'ml-platform',
      type: 'aiModel',
      position: { x: 3510, y: -670 },
      data: {
        label: 'ML Platform',
        description: 'Machine learning',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'gRPC'],
        vendor: 'multiple',
        product: 'ml-platform',
        version: 'latest',
        technology: 'SageMaker, Vertex AI, Databricks'
      }
    } as SecurityNode,

    // Compliance Zone Components (zone x=5100, delta=+1200)
    {
      id: 'prometheus-fed',
      type: 'monitor',
      position: { x: 5150, y: 150 },
      data: {
        label: 'Prometheus Federation',
        description: 'Metrics aggregation',
        zone: 'Compliance' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTP', 'HTTPS'],
        vendor: 'prometheus',
        product: 'prometheus',
        version: '2.47',
        technology: 'Thanos, Cortex'
      }
    } as SecurityNode,
    {
      id: 'elk-cluster',
      type: 'logging',
      position: { x: 5400, y: 150 },
      data: {
        label: 'ELK Cluster',
        description: 'Log aggregation',
        zone: 'Compliance' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'Beats'],
        vendor: 'elastic',
        product: 'elastic-stack',
        version: '8.11',
        technology: 'Elasticsearch, Logstash, Kibana'
      }
    } as SecurityNode,
    {
      id: 'jaeger-cluster',
      type: 'monitor',
      position: { x: 5650, y: 150 },
      data: {
        label: 'Jaeger Cluster',
        description: 'Distributed tracing',
        zone: 'Compliance' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['gRPC', 'HTTPS'],
        vendor: 'jaegertracing',
        product: 'jaeger',
        version: '1.50',
        technology: 'OpenTelemetry, Zipkin'
      }
    } as SecurityNode,
    {
      id: 'siem-platform',
      type: 'siem',
      position: { x: 5150, y: 300 },
      data: {
        label: 'SIEM Platform',
        description: 'Security monitoring',
        zone: 'Compliance' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'Syslog'],
        vendor: 'splunk',
        product: 'enterprise',
        version: '9.1',
        technology: 'QRadar, Sentinel',
        compliance: ['SOC 2']
      }
    } as SecurityNode,
    {
      id: 'soar-platform',
      type: 'soar',
      position: { x: 5400, y: 300 },
      data: {
        label: 'SOAR Platform',
        description: 'Security orchestration',
        zone: 'Compliance' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'REST'],
        vendor: 'phantom',
        product: 'phantom',
        version: '5.5',
        technology: 'Demisto, Playbooks'
      }
    } as SecurityNode,
    {
      id: 'vulnerability-scanner',
      type: 'vulnerabilityScanner',
      position: { x: 5650, y: 300 },
      data: {
        label: 'Vulnerability Scanner',
        description: 'Security scanning',
        zone: 'Compliance' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'SSH'],
        vendor: 'qualys',
        product: 'vmdr',
        version: 'latest',
        technology: 'Nessus, Rapid7',
        compliance: ['PCI DSS']
      }
    } as SecurityNode,
    {
      id: 'compliance-engine',
      type: 'complianceScanner',
      position: { x: 5250, y: 450 },
      data: {
        label: 'Compliance Engine',
        description: 'Compliance automation',
        zone: 'Compliance' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'SSH'],
        vendor: 'chef',
        product: 'inspec',
        version: '5.22',
        technology: 'Cloud Custodian, Policy',
        compliance: ['SOC 2', 'PCI DSS', 'HIPAA']
      }
    } as SecurityNode,
    {
      id: 'chaos-engine',
      type: 'service',
      position: { x: 5500, y: 450 },
      data: {
        label: 'Chaos Engineering',
        description: 'Resilience testing',
        zone: 'Compliance' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'gRPC'],
        vendor: 'netflix',
        product: 'chaos-monkey',
        version: '2.5',
        technology: 'Litmus, Gremlin'
      }
    } as SecurityNode
  ],
  edges: [
    // Internet to External - Multiple paths
    {
      id: 'e1',
      source: 'global-users',
      target: 'edge-lb-1',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'HTTPS',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        animated: true,
        zone: 'External' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e2',
      source: 'global-users',
      target: 'edge-lb-2',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'HTTPS',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        animated: true,
        zone: 'External' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e3',
      source: 'bot-traffic',
      target: 'waf-cluster',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Bot Traffic',
        protocol: 'HTTP',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        animated: true,
        zone: 'External' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e4',
      source: 'ddos-sources',
      target: 'ddos-scrubbing',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Attack Traffic',
        protocol: 'Various',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        animated: true,
        zone: 'External' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e5',
      source: 'cdn-pops',
      target: 'edge-lb-1',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'CDN Origin',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        animated: false,
        zone: 'External' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e6',
      source: 'partners',
      target: 'api-gw-array',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'B2B APIs',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: true,
        zone: 'External' as SecurityZone
      }
    } as SecurityEdge,

    // External to DMZ - Complex routing
    {
      id: 'e7',
      source: 'edge-lb-1',
      target: 'ingress-1',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Load Balance',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: true,
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e8',
      source: 'edge-lb-2',
      target: 'ingress-2',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Load Balance',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: true,
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e9',
      source: 'waf-cluster',
      target: 'service-mesh-1',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Filtered',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: true,
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e10',
      source: 'api-gw-array',
      target: 'service-mesh-2',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'API Traffic',
        protocol: 'HTTPS',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: true,
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e11',
      source: 'ddos-scrubbing',
      target: 'edge-lb-1',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Clean Traffic',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        animated: false,
        zone: 'External' as SecurityZone
      }
    } as SecurityEdge,

    // DMZ internal mesh
    {
      id: 'e12',
      source: 'ingress-1',
      target: 'service-mesh-1',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Ingress',
        protocol: 'gRPC',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: true,
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e13',
      source: 'ingress-2',
      target: 'service-mesh-2',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Ingress',
        protocol: 'gRPC',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: true,
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e14',
      source: 'service-mesh-1',
      target: 'cache-layer-1',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Cache',
        protocol: 'Redis',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: true,
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e15',
      source: 'service-mesh-2',
      target: 'cache-layer-2',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Cache',
        protocol: 'HTTP',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: true,
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e16',
      source: 'service-mesh-1',
      target: 'queue-cluster',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Events',
        protocol: 'Kafka',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: true,
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e17',
      source: 'service-mesh-2',
      target: 'service-registry',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Discovery',
        protocol: 'HTTP',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: false,
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e18',
      source: 'cache-layer-1',
      target: 'api-orchestrator',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'API Calls',
        protocol: 'GraphQL',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: true,
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e19',
      source: 'queue-cluster',
      target: 'event-bus',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Events',
        protocol: 'NATS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: true,
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e20',
      source: 'service-mesh-1',
      target: 'sidecar-injector',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Sidecar',
        protocol: 'gRPC',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: false,
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,

    // DMZ to Internal - Service explosion
    {
      id: 'e21',
      source: 'api-orchestrator',
      target: 'auth-svc',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Auth',
        protocol: 'REST',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e22',
      source: 'api-orchestrator',
      target: 'user-svc',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Users',
        protocol: 'gRPC',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: true,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e23',
      source: 'api-orchestrator',
      target: 'order-svc',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Orders',
        protocol: 'gRPC',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: true,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e24',
      source: 'event-bus',
      target: 'payment-svc',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Payment Events',
        protocol: 'NATS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e25',
      source: 'event-bus',
      target: 'inventory-svc',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Stock Events',
        protocol: 'NATS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: true,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,

    // Internal service mesh - Dense connections
    {
      id: 'e26',
      source: 'user-svc',
      target: 'auth-svc',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Validate',
        protocol: 'gRPC',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: true,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e27',
      source: 'order-svc',
      target: 'payment-svc',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Process',
        protocol: 'gRPC',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e28',
      source: 'order-svc',
      target: 'inventory-svc',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Reserve',
        protocol: 'gRPC',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: true,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e29',
      source: 'order-svc',
      target: 'shipping-svc',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Ship',
        protocol: 'REST',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: false,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e30',
      source: 'payment-svc',
      target: 'notification-svc',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Notify',
        protocol: 'REST',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: false,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e31',
      source: 'shipping-svc',
      target: 'notification-svc',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Updates',
        protocol: 'REST',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: false,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e32',
      source: 'order-svc',
      target: 'analytics-svc',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Track',
        protocol: 'gRPC',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: false,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e33',
      source: 'user-svc',
      target: 'search-svc',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Index',
        protocol: 'REST',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: false,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e34',
      source: 'inventory-svc',
      target: 'search-svc',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Index',
        protocol: 'REST',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: false,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e35',
      source: 'analytics-svc',
      target: 'recommendation-svc',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'ML Data',
        protocol: 'gRPC',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: false,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e36',
      source: 'media-svc',
      target: 'search-svc',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Media Index',
        protocol: 'REST',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        animated: false,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e37',
      source: 'batch-processor',
      target: 'analytics-svc',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Batch Jobs',
        protocol: 'gRPC',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: false,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e38',
      source: 'api-aggregator',
      target: 'workflow-engine',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Workflows',
        protocol: 'gRPC',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: false,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e39',
      source: 'feature-flags',
      target: 'config-service',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Config',
        protocol: 'HTTP',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: false,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e40',
      source: 'rate-limiter',
      target: 'api-aggregator',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Throttle',
        protocol: 'Redis',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: true,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e41',
      source: 'audit-logger',
      target: 'compliance-engine',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Audit Trail',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: false,
        zone: 'Compliance' as SecurityZone
      }
    } as SecurityEdge,

    // Internal to Trusted - Data access
    {
      id: 'e42',
      source: 'user-svc',
      target: 'primary-db-master',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Write',
        protocol: 'PostgreSQL',
        encryption: 'SSL',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true,
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e43',
      source: 'order-svc',
      target: 'primary-db-master',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Write',
        protocol: 'PostgreSQL',
        encryption: 'SSL',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true,
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e44',
      source: 'analytics-svc',
      target: 'primary-db-replica-2',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Read',
        protocol: 'PostgreSQL',
        encryption: 'SSL',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true,
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e45',
      source: 'search-svc',
      target: 'nosql-cluster',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'NoSQL',
        protocol: 'MongoDB',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: true,
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e46',
      source: 'recommendation-svc',
      target: 'graph-db',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Graph',
        protocol: 'Bolt',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: false,
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e47',
      source: 'analytics-svc',
      target: 'timeseries-db',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Metrics',
        protocol: 'InfluxDB',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: false,
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e48',
      source: 'batch-processor',
      target: 'data-warehouse',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'ETL',
        protocol: 'SQL',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: false,
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e49',
      source: 'media-svc',
      target: 'data-lake',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Raw Data',
        protocol: 'S3',
        encryption: 'HTTPS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        animated: false,
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e50',
      source: 'auth-svc',
      target: 'secret-vault',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Secrets',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true,
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e51',
      source: 'primary-db-master',
      target: 'backup-storage',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Backup',
        protocol: 'S3',
        encryption: 'HTTPS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: false,
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,

    // Cloud connections
    {
      id: 'e52',
      source: 'api-aggregator',
      target: 'aws-vpc',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'AWS',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: false,
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e53',
      source: 'workflow-engine',
      target: 'azure-vnet',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Azure',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: false,
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e54',
      source: 'analytics-svc',
      target: 'gcp-vpc',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'GCP',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: false,
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e55',
      source: 'multi-cloud-lb',
      target: 'serverless-compute',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'FaaS',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: true,
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e56',
      source: 'ml-platform',
      target: 'recommendation-svc',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'ML Models',
        protocol: 'gRPC',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: false,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,

    // Monitoring connections
    {
      id: 'e57',
      source: 'health-checker',
      target: 'prometheus-fed',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Metrics',
        protocol: 'HTTP',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: false,
        zone: 'Compliance' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e58',
      source: 'audit-logger',
      target: 'elk-cluster',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Logs',
        protocol: 'Beats',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: false,
        zone: 'Compliance' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e59',
      source: 'api-aggregator',
      target: 'jaeger-cluster',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Traces',
        protocol: 'gRPC',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: false,
        zone: 'Compliance' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e60',
      source: 'siem-platform',
      target: 'soar-platform',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Incidents',
        protocol: 'REST',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: true,
        zone: 'Compliance' as SecurityZone
      }
    } as SecurityEdge
  ],

  attackPaths: [
    {
      id: 'ap-stress-001',
      name: 'DDoS Amplification to Service Degradation',
      strideCategory: 'Denial of Service',
      riskLevel: 'Critical' as const,
      description: 'Volumetric DDoS overwhelms scrubbing capacity, saturates load balancers, and degrades backend services across both mesh clusters.',
      steps: [
        { order: 1, edgeId: 'e4', sourceNodeId: 'ddos-sources', targetNodeId: 'ddos-scrubbing', technique: 'T1498 - Network Denial of Service' },
        { order: 2, edgeId: 'e11', sourceNodeId: 'ddos-scrubbing', targetNodeId: 'edge-lb-1', technique: 'T1499 - Endpoint Denial of Service' },
        { order: 3, edgeId: 'e7', sourceNodeId: 'edge-lb-1', targetNodeId: 'ingress-1', technique: 'T1499.003 - Application Exhaustion Flood' },
        { order: 4, edgeId: 'e12', sourceNodeId: 'ingress-1', targetNodeId: 'service-mesh-1', technique: 'T1499.001 - OS Exhaustion Flood' }
      ],
      mitreTechniques: ['T1498', 'T1499', 'T1499.003', 'T1499.001'],
      createdAt: NOW,
      updatedAt: NOW
    },
    {
      id: 'ap-stress-002',
      name: 'Partner API Gateway to Payment Service Compromise',
      strideCategory: 'Elevation of Privilege',
      riskLevel: 'Critical' as const,
      description: 'Attacker abuses partner API gateway, traverses service mesh, and reaches payment service via event bus to exfiltrate transaction data.',
      steps: [
        { order: 1, edgeId: 'e6', sourceNodeId: 'partners', targetNodeId: 'api-gw-array', technique: 'T1190 - Exploit Public-Facing Application' },
        { order: 2, edgeId: 'e10', sourceNodeId: 'api-gw-array', targetNodeId: 'service-mesh-2', technique: 'T1071.001 - Web Protocols' },
        { order: 3, edgeId: 'e18', sourceNodeId: 'cache-layer-1', targetNodeId: 'api-orchestrator', technique: 'T1078 - Valid Accounts' },
        { order: 4, edgeId: 'e24', sourceNodeId: 'event-bus', targetNodeId: 'payment-svc', technique: 'T1565 - Data Manipulation' }
      ],
      mitreTechniques: ['T1190', 'T1071.001', 'T1078', 'T1565'],
      createdAt: NOW,
      updatedAt: NOW
    },
    {
      id: 'ap-stress-003',
      name: 'Secret Vault Credential Theft via Auth Service',
      strideCategory: 'Information Disclosure',
      riskLevel: 'High' as const,
      description: 'Compromise auth service to extract credentials from secret vault, then pivot to primary database master for bulk data exfiltration.',
      steps: [
        { order: 1, edgeId: 'e21', sourceNodeId: 'api-orchestrator', targetNodeId: 'auth-svc', technique: 'T1556 - Modify Authentication Process' },
        { order: 2, edgeId: 'e50', sourceNodeId: 'auth-svc', targetNodeId: 'secret-vault', technique: 'T1555 - Credentials from Password Stores' },
        { order: 3, edgeId: 'e42', sourceNodeId: 'user-svc', targetNodeId: 'primary-db-master', technique: 'T1530 - Data from Cloud Storage' },
        { order: 4, edgeId: 'e51', sourceNodeId: 'primary-db-master', targetNodeId: 'backup-storage', technique: 'T1537 - Transfer Data to Cloud Account' }
      ],
      mitreTechniques: ['T1556', 'T1555', 'T1530', 'T1537'],
      createdAt: NOW,
      updatedAt: NOW
    },
    {
      id: 'ap-stress-004',
      name: 'Multi-Cloud Lateral Movement via Workflow Engine',
      strideCategory: 'Tampering',
      riskLevel: 'High' as const,
      description: 'Exploit workflow engine to pivot across AWS, Azure, and GCP VPCs, leveraging multi-cloud load balancer for cross-environment access.',
      steps: [
        { order: 1, edgeId: 'e40', sourceNodeId: 'rate-limiter', targetNodeId: 'api-aggregator', technique: 'T1071 - Application Layer Protocol' },
        { order: 2, edgeId: 'e38', sourceNodeId: 'api-aggregator', targetNodeId: 'workflow-engine', technique: 'T1059 - Command and Scripting Interpreter' },
        { order: 3, edgeId: 'e53', sourceNodeId: 'workflow-engine', targetNodeId: 'azure-vnet', technique: 'T1021 - Remote Services' },
        { order: 4, edgeId: 'e52', sourceNodeId: 'api-aggregator', targetNodeId: 'aws-vpc', technique: 'T1580 - Cloud Infrastructure Discovery' }
      ],
      mitreTechniques: ['T1071', 'T1059', 'T1021', 'T1580'],
      createdAt: NOW,
      updatedAt: NOW
    }
  ] as DiagramAttackPath[],

  grcWorkspace: buildGrcWorkspace({
    tierCatalogue: [
      { id: 'tier-infra', name: 'Infrastructure & Edge', parentId: null },
      { id: 'tier-services', name: 'Microservices & Orchestration', parentId: null },
      { id: 'tier-data', name: 'Data Stores & Analytics', parentId: null }
    ],
    assets: [
      { id: 'a-edge-lb', tierId: 'tier-infra', name: 'Edge Load Balancers', owner: 'Platform Team', valueBand: 'High', nodeIds: ['edge-lb-1', 'edge-lb-2', 'waf-cluster', 'ddos-scrubbing'] },
      { id: 'a-mesh', tierId: 'tier-services', name: 'Service Mesh Cluster', owner: 'SRE Team', valueBand: 'Critical', nodeIds: ['service-mesh-1', 'service-mesh-2', 'sidecar-injector', 'service-registry'] },
      { id: 'a-payment', tierId: 'tier-services', name: 'Payment Processing', owner: 'Finance Engineering', valueBand: 'Critical', nodeIds: ['payment-svc', 'order-svc'] },
      { id: 'a-auth', tierId: 'tier-services', name: 'Auth & Secrets', owner: 'Security Team', valueBand: 'Critical', nodeIds: ['auth-svc', 'secret-vault'] },
      { id: 'a-databases', tierId: 'tier-data', name: 'Primary Databases', owner: 'DBA Team', valueBand: 'Critical', nodeIds: ['primary-db-master', 'primary-db-replica-2', 'nosql-cluster'] },
      { id: 'a-cloud', tierId: 'tier-infra', name: 'Multi-Cloud Environments', owner: 'Cloud Architecture', valueBand: 'High', nodeIds: ['aws-vpc', 'azure-vnet', 'gcp-vpc', 'multi-cloud-lb'] },
      { id: 'a-observability', tierId: 'tier-data', name: 'Observability Stack', owner: 'SRE Team', valueBand: 'Medium', nodeIds: ['prometheus-fed', 'elk-cluster', 'jaeger-cluster', 'siem-platform'] }
    ],
    risks: [
      { id: 'r-ddos', assetId: 'a-edge-lb', title: 'Volumetric DDoS Exceeds Scrubbing Capacity', category: 'Availability', inherent: score('likelihood-4', 'impact-5'), residual: score('likelihood-3', 'impact-4'), treatment: 'Mitigate' as const },
      { id: 'r-payment-fraud', assetId: 'a-payment', title: 'Payment Service Transaction Manipulation', category: 'Integrity', inherent: score('likelihood-3', 'impact-5'), residual: score('likelihood-2', 'impact-4'), treatment: 'Mitigate' as const },
      { id: 'r-credential-theft', assetId: 'a-auth', title: 'Secret Vault Credential Exfiltration', category: 'Confidentiality', inherent: score('likelihood-3', 'impact-5'), residual: score('likelihood-2', 'impact-3'), treatment: 'Mitigate' as const },
      { id: 'r-multi-cloud-lateral', assetId: 'a-cloud', title: 'Cross-Cloud Lateral Movement', category: 'Integrity', inherent: score('likelihood-3', 'impact-4'), residual: score('likelihood-2', 'impact-3'), treatment: 'Mitigate' as const },
      { id: 'r-data-breach', assetId: 'a-databases', title: 'Primary Database Bulk Exfiltration', category: 'Confidentiality', inherent: score('likelihood-2', 'impact-5'), residual: score('likelihood-1', 'impact-4'), treatment: 'Mitigate' as const }
    ],
    assessments: [
      {
        id: 'assess-stress-1', title: 'Stress Test Architecture Security Assessment', status: 'In Progress' as const,
        scope: 'Full platform review covering edge infrastructure, service mesh, microservices, and multi-cloud',
        assessor: 'Platform Security Team', date: NOW,
        threatModel: {
          methodology: 'STRIDE' as const,
          nodeFindings: [
            { nodeId: 'ddos-scrubbing', finding: 'Scrubbing capacity may be insufficient for amplification attacks above 500 Gbps', severity: 'High' as const },
            { nodeId: 'secret-vault', finding: 'Vault auto-unseal keys stored in same cloud region as vault itself', severity: 'High' as const },
            { nodeId: 'service-mesh-1', finding: 'mTLS certificate rotation period exceeds 90 days', severity: 'Medium' as const },
            { nodeId: 'workflow-engine', finding: 'Workflow definitions allow arbitrary cloud API calls without scope restriction', severity: 'High' as const }
          ],
          edgeFindings: [
            { edgeId: 'e6', finding: 'Partner API gateway lacks per-partner rate limiting', severity: 'High' as const },
            { edgeId: 'e50', finding: 'Auth-to-vault connection uses long-lived tokens instead of short-lived leases', severity: 'Medium' as const },
            { edgeId: 'e60', finding: 'SIEM-to-SOAR integration lacks payload validation on incident objects', severity: 'Medium' as const }
          ]
        }
      }
    ],
    soaEntries: [
      { controlSetId: OWASP_CONTROL_SET_ID, controlId: 'ctrl-a05', riskId: 'r-ddos', status: 'Implemented' as const, evidence: 'WAF cluster with DDoS scrubbing and edge-level rate limiting deployed' },
      { controlSetId: OWASP_CONTROL_SET_ID, controlId: 'ctrl-a07', riskId: 'r-credential-theft', status: 'Partial' as const, evidence: 'Secret vault deployed but auto-unseal key management needs hardening' },
      { controlSetId: CIS_CONTROL_SET_ID, controlId: 'cis-ctrl-03', riskId: 'r-payment-fraud', status: 'Implemented' as const, evidence: 'mTLS between all services via sidecar injector; payment service uses additional token-based auth' },
      { controlSetId: CIS_CONTROL_SET_ID, controlId: 'cis-ctrl-06', riskId: 'r-multi-cloud-lateral', status: 'Partial' as const, evidence: 'Cloud VPC peering with firewall rules but workflow engine has overly broad permissions' },
      { controlSetId: OWASP_CONTROL_SET_ID, controlId: 'ctrl-a09', riskId: 'r-data-breach', status: 'Implemented' as const, evidence: 'Audit logging via ELK cluster with SIEM correlation and SOAR automated response' }
    ],
    thirdParties: [
      {
        id: 'st-tp-aws',
        name: 'Amazon Web Services (AWS)',
        description: 'Primary cloud provider hosting VPC, EKS clusters, RDS databases, and S3 storage. Runs the majority of production microservices and data stores.',
        category: 'cloud_provider',
        status: 'active',
        riskRating: 'medium',
        dataClassification: 'confidential',
        linkedAssetIds: ['a-cloud', 'a-databases', 'a-edge-lb'],
        linkedRiskIds: ['r-multi-cloud-lateral', 'r-data-breach'],
        contactName: 'AWS Enterprise Support',
        contactEmail: 'enterprise-support@aws.example.com',
        contractExpiry: '2027-06-30',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-08-15',
        notes: 'SOC 2 Type II and ISO 27001 certified. VPC peering with Azure and GCP for multi-cloud architecture. Review cross-account IAM roles and VPC firewall rules.'
      },
      {
        id: 'st-tp-azure',
        name: 'Microsoft Azure',
        description: 'Secondary cloud provider for multi-cloud redundancy. Hosts Azure VNet with peered workloads and disaster recovery endpoints.',
        category: 'cloud_provider',
        status: 'active',
        riskRating: 'medium',
        dataClassification: 'confidential',
        linkedAssetIds: ['a-cloud'],
        linkedRiskIds: ['r-multi-cloud-lateral'],
        contactName: 'Azure Enterprise Support',
        contactEmail: 'enterprise@azure.example.com',
        contractExpiry: '2027-05-31',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-09-01',
        notes: 'Azure VNet peered with AWS VPC. Review NSG rules and cross-cloud identity federation. Ensure consistent security policy enforcement across clouds.'
      },
      {
        id: 'st-tp-gcp',
        name: 'Google Cloud Platform (GCP)',
        description: 'Tertiary cloud provider for multi-cloud load balancing and specialized workloads. Hosts GCP VPC with BigQuery analytics and ML training pipelines.',
        category: 'cloud_provider',
        status: 'active',
        riskRating: 'medium',
        dataClassification: 'confidential',
        linkedAssetIds: ['a-cloud'],
        linkedRiskIds: ['r-multi-cloud-lateral'],
        contactName: 'GCP Enterprise Support',
        contactEmail: 'enterprise@gcp.example.com',
        contractExpiry: '2027-04-30',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-09-15',
        notes: 'GCP VPC peered with AWS and Azure. Workflow engine has overly broad permissions to GCP APIs -- identified as a risk. Review service account scoping.'
      },
      {
        id: 'st-tp-datadog',
        name: 'Datadog Inc.',
        description: 'SaaS observability platform providing metrics, distributed tracing, log aggregation, and alerting across the entire multi-cloud microservices architecture.',
        category: 'saas',
        status: 'active',
        riskRating: 'low',
        dataClassification: 'internal',
        linkedAssetIds: ['a-observability'],
        linkedRiskIds: [],
        contactName: 'Datadog Enterprise Support',
        contactEmail: 'enterprise@datadog.example.com',
        contractExpiry: '2027-03-31',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-10-01',
        notes: 'SOC 2 Type II certified. Receives telemetry from Prometheus federation, ELK, and Jaeger. Ensure API keys are rotated quarterly and sensitive data is not forwarded in traces.'
      },
      {
        id: 'st-tp-stripe',
        name: 'Stripe Inc.',
        description: 'Payment processing provider integrated with the payment service for all financial transactions. PCI DSS Level 1 certified with tokenized card data handling.',
        category: 'saas',
        status: 'active',
        riskRating: 'high',
        dataClassification: 'restricted',
        linkedAssetIds: ['a-payment'],
        linkedRiskIds: ['r-payment-fraud'],
        contactName: 'Stripe Enterprise Support',
        contactEmail: 'enterprise@stripe.example.com',
        contractExpiry: '2027-01-31',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-07-15',
        notes: 'PCI DSS Level 1 and SOC 2 certified. Webhook signature verification implemented. Monitor for transaction manipulation patterns and API key rotation compliance.'
      },
    ]
  } as any)
};