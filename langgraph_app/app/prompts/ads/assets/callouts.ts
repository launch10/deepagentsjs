import { type Ads } from "@types";
import { type AdsGraphState } from "@state";

export const Callouts: Partial<Ads.AssetPromptMap> = {
    "callouts": {
        prompt: (state: AdsGraphState, _config?: any) => {
            const likedCallouts = state?.callouts?.filter((c) => c.locked);
            const rejectedCallouts = state?.callouts?.filter((c) => c.rejected);

            return `
            ## Unique Features (Callouts)
            Generate 6 unique selling points that highlight why customers should choose this business. These appear as callout extensions in Google Ads.

            **Guidelines:**
            - Keep each feature concise and punchy (typically 12-25 characters)
            - Focus on competitive advantages, special offers, or key differentiators
            - Use action-oriented language when possible
            - Examples: "Free Fast Delivery", "10% Student Discount", "30-Day Free Returns", "No Obligation Estimate", "35+ Years Experience", "Family Owned"

            **Requirements:**
            - Generate exactly 6 unique features
            - Each must be 25 characters or less
            - Avoid generic phrases - be specific to this business
            - Focus on tangible benefits or proof points

            Remember: These highlights make the ad larger and give potential customers more reasons to click. Make them compelling, specific, and relevant to the business's unique value proposition.

            ## Background:
            ${likedCallouts?.length ? `The user likes these callouts:\n${likedCallouts.map((c: Ads.Callout, i: number) => `${i+1}. ${c.text}`).join('\n')}` : 'None provided yet.'}
            
            The user DOES NOT LIKE the following callouts (avoid these patterns and similar themes):
            ${rejectedCallouts?.map((c: Ads.Callout, i: number) => `${i+1}. ${c.text}`).join('\n') || 'None provided yet.'}
        `;
        },
        outputFormat: [
            "Feature 1",
            "Feature 2",
            "Feature 3",
            "Feature 4",
            "Feature 5",
            "Feature 6"
        ]
    }
}
