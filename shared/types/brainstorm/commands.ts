export const CommandNames = ["helpMe", "skip", "doTheRest", "finished"] as const;
export type CommandName = typeof CommandNames[number];
export interface Command {
    name: CommandName;
    prompt: string;
}

export const Commands: Record<CommandName, Command> = {
    "helpMe": {
        name: "helpMe",
        prompt: "Help me answer this question",
    },
    "skip": {
        name: "skip",
        prompt: "Skip",
    },
    "doTheRest": {
        name: "doTheRest",
        prompt: "Please do the rest for me",
    },
    "finished": {
        name: "finished",
        prompt: "I'm finished",
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

export const AgentBehavior = [...CommandNames, "default"] as const;
export type AgentBehaviorType = typeof AgentBehavior[number];