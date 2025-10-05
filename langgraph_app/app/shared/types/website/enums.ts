export enum SectionTypeEnum {
    Hero = "Hero",
    Features = "Features",
    Benefits = "Benefits",
    HowItWorks = "HowItWorks",
    Testimonials = "Testimonials",
    Pricing = "Pricing",
    FAQ = "FAQ",
    CTA = "CTA",
    SocialProof = "SocialProof",
    Team = "Team",
    Custom = "Custom",
}

export enum PageTypeEnum {
    IndexPage = "IndexPage",
    PricingPage = "PricingPage",
    AboutPage = "AboutPage",
    ContactPage = "ContactPage",
    OtherPage = "OtherPage",
    NotFoundPage = "NotFoundPage"
}

export enum LayoutTypeEnum {
    Nav = "Nav",
    Footer = "Footer",
    Sidebar = "Sidebar"
}

export enum FileTypeEnum {
    Page = "Page",
    Section = "Section",
    Style = "Style",
    Config = "Config",
    Layout = "Layout"
}

export enum ConfigTypeEnum {
    PackageJson = "PackageJson",
    TsConfig = "TsConfig",
    ViteConfig = "ViteConfig",
    EslintConfig = "EslintConfig"
}

export enum StyleTypeEnum {
    IndexCss = "IndexCss",
    AppCss = "AppCss",
    TailwindConfig = "TailwindConfig",
}

// Component type that represents any value from any of the component enums
export type ComponentTypeEnum = 
  | `${PageTypeEnum}`
  | `${SectionTypeEnum}` 
  | `${LayoutTypeEnum}` 
  | `${ConfigTypeEnum}` 
  | `${StyleTypeEnum}`;

// Merged enum object for convenience
export const ComponentTypeEnum = {
  ...PageTypeEnum,
  ...SectionTypeEnum,
  ...LayoutTypeEnum,
  ...ConfigTypeEnum,
  ...StyleTypeEnum,
};


export enum LanguageEnum { 
    TS = "ts",
    TSX = "tsx",
    JS = "js",
    JSX = "jsx",
    CSS = "css",
    JSON = "json",
    MD = "md"
}

export enum BackgroundColorEnum {
    Primary = "primary",
    Secondary = "secondary",
    Background = "background",
    Muted = "muted",
    Accent = "accent",
    Neutral = "neutral",
}