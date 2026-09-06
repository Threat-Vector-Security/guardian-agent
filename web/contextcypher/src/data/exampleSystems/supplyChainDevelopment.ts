import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityNode, SecurityEdge } from '../../types/SecurityTypes';
import { colors } from '../../styles/Theme';
import { DiagramAttackPath, AttackPathRiskLevel, AssessmentThreatModelNodeSourceType, AssessmentThreatModelEdgeSourceType } from '../../types/GrcTypes';
import { StrideCategory } from '../../types/ThreatIntelTypes';
import { buildGrcWorkspace, score, NOW, OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID } from './grcSharedBase';
const nodes: SecurityNode[] = [
  // Zone definitions
  {
    id: 'external-zone',
    type: 'securityZone',
    position: { x: 50, y: 50 },
    data: {
      label: 'External',
      zoneType: 'External',
      description: 'External developers and CI/CD'
    },
    style: {
      width: 600,
      height: 1000,
      background: colors.zoneBackgrounds.External,
      zIndex: -1
    }
  } as any,
  {
    id: 'dmz-zone',
    type: 'securityZone',
    position: { x: 770, y: 50 },
    data: {
      label: 'DMZ',
      zoneType: 'DMZ',
      description: 'Build and deployment services'
    },
    style: {
      width: 600,
      height: 1000,
      background: colors.zoneBackgrounds.DMZ,
      zIndex: -1
    }
  } as any,
  {
    id: 'internal-zone',
    type: 'securityZone',
    position: { x: 1500, y: 50 },
    data: {
      label: 'Internal',
      zoneType: 'Internal',
      description: 'Internal development infrastructure'
    },
    style: {
      width: 750,
      height: 1000,
      background: colors.zoneBackgrounds.Internal,
      zIndex: -1
    }
  } as any,
  {
    id: 'production-zone',
    type: 'securityZone',
    position: { x: 2360, y: 50 },
    data: {
      label: 'Production',
      zoneType: 'Production',
      description: 'Production software deployment'
    },
    style: {
      width: 600,
      height: 1000,
      background: colors.zoneBackgrounds.Production,
      zIndex: -1
    }
  } as any,
  {
    id: 'cloud-zone',
    type: 'securityZone',
    position: { x: 1490, y: -1070 },
    data: {
      label: 'Cloud',
      zoneType: 'Cloud',
      description: 'Azure/AWS development services'
    },
    style: {
      width: 750,
      height: 1000,
      background: colors.zoneBackgrounds.Cloud,
      zIndex: -1
    }
  } as any,

  // External Zone Components
  {
    id: 'github-repo',
    type: 'application',
    position: { x: 125, y: 125 },
    data: {
      label: 'GitHub Enterprise',
      description: 'Source code repository with webhook integrations. Running version 3.7',
      vendor: 'GitHub',
      version: '3.7',
      zone: 'External',
      dataClassification: 'Internal',
      protocols: ['HTTPS', 'SSH'],
      securityControls: ['mfa']
    }
  } as any,
  {
    id: 'developer-endpoints',
    type: 'endpoint',
    position: { x: 175, y: 375 },
    data: {
      label: 'Developer Workstations',
      description: 'Remote developers with VPN access. Mixed OS environments, local admin rights',
      zone: 'External',
      dataClassification: 'Internal',
      vendor: 'Various',
      osType: 'Mixed',
      securityControls: ['vpn']
    }
  } as any,

  // DMZ Components
  {
    id: 'jenkins-ci',
    type: 'application',
    position: { x: 875, y: 175 },
    data: {
      label: 'Jenkins CI/CD',
      description: 'Build server running Jenkins 2.387 with multiple plugins. Service account: jenkins-svc@corp.local',
      vendor: 'Jenkins',
      version: '2.387',
      zone: 'DMZ',
      dataClassification: 'Internal',
      protocols: ['HTTPS'],
      securityControls: ['basic-auth']
    }
  } as any,
  {
    id: 'nexus-repo',
    type: 'database',
    position: { x: 1125, y: 675 },
    data: {
      label: 'Nexus Repository',
      description: 'Artifact repository manager. Default admin credentials changed to Admin123!',
      vendor: 'Sonatype',
      product: 'Nexus',
      version: '3.45',
      zone: 'DMZ',
      dataClassification: 'Internal',
      securityControls: ['basic-auth']
    }
  } as any,
  {
    id: 'build-agents',
    type: 'server',
    position: { x: 875, y: 775 },
    data: {
      label: 'Build Agents',
      description: 'Windows and Linux build agents. Running with elevated privileges for Docker builds',
      zone: 'DMZ',
      dataClassification: 'Internal',
      osType: 'Mixed',
      securityControls: ['host-based']
    }
  } as any,

  // Internal Zone Components
  {
    id: 'gitlab-internal',
    type: 'application',
    position: { x: 1875, y: 75 },
    data: {
      label: 'GitLab Internal',
      description: 'Internal source control for proprietary code. LDAP integration enabled',
      vendor: 'GitLab',
      version: '16.5',
      zone: 'Internal',
      dataClassification: 'Confidential',
      protocols: ['HTTPS', 'SSH'],
      securityControls: ['ldap', 'mfa']
    }
  } as any,
  {
    id: 'sonarqube',
    type: 'application',
    position: { x: 1975, y: 325 },
    data: {
      label: 'SonarQube',
      description: 'Code quality scanning. Integrated with AD for authentication',
      vendor: 'SonarSource',
      version: '9.9 LTS',
      zone: 'Internal',
      dataClassification: 'Internal',
      protocols: ['HTTPS'],
      securityControls: ['ldap']
    }
  } as any,
  {
    id: 'dependency-track',
    type: 'application',
    position: { x: 1525, y: 575 },
    data: {
      label: 'Dependency Track',
      description: 'SBOM and vulnerability tracking. API key stored in Jenkins: DT-API-2023',
      vendor: 'OWASP',
      version: '4.8',
      zone: 'Internal',
      dataClassification: 'Internal',
      protocols: ['HTTPS'],
      securityControls: ['api-key']
    }
  } as any,
  {
    id: 'secrets-vault',
    type: 'database',
    position: { x: 1625, y: 775 },
    data: {
      label: 'HashiCorp Vault',
      description: 'Secrets management system. Root token rotation pending since Q2 2023',
      vendor: 'HashiCorp',
      product: 'Vault',
      version: '1.13',
      zone: 'Internal',
      dataClassification: 'Confidential',
      securityControls: ['token-auth', 'audit-logging']
    }
  } as any,

  // Production Zone Components
  {
    id: 'prod-k8s',
    type: 'server',
    position: { x: 2475, y: 175 },
    data: {
      label: 'Production Kubernetes',
      description: 'Production container orchestration. RBAC partially implemented',
      vendor: 'CNCF',
      product: 'Kubernetes',
      version: '1.28',
      zone: 'Production',
      dataClassification: 'Confidential',
      securityControls: ['rbac', 'network-policies']
    }
  } as any,
  {
    id: 'container-registry',
    type: 'database',
    position: { x: 2475, y: 925 },
    data: {
      label: 'Container Registry',
      description: 'Production container images. Pull access from CI/CD without authentication',
      vendor: 'Docker',
      product: 'Registry',
      version: '2.8',
      zone: 'Production',
      dataClassification: 'Internal',
      securityControls: ['tls']
    }
  } as any,
  {
    id: 'update-server',
    type: 'server',
    position: { x: 2675, y: 125 },
    data: {
      label: 'Software Update Server',
      description: 'Distributes signed software updates to customers. Code signing cert expires 2024-03',
      zone: 'Production',
      dataClassification: 'Confidential',
      securityControls: ['code-signing', 'access-logs']
    }
  } as any,

  // Cloud Zone Components
  {
    id: 'azure-devops',
    type: 'application',
    position: { x: 1625, y: -925 },
    data: {
      label: 'Azure DevOps',
      description: 'Cloud CI/CD pipelines. Service principal has Contributor role on subscription',
      vendor: 'Microsoft',
      product: 'Azure DevOps',
      zone: 'Cloud',
      dataClassification: 'Internal',
      protocols: ['HTTPS'],
      securityControls: ['oauth', 'conditional-access']
    }
  } as any,
  {
    id: 'cloud-build-agents',
    type: 'server',
    position: { x: 2125, y: -725 },
    data: {
      label: 'Cloud Build Agents',
      description: 'Auto-scaling build agents in Azure. Managed identity with broad permissions',
      zone: 'Cloud',
      dataClassification: 'Internal',
      vendor: 'Microsoft',
      osType: 'Linux',
      securityControls: ['managed-identity']
    }
  } as any,
  {
    id: 'aws-codeartifact',
    type: 'database',
    position: { x: 1825, y: -425 },
    data: {
      label: 'AWS CodeArtifact',
      description: 'Package repository in AWS. Cross-account access via assumed roles',
      vendor: 'AWS',
      product: 'CodeArtifact',
      zone: 'Cloud',
      dataClassification: 'Internal',
      securityControls: ['iam-roles', 's3-encryption']
    }
  } as any,
  {
    id: 'terraform-state',
    type: 'database',
    position: { x: 1625, y: -325 },
    data: {
      label: 'Terraform State',
      description: 'Infrastructure as Code state files. Contains cloud resource credentials',
      zone: 'Cloud',
      dataClassification: 'Confidential',
      vendor: 'HashiCorp',
      product: 'Terraform Cloud',
      securityControls: ['encryption-at-rest']
    }
  } as any
];

const edges: SecurityEdge[] = [
  // Developer access flows
  {
    id: 'dev-to-github',
    source: 'developer-endpoints',
    target: 'github-repo',
    type: 'securityEdge',
    data: {
      label: 'Git Push/Pull',
      protocol: 'SSH/HTTPS',
      encryption: 'TLS 1.3',
      zone: 'External',
      dataClassification: 'Internal',
      description: 'Developer code commits'
    }
  } as any,
  {
    id: 'github-to-jenkins',
    source: 'github-repo',
    target: 'jenkins-ci',
    type: 'securityEdge',
    data: {
      label: 'Webhook Trigger',
      protocol: 'HTTPS',
      encryption: 'TLS 1.2',
      zone: 'DMZ',
      dataClassification: 'Internal',
      description: 'Build triggers on commit'
    }
  } as any,

  // CI/CD Pipeline flows
  {
    id: 'jenkins-to-nexus',
    source: 'jenkins-ci',
    target: 'nexus-repo',
    type: 'securityEdge',
    data: {
      label: 'Artifact Upload',
      protocol: 'HTTPS',
      encryption: 'TLS 1.2',
      zone: 'DMZ',
      dataClassification: 'Internal',
      description: 'Build artifacts storage'
    }
  } as any,
  {
    id: 'jenkins-to-agents',
    source: 'jenkins-ci',
    target: 'build-agents',
    type: 'securityEdge',
    data: {
      label: 'Build Jobs',
      protocol: 'TCP/50000',
      encryption: 'none',
      zone: 'DMZ',
      dataClassification: 'Internal',
      description: 'Distributed build execution'
    }
  } as any,
  {
    id: 'jenkins-to-gitlab',
    source: 'jenkins-ci',
    target: 'gitlab-internal',
    type: 'securityEdge',
    data: {
      label: 'Source Checkout',
      protocol: 'HTTPS',
      encryption: 'TLS 1.3',
      zone: 'Internal',
      dataClassification: 'Confidential',
      description: 'Internal code access'
    }
  } as any,

  // Code quality flows
  {
    id: 'jenkins-to-sonar',
    source: 'jenkins-ci',
    target: 'sonarqube',
    type: 'securityEdge',
    data: {
      label: 'Code Analysis',
      protocol: 'HTTPS',
      encryption: 'TLS 1.2',
      zone: 'Internal',
      dataClassification: 'Internal',
      description: 'Quality gate checks'
    }
  } as any,
  {
    id: 'jenkins-to-deptrack',
    source: 'jenkins-ci',
    target: 'dependency-track',
    type: 'securityEdge',
    data: {
      label: 'SBOM Upload',
      protocol: 'HTTPS',
      encryption: 'TLS 1.2',
      zone: 'Internal',
      dataClassification: 'Internal',
      description: 'Vulnerability scanning'
    }
  } as any,

  // Secrets management
  {
    id: 'jenkins-to-vault',
    source: 'jenkins-ci',
    target: 'secrets-vault',
    type: 'securityEdge',
    data: {
      label: 'Secret Retrieval',
      protocol: 'HTTPS',
      encryption: 'TLS 1.3',
      zone: 'Internal',
      dataClassification: 'Confidential',
      description: 'Credential management'
    }
  } as any,
  {
    id: 'gitlab-to-vault',
    source: 'gitlab-internal',
    target: 'secrets-vault',
    type: 'securityEdge',
    data: {
      label: 'Secret Access',
      protocol: 'HTTPS',
      encryption: 'TLS 1.3',
      zone: 'Internal',
      dataClassification: 'Confidential'
    }
  } as any,

  // Production deployment
  {
    id: 'jenkins-to-k8s',
    source: 'jenkins-ci',
    target: 'prod-k8s',
    type: 'securityEdge',
    data: {
      label: 'Deploy Pipeline',
      protocol: 'HTTPS',
      encryption: 'TLS 1.3',
      zone: 'Production',
      dataClassification: 'Confidential',
      description: 'Production deployments'
    }
  } as any,
  {
    id: 'nexus-to-registry',
    source: 'nexus-repo',
    target: 'container-registry',
    type: 'securityEdge',
    data: {
      controlPoints: [{ id: 'cp-1771656261110', x: 1150, y: 950, active: true }],
      label: 'Image Push',
      protocol: 'HTTPS',
      encryption: 'TLS 1.2',
      zone: 'Production',
      dataClassification: 'Internal'
    }
  } as any,
  {
    id: 'k8s-to-registry',
    source: 'prod-k8s',
    target: 'container-registry',
    type: 'securityEdge',
    data: {
      label: 'Image Pull',
      protocol: 'HTTPS',
      encryption: 'TLS 1.2',
      zone: 'Production',
      dataClassification: 'Internal',
      description: 'Container deployment'
    }
  } as any,
  {
    id: 'jenkins-to-update',
    source: 'jenkins-ci',
    target: 'update-server',
    type: 'securityEdge',
    data: {
      controlPoints: [
        { id: 'cp-1771656399114', x: 1200, y: 0, active: true },
        { id: 'cp-1771656396159', x: 2700, y: 0, active: true }
      ],
      label: 'Update Publishing',
      protocol: 'HTTPS',
      encryption: 'TLS 1.3',
      zone: 'Production',
      dataClassification: 'Confidential',
      description: 'Customer update distribution'
    }
  } as any,

  // Cloud integrations
  {
    id: 'github-to-azure',
    source: 'github-repo',
    target: 'azure-devops',
    type: 'securityEdge',
    data: {
      controlPoints: [{ id: 'cp-1771656310285', x: 850, y: -350, active: true }],
      label: 'Pipeline Sync',
      protocol: 'HTTPS',
      encryption: 'TLS 1.3',
      zone: 'Cloud',
      dataClassification: 'Internal'
    }
  } as any,
  {
    id: 'azure-to-cloudagents',
    source: 'azure-devops',
    target: 'cloud-build-agents',
    type: 'securityEdge',
    data: {
      label: 'Cloud Builds',
      protocol: 'HTTPS',
      encryption: 'TLS 1.3',
      zone: 'Cloud',
      dataClassification: 'Internal'
    }
  } as any,
  {
    id: 'cloudagents-to-codeartifact',
    source: 'cloud-build-agents',
    target: 'aws-codeartifact',
    type: 'securityEdge',
    data: {
      label: 'Package Upload',
      protocol: 'HTTPS',
      encryption: 'TLS 1.3',
      zone: 'Cloud',
      dataClassification: 'Internal'
    }
  } as any,
  {
    id: 'azure-to-terraform',
    source: 'azure-devops',
    target: 'terraform-state',
    type: 'securityEdge',
    data: {
      label: 'IaC State',
      protocol: 'HTTPS',
      encryption: 'TLS 1.3',
      zone: 'Cloud',
      dataClassification: 'Confidential',
      description: 'Infrastructure provisioning'
    }
  } as any,
  {
    id: 'jenkins-to-azure',
    source: 'jenkins-ci',
    target: 'azure-devops',
    type: 'securityEdge',
    data: {
      controlPoints: [{ id: 'cp-1771656321385', x: 1200, y: -250, active: true }],
      label: 'Hybrid Pipeline',
      protocol: 'HTTPS',
      encryption: 'TLS 1.3',
      zone: 'Cloud',
      dataClassification: 'Internal'
    }
  } as any,

  // Cross-zone integrations
  {
    id: 'vault-to-terraform',
    source: 'secrets-vault',
    target: 'terraform-state',
    type: 'securityEdge',
    data: {
      label: 'Dynamic Secrets',
      protocol: 'HTTPS',
      encryption: 'TLS 1.3',
      zone: 'Cloud',
      dataClassification: 'Confidential'
    }
  } as any
];

const tierCatalogue = [
  { id: 'tier1-cyber', tier: 1 as const, label: 'Cyber Risk', description: 'Information security and cyber threats' },
  { id: 'tier1-operational', tier: 1 as const, label: 'Operational Risk', description: 'Business operations and process risks' },
  { id: 'tier2-supply-chain', tier: 2 as const, label: 'Supply Chain Security', parentId: 'tier1-cyber', description: 'Software supply chain integrity and provenance' },
  { id: 'tier2-cicd', tier: 2 as const, label: 'CI/CD Pipeline Security', parentId: 'tier1-cyber', description: 'Build, test, and deployment pipeline controls' },
  { id: 'tier2-identity', tier: 2 as const, label: 'Identity & Access', parentId: 'tier1-cyber', description: 'Authentication, authorization, and credential management' },
  { id: 'tier2-secrets', tier: 2 as const, label: 'Secrets Management', parentId: 'tier1-cyber', description: 'Credential storage, rotation, and access controls' },
  { id: 'tier2-artifact', tier: 2 as const, label: 'Artifact Integrity', parentId: 'tier1-cyber', description: 'Build artifact and container image provenance' },
  { id: 'tier2-monitoring', tier: 2 as const, label: 'Security Monitoring', parentId: 'tier1-operational', description: 'Logging, detection, and incident response' },
  { id: 'tier2-change', tier: 2 as const, label: 'Change Management', parentId: 'tier1-operational', description: 'Deployment, rotation, and configuration management' },
  { id: 'tier3-dependency-poisoning', tier: 3 as const, label: 'Dependency Poisoning', parentId: 'tier2-supply-chain' },
  { id: 'tier3-build-tampering', tier: 3 as const, label: 'Build Tampering', parentId: 'tier2-cicd' },
  { id: 'tier3-pipeline-secrets', tier: 3 as const, label: 'Pipeline Secret Exposure', parentId: 'tier2-cicd' },
  { id: 'tier3-signing-key-theft', tier: 3 as const, label: 'Signing Key Theft', parentId: 'tier2-secrets' },
  { id: 'tier3-privileged-builders', tier: 3 as const, label: 'Privileged Build Agents', parentId: 'tier2-cicd' },
  { id: 'tier3-unsigned-artifacts', tier: 3 as const, label: 'Unsigned Artifacts', parentId: 'tier2-artifact' },
  { id: 'tier3-iac-drift', tier: 3 as const, label: 'Infrastructure-as-Code Drift', parentId: 'tier2-change' },
  { id: 'tier3-stale-credentials', tier: 3 as const, label: 'Stale Credentials', parentId: 'tier2-secrets' },
];

const assets = [
  {
    id: 'scd-asset-github', name: 'GitHub Enterprise', type: 'source_code_repo', owner: 'Platform Engineering',
    domain: 'application' as const, category: 'Source Control',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Primary source code repository with webhook integrations to CI/CD. Running version 3.7 with MFA enabled.',
    criticality: { confidentiality: 5, integrity: 5, availability: 4, financial: 5, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'supply-chain-dev', nodeId: 'github-repo', nodeLabel: 'GitHub Enterprise', nodeType: 'application' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scd-asset-jenkins', name: 'Jenkins CI/CD', type: 'ci_cd_pipeline', owner: 'DevOps Engineering',
    domain: 'application' as const, category: 'CI/CD',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Build server running Jenkins 2.387 with multiple plugins. Service account jenkins-svc@corp.local has broad cross-environment access.',
    criticality: { confidentiality: 4, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'supply-chain-dev', nodeId: 'jenkins-ci', nodeLabel: 'Jenkins CI/CD', nodeType: 'application' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scd-asset-nexus', name: 'Nexus Repository', type: 'artifact_registry', owner: 'DevOps Engineering',
    domain: 'application' as const, category: 'Artifact Management',
    businessCriticality: 4, securityCriticality: 4,
    description: 'Artifact repository manager storing build artifacts. Default admin credentials changed to weak password.',
    criticality: { confidentiality: 3, integrity: 5, availability: 4, financial: 4, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'supply-chain-dev', nodeId: 'nexus-repo', nodeLabel: 'Nexus Repository', nodeType: 'database' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scd-asset-dev-workstations', name: 'Developer Workstations', type: 'endpoint', owner: 'Engineering',
    domain: 'it' as const, category: 'Endpoints',
    businessCriticality: 3, securityCriticality: 4,
    description: 'Remote developer endpoints with VPN access, mixed OS environments, and local admin rights.',
    criticality: { confidentiality: 3, integrity: 4, availability: 2, financial: 3, reputation: 3, safety: 1 },
    diagramRefs: [{ diagramId: 'supply-chain-dev', nodeId: 'developer-endpoints', nodeLabel: 'Developer Workstations', nodeType: 'endpoint' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scd-asset-vault', name: 'HashiCorp Vault', type: 'secret_store', owner: 'Security Operations',
    domain: 'it' as const, category: 'Security Tools',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Secrets management system with root token rotation pending since Q2 2023.',
    criticality: { confidentiality: 5, integrity: 5, availability: 4, financial: 5, reputation: 5, safety: 1 },
    diagramRefs: [{ diagramId: 'supply-chain-dev', nodeId: 'secrets-vault', nodeLabel: 'HashiCorp Vault', nodeType: 'database' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scd-asset-build-agents', name: 'Build Agents', type: 'build_server', owner: 'DevOps Engineering',
    domain: 'application' as const, category: 'Compute',
    businessCriticality: 4, securityCriticality: 4,
    description: 'Windows and Linux build agents running with elevated privileges for Docker-in-Docker builds.',
    criticality: { confidentiality: 3, integrity: 5, availability: 4, financial: 4, reputation: 3, safety: 1 },
    diagramRefs: [{ diagramId: 'supply-chain-dev', nodeId: 'build-agents', nodeLabel: 'Build Agents', nodeType: 'server' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scd-asset-update-server', name: 'Software Update Server', type: 'distribution_server', owner: 'Release Engineering',
    domain: 'application' as const, category: 'Distribution',
    businessCriticality: 5, securityCriticality: 5,
    description: 'Distributes signed software updates to customers. Code signing certificate expires March 2024.',
    criticality: { confidentiality: 4, integrity: 5, availability: 5, financial: 5, reputation: 5, safety: 2 },
    diagramRefs: [{ diagramId: 'supply-chain-dev', nodeId: 'update-server', nodeLabel: 'Software Update Server', nodeType: 'server' }],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scd-asset-container-registry', name: 'Container Registry', type: 'container_registry', owner: 'Platform Engineering',
    domain: 'application' as const, category: 'Artifact Management',
    businessCriticality: 4, securityCriticality: 4,
    description: 'Production container images with unauthenticated pull access from CI/CD subnet.',
    criticality: { confidentiality: 3, integrity: 5, availability: 4, financial: 4, reputation: 4, safety: 1 },
    diagramRefs: [{ diagramId: 'supply-chain-dev', nodeId: 'container-registry', nodeLabel: 'Container Registry', nodeType: 'database' }],
    createdAt: NOW, updatedAt: NOW
  },
];

const risks = [
  {
    id: 'scd-risk-dependency-poisoning', title: 'Dependency Confusion / Typosquatting Attack',
    description: 'Nexus Repository proxies public registries without namespace scoping. An attacker publishes a malicious package with the same name as an internal library on the public registry, causing builds to pull the poisoned dependency.',
    status: 'assessed' as const, owner: 'DevOps Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Supply Chain Security', tier3: 'Dependency Poisoning' },
    assetIds: ['scd-asset-nexus', 'scd-asset-jenkins'],
    diagramLinks: [{ diagramId: 'supply-chain-dev', nodeIds: ['nexus-repo', 'jenkins-ci', 'build-agents'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Configure namespace scoping on Nexus proxied repositories; implement package checksum verification in build pipelines; enable dependency lock files',
    threatActorIds: ['scd-threat-actor-nation-state'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scd-risk-compromised-build', title: 'Build Pipeline Compromise via Jenkins Plugins',
    description: 'Jenkins 2.387 upgrade left multiple plugins unvetted. A compromised or vulnerable plugin can inject malicious code into build artifacts, modify deployment configurations, or exfiltrate secrets during the build process.',
    status: 'assessed' as const, owner: 'DevOps Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'CI/CD Pipeline Security', tier3: 'Build Tampering' },
    assetIds: ['scd-asset-jenkins', 'scd-asset-build-agents'],
    diagramLinks: [{ diagramId: 'supply-chain-dev', nodeIds: ['jenkins-ci', 'build-agents'] }],
    inherentScore: score('likelihood-4', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Audit and whitelist Jenkins plugins; implement plugin hash verification; restrict plugin installation to security-reviewed versions',
    threatActorIds: ['scd-threat-actor-nation-state'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scd-risk-signing-key-theft', title: 'Code Signing Key Compromise via Vault Token',
    description: 'HashiCorp Vault root token rotation has been pending since Q2 2023. The stale root token provides unrestricted access to signing keys stored in Vault, enabling an attacker to sign malicious software updates distributed to customers.',
    status: 'assessed' as const, owner: 'Security Operations',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Secrets Management', tier3: 'Signing Key Theft' },
    assetIds: ['scd-asset-vault', 'scd-asset-update-server'],
    diagramLinks: [{ diagramId: 'supply-chain-dev', nodeIds: ['secrets-vault', 'update-server'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Rotate Vault root token immediately; implement HSM-backed signing; separate signing key access from general secret access with dedicated policies',
    threatActorIds: ['scd-threat-actor-nation-state'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scd-risk-malicious-commit', title: 'Malicious Commit via Compromised Developer Account',
    description: 'Developer workstations have local admin rights and mixed OS environments. A compromised developer account can push malicious commits that bypass code review if branch protection is misconfigured on GitHub Enterprise.',
    status: 'assessed' as const, owner: 'Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Identity & Access' },
    assetIds: ['scd-asset-dev-workstations', 'scd-asset-github'],
    diagramLinks: [{ diagramId: 'supply-chain-dev', nodeIds: ['developer-endpoints', 'github-repo'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Enforce mandatory code review with two approvers; enable commit signing verification; remove local admin rights from developer workstations',
    threatActorIds: ['scd-threat-actor-apt'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scd-risk-pipeline-secrets', title: 'CI/CD Pipeline Secret Extraction',
    description: 'Jenkins retrieves secrets from Vault and Dependency Track API keys are hardcoded. Build agents with elevated privileges can access these secrets, and unencrypted TCP/50000 agent communication enables credential interception.',
    status: 'assessed' as const, owner: 'DevOps Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'CI/CD Pipeline Security', tier3: 'Pipeline Secret Exposure' },
    assetIds: ['scd-asset-jenkins', 'scd-asset-vault', 'scd-asset-build-agents'],
    diagramLinks: [{ diagramId: 'supply-chain-dev', nodeIds: ['jenkins-ci', 'secrets-vault', 'build-agents'] }],
    inherentScore: score('likelihood-4', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Encrypt Jenkins agent communication; implement short-lived Vault tokens for CI/CD; remove hardcoded API keys from Dependency Track integration',
    threatActorIds: ['scd-threat-actor-organised-crime'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scd-risk-unsigned-containers', title: 'Unsigned Container Images in Production',
    description: 'Container registry allows unauthenticated pull access. Images pushed from Nexus to the registry lack cryptographic signatures, enabling image substitution attacks against production Kubernetes deployments.',
    status: 'draft' as const, owner: 'Platform Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Artifact Integrity', tier3: 'Unsigned Artifacts' },
    assetIds: ['scd-asset-container-registry', 'scd-asset-nexus'],
    diagramLinks: [{ diagramId: 'supply-chain-dev', nodeIds: ['container-registry', 'nexus-repo', 'prod-k8s'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Implement container image signing with Cosign/Notary; enforce signature verification in Kubernetes admission controller; require authentication for registry pulls',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scd-risk-terraform-credentials', title: 'Terraform State Exposes Cloud Credentials',
    description: 'Terraform state files contain unencrypted cloud provider credentials. Azure DevOps service principal with Contributor role manages IaC state, and compromising the state enables full cloud infrastructure takeover.',
    status: 'assessed' as const, owner: 'Cloud Operations',
    tierPath: { tier1: 'Cyber Risk', tier2: 'Secrets Management', tier3: 'Stale Credentials' },
    assetIds: ['scd-asset-vault'],
    diagramLinks: [{ diagramId: 'supply-chain-dev', nodeIds: ['terraform-state', 'azure-devops', 'secrets-vault'] }],
    inherentScore: score('likelihood-3', 'impact-5'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Enable state-level encryption; use Vault dynamic secrets for cloud providers; scope Azure service principal to least-privilege',
    threatActorIds: ['scd-threat-actor-apt'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scd-risk-privileged-builders', title: 'Build Agents with Elevated Docker Privileges',
    description: 'Build agents run with elevated privileges for Docker-in-Docker builds. A malicious build job can escape the container, access the host, and pivot to other services in the DMZ including Jenkins and Nexus.',
    status: 'assessed' as const, owner: 'DevOps Engineering',
    tierPath: { tier1: 'Cyber Risk', tier2: 'CI/CD Pipeline Security', tier3: 'Privileged Build Agents' },
    assetIds: ['scd-asset-build-agents', 'scd-asset-jenkins'],
    diagramLinks: [{ diagramId: 'supply-chain-dev', nodeIds: ['build-agents', 'jenkins-ci'] }],
    inherentScore: score('likelihood-3', 'impact-4'),
    treatmentStrategy: 'mitigate' as const, treatmentPlan: 'Replace Docker-in-Docker with rootless builders (Kaniko/Buildah); implement network segmentation between build agents and management plane',
    createdAt: NOW, updatedAt: NOW
  },
];

const assessments = [
  {
    id: 'scd-assessment-supply-chain', title: 'Software Supply Chain Security Assessment',
    status: 'in_review' as const,
    owner: 'Security Architecture',
    reviewer: 'CISO',
    startDate: '2025-05-01',
    dueDate: '2025-07-15',
    threatActorIds: ['scd-threat-actor-nation-state', 'scd-threat-actor-apt', 'scd-threat-actor-organised-crime', 'scd-threat-actor-insider'],
    methodologyNote: 'Assessment follows SLSA framework levels with OWASP Top 10 CI/CD Risks mapping and MITRE ATT&CK for Enterprise (Software Supply Chain).',
    assumptionNote: 'Assessment scope covers the full software development lifecycle from developer commit through production deployment and customer update distribution.',
    scopeItems: [
      { id: 'scope-scd-system', type: 'system' as const, value: 'system', name: 'Software Supply Chain Pipeline' },
      { id: 'scope-scd-dmz', type: 'diagram_segment' as const, value: 'DMZ', name: 'Build and Deployment Services' },
      { id: 'scope-scd-internal', type: 'diagram_segment' as const, value: 'Internal', name: 'Internal Development Infrastructure' },
      { id: 'scope-scd-production', type: 'diagram_segment' as const, value: 'Production', name: 'Production Software Deployment' },
    ],
    tierFilter: { tier1: 'Cyber Risk' },
    riskManagementPlan: {
      objective: 'Achieve SLSA Level 3 compliance for the primary build pipeline and eliminate high-risk credential exposure across all CI/CD tooling.',
      strategy: 'Prioritize build integrity and secret management risks first, then address artifact signing and developer endpoint hardening.',
      residualRiskStatement: 'Residual risk accepted for legacy Jenkins plugin dependencies pending migration to GitHub Actions within 6 months.',
      monitoringApproach: 'Weekly review of pipeline security findings and bi-weekly dependency vulnerability triage.',
      communicationPlan: 'Report to Security Steering Committee every two weeks with escalation path to CISO for critical findings.',
      reviewCadenceDays: 14,
      actions: [
        {
          id: 'scd-rmp-action-vault-rotation',
          title: 'Rotate Vault root token and implement automated rotation schedule',
          owner: 'Security Operations',
          dueDate: '2025-06-01',
          status: 'in_progress' as const,
          linkedRiskIds: ['scd-risk-signing-key-theft', 'scd-risk-pipeline-secrets'],
          notes: 'Emergency rotation approved; HSM integration in progress'
        },
        {
          id: 'scd-rmp-action-namespace-scoping',
          title: 'Configure namespace scoping on Nexus proxied repositories',
          owner: 'DevOps Engineering',
          dueDate: '2025-06-15',
          status: 'planned' as const,
          linkedRiskIds: ['scd-risk-dependency-poisoning'],
          notes: 'Inventory of internal package names completed'
        },
        {
          id: 'scd-rmp-action-plugin-audit',
          title: 'Audit and whitelist Jenkins plugins',
          owner: 'DevOps Engineering',
          dueDate: '2025-06-10',
          status: 'in_progress' as const,
          linkedRiskIds: ['scd-risk-compromised-build'],
          notes: '47 plugins identified; 12 flagged for removal'
        },
        {
          id: 'scd-rmp-action-container-signing',
          title: 'Implement container image signing with Cosign',
          owner: 'Platform Engineering',
          dueDate: '2025-07-01',
          status: 'planned' as const,
          linkedRiskIds: ['scd-risk-unsigned-containers'],
          notes: 'Cosign POC completed in staging environment'
        },
      ],
      updatedAt: NOW
    },
    riskIds: risks.map(r => r.id),
    soaGapIds: ['scd-soa-a04', 'scd-soa-a05', 'scd-soa-a08'],
    taskIds: ['scd-task-vault-rotation', 'scd-task-plugin-audit', 'scd-task-namespace-scoping', 'scd-task-container-signing'],
    linkedImplementedControlIds: [],
    linkedInitiativeIds: [],
    summary: 'Security assessment of the software supply chain pipeline identifying 8 risks across build integrity, secret management, artifact provenance, and developer access. 3 rated Critical, 3 High, 2 Medium.',
    findings: 'Key findings include dependency confusion vulnerability via unscoped Nexus proxies, stale Vault root token enabling signing key theft, unencrypted Jenkins agent communication, privileged build agents with container escape potential, and unsigned container images in production.',
    recommendations: 'Prioritize Vault root token rotation and Jenkins agent encryption, implement dependency namespace scoping, adopt container image signing, and migrate to rootless build agents.',
    evidenceSummary: 'Evidence includes Jenkins plugin inventory exports, Vault audit logs, Nexus proxy configuration dumps, build agent privilege analysis, and container registry access logs.',
    threatModel: {
      nodes: [
        { id: 'scd-tm-developer', label: 'Developer Workstation', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'developer-endpoints', position: { x: 50, y: 150 }, nodeType: 'endpoint' },
        { id: 'scd-tm-github', label: 'GitHub Enterprise', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'github-repo', position: { x: 250, y: 150 }, nodeType: 'application', commentary: 'External source control with webhook triggers' },
        { id: 'scd-tm-jenkins', label: 'Jenkins CI/CD', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'jenkins-ci', position: { x: 450, y: 150 }, nodeType: 'application', commentary: 'Central build orchestrator with broad credentials' },
        { id: 'scd-tm-nexus', label: 'Nexus Repository', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'nexus-repo', position: { x: 450, y: 300 }, nodeType: 'database', commentary: 'Artifact store with unscoped proxied registries' },
        { id: 'scd-tm-vault', label: 'HashiCorp Vault', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'secrets-vault', position: { x: 650, y: 150 }, nodeType: 'database', commentary: 'Stale root token; signing keys accessible' },
        { id: 'scd-tm-registry', label: 'Container Registry', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'container-registry', position: { x: 650, y: 300 }, nodeType: 'database', commentary: 'Unauthenticated pull; no image signing' },
        { id: 'scd-tm-k8s', label: 'Production Kubernetes', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'prod-k8s', position: { x: 850, y: 150 }, nodeType: 'server' },
        { id: 'scd-tm-update', label: 'Update Server', sourceType: 'diagram_node' as AssessmentThreatModelNodeSourceType, diagramNodeId: 'update-server', position: { x: 850, y: 300 }, nodeType: 'server', commentary: 'Code signing cert expiring March 2024' },
      ],
      edges: [
        { id: 'scd-tm-edge-dev-github', source: 'scd-tm-developer', target: 'scd-tm-github', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'dev-to-github', label: 'Git Push/Pull', commentary: 'Compromised developer pushes malicious commit' },
        { id: 'scd-tm-edge-github-jenkins', source: 'scd-tm-github', target: 'scd-tm-jenkins', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'github-to-jenkins', label: 'Webhook Trigger', commentary: 'Malicious commit triggers automated build' },
        { id: 'scd-tm-edge-jenkins-nexus', source: 'scd-tm-jenkins', target: 'scd-tm-nexus', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'jenkins-to-nexus', label: 'Artifact Upload', commentary: 'Poisoned artifacts stored in repository' },
        { id: 'scd-tm-edge-jenkins-vault', source: 'scd-tm-jenkins', target: 'scd-tm-vault', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'jenkins-to-vault', label: 'Secret Retrieval', commentary: 'Pipeline extracts signing keys via stale root token' },
        { id: 'scd-tm-edge-nexus-registry', source: 'scd-tm-nexus', target: 'scd-tm-registry', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'nexus-to-registry', label: 'Image Push', commentary: 'Unsigned images pushed to production registry' },
        { id: 'scd-tm-edge-jenkins-update', source: 'scd-tm-jenkins', target: 'scd-tm-update', sourceType: 'diagram_edge' as AssessmentThreatModelEdgeSourceType, diagramEdgeId: 'jenkins-to-update', label: 'Update Publishing', commentary: 'Malicious update distributed to customers' },
      ],
      attackPathDescription: 'Four critical attack chains: (1) Dependency confusion via unscoped Nexus proxy poisons build artifacts and production deployments; (2) Compromised developer account pushes malicious commit through automated pipeline to production; (3) Jenkins pipeline exploited to extract secrets from Vault via stale root token; (4) Unsigned container images substituted in production registry.',
      attackPaths: [
        {
          id: 'scd-aap-dependency-confusion',
          name: 'Dependency Confusion → Build Compromise → Production',
          strideCategory: 'Tampering' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'Attacker publishes malicious package to public registry matching internal package name. Nexus proxy resolves to the public version, poisoning build artifacts that flow through to container registry and production Kubernetes.',
          diagramAttackPathId: 'scd-ap-dependency-confusion',
          steps: [
            { order: 1, edgeId: 'jenkins-to-nexus', sourceNodeId: 'jenkins-ci', targetNodeId: 'nexus-repo', technique: 'T1195.002: Supply Chain Compromise - Compromise Software Supply Chain' },
            { order: 2, edgeId: 'nexus-to-registry', sourceNodeId: 'nexus-repo', targetNodeId: 'container-registry', technique: 'T1204.003: User Execution - Malicious Image' },
            { order: 3, edgeId: 'k8s-to-registry', sourceNodeId: 'prod-k8s', targetNodeId: 'container-registry', technique: 'T1610: Deploy Container' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
        {
          id: 'scd-aap-malicious-commit',
          name: 'Compromised Developer → Malicious Commit → Customer Update',
          strideCategory: 'Tampering' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'Nation-state actor compromises developer workstation, pushes malicious commit to GitHub that triggers Jenkins build. Poisoned artifact flows through pipeline to software update server, distributing backdoored software to customers.',
          diagramAttackPathId: 'scd-ap-malicious-commit',
          steps: [
            { order: 1, edgeId: 'dev-to-github', sourceNodeId: 'developer-endpoints', targetNodeId: 'github-repo', technique: 'T1199: Trusted Relationship' },
            { order: 2, edgeId: 'github-to-jenkins', sourceNodeId: 'github-repo', targetNodeId: 'jenkins-ci', technique: 'T1072: Software Deployment Tools' },
            { order: 3, edgeId: 'jenkins-to-nexus', sourceNodeId: 'jenkins-ci', targetNodeId: 'nexus-repo', technique: 'T1195.002: Supply Chain Compromise' },
            { order: 4, edgeId: 'jenkins-to-update', sourceNodeId: 'jenkins-ci', targetNodeId: 'update-server', technique: 'T1195.002: Supply Chain Compromise - Compromise Software Supply Chain' },
          ],
          createdAt: NOW, updatedAt: NOW,
        },
        {
          id: 'scd-aap-pipeline-secret-theft',
          name: 'CI/CD Pipeline Exploit → Secret Extraction → Lateral Movement',
          strideCategory: 'Information Disclosure' as StrideCategory,
          riskLevel: 'Critical' as AttackPathRiskLevel,
          description: 'Attacker exploits Jenkins pipeline configuration to extract Vault credentials via stale root token, then retrieves cloud infrastructure secrets from Terraform state to gain full cloud environment control.',
          diagramAttackPathId: 'scd-ap-pipeline-secret-theft',
          steps: [
            { order: 1, edgeId: 'github-to-jenkins', sourceNodeId: 'github-repo', targetNodeId: 'jenkins-ci', technique: 'T1059.004: Command and Scripting Interpreter - Unix Shell' },
            { order: 2, edgeId: 'jenkins-to-vault', sourceNodeId: 'jenkins-ci', targetNodeId: 'secrets-vault', technique: 'T1552.001: Unsecured Credentials - Credentials In Files' },
            { order: 3, edgeId: 'vault-to-terraform', sourceNodeId: 'secrets-vault', targetNodeId: 'terraform-state', technique: 'T1552.005: Unsecured Credentials - Cloud Instance Metadata API' },
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
    id: 'scd-soa-a01', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A01', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Jenkins service account has broad cross-environment access. Build agents run with elevated Docker privileges. Azure DevOps service principal has Contributor role on full subscription.',
    mitigatesRiskIds: ['scd-risk-privileged-builders', 'scd-risk-pipeline-secrets'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'scd-soa-a02', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A02', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Vault root token not rotated since Q2 2023. Nexus admin password is weak (Admin123!). Jenkins agent communication over unencrypted TCP/50000.',
    mitigatesRiskIds: ['scd-risk-signing-key-theft', 'scd-risk-pipeline-secrets'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'scd-soa-a04', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A04', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'No SLSA framework adoption. Build provenance not tracked. No reproducible build verification. Container images built from mutable tags without signature verification.',
    mitigatesRiskIds: ['scd-risk-compromised-build', 'scd-risk-unsigned-containers'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'scd-soa-a05', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A05', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Terraform state files contain unencrypted cloud credentials. Dependency Track API key hardcoded in Jenkins. Container registry allows anonymous pulls.',
    mitigatesRiskIds: ['scd-risk-terraform-credentials', 'scd-risk-pipeline-secrets', 'scd-risk-unsigned-containers'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'scd-soa-a06', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A06', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Dependency Track deployed for SBOM management but API key hardcoded. SonarQube integrated for SAST. No runtime SCA for production containers.',
    mitigatesRiskIds: ['scd-risk-dependency-poisoning'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'scd-soa-a08', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'A08', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'No build provenance attestation. Container images lack cryptographic signatures. Nexus proxied registries without namespace isolation allow dependency confusion. Code signing certificate expiring.',
    mitigatesRiskIds: ['scd-risk-dependency-poisoning', 'scd-risk-unsigned-containers', 'scd-risk-compromised-build'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'scd-soa-cis02', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.02', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'Jenkins plugin inventory partially maintained. No formal software bill of materials for build toolchain. Dependency Track covers application dependencies but not CI/CD tooling.',
    mitigatesRiskIds: ['scd-risk-compromised-build', 'scd-risk-dependency-poisoning'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'scd-soa-cis03', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.03', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'not_implemented' as const,
    justification: 'Terraform state contains plaintext credentials. Jenkins agent traffic unencrypted. Vault transit encryption not used for sensitive build parameters.',
    mitigatesRiskIds: ['scd-risk-terraform-credentials', 'scd-risk-pipeline-secrets'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
  {
    id: 'scd-soa-cis05', controlSetId: CIS_CONTROL_SET_ID, controlId: 'CIS.05', scopeType: 'system' as const, scopeId: 'system',
    applicability: 'applicable' as const, implementationStatus: 'in_progress' as const,
    justification: 'GitHub Enterprise uses MFA. GitLab uses LDAP+MFA. Jenkins uses basic auth only. Nexus uses weak shared admin credentials. Azure DevOps uses OAuth with conditional access.',
    mitigatesRiskIds: ['scd-risk-malicious-commit', 'scd-risk-compromised-build'],
    diagramRefs: [], evidence: [], updatedAt: NOW
  },
];

const workflowTasks = [
  {
    id: 'scd-task-vault-rotation',
    title: 'Rotate Vault root token and implement automated rotation',
    description: 'Emergency rotation of stale root token pending since Q2 2023. Implement automated rotation schedule and separate signing key policies.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'critical' as const,
    owner: 'Security Operations',
    dueDate: '2025-06-01',
    riskId: 'scd-risk-signing-key-theft',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scd-task-plugin-audit',
    title: 'Audit and whitelist Jenkins plugins after 2.387 upgrade',
    description: 'Review all 47 installed plugins for known vulnerabilities. Remove unnecessary plugins and pin approved versions.',
    type: 'risk_treatment' as const,
    status: 'in_progress' as const,
    priority: 'critical' as const,
    owner: 'DevOps Engineering',
    dueDate: '2025-06-10',
    riskId: 'scd-risk-compromised-build',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scd-task-namespace-scoping',
    title: 'Configure namespace scoping on Nexus proxied repositories',
    description: 'Implement namespace isolation to prevent dependency confusion attacks from public registries.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'critical' as const,
    owner: 'DevOps Engineering',
    dueDate: '2025-06-15',
    riskId: 'scd-risk-dependency-poisoning',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scd-task-container-signing',
    title: 'Implement container image signing with Cosign',
    description: 'Deploy Cosign for image signing and configure Kubernetes admission controller to enforce signature verification.',
    type: 'control_implementation' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'Platform Engineering',
    dueDate: '2025-07-01',
    riskId: 'scd-risk-unsigned-containers',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scd-task-jenkins-agent-encryption',
    title: 'Encrypt Jenkins agent communication channel',
    description: 'Replace unencrypted TCP/50000 agent protocol with TLS-encrypted WebSocket communication.',
    type: 'risk_treatment' as const,
    status: 'todo' as const,
    priority: 'high' as const,
    owner: 'DevOps Engineering',
    dueDate: '2025-06-20',
    riskId: 'scd-risk-pipeline-secrets',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scd-task-terraform-encryption',
    title: 'Enable Terraform state encryption and dynamic secrets',
    description: 'Encrypt state files at rest and replace static cloud credentials with Vault-issued dynamic secrets.',
    type: 'risk_treatment' as const,
    status: 'blocked' as const,
    priority: 'high' as const,
    owner: 'Cloud Operations',
    dueDate: '2025-07-15',
    riskId: 'scd-risk-terraform-credentials',
    createdAt: NOW, updatedAt: NOW
  },
];

const governanceDocuments = [
  {
    id: 'scd-gov-sdlc-policy',
    title: 'Secure Software Development Lifecycle Policy',
    type: 'policy' as const,
    description: 'Enterprise policy governing secure development practices, code review requirements, and build pipeline security standards.',
    owner: 'CISO',
    status: 'active' as const,
    version: '2.0',
    url: 'https://sharepoint.example.com/policies/sdlc-security-v2.pdf',
    reviewDate: '2024-12-01',
    nextReviewDate: '2025-12-01',
    tags: ['sdlc', 'development', 'supply-chain'],
    linkedRiskIds: ['scd-risk-malicious-commit', 'scd-risk-compromised-build'],
    linkedControlSetIds: [OWASP_CONTROL_SET_ID],
    linkedAssessmentIds: ['scd-assessment-supply-chain'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scd-gov-code-signing-procedure',
    title: 'Code Signing and Release Procedure',
    type: 'procedure' as const,
    description: 'Step-by-step procedure for signing software releases, managing signing keys, and distributing updates to customers.',
    owner: 'Release Engineering',
    status: 'under_review' as const,
    version: '1.3',
    reviewDate: '2024-09-01',
    nextReviewDate: '2025-03-01',
    tags: ['code-signing', 'release', 'keys'],
    linkedRiskIds: ['scd-risk-signing-key-theft', 'scd-risk-unsigned-containers'],
    linkedControlSetIds: [OWASP_CONTROL_SET_ID],
    linkedAssessmentIds: ['scd-assessment-supply-chain'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scd-gov-cicd-security-standard',
    title: 'CI/CD Pipeline Security Standard',
    type: 'standard' as const,
    description: 'Security standards for CI/CD pipeline configuration, including secret management, plugin governance, and build agent hardening.',
    owner: 'DevOps Engineering',
    status: 'active' as const,
    version: '1.1',
    reviewDate: '2025-01-15',
    nextReviewDate: '2025-07-15',
    tags: ['cicd', 'jenkins', 'pipeline', 'build-agents'],
    linkedRiskIds: ['scd-risk-compromised-build', 'scd-risk-pipeline-secrets', 'scd-risk-privileged-builders'],
    linkedControlSetIds: [CIS_CONTROL_SET_ID],
    linkedAssessmentIds: ['scd-assessment-supply-chain'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scd-gov-dependency-mgmt-guideline',
    title: 'Third-Party Dependency Management Guideline',
    type: 'guideline' as const,
    description: 'Guidelines for evaluating, approving, and monitoring third-party dependencies and package registries.',
    owner: 'Security Architecture',
    status: 'active' as const,
    version: '1.0',
    reviewDate: '2025-02-01',
    nextReviewDate: '2025-08-01',
    tags: ['dependencies', 'sbom', 'supply-chain', 'third-party'],
    linkedRiskIds: ['scd-risk-dependency-poisoning'],
    linkedControlSetIds: [OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID],
    linkedAssessmentIds: ['scd-assessment-supply-chain'],
    createdAt: NOW, updatedAt: NOW
  },
];

const threatActors = [
  {
    id: 'scd-threat-actor-nation-state', name: 'APT29 (Cozy Bear) - Supply Chain Focus',
    type: 'nation_state' as const, capabilityLevel: 5,
    resourceLevel: 'very_high' as const,
    motivation: 'Espionage and persistent access through software supply chain compromise. Targets development infrastructure to implant backdoors distributed to downstream customers.',
    description: 'Russian state-sponsored threat group known for SolarWinds SUNBURST supply chain attack. Specializes in compromising build systems, developer tools, and software update mechanisms for long-term persistent access.',
    targetedAssetIds: ['scd-asset-jenkins', 'scd-asset-update-server', 'scd-asset-github', 'scd-asset-vault'],
    tags: ['apt29', 'supply-chain', 'nation-state', 'espionage', 'sunburst'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scd-threat-actor-apt', name: 'Lazarus Group - Software Supply Chain',
    type: 'nation_state' as const, capabilityLevel: 4,
    resourceLevel: 'high' as const,
    motivation: 'Financial gain and intelligence collection through compromised development tools and developer workstations, targeting cryptocurrency and financial software supply chains.',
    description: 'North Korean state-sponsored group targeting software developers through trojanized development tools, IDE plugins, and package managers. Known for targeting npm and Python package ecosystems.',
    targetedAssetIds: ['scd-asset-dev-workstations', 'scd-asset-nexus', 'scd-asset-github'],
    tags: ['lazarus', 'supply-chain', 'developer-targeting', 'package-poisoning'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scd-threat-actor-organised-crime', name: 'CI/CD Ransomware Operators',
    type: 'organised_crime' as const, capabilityLevel: 3,
    resourceLevel: 'moderate' as const,
    motivation: 'Financial gain through ransomware deployment via compromised CI/CD pipelines and build infrastructure, maximizing impact by targeting software distribution channels.',
    description: 'Cybercriminal group specializing in targeting CI/CD infrastructure for ransomware deployment. Exploits misconfigured Jenkins instances, exposed build agents, and unrotated credentials.',
    targetedAssetIds: ['scd-asset-jenkins', 'scd-asset-build-agents', 'scd-asset-vault'],
    tags: ['ransomware', 'cicd-targeting', 'credential-harvesting'],
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scd-threat-actor-insider', name: 'Disgruntled Developer / Malicious Insider',
    type: 'insider' as const, capabilityLevel: 3,
    resourceLevel: 'moderate' as const,
    motivation: 'Sabotage, data theft, or planting backdoors leveraging legitimate access to source code repositories and build systems.',
    description: 'Current or former developer with commit access to repositories and knowledge of CI/CD pipeline configurations. Can bypass branch protections if misconfigured and inject malicious code.',
    targetedAssetIds: ['scd-asset-github', 'scd-asset-jenkins', 'scd-asset-vault'],
    tags: ['insider-threat', 'code-access', 'sabotage', 'backdoor'],
    createdAt: NOW, updatedAt: NOW
  },
];

const threatScenarios = [
  {
    id: 'scd-scenario-sunburst-style', title: 'SolarWinds-Style Build System Compromise',
    description: 'APT29-style threat actor compromises Jenkins build environment through vulnerable plugin, injects backdoor into build process that persists across builds. Malicious code is compiled into production artifacts and distributed to customers via the software update server.',
    threatActorId: 'scd-threat-actor-nation-state',
    targetedAssetIds: ['scd-asset-jenkins', 'scd-asset-build-agents', 'scd-asset-update-server', 'scd-asset-nexus'],
    attackTechniques: ['T1195.002 - Compromise Software Supply Chain', 'T1072 - Software Deployment Tools', 'T1027 - Obfuscated Files or Information'],
    linkedRiskIds: ['scd-risk-compromised-build', 'scd-risk-signing-key-theft'],
    likelihood: 'High - Jenkins plugin ecosystem is unvetted after upgrade and build agents run with elevated privileges.',
    impact: 'Critical - Malicious software distributed to all downstream customers, devastating reputational and legal consequences.',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scd-scenario-dependency-confusion', title: 'Dependency Confusion Attack via Public Registry',
    description: 'Attacker publishes higher-version malicious packages to public npm/PyPI registries matching internal package names. Nexus proxy resolves to public version, injecting malicious code into builds that flows to production.',
    threatActorId: 'scd-threat-actor-apt',
    targetedAssetIds: ['scd-asset-nexus', 'scd-asset-jenkins', 'scd-asset-container-registry'],
    attackTechniques: ['T1195.002 - Compromise Software Supply Chain', 'T1204.003 - Malicious Image', 'T1610 - Deploy Container'],
    linkedRiskIds: ['scd-risk-dependency-poisoning', 'scd-risk-unsigned-containers'],
    likelihood: 'High - Nexus proxied registries lack namespace scoping; internal package names are discoverable.',
    impact: 'Major - Poisoned dependencies compiled into production artifacts affecting all deployments.',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scd-scenario-vault-secret-theft', title: 'Vault Root Token Abuse for Signing Key Theft',
    description: 'Attacker obtains stale Vault root token through Jenkins pipeline exploitation or credential dump, then extracts code signing keys to sign malicious software updates distributed to customers.',
    threatActorId: 'scd-threat-actor-nation-state',
    targetedAssetIds: ['scd-asset-vault', 'scd-asset-update-server', 'scd-asset-jenkins'],
    attackTechniques: ['T1552.001 - Credentials In Files', 'T1588.003 - Obtain Capabilities - Code Signing Certificates', 'T1553.002 - Subvert Trust Controls - Code Signing'],
    linkedRiskIds: ['scd-risk-signing-key-theft', 'scd-risk-pipeline-secrets'],
    likelihood: 'Moderate - Root token stale since Q2 2023 but requires initial pipeline access.',
    impact: 'Critical - Signed malicious updates bypass customer verification, enabling widespread compromise.',
    createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'scd-scenario-insider-backdoor', title: 'Insider Plants Backdoor via Direct Commit',
    description: 'Malicious insider with commit access pushes obfuscated backdoor to internal GitLab repository, bypassing code review through misconfigured branch protection. The backdoor persists through CI/CD pipeline to production deployment.',
    threatActorId: 'scd-threat-actor-insider',
    targetedAssetIds: ['scd-asset-github', 'scd-asset-jenkins', 'scd-asset-vault'],
    attackTechniques: ['T1199 - Trusted Relationship', 'T1059.004 - Unix Shell', 'T1547 - Boot or Logon Autostart Execution'],
    linkedRiskIds: ['scd-risk-malicious-commit', 'scd-risk-compromised-build'],
    likelihood: 'Moderate - Requires insider access but branch protection gaps exist.',
    impact: 'Major - Backdoor in production code enables persistent unauthorized access.',
    createdAt: NOW, updatedAt: NOW
  },
];

export const supplyChainDevelopmentGrcWorkspace = buildGrcWorkspace({
  tierCatalogue,
  assets,
  risks,
  assessments,
  soaEntries,
  workflowTasks,
  governanceDocuments,
  threatActors,
  threatScenarios,
  securityInitiatives: [
    {
      id: 'scd-si-sbom-pipeline', title: 'SBOM & Dependency Integrity Pipeline',
      description: 'Establish end-to-end software bill of materials generation, dependency verification, and automated vulnerability scanning across all CI/CD pipelines to prevent dependency confusion and supply chain poisoning attacks.',
      category: 'uplift' as const, status: 'in_progress' as const, priority: 'critical' as const,
      owner: 'DevOps Engineering', executiveSponsor: 'VP Engineering',
      currentState: 'Dependency Track performs SCA scanning but SBOM generation is not integrated into CI/CD; Nexus repository accepts unsigned packages; no enforcement of package provenance verification; dependency confusion risk for internal package names.',
      targetState: 'SBOM generated at every build via CycloneDX; all packages signed and verified before deployment; Dependency Track gates block builds with critical CVEs; private registry namespace protection enforced.',
      startDate: '2025-04-01', targetDate: '2026-06-30', completedDate: '',
      milestones: [
        { id: 'scd-ms-sbom-01', title: 'Integrate CycloneDX SBOM generation into Jenkins pipelines', description: 'Add CycloneDX plugin to all Jenkins build jobs to generate and archive SBOM artifacts for every build.', status: 'completed' as const, dueDate: '2025-09-30', completedDate: '2025-09-15', owner: 'DevOps Engineering' },
        { id: 'scd-ms-sbom-02', title: 'Enable Nexus namespace protection and signature verification', description: 'Configure Nexus Repository to reject unsigned artifacts and enforce namespace protection for internal package prefixes.', status: 'in_progress' as const, dueDate: '2026-03-31', completedDate: '', owner: 'DevOps Engineering' },
        { id: 'scd-ms-sbom-03', title: 'Automated dependency provenance verification', description: 'Deploy Sigstore/cosign verification in CI pipelines to validate upstream package signatures and provenance attestations.', status: 'pending' as const, dueDate: '2026-06-30', completedDate: '', owner: 'Security Operations' },
      ],
      linkedRiskIds: ['scd-risk-dependency-poisoning', 'scd-risk-unsigned-containers', 'scd-risk-compromised-build'],
      linkedControlSetIds: [],
      linkedAssetIds: ['scd-asset-nexus', 'scd-asset-jenkins', 'scd-asset-container-registry'],
      linkedImplementedControlIds: ['scd-ic-dependency-scanning'],
      linkedAssessmentIds: ['scd-assessment-supply-chain'],
      notes: 'Aligned with NIST SSDF and SLSA Level 3 requirements. Executive priority after industry-wide supply chain incidents.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'scd-si-cicd-security', title: 'CI/CD Pipeline Security & Code Signing Hardening',
      description: 'Harden CI/CD pipeline infrastructure including Jenkins, build agents, and code signing processes to prevent build compromise, secret extraction, and unauthorized code injection.',
      category: 'remediation' as const, status: 'approved' as const, priority: 'high' as const,
      owner: 'Security Operations', executiveSponsor: 'CISO',
      currentState: 'Jenkins uses basic auth with outdated plugins; build agents run with elevated Docker privileges; Vault root token not rotated; code signing keys accessible via broad Vault policies; Terraform state exposes cloud credentials.',
      targetState: 'Jenkins upgraded with OIDC authentication; build agents run rootless containers; Vault token rotation automated with short-lived leases; code signing requires dual authorization; pipeline secrets use dynamic credentials.',
      startDate: '2025-07-01', targetDate: '2026-12-31', completedDate: '',
      milestones: [
        { id: 'scd-ms-cicd-01', title: 'Migrate Jenkins authentication to OIDC', description: 'Replace basic auth with OIDC-based SSO via corporate identity provider with MFA enforcement for all Jenkins access.', status: 'in_progress' as const, dueDate: '2026-03-31', completedDate: '', owner: 'DevOps Engineering' },
        { id: 'scd-ms-cicd-02', title: 'Implement rootless container builds on build agents', description: 'Convert Docker-in-Docker builds to rootless Podman on all build agents to eliminate privileged container execution.', status: 'pending' as const, dueDate: '2026-09-30', completedDate: '', owner: 'DevOps Engineering' },
      ],
      linkedRiskIds: ['scd-risk-compromised-build', 'scd-risk-pipeline-secrets', 'scd-risk-signing-key-theft', 'scd-risk-privileged-builders'],
      linkedControlSetIds: [],
      linkedAssetIds: ['scd-asset-jenkins', 'scd-asset-build-agents', 'scd-asset-vault'],
      linkedImplementedControlIds: ['scd-ic-code-signing'],
      linkedAssessmentIds: ['scd-assessment-supply-chain'],
      notes: 'Phase 1 focuses on authentication and secrets; Phase 2 addresses build agent isolation. Budget approved.',
      createdAt: NOW, updatedAt: NOW,
    },
  ],
  implementedControls: [
    {
      id: 'scd-ic-dependency-scanning', title: 'Automated Dependency Vulnerability Scanning',
      description: 'OWASP Dependency Track integrated with Jenkins CI pipelines providing continuous software composition analysis, CVE monitoring, and build-gate enforcement for critical vulnerabilities.',
      controlType: 'technical' as const, category: 'monitoring' as const,
      status: 'active' as const, automationLevel: 'fully_automated' as const,
      owner: 'DevOps Engineering', vendor: 'OWASP', product: 'Dependency Track', version: '4.9',
      implementedDate: '2024-06-01', lastReviewDate: '2025-05-15', nextReviewDate: '2026-05-15',
      linkedSoaEntryIds: ['scd-soa-a06', 'scd-soa-cis02'],
      linkedRiskIds: ['scd-risk-dependency-poisoning', 'scd-risk-compromised-build'],
      linkedAssetIds: ['scd-asset-nexus', 'scd-asset-jenkins', 'scd-asset-github'],
      linkedAssessmentIds: ['scd-assessment-supply-chain'],
      notes: 'Scans 1,200+ dependencies across 45 repositories. Critical CVE policy blocks builds; medium-severity bypass window is 14 days.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'scd-ic-code-signing', title: 'Code Signing Certificate & HSM Integration',
      description: 'DigiCert EV code signing certificates with private keys stored in HashiCorp Vault HSM backend, enforcing dual-authorization for signing operations on release artifacts.',
      controlType: 'technical' as const, category: 'encryption' as const,
      status: 'active' as const, automationLevel: 'semi_automated' as const,
      owner: 'Release Engineering', vendor: 'DigiCert', product: 'EV Code Signing', version: '2024',
      implementedDate: '2024-01-15', lastReviewDate: '2025-04-01', nextReviewDate: '2026-04-01',
      linkedSoaEntryIds: ['scd-soa-a08', 'scd-soa-cis03'],
      linkedRiskIds: ['scd-risk-signing-key-theft', 'scd-risk-unsigned-containers'],
      linkedAssetIds: ['scd-asset-vault', 'scd-asset-update-server'],
      linkedAssessmentIds: ['scd-assessment-supply-chain'],
      notes: 'Dual authorization required from security and release engineering leads. Annual key rotation aligned with certificate renewal.',
      createdAt: NOW, updatedAt: NOW,
    },
    {
      id: 'scd-ic-branch-protection', title: 'GitHub Branch Protection & Signed Commits',
      description: 'GitHub Enterprise branch protection rules enforcing 2-reviewer approval, signed commits, status checks, and CODEOWNERS file review requirements on all protected branches.',
      controlType: 'technical' as const, category: 'access_control' as const,
      status: 'active' as const, automationLevel: 'fully_automated' as const,
      owner: 'Platform Engineering', vendor: 'GitHub', product: 'Enterprise Cloud', version: '3.7',
      implementedDate: '2023-11-01', lastReviewDate: '2025-06-01', nextReviewDate: '2026-06-01',
      linkedSoaEntryIds: ['scd-soa-a01', 'scd-soa-cis05'],
      linkedRiskIds: ['scd-risk-malicious-commit', 'scd-risk-pipeline-secrets'],
      linkedAssetIds: ['scd-asset-github', 'scd-asset-dev-workstations'],
      linkedAssessmentIds: ['scd-assessment-supply-chain'],
      notes: 'SSO enforced via SAML. Audit log streaming to SIEM active. Admin bypass restricted to break-glass procedure.',
      createdAt: NOW, updatedAt: NOW,
    },
  ],
  thirdParties: [
    {
      id: 'scd-tp-github',
      name: 'GitHub (Microsoft)',
      description: 'SaaS source control platform hosting all application repositories, CI/CD workflows via GitHub Actions, branch protection policies, and code review processes. Central to the software supply chain.',
      category: 'saas' as const,
      status: 'active' as const,
      riskRating: 'critical' as const,
      dataClassification: 'confidential' as const,
      linkedAssetIds: ['scd-asset-github', 'scd-asset-dev-workstations'],
      linkedRiskIds: ['scd-risk-malicious-commit', 'scd-risk-pipeline-secrets'],
      contactName: 'GitHub Enterprise Support',
      contactEmail: 'enterprise-support@github.example.com',
      contractExpiry: '2027-06-30',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-12-31',
      notes: 'GitHub Enterprise Cloud with Advanced Security (GHAS) enabled. Dependabot, secret scanning, and code scanning active across all repos. SSO enforced via SAML. Branch protection requires 2 approvals and signed commits on main. Audit log streaming configured to SIEM. Supply chain risk: compromise of GitHub Actions runners could inject malicious code into build artifacts.'
    },
    {
      id: 'scd-tp-jfrog',
      name: 'JFrog',
      description: 'SaaS artifact repository platform (Artifactory) managing binary artifacts, container images, and dependency proxying. Stores all build outputs and acts as the source of truth for artifact integrity.',
      category: 'saas' as const,
      status: 'active' as const,
      riskRating: 'high' as const,
      dataClassification: 'confidential' as const,
      linkedAssetIds: ['scd-asset-nexus', 'scd-asset-container-registry'],
      linkedRiskIds: ['scd-risk-dependency-poisoning', 'scd-risk-unsigned-containers'],
      contactName: 'Rachel Kim',
      contactEmail: 'rachel.kim@jfrog.example.com',
      contractExpiry: '2027-03-31',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-09-30',
      notes: 'JFrog Artifactory Enterprise with Xray scanning enabled. Proxies npm, Maven, PyPI, and Docker Hub registries. Immutable artifacts enforced on release repositories. Xray policies block critical CVEs but medium-severity bypass window is 14 days. Artifact signing validation not yet enforced on all pull-through caches — dependency confusion risk remains for internal package names.'
    },
    {
      id: 'scd-tp-snyk',
      name: 'Snyk',
      description: 'SaaS developer security platform providing software composition analysis (SCA), container scanning, and infrastructure-as-code security testing integrated into CI/CD pipelines.',
      category: 'saas' as const,
      status: 'active' as const,
      riskRating: 'medium' as const,
      dataClassification: 'internal' as const,
      linkedAssetIds: ['scd-asset-github', 'scd-asset-jenkins', 'scd-asset-container-registry'],
      linkedRiskIds: ['scd-risk-dependency-poisoning', 'scd-risk-compromised-build'],
      contactName: 'David Okonkwo',
      contactEmail: 'david.okonkwo@snyk.example.com',
      contractExpiry: '2026-11-30',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-08-31',
      notes: 'Snyk Enterprise plan integrated with GitHub repos and Jenkins pipelines. Monitors 1,200+ dependencies across 45 repositories. CLI-based scanning in CI gates blocks builds with critical vulnerabilities. License compliance policies configured for copyleft detection. Read-only access to source code via GitHub App integration — no production data exposure. Vulnerability database updates hourly.'
    },
    {
      id: 'scd-tp-digicert',
      name: 'DigiCert',
      description: 'Certificate authority and code signing certificate supplier providing Extended Validation (EV) code signing certificates, timestamping services, and certificate lifecycle management for software releases.',
      category: 'supplier' as const,
      status: 'active' as const,
      riskRating: 'high' as const,
      dataClassification: 'confidential' as const,
      linkedAssetIds: ['scd-asset-vault', 'scd-asset-update-server'],
      linkedRiskIds: ['scd-risk-signing-key-theft', 'scd-risk-unsigned-containers'],
      contactName: 'Margaret Torres',
      contactEmail: 'margaret.torres@digicert.example.com',
      contractExpiry: '2027-01-15',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-07-15',
      notes: 'EV code signing certificates with HSM-backed private keys stored in HashiCorp Vault. Timestamping via DigiCert Timestamp Authority. Certificate renewal requires dual-authorization from security and release engineering leads. Compromise of signing keys would enable trojanized updates to propagate to all downstream consumers — APT29 has historically targeted code signing infrastructure. Annual WebTrust audit reviewed.'
    },
    {
      id: 'scd-tp-sonarqube',
      name: 'SonarQube Cloud (SonarSource)',
      description: 'SaaS code quality and security analysis platform providing static application security testing (SAST), code smell detection, and technical debt tracking across all repositories.',
      category: 'saas' as const,
      status: 'active' as const,
      riskRating: 'medium' as const,
      dataClassification: 'internal' as const,
      linkedAssetIds: ['scd-asset-github', 'scd-asset-jenkins', 'scd-asset-build-agents'],
      linkedRiskIds: ['scd-risk-compromised-build', 'scd-risk-malicious-commit'],
      contactName: 'Antoine Lefebvre',
      contactEmail: 'antoine.lefebvre@sonarsource.example.com',
      contractExpiry: '2026-09-30',
      lastAssessmentDate: NOW,
      nextReviewDate: '2026-06-30',
      notes: 'SonarQube Cloud Enterprise edition with quality gates enforced on all pull requests. Scans source code for security hotspots, injection flaws, and cryptographic weaknesses. Integrated with GitHub checks — PRs cannot merge without passing quality gate. Processes source code but does not store it beyond analysis duration. SOC 2 Type II compliant. Covers 18 languages across the development portfolio.'
    },
  ],
});

export const supplyChainDevelopment: ExampleSystem = {
  id: 'supply-chain-dev',
  name: 'Software Supply Chain & Development - APT29',
  description: 'Enterprise software development pipeline with CI/CD, artifact management, and cloud integration',
  category: 'Enterprise Systems',
  primaryZone: 'Internal',
  dataClassification: 'Confidential',
  nodes,
  edges,
  customContext: `### System Overview
  This represents our enterprise software development and deployment pipeline, supporting both internal development and customer software distribution.
  
  ### Technical Architecture
  - **Development Flow**: GitHub Enterprise → Jenkins CI/CD → Nexus Repository → Production Kubernetes
  - **Cloud Integration**: Hybrid approach with Azure DevOps for cloud-native workloads
  - **Security Scanning**: SonarQube for SAST, Dependency Track for SCA/SBOM management
  - **Secrets Management**: HashiCorp Vault for credential storage (pending root token rotation)
  
  ### Key Details
  - Jenkins service account has broad access across environments for deployment automation
  - Build agents run with elevated privileges to support Docker-in-Docker builds
  - Azure service principal has Contributor role on entire subscription for infrastructure provisioning
  - Terraform state files in cloud storage contain unencrypted provider credentials
  - Container registry allows anonymous pull access from CI/CD subnet
  - Software update server's code signing certificate expires March 2024
  - GitHub webhooks use basic authentication tokens stored in Jenkins
  
  ### Recent Changes
  - Migrated from Jenkins 2.319 to 2.387 last month, still testing all plugins
  - Implemented RBAC in Kubernetes but some service accounts retain cluster-admin
  - Added Dependency Track for SBOM but API integration uses hardcoded keys
  - Vault root token rotation scheduled but postponed due to production freeze
  
  ### Operational Notes
  - Developers have local admin rights for tooling flexibility
  - CI/CD pipeline can deploy directly to production with Jenkins credentials
  - Cloud build agents auto-scale and have managed identity with broad permissions
  - Cross-account AWS access configured via role assumption for CodeArtifact`,
  grcWorkspace: supplyChainDevelopmentGrcWorkspace,
  attackPaths: [
    {
      id: 'scd-ap-dependency-confusion',
      name: 'Dependency Confusion → Build Compromise → Production Deployment',
      strideCategory: 'Tampering' as StrideCategory,
      riskLevel: 'Critical' as AttackPathRiskLevel,
      description: 'Attacker publishes malicious package to public registry matching internal package name. Nexus proxy resolves to the public version due to unscoped namespace configuration, poisoning build artifacts that flow through to the container registry and are pulled by production Kubernetes.',
      steps: [
        { order: 1, edgeId: 'jenkins-to-nexus', sourceNodeId: 'jenkins-ci', targetNodeId: 'nexus-repo', technique: 'T1195.002: Supply Chain Compromise - Compromise Software Supply Chain' },
        { order: 2, edgeId: 'nexus-to-registry', sourceNodeId: 'nexus-repo', targetNodeId: 'container-registry', technique: 'T1204.003: User Execution - Malicious Image' },
        { order: 3, edgeId: 'k8s-to-registry', sourceNodeId: 'prod-k8s', targetNodeId: 'container-registry', technique: 'T1610: Deploy Container' },
      ],
      mitreTechniques: ['T1195.002', 'T1204.003', 'T1610'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'scd-ap-malicious-commit',
      name: 'Compromised Developer → Malicious Commit → Customer Update Poisoning',
      strideCategory: 'Tampering' as StrideCategory,
      riskLevel: 'Critical' as AttackPathRiskLevel,
      description: 'Nation-state actor compromises developer workstation via trojanized tooling, pushes malicious commit to GitHub Enterprise that triggers automated Jenkins build. Poisoned artifact flows through the pipeline to the software update server, distributing backdoored software to downstream customers.',
      steps: [
        { order: 1, edgeId: 'dev-to-github', sourceNodeId: 'developer-endpoints', targetNodeId: 'github-repo', technique: 'T1199: Trusted Relationship' },
        { order: 2, edgeId: 'github-to-jenkins', sourceNodeId: 'github-repo', targetNodeId: 'jenkins-ci', technique: 'T1072: Software Deployment Tools' },
        { order: 3, edgeId: 'jenkins-to-nexus', sourceNodeId: 'jenkins-ci', targetNodeId: 'nexus-repo', technique: 'T1195.002: Supply Chain Compromise' },
        { order: 4, edgeId: 'jenkins-to-update', sourceNodeId: 'jenkins-ci', targetNodeId: 'update-server', technique: 'T1195.002: Supply Chain Compromise - Compromise Software Supply Chain' },
      ],
      mitreTechniques: ['T1199', 'T1072', 'T1195.002'],
      createdAt: '2025-06-01T00:05:00.000Z',
      updatedAt: '2025-06-01T00:05:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'scd-ap-pipeline-secret-theft',
      name: 'CI/CD Pipeline Exploitation → Secret Extraction → Cloud Takeover',
      strideCategory: 'Information Disclosure' as StrideCategory,
      riskLevel: 'High' as AttackPathRiskLevel,
      description: 'Attacker exploits Jenkins pipeline configuration or compromised plugin to extract Vault credentials via the stale root token, then retrieves cloud infrastructure secrets from Terraform state to gain full cloud environment control.',
      steps: [
        { order: 1, edgeId: 'github-to-jenkins', sourceNodeId: 'github-repo', targetNodeId: 'jenkins-ci', technique: 'T1059.004: Command and Scripting Interpreter - Unix Shell' },
        { order: 2, edgeId: 'jenkins-to-vault', sourceNodeId: 'jenkins-ci', targetNodeId: 'secrets-vault', technique: 'T1552.001: Unsecured Credentials - Credentials In Files' },
        { order: 3, edgeId: 'vault-to-terraform', sourceNodeId: 'secrets-vault', targetNodeId: 'terraform-state', technique: 'T1552.005: Unsecured Credentials - Cloud Instance Metadata API' },
      ],
      mitreTechniques: ['T1059.004', 'T1552.001', 'T1552.005'],
      createdAt: '2025-06-01T00:10:00.000Z',
      updatedAt: '2025-06-01T00:10:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'scd-ap-third-party-vuln',
      name: 'Third-Party Library Vulnerability → Application Compromise',
      strideCategory: 'Elevation of Privilege' as StrideCategory,
      riskLevel: 'Medium' as AttackPathRiskLevel,
      description: 'Known vulnerability in a third-party library passes through SonarQube and Dependency Track scanning without blocking the build. The vulnerable dependency is compiled into the application, deployed to production Kubernetes where it is exploited for remote code execution.',
      steps: [
        { order: 1, edgeId: 'jenkins-to-deptrack', sourceNodeId: 'jenkins-ci', targetNodeId: 'dependency-track', technique: 'T1195.001: Supply Chain Compromise - Compromise Software Dependencies and Development Tools' },
        { order: 2, edgeId: 'jenkins-to-nexus', sourceNodeId: 'jenkins-ci', targetNodeId: 'nexus-repo', technique: 'T1195.002: Supply Chain Compromise - Compromise Software Supply Chain' },
        { order: 3, edgeId: 'nexus-to-registry', sourceNodeId: 'nexus-repo', targetNodeId: 'container-registry', technique: 'T1204.003: User Execution - Malicious Image' },
        { order: 4, edgeId: 'k8s-to-registry', sourceNodeId: 'prod-k8s', targetNodeId: 'container-registry', technique: 'T1203: Exploitation for Client Execution' },
      ],
      mitreTechniques: ['T1195.001', 'T1195.002', 'T1204.003', 'T1203'],
      createdAt: '2025-06-01T00:15:00.000Z',
      updatedAt: '2025-06-01T00:15:00.000Z',
    } as DiagramAttackPath,
  ],
};