import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppSettings, APISettings, SettingsContextType, APICredentials, AIProvider } from '../types/SettingsTypes';
import { loadSettings, saveSettings } from './settings';
import { guardianOperation } from '../services/guardianApi';
import { chatHistoryLogger } from '../services/ChatHistoryLogger';
const SettingsContext = createContext<SettingsContextType | undefined>(undefined);
export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [credentials, setCredentials] = useState<APICredentials>({ apiKeys: {}, activeKeys: new Set() });
  const [isInitialized, setIsInitialized] = useState(false);
  useEffect(() => {
    let disposed = false;
    const refresh = async () => {
      try {
        const result = await guardianOperation('ai.providers.list');
        if (disposed) return;
        const configured = result.configuration;
        if (configured) {
          const provider = (configured.provider === 'ollama' ? 'local' : configured.provider) as AIProvider;
          setSettings(previous => {
            const next = { ...previous, responseMode: 'complete' as const, api: { ...previous.api, provider, llmMode: (provider === 'local' ? 'local' : 'public') as 'local' | 'public' } };
            if (provider === 'local') next.api.localLLM = { ...previous.api.localLLM, model: configured.model, temperature: configured.temperature ?? 0.2, maxTokens: configured.maxTokens ?? 16000 };
            else next.api.providerConfig = { ...previous.api.providerConfig, [provider]: { ...(previous.api.providerConfig as any)[provider], model: configured.model } };
            saveSettings(next); return next;
          });
          setCredentials({ apiKeys: {}, activeKeys: new Set(configured.hasCredential ? [provider] : []) });
        }
      } catch (error) { console.error('Could not load Guardian AI configuration:', error); }
      finally { if (!disposed) setIsInitialized(true); }
    };
    void refresh();
    window.addEventListener('guardian-ai-configured', refresh);
    return () => { disposed = true; window.removeEventListener('guardian-ai-configured', refresh); };
  }, []);
  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings(previous => { const next = { ...previous, ...partial }; saveSettings(next); return next; });
    if (partial.chatHistoryLogging) chatHistoryLogger.updateOptions(partial.chatHistoryLogging);
  }, []);
  const updateAPISettings = useCallback((partial: Partial<APISettings>) => {
    setSettings(previous => { const next = { ...previous, api: { ...previous.api, ...partial } }; saveSettings(next); return next; });
  }, []);
  // Keys may be held transiently in a settings form, but never persisted or returned by the server.
  const setAPIKey = useCallback(async (provider: AIProvider, apiKey: string) => {
    setCredentials(previous => ({ apiKeys: { ...previous.apiKeys, [provider]: apiKey }, activeKeys: new Set([...Array.from(previous.activeKeys), provider]) }));
  }, []);
  const clearAPIKey = useCallback(async (provider: AIProvider) => {
    setCredentials(previous => { const keys = { ...previous.apiKeys }; delete keys[provider]; const activeKeys = new Set(previous.activeKeys); activeKeys.delete(provider); return { apiKeys: keys, activeKeys }; });
  }, []);
  const clearAllAPIKeys = useCallback(async () => { setCredentials({ apiKeys: {}, activeKeys: new Set() }); }, []);
  const hasAPIKey = useCallback((provider: AIProvider) => credentials.activeKeys.has(provider), [credentials]);
  const getAPIKey = useCallback((provider: AIProvider) => credentials.apiKeys[provider], [credentials]);
  return <SettingsContext.Provider value={{ settings, credentials, updateSettings, updateAPISettings, setAPIKey, clearAPIKey, clearAllAPIKeys, hasAPIKey, getAPIKey, isInitialized }}>{children}</SettingsContext.Provider>;
};
export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
};
