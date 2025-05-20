import { z } from "zod";
import { type FileSpecification } from "../fileSpecification";
import { 
         FileTypeEnum, 
         SectionTypeEnum,
         LanguageEnum
        } from "../enums";

import { heroSchema, heroPrompt } from "./section/hero";
import { benefitsSchema, benefitsPrompt } from "./section/benefits";
import { contactFormSchema, contactFormPrompt } from "./section/contactForm";
import { ctaSchema, ctaPrompt } from "./section/cta";
import { customSchema, customPrompt } from "./section/custom";
import { faqSchema, faqPrompt } from "./section/faq";
import { featuresSchema, featuresPrompt } from "./section/features";
import { howItWorksSchema, howItWorksPrompt } from "./section/howItWorks";
import { pricingSchema, pricingPrompt } from "./section/pricing";
import { socialProofSchema, socialProofPrompt } from "./section/socialProof";
import { teamSchema, teamPrompt } from "./section/team";
import { testimonialsSchema, testimonialsPrompt } from "./section/testimonials";

const SectionBaseType = {
    filetype: FileTypeEnum.Section,
    language: LanguageEnum.TSX
}

export const sectionRegistry: Record<string, FileSpecification> = {
    "Section:Hero": {
        id: "hero-section",
        description: "Choose when the user wants a prominent header section at the top of the page. Ideal for main headlines, value propositions, and primary call-to-action buttons. Also appropriate for 'above the fold', 'header', or 'banner' requests.",
        canonicalPath: "src/components/Hero.tsx",
        subtype: SectionTypeEnum.Hero,
        schema: heroSchema,
        generationPrompt: heroPrompt,
        ...SectionBaseType,
    },
    "Section:Benefits": {
        id: "benefits-section",
        description: "Choose when the user wants to highlight advantages, key features, or value propositions. Good for 'why choose us', 'advantages', 'key points', or 'what you get' sections.",
        canonicalPath: "src/components/Benefits.tsx",
        subtype: SectionTypeEnum.Benefits,
        schema: benefitsSchema,
        generationPrompt: benefitsPrompt,
        ...SectionBaseType,
    },
    // "Section:ContactForm": {
    //     id: "contact-form-section",
    //     canonicalPath: "src/components/ContactForm.tsx",
    //     subtype: SectionTypeEnum.ContactForm,
    //     schema: contactFormSchema,
    //     generationPrompt: contactFormPrompt,
    //     ...SectionBaseType,
    // },
    "Section:CTA": {
        id: "cta-section",
        description: "Choose for call-to-action sections that drive user engagement. Ideal for 'sign up', 'get started', 'contact us', or any conversion-focused section that prompts immediate action.",
        canonicalPath: "src/components/CTA.tsx",
        subtype: SectionTypeEnum.CTA,
        schema: ctaSchema,
        generationPrompt: ctaPrompt,
        ...SectionBaseType,
    },
    "Section:Custom": {
        id: "custom-section",
        description: "Choose when the user's request doesn't fit any other predefined section types or requires highly specialized, unique functionality.",
        canonicalPath: "src/components/Custom.tsx",
        subtype: SectionTypeEnum.Custom,
        schema: customSchema,
        generationPrompt: customPrompt,
        ...SectionBaseType,
    },
    "Section:FAQ": {
        id: "faq-section",
        description: "Choose when the user wants to address common questions, concerns, or provide help information. Good for 'frequently asked questions', 'help', 'support', or 'common questions' sections.",
        canonicalPath: "src/components/FAQ.tsx",
        subtype: SectionTypeEnum.FAQ,
        schema: faqSchema,
        generationPrompt: faqPrompt,
        ...SectionBaseType,
    },
    "Section:Features": {
        id: "features-section",
        description: "Choose when the user wants to showcase specific product or service features, capabilities, or functionalities. Good for 'what we offer', 'capabilities', or detailed product/service breakdowns.",
        canonicalPath: "src/components/Features.tsx",
        subtype: SectionTypeEnum.Features,
        schema: featuresSchema,
        generationPrompt: featuresPrompt,
        ...SectionBaseType,
    },
    "Section:HowItWorks": {
        id: "how-it-works-section",
        description: "Choose when the user wants to explain processes, steps, or workflows. Ideal for 'process', 'steps', 'how to use', or any section explaining sequential information.",
        canonicalPath: "src/components/HowItWorks.tsx",
        subtype: SectionTypeEnum.HowItWorks,
        schema: howItWorksSchema,
        generationPrompt: howItWorksPrompt,
        ...SectionBaseType,
    },
    "Section:Testimonials": {
        id: "testimonials-section",
        description: "Choose when the user wants to showcase customer reviews, feedback, or endorsements. Good for 'reviews', 'what people say', 'client feedback', or 'endorsements' sections.",
        canonicalPath: "src/components/Testimonials.tsx",
        subtype: SectionTypeEnum.Testimonials,
        schema: testimonialsSchema,
        generationPrompt: testimonialsPrompt,
        ...SectionBaseType,
    },
    "Section:Team": {
        id: "team-section",
        description: "Choose when the user wants to showcase team members, leadership, or staff. Good for 'about the team', 'our experts', 'leadership', or 'meet the team' sections.",
        canonicalPath: "src/components/Team.tsx",
        subtype: SectionTypeEnum.Team,
        schema: teamSchema,
        generationPrompt: teamPrompt,
        ...SectionBaseType,
    },
    "Section:Pricing": {
        id: "pricing-section",
        description: "Choose when the user wants to display pricing information, plans, or packages. Good for 'plans', 'packages', 'subscriptions', or any price-related comparison sections.",
        canonicalPath: "src/components/Pricing.tsx",
        subtype: SectionTypeEnum.Pricing,
        schema: pricingSchema,
        generationPrompt: pricingPrompt,
        ...SectionBaseType,
    },
    "Section:SocialProof": {
        id: "social-proof-section",
        description: "Choose when the user wants to display trust indicators like logos, statistics, or achievements. Good for 'trusted by', 'as seen in', 'achievements', or sections showing company/client logos.",
        canonicalPath: "src/components/SocialProof.tsx",
        subtype: SectionTypeEnum.SocialProof,
        schema: socialProofSchema,
        generationPrompt: socialProofPrompt,
        ...SectionBaseType,
    }
}

export const sectionTypeSchema = z.discriminatedUnion("subtype", [
    heroSchema.extend({ subtype: z.literal(SectionTypeEnum.Hero) }),
    benefitsSchema.extend({ subtype: z.literal(SectionTypeEnum.Benefits) }),
    // contactFormSchema.extend({ subtype: z.literal(SectionTypeEnum.ContactForm) }),
    ctaSchema.extend({ subtype: z.literal(SectionTypeEnum.CTA) }),
    customSchema.extend({ subtype: z.literal(SectionTypeEnum.Custom) }),
    faqSchema.extend({ subtype: z.literal(SectionTypeEnum.FAQ) }),
    featuresSchema.extend({ subtype: z.literal(SectionTypeEnum.Features) }),
    howItWorksSchema.extend({ subtype: z.literal(SectionTypeEnum.HowItWorks) }),
    pricingSchema.extend({ subtype: z.literal(SectionTypeEnum.Pricing) }),
    socialProofSchema.extend({ subtype: z.literal(SectionTypeEnum.SocialProof) }),
    teamSchema.extend({ subtype: z.literal(SectionTypeEnum.Team) }),
    testimonialsSchema.extend({ subtype: z.literal(SectionTypeEnum.Testimonials) }),
]);

export type SectionType = z.infer<typeof sectionTypeSchema>;