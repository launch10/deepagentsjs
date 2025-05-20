export const highLevelPrinciples = `
  The landing page is structured as follows:
    - A basic Vite/React/ShadCN/Tailwind/Typescript application
    - STYLES: Live in index.css and tailwind.config.ts
    - COMPONENTS: Live in src/components
    - PAGES: Live in src/pages

  Style Rules:
    - We use Tailwind for styling
    - We use semantic naming based on Role or Purpose in the UI. (e.g. background, foreground, primary, secondary, etc)
    - We align strictly with ShadCN conventions. 
    - Individual components reuse styles from tailwind.config.ts — they do NOT name new colors using tailwind classes
    - Tailwind.config.ts defines utility animations based on what they do (e.g. fade-in, slide-in-up, etc)

  Types of PAGES:
    - IndexPage: Live in src/pages/IndexPage.tsx (USUALLY, THIS IS THE ONLY PAGE)
    - AboutPage: Live in src/pages/AboutPage.tsx (optional page, only create if user asks for one)
    - ContactPage: Live in src/pages/ContactPage.tsx (optional page, only create if user asks for one)
    - PricingPage: Live in src/pages/PricingPage.tsx (optional page, only create if user asks for one)
    - EXCLUSIVE. We do not support other page types.

  PAGE SECTIONS:
    - Every page is split into SECTIONS (e.g. Hero, Testimonials, Pricing, etc)
    - Every section is an individual React component
    - Every section lives in src/components
    - Pages are ONLY used to combine sections

  TYPESCRIPT PRINCIPLES:
    - Always use named exports (not default exports) export { MyComponent };
    - Always use named imports — import { MyComponent } from './MyComponent';

  UI COMPONENTS:
    - We use ShadCN components
    - We try NOT to invent new components, unless absolutely necessary. These live in their individual sections, unless they need to be shared between sections.
`;

export const lowLevelPrinciples = `
  STRUCTURE & DEPENDENCIES:
    *   Use named exports: export { HeroSection };
    *   Use named imports for ShadCN components: import { Button } from '@/components/ui/button';
    *   Import necessary icons from lucide-react ONLY. Use only the <recommended-icons> provided to you.
    *   Use ONLY Shadcn UI components (Button, Card, Input, etc.) where appropriate. Do not invent custom low-level UI elements.

  STYLING RULES (CRITICAL):
    *   Use ONLY Tailwind CSS utility classes defined by the tailwind.config.ts which maps to variables in index.css.
    *   **NEVER use arbitrary values** (e.g., text-[#123456], bg-[blue]).
    *   **Semantic Color Pairing Enforcement:**
        *   Body/Default Text: Use text-foreground on bg-background (for muted text: text-foreground-muted)
        *   Primary Elements (e.g., CTA Buttons): Use bg-primary with text-primary-foreground (for muted text: text-primary-foreground-muted)
        *   Secondary Elements: Use bg-secondary with text-secondary-foreground (for muted text: text-secondary-foreground-muted)
        *   Muted Elements/Text: IMPORTANT: -muted IS NOT a text color. It is a BACKGROUND color. If you want MUTED text, USE the muted variant for the background color (e.g., bg-card has text-card-foreground-muted, bg-primary has text-primary-foreground-muted).
          *  If you are creating a muted element, you can use bg-muted, text-muted-foreground, and text-muted-foreground-muted (for muted text)
        *   Card Elements: Use bg-card with text-card-foreground (or text-foreground if appropriate).
        *   Accent Elements: Use bg-accent with text-accent-foreground, or use text-accent for icons/highlights on appropriate backgrounds (e.g., bg-background, bg-card).
        *   Destructive Actions: Use bg-destructive with text-destructive-foreground (for muted text: text-destructive-foreground-muted).
    *   Apply animations using the defined animation utilities (e.g., animate-fade-in, animate-slide-up).
    *   Use standard spacing utilities (p-4, m-2, gap-4, etc.).

  TYPESCRIPT PRINCIPLES:
    *   Use explicit types where necessary.
    *   Use functional components with hooks.
`;