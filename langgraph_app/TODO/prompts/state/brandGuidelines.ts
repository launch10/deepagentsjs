import { type Website } from "@types";
import { renderPrompt, toXML } from '@prompts';

interface BrandGuidelinesProps {
  contentStrategy: Website.ContentStrategyType;
}

export const brandGuidelinesPrompt = async ({ contentStrategy }: BrandGuidelinesProps): Promise<string> => {
  const brandGuidelines = {
    overallTone: contentStrategy.tone,
    pageMood: contentStrategy.pageMood,
    visualEvocation: contentStrategy.visualEvocation,
  }

  return renderPrompt(toXML({ values: brandGuidelines, tag: "brand-guidelines" }))
}