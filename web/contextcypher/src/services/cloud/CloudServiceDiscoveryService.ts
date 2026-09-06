/**
 * Cloud Service Discovery Service
 * Main orchestration service for cloud resource discovery
 * Coordinates discovery across AWS, Azure, and GCP with vendor node prioritization
 */

import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityNode, SecurityEdge, SecurityZone } from '../../types/SecurityTypes';
import {
  CloudProvider,
  CloudCredentials,
  CloudResourceFilters,
  CloudDiscoveryResult,
  CloudDiscoveryProgress,
  MappedCloudNode,
  CloudRelationship
} from '../../types/CloudTypes';
import { AWSDiscoveryClient } from './providers/AWSDiscoveryClient';
import { AzureDiscoveryClient } from './providers/AzureDiscoveryClient';
import { GCPDiscoveryClient } from './providers/GCPDiscoveryClient';
import { cloudResourceMapper } from './CloudResourceMapper';

export interface CloudDiscoveryOptions {
  credentials: CloudCredentials;
  filters?: CloudResourceFilters;
  onProgress?: (progress: CloudDiscoveryProgress) => void;
}

export class CloudServiceDiscoveryService {
  private currentClient: AWSDiscoveryClient | AzureDiscoveryClient | GCPDiscoveryClient | null = null;

  /**
   * Discover cloud resources and convert to diagram
   */
  async discoverAndConvert(options: CloudDiscoveryOptions): Promise<ExampleSystem | null> {
    const { credentials, filters, onProgress } = options;

    try {
      // Initialize discovery
      onProgress?.({
        status: 'initializing',
        message: `Initializing ${credentials.provider.toUpperCase()} discovery...`,
        percentage: 0
      });

      // Create provider-specific client
      const client = this.createClient(credentials);
      this.currentClient = client;

      // Discover resources
      onProgress?.({
        status: 'discovering',
        message: 'Discovering cloud resources...',
        percentage: 25
      });

      const discoveryResult = await client.discover(filters);

      if (!discoveryResult.success || discoveryResult.resources.length === 0) {
        throw new Error(discoveryResult.errors?.join(', ') || 'No resources found');
      }

      console.log(`📊 Discovered ${discoveryResult.resources.length} resources`);

      // Map to vendor nodes (PRIORITY: vendor-specific nodes)
      onProgress?.({
        status: 'mapping',
        message: 'Mapping resources to vendor nodes...',
        percentage: 50
      });

      const mappedNodes = cloudResourceMapper.mapResources(discoveryResult.resources);
      console.log(`🎯 Mapped to vendor nodes:`, mappedNodes.map(n => n.nodeType));

      // Detect relationships
      const relationships = this.detectRelationships(discoveryResult.resources, mappedNodes);

      // Convert to diagram
      onProgress?.({
        status: 'mapping',
        message: 'Creating diagram structure...',
        percentage: 75
      });

      const diagram = this.convertToDiagram(
        mappedNodes,
        relationships,
        credentials.provider
      );

      onProgress?.({
        status: 'completed',
        message: `Successfully imported ${mappedNodes.length} cloud resources`,
        percentage: 100,
        totalResources: mappedNodes.length,
        discoveredResources: mappedNodes.length
      });

      this.currentClient = null;
      return diagram;

    } catch (error) {
      onProgress?.({
        status: 'error',
        message: `Discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        percentage: 0
      });

      this.currentClient = null;
      throw error;
    }
  }

  /**
   * Create provider-specific discovery client
   */
  private createClient(
    credentials: CloudCredentials
  ): AWSDiscoveryClient | AzureDiscoveryClient | GCPDiscoveryClient {
    switch (credentials.provider) {
      case 'aws':
        return new AWSDiscoveryClient(credentials);
      case 'azure':
        return new AzureDiscoveryClient(credentials);
      case 'gcp':
        return new GCPDiscoveryClient(credentials);
      default:
        throw new Error(`Unsupported cloud provider: ${credentials.provider}`);
    }
  }

  /**
   * Detect relationships between cloud resources
   */
  private detectRelationships(
    resources: any[],
    mappedNodes: MappedCloudNode[]
  ): CloudRelationship[] {
    const relationships: CloudRelationship[] = [];

    for (const node of mappedNodes) {
      const resource = node.cloudResource;
      const metadata = resource.metadata;

      // Security group to instance relationships
      if (metadata.securityGroups && Array.isArray(metadata.securityGroups)) {
        for (const sgId of metadata.securityGroups) {
          const sgResource = resources.find(r => r.id === sgId);
          if (sgResource) {
            relationships.push({
              source: sgId,
              target: resource.id,
              type: 'protects'
            });
          }
        }
      }

      // VPC/VNet relationships
      if (metadata.vpc) {
        const vpcId = metadata.vpc;
        const vpcResource = resources.find(r => r.id === vpcId);
        if (vpcResource) {
          relationships.push({
            source: resource.id,
            target: vpcId,
            type: 'memberOf'
          });
        }
      }

      // Load balancer to target relationships
      if (metadata.relationships && Array.isArray(metadata.relationships)) {
        for (const targetId of metadata.relationships) {
          relationships.push({
            source: resource.id,
            target: targetId,
            type: 'routes',
            protocol: 'HTTP/HTTPS'
          });
        }
      }
    }

    return relationships;
  }

  /**
   * Convert mapped nodes to diagram format
   * Uses vendor-specific node types with proper icons
   */
  private convertToDiagram(
    mappedNodes: MappedCloudNode[],
    relationships: CloudRelationship[],
    provider: CloudProvider
  ): ExampleSystem {
    const nodes: SecurityNode[] = [];
    const edges: SecurityEdge[] = [];
    const zoneNodes: SecurityNode[] = [];

    // Group nodes by security zone
    const nodesByZone = new Map<SecurityZone, MappedCloudNode[]>();
    for (const mappedNode of mappedNodes) {
      if (!nodesByZone.has(mappedNode.zone)) {
        nodesByZone.set(mappedNode.zone, []);
      }
      nodesByZone.get(mappedNode.zone)!.push(mappedNode);
    }

    // Layout constants
    const ZONE_WIDTH = 650;
    const ZONE_HEIGHT = 1000;
    const ZONE_SPACING = 170;
    const ZONE_START_X = 50;
    const ZONE_START_Y = 50;
    const NODE_SPACING_H = 250;
    const NODE_SPACING_V = 200;
    const ZONE_PADDING = 100;
    const GRID_SIZE = 50;

    let zoneIndex = 0;

    // Create zones and position nodes
    for (const [zone, zoneNodeList] of Array.from(nodesByZone.entries())) {
      if (zoneNodeList.length === 0) continue;

      const zoneX = ZONE_START_X + (zoneIndex * (ZONE_WIDTH + ZONE_SPACING));
      const zoneY = ZONE_START_Y;

      // Create zone node
      zoneNodes.push({
        id: `zone-${zone.toLowerCase()}-${provider}`,
        type: 'securityZone',
        position: { x: zoneX, y: zoneY },
        data: {
          label: `${zone} (${provider.toUpperCase()})`,
          zoneType: zone,
          description: `${zone} security zone - ${provider.toUpperCase()} resources`
        },
        style: {
          width: ZONE_WIDTH,
          height: ZONE_HEIGHT,
          zIndex: -1
        }
      } as SecurityNode);

      // Position nodes within zone
      const nodesPerRow = 3;
      zoneNodeList.forEach((mappedNode: MappedCloudNode, index: number) => {
        const row = Math.floor(index / nodesPerRow);
        const col = index % nodesPerRow;

        const x = zoneX + ZONE_PADDING + (col * NODE_SPACING_H);
        const y = zoneY + ZONE_PADDING + (row * NODE_SPACING_V);

        const gridX = Math.round(x / GRID_SIZE) * GRID_SIZE;
        const gridY = Math.round(y / GRID_SIZE) * GRID_SIZE;

        // Create node with vendor-specific type
        nodes.push({
          id: mappedNode.cloudResource.id,
          type: mappedNode.nodeType as any, // Vendor node type (awsEC2, azureVM, etc.)
          position: { x: gridX, y: gridY },
          data: {
            label: mappedNode.label,
            zone: mappedNode.zone,
            dataClassification: mappedNode.dataClassification,
            description: `${mappedNode.cloudResource.type} resource`,
            ...mappedNode.metadata,
            // Preserve cloud-specific metadata
            cloudProvider: provider,
            cloudResourceId: mappedNode.cloudResource.id,
            cloudResourceType: mappedNode.cloudResource.type,
            region: mappedNode.cloudResource.region
          }
        } as SecurityNode);
      });

      zoneIndex++;
    }

    // Create edges from relationships
    for (const rel of relationships) {
      const sourceNode = nodes.find(n => n.id === rel.source);
      const targetNode = nodes.find(n => n.id === rel.target);

      if (sourceNode && targetNode) {
        edges.push({
          id: `${rel.source}-${rel.target}`,
          source: rel.source,
          target: rel.target,
          type: 'securityEdge',
          data: {
            label: rel.type,
            zone: targetNode.data.zone as SecurityZone,
            dataClassification: targetNode.data.dataClassification,
            protocol: rel.protocol || '',
            portRange: rel.port || '',
            description: `${rel.type} connection`
          }
        } as SecurityEdge);
      }
    }

    // Build custom context
    const customContext = `# ${provider.toUpperCase()} Cloud Infrastructure

## Import Information
- **Cloud Provider**: ${provider.toUpperCase()}
- **Resources Discovered**: ${mappedNodes.length}
- **Security Zones**: ${nodesByZone.size}
- **Import Date**: ${new Date().toISOString()}

## Resources by Type
${this.summarizeResourceTypes(mappedNodes)}

## Security Zones
${Array.from(nodesByZone.keys()).map(zone =>
  `- **${zone}**: ${nodesByZone.get(zone)!.length} resources`
).join('\n')}

## Notes
- All resources mapped to vendor-specific node types (${provider}*)
- Security zones automatically inferred from resource properties
- Relationships detected from cloud metadata
- Manual review recommended for accurate threat modeling
`;

    return {
      id: `cloud-${provider}-${Date.now()}`,
      name: `${provider.toUpperCase()} Cloud Infrastructure`,
      description: `Imported from ${provider.toUpperCase()} cloud environment`,
      category: 'Cloud Architecture' as any,
      primaryZone: 'Internal',
      dataClassification: 'Internal',
      customContext,
      nodes: [...zoneNodes, ...nodes],
      edges
    };
  }

  /**
   * Summarize resource types for custom context
   */
  private summarizeResourceTypes(mappedNodes: MappedCloudNode[]): string {
    const typeCounts = new Map<string, number>();

    for (const node of mappedNodes) {
      const count = typeCounts.get(node.nodeType) || 0;
      typeCounts.set(node.nodeType, count + 1);
    }

    return Array.from(typeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => `- **${type}**: ${count}`)
      .join('\n');
  }

  /**
   * Cancel ongoing discovery
   */
  cancel(): void {
    if (this.currentClient) {
      this.currentClient.cancel();
      this.currentClient = null;
    }
  }

  /**
   * Get coverage statistics
   */
  getCoverageStats() {
    return cloudResourceMapper.getCoverageStats();
  }
}

export const cloudServiceDiscoveryService = new CloudServiceDiscoveryService();
