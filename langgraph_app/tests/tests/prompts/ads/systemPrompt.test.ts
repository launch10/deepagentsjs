import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "@prompts";
import { type AdsGraphState } from "@state";

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

describe("buildSystemPrompt", () => {
  it("is deterministic — same brainstorm data produces the same string", () => {
    const state = makeState();
    const prompt1 = buildSystemPrompt(state);
    const prompt2 = buildSystemPrompt(state);
    expect(prompt1).toBe(prompt2);
  });

  it("includes business context fields", () => {
    const state = makeState();
    const prompt = buildSystemPrompt(state);

    expect(prompt).toContain("A scheduling tool for remote teams");
    expect(prompt).toContain("Remote workers aged 25-45");
    expect(prompt).toContain("AI-powered calendar coordination");
    expect(prompt).toContain("Used by 500+ teams");
  });

  it("includes behavior rules", () => {
    const state = makeState();
    const prompt = buildSystemPrompt(state);

    expect(prompt).toContain("<behavior>");
    expect(prompt).toContain("brief intro");
    expect(prompt).toContain("JSON code block");
    expect(prompt).toContain("faq tool");
  });

  it("does NOT include per-turn details like char limits or output formats", () => {
    const state = makeState();
    const prompt = buildSystemPrompt(state);

    expect(prompt).not.toContain("characters or less");
    expect(prompt).not.toContain("```json");
    expect(prompt).not.toContain("<asset_instructions>");
    expect(prompt).not.toContain("<example_response>");
  });

  it("handles missing brainstorm data gracefully", () => {
    const state = makeState({ brainstorm: undefined });
    const prompt = buildSystemPrompt(state);

    expect(prompt).toContain("<business_context>");
    // Should not throw
    expect(typeof prompt).toBe("string");
  });

  it("varies with different brainstorm data", () => {
    const state1 = makeState({ brainstorm: makeBrainstorm({ idea: "Pet photography studio" }) });
    const state2 = makeState({ brainstorm: makeBrainstorm({ idea: "Online bakery" }) });

    const prompt1 = buildSystemPrompt(state1);
    const prompt2 = buildSystemPrompt(state2);

    expect(prompt1).not.toBe(prompt2);
    expect(prompt1).toContain("Pet photography studio");
    expect(prompt2).toContain("Online bakery");
  });
});
