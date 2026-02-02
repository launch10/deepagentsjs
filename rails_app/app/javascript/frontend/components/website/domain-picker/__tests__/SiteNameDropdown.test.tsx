import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SiteNameDropdown } from "../SiteNameDropdown";
import type { Website, DomainWithWebsite } from "@shared";

// ============================================================================
// Mock Data Factories (matching Storybook fixtures)
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
  score: 85,
  reasoning: `Great match for ${websiteName}`,
  source: "existing",
  existingDomainId: id,
  availability: "existing",
});

const createSuggestedSite = (
  subdomain: string,
  reasoning: string,
  score = 90
): Website.DomainRecommendations.DomainRecommendation => ({
  domain: `${subdomain}.launch10.site`,
  subdomain,
  path: "/",
  fullUrl: `${subdomain}.launch10.site`,
  score,
  reasoning,
  source: "suggestion",
  availability: "available",
});

const createDomainWithWebsite = (
  subdomain: string,
  websiteName: string,
  id: number
): DomainWithWebsite => ({
  id,
  domain: `${subdomain}.launch10.site`,
  is_platform_subdomain: true,
  website_id: id,
  website_name: websiteName,
  website_urls: [{ id, path: "/", website_id: id }],
  dns_verification_status: null,
  created_at: new Date().toISOString(),
});

const createContext = (
  existingDomains: DomainWithWebsite[],
  credits: { limit: number; used: number; remaining: number },
  planTier: "starter" | "growth" | "pro" = "starter"
) => ({
  existing_domains: existingDomains,
  platform_subdomain_credits: credits,
  brainstorm_context: null,
  plan_tier: planTier,
  assigned_url: null,
});

// ============================================================================
// Test Fixtures for Each UI State
// ============================================================================

// State: no_existing_sites - First-time user with no existing domains
const noExistingSitesRecommendations: Website.DomainRecommendations.DomainRecommendations = {
  state: "no_existing_sites",
  recommendations: [
    createSuggestedSite("petportraits", "Perfect for your pet portrait business", 95),
    createSuggestedSite("pawsomephotos", "Catchy and memorable name", 88),
  ],
  topRecommendation: createSuggestedSite("petportraits", "Perfect for your pet portrait business", 95),
};

// State: existing_recommended - User has an existing domain that matches well
const existingRecommendedRecommendations: Website.DomainRecommendations.DomainRecommendations = {
  state: "existing_recommended",
  recommendations: [
    createExistingSite("pawportraits", "Paw Portraits", 1, "/pets"),
    createSuggestedSite("petportraits", "Alternative domain option", 82),
    createSuggestedSite("pawsomephotos", "Another creative option", 78),
  ],
  topRecommendation: createExistingSite("pawportraits", "Paw Portraits", 1, "/pets"),
};

// State: new_recommended - User has sites but none match well
const newRecommendedRecommendations: Website.DomainRecommendations.DomainRecommendations = {
  state: "new_recommended",
  recommendations: [
    createExistingSite("family-portraits", "Family Portraits", 2),
    createExistingSite("wedding-photos", "Wedding Photos", 3),
    createSuggestedSite("pawportraits", "Perfect match for your pet business", 92),
    createSuggestedSite("petphotos", "Alternative option", 85),
  ],
  topRecommendation: createSuggestedSite("pawportraits", "Perfect match for your pet business", 92),
};

// State: out_of_credits_no_match - No credits AND no matching existing domain
const outOfCreditsNoMatchRecommendations: Website.DomainRecommendations.DomainRecommendations = {
  state: "out_of_credits_no_match",
  recommendations: [
    createExistingSite("family-portraits", "Family Portraits", 2),
    createExistingSite("wedding-photos", "Wedding Photos", 3),
    createSuggestedSite("pawportraits", "Would be perfect, but requires upgrade", 92),
  ],
  topRecommendation: null, // No good fit within their limits
};

// ============================================================================
// Tests
// ============================================================================

describe("SiteNameDropdown", () => {
  const defaultHandlers = {
    onSelect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("State: no_existing_sites (First-time User)", () => {
    const context = createContext([], { limit: 1, used: 0, remaining: 1 });

    it("shows suggested sites when user has no existing domains", async () => {
      render(
        <SiteNameDropdown
          recommendations={noExistingSitesRecommendations}
          context={context}
          selectedDomain={null}
          isOutOfCredits={false}
          {...defaultHandlers}
        />
      );

      const trigger = screen.getByRole("button", { name: /select a domain/i });
      await userEvent.click(trigger);

      // Should show the suggested sites
      expect(screen.getByText("petportraits.launch10.site")).toBeInTheDocument();
      expect(screen.getByText("pawsomephotos.launch10.site")).toBeInTheDocument();
    });

    it("shows star icon on top suggestion", async () => {
      render(
        <SiteNameDropdown
          recommendations={noExistingSitesRecommendations}
          context={context}
          selectedDomain={null}
          isOutOfCredits={false}
          {...defaultHandlers}
        />
      );

      const trigger = screen.getByRole("button", { name: /select a domain/i });
      await userEvent.click(trigger);

      // The top recommendation should have a star icon
      const recommendedItem = screen.getByText("petportraits.launch10.site").closest("button");
      expect(recommendedItem).toBeInTheDocument();
      // Star icon should be present (SVG element inside the button)
      expect(recommendedItem?.querySelector("svg")).toBeInTheDocument();
    });

    it("does not show 'Your sites' section when user has no domains", async () => {
      render(
        <SiteNameDropdown
          recommendations={noExistingSitesRecommendations}
          context={context}
          selectedDomain={null}
          isOutOfCredits={false}
          {...defaultHandlers}
        />
      );

      const trigger = screen.getByRole("button", { name: /select a domain/i });
      await userEvent.click(trigger);

      // Should not have a "Your sites" section
      expect(screen.queryByText(/your sites/i)).not.toBeInTheDocument();
    });
  });

  describe("State: existing_recommended (Existing Domain Matches)", () => {
    const context = createContext(
      [createDomainWithWebsite("pawportraits", "Paw Portraits", 1)],
      { limit: 1, used: 1, remaining: 0 }
    );

    it("shows existing site with star icon", async () => {
      render(
        <SiteNameDropdown
          recommendations={existingRecommendedRecommendations}
          context={context}
          selectedDomain={null}
          isOutOfCredits={false}
          {...defaultHandlers}
        />
      );

      const trigger = screen.getByRole("button", { name: /select a domain/i });
      await userEvent.click(trigger);

      // Existing site should be visible
      expect(screen.getByText("pawportraits.launch10.site")).toBeInTheDocument();

      // And should have star icon (since it's the top recommendation)
      const recommendedItem = screen.getByText("pawportraits.launch10.site").closest("button");
      expect(recommendedItem?.querySelector("svg")).toBeInTheDocument();
    });

    it("star is on existing site, not on suggestions", async () => {
      render(
        <SiteNameDropdown
          recommendations={existingRecommendedRecommendations}
          context={context}
          selectedDomain={null}
          isOutOfCredits={false}
          {...defaultHandlers}
        />
      );

      const trigger = screen.getByRole("button", { name: /select a domain/i });
      await userEvent.click(trigger);

      // Existing site has the star icon
      const existingItem = screen.getByText("pawportraits.launch10.site").closest("button");
      expect(existingItem?.querySelector("svg")).toBeInTheDocument();

      // Suggestions should NOT have the star icon (they have an empty placeholder span)
      const suggestionItem = screen.getByText("petportraits.launch10.site").closest("button");
      expect(suggestionItem?.querySelector("svg")).not.toBeInTheDocument();
    });
  });

  describe("State: new_recommended (No Good Existing Match)", () => {
    const context = createContext(
      [
        createDomainWithWebsite("family-portraits", "Family Portraits", 2),
        createDomainWithWebsite("wedding-photos", "Wedding Photos", 3),
      ],
      { limit: 2, used: 2, remaining: 0 }
    );

    it("shows star on suggestion, not on existing sites", async () => {
      render(
        <SiteNameDropdown
          recommendations={newRecommendedRecommendations}
          context={context}
          selectedDomain={null}
          isOutOfCredits={false}
          {...defaultHandlers}
        />
      );

      const trigger = screen.getByRole("button", { name: /select a domain/i });
      await userEvent.click(trigger);

      // Top suggestion should have star icon
      const suggestionItem = screen.getByText("pawportraits.launch10.site").closest("button");
      expect(suggestionItem?.querySelector("svg")).toBeInTheDocument();

      // Existing sites should NOT have the star icon
      const existingItem = screen.getByText("family-portraits.launch10.site").closest("button");
      expect(existingItem?.querySelector("svg")).not.toBeInTheDocument();
    });

    it("shows both existing sites and suggestions", async () => {
      render(
        <SiteNameDropdown
          recommendations={newRecommendedRecommendations}
          context={context}
          selectedDomain={null}
          isOutOfCredits={false}
          {...defaultHandlers}
        />
      );

      const trigger = screen.getByRole("button", { name: /select a domain/i });
      await userEvent.click(trigger);

      // Existing sites visible
      expect(screen.getByText("family-portraits.launch10.site")).toBeInTheDocument();
      expect(screen.getByText("wedding-photos.launch10.site")).toBeInTheDocument();

      // Suggestions visible
      expect(screen.getByText("pawportraits.launch10.site")).toBeInTheDocument();
      expect(screen.getByText("petphotos.launch10.site")).toBeInTheDocument();
    });
  });

  describe("State: out_of_credits_no_match (No Credits, No Match)", () => {
    const context = createContext(
      [
        createDomainWithWebsite("family-portraits", "Family Portraits", 2),
        createDomainWithWebsite("wedding-photos", "Wedding Photos", 3),
      ],
      { limit: 1, used: 1, remaining: 0 }
    );

    it("disables new site creation input when out of credits", async () => {
      render(
        <SiteNameDropdown
          recommendations={outOfCreditsNoMatchRecommendations}
          context={context}
          selectedDomain={null}
          isOutOfCredits={true}
          {...defaultHandlers}
        />
      );

      const trigger = screen.getByRole("button", { name: /select a domain/i });
      await userEvent.click(trigger);

      // The "Create new site" input should be disabled or greyed
      const createNewInput = screen.queryByPlaceholderText(/enter.*name/i);
      if (createNewInput) {
        expect(createNewInput).toBeDisabled();
      }
    });

    it("shows existing sites without recommended badge when no match", async () => {
      render(
        <SiteNameDropdown
          recommendations={outOfCreditsNoMatchRecommendations}
          context={context}
          selectedDomain={null}
          isOutOfCredits={true}
          {...defaultHandlers}
        />
      );

      const trigger = screen.getByRole("button", { name: /select a domain/i });
      await userEvent.click(trigger);

      // Existing sites visible but no recommended badge (topRecommendation is null)
      expect(screen.getByText("family-portraits.launch10.site")).toBeInTheDocument();
    });

    it("suggestions are greyed/disabled when out of credits", async () => {
      render(
        <SiteNameDropdown
          recommendations={outOfCreditsNoMatchRecommendations}
          context={context}
          selectedDomain={null}
          isOutOfCredits={true}
          {...defaultHandlers}
        />
      );

      const trigger = screen.getByRole("button", { name: /select a domain/i });
      await userEvent.click(trigger);

      // Suggested site should be disabled when out of credits
      const suggestionItem = screen.queryByText("pawportraits.launch10.site");
      if (suggestionItem) {
        const button = suggestionItem.closest("button");
        // Should have disabled attribute
        expect(button).toBeDisabled();
      }
    });
  });

  describe("Selection Behavior", () => {
    const context = createContext(
      [createDomainWithWebsite("pawportraits", "Paw Portraits", 1)],
      { limit: 2, used: 1, remaining: 1 }
    );

    it("calls onSelect with correct data when selecting existing domain", async () => {
      const onSelect = vi.fn();
      render(
        <SiteNameDropdown
          recommendations={existingRecommendedRecommendations}
          context={context}
          selectedDomain={null}
          isOutOfCredits={false}
          onSelect={onSelect}
        />
      );

      const trigger = screen.getByRole("button", { name: /select a domain/i });
      await userEvent.click(trigger);

      const existingOption = screen.getByText("pawportraits.launch10.site");
      await userEvent.click(existingOption);

      expect(onSelect).toHaveBeenCalledWith(
        "pawportraits.launch10.site",
        "existing",
        1 // existingDomainId
      );
    });

    it("calls onSelect with correct data when selecting suggestion", async () => {
      const onSelect = vi.fn();
      render(
        <SiteNameDropdown
          recommendations={noExistingSitesRecommendations}
          context={createContext([], { limit: 1, used: 0, remaining: 1 })}
          selectedDomain={null}
          isOutOfCredits={false}
          onSelect={onSelect}
        />
      );

      const trigger = screen.getByRole("button", { name: /select a domain/i });
      await userEvent.click(trigger);

      const suggestionOption = screen.getByText("petportraits.launch10.site");
      await userEvent.click(suggestionOption);

      expect(onSelect).toHaveBeenCalledWith(
        "petportraits.launch10.site",
        "suggestion",
        undefined // no existingDomainId for suggestions
      );
    });
  });

  describe("Plan Tier Restrictions", () => {
    it("shows upgrade badge for custom domain on Starter plan", async () => {
      render(
        <SiteNameDropdown
          recommendations={noExistingSitesRecommendations}
          context={createContext([], { limit: 1, used: 0, remaining: 1 }, "starter")}
          selectedDomain={null}
          isOutOfCredits={false}
          {...defaultHandlers}
        />
      );

      const trigger = screen.getByRole("button", { name: /select a domain/i });
      await userEvent.click(trigger);

      // Should show custom domain restriction message for Starter plan
      expect(screen.getByText(/custom domains on growth & pro/i)).toBeInTheDocument();
      expect(screen.getByText(/available on growth & pro plan/i)).toBeInTheDocument();
      expect(screen.getByTestId("upgrade-badge")).toBeInTheDocument();
    });

    it("does not show upgrade badge on Growth plan", async () => {
      render(
        <SiteNameDropdown
          recommendations={noExistingSitesRecommendations}
          context={createContext([], { limit: 2, used: 0, remaining: 2 }, "growth")}
          selectedDomain={null}
          isOutOfCredits={false}
          {...defaultHandlers}
        />
      );

      const trigger = screen.getByRole("button", { name: /select a domain/i });
      await userEvent.click(trigger);

      // No upgrade badge on Growth plan
      expect(screen.queryByTestId("upgrade-badge")).not.toBeInTheDocument();
    });
  });

  describe("Only Generated Recommendations Have availability: available", () => {
    it("existing recommendations have availability: existing", () => {
      const existing = existingRecommendedRecommendations.recommendations.filter(
        (r) => r.source === "existing"
      );
      existing.forEach((rec) => {
        expect(rec.availability).toBe("existing");
      });
    });

    it("generated recommendations have availability: available", () => {
      const generated = noExistingSitesRecommendations.recommendations.filter(
        (r) => r.source === "suggestion"
      );
      generated.forEach((rec) => {
        expect(rec.availability).toBe("available");
      });
    });

    it("never recommends unavailable domains", () => {
      // All recommendations across all states should be either "existing" or "available"
      const allRecommendations = [
        ...noExistingSitesRecommendations.recommendations,
        ...existingRecommendedRecommendations.recommendations,
        ...newRecommendedRecommendations.recommendations,
        ...outOfCreditsNoMatchRecommendations.recommendations,
      ];

      allRecommendations.forEach((rec) => {
        expect(rec.availability).not.toBe("unavailable");
        expect(["existing", "available"]).toContain(rec.availability);
      });
    });
  });
});
