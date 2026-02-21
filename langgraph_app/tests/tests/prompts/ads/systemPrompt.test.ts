import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "@prompts";
import { type AdsGraphState } from "@state";
import { type LangGraphRunnableConfig } from "@types";

const makeBrainstorm = (overrides = {}) => ({
  idea: "A scheduling tool for remote teams",
  audience: "Remote workers aged 25-45",
  solution: "AI-powered calendar coordination",
  socialProof: "Used by 500+ teams",
  ...overrides,
});

const makeState = (overrides: Partial<AdsGraphState> = {}): AdsGraphState =>
  ({
    brainstorm: makeBrainstorm(),
    stage: "content",
    messages: [],
    ...overrides,
  }) as AdsGraphState;

const fakeConfig = {} as LangGraphRunnableConfig;

describe("buildSystemPrompt", () => {
  it("is deterministic — same state produces the same string", async () => {
    const state = makeState();
    const prompt1 = await buildSystemPrompt(state, fakeConfig);
    const prompt2 = await buildSystemPrompt(state, fakeConfig);
    expect(prompt1).toBe(prompt2);
  });

  it("includes business context fields", async () => {
    const state = makeState();
    const prompt = await buildSystemPrompt(state, fakeConfig);

    expect(prompt).toContain("A scheduling tool for remote teams");
    expect(prompt).toContain("Remote workers aged 25-45");
    expect(prompt).toContain("AI-powered calendar coordination");
    expect(prompt).toContain("Used by 500+ teams");
  });

  it("includes behavior rules", async () => {
    const state = makeState();
    const prompt = await buildSystemPrompt(state, fakeConfig);

    expect(prompt).toContain("<behavior>");
    expect(prompt).toContain("brief intro");
    expect(prompt).toContain("JSON code block");
    expect(prompt).toContain("faq tool");
  });

  describe("content stages — carries asset instructions and output format", () => {
    it("includes asset instructions for content stage", async () => {
      const state = makeState({ stage: "content" });
      const prompt = await buildSystemPrompt(state, fakeConfig);

      expect(prompt).toContain("<asset_generation_instructions>");
      expect(prompt).toContain("Headlines");
      expect(prompt).toContain("Descriptions");
      expect(prompt).toContain("headlines and descriptions page");
      expect(prompt).toContain("ONLY headlines and descriptions");
    });

    it("includes asset instructions for highlights stage", async () => {
      const state = makeState({ stage: "highlights" });
      const prompt = await buildSystemPrompt(state, fakeConfig);

      expect(prompt).toContain("<asset_generation_instructions>");
      expect(prompt).toContain("callouts and structured snippets page");
      expect(prompt).toContain("ONLY callouts and structured snippets");
    });

    it("includes asset instructions for keywords stage", async () => {
      const state = makeState({ stage: "keywords" });
      const prompt = await buildSystemPrompt(state, fakeConfig);

      expect(prompt).toContain("<asset_generation_instructions>");
      expect(prompt).toContain("keywords page");
      expect(prompt).toContain("ONLY keywords");
    });

    it("includes output format example", async () => {
      const state = makeState({ stage: "content" });
      const prompt = await buildSystemPrompt(state, fakeConfig);

      expect(prompt).toContain("```json");
    });
  });

  describe("non-content stages — no asset instructions", () => {
    it("does not include asset instructions for settings stage", async () => {
      const state = makeState({ stage: "settings" });
      const prompt = await buildSystemPrompt(state, fakeConfig);

      expect(prompt).not.toContain("<asset_generation_instructions>");
      expect(prompt).not.toContain("```json");
      expect(prompt).toContain("campaign settings page");
      expect(prompt).toContain("not an asset generation page");
    });

    it("does not include asset instructions for launch stage", async () => {
      const state = makeState({ stage: "launch" });
      const prompt = await buildSystemPrompt(state, fakeConfig);

      expect(prompt).not.toContain("<asset_generation_instructions>");
      expect(prompt).toContain("review page");
    });
  });

  it("handles missing brainstorm data gracefully", async () => {
    const state = makeState({ brainstorm: undefined });
    const prompt = await buildSystemPrompt(state, fakeConfig);

    expect(prompt).toContain("<business_context>");
    expect(typeof prompt).toBe("string");
  });

  it("varies with different brainstorm data", async () => {
    const state1 = makeState({ brainstorm: makeBrainstorm({ idea: "Pet photography studio" }) });
    const state2 = makeState({ brainstorm: makeBrainstorm({ idea: "Online bakery" }) });

    const prompt1 = await buildSystemPrompt(state1, fakeConfig);
    const prompt2 = await buildSystemPrompt(state2, fakeConfig);

    expect(prompt1).not.toBe(prompt2);
    expect(prompt1).toContain("Pet photography studio");
    expect(prompt2).toContain("Online bakery");
  });

  it("varies by page — content vs keywords produce different prompts", async () => {
    const contentPrompt = await buildSystemPrompt(makeState({ stage: "content" }), fakeConfig);
    const keywordsPrompt = await buildSystemPrompt(makeState({ stage: "keywords" }), fakeConfig);

    expect(contentPrompt).not.toBe(keywordsPrompt);
    expect(contentPrompt).toContain("headlines and descriptions page");
    expect(keywordsPrompt).toContain("keywords page");
    // Asset instructions differ per stage
    expect(contentPrompt).toContain("ONLY headlines and descriptions");
    expect(keywordsPrompt).toContain("ONLY keywords");
  });
});
