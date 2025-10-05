import type { GraphState } from '@shared/state/graph';

// TODO: MOVE TO PROMPTS!!!
export const tailwindConfigPrompt = (state: GraphState) => {
  return `
Your task is to create a tailwind.config.ts file that correctly integrates with an index.css file defining theme variables according to Shadcn UI conventions. The CSS file defines variables like --background, --foreground, --primary, --primary-foreground, etc., using HSL values.

Core Task: Generate a complete tailwind.config.ts file that maps Tailwind utility classes to these CSS variables.

Specific Instructions:

1.  **Configuration Structure:** Use the standard Tailwind config structure (export default { ... } satisfies Config;). Include darkMode: ["class"].
2.  **Content Paths:** Include standard content paths for a Vite/React project:
    typescript
    content: [
      './pages/**/*.{ts,tsx}',
      './components/**/*.{ts,tsx}',
      './app/**/*.{ts,tsx}',
      './src/**/*.{ts,tsx}',
      './index.html', // If using Vite root index.html
    ],
    
3.  **Theme Mapping (Crucial):** In theme.extend.colors, map Tailwind's semantic color names to the CSS variables defined in index.css. Use the hsl(var(--variable-name)) syntax EXCLUSIVELY for color values.
    *   Map single variables: background: 'hsl(var(--background))', foreground: 'hsl(var(--foreground))', border: 'hsl(var(--border))', input: 'hsl(var(--input))', ring: 'hsl(var(--ring))'.
    *   Map paired variables using the nested structure:
        typescript
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        success: { DEFAULT: 'hsl(var(--success))', foreground: 'hsl(var(--success-foreground))' }, // Assuming pairs were created in CSS
        warning: { DEFAULT: 'hsl(var(--warning))', foreground: 'hsl(var(--warning-foreground))' }, // Assuming pairs were created in CSS
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        // Include neutral mappings if they exist as pairs in CSS, otherwise map directly if they are single vars
        neutral1: { DEFAULT: 'hsl(var(--neutral1))', foreground: 'hsl(var(--neutral1-foreground))'}, // Example if pairs exist
        neutral2: { DEFAULT: 'hsl(var(--neutral2))', foreground: 'hsl(var(--neutral2-foreground))'}, // Example if pairs exist
        neutral3: { DEFAULT: 'hsl(var(--neutral3))', foreground: 'hsl(var(--neutral3-foreground))'}, // Example if pairs exist
        // If neutrals are single variables in CSS:
        // neutral1: 'hsl(var(--neutral1))',
        // neutral2: 'hsl(var(--neutral2))',
        // neutral3: 'hsl(var(--neutral3))',
        
    *   Ensure ALL color variables intended for Tailwind use from index.css are mapped.
4.  **Border Radius Mapping:** Map borderRadius using the --radius variable:
    typescript
    borderRadius: {
      lg: "var(--radius)",
      md: "calc(var(--radius) - 2px)",
      sm: "calc(var(--radius) - 4px)",
    },
    
5.  **Animations & Keyframes:** Include standard Shadcn/Tailwind animations. You can add the common ones:
    typescript
    keyframes: {
      "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
      "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
      // Add other common keyframes like fade-in, slide-in-up, etc. if desired
    },
    animation: {
      "accordion-down": "accordion-down 0.2s ease-out",
      "accordion-up": "accordion-up 0.2s ease-out",
      // Add other common animations
    },
    
6.  **Plugins:** Include require("tailwindcss-animate").
    typescript
    plugins: [require("tailwindcss-animate")],
    
7.  **Container:** Include the standard container setup:
    typescript
     container: {
       center: true,
       padding: "2rem",
       screens: { "2xl": "1400px" },
     },
    

Output ONLY the TypeScript code for the tailwind.config.ts file.
`;
}