import { z } from "zod";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { schemaWithoutForeignKeys } from "@utils";
import { renderPrompt } from "@prompts";

export interface StructuredOutputProps {
  schema: z.ZodSchema;
  tag?: string;
}

export const structuredOutputPrompt = async ({
  schema,
  tag = "structured-output",
}: StructuredOutputProps): Promise<string> => {
  const parser = StructuredOutputParser.fromZodSchema(schemaWithoutForeignKeys(schema));
  return renderPrompt(`
    <${tag}>
      Please clearly begin structured output with \`\`\`json and end with \`\`\`. (Wrap in json fence backticks)
      ${parser.getFormatInstructions()}
    </${tag}>
  `);
};
