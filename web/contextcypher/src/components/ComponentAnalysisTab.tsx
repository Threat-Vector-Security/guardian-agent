import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  Collapse,
  useTheme,
  Stack,
  Tooltip,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination,
  Paper,
} from '@mui/material';
import {
  Warning,
  BugReport,
  Route,
  Lightbulb,
  ExpandMore,
  ExpandLess,
  CenterFocusStrong,
  Security,
  Search,
  FilterList,
  SearchOff,
} from '@mui/icons-material';
import { MitreChip, CveChip } from '../utils/linkUtils';
import { getRiskColor } from './grc/grcShared';

interface ComponentAnalysisTabProps {
  systemAnalysis: {
    componentThreats?: Record<string, any[]>;
    analyzedComponents?: Array<{
      nodeId: string;
      nodeLabel: string;
      indexCode: string;
      threatsCount: number;
      vulnerabilitiesCount: number;
      hasAnalysis: boolean;
    }>;
    vulnerabilities?: any[];
    attackPaths?: any[];
    recommendations?: any[];
  };
  onComponentClick: (componentId: string) => void;
  nodes: any[];
  expandAll?: boolean;
}

const ITEMS_PER_PAGE = 10;

const ComponentAnalysisTab: React.FC<ComponentAnalysisTabProps> = ({
  systemAnalysis,
  onComponentClick,
  nodes,
  expandAll = false,
}) => {
  const theme = useTheme();
  const [expandedComponents, setExpandedComponents] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Process data to group by component
  const { components: componentData, zoneMap, availableRisks } = useMemo(() => {
    if (process.env.NODE_ENV === 'development') console.log('[ComponentAnalysisTab] Processing component data');
    
    const components: Record<string, {
      id: string;
      label: string;
      zone: string;
      threats: any[];
      vulnerabilities: any[];
      attackPathsFrom: any[];
      attackPathsTo: any[];
      recommendations: any[];
      mitreTechniques: Set<string>;
      highestRisk: string;
    }> = {};
    
    const zoneMap: Record<string, string[]> = {};
    const riskSet = new Set<string>();
    
    try {
      // Initialize components from analyzedComponents if available
      if (systemAnalysis?.analyzedComponents) {
        systemAnalysis.analyzedComponents.forEach(analyzedComp => {
          const node = nodes.find(n => n.id === analyzedComp.nodeId);
          
          if (!components[analyzedComp.nodeId]) {
            components[analyzedComp.nodeId] = {
              id: analyzedComp.nodeId,
              label: analyzedComp.nodeLabel,
              zone: node?.data?.zone || 'Unknown',
              threats: [],
              vulnerabilities: [],
              attackPathsFrom: [],
              attackPathsTo: [],
              recommendations: [],
              mitreTechniques: new Set(),
              highestRisk: 'Sustainable',
            };
            
            // Track zones
            const zone = components[analyzedComp.nodeId].zone || 'Unknown';
            if (!zoneMap[zone]) {
              zoneMap[zone] = [];
            }
            if (!zoneMap[zone].includes(analyzedComp.nodeId)) {
              zoneMap[zone].push(analyzedComp.nodeId);
            }
          }
        });
      }
      
      // Initialize components from threats (this will update existing components or add new ones)
      if (systemAnalysis?.componentThreats) {
        Object.entries(systemAnalysis.componentThreats).forEach(([componentId, threats]) => {
          const node = nodes.find(n => n.id === componentId) || 
                       nodes.find(n => n.data?.label === componentId);
          
          if (!components[componentId]) {
            components[componentId] = {
              id: node?.id || componentId,
              label: node?.data?.label || componentId,
              zone: node?.data?.zone || 'Unknown',
              threats: [],
              vulnerabilities: [],
              attackPathsFrom: [],
              attackPathsTo: [],
              recommendations: [],
              mitreTechniques: new Set(),
              highestRisk: 'Sustainable',
            };
          }
          
          components[componentId].threats = threats;
          
          // Track zones
          const zone = components[componentId].zone || 'Unknown';
          if (!zoneMap[zone]) {
            zoneMap[zone] = [];
          }
          if (!zoneMap[zone].includes(componentId)) {
            zoneMap[zone].push(componentId);
          }
          
          // Calculate highest risk and collect all risks
          let highestRisk = 'Sustainable';
          const riskOrder = ['Extreme', 'High', 'Medium', 'Minor', 'Sustainable'];
          threats.forEach((threat: any) => {
            if (threat.risk) {
              riskSet.add(threat.risk);
              if (riskOrder.indexOf(threat.risk) < riskOrder.indexOf(highestRisk)) {
                highestRisk = threat.risk;
              }
            }
            
            // Extract MITRE techniques
            if (threat.mitreTechniques) {
              threat.mitreTechniques.forEach((technique: string) => {
                components[componentId].mitreTechniques.add(technique);
              });
            }
          });
          components[componentId].highestRisk = highestRisk;
        });
      }

      // Process vulnerabilities
      if (systemAnalysis.vulnerabilities && Array.isArray(systemAnalysis.vulnerabilities)) {
        systemAnalysis.vulnerabilities.forEach((vuln: any) => {
          const affectedNodes = vuln.affectedComponents || (vuln.affectedNode ? [vuln.affectedNode] : []);
          
          affectedNodes.forEach((componentLabel: string) => {
            const component = Object.values(components).find(c => 
              c.label === componentLabel || c.id === componentLabel
            );
            if (component) {
              component.vulnerabilities.push(vuln);
            }
          });
        });
      }

      // Process attack paths
      if (systemAnalysis.attackPaths && Array.isArray(systemAnalysis.attackPaths)) {
        systemAnalysis.attackPaths.forEach((attackPath: any) => {
          if (attackPath.path && Array.isArray(attackPath.path) && attackPath.path.length > 0) {
            const sourceName = attackPath.path[0];
            const targetName = attackPath.path[attackPath.path.length - 1];
            
            const sourceComponent = Object.values(components).find(c => 
              c.label === sourceName || c.id === sourceName
            );
            if (sourceComponent) {
              sourceComponent.attackPathsFrom.push({
                ...attackPath,
                source: sourceName,
                target: targetName,
                pathString: attackPath.path.join(' → ')
              });
            }

            const targetComponent = Object.values(components).find(c => 
              c.label === targetName || c.id === targetName
            );
            if (targetComponent && targetComponent !== sourceComponent) {
              targetComponent.attackPathsTo.push({
                ...attackPath,
                source: sourceName,
                target: targetName,
                pathString: attackPath.path.join(' → ')
              });
            }
          }
        });
      }

      // Process recommendations
      if (systemAnalysis.recommendations && Array.isArray(systemAnalysis.recommendations)) {
        systemAnalysis.recommendations.forEach((rec: any) => {
          Object.values(components).forEach(component => {
            if (rec.action && rec.action.includes(component.label)) {
              component.recommendations.push(rec);
            }
          });
        });
      }
      
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error('[ComponentAnalysisTab] Error processing data:', error);
    }

    return { 
      components, 
      zoneMap, 
      availableRisks: Array.from(riskSet).sort((a, b) => {
        const riskOrder = ['Extreme', 'High', 'Medium', 'Minor', 'Sustainable'];
        return riskOrder.indexOf(a) - riskOrder.indexOf(b);
      })
    };
  }, [systemAnalysis, nodes]);

  // Filter and search components
  const filteredComponents = useMemo(() => {
    let filtered = Object.values(componentData);

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(component =>
        component.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        component.zone.toLowerCase().includes(searchTerm.toLowerCase()) ||
        component.threats.some(threat => 
          threat.description?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply risk filter
    if (riskFilter !== 'all') {
      filtered = filtered.filter(component => component.highestRisk === riskFilter);
    }

    // Apply zone filter
    if (zoneFilter !== 'all') {
      filtered = filtered.filter(component => component.zone === zoneFilter);
    }

    return filtered;
  }, [componentData, searchTerm, riskFilter, zoneFilter]);

  // Paginate results
  const paginatedComponents = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredComponents.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredComponents, currentPage]);

  const totalPages = Math.ceil(filteredComponents.length / ITEMS_PER_PAGE);

  const toggleComponent = (componentId: string) => {
    setExpandedComponents(prev => ({
      ...prev,
      [componentId]: !prev[componentId],
    }));
  };

  const handleComponentFocus = (componentId: string) => {
    onComponentClick(componentId);
  };

  const handlePageChange = (_: React.ChangeEvent<unknown>, page: number) => {
    setCurrentPage(page);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setRiskFilter('all');
    setZoneFilter('all');
    setCurrentPage(1);
  };

  if (Object.keys(componentData).length === 0) {
    return (
      <Box sx={{ p: 6, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <SearchOff sx={{ fontSize: 48, color: 'text.disabled' }} />
        <Typography variant="h6" color="text.secondary">
          No Component Analysis Data
        </Typography>
        <Typography variant="body2" color="text.disabled" sx={{ maxWidth: 400 }}>
          Run a threat analysis on your system diagram to see per-component security findings, vulnerabilities, and attack paths.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Search and Filter Controls */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: 3, 
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 2,
          background: theme.palette.mode === 'dark' 
            ? 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%)'
            : 'linear-gradient(135deg, rgba(0,0,0,0.01) 0%, rgba(0,0,0,0.02) 100%)',
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: theme.shadows[2],
            transform: 'translateY(-1px)',
          }
        }}
      >
        <Typography variant="h6" gutterBottom sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          fontWeight: 600,
          '& svg': {
            fontSize: '1.4rem',
            color: theme.palette.primary.main,
          }
        }}>
          <Security /> Component Security Analysis
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            placeholder="Search components, zones, or threats..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ minWidth: 300 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Risk Level</InputLabel>
            <Select
              value={riskFilter}
              label="Risk Level"
              onChange={(e) => setRiskFilter(e.target.value)}
            >
              <MenuItem value="all">All Risks</MenuItem>
              {availableRisks.map(risk => (
                <MenuItem key={risk} value={risk}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: getRiskColor(risk),
                      }}
                    />
                    {risk}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Zone</InputLabel>
            <Select
              value={zoneFilter}
              label="Zone"
              onChange={(e) => setZoneFilter(e.target.value)}
            >
              <MenuItem value="all">All Zones</MenuItem>
              {Object.keys(zoneMap).sort().map(zone => (
                <MenuItem key={zone} value={zone}>{zone}</MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {(searchTerm || riskFilter !== 'all' || zoneFilter !== 'all') && (
            <Button 
              variant="outlined" 
              size="small" 
              onClick={clearFilters}
              startIcon={<FilterList />}
            >
              Clear Filters
            </Button>
          )}
        </Box>
        
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Showing {filteredComponents.length} of {Object.keys(componentData).length} components
        </Typography>
      </Paper>

      {/* Component List */}
      <Box>
        {paginatedComponents.map(data => {
          const isExpanded = expandAll || expandedComponents[data.id] || false;
          const totalIssues = data.threats.length + data.vulnerabilities.length;

          return (
            <Card 
              key={data.id} 
              variant="outlined" 
              sx={{ 
                mb: 2,
                borderRadius: 2,
                transition: 'all 0.3s ease',
                borderColor: theme.palette.divider,
                backgroundColor: theme.palette.mode === 'dark'
                  ? 'rgba(255,255,255,0.01)'
                  : theme.palette.background.paper,
                '&:hover': {
                  transform: 'translateX(4px)',
                  boxShadow: theme.shadows[4],
                  borderColor: theme.palette.primary.main,
                  '& .MuiCardHeader-root': {
                    backgroundColor: theme.palette.mode === 'dark'
                      ? 'rgba(255,255,255,0.03)'
                      : theme.palette.grey[50],
                  }
                },
                animation: 'fadeInSlide 0.3s ease-in',
                '@keyframes fadeInSlide': {
                  from: { opacity: 0, transform: 'translateX(-20px)' },
                  to: { opacity: 1, transform: 'translateX(0)' }
                }
              }}
            >
              <CardHeader
                title={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                      {data.label}
                    </Typography>
                    <Chip 
                      label={data.zone} 
                      size="small" 
                      variant="outlined"
                      color="primary"
                    />
                    {totalIssues > 0 && (
                      <Chip 
                        label={`${totalIssues} issues`} 
                        size="small" 
                        color="error" 
                      />
                    )}
                    {data.highestRisk !== 'Sustainable' && (
                      <Chip 
                        label={`Highest Risk: ${data.highestRisk}`} 
                        size="small" 
                        sx={{ 
                          backgroundColor: getRiskColor(data.highestRisk), 
                          color: '#fff' 
                        }} 
                      />
                    )}
                  </Box>
                }
                action={
                  <Box>
                    <Tooltip title="Center on Diagram" arrow>
                      <IconButton 
                        size="small" 
                        onClick={() => handleComponentFocus(data.id)}
                        sx={{
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            backgroundColor: theme.palette.primary.main,
                            color: theme.palette.primary.contrastText,
                            transform: 'scale(1.1)',
                          }
                        }}
                      >
                        <CenterFocusStrong />
                      </IconButton>
                    </Tooltip>
                    <IconButton
                      size="small"
                      onClick={() => toggleComponent(data.id)}
                      sx={{
                        transition: 'transform 0.3s ease',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    >
                      <ExpandMore />
                    </IconButton>
                  </Box>
                }
              />
              
              <Collapse 
                in={isExpanded} 
                timeout={600}
                unmountOnExit
                sx={{
                  '& .MuiCollapse-wrapperInner': {
                    animation: isExpanded ? 'expandIn 0.3s ease-out' : 'none',
                  },
                  '@keyframes expandIn': {
                    from: { opacity: 0, transform: 'translateY(-10px)' },
                    to: { opacity: 1, transform: 'translateY(0)' }
                  }
                }}
              >
                <CardContent>
                  <Stack spacing={3}>
                    {/* Threats */}
                    {data.threats.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Warning color="error" fontSize="small" /> Threats ({data.threats.length})
                        </Typography>
                        <List dense>
                          {data.threats.map((threat, index) => (
                            <ListItem key={index} sx={{ pl: 0 }}>
                              <ListItemText
                                primary={threat.description}
                                secondary={
                                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                                    <Chip label={`L: ${threat.likelihood}`} size="small" variant="outlined" />
                                    <Chip label={`I: ${threat.impact}`} size="small" variant="outlined" />
                                    <Chip 
                                      label={`R: ${threat.risk}`} 
                                      size="small" 
                                      sx={{ 
                                        backgroundColor: getRiskColor(threat.risk), 
                                        color: '#fff' 
                                      }} 
                                    />
                                    {threat.mitreTechniques?.map((technique: string) => (
                                      <MitreChip 
                                        key={technique} 
                                        techniqueId={technique}
                                        size="small" 
                                        variant="outlined" 
                                        color="primary" 
                                      />
                                    ))}
                                  </Box>
                                }
                              />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}

                    {/* Vulnerabilities */}
                    {data.vulnerabilities.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <BugReport color="warning" fontSize="small" /> Vulnerabilities ({data.vulnerabilities.length})
                        </Typography>
                        <List dense>
                          {data.vulnerabilities.map((vuln, index) => (
                            <ListItem key={index} sx={{ pl: 0 }}>
                              <ListItemText
                                primary={vuln.description}
                                secondary={
                                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                                    {vuln.cve && <CveChip cveId={vuln.cve} size="small" />}
                                    {vuln.cvss && <Chip label={`CVSS: ${vuln.cvss}`} size="small" color="warning" />}
                                  </Box>
                                }
                              />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}

                    {/* Attack Paths */}
                    {(data.attackPathsFrom.length > 0 || data.attackPathsTo.length > 0) && (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Route color="error" fontSize="small" /> Attack Paths
                        </Typography>
                        <List dense>
                          {data.attackPathsFrom.map((path, index) => (
                            <ListItem key={`from-${index}`} sx={{ pl: 0 }}>
                              <ListItemText
                                primary={
                                  <Typography variant="body2">
                                    <strong>Path:</strong> {path.pathString || `→ ${path.target}`}
                                  </Typography>
                                }
                                secondary={
                                  <Box sx={{ mt: 0.5 }}>
                                    {path.description && (
                                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                        {path.description}
                                      </Typography>
                                    )}
                                    {(path.likelihood || path.impact || path.risk) && (
                                      <Box sx={{ display: 'flex', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                                        {path.likelihood && <Chip label={`L: ${path.likelihood}`} size="small" />}
                                        {path.impact && <Chip label={`I: ${path.impact}`} size="small" />}
                                        {path.risk && <Chip label={`R: ${path.risk}`} size="small" sx={{ backgroundColor: getRiskColor(path.risk), color: '#fff' }} />}
                                      </Box>
                                    )}
                                    {path.mitreTechniques?.length > 0 && (
                                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                        {path.mitreTechniques.map((technique: string) => (
                                          <MitreChip 
                                            key={technique} 
                                            techniqueId={technique}
                                            size="small" 
                                            variant="outlined" 
                                            color="primary" 
                                          />
                                        ))}
                                      </Box>
                                    )}
                                  </Box>
                                }
                              />
                            </ListItem>
                          ))}
                          {data.attackPathsTo.map((path, index) => (
                            <ListItem key={`to-${index}`} sx={{ pl: 0 }}>
                              <ListItemText
                                primary={`← ${path.source}: ${path.description}`}
                                secondary={
                                  path.mitreTechniques?.length > 0 && (
                                    <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                                      {path.mitreTechniques.map((technique: string) => (
                                        <MitreChip 
                                          key={technique} 
                                          techniqueId={technique}
                                          size="small" 
                                          variant="outlined" 
                                          color="primary" 
                                        />
                                      ))}
                                    </Box>
                                  )
                                }
                              />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}

                    {/* MITRE Techniques */}
                    {data.mitreTechniques.size > 0 && (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>
                          MITRE ATT&CK Techniques
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {Array.from(data.mitreTechniques).map(technique => (
                            <MitreChip 
                              key={technique} 
                              techniqueId={technique}
                              size="small" 
                              color="primary" 
                              variant="outlined" 
                            />
                          ))}
                        </Box>
                      </Box>
                    )}

                    {/* Recommendations */}
                    {data.recommendations.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Lightbulb color="info" fontSize="small" /> Recommendations
                        </Typography>
                        <List dense>
                          {data.recommendations.map((rec, index) => (
                            <ListItem key={index} sx={{ pl: 0 }}>
                              <ListItemIcon sx={{ minWidth: 'auto', mr: 1 }}>
                                <Chip 
                                  label={rec.priority} 
                                  size="small" 
                                  sx={{ 
                                    backgroundColor: getRiskColor(rec.priority), 
                                    color: '#fff' 
                                  }} 
                                />
                              </ListItemIcon>
                              <ListItemText primary={rec.action} />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}
                  </Stack>
                </CardContent>
              </Collapse>
            </Card>
          );
        })}
      </Box>

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          mt: 3,
          animation: 'fadeIn 0.5s ease-in',
          '@keyframes fadeIn': {
            from: { opacity: 0 },
            to: { opacity: 1 }
          }
        }}>
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={handlePageChange}
            color="primary"
            size="large"
            showFirstButton
            showLastButton
            sx={{
              '& .MuiPaginationItem-root': {
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: theme.shadows[2],
                },
                '&.Mui-selected': {
                  transform: 'scale(1.1)',
                  boxShadow: theme.shadows[3],
                }
              }
            }}
          />
        </Box>
      )}
    </Box>
  );
};

export default ComponentAnalysisTab;