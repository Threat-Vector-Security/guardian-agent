// Jest globals are automatically available in test files
describe('Basic Test', () => {
  test('true should be true', () => {
    expect(true).toBe(true);
  });
});

export {}; // Make this a module to satisfy isolatedModules 