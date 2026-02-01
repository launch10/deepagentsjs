import type { Meta, StoryObj } from "@storybook/react-vite";
import { SiteNameDropdown } from "@components/website/domain-picker/SiteNameDropdown";
import type { Website } from "@shared";

const meta = {
  title: "Landing Page Builder/Domain Picker/SiteNameDropdown",
  component: SiteNameDropdown,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div style={{ width: 300 }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    onSelect: { action: "select" },
    onConnectOwnSite: { action: "connect own site" },
  },
} satisfies Meta<typeof SiteNameDropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// Mock Data Factories
// ============================================================================

const createExistingSite = (
  subdomain: string,
  websiteName: string,
  id: number,
  path = "/"
): Website.DomainRecommendations.DomainRecommendation => ({
  domain: `${subdomain}.launch10.site`,
  subdomain,
  path,
  fullUrl: path === "/" ? `${subdomain}.launch10.site` : `${subdomain}.launch10.site${path}`,
  score: 0.8,
  reasoning: "",
  source: "existing",
  existingDomainId: id,
});

const createSuggestedSite = (
  subdomain: string,
  reasoning: string
): Website.DomainRecommendations.DomainRecommendation => ({
  domain: `${subdomain}.launch10.site`,
  subdomain,
  path: "/",
  fullUrl: `${subdomain}.launch10.site`,
  score: 0.7,
  reasoning,
  source: "generated",
});

// ============================================================================
// 1. NO EXISTING SITES (First-time User / Onboarding)
// ============================================================================

const noExistingSitesRecommendations: Website.DomainRecommendations.DomainRecommendations = {
  state: "no_existing_sites",
  recommendations: [
    createSuggestedSite("petportraits", "Perfect for your pet portrait business"),
    createSuggestedSite("pawsomephotos", "Catchy and memorable name"),
  ],
  topRecommendation: createSuggestedSite("petportraits", "Perfect for your pet portrait business"),
};

/**
 * First-time user with no existing sites (Starter plan).
 * - "Your sites" section is hidden
 * - "Create new site" shows two suggestions
 * - Top suggestion has ⭐ Recommended badge
 * - Shows upgrade badge for custom domain
 */
export const NoExistingSites: Story = {
  args: {
    recommendations: noExistingSitesRecommendations,
    context: {
      existing_domains: [],
      platform_subdomain_credits: { limit: 1, used: 0, remaining: 1 },
      brainstorm_context: null,
      plan_tier: "starter",
    },
    selectedDomain: null,
    isOutOfCredits: false,
  },
};

// ============================================================================
// 2. EXISTING SITE IS CORRECT FOR CURRENT NEED
// ============================================================================

// 2a. Single existing site
const singleExistingSiteRecommendations: Website.DomainRecommendations.DomainRecommendations = {
  state: "existing_recommended",
  recommendations: [
    createExistingSite("pawportraits", "Paw Portraits", 1, "/pets"),
    createSuggestedSite("petportraits", "Alternative domain option"),
    createSuggestedSite("pawsomephotos", "Another creative option"),
  ],
  topRecommendation: createExistingSite("pawportraits", "Paw Portraits", 1, "/pets"),
};

/**
 * User has ONE existing site that matches their current need (Starter plan).
 * - "Your sites" shows the one site with ⭐ Recommended badge
 * - "Create new site" shows two suggestions (no badge)
 * - Shows upgrade badge for custom domain
 */
export const SingleExistingSiteRecommended: Story = {
  args: {
    recommendations: singleExistingSiteRecommendations,
    context: {
      existing_domains: [{ domain: "pawportraits.launch10.site", website_name: "Paw Portraits" }],
      platform_subdomain_credits: { limit: 1, used: 0, remaining: 1 },
      brainstorm_context: null,
      plan_tier: "starter",
    },
    selectedDomain: "pawportraits.launch10.site",
    isOutOfCredits: false,
  },
};

// 2b. Multiple existing sites, one recommended
const multipleExistingSitesRecommendations: Website.DomainRecommendations.DomainRecommendations = {
  state: "existing_recommended",
  recommendations: [
    createExistingSite("pawportraits", "Paw Portraits", 1, "/pets"),
    createExistingSite("family-portraits", "Family Portraits", 2),
    createExistingSite("wedding-photos", "Wedding Photos", 3),
    createSuggestedSite("petportraits", "Alternative domain option"),
    createSuggestedSite("pawsomephotos", "Another creative option"),
  ],
  topRecommendation: createExistingSite("pawportraits", "Paw Portraits", 1, "/pets"),
};

/**
 * User has MULTIPLE existing sites, one is recommended (Growth plan).
 * - "Your sites" shows all sites, one has ⭐ Recommended badge
 * - "Create new site" shows two suggestions (no badge)
 * - NO upgrade badge (Growth plan can connect custom domains)
 */
export const MultipleExistingSitesOneRecommended: Story = {
  args: {
    recommendations: multipleExistingSitesRecommendations,
    context: {
      existing_domains: [
        { domain: "pawportraits.launch10.site", website_name: "Paw Portraits" },
        { domain: "family-portraits.launch10.site", website_name: "Family Portraits" },
        { domain: "wedding-photos.launch10.site", website_name: "Wedding Photos" },
      ],
      platform_subdomain_credits: { limit: 2, used: 0, remaining: 2 },
      brainstorm_context: null,
      plan_tier: "growth",
    },
    selectedDomain: "pawportraits.launch10.site",
    isOutOfCredits: false,
  },
};

// ============================================================================
// 3. EXISTING SITE IS NOT CORRECT - NEW SITE RECOMMENDED
// ============================================================================

const newSiteRecommendedWithExisting: Website.DomainRecommendations.DomainRecommendations = {
  state: "new_recommended",
  recommendations: [
    createExistingSite("family-portraits", "Family Portraits", 2),
    createExistingSite("wedding-photos", "Wedding Photos", 3),
    createSuggestedSite("pawportraits", "Perfect match for your pet business"),
    createSuggestedSite("petphotos", "Alternative option"),
  ],
  topRecommendation: createSuggestedSite("pawportraits", "Perfect match for your pet business"),
};

/**
 * User has existing sites but NONE match current need (Starter plan).
 * AI recommends creating a NEW site.
 * - "Your sites" shows existing sites (no badge)
 * - "Create new site" shows suggestions, top one has ⭐ Recommended badge
 */
export const NewSiteRecommended: Story = {
  args: {
    recommendations: newSiteRecommendedWithExisting,
    context: {
      existing_domains: [
        { domain: "family-portraits.launch10.site", website_name: "Family Portraits" },
        { domain: "wedding-photos.launch10.site", website_name: "Wedding Photos" },
      ],
      platform_subdomain_credits: { limit: 1, used: 0, remaining: 1 },
      brainstorm_context: null,
      plan_tier: "starter",
    },
    selectedDomain: null,
    isOutOfCredits: false,
  },
};

// ============================================================================
// 4. OUT OF CREDITS - EXISTING SITE MATCHES
// ============================================================================

/**
 * User is OUT OF CREDITS but has an existing site that matches (Starter plan).
 * - "Your sites" shows existing site with ⭐ Recommended badge
 * - "Create new site" input is disabled/greyed
 * - Suggestions are greyed out
 * - User can still use their existing site!
 */
export const OutOfCreditsWithMatch: Story = {
  args: {
    recommendations: singleExistingSiteRecommendations,
    context: {
      existing_domains: [{ domain: "pawportraits.launch10.site", website_name: "Paw Portraits" }],
      platform_subdomain_credits: { limit: 1, used: 1, remaining: 0 },
      brainstorm_context: null,
      plan_tier: "starter",
    },
    selectedDomain: "pawportraits.launch10.site",
    isOutOfCredits: true,
  },
};

// ============================================================================
// 5. OUT OF CREDITS - NO EXISTING SITE MATCHES (Edge Case)
// ============================================================================

const outOfCreditsNoMatchRecommendations: Website.DomainRecommendations.DomainRecommendations = {
  state: "out_of_credits_no_match",
  recommendations: [
    createExistingSite("family-portraits", "Family Portraits", 2),
    createExistingSite("wedding-photos", "Wedding Photos", 3),
    createSuggestedSite("pawportraits", "Would be perfect, but requires upgrade"),
    createSuggestedSite("petphotos", "Another great option"),
  ],
  // No top recommendation because nothing is a good fit within their credits
  topRecommendation: null,
};

/**
 * User is OUT OF CREDITS and NO existing site matches their need (Starter plan).
 * This is the most challenging UX state.
 * - "Your sites" shows existing sites (no badge - they don't match)
 * - "Create new site" input is disabled
 * - Suggestions are greyed out
 * - Should encourage upgrade
 */
export const OutOfCreditsNoMatch: Story = {
  args: {
    recommendations: outOfCreditsNoMatchRecommendations,
    context: {
      existing_domains: [
        { domain: "family-portraits.launch10.site", website_name: "Family Portraits" },
        { domain: "wedding-photos.launch10.site", website_name: "Wedding Photos" },
      ],
      platform_subdomain_credits: { limit: 1, used: 1, remaining: 0 },
      brainstorm_context: null,
      plan_tier: "starter",
    },
    selectedDomain: null,
    isOutOfCredits: true,
  },
};

// ============================================================================
// 6. ADDITIONAL STATES
// ============================================================================

/**
 * Default state with multiple existing sites and suggestions (Starter plan).
 * Good for general testing.
 */
export const Default: Story = {
  args: {
    recommendations: multipleExistingSitesRecommendations,
    context: {
      existing_domains: [
        { domain: "pawportraits.launch10.site", website_name: "Paw Portraits" },
        { domain: "family-portraits.launch10.site", website_name: "Family Portraits" },
        { domain: "wedding-photos.launch10.site", website_name: "Wedding Photos" },
      ],
      platform_subdomain_credits: { limit: 1, used: 0, remaining: 1 },
      brainstorm_context: null,
      plan_tier: "starter",
    },
    selectedDomain: "pawportraits.launch10.site",
    isOutOfCredits: false,
  },
};

/**
 * Nothing selected yet - shows placeholder text (Starter plan).
 */
export const NoSelection: Story = {
  args: {
    recommendations: multipleExistingSitesRecommendations,
    context: {
      existing_domains: [
        { domain: "pawportraits.launch10.site", website_name: "Paw Portraits" },
        { domain: "family-portraits.launch10.site", website_name: "Family Portraits" },
        { domain: "wedding-photos.launch10.site", website_name: "Wedding Photos" },
      ],
      platform_subdomain_credits: { limit: 1, used: 0, remaining: 1 },
      brainstorm_context: null,
      plan_tier: "starter",
    },
    selectedDomain: null,
    isOutOfCredits: false,
  },
};

/**
 * Low credits warning - user has only 1 credit remaining (Starter plan).
 */
export const LowCredits: Story = {
  args: {
    recommendations: multipleExistingSitesRecommendations,
    context: {
      existing_domains: [
        { domain: "pawportraits.launch10.site", website_name: "Paw Portraits" },
        { domain: "family-portraits.launch10.site", website_name: "Family Portraits" },
        { domain: "wedding-photos.launch10.site", website_name: "Wedding Photos" },
      ],
      platform_subdomain_credits: { limit: 2, used: 1, remaining: 1 },
      brainstorm_context: null,
      plan_tier: "starter",
    },
    selectedDomain: "pawportraits.launch10.site",
    isOutOfCredits: false,
  },
};

// ============================================================================
// 7. PLAN TIER VARIANTS
// ============================================================================

/**
 * Growth plan user - can connect custom domains.
 * - NO upgrade badge shown
 * - "Connect your own site" is directly clickable
 */
export const GrowthPlanUser: Story = {
  args: {
    recommendations: multipleExistingSitesRecommendations,
    context: {
      existing_domains: [
        { domain: "pawportraits.launch10.site", website_name: "Paw Portraits" },
        { domain: "family-portraits.launch10.site", website_name: "Family Portraits" },
      ],
      platform_subdomain_credits: { limit: 2, used: 0, remaining: 2 },
      brainstorm_context: null,
      plan_tier: "growth",
    },
    selectedDomain: "pawportraits.launch10.site",
    isOutOfCredits: false,
  },
};

/**
 * Pro plan user - can connect custom domains.
 * - NO upgrade badge shown
 * - "Connect your own site" is directly clickable
 */
export const ProPlanUser: Story = {
  args: {
    recommendations: multipleExistingSitesRecommendations,
    context: {
      existing_domains: [
        { domain: "pawportraits.launch10.site", website_name: "Paw Portraits" },
        { domain: "family-portraits.launch10.site", website_name: "Family Portraits" },
        { domain: "wedding-photos.launch10.site", website_name: "Wedding Photos" },
      ],
      platform_subdomain_credits: { limit: 3, used: 0, remaining: 3 },
      brainstorm_context: null,
      plan_tier: "pro",
    },
    selectedDomain: "pawportraits.launch10.site",
    isOutOfCredits: false,
  },
};

/**
 * Starter plan user - needs to upgrade for custom domains.
 * - Shows upgrade badge "✨ Available on Growth & Pro Plan"
 */
export const StarterPlanUser: Story = {
  args: {
    recommendations: singleExistingSiteRecommendations,
    context: {
      existing_domains: [{ domain: "pawportraits.launch10.site", website_name: "Paw Portraits" }],
      platform_subdomain_credits: { limit: 1, used: 0, remaining: 1 },
      brainstorm_context: null,
      plan_tier: "starter",
    },
    selectedDomain: "pawportraits.launch10.site",
    isOutOfCredits: false,
  },
};
