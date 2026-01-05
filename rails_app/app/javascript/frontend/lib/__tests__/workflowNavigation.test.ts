import { describe, it, expect } from "vitest";
import {
  PAGE_ORDER,
  getInitialPage,
  getPageIndex,
  getNextPage,
  getPreviousPage,
  isFirstPage,
  isLastPage,
  getFirstSubstep,
  getLastSubstep,
  pageHasSubsteps,
  continueWorkflow,
  backWorkflow,
  type WorkflowPosition,
} from "../workflowNavigation";

describe("workflowNavigation", () => {
  describe("PAGE_ORDER", () => {
    it("has pages in correct order", () => {
      expect(PAGE_ORDER).toEqual(["brainstorm", "website", "ad_campaign", "launch"]);
    });
  });

  describe("getInitialPage", () => {
    it("returns brainstorm as the initial page", () => {
      expect(getInitialPage()).toBe("brainstorm");
    });
  });

  describe("getPageIndex", () => {
    it("returns correct index for each page", () => {
      expect(getPageIndex("brainstorm")).toBe(0);
      expect(getPageIndex("website")).toBe(1);
      expect(getPageIndex("ad_campaign")).toBe(2);
      expect(getPageIndex("launch")).toBe(3);
    });

    it("returns -1 for null", () => {
      expect(getPageIndex(null)).toBe(-1);
    });
  });

  describe("getNextPage", () => {
    it("returns brainstorm for null (start of workflow)", () => {
      expect(getNextPage(null)).toBe("brainstorm");
    });

    it("returns website after brainstorm", () => {
      expect(getNextPage("brainstorm")).toBe("website");
    });

    it("returns ad_campaign after website", () => {
      expect(getNextPage("website")).toBe("ad_campaign");
    });

    it("returns launch after ad_campaign", () => {
      expect(getNextPage("ad_campaign")).toBe("launch");
    });

    it("returns null after launch (end of workflow)", () => {
      expect(getNextPage("launch")).toBe(null);
    });
  });

  describe("getPreviousPage", () => {
    it("returns null for null", () => {
      expect(getPreviousPage(null)).toBe(null);
    });

    it("returns null for brainstorm (first page)", () => {
      expect(getPreviousPage("brainstorm")).toBe(null);
    });

    it("returns brainstorm before website", () => {
      expect(getPreviousPage("website")).toBe("brainstorm");
    });

    it("returns website before ad_campaign", () => {
      expect(getPreviousPage("ad_campaign")).toBe("website");
    });

    it("returns ad_campaign before launch", () => {
      expect(getPreviousPage("launch")).toBe("ad_campaign");
    });
  });

  describe("isFirstPage", () => {
    it("returns true for brainstorm", () => {
      expect(isFirstPage("brainstorm")).toBe(true);
    });

    it("returns false for other pages", () => {
      expect(isFirstPage("website")).toBe(false);
      expect(isFirstPage("ad_campaign")).toBe(false);
      expect(isFirstPage("launch")).toBe(false);
    });

    it("returns false for null", () => {
      expect(isFirstPage(null)).toBe(false);
    });
  });

  describe("isLastPage", () => {
    it("returns true for launch", () => {
      expect(isLastPage("launch")).toBe(true);
    });

    it("returns false for other pages", () => {
      expect(isLastPage("brainstorm")).toBe(false);
      expect(isLastPage("website")).toBe(false);
      expect(isLastPage("ad_campaign")).toBe(false);
    });

    it("returns false for null", () => {
      expect(isLastPage(null)).toBe(false);
    });
  });

  describe("getFirstSubstep", () => {
    it("returns null for brainstorm (no substeps)", () => {
      expect(getFirstSubstep("brainstorm")).toBe(null);
    });

    it("returns null for website (no substeps)", () => {
      expect(getFirstSubstep("website")).toBe(null);
    });

    it("returns content for ad_campaign", () => {
      expect(getFirstSubstep("ad_campaign")).toBe("content");
    });

    it("returns settings for launch", () => {
      expect(getFirstSubstep("launch")).toBe("settings");
    });
  });

  describe("getLastSubstep", () => {
    it("returns null for brainstorm (no substeps)", () => {
      expect(getLastSubstep("brainstorm")).toBe(null);
    });

    it("returns null for website (no substeps)", () => {
      expect(getLastSubstep("website")).toBe(null);
    });

    it("returns review for ad_campaign", () => {
      expect(getLastSubstep("ad_campaign")).toBe("review");
    });

    it("returns deployment for launch", () => {
      expect(getLastSubstep("launch")).toBe("deployment");
    });
  });

  describe("pageHasSubsteps", () => {
    it("returns false for brainstorm", () => {
      expect(pageHasSubsteps("brainstorm")).toBe(false);
    });

    it("returns false for website", () => {
      expect(pageHasSubsteps("website")).toBe(false);
    });

    it("returns true for ad_campaign", () => {
      expect(pageHasSubsteps("ad_campaign")).toBe(true);
    });

    it("returns true for launch", () => {
      expect(pageHasSubsteps("launch")).toBe(true);
    });

    it("returns false for null", () => {
      expect(pageHasSubsteps(null)).toBe(false);
    });
  });

  describe("continueWorkflow", () => {
    describe("from null (start)", () => {
      it("moves to brainstorm", () => {
        const result = continueWorkflow({ page: null, substep: null });
        expect(result).toEqual({ page: "brainstorm", substep: null });
      });
    });

    describe("from brainstorm", () => {
      it("moves to website", () => {
        const result = continueWorkflow({ page: "brainstorm", substep: null });
        expect(result).toEqual({ page: "website", substep: null });
      });
    });

    describe("from website", () => {
      it("moves to ad_campaign/content", () => {
        const result = continueWorkflow({ page: "website", substep: null });
        expect(result).toEqual({ page: "ad_campaign", substep: "content" });
      });
    });

    describe("from ad_campaign", () => {
      it("moves through ad_campaign substeps in order", () => {
        const substepOrder = ["content", "highlights", "keywords", "settings", "launch", "review"];

        for (let i = 0; i < substepOrder.length - 1; i++) {
          const result = continueWorkflow({
            page: "ad_campaign",
            substep: substepOrder[i] as WorkflowPosition["substep"],
          });
          expect(result).toEqual({ page: "ad_campaign", substep: substepOrder[i + 1] });
        }
      });

      it("moves from ad_campaign/review to launch/settings", () => {
        const result = continueWorkflow({ page: "ad_campaign", substep: "review" });
        expect(result).toEqual({ page: "launch", substep: "settings" });
      });

      it("starts at content when substep is null", () => {
        const result = continueWorkflow({ page: "ad_campaign", substep: null });
        expect(result).toEqual({ page: "ad_campaign", substep: "content" });
      });
    });

    describe("from launch", () => {
      it("moves through launch substeps in order", () => {
        const result1 = continueWorkflow({ page: "launch", substep: "settings" });
        expect(result1).toEqual({ page: "launch", substep: "review" });

        const result2 = continueWorkflow({ page: "launch", substep: "review" });
        expect(result2).toEqual({ page: "launch", substep: "deployment" });
      });

      it("stays at deployment (end of workflow)", () => {
        const position: WorkflowPosition = { page: "launch", substep: "deployment" };
        const result = continueWorkflow(position);
        expect(result).toEqual(position);
      });
    });
  });

  describe("backWorkflow", () => {
    describe("from null", () => {
      it("stays at null", () => {
        const position: WorkflowPosition = { page: null, substep: null };
        const result = backWorkflow(position);
        expect(result).toEqual(position);
      });
    });

    describe("from brainstorm", () => {
      it("stays at brainstorm (first page)", () => {
        const position: WorkflowPosition = { page: "brainstorm", substep: null };
        const result = backWorkflow(position);
        expect(result).toEqual(position);
      });
    });

    describe("from website", () => {
      it("moves back to brainstorm", () => {
        const result = backWorkflow({ page: "website", substep: null });
        expect(result).toEqual({ page: "brainstorm", substep: null });
      });
    });

    describe("from ad_campaign", () => {
      it("moves back through ad_campaign substeps", () => {
        const result1 = backWorkflow({ page: "ad_campaign", substep: "review" });
        expect(result1).toEqual({ page: "ad_campaign", substep: "launch" });

        const result2 = backWorkflow({ page: "ad_campaign", substep: "highlights" });
        expect(result2).toEqual({ page: "ad_campaign", substep: "content" });
      });

      it("moves from ad_campaign/content to website", () => {
        const result = backWorkflow({ page: "ad_campaign", substep: "content" });
        expect(result).toEqual({ page: "website", substep: null });
      });
    });

    describe("from launch", () => {
      it("moves back through launch substeps", () => {
        const result1 = backWorkflow({ page: "launch", substep: "deployment" });
        expect(result1).toEqual({ page: "launch", substep: "review" });

        const result2 = backWorkflow({ page: "launch", substep: "review" });
        expect(result2).toEqual({ page: "launch", substep: "settings" });
      });

      it("moves from launch/settings to ad_campaign/review", () => {
        const result = backWorkflow({ page: "launch", substep: "settings" });
        expect(result).toEqual({ page: "ad_campaign", substep: "review" });
      });
    });
  });

  describe("full workflow traversal", () => {
    it("can traverse entire workflow forward", () => {
      let position: WorkflowPosition = { page: null, substep: null };
      const visited: string[] = [];

      // Keep advancing until we loop (position doesn't change)
      while (true) {
        const next = continueWorkflow(position);
        const key = `${next.page}/${next.substep}`;
        if (key === `${position.page}/${position.substep}`) break;
        visited.push(key);
        position = next;
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

    it("can traverse entire workflow backward", () => {
      let position: WorkflowPosition = { page: "launch", substep: "deployment" };
      const visited: string[] = [];

      // Keep going back until we loop (position doesn't change)
      while (true) {
        const prev = backWorkflow(position);
        const key = `${prev.page}/${prev.substep}`;
        if (key === `${position.page}/${position.substep}`) break;
        visited.push(key);
        position = prev;
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
