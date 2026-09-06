import React from 'react';
import { Box, Skeleton, useTheme } from '@mui/material';
import { styled } from '@mui/material/styles';
import { shimmer } from '../styles/animations';

const ShimmerSkeleton = styled(Skeleton)(({ theme }) => ({
  '&::after': {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    transform: 'translateX(-100%)',
    background: `linear-gradient(
      90deg,
      rgba(255, 255, 255, 0) 0,
      rgba(255, 255, 255, 0.1) 20%,
      rgba(255, 255, 255, 0.3) 60%,
      rgba(255, 255, 255, 0)
    )`,
    animation: `${shimmer} 2s infinite`,
    content: '""',
  },
}));

interface LoadingSkeletonProps {
  variant?: 'message' | 'diagram' | 'panel';
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ variant = 'message' }) => {
  const theme = useTheme();

  if (variant === 'message') {
    return (
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <ShimmerSkeleton 
            variant="circular" 
            width={40} 
            height={40} 
            sx={{ bgcolor: theme.colors.surfaceHover }}
          />
          <Box sx={{ flex: 1 }}>
            <ShimmerSkeleton 
              variant="text" 
              sx={{ fontSize: '1rem', width: '30%', bgcolor: theme.colors.surfaceHover }} 
            />
            <ShimmerSkeleton 
              variant="rectangular" 
              height={60} 
              sx={{ borderRadius: 1, bgcolor: theme.colors.surfaceHover }} 
            />
          </Box>
        </Box>
      </Box>
    );
  }

  if (variant === 'diagram') {
    return (
      <Box sx={{ p: 4, display: 'flex', gap: 4, justifyContent: 'center' }}>
        {[1, 2, 3].map((i) => (
          <Box key={i} sx={{ textAlign: 'center' }}>
            <ShimmerSkeleton 
              variant="rectangular" 
              width={120} 
              height={80} 
              sx={{ borderRadius: 2, mb: 2, bgcolor: theme.colors.surfaceHover }} 
            />
            <ShimmerSkeleton 
              variant="text" 
              sx={{ width: '80%', margin: '0 auto', bgcolor: theme.colors.surfaceHover }} 
            />
          </Box>
        ))}
      </Box>
    );
  }

  if (variant === 'panel') {
    return (
      <Box sx={{ p: 2 }}>
        <ShimmerSkeleton 
          variant="text" 
          sx={{ fontSize: '1.5rem', width: '40%', mb: 2, bgcolor: theme.colors.surfaceHover }} 
        />
        {[1, 2, 3, 4].map((i) => (
          <ShimmerSkeleton 
            key={i}
            variant="text" 
            sx={{ 
              fontSize: '0.875rem', 
              width: i % 2 === 0 ? '100%' : '80%', 
              mb: 1,
              bgcolor: theme.colors.surfaceHover 
            }} 
          />
        ))}
      </Box>
    );
  }

  return null;
};