import { Template } from "@langgraph/models/template";
import { hexToCssHsl } from "@services/theme/service";

/**
 * Represents a theme object mapping CSS variable names to their HSL string values.
 * Example: { "--background": "hsl(43, 74%, 66%)", "--primary": "hsl(12, 76%, 61%)", ... }
 */
type ThemeObject = Record<string, string>;

export class IndexCssService {
    private themeObject: ThemeObject;
    private templateName: string;
    private filePathInTemplate: string;
    constructor(themeObject: ThemeObject, templateName: string = "default", filePathInTemplate: string = "src/index.css") {
        this.themeObject = themeObject;
        this.templateName = templateName;
        this.filePathInTemplate = filePathInTemplate;
    }

    async generate() {
        let templateCss: string;
        try {
            const template = await Template.getTemplate(this.templateName);
            const fileData = template.files[this.filePathInTemplate];
            if (!fileData || !fileData.content) {
                throw new Error(`File '${this.filePathInTemplate}' not found or empty in template '${this.templateName}'.`);
            }
            templateCss = fileData.content;
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

        let updatedRootContent = rootContent;
        let variablesFound = 0;
        let variablesNotFound = 0;
        this.themeObject["--foreground"] = this.themeObject["--background-foreground"];

        // Iterate through the theme object provided (theme.theme)
        // Keys are already CSS variable names like '--background'
        for (const [variableName, newValue] of Object.entries(this.themeObject)) {
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
        const finalCss = templateCss.replace(rootBlockRegex, updatedBlock);

        // Ensure the function returns the final string
        return finalCss;
    }
}