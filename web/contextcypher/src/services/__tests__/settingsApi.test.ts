/** @jest-environment jsdom */

describe('settingsApi getCurrentProvider', () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('derives the provider from persisted settings instead of a standalone localStorage cache', async () => {
    localStorage.setItem('settings', JSON.stringify({
      api: {
        llmMode: 'public',
        provider: 'gemini'
      }
    }));
    localStorage.setItem('currentProvider', 'openai');

    const { getCurrentProvider } = await import('../settingsApi');

    expect(getCurrentProvider()).toBe('gemini');
  });
});
