import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useScrollAnchor } from "../useScrollAnchor";

/**
 * Creates mock refs for container and anchor elements with controllable scroll geometry.
 */
function createMockRefs(overrides: { scrollHeight?: number; scrollTop?: number; clientHeight?: number } = {}) {
  const { scrollHeight = 1000, scrollTop = 950, clientHeight = 500 } = overrides;

  const scrollIntoViewMock = vi.fn();
  const containerListeners: Record<string, Function[]> = {};

  const container = {
    scrollHeight,
    scrollTop,
    clientHeight,
    addEventListener: vi.fn((event: string, handler: Function, _opts?: any) => {
      if (!containerListeners[event]) containerListeners[event] = [];
      containerListeners[event].push(handler);
    }),
    removeEventListener: vi.fn((event: string, handler: Function) => {
      if (containerListeners[event]) {
        containerListeners[event] = containerListeners[event].filter((h) => h !== handler);
      }
    }),
  };

  const anchor = {
    scrollIntoView: scrollIntoViewMock,
  };

  const containerRef = { current: container as unknown as HTMLElement };
  const anchorRef = { current: anchor as unknown as HTMLDivElement };

  function fireScroll() {
    containerListeners["scroll"]?.forEach((h) => h());
  }

  function fireScrollEnd() {
    containerListeners["scrollend"]?.forEach((h) => h());
  }

  return { containerRef, anchorRef, scrollIntoViewMock, container, fireScroll, fireScrollEnd };
}

describe("useScrollAnchor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("auto-scrolls on initial render", () => {
    const { containerRef, anchorRef, scrollIntoViewMock } = createMockRefs();

    renderHook(() => useScrollAnchor(containerRef, anchorRef, [{ id: 1 }]));

    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" });
  });

  it("auto-scrolls when messages change and shouldAutoScroll is true", () => {
    const { containerRef, anchorRef, scrollIntoViewMock } = createMockRefs();

    const { rerender } = renderHook(
      ({ messages }) => useScrollAnchor(containerRef, anchorRef, messages),
      { initialProps: { messages: [{ id: 1 }] } }
    );

    scrollIntoViewMock.mockClear();
    rerender({ messages: [{ id: 1 }, { id: 2 }] });

    expect(scrollIntoViewMock).toHaveBeenCalled();
  });

  it("stops auto-scroll when user scrolls away from bottom", () => {
    const { containerRef, anchorRef, scrollIntoViewMock, container, fireScroll } = createMockRefs();

    const { result, rerender } = renderHook(
      ({ messages }) => useScrollAnchor(containerRef, anchorRef, messages, { threshold: 50 }),
      { initialProps: { messages: [{ id: 1 }] } }
    );

    // Wait for initial programmatic scroll guard to clear
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // Simulate user scrolling up (far from bottom)
    container.scrollTop = 100;
    act(() => {
      fireScroll();
    });

    expect(result.current.shouldAutoScroll).toBe(false);

    // Now add a new message — should NOT auto-scroll
    scrollIntoViewMock.mockClear();
    rerender({ messages: [{ id: 1 }, { id: 2 }] });

    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it("re-enables auto-scroll when user scrolls back to bottom", () => {
    const { containerRef, anchorRef, container, fireScroll } = createMockRefs();

    const { result } = renderHook(
      ({ messages }) => useScrollAnchor(containerRef, anchorRef, messages, { threshold: 50 }),
      { initialProps: { messages: [{ id: 1 }] } }
    );

    // Clear programmatic guard
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // User scrolls up
    container.scrollTop = 100;
    act(() => {
      fireScroll();
    });
    expect(result.current.shouldAutoScroll).toBe(false);

    // User scrolls back to bottom
    container.scrollTop = 950;
    act(() => {
      fireScroll();
    });
    expect(result.current.shouldAutoScroll).toBe(true);
  });

  it("tracks new message count while auto-scroll is paused", () => {
    const { containerRef, anchorRef, container, fireScroll } = createMockRefs();

    const { result, rerender } = renderHook(
      ({ messages }) => useScrollAnchor(containerRef, anchorRef, messages, { threshold: 50 }),
      { initialProps: { messages: [{ id: 1 }] } }
    );

    // Clear programmatic guard
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // User scrolls up
    container.scrollTop = 100;
    act(() => {
      fireScroll();
    });

    expect(result.current.newMessageCount).toBe(0);

    // Add 1 message
    rerender({ messages: [{ id: 1 }, { id: 2 }] });
    expect(result.current.newMessageCount).toBe(1);

    // Add 2 more messages
    rerender({ messages: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] });
    expect(result.current.newMessageCount).toBe(3);
  });

  it("resets new message count when auto-scroll re-enables", () => {
    const { containerRef, anchorRef, container, fireScroll } = createMockRefs();

    const { result, rerender } = renderHook(
      ({ messages }) => useScrollAnchor(containerRef, anchorRef, messages, { threshold: 50 }),
      { initialProps: { messages: [{ id: 1 }] } }
    );

    // Clear programmatic guard
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // User scrolls up, messages arrive
    container.scrollTop = 100;
    act(() => {
      fireScroll();
    });
    rerender({ messages: [{ id: 1 }, { id: 2 }] });
    expect(result.current.newMessageCount).toBe(1);

    // User scrolls back to bottom
    container.scrollTop = 950;
    act(() => {
      fireScroll();
    });
    expect(result.current.newMessageCount).toBe(0);
  });

  it("scrollToBottom re-enables auto-scroll and resets count", () => {
    const { containerRef, anchorRef, scrollIntoViewMock, container, fireScroll } = createMockRefs();

    const { result, rerender } = renderHook(
      ({ messages }) => useScrollAnchor(containerRef, anchorRef, messages, { threshold: 50 }),
      { initialProps: { messages: [{ id: 1 }] } }
    );

    // Clear programmatic guard
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // User scrolls up, messages arrive
    container.scrollTop = 100;
    act(() => {
      fireScroll();
    });
    rerender({ messages: [{ id: 1 }, { id: 2 }] });
    expect(result.current.shouldAutoScroll).toBe(false);
    expect(result.current.newMessageCount).toBe(1);

    // Click "scroll to bottom"
    scrollIntoViewMock.mockClear();
    act(() => {
      result.current.scrollToBottom();
    });

    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" });
    expect(result.current.shouldAutoScroll).toBe(true);
    expect(result.current.newMessageCount).toBe(0);
  });
});
