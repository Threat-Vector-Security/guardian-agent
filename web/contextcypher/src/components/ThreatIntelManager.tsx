import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  Paper, 
  Grid, 
  Alert, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  TextField, 
  Card, 
  CardContent, 
  Chip, 
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Collapse
} from '@mui/material';
import { 
  CloudDownload, 
  Storage, 
  Refresh, 
  Upload, 
  ClearAll, 
  ExpandMore,
  ExpandLess,
  InfoOutlined,
  SecurityOutlined,
  BugReportOutlined,
  WarningOutlined
} from '@mui/icons-material';
import { useSettings } from '../settings/SettingsContext';
import { api } from '../api';

interface DatabaseInfo {
  mitre: {
    techniques: number;
    tactics: number;
    lastUpdated: string;
    version: string;
  };
  vulnerabilities: {
    count: number;
    lastUpdated: string;
    version: string;
  };
  advisories: {
    count: number;
    lastUpdated: string;
    version: string;
  };
  patterns: {
    count: number;
    lastUpdated: string;
    version: string;
  };
  mode: string;
  lastInitialized: string;
}

interface UpdatePackage {
  metadata: {
    version: string;
    timestamp: string;
    description: string;
  };
  data: {
    mitre?: any;
    vulnerabilities?: any;
    advisories?: any;
    patterns?: any;
  };
}

const ThreatIntelManager: React.FC = () => {
  const { settings } = useSettings();
  const [databaseInfo, setDatabaseInfo] = useState<DatabaseInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updatePackage, setUpdatePackage] = useState<string>('');
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({});

  const isOfflineMode = settings.api.llmMode === 'local' || settings.api.provider === 'local';

  useEffect(() => {
    if (isOfflineMode) {
      loadDatabaseInfo();
    }
  }, [isOfflineMode]);

  const loadDatabaseInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/threat-intel/database-info');
      setDatabaseInfo(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load database information');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDatabase = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const updateData: UpdatePackage = JSON.parse(updatePackage);
      
      const response = await api.post('/api/threat-intel/update-database', updateData);
      
      setSuccess(`Database updated successfully to version ${response.data.version}`);
      setShowUpdateDialog(false);
      setUpdatePackage('');
      
      // Reload database info
      await loadDatabaseInfo();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update database');
    } finally {
      setLoading(false);
    }
  };

  const handleClearCache = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      await api.post('/api/threat-intel/clear-cache');
      
      setSuccess('Cache cleared successfully');
      
      // Reload database info
      await loadDatabaseInfo();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to clear cache');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        try {
          // Validate JSON
          JSON.parse(content);
          setUpdatePackage(content);
        } catch (error) {
          setError('Invalid JSON file format');
        }
      };
      reader.readAsText(file);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const getSeverityColor = (count: number) => {
    if (count === 0) return 'default';
    if (count < 10) return 'warning';
    if (count < 50) return 'info';
    return 'success';
  };

  if (!isOfflineMode) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          <Typography variant="h6">Online Mode Active</Typography>
          <Typography>
            Threat intelligence database management is only available in offline mode. 
            Switch to local LLM in settings to access offline features.
          </Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
        <Storage sx={{ mr: 2 }} />
        Threat Intelligence Database Manager
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Manage your offline threat intelligence database with manual updates for air-gapped environments.
      </Typography>

      {/* Actions */}
      <Box sx={{ mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<Refresh />}
          onClick={loadDatabaseInfo}
          disabled={loading}
          sx={{ mr: 2 }}
        >
          Refresh Info
        </Button>
        
        <Button
          variant="contained"
          startIcon={<Upload />}
          onClick={() => setShowUpdateDialog(true)}
          disabled={loading}
          sx={{ mr: 2 }}
        >
          Update Database
        </Button>
        
        <Button
          variant="outlined"
          startIcon={<ClearAll />}
          onClick={handleClearCache}
          disabled={loading}
          color="warning"
        >
          Clear Cache
        </Button>
      </Box>

      {/* Progress Bar */}
      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Error/Success Messages */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Database Overview */}
      {databaseInfo && (
        <Grid container spacing={3}>
          {/* Summary Cards */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <SecurityOutlined sx={{ mr: 1 }} />
                  <Typography variant="h6">MITRE ATT&CK</Typography>
                </Box>
                <Typography variant="h3" color="primary">
                  {databaseInfo.mitre.techniques}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Techniques ({databaseInfo.mitre.tactics} tactics)
                </Typography>
                <Chip 
                  label={databaseInfo.mitre.version}
                  size="small"
                  sx={{ mt: 1 }}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <BugReportOutlined sx={{ mr: 1 }} />
                  <Typography variant="h6">Vulnerabilities</Typography>
                </Box>
                <Typography variant="h3" color="warning.main">
                  {databaseInfo.vulnerabilities.count}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Critical vulnerabilities
                </Typography>
                <Chip 
                  label={databaseInfo.vulnerabilities.version}
                  size="small"
                  sx={{ mt: 1 }}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <WarningOutlined sx={{ mr: 1 }} />
                  <Typography variant="h6">Security Advisories</Typography>
                </Box>
                <Typography variant="h3" color="error.main">
                  {databaseInfo.advisories.count}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Package advisories
                </Typography>
                <Chip 
                  label={databaseInfo.advisories.version}
                  size="small"
                  sx={{ mt: 1 }}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <InfoOutlined sx={{ mr: 1 }} />
                  <Typography variant="h6">Threat Patterns</Typography>
                </Box>
                <Typography variant="h3" color="info.main">
                  {databaseInfo.patterns.count}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Attack patterns
                </Typography>
                <Chip 
                  label={databaseInfo.patterns.version}
                  size="small"
                  sx={{ mt: 1 }}
                />
              </CardContent>
            </Card>
          </Grid>

          {/* Detailed Information */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Database Details</Typography>
                <IconButton
                  onClick={() => toggleSection('details')}
                  sx={{ ml: 'auto' }}
                >
                  {expandedSections.details ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Box>
              
              <Collapse in={expandedSections.details}>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Source</TableCell>
                        <TableCell>Count</TableCell>
                        <TableCell>Version</TableCell>
                        <TableCell>Last Updated</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell>MITRE ATT&CK</TableCell>
                        <TableCell>
                          <Chip 
                            label={`${databaseInfo.mitre.techniques} techniques`}
                            color={getSeverityColor(databaseInfo.mitre.techniques)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{databaseInfo.mitre.version}</TableCell>
                        <TableCell>{formatDate(databaseInfo.mitre.lastUpdated)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Vulnerabilities</TableCell>
                        <TableCell>
                          <Chip 
                            label={`${databaseInfo.vulnerabilities.count} CVEs`}
                            color={getSeverityColor(databaseInfo.vulnerabilities.count)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{databaseInfo.vulnerabilities.version}</TableCell>
                        <TableCell>{formatDate(databaseInfo.vulnerabilities.lastUpdated)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Security Advisories</TableCell>
                        <TableCell>
                          <Chip 
                            label={`${databaseInfo.advisories.count} advisories`}
                            color={getSeverityColor(databaseInfo.advisories.count)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{databaseInfo.advisories.version}</TableCell>
                        <TableCell>{formatDate(databaseInfo.advisories.lastUpdated)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Threat Patterns</TableCell>
                        <TableCell>
                          <Chip 
                            label={`${databaseInfo.patterns.count} patterns`}
                            color={getSeverityColor(databaseInfo.patterns.count)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{databaseInfo.patterns.version}</TableCell>
                        <TableCell>{formatDate(databaseInfo.patterns.lastUpdated)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
                
                <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Database Mode:</strong> {databaseInfo.mode}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Last Initialized:</strong> {formatDate(databaseInfo.lastInitialized)}
                  </Typography>
                </Box>
              </Collapse>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Update Dialog */}
      <Dialog 
        open={showUpdateDialog} 
        onClose={() => setShowUpdateDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Update Threat Intelligence Database</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Upload a JSON update package to update your offline threat intelligence database.
            The update package should contain metadata and data sections.
          </Typography>
          
          <Box sx={{ mb: 2 }}>
            <input
              accept=".json"
              style={{ display: 'none' }}
              id="update-file-input"
              type="file"
              onChange={handleFileUpload}
            />
            <label htmlFor="update-file-input">
              <Button variant="outlined" component="span" startIcon={<CloudDownload />}>
                Load from File
              </Button>
            </label>
          </Box>
          
          <TextField
            label="Update Package (JSON)"
            multiline
            rows={12}
            value={updatePackage}
            onChange={(e) => setUpdatePackage(e.target.value)}
            fullWidth
            placeholder={`{
  "metadata": {
    "version": "1.1.0",
    "timestamp": "2025-01-07T12:00:00Z",
    "description": "Updated threat intelligence data"
  },
  "data": {
    "mitre": { ... },
    "vulnerabilities": { ... },
    "advisories": { ... },
    "patterns": { ... }
  }
}`}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowUpdateDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleUpdateDatabase}
            variant="contained"
            disabled={!updatePackage.trim() || loading}
          >
            Update Database
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ThreatIntelManager; 