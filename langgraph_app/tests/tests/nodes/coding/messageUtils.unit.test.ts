/**
 * Unit tests for messageUtils — sanitizeMessagesForLLM tool evidence preservation.
 *
 * Anti-hallucination contract: conversation history must preserve tool evidence
 * (AIMessage with tool_use + paired ToolMessages) so subsequent LLM turns see
 * that tools are required for changes. sanitizeMessagesForLLM is the gateway
 * for context messages entering singleShotEdit — it must NOT strip this evidence.
 */
import { describe, it, expect } from "vitest";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { sanitizeMessagesForLLM } from "@nodes";

describe("sanitizeMessagesForLLM — preserves tool evidence", () => {
  it("preserves ToolMessages in the message array", () => {
    const messages: BaseMessage[] = [
      new HumanMessage("Change the headline"),
      new AIMessage({
        content: "I'll update that.",
        tool_calls: [
          { id: "tc1", name: "str_replace_based_edit_tool", args: {}, type: "tool_call" as const },
        ],
      }),
      new ToolMessage({ content: "Successfully replaced text.", tool_call_id: "tc1" }),
      new AIMessage({ content: "I've updated the headline." }),
    ];

    const sanitized = sanitizeMessagesForLLM(messages);
    const toolMsgs = sanitized.filter((m) => m._getType() === "tool");
    expect(toolMsgs.length).toBe(1);
    expect(toolMsgs[0]!.content).toContain("Successfully replaced");
  });

  it("preserves tool_calls on AIMessages", () => {
    const messages: BaseMessage[] = [
      new HumanMessage("Change the headline"),
      new AIMessage({
        content: "I'll update that.",
        tool_calls: [
          { id: "tc1", name: "str_replace_based_edit_tool", args: {}, type: "tool_call" as const },
        ],
      }),
      new ToolMessage({ content: "Successfully replaced text.", tool_call_id: "tc1" }),
      new AIMessage({ content: "I've updated the headline." }),
    ];

    const sanitized = sanitizeMessagesForLLM(messages);
    const aiWithTools = sanitized.filter(
      (m) => m._getType() === "ai" && ((m as AIMessage).tool_calls?.length ?? 0) > 0
    );
    expect(aiWithTools.length).toBe(1);
    expect((aiWithTools[0] as AIMessage).tool_calls![0]!.name).toBe(
      "str_replace_based_edit_tool"
    );
  });

  it("preserves tool_use content blocks on AIMessages", () => {
    const messages: BaseMessage[] = [
      new HumanMessage("Change the headline"),
      new AIMessage({
        content: [
          { type: "text", text: "I'll update that." },
          { type: "tool_use", id: "tc1", name: "str_replace_based_edit_tool", input: {} },
        ],
        tool_calls: [
          { id: "tc1", name: "str_replace_based_edit_tool", args: {}, type: "tool_call" as const },
        ],
      }),
      new ToolMessage({ content: "Successfully replaced text.", tool_call_id: "tc1" }),
      new AIMessage({ content: "I've updated the headline." }),
    ];

    const sanitized = sanitizeMessagesForLLM(messages);
    const aiMsg = sanitized.find(
      (m) => m._getType() === "ai" && ((m as AIMessage).tool_calls?.length ?? 0) > 0
    ) as AIMessage;
    const blocks = aiMsg.content as any[];
    expect(blocks.some((b: any) => b.type === "tool_use")).toBe(true);
  });

  it("preserves multi-turn tool evidence across conversation history", () => {
    // Simulates two singleShotEdit turns stored in graph state
    const messages: BaseMessage[] = [
      // Turn 1: user asks for change
      new HumanMessage("Change the headline"),
      // Turn 1: singleShotEdit return (tool evidence)
      new AIMessage({
        content: "Updating headline.",
        tool_calls: [
          { id: "tc1", name: "str_replace_based_edit_tool", args: {}, type: "tool_call" as const },
        ],
      }),
      new ToolMessage({ content: "Successfully replaced text.", tool_call_id: "tc1" }),
      new AIMessage({ content: "I've updated the headline." }),
      // Turn 2: user asks for another change
      new HumanMessage("Now change the color"),
    ];

    const sanitized = sanitizeMessagesForLLM(messages);

    // All 5 messages should be preserved
    expect(sanitized.length).toBe(5);

    // Tool evidence from turn 1 should be intact
    const toolMsgs = sanitized.filter((m) => m._getType() === "tool");
    expect(toolMsgs.length).toBe(1);

    const aiWithTools = sanitized.filter(
      (m) => m._getType() === "ai" && ((m as AIMessage).tool_calls?.length ?? 0) > 0
    );
    expect(aiWithTools.length).toBe(1);
  });

  it("strips orphaned tool_use from AIMessages NOT followed by ToolMessages", () => {
    // This is the crash scenario: full agent returned an AIMessage with tool_calls
    // from its ReAct loop, but without paired ToolMessages. The Anthropic API rejects
    // orphaned tool_use blocks with "tool_use ids were found without tool_result blocks".
    const messages: BaseMessage[] = [
      // Full agent greeting with leaked ReAct tool_calls (orphaned — no ToolMessages follow)
      new AIMessage({
        content: "I'll create your landing page!",
        tool_calls: [
          { id: "tc1", name: "task", args: { name: "Create Hero" }, type: "tool_call" as const },
          { id: "tc2", name: "task", args: { name: "Create Features" }, type: "tool_call" as const },
        ],
      }),
      // Full agent summary (no tools)
      new AIMessage({ content: "Your landing page is ready!" }),
      // Next turn: user asks for edit
      new HumanMessage("Let's play with the headline"),
    ];

    const sanitized = sanitizeMessagesForLLM(messages);

    // The orphaned tool_calls should be stripped from the first AIMessage
    const firstAI = sanitized.find((m) => m._getType() === "ai") as AIMessage;
    expect(firstAI.tool_calls?.length ?? 0).toBe(0);

    // Text content should be preserved
    expect(firstAI.content).toContain("create your landing page");

    // Message count preserved (no messages dropped)
    expect(sanitized.length).toBe(3);
  });

  it("strips orphaned tool_use content blocks alongside tool_calls", () => {
    const messages: BaseMessage[] = [
      new AIMessage({
        content: [
          { type: "text", text: "Working on it." },
          { type: "tool_use", id: "tc1", name: "task", input: {} },
        ],
        tool_calls: [
          { id: "tc1", name: "task", args: {}, type: "tool_call" as const },
        ],
      }),
      // No ToolMessage after — orphaned
      new AIMessage({ content: "Done!" }),
      new HumanMessage("Change the color"),
    ];

    const sanitized = sanitizeMessagesForLLM(messages);

    const firstAI = sanitized[0] as AIMessage;
    // tool_calls stripped
    expect(firstAI.tool_calls?.length ?? 0).toBe(0);
    // tool_use content blocks stripped, text preserved
    if (Array.isArray(firstAI.content)) {
      expect(firstAI.content.every((b: any) => b.type !== "tool_use")).toBe(true);
      expect(firstAI.content.some((b: any) => b.type === "text")).toBe(true);
    } else {
      expect(firstAI.content).toContain("Working on it");
    }
  });

  it("preserves paired tool evidence while stripping orphaned ones in same history", () => {
    // Mixed history: orphaned tool_use from full agent + paired evidence from singleShotEdit
    const messages: BaseMessage[] = [
      // Turn 1: full agent greeting with orphaned tool_calls
      new AIMessage({
        content: "I'll create your page!",
        tool_calls: [
          { id: "tc1", name: "task", args: {}, type: "tool_call" as const },
        ],
      }),
      // Turn 1: full agent summary
      new AIMessage({ content: "Page is ready!" }),
      // Turn 2: user edit
      new HumanMessage("Change the headline"),
      // Turn 2: singleShotEdit with proper tool evidence
      new AIMessage({
        content: "Updating headline.",
        tool_calls: [
          { id: "tc2", name: "str_replace_based_edit_tool", args: {}, type: "tool_call" as const },
        ],
      }),
      new ToolMessage({ content: "Successfully replaced text.", tool_call_id: "tc2" }),
      new AIMessage({ content: "I've updated the headline." }),
      // Turn 3: new user request
      new HumanMessage("Now change the color"),
    ];

    const sanitized = sanitizeMessagesForLLM(messages);

    // Orphaned tool_calls from first AI should be stripped
    const firstAI = sanitized[0] as AIMessage;
    expect(firstAI.tool_calls?.length ?? 0).toBe(0);
    expect(firstAI.content).toContain("create your page");

    // Paired tool evidence from singleShotEdit should be preserved
    const toolMsgs = sanitized.filter((m) => m._getType() === "tool");
    expect(toolMsgs.length).toBe(1);

    const pairedAI = sanitized.find(
      (m) => m._getType() === "ai" && ((m as AIMessage).tool_calls?.length ?? 0) > 0
    ) as AIMessage;
    expect(pairedAI.tool_calls![0]!.name).toBe("str_replace_based_edit_tool");

    // All messages preserved (none dropped)
    expect(sanitized.length).toBe(7);
  });

  it("strips orphaned ToolMessages (no preceding AIMessage with matching tool_use)", () => {
    // After compactConversation removes an AIMessage with tool_calls but keeps
    // the paired ToolMessages, we get orphaned tool_results that crash the Claude API:
    // "unexpected tool_use_id found in tool_result blocks"
    const messages: BaseMessage[] = [
      // compactConversation summary (replaced the AIMessage that had tool_calls)
      new HumanMessage({ content: "[Conversation Summary] Built a landing page...", name: "context" }),
      // Orphaned ToolMessage — its AIMessage was summarized away
      new ToolMessage({ content: "Hero section created.", tool_call_id: "toolu_orphaned" }),
      // Properly paired tool evidence
      new AIMessage({
        content: "Now refining the CTA.",
        tool_calls: [
          { id: "tc2", name: "task", args: { name: "CTA" }, type: "tool_call" as const },
        ],
      }),
      new ToolMessage({ content: "CTA updated.", tool_call_id: "tc2" }),
      new AIMessage({ content: "Your page is ready!" }),
      // User's next edit
      new HumanMessage("Make the headline punchier"),
    ];

    const sanitized = sanitizeMessagesForLLM(messages);

    // Orphaned ToolMessage should be dropped
    const toolMsgs = sanitized.filter((m) => m._getType() === "tool");
    expect(toolMsgs.length).toBe(1);
    expect((toolMsgs[0] as ToolMessage).tool_call_id).toBe("tc2");

    // All other messages preserved
    expect(sanitized.length).toBe(5); // summary + AI(tool_use) + ToolMessage + AI(summary) + Human
  });

  it("strips orphaned ToolMessages when multiple ToolMessages lose their AIMessage", () => {
    // Create flow with 2 parallel subagent dispatches → compaction removes the AIMessage
    const messages: BaseMessage[] = [
      new HumanMessage({ content: "[Summary] Created page", name: "context" }),
      new ToolMessage({ content: "Hero done.", tool_call_id: "toolu_1" }),
      new ToolMessage({ content: "Features done.", tool_call_id: "toolu_2" }),
      new AIMessage({ content: "Page is ready!" }),
      new HumanMessage("Change the color"),
    ];

    const sanitized = sanitizeMessagesForLLM(messages);

    // Both orphaned ToolMessages should be dropped
    const toolMsgs = sanitized.filter((m) => m._getType() === "tool");
    expect(toolMsgs.length).toBe(0);
    expect(sanitized.length).toBe(3); // summary + AI(summary) + Human
  });

  it("preserves ToolMessages that are properly paired even with orphans in same history", () => {
    const messages: BaseMessage[] = [
      // Orphaned from compaction
      new ToolMessage({ content: "Orphaned result.", tool_call_id: "toolu_orphan" }),
      // Properly paired
      new AIMessage({
        content: "Editing...",
        tool_calls: [
          { id: "tc_good", name: "str_replace_based_edit_tool", args: {}, type: "tool_call" as const },
        ],
      }),
      new ToolMessage({ content: "Success.", tool_call_id: "tc_good" }),
      new AIMessage({ content: "Done!" }),
    ];

    const sanitized = sanitizeMessagesForLLM(messages);

    const toolMsgs = sanitized.filter((m) => m._getType() === "tool");
    expect(toolMsgs.length).toBe(1);
    expect((toolMsgs[0] as ToolMessage).tool_call_id).toBe("tc_good");
    // Orphan dropped: 4 - 1 = 3
    expect(sanitized.length).toBe(3);
  });

  it("passes through messages without tool evidence unchanged", () => {
    const messages: BaseMessage[] = [
      new HumanMessage("Hello"),
      new AIMessage({ content: "Hi there!" }),
      new HumanMessage("Change the color"),
    ];

    const sanitized = sanitizeMessagesForLLM(messages);
    expect(sanitized.length).toBe(3);
    expect(sanitized[0]!.content).toBe("Hello");
    expect(sanitized[1]!.content).toBe("Hi there!");
    expect(sanitized[2]!.content).toBe("Change the color");
  });
});
