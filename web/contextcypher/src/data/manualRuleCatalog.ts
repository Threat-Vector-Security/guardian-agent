export type ManualRuleDetails = {
  id: string;
  title: string;
  summary: string;
  whyItMatters: string;
  conditions: string[];
  howToFix: string[];
  dataSources: string[];
  frameworks?: string[];
  references?: {
    owasp?: string[];
    stride?: string[];
  };
};

export const manualRuleCatalog: Record<string, ManualRuleDetails> = {
  'DFD-001': {
    id: 'DFD-001',
    title: 'External entity connected directly to data store',
    summary: 'DFD best practice expects external entities to access data stores through a process layer.',
    whyItMatters: 'Direct access bypasses validation, authorization, and audit points that typically live in processes, increasing the risk of tampering and data exposure.',
    conditions: [
      'An edge connects an actor directly to a data store without an intermediate process.'
    ],
    howToFix: [
      'Insert a process between the external entity and the data store.',
      'Define authentication and authorization on the process layer.',
      'Document validation and logging controls on the process.'
    ],
    dataSources: [
      'Edge: source/target node IDs',
      'Node: type or data.dfdCategory to resolve actor vs data store'
    ],
    frameworks: ['DFD', 'OWASP', 'STRIDE'],
    references: {
      owasp: ['A01 Broken Access Control', 'A04 Insecure Design'],
      stride: ['Tampering', 'Information Disclosure', 'Elevation of Privilege']
    }
  },
  'DFD-002': {
    id: 'DFD-002',
    title: 'Data flow missing label',
    summary: 'Every data flow should be labeled to identify the data being transmitted.',
    whyItMatters: 'Unlabeled flows make it difficult to assess data sensitivity, required controls, and trust boundary impact.',
    conditions: [
      'Edge label is missing or empty.'
    ],
    howToFix: [
      'Add a descriptive label for the data payload.',
      'Note the data classification if known.',
      'Include protocol or format hints if needed.'
    ],
    dataSources: [
      'Edge: data.label (data flow label)'
    ],
    frameworks: ['DFD', 'OWASP', 'STRIDE'],
    references: {
      owasp: ['A04 Insecure Design'],
      stride: ['Repudiation', 'Information Disclosure']
    }
  },
  'DFD-003': {
    id: 'DFD-003',
    title: 'Process missing input or output',
    summary: 'DFD processes should have at least one inbound and one outbound data flow.',
    whyItMatters: 'A process without a complete flow path often indicates missing interactions or an incomplete model, obscuring how data is transformed or protected.',
    conditions: [
      'Process node has zero inbound or zero outbound edges.'
    ],
    howToFix: [
      'Add the missing inbound or outbound flow.',
      'Confirm the data transformation steps and controls.',
      'Remove the process if it is not part of the system.'
    ],
    dataSources: [
      'Node: type or data.dfdCategory to identify processes',
      'Edges: inbound/outbound connection counts'
    ],
    frameworks: ['DFD', 'OWASP', 'STRIDE'],
    references: {
      owasp: ['A04 Insecure Design'],
      stride: ['Tampering', 'Repudiation']
    }
  },
  'DFD-004': {
    id: 'DFD-004',
    title: 'Data store not connected to a process',
    summary: 'DFD data stores should be accessed via a process that reads or writes data.',
    whyItMatters: 'Unattached data stores often represent shadow storage or incomplete access paths, hiding where controls like encryption and access checks should be applied.',
    conditions: [
      'Data store node has no connected process nodes.'
    ],
    howToFix: [
      'Connect the data store to the process that reads or writes it.',
      'Document access control and encryption for the store.',
      'Remove the data store if it is not part of the system.'
    ],
    dataSources: [
      'Node: type or data.dfdCategory to identify data stores',
      'Edges: connections to processes'
    ],
    frameworks: ['DFD', 'OWASP', 'STRIDE'],
    references: {
      owasp: ['A04 Insecure Design'],
      stride: ['Information Disclosure', 'Tampering']
    }
  },
  'DFD-005': {
    id: 'DFD-005',
    title: 'Unconnected element',
    summary: 'Each element in the DFD should participate in at least one data flow.',
    whyItMatters: 'Isolated elements reduce model completeness and may hide data handling paths or trust boundary crossings.',
    conditions: [
      'Node has no inbound or outbound edges.'
    ],
    howToFix: [
      'Connect the element to the relevant data flows.',
      'If it is out of scope, remove it from the diagram.',
      'Add notes to explain intentional isolation.'
    ],
    dataSources: [
      'Node: type (excluding zones, trust boundaries, annotations)',
      'Edges: inbound/outbound connection counts'
    ],
    frameworks: ['DFD', 'OWASP', 'STRIDE'],
    references: {
      owasp: ['A04 Insecure Design'],
      stride: ['Repudiation', 'Information Disclosure']
    }
  },
  'DFD-006': {
    id: 'DFD-006',
    title: 'DFD element missing type annotation',
    summary: 'DFD actors, processes, and data stores should specify their type for clearer modeling.',
    whyItMatters: 'Missing type annotations reduce model clarity and make it harder to apply consistent controls.',
    conditions: [
      'DFD actor/process/data store is missing its specific type field.'
    ],
    howToFix: [
      'Provide a type for the DFD actor, process, or data store.',
      'Use consistent naming for similar elements.'
    ],
    dataSources: [
      'Node: data.actorType, data.processType, data.storeType',
      'Node: type'
    ],
    frameworks: ['DFD', 'OWASP', 'STRIDE'],
    references: {
      owasp: ['A04 Insecure Design'],
      stride: ['Repudiation', 'Tampering']
    }
  },
  'TB-001': {
    id: 'TB-001',
    title: 'Cross-zone flow missing protocol or encryption',
    summary: 'Trust boundary crossings should specify protocol and encryption to clarify transport protections.',
    whyItMatters: 'Crossing zones without transport details makes it impossible to validate confidentiality and integrity assumptions.',
    conditions: [
      'Edge crosses zones and protocol or encryption is missing.'
    ],
    howToFix: [
      'Specify the protocol used by the flow.',
      'Define encryption (e.g. TLS, mTLS, VPN).',
      'Document key management or certificate handling.'
    ],
    dataSources: [
      'Edge: data.protocol, data.encryption, data.description',
      'Node: data.zone or security zone type for source/target'
    ],
    frameworks: ['OWASP', 'STRIDE'],
    references: {
      owasp: ['A02 Cryptographic Failures', 'A05 Security Misconfiguration'],
      stride: ['Information Disclosure', 'Tampering']
    }
  },
  'TB-002': {
    id: 'TB-002',
    title: 'Cross-zone flow missing authentication',
    summary: 'Flows from lower-trust zones into higher-trust zones should include authentication controls.',
    whyItMatters: 'Without authentication, higher-trust zones are exposed to spoofing and unauthorized access.',
    conditions: [
      'Edge crosses from a lower-trust zone to a higher-trust zone without authentication signals.'
    ],
    howToFix: [
      'Add authentication mechanisms (e.g. OAuth, mTLS, API keys).',
      'Document authorization and identity validation steps.',
      'Add monitoring for failed or anomalous auth attempts.'
    ],
    dataSources: [
      'Edge: data.securityControls',
      'Node: data.accessControl.authentication',
      'Node: data.zone or security zone type for trust comparisons'
    ],
    frameworks: ['OWASP', 'STRIDE'],
    references: {
      owasp: ['A01 Broken Access Control', 'A07 Identification and Authentication Failures'],
      stride: ['Spoofing', 'Elevation of Privilege']
    }
  },
  'TB-003': {
    id: 'TB-003',
    title: 'Trust boundary missing type',
    summary: 'Trust boundaries should specify the boundary they represent.',
    whyItMatters: 'Undefined boundaries make it harder to reason about trust transitions and required controls.',
    conditions: [
      'Trust boundary node has no boundary type.'
    ],
    howToFix: [
      'Set a boundary type such as Internet, DMZ, or container boundary.',
      'Document the trust assumptions at this boundary.'
    ],
    dataSources: [
      'Node: data.boundaryType',
      'Node: type'
    ],
    frameworks: ['DFD', 'OWASP', 'STRIDE'],
    references: {
      owasp: ['A04 Insecure Design'],
      stride: ['Information Disclosure', 'Tampering']
    }
  },
  'IA-002': {
    id: 'IA-002',
    title: 'Cross-zone flow missing authorization control',
    summary: 'Authenticated flows into higher-trust zones should specify authorization or access control.',
    whyItMatters: 'Authentication alone does not prevent privilege escalation or excessive access to sensitive components.',
    conditions: [
      'Low-to-high trust flow has authentication signals but no authorization controls.'
    ],
    howToFix: [
      'Define authorization controls such as RBAC, ABAC, or scoped tokens.',
      'Document permission checks and enforcement points.'
    ],
    dataSources: [
      'Edge: data.securityControls, data.description',
      'Node: data.accessControl.authorization',
      'Node: data.securityControls'
    ],
    frameworks: ['OWASP', 'STRIDE'],
    references: {
      owasp: ['A01 Broken Access Control'],
      stride: ['Elevation of Privilege', 'Spoofing']
    }
  },
  'IA-003': {
    id: 'IA-003',
    title: 'Privileged access missing MFA',
    summary: 'Privileged components should require MFA or step-up authentication.',
    whyItMatters: 'Without MFA, credential theft or replay attacks can lead to privileged access.',
    conditions: [
      'Low-to-high trust flow targets a privileged component without MFA signals.'
    ],
    howToFix: [
      'Require MFA for privileged access.',
      'Enable step-up authentication for sensitive operations.'
    ],
    dataSources: [
      'Node: data.accessControl.authentication',
      'Node: data.securityControls',
      'Edge: trust boundary direction (low trust to high trust)'
    ],
    frameworks: ['OWASP', 'STRIDE'],
    references: {
      owasp: ['A07 Identification and Authentication Failures'],
      stride: ['Elevation of Privilege', 'Spoofing']
    }
  },
  'TB-004': {
    id: 'TB-004',
    title: 'Zone contains sensitive data without classification',
    summary: 'Zones containing sensitive elements should define a data classification level.',
    whyItMatters: 'Missing classifications make it harder to enforce consistent controls and can lead to under-protected data.',
    conditions: [
      'Zone contains sensitive nodes but zone classification is empty.'
    ],
    howToFix: [
      'Set a classification level for the zone.',
      'Align zone controls with the highest data sensitivity present.',
      'Review zoning to ensure consistent trust assumptions.'
    ],
    dataSources: [
      'Zone: data.zoneType, data.dataClassification',
      'Node: data.zone and data.dataClassification for nodes inside zone'
    ],
    frameworks: ['OWASP', 'STRIDE'],
    references: {
      owasp: ['A04 Insecure Design', 'A05 Security Misconfiguration'],
      stride: ['Information Disclosure', 'Repudiation']
    }
  },
  'DP-001': {
    id: 'DP-001',
    title: 'Sensitive data flow lacks encryption',
    summary: 'Sensitive data should be encrypted in transit.',
    whyItMatters: 'Unencrypted sensitive data can be intercepted or modified, especially across shared networks.',
    conditions: [
      'Flow is sensitive and encryption is not specified in edge fields or controls.'
    ],
    howToFix: [
      'Use TLS or mTLS for the flow.',
      'Document key and certificate management.',
      'Enforce encryption-only connections.'
    ],
    dataSources: [
      'Edge: data.encryption, data.securityControls, data.description',
      'Edge: data.dataClassification or node data.dataClassification'
    ],
    frameworks: ['OWASP', 'STRIDE'],
    references: {
      owasp: ['A02 Cryptographic Failures'],
      stride: ['Information Disclosure', 'Tampering']
    }
  },
  'DP-002': {
    id: 'DP-002',
    title: 'Sensitive data store lacks encryption control',
    summary: 'Sensitive data stores should be protected with encryption at rest.',
    whyItMatters: 'If storage is compromised, plaintext data increases impact and compliance exposure.',
    conditions: [
      'Sensitive data store lacks encryption controls.'
    ],
    howToFix: [
      'Enable storage-level encryption (KMS, HSM, or disk encryption).',
      'Restrict access to encryption keys.',
      'Document rotation and key lifecycle policies.'
    ],
    dataSources: [
      'Node: type or data.dfdCategory to identify data stores',
      'Node: data.dataClassification, data.securityControls'
    ],
    frameworks: ['OWASP', 'STRIDE'],
    references: {
      owasp: ['A02 Cryptographic Failures'],
      stride: ['Information Disclosure', 'Tampering']
    }
  },
  'DP-003': {
    id: 'DP-003',
    title: 'Sensitive data flow lacks monitoring',
    summary: 'Sensitive flows should be monitored and logged to detect misuse or leakage.',
    whyItMatters: 'Without monitoring, attacks and data leakage may go undetected.',
    conditions: [
      'Sensitive flow lacks logging or monitoring controls.'
    ],
    howToFix: [
      'Add logging or monitoring controls to the flow.',
      'Feed logs to SIEM or alerting pipelines.',
      'Define alert thresholds for sensitive data access.'
    ],
    dataSources: [
      'Edge: data.securityControls, data.description',
      'Edge: data.dataClassification or node data.dataClassification'
    ],
    frameworks: ['OWASP', 'STRIDE'],
    references: {
      owasp: ['A09 Security Logging and Monitoring Failures'],
      stride: ['Repudiation', 'Information Disclosure']
    }
  },
  'OWASP-A03-001': {
    id: 'OWASP-A03-001',
    title: 'External-facing component missing input validation controls',
    summary: 'External-facing application flows should document input validation or sanitization controls.',
    whyItMatters: 'Missing validation increases the risk of injection and data manipulation.',
    conditions: [
      'External-facing flow targets an application component without validation controls.'
    ],
    howToFix: [
      'Add input validation and sanitization controls.',
      'Use parameterized queries or request filtering (WAF).'
    ],
    dataSources: [
      'Edge: source/target zones and data.securityControls, data.description',
      'Node: data.securityControls, data.category, node type'
    ],
    frameworks: ['OWASP', 'STRIDE'],
    references: {
      owasp: ['A03 Injection'],
      stride: ['Tampering', 'Information Disclosure']
    }
  },
  'OWASP-A05-001': {
    id: 'OWASP-A05-001',
    title: 'Exposed component missing security controls',
    summary: 'Externally reachable components should list baseline security controls.',
    whyItMatters: 'Missing controls often indicate misconfiguration or unprotected services.',
    conditions: [
      'Component is externally reachable and has no security controls listed.'
    ],
    howToFix: [
      'Document WAF, rate limiting, authentication, and monitoring controls.',
      'Harden exposed services and verify configuration.'
    ],
    dataSources: [
      'Node: data.securityControls',
      'Edge: inbound source zones'
    ],
    frameworks: ['OWASP', 'STRIDE'],
    references: {
      owasp: ['A05 Security Misconfiguration'],
      stride: ['Information Disclosure', 'Denial of Service']
    }
  },
  'OWASP-A05-002': {
    id: 'OWASP-A05-002',
    title: 'Flow missing port range for TCP/UDP',
    summary: 'TCP/UDP flows should specify port ranges for accurate exposure analysis.',
    whyItMatters: 'Missing ports can hide overly broad access or misconfigured firewall rules.',
    conditions: [
      'Protocol indicates TCP/UDP and port range is missing.'
    ],
    howToFix: [
      'Specify the port or port range for this flow.',
      'Validate firewall rules against the documented ports.'
    ],
    dataSources: [
      'Edge: data.protocol',
      'Edge: data.portRange'
    ],
    frameworks: ['OWASP', 'STRIDE'],
    references: {
      owasp: ['A05 Security Misconfiguration'],
      stride: ['Information Disclosure']
    }
  },
  'OWASP-A05-003': {
    id: 'OWASP-A05-003',
    title: 'Flow zone does not match connected nodes',
    summary: 'Flow zone annotations should match the source or target zone.',
    whyItMatters: 'Mismatched flow zones can hide boundary crossings and lead to incorrect control assumptions.',
    conditions: [
      'Edge zone is set and does not match source or target zone.'
    ],
    howToFix: [
      'Align the flow zone with the source or target zone.',
      'Update node zones if the boundary assignment has changed.'
    ],
    dataSources: [
      'Edge: data.zone',
      'Node: data.zone or security zone type for source/target'
    ],
    frameworks: ['OWASP', 'STRIDE'],
    references: {
      owasp: ['A05 Security Misconfiguration'],
      stride: ['Information Disclosure']
    }
  },
  'OWASP-A06-001': {
    id: 'OWASP-A06-001',
    title: 'Component missing version or patch metadata',
    summary: 'Components should record version or patch levels to assess exposure to known vulnerabilities.',
    whyItMatters: 'Without version data, vulnerable or outdated components are harder to detect.',
    conditions: [
      'Vendor or technology is set but version/patch metadata is missing.'
    ],
    howToFix: [
      'Add version, patch level, or last updated metadata.',
      'Track CVE exposure for this component.'
    ],
    dataSources: [
      'Node: data.vendor, data.technology, data.version, data.patchLevel, data.lastUpdated'
    ],
    frameworks: ['OWASP', 'STRIDE'],
    references: {
      owasp: ['A06 Vulnerable and Outdated Components'],
      stride: ['Information Disclosure', 'Elevation of Privilege']
    }
  },
  'OWASP-A06-002': {
    id: 'OWASP-A06-002',
    title: 'Component list missing versions',
    summary: 'Component inventories should include versions for vulnerability assessment.',
    whyItMatters: 'Missing versions obscure exposure to known vulnerabilities and patch gaps.',
    conditions: [
      'Component inventory entries are missing versions.'
    ],
    howToFix: [
      'Add version data for each component.',
      'Use SBOM tooling or asset management to keep versions current.'
    ],
    dataSources: [
      'Node: data.components (name/version pairs)'
    ],
    frameworks: ['OWASP', 'STRIDE'],
    references: {
      owasp: ['A06 Vulnerable and Outdated Components'],
      stride: ['Information Disclosure']
    }
  },
  'OWASP-A08-001': {
    id: 'OWASP-A08-001',
    title: 'Supply chain component missing integrity controls',
    summary: 'Software supply chain components should use integrity controls such as signing, checksums, or provenance.',
    whyItMatters: 'Missing integrity controls increases the risk of tampered dependencies and compromised artifacts.',
    conditions: [
      'Supply chain related component lacks integrity controls (signing, checksums, provenance).'
    ],
    howToFix: [
      'Enable artifact signing or checksums.',
      'Adopt SBOM and provenance checks in the pipeline.'
    ],
    dataSources: [
      'Node: label/type/technology for supply chain detection',
      'Node: data.securityControls'
    ],
    frameworks: ['OWASP', 'STRIDE'],
    references: {
      owasp: ['A08 Software and Data Integrity Failures'],
      stride: ['Tampering', 'Elevation of Privilege']
    }
  },
  'OWASP-A10-001': {
    id: 'OWASP-A10-001',
    title: 'Potential SSRF path without egress controls',
    summary: 'Outbound HTTP/S flows from externally reachable components should enforce egress controls.',
    whyItMatters: 'Without egress controls, attackers can pivot to internal services via SSRF.',
    conditions: [
      'Externally reachable HTTP/S flow lacks egress controls.'
    ],
    howToFix: [
      'Implement egress allowlists or proxy enforcement.',
      'Restrict access to internal metadata endpoints.'
    ],
    dataSources: [
      'Edge: data.protocol, data.securityControls, data.description',
      'Node: source/target zones and data.securityControls'
    ],
    frameworks: ['OWASP', 'STRIDE'],
    references: {
      owasp: ['A10 Server-Side Request Forgery (SSRF)'],
      stride: ['Information Disclosure', 'Elevation of Privilege']
    }
  },
  'AR-001': {
    id: 'AR-001',
    title: 'Potential single point of failure',
    summary: 'Highly connected components should document redundancy or failover controls.',
    whyItMatters: 'Single points of failure increase denial-of-service risk and reduce resilience.',
    conditions: [
      'Node has high connection count without redundancy controls.'
    ],
    howToFix: [
      'Add redundancy, failover, or clustering controls.',
      'Document load balancing or replication strategies.'
    ],
    dataSources: [
      'Node: inbound/outbound edge counts',
      'Node: data.securityControls'
    ],
    frameworks: ['OWASP', 'STRIDE'],
    references: {
      owasp: ['A05 Security Misconfiguration'],
      stride: ['Denial of Service']
    }
  },
  'AR-EDGE-001': {
    id: 'AR-EDGE-001',
    title: 'Sensitive flow missing redundancy',
    summary: 'Sensitive data flows should document redundancy or failover expectations.',
    whyItMatters: 'Lack of redundancy increases risk of outages affecting critical data paths.',
    conditions: [
      'Flow is sensitive or critical and redundancy is not specified.'
    ],
    howToFix: [
      'Document redundant paths or failover strategies.',
      'Use load balancing or alternate routes for critical flows.'
    ],
    dataSources: [
      'Edge: data.redundancy',
      'Edge: data.dataClassification',
      'Edge: data.bandwidth, data.latency'
    ],
    frameworks: ['OWASP', 'STRIDE'],
    references: {
      owasp: ['A05 Security Misconfiguration'],
      stride: ['Denial of Service']
    }
  },
  'ARC-EDGE-001': {
    id: 'ARC-EDGE-001',
    title: 'Public entrypoint lacks traffic protections',
    summary: 'Public entrypoints should have protections such as rate limiting, WAF, or DDoS mitigation.',
    whyItMatters: 'Unprotected entrypoints are more vulnerable to denial-of-service and abuse.',
    conditions: [
      'Inbound flow from low-trust zone lacks traffic protection controls.'
    ],
    howToFix: [
      'Add WAF or API gateway protections.',
      'Enable rate limiting and bot mitigation.',
      'Apply DDoS protection for public entrypoints.'
    ],
    dataSources: [
      'Edge: data.securityControls',
      'Node: data.zone or security zone type for source/target'
    ],
    frameworks: ['OWASP', 'STRIDE'],
    references: {
      owasp: ['A05 Security Misconfiguration'],
      stride: ['Denial of Service']
    }
  },
  'AP-001': {
    id: 'AP-001',
    title: 'Attack path crosses trust boundary without authentication',
    summary: 'An attack path step crosses from a lower-trust zone to a higher-trust zone without authentication controls.',
    whyItMatters: 'Without authentication at trust boundary crossings, attackers can traverse the attack path to reach higher-trust resources unimpeded.',
    conditions: [
      'Attack path step edge connects nodes in different trust zones.',
      'Target zone has higher trust rank than source zone.',
      'No authentication controls detected on the edge or connected nodes.'
    ],
    howToFix: [
      'Add authentication controls (OAuth, mTLS, API keys) on the boundary crossing.',
      'Document identity validation at each trust boundary in the attack path.',
      'Consider defense-in-depth with multiple authentication checkpoints.'
    ],
    dataSources: [
      'Attack path: step edges and node zones',
      'Edge: data.securityControls',
      'Node: data.accessControl.authentication'
    ],
    frameworks: ['STRIDE', 'PASTA'],
    references: {
      owasp: ['A01 Broken Access Control', 'A07 Identification and Authentication Failures'],
      stride: ['Spoofing', 'Elevation of Privilege']
    }
  },
  'AP-002': {
    id: 'AP-002',
    title: 'Attack path carries sensitive data without encryption',
    summary: 'An attack path step transmits sensitive or confidential data without encryption controls.',
    whyItMatters: 'Sensitive data traversing an attack path without encryption can be intercepted, enabling information disclosure along the attack chain.',
    conditions: [
      'Attack path step edge carries Sensitive or Confidential data.',
      'No encryption keywords found in edge controls or metadata.'
    ],
    howToFix: [
      'Use TLS or mTLS for all sensitive data flows in the attack path.',
      'Document encryption and key management controls.',
      'Ensure end-to-end encryption across the full path.'
    ],
    dataSources: [
      'Attack path: step edges',
      'Edge: data.dataClassification, data.encryption, data.securityControls'
    ],
    frameworks: ['STRIDE', 'PASTA'],
    references: {
      owasp: ['A02 Cryptographic Failures'],
      stride: ['Information Disclosure', 'Tampering']
    }
  },
  'AP-003': {
    id: 'AP-003',
    title: 'Attack path targets internal resource from external zone without validation',
    summary: 'An attack path step goes from an external zone to an internal zone without input validation.',
    whyItMatters: 'External-to-internal traversal without validation enables injection attacks and unauthorized access through the attack chain.',
    conditions: [
      'Attack path step source is in a low-trust zone (Internet, External, DMZ, etc.).',
      'Attack path step target is in a high-trust zone (Internal, Management, etc.).',
      'No input validation or sanitization controls detected.'
    ],
    howToFix: [
      'Add input validation and sanitization at the boundary.',
      'Apply WAF or API gateway protections.',
      'Implement allowlisting for expected inputs.'
    ],
    dataSources: [
      'Attack path: step edges and node zones',
      'Edge: data.securityControls',
      'Node: data.securityControls'
    ],
    frameworks: ['STRIDE', 'PASTA', 'OWASP'],
    references: {
      owasp: ['A03 Injection', 'A01 Broken Access Control'],
      stride: ['Tampering', 'Elevation of Privilege']
    }
  },

  // ── Node-Type Contextual STRIDE Hints ─────────────────────────────────────
  'CTX-STORAGE': {
    id: 'CTX-STORAGE',
    title: 'Object/File Storage: Key STRIDE Threat Areas',
    summary: 'Object and file storage services are high-value data-at-rest targets prone to misconfigured access control policies and absent audit logging.',
    whyItMatters: 'Overly permissive access policies or absent object-level logging are among the most common causes of large-scale data breaches. Encryption gaps expose data if access controls are bypassed.',
    conditions: ['Node type is storage or an object/file storage variant.'],
    howToFix: [
      'Disable public access; enforce private-only access policies by default.',
      'Enable encryption at rest using platform-managed or customer-managed encryption keys.',
      'Enable granular access audit logging (reads, writes, deletes) for sensitive stored data.',
      'Enable object versioning and deletion protection controls where the platform supports them.',
      'Use private network endpoints to avoid routing storage traffic over the public internet.',
    ],
    dataSources: ['Node: type = storage / cloudStorage'],
    frameworks: ['STRIDE'],
    references: { stride: ['Information Disclosure', 'Tampering', 'Repudiation'] }
  },
  'CTX-DB': {
    id: 'CTX-DB',
    title: 'Database: Key STRIDE Threat Areas',
    summary: 'Databases are primary targets for injection attacks, privilege abuse, and unauthorized data reads.',
    whyItMatters: 'A compromised database often results in a total loss of data confidentiality and integrity. Database admin accounts are a common lateral-movement stepping stone.',
    conditions: ['Node type is database, dataWarehouse, or similar data store variant.'],
    howToFix: [
      'Use parameterized queries/prepared statements.',
      'Apply least-privilege database account roles.',
      'Enable query auditing and ship logs to SIEM.',
      'Encrypt data at rest and restrict network access.',
    ],
    dataSources: ['Node: type = database / dataWarehouse'],
    frameworks: ['STRIDE', 'OWASP'],
    references: { owasp: ['A03 Injection', 'A01 Broken Access Control'], stride: ['Tampering', 'Information Disclosure', 'Elevation of Privilege'] }
  },
  'CTX-BULK-STORE': {
    id: 'CTX-BULK-STORE',
    title: 'File/Bulk Storage: Key STRIDE Threat Areas',
    summary: 'File servers and backup repositories are attractive ransomware targets and bulk exfiltration sources.',
    whyItMatters: 'Ransomware encrypting NAS/backup storage can halt business operations. Absent file-level audit trails make post-incident forensics extremely difficult.',
    conditions: ['Node type is fileServer or bulk/archive storage variant.'],
    howToFix: [
      'Enforce ACLs and file-level audit logging.',
      'Protect backups with immutable or WORM storage.',
      'Isolate backup networks from production.',
    ],
    dataSources: ['Node: type = fileServer'],
    frameworks: ['STRIDE'],
    references: { stride: ['Tampering', 'Information Disclosure', 'Denial of Service', 'Repudiation'] }
  },
  'CTX-CACHE': {
    id: 'CTX-CACHE',
    title: 'Cache/In-Memory Store: Key STRIDE Threat Areas',
    summary: 'Caches hold sensitive transient data (session tokens, user objects) and are targeted for cache poisoning and unauthorized reads.',
    whyItMatters: 'Unauthenticated Redis or Memcached instances are among the most easily exploited services; they often hold session tokens that grant full account access.',
    conditions: ['Node type is cache or in-memory store.'],
    howToFix: [
      'Require authentication and bind to internal interfaces only.',
      'Enable TLS; validate all values retrieved from cache.',
      'Set TTLs on all cached items.',
    ],
    dataSources: ['Node: type = cache'],
    frameworks: ['STRIDE'],
    references: { stride: ['Information Disclosure', 'Tampering', 'Denial of Service'] }
  },
  'CTX-WEB': {
    id: 'CTX-WEB',
    title: 'Web Server: Key STRIDE Threat Areas',
    summary: 'Web servers are internet-facing and targeted for injection, content manipulation, and resource exhaustion.',
    whyItMatters: 'Web servers are the most common initial access point for external attackers. Misconfigurations and unpatched vulnerabilities translate directly to public exploitability.',
    conditions: ['Node type is webServer.'],
    howToFix: [
      'Implement WAF, CSP, HSTS, and X-Frame-Options headers.',
      'Suppress verbose error pages and server banners.',
      'Apply rate limiting and DDoS mitigation.',
    ],
    dataSources: ['Node: type = webServer'],
    frameworks: ['STRIDE', 'OWASP'],
    references: { owasp: ['A05 Security Misconfiguration', 'A06 Vulnerable Components'], stride: ['Tampering', 'Information Disclosure', 'Elevation of Privilege', 'Denial of Service'] }
  },
  'CTX-APP': {
    id: 'CTX-APP',
    title: 'Application/Service: Key STRIDE Threat Areas',
    summary: 'Application servers handle business logic and are targeted for broken access control, injection, and token forgery.',
    whyItMatters: 'Business logic flaws and missing authorization checks are consistently in the OWASP Top 10. A compromised application service can be pivoted to access databases, internal APIs, and cloud services.',
    conditions: ['Node type is application, microservice, or generic service.'],
    howToFix: [
      'Enforce authorization on every endpoint; validate and sanitize all inputs.',
      'Implement SSRF protections and restrict outbound URLs.',
      'Use short-lived signed tokens and return generic error messages.',
    ],
    dataSources: ['Node: type = application'],
    frameworks: ['STRIDE', 'OWASP'],
    references: { owasp: ['A01 Broken Access Control', 'A03 Injection'], stride: ['Elevation of Privilege', 'Tampering', 'Spoofing', 'Information Disclosure'] }
  },
  'CTX-APIGW': {
    id: 'CTX-APIGW',
    title: 'API Gateway: Key STRIDE Threat Areas',
    summary: 'API gateways are single ingress points targeted for credential stuffing, BOLA, and rate exhaustion.',
    whyItMatters: 'API gateways without proper throttling and authorization are vulnerable to OWASP API Security Top 10 attacks including BOLA, broken authentication, and excessive data exposure.',
    conditions: ['Node type is apiGateway.'],
    howToFix: [
      'Enforce OAuth 2.0/JWT authentication on all routes.',
      'Apply per-consumer rate limiting and schema validation.',
      'Implement object-level authorization and log all API calls.',
    ],
    dataSources: ['Node: type = apiGateway'],
    frameworks: ['STRIDE', 'OWASP'],
    references: { owasp: ['API1 BOLA', 'API2 Broken Authentication', 'API4 Unrestricted Resource Consumption'], stride: ['Spoofing', 'Elevation of Privilege', 'Denial of Service'] }
  },
  'CTX-MSG': {
    id: 'CTX-MSG',
    title: 'Message Broker/Queue: Key STRIDE Threat Areas',
    summary: 'Message brokers relay sensitive data asynchronously and are targeted for unauthorized production, message tampering, and queue flooding.',
    whyItMatters: 'Unauthenticated message queues allow attackers to inject malicious messages into processing pipelines, potentially affecting downstream services in ways that are hard to trace.',
    conditions: ['Node type is messageQueue or message broker.'],
    howToFix: [
      'Authenticate producers and consumers; encrypt payloads in transit and at rest.',
      'Implement message signing and enforce topic-level ACLs.',
      'Set consumer quotas and produce rate limits.',
    ],
    dataSources: ['Node: type = messageQueue'],
    frameworks: ['STRIDE'],
    references: { stride: ['Spoofing', 'Tampering', 'Repudiation', 'Denial of Service'] }
  },
  'CTX-FW': {
    id: 'CTX-FW',
    title: 'Firewall/Security Control: Key STRIDE Threat Areas',
    summary: 'Firewalls and WAFs are perimeter chokepoints; their compromise or misconfiguration undermines the entire security boundary.',
    whyItMatters: 'A compromised firewall allows an attacker to silently modify rule sets, enabling traffic that would otherwise be blocked. Tampered logging makes this invisible to defenders.',
    conditions: ['Node type is firewall or WAF.'],
    howToFix: [
      'Restrict management interface to isolated management VLAN with MFA.',
      'Export logs to external write-protected SIEM; alert on log gaps.',
      'Version-control rule sets and require change-management approval.',
    ],
    dataSources: ['Node: type = firewall'],
    frameworks: ['STRIDE'],
    references: { stride: ['Elevation of Privilege', 'Tampering', 'Repudiation'] }
  },
  'CTX-LB': {
    id: 'CTX-LB',
    title: 'Load Balancer/CDN: Key STRIDE Threat Areas',
    summary: 'Load balancers and CDNs terminate TLS and distribute traffic; they are targeted for DDoS, header spoofing, and admin compromise.',
    whyItMatters: 'Without DDoS scrubbing at the LB/CDN layer, volumetric attacks reach origin servers directly. Header injection via X-Forwarded-For can spoof source IP addresses and bypass IP-based access controls.',
    conditions: ['Node type is loadBalancer or CDN.'],
    howToFix: [
      'Enable DDoS scrubbing and rate limiting at the CDN/LB layer.',
      'Validate and strip X-Forwarded-For headers.',
      'Allowlist origin IP to accept traffic from LB only; enforce HTTPS with strong TLS.',
    ],
    dataSources: ['Node: type = loadBalancer'],
    frameworks: ['STRIDE'],
    references: { stride: ['Denial of Service', 'Spoofing', 'Elevation of Privilege'] }
  },
  'CTX-ROUTER': {
    id: 'CTX-ROUTER',
    title: 'Router/Network Device: Key STRIDE Threat Areas',
    summary: 'Routers, switches, and DNS servers control traffic paths and name resolution; targeted for BGP/ARP/DNS spoofing and traffic interception.',
    whyItMatters: 'Network device compromise gives attackers the ability to redirect or intercept traffic at scale. BGP and DNS hijacking have been used in high-profile nation-state attacks.',
    conditions: ['Node type is router, switch, dns, or similar network infrastructure.'],
    howToFix: [
      'Enable RPKI/ROA, DAI, DHCP snooping, and DNSSEC.',
      'Disable legacy management protocols; use SSH and SNMPv3 only.',
      'Restrict management access to OOB network with strong authentication.',
    ],
    dataSources: ['Node: type = router / switch / dns'],
    frameworks: ['STRIDE'],
    references: { stride: ['Spoofing', 'Tampering', 'Information Disclosure'] }
  },
  'CTX-MONITOR': {
    id: 'CTX-MONITOR',
    title: 'Monitoring/SIEM: Key STRIDE Threat Areas',
    summary: 'Monitoring and SIEM systems aggregate sensitive telemetry; targeted for log tampering, alert suppression, and audit trail deletion.',
    whyItMatters: 'An attacker who can suppress SIEM alerts or delete audit logs can operate undetected indefinitely. Monitoring data also aggregates sensitive operational intelligence.',
    conditions: ['Node type is monitor, SIEM, or logging infrastructure.'],
    howToFix: [
      'Write logs to append-only/immutable storage; alert on log gaps.',
      'Restrict who can modify alert rules or suppress notifications.',
      'Encrypt sensitive log data; use write-only permissions for log transport accounts.',
    ],
    dataSources: ['Node: type = monitor'],
    frameworks: ['STRIDE'],
    references: { stride: ['Tampering', 'Repudiation', 'Information Disclosure'] }
  },
  'CTX-KMS': {
    id: 'CTX-KMS',
    title: 'Key Management/HSM: Key STRIDE Threat Areas',
    summary: 'KMS and HSMs are the cryptographic root of trust; their compromise breaks the security of every system that relies on those keys.',
    whyItMatters: 'Exfiltrating encryption keys allows offline decryption of all data protected by those keys. Admin-level KMS access can silently disable encryption for future data.',
    conditions: ['Node type is keyManagement or HSM.'],
    howToFix: [
      'Use HSM-backed storage; require dual authorization for destructive key operations.',
      'Log all key usage to external tamper-evident audit store; rotate keys on a schedule.',
      'Restrict KMS admin roles with tight IAM and hardware MFA.',
    ],
    dataSources: ['Node: type = keyManagement'],
    frameworks: ['STRIDE'],
    references: { stride: ['Information Disclosure', 'Elevation of Privilege', 'Repudiation'] }
  },
  'CTX-IAM': {
    id: 'CTX-IAM',
    title: 'Identity Provider/Auth Service: Key STRIDE Threat Areas',
    summary: 'Identity providers and SSO services are gatekeepers to all authenticated resources; targeted for credential theft, MFA bypass, and admin compromise.',
    whyItMatters: 'A compromised IdP provides an attacker with access to every application that trusts it. Legacy authentication protocols can be used to bypass modern MFA policies.',
    conditions: ['Node type is identityProvider, SSO, LDAP, or similar auth service.'],
    howToFix: [
      'Enforce phishing-resistant MFA (FIDO2/WebAuthn) for all privileged accounts.',
      'Implement adaptive authentication and anomaly detection.',
      'Disable legacy authentication protocols (Basic Auth, NTLM).',
    ],
    dataSources: ['Node: type = identityProvider'],
    frameworks: ['STRIDE'],
    references: { stride: ['Spoofing', 'Elevation of Privilege', 'Repudiation'] }
  },
  'CTX-PROXY': {
    id: 'CTX-PROXY',
    title: 'Proxy/Reverse Proxy: Key STRIDE Threat Areas',
    summary: 'Proxies mediate traffic and can introduce header smuggling, SSRF, and TLS interception risks.',
    whyItMatters: 'HTTP request smuggling and proxy misconfigurations can be exploited to bypass authentication, reach internal services via SSRF, or intercept sensitive data in transit.',
    conditions: ['Node type is proxy or reverse proxy.'],
    howToFix: [
      'Validate and normalize request headers; reject malformed or smuggled headers.',
      'Restrict CONNECT method to allowlisted destinations.',
      'Log all proxied requests; disable open proxy behavior.',
    ],
    dataSources: ['Node: type = proxy'],
    frameworks: ['STRIDE'],
    references: { stride: ['Spoofing', 'Information Disclosure', 'Elevation of Privilege'] }
  },
  'CTX-VPN': {
    id: 'CTX-VPN',
    title: 'VPN/ZTNA: Key STRIDE Threat Areas',
    summary: 'VPN gateways authenticate remote access; targeted for credential theft, overly broad post-auth network access, and concentrator DoS.',
    whyItMatters: 'VPN gateway vulnerabilities are among the most rapidly weaponized. Once authenticated, traditional VPNs often grant broad LAN access, enabling lateral movement.',
    conditions: ['Node type is vpn or ZTNA gateway.'],
    howToFix: [
      'Enforce certificate-based or FIDO2 auth; implement micro-segmentation post-auth.',
      'Apply device posture checks and monitor session anomalies.',
      'Patch VPN firmware promptly; rate-limit auth failures.',
    ],
    dataSources: ['Node: type = vpn'],
    frameworks: ['STRIDE'],
    references: { stride: ['Spoofing', 'Elevation of Privilege', 'Denial of Service'] }
  },
  'CTX-IDS': {
    id: 'CTX-IDS',
    title: 'IDS/IPS/Detection Sensor: Key STRIDE Threat Areas',
    summary: 'Detection sensors are targeted to blind defenders by suppressing alerts, tampering with signatures, or compromising the management console.',
    whyItMatters: 'Attackers who disable or evade IDS/IPS can operate undetected. Signature update poisoning can cause sensors to miss known threat patterns while reporting normal operation.',
    conditions: ['Node type is ids, ips, or detection/response sensor.'],
    howToFix: [
      'Protect management interfaces with MFA; verify signature update integrity.',
      'Alert on sensor silence or telemetry gaps.',
      'Log administrative actions to external SIEM; test detection coverage regularly.',
    ],
    dataSources: ['Node: type = ids'],
    frameworks: ['STRIDE'],
    references: { stride: ['Tampering', 'Repudiation', 'Elevation of Privilege'] }
  },
  'CTX-PAM': {
    id: 'CTX-PAM',
    title: 'Bastion Host/Jump Server: Key STRIDE Threat Areas',
    summary: 'Bastion hosts and PAM solutions are privileged access chokepoints; targeted for credential theft, lateral movement, and session recording bypass.',
    whyItMatters: 'A compromised bastion host gives an attacker a trusted vantage point to reach all production systems. Absent session recording eliminates the audit trail for privileged activities.',
    conditions: ['Node type is bastionHost or jump server.'],
    howToFix: [
      'Require phishing-resistant MFA; enable tamper-evident session recording.',
      'Implement JIT access; prevent direct admin access bypassing the bastion.',
      'Harden the bastion host itself: no persistent sessions, no outbound internet.',
    ],
    dataSources: ['Node: type = bastionHost'],
    frameworks: ['STRIDE'],
    references: { stride: ['Spoofing', 'Elevation of Privilege', 'Repudiation'] }
  },
  'CTX-CICD': {
    id: 'CTX-CICD',
    title: 'CI/CD Pipeline: Key STRIDE Threat Areas',
    summary: 'CI/CD pipelines have privileged deployment access; targeted for build artifact poisoning, dependency confusion, and credential theft.',
    whyItMatters: 'Compromising a CI/CD pipeline provides a trusted delivery mechanism for malicious code into production. Supply chain attacks via dependency confusion are increasingly common.',
    conditions: ['Node type is cicdPipeline or code repository.'],
    howToFix: [
      'Use short-lived OIDC credentials; pin dependencies with lockfiles and SBOM.',
      'Sign build artifacts; restrict pipeline permissions and branch protection rules.',
      'Log all pipeline runs with artifact hashes and deployment targets.',
    ],
    dataSources: ['Node: type = cicdPipeline'],
    frameworks: ['STRIDE'],
    references: { stride: ['Tampering', 'Elevation of Privilege', 'Repudiation'] }
  },
  'CTX-COMPUTE': {
    id: 'CTX-COMPUTE',
    title: 'Compute/Container: Key STRIDE Threat Areas',
    summary: 'VMs, containers, and serverless functions run workloads and are targeted for OS privilege escalation, container escape, and metadata service SSRF.',
    whyItMatters: 'Container escape or OS-level privilege escalation on a shared host can lead to cross-tenant data access. Cloud metadata SSRF can leak instance credentials with broad IAM permissions.',
    conditions: ['Node type is virtualMachine, container, server, or compute resource.'],
    howToFix: [
      'Run containers as non-root; block metadata endpoint access where not needed.',
      'Scan images for CVEs; apply OS hardening baselines.',
      'Use managed identity; monitor for privilege escalation indicators.',
    ],
    dataSources: ['Node: type = virtualMachine / container / server'],
    frameworks: ['STRIDE'],
    references: { stride: ['Elevation of Privilege', 'Tampering', 'Information Disclosure'] }
  },
  'CTX-OT': {
    id: 'CTX-OT',
    title: 'OT/ICS Device: Key STRIDE Threat Areas',
    summary: 'OT devices control physical processes; targeted for unauthorized command injection and process disruption with potential safety consequences.',
    whyItMatters: 'Attacks on OT systems can cause equipment damage, process disruption, and safety incidents. OT devices often run outdated firmware with no patch path.',
    conditions: ['Node type is plc, rtu, scada, or other OT/ICS device.'],
    howToFix: [
      'Apply strict OT network segmentation (IEC 62443); use data diodes for IT-to-OT flows.',
      'Whitelist permitted traffic; require authenticated change management for setpoint modifications.',
      'Monitor OT traffic with OT-aware IDS; maintain offline backups of PLC logic.',
    ],
    dataSources: ['Node: type = plc / rtu / scada'],
    frameworks: ['STRIDE', 'IEC 62443'],
    references: { stride: ['Tampering', 'Denial of Service', 'Spoofing'] }
  },
  'CTX-AI': {
    id: 'CTX-AI',
    title: 'AI/ML Model: Key STRIDE Threat Areas',
    summary: 'AI/ML endpoints have novel threat surfaces including prompt injection, training data extraction, and output manipulation.',
    whyItMatters: 'Prompt injection can cause AI systems to exfiltrate data or perform unauthorized actions on behalf of an attacker. Training data extraction can expose PII or proprietary information used in fine-tuning.',
    conditions: ['Node type is aiModel, llmService, or ML inference endpoint.'],
    howToFix: [
      'Implement prompt injection defences; do not embed sensitive data in system prompts.',
      'Apply output filtering; log inputs/outputs with PII redaction.',
      'Authenticate and rate-limit API access; validate model outputs before downstream use.',
    ],
    dataSources: ['Node: type = aiModel / llmService'],
    frameworks: ['STRIDE'],
    references: { stride: ['Spoofing', 'Information Disclosure', 'Tampering'] }
  },
  'CTX-VECDB': {
    id: 'CTX-VECDB',
    title: 'Vector Database/Data Lake: Key STRIDE Threat Areas',
    summary: 'Vector databases and data lakes aggregate embeddings and raw data; targeted for cross-tenant leakage, embedding poisoning, and bulk data exfiltration.',
    whyItMatters: 'Vector databases powering RAG applications can leak sensitive documents across tenants if namespace isolation is not enforced. Poisoned embeddings can manipulate AI retrieval results.',
    conditions: ['Node type is vectorDatabase or data lake.'],
    howToFix: [
      'Enforce namespace/tenant isolation and collection-level ACLs.',
      'Validate documents before ingestion to prevent embedding poisoning.',
      'Log all queries and ingestion operations with caller identity.',
    ],
    dataSources: ['Node: type = vectorDatabase'],
    frameworks: ['STRIDE'],
    references: { stride: ['Information Disclosure', 'Tampering', 'Repudiation'] }
  },
  'CTX-ENDPOINT': {
    id: 'CTX-ENDPOINT',
    title: 'Endpoint/Workstation: Key STRIDE Threat Areas',
    summary: 'User endpoints are frequent initial access vectors via phishing, malware, and supply-chain implants.',
    whyItMatters: 'Endpoints are the most common initial compromise point. Credential theft from endpoints leads to account takeover; malware can pivot to corporate networks and cloud resources.',
    conditions: ['Node type is workstation, laptop, desktop, endpoint, or mobile device.'],
    howToFix: [
      'Deploy EDR; enforce application allowlisting and phishing-resistant MFA.',
      'Apply OS hardening baselines and encrypt endpoint storage.',
      'Monitor for credential-dumping and alert SOC on suspicious activity.',
    ],
    dataSources: ['Node: type = workstation / laptop / endpoint / desktop / smartphone / tablet'],
    frameworks: ['STRIDE'],
    references: { stride: ['Spoofing', 'Tampering', 'Information Disclosure'] }
  },
  'CTX-DATASTORE': {
    id: 'CTX-DATASTORE',
    title: 'Data Store: Key STRIDE Threat Areas',
    summary: 'Data stores persist and retrieve sensitive information; applicable to any storage element without a more specific type.',
    whyItMatters: 'Uncontrolled access to data stores is the most direct path to data breach. Absent audit logging makes it impossible to determine what data was accessed or modified.',
    conditions: ['Node DFD category resolves to dataStore with no more specific type match.'],
    howToFix: [
      'Apply strict access controls and encrypt data at rest and in transit.',
      'Enable audit logging of all access; implement backup and recovery.',
      'Monitor for anomalous access patterns.',
    ],
    dataSources: ['Node: dfdCategory = dataStore (fallback)'],
    frameworks: ['STRIDE'],
    references: { stride: ['Tampering', 'Information Disclosure', 'Denial of Service', 'Repudiation'] }
  },
  'CTX-PROCESS': {
    id: 'CTX-PROCESS',
    title: 'Process/Service: Key STRIDE Threat Areas',
    summary: 'Process nodes transform or relay data and are applicable to any processing element without a more specific type.',
    whyItMatters: 'Processes are the primary location for injection attacks and broken authorization. A compromised process can be used as a pivot point to reach adjacent data stores and services.',
    conditions: ['Node DFD category resolves to process with no more specific type match.'],
    howToFix: [
      'Validate and sanitize all inputs; run under least-privilege service accounts.',
      'Apply rate limiting; use signed tokens for service-to-service authentication.',
      'Implement robust error handling that does not leak internal state.',
    ],
    dataSources: ['Node: dfdCategory = process (fallback)'],
    frameworks: ['STRIDE'],
    references: { stride: ['Spoofing', 'Tampering', 'Elevation of Privilege', 'Denial of Service'] }
  },
  'CTX-ACTOR': {
    id: 'CTX-ACTOR',
    title: 'External Actor: Key STRIDE Threat Areas',
    summary: 'External actors interact from outside the trust boundary; primary concerns are identity verification, non-repudiation, and data minimisation.',
    whyItMatters: 'External actors represent an untrusted input source. Without proper authentication and logging, it is impossible to verify identity or attribute actions.',
    conditions: ['Node DFD category resolves to actor with no more specific type match.'],
    howToFix: [
      'Authenticate all external actors; apply MFA for high-trust operations.',
      'Log all interactions with sufficient detail for non-repudiation.',
      'Apply least privilege; monitor for anomalous behaviour.',
    ],
    dataSources: ['Node: dfdCategory = actor (fallback)'],
    frameworks: ['STRIDE'],
    references: { stride: ['Spoofing', 'Repudiation', 'Information Disclosure'] }
  }
};
