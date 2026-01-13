import { type CoreGraphState } from "../types/graph";
import { Brainstorm, Website, Core, type PrimaryKeyType } from "../types";
import type { Simplify } from "type-fest";

export type WebsiteGraphState = Simplify<CoreGraphState & {
    command: Website.CommandName | undefined;
    brainstormId: PrimaryKeyType | undefined;
    brainstorm: Brainstorm.MemoriesType | undefined;
    theme: Website.ThemeType | undefined;
    images: Website.Image[];
    consoleErrors: Website.Errors.ConsoleError[];
    errorRetries: number;
    status: Core.Status;
    files: Website.FileMap;
}>;