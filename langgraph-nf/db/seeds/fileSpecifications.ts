import { type DB } from '@db';
import { fileSpecification as FileSpecTable } from '@db/schema';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileSpecRegistry } from '@shared/models/registry/fileSpecificationRegistry';
import { type FileSpecificationData } from '@shared/models/fileSpecification';

export async function seedFileSpecifications(db: DB) {
  console.log('--- Starting File Specification Seeding ---');

  const fileSpecificationsToSeed: FileSpecificationData[] = fileSpecRegistry.getAll();

  if (fileSpecificationsToSeed.length === 0) {
    console.log('No file specifications found in registry to seed.');
    return;
  }

  console.log(`Found ${fileSpecificationsToSeed.length} file specifications to seed.`);

  for (const item of fileSpecificationsToSeed) {
    try {
      const valuesToInsert = {
        canonicalPath: item.canonicalPath,
        description: item.description ?? `Default description for ${item.subtype}`,
        filetype: item.filetype, // Assumes FileTypeEnum provides numeric values compatible with DB 'integer' type
        subtype: item.subtype as string, // All subtype enums (PageTypeEnum, etc.) are strings
        language: item.language as string, // LanguageEnum values are strings
      };

      await db.insert(FileSpecTable)
        .values(valuesToInsert)
        .onConflictDoUpdate({
          target: FileSpecTable.subtype,
          set: {
            canonicalPath: valuesToInsert.canonicalPath,
            description: valuesToInsert.description,
            filetype: valuesToInsert.filetype,
            language: valuesToInsert.language,
            updatedAt: new Date(), // Update timestamp on conflict
          }
        });
      console.log(`Upserted file specification with subtype: ${item.subtype}`);
    } catch (error) {
      console.error(`Error seeding file specification with subtype ${item.subtype}:`, error);
    }
  }

  console.log('--- Finished File Specification Seeding ---');
}
