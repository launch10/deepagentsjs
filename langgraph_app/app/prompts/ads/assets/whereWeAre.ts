import type { AdsGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@types";
import { Ads } from "@types";

const PAGE_DESCRIPTIONS: Record<Ads.StageName, string> = {
    "content": "The content page: Where they are working on headlines and descriptions for their Google Ads campaign. It's most likely they're asking you about their headlines and descriptions.",
    "highlights": "The highlights page: Where they're working on callouts and structured snippets for their Google Ads campaign. It's most likely they're asking you about their callouts and structured snippets.",
    "keywords": "The keywords page: Where they're working on keywords for their Google Ads campaign. It's most likely they're asking you about their keywords.",
    "settings": "The settings page: Where they're working on their Google Ads campaign's budget, location target, and ads schedule",
    "launch": "The review page, where the user is reviewing the setup for their Google Ads campaign",
    "review": "The review page, where the user is reviewing the setup for their Google Ads campaign",
    "deployment": "The deployment page, where the user is reviewing the setup for their Google Ads campaign",
}

export const whereWeArePrompt = (state: AdsGraphState, config: LangGraphRunnableConfig) => {
  return `
        <where_we_are>
            Users have already completed:
                1. Brainstorming
                2. Designing their landing page

            Now we're helping them:
                3. Build a Google ads campaign to drive traffic to their new website

            After this:
                4. The user will launch their campaign
                5. They can measure results and iterate
                6. They can learn which business ideas work and which don't
        </where_we_are>
    `;
};

export const whatTheUserIsSeeingPrompt = (state: AdsGraphState, config: LangGraphRunnableConfig) => {
    return `
        <what_the_user_is_seeing>
            The user is seeing:
            ${PAGE_DESCRIPTIONS[state.stage as Ads.StageName]}
            Remember: The user is only seeing the assets referenced on this page.
            The questions they're asking you are MOST LIKELY to be related to this context.
        </what_the_user_is_seeing>
    `;
};