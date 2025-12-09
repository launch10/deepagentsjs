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
      ${parser.getFormatInstructions()}
    </${tag}>
  `);
};
