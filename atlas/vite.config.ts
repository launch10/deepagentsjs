import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths';
import ssrPlugin from 'vite-ssr-components/plugin'

export default defineConfig({
  build: {
    rollupOptions: {
      input: process.env.WRANGLER_CONFIG?.includes('admin') 
        ? 'src/index-admin.tsx'
        : 'src/index-public.tsx'
    }
  },
  plugins: [
    tsconfigPaths(), 
    cloudflare({
      configPath: process.env.WRANGLER_CONFIG || 'wrangler.toml'
    }), 
    ssrPlugin()
  ]
})
