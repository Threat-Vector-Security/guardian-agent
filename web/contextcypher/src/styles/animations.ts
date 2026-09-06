// animations.ts - Reusable animation utilities and keyframes

import { keyframes } from '@mui/material/styles';

// Fade animations
export const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

export const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

export const fadeInDown = keyframes`
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

// Scale animations
export const scaleIn = keyframes`
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
`;

export const pulse = keyframes`
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
`;

export const pulseGlow = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(0, 122, 204, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(0, 122, 204, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(0, 122, 204, 0);
  }
`;

// Slide animations
export const slideInRight = keyframes`
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

export const slideInLeft = keyframes`
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

// Rotation animations
export const spin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

// Shimmer effect for loading states
export const shimmer = keyframes`
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
`;

// Glow animations
export const glow = keyframes`
  0% {
    box-shadow: 0 0 5px rgba(0, 122, 204, 0.5);
  }
  50% {
    box-shadow: 0 0 20px rgba(0, 122, 204, 0.8), 0 0 30px rgba(0, 122, 204, 0.6);
  }
  100% {
    box-shadow: 0 0 5px rgba(0, 122, 204, 0.5);
  }
`;

// Ripple effect
export const ripple = keyframes`
  0% {
    transform: scale(0);
    opacity: 1;
  }
  100% {
    transform: scale(4);
    opacity: 0;
  }
`;

// Bounce animation
export const bounce = keyframes`
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-10px);
  }
  60% {
    transform: translateY(-5px);
  }
`;

// Shake animation for errors
export const shake = keyframes`
  0%, 100% {
    transform: translateX(0);
  }
  10%, 30%, 50%, 70%, 90% {
    transform: translateX(-5px);
  }
  20%, 40%, 60%, 80% {
    transform: translateX(5px);
  }
`;

// Wave animation
export const wave = keyframes`
  0% {
    transform: rotate(0deg);
  }
  10% {
    transform: rotate(14deg);
  }
  20% {
    transform: rotate(-8deg);
  }
  30% {
    transform: rotate(14deg);
  }
  40% {
    transform: rotate(-4deg);
  }
  50% {
    transform: rotate(10deg);
  }
  60% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(0deg);
  }
`;

// Skeleton loading animation
export const skeletonLoading = keyframes`
  0% {
    background-color: hsl(200, 20%, 80%);
  }
  100% {
    background-color: hsl(200, 20%, 95%);
  }
`;

// Animation durations
export const durations = {
  shortest: 150,
  shorter: 200,
  short: 250,
  standard: 300,
  complex: 375,
  enteringScreen: 225,
  leavingScreen: 195,
};

// Easing functions
export const easings = {
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
};

// Common animation styles
export const animationStyles = {
  fadeIn: {
    animation: `${fadeIn} ${durations.standard}ms ${easings.easeInOut}`,
  },
  fadeInUp: {
    animation: `${fadeInUp} ${durations.complex}ms ${easings.easeOut}`,
  },
  scaleIn: {
    animation: `${scaleIn} ${durations.short}ms ${easings.easeOut}`,
  },
  pulse: {
    animation: `${pulse} 2000ms ${easings.easeInOut} infinite`,
  },
  spin: {
    animation: `${spin} 1000ms linear infinite`,
  },
  bounce: {
    animation: `${bounce} 1000ms ${easings.easeInOut}`,
  },
  shake: {
    animation: `${shake} 500ms ${easings.easeInOut}`,
  },
};

// Hover effects
export const hoverEffects = {
  lift: {
    transition: `transform ${durations.short}ms ${easings.easeOut}, box-shadow ${durations.short}ms ${easings.easeOut}`,
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    },
  },
  glow: {
    transition: `box-shadow ${durations.standard}ms ${easings.easeOut}`,
    '&:hover': {
      boxShadow: '0 0 20px rgba(0, 122, 204, 0.3)',
    },
  },
  scale: {
    transition: `transform ${durations.short}ms ${easings.easeOut}`,
    '&:hover': {
      transform: 'scale(1.05)',
    },
  },
  brighten: {
    transition: `filter ${durations.short}ms ${easings.easeOut}`,
    '&:hover': {
      filter: 'brightness(1.1)',
    },
  },
};

// Transition presets
export const transitions = {
  all: `all ${durations.standard}ms ${easings.easeInOut}`,
  colors: `color ${durations.standard}ms ${easings.easeInOut}, background-color ${durations.standard}ms ${easings.easeInOut}, border-color ${durations.standard}ms ${easings.easeInOut}`,
  transform: `transform ${durations.standard}ms ${easings.easeOut}`,
  opacity: `opacity ${durations.standard}ms ${easings.easeInOut}`,
  shadow: `box-shadow ${durations.standard}ms ${easings.easeOut}`,
};