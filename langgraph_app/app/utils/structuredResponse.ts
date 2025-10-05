import { z } from "zod";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { AIMessage } from "@langchain/core/messages";

interface StructuredResponseParams {
  llm: any;
  prompt: string;
  schema: z.ZodSchema;
}

const keyLooksLikeForeignKey = (key: string) => key.endsWith("Id"); 
const keyIsPrimaryKey = (key: string) => key === "id";

export const schemaWithoutKeys = (schema: z.ZodSchema) => {
  if (!schema._def.typeName || schema._def.typeName !== 'ZodObject') {
    return schema;
  }
  
  const shape = (schema as z.ZodObject<any>).shape;
  const keysToOmit = Object.keys(shape)
    .sort()
    .filter(key => keyLooksLikeForeignKey(key) || keyIsPrimaryKey(key));
  
  if (keysToOmit.length === 0) {
    return schema;
  }
  
  return (schema as z.ZodObject<any>).omit(
    Object.fromEntries(keysToOmit.map(key => [key, true]))
  );
};

export const withStructuredResponse = async ({llm, prompt, schema}: StructuredResponseParams) => {
  const schemaWithoutForeignKeys = schemaWithoutKeys(schema);
  const unstructuredResponse = await llm.invoke(prompt) as AIMessage;
  const parser = StructuredOutputParser.fromZodSchema(schemaWithoutForeignKeys);
  const result = await parser.parse(unstructuredResponse.content as string);

  return result;
}