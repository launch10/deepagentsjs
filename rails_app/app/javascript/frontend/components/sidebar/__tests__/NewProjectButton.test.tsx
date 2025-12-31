import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewProjectButton } from "../NewProjectButton";
import { createWorkflowStore, type WorkflowStepsStore } from "@stores/workflowSteps";
import { createContext, useContext, type ReactNode } from "react";
import { useStore, type StoreApi } from "zustand";

// Mock Inertia router
const mockVisit = vi.fn();
vi.mock("@inertiajs/react", () => ({
  router: {
    visit: (url: string) => mockVisit(url),
  },
}));

// Mock window.history.pushState to prevent errors
const mockPushState = vi.fn();
Object.defineProperty(window, "history", {
  value: { pushState: mockPushState },
  writable: true,
});

// Create a test wrapper that provides the workflow context
type WorkflowStepsStoreApi = StoreApi<WorkflowStepsStore>;
const WorkflowStepsContext = createContext<WorkflowStepsStoreApi | null>(null);

function TestWorkflowProvider({
  children,
  store,
}: {
  children: ReactNode;
  store: WorkflowStepsStoreApi;
}) {
  return (
    <WorkflowStepsContext.Provider value={store}>{children}</WorkflowStepsContext.Provider>
  );
}

// Override the hook for testing
vi.mock("@context/WorkflowStepsProvider", async () => {
  const actual = await vi.importActual("@context/WorkflowStepsProvider");
  return {
    ...actual,
    useWorkflowSteps: <T,>(selector: (state: WorkflowStepsStore) => T): T | undefined => {
      // This will be overridden in each test by wrapping with TestWorkflowProvider
      const store = useContext(WorkflowStepsContext);
      if (!store) {
        return undefined;
      }
      return useStore(store, selector);
    },
  };
});

describe("NewProjectButton", () => {
  beforeEach(() => {
    mockVisit.mockClear();
    mockPushState.mockClear();
  });

  describe("rendering", () => {
    it("renders the button with New Project text when not collapsed", () => {
      const store = createWorkflowStore({
        page: null,
        substep: null,
        projectUUID: null,
      });

      render(
        <TestWorkflowProvider store={store}>
          <NewProjectButton isCollapsed={false} />
        </TestWorkflowProvider>
      );

      expect(screen.getByTestId("new-project-link")).toBeInTheDocument();
      expect(screen.getByText("New Project")).toBeInTheDocument();
    });

    it("hides New Project text when collapsed", () => {
      const store = createWorkflowStore({
        page: null,
        substep: null,
        projectUUID: null,
      });

      render(
        <TestWorkflowProvider store={store}>
          <NewProjectButton isCollapsed={true} />
        </TestWorkflowProvider>
      );

      expect(screen.getByTestId("new-project-link")).toBeInTheDocument();
      expect(screen.queryByText("New Project")).not.toBeInTheDocument();
    });

    it("renders the plus icon", () => {
      const store = createWorkflowStore({
        page: null,
        substep: null,
        projectUUID: null,
      });

      render(
        <TestWorkflowProvider store={store}>
          <NewProjectButton />
        </TestWorkflowProvider>
      );

      // The icon is inside a span with white background
      const iconContainer = screen.getByTestId("new-project-link").querySelector("span");
      expect(iconContainer).toBeInTheDocument();
      expect(iconContainer).toHaveClass("bg-white", "rounded-full");
    });
  });

  describe("workflow reset behavior", () => {
    it("clears workflow state from brainstorm page before navigation", async () => {
      const user = userEvent.setup();
      const store = createWorkflowStore({
        page: "brainstorm",
        substep: null,
        projectUUID: "existing-project-uuid",
      });

      // Verify initial state
      expect(store.getState().page).toBe("brainstorm");
      expect(store.getState().projectUUID).toBe("existing-project-uuid");

      render(
        <TestWorkflowProvider store={store}>
          <NewProjectButton />
        </TestWorkflowProvider>
      );

      await user.click(screen.getByTestId("new-project-link"));

      // Verify state was cleared
      expect(store.getState().page).toBe(null);
      expect(store.getState().substep).toBe(null);
      expect(store.getState().projectUUID).toBe(null);
      expect(store.getState().pageNumber).toBe(-1);

      // Verify navigation happened after clear
      expect(mockVisit).toHaveBeenCalledWith("/projects/new");
    });

    it("clears workflow state from website page before navigation", async () => {
      const user = userEvent.setup();
      const store = createWorkflowStore({
        page: "website",
        substep: null,
        projectUUID: "existing-project-uuid",
      });

      render(
        <TestWorkflowProvider store={store}>
          <NewProjectButton />
        </TestWorkflowProvider>
      );

      await user.click(screen.getByTestId("new-project-link"));

      expect(store.getState().page).toBe(null);
      expect(store.getState().projectUUID).toBe(null);
      expect(mockVisit).toHaveBeenCalledWith("/projects/new");
    });

    it("clears workflow state from ad_campaign with substep before navigation", async () => {
      const user = userEvent.setup();
      const store = createWorkflowStore({
        page: "ad_campaign",
        substep: "content",
        projectUUID: "existing-project-uuid",
      });

      // Verify initial state
      expect(store.getState().page).toBe("ad_campaign");
      expect(store.getState().substep).toBe("content");
      expect(store.getState().step).toBe("create");

      render(
        <TestWorkflowProvider store={store}>
          <NewProjectButton />
        </TestWorkflowProvider>
      );

      await user.click(screen.getByTestId("new-project-link"));

      // Verify all state was cleared
      expect(store.getState().page).toBe(null);
      expect(store.getState().substep).toBe(null);
      expect(store.getState().step).toBe(null);
      expect(store.getState().stepNumber).toBe(null);
      expect(store.getState().substepNumber).toBe(null);
      expect(store.getState().projectUUID).toBe(null);
      expect(mockVisit).toHaveBeenCalledWith("/projects/new");
    });

    it("clears workflow state from ad_campaign/review (preserving hasVisitedReview reset)", async () => {
      const user = userEvent.setup();
      const store = createWorkflowStore({
        page: "ad_campaign",
        substep: "review",
        projectUUID: "existing-project-uuid",
      });

      // Verify initial state has hasVisitedReview set
      expect(store.getState().hasVisitedReview).toBe(true);

      render(
        <TestWorkflowProvider store={store}>
          <NewProjectButton />
        </TestWorkflowProvider>
      );

      await user.click(screen.getByTestId("new-project-link"));

      // hasVisitedReview should also be reset
      expect(store.getState().hasVisitedReview).toBe(false);
      expect(mockVisit).toHaveBeenCalledWith("/projects/new");
    });

    it("clears workflow state from launch page with substep before navigation", async () => {
      const user = userEvent.setup();
      const store = createWorkflowStore({
        page: "launch",
        substep: "deployment",
        projectUUID: "existing-project-uuid",
      });

      // Verify we're at the end of the workflow
      expect(store.getState().canGoForward).toBe(false);

      render(
        <TestWorkflowProvider store={store}>
          <NewProjectButton />
        </TestWorkflowProvider>
      );

      await user.click(screen.getByTestId("new-project-link"));

      // Everything should be cleared
      expect(store.getState().page).toBe(null);
      expect(store.getState().substep).toBe(null);
      expect(store.getState().projectUUID).toBe(null);
      expect(store.getState().canGoBack).toBe(false);
      expect(store.getState().canGoForward).toBe(false);
      expect(mockVisit).toHaveBeenCalledWith("/projects/new");
    });

    it("clears returnToSection when navigating to new project", async () => {
      const user = userEvent.setup();
      const store = createWorkflowStore({
        page: "ad_campaign",
        substep: "content",
        projectUUID: "existing-project-uuid",
      });

      // Set returnToSection
      store.getState().setSubstep("highlights", "section-1");
      expect(store.getState().returnToSection).toBe("section-1");

      render(
        <TestWorkflowProvider store={store}>
          <NewProjectButton />
        </TestWorkflowProvider>
      );

      await user.click(screen.getByTestId("new-project-link"));

      expect(store.getState().returnToSection).toBe(null);
      expect(mockVisit).toHaveBeenCalledWith("/projects/new");
    });
  });

  describe("navigation behavior", () => {
    it("navigates to /projects/new", async () => {
      const user = userEvent.setup();
      const store = createWorkflowStore({
        page: null,
        substep: null,
        projectUUID: null,
      });

      render(
        <TestWorkflowProvider store={store}>
          <NewProjectButton />
        </TestWorkflowProvider>
      );

      await user.click(screen.getByTestId("new-project-link"));

      expect(mockVisit).toHaveBeenCalledWith("/projects/new");
      expect(mockVisit).toHaveBeenCalledTimes(1);
    });

    it("prevents default link behavior", async () => {
      const user = userEvent.setup();
      const store = createWorkflowStore({
        page: null,
        substep: null,
        projectUUID: null,
      });

      render(
        <TestWorkflowProvider store={store}>
          <NewProjectButton />
        </TestWorkflowProvider>
      );

      const button = screen.getByTestId("new-project-link");

      // The button should be a button element, not a link
      expect(button.tagName).toBe("BUTTON");
    });
  });

  describe("when workflow context is not available", () => {
    it("still navigates even without workflow context", async () => {
      const user = userEvent.setup();

      // Render without the provider
      render(<NewProjectButton />);

      await user.click(screen.getByTestId("new-project-link"));

      // Should still navigate
      expect(mockVisit).toHaveBeenCalledWith("/projects/new");
    });
  });

  describe("styles", () => {
    it("applies correct flex styles when not collapsed", () => {
      const store = createWorkflowStore({
        page: null,
        substep: null,
        projectUUID: null,
      });

      render(
        <TestWorkflowProvider store={store}>
          <NewProjectButton isCollapsed={false} />
        </TestWorkflowProvider>
      );

      const button = screen.getByTestId("new-project-link");
      expect(button).toHaveClass("flex", "items-center", "gap-3");
      expect(button).not.toHaveClass("justify-center");
    });

    it("applies justify-center when collapsed", () => {
      const store = createWorkflowStore({
        page: null,
        substep: null,
        projectUUID: null,
      });

      render(
        <TestWorkflowProvider store={store}>
          <NewProjectButton isCollapsed={true} />
        </TestWorkflowProvider>
      );

      const button = screen.getByTestId("new-project-link");
      expect(button).toHaveClass("justify-center");
    });
  });
});
