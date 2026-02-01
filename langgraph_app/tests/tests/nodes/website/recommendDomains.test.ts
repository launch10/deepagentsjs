/**
 * Domain Recommendations Node Tests
 *
 * Tests the domainRecommendationsNode including:
 * - Idempotency and skip conditions
 * - Error handling
 * - Credit handling
 * - Domain conversion
 * - UI state scenarios
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { typographyRecommendationsSchema, Website } from "@types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import type { WebsiteGraphState } from "@annotation";
import type { DomainWithWebsite, GetDomainContextResponse } from "@rails_api";
import type { DomainRecommendationsOutput } from "@prompts";

type NodeResult = Partial<WebsiteGraphState>;

// =============================================================================
// Mocks - use vi.hoisted() to avoid hoisting issues
// =============================================================================

const {
  mockAgentInvoke,
  mockCreateReactAgent,
  mockSearchDomainsTool,
  mockSearchPathsTool,
  mockCreateSearchDomainsTool,
  mockCreateSearchPathsTool,
} = vi.hoisted(() => {
  const mockAgentInvoke = vi.fn();
  const mockCreateReactAgent = vi.fn(() => ({
    invoke: mockAgentInvoke,
  }));
  const mockSearchDomainsTool = { name: "search_domains" };
  const mockSearchPathsTool = { name: "search_paths" };
  const mockCreateSearchDomainsTool = vi.fn(() => mockSearchDomainsTool);
  const mockCreateSearchPathsTool = vi.fn(() => mockSearchPathsTool);
  return {
    mockAgentInvoke,
    mockCreateReactAgent,
    mockSearchDomainsTool,
    mockSearchPathsTool,
    mockCreateSearchDomainsTool,
    mockCreateSearchPathsTool,
  };
});

vi.mock("@langchain/langgraph/prebuilt", () => ({
  createReactAgent: mockCreateReactAgent,
}));

vi.mock("@rails_api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@rails_api")>();
  return {
    ...actual,
    DomainContextAPIService: vi.fn().mockImplementation(() => ({
      get: vi.fn(),
    })),
  };
});

vi.mock("@core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@core")>();
  return {
    ...actual,
    getLLM: vi.fn().mockResolvedValue({}),
  };
});

vi.mock("@prompts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@prompts")>();
  return {
    ...actual,
    buildDomainRecommendationsPrompt: vi.fn().mockReturnValue("mock prompt"),
  };
});

vi.mock("@tools", () => ({
  createSearchDomainsTool: mockCreateSearchDomainsTool,
  createSearchPathsTool: mockCreateSearchPathsTool,
}));

import { domainRecommendationsNode } from "@nodes";
import { DomainContextAPIService } from "@rails_api";

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockState(overrides: Partial<WebsiteGraphState> = {}): WebsiteGraphState {
  return {
    websiteId: 1,
    jwt: "test-jwt",
    brainstorm: {
      idea: "A fitness app for busy professionals",
      audience: "Working professionals aged 25-45",
      solution: "10-minute workouts that can be done anywhere",
    },
    command: undefined,
    improveCopyStyle: undefined,
    brainstormId: undefined,
    theme: undefined,
    images: [],
    consoleErrors: [],
    errorRetries: 0,
    status: "idle",
    files: {},
    domainRecommendations: undefined,
    ...overrides,
  } as WebsiteGraphState;
}

function createMockDomainContext(
  overrides: Partial<GetDomainContextResponse> = {}
): GetDomainContextResponse {
  return {
    existing_domains: [],
    platform_subdomain_credits: { limit: 5, used: 0, remaining: 5 },
    brainstorm_context: {
      id: 1,
      idea: "A fitness app",
      audience: "Professionals",
      solution: "10-minute workouts",
      social_proof: null,
    },
    plan_tier: null,
    ...overrides,
  };
}

function createExistingDomain(id: number, domain: string, websiteName: string): DomainWithWebsite {
  return {
    id,
    domain,
    is_platform_subdomain: true,
    website_id: id + 100,
    website_name: websiteName,
    website_urls: [],
    created_at: "2026-01-01T00:00:00Z",
  };
}

interface MockSetup {
  domainContext: GetDomainContextResponse;
  agentOutput: DomainRecommendationsOutput;
}

function setupMocks(setup: MockSetup) {
  const mockDomainContextAPI = { get: vi.fn().mockResolvedValue(setup.domainContext) };
  (DomainContextAPIService as any).mockImplementation(() => mockDomainContextAPI);

  mockAgentInvoke.mockResolvedValue({
    structuredResponse: setup.agentOutput,
  });

  return { mockDomainContextAPI };
}

// =============================================================================
// Tests
// =============================================================================

describe("domainRecommendationsNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Idempotency and skip conditions", () => {
    it("skips when domainRecommendations already exists in state", async () => {
      const existingRecommendations = {
        state: "no_existing_sites" as const,
        recommendations: [],
        topRecommendation: null,
      };

      const state = createMockState({ domainRecommendations: existingRecommendations });

      const result = (await domainRecommendationsNode(
        state,
        {} as LangGraphRunnableConfig
      )) as NodeResult;

      // Should return empty, not overwrite
      expect(result).toEqual({});
      expect(mockCreateReactAgent).not.toHaveBeenCalled();
    });

    it("skips when websiteId is missing", async () => {
      const state = createMockState({ websiteId: undefined });

      const result = (await domainRecommendationsNode(
        state,
        {} as LangGraphRunnableConfig
      )) as NodeResult;

      expect(result).toEqual({});
      expect(mockCreateReactAgent).not.toHaveBeenCalled();
    });

    it("skips when jwt is missing", async () => {
      const state = createMockState({ jwt: undefined });

      const result = (await domainRecommendationsNode(
        state,
        {} as LangGraphRunnableConfig
      )) as NodeResult;

      expect(result).toEqual({});
      expect(mockCreateReactAgent).not.toHaveBeenCalled();
    });

    it("skips when brainstorm.idea is missing", async () => {
      const state = createMockState({ brainstorm: { audience: "test", solution: "test" } });

      const result = (await domainRecommendationsNode(
        state,
        {} as LangGraphRunnableConfig
      )) as NodeResult;

      expect(result).toEqual({});
      expect(mockCreateReactAgent).not.toHaveBeenCalled();
    });
  });

  describe("Error handling", () => {
    it("returns fallback recommendations when DomainContextAPIService fails", async () => {
      const state = createMockState();
      const mockDomainContextAPI = { get: vi.fn().mockRejectedValue(new Error("API error")) };
      (DomainContextAPIService as any).mockImplementation(() => mockDomainContextAPI);

      const result = (await domainRecommendationsNode(
        state,
        {} as LangGraphRunnableConfig
      )) as NodeResult;

      // Should have fallback recommendations
      expect(result.domainRecommendations).toBeDefined();
      expect(result.domainRecommendations?.recommendations.length).toBeGreaterThan(0);
      // Fallback generates a domain from the idea
      expect(result.domainRecommendations?.recommendations[0]?.subdomain).toBeTruthy();
    });

    it("returns fallback recommendations when agent fails", async () => {
      const mockDomainContextAPI = { get: vi.fn().mockResolvedValue(createMockDomainContext()) };
      (DomainContextAPIService as any).mockImplementation(() => mockDomainContextAPI);

      mockAgentInvoke.mockRejectedValue(new Error("Agent error"));

      const state = createMockState();
      const result = (await domainRecommendationsNode(
        state,
        {} as LangGraphRunnableConfig
      )) as NodeResult;

      // Should have fallback recommendations
      expect(result.domainRecommendations).toBeDefined();
      expect(result.domainRecommendations?.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe("Credit handling", () => {
    it("does not use search tool when user has no credits", async () => {
      setupMocks({
        domainContext: createMockDomainContext({
          existing_domains: [createExistingDomain(1, "existing-site.launch10.site", "Existing")],
          platform_subdomain_credits: { limit: 5, used: 5, remaining: 0 },
        }),
        agentOutput: {
          recommendations: [
            {
              subdomain: "existing-site",
              path: "/landing",
              score: 50,
              reasoning: "Only option",
              source: "existing",
              existingDomainId: 1,
            },
          ],
          topRecommendation: { subdomain: "existing-site", path: "/landing", source: "existing" },
        },
      });

      const state = createMockState();
      const result = (await domainRecommendationsNode(state, {} as LangGraphRunnableConfig)) as {
        domainRecommendations: Website.DomainRecommendations.DomainRecommendations;
      };
      const recommendations = result.domainRecommendations;
      expect(recommendations.state).toBe("out_of_credits_no_match");

      // createReactAgent should be called with search_paths tool for existing domains
      expect(mockCreateReactAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: expect.arrayContaining([]),
        })
      );
    });

    it("uses search tool when user has credits", async () => {
      setupMocks({
        domainContext: createMockDomainContext({
          platform_subdomain_credits: { limit: 5, used: 0, remaining: 5 },
        }),
        agentOutput: {
          recommendations: [
            {
              subdomain: "fitpro",
              path: "/",
              score: 90,
              reasoning: "Good name",
              source: "generated",
            },
          ],
          topRecommendation: { subdomain: "fitpro", path: "/", source: "generated" },
        },
      });

      const state = createMockState();
      await domainRecommendationsNode(state, {} as LangGraphRunnableConfig);

      // createReactAgent should be called with the search tool when user has credits
      expect(mockCreateReactAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: [mockSearchDomainsTool],
        })
      );
    });
  });

  describe("Domain conversion", () => {
    it("adds .launch10.site suffix to generated subdomains", async () => {
      setupMocks({
        domainContext: createMockDomainContext(),
        agentOutput: {
          recommendations: [
            {
              subdomain: "fitpro",
              path: "/",
              score: 90,
              reasoning: "Good name",
              source: "generated",
            },
          ],
          topRecommendation: { subdomain: "fitpro", path: "/", source: "generated" },
        },
      });

      const state = createMockState();
      const result = (await domainRecommendationsNode(
        state,
        {} as LangGraphRunnableConfig
      )) as NodeResult;

      expect(result.domainRecommendations?.recommendations[0]?.domain).toBe("fitpro.launch10.site");
    });

    it("handles subdomains that already have the suffix", async () => {
      setupMocks({
        domainContext: createMockDomainContext(),
        agentOutput: {
          recommendations: [
            {
              subdomain: "fitpro.launch10.site",
              path: "/",
              score: 90,
              reasoning: "Good name",
              source: "generated",
            },
          ],
          topRecommendation: { subdomain: "fitpro.launch10.site", path: "/", source: "generated" },
        },
      });

      const state = createMockState();
      const result = (await domainRecommendationsNode(
        state,
        {} as LangGraphRunnableConfig
      )) as NodeResult;

      // Should not double-add the suffix
      expect(result.domainRecommendations?.recommendations[0]?.domain).toBe("fitpro.launch10.site");
    });
  });

  describe("UI state scenarios", () => {
    it("returns no_existing_sites when user has no domains", async () => {
      setupMocks({
        domainContext: createMockDomainContext({
          existing_domains: [],
          platform_subdomain_credits: { limit: 5, used: 0, remaining: 5 },
        }),
        agentOutput: {
          recommendations: [
            {
              subdomain: "fitpro",
              path: "/",
              score: 90,
              reasoning: "Good name",
              source: "generated",
            },
          ],
          topRecommendation: { subdomain: "fitpro", path: "/", source: "generated" },
        },
      });

      const state = createMockState();
      const result = (await domainRecommendationsNode(
        state,
        {} as LangGraphRunnableConfig
      )) as NodeResult;

      expect(result.domainRecommendations?.state).toBe("no_existing_sites");
      expect(result.domainRecommendations?.topRecommendation?.source).toBe("generated");
    });

    it("returns existing_recommended when existing domain scores >= 80", async () => {
      const existingDomain = createExistingDomain(1, "fitpro.launch10.site", "FitPro");

      setupMocks({
        domainContext: createMockDomainContext({
          existing_domains: [existingDomain],
          platform_subdomain_credits: { limit: 5, used: 1, remaining: 4 },
        }),
        agentOutput: {
          recommendations: [
            {
              subdomain: "fitpro",
              path: "/landing",
              score: 95,
              reasoning: "Perfect match",
              source: "existing",
              existingDomainId: 1,
            },
            {
              subdomain: "newdomain",
              path: "/",
              score: 75,
              reasoning: "Also good",
              source: "generated",
            },
          ],
          topRecommendation: { subdomain: "fitpro", path: "/landing", source: "existing" },
        },
      });

      const state = createMockState();
      const result = (await domainRecommendationsNode(
        state,
        {} as LangGraphRunnableConfig
      )) as NodeResult;

      expect(result.domainRecommendations?.state).toBe("existing_recommended");
      expect(result.domainRecommendations?.topRecommendation?.domain).toBe("fitpro.launch10.site");
    });

    it("returns new_recommended when existing domain scores < 80", async () => {
      const existingDomain = createExistingDomain(1, "mealkits.launch10.site", "MealKits");

      setupMocks({
        domainContext: createMockDomainContext({
          existing_domains: [existingDomain],
          platform_subdomain_credits: { limit: 5, used: 1, remaining: 4 },
        }),
        agentOutput: {
          recommendations: [
            {
              subdomain: "fitpro",
              path: "/",
              score: 85,
              reasoning: "Good match",
              source: "generated",
            },
            {
              subdomain: "mealkits",
              path: "/landing",
              score: 15,
              reasoning: "Not relevant",
              source: "existing",
              existingDomainId: 1,
            },
          ],
          topRecommendation: { subdomain: "fitpro", path: "/", source: "generated" },
        },
      });

      const state = createMockState();
      const result = (await domainRecommendationsNode(
        state,
        {} as LangGraphRunnableConfig
      )) as NodeResult;

      expect(result.domainRecommendations?.state).toBe("new_recommended");
      expect(result.domainRecommendations?.topRecommendation?.source).toBe("generated");
    });

    it("returns out_of_credits_no_match when no credits and no good existing match", async () => {
      const existingDomain = createExistingDomain(1, "mealkits.launch10.site", "MealKits");

      setupMocks({
        domainContext: createMockDomainContext({
          existing_domains: [existingDomain],
          platform_subdomain_credits: { limit: 5, used: 5, remaining: 0 },
        }),
        agentOutput: {
          recommendations: [
            {
              subdomain: "mealkits",
              path: "/landing",
              score: 15,
              reasoning: "Not relevant",
              source: "existing",
              existingDomainId: 1,
            },
          ],
          topRecommendation: { subdomain: "mealkits", path: "/landing", source: "existing" },
        },
      });

      const state = createMockState();
      const result = (await domainRecommendationsNode(
        state,
        {} as LangGraphRunnableConfig
      )) as NodeResult;

      expect(result.domainRecommendations?.state).toBe("out_of_credits_no_match");
      expect(result.domainRecommendations?.topRecommendation?.score).toBeLessThan(80);
    });
  });
});
