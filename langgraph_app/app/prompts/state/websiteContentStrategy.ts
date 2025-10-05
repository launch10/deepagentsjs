import { renderPrompt, toXML } from '@prompts';
import { type WebsiteContentStrategyType } from "@types";

type WebsiteContentStrategyProps = {
  contentStrategy: WebsiteContentStrategyType
}

export const websiteContentStrategyPrompt = async ({ contentStrategy }: WebsiteContentStrategyProps): Promise<string> => {
  return renderPrompt(toXML({
    values: contentStrategy,
    tag: "content-strategy",
  }))
}