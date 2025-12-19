import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
import path from 'path';

export default defineWorkersConfig({
  test: {
    globals: true,
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler-public.toml' },
        miniflare: {
          kvNamespaces: ['DEPLOYS_KV'],
          r2Buckets: ['DEPLOYS_R2'],
        },
        singleWorker: true,
        isolatedStorage: false,
      },
    },
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src'),
      '@middleware': path.resolve(__dirname, './src/middleware'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
});
