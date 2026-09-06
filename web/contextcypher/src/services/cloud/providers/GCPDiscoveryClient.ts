/**
 * GCP Discovery Client
 * Discovers GCP resources using Cloud Asset Inventory API
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

export class GCPDiscoveryClient {
  private credentials: CloudCredentials;
  private abortController: AbortController;

  constructor(credentials: CloudCredentials) {
    this.credentials = credentials;
    this.abortController = new AbortController();
  }

  /**
   * Discover GCP resources
   */
  async discover(filters?: CloudResourceFilters): Promise<CloudDiscoveryResult> {
    const startTime = Date.now();
    const resources: CloudResource[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Resource types to discover
      const assetTypes = filters?.resourceTypes || [
        'compute.googleapis.com/Instance',
        'sqladmin.googleapis.com/Instance',
        'run.googleapis.com/Service',
        'storage.googleapis.com/Bucket',
        'container.googleapis.com/Cluster',
        'cloudfunctions.googleapis.com/CloudFunction'
      ];

      // Discover resources
      const gcpAssets = await this.listAssets(assetTypes, filters);

      // Convert to CloudResource format
      for (const asset of gcpAssets) {
        const cloudResource = this.convertToCloudResource(asset);
        if (cloudResource) {
          resources.push(cloudResource);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`✅ GCP Discovery completed in ${duration}ms: ${resources.length} resources found`);

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
        errors: [`GCP discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        totalCount: 0,
        timestamp: new Date()
      };
    }
  }

  /**
   * List GCP assets via backend
   */
  private async listAssets(
    assetTypes: string[],
    filters?: CloudResourceFilters
  ): Promise<any[]> {
    try {
      const response = await this.callBackendAPI('/api/cloud/discover-gcp', {
        projectId: this.credentials.projectId,
        assetTypes,
        credentials: {
          serviceAccountKey: this.credentials.serviceAccountKey
        },
        filters
      });

      if (response.success && response.assets) {
        return response.assets;
      }

      return [];

    } catch (error) {
      console.error('Error listing GCP assets:', error);
      throw error;
    }
  }

  /**
   * Convert GCP asset to CloudResource
   */
  private convertToCloudResource(asset: any): CloudResource | null {
    try {
      const resource = asset.resource || {};
      const data = resource.data || {};

      // Extract location/region
      const location = this.extractLocation(asset);

      // Extract meaningful name
      const name = data.name ||
                  data.displayName ||
                  asset.name?.split('/').pop() ||
                  'Unknown';

      // Parse labels as tags
      const tags: Record<string, string> = data.labels || {};

      // Determine if resource is public
      const isPublic = this.isResourcePublic(asset.assetType, data);

      // Extract network information
      const metadata: any = {
        configuration: data,
        relationships: [],
        isPublic,
        parent: asset.resource?.parent,
        discoveryName: asset.resource?.discoveryName
      };

      // Compute Instance-specific metadata
      if (asset.assetType === 'compute.googleapis.com/Instance') {
        metadata.machineType = data.machineType?.split('/').pop();
        metadata.zone = data.zone?.split('/').pop();
        metadata.networkInterfaces = data.networkInterfaces;
        metadata.publicIp = data.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP;
        metadata.privateIp = data.networkInterfaces?.[0]?.networkIP;
        metadata.isPublic = !!metadata.publicIp;
      }

      // Cloud SQL-specific metadata
      if (asset.assetType === 'sqladmin.googleapis.com/Instance') {
        metadata.databaseVersion = data.databaseVersion;
        metadata.tier = data.settings?.tier;
        metadata.ipAddresses = data.ipAddresses;
        const publicIpConfig = data.ipAddresses?.find((ip: any) => ip.type === 'PRIMARY');
        metadata.isPublic = !!publicIpConfig;
      }

      // Cloud Storage-specific metadata
      if (asset.assetType === 'storage.googleapis.com/Bucket') {
        metadata.storageClass = data.storageClass;
        metadata.iamConfiguration = data.iamConfiguration;
        metadata.encryption = data.encryption;
        const iamPolicy = data.iamPolicy?.bindings || [];
        metadata.isPublic = iamPolicy.some((binding: any) =>
          binding.members?.includes('allUsers') || binding.members?.includes('allAuthenticatedUsers')
        );
      }

      // GKE-specific metadata
      if (asset.assetType === 'container.googleapis.com/Cluster') {
        metadata.currentMasterVersion = data.currentMasterVersion;
        metadata.currentNodeVersion = data.currentNodeVersion;
        metadata.nodePoolCount = data.nodePools?.length;
        metadata.totalNodeCount = data.nodePools?.reduce(
          (sum: number, pool: any) => sum + (pool.initialNodeCount || 0), 0
        );
      }

      // Cloud Run-specific metadata
      if (asset.assetType === 'run.googleapis.com/Service') {
        metadata.template = data.template;
        metadata.traffic = data.traffic;
        const ingress = data.template?.metadata?.annotations?.['run.googleapis.com/ingress'];
        metadata.isPublic = ingress === 'all' || !ingress;
      }

      return {
        id: asset.name,
        name,
        type: asset.assetType,
        provider: 'gcp',
        region: location,
        zone: metadata.zone,
        tags,
        metadata
      };

    } catch (error) {
      console.error('Error converting GCP asset:', error);
      return null;
    }
  }

  /**
   * Extract location/region from GCP asset
   */
  private extractLocation(asset: any): string {
    const data = asset.resource?.data || {};

    // Try zone first
    if (data.zone) {
      const zone = data.zone.split('/').pop();
      return zone?.replace(/-[a-z]$/, '') || 'global';
    }

    // Try region
    if (data.region) {
      return data.region.split('/').pop() || 'global';
    }

    // Try location
    if (data.location) {
      return data.location;
    }

    // Extract from name
    const nameParts = (asset.name || '').split('/');
    for (const part of nameParts) {
      if (part.includes('zones') || part.includes('regions')) {
        const index = nameParts.indexOf(part);
        if (index < nameParts.length - 1) {
          return nameParts[index + 1];
        }
      }
    }

    return 'global';
  }

  /**
   * Determine if GCP resource is publicly accessible
   */
  private isResourcePublic(assetType: string, data: any): boolean {
    switch (assetType) {
      case 'compute.googleapis.com/Instance':
        return data.networkInterfaces?.[0]?.accessConfigs?.length > 0;

      case 'storage.googleapis.com/Bucket':
        const iamPolicy = data.iamPolicy?.bindings || [];
        return iamPolicy.some((binding: any) =>
          binding.members?.includes('allUsers') ||
          binding.members?.includes('allAuthenticatedUsers')
        );

      case 'run.googleapis.com/Service':
        const ingress = data.template?.metadata?.annotations?.['run.googleapis.com/ingress'];
        return ingress === 'all' || !ingress;

      case 'compute.googleapis.com/ForwardingRule':
        return data.IPProtocol !== undefined; // External load balancers have IP protocol

      default:
        return false;
    }
  }

  /**
   * Call backend API for GCP operations
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
