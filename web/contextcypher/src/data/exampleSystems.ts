// src/data/exampleSystems.ts
import { ExampleSystemCollection } from '../types/ExampleSystemTypes';
import { vulnerableWebApp } from './exampleSystems/vulnerableWebApp';
import { vulnerableNetwork } from './exampleSystems/vulnerableNetwork';
import { vulnerableIoT } from './exampleSystems/vulnerableIoT';
import { vulnerableCloud } from './exampleSystems/vulnerableCloud';
import { vulnerableScada } from './exampleSystems/vulnerableScada';
import { aiMLPlatform } from './exampleSystems/aiMLPlatform';
import { localLLMThreatModeler } from './exampleSystems/localLLMThreatModeler';
import { azureOpenAIThreatModeler } from './exampleSystems/azureOpenAIThreatModeler';
import { vulnerableFraudDetection } from './exampleSystems/vulnerableFraudDetection';
import { vulnerablePrivacyPlatform } from './exampleSystems/vulnerablePrivacyPlatform';
import { vulnerableAppArchitecture } from './exampleSystems/vulnerableAppArchitecture';
import { vulnerableRedTeamScenario } from './exampleSystems/vulnerableRedTeamScenario';
import { electricGridSystem } from './exampleSystems/electricGridSystem';
import { railwayTransportSystem } from './exampleSystems/railwayTransportSystem';
import { quickVulnerableExample } from './exampleSystems/quickVulnerableExample';
import { smallVulnerableSystem } from './exampleSystems/smallVulnerableSystem';

// Import new example systems
import { enterpriseDataCenter } from './exampleSystems/enterpriseDataCenter';
import { largeEnterpriseSystem } from './exampleSystems/largeEnterpriseSystem';
import { mediumComplexSystem } from './exampleSystems/mediumComplexSystem';
import { microSecureSystem } from './exampleSystems/microSecureSystem';
import { publicAPIsThreatModeler } from './exampleSystems/publicAPIsThreatModeler';
import { smallSecureSystem } from './exampleSystems/smallSecureSystem';
import { stressTestSystem } from './exampleSystems/stressTestSystem';

// Import targeted threat scenario systems
import { supplyChainDevelopment } from './exampleSystems/supplyChainDevelopment';
import { healthcareRansomware } from './exampleSystems/healthcareRansomware';
import { financeIdentitySystem } from './exampleSystems/financeIdentitySystem';

// Import DFD threat model examples
import { dfdWebApplication } from './exampleSystems/dfdWebApplication';
import { dfdMicroservices } from './exampleSystems/dfdMicroservices';
import { dfdIoTSystem } from './exampleSystems/dfdIoTSystem';
import { hybridBankingSystem } from './exampleSystems/hybridBankingSystem';
import { hybridCloudMigration } from './exampleSystems/hybridCloudMigration';

// Import Cloud Vendor Architecture examples
import { awsCloudExposedWorkloads } from './exampleSystems/awsCloudExposedWorkloads';
import { azureCloudIdentityGaps } from './exampleSystems/azureCloudIdentityGaps';
import { gcpCloudDataLeak } from './exampleSystems/gcpCloudDataLeak';
import { ibmCloudSharedHub } from './exampleSystems/ibmCloudSharedHub';

// Export the collection of example systems
export const exampleSystems: ExampleSystemCollection = {
  'Cloud Vendor Architectures': [awsCloudExposedWorkloads, azureCloudIdentityGaps, gcpCloudDataLeak, ibmCloudSharedHub],
  'Web Applications': [vulnerableWebApp, quickVulnerableExample, smallVulnerableSystem, publicAPIsThreatModeler, stressTestSystem],
  'Network Infrastructure': [vulnerableNetwork],
  'IoT Systems': [vulnerableIoT],
  'Cloud Infrastructure': [vulnerableCloud, microSecureSystem],
  'Industrial Control Systems': [vulnerableScada, electricGridSystem, railwayTransportSystem],
  'Enterprise Systems': [enterpriseDataCenter, largeEnterpriseSystem, mediumComplexSystem, supplyChainDevelopment, healthcareRansomware, financeIdentitySystem],
  'AI Systems': [
    aiMLPlatform,
  ],
  'Cybercrime & Fraud': [vulnerableFraudDetection],
  'Privacy & Data Protection': [vulnerablePrivacyPlatform],
  'Application Architecture': [vulnerableAppArchitecture],
  'Red Teaming': [vulnerableRedTeamScenario],
  'Secure Systems': [smallSecureSystem, microSecureSystem, localLLMThreatModeler, azureOpenAIThreatModeler],
  'Targeted Threat Scenarios': [supplyChainDevelopment, healthcareRansomware, financeIdentitySystem],
  'DFD Threat Models': [dfdWebApplication, dfdMicroservices, dfdIoTSystem, hybridBankingSystem, hybridCloudMigration]
};

// Export the initial system
export const initialSystem = vulnerableWebApp;

// Export the type for use in other files
export type { ExampleSystem } from '../types/ExampleSystemTypes';
