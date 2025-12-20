import { describe, it, expect, beforeEach } from 'vitest';
import { WebsiteUrl } from '~/models/website-url';
import {
  clearKV,
  seedKV,
  seedKVRaw,
  createWebsiteUrl,
  setupMultipleWebsiteUrls,
  createMockContext,
  DEFAULT_ENV,
} from '../support';

describe('WebsiteUrl Model', () => {
  beforeEach(async () => {
    await clearKV();
  });

  describe('findByDomainAndPath', () => {
    it('finds a website URL by exact domain and path match', async () => {
      const websiteUrl = createWebsiteUrl({
        id: 'url-1',
        domain: 'example.com',
        path: '/blog',
      });

      await seedKV({ [`${DEFAULT_ENV}:websiteUrl:url-1`]: websiteUrl });
      await seedKVRaw({ [`${DEFAULT_ENV}:index:websiteUrl:domainPath:example.com:/blog`]: 'url-1' });

      const c = createMockContext();
      const model = new WebsiteUrl(c);
      const result = await model.findByDomainAndPath('example.com', '/blog');

      expect(result).toEqual(websiteUrl);
    });

    it('returns null for non-existent domain/path', async () => {
      const c = createMockContext();
      const model = new WebsiteUrl(c);
      const result = await model.findByDomainAndPath('nonexistent.com', '/path');

      expect(result).toBeNull();
    });

    it('uses correct environment when looking up data', async () => {
      const prodUrl = createWebsiteUrl({
        id: 'url-prod',
        domain: 'example.com',
        path: '/blog',
      });
      const stagingUrl = createWebsiteUrl({
        id: 'url-staging',
        domain: 'example.com',
        path: '/blog',
        websiteId: 'staging-website',
      });

      await seedKV({
        ['production:websiteUrl:url-prod']: prodUrl,
        ['staging:websiteUrl:url-staging']: stagingUrl,
      });
      await seedKVRaw({
        ['production:index:websiteUrl:domainPath:example.com:/blog']: 'url-prod',
        ['staging:index:websiteUrl:domainPath:example.com:/blog']: 'url-staging',
      });

      const prodContext = createMockContext({ cloudEnv: 'production' });
      const prodModel = new WebsiteUrl(prodContext);
      const prodResult = await prodModel.findByDomainAndPath('example.com', '/blog');
      expect(prodResult).toEqual(prodUrl);

      const stagingContext = createMockContext({ cloudEnv: 'staging' });
      const stagingModel = new WebsiteUrl(stagingContext);
      const stagingResult = await stagingModel.findByDomainAndPath('example.com', '/blog');
      expect(stagingResult).toEqual(stagingUrl);
    });
  });

  describe('findByDomainWithLongestPathMatch', () => {
    it('matches root path when pathname is /', async () => {
      await setupMultipleWebsiteUrls({
        urls: [{ domain: 'example.com', path: '/' }],
      });

      const c = createMockContext();
      const model = new WebsiteUrl(c);
      const result = await model.findByDomainWithLongestPathMatch('example.com', '/');

      expect(result).not.toBeNull();
      expect(result!.matchedPath).toBe('/');
    });

    it('matches root path when pathname is /some-page', async () => {
      await setupMultipleWebsiteUrls({
        urls: [{ domain: 'example.com', path: '/' }],
      });

      const c = createMockContext();
      const model = new WebsiteUrl(c);
      const result = await model.findByDomainWithLongestPathMatch('example.com', '/some-page');

      expect(result).not.toBeNull();
      expect(result!.matchedPath).toBe('/');
    });

    it('matches longer path over shorter path', async () => {
      await setupMultipleWebsiteUrls({
        urls: [
          { id: 'url-root', domain: 'example.com', path: '/' },
          { id: 'url-blog', domain: 'example.com', path: '/blog' },
        ],
      });

      const c = createMockContext();
      const model = new WebsiteUrl(c);
      const result = await model.findByDomainWithLongestPathMatch('example.com', '/blog/post-1');

      expect(result).not.toBeNull();
      expect(result!.matchedPath).toBe('/blog');
      expect(result!.websiteUrl.id).toBe('url-blog');
    });

    it('matches longest path among multiple nested paths', async () => {
      await setupMultipleWebsiteUrls({
        urls: [
          { id: 'url-root', domain: 'example.com', path: '/' },
          { id: 'url-docs', domain: 'example.com', path: '/docs' },
          { id: 'url-docs-api', domain: 'example.com', path: '/docs/api' },
          { id: 'url-docs-api-v2', domain: 'example.com', path: '/docs/api/v2' },
        ],
      });

      const c = createMockContext();
      const model = new WebsiteUrl(c);

      const resultV2 = await model.findByDomainWithLongestPathMatch('example.com', '/docs/api/v2/users');
      expect(resultV2!.matchedPath).toBe('/docs/api/v2');
      expect(resultV2!.websiteUrl.id).toBe('url-docs-api-v2');

      const resultApi = await model.findByDomainWithLongestPathMatch('example.com', '/docs/api/v1/users');
      expect(resultApi!.matchedPath).toBe('/docs/api');
      expect(resultApi!.websiteUrl.id).toBe('url-docs-api');

      const resultDocs = await model.findByDomainWithLongestPathMatch('example.com', '/docs/guide');
      expect(resultDocs!.matchedPath).toBe('/docs');
      expect(resultDocs!.websiteUrl.id).toBe('url-docs');

      const resultRoot = await model.findByDomainWithLongestPathMatch('example.com', '/about');
      expect(resultRoot!.matchedPath).toBe('/');
      expect(resultRoot!.websiteUrl.id).toBe('url-root');
    });

    it('matches exact path without trailing content', async () => {
      await setupMultipleWebsiteUrls({
        urls: [
          { id: 'url-blog', domain: 'example.com', path: '/blog' },
        ],
      });

      const c = createMockContext();
      const model = new WebsiteUrl(c);
      const result = await model.findByDomainWithLongestPathMatch('example.com', '/blog');

      expect(result).not.toBeNull();
      expect(result!.matchedPath).toBe('/blog');
    });

    it('does not match partial path segments', async () => {
      await setupMultipleWebsiteUrls({
        urls: [
          { id: 'url-blog', domain: 'example.com', path: '/blog' },
        ],
      });

      const c = createMockContext();
      const model = new WebsiteUrl(c);
      const result = await model.findByDomainWithLongestPathMatch('example.com', '/blogger');

      expect(result).toBeNull();
    });

    it('returns null for non-existent domain', async () => {
      await setupMultipleWebsiteUrls({
        urls: [{ domain: 'example.com', path: '/' }],
      });

      const c = createMockContext();
      const model = new WebsiteUrl(c);
      const result = await model.findByDomainWithLongestPathMatch('other.com', '/');

      expect(result).toBeNull();
    });

    it('handles multiple domains with same paths', async () => {
      const website1 = createWebsiteUrl({
        id: 'url-1',
        websiteId: 'site-1',
        domain: 'site1.com',
        path: '/app',
      });
      const website2 = createWebsiteUrl({
        id: 'url-2',
        websiteId: 'site-2',
        domain: 'site2.com',
        path: '/app',
      });

      await seedKV({
        [`${DEFAULT_ENV}:websiteUrl:url-1`]: website1,
        [`${DEFAULT_ENV}:websiteUrl:url-2`]: website2,
      });
      await seedKVRaw({
        [`${DEFAULT_ENV}:index:websiteUrl:domainPath:site1.com:/app`]: 'url-1',
        [`${DEFAULT_ENV}:index:websiteUrl:domainPath:site2.com:/app`]: 'url-2',
      });

      const c = createMockContext();
      const model = new WebsiteUrl(c);

      const result1 = await model.findByDomainWithLongestPathMatch('site1.com', '/app/dashboard');
      expect(result1!.websiteUrl.websiteId).toBe('site-1');

      const result2 = await model.findByDomainWithLongestPathMatch('site2.com', '/app/dashboard');
      expect(result2!.websiteUrl.websiteId).toBe('site-2');
    });

    it('handles trailing slashes in pathname', async () => {
      await setupMultipleWebsiteUrls({
        urls: [
          { id: 'url-blog', domain: 'example.com', path: '/blog' },
        ],
      });

      const c = createMockContext();
      const model = new WebsiteUrl(c);
      const result = await model.findByDomainWithLongestPathMatch('example.com', '/blog/');

      expect(result).not.toBeNull();
      expect(result!.matchedPath).toBe('/blog');
    });
  });

  describe('CRUD operations', () => {
    it('creates and retrieves a website URL', async () => {
      const c = createMockContext();
      const model = new WebsiteUrl(c);
      
      const websiteUrl = createWebsiteUrl({
        id: 'new-url',
        domain: 'new.com',
        path: '/path',
      });

      await model.set(websiteUrl.id, websiteUrl);
      const result = await model.get(websiteUrl.id);

      expect(result).toEqual(websiteUrl);
    });

    it('updates existing website URL', async () => {
      const c = createMockContext();
      const model = new WebsiteUrl(c);
      
      const websiteUrl = createWebsiteUrl({ id: 'update-url' });
      await model.set(websiteUrl.id, websiteUrl);

      await model.set(websiteUrl.id, { ...websiteUrl, path: '/updated' });
      const result = await model.get(websiteUrl.id);

      expect(result!.path).toBe('/updated');
    });

    it('deletes a website URL', async () => {
      const c = createMockContext();
      const model = new WebsiteUrl(c);
      
      const websiteUrl = createWebsiteUrl({ id: 'delete-url' });
      await model.set(websiteUrl.id, websiteUrl);

      await model.delete(websiteUrl.id);
      const result = await model.get(websiteUrl.id);

      expect(result).toBeNull();
    });

    it('stores data in environment-specific keys', async () => {
      const stagingContext = createMockContext({ cloudEnv: 'staging' });
      const stagingModel = new WebsiteUrl(stagingContext);
      
      const websiteUrl = createWebsiteUrl({
        id: 'env-test-url',
        domain: 'test.com',
        path: '/test',
      });

      await stagingModel.set(websiteUrl.id, websiteUrl);
      
      const stagingResult = await stagingModel.get(websiteUrl.id);
      expect(stagingResult).toEqual(websiteUrl);

      const prodContext = createMockContext({ cloudEnv: 'production' });
      const prodModel = new WebsiteUrl(prodContext);
      const prodResult = await prodModel.get(websiteUrl.id);
      expect(prodResult).toBeNull();
    });
  });
});
