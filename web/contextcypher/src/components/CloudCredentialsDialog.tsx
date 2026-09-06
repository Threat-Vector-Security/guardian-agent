import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Alert,
  IconButton,
  InputAdornment,
  RadioGroup,
  FormControlLabel,
  Radio,
  Divider
} from '@mui/material';
import { Visibility, VisibilityOff, Cloud as CloudIcon, MergeType, SwapHoriz } from '@mui/icons-material';
import { CloudProvider, CloudCredentials } from '../types/CloudTypes';
import { ImportMode } from '../services/DiagramImportService';

interface CloudCredentialsDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (credentials: CloudCredentials, importMode: ImportMode) => void;
}

export const CloudCredentialsDialog: React.FC<CloudCredentialsDialogProps> = ({
  open,
  onClose,
  onSubmit
}) => {
  const [provider, setProvider] = useState<CloudProvider>('aws');
  const [showSecrets, setShowSecrets] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('replace');

  const [awsAccessKeyId, setAwsAccessKeyId] = useState('');
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState('');
  const [awsRegion, setAwsRegion] = useState('us-east-1');

  const [azureClientId, setAzureClientId] = useState('');
  const [azureClientSecret, setAzureClientSecret] = useState('');
  const [azureTenantId, setAzureTenantId] = useState('');
  const [azureSubscriptionId, setAzureSubscriptionId] = useState('');

  const [gcpProjectId, setGcpProjectId] = useState('');
  const [gcpServiceAccountKey, setGcpServiceAccountKey] = useState('');

  const handleSubmit = () => {
    const credentials: CloudCredentials = { provider };

    if (provider === 'aws') {
      credentials.accessKeyId = awsAccessKeyId;
      credentials.secretAccessKey = awsSecretAccessKey;
      credentials.region = awsRegion;
    } else if (provider === 'azure') {
      credentials.clientId = azureClientId;
      credentials.clientSecret = azureClientSecret;
      credentials.tenantId = azureTenantId;
      credentials.subscriptionId = azureSubscriptionId;
    } else if (provider === 'gcp') {
      credentials.projectId = gcpProjectId;
      credentials.serviceAccountKey = gcpServiceAccountKey;
    }

    onSubmit(credentials, importMode);
  };

  const handleClose = () => {
    setAwsAccessKeyId('');
    setAwsSecretAccessKey('');
    setAzureClientId('');
    setAzureClientSecret('');
    setAzureTenantId('');
    setAzureSubscriptionId('');
    setGcpProjectId('');
    setGcpServiceAccountKey('');
    onClose();
  };

  const isFormValid = () => {
    if (provider === 'aws') {
      return awsAccessKeyId && awsSecretAccessKey && awsRegion;
    } else if (provider === 'azure') {
      return azureClientId && azureClientSecret && azureTenantId && azureSubscriptionId;
    } else if (provider === 'gcp') {
      return gcpProjectId && gcpServiceAccountKey;
    }
    return false;
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <CloudIcon />
          <span>Cloud Service Discovery Credentials</span>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Session-Only Credentials:</strong> Your credentials are used only for this discovery session
            and are never stored. They will be cleared when discovery completes or if you close this dialog.
          </Typography>
        </Alert>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Import Mode
          </Typography>
          <RadioGroup
            value={importMode}
            onChange={(e) => setImportMode(e.target.value as ImportMode)}
            row
          >
            <FormControlLabel
              value="replace"
              control={<Radio />}
              label={
                <Box display="flex" alignItems="center" gap={1}>
                  <SwapHoriz fontSize="small" />
                  <span>Replace - Clear existing diagram</span>
                </Box>
              }
            />
            <FormControlLabel
              value="merge"
              control={<Radio />}
              label={
                <Box display="flex" alignItems="center" gap={1}>
                  <MergeType fontSize="small" />
                  <span>Merge - Add to existing diagram</span>
                </Box>
              }
            />
          </RadioGroup>
          <Typography variant="caption" color="text.secondary">
            {importMode === 'replace'
              ? 'Current diagram will be cleared before importing cloud resources'
              : 'Cloud resources will be added to your existing diagram'}
          </Typography>
        </Box>

        <Divider sx={{ mb: 3 }} />

        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel>Cloud Provider</InputLabel>
          <Select
            value={provider}
            onChange={(e) => setProvider(e.target.value as CloudProvider)}
            label="Cloud Provider"
          >
            <MenuItem value="aws">Amazon Web Services (AWS)</MenuItem>
            <MenuItem value="azure">Microsoft Azure</MenuItem>
            <MenuItem value="gcp">Google Cloud Platform (GCP)</MenuItem>
          </Select>
        </FormControl>

        {provider === 'aws' && (
          <>
            <Typography variant="subtitle2" gutterBottom>
              AWS Credentials (Read-Only Access Recommended)
            </Typography>
            <TextField
              fullWidth
              label="Access Key ID"
              value={awsAccessKeyId}
              onChange={(e) => setAwsAccessKeyId(e.target.value)}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Secret Access Key"
              type={showSecrets ? 'text' : 'password'}
              value={awsSecretAccessKey}
              onChange={(e) => setAwsSecretAccessKey(e.target.value)}
              margin="normal"
              required
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowSecrets(!showSecrets)} edge="end">
                      {showSecrets ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            <TextField
              fullWidth
              label="Default Region"
              value={awsRegion}
              onChange={(e) => setAwsRegion(e.target.value)}
              margin="normal"
              required
              placeholder="us-east-1"
            />
          </>
        )}

        {provider === 'azure' && (
          <>
            <Typography variant="subtitle2" gutterBottom>
              Azure Service Principal Credentials (Reader Role Recommended)
            </Typography>
            <TextField
              fullWidth
              label="Client ID"
              value={azureClientId}
              onChange={(e) => setAzureClientId(e.target.value)}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Client Secret"
              type={showSecrets ? 'text' : 'password'}
              value={azureClientSecret}
              onChange={(e) => setAzureClientSecret(e.target.value)}
              margin="normal"
              required
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowSecrets(!showSecrets)} edge="end">
                      {showSecrets ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            <TextField
              fullWidth
              label="Tenant ID"
              value={azureTenantId}
              onChange={(e) => setAzureTenantId(e.target.value)}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Subscription ID"
              value={azureSubscriptionId}
              onChange={(e) => setAzureSubscriptionId(e.target.value)}
              margin="normal"
              required
            />
          </>
        )}

        {provider === 'gcp' && (
          <>
            <Typography variant="subtitle2" gutterBottom>
              GCP Service Account Credentials (Viewer Role Recommended)
            </Typography>
            <TextField
              fullWidth
              label="Project ID"
              value={gcpProjectId}
              onChange={(e) => setGcpProjectId(e.target.value)}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Service Account Key (JSON)"
              type={showSecrets ? 'text' : 'password'}
              value={gcpServiceAccountKey}
              onChange={(e) => setGcpServiceAccountKey(e.target.value)}
              margin="normal"
              required
              multiline
              rows={4}
              placeholder='{"type": "service_account", ...}'
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowSecrets(!showSecrets)} edge="end">
                      {showSecrets ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </>
        )}

        <Alert severity="warning" sx={{ mt: 3 }}>
          <Typography variant="body2">
            <strong>Security Reminder:</strong> Use read-only credentials with minimum required permissions.
            All credentials are cleared from memory when discovery completes.
          </Typography>
        </Alert>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!isFormValid()}
          startIcon={<CloudIcon />}
        >
          Start Discovery
        </Button>
      </DialogActions>
    </Dialog>
  );
};
