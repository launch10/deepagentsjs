import { type Ads } from "@types";
import { type AdsGraphState } from "@state";

export const Headlines: Partial<Ads.AssetPromptMap> = {
    "headlines": {
        prompt: (state: AdsGraphState, _config?: any) => {
            const likedHeadlines = state?.headlines?.filter((h) => h.locked);
            const rejectedHeadlines = state?.headlines?.filter((h) => h.rejected);
            const provideBackground = likedHeadlines?.length > 0 || rejectedHeadlines?.length > 0;

            return `
            ## Headlines
            Generate 6 compelling headlines for this business's Google Ads campaign. Headlines are the most prominent part of text ads and appear at the top.

            **Guidelines:**
            - Each headline must be 30 characters or less (this is a strict Google Ads limit)
            - Include the primary keyword or service in at least 3-5 headlines
            - Mix different headline types:
            - Benefit-focused: "Save 50% on Energy Bills"
            - Action-oriented: "Get Your Free Quote Today"
            - Question-based: "Need Fast Repairs?"
            - Trust signals: "5-Star Rated Service"
            - Urgency: "Limited Time Offer"
            - Front-load important words (they may get truncated on mobile)
            - Avoid excessive punctuation or ALL CAPS

            **Requirements:**
            - Generate exactly 6 unique headlines
            - Each must be 30 characters or less
            - Vary the messaging angles to test what resonates
            - Include at least one headline with the business name or brand
            - Make them specific to this business, not generic

            Remember: Google Ads shows up to 3 headlines at once, so they should work both independently and together.

            ${
                provideBackground 
                    ? `User's preferences. Understand what the user likes and dislikes about the headlines, and adapt your approach accordingly:\n` +
                      (likedHeadlines ? `Liked headlines:\n${likedHeadlines.map((h: Ads.Headline, i: number) => `${i+1}. ${h.text}`).join('\n')}\n` : '') +
                      (rejectedHeadlines ? `Rejected headlines (avoid these patterns):\n${rejectedHeadlines.map((h: Ads.Headline, i: number) => `${i+1}. ${h.text}`).join('\n')}\n` : '')
                    : ''
            }

            ${provideBackground ? 'Always generate net-new, unique headlines (do not repeat ones user previously liked or rejected).' : ''}
        `;
        },
        outputFormat: [
            "Headline 1",
            "Headline 2",
            "Headline 3",
            "Headline 4",
            "Headline 5",
            "Headline 6",
        ]
    }
}
