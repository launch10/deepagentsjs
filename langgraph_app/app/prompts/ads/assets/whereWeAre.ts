export const whereWeArePrompt = (state: any, config: any) => {
    return `
        <where_we_are>
            Users have already completed:
                1. Brainstorming
                2. Designing their landing page

            Now we're helping them:
                3. Build a Google ads campaign to drive traffic to their new website

            After this:
                4. The user will launch their campaign
                5. They can measure results and iterate
                6. They can learn which business ideas work and which don't
        </where_we_are>
    `;
};