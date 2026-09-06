import React, { memo, useEffect, useState } from 'react';
import { Box, Tooltip } from '@mui/material';
import { Clock } from 'lucide-react';
import { useTheme } from '@mui/material/styles';

interface AutosaveCountdownProps {
  nextAutosaveAt: number | null;
  enabled: boolean;
}

export const AutosaveCountdown = memo(({ nextAutosaveAt, enabled }: AutosaveCountdownProps) => {
  const theme = useTheme();
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!enabled || nextAutosaveAt === null) {
      setCountdown(0);
      return;
    }

    const tick = () => {
      const remaining = Math.ceil((nextAutosaveAt - Date.now()) / 1000);
      setCountdown(Math.max(0, remaining));
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [enabled, nextAutosaveAt]);

  if (!enabled || countdown <= 0) {
    return null;
  }

  return (
    <Tooltip title="Autosave countdown" placement="bottom" arrow>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          color: theme.palette.text.secondary,
          opacity: 0.8,
          fontSize: '0.875rem',
          userSelect: 'none'
        }}
      >
        <Clock size={16} />
        <span>
          {Math.floor(countdown / 60)}:
          {String(countdown % 60).padStart(2, '0')}
        </span>
      </Box>
    </Tooltip>
  );
});

AutosaveCountdown.displayName = 'AutosaveCountdown';
