// offline.ts - Configuration for offline mode
// This file sets up the environment for the offline version of the AI Threat Modeler

// Offline mode configuration
export const offlineConfig = {
  mode: 'offline',
  version: '1.0.0',
  apiEndpoint: process.env.REACT_APP_API_URL || 'http://localhost:3001',
  
  // Development settings
  development: {
    // For development testing with public APIs
    // API keys must be configured through the UI settings panel for security
    enablePublicAPITesting: true,
    
    // Default local LLM settings
    defaultLocalLLM: {
      baseUrl: 'http://localhost:11434',
      model: 'llama3.2:latest',
      temperature: 0.2,
      maxTokens: 16384  // Increased for complex diagram generation
    }
  },
  
  // Features enabled in offline mode
  features: {
    diagramEditor: true,
    localLLM: true,
    publicAPITesting: true, // Only for development
    fileSystemSave: true,
    exportReports: true,
    threatIntelligence: true,
    // Disabled features for offline mode
    authentication: false,
    subscription: false,
    cloudSync: false,
    userProfiles: false
  }
};

// Initialize offline mode
if (process.env.NODE_ENV !== 'production') {
  console.log('Initializing offline mode configuration:', {
    mode: offlineConfig.mode,
    apiEndpoint: offlineConfig.apiEndpoint,
    features: Object.keys(offlineConfig.features).filter(key => 
      offlineConfig.features[key as keyof typeof offlineConfig.features]
    )
  });
}

// Export for use in other modules
export default offlineConfig; 
