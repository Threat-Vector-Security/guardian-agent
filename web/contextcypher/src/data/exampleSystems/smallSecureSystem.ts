import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityNode, SecurityEdge, SecurityZone } from '../../types/SecurityTypes';
import { colors } from '../../styles/Theme';
import { DiagramAttackPath } from '../../types/GrcTypes';
import { buildGrcWorkspace, score, NOW, OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID } from './grcSharedBase';

export const smallSecureSystem: ExampleSystem = {
  id: 'small-secure-system',
  name: 'Small Secure Zero Trust System',
  description: 'Modern zero trust architecture for healthcare technology with complete security stack',
  category: 'Secure Systems',
  // securityLevel removed - no longer part of the system model
  primaryZone: 'Internal',
  dataClassification: 'Confidential',
  customContext: `# Small Secure Zero Trust System

## System Overview
This represents a modern healthcare technology company that has fully embraced zero trust architecture principles. The system handles sensitive patient data and medical records, requiring the highest levels of security and compliance.

## Zero Trust Implementation
- **Never Trust, Always Verify**: Every connection is authenticated and authorized
- **Least Privilege Access**: Users and services only get minimal required permissions
- **Assume Breach**: Architecture assumes attackers are already inside
- **Verify Explicitly**: Multi-factor verification for all access attempts
- **Microsegmentation**: Network is segmented at the application level

## Business Context
- **Company Size**: 200 employees, fully remote workforce
- **Data Sensitivity**: Protected Health Information (PHI)
- **Regulatory**: HIPAA, HITECH Act, state privacy laws
- **User Base**: 50,000 healthcare providers
- **Annual Revenue**: $25M with 40% YoY growth

## Security Architecture
- **Identity-Centric**: Identity is the new perimeter
- **Device Trust**: Only managed devices can access resources
- **Context-Aware**: Access decisions based on user, device, location, and behavior
- **Encryption Everywhere**: Data encrypted in transit and at rest
- **Continuous Verification**: Sessions re-validated based on risk

## Technology Stack
- **Zero Trust Platform**: Cloudflare Access for ZTNA
- **Identity**: Okta for SSO and MFA
- **Endpoint**: CrowdStrike for EDR
- **Network**: Guardicore for microsegmentation
- **Data Protection**: Field-level encryption in database

## Access Control Model
- **No VPN**: Replaced traditional VPN with ZTNA
- **Application-Level Access**: Users only see applications they need
- **Just-in-Time Access**: Privileged access granted temporarily
- **Risk-Based Authentication**: Additional verification for anomalous behavior
- **Session Recording**: All privileged sessions recorded

## Compliance Measures
- **HIPAA Compliance**: Full administrative, physical, and technical safeguards
- **Audit Logging**: Immutable audit trail for all access
- **Data Residency**: All PHI stored in US-based data centers
- **Regular Assessments**: Quarterly security assessments
- **Incident Response**: 1-hour response time for security incidents

## Security Operations
- **24/7 Monitoring**: SOC monitors all security events
- **Threat Hunting**: Proactive search for threats
- **Automated Response**: Automated containment for detected threats
- **Security Training**: Monthly security awareness training
- **Phishing Tests**: Regular phishing simulations

## Recent Security Improvements
- Implemented passwordless authentication for all users
- Deployed runtime application self-protection (RASP)
- Added behavioral analytics to detect insider threats
- Implemented data classification and tagging
- Enhanced DLP policies for cloud applications

## Architecture Benefits
- **Reduced Attack Surface**: No exposed VPN endpoints
- **Better User Experience**: Seamless access without VPN
- **Improved Visibility**: See all user and application activity
- **Simplified Management**: Centralized policy management
- **Cost Reduction**: Eliminated VPN infrastructure costs

## Challenges and Lessons Learned
- Initial user resistance to new authentication methods
- Complexity in migrating legacy applications
- Performance impact of inline security inspection
- Integration challenges with third-party systems
- Balancing security with user productivity

## Future Roadmap
- Implement continuous compliance monitoring
- Add AI-based anomaly detection
- Expand zero trust to IoT devices
- Implement quantum-resistant cryptography
- Add privacy-preserving analytics`,
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
        description: 'Zero trust access layer'
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
      position: { x: 1600, y: 50 },
      data: {
        label: 'DMZ Zone',
        zoneType: 'DMZ' as SecurityZone,
        description: 'Policy enforcement points'
      },
      style: {
        width: 650,
        height: 1000,
        background: colors.zoneBackgrounds.DMZ,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'internal-zone',
      type: 'securityZone',
      position: { x: 2360, y: 50 },
      data: {
        label: 'Internal Zone',
        zoneType: 'Internal' as SecurityZone,
        description: 'Application services'
      },
      style: {
        width: 650,
        height: 1000,
        background: colors.zoneBackgrounds.Internal,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'trusted-zone',
      type: 'securityZone',
      position: { x: 3130, y: 50 },
      data: {
        label: 'Trusted Zone',
        zoneType: 'Trusted' as SecurityZone,
        description: 'Critical data and secrets'
      },
      style: {
        width: 650,
        height: 1000,
        background: colors.zoneBackgrounds.Trusted,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'compliance-zone',
      type: 'securityZone',
      position: { x: 1860, y: 1170 },
      data: {
        label: 'Compliance Zone',
        zoneType: 'Compliance' as SecurityZone,
        description: 'Security monitoring and compliance'
      },
      style: {
        width: 650,
        height: 1000,
        background: colors.zoneBackgrounds.Compliance,
        zIndex: -1
      }
    } as SecurityNode,

    // Internet Zone Components
    {
      id: 'public-users',
      type: 'endpoint',
      position: { x: 125, y: 325 },
      data: {
        label: 'Public Users',
        description: 'External users accessing the system',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        protocols: ['HTTPS', 'WARP'],
        technology: 'Web Browsers, Mobile Apps',
        vendor: 'various',
        product: 'client-apps',
        version: 'various'
      }
    } as SecurityNode,

    // External Zone Components
    {
      id: 'cloudflare-zt',
      type: 'ztna',
      position: { x: 875, y: 325 },
      data: {
        label: 'Cloudflare Zero Trust',
        description: 'Zero trust network access',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'WARP', 'mTLS'],
        vendor: 'cloudflare',
        product: 'access',
        version: 'latest',
        securityControls: ['Device Posture', 'Identity Verification', 'Context-Aware Access'],
        compliance: ['SOC 2']
      }
    } as SecurityNode,
    {
      id: 'identity-provider',
      type: 'authServer',
      position: { x: 1125, y: 175 },
      data: {
        label: 'Identity Provider',
        description: 'Corporate identity management',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['SAML', 'OIDC', 'SCIM'],
        vendor: 'okta',
        product: 'identity-cloud',
        version: 'latest',
        securityControls: ['MFA', 'Adaptive Authentication', 'Risk-Based Auth'],
        compliance: ['SOC 2'],
        additionalContext: 'MFA optional for contractors, some service accounts excluded from MFA requirements'
      }
    } as SecurityNode,

    // DMZ Zone Components
    {
      id: 'zt-gateway',
      type: 'proxy',
      position: { x: 1675, y: 325 },
      data: {
        label: 'Zero Trust Gateway',
        description: 'Policy enforcement point',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['mTLS', 'HTTPS'],
        vendor: 'custom',
        product: 'zt-gateway',
        version: '2.0',
        securityControls: ['Device Trust', 'Context-Aware Access', 'Policy Engine'],
        compliance: ['SOC 2', 'ISO 27001']
      }
    } as SecurityNode,
    {
      id: 'session-broker',
      type: 'cache',
      position: { x: 1925, y: 475 },
      data: {
        label: 'Session Broker',
        description: 'Session management and validation',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['Redis Protocol', 'TLS'],
        vendor: 'redis',
        product: 'redis-enterprise',
        version: '7.2',
        technology: 'JWT, Session Recording',
        securityControls: ['Session Timeout', 'Token Validation'],
        compliance: ['SOC 2']
      }
    } as SecurityNode,

    // Internal Zone Components
    {
      id: 'web-app',
      type: 'webServer',
      position: { x: 2425, y: 175 },
      data: {
        label: 'Web Application',
        description: 'Main application interface',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS'],
        vendor: 'custom',
        product: 'healthcare-portal',
        version: '3.5',
        technology: 'React, Node.js, TypeScript',
        securityControls: ['CSP Headers', 'Input Validation', 'CSRF Protection'],
        compliance: ['SOC 2']
      }
    } as SecurityNode,
    {
      id: 'api-server',
      type: 'api',
      position: { x: 2525, y: 325 },
      data: {
        label: 'API Server',
        description: 'Core business logic',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'REST'],
        vendor: 'custom',
        product: 'healthcare-api',
        version: '2.8',
        technology: 'Python, FastAPI',
        securityControls: ['Bearer Tokens', 'Rate Limiting', 'API Versioning'],
        compliance: ['SOC 2', 'HIPAA']
      }
    } as SecurityNode,
    {
      id: 'micro-segmentation',
      type: 'firewall',
      position: { x: 2825, y: 525 },
      data: {
        label: 'Micro-segmentation Controller',
        description: 'Network segmentation enforcement',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['Software-Defined Perimeter'],
        vendor: 'guardicore',
        product: 'centra',
        version: '5.5',
        securityControls: ['Process-Level Segmentation', 'Behavior Analysis', 'Policy Engine'],
        compliance: ['SOC 2']
      }
    } as SecurityNode,
    {
      id: 'file-storage',
      type: 'storage',
      position: { x: 2375, y: 625 },
      data: {
        label: 'File Storage Service',
        description: 'Document storage',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['S3 API', 'HTTPS'],
        vendor: 'minio',
        product: 'minio',
        version: 'latest',
        securityControls: ['Encryption at Rest', 'Access Logging', 'Versioning'],
        compliance: ['HIPAA'],
        additionalContext: 'Files encrypted at rest, but temporary files cached unencrypted for performance'
      }
    } as SecurityNode,

    // Trusted Zone Components
    {
      id: 'secure-db',
      type: 'database',
      position: { x: 3275, y: 325 },
      data: {
        label: 'Secure Database',
        description: 'Primary data store with field-level encryption',
        zone: 'Trusted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['PostgreSQL', 'SSL'],
        vendor: 'postgres',
        product: 'postgresql',
        version: '15.4',
        securityControls: ['TDE', 'Field Encryption', 'Row Level Security'],
        compliance: ['HIPAA', 'SOC 2']
      }
    } as SecurityNode,
    {
      id: 'key-manager',
      type: 'kms',
      position: { x: 3675, y: 625 },
      data: {
        label: 'Key Management Service',
        description: 'Cryptographic key management',
        zone: 'Trusted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'AWS API'],
        vendor: 'aws',
        product: 'kms',
        version: 'latest',
        securityControls: ['Hardware Security Module', 'Key Rotation', 'Audit Logging'],
        compliance: ['FIPS 140-2']
      }
    } as SecurityNode,
    {
      id: 'pam',
      type: 'pam',
      position: { x: 3575, y: 125 },
      data: {
        label: 'Privileged Access Management',
        description: 'Admin access control',
        zone: 'Trusted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'SSH'],
        vendor: 'cyberark',
        product: 'pas',
        version: '12.6',
        securityControls: ['Just-in-Time Access', 'Approval Workflow', 'Session Recording'],
        compliance: ['SOC 2', 'ISO 27001']
      }
    } as SecurityNode,

    // Compliance Zone Components
    {
      id: 'siem-zt',
      type: 'siem',
      position: { x: 2425, y: 1225 },
      data: {
        label: 'SIEM Platform',
        description: 'Security monitoring and correlation',
        zone: 'Compliance' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'Syslog', 'TLS'],
        vendor: 'splunk',
        product: 'enterprise-security',
        version: '9.1',
        securityControls: ['UEBA', 'Threat Intelligence', 'Correlation Rules'],
        compliance: ['SOC 2']
      }
    } as SecurityNode,
    {
      id: 'edr',
      type: 'edr',
      position: { x: 2875, y: 1425 },
      data: {
        label: 'EDR Solution',
        description: 'Endpoint detection and response',
        zone: 'Compliance' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'Falcon API'],
        vendor: 'crowdstrike',
        product: 'falcon',
        version: 'latest',
        securityControls: ['Behavioral Analysis', 'Threat Hunting', 'Real-time Response'],
        compliance: ['SOC 2']
      }
    } as SecurityNode,
    {
      id: 'dlp',
      type: 'dlp',
      position: { x: 2025, y: 1475 },
      data: {
        label: 'Data Loss Prevention',
        description: 'Data exfiltration prevention',
        zone: 'Compliance' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'ICAP'],
        vendor: 'forcepoint',
        product: 'dlp',
        version: '8.8',
        securityControls: ['Content Inspection', 'Cloud DLP', 'Policy Engine'],
        compliance: ['HIPAA', 'SOC 2'],
        additionalContext: 'DLP policies in monitor mode for some file types, enforcement gradual rollout'
      }
    } as SecurityNode
  ],
  edges: [
    // User access flow
    {
      id: 'e1',
      source: 'public-users',
      target: 'cloudflare-zt',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'HTTPS/WARP',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e2',
      source: 'cloudflare-zt',
      target: 'identity-provider',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'left',
      data: {
        label: 'SAML Auth',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true,
        zone: 'External' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e3',
      source: 'cloudflare-zt',
      target: 'zt-gateway',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Authenticated',
        protocol: 'HTTPS',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: true,
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,

    // Zero trust flow
    {
      id: 'e4',
      source: 'zt-gateway',
      target: 'session-broker',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Session Create',
        protocol: 'Redis',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: true,
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e5',
      source: 'zt-gateway',
      target: 'web-app',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'mTLS',
        protocol: 'HTTPS',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: true,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e6',
      source: 'zt-gateway',
      target: 'api-server',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'mTLS',
        protocol: 'HTTPS',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,

    // Application flow
    {
      id: 'e7',
      source: 'web-app',
      target: 'api-server',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'API Calls',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: true,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e8',
      source: 'api-server',
      target: 'micro-segmentation',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Policy Check',
        protocol: 'Internal',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: false,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e9',
      source: 'api-server',
      target: 'file-storage',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'right',
      data: {
        label: 'File Access',
        protocol: 'S3',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: false,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e10',
      source: 'api-server',
      target: 'secure-db',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Encrypted SQL',
        protocol: 'PostgreSQL',
        encryption: 'SSL',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: true,
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,

    // Security services
    {
      id: 'e11',
      source: 'secure-db',
      target: 'key-manager',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Key Fetch',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: false,
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e12',
      source: 'file-storage',
      target: 'key-manager',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Encryption Keys',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: false,
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e13',
      source: 'pam',
      target: 'secure-db',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Admin Access',
        protocol: 'SSH',
        encryption: 'SSH',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        animated: false,
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,

    // Session management
    {
      id: 'e14',
      source: 'session-broker',
      target: 'api-server',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Session Validate',
        protocol: 'Redis',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: true,
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e15',
      source: 'session-broker',
      target: 'siem-zt',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Session Logs',
        protocol: 'Syslog',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: false,
        zone: 'Compliance' as SecurityZone
      }
    } as SecurityEdge,

    // Monitoring flows
    {
      id: 'e16',
      source: 'api-server',
      target: 'siem-zt',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Audit Logs',
        protocol: 'Syslog',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: false,
        zone: 'Compliance' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e17',
      source: 'web-app',
      target: 'edr',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        controlPoints: [{ id: 'cp-1771655309069', x: 2900, y: 450, active: true }],
        label: 'Endpoint Data',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: false,
        zone: 'Compliance' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e18',
      source: 'file-storage',
      target: 'dlp',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Content Scan',
        protocol: 'ICAP',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: false,
        zone: 'Compliance' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e19',
      source: 'micro-segmentation',
      target: 'siem-zt',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'right',
      data: {
        label: 'Network Events',
        protocol: 'Syslog',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        animated: false,
        zone: 'Compliance' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e20',
      source: 'edr',
      target: 'siem-zt',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Threat Data',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        animated: false,
        zone: 'Compliance' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e21',
      source: 'dlp',
      target: 'siem-zt',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'bottom',
      data: {
        label: 'DLP Alerts',
        protocol: 'HTTPS',
        encryption: 'TLS',
        dataClassification: 'Sensitive',
        animated: false,
        zone: 'Compliance' as SecurityZone
      }
    } as SecurityEdge
  ],
  attackPaths: [
    {
      id: 'ap-ss-contractor-mfa-bypass',
      name: 'Contractor Account → Optional MFA Bypass → ZT Gateway → PHI Access',
      strideCategory: 'Spoofing',
      riskLevel: 'Medium',
      description: 'A compromised contractor account exploits the optional MFA policy for contractors to authenticate through Cloudflare Zero Trust and the ZT Gateway, gaining access to the API server and PHI in the secure database.',
      steps: [
        { order: 1, edgeId: 'e1', sourceNodeId: 'public-users', targetNodeId: 'cloudflare-zt', technique: 'T1078: Valid Accounts' },
        { order: 2, edgeId: 'e3', sourceNodeId: 'cloudflare-zt', targetNodeId: 'zt-gateway', technique: 'T1556: Modify Authentication Process' },
        { order: 3, edgeId: 'e6', sourceNodeId: 'zt-gateway', targetNodeId: 'api-server', technique: 'T1078.004: Valid Accounts: Cloud Accounts' },
        { order: 4, edgeId: 'e10', sourceNodeId: 'api-server', targetNodeId: 'secure-db', technique: 'T1530: Data from Cloud Storage Object' },
      ],
      mitreTechniques: ['T1078', 'T1556', 'T1078.004', 'T1530'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-ss-temp-file-exfil',
      name: 'API Server → Unencrypted Temp Files → Data Exfiltration',
      strideCategory: 'Information Disclosure',
      riskLevel: 'Medium',
      description: 'Attacker who gains API server access exploits the file storage service\'s unencrypted temporary file cache to exfiltrate sensitive documents before DLP policies detect the activity (DLP is in monitor-only mode for some file types).',
      steps: [
        { order: 1, edgeId: 'e6', sourceNodeId: 'zt-gateway', targetNodeId: 'api-server', technique: 'T1078: Valid Accounts' },
        { order: 2, edgeId: 'e9', sourceNodeId: 'api-server', targetNodeId: 'file-storage', technique: 'T1005: Data from Local System' },
        { order: 3, edgeId: 'e18', sourceNodeId: 'file-storage', targetNodeId: 'dlp', technique: 'T1048: Exfiltration Over Alternative Protocol' },
      ],
      mitreTechniques: ['T1078', 'T1005', 'T1048'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-ss-ztna-service-account',
      name: 'Service Account Abuse → Bypass Micro-segmentation → DB Extraction',
      strideCategory: 'Elevation of Privilege',
      riskLevel: 'Low',
      description: 'An insider with knowledge of excluded service accounts bypasses MFA requirements and exploits micro-segmentation policy gaps to access the secure database directly through the API server.',
      steps: [
        { order: 1, edgeId: 'e7', sourceNodeId: 'web-app', targetNodeId: 'api-server', technique: 'T1078.001: Valid Accounts: Default Accounts' },
        { order: 2, edgeId: 'e8', sourceNodeId: 'api-server', targetNodeId: 'micro-segmentation', technique: 'T1599: Network Boundary Bridging' },
        { order: 3, edgeId: 'e10', sourceNodeId: 'api-server', targetNodeId: 'secure-db', technique: 'T1213: Data from Information Repositories' },
      ],
      mitreTechniques: ['T1078.001', 'T1599', 'T1213'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
  ],
  grcWorkspace: buildGrcWorkspace({
    tierCatalogue: [
      { id: 'ss-t1-cyber', tier: 1 as const, label: 'Cyber Risk', description: 'Information security threats to healthcare data' },
      { id: 'ss-t1-compliance', tier: 1 as const, label: 'Compliance Risk', description: 'HIPAA and regulatory compliance' },
      { id: 'ss-t1-ops', tier: 1 as const, label: 'Operational Risk', description: 'Business continuity and availability' },
      { id: 'ss-t2-identity', tier: 2 as const, label: 'Identity & Access', parentId: 'ss-t1-cyber', description: 'Zero trust identity threats' },
      { id: 'ss-t2-data', tier: 2 as const, label: 'Data Protection', parentId: 'ss-t1-cyber', description: 'PHI data security' },
      { id: 'ss-t2-endpoint', tier: 2 as const, label: 'Endpoint Security', parentId: 'ss-t1-cyber', description: 'Device trust and posture' },
      { id: 'ss-t2-hipaa', tier: 2 as const, label: 'HIPAA Technical', parentId: 'ss-t1-compliance', description: 'HIPAA technical safeguards' },
      { id: 'ss-t3-mfa-gap', tier: 3 as const, label: 'MFA Policy Gaps', parentId: 'ss-t2-identity' },
      { id: 'ss-t3-temp-exposure', tier: 3 as const, label: 'Temporary Data Exposure', parentId: 'ss-t2-data' },
      { id: 'ss-t3-dlp-gap', tier: 3 as const, label: 'DLP Coverage Gaps', parentId: 'ss-t2-data' },
    ],
    assets: [
      { id: 'ss-asset-ztna', name: 'Cloudflare Zero Trust Platform', type: 'ztna', owner: 'Security Team', criticality: 5, linkedNodeIds: ['cloudflare-zt', 'zt-gateway'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'ss-asset-idp', name: 'Okta Identity Provider', type: 'identity_provider', owner: 'Security Team', criticality: 5, linkedNodeIds: ['identity-provider'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'ss-asset-db', name: 'Secure PostgreSQL Database (PHI)', type: 'database', owner: 'DBA Team', criticality: 5, linkedNodeIds: ['secure-db'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'ss-asset-files', name: 'MinIO File Storage', type: 'file_storage', owner: 'Platform Team', criticality: 4, linkedNodeIds: ['file-storage'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'ss-asset-api', name: 'Healthcare API Server', type: 'api', owner: 'Dev Team', criticality: 4, linkedNodeIds: ['api-server'], status: 'active', createdAt: NOW, updatedAt: NOW },
    ],
    risks: [
      { id: 'ss-risk-mfa', title: 'Optional MFA for Contractors', description: 'Contractors can authenticate without MFA, creating a weaker authentication path into the zero trust architecture.', tierId: 'ss-t3-mfa-gap', linkedAssetIds: ['ss-asset-idp', 'ss-asset-ztna'], likelihood: 'likelihood-2', impact: 'impact-4', currentScore: score('likelihood-2', 'impact-4'), status: 'open', owner: 'Security Team', createdAt: NOW, updatedAt: NOW },
      { id: 'ss-risk-temp-files', title: 'Unencrypted Temporary File Cache', description: 'File storage caches documents unencrypted for performance, creating a window for data exposure.', tierId: 'ss-t3-temp-exposure', linkedAssetIds: ['ss-asset-files'], likelihood: 'likelihood-2', impact: 'impact-4', currentScore: score('likelihood-2', 'impact-4'), status: 'open', owner: 'Platform Team', createdAt: NOW, updatedAt: NOW },
      { id: 'ss-risk-dlp', title: 'DLP in Monitor Mode for Some File Types', description: 'DLP policies not fully enforced yet, allowing potential data exfiltration of certain file types.', tierId: 'ss-t3-dlp-gap', linkedAssetIds: ['ss-asset-files'], likelihood: 'likelihood-2', impact: 'impact-3', currentScore: score('likelihood-2', 'impact-3'), status: 'open', owner: 'Security Team', createdAt: NOW, updatedAt: NOW },
      { id: 'ss-risk-svc-acct', title: 'Service Accounts Excluded from MFA', description: 'Some service accounts bypass MFA requirements, potentially exploitable by insiders.', tierId: 'ss-t3-mfa-gap', linkedAssetIds: ['ss-asset-api', 'ss-asset-ztna'], likelihood: 'likelihood-1', impact: 'impact-4', currentScore: score('likelihood-1', 'impact-4'), status: 'mitigated', owner: 'Security Team', createdAt: NOW, updatedAt: NOW },
    ],
    assessments: [
      { id: 'ss-assess-1', title: 'Zero Trust Architecture Security Assessment', scope: 'Full ZTNA stack and PHI data flows', status: 'in_progress', createdBy: 'Security Team', createdAt: NOW, updatedAt: NOW, threatModel: { nodeFindings: [{ nodeId: 'identity-provider', findingIds: ['ss-risk-mfa', 'ss-risk-svc-acct'] }, { nodeId: 'file-storage', findingIds: ['ss-risk-temp-files', 'ss-risk-dlp'] }], edgeFindings: [{ edgeId: 'e9', findingIds: ['ss-risk-temp-files'] }, { edgeId: 'e18', findingIds: ['ss-risk-dlp'] }] } },
    ],
    soaEntries: [
      { id: 'ss-soa-1', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'ctrl-a07', status: 'partially_implemented', justification: 'MFA enforced for employees but optional for contractors.', linkedRiskIds: ['ss-risk-mfa'], implementationNotes: 'Extend mandatory MFA to all user types including contractors.', owner: 'Security Team', createdAt: NOW, updatedAt: NOW },
      { id: 'ss-soa-2', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'ctrl-a02', status: 'partially_implemented', justification: 'TDE on database but temp files unencrypted.', linkedRiskIds: ['ss-risk-temp-files'], implementationNotes: 'Enable encryption for temporary file cache.', owner: 'Platform Team', createdAt: NOW, updatedAt: NOW },
      { id: 'ss-soa-3', controlSetId: CIS_CONTROL_SET_ID, controlId: 'cis-ctrl-03', status: 'partially_implemented', justification: 'DLP in monitor mode for some file types.', linkedRiskIds: ['ss-risk-dlp'], implementationNotes: 'Complete DLP enforcement rollout for all file types.', owner: 'Security Team', createdAt: NOW, updatedAt: NOW },
      { id: 'ss-soa-4', controlSetId: CIS_CONTROL_SET_ID, controlId: 'cis-ctrl-05', status: 'partially_implemented', justification: 'Service accounts excluded from MFA.', linkedRiskIds: ['ss-risk-svc-acct'], implementationNotes: 'Implement workload identity for service-to-service auth.', owner: 'Security Team', createdAt: NOW, updatedAt: NOW },
      { id: 'ss-soa-5', controlSetId: CIS_CONTROL_SET_ID, controlId: 'cis-ctrl-08', status: 'implemented', justification: 'Full audit logging via SIEM with UEBA.', linkedRiskIds: ['ss-risk-mfa', 'ss-risk-dlp'], implementationNotes: 'Maintain log retention and correlation rules.', owner: 'Security Team', createdAt: NOW, updatedAt: NOW },
    ],
    thirdParties: [
      {
        id: 'ss-tp-cloudflare',
        name: 'Cloudflare Inc.',
        description: 'Zero Trust Network Access platform providing identity-aware proxy, device posture checks, and context-aware access policies. Replaces traditional VPN for all remote access.',
        category: 'saas',
        status: 'active',
        riskRating: 'medium',
        dataClassification: 'confidential',
        linkedAssetIds: ['ss-asset-ztna'],
        linkedRiskIds: ['ss-risk-mfa', 'ss-risk-svc-acct'],
        contactName: 'Cloudflare Zero Trust Support',
        contactEmail: 'enterprise@cloudflare.example.com',
        contractExpiry: '2027-05-31',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-09-01',
        notes: 'Cloudflare Access with WARP client. Device posture checks integrated with CrowdStrike. Review access policies for contractor exclusions.'
      },
      {
        id: 'ss-tp-okta',
        name: 'Okta Inc.',
        description: 'Identity-as-a-Service provider handling SSO, MFA, adaptive authentication, and SCIM provisioning for all 50,000 healthcare provider accounts and internal staff.',
        category: 'saas',
        status: 'active',
        riskRating: 'critical',
        dataClassification: 'confidential',
        linkedAssetIds: ['ss-asset-idp'],
        linkedRiskIds: ['ss-risk-mfa', 'ss-risk-svc-acct'],
        contactName: 'Okta Enterprise Support',
        contactEmail: 'enterprise@okta.example.com',
        contractExpiry: '2027-04-15',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-07-15',
        notes: 'Okta Identity Cloud with adaptive MFA. Contractor MFA currently optional -- remediation planned. SCIM provisioning for automated lifecycle management.'
      },
      {
        id: 'ss-tp-aws',
        name: 'Amazon Web Services (AWS)',
        description: 'Cloud provider hosting RDS PostgreSQL with field-level encryption, KMS for cryptographic key management, and S3 for encrypted file storage. All PHI stored in US regions.',
        category: 'cloud_provider',
        status: 'active',
        riskRating: 'medium',
        dataClassification: 'restricted',
        linkedAssetIds: ['ss-asset-db', 'ss-asset-files', 'ss-asset-api'],
        linkedRiskIds: ['ss-risk-temp-files'],
        contactName: 'AWS Healthcare Support',
        contactEmail: 'healthcare-support@aws.example.com',
        contractExpiry: '2027-06-30',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-08-15',
        notes: 'HIPAA BAA in place. AWS KMS with FIPS 140-2 HSMs for encryption keys. US-only data residency enforced. Review temp file caching behavior in MinIO on EC2.'
      },
    ],
  } as any),
};