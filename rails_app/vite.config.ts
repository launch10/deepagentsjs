import UnoCSS from 'unocss/vite';
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type ViteDevServer } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules';
import tsconfigPaths from 'vite-tsconfig-paths';
import RubyPlugin from 'vite-plugin-ruby';

export default defineConfig((config) => {
  return {
    build: {
      target: 'esnext',
    },
    optimizeDeps: {
      include: [
        '@ai-sdk/react',
        '@ai-sdk/react > swr',
        '@ai-sdk/react > throttleit',
        '@ai-sdk/react > use-sync-external-store',
        'swr',
        'throttleit',
        'use-sync-external-store',
      ],
      exclude: ['langgraph-ai-sdk-react'],
    },
    resolve: {
      conditions: ['browser', 'module', 'import', 'default'],
      alias: {
        '@vercel/oidc': new URL('./app/javascript/stubs/vercel-oidc.ts', import.meta.url).pathname,
        'use-sync-external-store/shim/index.js': 'react',
        'use-sync-external-store/shim': 'react',
      }, 
    },
    plugins: [
      nodePolyfills({
        include: ['buffer']
      }),
      react(),
      tailwindcss(),
      RubyPlugin(),
      UnoCSS(),
      tsconfigPaths(),
      chrome129IssuePlugin(),
      config.mode === 'production' && optimizeCssModules({ apply: 'build' }),
    ],
  };
});

function chrome129IssuePlugin() {
  return {
    name: 'chrome129IssuePlugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const raw = req.headers['user-agent']?.match(/Chrom(e|ium)\/([0-9]+)\./);
        if (raw) {
          const version = parseInt(raw[2], 10);
          if (version === 129) {
            res.setHeader('content-type', 'text/html');
            res.end(
              '<body><h1>Please use Chrome Canary for testing.</h1><p>Chrome 129 has an issue with JavaScript modules & Vite local development, see <a href="https://github.com/stackblitz/bolt.new/issues/86#issuecomment-2395519258">for more information.</a></p><p><b>Note:</b> This only impacts <u>local development</u>. `pnpm run build` and `pnpm run start` will work fine in this browser.</p></body>',
            );
            return;
          }
        }
        next();
      });
    },
  };
}