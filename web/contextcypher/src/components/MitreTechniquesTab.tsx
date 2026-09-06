import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Paper,
  Grid,
  useTheme,
  TextField,
  InputAdornment,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import { 
  Security, 
  Search, 
  ExpandMore,
  Timeline,
} from '@mui/icons-material';
import { MitreChip, MitreLink } from '../utils/linkUtils';

interface MitreTechniquesTabProps {
  systemAnalysis: {
    ttpSummary?: Record<string, any>;
    componentThreats?: Record<string, any[]>;
    attackPaths?: any[];
  };
}

const MitreTechniquesTab: React.FC<MitreTechniquesTabProps> = ({
  systemAnalysis,
}) => {
  const theme = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTechnique, setExpandedTechnique] = useState<string | false>(false);

  // Combine techniques from ttpSummary and extract from threats/attack paths
  const allTechniques = useMemo(() => {
    const techniques: Record<string, {
      id: string;
      name: string;
      description: string;
      tactics: string[];
      usage: {
        threats: number;
        attackPaths: number;
        components: string[];
      };
    }> = {};

    // Add from ttpSummary if available
    if (systemAnalysis.ttpSummary) {
      Object.entries(systemAnalysis.ttpSummary).forEach(([techniqueId, details]: [string, any]) => {
        techniques[techniqueId] = {
          id: techniqueId,
          name: details.name || techniqueId,
          description: details.description || 'No description available',
          tactics: details.tactics || [],
          usage: {
            threats: 0,
            attackPaths: 0,
            components: []
          }
        };
      });
    }

    // Count usage from component threats
    if (systemAnalysis.componentThreats) {
Object.entries(systemAnalysis.componentThreats).forEach(([componentId, threats]) => {
        
        threats.forEach((threat: any) => {
          if (threat.mitreTechniques) {
            threat.mitreTechniques.forEach((techniqueId: string) => {
              if (!techniques[techniqueId]) {
                techniques[techniqueId] = {
                  id: techniqueId,
                  name: techniqueId,
                  description: 'Technique identified in threat analysis',
                  tactics: [],
                  usage: {
                    threats: 0,
                    attackPaths: 0,
                    components: []
                  }
                };
              }
              
              techniques[techniqueId].usage.threats++;
              if (!techniques[techniqueId].usage.components.includes(componentId)) {
                techniques[techniqueId].usage.components.push(componentId);
              }
            });
          }
        });
      });
    }

    // Count usage from attack paths
    if (systemAnalysis.attackPaths) {
      systemAnalysis.attackPaths.forEach((path: any) => {
        if (path.mitreTechniques) {
          path.mitreTechniques.forEach((techniqueId: string) => {
            if (!techniques[techniqueId]) {
              techniques[techniqueId] = {
                id: techniqueId,
                name: techniqueId,
                description: 'Technique identified in attack path analysis',
                tactics: [],
                usage: {
                  threats: 0,
                  attackPaths: 0,
                  components: []
                }
              };
            }
            
            techniques[techniqueId].usage.attackPaths++;
          });
        }
      });
    }

    return techniques;
  }, [systemAnalysis]);

  // Filter techniques based on search term
  const filteredTechniques = useMemo(() => {
    if (!searchTerm) {
      return Object.values(allTechniques);
    }

    const searchLower = searchTerm.toLowerCase();
    return Object.values(allTechniques).filter(technique =>
      technique.id.toLowerCase().includes(searchLower) ||
      technique.name.toLowerCase().includes(searchLower) ||
      technique.description.toLowerCase().includes(searchLower) ||
      technique.tactics.some(tactic => tactic.toLowerCase().includes(searchLower))
    );
  }, [allTechniques, searchTerm]);

  // Sort techniques by usage (most used first)
  const sortedTechniques = useMemo(() => {
    return [...filteredTechniques].sort((a, b) => {
      const aUsage = a.usage.threats + a.usage.attackPaths;
      const bUsage = b.usage.threats + b.usage.attackPaths;
      return bUsage - aUsage;
    });
  }, [filteredTechniques]);

  const handleAccordionChange = (techniqueId: string) => (
    event: React.SyntheticEvent,
    isExpanded: boolean,
  ) => {
    setExpandedTechnique(isExpanded ? techniqueId : false);
  };

  if (Object.keys(allTechniques).length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          <Typography variant="h6" gutterBottom>
            No MITRE ATT&CK Techniques Identified
          </Typography>
          <Typography variant="body2">
            No specific MITRE ATT&CK techniques have been identified in the current analysis. 
            This could indicate that the system has strong security controls or that the 
            analysis did not identify specific attack techniques.
          </Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Security /> MITRE ATT&CK Technique Reference
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Detailed information about attack techniques identified in threats and attack paths
        </Typography>
      </Box>

      {/* Summary Statistics */}
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper 
            elevation={0}
            sx={{ 
              p: 3, 
              textAlign: 'center',
              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : theme.palette.grey[50],
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: theme.shadows[4],
                borderColor: theme.palette.primary.main,
              },
              animation: 'bounceIn 0.6s ease-out',
              '@keyframes bounceIn': {
                '0%': { opacity: 0, transform: 'scale(0.3)' },
                '50%': { transform: 'scale(1.05)' },
                '70%': { transform: 'scale(0.95)' },
                '100%': { opacity: 1, transform: 'scale(1)' }
              }
            }}
          >
            <Typography 
              variant="h4" 
              color="primary" 
              fontWeight="bold"
              sx={{
                transition: 'transform 0.2s ease',
                '&:hover': {
                  transform: 'scale(1.1)',
                }
              }}
            >
              {Object.keys(allTechniques).length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Techniques
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper 
            elevation={0}
            sx={{ 
              p: 3, 
              textAlign: 'center',
              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : theme.palette.grey[50],
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: theme.shadows[4],
                borderColor: theme.palette.error.main,
              },
              animation: 'bounceIn 0.6s ease-out 0.1s',
              animationFillMode: 'both',
              '@keyframes bounceIn': {
                '0%': { opacity: 0, transform: 'scale(0.3)' },
                '50%': { transform: 'scale(1.05)' },
                '70%': { transform: 'scale(0.95)' },
                '100%': { opacity: 1, transform: 'scale(1)' }
              }
            }}
          >
            <Typography 
              variant="h4" 
              color="error" 
              fontWeight="bold"
              sx={{
                transition: 'transform 0.2s ease',
                '&:hover': {
                  transform: 'scale(1.1)',
                }
              }}
            >
              {Object.values(allTechniques).reduce((sum, t) => sum + t.usage.threats, 0)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Threat References
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper 
            elevation={0}
            sx={{ 
              p: 3, 
              textAlign: 'center',
              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : theme.palette.grey[50],
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: theme.shadows[4],
                borderColor: theme.palette.warning.main,
              },
              animation: 'bounceIn 0.6s ease-out 0.2s',
              animationFillMode: 'both',
              '@keyframes bounceIn': {
                '0%': { opacity: 0, transform: 'scale(0.3)' },
                '50%': { transform: 'scale(1.05)' },
                '70%': { transform: 'scale(0.95)' },
                '100%': { opacity: 1, transform: 'scale(1)' }
              }
            }}
          >
            <Typography 
              variant="h4" 
              color="warning.main" 
              fontWeight="bold"
              sx={{
                transition: 'transform 0.2s ease',
                '&:hover': {
                  transform: 'scale(1.1)',
                }
              }}
            >
              {Object.values(allTechniques).reduce((sum, t) => sum + t.usage.attackPaths, 0)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Attack Path References
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper 
            elevation={0}
            sx={{ 
              p: 3, 
              textAlign: 'center',
              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : theme.palette.grey[50],
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: theme.shadows[4],
                borderColor: theme.palette.info.main,
              },
              animation: 'bounceIn 0.6s ease-out 0.3s',
              animationFillMode: 'both',
              '@keyframes bounceIn': {
                '0%': { opacity: 0, transform: 'scale(0.3)' },
                '50%': { transform: 'scale(1.05)' },
                '70%': { transform: 'scale(0.95)' },
                '100%': { opacity: 1, transform: 'scale(1)' }
              }
            }}
          >
            <Typography 
              variant="h4" 
              color="info.main" 
              fontWeight="bold"
              sx={{
                transition: 'transform 0.2s ease',
                '&:hover': {
                  transform: 'scale(1.1)',
                }
              }}
            >
              {new Set(Object.values(allTechniques).flatMap(t => t.usage.components)).size}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Affected Components
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Search */}
      <TextField
        placeholder="Search techniques, tactics, or descriptions..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        size="small"
        sx={{ maxWidth: 400 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      {/* Techniques List */}
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Showing {sortedTechniques.length} of {Object.keys(allTechniques).length} techniques
        </Typography>
        
        {sortedTechniques.map((technique) => (
          <Accordion 
            key={technique.id}
            expanded={expandedTechnique === technique.id}
            onChange={handleAccordionChange(technique.id)}
            sx={{ 
              mb: 1,
              borderRadius: 2,
              overflow: 'hidden',
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: theme.shadows[3],
              },
              '&.Mui-expanded': {
                boxShadow: theme.shadows[4],
                margin: '8px 0',
              },
              '&:before': {
                display: 'none',
              },
              animation: 'fadeInUp 0.4s ease-out',
              animationDelay: `${sortedTechniques.indexOf(technique) * 0.05}s`,
              animationFillMode: 'both',
              '@keyframes fadeInUp': {
                from: { opacity: 0, transform: 'translateY(20px)' },
                to: { opacity: 1, transform: 'translateY(0)' }
              }
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMore />}
              aria-controls={`${technique.id}-content`}
              id={`${technique.id}-header`}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                <MitreChip 
                  techniqueId={technique.id}
                  size="small"
                  sx={{ 
                    fontWeight: 600, 
                    minWidth: 80,
                    transition: 'transform 0.2s ease',
                    '&:hover': {
                      transform: 'scale(1.05)',
                    }
                  }}
                />
                <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>
                  <MitreLink techniqueId={technique.id} displayText={technique.name} />
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {technique.usage.threats > 0 && (
                    <Chip 
                      label={`${technique.usage.threats} threats`} 
                      size="small" 
                      color="error"
                      variant="outlined"
                    />
                  )}
                  {technique.usage.attackPaths > 0 && (
                    <Chip 
                      label={`${technique.usage.attackPaths} paths`} 
                      size="small" 
                      color="warning"
                      variant="outlined"
                    />
                  )}
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                {/* Description */}
                <Grid item xs={12} md={8}>
                  <Typography variant="body1" sx={{ lineHeight: 1.7, mb: 2 }}>
                    {technique.description}
                  </Typography>
                  
                  {technique.tactics.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Associated Tactics:
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {technique.tactics.map((tactic: string) => (
                          <Chip
                            key={tactic}
                            label={tactic}
                            size="small"
                            variant="outlined"
                            color="secondary"
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                </Grid>
                
                {/* Usage Statistics */}
                <Grid item xs={12} md={4}>
                  <Card 
                    variant="outlined"
                    sx={{
                      borderRadius: 2,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        boxShadow: theme.shadows[2],
                      }
                    }}
                  >
                    <CardHeader
                      avatar={<Timeline />}
                      title="Usage in Analysis"
                      titleTypographyProps={{ variant: 'subtitle2' }}
                    />
                    <CardContent sx={{ pt: 0 }}>
                      <List dense>
                        <ListItem sx={{ px: 0 }}>
                          <ListItemText 
                            primary={`${technique.usage.threats} threats`}
                            secondary="Uses this technique"
                          />
                        </ListItem>
                        <ListItem sx={{ px: 0 }}>
                          <ListItemText 
                            primary={`${technique.usage.attackPaths} attack paths`}
                            secondary="Reference this technique"
                          />
                        </ListItem>
                        <ListItem sx={{ px: 0 }}>
                          <ListItemText 
                            primary={`${technique.usage.components.length} components`}
                            secondary="Are affected"
                          />
                        </ListItem>
                      </List>
                      
                      {technique.usage.components.length > 0 && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Affected Components:
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {technique.usage.components.map((componentId: string) => (
                              <Chip
                                key={componentId}
                                label={componentId}
                                size="small"
                                variant="outlined"
                                color="primary"
                              />
                            ))}
                          </Box>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>

      {sortedTechniques.length === 0 && searchTerm && (
        <Alert severity="info">
          <Typography variant="body2">
            No techniques found matching "{searchTerm}". Try a different search term.
          </Typography>
        </Alert>
      )}
    </Box>
  );
};

export default MitreTechniquesTab;