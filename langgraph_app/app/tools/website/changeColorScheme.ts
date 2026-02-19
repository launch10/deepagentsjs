/**
 * Tool that creates a real Theme record and applies it to the website.
 *
 * When the user asks to "switch up the color scheme" or "change the palette",
 * the agent calls this tool with 5 hex colors. The tool:
 * 1. Creates a custom Theme via Rails API (Rails computes semantic variables,
 *    WCAG contrast pairings, and typography recommendations)
 * 2. Sets the theme on the website (Rails ThemeCssInjection callback
 *    surgically replaces the :root block in index.css)
 * 3. Fetches the updated index.css from the database
 *
 * This produces a first-class Theme record that shows up in the user's
 * theme picker, can be reused across websites, and survives future theme swaps.
 */
import { z } from "zod";
import { tool } from "langchain";
import { getCurrentTaskInput } from "@langchain/langgraph";
import { ThemeAPIService, WebsiteAPIService } from "@rails_api";
import { db, codeFiles, eq, and } from "@db";
import { getLogger } from "@core";
import { intentCommand } from "../shared";
import { brandIntent } from "@types";

const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Must be a 6-digit hex color with # prefix (e.g. #FF5733)");

const changeColorSchemeSchema = z.object({
  colors: z
    .array(hexColorSchema)
    .length(5, "Exactly 5 hex colors required")
    .describe("Array of exactly 5 hex colors (e.g. ['#2D5A27', '#F4A261', '#264653', '#E9C46A', '#E76F51'])"),
  name: z
    .string()
    .optional()
    .describe("Optional name for the color scheme (e.g. 'Ocean Breeze', 'Warm Sunset'). Generated if not provided."),
});

export const changeColorSchemeTool = tool(
  async (args: z.infer<typeof changeColorSchemeSchema>, config) => {
    const state = getCurrentTaskInput<{ websiteId?: number; jwt?: string }>(config);
    const { websiteId, jwt } = state;
    const toolCallId = config?.toolCall.id;
    const { colors, name } = args;
    const logger = getLogger();

    if (!websiteId || !jwt) {
      return intentCommand({
        toolCallId,
        toolName: "change_color_scheme",
        content: { success: false, error: "Missing websiteId or authentication" },
      });
    }

    try {
      // 1. Create the custom theme via Rails API
      //    Rails before_save computes semantic variables, WCAG pairings, typography
      const themeAPI = new ThemeAPIService({ jwt });
      const theme = await themeAPI.create({
        theme: {
          name: name || "Custom Color Scheme",
          colors,
        },
      });

      logger.info({ themeId: theme.id, colors }, "Created custom theme");

      // 2. Set the theme on the website
      //    Rails after_save ThemeCssInjection replaces :root block in index.css
      const websiteAPI = new WebsiteAPIService({ jwt });
      await websiteAPI.update(websiteId, { theme_id: theme.id });

      logger.info({ websiteId, themeId: theme.id }, "Applied theme to website");

      // 3. Fetch the updated index.css to confirm
      const [indexCssFile] = await db
        .select()
        .from(codeFiles)
        .where(
          and(
            eq(codeFiles.websiteId, websiteId),
            eq(codeFiles.path, "src/index.css")
          )
        )
        .limit(1);

      const message = indexCssFile
        ? `Color scheme "${name || "Custom Color Scheme"}" created and applied successfully (theme #${theme.id}). The CSS variables in index.css have been updated with the new palette. No further file edits are needed for this color change.`
        : `Color scheme "${name || "Custom Color Scheme"}" created and applied (theme #${theme.id}). The CSS variables will update on the next page load.`;

      return intentCommand({
        toolCallId,
        toolName: "change_color_scheme",
        content: { success: true, message, themeId: theme.id },
        intents: [brandIntent("color_scheme_applied")],
      });
    } catch (error: any) {
      logger.error({ err: error }, "Failed to change color scheme");
      return intentCommand({
        toolCallId,
        toolName: "change_color_scheme",
        content: {
          success: false,
          error: `Error changing color scheme: ${error.message}. You can try manually editing src/index.css as a fallback.`,
        },
      });
    }
  },
  {
    name: "change_color_scheme",
    description: `Create a new color scheme and apply it to the website. Call this when the user wants to change the overall color palette, theme, or color scheme.

You choose 5 hex colors that form a cohesive palette:
- Color 1: Primary brand color (used for hero sections, CTAs, buttons)
- Color 2: Secondary accent color (used for highlights, badges)
- Color 3: Tertiary color (subtle accents, borders)
- Color 4: A warm or cool neutral (backgrounds, cards)
- Color 5: A contrasting color (for visual pop)

The system automatically computes all CSS variables, contrast ratios, backgrounds, and foregrounds from these 5 colors. You do NOT need to edit index.css or any component files — this tool handles everything.

IMPORTANT: Do NOT manually edit src/index.css for color changes. Always use this tool instead.`,
    schema: changeColorSchemeSchema,
  }
);
