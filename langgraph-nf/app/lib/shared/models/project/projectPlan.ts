import { z } from "zod";

export const contentStrategySchema = z.object({
  overallTone: z.string().describe("Overall tone of the landing page (e.g. Playful, Professional, Techy, Funny, etc.)"),
  identifiedCoreEmotionalDriver: z.string().describe("Step 1: The primary emotional driver identified for the overall landing page (Identity, Belonging, Relief, Aspiration, Security)."),
  attentionGrabber: z.string().describe("Step 2: Compelling headline or hero statement hitting the core emotional driver."),
  empathyProblemStatement: z.string().describe("Step 3: Copy reflecting the audience's experience, mirroring their language."),
  emotionalBridge: z.string().describe("Step 4: Transition copy focusing on the emotional shift from problem to solution."),
  productRevealSolutionPitch: z.string().describe("Step 5: How the product enables the emotional transformation."),
  socialProofAngle: z.string().describe("Step 6: The suggested angle or type of social proof to use (e.g., 'Focus testimonials on transformation', 'Highlight user count for belonging')."),
  urgencyScarcityHook: z.string().describe("Step 7: The urgency/scarcity element to drive action."),
  callToAction: z.string().describe("Step 8: The emotionally congruent Call To Action text/concept."),
  pageMood: z.string().describe("The overall mood or feeling the page should evoke (e.g., 'modern, professional, and trustworthy')."),
  visualEvocation: z.string().describe("The overall mood or feeling the page should evoke (e.g., 'grid layouts, sharp lines, clear hierarchy, ample whitespace, monochrome or limited theme with accent color, precise typography')."),
  synthesizedLandingPageCopy: z.string().describe("A cohesive draft of the entire landing page copy, weaving together the elements from steps 2-8 into a flowing narrative.")
}).describe("Represents the brainstormed copy components for the entire landing page based on the 8-step emotional playbook.");

export type ContentStrategy = z.infer<typeof contentStrategySchema>;

export const projectPlanSchema = z.object({
    projectName: z.string().describe("Name of the project"),
    summary: z.string().describe("Summary of the project"),
    contentStrategy: contentStrategySchema
}).describe("Represents the brainstormed copy components for the entire landing page based on the 8-step emotional playbook.");

export type ProjectPlan = z.infer<typeof projectPlanSchema>;