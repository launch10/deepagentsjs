// formatters HAVE to be deterministic in order to allow proper prompt caching
export const formatArray = (key: string, array: string[]): string => { 
    let output = "";
    const sorted = array.sort();
    for (const item of sorted) {
        output += `
            <${key}>
                ${item}
            </${key}>
        `;
    }
    return output;
}