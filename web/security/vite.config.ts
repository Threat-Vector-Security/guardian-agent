import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

export default defineConfig(({ mode }) => ({
  define: {
    // Only public build constants from the migrated CRA frontend; never expose host environment values.
    'process.env': JSON.stringify({ NODE_ENV: mode === 'production' ? 'production' : 'development', REACT_APP_VERSION: version, PUBLIC_URL: '' }),
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      onwarn(warning, warn) {
        // This application is entirely client-rendered; React Server Component directives have no effect here.
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes('use client')) return;
        warn(warning);
      },
    },
  },
}));
