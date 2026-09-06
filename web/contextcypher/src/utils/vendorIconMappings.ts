import React from 'react';
import { IconMapping, VendorIconMetadata } from '../types/IconTypes';
import vendorIconsManifest from '../data/vendorIconsManifest.json';

export const VENDOR_CATEGORIES = {
  AWS: 'aws',
  AZURE: 'azure',
  GCP: 'gcp',
  IBM: 'ibm'
} as const;

export type VendorKey = (typeof VENDOR_CATEGORIES)[keyof typeof VENDOR_CATEGORIES];

const VENDOR_ICON_METADATA_KEY = '__vendorIconMetadata';

const vendorIconCache = new Map<string, IconMapping>();
const vendorCategoryCache = new Map<string, IconMapping[]>();

const buildIconId = (vendor: string, subcategory: string, filename: string): string =>
  `vendor:${vendor}/${subcategory}/${filename}`;

const annotateVendorIcon = (
  component: any,
  metadata: VendorIconMetadata
) => {
  // Attach metadata directly to the function object for identity checks
  component[VENDOR_ICON_METADATA_KEY] = metadata;
  return component;
};

const createSvgComponent = (
  svgUrl: string,
  name: string,
  metadata: VendorIconMetadata
) => {
  const VendorIcon = function VendorIconComponent(props: any) {
    const { sx, style, ...rest } = props || {};
    const size = sx?.fontSize || 24;

    return React.createElement('img', {
      src: svgUrl,
      alt: name,
      style: {
        width: size,
        height: size,
        display: 'block',
        ...style,
      },
      draggable: false,
      ...rest,
    });
  };

  VendorIcon.displayName = `VendorIcon(${metadata.iconId})`;
  annotateVendorIcon(VendorIcon, metadata);
  return VendorIcon;
};

const formatIconName = (filename: string, vendor: string, subcategory: string): string => {
  const nameWithoutExt = filename.replace('.svg', '');
  const cleanName = nameWithoutExt
    .replace(/^Arch_/, '')
    .replace(/^Arch-/, '')
    .replace(/^Res_/, '')
    .replace(/^\d+-icon-service-/, '')
    .replace(/^\d+-icon-service/, '')
    .replace(/_48$/, '')
    .replace(/-512-color(-rgb)?$/, '')
    .replace(/_512-color(-rgb)?$/, '')
    .replace(/\(Classic\)/, 'Classic');

  const formattedSubcategory = subcategory
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const formattedName = cleanName
    .split(/[-_]/g)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return `${vendor.toUpperCase()} ${formattedSubcategory} - ${formattedName}`;
};

const buildVendorIcon = (
  vendor: VendorKey,
  subcategory: string,
  filename: string
): IconMapping => {
  const iconId = buildIconId(vendor, subcategory, filename);

  if (vendorIconCache.has(iconId)) {
    return vendorIconCache.get(iconId)!;
  }

  const metadata: VendorIconMetadata = {
    vendor,
    subcategory,
    filename,
    iconId,
  };

  const iconName = formatIconName(filename, vendor, subcategory);
  const svgUrl = `/icons/vendors/${vendor}/${subcategory}/${filename}`;
  const component = createSvgComponent(svgUrl, iconName, metadata);

  const keywords = [vendor, subcategory, filename.replace('.svg', '').toLowerCase()];

  const mapping: IconMapping = {
    icon: component,
    name: iconName,
    category: `${vendor}-${subcategory}`,
    keywords,
    iconId,
    source: 'vendor',
  };

  vendorIconCache.set(iconId, mapping);
  return mapping;
};

const cloneMapping = (mapping: IconMapping, overrides?: Partial<IconMapping>): IconMapping => ({
  ...mapping,
  keywords: mapping.keywords ? [...mapping.keywords] : undefined,
  ...overrides,
});

export interface VendorIconRequest {
  vendor: VendorKey;
  subcategory: string;
  filename: string;
  name?: string;
  category?: string;
  keywords?: string[];
}

export const getVendorIcon = (request: VendorIconRequest): IconMapping => {
  const base = buildVendorIcon(request.vendor, request.subcategory, request.filename);
  return cloneMapping(base, {
    name: request.name ?? base.name,
    category: request.category ?? base.category,
    keywords: request.keywords ?? base.keywords,
  });
};

export const getVendorIconComponent = (request: VendorIconRequest): React.ElementType => {
  return getVendorIcon(request).icon;
};

export const getVendorIconById = (iconId: string): IconMapping | undefined => {
  if (vendorIconCache.has(iconId)) {
    return vendorIconCache.get(iconId);
  }

  if (!iconId.startsWith('vendor:')) {
    return undefined;
  }

  const [, payload] = iconId.split('vendor:');
  if (!payload) return undefined;

  const parts = payload.split('/');
  if (parts.length < 3) return undefined;

  const [vendor, subcategory, ...fileParts] = parts;
  const filename = fileParts.join('/');

  if (!vendor || !subcategory || !filename) {
    return undefined;
  }

  return buildVendorIcon(vendor as VendorKey, subcategory, filename);
};

export const getVendorIconComponentById = (iconId: string): React.ElementType | null => {
  const mapping = getVendorIconById(iconId);
  return mapping?.icon ?? null;
};

export const getVendorIconMetadataFromComponent = (icon: any): VendorIconMetadata | undefined => {
  if (!icon) return undefined;

  if (typeof icon === 'function' && icon[VENDOR_ICON_METADATA_KEY]) {
    return icon[VENDOR_ICON_METADATA_KEY] as VendorIconMetadata;
  }

  if (typeof icon === 'object' && icon !== null) {
    const candidate = (icon as any).type ?? icon;
    if (candidate && candidate[VENDOR_ICON_METADATA_KEY]) {
      return candidate[VENDOR_ICON_METADATA_KEY] as VendorIconMetadata;
    }
  }

  return undefined;
};

export const isVendorIconComponent = (icon: any): boolean => {
  return !!getVendorIconMetadataFromComponent(icon);
};

const ensureCategoryCache = (vendor: VendorKey, subcategory: string): IconMapping[] => {
  const cacheKey = `${vendor}/${subcategory}`;

  if (vendorCategoryCache.has(cacheKey)) {
    return vendorCategoryCache.get(cacheKey)!;
  }

  const vendorData = (vendorIconsManifest as Record<string, Record<string, string[]>>)[vendor];
  const iconFiles = vendorData?.[subcategory] ?? [];

  const mappings = iconFiles.map(filename => buildVendorIcon(vendor, subcategory, filename));
  vendorCategoryCache.set(cacheKey, mappings);
  return mappings;
};

export const getVendorCategories = (): string[] => {
  const categories: string[] = [];

  for (const vendor of Object.keys(vendorIconsManifest)) {
    const vendorData = (vendorIconsManifest as Record<string, Record<string, string[]>>)[vendor];
    Object.keys(vendorData).forEach(subcategory => {
      categories.push(`${vendor}-${subcategory}`);
    });
  }

  return categories;
};

export const getVendorIconsByCategory = (category: string): IconMapping[] => {
  const [vendor, ...subcategoryParts] = category.split('-');
  const subcategory = subcategoryParts.join('-');

  if (!vendor || !subcategory) {
    return [];
  }

  if (!Object.values(VENDOR_CATEGORIES).includes(vendor as VendorKey)) {
    return [];
  }

  const mappings = ensureCategoryCache(vendor as VendorKey, subcategory);
  return mappings.map(mapping => cloneMapping(mapping));
};

export const getAllVendorIcons = (): IconMapping[] => {
  const icons: IconMapping[] = [];

  const mainCategories: Array<{ vendor: VendorKey; subcategories: string[] }> = [
    { vendor: VENDOR_CATEGORIES.AWS, subcategories: ['compute', 'database', 'network', 'security', 'storage'] },
    { vendor: VENDOR_CATEGORIES.AZURE, subcategories: ['compute', 'databases', 'networking', 'security', 'storage'] },
    { vendor: VENDOR_CATEGORIES.GCP, subcategories: ['compute', 'core-products', 'storage', 'networking'] },
  ];

  mainCategories.forEach(({ vendor, subcategories }) => {
    subcategories.forEach(subcategory => {
      const mappings = ensureCategoryCache(vendor, subcategory);
      mappings.forEach(mapping => icons.push(cloneMapping(mapping)));
    });
  });

  return icons;
};

export const findVendorIconMappingByComponent = (icon: any): IconMapping | undefined => {
  const metadata = getVendorIconMetadataFromComponent(icon);
  if (!metadata) return undefined;
  return getVendorIconById(metadata.iconId);
};
