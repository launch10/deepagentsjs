import { z } from "zod";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { AIMessage } from "@langchain/core/messages";
import { ja } from "@faker-js/faker";

interface StructuredResponseParams {
  llm: any;
  prompt: string;
  schema: z.ZodSchema;
}

const keyLooksLikeForeignKey = (key: string) => key.endsWith("Id"); 
const keyIsPrimaryKey = (key: string) => key === "id";

export const schemaWithoutForeignKeys = (schema: z.ZodSchema): z.ZodSchema => {
  if (schema instanceof z.ZodUnion) {
    const cleanedOptions = schema.options.map((option: z.ZodSchema) => schemaWithoutForeignKeys(option));
    return z.union(cleanedOptions as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
  }
  
  if (!(schema instanceof z.ZodObject)) {
    return schema;
  }
  
  return schema.omit({
    ...{
      createdAt: true,
      updatedAt: true,
    },
    ...Object.fromEntries(Object.entries(schema.shape).filter(([key]) => keyLooksLikeForeignKey(key))),
    ...Object.fromEntries(Object.entries(schema.shape).filter(([key]) => keyIsPrimaryKey(key))),
  });
};

export const withStructuredResponse = async ({llm, prompt, schema}: StructuredResponseParams) => {
  const simpleSchema = schemaWithoutForeignKeys(schema);
  const unstructuredResponse = await llm.invoke(prompt) as AIMessage
  const parser = StructuredOutputParser.fromZodSchema(simpleSchema);
  const result = await parser.parse(unstructuredResponse.content as string)

  return result;
}
