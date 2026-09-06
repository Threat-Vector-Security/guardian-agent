import React, { useState } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormGroup,
  FormControlLabel,
  Checkbox,
  TextField
} from '@mui/material';
import { ExpandMore, FilterList } from '@mui/icons-material';
import { CloudProvider, CloudResourceFilters } from '../types/CloudTypes';

interface CloudResourceSelectorProps {
  provider: CloudProvider;
  filters: CloudResourceFilters;
  onChange: (filters: CloudResourceFilters) => void;
}

const AWS_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-west-2', 'eu-central-1',
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1'
];

const AZURE_LOCATIONS = [
  'eastus', 'eastus2', 'westus', 'westus2', 'centralus',
  'northeurope', 'westeurope', 'uksouth',
  'southeastasia', 'eastasia', 'australiaeast'
];

const GCP_REGIONS = [
  'us-central1', 'us-east1', 'us-west1', 'us-west2',
  'europe-west1', 'europe-west2', 'europe-west4',
  'asia-southeast1', 'asia-northeast1', 'australia-southeast1'
];

const AWS_RESOURCE_TYPES = [
  { value: 'AWS::EC2::Instance', label: 'EC2 Instances' },
  { value: 'AWS::RDS::DBInstance', label: 'RDS Databases' },
  { value: 'AWS::Lambda::Function', label: 'Lambda Functions' },
  { value: 'AWS::S3::Bucket', label: 'S3 Buckets' },
  { value: 'AWS::ElasticLoadBalancingV2::LoadBalancer', label: 'Load Balancers' },
  { value: 'AWS::DynamoDB::Table', label: 'DynamoDB Tables' },
  { value: 'AWS::ECS::Cluster', label: 'ECS Clusters' },
  { value: 'AWS::EKS::Cluster', label: 'EKS Clusters' },
  { value: 'AWS::ApiGateway::RestApi', label: 'API Gateways' }
];

const AZURE_RESOURCE_TYPES = [
  { value: 'Microsoft.Compute/virtualMachines', label: 'Virtual Machines' },
  { value: 'Microsoft.Sql/servers/databases', label: 'SQL Databases' },
  { value: 'Microsoft.Web/sites', label: 'App Services' },
  { value: 'Microsoft.Storage/storageAccounts', label: 'Storage Accounts' },
  { value: 'Microsoft.Network/virtualNetworks', label: 'Virtual Networks' },
  { value: 'Microsoft.ContainerService/managedClusters', label: 'AKS Clusters' },
  { value: 'Microsoft.DocumentDB/databaseAccounts', label: 'Cosmos DB' },
  { value: 'Microsoft.Network/loadBalancers', label: 'Load Balancers' }
];

const GCP_RESOURCE_TYPES = [
  { value: 'compute.googleapis.com/Instance', label: 'Compute Instances' },
  { value: 'sqladmin.googleapis.com/Instance', label: 'Cloud SQL' },
  { value: 'run.googleapis.com/Service', label: 'Cloud Run Services' },
  { value: 'storage.googleapis.com/Bucket', label: 'Storage Buckets' },
  { value: 'container.googleapis.com/Cluster', label: 'GKE Clusters' },
  { value: 'cloudfunctions.googleapis.com/CloudFunction', label: 'Cloud Functions' },
  { value: 'compute.googleapis.com/Network', label: 'VPC Networks' }
];

export const CloudResourceSelector: React.FC<CloudResourceSelectorProps> = ({
  provider,
  filters,
  onChange
}) => {
  const [tagKey, setTagKey] = useState('');
  const [tagValue, setTagValue] = useState('');

  const getRegions = () => {
    switch (provider) {
      case 'aws': return AWS_REGIONS;
      case 'azure': return AZURE_LOCATIONS;
      case 'gcp': return GCP_REGIONS;
      default: return [];
    }
  };

  const getResourceTypes = () => {
    switch (provider) {
      case 'aws': return AWS_RESOURCE_TYPES;
      case 'azure': return AZURE_RESOURCE_TYPES;
      case 'gcp': return GCP_RESOURCE_TYPES;
      default: return [];
    }
  };

  const handleRegionChange = (event: any) => {
    onChange({
      ...filters,
      regions: event.target.value
    });
  };

  const handleResourceTypeToggle = (resourceType: string) => {
    const currentTypes = filters.resourceTypes || [];
    const newTypes = currentTypes.includes(resourceType)
      ? currentTypes.filter(t => t !== resourceType)
      : [...currentTypes, resourceType];

    onChange({
      ...filters,
      resourceTypes: newTypes.length > 0 ? newTypes : undefined
    });
  };

  const handleAddTag = () => {
    if (tagKey && tagValue) {
      onChange({
        ...filters,
        tags: {
          ...(filters.tags || {}),
          [tagKey]: tagValue
        }
      });
      setTagKey('');
      setTagValue('');
    }
  };

  const handleRemoveTag = (key: string) => {
    const newTags = { ...(filters.tags || {}) };
    delete newTags[key];
    onChange({
      ...filters,
      tags: Object.keys(newTags).length > 0 ? newTags : undefined
    });
  };

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <FilterList />
        <Typography variant="h6">Discovery Filters</Typography>
      </Box>

      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Regions</InputLabel>
        <Select
          multiple
          value={filters.regions || []}
          onChange={handleRegionChange}
          input={<OutlinedInput label="Regions" />}
          renderValue={(selected) => (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {(selected as string[]).map((value) => (
                <Chip key={value} label={value} size="small" />
              ))}
            </Box>
          )}
        >
          {getRegions().map((region) => (
            <MenuItem key={region} value={region}>
              {region}
            </MenuItem>
          ))}
        </Select>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          {filters.regions?.length ? `${filters.regions.length} region(s) selected` : 'All regions'}
        </Typography>
      </FormControl>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography>
            Resource Types
            {filters.resourceTypes?.length && ` (${filters.resourceTypes.length} selected)`}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <FormGroup>
            {getResourceTypes().map((type) => (
              <FormControlLabel
                key={type.value}
                control={
                  <Checkbox
                    checked={filters.resourceTypes?.includes(type.value) || false}
                    onChange={() => handleResourceTypeToggle(type.value)}
                  />
                }
                label={type.label}
              />
            ))}
          </FormGroup>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {!filters.resourceTypes?.length && 'All resource types will be discovered'}
          </Typography>
        </AccordionDetails>
      </Accordion>

      <Accordion sx={{ mt: 2 }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography>
            Tag Filters
            {filters.tags && Object.keys(filters.tags).length > 0 &&
              ` (${Object.keys(filters.tags).length} tag(s))`}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box display="flex" gap={1} mb={2}>
            <TextField
              size="small"
              label="Tag Key"
              value={tagKey}
              onChange={(e) => setTagKey(e.target.value)}
              placeholder="Environment"
            />
            <TextField
              size="small"
              label="Tag Value"
              value={tagValue}
              onChange={(e) => setTagValue(e.target.value)}
              placeholder="Production"
            />
            <button
              onClick={handleAddTag}
              disabled={!tagKey || !tagValue}
              style={{
                padding: '8px 16px',
                cursor: tagKey && tagValue ? 'pointer' : 'not-allowed',
                opacity: tagKey && tagValue ? 1 : 0.5
              }}
            >
              Add
            </button>
          </Box>

          {filters.tags && Object.keys(filters.tags).length > 0 && (
            <Box display="flex" flexWrap="wrap" gap={1}>
              {Object.entries(filters.tags).map(([key, value]) => (
                <Chip
                  key={key}
                  label={`${key}: ${value}`}
                  onDelete={() => handleRemoveTag(key)}
                  size="small"
                />
              ))}
            </Box>
          )}
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};
