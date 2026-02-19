/**
 * Unit tests for _createCodingAgentInternal's message return behavior.
 *
 * Tests the contract: the full agent path returns ALL new messages from
 * the agent run (not just cherry-picked first/last), preserving tool_calls
 * and ToolMessages so conversation history is complete.
 *
 * All external dependencies are mocked — no real API calls, no DB, no cost.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockAgentInvoke, mockFlush } = vi.hoisted(() => ({
  mockAgentInvoke: vi.fn(),
  mockFlush: vi.fn().mockResolvedValue(undefined),
}));

// Mock deepagents — createDeepAgent returns a fake agent
vi.mock("deepagents", () => ({
  createDeepAgent: vi.fn().mockReturnValue({
    invoke: mockAgentInvoke,
  }),
  createSettings: vi.fn().mockReturnValue({}),
}));

// Mock all external services to avoid DB calls
vi.mock("@core", async (importOriginal) => {
  const original = await importOriginal<typeof import("@core")>();
  return {
    ...original,
    getLLM: vi.fn().mockResolvedValue({
      withConfig: vi.fn().mockReturnThis(),
      withStructuredOutput: vi.fn().mockReturnThis(),
      invoke: vi.fn(),
    }),
    getLLMFallbacks: vi.fn().mockReturnValue([]),
    createPromptCachingMiddleware: vi.fn().mockReturnValue({
      name: "promptCaching",
      wrapModelCall: (req: any, handler: any) => handler(req),
    }),
    createToolErrorSurfacingMiddleware: vi.fn().mockReturnValue({
      name: "toolErrorSurfacing",
      wrapToolCall: (req: any, handler: any) => handler(req),
    }),
    checkpointer: undefined,
    getLogger: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
    sentry: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  };
});

// Mock DB
vi.mock("@db", () => ({
  db: { select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 1, themeId: null }]) }) }) }) },
  websites: {},
  eq: vi.fn(),
}));

// Mock services
vi.mock("@services", () => ({
  WebsiteFilesBackend: {
    create: vi.fn().mockResolvedValue({
      flush: mockFlush,
      cleanup: vi.fn(),
    }),
  },
}));

// Mock tools
vi.mock("@tools", () => ({
  SearchIconsTool: vi.fn().mockImplementation(() => ({})),
  changeColorSchemeTool: {},
  executeTextEditorCommand: vi.fn(),
}));

// Mock prompts
vi.mock("@prompts", () => ({
  buildCodingPrompt: vi.fn().mockResolvedValue("You are a coding agent."),
}));

// Mock rails API
vi.mock("@rails_api", () => ({
  ThemeAPIService: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
  })),
}));

// Mock langchain middleware
vi.mock("langchain", () => ({
  createMiddleware: vi.fn().mockReturnValue({
    name: "mock",
    wrapModelCall: (req: any, handler: any) => handler(req),
  }),
  modelFallbackMiddleware: vi.fn().mockReturnValue({
    name: "modelFallback",
    wrapModelCall: (req: any, handler: any) => handler(req),
  }),
}));

// Mock singleShotEdit — we're testing the full agent path only
vi.mock("../../../../app/nodes/coding/singleShotEdit", () => ({
  singleShotEdit: vi.fn(),
  classifyEditWithLLM: vi.fn().mockResolvedValue("complex"),
}));

// Mock subagents
vi.mock("../../../../app/nodes/coding/subagents", () => ({
  buildCoderSubAgent: vi.fn().mockResolvedValue({}),
}));

// Mock fileContext
vi.mock("../../../../app/nodes/coding/fileContext", () => ({
  buildFileTree: vi.fn().mockResolvedValue({ tree: "", allPaths: [] }),
  preReadFiles: vi.fn().mockResolvedValue(""),
}));

import { createCodingAgent } from "@nodes";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Simulate a full agent run that produces:
 * - input messages (passed through from options.messages)
 * - AI greeting
 * - AI tool_call (code edit)
 * - ToolMessage (tool result)
 * - AI summary
 */
function makeFullAgentResult(inputMessages: BaseMessage[]) {
  const greeting = new AIMessage({ content: "Let me work on this.", id: "ai-greeting" });
  const toolCallMsg = new AIMessage({
    content: "",
    id: "ai-tool-call",
    tool_calls: [
      { id: "tc-1", name: "write_file", args: { path: "Hero.tsx", content: "..." }, type: "tool_call" as const },
    ],
  });
  const toolResult = new ToolMessage({
    content: "File written successfully.",
    tool_call_id: "tc-1",
  });
  const summary = new AIMessage({ content: "Done! I updated the hero section.", id: "ai-summary" });

  return {
    messages: [...inputMessages, greeting, toolCallMsg, toolResult, summary],
    todos: [],
  };
}

/**
 * Simulate a multi-step agent run with multiple tool call rounds
 */
function makeMultiStepAgentResult(inputMessages: BaseMessage[]) {
  const greeting = new AIMessage({ content: "I'll update the hero and CTA.", id: "ai-greeting" });
  const toolCall1 = new AIMessage({
    content: "",
    id: "ai-tool-1",
    tool_calls: [
      { id: "tc-1", name: "write_file", args: { path: "Hero.tsx", content: "..." }, type: "tool_call" as const },
    ],
  });
  const toolResult1 = new ToolMessage({ content: "File written.", tool_call_id: "tc-1" });
  const toolCall2 = new AIMessage({
    content: "",
    id: "ai-tool-2",
    tool_calls: [
      { id: "tc-2", name: "write_file", args: { path: "CTA.tsx", content: "..." }, type: "tool_call" as const },
    ],
  });
  const toolResult2 = new ToolMessage({ content: "File written.", tool_call_id: "tc-2" });
  const summary = new AIMessage({ content: "Done! Updated both sections.", id: "ai-summary" });

  return {
    messages: [...inputMessages, greeting, toolCall1, toolResult1, toolCall2, toolResult2, summary],
    todos: [],
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("full agent path: message return contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ALL new messages, not just cherry-picked first/last", async () => {
    const inputMessages = [new HumanMessage({ content: "Update the hero section", id: "human-1" })];
    mockAgentInvoke.mockResolvedValue(makeFullAgentResult(inputMessages));

    const result = await createCodingAgent(
      { websiteId: 1, jwt: "test", isCreateFlow: false },
      { messages: inputMessages, route: "full" }
    );

    // Should have: greeting + tool_call AI + ToolMessage + summary = 4 new messages
    expect(result.messages.length).toBe(4);
  });

  it("preserves tool_calls on AI messages (does NOT strip them)", async () => {
    const inputMessages = [new HumanMessage({ content: "Update the hero section", id: "human-1" })];
    mockAgentInvoke.mockResolvedValue(makeFullAgentResult(inputMessages));

    const result = await createCodingAgent(
      { websiteId: 1, jwt: "test", isCreateFlow: false },
      { messages: inputMessages, route: "full" }
    );

    const aiWithToolCalls = result.messages.filter(
      (m) => m._getType() === "ai" && ((m as AIMessage).tool_calls?.length ?? 0) > 0
    );
    expect(aiWithToolCalls.length).toBe(1);
    expect((aiWithToolCalls[0] as AIMessage).tool_calls![0]!.name).toBe("write_file");
  });

  it("preserves ToolMessages in the output", async () => {
    const inputMessages = [new HumanMessage({ content: "Update the hero section", id: "human-1" })];
    mockAgentInvoke.mockResolvedValue(makeFullAgentResult(inputMessages));

    const result = await createCodingAgent(
      { websiteId: 1, jwt: "test", isCreateFlow: false },
      { messages: inputMessages, route: "full" }
    );

    const toolMessages = result.messages.filter((m) => m._getType() === "tool");
    expect(toolMessages.length).toBe(1);
    expect(toolMessages[0]!.content).toContain("File written");
  });

  it("excludes input messages (only returns new messages from agent)", async () => {
    const inputMessages = [new HumanMessage({ content: "Update the hero section", id: "human-1" })];
    mockAgentInvoke.mockResolvedValue(makeFullAgentResult(inputMessages));

    const result = await createCodingAgent(
      { websiteId: 1, jwt: "test", isCreateFlow: false },
      { messages: inputMessages, route: "full" }
    );

    const humanMessages = result.messages.filter((m) => m._getType() === "human");
    expect(humanMessages.length).toBe(0);
  });

  it("preserves ALL tool rounds in multi-step runs", async () => {
    const inputMessages = [new HumanMessage({ content: "Update hero and CTA", id: "human-1" })];
    mockAgentInvoke.mockResolvedValue(makeMultiStepAgentResult(inputMessages));

    const result = await createCodingAgent(
      { websiteId: 1, jwt: "test", isCreateFlow: false },
      { messages: inputMessages, route: "full" }
    );

    // greeting + tool1 + result1 + tool2 + result2 + summary = 6 new messages
    expect(result.messages.length).toBe(6);

    const aiWithToolCalls = result.messages.filter(
      (m) => m._getType() === "ai" && ((m as AIMessage).tool_calls?.length ?? 0) > 0
    );
    expect(aiWithToolCalls.length).toBe(2);

    const toolMessages = result.messages.filter((m) => m._getType() === "tool");
    expect(toolMessages.length).toBe(2);
  });

  it("sanitizes orphaned ToolMessages before passing to full agent", async () => {
    // Simulates state after compactConversation removes an AIMessage but leaves its ToolMessages.
    // Without sanitization, the Claude API rejects: "unexpected tool_use_id in tool_result blocks"
    const inputMessages: BaseMessage[] = [
      // Orphaned ToolMessage (its AIMessage was compacted away)
      new ToolMessage({ content: "CSS content", tool_call_id: "toolu_orphaned" }),
      // Properly paired tool evidence
      new AIMessage({
        content: "Editing...",
        id: "ai-paired",
        tool_calls: [
          { id: "tc1", name: "str_replace_based_edit_tool", args: {}, type: "tool_call" as const },
        ],
      }),
      new ToolMessage({ content: "Successfully replaced text.", tool_call_id: "tc1" }),
      new AIMessage({ content: "Done!", id: "ai-summary" }),
      // User's new request
      new HumanMessage({ content: "Change the color", id: "human-1" }),
    ];

    // Mock agent to echo back the messages it receives + one new message
    mockAgentInvoke.mockImplementation(({ messages }: { messages: BaseMessage[] }) => ({
      messages: [...messages, new AIMessage({ content: "Color changed!", id: "ai-new" })],
      todos: [],
    }));

    await createCodingAgent(
      { websiteId: 1, jwt: "test", isCreateFlow: false },
      { messages: inputMessages, route: "full" }
    );

    // Verify the orphaned ToolMessage was stripped before reaching the agent
    const invokedMessages = mockAgentInvoke.mock.calls[0]![0].messages;
    const toolMsgs = invokedMessages.filter((m: BaseMessage) => m._getType() === "tool");
    expect(toolMsgs.length).toBe(1);
    expect((toolMsgs[0] as ToolMessage).tool_call_id).toBe("tc1");

    // Orphan should be gone
    const orphanToolMsg = invokedMessages.find(
      (m: BaseMessage) => m._getType() === "tool" && (m as ToolMessage).tool_call_id === "toolu_orphaned"
    );
    expect(orphanToolMsg).toBeUndefined();
  });

  it("correctly slices new messages after sanitization removes orphans", async () => {
    // When sanitization removes orphaned messages, the slice offset must account
    // for the reduced input length, not the original options.messages.length
    const inputMessages: BaseMessage[] = [
      // Two orphaned ToolMessages (both will be removed by sanitization)
      new ToolMessage({ content: "Orphan 1", tool_call_id: "toolu_orphan1" }),
      new ToolMessage({ content: "Orphan 2", tool_call_id: "toolu_orphan2" }),
      // Clean messages
      new AIMessage({ content: "Summary", id: "ai-clean" }),
      new HumanMessage({ content: "Change the color", id: "human-1" }),
    ];

    // After sanitization: [AIMessage, HumanMessage] = 2 messages
    // Agent returns: [AIMessage, HumanMessage, AIMessage(new)] = 3 messages
    mockAgentInvoke.mockImplementation(({ messages }: { messages: BaseMessage[] }) => ({
      messages: [...messages, new AIMessage({ content: "Color changed!", id: "ai-new" })],
      todos: [],
    }));

    const result = await createCodingAgent(
      { websiteId: 1, jwt: "test", isCreateFlow: false },
      { messages: inputMessages, route: "full" }
    );

    // Should return ONLY the new message, not re-return sanitized input messages
    expect(result.messages.length).toBe(1);
    expect(result.messages[0]!.content).toBe("Color changed!");
  });

  it("prepends escalation message when escalating from single-shot", async () => {
    // When route="auto" and classifier returns "complex", it goes to full agent
    // But when single-shot fails and escalates, it prepends a note
    const inputMessages = [new HumanMessage({ content: "Update the hero section", id: "human-1" })];

    // Single-shot fails first
    const { singleShotEdit } = await import("@nodes");
    (singleShotEdit as ReturnType<typeof vi.fn>).mockResolvedValue({
      messages: [new AIMessage("Failed")],
      status: "completed",
      allFailed: true,
    });

    // Then full agent succeeds
    mockAgentInvoke.mockResolvedValue(makeFullAgentResult(inputMessages));

    const result = await createCodingAgent(
      { websiteId: 1, jwt: "test", isCreateFlow: false },
      { messages: inputMessages, route: "single-shot" }
    );

    // First message should be the escalation note
    expect(result.messages[0]!.content).toContain("closer look");
    // Rest should be the full agent messages
    expect(result.messages.length).toBe(5); // escalation + 4 agent messages
  });
});
