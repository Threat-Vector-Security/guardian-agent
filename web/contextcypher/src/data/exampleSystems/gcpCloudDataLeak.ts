import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityEdge, SecurityNode, SecurityZone } from '../../types/SecurityTypes';
import { DiagramAttackPath, AssessmentThreatModelNodeSourceType, AssessmentThreatModelEdgeSourceType, AttackPathRiskLevel } from '../../types/GrcTypes';
import { colors } from '../../styles/Theme';
import { buildGrcWorkspace, score, NOW, OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID, GrcSystemData } from './grcSharedBase';
import { StrideCategory } from '../../types/ThreatIntelTypes';

const tierCatalogue = [
  { id: 'tier1-cyber', tier: 1 as const, label: 'Cyber Risk', description: 'Information security and cyber threats' },
  { id: 'tier1-operational', tier: 1 as const, label: 'Operational Risk', description: 'Business operations and process risks' },
  { id: 'tier2-identity', tier: 2 as const, label: 'Identity & Access', parentId: 'tier1-cyber', description: 'Authentication and authorization controls' },
  { id: 'tier2-data', tier: 2 as const, label: 'Data Protection', parentId: 'tier1-cyber', description: 'Data-at-rest and data-in-transit protection' },
  { id: 'tier2-cloud-config', tier: 2 as const, label: 'Cloud Configuration', parentId: 'tier1-cyber', description: 'Cloud service misconfiguration risks' },
  { id: 'tier2-monitoring', tier: 2 as const, label: 'Security Monitoring', parentId: 'tier1-operational', description: 'Logging, detection, and response' },
  { id: 'tier2-supply-chain', tier: 2 as const, label: 'Supply Chain', parentId: 'tier1-cyber', description: 'Third-party and container image risks' },
  { id: 'tier3-overprivileged-sa', tier: 3 as const, label: 'Overprivileged Service Accounts', parentId: 'tier2-identity' },
  { id: 'tier3-sa-key-leakage', tier: 3 as const, label: 'Service Account Key Leakage', parentId: 'tier2-identity' },
  { id: 'tier3-public-storage', tier: 3 as const, label: 'Public Cloud Storage', parentId: 'tier2-data' },
  { id: 'tier3-open-dataset', tier: 3 as const, label: 'Overly Permissive Dataset Access', parentId: 'tier2-data' },
  { id: 'tier3-unencrypted-db', tier: 3 as const, label: 'Unencrypted Database Connections', parentId: 'tier2-data' },
  { id: 'tier3-vpc-perimeter-gap', tier: 3 as const, label: 'VPC Service Controls Gap', parentId: 'tier2-cloud-config' },
  { id: 'tier3-dlp-disabled', tier: 3 as const, label: 'DLP Scanning Disabled', parentId: 'tier2-cloud-config' },
  { id: 'tier3-logging-sink-failure', tier: 3 as const, label: 'Silent Logging Sink Failure', parentId: 'tier2-monitoring' },
  { id: 'tier3-unsigned-images', tier: 3 as const, label: 'Unsigned Container Images', parentId: 'tier2-supply-chain' },
];

const assets = [
  {
    id: 'asset-bigquery', name: 'BigQuery Analytics Warehouse', type: 'database', owner: 'Data Engineering',
    domain: 'application' as const, category: 'Data Warehouse',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Central BigQuery dataset containing customer telemetry, behavioural analytics, and PII',
    criticality: { confidentiality: 5, integrity: 5, availability: 4, financial: 5, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'gcp-cloud-data-leak', nodeId: 'bigquery-warehouse', nodeLabel: 'BigQuery', nodeType: 'gcpBigQuery' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-cloud-storage', name: 'GCS Landing Bucket', type: 'cloud_storage', owner: 'Data Engineering',
    domain: 'it' as const, category: 'Cloud Infrastructure',
    businessCriticality: 4, securityCriticality: 4,
    description: 'Cloud Storage bucket receiving raw JSON telemetry before ETL; retains legacy public-read ACLs',
    criticality: { confidentiality: 4, integrity: 3, availability: 3, financial: 3, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'gcp-cloud-data-leak', nodeId: 'gcp-storage-bucket', nodeLabel: 'Cloud Storage', nodeType: 'gcpCloudStorage' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-cloud-run', name: 'Cloud Run Telemetry API', type: 'application_server', owner: 'Platform Engineering',
    domain: 'application' as const, category: 'API Service',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Cloud Run service ingesting HTTPS telemetry events; runs with default service account holding Editor role',
    criticality: { confidentiality: 4, integrity: 5, availability: 5, financial: 4, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'gcp-cloud-data-leak', nodeId: 'cloud-run-api', nodeLabel: 'Cloud Run', nodeType: 'gcpCloudRun' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-cloud-sql', name: 'Cloud SQL PostgreSQL', type: 'database', owner: 'Platform Engineering',
    domain: 'application' as const, category: 'Database',
    businessCriticality: 4, securityCriticality: 5,
    description: 'Cloud SQL instance storing application state; public IP enabled and SSL enforcement disabled',
    criticality: { confidentiality: 5, integrity: 5, availability: 4, financial: 4, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'gcp-cloud-data-leak', nodeId: 'cloud-sql', nodeLabel: 'Cloud SQL', nodeType: 'gcpCloudSQL' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-cloud-iam', name: 'Cloud IAM & Service Accounts', type: 'security_control', owner: 'Security Operations',
    domain: 'it' as const, category: 'Identity Infrastructure',
    businessCriticality: 5, securityCriticality: 5,
    description: 'IAM bindings and service accounts with JSON keys committed to source control; no key rotation policy',
    criticality: { confidentiality: 5, integrity: 5, availability: 3, financial: 4, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'gcp-cloud-data-leak', nodeId: 'cloud-iam', nodeLabel: 'Cloud IAM', nodeType: 'gcpIAM' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-vertex-ai', name: 'Vertex AI Notebooks', type: 'application_server', owner: 'Data Science',
    domain: 'application' as const, category: 'ML Platform',
    businessCriticality: 3, securityCriticality: 4,
    description: 'Managed notebooks running with custom service account; keys stored in /home/jupyter; idle shutdown disabled',
    criticality: { confidentiality: 4, integrity: 3, availability: 2, financial: 3, reputation: 3, safety: 1 },
    diagramRefs: [{ diagramId: 'gcp-cloud-data-leak', nodeId: 'vertex-ai', nodeLabel: 'Vertex AI', nodeType: 'gcpVertexAI' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-cloud-logging', name: 'Cloud Logging & Audit', type: 'security_tool', owner: 'Security Operations',
    domain: 'it' as const, category: 'Security Tools',
    businessCriticality: 4, securityCriticality: 4,
    description: 'Cloud Logging sink exporting audit logs to a deleted project causing silent ingestion failures',
    criticality: { confidentiality: 3, integrity: 4, availability: 4, financial: 2, reputation: 3, safety: 1 },
    diagramRefs: [{ diagramId: 'gcp-cloud-data-leak', nodeId: 'cloud-logging', nodeLabel: 'Cloud Logging', nodeType: 'gcpCloudLogging' }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'asset-gke', name: 'GKE Autopilot Cluster', type: 'application_server', owner: 'Platform Engineering',
    domain: 'it' as const, category: 'Container Orchestration',
    businessCriticality: 4, securityCriticality: 4,
    description: 'GKE cluster running Kafka-to-BigQuery connectors; workload identity disabled and SA keys stored on disk',
    criticality: { confidentiality: 4, integrity: 4, availability: 4, financial: 3, reputation: 3, safety: 1 },
    diagramRefs: [{ diagramId: 'gcp-cloud-data-leak', nodeId: 'gke-stream', nodeLabel: 'GKE', nodeType: 'gcpGKE' }],
    createdAt: NOW, updatedAt: NOW,
  },
];

const risks = [
  {
    id: 'risk-bigquery-allauthenticated', title: 'BigQuery Dataset Shared with allAuthenticatedUsers',
    description: 'The central analytics dataset is shared with allAuthenticatedUsers, allowing any Google account holder to query customer telemetry and PII. Data Studio connectors trigger exports without row-level policies.',
    status: 'assessed' as const, owner: 'Data Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Data Protection', tier3: 'Overly Permissive Dataset Access' },
    assetIds: ['asset-bigquery'],
    diagramLinks: [{ diagramId: 'gcp-cloud-data-leak', nodeIds: ['bigquery-warehouse'] }],
    inherentScore: score('likelihood-5', 'impact-5'),
    treatmentStrategy: 'mitigate' as const,
    treatmentPlan: 'Remove allAuthenticatedUsers binding; implement column-level security and authorised views',
    threatActorIds: ['threat-actor-data-broker'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-storage-public-acl', title: 'Cloud Storage Bucket with Public Read ACL',
    description: 'Legacy public-read ACLs on the landing bucket expose raw JSON telemetry containing PII to anyone with the bucket URL.',
    status: 'assessed' as const, owner: 'Data Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Data Protection', tier3: 'Public Cloud Storage' },
    assetIds: ['asset-cloud-storage'],
    diagramLinks: [{ diagramId: 'gcp-cloud-data-leak', nodeIds: ['gcp-storage-bucket'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const,
    treatmentPlan: 'Remove public ACL; enforce uniform bucket-level access with organisation policy constraint',
    threatActorIds: ['threat-actor-opportunistic'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-editor-service-account', title: 'Cloud Run Default Service Account with Editor Role',
    description: 'Cloud Run API service uses the default Compute Engine service account which has project-wide Editor role, granting broad read/write access to all project resources.',
    status: 'draft' as const, owner: 'Platform Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Identity & Access', tier3: 'Overprivileged Service Accounts' },
    assetIds: ['asset-cloud-run', 'asset-cloud-iam'],
    diagramLinks: [{ diagramId: 'gcp-cloud-data-leak', nodeIds: ['cloud-run-api', 'cloud-iam'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const,
    treatmentPlan: 'Create dedicated service account with least-privilege IAM bindings for Cloud Run',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-sa-keys-in-source', title: 'Service Account JSON Keys Committed to Source Control',
    description: 'IAM service account keys are downloaded as JSON files and committed to the source repository, allowing anyone with repository access to impersonate the service account.',
    status: 'draft' as const, owner: 'Security Operations',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Identity & Access', tier3: 'Service Account Key Leakage' },
    assetIds: ['asset-cloud-iam', 'asset-gke'],
    diagramLinks: [{ diagramId: 'gcp-cloud-data-leak', nodeIds: ['cloud-iam', 'gke-stream'] }],
    inherentScore: score('likelihood-5', 'impact-5'),
    treatmentStrategy: 'mitigate' as const,
    treatmentPlan: 'Purge keys from repository history; enable Workload Identity Federation; disable SA key creation via org policy',
    threatActorIds: ['threat-actor-insider'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-cloudsql-public-ip', title: 'Cloud SQL Public IP with SSL Disabled',
    description: 'Cloud SQL PostgreSQL instance has a public IP and SSL enforcement is disabled. Connections from Cloud Run traverse the public internet without encryption.',
    status: 'assessed' as const, owner: 'Platform Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Data Protection', tier3: 'Unencrypted Database Connections' },
    assetIds: ['asset-cloud-sql', 'asset-cloud-run'],
    diagramLinks: [{ diagramId: 'gcp-cloud-data-leak', nodeIds: ['cloud-sql', 'cloud-run-api'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const,
    treatmentPlan: 'Enable SSL enforcement on Cloud SQL; migrate to private IP with Cloud SQL Auth Proxy',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-vpc-perimeter-excluded', title: 'Analytics Project Excluded from VPC Service Controls Perimeter',
    description: 'The analytics project is excluded from the VPC Service Controls perimeter to avoid breaking data scientist workflows, creating an exfiltration path for BigQuery data.',
    status: 'assessed' as const, owner: 'Security Operations',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Cloud Configuration', tier3: 'VPC Service Controls Gap' },
    assetIds: ['asset-bigquery', 'asset-cloud-storage'],
    diagramLinks: [{ diagramId: 'gcp-cloud-data-leak', nodeIds: ['vpc-service-controls', 'bigquery-warehouse', 'gcp-storage-bucket'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const,
    treatmentPlan: 'Add analytics project to perimeter with ingress/egress rules for approved workflows',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-logging-sink-broken', title: 'Silent Cloud Logging Sink Failure',
    description: 'Cloud Logging sink exports to a deleted project causing all audit log ingestion to fail silently. Security events go undetected.',
    status: 'draft' as const, owner: 'Security Operations',
    tierPath: { tier1: 'Operational Risk', tier2: 'Security Monitoring', tier3: 'Silent Logging Sink Failure' },
    assetIds: ['asset-cloud-logging'],
    diagramLinks: [{ diagramId: 'gcp-cloud-data-leak', nodeIds: ['cloud-logging', 'security-command-center'] }],
    inherentScore: score('likelihood-5', 'impact-4'),
    treatmentStrategy: 'mitigate' as const,
    treatmentPlan: 'Reconfigure sink to active project; add monitoring alert on sink error rate',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'risk-vertex-ai-key-leak', title: 'Vertex AI Notebook Service Account Key Exposure',
    description: 'Vertex AI notebooks store service account keys in /home/jupyter with no idle shutdown, providing a persistent credential exposure vector for lateral movement.',
    status: 'draft' as const, owner: 'Data Science',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Identity & Access', tier3: 'Service Account Key Leakage' },
    assetIds: ['asset-vertex-ai', 'asset-bigquery'],
    diagramLinks: [{ diagramId: 'gcp-cloud-data-leak', nodeIds: ['vertex-ai', 'bigquery-warehouse'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const,
    treatmentPlan: 'Enable Workload Identity on notebooks; enforce idle shutdown; remove persisted key files',
    threatActorIds: ['threat-actor-insider'],
    createdAt: NOW, updatedAt: NOW,
  },
];

const assessments = [
  {
    id: 'assessment-gcp-analytics-review', title: 'GCP Analytics Platform Security Assessment',
    status: 'in_review' as const,
    owner: 'Cloud Security Architecture',
    reviewer: 'CISO',
    startDate: '2025-05-15',
    dueDate: '2025-07-01',
    threatActorIds: ['threat-actor-data-broker', 'threat-actor-insider', 'threat-actor-opportunistic'],
    methodologyNote: 'Assessment follows CIS GCP Benchmark v2.0 and NIST SP 800-53r5 controls with OWASP Top 10 mapping.',
    assumptionNote: 'Assessment covers the GCP analytics project in its current production configuration. Development and staging projects excluded.',
    scopeItems: [
      { id: 'scope-gcp-analytics', type: 'system' as const, value: 'system', name: 'GCP Analytics Platform' },
      { id: 'scope-zone-cloud', type: 'diagram_segment' as const, value: 'Cloud', name: 'GCP Production Zone' },
      { id: 'scope-zone-mgmt', type: 'diagram_segment' as const, value: 'Management', name: 'Operations & Security Zone' },
    ],
    tierFilter: { tier1: 'Cyber Risk' },
    riskManagementPlan: {
      objective: 'Eliminate data exfiltration paths and enforce least-privilege IAM across analytics workloads.',
      strategy: 'Prioritize public data exposure and overprivileged identities, then close monitoring gaps.',
      residualRiskStatement: 'Residual risk accepted only for low-likelihood items after compensating controls are verified.',
      monitoringApproach: 'Bi-weekly review of open actions; monthly SCC finding triage.',
      communicationPlan: 'Report to Cloud Security Steering Committee every two weeks.',
      reviewCadenceDays: 14,
      actions: [
        {
          id: 'rmp-action-bq-acl',
          title: 'Remove allAuthenticatedUsers from BigQuery dataset and implement authorised views',
          owner: 'Data Engineering',
          dueDate: '2025-06-01',
          status: 'in_progress' as const,
          linkedRiskIds: ['risk-bigquery-allauthenticated'],
          notes: 'Column-level security policy drafted; testing with analytics team',
        },
        {
          id: 'rmp-action-sa-cleanup',
          title: 'Purge SA keys from source control and enable Workload Identity',
          owner: 'Platform Engineering',
          dueDate: '2025-06-15',
          status: 'planned' as const,
          linkedRiskIds: ['risk-sa-keys-in-source'],
          notes: 'BFG Repo-Cleaner script prepared; Workload Identity configuration in review',
        },
        {
          id: 'rmp-action-fix-logging-sink',
          title: 'Reconfigure Cloud Logging sink and add sink health monitoring',
          owner: 'Security Operations',
          dueDate: '2025-05-30',
          status: 'done' as const,
          linkedRiskIds: ['risk-logging-sink-broken'],
          notes: 'Sink reconfigured to active SIEM project; Monitoring alert deployed',
        },
        {
          id: 'rmp-action-cloudsql-ssl',
          title: 'Enable SSL enforcement and migrate Cloud SQL to private IP',
          owner: 'Platform Engineering',
          dueDate: '2025-06-30',
          status: 'planned' as const,
          linkedRiskIds: ['risk-cloudsql-public-ip'],
          notes: '',
        },
      ],
      updatedAt: NOW,
    },
    riskIds: risks.map(r => r.id),
    soaGapIds: ['soa-gcp-a01', 'soa-gcp-a02', 'soa-gcp-a05'],
    taskIds: ['task-bq-acl-remediation', 'task-evidence-a09-logging'],
    linkedImplementedControlIds: [],
    linkedInitiativeIds: [],
    summary: 'Security assessment of the GCP analytics platform identified 8 risks including critical data exposure via BigQuery allAuthenticatedUsers access and service account key leakage in source control.',
    findings: 'Key findings include publicly accessible datasets and storage buckets, overprivileged service accounts, broken audit logging, and VPC Service Controls exclusion.',
    recommendations: 'Immediately restrict BigQuery and Cloud Storage access. Implement Workload Identity Federation. Restore audit log pipeline and bring analytics project into VPC Service Controls perimeter.',
    evidenceSummary: 'Evidence includes SCC finding exports, IAM policy snapshots, and Cloud Audit Logs gap analysis.',
    threatModel: {
      nodes: [
        { id: 'tm-node-armor', label: 'Cloud Armor', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'cloud-armor', position: { x: 50, y: 150 }, nodeType: 'firewall', commentary: 'Policy in preview mode; requests logged but not blocked' },
        { id: 'tm-node-lb', label: 'Load Balancer', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'global-lb', position: { x: 200, y: 150 }, nodeType: 'loadBalancer' },
        { id: 'tm-node-cloud-run', label: 'Cloud Run', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'cloud-run-api', position: { x: 400, y: 150 }, nodeType: 'application', commentary: 'Default SA with Editor role' },
        { id: 'tm-node-bigquery', label: 'BigQuery', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'bigquery-warehouse', position: { x: 600, y: 150 }, nodeType: 'database', commentary: 'allAuthenticatedUsers access' },
        { id: 'tm-node-gcs', label: 'Cloud Storage', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'gcp-storage-bucket', position: { x: 600, y: 300 }, nodeType: 'storage' },
        { id: 'tm-node-vertex', label: 'Vertex AI', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'vertex-ai', position: { x: 800, y: 150 }, nodeType: 'application', commentary: 'SA keys stored in notebook filesystem' },
      ],
      edges: [
        { id: 'tm-edge-run-bq', source: 'tm-node-cloud-run', target: 'tm-node-bigquery', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e9', label: 'Queries (unencrypted)' },
        { id: 'tm-edge-vertex-bq', source: 'tm-node-vertex', target: 'tm-node-bigquery', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e22', label: 'Analytics queries via leaked SA keys', commentary: 'Keys stored in notebook filesystem enable persistent access' },
        { id: 'tm-edge-gke-gcs', source: 'tm-node-cloud-run', target: 'tm-node-gcs', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e11', label: 'Public ACL exports' },
      ],
      attackPathDescription: 'Three primary attack paths: (1) Cloud Run Editor SA pivots to BigQuery exfiltration; (2) Vertex AI SA key theft for persistent BigQuery access; (3) Public Cloud Storage bucket exposes raw telemetry.',
      attackPaths: [
        {
          id: 'aap-cloudrun-bq-exfil',
          name: 'Cloud Run Editor SA → BigQuery Data Exfiltration',
          strideCategory: 'Information Disclosure' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'Attacker exploits the Cloud Run service running with Editor role to query and export sensitive data from the BigQuery dataset shared with allAuthenticatedUsers.',
          diagramAttackPathId: 'ap-cloudrun-bq-exfil',
          steps: [
            { order: 1, edgeId: 'e6', sourceNodeId: 'api-gateway', targetNodeId: 'cloud-run-api', technique: 'T1190: Exploit Public-Facing Application' },
            { order: 2, edgeId: 'e13', sourceNodeId: 'cloud-run-api', targetNodeId: 'cloud-iam', technique: 'T1078: Valid Accounts (default SA)' },
            { order: 3, edgeId: 'e10', sourceNodeId: 'gke-stream', targetNodeId: 'bigquery-warehouse', technique: 'T1530: Data from Cloud Storage' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
        {
          id: 'aap-vertex-bq-persistence',
          name: 'Vertex AI Key Theft → Persistent BigQuery Access',
          strideCategory: 'Elevation of Privilege' as StrideCategory,
          riskLevel: 'High' as AttackPathRiskLevel,
          description: 'Attacker accesses a Vertex AI notebook with SA keys stored on disk, extracts the key file, and uses it for persistent API access to BigQuery from outside the GCP project.',
          diagramAttackPathId: 'ap-vertex-bq-persistence',
          steps: [
            { order: 1, edgeId: 'e22', sourceNodeId: 'vertex-ai', targetNodeId: 'bigquery-warehouse', technique: 'T1552: Unsecured Credentials' },
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
    id: 'soa-gcp-a01', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A01', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'BigQuery dataset shared with allAuthenticatedUsers; Cloud Storage has public-read ACLs. Identity-Aware Proxy disabled for dashboards.',
    mitigatesRiskIds: ['risk-bigquery-allauthenticated', 'risk-storage-public-acl'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'soa-gcp-a02', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A02', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Cloud SQL connections unencrypted (SSL disabled). Service account keys stored as plaintext JSON in source control.',
    mitigatesRiskIds: ['risk-cloudsql-public-ip', 'risk-sa-keys-in-source'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'soa-gcp-a03', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A03', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Cloud Armor deployed but in preview mode. API Gateway lacks rate limiting. Input validation present on Cloud Run but incomplete for Pub/Sub message payloads.',
    mitigatesRiskIds: [],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'soa-gcp-a04', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A04', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'VPC Service Controls perimeter excludes analytics project. No secure-by-default patterns for new service accounts. DLP scanning paused.',
    mitigatesRiskIds: ['risk-vpc-perimeter-excluded'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'soa-gcp-a05', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A05', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Cloud Armor in preview mode. Cloud SQL public IP with no SSL. Binary Authorization allows all images. Cloud Functions use default SA with env-var secrets.',
    mitigatesRiskIds: ['risk-editor-service-account', 'risk-cloudsql-public-ip'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'soa-gcp-a07', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A07', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Identity Platform deployed but MFA optional. Long-lived session tokens (24h). Service accounts use downloaded JSON keys without rotation.',
    mitigatesRiskIds: ['risk-sa-keys-in-source', 'risk-vertex-ai-key-leak'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'soa-gcp-a08', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A08', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Binary Authorization policy allows all container images. No attestation for GKE deployments. Cloud Functions deployed without code signing.',
    mitigatesRiskIds: [],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'soa-gcp-a09', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A09', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Cloud Logging sink writes to deleted project causing silent failures. Security Command Center findings archived after 90 days. Cloud Monitoring alert notifications suppressed.',
    mitigatesRiskIds: ['risk-logging-sink-broken'],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'soa-gcp-a10', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A10', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'planned' as const,
    justification: 'Cloud Functions and Cloud Run services can make outbound requests to metadata server and internal APIs. SSRF controls not yet implemented.',
    mitigatesRiskIds: [],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
  {
    id: 'soa-gcp-a06', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A06', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'GKE autopilot handles node OS patching. Container image scanning via Artifact Analysis enabled but not enforced. Cloud Functions runtime versions not pinned.',
    mitigatesRiskIds: [],
    diagramRefs: [], evidence: [], updatedAt: NOW,
  },
];

const workflowTasks = [
  {
    id: 'task-bq-acl-remediation',
    title: 'Remove allAuthenticatedUsers from BigQuery dataset and enforce authorised views',
    description: 'Critical data exposure remediation for the central analytics warehouse.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'critical' as const,
    owner: 'Data Engineering',
    dueDate: '2025-06-01',
    riskId: 'risk-bigquery-allauthenticated',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'task-sa-key-purge',
    title: 'Purge service account keys from source control history',
    description: 'Use BFG Repo-Cleaner to remove all JSON key files from git history and rotate affected keys.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'critical' as const,
    owner: 'Platform Engineering',
    dueDate: '2025-06-15',
    riskId: 'risk-sa-keys-in-source',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'task-evidence-a09-logging',
    title: 'Attach Cloud Logging sink health evidence for A09',
    description: 'Document the reconfigured logging sink and monitoring alert as evidence for OWASP A09 compliance.',
    type: 'evidence' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Security Operations',
    dueDate: '2025-06-10',
    controlSetId: OWASP_CONTROL_SET_ID,
    controlId: 'A09',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'task-vpc-perimeter-inclusion',
    title: 'Add analytics project to VPC Service Controls perimeter',
    description: 'Configure ingress/egress rules for approved data scientist workflows and include analytics project in the perimeter.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Security Operations',
    dueDate: '2025-06-30',
    riskId: 'risk-vpc-perimeter-excluded',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'task-cloudsql-ssl-migration',
    title: 'Enable SSL enforcement and migrate Cloud SQL to private IP',
    description: 'Enable requireSsl flag on Cloud SQL and configure Cloud SQL Auth Proxy for private connectivity.',
    type: 'control_implementation' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Platform Engineering',
    dueDate: '2025-06-30',
    assessmentId: 'assessment-gcp-analytics-review',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'task-vertex-workload-identity',
    title: 'Enable Workload Identity on Vertex AI notebooks and enforce idle shutdown',
    description: 'Remove persisted key files from notebooks and configure Workload Identity for secure credential handling.',
    type: 'risk_treatment' as const,
    status: 'blocked' as const,
    priority: 'medium' as const,
    owner: 'Data Science',
    dueDate: '2025-07-15',
    riskId: 'risk-vertex-ai-key-leak',
    createdAt: NOW, updatedAt: NOW,
  },
];

const threatActors = [
  {
    id: 'threat-actor-data-broker', name: 'Data Broker / Competitive Intelligence',
    type: 'competitor' as const, capabilityLevel: 3,
    resourceLevel: 'moderate' as const,
    motivation: 'Acquire customer behavioural analytics and telemetry data for resale or competitive advantage.',
    description: 'Actors exploiting overly permissive cloud IAM bindings and public dataset access to harvest sensitive analytics data without detection.',
    targetedAssetIds: ['asset-bigquery', 'asset-cloud-storage'],
    tags: ['data-theft', 'analytics', 'competitive-intelligence'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'threat-actor-insider', name: 'Malicious Data Scientist',
    type: 'insider' as const, capabilityLevel: 3,
    resourceLevel: 'moderate' as const,
    motivation: 'Exfiltrate proprietary models and customer data via Vertex AI notebooks or BigQuery exports for personal gain.',
    description: 'Internal data scientist with legitimate access to analytics infrastructure who abuses overprivileged service accounts and disabled DLP controls to exfiltrate data.',
    targetedAssetIds: ['asset-vertex-ai', 'asset-bigquery', 'asset-cloud-iam'],
    tags: ['insider-threat', 'data-exfiltration', 'privileged-access'],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'threat-actor-opportunistic', name: 'Automated Cloud Scanner',
    type: 'opportunistic' as const, capabilityLevel: 1,
    resourceLevel: 'very_low' as const,
    motivation: 'Automated discovery of publicly accessible cloud storage, databases, and misconfigured services for opportunistic data theft or cryptomining.',
    description: 'Automated tools scanning GCP for public buckets, open BigQuery datasets, and exposed Cloud SQL instances with weak or no authentication.',
    targetedAssetIds: ['asset-cloud-storage', 'asset-cloud-sql', 'asset-bigquery'],
    tags: ['automated', 'mass-scanning', 'cloud-misconfiguration'],
    createdAt: NOW, updatedAt: NOW,
  },
];

const threatScenarios = [
  {
    id: 'scenario-bq-mass-export', title: 'Mass BigQuery Data Export via allAuthenticatedUsers',
    description: 'External actor discovers the allAuthenticatedUsers binding on BigQuery, authenticates with any Google account, and runs export jobs to extract all customer telemetry and PII data without triggering alerts due to broken logging sink.',
    threatActorId: 'threat-actor-data-broker',
    targetedAssetIds: ['asset-bigquery', 'asset-cloud-logging'],
    attackTechniques: ['T1530 - Data from Cloud Storage Object', 'T1078 - Valid Accounts', 'T1567 - Exfiltration Over Web Service'],
    linkedRiskIds: ['risk-bigquery-allauthenticated', 'risk-logging-sink-broken'],
    likelihood: 'Very High — allAuthenticatedUsers is trivially exploitable by any Google account.',
    impact: 'Critical — full customer PII dataset exposure triggers GDPR notification, regulatory fines, and reputational harm.',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'scenario-sa-key-repo-exploit', title: 'Service Account Key Extraction from Source Control',
    description: 'Insider or attacker with repository access extracts committed SA JSON keys, impersonates the Editor-role service account, and accesses BigQuery, Cloud Storage, and Cloud SQL without additional authentication.',
    threatActorId: 'threat-actor-insider',
    targetedAssetIds: ['asset-cloud-iam', 'asset-bigquery', 'asset-cloud-sql'],
    attackTechniques: ['T1552.001 - Credentials In Files', 'T1078 - Valid Accounts', 'T1530 - Data from Cloud Storage Object'],
    linkedRiskIds: ['risk-sa-keys-in-source', 'risk-editor-service-account'],
    likelihood: 'High — keys are in git history and accessible to all developers.',
    impact: 'Critical — Editor role grants broad project access for data exfiltration and resource manipulation.',
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'scenario-public-bucket-scrape', title: 'Public Cloud Storage Bucket Data Scrape',
    description: 'Automated scanner discovers the publicly readable Cloud Storage bucket and downloads raw JSON telemetry files containing customer PII before DLP scanning can detect the exposure.',
    threatActorId: 'threat-actor-opportunistic',
    targetedAssetIds: ['asset-cloud-storage'],
    attackTechniques: ['T1530 - Data from Cloud Storage Object', 'T1595 - Active Scanning'],
    linkedRiskIds: ['risk-storage-public-acl'],
    likelihood: 'High — public buckets are indexed by automated scanners within hours of exposure.',
    impact: 'Major — raw telemetry with PII exposed; DLP scanning paused so patterns go undetected.',
    createdAt: NOW, updatedAt: NOW,
  },
];

const data: GrcSystemData = {
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
      id: 'gcp-si-dlp-remediation', title: 'Data Loss Prevention and Bucket Security Remediation',
      description: 'Remediate public Cloud Storage buckets, enforce DLP scanning on all data pipelines, and eliminate allAuthenticatedUsers BigQuery shares.',
      category: 'remediation' as const, status: 'in_progress' as const, priority: 'critical' as const,
      owner: 'Data Engineering', executiveSponsor: 'VP Engineering',
      currentState: 'GCS bucket with public ACL exposes raw telemetry; BigQuery dataset shared with allAuthenticatedUsers; DLP scanning paused.',
      targetState: 'All buckets private with uniform bucket-level access; BigQuery IAM scoped to named principals; DLP scanning active on all ingestion.',
      startDate: '2025-02-01T00:00:00.000Z', targetDate: '2025-09-30T00:00:00.000Z', completedDate: '',
      milestones: [
        { id: 'gcp-ms-bucket-lockdown', title: 'Cloud Storage Public ACL Removal', description: 'Remove public read ACL from GCS landing bucket and enable uniform bucket-level access.', status: 'completed' as const, dueDate: '2025-03-15T00:00:00.000Z', completedDate: '2025-03-10T00:00:00.000Z', owner: 'Data Engineering' },
        { id: 'gcp-ms-bq-iam-scoping', title: 'BigQuery IAM Principal Scoping', description: 'Replace allAuthenticatedUsers with named service accounts and groups on all BigQuery datasets.', status: 'in_progress' as const, dueDate: '2025-06-30T00:00:00.000Z', completedDate: '', owner: 'Data Engineering' },
        { id: 'gcp-ms-dlp-activation', title: 'DLP Scanning Pipeline Activation', description: 'Re-enable Cloud DLP inspection jobs on all data ingestion pathways and configure automated de-identification.', status: 'pending' as const, dueDate: '2025-09-30T00:00:00.000Z', completedDate: '', owner: 'Security Operations' },
      ],
      linkedRiskIds: ['risk-bigquery-allauthenticated', 'risk-storage-public-acl'],
      linkedControlSetIds: [],
      linkedAssetIds: ['asset-bigquery', 'asset-cloud-storage'],
      linkedImplementedControlIds: ['gcp-ic-vpc-service-controls', 'gcp-ic-dlp-scanning'],
      linkedAssessmentIds: ['assessment-gcp-analytics-review'],
      notes: 'Triggered by CSPM finding from Orca Security. Data Engineering sprint capacity allocated through Q3.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'gcp-si-iam-key-elimination', title: 'Service Account Key Elimination Program',
      description: 'Migrate all workloads from exported JSON service account keys to Workload Identity Federation and attached service accounts.',
      category: 'uplift' as const, status: 'approved' as const, priority: 'high' as const,
      owner: 'Platform Engineering', executiveSponsor: 'CTO',
      currentState: 'Service account JSON keys committed to source control; Cloud Run using default compute SA with Editor role; Vertex AI notebooks with exported keys.',
      targetState: 'Zero exported service account keys; all workloads using Workload Identity Federation or attached service accounts with least privilege.',
      startDate: '2025-05-01T00:00:00.000Z', targetDate: '2025-12-31T00:00:00.000Z', completedDate: '',
      milestones: [
        { id: 'gcp-ms-key-inventory', title: 'Service Account Key Inventory', description: 'Complete audit of all exported service account keys across projects and map to owning workloads.', status: 'completed' as const, dueDate: '2025-06-15T00:00:00.000Z', completedDate: '2025-06-10T00:00:00.000Z', owner: 'Security Operations' },
        { id: 'gcp-ms-wif-migration', title: 'Workload Identity Federation Migration', description: 'Migrate Cloud Run, GKE, and Vertex AI workloads to Workload Identity Federation and revoke exported keys.', status: 'pending' as const, dueDate: '2025-11-30T00:00:00.000Z', completedDate: '', owner: 'Platform Engineering' },
      ],
      linkedRiskIds: ['risk-sa-keys-in-source', 'risk-editor-service-account', 'risk-vertex-ai-key-leak'],
      linkedControlSetIds: [],
      linkedAssetIds: ['asset-cloud-iam', 'asset-cloud-run', 'asset-vertex-ai', 'asset-gke'],
      linkedImplementedControlIds: ['gcp-ic-org-policy-constraints'],
      linkedAssessmentIds: ['assessment-gcp-analytics-review'],
      notes: 'CTO sponsoring after leaked key incident in staging environment. Organization Policy constraint to block key creation planned.',
      createdAt: NOW, updatedAt: NOW,
    },
  ],
  implementedControls: [
    {
      id: 'gcp-ic-vpc-service-controls', title: 'VPC Service Controls Perimeter',
      description: 'VPC Service Controls perimeter restricting BigQuery, Cloud Storage, and Cloud SQL API access to authorized networks and projects.',
      controlType: 'technical' as const, category: 'network_security' as const,
      status: 'active' as const, automationLevel: 'fully_automated' as const,
      owner: 'Platform Engineering', vendor: 'Google', product: 'VPC Service Controls', version: 'GA',
      implementedDate: '2024-09-01T00:00:00.000Z', lastReviewDate: NOW, nextReviewDate: '2025-12-01T00:00:00.000Z',
      linkedSoaEntryIds: ['soa-gcp-a01', 'soa-gcp-a05'],
      linkedRiskIds: ['risk-vpc-perimeter-excluded', 'risk-bigquery-allauthenticated'],
      linkedAssetIds: ['asset-bigquery', 'asset-cloud-storage', 'asset-cloud-sql'],
      linkedAssessmentIds: ['assessment-gcp-analytics-review'],
      notes: 'Analytics project currently excluded from perimeter. Remediation tracked in DLP initiative.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'gcp-ic-dlp-scanning', title: 'Cloud DLP Inspection Pipeline',
      description: 'Automated Cloud DLP inspection jobs scanning Cloud Storage uploads and BigQuery tables for PII and sensitive data patterns.',
      controlType: 'technical' as const, category: 'monitoring' as const,
      status: 'under_review' as const, automationLevel: 'fully_automated' as const,
      owner: 'Security Operations', vendor: 'Google', product: 'Cloud Data Loss Prevention', version: 'v2',
      implementedDate: '2024-06-01T00:00:00.000Z', lastReviewDate: NOW, nextReviewDate: '2025-09-01T00:00:00.000Z',
      linkedSoaEntryIds: ['soa-gcp-a02', 'soa-gcp-a04'],
      linkedRiskIds: ['risk-storage-public-acl', 'risk-bigquery-allauthenticated'],
      linkedAssetIds: ['asset-cloud-storage', 'asset-bigquery'],
      linkedAssessmentIds: ['assessment-gcp-analytics-review'],
      notes: 'DLP scanning currently paused due to budget overrun. Re-activation pending finance approval.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'gcp-ic-org-policy-constraints', title: 'GCP Organization Policy Constraints',
      description: 'Organization-level policy constraints enforcing domain-restricted sharing, disabling service account key creation, and requiring OS Login on GCE instances.',
      controlType: 'technical' as const, category: 'access_control' as const,
      status: 'active' as const, automationLevel: 'fully_automated' as const,
      owner: 'Platform Engineering', vendor: 'Google', product: 'Organization Policy Service', version: 'GA',
      implementedDate: '2024-03-01T00:00:00.000Z', lastReviewDate: NOW, nextReviewDate: '2025-10-01T00:00:00.000Z',
      linkedSoaEntryIds: ['soa-gcp-a01', 'soa-gcp-a07'],
      linkedRiskIds: ['risk-editor-service-account', 'risk-sa-keys-in-source'],
      linkedAssetIds: ['asset-cloud-iam', 'asset-cloud-run', 'asset-gke'],
      linkedAssessmentIds: ['assessment-gcp-analytics-review'],
      notes: 'Key creation constraint not yet enforced due to legacy workload dependencies. Exception list under review.',
      createdAt: NOW, updatedAt: NOW,
    },
  ],
  thirdParties: [
    {
      id: 'gcp-tp-google', name: 'Google Cloud Platform', description: 'Primary cloud infrastructure provider hosting BigQuery, Cloud Run, GKE, Cloud SQL, and all analytics workloads.',
      category: 'cloud_provider' as const, status: 'active' as const, riskRating: 'critical' as const, dataClassification: 'confidential' as const,
      linkedAssetIds: ['asset-bigquery', 'asset-cloud-storage', 'asset-cloud-run', 'asset-cloud-sql', 'asset-cloud-iam', 'asset-cloud-logging', 'asset-gke'],
      linkedRiskIds: ['risk-bigquery-allauthenticated', 'risk-storage-public-acl', 'risk-editor-service-account', 'risk-cloudsql-public-ip', 'risk-vpc-perimeter-excluded', 'risk-logging-sink-broken'],
      contactName: 'Emily Park', contactEmail: 'emily.park@google.com',
      contractExpiry: '2028-03-31T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-08-01T00:00:00.000Z',
      notes: 'Committed use discount agreement. VPC Service Controls perimeter exclusion for analytics project needs urgent review.',
    },
    {
      id: 'gcp-tp-looker', name: 'Looker / Tableau', description: 'Business intelligence and analytics visualization platform connected to BigQuery datasets.',
      category: 'saas' as const, status: 'active' as const, riskRating: 'high' as const, dataClassification: 'confidential' as const,
      linkedAssetIds: ['asset-bigquery'], linkedRiskIds: ['risk-bigquery-allauthenticated'],
      contactName: 'Mark Stevens', contactEmail: 'mark.stevens@tableau.com',
      contractExpiry: '2027-01-31T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-07-15T00:00:00.000Z',
      notes: 'Data Studio connectors export data without row-level policies. Review allAuthenticatedUsers share scope.',
    },
    {
      id: 'gcp-tp-orca', name: 'Orca Security', description: 'Cloud security posture management platform for vulnerability scanning and compliance monitoring.',
      category: 'saas' as const, status: 'active' as const, riskRating: 'medium' as const, dataClassification: 'internal' as const,
      linkedAssetIds: ['asset-cloud-iam', 'asset-cloud-logging'], linkedRiskIds: ['risk-sa-keys-in-source', 'risk-logging-sink-broken'],
      contactName: 'Lisa Nguyen', contactEmail: 'lisa.nguyen@orca.security',
      contractExpiry: '2026-12-31T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-09-01T00:00:00.000Z',
      notes: 'CSPM findings not actioned for 60+ days. Integration with Security Command Center pending.',
    },
    {
      id: 'gcp-tp-dbt', name: 'dbt Labs', description: 'Data transformation platform running SQL models against BigQuery for analytics pipelines.',
      category: 'saas' as const, status: 'active' as const, riskRating: 'medium' as const, dataClassification: 'confidential' as const,
      linkedAssetIds: ['asset-bigquery', 'asset-vertex-ai'], linkedRiskIds: ['risk-vertex-ai-key-leak', 'risk-bigquery-allauthenticated'],
      contactName: 'Tom Bradley', contactEmail: 'tom.bradley@dbtlabs.com',
      contractExpiry: '2027-06-30T00:00:00.000Z', lastAssessmentDate: NOW, nextReviewDate: '2026-08-15T00:00:00.000Z',
      notes: 'Service account keys used for dbt Cloud connection. Migration to Workload Identity Federation recommended.',
    },
  ],
};

export const gcpCloudDataLeakGrcWorkspace = buildGrcWorkspace(data);

export const gcpCloudDataLeak: ExampleSystem = {
  id: 'gcp-cloud-data-leak',
  name: 'GCP Analytics Platform with Open Data Paths',
  description: 'Customer analytics stack on Google Cloud where IAM shortcuts and logging gaps expose sensitive telemetry.',
  category: 'Cloud Vendor Architectures',
  primaryZone: 'Cloud',
  dataClassification: 'Sensitive',
  grcWorkspace: gcpCloudDataLeakGrcWorkspace,
  customContext: `
## GCP Analytics Pipeline – Quiet Exposure

This architecture represents a typical GCP analytics deployment where security controls have quietly drifted:

- **Cloud Armor** policy left in preview mode, so majority of requests bypass enforcement.
- **Identity-Aware Proxy** disabled for internal dashboards to simplify access for marketing teams.
- **Cloud Run** service executes with default service account granting Editor role across the project.
- **BigQuery dataset** shared with 'allAuthenticatedUsers' for ad-hoc exploration; audit logs reveal downloads from unmanaged identities.
- **Cloud Storage landing bucket** retains public read ACLs from legacy data science experiments.
- **Vertex AI notebooks** run with broad permissions and no idle shutdown, leaking service account keys.
- **Cloud Logging sink** exports to a closed project causing silent logging failures.
- **Security Command Center** findings archived after generating too many alerts for legacy resources.
- **Cloud IAM** service accounts use downloaded JSON keys stored in source control.
- **Cloud DLP** inspection jobs paused to reduce costs; sensitive data patterns undetected.
- **VPC Service Controls** perimeter excludes analytics project to avoid breaking data scientist workflows.

Use the model to surface least-privileged IAM expectations, data exfiltration paths, and monitoring blind spots.
`,
  nodes: [
    // Internet Zone
    {
      id: 'gcp-internet-zone',
      type: 'securityZone',
      position: { x: 50, y: 50 },
      data: {
        label: 'Internet',
        zoneType: 'Internet' as SecurityZone,
        description: 'External users, marketing analysts, and automation scripts'
      },
      style: {
        width: 600,
        height: 900,
        background: colors.zoneBackgrounds.Internet,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'gcp-customers',
      type: 'user',
      position: { x: 125, y: 175 },
      data: {
        label: 'Customer Browsers',
        description: 'Send telemetry events via JavaScript SDK',
        zone: 'Internet' as SecurityZone,
        dataClassification: 'Public'
      }
    } as SecurityNode,
    {
      id: 'marketing-analyst',
      type: 'user',
      position: { x: 225, y: 575 },
      data: {
        label: 'Marketing Analyst',
        description: 'Accesses dashboards from unmanaged laptop',
        zone: 'Internet' as SecurityZone,
        dataClassification: 'Public'
      }
    } as SecurityNode,

    // DMZ Zone
    {
      id: 'gcp-edge-zone',
      type: 'securityZone',
      position: { x: 770, y: 50 },
      data: {
        label: 'GCP Edge',
        zoneType: 'DMZ' as SecurityZone,
        description: 'Global load balancing and ingress controls'
      },
      style: {
        width: 750,
        height: 900,
        background: colors.zoneBackgrounds.DMZ,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'cloud-armor',
      type: 'gcpCloudArmor',
      position: { x: 825, y: 425 },
      data: {
        label: 'Cloud Armor',
        description: 'DDoS and WAF protection in preview mode',
        zone: 'DMZ' as SecurityZone,
        dataClassification: 'Internal',
        additionalContext: 'Policy not enforced, only logging; bypass possible via alternate frontend service.'
      }
    } as SecurityNode,
    {
      id: 'global-lb',
      type: 'gcpCloudLoadBalancing',
      position: { x: 825, y: 175 },
      data: {
        label: 'Load Balancer',
        description: 'Routes telemetry and dashboard traffic into VPC',
        zone: 'DMZ' as SecurityZone,
        dataClassification: 'Internal',
        additionalContext: 'Backend timeout increased; health checks allow partial outages to pass undetected.'
      }
    } as SecurityNode,
    {
      id: 'api-gateway',
      type: 'apiSecurity',
      position: { x: 1225, y: 175 },
      data: {
        label: 'API Gateway',
        description: 'API management and authentication',
        zone: 'DMZ' as SecurityZone,
        dataClassification: 'Internal',
        additionalContext: 'API keys shared via email; no rate limiting configured.'
      }
    } as SecurityNode,
    {
      id: 'identity-platform',
      type: 'gcpIdentityPlatform',
      position: { x: 1225, y: 575 },
      data: {
        label: 'Identity Platform',
        description: 'Customer identity and access management',
        zone: 'DMZ' as SecurityZone,
        dataClassification: 'Internal',
        additionalContext: 'Multi-factor authentication optional; session tokens valid for 24 hours.'
      }
    } as SecurityNode,

    // Cloud Zone
    {
      id: 'gcp-prod-zone',
      type: 'securityZone',
      position: { x: 1640, y: 50 },
      data: {
        label: 'GCP Production',
        zoneType: 'Cloud' as SecurityZone,
        description: 'Event ingestion, processing, and storage services'
      },
      style: {
        width: 950,
        height: 900,
        background: colors.zoneBackgrounds.Cloud,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'cloud-run-api',
      type: 'gcpCloudRun',
      position: { x: 1675, y: 175 },
      data: {
        label: 'Cloud Run',
        description: 'Receives HTTPS telemetry events and pushes to Pub/Sub',
        zone: 'Cloud' as SecurityZone,
        dataClassification: 'Sensitive',
        additionalContext: 'Uses default service account with Editor role; Identity-Aware Proxy disabled to simplify mobile testing.'
      }
    } as SecurityNode,
    {
      id: 'gke-stream',
      type: 'gcpGKE',
      position: { x: 1875, y: 175 },
      data: {
        label: 'GKE',
        description: 'Kafka-to-BigQuery connectors on autopilot nodes',
        zone: 'Cloud' as SecurityZone,
        dataClassification: 'Sensitive',
        additionalContext: 'Workload identity disabled; nodes use service account keys stored on disk.'
      }
    } as SecurityNode,
    {
      id: 'cloud-functions',
      type: 'gcpCloudFunctions',
      position: { x: 2075, y: 175 },
      data: {
        label: 'Cloud Functions',
        description: 'Serverless data transformation pipeline',
        zone: 'Cloud' as SecurityZone,
        dataClassification: 'Sensitive',
        additionalContext: 'Functions use default service account; environment variables contain API keys.'
      }
    } as SecurityNode,
    {
      id: 'bigquery-warehouse',
      type: 'gcpBigQuery',
      position: { x: 1675, y: 725 },
      data: {
        label: 'BigQuery',
        description: 'Central dataset for dashboards and experimentation',
        zone: 'Cloud' as SecurityZone,
        dataClassification: 'Confidential',
        additionalContext: 'Dataset shared with allAuthenticatedUsers; exports triggered by Data Studio connectors without row-level policies.'
      }
    } as SecurityNode,
    {
      id: 'gcp-storage-bucket',
      type: 'gcpCloudStorage',
      position: { x: 2125, y: 575 },
      data: {
        label: 'Cloud Storage',
        description: 'Raw JSON written before ETL runs',
        zone: 'Cloud' as SecurityZone,
        dataClassification: 'Sensitive',
        additionalContext: 'Legacy ACL grants allUsers read on public sample paths; bucket policy only partially restricts access.'
      }
    } as SecurityNode,
    {
      id: 'cloud-sql',
      type: 'gcpCloudSQL',
      position: { x: 1675, y: 325 },
      data: {
        label: 'Cloud SQL',
        description: 'PostgreSQL database for application state',
        zone: 'Cloud' as SecurityZone,
        dataClassification: 'Confidential',
        additionalContext: 'Public IP enabled; SSL enforcement disabled for compatibility.'
      }
    } as SecurityNode,

    // Management Zone
    {
      id: 'gcp-ops-zone',
      type: 'securityZone',
      position: { x: 2710, y: 50 },
      data: {
        label: 'Operations & Security',
        zoneType: 'Management' as SecurityZone,
        description: 'Identity, security monitoring, and privileged access'
      },
      style: {
        width: 850,
        height: 900,
        background: colors.zoneBackgrounds.Management,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'cloud-iam',
      type: 'gcpIAM',
      position: { x: 2775, y: 125 },
      data: {
        label: 'Cloud IAM',
        description: 'Identity and access management with service accounts',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Confidential',
        additionalContext: 'Service account keys downloaded as JSON and committed to source control; no key rotation policy.'
      }
    } as SecurityNode,
    {
      id: 'cloud-identity',
      type: 'gcpCloudIdentity',
      position: { x: 2975, y: 125 },
      data: {
        label: 'Cloud Identity',
        description: 'Workforce identity federation and SSO',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Confidential',
        additionalContext: 'Guest users not restricted; external identities allowed without domain verification.'
      }
    } as SecurityNode,
    {
      id: 'secret-manager',
      type: 'gcpSecretManager',
      position: { x: 3175, y: 125 },
      data: {
        label: 'Secret Manager',
        description: 'Centralized secrets storage and versioning',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Confidential',
        additionalContext: 'Automatic rotation disabled; secrets accessible via Editor role on project.'
      }
    } as SecurityNode,
    {
      id: 'security-command-center',
      type: 'gcpSecurityCommandCenter',
      position: { x: 2825, y: 275 },
      data: {
        label: 'Security Command Center',
        description: 'Security and risk management platform',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Sensitive',
        additionalContext: 'Findings archived after 90 days; custom detectors disabled to reduce noise.'
      }
    } as SecurityNode,
    {
      id: 'cloud-dlp',
      type: 'gcpCloudDLP',
      position: { x: 3125, y: 275 },
      data: {
        label: 'Cloud DLP',
        description: 'Data loss prevention and sensitive data discovery',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Sensitive',
        additionalContext: 'Inspection jobs paused to reduce costs; BigQuery scanning disabled for analytics project.'
      }
    } as SecurityNode,
    {
      id: 'vpc-service-controls',
      type: 'gcpVPCServiceControls',
      position: { x: 3425, y: 275 },
      data: {
        label: 'VPC Service Controls',
        description: 'Service perimeter for data exfiltration protection',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Sensitive',
        additionalContext: 'Analytics project excluded from perimeter to avoid breaking data scientist workflows.'
      }
    } as SecurityNode,
    {
      id: 'cloud-logging',
      type: 'gcpCloudLogging',
      position: { x: 2975, y: 625 },
      data: {
        label: 'Cloud Logging',
        description: 'Exports audit logs to SIEM project',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Sensitive',
        additionalContext: 'Logging sink writes to a deleted project; ingestion fails silently leaving gaps.'
      }
    } as SecurityNode,
    {
      id: 'cloud-monitoring',
      type: 'gcpCloudMonitoring',
      position: { x: 3175, y: 625 },
      data: {
        label: 'Cloud Monitoring',
        description: 'Metrics collection and alerting platform',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Sensitive',
        additionalContext: 'Alert policies configured but notifications suppressed for cost optimization.'
      }
    } as SecurityNode,
    {
      id: 'binary-authorization',
      type: 'gcpBinaryAuthorization',
      position: { x: 3375, y: 625 },
      data: {
        label: 'Binary Authorization',
        description: 'Container image signature verification',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Sensitive',
        additionalContext: 'Policy set to allow all images; attestation not enforced for development namespaces.'
      }
    } as SecurityNode,
    {
      id: 'vertex-ai',
      type: 'gcpVertexAI',
      position: { x: 2775, y: 725 },
      data: {
        label: 'Vertex AI',
        description: 'Managed notebooks for data science experimentation',
        zone: 'Management' as SecurityZone,
        dataClassification: 'Sensitive',
        additionalContext: 'Notebooks run with custom service account storing keys in /home/jupyter; idle shutdown disabled.'
      }
    } as SecurityNode
  ],
  edges: [
    // Internet to DMZ
    {
      id: 'e1',
      source: 'gcp-customers',
      target: 'cloud-armor',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'HTTPS',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        securityLevel: 'Medium',
        dataClassification: 'Public',
        zone: 'DMZ' as SecurityZone,
        animated: true,
        additionalContext: 'Requests logged but not blocked because policy in preview'
      }
    } as SecurityEdge,
    {
      id: 'e2',
      source: 'marketing-analyst',
      target: 'identity-platform',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'SSO',
        protocol: 'OIDC',
        encryption: 'TLS 1.2',
        securityLevel: 'Low',
        dataClassification: 'Sensitive',
        zone: 'DMZ' as SecurityZone,
        additionalContext: 'MFA optional; long-lived tokens',
        controlPoints: [{ id: 'cp1', x: 550, y: 450 }, { id: 'cp2', x: 970, y: 500 }]
      }
    } as SecurityEdge,

    // DMZ internal
    {
      id: 'e3',
      source: 'cloud-armor',
      target: 'global-lb',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Filtered',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        securityLevel: 'Medium',
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e4',
      source: 'global-lb',
      target: 'api-gateway',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Backend',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        securityLevel: 'Medium',
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e5',
      source: 'identity-platform',
      target: 'api-gateway',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Tokens',
        protocol: 'JWT',
        encryption: 'Signed',
        securityLevel: 'Low',
        dataClassification: 'Sensitive',
        zone: 'DMZ' as SecurityZone,
        additionalContext: 'Long token expiry'
      }
    } as SecurityEdge,

    // DMZ to Cloud
    {
      id: 'e6',
      source: 'api-gateway',
      target: 'cloud-run-api',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Ingress',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e7',
      source: 'api-gateway',
      target: 'cloud-functions',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Events',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone,
        controlPoints: [
          { id: 'cp3', x: 1450, y: 150, active: true },
          { id: 'cp-1771637896943', x: 2000, y: 150, active: true }
        ]
      }
    } as SecurityEdge,

    // Cloud internal
    {
      id: 'e8',
      source: 'cloud-run-api',
      target: 'gke-stream',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Pub/Sub',
        protocol: 'gRPC',
        encryption: 'mTLS',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone,
        additionalContext: 'Messages contain raw PII'
      }
    } as SecurityEdge,
    {
      id: 'e9',
      source: 'cloud-run-api',
      target: 'cloud-sql',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Queries',
        protocol: 'PostgreSQL',
        encryption: 'None',
        securityLevel: 'Low',
        dataClassification: 'Confidential',
        zone: 'Cloud' as SecurityZone,
        additionalContext: 'SSL disabled',
        controlPoints: [{ id: 'cp4', x: 1720, y: 350 }]
      }
    } as SecurityEdge,
    {
      id: 'e10',
      source: 'gke-stream',
      target: 'bigquery-warehouse',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Streaming',
        protocol: 'BigQuery API',
        encryption: 'TLS 1.2',
        securityLevel: 'High',
        dataClassification: 'Confidential',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e11',
      source: 'gke-stream',
      target: 'gcp-storage-bucket',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Exports',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Low',
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone,
        additionalContext: 'Public ACLs'
      }
    } as SecurityEdge,
    {
      id: 'e12',
      source: 'cloud-functions',
      target: 'bigquery-warehouse',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Transform',
        protocol: 'BigQuery API',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Confidential',
        zone: 'Cloud' as SecurityZone
      }
    } as SecurityEdge,

    // Cloud to Management
    {
      id: 'e13',
      source: 'cloud-run-api',
      target: 'cloud-iam',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Service Account',
        protocol: 'OAuth 2.0',
        encryption: 'TLS 1.2',
        securityLevel: 'High',
        dataClassification: 'Confidential',
        zone: 'Management' as SecurityZone,
        controlPoints: [{ id: 'cp5', x: 2600, y: 200 }]
      }
    } as SecurityEdge,
    {
      id: 'e14',
      source: 'cloud-functions',
      target: 'secret-manager',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Secrets',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'High',
        dataClassification: 'Confidential',
        zone: 'Management' as SecurityZone,
        controlPoints: [{ id: 'cp-1771637958420', x: 2100, y: 0, active: true }, { id: 'cp6', x: 3200, y: 0, active: true }]
      }
    } as SecurityEdge,
    {
      id: 'e15',
      source: 'cloud-run-api',
      target: 'cloud-logging',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Logs',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Management' as SecurityZone,
        controlPoints: [{ id: 'cp7', x: 2750, y: 650, active: true }]
      }
    } as SecurityEdge,

    // Management internal
    {
      id: 'e16',
      source: 'cloud-iam',
      target: 'cloud-identity',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Federation',
        protocol: 'SAML/OIDC',
        encryption: 'TLS 1.2',
        securityLevel: 'High',
        dataClassification: 'Confidential',
        zone: 'Management' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e17',
      source: 'cloud-logging',
      target: 'security-command-center',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Audit Logs',
        protocol: 'Pub/Sub',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Management' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e18',
      source: 'security-command-center',
      target: 'cloud-dlp',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Findings',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Management' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e19',
      source: 'cloud-dlp',
      target: 'vpc-service-controls',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Policy',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Management' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e20',
      source: 'cloud-monitoring',
      target: 'cloud-logging',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Metrics',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Management' as SecurityZone
      }
    } as SecurityEdge,
    {
      id: 'e21',
      source: 'gke-stream',
      target: 'binary-authorization',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Image Verify',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Low',
        dataClassification: 'Internal',
        zone: 'Management' as SecurityZone,
        additionalContext: 'Policy allows all',
        controlPoints: [{ id: 'cp8', x: 2600, y: 300 }]
      }
    } as SecurityEdge,
    {
      id: 'e22',
      source: 'vertex-ai',
      target: 'bigquery-warehouse',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Analytics',
        protocol: 'BigQuery API',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Confidential',
        zone: 'Cloud' as SecurityZone,
        additionalContext: 'Keys stored in notebooks',
        controlPoints: [{ id: 'cp9', x: 2600, y: 650 }, { id: 'cp10', x: 1720, y: 650 }]
      }
    } as SecurityEdge,
    {
      id: 'e23',
      source: 'gcp-storage-bucket',
      target: 'cloud-dlp',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Scan',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        securityLevel: 'Medium',
        dataClassification: 'Sensitive',
        zone: 'Management' as SecurityZone,
        additionalContext: 'Jobs paused',
        controlPoints: [{ id: 'cp11', x: 2350, y: 600, active: true }]
      }
    } as SecurityEdge
  ],
  attackPaths: [
    {
      id: 'ap-cloudrun-bq-exfil',
      name: 'Cloud Run Editor SA → BigQuery Data Exfiltration',
      strideCategory: 'Information Disclosure' as import('../../types/ThreatIntelTypes').StrideCategory,
      riskLevel: 'Critical' as import('../../types/GrcTypes').AttackPathRiskLevel,
      description: 'An attacker exploits the Cloud Run service running with the default Compute Engine service account (Editor role) to pivot into IAM, then queries and exports sensitive customer telemetry from the BigQuery dataset that is shared with allAuthenticatedUsers.',
      steps: [
        { order: 1, edgeId: 'e6', sourceNodeId: 'api-gateway', targetNodeId: 'cloud-run-api', technique: 'T1190: Exploit Public-Facing Application' },
        { order: 2, edgeId: 'e13', sourceNodeId: 'cloud-run-api', targetNodeId: 'cloud-iam', technique: 'T1078: Valid Accounts (default SA with Editor role)' },
        { order: 3, edgeId: 'e10', sourceNodeId: 'gke-stream', targetNodeId: 'bigquery-warehouse', technique: 'T1530: Data from Cloud Storage Object' },
      ],
      mitreTechniques: ['T1190', 'T1078', 'T1530'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-vertex-bq-persistence',
      name: 'Vertex AI Key Theft → Persistent BigQuery Access',
      strideCategory: 'Elevation of Privilege' as import('../../types/ThreatIntelTypes').StrideCategory,
      riskLevel: 'High' as import('../../types/GrcTypes').AttackPathRiskLevel,
      description: 'An attacker or malicious insider accesses a Vertex AI notebook where service account keys are stored on disk at /home/jupyter. The extracted key grants persistent API access to BigQuery from outside the GCP project, bypassing VPC Service Controls since the analytics project is excluded from the perimeter.',
      steps: [
        { order: 1, edgeId: 'e22', sourceNodeId: 'vertex-ai', targetNodeId: 'bigquery-warehouse', technique: 'T1552: Unsecured Credentials' },
      ],
      mitreTechniques: ['T1552', 'T1530'],
      createdAt: '2025-06-01T00:05:00.000Z',
      updatedAt: '2025-06-01T00:05:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-public-storage-scrape',
      name: 'Public Cloud Storage ACL → Raw Telemetry Exfiltration',
      strideCategory: 'Information Disclosure' as import('../../types/ThreatIntelTypes').StrideCategory,
      riskLevel: 'High' as import('../../types/GrcTypes').AttackPathRiskLevel,
      description: 'Legacy public-read ACLs on the Cloud Storage landing bucket allow any unauthenticated user to download raw JSON telemetry files containing PII. The DLP scanning pipeline is paused so sensitive data patterns go undetected, and the broken logging sink means access is not audited.',
      steps: [
        { order: 1, edgeId: 'e11', sourceNodeId: 'gke-stream', targetNodeId: 'gcp-storage-bucket', technique: 'T1530: Data from Cloud Storage Object' },
        { order: 2, edgeId: 'e23', sourceNodeId: 'gcp-storage-bucket', targetNodeId: 'cloud-dlp', technique: 'T1562: Impair Defenses (DLP scanning paused)' },
      ],
      mitreTechniques: ['T1530', 'T1562'],
      createdAt: '2025-06-01T00:10:00.000Z',
      updatedAt: '2025-06-01T00:10:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-cloudsql-unencrypted',
      name: 'Unencrypted Cloud SQL → Application State Compromise',
      strideCategory: 'Tampering' as import('../../types/ThreatIntelTypes').StrideCategory,
      riskLevel: 'Medium' as import('../../types/GrcTypes').AttackPathRiskLevel,
      description: 'Cloud SQL has a public IP with SSL enforcement disabled. An attacker on the network path between Cloud Run and Cloud SQL can intercept or tamper with PostgreSQL queries containing application state and potentially customer data, while the broken logging sink prevents detection.',
      steps: [
        { order: 1, edgeId: 'e9', sourceNodeId: 'cloud-run-api', targetNodeId: 'cloud-sql', technique: 'T1557: Adversary-in-the-Middle' },
        { order: 2, edgeId: 'e15', sourceNodeId: 'cloud-run-api', targetNodeId: 'cloud-logging', technique: 'T1562: Impair Defenses (broken logging sink)' },
      ],
      mitreTechniques: ['T1557', 'T1562'],
      createdAt: '2025-06-01T00:15:00.000Z',
      updatedAt: '2025-06-01T00:15:00.000Z',
    } as DiagramAttackPath,
  ],
};
