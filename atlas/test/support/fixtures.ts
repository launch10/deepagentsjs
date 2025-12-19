import { env } from 'cloudflare:test';
import { WebsiteType, WebsiteUrlType, DomainType } from '~/types';

export async function seedKV(data: Record<string, any>): Promise<void> {
  await Promise.all(
    Object.entries(data).map(([key, value]) =>
      env.DEPLOYS_KV.put(key, JSON.stringify(value))
    )
  );
}

export async function seedKVRaw(data: Record<string, string>): Promise<void> {
  await Promise.all(
    Object.entries(data).map(([key, value]) =>
      env.DEPLOYS_KV.put(key, value)
    )
  );
}

export async function clearKV(): Promise<void> {
  const keys = await env.DEPLOYS_KV.list();
  await Promise.all(keys.keys.map((key) => env.DEPLOYS_KV.delete(key.name)));
}

export async function seedR2(files: Record<string, string | ArrayBuffer>): Promise<void> {
  await Promise.all(
    Object.entries(files).map(([key, body]) =>
      env.DEPLOYS_R2.put(key, body)
    )
  );
}

export async function clearR2(): Promise<void> {
  const objects = await env.DEPLOYS_R2.list();
  await Promise.all(objects.objects.map((obj) => env.DEPLOYS_R2.delete(obj.key)));
}

export function createWebsite(overrides: Partial<WebsiteType> = {}): WebsiteType {
  return {
    id: 'website-1',
    accountId: 'account-1',
    ...overrides,
  };
}

export function createWebsiteUrl(overrides: Partial<WebsiteUrlType> = {}): WebsiteUrlType {
  return {
    id: 'website-url-1',
    websiteId: 'website-1',
    domain: 'example.com',
    path: '/',
    ...overrides,
  };
}

export function createDomain(overrides: Partial<DomainType> = {}): DomainType {
  return {
    id: 'domain-1',
    websiteId: 'website-1',
    domain: 'example.com',
    ...overrides,
  };
}

export async function setupWebsiteWithUrl(options: {
  website?: Partial<WebsiteType>;
  websiteUrl?: Partial<WebsiteUrlType>;
  r2Files?: Record<string, string>;
}): Promise<{ website: WebsiteType; websiteUrl: WebsiteUrlType }> {
  const website = createWebsite(options.website);
  const websiteUrl = createWebsiteUrl({
    websiteId: website.id,
    ...options.websiteUrl,
  });

  await seedKV({
    [`website:${website.id}`]: website,
    [`websiteUrl:${websiteUrl.id}`]: websiteUrl,
  });

  await seedKVRaw({
    [`index:websiteUrl:websiteId:${websiteUrl.websiteId}`]: websiteUrl.id,
    [`index:websiteUrl:domainPath:${websiteUrl.domain}:${websiteUrl.path}`]: websiteUrl.id,
  });

  if (options.r2Files) {
    await seedR2(options.r2Files);
  }

  return { website, websiteUrl };
}

export async function setupWebsiteWithDomain(options: {
  website?: Partial<WebsiteType>;
  domain?: Partial<DomainType>;
  r2Files?: Record<string, string>;
}): Promise<{ website: WebsiteType; domain: DomainType }> {
  const website = createWebsite(options.website);
  const domain = createDomain({
    websiteId: website.id,
    ...options.domain,
  });

  await seedKV({
    [`website:${website.id}`]: website,
    [`domain:${domain.id}`]: domain,
  });

  await seedKVRaw({
    [`index:website:accountId:${website.accountId}`]: website.id,
    [`index:domain:websiteId:${domain.websiteId}`]: domain.id,
    [`index:domain:domain:${domain.domain}`]: domain.id,
  });

  if (options.r2Files) {
    await seedR2(options.r2Files);
  }

  return { website, domain };
}

export async function setupMultipleWebsiteUrls(configs: {
  website?: Partial<WebsiteType>;
  urls: Partial<WebsiteUrlType>[];
  r2Files?: Record<string, string>;
}): Promise<{ website: WebsiteType; websiteUrls: WebsiteUrlType[] }> {
  const website = createWebsite(configs.website);
  const websiteUrls = configs.urls.map((urlConfig, index) =>
    createWebsiteUrl({
      id: `website-url-${index + 1}`,
      websiteId: website.id,
      ...urlConfig,
    })
  );

  const kvData: Record<string, any> = {
    [`website:${website.id}`]: website,
  };

  const kvRawData: Record<string, string> = {
    [`index:website:accountId:${website.accountId}`]: website.id,
  };

  for (const websiteUrl of websiteUrls) {
    kvData[`websiteUrl:${websiteUrl.id}`] = websiteUrl;
    kvRawData[`index:websiteUrl:domainPath:${websiteUrl.domain}:${websiteUrl.path}`] = websiteUrl.id;
  }

  await seedKV(kvData);
  await seedKVRaw(kvRawData);

  if (configs.r2Files) {
    await seedR2(configs.r2Files);
  }

  return { website, websiteUrls };
}
