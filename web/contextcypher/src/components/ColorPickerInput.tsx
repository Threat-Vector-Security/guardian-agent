import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  Popover,
  Typography,
  IconButton,
  Tooltip,
  InputAdornment,
  Button,
  Tabs,
  Tab,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  ContentCopy,
  Close,
  Check,
  ColorLens,
} from '@mui/icons-material';
import { useSettings } from '../settings/SettingsContext';
import { getTheme } from '../styles/Theme';

interface ColorPickerInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
}

const ColorSwatch = styled(Box)(({ theme }) => ({
  width: 44,
  height: 44,
  borderRadius: 8,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s ease',
  position: 'relative',
  border: `2px solid ${theme.colors.border}`,
  '&:hover': {
    transform: 'scale(1.05)',
    borderColor: theme.colors.primary,
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  },
}));

const ColorGrid = styled(Box)({
  display: 'grid',
  gridTemplateColumns: 'repeat(12, 1fr)',
  gap: 4,
  padding: 8,
});


const ColorOption = styled(Box)<{ selected?: boolean }>(({ theme, selected }) => ({
  width: 28,
  height: 28,
  borderRadius: 4,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  border: selected ? `2px solid ${theme.colors.primary}` : '1px solid transparent',
  position: 'relative',
  '&:hover': {
    transform: 'scale(1.15)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
    zIndex: 10,
  },
  ...(selected && {
    '&::after': {
      content: '"✓"',
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      fontSize: '12px',
      fontWeight: 'bold',
    }
  })
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    backgroundColor: theme.colors.surface,
    '& fieldset': {
      borderColor: theme.colors.border,
    },
    '&:hover fieldset': {
      borderColor: theme.colors.primary,
    },
    '&.Mui-focused fieldset': {
      borderColor: theme.colors.primary,
    },
  },
  '& .MuiInputLabel-root': {
    color: theme.colors.textSecondary,
    '&.Mui-focused': {
      color: theme.colors.primary,
    },
  },
}));

const TabPanel = styled(Box)({
  padding: 16,
  height: 'calc(100% - 48px)',
  overflowY: 'auto',
});

export const ColorPickerInput: React.FC<ColorPickerInputProps> = ({
  label,
  value,
  onChange,
  fullWidth = true,
  size = 'small',
}) => {
  const { settings } = useSettings();
  const theme = React.useMemo(() => getTheme(settings.theme, settings.customTheme), [settings.theme, settings.customTheme]);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [localValue, setLocalValue] = useState(value);
  const [activeTab, setActiveTab] = useState(0);
  const [copySuccess, setCopySuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleColorSelect = (color: string) => {
    setLocalValue(color);
    onChange(color);
    handleClose();
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setLocalValue(newValue);
    // Only update if it's a valid color format
    if (/^#[0-9A-Fa-f]{6}$/.test(newValue) || /^#[0-9A-Fa-f]{3}$/.test(newValue)) {
      onChange(newValue);
    }
  };

  const handleInputBlur = () => {
    // Validate and format color on blur
    if (/^#[0-9A-Fa-f]{3}$/.test(localValue)) {
      // Convert 3-digit hex to 6-digit
      const expanded = `#${localValue[1]}${localValue[1]}${localValue[2]}${localValue[2]}${localValue[3]}${localValue[3]}`;
      setLocalValue(expanded);
      onChange(expanded);
    } else if (!/^#[0-9A-Fa-f]{6}$/.test(localValue)) {
      // Reset to previous valid value if invalid
      setLocalValue(value);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const open = Boolean(anchorEl);

  // Comprehensive color palette
  const colorPalette = [
    // Row 1 - Reds
    '#ffebee', '#ffcdd2', '#ef9a9a', '#e57373', '#ef5350', '#f44336', '#e53935', '#d32f2f', '#c62828', '#b71c1c', '#ff8a80', '#ff5252',
    // Row 2 - Pinks
    '#fce4ec', '#f8bbd0', '#f48fb1', '#f06292', '#ec407a', '#e91e63', '#d81b60', '#c2185b', '#ad1457', '#880e4f', '#ff80ab', '#ff4081',
    // Row 3 - Purples
    '#f3e5f5', '#e1bee7', '#ce93d8', '#ba68c8', '#ab47bc', '#9c27b0', '#8e24aa', '#7b1fa2', '#6a1b9a', '#4a148c', '#ea80fc', '#e040fb',
    // Row 4 - Deep Purples
    '#ede7f6', '#d1c4e9', '#b39ddb', '#9575cd', '#7e57c2', '#673ab7', '#5e35b1', '#512da8', '#4527a0', '#311b92', '#b388ff', '#7c4dff',
    // Row 5 - Indigos
    '#e8eaf6', '#c5cae9', '#9fa8da', '#7986cb', '#5c6bc0', '#3f51b5', '#3949ab', '#303f9f', '#283593', '#1a237e', '#8c9eff', '#536dfe',
    // Row 6 - Blues
    '#e3f2fd', '#bbdefb', '#90caf9', '#64b5f6', '#42a5f5', '#2196f3', '#1e88e5', '#1976d2', '#1565c0', '#0d47a1', '#82b1ff', '#448aff',
    // Row 7 - Light Blues
    '#e1f5fe', '#b3e5fc', '#81d4fa', '#4fc3f7', '#29b6f6', '#03a9f4', '#039be5', '#0288d1', '#0277bd', '#01579b', '#80d8ff', '#40c4ff',
    // Row 8 - Cyans
    '#e0f7fa', '#b2ebf2', '#80deea', '#4dd0e1', '#26c6da', '#00bcd4', '#00acc1', '#0097a7', '#00838f', '#006064', '#84ffff', '#18ffff',
    // Row 9 - Teals
    '#e0f2f1', '#b2dfdb', '#80cbc4', '#4db6ac', '#26a69a', '#009688', '#00897b', '#00796b', '#00695c', '#004d40', '#a7ffeb', '#64ffda',
    // Row 10 - Greens
    '#e8f5e9', '#c8e6c9', '#a5d6a7', '#81c784', '#66bb6a', '#4caf50', '#43a047', '#388e3c', '#2e7d32', '#1b5e20', '#b9f6ca', '#69f0ae',
    // Row 11 - Light Greens
    '#f1f8e9', '#dcedc8', '#c5e1a5', '#aed581', '#9ccc65', '#8bc34a', '#7cb342', '#689f38', '#558b2f', '#33691e', '#ccff90', '#b2ff59',
    // Row 12 - Limes
    '#f9fbe7', '#f0f4c3', '#e6ee9c', '#dce775', '#d4e157', '#cddc39', '#c0ca33', '#afb42b', '#9e9d24', '#827717', '#f4ff81', '#eeff41',
    // Row 13 - Yellows
    '#fffde7', '#fff9c4', '#fff59d', '#fff176', '#ffee58', '#ffeb3b', '#fdd835', '#fbc02d', '#f9a825', '#f57f17', '#ffff8d', '#ffff00',
    // Row 14 - Ambers
    '#fff8e1', '#ffecb3', '#ffe082', '#ffd54f', '#ffca28', '#ffc107', '#ffb300', '#ffa000', '#ff8f00', '#ff6f00', '#ffe57f', '#ffd740',
    // Row 15 - Oranges
    '#fff3e0', '#ffe0b2', '#ffcc80', '#ffb74d', '#ffa726', '#ff9800', '#fb8c00', '#f57c00', '#ef6c00', '#e65100', '#ffd180', '#ffab40',
    // Row 16 - Deep Oranges
    '#fbe9e7', '#ffccbc', '#ffab91', '#ff8a65', '#ff7043', '#ff5722', '#f4511e', '#e64a19', '#d84315', '#bf360c', '#ff9e80', '#ff6e40',
    // Row 17 - Browns
    '#efebe9', '#d7ccc8', '#bcaaa4', '#a1887f', '#8d6e63', '#795548', '#6d4c41', '#5d4037', '#4e342e', '#3e2723',
    // Row 18 - Grays
    '#fafafa', '#f5f5f5', '#eeeeee', '#e0e0e0', '#bdbdbd', '#9e9e9e', '#757575', '#616161', '#424242', '#212121', '#000000', '#ffffff',
    // Row 19 - Blue Grays
    '#eceff1', '#cfd8dc', '#b0bec5', '#90a4ae', '#78909c', '#607d8b', '#546e7a', '#455a64', '#37474f', '#263238',
  ];

  // Recent colors (mock - in real app, this would be stored)
  const recentColors = ['#1976d2', '#dc004e', '#388e3c', '#7b1fa2'];

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Tooltip title="Click to pick a color">
          <ColorSwatch
            onClick={handleOpen}
            sx={{ backgroundColor: value }}
          >
            {value.toLowerCase() === '#ffffff' && (
              <Box
                sx={{
                  position: 'absolute',
                  inset: 2,
                  border: '1px dashed #ccc',
                  borderRadius: 4,
                }}
              />
            )}
          </ColorSwatch>
        </Tooltip>
        
        <StyledTextField
          fullWidth={fullWidth}
          size={size}
          label={label}
          value={localValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          inputRef={inputRef}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title={copySuccess ? "Copied!" : "Copy color"}>
                  <IconButton
                    size="small"
                    onClick={handleCopy}
                    sx={{ color: copySuccess ? theme.colors.success : theme.colors.textSecondary }}
                  >
                    {copySuccess ? <Check fontSize="small" /> : <ContentCopy fontSize="small" />}
                  </IconButton>
                </Tooltip>
              </InputAdornment>
            ),
          }}
          placeholder="#000000"
        />
      </Box>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        PaperProps={{
          sx: {
            width: 450,
            maxHeight: 600,
            backgroundColor: theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, borderBottom: `1px solid ${theme.colors.border}` }}>
          <Typography variant="subtitle2" sx={{ color: theme.colors.textPrimary, fontWeight: 600 }}>
            Choose Color
          </Typography>
          <IconButton size="small" onClick={handleClose}>
            <Close fontSize="small" />
          </IconButton>
        </Box>

        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{
            borderBottom: `1px solid ${theme.colors.border}`,
            '& .MuiTab-root': {
              minHeight: 36,
              fontSize: '0.813rem',
              textTransform: 'none',
            },
          }}
        >
          <Tab label="Presets" />
          <Tab label="Recent" />
          <Tab label="Custom" />
        </Tabs>

        {activeTab === 0 && (
          <TabPanel sx={{ pt: 2 }}>
            <Typography
              variant="caption"
              sx={{
                color: theme.colors.textSecondary,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                display: 'block',
                mb: 1,
              }}
            >
              Color Palette
            </Typography>
            <ColorGrid>
              {colorPalette.map((color) => (
                <Tooltip key={color} title={color.toUpperCase()} arrow placement="top">
                  <ColorOption
                    onClick={() => handleColorSelect(color)}
                    selected={color.toLowerCase() === value.toLowerCase()}
                    sx={{
                      backgroundColor: color,
                      color: getContrastColor(color),
                    }}
                  />
                </Tooltip>
              ))}
            </ColorGrid>
          </TabPanel>
        )}

        {activeTab === 1 && (
          <TabPanel>
            <Typography
              variant="caption"
              sx={{
                color: theme.colors.textSecondary,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Recently Used
            </Typography>
            <ColorGrid sx={{ mt: 2 }}>
              {recentColors.map((color) => (
                <Tooltip key={color} title={color.toUpperCase()} arrow placement="top">
                  <ColorOption
                    onClick={() => handleColorSelect(color)}
                    selected={color.toLowerCase() === value.toLowerCase()}
                    sx={{
                      backgroundColor: color,
                      color: getContrastColor(color),
                    }}
                  />
                </Tooltip>
              ))}
            </ColorGrid>
          </TabPanel>
        )}

        {activeTab === 2 && (
          <TabPanel>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                fullWidth
                size="small"
                label="Hex Color"
                value={localValue}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                placeholder="#000000"
                helperText="Enter a hex color code"
              />
              <Button
                fullWidth
                variant="contained"
                startIcon={<ColorLens />}
                onClick={() => {
                  if (/^#[0-9A-Fa-f]{6}$/.test(localValue)) {
                    handleColorSelect(localValue);
                  }
                }}
                disabled={!/^#[0-9A-Fa-f]{6}$/.test(localValue)}
              >
                Apply Color
              </Button>
            </Box>
          </TabPanel>
        )}
      </Popover>
    </>
  );
};

// Helper function to determine contrast color
function getContrastColor(hex: string): string {
  // Convert hex to RGB
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5 ? '#000000' : '#ffffff';
}