export const createInstructionList = (instructions: string[]): string => {
    let idx = 0;
    return instructions.map((instruction) => {
        idx++;
        return `**${idx}.** ${instruction}`;
    }).join('\n')
}
