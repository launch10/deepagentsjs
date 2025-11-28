export const FAQ = [
    {
        question: "How will Headlines and Details pair together?",
        answer: "Google automatically combines pairs of Headlines and Details to find the strongest performing ads. You don't have direct control over the pairing, but you can influence the results by providing high-quality, varied options for both headlines and details."
    },
    {
        question: "Can I see my preferred headlines in the preview?",
        answer: "The preview shows example combinations, but Google will test many different pairings to find what works best. Your preferred headlines will be included in the rotation."
    },
    {
        question: "What are descriptions?",
        answer: "In Google Ads terms, descriptions are the longer text that appears below your headline in a search ad. They provide additional details about your business, product, or service. Google requires 2-4 descriptions, each up to 90 characters. While headlines grab attention, descriptions provide supporting information that helps convince someone to click."
    },
    {
        question: "What are callouts?",
        answer: "Callouts are short phrases (up to 25 characters each) that highlight key features, benefits, or offers. They appear as additional text below your ad and help differentiate your business from competitors."
    },
    {
        question: "What are structured snippets?",
        answer: "Structured snippets let you showcase specific aspects of your products or services under predefined categories like 'Services', 'Types', or 'Brands'. They give users more detailed information about what you offer before they click."
    },
    {
        question: "How do keywords work?",
        answer: "Keywords are the search terms you want your ad to show up for. When someone searches for these terms on Google, your ad may appear. We help you choose keywords that match what your potential customers are searching for."
    },
    {
        question: "What's the character limit for headlines?",
        answer: "Headlines have a 30-character limit. Google requires 3-15 headlines per responsive search ad. We recommend providing at least 6 varied headlines to give Google more options to test."
    },
    {
        question: "What's the character limit for descriptions?",
        answer: "Descriptions have a 90-character limit. Google requires 2-4 descriptions per responsive search ad. We recommend providing all 4 to maximize your ad's potential."
    }
];

export const getFAQContext = (): string => {
    return FAQ.map(item => `Q: ${item.question}\nA: ${item.answer}`).join("\n\n");
};
