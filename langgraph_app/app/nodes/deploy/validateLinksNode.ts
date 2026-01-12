import type { DeployGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { db, codeFiles, eq } from "@db";
import { Task } from "@types";

const TASK_NAME = "ValidateLinks" as const;

interface ValidationError {
  file: string;
  message: string;
}

type LinkType = "anchor" | "route" | "skip";

function getLinkType(href: string): LinkType {
  if (href.startsWith("#")) return "anchor";
  if (href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:"))
    return "skip";
  return "route";
}

function collectAnchors(files: { path: string; content: string }[]): Set<string> {
  const anchors = new Set<string>();
  for (const file of files) {
    const matches = file.content.matchAll(/id=["']([^"']+)["']/g);
    for (const match of matches) {
      const id = match[1];
      if (id) anchors.add(id);
    }
  }
  return anchors;
}

function parseRoutes(files: { path: string; content: string }[]): Set<string> {
  const appFile = files.find((f) => f.path.endsWith("App.tsx"));
  if (!appFile) return new Set(["/"]);

  const routes = new Set<string>(["/"]);
  const matches = appFile.content.matchAll(/<Route\s+path=["']([^"']+)["']/g);
  for (const match of matches) {
    const path = match[1];
    if (path && path !== "*") {
      routes.add(path.replace(/\/$/, "") || "/");
    }
  }
  return routes;
}

function validateLinks(files: { path: string; content: string }[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const anchors = collectAnchors(files);
  const routes = parseRoutes(files);

  for (const file of files) {
    const matches = file.content.matchAll(/href=["']([^"']+)["']/g);

    for (const match of matches) {
      const href = match[1];
      if (!href) continue;

      const linkType = getLinkType(href);

      if (linkType === "anchor") {
        const id = href.slice(1);
        if (!anchors.has(id)) {
          errors.push({
            file: file.path,
            message: `Broken anchor: ${href} - no element with id="${id}"`,
          });
        }
      } else if (linkType === "route") {
        const [pathPart] = href.split(/[?#]/);
        const normalized = (pathPart || "").replace(/\/$/, "") || "/";
        if (!routes.has(normalized)) {
          errors.push({
            file: file.path,
            message: `No route for: ${href} - add <Route path="${normalized}"> to App.tsx`,
          });
        }
      }
    }
  }

  return errors;
}

/**
 * Validate Links Node (Deploy Graph)
 *
 * Static analysis of links before runtime validation.
 * Checks anchor hrefs against element IDs and route hrefs against App.tsx routes.
 */
export const validateLinksNode = NodeMiddleware.use(
  {},
  async (
    state: DeployGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<DeployGraphState>> => {
    const task = Task.findTask(state.tasks, TASK_NAME);

    if (task?.status !== "running") {
      return {};
    }

    if (!state.websiteId) {
      return {
        tasks: [{ ...task, status: "completed" }],
      };
    }

    const rawFiles = await db
      .select({ path: codeFiles.path, content: codeFiles.content })
      .from(codeFiles)
      .where(eq(codeFiles.websiteId, state.websiteId));

    const files = rawFiles.filter(
      (f): f is { path: string; content: string } => f.path !== null && f.content !== null
    );

    const errors = validateLinks(files);

    if (errors.length === 0) {
      return {
        tasks: [{ ...task, status: "completed" }],
      };
    }

    const errorList = errors.map((e) => `- ${e.file}: ${e.message}`).join("\n");

    return {
      tasks: [
        {
          ...task,
          status: "failed",
          error: `Link validation failed:\n${errorList}`,
        },
      ],
    };
  }
);
