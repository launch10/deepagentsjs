import { type FileSpecification } from "../fileSpecification";
import { indexPagePrompt, indexPageSchema } from "./page/indexPage";
import { FileTypeEnum,
         LanguageEnum,
         PageTypeEnum
        } from "../enums";

export const pageRegistry: Record<string, FileSpecification> = {
    "Page:IndexPage": {
        id: "index-page",
        description: "Choose for the main landing page or homepage. This is the primary entry point of the website that showcases the most important content and sections. Good for 'home', 'landing', or 'main' page requests.",
        canonicalPath: "src/pages/IndexPage.tsx",
        filetype: FileTypeEnum.Page,
        subtype: PageTypeEnum.IndexPage,
        schema: indexPageSchema,
        generationPrompt: indexPagePrompt,
        language: LanguageEnum.TSX
    },
    "Page:PricingPage": {
        id: "pricing-page",
        description: "Choose for a dedicated pricing page that provides detailed information about different plans, packages, or service tiers. Good for 'pricing', 'plans', or 'packages' page requests.",
        canonicalPath: "src/pages/PricingPage.tsx",
        filetype: FileTypeEnum.Page,
        subtype: PageTypeEnum.PricingPage,
        language: LanguageEnum.TSX
    },
    "Page:NotFoundPage": {
        id: "not-found-page",
        description: "Choose for the 404 error page that appears when users try to access non-existent pages. Should provide helpful navigation options and maintain brand consistency. Good for '404', 'error', or 'not found' page requests.",
        canonicalPath: "src/pages/NotFoundPage.tsx",
        filetype: FileTypeEnum.Page,
        subtype: PageTypeEnum.NotFoundPage,
        language: LanguageEnum.TSX
    },
    "Page:AboutPage": {
        id: "about-page",
        description: "Choose for pages that tell the company or product story, mission, values, and team information. Good for 'about us', 'our story', 'company', or 'mission' page requests.",
        canonicalPath: "src/pages/AboutPage.tsx",
        filetype: FileTypeEnum.Page,
        subtype: PageTypeEnum.AboutPage,
        language: LanguageEnum.TSX
    },
    "Page:ContactPage": {
        id: "contact-page",
        description: "Choose for pages that provide contact information, contact forms, or other ways to get in touch. Good for 'contact us', 'reach out', 'get in touch', or 'support' page requests.",
        canonicalPath: "src/pages/ContactPage.tsx",
        filetype: FileTypeEnum.Page,
        subtype: PageTypeEnum.ContactPage,
        language: LanguageEnum.TSX
    },
    "Page:OtherPage": {
        id: "other-page",
        description: "Choose for specialized pages that don't fit into other categories. This is a flexible template for custom pages like terms of service, privacy policy, careers, or other unique content pages.",
        canonicalPath: "src/pages/OtherPage.tsx",
        filetype: FileTypeEnum.Page,
        subtype: PageTypeEnum.OtherPage,
        language: LanguageEnum.TSX
    }
}