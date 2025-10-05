import { TemplateFileModel } from "@models";
import { type ThemeType } from "@types";
import type { Theme } from "app/shared/types/website";

/**
 * Represents a theme object mapping CSS variable names to their HSL string values.
 * Example: { "--background": "hsl(43, 74%, 66%)", "--primary": "hsl(12, 76%, 61%)", ... }
 */
export class IndexCssService {
    async execute({ templateId, filePath, theme }: { templateId: number; filePath: string, theme: ThemeType }) {
        let templateCss: string;
        try {
            const templateFile = await TemplateFileModel.findBy({ templateId, path: filePath });
            if (!templateFile || !templateFile.content) {
                throw new Error(`File '${filePath}' not found or empty in template '${templateId}'.`);
            }
            templateCss = templateFile.content;
        } catch (error: any) {
            console.error(`Error fetching template CSS: ${error.message}`);
            throw new Error(`Failed to fetch template CSS: ${error.message}`);
        }

        const rootBlockRegex = /(@layer\s+base\s*{[^{}]*?)(:\s*root\s*{)([^}]*)}/; 
        const match = templateCss.match(rootBlockRegex);

        if (!match || match.length < 4) {
            console.error("Could not find the ':root' block within '@layer base' in the template CSS.");
            throw new Error("Could not find the :root block in the template CSS.");
        }

        const layerPrefix = match[1];
        const rootPrefix = match[2];
        let rootContent = match[3];
        let themeData = theme.theme as Theme.CssThemeType;

        let updatedRootContent = rootContent;
        let variablesFound = 0;
        let variablesNotFound = 0;
        themeData["--foreground"] = themeData["--background-foreground"];

        // Turn raw object into index.css file:
        for (const [variableName, newValue] of Object.entries(themeData)) {
            // Validate key format (should start with --)
            if (!variableName.startsWith('--')) {
                console.warn(`Skipping invalid variable name format in theme object: ${variableName}`);
                continue;
            }
            const formattedHsl = newValue.replace("hsl(", "").replace(")", "").replace(/,/g, " ").replace(/\s+/g, " ");

            // Regex to find the variable declaration *within* the root block content
            // It looks for "variableName: value;" and replaces the value part.
            // Handles different spacing. Uses capturing groups.
            const variableRegex = new RegExp(`(${variableName}\s*:\s*)([^;]+)(;?)`, 'g');
            let found = false;
            updatedRootContent = updatedRootContent.replace(variableRegex, (match, prefix, oldValue, suffix) => {
                found = true;
                // console.log(`Replacing ${variableName}: ${oldValue.trim()} with ${newValue}`); // Optional logging
                return `${prefix} ${formattedHsl}${suffix || ';'}`;
            });

            if (found) {
                variablesFound++;
            } else {
                variablesNotFound++;
                // This variable from the theme object wasn't found in the template's :root
                console.warn(`Variable ${variableName} from theme not found in the template's :root block.`);
            }
        }
        
        console.log(`CSS variable replacement completed. Found/Replaced: ${variablesFound}, Not Found in Template: ${variablesNotFound}`);

        const updatedBlock = `${layerPrefix}${rootPrefix}${updatedRootContent}}`;
        const indexCssFile: string = templateCss.replace(rootBlockRegex, updatedBlock);

        // Ensure the function returns the final string
        return indexCssFile;
    }
}