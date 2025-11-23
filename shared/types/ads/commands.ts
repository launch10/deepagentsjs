export const CommandNames = ["start", "refreshSuggestions"] as const;
export type CommandName = typeof CommandNames[number];

export interface Command {
    name: CommandName;
    prompt: string;
}

export const Commands: Record<CommandName, Command> = {
    "start": {
        name: "start",
        prompt: "defaultPrompt",
    },
    "refreshSuggestions": {
        name: "refreshSuggestions",
        prompt: "defaultPrompt",
    },
}

export const promptIsCommand = (prompt: string): boolean => {
    return Object.values(Commands).some((command) => command.prompt === prompt);
}

export const promptToCommand = (prompt: string): Command | undefined => {
    return Object.values(Commands).find((command) => command.prompt === prompt);
}

export const commandToPrompt = (command: CommandName): string => {
    return Commands[command].prompt;
}