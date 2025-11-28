import { type Ads } from "@types";

export const ResponseTemplates: Record<Ads.StageName, string> = {
    content: `Let's start building your ad! I drafted a few headlines and descriptions that meet Google's requirements. Google will mix and match them to find what performs best. We can tailor them together to make them feel just right for you.`,
    highlights: `Here are some callouts and structured snippets to highlight your business. These help your ad stand out and give users more reasons to click.`,
    keywords: `I've suggested some keywords to target your ideal customers. We can refine these together to maximize your reach.`,
    settings: `Let's configure your ad settings to optimize performance.`,
    launch: `Your ad is ready to launch! Let's review everything one more time.`,
    review: `Here's a summary of your ad campaign. Let me know if you'd like to make any changes.`,
};
