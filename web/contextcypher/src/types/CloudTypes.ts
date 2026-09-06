/**
 * Cloud Service Discovery Types
 * Defines interfaces for cloud resource discovery across AWS, Azure, and GCP
 */

import { SecurityZone, DataClassification } from './SecurityTypes';

export type CloudProvider = 'aws' | 'azure' | 'gcp';

export interface CloudCredentials {
  provider: CloudProvider;
  // AWS
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  region?: string;
  // Azure
  clientId?: string;
  clientSecret?: string;
  tenantId?: string;
  subscriptionId?: string;
  // GCP
  projectId?: string;
  serviceAccountKey?: string; // JSON string
}

export interface CloudResource {
  id: string;
  name: string;
  type: string; // Cloud-specific type (AWS::EC2::Instance, Microsoft.Compute/virtualMachines, etc.)
  provider: CloudProvider;
  region: string;
  zone?: string; // Availability zone
  tags?: Record<string, string>;
  metadata: {
    configuration?: any;
    relationships?: string[]; // IDs of related resources
    securityGroups?: string[];
    subnet?: string;
    vpc?: string;
    publicIp?: string;
    privateIp?: string;
    isPublic?: boolean;
  };
}

export interface CloudResourceFilters {
  regions?: string[];
  resourceTypes?: string[];
  tags?: Record<string, string>;
  includePublic?: boolean;
  includePrivate?: boolean;
}

export interface CloudDiscoveryOptions {
  credentials: CloudCredentials;
  filters?: CloudResourceFilters;
  timeout?: number; // milliseconds
}

export interface CloudDiscoveryProgress {
  status: 'initializing' | 'discovering' | 'mapping' | 'completed' | 'error';
  message: string;
  totalResources?: number;
  discoveredResources?: number;
  currentRegion?: string;
  percentage?: number;
}

export interface CloudDiscoveryResult {
  success: boolean;
  resources: CloudResource[];
  warnings?: string[];
  errors?: string[];
  totalCount: number;
  timestamp: Date;
}

export interface MappedCloudNode {
  cloudResource: CloudResource;
  nodeType: string; // ContextCypher node type (awsEC2, azureVM, etc.)
  label: string;
  zone: SecurityZone;
  dataClassification: DataClassification;
  metadata: Record<string, any>;
}

export interface CloudRelationship {
  source: string; // Resource ID
  target: string; // Resource ID
  type: string; // Relationship type
  protocol?: string;
  port?: string;
}

// Cloud provider specific resource types
export const AWS_RESOURCE_TYPES = [
  'AWS::EC2::Instance',
  'AWS::RDS::DBInstance',
  'AWS::Lambda::Function',
  'AWS::S3::Bucket',
  'AWS::ElasticLoadBalancingV2::LoadBalancer',
  'AWS::ECS::Service',
  'AWS::EKS::Cluster',
  'AWS::DynamoDB::Table',
  'AWS::ElastiCache::CacheCluster',
  'AWS::EC2::VPC',
  'AWS::CloudFront::Distribution',
  'AWS::ApiGateway::RestApi'
] as const;

export const AZURE_RESOURCE_TYPES = [
  'Microsoft.Compute/virtualMachines',
  'Microsoft.Web/sites',
  'Microsoft.Sql/servers/databases',
  'Microsoft.Storage/storageAccounts',
  'Microsoft.Network/virtualNetworks',
  'Microsoft.Network/loadBalancers',
  'Microsoft.ContainerService/managedClusters',
  'Microsoft.DocumentDB/databaseAccounts',
  'Microsoft.Cache/Redis',
  'Microsoft.Network/applicationGateways',
  'Microsoft.Cdn/profiles',
  'Microsoft.ApiManagement/service'
] as const;

export const GCP_RESOURCE_TYPES = [
  'compute.googleapis.com/Instance',
  'sqladmin.googleapis.com/Instance',
  'run.googleapis.com/Service',
  'storage.googleapis.com/Bucket',
  'container.googleapis.com/Cluster',
  'cloudfunctions.googleapis.com/CloudFunction',
  'compute.googleapis.com/ForwardingRule',
  'compute.googleapis.com/Network',
  'bigtable.googleapis.com/Instance',
  'redis.googleapis.com/Instance',
  'compute.googleapis.com/BackendService',
  'apigateway.googleapis.com/Gateway'
] as const;
