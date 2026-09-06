import React from 'react';
import { useSettings } from '../settings/SettingsContext';
// Configuration loads read-only in SettingsProvider. Opening the editor never changes a provider.
export const AIProviderInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isInitialized } = useSettings();
  return isInitialized ? <>{children}</> : <div role="status">Loading Guardian configuration…</div>;
};
