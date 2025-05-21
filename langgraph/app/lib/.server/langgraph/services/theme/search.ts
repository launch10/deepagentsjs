import { db, type DB } from '@db';
import * as schema from '@db/schema';
import { eq, inArray, sql } from 'drizzle-orm';

export interface ThemeResult {
    id: number;
    name: string;
    colors: Record<string, string>;
    theme: Record<string, string>;
    labels: string[];
    createdAt: Date;
    updatedAt: Date;
}

export class ThemeSearchService {
    private db: DB;

    constructor(database: DB = db) {
        this.db = database;
    }

    /**
     * Fetches all unique theme label names from the database.
     * Used to inform the LLM about available search terms.
     * @returns A promise that resolves to an array of label names.
     */
    async getAllThemeLabels(): Promise<string[]> {
        try {
            console.log('Fetching all theme labels...');
            const labels = await this.db
                .selectDistinct({ name: schema.themeLabel.name })
                .from(schema.themeLabel)
                .orderBy(schema.themeLabel.name); // Order alphabetically

            console.log(`Found ${labels.length} distinct labels.`);
            return labels.map(label => label.name);
        } catch (error) {
            console.error('Error fetching theme labels:', error);
            throw new Error('Failed to fetch theme labels');
        }
    }

    /**
     * Searches for themes matching a list of labels.
     * Returns a random subset of matching themes with their full details.
     * @param searchLabels - An array of label names to search for.
     * @param limit - The maximum number of themes to return. Defaults to 5.
     * @returns A promise that resolves to an array of ThemeResult objects.
     */
    async searchThemesByLabels(searchLabels: string[], limit: number = 5): Promise<ThemeResult[]> {
        if (!searchLabels || searchLabels.length === 0) {
            console.log("No search labels provided, returning empty array.");
            return [];
        }
        console.log(`Searching for themes with labels: [${searchLabels.join(', ')}], limit: ${limit}`);

        try {
             // Step 1: Find IDs of labels matching the input searchLabels
             const matchingLabelIds = await this.db
                .select({ id: schema.themeLabel.id })
                .from(schema.themeLabel)
                .where(inArray(schema.themeLabel.name, searchLabels));

            if (matchingLabelIds.length === 0) {
                 console.log("No labels found matching the search query.");
                 return [];
            }
            const labelIdList = matchingLabelIds.map(l => l.id);
            console.log(`Found label IDs: [${labelIdList.join(', ')}]`);

            // Step 2: Find distinct theme IDs associated with those labels
            const themeIdsQuery = this.db
                .selectDistinct({ themeId: schema.themesToThemeLabels.themeId })
                .from(schema.themesToThemeLabels)
                .where(inArray(schema.themesToThemeLabels.labelId, labelIdList));

            // Step 3: Select a random subset of these theme IDs using a subquery
            // Note: RANDOM() is specific to PostgreSQL. Use appropriate function for other DBs.
            const randomThemeIds = await this.db
                .select({ id: schema.theme.id })
                .from(schema.theme)
                .where(inArray(schema.theme.id, themeIdsQuery)) // Filter themes associated with the labels
                .orderBy(sql`RANDOM()`) // Order randomly
                .limit(limit);             // Apply limit

            if (randomThemeIds.length === 0) {
                console.log("No themes found associated with the given labels.");
                return [];
            }
            const selectedThemeIdList = randomThemeIds.map(p => p.id);
            console.log(`Selected random theme IDs: [${selectedThemeIdList.join(', ')}]`);

            // Step 4: Fetch details for the selected themes and their associated labels
            const finalThemes = await this.db
                .select({
                    // Explicitly select needed theme columns
                    themeId: schema.theme.id,
                    themeName: schema.theme.name,
                    themeColors: schema.theme.colors, // Theme object
                    themeTheme: schema.theme.theme, // Theme object
                    themeCreatedAt: schema.theme.createdAt,
                    themeUpdatedAt: schema.theme.updatedAt,
                    // Select label details
                    label: schema.themeLabel,
                })
                .from(schema.theme)
                .leftJoin(schema.themesToThemeLabels, eq(schema.theme.id, schema.themesToThemeLabels.themeId))
                .leftJoin(schema.themeLabel, eq(schema.themesToThemeLabels.labelId, schema.themeLabel.id))
                .where(inArray(schema.theme.id, selectedThemeIdList))
                .orderBy(schema.theme.id); // Order for easier grouping

            // Step 5: Group results by theme ID
            const groupedResults: Record<number, ThemeResult> = {};
            for (const row of finalThemes) {
                const themeId = row.themeId; // Use selected alias
                if (!groupedResults[themeId]) {
                    groupedResults[themeId] = {
                        id: themeId,
                        name: row.themeName, // Use selected alias
                        // Drizzle returns jsonb as string/object - ensure it's parsed/typed correctly
                        colors: typeof row.themeColors === 'string' ? JSON.parse(row.themeColors) : row.themeColors, // Use selected alias
                        theme: typeof row.themeTheme === 'string' ? JSON.parse(row.themeTheme) : row.themeTheme, // Use selected alias
                        labels: [],
                        createdAt: row.themeCreatedAt, // Use selected alias
                        updatedAt: row.themeUpdatedAt, // Use selected alias
                    };
                }
                if (row.label) {
                    // Avoid adding duplicate labels if a theme matches multiple search terms
                    if (!groupedResults[themeId].labels.includes(row.label.name)) {
                         groupedResults[themeId].labels.push(row.label.name);
                    }
                }
            }

             const resultList = Object.values(groupedResults);
             console.log(`Returning ${resultList.length} themes.`);
             return resultList;

        } catch (error) {
            console.error('Error searching themes by labels:', error);
            throw new Error('Failed to search themes');
        }
    }
}
