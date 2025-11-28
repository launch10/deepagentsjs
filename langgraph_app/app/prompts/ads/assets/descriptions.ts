import { type Ads } from "@types";
import { type AdsGraphState } from "@state";

export const Descriptions: Partial<Ads.AssetPromptMap> = {
    "descriptions": {
        prompt: (state: AdsGraphState, _config?: any) => {
            const likedDescriptions = state?.descriptions?.filter((d) => d.locked);
            const rejectedDescriptions = state?.descriptions?.filter((d) => d.rejected);

            return `
            ## Descriptions
            Generate 4 compelling descriptions for this business's Google Ads campaign. Descriptions appear below the headlines and provide more detail about the offer.

            **Guidelines:**
            - Each description must be 90 characters or less (this is a strict Google Ads limit)
            - Expand on the value proposition introduced in headlines
            - Include a clear call-to-action in at least 2 descriptions
            - Mix different approaches:
              - Feature-benefit: "Professional installation with lifetime warranty included."
              - Social proof: "Trusted by 10,000+ customers. See why they chose us."
              - Urgency/offer: "Book today and get 20% off your first service. Limited spots."
              - Problem-solution: "Tired of high energy bills? Our solutions cut costs by 40%."
            - Use complete sentences when possible
            - Include relevant keywords naturally

            **Requirements:**
            - Generate exactly 4 unique descriptions
            - Each must be 90 characters or less
            - At least 2 should include a call-to-action (e.g., "Call now", "Get a quote", "Shop today")
            - Make them specific to this business's offerings and benefits
            - Avoid repeating the same information across descriptions

            Remember: Google Ads shows up to 2 descriptions at once. They should complement the headlines and give users a reason to click.

            ## Background:
            ${likedDescriptions?.length ? `The user likes these descriptions:\n${likedDescriptions.map((d: Ads.Description, i: number) => `${i+1}. ${d.text}`).join('\n')}` : 'None provided yet.'}
            
            The user DOES NOT LIKE the following descriptions (avoid these patterns and similar themes):
            ${rejectedDescriptions?.map((d: Ads.Description, i: number) => `${i+1}. ${d.text}`).join('\n') || 'None provided yet.'}
        `;
        },
        outputFormat: [
            "Description 1",
            "Description 2",
            "Description 3",
            "Description 4"
        ]
    }
}
