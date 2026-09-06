import React from 'react';

export type IconSource = 'material' | 'vendor';

export interface IconMapping {
  icon: React.ElementType;
  name: string;
  category: string;
  keywords?: string[];
  iconId?: string;
  source?: IconSource;
}

export interface VendorIconMetadata {
  vendor: string;
  subcategory: string;
  filename: string;
  iconId: string;
}
