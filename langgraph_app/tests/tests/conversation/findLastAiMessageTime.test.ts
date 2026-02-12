/**
 * Tests for findLastAiMessageTime.
 *
 * This pure function walks backward through messages to find the
 * timestamp of the last real AI message. It powers prepareTurn's
 * event-fetching scope: "fetch events since the last AI response."
 *
 * Bug fixes tested here:
 * 1. Skips summary messages (stale timestamps after compaction)
 * 2. Keeps searching when an AI message lacks a timestamp
 */
import { describe, it, expect } from "vitest";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { findLastAiMessageTime } from "@conversation";
import { makeSummary } from "@support";

describe("findLastAiMessageTime", () => {
  it("reads additional_kwargs.timestamp from last AI message", () => {
    const messages = [
      new HumanMessage({ content: "Hello", id: "h1" }),
      new AIMessage({
        content: "Hi there",
        id: "a1",
        additional_kwargs: { timestamp: "2024-06-15T12:00:00.000Z" },
      }),
    ];

    const result = findLastAiMessageTime(messages);

    expect(result).toEqual(new Date("2024-06-15T12:00:00.000Z"));
  });

  it("reads response_metadata.timestamp from last AI message", () => {
    const messages = [
      new HumanMessage({ content: "Hello", id: "h1" }),
      new AIMessage({
        content: "Hi there",
        id: "a1",
        response_metadata: { timestamp: "2024-06-15T12:00:00.000Z" },
      }),
    ];

    const result = findLastAiMessageTime(messages);

    expect(result).toEqual(new Date("2024-06-15T12:00:00.000Z"));
  });

  it("returns null when no AI messages exist", () => {
    const messages = [
      new HumanMessage({ content: "Hello", id: "h1" }),
      new HumanMessage({ content: "Anyone there?", id: "h2" }),
    ];

    const result = findLastAiMessageTime(messages);

    expect(result).toBeNull();
  });

  it("finds real AI message, not summary", () => {
    const summary = makeSummary("test summary", "sum1");
    summary.additional_kwargs = { timestamp: "2024-01-01T00:00:00.000Z" };

    const messages = [
      summary,
      new HumanMessage({ content: "Hello", id: "h1" }),
      new AIMessage({
        content: "Hi there",
        id: "a1",
        additional_kwargs: { timestamp: "2024-06-15T12:00:00.000Z" },
      }),
    ];

    const result = findLastAiMessageTime(messages);

    expect(result).toEqual(new Date("2024-06-15T12:00:00.000Z"));
  });

  it("skips AI messages without timestamps and finds earlier timestamped one", () => {
    const messages = [
      new HumanMessage({ content: "Hello", id: "h1" }),
      new AIMessage({
        content: "First response",
        id: "a1",
        additional_kwargs: { timestamp: "2024-06-15T12:00:00.000Z" },
      }),
      new HumanMessage({ content: "Follow up", id: "h2" }),
      new AIMessage({
        content: "Second response",
        id: "a2",
      }),
    ];

    const result = findLastAiMessageTime(messages);

    expect(result).toEqual(new Date("2024-06-15T12:00:00.000Z"));
  });

  it("returns null when all AI messages lack timestamps", () => {
    const messages = [
      new HumanMessage({ content: "Hello", id: "h1" }),
      new AIMessage({ content: "First response", id: "a1" }),
      new HumanMessage({ content: "Follow up", id: "h2" }),
      new AIMessage({ content: "Second response", id: "a2" }),
    ];

    const result = findLastAiMessageTime(messages);

    expect(result).toBeNull();
  });

  it("prefers additional_kwargs.timestamp over response_metadata.timestamp", () => {
    const messages = [
      new HumanMessage({ content: "Hello", id: "h1" }),
      new AIMessage({
        content: "Hi there",
        id: "a1",
        additional_kwargs: { timestamp: "2024-01-01T00:00:00.000Z" },
        response_metadata: { timestamp: "2024-06-01T00:00:00.000Z" },
      }),
    ];

    const result = findLastAiMessageTime(messages);

    expect(result).toEqual(new Date("2024-01-01T00:00:00.000Z"));
  });
});
