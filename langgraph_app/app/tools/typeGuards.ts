import { StructuredTool } from "@langchain/core/tools";
import { StructuredOutputTool } from "./structuredOutput";
import { z } from "zod";

export const isTool = (tool: any): tool is StructuredTool => {
    return tool instanceof StructuredTool && 
      tool.hasOwnProperty('description') && tool.description.length > 0 && 
      tool.hasOwnProperty('schema') && tool.schema instanceof z.ZodObject;
}

/**
 * Type guard to check if a tool is a StructuredOutputTool
 * Provides compile-time type narrowing and runtime type checking
 * 
 * @param tool - The tool to check
 * @returns true if the tool is a StructuredOutputTool, false otherwise
 * 
 * @example
 * const tools = [searchThemes, structuredOutputTool];
 * const outputTool = tools.find(isStructuredOutputTool);
 * if (outputTool) {
 *   // TypeScript now knows outputTool is StructuredOutputTool
 *   const response = outputTool.structuredResponse;
 * }
 */
export function isStructuredOutputTool<T extends z.ZodObject<any> = z.ZodObject<any>>(
  tool: StructuredTool | unknown
): tool is StructuredOutputTool<T> {
  return (
    tool instanceof StructuredOutputTool ||
    (
      typeof tool === 'object' &&
      tool !== null &&
      'structuredResponse' in tool &&
      '_structuredResponse' in tool &&
      'reset' in tool &&
      typeof (tool as any).structuredResponse !== 'undefined'
    )
  );
}

/**
 * Type guard to check if a tool has a specific method
 * Useful for checking tool capabilities at runtime
 * 
 * @param tool - The tool to check
 * @param methodName - The method name to check for
 * @returns true if the tool has the method, false otherwise
 * 
 * @example
 * if (hasMethod(tool, 'reset')) {
 *   tool.reset();
 * }
 */
export function hasMethod<K extends string>(
  tool: unknown,
  methodName: K
): tool is { [key in K]: (...args: any[]) => any } {
  return (
    typeof tool === 'object' &&
    tool !== null &&
    methodName in tool &&
    typeof (tool as any)[methodName] === 'function'
  );
}

/**
 * Type guard to check if a tool has a specific property
 * 
 * @param tool - The tool to check
 * @param propertyName - The property name to check for
 * @returns true if the tool has the property, false otherwise
 * 
 * @example
 * if (hasProperty(tool, 'structuredResponse')) {
 *   const response = tool.structuredResponse;
 * }
 */
export function hasProperty<K extends string>(
  tool: unknown,
  propertyName: K
): tool is { [key in K]: unknown } {
  return (
    typeof tool === 'object' &&
    tool !== null &&
    propertyName in tool
  );
}

/**
 * Type guard to check if any tool in an array is a StructuredOutputTool
 * 
 * @param tools - Array of tools to check
 * @returns true if any tool is a StructuredOutputTool, false otherwise
 * 
 * @example
 * if (hasStructuredOutputTool(tools)) {
 *   throw new Error('Cannot use toolsPrompt with structured output tool');
 * }
 */
export function allStructuredTools(tools: unknown[]): boolean {
  return tools.every(isTool);
}