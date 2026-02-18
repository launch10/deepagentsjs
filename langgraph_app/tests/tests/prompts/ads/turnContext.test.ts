import { describe, it, expect } from "vitest";
import { buildTurnContext, buildPreferencesContext, PAGE_NAMES } from "@prompts";
import { type AdsGraphState } from "@state";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { isContextMessage, createContextMessage } from "langgraph-ai-sdk";
import { type LangGraphRunnableConfig } from "@types";

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
  describe("first visit to content stage", () => {
    it("returns context message with page name and asset instructions", async () => {
      const state = makeState({ stage: "content", messages: [] });
      const result = await buildTurnContext(state, fakeConfig);

      expect(result).not.toBeNull();
      expect(isContextMessage(result!)).toBe(true);

      const content = result!.content as string;
      expect(content).toContain("headlines and descriptions page");
      expect(content).toContain("Generate my headlines and descriptions");
      expect(content).toContain("<asset_instructions>");
      expect(content).toContain("<example_response>");
    });
  });

  describe("first visit to highlights stage", () => {
    it("returns context with callouts and structured snippets instructions", async () => {
      const state = makeState({ stage: "highlights", messages: [] });
      const result = await buildTurnContext(state, fakeConfig);

      expect(result).not.toBeNull();
      const content = result!.content as string;
      expect(content).toContain("callouts and structured snippets page");
      expect(content).toContain("Generate my callouts and structured snippets");
    });
  });

  describe("first visit to keywords stage", () => {
    it("returns context with keywords instructions", async () => {
      const state = makeState({ stage: "keywords", messages: [] });
      const result = await buildTurnContext(state, fakeConfig);

      expect(result).not.toBeNull();
      const content = result!.content as string;
      expect(content).toContain("keywords page");
      expect(content).toContain("Generate my keywords");
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
      expect(content).toContain("Keep the intro brief");
    });
  });

  describe("user message on content stage", () => {
    it("returns minimal page context (not full asset instructions)", async () => {
      const state = makeState({
        stage: "content",
        messages: [new HumanMessage("How do headlines pair with descriptions?")],
      });
      const result = await buildTurnContext(state, fakeConfig);

      expect(result).not.toBeNull();
      expect(isContextMessage(result!)).toBe(true);
      const content = result!.content as string;
      // Minimal page awareness — no asset instructions or output format
      expect(content).toContain("headlines and descriptions page");
      expect(content).not.toContain("<asset_instructions>");
      expect(content).not.toContain("Generate my");
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

  it("includes liked assets", () => {
    const state = makeState({
      stage: "content",
      headlines: [
        { id: "1", text: "Great Headline", locked: true, rejected: false },
      ],
    });
    const result = buildPreferencesContext(state);
    expect(result).toContain('I liked these headlines: "Great Headline"');
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

  it("includes both liked and rejected", () => {
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
  });

  it("handles structured snippets", () => {
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
  });

  it("returns null for non-content stages", () => {
    const state = makeState({ stage: "settings" });
    const result = buildPreferencesContext(state);
    expect(result).toBeNull();
  });
});
