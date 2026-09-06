// smallVulnerableSystem.ts
import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityNode, SecurityEdge, SecurityZone } from '../../types/SecurityTypes';
import { colors } from '../../styles/Theme';
import { DiagramAttackPath } from '../../types/GrcTypes';
import { buildGrcWorkspace, score, NOW, OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID } from './grcSharedBase';

export const smallVulnerableSystem: ExampleSystem = {
  id: 'small-vulnerable-system',
  name: 'Small Business Web Application',
  description: 'Basic web application for small business with simple three-tier architecture',
  category: 'Web Applications',
  primaryZone: 'DMZ',
  dataClassification: 'Sensitive',
  customContext: `# Small Business Web Application

## System Overview
Simple web-based customer management system for a small retail business processing approximately 100-200 transactions daily. The system handles customer orders, inventory tracking, and basic accounting functions. Built using standard LAMP stack architecture with minimal complexity to keep operational costs low.

## Architecture Components

### Network Infrastructure (Internet Zone)
- Cisco 2900 Series Router (IOS 12.4) serving as internet gateway
  - SNMP community strings set to "public" and "private" for monitoring
  - Telnet enabled on port 23 for remote management access
  - SSH disabled due to licensing costs
  - Default factory passwords unchanged for administrative access
  - Router management interface accessible via standard HTTP on port 80

### Perimeter Security (DMZ Zone)
- SonicWall TZ300 Firewall with basic packet filtering
  - Configured with manufacturer default ruleset
  - Any-to-any rules enabled for troubleshooting purposes
  - Logging disabled to conserve storage space
  - Management interface accessible on port 8080 without authentication
  - Last firmware update performed in 2019

### Web Services (DMZ Zone)
- Apache HTTP Server 2.2.15 running on CentOS 6
  - Default configuration maintained for compatibility
  - mod_php5 and mod_ssl modules installed
  - Server tokens set to full for debugging purposes
  - Directory browsing enabled for file access
  - Default Apache welcome pages and documentation accessible
  - Error pages configured to display detailed system information
  - Running with root privileges for file system access
  - Log files stored with world-readable permissions

### Application Processing (Internal Zone)
- PHP 5.6 Application Server handling business logic
  - Development environment settings maintained in production
  - Display_errors directive enabled for troubleshooting
  - Register_globals enabled for legacy compatibility
  - Magic_quotes disabled as per application requirements
  - Remote debugging port 9000 accessible for development support
  - Session cookies configured without httpOnly flag
  - Error reporting set to display all errors including notices

### Data Storage (Internal Zone)
- MySQL 5.1.73 Database Server
  - Standard MySQL community installation with default settings
  - Root account password set to "password123" for simplicity
  - Remote root access enabled for vendor support requirements
  - Anonymous user accounts present from default installation
  - Test database accessible to all users
  - Binary logging disabled to save disk space
  - SSL encryption not required for connections
  - Password validation plugin not installed
  - Database audit plugin not configured

## Operational Context
- IT support provided by part-time contractor
- Budget constraints require using existing hardware and software
- Maintenance windows scheduled quarterly to minimize business disruption
- Remote access enabled for vendor support and troubleshooting
- System designed for ease of use rather than security complexity
- Default configurations preserved to avoid compatibility issues
- Change management handled informally through email approval`,
  nodes: [
    // Security Zones
    {
      id: 'internet-zone',
      type: 'securityZone',
      position: { x: 50, y: 50 },
      data: {
        label: 'Internet Zone',
        zoneType: 'Internet' as SecurityZone,
        description: 'External network access zone',
        zone: 'Internet' as SecurityZone
      },
      style: {
        width: 600,
        height: 1000,
        background: colors.zoneBackgrounds.Internet,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'dmz-zone',
      type: 'securityZone',
      position: { x: 770, y: 50 },
      data: {
        label: 'DMZ Zone',
        zoneType: 'DMZ' as SecurityZone,
        description: 'Demilitarized zone for public services'
      },
      style: {
        width: 700,
        height: 1000,
        background: colors.zoneBackgrounds.DMZ,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'internal-zone',
      type: 'securityZone',
      position: { x: 1590, y: 50 },
      data: {
        label: 'Internal Zone',
        zoneType: 'Internal' as SecurityZone,
        description: 'Internal network zone'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Internal,
        zIndex: -1
      }
    } as SecurityNode,

    // Infrastructure Components
    {
      id: 'internet-router',
      type: 'router',
      position: { x: 350, y: 200 },
      data: {
        label: 'Internet Router',
        description: 'Cisco 2900 Series Gateway Router',
        vendor: 'cisco',
        product: '2900',
        zone: 'Internet' as SecurityZone,
        dataClassification: 'Public',
        protocols: ['BGP', 'SNMP', 'Telnet'],
        version: '12.4',
        ios: '12.4(24)T',
        snmp: 'v2c community: public/private',
        management: 'Telnet port 23, HTTP port 80',
        securityControls: ['Basic ACLs']
      }
    } as SecurityNode,
    {
      id: 'perimeter-firewall',
      type: 'firewall',
      position: { x: 1100, y: 200 },
      data: {
        label: 'Perimeter Firewall',
        description: 'SonicWall TZ300 Basic Firewall',
        vendor: 'sonicwall',
        product: 'tz300',
        zone: 'DMZ' as SecurityZone,
        dataClassification: 'Internal',
        protocols: ['any'],
        version: '6.2.7.2',
        management: 'HTTP port 8080 no auth',
        configuration: 'Default ruleset with any-any rules',
        securityControls: ['Basic packet filtering']
      }
    } as SecurityNode,

    // Application Components
    {
      id: 'web-server',
      type: 'webServer',
      position: { x: 1100, y: 400 },
      data: {
        label: 'Web Server',
        description: 'Apache HTTP Server',
        vendor: 'apache',
        product: 'httpd',
        zone: 'DMZ' as SecurityZone,
        dataClassification: 'Public',
        protocols: ['HTTP', 'HTTPS'],
        version: '2.2.15',
        os: 'CentOS 6.10',
        modules: 'mod_php5, mod_ssl, mod_rewrite',
        serverTokens: 'Full',
        directoryListing: 'Enabled',
        errorPages: 'Detailed system information',
        privileges: 'Running as root',
        securityControls: ['Basic SSL']
      }
    } as SecurityNode,
    {
      id: 'app-server',
      type: 'application',
      position: { x: 1900, y: 450 },
      data: {
        label: 'PHP Application',
        description: 'PHP Business Logic Server',
        vendor: 'php',
        product: 'php',
        zone: 'Internal' as SecurityZone,
        dataClassification: 'Sensitive',
        protocols: ['HTTP', 'FastCGI'],
        version: '5.6.40',
        runtime: 'PHP-FPM',
        configuration: 'Development settings in production',
        displayErrors: 'On',
        registerGlobals: 'On',
        remoteDebug: 'Port 9000 enabled',
        sessionSecurity: 'httpOnly flag disabled',
        securityControls: ['Input validation (basic)']
      }
    } as SecurityNode,
    {
      id: 'database',
      type: 'database',
      position: { x: 1900, y: 700 },
      data: {
        label: 'MySQL Database',
        description: 'MySQL Community Server',
        vendor: 'oracle',
        product: 'mysql',
        zone: 'Internal' as SecurityZone,
        dataClassification: 'Confidential',
        version: '5.1.73',
        protocols: ['MySQL'],
        installation: 'Default community installation',
        accounts: 'Root, anonymous users present',
        remoteAccess: 'Root remote access enabled',
        testDatabase: 'Accessible to all users',
        encryption: 'Not configured',
        binLogging: 'Disabled',
        securityControls: ['Basic authentication']
      }
    } as SecurityNode
  ],
  attackPaths: [
    {
      id: 'ap-sv-debug-bypass',
      name: 'Debug Port Bypass → App Server → Database Exfiltration',
      strideCategory: 'Elevation of Privilege',
      riskLevel: 'Critical',
      description: 'Attacker exploits the open remote debug port (9000) on the PHP application server via the internet router, bypassing the firewall entirely, then uses the unencrypted MySQL connection to exfiltrate all customer data.',
      steps: [
        { order: 1, edgeId: 'debug-access', sourceNodeId: 'internet-router', targetNodeId: 'app-server', technique: 'T1133: External Remote Services (Debug Port)' },
        { order: 2, edgeId: 'app-to-database', sourceNodeId: 'app-server', targetNodeId: 'database', technique: 'T1005: Data from Local System' },
      ],
      mitreTechniques: ['T1133', 'T1005'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-sv-full-chain',
      name: 'Router → Firewall → Web Server → App → Direct DB Access',
      strideCategory: 'Information Disclosure',
      riskLevel: 'Critical',
      description: 'Full attack chain exploiting the default firewall ruleset, Apache misconfiguration with directory browsing and root privileges, unvalidated PHP input, and direct unencrypted database access from the web server.',
      steps: [
        { order: 1, edgeId: 'router-to-firewall', sourceNodeId: 'internet-router', targetNodeId: 'perimeter-firewall', technique: 'T1190: Exploit Public-Facing Application' },
        { order: 2, edgeId: 'firewall-to-web', sourceNodeId: 'perimeter-firewall', targetNodeId: 'web-server', technique: 'T1059: Command and Scripting Interpreter' },
        { order: 3, edgeId: 'web-to-database-direct', sourceNodeId: 'web-server', targetNodeId: 'database', technique: 'T1552: Unsecured Credentials' },
      ],
      mitreTechniques: ['T1190', 'T1059', 'T1552'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-sv-telnet-takeover',
      name: 'Telnet Management → Router Compromise → Firewall Bypass',
      strideCategory: 'Spoofing',
      riskLevel: 'High',
      description: 'Attacker uses SNMP public community string to enumerate the router, then authenticates via unencrypted Telnet with default credentials to reconfigure the firewall rules.',
      steps: [
        { order: 1, edgeId: 'router-management', sourceNodeId: 'internet-router', targetNodeId: 'perimeter-firewall', technique: 'T1078: Valid Accounts (Default Credentials)' },
      ],
      mitreTechniques: ['T1078'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
  ],
  grcWorkspace: buildGrcWorkspace({
    tierCatalogue: [
      { id: 'sv-t1-cyber', tier: 1 as const, label: 'Cyber Risk', description: 'Information security threats' },
      { id: 'sv-t1-ops', tier: 1 as const, label: 'Operational Risk', description: 'Business operations risks' },
      { id: 'sv-t2-network', tier: 2 as const, label: 'Network Security', parentId: 'sv-t1-cyber', description: 'Network infrastructure threats' },
      { id: 'sv-t2-app', tier: 2 as const, label: 'Application Security', parentId: 'sv-t1-cyber', description: 'Application layer threats' },
      { id: 'sv-t2-data', tier: 2 as const, label: 'Data Security', parentId: 'sv-t1-cyber', description: 'Data protection threats' },
      { id: 'sv-t2-patch', tier: 2 as const, label: 'Patch Management', parentId: 'sv-t1-ops', description: 'Software update gaps' },
      { id: 'sv-t3-firewall-bypass', tier: 3 as const, label: 'Firewall Bypass', parentId: 'sv-t2-network' },
      { id: 'sv-t3-sqli', tier: 3 as const, label: 'SQL Injection', parentId: 'sv-t2-app' },
      { id: 'sv-t3-default-creds', tier: 3 as const, label: 'Default Credentials', parentId: 'sv-t2-data' },
    ],
    assets: [
      { id: 'sv-asset-router', name: 'Cisco 2900 Internet Router', type: 'network_device', owner: 'IT Contractor', criticality: 4, linkedNodeIds: ['internet-router'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'sv-asset-firewall', name: 'SonicWall TZ300 Firewall', type: 'firewall', owner: 'IT Contractor', criticality: 4, linkedNodeIds: ['perimeter-firewall'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'sv-asset-web', name: 'Apache Web Server', type: 'web_server', owner: 'IT Contractor', criticality: 3, linkedNodeIds: ['web-server'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'sv-asset-app', name: 'PHP Application Server', type: 'application', owner: 'IT Contractor', criticality: 4, linkedNodeIds: ['app-server'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'sv-asset-db', name: 'MySQL Database', type: 'database', owner: 'IT Contractor', criticality: 5, linkedNodeIds: ['database'], status: 'active', createdAt: NOW, updatedAt: NOW },
    ],
    risks: [
      { id: 'sv-risk-debug', title: 'Open Debug Port Bypasses Firewall', description: 'PHP remote debug port 9000 accessible from internet, bypassing perimeter firewall.', tierId: 'sv-t3-firewall-bypass', linkedAssetIds: ['sv-asset-app'], likelihood: 'likelihood-5', impact: 'impact-5', currentScore: score('likelihood-5', 'impact-5'), status: 'open', owner: 'IT Contractor', createdAt: NOW, updatedAt: NOW },
      { id: 'sv-risk-default-creds', title: 'Default Credentials Across Infrastructure', description: 'Router, firewall, and database all use default or weak credentials.', tierId: 'sv-t3-default-creds', linkedAssetIds: ['sv-asset-router', 'sv-asset-firewall', 'sv-asset-db'], likelihood: 'likelihood-5', impact: 'impact-5', currentScore: score('likelihood-5', 'impact-5'), status: 'open', owner: 'IT Contractor', createdAt: NOW, updatedAt: NOW },
      { id: 'sv-risk-direct-db', title: 'Direct Web-to-DB Access Without App Controls', description: 'Web server has direct MySQL access bypassing application-level authorization.', tierId: 'sv-t3-sqli', linkedAssetIds: ['sv-asset-web', 'sv-asset-db'], likelihood: 'likelihood-4', impact: 'impact-5', currentScore: score('likelihood-4', 'impact-5'), status: 'open', owner: 'IT Contractor', createdAt: NOW, updatedAt: NOW },
      { id: 'sv-risk-telnet', title: 'Unencrypted Telnet Management Access', description: 'Router management via Telnet exposes credentials and configuration to eavesdropping.', tierId: 'sv-t3-firewall-bypass', linkedAssetIds: ['sv-asset-router'], likelihood: 'likelihood-4', impact: 'impact-4', currentScore: score('likelihood-4', 'impact-4'), status: 'open', owner: 'IT Contractor', createdAt: NOW, updatedAt: NOW },
    ],
    assessments: [
      { id: 'sv-assess-1', title: 'Small Business Vulnerability Assessment', scope: 'Full infrastructure and application stack', status: 'in_progress', createdBy: 'Security Consultant', createdAt: NOW, updatedAt: NOW, threatModel: { nodeFindings: [{ nodeId: 'internet-router', findingIds: ['sv-risk-telnet', 'sv-risk-default-creds'] }, { nodeId: 'database', findingIds: ['sv-risk-default-creds', 'sv-risk-direct-db'] }, { nodeId: 'app-server', findingIds: ['sv-risk-debug'] }], edgeFindings: [{ edgeId: 'debug-access', findingIds: ['sv-risk-debug'] }, { edgeId: 'web-to-database-direct', findingIds: ['sv-risk-direct-db'] }] } },
    ],
    soaEntries: [
      { id: 'sv-soa-1', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'ctrl-a05', status: 'not_implemented', justification: 'Default configurations across all infrastructure.', linkedRiskIds: ['sv-risk-default-creds'], implementationNotes: 'Harden all default configs per vendor guidelines.', owner: 'IT Contractor', createdAt: NOW, updatedAt: NOW },
      { id: 'sv-soa-2', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'ctrl-a07', status: 'not_implemented', justification: 'Default passwords on router, firewall, and database.', linkedRiskIds: ['sv-risk-default-creds', 'sv-risk-telnet'], implementationNotes: 'Enforce strong passwords and disable Telnet.', owner: 'IT Contractor', createdAt: NOW, updatedAt: NOW },
      { id: 'sv-soa-3', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'ctrl-a03', status: 'not_implemented', justification: 'No input validation on PHP application.', linkedRiskIds: ['sv-risk-direct-db'], implementationNotes: 'Implement parameterized queries.', owner: 'IT Contractor', createdAt: NOW, updatedAt: NOW },
      { id: 'sv-soa-4', controlSetId: CIS_CONTROL_SET_ID, controlId: 'cis-ctrl-04', status: 'not_implemented', justification: 'No secure configuration baseline.', linkedRiskIds: ['sv-risk-default-creds', 'sv-risk-debug'], implementationNotes: 'Establish and enforce CIS benchmarks.', owner: 'IT Contractor', createdAt: NOW, updatedAt: NOW },
      { id: 'sv-soa-5', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'ctrl-a09', status: 'not_implemented', justification: 'Logging disabled on firewall, no audit trail.', linkedRiskIds: ['sv-risk-debug', 'sv-risk-telnet'], implementationNotes: 'Enable logging on all infrastructure components.', owner: 'IT Contractor', createdAt: NOW, updatedAt: NOW },
    ],
    thirdParties: [
      {
        id: 'sv-tp-sonicwall',
        name: 'SonicWall',
        description: 'Firewall appliance supplier providing the TZ300 perimeter firewall. Last firmware update was in 2019; device is running with default ruleset and no authentication on management interface.',
        category: 'supplier',
        status: 'active',
        riskRating: 'high',
        dataClassification: 'internal',
        linkedAssetIds: ['sv-asset-firewall'],
        linkedRiskIds: ['sv-risk-default-creds'],
        contactName: 'SonicWall Reseller',
        contactEmail: 'support@sonicwall-reseller.example.com',
        contractExpiry: '2026-06-30',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-06-01',
        notes: 'Support contract may have lapsed. Firmware is 5+ years out of date with known CVEs. Management interface on port 8080 has no authentication. Immediate remediation required.'
      },
      {
        id: 'sv-tp-godaddy',
        name: 'GoDaddy',
        description: 'Managed web hosting and domain registrar providing the shared hosting environment for the Apache web server and basic SSL certificate.',
        category: 'managed_service',
        status: 'active',
        riskRating: 'medium',
        dataClassification: 'public',
        linkedAssetIds: ['sv-asset-web'],
        linkedRiskIds: ['sv-risk-direct-db'],
        contactName: 'GoDaddy Hosting Support',
        contactEmail: 'hosting@godaddy.example.com',
        contractExpiry: '2026-11-30',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-07-15',
        notes: 'Shared hosting environment with limited security controls. Apache version and CentOS are end-of-life. No WAF or intrusion detection available on the hosting plan.'
      },
      {
        id: 'sv-tp-local-it',
        name: 'Local IT Solutions LLC',
        description: 'Part-time IT contractor providing all system administration, network management, and troubleshooting. Single individual with full administrative access to all systems including router, firewall, web server, and database.',
        category: 'contractor',
        status: 'active',
        riskRating: 'high',
        dataClassification: 'confidential',
        linkedAssetIds: ['sv-asset-router', 'sv-asset-firewall', 'sv-asset-app', 'sv-asset-db'],
        linkedRiskIds: ['sv-risk-default-creds', 'sv-risk-debug', 'sv-risk-telnet'],
        contactName: 'Mike Johnson',
        contactEmail: 'mike@localitsolutions.example.com',
        contractExpiry: '2026-12-31',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-06-15',
        notes: 'Single contractor with root/admin access to all systems. No background check on file. Uses Telnet for remote management. Credentials shared via email. No formal SLA or security obligations in contract.'
      },
    ],
  } as any),
  edges: [
    // Internet to DMZ traffic flow
    {
      id: 'router-to-firewall',
      source: 'internet-router',
      target: 'perimeter-firewall',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'All Internet Traffic',
        protocol: 'any',
        encryption: 'none',
        dataClassification: 'Public',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'firewall-to-web',
      source: 'perimeter-firewall',
      target: 'web-server',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'HTTP/HTTPS Traffic',
        protocol: 'TCP/80,443',
        encryption: 'SSL 3.0/TLS 1.0',
        dataClassification: 'Public',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,

    // DMZ to Internal zone traffic
    {
      id: 'web-to-app',
      source: 'web-server',
      target: 'app-server',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'PHP Processing',
        protocol: 'FastCGI',
        encryption: 'none',
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'app-to-database',
      source: 'app-server',
      target: 'database',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Database Queries',
        protocol: 'MySQL',
        encryption: 'none',
        dataClassification: 'Confidential',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,

    // Direct database access (architectural flaw) — routed below app-server to avoid crossing
    {
      id: 'web-to-database-direct',
      source: 'web-server',
      target: 'database',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'bottom',
      data: {
        label: 'Direct DB Access',
        protocol: 'MySQL',
        encryption: 'none',
        dataClassification: 'Confidential',
        zone: 'Internal' as SecurityZone,
        controlPoints: [
          { id: 'cp-dd-1', x: 1300, y: 850, active: true },
          { id: 'cp-dd-2', x: 2050, y: 850, active: true }
        ]
      }
    } as SecurityEdge,

    // Management access (control gaps)
    {
      id: 'router-management',
      source: 'internet-router',
      target: 'perimeter-firewall',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'bottom',
      data: {
        label: 'Telnet Management',
        protocol: 'Telnet',
        encryption: 'none',
        dataClassification: 'Internal',
        zone: 'Internet' as SecurityZone
      }
    } as SecurityEdge,

    // Debug port bypass arc — arcs above all zones to reach Internal directly
    {
      id: 'debug-access',
      source: 'internet-router',
      target: 'app-server',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'top',
      data: {
        label: 'Remote Debug (Port 9000)',
        protocol: 'HTTP',
        encryption: 'none',
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone,
        controlPoints: [
          { id: 'cp-da-1', x: 550, y: -100, active: true },
          { id: 'cp-da-2', x: 1950, y: -100, active: true }
        ]
      }
    } as SecurityEdge
  ]
};
