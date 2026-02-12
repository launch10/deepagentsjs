/**
 * Append-only invariant tests.
 *
 * The core contract: messages are only ever appended between
 * compaction runs. If messages get reordered, mutated, or dropped
 * outside of compaction, the Anthropic cache prefix breaks and
 * we waste money.
 *
 * These tests simulate turn-by-turn state evolution through the
 * production reducer (timestampedMessagesReducer) and verify
 * structural invariants at every step.
 */
import { describe, it, expect } from "vitest";
import { HumanMessage, AIMessage, ToolMessage, RemoveMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { timestampedMessagesReducer } from "@annotation";
import { Conversation } from "@conversation";
import {
  makeSimpleTurns,
  makeTurnWithTools,
  makeSummary,
  mockSummarizer,
} from "@support";

// ── Helpers ──────────────────────────────────────────────────────

/** Extract IDs from a message array for comparison. */
function ids(msgs: BaseMessage[]): string[] {
  return msgs.map((m) => m.id ?? "no-id");
}

/** Extract content strings from a message array for comparison. */
function contents(msgs: BaseMessage[]): string[] {
  return msgs.map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)));
}

describe("append-only invariant", () => {
  // ── Test 1 ────────────────────────────────────────────────────

  it("all previous messages remain identical after appending new ones", () => {
    const [h1, a1] = makeSimpleTurns(1, 1);
    const [h2, a2] = makeSimpleTurns(1, 2);

    const s0 = timestampedMessagesReducer([], [h1!, a1!]);
    const s1 = timestampedMessagesReducer(s0, [h2!, a2!]);

    // The prefix of s1 (same length as s0) must match s0 exactly
    const prefix = s1.slice(0, s0.length);
    expect(ids(prefix)).toEqual(ids(s0));
    expect(contents(prefix)).toEqual(contents(s0));
  });

  // ── Test 2 ────────────────────────────────────────────────────

  it("messages are never reordered between turns", () => {
    const snapshots: BaseMessage[][] = [];
    let state: BaseMessage[] = [];

    for (let turn = 1; turn <= 5; turn++) {
      const [h, a] = makeSimpleTurns(1, turn);
      state = timestampedMessagesReducer(state, [h!, a!]);
      snapshots.push([...state]);
    }

    // At each step, verify all previous IDs appear in the same order
    for (let k = 1; k < snapshots.length; k++) {
      const prevIds = ids(snapshots[k - 1]!);
      const currIds = ids(snapshots[k]!);

      // Previous IDs must appear as a prefix of current IDs
      for (let i = 0; i < prevIds.length; i++) {
        expect(currIds[i]).toBe(prevIds[i]);
      }
    }
  });

  // ── Test 3 ────────────────────────────────────────────────────

  it("message content is never mutated between turns", () => {
    const turn1Msgs = makeSimpleTurns(1, 1);
    const turn2Msgs = makeSimpleTurns(1, 2);

    const s0 = timestampedMessagesReducer([], turn1Msgs);
    const originalContents = s0.map((m) => JSON.stringify(m.content));

    const s1 = timestampedMessagesReducer(s0, turn2Msgs);

    // Original message content must be unchanged after appending turn 2
    for (let i = 0; i < s0.length; i++) {
      expect(JSON.stringify(s1[i]!.content)).toBe(originalContents[i]);
    }
  });

  // ── Test 4 ────────────────────────────────────────────────────

  it("prefix stability across K consecutive turns", () => {
    const snapshots: BaseMessage[][] = [];
    let state: BaseMessage[] = [];

    for (let turn = 1; turn <= 10; turn++) {
      const [h, a] = makeSimpleTurns(1, turn);
      state = timestampedMessagesReducer(state, [h!, a!]);
      snapshots.push([...state]);
    }

    // For every consecutive pair, snapshot[k].slice(0, snapshot[k-1].length)
    // must equal snapshot[k-1] — by IDs and content
    for (let k = 1; k < snapshots.length; k++) {
      const prev = snapshots[k - 1]!;
      const curr = snapshots[k]!;
      const prefix = curr.slice(0, prev.length);

      expect(ids(prefix)).toEqual(ids(prev));
      expect(contents(prefix)).toEqual(contents(prev));
    }
  });

  // ── Test 5 ────────────────────────────────────────────────────

  it("after compaction, append-only resumes from new baseline", async () => {
    // Build 8 turns through the reducer
    let state: BaseMessage[] = [];
    for (let turn = 1; turn <= 8; turn++) {
      const [h, a] = makeSimpleTurns(1, turn);
      state = timestampedMessagesReducer(state, [h!, a!]);
    }

    // Compact: keepRecent=3, messageThreshold=3
    const conv = new Conversation(state);
    const result = await conv.compact({
      messageThreshold: 3,
      keepRecent: 3,
      summarizer: mockSummarizer,
    });

    expect(result).not.toBeNull();

    // Apply compaction through reducer
    state = timestampedMessagesReducer(state, result!.toMessages());
    const postCompactionBaseline = [...state];

    // Add 2 more turns after compaction
    for (let turn = 9; turn <= 10; turn++) {
      const [h, a] = makeSimpleTurns(1, turn);
      state = timestampedMessagesReducer(state, [h!, a!]);
    }

    // Post-compaction prefix must be unchanged
    const prefix = state.slice(0, postCompactionBaseline.length);
    expect(ids(prefix)).toEqual(ids(postCompactionBaseline));
    expect(contents(prefix)).toEqual(contents(postCompactionBaseline));
  });

  // ── Test 6 ────────────────────────────────────────────────────

  it("compaction is the ONLY operation that removes messages", async () => {
    // Start with a base state
    let state = timestampedMessagesReducer([], makeSimpleTurns(2, 1));
    const baseIds = new Set(ids(state));

    // Append a human message — no IDs lost
    state = timestampedMessagesReducer(state, [
      new HumanMessage({ content: "New question", id: "h-extra" }),
    ]);
    for (const id of baseIds) {
      expect(ids(state)).toContain(id);
    }

    // Append an AI message — no IDs lost
    state = timestampedMessagesReducer(state, [
      new AIMessage({ content: "New answer", id: "a-extra" }),
    ]);
    for (const id of baseIds) {
      expect(ids(state)).toContain(id);
    }

    // Append tool messages — no IDs lost
    const toolAi = new AIMessage({
      content: "Using tool...",
      id: "a-tool",
      tool_calls: [{ id: "tc-1", name: "read_file", args: {}, type: "tool_call" as const }],
    });
    const toolResult = new ToolMessage({
      content: "File contents here",
      id: "t-1",
      tool_call_id: "tc-1",
    });
    state = timestampedMessagesReducer(state, [toolAi, toolResult]);
    const preCompactIds = new Set(ids(state));
    for (const id of baseIds) {
      expect(ids(state)).toContain(id);
    }

    // Now compact — this SHOULD remove IDs
    const conv = new Conversation(state);
    const result = await conv.compact({
      messageThreshold: 2,
      keepRecent: 2,
      summarizer: mockSummarizer,
    });

    expect(result).not.toBeNull();
    state = timestampedMessagesReducer(state, result!.toMessages());

    // After compaction, some IDs from the pre-compact state should be gone
    const postCompactIds = new Set(ids(state));
    const removedIds = [...preCompactIds].filter((id) => !postCompactIds.has(id));
    expect(removedIds.length).toBeGreaterThan(0);
  });
});
