/**
 * Vulnerable Privacy Management Platform
 * 
 * This system demonstrates common vulnerabilities in GDPR compliance and
 * privacy management systems that can lead to data breaches and regulatory
 * violations. Vulnerabilities are embedded within the architecture.
 */

import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityNode, SecurityEdge, SecurityZone } from '../../types/SecurityTypes';
import { DiagramAttackPath, AssessmentThreatModelNodeSourceType, AssessmentThreatModelEdgeSourceType, AttackPathRiskLevel } from '../../types/GrcTypes';
import { colors } from '../../styles/Theme';
import { buildGrcWorkspace, score, NOW, OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID } from './grcSharedBase';
import { StrideCategory } from '../../types/ThreatIntelTypes';

const tierCatalogue = [
  { id: 'tier1-privacy', tier: 1 as const, label: 'Privacy Risk', description: 'Data protection and privacy compliance threats' },
  { id: 'tier1-operational', tier: 1 as const, label: 'Operational Risk', description: 'Business operations and process risks' },
  { id: 'tier2-data-protection', tier: 2 as const, label: 'Data Protection', parentId: 'tier1-privacy', description: 'PII handling, encryption, and data-at-rest/in-transit controls' },
  { id: 'tier2-consent', tier: 2 as const, label: 'Consent Management', parentId: 'tier1-privacy', description: 'Lawful basis and consent lifecycle management' },
  { id: 'tier2-cross-border', tier: 2 as const, label: 'Cross-Border Transfers', parentId: 'tier1-privacy', description: 'International data transfer compliance' },
  { id: 'tier2-rights', tier: 2 as const, label: 'Data Subject Rights', parentId: 'tier1-privacy', description: 'GDPR Articles 15-22 fulfilment' },
  { id: 'tier2-third-party', tier: 2 as const, label: 'Third-Party Processing', parentId: 'tier1-operational', description: 'Processor and sub-processor oversight' },
  { id: 'tier2-monitoring', tier: 2 as const, label: 'Privacy Monitoring', parentId: 'tier1-operational', description: 'Audit logging and breach detection' },
  { id: 'tier3-unencrypted-pii', tier: 3 as const, label: 'Unencrypted PII Transmission', parentId: 'tier2-data-protection' },
  { id: 'tier3-weak-anonymisation', tier: 3 as const, label: 'Weak Anonymisation', parentId: 'tier2-data-protection' },
  { id: 'tier3-prechecked-consent', tier: 3 as const, label: 'Pre-checked Consent Boxes', parentId: 'tier2-consent' },
  { id: 'tier3-delayed-withdrawal', tier: 3 as const, label: 'Delayed Consent Withdrawal', parentId: 'tier2-consent' },
  { id: 'tier3-inadequate-safeguards', tier: 3 as const, label: 'Inadequate Transfer Safeguards', parentId: 'tier2-cross-border' },
  { id: 'tier3-dsr-delays', tier: 3 as const, label: 'DSR Processing Delays', parentId: 'tier2-rights' },
  { id: 'tier3-broad-db-access', tier: 3 as const, label: 'Broad Database Access', parentId: 'tier2-third-party' },
  { id: 'tier3-short-log-retention', tier: 3 as const, label: 'Short Audit Log Retention', parentId: 'tier2-monitoring' },
  { id: 'tier4-tls-enforcement', tier: 4 as const, label: 'TLS Enforcement for PII Flows', parentId: 'tier3-unencrypted-pii' },
  { id: 'tier4-k-anonymity-review', tier: 4 as const, label: 'K-Anonymity Parameter Review', parentId: 'tier3-weak-anonymisation' },
  { id: 'tier4-consent-ux-audit', tier: 4 as const, label: 'Consent UX Audit', parentId: 'tier3-prechecked-consent' },
];

const assets = [
  {
    id: 'asset-patient-database', name: 'Oracle Patient Database', type: 'database', owner: 'Data Management',
    domain: 'application' as const, category: 'Database',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Primary Oracle 19c database containing 100,000+ electronic health records',
    criticality: { confidentiality: 5, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 3 },
    diagramRefs: [{ diagramId: 'healthcare-privacy-platform', nodeId: 'patient-database', nodeLabel: 'Patient Database', nodeType: 'database' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-patient-portal', name: 'Patient Portal', type: 'web_server', owner: 'Digital Health',
    domain: 'application' as const, category: 'Web Application',
    businessCriticality: 4, securityCriticality: 5,
    description: 'React/Node.js patient portal with direct database connections and basic authentication',
    criticality: { confidentiality: 4, integrity: 4, availability: 4, financial: 3, reputation: 5, safety: 2 },
    diagramRefs: [{ diagramId: 'healthcare-privacy-platform', nodeId: 'patient-portal', nodeLabel: 'Patient Portal', nodeType: 'webServer' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-consent-manager', name: 'OneTrust Consent Management', type: 'application_server', owner: 'Privacy Office',
    domain: 'application' as const, category: 'Privacy Platform',
    businessCriticality: 5, securityCriticality: 4,
    description: 'Consent management platform with pre-checked boxes and 72-hour withdrawal delay',
    criticality: { confidentiality: 3, integrity: 5, availability: 4, financial: 4, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'healthcare-privacy-platform', nodeId: 'consent-manager', nodeLabel: 'Consent Management', nodeType: 'service' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-analytics-partner', name: 'DataCorp Analytics Partner', type: 'third_party_service', owner: 'Data Analytics',
    domain: 'it' as const, category: 'External Service',
    businessCriticality: 3, securityCriticality: 4,
    description: 'Third-party analytics processor receiving weekly patient data exports with multi-region infrastructure',
    criticality: { confidentiality: 5, integrity: 3, availability: 2, financial: 3, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'healthcare-privacy-platform', nodeId: 'analytics-partner', nodeLabel: 'Analytics Partner', nodeType: 'application' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-anonymizer', name: 'Privacy Analytics Anonymizer', type: 'application_server', owner: 'Data Management',
    domain: 'application' as const, category: 'Privacy Tool',
    businessCriticality: 4, securityCriticality: 4,
    description: 'K-anonymity engine with 30-day QA retention creating re-identification risks',
    criticality: { confidentiality: 4, integrity: 4, availability: 3, financial: 3, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'healthcare-privacy-platform', nodeId: 'anonymizer', nodeLabel: 'Data Anonymizer', nodeType: 'service' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-audit-system', name: 'Splunk Audit System', type: 'security_tool', owner: 'Compliance',
    domain: 'it' as const, category: 'Security Tools',
    businessCriticality: 4, securityCriticality: 4,
    description: 'Audit logging platform with 6-month local retention and unencrypted syslog ingestion',
    criticality: { confidentiality: 3, integrity: 4, availability: 3, financial: 2, reputation: 3, safety: 1 },
    diagramRefs: [{ diagramId: 'healthcare-privacy-platform', nodeId: 'audit-system', nodeLabel: 'Audit System', nodeType: 'monitor' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-data-broker', name: 'InfoTrack Data Broker', type: 'third_party_service', owner: 'Operations',
    domain: 'it' as const, category: 'External Service',
    businessCriticality: 2, securityCriticality: 3,
    description: 'External verification service with offshore backup storage and TLS 1.0 connections',
    criticality: { confidentiality: 4, integrity: 3, availability: 2, financial: 2, reputation: 3, safety: 1 },
    diagramRefs: [{ diagramId: 'healthcare-privacy-platform', nodeId: 'data-broker', nodeLabel: 'Data Broker Service', nodeType: 'storage' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-retention-manager', name: 'Data Retention Manager', type: 'application_server', owner: 'Compliance',
    domain: 'application' as const, category: 'Lifecycle Management',
    businessCriticality: 4, securityCriticality: 3,
    description: 'Custom lifecycle management with 30-day deletion processing delays',
    criticality: { confidentiality: 3, integrity: 4, availability: 3, financial: 3, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'healthcare-privacy-platform', nodeId: 'retention-manager', nodeLabel: 'Data Retention Manager', nodeType: 'service' }],
    createdAt: NOW, updatedAt: NOW,
  },
];

const risks = [
  {
    id: 'risk-unencrypted-pii-flows', title: 'Unencrypted PII Transmission Between Internal Systems',
    description: 'Multiple internal data flows transmit patient PII over unencrypted HTTP or unencrypted TCP/1521 connections, including consent updates, classification requests, and database access. An attacker with network access can intercept sensitive health data in transit.',
    status: 'assessed' as const, owner: 'Data Management',
    tierPath: { tier1: 'Privacy Risk', tier2: 'Data Protection', tier3: 'Unencrypted PII Transmission' },
    assetIds: ['asset-patient-database', 'asset-patient-portal', 'asset-consent-manager'],
    diagramLinks: [{ diagramId: 'healthcare-privacy-platform', nodeIds: ['patient-portal', 'patient-database', 'consent-manager', 'data-classifier'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Enforce TLS 1.3 on all internal data flows carrying PII, including Oracle connections and inter-service HTTP calls.',
    threatActorIds: ['ta-organised-crime'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-prechecked-consent', title: 'Pre-checked Consent Boxes Violate GDPR Article 7',
    description: 'Consent collection forms use pre-checked boxes for marketing and analytics processing, which does not constitute freely given consent under GDPR Article 7(2). The 89% consent rate indicates patients are not actively opting in.',
    status: 'assessed' as const, owner: 'Privacy Office',
    tierPath: { tier1: 'Privacy Risk', tier2: 'Consent Management', tier3: 'Pre-checked Consent Boxes' },
    assetIds: ['asset-consent-manager'],
    diagramLinks: [{ diagramId: 'healthcare-privacy-platform', nodeIds: ['consent-manager', 'marketing-platform'] }],
    inherentScore: score('likelihood-5', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Redesign consent forms to require explicit opt-in for each processing purpose; conduct retrospective re-consent campaign.',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-cross-border-transfer', title: 'Inadequate Safeguards for Cross-Border Patient Data Transfers',
    description: 'Patient data is transferred to analytics partners operating from servers in multiple countries, data broker services with offshore backups, and marketing platforms using global CDNs, without adequate GDPR Chapter V safeguards (SCCs, adequacy decisions, or BCRs).',
    status: 'draft' as const, owner: 'Privacy Office',
    tierPath: { tier1: 'Privacy Risk', tier2: 'Cross-Border Transfers', tier3: 'Inadequate Transfer Safeguards' },
    assetIds: ['asset-analytics-partner', 'asset-data-broker'],
    diagramLinks: [{ diagramId: 'healthcare-privacy-platform', nodeIds: ['analytics-partner', 'data-broker', 'cloud-provider', 'marketing-platform'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Execute Standard Contractual Clauses with all processors; conduct Transfer Impact Assessments; implement data residency controls.',
    threatActorIds: ['ta-regulatory'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-dsr-processing-delays', title: 'GDPR Data Subject Request Processing Exceeds Timeframes',
    description: 'Data subject requests take an average of 28 days to process (against a 30-day GDPR deadline), with consent withdrawals taking 72 hours to propagate. Any processing delays or queue backlogs will result in systematic GDPR non-compliance.',
    status: 'assessed' as const, owner: 'Privacy Office',
    tierPath: { tier1: 'Privacy Risk', tier2: 'Data Subject Rights', tier3: 'DSR Processing Delays' },
    assetIds: ['asset-retention-manager', 'asset-patient-database'],
    diagramLinks: [{ diagramId: 'healthcare-privacy-platform', nodeIds: ['data-request-portal', 'retention-manager', 'patient-database'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Automate DSR fulfilment pipeline; reduce processing to under 14 days; implement real-time consent withdrawal propagation.',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-reidentification', title: 'Re-identification Risk in Anonymised Research Data',
    description: 'The anonymisation service retains intermediate datasets for 30-day QA cycles. Combined with the analytics partner receiving weekly bulk exports, there is a material risk that anonymised patient data can be re-identified through linkage attacks, especially given the small population of 100,000 records.',
    status: 'draft' as const, owner: 'Data Management',
    tierPath: { tier1: 'Privacy Risk', tier2: 'Data Protection', tier3: 'Weak Anonymisation' },
    assetIds: ['asset-anonymizer', 'asset-analytics-partner'],
    diagramLinks: [{ diagramId: 'healthcare-privacy-platform', nodeIds: ['anonymizer', 'analytics-partner'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Reduce QA retention to 72 hours; increase k-anonymity threshold; implement differential privacy noise injection.',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-broad-db-access', title: 'Overly Broad Database Access via Service Accounts',
    description: 'Multiple systems (patient portal, privacy scanner, data classifier, compliance engine) access the patient database using service accounts with broad permissions on unencrypted TCP/1521 connections, creating excessive data exposure surface.',
    status: 'assessed' as const, owner: 'Data Management',
    tierPath: { tier1: 'Privacy Risk', tier2: 'Data Protection', tier3: 'Unencrypted PII Transmission' },
    assetIds: ['asset-patient-database', 'asset-patient-portal'],
    diagramLinks: [{ diagramId: 'healthcare-privacy-platform', nodeIds: ['patient-portal', 'privacy-scanner', 'data-classifier', 'patient-database'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Implement least-privilege database roles per application; enable Oracle Database Vault for sensitive columns.',
    threatActorIds: ['ta-insider'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-short-audit-retention', title: 'Insufficient Audit Log Retention for Breach Investigation',
    description: 'Audit logs are retained locally for only 6 months and transmitted via unencrypted syslog. GDPR breach notifications can be triggered by incidents discovered months after the fact, and 6-month retention may be insufficient for forensic investigation.',
    status: 'assessed' as const, owner: 'Compliance',
    tierPath: { tier1: 'Operational Risk', tier2: 'Privacy Monitoring', tier3: 'Short Audit Log Retention' },
    assetIds: ['asset-audit-system'],
    diagramLinks: [{ diagramId: 'healthcare-privacy-platform', nodeIds: ['audit-system', 'patient-database'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Extend retention to 24 months; migrate to encrypted syslog-TLS transport; implement tamper-proof log storage.',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-consent-marketing-leak', title: 'Patient Data Leakage via Marketing Platform',
    description: 'Patient contact data is transferred to the marketing platform over unencrypted HTTP with consent status. The marketing platform replicates data across global CDNs, creating uncontrolled copies of patient contact information outside the GDPR jurisdiction.',
    status: 'draft' as const, owner: 'Privacy Office',
    tierPath: { tier1: 'Privacy Risk', tier2: 'Cross-Border Transfers', tier3: 'Inadequate Transfer Safeguards' },
    assetIds: ['asset-consent-manager'],
    diagramLinks: [{ diagramId: 'healthcare-privacy-platform', nodeIds: ['consent-manager', 'marketing-platform'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Encrypt marketing API connections; implement data minimisation for marketing exports; audit CDN data residency.',
    createdAt: NOW, updatedAt: NOW,
  },
];

const assessments = [
  {
    id: 'assessment-privacy-review', title: 'Healthcare Privacy Platform GDPR Compliance Assessment',
    status: 'in_review' as const,
    owner: 'Data Protection Officer',
    reviewer: 'Chief Privacy Officer',
    startDate: '2025-05-01',
    dueDate: '2025-07-15',
    threatActorIds: ['ta-organised-crime', 'ta-insider', 'ta-regulatory'],
    methodologyNote: 'Assessment follows GDPR Data Protection Impact Assessment (DPIA) methodology under Article 35, supplemented by OWASP privacy controls mapping.',
    assumptionNote: 'Assessment covers production environment as of June 2025. Test and development environments are excluded. Assessment assumes Ollama AI processing remains entirely on-premises.',
    scopeItems: [
      { id: 'scope-system-privacy', type: 'system' as const, value: 'system', name: 'Healthcare Privacy Platform' },
      { id: 'scope-zone-dmz', type: 'diagram_segment' as const, value: 'DMZ', name: 'DMZ Zone' },
      { id: 'scope-zone-compliance', type: 'diagram_segment' as const, value: 'Compliance', name: 'Compliance Zone' },
    ],
    tierFilter: { tier1: 'Privacy Risk' },
    riskManagementPlan: {
      objective: 'Achieve full GDPR compliance for patient data processing activities and eliminate unlawful cross-border transfers.',
      strategy: 'Prioritize consent mechanism remediation and cross-border transfer safeguards, then address data minimisation and retention gaps.',
      residualRiskStatement: 'Residual risk accepted only for low-likelihood scenarios with active compensating controls and DPO oversight.',
      monitoringApproach: 'Bi-weekly review of open actions; monthly compliance dashboard review with CPO.',
      communicationPlan: 'Report to Privacy Steering Committee every two weeks; quarterly board-level privacy risk summary.',
      reviewCadenceDays: 14,
      actions: [
        {
          id: 'rmp-action-consent-redesign',
          title: 'Redesign consent forms to remove pre-checked boxes and implement granular opt-in',
          owner: 'Privacy Office',
          dueDate: '2025-07-01',
          status: 'in_progress' as const,
          linkedRiskIds: ['risk-prechecked-consent'],
          notes: 'UX design review completed; implementation sprint started',
        },
        {
          id: 'rmp-action-scc-execution',
          title: 'Execute Standard Contractual Clauses with all external data processors',
          owner: 'Legal',
          dueDate: '2025-08-01',
          status: 'planned' as const,
          linkedRiskIds: ['risk-cross-border-transfer', 'risk-consent-marketing-leak'],
          notes: 'Legal review of processor agreements in progress',
        },
        {
          id: 'rmp-action-dsr-automation',
          title: 'Automate DSR fulfilment pipeline to achieve sub-14-day processing',
          owner: 'Digital Health',
          dueDate: '2025-07-15',
          status: 'in_progress' as const,
          linkedRiskIds: ['risk-dsr-processing-delays'],
          notes: 'API integration with retention manager underway',
        },
        {
          id: 'rmp-action-tls-internal',
          title: 'Enforce TLS 1.3 on all internal PII data flows',
          owner: 'Data Management',
          dueDate: '2025-08-15',
          status: 'planned' as const,
          linkedRiskIds: ['risk-unencrypted-pii-flows', 'risk-broad-db-access'],
          notes: '',
        },
      ],
      updatedAt: NOW,
    },
    riskIds: risks.map(r => r.id),
    soaGapIds: ['soa-a01', 'soa-a02', 'soa-a04'],
    taskIds: ['task-consent-remediation', 'task-tia-completion', 'task-audit-retention'],
    linkedImplementedControlIds: [],
    linkedInitiativeIds: [],
    summary: 'GDPR compliance assessment of the healthcare privacy platform covering all data processing activities, cross-border transfers, and data subject rights fulfilment. Assessment identified 8 risks, with 3 rated Critical and 3 rated High.',
    findings: 'Key findings include invalid consent mechanisms (pre-checked boxes), unencrypted PII transmission across internal systems, inadequate cross-border transfer safeguards, and DSR processing at the legal time limit.',
    recommendations: 'Immediate remediation of consent collection mechanisms; execute SCCs with all processors; enforce encryption on all PII flows; automate DSR fulfilment.',
    evidenceSummary: 'Evidence package includes DPIA documentation, consent form screenshots, data flow diagrams, and processor agreement inventory.',
    threatModel: {
      nodes: [
        { id: 'tm-node-portal', label: 'Patient Portal', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'patient-portal', position: { x: 50, y: 150 }, nodeType: 'webServer', commentary: 'Direct database access with basic authentication only' },
        { id: 'tm-node-consent', label: 'Consent Management', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'consent-manager', position: { x: 200, y: 150 }, nodeType: 'service', commentary: 'Pre-checked consent boxes; 72-hour withdrawal delay' },
        { id: 'tm-node-gateway', label: 'Privacy Gateway', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'privacy-gateway', position: { x: 350, y: 150 }, nodeType: 'firewall' },
        { id: 'tm-node-database', label: 'Patient Database', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'patient-database', position: { x: 500, y: 150 }, nodeType: 'database', commentary: 'Broad service account access; unencrypted connections' },
        { id: 'tm-node-analytics', label: 'Analytics Partner', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'analytics-partner', position: { x: 650, y: 50 }, nodeType: 'application', commentary: 'Multi-region infrastructure; inadequate DPA' },
        { id: 'tm-node-marketing', label: 'Marketing Platform', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'marketing-platform', position: { x: 650, y: 250 }, nodeType: 'application', commentary: 'Global CDN replication of patient contact data' },
      ],
      edges: [
        { id: 'tm-edge-portal-db', source: 'tm-node-portal', target: 'tm-node-database', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'portal-to-database', label: 'Patient Data Access (TCP/1521 unencrypted)', commentary: 'Direct database access bypassing privacy gateway controls' },
        { id: 'tm-edge-consent-marketing', source: 'tm-node-consent', target: 'tm-node-marketing', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'consent-to-marketing', label: 'Contact Data Transfer (HTTP unencrypted)', commentary: 'Patient PII sent over unencrypted channel to global marketing platform' },
        { id: 'tm-edge-db-analytics', source: 'tm-node-database', target: 'tm-node-analytics', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'patient-database-to-analytics', label: 'Analytics Data Export', commentary: 'Weekly bulk patient data export to multi-region analytics partner' },
      ],
      attackPathDescription: 'Three primary privacy attack vectors identified: (1) Direct unencrypted database access from DMZ patient portal exposes all patient records; (2) Unencrypted consent-to-marketing flow leaks patient PII to global CDN; (3) Bulk data exports to multi-region analytics partner create uncontrolled cross-border transfers.',
      attackPaths: [
        {
          id: 'aap-portal-db-exfil',
          name: 'Patient Portal → Unencrypted DB Access → Patient Record Exfiltration',
          strideCategory: 'Information Disclosure' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'Attacker compromises the patient portal (basic authentication only), then directly accesses the patient database over unencrypted TCP/1521, exfiltrating 100,000+ health records without traversing the privacy gateway.',
          diagramAttackPathId: 'ap-portal-db-exfiltration',
          steps: [
            { order: 1, edgeId: 'portal-to-database', sourceNodeId: 'patient-portal', targetNodeId: 'patient-database', technique: 'T1078: Valid Accounts (service account)' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
        {
          id: 'aap-consent-marketing-leak',
          name: 'Consent Management → Marketing Platform → Global PII Distribution',
          strideCategory: 'Information Disclosure' as StrideCategory,
          riskLevel: 'High' as AttackPathRiskLevel,
          description: 'Patient contact data flows from consent management to marketing platform over unencrypted HTTP. The marketing platform replicates data across global CDNs, creating uncontrolled copies of patient PII outside GDPR jurisdiction.',
          diagramAttackPathId: 'ap-consent-marketing-leak',
          steps: [
            { order: 1, edgeId: 'consent-to-marketing', sourceNodeId: 'consent-manager', targetNodeId: 'marketing-platform', technique: 'T1048: Exfiltration Over Alternative Protocol' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
      ],
      updatedAt: NOW,
    },
    createdAt: NOW, updatedAt: NOW,
  },
];

const soaEntries = [
  {
    id: 'soa-a01', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A01', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Patient portal has direct database access bypassing privacy gateway. Service accounts use broad permissions without role-based access control.',
    mitigatesRiskIds: ['risk-broad-db-access'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'soa-a02', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A02', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Multiple internal PII flows use unencrypted HTTP or TCP/1521. Consent data transmitted without encryption to marketing platform. Database connections lack TLS.',
    mitigatesRiskIds: ['risk-unencrypted-pii-flows', 'risk-consent-marketing-leak'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'soa-a03', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A03', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Privacy gateway provides policy enforcement but data request portal (PHP/Laravel) has minimal input validation on GDPR request forms.',
    mitigatesRiskIds: [],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'soa-a04', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A04', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Architecture allows direct DMZ-to-database connections bypassing privacy gateway. Consent mechanisms use pre-checked boxes by design. 30-day retention on anonymised data creates re-identification risk.',
    mitigatesRiskIds: ['risk-prechecked-consent', 'risk-reidentification'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'soa-a05', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A05', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Privacy scanner and classifier have broad database access. Data broker uses TLS 1.0. Multiple systems connect to Oracle DB without encryption.',
    mitigatesRiskIds: ['risk-broad-db-access', 'risk-unencrypted-pii-flows'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'soa-a07', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A07', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Patient portal uses basic authentication only. Data request portal identity verification is minimal. Service accounts shared across applications.',
    mitigatesRiskIds: ['risk-broad-db-access'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'soa-a09', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A09', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'implemented' as const,
    justification: 'Splunk audit system deployed with Privacy SIEM integration. However, audit logs only retained 6 months locally and transmitted via unencrypted syslog.',
    mitigatesRiskIds: ['risk-short-audit-retention'],
    diagramRefs: [],
    evidence: [
      { id: 'evidence-a09-siem', kind: 'link' as const, name: 'Privacy SIEM Integration Report', url: 'https://compliance.example.local/reports/privacy-siem-config', note: 'Quarterly SIEM configuration review', createdAt: NOW },
    ],
    updatedAt: NOW,
  },
  {
    id: 'soa-cis-03', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.03', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Patient data transmitted unencrypted between internal systems. Cross-border transfers lack adequate safeguards. Anonymisation QA retention creates data protection gaps.',
    mitigatesRiskIds: ['risk-unencrypted-pii-flows', 'risk-cross-border-transfer', 'risk-reidentification'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'soa-cis-05', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.05', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Service accounts with broad database permissions; patient portal basic authentication needs upgrade to MFA.',
    mitigatesRiskIds: ['risk-broad-db-access'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'soa-cis-08', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.08', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'implemented' as const,
    justification: 'Splunk audit log management deployed. 6-month retention insufficient for GDPR forensics; encryption in transit planned.',
    mitigatesRiskIds: ['risk-short-audit-retention'],
    diagramRefs: [],
    evidence: [
      { id: 'evidence-cis08-audit', kind: 'link' as const, name: 'Audit Log Retention Policy', url: 'https://compliance.example.local/docs/retention-policy', note: 'Current retention configuration and planned extension', createdAt: NOW },
    ],
    updatedAt: NOW,
  },
];

const workflowTasks = [
  {
    id: 'task-consent-remediation',
    title: 'Remediate pre-checked consent boxes and implement granular opt-in',
    description: 'Redesign consent collection forms to comply with GDPR Article 7 requirements for freely given, specific, informed, and unambiguous consent.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'critical' as const,
    owner: 'Privacy Office',
    dueDate: '2025-07-01',
    riskId: 'risk-prechecked-consent',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'task-tia-completion',
    title: 'Complete Transfer Impact Assessments for all cross-border data flows',
    description: 'Conduct TIA for analytics partner, data broker, and marketing platform transfers. Execute SCCs where required.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'critical' as const,
    owner: 'Legal',
    dueDate: '2025-08-01',
    riskId: 'risk-cross-border-transfer',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'task-audit-retention',
    title: 'Extend audit log retention to 24 months and migrate to syslog-TLS',
    description: 'Increase Splunk retention from 6 months to 24 months; replace unencrypted syslog with TLS-encrypted transport.',
    type: 'control_implementation' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Compliance',
    dueDate: '2025-08-15',
    controlSetId: CIS_CONTROL_SET_ID,
    controlId: 'CIS.08',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'task-dsr-automation',
    title: 'Automate DSR fulfilment pipeline to sub-14-day processing',
    description: 'Build automated data subject request processing from data request portal through retention manager to patient database.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'high' as const,
    owner: 'Digital Health',
    dueDate: '2025-07-15',
    riskId: 'risk-dsr-processing-delays',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'task-evidence-cis03',
    title: 'Collect evidence for CIS.03 Data Protection control gaps',
    description: 'Document current encryption status across all PII data flows and cross-border transfer mechanisms.',
    type: 'evidence' as const,
    status: 'blocked' as const,
    priority: 'medium' as const,
    owner: 'Data Management',
    dueDate: '2025-07-30',
    controlSetId: CIS_CONTROL_SET_ID,
    controlId: 'CIS.03',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'task-anonymisation-review',
    title: 'Review and strengthen k-anonymity parameters and reduce QA retention',
    description: 'Assess current k-anonymity thresholds for adequacy with 100K record population; reduce QA retention from 30 days to 72 hours.',
    type: 'review' as const,
    status: 'todo' as const,
    priority: 'medium' as const,
    owner: 'Data Management',
    dueDate: '2025-08-01',
    riskId: 'risk-reidentification',
    createdAt: NOW, updatedAt: NOW,
  },
];

const threatActors = [
  {
    id: 'ta-organised-crime', name: 'Medical Data Trafficking Syndicate',
    type: 'organised_crime' as const, capabilityLevel: 4,
    resourceLevel: 'high' as const,
    motivation: 'Financial gain through theft and sale of patient health records, insurance fraud, and identity theft using medical data.',
    description: 'Organised crime group specialising in healthcare data breaches. Targets unencrypted database connections and weak authentication to exfiltrate bulk patient records for sale on dark web medical data markets.',
    targetedAssetIds: ['asset-patient-database', 'asset-patient-portal', 'asset-anonymizer'],
    tags: ['healthcare', 'data-theft', 'financially-motivated'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'ta-insider', name: 'Disgruntled Healthcare Employee',
    type: 'insider' as const, capabilityLevel: 3,
    resourceLevel: 'moderate' as const,
    motivation: 'Personal grievance, financial incentive, or curiosity-driven unauthorised access to patient records by employees with legitimate system access.',
    description: 'Current or former employee with knowledge of broad service account permissions and direct database access paths. Can exploit shared credentials to access patient records beyond their authorised scope.',
    targetedAssetIds: ['asset-patient-database', 'asset-patient-portal', 'asset-audit-system'],
    tags: ['insider-threat', 'privileged-access', 'patient-records'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'ta-regulatory', name: 'Data Protection Authority Enforcement',
    type: 'nation_state' as const, capabilityLevel: 5,
    resourceLevel: 'very_high' as const,
    motivation: 'Regulatory enforcement of GDPR compliance including investigations triggered by patient complaints, cross-border transfer audits, and consent mechanism reviews.',
    description: 'European Data Protection Authorities conducting compliance audits. Not a traditional threat actor but represents regulatory risk from non-compliance with GDPR Articles 6, 7, 44-49, and 15-22. Enforcement can result in fines up to 4% of annual global turnover.',
    targetedAssetIds: ['asset-consent-manager', 'asset-analytics-partner', 'asset-data-broker'],
    tags: ['regulatory', 'gdpr', 'enforcement', 'compliance'],
    createdAt: NOW, updatedAt: NOW,
  },
];

const threatScenarios = [
  {
    id: 'scenario-patient-record-breach', title: 'Patient Record Exfiltration via Unencrypted Database Access',
    description: 'Organised crime group exploits the unencrypted TCP/1521 connection between the patient portal and patient database. Attacker intercepts database traffic or compromises the portal to directly query patient records using the broad service account.',
    threatActorId: 'ta-organised-crime',
    targetedAssetIds: ['asset-patient-database', 'asset-patient-portal'],
    attackTechniques: ['T1078 - Valid Accounts', 'T1040 - Network Sniffing', 'T1005 - Data from Local System'],
    linkedRiskIds: ['risk-unencrypted-pii-flows', 'risk-broad-db-access'],
    likelihood: 'High - unencrypted database connections and broad service account permissions provide direct access path.',
    impact: 'Critical - breach of 100,000+ patient health records triggers mandatory GDPR breach notification, regulatory fines, and severe reputational damage.',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'scenario-gdpr-enforcement', title: 'Regulatory Enforcement for Invalid Consent and Unlawful Transfers',
    description: 'Data Protection Authority investigation triggered by patient complaint reveals pre-checked consent boxes (GDPR Art. 7 violation), inadequate cross-border transfer safeguards (GDPR Art. 44-49), and delayed DSR processing (GDPR Art. 12-15).',
    threatActorId: 'ta-regulatory',
    targetedAssetIds: ['asset-consent-manager', 'asset-analytics-partner', 'asset-data-broker'],
    attackTechniques: ['Regulatory audit', 'Complaint investigation', 'Transfer mechanism review'],
    linkedRiskIds: ['risk-prechecked-consent', 'risk-cross-border-transfer', 'risk-dsr-processing-delays'],
    likelihood: 'Very High - pre-checked consent boxes are a known enforcement priority; 89% consent rate will draw scrutiny.',
    impact: 'Critical - potential fine up to 4% of annual global turnover; mandatory remediation orders; public disclosure of findings.',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'scenario-reidentification-attack', title: 'Patient Re-identification from Anonymised Research Data',
    description: 'Insider or external attacker combines anonymised research datasets (retained for 30-day QA) with publicly available patient data to re-identify individuals. The relatively small population of 100,000 records and weekly bulk exports increase linkage attack feasibility.',
    threatActorId: 'ta-insider',
    targetedAssetIds: ['asset-anonymizer', 'asset-analytics-partner'],
    attackTechniques: ['T1530 - Data from Cloud Storage', 'T1213 - Data from Information Repositories', 'Linkage attack'],
    linkedRiskIds: ['risk-reidentification'],
    likelihood: 'Moderate - requires access to both anonymised and auxiliary datasets, but 30-day retention window is generous.',
    impact: 'Major - re-identification of health data undermines the lawful basis for research processing and triggers GDPR breach obligations.',
    createdAt: NOW, updatedAt: NOW,
  },
];

export const vulnerablePrivacyPlatformGrcWorkspace = buildGrcWorkspace({
  tierCatalogue,
  assets,
  risks,
  assessments,
  soaEntries,
  workflowTasks,
  threatActors,
  threatScenarios,
  thirdParties: [
    {
      id: 'vpp-tp-onetrust',
      name: 'OneTrust',
      description: 'SaaS privacy management platform providing consent management, data subject request (DSR) workflows, cookie compliance, and privacy impact assessment automation for the healthcare platform.',
      category: 'saas' as const,
      status: 'active' as const,
      riskRating: 'high' as const,
      dataClassification: 'confidential' as const,
      linkedAssetIds: ['asset-consent-manager', 'asset-patient-portal'],
      linkedRiskIds: ['risk-prechecked-consent', 'risk-dsr-processing-delays', 'risk-consent-marketing-leak'],
      contactName: 'Amanda Foster',
      contactEmail: 'amanda.foster@onetrust.example.com',
      contractExpiry: '2027-03-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-09-30',
      notes: 'OneTrust Enterprise with Privacy Management, Consent, and DSR modules. Consent collection UI has pre-checked marketing checkboxes violating GDPR Article 7 — OneTrust configuration not OneTrust platform issue. DSR request processing exceeds 30-day GDPR deadline due to manual approval workflows. Consent records stored in OneTrust cloud — cross-border data transfer to US servers requires SCCs. HIPAA BAA in place. SOC 2 Type II and ISO 27701 certified.'
    },
    {
      id: 'vpp-tp-aws',
      name: 'Amazon Web Services (AWS)',
      description: 'Cloud infrastructure provider hosting the healthcare privacy platform including patient databases, portal infrastructure, anonymization services, and audit systems across multiple availability zones.',
      category: 'cloud_provider' as const,
      status: 'active' as const,
      riskRating: 'critical' as const,
      dataClassification: 'restricted' as const,
      linkedAssetIds: ['asset-patient-database', 'asset-patient-portal', 'asset-anonymizer', 'asset-audit-system'],
      linkedRiskIds: ['risk-unencrypted-pii-flows', 'risk-broad-db-access', 'risk-short-audit-retention'],
      contactName: 'AWS Healthcare Support',
      contactEmail: 'healthcare-tam@aws.example.com',
      contractExpiry: '2027-12-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-12-31',
      notes: 'AWS HIPAA-eligible services with signed BAA. Patient database on RDS with broad IAM access policies — 12 roles have full database access where 3 are sufficient. PII flows between services unencrypted in transit within VPC. Audit log retention set to 90 days — below 6-year HIPAA requirement. AWS CloudTrail and GuardDuty enabled but findings not correlated with application-level privacy events. Data residency in us-east-1 — cross-border transfer implications for EU patients.'
    },
    {
      id: 'vpp-tp-informatica',
      name: 'Informatica',
      description: 'SaaS data governance and cataloging platform providing data lineage tracking, sensitive data discovery, data quality management, and metadata management for the healthcare data estate.',
      category: 'saas' as const,
      status: 'active' as const,
      riskRating: 'medium' as const,
      dataClassification: 'confidential' as const,
      linkedAssetIds: ['asset-patient-database', 'asset-anonymizer', 'asset-retention-manager'],
      linkedRiskIds: ['risk-reidentification', 'risk-cross-border-transfer'],
      contactName: 'Deepak Ramanathan',
      contactEmail: 'deepak.ramanathan@informatica.example.com',
      contractExpiry: '2027-01-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-07-31',
      notes: 'Informatica Intelligent Data Management Cloud (IDMC) with Data Governance and Data Quality modules. Scans patient database schemas to discover PHI and PII columns — metadata extracted to Informatica cloud. Data lineage maps show anonymizer re-identification risk where quasi-identifiers persist. Data residency profile flagged cross-border transfers of EU patient data. Processing Agreement in place with SCCs. HIPAA BAA signed. SOC 2 Type II certified.'
    },
    {
      id: 'vpp-tp-veritas',
      name: 'Veritas Technologies',
      description: 'Data retention and information lifecycle management supplier providing NetBackup for healthcare data archival, automated retention policies, and defensible deletion workflows.',
      category: 'supplier' as const,
      status: 'active' as const,
      riskRating: 'medium' as const,
      dataClassification: 'restricted' as const,
      linkedAssetIds: ['asset-retention-manager', 'asset-audit-system'],
      linkedRiskIds: ['risk-short-audit-retention', 'risk-dsr-processing-delays'],
      contactName: 'Catherine Brooks',
      contactEmail: 'catherine.brooks@veritas.example.com',
      contractExpiry: '2026-11-30',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-07-15',
      notes: 'Veritas NetBackup with Information Governance module. Retention policies configured for 6-year HIPAA minimum but audit system retention only set to 90 days — misconfiguration in policy mapping. Defensible deletion workflows do not cover all data subject erasure requests — manual intervention required for backup tape exclusions. Encrypted backups with Veritas-managed keys. HIPAA BAA in place. Annual audit of retention compliance shows 78% policy adherence.'
    },
    {
      id: 'vpp-tp-experian',
      name: 'Experian Health',
      description: 'Data analytics partner providing patient identity verification, demographic enrichment, and population health analytics using de-identified patient datasets.',
      category: 'partner' as const,
      status: 'under_review' as const,
      riskRating: 'high' as const,
      dataClassification: 'restricted' as const,
      linkedAssetIds: ['asset-analytics-partner', 'asset-data-broker'],
      linkedRiskIds: ['risk-cross-border-transfer', 'risk-reidentification', 'risk-consent-marketing-leak'],
      contactName: 'Gregory Palmer',
      contactEmail: 'gregory.palmer@experian.example.com',
      contractExpiry: '2026-09-30',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-06-30',
      notes: 'UNDER REVIEW: Experian Health partnership for patient identity verification and analytics. Cross-border data transfer risk — Experian processes data in US, UK, and Brazil facilities. De-identified datasets shared for population health analytics may be re-identifiable when combined with Experian consumer credit data. Consent basis for data sharing under review — marketing consent leak concern. DPA requires update for Schrems II compliance. Partnership continuation contingent on DPIA completion and legal review of cross-border transfer mechanisms.'
    },
  ],
  securityInitiatives: [
    {
      id: 'vpp-si-consent-remediation', title: 'GDPR Consent Mechanism & Data Minimisation Remediation',
      description: 'Redesign consent collection to remove pre-checked boxes, implement granular opt-in per processing purpose, and enforce data minimisation across all patient data exports to third parties.',
      category: 'compliance' as const, status: 'in_progress' as const, priority: 'critical' as const,
      owner: 'Privacy Office', executiveSponsor: 'Chief Privacy Officer',
      currentState: 'Consent forms use pre-checked boxes with 89% passive consent rate; consent withdrawal takes 72 hours to propagate; marketing platform receives full patient contact data without minimisation.',
      targetState: 'Explicit opt-in per processing purpose with <30% expected consent rate; real-time consent withdrawal propagation within 15 minutes; marketing exports limited to hashed identifiers with consent-gated release.',
      startDate: '2025-06-01', targetDate: '2026-06-30', completedDate: '',
      milestones: [
        { id: 'vpp-ms-consent-01', title: 'Redesign consent forms with explicit opt-in per purpose', description: 'Replace pre-checked consent boxes with granular, purpose-specific opt-in controls compliant with GDPR Article 7(2). Conduct retrospective re-consent campaign.', status: 'in_progress' as const, dueDate: '2025-12-31', completedDate: '', owner: 'Privacy Office' },
        { id: 'vpp-ms-consent-02', title: 'Implement real-time consent withdrawal propagation', description: 'Reduce consent withdrawal delay from 72 hours to under 15 minutes by implementing event-driven consent status updates across all downstream systems.', status: 'pending' as const, dueDate: '2026-03-31', completedDate: '', owner: 'Digital Health' },
        { id: 'vpp-ms-consent-03', title: 'Enforce data minimisation on marketing platform exports', description: 'Replace full patient contact data exports to marketing platform with hashed pseudonymous identifiers and consent-gated data release.', status: 'pending' as const, dueDate: '2026-06-30', completedDate: '', owner: 'Data Management' },
      ],
      linkedRiskIds: ['risk-prechecked-consent', 'risk-consent-marketing-leak', 'risk-dsr-processing-delays'],
      linkedControlSetIds: [],
      linkedAssetIds: ['asset-consent-manager', 'asset-patient-portal', 'asset-retention-manager'],
      linkedImplementedControlIds: ['vpp-ic-dlp'],
      linkedAssessmentIds: ['assessment-privacy-review'],
      notes: 'UX design review completed. Re-consent campaign for 100,000+ patients expected to reduce marketing consent rate from 89% to approximately 25%.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'vpp-si-encryption-crossborder', title: 'PII Encryption & Cross-Border Transfer Safeguards',
      description: 'Enforce end-to-end TLS 1.3 on all internal PII data flows, execute Standard Contractual Clauses with all third-party processors, and implement data residency controls for cross-border transfers.',
      category: 'compliance' as const, status: 'approved' as const, priority: 'high' as const,
      owner: 'Data Management', executiveSponsor: 'Chief Privacy Officer',
      currentState: 'Multiple internal PII flows use unencrypted HTTP or TCP/1521; analytics partner operates from multi-region infrastructure without SCCs; data broker uses TLS 1.0 with offshore backup storage.',
      targetState: 'TLS 1.3 enforced on all internal PII flows; SCCs executed with all external processors; Transfer Impact Assessments completed; data residency controls restricting PII to EU-approved jurisdictions.',
      startDate: '2025-07-01', targetDate: '2026-09-30', completedDate: '',
      milestones: [
        { id: 'vpp-ms-enc-01', title: 'Enforce TLS 1.3 on all Oracle database connections', description: 'Upgrade all application-to-Oracle connections from unencrypted TCP/1521 to TLS 1.3 encrypted connections with mutual certificate authentication.', status: 'in_progress' as const, dueDate: '2026-03-31', completedDate: '', owner: 'Data Management' },
        { id: 'vpp-ms-enc-02', title: 'Execute SCCs with all external data processors', description: 'Complete Standard Contractual Clause execution and Transfer Impact Assessments with DataCorp Analytics, InfoTrack Data Broker, and marketing platform providers.', status: 'pending' as const, dueDate: '2026-09-30', completedDate: '', owner: 'Legal' },
      ],
      linkedRiskIds: ['risk-unencrypted-pii-flows', 'risk-cross-border-transfer', 'risk-broad-db-access'],
      linkedControlSetIds: [],
      linkedAssetIds: ['asset-patient-database', 'asset-analytics-partner', 'asset-data-broker'],
      linkedImplementedControlIds: ['vpp-ic-audit-siem'],
      linkedAssessmentIds: ['assessment-privacy-review'],
      notes: 'Oracle TLS upgrade requires coordinated downtime across 6 application services. Legal has drafted SCC templates for processor agreements.',
      createdAt: NOW, updatedAt: NOW,
    },
  ],
  implementedControls: [
    {
      id: 'vpp-ic-dlp', title: 'Symantec Data Loss Prevention (DLP)',
      description: 'Symantec DLP deployed at network egress points monitoring outbound data flows for PII patterns including patient identifiers, health records, and consent data with automated blocking for policy violations.',
      controlType: 'technical' as const, category: 'monitoring' as const,
      status: 'active' as const, automationLevel: 'semi_automated' as const,
      owner: 'Data Management', vendor: 'Broadcom', product: 'Symantec DLP', version: '16.0',
      implementedDate: '2024-03-01', lastReviewDate: '2025-05-01', nextReviewDate: '2026-05-01',
      linkedSoaEntryIds: ['soa-a02', 'soa-cis-03'],
      linkedRiskIds: ['risk-unencrypted-pii-flows', 'risk-consent-marketing-leak', 'risk-cross-border-transfer'],
      linkedAssetIds: ['asset-patient-database', 'asset-consent-manager', 'asset-analytics-partner'],
      linkedAssessmentIds: ['assessment-privacy-review'],
      notes: 'DLP policies tuned for patient PII patterns. False positive rate at 8% — monthly policy refinement. Does not inspect encrypted database connections (TCP/1521).',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'vpp-ic-audit-siem', title: 'Splunk Privacy SIEM Integration',
      description: 'Splunk audit system with privacy-specific correlation rules monitoring PII access patterns, consent changes, DSR processing timelines, and cross-border data transfer events.',
      controlType: 'technical' as const, category: 'logging' as const,
      status: 'active' as const, automationLevel: 'semi_automated' as const,
      owner: 'Compliance', vendor: 'Splunk', product: 'Enterprise Security', version: '7.3',
      implementedDate: '2023-09-15', lastReviewDate: '2025-06-01', nextReviewDate: '2026-06-01',
      linkedSoaEntryIds: ['soa-a09', 'soa-cis-08'],
      linkedRiskIds: ['risk-short-audit-retention', 'risk-broad-db-access'],
      linkedAssetIds: ['asset-audit-system', 'asset-patient-database'],
      linkedAssessmentIds: ['assessment-privacy-review'],
      notes: 'Audit log retention limited to 6 months locally — extension to 24 months planned. Syslog ingestion via unencrypted UDP — migration to syslog-TLS in progress.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'vpp-ic-anonymisation', title: 'Privacy Analytics K-Anonymity Engine',
      description: 'Privacy Analytics anonymisation engine applying k-anonymity and data masking to patient datasets before research export, with configurable k-value thresholds and quasi-identifier suppression.',
      controlType: 'technical' as const, category: 'encryption' as const,
      status: 'under_review' as const, automationLevel: 'fully_automated' as const,
      owner: 'Data Management', vendor: 'Privacy Analytics', product: 'PARAT', version: '5.2',
      implementedDate: '2024-01-10', lastReviewDate: '2025-04-15', nextReviewDate: '2025-10-15',
      linkedSoaEntryIds: ['soa-a04', 'soa-cis-03'],
      linkedRiskIds: ['risk-reidentification', 'risk-cross-border-transfer'],
      linkedAssetIds: ['asset-anonymizer', 'asset-analytics-partner'],
      linkedAssessmentIds: ['assessment-privacy-review'],
      notes: 'Under review due to 30-day QA retention creating re-identification risk. K-value threshold increase from k=5 to k=10 recommended. Differential privacy noise injection evaluation in progress.',
      createdAt: NOW, updatedAt: NOW,
    },
  ],
});

export const vulnerablePrivacyPlatform: ExampleSystem = {
  id: 'healthcare-privacy-platform',
  name: 'Healthcare Privacy Management Platform',
  description: 'GDPR compliance system for patient data management',
  category: 'Privacy & Data Protection',
  // securityLevel removed - no longer part of the system model
  primaryZone: 'Compliance',
  dataClassification: 'Confidential',
  customContext: `# Healthcare Privacy Management Platform

## System Overview
Our privacy management platform ensures GDPR compliance for over 100,000 patient records across multiple healthcare facilities. The system automates data discovery, consent management, and regulatory reporting while maintaining operational efficiency.

## Architecture Components

### External Integration Layer
- **Analytics Partner**: DataCorp analytics service processes anonymized patient data for population health insights
- **Marketing Platform**: MailChimp integration for patient communication and appointment reminders
- **Data Broker Service**: InfoTrack verification service for address and identity validation

### Patient-Facing Services
- **Patient Portal**: React-based web application allowing patients to access their data and manage preferences
- **Consent Management**: OneTrust platform for collecting and tracking patient consent across all processing activities
- **Data Request Portal**: Self-service portal where patients can submit GDPR data subject requests

### Privacy Management Core
- **Privacy Scanner**: Spirion tool performing regular scans to discover PII across all systems
- **Data Classifier**: Microsoft Purview AI-powered classification of sensitive data elements
- **Data Flow Mapper**: Collibra system tracking data lineage and cross-border transfer mappings
- **Data Anonymizer**: Privacy Analytics k-anonymity engine for research data preparation

### Compliance Infrastructure
- **Patient Database**: Oracle 19c database containing complete electronic health records
- **GDPR Compliance Engine**: TrustArc automated compliance monitoring and gap analysis
- **Audit System**: Splunk platform for comprehensive activity logging and forensics
- **Data Retention Manager**: Custom lifecycle management system for automated data deletion

## Current Configuration

### Data Processing Activities
- Patient portal provides direct access to medical records without additional authentication
- Consent collection occurs through embedded forms with pre-checked consent boxes for operational efficiency
- Analytics partner receives weekly bulk exports of patient data for population health studies
- Marketing communications sent to all patients based on treatment history and demographics

### Cross-Border Data Transfers
- Analytics partner operates from servers in multiple countries for performance optimization
- Data broker service maintains backup copies in offshore data centers for resilience
- Email marketing platform replicates patient contact data across global content delivery networks
- Mobile app data synchronized with cloud providers in various jurisdictions for user experience

### System Integrations
- Privacy scanner has read access to all databases for comprehensive PII discovery
- Data classification engine processes patient records in real-time during clinical workflows
- Anonymization service creates research datasets with 30-day retention for quality assurance
- Compliance engine generates monthly reports aggregating data from all connected systems

### Operational Procedures
- Database connections use service accounts with broad permissions for system integration efficiency
- Audit logs stored locally with 6-month retention to manage storage costs
- Data deletion requests processed within 30 days during regular maintenance windows
- Consent withdrawal takes effect within 72 hours due to system integration complexities

## Performance Metrics
- Average patient portal response time: 2.3 seconds
- Data subject request processing: 28 days average completion time
- Privacy scan coverage: 95% of systems scanned weekly
- Consent collection rate: 89% of patients provide marketing consent
- Data anonymization processing: 10,000 records per hour
- Cross-border transfer volume: 2.5TB monthly to analytics partners

## Recent Updates
- Migrated patient portal to cloud infrastructure for improved scalability
- Integrated new AI-powered data classification to reduce manual review overhead
- Established direct API connections with external partners for real-time data sharing
- Implemented automated consent collection in clinical registration workflows`,

  nodes: [
    // Enhanced Security Zones with proper 650x1000 layout (External → DMZ → Internal → Compliance → Monitoring)
    {
      id: 'external-zone',
      type: 'securityZone',
      position: { x: 50, y: 50 },
      data: {
        label: 'External Zone',
        zoneType: 'External' as SecurityZone,
        description: 'External partners and data processors',
        zone: 'Restricted' as SecurityZone
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.External,
        zIndex: -1
      }
    } as SecurityNode,

    {
      id: 'dmz-zone',
      type: 'securityZone',
      position: { x: 920, y: 50 }, // 50 + 750 + 120
      data: {
        label: 'DMZ Zone',
        zoneType: 'DMZ' as SecurityZone,
        description: 'Patient portal and consent management'
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
      position: { x: 1790, y: 50 }, // 920 + 750 + 120
      data: {
        label: 'Internal Zone',
        zoneType: 'Internal' as SecurityZone,
        description: 'Privacy management and data processing systems'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Internal,
        zIndex: -1
      }
    } as SecurityNode,

    {
      id: 'compliance-zone',
      type: 'securityZone',
      position: { x: 2660, y: 50 }, // 1790 + 750 + 120
      data: {
        label: 'Compliance Zone',
        zoneType: 'Compliance' as SecurityZone,
        description: 'Sensitive patient data and audit systems'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Compliance,
        zIndex: -1
      }
    } as SecurityNode,

    {
      id: 'monitoring-zone',
      type: 'securityZone',
      position: { x: 3530, y: 50 }, // 2660 + 750 + 120
      data: {
        label: 'Monitoring Zone',
        zoneType: 'Critical' as SecurityZone,
        description: 'Privacy monitoring and security oversight'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Critical,
        zIndex: -1
      }
    } as SecurityNode,

    // External Zone Nodes (y: 150-950px tiers)
    {
      id: 'analytics-partner',
      type: 'application',
      position: { x: 375, y: 175 }, // Grid aligned: centered in External zone
      data: {
        label: 'Analytics Partner',
        description: 'Third-party analytics service processing patient data with inadequate data protection agreements',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        vendor: 'DataCorp',
        version: '2.1',
        technology: 'Cloud Analytics',
        securityControls: ['Basic Authentication', 'Data Encryption at Rest', 'Quarterly Security Reviews']
      }
    } as SecurityNode,

    {
      id: 'marketing-platform',
      type: 'application',
      position: { x: 525, y: 275 }, // Grid aligned: left side of External zone
      data: {
        label: 'Marketing Platform',
        description: 'Email marketing service with patient communications using global CDN distribution without adequate safeguards',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        vendor: 'MailChimp',
        version: 'API v3.0',
        technology: 'Email Marketing',
        securityControls: ['OAuth Authentication', 'Data Segmentation', 'Email Encryption']
      }
    } as SecurityNode,

    {
      id: 'data-broker',
      type: 'storage',
      position: { x: 625, y: 825 }, // Grid aligned: right side of External zone
      data: {
        label: 'Data Broker Service',
        description: 'External data enrichment and verification service with offshore backup storage and minimal oversight',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        vendor: 'InfoTrack',
        version: '1.8',
        technology: 'Data Services',
        securityControls: ['API Key Authentication', 'Rate Limiting', 'Data Retention Policies']
      }
    } as SecurityNode,

    {
      id: 'cloud-provider',
      type: 'service',
      position: { x: 375, y: 575 }, // Grid aligned: centered in External zone
      data: {
        label: 'Cloud Service Provider',
        description: 'Multi-region cloud infrastructure hosting with varying data protection standards across jurisdictions',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        vendor: 'AWS',
        version: 'Multi-region',
        technology: 'Cloud Infrastructure',
        securityControls: ['Regional Compliance', 'Data Residency Controls', 'Encryption in Transit']
      }
    } as SecurityNode,

    // DMZ Zone Nodes (y: 150-950px tiers)
    {
      id: 'patient-portal',
      type: 'webServer',
      position: { x: 1575, y: 825 }, // Grid aligned: centered in DMZ zone
      data: {
        label: 'Patient Portal',
        description: 'Web portal for patient data access and consent management with direct database connections bypassing access controls',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'Custom',
        version: '3.1.2',
        technology: 'React/Node.js',
        securityControls: ['Basic Authentication', 'Session Management', 'Input Validation']
      }
    } as SecurityNode,

    {
      id: 'consent-manager',
      type: 'service',
      position: { x: 1025, y: 375 }, // Grid aligned: left side of DMZ zone
      data: {
        label: 'Consent Management',
        description: 'System for collecting and managing patient consent with pre-checked boxes and delayed withdrawal processing',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'OneTrust',
        version: '6.8.0',
        technology: 'Consent Platform',
        securityControls: ['Consent Tracking', 'Audit Logging', 'Withdrawal Processing']
      }
    } as SecurityNode,

    {
      id: 'data-request-portal',
      type: 'webServer',
      position: { x: 925, y: 475 }, // Grid aligned: right side of DMZ zone
      data: {
        label: 'Data Request Portal',
        description: 'Self-service portal for GDPR data subject requests with 30-day processing delays and minimal verification',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'Custom',
        version: '2.3.1',
        technology: 'PHP/Laravel',
        securityControls: ['Request Tracking', 'Identity Verification', 'Response Automation']
      }
    } as SecurityNode,

    {
      id: 'privacy-gateway',
      type: 'firewall',
      position: { x: 1225, y: 675 }, // Grid aligned: centered in DMZ zone
      data: {
        label: 'Privacy Gateway',
        description: 'Data protection gateway with policy enforcement and cross-border transfer monitoring',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        vendor: 'Privacera',
        version: '2.4.1',
        technology: 'Privacy Gateway',
        securityControls: ['Policy Enforcement', 'Data Masking', 'Transfer Monitoring']
      }
    } as SecurityNode,

    // Internal Zone Nodes (y: 150-950px tiers)
    {
      id: 'privacy-scanner',
      type: 'monitor',
      position: { x: 2125, y: 225 }, // Grid aligned: centered in Internal zone
      data: {
        label: 'Privacy Scanner',
        description: 'Automated scanning for PII and sensitive data discovery with broad database access and minimal oversight',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        vendor: 'Spirion',
        version: '9.2.1',
        technology: 'Data Discovery',
        securityControls: ['PII Detection', 'Risk Scoring', 'Remediation Workflows']
      }
    } as SecurityNode,

    {
      id: 'data-classifier',
      type: 'service',
      position: { x: 2475, y: 275 }, // Grid aligned: left side of Internal zone
      data: {
        label: 'Data Classifier',
        description: 'ML-based classification of sensitive data types with real-time processing during clinical workflows',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        vendor: 'Microsoft',
        version: 'Purview 2023.1',
        technology: 'AI Classification',
        securityControls: ['ML Classification', 'Confidence Scoring', 'Manual Review Workflows']
      }
    } as SecurityNode,

    {
      id: 'data-mapper',
      type: 'service',
      position: { x: 2225, y: 425 }, // Grid aligned: right side of Internal zone
      data: {
        label: 'Data Flow Mapper',
        description: 'Tracks data lineage and cross-border transfers with limited visibility into external partner processing',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        vendor: 'Collibra',
        version: '2022.10',
        technology: 'Data Lineage',
        securityControls: ['Lineage Tracking', 'Transfer Mapping', 'Compliance Reporting']
      }
    } as SecurityNode,

    {
      id: 'anonymizer',
      type: 'service',
      position: { x: 2075, y: 575 }, // Grid aligned: centered in Internal zone
      data: {
        label: 'Data Anonymizer',
        description: 'Pseudonymization and anonymization of patient data with 30-day quality assurance retention creating re-identification risks',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'Privacy Analytics',
        version: '4.1.3',
        technology: 'K-Anonymity',
        securityControls: ['K-Anonymity Processing', 'Differential Privacy', 'Risk Assessment']
      }
    } as SecurityNode,

    // Compliance Zone Nodes (y: 150-950px tiers)
    {
      id: 'patient-database',
      type: 'database',
      position: { x: 2975, y: 175 }, // Grid aligned: centered in Compliance zone
      data: {
        label: 'Patient Database',
        description: 'Primary database containing all patient records with service account access using broad permissions',
        zone: 'Compliance' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'Oracle',
        version: '19c',
        technology: 'Oracle Database',
        securityControls: ['Database Encryption', 'Access Logging', 'Backup Protection']
      }
    } as SecurityNode,

    {
      id: 'gdpr-compliance',
      type: 'service',
      position: { x: 2775, y: 375 }, // Grid aligned: left side of Compliance zone
      data: {
        label: 'GDPR Compliance Engine',
        description: 'Automated compliance monitoring and reporting with monthly aggregated analysis and gap identification',
        zone: 'Compliance' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'TrustArc',
        version: '2023.2',
        technology: 'Compliance Management',
        securityControls: ['Compliance Monitoring', 'Gap Analysis', 'Automated Reporting']
      }
    } as SecurityNode,

    {
      id: 'audit-system',
      type: 'monitor',
      position: { x: 3325, y: 175 }, // Grid aligned: right side of Compliance zone
      data: {
        label: 'Audit System',
        description: 'Comprehensive logging of all data access and changes with 6-month local retention limiting forensic capabilities',
        zone: 'Compliance' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'Splunk',
        version: '9.0.1',
        technology: 'Log Management',
        securityControls: ['Activity Logging', 'Log Analysis', 'Alerting Rules']
      }
    } as SecurityNode,

    {
      id: 'retention-manager',
      type: 'service',
      position: { x: 3325, y: 425 }, // Grid aligned: centered in Compliance zone
      data: {
        label: 'Data Retention Manager',
        description: 'Automated data lifecycle and deletion management with 30-day processing delays during maintenance windows',
        zone: 'Compliance' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        vendor: 'Custom',
        version: '1.4.2',
        technology: 'Lifecycle Management',
        securityControls: ['Retention Policies', 'Automated Deletion', 'Compliance Verification']
      }
    } as SecurityNode,

    // Enhanced Privacy Monitoring in Monitoring Zone
    {
      id: 'privacy-siem',
      type: 'monitor',
      position: { x: 3825, y: 175 }, // Grid aligned: centered in Monitoring zone
      data: {
        label: 'Privacy SIEM',
        description: 'Specialized SIEM for privacy violations and data protection monitoring with real-time alerting',
        vendor: 'Exabeam',
        product: 'Privacy SIEM',
        version: '5.1.2',
        zone: 'Critical' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'Syslog', 'CEF'],
        securityControls: ['Privacy Monitoring', 'Violation Detection', 'Compliance Alerting']
      }
    } as SecurityNode,

    {
      id: 'dpo-dashboard',
      type: 'monitor',
      position: { x: 3575, y: 525 }, // Grid aligned: left side of Monitoring zone
      data: {
        label: 'Data Protection Officer Dashboard',
        description: 'Centralized dashboard for privacy compliance oversight and breach response coordination',
        vendor: 'OneTrust',
        product: 'DPO Dashboard',
        version: '7.2.1',
        zone: 'Critical' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'REST API', 'SAML'],
        securityControls: ['Compliance Tracking', 'Breach Management', 'Risk Assessment']
      }
    } as SecurityNode,

    {
      id: 'privacy-risk-engine',
      type: 'monitor',
      position: { x: 4025, y: 375 }, // Grid aligned: right side of Monitoring zone
      data: {
        label: 'Privacy Risk Assessment Engine',
        description: 'Automated privacy impact assessment and risk scoring for data processing activities',
        vendor: 'TrustArc',
        product: 'Privacy Risk Engine',
        version: '3.4.1',
        zone: 'Critical' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'API Gateway', 'LDAP'],
        securityControls: ['Risk Scoring', 'Impact Assessment', 'Mitigation Recommendations']
      }
    } as SecurityNode,

    {
      id: 'consent-analytics',
      type: 'monitor',
      position: { x: 3575, y: 925 }, // Grid aligned: centered in Monitoring zone
      data: {
        label: 'Consent Analytics Platform',
        description: 'Advanced analytics for consent management and withdrawal tracking with predictive modeling',
        vendor: 'Cookiebot',
        product: 'Consent Analytics',
        version: '2.8.3',
        zone: 'Critical' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'GraphQL', 'WebSocket'],
        securityControls: ['Consent Tracking', 'Predictive Analytics', 'Compliance Reporting']
      }
    } as SecurityNode
  ],

  edges: [
    // External data flows and cross-border transfers
    {
      id: 'patient-database-to-analytics',
      source: 'patient-database',
      target: 'analytics-partner',
      sourceHandle: 'left',
      targetHandle: 'right',
      type: 'securityEdge',
      data: {
        controlPoints: [
          { id: 'cp-1771653267355', x: 2750, y: 0, active: true },
          { id: 'cp-1771653275682', x: 700, y: 0, active: true }
        ],
        label: 'Analytics Data Export',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        description: 'Patient data for analytics with inadequate safeguards',
        zone: 'External' as SecurityZone
      }
    } as SecurityEdge,

    {
      id: 'consent-to-marketing',
      source: 'consent-manager',
      target: 'marketing-platform',
      sourceHandle: 'left',
      targetHandle: 'right',
      type: 'securityEdge',
      data: {
        label: 'Contact Data Transfer',
        protocol: 'HTTP',
        encryption: 'none',
        description: 'Patient contact information with consent status',
        zone: 'External' as SecurityZone
      }
    } as SecurityEdge,

    {
      id: 'portal-to-broker',
      source: 'patient-portal',
      target: 'data-broker',
      sourceHandle: 'left',
      targetHandle: 'right',
      type: 'securityEdge',
      data: {
        label: 'Verification Request',
        protocol: 'HTTPS',
        encryption: 'TLS 1.0',
        description: 'Identity verification with weak encryption',
        zone: 'External' as SecurityZone
      }
    } as SecurityEdge,

    {
      id: 'cloud-to-analytics',
      source: 'cloud-provider',
      target: 'analytics-partner',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      type: 'securityEdge',
      data: {
        label: 'Multi-region Data Sync',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        description: 'Cross-jurisdictional data replication',
        zone: 'External' as SecurityZone
      }
    } as SecurityEdge,

    // DMZ flows and user interactions
    {
      id: 'portal-to-consent',
      source: 'patient-portal',
      target: 'consent-manager',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      type: 'securityEdge',
      data: {
        label: 'Consent Updates',
        protocol: 'HTTP',
        encryption: 'none',
        description: 'Patient consent modifications',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,

    {
      id: 'request-portal-to-gateway',
      source: 'data-request-portal',
      target: 'privacy-gateway',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      type: 'securityEdge',
      data: {
        label: 'GDPR Request Processing',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        description: 'Data subject request validation',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,

    {
      id: 'gateway-to-scanner',
      source: 'privacy-gateway',
      target: 'privacy-scanner',
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'securityEdge',
      data: {
        label: 'Data Discovery Request',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        description: 'Privacy policy enforcement',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,

    // Internal privacy processing flows
    {
      id: 'scanner-to-classifier',
      source: 'privacy-scanner',
      target: 'data-classifier',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      type: 'securityEdge',
      data: {
        label: 'Classification Request',
        protocol: 'HTTP',
        encryption: 'none',
        description: 'PII data for ML classification',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,

    {
      id: 'classifier-to-mapper',
      source: 'data-classifier',
      target: 'data-mapper',
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'securityEdge',
      data: {
        label: 'Lineage Mapping',
        protocol: 'HTTP',
        encryption: 'none',
        description: 'Classified data for lineage tracking',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,

    {
      id: 'mapper-to-anonymizer',
      source: 'data-mapper',
      target: 'anonymizer',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      type: 'securityEdge',
      data: {
        label: 'Anonymization Request',
        protocol: 'HTTP',
        encryption: 'none',
        description: 'Data for anonymization processing',
        zone: 'Internal' as SecurityZone
      }
    } as SecurityEdge,

    // Database connections with vulnerabilities
    {
      id: 'portal-to-database',
      source: 'patient-portal',
      target: 'patient-database',
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'securityEdge',
      data: {
        controlPoints: [{ id: 'cp-1771653297135', x: 3000, y: 850, active: true }],
        label: 'Patient Data Access',
        protocol: 'TCP/1521',
        encryption: 'none',
        description: 'Direct database access without additional auth',
        zone: 'Compliance' as SecurityZone
      }
    } as SecurityEdge,

    {
      id: 'scanner-to-database',
      source: 'privacy-scanner',
      target: 'patient-database',
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'securityEdge',
      data: {
        label: 'Full Database Scan',
        protocol: 'TCP/1521',
        encryption: 'none',
        description: 'Broad database access for PII scanning',
        zone: 'Compliance' as SecurityZone
      }
    } as SecurityEdge,

    {
      id: 'classifier-to-database',
      source: 'data-classifier',
      target: 'patient-database',
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'securityEdge',
      data: {
        label: 'Real-time Classification',
        protocol: 'TCP/1521',
        encryption: 'none',
        description: 'Live data classification during workflows',
        zone: 'Compliance' as SecurityZone
      }
    } as SecurityEdge,

    // Compliance monitoring and audit flows
    {
      id: 'compliance-to-database',
      source: 'gdpr-compliance',
      target: 'patient-database',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      type: 'securityEdge',
      data: {
        label: 'Compliance Verification',
        protocol: 'TCP/1521',
        encryption: 'none',
        description: 'Monthly compliance checks',
        zone: 'Compliance' as SecurityZone
      }
    } as SecurityEdge,

    {
      id: 'consent-to-compliance',
      source: 'consent-manager',
      target: 'gdpr-compliance',
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'securityEdge',
      data: {
        label: 'Consent Status Feed',
        protocol: 'HTTP',
        encryption: 'none',
        description: 'Consent withdrawal processing delays',
        zone: 'Compliance' as SecurityZone
      }
    } as SecurityEdge,

    {
      id: 'database-to-audit',
      source: 'patient-database',
      target: 'audit-system',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      type: 'securityEdge',
      data: {
        label: 'Access Logs',
        protocol: 'Syslog',
        encryption: 'none',
        description: 'Unencrypted audit logs with 6-month retention',
        zone: 'Compliance' as SecurityZone
      }
    } as SecurityEdge,

    {
      id: 'retention-to-database',
      source: 'retention-manager',
      target: 'patient-database',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      type: 'securityEdge',
      data: {
        label: 'Data Deletion',
        protocol: 'TCP/1521',
        encryption: 'none',
        description: '30-day deletion processing delays',
        zone: 'Compliance' as SecurityZone
      }
    } as SecurityEdge,

    // Data anonymization and export flows
    {
      id: 'anonymizer-to-analytics',
      source: 'anonymizer',
      target: 'analytics-partner',
      sourceHandle: 'left',
      targetHandle: 'right',
      type: 'securityEdge',
      data: {
        label: 'Anonymized Data Export',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        description: 'Anonymized data with re-identification risks',
        zone: 'External' as SecurityZone
      }
    } as SecurityEdge,

    // Enhanced privacy monitoring connections
    {
      id: 'audit-to-privacy-siem',
      source: 'audit-system',
      target: 'privacy-siem',
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'securityEdge',
      data: {
        label: 'Privacy Event Stream',
        protocol: 'Syslog/TLS',
        encryption: 'TLS 1.3',
        description: 'Real-time privacy violation monitoring',
        zone: 'Critical' as SecurityZone
      }
    } as SecurityEdge,

    {
      id: 'compliance-to-dpo',
      source: 'gdpr-compliance',
      target: 'dpo-dashboard',
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'securityEdge',
      data: {
        controlPoints: [{ id: 'cp-1771653250278', x: 2800, y: 550, active: true }],
        label: 'Compliance Reporting',
        protocol: 'REST API',
        encryption: 'TLS 1.3',
        description: 'Compliance status and gap analysis',
        zone: 'Critical' as SecurityZone
      }
    } as SecurityEdge,

    {
      id: 'privacy-siem-to-risk-engine',
      source: 'privacy-siem',
      target: 'privacy-risk-engine',
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'securityEdge',
      data: {
        label: 'Risk Assessment Feed',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        description: 'Automated privacy risk scoring',
        zone: 'Critical' as SecurityZone
      }
    } as SecurityEdge,

    {
      id: 'consent-to-analytics',
      source: 'consent-manager',
      target: 'consent-analytics',
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'securityEdge',
      data: {
        controlPoints: [
          { id: 'cp-1771653184096', x: 1050, y: 1100, active: true },
          { id: 'cp-1771653203676', x: 3350, y: 1100, active: true }
        ],
        label: 'Consent Analytics',
        protocol: 'GraphQL',
        encryption: 'TLS 1.3',
        description: 'Consent pattern analysis and predictions',
        zone: 'Critical' as SecurityZone
      }
    } as SecurityEdge,

    {
      id: 'risk-engine-to-dpo',
      source: 'privacy-risk-engine',
      target: 'dpo-dashboard',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      type: 'securityEdge',
      data: {
        label: 'Risk Alerts',
        protocol: 'WebSocket',
        encryption: 'TLS 1.3',
        description: 'Real-time privacy risk notifications',
        zone: 'Critical' as SecurityZone
      }
    } as SecurityEdge
  ],

  grcWorkspace: vulnerablePrivacyPlatformGrcWorkspace,

  attackPaths: [
    {
      id: 'ap-portal-db-exfiltration',
      name: 'Patient Portal → Direct DB Access → Health Record Exfiltration',
      strideCategory: 'Information Disclosure',
      riskLevel: 'Critical',
      description: 'An attacker compromises the patient portal (which uses only basic authentication), then exploits the direct unencrypted TCP/1521 connection to the patient database, bypassing the privacy gateway entirely. The broad service account permissions allow full read access to 100,000+ patient health records.',
      steps: [
        {
          order: 1,
          edgeId: 'portal-to-database',
          sourceNodeId: 'patient-portal',
          targetNodeId: 'patient-database',
          technique: 'T1078: Valid Accounts (broad service account)',
        },
        {
          order: 2,
          edgeId: 'patient-database-to-analytics',
          sourceNodeId: 'patient-database',
          targetNodeId: 'analytics-partner',
          technique: 'T1048: Exfiltration Over Alternative Protocol',
        },
      ],
      mitreTechniques: ['T1078', 'T1048'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-consent-marketing-leak',
      name: 'Consent Management → Unencrypted Marketing Export → Global PII Distribution',
      strideCategory: 'Information Disclosure',
      riskLevel: 'High',
      description: 'Patient contact data is transferred from the consent management system to the external marketing platform over an unencrypted HTTP connection. The marketing platform then replicates this patient PII across global CDN nodes, creating uncontrolled copies of sensitive data outside GDPR jurisdiction without adequate transfer safeguards.',
      steps: [
        {
          order: 1,
          edgeId: 'portal-to-consent',
          sourceNodeId: 'patient-portal',
          targetNodeId: 'consent-manager',
          technique: 'T1530: Data from Cloud Storage Object',
        },
        {
          order: 2,
          edgeId: 'consent-to-marketing',
          sourceNodeId: 'consent-manager',
          targetNodeId: 'marketing-platform',
          technique: 'T1048: Exfiltration Over Alternative Protocol',
        },
      ],
      mitreTechniques: ['T1530', 'T1048'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-anonymizer-reidentification',
      name: 'Data Flow Mapper → Anonymizer → Analytics Partner Re-identification Chain',
      strideCategory: 'Information Disclosure',
      riskLevel: 'High',
      description: 'Patient data flows through the data mapper to the anonymizer over unencrypted HTTP connections. The anonymizer retains intermediate datasets for 30-day QA cycles, and exports to the analytics partner with re-identification risks. An attacker with access to the analytics partner infrastructure can combine anonymised exports with auxiliary data to re-identify patients from the small 100,000-record population.',
      steps: [
        {
          order: 1,
          edgeId: 'mapper-to-anonymizer',
          sourceNodeId: 'data-mapper',
          targetNodeId: 'anonymizer',
          technique: 'T1557: Adversary-in-the-Middle',
        },
        {
          order: 2,
          edgeId: 'anonymizer-to-analytics',
          sourceNodeId: 'anonymizer',
          targetNodeId: 'analytics-partner',
          technique: 'T1213: Data from Information Repositories',
        },
      ],
      mitreTechniques: ['T1557', 'T1213'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-scanner-db-pivot',
      name: 'Privacy Scanner Compromise → Database Pivot → Audit Evasion',
      strideCategory: 'Elevation of Privilege',
      riskLevel: 'Critical',
      description: 'An attacker compromises the privacy scanner which has broad read access to the patient database for PII discovery. Using the unencrypted TCP/1521 database connection and overly permissive service account, the attacker accesses the full patient database. Audit logs transmitted via unencrypted syslog with only 6-month retention limit forensic investigation capabilities.',
      steps: [
        {
          order: 1,
          edgeId: 'gateway-to-scanner',
          sourceNodeId: 'privacy-gateway',
          targetNodeId: 'privacy-scanner',
          technique: 'T1190: Exploit Public-Facing Application',
        },
        {
          order: 2,
          edgeId: 'scanner-to-database',
          sourceNodeId: 'privacy-scanner',
          targetNodeId: 'patient-database',
          technique: 'T1078: Valid Accounts (scanner service account)',
        },
        {
          order: 3,
          edgeId: 'database-to-audit',
          sourceNodeId: 'patient-database',
          targetNodeId: 'audit-system',
          technique: 'T1070: Indicator Removal (short retention limits forensics)',
        },
      ],
      mitreTechniques: ['T1190', 'T1078', 'T1070'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
  ],
};