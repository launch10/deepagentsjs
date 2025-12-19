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
        r2Files: {
          'staging/ws-1/live/index.html': '<html>Staging</html>',
          'production/ws-1/live/index.html': '<html>Production</html>',
        },
      });

      const res = await app.request('https://example.com/?cloudEnv=staging', {}, env);
      expect(await res.text()).toBe('<html>Staging</html>');
    });

    it('uses development environment when cloudEnv=development', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-1' },
        websiteUrl: { domain: 'example.com', path: '/' },
        r2Files: {
          'development/ws-1/live/index.html': '<html>Development</html>',
          'production/ws-1/live/index.html': '<html>Production</html>',
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
        r2Files: {
          'staging/ws-1/live/assets/app.js': 'console.log("staging")',
          'production/ws-1/live/assets/app.js': 'console.log("production")',
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
        r2Files: {
          'development/ws-1/live/styles.css': 'body { background: red; }',
          'production/ws-1/live/styles.css': 'body { background: blue; }',
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
    it('appends index.html for directory paths ending with /', async () => {
      await setupWebsiteWithUrl({
        website: { id: 'ws-1' },
        websiteUrl: { domain: 'example.com', path: '/' },
        r2Files: {
          'production/ws-1/live/about/index.html': '<html>About</html>',
        },
      });

      const res = await app.request('https://example.com/about/', {}, env);
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
      });

      const res = await app.request('https://example.com/missing', {}, env);
      expect(res.status).toBe(404);
      expect(await res.text()).toBe('Website not found, error 505');
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
