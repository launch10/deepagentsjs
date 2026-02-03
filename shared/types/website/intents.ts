export const ImproveCopyStyles = ["professional", "friendly", "shorter"] as const;
export type ImproveCopyStyle = (typeof ImproveCopyStyles)[number];