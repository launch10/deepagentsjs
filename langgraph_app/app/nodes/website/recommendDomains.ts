import { type WebsiteGraphState } from "@annotation";
import { NodeMiddleware } from "@middleware";
import { DomainContextAPIService, ContextAPIService, type DomainWithWebsite } from "@rails_api";
import { getLLM, getLogger } from "@core";
import type { Website } from "@types";
import {
  buildDomainRecommendationsPrompt,
  domainRecommendationsOutputSchema,
  type BrainstormContext,
  type DomainRecommendationsOutput,
} from "@prompts";
import { createSearchDomainsTool, createSearchWebsiteUrlsTool } from "@tools";
import { HumanMessage } from "@langchain/core/messages";
import { createAgent } from "langchain";
import type { DynamicStructuredTool } from "@langchain/core/tools";

type AnyTool = DynamicStructuredTool<any, any, any, string>;

const SCORE_THRESHOLD = 80;
const PLATFORM_DOMAIN_SUFFIX = ".launch10.site";

/**
 * Domain recommendations node for the website graph.
 * Runs in parallel with websiteBuilder after buildContext.
 * Idempotent: skips if domainRecommendations already exists in state.
 *
 * Uses a simple agent loop with a domain search tool to:
 * 1. Evaluate existing domains (if any)
 * 2. Search for available new subdomains (if user has credits)
 * 3. Return top 3 recommendations
 */
export const domainRecommendationsNode = NodeMiddleware.use(
  {},
  async (state: WebsiteGraphState): Promise<Partial<WebsiteGraphState>> => {
    // Idempotent: skip if already computed
    if (state.domainRecommendations) {
      getLogger({ component: "domainRecommendations" }).debug("Skipping - already computed");
      return {};
    }

    if (state.messages.length > 0) {
      getLogger({ component: "domainRecommendations" }).debug("Skipping - messages already exist");
      return {};
    }

    if (!state.websiteId) {
      getLogger({ component: "domainRecommendations" }).debug("Skipping - no websiteId");
      return {};
    }

    if (!state.jwt) {
      getLogger({ component: "domainRecommendations" }).debug("Skipping - no jwt");
      return {};
    }

    try {
      getLogger({ component: "domainRecommendations" }).info("Starting domain recommendations");

      // Fetch brainstorm context from Rails
      const contextAPI = new ContextAPIService({ jwt: state.jwt });
      const context = await contextAPI.get(state.websiteId);

      if (!context.brainstorm?.idea) {
        getLogger({ component: "domainRecommendations" }).debug("Skipping - no brainstorm context");
        return {};
      }

      // Fetch domain context from Rails (existing domains, credits)
      const domainContextAPI = new DomainContextAPIService({ jwt: state.jwt });
      const domainContext = await domainContextAPI.get(state.websiteId);

      const brainstormContext: BrainstormContext = {
        idea: context.brainstorm.idea ?? "",
        audience: context.brainstorm.audience ?? "",
        solution: context.brainstorm.solution ?? "",
      };

      // Build the system prompt with all context
      const systemPrompt = buildDomainRecommendationsPrompt({
        brainstorm: brainstormContext,
        existingDomains: domainContext.existing_domains,
        credits: domainContext.platform_subdomain_credits,
      });

      // Get LLM and set up tools
      const llm = await getLLM({ skill: "writing", speed: "slow" });
      const hasCredits = domainContext.platform_subdomain_credits.remaining > 0;
      const hasExistingDomains = domainContext.existing_domains.length > 0;

      // Build tools array based on context:
      // - search_domains: always provided so AI can suggest available subdomains
      //   (even when out of credits - UI will show them as disabled)
      // - search_website_urls: for checking path availability on existing domains
      const tools: AnyTool[] = [createSearchDomainsTool(state.jwt)];
      if (hasExistingDomains) {
        tools.push(createSearchWebsiteUrlsTool(state.jwt));
      }

      // Create and run the agent
      const agent = createAgent({
        model: llm,
        tools,
        systemPrompt,
        responseFormat: domainRecommendationsOutputSchema,
      });

      const result = await agent.invoke({
        messages: [new HumanMessage({ content: "Please generate recommendations for me." })],
      });
      const structuredResponse = result.structuredResponse;

      // Convert agent output to domain recommendations format
      const recommendations = convertToRecommendations(
        structuredResponse,
        domainContext.existing_domains,
        hasCredits
      );

      getLogger({ component: "domainRecommendations" }).info(
        { state: recommendations.state },
        "Completed domain recommendations"
      );
      return { domainRecommendations: recommendations };
    } catch (error) {
      getLogger({ component: "domainRecommendations" }).error(
        { err: error },
        "Domain recommendations error"
      );
      // On error, return fallback recommendations
      const fallback = getFallbackRecommendations("my-site", []);
      return { domainRecommendations: fallback };
    }
  }
);

/**
 * Convert agent output to the DomainRecommendations format expected by the UI.
 */
function convertToRecommendations(
  output: DomainRecommendationsOutput,
  existingDomains: DomainWithWebsite[],
  hasCreditsRemaining: boolean
): Website.DomainRecommendations.DomainRecommendations {
  const recommendations: Website.DomainRecommendations.DomainRecommendation[] =
    output.recommendations.map((rec) => {
      const domain = rec.subdomain.includes(".")
        ? rec.subdomain
        : `${rec.subdomain}${PLATFORM_DOMAIN_SUFFIX}`;

      // Normalize path - ensure it starts with /
      const path = rec.path?.startsWith("/") ? rec.path : `/${rec.path || ""}`;
      const normalizedPath = path === "/" ? "" : path;

      // Look up existingDomainId from the actual domain data — the LLM can't know DB IDs
      const matchingDomain =
        rec.source === "existing" ? existingDomains.find((d) => d.domain === domain) : undefined;

      return {
        domain,
        subdomain: rec.subdomain.replace(PLATFORM_DOMAIN_SUFFIX, ""),
        path: path || "/",
        fullUrl: `${domain}${normalizedPath}`,
        score: rec.score,
        reasoning: rec.reasoning,
        source: rec.source,
        existingDomainId: matchingDomain?.id,
        availability: rec.source === "existing" ? ("existing" as const) : ("available" as const),
      };
    });

  // Determine UI state and top recommendation
  return determineState(recommendations, existingDomains.length > 0, hasCreditsRemaining);
}

function determineState(
  recommendations: Website.DomainRecommendations.DomainRecommendation[],
  hasExistingDomains: boolean,
  hasCreditsRemaining: boolean
): Website.DomainRecommendations.DomainRecommendations {
  const existingRecs = recommendations.filter((r) => r.source === "existing");
  const suggestionRecs = recommendations.filter((r) => r.source === "suggestion");

  const highestExisting = existingRecs.sort((a, b) => b.score - a.score)[0];
  const highestSuggestion = suggestionRecs.sort((a, b) => b.score - a.score)[0];

  const hasGoodExistingMatch = highestExisting && highestExisting.score >= SCORE_THRESHOLD;

  let state: Website.DomainRecommendations.UIState;
  let topRecommendation: Website.DomainRecommendations.DomainRecommendation | null;

  if (!hasExistingDomains) {
    state = "no_existing_sites";
    topRecommendation = highestSuggestion ?? null;
  } else if (hasGoodExistingMatch) {
    // Good existing match takes priority - even if out of credits
    state = "existing_recommended";
    topRecommendation = highestExisting ?? null;
  } else if (!hasCreditsRemaining) {
    // No good existing match AND out of credits
    state = "out_of_credits_no_match";
    topRecommendation = highestExisting ?? null;
  } else {
    // No good existing match but has credits for new domains
    state = "new_recommended";
    topRecommendation = highestSuggestion ?? highestExisting ?? null;
  }

  return {
    state,
    recommendations,
    topRecommendation,
  };
}

function getFallbackRecommendations(
  idea: string,
  existingDomains: DomainWithWebsite[]
): Website.DomainRecommendations.DomainRecommendations {
  const slug = idea
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 30);

  const domain = `${slug}${PLATFORM_DOMAIN_SUFFIX}`;
  const recommendations: Website.DomainRecommendations.DomainRecommendation[] = [
    {
      domain,
      subdomain: slug,
      path: "/",
      fullUrl: domain,
      score: 50,
      source: "suggestion",
      availability: "unknown",
      reasoning: "Suggested based on your business idea",
    },
  ];

  for (const existingDomain of existingDomains) {
    recommendations.push({
      domain: existingDomain.domain,
      subdomain: existingDomain.domain.replace(PLATFORM_DOMAIN_SUFFIX, ""),
      path: "/landing",
      fullUrl: `${existingDomain.domain}/landing`,
      score: 50,
      source: "existing",
      existingDomainId: existingDomain.id, // Domain ID is in the `id` field
      availability: "existing",
      reasoning: "Your existing domain",
    });
  }

  return {
    state: existingDomains.length === 0 ? "no_existing_sites" : "new_recommended",
    recommendations,
    topRecommendation: recommendations[0] ?? null,
  };
}
