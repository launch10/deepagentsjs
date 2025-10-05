import { db, type DB, themes, themeLabels, themesToThemeLabels } from 'app/db';
import { eq, inArray, sql } from 'drizzle-orm';
import { type ThemeType } from "@types";
interface DBThemeType extends ThemeType {
    id: BigInt;
}
export class SearchThemesService {
    private db: DB;

    constructor(database: DB = db) {
        this.db = database;
    }

    private toTheme(dbTheme: DBThemeType | DBThemeType[]): ThemeType | ThemeType[] {
        if (Array.isArray(dbTheme)) {
            return dbTheme.map(this.toTheme) as ThemeType[];
        } else {
            return {
                ...dbTheme,
                id: parseInt(String(dbTheme.id))
            } as ThemeType;
        }
    }

    /**
     * Fetches all unique theme label names from the database.
     * Used to inform the LLM about available search terms.
     * @returns A promise that resolves to an array of label names.
     */
    async getAllThemeLabels(): Promise<string[]> {
        try {
            // console.log('Fetching all theme labels...');
            const labels = await this.db
                .selectDistinct({ name: themeLabels.name })
                .from(themeLabels)
                .orderBy(themeLabels.name); // Order alphabetically

            // console.log(`Found ${labels.length} distinct labels.`);
            return labels.map(label => label.name);
        } catch (error) {
            console.error('Error fetching theme labels:', error);
            throw new Error('Failed to fetch theme labels');
        }
    }

    async findThemeById(themeId: number): Promise<ThemeType | null> { 
        try {
            const theme = await this.db
                .select()
                .from(themes)
                .where(eq(themes.id, BigInt(themeId)))
                .limit(1);
            if (!theme[0]) {
                return null;
            }
            return this.toTheme(theme)[0]
        } catch (error) {
            console.error('Error fetching theme by ID:', error);
            throw new Error('Failed to fetch theme by ID');
        }
    }

    /**
     * Searches for themes matching a list of labels.
     * Returns a random subset of matching themes with their full details.
     * @param searchLabels - An array of label names to search for.
     * @param limit - The maximum number of themes to return. Defaults to 5.
     * @returns A promise that resolves to an array of ThemeType objects.
     */
    async searchThemesByLabels(searchLabels: string[], limit: number = 5): Promise<ThemeType[]> {
        if (!searchLabels || searchLabels.length === 0) {
            // console.log("No search labels provided, returning empty array.");
            return [];
        }
        // console.log(`Searching for themes with labels: [${searchLabels.join(', ')}], limit: ${limit}`);

        try {
             // Step 1: Find IDs of labels matching the input searchLabels
             const matchingLabelIds = await this.db
                .select({ id: themeLabels.id })
                .from(themeLabels)
                .where(inArray(themeLabels.name, searchLabels));

            if (matchingLabelIds.length === 0) {
                //  console.log("No labels found matching the search query.");
                 return [];
            }
            const labelIdList = matchingLabelIds.map(l => l.id);
            // console.log(`Found label IDs: [${labelIdList.join(', ')}]`);

            // Step 2: Find distinct theme IDs associated with those labels
            const themeIdsQuery = this.db
                .selectDistinct({ themeId: themesToThemeLabels.themeId })
                .from(themesToThemeLabels)
                .where(inArray(themesToThemeLabels.themeLabelId, labelIdList));

            // Step 3: Select a random subset of these theme IDs using a subquery
            // In order to avoid constantly reusing the same themes.
            // In test environments, use deterministic ordering by ID instead of random, to
            // ensure snapshots are replayed.
            const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
            const randomThemeIds = await this.db
                .select({ id: themes.id })
                .from(themes)
                .where(inArray(themes.id, themeIdsQuery)) // Filter themes associated with the labels
                .orderBy(themes.id) // Order by ID in tests, randomly in production
                .limit(limit);             // Apply limit

            if (randomThemeIds.length === 0) {
                // console.log("No themes found associated with the given labels.");
                return [];
            }
            const selectedThemeIdList = randomThemeIds.map(p => p.id);
            // console.log(`Selected random theme IDs: [${selectedThemeIdList.join(', ')}]`);

            // Step 4: Fetch details for the selected themes and their associated labels
            const finalThemes = await this.db
                .select({
                    // Explicitly select needed theme columns
                    themeId: themes.id,
                    themeName: themes.name,
                    themeColors: themes.colors, // Theme object
                    themeTheme: themes.theme, // Theme object
                    themeCreatedAt: themes.createdAt,
                    themeUpdatedAt: themes.updatedAt,
                    // Select label details
                    label: themeLabels,
                })
                .from(themes)
                .leftJoin(themesToThemeLabels, eq(themes.id, themesToThemeLabels.themeId))
                .leftJoin(themeLabels, eq(themesToThemeLabels.themeLabelId, themeLabels.id))
                .where(inArray(themes.id, selectedThemeIdList))
                .orderBy(themes.id); // Order for easier grouping

            // Step 5: Group results by theme ID
            const groupedResults: Record<number, ThemeType> = {};
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
            //  console.log(`Returning ${resultList.length} themes.`);
             return resultList;

        } catch (error) {
            // console.error('Error searching themes by labels:', error);
            throw new Error('Failed to search themes');
        }
    }
}