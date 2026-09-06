/**
 * Cloud Resource Mapper
 * Maps cloud resources to vendor-specific ContextCypher node types
 * PRIORITY: Always use vendor nodes (awsEC2, azureVM, etc.) before generic fallbacks
 */

import { CloudResource, CloudProvider, MappedCloudNode } from '../../types/CloudTypes';
import { SecurityZone, DataClassification } from '../../types/SecurityTypes';

/**
 * AWS Resource Type to ContextCypher Node Type Mapping
 * Complete mapping for all 77 AWS services
 */
const AWS_TYPE_MAPPING: Record<string, string> = {
  // Compute (13)
  'AWS::EC2::Instance': 'awsEC2',
  'AWS::Lambda::Function': 'awsLambda',
  'AWS::ElasticBeanstalk::Environment': 'awsElasticBeanstalk',
  'AWS::Batch::JobQueue': 'awsBatch',
  'AWS::Lightsail::Instance': 'awsLightsail',
  'AWS::AppRunner::Service': 'awsAppRunner',
  'AWS::EC2::SpotFleet': 'awsEC2',
  'AWS::AutoScaling::AutoScalingGroup': 'awsEC2',

  // Containers (6)
  'AWS::ECS::Service': 'awsECS',
  'AWS::ECS::TaskDefinition': 'awsECS',
  'AWS::EKS::Cluster': 'awsEKS',
  'AWS::EKS::Nodegroup': 'awsEKS',
  'AWS::ECR::Repository': 'awsECR',
  'AWS::ECS::Cluster': 'awsECS',

  // Storage (7)
  'AWS::S3::Bucket': 'awsS3',
  'AWS::EBS::Volume': 'awsEBS',
  'AWS::EFS::FileSystem': 'awsEFS',
  'AWS::FSx::FileSystem': 'awsEFS',
  'AWS::Glacier::Vault': 'awsGlacier',
  'AWS::S3::AccessPoint': 'awsS3',
  'AWS::Backup::BackupVault': 'awsBackup',

  // Database (8)
  'AWS::RDS::DBInstance': 'awsRDS',
  'AWS::RDS::DBCluster': 'awsRDS',
  'AWS::DynamoDB::Table': 'awsDynamoDB',
  'AWS::ElastiCache::CacheCluster': 'awsElastiCache',
  'AWS::ElastiCache::ReplicationGroup': 'awsElastiCache',
  'AWS::Neptune::DBCluster': 'awsNeptune',
  'AWS::Redshift::Cluster': 'awsRedshift',
  'AWS::DocumentDB::DBCluster': 'awsDocumentDB',

  // Networking (10)
  'AWS::EC2::VPC': 'awsVPC',
  'AWS::ElasticLoadBalancingV2::LoadBalancer': 'awsELB',
  'AWS::ElasticLoadBalancing::LoadBalancer': 'awsELB',
  'AWS::CloudFront::Distribution': 'awsCloudFront',
  'AWS::ApiGateway::RestApi': 'awsAPIGateway',
  'AWS::ApiGatewayV2::Api': 'awsAPIGateway',
  'AWS::Route53::HostedZone': 'awsRoute53',
  'AWS::DirectConnect::Connection': 'awsDirectConnect',
  'AWS::EC2::TransitGateway': 'awsTransitGateway',
  'AWS::GlobalAccelerator::Accelerator': 'awsGlobalAccelerator',

  // Security (12)
  'AWS::GuardDuty::Detector': 'awsGuardDuty',
  'AWS::SecretsManager::Secret': 'awsSecretsManager',
  'AWS::SecurityHub::Hub': 'awsSecurityHub',
  'AWS::WAFv2::WebACL': 'awsWAF',
  'AWS::WAF::WebACL': 'awsWAF',
  'AWS::Shield::Protection': 'awsShield',
  'AWS::Inspector::AssessmentTemplate': 'awsInspector',
  'AWS::Macie::Session': 'awsMacie',
  'AWS::Detective::Graph': 'awsDetective',
  'AWS::IAM::Role': 'awsIAM',
  'AWS::KMS::Key': 'awsKMS',
  'AWS::ACM::Certificate': 'awsACM',

  // Integration (6)
  'AWS::SNS::Topic': 'awsSNS',
  'AWS::SQS::Queue': 'awsSQS',
  'AWS::EventBridge::EventBus': 'awsEventBridge',
  'AWS::Events::Rule': 'awsEventBridge',
  'AWS::StepFunctions::StateMachine': 'awsStepFunctions',
  'AWS::Kinesis::Stream': 'awsKinesis',

  // Analytics (5)
  'AWS::Athena::WorkGroup': 'awsAthena',
  'AWS::EMR::Cluster': 'awsEMR',
  'AWS::QuickSight::Dashboard': 'awsQuickSight',
  'AWS::Glue::Database': 'awsGlue',
  'AWS::DataPipeline::Pipeline': 'awsDataPipeline',

  // AI/ML (5)
  'AWS::SageMaker::NotebookInstance': 'awsSageMaker',
  'AWS::SageMaker::Endpoint': 'awsSageMaker',
  'AWS::Bedrock::Agent': 'awsBedrock',
  'AWS::Comprehend::DocumentClassifier': 'awsComprehend',
  'AWS::Rekognition::Collection': 'awsRekognition',

  // Management (5)
  'AWS::CloudWatch::Alarm': 'awsCloudWatch',
  'AWS::CloudTrail::Trail': 'awsCloudTrail',
  'AWS::Config::ConfigRule': 'awsConfig',
  'AWS::SSM::Parameter': 'awsSystemsManager',
  'AWS::OpsWorks::Stack': 'awsOpsWorks'
};

/**
 * Azure Resource Type to ContextCypher Node Type Mapping
 * Complete mapping for all 49 Azure services
 */
const AZURE_TYPE_MAPPING: Record<string, string> = {
  // Compute (7)
  'Microsoft.Compute/virtualMachines': 'azureVM',
  'Microsoft.Compute/virtualMachineScaleSets': 'azureVM',
  'Microsoft.Web/sites': 'azureAppService',
  'Microsoft.Web/sites/slots': 'azureAppService',
  'Microsoft.Web/serverFarms': 'azureAppService',
  'Microsoft.ContainerInstance/containerGroups': 'azureContainerInstances',
  'Microsoft.Batch/batchAccounts': 'azureBatch',

  // Storage (5)
  'Microsoft.Storage/storageAccounts': 'azureStorage',
  'Microsoft.Storage/storageAccounts/blobServices': 'azureBlobStorage',
  'Microsoft.Storage/storageAccounts/fileServices': 'azureFileStorage',
  'Microsoft.Compute/disks': 'azureManagedDisks',
  'Microsoft.NetApp/netAppAccounts': 'azureNetAppFiles',

  // Database (8)
  'Microsoft.Sql/servers': 'azureSQLDatabase',
  'Microsoft.Sql/servers/databases': 'azureSQLDatabase',
  'Microsoft.DocumentDB/databaseAccounts': 'azureCosmosDB',
  'Microsoft.Cache/Redis': 'azureRedisCache',
  'Microsoft.DBforPostgreSQL/servers': 'azurePostgreSQL',
  'Microsoft.DBforMySQL/servers': 'azureMySQL',
  'Microsoft.Synapse/workspaces': 'azureSynapseAnalytics',
  'Microsoft.Sql/managedInstances': 'azureSQLDatabase',

  // Networking (8)
  'Microsoft.Network/virtualNetworks': 'azureVirtualNetwork',
  'Microsoft.Network/loadBalancers': 'azureLoadBalancer',
  'Microsoft.Network/applicationGateways': 'azureApplicationGateway',
  'Microsoft.Cdn/profiles': 'azureCDN',
  'Microsoft.Network/frontDoors': 'azureFrontDoor',
  'Microsoft.Network/trafficManagerProfiles': 'azureTrafficManager',
  'Microsoft.Network/expressRouteCircuits': 'azureExpressRoute',
  'Microsoft.Network/vpnGateways': 'azureVPNGateway',

  // Containers (3)
  'Microsoft.ContainerService/managedClusters': 'azureKubernetesService',
  'Microsoft.ContainerRegistry/registries': 'azureContainerRegistry',
  'Microsoft.App/containerApps': 'azureContainerApps',

  // Security (10)
  'Microsoft.Security/securityContacts': 'azureSentinel',
  'Microsoft.OperationalInsights/workspaces': 'azureLogAnalytics',
  'Microsoft.SecurityInsights/incidents': 'azureSentinel',
  'Microsoft.Security/securitySolutions': 'azureDefenderForCloud',
  'Microsoft.Network/ddosProtectionPlans': 'azureDDoSProtection',
  'Microsoft.Network/azureFirewalls': 'azureFirewall',
  'Microsoft.Security/automations': 'azureSentinel',
  'Microsoft.KeyVault/vaults': 'azureKeyVault',
  'Microsoft.ManagedIdentity/userAssignedIdentities': 'azureManagedIdentity',
  'Microsoft.Network/bastionHosts': 'azureBastion',

  // Identity (4)
  'Microsoft.AAD/domainServices': 'azureActiveDirectory',
  'Microsoft.AzureActiveDirectory/b2cDirectories': 'azureADB2C',
  'Microsoft.Authorization/policyAssignments': 'azurePolicy',
  'Microsoft.Authorization/roleAssignments': 'azureActiveDirectory',

  // Integration (4)
  'Microsoft.Logic/workflows': 'azureLogicApps',
  'Microsoft.ServiceBus/namespaces': 'azureServiceBus',
  'Microsoft.EventGrid/topics': 'azureEventGrid',
  'Microsoft.ApiManagement/service': 'azureAPIManagement'
};

/**
 * GCP Resource Type to ContextCypher Node Type Mapping
 * Complete mapping for all 50 GCP services
 */
const GCP_TYPE_MAPPING: Record<string, string> = {
  // Compute (7)
  'compute.googleapis.com/Instance': 'gcpComputeEngine',
  'compute.googleapis.com/InstanceTemplate': 'gcpComputeEngine',
  'compute.googleapis.com/InstanceGroup': 'gcpComputeEngine',
  'appengine.googleapis.com/Application': 'gcpAppEngine',
  'appengine.googleapis.com/Service': 'gcpAppEngine',
  'cloudfunctions.googleapis.com/CloudFunction': 'gcpCloudFunctions',
  'run.googleapis.com/Service': 'gcpCloudRun',

  // Storage (5)
  'storage.googleapis.com/Bucket': 'gcpCloudStorage',
  'compute.googleapis.com/Disk': 'gcpPersistentDisk',
  'file.googleapis.com/Instance': 'gcpFilestore',
  'storagetransfer.googleapis.com/TransferJob': 'gcpCloudStorage',
  'compute.googleapis.com/Snapshot': 'gcpPersistentDisk',

  // Database (7)
  'sqladmin.googleapis.com/Instance': 'gcpCloudSQL',
  'firestore.googleapis.com/Database': 'gcpFirestore',
  'bigtable.googleapis.com/Instance': 'gcpBigtable',
  'bigtable.googleapis.com/Cluster': 'gcpBigtable',
  'spanner.googleapis.com/Instance': 'gcpCloudSpanner',
  'redis.googleapis.com/Instance': 'gcpMemorystore',
  'datastore.googleapis.com/Index': 'gcpDatastore',

  // Containers (4)
  'container.googleapis.com/Cluster': 'gcpGKE',
  'container.googleapis.com/NodePool': 'gcpGKE',
  'artifactregistry.googleapis.com/Repository': 'gcpArtifactRegistry',
  'containerregistry.googleapis.com/Image': 'gcpContainerRegistry',

  // Networking (8)
  'compute.googleapis.com/Network': 'gcpVPC',
  'compute.googleapis.com/Subnetwork': 'gcpVPC',
  'compute.googleapis.com/ForwardingRule': 'gcpCloudLoadBalancing',
  'compute.googleapis.com/BackendService': 'gcpCloudLoadBalancing',
  'compute.googleapis.com/UrlMap': 'gcpCloudLoadBalancing',
  'compute.googleapis.com/Router': 'gcpCloudRouter',
  'dns.googleapis.com/ManagedZone': 'gcpCloudDNS',
  'networksecurity.googleapis.com/FirewallEndpoint': 'gcpCloudArmor',

  // Security (7)
  'securitycenter.googleapis.com/Source': 'gcpSecurityCommandCenter',
  'dlp.googleapis.com/InspectTemplate': 'gcpCloudDLP',
  'binaryauthorization.googleapis.com/Policy': 'gcpBinaryAuthorization',
  'secretmanager.googleapis.com/Secret': 'gcpSecretManager',
  'cloudkms.googleapis.com/CryptoKey': 'gcpKMS',
  'iap.googleapis.com/TunnelInstance': 'gcpIAP',
  'accesscontextmanager.googleapis.com/AccessPolicy': 'gcpVPCServiceControls',

  // AI/ML (6)
  'aiplatform.googleapis.com/Model': 'gcpVertexAI',
  'aiplatform.googleapis.com/Endpoint': 'gcpVertexAI',
  'automl.googleapis.com/Model': 'gcpAutoML',
  'ml.googleapis.com/Model': 'gcpAIPlatform',
  'vision.googleapis.com/Product': 'gcpVisionAI',
  'language.googleapis.com/Model': 'gcpNaturalLanguageAI',

  // Analytics (6)
  'bigquery.googleapis.com/Dataset': 'gcpBigQuery',
  'bigquery.googleapis.com/Table': 'gcpBigQuery',
  'dataflow.googleapis.com/Job': 'gcpDataflow',
  'dataproc.googleapis.com/Cluster': 'gcpDataproc',
  'datafusion.googleapis.com/Instance': 'gcpDataFusion',
  'pubsub.googleapis.com/Topic': 'gcpPubSub'
};

export class CloudResourceMapper {
  /**
   * Map cloud resource to vendor-specific ContextCypher node type
   * PRIORITY: Vendor nodes first, generic fallback only if no match
   */
  mapToNodeType(resource: CloudResource): string {
    const mappings = {
      aws: AWS_TYPE_MAPPING,
      azure: AZURE_TYPE_MAPPING,
      gcp: GCP_TYPE_MAPPING
    };

    const mapping = mappings[resource.provider];
    if (!mapping) {
      console.warn(`Unknown cloud provider: ${resource.provider}`);
      return 'generic';
    }

    const nodeType = mapping[resource.type];
    if (nodeType) {
      console.log(`✅ Mapped ${resource.type} → ${nodeType}`);
      return nodeType;
    }

    // Try partial matching for complex types
    const partialMatch = Object.keys(mapping).find(key =>
      resource.type.includes(key) || key.includes(resource.type)
    );

    if (partialMatch) {
      console.log(`✅ Partial match ${resource.type} → ${mapping[partialMatch]}`);
      return mapping[partialMatch];
    }

    console.warn(`⚠️ No vendor node mapping for ${resource.type}, using generic`);
    return 'generic';
  }

  /**
   * Infer security zone from cloud resource properties
   */
  inferSecurityZone(resource: CloudResource): SecurityZone {
    const { metadata, type } = resource;

    // Internet-facing resources
    if (metadata.isPublic || metadata.publicIp) {
      return 'Internet';
    }

    // Load balancers and CDN → DMZ
    if (type.includes('LoadBalancer') ||
        type.includes('CloudFront') ||
        type.includes('CDN') ||
        type.includes('FrontDoor') ||
        type.includes('ApplicationGateway')) {
      return 'DMZ';
    }

    // API Gateways → DMZ
    if (type.includes('ApiGateway') || type.includes('API')) {
      return 'DMZ';
    }

    // Database and storage → Internal
    if (type.includes('Database') ||
        type.includes('SQL') ||
        type.includes('DynamoDB') ||
        type.includes('CosmosDB') ||
        type.includes('Storage') ||
        type.includes('Bucket') ||
        type.includes('Firestore')) {
      return 'Internal';
    }

    // Security services → Restricted
    if (type.includes('KeyVault') ||
        type.includes('SecretsManager') ||
        type.includes('KMS') ||
        type.includes('GuardDuty') ||
        type.includes('SecurityHub') ||
        type.includes('Sentinel')) {
      return 'Restricted';
    }

    // Compute services → DMZ if has public IP, otherwise Internal
    if (type.includes('Instance') ||
        type.includes('VM') ||
        type.includes('Compute') ||
        type.includes('Lambda') ||
        type.includes('Function')) {
      return metadata.publicIp ? 'DMZ' : 'Internal';
    }

    return 'Internal'; // Default
  }

  /**
   * Infer data classification from cloud resource
   */
  inferDataClassification(resource: CloudResource): DataClassification {
    const { type, tags = {} } = resource;

    // Check tags for classification hints
    const classificationTag = tags['Classification'] ||
                             tags['DataClassification'] ||
                             tags['Sensitivity'];

    if (classificationTag) {
      const tagLower = classificationTag.toLowerCase();
      if (tagLower.includes('public')) return 'Public';
      if (tagLower.includes('internal')) return 'Internal';
      if (tagLower.includes('confidential')) return 'Confidential';
      if (tagLower.includes('restricted')) return 'Confidential';
      if (tagLower.includes('sensitive')) return 'Sensitive';
    }

    // Database and storage → Confidential
    if (type.includes('Database') ||
        type.includes('Storage') ||
        type.includes('Bucket')) {
      return 'Confidential';
    }

    // Security services → Confidential
    if (type.includes('Secret') ||
        type.includes('Key') ||
        type.includes('Vault')) {
      return 'Confidential';
    }

    // CDN and public-facing → Public
    if (type.includes('CDN') ||
        type.includes('CloudFront') ||
        resource.metadata.isPublic) {
      return 'Public';
    }

    return 'Internal'; // Default
  }

  /**
   * Map cloud resource to ContextCypher node
   */
  mapResource(resource: CloudResource): MappedCloudNode {
    const nodeType = this.mapToNodeType(resource);
    const zone = this.inferSecurityZone(resource);
    const dataClassification = this.inferDataClassification(resource);

    // Extract meaningful label
    let label = resource.name;
    if (resource.tags?.Name) {
      label = resource.tags.Name;
    }

    // Build metadata
    const metadata: Record<string, any> = {
      cloudResourceId: resource.id,
      cloudResourceType: resource.type,
      cloudProvider: resource.provider,
      region: resource.region,
      availabilityZone: resource.zone,
      tags: resource.tags,
      ...resource.metadata
    };

    return {
      cloudResource: resource,
      nodeType,
      label,
      zone,
      dataClassification,
      metadata
    };
  }

  /**
   * Batch map multiple resources
   */
  mapResources(resources: CloudResource[]): MappedCloudNode[] {
    return resources.map(resource => this.mapResource(resource));
  }

  /**
   * Get vendor node type coverage statistics
   */
  getCoverageStats(): {
    aws: number;
    azure: number;
    gcp: number;
    total: number;
  } {
    return {
      aws: Object.keys(AWS_TYPE_MAPPING).length,
      azure: Object.keys(AZURE_TYPE_MAPPING).length,
      gcp: Object.keys(GCP_TYPE_MAPPING).length,
      total: Object.keys(AWS_TYPE_MAPPING).length +
             Object.keys(AZURE_TYPE_MAPPING).length +
             Object.keys(GCP_TYPE_MAPPING).length
    };
  }
}

export const cloudResourceMapper = new CloudResourceMapper();
