import stringify from "fast-json-stable-stringify";

export const formatObject = (values: Record<string, any>): string => { 
    let output = "";
    // Sort keys alphabetically for deterministic output
    const sortedKeys = Object.keys(values).sort();
    for (const key of sortedKeys) {
        const value = values[key];
        if (value === undefined || value === null) continue;

        if (typeof value === 'string') {
            output += `
                <${key}>
                    ${value}
                </${key}>
            `;
        } else if (typeof value === 'object') {
            output += `
                <${key}>
                    ${stringify(value)}
                </${key}>
            `
        }
    }
    return output;
}