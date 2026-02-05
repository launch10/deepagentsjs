import { z } from "zod";
import { getLLM } from "@core";

const classificationSchema = z.object({
  route: z.enum(["simple", "complex"]),
});

const CLASSIFIER_PROMPT = `Classify this website edit request.

SIMPLE: Color changes, text/copy changes, font changes, spacing, show/hide elements, image swaps, minor style tweaks, small layout adjustments.
COMPLEX: Adding new sections/pages, restructuring layout, reporting bugs/errors, broken pages, adding new functionality, redesigning components, creating forms, anything that sounds like a problem report.

When in doubt, choose COMPLEX.`;

export async function classifyEdit(userMessage: string): Promise<"simple" | "complex"> {
  const llm = await getLLM({ skill: "coding", speed: "blazing", cost: "paid" });
  const structured = llm.withStructuredOutput(classificationSchema, { name: "classify_edit" });
  const result = await structured.invoke([
    { role: "system", content: CLASSIFIER_PROMPT },
    { role: "user", content: userMessage },
  ]);
  return result.route;
}
