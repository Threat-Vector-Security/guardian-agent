import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, LinearProgress, Typography } from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import { useSettings } from '../../settings/SettingsContext';

const threatPulse = keyframes`
  0% { 
    box-shadow: 0 0 0 0 rgba(244, 67, 54, 0.7);
    transform: scale(1);
  }
  70% { 
    box-shadow: 0 0 0 10px rgba(244, 67, 54, 0);
    transform: scale(1.05);
  }
  100% { 
    box-shadow: 0 0 0 0 rgba(244, 67, 54, 0);
    transform: scale(1);
  }
`;

const successGlow = keyframes`
  0%, 100% { 
    box-shadow: 0 0 10px rgba(76, 175, 80, 0.3);
  }
  50% { 
    box-shadow: 0 0 20px rgba(76, 175, 80, 0.6);
  }
`;

const warningFlash = keyframes`
  0%, 100% { background-color: rgba(255, 193, 7, 0.1); }
  50% { background-color: rgba(255, 193, 7, 0.3); }
`;

const typewriter = keyframes`
  from { width: 0; }
  to { width: 100%; }
`;

const slideIn = keyframes`
  from { 
    transform: translateX(-100%); 
    opacity: 0; 
  }
  to { 
    transform: translateX(0); 
    opacity: 1; 
  }
`;

const bounce = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
`;

interface ThreatLevelIndicatorProps {
  level: 'low' | 'medium' | 'high' | 'critical';
  progress: number;
  animated?: boolean;
}

const ThreatLevelContainer = styled(Box)<{ level: string; animated: boolean }>`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  
  ${({ level, animated }) => {
    if (!animated) return '';
    
    switch (level) {
      case 'critical':
        return `animation: ${threatPulse} 2s infinite;`;
      case 'high':
        return `animation: ${warningFlash} 3s infinite;`;
      case 'medium':
        return `animation: ${bounce} 2s infinite;`;
      default:
        return `animation: ${successGlow} 4s infinite;`;
    }
  }}
`;

export const ThreatLevelIndicator: React.FC<ThreatLevelIndicatorProps> = ({
  level,
  progress,
  animated = true
}) => {
  const { settings } = useSettings();
  const animationsEnabled = settings.effects?.enabled && settings.effects?.animations;

  const getColor = () => {
    switch (level) {
      case 'critical': return '#f44336';
      case 'high': return '#ff9800';
      case 'medium': return '#ffc107';
      case 'low': return '#4caf50';
      default: return '#2196f3';
    }
  };

  return (
    <ThreatLevelContainer level={level} animated={animationsEnabled && animated}>
      <CircularProgress
        variant="determinate"
        value={progress}
        size={60}
        thickness={4}
        sx={{
          color: getColor(),
          '& .MuiCircularProgress-circle': {
            strokeLinecap: 'round',
            transition: 'stroke-dasharray 0.3s ease',
          }
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="caption" component="div" color="textSecondary">
          {level.toUpperCase()}
        </Typography>
      </Box>
    </ThreatLevelContainer>
  );
};

interface AnalysisProgressProps {
  progress: number;
  status: string;
  animated?: boolean;
}

const ProgressContainer = styled(Box)<{ animated: boolean }>`
  ${({ animated }) => animated ? `
    animation: ${slideIn} 0.5s ease-out;
  ` : ''}
`;

const StatusText = styled(Typography)<{ animated: boolean }>`
  ${({ animated }) => animated ? `
    overflow: hidden;
    white-space: nowrap;
    animation: ${typewriter} 2s steps(40, end);
  ` : ''}
`;

export const AnalysisProgress: React.FC<AnalysisProgressProps> = ({
  progress,
  status,
  animated = true
}) => {
  const { settings } = useSettings();
  const animationsEnabled = settings.effects?.enabled && settings.effects?.animations;

  return (
    <ProgressContainer animated={animationsEnabled && animated}>
      <Box sx={{ mb: 2 }}>
        <StatusText 
          variant="body2" 
          color="textSecondary"
          animated={animationsEnabled && animated}
        >
          {status}
        </StatusText>
      </Box>
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          height: 8,
          borderRadius: 4,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          '& .MuiLinearProgress-bar': {
            borderRadius: 4,
            transition: 'transform 0.4s ease',
            background: `linear-gradient(45deg, 
              ${progress < 30 ? '#4caf50' : progress < 70 ? '#ffc107' : '#f44336'}, 
              ${progress < 30 ? '#81c784' : progress < 70 ? '#ffeb3b' : '#ff7043'})`,
          }
        }}
      />
    </ProgressContainer>
  );
};

interface SecurityScoreProps {
  score: number;
  maxScore: number;
  animated?: boolean;
}

const ScoreContainer = styled(Box)<{ animated: boolean }>`
  ${({ animated }) => animated ? `
    animation: ${slideIn} 0.8s ease-out;
  ` : ''}
`;

export const SecurityScore: React.FC<SecurityScoreProps> = ({
  score,
  maxScore,
  animated = true
}) => {
  const { settings } = useSettings();
  const [displayScore, setDisplayScore] = useState(0);
  const animationsEnabled = settings.effects?.enabled && settings.effects?.animations;

  useEffect(() => {
    if (animationsEnabled && animated) {
      let start = 0;
      const increment = score / 50; // 50 frames
      const timer = setInterval(() => {
        start += increment;
        if (start >= score) {
          setDisplayScore(score);
          clearInterval(timer);
        } else {
          setDisplayScore(Math.floor(start));
        }
      }, 20);
      return () => clearInterval(timer);
    } else {
      setDisplayScore(score);
    }
  }, [score, animationsEnabled, animated]);

  const percentage = (displayScore / maxScore) * 100;
  const getScoreColor = () => {
    if (percentage >= 80) return '#4caf50';
    if (percentage >= 60) return '#ffc107';
    if (percentage >= 40) return '#ff9800';
    return '#f44336';
  };

  return (
    <ScoreContainer animated={animationsEnabled && animated}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <CircularProgress
          variant="determinate"
          value={percentage}
          size={80}
          thickness={6}
          sx={{
            color: getScoreColor(),
            '& .MuiCircularProgress-circle': {
              strokeLinecap: 'round',
            }
          }}
        />
        <Box>
          <Typography variant="h4" sx={{ color: getScoreColor(), fontWeight: 'bold' }}>
            {displayScore}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            / {maxScore}
          </Typography>
        </Box>
      </Box>
    </ScoreContainer>
  );
};

interface LoadingSkeletonProps {
  width?: string | number;
  height?: string | number;
  animated?: boolean;
}

const shimmer = keyframes`
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
`;

const SkeletonBox = styled(Box)<{ animated: boolean }>`
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  
  ${({ animated }) => animated ? `
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.1) 0%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0.1) 100%
    );
    background-size: 200px 100%;
    animation: ${shimmer} 1.5s infinite;
  ` : ''}
`;

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  width = '100%',
  height = 20,
  animated = true
}) => {
  const { settings } = useSettings();
  const animationsEnabled = settings.effects?.enabled && settings.effects?.animations;

  return (
    <SkeletonBox
      sx={{ width, height }}
      animated={animationsEnabled && animated}
    />
  );
};