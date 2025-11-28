import { type Ads } from "@types";
import { type AdsGraphState } from "@state";

export const Keywords: Partial<Ads.AssetPromptMap> = {
    "keywords": {
        prompt: (state: AdsGraphState, _config?: any) => {
            const likedKeywords = state?.keywords?.filter((k) => k.locked);
            const rejectedKeywords = state?.keywords?.filter((k) => k.rejected);

            return `
            ## Keywords
            Generate 20 targeted keywords for this business's Google Ads campaign. Keywords determine when your ads appear in search results.

            **Guidelines:**
            - Include a mix of keyword types:
              - Brand keywords: Business name and variations
              - Product/Service keywords: What the business offers
              - Problem keywords: What customers search when they have an issue
              - Competitor keywords: Alternative solutions customers might search
              - Location keywords: If the business serves specific areas
            - Consider search intent:
              - Transactional: "buy", "hire", "get quote", "near me"
              - Informational: "how to", "best", "reviews"
              - Commercial: "pricing", "cost", "compare"
            - Use natural language phrases (Google handles match types separately)

            **Requirements:**
            - Generate exactly 20 unique keywords
            - Include 3-5 high-intent transactional keywords
            - Include 3-5 broader awareness keywords
            - Include at least 2 location-based keywords if applicable
            - Focus on keywords with clear commercial intent
            - Avoid overly broad single words (e.g., just "plumber" - prefer "emergency plumber near me")

            **Keyword Format:**
            - Use lowercase
            - 1-5 words per keyword phrase
            - No special characters or punctuation

            Remember: Quality keywords connect your ads with people actively searching for what you offer. Focus on relevance and intent over volume.

            ## Background:
            ${likedKeywords?.length ? `The user likes these keywords:\n${likedKeywords.map((k: Ads.Keyword, i: number) => `${i+1}. ${k.text}`).join('\n')}` : 'None provided yet.'}
            
            The user DOES NOT LIKE the following keywords (avoid these patterns and similar themes):
            ${rejectedKeywords?.map((k: Ads.Keyword, i: number) => `${i+1}. ${k.text}`).join('\n') || 'None provided yet.'}
        `;
        },
        outputFormat: [
            "keyword 1",
            "keyword 2",
            "keyword 3",
            "keyword 4",
            "keyword 5",
            "keyword 6",
            "keyword 7",
            "keyword 8",
            "keyword 9",
            "keyword 10",
            "keyword 11",
            "keyword 12",
            "keyword 13",
            "keyword 14",
            "keyword 15",
            "keyword 16",
            "keyword 17",
            "keyword 18",
            "keyword 19",
            "keyword 20"
        ]
    }
}
