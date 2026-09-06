/**
 * Mock Cloud Data Helper
 * Provides sample cloud resources for testing cloud discovery and mapping
 */

import { CloudResource, CloudProvider, MappedCloudNode } from '../../../types/CloudTypes';

/**
 * Mock AWS Resources
 */
export const mockAWSResources: CloudResource[] = [
  // Compute
  {
    id: 'i-0123456789abcdef0',
    name: 'web-server-prod-01',
    type: 'AWS::EC2::Instance',
    provider: 'aws',
    region: 'us-east-1',
    zone: 'us-east-1a',
    metadata: {
      publicIp: '54.123.45.67',
      privateIp: '10.0.1.10',
      configuration: {
        instanceType: 't3.medium',
        state: 'running',
        launchTime: '2024-01-15T10:30:00Z'
      }
    },
    tags: {
      Name: 'Production Web Server',
      Environment: 'production',
      Team: 'platform'
    }
  },
  {
    id: 'arn:aws:lambda:us-east-1:123456789012:function:data-processor',
    name: 'data-processor',
    type: 'AWS::Lambda::Function',
    provider: 'aws',
    region: 'us-east-1',
    metadata: {
      configuration: {
        runtime: 'nodejs18.x',
        memorySize: 512,
        timeout: 30,
        lastModified: '2024-01-20T15:45:00Z'
      }
    },
    tags: {
      Name: 'Data Processing Function',
      Environment: 'production'
    }
  },

  // Database
  {
    id: 'arn:aws:rds:us-east-1:123456789012:db:prod-db-01',
    name: 'prod-db-01',
    type: 'AWS::RDS::DBInstance',
    provider: 'aws',
    region: 'us-east-1',
    zone: 'us-east-1b',
    metadata: {
      configuration: {
        engine: 'postgres',
        engineVersion: '14.7',
        instanceClass: 'db.t3.large',
        allocatedStorage: 100,
        multiAZ: true,
        encrypted: true
      }
    },
    tags: {
      Name: 'Production PostgreSQL Database',
      Environment: 'production',
      DataClassification: 'Confidential'
    }
  },
  {
    id: 'arn:aws:dynamodb:us-east-1:123456789012:table/sessions',
    name: 'sessions',
    type: 'AWS::DynamoDB::Table',
    provider: 'aws',
    region: 'us-east-1',
    metadata: {
      configuration: {
        tableStatus: 'ACTIVE',
        itemCount: 15000,
        billingMode: 'PAY_PER_REQUEST',
        encrypted: true
      }
    },
    tags: {
      Name: 'User Sessions Table',
      Environment: 'production'
    }
  },

  // Storage
  {
    id: 'arn:aws:s3:::prod-assets-bucket',
    name: 'prod-assets-bucket',
    type: 'AWS::S3::Bucket',
    provider: 'aws',
    region: 'us-east-1',
    metadata: {
      isPublic: false,
      configuration: {
        versioning: true,
        encryption: 'AES256',
        lifecycleRules: 2
      }
    },
    tags: {
      Name: 'Production Assets Storage',
      Environment: 'production',
      DataClassification: 'Internal'
    }
  },

  // Networking
  {
    id: 'vpc-0abcd1234efgh5678',
    name: 'prod-vpc',
    type: 'AWS::EC2::VPC',
    provider: 'aws',
    region: 'us-east-1',
    metadata: {
      configuration: {
        cidrBlock: '10.0.0.0/16',
        enableDnsSupport: true,
        enableDnsHostnames: true
      }
    },
    tags: {
      Name: 'Production VPC',
      Environment: 'production'
    }
  },
  {
    id: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/prod-alb/abc123',
    name: 'prod-alb',
    type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
    provider: 'aws',
    region: 'us-east-1',
    metadata: {
      configuration: {
        scheme: 'internet-facing',
        type: 'application',
        ipAddressType: 'ipv4'
      }
    },
    tags: {
      Name: 'Production Application Load Balancer',
      Environment: 'production'
    }
  },
  {
    id: 'arn:aws:apigateway:us-east-1::/restapis/abc123xyz',
    name: 'prod-api',
    type: 'AWS::ApiGateway::RestApi',
    provider: 'aws',
    region: 'us-east-1',
    metadata: {
      configuration: {
        endpointConfiguration: 'REGIONAL',
        minimumCompressionSize: 1024
      }
    },
    tags: {
      Name: 'Production REST API',
      Environment: 'production'
    }
  },

  // Security
  {
    id: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:db-password-abc123',
    name: 'db-password',
    type: 'AWS::SecretsManager::Secret',
    provider: 'aws',
    region: 'us-east-1',
    metadata: {
      configuration: {
        encrypted: true,
        rotationEnabled: true,
        rotationLambdaARN: 'arn:aws:lambda:us-east-1:123456789012:function:rotate-secret'
      }
    },
    tags: {
      Name: 'Database Credentials',
      Environment: 'production',
      DataClassification: 'Confidential'
    }
  }
];

/**
 * Mock Azure Resources
 */
export const mockAzureResources: CloudResource[] = [
  // Compute
  {
    id: '/subscriptions/abc123/resourceGroups/prod-rg/providers/Microsoft.Compute/virtualMachines/web-vm-01',
    name: 'web-vm-01',
    type: 'Microsoft.Compute/virtualMachines',
    provider: 'azure',
    region: 'eastus',
    metadata: {
      publicIp: '40.123.45.67',
      configuration: {
        vmSize: 'Standard_D2s_v3',
        osType: 'Linux',
        osDisk: '/subscriptions/abc123/resourceGroups/prod-rg/providers/Microsoft.Compute/disks/web-vm-01-osdisk',
        provisioningState: 'Succeeded'
      }
    },
    tags: {
      Name: 'Production Web VM',
      Environment: 'production',
      Team: 'platform'
    }
  },
  {
    id: '/subscriptions/abc123/resourceGroups/prod-rg/providers/Microsoft.Web/sites/prod-webapp',
    name: 'prod-webapp',
    type: 'Microsoft.Web/sites',
    provider: 'azure',
    region: 'eastus',
    metadata: {
      configuration: {
        kind: 'app',
        state: 'Running',
        defaultHostName: 'prod-webapp.azurewebsites.net',
        httpsOnly: true,
        tier: 'Standard'
      }
    },
    tags: {
      Name: 'Production Web App',
      Environment: 'production'
    }
  },

  // Database
  {
    id: '/subscriptions/abc123/resourceGroups/prod-rg/providers/Microsoft.Sql/servers/prod-sql/databases/appdb',
    name: 'appdb',
    type: 'Microsoft.Sql/servers/databases',
    provider: 'azure',
    region: 'eastus',
    metadata: {
      configuration: {
        edition: 'Standard',
        serviceLevelObjective: 'S2',
        maxSizeBytes: 268435456000,
        collation: 'SQL_Latin1_General_CP1_CI_AS',
        encryption: 'Enabled'
      }
    },
    tags: {
      Name: 'Application Database',
      Environment: 'production',
      DataClassification: 'Confidential'
    }
  },
  {
    id: '/subscriptions/abc123/resourceGroups/prod-rg/providers/Microsoft.DocumentDB/databaseAccounts/prod-cosmos',
    name: 'prod-cosmos',
    type: 'Microsoft.DocumentDB/databaseAccounts',
    provider: 'azure',
    region: 'eastus',
    metadata: {
      configuration: {
        kind: 'GlobalDocumentDB',
        consistencyLevel: 'Session',
        multipleWriteLocations: true,
        enableAutomaticFailover: true
      }
    },
    tags: {
      Name: 'Cosmos DB Account',
      Environment: 'production'
    }
  },

  // Storage
  {
    id: '/subscriptions/abc123/resourceGroups/prod-rg/providers/Microsoft.Storage/storageAccounts/prodstorage',
    name: 'prodstorage',
    type: 'Microsoft.Storage/storageAccounts',
    provider: 'azure',
    region: 'eastus',
    metadata: {
      configuration: {
        kind: 'StorageV2',
        tier: 'Standard',
        replication: 'GRS',
        encryption: 'Microsoft.Storage',
        httpsOnly: true
      }
    },
    tags: {
      Name: 'Production Storage Account',
      Environment: 'production'
    }
  },

  // Networking
  {
    id: '/subscriptions/abc123/resourceGroups/prod-rg/providers/Microsoft.Network/virtualNetworks/prod-vnet',
    name: 'prod-vnet',
    type: 'Microsoft.Network/virtualNetworks',
    provider: 'azure',
    region: 'eastus',
    metadata: {
      configuration: {
        addressSpace: '10.1.0.0/16',
        subnets: 3,
        enableDdosProtection: false
      }
    },
    tags: {
      Name: 'Production Virtual Network',
      Environment: 'production'
    }
  },
  {
    id: '/subscriptions/abc123/resourceGroups/prod-rg/providers/Microsoft.Network/loadBalancers/prod-lb',
    name: 'prod-lb',
    type: 'Microsoft.Network/loadBalancers',
    provider: 'azure',
    region: 'eastus',
    metadata: {
      configuration: {
        sku: 'Standard',
        frontendIPConfigurations: 1,
        backendAddressPools: 1
      }
    },
    tags: {
      Name: 'Production Load Balancer',
      Environment: 'production'
    }
  },

  // Security
  {
    id: '/subscriptions/abc123/resourceGroups/prod-rg/providers/Microsoft.KeyVault/vaults/prod-kv',
    name: 'prod-kv',
    type: 'Microsoft.KeyVault/vaults',
    provider: 'azure',
    region: 'eastus',
    metadata: {
      configuration: {
        sku: 'premium',
        enableSoftDelete: true,
        enablePurgeProtection: true,
        enableRbacAuthorization: true
      }
    },
    tags: {
      Name: 'Production Key Vault',
      Environment: 'production',
      DataClassification: 'Confidential'
    }
  }
];

/**
 * Mock GCP Resources
 */
export const mockGCPResources: CloudResource[] = [
  // Compute
  {
    id: 'projects/my-project/zones/us-central1-a/instances/web-instance-01',
    name: 'web-instance-01',
    type: 'compute.googleapis.com/Instance',
    provider: 'gcp',
    region: 'us-central1',
    zone: 'us-central1-a',
    metadata: {
      configuration: {
        machineType: 'n1-standard-2',
        status: 'RUNNING',
        networkInterfaces: [{
          network: 'global/networks/prod-vpc',
          accessConfigs: [{ natIP: '35.123.45.67', type: 'ONE_TO_ONE_NAT' }]
        }]
      }
    },
    tags: {
      Name: 'Production Web Instance',
      Environment: 'production',
      Team: 'platform'
    }
  },
  {
    id: 'projects/my-project/locations/us-central1/services/data-processor',
    name: 'data-processor',
    type: 'run.googleapis.com/Service',
    provider: 'gcp',
    region: 'us-central1',
    metadata: {
      configuration: {
        latestRevision: 'data-processor-00005-xyz',
        url: 'https://data-processor-xyz.run.app',
        ingress: 'INGRESS_TRAFFIC_ALL'
      }
    },
    tags: {
      Name: 'Data Processing Service',
      Environment: 'production'
    }
  },

  // Database
  {
    id: 'projects/my-project/instances/prod-db-01',
    name: 'prod-db-01',
    type: 'sqladmin.googleapis.com/Instance',
    provider: 'gcp',
    region: 'us-central1',
    metadata: {
      configuration: {
        databaseVersion: 'POSTGRES_14',
        tier: 'db-n1-standard-2',
        backupConfiguration: { enabled: true, startTime: '02:00' },
        ipAddresses: [{ type: 'PRIVATE', ipAddress: '10.128.0.5' }]
      }
    },
    tags: {
      Name: 'Production Cloud SQL Database',
      Environment: 'production',
      DataClassification: 'Confidential'
    }
  },
  {
    id: 'projects/my-project/databases/(default)',
    name: 'prod-firestore',
    type: 'firestore.googleapis.com/Database',
    provider: 'gcp',
    region: 'us-central1',
    metadata: {
      configuration: {
        type: 'FIRESTORE_NATIVE',
        concurrencyMode: 'OPTIMISTIC',
        appEngineIntegrationMode: 'DISABLED'
      }
    },
    tags: {
      Name: 'Firestore Database',
      Environment: 'production'
    }
  },

  // Storage
  {
    id: 'projects/my-project/buckets/prod-assets-bucket',
    name: 'prod-assets-bucket',
    type: 'storage.googleapis.com/Bucket',
    provider: 'gcp',
    region: 'us-central1',
    metadata: {
      configuration: {
        storageClass: 'STANDARD',
        locationType: 'region',
        versioning: { enabled: true },
        encryption: { defaultKmsKeyName: 'projects/my-project/locations/us-central1/keyRings/prod/cryptoKeys/storage' }
      }
    },
    tags: {
      Name: 'Production Assets Bucket',
      Environment: 'production',
      DataClassification: 'Internal'
    }
  },

  // Networking
  {
    id: 'projects/my-project/global/networks/prod-vpc',
    name: 'prod-vpc',
    type: 'compute.googleapis.com/Network',
    provider: 'gcp',
    region: 'global',
    metadata: {
      configuration: {
        autoCreateSubnetworks: false,
        routingMode: 'REGIONAL',
        mtu: 1460
      }
    },
    tags: {
      Name: 'Production VPC Network',
      Environment: 'production'
    }
  },
  {
    id: 'projects/my-project/global/forwardingRules/prod-lb',
    name: 'prod-lb',
    type: 'compute.googleapis.com/ForwardingRule',
    provider: 'gcp',
    region: 'us-central1',
    metadata: {
      configuration: {
        IPAddress: '35.123.45.100',
        IPProtocol: 'TCP',
        portRange: '443',
        loadBalancingScheme: 'EXTERNAL'
      }
    },
    tags: {
      Name: 'Production Load Balancer',
      Environment: 'production'
    }
  },

  // Security
  {
    id: 'projects/my-project/secrets/db-credentials',
    name: 'db-credentials',
    type: 'secretmanager.googleapis.com/Secret',
    provider: 'gcp',
    region: 'global',
    metadata: {
      configuration: {
        replication: { automatic: {} },
        createTime: '2024-01-10T08:00:00Z',
        rotation: { enabled: true, nextRotationTime: '2024-04-10T08:00:00Z' }
      }
    },
    tags: {
      Name: 'Database Credentials',
      Environment: 'production',
      DataClassification: 'Confidential'
    }
  },

  // Containers
  {
    id: 'projects/my-project/locations/us-central1/clusters/prod-gke',
    name: 'prod-gke',
    type: 'container.googleapis.com/Cluster',
    provider: 'gcp',
    region: 'us-central1',
    metadata: {
      configuration: {
        currentMasterVersion: '1.27.3-gke.100',
        currentNodeVersion: '1.27.3-gke.100',
        currentNodeCount: 6,
        autopilot: { enabled: false },
        networkPolicy: { enabled: true }
      }
    },
    tags: {
      Name: 'Production GKE Cluster',
      Environment: 'production'
    }
  }
];

/**
 * Get all mock resources combined
 */
export function getAllMockCloudResources(): CloudResource[] {
  return [
    ...mockAWSResources,
    ...mockAzureResources,
    ...mockGCPResources
  ];
}

/**
 * Get mock resources by provider
 */
export function getMockResourcesByProvider(provider: CloudProvider): CloudResource[] {
  switch (provider) {
    case 'aws':
      return mockAWSResources;
    case 'azure':
      return mockAzureResources;
    case 'gcp':
      return mockGCPResources;
    default:
      return [];
  }
}

/**
 * Get mock resources by type
 */
export function getMockResourcesByType(resourceType: string): CloudResource[] {
  return getAllMockCloudResources().filter(r => r.type === resourceType);
}

/**
 * Create mock cloud discovery result
 */
export function createMockDiscoveryResult(provider: CloudProvider) {
  return {
    success: true,
    resources: getMockResourcesByProvider(provider),
    metrics: {
      totalResources: getMockResourcesByProvider(provider).length,
      resourcesByType: getMockResourcesByProvider(provider).reduce((acc, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      resourcesByRegion: getMockResourcesByProvider(provider).reduce((acc, r) => {
        acc[r.region] = (acc[r.region] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    }
  };
}

export {};
