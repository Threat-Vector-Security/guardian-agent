// src/components/ContextIndicator.tsx

import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Chip, 
  IconButton, 
  Tooltip, 
  CircularProgress,
  Typography,
  Collapse,
  Alert
} from '@mui/material';
import {
  Layers as LayersIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

interface ContextIndicatorProps {
  contextLevel: 'minimal' | 'overview' | 'focused' | 'detailed';
  tokenUsage?: {
    total: {
      characters: number;
      estimatedTokens: number;
      percentage: number;
    };
  };
  queryIntent?: {
    type: string;
    components: string[];
    scope: string;
  };
  onRequestMoreContext?: () => void;
  isLoading?: boolean;
}

const StyledContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  marginBottom: theme.spacing(1)
}));

const ContextLevelChip = styled(Chip)<{ level: string }>(({ theme, level }) => {
  const colors: Record<string, string> = {
    minimal: theme.palette.warning.main,
    overview: theme.palette.info.main,
    focused: theme.palette.success.main,
    detailed: theme.palette.primary.main
  };

  return {
    backgroundColor: colors[level] || theme.palette.grey[500],
    color: theme.palette.getContrastText(colors[level] || theme.palette.grey[500])
  };
});

export const ContextIndicator: React.FC<ContextIndicatorProps> = ({
  contextLevel,
  tokenUsage,
  queryIntent,
  onRequestMoreContext,
  isLoading = false
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    // Auto-show info if context might be insufficient
    if (contextLevel === 'minimal' || 
        (queryIntent?.type === 'specific_component' && contextLevel === 'overview')) {
      setShowInfo(true);
      setTimeout(() => setShowInfo(false), 5000); // Hide after 5 seconds
    }
  }, [contextLevel, queryIntent]);

  const getContextDescription = () => {
    switch (contextLevel) {
      case 'minimal':
        return 'Basic system summary only';
      case 'overview':
        return 'High-level architecture and zones';
      case 'focused':
        return 'Detailed view of relevant components';
      case 'detailed':
        return 'Complete system context';
      default:
        return 'Unknown context level';
    }
  };

  const getRecommendation = () => {
    if (!queryIntent) return null;

    if (queryIntent.type === 'specific_component' && contextLevel === 'overview') {
      return 'Consider requesting focused context for better component details';
    }
    if (queryIntent.type === 'security_analysis' && contextLevel === 'minimal') {
      return 'Security analysis works best with focused or detailed context';
    }
    return null;
  };

  return (
    <>
      <StyledContainer>
        <LayersIcon fontSize="small" />
        
        <ContextLevelChip
          label={contextLevel.toUpperCase()}
          level={contextLevel}
          size="small"
        />
        
        <Typography variant="caption" color="text.secondary">
          {getContextDescription()}
        </Typography>
        
        {tokenUsage && (
          <Tooltip title={`${tokenUsage.total.estimatedTokens} tokens used`}>
            <Typography variant="caption" color="text.secondary">
              ({Math.round(tokenUsage.total.percentage)}% capacity)
            </Typography>
          </Tooltip>
        )}
        
        {onRequestMoreContext && contextLevel !== 'detailed' && (
          <Tooltip title="Request more detailed context">
            <IconButton
              size="small"
              onClick={onRequestMoreContext}
              disabled={isLoading}
            >
              {isLoading ? (
                <CircularProgress size={16} />
              ) : (
                <ExpandMoreIcon />
              )}
            </IconButton>
          </Tooltip>
        )}
        
        <IconButton
          size="small"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ExpandLessIcon /> : <InfoIcon />}
        </IconButton>
      </StyledContainer>
      
      <Collapse in={expanded || showInfo}>
        <Alert 
          severity="info" 
          sx={{ mb: 1 }}
          onClose={() => setShowInfo(false)}
        >
          <Typography variant="caption">
            <strong>Context Level: {contextLevel}</strong>
            <br />
            {getContextDescription()}
            {queryIntent && (
              <>
                <br />
                Query type: {queryIntent.type.replace('_', ' ')}
                {queryIntent.components.length > 0 && (
                  <>
                    <br />
                    Components mentioned: {queryIntent.components.join(', ')}
                  </>
                )}
              </>
            )}
            {getRecommendation() && (
              <>
                <br />
                <strong>Tip:</strong> {getRecommendation()}
              </>
            )}
          </Typography>
        </Alert>
      </Collapse>
    </>
  );
};