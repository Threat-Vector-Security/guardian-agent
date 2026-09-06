/**
 * Vulnerable Application Architecture
 *
 * This system demonstrates common vulnerabilities in secure application
 * development focusing on memory management, session handling, and internal
 * application component security. Vulnerabilities are embedded naturally.
 */

import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityNode, SecurityEdge, SecurityZone } from '../../types/SecurityTypes';
import { DiagramAttackPath, AssessmentThreatModelNodeSourceType, AssessmentThreatModelEdgeSourceType, AttackPathRiskLevel } from '../../types/GrcTypes';
import { colors } from '../../styles/Theme';
import { buildGrcWorkspace, score, NOW, OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID } from './grcSharedBase';
import { StrideCategory } from '../../types/ThreatIntelTypes';
const tierCatalogue = [
  { id: 'tier1-cyber', tier: 1 as const, label: 'Cyber Risk', description: 'Information security and cyber threats' },
  { id: 'tier1-operational', tier: 1 as const, label: 'Operational Risk', description: 'Business operations and process risks' },
  { id: 'tier2-memory', tier: 2 as const, label: 'Memory Safety', parentId: 'tier1-cyber', description: 'Memory corruption, buffer overflow, and use-after-free vulnerabilities' },
  { id: 'tier2-auth', tier: 2 as const, label: 'Authentication & Session', parentId: 'tier1-cyber', description: 'Token validation, session management, and credential handling' },
  { id: 'tier2-data', tier: 2 as const, label: 'Data Protection', parentId: 'tier1-cyber', description: 'Data-at-rest and data-in-transit encryption' },
  { id: 'tier2-config', tier: 2 as const, label: 'Secure Configuration', parentId: 'tier1-cyber', description: 'Application configuration, secret management, and hardening' },
  { id: 'tier2-monitoring', tier: 2 as const, label: 'Security Monitoring', parentId: 'tier1-operational', description: 'Logging, detection, and audit trail integrity' },
  { id: 'tier2-access', tier: 2 as const, label: 'Access Control', parentId: 'tier1-cyber', description: 'Permission enforcement and authorization logic' },
  { id: 'tier3-buffer-overflow', tier: 3 as const, label: 'Buffer Overflow', parentId: 'tier2-memory' },
  { id: 'tier3-shared-memory', tier: 3 as const, label: 'Shared Memory Exposure', parentId: 'tier2-memory' },
  { id: 'tier3-jwt-confusion', tier: 3 as const, label: 'JWT Algorithm Confusion', parentId: 'tier2-auth' },
  { id: 'tier3-session-hijack', tier: 3 as const, label: 'Session Hijacking', parentId: 'tier2-auth' },
  { id: 'tier3-unencrypted-cache', tier: 3 as const, label: 'Unencrypted Cache Data', parentId: 'tier2-data' },
  { id: 'tier3-cleartext-config', tier: 3 as const, label: 'Cleartext Configuration Secrets', parentId: 'tier2-config' },
  { id: 'tier3-audit-tampering', tier: 3 as const, label: 'Audit Log Tampering', parentId: 'tier2-monitoring' },
  { id: 'tier3-permission-cache-poison', tier: 3 as const, label: 'Permission Cache Poisoning', parentId: 'tier2-access' },
  { id: 'tier4-bounds-checking', tier: 4 as const, label: 'Bounds Checking Enforcement', parentId: 'tier3-buffer-overflow' },
  { id: 'tier4-memory-isolation', tier: 4 as const, label: 'Cross-Zone Memory Isolation', parentId: 'tier3-shared-memory' },
  { id: 'tier4-algorithm-pinning', tier: 4 as const, label: 'JWT Algorithm Pinning', parentId: 'tier3-jwt-confusion' },
  { id: 'tier4-cache-encryption', tier: 4 as const, label: 'Cache-Layer Encryption', parentId: 'tier3-unencrypted-cache' },
];

const assets = [
  {
    id: 'asset-ui-memory', name: 'UI Memory Pool', type: 'application_component', owner: 'Frontend Engineering',
    domain: 'application' as const, category: 'Memory Management',
    businessCriticality: 4, securityCriticality: 4,
    description: 'React 17.0.2 frontend memory allocation with shared memory pools susceptible to cross-component data leakage',
    criticality: { confidentiality: 3, integrity: 3, availability: 4, financial: 3, reputation: 3, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-app-architecture', nodeId: 'ui-memory-pool', nodeLabel: 'UI Memory Pool', nodeType: 'storage' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-session-store', name: 'Redis Session Store', type: 'cache', owner: 'Platform Engineering',
    domain: 'application' as const, category: 'Session Management',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Redis 6.0.9 cluster storing session data with unencrypted cross-tab synchronization',
    criticality: { confidentiality: 5, integrity: 4, availability: 5, financial: 4, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-app-architecture', nodeId: 'session-store', nodeLabel: 'Session Store', nodeType: 'cache' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-token-validator', name: 'JWT Token Validator', type: 'application_component', owner: 'Security Engineering',
    domain: 'application' as const, category: 'Authentication',
    businessCriticality: 5, securityCriticality: 5,
    description: 'jsonwebtoken 8.5.0 with algorithm flexibility creating JWT confusion vulnerabilities',
    criticality: { confidentiality: 5, integrity: 5, availability: 4, financial: 5, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-app-architecture', nodeId: 'token-validator', nodeLabel: 'Token Validator', nodeType: 'service' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-business-logic', name: 'Business Logic Memory Pool', type: 'application_component', owner: 'Backend Engineering',
    domain: 'application' as const, category: 'Core Processing',
    businessCriticality: 5, securityCriticality: 5,
    description: 'C++ native modules with direct memory access for high-performance calculation, creating memory safety risks',
    criticality: { confidentiality: 4, integrity: 5, availability: 5, financial: 5, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-app-architecture', nodeId: 'business-logic-pool', nodeLabel: 'Business Logic Memory', nodeType: 'storage' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-cache-memory', name: 'Memcached Application Cache', type: 'cache', owner: 'Platform Engineering',
    domain: 'application' as const, category: 'Caching Layer',
    businessCriticality: 4, securityCriticality: 4,
    description: 'Memcached 1.6.6 cluster caching sensitive business data without encryption',
    criticality: { confidentiality: 4, integrity: 3, availability: 4, financial: 3, reputation: 3, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-app-architecture', nodeId: 'cache-memory', nodeLabel: 'Application Cache', nodeType: 'cache' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-data-buffer', name: 'PostgreSQL Data Buffer Pool', type: 'database', owner: 'Database Administration',
    domain: 'application' as const, category: 'Database',
    businessCriticality: 5, securityCriticality: 5,
    description: 'PostgreSQL 12.8 connection pool with 200 concurrent connections handling customer and payment data',
    criticality: { confidentiality: 5, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-app-architecture', nodeId: 'data-buffer', nodeLabel: 'Data Buffer Pool', nodeType: 'database' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-secret-vault', name: 'HashiCorp Vault', type: 'security_tool', owner: 'Security Engineering',
    domain: 'it' as const, category: 'Secret Management',
    businessCriticality: 5, securityCriticality: 5,
    description: 'HashiCorp Vault 1.8.1 storing API keys and database credentials with key rotation support',
    criticality: { confidentiality: 5, integrity: 5, availability: 4, financial: 4, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-app-architecture', nodeId: 'secret-vault', nodeLabel: 'Secret Vault', nodeType: 'storage' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'asset-audit-logger', name: 'Winston Audit Logger', type: 'security_tool', owner: 'Security Operations',
    domain: 'it' as const, category: 'Logging',
    businessCriticality: 4, securityCriticality: 4,
    description: 'Winston 3.3.3 structured JSON logging with cleartext security event transmission',
    criticality: { confidentiality: 3, integrity: 4, availability: 3, financial: 2, reputation: 3, safety: 1 },
    diagramRefs: [{ diagramId: 'vulnerable-app-architecture', nodeId: 'audit-logger', nodeLabel: 'Audit Logger', nodeType: 'monitor' }],
    createdAt: NOW, updatedAt: NOW
  },
];

const risks = [
  {
    id: 'risk-shared-memory-xzone', title: 'Cross-Zone Shared Memory Exposure',
    description: 'UI memory pool shares direct memory with the business logic layer across security zone boundaries. An attacker who exploits a frontend XSS or prototype pollution vulnerability can read sensitive business data from the shared memory region.',
    status: 'assessed' as const, owner: 'Backend Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Memory Safety', tier3: 'Shared Memory Exposure' },
    assetIds: ['asset-ui-memory', 'asset-business-logic'],
    diagramLinks: [{ diagramId: 'vulnerable-app-architecture', nodeIds: ['ui-memory-pool', 'business-logic-pool'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Implement process-level memory isolation between presentation and business logic layers; eliminate direct memory sharing across zones',
    threatActorIds: ['ta-external-attacker'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-jwt-algorithm-confusion', title: 'JWT Algorithm Confusion Attack',
    description: 'Token validator uses jsonwebtoken 8.5.0 with algorithm flexibility. An attacker can craft a token using the "none" algorithm or switch from RS256 to HS256 using the public key as the HMAC secret, bypassing signature verification entirely.',
    status: 'assessed' as const, owner: 'Security Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Authentication & Session', tier3: 'JWT Algorithm Confusion' },
    assetIds: ['asset-token-validator', 'asset-session-store'],
    diagramLinks: [{ diagramId: 'vulnerable-app-architecture', nodeIds: ['token-validator', 'session-store'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Upgrade jsonwebtoken and pin algorithm to RS256; reject "none" and symmetric algorithms; validate issuer and audience claims',
    threatActorIds: ['ta-external-attacker'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-unencrypted-session-data', title: 'Unencrypted Session Data in Memory',
    description: 'Session store transmits session tokens to the crypto module and token validator over unprotected memory channels. Session data including authentication tokens is accessible in cleartext within the Redis process memory.',
    status: 'draft' as const, owner: 'Platform Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Authentication & Session', tier3: 'Session Hijacking' },
    assetIds: ['asset-session-store', 'asset-token-validator'],
    diagramLinks: [{ diagramId: 'vulnerable-app-architecture', nodeIds: ['session-store', 'token-validator', 'crypto-module'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Enable Redis TLS; encrypt session payloads at the application layer before storage; rotate session keys periodically',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-cache-data-unencrypted', title: 'Sensitive Data Cached Without Encryption',
    description: 'Memcached cluster stores business-critical data including customer records and pricing calculations in cleartext. No authentication is required to access cached data.',
    status: 'assessed' as const, owner: 'Platform Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Data Protection', tier3: 'Unencrypted Cache Data' },
    assetIds: ['asset-cache-memory', 'asset-business-logic'],
    diagramLinks: [{ diagramId: 'vulnerable-app-architecture', nodeIds: ['cache-memory', 'business-logic-pool'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Enable SASL authentication on Memcached; encrypt sensitive cache values at the application layer; enforce network segmentation',
    threatActorIds: ['ta-insider'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-config-env-exposure', title: 'Configuration Secrets in Environment Variables',
    description: 'Configuration manager loads secrets from environment variables via dotenv and caches them in the execution context memory. Process dumps or /proc filesystem access can expose database credentials and API keys.',
    status: 'draft' as const, owner: 'Security Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Secure Configuration', tier3: 'Cleartext Configuration Secrets' },
    assetIds: ['asset-secret-vault'],
    diagramLinks: [{ diagramId: 'vulnerable-app-architecture', nodeIds: ['config-manager', 'execution-context', 'secret-vault'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Migrate all secrets to Vault dynamic credentials; eliminate static environment variables; use short-lived leases with automatic rotation',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-audit-log-tampering', title: 'Cleartext Audit Log Transmission',
    description: 'Security events from the runtime guard and output buffer are transmitted to the audit logger via unencrypted function calls and syslog. An attacker with network access can intercept or tamper with audit trail evidence.',
    status: 'assessed' as const, owner: 'Security Operations',
    tierPath: { tier1: 'Operational Risk', tier2: 'Security Monitoring', tier3: 'Audit Log Tampering' },
    assetIds: ['asset-audit-logger'],
    diagramLinks: [{ diagramId: 'vulnerable-app-architecture', nodeIds: ['audit-logger', 'output-buffer', 'runtime-guard'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Encrypt audit log transport with TLS; implement log signing for integrity verification; forward to immutable log storage',
    threatActorIds: ['ta-insider'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-permission-cache-stale', title: 'Stale Permission Cache Allows Privilege Escalation',
    description: 'Permission engine caches authorization matrices at startup. Revoked permissions remain effective until cache refresh, allowing terminated users or downgraded roles to retain elevated access.',
    status: 'draft' as const, owner: 'Backend Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Access Control', tier3: 'Permission Cache Poisoning' },
    assetIds: ['asset-cache-memory'],
    diagramLinks: [{ diagramId: 'vulnerable-app-architecture', nodeIds: ['permission-engine', 'cache-memory'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Implement event-driven cache invalidation on permission changes; reduce cache TTL to 60 seconds; add real-time revocation checks for sensitive operations',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'risk-buffer-overflow-native', title: 'Buffer Overflow in Native C++ Modules',
    description: 'Business logic memory pool uses C++ native modules with direct memory access. Insufficient bounds checking on user-supplied input to calculation functions creates buffer overflow conditions that could lead to remote code execution.',
    status: 'assessed' as const, owner: 'Backend Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Memory Safety', tier3: 'Buffer Overflow' },
    assetIds: ['asset-business-logic'],
    diagramLinks: [{ diagramId: 'vulnerable-app-architecture', nodeIds: ['business-logic-pool', 'input-buffer'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Add strict bounds checking to all native module interfaces; enable AddressSanitizer in CI; migrate critical paths to memory-safe Rust',
    threatActorIds: ['ta-external-attacker'],
    createdAt: NOW, updatedAt: NOW
  },
];

const assessments = [
  {
    id: 'assessment-app-arch-review', title: 'Application Architecture Security Assessment',
    status: 'in_review' as const,
    owner: 'Security Architecture',
    reviewer: 'CISO',
    startDate: '2025-05-15',
    dueDate: '2025-07-01',
    threatActorIds: ['ta-external-attacker', 'ta-insider', 'ta-automated-scanner'],
    methodologyNote: 'Assessment follows OWASP Application Security Verification Standard (ASVS) Level 2 with memory safety focus areas derived from CWE Top 25.',
    assumptionNote: 'Assessment covers production application tier. CI/CD pipeline and development environments are out of scope.',
    scopeItems: [
      { id: 'scope-system-ecommerce', type: 'system' as const, value: 'system', name: 'E-Commerce Internal Architecture' },
      { id: 'scope-zone-app', type: 'diagram_segment' as const, value: 'Application Zone', name: 'Application Zone' },
      { id: 'scope-zone-data', type: 'diagram_segment' as const, value: 'Data Zone', name: 'Data Zone' },
    ],
    tierFilter: { tier1: 'Cyber Risk' },
    riskManagementPlan: {
      objective: 'Eliminate cross-zone memory sharing and harden authentication and caching layers.',
      strategy: 'Prioritize memory isolation and JWT hardening as critical-path items, then address data-at-rest encryption in cache and session tiers.',
      residualRiskStatement: 'Residual risk accepted only for low-likelihood scenarios with compensating monitoring controls.',
      monitoringApproach: 'Bi-weekly review of open actions and continuous RASP alerting.',
      communicationPlan: 'Report to Security Architecture Board every sprint.',
      reviewCadenceDays: 14,
      actions: [
        {
          id: 'rmp-action-memory-isolation',
          title: 'Implement process-level memory isolation between presentation and business logic',
          owner: 'Backend Engineering',
          dueDate: '2025-06-15',
          status: 'in_progress' as const,
          linkedRiskIds: ['risk-shared-memory-xzone'],
          notes: 'Worker thread migration in progress; shared ArrayBuffer access being removed'
        },
        {
          id: 'rmp-action-jwt-pin',
          title: 'Pin JWT algorithm and upgrade jsonwebtoken to 9.x',
          owner: 'Security Engineering',
          dueDate: '2025-06-01',
          status: 'done' as const,
          linkedRiskIds: ['risk-jwt-algorithm-confusion'],
          notes: 'Algorithm pinned to RS256; none algorithm rejected; upgrade deployed to staging'
        },
        {
          id: 'rmp-action-cache-encrypt',
          title: 'Enable application-layer encryption for Memcached values',
          owner: 'Platform Engineering',
          dueDate: '2025-06-30',
          status: 'planned' as const,
          linkedRiskIds: ['risk-cache-data-unencrypted'],
          notes: ''
        },
        {
          id: 'rmp-action-vault-dynamic',
          title: 'Migrate environment variable secrets to Vault dynamic credentials',
          owner: 'Security Engineering',
          dueDate: '2025-07-15',
          status: 'planned' as const,
          linkedRiskIds: ['risk-config-env-exposure'],
          notes: 'Vault agent sidecar pattern selected; integration testing pending'
        },
      ],
      updatedAt: NOW
    },
    riskIds: risks.map(r => r.id),
    soaGapIds: ['soa-a02', 'soa-a04', 'soa-a05'],
    taskIds: ['task-jwt-upgrade', 'task-memory-audit', 'task-evidence-a09'],
    linkedImplementedControlIds: [],
    linkedInitiativeIds: [],
    summary: 'Security assessment of the e-commerce application internal architecture focusing on memory safety, authentication, and data protection. Identified 8 risks with 3 rated Critical and 3 rated High.',
    findings: 'Critical findings include cross-zone shared memory between presentation and business logic layers, JWT algorithm confusion in token validation, and unencrypted sensitive data in Memcached.',
    recommendations: 'Prioritize memory isolation between zones, upgrade JWT library and pin algorithms, and encrypt all cached data at the application layer.',
    evidenceSummary: 'Evidence includes memory analysis reports, JWT configuration audits, and Memcached traffic captures.',
    threatModel: {
      nodes: [
        { id: 'tm-node-input', label: 'Input Buffer', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'input-buffer', position: { x: 50, y: 150 }, nodeType: 'service' },
        { id: 'tm-node-ui-mem', label: 'UI Memory Pool', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'ui-memory-pool', position: { x: 200, y: 50 }, nodeType: 'storage', commentary: 'Shared memory with business logic crosses zone boundary' },
        { id: 'tm-node-session', label: 'Session Store', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'session-store', position: { x: 200, y: 250 }, nodeType: 'cache' },
        { id: 'tm-node-token', label: 'Token Validator', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'token-validator', position: { x: 400, y: 250 }, nodeType: 'service', commentary: 'jsonwebtoken 8.5.0 allows algorithm confusion' },
        { id: 'tm-node-bl', label: 'Business Logic Memory', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'business-logic-pool', position: { x: 400, y: 50 }, nodeType: 'storage' },
        { id: 'tm-node-cache', label: 'Application Cache', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'cache-memory', position: { x: 600, y: 150 }, nodeType: 'cache', commentary: 'Stores sensitive data in cleartext without authentication' },
        { id: 'tm-node-db', label: 'Data Buffer Pool', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'data-buffer', position: { x: 800, y: 150 }, nodeType: 'database' },
      ],
      edges: [
        { id: 'tm-edge-ui-bl', source: 'tm-node-ui-mem', target: 'tm-node-bl', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'ui-memory-to-business-logic', label: 'Shared Memory (no encryption)', commentary: 'Cross-zone direct memory access without isolation' },
        { id: 'tm-edge-session-token', source: 'tm-node-session', target: 'tm-node-token', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'session-to-token', label: 'Token Validation (cleartext)', commentary: 'Session data transmitted without memory protection' },
        { id: 'tm-edge-bl-cache', source: 'tm-node-bl', target: 'tm-node-cache', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'business-logic-to-cache', label: 'Data Caching (unencrypted)', commentary: 'Sensitive business data cached without encryption' },
        { id: 'tm-edge-cache-db', source: 'tm-node-cache', target: 'tm-node-db', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'cache-to-data-buffer', label: 'Database Query' },
      ],
      attackPathDescription: 'Two primary attack paths identified: (1) Cross-zone memory exploitation via shared memory between UI and business logic layers; (2) Session hijacking via JWT algorithm confusion leading to unauthorized cache and database access.',
      attackPaths: [
        {
          id: 'aap-shared-memory-exfil',
          name: 'Cross-Zone Shared Memory → Business Data Exfiltration',
          strideCategory: 'Information Disclosure' as StrideCategory,
          riskLevel: 'High' as AttackPathRiskLevel,
          description: 'Attacker exploits frontend vulnerability to read sensitive business data from the shared memory region that crosses the DMZ-Internal zone boundary.',
          diagramAttackPathId: 'ap-shared-memory-exfil',
          steps: [
            { order: 1, edgeId: 'input-to-ui-memory', sourceNodeId: 'input-buffer', targetNodeId: 'ui-memory-pool', technique: 'T1059: Command and Scripting Interpreter' },
            { order: 2, edgeId: 'ui-memory-to-business-logic', sourceNodeId: 'ui-memory-pool', targetNodeId: 'business-logic-pool', technique: 'T1005: Data from Local System' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
        {
          id: 'aap-jwt-session-hijack',
          name: 'JWT Algorithm Confusion → Session Hijack → Cache Exfiltration',
          strideCategory: 'Elevation of Privilege' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'Attacker crafts a JWT token exploiting algorithm confusion to bypass signature verification, hijacks a valid session, then accesses unencrypted cached data.',
          diagramAttackPathId: 'ap-jwt-session-hijack',
          steps: [
            { order: 1, edgeId: 'session-to-token', sourceNodeId: 'session-store', targetNodeId: 'token-validator', technique: 'T1550: Use Alternate Authentication Material' },
            { order: 2, edgeId: 'token-to-permission', sourceNodeId: 'token-validator', targetNodeId: 'permission-engine', technique: 'T1078: Valid Accounts' },
            { order: 3, edgeId: 'permission-to-cache', sourceNodeId: 'permission-engine', targetNodeId: 'cache-memory', technique: 'T1005: Data from Local System' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
      ],
      updatedAt: NOW,
    },
    createdAt: NOW, updatedAt: NOW
  },
];

const soaEntries = [
  {
    id: 'soa-a01', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A01', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Permission engine uses cached RBAC matrices but lacks real-time revocation. Stale permissions allow elevated access after role changes.',
    mitigatesRiskIds: ['risk-permission-cache-stale'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-a02', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A02', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Session data and cached business records transmitted and stored without encryption. Memcached has no SASL authentication. Redis sessions lack TLS.',
    mitigatesRiskIds: ['risk-unencrypted-session-data', 'risk-cache-data-unencrypted'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-a03', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A03', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'implemented' as const,
    justification: 'Input buffer performs validation and sanitization. However, native C++ modules accept unvalidated input through the business logic pool interface.',
    mitigatesRiskIds: ['risk-buffer-overflow-native'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-a04', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A04', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Architecture allows direct shared memory between presentation and business logic zones. No memory isolation boundary enforced at design level.',
    mitigatesRiskIds: ['risk-shared-memory-xzone'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-a05', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A05', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Configuration manager loads secrets via dotenv environment variables. Secrets cached in execution context memory are exposed to process dumps.',
    mitigatesRiskIds: ['risk-config-env-exposure'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-a06', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A06', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'jsonwebtoken 8.5.0 and OpenSSL 1.1.1k have known vulnerabilities. Node.js 14.17.0 is past end-of-life. Upgrade plan in progress.',
    mitigatesRiskIds: ['risk-jwt-algorithm-confusion'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-a07', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A07', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'JWT algorithm flexibility allows "none" algorithm and HS256/RS256 confusion. Algorithm pinning implemented in staging; production deployment pending.',
    mitigatesRiskIds: ['risk-jwt-algorithm-confusion', 'risk-unencrypted-session-data'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-a09', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A09', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'implemented' as const,
    justification: 'Winston audit logger captures security events. However, log transport uses cleartext syslog, and runtime guard events lack integrity protection.',
    mitigatesRiskIds: ['risk-audit-log-tampering'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-cis-03', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.03', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Multiple data-at-rest and data-in-transit gaps: unencrypted cache, cleartext session data, and environment variable secrets.',
    mitigatesRiskIds: ['risk-cache-data-unencrypted', 'risk-unencrypted-session-data', 'risk-config-env-exposure'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'soa-cis-04', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.04', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Secure configuration hardening in progress. Memcached SASL and Redis TLS planned. Configuration manager migration to Vault dynamic credentials underway.',
    mitigatesRiskIds: ['risk-config-env-exposure', 'risk-cache-data-unencrypted'],
    diagramRefs: [],
    evidence: [
      { id: 'evidence-cis04-vault', kind: 'link' as const, name: 'Vault Migration Plan',
        url: 'https://security.example.local/docs/vault-migration', note: 'Dynamic credential rollout schedule', createdAt: NOW }
    ],
    updatedAt: NOW
  },
];

const workflowTasks = [
  {
    id: 'task-jwt-upgrade',
    title: 'Upgrade jsonwebtoken to 9.x and pin algorithm to RS256',
    description: 'Critical vulnerability remediation for JWT algorithm confusion attack surface.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'critical' as const,
    owner: 'Security Engineering',
    dueDate: '2025-06-01',
    riskId: 'risk-jwt-algorithm-confusion',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'task-memory-audit',
    title: 'Audit shared memory regions and implement process isolation',
    description: 'Memory safety review of all cross-zone shared memory allocations.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'critical' as const,
    owner: 'Backend Engineering',
    dueDate: '2025-06-15',
    riskId: 'risk-shared-memory-xzone',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'task-evidence-a09',
    title: 'Attach audit log pipeline evidence for A09',
    description: 'Collect evidence for Winston audit logger configuration and syslog transport encryption status.',
    type: 'evidence' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Security Operations',
    dueDate: '2025-06-10',
    controlSetId: OWASP_CONTROL_SET_ID,
    controlId: 'A09',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'task-cache-encrypt',
    title: 'Enable SASL and application-layer encryption for Memcached',
    description: 'Encrypt sensitive cached data and enforce authentication on Memcached cluster.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Platform Engineering',
    dueDate: '2025-06-30',
    riskId: 'risk-cache-data-unencrypted',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'task-vault-migration',
    title: 'Migrate environment secrets to Vault dynamic credentials',
    description: 'Replace static dotenv secrets with short-lived Vault leases and agent sidecar injection.',
    type: 'control_implementation' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Security Engineering',
    dueDate: '2025-07-15',
    riskId: 'risk-config-env-exposure',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'task-native-bounds-check',
    title: 'Add bounds checking and fuzzing to C++ native modules',
    description: 'Implement strict input validation at the native module boundary and integrate AddressSanitizer into CI.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'critical' as const,
    owner: 'Backend Engineering',
    dueDate: '2025-06-20',
    riskId: 'risk-buffer-overflow-native',
    createdAt: NOW, updatedAt: NOW
  },
];

const threatActors = [
  {
    id: 'ta-external-attacker', name: 'Sophisticated External Attacker',
    type: 'organised_crime' as const, capabilityLevel: 4,
    resourceLevel: 'high' as const,
    motivation: 'Financial gain through exploitation of application-layer vulnerabilities to access customer payment and PII data.',
    description: 'Well-resourced attacker with expertise in memory exploitation, JWT attacks, and web application penetration testing. Targets application internals rather than network perimeter.',
    targetedAssetIds: ['asset-token-validator', 'asset-business-logic', 'asset-data-buffer', 'asset-session-store'],
    tags: ['financially-motivated', 'application-focused', 'persistent'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'ta-insider', name: 'Malicious Insider with Cache Access',
    type: 'insider' as const, capabilityLevel: 3,
    resourceLevel: 'moderate' as const,
    motivation: 'Data exfiltration for personal gain or corporate espionage by exploiting access to internal caching and monitoring infrastructure.',
    description: 'Current employee with network access to application zone. Has knowledge of Memcached endpoints and Redis configuration but no direct database credentials.',
    targetedAssetIds: ['asset-cache-memory', 'asset-session-store', 'asset-audit-logger'],
    tags: ['insider-threat', 'data-exfiltration', 'cache-exploitation'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'ta-automated-scanner', name: 'Automated Vulnerability Scanner',
    type: 'opportunistic' as const, capabilityLevel: 1,
    resourceLevel: 'very_low' as const,
    motivation: 'Automated discovery and exploitation of known vulnerabilities in outdated components (Node.js 14, jsonwebtoken 8.5.0, OpenSSL 1.1.1k).',
    description: 'Automated internet scanners identifying outdated software versions and known CVEs. Targets exposed services with public exploit code.',
    targetedAssetIds: ['asset-token-validator', 'asset-business-logic'],
    tags: ['automated', 'cve-exploitation', 'mass-scanning'],
    createdAt: NOW, updatedAt: NOW
  },
];

const threatScenarios = [
  {
    id: 'scenario-jwt-takeover', title: 'JWT Algorithm Confusion Leading to Account Takeover',
    description: 'External attacker crafts a JWT with "none" algorithm or uses the RS256 public key as an HS256 secret to forge valid tokens, bypassing authentication and assuming any user identity.',
    threatActorId: 'ta-external-attacker',
    targetedAssetIds: ['asset-token-validator', 'asset-session-store'],
    attackTechniques: ['T1550 - Use Alternate Authentication Material', 'T1078 - Valid Accounts', 'T1134 - Access Token Manipulation'],
    linkedRiskIds: ['risk-jwt-algorithm-confusion', 'risk-unencrypted-session-data'],
    likelihood: 'High — jsonwebtoken 8.5.0 algorithm confusion is well-documented with public proof-of-concept exploits.',
    impact: 'Critical — complete authentication bypass allows access to any user account including administrative sessions.',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scenario-memory-exfil', title: 'Cross-Zone Memory Exploitation for Data Theft',
    description: 'Attacker exploits a frontend vulnerability (XSS, prototype pollution) to access the shared memory pool and read sensitive business logic data including payment processing results and pricing algorithms.',
    threatActorId: 'ta-external-attacker',
    targetedAssetIds: ['asset-ui-memory', 'asset-business-logic'],
    attackTechniques: ['T1059.007 - JavaScript', 'T1005 - Data from Local System', 'T1119 - Automated Collection'],
    linkedRiskIds: ['risk-shared-memory-xzone', 'risk-buffer-overflow-native'],
    likelihood: 'Moderate — requires initial frontend exploitation but shared memory provides direct access path.',
    impact: 'Major — exposure of proprietary pricing algorithms, customer payment data in processing buffers, and business rule logic.',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scenario-cache-insider', title: 'Insider Cache Data Exfiltration',
    description: 'Malicious insider with network access to the application zone connects directly to unauthenticated Memcached to dump cached customer data, session tokens, and business records.',
    threatActorId: 'ta-insider',
    targetedAssetIds: ['asset-cache-memory', 'asset-session-store'],
    attackTechniques: ['T1005 - Data from Local System', 'T1557 - Adversary-in-the-Middle', 'T1530 - Data from Cloud Storage Object'],
    linkedRiskIds: ['risk-cache-data-unencrypted', 'risk-unencrypted-session-data'],
    likelihood: 'Moderate — requires network access to application zone but Memcached lacks authentication.',
    impact: 'Major — bulk access to cached customer PII, active session tokens, and pricing data without logging.',
    createdAt: NOW, updatedAt: NOW
  },
];

export const vulnerableAppArchitectureGrcWorkspace = buildGrcWorkspace({
  tierCatalogue,
  assets,
  risks,
  assessments,
  soaEntries,
  workflowTasks,
  threatActors,
  threatScenarios,
  securityInitiatives: [
    {
      id: 'vaa-si-auth-hardening', title: 'Authentication & Session Security Hardening',
      description: 'Remediate JWT algorithm confusion vulnerability, encrypt session data at rest and in transit, and migrate from static environment variable secrets to dynamic Vault credentials.',
      category: 'remediation' as const, status: 'in_progress' as const, priority: 'critical' as const,
      owner: 'Security Engineering', executiveSponsor: 'CISO',
      currentState: 'JWT token validator accepts multiple algorithms including "none"; Redis session store transmits and stores session data unencrypted; secrets loaded from environment variables and cached in process memory.',
      targetState: 'JWT algorithm pinned to RS256 with issuer/audience validation; Redis TLS enabled with application-layer session encryption; all secrets managed via Vault dynamic credentials with automatic rotation.',
      startDate: '2025-04-01', targetDate: '2026-03-31', completedDate: '',
      milestones: [
        { id: 'vaa-ms-auth-01', title: 'Pin JWT algorithm to RS256 and upgrade jsonwebtoken library', description: 'Upgrade jsonwebtoken to latest version, pin algorithm to RS256, reject "none" and symmetric algorithms, and add issuer/audience claim validation.', status: 'completed' as const, dueDate: '2025-08-31', completedDate: '2025-08-20', owner: 'Security Engineering' },
        { id: 'vaa-ms-auth-02', title: 'Enable Redis TLS and session payload encryption', description: 'Configure Redis cluster for TLS in transit, implement application-layer AES-256 encryption for session payloads, and deploy session key rotation.', status: 'in_progress' as const, dueDate: '2026-01-31', completedDate: '', owner: 'Platform Engineering' },
        { id: 'vaa-ms-auth-03', title: 'Migrate secrets to Vault dynamic credentials', description: 'Replace static environment variable secrets with HashiCorp Vault dynamic database credentials and short-lived API tokens with automatic rotation.', status: 'pending' as const, dueDate: '2026-03-31', completedDate: '', owner: 'Security Engineering' },
      ],
      linkedRiskIds: ['risk-jwt-algorithm-confusion', 'risk-unencrypted-session-data', 'risk-config-env-exposure'],
      linkedControlSetIds: [],
      linkedAssetIds: ['asset-token-validator', 'asset-session-store', 'asset-secret-vault'],
      linkedImplementedControlIds: ['vaa-ic-waf'],
      linkedAssessmentIds: ['assessment-app-arch-review'],
      notes: 'JWT fix deployed to production. Redis TLS migration requires coordinated maintenance window with zero-downtime deployment.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'vaa-si-memory-safety', title: 'Application Memory Safety & Data Protection Uplift',
      description: 'Implement process-level memory isolation between application zones, encrypt cached data, and harden native C++ modules against buffer overflow vulnerabilities.',
      category: 'uplift' as const, status: 'approved' as const, priority: 'high' as const,
      owner: 'Backend Engineering', executiveSponsor: 'VP Engineering',
      currentState: 'UI memory pool shares direct memory with business logic across zone boundaries; Memcached stores sensitive data without encryption or authentication; C++ native modules lack bounds checking on user input.',
      targetState: 'Process-level memory isolation between presentation and business logic layers; SASL-authenticated Memcached with application-layer encryption for sensitive values; AddressSanitizer and bounds checking enforced in native modules.',
      startDate: '2025-08-01', targetDate: '2026-09-30', completedDate: '',
      milestones: [
        { id: 'vaa-ms-mem-01', title: 'Implement cross-zone memory isolation', description: 'Refactor shared memory architecture to use process-level isolation with IPC channels between presentation and business logic layers.', status: 'in_progress' as const, dueDate: '2026-03-31', completedDate: '', owner: 'Backend Engineering' },
        { id: 'vaa-ms-mem-02', title: 'Enable Memcached SASL and cache encryption', description: 'Deploy SASL authentication on Memcached cluster and implement application-layer AES encryption for cached sensitive values.', status: 'pending' as const, dueDate: '2026-09-30', completedDate: '', owner: 'Platform Engineering' },
      ],
      linkedRiskIds: ['risk-shared-memory-xzone', 'risk-cache-data-unencrypted', 'risk-buffer-overflow-native'],
      linkedControlSetIds: [],
      linkedAssetIds: ['asset-ui-memory', 'asset-business-logic', 'asset-cache-memory'],
      linkedImplementedControlIds: ['vaa-ic-sast'],
      linkedAssessmentIds: ['assessment-app-arch-review'],
      notes: 'Memory isolation requires significant architectural refactoring. Performance regression testing critical for native modules.',
      createdAt: NOW, updatedAt: NOW,
    },
  ],
  implementedControls: [
    {
      id: 'vaa-ic-waf', title: 'Web Application Firewall',
      description: 'Cloudflare WAF providing OWASP Core Rule Set protection, rate limiting, bot detection, and virtual patching for the e-commerce application frontend.',
      controlType: 'technical' as const, category: 'network_security' as const,
      status: 'active' as const, automationLevel: 'fully_automated' as const,
      owner: 'Platform Engineering', vendor: 'Cloudflare', product: 'WAF Enterprise', version: '2024.10',
      implementedDate: '2024-02-15', lastReviewDate: '2025-05-01', nextReviewDate: '2026-05-01',
      linkedSoaEntryIds: ['soa-a03', 'soa-a05'],
      linkedRiskIds: ['risk-buffer-overflow-native', 'risk-shared-memory-xzone'],
      linkedAssetIds: ['asset-ui-memory', 'asset-business-logic'],
      linkedAssessmentIds: ['assessment-app-arch-review'],
      notes: 'OWASP CRS 4.0 rules with custom virtual patches for known C++ module input validation gaps. Rate limiting at 1,000 req/min per IP.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'vaa-ic-sast', title: 'Static Application Security Testing (Veracode)',
      description: 'Veracode Continuous SAST platform integrated into CI/CD pipelines providing automated code analysis for buffer overflows, injection flaws, and cryptographic weaknesses.',
      controlType: 'technical' as const, category: 'monitoring' as const,
      status: 'active' as const, automationLevel: 'fully_automated' as const,
      owner: 'Security Engineering', vendor: 'Veracode', product: 'Continuous', version: '2024',
      implementedDate: '2023-09-01', lastReviewDate: '2025-04-15', nextReviewDate: '2026-04-15',
      linkedSoaEntryIds: ['soa-a06', 'soa-cis-04'],
      linkedRiskIds: ['risk-buffer-overflow-native', 'risk-jwt-algorithm-confusion'],
      linkedAssetIds: ['asset-business-logic', 'asset-token-validator'],
      linkedAssessmentIds: ['assessment-app-arch-review'],
      notes: 'Policy-level SLA requires critical findings fixed within 30 days. Covers native C++ modules and Node.js services.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'vaa-ic-audit-logging', title: 'Centralized Audit Log Management',
      description: 'Datadog Log Management with immutable forwarding from Winston audit logger, providing tamper-evident security event collection with cryptographic log integrity verification.',
      controlType: 'technical' as const, category: 'logging' as const,
      status: 'active' as const, automationLevel: 'semi_automated' as const,
      owner: 'Security Operations', vendor: 'Datadog', product: 'Log Management', version: '2024',
      implementedDate: '2024-05-01', lastReviewDate: '2025-06-01', nextReviewDate: '2026-06-01',
      linkedSoaEntryIds: ['soa-a09', 'soa-cis-03'],
      linkedRiskIds: ['risk-audit-log-tampering', 'risk-permission-cache-stale'],
      linkedAssetIds: ['asset-audit-logger', 'asset-cache-memory'],
      linkedAssessmentIds: ['assessment-app-arch-review'],
      notes: 'TLS transport enabled. Sensitive data scrubbing rules configured but occasional environment variable leakage in trace metadata.',
      createdAt: NOW, updatedAt: NOW,
    },
  ],
  thirdParties: [
    {
      id: 'vaa-tp-auth0',
      name: 'Auth0 (Okta)',
      description: 'SaaS identity platform providing JWT token issuance, user authentication, and authorization services. Handles OAuth 2.0 and OpenID Connect flows for the e-commerce application.',
      category: 'saas' as const,
      status: 'active' as const,
      riskRating: 'critical' as const,
      dataClassification: 'confidential' as const,
      linkedAssetIds: ['asset-token-validator', 'asset-session-store'],
      linkedRiskIds: ['risk-jwt-algorithm-confusion', 'risk-unencrypted-session-data'],
      contactName: 'Sarah Mitchell',
      contactEmail: 'sarah.mitchell@auth0.example.com',
      contractExpiry: '2027-04-30',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-10-31',
      notes: 'Auth0 Enterprise plan with custom domains and log streaming. Issues RS256-signed JWTs but application token validator also accepts HS256 — algorithm confusion vulnerability allows token forgery. Session tokens stored in Redis without encryption. MFA optional for end users. Breach notification SLA is 72 hours. SOC 2 Type II and ISO 27001 certified. Annual penetration test report reviewed.'
    },
    {
      id: 'vaa-tp-redis-labs',
      name: 'Redis Labs',
      description: 'SaaS managed Redis service providing in-memory session storage, application caching, and permission cache for the e-commerce platform. Handles sensitive session data and user state.',
      category: 'saas' as const,
      status: 'active' as const,
      riskRating: 'high' as const,
      dataClassification: 'confidential' as const,
      linkedAssetIds: ['asset-session-store', 'asset-cache-memory'],
      linkedRiskIds: ['risk-unencrypted-session-data', 'risk-cache-data-unencrypted', 'risk-permission-cache-stale'],
      contactName: 'Tomasz Kowalski',
      contactEmail: 'tomasz.kowalski@redis.example.com',
      contractExpiry: '2026-12-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-09-30',
      notes: 'Redis Enterprise Cloud with 99.999% SLA. TLS in transit enabled but data-at-rest encryption not configured — session tokens and cached PII visible in memory dumps. Permission cache TTL set to 24 hours causing stale authorization decisions. No field-level encryption on sensitive cached objects. VPC peering configured but Redis AUTH password shared across environments.'
    },
    {
      id: 'vaa-tp-datadog',
      name: 'Datadog',
      description: 'SaaS observability platform providing application performance monitoring (APM), distributed tracing, log management, and security monitoring for the e-commerce infrastructure.',
      category: 'saas' as const,
      status: 'active' as const,
      riskRating: 'medium' as const,
      dataClassification: 'internal' as const,
      linkedAssetIds: ['asset-audit-logger', 'asset-business-logic'],
      linkedRiskIds: ['risk-audit-log-tampering', 'risk-config-env-exposure'],
      contactName: 'Emily Nguyen',
      contactEmail: 'emily.nguyen@datadog.example.com',
      contractExpiry: '2027-02-28',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-08-31',
      notes: 'Datadog Enterprise plan with APM, Log Management, and Security Monitoring modules. Receives application logs including audit trail — if Datadog ingestion is compromised, audit log integrity is affected. Sensitive data scrubbing rules configured but environment variable values occasionally leak into trace metadata. Agent runs with elevated permissions on application hosts. SOC 2 Type II certified.'
    },
    {
      id: 'vaa-tp-veracode',
      name: 'Veracode',
      description: 'Managed application security testing service providing static analysis (SAST), dynamic analysis (DAST), and software composition analysis (SCA) for the e-commerce codebase.',
      category: 'managed_service' as const,
      status: 'active' as const,
      riskRating: 'medium' as const,
      dataClassification: 'confidential' as const,
      linkedAssetIds: ['asset-business-logic', 'asset-ui-memory', 'asset-data-buffer'],
      linkedRiskIds: ['risk-buffer-overflow-native', 'risk-shared-memory-xzone'],
      contactName: 'James Rodriguez',
      contactEmail: 'james.rodriguez@veracode.example.com',
      contractExpiry: '2026-11-15',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-07-15',
      notes: 'Veracode Continuous platform with IDE integration and CI/CD pipeline scanning. Upload-based SAST requires full source code submission — classified as confidential data transfer. Has identified buffer overflow risks in native modules and cross-zone shared memory issues but remediation is pending. Policy-level SLA requires critical findings fixed within 30 days. FedRAMP Moderate authorized.'
    },
  ],
});

export const vulnerableAppArchitecture: ExampleSystem = {
  id: 'vulnerable-app-architecture',
  name: 'E-Commerce Application Internal Architecture',
  description: 'Microservices e-commerce platform with internal component vulnerabilities',
  category: 'Application Architecture',
  // securityLevel removed - no longer part of the system model
  primaryZone: 'Internal',
  dataClassification: 'Confidential',
  customContext: `# E-Commerce Application Internal Architecture

## System Overview
Our e-commerce platform serves 50,000+ concurrent users with a microservices architecture built on Node.js and React. The application handles payment processing, inventory management, and customer data with emphasis on performance and user experience.

## Application Component Architecture

### Presentation Layer Components
- **UI Memory Pool**: React 17.0.2 frontend with dynamic component loading and shared memory pools for performance
- **Session Store**: Redis 6.0.9 cluster managing user sessions with 30-minute timeouts and cross-tab synchronization
- **Input Buffer**: Custom validation layer processing 10,000+ requests per minute with pre-allocation for efficiency
- **Output Buffer**: Response formatting system with template caching and output compression

### Business Logic Layer
- **Execution Context**: Node.js 14.17.0 runtime with worker threads for parallel processing of business rules
- **Business Logic Memory**: C++ native modules for high-performance calculation with direct memory access
- **Token Validator**: JWT processing using jsonwebtoken 8.5.0 library with algorithm flexibility for compatibility
- **Permission Engine**: Custom RBAC system with cached permission matrices for sub-millisecond authorization

### Data Management Layer
- **Application Cache**: Memcached 1.6.6 cluster with 32GB memory allocation across 4 nodes
- **Data Buffer Pool**: PostgreSQL connection pooling with 200 concurrent connections and prepared statement caching
- **Temporary Storage**: High-speed SSD storage for processing large product catalogs and image uploads
- **Backup Buffer**: Incremental backup system with delta compression and rapid recovery capabilities

### Security and Configuration
- **Configuration Manager**: Environment-based configuration using dotenv with runtime configuration updates
- **Cryptographic Module**: OpenSSL 1.1.1k for encryption operations with hardware acceleration support
- **Audit Logger**: Winston logging framework with structured JSON logging and real-time monitoring
- **Secret Vault**: HashiCorp Vault integration for API keys and database credentials

## Performance Optimizations

### Memory Management
- Shared memory pools between UI and business logic components for reduced garbage collection overhead
- Direct memory access for payment processing to minimize encryption/decryption cycles
- Pre-allocated buffers for handling traffic spikes during flash sales and peak shopping periods
- Memory-mapped files for product catalog data with automatic cache invalidation

### Caching Strategy
- User session data cached in memory with fallback to Redis for session persistence
- Permission matrices cached at application startup with on-demand refresh for role changes
- Database query results cached in memory with intelligent cache warming based on usage patterns
- Configuration values cached in execution context to avoid repeated vault API calls

### Data Processing
- Temporary files created during order processing for complex pricing calculations
- Backup operations use shared memory buffers to minimize I/O overhead during peak hours
- Audit logs written to memory buffers before batch writing to reduce disk latency
- Token validation uses cached public keys stored in application memory

## Development Practices

### Security Approach
- Input validation performed in dedicated buffer with sanitization rules
- Output encoding applied consistently through centralized buffer management
- Cryptographic operations centralized in security module with key rotation support
- Audit logging captures all security-relevant events with detailed context information

### Configuration Management
- Environment variables used for runtime configuration to support containerized deployments
- Secret rotation handled automatically through vault integration with zero-downtime updates
- Application settings cached in memory for performance with periodic refresh from configuration source
- Feature flags stored in shared memory for instant activation across all application instances

### Operational Features
- Memory pools sized dynamically based on load patterns and historical usage data
- Session cleanup performed during low-traffic periods to maintain optimal memory usage
- Temporary storage automatically purged after 24 hours to prevent disk space issues
- Backup verification runs in background threads without impacting user-facing performance

## Recent Enhancements
- Upgraded memory management to use native C++ modules for 40% performance improvement
- Implemented shared memory architecture between presentation and business logic layers
- Added automatic scaling of memory pools based on real-time traffic analysis
- Integrated hardware security modules for cryptographic operations in production environment`,

  nodes: [
    // Zone layout (4 nodes each → 750px):
    // Presentation: x=50, Application: x=920, Data: x=1790, Security: x=2660
    // Monitoring (above, 4 nodes → 750px): x=1790 (aligned with Data zone)
    {
      id: 'presentation-zone',
      type: 'securityZone',
      position: { x: 50, y: 50 },
      data: {
        label: 'Presentation Zone',
        zoneType: 'DMZ' as SecurityZone,
        description: 'User interface and presentation layer components',
        zone: 'Internal' as SecurityZone
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.DMZ,
        zIndex: -1
      }
    } as SecurityNode,

    {
      id: 'application-zone',
      type: 'securityZone',
      position: { x: 920, y: 50 },
      data: {
        label: 'Application Zone',
        zoneType: 'Internal' as SecurityZone,
        description: 'Business logic and application processing components'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Internal,
        zIndex: -1
      }
    } as SecurityNode,

    {
      id: 'data-zone',
      type: 'securityZone',
      position: { x: 1790, y: 50 },
      data: {
        label: 'Data Zone',
        zoneType: 'Restricted' as SecurityZone,
        description: 'Data storage and caching layer components'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Restricted,
        zIndex: -1
      }
    } as SecurityNode,

    {
      id: 'security-zone',
      type: 'securityZone',
      position: { x: 2660, y: 50 },
      data: {
        label: 'Security Zone',
        zoneType: 'Trusted' as SecurityZone,
        description: 'Security and configuration management components'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Trusted,
        zIndex: -1
      }
    } as SecurityNode,

    {
      id: 'monitoring-zone',
      type: 'securityZone',
      position: { x: 940, y: -1070 },
      data: {
        label: 'Monitoring Zone',
        zoneType: 'Critical' as SecurityZone,
        description: 'Application performance and security monitoring'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Critical,
        zIndex: -1
      }
    } as SecurityNode,

    // Presentation Zone Nodes (zone x: old=50, new=50, delta=0)
    {
      id: 'ui-memory-pool',
      type: 'storage',
      position: { x: 425, y: 175 },
      data: {
        label: 'UI Memory Pool',
        description: 'Frontend memory allocation for user interface components with shared memory vulnerabilities and memory leak issues',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        vendor: 'React',
        version: '17.0.2',
        technology: 'JavaScript Heap',
        securityControls: ['Memory Allocation', 'Garbage Collection', 'Component Lifecycle']
      }
    } as SecurityNode,

    {
      id: 'session-store',
      type: 'cache',
      position: { x: 175, y: 425 },
      data: {
        label: 'Session Store',
        description: 'Client-side session data storage and management with 30-minute timeouts and cross-tab synchronization vulnerabilities',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'Redis',
        version: '6.0.9',
        technology: 'In-Memory Store',
        securityControls: ['Session Management', 'Timeout Handling', 'Cross-tab Sync']
      }
    } as SecurityNode,

    {
      id: 'input-buffer',
      type: 'service',
      position: { x: 425, y: 475 },
      data: {
        label: 'Input Buffer',
        description: 'User input validation and preprocessing buffer with pre-allocation for efficiency and buffer overflow risks',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        vendor: 'Custom',
        version: '2.1.3',
        technology: 'Input Validation',
        securityControls: ['Input Sanitization', 'Buffer Management', 'Validation Rules']
      }
    } as SecurityNode,

    {
      id: 'output-buffer',
      type: 'service',
      position: { x: 425, y: 875 },
      data: {
        label: 'Output Buffer',
        description: 'Response formatting and output encoding buffer with template caching and compression vulnerabilities',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        vendor: 'Custom',
        version: '1.8.7',
        technology: 'Output Encoding',
        securityControls: ['Response Formatting', 'Output Encoding', 'Template Caching']
      }
    } as SecurityNode,

    // Application Zone Nodes (zone x: old=820, new=920, delta=+100)
    {
      id: 'execution-context',
      type: 'service',
      position: { x: 1225, y: 175 },
      data: {
        label: 'Execution Context',
        description: 'Application runtime execution environment and thread management with worker threads for parallel processing vulnerabilities',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        vendor: 'Node.js',
        version: '14.17.0',
        technology: 'JavaScript Runtime',
        securityControls: ['Thread Management', 'Context Isolation', 'Resource Limits']
      }
    } as SecurityNode,

    {
      id: 'business-logic-pool',
      type: 'storage',
      position: { x: 1025, y: 525 },
      data: {
        label: 'Business Logic Memory',
        description: 'Memory pool for business rule processing and calculations using C++ native modules with direct memory access',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        vendor: 'Custom',
        version: '3.2.1',
        technology: 'C++ Memory Management',
        securityControls: ['Memory Protection', 'Native Module Interface', 'Performance Optimization']
      }
    } as SecurityNode,

    {
      id: 'token-validator',
      type: 'service',
      position: { x: 1475, y: 425 },
      data: {
        label: 'Token Validator',
        description: 'JWT token validation and parsing component with algorithm flexibility for compatibility creating confusion vulnerabilities',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        vendor: 'jsonwebtoken',
        version: '8.5.0',
        technology: 'JWT Processing',
        securityControls: ['Token Validation', 'Algorithm Verification', 'Signature Checking']
      }
    } as SecurityNode,

    {
      id: 'permission-engine',
      type: 'service',
      position: { x: 1275, y: 675 },
      data: {
        label: 'Permission Engine',
        description: 'Authorization and access control logic processing with cached permission matrices for sub-millisecond authorization',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'Custom',
        version: '2.4.1',
        technology: 'RBAC Engine',
        securityControls: ['Access Control', 'Permission Caching', 'Role Management']
      }
    } as SecurityNode,

    // Data Zone Nodes (zone x: old=1590, new=1790, delta=+200)
    {
      id: 'cache-memory',
      type: 'cache',
      position: { x: 2125, y: 175 },
      data: {
        label: 'Application Cache',
        description: 'High-performance memory cache for frequently accessed data with 32GB memory allocation across 4 nodes',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'Memcached',
        version: '1.6.6',
        technology: 'Memory Cache',
        securityControls: ['Memory Management', 'Data Expiration', 'Cluster Coordination']
      }
    } as SecurityNode,

    {
      id: 'data-buffer',
      type: 'database',
      position: { x: 1925, y: 375 },
      data: {
        label: 'Data Buffer Pool',
        description: 'Database connection pooling and query result buffering with 200 concurrent connections and prepared statement caching',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'PostgreSQL',
        version: '12.8',
        technology: 'Connection Pool',
        securityControls: ['Connection Pooling', 'Query Caching', 'Prepared Statements']
      }
    } as SecurityNode,

    {
      id: 'temp-storage',
      type: 'storage',
      position: { x: 2325, y: 375 },
      data: {
        label: 'Temporary Storage',
        description: 'High-speed SSD storage for processing large product catalogs and image uploads with automatic purging after 24 hours',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'Custom',
        version: '1.2.8',
        technology: 'File System',
        securityControls: ['Temporary File Management', 'Automatic Purging', 'Access Controls']
      }
    } as SecurityNode,

    {
      id: 'backup-buffer',
      type: 'storage',
      position: { x: 2125, y: 575 },
      data: {
        label: 'Backup Buffer',
        description: 'Incremental backup system with delta compression and rapid recovery capabilities for temporary backup storage',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'Custom',
        version: '2.1.0',
        technology: 'Backup System',
        securityControls: ['Incremental Backup', 'Delta Compression', 'Recovery Procedures']
      }
    } as SecurityNode,

    // Security Zone Nodes (zone x: old=2360, new=2660, delta=+300)
    {
      id: 'config-manager',
      type: 'service',
      position: { x: 3025, y: 175 },
      data: {
        label: 'Configuration Manager',
        description: 'Application configuration and environment variable management with runtime configuration updates and dotenv integration',
        zone: 'Trusted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'dotenv',
        version: '8.2.0',
        technology: 'Config Management',
        securityControls: ['Environment Management', 'Configuration Validation', 'Runtime Updates']
      }
    } as SecurityNode,

    {
      id: 'crypto-module',
      type: 'service',
      position: { x: 2825, y: 225 },
      data: {
        label: 'Cryptographic Module',
        description: 'Encryption, hashing, and cryptographic key management using OpenSSL with hardware acceleration support',
        zone: 'Trusted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'OpenSSL',
        version: '1.1.1k',
        technology: 'Cryptography',
        securityControls: ['Encryption Operations', 'Key Management', 'Hardware Acceleration']
      }
    } as SecurityNode,

    {
      id: 'audit-logger',
      type: 'monitor',
      position: { x: 3175, y: 875 },
      data: {
        label: 'Audit Logger',
        description: 'Security event logging and audit trail generation using Winston with structured JSON logging and real-time monitoring',
        zone: 'Trusted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        vendor: 'Winston',
        version: '3.3.3',
        technology: 'Logging Framework',
        securityControls: ['Structured Logging', 'Real-time Monitoring', 'Log Correlation']
      }
    } as SecurityNode,

    {
      id: 'secret-vault',
      type: 'storage',
      position: { x: 3025, y: 575 },
      data: {
        label: 'Secret Vault',
        description: 'API keys, passwords, and sensitive configuration storage using HashiCorp Vault with key rotation support',
        zone: 'Trusted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'HashiCorp Vault',
        version: '1.8.1',
        technology: 'Secret Management',
        securityControls: ['Secret Storage', 'Key Rotation', 'Access Policies']
      }
    } as SecurityNode,

    // Monitoring Zone Nodes (zone x: old=1590, new=1790, delta=+200)
    {
      id: 'performance-monitor',
      type: 'monitor',
      position: { x: 2125, y: -875 },
      data: {
        label: 'Application Performance Monitor',
        description: 'Real-time application performance monitoring with memory leak detection and performance optimization',
        vendor: 'New Relic',
        product: 'APM',
        version: '8.2.1',
        zone: 'Critical' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'Telemetry', 'Metrics'],
        securityControls: ['Performance Tracking', 'Memory Analysis', 'Error Detection']
      }
    } as SecurityNode,

    {
      id: 'security-scanner',
      type: 'monitor',
      position: { x: 1725, y: -1025 },
      data: {
        label: 'Application Security Scanner',
        description: 'Continuous application security scanning with vulnerability detection and compliance monitoring',
        vendor: 'Veracode',
        product: 'Static Analysis',
        version: '21.10.2',
        zone: 'Critical' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'SARIF', 'REST API'],
        securityControls: ['Vulnerability Scanning', 'Code Analysis', 'Compliance Checks']
      }
    } as SecurityNode,

    {
      id: 'memory-analyzer',
      type: 'monitor',
      position: { x: 2325, y: -675 },
      data: {
        label: 'Memory Analysis Engine',
        description: 'Advanced memory analysis and buffer overflow detection with heap dump analysis',
        vendor: 'Eclipse MAT',
        product: 'Memory Analyzer',
        version: '1.12.0',
        zone: 'Critical' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['JMX', 'Heap Dumps', 'GC Logs'],
        securityControls: ['Memory Leak Detection', 'Heap Analysis', 'GC Monitoring']
      }
    } as SecurityNode,

    {
      id: 'runtime-guard',
      type: 'monitor',
      position: { x: 1875, y: -575 },
      data: {
        label: 'Runtime Application Self-Protection',
        description: 'Real-time application protection with attack detection and automatic response capabilities',
        vendor: 'Contrast Security',
        product: 'Protect',
        version: '4.8.5',
        zone: 'Critical' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTP Instrumentation', 'Runtime API', 'Security Events'],
        securityControls: ['Attack Detection', 'Automatic Response', 'Runtime Protection']
      }
    } as SecurityNode
  ],

  edges: [
    // User input processing flow
    {
      id: 'input-to-ui-memory',
      source: 'input-buffer',
      target: 'ui-memory-pool',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      type: "securityEdge",
      data: {
        label: "UI Rendering",
        protocol: 'Memory Access',
        encryption: 'none',  // Vulnerability: no memory protection
        description: 'User interface rendering',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,

    {
      id: 'input-to-execution',
      source: 'input-buffer',
      target: 'execution-context',
      sourceHandle: 'right',
      targetHandle: 'left',
      type: "securityEdge",
      data: {
        label: "Request Processing",
        protocol: 'Function Call',
        encryption: 'none',
        description: 'Request processing',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,

    // Session management flows
    {
      id: 'session-to-token',
      source: 'session-store',
      target: 'token-validator',
      sourceHandle: 'right',
      targetHandle: 'left',
      type: "securityEdge",
      data: {
        label: "Token Validation",
        protocol: 'Memory Access',
        encryption: 'none',  // Vulnerability: session data in clear memory
        description: 'Session token validation',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,

    {
      id: 'token-to-permission',
      source: 'token-validator',
      target: 'permission-engine',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      type: "securityEdge",
      data: {
        label: "Authorization Check",
        protocol: 'Function Call',
        encryption: 'none',
        description: 'User authorization',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,

    // Execution and memory flows
    {
      id: 'execution-to-business-logic',
      source: 'execution-context',
      target: 'business-logic-pool',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      type: "securityEdge",
      data: {
        label: "Memory Allocation",
        protocol: 'Memory Management',
        encryption: 'none',  // Vulnerability: no memory encryption
        description: 'Business logic memory allocation',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,

    {
      id: 'business-logic-to-cache',
      source: 'business-logic-pool',
      target: 'cache-memory',
      sourceHandle: 'right',
      targetHandle: 'left',
      type: "securityEdge",
      data: {
        label: "Data Caching",
        protocol: 'Memory Copy',
        encryption: 'none',  // Vulnerability: sensitive data cached unencrypted
        description: 'Data caching operations',
        zone: 'Restricted' as SecurityZone
      }
    } as SecurityEdge,

    // Data processing flows
    {
      id: 'cache-to-data-buffer',
      source: 'cache-memory',
      target: 'data-buffer',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      type: "securityEdge",
      data: {
        label: "Database Query",
        protocol: 'Memory Access',
        encryption: 'none',
        description: 'Database queries',
        zone: 'Restricted' as SecurityZone
      }
    } as SecurityEdge,

    {
      id: 'data-buffer-to-temp',
      source: 'data-buffer',
      target: 'temp-storage',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      type: "securityEdge",
      data: {
        label: "Temp File Write",
        protocol: 'File I/O',
        encryption: 'none',  // Vulnerability: temp files unencrypted
        description: 'Temporary file storage',
        zone: 'Restricted' as SecurityZone
      }
    } as SecurityEdge,

    {
      id: 'temp-to-backup',
      source: 'temp-storage',
      target: 'backup-buffer',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      type: "securityEdge",
      data: {
        label: "Backup Creation",
        protocol: 'File Copy',
        encryption: 'none',  // Vulnerability: backups contain sensitive data
        description: 'Backup operations',
        zone: 'Restricted' as SecurityZone
      }
    } as SecurityEdge,

    // Configuration and security flows
    {
      id: 'config-to-execution',
      source: 'config-manager',
      target: 'execution-context',
      sourceHandle: 'left',
      targetHandle: 'right',
      type: "securityEdge",
      data: {
        controlPoints: [
          { id: 'cp-1771654112856', x: 2850, y: 0, active: true },
          { id: 'cp-1771654118372', x: 1450, y: 0, active: true }
        ],
        label: "Config Loading",
        protocol: 'Environment Vars',
        encryption: 'none',  // Vulnerability: config in environment variables
        description: 'Configuration loading',
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,

    {
      id: 'config-to-vault',
      source: 'config-manager',
      target: 'secret-vault',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      type: "securityEdge",
      data: {
        label: "Secret Retrieval",
        protocol: 'API Call',
        encryption: 'TLS 1.2',
        description: 'Secret management',
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,

    {
      id: 'crypto-to-token',
      source: 'crypto-module',
      target: 'token-validator',
      sourceHandle: 'left',
      targetHandle: 'right',
      type: "securityEdge",
      data: {
        label: "Crypto Operations",
        protocol: 'Function Call',
        encryption: 'none',
        description: 'Cryptographic operations',
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,

    {
      id: 'crypto-to-session',
      source: 'crypto-module',
      target: 'session-store',
      sourceHandle: 'left',
      targetHandle: 'right',
      type: "securityEdge",
      data: {
        controlPoints: [
          { id: 'cp-1771654083676', x: 2500, y: 850, active: true },
          { id: 'cp-1771654076192', x: 450, y: 850, active: true }
        ],
        label: "Session Encryption",
        protocol: 'Memory Access',
        encryption: 'none',  // Vulnerability: encryption keys in memory
        description: 'Session encryption',
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,

    // Output and audit flows
    {
      id: 'business-logic-to-output',
      source: 'business-logic-pool',
      target: 'output-buffer',
      sourceHandle: 'left',
      targetHandle: 'right',
      type: "securityEdge",
      data: {
        label: "Response Generation",
        protocol: 'Memory Copy',
        encryption: 'none',
        description: 'Response generation',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,

    {
      id: 'output-to-audit',
      source: 'output-buffer',
      target: 'audit-logger',
      sourceHandle: 'right',
      targetHandle: 'left',
      type: "securityEdge",
      data: {
        label: "Audit Logging",
        protocol: 'Function Call',
        encryption: 'none',  // Vulnerability: audit logs contain sensitive data
        description: 'Security audit logging',
        zone: 'Trusted' as SecurityZone
      }
    } as SecurityEdge,

    // Cross-component memory sharing (vulnerability)
    {
      id: 'ui-memory-to-business-logic',
      source: 'ui-memory-pool',
      target: 'business-logic-pool',
      sourceHandle: 'right',
      targetHandle: 'left',
      type: "securityEdge",
      data: {
        label: "Shared Memory",
        protocol: 'Direct Memory',
        encryption: 'none',  // Vulnerability: shared memory between zones
        description: 'Shared memory access',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,

    {
      id: 'permission-to-cache',
      source: 'permission-engine',
      target: 'cache-memory',
      sourceHandle: 'right',
      targetHandle: 'left',
      type: "securityEdge",
      data: {
        label: "Permission Cache",
        protocol: 'Memory Access',
        encryption: 'none',  // Vulnerability: permissions cached without protection
        description: 'Permission caching',
        zone: 'Restricted' as SecurityZone
      }
    } as SecurityEdge,

    // Monitoring connections - Performance Monitor
    {
      id: 'execution-to-performance-monitor',
      source: 'execution-context',
      target: 'performance-monitor',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      type: "securityEdge",
      data: {
        label: "Performance Metrics",
        protocol: 'APM Agent',
        encryption: 'TLS 1.2',
        description: 'Application performance telemetry',
        zone: 'Critical' as SecurityZone
      }
    } as SecurityEdge,

    {
      id: 'business-logic-to-performance-monitor',
      source: 'business-logic-pool',
      target: 'performance-monitor',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      type: "securityEdge",
      data: {
        label: "Memory Metrics",
        protocol: 'JMX',
        encryption: 'none',  // Vulnerability: memory metrics exposed
        description: 'Memory usage monitoring',
        zone: 'Critical' as SecurityZone
      }
    } as SecurityEdge,

    // Monitoring connections - Security Scanner
    {
      id: 'execution-to-security-scanner',
      source: 'execution-context',
      target: 'security-scanner',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      type: "securityEdge",
      data: {
        label: "Code Analysis",
        protocol: 'REST API',
        encryption: 'TLS 1.2',
        description: 'Runtime code analysis',
        zone: 'Critical' as SecurityZone
      }
    } as SecurityEdge,

    {
      id: 'crypto-to-security-scanner',
      source: 'crypto-module',
      target: 'security-scanner',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      type: "securityEdge",
      data: {
        label: "Crypto Audit",
        protocol: 'REST API',
        encryption: 'TLS 1.2',
        description: 'Cryptographic operation auditing',
        zone: 'Critical' as SecurityZone
      }
    } as SecurityEdge,

    // Monitoring connections - Memory Analyzer
    {
      id: 'ui-memory-to-memory-analyzer',
      source: 'ui-memory-pool',
      target: 'memory-analyzer',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      type: "securityEdge",
      data: {
        label: "Heap Analysis",
        protocol: 'Memory Dump',
        encryption: 'none',  // Vulnerability: heap dumps contain sensitive data
        description: 'UI memory heap analysis',
        zone: 'Critical' as SecurityZone
      }
    } as SecurityEdge,

    {
      id: 'cache-memory-to-memory-analyzer',
      source: 'cache-memory',
      target: 'memory-analyzer',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      type: "securityEdge",
      data: {
        label: "Cache Analysis",
        protocol: 'Memory Access',
        encryption: 'none',  // Vulnerability: cache analysis exposes data
        description: 'Cache memory analysis',
        zone: 'Critical' as SecurityZone
      }
    } as SecurityEdge,

    // Monitoring connections - Runtime Guard
    {
      id: 'input-buffer-to-runtime-guard',
      source: 'input-buffer',
      target: 'runtime-guard',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      type: "securityEdge",
      data: {
        label: "Attack Detection",
        protocol: 'HTTP Hook',
        encryption: 'none',  // Vulnerability: attack data in clear text
        description: 'Input validation monitoring',
        zone: 'Critical' as SecurityZone
      }
    } as SecurityEdge,

    {
      id: 'permission-to-runtime-guard',
      source: 'permission-engine',
      target: 'runtime-guard',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      type: "securityEdge",
      data: {
        label: "Access Monitoring",
        protocol: 'Event Stream',
        encryption: 'none',
        description: 'Authorization event monitoring',
        zone: 'Critical' as SecurityZone
      }
    } as SecurityEdge,

    // Inter-monitoring connections
    {
      id: 'performance-monitor-to-memory-analyzer',
      source: 'performance-monitor',
      target: 'memory-analyzer',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      type: "securityEdge",
      data: {
        label: "Memory Alerts",
        protocol: 'REST API',
        encryption: 'TLS 1.2',
        description: 'Memory leak detection alerts',
        zone: 'Critical' as SecurityZone
      }
    } as SecurityEdge,

    {
      id: 'security-scanner-to-runtime-guard',
      source: 'security-scanner',
      target: 'runtime-guard',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      type: "securityEdge",
      data: {
        label: "Vulnerability Data",
        protocol: 'REST API',
        encryption: 'TLS 1.2',
        description: 'Vulnerability information sharing',
        zone: 'Critical' as SecurityZone
      }
    } as SecurityEdge,

    {
      id: 'runtime-guard-to-audit-logger',
      source: 'runtime-guard',
      target: 'audit-logger',
      sourceHandle: 'left',
      targetHandle: 'right',
      type: "securityEdge",
      data: {
        label: "Security Events",
        protocol: 'Syslog',
        encryption: 'none',  // Vulnerability: security events logged in clear text
        description: 'Security event logging',
        zone: 'Critical' as SecurityZone
      }
    } as SecurityEdge
  ],

  grcWorkspace: vulnerableAppArchitectureGrcWorkspace,

  attackPaths: [
    {
      id: 'ap-shared-memory-exfil',
      name: 'Cross-Zone Shared Memory → Business Data Exfiltration',
      strideCategory: 'Information Disclosure',
      riskLevel: 'High',
      description: 'An attacker exploits a frontend vulnerability in the input buffer to inject malicious payloads into the UI memory pool. Because the UI memory pool shares direct memory with the business logic layer across the DMZ-Internal zone boundary, the attacker reads sensitive business data including payment processing results and pricing algorithms from the shared memory region.',
      steps: [
        {
          order: 1,
          edgeId: 'input-to-ui-memory',
          sourceNodeId: 'input-buffer',
          targetNodeId: 'ui-memory-pool',
          technique: 'T1059: Command and Scripting Interpreter',
        },
        {
          order: 2,
          edgeId: 'ui-memory-to-business-logic',
          sourceNodeId: 'ui-memory-pool',
          targetNodeId: 'business-logic-pool',
          technique: 'T1005: Data from Local System',
        },
      ],
      mitreTechniques: ['T1059', 'T1005'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-jwt-session-hijack',
      name: 'JWT Algorithm Confusion → Session Hijack → Cache Exfiltration',
      strideCategory: 'Elevation of Privilege',
      riskLevel: 'Critical',
      description: 'An attacker crafts a JWT token exploiting the algorithm confusion vulnerability in jsonwebtoken 8.5.0 (switching from RS256 to HS256 using the public key as HMAC secret, or using the "none" algorithm). The forged token passes validation in the token validator, the permission engine grants elevated access from its stale cache, and the attacker accesses unencrypted sensitive data stored in the Memcached application cache.',
      steps: [
        {
          order: 1,
          edgeId: 'session-to-token',
          sourceNodeId: 'session-store',
          targetNodeId: 'token-validator',
          technique: 'T1550: Use Alternate Authentication Material',
        },
        {
          order: 2,
          edgeId: 'token-to-permission',
          sourceNodeId: 'token-validator',
          targetNodeId: 'permission-engine',
          technique: 'T1078: Valid Accounts',
        },
        {
          order: 3,
          edgeId: 'permission-to-cache',
          sourceNodeId: 'permission-engine',
          targetNodeId: 'cache-memory',
          technique: 'T1005: Data from Local System',
        },
      ],
      mitreTechniques: ['T1550', 'T1078', 'T1005'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-config-secret-theft',
      name: 'Config Manager Exploitation → Secret Vault Credential Theft',
      strideCategory: 'Information Disclosure',
      riskLevel: 'Critical',
      description: 'An attacker gains code execution in the application execution context (e.g., via buffer overflow in C++ native modules or prototype pollution). The execution context has cached configuration values loaded from environment variables by the config manager, including Vault API tokens. The attacker uses these cached credentials to access the secret vault and exfiltrate database credentials, API keys, and encryption keys.',
      steps: [
        {
          order: 1,
          edgeId: 'input-to-execution',
          sourceNodeId: 'input-buffer',
          targetNodeId: 'execution-context',
          technique: 'T1190: Exploit Public-Facing Application',
        },
        {
          order: 2,
          edgeId: 'config-to-execution',
          sourceNodeId: 'config-manager',
          targetNodeId: 'execution-context',
          technique: 'T1552: Unsecured Credentials',
        },
        {
          order: 3,
          edgeId: 'config-to-vault',
          sourceNodeId: 'config-manager',
          targetNodeId: 'secret-vault',
          technique: 'T1555: Credentials from Password Stores',
        },
      ],
      mitreTechniques: ['T1190', 'T1552', 'T1555'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-buffer-overflow-db-exfil',
      name: 'Buffer Overflow → Business Logic → Database Exfiltration',
      strideCategory: 'Tampering',
      riskLevel: 'Critical',
      description: 'An attacker sends crafted input through the input buffer that reaches the execution context and triggers a buffer overflow in the C++ native modules within the business logic memory pool. With code execution in the business logic layer, the attacker manipulates cached data and pivots through the cache to the data buffer pool, exfiltrating or tampering with customer and payment records in the PostgreSQL database.',
      steps: [
        {
          order: 1,
          edgeId: 'input-to-execution',
          sourceNodeId: 'input-buffer',
          targetNodeId: 'execution-context',
          technique: 'T1190: Exploit Public-Facing Application',
        },
        {
          order: 2,
          edgeId: 'execution-to-business-logic',
          sourceNodeId: 'execution-context',
          targetNodeId: 'business-logic-pool',
          technique: 'T1203: Exploitation for Client Execution',
        },
        {
          order: 3,
          edgeId: 'business-logic-to-cache',
          sourceNodeId: 'business-logic-pool',
          targetNodeId: 'cache-memory',
          technique: 'T1565: Data Manipulation',
        },
        {
          order: 4,
          edgeId: 'cache-to-data-buffer',
          sourceNodeId: 'cache-memory',
          targetNodeId: 'data-buffer',
          technique: 'T1005: Data from Local System',
        },
      ],
      mitreTechniques: ['T1190', 'T1203', 'T1565', 'T1005'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
  ],
};
