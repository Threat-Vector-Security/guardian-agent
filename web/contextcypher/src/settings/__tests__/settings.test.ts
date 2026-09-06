/** @jest-environment jsdom */
import { AppSettings } from '../../types/SettingsTypes';
import { defaultSettings, loadSettings } from '../settings';
import { saveSettings } from '../settings';

describe('settings recent diagram files', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns defaults when no saved settings exist', () => {
    const loaded = loadSettings();
    expect(loaded.recentDiagramFiles).toEqual(defaultSettings.recentDiagramFiles);
  });

  it('filters invalid recent file entries and normalizes timestamps', () => {
    localStorage.setItem('settings', JSON.stringify({
      theme: 'dark',
      recentDiagramFiles: [
        { id: 'file-1', name: 'first.json', lastOpenedAt: '2026-02-13T00:00:00.000Z' },
        { id: 'file-2', name: 'second.json' },
        { id: 3, name: 'invalid-id.json' },
        { id: 'file-4' }
      ]
    }));

    const loaded = loadSettings();

    expect(loaded.recentDiagramFiles).toHaveLength(2);
    expect(loaded.recentDiagramFiles?.[0]).toEqual({
      id: 'file-1',
      name: 'first.json',
      lastOpenedAt: '2026-02-13T00:00:00.000Z'
    });
    expect(loaded.recentDiagramFiles?.[1].id).toBe('file-2');
    expect(loaded.recentDiagramFiles?.[1].name).toBe('second.json');
    expect(typeof loaded.recentDiagramFiles?.[1].lastOpenedAt).toBe('string');
    expect(loaded.recentDiagramFiles?.[1].lastOpenedAt.length).toBeGreaterThan(0);
  });

  it('does not persist credential-like fields in settings storage', () => {
    const settingsWithSecrets = {
      ...defaultSettings,
      api: {
        ...defaultSettings.api,
        provider: 'openai',
        llmMode: 'public',
        providerConfig: {
          ...defaultSettings.api.providerConfig,
          openai: {
            ...defaultSettings.api.providerConfig.openai,
            apiKey: 'sk-test-secret-value',
            api_key: 'legacy-secret',
            secret: 'nested-secret'
          }
        }
      },
      secOps: {
        ...defaultSettings.secOps,
        threatIntel: {
          ...defaultSettings.secOps.threatIntel,
          externalFeeds: {
            enabled: true,
            urls: ['https://otx.alienvault.com'],
            apiKeys: {
              otx: 'threat-intel-secret'
            }
          }
        }
      }
    } as AppSettings & {
      api: AppSettings['api'] & {
        providerConfig: AppSettings['api']['providerConfig'] & {
          openai: NonNullable<AppSettings['api']['providerConfig']['openai']> & {
            apiKey: string;
            api_key: string;
            secret: string;
          };
        };
      };
      secOps: AppSettings['secOps'] & {
        threatIntel: AppSettings['secOps']['threatIntel'] & {
          externalFeeds: AppSettings['secOps']['threatIntel']['externalFeeds'] & {
            apiKeys: Record<string, string>;
          };
        };
      };
    };

    saveSettings(settingsWithSecrets);

    const stored = JSON.parse(localStorage.getItem('settings') || '{}');

    expect(stored.api.provider).toBe('openai');
    expect(stored.api.providerConfig.openai.organizationId).toBe('');
    expect(stored.api.providerConfig.openai.apiKey).toBeUndefined();
    expect(stored.api.providerConfig.openai.api_key).toBeUndefined();
    expect(stored.api.providerConfig.openai.secret).toBeUndefined();
    expect(stored.secOps.threatIntel.externalFeeds.urls).toEqual(['https://otx.alienvault.com']);
    expect(stored.secOps.threatIntel.externalFeeds.apiKeys).toBeUndefined();
  });
});
