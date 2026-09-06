import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  define: {
    // Only public build constants from the migrated CRA frontend; never expose host environment values.
    'process.env': JSON.stringify({ NODE_ENV: mode === 'production' ? 'production' : 'development', REACT_APP_VERSION: '2.0.0-alpha.1', PUBLIC_URL: '' }),
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
