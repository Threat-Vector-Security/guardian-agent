// src/types/ProductMatchingTypes.ts
import { 
    SecurityNodeType,
    SecurityZone
  } from './SecurityTypes';
  
  import { SecuritySeverity } from './ThreatIntelTypes';
  
  export interface ProductIdentifier {
    name: string;
    alternateNames: string[];
    ecosystem: string;
    type: SecurityNodeType;
    versionPattern: RegExp;
    commonLocations: SecurityZone[];
    relatedProducts?: string[];
    componentTypes?: SecurityNodeType[];
  }
  // ..

export interface ProductIdentifier {
    name: string;
    alternateNames: string[];
    ecosystem: string;
    type: SecurityNodeType;
    versionPattern: RegExp;
    commonLocations: SecurityZone[];
    relatedProducts?: string[];
    componentTypes?: SecurityNodeType[];
    // defaultSecurityLevel removed - no longer part of the model
    criticalityScore?: number; // 0-1, affects risk calculations
  }

export interface VersionMatch {
  version: string;
  confidence: number;
}

export interface ProductMatch {
  vendor: string;
  product: string;
  versionRange: string;
}

export interface ComponentMatch {
  name: string;
  version: string;
  ecosystem?: string;
}

export interface VersionRange {
  operator: string;
  version: string;
}

export type EcosystemType = 
  | 'ECOSYSTEM_LINUX'
  | 'ECOSYSTEM_WINDOWS'
  | 'MAVEN'
  | 'NPM'
  | 'CONTAINER'
  | 'NETWORK_APPLIANCE'
  | 'CLOUD'
  | 'OT_ICS';

export const ECOSYSTEM_RISK_LEVELS: Record<EcosystemType, number> = {
  ECOSYSTEM_LINUX: 0.8,
  ECOSYSTEM_WINDOWS: 0.75,
  MAVEN: 0.7,
  NPM: 0.6,
  CONTAINER: 0.75,
  NETWORK_APPLIANCE: 0.9,
  CLOUD: 0.85,
  OT_ICS: 0.95
};

export const PRODUCT_PATTERNS: ProductIdentifier[] = [
    // Web Servers
    {
      name: 'apache',
      alternateNames: ['httpd', 'apache2', 'apache http server', 'apache httpd'],
      ecosystem: 'ECOSYSTEM_LINUX',
      type: 'webServer',
      versionPattern: /^(?:2\.[0-4]\.\d+|2\.4\.[0-9]{1,2})$/,
      commonLocations: ['DMZ', 'External'],
      componentTypes: ['webServer', 'reverseProxy'],
      criticalityScore: 0.8
    },
    {
      name: 'nginx',
      alternateNames: ['nginx server', 'nginx http', 'nginx-core'],
      ecosystem: 'ECOSYSTEM_LINUX',
      type: 'webServer',
      versionPattern: /^(?:1\.[0-9]{1,2}\.\d+|1\.2[0-4]\.\d+)$/,
      commonLocations: ['DMZ', 'External'],
      componentTypes: ['webServer', 'reverseProxy', 'loadBalancer'],
      criticalityScore: 0.8
    },
  
    // Application Servers
    {
      name: 'tomcat',
      alternateNames: ['apache tomcat', 'tomcat server', 'tomcat application'],
      ecosystem: 'MAVEN',
      type: 'application',
      versionPattern: /^(?:8\.[0-9]\.\d+|9\.[0-9]\.\d+|10\.[0-9]\.\d+)$/,
      commonLocations: ['Internal', 'DMZ'],
      componentTypes: ['application', 'webServer'],
      criticalityScore: 0.75
    },
    {
      name: 'jboss',
      alternateNames: ['wildfly', 'jboss as', 'red hat jboss', 'jboss-eap'],
      ecosystem: 'MAVEN',
      type: 'application',
      versionPattern: /^(?:7\.\d+\.\d+|8\.\d+\.\d+)$/,
      commonLocations: ['Internal', 'DMZ'],
      componentTypes: ['application'],
      criticalityScore: 0.75
    },
  
    // Databases
    {
      name: 'mysql',
      alternateNames: ['mysql server', 'mysql database', 'mysql-community', 'mariadb'],
      ecosystem: 'ECOSYSTEM_LINUX',
      type: 'database',
      versionPattern: /^(?:5\.[5-7]\.\d+|8\.[0-9]\.\d+)$/,
      commonLocations: ['Restricted', 'Internal'],
      componentTypes: ['database'],
      criticalityScore: 0.9
    },
    {
      name: 'postgresql',
      alternateNames: ['postgres', 'postgresql server', 'psql'],
      ecosystem: 'ECOSYSTEM_LINUX',
      type: 'database',
      versionPattern: /^(?:9\.[4-6]\.\d+|1[0-5]\.\d+)$/,
      commonLocations: ['Restricted', 'Internal'],
      componentTypes: ['database'],
      criticalityScore: 0.9
    },
  
    // Load Balancers
    {
      name: 'haproxy',
      alternateNames: ['ha-proxy', 'ha proxy server', 'haproxy-lb'],
      ecosystem: 'ECOSYSTEM_LINUX',
      type: 'loadBalancer',
      versionPattern: /^(?:1\.[5-8]\.\d+|2\.[0-4]\.\d+)$/,
      commonLocations: ['DMZ', 'External'],
      componentTypes: ['loadBalancer', 'reverseProxy'],
      criticalityScore: 0.7
    },
    {
      name: 'f5',
      alternateNames: ['f5 big-ip', 'big-ip', 'f5 ltm', 'f5-bigip'],
      ecosystem: 'NETWORK_APPLIANCE',
      type: 'loadBalancer',
      versionPattern: /^(?:1[1-6]\.[0-9]\.\d+)$/,
      commonLocations: ['DMZ', 'External'],
      componentTypes: ['loadBalancer', 'firewall', 'waf'],
      criticalityScore: 0.85
    },
  
    // Firewalls
    {
      name: 'palo alto',
      alternateNames: ['panos', 'pa-firewall', 'palo alto networks'],
      ecosystem: 'NETWORK_APPLIANCE',
      type: 'firewall',
      versionPattern: /^(?:[7-9]\.[0-9]\.\d+|10\.[0-9]\.\d+)$/,
      commonLocations: ['DMZ', 'External', 'Internal'],
      componentTypes: ['firewall', 'vpnGateway'],
      criticalityScore: 0.95
    },
    {
      name: 'fortinet',
      alternateNames: ['fortigate', 'fortios', 'fortigate firewall'],
      ecosystem: 'NETWORK_APPLIANCE',
      type: 'firewall',
      versionPattern: /^(?:[5-7]\.[0-9]\.\d+)$/,
      commonLocations: ['DMZ', 'External', 'Internal'],
      componentTypes: ['firewall', 'vpnGateway'],
      criticalityScore: 0.95
    },
  
    // Application Security
    {
      name: 'modsecurity',
      alternateNames: ['mod_security', 'modsec', 'apache modsecurity'],
      ecosystem: 'ECOSYSTEM_LINUX',
      type: 'waf',
      versionPattern: /^(?:2\.[0-9]\.\d+|3\.[0-9]\.\d+)$/,
      commonLocations: ['DMZ', 'External'],
      componentTypes: ['waf', 'webServer'],
      criticalityScore: 0.85
    },
  
    // Message Brokers
    {
      name: 'rabbitmq',
      alternateNames: ['rabbit mq', 'rabbitmq-server'],
      ecosystem: 'ECOSYSTEM_LINUX',
      type: 'messageBroker',
      versionPattern: /^(?:3\.[0-9]\.\d+)$/,
      commonLocations: ['Internal'],
      componentTypes: ['messageBroker'],
      criticalityScore: 0.7
    },
    
    // Authentication Servers
    {
      name: 'active directory',
      alternateNames: ['ad', 'windows ad', 'microsoft ad', 'domain controller'],
      ecosystem: 'ECOSYSTEM_WINDOWS',
      type: 'authServer',
      versionPattern: /^(?:2012|2016|2019|2022)$/,
      commonLocations: ['Internal', 'Restricted'],
      componentTypes: ['authServer'],
      criticalityScore: 0.95
    },
  
    // Cloud Services
    {
      name: 'kubernetes',
      alternateNames: ['k8s', 'kube', 'kubernetes cluster'],
      ecosystem: 'CONTAINER',
      type: 'kubernetesService',
      versionPattern: /^(?:1\.[0-9]{2}\.\d+)$/,
      commonLocations: ['Cloud'],
      componentTypes: ['kubernetesService', 'kubernetesPod', 'containerRegistry'],
      criticalityScore: 0.85
    },
  
    // ICS/SCADA
    {
      name: 'rockwell',
      alternateNames: ['allen bradley', 'rockwell automation', 'controllogix'],
      ecosystem: 'OT_ICS',
      type: 'plc',
      versionPattern: /^(?:v\d{2}|v\d{2}\.\d{2})$/,
      commonLocations: ['OT'],
      componentTypes: ['plc', 'hmi'],
      criticalityScore: 1.0
    }
  ];
  
  export const ECOSYSTEM_PATTERNS = {
    MAVEN: {
      versionPattern: /^\d+\.\d+\.\d+$/,
      packagePatterns: [
        /^org\.apache\./,
        /^com\.springframework\./,
        /^io\.undertow\./
      ]
    },
    NPM: {
      versionPattern: /^\d+\.\d+\.\d+(?:-[a-zA-Z]+\.\d+)?$/,
      packagePatterns: [
        /^@angular\//,
        /^@nestjs\//,
        /^express$/
      ]
    },
    CONTAINER: {
      versionPattern: /^(?:\d+\.\d+\.\d+|latest)$/,
      packagePatterns: [
        /^docker\.io\//,
        /^gcr\.io\//,
        /^k8s\.gcr\.io\//
      ]
    }
  };
  
  export const SEVERITY_WEIGHTS = {
    CRITICAL: 1.0,
    HIGH: 0.8,
    MODERATE: 0.5,
    LOW: 0.2
  };
  
  export interface ProductVersionRange {
    start: string;
    end: string;
    isInclusive?: boolean;
  }
  
  export interface ProductVulnerability {
    id: string;
    affects: ProductVersionRange;
    severity: SecuritySeverity;
    description: string;
    references?: string[];
  }
  
  export const KNOWN_VULNERABILITIES = new Map<string, ProductVulnerability[]>();
