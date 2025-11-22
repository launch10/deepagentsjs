import { z } from "zod";
import { SectionTypeEnum, ComponentTypeEnum, LayoutTypeEnum, PageTypeEnum } from "../../enums"

import { heroSchema } from "./section/hero";
import { benefitsSchema } from "./section/benefits";
import { ctaSchema } from "./section/cta";
import { customSchema } from "./section/custom";
import { faqSchema } from "./section/faq";
import { featuresSchema } from "./section/features";
import { howItWorksSchema } from "./section/howItWorks";
import { pricingSchema } from "./section/pricing";
import { socialProofSchema } from "./section/socialProof";
import { teamSchema } from "./section/team";
import { testimonialsSchema } from "./section/testimonials";
import { navSchema } from "./layout/nav";
import { footerSchema } from "./layout/footer";
import { indexPageSchema } from "./page/indexPage";

const zodSchemaSchema = z.object({
    schema: z.instanceof(z.ZodSchema),
});

type ZodSchemaType = z.infer<typeof zodSchemaSchema>;

export const schemaRegistry: Partial<Record<ComponentTypeEnum, ZodSchemaType>> = {
    [SectionTypeEnum.Hero]: {
        schema: heroSchema,
    },
    [SectionTypeEnum.Benefits]: {
        schema: benefitsSchema,
    },
    [SectionTypeEnum.CTA]: {
        schema: ctaSchema,
    },
    [SectionTypeEnum.Custom]: {
        schema: customSchema,
    },
    [SectionTypeEnum.FAQ]: {
        schema: faqSchema,
    },
    [SectionTypeEnum.Features]: {
        schema: featuresSchema,
    },
    [SectionTypeEnum.HowItWorks]: {
        schema: howItWorksSchema,
    },
    [SectionTypeEnum.Testimonials]: {
        schema: testimonialsSchema,
    },
    [SectionTypeEnum.Team]: {
        schema: teamSchema,
    },
    [SectionTypeEnum.Pricing]: {
        schema: pricingSchema,
    },
    [SectionTypeEnum.SocialProof]: {
        schema: socialProofSchema,
    },
    [LayoutTypeEnum.Nav]: {
        schema: navSchema,
    },
    [LayoutTypeEnum.Footer]: {
        schema: footerSchema,
    },
    [PageTypeEnum.IndexPage]: {
        schema: indexPageSchema,
    },
}