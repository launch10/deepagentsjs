export const CommandNames = ["create", "improve_copy"] as const;
export type CommandName = (typeof CommandNames)[number];

export const ImproveCopyStyles = ["professional", "friendly", "shorter"] as const;
export type ImproveCopyStyle = (typeof ImproveCopyStyles)[number];