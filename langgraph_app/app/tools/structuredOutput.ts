import { z } from "zod";
import { StructuredTool } from "@langchain/core/tools";

/**
 * Generic structured output tool that can accept any Zod schema
 * Allows agents to submit structured data as their final output
 */
export class StructuredOutputTool<T extends z.ZodObject<any>> extends StructuredTool {
    name: string;
    description: string;
    schema: T;
    private _structuredResponse?: z.infer<T>;

    constructor(config: {
        name: string;
        description: string;
        schema: T;
    }) {
        super();
        this.name = config.name;
        this.description = config.description;
        this.schema = config.schema;
    }

    async _call(args: z.infer<T>): Promise<string> {
        this._structuredResponse = args;
        const fields = Object.keys(args).map(key => `${key}: ${JSON.stringify(args[key])}`).join(', ');
        return `Successfully submitted: { ${fields} }`;
    }
    
    /**
     * Get the submitted data (useful for extracting the final result)
     */
    get structuredResponse(): z.infer<T> | undefined {
        return this._structuredResponse;
    }
    
    /**
     * Reset the submitted data
     */
    reset(): void {
        this._structuredResponse = undefined;
    }
}

/**
 * Create a structured output tool for theme selection
 */
export function createThemeSelectionTool() {
    return new StructuredOutputTool({
        name: "submitThemeSelection",
        description: "Submit your final theme selection. Call this AFTER searching for themes and deciding which one to use.",
        schema: z.object({
            themeId: z.number().describe("The ID of the theme you have selected"),
            reason: z.string().optional().describe("Brief explanation of why you chose this theme")
        })
    });
}

/**
 * Create a generic structured output tool with any schema
 */
export function createStructuredOutputTool<T extends z.ZodObject<any>>(config: {
    name: string;
    description: string;
    schema: T;
}): StructuredOutputTool<T> {
    return new StructuredOutputTool(config);
}