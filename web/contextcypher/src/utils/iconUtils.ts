// src/utils/iconUtils.ts
import { SecurityNodeType } from '../types/SecurityTypes';
import { materialIconMappings } from './materialIconMappings';
import React from 'react';

export const getDefaultIconForType = (nodeType: SecurityNodeType): React.ElementType => {
  return materialIconMappings[nodeType]?.icon || materialIconMappings.generic.icon;
};

export const getNodeIcon = (nodeType: SecurityNodeType): React.ReactElement | null => {
  const IconComponent = materialIconMappings[nodeType]?.icon || materialIconMappings.generic?.icon;
  if (!IconComponent) return null;
  return React.createElement(IconComponent);
};