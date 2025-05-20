import { type DB } from '@db'; // Assuming DB type is exported from here
import * as schema from '@db/schema'; // Import all schemas
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

// Define the structure matching the JSON input
interface themeInputData {
  colors: string[]; // Raw colors, not used for seeding directly
  labels: string[];
  theme: Record<string, string>; // This object goes into the 'colors' JSONB column
  warnings?: any[];
}

export async function seedThemes(db: DB) {
  console.log('--- Starting Theme Seeding ---');

  try {
    // 1. Read and parse the JSON data
    console.log('Reading theme data...');
    const jsonPath = path.resolve(process.cwd(), '.data/themes/themes.output.json');
    const jsonData = fs.readFileSync(jsonPath, 'utf-8');
    const themeData: themeInputData[] = JSON.parse(jsonData);
    console.log(`Read ${themeData.length} theme entries from JSON.`);

    // 2. Extract and insert unique labels
    console.log('Extracting unique labels...');
    const uniqueLabels = [...new Set(themeData.flatMap(p => p.labels))];
    console.log(`Found ${uniqueLabels.length} unique labels.`);

    if (uniqueLabels.length > 0) {
        console.log('Inserting unique labels into themeLabel table...');
        const insertedLabels = await db
            .insert(schema.themeLabel)
            .values(uniqueLabels.map(name => ({ name })))
            .onConflictDoNothing() // Ignore duplicates
            .returning({ id: schema.themeLabel.id, name: schema.themeLabel.name });
        console.log(`Finished inserting/finding labels. Effective label count in DB after insert: ${insertedLabels.length} (may include existing).`);

        // 3. Create label name -> id map
        const labelMap = new Map(insertedLabels.map(label => [label.name, label.id]));

        // 4. Prepare and insert/update themes
        console.log('Preparing theme data for insertion...');
        const themesToInsert = themeData.map((item, index) => ({
            name: `theme ${index + 1}`, // Generate a unique name
            theme: item.theme, // Store the theme object in the 'theme' JSONB column
            colors: item.colors, // Store the original colors array in 'colors'
        }));

        console.log(`Inserting/updating ${themesToInsert.length} themes...`);
        const insertedthemes = await db
            .insert(schema.theme)
            .values(themesToInsert)
            .onConflictDoUpdate({
                target: schema.theme.name, // Use name column for conflict detection
                set: {
                    colors: sql`excluded.colors`,
                    theme: sql`excluded.theme`,
                    updatedAt: new Date(),
                }
            })
            .returning({ id: schema.theme.id, name: schema.theme.name });
        console.log(`Finished inserting/updating themes. Effective theme count: ${insertedthemes.length}.`);

        // 5. Create theme name -> id map
        const themeMap = new Map(insertedthemes.map(p => [p.name, p.id]));

        // 6. Prepare and insert links into the join table
        console.log('Preparing links for themes_to_theme_labels table...');
        const linksToInsert: { themeId: number; labelId: number }[] = [];
        themeData.forEach((item, index) => {
            const themeName = `theme ${index + 1}`;
            const themeId = themeMap.get(themeName);

            if (themeId === undefined) {
                console.warn(`Could not find ID for theme named "${themeName}". Skipping its labels.`);
                return;
            }

            item.labels.forEach(labelName => {
                const labelId = labelMap.get(labelName);
                if (labelId !== undefined) {
                    linksToInsert.push({ themeId, labelId });
                } else {
                     console.warn(`Could not find ID for label "${labelName}" for theme "${themeName}". Skipping this link.`);
                }
            });
        });

        console.log(`Inserting ${linksToInsert.length} links into join table...`);
        if (linksToInsert.length > 0) {
            await db
                .insert(schema.themesToThemeLabels)
                .values(linksToInsert)
                .onConflictDoNothing(); // Ignore if link already exists
            console.log('Finished inserting links.');
        } else {
            console.log('No links to insert.');
        }
    } else {
        console.log('No labels found in JSON data. Skipping label and link insertion.');
    }

    console.log('--- theme Seeding Completed Successfully ---');

  } catch (error) {
    console.error('Error during theme seeding:', error);
    throw error; // Re-throw error to indicate failure
  }
}
