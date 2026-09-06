import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Paper,
  Grid,
  useTheme,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from '@mui/material';
import {
  Lightbulb,
  PriorityHigh,
  CheckCircle,
  Warning,
  Info,
} from '@mui/icons-material';
import { getRiskColor } from './grc/grcShared';

interface RecommendationsTabProps {
  systemAnalysis: {
    recommendations?: any[];
  };
}

const getPriorityIcon = (priority: string) => {
  switch (priority) {
    case 'EXTREME':
    case 'HIGH':
      return <PriorityHigh color="error" />;
    case 'MEDIUM':
      return <Warning color="warning" />;
    case 'MINOR':
    case 'LOW':
      return <Info color="info" />;
    default:
      return <CheckCircle color="success" />;
  }
};


const RecommendationsTab: React.FC<RecommendationsTabProps> = ({
  systemAnalysis,
}) => {
  const theme = useTheme();
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const recommendations = systemAnalysis.recommendations || [];

  // Get unique priorities for filtering
  const availablePriorities = useMemo(() => {
    const priorities = new Set(recommendations.map(r => r.priority).filter(Boolean));
    return Array.from(priorities).sort((a, b) => {
      const priorityOrder = ['EXTREME', 'HIGH', 'MEDIUM', 'MINOR', 'LOW', 'SUSTAINABLE'];
      return priorityOrder.indexOf(a) - priorityOrder.indexOf(b);
    });
  }, [recommendations]);

  // Filter recommendations by priority
  const filteredRecommendations = useMemo(() => {
    if (priorityFilter === 'all') {
      return recommendations;
    }
    return recommendations.filter(rec => rec.priority === priorityFilter);
  }, [recommendations, priorityFilter]);

  // Sort recommendations by priority
  const sortedRecommendations = useMemo(() => {
    return [...filteredRecommendations].sort((a, b) => {
      const priorityOrder = ['EXTREME', 'HIGH', 'MEDIUM', 'MINOR', 'LOW', 'SUSTAINABLE'];
      return priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
    });
  }, [filteredRecommendations]);

  // Calculate priority distribution
  const priorityDistribution = useMemo(() => {
    const distribution: Record<string, number> = {};
    recommendations.forEach(rec => {
      if (rec.priority) {
        distribution[rec.priority] = (distribution[rec.priority] || 0) + 1;
      }
    });
    return distribution;
  }, [recommendations]);

  if (recommendations.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="success">
          <Typography variant="h6" gutterBottom>
            No Security Recommendations Required
          </Typography>
          <Typography variant="body2">
            Based on the current analysis, no additional security recommendations have been 
            identified. The system appears to have adequate security controls in place.
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
          <Lightbulb /> Security Recommendations
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Prioritized recommendations to improve the security posture of your system
        </Typography>
      </Box>

      {/* Summary Statistics */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card 
            variant="outlined"
            sx={{
              borderRadius: 2,
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: theme.shadows[6],
              },
              animation: 'slideInLeft 0.5s ease-out',
              '@keyframes slideInLeft': {
                from: { opacity: 0, transform: 'translateX(-30px)' },
                to: { opacity: 1, transform: 'translateX(0)' }
              }
            }}
          >
            <CardHeader
              title="Recommendation Summary"
              titleTypographyProps={{ variant: 'h6' }}
            />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Box sx={{ 
                    textAlign: 'center',
                    transition: 'transform 0.2s ease',
                    '&:hover': {
                      transform: 'scale(1.05)',
                    }
                  }}>
                    <Typography variant="h3" color="primary" fontWeight="bold">
                      {recommendations.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Recommendations
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ 
                    textAlign: 'center',
                    transition: 'transform 0.2s ease',
                    '&:hover': {
                      transform: 'scale(1.05)',
                    }
                  }}>
                    <Typography variant="h3" color="error" fontWeight="bold">
                      {(priorityDistribution['EXTREME'] || 0) + (priorityDistribution['HIGH'] || 0)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      High Priority Items
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card 
            variant="outlined"
            sx={{
              borderRadius: 2,
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: theme.shadows[6],
              },
              animation: 'slideInRight 0.5s ease-out',
              '@keyframes slideInRight': {
                from: { opacity: 0, transform: 'translateX(30px)' },
                to: { opacity: 1, transform: 'translateX(0)' }
              }
            }}
          >
            <CardHeader
              title="Priority Distribution"
              titleTypographyProps={{ variant: 'h6' }}
            />
            <CardContent>
              <Grid container spacing={1}>
                {Object.entries(priorityDistribution).map(([priority, count]) => (
                  <Grid item xs={12} key={priority}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: getRiskColor(priority),
                        }}
                      />
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {priority}
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {count}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filter Controls */}
      <Paper elevation={0} sx={{ p: 2, border: `1px solid ${theme.palette.divider}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Priority Filter</InputLabel>
            <Select
              value={priorityFilter}
              label="Priority Filter"
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <MenuItem value="all">All Priorities</MenuItem>
              {availablePriorities.map(priority => (
                <MenuItem key={priority} value={priority}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: getRiskColor(priority),
                      }}
                    />
                    {priority}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <Typography variant="body2" color="text.secondary">
            Showing {sortedRecommendations.length} of {recommendations.length} recommendations
          </Typography>
        </Box>
      </Paper>

      {/* Recommendations List */}
      <Box>
        {sortedRecommendations.map((rec: any, index: number) => (
          <Card 
            key={index} 
            variant="outlined" 
            sx={{ 
              mb: 2,
              borderRadius: 2,
              transition: 'all 0.3s ease',
              borderLeft: `4px solid ${getRiskColor(rec.priority)}`,
              '&:hover': {
                transform: 'translateX(6px)',
                boxShadow: theme.shadows[4],
                backgroundColor: theme.palette.mode === 'dark'
                  ? 'rgba(255,255,255,0.02)'
                  : theme.palette.grey[50],
              },
              animation: `fadeInScale 0.3s ease-in ${index * 0.05}s both`,
              '@keyframes fadeInScale': {
                from: { opacity: 0, transform: 'scale(0.95)' },
                to: { opacity: 1, transform: 'scale(1)' }
              }
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                {/* Priority Badge */}
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  gap: 1,
                  transition: 'transform 0.2s ease',
                  '&:hover': {
                    transform: 'scale(1.1)',
                  }
                }}>
                  {getPriorityIcon(rec.priority)}
                  <Chip
                    label={rec.priority || 'UNKNOWN'}
                    size="small"
                    sx={{
                      backgroundColor: getRiskColor(rec.priority),
                      color: '#fff',
                      fontWeight: 600,
                      minWidth: 80,
                      boxShadow: theme.shadows[2],
                    }}
                  />
                </Box>

                {/* Content */}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" gutterBottom>
                    {rec.action}
                  </Typography>
                  
                  {rec.rationale && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {rec.rationale}
                    </Typography>
                  )}
                  
                  {rec.affectedComponents && rec.affectedComponents.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Affected Components:
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {rec.affectedComponents.map((component: string, idx: number) => (
                          <Chip
                            key={idx}
                            label={component}
                            size="small"
                            variant="outlined"
                            color="primary"
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Implementation Guide */}
      <Card 
        variant="outlined"
        sx={{
          borderRadius: 2,
          background: theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)'
            : 'linear-gradient(135deg, rgba(0,0,0,0.01) 0%, rgba(0,0,0,0.02) 100%)',
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: theme.shadows[3],
          },
          animation: 'fadeInUp 0.5s ease-out 0.3s both',
          '@keyframes fadeInUp': {
            from: { opacity: 0, transform: 'translateY(20px)' },
            to: { opacity: 1, transform: 'translateY(0)' }
          }
        }}
      >
        <CardHeader
          title="Implementation Guide"
          titleTypographyProps={{ variant: 'h6' }}
        />
        <CardContent>
          <Typography variant="body1" gutterBottom>
            Follow these guidelines when implementing the security recommendations:
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <Chip 
                  label="EXTREME" 
                  size="small" 
                  sx={{ backgroundColor: getRiskColor('EXTREME'), color: '#fff' }} 
                />
              </ListItemIcon>
              <ListItemText 
                primary="Critical Priority" 
                secondary="Implement immediately - these address severe security vulnerabilities that could lead to system compromise"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <Chip 
                  label="HIGH" 
                  size="small" 
                  sx={{ backgroundColor: getRiskColor('HIGH'), color: '#fff' }} 
                />
              </ListItemIcon>
              <ListItemText 
                primary="High Priority" 
                secondary="Implement within 30 days - these address significant security gaps"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <Chip 
                  label="MEDIUM" 
                  size="small" 
                  sx={{ backgroundColor: getRiskColor('MEDIUM'), color: '#fff' }} 
                />
              </ListItemIcon>
              <ListItemText 
                primary="Medium Priority" 
                secondary="Plan for implementation within 90 days - these improve overall security posture"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <Chip 
                  label="MINOR" 
                  size="small" 
                  sx={{ backgroundColor: getRiskColor('MINOR'), color: '#fff' }} 
                />
              </ListItemIcon>
              <ListItemText 
                primary="Low Priority" 
                secondary="Consider for future security improvements - these address minor gaps or best practices"
              />
            </ListItem>
          </List>
        </CardContent>
      </Card>
    </Box>
  );
};

export default RecommendationsTab;