import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityNode, SecurityEdge, SecurityZone } from '../../types/SecurityTypes';
import { colors } from '../../styles/Theme';
import { DiagramAttackPath } from '../../types/GrcTypes';
import { buildGrcWorkspace, score, NOW, OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID } from './grcSharedBase';

export const mediumComplexSystem: ExampleSystem = {
  id: 'medium-complex-system',
  name: 'Medium Complex DevOps Platform',
  description: 'Comprehensive DevOps platform with CI/CD pipeline, multiple environments, and cloud integration',
  category: 'Enterprise Systems',
  // securityLevel removed - no longer part of the system model
  primaryZone: 'Production',
  dataClassification: 'Sensitive',
  customContext: `# Medium Complex DevOps Platform

## System Overview
This DevOps platform supports a mid-sized SaaS company with 500 developers across 50 agile teams. The platform enables continuous integration and deployment for a multi-tenant B2B application serving financial services customers.

## Business Context
- **Company Size**: 2,000 employees, $200M ARR
- **Development Teams**: 50 scrum teams, 500 developers
- **Deployment Frequency**: 200+ deployments per day to production
- **Service Level**: 99.9% uptime SLA for enterprise customers
- **Compliance**: PCI DSS Level 2, SOC 2 Type II, GDPR

## Architecture Philosophy
- **GitOps**: All configuration and infrastructure defined as code
- **Shift-Left Security**: Security integrated into development process
- **Progressive Delivery**: Feature flags and canary deployments
- **Observability First**: Metrics, logs, and traces for all services

## Technology Stack
- **Languages**: Java (60%), Node.js (30%), Python (10%)
- **Frameworks**: Spring Boot, Express, FastAPI
- **Databases**: PostgreSQL primary, MongoDB for specific use cases
- **Container Platform**: Kubernetes across all environments
- **CI/CD**: Jenkins for builds, ArgoCD for deployments

## Environment Strategy
- **Development**: Individual developer namespaces, shared services
- **Staging**: Production-like environment with sanitized data
- **Production**: Multi-region deployment with active-active configuration
- **Disaster Recovery**: Automated failover to secondary region

## Security Measures
- **Code Scanning**: SAST and DAST integrated into pipeline
- **Container Security**: Image scanning and runtime protection
- **Secrets Management**: HashiCorp Vault for all environments
- **Access Control**: RBAC with principle of least privilege

## Current Challenges
- **Technical Debt**: Legacy monolith still handles 30% of traffic
- **Tool Proliferation**: Teams using different monitoring solutions
- **Cost Management**: Cloud costs increasing 20% quarter-over-quarter
- **Compliance Overhead**: Manual evidence collection for audits

## Recent Improvements
- Migrated from VM-based to container-based infrastructure
- Implemented automated rollback based on error rates
- Reduced deployment time from 2 hours to 15 minutes
- Achieved 80% test coverage across critical services

## Operational Metrics
- **Build Success Rate**: 85% (target: 95%)
- **Mean Time to Deploy**: 15 minutes
- **Change Failure Rate**: 5% (industry average: 15%)
- **Mean Time to Recovery**: 30 minutes

## Team Structure
- **Platform Team**: 20 engineers maintaining DevOps infrastructure
- **Security Team**: 5 engineers focused on DevSecOps
- **SRE Team**: 10 engineers ensuring reliability
- **Developer Experience**: 8 engineers improving tools and processes

## Upcoming Initiatives
- Service mesh implementation for better observability
- Multi-cloud strategy to avoid vendor lock-in
- AI-powered anomaly detection for production issues
- Automated compliance reporting and evidence collection`,
  nodes: [
    // Security Zones
    // External: 2 nodes → 600px, x=50
    {
      id: 'external-zone',
      type: 'securityZone',
      position: { x: 50, y: 50 },
      data: {
        label: 'External Zone',
        zoneType: 'External' as SecurityZone,
        description: 'External services and repositories',
        zone: 'Development' as SecurityZone
      },
      style: {
        width: 600,
        height: 1000,
        background: colors.zoneBackgrounds.External,
        zIndex: -1
      }
    } as SecurityNode,
    // Development: 4 nodes → 750px, x=770
    {
      id: 'development-zone',
      type: 'securityZone',
      position: { x: 770, y: 50 },
      data: {
        label: 'Development Zone',
        zoneType: 'Development' as SecurityZone,
        description: 'Development and build environment'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Development,
        zIndex: -1
      }
    } as SecurityNode,
    // Staging: 4 nodes → 750px, x=1640
    {
      id: 'staging-zone',
      type: 'securityZone',
      position: { x: 1640, y: 50 },
      data: {
        label: 'Staging Zone',
        zoneType: 'Staging' as SecurityZone,
        description: 'Pre-production testing environment'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Staging,
        zIndex: -1
      }
    } as SecurityNode,
    // Production: 4 nodes → 750px, x=2510
    {
      id: 'production-zone',
      type: 'securityZone',
      position: { x: 2510, y: 50 },
      data: {
        label: 'Production Zone',
        zoneType: 'Production' as SecurityZone,
        description: 'Live production environment'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Production,
        zIndex: -1
      }
    } as SecurityNode,
    // Trusted: 3 nodes → 600px, x=3380
    {
      id: 'trusted-zone',
      type: 'securityZone',
      position: { x: 3380, y: 50 },
      data: {
        label: 'Trusted Zone',
        zoneType: 'Trusted' as SecurityZone,
        description: 'Critical data and payment processing'
      },
      style: {
        width: 600,
        height: 1000,
        background: colors.zoneBackgrounds.Trusted,
        zIndex: -1
      }
    } as SecurityNode,
    // Cloud: 3 nodes → 600px, above at y=-1070, aligned with Production x=2510
    {
      id: 'cloud-zone',
      type: 'securityZone',
      position: { x: 2510, y: -1070 },
      data: {
        label: 'Cloud Zone',
        zoneType: 'Cloud' as SecurityZone,
        description: 'Cloud services and serverless'
      },
      style: {
        width: 600,
        height: 1000,
        background: colors.zoneBackgrounds.Cloud,
        zIndex: -1
      }
    } as SecurityNode,
    // Compliance: 3 nodes → 600px, x=4100
    {
      id: 'compliance-zone',
      type: 'securityZone',
      position: { x: 4100, y: 50 },
      data: {
        label: 'Compliance Zone',
        zoneType: 'Compliance' as SecurityZone,
        description: 'Monitoring and compliance systems'
      },
      style: {
        width: 600,
        height: 1000,
        background: colors.zoneBackgrounds.Compliance,
        zIndex: -1
      }
    } as SecurityNode,

    // External Zone Components (zone x=50, nodes shifted to fit 600px)
    {
      id: 'github',
      type: 'codeRepository',
      position: { x: 100, y: 350 },
      data: {
        label: 'GitHub Enterprise',
        description: 'Source code repository',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['Git', 'HTTPS', 'SSH'],
        vendor: 'github',
        product: 'enterprise',
        version: '3.10',
        securityControls: ['MFA', 'SSO', 'Branch Protection']
      }
    } as SecurityNode,
    {
      id: 'npm-registry',
      type: 'storage',
      position: { x: 350, y: 200 },
      data: {
        label: 'NPM Registry Mirror',
        description: 'Package repository cache',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        protocols: ['HTTPS'],
        vendor: 'sonatype',
        product: 'nexus',
        version: '3.45',
        additionalContext: 'Public mirror with no authentication required for read access'
      }
    } as SecurityNode,

    // Development Zone Components (zone x shifted from 820→770, delta=-50)
    {
      id: 'dev-k8s',
      type: 'kubernetesService',
      position: { x: 870, y: 350 },
      data: {
        label: 'Dev Kubernetes',
        description: 'Development cluster',
        zone: 'Development' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'kubectl'],
        vendor: 'kubernetes',
        product: 'k8s',
        version: '1.27',
        additionalContext: 'Developer laptops have cluster-admin access, no network policies enforced'
      }
    } as SecurityNode,
    {
      id: 'ci-runners',
      type: 'cicdSecurity',
      position: { x: 1120, y: 200 },
      data: {
        label: 'CI Runner Pool',
        description: 'Build agents',
        zone: 'Development' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'Docker'],
        vendor: 'jenkins',
        product: 'jenkins',
        version: '2.426',
        securityControls: ['Container Isolation', 'Build Timeouts']
      }
    } as SecurityNode,
    {
      id: 'artifact-store',
      type: 'storage',
      position: { x: 970, y: 500 },
      data: {
        label: 'Artifact Repository',
        description: 'Build artifact storage',
        zone: 'Development' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'Maven', 'PyPI'],
        vendor: 'jfrog',
        product: 'artifactory',
        version: '7.71',
        additionalContext: 'Anonymous read access enabled for convenience, some artifacts contain embedded credentials'
      }
    } as SecurityNode,
    {
      id: 'dev-db',
      type: 'database',
      position: { x: 1220, y: 650 },
      data: {
        label: 'Development Database',
        description: 'Dev/test databases',
        zone: 'Development' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['PostgreSQL', 'MongoDB'],
        vendor: 'postgres',
        product: 'postgresql',
        version: '15.4',
        additionalContext: 'Contains production data copies with basic masking'
      }
    } as SecurityNode,

    // Staging Zone Components (zone x shifted from 1590→1640, delta=+50)
    {
      id: 'staging-lb',
      type: 'loadBalancer',
      position: { x: 1740, y: 200 },
      data: {
        label: 'Staging Load Balancer',
        description: 'Pre-production traffic distribution',
        zone: 'Staging' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'HTTP/2'],
        vendor: 'nginx',
        product: 'nginx-plus',
        version: '1.25',
        securityControls: ['SSL Termination', 'Rate Limiting']
      }
    } as SecurityNode,
    {
      id: 'staging-k8s',
      type: 'kubernetesService',
      position: { x: 1840, y: 350 },
      data: {
        label: 'Staging Kubernetes',
        description: 'Pre-production cluster',
        zone: 'Staging' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'gRPC'],
        vendor: 'kubernetes',
        product: 'k8s',
        version: '1.28',
        securityControls: ['RBAC', 'Network Policies', 'PSP']
      }
    } as SecurityNode,
    {
      id: 'qa-automation',
      type: 'application',
      position: { x: 2090, y: 500 },
      data: {
        label: 'QA Automation Suite',
        description: 'Automated testing infrastructure',
        zone: 'Staging' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'WebDriver'],
        vendor: 'selenium',
        product: 'grid',
        version: '4.15',
        securityControls: ['Test Isolation', 'Data Sanitization']
      }
    } as SecurityNode,
    {
      id: 'staging-db',
      type: 'database',
      position: { x: 1940, y: 650 },
      data: {
        label: 'Staging Database',
        description: 'Production data subset',
        zone: 'Staging' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['PostgreSQL', 'SSL'],
        vendor: 'postgres',
        product: 'postgresql',
        version: '15.4',
        additionalContext: 'Production data copied daily with basic masking, some PII fields remain unmasked'
      }
    } as SecurityNode,

    // Production Zone Components (zone x shifted from 2360→2510, delta=+150)
    {
      id: 'prod-gateway',
      type: 'apiGateway',
      position: { x: 2610, y: 200 },
      data: {
        label: 'API Gateway',
        description: 'Production API management',
        zone: 'Production' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'OAuth 2.0'],
        vendor: 'kong',
        product: 'kong-enterprise',
        version: '3.4',
        securityControls: ['Rate Limiting', 'OAuth', 'API Keys']
      }
    } as SecurityNode,
    {
      id: 'prod-k8s',
      type: 'kubernetesService',
      position: { x: 2710, y: 350 },
      data: {
        label: 'Production Kubernetes',
        description: 'Production container platform',
        zone: 'Production' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'gRPC'],
        vendor: 'kubernetes',
        product: 'k8s',
        version: '1.28',
        securityControls: ['RBAC', 'Network Policies', 'OPA', 'Falco']
      }
    } as SecurityNode,
    {
      id: 'prod-services',
      type: 'service',
      position: { x: 2960, y: 500 },
      data: {
        label: 'Microservices',
        description: 'Business logic services',
        zone: 'Production' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'gRPC'],
        vendor: 'custom',
        product: 'microservices',
        version: 'various',
        technology: 'Spring Boot, Node.js',
        components: [
          { name: 'User Service', version: '2.1.0' },
          { name: 'Order Service', version: '3.5.2' },
          { name: 'Inventory Service', version: '1.8.7' }
        ]
      }
    } as SecurityNode,
    {
      id: 'prod-cache',
      type: 'cache',
      position: { x: 2810, y: 650 },
      data: {
        label: 'Production Cache',
        description: 'Distributed cache layer',
        zone: 'Production' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['Redis Protocol', 'TLS'],
        vendor: 'redis',
        product: 'redis-cluster',
        version: '7.2',
        securityControls: ['ACLs', 'TLS', 'At-Rest Encryption']
      }
    } as SecurityNode,

    // Trusted Zone Components (zone x shifted from 3130→3380, delta=+250)
    {
      id: 'prod-db',
      type: 'database',
      position: { x: 3530, y: 350 },
      data: {
        label: 'Production Database',
        description: 'Primary data store',
        zone: 'Trusted' as SecurityZone,
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
      id: 'payment-processor',
      type: 'service',
      position: { x: 3730, y: 500 },
      data: {
        label: 'Payment Gateway',
        description: 'Payment processing service',
        zone: 'Trusted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'TLS 1.3'],
        vendor: 'stripe',
        product: 'payment-api',
        version: 'latest',
        securityControls: ['PCI Certified', 'Tokenization', 'HSM']
      }
    } as SecurityNode,
    {
      id: 'audit-service',
      type: 'logging',
      position: { x: 3630, y: 650 },
      data: {
        label: 'Audit Log Service',
        description: 'Compliance audit trail',
        zone: 'Trusted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'Syslog'],
        vendor: 'custom',
        product: 'audit-logger',
        version: '1.0',
        securityControls: ['Immutable Logs', 'Digital Signatures', 'WORM']
      }
    } as SecurityNode,

    // Cloud Zone Components (zone x shifted from 2360→2510, delta=+150)
    {
      id: 'cloud-cdn',
      type: 'cloudService',
      position: { x: 2610, y: -920 },
      data: {
        label: 'CloudFront CDN',
        description: 'Content delivery network',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        protocols: ['HTTPS', 'HTTP/2'],
        vendor: 'aws',
        product: 'cloudfront',
        version: 'current',
        securityControls: ['WAF', 'DDoS Protection', 'Geo-blocking']
      }
    } as SecurityNode,
    {
      id: 'cloud-functions',
      type: 'functionApp',
      position: { x: 2860, y: -770 },
      data: {
        label: 'Serverless Functions',
        description: 'Event-driven compute',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'Event Bridge'],
        vendor: 'aws',
        product: 'lambda',
        version: 'nodejs18.x',
        additionalContext: 'Functions have broad IAM permissions, environment variables contain API keys'
      }
    } as SecurityNode,
    {
      id: 'cloud-analytics',
      type: 'dataLake',
      position: { x: 2710, y: -620 },
      data: {
        label: 'Analytics Platform',
        description: 'Business intelligence',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'SQL'],
        vendor: 'snowflake',
        product: 'data-warehouse',
        version: 'current',
        securityControls: ['Column Encryption', 'Data Masking']
      }
    } as SecurityNode,

    // Compliance Zone Components (zone x shifted from 3900→4100, delta=+200)
    {
      id: 'log-aggregator',
      type: 'siem',
      position: { x: 4250, y: 350 },
      data: {
        label: 'Log Aggregation',
        description: 'Centralized logging',
        zone: 'Compliance' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'Syslog', 'Beats'],
        vendor: 'elastic',
        product: 'elasticsearch',
        version: '8.11',
        securityControls: ['Encryption', 'RBAC', 'Audit Trail']
      }
    } as SecurityNode,
    {
      id: 'security-scanner',
      type: 'vulnerabilityScanner',
      position: { x: 4450, y: 500 },
      data: {
        label: 'Security Scanner',
        description: 'Vulnerability assessment',
        zone: 'Compliance' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'SSH'],
        vendor: 'sonarqube',
        product: 'enterprise',
        version: '10.3',
        additionalContext: 'Scans run weekly in production, critical findings often postponed due to release pressure'
      }
    } as SecurityNode,
    {
      id: 'backup-service',
      type: 'backupSystem',
      position: { x: 4300, y: 650 },
      data: {
        label: 'Backup Service',
        description: 'Data backup and recovery',
        zone: 'Compliance' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'S3'],
        vendor: 'veeam',
        product: 'backup',
        version: '12.0',
        securityControls: ['Encryption', 'Immutable Storage', 'Air Gap']
      }
    } as SecurityNode
  ],
  edges: [
    // Development flow
    {
      id: 'e1',
      source: 'github',
      target: 'ci-runners',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Webhooks',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: true,
        zone: 'Development' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e2',
      source: 'npm-registry',
      target: 'ci-runners',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Package Pull',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        zone: 'Development' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e3',
      source: 'ci-runners',
      target: 'artifact-store',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Build Push',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: true,
        zone: 'Development' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e4',
      source: 'artifact-store',
      target: 'dev-k8s',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Deploy Dev',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: true,
        zone: 'Development' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e5',
      source: 'dev-k8s',
      target: 'dev-db',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'DB Connect',
        protocol: 'PostgreSQL',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: true,
        zone: 'Development' as SecurityZone
      }
    } as SecurityEdge,

    // Dev to Staging
    {
      id: 'e6',
      source: 'artifact-store',
      target: 'staging-k8s',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Promote Build',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: true,
        zone: 'Staging' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e7',
      source: 'ci-runners',
      target: 'qa-automation',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Trigger Tests',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: true,
        zone: 'Staging' as SecurityZone
      }
    } as SecurityEdge,

    // Staging flow
    {
      id: 'e8',
      source: 'staging-lb',
      target: 'staging-k8s',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Stage Traffic',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: true,
        zone: 'Staging' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e9',
      source: 'staging-k8s',
      target: 'staging-db',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Data Access',
        protocol: 'PostgreSQL',
        encryption: 'SSL',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: true,
        zone: 'Staging' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e10',
      source: 'qa-automation',
      target: 'staging-k8s',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Test Execution',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: true,
        zone: 'Staging' as SecurityZone
      }
    } as SecurityEdge,

    // Staging to Production
    {
      id: 'e11',
      source: 'staging-k8s',
      target: 'prod-k8s',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Prod Deploy',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Production' as SecurityZone
      }
    } as SecurityEdge,

    // Production flow
    {
      id: 'e12',
      source: 'prod-gateway',
      target: 'prod-k8s',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'API Traffic',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true,
        zone: 'Production' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e13',
      source: 'prod-k8s',
      target: 'prod-services',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Service Mesh',
        protocol: 'gRPC',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true,
        zone: 'Production' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e14',
      source: 'prod-services',
      target: 'prod-cache',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Cache Layer',
        protocol: 'Redis',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: true,
        zone: 'Production' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e15',
      source: 'prod-services',
      target: 'prod-db',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'DB Queries',
        protocol: 'PostgreSQL',
        encryption: 'SSL',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true,
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e16',
      source: 'prod-services',
      target: 'payment-processor',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Payments',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true,
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,

    // Audit flows
    {
      id: 'e17',
      source: 'prod-services',
      target: 'audit-service',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Audit Events',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e18',
      source: 'payment-processor',
      target: 'audit-service',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Payment Logs',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,

    // Cloud connections
    {
      id: 'e19',
      source: 'prod-gateway',
      target: 'cloud-cdn',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'CDN Origin',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e20',
      source: 'prod-services',
      target: 'cloud-functions',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Event Trigger',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: true,
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e21',
      source: 'prod-db',
      target: 'cloud-analytics',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'ETL Pipeline',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,

    // Compliance monitoring — route via bottom channel at y≈1010
    {
      id: 'e22',
      source: 'prod-k8s',
      target: 'log-aggregator',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'bottom',
      data: {
        label: 'Log Stream',
        protocol: 'Beats',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: true,
        zone: 'Compliance' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e23',
      source: 'staging-k8s',
      target: 'log-aggregator',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'bottom',
      data: {
        label: 'Stage Logs',
        protocol: 'Syslog',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Compliance' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e24',
      source: 'security-scanner',
      target: 'prod-k8s',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Vuln Scan',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Compliance' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e25',
      source: 'prod-db',
      target: 'backup-service',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'DB Backup',
        protocol: 'PostgreSQL',
        encryption: 'SSL',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Compliance' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e26',
      source: 'audit-service',
      target: 'backup-service',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Audit Backup',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Compliance' as SecurityZone
      }
    } as SecurityEdge,

    // Cross-zone data flow
    {
      id: 'e27',
      source: 'dev-db',
      target: 'staging-db',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Data Sync',
        protocol: 'PostgreSQL',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Staging' as SecurityZone
      }
    } as SecurityEdge
  ],
  attackPaths: [
    {
      id: 'ap-mc-supply-chain',
      name: 'npm Registry → CI Runners → Artifact Store → Prod K8s (Supply Chain)',
      strideCategory: 'Tampering',
      riskLevel: 'Critical',
      description: 'Attacker publishes a malicious npm package that is pulled during CI builds, injecting a backdoor into the artifact store which is then deployed to production Kubernetes.',
      steps: [
        { order: 1, edgeId: 'e2', sourceNodeId: 'npm-registry', targetNodeId: 'ci-runners', technique: 'T1195.002: Supply Chain Compromise: Software Supply Chain' },
        { order: 2, edgeId: 'e3', sourceNodeId: 'ci-runners', targetNodeId: 'artifact-store', technique: 'T1554: Compromise Client Software Binary' },
        { order: 3, edgeId: 'e11', sourceNodeId: 'staging-k8s', targetNodeId: 'prod-k8s', technique: 'T1072: Software Deployment Tools' },
        { order: 4, edgeId: 'e13', sourceNodeId: 'prod-k8s', targetNodeId: 'prod-services', technique: 'T1610: Deploy Container' },
      ],
      mitreTechniques: ['T1195.002', 'T1554', 'T1072', 'T1610'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-mc-prod-db-exfil',
      name: 'Prod Gateway → Prod Services → Payment Processor → Prod DB Exfiltration',
      strideCategory: 'Information Disclosure',
      riskLevel: 'Critical',
      description: 'Attacker exploits production services through the gateway, leverages the payment processor integration to extract transaction data, and exfiltrates from the production database.',
      steps: [
        { order: 1, edgeId: 'e12', sourceNodeId: 'prod-gateway', targetNodeId: 'prod-k8s', technique: 'T1190: Exploit Public-Facing Application' },
        { order: 2, edgeId: 'e13', sourceNodeId: 'prod-k8s', targetNodeId: 'prod-services', technique: 'T1078: Valid Accounts' },
        { order: 3, edgeId: 'e15', sourceNodeId: 'prod-services', targetNodeId: 'prod-db', technique: 'T1005: Data from Local System' },
      ],
      mitreTechniques: ['T1190', 'T1078', 'T1005'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-mc-staging-to-prod',
      name: 'Dev DB → Staging DB → Staging K8s → Prod K8s Lateral Movement',
      strideCategory: 'Elevation of Privilege',
      riskLevel: 'High',
      description: 'Attacker compromises development database credentials, moves laterally through staging, and exploits the staging-to-production promotion pipeline to reach production.',
      steps: [
        { order: 1, edgeId: 'e27', sourceNodeId: 'dev-db', targetNodeId: 'staging-db', technique: 'T1552: Unsecured Credentials' },
        { order: 2, edgeId: 'e9', sourceNodeId: 'staging-k8s', targetNodeId: 'staging-db', technique: 'T1078: Valid Accounts' },
        { order: 3, edgeId: 'e11', sourceNodeId: 'staging-k8s', targetNodeId: 'prod-k8s', technique: 'T1570: Lateral Tool Transfer' },
      ],
      mitreTechniques: ['T1552', 'T1078', 'T1570'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-mc-github-pipeline',
      name: 'GitHub Repository → CI Runners → QA Bypass → Production Deploy',
      strideCategory: 'Tampering',
      riskLevel: 'High',
      description: 'Attacker with repository access pushes malicious code through GitHub, triggers CI runners that bypass QA checks, deploying compromised code to production.',
      steps: [
        { order: 1, edgeId: 'e1', sourceNodeId: 'github', targetNodeId: 'ci-runners', technique: 'T1195.001: Supply Chain Compromise: Compromise Software Dependencies' },
        { order: 2, edgeId: 'e7', sourceNodeId: 'ci-runners', targetNodeId: 'qa-automation', technique: 'T1562: Impair Defenses' },
        { order: 3, edgeId: 'e3', sourceNodeId: 'ci-runners', targetNodeId: 'artifact-store', technique: 'T1554: Compromise Client Software Binary' },
      ],
      mitreTechniques: ['T1195.001', 'T1562', 'T1554'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
  ],
  grcWorkspace: buildGrcWorkspace({
    tierCatalogue: [
      { id: 'mc-t1-cyber', tier: 1 as const, label: 'Cyber Risk', description: 'Application and infrastructure security' },
      { id: 'mc-t1-ops', tier: 1 as const, label: 'Operational Risk', description: 'CI/CD and deployment risks' },
      { id: 'mc-t1-compliance', tier: 1 as const, label: 'Compliance Risk', description: 'PCI DSS and data protection' },
      { id: 'mc-t2-supply-chain', tier: 2 as const, label: 'Supply Chain', parentId: 'mc-t1-cyber', description: 'Third-party dependency threats' },
      { id: 'mc-t2-pipeline', tier: 2 as const, label: 'CI/CD Pipeline', parentId: 'mc-t1-ops', description: 'Build and deploy pipeline threats' },
      { id: 'mc-t2-data', tier: 2 as const, label: 'Data Protection', parentId: 'mc-t1-cyber', description: 'Production data security' },
      { id: 'mc-t2-env-sep', tier: 2 as const, label: 'Environment Separation', parentId: 'mc-t1-ops', description: 'Dev/staging/prod isolation' },
      { id: 'mc-t3-npm-poison', tier: 3 as const, label: 'Dependency Poisoning', parentId: 'mc-t2-supply-chain' },
      { id: 'mc-t3-pipeline-bypass', tier: 3 as const, label: 'Pipeline QA Bypass', parentId: 'mc-t2-pipeline' },
      { id: 'mc-t3-env-leak', tier: 3 as const, label: 'Cross-Environment Leak', parentId: 'mc-t2-env-sep' },
    ],
    assets: [
      { id: 'mc-asset-prod-db', name: 'Production Database', type: 'database', owner: 'DBA Team', criticality: 5, linkedNodeIds: ['prod-db'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'mc-asset-prod-k8s', name: 'Production Kubernetes Cluster', type: 'container_platform', owner: 'Platform Team', criticality: 5, linkedNodeIds: ['prod-k8s'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'mc-asset-ci', name: 'CI/CD Pipeline (Runners)', type: 'ci_cd', owner: 'DevOps Team', criticality: 4, linkedNodeIds: ['ci-runners'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'mc-asset-artifacts', name: 'Artifact Store', type: 'artifact_registry', owner: 'DevOps Team', criticality: 4, linkedNodeIds: ['artifact-store'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'mc-asset-payment', name: 'Payment Processor Integration', type: 'external_service', owner: 'Finance Team', criticality: 5, linkedNodeIds: ['payment-processor'], status: 'active', createdAt: NOW, updatedAt: NOW },
    ],
    risks: [
      { id: 'mc-risk-npm', title: 'npm Dependency Poisoning', description: 'Malicious npm package could inject backdoor into production via CI pipeline.', tierId: 'mc-t3-npm-poison', linkedAssetIds: ['mc-asset-ci', 'mc-asset-artifacts'], likelihood: 'likelihood-3', impact: 'impact-5', currentScore: score('likelihood-3', 'impact-5'), status: 'open', owner: 'DevOps Team', createdAt: NOW, updatedAt: NOW },
      { id: 'mc-risk-pipeline', title: 'CI/CD Pipeline QA Bypass', description: 'Insufficient gates allow unreviewed code to reach production.', tierId: 'mc-t3-pipeline-bypass', linkedAssetIds: ['mc-asset-ci', 'mc-asset-prod-k8s'], likelihood: 'likelihood-3', impact: 'impact-4', currentScore: score('likelihood-3', 'impact-4'), status: 'open', owner: 'DevOps Team', createdAt: NOW, updatedAt: NOW },
      { id: 'mc-risk-env-leak', title: 'Dev Credentials Leak to Staging/Prod', description: 'Shared credentials between environments allow lateral movement.', tierId: 'mc-t3-env-leak', linkedAssetIds: ['mc-asset-prod-db'], likelihood: 'likelihood-3', impact: 'impact-5', currentScore: score('likelihood-3', 'impact-5'), status: 'open', owner: 'DevOps Team', createdAt: NOW, updatedAt: NOW },
      { id: 'mc-risk-payment', title: 'Payment Data Exfiltration', description: 'Compromised production services could intercept payment processing data.', tierId: 'mc-t2-data', linkedAssetIds: ['mc-asset-payment', 'mc-asset-prod-db'], likelihood: 'likelihood-2', impact: 'impact-5', currentScore: score('likelihood-2', 'impact-5'), status: 'open', owner: 'Security Team', createdAt: NOW, updatedAt: NOW },
    ],
    assessments: [
      { id: 'mc-assess-1', title: 'CI/CD and Production Security Assessment', scope: 'Full pipeline from GitHub to production', status: 'in_progress', createdBy: 'Security Team', createdAt: NOW, updatedAt: NOW, threatModel: { nodeFindings: [{ nodeId: 'ci-runners', findingIds: ['mc-risk-npm', 'mc-risk-pipeline'] }, { nodeId: 'prod-db', findingIds: ['mc-risk-env-leak', 'mc-risk-payment'] }], edgeFindings: [{ edgeId: 'e2', findingIds: ['mc-risk-npm'] }, { edgeId: 'e27', findingIds: ['mc-risk-env-leak'] }] } },
    ],
    soaEntries: [
      { id: 'mc-soa-1', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'ctrl-a06', status: 'partially_implemented', justification: 'npm audit in CI but no lockfile integrity verification.', linkedRiskIds: ['mc-risk-npm'], implementationNotes: 'Add lockfile-lint and npm provenance checks.', owner: 'DevOps Team', createdAt: NOW, updatedAt: NOW },
      { id: 'mc-soa-2', controlSetId: CIS_CONTROL_SET_ID, controlId: 'cis-ctrl-04', status: 'partially_implemented', justification: 'K8s hardened but env separation has shared secrets.', linkedRiskIds: ['mc-risk-env-leak'], implementationNotes: 'Implement per-environment secret management.', owner: 'Platform Team', createdAt: NOW, updatedAt: NOW },
      { id: 'mc-soa-3', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'ctrl-a08', status: 'partially_implemented', justification: 'Code review required but force-merge possible for maintainers.', linkedRiskIds: ['mc-risk-pipeline'], implementationNotes: 'Enforce branch protection with no bypass exceptions.', owner: 'DevOps Team', createdAt: NOW, updatedAt: NOW },
      { id: 'mc-soa-4', controlSetId: CIS_CONTROL_SET_ID, controlId: 'cis-ctrl-08', status: 'implemented', justification: 'Centralized logging with log-aggregator.', linkedRiskIds: ['mc-risk-payment', 'mc-risk-env-leak'], implementationNotes: 'Add anomaly detection for cross-env access.', owner: 'Security Team', createdAt: NOW, updatedAt: NOW },
    ],
    thirdParties: [
      {
        id: 'mc-tp-aws',
        name: 'Amazon Web Services (AWS)',
        description: 'Primary cloud provider hosting the production Kubernetes cluster, managed databases, and container registry. Shared responsibility model for infrastructure security.',
        category: 'cloud_provider',
        status: 'active',
        riskRating: 'medium',
        dataClassification: 'confidential',
        linkedAssetIds: ['mc-asset-prod-k8s', 'mc-asset-prod-db'],
        linkedRiskIds: ['mc-risk-env-leak'],
        contactName: 'AWS Enterprise Support',
        contactEmail: 'enterprise-support@aws.example.com',
        contractExpiry: '2027-06-30',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-08-15',
        notes: 'SOC 2 Type II and ISO 27001 certified. EKS cluster runs across 3 AZs. Review IAM role segregation between environments.'
      },
      {
        id: 'mc-tp-github',
        name: 'GitHub (Microsoft)',
        description: 'SaaS platform for source code management, CI/CD pipeline runners, and code review workflows. All 50 teams use GitHub Actions for build and deployment.',
        category: 'saas',
        status: 'active',
        riskRating: 'high',
        dataClassification: 'confidential',
        linkedAssetIds: ['mc-asset-ci'],
        linkedRiskIds: ['mc-risk-npm', 'mc-risk-pipeline'],
        contactName: 'GitHub Enterprise Support',
        contactEmail: 'enterprise@github.example.com',
        contractExpiry: '2027-03-15',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-09-01',
        notes: 'GitHub Enterprise Cloud with SSO. Force-merge bypass for maintainers is a known risk. Self-hosted runners used for production deployments.'
      },
      {
        id: 'mc-tp-stripe',
        name: 'Stripe Inc.',
        description: 'Payment processing gateway handling all customer transactions. PCI DSS Level 1 certified. Integrated via server-side SDK in the payment processor node.',
        category: 'saas',
        status: 'active',
        riskRating: 'high',
        dataClassification: 'restricted',
        linkedAssetIds: ['mc-asset-payment'],
        linkedRiskIds: ['mc-risk-payment'],
        contactName: 'Stripe Enterprise Support',
        contactEmail: 'enterprise@stripe.example.com',
        contractExpiry: '2027-01-31',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-07-15',
        notes: 'PCI DSS Level 1 and SOC 2 certified. Webhook signature verification implemented. Monitor for API key rotation compliance.'
      },
      {
        id: 'mc-tp-jfrog',
        name: 'JFrog',
        description: 'SaaS artifact repository for storing build artifacts, Docker images, and npm packages. Critical dependency in the CI/CD pipeline supply chain.',
        category: 'saas',
        status: 'active',
        riskRating: 'medium',
        dataClassification: 'internal',
        linkedAssetIds: ['mc-asset-artifacts'],
        linkedRiskIds: ['mc-risk-npm'],
        contactName: 'JFrog Support',
        contactEmail: 'support@jfrog.example.com',
        contractExpiry: '2026-12-31',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-10-01',
        notes: 'Artifactory Pro with Xray vulnerability scanning. Ensure immutable artifact policies are enforced to prevent supply chain tampering.'
      },
    ],
  } as any),
};