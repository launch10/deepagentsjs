export const Commands = ["helpMe", "skip", "doTheRest", "finished"] as const;
export type CommandType = typeof Commands[number];

export const commandPrompts: Record<string, CommandType> = {
    "Skip": "skip",
    "Please do the rest for me": "doTheRest",
    "Help me answer this question": "helpMe",
    "I'm finished": "finished",
}

export const promptToCommand = (prompt: string): CommandType => {
    return commandPrompts[prompt];
}

export const commandToPrompt = (command: CommandType): string => {
    return Object.entries(commandPrompts).find(([_, value]) => value === command)?.[0] || "";
}

export const AgentBehavior = [...Commands, "default"] as const;
export type AgentBehaviorType = typeof AgentBehavior[number];