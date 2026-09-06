export interface ControlFrameworkCatalogEntry {
  frameworkKey: string;
  name: string;
  version: string;
  releaseDate: string;
  releaseDateLabel: string;
  description: string;
  controlCount: number;
  families: string[];
  tags: string[];
  sourceOrg: string;
  category: 'compliance' | 'threat' | 'government';
  supportsSelectiveLoad: boolean;
  hasBaseControlsOnlyOption?: boolean;
  baseControlCount?: number;
  dataFileAvailable: boolean;
}

export const controlFrameworkCatalog: ControlFrameworkCatalogEntry[] = [
  {
    frameworkKey: 'nist-800-53',
    name: 'NIST SP 800-53',
    version: 'Rev 5.1',
    releaseDate: '2020-09',
    releaseDateLabel: 'Sep 2020',
    description: 'Comprehensive security and privacy controls for federal information systems and organizations.',
    controlCount: 1189,
    families: [
      'Access Control', 'Awareness and Training', 'Audit and Accountability',
      'Assessment, Authorization, and Monitoring', 'Configuration Management',
      'Contingency Planning', 'Identification and Authentication',
      'Incident Response', 'Maintenance', 'Media Protection',
      'Physical and Environmental Protection', 'Planning',
      'Program Management', 'Personnel Security', 'PII Processing and Transparency',
      'Risk Assessment', 'System and Services Acquisition',
      'System and Communications Protection', 'System and Information Integrity',
      'Supply Chain Risk Management'
    ],
    tags: ['federal', 'privacy', 'comprehensive'],
    sourceOrg: 'NIST',
    category: 'compliance',
    supportsSelectiveLoad: true,
    hasBaseControlsOnlyOption: true,
    baseControlCount: 322,
    dataFileAvailable: true
  },
  {
    frameworkKey: 'owasp-top-10',
    name: 'OWASP Top 10',
    version: '2021',
    releaseDate: '2021-09',
    releaseDateLabel: 'Sep 2021',
    description: 'Top 10 most critical web application security risks.',
    controlCount: 10,
    families: ['OWASP Top 10 2021'],
    tags: ['web', 'application', 'appsec'],
    sourceOrg: 'OWASP',
    category: 'compliance',
    supportsSelectiveLoad: false,
    dataFileAvailable: true
  },
  {
    frameworkKey: 'csa-ccm',
    name: 'CSA Cloud Controls Matrix',
    version: 'v4.0.10',
    releaseDate: '2023-06',
    releaseDateLabel: 'Jun 2023',
    description: 'Cloud-specific security controls across 17 domains for IaaS, PaaS, and SaaS environments.',
    controlCount: 197,
    families: [
      'Audit & Assurance', 'Application & Interface Security',
      'Business Continuity Management & Operational Resilience',
      'Change Control & Configuration Management',
      'Cryptography, Encryption & Key Management',
      'Datacenter Security', 'Data Security & Privacy Lifecycle Management',
      'Governance, Risk & Compliance',
      'Human Resources', 'Identity & Access Management',
      'Interoperability & Portability',
      'Infrastructure & Virtualization Security',
      'Logging & Monitoring', 'Security Incident Management, E-Discovery & Cloud Forensics',
      'Supply Chain Management, Transparency & Accountability',
      'Threat & Vulnerability Management',
      'Universal Endpoint Management'
    ],
    tags: ['cloud', 'iaas', 'paas', 'saas'],
    sourceOrg: 'Cloud Security Alliance',
    category: 'compliance',
    supportsSelectiveLoad: true,
    dataFileAvailable: false
  },
  {
    frameworkKey: 'mitre-attack-enterprise',
    name: 'MITRE ATT&CK Enterprise',
    version: 'v14.1',
    releaseDate: '2023-10',
    releaseDateLabel: 'Oct 2023',
    description: 'Adversarial tactics, techniques, and procedures for enterprise environments across 14 tactics.',
    controlCount: 820,
    families: [
      'Reconnaissance', 'Resource Development', 'Initial Access',
      'Execution', 'Persistence', 'Privilege Escalation',
      'Defense Evasion', 'Credential Access', 'Discovery',
      'Lateral Movement', 'Collection', 'Command and Control',
      'Exfiltration', 'Impact'
    ],
    tags: ['threat', 'ttp', 'adversary'],
    sourceOrg: 'MITRE',
    category: 'threat',
    supportsSelectiveLoad: true,
    dataFileAvailable: true
  },
  {
    frameworkKey: 'mitre-attack-ics',
    name: 'MITRE ATT&CK ICS',
    version: 'v14.1',
    releaseDate: '2023-10',
    releaseDateLabel: 'Oct 2023',
    description: 'Adversarial tactics and techniques targeting industrial control systems.',
    controlCount: 81,
    families: [
      'Initial Access', 'Execution', 'Persistence',
      'Privilege Escalation', 'Evasion', 'Discovery',
      'Lateral Movement', 'Collection', 'Command and Control',
      'Inhibit Response Function', 'Impair Process Control', 'Impact'
    ],
    tags: ['ics', 'ot', 'scada', 'threat'],
    sourceOrg: 'MITRE',
    category: 'threat',
    supportsSelectiveLoad: true,
    dataFileAvailable: true
  },
  {
    frameworkKey: 'mitre-attack-mobile',
    name: 'MITRE ATT&CK Mobile',
    version: 'v14.1',
    releaseDate: '2023-10',
    releaseDateLabel: 'Oct 2023',
    description: 'Adversarial tactics and techniques targeting mobile platforms (Android/iOS).',
    controlCount: 114,
    families: [
      'Initial Access', 'Execution', 'Persistence',
      'Privilege Escalation', 'Defense Evasion',
      'Credential Access', 'Discovery', 'Lateral Movement',
      'Collection', 'Command and Control', 'Exfiltration', 'Impact'
    ],
    tags: ['mobile', 'android', 'ios', 'threat'],
    sourceOrg: 'MITRE',
    category: 'threat',
    supportsSelectiveLoad: true,
    dataFileAvailable: true
  },
  {
    frameworkKey: 'iec-62443',
    name: 'IEC 62443-3-3',
    version: '2013',
    releaseDate: '2013-08',
    releaseDateLabel: 'Aug 2013',
    description: 'System security requirements and security levels for industrial automation and control systems.',
    controlCount: 92,
    families: [
      'FR1 - Identification & Authentication Control',
      'FR2 - Use Control',
      'FR3 - System Integrity',
      'FR4 - Data Confidentiality',
      'FR5 - Restricted Data Flow',
      'FR6 - Timely Response to Events',
      'FR7 - Resource Availability'
    ],
    tags: ['ics', 'ot', 'iacs', 'industrial'],
    sourceOrg: 'IEC / ISA',
    category: 'compliance',
    supportsSelectiveLoad: false,
    dataFileAvailable: false
  },
  {
    frameworkKey: 'ism-dec-2025',
    name: 'Australian ISM',
    version: 'December 2025',
    releaseDate: '2025-12',
    releaseDateLabel: 'Dec 2025',
    description: 'Australian Government Information Security Manual with 1,073 controls across 26 guideline chapters.',
    controlCount: 1073,
    families: [
      'Cyber Security Roles', 'Cyber Security Incidents',
      'Outsourcing', 'Security Documentation',
      'Physical Security', 'Personnel Security',
      'Communications Infrastructure', 'Communications Systems',
      'Enterprise Mobility', 'Evaluated Products',
      'ICT Equipment', 'Media',
      'System Hardening', 'System Management',
      'System Monitoring', 'Software Development',
      'Database Systems', 'Email',
      'Networking', 'Cryptography',
      'Gateways', 'Data Transfers',
      'Content Filtering', 'Web Applications',
      'Cloud Services', 'Virtualisation'
    ],
    tags: ['australian', 'government', 'ism', 'essential-eight'],
    sourceOrg: 'Australian Signals Directorate',
    category: 'government',
    supportsSelectiveLoad: true,
    dataFileAvailable: true
  },
  {
    frameworkKey: 'essential-eight',
    name: 'Essential Eight',
    version: 'October 2024',
    releaseDate: '2024-10',
    releaseDateLabel: 'Oct 2024',
    description: 'Eight essential mitigation strategies from ASD with three maturity levels, derived from ISM controls.',
    controlCount: 126,
    families: [
      'Application Control', 'Patch Applications',
      'Configure Microsoft Office Macro Settings',
      'User Application Hardening', 'Restrict Administrative Privileges',
      'Patch Operating Systems', 'Multi-factor Authentication',
      'Regular Backups'
    ],
    tags: ['australian', 'maturity', 'essential-eight', 'asd'],
    sourceOrg: 'Australian Signals Directorate',
    category: 'government',
    supportsSelectiveLoad: false,
    dataFileAvailable: true
  }
];
