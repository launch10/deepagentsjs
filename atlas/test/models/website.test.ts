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
} from '../support';

describe('Website Model', () => {
  beforeEach(async () => {
    await clearKV();
  });

  describe('get', () => {
    it('retrieves a website by ID', async () => {
      const website = createWebsite({ id: 'ws-1', accountId: 'acc-1' });
      await seedKV({ 'website:ws-1': website });

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
      await seedKV({ 'domain:orphan-domain': domain });
      await seedKVRaw({ 'index:domain:domain:orphan.com': 'orphan-domain' });

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
  });
});

describe('Domain Model', () => {
  beforeEach(async () => {
    await clearKV();
  });

  describe('findByUrl', () => {
    it('finds domain by URL', async () => {
      const domain = createDomain({ id: 'd-1', domain: 'test.com' });
      await seedKV({ 'domain:d-1': domain });
      await seedKVRaw({ 'index:domain:domain:test.com': 'd-1' });

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
  });

});
