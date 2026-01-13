/**
 * Font loading and responsive design patterns.
 * Ensures distinctive typography and mobile-first design.
 */
import type { CodingPromptState, CodingPromptFn } from "../types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export const fontAndResponsivePrompt: CodingPromptFn = async (
  _state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => `
## Font Loading

**ALWAYS** load distinctive fonts from Google Fonts. Never rely on system fonts for headlines.

### Adding Google Fonts

In \`index.html\`, add the font link in the \`<head>\`:

\`\`\`html
<head>
  <!-- Preconnect for performance -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

  <!-- Load distinctive fonts -->
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
</head>
\`\`\`

### Recommended Font Pairings

| Style | Headline Font | Body Font |
|-------|---------------|-----------|
| Modern Tech | Space Grotesk | DM Sans |
| Editorial | Playfair Display | Source Sans 3 |
| Clean SaaS | Sora | Inter |
| Bold Startup | Plus Jakarta Sans | Plus Jakarta Sans |
| Elegant | DM Serif Display | DM Sans |
| Playful | Fraunces | IBM Plex Sans |
`;

// ### Applying Fonts in CSS

// In \`index.css\` or your Tailwind config:

// \`\`\`css
// /* index.css */
// :root {
//   --font-heading: 'Space Grotesk', sans-serif;
//   --font-body: 'DM Sans', sans-serif;
// }

// body {
//   font-family: var(--font-body);
// }

// h1, h2, h3, h4, h5, h6 {
//   font-family: var(--font-heading);
// }
// \`\`\`

// Or use Tailwind's font-family utilities after configuring:

// \`\`\`tsx
// <h1 className="font-heading text-5xl font-bold">Headline</h1>
// <p className="font-body text-lg">Body text</p>
// \`\`\`

// ## Responsive Design Patterns

// ### Mobile-First Breakpoints

// Always start with mobile styles, then add larger breakpoints:

// \`\`\`tsx
// // Mobile-first: stack → row
// <div className="flex flex-col md:flex-row gap-6">

// // Mobile-first: single column → multi-column
// <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

// // Mobile-first: smaller text → larger text
// <h1 className="text-3xl md:text-5xl lg:text-7xl font-bold">
// \`\`\`

// ### Responsive Typography Scale

// | Element | Mobile | Tablet (md) | Desktop (lg) |
// |---------|--------|-------------|--------------|
// | Hero H1 | text-3xl | text-5xl | text-7xl |
// | Section H2 | text-2xl | text-4xl | text-5xl |
// | Card H3 | text-lg | text-xl | text-2xl |
// | Body | text-base | text-base | text-lg |
// | Small | text-sm | text-sm | text-sm |

// ### Responsive Spacing

// | Section | Mobile | Tablet | Desktop |
// |---------|--------|--------|---------|
// | Section padding | py-12 | py-16 | py-24 |
// | Container padding | px-4 | px-6 | px-6 |
// | Card gap | gap-4 | gap-6 | gap-8 |

// ### Responsive Layout Patterns

// **Pattern 1: Reverse Order on Mobile**
// \`\`\`tsx
// <div className="flex flex-col-reverse md:flex-row items-center gap-8">
//   <div className="md:w-1/2">
//     {/* Content - appears second on mobile, first on desktop */}
//   </div>
//   <div className="md:w-1/2">
//     {/* Image - appears first on mobile, second on desktop */}
//   </div>
// </div>
// \`\`\`

// **Pattern 2: Hide/Show Elements**
// \`\`\`tsx
// {/* Hide on mobile, show on larger screens */}
// <div className="hidden md:block">Desktop only</div>

// {/* Show on mobile, hide on larger screens */}
// <div className="md:hidden">Mobile only</div>
// \`\`\`

// **Pattern 3: Responsive Hero**
// \`\`\`tsx
// <section className="min-h-[60vh] md:min-h-[80vh] py-12 md:py-0 flex items-center">
//   <div className="container mx-auto px-4 md:px-6">
//     <div className="max-w-full md:max-w-3xl lg:max-w-4xl">
//       <h1 className="text-3xl md:text-5xl lg:text-7xl font-bold">
//         Build <span className="text-secondary">faster</span>
//       </h1>
//       <p className="text-base md:text-xl text-muted-foreground mt-4 md:mt-6">
//         Description text here
//       </p>
//       <div className="flex flex-col sm:flex-row gap-3 md:gap-4 mt-6 md:mt-10">
//         <button className="px-6 md:px-8 py-3 md:py-4 rounded-full">
//           CTA
//         </button>
//       </div>
//     </div>
//   </div>
// </section>
// \`\`\`

// **Pattern 4: Responsive Cards Grid**
// \`\`\`tsx
// <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
//   {items.map((item) => (
//     <div className="p-4 md:p-6 lg:p-8 rounded-xl md:rounded-2xl">
//       {/* Card content */}
//     </div>
//   ))}
// </div>
// \`\`\`

// ### Mobile Touch Targets

// Ensure buttons are large enough for touch:
// - Minimum touch target: 44x44px
// - Use \`py-3 px-6\` minimum for buttons
// - Add adequate spacing between clickable elements

// \`\`\`tsx
// {/* Good - large touch target */}
// <button className="w-full sm:w-auto px-6 py-3 text-base">
//   Click Me
// </button>

// {/* Bad - too small */}
// <button className="px-2 py-1 text-xs">
//   Click
// </button>
// \`\`\`
// `;
