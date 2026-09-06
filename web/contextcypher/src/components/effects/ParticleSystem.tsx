import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSettings } from '../../settings/SettingsContext';
import { getTheme } from '../../styles/Theme';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  color: string;
  life: number;
  maxLife: number;
}

interface ParticleSystemProps {
  type?: 'matrix' | 'cyberpunk' | 'synthwave' | 'celebration';
  active?: boolean;
  intensity?: number;
  className?: string;
}

export const ParticleSystem: React.FC<ParticleSystemProps> = ({
  type = 'matrix',
  active = true,
  intensity = 50,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);
  const { settings } = useSettings();
  
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const theme = getTheme(settings.theme, settings.customTheme);
  const effectsEnabled = settings.effects?.enabled && settings.effects?.particles;

  useEffect(() => {
    const updateDimensions = () => {
      if (canvasRef.current && canvasRef.current.parentElement) {
        const parent = canvasRef.current.parentElement;
        setDimensions({
          width: parent.clientWidth,
          height: parent.clientHeight
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const createParticle = (): Particle => {
    const canvas = canvasRef.current;
    if (!canvas) return createDefaultParticle();

    switch (type) {
      case 'matrix':
        return {
          x: Math.random() * canvas.width,
          y: -10,
          vx: 0,
          vy: 2 + Math.random() * 3,
          size: 12 + Math.random() * 6,
          opacity: 0.7 + Math.random() * 0.3,
          color: theme.colors.primary,
          life: 0,
          maxLife: canvas.height / 2
        };
      
      case 'cyberpunk':
        return {
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          size: 2 + Math.random() * 4,
          opacity: 0.5 + Math.random() * 0.5,
          color: Math.random() > 0.5 ? theme.colors.primary : theme.colors.secondary,
          life: 0,
          maxLife: 120 + Math.random() * 60
        };
      
      case 'synthwave':
        return {
          x: Math.random() * canvas.width,
          y: canvas.height + 10,
          vx: (Math.random() - 0.5) * 1,
          vy: -1 - Math.random() * 2,
          size: 3 + Math.random() * 5,
          opacity: 0.6 + Math.random() * 0.4,
          color: Math.random() > 0.5 ? '#ff006e' : '#8338ec',
          life: 0,
          maxLife: 180 + Math.random() * 120
        };
      
      case 'celebration':
        return {
          x: Math.random() * canvas.width,
          y: canvas.height,
          vx: (Math.random() - 0.5) * 8,
          vy: -5 - Math.random() * 10,
          size: 4 + Math.random() * 6,
          opacity: 1,
          color: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b'][Math.floor(Math.random() * 5)],
          life: 0,
          maxLife: 100 + Math.random() * 50
        };
      
      default:
        return createDefaultParticle();
    }
  };

  const createDefaultParticle = (): Particle => ({
    x: 0, y: 0, vx: 0, vy: 0, size: 2, opacity: 1, 
    color: '#ffffff', life: 0, maxLife: 60
  });

  const updateParticles = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    particlesRef.current = particlesRef.current.filter(particle => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.life++;

      // Apply gravity for celebration particles
      if (type === 'celebration') {
        particle.vy += 0.2;
      }

      // Fade out particles near end of life
      if (particle.life > particle.maxLife * 0.7) {
        particle.opacity *= 0.98;
      }

      // Remove particles that are out of bounds or dead
      return particle.life < particle.maxLife && 
             particle.opacity > 0.01 &&
             particle.x > -50 && particle.x < canvas.width + 50 &&
             particle.y > -50 && particle.y < canvas.height + 50;
    });

    // Add new particles
    if (particlesRef.current.length < intensity && active && effectsEnabled) {
      for (let i = 0; i < 2; i++) {
        particlesRef.current.push(createParticle());
      }
    }
  };

  const drawParticles = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particlesRef.current.forEach(particle => {
      ctx.save();
      ctx.globalAlpha = particle.opacity;
      ctx.fillStyle = particle.color;

      if (type === 'matrix') {
        // Draw matrix characters
        ctx.font = `${particle.size}px monospace`;
        ctx.fillText(String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96)), particle.x, particle.y);
      } else if (type === 'cyberpunk') {
        // Draw geometric shapes
        ctx.beginPath();
        if (Math.random() > 0.5) {
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        } else {
          ctx.rect(particle.x - particle.size/2, particle.y - particle.size/2, particle.size, particle.size);
        }
        ctx.fill();
      } else {
        // Draw circles for other types
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });
  };

  const animate = useCallback(() => {
    updateParticles();
    drawParticles();
    animationRef.current = requestAnimationFrame(animate);
  }, [updateParticles, drawParticles]);

  useEffect(() => {
    if (effectsEnabled && active && dimensions.width && dimensions.height) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      particlesRef.current = [];
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [effectsEnabled, active, dimensions, type, intensity]);

  if (!effectsEnabled || !active) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      width={dimensions.width}
      height={dimensions.height}
      className={className}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 1
      }}
    />
  );
};