/**
 * Azure Discovery Client
 * Discovers Azure resources using Azure Resource Graph
 */

import {
  CloudResource,
  CloudCredentials,
  CloudResourceFilters,
  CloudDiscoveryResult
} from '../../../types/CloudTypes';
import { getFrontendAppSecret } from '../../../utils/appSecret';
import { connectionManager } from '../../ConnectionManager';
import { isVercelDeployment } from '../../../utils/vercelDetection';

export class AzureDiscoveryClient {
  private credentials: CloudCredentials;
  private abortController: AbortController;

  constructor(credentials: CloudCredentials) {
    this.credentials = credentials;
    this.abortController = new AbortController();
  }

  /**
   * Discover Azure resources
   */
  async discover(filters?: CloudResourceFilters): Promise<CloudDiscoveryResult> {
    const startTime = Date.now();
    const resources: CloudResource[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Resource types to discover
      const resourceTypes = filters?.resourceTypes || [
        'Microsoft.Compute/virtualMachines',
        'Microsoft.Web/sites',
        'Microsoft.Sql/servers/databases',
        'Microsoft.Storage/storageAccounts',
        'Microsoft.Network/virtualNetworks',
        'Microsoft.ContainerService/managedClusters',
        'Microsoft.DocumentDB/databaseAccounts'
      ];

      // Build and execute Azure Resource Graph query
      const query = this.buildResourceGraphQuery(resourceTypes, filters);
      const azureResources = await this.executeQuery(query);

      // Convert to CloudResource format
      for (const azureResource of azureResources) {
        const cloudResource = this.convertToCloudResource(azureResource);
        if (cloudResource) {
          resources.push(cloudResource);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Azure Discovery completed in ${duration}ms: ${resources.length} resources found`);

      return {
        success: true,
        resources,
        warnings,
        errors,
        totalCount: resources.length,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        resources: [],
        errors: [`Azure discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        totalCount: 0,
        timestamp: new Date()
      };
    }
  }

  /**
   * Build Azure Resource Graph query
   */
  private buildResourceGraphQuery(resourceTypes: string[], filters?: CloudResourceFilters): string {
    const typeFilter = resourceTypes.map(t => `'${t}'`).join(', ');

    let query = `
      Resources
      | where type in~ [${typeFilter}]
      | project
        id,
        name,
        type,
        location,
        resourceGroup,
        subscriptionId,
        properties,
        tags
    `;

    // Add tag filters
    if (filters?.tags && Object.keys(filters.tags).length > 0) {
      const tagConditions = Object.entries(filters.tags)
        .map(([key, value]) => `tags.${key} == '${value}'`)
        .join(' and ');
      query += ` | where ${tagConditions}`;
    }

    // Add region filter
    if (filters?.regions && filters.regions.length > 0) {
      const regionFilter = filters.regions.map(r => `'${r}'`).join(', ');
      query += ` | where location in~ [${regionFilter}]`;
    }

    return query;
  }

  /**
   * Execute Azure Resource Graph query via backend
   */
  private async executeQuery(query: string): Promise<any[]> {
    try {
      const response = await this.callBackendAPI('/api/cloud/discover-azure', {
        query,
        credentials: {
          clientId: this.credentials.clientId,
          clientSecret: this.credentials.clientSecret,
          tenantId: this.credentials.tenantId,
          subscriptionId: this.credentials.subscriptionId
        }
      });

      if (response.success && response.resources) {
        return response.resources;
      }

      return [];

    } catch (error) {
      console.error('Error executing Azure Resource Graph query:', error);
      throw error;
    }
  }

  /**
   * Convert Azure resource to CloudResource
   */
  private convertToCloudResource(azureResource: any): CloudResource | null {
    try {
      const properties = azureResource.properties || {};

      // Determine if resource is public
      const isPublic = this.isResourcePublic(azureResource.type, properties);

      // Extract network information
      const metadata: any = {
        configuration: properties,
        relationships: [],
        isPublic,
        resourceGroup: azureResource.resourceGroup,
        subscriptionId: azureResource.subscriptionId
      };

      // VM-specific metadata
      if (azureResource.type === 'Microsoft.Compute/virtualMachines') {
        metadata.vmSize = properties.hardwareProfile?.vmSize;
        metadata.osType = properties.storageProfile?.osDisk?.osType;
        const networkProfile = properties.networkProfile;
        if (networkProfile?.networkInterfaces?.[0]) {
          metadata.networkInterface = networkProfile.networkInterfaces[0].id;
        }
      }

      // SQL Database-specific metadata
      if (azureResource.type === 'Microsoft.Sql/servers/databases') {
        metadata.edition = properties.edition;
        metadata.serviceObjective = properties.currentServiceObjectiveName;
      }

      // Storage Account-specific metadata
      if (azureResource.type === 'Microsoft.Storage/storageAccounts') {
        metadata.accountType = properties.accountType;
        metadata.encryption = properties.encryption;
        metadata.networkAcls = properties.networkAcls;
        metadata.allowBlobPublicAccess = properties.allowBlobPublicAccess;
        metadata.isPublic = properties.allowBlobPublicAccess === true;
      }

      // AKS-specific metadata
      if (azureResource.type === 'Microsoft.ContainerService/managedClusters') {
        metadata.kubernetesVersion = properties.kubernetesVersion;
        metadata.nodeCount = properties.agentPoolProfiles?.reduce(
          (sum: number, pool: any) => sum + (pool.count || 0), 0
        );
      }

      return {
        id: azureResource.id,
        name: azureResource.name,
        type: azureResource.type,
        provider: 'azure',
        region: azureResource.location,
        tags: azureResource.tags || {},
        metadata
      };

    } catch (error) {
      console.error('Error converting Azure resource:', error);
      return null;
    }
  }

  /**
   * Determine if Azure resource is publicly accessible
   */
  private isResourcePublic(resourceType: string, properties: any): boolean {
    switch (resourceType) {
      case 'Microsoft.Compute/virtualMachines':
        // Check for public IP (requires additional query in practice)
        return false; // Conservative default
      case 'Microsoft.Storage/storageAccounts':
        return properties.allowBlobPublicAccess === true;
      case 'Microsoft.Network/loadBalancers':
        return properties.frontendIPConfigurations?.some(
          (config: any) => config.properties?.publicIPAddress
        );
      case 'Microsoft.Web/sites':
        // App Services are typically public unless in ASE
        return !properties.hostingEnvironmentProfile;
      default:
        return false;
    }
  }

  /**
   * Call backend API for Azure operations
   */
  private async callBackendAPI(endpoint: string, data: any): Promise<any> {
    const serverUrl = await this.getServerUrl();
    const appSecret = getFrontendAppSecret();

    const response = await fetch(`${serverUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Secret': appSecret
      },
      body: JSON.stringify(data),
      signal: this.abortController.signal
    });

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get server URL from connection manager
   */
  private async getServerUrl(): Promise<string> {
    const serverUrl = connectionManager.getServerUrl();
    if (typeof serverUrl === 'string') {
      return serverUrl;
    }

    if (isVercelDeployment()) {
      return '';
    }

    return process.env.REACT_APP_API_URL || 'http://localhost:3002';
  }

  /**
   * Cancel discovery operation
   */
  cancel(): void {
    this.abortController.abort();
  }
}
