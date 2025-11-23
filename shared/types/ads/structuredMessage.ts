import z from "zod";

export const replySchema = z.object({
  type: z.literal("reply"),
  text: z.string().describe('A simple reply to the user'),
});
export type ReplyType = z.infer<typeof replySchema>;

/**
 * Schema for headlines response
 */
export const headlinesSchema = z.object({
  type: z.literal("headlines"),
  text: z.string().describe('A simple reply detailing your thought process'),
  headlines: z.array(z.string()).max(6).describe(`List of headlines to include`),
});
export type HeadlinesType = z.infer<typeof headlinesSchema>;

export const descriptionsSchema = z.object({
  type: z.literal("description"),
  text: z.string().describe('A simple reply detailing your thought process'),
  descriptions: z.array(z.string()).max(4).describe(`List of descriptions to include`),
});
export type DescriptionType = z.infer<typeof descriptionsSchema>;

export const featuresSchema = z.object({
  type: z.literal("features"),
  text: z.string().describe('A simple reply detailing your thought process'),
  features: z.array(z.string()).max(6).describe(`List of features to include`),
  structuredSnippets: z.object({
    category: z.string().describe(`Category header for this snippet`),
    details: z.array(z.string()).max(3).describe(`List of details to include`),
  }).array().describe(`List of structured snippets to include`),
});
export type FeaturesType = z.infer<typeof featuresSchema>;

export const keywordsSchema = z.object({
  type: z.literal("keywords"),
  text: z.string().describe('A simple reply detailing your thought process'),
  keywords: z.array(z.string()).max(10).describe(`List of keywords to include`),
});
export type KeywordsType = z.infer<typeof keywordsSchema>;

export const structuredMessageSchema = z.discriminatedUnion("type", [
    replySchema,
    headlinesSchema,
    descriptionsSchema,
    featuresSchema,
    keywordsSchema,
]);

// Union of all possible response types
export type StructuredMessageType = z.infer<typeof structuredMessageSchema>;

export const structuredMessageSchemas = [replySchema, headlinesSchema, descriptionsSchema, featuresSchema, keywordsSchema] as const;
