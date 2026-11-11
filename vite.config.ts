import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import legacy from '@vitejs/plugin-legacy';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const buildId = randomUUID();

export default defineConfig({
  define: { __APP_BUILD_ID__: JSON.stringify(buildId) },
  plugins: [
    react(),
    legacy(),
    {
      name: 'grantaccess-ionic-live-reload',
      apply: 'serve',
      configureServer(server) {
        let revision = buildId;
        const sourceChanged = (file: string) => {
          const normalized = file.replaceAll('\\', '/');
          if (normalized.startsWith(`${server.config.root}/src/`) && !/\.test\.tsx?$/.test(normalized)) revision = randomUUID();
        };
        server.watcher.on('change', sourceChanged).on('add', sourceChanged).on('unlink', sourceChanged);
        server.middlewares.use('/__grantaccess_dev_version', (_request, response) => {
          response.setHeader('Content-Type', 'application/json');
          response.setHeader('Cache-Control', 'no-store');
          response.end(JSON.stringify({ version: revision }));
        });
        server.httpServer?.once('close', () => {
          server.watcher.off('change', sourceChanged).off('add', sourceChanged).off('unlink', sourceChanged);
        });
      },
      async handleHotUpdate(context) {
        const file = context.file.replaceAll('\\', '/');
        if (file.startsWith(`${context.server.config.root}/src/`) && /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file)) {
          // Ionic retains routed pages; reload source edits so cached views refresh too.
          await context.read();
          context.server.ws.send({ type: 'full-reload', path: '*' });
          return [];
        }
      },
    },
    {
      name: 'grantaccess-build-version',
      apply: 'build',
      generateBundle(output) {
        if (output.format === 'es') {
          this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: buildId }) });
          this.emitFile({ type: 'asset', fileName: 'sw.js', source: readFileSync(new URL('./scripts/service-worker.js', import.meta.url), 'utf8').replaceAll('__BUILD_ID__', buildId) });
        }
      },
    },
  ],

  server: {
    host: 'localhost',
    port: 8100,
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 500,
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/cypress/screenshots/**', '**/cypress/videos/**', '**/firebase-debug.log'],
    },
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
