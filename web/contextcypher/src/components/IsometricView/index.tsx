import React from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { ArrowBack, CameraAlt, Layers, Settings } from '@mui/icons-material';
import { IsometricScene } from './IsometricScene';
import { AnalysisContextProvider } from '../AnalysisContextProvider';
import { ManualAnalysisProvider } from '../../contexts/ManualAnalysisContext';
import { SettingsProvider } from '../../settings/SettingsContext';

interface IsometricViewProps {
  diagramData?: { nodes: any[], edges: any[] } | null;
}

export const IsometricView: React.FC<IsometricViewProps> = ({ diagramData }) => {
  const handleBackToDigram = () => {
    window.history.pushState(null, '', '/');
    window.location.href = '/';
  };

  return (
    <SettingsProvider>
      <AnalysisContextProvider>
        <ManualAnalysisProvider>
          <Box sx={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
            {/* Main 3D Scene */}
            <IsometricScene diagramData={diagramData} />

        {/* Top Toolbar */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), rgba(0,0,0,0))',
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Left section */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Tooltip title="Back to Diagram View">
              <IconButton onClick={handleBackToDigram} sx={{ color: 'white' }}>
                <ArrowBack />
              </IconButton>
            </Tooltip>
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
              Security Architecture - Isometric View
            </Typography>
          </Box>

          {/* Right section */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Camera Views">
              <IconButton sx={{ color: 'white' }}>
                <CameraAlt />
              </IconButton>
            </Tooltip>
            <Tooltip title="Toggle Layers">
              <IconButton sx={{ color: 'white' }}>
                <Layers />
              </IconButton>
            </Tooltip>
            <Tooltip title="View Settings">
              <IconButton sx={{ color: 'white' }}>
                <Settings />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Legend */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            background: 'rgba(0, 0, 0, 0.8)',
            borderRadius: 1,
            p: 2,
            minWidth: 200,
          }}
        >
          <Typography variant="subtitle2" sx={{ color: 'white', mb: 1 }}>
            Security Zones
          </Typography>
          <LegendItem color="#ff6b6b" label="Internet" />
          <LegendItem color="#ffd93d" label="External" />
          <LegendItem color="#ff9a00" label="DMZ" />
          <LegendItem color="#6bcf7f" label="Internal" />
          <LegendItem color="#4ecdc4" label="Trusted" />
          <LegendItem color="#a855f7" label="Critical" />
        </Box>

        {/* Controls Help */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 20,
            right: 20,
            background: 'rgba(0, 0, 0, 0.8)',
            borderRadius: 1,
            p: 2,
            minWidth: 200,
          }}
        >
          <Typography variant="subtitle2" sx={{ color: 'white', mb: 1 }}>
            Controls (Unreal Engine Style)
          </Typography>
          <Typography variant="caption" sx={{ color: 'white', display: 'block' }}>
            • WASD: Move forward/back/left/right
          </Typography>
          <Typography variant="caption" sx={{ color: 'white', display: 'block' }}>
            • Q/E: Move up/down
          </Typography>
          <Typography variant="caption" sx={{ color: 'white', display: 'block' }}>
            • Right Mouse + Drag: Look around
          </Typography>
          <Typography variant="caption" sx={{ color: 'white', display: 'block' }}>
            • Shift: Move faster
          </Typography>
          <Typography variant="caption" sx={{ color: 'white', display: 'block' }}>
            • Click Building: Select
          </Typography>
        </Box>
          </Box>
        </ManualAnalysisProvider>
      </AnalysisContextProvider>
    </SettingsProvider>
  );
};

// Legend item component
interface LegendItemProps {
  color: string;
  label: string;
}

const LegendItem: React.FC<LegendItemProps> = ({ color, label }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
    <Box
      sx={{
        width: 16,
        height: 16,
        backgroundColor: color,
        opacity: 0.8,
        borderRadius: '2px',
      }}
    />
    <Typography variant="caption" sx={{ color: 'white' }}>
      {label}
    </Typography>
  </Box>
);
