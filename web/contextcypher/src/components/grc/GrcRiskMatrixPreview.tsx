import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { buildRiskMatrix } from '../../services/GrcWorkspaceService';
import { GrcWorkspaceConfig, RiskMatrixCell, RiskScaleValue } from '../../types/GrcTypes';

interface GrcRiskMatrixPreviewProps {
  likelihoodScale: RiskScaleValue[];
  impactScale: RiskScaleValue[];
  appetiteThresholdScore: number;
  config?: GrcWorkspaceConfig;
  title?: string;
  helperText?: string;
}

const getContrastColor = (hexColor: string): string => {
  const cleanHex = hexColor.replace('#', '');
  if (cleanHex.length !== 6) {
    return '#111827';
  }

  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.6 ? '#111827' : '#f8fafc';
};

const GrcRiskMatrixPreview: React.FC<GrcRiskMatrixPreviewProps> = ({
  likelihoodScale,
  impactScale,
  appetiteThresholdScore,
  config,
  title = 'Risk Matrix Preview',
  helperText
}) => {
  const orderedLikelihood = useMemo(
    () => [...likelihoodScale].sort((a, b) => a.value - b.value),
    [likelihoodScale]
  );
  const orderedImpact = useMemo(
    () => [...impactScale].sort((a, b) => a.value - b.value),
    [impactScale]
  );

  const matrix = useMemo(
    () => buildRiskMatrix(orderedLikelihood, orderedImpact, appetiteThresholdScore, config),
    [appetiteThresholdScore, config, orderedImpact, orderedLikelihood]
  );

  const cellByKey = useMemo(() => {
    const index = new Map<string, RiskMatrixCell>();
    matrix.forEach(cell => {
      index.set(`${cell.likelihoodId}::${cell.impactId}`, cell);
    });
    return index;
  }, [matrix]);

  if (orderedLikelihood.length === 0 || orderedImpact.length === 0) {
    return (
      <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2, p: 2 }}>
        <Typography variant="subtitle2">{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          Add at least one likelihood and one impact level to render the matrix.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>{title}</Typography>
      {helperText && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {helperText}
        </Typography>
      )}

      <Box sx={{ overflowX: 'auto' }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `minmax(150px, 220px) repeat(${orderedImpact.length}, minmax(88px, 1fr))`,
            minWidth: 180 + orderedImpact.length * 88
          }}
        >
          <Box sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">Likelihood \\ Impact</Typography>
          </Box>
          {orderedImpact.map(impact => (
            <Box key={impact.id} sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>{impact.label}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Value {impact.value}
              </Typography>
            </Box>
          ))}

          {orderedLikelihood.map(likelihood => (
            <React.Fragment key={likelihood.id}>
              <Box sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>{likelihood.label}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  Value {likelihood.value}
                </Typography>
              </Box>
              {orderedImpact.map(impact => {
                const cell = cellByKey.get(`${likelihood.id}::${impact.id}`);
                const backgroundColor = cell?.color || '#64748b';
                const textColor = getContrastColor(backgroundColor);
                return (
                  <Box
                    key={`${likelihood.id}-${impact.id}`}
                    sx={{
                      p: 1,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      textAlign: 'center',
                      backgroundColor,
                      color: textColor
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                      {cell?.score ?? likelihood.value * impact.value}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block' }}>
                      {cell?.ratingLabel || 'Unrated'}
                    </Typography>
                    {cell?.exceedsAppetite && (
                      <Typography variant="caption" sx={{ display: 'block', opacity: 0.9 }}>
                        Above appetite
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </React.Fragment>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default GrcRiskMatrixPreview;
