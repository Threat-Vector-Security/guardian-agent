/**
 * AWS Discovery Client
 * Discovers AWS resources using AWS SDK and Config Service
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

export class AWSDiscoveryClient {
  private credentials: CloudCredentials;
  private abortController: AbortController;

  constructor(credentials: CloudCredentials) {
    this.credentials = credentials;
    this.abortController = new AbortController();
  }

  /**
   * Discover AWS resources
   */
  async discover(filters?: CloudResourceFilters): Promise<CloudDiscoveryResult> {
    const startTime = Date.now();
    const resources: CloudResource[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Determine regions to scan
      const regions = filters?.regions || [this.credentials.region || 'us-east-1'];

      // Resource types to discover
      const resourceTypes = filters?.resourceTypes || [
        'AWS::EC2::Instance',
        'AWS::RDS::DBInstance',
        'AWS::Lambda::Function',
        'AWS::S3::Bucket',
        'AWS::ElasticLoadBalancingV2::LoadBalancer',
        'AWS::ECS::Service',
        'AWS::EKS::Cluster',
        'AWS::DynamoDB::Table'
      ];

      // Discover resources in each region
      for (const region of regions) {
        try {
          const regionResources = await this.discoverRegion(region, resourceTypes, filters);
          resources.push(...regionResources);
        } catch (error) {
          const errorMsg = `Failed to discover resources in ${region}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`✅ AWS Discovery completed in ${duration}ms: ${resources.length} resources found`);

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
        errors: [`AWS discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        totalCount: 0,
        timestamp: new Date()
      };
    }
  }

  /**
   * Discover resources in a specific region
   */
  private async discoverRegion(
    region: string,
    resourceTypes: string[],
    filters?: CloudResourceFilters
  ): Promise<CloudResource[]> {
    const resources: CloudResource[] = [];

    // Build AWS Config query
    const query = this.buildConfigQuery(resourceTypes, filters);

    try {
      // Make API call to backend (backend will use AWS SDK)
      const response = await this.callBackendAPI('/api/cloud/discover-aws', {
        region,
        query,
        credentials: {
          accessKeyId: this.credentials.accessKeyId,
          secretAccessKey: this.credentials.secretAccessKey,
          sessionToken: this.credentials.sessionToken
        }
      });

      if (response.success && response.resources) {
        for (const awsResource of response.resources) {
          const cloudResource = this.convertToCloudResource(awsResource, region);
          if (cloudResource) {
            resources.push(cloudResource);
          }
        }
      }

    } catch (error) {
      console.error(`Error discovering resources in ${region}:`, error);
      throw error;
    }

    return resources;
  }

  /**
   * Build AWS Config query
   */
  private buildConfigQuery(resourceTypes: string[], filters?: CloudResourceFilters): string {
    const typeFilter = resourceTypes.map(t => `'${t}'`).join(', ');

    let query = `
      SELECT
        resourceType,
        resourceId,
        resourceName,
        configuration,
        tags,
        availabilityZone
      WHERE resourceType IN [${typeFilter}]
    `;

    // Add tag filters
    if (filters?.tags && Object.keys(filters.tags).length > 0) {
      const tagConditions = Object.entries(filters.tags)
        .map(([key, value]) => `tags.tag.${key} = '${value}'`)
        .join(' AND ');
      query += ` AND ${tagConditions}`;
    }

    return query;
  }

  /**
   * Convert AWS resource to CloudResource
   */
  private convertToCloudResource(awsResource: any, region: string): CloudResource | null {
    try {
      const config = typeof awsResource.configuration === 'string'
        ? JSON.parse(awsResource.configuration)
        : awsResource.configuration;

      // Extract meaningful name
      const name = awsResource.resourceName ||
                  config.tags?.find((t: any) => t.key === 'Name')?.value ||
                  awsResource.resourceId;

      // Parse tags
      const tags: Record<string, string> = {};
      if (config.tags && Array.isArray(config.tags)) {
        config.tags.forEach((tag: any) => {
          tags[tag.key] = tag.value;
        });
      }

      // Determine if resource is public
      const isPublic = this.isResourcePublic(awsResource.resourceType, config);

      // Extract network information
      const metadata: any = {
        configuration: config,
        relationships: [],
        isPublic
      };

      // EC2-specific metadata
      if (awsResource.resourceType === 'AWS::EC2::Instance') {
        metadata.securityGroups = config.securityGroups?.map((sg: any) => sg.groupId) || [];
        metadata.subnet = config.subnetId;
        metadata.vpc = config.vpcId;
        metadata.publicIp = config.publicIpAddress;
        metadata.privateIp = config.privateIpAddress;
      }

      // RDS-specific metadata
      if (awsResource.resourceType === 'AWS::RDS::DBInstance') {
        metadata.engine = config.engine;
        metadata.engineVersion = config.engineVersion;
        metadata.vpc = config.dbSubnetGroup?.vpcId;
        metadata.publiclyAccessible = config.publiclyAccessible;
        metadata.isPublic = config.publiclyAccessible;
      }

      // S3-specific metadata
      if (awsResource.resourceType === 'AWS::S3::Bucket') {
        metadata.bucketPolicy = config.bucketPolicy;
        metadata.encryption = config.encryption;
      }

      return {
        id: awsResource.resourceId,
        name,
        type: awsResource.resourceType,
        provider: 'aws',
        region,
        zone: awsResource.availabilityZone,
        tags,
        metadata
      };

    } catch (error) {
      console.error('Error converting AWS resource:', error);
      return null;
    }
  }

  /**
   * Determine if AWS resource is publicly accessible
   */
  private isResourcePublic(resourceType: string, config: any): boolean {
    switch (resourceType) {
      case 'AWS::EC2::Instance':
        return !!config.publicIpAddress;
      case 'AWS::RDS::DBInstance':
        return config.publiclyAccessible === true;
      case 'AWS::S3::Bucket':
        return this.isBucketPublic(config);
      case 'AWS::ElasticLoadBalancingV2::LoadBalancer':
        return config.scheme === 'internet-facing';
      default:
        return false;
    }
  }

  /**
   * Check if S3 bucket is public
   */
  private isBucketPublic(bucketConfig: any): boolean {
    // Check bucket policy
    if (bucketConfig.bucketPolicy) {
      const policy = typeof bucketConfig.bucketPolicy === 'string'
        ? JSON.parse(bucketConfig.bucketPolicy)
        : bucketConfig.bucketPolicy;

      if (policy.Statement?.some((s: any) =>
        s.Principal === '*' || s.Principal?.AWS === '*'
      )) {
        return true;
      }
    }

    // Check ACL
    if (bucketConfig.grants?.some((g: any) =>
      g.grantee?.uri?.includes('AllUsers')
    )) {
      return true;
    }

    return false;
  }

  /**
   * Call backend API for AWS operations
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
