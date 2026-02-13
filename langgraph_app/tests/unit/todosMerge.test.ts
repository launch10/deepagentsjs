import { describe, it, expect } from "vitest";
import { todosMerge, type Todo } from "@state";

describe("todosMerge", () => {
  const existingTodos: Todo[] = [
    { id: "1", content: "Design hero section", status: "completed" },
    { id: "2", content: "Build features grid", status: "in_progress" },
    { id: "3", content: "Create CTA section", status: "pending" },
  ];

  it("returns incoming when current is empty", () => {
    const incoming: Todo[] = [
      { id: "1", content: "New todo", status: "pending" },
    ];
    expect(todosMerge(incoming, [])).toEqual(incoming);
    expect(todosMerge(incoming, undefined)).toEqual(incoming);
  });

  it("merges by id with status priority", () => {
    const incoming: Todo[] = [
      { id: "2", content: "Build features grid", status: "completed" },
    ];
    const result = todosMerge(incoming, existingTodos);
    expect(result.find((t) => t.id === "2")!.status).toBe("completed");
  });

  it("never downgrades status", () => {
    const incoming: Todo[] = [
      { id: "1", content: "Design hero section", status: "pending" },
    ];
    const result = todosMerge(incoming, existingTodos);
    expect(result.find((t) => t.id === "1")!.status).toBe("completed");
  });

  it("appends new todos", () => {
    const incoming: Todo[] = [
      { id: "4", content: "Add footer", status: "pending" },
    ];
    const result = todosMerge(incoming, existingTodos);
    expect(result).toHaveLength(4);
    expect(result.find((t) => t.id === "4")).toBeTruthy();
  });

  // === THE KEY NEW BEHAVIOR ===
  it("clears all todos when incoming is an empty array", () => {
    const result = todosMerge([], existingTodos);
    expect(result).toEqual([]);
  });
});
