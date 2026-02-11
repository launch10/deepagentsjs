/**
 * Unit tests for singleShotEdit.
 *
 * Tests:
 * 1. Error handling (P0 bug: failed edits silently report success)
 * 2. History-generating contract: returned AI messages must include [Actions: ...]
 *    annotations when tools were used, so subsequent LLM turns see evidence of
 *    tool usage and don't learn to hallucinate "Done!" without calling tools.
 *
 * All LLM calls are mocked — no real API calls, no cost.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";

// ─── Hoisted mocks (vi.mock factories can only reference these) ─────────────

const { mockExecuteTextEditorCommand, mockInvoke, mockRollbarError } = vi.hoisted(() => ({
  mockExecuteTextEditorCommand: vi.fn(),
  mockInvoke: vi.fn(),
  mockRollbarError: vi.fn(),
}));

// Mock executeTextEditorCommand — controls success/failure per call
vi.mock("@tools", async (importOriginal) => {
  const original = await importOriginal<typeof import("@tools")>();
  return {
    ...original,
    executeTextEditorCommand: mockExecuteTextEditorCommand,
  };
});

// Mock getLLM — returns a fake model with configurable tool calls
vi.mock("@core", async (importOriginal) => {
  const original = await importOriginal<typeof import("@core")>();
  return {
    ...original,
    getLLM: vi.fn().mockResolvedValue({
      withConfig: vi.fn().mockReturnValue({
        invoke: mockInvoke,
      }),
    }),
    rollbar: {
      error: mockRollbarError,
      warn: vi.fn(),
      info: vi.fn(),
    },
  };
});


// Mock fileContext (buildFileTree/preReadFiles) — singleShotEdit imports from this file
vi.mock("../../../../app/nodes/coding/fileContext", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    buildFileTree: vi.fn().mockResolvedValue({
      tree: "src/\n  components/\n    Hero.tsx\n    Features.tsx",
      allPaths: ["/src/components/Hero.tsx", "/src/components/Features.tsx"],
    }),
    preReadFiles: vi.fn().mockResolvedValue("// Hero.tsx content\n// Features.tsx content"),
  };
});

// Mock agent.ts (getTheme, getCodingAgentBackend) to avoid DB calls
vi.mock("../../../../app/nodes/coding/agent", () => ({
  getTheme: vi.fn().mockResolvedValue(undefined),
  getCodingAgentBackend: vi.fn(),
}));

import { singleShotEdit } from "../../../../app/nodes/coding/singleShotEdit";
import type { WebsiteFilesBackend } from "@services";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeFakeBackend(): WebsiteFilesBackend {
  return {
    read: vi.fn().mockResolvedValue("// file content"),
    write: vi.fn(),
    edit: vi.fn(),
    cleanup: vi.fn(),
    glob: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
  } as unknown as WebsiteFilesBackend;
}

function makeLLMResponseWithToolCalls(text: string, toolCallCount: number) {
  const toolCalls = Array.from({ length: toolCallCount }, (_, i) => ({
    id: `call_${i}`,
    name: "str_replace_based_edit_tool",
    args: {
      command: "str_replace",
      path: `/src/components/Hero.tsx`,
      old_str: `old text ${i}`,
      new_str: `new text ${i}`,
    },
  }));

  return new AIMessage({
    content: text,
    tool_calls: toolCalls,
  });
}

const baseState = {
  websiteId: 1,
  jwt: "test-jwt",
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("singleShotEdit error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns LLM text when all edits succeed", async () => {
    const backend = makeFakeBackend();
    mockInvoke.mockResolvedValue(
      makeLLMResponseWithToolCalls("I've updated the hero headline as requested.", 2)
    );
    mockExecuteTextEditorCommand
      .mockResolvedValueOnce("Successfully replaced text at exactly one location.")
      .mockResolvedValueOnce("Successfully replaced text at exactly one location.");

    const result = await singleShotEdit(
      baseState,
      [new HumanMessage("Change the headline")],
      backend
    );

    expect(result.status).toBe("completed");
    // Summary is the last message (after AIMessage(tool_use) + ToolMessages)
    const lastMsg = result.messages.at(-1)!;
    const content = typeof lastMsg.content === "string" ? lastMsg.content : "";
    expect(content).toContain("updated the hero headline");
    // Should NOT contain error language
    expect(content).not.toContain("errors");
    expect(content).not.toContain("could not be applied");
  });

  it("retries when ALL edits fail, and succeeds on retry", async () => {
    const backend = makeFakeBackend();
    // First call: all fail. Second call (retry): succeeds.
    mockInvoke
      .mockResolvedValueOnce(makeLLMResponseWithToolCalls("I've made the changes.", 2))
      .mockResolvedValueOnce(makeLLMResponseWithToolCalls("Fixed the headline.", 1));
    mockExecuteTextEditorCommand
      // First attempt: both fail
      .mockResolvedValueOnce("Error: No match found for replacement.")
      .mockResolvedValueOnce("Error: Found multiple matches for replacement text.")
      // Retry attempt: succeeds
      .mockResolvedValueOnce("Successfully replaced text at exactly one location.");

    const result = await singleShotEdit(
      baseState,
      [new HumanMessage("Change the headline")],
      backend
    );

    expect(result.status).toBe("completed");
    expect(result.allFailed).toBeUndefined();
    // LLM was invoked twice (initial + retry)
    expect(mockInvoke).toHaveBeenCalledTimes(2);
    // Summary is the last message (retry path also returns tool evidence)
    const lastMsg = result.messages.at(-1)!;
    const content = typeof lastMsg.content === "string" ? lastMsg.content : "";
    expect(content).toContain("Fixed the headline");
  });

  it("sets allFailed when ALL edits fail even after retry", async () => {
    const backend = makeFakeBackend();
    // Both calls fail completely
    mockInvoke
      .mockResolvedValueOnce(makeLLMResponseWithToolCalls("I've made the changes.", 2))
      .mockResolvedValueOnce(makeLLMResponseWithToolCalls("Trying again.", 1));
    mockExecuteTextEditorCommand
      // First attempt: both fail
      .mockResolvedValueOnce("Error: No match found for replacement.")
      .mockResolvedValueOnce("Error: No match found for replacement.")
      // Retry attempt: also fails
      .mockResolvedValueOnce("Error: No match found for replacement.");

    const result = await singleShotEdit(
      baseState,
      [new HumanMessage("Change the headline")],
      backend
    );

    expect(result.status).toBe("completed");
    expect(result.allFailed).toBe(true);
    expect(mockInvoke).toHaveBeenCalledTimes(2);
    const content =
      typeof result.messages[0]?.content === "string" ? result.messages[0]?.content : "";
    expect(content).toContain("encountered errors");
  });

  it("appends warning when SOME edits fail", async () => {
    const backend = makeFakeBackend();
    mockInvoke.mockResolvedValue(makeLLMResponseWithToolCalls("I've updated the hero section.", 3));
    mockExecuteTextEditorCommand
      .mockResolvedValueOnce("Successfully replaced text at exactly one location.")
      .mockResolvedValueOnce("Error: No match found for replacement.")
      .mockResolvedValueOnce("Successfully replaced text at exactly one location.");

    const result = await singleShotEdit(
      baseState,
      [new HumanMessage("Update the hero section")],
      backend
    );

    expect(result.status).toBe("completed");
    // Summary is the last message (after AIMessage(tool_use) + ToolMessages)
    const lastMsg = result.messages.at(-1)!;
    const content = typeof lastMsg.content === "string" ? lastMsg.content : "";
    // Should still include the LLM text (some edits worked)
    expect(content).toContain("updated the hero section");
    // But should also have a note about partial failure
    expect(content).toContain("could not be applied");
  });

  it("reports errors to rollbar when edits fail", async () => {
    const backend = makeFakeBackend();
    // First call fails, retry also fails
    mockInvoke
      .mockResolvedValueOnce(makeLLMResponseWithToolCalls("I've made the changes.", 2))
      .mockResolvedValueOnce(makeLLMResponseWithToolCalls("Trying again.", 1));
    mockExecuteTextEditorCommand
      .mockResolvedValueOnce("Error: No match found for replacement.")
      .mockResolvedValueOnce("Error: File not found.")
      .mockResolvedValueOnce("Error: No match found for replacement.");

    await singleShotEdit(baseState, [new HumanMessage("Change stuff")], backend);

    expect(mockRollbarError).toHaveBeenCalled();
  });

  it("does NOT retry when SOME edits succeed (partial failure)", async () => {
    const backend = makeFakeBackend();
    mockInvoke.mockResolvedValue(makeLLMResponseWithToolCalls("I've updated the hero section.", 3));
    mockExecuteTextEditorCommand
      .mockResolvedValueOnce("Successfully replaced text at exactly one location.")
      .mockResolvedValueOnce("Error: No match found for replacement.")
      .mockResolvedValueOnce("Successfully replaced text at exactly one location.");

    const result = await singleShotEdit(
      baseState,
      [new HumanMessage("Update the hero section")],
      backend
    );

    // Only one LLM call — no retry for partial failure
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(result.allFailed).toBeUndefined();
  });

  it("reads failed file contents for retry context", async () => {
    const backend = makeFakeBackend();
    (backend.read as ReturnType<typeof vi.fn>).mockResolvedValue(
      "const Hero = () => <h1>Hello</h1>;"
    );

    // First call fails, retry succeeds
    mockInvoke
      .mockResolvedValueOnce(makeLLMResponseWithToolCalls("Initial attempt.", 1))
      .mockResolvedValueOnce(makeLLMResponseWithToolCalls("Fixed it.", 1));
    mockExecuteTextEditorCommand
      .mockResolvedValueOnce("Error: No match found for replacement.")
      .mockResolvedValueOnce("Successfully replaced text at exactly one location.");

    await singleShotEdit(baseState, [new HumanMessage("Change the headline")], backend);

    // Backend.read should have been called to get current file contents for retry
    expect(backend.read).toHaveBeenCalledWith("/src/components/Hero.tsx");
    // Retry message should include error context
    const retryInvokeArgs = mockInvoke.mock.calls[1]?.[0] as any[];
    expect(retryInvokeArgs).toBeDefined();
    const lastMsg = retryInvokeArgs[retryInvokeArgs.length - 1];
    expect(lastMsg.content).toContain("Your edits failed with these errors");
    expect(lastMsg.content).toContain("Hello");
  });
});

// ─── History-generating contract ─────────────────────────────────────────────
//
// Both singleShotEdit and the full agent path return messages that get stored
// in graph state. When the next turn fires, the LLM sees these as conversation
// history. The LLM must see tool_use → tool_result sequences so it understands
// that tools are required to make changes. Without this evidence, the LLM
// learns the pattern "User: change X → AI: Done!" and stops calling tools.
//
// Contract: returned messages must include the full tool loop —
// AIMessage(tool_use) + ToolMessage(result) + AIMessage(summary) — so the
// next LLM turn sees properly paired tool evidence.

describe("history-generating contract: tool evidence in returned messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns AIMessage(tool_use) + ToolMessages + AIMessage(summary) when edits succeed", async () => {
    const backend = makeFakeBackend();
    mockInvoke.mockResolvedValue(
      makeLLMResponseWithToolCalls("I've updated the hero headline.", 2)
    );
    mockExecuteTextEditorCommand
      .mockResolvedValueOnce("Successfully replaced text at exactly one location.")
      .mockResolvedValueOnce("Successfully replaced text at exactly one location.");

    const result = await singleShotEdit(
      baseState,
      [new HumanMessage("Change the headline")],
      backend
    );

    // Should have: AIMessage(tool_use) + 2 ToolMessages + AIMessage(summary)
    expect(result.messages.length).toBe(4);

    // First message: AIMessage with tool_use blocks preserved
    const firstMsg = result.messages[0]!;
    expect(firstMsg._getType()).toBe("ai");
    expect((firstMsg as AIMessage).tool_calls?.length).toBe(2);

    // Middle messages: ToolMessages with results paired to tool_call_ids
    const toolMsg1 = result.messages[1]!;
    const toolMsg2 = result.messages[2]!;
    expect(toolMsg1._getType()).toBe("tool");
    expect(toolMsg2._getType()).toBe("tool");
    expect((toolMsg1 as ToolMessage).tool_call_id).toBe("call_0");
    expect((toolMsg2 as ToolMessage).tool_call_id).toBe("call_1");
    expect(toolMsg1.content).toContain("Successfully replaced");
    expect(toolMsg2.content).toContain("Successfully replaced");

    // Last message: AIMessage with user-facing summary
    const lastMsg = result.messages[3]!;
    expect(lastMsg._getType()).toBe("ai");
    expect(lastMsg.content).toContain("updated the hero headline");
  });

  it("includes error results in ToolMessages for partial failures", async () => {
    const backend = makeFakeBackend();
    mockInvoke.mockResolvedValue(
      makeLLMResponseWithToolCalls("I've updated the hero section.", 2)
    );
    mockExecuteTextEditorCommand
      .mockResolvedValueOnce("Successfully replaced text at exactly one location.")
      .mockResolvedValueOnce("Error: No match found for replacement.");

    const result = await singleShotEdit(
      baseState,
      [new HumanMessage("Update the hero section")],
      backend
    );

    // Should still include tool evidence
    const toolMessages = result.messages.filter((m) => m._getType() === "tool");
    expect(toolMessages.length).toBe(2);
    expect(toolMessages[0]!.content).toContain("Successfully replaced");
    expect(toolMessages[1]!.content).toContain("Error:");
  });

  it("includes ToolMessages for view calls (properly paired)", async () => {
    const backend = makeFakeBackend();
    // LLM calls view first (wasted) then str_replace on retry
    const viewResponse = new AIMessage({
      content: "Let me check the file.",
      tool_calls: [
        { id: "view_1", name: "str_replace_based_edit_tool", args: { command: "view", path: "/src/components/Hero.tsx" }, type: "tool_call" as const },
      ],
    });
    const editResponse = makeLLMResponseWithToolCalls("Fixed it.", 1);

    mockInvoke
      .mockResolvedValueOnce(viewResponse)
      .mockResolvedValueOnce(editResponse);
    mockExecuteTextEditorCommand
      .mockResolvedValueOnce("Successfully replaced text at exactly one location.");

    const result = await singleShotEdit(
      baseState,
      [new HumanMessage("Change the headline")],
      backend
    );

    // View call should have a paired ToolMessage (not orphaned)
    const allToolMsgs = result.messages.filter((m) => m._getType() === "tool");
    expect(allToolMsgs.length).toBeGreaterThan(0);

    // Every AIMessage tool_call should have a matching ToolMessage
    const aiMsgsWithToolCalls = result.messages.filter(
      (m) => m._getType() === "ai" && ((m as AIMessage).tool_calls?.length ?? 0) > 0
    );
    for (const aiMsg of aiMsgsWithToolCalls) {
      for (const tc of (aiMsg as AIMessage).tool_calls ?? []) {
        const matchingToolMsg = allToolMsgs.find(
          (tm) => (tm as ToolMessage).tool_call_id === tc.id
        );
        expect(matchingToolMsg).toBeDefined();
      }
    }
  });

  it("does NOT include tool evidence when escalating (zero tool calls)", async () => {
    const backend = makeFakeBackend();
    mockInvoke.mockResolvedValue(
      new AIMessage({ content: "Could you be more specific about what to change?" })
    );

    const result = await singleShotEdit(
      baseState,
      [new HumanMessage("Make it better")],
      backend
    );

    const toolMessages = result.messages.filter((m) => m._getType() === "tool");
    expect(toolMessages.length).toBe(0);
    expect(result.allFailed).toBe(true);
  });
});
