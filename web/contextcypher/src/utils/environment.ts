// Browser environment detection utilities

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

export function isBrowser(): boolean {
  return true;
}

export function getPlatform(): string {
  const platform = navigator.platform.toLowerCase();
  
  if (platform.includes('win')) return 'windows';
  if (platform.includes('mac')) return 'macos';
  if (platform.includes('linux')) return 'linux';
  
  return 'unknown';
}

export function getArchitecture(): string {
  // Try to detect architecture from user agent
  const ua = navigator.userAgent.toLowerCase();
  
  if (ua.includes('x86_64') || ua.includes('x64') || ua.includes('amd64')) {
    return 'x64';
  }
  if (ua.includes('arm64') || ua.includes('aarch64')) {
    return 'arm64';
  }
  if (ua.includes('x86') || ua.includes('i686')) {
    return 'x86';
  }
  
  // Default assumption for modern systems
  return 'x64';
}

export function isLocalhost(): boolean {
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export function getAppVersion(): string {
  // This should be injected during build
  return process.env.REACT_APP_VERSION || '0.0.0';
}

export function supportsFileSystemAccess(): boolean {
  return 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
}

export function supportsWebCrypto(): boolean {
  return typeof crypto !== 'undefined' && crypto.subtle !== undefined;
}

export function isCloudDiscoveryEnabled(): boolean {
  return process.env.REACT_APP_ENABLE_CLOUD_DISCOVERY === 'true';
}

export function getEnvironmentInfo(): Record<string, any> {
  return {
    platform: getPlatform(),
    architecture: getArchitecture(),
    browser: true,
    production: isProduction(),
    development: isDevelopment(),
    localhost: isLocalhost(),
    version: getAppVersion(),
    features: {
      fileSystemAccess: supportsFileSystemAccess(),
      webCrypto: supportsWebCrypto()
    },
    userAgent: navigator.userAgent,
    language: navigator.language,
    onLine: navigator.onLine
  };
}
