/**
 * Image and placeholder strategy for landing pages.
 * Guides the agent on handling images, icons, and visual placeholders.
 */
import type { CodingPromptState, CodingPromptFn } from "../types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getThemeMode } from "../themeUtils";

export const imageStrategyPrompt: CodingPromptFn = async (
  state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => {
  const themeMode = getThemeMode(state);

  return `
## Image & Placeholder Strategy

### Placeholder Images

When specific images aren't provided, use professional placeholder services:

**For Product Screenshots / UI Mockups:**
\`\`\`tsx
{/* Abstract gradient placeholder - works for any product */}
<div className="aspect-video bg-gradient-to-br from-primary/20 via-secondary/10 to-accent/20 rounded-2xl flex items-center justify-center">
  <span className="text-muted-foreground">Product Preview</span>
</div>

{/* Or use a subtle pattern */}
<div className="aspect-video bg-muted rounded-2xl relative overflow-hidden">
  <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_0)]"
       style={{ backgroundSize: '24px 24px' }} />
</div>
\`\`\`

**For Avatars / Profile Images:**
\`\`\`tsx
{/* Initials avatar */}
<div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
  <span className="text-primary-foreground font-semibold">JD</span>
</div>

{/* Placeholder icon avatar */}
<div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
  <User className="w-6 h-6 text-muted-foreground" />
</div>
\`\`\`

**For Company Logos:**
\`\`\`tsx
{/* Text-based logo placeholder */}
<div className="text-xl font-bold text-muted-foreground opacity-50">
  {companyName}
</div>

{/* Or grayscale placeholder */}
<div className="w-32 h-8 bg-muted-foreground/20 rounded" />
\`\`\`

### Hero Images

Heroes often need visual interest even without product images:

**Pattern 1: Gradient Background (No Image Needed)**
\`\`\`tsx
<section className="min-h-[80vh] bg-primary relative overflow-hidden">
  {/* Abstract shapes instead of images */}
  <div className="absolute top-20 right-10 w-64 h-64 bg-secondary/20 rounded-full blur-3xl" />
  <div className="absolute bottom-20 left-10 w-48 h-48 bg-accent/15 rounded-full blur-2xl" />

  {/* Content */}
  <div className="relative z-10 container mx-auto px-6 py-24">
    <h1>...</h1>
  </div>
</section>
\`\`\`

**Pattern 2: Decorative Illustration Area**
\`\`\`tsx
<section className="py-24 bg-background">
  <div className="container mx-auto px-6 flex flex-col md:flex-row items-center gap-12">
    <div className="md:w-1/2">
      <h1>...</h1>
    </div>
    <div className="md:w-1/2">
      {/* Decorative placeholder for illustration */}
      <div className="aspect-square bg-gradient-to-br from-primary/10 via-secondary/5 to-transparent rounded-3xl relative">
        <div className="absolute inset-4 border-2 border-dashed border-primary/20 rounded-2xl flex items-center justify-center">
          <span className="text-muted-foreground">Illustration</span>
        </div>
      </div>
    </div>
  </div>
</section>
\`\`\`

### Icons

**Always use Lucide icons** (already available in the project):

\`\`\`tsx
import { Zap, Shield, BarChart, Globe, Users, Mail, Check } from "lucide-react";

{/* In a feature card */}
<div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
  <Zap className="w-6 h-6 text-primary" />
</div>

{/* As inline icon */}
<button className="flex items-center gap-2">
  <Mail className="w-4 h-4" />
  Contact Us
</button>
\`\`\`

**Icon Sizing Guidelines:**
| Context | Icon Size | Container Size |
|---------|-----------|----------------|
| Feature card | w-6 h-6 | w-12 h-12 bg container |
| Button inline | w-4 h-4 | No container |
| Hero feature | w-8 h-8 | w-16 h-16 bg container |
| Navigation | w-5 h-5 | No container |

### Aspect Ratios

Use consistent aspect ratios for visual harmony:

| Content Type | Aspect Ratio | Tailwind Class |
|--------------|--------------|----------------|
| Hero image | 16:9 | aspect-video |
| Product screenshot | 16:9 or 4:3 | aspect-video or aspect-[4/3] |
| Avatar | 1:1 | aspect-square (or w-X h-X) |
| Logo | varies | specific w-X h-X |
| Feature image | 4:3 | aspect-[4/3] |

${themeMode === "dark" ? `
### Dark Theme Image Tips

- Use images with transparent backgrounds where possible
- Add subtle glow effects behind images: \`shadow-lg shadow-primary/20\`
- Consider overlaying a gradient: \`bg-gradient-to-t from-background via-transparent\`
- Screenshots look great with subtle borders: \`border border-border\`
` : ""}

${themeMode === "light" ? `
### Light Theme Image Tips

- Add shadows for depth: \`shadow-lg\`
- Use rounded corners generously: \`rounded-2xl\`
- Consider subtle borders: \`border border-border\`
- Screenshots benefit from being inside "device" frames
` : ""}

### What to Avoid

- ❌ Empty \`<img>\` tags without src (causes broken image icons)
- ❌ Using unsplash/pexels URLs (may not load, use styled placeholders instead)
- ❌ Random placeholder.com images (look unprofessional)
- ❌ Mismatched aspect ratios in grids
- ❌ Icons that are too small (< w-4) or too large (> w-10) for context
`;
};
