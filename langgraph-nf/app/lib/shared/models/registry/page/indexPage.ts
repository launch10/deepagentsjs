import { z } from 'zod';

export const indexPageSchema = z.object({
    imports: z.array(z.string()).describe("The imports for the index page."),
    contentOrder: z.array(z.string()).describe("The order of the content sections.")
});

export type IndexPage = z.infer<typeof indexPageSchema>;

export const indexPagePrompt = `
1. The index page is JUST designed to pull together the content from the other sections.
2. You should just important each component, and put them in the right order.
3. You will be given the content order as <content-order></content-order>
4. You will be given the imports as <imports></imports>
5. Reuse existing shadcn components and patterns
`;