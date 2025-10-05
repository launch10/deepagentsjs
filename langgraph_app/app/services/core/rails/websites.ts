import { type FileType, type WebsiteType } from "@types";
import { RailsApiService, type FieldMapper } from './api';
interface WebsiteRequest extends WebsiteType {
    websiteFilesAttributes: FileType[];
}
export interface RailsWebsite {
    id?: number;
    name?: string;
    project_id?: number;
    account_id: number;
    thread_id: string;
    template_id: number;
    theme_id: number;
}
export class WebsitesApiService extends RailsApiService<WebsiteType, RailsWebsite> {
    protected getFieldMapper(): FieldMapper<WebsiteRequest, RailsWebsite> {
        return {
            id: 'id',
            name: 'name',
            accountId: 'account_id',
            projectId: 'project_id',
            templateId: 'template_id',
            themeId: 'theme_id',
            threadId: 'thread_id',
            websiteFilesAttributes: 'website_files_attributes',
        };
    }

    /**
     * Create a new website
     */
    async createWebsite(websiteData: { website: Partial<WebsiteRequest> }, jwt?: string) {
        // Use the base post method which handles mapping and wrapping
        return this.post('websites', websiteData.website, jwt);
    }

    /**
     * Get a website by ID
     */
    async getWebsite(id: number, jwt?: string) {
        return this.get(`websites/${id}`, jwt);
    }

    /**
     * Update a website
     */
    async updateWebsite(id: number, website: Partial<WebsiteRequest>, jwt?: string) {
        return this.put(`websites/${id}`, website, jwt);
    }

    /**
     * Delete a website
     */
    async deleteWebsite(id: number, jwt?: string) {
        return this.delete(`websites/${id}`, jwt);
    }

    /**
     * List all websites
     */
    async listWebsites(jwt?: string) {
        return this.get('websites', jwt);
    }
}

// Export singleton instance
export const websitesApi = new WebsitesApiService();