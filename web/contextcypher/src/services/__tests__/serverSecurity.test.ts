describe('server security CORS settings', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.resetModules();
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    jest.dontMock('../../../server/utils/logger-wrapper');
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('rejects arbitrary remote origins in test mode', () => {
    jest.doMock('../../../server/utils/logger-wrapper', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    }));

    const { getCorsOptions } = require('../../../server/utils/security');
    const originValidator = getCorsOptions().origin;
    const callback = jest.fn();

    originValidator('https://evil.example', callback);

    expect(callback).toHaveBeenCalledWith(expect.any(Error));
  });

  it('allows localhost origins in test mode', () => {
    jest.doMock('../../../server/utils/logger-wrapper', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    }));

    const { getCorsOptions } = require('../../../server/utils/security');
    const originValidator = getCorsOptions().origin;
    const callback = jest.fn();

    originValidator('http://localhost:3000', callback);

    expect(callback).toHaveBeenCalledWith(null, true);
  });
});
