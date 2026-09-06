import React from 'react';
import { Link, Box } from '@mui/material';

/**
 * Opens a URL in a new tab/window
 * Browser-only implementation
 */
export const openExternalLink = async (url: string): Promise<boolean> => {
  try {
    const result = window.open(url, '_blank', 'noopener,noreferrer');
    
    // window.open might return null due to popup blockers even if the window opened
    // We'll return true unless we get an actual error
    if (result === null) {
      console.warn('[LinkUtils] window.open returned null - popup may be blocked or window may have opened anyway');
      // Still return true as the window might have opened
      return true;
    }
    
    return !!result;
  } catch (error: any) {
    console.error('Failed to open external link:', error);
    return false;
  }
};

/**
 * Generates URL for MITRE ATT&CK technique
 */
export const getMitreUrl = (techniqueId: string): string => {
  return `https://attack.mitre.org/techniques/${techniqueId}/`;
};

/**
 * Generates URL for CVE reference
 */
export const getCveUrl = (cveId: string): string => {
  return `https://nvd.nist.gov/vuln/detail/${cveId}`;
};

/**
 * Creates a clickable MITRE technique link component
 */
export const MitreLink: React.FC<{
  techniqueId: string;
  displayText?: string;
  variant?: 'link' | 'chip';
  size?: 'small' | 'medium';
  sx?: any;
}> = ({ techniqueId, displayText, variant = 'link', size = 'medium', sx }) => {
  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    openExternalLink(getMitreUrl(techniqueId));
  };

  if (variant === 'chip') {
    // Return plain text for chip usage - chips will handle the styling
    return <span>{displayText || techniqueId}</span>;
  }

  return (
    <Link
      href={getMitreUrl(techniqueId)}
      onClick={handleClick}
      sx={{
        color: 'primary.main',
        textDecoration: 'none',
        fontWeight: 500,
        cursor: 'pointer',
        '&:hover': {
          textDecoration: 'underline'
        },
        ...sx
      }}
    >
      {displayText || techniqueId}
    </Link>
  );
};

/**
 * Creates a clickable CVE link component
 */
export const CveLink: React.FC<{
  cveId: string;
  displayText?: string;
  variant?: 'link' | 'chip';
  size?: 'small' | 'medium';
  sx?: any;
}> = ({ cveId, displayText, variant = 'link', size = 'medium', sx }) => {
  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    openExternalLink(getCveUrl(cveId));
  };

  if (variant === 'chip') {
    // Return plain text for chip usage - chips will handle the styling
    return <span>{displayText || cveId}</span>;
  }

  return (
    <Link
      href={getCveUrl(cveId)}
      onClick={handleClick}
      sx={{
        color: 'primary.main',
        textDecoration: 'none',
        fontWeight: 500,
        cursor: 'pointer',
        '&:hover': {
          textDecoration: 'underline'
        },
        ...sx
      }}
    >
      {displayText || cveId}
    </Link>
  );
};

/**
 * Creates a clickable chip for MITRE techniques
 */
export const MitreChip: React.FC<{
  techniqueId: string;
  size?: 'small' | 'medium';
  variant?: 'filled' | 'outlined';
  color?: 'default' | 'primary' | 'secondary';
  sx?: any;
  onClick?: () => void;
}> = ({ techniqueId, size = 'small', variant = 'outlined', color = 'primary', sx, onClick }) => {
  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (onClick) {
      onClick();
    } else {
      openExternalLink(getMitreUrl(techniqueId));
    }
  };

  return (
    <Box
      component="span"
      onClick={handleClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: size === 'small' ? 24 : 32,
        minWidth: size === 'small' ? 64 : 80,
        px: size === 'small' ? 1 : 1.5,
        fontSize: size === 'small' ? '0.75rem' : '0.875rem',
        fontWeight: 500,
        borderRadius: 1,
        cursor: 'pointer',
        textDecoration: 'none',
        border: variant === 'outlined' ? `1px solid` : 'none',
        borderColor: color === 'primary' ? 'primary.main' : 
                    color === 'secondary' ? 'secondary.main' : 'text.secondary',
        backgroundColor: variant === 'filled' ? 
                        (color === 'primary' ? 'primary.main' : 
                         color === 'secondary' ? 'secondary.main' : 'grey.300') : 
                        'transparent',
        color: variant === 'filled' ? 'white' : 
               (color === 'primary' ? 'primary.main' : 
                color === 'secondary' ? 'secondary.main' : 'text.primary'),
        '&:hover': {
          backgroundColor: variant === 'filled' ? 
                          (color === 'primary' ? 'primary.dark' : 
                           color === 'secondary' ? 'secondary.dark' : 'grey.400') :
                          (color === 'primary' ? 'primary.light' : 
                           color === 'secondary' ? 'secondary.light' : 'grey.100'),
          opacity: variant === 'filled' ? 1 : 0.8,
        },
        ...sx
      }}
    >
      {techniqueId}
    </Box>
  );
};

/**
 * Creates a clickable chip for CVE references
 */
export const CveChip: React.FC<{
  cveId: string;
  size?: 'small' | 'medium';
  variant?: 'filled' | 'outlined';
  color?: 'default' | 'warning' | 'error';
  sx?: any;
  onClick?: () => void;
}> = ({ cveId, size = 'small', variant = 'filled', color = 'warning', sx, onClick }) => {
  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (onClick) {
      onClick();
    } else {
      openExternalLink(getCveUrl(cveId));
    }
  };

  return (
    <Box
      component="span"
      onClick={handleClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: size === 'small' ? 24 : 32,
        minWidth: size === 'small' ? 100 : 120,
        px: size === 'small' ? 1 : 1.5,
        fontSize: size === 'small' ? '0.75rem' : '0.875rem',
        fontWeight: 500,
        borderRadius: 1,
        cursor: 'pointer',
        textDecoration: 'none',
        border: variant === 'outlined' ? `1px solid` : 'none',
        borderColor: color === 'warning' ? 'warning.main' : 
                    color === 'error' ? 'error.main' : 'text.secondary',
        backgroundColor: variant === 'filled' ? 
                        (color === 'warning' ? 'warning.main' : 
                         color === 'error' ? 'error.main' : 'grey.300') : 
                        'transparent',
        color: variant === 'filled' ? 'white' : 
               (color === 'warning' ? 'warning.main' : 
                color === 'error' ? 'error.main' : 'text.primary'),
        '&:hover': {
          backgroundColor: variant === 'filled' ? 
                          (color === 'warning' ? 'warning.dark' : 
                           color === 'error' ? 'error.dark' : 'grey.400') :
                          (color === 'warning' ? 'warning.light' : 
                           color === 'error' ? 'error.light' : 'grey.100'),
          opacity: variant === 'filled' ? 1 : 0.8,
        },
        ...sx
      }}
    >
      {cveId}
    </Box>
  );
};

/**
 * Parses text and converts MITRE technique IDs and CVE IDs to clickable links
 */
export const parseLinksInText = (text: string): React.ReactNode => {
  if (!text || typeof text !== 'string') {
    return text;
  }

  // Regex patterns for MITRE techniques (T1234, T1234.001) and CVE IDs
  const mitrePattern = /\b(T\d{4}(?:\.\d{3})?)\b/g;
  const cvePattern = /\b(CVE-\d{4}-\d{4,})\b/g;

  // Find all matches
  const mitreMatches = Array.from(text.matchAll(mitrePattern));
  const cveMatches = Array.from(text.matchAll(cvePattern));
  
  // If no matches, return original text
  if (mitreMatches.length === 0 && cveMatches.length === 0) {
    return text;
  }

  // Combine and sort all matches by position
  const allMatches = [
    ...mitreMatches.map(m => ({ type: 'mitre' as const, match: m })),
    ...cveMatches.map(m => ({ type: 'cve' as const, match: m }))
  ].sort((a, b) => a.match.index! - b.match.index!);

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  allMatches.forEach((item, i) => {
    const start = item.match.index!;
    const end = start + item.match[0].length;
    
    // Add text before this match
    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }
    
    // Add the clickable link
    if (item.type === 'mitre') {
      parts.push(
        <MitreLink 
          key={`mitre-${i}`} 
          techniqueId={item.match[1]} 
          sx={{ fontSize: 'inherit' }}
        />
      );
    } else {
      parts.push(
        <CveLink 
          key={`cve-${i}`} 
          cveId={item.match[1]}
          sx={{ fontSize: 'inherit' }}
        />
      );
    }
    
    lastIndex = end;
  });

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
};

// Also export a simple direct open function for backward compatibility
export const openExternalLinkDirect = openExternalLink;