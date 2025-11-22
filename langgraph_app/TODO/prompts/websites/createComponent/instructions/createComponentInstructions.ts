import { type CodeTaskType, type FileSpecType } from "@types";
import { FileSpecificationModel, ComponentModel, ComponentOverviewModel } from "@models";
import {
    linkingInstructionsPrompt,
    renderPrompt
} from "@prompts";

interface CreateComponentInstructionsProps {
    task: CodeTaskType;
    fileSpec: FileSpecType;
    additionalInstructions?: string[];
}

export const createComponentInstructionsPrompt = async ({ task, fileSpec, additionalInstructions }: CreateComponentInstructionsProps): Promise<string> => {
    if (!additionalInstructions) {
        additionalInstructions = [];
    }

    if (!fileSpec) {
        throw new Error('fileSpec is required');
    }
    
    // Validate fileSpec has required fields
    if (!fileSpec.id && !fileSpec.componentType) {
        throw new Error('Invalid file spec');
    }
    
    // By this point, we'll have generated the component overview, which should
    // consider uniquely naming the component.
    const overview = await ComponentOverviewModel.find(task.componentOverviewId);
    
    // Ensure the component name is TitleCased
    let expectedComponentName = overview?.name || new FileSpecificationModel(fileSpec).expectedComponentName;

    if (expectedComponentName) {
        // Remove spaces and ensure TitleCase
        expectedComponentName = expectedComponentName.replace(/\s+/g, '');
    }
    const linkingInstructions = await linkingInstructionsPrompt();

    return await renderPrompt(`
        <instructions>
            1. **Analyze Input:** Carefully review the provided \`content-plan\` (in JSON format), \`theme\`, and \`design-guidelines\`
            2. **Frameworks:** Use React, TypeScript, Shadcn UI, and Tailwind CSS ONLY.
            3. **Content Integration:** Implement the content exactly as specified in the \`content-plan\`. These may provide you with headlines, subheadlines, paragraphs, calls to action, etc. Please use this content EXACTLY as specified.
            4.  **Styling & Color Utility Usage (CRITICAL INSTRUCTIONS):**
                *   Implement \`visualStyleNotes\` from the plan using Tailwind CSS classes ONLY.
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
            5. **Layout:** Implement the \`layout-description\` and respect the \`visual-emphasis\`.
            6. **Responsiveness:** Implement \`responsiveness-notes\`. Ensure the component looks good and functions correctly on various screen sizes.
            7. **Shadcn UI:** Utilize Shadcn UI components. They are pre-installed. Some components may have been suggested in the \`suggested-components\` list.
            8. **Imports:** Include all necessary imports for React, Shadcn components, Lucide icons (if used), etc.
            9. **Import Statements:** 
                * Import pages from @/pages/IndexPage.tsx, etc.
                * Import core app components from @/components/Nav.tsx, etc.
                * Import base UI components from @/components/ui/accordion.tsx, @/components/ui/button.tsx, etc.
                * Import hooks from: @/hooks/use-toast.ts, etc.
            10. **Import Correctness:** Ensure all imports are correct.
            11. **Dependencies:** List any *new* npm package dependencies required beyond the standard stack (React, Next.js, Tailwind, Shadcn UI, Lucide-react). Usually, this should be empty.
            12. **Code Quality:** Generate clean, readable, well-formatted, and strongly-typed code. Include comments only where necessary for complex logic.
            13. **Strict Adherence:** Follow the plan precisely. Do NOT add features, content, or styling not specified in the plan or guidelines. Do NOT invent image URLs or icons. Use only provided Lucide icons or Unsplash URLs.
            14. ${linkingInstructions}
            15. **Output Format:** Your final output MUST strictly adhere to the required JSON schema structure. Ensure the 'code' field contains ONLY the valid TSX code as a single string.
            ${
                expectedComponentName && (
                        `16. **Component Name:** Create a component named: ${expectedComponentName}. Give the component an ID of ${expectedComponentName}, so that it can be used as an anchor for links.
                        17. **Use Named Export:** Export the component as ${expectedComponentName}. DO NOT USE default export.
                    `
                )
            }
            ${additionalInstructions?.join('\n')}
        </instructions>
    `);
}