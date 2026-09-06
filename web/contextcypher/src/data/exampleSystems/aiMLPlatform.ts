import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityNode, SecurityEdge, SecurityZone } from '../../types/SecurityTypes';
import { DiagramAttackPath, AssessmentThreatModelNodeSourceType, AssessmentThreatModelEdgeSourceType, AttackPathRiskLevel, GrcWorkspace } from '../../types/GrcTypes';
import { colors } from '../../styles/Theme';
import { buildGrcWorkspace, score, NOW, OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID } from './grcSharedBase';
import { StrideCategory } from '../../types/ThreatIntelTypes';
const tierCatalogue = [
  { id: 'aiml-tier1-cyber', tier: 1 as const, label: 'Cyber Risk', description: 'Information security and cyber threats to AI/ML systems' },
  { id: 'aiml-tier1-operational', tier: 1 as const, label: 'Operational Risk', description: 'Business operations and ML lifecycle risks' },
  { id: 'aiml-tier1-compliance', tier: 1 as const, label: 'Compliance Risk', description: 'Regulatory and AI ethics compliance' },
  { id: 'aiml-tier2-model-security', tier: 2 as const, label: 'Model Security', parentId: 'aiml-tier1-cyber', description: 'Threats to model integrity, confidentiality, and availability' },
  { id: 'aiml-tier2-data-pipeline', tier: 2 as const, label: 'Data Pipeline Security', parentId: 'aiml-tier1-cyber', description: 'Training data integrity and pipeline protection' },
  { id: 'aiml-tier2-inference', tier: 2 as const, label: 'Inference Security', parentId: 'aiml-tier1-cyber', description: 'Production inference endpoint and serving security' },
  { id: 'aiml-tier2-identity', tier: 2 as const, label: 'Identity & Access', parentId: 'aiml-tier1-cyber', description: 'Authentication and authorization for ML platform services' },
  { id: 'aiml-tier2-training-infra', tier: 2 as const, label: 'Training Infrastructure', parentId: 'aiml-tier1-operational', description: 'GPU cluster and distributed training security' },
  { id: 'aiml-tier2-supply-chain', tier: 2 as const, label: 'ML Supply Chain', parentId: 'aiml-tier1-operational', description: 'Third-party models, dependencies, and framework risks' },
  { id: 'aiml-tier2-monitoring', tier: 2 as const, label: 'ML Monitoring', parentId: 'aiml-tier1-operational', description: 'Model drift, performance, and anomaly detection' },
  { id: 'aiml-tier2-ai-governance', tier: 2 as const, label: 'AI Governance', parentId: 'aiml-tier1-compliance', description: 'AI ethics, fairness, and responsible AI practices' },
  { id: 'aiml-tier3-model-poisoning', tier: 3 as const, label: 'Model Poisoning', parentId: 'aiml-tier2-model-security' },
  { id: 'aiml-tier3-adversarial-inputs', tier: 3 as const, label: 'Adversarial Inputs', parentId: 'aiml-tier2-inference' },
  { id: 'aiml-tier3-model-theft', tier: 3 as const, label: 'Model Theft & Extraction', parentId: 'aiml-tier2-model-security' },
  { id: 'aiml-tier3-data-leakage', tier: 3 as const, label: 'Inference Data Leakage', parentId: 'aiml-tier2-inference' },
  { id: 'aiml-tier3-training-data-manipulation', tier: 3 as const, label: 'Training Data Manipulation', parentId: 'aiml-tier2-data-pipeline' },
  { id: 'aiml-tier3-gpu-compromise', tier: 3 as const, label: 'GPU Cluster Compromise', parentId: 'aiml-tier2-training-infra' },
  { id: 'aiml-tier3-malicious-weights', tier: 3 as const, label: 'Malicious Model Weights', parentId: 'aiml-tier2-supply-chain' },
  { id: 'aiml-tier3-prompt-injection', tier: 3 as const, label: 'Prompt Injection', parentId: 'aiml-tier2-inference' },
  { id: 'aiml-tier3-notebook-escape', tier: 3 as const, label: 'Notebook Environment Escape', parentId: 'aiml-tier2-training-infra' },
];

const assets = [
  {
    id: 'aiml-asset-model-registry', name: 'Production Model Registry', type: 'model_registry', owner: 'MLOps Team',
    domain: 'application' as const, category: 'ML Infrastructure',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Central model versioning and metadata store powered by MLflow, managing 500+ production models with artifact storage.',
    criticality: { confidentiality: 5, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 3 },
    diagramRefs: [{ diagramId: 'ai-ml-platform', nodeId: 'model-registry-prod', nodeLabel: 'Production Model Registry', nodeType: 'modelRegistry' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'aiml-asset-training-cluster', name: 'GPU Training Cluster', type: 'compute_cluster', owner: 'Infrastructure Team',
    domain: 'it' as const, category: 'Compute',
    businessCriticality: 5, securityCriticality: 5,
    description: '1,000 A100 GPU distributed training cluster with InfiniBand interconnect. Training jobs share GPU memory without isolation.',
    criticality: { confidentiality: 4, integrity: 5, availability: 5, financial: 5, reputation: 4, safety: 2 },
    diagramRefs: [{ diagramId: 'ai-ml-platform', nodeId: 'distributed-training', nodeLabel: 'GPU Training Cluster', nodeType: 'computeCluster' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'aiml-asset-feature-store', name: 'Online Feature Store', type: 'feature_store', owner: 'Data Engineering',
    domain: 'application' as const, category: 'ML Infrastructure',
    businessCriticality: 5, securityCriticality: 4,
    description: 'Low-latency feature serving with 50,000+ engineered features. Feature values cached indefinitely without TTL.',
    criticality: { confidentiality: 4, integrity: 5, availability: 5, financial: 4, reputation: 3, safety: 2 },
    diagramRefs: [{ diagramId: 'ai-ml-platform', nodeId: 'feature-store-prod', nodeLabel: 'Online Feature Store', nodeType: 'featureStore' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'aiml-asset-inference-api', name: 'ML Inference API', type: 'api_gateway', owner: 'Platform Engineering',
    domain: 'application' as const, category: 'API',
    businessCriticality: 5, securityCriticality: 5,
    description: 'ML API Gateway serving 2B predictions daily. Rate limiting bypassed for VIP customers using special headers.',
    criticality: { confidentiality: 3, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 3 },
    diagramRefs: [{ diagramId: 'ai-ml-platform', nodeId: 'api-gateway', nodeLabel: 'ML API Gateway', nodeType: 'apiGateway' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'aiml-asset-data-pipeline', name: 'Training Data Lake', type: 'data_lake', owner: 'Data Engineering',
    domain: 'application' as const, category: 'Storage',
    businessCriticality: 5, securityCriticality: 5,
    description: '10PB training data lake with Delta Lake format. PII data not fully anonymized in some datasets.',
    criticality: { confidentiality: 5, integrity: 5, availability: 4, financial: 5, reputation: 5, safety: 2 },
    diagramRefs: [{ diagramId: 'ai-ml-platform', nodeId: 'training-data-lake', nodeLabel: 'Training Data Lake', nodeType: 'dataLake' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'aiml-asset-experiment-tracker', name: 'Experiment Tracking', type: 'monitoring', owner: 'Data Science',
    domain: 'application' as const, category: 'ML Infrastructure',
    businessCriticality: 3, securityCriticality: 3,
    description: 'Weights & Biases experiment management system tracking hyperparameters, metrics, and model lineage.',
    criticality: { confidentiality: 3, integrity: 4, availability: 3, financial: 2, reputation: 2, safety: 1 },
    diagramRefs: [{ diagramId: 'ai-ml-platform', nodeId: 'experiment-tracking', nodeLabel: 'Experiment Tracking', nodeType: 'monitor' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'aiml-asset-gpu-cluster', name: 'Cloud ML Services', type: 'cloud_service', owner: 'Cloud Operations',
    domain: 'it' as const, category: 'Cloud Service',
    businessCriticality: 4, securityCriticality: 4,
    description: 'Multi-cloud ML services across SageMaker, Azure ML, and Vertex AI. IAM roles allow cross-account access for convenience.',
    criticality: { confidentiality: 4, integrity: 4, availability: 4, financial: 4, reputation: 3, safety: 1 },
    diagramRefs: [
      { diagramId: 'ai-ml-platform', nodeId: 'sagemaker', nodeLabel: 'AWS SageMaker', nodeType: 'cloudService' },
      { diagramId: 'ai-ml-platform', nodeId: 'azure-ml', nodeLabel: 'Azure ML Studio', nodeType: 'cloudService' },
    ],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'aiml-asset-model-serving', name: 'Model Serving Infrastructure', type: 'inference_server', owner: 'MLOps Team',
    domain: 'application' as const, category: 'ML Infrastructure',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Triton and TorchServe clusters serving production models. TorchServe management API exposed without authentication on port 8081.',
    criticality: { confidentiality: 4, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 3 },
    diagramRefs: [
      { diagramId: 'ai-ml-platform', nodeId: 'triton-server-1', nodeLabel: 'Triton Inference Server 1', nodeType: 'mlInference' },
      { diagramId: 'ai-ml-platform', nodeId: 'torchserve', nodeLabel: 'TorchServe Cluster', nodeType: 'mlInference' },
    ],
    createdAt: NOW, updatedAt: NOW
  },
];

const risks = [
  {
    id: 'aiml-risk-model-poisoning', title: 'Model Poisoning via Compromised Training Pipeline',
    description: 'Attacker compromises Kubeflow pipeline running with cluster-admin privileges to inject poisoned training data or tampered model weights, causing misclassification in production fraud detection and recommendation models.',
    status: 'assessed' as const, owner: 'MLOps Team',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Model Security', tier3: 'Model Poisoning' },
    assetIds: ['aiml-asset-model-registry', 'aiml-asset-training-cluster'],
    diagramLinks: [{ diagramId: 'ai-ml-platform', nodeIds: ['kubeflow-pipeline', 'distributed-training', 'model-registry-prod'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Implement model integrity verification with cryptographic signing, add training data validation checksums, restrict Kubeflow pipeline to least-privilege ServiceAccount',
    threatActorIds: ['aiml-threat-actor-nation-state'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'aiml-risk-training-data-manipulation', title: 'Training Data Manipulation via Data Labeling Platform',
    description: 'Crowdsourced data labeling platform exports labeled data to S3 with public-read ACLs. Attacker tampers with labeled datasets in transit or at rest, degrading model accuracy across all downstream training jobs.',
    status: 'assessed' as const, owner: 'Data Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Data Pipeline Security', tier3: 'Training Data Manipulation' },
    assetIds: ['aiml-asset-data-pipeline'],
    diagramLinks: [{ diagramId: 'ai-ml-platform', nodeIds: ['data-labeling', 'training-data-lake'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Remove public-read ACLs from labeled data buckets, implement data integrity checksums at ingestion, add anomaly detection on label distributions',
    threatActorIds: ['aiml-threat-actor-competitor'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'aiml-risk-adversarial-inputs', title: 'Adversarial Input Attacks on Inference Endpoints',
    description: 'ML-Aware WAF has prompt injection detection disabled for performance. Adversarial inputs crafted to exploit model vulnerabilities bypass WAF and reach Triton/TorchServe servers, causing incorrect predictions for fraud detection and autonomous systems.',
    status: 'assessed' as const, owner: 'Platform Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Inference Security', tier3: 'Adversarial Inputs' },
    assetIds: ['aiml-asset-inference-api', 'aiml-asset-model-serving'],
    diagramLinks: [{ diagramId: 'ai-ml-platform', nodeIds: ['waf-ml', 'triton-server-1', 'torchserve'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Re-enable prompt injection detection in WAF, deploy adversarial input validation layer, implement model confidence thresholds with fallback logic',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'aiml-risk-model-theft', title: 'Model Theft via Exposed TorchServe Management API',
    description: 'TorchServe management API is exposed without authentication on port 8081. Attacker accesses management endpoint to enumerate and download proprietary model artifacts worth millions in R&D investment.',
    status: 'assessed' as const, owner: 'MLOps Team',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Model Security', tier3: 'Model Theft & Extraction' },
    assetIds: ['aiml-asset-model-serving', 'aiml-asset-model-registry'],
    diagramLinks: [{ diagramId: 'ai-ml-platform', nodeIds: ['torchserve', 'external-users'] }],
    inherentScore: score('likelihood-5', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Restrict TorchServe management API to localhost, implement mTLS authentication, add network policy blocking external access to port 8081',
    threatActorIds: ['aiml-threat-actor-competitor'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'aiml-risk-inference-data-leakage', title: 'Data Leakage Through Model Inference Responses',
    description: 'Models trained on sensitive PII data leak training data through inference responses. Monitoring dashboard exports metrics to public endpoint without authentication, exposing model internals and performance data.',
    status: 'assessed' as const, owner: 'Data Science',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Inference Security', tier3: 'Inference Data Leakage' },
    assetIds: ['aiml-asset-model-serving', 'aiml-asset-data-pipeline'],
    diagramLinks: [{ diagramId: 'ai-ml-platform', nodeIds: ['triton-server-1', 'monitoring-prod', 'training-data-lake'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Apply differential privacy to model outputs, restrict monitoring dashboard to internal network, implement output sanitization for PII patterns',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'aiml-risk-gpu-cluster-compromise', title: 'GPU Cluster Compromise via Shared Memory Exploitation',
    description: 'Training jobs share GPU memory without isolation on the DGX cluster. Attacker compromises one training job to read GPU memory of adjacent jobs, extracting model weights, training data, and hyperparameters from other tenants.',
    status: 'draft' as const, owner: 'Infrastructure Team',
    tierPath: { tier1: 'Operational Risk', tier2: 'Training Infrastructure', tier3: 'GPU Cluster Compromise' },
    assetIds: ['aiml-asset-training-cluster'],
    diagramLinks: [{ diagramId: 'ai-ml-platform', nodeIds: ['distributed-training'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Enable MIG (Multi-Instance GPU) partitioning, implement CUDA MPS with memory isolation, deploy container-level GPU access controls',
    threatActorIds: ['aiml-threat-actor-insider'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'aiml-risk-supply-chain-weights', title: 'Supply Chain Attack via Malicious Pre-trained Model Weights',
    description: 'Models imported from HuggingFace Hub through the Model Marketplace use pickle serialization which allows arbitrary code execution. Debug headers on Model Serving Gateway expose internal model versions and paths.',
    status: 'assessed' as const, owner: 'Security Engineering',
    tierPath: { tier1: 'Operational Risk', tier2: 'ML Supply Chain', tier3: 'Malicious Model Weights' },
    assetIds: ['aiml-asset-model-registry', 'aiml-asset-model-serving'],
    diagramLinks: [{ diagramId: 'ai-ml-platform', nodeIds: ['model-marketplace', 'model-gateway', 'proprietary-models'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Ban pickle deserialization for imported models, mandate SafeTensors format, implement model provenance verification, strip debug headers from gateway responses',
    threatActorIds: ['aiml-threat-actor-nation-state'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'aiml-risk-prompt-injection', title: 'Prompt Injection on LLM Fine-tuning Service',
    description: 'LLM fine-tuning service trains on customer conversations without consent. Prompt injection attacks through training data or inference requests cause LLM to leak confidential training data or execute unintended instructions.',
    status: 'assessed' as const, owner: 'Data Science',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Inference Security', tier3: 'Prompt Injection' },
    assetIds: ['aiml-asset-data-pipeline', 'aiml-asset-model-serving'],
    diagramLinks: [{ diagramId: 'ai-ml-platform', nodeIds: ['llm-finetuning', 'training-data-lake', 'waf-ml'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Implement input sanitization for LLM training data, deploy prompt injection detection in WAF, add output filtering for sensitive data patterns, obtain consent for training data usage',
    createdAt: NOW, updatedAt: NOW
  },
];

const assessments = [
  {
    id: 'aiml-assessment-platform-review', title: 'Enterprise AI/ML Platform Security Assessment',
    status: 'in_review' as const,
    owner: 'Security Architecture',
    reviewer: 'CISO',
    startDate: '2025-05-01',
    dueDate: '2025-07-15',
    threatActorIds: ['aiml-threat-actor-competitor', 'aiml-threat-actor-nation-state', 'aiml-threat-actor-insider'],
    methodologyNote: 'Assessment follows OWASP ML Top 10 and MITRE ATLAS framework with NIST AI RMF alignment.',
    assumptionNote: 'Assessment covers production ML infrastructure. Development and staging environments excluded from scope.',
    scopeItems: [
      { id: 'aiml-scope-platform', type: 'system' as const, value: 'system', name: 'Enterprise AI/ML Platform' },
      { id: 'aiml-scope-prod', type: 'diagram_segment' as const, value: 'Production', name: 'ML Production Zone' },
      { id: 'aiml-scope-restricted', type: 'diagram_segment' as const, value: 'Restricted', name: 'Restricted Model Vault Zone' },
    ],
    tierFilter: { tier1: 'Cyber Risk' },
    riskManagementPlan: {
      objective: 'Remediate critical model security gaps, close inference endpoint exposures, and harden ML supply chain.',
      strategy: 'Prioritize model theft and poisoning risks first, then address inference security and supply chain integrity.',
      residualRiskStatement: 'Residual risk accepted for legacy pickle-format models pending migration to SafeTensors with active scanning.',
      monitoringApproach: 'Weekly model security scan reviews and bi-weekly adversarial testing of production endpoints.',
      communicationPlan: 'Report to AI Security Steering Committee every two weeks with quarterly board presentation.',
      reviewCadenceDays: 14,
      actions: [
        {
          id: 'aiml-rmp-action-torchserve',
          title: 'Restrict TorchServe management API to authenticated internal access only',
          owner: 'MLOps Team',
          dueDate: '2025-06-01',
          status: 'in_progress' as const,
          linkedRiskIds: ['aiml-risk-model-theft'],
          notes: 'Network policy drafted; awaiting Istio sidecar injection for mTLS'
        },
        {
          id: 'aiml-rmp-action-pipeline-rbac',
          title: 'Replace cluster-admin on Kubeflow pipelines with scoped ServiceAccount',
          owner: 'Infrastructure Team',
          dueDate: '2025-06-15',
          status: 'planned' as const,
          linkedRiskIds: ['aiml-risk-model-poisoning'],
          notes: 'Need to enumerate required K8s RBAC verbs from audit logs'
        },
        {
          id: 'aiml-rmp-action-safetensors',
          title: 'Mandate SafeTensors format and ban pickle deserialization for imported models',
          owner: 'Security Engineering',
          dueDate: '2025-06-30',
          status: 'in_progress' as const,
          linkedRiskIds: ['aiml-risk-supply-chain-weights'],
          notes: 'SafeTensors converter deployed; 73% of models migrated'
        },
        {
          id: 'aiml-rmp-action-waf-prompt',
          title: 'Re-enable prompt injection detection rules in ML-Aware WAF',
          owner: 'Platform Engineering',
          dueDate: '2025-06-10',
          status: 'done' as const,
          linkedRiskIds: ['aiml-risk-prompt-injection', 'aiml-risk-adversarial-inputs'],
          notes: 'Rules re-enabled with performance-optimized regex patterns'
        },
      ],
      updatedAt: NOW
    },
    riskIds: risks.map(r => r.id),
    soaGapIds: ['aiml-soa-a01', 'aiml-soa-a04', 'aiml-soa-a08'],
    taskIds: ['aiml-task-torchserve-auth', 'aiml-task-pipeline-rbac', 'aiml-task-safetensors-migration'],
    linkedImplementedControlIds: [],
    linkedInitiativeIds: [],
    summary: 'Security assessment of Enterprise AI/ML Platform identifying 8 risks across model security, inference endpoints, training infrastructure, and ML supply chain. 3 rated Critical, 3 High.',
    findings: 'Key findings include unauthenticated TorchServe management API exposing model theft, Kubeflow pipelines with cluster-admin privileges enabling model poisoning, pickle deserialization risk in imported models, and disabled WAF prompt injection detection.',
    recommendations: 'Prioritize TorchServe API lockdown and Kubeflow RBAC scoping, mandate SafeTensors migration, restore WAF detection rules, and implement GPU memory isolation for training workloads.',
    evidenceSummary: 'Evidence includes Kubernetes RBAC exports, TorchServe management API scan results, WAF configuration snapshots, model serialization format audit, and GPU memory isolation test reports.',
    threatModel: {
      nodes: [
        { id: 'aiml-tm-node-external', label: 'External API Clients', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'external-users', position: { x: 50, y: 150 }, nodeType: 'endpoint' },
        { id: 'aiml-tm-node-marketplace', label: 'Model Marketplace', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'model-marketplace', position: { x: 50, y: 350 }, nodeType: 'cloudService', commentary: 'Third-party models with pickle serialization' },
        { id: 'aiml-tm-node-gateway', label: 'ML API Gateway', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'api-gateway', position: { x: 250, y: 150 }, nodeType: 'apiGateway', commentary: 'Rate limiting bypassed for VIP customers' },
        { id: 'aiml-tm-node-waf', label: 'ML-Aware WAF', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'waf-ml', position: { x: 250, y: 350 }, nodeType: 'waf', commentary: 'Prompt injection detection disabled' },
        { id: 'aiml-tm-node-triton', label: 'Triton Inference', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'triton-server-1', position: { x: 450, y: 150 }, nodeType: 'mlInference', commentary: 'Model loading from shared NFS without auth' },
        { id: 'aiml-tm-node-torchserve', label: 'TorchServe Cluster', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'torchserve', position: { x: 450, y: 300 }, nodeType: 'mlInference', commentary: 'Management API exposed on port 8081' },
        { id: 'aiml-tm-node-vault', label: 'Proprietary Model Vault', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'proprietary-models', position: { x: 650, y: 150 }, nodeType: 'modelVault', commentary: 'Encryption keys in same vault namespace' },
      ],
      edges: [
        { id: 'aiml-tm-edge-ext-gw', source: 'aiml-tm-node-external', target: 'aiml-tm-node-gateway', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e1', label: 'API Requests (HTTPS)', commentary: 'VIP header bypasses rate limiting' },
        { id: 'aiml-tm-edge-gw-waf', source: 'aiml-tm-node-gateway', target: 'aiml-tm-node-waf', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e4', label: 'WAF Check (HTTP)', commentary: 'Prompt injection rules disabled' },
        { id: 'aiml-tm-edge-waf-triton', source: 'aiml-tm-node-waf', target: 'aiml-tm-node-triton', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'e5', label: 'Clean Traffic (gRPC)' },
        { id: 'aiml-tm-edge-ext-torchserve', source: 'aiml-tm-node-external', target: 'aiml-tm-node-torchserve', sourceType: 'manual' as AssessmentThreatModelEdgeSourceType, label: 'Mgmt API (8081)', commentary: 'Unauthenticated direct access to management API' },
        { id: 'aiml-tm-edge-marketplace-vault', source: 'aiml-tm-node-marketplace', target: 'aiml-tm-node-vault', sourceType: 'manual' as AssessmentThreatModelEdgeSourceType, label: 'Model Import Path', commentary: 'Pickle deserialization of untrusted models' },
      ],
      attackPathDescription: 'Four critical attack chains: (1) External client WAF bypass to adversarial inference; (2) Direct TorchServe management API exploitation for model theft; (3) Supply chain model poisoning via HuggingFace marketplace; (4) Notebook environment escape to proprietary model exfiltration.',
      attackPaths: [
        {
          id: 'aiml-aap-waf-bypass-adversarial',
          name: 'WAF Bypass → Adversarial Inference Attack',
          strideCategory: 'Tampering' as StrideCategory,
          riskLevel: 'High' as AttackPathRiskLevel,
          description: 'Attacker crafts adversarial inputs that bypass disabled WAF prompt injection rules, reaches Triton inference server, causes misclassification in fraud detection models affecting financial decisions.',
          diagramAttackPathId: 'aiml-ap-waf-bypass-adversarial',
          steps: [
            { order: 1, edgeId: 'e1', sourceNodeId: 'external-users', targetNodeId: 'api-gateway', technique: 'T1190: Exploit Public-Facing Application' },
            { order: 2, edgeId: 'e4', sourceNodeId: 'api-gateway', targetNodeId: 'waf-ml', technique: 'T1562: Impair Defenses' },
            { order: 3, edgeId: 'e5', sourceNodeId: 'waf-ml', targetNodeId: 'triton-server-1', technique: 'T1565: Data Manipulation' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
        {
          id: 'aiml-aap-torchserve-theft',
          name: 'TorchServe Mgmt API → Model Theft',
          strideCategory: 'Information Disclosure' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'Attacker directly accesses the unauthenticated TorchServe management API on port 8081, enumerates all loaded models, and downloads proprietary model artifacts representing millions in R&D investment.',
          diagramAttackPathId: 'aiml-ap-torchserve-theft',
          steps: [
            { order: 1, edgeId: 'e26', sourceNodeId: 'external-users', targetNodeId: 'torchserve', technique: 'T1190: Exploit Public-Facing Application' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
        {
          id: 'aiml-aap-supply-chain-poisoning',
          name: 'Model Marketplace → Supply Chain Poisoning',
          strideCategory: 'Tampering' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'Nation-state actor publishes backdoored model weights on HuggingFace Hub using pickle serialization. Model imported through marketplace, passes through gateway debug headers revealing internal paths, stored in proprietary vault with shared encryption keys.',
          diagramAttackPathId: 'aiml-ap-supply-chain-poisoning',
          steps: [
            { order: 1, edgeId: 'e3', sourceNodeId: 'model-marketplace', targetNodeId: 'model-gateway', technique: 'T1195: Supply Chain Compromise' },
            { order: 2, edgeId: 'e17', sourceNodeId: 'kubeflow-pipeline', targetNodeId: 'proprietary-models', technique: 'T1059: Command and Scripting Interpreter' },
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
    id: 'aiml-soa-a01', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A01', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'TorchServe management API unauthenticated on port 8081. Kubeflow pipelines run with cluster-admin privileges. Model Serving Gateway debug headers expose internal paths.',
    mitigatesRiskIds: ['aiml-risk-model-theft', 'aiml-risk-model-poisoning'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'aiml-soa-a02', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A02', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Model encryption keys stored in same Vault namespace as models. Feature store Redis connections unencrypted within VPC. LLM training data includes unredacted customer conversations.',
    mitigatesRiskIds: ['aiml-risk-inference-data-leakage'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'aiml-soa-a03', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A03', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'WAF prompt injection detection disabled for performance. Adversarial input validation not deployed on inference endpoints. Legacy models use pickle deserialization allowing code execution.',
    mitigatesRiskIds: ['aiml-risk-prompt-injection', 'aiml-risk-adversarial-inputs'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'aiml-soa-a04', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A04', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'No adversarial robustness testing in CI/CD pipeline. Model security scanner exists but is not integrated into deployment workflow. GPU memory isolation not enforced.',
    mitigatesRiskIds: ['aiml-risk-adversarial-inputs', 'aiml-risk-gpu-cluster-compromise'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'aiml-soa-a05', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A05', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Notebooks can install arbitrary packages and access production databases. Data labeling exports use public-read S3 ACLs. Monitoring metrics exported to public dashboard.',
    mitigatesRiskIds: ['aiml-risk-training-data-manipulation', 'aiml-risk-inference-data-leakage'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'aiml-soa-a06', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A06', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'planned' as const,
    justification: 'Legacy models still using pickle serialization. Some third-party model dependencies not scanned. TorchServe and Triton versions trailing latest security patches.',
    mitigatesRiskIds: ['aiml-risk-supply-chain-weights'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'aiml-soa-a08', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A08', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'No model provenance tracking for imported weights. Model versioning inconsistent across frameworks. S3 model storage has bucket versioning disabled.',
    mitigatesRiskIds: ['aiml-risk-supply-chain-weights', 'aiml-risk-model-poisoning'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'aiml-soa-a09', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A09', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'ML monitoring deployed but metrics exported to unauthenticated public endpoint. Model drift detection alerts not correlated with security events. Experiment tracking lacks audit trail.',
    mitigatesRiskIds: ['aiml-risk-inference-data-leakage'],
    diagramRefs: [
      { diagramId: 'ai-ml-platform', nodeId: 'monitoring-prod', nodeLabel: 'ML Monitoring', nodeType: 'monitor' }
    ],
    evidence: [
      { id: 'aiml-evidence-monitoring-config', kind: 'link' as const, name: 'Datadog ML monitoring configuration export', url: 'https://security.example.internal/reports/ml-monitoring-config', note: 'Monthly review', createdAt: NOW }
    ],
    updatedAt: NOW
  },
  {
    id: 'aiml-soa-cis03', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.03', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Training data lake contains un-anonymized PII. LLM fine-tuning uses customer conversations without consent. Labeled data exported with public-read ACLs.',
    mitigatesRiskIds: ['aiml-risk-training-data-manipulation', 'aiml-risk-prompt-injection'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'aiml-soa-cis04', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.04', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Kubeflow pipelines run with cluster-admin. TorchServe management API exposed without authentication. Triton loads models from shared NFS without verification. GPU memory isolation disabled.',
    mitigatesRiskIds: ['aiml-risk-model-poisoning', 'aiml-risk-model-theft', 'aiml-risk-gpu-cluster-compromise'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
];

const workflowTasks = [
  {
    id: 'aiml-task-torchserve-auth',
    title: 'Restrict TorchServe management API with mTLS and network policy',
    description: 'Deploy Istio sidecar for mTLS on management port, add NetworkPolicy blocking external access to port 8081.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'critical' as const,
    owner: 'MLOps Team',
    dueDate: '2025-06-01',
    riskId: 'aiml-risk-model-theft',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'aiml-task-pipeline-rbac',
    title: 'Scope Kubeflow pipeline ServiceAccount to least-privilege RBAC',
    description: 'Enumerate required Kubernetes API verbs from audit logs and replace cluster-admin binding.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'critical' as const,
    owner: 'Infrastructure Team',
    dueDate: '2025-06-15',
    riskId: 'aiml-risk-model-poisoning',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'aiml-task-safetensors-migration',
    title: 'Complete migration from pickle to SafeTensors format',
    description: 'Convert remaining 27% of models to SafeTensors, block pickle deserialization in model import pipeline.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'high' as const,
    owner: 'Security Engineering',
    dueDate: '2025-06-30',
    riskId: 'aiml-risk-supply-chain-weights',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'aiml-task-waf-prompt-rules',
    title: 'Deploy optimized prompt injection detection rules in WAF',
    description: 'Re-enable prompt injection rules with performance-optimized regex; validate P99 latency impact < 5ms.',
    type: 'control_implementation' as const,
    status: 'done' as const,
    priority: 'high' as const,
    owner: 'Platform Engineering',
    dueDate: '2025-05-30',
    riskId: 'aiml-risk-prompt-injection',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'aiml-task-gpu-isolation',
    title: 'Enable MIG partitioning and CUDA MPS memory isolation on GPU cluster',
    description: 'Configure Multi-Instance GPU partitioning on A100 fleet; enforce per-container GPU memory limits.',
    type: 'risk_treatment' as const,
    status: 'blocked' as const,
    priority: 'medium' as const,
    owner: 'Infrastructure Team',
    dueDate: '2025-07-15',
    riskId: 'aiml-risk-gpu-cluster-compromise',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'aiml-task-monitoring-auth',
    title: 'Restrict ML monitoring dashboard to authenticated internal access',
    description: 'Add authentication proxy to Datadog public dashboard endpoint; migrate to internal-only metrics export.',
    type: 'control_implementation' as const,
    status: 'todo' as const,
    priority: 'medium' as const,
    owner: 'MLOps Team',
    dueDate: '2025-06-20',
    riskId: 'aiml-risk-inference-data-leakage',
    createdAt: NOW, updatedAt: NOW
  },
];

const governanceDocuments = [
  {
    id: 'aiml-gov-ai-ethics', title: 'AI Ethics and Responsible AI Policy',
    type: 'policy' as const,
    description: 'Enterprise policy governing ethical AI development, fairness requirements, bias testing mandates, and transparency obligations for all production ML models.',
    owner: 'Chief AI Ethics Officer',
    reviewDate: '2025-03-01',
    nextReviewDate: '2025-09-01',
    status: 'active' as const,
    version: '2.1',
    url: 'https://docs.example.internal/policies/ai-ethics-v2.1',
    tags: ['ai-ethics', 'fairness', 'responsible-ai'],
    linkedRiskIds: ['aiml-risk-prompt-injection', 'aiml-risk-inference-data-leakage'],
    linkedControlSetIds: [OWASP_CONTROL_SET_ID],
    linkedAssessmentIds: ['aiml-assessment-platform-review'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'aiml-gov-model-governance', title: 'Model Governance and Lifecycle Standard',
    type: 'standard' as const,
    description: 'Standard defining model development lifecycle, approval gates, model registry requirements, versioning policy, and retirement criteria for all production models.',
    owner: 'Head of MLOps',
    reviewDate: '2025-04-15',
    nextReviewDate: '2025-10-15',
    status: 'active' as const,
    version: '3.0',
    url: 'https://docs.example.internal/standards/model-governance-v3',
    tags: ['model-governance', 'mlops', 'lifecycle'],
    linkedRiskIds: ['aiml-risk-model-poisoning', 'aiml-risk-supply-chain-weights', 'aiml-risk-model-theft'],
    linkedControlSetIds: [OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID],
    linkedAssessmentIds: ['aiml-assessment-platform-review'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'aiml-gov-data-handling', title: 'ML Training Data Handling Procedure',
    type: 'procedure' as const,
    description: 'Procedure for acquisition, labeling, anonymization, and lifecycle management of training data. Includes PII handling requirements, consent verification, and data retention schedules.',
    owner: 'Data Engineering Lead',
    reviewDate: '2025-05-01',
    nextReviewDate: '2025-11-01',
    status: 'under_review' as const,
    version: '1.4',
    url: 'https://docs.example.internal/procedures/training-data-handling-v1.4',
    tags: ['training-data', 'pii', 'anonymization', 'consent'],
    linkedRiskIds: ['aiml-risk-training-data-manipulation', 'aiml-risk-prompt-injection', 'aiml-risk-inference-data-leakage'],
    linkedControlSetIds: [CIS_CONTROL_SET_ID],
    linkedAssessmentIds: ['aiml-assessment-platform-review'],
    createdAt: NOW, updatedAt: NOW
  },
];

const threatActors = [
  {
    id: 'aiml-threat-actor-competitor', name: 'AI Industry Competitor',
    type: 'competitor' as const, capabilityLevel: 4,
    resourceLevel: 'high' as const,
    motivation: 'Steal proprietary model weights and training data to replicate competitive AI capabilities, reducing years of R&D investment to weeks of model extraction.',
    description: 'Well-resourced competitor with ML expertise targeting model theft through exposed management APIs, model extraction via inference queries, and supply chain infiltration through compromised model repositories.',
    targetedAssetIds: ['aiml-asset-model-serving', 'aiml-asset-model-registry', 'aiml-asset-data-pipeline'],
    tags: ['model-theft', 'ip-theft', 'competitive-intelligence'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'aiml-threat-actor-nation-state', name: 'Nation-State ML Attack Group',
    type: 'nation_state' as const, capabilityLevel: 5,
    resourceLevel: 'very_high' as const,
    motivation: 'Compromise ML infrastructure for long-term strategic intelligence collection, model backdooring for future exploitation, and disruption of critical AI-powered decision systems.',
    description: 'Advanced persistent threat group specializing in ML supply chain attacks. Publishes backdoored models on public repositories, targets training pipelines for data poisoning, and exploits GPU cluster vulnerabilities for lateral movement.',
    targetedAssetIds: ['aiml-asset-training-cluster', 'aiml-asset-model-registry', 'aiml-asset-data-pipeline', 'aiml-asset-model-serving'],
    tags: ['apt', 'supply-chain', 'model-backdoor', 'persistent-access'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'aiml-threat-actor-insider', name: 'Disgruntled ML Engineer',
    type: 'insider' as const, capabilityLevel: 4,
    resourceLevel: 'moderate' as const,
    motivation: 'Leverage JupyterHub notebook access and knowledge of platform architecture to exfiltrate proprietary models, training data, or sabotage production model performance before departure.',
    description: 'Current or departing ML engineer with notebook environment access that can install arbitrary packages and reach production databases. Familiar with GPU cluster shared memory architecture and direct access paths to model vault.',
    targetedAssetIds: ['aiml-asset-training-cluster', 'aiml-asset-model-registry', 'aiml-asset-data-pipeline'],
    tags: ['insider-threat', 'notebook-abuse', 'data-exfiltration', 'model-sabotage'],
    createdAt: NOW, updatedAt: NOW
  },
];

const threatScenarios = [
  {
    id: 'aiml-scenario-model-theft', title: 'Competitor Model Extraction via Exposed Management API',
    description: 'Competitor discovers unauthenticated TorchServe management API on port 8081 through network scanning. Enumerates all 500+ loaded models, downloads proprietary weights and configuration files, then replicates competitive AI capabilities using stolen model artifacts.',
    threatActorId: 'aiml-threat-actor-competitor',
    targetedAssetIds: ['aiml-asset-model-serving', 'aiml-asset-model-registry'],
    attackTechniques: ['T1190 - Exploit Public-Facing Application', 'T1005 - Data from Local System', 'T1041 - Exfiltration Over C2 Channel'],
    linkedRiskIds: ['aiml-risk-model-theft', 'aiml-risk-adversarial-inputs'],
    likelihood: 'Very High - TorchServe management API is directly accessible without any authentication.',
    impact: 'Critical - loss of proprietary models representing $500M+ in cumulative R&D investment.',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'aiml-scenario-supply-chain-backdoor', title: 'Nation-State Model Backdoor via HuggingFace Supply Chain',
    description: 'Nation-state actor publishes popular pre-trained model on HuggingFace with hidden backdoor using pickle serialization exploit. Model imported through marketplace, passes through Kubeflow pipeline with cluster-admin privileges, and is deployed to production inference serving backdoored predictions for targeted inputs.',
    threatActorId: 'aiml-threat-actor-nation-state',
    targetedAssetIds: ['aiml-asset-model-registry', 'aiml-asset-model-serving', 'aiml-asset-data-pipeline'],
    attackTechniques: ['T1195 - Supply Chain Compromise', 'T1059 - Command and Scripting Interpreter', 'T1565 - Data Manipulation'],
    linkedRiskIds: ['aiml-risk-supply-chain-weights', 'aiml-risk-model-poisoning'],
    likelihood: 'High - pickle deserialization allows arbitrary code execution; no provenance verification on imported models.',
    impact: 'Critical - backdoored model in production serving manipulated predictions for strategic targets.',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'aiml-scenario-insider-exfiltration', title: 'ML Engineer Notebook-Based Model Exfiltration',
    description: 'Departing ML engineer uses JupyterHub notebook with unrestricted package installation and production database access to directly access proprietary model vault, download model artifacts to notebook environment, and exfiltrate via arbitrary network connection.',
    threatActorId: 'aiml-threat-actor-insider',
    targetedAssetIds: ['aiml-asset-training-cluster', 'aiml-asset-model-registry', 'aiml-asset-data-pipeline'],
    attackTechniques: ['T1078 - Valid Accounts', 'T1005 - Data from Local System', 'T1048 - Exfiltration Over Alternative Protocol'],
    linkedRiskIds: ['aiml-risk-model-theft', 'aiml-risk-gpu-cluster-compromise'],
    likelihood: 'Moderate - requires valid notebook access but notebooks have broad network access and no DLP.',
    impact: 'Major - exfiltration of proprietary models and training data with no audit trail in notebook environment.',
    createdAt: NOW, updatedAt: NOW
  },
];

export const aiMLPlatformGrcWorkspace: GrcWorkspace = buildGrcWorkspace({
  tierCatalogue,
  assets,
  risks,
  assessments,
  soaEntries,
  workflowTasks,
  governanceDocuments,
  threatActors,
  threatScenarios,
  thirdParties: [
    {
      id: 'aiml-tp-nvidia',
      name: 'NVIDIA Corporation',
      description: 'GPU cloud infrastructure provider supplying DGX Cloud instances and A100/H100 GPU clusters for model training and inference workloads. Provides CUDA toolkit, TensorRT optimization, and NGC container registry.',
      category: 'cloud_provider',
      status: 'active',
      riskRating: 'critical',
      dataClassification: 'confidential',
      linkedAssetIds: ['aiml-asset-gpu-cluster', 'aiml-asset-training-cluster', 'aiml-asset-model-serving'],
      linkedRiskIds: ['aiml-risk-gpu-cluster-compromise', 'aiml-risk-model-theft'],
      contactName: 'David Park',
      contactEmail: 'david.park@nvidia-enterprise.example.com',
      contractExpiry: '2027-06-30',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-12-31',
      notes: 'SOC 2 Type II and ISO 27001 certified. Multi-year enterprise agreement for 256 A100 GPUs across 3 availability zones. Dedicated tenant isolation verified. Supply chain risk for GPU firmware updates assessed quarterly. NVIDIA Confidential Computing enabled for sensitive training workloads.'
    },
    {
      id: 'aiml-tp-wandb',
      name: 'Weights & Biases',
      description: 'SaaS experiment tracking and model versioning platform used by all data science teams. Stores experiment metadata, hyperparameters, model metrics, and training run artifacts for 500+ production models.',
      category: 'saas',
      status: 'active',
      riskRating: 'high',
      dataClassification: 'confidential',
      linkedAssetIds: ['aiml-asset-experiment-tracker', 'aiml-asset-model-registry'],
      linkedRiskIds: ['aiml-risk-model-theft', 'aiml-risk-model-poisoning'],
      contactName: 'Sarah Lin',
      contactEmail: 'sarah.lin@wandb.example.com',
      contractExpiry: '2026-12-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-09-30',
      notes: 'Enterprise plan with SSO/SAML integration and private cloud deployment option. Stores model weights metadata and training curves but not raw training data. API keys rotated monthly. Audit logs exported to internal SIEM. Risk elevated due to visibility into model architecture details and performance benchmarks.'
    },
    {
      id: 'aiml-tp-huggingface',
      name: 'Hugging Face Inc.',
      description: 'Model hub and open-source ML library supplier providing pre-trained foundation models, tokenizers, and model cards. Used for transfer learning base models across NLP and computer vision pipelines.',
      category: 'supplier',
      status: 'active',
      riskRating: 'high',
      dataClassification: 'internal',
      linkedAssetIds: ['aiml-asset-model-registry', 'aiml-asset-feature-store'],
      linkedRiskIds: ['aiml-risk-supply-chain-weights', 'aiml-risk-model-poisoning'],
      contactName: 'Antoine Moreau',
      contactEmail: 'antoine.moreau@huggingface.example.com',
      contractExpiry: '2026-09-30',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-06-30',
      notes: 'Enterprise Hub license with private model repositories. Pre-trained model weights are verified via SHA-256 checksums before ingestion into internal model registry. Supply chain risk is elevated — community-contributed models undergo additional adversarial testing before production deployment. Model cards reviewed for licensing compliance.'
    },
    {
      id: 'aiml-tp-databricks',
      name: 'Databricks Inc.',
      description: 'Unified analytics and data pipeline SaaS platform providing lakehouse architecture for feature engineering, ETL pipelines, and data governance. Processes 500TB daily data ingestion across all business units.',
      category: 'saas',
      status: 'active',
      riskRating: 'critical',
      dataClassification: 'restricted',
      linkedAssetIds: ['aiml-asset-data-pipeline', 'aiml-asset-feature-store', 'aiml-asset-training-cluster'],
      linkedRiskIds: ['aiml-risk-training-data-manipulation', 'aiml-risk-inference-data-leakage'],
      contactName: 'Priya Patel',
      contactEmail: 'priya.patel@databricks.example.com',
      contractExpiry: '2027-03-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-12-31',
      notes: 'Enterprise plan with Unity Catalog for data governance. Processes PII and proprietary business data — data residency requirements enforced. Network isolation via PrivateLink. Customer-managed keys for encryption at rest. Shared responsibility model for notebook security reviewed semi-annually. Critical vendor due to central role in data pipeline.'
    },
    {
      id: 'aiml-tp-crowdstrike',
      name: 'CrowdStrike Holdings',
      description: 'Managed security service providing endpoint detection and response (EDR), threat hunting, and incident response for ML infrastructure. Falcon platform deployed across all GPU cluster nodes and data pipeline servers.',
      category: 'managed_service',
      status: 'active',
      riskRating: 'medium',
      dataClassification: 'confidential',
      linkedAssetIds: ['aiml-asset-gpu-cluster', 'aiml-asset-inference-api', 'aiml-asset-data-pipeline'],
      linkedRiskIds: ['aiml-risk-gpu-cluster-compromise', 'aiml-risk-adversarial-inputs'],
      contactName: 'Michael Torres',
      contactEmail: 'michael.torres@crowdstrike.example.com',
      contractExpiry: '2026-12-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-10-31',
      notes: 'Falcon Complete MDR with 24/7 SOC coverage. Custom detection rules for ML-specific threats including model exfiltration patterns and anomalous GPU utilization. Agent deployed on all training and inference nodes. Threat intelligence feeds integrated with internal SIEM. Annual red team exercise included in contract.'
    },
  ],
  securityInitiatives: [
    {
      id: 'aiml-si-model-governance',
      title: 'AI Model Governance and Supply Chain Integrity Program',
      description: 'Establish a comprehensive model governance framework covering model provenance, integrity verification, and supply chain security for all imported and internally-trained models.',
      category: 'transformation' as const,
      status: 'in_progress' as const,
      priority: 'critical' as const,
      owner: 'Security Engineering',
      executiveSponsor: 'VP of Engineering',
      currentState: 'Models imported from HuggingFace via pickle serialization without provenance verification. No cryptographic signing of model artifacts. TorchServe management API exposed without authentication.',
      targetState: 'All models signed with cryptographic attestation, SafeTensors format mandated, model provenance tracked end-to-end, TorchServe management API restricted to authenticated internal access only.',
      startDate: '2025-04-01',
      targetDate: '2025-09-30',
      completedDate: '',
      milestones: [
        { id: 'aiml-ms-safetensors', title: 'Complete SafeTensors migration for all production models', description: 'Convert remaining 27% of models from pickle to SafeTensors format and block pickle deserialization in the import pipeline.', status: 'in_progress' as const, dueDate: '2025-06-30', completedDate: '', owner: 'Security Engineering' },
        { id: 'aiml-ms-model-signing', title: 'Deploy cryptographic model signing pipeline', description: 'Integrate Sigstore/cosign into CI/CD for model artifact signing and verification before deployment to inference servers.', status: 'pending' as const, dueDate: '2025-08-15', completedDate: '', owner: 'MLOps Team' },
        { id: 'aiml-ms-torchserve-lockdown', title: 'Restrict TorchServe management API access', description: 'Deploy Istio sidecar for mTLS on management port and add NetworkPolicy blocking external access to port 8081.', status: 'in_progress' as const, dueDate: '2025-06-01', completedDate: '', owner: 'MLOps Team' },
      ],
      linkedRiskIds: ['aiml-risk-supply-chain-weights', 'aiml-risk-model-theft', 'aiml-risk-model-poisoning'],
      linkedControlSetIds: [],
      linkedAssetIds: ['aiml-asset-model-registry', 'aiml-asset-model-serving'],
      linkedImplementedControlIds: ['aiml-ic-model-scanner'],
      linkedAssessmentIds: ['aiml-assessment-platform-review'],
      notes: 'Initiative aligns with OWASP ML Top 10 and MITRE ATLAS framework. Board-level visibility due to IP protection concerns.',
      createdAt: NOW,
      updatedAt: NOW
    },
    {
      id: 'aiml-si-inference-hardening',
      title: 'ML Inference Endpoint Hardening Initiative',
      description: 'Harden all production inference endpoints against adversarial inputs, prompt injection, and data leakage by deploying defense-in-depth controls across the inference pipeline.',
      category: 'remediation' as const,
      status: 'in_progress' as const,
      priority: 'high' as const,
      owner: 'Platform Engineering',
      executiveSponsor: 'CISO',
      currentState: 'WAF prompt injection detection was disabled for performance. Adversarial input validation not deployed. Monitoring dashboard exports metrics to unauthenticated public endpoint. Models trained on PII data may leak training data through inference responses.',
      targetState: 'WAF prompt injection rules re-enabled with optimized regex. Adversarial input validation layer deployed on all inference endpoints. Monitoring restricted to internal network. Differential privacy applied to model outputs.',
      startDate: '2025-05-01',
      targetDate: '2025-08-31',
      completedDate: '',
      milestones: [
        { id: 'aiml-ms-waf-rules', title: 'Re-enable WAF prompt injection detection', description: 'Deploy performance-optimized prompt injection detection rules in ML-Aware WAF with P99 latency impact under 5ms.', status: 'completed' as const, dueDate: '2025-05-30', completedDate: '2025-05-28', owner: 'Platform Engineering' },
        { id: 'aiml-ms-adversarial-validation', title: 'Deploy adversarial input validation layer', description: 'Implement input validation and sanitization for all Triton and TorchServe inference endpoints.', status: 'in_progress' as const, dueDate: '2025-07-15', completedDate: '', owner: 'Platform Engineering' },
        { id: 'aiml-ms-monitoring-auth', title: 'Restrict ML monitoring dashboard', description: 'Add authentication proxy to Datadog public dashboard endpoint and migrate to internal-only metrics export.', status: 'pending' as const, dueDate: '2025-08-01', completedDate: '', owner: 'MLOps Team' },
      ],
      linkedRiskIds: ['aiml-risk-adversarial-inputs', 'aiml-risk-prompt-injection', 'aiml-risk-inference-data-leakage'],
      linkedControlSetIds: [],
      linkedAssetIds: ['aiml-asset-inference-api', 'aiml-asset-model-serving'],
      linkedImplementedControlIds: ['aiml-ic-waf-prompt-detection', 'aiml-ic-inference-rate-limit'],
      linkedAssessmentIds: ['aiml-assessment-platform-review'],
      notes: 'WAF re-enablement milestone completed ahead of schedule. Adversarial validation testing underway with red team.',
      createdAt: NOW,
      updatedAt: NOW
    },
  ],
  implementedControls: [
    {
      id: 'aiml-ic-model-scanner',
      title: 'Model Artifact Security Scanner',
      description: 'Automated scanning of all model artifacts for malicious payloads, backdoors, and unsafe serialization formats before ingestion into the model registry.',
      controlType: 'technical' as const,
      category: 'monitoring' as const,
      status: 'active' as const,
      automationLevel: 'fully_automated' as const,
      owner: 'Security Engineering',
      vendor: 'ModelScan',
      product: 'ModelScan OSS',
      version: '0.8.1',
      implementedDate: '2025-03-15',
      lastReviewDate: '2025-05-20',
      nextReviewDate: '2025-11-20',
      linkedSoaEntryIds: ['aiml-soa-a08', 'aiml-soa-a06'],
      linkedRiskIds: ['aiml-risk-supply-chain-weights', 'aiml-risk-model-poisoning'],
      linkedAssetIds: ['aiml-asset-model-registry'],
      linkedAssessmentIds: ['aiml-assessment-platform-review'],
      notes: 'Scans for pickle exploits, unsafe ops in TensorFlow SavedModels, and known malicious weight patterns. Integrated into CI/CD pipeline as a mandatory gate.',
      createdAt: NOW,
      updatedAt: NOW
    },
    {
      id: 'aiml-ic-waf-prompt-detection',
      title: 'ML-Aware WAF Prompt Injection Detection',
      description: 'Web application firewall rules specifically designed to detect and block prompt injection attempts, adversarial input patterns, and model evasion techniques targeting ML inference endpoints.',
      controlType: 'technical' as const,
      category: 'network_security' as const,
      status: 'active' as const,
      automationLevel: 'fully_automated' as const,
      owner: 'Platform Engineering',
      vendor: 'Cloudflare',
      product: 'Cloudflare WAF for AI',
      version: '2025.5',
      implementedDate: '2025-05-28',
      lastReviewDate: '2025-05-30',
      nextReviewDate: '2025-11-30',
      linkedSoaEntryIds: ['aiml-soa-a03'],
      linkedRiskIds: ['aiml-risk-prompt-injection', 'aiml-risk-adversarial-inputs'],
      linkedAssetIds: ['aiml-asset-inference-api'],
      linkedAssessmentIds: ['aiml-assessment-platform-review'],
      notes: 'Re-enabled after performance optimization. P99 latency impact measured at 3.2ms. Detection rules cover OWASP LLM Top 10 injection patterns.',
      createdAt: NOW,
      updatedAt: NOW
    },
    {
      id: 'aiml-ic-inference-rate-limit',
      title: 'ML Inference API Rate Limiting and Abuse Detection',
      description: 'Adaptive rate limiting on the ML API Gateway with model-specific thresholds and anomaly detection for potential model extraction attempts via repeated inference queries.',
      controlType: 'technical' as const,
      category: 'access_control' as const,
      status: 'active' as const,
      automationLevel: 'semi_automated' as const,
      owner: 'Platform Engineering',
      vendor: '',
      product: 'Custom (Kong + Prometheus)',
      version: '3.4',
      implementedDate: '2024-11-01',
      lastReviewDate: '2025-04-15',
      nextReviewDate: '2025-10-15',
      linkedSoaEntryIds: ['aiml-soa-a01'],
      linkedRiskIds: ['aiml-risk-model-theft', 'aiml-risk-adversarial-inputs'],
      linkedAssetIds: ['aiml-asset-inference-api', 'aiml-asset-model-serving'],
      linkedAssessmentIds: ['aiml-assessment-platform-review'],
      notes: 'VIP customer rate limit bypass via special headers identified as a gap. Remediation planned to replace header-based bypass with token-bucket per API key.',
      createdAt: NOW,
      updatedAt: NOW
    },
  ],
});

export const aiMLPlatform: ExampleSystem = {
  id: 'ai-ml-platform',
  name: 'Enterprise AI/ML Platform',
  description: 'Global-scale machine learning platform supporting 500+ models across computer vision, NLP, and predictive analytics',
  category: 'AI Systems',
  // securityLevel removed - no longer part of the system model
  primaryZone: 'Production',
  dataClassification: 'Confidential',
  customContext: `# Enterprise AI/ML Platform

## System Overview
This represents a state-of-the-art enterprise machine learning platform deployed by a Fortune 100 technology company. The platform orchestrates the complete ML lifecycle from data ingestion to production inference, serving 2 billion predictions daily across 500+ models.

## Business Context
- **Organization**: Global technology conglomerate with $150B market cap
- **User Base**: 5,000 data scientists, 20,000 developers, 100M end users
- **Model Portfolio**: 500+ production models across 12 business units
- **Data Volume**: 10PB training data, 500TB daily new data ingestion
- **Global Reach**: Deployed across 6 regions, 18 availability zones

## Platform Capabilities
1. **AutoML**: Automated model training and hyperparameter optimization
2. **Model Zoo**: Pre-trained models for transfer learning (GPT, BERT, ResNet)
3. **Feature Store**: 50,000+ engineered features with real-time serving
4. **Experiment Tracking**: Full reproducibility with data/code/model versioning
5. **A/B Testing**: Shadow deployments and gradual rollout capabilities

## Architecture Highlights
- **Multi-Cloud**: Hybrid deployment across AWS, Azure, and on-premise GPU clusters
- **Containerized**: All models deployed as containers with Kubernetes orchestration
- **Event-Driven**: Kafka-based streaming for real-time feature engineering
- **Federated Learning**: Privacy-preserving training across distributed datasets
- **Edge Deployment**: Models optimized for mobile and IoT devices

## ML Use Cases
- **Fraud Detection**: Real-time transaction scoring with 99.95% accuracy
- **Recommendation Engine**: Personalized content serving 100M+ users
- **Computer Vision**: Object detection for autonomous systems
- **NLP Services**: Sentiment analysis, entity extraction, summarization
- **Predictive Maintenance**: Anomaly detection for 10,000+ industrial sensors

## Technology Stack
- **Training**: PyTorch 2.1, TensorFlow 2.14, JAX 0.4
- **Serving**: NVIDIA Triton 23.10, TorchServe 0.9, TensorFlow Serving 2.14
- **MLOps**: Kubeflow 1.8, MLflow 2.8, Weights & Biases
- **Data**: Apache Spark 3.5, Ray 2.8, Dask 2023.11
- **Infrastructure**: Kubernetes 1.28, Istio 1.20, ArgoCD 2.9

## Security Architecture
- **Model Security**: Adversarial robustness testing for all production models
- **Data Privacy**: Differential privacy and homomorphic encryption
- **Access Control**: Fine-grained RBAC with attribute-based policies
- **Supply Chain**: Model provenance tracking and dependency scanning
- **Compliance**: GDPR, CCPA, SOX, HIPAA certified infrastructure

## Operational Metrics
- **Availability**: 99.99% uptime SLA for inference endpoints
- **Latency**: P50: 10ms, P95: 50ms, P99: 200ms
- **Throughput**: 2M requests/second peak capacity
- **GPU Utilization**: 85% average across 1,000 A100 GPUs
- **Cost Efficiency**: $0.0001 per inference, $50 per model training

## Recent Incidents
- Model poisoning attempt detected through anomaly monitoring
- Data exfiltration prevented by DLP scanning training datasets
- Prompt injection attacks mitigated with input sanitization
- Resource exhaustion from adversarial inputs handled by rate limiting
- Supply chain compromise detected in third-party model dependency

## Known Challenges
- Legacy models still using pickle serialization (security risk)
- Some teams bypassing MLOps pipeline for "emergency" deployments
- Notebook environments have broad network access for experimentation
- Model versioning inconsistent across different frameworks
- Cost allocation difficult with shared GPU clusters`,
  nodes: [
    // Security Zones
    // Internet: 3 nodes → 600px, x=50
    // DMZ: 3 nodes → 600px, x=50+600+120=770
    // Production: 6 nodes → 800px, x=770+600+120=1490
    // Internal: 5 nodes → 800px, x=1490+800+120=2410
    // Restricted: 4 nodes → 750px, x=2410+800+120=3330
    // Cloud (below Production): 4 nodes → 750px, x=1490
    {
      id: 'internet-zone',
      type: 'securityZone',
      position: { x: 50, y: 50 },
      data: {
        label: 'Internet Zone',
        zoneType: 'Internet' as SecurityZone,
        description: 'Public internet and external users',
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
        description: 'API gateways and edge services'
      },
      style: {
        width: 600,
        height: 1000,
        background: colors.zoneBackgrounds.DMZ,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'production-zone',
      type: 'securityZone',
      position: { x: 1490, y: 50 },
      data: {
        label: 'Production Zone',
        zoneType: 'Production' as SecurityZone,
        description: 'ML serving infrastructure'
      },
      style: {
        width: 800,
        height: 1000,
        background: colors.zoneBackgrounds.Production,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'internal-zone',
      type: 'securityZone',
      position: { x: 2410, y: 50 },
      data: {
        label: 'Internal Zone',
        zoneType: 'Internal' as SecurityZone,
        description: 'ML training and experimentation'
      },
      style: {
        width: 800,
        height: 1000,
        background: colors.zoneBackgrounds.Internal,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'restricted-zone',
      type: 'securityZone',
      position: { x: 3330, y: 50 },
      data: {
        label: 'Restricted Zone',
        zoneType: 'Restricted' as SecurityZone,
        description: 'Sensitive models and data'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Restricted,
        zIndex: -1
      }
    } as SecurityNode,
    {
      id: 'cloud-zone',
      type: 'securityZone',
      position: { x: 1490, y: 1170 },
      data: {
        label: 'Cloud Zone',
        zoneType: 'Cloud' as SecurityZone,
        description: 'Cloud ML services and storage'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.Cloud,
        zIndex: -1
      }
    } as SecurityNode,

    // Internet Zone Components (zone x shifted: old=50, new=50, delta=0)
    {
      id: 'external-users',
      type: 'endpoint',
      position: { x: 125, y: 175 },
      data: {
        label: 'External API Clients',
        description: 'Third-party applications and users',
        zone: 'Internet' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        protocols: ['HTTPS', 'REST'],
        vendor: 'various',
        product: 'api-clients',
        version: 'various'
      }
    } as SecurityNode,
    {
      id: 'ml-researchers',
      type: 'endpoint',
      position: { x: 325, y: 325 },
      data: {
        label: 'ML Researchers',
        description: 'External research collaborators',
        zone: 'Internet' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        protocols: ['HTTPS', 'SSH'],
        vendor: 'various',
        product: 'research-tools',
        version: 'various'
      }
    } as SecurityNode,
    {
      id: 'model-marketplace',
      type: 'cloudService',
      position: { x: 175, y: 475 },
      data: {
        label: 'Model Marketplace',
        description: 'Public model sharing platform',
        zone: 'Internet' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        protocols: ['HTTPS', 'REST'],
        vendor: 'huggingface',
        product: 'hub',
        version: 'latest'
      }
    } as SecurityNode,

    // DMZ Zone Components (zone x shifted: old=820, new=770, delta=-50)
    {
      id: 'api-gateway',
      type: 'apiGateway',
      position: { x: 825, y: 175 },
      data: {
        label: 'ML API Gateway',
        description: 'Main entry point for ML services',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'gRPC', 'WebSocket'],
        vendor: 'kong',
        product: 'enterprise',
        version: '3.5',
        additionalContext: 'Rate limiting bypassed for VIP customers using special headers'
      }
    } as SecurityNode,
    {
      id: 'model-gateway',
      type: 'reverseProxy',
      position: { x: 1075, y: 325 },
      data: {
        label: 'Model Serving Gateway',
        description: 'Routes requests to model endpoints',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'gRPC'],
        vendor: 'istio',
        product: 'gateway',
        version: '1.20',
        additionalContext: 'Debug headers expose internal model versions and paths'
      }
    } as SecurityNode,
    {
      id: 'waf-ml',
      type: 'waf',
      position: { x: 925, y: 475 },
      data: {
        label: 'ML-Aware WAF',
        description: 'Specialized WAF for ML endpoints',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS'],
        vendor: 'cloudflare',
        product: 'waf',
        version: '2024.1',
        technology: 'ModSecurity with ML rules',
        additionalContext: 'Prompt injection detection disabled for performance'
      }
    } as SecurityNode,

    // Production Zone Components (zone x shifted: old=1590, new=1490, delta=-100)
    {
      id: 'triton-server-1',
      type: 'mlInference',
      position: { x: 1575, y: 175 },
      data: {
        label: 'Triton Inference Server 1',
        description: 'GPU-accelerated model serving',
        zone: 'Production' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['gRPC', 'HTTP/2'],
        vendor: 'nvidia',
        product: 'triton',
        version: '23.12',
        additionalContext: 'Model loading from shared NFS without authentication'
      }
    } as SecurityNode,
    {
      id: 'triton-server-2',
      type: 'mlInference',
      position: { x: 1825, y: 175 },
      data: {
        label: 'Triton Inference Server 2',
        description: 'GPU-accelerated model serving',
        zone: 'Production' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['gRPC', 'HTTP/2'],
        vendor: 'nvidia',
        product: 'triton',
        version: '23.12'
      }
    } as SecurityNode,
    {
      id: 'torchserve',
      type: 'mlInference',
      position: { x: 1675, y: 325 },
      data: {
        label: 'TorchServe Cluster',
        description: 'PyTorch model serving',
        zone: 'Production' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['REST', 'gRPC'],
        vendor: 'pytorch',
        product: 'torchserve',
        version: '0.9.0',
        additionalContext: 'Management API exposed without authentication on port 8081'
      }
    } as SecurityNode,
    {
      id: 'feature-store-prod',
      type: 'featureStore',
      position: { x: 1925, y: 475 },
      data: {
        label: 'Online Feature Store',
        description: 'Low-latency feature serving',
        zone: 'Production' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['Redis Protocol', 'gRPC'],
        vendor: 'feast',
        product: 'feast',
        version: '0.35',
        additionalContext: 'Feature values cached indefinitely without TTL'
      }
    } as SecurityNode,
    {
      id: 'model-registry-prod',
      type: 'modelRegistry',
      position: { x: 1575, y: 625 },
      data: {
        label: 'Production Model Registry',
        description: 'Model versioning and metadata',
        zone: 'Production' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'S3'],
        vendor: 'mlflow',
        product: 'registry',
        version: '2.9'
      }
    } as SecurityNode,
    {
      id: 'monitoring-prod',
      type: 'monitor',
      position: { x: 1825, y: 775 },
      data: {
        label: 'ML Monitoring',
        description: 'Model performance and drift detection',
        zone: 'Production' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'Prometheus'],
        vendor: 'datadog',
        product: 'ml-monitoring',
        version: 'latest',
        additionalContext: 'Metrics exported to public dashboard without authentication'
      }
    } as SecurityNode,

    // Internal Zone Components (zone x shifted: old=2360, new=2410, delta=+50)
    {
      id: 'jupyter-hub',
      type: 'notebookServer',
      position: { x: 2475, y: 175 },
      data: {
        label: 'JupyterHub',
        description: 'Data science notebooks',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'WebSocket'],
        vendor: 'jupyter',
        product: 'jupyterhub',
        version: '4.0',
        additionalContext: 'Notebooks can install arbitrary packages and access production databases'
      }
    } as SecurityNode,
    {
      id: 'kubeflow-pipeline',
      type: 'mlPipeline',
      position: { x: 2725, y: 325 },
      data: {
        label: 'Kubeflow Pipelines',
        description: 'ML workflow orchestration',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'K8s API'],
        vendor: 'kubeflow',
        product: 'pipelines',
        version: '2.0.5',
        additionalContext: 'Pipeline runs with cluster-admin privileges for flexibility'
      }
    } as SecurityNode,
    {
      id: 'experiment-tracking',
      type: 'monitor',
      position: { x: 2575, y: 475 },
      data: {
        label: 'Experiment Tracking',
        description: 'ML experiment management',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'PostgreSQL'],
        vendor: 'wandb',
        product: 'weights-biases',
        version: 'latest'
      }
    } as SecurityNode,
    {
      id: 'data-labeling',
      type: 'application',
      position: { x: 2825, y: 625 },
      data: {
        label: 'Data Labeling Platform',
        description: 'Crowdsourced data annotation',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS'],
        vendor: 'labelbox',
        product: 'platform',
        version: '3.50',
        additionalContext: 'Labeled data exported to S3 buckets with public-read ACLs'
      }
    } as SecurityNode,
    {
      id: 'distributed-training',
      type: 'computeCluster',
      position: { x: 2475, y: 775 },
      data: {
        label: 'GPU Training Cluster',
        description: 'Distributed model training',
        zone: 'Internal' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['NCCL', 'InfiniBand'],
        vendor: 'nvidia',
        product: 'dgx-cluster',
        version: 'A100',
        additionalContext: 'Training jobs share GPU memory without isolation'
      }
    } as SecurityNode,

    // Restricted Zone Components (zone x shifted: old=3130, new=3330, delta=+200)
    {
      id: 'proprietary-models',
      type: 'modelVault',
      position: { x: 3425, y: 175 },
      data: {
        label: 'Proprietary Model Vault',
        description: 'Business-critical ML models',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'mTLS'],
        vendor: 'hashicorp',
        product: 'vault',
        version: '1.15',
        additionalContext: 'Model encryption keys stored in same vault namespace'
      }
    } as SecurityNode,
    {
      id: 'training-data-lake',
      type: 'dataLake',
      position: { x: 3625, y: 325 },
      data: {
        label: 'Training Data Lake',
        description: '10PB of training datasets',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['S3', 'HDFS'],
        vendor: 'databricks',
        product: 'delta-lake',
        version: '3.0',
        additionalContext: 'PII data not fully anonymized in some datasets'
      }
    } as SecurityNode,
    {
      id: 'llm-finetuning',
      type: 'llmService',
      position: { x: 3475, y: 475 },
      data: {
        label: 'LLM Fine-tuning Service',
        description: 'Custom LLM training infrastructure',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'NCCL'],
        vendor: 'custom',
        product: 'llm-platform',
        version: '2.0',
        additionalContext: 'Training data includes customer conversations without consent'
      }
    } as SecurityNode,
    {
      id: 'model-security',
      type: 'securityScanner',
      position: { x: 3625, y: 625 },
      data: {
        label: 'Model Security Scanner',
        description: 'Adversarial robustness testing',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS'],
        vendor: 'adversaria',
        product: 'model-scanner',
        version: '1.5',
        technology: 'Adversarial testing'
      }
    } as SecurityNode,

    // Cloud Zone Components (zone x shifted: old=1590, new=1490, delta=-100)
    {
      id: 'sagemaker',
      type: 'cloudService',
      position: { x: 1575, y: 1275 },
      data: {
        label: 'AWS SageMaker',
        description: 'Managed ML platform',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'AWS API'],
        vendor: 'amazon',
        product: 'sagemaker',
        version: 'latest',
        additionalContext: 'IAM roles allow cross-account access for convenience'
      }
    } as SecurityNode,
    {
      id: 'azure-ml',
      type: 'cloudService',
      position: { x: 1775, y: 1425 },
      data: {
        label: 'Azure ML Studio',
        description: 'Cloud ML workspace',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'Azure API'],
        vendor: 'microsoft',
        product: 'azure-ml',
        version: 'latest'
      }
    } as SecurityNode,
    {
      id: 'vertex-ai',
      type: 'cloudService',
      position: { x: 1575, y: 1575 },
      data: {
        label: 'Vertex AI',
        description: 'Google Cloud ML platform',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'gRPC'],
        vendor: 'google',
        product: 'vertex-ai',
        version: 'latest'
      }
    } as SecurityNode,
    {
      id: 's3-models',
      type: 'storageAccount',
      position: { x: 1925, y: 1725 },
      data: {
        label: 'S3 Model Storage',
        description: 'Cloud model artifact storage',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'S3 API'],
        vendor: 'amazon',
        product: 's3',
        version: 'latest',
        additionalContext: 'Bucket versioning disabled to save costs'
      }
    } as SecurityNode
  ],

  edges: [
    // External access flows
    {
      id: 'e1',
      source: 'external-users',
      target: 'api-gateway',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'API Requests',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e2',
      source: 'ml-researchers',
      target: 'model-gateway',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Research Access',
        protocol: 'HTTPS',
        encryption: 'TLS 1.2',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        zone: 'DMZ' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e3',
      source: 'model-marketplace',
      target: 'model-gateway',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Model Import',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        zone: 'DMZ' as SecurityZone,
        animated: false
      }
    } as SecurityEdge,

    // DMZ to Production flows
    {
      id: 'e4',
      source: 'api-gateway',
      target: 'waf-ml',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'WAF Check',
        protocol: 'HTTP',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e5',
      source: 'waf-ml',
      target: 'triton-server-1',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Clean Traffic',
        protocol: 'gRPC',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Production' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e6',
      source: 'model-gateway',
      target: 'triton-server-2',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Model Serving',
        protocol: 'gRPC',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Production' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e7',
      source: 'model-gateway',
      target: 'torchserve',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'PyTorch Models',
        protocol: 'REST',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Production' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,

    // Production internal flows
    {
      id: 'e8',
      source: 'triton-server-1',
      target: 'feature-store-prod',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Feature Lookup',
        protocol: 'Redis',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Production' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e9',
      source: 'triton-server-2',
      target: 'feature-store-prod',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Feature Lookup',
        protocol: 'Redis',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Production' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e10',
      source: 'torchserve',
      target: 'model-registry-prod',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Model Load',
        protocol: 'S3',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Production' as SecurityZone,
        animated: false
      }
    } as SecurityEdge,
    {
      id: 'e11',
      source: 'triton-server-1',
      target: 'monitoring-prod',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'left',
      data: {
        label: 'Metrics',
        protocol: 'Prometheus',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Production' as SecurityZone,
        animated: false
      }
    } as SecurityEdge,

    // Internal training flows
    {
      id: 'e12',
      source: 'jupyter-hub',
      target: 'distributed-training',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Training Jobs',
        protocol: 'K8s API',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Internal' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e13',
      source: 'kubeflow-pipeline',
      target: 'distributed-training',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'right',
      data: {
        label: 'Pipeline Exec',
        protocol: 'K8s API',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Internal' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e14',
      source: 'distributed-training',
      target: 'experiment-tracking',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Experiment Log',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone,
        animated: false
      }
    } as SecurityEdge,
    {
      id: 'e15',
      source: 'data-labeling',
      target: 'training-data-lake',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Labeled Data',
        protocol: 'S3 API',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Restricted' as SecurityZone,
        animated: false
      }
    } as SecurityEdge,

    // Internal to Restricted flows
    {
      id: 'e16',
      source: 'distributed-training',
      target: 'training-data-lake',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Training Data',
        protocol: 'S3 API',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e17',
      source: 'kubeflow-pipeline',
      target: 'proprietary-models',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Model Storage',
        protocol: 'HTTPS',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e18',
      source: 'llm-finetuning',
      target: 'training-data-lake',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'bottom',
      data: {
        label: 'LLM Training',
        protocol: 'HDFS',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e19',
      source: 'proprietary-models',
      target: 'model-security',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Security Scan',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone,
        animated: false
      }
    } as SecurityEdge,

    // Production to Cloud flows
    {
      id: 'e20',
      source: 'model-registry-prod',
      target: 'sagemaker',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Model Deploy',
        protocol: 'AWS API',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone,
        animated: false
      }
    } as SecurityEdge,
    {
      id: 'e21',
      source: 'model-registry-prod',
      target: 'azure-ml',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Model Sync',
        protocol: 'Azure API',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone,
        animated: false
      }
    } as SecurityEdge,
    {
      id: 'e22',
      source: 'experiment-tracking',
      target: 'vertex-ai',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Experiment Export',
        protocol: 'gRPC',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Cloud' as SecurityZone,
        animated: false
      }
    } as SecurityEdge,
    {
      id: 'e23',
      source: 's3-models',
      target: 'model-registry-prod',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Model Backup',
        protocol: 'S3 API',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone,
        animated: false
      }
    } as SecurityEdge,

    // Monitoring flows
    {
      id: 'e24',
      source: 'monitoring-prod',
      target: 'experiment-tracking',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Drift Alerts',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Internal' as SecurityZone,
        animated: false
      }
    } as SecurityEdge,

    // Direct access vulnerabilities
    {
      id: 'e25',
      source: 'jupyter-hub',
      target: 'proprietary-models',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Direct Access',
        protocol: 'HTTPS',
        encryption: 'TLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone,
        animated: false
      }
    } as SecurityEdge,
    {
      id: 'e26',
      source: 'external-users',
      target: 'torchserve',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'top',
      data: {
        label: 'Mgmt API (8081)',
        protocol: 'HTTP',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Production' as SecurityZone,
        animated: false,
        controlPoints: [
          { id: 'cp-1771648737270', x: 150, y: 700, active: true },
          { id: 'cp-1771648781446', x: 1400, y: 700, active: true }
        ]
      }
    } as SecurityEdge
  ],
  grcWorkspace: aiMLPlatformGrcWorkspace,
  attackPaths: [
    {
      id: 'aiml-ap-waf-bypass-adversarial',
      name: 'WAF Bypass → Adversarial Inference Attack',
      strideCategory: 'Tampering',
      riskLevel: 'High',
      description: 'Attacker crafts adversarial inputs that bypass disabled WAF prompt injection rules via the ML API Gateway, reaches Triton inference server through clean traffic path, and causes misclassification in fraud detection models affecting financial decisions.',
      steps: [
        { order: 1, edgeId: 'e1', sourceNodeId: 'external-users', targetNodeId: 'api-gateway', technique: 'T1190: Exploit Public-Facing Application' },
        { order: 2, edgeId: 'e4', sourceNodeId: 'api-gateway', targetNodeId: 'waf-ml', technique: 'T1562: Impair Defenses' },
        { order: 3, edgeId: 'e5', sourceNodeId: 'waf-ml', targetNodeId: 'triton-server-1', technique: 'T1565: Data Manipulation' },
      ],
      mitreTechniques: ['T1190', 'T1562', 'T1565'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'aiml-ap-torchserve-theft',
      name: 'Exposed TorchServe Mgmt API → Model Theft',
      strideCategory: 'Information Disclosure',
      riskLevel: 'Critical',
      description: 'Attacker directly accesses the unauthenticated TorchServe management API on port 8081 bypassing all DMZ controls, enumerates all loaded production models, and downloads proprietary model weights representing millions in R&D investment.',
      steps: [
        { order: 1, edgeId: 'e26', sourceNodeId: 'external-users', targetNodeId: 'torchserve', technique: 'T1190: Exploit Public-Facing Application' },
        { order: 2, edgeId: 'e10', sourceNodeId: 'torchserve', targetNodeId: 'model-registry-prod', technique: 'T1005: Data from Local System' },
      ],
      mitreTechniques: ['T1190', 'T1005'],
      createdAt: '2025-06-01T00:05:00.000Z',
      updatedAt: '2025-06-01T00:05:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'aiml-ap-supply-chain-poisoning',
      name: 'Model Marketplace → Supply Chain Model Poisoning',
      strideCategory: 'Tampering',
      riskLevel: 'Critical',
      description: 'Nation-state actor publishes backdoored model weights on HuggingFace Hub using pickle serialization. Model imported through marketplace via Model Serving Gateway with debug headers exposing internal paths, processed through Kubeflow pipeline with cluster-admin privileges, and stored in proprietary model vault with shared encryption keys.',
      steps: [
        { order: 1, edgeId: 'e3', sourceNodeId: 'model-marketplace', targetNodeId: 'model-gateway', technique: 'T1195: Supply Chain Compromise' },
        { order: 2, edgeId: 'e7', sourceNodeId: 'model-gateway', targetNodeId: 'torchserve', technique: 'T1059: Command and Scripting Interpreter' },
        { order: 3, edgeId: 'e10', sourceNodeId: 'torchserve', targetNodeId: 'model-registry-prod', technique: 'T1554: Compromise Client Software Binary' },
        { order: 4, edgeId: 'e17', sourceNodeId: 'kubeflow-pipeline', targetNodeId: 'proprietary-models', technique: 'T1078: Valid Accounts' },
      ],
      mitreTechniques: ['T1195', 'T1059', 'T1554', 'T1078'],
      createdAt: '2025-06-01T00:10:00.000Z',
      updatedAt: '2025-06-01T00:10:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'aiml-ap-notebook-exfil',
      name: 'Notebook Escape → Proprietary Model Exfiltration',
      strideCategory: 'Information Disclosure',
      riskLevel: 'High',
      description: 'Insider uses JupyterHub notebook environment with unrestricted package installation to access proprietary model vault directly, bypassing production controls. Leverages broad network access to exfiltrate model weights and training data through the GPU training cluster.',
      steps: [
        { order: 1, edgeId: 'e25', sourceNodeId: 'jupyter-hub', targetNodeId: 'proprietary-models', technique: 'T1078: Valid Accounts' },
        { order: 2, edgeId: 'e19', sourceNodeId: 'proprietary-models', targetNodeId: 'model-security', technique: 'T1005: Data from Local System' },
      ],
      mitreTechniques: ['T1078', 'T1005'],
      createdAt: '2025-06-01T00:15:00.000Z',
      updatedAt: '2025-06-01T00:15:00.000Z',
    } as DiagramAttackPath,
  ],
};
