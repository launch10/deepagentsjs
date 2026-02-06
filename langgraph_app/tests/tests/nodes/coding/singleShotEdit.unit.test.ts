/**
 * Unit tests for singleShotEdit error handling.
 *
 * Tests the P0 bug: failed edits silently report success to users.
 * All LLM calls are mocked — no real API calls, no cost.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AIMessage, HumanMessage } from "@langchain/core/messages";

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

// Mock toStructuredMessage — pass through the message
vi.mock("langgraph-ai-sdk", async (importOriginal) => {
  const original = await importOriginal<typeof import("langgraph-ai-sdk")>();
  return {
    ...original,
    toStructuredMessage: vi.fn().mockImplementation(async (msg: any) => [msg]),
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

// Mock agent.ts (getTheme) to avoid DB calls
vi.mock("../../../../app/nodes/coding/agent", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    getTheme: vi.fn().mockResolvedValue(undefined),
  };
});

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
    const content =
      typeof result.messages[0]?.content === "string" ? result.messages[0]?.content : "";
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
    const content =
      typeof result.messages[0]?.content === "string" ? result.messages[0]?.content : "";
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
    mockInvoke.mockResolvedValue(
      makeLLMResponseWithToolCalls("I've updated the hero section.", 3)
    );
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
    const content =
      typeof result.messages[0]?.content === "string" ? result.messages[0]?.content : "";
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

    await singleShotEdit(
      baseState,
      [new HumanMessage("Change stuff")],
      backend
    );

    expect(mockRollbarError).toHaveBeenCalled();
  });

  it("does NOT retry when SOME edits succeed (partial failure)", async () => {
    const backend = makeFakeBackend();
    mockInvoke.mockResolvedValue(
      makeLLMResponseWithToolCalls("I've updated the hero section.", 3)
    );
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
    (backend.read as ReturnType<typeof vi.fn>).mockResolvedValue("const Hero = () => <h1>Hello</h1>;");

    // First call fails, retry succeeds
    mockInvoke
      .mockResolvedValueOnce(makeLLMResponseWithToolCalls("Initial attempt.", 1))
      .mockResolvedValueOnce(makeLLMResponseWithToolCalls("Fixed it.", 1));
    mockExecuteTextEditorCommand
      .mockResolvedValueOnce("Error: No match found for replacement.")
      .mockResolvedValueOnce("Successfully replaced text at exactly one location.");

    await singleShotEdit(
      baseState,
      [new HumanMessage("Change the headline")],
      backend
    );

    // Backend.read should have been called to get current file contents for retry
    expect(backend.read).toHaveBeenCalledWith("/src/components/Hero.tsx");
    // Retry message should include error context
    const retryInvokeArgs = mockInvoke.mock.calls[1]?.[0] as any[];
    expect(retryInvokeArgs).toBeDefined();
    const lastMsg = retryInvokeArgs[retryInvokeArgs.length - 1];
    expect(lastMsg.content).toContain("previous edits failed");
    expect(lastMsg.content).toContain("Hello");
  });
});
