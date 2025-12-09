import { type Ads } from "@types";

export const ResponseTemplates: Record<Ads.StageName, string> = {
  content: `Let's start building your ad! I drafted a few headlines and descriptions that meet Google's requirements.

Google will mix and match them to find what performs best. We can tailor them together to make them feel just right for you.`,
  highlights: `Next, let's spell out some unique features of your business.

This helps your ad take up more real estate, and gives your users more reasons to click. I filled in a few ideas to help get us started.`,
  keywords: `I've suggested a few keywords your audience is likely searching for when your ad appears.

How do these sound to you?`,
  settings: `Let's configure your ad settings to optimize performance.`,
  launch: `Your ad is ready to launch! Let's review everything one more time.`,
  review: `Here's a summary of your ad campaign. Let me know if you'd like to make any changes.`,
};
