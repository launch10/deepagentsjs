import { atom } from 'nanostores';
import type { TemplateAction } from '@runtime/types';
import type { FileMap } from '@shared/models/file';
import { createScopedLogger } from '@utils/logger';

const logger = createScopedLogger('TemplateStore');

// Store for template data
export const templateStore = atom<FileMap | null>(null);

// Flag to track if we've already attempted to fetch templates
let hasInitialized = false;

interface TemplateApiResponse {
  files: FileMap;
}

// Initialize the template store by fetching data from the API
export async function initializeTemplateStore() {
  // Only fetch once
  if (hasInitialized) return null;
  
  hasInitialized = true;
  
  try {
    const response = await fetch(`/api/template`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch template: ${response.status} ${response.statusText}`);
    }
    
    const templateData = await response.json() as TemplateApiResponse;
    const template: FileMap = templateData.files;

    templateStore.set(template);
    logger.info('Template data loaded successfully');
    
    return template;
  } catch (error) {
    logger.error('Failed to fetch template:', error);
    return null;
  }
}

// Get template data, initializing if needed
export async function getTemplateData(): Promise<TemplateData | null> {
  const currentTemplate = templateStore.get();
  
  if (currentTemplate) {
    return currentTemplate;
  }
  
  return await initializeTemplateStore();
}