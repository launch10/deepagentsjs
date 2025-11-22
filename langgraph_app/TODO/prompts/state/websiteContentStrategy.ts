import { renderPrompt, toXML } from '@prompts';
import { type ContentStrategyType } from "@types";

type WebsiteContentStrategyProps = {
  contentStrategy: ContentStrategyType
}

export const websiteContentStrategyPrompt = async ({ contentStrategy }: WebsiteContentStrategyProps): Promise<string> => {
  return renderPrompt(toXML({
    values: contentStrategy,
    tag: "content-strategy",
  }))
}