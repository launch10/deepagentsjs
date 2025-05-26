import { type DB } from "@db";
import { SearchIconsService } from '~/lib/.server/langgraph/services/searchIconsService';

export async function seed(db: DB) {
  try {
    console.log('Initializing icon embeddings service...');
    const iconService = new SearchIconsService(db);
    
    console.log('Generating embeddings for all icons...');
    await iconService.generateEmbeddings();
    
    console.log('Icon embeddings generated successfully!');
  } catch (error) {
    console.error('Error generating icon embeddings:', error);
    throw error;
  }
}