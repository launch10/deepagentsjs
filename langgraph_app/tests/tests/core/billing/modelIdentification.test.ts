import { describe, it, expect } from "vitest";
import { AIMessage } from "@langchain/core/messages";
import { usageTracker } from "@core/billing";

/**
 * MODEL IDENTIFICATION TESTS - BILLING CRITICAL
 *
 * These tests verify that the usage tracker correctly identifies models for billing.
 *
 * The critical scenario: Some providers don't include model info in response_metadata.
 * Without the _modelCard fallback, we'd bill these as "unknown" and lose revenue.
 *
 * With the fix:
 * - getLLM() passes _modelCard through config metadata
 * - Tracker uses _modelCard first (guaranteed to match our cost config)
 * - Falls back to response_metadata if _modelCard not available
 */

describe("Model Identification for Billing", () => {
  /**
   * Helper to call the private extractUsageRecord method via handleLLMEnd
   * We capture the result by inspecting what would be pushed to the context
   */
  function extractModelFromTracker(
    responseMetadata: Record<string, unknown>,
    configMetadata?: Record<string, unknown>
  ): string {
    // Create a minimal AIMessage with usage_metadata and response_metadata
    const message = new AIMessage({
      content: "test response",
      additional_kwargs: {},
      response_metadata: responseMetadata,
    });

    // Add usage_metadata to the message (required for extraction)
    (message as any).usage_metadata = {
      input_tokens: 100,
      output_tokens: 50,
    };

    // Access the private method via any cast
    // This mirrors what happens in handleLLMEnd
    const tracker = usageTracker as any;
    const record = tracker.extractUsageRecord(
      "test-run-id",
      message,
      {}, // llmOutput
      "test-langchain-run-id",
      undefined, // parentLangchainRunId
      [], // tags
      configMetadata ? { metadata: configMetadata } : undefined // extraParams
    );

    return record.model;
  }

  describe("CRITICAL: _modelCard fallback prevents 'unknown' billing", () => {
    it("returns 'unknown' when response has no model info and no _modelCard", () => {
      // Scenario: Provider returns empty response_metadata
      // Without _modelCard, we can't identify the model for billing
      const model = extractModelFromTracker(
        {}, // No model info in response
        undefined // No config metadata
      );

      expect(model).toBe("unknown");
    });

    it("uses _modelCard when response has no model info", () => {
      // Scenario: Provider returns empty response_metadata
      // But we have _modelCard from getLLM() - billing works!
      const model = extractModelFromTracker(
        {}, // No model info in response
        { _modelCard: "claude-sonnet-4-5" } // From getLLM()
      );

      expect(model).toBe("claude-sonnet-4-5");
    });

    it("prefers _modelCard over response_metadata (guaranteed to match cost config)", () => {
      // Scenario: Provider returns model with date suffix
      // _modelCard is the canonical name that matches our cost config
      const model = extractModelFromTracker(
        { model: "claude-sonnet-4-5-20251215" }, // Provider's versioned name
        { _modelCard: "claude-sonnet-4-5" } // Our canonical name
      );

      // Should use _modelCard because it's guaranteed to match cost lookup
      expect(model).toBe("claude-sonnet-4-5");
    });
  });

  describe("Response metadata fallback (for direct LLM usage)", () => {
    it("uses model_name from response when _modelCard not available (OpenAI style)", () => {
      const model = extractModelFromTracker(
        { model_name: "gpt-5-mini" },
        undefined // No config metadata (direct LLM usage)
      );

      expect(model).toBe("gpt-5-mini");
    });

    it("uses model from response when _modelCard not available (Anthropic style)", () => {
      const model = extractModelFromTracker(
        { model: "claude-haiku-4-5" },
        undefined // No config metadata
      );

      expect(model).toBe("claude-haiku-4-5");
    });

    it("prefers model_name over model (OpenAI convention)", () => {
      const model = extractModelFromTracker(
        {
          model_name: "gpt-5-mini",
          model: "gpt-5-mini-2025" // Less specific
        },
        undefined
      );

      expect(model).toBe("gpt-5-mini");
    });
  });

  describe("Real-world scenarios that would have failed without _modelCard", () => {
    it("handles provider that returns model info in unexpected location", () => {
      // Some providers might put model info in nested objects or weird keys
      const model = extractModelFromTracker(
        {
          // No model or model_name at top level
          headers: { "x-model": "some-model" },
          meta: { modelId: "another-model" }
        },
        { _modelCard: "claude-sonnet-4-5" }
      );

      // Without _modelCard this would be "unknown"
      expect(model).toBe("claude-sonnet-4-5");
    });

    it("handles provider that returns null/undefined model", () => {
      const model = extractModelFromTracker(
        {
          model: null,
          model_name: undefined
        },
        { _modelCard: "gpt-5-mini" }
      );

      expect(model).toBe("gpt-5-mini");
    });

    it("handles provider that returns empty string model", () => {
      const model = extractModelFromTracker(
        {
          model: "",
          model_name: ""
        },
        { _modelCard: "claude-haiku-4-5" }
      );

      // Empty strings are falsy, so _modelCard wins
      expect(model).toBe("claude-haiku-4-5");
    });
  });
});
