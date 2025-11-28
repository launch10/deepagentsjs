import { type Ads } from "@types";
import { type AdsGraphState } from "@state";

export const StructuredSnippets: Partial<Ads.AssetPromptMap> = {
    "structured_snippets": {
        prompt: (state: AdsGraphState, _config?: any) => {
            const existingSnippet = state?.structured_snippets?.[0];
            const likedCategory = existingSnippet?.category?.locked ? existingSnippet.category : null;
            const likedDetails = existingSnippet?.details?.filter((d) => d.locked) || [];
            const rejectedDetails = existingSnippet?.details?.filter((d) => d.rejected) || [];

            return `
            ## Product or Service Offerings (Structured Snippets)
            Generate a category header and 3-10 specific examples of what this business offers. These appear as structured snippet extensions in Google Ads.

            **Category Header:**
            Choose ONE header that best describes what you're listing (e.g., "Types", "Services", "Amenities", "Products", "Styles", "Brands", "Courses", "Destinations")

            **Details (Values):**
            List 3-10 specific offerings under that category header.
            - Examples: 
              - Types: "Web Design", "SEO", "Content Marketing"
              - Amenities: "Free WiFi", "Free Parking", "Included Breakfast", "Spa Services"
              - Services: "Emergency Repairs", "Annual Maintenance", "Free Estimates"

            **Requirements:**
            - Choose an appropriate category header
            - Generate 3-10 specific, relevant details
            - Each detail should be 25 characters or less
            - Be specific to this business's actual offerings

            ## Background:
            ${likedCategory ? `The user likes this category: "${likedCategory.text}"` : 'No category preference yet.'}
            ${likedDetails.length ? `The user likes these details:\n${likedDetails.map((d: Ads.Asset, i: number) => `${i+1}. ${d.text}`).join('\n')}` : 'No liked details yet.'}
            
            The user DOES NOT LIKE the following details (avoid these patterns and similar themes):
            ${rejectedDetails.map((d: Ads.Asset, i: number) => `${i+1}. ${d.text}`).join('\n') || 'None provided yet.'}
        `;
        },
        outputFormat: {
            "category": "Types",
            "details": [
                "Detail 1",
                "Detail 2",
                "Detail 3"
            ]
        }
    }
}
