/**
 * Unit tests for CloudResourceMapper
 * Tests vendor node mapping, security zone inference, and data classification
 */

import { CloudResourceMapper } from '../CloudResourceMapper';
import { CloudResource, CloudProvider } from '../../../types/CloudTypes';
import { SecurityZone, DataClassification } from '../../../types/SecurityTypes';

describe('CloudResourceMapper', () => {
  let mapper: CloudResourceMapper;

  beforeEach(() => {
    mapper = new CloudResourceMapper();
  });

  describe('mapToNodeType - AWS Resources', () => {
    it('should map AWS EC2 instance to awsEC2 vendor node', () => {
      const resource: CloudResource = {
        id: 'i-1234567890abcdef0',
        name: 'web-server-01',
        type: 'AWS::EC2::Instance',
        provider: 'aws',
        region: 'us-east-1',
        metadata: {}
      };

      const nodeType = mapper.mapToNodeType(resource);
      expect(nodeType).toBe('awsEC2');
    });

    it('should map AWS Lambda function to awsLambda vendor node', () => {
      const resource: CloudResource = {
        id: 'arn:aws:lambda:us-east-1:123456789012:function:my-function',
        name: 'my-function',
        type: 'AWS::Lambda::Function',
        provider: 'aws',
        region: 'us-east-1',
        metadata: {}
      };

      const nodeType = mapper.mapToNodeType(resource);
      expect(nodeType).toBe('awsLambda');
    });

    it('should map AWS RDS instance to awsRDS vendor node', () => {
      const resource: CloudResource = {
        id: 'arn:aws:rds:us-east-1:123456789012:db:mydb',
        name: 'mydb',
        type: 'AWS::RDS::DBInstance',
        provider: 'aws',
        region: 'us-east-1',
        metadata: {}
      };

      const nodeType = mapper.mapToNodeType(resource);
      expect(nodeType).toBe('awsRDS');
    });

    it('should map AWS S3 bucket to awsS3 vendor node', () => {
      const resource: CloudResource = {
        id: 'arn:aws:s3:::my-bucket',
        name: 'my-bucket',
        type: 'AWS::S3::Bucket',
        provider: 'aws',
        region: 'us-east-1',
        metadata: {}
      };

      const nodeType = mapper.mapToNodeType(resource);
      expect(nodeType).toBe('awsS3');
    });

    it('should map AWS VPC to awsVPC vendor node', () => {
      const resource: CloudResource = {
        id: 'vpc-0123456789abcdef0',
        name: 'main-vpc',
        type: 'AWS::EC2::VPC',
        provider: 'aws',
        region: 'us-east-1',
        metadata: {}
      };

      const nodeType = mapper.mapToNodeType(resource);
      expect(nodeType).toBe('awsVPC');
    });

    it('should use generic fallback for unknown AWS resource type', () => {
      const resource: CloudResource = {
        id: 'unknown-resource',
        name: 'unknown',
        type: 'AWS::Unknown::Service',
        provider: 'aws',
        region: 'us-east-1',
        metadata: {}
      };

      const nodeType = mapper.mapToNodeType(resource);
      expect(nodeType).toBe('generic');
    });
  });

  describe('mapToNodeType - Azure Resources', () => {
    it('should map Azure VM to azureVM vendor node', () => {
      const resource: CloudResource = {
        id: '/subscriptions/xxx/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm1',
        name: 'vm1',
        type: 'Microsoft.Compute/virtualMachines',
        provider: 'azure',
        region: 'eastus',
        metadata: {}
      };

      const nodeType = mapper.mapToNodeType(resource);
      expect(nodeType).toBe('azureVM');
    });

    it('should map Azure App Service to azureAppService vendor node', () => {
      const resource: CloudResource = {
        id: '/subscriptions/xxx/resourceGroups/rg/providers/Microsoft.Web/sites/webapp1',
        name: 'webapp1',
        type: 'Microsoft.Web/sites',
        provider: 'azure',
        region: 'eastus',
        metadata: {}
      };

      const nodeType = mapper.mapToNodeType(resource);
      expect(nodeType).toBe('azureAppService');
    });

    it('should map Azure SQL Database to azureSQLDatabase vendor node', () => {
      const resource: CloudResource = {
        id: '/subscriptions/xxx/resourceGroups/rg/providers/Microsoft.Sql/servers/sqlserver1',
        name: 'sqlserver1',
        type: 'Microsoft.Sql/servers',
        provider: 'azure',
        region: 'eastus',
        metadata: {}
      };

      const nodeType = mapper.mapToNodeType(resource);
      expect(nodeType).toBe('azureSQLDatabase');
    });

    it('should map Azure Storage Account to azureStorage vendor node', () => {
      const resource: CloudResource = {
        id: '/subscriptions/xxx/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/storage1',
        name: 'storage1',
        type: 'Microsoft.Storage/storageAccounts',
        provider: 'azure',
        region: 'eastus',
        metadata: {}
      };

      const nodeType = mapper.mapToNodeType(resource);
      expect(nodeType).toBe('azureStorage');
    });
  });

  describe('mapToNodeType - GCP Resources', () => {
    it('should map GCP Compute Engine to gcpComputeEngine vendor node', () => {
      const resource: CloudResource = {
        id: 'projects/my-project/zones/us-central1-a/instances/instance-1',
        name: 'instance-1',
        type: 'compute.googleapis.com/Instance',
        provider: 'gcp',
        region: 'us-central1',
        metadata: {}
      };

      const nodeType = mapper.mapToNodeType(resource);
      expect(nodeType).toBe('gcpComputeEngine');
    });

    it('should map GCP Cloud Run to gcpCloudRun vendor node', () => {
      const resource: CloudResource = {
        id: 'projects/my-project/locations/us-central1/services/my-service',
        name: 'my-service',
        type: 'run.googleapis.com/Service',
        provider: 'gcp',
        region: 'us-central1',
        metadata: {}
      };

      const nodeType = mapper.mapToNodeType(resource);
      expect(nodeType).toBe('gcpCloudRun');
    });

    it('should map GCP Cloud SQL to gcpCloudSQL vendor node', () => {
      const resource: CloudResource = {
        id: 'projects/my-project/instances/my-instance',
        name: 'my-instance',
        type: 'sqladmin.googleapis.com/Instance',
        provider: 'gcp',
        region: 'us-central1',
        metadata: {}
      };

      const nodeType = mapper.mapToNodeType(resource);
      expect(nodeType).toBe('gcpCloudSQL');
    });

    it('should map GCP Cloud Storage to gcpCloudStorage vendor node', () => {
      const resource: CloudResource = {
        id: 'projects/my-project/buckets/my-bucket',
        name: 'my-bucket',
        type: 'storage.googleapis.com/Bucket',
        provider: 'gcp',
        region: 'us-central1',
        metadata: {}
      };

      const nodeType = mapper.mapToNodeType(resource);
      expect(nodeType).toBe('gcpCloudStorage');
    });
  });

  describe('inferSecurityZone', () => {
    it('should classify public resources as Internet zone', () => {
      const resource: CloudResource = {
        id: 'resource-1',
        name: 'public-resource',
        type: 'AWS::EC2::Instance',
        provider: 'aws',
        region: 'us-east-1',
        metadata: { isPublic: true }
      };

      const zone = mapper.inferSecurityZone(resource);
      expect(zone).toBe('Internet');
    });

    it('should classify resources with public IP as Internet zone', () => {
      const resource: CloudResource = {
        id: 'resource-1',
        name: 'public-ip-resource',
        type: 'AWS::EC2::Instance',
        provider: 'aws',
        region: 'us-east-1',
        metadata: { publicIp: '54.123.45.67' }
      };

      const zone = mapper.inferSecurityZone(resource);
      expect(zone).toBe('Internet');
    });

    it('should classify load balancers as DMZ zone', () => {
      const resource: CloudResource = {
        id: 'alb-1',
        name: 'app-load-balancer',
        type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
        provider: 'aws',
        region: 'us-east-1',
        metadata: {}
      };

      const zone = mapper.inferSecurityZone(resource);
      expect(zone).toBe('DMZ');
    });

    it('should classify API Gateway as DMZ zone', () => {
      const resource: CloudResource = {
        id: 'api-1',
        name: 'rest-api',
        type: 'AWS::ApiGateway::RestApi',
        provider: 'aws',
        region: 'us-east-1',
        metadata: {}
      };

      const zone = mapper.inferSecurityZone(resource);
      expect(zone).toBe('DMZ');
    });

    it('should classify databases as Internal zone', () => {
      const resource: CloudResource = {
        id: 'db-1',
        name: 'app-database',
        type: 'AWS::RDS::DBInstance',
        provider: 'aws',
        region: 'us-east-1',
        metadata: {}
      };

      const zone = mapper.inferSecurityZone(resource);
      expect(zone).toBe('Internal');
    });

    it('should classify storage as Internal zone', () => {
      const resource: CloudResource = {
        id: 's3-1',
        name: 'private-bucket',
        type: 'AWS::S3::Bucket',
        provider: 'aws',
        region: 'us-east-1',
        metadata: {}
      };

      const zone = mapper.inferSecurityZone(resource);
      expect(zone).toBe('Internal');
    });

    it('should classify security services as Restricted zone', () => {
      const resource: CloudResource = {
        id: 'kv-1',
        name: 'secrets-vault',
        type: 'AWS::SecretsManager::Secret',
        provider: 'aws',
        region: 'us-east-1',
        metadata: {}
      };

      const zone = mapper.inferSecurityZone(resource);
      expect(zone).toBe('Restricted');
    });

    it('should classify compute with public IP as Internet, private as Internal', () => {
      const publicCompute: CloudResource = {
        id: 'vm-1',
        name: 'public-vm',
        type: 'Microsoft.Compute/virtualMachines',
        provider: 'azure',
        region: 'eastus',
        metadata: { publicIp: '40.123.45.67' }
      };

      const privateCompute: CloudResource = {
        id: 'vm-2',
        name: 'private-vm',
        type: 'Microsoft.Compute/virtualMachines',
        provider: 'azure',
        region: 'eastus',
        metadata: {}
      };

      // Resources with publicIp are classified as Internet (highest priority)
      expect(mapper.inferSecurityZone(publicCompute)).toBe('Internet');
      expect(mapper.inferSecurityZone(privateCompute)).toBe('Internal');
    });
  });

  describe('inferDataClassification', () => {
    it('should use Classification tag when present', () => {
      const resource: CloudResource = {
        id: 'resource-1',
        name: 'tagged-resource',
        type: 'AWS::S3::Bucket',
        provider: 'aws',
        region: 'us-east-1',
        metadata: {},
        tags: { Classification: 'Confidential' }
      };

      const classification = mapper.inferDataClassification(resource);
      expect(classification).toBe('Confidential');
    });

    it('should detect public classification from tags', () => {
      const resource: CloudResource = {
        id: 'resource-1',
        name: 'public-resource',
        type: 'AWS::S3::Bucket',
        provider: 'aws',
        region: 'us-east-1',
        metadata: {},
        tags: { Sensitivity: 'Public' }
      };

      const classification = mapper.inferDataClassification(resource);
      expect(classification).toBe('Public');
    });

    it('should classify databases as Confidential', () => {
      const resource: CloudResource = {
        id: 'db-1',
        name: 'customer-db',
        type: 'AWS::RDS::Database',
        provider: 'aws',
        region: 'us-east-1',
        metadata: {}
      };

      const classification = mapper.inferDataClassification(resource);
      expect(classification).toBe('Confidential');
    });

    it('should classify storage as Confidential', () => {
      const resource: CloudResource = {
        id: 'bucket-1',
        name: 'data-bucket',
        type: 'storage.googleapis.com/Bucket',
        provider: 'gcp',
        region: 'us-central1',
        metadata: {}
      };

      const classification = mapper.inferDataClassification(resource);
      expect(classification).toBe('Confidential');
    });

    it('should classify secrets/keys as Confidential', () => {
      const resource: CloudResource = {
        id: 'secret-1',
        name: 'api-keys',
        type: 'AWS::SecretsManager::Secret',
        provider: 'aws',
        region: 'us-east-1',
        metadata: {}
      };

      const classification = mapper.inferDataClassification(resource);
      expect(classification).toBe('Confidential');
    });

    it('should classify CDN as Public', () => {
      const resource: CloudResource = {
        id: 'cdn-1',
        name: 'static-assets',
        type: 'AWS::CloudFront::Distribution',
        provider: 'aws',
        region: 'us-east-1',
        metadata: {}
      };

      const classification = mapper.inferDataClassification(resource);
      expect(classification).toBe('Public');
    });

    it('should classify public-facing resources as Public', () => {
      const resource: CloudResource = {
        id: 'web-1',
        name: 'public-site',
        type: 'AWS::EC2::Instance',
        provider: 'aws',
        region: 'us-east-1',
        metadata: { isPublic: true }
      };

      const classification = mapper.inferDataClassification(resource);
      expect(classification).toBe('Public');
    });

    it('should default to Internal classification', () => {
      const resource: CloudResource = {
        id: 'resource-1',
        name: 'generic-resource',
        type: 'AWS::Lambda::Function',
        provider: 'aws',
        region: 'us-east-1',
        metadata: {}
      };

      const classification = mapper.inferDataClassification(resource);
      expect(classification).toBe('Internal');
    });
  });

  describe('mapResource', () => {
    it('should map AWS EC2 with all properties', () => {
      const resource: CloudResource = {
        id: 'i-1234567890abcdef0',
        name: 'web-server-01',
        type: 'AWS::EC2::Instance',
        provider: 'aws',
        region: 'us-east-1',
        zone: 'us-east-1a',
        metadata: { publicIp: '54.123.45.67' },
        tags: { Name: 'Production Web Server', Environment: 'prod' }
      };

      const mapped = mapper.mapResource(resource);

      expect(mapped.nodeType).toBe('awsEC2');
      expect(mapped.label).toBe('Production Web Server'); // Uses Name tag
      expect(mapped.zone).toBe('Internet'); // Resources with publicIp classified as Internet
      expect(mapped.dataClassification).toBe('Internal'); // Default classification
      expect(mapped.metadata.cloudResourceId).toBe('i-1234567890abcdef0');
      expect(mapped.metadata.cloudProvider).toBe('aws');
      expect(mapped.metadata.region).toBe('us-east-1');
      expect(mapped.metadata.availabilityZone).toBe('us-east-1a');
    });

    it('should use resource name when Name tag is absent', () => {
      const resource: CloudResource = {
        id: 'resource-1',
        name: 'my-resource',
        type: 'AWS::Lambda::Function',
        provider: 'aws',
        region: 'us-east-1',
        metadata: {}
      };

      const mapped = mapper.mapResource(resource);
      expect(mapped.label).toBe('my-resource');
    });

    it('should include all metadata in mapped node', () => {
      const resource: CloudResource = {
        id: 'db-1',
        name: 'production-db',
        type: 'AWS::RDS::DBInstance',
        provider: 'aws',
        region: 'us-east-1',
        metadata: {
          configuration: {
            engine: 'postgres',
            version: '14.5',
            instanceClass: 'db.t3.medium'
          }
        },
        tags: { Environment: 'production' }
      };

      const mapped = mapper.mapResource(resource);

      expect(mapped.metadata.configuration.engine).toBe('postgres');
      expect(mapped.metadata.configuration.version).toBe('14.5');
      expect(mapped.metadata.configuration.instanceClass).toBe('db.t3.medium');
      expect(mapped.metadata.tags).toEqual({ Environment: 'production' });
    });
  });

  describe('mapResources - Batch Mapping', () => {
    it('should map multiple resources in batch', () => {
      const resources: CloudResource[] = [
        {
          id: 'i-1',
          name: 'web-server',
          type: 'AWS::EC2::Instance',
          provider: 'aws',
          region: 'us-east-1',
          metadata: {}
        },
        {
          id: 'db-1',
          name: 'database',
          type: 'AWS::RDS::DBInstance',
          provider: 'aws',
          region: 'us-east-1',
          metadata: {}
        },
        {
          id: 'bucket-1',
          name: 'storage',
          type: 'AWS::S3::Bucket',
          provider: 'aws',
          region: 'us-east-1',
          metadata: {}
        }
      ];

      const mapped = mapper.mapResources(resources);

      expect(mapped).toHaveLength(3);
      expect(mapped[0].nodeType).toBe('awsEC2');
      expect(mapped[1].nodeType).toBe('awsRDS');
      expect(mapped[2].nodeType).toBe('awsS3');
    });

    it('should prioritize vendor nodes over generic fallback', () => {
      const resources: CloudResource[] = [
        {
          id: 'ec2-1',
          name: 'compute',
          type: 'AWS::EC2::Instance',
          provider: 'aws',
          region: 'us-east-1',
          metadata: {}
        },
        {
          id: 'unknown-1',
          name: 'unknown',
          type: 'AWS::Unknown::Service',
          provider: 'aws',
          region: 'us-east-1',
          metadata: {}
        }
      ];

      const mapped = mapper.mapResources(resources);

      expect(mapped[0].nodeType).toBe('awsEC2'); // Vendor node
      expect(mapped[1].nodeType).toBe('generic'); // Fallback
    });
  });

  describe('getCoverageStats', () => {
    it('should return correct coverage statistics', () => {
      const stats = mapper.getCoverageStats();

      expect(stats.aws).toBeGreaterThan(70); // At least 70 AWS services
      expect(stats.azure).toBeGreaterThan(45); // At least 45 Azure services
      expect(stats.gcp).toBeGreaterThan(45); // At least 45 GCP services
      expect(stats.total).toBe(stats.aws + stats.azure + stats.gcp);
    });

    it('should match documented coverage counts', () => {
      const stats = mapper.getCoverageStats();

      // Based on CloudResourceMapper.ts actual mappings
      expect(stats.aws).toBeGreaterThanOrEqual(70); // At least 70 AWS services
      expect(stats.azure).toBeGreaterThanOrEqual(45); // At least 45 Azure services
      expect(stats.gcp).toBeGreaterThanOrEqual(45); // At least 45 GCP services
      expect(stats.total).toBe(stats.aws + stats.azure + stats.gcp);
    });
  });
});

export {};
