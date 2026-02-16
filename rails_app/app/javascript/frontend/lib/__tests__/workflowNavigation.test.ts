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
      expect(PAGE_ORDER).toEqual(["brainstorm", "website", "ads", "deploy"]);
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
      expect(getPageIndex("ads")).toBe(2);
      expect(getPageIndex("deploy")).toBe(3);
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

    it("returns ads after website", () => {
      expect(getNextPage("website")).toBe("ads");
    });

    it("returns deploy after ads", () => {
      expect(getNextPage("ads")).toBe("deploy");
    });

    it("returns null after deploy (end of workflow)", () => {
      expect(getNextPage("deploy")).toBe(null);
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

    it("returns website before ads", () => {
      expect(getPreviousPage("ads")).toBe("website");
    });

    it("returns ads before deploy", () => {
      expect(getPreviousPage("deploy")).toBe("ads");
    });
  });

  describe("isFirstPage", () => {
    it("returns true for brainstorm", () => {
      expect(isFirstPage("brainstorm")).toBe(true);
    });

    it("returns false for other pages", () => {
      expect(isFirstPage("website")).toBe(false);
      expect(isFirstPage("ads")).toBe(false);
      expect(isFirstPage("deploy")).toBe(false);
    });

    it("returns false for null", () => {
      expect(isFirstPage(null)).toBe(false);
    });
  });

  describe("isLastPage", () => {
    it("returns true for deploy", () => {
      expect(isLastPage("deploy")).toBe(true);
    });

    it("returns false for other pages", () => {
      expect(isLastPage("brainstorm")).toBe(false);
      expect(isLastPage("website")).toBe(false);
      expect(isLastPage("ads")).toBe(false);
    });

    it("returns false for null", () => {
      expect(isLastPage(null)).toBe(false);
    });
  });

  describe("getFirstSubstep", () => {
    it("returns null for brainstorm (no substeps)", () => {
      expect(getFirstSubstep("brainstorm")).toBe(null);
    });

    it("returns build for website", () => {
      expect(getFirstSubstep("website")).toBe("build");
    });

    it("returns content for ads", () => {
      expect(getFirstSubstep("ads")).toBe("content");
    });

    it("returns null for deploy (no substeps)", () => {
      expect(getFirstSubstep("deploy")).toBe(null);
    });
  });

  describe("getLastSubstep", () => {
    it("returns null for brainstorm (no substeps)", () => {
      expect(getLastSubstep("brainstorm")).toBe(null);
    });

    it("returns deploy for website", () => {
      expect(getLastSubstep("website")).toBe("deploy");
    });

    it("returns review for ads", () => {
      expect(getLastSubstep("ads")).toBe("review");
    });

    it("returns null for deploy (no substeps)", () => {
      expect(getLastSubstep("deploy")).toBe(null);
    });
  });

  describe("pageHasSubsteps", () => {
    it("returns false for brainstorm", () => {
      expect(pageHasSubsteps("brainstorm")).toBe(false);
    });

    it("returns true for website", () => {
      expect(pageHasSubsteps("website")).toBe(true);
    });

    it("returns true for ads", () => {
      expect(pageHasSubsteps("ads")).toBe(true);
    });

    it("returns false for deploy", () => {
      expect(pageHasSubsteps("deploy")).toBe(false);
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
      it("moves to website/build", () => {
        const result = continueWorkflow({ page: "brainstorm", substep: null });
        expect(result).toEqual({ page: "website", substep: "build" });
      });
    });

    describe("from website", () => {
      it("moves through website substeps in order", () => {
        const substepOrder = ["build", "domain", "deploy"];

        for (let i = 0; i < substepOrder.length - 1; i++) {
          const result = continueWorkflow({
            page: "website",
            substep: substepOrder[i] as WorkflowPosition["substep"],
          });
          expect(result).toEqual({ page: "website", substep: substepOrder[i + 1] });
        }
      });

      it("moves from website/deploy to ads/content", () => {
        const result = continueWorkflow({ page: "website", substep: "deploy" });
        expect(result).toEqual({ page: "ads", substep: "content" });
      });

      it("starts at build when substep is null", () => {
        const result = continueWorkflow({ page: "website", substep: null });
        expect(result).toEqual({ page: "website", substep: "build" });
      });
    });

    describe("from ads", () => {
      it("moves through ads substeps in order", () => {
        const substepOrder = ["content", "highlights", "keywords", "settings", "launch", "review"];

        for (let i = 0; i < substepOrder.length - 1; i++) {
          const result = continueWorkflow({
            page: "ads",
            substep: substepOrder[i] as WorkflowPosition["substep"],
          });
          expect(result).toEqual({ page: "ads", substep: substepOrder[i + 1] });
        }
      });

      it("moves from ads/review to deploy", () => {
        const result = continueWorkflow({ page: "ads", substep: "review" });
        expect(result).toEqual({ page: "deploy", substep: null });
      });

      it("starts at content when substep is null", () => {
        const result = continueWorkflow({ page: "ads", substep: null });
        expect(result).toEqual({ page: "ads", substep: "content" });
      });
    });

    describe("from deploy", () => {
      it("stays at deploy (end of workflow, no substeps)", () => {
        const position: WorkflowPosition = { page: "deploy", substep: null };
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
      it("moves back through website substeps", () => {
        const result1 = backWorkflow({ page: "website", substep: "deploy" });
        expect(result1).toEqual({ page: "website", substep: "domain" });

        const result2 = backWorkflow({ page: "website", substep: "domain" });
        expect(result2).toEqual({ page: "website", substep: "build" });
      });

      it("moves from website/build to brainstorm", () => {
        const result = backWorkflow({ page: "website", substep: "build" });
        expect(result).toEqual({ page: "brainstorm", substep: null });
      });

      it("moves from website with null substep to brainstorm", () => {
        const result = backWorkflow({ page: "website", substep: null });
        expect(result).toEqual({ page: "brainstorm", substep: null });
      });
    });

    describe("from ads", () => {
      it("moves back through ads substeps", () => {
        const result1 = backWorkflow({ page: "ads", substep: "review" });
        expect(result1).toEqual({ page: "ads", substep: "launch" });

        const result2 = backWorkflow({ page: "ads", substep: "highlights" });
        expect(result2).toEqual({ page: "ads", substep: "content" });
      });

      it("moves from ads/content to website/deploy", () => {
        const result = backWorkflow({ page: "ads", substep: "content" });
        expect(result).toEqual({ page: "website", substep: "deploy" });
      });
    });

    describe("from deploy", () => {
      it("moves from deploy to ads/review", () => {
        const result = backWorkflow({ page: "deploy", substep: null });
        expect(result).toEqual({ page: "ads", substep: "review" });
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
        "website/build",
        "website/domain",
        "website/deploy",
        "ads/content",
        "ads/highlights",
        "ads/keywords",
        "ads/settings",
        "ads/launch",
        "ads/review",
        "deploy/null",
      ]);
    });

    it("can traverse entire workflow backward", () => {
      let position: WorkflowPosition = { page: "deploy", substep: null };
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
        "ads/review",
        "ads/launch",
        "ads/settings",
        "ads/keywords",
        "ads/highlights",
        "ads/content",
        "website/deploy",
        "website/domain",
        "website/build",
        "brainstorm/null",
      ]);
    });
  });
});
