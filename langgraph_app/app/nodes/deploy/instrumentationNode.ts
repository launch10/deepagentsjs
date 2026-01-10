import type { DeployGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { createChecklistTask, findChecklistTask } from "@types";
import { db, codeFiles, websites, eq } from "@db";
import { getLLM } from "@core";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { WebsiteFilesBackend } from "@services";
import type { Website } from "@types";

const TASK_NAME = "instrumentation" as const;

/**
 * Schema for LLM's conversion analysis response
 */
const ConversionAnalysisSchema = z.object({
  hasConversionForm: z.boolean().describe("Whether a conversion form was found"),
  formFilePath: z.string().optional().describe("Path to the file containing the form"),
  formType: z
    .enum(["signup", "lead", "purchase", "download", "waitlist"])
    .optional()
    .describe("Type of conversion form"),
  submitHandlerName: z.string().optional().describe("Name of the submit handler function"),
  suggestedInsertionPoint: z
    .string()
    .optional()
    .describe("Code snippet where L10.conversion() should be inserted after"),
});

type ConversionAnalysis = z.infer<typeof ConversionAnalysisSchema>;

/**
 * System prompt for the instrumentation LLM
 */
const INSTRUMENTATION_SYSTEM_PROMPT = `You are a code analysis agent. Your job is to identify the PRIMARY conversion form in a React landing page.

A conversion form is typically:
- Email signup / waitlist form
- Contact form / lead capture
- Checkout / purchase form
- Download form

Analyze the provided code files and identify:
1. Whether there is a conversion form
2. The file path where it's located
3. The type of conversion (signup, lead, purchase, download, waitlist)
4. The name of the submit handler function
5. A code snippet showing where L10.conversion() should be inserted

IMPORTANT:
- Only identify ONE primary conversion form (the most important one)
- Look for onSubmit handlers, form elements, and submit buttons
- The suggestedInsertionPoint should be a unique code snippet that appears right before where the conversion tracking should go
- Focus on successful submission paths (after API success, before thank you message, etc.)

Respond with a JSON object matching this schema:
{
  "hasConversionForm": boolean,
  "formFilePath": string | undefined,
  "formType": "signup" | "lead" | "purchase" | "download" | "waitlist" | undefined,
  "submitHandlerName": string | undefined,
  "suggestedInsertionPoint": string | undefined
}`;

/**
 * Instrumentation Node
 *
 * Pre-deploy instrumentation using hybrid LLM + deterministic approach:
 * 1. LLM semantic analysis: identify primary conversion form
 * 2. Deterministic injection: add L10.conversion() calls, gtag.js, etc.
 */
export const instrumentationNode = NodeMiddleware.use(
  {},
  async (
    state: DeployGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<DeployGraphState>> => {
    const existingTask = findChecklistTask(state.tasks, TASK_NAME);

    // Already completed? No-op (idempotent)
    if (existingTask?.status === "completed") {
      return {};
    }

    if (!state.websiteId) {
      return {
        tasks: [
          ...state.tasks.filter((t) => t.name !== TASK_NAME),
          { ...createChecklistTask(TASK_NAME), status: "failed", error: "Missing websiteId" },
        ],
      };
    }

    const jwt = config?.configurable?.jwt as string | undefined;
    if (!jwt) {
      return {
        tasks: [
          ...state.tasks.filter((t) => t.name !== TASK_NAME),
          { ...createChecklistTask(TASK_NAME), status: "failed", error: "Missing JWT" },
        ],
      };
    }

    try {
      // 1. Load website files
      const files = await db
        .select({ path: codeFiles.path, content: codeFiles.content })
        .from(codeFiles)
        .where(eq(codeFiles.websiteId, state.websiteId));

      const codeFilesList = files.filter(
        (f): f is { path: string; content: string } =>
          f.path !== null &&
          f.content !== null &&
          (f.path.endsWith(".tsx") || f.path.endsWith(".ts") || f.path.endsWith(".jsx"))
      );

      if (codeFilesList.length === 0) {
        return {
          tasks: [
            ...state.tasks.filter((t) => t.name !== TASK_NAME),
            {
              ...createChecklistTask(TASK_NAME),
              status: "completed",
              result: { note: "No code files found to instrument" },
            },
          ],
        };
      }

      // 2. Use LLM to analyze and find conversion forms
      const analysis = await analyzeForConversions(codeFilesList);

      if (!analysis.hasConversionForm || !analysis.formFilePath) {
        return {
          tasks: [
            ...state.tasks.filter((t) => t.name !== TASK_NAME),
            {
              ...createChecklistTask(TASK_NAME),
              status: "completed",
              result: {
                note: "No conversion form found",
                analysis,
              },
            },
          ],
        };
      }

      // 3. Get backend for file editing
      const [websiteRow] = await db
        .select()
        .from(websites)
        .where(eq(websites.id, state.websiteId))
        .limit(1);

      if (!websiteRow) {
        throw new Error(`Website ${state.websiteId} not found`);
      }

      const backend = await WebsiteFilesBackend.create({
        website: websiteRow as Website.WebsiteType,
        jwt,
      });

      // 4. Add L10.conversion() call
      const instrumentedFiles: string[] = [];
      const conversionsAdded: string[] = [];

      if (analysis.formFilePath && analysis.suggestedInsertionPoint && analysis.formType) {
        const formFile = codeFilesList.find((f) => f.path === analysis.formFilePath);
        if (formFile) {
          // Check if L10.conversion is already present
          if (!formFile.content.includes("L10.conversion")) {
            // Add import for L10 if not present
            let newContent = formFile.content;

            if (
              !newContent.includes("import { L10 }") &&
              !newContent.includes("from '@/lib/tracking'")
            ) {
              // Add import at the top after other imports
              const importMatch = newContent.match(/^(import .+\n)+/m);
              if (importMatch) {
                const lastImportIndex = importMatch.index! + importMatch[0].length;
                newContent =
                  newContent.slice(0, lastImportIndex) +
                  `import { L10 } from '@/lib/tracking';\n` +
                  newContent.slice(lastImportIndex);
              } else {
                newContent = `import { L10 } from '@/lib/tracking';\n` + newContent;
              }
            }

            // Add L10.conversion() call after the suggested insertion point
            const insertionIndex = newContent.indexOf(analysis.suggestedInsertionPoint);
            if (insertionIndex !== -1) {
              const afterInsertion = insertionIndex + analysis.suggestedInsertionPoint.length;
              const conversionCall = `\n      L10.conversion({ label: '${analysis.formType}' });`;
              newContent =
                newContent.slice(0, afterInsertion) +
                conversionCall +
                newContent.slice(afterInsertion);

              // Write the modified file
              await backend.write(analysis.formFilePath, newContent);
              instrumentedFiles.push(analysis.formFilePath);
              conversionsAdded.push(analysis.formType);
            }
          }
        }
      }

      // 5. Inject gtag.js and L10_CONFIG into index.html if we have a Google Ads ID
      if (state.googleAdsId) {
        const indexHtml = files.find((f) => f.path === "/index.html" || f.path === "index.html");
        if (indexHtml && indexHtml.path && indexHtml.content && !indexHtml.content.includes("gtag.js")) {
          const gtagScript = `
    <!-- Google Analytics -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=${state.googleAdsId}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${state.googleAdsId}');
      window.L10_CONFIG = {
        googleAdsId: '${state.googleAdsId}'
      };
    </script>
  </head>`;

          const newIndexHtml = indexHtml.content.replace("</head>", gtagScript);
          const indexPath = indexHtml.path.startsWith("/") ? indexHtml.path : `/${indexHtml.path}`;
          await backend.write(indexPath, newIndexHtml);
          instrumentedFiles.push(indexPath);
        }
      }

      // Cleanup backend
      await backend.cleanup();

      return {
        tasks: [
          ...state.tasks.filter((t) => t.name !== TASK_NAME),
          {
            ...createChecklistTask(TASK_NAME),
            status: "completed",
            result: {
              instrumentedFiles,
              conversionsAdded,
              analysis,
            },
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        tasks: [
          ...state.tasks.filter((t) => t.name !== TASK_NAME),
          {
            ...createChecklistTask(TASK_NAME),
            status: "failed",
            error: errorMessage,
          },
        ],
      };
    }
  }
);

/**
 * Use LLM to analyze code files and identify conversion forms
 */
async function analyzeForConversions(
  files: { path: string; content: string }[]
): Promise<ConversionAnalysis> {
  const llm = getLLM("coding", "fast", "paid");

  // Build a summary of files for the LLM
  const fileSummary = files
    .map((f) => `### ${f.path}\n\`\`\`tsx\n${f.content.slice(0, 2000)}\n\`\`\``)
    .join("\n\n");

  const messages = [
    new SystemMessage(INSTRUMENTATION_SYSTEM_PROMPT),
    new HumanMessage(
      `Analyze these React files and identify the primary conversion form:\n\n${fileSummary}`
    ),
  ];

  try {
    const response = await llm.invoke(messages);
    const content = typeof response.content === "string" ? response.content : "";

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { hasConversionForm: false };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validated = ConversionAnalysisSchema.parse(parsed);
    return validated;
  } catch (error) {
    console.error("[instrumentationNode] LLM analysis error:", error);
    return { hasConversionForm: false };
  }
}
