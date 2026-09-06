import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityNode, SecurityEdge, SecurityZone } from '../../types/SecurityTypes';
import { colors } from '../../styles/Theme';
import { DiagramAttackPath } from '../../types/GrcTypes';
import { buildGrcWorkspace, score, NOW, OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID } from './grcSharedBase';

export const largeEnterpriseSystem: ExampleSystem = {
  id: 'large-enterprise-system',
  name: 'Large Enterprise Hybrid Cloud System',
  description: 'Global enterprise infrastructure with multi-cloud presence and 100K+ employees',
  category: 'Enterprise Systems',
  // securityLevel removed - no longer part of the system model
  primaryZone: 'Internal',
  dataClassification: 'Confidential',
  customContext: `# Large Enterprise Hybrid Cloud System

## Executive Summary
This architecture represents our global enterprise infrastructure supporting 100,000+ employees across 50 countries. We're in year 2 of a 5-year cloud transformation journey, maintaining critical on-premises systems while expanding cloud presence.

## Business Context
- **Industry**: Financial Services and Insurance
- **Revenue**: $50B annually
- **Critical Business Functions**: Trading platforms, customer portals, risk analytics, regulatory reporting
- **Availability Requirements**: 99.99% for critical systems, 99.9% for standard applications
- **Data Sensitivity**: Highly regulated with PII, financial records, and trade secrets

## Technical Architecture
- **Hybrid Cloud Strategy**: 40% on-premises, 35% AWS, 25% Azure
- **Containerization**: 60% of new applications deployed on Kubernetes
- **Legacy Systems**: 30% of critical business logic still in monolithic applications
- **Integration Patterns**: Mix of REST APIs, message queuing, and direct database connections

## Infrastructure Scale
- **Compute**: 50,000 VMs, 100,000 containers, 5,000 physical servers
- **Storage**: 50PB on-premises, 100PB cloud storage
- **Network**: 10Gbps internet links, 40Gbps data center interconnects
- **Databases**: 500+ database instances across Oracle, PostgreSQL, MongoDB, and cloud-native solutions

## Security Architecture
- **Defense in Depth**: Multiple security layers from edge to data
- **Identity Management**: Federated identity with SSO for 90% of applications
- **Encryption**: TLS 1.2 minimum for external, some internal systems still on older protocols
- **Monitoring**: 24/7 SOC with SIEM covering 85% of infrastructure

## Compliance and Governance
- **Regulations**: SOX, PCI DSS, GDPR, CCPA, industry-specific requirements
- **Audit Frequency**: Quarterly internal audits, annual external assessments
- **Data Residency**: Strict requirements for EU and APAC data
- **Change Management**: CAB approval required for production changes

## Current Initiatives
- **Zero Trust Implementation**: Pilot program in cloud environments
- **DevSecOps Transformation**: CI/CD pipelines for 70% of applications
- **AI/ML Adoption**: Expanding use cases for fraud detection and customer analytics
- **Technical Debt Reduction**: $10M annual budget for modernization

## Operational Challenges
- **Skill Gaps**: Shortage of cloud-native and security expertise
- **Tool Sprawl**: 200+ different security and monitoring tools
- **Integration Complexity**: Average application integrates with 15 other systems
- **Patch Management**: 30-day patch cycle for non-critical systems
- **Shadow IT**: Estimated 20% of cloud usage outside of central IT governance

## Recent Incidents
- Q1: 4-hour outage due to expired certificates in production
- Q2: Data exposure incident from misconfigured S3 bucket (contained no sensitive data)
- Q3: Performance degradation from database connection pool exhaustion
- Q4: Brief service interruption during cloud provider region failure

## Budget Allocation
- **Infrastructure**: 35% on-premises, 40% cloud, 25% network/security
- **Personnel**: 60% operations, 30% development, 10% security
- **Growth Rate**: 15% annual increase in cloud spending, 5% decrease in on-premises`,
  nodes: [
    // Security Zones
    {
      id: 'internet-zone',
      type: 'securityZone',
      position: { x: 50, y: 50 },
      data: {
        label: 'Internet Zone',
        zoneType: 'Internet' as SecurityZone,
        description: 'Public internet access zone',
        zone: 'External' as SecurityZone
      },
      style: {
        width: 600,
        height: 1000,
        background: colors.zoneBackgrounds.Internet,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'external-zone',
      type: 'securityZone',
      position: { x: 770, y: 50 },
      data: {
        label: 'External Zone',
        zoneType: 'External' as SecurityZone,
        description: 'External services and edge protection'
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
      position: { x: 1540, y: 50 },
      data: {
        label: 'DMZ Zone',
        zoneType: 'DMZ' as SecurityZone,
        description: 'Demilitarized zone'
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
      position: { x: 2410, y: 50 },
      data: {
        label: 'Internal Zone',
        zoneType: 'Internal' as SecurityZone,
        description: 'Internal corporate network'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Internal,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'trusted-zone',
      type: 'securityZone',
      position: { x: 3280, y: 50 },
      data: {
        label: 'Trusted Zone',
        zoneType: 'Trusted' as SecurityZone,
        description: 'High-trust application zone'
      },
      style: {
        width: 650,
        height: 1000,
        background: colors.zoneBackgrounds.Trusted,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'restricted-zone',
      type: 'securityZone',
      position: { x: 4050, y: 50 },
      data: {
        label: 'Restricted Zone',
        zoneType: 'Restricted' as SecurityZone,
        description: 'Highly restricted data zone'
      },
      style: {
        width: 650,
        height: 1000,
        background: colors.zoneBackgrounds.Restricted,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'aws-cloud-zone',
      type: 'securityZone',
      position: { x: 2410, y: -1070 },
      data: {
        label: 'AWS Cloud Zone',
        zoneType: 'Cloud' as SecurityZone,
        description: 'Amazon Web Services cloud'
      },
      style: {
        width: 650,
        height: 1000,
        background: colors.zoneBackgrounds.Cloud,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'azure-cloud-zone',
      type: 'securityZone',
      position: { x: 3280, y: -1070 },
      data: {
        label: 'Azure Cloud Zone',
        zoneType: 'Cloud' as SecurityZone,
        description: 'Microsoft Azure cloud'
      },
      style: {
        width: 650,
        height: 1000,
        background: colors.zoneBackgrounds.Cloud,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'guest-zone',
      type: 'securityZone',
      position: { x: 1540, y: 1170 },
      data: {
        label: 'Guest Zone',
        zoneType: 'Guest' as SecurityZone,
        description: 'Guest and partner access'
      },
      style: {
        width: 650,
        height: 1000,
        background: colors.zoneBackgrounds.Guest,
        zIndex: -1
      }
    } as SecurityNode,

    // Internet Zone Components (zone x=50, delta=0)
    {
      id: 'public-dns',
      type: 'dns',
      position: { x: 150, y: 200 },
      data: {
        label: 'Public DNS',
        description: 'Global DNS resolution service',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        protocols: ['DNS', 'DNSSEC'],
        vendor: 'cloudflare',
        product: 'dns',
        version: 'current'
      }
    } as SecurityNode,
    {
      id: 'ddos-protection',
      type: 'ddosProtection',
      position: { x: 370, y: 350 },
      data: {
        label: 'DDoS Protection',
        description: 'Cloud-based DDoS mitigation',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        protocols: ['BGP', 'GRE'],
        vendor: 'cloudflare',
        product: 'magic-transit',
        version: 'current'
      }
    } as SecurityNode,

    // External Zone Components (zone x=770, delta=-50)
    {
      id: 'global-lb',
      type: 'loadBalancer',
      position: { x: 870, y: 350 },
      data: {
        label: 'Global Load Balancer',
        description: 'Multi-region traffic distribution',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'HTTP/2'],
        vendor: 'aws',
        product: 'alb',
        version: 'current',
        securityControls: ['Health Checks', 'SSL Termination']
      }
    } as SecurityNode,
    {
      id: 'waf',
      type: 'waf',
      position: { x: 1120, y: 200 },
      data: {
        label: 'Web Application Firewall',
        description: 'Layer 7 security filtering',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS'],
        vendor: 'aws',
        product: 'waf',
        version: 'v2',
        securityControls: ['OWASP CRS', 'Custom Rules'],
        additionalContext: 'Custom rules based on legacy regex patterns, some rules disabled due to false positives'
      }
    } as SecurityNode,
    {
      id: 'api-gateway',
      type: 'apiGateway',
      position: { x: 1020, y: 500 },
      data: {
        label: 'API Gateway Cluster',
        description: 'API management and throttling',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'OAuth'],
        vendor: 'kong',
        product: 'enterprise',
        version: '3.4',
        securityControls: ['Rate Limiting', 'OAuth 2.0']
      }
    } as SecurityNode,

    // DMZ Zone Components (zone x=1540, delta=-50)
    {
      id: 'edge-fw',
      type: 'firewall',
      position: { x: 1640, y: 350 },
      data: {
        label: 'Edge Firewall Array',
        description: 'Stateful inspection firewall cluster',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['any'],
        vendor: 'fortinet',
        product: 'fortigate',
        version: '7.4.0',
        securityControls: ['IPS', 'HA Active-Active']
      }
    } as SecurityNode,
    {
      id: 'frontend-cache',
      type: 'cache',
      position: { x: 1890, y: 200 },
      data: {
        label: 'Frontend Cache',
        description: 'Application caching layer',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTP', 'Redis'],
        vendor: 'varnish',
        product: 'cache',
        version: '7.1',
        additionalContext: 'Cache invalidation rules complex, some stale data served occasionally'
      }
    } as SecurityNode,
    {
      id: 'bastion-host',
      type: 'bastionHost',
      position: { x: 1740, y: 650 },
      data: {
        label: 'Bastion Host Farm',
        description: 'Secure jump boxes for admin access',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['SSH', 'RDP'],
        vendor: 'linux',
        product: 'hardened',
        version: 'rhel8',
        securityControls: ['2FA', 'Session Recording'],
        additionalContext: 'SSH key management via manual distribution, session recordings stored for 30 days'
      }
    } as SecurityNode,
    {
      id: 'soc-connector',
      type: 'siem',
      position: { x: 1990, y: 500 },
      data: {
        label: 'SOC Integration Point',
        description: 'Security operations center connector',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['Syslog', 'TAXII'],
        vendor: 'custom',
        product: 'integration',
        version: '2.0'
      }
    } as SecurityNode,

    // Internal Zone Components (zone x=2410, delta=+50)
    {
      id: 'k8s-cluster',
      type: 'containerizedService',
      position: { x: 2510, y: 350 },
      data: {
        label: 'Kubernetes Production',
        description: 'Container orchestration platform',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'gRPC'],
        vendor: 'kubernetes',
        product: 'k8s',
        version: '1.28',
        technology: 'Istio Service Mesh',
        additionalContext: 'RBAC configured, some namespaces using default service accounts, pod security policies in permissive mode'
      }
    } as SecurityNode,
    {
      id: 'microservices',
      type: 'application',
      position: { x: 2760, y: 500 },
      data: {
        label: 'Microservices Layer',
        description: 'Business logic microservices',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'gRPC'],
        vendor: 'custom',
        product: 'microservices',
        version: 'various',
        technology: 'Spring Boot, Node.js',
        components: [
          { name: 'Spring Boot', version: '2.7.0' },
          { name: 'Node.js', version: '18.x' }
        ]
      }
    } as SecurityNode,
    {
      id: 'message-queue',
      type: 'messageBroker',
      position: { x: 2610, y: 650 },
      data: {
        label: 'Message Queue Cluster',
        description: 'Async messaging infrastructure',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['AMQP', 'Kafka'],
        vendor: 'apache',
        product: 'kafka',
        version: '3.5.0',
        additionalContext: 'Some queues configured with guest user enabled, TLS optional for internal connections'
      }
    } as SecurityNode,
    {
      id: 'internal-lb',
      type: 'loadBalancer',
      position: { x: 2860, y: 200 },
      data: {
        label: 'Internal Load Balancer',
        description: 'Service mesh load balancing',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTP', 'gRPC'],
        vendor: 'haproxy',
        product: 'enterprise',
        version: '2.8'
      }
    } as SecurityNode,

    // Trusted Zone Components (zone x=3280, delta=+150)
    {
      id: 'legacy-apps',
      type: 'application',
      position: { x: 3430, y: 350 },
      data: {
        label: 'Legacy Application Tier',
        description: 'Monolithic legacy applications',
        zone: 'Trusted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'SOAP'],
        vendor: 'oracle',
        product: 'weblogic',
        version: '12.1.3',
        technology: 'Java EE',
        patchLevel: 'Quarterly',
        additionalContext: 'Running on EOL WebLogic 12.1.3, patches applied quarterly'
      }
    } as SecurityNode,
    {
      id: 'etl-platform',
      type: 'application',
      position: { x: 3680, y: 500 },
      data: {
        label: 'ETL Processing Platform',
        description: 'Data transformation pipelines',
        zone: 'Trusted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['JDBC', 'HTTPS'],
        vendor: 'informatica',
        product: 'powerCenter',
        version: '10.5',
        securityControls: ['Data Masking', 'Audit Logging']
      }
    } as SecurityNode,
    {
      id: 'analytics-cluster',
      type: 'application',
      position: { x: 3530, y: 650 },
      data: {
        label: 'Analytics Cluster',
        description: 'Big data analytics platform',
        zone: 'Trusted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HDFS', 'Spark'],
        vendor: 'apache',
        product: 'hadoop',
        version: '3.3.4',
        technology: 'Hadoop, Spark'
      }
    } as SecurityNode,

    // Restricted Zone Components (zone x=4050, delta=+150)
    {
      id: 'core-db-cluster',
      type: 'database',
      position: { x: 4200, y: 350 },
      data: {
        label: 'Core Database Cluster',
        description: 'Primary transactional databases',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['SQL', 'Oracle Net'],
        vendor: 'oracle',
        product: 'rac',
        version: '19c',
        securityControls: ['TDE', 'Database Vault'],
        additionalContext: 'Multiple database engines, cross-database views configured, some databases using native authentication'
      }
    } as SecurityNode,
    {
      id: 'data-lake',
      type: 'dataLake',
      position: { x: 4450, y: 500 },
      data: {
        label: 'Enterprise Data Lake',
        description: 'Centralized data repository',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['S3', 'HDFS'],
        vendor: 'aws',
        product: 's3',
        version: 'current',
        securityControls: ['Encryption', 'Access Policies']
      }
    } as SecurityNode,
    {
      id: 'secrets-vault',
      type: 'secretsManager',
      position: { x: 4300, y: 650 },
      data: {
        label: 'Secrets Management',
        description: 'Centralized secrets vault',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS'],
        vendor: 'hashicorp',
        product: 'vault',
        version: '1.14',
        securityControls: ['HSM Backend', 'Auto-unseal']
      }
    } as SecurityNode,

    // AWS Cloud Zone Components (zone x=2410, delta=+50)
    {
      id: 'aws-vpc',
      type: 'cloudService',
      position: { x: 2510, y: -920 },
      data: {
        label: 'AWS VPC',
        description: 'Amazon Virtual Private Cloud',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['IPSec', 'HTTPS'],
        vendor: 'aws',
        product: 'vpc',
        version: 'current',
        securityControls: ['Transit Gateway', 'PrivateLink']
      }
    } as SecurityNode,
    {
      id: 'aws-compute',
      type: 'cloudService',
      position: { x: 2760, y: -770 },
      data: {
        label: 'AWS Compute Fleet',
        description: 'Elastic compute instances',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['SSH', 'RDP'],
        vendor: 'aws',
        product: 'ec2',
        version: 'current',
        additionalContext: 'Mix of instance types, some development instances in public subnets, IMDSv1 still enabled on older instances'
      }
    } as SecurityNode,
    {
      id: 'aws-storage',
      type: 'storageAccount',
      position: { x: 2610, y: -620 },
      data: {
        label: 'AWS Storage Services',
        description: 'Cloud storage services',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'S3'],
        vendor: 'aws',
        product: 's3',
        version: 'current'
      }
    } as SecurityNode,

    // Azure Cloud Zone Components (zone x=3280, delta=+150)
    {
      id: 'azure-vnet',
      type: 'cloudService',
      position: { x: 3430, y: -920 },
      data: {
        label: 'Azure VNet',
        description: 'Azure Virtual Network',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['IPSec', 'HTTPS'],
        vendor: 'azure',
        product: 'vnet',
        version: 'current',
        securityControls: ['ExpressRoute', 'Private Endpoints']
      }
    } as SecurityNode,
    {
      id: 'azure-services',
      type: 'cloudService',
      position: { x: 3680, y: -770 },
      data: {
        label: 'Azure PaaS Services',
        description: 'Platform services',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS'],
        vendor: 'azure',
        product: 'paas',
        version: 'current'
      }
    } as SecurityNode,
    {
      id: 'azure-ai',
      type: 'aiModel',
      position: { x: 3530, y: -620 },
      data: {
        label: 'Azure AI/ML Services',
        description: 'Machine learning platform',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS'],
        vendor: 'azure',
        product: 'ml',
        version: 'current',
        additionalContext: 'ML models trained on production data, model versioning implemented, some endpoints using API keys for auth'
      }
    } as SecurityNode,

    // Guest Zone Components (zone x=1540, delta=-50)
    {
      id: 'guest-wifi',
      type: 'wirelessController',
      position: { x: 1640, y: 1470 },
      data: {
        label: 'Guest WiFi Controller',
        description: 'Visitor network access',
        zone: 'Guest' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        protocols: ['WPA2', 'RADIUS'],
        vendor: 'cisco',
        product: 'wlc',
        version: '8.10'
      }
    } as SecurityNode,
    {
      id: 'partner-vpn',
      type: 'vpnGateway',
      position: { x: 1890, y: 1620 },
      data: {
        label: 'Partner VPN Gateway',
        description: 'B2B partner connections',
        zone: 'Guest' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['IPSec', 'IKEv2'],
        vendor: 'cisco',
        product: 'asa',
        version: '9.18',
        additionalContext: 'Multiple partner connections with varying security requirements, some using pre-shared keys'
      }
    } as SecurityNode,
    {
      id: 'vendor-portal',
      type: 'webServer',
      position: { x: 2040, y: 1470 },
      data: {
        label: 'Vendor Portal',
        description: 'Supplier collaboration platform',
        zone: 'Guest' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'SAML'],
        vendor: 'microsoft',
        product: 'sharepoint',
        version: 'online'
      }
    } as SecurityNode
  ],
  edges: [
    // Internet to External
    {
      id: 'e1',
      source: 'public-dns',
      target: 'global-lb',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'DNS Resolution',
        protocol: 'DNS',
        encryption: 'DNSSEC',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        zone: 'External' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e2',
      source: 'ddos-protection',
      target: 'global-lb',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Clean Traffic',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        zone: 'External' as SecurityZone
      }
    } as SecurityEdge,

    // External to DMZ
    {
      id: 'e3',
      source: 'global-lb',
      target: 'edge-fw',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'HTTPS/443',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e4',
      source: 'waf',
      target: 'edge-fw',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Filtered Requests',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e5',
      source: 'api-gateway',
      target: 'edge-fw',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'API Traffic',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,

    // DMZ Internal
    {
      id: 'e6',
      source: 'edge-fw',
      target: 'frontend-cache',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'left',
      data: {
        label: 'Cache Requests',
        protocol: 'HTTP',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e7',
      source: 'edge-fw',
      target: 'soc-connector',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Security Events',
        protocol: 'Syslog',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,

    // DMZ to Internal
    {
      id: 'e9',
      source: 'frontend-cache',
      target: 'k8s-cluster',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'App Requests',
        protocol: 'HTTPS',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e10',
      source: 'edge-fw',
      target: 'internal-lb',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Service Mesh',
        protocol: 'HTTPS',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,

    // Internal connections
    {
      id: 'e11',
      source: 'k8s-cluster',
      target: 'microservices',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Container Traffic',
        protocol: 'gRPC',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e12',
      source: 'microservices',
      target: 'message-queue',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Async Messages',
        protocol: 'AMQP',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,

    // Internal to Trusted
    {
      id: 'e14',
      source: 'microservices',
      target: 'legacy-apps',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Legacy Integration',
        protocol: 'SOAP',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e15',
      source: 'message-queue',
      target: 'etl-platform',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Data Pipeline',
        protocol: 'Kafka',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,

    // Trusted to Restricted
    {
      id: 'e17',
      source: 'legacy-apps',
      target: 'core-db-cluster',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'DB Queries',
        protocol: 'Oracle Net',
        encryption: 'Oracle Native',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e18',
      source: 'etl-platform',
      target: 'data-lake',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Data Load',
        protocol: 'S3',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e20',
      source: 'microservices',
      target: 'secrets-vault',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Secret Retrieval',
        protocol: 'HTTPS',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone
      }
    } as SecurityEdge,

    // Cloud connections - AWS
    {
      id: 'e21',
      source: 'k8s-cluster',
      target: 'aws-vpc',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Hybrid Connect',
        protocol: 'IPSec',
        encryption: 'AES-256',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e22',
      source: 'aws-vpc',
      target: 'aws-compute',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'VPC Traffic',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,

    // Cloud connections - Azure
    {
      id: 'e24',
      source: 'legacy-apps',
      target: 'azure-vnet',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'ExpressRoute',
        protocol: 'MPLS',
        encryption: 'IPSec',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e25',
      source: 'azure-vnet',
      target: 'azure-services',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'VNet Integration',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,

    // Cross-cloud
    {
      id: 'e27',
      source: 'aws-vpc',
      target: 'azure-vnet',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Cloud Interconnect',
        protocol: 'IPSec',
        encryption: 'AES-256',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,

    // Guest zone connections
    {
      id: 'e28',
      source: 'guest-wifi',
      target: 'edge-fw',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Guest Internet',
        protocol: 'HTTPS',
        encryption: 'WPA2',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        zone: 'Guest' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e29',
      source: 'partner-vpn',
      target: 'edge-fw',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Partner Access',
        protocol: 'IPSec',
        encryption: 'AES-256',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Guest' as SecurityZone
      }
    } as SecurityEdge,

    // Bastion access
    {
      id: 'e8',
      source: 'bastion-host',
      target: 'k8s-cluster',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Admin Access',
        protocol: 'SSH',
        encryption: 'SSH',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge
  ],
  attackPaths: [
    {
      id: 'ap-le-guest-pivot',
      name: 'Guest WiFi → Edge Firewall → K8s Cluster → Microservices → Core DB',
      strideCategory: 'Elevation of Privilege',
      riskLevel: 'Critical',
      description: 'Attacker on the guest WiFi network exploits misconfigured edge firewall rules to reach the Kubernetes cluster, pivots through microservices, and accesses the core database cluster.',
      steps: [
        { order: 1, edgeId: 'e28', sourceNodeId: 'guest-wifi', targetNodeId: 'edge-fw', technique: 'T1078: Valid Accounts' },
        { order: 2, edgeId: 'e9', sourceNodeId: 'frontend-cache', targetNodeId: 'k8s-cluster', technique: 'T1190: Exploit Public-Facing Application' },
        { order: 3, edgeId: 'e11', sourceNodeId: 'k8s-cluster', targetNodeId: 'microservices', technique: 'T1610: Deploy Container' },
        { order: 4, edgeId: 'e14', sourceNodeId: 'microservices', targetNodeId: 'legacy-apps', technique: 'T1021: Remote Services' },
        { order: 5, edgeId: 'e17', sourceNodeId: 'legacy-apps', targetNodeId: 'core-db-cluster', technique: 'T1005: Data from Local System' },
      ],
      mitreTechniques: ['T1078', 'T1190', 'T1610', 'T1021', 'T1005'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-le-partner-vpn',
      name: 'Partner VPN → Edge Firewall → Internal LB → Legacy Apps → Data Lake',
      strideCategory: 'Information Disclosure',
      riskLevel: 'High',
      description: 'Compromised partner VPN credentials allow access through the edge firewall, reaching legacy applications that have broad access to the data lake.',
      steps: [
        { order: 1, edgeId: 'e29', sourceNodeId: 'partner-vpn', targetNodeId: 'edge-fw', technique: 'T1133: External Remote Services' },
        { order: 2, edgeId: 'e10', sourceNodeId: 'edge-fw', targetNodeId: 'internal-lb', technique: 'T1090: Proxy' },
        { order: 3, edgeId: 'e15', sourceNodeId: 'message-queue', targetNodeId: 'etl-platform', technique: 'T1570: Lateral Tool Transfer' },
        { order: 4, edgeId: 'e18', sourceNodeId: 'etl-platform', targetNodeId: 'data-lake', technique: 'T1530: Data from Cloud Storage Object' },
      ],
      mitreTechniques: ['T1133', 'T1090', 'T1570', 'T1530'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-le-multi-cloud-lateral',
      name: 'AWS VPC → Azure VNet → Azure AI Services Cross-Cloud Lateral',
      strideCategory: 'Elevation of Privilege',
      riskLevel: 'High',
      description: 'Attacker compromises AWS workloads and uses the cross-cloud VPC-to-VNet peering to move laterally into Azure services, accessing AI capabilities and data.',
      steps: [
        { order: 1, edgeId: 'e21', sourceNodeId: 'k8s-cluster', targetNodeId: 'aws-vpc', technique: 'T1078.004: Valid Accounts: Cloud Accounts' },
        { order: 2, edgeId: 'e22', sourceNodeId: 'aws-vpc', targetNodeId: 'aws-compute', technique: 'T1021: Remote Services' },
        { order: 3, edgeId: 'e27', sourceNodeId: 'aws-vpc', targetNodeId: 'azure-vnet', technique: 'T1570: Lateral Tool Transfer' },
        { order: 4, edgeId: 'e25', sourceNodeId: 'azure-vnet', targetNodeId: 'azure-services', technique: 'T1530: Data from Cloud Storage Object' },
      ],
      mitreTechniques: ['T1078.004', 'T1021', 'T1570', 'T1530'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-le-bastion-to-secrets',
      name: 'Bastion Host → K8s Admin → Secrets Vault → Full Infrastructure Compromise',
      strideCategory: 'Spoofing',
      riskLevel: 'Critical',
      description: 'Attacker compromises the bastion host with stolen admin credentials, gains K8s cluster admin access, and extracts all secrets from the vault.',
      steps: [
        { order: 1, edgeId: 'e8', sourceNodeId: 'bastion-host', targetNodeId: 'k8s-cluster', technique: 'T1078: Valid Accounts' },
        { order: 2, edgeId: 'e11', sourceNodeId: 'k8s-cluster', targetNodeId: 'microservices', technique: 'T1610: Deploy Container' },
        { order: 3, edgeId: 'e20', sourceNodeId: 'microservices', targetNodeId: 'secrets-vault', technique: 'T1552: Unsecured Credentials' },
      ],
      mitreTechniques: ['T1078', 'T1610', 'T1552'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
  ],
  grcWorkspace: buildGrcWorkspace({
    tierCatalogue: [
      { id: 'le-t1-cyber', tier: 1 as const, label: 'Cyber Risk', description: 'Enterprise infrastructure security' },
      { id: 'le-t1-ops', tier: 1 as const, label: 'Operational Risk', description: 'Business continuity and availability' },
      { id: 'le-t1-compliance', tier: 1 as const, label: 'Compliance Risk', description: 'Multi-regulatory compliance' },
      { id: 'le-t2-network', tier: 2 as const, label: 'Network Security', parentId: 'le-t1-cyber', description: 'Perimeter, internal, and cloud network' },
      { id: 'le-t2-identity', tier: 2 as const, label: 'Identity & Access', parentId: 'le-t1-cyber', description: 'Authentication and authorization' },
      { id: 'le-t2-cloud', tier: 2 as const, label: 'Multi-Cloud Security', parentId: 'le-t1-cyber', description: 'AWS and Azure cross-cloud threats' },
      { id: 'le-t2-data', tier: 2 as const, label: 'Data Protection', parentId: 'le-t1-cyber', description: 'Core database and data lake security' },
      { id: 'le-t3-guest-access', tier: 3 as const, label: 'Guest Network Isolation', parentId: 'le-t2-network' },
      { id: 'le-t3-cross-cloud', tier: 3 as const, label: 'Cross-Cloud Lateral Movement', parentId: 'le-t2-cloud' },
      { id: 'le-t3-bastion', tier: 3 as const, label: 'Bastion Host Compromise', parentId: 'le-t2-identity' },
    ],
    assets: [
      { id: 'le-asset-k8s', name: 'Kubernetes Cluster', type: 'container_platform', owner: 'Platform Team', criticality: 5, linkedNodeIds: ['k8s-cluster'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'le-asset-coredb', name: 'Core Database Cluster', type: 'database', owner: 'DBA Team', criticality: 5, linkedNodeIds: ['core-db-cluster'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'le-asset-datalake', name: 'Data Lake', type: 'data_lake', owner: 'Data Team', criticality: 5, linkedNodeIds: ['data-lake'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'le-asset-vault', name: 'Secrets Vault', type: 'secret_manager', owner: 'Security Team', criticality: 5, linkedNodeIds: ['secrets-vault'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'le-asset-aws', name: 'AWS VPC Workloads', type: 'cloud_vpc', owner: 'Cloud Team', criticality: 4, linkedNodeIds: ['aws-vpc', 'aws-compute'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'le-asset-azure', name: 'Azure VNet Services', type: 'cloud_vnet', owner: 'Cloud Team', criticality: 4, linkedNodeIds: ['azure-vnet', 'azure-services'], status: 'active', createdAt: NOW, updatedAt: NOW },
    ],
    risks: [
      { id: 'le-risk-guest', title: 'Guest Network to Production Pivot', description: 'Insufficient guest WiFi isolation allows pivot to internal production systems.', tierId: 'le-t3-guest-access', linkedAssetIds: ['le-asset-k8s', 'le-asset-coredb'], likelihood: 'likelihood-3', impact: 'impact-5', currentScore: score('likelihood-3', 'impact-5'), status: 'open', owner: 'Network Team', createdAt: NOW, updatedAt: NOW },
      { id: 'le-risk-cross-cloud', title: 'Cross-Cloud Lateral Movement', description: 'AWS-to-Azure VPC peering enables lateral movement between cloud providers.', tierId: 'le-t3-cross-cloud', linkedAssetIds: ['le-asset-aws', 'le-asset-azure'], likelihood: 'likelihood-2', impact: 'impact-5', currentScore: score('likelihood-2', 'impact-5'), status: 'open', owner: 'Cloud Team', createdAt: NOW, updatedAt: NOW },
      { id: 'le-risk-bastion', title: 'Bastion Host to Secrets Vault Compromise', description: 'Compromised bastion with K8s admin access could extract all infrastructure secrets.', tierId: 'le-t3-bastion', linkedAssetIds: ['le-asset-vault', 'le-asset-k8s'], likelihood: 'likelihood-2', impact: 'impact-5', currentScore: score('likelihood-2', 'impact-5'), status: 'open', owner: 'Security Team', createdAt: NOW, updatedAt: NOW },
      { id: 'le-risk-partner', title: 'Partner VPN Access to Data Lake', description: 'Over-privileged partner VPN access enables data lake exfiltration.', tierId: 'le-t3-guest-access', linkedAssetIds: ['le-asset-datalake'], likelihood: 'likelihood-3', impact: 'impact-4', currentScore: score('likelihood-3', 'impact-4'), status: 'open', owner: 'Network Team', createdAt: NOW, updatedAt: NOW },
    ],
    assessments: [
      { id: 'le-assess-1', title: 'Enterprise Infrastructure Security Assessment', scope: 'Full multi-cloud enterprise architecture', status: 'in_progress', createdBy: 'Security Team', createdAt: NOW, updatedAt: NOW, threatModel: { nodeFindings: [{ nodeId: 'guest-wifi', findingIds: ['le-risk-guest'] }, { nodeId: 'bastion-host', findingIds: ['le-risk-bastion'] }, { nodeId: 'aws-vpc', findingIds: ['le-risk-cross-cloud'] }], edgeFindings: [{ edgeId: 'e28', findingIds: ['le-risk-guest'] }, { edgeId: 'e27', findingIds: ['le-risk-cross-cloud'] }, { edgeId: 'e8', findingIds: ['le-risk-bastion'] }] } },
    ],
    soaEntries: [
      { id: 'le-soa-1', controlSetId: CIS_CONTROL_SET_ID, controlId: 'cis-ctrl-01', status: 'partially_implemented', justification: 'Asset inventory exists but guest network devices not tracked.', linkedRiskIds: ['le-risk-guest'], implementationNotes: 'Extend asset inventory to include guest network segmentation.', owner: 'Network Team', createdAt: NOW, updatedAt: NOW },
      { id: 'le-soa-2', controlSetId: CIS_CONTROL_SET_ID, controlId: 'cis-ctrl-06', status: 'partially_implemented', justification: 'RBAC on K8s but bastion has broad admin access.', linkedRiskIds: ['le-risk-bastion'], implementationNotes: 'Implement JIT access for bastion and reduce standing privileges.', owner: 'Security Team', createdAt: NOW, updatedAt: NOW },
      { id: 'le-soa-3', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'ctrl-a01', status: 'partially_implemented', justification: 'Access controls exist but cross-cloud policies need review.', linkedRiskIds: ['le-risk-cross-cloud'], implementationNotes: 'Implement consistent cross-cloud access policies.', owner: 'Cloud Team', createdAt: NOW, updatedAt: NOW },
      { id: 'le-soa-4', controlSetId: CIS_CONTROL_SET_ID, controlId: 'cis-ctrl-03', status: 'implemented', justification: 'Data lake encryption and access logging in place.', linkedRiskIds: ['le-risk-partner'], implementationNotes: 'Review and restrict partner VPN access scope.', owner: 'Data Team', createdAt: NOW, updatedAt: NOW },
      { id: 'le-soa-5', controlSetId: CIS_CONTROL_SET_ID, controlId: 'cis-ctrl-08', status: 'implemented', justification: 'Centralized logging with SOC connector and analytics.', linkedRiskIds: ['le-risk-guest', 'le-risk-bastion', 'le-risk-cross-cloud'], implementationNotes: 'Add cross-cloud correlation rules.', owner: 'Security Team', createdAt: NOW, updatedAt: NOW },
    ],
    thirdParties: [
      {
        id: 'le-tp-aws', name: 'Amazon Web Services', description: 'Primary cloud provider hosting 35% of enterprise workloads including VPC, compute, and managed services.',
        category: 'cloud_provider' as const, status: 'active' as const, riskRating: 'critical' as const, dataClassification: 'confidential' as const,
        linkedAssetIds: ['le-asset-aws', 'le-asset-k8s'], linkedRiskIds: ['le-risk-cross-cloud', 'le-risk-guest'],
        contactName: 'Nathan Brooks', contactEmail: 'nathan.brooks@amazon.com',
        contractExpiry: '2028-12-31T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-06-01T00:00:00.000Z',
        notes: 'Enterprise Discount Program. AWS-to-Azure VPC peering lateral movement risk under active remediation.',
      },
      {
        id: 'le-tp-azure', name: 'Microsoft Azure', description: 'Secondary cloud provider hosting 25% of workloads including Azure VNet, identity services, and analytics.',
        category: 'cloud_provider' as const, status: 'active' as const, riskRating: 'critical' as const, dataClassification: 'confidential' as const,
        linkedAssetIds: ['le-asset-azure'], linkedRiskIds: ['le-risk-cross-cloud'],
        contactName: 'Maria Santos', contactEmail: 'maria.santos@microsoft.com',
        contractExpiry: '2028-06-30T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-06-01T00:00:00.000Z',
        notes: 'Enterprise Agreement. Cross-cloud access policies need unified review across AWS and Azure.',
      },
      {
        id: 'le-tp-snowflake', name: 'Snowflake', description: 'Cloud data platform providing the enterprise data lake for analytics, reporting, and ML workloads.',
        category: 'saas' as const, status: 'active' as const, riskRating: 'high' as const, dataClassification: 'confidential' as const,
        linkedAssetIds: ['le-asset-datalake'], linkedRiskIds: ['le-risk-partner'],
        contactName: 'Jessica Turner', contactEmail: 'jessica.turner@snowflake.com',
        contractExpiry: '2027-09-30T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-08-15T00:00:00.000Z',
        notes: 'Partner VPN access to data lake is over-privileged. Row-level security policies under implementation.',
      },
      {
        id: 'le-tp-hashicorp', name: 'HashiCorp', description: 'Secrets management platform (Vault) securing infrastructure credentials across multi-cloud deployments.',
        category: 'saas' as const, status: 'active' as const, riskRating: 'critical' as const, dataClassification: 'restricted' as const,
        linkedAssetIds: ['le-asset-vault'], linkedRiskIds: ['le-risk-bastion'],
        contactName: 'Daniel Wright', contactEmail: 'daniel.wright@hashicorp.com',
        contractExpiry: '2027-12-31T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-07-01T00:00:00.000Z',
        notes: 'Vault Enterprise with namespaces. Bastion host has broad K8s admin access to Vault namespace requiring JIT access implementation.',
      },
      {
        id: 'le-tp-accenture', name: 'Accenture', description: 'Cloud operations managed services provider supporting multi-cloud infrastructure management and migrations.',
        category: 'contractor' as const, status: 'active' as const, riskRating: 'high' as const, dataClassification: 'confidential' as const,
        linkedAssetIds: ['le-asset-aws', 'le-asset-azure', 'le-asset-k8s'], linkedRiskIds: ['le-risk-cross-cloud', 'le-risk-bastion'],
        contactName: 'Priya Sharma', contactEmail: 'priya.sharma@accenture.com',
        contractExpiry: '2027-03-31T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-09-01T00:00:00.000Z',
        notes: 'Managed services team has standing bastion access. Access review cadence needs to move from annual to quarterly.',
      },
    ],
  } as any),
};