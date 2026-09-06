import { StrideCategory } from '../types/ThreatIntelTypes';
import {
  AttackPathRiskLevel,
  DiagramAttackPath,
  DiagramAttackPathStep,
  AssessmentAttackPath
} from '../types/GrcTypes';

export const STRIDE_CATEGORIES: StrideCategory[] = [
  'Spoofing',
  'Tampering',
  'Repudiation',
  'Information Disclosure',
  'Denial of Service',
  'Elevation of Privilege'
];

export const STRIDE_SHORT: Record<StrideCategory, string> = {
  'Spoofing': 'S',
  'Tampering': 'T',
  'Repudiation': 'R',
  'Information Disclosure': 'I',
  'Denial of Service': 'D',
  'Elevation of Privilege': 'E'
};

export const STRIDE_COLORS: Record<StrideCategory, string> = {
  'Spoofing': '#7c3aed',
  'Tampering': '#dc2626',
  'Repudiation': '#d97706',
  'Information Disclosure': '#2563eb',
  'Denial of Service': '#059669',
  'Elevation of Privilege': '#db2777'
};

export const RISK_LEVELS: AttackPathRiskLevel[] = ['Critical', 'High', 'Medium', 'Low', 'Info'];

export const RISK_LEVEL_COLORS: Record<AttackPathRiskLevel, string> = {
  Critical: '#991b1b',
  High: '#dc2626',
  Medium: '#d97706',
  Low: '#2563eb',
  Info: '#6b7280'
};

const nowIso = (): string => new Date().toISOString();

const createId = (prefix: string): string =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;

export const createDiagramAttackPath = (
  name: string,
  strideCategory: StrideCategory
): DiagramAttackPath => ({
  id: createId('dap'),
  name,
  strideCategory,
  riskLevel: 'Medium',
  description: '',
  steps: [],
  createdAt: nowIso(),
  updatedAt: nowIso()
});

export const autoOrderSteps = (
  steps: DiagramAttackPathStep[]
): DiagramAttackPathStep[] => {
  if (steps.length === 0) return [];

  const adjacency = new Map<string, DiagramAttackPathStep[]>();
  const incomingNodes = new Set<string>();
  const sourceNodes = new Set<string>();

  steps.forEach(step => {
    const list = adjacency.get(step.sourceNodeId) || [];
    list.push(step);
    adjacency.set(step.sourceNodeId, list);
    incomingNodes.add(step.targetNodeId);
    sourceNodes.add(step.sourceNodeId);
  });

  const entryPoints = Array.from(sourceNodes).filter(id => !incomingNodes.has(id));
  if (entryPoints.length === 0 && steps.length > 0) {
    entryPoints.push(steps[0].sourceNodeId);
  }

  const ordered: DiagramAttackPathStep[] = [];
  const visited = new Set<string>();

  const walk = (nodeId: string) => {
    (adjacency.get(nodeId) || []).forEach(step => {
      if (visited.has(step.edgeId)) return;
      visited.add(step.edgeId);
      ordered.push(step);
      walk(step.targetNodeId);
    });
  };

  entryPoints.forEach(ep => walk(ep));

  steps.forEach(step => {
    if (!visited.has(step.edgeId)) {
      ordered.push(step);
    }
  });

  return ordered.map((step, index) => ({ ...step, order: index + 1 }));
};

export const convertDiagramPathToAssessment = (
  diagramPath: DiagramAttackPath,
  edgeMapping: Map<string, string>,
  nodeMapping: Map<string, string>
): AssessmentAttackPath | null => {
  const mappedSteps = diagramPath.steps
    .map(step => {
      const canvasEdgeId = edgeMapping.get(step.edgeId);
      const canvasSourceId = nodeMapping.get(step.sourceNodeId);
      const canvasTargetId = nodeMapping.get(step.targetNodeId);
      if (!canvasEdgeId || !canvasSourceId || !canvasTargetId) return null;
      return {
        order: step.order,
        edgeId: canvasEdgeId,
        sourceNodeId: canvasSourceId,
        targetNodeId: canvasTargetId,
        technique: step.technique
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  if (mappedSteps.length === 0 && diagramPath.steps.length > 0) return null;

  return {
    id: createId('aap'),
    name: diagramPath.name,
    strideCategory: diagramPath.strideCategory,
    riskLevel: diagramPath.riskLevel,
    description: diagramPath.description,
    steps: mappedSteps,
    diagramAttackPathId: diagramPath.id,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
};

export interface StrideDetail {
  category: StrideCategory;
  description: string;
  threat: string;
  dfdApplicability: string[];
  questionsToAsk: string[];
  examples: string[];
  mitigations: string[];
  owasp: string[];
}

export const STRIDE_DETAILS: Record<StrideCategory, StrideDetail> = {
  'Spoofing': {
    category: 'Spoofing',
    description: 'Impersonating something or someone else. An attacker claims to be a different user, service, or system to bypass authentication.',
    threat: 'Authentication threats — someone or something pretending to be something it is not.',
    dfdApplicability: ['Process', 'External Entity / Actor', 'Data Flow'],
    questionsToAsk: [
      'Can an attacker impersonate a legitimate user or service?',
      'Are authentication mechanisms strong enough to prevent identity forgery?',
      'Can session tokens, certificates, or credentials be stolen and replayed?',
      'Is mutual authentication used for service-to-service calls?',
      'Are data sources authenticated — could data be injected from a spoofed source?'
    ],
    examples: [
      'Forged JWT tokens or stolen session cookies used to impersonate users',
      'DNS spoofing redirecting traffic to a malicious server',
      'ARP poisoning on a local network to intercept or redirect traffic',
      'An attacker impersonates an API endpoint to receive sensitive data',
      'IP address spoofing to bypass IP-based access controls'
    ],
    mitigations: [
      'Implement multi-factor authentication (MFA)',
      'Use mutual TLS (mTLS) for service-to-service authentication',
      'Validate tokens with cryptographic signatures (JWT signature verification)',
      'Implement anti-spoofing controls at network boundaries',
      'Use DNSSEC and certificate pinning',
      'Never rely solely on IP addresses for authentication'
    ],
    owasp: ['A07: Identification and Authentication Failures']
  },
  'Tampering': {
    category: 'Tampering',
    description: 'Modifying data or code without authorization. This includes unauthorized changes to data in transit, at rest, or in use.',
    threat: 'Integrity threats — unauthorized modification of data, code, or system configurations.',
    dfdApplicability: ['Data Flow', 'Data Store', 'Process'],
    questionsToAsk: [
      'Can an attacker modify data in transit between components?',
      'Is data at rest protected against unauthorized modification?',
      'Are API parameters and inputs validated server-side?',
      'Can configuration files or code be modified by unauthorized parties?',
      'Are database records protected from direct unauthorized updates?',
      'Are software artifacts and dependencies verified for integrity?'
    ],
    examples: [
      'Man-in-the-middle attack modifying HTTP requests or responses',
      'SQL injection modifying database records',
      'Parameter tampering in API requests to change prices or permissions',
      'Modification of configuration files to disable security controls',
      'Supply chain compromise modifying library code before deployment',
      'Log tampering to hide evidence of an attack'
    ],
    mitigations: [
      'Use TLS/HTTPS for all data in transit',
      'Implement input validation and output encoding',
      'Use cryptographic hashing to verify data integrity',
      'Sign software artifacts and verify signatures during deployment',
      'Implement database access controls and audit logging',
      'Use file integrity monitoring for critical configuration files'
    ],
    owasp: ['A02: Cryptographic Failures', 'A03: Injection', 'A08: Software and Data Integrity Failures']
  },
  'Repudiation': {
    category: 'Repudiation',
    description: 'Denying having performed an action. Users or attackers claim they did not take an action that occurred, making it impossible to prove what happened.',
    threat: 'Non-repudiation threats — inability to prove that an action occurred or was performed by a specific entity.',
    dfdApplicability: ['Process', 'External Entity / Actor', 'Data Flow'],
    questionsToAsk: [
      'Are all security-relevant actions logged with sufficient detail?',
      'Are logs protected from tampering by attackers?',
      'Can you prove which user performed a sensitive action?',
      'Are timestamps reliable and synchronized across components?',
      'Is there an audit trail for financial, medical, or legal operations?',
      'Can a user deny submitting a transaction or modifying a record?'
    ],
    examples: [
      'An attacker deletes or modifies audit logs after an attack',
      'A user denies making a fraudulent transaction because logs are insufficient',
      'A service performs actions without recording who requested them',
      'Shared accounts make it impossible to attribute actions to individuals',
      'Logs without timestamps or user context are insufficient for forensics'
    ],
    mitigations: [
      'Implement comprehensive audit logging for all security-relevant events',
      'Protect logs from unauthorized modification (append-only, WORM storage)',
      'Include user identity, timestamp, source IP, and action details in logs',
      'Centralize logs to a tamper-resistant SIEM or log management system',
      'Implement digital signatures for high-value transactions',
      'Use separate accounts — avoid shared credentials'
    ],
    owasp: ['A09: Security Logging and Monitoring Failures']
  },
  'Information Disclosure': {
    category: 'Information Disclosure',
    description: 'Exposing information to individuals who are not supposed to access it. This includes data leakage through errors, logging, insecure storage, or transmission.',
    threat: 'Confidentiality threats — sensitive information being exposed to unauthorized parties.',
    dfdApplicability: ['Data Flow', 'Data Store', 'Process'],
    questionsToAsk: [
      'Is sensitive data encrypted in transit and at rest?',
      'Could error messages or stack traces reveal sensitive system information?',
      'Is sensitive data logged where it should not be?',
      'Are API responses filtered to only return data the requester is authorized to see?',
      'Could an attacker enumerate users, resources, or data through the API?',
      'Is sensitive data classified and handled according to its classification?'
    ],
    examples: [
      'Verbose error messages revealing database schema or internal paths',
      'Sensitive data (PII, credentials) stored in application logs',
      'Unencrypted database containing personally identifiable information',
      'API returning more data than needed (over-fetching or IDOR)',
      'Debug mode left enabled in production exposing internal state',
      'Insecure direct object references exposing other users\' data'
    ],
    mitigations: [
      'Encrypt all sensitive data in transit (TLS) and at rest (AES-256)',
      'Implement proper error handling — log details internally, return generic errors externally',
      'Remove sensitive data from logs or mask/redact it',
      'Implement proper authorization checks on all API responses',
      'Apply principle of least privilege to data access',
      'Classify data and apply appropriate controls per classification'
    ],
    owasp: ['A02: Cryptographic Failures', 'A01: Broken Access Control']
  },
  'Denial of Service': {
    category: 'Denial of Service',
    description: 'Making a service or resource unavailable to legitimate users. This includes overwhelming systems with traffic, exhausting resources, or crashing services.',
    threat: 'Availability threats — systems, services, or resources being made unavailable to authorized users.',
    dfdApplicability: ['Process', 'Data Store', 'Data Flow'],
    questionsToAsk: [
      'Is there protection against high-volume traffic or request flooding?',
      'Are there resource limits (rate limiting, connection limits, timeouts)?',
      'Are single points of failure identified and addressed?',
      'Could an attacker exhaust database connections, memory, or disk space?',
      'Is there redundancy and failover for critical components?',
      'Are there protections against slow-rate DoS attacks?'
    ],
    examples: [
      'Distributed Denial of Service (DDoS) attack overwhelming a web server',
      'Resource exhaustion by sending many large requests to an API',
      'Database lock contention caused by malformed queries',
      'Filling up disk space with log files or uploaded content',
      'Memory exhaustion through large file uploads or XML bombs',
      'Causing a service to crash via input that triggers an unhandled exception'
    ],
    mitigations: [
      'Implement rate limiting on APIs and authentication endpoints',
      'Use a CDN and DDoS protection service for internet-facing components',
      'Set timeouts, connection limits, and request size limits',
      'Design for redundancy and horizontal scaling',
      'Implement circuit breakers for inter-service communication',
      'Monitor resource usage and set alerts for anomalies'
    ],
    owasp: ['A05: Security Misconfiguration']
  },
  'Elevation of Privilege': {
    category: 'Elevation of Privilege',
    description: 'Gaining capabilities without proper authorization. An attacker gains elevated access or permissions that they should not have.',
    threat: 'Authorization threats — gaining capabilities or permissions that exceed what is authorized.',
    dfdApplicability: ['Process', 'External Entity / Actor', 'Data Flow'],
    questionsToAsk: [
      'Are there checks to prevent users from accessing resources they are not authorized to?',
      'Could a low-privileged user exploit a bug to gain admin-level access?',
      'Are there insecure direct object references allowing access to other users\' data?',
      'Are privilege escalation paths through chained vulnerabilities possible?',
      'Are admin interfaces protected from low-trust zones?',
      'Is the principle of least privilege applied to all service accounts?'
    ],
    examples: [
      'Exploiting a SQL injection to read data from tables the user cannot access',
      'A regular user modifying a role parameter to gain admin privileges',
      'Exploiting a misconfigured server to run commands as a higher-privileged user',
      'JWT algorithm confusion attack (alg:none) to forge admin tokens',
      'SSRF attack reaching internal services that are not internet-facing',
      'Privilege escalation through an OS vulnerability in a web server'
    ],
    mitigations: [
      'Implement proper authorization checks on every sensitive operation',
      'Apply principle of least privilege — services run with minimum permissions',
      'Validate that users can only access their own resources (IDOR protection)',
      'Run services in isolated containers with minimal privileges',
      'Regularly audit user and service account permissions',
      'Implement RBAC or ABAC and enforce it server-side'
    ],
    owasp: ['A01: Broken Access Control', 'A07: Identification and Authentication Failures']
  }
};

export type PastaStageId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface PastaStage {
  id: PastaStageId;
  name: string;
  shortName: string;
  description: string;
  questionsToAsk: string[];
  outputs: string[];
  guidance: string;
}

export const PASTA_STAGES: PastaStage[] = [
  {
    id: 1,
    name: 'Define Business Objectives',
    shortName: 'Business Objectives',
    description: 'Identify business objectives, security requirements, and risk tolerance for the system being modeled.',
    questionsToAsk: [
      'What are the core business functions this system supports?',
      'What regulatory or compliance requirements apply (GDPR, PCI-DSS, HIPAA)?',
      'What is the acceptable level of risk for this system?',
      'What would be the business impact of a security breach?',
      'What are the key assets and crown jewels that need protection?'
    ],
    outputs: [
      'Business impact analysis',
      'Security requirements and constraints',
      'Risk tolerance and appetite definition',
      'Asset inventory with business criticality'
    ],
    guidance: 'Start by understanding why the system exists and what the business cannot afford to lose or have compromised. This stage anchors all subsequent threat modeling in business context.'
  },
  {
    id: 2,
    name: 'Define Technical Scope',
    shortName: 'Technical Scope',
    description: 'Document the technical boundaries, infrastructure, dependencies, and components in scope for this threat model.',
    questionsToAsk: [
      'What are the system boundaries and interfaces with external systems?',
      'What infrastructure does the system run on (cloud, on-premise, hybrid)?',
      'What third-party libraries, services, and APIs are used?',
      'What data flows cross trust boundaries?',
      'What network segments and security zones are involved?'
    ],
    outputs: [
      'System context diagram',
      'Infrastructure and dependency inventory',
      'Trust boundary definitions',
      'Technology stack documentation'
    ],
    guidance: 'Define what is in scope and what is out of scope. Document all external dependencies as they represent attack surface that may be outside your control.'
  },
  {
    id: 3,
    name: 'Application Decomposition',
    shortName: 'Decomposition',
    description: 'Break down the application into components, identify data flows, data stores, and trust boundaries using Data Flow Diagrams (DFDs).',
    questionsToAsk: [
      'What are the major components and processes in the system?',
      'How does data flow between components and across trust boundaries?',
      'What data is stored, where, and in what format?',
      'What are the entry points and exit points for data?',
      'Which components handle sensitive or regulated data?'
    ],
    outputs: [
      'Level 0 and Level 1 Data Flow Diagrams (DFDs)',
      'Data classification inventory',
      'Component interaction map',
      'Trust boundary documentation'
    ],
    guidance: 'Create DFDs showing actors, processes, data stores, and data flows. Label each flow with data classification. Identify all trust boundary crossings — these are your highest risk areas.'
  },
  {
    id: 4,
    name: 'Threat Analysis',
    shortName: 'Threat Analysis',
    description: 'Analyze the threat landscape using threat intelligence and methodologies like STRIDE to identify threats relevant to the system.',
    questionsToAsk: [
      'What threat actors are relevant to this system (nation-state, cybercriminal, insider)?',
      'What STRIDE threats apply to each DFD element?',
      'What threat intelligence is available about attacks on similar systems?',
      'What MITRE ATT&CK techniques are relevant to this system type?',
      'What are the most likely attack vectors for an attacker?'
    ],
    outputs: [
      'Threat actor profiles',
      'STRIDE analysis matrix',
      'Threat enumeration list',
      'MITRE ATT&CK technique mapping'
    ],
    guidance: 'Apply STRIDE systematically to each DFD element. Consider the threat actor\'s motivation, capability, and opportunity. Use threat intelligence to ground your analysis in real-world attack patterns.'
  },
  {
    id: 5,
    name: 'Vulnerability Analysis',
    shortName: 'Vulnerability Analysis',
    description: 'Identify vulnerabilities in the system components that could be exploited by the threats identified in Stage 4.',
    questionsToAsk: [
      'What known CVEs affect components in the system?',
      'Are there design weaknesses that could be exploited?',
      'What misconfigurations or insecure defaults exist?',
      'Are there gaps in security controls for identified threats?',
      'Have penetration tests or code reviews identified weaknesses?'
    ],
    outputs: [
      'Vulnerability inventory with CVE references',
      'Design weakness analysis',
      'Gap analysis against security controls',
      'Prioritized list of vulnerabilities by exploitability'
    ],
    guidance: 'Map vulnerabilities to threats from Stage 4. Focus on vulnerabilities that are both exploitable by identified threat actors and relevant to your critical assets. Use CVSS scoring to prioritize.'
  },
  {
    id: 6,
    name: 'Attack Modeling',
    shortName: 'Attack Modeling',
    description: 'Model specific attack scenarios by combining threat actors, vulnerabilities, and attack paths to understand how an attacker could achieve their objectives.',
    questionsToAsk: [
      'What is the complete attack chain from initial access to impact?',
      'Which attack paths are most likely to succeed?',
      'What is the minimum number of steps to reach a critical asset?',
      'Are there attack paths that bypass multiple security controls?',
      'What is the blast radius of a successful attack?'
    ],
    outputs: [
      'Attack path diagrams',
      'Attack trees',
      'Exploit scenario narratives',
      'Attack chain analysis with STRIDE categorization'
    ],
    guidance: 'Build end-to-end attack scenarios using the attack path features. Model how an attacker chains together vulnerabilities to achieve their objective. Include the entry point, lateral movement, and final impact.'
  },
  {
    id: 7,
    name: 'Risk and Impact Analysis',
    shortName: 'Risk Analysis',
    description: 'Assess the business risk and impact of each attack scenario, prioritize risks, and define treatment strategies.',
    questionsToAsk: [
      'What is the likelihood of each attack scenario succeeding?',
      'What would the business impact be if an attack succeeded?',
      'How do risks compare to the defined risk appetite?',
      'Which risks require immediate treatment vs. acceptance?',
      'What is the residual risk after implementing planned controls?'
    ],
    outputs: [
      'Risk register with likelihood and impact scores',
      'Risk heat map',
      'Risk treatment plan',
      'Residual risk statement'
    ],
    guidance: 'Map attack scenarios to business impacts using your risk model. Compare against your risk appetite. The goal is to prioritize treatment actions — not eliminate all risk, but manage risk to acceptable levels.'
  }
];
