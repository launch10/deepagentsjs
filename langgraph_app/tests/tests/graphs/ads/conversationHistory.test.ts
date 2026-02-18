/**
 * Conversation History Walk Test
 *
 * Replicates the exact frontend navigation flow:
 * 1. User navigates to content page (auto-init generates headlines/descriptions)
 * 2. User clicks Continue → highlights page (auto-init generates callouts/snippets)
 * 3. User clicks Continue → keywords page (auto-init generates keywords)
 * 4. User clicks Back → highlights page (already loaded, no generation)
 * 5. User clicks Back → content page (already loaded, no generation)
 *
 * Each step passes ...previousState into the next graph run, only changing
 * what the frontend actually changes (intent for navigation).
 *
 * This test catches the bug where context messages from previous turns
 * bunch up at the end of conversation history instead of staying
 * interspersed with their respective AI responses.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { testGraph } from "@support";
import { type AdsGraphState } from "@state";
import { adsGraph as uncompiledGraph } from "@graphs";
import { graphParams } from "@core";
import { DatabaseSnapshotter } from "@services";
import { db, projects as projectsTable } from "@db";
import { type UUIDType, Ads, type ThreadIDType, switchPage } from "@types";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { v7 as uuid } from "uuid";
import { isContextMessage } from "langgraph-ai-sdk";
import { Conversation } from "@conversation";

const adsGraph = uncompiledGraph.compile({ ...graphParams, name: "ads" });

describe.sequential("Conversation History — Frontend Navigation Walk", () => {
  let projectUUID: UUIDType;
  let threadId = uuid() as ThreadIDType;

  beforeEach(async () => {
    await DatabaseSnapshotter.restoreSnapshot("website_deploy_step");
    projectUUID = await db
      .select()
      .from(projectsTable)
      .limit(1)
      .execute()
      .then((res) => {
        if (!res[0]) throw new Error("No projects found");
        return res[0]!.uuid as UUIDType;
      });
  }, 30000);

  it("context messages stay interleaved with their AI responses across page navigations", async () => {
    // ─── Step 1: Navigate to content page (auto-init) ───
    const contentResult = await testGraph<AdsGraphState>()
      .withGraph(adsGraph)
      .withState({
        projectUUID,
        threadId,
        intent: switchPage("content"),
      })
      .execute();

    expect(contentResult.state.headlines?.length).toEqual(6);
    expect(contentResult.state.descriptions?.length).toEqual(4);

    // After content: messages should be [context, ai]
    const contentMessages = contentResult.state.messages!;
    assertMessageOrder(contentMessages, "after content", [
      { type: "context", contains: "headlines and descriptions" },
      { type: "ai" },
    ]);

    // ─── Step 2: Continue → highlights page (auto-init) ───
    // Frontend: advanceCampaign → useStageInit fires with switchPage("highlights")
    const highlightsResult = await testGraph<AdsGraphState>()
      .withGraph(adsGraph)
      .withState({
        ...contentResult.state,
        intent: switchPage("highlights"),
      })
      .execute();

    expect(highlightsResult.state.callouts?.length).toEqual(6);

    // After highlights: messages should be [ctx1, ai1, ctx2, ai2]
    // NOT [ctx1, ctx2, ai1, ai2] (bunched context messages)
    const highlightsMessages = highlightsResult.state.messages!;
    assertMessageOrder(highlightsMessages, "after highlights", [
      { type: "context", contains: "headlines and descriptions" },
      { type: "ai" },
      { type: "context", contains: "callouts and structured snippets" },
      { type: "ai" },
    ]);

    // ─── Step 3: Continue → keywords page (auto-init) ───
    const keywordsResult = await testGraph<AdsGraphState>()
      .withGraph(adsGraph)
      .withState({
        ...highlightsResult.state,
        intent: switchPage("keywords"),
      })
      .execute();

    expect(keywordsResult.state.keywords?.length).toEqual(8);

    // After keywords: messages should be [ctx1, ai1, ctx2, ai2, ctx3, ai3]
    const keywordsMessages = keywordsResult.state.messages!;
    assertMessageOrder(keywordsMessages, "after keywords", [
      { type: "context", contains: "headlines and descriptions" },
      { type: "ai" },
      { type: "context", contains: "callouts and structured snippets" },
      { type: "ai" },
      { type: "context", contains: "keywords" },
      { type: "ai" },
    ]);

    // ─── Verify windowing preserves order ───
    // This is the critical check: when the agent windows these messages
    // for the next turn, the order must be preserved
    const conv = new Conversation(keywordsMessages);
    const windowed = conv.window({ maxTurnPairs: 4, maxChars: 20_000 });

    // All messages should still be in interleaved order
    assertInterleaved(windowed, "windowed after keywords");

    // ─── Step 4: Back → highlights page ───
    // Frontend: hasStartedStep.highlights is true AND stageLoadedSuccessfully
    // So useStageInit does NOT fire. No graph run needed.
    // But if user sends a message, it should work correctly.

    // ─── Step 5: Back → content page ───
    // Same — no graph run, already loaded.

    // ─── Bonus: User sends a message on keywords page after navigating ───
    // This is the scenario from the screenshot — user feedback after multi-page walk
    const feedbackResult = await testGraph<AdsGraphState>()
      .withGraph(adsGraph)
      .withState({
        ...keywordsResult.state,
        refresh: undefined,
        messages: [
          ...keywordsResult.state.messages!,
          new HumanMessage("remember to SURF it up"),
        ],
      })
      .execute();

    // The feedback response should NOT have all context messages bunched before it
    const feedbackMessages = feedbackResult.state.messages!;
    assertInterleaved(feedbackMessages, "after user feedback on keywords");

    // The last context message should be the feedback context, not bunched with init contexts
    const contextMsgs = feedbackMessages.filter(isContextMessage);
    const lastContext = contextMsgs[contextMsgs.length - 1]!;
    const lastContextContent = lastContext.content as string;
    expect(lastContextContent).toContain("sent a message");
  });
});

// ─── Assertion helpers ────────────────────────────────────────────

interface ExpectedMessage {
  type: "context" | "ai" | "human";
  contains?: string;
}

function assertMessageOrder(
  messages: any[],
  label: string,
  expected: ExpectedMessage[]
): void {
  const actual = messages.map((m) => {
    if (isContextMessage(m)) return "context";
    if (m._getType() === "ai") return "ai";
    return "human";
  });

  // Check count
  expect(actual.length, `${label}: expected ${expected.length} messages, got ${actual.length}`).toEqual(expected.length);

  // Check types in order
  for (let i = 0; i < expected.length; i++) {
    expect(
      actual[i],
      `${label}: message[${i}] expected type="${expected[i]!.type}" but got "${actual[i]}"`
    ).toEqual(expected[i]!.type);

    if (expected[i]!.contains) {
      const content = typeof messages[i]!.content === "string" ? messages[i]!.content : "";
      expect(
        content,
        `${label}: message[${i}] expected to contain "${expected[i]!.contains}"`
      ).toContain(expected[i]!.contains);
    }
  }
}

/**
 * Assert that context messages and AI messages alternate properly —
 * no consecutive context messages (which would indicate bunching).
 */
function assertInterleaved(messages: any[], label: string): void {
  let consecutiveContextCount = 0;

  for (let i = 0; i < messages.length; i++) {
    if (isContextMessage(messages[i]!)) {
      consecutiveContextCount++;
      if (consecutiveContextCount > 1) {
        const types = messages.map((m, idx) => {
          const type = isContextMessage(m) ? "CTX" : m._getType() === "ai" ? "AI" : "HUMAN";
          const preview = typeof m.content === "string" ? m.content.slice(0, 60) : "...";
          return `  [${idx}] ${type}: ${preview}`;
        });
        throw new Error(
          `${label}: Found ${consecutiveContextCount} consecutive context messages at index ${i}.\n` +
          `Message order:\n${types.join("\n")}`
        );
      }
    } else {
      consecutiveContextCount = 0;
    }
  }
}
