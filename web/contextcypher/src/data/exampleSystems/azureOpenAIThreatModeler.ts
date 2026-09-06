import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityNode, SecurityEdge, SecurityZone } from '../../types/SecurityTypes';
import { colors } from '../../styles/Theme';
import { DiagramAttackPath } from '../../types/GrcTypes';
import { buildGrcWorkspace, score, NOW, OWASP_CONTROL_SET_ID, CIS_CONTROL_SET_ID } from './grcSharedBase';

export const azureOpenAIThreatModeler: ExampleSystem = {
  id: 'azure-openai-threat-modeler',
  name: 'Secure Azure OpenAI Enterprise',
  description: 'Zero Trust architecture for enterprise AI with Azure OpenAI private endpoints',
  category: 'Secure Systems',
  // securityLevel removed - no longer part of the system model
  primaryZone: 'Cloud',
  dataClassification: 'Confidential',
  customContext: `# Secure Azure OpenAI Enterprise

## System Overview
This represents a maximum-security enterprise deployment of Azure OpenAI using Zero Trust principles and private endpoints. The system is designed for organizations processing highly sensitive data including financial models, healthcare records, and intellectual property. All connections use Azure Private Link, ensuring no data traverses the public internet.

## Business Context
- **Industry**: Financial Services, Healthcare, Government
- **Scale**: 10,000+ users across global offices
- **Compliance**: SOC 2 Type II, ISO 27001, HIPAA, GDPR, FedRAMP
- **Data Sensitivity**: Trade secrets, PII, PHI, classified information

## Security Architecture
- **Zero Trust Model**: Never trust, always verify with continuous validation
- **Private Connectivity**: Azure ExpressRoute and Private Endpoints only
- **Defense in Depth**: Multiple security layers from edge to data
- **Microsegmentation**: Granular network isolation with NSGs
- **Encryption Everywhere**: TLS 1.3, mTLS, and encryption at rest

## Key Security Features
- **Azure Private Link**: All services accessed via private endpoints
- **Managed HSM**: FIPS 140-2 Level 3 hardware security modules
- **Privileged Identity Management**: Just-in-time access with MFA
- **Advanced Threat Protection**: Azure Defender and Sentinel integration
- **Compliance Monitoring**: Continuous compliance validation

## Architecture Highlights
- **Hub-Spoke Network**: Centralized security controls with isolated spokes
- **Landing Zones**: Separate environments for dev, test, and production
- **Policy as Code**: Azure Policy for automated governance
- **Immutable Infrastructure**: Container-based deployments with GitOps
- **Zero Standing Privileges**: All access requires approval workflows

## Operational Security
- **24/7 SOC**: Security Operations Center with automated response
- **Threat Hunting**: Proactive threat detection using AI/ML
- **Incident Response**: Automated playbooks and forensics
- **Vulnerability Management**: Continuous scanning and patching
- **Security Training**: Mandatory security awareness for all users`,

  nodes: [
    // Security Zones — Hub-Spoke architecture
    // External: 3 nodes → 600px, x=50
    {
      id: 'external-zone',
      type: 'securityZone',
      position: { x: 50, y: 50 },
      data: {
        label: 'External Zone',
        zoneType: 'External' as SecurityZone,
        description: 'Internet-facing edge services',
        zone: 'Internet' as SecurityZone
      },
      style: {
        width: 600,
        height: 1000,
        background: colors.zoneBackgrounds.External,
        zIndex: -1
      }
    } as SecurityNode,
    // DMZ: 4 nodes → 750px, x=770
    {
      id: 'dmz-zone',
      type: 'securityZone',
      position: { x: 770, y: 50 },
      data: {
        label: 'DMZ Zone',
        zoneType: 'DMZ' as SecurityZone,
        description: 'Perimeter security services'
      },
      style: {
        width: 750,
        height: 1000,
        background: colors.zoneBackgrounds.DMZ,
        zIndex: -1
      }
    } as SecurityNode,
    // Cloud: 6 nodes → 800px, x=1640
    {
      id: 'cloud-zone',
      type: 'securityZone',
      position: { x: 1640, y: 50 },
      data: {
        label: 'Cloud Zone',
        zoneType: 'Cloud' as SecurityZone,
        description: 'Azure landing zone hub'
      },
      style: {
        width: 800,
        height: 1000,
        background: colors.zoneBackgrounds.Cloud,
        zIndex: -1
      }
    } as SecurityNode,
    // Restricted: 7 nodes → 900px, x=2560
    {
      id: 'restricted-zone',
      type: 'securityZone',
      position: { x: 2560, y: 50 },
      data: {
        label: 'Restricted Zone',
        zoneType: 'Restricted' as SecurityZone,
        description: 'Azure OpenAI private services'
      },
      style: {
        width: 900,
        height: 1000,
        background: colors.zoneBackgrounds.Restricted,
        zIndex: -1
      }
    } as SecurityNode,

    // External Zone Components (zone x=50, fit within 600px)
    {
      id: 'corporate-users',
      type: 'user',
      position: { x: 175, y: 175 },
      data: {
        label: 'Enterprise Users',
        description: 'Global workforce with managed devices',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'IPSec'],
        vendor: 'various',
        product: 'managed-endpoints',
        version: 'latest',
        securityControls: ['Device Compliance', 'Conditional Access', 'MFA', 'EDR']
      }
    } as SecurityNode,
    {
      id: 'internet-edge',
      type: 'router',
      position: { x: 375, y: 325 },
      data: {
        label: 'Internet Edge Router',
        description: 'BGP peering with ISPs',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Public',
        protocols: ['BGP', 'IPSec'],
        vendor: 'cisco',
        product: 'asr-9000',
        version: '7.3.2',
        securityControls: ['DDoS Protection', 'BGP Security', 'Access Lists']
      }
    } as SecurityNode,
    {
      id: 'vpn-gateway',
      type: 'vpnGateway',
      position: { x: 175, y: 475 },
      data: {
        label: 'Global VPN Gateway',
        description: 'Site-to-site and remote access VPN',
        zone: 'External' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['IPSec', 'IKEv2'],
        vendor: 'paloalto',
        product: 'globalprotect',
        version: '10.2.7',
        securityControls: ['Certificate Auth', 'Split Tunneling Disabled', 'Always-On VPN']
      }
    } as SecurityNode,

    // DMZ Zone Components (zone x shifted from 820→770, delta=-50)
    {
      id: 'waf',
      type: 'waf',
      position: { x: 975, y: 175 },
      data: {
        label: 'Web Application Firewall',
        description: 'Layer 7 protection for web services',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'HTTP/2'],
        vendor: 'f5',
        product: 'big-ip-asm',
        version: '16.1.3',
        securityControls: ['OWASP Top 10', 'Bot Protection', 'API Security', 'Rate Limiting']
      }
    } as SecurityNode,
    {
      id: 'azure-firewall',
      type: 'firewall',
      position: { x: 975, y: 375 },
      data: {
        label: 'Azure Firewall Premium',
        description: 'Cloud-native network security',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['HTTPS', 'TLS Inspection'],
        vendor: 'microsoft',
        product: 'azure-firewall',
        version: 'Premium',
        securityControls: ['IDPS', 'TLS Inspection', 'Threat Intelligence', 'FQDN Filtering']
      }
    } as SecurityNode,
    {
      id: 'expressroute',
      type: 'router',
      position: { x: 1225, y: 725 },
      data: {
        label: 'ExpressRoute Circuit',
        description: 'Private connectivity to Azure',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['BGP', 'VLAN'],
        vendor: 'microsoft',
        product: 'expressroute',
        version: '10Gbps',
        securityControls: ['Private Peering', 'Redundant Circuits', 'QoS', 'MACsec']
      }
    } as SecurityNode,
    {
      id: 'ddos-protection',
      type: 'ids',
      position: { x: 1125, y: 575 },
      data: {
        label: 'DDoS Protection',
        description: 'Azure DDoS Protection Standard',
        zone: 'DMZ' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['NetFlow', 'sFlow'],
        vendor: 'microsoft',
        product: 'azure-ddos',
        version: 'Standard',
        securityControls: ['Adaptive Tuning', 'Attack Analytics', 'Mitigation Policies']
      }
    } as SecurityNode,

    // Cloud Zone Components (Hub) (zone x shifted from 1590→1640, delta=+50)
    {
      id: 'hub-vnet',
      type: 'switch',
      position: { x: 1875, y: 175 },
      data: {
        label: 'Hub Virtual Network',
        description: 'Central connectivity hub',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        protocols: ['VXLAN', 'BGP'],
        vendor: 'microsoft',
        product: 'azure-vnet',
        version: 'Hub',
        securityControls: ['NSG Rules', 'Service Endpoints', 'Private DNS Zones']
      }
    } as SecurityNode,
    {
      id: 'azure-bastion',
      type: 'bastionHost',
      position: { x: 1725, y: 325 },
      data: {
        label: 'Azure Bastion',
        description: 'Secure RDP/SSH access',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['RDP', 'SSH'],
        vendor: 'microsoft',
        product: 'azure-bastion',
        version: 'Standard',
        securityControls: ['Just-In-Time Access', 'Session Recording', 'MFA Required']
      }
    } as SecurityNode,
    {
      id: 'log-analytics',
      type: 'logging',
      position: { x: 2075, y: 325 },
      data: {
        label: 'Log Analytics Workspace',
        description: 'Centralized logging and analytics',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'CEF'],
        vendor: 'microsoft',
        product: 'log-analytics',
        version: '2024',
        securityControls: ['Data Retention Policies', 'RBAC', 'Customer-Managed Keys']
      }
    } as SecurityNode,
    {
      id: 'key-vault',
      type: 'hsm',
      position: { x: 1875, y: 475 },
      data: {
        label: 'Azure Key Vault HSM',
        description: 'Hardware security module for keys',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'PKCS#11'],
        vendor: 'microsoft',
        product: 'key-vault-hsm',
        version: 'Premium',
        securityControls: ['FIPS 140-2 Level 3', 'Key Rotation', 'Access Policies']
      }
    } as SecurityNode,
    {
      id: 'azure-ad',
      type: 'authServer',
      position: { x: 1725, y: 625 },
      data: {
        label: 'Azure AD Premium',
        description: 'Identity and access management',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['SAML', 'OAuth2', 'OIDC'],
        vendor: 'microsoft',
        product: 'azure-ad',
        version: 'P2',
        securityControls: ['Conditional Access', 'PIM', 'Identity Protection', 'Passwordless']
      }
    } as SecurityNode,
    {
      id: 'azure-sentinel',
      type: 'siem',
      position: { x: 2025, y: 825 },
      data: {
        label: 'Azure Sentinel',
        description: 'Cloud-native SIEM/SOAR',
        zone: 'Cloud' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'CEF', 'Syslog'],
        vendor: 'microsoft',
        product: 'azure-sentinel',
        version: '2024',
        securityControls: ['Threat Hunting', 'Automated Response', 'ML Detection']
      }
    } as SecurityNode,

    // Restricted Zone Components (Spoke) (zone x shifted from 2360→2560, delta=+200)
    {
      id: 'spoke-vnet',
      type: 'switch',
      position: { x: 2775, y: 175 },
      data: {
        label: 'AI Spoke VNet',
        description: 'Isolated network for AI services',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['VXLAN', 'Private Link'],
        vendor: 'microsoft',
        product: 'azure-vnet',
        version: 'Spoke',
        securityControls: ['Network Isolation', 'No Internet Access', 'Private Endpoints Only']
      }
    } as SecurityNode,
    {
      id: 'openai-endpoint',
      type: 'aiModel',
      position: { x: 2775, y: 325 },
      data: {
        label: 'Azure OpenAI Private Endpoint',
        description: 'GPT-4 with private connectivity',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'Private Link'],
        vendor: 'microsoft',
        product: 'azure-openai',
        version: 'gpt-4-turbo',
        securityControls: ['Private Endpoint', 'Managed Identity', 'Content Filtering', 'Abuse Monitoring']
      }
    } as SecurityNode,
    {
      id: 'app-service',
      type: 'application',
      position: { x: 2625, y: 475 },
      data: {
        label: 'App Service Environment',
        description: 'Isolated compute for AI apps',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'WebSockets'],
        vendor: 'microsoft',
        product: 'app-service',
        version: 'ASEv3',
        securityControls: ['Network Isolation', 'Managed Identity', 'TLS 1.3 Only']
      }
    } as SecurityNode,
    {
      id: 'cosmos-db',
      type: 'database',
      position: { x: 3325, y: 225 },
      data: {
        label: 'Cosmos DB',
        description: 'Multi-model database for AI data',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'MongoDB API'],
        vendor: 'microsoft',
        product: 'cosmos-db',
        version: 'Serverless',
        securityControls: ['Encryption at Rest', 'Private Endpoints', 'RBAC', 'Backup Encryption']
      }
    } as SecurityNode,
    {
      id: 'container-registry',
      type: 'containerRegistry',
      position: { x: 3025, y: 875 },
      data: {
        label: 'Container Registry',
        description: 'Private registry for AI containers',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'Docker Registry API'],
        vendor: 'microsoft',
        product: 'acr',
        version: 'Premium',
        securityControls: ['Vulnerability Scanning', 'Content Trust', 'Private Endpoints']
      }
    } as SecurityNode,
    {
      id: 'aks-cluster',
      type: 'computeCluster',
      position: { x: 3325, y: 575 },
      data: {
        label: 'AKS Private Cluster',
        description: 'Kubernetes for AI workloads',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        protocols: ['HTTPS', 'gRPC'],
        vendor: 'microsoft',
        product: 'aks',
        version: '1.28',
        securityControls: ['Private Cluster', 'Azure Policy', 'Defender for Containers']
      }
    } as SecurityNode,
    {
      id: 'cognitive-search',
      type: 'search',
      position: { x: 2775, y: 775 },
      data: {
        label: 'Cognitive Search',
        description: 'AI-powered search service',
        zone: 'Restricted' as SecurityZone,
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        protocols: ['HTTPS', 'REST API'],
        vendor: 'microsoft',
        product: 'cognitive-search',
        version: 'Standard',
        securityControls: ['Private Endpoints', 'Index Encryption', 'Query Throttling']
      }
    } as SecurityNode
  ],

  edges: [
    // External to DMZ flows
    {
      id: 'e1',
      source: 'corporate-users',
      target: 'internet-edge',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'HTTPS Traffic',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'External' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e2',
      source: 'corporate-users',
      target: 'vpn-gateway',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'VPN Connection',
        protocol: 'IPSec',
        encryption: 'AES-256',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'External' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e3',
      source: 'internet-edge',
      target: 'waf',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Web Traffic',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e4',
      source: 'vpn-gateway',
      target: 'azure-firewall',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'VPN Traffic',
        protocol: 'IPSec',
        encryption: 'AES-256',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'DMZ' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,

    // DMZ to Cloud flows
    {
      id: 'e5',
      source: 'waf',
      target: 'azure-firewall',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Filtered Traffic',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone,
        animated: false
      }
    } as SecurityEdge,
    {
      id: 'e6',
      source: 'azure-firewall',
      target: 'hub-vnet',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Inspected Traffic',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'Cloud' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e7',
      source: 'expressroute',
      target: 'hub-vnet',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Private Circuit',
        protocol: 'BGP',
        encryption: 'MACsec',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Cloud' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e8',
      source: 'ddos-protection',
      target: 'azure-firewall',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'DDoS Mitigation',
        protocol: 'NetFlow',
        encryption: 'none',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Internal',
        zone: 'DMZ' as SecurityZone,
        animated: false
      }
    } as SecurityEdge,

    // Cloud Hub interactions
    {
      id: 'e9',
      source: 'hub-vnet',
      target: 'azure-bastion',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Admin Access',
        protocol: 'RDP/SSH',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Cloud' as SecurityZone,
        animated: false
      }
    } as SecurityEdge,
    {
      id: 'e10',
      source: 'hub-vnet',
      target: 'log-analytics',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Log Collection',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e11',
      source: 'hub-vnet',
      target: 'key-vault',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Key Management',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Cloud' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e12',
      source: 'azure-ad',
      target: 'hub-vnet',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Authentication',
        protocol: 'OAuth2',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Cloud' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e13',
      source: 'log-analytics',
      target: 'azure-sentinel',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Security Events',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,

    // Hub to Spoke (Cloud to Restricted)
    {
      id: 'e14',
      source: 'hub-vnet',
      target: 'spoke-vnet',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'VNet Peering',
        protocol: 'VXLAN',
        encryption: 'IPSec',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e15',
      source: 'key-vault',
      target: 'openai-endpoint',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'API Keys',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone,
        animated: false
      }
    } as SecurityEdge,
    {
      id: 'e16',
      source: 'azure-ad',
      target: 'spoke-vnet',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Managed Identity',
        protocol: 'OAuth2',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone,
        animated: false
      }
    } as SecurityEdge,

    // Restricted Zone interactions
    {
      id: 'e17',
      source: 'spoke-vnet',
      target: 'openai-endpoint',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Private Endpoint',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e18',
      source: 'app-service',
      target: 'openai-endpoint',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'AI API Calls',
        protocol: 'HTTPS',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e19',
      source: 'app-service',
      target: 'cosmos-db',
      type: 'securityEdge',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: 'Data Storage',
        protocol: 'MongoDB Wire',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e20',
      source: 'aks-cluster',
      target: 'container-registry',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'Image Pull',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Restricted' as SecurityZone,
        animated: false
      }
    } as SecurityEdge,
    {
      id: 'e21',
      source: 'aks-cluster',
      target: 'app-service',
      type: 'securityEdge',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      data: {
        label: 'Microservices',
        protocol: 'gRPC',
        encryption: 'mTLS',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Confidential',
        zone: 'Restricted' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e22',
      source: 'openai-endpoint',
      target: 'cognitive-search',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: {
        label: 'Embeddings',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Restricted' as SecurityZone,
        animated: true
      }
    } as SecurityEdge,
    {
      id: 'e23',
      source: 'cosmos-db',
      target: 'cognitive-search',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'right',
      data: {
        label: 'Index Sync',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Restricted' as SecurityZone,
        animated: false
      }
    } as SecurityEdge,

    // Monitoring flows — route via bottom channel at y≈1010
    {
      id: 'e24',
      source: 'spoke-vnet',
      target: 'log-analytics',
      type: 'securityEdge',
      sourceHandle: 'bottom',
      targetHandle: 'bottom',
      data: {
        label: 'Network Logs',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone,
        animated: false
      }
    } as SecurityEdge,
    {
      id: 'e25',
      source: 'openai-endpoint',
      target: 'azure-sentinel',
      type: 'securityEdge',
      sourceHandle: 'left',
      targetHandle: 'right',
      data: {
        label: 'AI Usage Monitoring',
        protocol: 'HTTPS',
        encryption: 'TLS 1.3',
        // securityLevel removed - no longer part of the system model
        dataClassification: 'Sensitive',
        zone: 'Cloud' as SecurityZone,
        animated: false
      }
    } as SecurityEdge
  ],
  attackPaths: [
    {
      id: 'ap-az-vpn-pivot',
      name: 'Compromised VPN → Azure Firewall → Hub VNet → Spoke VNet → OpenAI Endpoint',
      strideCategory: 'Elevation of Privilege',
      riskLevel: 'High',
      description: 'Attacker compromises corporate VPN credentials, traverses the Azure Firewall into the hub VNet, pivots to the spoke VNet, and accesses the Azure OpenAI private endpoint to extract or manipulate AI model outputs.',
      steps: [
        { order: 1, edgeId: 'e2', sourceNodeId: 'corporate-users', targetNodeId: 'vpn-gateway', technique: 'T1133: External Remote Services' },
        { order: 2, edgeId: 'e4', sourceNodeId: 'vpn-gateway', targetNodeId: 'azure-firewall', technique: 'T1090: Proxy' },
        { order: 3, edgeId: 'e6', sourceNodeId: 'azure-firewall', targetNodeId: 'hub-vnet', technique: 'T1021: Remote Services' },
        { order: 4, edgeId: 'e14', sourceNodeId: 'hub-vnet', targetNodeId: 'spoke-vnet', technique: 'T1570: Lateral Tool Transfer' },
        { order: 5, edgeId: 'e17', sourceNodeId: 'spoke-vnet', targetNodeId: 'openai-endpoint', technique: 'T1530: Data from Cloud Storage Object' },
      ],
      mitreTechniques: ['T1133', 'T1090', 'T1021', 'T1570', 'T1530'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-az-prompt-injection',
      name: 'App Service → OpenAI Prompt Injection → Cosmos DB Data Leak',
      strideCategory: 'Information Disclosure',
      riskLevel: 'Medium',
      description: 'Attacker injects adversarial prompts through the app service to manipulate the Azure OpenAI endpoint into revealing sensitive data from Cosmos DB through the cognitive search index.',
      steps: [
        { order: 1, edgeId: 'e18', sourceNodeId: 'app-service', targetNodeId: 'openai-endpoint', technique: 'T1059: Command and Scripting Interpreter' },
        { order: 2, edgeId: 'e22', sourceNodeId: 'openai-endpoint', targetNodeId: 'cognitive-search', technique: 'T1213: Data from Information Repositories' },
        { order: 3, edgeId: 'e23', sourceNodeId: 'cosmos-db', targetNodeId: 'cognitive-search', technique: 'T1005: Data from Local System' },
      ],
      mitreTechniques: ['T1059', 'T1213', 'T1005'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
    {
      id: 'ap-az-key-vault-abuse',
      name: 'Azure AD Compromise → Key Vault → OpenAI API Key Theft',
      strideCategory: 'Spoofing',
      riskLevel: 'Medium',
      description: 'Attacker compromises an Azure AD account with privileged access, retrieves API keys from Key Vault, and uses them to directly access the OpenAI endpoint outside normal application flow.',
      steps: [
        { order: 1, edgeId: 'e12', sourceNodeId: 'azure-ad', targetNodeId: 'hub-vnet', technique: 'T1078.004: Valid Accounts: Cloud Accounts' },
        { order: 2, edgeId: 'e11', sourceNodeId: 'hub-vnet', targetNodeId: 'key-vault', technique: 'T1552: Unsecured Credentials' },
        { order: 3, edgeId: 'e15', sourceNodeId: 'key-vault', targetNodeId: 'openai-endpoint', technique: 'T1528: Steal Application Access Token' },
      ],
      mitreTechniques: ['T1078.004', 'T1552', 'T1528'],
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    } as DiagramAttackPath,
  ],
  grcWorkspace: buildGrcWorkspace({
    tierCatalogue: [
      { id: 'az-t1-cyber', tier: 1 as const, label: 'Cyber Risk', description: 'Azure cloud security threats' },
      { id: 'az-t1-compliance', tier: 1 as const, label: 'Compliance Risk', description: 'SOC 2, HIPAA, FedRAMP compliance' },
      { id: 'az-t1-ai', tier: 1 as const, label: 'AI Risk', description: 'Responsible AI and model security' },
      { id: 'az-t2-identity', tier: 2 as const, label: 'Cloud Identity', parentId: 'az-t1-cyber', description: 'Azure AD and PIM threats' },
      { id: 'az-t2-network', tier: 2 as const, label: 'Network Security', parentId: 'az-t1-cyber', description: 'VPN, ExpressRoute, NSG threats' },
      { id: 'az-t2-data', tier: 2 as const, label: 'Data Protection', parentId: 'az-t1-cyber', description: 'Cosmos DB and Key Vault security' },
      { id: 'az-t2-prompt', tier: 2 as const, label: 'Prompt Security', parentId: 'az-t1-ai', description: 'Prompt injection and AI abuse' },
      { id: 'az-t3-vpn-compromise', tier: 3 as const, label: 'VPN Credential Theft', parentId: 'az-t2-network' },
      { id: 'az-t3-prompt-injection', tier: 3 as const, label: 'Prompt Injection', parentId: 'az-t2-prompt' },
      { id: 'az-t3-key-vault', tier: 3 as const, label: 'Key Vault Abuse', parentId: 'az-t2-identity' },
    ],
    assets: [
      { id: 'az-asset-openai', name: 'Azure OpenAI Private Endpoint', type: 'ai_service', owner: 'AI Team', criticality: 5, linkedNodeIds: ['openai-endpoint'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'az-asset-cosmos', name: 'Cosmos DB', type: 'database', owner: 'DBA Team', criticality: 5, linkedNodeIds: ['cosmos-db'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'az-asset-keyvault', name: 'Azure Key Vault', type: 'key_management', owner: 'Security Team', criticality: 5, linkedNodeIds: ['key-vault'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'az-asset-ad', name: 'Azure Active Directory', type: 'identity_provider', owner: 'Identity Team', criticality: 5, linkedNodeIds: ['azure-ad'], status: 'active', createdAt: NOW, updatedAt: NOW },
      { id: 'az-asset-hub', name: 'Hub VNet', type: 'network', owner: 'Network Team', criticality: 4, linkedNodeIds: ['hub-vnet'], status: 'active', createdAt: NOW, updatedAt: NOW },
    ],
    risks: [
      { id: 'az-risk-vpn', title: 'VPN Gateway Credential Compromise', description: 'Stolen VPN credentials allow traversal into hub VNet and lateral movement to OpenAI endpoint.', tierId: 'az-t3-vpn-compromise', linkedAssetIds: ['az-asset-hub', 'az-asset-openai'], likelihood: 'likelihood-2', impact: 'impact-5', currentScore: score('likelihood-2', 'impact-5'), status: 'open', owner: 'Network Team', createdAt: NOW, updatedAt: NOW },
      { id: 'az-risk-prompt', title: 'Prompt Injection via App Service', description: 'Adversarial prompts could cause OpenAI to leak indexed data from Cosmos DB.', tierId: 'az-t3-prompt-injection', linkedAssetIds: ['az-asset-openai', 'az-asset-cosmos'], likelihood: 'likelihood-3', impact: 'impact-4', currentScore: score('likelihood-3', 'impact-4'), status: 'open', owner: 'AI Team', createdAt: NOW, updatedAt: NOW },
      { id: 'az-risk-keyvault', title: 'Key Vault Access via Compromised AD Account', description: 'Privileged Azure AD compromise could allow extraction of OpenAI API keys from Key Vault.', tierId: 'az-t3-key-vault', linkedAssetIds: ['az-asset-keyvault', 'az-asset-ad'], likelihood: 'likelihood-2', impact: 'impact-4', currentScore: score('likelihood-2', 'impact-4'), status: 'open', owner: 'Security Team', createdAt: NOW, updatedAt: NOW },
    ],
    assessments: [
      { id: 'az-assess-1', title: 'Azure OpenAI Zero Trust Assessment', scope: 'Full Azure OpenAI deployment', status: 'in_progress', createdBy: 'Security Team', createdAt: NOW, updatedAt: NOW, threatModel: { nodeFindings: [{ nodeId: 'vpn-gateway', findingIds: ['az-risk-vpn'] }, { nodeId: 'openai-endpoint', findingIds: ['az-risk-prompt'] }, { nodeId: 'key-vault', findingIds: ['az-risk-keyvault'] }], edgeFindings: [{ edgeId: 'e2', findingIds: ['az-risk-vpn'] }, { edgeId: 'e18', findingIds: ['az-risk-prompt'] }, { edgeId: 'e15', findingIds: ['az-risk-keyvault'] }] } },
    ],
    soaEntries: [
      { id: 'az-soa-1', controlSetId: CIS_CONTROL_SET_ID, controlId: 'cis-ctrl-06', status: 'implemented', justification: 'PIM with JIT access and MFA for all privileged operations.', linkedRiskIds: ['az-risk-keyvault', 'az-risk-vpn'], implementationNotes: 'Review access reviews quarterly.', owner: 'Security Team', createdAt: NOW, updatedAt: NOW },
      { id: 'az-soa-2', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'ctrl-a03', status: 'partially_implemented', justification: 'Input sanitization on app service but no dedicated prompt injection defense.', linkedRiskIds: ['az-risk-prompt'], implementationNotes: 'Implement Azure AI Content Safety for prompt filtering.', owner: 'AI Team', createdAt: NOW, updatedAt: NOW },
      { id: 'az-soa-3', controlSetId: OWASP_CONTROL_SET_ID, controlId: 'ctrl-a02', status: 'implemented', justification: 'Private Link, ExpressRoute, TLS 1.3 everywhere.', linkedRiskIds: ['az-risk-vpn'], implementationNotes: 'Ensure no public endpoint exposure.', owner: 'Network Team', createdAt: NOW, updatedAt: NOW },
      { id: 'az-soa-4', controlSetId: CIS_CONTROL_SET_ID, controlId: 'cis-ctrl-08', status: 'implemented', justification: 'Azure Sentinel with UEBA and automated playbooks.', linkedRiskIds: ['az-risk-vpn', 'az-risk-keyvault'], implementationNotes: 'Maintain detection rules for lateral movement patterns.', owner: 'Security Team', createdAt: NOW, updatedAt: NOW },
    ],
    thirdParties: [
      {
        id: 'az-tp-azure',
        name: 'Microsoft Azure',
        description: 'Primary cloud infrastructure provider hosting the entire OpenAI enterprise deployment including Hub VNet, ExpressRoute, Key Vault, Azure AD, and Cosmos DB. Operates under shared responsibility model with PaaS and networking services.',
        category: 'cloud_provider',
        status: 'active',
        riskRating: 'critical',
        dataClassification: 'restricted',
        linkedAssetIds: ['az-asset-hub', 'az-asset-keyvault', 'az-asset-ad', 'az-asset-cosmos'],
        linkedRiskIds: ['az-risk-vpn', 'az-risk-keyvault'],
        contactName: 'Azure Enterprise Support',
        contactEmail: 'azure-openai-tam@microsoft.example.com',
        contractExpiry: '2027-06-30',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-12-31',
        notes: 'Enterprise Agreement with Unified Support. SOC 2 Type II, ISO 27001, FedRAMP High certified. Azure Private Link and ExpressRoute provide network isolation for OpenAI endpoint. Key Vault access policies and Azure AD PIM configurations reviewed quarterly. VPN gateway credential management identified as a gap requiring remediation.'
      },
      {
        id: 'az-tp-openai',
        name: 'OpenAI',
        description: 'AI model provider powering the Azure OpenAI Service private endpoint. Provides GPT-4, embedding, and completion models consumed via Azure-hosted API. Model inference processes confidential business data from Cosmos DB.',
        category: 'saas',
        status: 'active',
        riskRating: 'high',
        dataClassification: 'restricted',
        linkedAssetIds: ['az-asset-openai', 'az-asset-cosmos'],
        linkedRiskIds: ['az-risk-prompt'],
        contactName: 'OpenAI Enterprise Relations',
        contactEmail: 'enterprise@openai.example.com',
        contractExpiry: '2027-03-31',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-09-30',
        notes: 'Consumed via Azure OpenAI Service — data processed within Azure tenant boundary and not sent to OpenAI directly. Content filtering enabled but custom prompt injection defenses not yet deployed. Model versioning pinned to prevent unexpected behavior changes. Data retention policy confirms no training on customer data. Responsible AI review completed.'
      },
      {
        id: 'az-tp-paloalto',
        name: 'Palo Alto Networks',
        description: 'Managed security service providing next-generation firewall and Prisma SASE for securing VPN gateway, ExpressRoute connectivity, and east-west traffic inspection within the Hub VNet.',
        category: 'managed_service',
        status: 'active',
        riskRating: 'medium',
        dataClassification: 'confidential',
        linkedAssetIds: ['az-asset-hub', 'az-asset-openai'],
        linkedRiskIds: ['az-risk-vpn'],
        contactName: 'Carlos Rivera',
        contactEmail: 'carlos.rivera@paloaltonetworks.example.com',
        contractExpiry: '2026-12-31',
        lastAssessmentDate: NOW,
        nextReviewDate: '2026-10-31',
        notes: 'Prisma Access SASE deployed for remote user VPN with certificate-based authentication. VM-Series firewall inspects traffic between Hub VNet and OpenAI subnet. Threat prevention signatures updated daily. Cortex XDR integration with Azure Sentinel for unified alert correlation. Annual configuration audit included in managed service agreement.'
      },
    ],
  } as any),
};