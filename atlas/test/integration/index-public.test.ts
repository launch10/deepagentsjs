import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import app from '~/index-public';
import {
  clearKV,
  clearR2,
  setupWebsiteWithUrl,
  setupWebsiteWithDomain,
  setupMultipleWebsiteUrls,
  seedR2,
} from '../support/fixtures';

describe('Public Worker - index-public', () => {
  beforeEach(async () => {
    await clearKV();
    await clearR2();
  });

  describe('Website Resolution', () => {
    describe('WebsiteUrl path-based routing', () => {
      it('serves content for root path website', async () => {
        await setupWebsiteWithUrl({
          website: { id: 'ws-1' },
          websiteUrl: { domain: 'example.com', path: '/' },
          r2Files: {
            'production/ws-1/live/index.html': '<html>Home</html>',
          },
        });

        const res = await app.request('https://example.com/', {}, env);
        expect(res.status).toBe(200);
        expect(await res.text()).toBe('<html>Home</html>');
      });

      it('serves content for nested path website', async () => {
        await setupWebsiteWithUrl({
          website: { id: 'ws-blog' },
          websiteUrl: { domain: 'example.com', path: '/blog' },
          r2Files: {
            'production/ws-blog/live/index.html': '<html>Blog Home</html>',
          },
        });

        const res = await app.request('https://example.com/blog/', {}, env);
        expect(res.status).toBe(200);
        expect(await res.text()).toBe('<html>Blog Home</html>');
      });

      it('serves subpages under a path-based website', async () => {
        await setupWebsiteWithUrl({
          website: { id: 'ws-blog' },
          websiteUrl: { domain: 'example.com', path: '/blog' },
          r2Files: {
            'production/ws-blog/live/posts/my-post/index.html': '<html>Blog Post</html>',
          },
        });

        const res = await app.request('https://example.com/blog/posts/my-post', {}, env);
        expect(res.status).toBe(200);
        expect(await res.text()).toBe('<html>Blog Post</html>');
      });
    });

    describe('Longest path matching', () => {
      it('matches longest path when multiple paths exist', async () => {
        await setupMultipleWebsiteUrls({
          website: { id: 'ws-root' },
          urls: [{ domain: 'example.com', path: '/', id: 'url-root' }],
          r2Files: { 'production/ws-root/live/index.html': '<html>Root</html>' },
        });

        await setupMultipleWebsiteUrls({
          website: { id: 'ws-docs' },
          urls: [{ domain: 'example.com', path: '/docs', id: 'url-docs' }],
          r2Files: { 'production/ws-docs/live/index.html': '<html>Docs</html>' },
        });

        await setupMultipleWebsiteUrls({
          website: { id: 'ws-docs-api' },
          urls: [{ domain: 'example.com', path: '/docs/api', id: 'url-docs-api' }],
          r2Files: {
            'production/ws-docs-api/live/index.html': '<html>API Docs</html>',
            'production/ws-docs-api/live/users/index.html': '<html>Users Docs</html>',
          },
        });

        const rootRes = await app.request('https://example.com/', {}, env);
        expect(await rootRes.text()).toBe('<html>Root</html>');

        const docsRes = await app.request('https://example.com/docs/', {}, env);
        expect(await docsRes.text()).toBe('<html>Docs</html>');

        const apiDocsRes = await app.request('https://example.com/docs/api/', {}, env);
        expect(await apiDocsRes.text()).toBe('<html>API Docs</html>');

        const deepApiRes = await app.request('https://example.com/docs/api/users', {}, env);
        expect(await deepApiRes.text()).toBe('<html>Users Docs</html>');
      });

      it('does not match partial path segments', async () => {
        await setupWebsiteWithUrl({
          website: { id: 'ws-blog' },
          websiteUrl: { domain: 'example.com', path: '/blog' },
        });

        const res = await app.request('https://example.com/blogger', {}, env);
        expect(res.status).toBe(404);
      });
    });

    describe('Legacy Domain fallback', () => {
      it('falls back to Domain lookup when no WebsiteUrl matches', async () => {
        await setupWebsiteWithDomain({
          website: { id: 'ws-legacy' },
          domain: { domain: 'legacy.example.com' },
          r2Files: {
            'production/ws-legacy/live/index.html': '<html>Legacy Site</html>',
          },
        });

        const res = await app.request('https://legacy.example.com/', {}, env);
        expect(res.status).toBe(200);
        expect(await res.text()).toBe('<html>Legacy Site</html>');
      });

      it('returns 404 when neither WebsiteUrl nor Domain matches', async () => {
        const res = await app.request('https://nonexistent.com/', {}, env);
        expect(res.status).toBe(404);
        expect(await res.text()).toBe('Website not found');
      });
    });
  });

  describe('Preview Mode', () => {
    it('serves from preview directory when hostname starts with preview.', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-1' },
        websiteUrl: { domain: 'example.com', path: '/' },
        r2Files: {
          'production/ws-1/preview/index.html': '<html>Preview Version</html>',
          'production/ws-1/live/index.html': '<html>Live Version</html>',
        },
      });

      const previewRes = await app.request('https://preview.example.com/', {}, env);
      expect(await previewRes.text()).toBe('<html>Preview Version</html>');

      const liveRes = await app.request('https://example.com/', {}, env);
      expect(await liveRes.text()).toBe('<html>Live Version</html>');
    });

    it('correctly strips preview prefix for WebsiteUrl lookup', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-1' },
        websiteUrl: { domain: 'example.com', path: '/app' },
        r2Files: {
          'production/ws-1/preview/dashboard/index.html': '<html>Preview Dashboard</html>',
        },
      });

      const res = await app.request('https://preview.example.com/app/dashboard', {}, env);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('<html>Preview Dashboard</html>');
    });
  });

  describe('Environment Selection (cloudEnv)', () => {
    it('uses production environment by default', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-1' },
        websiteUrl: { domain: 'example.com', path: '/' },
        r2Files: {
          'production/ws-1/live/index.html': '<html>Production</html>',
        },
      });

      const res = await app.request('https://example.com/', {}, env);
      expect(await res.text()).toBe('<html>Production</html>');
    });

    it('uses staging environment when cloudEnv=staging', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-1' },
        websiteUrl: { domain: 'example.com', path: '/' },
        cloudEnv: 'staging',
        r2Files: {
          'staging/ws-1/live/index.html': '<html>Staging</html>',
        },
      });

      const res = await app.request('https://example.com/?cloudEnv=staging', {}, env);
      expect(await res.text()).toBe('<html>Staging</html>');
    });

    it('uses development environment when cloudEnv=development', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-1' },
        websiteUrl: { domain: 'example.com', path: '/' },
        cloudEnv: 'development',
        r2Files: {
          'development/ws-1/live/index.html': '<html>Development</html>',
        },
      });

      const res = await app.request('https://example.com/?cloudEnv=development', {}, env);
      expect(await res.text()).toBe('<html>Development</html>');
    });

    it('ignores invalid cloudEnv values', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-1' },
        websiteUrl: { domain: 'example.com', path: '/' },
        r2Files: {
          'production/ws-1/live/index.html': '<html>Production</html>',
        },
      });

      const res = await app.request('https://example.com/?cloudEnv=invalid', {}, env);
      expect(await res.text()).toBe('<html>Production</html>');
    });

    it('inherits cloudEnv from Referer header for asset requests', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-1' },
        websiteUrl: { domain: 'example.com', path: '/' },
        cloudEnv: 'staging',
        r2Files: {
          'staging/ws-1/live/assets/app.js': 'console.log("staging")',
        },
      });

      const res = await app.request('https://example.com/assets/app.js', {
        headers: {
          Referer: 'https://example.com/?cloudEnv=staging',
        },
      }, env);

      expect(await res.text()).toBe('console.log("staging")');
    });

    it('inherits cloudEnv from Referer for .css files', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-1' },
        websiteUrl: { domain: 'example.com', path: '/' },
        cloudEnv: 'development',
        r2Files: {
          'development/ws-1/live/styles.css': 'body { background: red; }',
        },
      });

      const res = await app.request('https://example.com/styles.css', {
        headers: {
          Referer: 'https://example.com/page?cloudEnv=development',
        },
      }, env);

      expect(await res.text()).toBe('body { background: red; }');
    });

    it('inherits cloudEnv from Referer for .js files', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-1' },
        websiteUrl: { domain: 'example.com', path: '/' },
        cloudEnv: 'staging',
        r2Files: {
          'staging/ws-1/live/bundle.js': 'var env="staging"',
        },
      });

      const res = await app.request('https://example.com/bundle.js', {
        headers: {
          Referer: 'https://example.com/?cloudEnv=staging',
        },
      }, env);

      expect(await res.text()).toBe('var env="staging"');
    });
  });

  describe('Path Normalization', () => {
    it('redirects inner page trailing slash then serves content via non-trailing path', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-1' },
        websiteUrl: { domain: 'example.com', path: '/' },
        r2Files: {
          'production/ws-1/live/about/index.html': '<html>About</html>',
        },
      });

      // /about/ redirects to /about to fix relative asset paths
      const redirectRes = await app.request('https://example.com/about/', { redirect: 'manual' }, env);
      expect(redirectRes.status).toBe(301);
      expect(redirectRes.headers.get('location')).toBe('https://example.com/about');

      // /about then serves about/index.html
      const res = await app.request('https://example.com/about', {}, env);
      expect(await res.text()).toBe('<html>About</html>');
    });

    it('appends /index.html for directory paths without extension', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-1' },
        websiteUrl: { domain: 'example.com', path: '/' },
        r2Files: {
          'production/ws-1/live/about/index.html': '<html>About</html>',
        },
      });

      const res = await app.request('https://example.com/about', {}, env);
      expect(await res.text()).toBe('<html>About</html>');
    });

    it('does not append index.html for file paths with extensions', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-1' },
        websiteUrl: { domain: 'example.com', path: '/' },
        r2Files: {
          'production/ws-1/live/data.json': '{"key": "value"}',
        },
      });

      const res = await app.request('https://example.com/data.json', {}, env);
      expect(await res.text()).toBe('{"key": "value"}');
    });

    it('correctly strips matched path prefix from R2 key', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-docs' },
        websiteUrl: { domain: 'example.com', path: '/docs' },
        r2Files: {
          'production/ws-docs/live/getting-started/index.html': '<html>Getting Started</html>',
        },
      });

      const res = await app.request('https://example.com/docs/getting-started', {}, env);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('<html>Getting Started</html>');
    });
  });

  describe('Content-Type Detection', () => {
    const contentTypeTests = [
      { ext: 'html', file: 'page.html', expected: 'text/html', content: '<html></html>' },
      { ext: 'css', file: 'styles.css', expected: 'text/css', content: 'body {}' },
      { ext: 'js', file: 'app.js', expected: 'application/javascript', content: 'var x=1' },
      { ext: 'mjs', file: 'module.mjs', expected: 'application/javascript', content: 'export default {}' },
      { ext: 'json', file: 'data.json', expected: 'application/json', content: '{}' },
      { ext: 'svg', file: 'icon.svg', expected: 'image/svg+xml', content: '<svg></svg>' },
      { ext: 'png', file: 'image.png', expected: 'image/png', content: 'PNG' },
      { ext: 'jpg', file: 'photo.jpg', expected: 'image/jpeg', content: 'JPEG' },
      { ext: 'jpeg', file: 'photo.jpeg', expected: 'image/jpeg', content: 'JPEG' },
      { ext: 'gif', file: 'anim.gif', expected: 'image/gif', content: 'GIF' },
      { ext: 'ico', file: 'favicon.ico', expected: 'image/x-icon', content: 'ICO' },
      { ext: 'woff', file: 'font.woff', expected: 'font/woff', content: 'WOFF' },
      { ext: 'woff2', file: 'font.woff2', expected: 'font/woff2', content: 'WOFF2' },
      { ext: 'ttf', file: 'font.ttf', expected: 'font/ttf', content: 'TTF' },
      { ext: 'otf', file: 'font.otf', expected: 'font/otf', content: 'OTF' },
    ];

    for (const { ext, file, expected, content } of contentTypeTests) {
      it(`returns correct content-type for .${ext} files`, async () => {
        await setupWebsiteWithUrl({
          website: { id: 'ws-1' },
          websiteUrl: { domain: 'example.com', path: '/' },
          r2Files: {
            [`production/ws-1/live/${file}`]: content,
          },
        });

        const res = await app.request(`https://example.com/${file}`, {}, env);
        expect(res.headers.get('content-type')).toBe(expected);
      });
    }

    it('returns application/octet-stream for unknown extensions', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-1' },
        websiteUrl: { domain: 'example.com', path: '/' },
        r2Files: {
          'production/ws-1/live/file.xyz': 'unknown content',
        },
      });

      const res = await app.request('https://example.com/file.xyz', {}, env);
      expect(res.headers.get('content-type')).toBe('application/octet-stream');
    });
  });

  describe('R2 Object Key Construction', () => {
    it('constructs correct R2 key for root path website', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'website-123' },
        websiteUrl: { domain: 'example.com', path: '/' },
        r2Files: {
          'production/website-123/live/index.html': '<html>Root</html>',
        },
      });

      const res = await app.request('https://example.com/', {}, env);
      expect(res.status).toBe(200);
    });

    it('constructs correct R2 key for nested file', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'website-123' },
        websiteUrl: { domain: 'example.com', path: '/' },
        r2Files: {
          'production/website-123/live/assets/images/logo.png': 'PNG_DATA',
        },
      });

      const res = await app.request('https://example.com/assets/images/logo.png', {}, env);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('PNG_DATA');
    });

    it('constructs correct R2 key for path-based website subpage', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'blog-site' },
        websiteUrl: { domain: 'example.com', path: '/blog' },
        r2Files: {
          'production/blog-site/live/2024/post/index.html': '<html>Blog Post</html>',
        },
      });

      const res = await app.request('https://example.com/blog/2024/post', {}, env);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('<html>Blog Post</html>');
    });

    it('constructs correct R2 key with staging environment', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-1' },
        websiteUrl: { domain: 'example.com', path: '/' },
        cloudEnv: 'staging',
        r2Files: {
          'staging/ws-1/live/index.html': '<html>Staging</html>',
        },
      });

      const res = await app.request('https://example.com/?cloudEnv=staging', {}, env);
      expect(res.status).toBe(200);
    });

    it('constructs correct R2 key with preview directory', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-1' },
        websiteUrl: { domain: 'example.com', path: '/' },
        r2Files: {
          'production/ws-1/preview/index.html': '<html>Preview</html>',
        },
      });

      const res = await app.request('https://preview.example.com/', {}, env);
      expect(res.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('returns 404 when website exists but R2 object not found', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-1' },
        websiteUrl: { domain: 'example.com', path: '/' },
      });

      const res = await app.request('https://example.com/nonexistent.html', {}, env);
      expect(res.status).toBe(404);
    });

    it('returns 404 with appropriate message for missing R2 file', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-1' },
        websiteUrl: { domain: 'example.com', path: '/' },
        r2Files: {
          'production/ws-1/live/index.html': '<html>Home</html>',
        },
      });

      const res = await app.request('https://example.com/missing.js', {}, env);
      expect(res.status).toBe(404);
      expect(await res.text()).toBe('File not found');
    });
  });

  describe('SPA Fallback', () => {
    it('serves index.html for root path', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-1' },
        websiteUrl: { domain: 'example.com', path: '/' },
        r2Files: {
          'production/ws-1/live/index.html': '<html>SPA Root</html>',
        },
      });

      const res = await app.request('https://example.com/', {}, env);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('<html>SPA Root</html>');
    });

    it('serves existing files directly', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-1' },
        websiteUrl: { domain: 'example.com', path: '/' },
        r2Files: {
          'production/ws-1/live/index.html': '<html>Home</html>',
          'production/ws-1/live/assets/app.js': 'console.log("app")',
        },
      });

      const res = await app.request('https://example.com/assets/app.js', {}, env);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('console.log("app")');
    });

    it('serves index.html for route without extension (SPA fallback)', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-1' },
        websiteUrl: { domain: 'example.com', path: '/' },
        r2Files: {
          'production/ws-1/live/index.html': '<html>SPA App</html>',
        },
      });

      // /pricing doesn't exist in R2, should fallback to index.html
      const res = await app.request('https://example.com/pricing', {}, env);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('<html>SPA App</html>');
    });

    it('serves index.html for nested route (SPA fallback)', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-1' },
        websiteUrl: { domain: 'example.com', path: '/' },
        r2Files: {
          'production/ws-1/live/index.html': '<html>SPA App</html>',
        },
      });

      // /blog/posts/my-article doesn't exist in R2, should fallback to index.html
      const res = await app.request('https://example.com/blog/posts/my-article', {}, env);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('<html>SPA App</html>');
    });

    it('handles subpath deployments correctly (SPA fallback)', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-bingo' },
        websiteUrl: { domain: 'example.com', path: '/bingo' },
        r2Files: {
          'production/ws-bingo/live/index.html': '<html>Bingo SPA</html>',
        },
      });

      // /bingo/pricing doesn't exist in R2, should fallback to /bingo's index.html
      const res = await app.request('https://example.com/bingo/pricing', {}, env);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('<html>Bingo SPA</html>');
    });

    it('returns 404 for missing asset with extension (no fallback)', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-1' },
        websiteUrl: { domain: 'example.com', path: '/' },
        r2Files: {
          'production/ws-1/live/index.html': '<html>Home</html>',
        },
      });

      // /assets/missing.js should NOT fallback - it's an asset request
      const res = await app.request('https://example.com/assets/missing.js', {}, env);
      expect(res.status).toBe(404);
    });

    it('returns 404 for dotfiles (no fallback)', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-1' },
        websiteUrl: { domain: 'example.com', path: '/' },
        r2Files: {
          'production/ws-1/live/index.html': '<html>Home</html>',
        },
      });

      // /.well-known/acme-challenge/token should NOT fallback
      const res = await app.request('https://example.com/.well-known/acme-challenge/token', {}, env);
      expect(res.status).toBe(404);
    });
  });

  describe('ETag Headers', () => {
    it('includes etag header in response', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-1' },
        websiteUrl: { domain: 'example.com', path: '/' },
        r2Files: {
          'production/ws-1/live/index.html': '<html>Content</html>',
        },
      });

      const res = await app.request('https://example.com/', {}, env);
      expect(res.headers.get('etag')).toBeTruthy();
    });
  });

  describe('Asset Resolution for Subpath Websites', () => {
    it('redirects subpath without trailing slash to trailing slash', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-bingo' },
        websiteUrl: { id: 'url-bingo', domain: 'example.launch10.site', path: '/bingo' },
        r2Files: {
          'production/ws-bingo/live/index.html': '<html>Bingo Site</html>',
        },
      });

      const res = await app.request('https://example.launch10.site/bingo', { redirect: 'manual' }, env);
      expect(res.status).toBe(301);
      expect(res.headers.get('location')).toBe('https://example.launch10.site/bingo/');
    });

    it('redirects inner page trailing slash to non-trailing slash (root site)', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-root' },
        websiteUrl: { id: 'url-root', domain: 'example.launch10.site', path: '/' },
        r2Files: {
          'production/ws-root/live/index.html': '<html>Root</html>',
          'production/ws-root/live/pricing/index.html': '<html>Pricing</html>',
        },
      });

      const res = await app.request('https://example.launch10.site/pricing/', { redirect: 'manual' }, env);
      expect(res.status).toBe(301);
      expect(res.headers.get('location')).toBe('https://example.launch10.site/pricing');
    });

    it('redirects inner page trailing slash to non-trailing slash (subpath site)', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-bingo' },
        websiteUrl: { id: 'url-bingo', domain: 'example.launch10.site', path: '/bingo' },
        r2Files: {
          'production/ws-bingo/live/index.html': '<html>Bingo</html>',
          'production/ws-bingo/live/pricing/index.html': '<html>Bingo Pricing</html>',
        },
      });

      const res = await app.request('https://example.launch10.site/bingo/pricing/', { redirect: 'manual' }, env);
      expect(res.status).toBe(301);
      expect(res.headers.get('location')).toBe('https://example.launch10.site/bingo/pricing');
    });

    it('does not redirect root trailing slash', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-root' },
        websiteUrl: { id: 'url-root', domain: 'example.launch10.site', path: '/' },
        r2Files: {
          'production/ws-root/live/index.html': '<html>Root</html>',
        },
      });

      const res = await app.request('https://example.launch10.site/', { redirect: 'manual' }, env);
      expect(res.status).toBe(200);
    });

    it('does not redirect subpath root trailing slash', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-bingo' },
        websiteUrl: { id: 'url-bingo', domain: 'example.launch10.site', path: '/bingo' },
        r2Files: {
          'production/ws-bingo/live/index.html': '<html>Bingo</html>',
        },
      });

      // /bingo/ should NOT be redirected (it's the subpath root)
      const res = await app.request('https://example.launch10.site/bingo/', { redirect: 'manual' }, env);
      expect(res.status).toBe(200);
    });

    it('does not redirect asset requests with trailing slash', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-root' },
        websiteUrl: { id: 'url-root', domain: 'example.launch10.site', path: '/' },
        r2Files: {
          'production/ws-root/live/index.html': '<html>Root</html>',
        },
      });

      // /assets/foo.js should never be redirected (isAssetRequest = true)
      const res = await app.request('https://example.launch10.site/assets/foo.js', { redirect: 'manual' }, env);
      // Should be 404 since the asset doesn't exist, not a redirect
      expect(res.status).toBe(404);
    });

    it('serves assets from subpath website when both root and subpath exist', async () => {
      // Setup root website at /
      await setupWebsiteWithUrl({
        website: { id: 'ws-root' },
        websiteUrl: { id: 'url-root', domain: 'example.launch10.site', path: '/' },
        r2Files: {
          'production/ws-root/live/index.html': '<html>Root Site</html>',
          'production/ws-root/live/assets/index-root.js': 'console.log("root")',
        },
      });

      // Setup subpath website at /bingo
      await setupWebsiteWithUrl({
        website: { id: 'ws-bingo' },
        websiteUrl: { id: 'url-bingo', domain: 'example.launch10.site', path: '/bingo' },
        r2Files: {
          'production/ws-bingo/live/index.html': '<html>Bingo Site</html>',
          'production/ws-bingo/live/assets/index-bingo.js': 'console.log("bingo")',
          'production/ws-bingo/live/assets/index-CJtnk77_.css': 'body { color: red; }',
        },
      });

      // Root should serve root content
      const rootRes = await app.request('https://example.launch10.site/', {}, env);
      expect(await rootRes.text()).toBe('<html>Root Site</html>');

      // Subpath should serve subpath content
      const bingoRes = await app.request('https://example.launch10.site/bingo/', {}, env);
      expect(await bingoRes.text()).toBe('<html>Bingo Site</html>');

      // Assets under subpath should resolve to subpath website's assets
      const bingoAssetRes = await app.request('https://example.launch10.site/bingo/assets/index-bingo.js', {}, env);
      expect(bingoAssetRes.status).toBe(200);
      expect(await bingoAssetRes.text()).toBe('console.log("bingo")');

      // CSS asset under subpath
      const bingoCssRes = await app.request('https://example.launch10.site/bingo/assets/index-CJtnk77_.css', {}, env);
      expect(bingoCssRes.status).toBe(200);
      expect(await bingoCssRes.text()).toBe('body { color: red; }');

      // Root assets should still work
      const rootAssetRes = await app.request('https://example.launch10.site/assets/index-root.js', {}, env);
      expect(rootAssetRes.status).toBe(200);
      expect(await rootAssetRes.text()).toBe('console.log("root")');
    });

  });

  describe('Complex Multi-Tenant Scenarios', () => {
    it('serves different websites for different domains', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'site-a' },
        websiteUrl: { id: 'url-a', domain: 'site-a.com', path: '/' },
        r2Files: { 'production/site-a/live/index.html': '<html>Site A</html>' },
      });

      await setupWebsiteWithUrl({
        website: { id: 'site-b' },
        websiteUrl: { id: 'url-b', domain: 'site-b.com', path: '/' },
        r2Files: { 'production/site-b/live/index.html': '<html>Site B</html>' },
      });

      const resA = await app.request('https://site-a.com/', {}, env);
      const resB = await app.request('https://site-b.com/', {}, env);

      expect(await resA.text()).toBe('<html>Site A</html>');
      expect(await resB.text()).toBe('<html>Site B</html>');
    });

    it('serves different websites on same domain with different paths', async () => {
      await setupMultipleWebsiteUrls({
        website: { id: 'main-site' },
        urls: [{ id: 'url-main', domain: 'platform.com', path: '/' }],
        r2Files: { 'production/main-site/live/index.html': '<html>Main</html>' },
      });

      await setupMultipleWebsiteUrls({
        website: { id: 'docs-site' },
        urls: [{ id: 'url-docs', domain: 'platform.com', path: '/docs' }],
        r2Files: { 'production/docs-site/live/index.html': '<html>Docs</html>' },
      });

      await setupMultipleWebsiteUrls({
        website: { id: 'blog-site' },
        urls: [{ id: 'url-blog', domain: 'platform.com', path: '/blog' }],
        r2Files: { 'production/blog-site/live/index.html': '<html>Blog</html>' },
      });

      const mainRes = await app.request('https://platform.com/', {}, env);
      const docsRes = await app.request('https://platform.com/docs/', {}, env);
      const blogRes = await app.request('https://platform.com/blog/', {}, env);

      expect(await mainRes.text()).toBe('<html>Main</html>');
      expect(await docsRes.text()).toBe('<html>Docs</html>');
      expect(await blogRes.text()).toBe('<html>Blog</html>');
    });
  });
});
