import React, { useState, useRef, useMemo } from 'react';
import { 
  Box, 
  IconButton, 
  Popover, 
  TextField, 
  Typography,
  Chip,
  InputAdornment,
  Tooltip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import Shape from './shapes';
import { 
  NodeShape, 
  shapeMetadata, 
  getShapesByCategory, 
  getShapeCategories,
  DEFAULT_NODE_SHAPE
} from '../types/ShapeTypes';
import { getTheme } from '../styles/Theme';
import { useSettings } from '../settings/SettingsContext';

interface ShapeSelectorProps {
  value?: NodeShape;
  onChange: (shape: NodeShape) => void;
  size?: number;
}

export const ShapeSelector: React.FC<ShapeSelectorProps> = ({ 
  value = DEFAULT_NODE_SHAPE, 
  onChange, 
  size = 0.8
}) => {
  const [open, setOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'basic' | 'security' | 'infrastructure' | 'specialized'>('all');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Use global theme
  const { settings } = useSettings();
  const currentTheme = getTheme(settings.theme, settings.customTheme);
  const colors = currentTheme.colors;

  // Get all categories with 'all' option
  const categories = useMemo(() => {
    return ['all', ...getShapeCategories()] as const;
  }, []);

  // Filter shapes based on search and category
  const filteredShapes = useMemo(() => {
    let shapes: NodeShape[] = [];
    
    if (selectedCategory === 'all') {
      shapes = Object.keys(shapeMetadata) as NodeShape[];
    } else {
      shapes = getShapesByCategory(selectedCategory);
    }
    
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      shapes = shapes.filter(shape => {
        const metadata = shapeMetadata[shape];
        return metadata.displayName.toLowerCase().includes(search) ||
               metadata.description.toLowerCase().includes(search) ||
               metadata.category.toLowerCase().includes(search);
      });
    }
    
    return shapes;
  }, [searchTerm, selectedCategory]);

  const handleClearSearch = () => {
    setSearchTerm('');
  };

  const handleCategoryClick = (category: typeof selectedCategory) => {
    setSelectedCategory(category);
    setSearchTerm(''); // Clear search when changing category
  };

  const handleShapeSelect = (shape: NodeShape) => {
    onChange(shape);
    setOpen(false);
  };

  const formatCategoryName = (category: string) => {
    if (category === 'all') return 'All Shapes';
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  // Get current shape metadata
  const currentShapeMetadata = shapeMetadata[value];

  return (
    <>
      <Tooltip title={currentShapeMetadata.displayName} placement="top" leaveDelay={0} enterDelay={300}>
        <IconButton 
          onClick={() => setOpen(true)}
          sx={{ 
            border: `1px solid ${colors.border}`,
            borderRadius: 1,
            padding: '4px 10px',
            color: colors.textPrimary,
            fontSize: '12px',
            height: '32px',
            minWidth: '100px',
            '&:hover': {
              borderColor: colors.primary,
              backgroundColor: colors.surfaceHover
            }
          }}
          ref={buttonRef}
        >
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1,
            whiteSpace: 'nowrap'
          }}>
            <Box sx={{ width: 20, height: 20, position: 'relative' }}>
              <Shape
                type={value}
                width={20}
                height={20}
                fill={colors.primary}
                fillOpacity={0.8}
                stroke={colors.primary}
                strokeWidth={1}
              />
            </Box>
            <Typography variant="caption" sx={{ color: 'inherit' }}>
              Change Shape
            </Typography>
          </Box>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        anchorEl={buttonRef.current}
        PaperProps={{
          sx: {
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 2,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            overflow: 'hidden'
          }
        }}
      >
        <Box sx={{ 
          width: 400,
          maxHeight: 500,
          backgroundColor: colors.surface,
        }}>
          {/* Header */}
          <Box sx={{ 
            p: 2, 
            borderBottom: `1px solid ${colors.border}`,
            backgroundColor: colors.surfaceHover
          }}>
            <Typography variant="subtitle1" sx={{ 
              color: colors.textPrimary,
              fontWeight: 600,
              mb: 2
            }}>
              Select Shape
            </Typography>
            
            {/* Search Field */}
            <TextField
              size="small"
              placeholder="Search shapes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: colors.textSecondary, fontSize: 18 }} />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton onClick={handleClearSearch} size="small">
                      <ClearIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </InputAdornment>
                )
              }}
              sx={{ 
                '& .MuiOutlinedInput-root': {
                  backgroundColor: colors.background,
                  color: colors.textPrimary,
                  '& fieldset': {
                    borderColor: colors.border,
                  },
                  '&:hover fieldset': {
                    borderColor: colors.primary,
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: colors.primary,
                  },
                },
                '& .MuiInputBase-input': {
                  color: colors.textPrimary,
                },
              }}
            />
          </Box>

          {/* Category Chips */}
          <Box sx={{ 
            p: 2, 
            borderBottom: `1px solid ${colors.border}`,
            backgroundColor: colors.surface
          }}>
            <Typography variant="caption" sx={{ 
              color: colors.textSecondary,
              mb: 1,
              display: 'block'
            }}>
              Categories
            </Typography>
            <Box sx={{ 
              display: 'flex', 
              flexWrap: 'wrap',
              gap: 0.5 
            }}>
              {categories.map(category => (
                <Chip
                  key={category}
                  label={formatCategoryName(category)}
                  onClick={() => handleCategoryClick(category)}
                  variant={selectedCategory === category ? 'filled' : 'outlined'}
                  size="small"
                  sx={{
                    fontSize: '0.75rem',
                    height: 24,
                    color: selectedCategory === category ? 
                      colors.background : colors.textSecondary,
                    backgroundColor: selectedCategory === category ? 
                      colors.primary : 'transparent',
                    borderColor: selectedCategory === category ? 
                      colors.primary : colors.border,
                    '&:hover': {
                      backgroundColor: selectedCategory === category ? 
                        colors.primary : colors.surfaceHover,
                      borderColor: colors.primary
                    }
                  }}
                />
              ))}
            </Box>
          </Box>

          {/* Results Info */}
          <Box sx={{ 
            px: 2, 
            py: 1, 
            backgroundColor: colors.surface,
            borderBottom: `1px solid ${colors.border}`
          }}>
            <Typography variant="caption" sx={{ color: colors.textSecondary }}>
              {filteredShapes.length} shape{filteredShapes.length !== 1 ? 's' : ''} found
              {selectedCategory !== 'all' && ` in ${formatCategoryName(selectedCategory)}`}
            </Typography>
          </Box>

          {/* Shape Grid */}
          <Box 
            ref={gridRef}
            sx={{ 
              maxHeight: 280,
              overflowY: 'auto',
              p: 1,
              backgroundColor: colors.surface,
              '&::-webkit-scrollbar': {
                width: '6px',
              },
              '&::-webkit-scrollbar-track': {
                background: colors.background,
              },
              '&::-webkit-scrollbar-thumb': {
                background: colors.border,
                borderRadius: '3px',
                '&:hover': {
                  background: colors.surfaceHover,
                },
              },
            }}
          >
            {filteredShapes.length === 0 ? (
              <Box sx={{ 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 120,
                color: colors.textSecondary
              }}>
                <Typography variant="body2">
                  No shapes found matching "{searchTerm}"
                </Typography>
              </Box>
            ) : (
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                gap: 1,
              }}>
                {filteredShapes.map((shape, index) => {
                  const isSelected = shape === value;
                  const metadata = shapeMetadata[shape];
                  
                  return (
                    <Tooltip
                      key={`${shape}-${index}`}
                      title={
                        <Box>
                          <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                            {metadata.displayName}
                          </Typography>
                          <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                            {metadata.description}
                          </Typography>
                        </Box>
                      }
                      placement="top"
                      open={hoveredIndex === index}
                      enterDelay={200}
                      leaveDelay={0}
                    >
                      <Box
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        onClick={() => handleShapeSelect(shape)}
                        sx={{
                          p: 1.5,
                          aspectRatio: '1',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 0.5,
                          cursor: 'pointer',
                          backgroundColor: isSelected ? `${colors.primary}20` : 'transparent',
                          border: isSelected ? `1px solid ${colors.primary}` : '1px solid transparent',
                          borderRadius: 1,
                          '&:hover': {
                            backgroundColor: isSelected ? `${colors.primary}30` : colors.surfaceHover,
                            borderColor: colors.primary
                          }
                        }}
                      >
                        <Box sx={{ width: 40, height: 40, position: 'relative' }}>
                          <Shape
                            type={shape}
                            width={40}
                            height={40}
                            fill={isSelected ? colors.primary : colors.textSecondary}
                            fillOpacity={0.8}
                            stroke={isSelected ? colors.primary : colors.textSecondary}
                            strokeWidth={1}
                          />
                        </Box>
                        <Typography variant="caption" sx={{ 
                          fontSize: '0.7rem',
                          color: isSelected ? colors.primary : colors.textSecondary,
                          textAlign: 'center',
                          lineHeight: 1.2
                        }}>
                          {metadata.displayName}
                        </Typography>
                      </Box>
                    </Tooltip>
                  );
                })}
              </Box>
            )}
          </Box>
        </Box>
      </Popover>
    </>
  );
};