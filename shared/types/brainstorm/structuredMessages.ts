import z from "zod";

/**
 * Schema for structured questions with intro, examples, and conclusion
 * Used for most responses from the agent
 */
export const replySchema = z.object({
  type: z.literal("reply"),
  text: z.string().describe('A simple message or question'),
  examples: z.array(z.string()).optional().describe(`OPTIONAL: List of examples to help the user understand`),
  conclusion: z.string().optional().describe(`OPTIONAL: Conclusion text to include after examples`),
});
export type ReplyType = z.infer<typeof replySchema>;

/**
 * Schema for the help me step specifically
 */
export const helpMeSchema = z.object({
    type: z.literal("helpMe"),
    text: z.string().describe('Acknowledge the user and explain that you will help them structure their answer'),
    template: z.string().describe(`REQUIRED: A structured template or framework to help the user articulate their answer with specificity and clarity`),
    examples: z.array(z.string()).describe(`OPTIONAL: A concrete, realistic example to help the user understand`)
});

export type HelpMeResponseType = z.infer<typeof helpMeSchema>;

export const structuredMessageSchema = z.discriminatedUnion("type", [
    replySchema,
    helpMeSchema,
]);

// Union of all possible response types
export type StructuredMessageType = z.infer<typeof structuredMessageSchema>;
