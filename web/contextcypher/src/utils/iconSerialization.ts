// Icon serialization utilities for saving/loading diagrams
import React from 'react';
import { materialIconMappings, getIconForNodeType } from './materialIconMappings';
import {
  getVendorIconComponentById,
  getVendorIconMetadataFromComponent
} from './vendorIconMappings';
import { SecurityNodeType } from '../types/SecurityTypes';
import { getDefaultShapeForType } from './shapeDefaults';

// Helper to get icon name from Material-UI component
export const getIconName = (IconComponent: any): string | null => {
  const vendorMeta = getVendorIconMetadataFromComponent(IconComponent);
  if (vendorMeta) {
    return vendorMeta.iconId;
  }

  // Find the icon name in our mappings
  const mapping = Object.entries(materialIconMappings).find(([, config]) => {
    // Handle direct comparison
    if (config.icon === IconComponent) {
      return true;
    }
    
    // Handle memoized components - check if they wrap the same component
    if (IconComponent && typeof IconComponent === 'object' && IconComponent.$$typeof) {
      // This is a React element/memo, try to get the underlying type
      const actualType = IconComponent.type || IconComponent;
      if (config.icon === actualType) {
        return true;
      }
    }
    
    // Handle case where both are memoized/wrapped - compare their underlying types
    if (config.icon && typeof config.icon === 'object' && (config.icon as any).$$typeof &&
        IconComponent && typeof IconComponent === 'object' && IconComponent.$$typeof) {
      const configType = (config.icon as any).type || config.icon;
      const iconType = IconComponent.type || IconComponent;
      if (configType === iconType) {
        return true;
      }
    }
    
    return false;
  });
  
  if (mapping) {
    const [key, config] = mapping;
    return config.iconId ?? key;
  }

  return null;
};

// Helper to get Material-UI component from icon name
export const getIconFromName = (iconName: string): React.ElementType | null => {
  if (iconName.startsWith('vendor:')) {
    return getVendorIconComponentById(iconName);
  }

  return materialIconMappings[iconName]?.icon || null;
};

// Serialize icon for saving to JSON
export const serializeIcon = (icon: any): string | null => {
  if (!icon) return null;
  
  console.log('serializeIcon: Processing icon:', {
    icon,
    iconType: typeof icon,
    iconName: icon?.name,
    iconDisplayName: icon?.displayName,
    isFunction: typeof icon === 'function',
    isObject: typeof icon === 'object',
    hasTypeof: icon?.$$typeof
  });
  
  if (typeof icon === 'string') {
    return icon;
  }
  
  // If it's a React component, find its name in our mappings
  if (typeof icon === 'function' || (typeof icon === 'object' && icon !== null && icon.$$typeof)) {
    const vendorMeta = getVendorIconMetadataFromComponent(icon);
    if (vendorMeta) {
      return vendorMeta.iconId;
    }

    const iconName = getIconName(icon);
    console.log('serializeIcon: getIconName returned:', iconName);
    
    if (iconName) {
      return iconName;
    }
    
    // If not found in mappings, try to extract name from the component
    // Material-UI icons often have names like "AccountBalanceWalletIcon"
    let componentName = icon.name || icon.displayName;
    
    // For memoized components, try to get the name from the wrapped component
    if (!componentName && icon.type) {
      componentName = icon.type.name || icon.type.displayName;
    }
    
    // If we have a component name that looks like a Material-UI icon (ends with "Icon")
    if (componentName && componentName.endsWith('Icon')) {
      // Try to find it in our mappings by component name
      const matchingMapping = Object.entries(materialIconMappings).find(([, config]) => {
        const configIcon = config.icon as any;
        const configComponentName = configIcon.name || configIcon.displayName || 
                                   (configIcon.type && (configIcon.type.name || configIcon.type.displayName));
        return configComponentName === componentName;
      });
      
      if (matchingMapping) {
        console.log('serializeIcon: Found mapping by component name:', matchingMapping[0]);
        return matchingMapping[0];
      }
    }
    
    console.log('serializeIcon: Using component name as fallback:', componentName);
    return componentName || null;
  }
  
  // Handle serialized objects that might contain component info
  if (typeof icon === 'object' && icon !== null) {
    if (icon.name) return icon.name;
    if (icon.displayName) return icon.displayName;
  }
  
  console.log('serializeIcon: Could not serialize icon, returning null');
  return null;
};

// Deserialize icon when loading from JSON
export const deserializeIcon = (
  iconData: any, 
  nodeType: SecurityNodeType
): React.ElementType => {
  // If no icon data, use default for node type
  if (!iconData) {
    return getIconForNodeType(nodeType);
  }
  
  // If it's already a valid React component, return it
  if (typeof iconData === 'function') {
    return iconData;
  }
  
  // If it's a string (icon name), get the component
  if (typeof iconData === 'string') {
    console.log('deserializeIcon: Processing string iconData:', iconData);
    
    if (iconData.startsWith('vendor:')) {
      const vendorIcon = getVendorIconComponentById(iconData);
      if (vendorIcon) {
        return vendorIcon;
      }
    }

    // First try to get from our mappings
    const IconComponent = getIconFromName(iconData);
    if (IconComponent) {
      console.log('deserializeIcon: Found icon in mappings:', iconData);
      return IconComponent;
    }
    
    // If not found in mappings, it might be a component name (like "AccountBalanceWalletIcon")
    // Try to find it by component name
    if (iconData.endsWith('Icon')) {
      const matchingMapping = Object.entries(materialIconMappings).find(([, config]) => {
        const configIcon = config.icon as any;
        const configComponentName = configIcon.name || configIcon.displayName || 
                                   (configIcon.type && (configIcon.type.name || configIcon.type.displayName));
        return configComponentName === iconData;
      });
      
      if (matchingMapping) {
        console.log('deserializeIcon: Found icon by component name:', matchingMapping[0]);
        return matchingMapping[1].icon;
      }
    }
    
    console.log('deserializeIcon: Could not find icon, using default for node type');
    return getIconForNodeType(nodeType);
  }
  
  // If it's an object (serialized), try to extract the name
  if (typeof iconData === 'object' && iconData !== null) {
    // Handle various serialized formats
    if (iconData.name && typeof iconData.name === 'string') {
      if (iconData.name.startsWith('vendor:')) {
        const vendorIcon = getVendorIconComponentById(iconData.name);
        if (vendorIcon) {
          return vendorIcon;
        }
      }
      const IconComponent = getIconFromName(iconData.name);
      return IconComponent || getIconForNodeType(nodeType);
    }
    
    if (iconData.displayName && typeof iconData.displayName === 'string') {
      if (iconData.displayName.startsWith('vendor:')) {
        const vendorIcon = getVendorIconComponentById(iconData.displayName);
        if (vendorIcon) {
          return vendorIcon;
        }
      }
      const IconComponent = getIconFromName(iconData.displayName);
      return IconComponent || getIconForNodeType(nodeType);
    }

    // If it's a serialized React component, try to find by other properties
    if (iconData.$$typeof || iconData._owner) {
      // This is likely a serialized React element, fall back to default
      return getIconForNodeType(nodeType);
    }
  }
  
  // Fallback to default icon for node type
  return getIconForNodeType(nodeType);
};

// Helper to ensure all icons in node data are properly deserialized
export const normalizeNodeIcon = (
  nodeData: any, 
  nodeType: SecurityNodeType
): any => {
  if (!nodeData) return nodeData;
  
  return {
    ...nodeData,
    icon: deserializeIcon(nodeData.icon, nodeType)
  };
};

// Helper to serialize all icons in nodes for saving
export const serializeNodesForSave = (nodes: any[]): any[] => {
  return nodes.map(node => {
    const serializedIcon = serializeIcon(node.data.icon);
    console.log('Serializing node icon:', {
      nodeId: node.id,
      nodeType: node.type,
      originalIcon: node.data.icon,
      originalIconType: typeof node.data.icon,
      serializedIcon
    });
    
    return {
      ...node,
      data: {
        ...node.data,
        icon: serializedIcon
      }
    };
  });
};

// Helper to deserialize all icons in nodes when loading
export const deserializeNodesFromLoad = (nodes: any[]): any[] => {
  return nodes.map(node => {
    const deserializedIcon = deserializeIcon(node.data.icon, node.type);
    console.log('Deserializing node icon:', {
      nodeId: node.id,
      nodeType: node.type,
      serializedIcon: node.data.icon,
      serializedIconType: typeof node.data.icon,
      deserializedIcon,
      deserializedIconType: typeof deserializedIcon
    });
    
    // Apply default shape if not explicitly set
    const nodeData = {
      ...node.data,
      icon: deserializedIcon
    };
    
    // If shape is not defined, apply the default shape for this node type
    if (!nodeData.shape && node.type !== 'securityZone') {
      const defaultShape = getDefaultShapeForType(node.type);
      if (defaultShape) {
        nodeData.shape = defaultShape;
        console.log('Applied default shape:', {
          nodeId: node.id,
          nodeType: node.type,
          shape: defaultShape
        });
      }
    }
    
    // For security zones, ensure proper selectable/draggable state based on selection
    if (node.type === 'securityZone') {
      const isSelected = node.selected || false;
      return {
        ...node,
        selected: isSelected,
        selectable: isSelected,
        draggable: isSelected,
        data: nodeData
      };
    }
    
    return {
      ...node,
      data: nodeData
    };
  });
};
