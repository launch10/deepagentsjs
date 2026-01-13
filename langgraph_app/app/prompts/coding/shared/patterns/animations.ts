/**
 * Animation and micro-interaction guidance for polished landing pages.
 * CSS-only animations that add life without complexity.
 */
import type { CodingPromptState, CodingPromptFn } from "../types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export const animationsPrompt: CodingPromptFn = async (
  _state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => `
## Animations: Add Polish and Life

Subtle animations make a page feel premium. Use CSS-only animations for performance.

### Hover States: Every Interactive Element

**Buttons:**
\`\`\`tsx
// Scale + shadow on hover
<button className="bg-primary text-primary-foreground px-6 py-3 rounded-lg
  transition-all duration-200 hover:scale-105 hover:shadow-lg">
  Get Started
</button>

// Background shift
<button className="bg-secondary hover:bg-secondary/80 transition-colors duration-200">
  Learn More
</button>
\`\`\`

**Cards:**
\`\`\`tsx
// Lift on hover
<div className="bg-card rounded-2xl p-6 transition-all duration-300
  hover:shadow-xl hover:-translate-y-1">
  {/* Card content */}
</div>

// Border reveal
<div className="bg-card rounded-2xl p-6 border-2 border-transparent
  hover:border-primary/20 transition-colors duration-200">
  {/* Card content */}
</div>
\`\`\`

**Links:**
\`\`\`tsx
// Underline animation
<a className="relative text-primary hover:text-primary/80 transition-colors
  after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 after:bg-primary
  after:transition-all after:duration-300 hover:after:w-full">
  Read more
</a>
\`\`\`

### Entrance Animations: First Impressions

**Fade in from below (hero elements):**
\`\`\`tsx
// In your CSS/index.css:
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fadeInUp 0.6s ease-out forwards;
}

// Stagger delays for multiple elements
<h1 className="animate-fade-in-up">Headline</h1>
<p className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>Subhead</p>
<button className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>CTA</button>
\`\`\`

**Scale in (for feature cards):**
\`\`\`tsx
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-scale-in {
  animation: scaleIn 0.4s ease-out forwards;
}
\`\`\`

### Floating Elements: Atmospheric Depth

**Subtle float animation for decorative elements:**
\`\`\`tsx
@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

// Background orb with slow float
<div className="absolute top-20 right-10 w-64 h-64 bg-primary/10 rounded-full blur-3xl"
  style={{ animation: 'float 6s ease-in-out infinite' }} />
\`\`\`

**Pulse for attention:**
\`\`\`tsx
// Badge or notification dot
<span className="absolute -top-1 -right-1 w-3 h-3 bg-secondary rounded-full animate-pulse" />
\`\`\`

### Scroll-Triggered Effects (Optional)

Use intersection observer for scroll-triggered animations:
\`\`\`tsx
// Simple reveal on scroll
const [isVisible, setIsVisible] = useState(false);
const ref = useRef<HTMLDivElement>(null);

useEffect(() => {
  const observer = new IntersectionObserver(
    ([entry]) => setIsVisible(entry.isIntersecting),
    { threshold: 0.1 }
  );
  if (ref.current) observer.observe(ref.current);
  return () => observer.disconnect();
}, []);

<div ref={ref} className={\`transition-all duration-700 \${
  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
}\`}>
  {/* Content fades in when scrolled into view */}
</div>
\`\`\`

### Animation Best Practices

**DO:**
- Use \`transition-all duration-200\` for micro-interactions
- Keep durations short: 200-400ms for interactions, 400-800ms for entrances
- Use \`ease-out\` for entrances, \`ease-in-out\` for loops
- Add subtle \`hover:scale-105\` to buttons
- Stagger entrance animations with \`animation-delay\`

**DON'T:**
- Animate everything - pick 3-5 key elements
- Use animations longer than 1s for interactions
- Make things bounce or shake unless intentional
- Distract from content with constant motion
- Forget to add \`transition-*\` classes for hover states

### Quick Animation Classes to Use

| Effect | Classes |
|--------|---------|
| Smooth transitions | \`transition-all duration-200\` |
| Hover lift | \`hover:-translate-y-1 hover:shadow-lg\` |
| Hover scale | \`hover:scale-105\` |
| Hover opacity | \`hover:opacity-80\` |
| Pulse | \`animate-pulse\` |
| Bounce | \`animate-bounce\` |
| Spin | \`animate-spin\` |
`;
