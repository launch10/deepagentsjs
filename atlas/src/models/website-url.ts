import { Context } from "hono";
import { Env, WebsiteUrlType } from "~/types";
import { BaseModel, createTypeGuard } from "./base";

const isWebsiteUrlType = createTypeGuard<WebsiteUrlType>(
    (data: any): data is WebsiteUrlType => {
        return data.id !== undefined &&
            data.websiteId !== undefined &&
            data.domain !== undefined &&
            data.path !== undefined;
    }
);

export class WebsiteUrl extends BaseModel<WebsiteUrlType> {
    constructor(c: Context<{ Bindings: Env }>) {
        super(c, 'websiteUrl', isWebsiteUrlType);
    }

    protected defineIndexes(): void {
        this.addIndex({
            name: 'websiteId',
            keyExtractor: (websiteUrl) => websiteUrl.websiteId ? String(websiteUrl.websiteId) : null,
            type: 'unique'
        });

        this.addIndex({
            name: 'domainPath',
            keyExtractor: (websiteUrl) => {
                if (websiteUrl.domain && websiteUrl.path) {
                    return `${websiteUrl.domain}:${websiteUrl.path}`;
                }
                return null;
            },
            type: 'unique'
        });
    }

    async findByDomainAndPath(domain: string, path: string): Promise<WebsiteUrlType | null> {
        return this.findByIndex('domainPath', `${domain}:${path}`);
    }

    async findByWebsiteId(websiteId: string): Promise<WebsiteUrlType | null> {
        return this.findByIndex('websiteId', websiteId);
    }

    async findByDomainWithLongestPathMatch(domain: string, pathname: string): Promise<{ websiteUrl: WebsiteUrlType; matchedPath: string } | null> {
        const allUrls = await this.listAll();
        const domainUrls = allUrls.filter(url => url.domain === domain);
        
        if (domainUrls.length === 0) {
            return null;
        }

        // Sort by path length descending to find longest match first
        const sortedUrls = domainUrls.sort((a, b) => b.path.length - a.path.length);

        for (const websiteUrl of sortedUrls) {
            const urlPath = websiteUrl.path === '/' ? '' : websiteUrl.path;
            
            // Check if pathname starts with this path
            if (pathname === urlPath || pathname.startsWith(urlPath + '/') || (urlPath === '' && websiteUrl.path === '/')) {
                return { websiteUrl, matchedPath: websiteUrl.path };
            }
        }

        return null;
    }
}
