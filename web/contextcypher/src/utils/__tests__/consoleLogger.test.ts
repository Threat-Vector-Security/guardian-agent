/** @jest-environment jsdom */

describe('consoleLogger', () => {
  const nativeConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug
  };

  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    console.info = jest.fn();
    console.debug = jest.fn();
  });

  afterEach(() => {
    console.log = nativeConsole.log;
    console.error = nativeConsole.error;
    console.warn = nativeConsole.warn;
    console.info = nativeConsole.info;
    console.debug = nativeConsole.debug;
  });

  it('keeps redacted logs in memory and removes legacy persisted logs', async () => {
    localStorage.setItem('contextcypher_console_logs', JSON.stringify(['legacy']));

    const {
      initializeConsoleLogger,
      getConsoleLogs
    } = await import('../consoleLogger');

    initializeConsoleLogger();
    console.log('Authorization header', 'Bearer abcdefghijklmnopqrstuvwxyz123456');

    expect(localStorage.getItem('contextcypher_console_logs')).toBeNull();
    expect(getConsoleLogs().some((entry) => entry.includes('[REDACTED]'))).toBe(true);
  });
});
