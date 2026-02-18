import { describe, it, expect } from "vitest";
import { buildTurnContext, buildPreferencesContext, PAGE_NAMES } from "@prompts";
import { type AdsGraphState } from "@state";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { isContextMessage, createContextMessage } from "langgraph-ai-sdk";
import { type LangGraphRunnableConfig, Ads } from "@types";

const makeBrainstorm = () => ({
  idea: "A scheduling tool for remote teams",
  audience: "Remote workers aged 25-45",
  solution: "AI-powered calendar coordination",
  socialProof: "Used by 500+ teams",
});

const makeState = (overrides: Partial<AdsGraphState> = {}): AdsGraphState =>
  ({
    brainstorm: makeBrainstorm(),
    stage: "content",
    messages: [],
    ...overrides,
  }) as AdsGraphState;

const fakeConfig = {} as LangGraphRunnableConfig;

describe("buildTurnContext", () => {
  describe("lightweight context messages (no asset instructions)", () => {
    it("context messages never contain asset_instructions or example_response", async () => {
      for (const stage of ["content", "highlights", "keywords"] as Ads.StageName[]) {
        const state = makeState({ stage, messages: [] });
        const result = await buildTurnContext(state, fakeConfig);

        expect(result).not.toBeNull();
        const content = result!.content as string;
        // Asset instructions belong in the system prompt, not context messages
        expect(content).not.toContain("<asset_instructions>");
        expect(content).not.toContain("<example_response>");
      }
    });

    it("uses authoritative system instruction framing", async () => {
      const state = makeState({ stage: "content", messages: [] });
      const result = await buildTurnContext(state, fakeConfig);

      expect(result).not.toBeNull();
      const content = result!.content as string;
      expect(content).toContain("[[SYSTEM INSTRUCTIONS");
    });
  });

  describe("first visit to content stage", () => {
    it("returns a lightweight trigger to auto-generate headlines and descriptions", async () => {
      const state = makeState({ stage: "content", messages: [] });
      const result = await buildTurnContext(state, fakeConfig);

      expect(result).not.toBeNull();
      expect(isContextMessage(result!)).toBe(true);

      const content = result!.content as string;
      expect(content).toContain("headlines and descriptions");
      // Should be a clear instruction, not pretending to be the user
      expect(content).not.toContain("Generate my");
      expect(content).not.toContain("I'm on");
    });
  });

  describe("first visit to highlights stage", () => {
    it("returns a lightweight trigger for callouts and structured snippets", async () => {
      const state = makeState({ stage: "highlights", messages: [] });
      const result = await buildTurnContext(state, fakeConfig);

      expect(result).not.toBeNull();
      const content = result!.content as string;
      expect(content).toContain("callouts and structured snippets");
    });
  });

  describe("first visit to keywords stage", () => {
    it("returns a lightweight trigger for keywords", async () => {
      const state = makeState({ stage: "keywords", messages: [] });
      const result = await buildTurnContext(state, fakeConfig);

      expect(result).not.toBeNull();
      const content = result!.content as string;
      expect(content).toContain("keywords");
    });
  });

  describe("refresh assets", () => {
    it("returns context message with refresh request and preferences", async () => {
      const state = makeState({
        stage: "content",
        refresh: [{ asset: "headlines", nVariants: 3 }],
        headlines: [
          { id: "1", text: "Great Headline", locked: true, rejected: false },
          { id: "2", text: "Bad Headline", locked: false, rejected: true },
        ],
        messages: [new AIMessage("previous response")],
      });
      const result = await buildTurnContext(state, fakeConfig);

      expect(result).not.toBeNull();
      const content = result!.content as string;
      expect(content).toContain("3 fresh headlines");
      expect(content).toContain('"Great Headline"');
      expect(content).toContain('"Bad Headline"');
    });
  });

  describe("user message on content stage with locked assets", () => {
    it("returns a lightweight context with preferences but no asset instructions", async () => {
      const state = makeState({
        stage: "content",
        headlines: [
          { id: "1", text: "Locked Headline", locked: true, rejected: false },
          { id: "2", text: "Unlocked One", locked: false, rejected: false },
        ],
        messages: [new HumanMessage("nice, I like things that are very eco-friendly")],
      });
      const result = await buildTurnContext(state, fakeConfig);

      expect(result).not.toBeNull();
      expect(isContextMessage(result!)).toBe(true);
      const content = result!.content as string;
      // Should include preferences but NOT full asset instructions
      expect(content).toContain('"Locked Headline"');
      expect(content).not.toContain("<asset_instructions>");
      expect(content).not.toContain("<example_response>");
    });
  });

  describe("user message on content stage without locked assets (pure Q&A)", () => {
    it("returns a lightweight context acknowledging user message", async () => {
      const state = makeState({
        stage: "content",
        messages: [new HumanMessage("How do headlines pair with descriptions?")],
      });
      const result = await buildTurnContext(state, fakeConfig);

      expect(result).not.toBeNull();
      expect(isContextMessage(result!)).toBe(true);
      const content = result!.content as string;
      expect(content).toContain("sent a message");
      expect(content).not.toContain("<asset_instructions>");
    });
  });

  describe("user message on non-content stage", () => {
    it("returns minimal page context", async () => {
      const state = makeState({
        stage: "settings",
        messages: [new HumanMessage("What happens after this?")],
      });
      const result = await buildTurnContext(state, fakeConfig);

      expect(result).not.toBeNull();
      expect(isContextMessage(result!)).toBe(true);
      const content = result!.content as string;
      expect(content).toContain("campaign settings page");
    });
  });

  describe("non-content stage without user message", () => {
    it("returns minimal page context", async () => {
      const state = makeState({
        stage: "settings",
        messages: [new AIMessage("previous response")],
      });
      const result = await buildTurnContext(state, fakeConfig);

      expect(result).not.toBeNull();
      expect(isContextMessage(result!)).toBe(true);
      const content = result!.content as string;
      expect(content).toContain("campaign settings page");
    });
  });

  describe("no stage set", () => {
    it("returns null", async () => {
      const state = makeState({ stage: undefined });
      const result = await buildTurnContext(state, fakeConfig);

      expect(result).toBeNull();
    });
  });
});

describe("buildPreferencesContext", () => {
  it("returns null when no preferences exist", () => {
    const state = makeState({
      stage: "content",
      headlines: [
        { id: "1", text: "Normal", locked: false, rejected: false },
      ],
    });
    const result = buildPreferencesContext(state);
    expect(result).toBeNull();
  });

  it("tells the agent not to regenerate locked assets", () => {
    const state = makeState({
      stage: "content",
      headlines: [
        { id: "1", text: "Great Headline", locked: true, rejected: false },
      ],
    });
    const result = buildPreferencesContext(state);
    expect(result).toContain('"Great Headline"');
    expect(result).toMatch(/do NOT regenerate|already saved|don't regenerate/i);
    expect(result).not.toContain("I liked");
  });

  it("includes rejected assets", () => {
    const state = makeState({
      stage: "content",
      headlines: [
        { id: "1", text: "Bad Headline", locked: false, rejected: true },
      ],
    });
    const result = buildPreferencesContext(state);
    expect(result).toContain('Skip anything like: "Bad Headline"');
  });

  it("includes both locked (don't regenerate) and rejected (skip) assets", () => {
    const state = makeState({
      stage: "content",
      headlines: [
        { id: "1", text: "Good One", locked: true, rejected: false },
        { id: "2", text: "Bad One", locked: false, rejected: true },
      ],
      descriptions: [
        { id: "3", text: "Nice Desc", locked: true, rejected: false },
      ],
    });
    const result = buildPreferencesContext(state);
    expect(result).toContain('"Good One"');
    expect(result).toContain('"Bad One"');
    expect(result).toContain('"Nice Desc"');
    expect(result).toMatch(/do NOT regenerate|already saved|don't regenerate/i);
    expect(result).not.toContain("I liked");
  });

  it("handles structured snippets with don't-regenerate framing", () => {
    const state = makeState({
      stage: "highlights",
      structuredSnippets: {
        category: "services",
        details: [
          { id: "1", text: "Good Service", locked: true, rejected: false },
          { id: "2", text: "Bad Service", locked: false, rejected: true },
        ],
      },
    });
    const result = buildPreferencesContext(state);
    expect(result).toContain('"Good Service"');
    expect(result).toContain('"Bad Service"');
    expect(result).toMatch(/do NOT regenerate|already saved|don't regenerate/i);
  });

  it("returns null for non-content stages", () => {
    const state = makeState({ stage: "settings" });
    const result = buildPreferencesContext(state);
    expect(result).toBeNull();
  });
});
