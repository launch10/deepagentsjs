import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths';
import ssrPlugin from 'vite-ssr-components/plugin'

export default defineConfig({
  plugins: [tsconfigPaths(), cloudflare(), ssrPlugin()]
})
