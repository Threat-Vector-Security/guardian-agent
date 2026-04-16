import { describe, expect, it } from 'vitest';
import { analyzeWorkspaceForSandboxCompatibility } from './workspace-analysis.js';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('analyzeWorkspaceForSandboxCompatibility', () => {
  it('identifies Node.js native dependencies', async () => {
    const root = mkdtempSync(join(tmpdir(), 'wa-test-node-'));
    writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: { 'node-pty': '^1.0.0' } }));
    const result = await analyzeWorkspaceForSandboxCompatibility(root);
    expect(result.hasNativeDependencies).toBe(true);
    expect(result.requiredCapabilityTier).toBe('build_essential');
  });

  it('identifies Go projects by go.mod and .go files', async () => {
    const root = mkdtempSync(join(tmpdir(), 'wa-test-go-'));
    writeFileSync(join(root, 'go.mod'), 'module test');
    writeFileSync(join(root, 'main.go'), 'package main');
    const result = await analyzeWorkspaceForSandboxCompatibility(root);
    expect(result.requiredCapabilityTier).toBe('build_essential');
    expect(result.detectedBuildMarkers).toContain('go.mod');
  });

  it('identifies C++ projects by Makefile', async () => {
    const root = mkdtempSync(join(tmpdir(), 'wa-test-cpp-'));
    writeFileSync(join(root, 'Makefile'), 'all: build');
    const result = await analyzeWorkspaceForSandboxCompatibility(root);
    expect(result.requiredCapabilityTier).toBe('build_essential');
  });

  it('identifies Python native dependencies in requirements.txt', async () => {
    const root = mkdtempSync(join(tmpdir(), 'wa-test-py-'));
    writeFileSync(join(root, 'requirements.txt'), 'pandas==1.0.0\nflask');
    const result = await analyzeWorkspaceForSandboxCompatibility(root);
    expect(result.hasNativeDependencies).toBe(true);
    expect(result.detectedNativePackages).toContain('pandas');
  });

  it('defaults to runtime_only for simple scripts', async () => {
    const root = mkdtempSync(join(tmpdir(), 'wa-test-simple-'));
    writeFileSync(join(root, 'script.js'), 'console.log("hi")');
    const result = await analyzeWorkspaceForSandboxCompatibility(root);
    expect(result.requiredCapabilityTier).toBe('runtime_only');
  });
});
