import { describe, it, expect } from "vitest";
import {
  usageTracker,
  getUsageContext,
  runWithUsageTracking,
  type UsageRecord,
} from "@core";
import {
  createAnthropicAIMessage,
  createOpenAIAIMessage,
  createAIMessageWithoutUsage,
  createLLMResult,
  createMessagesWithSystem,
  createMessagesWithoutSystem,
  MOCK_ANTHROPIC_USAGE_METADATA,
  MOCK_OPENAI_USAGE_METADATA,
} from "@support";

// =====================================================
// Suite 1: AsyncLocalStorage Context Accumulation & Isolation
// =====================================================
describe("UsageContext AsyncLocalStorage", () => {
  // Helper to create a minimal usage record
  const createRecord = (model: string, inputTokens: number): UsageRecord => ({
    llmCallId: `call-${Date.now()}-${Math.random()}`,
    model,
    inputTokens,
    outputTokens: 50,
    reasoningTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    timestamp: new Date(),
  });

  describe("accumulation", () => {
    it("accumulates records across sequential await boundaries", async () => {
      const { usage, runId } = await runWithUsageTracking({}, async () => {
        const ctx = getUsageContext()!;

        ctx.records.push(createRecord("model-1", 100));
        await Promise.resolve();

        ctx.records.push(createRecord("model-2", 150));
        await Promise.resolve();

        ctx.records.push(createRecord("model-3", 200));

        return "done";
      });

      // All 3 records accumulated correctly
      expect(usage).toHaveLength(3);
      expect(usage.reduce((sum, r) => sum + r.inputTokens, 0)).toBe(450);
      // runId is generated once for the whole request
      expect(runId).toBeDefined();
      expect(typeof runId).toBe("string");
    });

    it("accumulates records from parallel Promise.all branches", async () => {
      const { usage, runId } = await runWithUsageTracking({}, async () => {
        const ctx = getUsageContext()!;

        await Promise.all([
          (async () => {
            await Promise.resolve();
            ctx.records.push(createRecord("parallel-1", 100));
          })(),
          (async () => {
            await Promise.resolve();
            ctx.records.push(createRecord("parallel-2", 200));
          })(),
          (async () => {
            await Promise.resolve();
            ctx.records.push(createRecord("parallel-3", 300));
          })(),
        ]);

        return "done";
      });

      // All 3 parallel records accumulated
      expect(usage).toHaveLength(3);
      expect(usage.reduce((sum, r) => sum + r.inputTokens, 0)).toBe(600);
      expect(runId).toBeDefined();
    });

    it("accumulates records from deeply nested async calls", async () => {
      const { usage } = await runWithUsageTracking({}, async () => {
        const ctx = getUsageContext()!;

        const level3 = async () => {
          await Promise.resolve();
          ctx.records.push(createRecord("level-3", 300));
        };

        const level2 = async () => {
          ctx.records.push(createRecord("level-2", 200));
          await level3();
        };

        const level1 = async () => {
          ctx.records.push(createRecord("level-1", 100));
          await level2();
        };

        await level1();
        return "done";
      });

      expect(usage).toHaveLength(3);
      expect(usage.map((r) => r.model)).toEqual(["level-1", "level-2", "level-3"]);
    });
  });

  describe("isolation", () => {
    it("sequential runs have separate runIds and isolated records", async () => {
      const runA = await runWithUsageTracking({}, async () => {
        getUsageContext()!.records.push(createRecord("model-a", 100));
        return "a";
      });

      const runB = await runWithUsageTracking({}, async () => {
        getUsageContext()!.records.push(createRecord("model-b", 200));
        return "b";
      });

      // Each has its own records
      expect(runA.usage).toHaveLength(1);
      expect(runA.usage[0]!.model).toBe("model-a");
      expect(runB.usage).toHaveLength(1);
      expect(runB.usage[0]!.model).toBe("model-b");

      // Each has a unique runId
      expect(runA.runId).toBeDefined();
      expect(runB.runId).toBeDefined();
      expect(runA.runId).not.toBe(runB.runId);
    });

    it("concurrent runs (Promise.all) do not contaminate each other", async () => {
      const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      const [runA, runB, runC] = await Promise.all([
        runWithUsageTracking({}, async () => {
          await delay(10);
          getUsageContext()!.records.push(createRecord("model-a", 100));
          return "a";
        }),
        runWithUsageTracking({}, async () => {
          await delay(5);
          getUsageContext()!.records.push(createRecord("model-b", 200));
          return "b";
        }),
        runWithUsageTracking({}, async () => {
          await delay(15);
          getUsageContext()!.records.push(createRecord("model-c", 300));
          return "c";
        }),
      ]);

      // Each run has exactly 1 record, no cross-contamination
      expect(runA.usage).toHaveLength(1);
      expect(runA.usage[0]!.model).toBe("model-a");
      expect(runB.usage).toHaveLength(1);
      expect(runB.usage[0]!.model).toBe("model-b");
      expect(runC.usage).toHaveLength(1);
      expect(runC.usage[0]!.model).toBe("model-c");

      // All runIds are unique
      const runIds = [runA.runId, runB.runId, runC.runId];
      expect(new Set(runIds).size).toBe(3);
    });

    it("records from one run are never visible in another concurrent run", async () => {
      let runBRecordsAfterAAdds: number | undefined;

      await Promise.all([
        runWithUsageTracking({}, async () => {
          getUsageContext()!.records.push(createRecord("run-a", 100));
          await new Promise((r) => setTimeout(r, 20));
          return "a";
        }),
        runWithUsageTracking({}, async () => {
          // Wait for A to add its record
          await new Promise((r) => setTimeout(r, 10));
          runBRecordsAfterAAdds = getUsageContext()!.records.length;
          return "b";
        }),
      ]);

      // Run B didn't see Run A's record
      expect(runBRecordsAfterAAdds).toBe(0);
    });

    it("completing run A does not affect in-progress run B", async () => {
      let runBUsageAfterACompletes: number | undefined;

      const runBPromise = runWithUsageTracking({}, async () => {
        getUsageContext()!.records.push(createRecord("run-b-1", 100));

        // Wait for run A to complete
        await new Promise((r) => setTimeout(r, 50));

        // Check that our context is still intact
        runBUsageAfterACompletes = getUsageContext()!.records.length;

        // Add another record
        getUsageContext()!.records.push(createRecord("run-b-2", 200));

        return "b";
      });

      await new Promise((r) => setTimeout(r, 10));

      const runA = await runWithUsageTracking({}, async () => {
        getUsageContext()!.records.push(createRecord("run-a", 100));
        return "a";
      });

      const runB = await runBPromise;

      // Run A has its own record
      expect(runA.usage).toHaveLength(1);
      // Run B has 2 records and was not affected by A completing
      expect(runB.usage).toHaveLength(2);
      expect(runBUsageAfterACompletes).toBe(1);
    });
  });

  describe("edge cases", () => {
    it("returns undefined context outside runWithUsageTracking", () => {
      expect(getUsageContext()).toBeUndefined();
    });

    it("returns empty usage array when no records are added", async () => {
      const { usage, runId } = await runWithUsageTracking({}, async () => {
        return "no records";
      });

      expect(usage).toHaveLength(0);
      expect(runId).toBeDefined();
    });
  });
});

// =====================================================
// Suite 2: Callback Handler Mechanics
// =====================================================
describe("UsageTrackingCallbackHandler", () => {
  describe("handleChatModelStart", () => {
    it("captures system prompt from first message batch", async () => {
      const { systemPrompt } = await runWithUsageTracking({}, async () => {
        const messages = createMessagesWithSystem("You are a coding assistant.");

        await usageTracker.handleChatModelStart(
          { name: "test" } as any,
          [messages], // 2D array
          "run-123"
        );

        return "done";
      });

      expect(systemPrompt).toBe("You are a coding assistant.");
    });

    it("captures system prompt only once (first call wins)", async () => {
      const { systemPrompt } = await runWithUsageTracking({}, async () => {
        const firstMessages = createMessagesWithSystem("First system prompt");
        const secondMessages = createMessagesWithSystem("Second system prompt");

        await usageTracker.handleChatModelStart({ name: "test" } as any, [firstMessages], "run-1");
        await usageTracker.handleChatModelStart({ name: "test" } as any, [secondMessages], "run-2");

        return "done";
      });

      expect(systemPrompt).toBe("First system prompt");
    });

    it("handles messages array without system message", async () => {
      const { systemPrompt } = await runWithUsageTracking({}, async () => {
        const messages = createMessagesWithoutSystem();

        await usageTracker.handleChatModelStart({ name: "test" } as any, [messages], "run-123");

        return "done";
      });

      expect(systemPrompt).toBeUndefined();
    });

    it("handles empty messages array gracefully", async () => {
      const { systemPrompt } = await runWithUsageTracking({}, async () => {
        await usageTracker.handleChatModelStart({ name: "test" } as any, [[]], "run-123");

        return "done";
      });

      // Should not throw, systemPrompt remains undefined
      expect(systemPrompt).toBeUndefined();
    });
  });

  describe("handleLLMEnd", () => {
    it("extracts usage_metadata from AIMessage and creates UsageRecord", async () => {
      const { usage } = await runWithUsageTracking({}, async () => {
        const aiMessage = createAnthropicAIMessage("Test response");
        const llmResult = createLLMResult(aiMessage);

        await usageTracker.handleLLMEnd(llmResult, "llm-call-123");

        return "done";
      });

      expect(usage).toHaveLength(1);
      expect(usage[0]!.llmCallId).toBe("llm-call-123");
      expect(usage[0]!.inputTokens).toBe(MOCK_ANTHROPIC_USAGE_METADATA.input_tokens);
      expect(usage[0]!.outputTokens).toBe(MOCK_ANTHROPIC_USAGE_METADATA.output_tokens);
    });

    it("accumulates multiple records for multi-turn conversations", async () => {
      const { usage } = await runWithUsageTracking({}, async () => {
        const aiMessage1 = createAnthropicAIMessage("Response 1");
        const aiMessage2 = createAnthropicAIMessage("Response 2");
        const aiMessage3 = createAnthropicAIMessage("Response 3");

        await usageTracker.handleLLMEnd(createLLMResult(aiMessage1), "call-1");
        await usageTracker.handleLLMEnd(createLLMResult(aiMessage2), "call-2");
        await usageTracker.handleLLMEnd(createLLMResult(aiMessage3), "call-3");

        return "done";
      });

      expect(usage).toHaveLength(3);
    });

    it("captures message content for traces (messagesProduced)", async () => {
      const { messagesProduced } = await runWithUsageTracking({}, async () => {
        const aiMessage = createAnthropicAIMessage("This is the traced response");
        await usageTracker.handleLLMEnd(createLLMResult(aiMessage), "run-123");

        return "done";
      });

      expect(messagesProduced).toHaveLength(1);
      expect(messagesProduced[0]!.content).toBe("This is the traced response");
    });

    it("handles missing usage_metadata gracefully (no record added)", async () => {
      const { usage, messagesProduced } = await runWithUsageTracking({}, async () => {
        const aiMessage = createAIMessageWithoutUsage("No usage metadata");
        await usageTracker.handleLLMEnd(createLLMResult(aiMessage), "run-123");

        return "done";
      });

      // Message is still captured for traces
      expect(messagesProduced).toHaveLength(1);
      // But no usage record because there's no usage_metadata
      expect(usage).toHaveLength(0);
    });

    it("no-ops when called outside tracking context", async () => {
      // Call outside of runWithUsageTracking - should not throw
      const aiMessage = createAnthropicAIMessage("Test");
      await expect(usageTracker.handleLLMEnd(createLLMResult(aiMessage), "run-123")).resolves.not.toThrow();
    });
  });
});

// =====================================================
// Suite 3: Provider-Specific Field Extraction
// =====================================================
describe("Provider-Specific Usage Metadata", () => {
  describe("Anthropic Claude models", () => {
    it("extracts input_tokens from usage_metadata.input_tokens", async () => {
      const { usage } = await runWithUsageTracking({}, async () => {
        const aiMessage = createAnthropicAIMessage("Test", { input_tokens: 1500 });
        await usageTracker.handleLLMEnd(createLLMResult(aiMessage), "run-123");
        return "done";
      });

      expect(usage[0]!.inputTokens).toBe(1500);
    });

    it("extracts output_tokens from usage_metadata.output_tokens", async () => {
      const { usage } = await runWithUsageTracking({}, async () => {
        const aiMessage = createAnthropicAIMessage("Test", { output_tokens: 750 });
        await usageTracker.handleLLMEnd(createLLMResult(aiMessage), "run-123");
        return "done";
      });

      expect(usage[0]!.outputTokens).toBe(750);
    });

    it("extracts cache_creation_input_tokens when present", async () => {
      const { usage } = await runWithUsageTracking({}, async () => {
        const aiMessage = createAnthropicAIMessage("Test", { cache_creation_input_tokens: 250 });
        await usageTracker.handleLLMEnd(createLLMResult(aiMessage), "run-123");
        return "done";
      });

      expect(usage[0]!.cacheCreationTokens).toBe(250);
    });

    it("extracts cache_read_input_tokens when present", async () => {
      const { usage } = await runWithUsageTracking({}, async () => {
        const aiMessage = createAnthropicAIMessage("Test", { cache_read_input_tokens: 125 });
        await usageTracker.handleLLMEnd(createLLMResult(aiMessage), "run-123");
        return "done";
      });

      expect(usage[0]!.cacheReadTokens).toBe(125);
    });

    it("extracts model from response_metadata.model", async () => {
      const { usage } = await runWithUsageTracking({}, async () => {
        const aiMessage = createAnthropicAIMessage("Test");
        await usageTracker.handleLLMEnd(createLLMResult(aiMessage), "run-123");
        return "done";
      });

      expect(usage[0]!.model).toBe("claude-haiku-4-5-20251001");
    });
  });

  describe("OpenAI GPT models", () => {
    it("extracts input_tokens from usage_metadata.input_tokens", async () => {
      const { usage } = await runWithUsageTracking({}, async () => {
        const aiMessage = createOpenAIAIMessage("Test", { input_tokens: 2500 });
        await usageTracker.handleLLMEnd(createLLMResult(aiMessage), "run-123");
        return "done";
      });

      expect(usage[0]!.inputTokens).toBe(2500);
    });

    it("extracts output_tokens from usage_metadata.output_tokens", async () => {
      const { usage } = await runWithUsageTracking({}, async () => {
        const aiMessage = createOpenAIAIMessage("Test", { output_tokens: 1200 });
        await usageTracker.handleLLMEnd(createLLMResult(aiMessage), "run-123");
        return "done";
      });

      expect(usage[0]!.outputTokens).toBe(1200);
    });

    it("extracts reasoning_tokens from output_token_details.reasoning", async () => {
      const { usage } = await runWithUsageTracking({}, async () => {
        const aiMessage = createOpenAIAIMessage("Test", {
          output_token_details: { reasoning: 350 },
        });
        await usageTracker.handleLLMEnd(createLLMResult(aiMessage), "run-123");
        return "done";
      });

      expect(usage[0]!.reasoningTokens).toBe(350);
    });

    it("extracts model from response_metadata.model_name", async () => {
      const { usage } = await runWithUsageTracking({}, async () => {
        const aiMessage = createOpenAIAIMessage("Test");
        await usageTracker.handleLLMEnd(createLLMResult(aiMessage), "run-123");
        return "done";
      });

      expect(usage[0]!.model).toBe("gpt-4.1-mini-2025-04-14");
    });
  });
});

// =====================================================
// Suite 4: Multiple Runs Without Double Counting
// =====================================================
describe("Multiple Runs Without Double Counting", () => {
  it("sequential runs produce independent usage records", async () => {
    const run1 = await runWithUsageTracking({}, async () => {
      const aiMessage = createAnthropicAIMessage("Run 1 response");
      await usageTracker.handleLLMEnd(createLLMResult(aiMessage), "call-1");
      return "run-1";
    });

    const run2 = await runWithUsageTracking({}, async () => {
      const aiMessage = createAnthropicAIMessage("Run 2 response");
      await usageTracker.handleLLMEnd(createLLMResult(aiMessage), "call-2");
      return "run-2";
    });

    expect(run1.usage).not.toBe(run2.usage);
    expect(run1.usage).toHaveLength(1);
    expect(run2.usage).toHaveLength(1);
    expect(run1.usage[0]!.llmCallId).toBe("call-1");
    expect(run2.usage[0]!.llmCallId).toBe("call-2");
    // Each run has a unique runId
    expect(run1.runId).not.toBe(run2.runId);
  });

  it("each run generates unique runId for correlation", async () => {
    const allRunIds: string[] = [];

    for (let i = 0; i < 5; i++) {
      const { runId } = await runWithUsageTracking({}, async () => {
        const aiMessage = createAnthropicAIMessage(`Response ${i}`);
        await usageTracker.handleLLMEnd(createLLMResult(aiMessage), `call-${i}`);
        return i;
      });
      allRunIds.push(runId);
    }

    // All runIds should be unique
    const uniqueRunIds = new Set(allRunIds);
    expect(uniqueRunIds.size).toBe(5);
  });

  it("concurrent runs (Promise.all) maintain isolated records", async () => {
    const [r1, r2, r3] = await Promise.all([
      runWithUsageTracking({}, async () => {
        await new Promise((r) => setTimeout(r, 10));
        const aiMessage = createAnthropicAIMessage("Response 1");
        await usageTracker.handleLLMEnd(createLLMResult(aiMessage), "concurrent-1");
        return "r1";
      }),
      runWithUsageTracking({}, async () => {
        await new Promise((r) => setTimeout(r, 5));
        const aiMessage = createAnthropicAIMessage("Response 2");
        await usageTracker.handleLLMEnd(createLLMResult(aiMessage), "concurrent-2");
        return "r2";
      }),
      runWithUsageTracking({}, async () => {
        await new Promise((r) => setTimeout(r, 15));
        const aiMessage = createAnthropicAIMessage("Response 3");
        await usageTracker.handleLLMEnd(createLLMResult(aiMessage), "concurrent-3");
        return "r3";
      }),
    ]);

    // Each has independent records, no contamination
    expect(r1.usage).toHaveLength(1);
    expect(r1.usage[0]!.llmCallId).toBe("concurrent-1");
    expect(r2.usage).toHaveLength(1);
    expect(r2.usage[0]!.llmCallId).toBe("concurrent-2");
    expect(r3.usage).toHaveLength(1);
    expect(r3.usage[0]!.llmCallId).toBe("concurrent-3");

    // Total records = sum of individual, not multiplied
    const totalRecords = r1.usage.length + r2.usage.length + r3.usage.length;
    expect(totalRecords).toBe(3);

    // Each run has a unique runId
    expect(new Set([r1.runId, r2.runId, r3.runId]).size).toBe(3);
  });

  it("completing run A does not affect in-progress run B", async () => {
    let runBContext: ReturnType<typeof getUsageContext>;
    let runBUsageAfterACompletes: number;

    // Start run B, but don't complete it yet
    const runBPromise = runWithUsageTracking({}, async () => {
      const aiMessage = createAnthropicAIMessage("Run B start");
      await usageTracker.handleLLMEnd(createLLMResult(aiMessage), "run-b-1");

      runBContext = getUsageContext();

      // Wait for run A to complete
      await new Promise((r) => setTimeout(r, 50));

      // Check that our context is still intact
      runBUsageAfterACompletes = getUsageContext()!.records.length;

      // Add another record
      const aiMessage2 = createAnthropicAIMessage("Run B end");
      await usageTracker.handleLLMEnd(createLLMResult(aiMessage2), "run-b-2");

      return "b";
    });

    // Wait a bit, then run A to completion quickly
    await new Promise((r) => setTimeout(r, 10));

    const runA = await runWithUsageTracking({}, async () => {
      const aiMessage = createAnthropicAIMessage("Run A complete");
      await usageTracker.handleLLMEnd(createLLMResult(aiMessage), "run-a");
      return "a";
    });

    const runB = await runBPromise;

    // Run A should have its own record
    expect(runA.usage).toHaveLength(1);
    expect(runA.usage[0]!.llmCallId).toBe("run-a");

    // Run B should have 2 records and not be affected
    expect(runB.usage).toHaveLength(2);
    expect(runB.usage[0]!.llmCallId).toBe("run-b-1");
    expect(runB.usage[1]!.llmCallId).toBe("run-b-2");

    // Run B's context was still intact after A completed
    expect(runBUsageAfterACompletes!).toBe(1);
  });

  it("records from one run are not visible in another run's context", async () => {
    let runARecords: UsageRecord[] | undefined;
    let runBRecordsAfterAAdds: UsageRecord[] | undefined;

    await Promise.all([
      runWithUsageTracking({}, async () => {
        const aiMessage = createAnthropicAIMessage("Run A");
        await usageTracker.handleLLMEnd(createLLMResult(aiMessage), "run-a");
        runARecords = [...getUsageContext()!.records];
        await new Promise((r) => setTimeout(r, 20));
        return "a";
      }),
      runWithUsageTracking({}, async () => {
        // Wait for A to add its record
        await new Promise((r) => setTimeout(r, 10));
        runBRecordsAfterAAdds = [...getUsageContext()!.records];
        return "b";
      }),
    ]);

    // Run A added its record
    expect(runARecords).toHaveLength(1);
    // Run B didn't see Run A's record
    expect(runBRecordsAfterAAdds).toHaveLength(0);
  });
});