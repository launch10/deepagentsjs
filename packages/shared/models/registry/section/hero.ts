import { z } from 'zod';
import { baseSectionSchema } from './base';
import type { GraphState } from '../../../@shared/state/graph';

export const heroLayoutVariantSchema = z.enum([
  'text-left-image-right', 'image-left-text-right', 'centered-overlay', 'split-vertical'
]);

export const visualEmphasisSchema = z.enum(['image-focus', 'headline-focus', 'cta-focus']);

export const heroSchema = baseSectionSchema.extend({
    headline: z.string().describe("The main headline text."),
    subheadline: z.string().optional().describe("Supporting text below the headline."),
    paragraphs: z.string().optional().describe("Paragraphs of text to be included in the section."),
    cta_text: z.string().optional().describe("Text for the call-to-action button."),
    visualConcept: z.string().optional().describe("Description of the desired primary visual (image/video)."),
    layoutVariant: heroLayoutVariantSchema.describe("Suggests a basic layout structure"),
    visualEmphasis: visualEmphasisSchema.describe("Which element should draw the most attention?"),
    trustSignals: z.array(z.string()).optional().describe("List of trust signals (e.g., 'As seen on Forbes', '5-star rating')."),
});

export type Hero = z.infer<typeof heroSchema>;

export const heroPrompt = (state: GraphState) => {
    return `
    **SECTION TYPE: Hero**

    <section-goal>
    The goal of the Hero section is to immediately capture visitor attention, clearly communicate the core value proposition, and compel them to learn more (scroll down or click the CTA). It sets the first impression. The primary visual (image/video) is crucial for conveying context, benefit, or emotion quickly. It should ideally feature a single, clear, and compelling Call to Action (CTA). The headline should be bold, benefit-oriented, and concise, supported by a sub-headline that adds clarity or context.
    </section-goal>

    <key-components>
    1.  **Primary Headline:** Large, prominent text. Focuses on the main benefit or solution. (e.g., "Effortless Project Management for Busy Teams")
    2.  **Sub-headline:** Smaller text below the headline. Elaborates on the headline, clarifies the offering, or highlights a key feature/outcome. (e.g., "Stop juggling spreadsheets and emails. Our platform centralizes communication, tasks, and deadlines.")
    3.  **Primary Visual:** High-quality image, video, or animation. Should show the product in use, visualize the benefit, represent the target audience, or evoke the desired emotion. Must be relevant and captivating.
    4.  **Primary Call to Action (CTA):** Clearly defined button with action-oriented text. Should represent the primary conversion goal of the page. (e.g., "Get Started Free", "Request a Demo", "Download the Guide")
    5.  **(Optional) Trust Signals:** Subtle logos, short testimonial snippet, or key stat placed non-intrusively.
    </key-components>

    <content-considerations>
    *   Analyze the user-provided content for elements matching the key components.
    *   **Headline:** Is it concise, impactful, and benefit-driven? Does it speak directly to the target audience's need or desire?
    *   **Sub-headline:** Does it effectively support the headline? Does it add necessary detail without being too long?
    *   **Visual:** Is a specific visual mentioned or provided? If described, does the description align with the goal (context, benefit, emotion)? Is it high-quality?
    *   **CTA:** Is the text clear, action-oriented, and aligned with the main goal? Is the destination link specified or implied?
    *   **Value Proposition:** Is the core value clearly communicated within the first few seconds through the combination of headline, sub-headline, and visual?
    </content-considerations>

    <important>
      A hero section DOES NOT need to cover the entire viewport, or be the full height of the page. Most of the time, hero sections that are simply the height of the content are more effective.
    </important>
  `;
}

const example1 = `
<example name="TextLeftImageRightHero" description="Text Left, Image Right, Full Height">
<file path="@/components/sections/hero/TextLeftImageRightHero.tsx">
import React from 'react';
import { Button } from '@/components/ui/button';
import { AspectRatio } from "@/components/ui/aspect-ratio"; // Good for image consistency

export const TextLeftImageRightHero = () => {
  return (
    <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-background text-foreground">
      <div className="container px-4 md:px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
          <div className="flex flex-col justify-center space-y-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none text-primary">
                Revolutionize Your Workflow
              </h1>
              <p className="max-w-[600px] text-muted-foreground md:text-xl">
                Unlock peak productivity with our intuitive platform. Manage tasks, collaborate seamlessly, and hit your deadlines every time.
              </p>
            </div>
            <div className="flex flex-col gap-2 min-[400px]:flex-row">
              <Button size="lg">Get Started Free</Button>
              <Button variant="outline" size="lg">Request a Demo</Button>
            </div>
            <p className="text-xs text-muted-foreground pt-2">
              Trusted by teams at Stripe, Vercel, and more.
            </p>
          </div>
          <div className="w-full max-w-[600px] mx-auto">
             <AspectRatio ratio={16 / 9} className="bg-muted rounded-lg overflow-hidden">
               <img
                 src="https://source.unsplash.com/random/1600x900/?team-collaboration" // Placeholder
                 alt="Hero Visual"
                 className="object-cover w-full h-full"
               />
             </AspectRatio>
          </div>
        </div>
      </div>
    </section>
  );
};
</file>
</example>
`;

const example2 = `
<example name="ImageLeftTextRightHero" description="Text Right, Image Left, Centered Content, Moderate Height">
<file path="@/components/sections/hero/ImageLeftTextRightHero.tsx">
import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react'; // Example Icon Usage

export const ImageLeftTextRightHero = () => {
  return (
    <section className="w-full py-16 md:py-24 lg:py-32 bg-secondary text-secondary-foreground">
      <div className="container px-4 md:px-6">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16 items-center">
           <div className="w-full max-w-[550px] mx-auto">
             <img
               src="https://source.unsplash.com/random/800x600/?data-analytics" // Placeholder
               alt="Feature Visualization"
               width="550"
               height="310"
               className="mx-auto aspect-video overflow-hidden rounded-xl object-cover object-center sm:w-full"
             />
           </div>
           <div className="flex flex-col items-start space-y-4 text-left">
            <div className="inline-block rounded-lg bg-secondary-foreground/10 px-3 py-1 text-sm text-primary">
              New Feature
            </div>
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
              Gain Deeper Insights Instantly
            </h2>
            <p className="max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              Our enhanced analytics dashboard provides real-time data visualization to help you make smarter decisions, faster.
            </p>
            <Button size="lg">
              Explore Analytics <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
</file>
</example>
`;

const example3 = `
<example name="CenteredBgImageHero" description="Centered Text, Background Image, Simple CTA">
<file path="@/components/sections/hero/CenteredBgImageHero.tsx">
import React from 'react';
import { Button } from '@/components/ui/button';

export const CenteredBgImageHero = () => {
  return (
    <section className="relative w-full h-[70vh] min-h-[500px] flex items-center justify-center text-center text-white overflow-hidden">
      {/* Background Image Container */}
      <div className="absolute inset-0 z-[-1]">
        <img
          src="https://source.unsplash.com/random/1920x1080/?nature-landscape" // Placeholder
          alt="Background"
          className="object-cover w-full h-full"
        />
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/50"></div>
      </div>

      {/* Content */}
      <div className="container px-4 md:px-6 z-10">
        <div className="flex flex-col items-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl/none">
            Explore the Wilderness
          </h1>
          <p className="max-w-[700px] text-lg text-gray-200 md:text-xl">
            Discover breathtaking trails and hidden gems. Your next adventure awaits.
          </p>
          <Button size="lg" variant="secondary" className="mt-4">
            Find Your Trail
          </Button>
        </div>
      </div>
    </section>
  );
};
</file>
</example>
`;

export const fewShotExamples = [example1, example2, example3];