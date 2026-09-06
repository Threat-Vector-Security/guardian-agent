import React, { useState, useRef, useMemo, useEffect } from 'react';
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
import {
  materialIconMappings,
  getIconsByCategory,
  getIconCategories,
  getAllIcons
} from '../utils/materialIconMappings';
import {
  getVendorCategories,
  getVendorIconsByCategory,
  getAllVendorIcons,
  findVendorIconMappingByComponent,
  isVendorIconComponent
} from '../utils/vendorIconMappings';
import { IconMapping } from '../types/IconTypes';
import { getTheme } from '../styles/Theme';
import { useSettings } from '../settings/SettingsContext';
import { nodeTypeConfig } from './SecurityNodes';

interface IconSelectorProps {
  value?: React.ElementType | string;
  onChange: (icon: React.ElementType) => void;
  size?: number;
}

export const IconSelector: React.FC<IconSelectorProps> = ({
  value,
  onChange,
  size = 0.8
}) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Use global theme
  const { settings } = useSettings();
  const currentTheme = getTheme(settings.theme, settings.customTheme);
  const colors = currentTheme.colors;

  // Helper to get all node type icons as IconMappings
  const getNodeTypeIcons = (): IconMapping[] => {
    const nodeIcons: IconMapping[] = [];

    Object.entries(nodeTypeConfig).forEach(([nodeType, config]) => {
      // Skip if icon already exists in materialIconMappings
      if (materialIconMappings[nodeType]) return;

      // Format the name properly with spaces between words
      const formattedName = nodeType
        .replace(/([A-Z])/g, ' $1') // Add space before capital letters
        .replace(/([0-9]+)/g, ' $1') // Add space before numbers
        .trim()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

      nodeIcons.push({
        name: formattedName,
        icon: config.icon,
        category: 'security',
        keywords: [nodeType, ...formattedName.toLowerCase().split(' ')]
      });
    });

    return nodeIcons;
  };

  // Get ALL available icons from all sources
  const getAllAvailableIcons = (): IconMapping[] => {
    const materialIcons = getAllIcons();
    const vendorIcons = getAllVendorIcons();
    const nodeTypeIcons = getNodeTypeIcons();

    // Combine all icons and remove duplicates
    const allIcons = [...materialIcons, ...vendorIcons, ...nodeTypeIcons];
    const uniqueIcons = new Map<string, IconMapping>();

    allIcons.forEach(icon => {
      const key = `${icon.category}:${icon.name}`;
      if (!uniqueIcons.has(key)) {
        uniqueIcons.set(key, icon);
      }
    });

    return Array.from(uniqueIcons.values());
  };

  // Get all categories
  const categories = useMemo(() => {
    const materialCategories = getIconCategories();
    const vendorCategories = getVendorCategories();

    // Add 'security' category if we have node type icons
    const hasNodeTypeIcons = getNodeTypeIcons().length > 0;
    const allCategories = [
      'all',
      ...materialCategories,
      ...(hasNodeTypeIcons ? ['security'] : []),
      'divider',
      ...vendorCategories
    ];

    return allCategories;
  }, []);

  // Filter icons based on search and category
  const filteredIcons = useMemo(() => {
    let icons: IconMapping[] = [];

    // If searching, always search across ALL icons
    if (searchTerm.trim()) {
      // Get ALL icons for search
      icons = getAllAvailableIcons();

      const search = searchTerm.toLowerCase();
      const searchWords = search.split(/\s+/).filter(word => word.length > 0);

      icons = icons.filter(icon => {
        const iconName = icon.name.toLowerCase();
        const iconCategory = icon.category.toLowerCase();
        const iconKeywords = icon.keywords ? icon.keywords.join(' ').toLowerCase() : '';
        const combinedText = `${iconName} ${iconCategory} ${iconKeywords}`;

        // Check if ALL search words are found in the combined text
        return searchWords.every(word => combinedText.includes(word));
      });
    } else {
      // No search - filter by category
      if (selectedCategory === 'all') {
        // Get ALL icons from all sources
        icons = getAllAvailableIcons();
      } else if (selectedCategory === 'security') {
        // Get node type icons
        icons = getNodeTypeIcons();
      } else if (selectedCategory.includes('-')) {
        // Vendor category
        icons = getVendorIconsByCategory(selectedCategory);
      } else {
        // Material icon category
        icons = getIconsByCategory(selectedCategory);
      }
    }

    return icons;
  }, [searchTerm, selectedCategory]);

  // Get current icon name
  const selectedIconName = useMemo(() => {
    if (!value) return null;

    // Check material icons
    const materialMatch = Object.values(materialIconMappings).find(mapping => {
      if (mapping.icon === value) return true;
      if (typeof value === 'object' && value !== null && (value as any).type) {
        return mapping.icon === (value as any).type;
      }
      return false;
    });

    if (materialMatch) {
      return materialMatch.name;
    }

    // Check vendor icons
    const vendorMatch = findVendorIconMappingByComponent(value);
    if (vendorMatch) {
      return vendorMatch.name;
    }

    return 'Custom Icon';
  }, [value]);

  const handleIconSelect = (iconMapping: IconMapping) => {
    onChange(iconMapping.icon);
    setOpen(false);
    setSearchTerm('');
  };

  const renderIcon = (icon: React.ElementType | any, isInGrid: boolean = false) => {
    if (!icon) return null;

    const isVendor = isVendorIconComponent(icon);
    const iconSize = isInGrid ? 24 : 16;

    if (isVendor) {
      return React.createElement(icon, {
        style: {
          width: iconSize,
          height: iconSize,
          display: 'block'
        }
      });
    } else {
      return React.createElement(icon, {
        sx: {
          fontSize: iconSize,
          color: 'currentColor'
        }
      });
    }
  };

  return (
    <>
      <Tooltip title={selectedIconName || 'Select an icon'}>
        <IconButton
          ref={buttonRef}
          onClick={() => setOpen(true)}
          sx={{
            border: `1px solid ${colors.border}`,
            borderRadius: 1,
            padding: '4px 10px',
            color: colors.textPrimary,
            '&:hover': {
              borderColor: colors.primary,
              backgroundColor: colors.surfaceHover
            }
          }}
        >
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}>
            {value && renderIcon(value)}
            <Typography variant="caption">
              {value ? 'Change' : 'Select'}
            </Typography>
          </Box>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        onClose={() => {
          setOpen(false);
          setSearchTerm('');
        }}
        anchorEl={buttonRef.current}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        <Box sx={{
          width: 400,
          maxHeight: 600,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: colors.surface
        }}>
          {/* Header */}
          <Box sx={{ p: 2, borderBottom: `1px solid ${colors.border}` }}>
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
              Select Icon
            </Typography>

            {/* Search */}
            <TextField
              size="small"
              fullWidth
              placeholder="Search icons..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setSearchTerm('')}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </Box>

          {/* Categories */}
          <Box sx={{
            p: 2,
            borderBottom: `1px solid ${colors.border}`,
            maxHeight: 120,
            overflowY: 'auto'
          }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {categories.map(category => {
                if (category === 'divider') {
                  return (
                    <Box key={category} sx={{
                      width: '100%',
                      height: 1,
                      bgcolor: colors.border,
                      my: 1
                    }} />
                  );
                }

                const isVendor = category.includes('-');
                const label = category === 'all' ? 'All Icons' :
                  category === 'security' ? 'Security Nodes' :
                  isVendor ? category.toUpperCase().replace(/-/g, ' ') :
                  category.charAt(0).toUpperCase() + category.slice(1);

                return (
                  <Chip
                    key={category}
                    label={label}
                    size="small"
                    variant={selectedCategory === category ? 'filled' : 'outlined'}
                    onClick={() => setSelectedCategory(category)}
                    sx={{
                      borderStyle: isVendor ? 'dashed' : 'solid'
                    }}
                  />
                );
              })}
            </Box>
          </Box>

          {/* Results count */}
          <Box sx={{ px: 2, py: 1, borderBottom: `1px solid ${colors.border}` }}>
            <Typography variant="caption" color="textSecondary">
              {filteredIcons.length} icons found
              {searchTerm && ' (searching all icons)'}
              {!searchTerm && selectedCategory !== 'all' && ` in ${
                selectedCategory === 'security' ? 'Security Nodes' :
                selectedCategory.includes('-') ? selectedCategory.toUpperCase().replace(/-/g, ' ') :
                selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)
              }`}
            </Typography>
          </Box>

          {/* Icon Grid */}
          <Box sx={{
            flex: 1,
            overflowY: 'scroll',
            p: 2
          }}>
            {filteredIcons.length === 0 ? (
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: colors.textSecondary
              }}>
                <Typography>No icons found</Typography>
              </Box>
            ) : (
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(50px, 1fr))',
                gap: 1
              }}>
                {filteredIcons.map((iconMapping, index) => {
                  const isSelected = value === iconMapping.icon ||
                    (value && selectedIconName === iconMapping.name);

                  return (
                    <Tooltip
                      key={`${iconMapping.name}-${index}`}
                      title={iconMapping.name}
                    >
                      <IconButton
                        onClick={() => handleIconSelect(iconMapping)}
                        sx={{
                          p: 1,
                          aspectRatio: '1',
                          backgroundColor: isSelected ?
                            `${colors.primary}20` : 'transparent',
                          border: isSelected ?
                            `1px solid ${colors.primary}` : '1px solid transparent',
                          '&:hover': {
                            backgroundColor: colors.surfaceHover,
                            borderColor: colors.primary
                          }
                        }}
                      >
                        {renderIcon(iconMapping.icon, true)}
                      </IconButton>
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