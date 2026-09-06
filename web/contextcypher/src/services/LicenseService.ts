export type LicenseType = 'free' | 'pro' | 'enterprise' | 'beta' | 'trial';

export interface LicenseInfo {
  type: LicenseType;
  isValid: boolean;
  features: string[];
}

export interface ProFeature {
  id: string;
  name: string;
  description: string;
  requiresLicense: LicenseType[];
}

export const PRO_FEATURES: Record<string, ProFeature> = {};

class LicenseService {
  hasFeature(_featureId: string): boolean { return true; }
  getCurrentLicense(): LicenseInfo { return { type: 'pro', isValid: true, features: [] }; }
  async setLicenseKey(_key: string): Promise<boolean> { return true; }
  clearLicense(): void {}
  getLicenseKey(): string { return ''; }
  getUpgradeMessage(_featureId: string): string { return ''; }
  getVersionInfo(): { version: string } { return { version: '2.0.0' }; }
  getAppVersion(): string { return '2.0.0'; }
  getLicenseDisplayInfo(): { type: string; status: string } { return { type: 'Open Source', status: 'Active' }; }
  getStartupLicenseError(): null { return null; }
  clearStartupLicenseError(): void {}
  refreshSubscriptionStatus(): Promise<void> { return Promise.resolve(); }
}

export const licenseService = new LicenseService();
