import { readFile, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import type { RemoteExecutionWorkspaceContext, RemoteExecutionCapabilityTier } from './types.js';

const NODE_NATIVE_DEPENDENCIES = [
  'node-pty', 'sqlite3', 'better-sqlite3', 'canvas', 'bcrypt', 'sharp',
  'puppeteer', 'playwright', 'grpc', 'node-sass', 'kerberos',
];

const PYTHON_NATIVE_DEPENDENCIES = [
  'pandas', 'numpy', 'scipy', 'cryptography', 'psycopg2', 'lxml', 'pyyaml',
  'pillow', 'grpcio', 'uvloop', 'ujson', 'msgpack',
];

const BUILD_SYSTEM_MARKERS = [
  'Makefile', 'CMakeLists.txt', 'configure', 'Cargo.toml', 'go.mod',
  'pyproject.toml', 'setup.py', 'pom.xml', 'build.gradle',
];

const SOURCE_FILE_EXTENSIONS = new Set([
  '.c', '.cpp', '.cc', '.h', '.hpp', '.rs', '.go', '.java', '.kt', '.swift',
]);

export async function analyzeWorkspaceForSandboxCompatibility(
  workspaceRoot: string,
): Promise<RemoteExecutionWorkspaceContext> {
  const detectedBuildMarkers: string[] = [];
  const detectedNativePackages: string[] = [];
  let hasSourceFilesRequiringCompilation = false;

  try {
    const entries = await readdir(workspaceRoot, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) continue;
      
      const name = entry.name;
      const ext = extname(name).toLowerCase();

      if (BUILD_SYSTEM_MARKERS.includes(name)) {
        detectedBuildMarkers.push(name);
      }

      if (SOURCE_FILE_EXTENSIONS.has(ext)) {
        hasSourceFilesRequiringCompilation = true;
      }

      // Deep scan specific manifests
      if (name === 'package.json') {
        const native = await scanNodeManifest(join(workspaceRoot, name));
        detectedNativePackages.push(...native);
      } else if (name === 'requirements.txt') {
        const native = await scanPythonManifest(join(workspaceRoot, name));
        detectedNativePackages.push(...native);
      }
    }

    let tier: RemoteExecutionCapabilityTier = 'runtime_only';
    
    if (detectedBuildMarkers.length > 0 || hasSourceFilesRequiringCompilation || detectedNativePackages.length > 0) {
      tier = 'build_essential';
    }

    // Special markers for full OS persistence
    if (detectedBuildMarkers.includes('Cargo.toml') || detectedBuildMarkers.includes('pom.xml')) {
      tier = 'full_os_persistence';
    }

    return {
      hasNativeDependencies: detectedNativePackages.length > 0 || hasSourceFilesRequiringCompilation,
      detectedNativePackages,
      requiredCapabilityTier: tier,
      detectedBuildMarkers,
    };
  } catch (error) {
    return {
      hasNativeDependencies: false,
      detectedNativePackages: [],
      requiredCapabilityTier: 'runtime_only',
      detectedBuildMarkers: [],
    };
  }
}

async function scanNodeManifest(path: string): Promise<string[]> {
  try {
    const content = await readFile(path, 'utf8');
    const pkg = JSON.parse(content);
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}), ...(pkg.peerDependencies ?? {}), ...(pkg.optionalDependencies ?? {}) };
    const depNames = Object.keys(deps);
    return NODE_NATIVE_DEPENDENCIES.filter(name => depNames.some(d => d === name || d.startsWith(`${name}/`)));
  } catch {
    return [];
  }
}

async function scanPythonManifest(path: string): Promise<string[]> {
  try {
    const content = await readFile(path, 'utf8');
    return PYTHON_NATIVE_DEPENDENCIES.filter(name => content.toLowerCase().includes(name.toLowerCase()));
  } catch {
    return [];
  }
}
