import { type Ads } from "@types";

export const structuredSnippetsConfig: Partial<Ads.AssetPromptMap> = {
    "structured_snippets": {
        prompt: `
            Product or Service Offerings (Structured Snippets)
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
        `,
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