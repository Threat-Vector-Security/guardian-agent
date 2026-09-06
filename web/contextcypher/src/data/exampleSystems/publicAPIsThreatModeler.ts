import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityNode, SecurityEdge, SecurityZone } from '../../types/SecurityTypes';
import { colors } from '../../styles/Theme';
import { DiagramAttackPath } from '../../types/GrcTypes';
import { buildGrcWorkspace, score, NOW, OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID } from './grcSharedBase';

export const publicAPIsThreatModeler: ExampleSystem = {
  id: 'public-apis-threat-modeler',
  name: 'Public APIs Platform',
  description: 'Large-scale public API platform with multiple API products, developer portal, and monetization',
  category: 'Web Applications',
  // securityLevel removed - no longer part of the system model
  primaryZone: 'DMZ',
  dataClassification: 'Sensitive',
  customContext: `# Public APIs Platform

## System Overview
This platform provides public APIs for a large technology company offering various services including maps, weather, financial data, and machine learning capabilities. The platform serves over 100,000 developers with 1 billion+ API calls daily.

## Business Model
- **Freemium**: Basic tier with rate limits
- **Pro Plans**: Higher limits, SLAs, premium features
- **Enterprise**: Custom limits, dedicated support, private endpoints
- **Revenue**: $50M ARR from API subscriptions

## API Products
1. **Maps API**: Geocoding, routing, places search
2. **Weather API**: Current conditions, forecasts, historical data
3. **Financial API**: Stock quotes, forex rates, crypto prices
4. **ML API**: Text analysis, image recognition, predictions
5. **Data API**: Public datasets, analytics, trends

## Architecture Overview
- **Gateway Layer**: Kong-based API gateway cluster
- **Service Layer**: Microservices for each API product
- **Data Layer**: Multi-model databases (SQL, NoSQL, TimeSeries)
- **Cache Layer**: Redis clusters for response caching
- **CDN**: Global edge locations for static content

## Developer Experience
- **Portal**: Self-service registration and key management
- **Documentation**: Interactive API docs with try-it-now
- **SDKs**: Official libraries for 10+ languages
- **Sandbox**: Free testing environment with mock data
- **Analytics**: Real-time usage dashboards

## Security Measures
- **Authentication**: API keys, OAuth 2.0, JWT tokens
- **Rate Limiting**: Per-key, per-IP, per-endpoint limits
- **DDoS Protection**: CloudFlare enterprise
- **WAF**: OWASP top 10 protection
- **Monitoring**: 24/7 SOC with automated alerts

## Operational Metrics
- **Availability**: 99.95% SLA for paid tiers
- **Response Time**: p50: 50ms, p99: 200ms
- **Error Rate**: < 0.1% for 5xx errors
- **Scale**: 50K requests per second peak

## Compliance & Standards
- **Certifications**: SOC 2 Type II, ISO 27001
- **Standards**: OpenAPI 3.0, REST best practices
- **Privacy**: GDPR, CCPA compliant
- **PCI DSS**: Level 1 for payment processing

## Current Challenges
- **API Sprawl**: 200+ endpoints across products
- **Version Management**: Supporting v1, v2, v3 simultaneously
- **Developer Friction**: Complex authentication for some APIs
- **Cost Management**: Infrastructure costs growing 40% YoY
- **Security**: Increasing sophisticated bot attacks

## Recent Incidents
- **DDoS Attack**: 10Gbps attack mitigated last month
- **Data Scraping**: Detected automated bulk data extraction
- **Key Leak**: 50+ API keys found on GitHub
- **Rate Limit Bypass**: Distributed attack using 10K IPs`,
  nodes: [
    // Security Zones
    // Internet: 3 nodes → 600px, x=50
    {
      id: 'internet-zone',
      type: 'securityZone',
      position: { x: 50, y: 50 },
      data: {
        label: 'Internet Zone',
        zoneType: 'Internet' as SecurityZone,
        description: 'Public internet and API consumers',
        zone: 'Internet' as SecurityZone
      },
      style: {
        width: 600,
        height: 1000,
        background: colors.zoneBackgrounds.Internet,
        zIndex: -1
      }
    } as SecurityNode,
    // DMZ: 4 nodes → 750px, x=770
    {
      id: 'dmz-zone',
      type: 'securityZone',
      position: { x: 770, y: 50 },
      data: {
        label: 'DMZ Zone',
        zoneType: 'DMZ' as SecurityZone,
        description: 'API gateway and edge services'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.DMZ,
        zIndex: -1
      }
    } as SecurityNode,
    // Internal: 6 nodes → 800px, x=1640
    {
      id: 'internal-zone',
      type: 'securityZone',
      position: { x: 1640, y: 50 },
      data: {
        label: 'Internal Zone',
        zoneType: 'Internal' as SecurityZone,
        description: 'API services and business logic'
      },
      style: {
        width: 800,
        height: 1000,
        background: colors.zoneBackgrounds.Internal,
        zIndex: -1
      }
    } as SecurityNode,
    // Restricted: 5 nodes → 750px, x=2560
    {
      id: 'restricted-zone',
      type: 'securityZone',
      position: { x: 2560, y: 50 },
      data: {
        label: 'Restricted Zone',
        zoneType: 'Restricted' as SecurityZone,
        description: 'Databases and sensitive data'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Restricted,
        zIndex: -1
      }
    } as SecurityNode,
    // Management: 4 nodes → 750px, x=3430
    {
      id: 'management-zone',
      type: 'securityZone',
      position: { x: 3430, y: 50 },
      data: {
        label: 'Management Zone',
        zoneType: 'Management' as SecurityZone,
        description: 'Admin and monitoring systems'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Management,
        zIndex: -1
      }
    } as SecurityNode,
    // Partner: 3 nodes → 600px, below at y=1170, aligned with Internal x=1640
    {
      id: 'partner-zone',
      type: 'securityZone',
      position: { x: 1640, y: 1170 },
      data: {
        label: 'Partner Zone',
        zoneType: 'Partner' as SecurityZone,
        description: 'Third-party data providers'
      },
      style: {
        width: 600,
        height: 1000,
        background: colors.zoneBackgrounds.Partner,
        zIndex: -1
      }
    } as SecurityNode,

    // Internet Zone Components (zone x=50, fit within 600px)
    {
      id: 'api-consumers',
      type: 'endpoint',
      position: { x: 100, y: 350 },
      data: {
        label: 'API Consumers',
        description: 'Developers and applications',
        zone: 'Internet' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        protocols: ['HTTPS'],
        technology: 'Various',
        additionalContext: 'Mix of authenticated and anonymous users, some using outdated SDKs'
      }
    } as SecurityNode,
    {
      id: 'developer-portal',
      type: 'webServer',
      position: { x: 350, y: 200 },
      data: {
        label: 'Developer Portal',
        description: 'Self-service portal for developers',
        zone: 'Internet' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS'],
        vendor: 'custom',
        product: 'dev-portal',
        version: '2.5',
        technology: 'React, Node.js',
        additionalContext: 'Password reset uses predictable tokens, session timeout set to 7 days'
      }
    } as SecurityNode,
    {
      id: 'cdn',
      type: 'cloudService',
      position: { x: 200, y: 500 },
      data: {
        label: 'CDN',
        description: 'Content delivery network',
        zone: 'Internet' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        protocols: ['HTTPS'],
        vendor: 'cloudflare',
        product: 'enterprise',
        version: 'latest',
        securityControls: ['DDoS Protection', 'WAF', 'Rate Limiting']
      }
    } as SecurityNode,

    // DMZ Zone Components (zone x shifted from 820→770, delta=-50)
    {
      id: 'api-gateway',
      type: 'apiGateway',
      position: { x: 870, y: 350 },
      data: {
        label: 'API Gateway Cluster',
        description: 'Kong gateway cluster',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'HTTP/2'],
        vendor: 'kong',
        product: 'gateway',
        version: '3.4',
        securityControls: ['Rate Limiting', 'API Key Validation', 'OAuth 2.0']
      }
    } as SecurityNode,
    {
      id: 'waf',
      type: 'waf',
      position: { x: 1120, y: 200 },
      data: {
        label: 'Web Application Firewall',
        description: 'API protection layer',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS'],
        vendor: 'f5',
        product: 'advanced-waf',
        version: '16.1',
        securityControls: ['OWASP Rules', 'Bot Detection', 'API Security']
      }
    } as SecurityNode,
    {
      id: 'rate-limiter',
      type: 'cache',
      position: { x: 970, y: 500 },
      data: {
        label: 'Rate Limiting Service',
        description: 'Distributed rate limiting',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['Redis Protocol'],
        vendor: 'redis',
        product: 'redis',
        version: '7.2',
        additionalContext: 'Rate limits can be bypassed by changing User-Agent header'
      }
    } as SecurityNode,
    {
      id: 'auth-service',
      type: 'authServer',
      position: { x: 1220, y: 650 },
      data: {
        label: 'Authentication Service',
        description: 'API key and OAuth provider',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'OAuth 2.0'],
        vendor: 'okta',
        product: 'auth0',
        version: 'latest',
        securityControls: ['MFA', 'Adaptive Authentication', 'Anomaly Detection']
      }
    } as SecurityNode,

    // Internal Zone Components (zone x shifted from 1590→1640, delta=+50)
    {
      id: 'maps-api',
      type: 'api',
      position: { x: 1740, y: 250 },
      data: {
        label: 'Maps API Service',
        description: 'Geocoding and routing APIs',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'gRPC'],
        vendor: 'custom',
        product: 'maps-api',
        version: '3.2',
        technology: 'Go',
        components: [
          { name: 'Geocoding Service', version: '3.2' },
          { name: 'Routing Engine', version: '2.8' }
        ]
      }
    } as SecurityNode,
    {
      id: 'weather-api',
      type: 'api',
      position: { x: 1990, y: 250 },
      data: {
        label: 'Weather API Service',
        description: 'Weather data and forecasts',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        protocols: ['HTTPS', 'REST'],
        vendor: 'custom',
        product: 'weather-api',
        version: '2.1',
        technology: 'Python',
        additionalContext: 'Caches external provider data, API keys stored in environment variables'
      }
    } as SecurityNode,
    {
      id: 'financial-api',
      type: 'api',
      position: { x: 1740, y: 450 },
      data: {
        label: 'Financial API Service',
        description: 'Market data and quotes',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'WebSocket'],
        vendor: 'custom',
        product: 'financial-api',
        version: '4.0',
        technology: 'Java',
        additionalContext: 'Real-time data feeds, some endpoints expose raw SQL error messages'
      }
    } as SecurityNode,
    {
      id: 'ml-api',
      type: 'aiGateway',
      position: { x: 1990, y: 450 },
      data: {
        label: 'ML API Service',
        description: 'Machine learning endpoints',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'gRPC'],
        vendor: 'custom',
        product: 'ml-api',
        version: '1.5',
        technology: 'Python, TensorFlow',
        components: [
          { name: 'Inference Engine', version: '1.5' },
          { name: 'Model Server', version: '2.0' }
        ]
      }
    } as SecurityNode,
    {
      id: 'api-cache',
      type: 'cache',
      position: { x: 1840, y: 650 },
      data: {
        label: 'API Response Cache',
        description: 'Distributed caching layer',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['Redis Protocol'],
        vendor: 'redis',
        product: 'redis-cluster',
        version: '7.2',
        securityControls: ['ACLs', 'Encryption at Rest']
      }
    } as SecurityNode,
    {
      id: 'message-queue',
      type: 'messageBroker',
      position: { x: 2090, y: 800 },
      data: {
        label: 'Event Queue',
        description: 'Async processing queue',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['AMQP', 'TLS'],
        vendor: 'rabbitmq',
        product: 'rabbitmq',
        version: '3.12',
        additionalContext: 'Default guest account still enabled, used for analytics events'
      }
    } as SecurityNode,

    // Restricted Zone Components (zone x shifted from 2360→2560, delta=+200)
    {
      id: 'maps-db',
      type: 'database',
      position: { x: 2660, y: 250 },
      data: {
        label: 'Maps Database',
        description: 'Geospatial data store',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['PostgreSQL', 'PostGIS'],
        vendor: 'postgres',
        product: 'postgresql',
        version: '15',
        securityControls: ['TDE', 'Row Level Security']
      }
    } as SecurityNode,
    {
      id: 'financial-db',
      type: 'database',
      position: { x: 2910, y: 250 },
      data: {
        label: 'Financial Database',
        description: 'Time-series market data',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['InfluxDB', 'TLS'],
        vendor: 'influxdata',
        product: 'influxdb',
        version: '2.7',
        securityControls: ['Encryption', 'Audit Logging']
      }
    } as SecurityNode,
    {
      id: 'user-db',
      type: 'database',
      position: { x: 2760, y: 450 },
      data: {
        label: 'User Database',
        description: 'Developer accounts and keys',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['MySQL', 'SSL'],
        vendor: 'mysql',
        product: 'mysql',
        version: '8.0',
        additionalContext: 'API keys stored in plaintext, passwords use bcrypt with cost 10'
      }
    } as SecurityNode,
    {
      id: 'analytics-db',
      type: 'dataLake',
      position: { x: 2960, y: 650 },
      data: {
        label: 'Analytics Data Lake',
        description: 'API usage analytics',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['S3', 'HTTPS'],
        vendor: 'aws',
        product: 'athena',
        version: 'latest',
        securityControls: ['Bucket Policies', 'Encryption']
      }
    } as SecurityNode,
    {
      id: 'backup-storage',
      type: 'backupSystem',
      position: { x: 2660, y: 800 },
      data: {
        label: 'Backup Storage',
        description: 'Database backups',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['S3', 'HTTPS'],
        vendor: 'aws',
        product: 's3',
        version: 'latest',
        additionalContext: 'Backups stored with server-side encryption, retention 30 days'
      }
    } as SecurityNode,

    // Management Zone Components (zone x shifted from 3130→3430, delta=+300)
    {
      id: 'admin-portal',
      type: 'webServer',
      position: { x: 3530, y: 350 },
      data: {
        label: 'Admin Portal',
        description: 'Internal management console',
        zone: 'Management' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS'],
        vendor: 'custom',
        product: 'admin-portal',
        version: '1.8',
        technology: 'Angular',
        securityControls: ['MFA', 'IP Whitelisting', 'Session Recording']
      }
    } as SecurityNode,
    {
      id: 'monitoring',
      type: 'siem',
      position: { x: 3730, y: 250 },
      data: {
        label: 'Monitoring Stack',
        description: 'Metrics and alerting',
        zone: 'Management' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS'],
        vendor: 'elastic',
        product: 'elastic-stack',
        version: '8.11',
        components: [
          { name: 'Elasticsearch', version: '8.11' },
          { name: 'Kibana', version: '8.11' },
          { name: 'Logstash', version: '8.11' }
        ]
      }
    } as SecurityNode,
    {
      id: 'security-scanner',
      type: 'vulnerabilityScanner',
      position: { x: 3630, y: 500 },
      data: {
        label: 'Security Scanner',
        description: 'API security testing',
        zone: 'Management' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS'],
        vendor: 'rapid7',
        product: 'insightappsec',
        version: 'latest',
        additionalContext: 'Scans run weekly, findings tracked in Jira, 20+ medium issues open'
      }
    } as SecurityNode,
    {
      id: 'log-analysis',
      type: 'logging',
      position: { x: 3730, y: 650 },
      data: {
        label: 'Log Analysis',
        description: 'Centralized logging',
        zone: 'Management' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['Syslog', 'TLS'],
        vendor: 'splunk',
        product: 'enterprise',
        version: '9.1',
        securityControls: ['RBAC', 'Encryption', 'Retention Policies']
      }
    } as SecurityNode,

    // Partner Zone Components (zone x shifted from 1590→1640, delta=+50)
    {
      id: 'weather-provider',
      type: 'cloudService',
      position: { x: 1740, y: 1470 },
      data: {
        label: 'Weather Data Provider',
        description: 'External weather API',
        zone: 'Partner' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        protocols: ['HTTPS'],
        vendor: 'third-party',
        product: 'weather-api',
        version: 'v2',
        additionalContext: 'API key rotation every 90 days, no IP restrictions'
      }
    } as SecurityNode,
    {
      id: 'financial-provider',
      type: 'cloudService',
      position: { x: 1990, y: 1620 },
      data: {
        label: 'Market Data Provider',
        description: 'Financial data feed',
        zone: 'Partner' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['FIX', 'WebSocket'],
        vendor: 'third-party',
        product: 'market-data',
        version: 'latest',
        additionalContext: 'Direct connection to trading systems, shared credentials for all environments'
      }
    } as SecurityNode,
    {
      id: 'ml-provider',
      type: 'cloudService',
      position: { x: 2140, y: 1470 },
      data: {
        label: 'ML Model Provider',
        description: 'Pre-trained models API',
        zone: 'Partner' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS'],
        vendor: 'openai',
        product: 'api',
        version: 'v1',
        additionalContext: 'API keys embedded in code, no usage limits configured'
      }
    } as SecurityNode
  ],
  edges: [
    // Internet to DMZ
    {
      id: 'e1',
      source: 'api-consumers',
      target: 'cdn',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'API Requests',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        animated: true
      ,
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e2',
      source: 'developer-portal',
      target: 'api-gateway',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Portal API',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive'
      ,
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e3',
      source: 'cdn',
      target: 'api-gateway',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Cached Requests',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        animated: true
      ,
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,

    // DMZ internal connections
    {
      id: 'e4',
      source: 'api-gateway',
      target: 'waf',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'left',
      data: {
        label: 'WAF Check',
        protocol: 'HTTP',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      ,
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e5',
      source: 'api-gateway',
      target: 'rate-limiter',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Rate Check',
        protocol: 'Redis',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      ,
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e6',
      source: 'api-gateway',
      target: 'auth-service',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Auth Verify',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      ,
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,

    // DMZ to Internal
    {
      id: 'e7',
      source: 'api-gateway',
      target: 'maps-api',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Maps Requests',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: true
      ,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e8',
      source: 'api-gateway',
      target: 'weather-api',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Weather Requests',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        animated: true
      ,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e9',
      source: 'api-gateway',
      target: 'financial-api',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Financial Requests',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: true
      ,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e10',
      source: 'api-gateway',
      target: 'ml-api',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'ML Requests',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: true
      ,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,

    // Internal connections
    {
      id: 'e11',
      source: 'maps-api',
      target: 'api-cache',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Cache Access',
        protocol: 'Redis',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal'
      ,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e12',
      source: 'weather-api',
      target: 'api-cache',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Cache Access',
        protocol: 'Redis',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public'
      ,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e13',
      source: 'financial-api',
      target: 'message-queue',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Analytics Events',
        protocol: 'AMQP',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive'
      ,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,

    // Internal to Restricted
    {
      id: 'e14',
      source: 'maps-api',
      target: 'maps-db',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Geo Queries',
        protocol: 'PostgreSQL',
        encryption: 'SSL',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: true
      ,
        zone: 'Restricted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e15',
      source: 'financial-api',
      target: 'financial-db',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Market Data',
        protocol: 'InfluxDB',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true
      ,
        zone: 'Restricted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e16',
      source: 'auth-service',
      target: 'user-db',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'User Auth',
        protocol: 'MySQL',
        encryption: 'SSL',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      ,
        zone: 'Restricted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e17',
      source: 'message-queue',
      target: 'analytics-db',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Usage Data',
        protocol: 'S3',
        encryption: 'HTTPS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive'
      ,
        zone: 'Restricted' as SecurityZone
      }
    } as SecurityEdge,

    // Database backups
    {
      id: 'e18',
      source: 'maps-db',
      target: 'backup-storage',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Backup',
        protocol: 'S3',
        encryption: 'HTTPS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      ,
        zone: 'Restricted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e19',
      source: 'user-db',
      target: 'backup-storage',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'right',
      data: {
        label: 'Backup',
        protocol: 'S3',
        encryption: 'HTTPS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential'
      ,
        zone: 'Restricted' as SecurityZone
      }
    } as SecurityEdge,

    // Management connections
    {
      id: 'e20',
      source: 'admin-portal',
      target: 'api-gateway',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Admin API',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Management' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e21',
      source: 'monitoring',
      target: 'api-gateway',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'bottom',
      data: {
        label: 'Metrics',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Management' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e22',
      source: 'security-scanner',
      target: 'api-gateway',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Security Scans',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Management' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e23',
      source: 'message-queue',
      target: 'log-analysis',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Log Stream',
        protocol: 'Syslog',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Management' as SecurityZone
      }
    } as SecurityEdge,

    // Partner connections
    {
      id: 'e24',
      source: 'weather-api',
      target: 'weather-provider',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Weather Data',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public'
      ,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e25',
      source: 'financial-api',
      target: 'financial-provider',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Market Feed',
        protocol: 'WebSocket',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive'
      ,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e26',
      source: 'ml-api',
      target: 'ml-provider',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Model API',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive'
      ,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge
  ],
  attackPaths: [
    {
      id: 'ap-api-key-abuse',
      name: 'Developer Portal → Stolen API Key → Financial API → Data Exfiltration',
      strideCategory: 'Information Disclosure',
      riskLevel: 'Critical',
      description: 'Attacker compromises a developer account through the portal, steals API keys, bypasses rate limiting through distributed requests, and exfiltrates financial data through the Financial API.',
      steps: [
        { order: 1, edgeId: 'e2', sourceNodeId: 'developer-portal', targetNodeId: 'api-gateway', technique: 'T1078: Valid Accounts' },
        { order: 2, edgeId: 'e5', sourceNodeId: 'api-gateway', targetNodeId: 'rate-limiter', technique: 'T1499: Endpoint Denial of Service' },
        { order: 3, edgeId: 'e9', sourceNodeId: 'api-gateway', targetNodeId: 'financial-api', technique: 'T1528: Steal Application Access Token' },
        { order: 4, edgeId: 'e15', sourceNodeId: 'financial-api', targetNodeId: 'financial-db', technique: 'T1005: Data from Local System' },
      ],
      mitreTechniques: ['T1078', 'T1499', 'T1528', 'T1005'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-api-supply-chain',
      name: 'Compromised ML Provider → ML API → Malicious Model Output',
      strideCategory: 'Tampering',
      riskLevel: 'High',
      description: 'Attacker compromises the third-party ML model provider, injecting manipulated model responses that are served to API consumers through the ML API, affecting downstream applications.',
      steps: [
        { order: 1, edgeId: 'e26', sourceNodeId: 'ml-api', targetNodeId: 'ml-provider', technique: 'T1195: Supply Chain Compromise' },
        { order: 2, edgeId: 'e10', sourceNodeId: 'api-gateway', targetNodeId: 'ml-api', technique: 'T1565: Data Manipulation' },
      ],
      mitreTechniques: ['T1195', 'T1565'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-api-ddos-bypass',
      name: 'CDN → WAF Bypass → API Gateway Overload → Service Degradation',
      strideCategory: 'Denial of Service',
      riskLevel: 'High',
      description: 'Sophisticated DDoS attack bypasses CDN caching by targeting unique API paths, evades WAF rules, and overwhelms the API gateway causing service degradation for all 100K+ developers.',
      steps: [
        { order: 1, edgeId: 'e1', sourceNodeId: 'api-consumers', targetNodeId: 'cdn', technique: 'T1498: Network Denial of Service' },
        { order: 2, edgeId: 'e3', sourceNodeId: 'cdn', targetNodeId: 'api-gateway', technique: 'T1499: Endpoint Denial of Service' },
        { order: 3, edgeId: 'e4', sourceNodeId: 'api-gateway', targetNodeId: 'waf', technique: 'T1190: Exploit Public-Facing Application' },
      ],
      mitreTechniques: ['T1498', 'T1499', 'T1190'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-api-admin-takeover',
      name: 'Admin Portal → API Gateway Admin → User Database Manipulation',
      strideCategory: 'Elevation of Privilege',
      riskLevel: 'High',
      description: 'Attacker compromises admin portal credentials to gain administrative access to the API gateway, modifying rate limits and extracting user credentials from the user database.',
      steps: [
        { order: 1, edgeId: 'e20', sourceNodeId: 'admin-portal', targetNodeId: 'api-gateway', technique: 'T1078: Valid Accounts' },
        { order: 2, edgeId: 'e6', sourceNodeId: 'api-gateway', targetNodeId: 'auth-service', technique: 'T1098: Account Manipulation' },
        { order: 3, edgeId: 'e16', sourceNodeId: 'auth-service', targetNodeId: 'user-db', technique: 'T1003: OS Credential Dumping' },
      ],
      mitreTechniques: ['T1078', 'T1098', 'T1003'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
  ],
  grcWorkspace: buildGrcWorkspace({
    tierCatalogue: [
      { id: 'api-t1-cyber', tier: 1 as const, label: 'Cyber Risk', description: 'API platform security threats' },
      { id: 'api-t1-ops', tier: 1 as const, label: 'Operational Risk', description: 'Platform availability and SLA' },
      { id: 'api-t1-business', tier: 1 as const, label: 'Business Risk', description: 'Revenue and reputation impact' },
      { id: 'api-t2-auth', tier: 2 as const, label: 'API Authentication', parentId: 'api-t1-cyber', description: 'API key and OAuth threats' },
      { id: 'api-t2-data', tier: 2 as const, label: 'Data Security', parentId: 'api-t1-cyber', description: 'Financial and user data protection' },
      { id: 'api-t2-supply-chain', tier: 2 as const, label: 'Supply Chain', parentId: 'api-t1-cyber', description: 'Third-party provider dependencies' },
      { id: 'api-t2-availability', tier: 2 as const, label: 'Service Availability', parentId: 'api-t1-ops', description: 'DDoS and capacity threats' },
      { id: 'api-t3-key-theft', tier: 3 as const, label: 'API Key Theft', parentId: 'api-t2-auth' },
      { id: 'api-t3-provider-compromise', tier: 3 as const, label: 'Provider Compromise', parentId: 'api-t2-supply-chain' },
      { id: 'api-t3-ddos', tier: 3 as const, label: 'Application-Layer DDoS', parentId: 'api-t2-availability' },
    ],
    assets: [
      { id: 'api-asset-gateway', name: 'Kong API Gateway Cluster', type: 'api_gateway', owner: 'Platform Team', criticality: 5, linkedNodeIds: ['api-gateway'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'api-asset-findb', name: 'Financial Data Database', type: 'database', owner: 'DBA Team', criticality: 5, linkedNodeIds: ['financial-db'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'api-asset-userdb', name: 'Developer User Database', type: 'database', owner: 'DBA Team', criticality: 5, linkedNodeIds: ['user-db'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'api-asset-portal', name: 'Developer Portal', type: 'web_application', owner: 'Dev Experience Team', criticality: 4, linkedNodeIds: ['developer-portal'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'api-asset-mlapi', name: 'ML API Service', type: 'api', owner: 'ML Team', criticality: 4, linkedNodeIds: ['ml-api'], status: 'active', createdAt: NOW, updatedAt: NOW },
    ],
    risks: [
      { id: 'api-risk-key', title: 'API Key Theft via Developer Portal', description: 'Compromised developer accounts expose API keys for financial data access.', tierId: 'api-t3-key-theft', linkedAssetIds: ['api-asset-portal', 'api-asset-findb'], likelihood: 'likelihood-4', impact: 'impact-5', currentScore: score('likelihood-4', 'impact-5'), status: 'open', owner: 'Platform Team', createdAt: NOW, updatedAt: NOW },
      { id: 'api-risk-ml-supply', title: 'ML Provider Compromise', description: 'Third-party ML model provider compromise could serve manipulated results.', tierId: 'api-t3-provider-compromise', linkedAssetIds: ['api-asset-mlapi'], likelihood: 'likelihood-2', impact: 'impact-4', currentScore: score('likelihood-2', 'impact-4'), status: 'open', owner: 'ML Team', createdAt: NOW, updatedAt: NOW },
      { id: 'api-risk-ddos', title: 'Application-Layer DDoS via CDN Bypass', description: 'Targeted L7 DDoS attacks bypass CDN caching and overwhelm API gateway.', tierId: 'api-t3-ddos', linkedAssetIds: ['api-asset-gateway'], likelihood: 'likelihood-3', impact: 'impact-4', currentScore: score('likelihood-3', 'impact-4'), status: 'open', owner: 'Platform Team', createdAt: NOW, updatedAt: NOW },
      { id: 'api-risk-admin', title: 'Admin Portal Credential Compromise', description: 'Admin access could allow rate limit bypass and user data extraction.', tierId: 'api-t3-key-theft', linkedAssetIds: ['api-asset-gateway', 'api-asset-userdb'], likelihood: 'likelihood-2', impact: 'impact-5', currentScore: score('likelihood-2', 'impact-5'), status: 'open', owner: 'Platform Team', createdAt: NOW, updatedAt: NOW },
    ],
    assessments: [
      { id: 'api-assess-1', title: 'Public API Platform Security Assessment', scope: 'Full API platform including third-party integrations', status: 'in_progress', createdBy: 'Security Team', createdAt: NOW, updatedAt: NOW, threatModel: { nodeFindings: [{ nodeId: 'developer-portal', findingIds: ['api-risk-key'] }, { nodeId: 'ml-api', findingIds: ['api-risk-ml-supply'] }, { nodeId: 'api-gateway', findingIds: ['api-risk-ddos'] }, { nodeId: 'admin-portal', findingIds: ['api-risk-admin'] }], edgeFindings: [{ edgeId: 'e2', findingIds: ['api-risk-key'] }, { edgeId: 'e26', findingIds: ['api-risk-ml-supply'] }] } },
    ],
    soaEntries: [
      { id: 'api-soa-1', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'ctrl-a07', status: 'partially_implemented', justification: 'API key auth with OAuth for premium tiers.', linkedRiskIds: ['api-risk-key', 'api-risk-admin'], implementationNotes: 'Mandate OAuth 2.0 for all tiers, deprecate API key-only auth.', owner: 'Platform Team', createdAt: NOW, updatedAt: NOW },
      { id: 'api-soa-2', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'ctrl-a06', status: 'partially_implemented', justification: 'Dependency scanning in CI but no runtime SCA for ML providers.', linkedRiskIds: ['api-risk-ml-supply'], implementationNotes: 'Add response integrity checks for third-party ML responses.', owner: 'ML Team', createdAt: NOW, updatedAt: NOW },
      { id: 'api-soa-3', controlSetId: CIS_CONTROL_SET_ID, controlId: 'cis-ctrl-07', status: 'implemented', justification: 'Automated vulnerability scanning with security scanner.', linkedRiskIds: ['api-risk-ddos', 'api-risk-key'], implementationNotes: 'Maintain scan frequency and remediation SLAs.', owner: 'Security Team', createdAt: NOW, updatedAt: NOW },
      { id: 'api-soa-4', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'ctrl-a09', status: 'implemented', justification: 'Centralized logging and monitoring with automated alerting.', linkedRiskIds: ['api-risk-admin', 'api-risk-ddos'], implementationNotes: 'Add behavioral anomaly detection for admin actions.', owner: 'Platform Team', createdAt: NOW, updatedAt: NOW },
    ],
    thirdParties: [
      {
        id: 'api-tp-cloudflare',
        name: 'Cloudflare Inc.',
        description: 'Managed CDN and WAF service providing DDoS protection, edge caching, and bot management for the public API platform. Handles 1B+ daily requests at the edge layer.',
        category: 'managed_service',
        status: 'active',
        riskRating: 'high',
        dataClassification: 'internal',
        linkedAssetIds: ['api-asset-gateway'],
        linkedRiskIds: ['api-risk-ddos'],
        contactName: 'Cloudflare Enterprise Support',
        contactEmail: 'enterprise@cloudflare.example.com',
        contractExpiry: '2027-03-31',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-09-01',
        notes: 'Enterprise plan with advanced DDoS mitigation and custom WAF rules. CDN bypass attacks identified as a residual risk. Review origin IP exposure controls.'
      },
      {
        id: 'api-tp-kong',
        name: 'Kong Inc.',
        description: 'API gateway platform supplier providing the Kong Gateway cluster used for routing, rate limiting, authentication, and API lifecycle management across all API products.',
        category: 'supplier',
        status: 'active',
        riskRating: 'high',
        dataClassification: 'confidential',
        linkedAssetIds: ['api-asset-gateway'],
        linkedRiskIds: ['api-risk-key', 'api-risk-admin'],
        contactName: 'Kong Enterprise Support',
        contactEmail: 'enterprise@kong.example.com',
        contractExpiry: '2027-01-15',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-07-15',
        notes: 'Kong Enterprise with Vitals analytics. Gateway cluster handles all API routing and auth. Ensure plugin update cadence and admin API access controls are reviewed.'
      },
      {
        id: 'api-tp-aws',
        name: 'Amazon Web Services (AWS)',
        description: 'Cloud infrastructure provider hosting API backend services, databases, and ML inference endpoints. Multi-region deployment for high availability and low latency.',
        category: 'cloud_provider',
        status: 'active',
        riskRating: 'medium',
        dataClassification: 'confidential',
        linkedAssetIds: ['api-asset-findb', 'api-asset-userdb', 'api-asset-mlapi'],
        linkedRiskIds: ['api-risk-ml-supply'],
        contactName: 'AWS Enterprise Support',
        contactEmail: 'enterprise-support@aws.example.com',
        contractExpiry: '2027-06-30',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-08-15',
        notes: 'SOC 2 Type II and ISO 27001 certified. Multi-region RDS with encryption at rest. SageMaker endpoints for ML API. Review IAM policies and VPC peering rules.'
      },
    ],
  } as any),
};