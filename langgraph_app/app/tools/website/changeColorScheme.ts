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
import { StructuredTool } from "@langchain/core/tools";
import { ThemeAPIService, WebsiteAPIService } from "@rails_api";
import { db, codeFiles, eq, and } from "@db";
import { getLogger } from "@core";

const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Must be a 6-digit hex color with # prefix (e.g. #FF5733)");

export class ChangeColorSchemeTool extends StructuredTool {
  name = "change_color_scheme";
  description = `Create a new color scheme and apply it to the website. Call this when the user wants to change the overall color palette, theme, or color scheme.

You choose 5 hex colors that form a cohesive palette:
- Color 1: Primary brand color (used for hero sections, CTAs, buttons)
- Color 2: Secondary accent color (used for highlights, badges)
- Color 3: Tertiary color (subtle accents, borders)
- Color 4: A warm or cool neutral (backgrounds, cards)
- Color 5: A contrasting color (for visual pop)

The system automatically computes all CSS variables, contrast ratios, backgrounds, and foregrounds from these 5 colors. You do NOT need to edit index.css or any component files — this tool handles everything.

IMPORTANT: Do NOT manually edit src/index.css for color changes. Always use this tool instead.`;

  schema = z.object({
    colors: z
      .array(hexColorSchema)
      .length(5, "Exactly 5 hex colors required")
      .describe("Array of exactly 5 hex colors (e.g. ['#2D5A27', '#F4A261', '#264653', '#E9C46A', '#E76F51'])"),
    name: z
      .string()
      .optional()
      .describe("Optional name for the color scheme (e.g. 'Ocean Breeze', 'Warm Sunset'). Generated if not provided."),
  });

  private websiteId: number;
  private jwt: string;

  constructor({ websiteId, jwt }: { websiteId: number; jwt: string }) {
    super();
    this.websiteId = websiteId;
    this.jwt = jwt;
  }

  async _call(args: z.infer<typeof this.schema>): Promise<string> {
    const { colors, name } = args;
    const logger = getLogger();

    try {
      // 1. Create the custom theme via Rails API
      //    Rails before_save computes semantic variables, WCAG pairings, typography
      const themeAPI = new ThemeAPIService({ jwt: this.jwt });
      const theme = await themeAPI.create({
        theme: {
          name: name || "Custom Color Scheme",
          colors,
        },
      });

      logger.info({ themeId: theme.id, colors }, "Created custom theme");

      // 2. Set the theme on the website
      //    Rails after_save ThemeCssInjection replaces :root block in index.css
      const websiteAPI = new WebsiteAPIService({ jwt: this.jwt });
      await websiteAPI.update(this.websiteId, { theme_id: theme.id });

      logger.info(
        { websiteId: this.websiteId, themeId: theme.id },
        "Applied theme to website"
      );

      // 3. Fetch the updated index.css to confirm
      const [indexCssFile] = await db
        .select()
        .from(codeFiles)
        .where(
          and(
            eq(codeFiles.websiteId, this.websiteId),
            eq(codeFiles.path, "src/index.css")
          )
        )
        .limit(1);

      if (!indexCssFile) {
        return `Color scheme "${name || "Custom Color Scheme"}" created and applied (theme #${theme.id}). The CSS variables will update on the next page load.`;
      }

      return `Color scheme "${name || "Custom Color Scheme"}" created and applied successfully (theme #${theme.id}). The CSS variables in index.css have been updated with the new palette. No further file edits are needed for this color change.`;
    } catch (error: any) {
      logger.error({ err: error }, "Failed to change color scheme");
      return `Error changing color scheme: ${error.message}. You can try manually editing src/index.css as a fallback.`;
    }
  }
}
