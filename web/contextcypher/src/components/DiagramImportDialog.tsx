import React, { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  LinearProgress,
  Alert,
  AlertTitle,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  useTheme,
  Tabs,
  Tab
} from '@mui/material';
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  FileImage,
  FileCode,
  File,
  Cloud
} from 'lucide-react';
import { diagramImportService, DiagramFormat, ImportMode } from '../services/DiagramImportService';
import { ExampleSystem } from '../types/ExampleSystemTypes';
import { transitions } from '../styles/Theme';
import { ImportOptionsDialog, ImportOptions } from './ImportOptionsDialog';
import { CloudCredentialsDialog } from './CloudCredentialsDialog';
import { CloudDiscoveryProgress } from './CloudDiscoveryProgress';
import { CloudResourceSelector } from './CloudResourceSelector';
import { CloudCredentials, CloudResourceFilters, CloudDiscoveryProgress as CloudProgressType } from '../types/CloudTypes';
import { useSettings } from '../settings/SettingsContext';
import { isCloudDiscoveryEnabled } from '../utils/environment';

interface DiagramImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (diagram: ExampleSystem) => void;
}

interface ImportState {
  file: File | null;
  format: DiagramFormat;
  isProcessing: boolean;
  result: {
    success: boolean;
    diagram?: ExampleSystem;
    warnings?: string[];
    errors?: string[];
  } | null;
}

const FORMAT_INFO: Record<DiagramFormat, {
  name: string;
  icon: React.ReactNode;
  extensions: string[];
  description: string;
}> = {
  mermaid: {
    name: 'Mermaid',
    icon: <FileCode size={20} />,
    extensions: ['.mmd', '.mermaid'],
    description: 'Text-based diagram syntax'
  },
  drawio: {
    name: 'Draw.io / Diagrams.net',
    icon: <FileImage size={20} />,
    extensions: ['.drawio', '.xml'],
    description: 'Visual diagram editor'
  },
  plantuml: {
    name: 'PlantUML',
    icon: <FileCode size={20} />,
    extensions: ['.puml', '.plantuml'],
    description: 'Text-based UML diagrams'
  },
  lucidchart: {
    name: 'Lucidchart',
    icon: <FileText size={20} />,
    extensions: ['.csv'],
    description: 'CSV export format'
  },
  visio: {
    name: 'Microsoft Visio',
    icon: <FileImage size={20} />,
    extensions: ['.vsdx'],
    description: 'Microsoft diagram format'
  },
  graphviz: {
    name: 'Graphviz DOT',
    icon: <FileCode size={20} />,
    extensions: ['.dot', '.gv'],
    description: 'Graph description language'
  },
  json: {
    name: 'JSON',
    icon: <FileCode size={20} />,
    extensions: ['.json'],
    description: 'Generic JSON or ContextCypher export'
  },
  cloud: {
    name: 'Cloud Discovery',
    icon: <Cloud size={20} />,
    extensions: [],
    description: 'AWS, Azure, or GCP cloud resources'
  },
  unknown: {
    name: 'Unknown',
    icon: <File size={20} />,
    extensions: [],
    description: 'Unsupported format'
  }
};

const DiagramImportDialog: React.FC<DiagramImportDialogProps> = ({
  open,
  onClose,
  onImport
}) => {
  const theme = useTheme();
  const { settings } = useSettings();
  const cloudDiscoveryEnabled = isCloudDiscoveryEnabled();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ImportState>({
    file: null,
    format: 'unknown',
    isProcessing: false,
    result: null
  });

  const [dragActive, setDragActive] = useState(false);
  const [showOptionsDialog, setShowOptionsDialog] = useState(false);
  const [fileContent, setFileContent] = useState<string>('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const [importMode, setImportMode] = useState<'file' | 'cloud'>('file');
  const [showCloudCredentialsDialog, setShowCloudCredentialsDialog] = useState(false);
  const [showCloudProgress, setShowCloudProgress] = useState(false);
  const [cloudProgress, setCloudProgress] = useState<CloudProgressType>({
    status: 'initializing',
    message: '',
    percentage: 0
  });
  const [cloudFilters, setCloudFilters] = useState<CloudResourceFilters>({});

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  }, []);

  const handleFile = useCallback(async (file: File) => {
    const format = diagramImportService.detectFormat(file);
    
    // Read file content for preview
    try {
      const content = await file.text();
      setFileContent(content);
      setPendingFile(file);
      setState({
        file,
        format,
        isProcessing: false,
        result: null
      });
      
      // Show options dialog
      setShowOptionsDialog(true);
    } catch (error) {
      setState(prev => ({
        ...prev,
        isProcessing: false,
        result: {
          success: false,
          errors: [`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`]
        }
      }));
    }
  }, []);

  const handleImportWithOptions = useCallback(async (options: ImportOptions) => {
    if (!pendingFile) return;

    setShowOptionsDialog(false);
    setState(prev => ({
      ...prev,
      isProcessing: true
    }));

    try {
      const result = await diagramImportService.importDiagram(pendingFile, {
        method: options.method,
        aiProvider: options.aiProvider,
        sanitizeData: options.sanitizeData,
        importMode: options.importMode
      });

      setState(prev => ({
        ...prev,
        isProcessing: false,
        result
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isProcessing: false,
        result: {
          success: false,
          errors: [`Import error: ${error instanceof Error ? error.message : 'Unknown error'}`]
        }
      }));
    }
  }, [pendingFile]);

  const handleImport = useCallback(() => {
    if (state.result?.success && state.result.diagram) {
      onImport(state.result.diagram);
      handleClose();
    }
  }, [state.result, onImport]);

  const handleClose = useCallback(() => {
    setState({
      file: null,
      format: 'unknown',
      isProcessing: false,
      result: null
    });
    setShowOptionsDialog(false);
    setFileContent('');
    setPendingFile(null);
    setShowCloudCredentialsDialog(false);
    setShowCloudProgress(false);
    setCloudProgress({ status: 'initializing', message: '', percentage: 0 });
    diagramImportService.cancelCloudDiscovery();
    onClose();
  }, [onClose]);

  const handleCloudImport = useCallback(async (credentials: CloudCredentials, importMode: ImportMode) => {
    setShowCloudCredentialsDialog(false);
    setShowCloudProgress(true);

    try {
      const result = await diagramImportService.importFromCloud(
        credentials,
        cloudFilters,
        (progress) => setCloudProgress(progress),
        importMode
      );

      setState(prev => ({
        ...prev,
        format: 'cloud',
        isProcessing: false,
        result
      }));

      if (result.success && result.diagram) {
        setTimeout(() => {
          setShowCloudProgress(false);
        }, 2000);
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isProcessing: false,
        result: {
          success: false,
          errors: [`Cloud import failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
        }
      }));
      setShowCloudProgress(false);
    }
  }, [cloudFilters]);

  const handleCancelCloudDiscovery = useCallback(() => {
    diagramImportService.cancelCloudDiscovery();
    setShowCloudProgress(false);
    setCloudProgress({ status: 'initializing', message: 'Discovery cancelled', percentage: 0 });
  }, []);

  const formatInfo = FORMAT_INFO[state.format];
  const effectiveImportMode = cloudDiscoveryEnabled ? importMode : 'file';
  const supportedFormats = Object.entries(FORMAT_INFO).filter(
    ([key]) => key !== 'unknown' && (cloudDiscoveryEnabled || key !== 'cloud')
  );

  return (
    <>
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: theme.colors.surface,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '16px',
          color: theme.colors.textPrimary
        }
      }}
    >
      <DialogTitle sx={{
        borderBottom: `1px solid ${theme.colors.border}`,
        pb: 0
      }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
          Import Diagram
        </Typography>
        {cloudDiscoveryEnabled && (
          <Tabs
            value={importMode}
            onChange={(_, value) => setImportMode(value)}
            sx={{
              '& .MuiTab-root': {
                minHeight: 48,
                textTransform: 'none'
              }
            }}
          >
            <Tab
              value="file"
              label="File Import"
              icon={<Upload size={18} />}
              iconPosition="start"
            />
            <Tab
              value="cloud"
              label="Cloud Discovery"
              icon={<Cloud size={18} />}
              iconPosition="start"
            />
          </Tabs>
        )}
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {effectiveImportMode === 'file' && !state.file ? (
          <>
            {/* File upload area */}
            <Paper
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              sx={{
                p: 4,
                border: `2px dashed ${dragActive ? theme.colors.primary : theme.colors.border}`,
                borderRadius: '12px',
                backgroundColor: dragActive ? `${theme.colors.primary}10` : theme.colors.background,
                cursor: 'pointer',
                textAlign: 'center',
                transition: transitions.default,
                '&:hover': {
                  borderColor: theme.colors.primary,
                  backgroundColor: `${theme.colors.primary}05`
                }
              }}
            >
              <Upload size={48} color={theme.colors.textSecondary} style={{ marginBottom: 16 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>
                Drag & drop your diagram file here
              </Typography>
              <Typography variant="body2" sx={{ color: theme.colors.textSecondary, mb: 3 }}>
                or click to browse files
              </Typography>
              
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                {supportedFormats.map(([key, info]) => (
                  <Chip
                    key={key}
                    label={info.name}
                    size="small"
                    icon={info.icon as any}
                    sx={{
                      backgroundColor: `${theme.colors.primary}15`,
                      color: theme.colors.primary,
                      '& .MuiChip-icon': {
                        color: theme.colors.primary
                      }
                    }}
                  />
                ))}
              </Box>
            </Paper>

            {/* Supported formats list */}
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                Supported Formats
              </Typography>
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 1
              }}>
                {supportedFormats.map(([key, info]) => (
                  <Box 
                    key={key} 
                    sx={{ 
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1.5,
                      p: 1.5,
                      borderRadius: '8px',
                      '&:hover': {
                        backgroundColor: theme.colors.surfaceHover
                      }
                    }}
                  >
                    <Box sx={{ mt: 0.5, color: theme.colors.textSecondary }}>
                      {info.icon}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                        {info.name}
                      </Typography>
                      <Typography variant="caption" sx={{ 
                        color: theme.colors.textSecondary,
                        display: 'block',
                        mt: 0.5
                      }}>
                        {info.description}
                      </Typography>
                      <Typography variant="caption" sx={{ 
                        color: theme.colors.textSecondary,
                        fontFamily: 'monospace',
                        fontSize: '0.7rem'
                      }}>
                        {info.extensions.join(', ')}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </>
        ) : (
          <>
            {/* File info */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                {formatInfo.icon}
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {state.file?.name || 'Unknown'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: theme.colors.textSecondary }}>
                    {formatInfo.name} • {state.file ? (state.file.size / 1024).toFixed(1) : '0'} KB
                  </Typography>
                </Box>
              </Box>
              
              {state.isProcessing && (
                <LinearProgress sx={{ borderRadius: 1 }} />
              )}
            </Box>

            {/* Results */}
            {state.result && (
              <Box sx={{ mb: 3 }}>
                {state.result.success ? (
                  <Alert
                    severity="success"
                    icon={<CheckCircle />}
                    sx={{
                      backgroundColor: `${theme.colors.success}15`,
                      color: theme.colors.textPrimary,
                      '& .MuiAlert-icon': {
                        color: theme.colors.success
                      }
                    }}
                  >
                    <AlertTitle>Import Successful</AlertTitle>
                    Diagram has been successfully converted to ContextCypher format
                  </Alert>
                ) : (
                  <Alert
                    severity="error"
                    icon={<XCircle />}
                    sx={{
                      backgroundColor: `${theme.colors.error}15`,
                      color: theme.colors.textPrimary,
                      '& .MuiAlert-icon': {
                        color: theme.colors.error
                      }
                    }}
                  >
                    <AlertTitle>Import Failed</AlertTitle>
                    {state.result.errors?.map((error, i) => (
                      <Typography key={i} variant="body2">
                        {error}
                      </Typography>
                    ))}
                  </Alert>
                )}

                {state.result.warnings && state.result.warnings.length > 0 && (
                  <Alert
                    severity="warning"
                    icon={<AlertTriangle />}
                    sx={{
                      mt: 2,
                      backgroundColor: `${theme.colors.warning}15`,
                      color: theme.colors.textPrimary,
                      '& .MuiAlert-icon': {
                        color: theme.colors.warning
                      }
                    }}
                  >
                    <AlertTitle>Warnings</AlertTitle>
                    {state.result.warnings.map((warning, i) => (
                      <Typography key={i} variant="body2">
                        • {warning}
                      </Typography>
                    ))}
                  </Alert>
                )}

                {state.result.success && state.result.diagram && (
                  <Box sx={{ mt: 2, p: 2, backgroundColor: theme.colors.background, borderRadius: '8px' }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Import Summary
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.colors.textSecondary }}>
                      • Nodes: {state.result.diagram.nodes.length}<br />
                      • Connections: {state.result.diagram.edges.length}<br />
                      • Primary Zone: {state.result.diagram.primaryZone}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </>
        )}

        {cloudDiscoveryEnabled && effectiveImportMode === 'cloud' && (
          <>
            <Alert severity="info" icon={<Info />} sx={{ mb: 3 }}>
              <AlertTitle>Cloud Service Discovery</AlertTitle>
              Connect to your AWS, Azure, or GCP account to automatically discover and import cloud infrastructure as a diagram.
              Credentials are session-only and never stored.
            </Alert>

            <Button
              variant="contained"
              startIcon={<Cloud />}
              onClick={() => setShowCloudCredentialsDialog(true)}
              sx={{ mb: 2 }}
              fullWidth
            >
              Start Cloud Discovery
            </Button>

            {state.result && effectiveImportMode === 'cloud' && (
              <Box sx={{ mb: 3 }}>
                {state.result.success ? (
                  <Alert
                    severity="success"
                    icon={<CheckCircle />}
                    sx={{
                      backgroundColor: `${theme.colors.success}15`,
                      color: theme.colors.textPrimary,
                      '& .MuiAlert-icon': {
                        color: theme.colors.success
                      }
                    }}
                  >
                    <AlertTitle>Discovery Successful</AlertTitle>
                    Cloud resources have been successfully mapped to vendor-specific nodes
                  </Alert>
                ) : (
                  <Alert
                    severity="error"
                    icon={<XCircle />}
                    sx={{
                      backgroundColor: `${theme.colors.error}15`,
                      color: theme.colors.textPrimary,
                      '& .MuiAlert-icon': {
                        color: theme.colors.error
                      }
                    }}
                  >
                    <AlertTitle>Discovery Failed</AlertTitle>
                    {state.result.errors?.map((error, i) => (
                      <Typography key={i} variant="body2">
                        {error}
                      </Typography>
                    ))}
                  </Alert>
                )}

                {state.result.success && state.result.diagram && (
                  <Box sx={{ mt: 2, p: 2, backgroundColor: theme.colors.background, borderRadius: '8px' }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Discovery Summary
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.colors.textSecondary }}>
                      • Cloud Resources: {state.result.diagram.nodes.filter(n => n.type !== 'securityZone').length}<br />
                      • Connections: {state.result.diagram.edges.length}<br />
                      • Security Zones: {state.result.diagram.nodes.filter(n => n.type === 'securityZone').length}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          accept=".mmd,.mermaid,.drawio,.xml,.puml,.plantuml,.csv,.vsdx,.dot,.gv,.json,*"
          onChange={handleFileSelect}
        />
      </DialogContent>

      <DialogActions sx={{
        borderTop: `1px solid ${theme.colors.border}`,
        p: 3,
        gap: 2
      }}>
        <Button
          onClick={handleClose}
          sx={{
            color: theme.colors.textSecondary,
            '&:hover': {
              backgroundColor: theme.colors.surfaceHover
            }
          }}
        >
          Cancel
        </Button>
        
        {state.file && !state.result?.success && !state.isProcessing && (
          <Button
            onClick={() => state.file && handleFile(state.file)}
            variant="outlined"
            sx={{
              borderColor: theme.colors.primary,
              color: theme.colors.primary,
              '&:hover': {
                backgroundColor: `${theme.colors.primary}10`
              }
            }}
          >
            Retry
          </Button>
        )}
        
        {state.result?.success && (
          <>
            <Button
              onClick={() => setState({ ...state, file: null, result: null })}
              sx={{
                color: theme.colors.textSecondary,
                '&:hover': {
                  backgroundColor: theme.colors.surfaceHover
                }
              }}
            >
              Import Another
            </Button>
            <Button
              onClick={handleImport}
              variant="contained"
              startIcon={<Upload size={18} />}
              sx={{
                backgroundColor: theme.colors.primary,
                '&:hover': {
                  backgroundColor: theme.colors.secondary
                }
              }}
            >
              Create Diagram
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>

    {showOptionsDialog && pendingFile && (
      <ImportOptionsDialog
        open={showOptionsDialog}
        onClose={() => {
          setShowOptionsDialog(false);
          setPendingFile(null);
          setFileContent('');
        }}
        onConfirm={handleImportWithOptions}
        fileName={pendingFile.name}
        fileContent={fileContent}
        format={state.format}
      />
    )}

    {cloudDiscoveryEnabled && (
      <>
        <CloudCredentialsDialog
          open={showCloudCredentialsDialog}
          onClose={() => setShowCloudCredentialsDialog(false)}
          onSubmit={handleCloudImport}
        />

        <CloudDiscoveryProgress
          open={showCloudProgress}
          progress={cloudProgress}
          onCancel={handleCancelCloudDiscovery}
          canCancel={cloudProgress.status !== 'completed' && cloudProgress.status !== 'error'}
        />
      </>
    )}
  </>
  );
};

export default DiagramImportDialog;
