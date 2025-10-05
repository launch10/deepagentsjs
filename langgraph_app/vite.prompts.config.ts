import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    react({
      // Enable Fast Refresh for better HMR
      fastRefresh: true,
    }),
    tsconfigPaths()
  ],
  root: 'app/prompts/dev',
  resolve: {
    alias: {
      '@prompts': path.resolve(__dirname, './app/prompts'),
      '~': path.resolve(__dirname, './app'),
      '@': path.resolve(__dirname, './app')
    }
  },
  server: {
    port: 5174,
    open: true,
    hmr: {
      // Force HMR to work properly
      overlay: true,
    }
  },
  build: {
    outDir: '../../../dist/prompts'
  },
  optimizeDeps: {
    // Include React deps for faster cold start
    include: ['react', 'react-dom', 'react/jsx-runtime']
  }
});