import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    conditions: ['types', 'node', 'default'],
  },
  test: {
    globals: true,
    testTimeout: 240_000,
    environment: 'node',
    setupFiles: ['./tests/support/setup.ts'],
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // Run tests in parallel with proper connection pooling
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 4, // Limit parallel forks to avoid overwhelming the database
        minForks: 1
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '*.config.*',
        '**/dist/**',
      ],
    },
  },
});