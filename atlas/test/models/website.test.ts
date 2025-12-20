import { describe, it, expect, beforeEach } from 'vitest';
import { Website } from '~/models/website';
import { Domain } from '~/models/domain';
import {
  clearKV,
  createWebsite,
  createDomain,
  setupWebsiteWithDomain,
  seedKV,
  seedKVRaw,
  createMockContext,
  DEFAULT_ENV,
} from '../support';

describe('Website Model', () => {
  beforeEach(async () => {
    await clearKV();
  });

  describe('get', () => {
    it('retrieves a website by ID', async () => {
      const website = createWebsite({ id: 'ws-1', accountId: 'acc-1' });
      await seedKV({ [`${DEFAULT_ENV}:website:ws-1`]: website });

      const c = createMockContext();
      const model = new Website(c);
      const result = await model.get('ws-1');

      expect(result).toEqual(website);
    });

    it('returns null for non-existent website', async () => {
      const c = createMockContext();
      const model = new Website(c);
      const result = await model.get('nonexistent');

      expect(result).toBeNull();
    });

    it('retrieves from correct environment', async () => {
      const prodWebsite = createWebsite({ id: 'ws-1', accountId: 'prod-acc' });
      const stagingWebsite = createWebsite({ id: 'ws-1', accountId: 'staging-acc' });

      await seedKV({
        ['production:website:ws-1']: prodWebsite,
        ['staging:website:ws-1']: stagingWebsite,
      });

      const prodContext = createMockContext({ cloudEnv: 'production' });
      const prodModel = new Website(prodContext);
      const prodResult = await prodModel.get('ws-1');
      expect(prodResult!.accountId).toBe('prod-acc');

      const stagingContext = createMockContext({ cloudEnv: 'staging' });
      const stagingModel = new Website(stagingContext);
      const stagingResult = await stagingModel.get('ws-1');
      expect(stagingResult!.accountId).toBe('staging-acc');
    });
  });

  describe('findByUrl (legacy Domain lookup)', () => {
    it('finds website via domain lookup', async () => {
      const { website, domain } = await setupWebsiteWithDomain({
        website: { id: 'ws-legacy', accountId: 'acc-1' },
        domain: { domain: 'legacy.example.com' },
      });

      const c = createMockContext();
      const model = new Website(c);
      const result = await model.findByUrl('legacy.example.com');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('ws-legacy');
    });

    it('returns null when domain does not exist', async () => {
      const c = createMockContext();
      const model = new Website(c);
      const result = await model.findByUrl('nonexistent.com');

      expect(result).toBeNull();
    });

    it('returns null when domain exists but website does not', async () => {
      const domain = createDomain({
        id: 'orphan-domain',
        websiteId: 'nonexistent-website',
        domain: 'orphan.com',
      });
      await seedKV({ [`${DEFAULT_ENV}:domain:orphan-domain`]: domain });
      await seedKVRaw({ [`${DEFAULT_ENV}:index:domain:domain:orphan.com`]: 'orphan-domain' });

      const c = createMockContext();
      const model = new Website(c);
      const result = await model.findByUrl('orphan.com');

      expect(result).toBeNull();
    });
  });

  describe('CRUD operations', () => {
    it('creates and retrieves a website', async () => {
      const c = createMockContext();
      const model = new Website(c);
      
      const website = createWebsite({ id: 'new-ws' });
      await model.set(website.id, website);
      const result = await model.get(website.id);

      expect(result).toEqual(website);
    });

    it('updates an existing website', async () => {
      const c = createMockContext();
      const model = new Website(c);
      
      const website = createWebsite({ id: 'update-ws', accountId: 'old-account' });
      await model.set(website.id, website);

      await model.set(website.id, { ...website, accountId: 'new-account' });
      const result = await model.get(website.id);

      expect(result!.accountId).toBe('new-account');
    });

    it('deletes a website', async () => {
      const c = createMockContext();
      const model = new Website(c);
      
      const website = createWebsite({ id: 'delete-ws' });
      await model.set(website.id, website);

      await model.delete(website.id);
      const result = await model.get(website.id);

      expect(result).toBeNull();
    });

    it('stores data in environment-specific keys', async () => {
      const stagingContext = createMockContext({ cloudEnv: 'staging' });
      const stagingModel = new Website(stagingContext);
      
      const website = createWebsite({ id: 'env-test-ws' });
      await stagingModel.set(website.id, website);
      
      const stagingResult = await stagingModel.get(website.id);
      expect(stagingResult).toEqual(website);

      const prodContext = createMockContext({ cloudEnv: 'production' });
      const prodModel = new Website(prodContext);
      const prodResult = await prodModel.get(website.id);
      expect(prodResult).toBeNull();
    });
  });
});

describe('Domain Model', () => {
  beforeEach(async () => {
    await clearKV();
  });

  describe('findByUrl', () => {
    it('finds domain by URL', async () => {
      const domain = createDomain({ id: 'd-1', domain: 'test.com' });
      await seedKV({ [`${DEFAULT_ENV}:domain:d-1`]: domain });
      await seedKVRaw({ [`${DEFAULT_ENV}:index:domain:domain:test.com`]: 'd-1' });

      const c = createMockContext();
      const model = new Domain(c);
      const result = await model.findByUrl('test.com');

      expect(result).toEqual(domain);
    });

    it('returns null for non-existent domain', async () => {
      const c = createMockContext();
      const model = new Domain(c);
      const result = await model.findByUrl('nonexistent.com');

      expect(result).toBeNull();
    });

    it('retrieves from correct environment', async () => {
      const prodDomain = createDomain({ id: 'd-1', domain: 'test.com', websiteId: 'prod-ws' });
      const stagingDomain = createDomain({ id: 'd-1', domain: 'test.com', websiteId: 'staging-ws' });

      await seedKV({
        ['production:domain:d-1']: prodDomain,
        ['staging:domain:d-1']: stagingDomain,
      });
      await seedKVRaw({
        ['production:index:domain:domain:test.com']: 'd-1',
        ['staging:index:domain:domain:test.com']: 'd-1',
      });

      const prodContext = createMockContext({ cloudEnv: 'production' });
      const prodModel = new Domain(prodContext);
      const prodResult = await prodModel.findByUrl('test.com');
      expect(prodResult!.websiteId).toBe('prod-ws');

      const stagingContext = createMockContext({ cloudEnv: 'staging' });
      const stagingModel = new Domain(stagingContext);
      const stagingResult = await stagingModel.findByUrl('test.com');
      expect(stagingResult!.websiteId).toBe('staging-ws');
    });
  });

});
