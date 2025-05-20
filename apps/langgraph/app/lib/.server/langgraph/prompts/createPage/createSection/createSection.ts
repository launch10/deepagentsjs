import { type GraphState } from "@shared/state/graph";
import { writeCodePromptFactory } from "@prompts/factories/writeCodePromptFactory";
import { type FileMap } from "@models/file";
import { Template } from "@langgraph/models/template";
import stringify from "fast-json-stable-stringify";
import { themeContext } from "@prompts/helpers/context/theme";
import { type SectionTheme } from "@models/section";

const role = `You are a Code Generation Agent. Your task is to take a detailed plan for a React component and generate the corresponding TSX using Shadcn UI and Tailwind CSS.
The goal is to create beautiful, responsive, and production-ready code based *strictly* on the provided plan and design guidelines.`;
const task = `Generate the React/TSX code for the section detailed below.`;
const instructions = `
    1.  **Analyze Input:** Carefully review the provided <section-plan> (in JSON format), <brand-guidelines>, and <design-guidelines>.
    2.  **Frameworks:** Use React, TypeScript, Shadcn UI, and Tailwind CSS ONLY.
    3.  **Content Integration:** Implement the content exactly as specified in the <section-plan>. Use details from <contentDetails>, <ctaButtons>, <items>, etc.
    4.  **Styling & Color Utility Usage (CRITICAL INSTRUCTIONS):**
    *   Implement <visualStyleNotes> from the plan using Tailwind CSS classes ONLY.
    *   **MANDATORY: You MUST exclusively use the semantic color utility classes defined within the provided tailwind.config.ts under theme.extend.colors (e.g., primary, secondary, tertiary, background, foreground, border, card, popover, etc.) for ALL color applications (backgrounds, text, borders, icons, shadows, gradients, etc.).**
    *   **ABSOLUTELY DO NOT use hardcoded hex color values (e.g., text-[#264653], bg-[#F4F1DE]), RGB values, or generic Tailwind color names (e.g., text-gray-600, bg-blue-500) directly in className attributes or inline style attributes.** The ONLY exception is if a generic name like gray-600 is *explicitly defined* as a semantic utility key within the theme.extend.colors of the provided config.
    *   **Mapping Requirement:** If the design plan, description, or visual implies a specific color (like #2A9D8F), you MUST determine which semantic utility in the tailwind.config.ts (e.g., primary, secondary, accent) represents that color's *intended role* according to the brand guidelines and use the corresponding utility class (e.g., bg-primary, text-secondary-foreground, border-accent). Your primary goal is SEMANTIC correctness using the config, not pixel-perfect hex matching if it violates the utility rule.
    *   **Opacity:** Apply opacity modifiers directly to the semantic utility classes (e.g., bg-primary/80, text-secondary-foreground/70, bg-secondary/10). Do not use separate opacity classes like opacity-80 for colors defined via utilities.
    *   **Brand vs. General Utilities:**
        *   Use brand-specific utilities (primary, secondary, tertiary, etc.) for key brand elements, primary CTAs, accents, highlights, and elements meant to strongly feature the brand theme.
        *   Use general semantic utilities (background, foreground, border, input, ring, card, popover) for default page/section backgrounds, standard text, borders, input fields, and base component styling, unless overridden by specific brand requirements.
        *   SPECIFIC UTILITY CLASSES have been provided FOR YOUR SECTION (see below). Use them!
    *   **Example:**
        *   **WRONG:** className="bg-[#F4F1DE] text-[#264653]"
        *   **RIGHT (if for example, you were assigned bg-background and text-foreground):** className="bg-background text-foreground"
    *   **SVG Backgrounds:** Avoid embedding colors directly in SVG url() data URIs within style attributes or className if possible. If an SVG background pattern is required and must contain color, acknowledge this limitation but prioritize using utility classes for all other elements.
    5.  **Layout:** Implement the <layoutDescription> and respect the <layoutEmphasis>.
    6.  **Responsiveness:** Implement <responsivenessNotes>. Ensure the component looks good and functions correctly on various screen sizes.
    7.  **Shadcn UI:** Utilize Shadcn UI components. They are pre-installed. Some components may have been suggested in the <suggested-components> list.
    *   When using Shadcn UI components, verify their default styling uses the appropriate semantic utilities from your config (background, foreground, border, primary, card, etc.). **If a Shadcn component part (e.g., CardTitle, Button) needs a color different from its default (e.g., using secondary instead of the default primary for a button), apply the correct semantic utility class directly to override it (e.g., <Button className="bg-secondary hover:bg-secondary/90">).** Do NOT fall back to hex codes.
    9.  **Imports:** Include all necessary imports for React, Shadcn components, Lucide icons (if used), etc.
    10. **Icons**: Use Lucide icons for any iconography. ONLY use <recommended-icons> provided to you. DO NOT import any other icons, as it's very likely they are not installed.
    11. **Dependencies:** List any *new* npm package dependencies required beyond the standard stack (React, Next.js, Tailwind, Shadcn UI, Lucide-react). Usually, this should be empty.
    12. **Code Quality:** Generate clean, readable, well-formatted, and strongly-typed code. Include comments only where necessary for complex logic.
    13. **Strict Adherence:** Follow the plan precisely. Do NOT add features, content, or styling not specified in the plan or guidelines. Do NOT invent image URLs or icons. Use only provided Lucide icons or Unsplash URLs.
    14. **Output Format:** Your final output MUST strictly adhere to the required JSON schema structure. Ensure the 'code' field contains ONLY the valid TSX code as a single string.
`;
const important = `This is perhaps THE most important section of the landing page, so make it visually compelling and scannable! This will make or break the user's decision to convert.`;
const extraConstraints = `The name field must exactly match: {expectedComponentName}`;

export const createSectionPrompt = writeCodePromptFactory("createSectionPrompt", async (state: GraphState, defaults: Record<string, any>) => {
    const template = await Template.getTemplate('default');
    // const files: FileMap = await template.getPromptContext();
    const files: FileMap = {};

    const section = state.task.section;
    const contentPlan = section?.contentPlan as ContentPlan;
    const expectedComponentPath = section?.filePath;
    const expectedComponentName = contentPlan?.overview?.componentId;
    const componentInstruction = expectedComponentName ? `**Component Name:** Create a component named: ${expectedComponentName}. Give the component an ID of ${expectedComponentName}, so that it can be used as an anchor for links.` : '';
    const namedExportInstruction = expectedComponentName ? `**Use Named Export:** Export the component as ${expectedComponentName}. DO NOT USE default export.` : '';
    const suggestedComponents = contentPlan?.content?.suggestedComponents as string[] || [];
    const theme = await themeContext(state.task.section.theme as SectionTheme); // This actually just provides a list of semantic utilities for this particular section, it doesn't actually load the full theme

    // remove files... we don't need all that
    // add animation context (e.g. available animations)
    // add installed package context
    const additionalInstructions = {
        "component-instruction": componentInstruction,
        "named-export-instruction": namedExportInstruction,
        "theme": theme,
    }
    const context = {
        ...defaults.context,
        "suggested-components": suggestedComponents,
    }
    const overrides = {
        role,
        task,
        instructions,
        important,
        extraConstraints,
        files,
        additionalInstructions,
        context,
        contentPlan: stringify(contentPlan)
    }
    return {
        ...defaults,
        ...overrides,
    }
})
    