import React, { useState, useEffect, useRef } from 'react';
import { Box, CircularProgress, Typography, Fade, useTheme } from '@mui/material';
import { styled } from '@mui/material/styles';

const Overlay = styled(Box)`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  pointer-events: all;
  cursor: wait;
`;

const LoadingContainer = styled(Box)`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 32px;
  background: ${({ theme }) => theme.colors.surface};
  border-radius: 16px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
`;

interface ThemeTransitionOverlayProps {
  themeName: string;
  onTransitionComplete?: () => void;
}

export const ThemeTransitionOverlay: React.FC<ThemeTransitionOverlayProps> = React.memo(({ 
  themeName, 
  onTransitionComplete 
}) => {
  const theme = useTheme();
  const [progress, setProgress] = useState(0);
  const callbackRef = useRef(onTransitionComplete);

  // Update callback ref when it changes, but don't restart animation
  useEffect(() => {
    callbackRef.current = onTransitionComplete;
  }, [onTransitionComplete]);

  useEffect(() => {
    console.log('ThemeTransitionOverlay mounted, starting animation');
    
    // Use a faster, more reliable approach optimized for drawer closing
    let animationFrame: number;
    let startTime: number;
    const initialDuration = 600; // Quick initial animation
    const extendedDuration = 1200; // Shorter total duration since drawer will close
    
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      
      // Smooth progress with slight pause in the middle for theme application
      let progress;
      if (elapsed < initialDuration) {
        progress = (elapsed / initialDuration) * 70; // Get to 70% quickly
      } else {
        // Complete remaining 30% over shorter period
        const extendedElapsed = elapsed - initialDuration;
        const remainingProgress = (extendedElapsed / (extendedDuration - initialDuration)) * 30;
        progress = Math.min(70 + remainingProgress, 100);
      }
      
      console.log('Progress update:', Math.round(progress));
      setProgress(progress);
      
      if (progress < 100) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        console.log('Animation complete, triggering callback');
        // Small delay to ensure the 100% is visible
        setTimeout(() => {
          callbackRef.current?.();
        }, 50);
      }
    };
    
    animationFrame = requestAnimationFrame(animate);
    
    // Failsafe timeout - shorter duration
    const failsafe = setTimeout(() => {
      console.log('Failsafe triggered - forcing completion');
      cancelAnimationFrame(animationFrame);
      callbackRef.current?.();
    }, extendedDuration + 300);
    
    return () => {
      console.log('ThemeTransitionOverlay unmounting');
      cancelAnimationFrame(animationFrame);
      clearTimeout(failsafe);
    };
  }, []); // Empty dependency array - only run once on mount

  return (
    <Fade in={true} timeout={200}>
      <Overlay>
        <LoadingContainer>
          <Box sx={{ position: 'relative', display: 'inline-flex' }}>
            <CircularProgress 
              variant="determinate" 
              value={progress}
              size={80}
              thickness={3}
              sx={{
                color: theme.colors.primary,
                '& .MuiCircularProgress-circle': {
                  strokeLinecap: 'round',
                  transition: 'stroke-dashoffset 0.1s ease',
                },
              }}
            />
            <Box
              sx={{
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
                position: 'absolute',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography 
                variant="caption" 
                component="div" 
                sx={{ 
                  color: theme.colors.textPrimary,
                  fontWeight: 600,
                  fontSize: '14px'
                }}
              >
                {`${Math.round(progress)}%`}
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ textAlign: 'center' }}>
            <Typography 
              variant="h6" 
              sx={{ 
                color: theme.colors.textPrimary,
                fontWeight: 600,
                mb: 1
              }}
            >
              Applying Theme
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                color: theme.colors.textSecondary,
                textTransform: 'capitalize'
              }}
            >
              {themeName.replace('-', ' ')}
            </Typography>
          </Box>

          <Typography 
            variant="caption" 
            sx={{ 
              color: theme.colors.textSecondary,
              fontStyle: 'italic',
              maxWidth: '300px',
              textAlign: 'center',
              opacity: 0.8
            }}
          >
            {progress < 70 
              ? 'Updating theme and styles...' 
              : 'Closing settings and initializing canvas...'
            }
          </Typography>
        </LoadingContainer>
      </Overlay>
    </Fade>
  );
});