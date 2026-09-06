/**
 * Detects how ContextCypher was installed (npm package vs MSI installer)
 */

export type InstallMethod = 'npm' | 'msi' | 'portable' | 'docker' | 'unknown';

class InstallMethodDetector {
  private static instance: InstallMethodDetector;
  private detectedMethod?: InstallMethod;
  
  private constructor() {}
  
  static getInstance(): InstallMethodDetector {
    if (!InstallMethodDetector.instance) {
      InstallMethodDetector.instance = new InstallMethodDetector();
    }
    return InstallMethodDetector.instance;
  }
  
  /**
   * Detects the installation method
   */
  detect(): InstallMethod {
    // Return cached result if already detected
    if (this.detectedMethod) {
      return this.detectedMethod;
    }
    
    // Check environment variable first (set during build)
    const envMethod = process.env.REACT_APP_INSTALL_METHOD;
    if (envMethod && this.isValidMethod(envMethod)) {
      this.detectedMethod = envMethod as InstallMethod;
      console.log(`[InstallMethodDetector] Detected from env: ${this.detectedMethod}`);
      return this.detectedMethod;
    }
    
    // Check for npm installation markers
    if (this.checkNpmMarkers()) {
      this.detectedMethod = 'npm';
      console.log('[InstallMethodDetector] Detected npm installation');
      return this.detectedMethod;
    }
    
    // Check execution path for common patterns
    const detectedFromPath = this.detectFromPath();
    if (detectedFromPath !== 'unknown') {
      this.detectedMethod = detectedFromPath;
      console.log(`[InstallMethodDetector] Detected from path: ${this.detectedMethod}`);
      return this.detectedMethod;
    }
    
    // Check for Docker environment
    if (this.checkDockerEnvironment()) {
      this.detectedMethod = 'docker';
      console.log('[InstallMethodDetector] Detected Docker environment');
      return this.detectedMethod;
    }
    
    // Default to MSI on Windows, unknown elsewhere
    if (this.isWindows()) {
      this.detectedMethod = 'msi';
      console.log('[InstallMethodDetector] Defaulting to MSI on Windows');
    } else {
      this.detectedMethod = 'unknown';
      console.log('[InstallMethodDetector] Unable to detect installation method');
    }
    
    return this.detectedMethod;
  }
  
  /**
   * Get update instructions based on installation method
   */
  getUpdateInstructions(method?: InstallMethod): { 
    command?: string; 
    description: string;
    buttonText: string;
  } {
    const installMethod = method || this.detect();
    
    switch (installMethod) {
      case 'npm':
        return {
          command: 'npm update -g @threatvectorsecurity/contextcypher',
          description: 'Update via npm:',
          buttonText: 'Copy Command'
        };
        
      case 'msi':
        return {
          description: 'Download the latest installer:',
          buttonText: 'Download Update'
        };
        
      case 'portable':
        return {
          description: 'Download the latest portable version:',
          buttonText: 'Download Update'
        };
        
      case 'docker':
        return {
          command: 'docker pull contextcypher:latest',
          description: 'Pull the latest Docker image:',
          buttonText: 'Copy Command'
        };
        
      default:
        return {
          description: 'Visit our website for the latest version:',
          buttonText: 'Visit Website'
        };
    }
  }
  
  /**
   * Check if running on Windows
   */
  private isWindows(): boolean {
    return navigator.platform.toLowerCase().includes('win');
  }
  
  /**
   * Validate installation method string
   */
  private isValidMethod(method: string): boolean {
    return ['npm', 'msi', 'portable', 'docker', 'unknown'].includes(method);
  }
  
  /**
   * Check for npm-specific markers
   */
  private checkNpmMarkers(): boolean {
    // Check for .npm-install marker file (would need to be served by the app)
    // In a real implementation, this would check for a marker file
    // For now, we'll check if certain npm-specific patterns exist
    
    // Check if running from typical npm global paths
    const pathname = window.location.pathname.toLowerCase();
    if (pathname.includes('node_modules') || 
        pathname.includes('npm-global') ||
        pathname.includes('.npm')) {
      return true;
    }
    
    // Check for npm-specific query params or headers
    // (these would be set by the npm launcher script)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('install-method') === 'npm') {
      return true;
    }
    
    return false;
  }
  
  /**
   * Detect installation method from execution path
   */
  private detectFromPath(): InstallMethod {
    const pathname = window.location.pathname.toLowerCase();
    const hostname = window.location.hostname.toLowerCase();
    
    // Docker detection
    if (hostname === 'localhost' && 
        (pathname.includes('docker') || window.location.port === '3002')) {
      // Additional Docker environment checks could go here
      return 'unknown'; // Let checkDockerEnvironment handle this
    }
    
    // Windows Program Files detection (MSI)
    if (pathname.includes('program files') || 
        pathname.includes('programfiles')) {
      return 'msi';
    }
    
    // Portable detection patterns
    if (pathname.includes('portable') || 
        pathname.includes('contextcypher-portable')) {
      return 'portable';
    }
    
    return 'unknown';
  }
  
  /**
   * Check for Docker environment indicators
   */
  private checkDockerEnvironment(): boolean {
    // In a browser environment, we can't directly check for Docker
    // but we can look for certain patterns or headers set by the server
    
    // Check for Docker-specific headers (would need server cooperation)
    // For now, return false as this would require server-side implementation
    return false;
  }
  
  /**
   * Force a specific installation method (useful for testing)
   */
  setMethod(method: InstallMethod): void {
    this.detectedMethod = method;
    console.log(`[InstallMethodDetector] Manually set to: ${method}`);
  }
  
  /**
   * Clear cached detection result
   */
  reset(): void {
    this.detectedMethod = undefined;
    console.log('[InstallMethodDetector] Detection cache cleared');
  }
}

// Export singleton instance
export const installMethodDetector = InstallMethodDetector.getInstance();

// Export convenience function
export function detectInstallMethod(): InstallMethod {
  return installMethodDetector.detect();
}

// Export update instructions helper
export function getUpdateInstructions(method?: InstallMethod) {
  return installMethodDetector.getUpdateInstructions(method);
}
