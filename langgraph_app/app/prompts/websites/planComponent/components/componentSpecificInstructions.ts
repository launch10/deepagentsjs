import { benefitsPrompt } from "./benefits";
import { heroPrompt } from "./hero";
import { ctaPrompt } from "./cta";
import { featuresPrompt } from "./features";
import { howItWorksPrompt } from "./howItWorks";
import { pricingPrompt } from "./pricing";
import { socialProofPrompt } from "./socialProof";
import { teamPrompt } from "./team";
import { testimonialsPrompt } from "./testimonials";
import { customPrompt } from "./custom";
import { navPrompt } from "../../createComponent/components/nav";
import { footerPrompt } from "../../createComponent/components/footer";
import { faqPrompt } from "./faq";
import { Website } from "@types";
import { db, componentOverviews, eq, not, inArray, and, asc } from "app/db";

const ComponentTypeEnum = Website.Component.ComponentTypeEnum;
const SectionTypeEnum = Website.Component.SectionTypeEnum;
const LayoutTypeEnum = Website.Component.LayoutTypeEnum;
type ComponentTypeKey = keyof typeof ComponentTypeEnum;

const getWebsitesComponents = async (websiteId: number): Promise<string[]> => {
  const componentObjs = await db.select().from(componentOverviews).where(
    and(
      eq(componentOverviews.websiteId, websiteId),
      not(inArray(componentOverviews.componentType, [ComponentTypeEnum.Nav, ComponentTypeEnum.Footer]))
    )
  ).orderBy(asc(componentOverviews.sortOrder));
  return componentObjs.map(componentObj => componentObj.name);
}

const layoutPrompt = async ({componentType, websiteId}: {componentType: ComponentTypeKey, websiteId?: number}) => {
  if (!websiteId){
    throw new Error("Content plan is required for nav component generation")
  }
  const components = await getWebsitesComponents(websiteId)

  switch (componentType) {
    case ComponentTypeEnum.Nav:
      return await navPrompt({ components });
    case ComponentTypeEnum.Footer:
      return await footerPrompt({ components });
    default:
      return ''
  }
}

export const componentSpecificInstructions = async ({ componentType, websiteId }: { componentType: ComponentTypeKey, websiteId?: number }): Promise<string> => {
  if (LayoutTypeEnum.Nav === componentType || LayoutTypeEnum.Footer === componentType) {
    return await layoutPrompt({componentType, websiteId})
  }

  switch (componentType) {
    case ComponentTypeEnum.Hero:
      return await heroPrompt();
    case ComponentTypeEnum.Benefits:
      return await benefitsPrompt();
    case SectionTypeEnum.CTA:
      return await ctaPrompt();
    case SectionTypeEnum.Custom:
      return await customPrompt();
    case SectionTypeEnum.FAQ:
      return await faqPrompt();
    case SectionTypeEnum.Features:
      return await featuresPrompt();
    case SectionTypeEnum.HowItWorks:
      return await howItWorksPrompt();
    case SectionTypeEnum.Pricing:
      return await pricingPrompt();
    case SectionTypeEnum.SocialProof:
      return await socialProofPrompt();
    case SectionTypeEnum.Team:
      return await teamPrompt();
    case SectionTypeEnum.Testimonials:
      return await testimonialsPrompt();
    default:
      return ''
  }
}
