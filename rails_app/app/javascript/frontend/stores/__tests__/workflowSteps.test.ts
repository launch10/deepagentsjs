import { describe, it, expect, beforeEach, vi } from "vitest";
import { createWorkflowStore, getWorkflowUrl } from "../workflowSteps";

// Mock window.history.pushState
const mockPushState = vi.fn();
Object.defineProperty(window, "history", {
  value: { pushState: mockPushState },
  writable: true,
});

describe("workflowSteps store", () => {
  beforeEach(() => {
    mockPushState.mockClear();
  });

  describe("getWorkflowUrl", () => {
    it("returns null when projectUUID is null", () => {
      expect(getWorkflowUrl("brainstorm", null, null)).toBe(null);
    });

    it("returns null when page is null", () => {
      expect(getWorkflowUrl(null, null, "uuid-123")).toBe(null);
    });

    it("generates brainstorm URL", () => {
      expect(getWorkflowUrl("brainstorm", null, "uuid-123")).toBe("/projects/uuid-123/brainstorm");
    });

    it("generates website URL", () => {
      expect(getWorkflowUrl("website", null, "uuid-123")).toBe("/projects/uuid-123/website");
    });

    it("generates ad_campaign URL with substep", () => {
      expect(getWorkflowUrl("ad_campaign", "content", "uuid-123")).toBe(
        "/projects/uuid-123/campaigns/content"
      );
      expect(getWorkflowUrl("ad_campaign", "highlights", "uuid-123")).toBe(
        "/projects/uuid-123/campaigns/highlights"
      );
      expect(getWorkflowUrl("ad_campaign", "review", "uuid-123")).toBe(
        "/projects/uuid-123/campaigns/review"
      );
    });

    it("returns null for ad_campaign without substep", () => {
      expect(getWorkflowUrl("ad_campaign", null, "uuid-123")).toBe(null);
    });

    it("generates launch URL with substep", () => {
      expect(getWorkflowUrl("launch", "settings", "uuid-123")).toBe(
        "/projects/uuid-123/launch/settings"
      );
      expect(getWorkflowUrl("launch", "review", "uuid-123")).toBe(
        "/projects/uuid-123/launch/review"
      );
      expect(getWorkflowUrl("launch", "deployment", "uuid-123")).toBe(
        "/projects/uuid-123/launch/deployment"
      );
    });

    it("returns null for launch without substep", () => {
      expect(getWorkflowUrl("launch", null, "uuid-123")).toBe(null);
    });
  });

  describe("createWorkflowStore", () => {
    describe("initial state", () => {
      it("initializes with null values", () => {
        const store = createWorkflowStore({ page: null, substep: null, projectUUID: null });
        const state = store.getState();

        expect(state.page).toBe(null);
        expect(state.substep).toBe(null);
        expect(state.projectUUID).toBe(null);
        expect(state.pageNumber).toBe(-1);
        expect(state.canGoBack).toBe(false);
        expect(state.canGoForward).toBe(true); // Can go forward from null to brainstorm
      });

      it("initializes with brainstorm page", () => {
        const store = createWorkflowStore({
          page: "brainstorm",
          substep: null,
          projectUUID: "uuid-123",
        });
        const state = store.getState();

        expect(state.page).toBe("brainstorm");
        expect(state.substep).toBe(null);
        expect(state.projectUUID).toBe("uuid-123");
        expect(state.pageNumber).toBe(0);
        expect(state.canGoBack).toBe(false); // Can't go back from brainstorm
        expect(state.canGoForward).toBe(true);
      });

      it("initializes with ad_campaign page and substep", () => {
        const store = createWorkflowStore({
          page: "ad_campaign",
          substep: "content",
          projectUUID: "uuid-123",
        });
        const state = store.getState();

        expect(state.page).toBe("ad_campaign");
        expect(state.substep).toBe("content");
        expect(state.pageNumber).toBe(2);
        expect(state.step).toBe("create");
        expect(state.canGoBack).toBe(true); // Can go back to website
        expect(state.canGoForward).toBe(true);
      });

      it("initializes hasVisitedReview based on substep", () => {
        const storeWithReview = createWorkflowStore({
          page: "ad_campaign",
          substep: "review",
          projectUUID: "uuid-123",
        });
        expect(storeWithReview.getState().hasVisitedReview).toBe(true);

        const storeWithoutReview = createWorkflowStore({
          page: "ad_campaign",
          substep: "content",
          projectUUID: "uuid-123",
        });
        expect(storeWithoutReview.getState().hasVisitedReview).toBe(false);
      });
    });

    describe("setPage", () => {
      it("updates page and pageNumber", () => {
        const store = createWorkflowStore({ page: null, substep: null, projectUUID: "uuid-123" });

        store.getState().setPage("brainstorm");

        const state = store.getState();
        expect(state.page).toBe("brainstorm");
        expect(state.pageNumber).toBe(0);
        expect(state.substep).toBe(null);
      });

      it("pushes URL to history by default", () => {
        const store = createWorkflowStore({ page: null, substep: null, projectUUID: "uuid-123" });

        store.getState().setPage("brainstorm");

        expect(mockPushState).toHaveBeenCalledWith({}, "", "/projects/uuid-123/brainstorm");
      });

      it("does not push URL when pushHistory is false", () => {
        const store = createWorkflowStore({ page: null, substep: null, projectUUID: "uuid-123" });

        store.getState().setPage("brainstorm", undefined, false);

        expect(mockPushState).not.toHaveBeenCalled();
      });

      it("updates projectUUID when provided", () => {
        const store = createWorkflowStore({ page: null, substep: null, projectUUID: null });

        store.getState().setPage("brainstorm", "new-uuid-456");

        expect(store.getState().projectUUID).toBe("new-uuid-456");
        expect(mockPushState).toHaveBeenCalledWith({}, "", "/projects/new-uuid-456/brainstorm");
      });

      it("resets substep when changing page", () => {
        const store = createWorkflowStore({
          page: "ad_campaign",
          substep: "content",
          projectUUID: "uuid-123",
        });

        store.getState().setPage("website");

        expect(store.getState().substep).toBe(null);
        expect(store.getState().step).toBe(null);
      });

      it("updates canGoBack and canGoForward", () => {
        const store = createWorkflowStore({ page: null, substep: null, projectUUID: "uuid-123" });

        store.getState().setPage("brainstorm");
        expect(store.getState().canGoBack).toBe(false);
        expect(store.getState().canGoForward).toBe(true);

        store.getState().setPage("website");
        expect(store.getState().canGoBack).toBe(true);
        expect(store.getState().canGoForward).toBe(true);
      });
    });

    describe("setSubstep", () => {
      it("updates substep and derived state", () => {
        const store = createWorkflowStore({
          page: "ad_campaign",
          substep: null,
          projectUUID: "uuid-123",
        });

        store.getState().setSubstep("highlights");

        const state = store.getState();
        expect(state.substep).toBe("highlights");
        expect(state.step).toBe("create");
      });

      it("pushes URL to history", () => {
        const store = createWorkflowStore({
          page: "ad_campaign",
          substep: "content",
          projectUUID: "uuid-123",
        });

        store.getState().setSubstep("highlights");

        expect(mockPushState).toHaveBeenCalledWith({}, "", "/projects/uuid-123/campaigns/highlights");
      });

      it("sets hasVisitedReview when navigating to review", () => {
        const store = createWorkflowStore({
          page: "ad_campaign",
          substep: "content",
          projectUUID: "uuid-123",
        });

        expect(store.getState().hasVisitedReview).toBe(false);

        store.getState().setSubstep("review");

        expect(store.getState().hasVisitedReview).toBe(true);
      });

      it("preserves hasVisitedReview when navigating away from review", () => {
        const store = createWorkflowStore({
          page: "ad_campaign",
          substep: "review",
          projectUUID: "uuid-123",
        });

        expect(store.getState().hasVisitedReview).toBe(true);

        store.getState().setSubstep("content");

        expect(store.getState().hasVisitedReview).toBe(true);
      });

      it("updates returnToSection when provided", () => {
        const store = createWorkflowStore({
          page: "ad_campaign",
          substep: "content",
          projectUUID: "uuid-123",
        });

        store.getState().setSubstep("highlights", "section-1");

        expect(store.getState().returnToSection).toBe("section-1");
      });
    });

    describe("clear", () => {
      it("resets all state to initial values", () => {
        const store = createWorkflowStore({
          page: "ad_campaign",
          substep: "review",
          projectUUID: "uuid-123",
        });

        store.getState().clear();

        const state = store.getState();
        expect(state.page).toBe(null);
        expect(state.substep).toBe(null);
        expect(state.projectUUID).toBe(null);
        expect(state.pageNumber).toBe(-1);
        expect(state.step).toBe(null);
        expect(state.stepNumber).toBe(null);
        expect(state.substepNumber).toBe(null);
        expect(state.canGoBack).toBe(false);
        expect(state.canGoForward).toBe(false);
        expect(state.hasVisitedReview).toBe(false);
        expect(state.returnToSection).toBe(null);
      });

      it("does not push URL", () => {
        const store = createWorkflowStore({
          page: "brainstorm",
          substep: null,
          projectUUID: "uuid-123",
        });
        mockPushState.mockClear();

        store.getState().clear();

        expect(mockPushState).not.toHaveBeenCalled();
      });
    });

    describe("continue", () => {
      it("advances from null to brainstorm", () => {
        const store = createWorkflowStore({
          page: null,
          substep: null,
          projectUUID: "uuid-123",
        });

        store.getState().continue();

        expect(store.getState().page).toBe("brainstorm");
        expect(store.getState().substep).toBe(null);
      });

      it("advances from brainstorm to website", () => {
        const store = createWorkflowStore({
          page: "brainstorm",
          substep: null,
          projectUUID: "uuid-123",
        });

        store.getState().continue();

        expect(store.getState().page).toBe("website");
        expect(mockPushState).toHaveBeenCalledWith({}, "", "/projects/uuid-123/website");
      });

      it("advances from website to ad_campaign/content", () => {
        const store = createWorkflowStore({
          page: "website",
          substep: null,
          projectUUID: "uuid-123",
        });

        store.getState().continue();

        expect(store.getState().page).toBe("ad_campaign");
        expect(store.getState().substep).toBe("content");
      });

      it("advances through ad_campaign substeps", () => {
        const store = createWorkflowStore({
          page: "ad_campaign",
          substep: "content",
          projectUUID: "uuid-123",
        });

        store.getState().continue();
        expect(store.getState().substep).toBe("highlights");

        store.getState().continue();
        expect(store.getState().substep).toBe("keywords");
      });

      it("advances from ad_campaign/review to launch/settings", () => {
        const store = createWorkflowStore({
          page: "ad_campaign",
          substep: "review",
          projectUUID: "uuid-123",
        });

        store.getState().continue();

        expect(store.getState().page).toBe("launch");
        expect(store.getState().substep).toBe("settings");
      });

      it("does nothing at end of workflow (launch/deployment)", () => {
        const store = createWorkflowStore({
          page: "launch",
          substep: "deployment",
          projectUUID: "uuid-123",
        });
        mockPushState.mockClear();

        store.getState().continue();

        expect(store.getState().page).toBe("launch");
        expect(store.getState().substep).toBe("deployment");
        expect(mockPushState).not.toHaveBeenCalled();
      });
    });

    describe("back", () => {
      it("does nothing from null", () => {
        const store = createWorkflowStore({
          page: null,
          substep: null,
          projectUUID: "uuid-123",
        });
        mockPushState.mockClear();

        store.getState().back();

        expect(store.getState().page).toBe(null);
        expect(mockPushState).not.toHaveBeenCalled();
      });

      it("does nothing from brainstorm (first page)", () => {
        const store = createWorkflowStore({
          page: "brainstorm",
          substep: null,
          projectUUID: "uuid-123",
        });
        mockPushState.mockClear();

        store.getState().back();

        expect(store.getState().page).toBe("brainstorm");
        expect(mockPushState).not.toHaveBeenCalled();
      });

      it("goes back from website to brainstorm", () => {
        const store = createWorkflowStore({
          page: "website",
          substep: null,
          projectUUID: "uuid-123",
        });

        store.getState().back();

        expect(store.getState().page).toBe("brainstorm");
        expect(mockPushState).toHaveBeenCalledWith({}, "", "/projects/uuid-123/brainstorm");
      });

      it("goes back through ad_campaign substeps", () => {
        const store = createWorkflowStore({
          page: "ad_campaign",
          substep: "highlights",
          projectUUID: "uuid-123",
        });

        store.getState().back();

        expect(store.getState().substep).toBe("content");
      });

      it("goes back from ad_campaign/content to website", () => {
        const store = createWorkflowStore({
          page: "ad_campaign",
          substep: "content",
          projectUUID: "uuid-123",
        });

        store.getState().back();

        expect(store.getState().page).toBe("website");
        expect(store.getState().substep).toBe(null);
      });

      it("goes back from launch/settings to ad_campaign/review", () => {
        const store = createWorkflowStore({
          page: "launch",
          substep: "settings",
          projectUUID: "uuid-123",
        });

        store.getState().back();

        expect(store.getState().page).toBe("ad_campaign");
        expect(store.getState().substep).toBe("review");
      });
    });

    describe("returnToReview", () => {
      it("navigates to ad_campaign/review", () => {
        const store = createWorkflowStore({
          page: "ad_campaign",
          substep: "content",
          projectUUID: "uuid-123",
        });

        store.getState().returnToReview();

        expect(store.getState().page).toBe("ad_campaign");
        expect(store.getState().substep).toBe("review");
        expect(mockPushState).toHaveBeenCalledWith({}, "", "/projects/uuid-123/campaigns/review");
      });
    });

    describe("clearReturnToSection", () => {
      it("clears returnToSection", () => {
        const store = createWorkflowStore({
          page: "ad_campaign",
          substep: "content",
          projectUUID: "uuid-123",
        });

        store.getState().setSubstep("highlights", "section-1");
        expect(store.getState().returnToSection).toBe("section-1");

        store.getState().clearReturnToSection();
        expect(store.getState().returnToSection).toBe(null);
      });
    });

    describe("full workflow traversal", () => {
      it("can traverse entire workflow forward with continue()", () => {
        const store = createWorkflowStore({
          page: null,
          substep: null,
          projectUUID: "uuid-123",
        });

        const visited: string[] = [];

        while (store.getState().canGoForward) {
          store.getState().continue();
          const { page, substep } = store.getState();
          visited.push(`${page}/${substep}`);
        }

        expect(visited).toEqual([
          "brainstorm/null",
          "website/null",
          "ad_campaign/content",
          "ad_campaign/highlights",
          "ad_campaign/keywords",
          "ad_campaign/settings",
          "ad_campaign/launch",
          "ad_campaign/review",
          "launch/settings",
          "launch/review",
          "launch/deployment",
        ]);
      });

      it("can traverse entire workflow backward with back()", () => {
        const store = createWorkflowStore({
          page: "launch",
          substep: "deployment",
          projectUUID: "uuid-123",
        });

        const visited: string[] = [];

        while (store.getState().canGoBack) {
          store.getState().back();
          const { page, substep } = store.getState();
          visited.push(`${page}/${substep}`);
        }

        expect(visited).toEqual([
          "launch/review",
          "launch/settings",
          "ad_campaign/review",
          "ad_campaign/launch",
          "ad_campaign/settings",
          "ad_campaign/keywords",
          "ad_campaign/highlights",
          "ad_campaign/content",
          "website/null",
          "brainstorm/null",
        ]);
      });
    });
  });
});
