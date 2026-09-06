import React, { useState, useEffect, useId } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  Divider,
  Typography,
  Box,
  useTheme,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import { ChevronDown } from 'lucide-react';
import { transitions } from '../styles/Theme';
import { useMenuContext } from '../contexts/MenuContext';

export type MenuItemConfig = 
  | {
      label: string;
      action: string;
      icon?: React.ReactNode;
      shortcut?: string;
      disabled?: boolean;
      proBadge?: boolean;
      submenu?: MenuItemConfig[];
    }
  | {
      divider: true;
    };

interface ToolbarMenuProps {
  label: string;
  items: MenuItemConfig[];
  onItemClick: (action: string) => void;
  disabled?: boolean;
  compactMode?: boolean;
}

const ToolbarMenu: React.FC<ToolbarMenuProps> = ({
  label,
  items,
  onItemClick,
  disabled = false,
  compactMode = false
}) => {
  const theme = useTheme();
  const menuId = useId();
  const { activeMenu, setActiveMenu, registerMenu, unregisterMenu } = useMenuContext();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [submenuAnchorEl, setSubmenuAnchorEl] = useState<null | HTMLElement>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  
  const isOpen = activeMenu === menuId && Boolean(anchorEl);

  useEffect(() => {
    registerMenu(menuId);
    return () => {
      unregisterMenu(menuId);
    };
  }, [menuId, registerMenu, unregisterMenu]);

  useEffect(() => {
    // Close this menu if another menu becomes active
    if (activeMenu !== menuId && activeMenu !== null) {
      setAnchorEl(null);
      setSubmenuAnchorEl(null);
      setActiveSubmenu(null);
    }
  }, [activeMenu, menuId]);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isOpen) {
      // Close if already open
      setActiveMenu(null);
      setAnchorEl(null);
    } else {
      // Open this menu and close others
      setActiveMenu(menuId);
      setAnchorEl(event.currentTarget);
    }
  };

  const handleClose = () => {
    setActiveMenu(null);
    setAnchorEl(null);
    setSubmenuAnchorEl(null);
    setActiveSubmenu(null);
  };

  const handleItemClick = (action: string) => {
    onItemClick(action);
    handleClose();
  };

  const handleSubmenuToggle = (event: React.MouseEvent<HTMLLIElement>, itemLabel: string) => {
    event.preventDefault();
    event.stopPropagation();

    if (activeSubmenu === itemLabel) {
      setActiveSubmenu(null);
      setSubmenuAnchorEl(null);
      return;
    }

    setSubmenuAnchorEl(event.currentTarget);
    setActiveSubmenu(itemLabel);
  };

  const renderMenuItem = (item: MenuItemConfig, index: number) => {
    if ('divider' in item && item.divider) {
      return <Divider key={`divider-${index}`} sx={{ my: 0.5 }} />;
    }

    if (!('divider' in item) && item.submenu) {
      return (
        <React.Fragment key={item.label}>
          <MenuItem
            onClick={(e) => handleSubmenuToggle(e, item.label)}
            disabled={item.disabled}
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              '&:hover': {
                backgroundColor: theme.colors.surfaceHover,
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {item.icon && (
                <ListItemIcon sx={{ minWidth: 32, color: theme.colors.textSecondary }}>
                  {item.icon}
                </ListItemIcon>
              )}
              <ListItemText 
                primary={item.label}
                sx={{ 
                  '& .MuiTypography-root': { 
                    fontSize: '14px',
                    color: item.disabled ? theme.colors.textSecondary : theme.colors.textPrimary
                  } 
                }}
              />
            </Box>
            <ChevronDown size={16} style={{ transform: 'rotate(-90deg)', marginLeft: 16 }} />
          </MenuItem>
          <Menu
            anchorEl={submenuAnchorEl}
            open={activeSubmenu === item.label}
            onClose={() => {
              setActiveSubmenu(null);
              setSubmenuAnchorEl(null);
            }}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'left',
            }}
            PaperProps={{
              sx: {
                backgroundColor: theme.colors.surface,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '8px',
                color: theme.colors.textPrimary,
                minWidth: '200px',
                ml: 0.5,
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
              }
            }}
          >
            {item.submenu.map((subItem, subIndex) => renderMenuItem(subItem, subIndex))}
          </Menu>
        </React.Fragment>
      );
    }

    // Type guard to ensure we have a regular menu item (not a divider)
    if ('divider' in item) return null;
    
    return (
      <MenuItem
        key={item.label}
        onClick={() => handleItemClick(item.action)}
        disabled={item.disabled}
        sx={{
          fontSize: '14px',
          py: 1,
          '&:hover': {
            backgroundColor: theme.colors.surfaceHover,
          }
        }}
      >
        {item.icon && (
          <ListItemIcon sx={{ minWidth: 32, color: theme.colors.textSecondary }}>
            {item.icon}
          </ListItemIcon>
        )}
        <ListItemText 
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {item.label}
              {!('divider' in item) && item.proBadge && (
                <Typography
                  variant="caption"
                  sx={{
                    backgroundColor: theme.colors.primary,
                    color: theme.palette.primary.contrastText,
                    px: 0.5,
                    py: 0.1,
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 600,
                    lineHeight: 1.2,
                  }}
                >
                  PRO
                </Typography>
              )}
            </Box>
          }
          sx={{ 
            '& .MuiTypography-root': { 
              fontSize: '14px',
              color: item.disabled ? theme.colors.textSecondary : theme.colors.textPrimary
            } 
          }}
        />
        {item.shortcut && (
          <Typography
            variant="caption"
            sx={{
              ml: 3,
              color: theme.colors.textSecondary,
              fontSize: '12px',
              opacity: 0.7
            }}
          >
            {item.shortcut}
          </Typography>
        )}
      </MenuItem>
    );
  };

  return (
    <>
      <Button
        color="inherit"
        onClick={handleClick}
        disabled={disabled}
        endIcon={<ChevronDown size={16} />}
        sx={{
          color: theme.colors.textPrimary,
          transition: transitions.default,
          mr: compactMode ? 0 : 2,
          fontSize: '14px',
          py: compactMode ? 0.75 : 1,
          px: compactMode ? 1.25 : 2,
          minWidth: compactMode ? 'auto' : undefined,
          '&:hover': {
            backgroundColor: theme.colors.surfaceHover
          },
          '&:disabled': {
            color: theme.colors.textSecondary
          }
        }}
      >
        {label}
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={isOpen}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: compactMode ? 'right' : 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: compactMode ? 'right' : 'left',
        }}
        MenuListProps={{
          dense: compactMode,
          sx: {
            py: 0.5
          }
        }}
        PaperProps={{
          sx: {
            backgroundColor: theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '8px',
            color: theme.colors.textPrimary,
            minWidth: compactMode ? 'min(92vw, 320px)' : '220px',
            maxHeight: 'calc(100dvh - 72px)',
            overflowY: 'auto',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
            mt: 1
          }
        }}
      >
        {items.map((item, index) => renderMenuItem(item, index))}
      </Menu>
    </>
  );
};

export default ToolbarMenu;
