import { TenantInfo } from '../types';

export function getTenantInfo(url: string | URL): TenantInfo {
    const hostname = new URL(url).hostname;
    const siteName = hostname.replace(/^preview\./, '');

    return {
        userId: 'user_123',
        orgId: 'org_abc',
        siteName: siteName
    };
}