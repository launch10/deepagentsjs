import { z } from 'zod';

export const footerSchema = z.object({
  availableSections: z.array(z.string()).describe("List of available sections for the footer."),
});

export type FooterType = z.infer<typeof footerSchema>;
