import { z } from "zod";

const imageDetailSchema = z.enum(["auto", "low", "high"]);

const messageContentImageUrlSchema = z.object({
  type: z.literal("image_url"),
  image_url: z.union([
    z.string(),
    z.object({
      url: z.string(),
      detail: imageDetailSchema.optional(),
    }),
  ]),
});

export const messageContentTextSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

export const messageContentComplexSchema = z.union([
  messageContentTextSchema,
  messageContentImageUrlSchema,
]);

export const messageContentSchema = z.union([
  z.string(),
  z.array(messageContentComplexSchema),
]);

export const baseMessageSchema = z.object({
  additional_kwargs: z.record(z.unknown()).optional(),
  content: messageContentSchema,
  id: z.string().optional(),
  name: z.string().optional(),
  response_metadata: z.record(z.unknown()).optional(),
});

export const humanMessageSchema = baseMessageSchema.extend({
  type: z.literal("human"),
  example: z.boolean().optional(),
});

export const aiMessageSchema = baseMessageSchema.extend({
  type: z.literal("ai"),
  example: z.boolean().optional(),
  tool_calls: z.array(z.object({
    name: z.string(),
    args: z.record(z.any()),
    id: z.string().optional(),
    type: z.literal("tool_call").optional(),
  })).optional(),
  invalid_tool_calls: z.array(z.object({
    name: z.string().optional(),
    args: z.string().optional(),
    id: z.string().optional(),
    error: z.string().optional(),
    type: z.literal("invalid_tool_call").optional(),
  })).optional(),
  usage_metadata: z.object({
    input_tokens: z.number(),
    output_tokens: z.number(),
    total_tokens: z.number(),
    input_token_details: z.object({
      audio: z.number().optional(),
      cache_read: z.number().optional(),
      cache_creation: z.number().optional(),
    }).optional(),
    output_token_details: z.object({
      audio: z.number().optional(),
      reasoning: z.number().optional(),
    }).optional(),
  }).optional(),
});

export const toolMessageSchema = baseMessageSchema.extend({
  type: z.literal("tool"),
  status: z.enum(["error", "success"]).optional(),
  tool_call_id: z.string(),
  artifact: z.any().optional(),
});

export const systemMessageSchema = baseMessageSchema.extend({
  type: z.literal("system"),
});

export const functionMessageSchema = baseMessageSchema.extend({
  type: z.literal("function"),
});

export const removeMessageSchema = baseMessageSchema.extend({
  type: z.literal("remove"),
});

// The union of all message types
export const messageSchema = z.discriminatedUnion("type", [
  humanMessageSchema,
  aiMessageSchema,
  toolMessageSchema,
  systemMessageSchema,
  functionMessageSchema,
  removeMessageSchema,
]);

export type Message = z.infer<typeof messageSchema>;