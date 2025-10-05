import { z } from 'zod';

export const navSchema = z.object({
  availableSections: z.array(z.string()).describe("List of available sections for the Nav."),
});

export type NavType = z.infer<typeof navSchema>;
