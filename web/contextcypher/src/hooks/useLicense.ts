import { useCallback } from 'react';
import { LicenseInfo, licenseService } from '../services/LicenseService';

export interface UseLicenseResult {
  license: LicenseInfo;
  isPro: boolean;
  isEnterprise: boolean;
  hasFeature: (featureId: string) => boolean;
  setLicenseKey: (key: string) => Promise<boolean>;
  clearLicense: () => void;
  getUpgradeMessage: (featureId: string) => string;
  isLoading: boolean;
  error: string | null;
}

export const useLicense = (): UseLicenseResult => ({
  license: licenseService.getCurrentLicense(),
  isPro: true,
  isEnterprise: false,
  hasFeature: useCallback(() => true, []),
  setLicenseKey: useCallback(async () => true, []),
  clearLicense: useCallback(() => {}, []),
  getUpgradeMessage: useCallback(() => '', []),
  isLoading: false,
  error: null,
});
