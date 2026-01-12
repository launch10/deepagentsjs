export const CommandNames = ["create"] as const;
export type CommandName = typeof CommandNames[number];